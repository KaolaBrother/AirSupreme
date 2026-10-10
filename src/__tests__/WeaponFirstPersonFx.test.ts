import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectileController } from '@/features/weapons/ProjectileController';
import {
  createFireFrame,
  type FireFrame,
  type WeaponContext,
} from '@/features/weapons/WeaponContext';
import { WeaponFx } from '@/features/weapons/WeaponFx';
import {
  WeaponParticleField,
  type WeaponParticleBlend,
  type WeaponParticleSpec,
} from '@/features/weapons/WeaponParticleField';
import type { WeaponRuntime } from '@/features/weapons/WeaponSystem';
import { TargetSnapshotBuffer } from '@/features/weapons/WeaponTargeting';
import { getSpecialWeaponStats } from '@/features/weapons/WeaponTypes';

/**
 * 第一人称下不让自己的武器特效糊在眼前（规格 C4）：
 *
 * - WeaponParticleField 的顶点着色器按视深与粒子尺寸做近距淡出：贴到相机平面时透明度为 0，
 *   远处的粒子不受影响。
 * - 第一人称：蜂群导弹从更靠外的位置弹出（最内侧 1.6 米，第三人称 0.9 米），发射口焰小得多；
 *   火箭刚离架（约 0.6 秒内）的尾烟更淡、更小，约 1.2 秒后恢复正常。
 * - 第三人称保持原样：蜂群最内侧 0.9 米、口焰 2.6 × 0.55 米；火箭尾烟末端 3.6–5.0 米、不透明度 0.34。
 */

// ───────────────────────────── 着色器里的浮点表达式 ─────────────────────────────

type GlslEnv = Readonly<Record<string, number>>;

const GLSL_FUNCTIONS: Readonly<Record<string, (...args: number[]) => number>> = {
  clamp: (x, lo, hi) => Math.min(Math.max(x, lo), hi),
  max: Math.max,
  min: Math.min,
  abs: Math.abs,
  pow: Math.pow,
  exp: Math.exp,
  sqrt: Math.sqrt,
  mix: (a, b, t) => a + (b - a) * t,
  smoothstep: (lo, hi, x) => {
    const t = Math.min(Math.max((x - lo) / (hi - lo), 0), 1);
    return t * t * (3 - 2 * t);
  },
};

/**
 * 只够用的 GLSL 浮点表达式求值器：jsdom 跑不了着色器，这里把着色器源码里的
 * `float 名字 = 表达式;` 当作定义，按给定的输入（attribute / uniform / 视空间坐标）把值算出来。
 * 支持 + - * /、一元负号、括号、函数调用和 a.b 形式的分量；遇到别的写法直接报错。
 */
class GlslFloats {
  private readonly definitions = new Map<string, string>();

  constructor(source: string) {
    for (const match of source.matchAll(/\bfloat\s+(\w+)\s*=\s*([^;]+);/g)) {
      if (!this.definitions.has(match[1])) this.definitions.set(match[1], match[2]);
    }
  }

