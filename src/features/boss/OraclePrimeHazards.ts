import * as THREE from 'three';
import type { HeavyWeaponImpactProfile, ParticleSystem } from '@/features/effects/ParticleSystem';
import {
  createGlowMaterial,
  createGlowSprite,
  isFiniteVector,
  type HazardFxMethod,
  type HazardProbeResult,
} from './MagmaColossusHazards';
import {
  ORACLE_BAND_UNUSED_GAP,
  createOracleBandMaterial,
  createOracleBeamGeometry,
  createOracleBeamMaterial,
  setOracleBeamMode,
  type OracleBandMaterial,
  type OracleBeamMaterial,
  type OracleBeamMode,
} from './OraclePrimeShaders';

/**
 * 神谕主宰的特殊武器（全部带清晰预警、全部由 checkHazard 判定、对象池预先建好）：
 * - OracleBeam：基础光束（实体 / 预警虚线 / 电弧三种模式）+ 胶囊判定。
 * - OracleLance：追踪 → 锁定（变白、停止跟随）→ 发射 的狙击光矛（护盾塔光矛 / 核心审判之矛）。
 * - OraclePinwheel：随赤道光环旋转的风车光阵（先画出琥珀色预警虚线并缓慢转动指示方向）。
 * - OracleArcStrike：电弧打击（锁定点出现噼啪电球，随后整束闪电落下）。
 * - OracleShockwavePool：过载冲击环（门环：带可穿越缺口；双环：上下两道，与核心同高处安全）。
 * - OracleOrbitalStrikePool：天罚光柱（地面圈 + 竖直虚线 + 玩家所在高度的光环预警）。
 * - OracleDischarge：过载核心向地面放出的装饰性电弧（无伤害）。
 *
 * 约定：所有材质加色透明、depthTest 开、depthWrite 关、renderOrder 0；
 * dispose() 从父节点移除并释放自己创建的几何体与材质（共享贴图不释放）。
 */

/** 本 Boss 用到的 ParticleSystem 方法（在通用集合之外补充电磁爆 / 传送 / 拾取爆闪） */
export type OracleFxMethod =
  | HazardFxMethod
  | 'createEmpBurst'
  | 'createTeleportIn'
  | 'createTeleportOut'
  | 'createPickupBurst'
  | 'createMuzzleFlash'
  | 'createDamageSmoke';

/** ParticleSystem 的空安全包装：粒子系统或某个方法缺失时静默跳过（测试替身 / 无 DOM 逻辑模拟） */
export class OracleFx {
  private readonly particles: ParticleSystem | null;

  constructor(particles: ParticleSystem | null | undefined) {
    this.particles = particles ?? null;
  }

