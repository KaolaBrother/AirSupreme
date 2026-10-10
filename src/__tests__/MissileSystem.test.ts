import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { HIT_RADIUS_USERDATA_KEY } from '@/core/CombatContracts';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { ParticleType } from '@/features/effects/particles/ParticleTypes';
import type { ParticleEmitter, SpawnOptions } from '@/features/effects/particles/ParticleTypes';
import { emitMissileTrail } from '@/features/effects/particles/recipes/trailRecipes';

/**
 * 玩家导弹（W6 近炸距离、W7 离架 / 尾迹）。
 * 不固定导弹的速度、加速度、转向速度、寿命和命中时间（后续批次会把它改快）：
 * 这里只看飞行方向（相邻两步的位移方向）和尾迹出现的时机。
 */

const DT = 1 / 60;
/** 离架后直飞这么久才开始制导 */
const BOOST_TIME = 0.2;
/** 离架后这么久不出烟 */
const TRAIL_DELAY = 0.3;
/** 没有自带命中半径的目标的近炸距离 */
const PROXIMITY_RADIUS = 6;

interface EmittedParticle {
  type: ParticleType;
  alpha: number | undefined;
  intensity: number | undefined;
  sizeEnd: number | undefined;
}

/** 记录每个粒子的发射参数（配方复用同一个 options 对象，这里当场抄一份） */
function createRecordingEmitter(): { emitter: ParticleEmitter; particles: EmittedParticle[] } {
  const particles: EmittedParticle[] = [];
  const emitter = {
    detail: 1,
    emit: (type: ParticleType, _position: THREE.Vector3, options: SpawnOptions): boolean => {
      particles.push({
        type,
        alpha: options.alpha,
        intensity: options.intensity,
        sizeEnd: options.sizeEnd,
      });
      return true;
    },
    count: (base: number): number => base,
    schedule: (): void => undefined,
    debris: (): void => undefined,
  } as unknown as ParticleEmitter;
  return { emitter, particles };
}

function smokeOf(particles: readonly EmittedParticle[]): EmittedParticle[] {
  return particles.filter((particle) => particle.type === ParticleType.SMOKE);
}

function glowOf(particles: readonly EmittedParticle[]): EmittedParticle[] {
  return particles.filter((particle) => particle.type === ParticleType.GLOW);
}

function maxOf(values: Array<number | undefined>): number {
  return Math.max(...values.map((value) => value ?? 0));
}