  public evaluate(expression: string, env: GlslEnv, depth = 0): number {
    if (depth > 24) throw new Error(`GLSL definitions are too deeply nested: ${expression}`);
    const tokens =
      expression.match(/\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[A-Za-z_]\w*(?:\.\w+)?|\S/g) ?? [];
    let index = 0;
    const peek = (): string | undefined => tokens[index];
    const take = (): string => {
      const token = tokens[index++];
      if (token === undefined) throw new Error(`Unexpected end of GLSL expression: ${expression}`);
      return token;
    };
    const expectToken = (wanted: string): void => {
      const token = take();
      if (token !== wanted)
        throw new Error(`Expected "${wanted}" but saw "${token}" in: ${expression}`);
    };

    const primary = (): number => {
      const token = take();
      if (token === '(') {
        const value = sum();
        expectToken(')');
        return value;
      }
      if (/^[\d.]/.test(token)) return Number(token);
      if (!/^[A-Za-z_]/.test(token)) {
        throw new Error(`Unsupported GLSL token "${token}" in: ${expression}`);
      }
      if (peek() === '(') {
        take();
        const args: number[] = [];
        if (peek() !== ')') {
          args.push(sum());
          while (peek() === ',') {
            take();
            args.push(sum());
          }
        }
        expectToken(')');
        const fn = GLSL_FUNCTIONS[token];
        if (!fn) throw new Error(`Unsupported GLSL function ${token}() in: ${expression}`);
        return fn(...args);
      }
      if (token in env) return env[token];
      const definition = this.definitions.get(token);
      if (definition === undefined)
        throw new Error(`Unknown GLSL value "${token}" in: ${expression}`);
      return this.evaluate(definition, env, depth + 1);
    };
    const unary = (): number => {
      if (peek() === '-') {
        take();
        return -unary();
      }
      if (peek() === '+') {
        take();
        return unary();
      }
      return primary();
    };
    const product = (): number => {
      let value = unary();
      while (peek() === '*' || peek() === '/') {
        value = take() === '*' ? value * unary() : value / unary();
      }
      return value;
    };
    function sum(): number {
      let value = product();
      while (peek() === '+' || peek() === '-') {
        value = take() === '+' ? value + product() : value - product();
      }
      return value;
    }

    const result = sum();
    if (index !== tokens.length) {
      throw new Error(`Unsupported GLSL syntax near "${tokens[index]}" in: ${expression}`);
    }
    return result;
  }
}

describe('WeaponParticleField near-camera fade', () => {
  const COLOR_ALPHA = 0.8;
  const SIZES = [0.2, 1, 2.2, 3.6, 5, 12];

  function shaderOf(blend: WeaponParticleBlend): string {
    const field = new WeaponParticleField(64, blend);
    const material = field.mesh.material as THREE.ShaderMaterial;
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    const source = material.vertexShader;
    field.dispose();
    return source;
  }

  /** 顶点着色器最终写给片元着色器的透明度（vColor 的第四个分量） */
  function alphaExpression(source: string): string {
    const writes = [...source.matchAll(/vColor\s*=\s*vec4\(\s*aColor\.rgb\s*,\s*([^;]+)\)\s*;/g)];
    expect(
      writes.length,
      'the vertex shader writes vColor = vec4(aColor.rgb, alpha)'
    ).toBeGreaterThan(0);
    return writes[writes.length - 1][1];
  }

  /**
   * 一个直径 size 米的粒子在相机前方 viewDepth 米处时，着色器给出的透明度。
   * age = 0：刚出生，寿命淡出还没开始，剩下的只有近距淡出。
   */
  function alphaAt(source: string, viewDepth: number, size: number, age = 0): number {
    const glsl = new GlslFloats(source);
    return glsl.evaluate(alphaExpression(source), {
      uTime: age,
      'aPosBirth.w': 0,
      'aVelLife.w': 2,
      'aColor.a': COLOR_ALPHA,
      'aSize.x': size,
      'aSize.y': size,
      'aPhys.z': 1.25,
      // 视空间里相机看向 -Z：前方 viewDepth 米处的点 z = -viewDepth
      'mvPosition.z': -viewDepth,
    });
  }

  describe.each(['smoke', 'glow'] as const)('%s field', (blend) => {
    let source: string;

    beforeEach(() => {
      source = shaderOf(blend);
    });

    it('is fully transparent at the camera plane and behind it', () => {
      for (const size of SIZES) {
        expect(alphaAt(source, 0, size), `size ${size} at the camera plane`).toBe(0);
        expect(alphaAt(source, -3, size), `size ${size} behind the camera`).toBe(0);
        expect(alphaAt(source, 0.05, size), `size ${size} touching the lens`).toBe(0);
      }
    });

    it('leaves distant particles untouched', () => {
      for (const size of SIZES) {
        for (const depth of [40, 150, 900, 4000]) {
          expect(alphaAt(source, depth, size), `size ${size} at ${depth} m`).toBeCloseTo(
            COLOR_ALPHA,
            6
          );
        }
      }
      // 寿命淡出照常：远处的粒子随年龄变淡，与近距淡出无关
      const young = alphaAt(source, 500, 3.6, 0.2);
      const old = alphaAt(source, 500, 3.6, 1.6);
      expect(young).toBeLessThan(COLOR_ALPHA);
      expect(old).toBeLessThan(young);
      expect(old).toBeGreaterThan(0);
    });

    it('fades in smoothly with distance from the camera, never the other way', () => {
      for (const size of SIZES) {
        let previous = 0;
        let partial = 0;
        for (let depth = 0; depth <= 40; depth += 0.05) {
          const alpha = alphaAt(source, depth, size);
          expect(alpha, `size ${size} at ${depth.toFixed(2)} m`).toBeGreaterThanOrEqual(
            previous - 1e-9
          );
          expect(alpha).toBeLessThanOrEqual(COLOR_ALPHA + 1e-9);
          if (alpha > 0.02 * COLOR_ALPHA && alpha < 0.98 * COLOR_ALPHA) partial++;
          previous = alpha;
        }
        expect(partial, `size ${size}: a ramp, not a hard cut`).toBeGreaterThan(3);
        expect(previous).toBeCloseTo(COLOR_ALPHA, 6);
      }
    });

    it('fades large particles over a longer distance than small ones', () => {
      /** 透明度恢复到九成的视深 */
      const clearDepth = (size: number): number => {
        for (let depth = 0; depth <= 60; depth += 0.02) {
          if (alphaAt(source, depth, size) >= 0.9 * COLOR_ALPHA) return depth;
        }
        return Infinity;
      };
      const small = clearDepth(1);
      const smoke = clearDepth(4.5);
      const huge = clearDepth(12);
      expect(small).toBeLessThan(smoke);
      expect(smoke).toBeLessThan(huge);
      expect(Number.isFinite(huge)).toBe(true);
      // 同一视深下，大粒子更透明
      expect(alphaAt(source, 2.5, 12)).toBeLessThan(alphaAt(source, 2.5, 4.5));
      expect(alphaAt(source, 2.5, 4.5)).toBeLessThan(alphaAt(source, 2.5, 1));
    });

    it('mostly hides a rocket smoke puff that drifts across the cockpit', () => {
      // 火箭尾烟末端 3.6–5 米：贴着座舱（一米以内）大半已经淡掉，几十米外完全可见
      for (const size of [3.6, 5]) {
        expect(alphaAt(source, 1, size)).toBeLessThan(0.5 * COLOR_ALPHA);
        expect(alphaAt(source, 0.5, size)).toBeLessThan(alphaAt(source, 3, size));
        expect(alphaAt(source, 30, size)).toBeCloseTo(COLOR_ALPHA, 6);
      }
    });

    it('takes the depth from the view-space position and the size from the particle', () => {
      // 求值确实跟着着色器走：换一个视空间深度、换一个尺寸，透明度都跟着变
      expect(alphaAt(source, 0.9, 4)).not.toBe(alphaAt(source, 3, 4));
      expect(alphaAt(source, 2, 1)).not.toBe(alphaAt(source, 2, 8));
    });
  });
});