  public emit<K extends OracleFxMethod>(method: K, ...args: Parameters<ParticleSystem[K]>): void {
    const target = this.particles;
    if (!target) return;
    const fn: unknown = (target as unknown as Record<string, unknown>)[method];
    if (typeof fn === 'function') {
      (fn as (...params: Parameters<ParticleSystem[K]>) => void).apply(target, args);
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);

function setTransparentDefaults(object: THREE.Object3D): void {
  object.renderOrder = 0;
  object.frustumCulled = false;
}

function writeProbe(
  out: HazardProbeResult,
  damage: number,
  profile: HeavyWeaponImpactProfile,
  position: THREE.Vector3
): void {
  if (damage > out.damage) {
    out.damage = damage;
    out.profile = profile;
    out.position.copy(position);
  }
}

// ---------------------------------------------------------------------------------------------
// 基础光束
// ---------------------------------------------------------------------------------------------

export interface OracleBeamOptions {
  name: string;
  color: number;
  coreColor?: number;
  /** 两端光晕（发射口 / 落点） */
  glows?: boolean;
  glowColor?: number;
  /** 电弧需要更多分段以便折线抖动 */
  heightSegments?: number;
}

export class OracleBeam {
  public readonly root: THREE.Group;
  public readonly mesh: THREE.Mesh;
  public readonly material: OracleBeamMaterial;
  public readonly origin = new THREE.Vector3();
  public readonly direction = new THREE.Vector3(0, 0, 1);
  public readonly end = new THREE.Vector3();
  public length = 1;
  public radius = 1;
  private readonly geometry: THREE.CylinderGeometry;
  private readonly startGlow: THREE.Sprite | null;
  private readonly endGlow: THREE.Sprite | null;
  private readonly temp = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private glowLevel = 0;

  constructor(parent: THREE.Object3D, options: OracleBeamOptions) {
    this.root = new THREE.Group();
    this.root.name = options.name;
    this.root.visible = false;
    parent.add(this.root);
    this.geometry = createOracleBeamGeometry(options.heightSegments ?? 1);
    this.material = createOracleBeamMaterial(options.color, options.coreColor ?? 0xffffff);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = `${options.name}_beam`;
    setTransparentDefaults(this.mesh);
    this.root.add(this.mesh);
    if (options.glows) {
      const glowColor = options.glowColor ?? options.color;
      this.startGlow = createGlowSprite(glowColor, 1, 0);
      this.endGlow = createGlowSprite(glowColor, 1, 0, 'fire');
      this.startGlow.name = `${options.name}_origin_glow`;
      this.endGlow.name = `${options.name}_end_glow`;
      this.root.add(this.startGlow, this.endGlow);
    } else {
      this.startGlow = null;
      this.endGlow = null;
    }
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  public isVisible(): boolean {
    return this.root.visible;
  }

  public setMode(mode: OracleBeamMode): void {
    setOracleBeamMode(this.material, mode);
    this.material.uniforms.uJitter.value = 0;
  }

  /** 电弧模式的横向抖动幅度（米） */
  public setArcJitter(meters: number): void {
    const local = this.radius > 1e-4 ? meters / this.radius : 0;
    this.material.uniforms.uJitter.value = Math.max(0, local);
  }

  public setColor(color: number | THREE.Color, coreColor?: number | THREE.Color): void {
    if (color instanceof THREE.Color) this.material.uniforms.uColor.value.copy(color);
    else this.material.uniforms.uColor.value.set(color);
    if (coreColor !== undefined) {
      if (coreColor instanceof THREE.Color) this.material.uniforms.uCoreColor.value.copy(coreColor);
      else this.material.uniforms.uCoreColor.value.set(coreColor);
    }
  }

  public setIntensity(intensity: number): void {
    this.material.uniforms.uIntensity.value = Math.max(0, intensity);
  }

  public setFlow(speed: number): void {
    this.material.uniforms.uFlow.value = speed;
  }

  /** 端点光晕：size 为直径（米），level 为不透明度 */
  public setGlows(startSize: number, endSize: number, level: number): void {
    this.glowLevel = THREE.MathUtils.clamp(level, 0, 1);
    if (this.startGlow) {
      this.startGlow.scale.set(startSize, startSize, 1);
      this.startGlow.material.opacity = this.glowLevel;
      this.startGlow.visible = this.glowLevel > 0.01;
    }
    if (this.endGlow) {
      this.endGlow.scale.set(endSize, endSize, 1);
      this.endGlow.material.opacity = this.glowLevel * 0.85;
      this.endGlow.visible = this.glowLevel > 0.01;
    }
  }

  /** 放置光束（世界坐标；父节点应为世界对齐、无变换的危险物根节点） */
  public place(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    radius: number
  ): boolean {
    if (!isFiniteVector(origin) || !isFiniteVector(direction)) return false;
    const lengthSq = direction.lengthSq();
    if (lengthSq < 1e-10) return false;
    this.origin.copy(origin);
    this.direction.copy(direction).multiplyScalar(1 / Math.sqrt(lengthSq));
    this.length = Math.max(0.01, length);
    this.radius = Math.max(0.01, radius);
    this.end.copy(this.origin).addScaledVector(this.direction, this.length);
    this.mesh.position.copy(this.origin);
    this.mesh.quaternion.setFromUnitVectors(UP, this.direction);
    this.mesh.scale.set(this.radius, this.length, this.radius);
    this.material.uniforms.uLength.value = this.length;
    if (this.startGlow) this.startGlow.position.copy(this.origin);
    if (this.endGlow) this.endGlow.position.copy(this.end);
    return true;
  }

  public tick(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  /** 胶囊判定（原点 → 终点，半径 radius + targetRadius） */
  public probeCapsule(
    target: THREE.Vector3,
    targetRadius: number,
    out: HazardProbeResult,
    damage: number,
    profile: HeavyWeaponImpactProfile,
    radiusOverride?: number
  ): boolean {
    const along = THREE.MathUtils.clamp(
      this.temp.subVectors(target, this.origin).dot(this.direction),
      0,
      this.length
    );
    this.closest.copy(this.origin).addScaledVector(this.direction, along);
    const reach = (radiusOverride ?? this.radius) + targetRadius;
    if (this.closest.distanceToSquared(target) > reach * reach) return false;
    writeProbe(out, damage, profile, this.closest);
    return true;
  }

  public dispose(): void {
    this.root.parent?.remove(this.root);
    this.geometry.dispose();
    this.material.dispose();
    this.startGlow?.material.dispose();
    this.endGlow?.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// 追踪锁定光矛
// ---------------------------------------------------------------------------------------------

export interface OracleLanceSpec {
  /** 追踪（预警虚线跟随目标）时长 */
  trackTime: number;
  /** 锁定（变白、停止跟随）时长 */
  lockTime: number;
  fireTime: number;
  radius: number;
  length: number;
  damage: number;
  /** 追踪响应（越大越贴近目标；1/秒） */
  trackRate: number;
}

export type OracleLanceState = 'idle' | 'track' | 'lock' | 'fire';
export type OracleLanceEvent = 'lock' | 'fire' | 'end' | null;

const LANCE_TELEGRAPH_COLOR = new THREE.Color(0xffa62e);
const LANCE_LOCK_COLOR = new THREE.Color(0xfff4d6);

export class OracleLance {
  private readonly beam: OracleBeam;
  private readonly fireColor: THREE.Color;
  private readonly fireCore: THREE.Color;
  private state: OracleLanceState = 'idle';
  private timer = 0;
  private time = 0;
  private spec: OracleLanceSpec = {
    trackTime: 1,
    lockTime: 0.4,
    fireTime: 0.5,
    radius: 3,
    length: 600,
    damage: 0,
    trackRate: 2,
  };
  private readonly origin = new THREE.Vector3();
  private readonly aim = new THREE.Vector3(0, 0, 1);
  private readonly desired = new THREE.Vector3();
  private readonly temp = new THREE.Vector3();

  constructor(
    parent: THREE.Object3D,
    name: string,
    fireColor: number,
    fireCore: number = 0xffffff
  ) {
    this.fireColor = new THREE.Color(fireColor);
    this.fireCore = new THREE.Color(fireCore);
    this.beam = new OracleBeam(parent, {
      name,
      color: fireColor,
      coreColor: fireCore,
      glows: true,
    });
  }

  public start(origin: THREE.Vector3, aimPoint: THREE.Vector3, spec: OracleLanceSpec): boolean {
    if (!isFiniteVector(origin) || !isFiniteVector(aimPoint)) return false;
    this.temp.subVectors(aimPoint, origin);
    if (this.temp.lengthSq() < 1) return false;
    this.spec = { ...spec };
    this.origin.copy(origin);
    this.aim.copy(this.temp).normalize();
    this.state = 'track';
    this.timer = 0;
    this.beam.setMode('telegraph');
    this.beam.setColor(LANCE_TELEGRAPH_COLOR, LANCE_TELEGRAPH_COLOR);
    this.beam.setFlow(1.4);
    this.beam.setVisible(true);
    this.place(true);
    return true;
  }

  public setOrigin(origin: THREE.Vector3): void {
    if (isFiniteVector(origin)) this.origin.copy(origin);
  }

  /** 追踪阶段的瞄准点（锁定后忽略） */
  public setTarget(point: THREE.Vector3, deltaTime: number): void {
    if (this.state !== 'track' || !isFiniteVector(point)) return;
    this.desired.subVectors(point, this.origin);
    if (this.desired.lengthSq() < 1) return;
    this.desired.normalize();
    const k = 1 - Math.exp(-this.spec.trackRate * Math.max(0, deltaTime));
    this.aim.lerp(this.desired, k).normalize();
  }

  public update(deltaTime: number): OracleLanceEvent {
    if (this.state === 'idle') return null;
    this.time += deltaTime;
    this.timer += deltaTime;
    this.beam.tick(this.time);
    let event: OracleLanceEvent = null;
    const spec = this.spec;
    if (this.state === 'track') {
      const p = Math.min(1, this.timer / Math.max(0.05, spec.trackTime));
      this.beam.setIntensity(0.35 + 0.55 * p);
      this.beam.setGlows(spec.radius * (2 + 3 * p), spec.radius * 2.5, 0.25 + 0.5 * p);
      if (this.timer >= spec.trackTime) {
        this.state = 'lock';
        this.timer = 0;
        this.beam.setColor(LANCE_LOCK_COLOR, LANCE_LOCK_COLOR);
        this.beam.setFlow(5);
        event = 'lock';
      }
    } else if (this.state === 'lock') {
      const blink = 0.55 + 0.45 * Math.sin(this.timer * 46);
      this.beam.setIntensity(0.75 + 0.5 * blink);
      this.beam.setGlows(spec.radius * 6, spec.radius * 3, 0.85);
      if (this.timer >= spec.lockTime) {
        this.state = 'fire';
        this.timer = 0;
        this.beam.setMode('beam');
        this.beam.setColor(this.fireColor, this.fireCore);
        event = 'fire';
      }
    } else if (this.state === 'fire') {
      const f = Math.min(1, this.timer / Math.max(0.05, spec.fireTime));
      const fade = f > 0.75 ? 1 - (f - 0.75) / 0.25 : 1;
      const surge = f < 0.12 ? 1.6 - 0.6 * (f / 0.12) : 1;
      this.beam.setIntensity(1.15 * fade * surge);
      this.beam.setGlows(spec.radius * 7 * surge, spec.radius * 5, fade);
      if (f >= 1) {
        this.clear();
        return 'end';
      }
    }
    this.place(this.state === 'track' || this.state === 'lock');
    return event;
  }

  private place(telegraph: boolean): void {
    const radius = telegraph ? Math.max(0.6, this.spec.radius * 0.55) : this.spec.radius;
    this.beam.place(this.origin, this.aim, this.spec.length, radius);
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    if (this.state !== 'fire' || this.spec.damage <= 0) return;
    if (this.timer > this.spec.fireTime * 0.85) return;
    this.beam.probeCapsule(target, targetRadius, out, this.spec.damage, 'laser');
  }

  public getState(): OracleLanceState {
    return this.state;
  }

  public isBusy(): boolean {
    return this.state !== 'idle';
  }

  /** 0..1：追踪 + 锁定的总进度（发射中为 1） */
  public getChargeProgress(): number {
    if (this.state === 'track') {
      return (0.75 * this.timer) / Math.max(0.05, this.spec.trackTime);
    }
    if (this.state === 'lock')
      return 0.75 + (0.25 * this.timer) / Math.max(0.05, this.spec.lockTime);
    return this.state === 'fire' ? 1 : 0;
  }

  public getOrigin(): THREE.Vector3 {
    return this.origin;
  }

  public getEnd(): THREE.Vector3 {
    return this.beam.end;
  }

  public clear(): void {
    this.state = 'idle';
    this.timer = 0;
    this.beam.setVisible(false);
    this.beam.setIntensity(0);
    this.beam.setGlows(1, 1, 0);
  }

  public dispose(): void {
    this.clear();
    this.beam.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// 风车光阵
// ---------------------------------------------------------------------------------------------

export interface OraclePinwheelSpec {
  chargeTime: number;
  fireTime: number;
  radius: number;
  length: number;
  damage: number;
}

export type OraclePinwheelState = 'idle' | 'charge' | 'fire';

interface PinwheelSpoke {
  beam: OracleBeam;
  active: boolean;
  hasPrev: boolean;
  prevDirection: THREE.Vector3;
}

const PINWHEEL_TELEGRAPH = new THREE.Color(0xffa62e);

export class OraclePinwheel {
  private readonly spokes: PinwheelSpoke[] = [];
  private state: OraclePinwheelState = 'idle';
  private timer = 0;
  private time = 0;
  private spec: OraclePinwheelSpec = {
    chargeTime: 1,
    fireTime: 1,
    radius: 4,
    length: 600,
    damage: 0,
  };
  private readonly fireColor: THREE.Color;
  private readonly sample = new THREE.Vector3();
  private readonly probeOrigin = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly temp = new THREE.Vector3();

  constructor(parent: THREE.Object3D, count: number, fireColor: number) {
    this.fireColor = new THREE.Color(fireColor);
    for (let i = 0; i < count; i++) {
      this.spokes.push({
        beam: new OracleBeam(parent, {
          name: `oracle_pinwheel_${i}`,
          color: fireColor,
          coreColor: 0xffffff,
          glows: true,
        }),
        active: false,
        hasPrev: false,
        prevDirection: new THREE.Vector3(),
      });
    }
  }

  public start(activeMask: readonly boolean[], spec: OraclePinwheelSpec): boolean {
    let any = false;
    this.spec = { ...spec };
    this.spokes.forEach((spoke, i) => {
      spoke.active = activeMask[i] === true;
      spoke.hasPrev = false;
      spoke.beam.setVisible(false);
      if (!spoke.active) return;
      any = true;
      spoke.beam.setMode('telegraph');
      spoke.beam.setColor(PINWHEEL_TELEGRAPH, PINWHEEL_TELEGRAPH);
      spoke.beam.setFlow(1.2);
      spoke.beam.setIntensity(0);
    });
    if (!any) return false;
    this.state = 'charge';
    this.timer = 0;
    return true;
  }

  /** 每帧由宿主给出各辐条的起点与方向（随光环旋转） */
  public setSpoke(index: number, origin: THREE.Vector3, direction: THREE.Vector3): void {
    const spoke = this.spokes[index];
    if (!spoke || !spoke.active || this.state === 'idle') return;
    if (spoke.hasPrev) spoke.prevDirection.copy(spoke.beam.direction);
    const telegraph = this.state === 'charge';
    const radius = telegraph ? Math.max(0.8, this.spec.radius * 0.6) : this.spec.radius;
    if (!spoke.beam.place(origin, direction, this.spec.length, radius)) return;
    if (!spoke.hasPrev) {
      spoke.prevDirection.copy(spoke.beam.direction);
      spoke.hasPrev = true;
    }
    spoke.beam.setVisible(true);
  }

  /** 发射器被毁：立即熄灭该辐条 */
  public disableSpoke(index: number): void {
    const spoke = this.spokes[index];
    if (!spoke) return;
    spoke.active = false;
    spoke.beam.setVisible(false);
  }

  /** 推进；返回本帧是否刚开始发射 */
  public update(deltaTime: number): boolean {
    if (this.state === 'idle') return false;
    this.time += deltaTime;
    this.timer += deltaTime;
    let fired = false;
    if (this.state === 'charge') {
      const c = Math.min(1, this.timer / Math.max(0.05, this.spec.chargeTime));
      const pulse = 0.5 + 0.5 * Math.sin(this.timer * (8 + 18 * c));
      for (const spoke of this.spokes) {
        if (!spoke.active) continue;
        spoke.beam.tick(this.time);
        spoke.beam.setIntensity(0.25 + 0.55 * c + 0.2 * pulse * c);
        spoke.beam.setGlows(this.spec.radius * (1.5 + 3 * c), 1, 0.3 + 0.6 * c);
      }
      if (this.timer >= this.spec.chargeTime) {
        this.state = 'fire';
        this.timer = 0;
        fired = true;
        for (const spoke of this.spokes) {
          if (!spoke.active) continue;
          spoke.beam.setMode('beam');
          spoke.beam.setColor(this.fireColor, 0xffffff);
        }
      }
      return fired;
    }
    const f = Math.min(1, this.timer / Math.max(0.05, this.spec.fireTime));
    const fadeIn = Math.min(1, this.timer / 0.15);
    const fadeOut = f > 0.9 ? 1 - (f - 0.9) / 0.1 : 1;
    const level = fadeIn * fadeOut;
    for (const spoke of this.spokes) {
      if (!spoke.active) continue;
      spoke.beam.tick(this.time);
      spoke.beam.setIntensity(0.95 * level);
      spoke.beam.setGlows(this.spec.radius * 5.5, this.spec.radius * 4, level);
    }
    if (f >= 1) this.clear();
    return false;
  }

  /** 扫掠判定：在上一帧与本帧方向之间插值采样，低帧率也不会漏判 */
  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    if (this.state !== 'fire' || this.spec.damage <= 0 || this.timer < 0.08) return;
    if (this.timer > this.spec.fireTime * 0.94) return;
    const reach = this.spec.radius + targetRadius;
    for (const spoke of this.spokes) {
      if (!spoke.active || !spoke.beam.isVisible()) continue;
      const beam = spoke.beam;
      this.probeOrigin.copy(beam.origin);
      const angle = Math.acos(
        THREE.MathUtils.clamp(spoke.prevDirection.dot(beam.direction), -1, 1)
      );
      const steps = THREE.MathUtils.clamp(
        Math.ceil((angle * beam.length) / Math.max(1, reach)),
        1,
        10
      );
      for (let j = 0; j <= steps; j++) {
        this.sample.copy(spoke.prevDirection).lerp(beam.direction, j / steps);
        if (this.sample.lengthSq() < 1e-8) continue;
        this.sample.normalize();
        const along = THREE.MathUtils.clamp(
          this.temp.subVectors(target, this.probeOrigin).dot(this.sample),
          0,
          beam.length
        );
        this.closest.copy(this.probeOrigin).addScaledVector(this.sample, along);
        if (this.closest.distanceToSquared(target) <= reach * reach) {
          writeProbe(out, this.spec.damage, 'laser', this.closest);
          break;
        }
      }
    }
  }

  public getState(): OraclePinwheelState {
    return this.state;
  }

  public getChargeProgress(): number {
    return this.state === 'charge'
      ? Math.min(1, this.timer / Math.max(0.05, this.spec.chargeTime))
      : 0;
  }

  public clear(): void {
    this.state = 'idle';
    this.timer = 0;
    for (const spoke of this.spokes) {
      spoke.active = false;
      spoke.hasPrev = false;
      spoke.beam.setVisible(false);
      spoke.beam.setIntensity(0);
      spoke.beam.setGlows(1, 1, 0);
    }
  }

  public dispose(): void {
    this.clear();
    for (const spoke of this.spokes) spoke.beam.dispose();
    this.spokes.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// 电弧打击
// ---------------------------------------------------------------------------------------------

export interface OracleArcSpec {
  telegraphTime: number;
  dischargeTime: number;
  /** 落点电球半径（米） */
  radius: number;
  /** 闪电束判定半径（米） */
  boltRadius: number;
  damage: number;
}

type ArcState = 'idle' | 'telegraph' | 'discharge';

export class OracleArcStrike {
  private readonly root: THREE.Group;
  /** 锁定点的测地线笼（线框，旋转），明确标出电球半径 */
  private readonly sphere: THREE.Mesh;
  private readonly sphereMaterial: THREE.MeshBasicMaterial;
  private readonly sphereGeometry: THREE.IcosahedronGeometry;
  /** 半透明内壳：让笼体在远处也有体积 */
  private readonly shell: THREE.Mesh;
  private readonly shellMaterial: THREE.MeshBasicMaterial;
  /** 球形闪电核心 */
  private readonly core: THREE.Sprite;
  private readonly lockRing: THREE.Sprite;
  private readonly guide: OracleBeam;
  private readonly bolt: OracleBeam;
  private state: ArcState = 'idle';
  private timer = 0;
  private time = 0;
  private spec: OracleArcSpec = {
    telegraphTime: 1,
    dischargeTime: 0.3,
    radius: 15,
    boltRadius: 3,
    damage: 0,
  };
  private readonly origin = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();

  constructor(parent: THREE.Object3D, name: string, color: number) {
    this.root = new THREE.Group();
    this.root.name = name;
    this.root.visible = false;
    parent.add(this.root);
    this.sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.sphereMaterial = createGlowMaterial(0xcfeeff, 0, { side: THREE.DoubleSide });
    this.sphereMaterial.wireframe = true;
    this.sphere = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);
    this.sphere.name = `${name}_cage`;
    setTransparentDefaults(this.sphere);
    this.shellMaterial = createGlowMaterial(color, 0, { side: THREE.FrontSide });
    this.shell = new THREE.Mesh(this.sphereGeometry, this.shellMaterial);
    this.shell.name = `${name}_shell`;
    setTransparentDefaults(this.shell);
    this.core = createGlowSprite(0xe6f6ff, 1, 0);
    this.core.name = `${name}_core`;
    this.lockRing = createGlowSprite(color, 1, 0, 'ring');
    this.lockRing.name = `${name}_lock_ring`;
    this.root.add(this.shell, this.sphere, this.core, this.lockRing);
    this.guide = new OracleBeam(parent, { name: `${name}_guide`, color, heightSegments: 24 });
    this.bolt = new OracleBeam(parent, {
      name: `${name}_bolt`,
      color,
      coreColor: 0xffffff,
      glows: true,
      glowColor: 0xd8ecff,
      heightSegments: 24,
    });
  }

  public start(origin: THREE.Vector3, point: THREE.Vector3, spec: OracleArcSpec): boolean {
    if (!isFiniteVector(origin) || !isFiniteVector(point)) return false;
    this.spec = { ...spec };
    this.origin.copy(origin);
    this.point.copy(point);
    this.state = 'telegraph';
    this.timer = 0;
    this.root.visible = true;
    this.root.position.copy(point);
    this.guide.setMode('arc');
    this.guide.setVisible(true);
    this.bolt.setVisible(false);
    this.placeBeams();
    return true;
  }

  public setOrigin(origin: THREE.Vector3): void {
    if (isFiniteVector(origin)) this.origin.copy(origin);
  }

  /** 推进；返回本帧是否刚放电 */
  public update(deltaTime: number): boolean {
    if (this.state === 'idle') return false;
    this.time += deltaTime;
    this.timer += deltaTime;
    this.guide.tick(this.time);
    this.bolt.tick(this.time);
    const spec = this.spec;
    if (this.state === 'telegraph') {
      const p = Math.min(1, this.timer / Math.max(0.05, spec.telegraphTime));
      const flicker = 0.6 + 0.4 * Math.sin(this.timer * (30 + 50 * p)) * Math.sin(this.timer * 17);
      this.sphere.scale.setScalar(spec.radius);
      this.sphere.rotation.set(this.timer * 0.9, this.timer * 1.3, 0);
      this.sphereMaterial.opacity = (0.35 + 0.5 * p) * flicker;
      this.shell.scale.setScalar(spec.radius * 0.98);
      this.shellMaterial.opacity = (0.05 + 0.12 * p) * flicker;
      const coreSize = spec.radius * (0.5 + 0.9 * p) * (0.75 + 0.25 * flicker);
      this.core.scale.set(coreSize, coreSize, 1);
      this.core.material.opacity = 0.5 + 0.5 * p;
      const ring = spec.radius * 2 * (1.45 - 0.45 * p);
      this.lockRing.scale.set(ring, ring, 1);
      this.lockRing.material.opacity = 0.15 + 0.3 * p;
      this.lockRing.material.rotation = this.timer * 2.4;
      this.guide.setIntensity((0.12 + 0.3 * p) * flicker);
      this.placeBeams();
      if (this.timer >= spec.telegraphTime) {
        this.state = 'discharge';
        this.timer = 0;
        this.guide.setVisible(false);
        this.bolt.setMode('arc');
        this.bolt.setVisible(true);
        this.placeBeams();
        return true;
      }
      return false;
    }
    const d = Math.min(1, this.timer / Math.max(0.05, spec.dischargeTime));
    const fade = 1 - d;
    this.sphere.scale.setScalar(spec.radius * (1 + 0.35 * d));
    this.sphereMaterial.opacity = 0.9 * fade;
    this.shell.scale.setScalar(spec.radius * (1 + 0.3 * d));
    this.shellMaterial.opacity = 0.4 * fade;
    const coreSize = spec.radius * 2.4 * (1 + d);
    this.core.scale.set(coreSize, coreSize, 1);
    this.core.material.opacity = fade;
    this.lockRing.scale.set(spec.radius * 2.2 * (1 + d), spec.radius * 2.2 * (1 + d), 1);
    this.lockRing.material.opacity = 0.5 * fade;
    this.bolt.setIntensity(1.3 * (0.6 + 0.4 * fade));
    this.bolt.setGlows(spec.boltRadius * 6, spec.radius * 2.2, fade);
    this.placeBeams();
    if (d >= 1) this.clear();
    return false;
  }

  private placeBeams(): void {
    this.direction.subVectors(this.point, this.origin);
    const length = this.direction.length();
    if (length < 1) return;
    const jitter = Math.min(length * 0.05, 9);
    if (this.state === 'telegraph') {
      this.guide.place(this.origin, this.direction, length, 0.7);
      this.guide.setArcJitter(jitter * 0.6);
    } else {
      this.bolt.place(
        this.origin,
        this.direction,
        length,
        Math.max(0.8, this.spec.boltRadius * 0.5)
      );
      this.bolt.setArcJitter(jitter);
    }
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    if (this.state !== 'discharge' || this.spec.damage <= 0) return;
    const reach = this.spec.radius + targetRadius;
    if (target.distanceToSquared(this.point) <= reach * reach) {
      writeProbe(out, this.spec.damage, 'laser', this.point);
      return;
    }
    this.bolt.probeCapsule(
      target,
      targetRadius,
      out,
      this.spec.damage,
      'laser',
      this.spec.boltRadius
    );
  }

  public isBusy(): boolean {
    return this.state !== 'idle';
  }

  public getPoint(): THREE.Vector3 {
    return this.point;
  }

  public clear(): void {
    this.state = 'idle';
    this.timer = 0;
    this.root.visible = false;
    this.guide.setVisible(false);
    this.bolt.setVisible(false);
    this.bolt.setGlows(1, 1, 0);
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    this.sphereGeometry.dispose();
    this.sphereMaterial.dispose();
    this.shellMaterial.dispose();
    this.core.material.dispose();
    this.lockRing.material.dispose();
    this.guide.dispose();
    this.bolt.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// 过载冲击环
// ---------------------------------------------------------------------------------------------

/** crown：带缺口的高墙（穿越缺口或远离）；twin：上下两道（与核心同高处安全）；visual：纯视觉 */
export type OracleRingKind = 'crown' | 'twin' | 'visual';

export interface OracleRingSpec {
  kind: OracleRingKind;
  telegraphTime: number;
  startRadius: number;
  /** 收缩环（死亡内爆）终点半径；未设置则向外扩散 */
  endRadius?: number;
  duration: number;
  /** 墙体总高度（米，以中心为对称） */
  height: number;
  /** 双环中间安全槽的半高（米）；0 表示无安全槽 */
  slotHalfHeight: number;
  /** 缺口中心角（弧度，最多 4 个） */
  gaps: readonly number[];
  /** 缺口半角（弧度） */
  gapHalfAngle: number;
  damage: number;
  /** 扩散速度模型：v(t) = v0·e^(-t/τ) + vMin */
  v0: number;
  tau: number;
  vMin: number;
  /** 环墙判定厚度（米） */
  bandWidth: number;
  /** 视觉强度系数 */
  opacity?: number;
}

type RingState = 'telegraph' | 'expand';

interface RingSlot {
  active: boolean;
  state: RingState;
  band: THREE.Mesh;
  material: OracleBandMaterial;
  guides: OracleBeam[];
  levelRings: THREE.Mesh[];
  levelMaterial: THREE.MeshBasicMaterial;
  center: THREE.Vector3;
  age: number;
  radius: number;
  prevRadius: number;
  spec: OracleRingSpec;
  gapCount: number;
  emitted: boolean;
}

/** 安全航道 / 安全高度指示：饱和绿（与琥珀危险预警、紫色冲击环区分） */
const RING_SAFE_COLOR = 0x22ff66;

export class OracleShockwavePool {
  /** 环从预警转为扩散的瞬间（粒子 / 音效 / 镜头震动由宿主处理） */
  public onEmit?: (center: THREE.Vector3, kind: OracleRingKind) => void;

  private readonly root: THREE.Group;
  private readonly slots: RingSlot[] = [];
  private readonly bandGeometry: THREE.CylinderGeometry;
  private readonly levelGeometry: THREE.TorusGeometry;
  private readonly sizeFactor: number;
  private time = 0;
  private readonly temp = new THREE.Vector3();

  constructor(
    parent: THREE.Object3D,
    capacity: number,
    sizeFactor: number,
    palette: { color: number; hot: number; gate: number }
  ) {
    this.sizeFactor = sizeFactor;
    this.root = new THREE.Group();
    this.root.name = 'oracle_shockwaves';
    parent.add(this.root);
    this.bandGeometry = new THREE.CylinderGeometry(1, 1, 1, 180, 1, true);
    this.levelGeometry = new THREE.TorusGeometry(1, 0.012, 5, 160);
    this.levelGeometry.rotateX(Math.PI / 2);
    for (let i = 0; i < capacity; i++) {
      const material = createOracleBandMaterial(palette.color, palette.hot, palette.gate);
      const band = new THREE.Mesh(this.bandGeometry, material);
      band.name = `oracle_shockwave_${i}`;
      band.visible = false;
      setTransparentDefaults(band);
      this.root.add(band);
      const guides: OracleBeam[] = [];
      for (let g = 0; g < 3; g++) {
        const guide = new OracleBeam(this.root, {
          name: `oracle_shockwave_${i}_lane_${g}`,
          color: RING_SAFE_COLOR,
          coreColor: 0x7dffa8,
        });
        guide.setMode('telegraph');
        guide.setFlow(2.2);
        guides.push(guide);
      }
      const levelMaterial = createGlowMaterial(RING_SAFE_COLOR, 0, { side: THREE.DoubleSide });
      const levelRings: THREE.Mesh[] = [];
      for (let r = 0; r < 2; r++) {
        const ring = new THREE.Mesh(this.levelGeometry, levelMaterial);
        ring.name = `oracle_shockwave_${i}_level_${r}`;
        ring.visible = false;
        setTransparentDefaults(ring);
        this.root.add(ring);
        levelRings.push(ring);
      }
      this.slots.push({
        active: false,
        state: 'telegraph',
        band,
        material,
        guides,
        levelRings,
        levelMaterial,
        center: new THREE.Vector3(),
        age: 0,
        radius: 0,
        prevRadius: 0,
        spec: {
          kind: 'visual',
          telegraphTime: 0,
          startRadius: 1,
          duration: 1,
          height: 1,
          slotHalfHeight: 0,
          gaps: [],
          gapHalfAngle: 0,
          damage: 0,
          v0: 0,
          tau: 1,
          vMin: 0,
          bandWidth: 1,
        },
        gapCount: 0,
        emitted: false,
      });
    }
  }

  public spawn(center: THREE.Vector3, spec: OracleRingSpec): boolean {
    if (!isFiniteVector(center)) return false;
    const slot = this.slots.find((entry) => !entry.active);
    if (!slot) return false;
    slot.active = true;
    slot.emitted = false;
    slot.state = spec.telegraphTime > 0 ? 'telegraph' : 'expand';
    slot.center.copy(center);
    slot.age = 0;
    slot.spec = { ...spec, gaps: spec.gaps.slice(0, 4) };
    slot.radius = Math.max(1, spec.startRadius);
    slot.prevRadius = slot.radius;
    slot.gapCount = slot.spec.gaps.length;
    const uniforms = slot.material.uniforms;
    uniforms.uGaps.value.set(
      slot.spec.gaps[0] ?? ORACLE_BAND_UNUSED_GAP,
      slot.spec.gaps[1] ?? ORACLE_BAND_UNUSED_GAP,
      slot.spec.gaps[2] ?? ORACLE_BAND_UNUSED_GAP,
      slot.spec.gaps[3] ?? ORACLE_BAND_UNUSED_GAP
    );
    uniforms.uGapHalf.value = slot.gapCount > 0 ? spec.gapHalfAngle : 0;
    const height = Math.max(1, spec.height);
    uniforms.uSlotHalf.value =
      spec.slotHalfHeight > 0 ? THREE.MathUtils.clamp(spec.slotHalfHeight / height, 0, 0.45) : 0;
    uniforms.uHeight.value = height;
    slot.band.position.copy(center);
    slot.band.visible = true;
    // 预警辅助：门环画出缺口方向的安全航道；双环画出核心高度的安全圈
    slot.guides.forEach((guide, g) => {
      const angle = slot.spec.gaps[g];
      const show = spec.kind === 'crown' && angle !== undefined && spec.telegraphTime > 0;
      guide.setVisible(show);
      if (!show || angle === undefined) return;
      this.temp.set(Math.cos(angle), 0, Math.sin(angle));
      guide.place(center, this.temp, 760 * this.sizeFactor, 1.7 * this.sizeFactor);
      guide.setIntensity(0);
    });
    const levelRadii = [150, 320];
    slot.levelRings.forEach((ring, r) => {
      const show = spec.kind === 'twin' && spec.telegraphTime > 0;
      ring.visible = show;
      const radius = levelRadii[r] * this.sizeFactor;
      ring.position.copy(center);
      ring.scale.set(radius, radius, radius);
    });
    slot.levelMaterial.opacity = 0;
    this.applyVisual(slot);
    return true;
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += deltaTime;
      const spec = slot.spec;
      slot.material.uniforms.uTime.value = this.time;
      if (slot.state === 'telegraph') {
        if (slot.age >= spec.telegraphTime) {
          slot.state = 'expand';
          slot.age = 0;
          slot.emitted = true;
          this.onEmit?.(slot.center, spec.kind);
        }
        this.applyVisual(slot);
        continue;
      }
      if (!slot.emitted) {
        slot.emitted = true;
        this.onEmit?.(slot.center, spec.kind);
      }
      slot.prevRadius = slot.radius;
      slot.radius = this.radiusAt(spec, slot.age);
      this.applyVisual(slot);
      if (slot.age >= spec.duration) this.deactivate(slot);
    }
  }

  private radiusAt(spec: OracleRingSpec, t: number): number {
    if (spec.endRadius !== undefined) {
      const p = THREE.MathUtils.clamp(t / Math.max(0.05, spec.duration), 0, 1);
      const eased = p * p * p;
      return Math.max(0.5, spec.startRadius + (spec.endRadius - spec.startRadius) * eased);
    }
    const tau = Math.max(0.05, spec.tau);
    return spec.startRadius + spec.v0 * tau * (1 - Math.exp(-t / tau)) + spec.vMin * t;
  }

  private applyVisual(slot: RingSlot): void {
    const spec = slot.spec;
    const uniforms = slot.material.uniforms;
    const height = Math.max(1, spec.height);
    const strength = spec.opacity ?? 1;
    if (slot.state === 'telegraph') {
      const p = Math.min(1, slot.age / Math.max(0.05, spec.telegraphTime));
      uniforms.uMode.value = 1;
      uniforms.uOpacity.value = (0.35 + 0.65 * p) * strength;
      const radius = spec.startRadius * (1 + 0.04 * Math.sin(slot.age * 14));
      uniforms.uRadius.value = radius;
      slot.band.scale.set(radius, height, radius);
      for (const guide of slot.guides) {
        if (!guide.isVisible()) continue;
        guide.tick(this.time);
        guide.setIntensity(0.22 + 0.33 * p);
      }
      slot.levelMaterial.opacity = (0.2 + 0.35 * p) * (0.7 + 0.3 * Math.sin(slot.age * 9));
      return;
    }
    const life = Math.min(1, slot.age / Math.max(0.05, spec.duration));
    const fade = life > 0.8 ? 1 - (life - 0.8) / 0.2 : 1;
    const fadeIn = Math.min(1, slot.age / 0.12);
    uniforms.uMode.value = 0;
    uniforms.uOpacity.value = fade * fadeIn * strength;
    uniforms.uRadius.value = slot.radius;
    slot.band.scale.set(slot.radius, height, slot.radius);
    for (const guide of slot.guides) {
      if (!guide.isVisible()) continue;
      guide.tick(this.time);
      guide.setIntensity(0.4 * fade);
    }
    slot.levelMaterial.opacity = 0.45 * fade;
  }

  private deactivate(slot: RingSlot): void {
    slot.active = false;
    slot.band.visible = false;
    for (const guide of slot.guides) guide.setVisible(false);
    for (const ring of slot.levelRings) ring.visible = false;
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (!slot.active || slot.state !== 'expand' || slot.spec.damage <= 0) continue;
      const spec = slot.spec;
      const life = slot.age / Math.max(0.05, spec.duration);
      if (life > 0.9 || slot.age < 0.05) continue;
      const dy = target.y - slot.center.y;
      const half = spec.height * 0.5;
      if (Math.abs(dy) > half + targetRadius) continue;
      // 安全槽：判定比视觉更宽容（按目标半径收窄危险区）
      if (spec.slotHalfHeight > 0 && Math.abs(dy) < spec.slotHalfHeight - targetRadius * 0.5)
        continue;
      const dx = target.x - slot.center.x;
      const dz = target.z - slot.center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const halfBand = spec.bandWidth * 0.5 + targetRadius;
      const inner = Math.min(slot.prevRadius, slot.radius) - halfBand;
      const outer = Math.max(slot.prevRadius, slot.radius) + halfBand;
      if (distance < inner || distance > outer) continue;
      if (slot.gapCount > 0 && distance > 1e-3) {
        const angle = Math.atan2(dz, dx);
        const margin = Math.min(spec.gapHalfAngle * 0.5, (targetRadius * 0.5) / distance);
        let inGap = false;
        for (const gap of spec.gaps) {
          let d = Math.abs(angle - gap) % (Math.PI * 2);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < spec.gapHalfAngle + margin) {
            inGap = true;
            break;
          }
        }
        if (inGap) continue;
      }
      const inv = distance > 1e-3 ? slot.radius / distance : 0;
      this.temp.set(slot.center.x + dx * inv, target.y, slot.center.z + dz * inv);
      writeProbe(out, spec.damage, 'boss-armor', this.temp);
    }
  }

  /** 预警中的环：返回最大预警进度（0..1），无则 -1 */
  public getTelegraphProgress(): number {
    let best = -1;
    for (const slot of this.slots) {
      if (!slot.active || slot.state !== 'telegraph') continue;
      best = Math.max(best, Math.min(1, slot.age / Math.max(0.05, slot.spec.telegraphTime)));
    }
    return best;
  }

  public isCharging(): boolean {
    return this.getTelegraphProgress() >= 0;
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  /** 取消仍在预警中的环（EMP 打断） */
  public cancelTelegraphs(): number {
    let count = 0;
    for (const slot of this.slots) {
      if (slot.active && slot.state === 'telegraph') {
        this.deactivate(slot);
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) this.deactivate(slot);
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.material.dispose();
      slot.levelMaterial.dispose();
      for (const guide of slot.guides) guide.dispose();
    }
    this.bandGeometry.dispose();
    this.levelGeometry.dispose();
    this.slots.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// 天罚光柱
// ---------------------------------------------------------------------------------------------

export interface OracleOrbitalSpec {
  telegraphTime: number;
  strikeTime: number;
  radius: number;
  damage: number;
  groundY: number;
  topY: number;
}

interface OrbitalSlot {
  active: boolean;
  striking: boolean;
  age: number;
  x: number;
  z: number;
  spec: OracleOrbitalSpec;
  column: OracleBeam;
  groundRing: THREE.Mesh;
  groundMaterial: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  haloMaterial: THREE.MeshBasicMaterial;
}

const ORBITAL_WARN = new THREE.Color(0xffa62e);
const ORBITAL_HOT = new THREE.Color(0xfff2d8);

export class OracleOrbitalStrikePool {
  /** 光柱落地瞬间（地面点为复用向量） */
  public onStrike?: (groundPoint: THREE.Vector3, radius: number) => void;

  private readonly root: THREE.Group;
  private readonly slots: OrbitalSlot[] = [];
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly haloGeometry: THREE.TorusGeometry;
  private readonly strikeColor: THREE.Color;
  private trackedAltitude = 0;
  private hasTrackedAltitude = false;
  private time = 0;
  private readonly temp = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly blend = new THREE.Color();

  constructor(parent: THREE.Object3D, capacity: number, strikeColor: number) {
    this.strikeColor = new THREE.Color(strikeColor);
    this.root = new THREE.Group();
    this.root.name = 'oracle_orbital_strikes';
    parent.add(this.root);
    this.ringGeometry = new THREE.RingGeometry(0.86, 1, 56, 1);
    this.ringGeometry.rotateX(-Math.PI / 2);
    this.haloGeometry = new THREE.TorusGeometry(1, 0.03, 5, 64);
    this.haloGeometry.rotateX(Math.PI / 2);
    for (let i = 0; i < capacity; i++) {
      const column = new OracleBeam(this.root, {
        name: `oracle_orbital_${i}`,
        color: strikeColor,
        coreColor: 0xffffff,
        glows: true,
        glowColor: 0xfff0ff,
      });
      const groundMaterial = createGlowMaterial(0xffa62e, 0, {
        side: THREE.DoubleSide,
        fog: false,
      });
      const groundRing = new THREE.Mesh(this.ringGeometry, groundMaterial);
      groundRing.name = `oracle_orbital_${i}_ground`;
      groundRing.visible = false;
      setTransparentDefaults(groundRing);
      const haloMaterial = createGlowMaterial(0xffa62e, 0, { side: THREE.DoubleSide });
      const halo = new THREE.Mesh(this.haloGeometry, haloMaterial);
      halo.name = `oracle_orbital_${i}_halo`;
      halo.visible = false;
      setTransparentDefaults(halo);
      this.root.add(groundRing, halo);
      this.slots.push({
        active: false,
        striking: false,
        age: 0,
        x: 0,
        z: 0,
        spec: { telegraphTime: 1, strikeTime: 0.6, radius: 10, damage: 0, groundY: 0, topY: 100 },
        column,
        groundRing,
        groundMaterial,
        halo,
        haloMaterial,
      });
    }
  }

  /** 预警光环所在高度（玩家高度），让玩家在自己的高度上看到危险半径 */
  public setTrackedAltitude(y: number): void {
    if (!Number.isFinite(y)) return;
    this.trackedAltitude = y;
    this.hasTrackedAltitude = true;
  }

  public spawn(x: number, z: number, spec: OracleOrbitalSpec): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(spec.groundY)) return false;
    const slot = this.slots.find((entry) => !entry.active);
    if (!slot) return false;
    slot.active = true;
    slot.striking = false;
    slot.age = 0;
    slot.x = x;
    slot.z = z;
    slot.spec = { ...spec, topY: Math.max(spec.topY, spec.groundY + 10) };
    slot.column.setMode('telegraph');
    slot.column.setColor(ORBITAL_WARN, ORBITAL_WARN);
    slot.column.setFlow(-1.8);
    slot.column.setVisible(true);
    slot.groundRing.visible = true;
    slot.groundRing.position.set(x, spec.groundY + 0.8, z);
    slot.groundRing.scale.set(spec.radius, 1, spec.radius);
    slot.halo.visible = true;
    slot.halo.scale.set(spec.radius, spec.radius, spec.radius);
    this.placeColumn(slot, Math.max(1.2, spec.radius * 0.1));
    this.applyTelegraph(slot, 0);
    return true;
  }

  private placeColumn(slot: OrbitalSlot, radius: number): void {
    this.temp.set(slot.x, slot.spec.groundY, slot.z);
    slot.column.place(this.temp, this.up, slot.spec.topY - slot.spec.groundY, radius);
  }

  private applyTelegraph(slot: OrbitalSlot, p: number): void {
    const blink = 0.6 + 0.4 * Math.sin(slot.age * (10 + 26 * p));
    slot.column.setIntensity((0.35 + 0.5 * p) * blink);
    this.blend.copy(ORBITAL_WARN).lerp(ORBITAL_HOT, p * p);
    slot.groundMaterial.color.copy(this.blend);
    slot.groundMaterial.opacity = (0.35 + 0.55 * p) * blink;
    slot.haloMaterial.color.copy(this.blend);
    slot.haloMaterial.opacity = (0.4 + 0.55 * p) * blink;
    const y = this.hasTrackedAltitude
      ? THREE.MathUtils.clamp(this.trackedAltitude, slot.spec.groundY + 4, slot.spec.topY)
      : slot.spec.groundY + 40;
    slot.halo.position.set(slot.x, y, slot.z);
    const shrink = 1 + 0.6 * (1 - p);
    slot.halo.scale.set(
      slot.spec.radius * shrink,
      slot.spec.radius * shrink,
      slot.spec.radius * shrink
    );
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += deltaTime;
      slot.column.tick(this.time);
      const spec = slot.spec;
      if (!slot.striking) {
        const p = Math.min(1, slot.age / Math.max(0.05, spec.telegraphTime));
        this.applyTelegraph(slot, p);
        if (slot.age >= spec.telegraphTime) {
          slot.striking = true;
          slot.age = 0;
          slot.column.setMode('beam');
          slot.column.setColor(this.strikeColor, 0xffffff);
          slot.halo.visible = false;
          this.placeColumn(slot, spec.radius);
          this.temp.set(slot.x, spec.groundY, slot.z);
          this.onStrike?.(this.temp, spec.radius);
        }
        continue;
      }
      const s = Math.min(1, slot.age / Math.max(0.05, spec.strikeTime));
      const fade = s > 0.6 ? 1 - (s - 0.6) / 0.4 : 1;
      const surge = s < 0.15 ? 1.5 - (s / 0.15) * 0.5 : 1;
      slot.column.setIntensity(1.2 * fade * surge);
      slot.column.setGlows(spec.radius * 3, spec.radius * 5, fade);
      slot.groundMaterial.opacity = 0.9 * fade;
      slot.groundRing.scale.set(spec.radius * (1 + s), 1, spec.radius * (1 + s));
      this.placeColumn(slot, spec.radius * (0.85 + 0.15 * surge));
      if (s >= 1) this.deactivate(slot);
    }
  }

  private deactivate(slot: OrbitalSlot): void {
    slot.active = false;
    slot.striking = false;
    slot.column.setVisible(false);
    slot.column.setGlows(1, 1, 0);
    slot.groundRing.visible = false;
    slot.halo.visible = false;
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (!slot.active || !slot.striking || slot.spec.damage <= 0) continue;
      if (slot.age > slot.spec.strikeTime * 0.7) continue;
      if (target.y < slot.spec.groundY - targetRadius || target.y > slot.spec.topY) continue;
      const dx = target.x - slot.x;
      const dz = target.z - slot.z;
      const reach = slot.spec.radius + targetRadius;
      if (dx * dx + dz * dz > reach * reach) continue;
      this.temp.set(slot.x, target.y, slot.z);
      writeProbe(out, slot.spec.damage, 'laser', this.temp);
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) this.deactivate(slot);
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.column.dispose();
      slot.groundMaterial.dispose();
      slot.haloMaterial.dispose();
    }
    this.ringGeometry.dispose();
    this.haloGeometry.dispose();
    this.slots.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// 装饰性电弧（过载放电 / 死亡演出，无伤害）
// ---------------------------------------------------------------------------------------------

export class OracleDischarge {
  private readonly beams: OracleBeam[] = [];
  private readonly timers: number[] = [];
  private readonly lifetimes: number[] = [];
  private time = 0;
  private readonly direction = new THREE.Vector3();

  constructor(parent: THREE.Object3D, capacity: number, color: number) {
    for (let i = 0; i < capacity; i++) {
      const beam = new OracleBeam(parent, {
        name: `oracle_discharge_${i}`,
        color,
        coreColor: 0xffffff,
        glows: true,
        heightSegments: 24,
      });
      beam.setMode('arc');
      this.beams.push(beam);
      this.timers.push(0);
      this.lifetimes.push(0);
    }
  }

  public fire(from: THREE.Vector3, to: THREE.Vector3, lifetime: number, width: number): boolean {
    const index = this.timers.findIndex((t) => t <= 0);
    if (index < 0) return false;
    this.direction.subVectors(to, from);
    const length = this.direction.length();
    if (!(length > 1)) return false;
    const beam = this.beams[index];
    if (!beam.place(from, this.direction, length, Math.max(0.3, width))) return false;
    beam.setMode('arc');
    beam.setArcJitter(Math.min(14, length * 0.06));
    beam.setVisible(true);
    this.timers[index] = lifetime;
    this.lifetimes[index] = Math.max(0.05, lifetime);
    return true;
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.beams.forEach((beam, i) => {
      if (this.timers[i] <= 0) return;
      this.timers[i] -= deltaTime;
      const life = Math.max(0, this.timers[i] / this.lifetimes[i]);
      beam.tick(this.time);
      beam.setIntensity(1.2 * life);
      beam.setGlows(beam.radius * 8, beam.radius * 10, life);
      if (this.timers[i] <= 0) {
        beam.setVisible(false);
        beam.setGlows(1, 1, 0);
      }
    });
  }

  public clear(): void {
    this.beams.forEach((beam, i) => {
      this.timers[i] = 0;
      beam.setVisible(false);
      beam.setGlows(1, 1, 0);
    });
  }

  public dispose(): void {
    this.clear();
    for (const beam of this.beams) beam.dispose();
    this.beams.length = 0;
  }
}