describe('MissileSystem', () => {
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    particleSystem = {
      createMissileTrail: vi.fn(),
      createMissileImpact: vi.fn(),
      createTrail: vi.fn(),
      createExplosion: vi.fn(),
    } as unknown as ParticleSystem;
  });

  /** 发射一枚并返回它的模型（场景里新增的那个节点） */
  function fireMissile(
    system: MissileSystem,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    target?: THREE.Object3D
  ): THREE.Object3D {
    const before = new Set(scene.children);
    system.fire(position, direction, target);
    const added = scene.children.filter((child) => !before.has(child));
    expect(added.length, 'expected one missile model in the scene').toBe(1);
    return added[0];
  }

  function farTarget(position: THREE.Vector3): THREE.Object3D {
    const target = new THREE.Object3D();
    target.position.copy(position);
    scene.add(target);
    return target;
  }

  /** 推进 steps 步，返回每一步的位移方向（单位向量） */
  function flightDirections(
    system: MissileSystem,
    missile: THREE.Object3D,
    steps: number
  ): THREE.Vector3[] {
    const directions: THREE.Vector3[] = [];
    for (let i = 0; i < steps; i += 1) {
      const before = missile.position.clone();
      system.update(DT);
      const moved = missile.position.clone().sub(before);
      expect(moved.length(), `step ${i}: the missile should be moving`).toBeGreaterThan(0);
      directions.push(moved.normalize());
    }
    return directions;
  }

  it('emits the missile trail with boosted visibility once the launch delay has passed', () => {
    const system = new MissileSystem(scene, particleSystem);
    const createMissileTrail = vi.mocked(particleSystem.createMissileTrail);

    system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    for (let i = 0; i < Math.round(0.6 / DT); i += 1) system.update(DT);

    expect(createMissileTrail).toHaveBeenCalled();
    expect(createMissileTrail.mock.calls[0][3]).toBeGreaterThan(1);
  });

  it('should emit missile impact effects when colliding with a target', () => {
    const system = new MissileSystem(scene, particleSystem);
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    scene.add(target);

    system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), target);
    const onHit = vi.fn();

    system.checkCollisions([target], onHit);

    expect(onHit).toHaveBeenCalledWith(target, expect.any(THREE.Vector3));
    expect(particleSystem.createMissileImpact).toHaveBeenCalled();
  });

  describe('launch', () => {
    it('starts where it was launched from', () => {
      const system = new MissileSystem(scene, particleSystem);
      const origin = new THREE.Vector3(12.5, 340, -80);

      const missile = fireMissile(system, origin, new THREE.Vector3(0, 0, -1));

      expect(missile.position.distanceTo(origin)).toBeLessThan(1e-9);
      expect(system.getActiveCount()).toBe(1);
    });

    it('flies straight along the launch direction for its first 0.2 s, target or not', () => {
      const system = new MissileSystem(scene, particleSystem);
      // 目标在正右方并且更高：一制导就会偏离发射方向
      const target = farTarget(new THREE.Vector3(600, 150, 0));
      const launch = new THREE.Vector3(0, 0, -1);
      const missile = fireMissile(system, new THREE.Vector3(0, 0, 0), launch, target);

      const directions = flightDirections(system, missile, Math.round(BOOST_TIME / DT) - 2);

      for (const [index, direction] of directions.entries()) {
        expect(direction.angleTo(launch), `step ${index}`).toBeLessThan(1e-6);
      }
      expect(Math.abs(missile.position.x)).toBeLessThan(1e-6);
      expect(Math.abs(missile.position.y)).toBeLessThan(1e-6);
      expect(missile.position.z).toBeLessThan(0);
    });

    it('leaves along the launch direction, not along the line to the target', () => {
      const system = new MissileSystem(scene, particleSystem);
      const origin = new THREE.Vector3(40, 200, 90);
      const launch = new THREE.Vector3(0.3, 0.25, -0.9).normalize();
      const target = farTarget(new THREE.Vector3(-500, 60, 300));
      const missile = fireMissile(system, origin, launch, target);

      const directions = flightDirections(system, missile, Math.round(BOOST_TIME / DT) - 2);

      for (const [index, direction] of directions.entries()) {
        expect(direction.angleTo(launch), `step ${index}`).toBeLessThan(1e-6);
      }
      const travelled = missile.position.clone().sub(origin);
      expect(travelled.angleTo(launch)).toBeLessThan(1e-6);
    });

    it('accepts a launch direction that is not unit length', () => {
      const system = new MissileSystem(scene, particleSystem);
      const launch = new THREE.Vector3(0, 3, -4);
      const missile = fireMissile(system, new THREE.Vector3(0, 0, 0), launch);
      const reference = new MissileSystem(scene, particleSystem);
      const unitMissile = fireMissile(
        reference,
        new THREE.Vector3(0, 0, 0),
        launch.clone().normalize()
      );

      flightDirections(system, missile, 6);
      flightDirections(reference, unitMissile, 6);

      // 方向向量的长度不改变飞行速度
      expect(missile.position.distanceTo(unitMissile.position)).toBeLessThan(1e-6);
    });

    it('starts homing once the 0.2 s are over', () => {
      const system = new MissileSystem(scene, particleSystem);
      const target = farTarget(new THREE.Vector3(600, 0, 0));
      const launch = new THREE.Vector3(0, 0, -1);
      const missile = fireMissile(system, new THREE.Vector3(0, 0, 0), launch, target);
      const toTarget = new THREE.Vector3(1, 0, 0);

      const directions = flightDirections(system, missile, Math.round(0.4 / DT));

      const early = directions[Math.round(BOOST_TIME / DT) - 3];
      const late = directions[directions.length - 1];
      expect(early.angleTo(launch)).toBeLessThan(1e-6);
      expect(late.angleTo(launch), 'heading has left the launch direction').toBeGreaterThan(0.01);
      expect(late.dot(toTarget), 'and has swung toward the target').toBeGreaterThan(
        early.dot(toTarget)
      );
      // 一旦开始转向，方向单调地靠近目标
      let previous = -Infinity;
      for (const direction of directions) {
        expect(direction.dot(toTarget)).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = direction.dot(toTarget);
      }
    });

    it('homes on a target above the launch line only after the 0.2 s', () => {
      const system = new MissileSystem(scene, particleSystem);
      const target = farTarget(new THREE.Vector3(0, 400, -400));
      const missile = fireMissile(
        system,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
        target
      );

      flightDirections(system, missile, Math.round(BOOST_TIME / DT) - 2);
      expect(Math.abs(missile.position.y)).toBeLessThan(1e-6);

      flightDirections(system, missile, Math.round(0.3 / DT));
      expect(missile.position.y).toBeGreaterThan(0.1);
    });

    it('keeps flying straight when it has no target at all', () => {
      const system = new MissileSystem(scene, particleSystem);
      const launch = new THREE.Vector3(1, 0, 0);
      const missile = fireMissile(system, new THREE.Vector3(0, 50, 0), launch);

      const directions = flightDirections(system, missile, Math.round(0.6 / DT));

      for (const direction of directions) {
        expect(direction.angleTo(launch)).toBeLessThan(1e-6);
      }
    });
  });

  describe('smoke trail', () => {
    /** 粒子系统替身：createMissileTrail 走真实的尾迹配方，粒子记到 particles 里 */
    function recordingParticleSystem(): {
      system: ParticleSystem;
      particles: EmittedParticle[];
      trailCalls: () => number;
    } {
      const { emitter, particles } = createRecordingEmitter();
      const createMissileTrail = vi.fn(
        (
          position: THREE.Vector3,
          direction: THREE.Vector3,
          color: THREE.Color,
          intensity?: number
        ): void => emitMissileTrail(emitter, position, direction, color, intensity)
      );
      const system = {
        createMissileTrail,
        createMissileImpact: vi.fn(),
        createTrail: vi.fn(),
        createExplosion: vi.fn(),
      } as unknown as ParticleSystem;
      return { system, particles, trailCalls: () => createMissileTrail.mock.calls.length };
    }

    it('emits nothing for the first 0.3 s after launch', () => {
      const recording = recordingParticleSystem();
      const system = new MissileSystem(scene, recording.system);
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));

      for (let i = 0; i < Math.round(TRAIL_DELAY / DT) - 2; i += 1) {
        system.update(DT);
        expect(smokeOf(recording.particles).length, `step ${i}`).toBe(0);
      }

      expect(recording.particles.length).toBe(0);
    });

    it('starts the trail shortly after the 0.3 s', () => {
      const recording = recordingParticleSystem();
      const system = new MissileSystem(scene, recording.system);
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));

      let firstSmokeStep = -1;
      for (let i = 1; i <= Math.round(1 / DT) && firstSmokeStep < 0; i += 1) {
        system.update(DT);
        if (smokeOf(recording.particles).length > 0) firstSmokeStep = i;
      }

      expect(firstSmokeStep * DT).toBeGreaterThan(TRAIL_DELAY - 2 * DT);
      expect(firstSmokeStep * DT).toBeLessThan(TRAIL_DELAY + 0.1);
    });

    it('ramps the trail in instead of starting at full strength', () => {
      const recording = recordingParticleSystem();
      const system = new MissileSystem(scene, recording.system);
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));

      const smokeAlpha: number[] = [];
      const glow: number[] = [];
      for (let i = 0; i < Math.round(2 / DT); i += 1) {
        const seen = recording.particles.length;
        system.update(DT);
        const fresh = recording.particles.slice(seen);
        if (smokeOf(fresh).length > 0) smokeAlpha.push(maxOf(smokeOf(fresh).map((p) => p.alpha)));
        if (glowOf(fresh).length > 0) glow.push(maxOf(glowOf(fresh).map((p) => p.intensity)));
      }

      expect(smokeAlpha.length).toBeGreaterThan(10);
      const full = smokeAlpha[smokeAlpha.length - 1];
      expect(full).toBeGreaterThan(0);
      expect(smokeAlpha[0], 'the first puffs are faint').toBeLessThan(full * 0.5);
      for (let i = 1; i < smokeAlpha.length; i += 1) {
        expect(smokeAlpha[i], `smoke at emission ${i}`).toBeGreaterThanOrEqual(smokeAlpha[i - 1]);
      }
      expect(glow[0], 'the flame glow ramps too').toBeLessThan(glow[glow.length - 1] * 0.5);
      for (let i = 1; i < glow.length; i += 1) {
        expect(glow[i], `glow at emission ${i}`).toBeGreaterThanOrEqual(glow[i - 1]);
      }
      // 渐入有终点：最后半秒不再变化
      const tail = smokeAlpha.slice(-10);
      expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(1e-9);
    });

    it('delays each missile’s trail from its own launch', () => {
      const recording = recordingParticleSystem();
      const system = new MissileSystem(scene, recording.system);
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      for (let i = 0; i < Math.round(1 / DT); i += 1) system.update(DT);
      const single = recording.trailCalls();
      expect(single).toBeGreaterThan(0);

      // 第二枚刚离架：它自己的 0.3 秒里，尾迹只来自第一枚
      system.fire(new THREE.Vector3(50, 0, 0), new THREE.Vector3(0, 0, -1));
      const steps = Math.round(TRAIL_DELAY / DT) - 2;
      const before = recording.trailCalls();
      const reference = recordingParticleSystem();
      const lone = new MissileSystem(new THREE.Scene(), reference.system);
      lone.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      for (let i = 0; i < Math.round(1 / DT); i += 1) lone.update(DT);
      const loneBefore = reference.trailCalls();
      for (let i = 0; i < steps; i += 1) {
        system.update(DT);
        lone.update(DT);
      }

      expect(recording.trailCalls() - before).toBe(reference.trailCalls() - loneBefore);
    });

    it('leaves the generic trail used by enemy and unit missiles as it was', () => {
      // 改动前的通用配方：尾焰 4.2 / 柔光 2.2、烟不透明度 0.42、烟团末尺寸 4.2
      const sample = (): EmittedParticle[] => {
        const { emitter, particles } = createRecordingEmitter();
        emitMissileTrail(
          emitter,
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -60),
          new THREE.Color(0xff8833),
          1.05
        );
        return particles;
      };
      const expectGeneric = (particles: EmittedParticle[], label: string): void => {
        const smoke = smokeOf(particles);
        const glows = glowOf(particles);
        expect(smoke.length, label).toBeGreaterThan(0);
        for (const puff of smoke) {
          expect(puff.alpha, label).toBeCloseTo(0.42, 6);
          expect(puff.sizeEnd, label).toBeCloseTo(4.2, 6);
        }
        expect(glows.map((g) => g.intensity).sort(), label).toEqual([2.2, 4.2]);
      };

      expectGeneric(sample(), 'before any player missile');

      // 玩家导弹飞过渐入期与满强度期之后，通用配方不受影响
      const recording = recordingParticleSystem();
      const system = new MissileSystem(scene, recording.system);
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      for (let i = 0; i < Math.round(0.5 / DT); i += 1) system.update(DT);
      expectGeneric(sample(), 'while a player missile is ramping its trail in');
      for (let i = 0; i < Math.round(1.5 / DT); i += 1) system.update(DT);
      expectGeneric(sample(), 'after a player missile reached its full trail');

      // 玩家导弹的烟比通用配方轻
      const playerSmoke = smokeOf(recording.particles);
      expect(maxOf(playerSmoke.map((p) => p.alpha))).toBeLessThan(0.42);
    });

    it('does not leave the player recipe switched on when the particle system throws', () => {
      const failing = {
        createMissileTrail: vi.fn(() => {
          throw new Error('particle pool exhausted');
        }),
        createMissileImpact: vi.fn(),
        createTrail: vi.fn(),
        createExplosion: vi.fn(),
      } as unknown as ParticleSystem;
      const system = new MissileSystem(scene, failing);
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      expect(() => {
        for (let i = 0; i < Math.round(0.6 / DT); i += 1) system.update(DT);
      }).toThrow('particle pool exhausted');

      const { emitter, particles } = createRecordingEmitter();
      emitMissileTrail(
        emitter,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -60),
        new THREE.Color(0xff8833),
        1
      );
      for (const puff of smokeOf(particles)) {
        expect(puff.alpha).toBeCloseTo(0.42, 6);
      }
    });
  });

  describe('proximity fuse', () => {
    function hitsAt(distance: number, configure?: (target: THREE.Object3D) => void): boolean {
      const system = new MissileSystem(scene, particleSystem);
      const target = new THREE.Object3D();
      target.position.set(100, 250, -400);
      configure?.(target);
      scene.add(target);
      const offset = new THREE.Vector3(2, -1, 2).normalize().multiplyScalar(distance);
      system.fire(target.position.clone().add(offset), new THREE.Vector3(0, 0, -1), target);
      const onHit = vi.fn();

      system.checkCollisions([target], onHit);

      if (onHit.mock.calls.length > 0) {
        expect(onHit).toHaveBeenCalledTimes(1);
        expect(onHit.mock.calls[0][0]).toBe(target);
      }
      return onHit.mock.calls.length > 0;
    }

    it.each([0.5, 2.5, 4, PROXIMITY_RADIUS - 0.2])(
      'detonates %s m from a target with no hit radius of its own',
      (distance) => {
        expect(hitsAt(distance)).toBe(true);
      }
    );

    it.each([PROXIMITY_RADIUS + 0.2, 8, 30])(
      'does not detonate %s m from a target with no hit radius of its own',
      (distance) => {
        expect(hitsAt(distance)).toBe(false);
      }
    );

    it('uses a large target’s own hit radius instead of the 6 m', () => {
      const declare = (target: THREE.Object3D): void => {
        target.userData[HIT_RADIUS_USERDATA_KEY] = 20;
      };

      expect(hitsAt(18, declare)).toBe(true);
      expect(hitsAt(22, declare)).toBe(false);
    });

    it('spends the missile on the hit and reports the impact near the target', () => {
      const system = new MissileSystem(scene, particleSystem);
      const target = new THREE.Object3D();
      target.position.set(0, 0, -50);
      scene.add(target);
      const missile = fireMissile(
        system,
        new THREE.Vector3(0, 0, -46),
        new THREE.Vector3(0, 0, -1),
        target
      );
      const onHit = vi.fn();

      system.checkCollisions([target], onHit);
      system.checkCollisions([target], onHit);

      expect(onHit).toHaveBeenCalledTimes(1);
      const impact = onHit.mock.calls[0][1] as THREE.Vector3;
      expect(impact.distanceTo(target.position)).toBeLessThanOrEqual(PROXIMITY_RADIUS);
      expect(system.getActiveCount()).toBe(0);
      system.update(DT);
      expect(scene.children).not.toContain(missile);
    });

    it('detonates on a target other than the one it was fired at', () => {
      const system = new MissileSystem(scene, particleSystem);
      const lockedTarget = farTarget(new THREE.Vector3(0, 0, -900));
      const bystander = farTarget(new THREE.Vector3(3, 0, 0));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), lockedTarget);
      const onHit = vi.fn();

      system.checkCollisions([lockedTarget, bystander], onHit);

      expect(onHit).toHaveBeenCalledTimes(1);
      expect(onHit.mock.calls[0][0]).toBe(bystander);
    });

    it('skips a target whose position is not finite', () => {
      const system = new MissileSystem(scene, particleSystem);
      const broken = new THREE.Object3D();
      broken.position.set(Number.NaN, 0, 0);
      const valid = farTarget(new THREE.Vector3(0, 4, 0));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      const onHit = vi.fn();

      system.checkCollisions([broken, valid], onHit);

      expect(onHit).toHaveBeenCalledTimes(1);
      expect(onHit.mock.calls[0][0]).toBe(valid);
    });
  });
});