// ───────────────────────────── 蜂群导弹与火箭 ─────────────────────────────

interface FlashRecord {
  /** 口焰火光的出生直径（米） */
  glowSize: number;
  /** 发射烟团的末端直径（米） */
  smokeSize: number;
}

interface TrailRecord {
  kind: 'rocket' | 'swarm';
  age: number;
  smoke: Array<{ alpha: number; size0: number; size1: number }>;
  glow: Array<{ alpha: number; size0: number }>;
}

interface Rig {
  fx: WeaponFx;
  controller: ProjectileController;
  frame: FireFrame;
  flashes: FlashRecord[];
  trails: TrailRecord[];
  /** 每枚蜂群导弹离架那一刻的位置（机体局部坐标） */
  swarmLaunches: THREE.Vector3[];
  fire(id: 'rockets' | 'swarm', count: number): void;
  run(seconds: number, dt: number): void;
  dispose(): void;
}

describe('first-person weapon effects', () => {
  const rigs: Rig[] = [];
  let canvasSpy: { mockRestore(): void };
  let randomSpy: { mockRestore(): void; mockReturnValue(value: number): unknown };

  beforeEach(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    // 散布 / 绽开角 / 尺寸里的随机数固定下来，两种视角才能逐枚对比
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    for (const rig of rigs.splice(0)) rig.dispose();
    randomSpy.mockRestore();
    canvasSpy.mockRestore();
  });

  function createRig(firstPerson: boolean): Rig {
    const scene = new THREE.Scene();
    const fx = new WeaponFx(scene);
    fx.attach();
    fx.setFirstPerson(firstPerson);

    const flashes: FlashRecord[] = [];
    const trails: TrailRecord[] = [];
    const swarmLaunches: THREE.Vector3[] = [];
    let flash: FlashRecord | null = null;
    let trail: TrailRecord | null = null;

    // 记录粒子场收到的粒子，并归到正在进行的那次口焰 / 尾迹发射上
    const emitGlow = fx.glow.emit.bind(fx.glow);
    const emitSmoke = fx.smoke.emit.bind(fx.smoke);
    vi.spyOn(fx.glow, 'emit').mockImplementation((spec: WeaponParticleSpec) => {
      if (flash) flash.glowSize = Math.max(flash.glowSize, spec.size0);
      if (trail) trail.glow.push({ alpha: spec.alpha, size0: spec.size0 });
      emitGlow(spec);
    });
    vi.spyOn(fx.smoke, 'emit').mockImplementation((spec: WeaponParticleSpec) => {
      if (flash) flash.smokeSize = Math.max(flash.smokeSize, spec.size1);
      if (trail) trail.smoke.push({ alpha: spec.alpha, size0: spec.size0, size1: spec.size1 });
      emitSmoke(spec);
    });
    const emitMuzzleFlash = fx.particles.emitMuzzleFlash.bind(fx.particles);
    vi.spyOn(fx.particles, 'emitMuzzleFlash').mockImplementation((...args) => {
      flash = { glowSize: 0, smokeSize: 0 };
      emitMuzzleFlash(...args);
      flashes.push(flash);
      flash = null;
    });
    const emitTrail = fx.particles.emitTrail.bind(fx.particles);
    vi.spyOn(fx.particles, 'emitTrail').mockImplementation((...args) => {
      trail = { kind: args[0], age: args[6], smoke: [], glow: [] };
      emitTrail(...args);
      trails.push(trail);
      trail = null;
    });

    // 载机：任意姿态、原地不动（发射点只看机体局部坐标）
    const frame = createFireFrame();
    frame.position.set(120, 900, -340);
    frame.quaternion.setFromEuler(new THREE.Euler(0.18, 0.7, -0.4, 'YXZ'));
    frame.forward.set(0, 0, -1).applyQuaternion(frame.quaternion);
    frame.carry.set(0, 0, 0);
    frame.valid = true;
    const toLocal = frame.quaternion.clone().invert();

    // 蜂群导弹第一次出现在弹体渲染列表里的那一帧就是离架的那一帧
    const seen = new Set<object>();
    const renderBodies = fx.renderBodies.bind(fx);
    vi.spyOn(fx, 'renderBodies').mockImplementation((kind, projectiles) => {
      if (kind === 'swarm') {
        for (const projectile of projectiles) {
          if (projectile.active && !seen.has(projectile)) {
            seen.add(projectile);
            swarmLaunches.push(
              projectile.position.clone().sub(frame.position).applyQuaternion(toLocal)
            );
          }
        }
      }
      renderBodies(kind, projectiles);
    });

    const snapshot = new TargetSnapshotBuffer();
    const context: WeaponContext = {
      fx,
      particleSystem: null,
      surfaceSampler: null,
      getSnapshot: () => snapshot,
      emitFired: vi.fn(),
      emitImpact: vi.fn(),
      emitEmpPulse: vi.fn(),
      emitOverheat: vi.fn(),
      emitBeamEnd: vi.fn(),
      emitChargeStart: vi.fn(),
      emitDryFire: vi.fn(),
      attachFx: vi.fn(),
    };
    const controller = new ProjectileController(context);

    const rig: Rig = {
      fx,
      controller,
      frame,
      flashes,
      trails,
      swarmLaunches,
      fire(id, count) {
        const stats = getSpecialWeaponStats(id, 0);
        stats.projectileCount = count;
        stats.range = 2000;
        const runtime = { id, level: 0, stats } as WeaponRuntime;
        expect(controller.fireSalvo(id, runtime, frame)).toBe(count);
      },
      run(seconds, dt) {
        const frames = Math.round(seconds / dt);
        for (let i = 0; i < frames; i++) {
          controller.update(dt, frame);
          fx.update(dt);
        }
      },
      dispose() {
        fx.dispose();
      },
    };
    rigs.push(rig);
    return rig;
  }

  // ───────────────────────────── 蜂群：发射位置 ─────────────────────────────

  describe('swarm launch points', () => {
    const SALVO = 8;
    /** 步长很小：离架那一帧导弹只飞出几厘米 */
    const DT = 0.0005;

    function launchPoints(firstPerson: boolean): THREE.Vector3[] {
      const rig = createRig(firstPerson);
      rig.fire('swarm', SALVO);
      rig.run(0.7, DT);
      expect(rig.swarmLaunches, 'every missile of the salvo left the rail').toHaveLength(SALVO);
      return rig.swarmLaunches;
    }

    const innermost = (points: THREE.Vector3[]): number =>
      Math.min(...points.map((point) => Math.abs(point.x)));

    it('third person: the innermost missiles leave 0.9 m either side of the centre line', () => {
      const points = launchPoints(false);
      expect(innermost(points)).toBeCloseTo(0.9, 1);
      expect(Math.abs(innermost(points) - 0.9)).toBeLessThan(0.06);
    });

    it('first person: the innermost missiles leave 1.6 m out', () => {
      const points = launchPoints(true);
      expect(Math.abs(innermost(points) - 1.6)).toBeLessThan(0.06);
      for (const point of points) {
        expect(Math.abs(point.x), 'no missile leaves near the centre line').toBeGreaterThan(1.5);
      }
    });

    it('moves every launch point outward by the same 0.7 m, on its own side', () => {
      const third = launchPoints(false);
      const first = launchPoints(true);
      for (let i = 0; i < SALVO; i++) {
        expect(Math.sign(first[i].x), `missile ${i}: same side`).toBe(Math.sign(third[i].x));
        expect(Math.abs(first[i].x) - Math.abs(third[i].x), `missile ${i}`).toBeCloseTo(0.7, 1);
        // 只是横向挪开：上下、前后位置不变
        expect(Math.abs(first[i].y - third[i].y), `missile ${i}: height`).toBeLessThan(0.05);
        expect(Math.abs(first[i].z - third[i].z), `missile ${i}: fore / aft`).toBeLessThan(0.05);
      }
    });

    it.each([
      ['third person', false],
      ['first person', true],
    ] as const)('uses both sides of the aircraft evenly (%s)', (_name, firstPerson) => {
      const points = launchPoints(firstPerson);
      expect(points.filter((point) => point.x > 0)).toHaveLength(SALVO / 2);
      expect(points.filter((point) => point.x < 0)).toHaveLength(SALVO / 2);
      // 从机腹下方弹出
      for (const point of points) {
        expect(point.y).toBeLessThan(0);
        expect(Math.abs(point.y)).toBeLessThan(1.5);
      }
    });

    it('follows the view mode salvo by salvo', () => {
      const rig = createRig(false);
      rig.fire('swarm', 2);
      rig.run(0.2, DT);
      rig.fx.setFirstPerson(true);
      rig.fire('swarm', 2);
      rig.run(0.2, DT);
      rig.fx.setFirstPerson(false);
      rig.fire('swarm', 2);
      rig.run(0.2, DT);
      const offsets = rig.swarmLaunches.map((point) => Math.abs(point.x));
      expect(offsets).toHaveLength(6);
      expect(Math.min(offsets[0], offsets[1])).toBeCloseTo(0.9, 1);
      expect(Math.min(offsets[2], offsets[3])).toBeCloseTo(1.6, 1);
      expect(Math.min(offsets[4], offsets[5])).toBeCloseTo(0.9, 1);
    });
  });

  // ───────────────────────────── 蜂群：发射口焰 ─────────────────────────────

  describe('launch flash', () => {
    function flashesOf(id: 'rockets' | 'swarm', firstPerson: boolean): FlashRecord[] {
      const rig = createRig(firstPerson);
      rig.fire(id, 4);
      rig.run(0.5, 1 / 120);
      expect(rig.flashes, 'one flash per projectile').toHaveLength(4);
      return rig.flashes;
    }

    it('third person: the swarm flash is what it was (2.6 m × 0.55)', () => {
      for (const flash of flashesOf('swarm', false)) {
        expect(flash.glowSize).toBeCloseTo(2.6 * 0.55, 3);
        expect(flash.smokeSize).toBeCloseTo(3.4 * 0.55, 3);
      }
    });

    it('first person: the swarm flash is much smaller', () => {
      const third = flashesOf('swarm', false);
      const first = flashesOf('swarm', true);
      for (let i = 0; i < first.length; i++) {
        expect(first[i].glowSize, 'still a flash').toBeGreaterThan(0);
        expect(first[i].glowSize / third[i].glowSize, 'fire').toBeLessThan(0.2);
        expect(first[i].smokeSize / third[i].smokeSize, 'launch smoke').toBeLessThan(0.2);
        expect(first[i].glowSize, 'well under half a metre').toBeLessThan(0.3);
      }
    });

    it('first person: shrinks the swarm flash far more than the ordinary muzzle scale does', () => {
      const ratio = (id: 'rockets' | 'swarm'): number =>
        flashesOf(id, true)[0].glowSize / flashesOf(id, false)[0].glowSize;
      // 火箭只按第一人称通用的枪口缩放（0.35）；蜂群还要再小一大截
      expect(ratio('rockets')).toBeCloseTo(0.35, 2);
      expect(ratio('swarm')).toBeLessThan(ratio('rockets') * 0.5);
    });

    it('leaves the rocket flash as it was in both views', () => {
      for (const flash of flashesOf('rockets', false)) {
        expect(flash.glowSize).toBeCloseTo(2.6 * 0.9, 3);
      }
      for (const flash of flashesOf('rockets', true)) {
        expect(flash.glowSize).toBeCloseTo(2.6 * 0.9 * 0.35, 3);
      }
    });
  });

  // ───────────────────────────── 火箭尾烟 ─────────────────────────────

  describe('rocket trail smoke', () => {
    const NORMAL_ALPHA = 0.34;
    const YOUNG_AGES = [0, 0.1, 0.3, 0.5, 0.6];
    const GROWN_AGES = [1.2, 1.5, 3, 10];

    /** 一段 15 米的尾迹在这个弹龄下发出的烟（随机数固定为 random） */
    function smokeAt(
      firstPerson: boolean,
      age: number,
      random = 0.5,
      kind: 'rocket' | 'swarm' = 'rocket'
    ): { alpha: number; size1: number; size0: number } {
      const rig = createRig(firstPerson);
      randomSpy.mockReturnValue(random);
      const from = new THREE.Vector3(0, 500, 0);
      const to = new THREE.Vector3(0, 500, -15);
      rig.fx.particles.emitTrail(
        kind,
        from,
        to,
        new THREE.Vector3(0, 0, -175),
        1 / 60,
        { value: 0 },
        age
      );
      randomSpy.mockReturnValue(0.5);
      const smoke = rig.trails[rig.trails.length - 1].smoke;
      expect(smoke.length, 'the trail segment left smoke').toBeGreaterThan(3);
      // 同一段里每一团都一样（随机数固定）
      for (const puff of smoke) {
        expect(puff.alpha).toBeCloseTo(smoke[0].alpha, 9);
        expect(puff.size1).toBeCloseTo(smoke[0].size1, 9);
      }
      return smoke[0];
    }

    it('third person: opacity 0.34 and 3.6–5.0 m at every age, as before', () => {
      for (const age of [...YOUNG_AGES, 0.9, ...GROWN_AGES]) {
        expect(smokeAt(false, age).alpha, `age ${age}`).toBeCloseTo(NORMAL_ALPHA, 6);
        expect(smokeAt(false, age, 0).size1, `age ${age}: smallest`).toBeCloseTo(3.6, 6);
        expect(smokeAt(false, age, 0.999).size1, `age ${age}: largest`).toBeCloseTo(5.0, 2);
        expect(smokeAt(false, age).size0, `age ${age}: starting size`).toBeCloseTo(1.5, 6);
      }
    });

    it.each(YOUNG_AGES)('first person: a rocket %f s old leaves thinner, smaller smoke', (age) => {
      for (const random of [0, 0.5, 0.999]) {
        const third = smokeAt(false, age, random);
        const first = smokeAt(true, age, random);
        expect(first.alpha, 'thinner').toBeLessThan(third.alpha * 0.75);
        expect(first.size1, 'smaller').toBeLessThan(third.size1 * 0.8);
        expect(first.alpha, 'still some smoke').toBeGreaterThan(0.05);
        expect(first.size1).toBeGreaterThan(1);
      }
    });

    it('first person: the smoke is reduced in full for the whole first 0.6 s', () => {
      const newborn = smokeAt(true, 0);
      for (const age of YOUNG_AGES) {
        expect(smokeAt(true, age).alpha, `age ${age}`).toBeCloseTo(newborn.alpha, 6);
        expect(smokeAt(true, age).size1, `age ${age}`).toBeCloseTo(newborn.size1, 6);
      }
    });

    it.each(GROWN_AGES)('first person: by %f s the smoke is back to normal', (age) => {
      for (const random of [0, 0.5, 0.999]) {
        const third = smokeAt(false, age, random);
        const first = smokeAt(true, age, random);
        expect(first.alpha).toBeCloseTo(third.alpha, 6);
        expect(first.size1).toBeCloseTo(third.size1, 6);
        expect(first.size0).toBeCloseTo(third.size0, 6);
      }
      expect(smokeAt(true, age).alpha).toBeCloseTo(NORMAL_ALPHA, 6);
    });

    it('first person: recovers gradually between 0.6 s and 1.2 s', () => {
      const young = smokeAt(true, 0.3);
      const middle = smokeAt(true, 0.9);
      const grown = smokeAt(true, 1.5);
      expect(middle.alpha).toBeGreaterThan(young.alpha + 0.02);
      expect(middle.alpha).toBeLessThan(grown.alpha - 0.02);
      expect(middle.size1).toBeGreaterThan(young.size1 + 0.1);
      expect(middle.size1).toBeLessThan(grown.size1 - 0.1);

      let previous = smokeAt(true, 0);
      for (let age = 0.05; age <= 1.6; age += 0.05) {
        const current = smokeAt(true, age);
        expect(current.alpha, `age ${age.toFixed(2)}`).toBeGreaterThanOrEqual(
          previous.alpha - 1e-9
        );
        expect(current.size1, `age ${age.toFixed(2)}`).toBeGreaterThanOrEqual(
          previous.size1 - 1e-9
        );
        previous = current;
      }
    });

    it('a real rocket fired in first person trails thin smoke at first and normal smoke later', () => {
      const flown = (firstPerson: boolean): TrailRecord[] => {
        const rig = createRig(firstPerson);
        rig.fire('rockets', 1);
        rig.run(1.8, 1 / 60);
        const rocketTrails = rig.trails.filter(
          (trail) => trail.kind === 'rocket' && trail.smoke.length > 0
        );
        expect(rocketTrails.length, 'the rocket left a trail').toBeGreaterThan(60);
        return rocketTrails;
      };

      const first = flown(true);
      // 尾迹的弹龄就是火箭离架后的飞行时间
      expect(first[0].age).toBeLessThan(0.05);
      expect(first[first.length - 1].age).toBeGreaterThan(1.5);
      for (let i = 1; i < first.length; i++) {
        expect(first[i].age).toBeGreaterThan(first[i - 1].age);
      }
      for (const trail of first) {
        for (const puff of trail.smoke) {
          if (trail.age <= 0.6)
            expect(puff.alpha, `age ${trail.age}`).toBeLessThan(NORMAL_ALPHA * 0.75);
          if (trail.age >= 1.25)
            expect(puff.alpha, `age ${trail.age}`).toBeCloseTo(NORMAL_ALPHA, 6);
        }
      }

      for (const trail of flown(false)) {
        for (const puff of trail.smoke) {
          expect(puff.alpha, `third person, age ${trail.age}`).toBeCloseTo(NORMAL_ALPHA, 6);
        }
      }
    });
  });
});
