import * as THREE from 'three';
import type { CombatTarget, DamageSource, SpecialWeaponId } from '@/core/CombatContracts';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { WeaponFx, FxSurface } from './WeaponFx';
import type { WeaponRuntime } from './WeaponSystem';
import {
  TargetSnapshotBuffer,
  acquireConeTargets,
  applySplashDamage,
  intersectRaySphere,
  isDroneTarget,
  isFiniteVector,
  isTargetAlive,
  safeApplyDamage,
  safeApplyStun,
  segmentPointDistanceSq,
  type TargetSnapshot,
} from './WeaponTargeting';

/**
 * 各武器的开火 / 飞行 / 命中逻辑。WeaponSystem 负责选择、扳机与弹药；
 * 这里只关心“开火之后发生什么”。所有对象预分配，逐帧零分配。
 */

/** 地表采样（与 TerrainGenerator.sampleSurface 同签名） */
export type SurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

/** 控制器与 WeaponSystem 之间的共享上下文 */
export interface WeaponContext {
  readonly fx: WeaponFx | null;
  readonly particleSystem: ParticleSystem | null;
  readonly surfaceSampler: SurfaceSampler | null;
  getSnapshot(): TargetSnapshotBuffer;
  emitFired(id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3): void;
  emitImpact(id: SpecialWeaponId, position: THREE.Vector3, scale: number): void;
  emitEmpPulse(center: THREE.Vector3, radius: number, stunSeconds: number): void;
  emitOverheat(): void;
  emitBeamEnd(id: SpecialWeaponId): void;
  emitChargeStart(): void;
  emitDryFire(id: SpecialWeaponId): void;
  attachFx(): void;
}

/** 本帧的发射基准 */
export interface FireFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** 机头方向（单位向量，本地 -Z） */
  forward: THREE.Vector3;
  /** 载机速度估计（米/秒） */
  carry: THREE.Vector3;
  /** 枪口坐标与朝向是否有效（NaN / Infinity 时不开火） */
  valid: boolean;
}

export function createFireFrame(): FireFrame {
  return {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    forward: new THREE.Vector3(0, 0, -1),
    carry: new THREE.Vector3(),
    valid: false,
  };
}

// -----------------------------------------------------------------------------
// 地表射线
// -----------------------------------------------------------------------------

export interface SurfaceHit {
  t: number;
  water: boolean;
}

/**
 * 沿射线步进 + 二分，找到第一次低于地表的位置。起点已在地下时不裁剪。
 * 返回是否命中，命中距离写入 out.t。
 */
export function raycastSurface(
  sampler: SurfaceSampler | null,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDistance: number,
  out: SurfaceHit
): boolean {
  out.t = maxDistance;
  out.water = false;
  if (!sampler || !(maxDistance > 0)) return false;
  const start = safeSample(sampler, origin.x, origin.z);
  if (!start || origin.y <= start.y) return false;

  const steps = Math.max(8, Math.min(36, Math.ceil(maxDistance / 16)));
  let previousT = 0;
  for (let i = 1; i <= steps; i++) {
    const t = (maxDistance * i) / steps;
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    const sample = safeSample(sampler, x, z);
    if (sample && y <= sample.y) {
      let lo = previousT;
      let hi = t;
      let water = sample.water;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) * 0.5;
        const s = safeSample(sampler, origin.x + dir.x * mid, origin.z + dir.z * mid);
        if (s && origin.y + dir.y * mid <= s.y) {
          hi = mid;
          water = s.water;
        } else {
          lo = mid;
        }
      }
      out.t = hi;
      out.water = water;
      return true;
    }
    previousT = t;
  }
  return false;
}

function safeSample(
  sampler: SurfaceSampler,
  x: number,
  z: number
): { y: number; water: boolean } | null {
  try {
    const sample = sampler(x, z);
    return sample && Number.isFinite(sample.y) ? sample : null;
  } catch {
    return null;
  }
}

const SOURCE_BY_ID: Record<SpecialWeaponId, DamageSource> = {
  rockets: 'rocket',
  laser: 'laser',
  swarm: 'swarm',
  railgun: 'railgun',
  emp: 'emp',
};

// -----------------------------------------------------------------------------
// 火箭 / 蜂群导弹
// -----------------------------------------------------------------------------

type ProjectileKind = 'rocket' | 'swarm';

interface Projectile {
  kind: ProjectileKind;
  active: boolean;
  pending: boolean;
  launchDelay: number;
  slot: number;
  position: THREE.Vector3;
  prevPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  seed: number;
  travelled: number;
  range: number;
  damage: number;
  splash: number;
  speed: number;
  maxSpeed: number;
  maxLife: number;
  target: CombatTarget | null;
  targetPosition: THREE.Vector3;
  retargetTimer: number;
  wobblePhase: number;
  wobbleFreq: number;
  wobbleAmp: number;
  /** 火箭散布（本地 x/y 偏转，弧度） */
  spreadX: number;
  spreadY: number;
  /** 发射瞬间的瞄准方向（无目标的微型导弹沿它飞） */
  aim: THREE.Vector3;
  trailCarry: { value: number };
}

const ROCKET_POOL_SIZE = 96;
const SWARM_POOL_SIZE = 96;
/** 火箭连射间隔（秒） */
const ROCKET_RIPPLE = 0.055;
const ROCKET_SPEED = 175;
/** 近炸引信：距敌方目标表面（米） */
const ROCKET_PROXIMITY = 3.5;
/** 蜂群发射间隔（秒） */
const SWARM_RIPPLE = 0.065;
const SWARM_LAUNCH_SPEED = 55;
const SWARM_MAX_SPEED = 150;
const SWARM_ACCELERATION = 240;
/** 弹出阶段（秒）：只做侧向弹射与点火，不制导 */
const SWARM_BOOST_TIME = 0.2;
const SWARM_CONE_COS = Math.cos(THREE.MathUtils.degToRad(42));
const SWARM_SEEKER_COS = Math.cos(THREE.MathUtils.degToRad(55));
const SWARM_SEEKER_RANGE = 380;
const SWARM_PROXIMITY = 1.8;
const SWARM_LIFETIME = 5.2;
const MAX_SUBSTEP = 1 / 60;
const MAX_SUBSTEPS = 32;
/** 全局 ParticleSystem 额度很小：大爆炸效果节流调用 */
const PARTICLE_SYSTEM_THROTTLE = 0.16;

export class ProjectileController {
  private readonly ctx: WeaponContext;
  private readonly rockets: Projectile[] = [];
  private readonly swarm: Projectile[] = [];
  private readonly acquired: TargetSnapshot[] = [];
  private psCooldown = 0;
  private pendingCount = 0;
  private activeCount = 0;

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpDesired = new THREE.Vector3();
  private readonly tmpAxis = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly hitPoint = new THREE.Vector3();
  private readonly segT = { t: 0 };
  private readonly surfaceHit: SurfaceHit = { t: 0, water: false };

  constructor(ctx: WeaponContext) {
    this.ctx = ctx;
    for (let i = 0; i < ROCKET_POOL_SIZE; i++) this.rockets.push(createProjectile('rocket'));
    for (let i = 0; i < SWARM_POOL_SIZE; i++) this.swarm.push(createProjectile('swarm'));
  }

  public hasActivity(): boolean {
    return this.pendingCount > 0 || this.activeCount > 0;
  }

  public getActiveCount(kind?: ProjectileKind): number {
    let count = 0;
    if (kind !== 'swarm') count += this.rockets.filter((p) => p.active).length;
    if (kind !== 'rocket') count += this.swarm.filter((p) => p.active).length;
    return count;
  }

  /** 齐射：排队连射（火箭 / 蜂群），返回实际排队数量 */
  public fireSalvo(id: 'rockets' | 'swarm', runtime: WeaponRuntime, frame: FireFrame): number {
    const stats = runtime.stats;
    const pool = id === 'rockets' ? this.rockets : this.swarm;
    const count = Math.max(1, Math.floor(stats.projectileCount));

    // 蜂群：开火瞬间在前方锥形范围内分配不同的敌方目标
    let targetCount = 0;
    if (id === 'swarm') {
      targetCount = acquireConeTargets(
        this.ctx.getSnapshot(),
        frame.position,
        frame.forward,
        stats.range,
        SWARM_CONE_COS,
        32,
        this.acquired
      );
    }

    // 散布随升级收紧：1.0° → 0.65°
    const spread = THREE.MathUtils.degToRad(1.0 - runtime.level * 0.07);
    let queued = 0;
    for (const projectile of pool) {
      if (queued >= count) break;
      if (projectile.active || projectile.pending) continue;
      projectile.pending = true;
      projectile.active = false;
      projectile.slot = queued;
      projectile.launchDelay = queued * (id === 'rockets' ? ROCKET_RIPPLE : SWARM_RIPPLE);
      projectile.damage = stats.damage;
      projectile.splash = stats.splashRadius;
      projectile.range = stats.range;
      projectile.seed = Math.random();
      projectile.spreadX = (Math.random() * 2 - 1) * spread;
      projectile.spreadY = (Math.random() * 2 - 1) * spread;
      projectile.target =
        id === 'swarm' && targetCount > 0 ? this.acquired[queued % targetCount].target : null;
      queued++;
    }
    this.acquired.length = 0;
    this.pendingCount += queued;
    if (queued > 0) {
      this.ctx.attachFx();
      this.ctx.emitFired(id, frame.position, frame.forward);
    }
    return queued;
  }

  public update(deltaTime: number, frame: FireFrame): void {
    this.psCooldown = Math.max(0, this.psCooldown - deltaTime);
    if (!this.hasActivity()) {
      this.ctx.fx?.renderBodies('rocket', this.rockets);
      this.ctx.fx?.renderBodies('swarm', this.swarm);
      return;
    }

    this.updatePool(this.rockets, deltaTime, frame);
    this.updatePool(this.swarm, deltaTime, frame);

    let pending = 0;
    let active = 0;
    for (const p of this.rockets) {
      if (p.pending) pending++;
      if (p.active) active++;
    }
    for (const p of this.swarm) {
      if (p.pending) pending++;
      if (p.active) active++;
    }
    this.pendingCount = pending;
    this.activeCount = active;

    this.ctx.fx?.renderBodies('rocket', this.rockets);
    this.ctx.fx?.renderBodies('swarm', this.swarm);
  }

  private updatePool(pool: Projectile[], deltaTime: number, frame: FireFrame): void {
    for (const projectile of pool) {
      let remaining = deltaTime;
      if (projectile.pending) {
        projectile.launchDelay -= deltaTime;
        if (projectile.launchDelay > 0) continue;
        if (!frame.valid) {
          // 枪口无效（例如复活瞬移）时放弃这一发
          projectile.pending = false;
          continue;
        }
        remaining = Math.min(deltaTime, -projectile.launchDelay);
        this.launch(projectile, frame);
      }
      if (!projectile.active) continue;
      if (projectile.kind === 'swarm') {
        this.refreshSwarmTarget(projectile, remaining);
      }
      const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(remaining / MAX_SUBSTEP)));
      const step = remaining / steps;
      for (let i = 0; i < steps && projectile.active; i++) {
        if (projectile.kind === 'rocket') {
          this.stepRocket(projectile, step);
        } else {
          this.stepSwarm(projectile, step);
        }
      }
    }
  }

  private launch(projectile: Projectile, frame: FireFrame): void {
    projectile.pending = false;
    projectile.active = true;
    projectile.age = 0;
    projectile.travelled = 0;
    projectile.retargetTimer = 0;
    projectile.trailCarry.value = 0;
    projectile.aim.copy(frame.forward);

    const side = projectile.slot % 2 === 0 ? 1 : -1;
    const fx = this.ctx.fx;
    if (projectile.kind === 'rocket') {
      // 两侧挂架交替发射，内外排错开
      const outer = Math.floor(projectile.slot / 2) % 2;
      this.tmpA.set(side * (1.5 + outer * 0.55), -0.5 - outer * 0.15, -0.8);
      this.tmpA.applyQuaternion(frame.quaternion);
      projectile.position.copy(frame.position).add(this.tmpA);
      // 散布：在机体本地坐标系里偏转前向
      this.tmpB.set(projectile.spreadX, projectile.spreadY, -1).normalize();
      this.tmpB.applyQuaternion(frame.quaternion).normalize();
      const inherited = THREE.MathUtils.clamp(frame.carry.dot(frame.forward), 0, 120);
      projectile.speed = ROCKET_SPEED + inherited;
      projectile.maxSpeed = projectile.speed;
      projectile.velocity.copy(this.tmpB).multiplyScalar(projectile.speed);
      projectile.maxLife = projectile.range / projectile.speed + 1;
      if (fx) {
        fx.emitMuzzleFlash(projectile.position, this.tmpB, frame.carry, ROCKET_FLASH, 0.9);
      }
    } else {
      // 微型导弹：从机腹两侧弹出，向外 / 向上绽开后点火
      this.tmpA.set(side * (0.9 + (projectile.slot % 4) * 0.18), -0.7, -0.4);
      this.tmpA.applyQuaternion(frame.quaternion);
      projectile.position.copy(frame.position).add(this.tmpA);
      const angle = side * (0.35 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.4;
      this.tmpB.set(Math.sin(angle), Math.cos(angle) * 0.75 + 0.2, 0).normalize();
      this.tmpB.applyQuaternion(frame.quaternion);
      const inherited = THREE.MathUtils.clamp(frame.carry.dot(frame.forward), 0, 90);
      projectile.speed = SWARM_LAUNCH_SPEED + inherited;
      projectile.maxSpeed = SWARM_MAX_SPEED + inherited * 0.5;
      projectile.velocity
        .copy(frame.forward)
        .multiplyScalar(projectile.speed)
        .addScaledVector(this.tmpB, 16 + Math.random() * 10);
      projectile.speed = projectile.velocity.length();
      projectile.maxLife = SWARM_LIFETIME;
      projectile.wobblePhase = Math.random() * Math.PI * 2;
      projectile.wobbleFreq = 5 + Math.random() * 4;
      projectile.wobbleAmp = 0.3 + Math.random() * 0.25;
      if (fx) {
        fx.emitMuzzleFlash(projectile.position, this.tmpB, frame.carry, SWARM_FLASH, 0.55);
      }
    }
    projectile.prevPosition.copy(projectile.position);
  }

  // ---------------------------------------------------------------------------
  // 火箭
  // ---------------------------------------------------------------------------

  private stepRocket(rocket: Projectile, step: number): void {
    rocket.prevPosition.copy(rocket.position);
    rocket.position.addScaledVector(rocket.velocity, step);
    rocket.age += step;
    rocket.travelled += rocket.speed * step;
    if (!isFiniteVector(rocket.position)) {
      rocket.active = false;
      return;
    }

    if (this.checkFlightCollision(rocket, ROCKET_PROXIMITY, null)) return;

    this.ctx.fx?.emitTrail(
      'rocket',
      rocket.prevPosition,
      rocket.position,
      rocket.velocity,
      step,
      rocket.trailCarry,
      rocket.age
    );

    if (rocket.travelled >= rocket.range || rocket.age >= rocket.maxLife) {
      this.detonate(rocket, rocket.position, null, 'air');
    }
  }

  // ---------------------------------------------------------------------------
  // 蜂群导弹
  // ---------------------------------------------------------------------------

  /** 每帧刷新一次目标坐标；目标失效时按间隔重新索敌（只认 ENEMY） */
  private refreshSwarmTarget(missile: Projectile, deltaTime: number): void {
    if (missile.target && !isTargetAlive(missile.target)) {
      missile.target = null;
    }
    if (!missile.target) {
      missile.retargetTimer -= deltaTime;
      if (missile.retargetTimer <= 0 && missile.age >= SWARM_BOOST_TIME * 0.5) {
        missile.retargetTimer = 0.15;
        missile.target = this.findSeekerTarget(missile);
      }
    }
    if (missile.target) {
      missile.target.mesh.getWorldPosition(missile.targetPosition);
      if (!isFiniteVector(missile.targetPosition)) {
        missile.target = null;
      }
    }
  }

  private findSeekerTarget(missile: Projectile): CombatTarget | null {
    const snapshot = this.ctx.getSnapshot();
    const speed = missile.velocity.length();
    if (speed < 1e-3) return null;
    this.tmpA.copy(missile.velocity).divideScalar(speed);
    let best: CombatTarget | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < snapshot.size(); i++) {
      const entry = snapshot.get(i);
      if (!entry.hostile) continue;
      this.tmpB.subVectors(entry.position, missile.position);
      const distance = this.tmpB.length();
      if (distance < 1e-3 || distance > SWARM_SEEKER_RANGE + entry.radius) continue;
      const cos = this.tmpB.dot(this.tmpA) / distance;
      if (cos < SWARM_SEEKER_COS) continue;
      const score = distance * (1.8 - cos);
      if (score < bestScore) {
        bestScore = score;
        best = entry.target;
      }
    }
    return best;
  }

  private stepSwarm(missile: Projectile, step: number): void {
    missile.prevPosition.copy(missile.position);
    missile.age += step;

    const speed = missile.velocity.length();
    const direction = this.tmpA.copy(missile.velocity).divideScalar(Math.max(speed, 1e-4));
    const boosting = missile.age < SWARM_BOOST_TIME;
    missile.speed = Math.min(
      missile.maxSpeed,
      speed + SWARM_ACCELERATION * (boosting ? 0.35 : 1) * step
    );

    // 期望方向：有目标追目标，没有目标沿发射瞬间的瞄准方向飞（扇形散开）
    const desired = this.tmpDesired;
    let distance = 200;
    if (missile.target) {
      desired.subVectors(missile.targetPosition, missile.position);
      distance = desired.length();
      if (distance > 1e-4) desired.divideScalar(distance);
      else desired.copy(direction);
    } else {
      desired.copy(missile.aim);
    }
    if (!boosting) {
      // 蛇形摆动：离目标越近摆幅越小，保证末段精度
      const wobble =
        missile.wobbleAmp *
        THREE.MathUtils.clamp((distance - 25) / 140, 0, 1) *
        (missile.target ? 1 : 0.6);
      if (wobble > 1e-4) {
        buildPerpendicular(desired, this.tmpB, this.tmpC);
        const phase = missile.wobblePhase + missile.age * missile.wobbleFreq;
        desired
          .addScaledVector(this.tmpB, Math.sin(phase) * wobble)
          .addScaledVector(this.tmpC, Math.cos(phase * 0.7) * wobble)
          .normalize();
      }
    }
    // 弹出阶段转向很慢；之后转向速率随飞行时间提高
    const turnRate = boosting ? 1.4 : 3.4 + Math.min(4, missile.age * 1.6);
    rotateTowards(direction, desired, turnRate * step, this.tmpAxis, this.tmpQuat);
    missile.velocity.copy(direction).multiplyScalar(missile.speed);
    missile.position.addScaledVector(missile.velocity, step);
    missile.travelled += missile.speed * step;
    if (!isFiniteVector(missile.position)) {
      missile.active = false;
      return;
    }

    if (this.checkFlightCollision(missile, 0, missile.target)) return;

    this.ctx.fx?.emitTrail(
      'swarm',
      missile.prevPosition,
      missile.position,
      missile.velocity,
      step,
      missile.trailCarry,
      missile.age
    );

    if (missile.age >= missile.maxLife || missile.travelled >= missile.range * 1.7) {
      this.detonate(missile, missile.position, null, 'air');
    }
  }

  // ---------------------------------------------------------------------------
  // 命中判定
  // ---------------------------------------------------------------------------

  /**
   * 扫掠线段（上一子步 → 当前子步）与目标 / 地表求交，取最早的命中点引爆。
   * proximity > 0：对任意敌方目标近炸；homingTarget：只对自己的目标近炸。
   */
  private checkFlightCollision(
    projectile: Projectile,
    proximity: number,
    homingTarget: CombatTarget | null
  ): boolean {
    const snapshot = this.ctx.getSnapshot();
    const from = projectile.prevPosition;
    const to = projectile.position;
    const segmentLength = from.distanceTo(to);
    if (segmentLength < 1e-6) return false;
    this.tmpB.subVectors(to, from).divideScalar(segmentLength);

    let bestT = Infinity;
    let bestTarget: CombatTarget | null = null;
    let bestDirect = false;
    for (let i = 0; i < snapshot.size(); i++) {
      const entry = snapshot.get(i);
      if (!entry.damageable) continue;
      const fuse =
        entry.hostile && (proximity > 0 || entry.target === homingTarget)
          ? Math.max(proximity, entry.target === homingTarget ? SWARM_PROXIMITY : 0)
          : 0;
      const reach = entry.radius + fuse;
      const distSq = segmentPointDistanceSq(from, to, entry.position, this.segT);
      if (distSq > reach * reach) continue;
      // 直接命中：取射线进入球面的距离；近炸：取最近点
      const direct = distSq <= entry.radius * entry.radius;
      let t = this.segT.t * segmentLength;
      if (direct) {
        const enter = intersectRaySphere(
          from,
          this.tmpB,
          entry.position,
          entry.radius,
          segmentLength
        );
        if (enter >= 0) t = enter;
      }
      if (t < bestT) {
        bestT = t;
        bestTarget = entry.target;
        bestDirect = direct || entry.target === homingTarget;
      }
    }

    // 地表
    let surface: FxSurface = 'air';
    const sampler = this.ctx.surfaceSampler;
    if (sampler) {
      const sample = safeSample(sampler, to.x, to.z);
      if (sample && to.y <= sample.y) {
        if (raycastSurface(sampler, from, this.tmpB, segmentLength, this.surfaceHit)) {
          if (this.surfaceHit.t < bestT) {
            bestT = this.surfaceHit.t;
            bestTarget = null;
            surface = this.surfaceHit.water ? 'water' : 'ground';
          }
        } else if (bestT === Infinity) {
          bestT = segmentLength;
          surface = sample.water ? 'water' : 'ground';
        }
      }
    }

    if (bestT === Infinity) return false;
    this.hitPoint.copy(from).addScaledVector(this.tmpB, Math.min(bestT, segmentLength));
    projectile.position.copy(this.hitPoint);
    this.detonate(projectile, this.hitPoint, bestDirect ? bestTarget : null, surface);
    return true;
  }

  private detonate(
    projectile: Projectile,
    position: THREE.Vector3,
    direct: CombatTarget | null,
    surface: FxSurface
  ): void {
    projectile.active = false;
    projectile.target = null;
    const id: SpecialWeaponId = projectile.kind === 'rocket' ? 'rockets' : 'swarm';
    const snapshot = this.ctx.getSnapshot();
    applySplashDamage(
      snapshot,
      position,
      projectile.splash,
      projectile.damage,
      SOURCE_BY_ID[id],
      direct
    );

    const scale = projectile.kind === 'rocket' ? 1 : 0.7;
    this.ctx.emitImpact(id, position, scale);
    const fx = this.ctx.fx;
    if (fx) {
      fx.emitDetonation(position, projectile.kind === 'rocket' ? 1 : 0.7, surface, projectile.kind);
    }
    const ps = this.ctx.particleSystem;
    if (ps && this.psCooldown <= 0) {
      this.psCooldown = PARTICLE_SYSTEM_THROTTLE;
      try {
        if (surface === 'water') {
          ps.createWaterImpact(position, 1.4);
        } else if (surface === 'ground') {
          ps.createGroundImpact(position, 1.4, 'ground');
          ps.createShockwave(position, 10, 0.45, 0xffa060, 0.5);
        } else if (direct) {
          ps.createMissileImpact(position, projectile.kind === 'rocket' ? 1.3 : 1);
        }
      } catch {
        // 特效失败不影响命中逻辑
      }
    }
  }

  /** 清除所有在途弹体与排队发射 */
  public clear(): void {
    for (const projectile of this.rockets) resetProjectile(projectile);
    for (const projectile of this.swarm) resetProjectile(projectile);
    this.pendingCount = 0;
    this.activeCount = 0;
    this.acquired.length = 0;
  }
}

const ROCKET_FLASH = new THREE.Color(2.6, 1.2, 0.4);
const SWARM_FLASH = new THREE.Color(2.4, 1.9, 1.2);

function createProjectile(kind: ProjectileKind): Projectile {
  return {
    kind,
    active: false,
    pending: false,
    launchDelay: 0,
    slot: 0,
    position: new THREE.Vector3(),
    prevPosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    age: 0,
    seed: 0,
    travelled: 0,
    range: 0,
    damage: 0,
    splash: 0,
    speed: 0,
    maxSpeed: 0,
    maxLife: 0,
    target: null,
    targetPosition: new THREE.Vector3(),
    retargetTimer: 0,
    wobblePhase: 0,
    wobbleFreq: 0,
    wobbleAmp: 0,
    spreadX: 0,
    spreadY: 0,
    aim: new THREE.Vector3(0, 0, -1),
    trailCarry: { value: 0 },
  };
}

function resetProjectile(projectile: Projectile): void {
  projectile.active = false;
  projectile.pending = false;
  projectile.target = null;
}

/** 构造与 dir 正交的单位向量 u、w */
function buildPerpendicular(dir: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3): void {
  if (Math.abs(dir.y) < 0.9) u.set(0, 1, 0);
  else u.set(1, 0, 0);
  w.crossVectors(dir, u).normalize();
  u.crossVectors(w, dir).normalize();
}

/** 把单位向量 current 朝 desired 旋转至多 maxAngle 弧度（原地修改 current） */
function rotateTowards(
  current: THREE.Vector3,
  desired: THREE.Vector3,
  maxAngle: number,
  axis: THREE.Vector3,
  quat: THREE.Quaternion
): void {
  const cos = THREE.MathUtils.clamp(current.dot(desired), -1, 1);
  const angle = Math.acos(cos);
  if (angle <= maxAngle || angle < 1e-5) {
    current.copy(desired);
    return;
  }
  axis.crossVectors(current, desired);
  if (axis.lengthSq() < 1e-10) {
    buildPerpendicular(current, axis, quatScratch);
  }
  axis.normalize();
  quat.setFromAxisAngle(axis, maxAngle);
  current.applyQuaternion(quat).normalize();
}

const quatScratch = new THREE.Vector3();

// -----------------------------------------------------------------------------
// 脉冲激光
// -----------------------------------------------------------------------------

/** 光束命中判定的额外半径（米） */
const BEAM_RADIUS = 0.6;
/** 光束起点距枪口的前移量（米），避免与机头重叠 */
const BEAM_FORWARD_OFFSET = 1.5;
/** onImpact 节流（秒）：持续照射时不刷屏 */
const BEAM_IMPACT_INTERVAL = 0.25;

export class LaserController {
  private readonly ctx: WeaponContext;
  private active = false;
  private impactTimer = 0;
  private readonly origin = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly hitPoint = new THREE.Vector3();
  private readonly surfaceHit: SurfaceHit = { t: 0, water: false };

  constructor(ctx: WeaponContext) {
    this.ctx = ctx;
  }

  public isActive(): boolean {
    return this.active;
  }

  /**
   * 每帧调用（无论是否选中）：wantsFire 为真时照射并积热，否则散热。
   * 返回 true 表示本帧刚刚过热。
   */
  public step(
    deltaTime: number,
    runtime: WeaponRuntime,
    frame: FireFrame,
    wantsFire: boolean
  ): boolean {
    const stats = runtime.stats;
    if (runtime.overheated) {
      runtime.heat = Math.max(0, runtime.heat - stats.coolPerSecond * deltaTime);
      if (runtime.heat <= 1e-6) {
        runtime.heat = 0;
        runtime.overheated = false;
      }
    }

    const firing = wantsFire && !runtime.overheated && frame.valid;
    if (!firing) {
      this.stop(runtime.id);
      if (!runtime.overheated) {
        runtime.heat = Math.max(0, runtime.heat - stats.coolPerSecond * deltaTime);
      }
      return false;
    }

    if (!this.active) {
      this.active = true;
      this.impactTimer = 0;
      this.ctx.attachFx();
      this.ctx.emitFired(runtime.id, frame.position, frame.forward);
    }

    runtime.heat = Math.min(1, runtime.heat + stats.heatPerSecond * deltaTime);
    if (runtime.heat > 1 - 1e-6) runtime.heat = 1;

    // 射线：地形裁剪后取第一个可伤害目标
    const dir = frame.forward;
    this.origin.copy(frame.position).addScaledVector(dir, BEAM_FORWARD_OFFSET);
    let maxT = stats.range;
    let surface: FxSurface = 'air';
    if (raycastSurface(this.ctx.surfaceSampler, this.origin, dir, stats.range, this.surfaceHit)) {
      maxT = this.surfaceHit.t;
      surface = this.surfaceHit.water ? 'water' : 'ground';
    }

    const snapshot = this.ctx.getSnapshot();
    let bestT = maxT;
    let bestTarget: CombatTarget | null = null;
    for (let i = 0; i < snapshot.size(); i++) {
      const entry = snapshot.get(i);
      if (!entry.damageable) continue;
      const t = intersectRaySphere(
        this.origin,
        dir,
        entry.position,
        entry.radius + BEAM_RADIUS,
        bestT
      );
      if (t >= 0 && t < bestT) {
        bestT = t;
        bestTarget = entry.target;
      }
    }

    const hitSomething = bestTarget !== null || surface !== 'air';
    this.end.copy(this.origin).addScaledVector(dir, bestT);
    if (bestTarget) {
      this.hitPoint.copy(this.end);
      safeApplyDamage(bestTarget, stats.damage * deltaTime, 'laser', this.hitPoint);
      surface = 'air';
    }

    this.impactTimer -= deltaTime;
    if (hitSomething && this.impactTimer <= 0) {
      this.impactTimer = BEAM_IMPACT_INTERVAL;
      this.ctx.emitImpact(runtime.id, this.end, 0.35);
    }

    const fx = this.ctx.fx;
    if (fx) {
      fx.setLaserBeam(true, frame.position, this.end, hitSomething, runtime.heat);
      fx.emitLaserMuzzle(frame.position, frame.carry);
      if (hitSomething) {
        fx.emitLaserImpact(this.end, dir, deltaTime, surface);
      }
    }

    if (runtime.heat >= 1) {
      runtime.overheated = true;
      this.stop(runtime.id);
      // 过热：枪口喷出一团蒸汽
      if (fx) {
        this.hitPoint.copy(frame.carry).multiplyScalar(0.6);
        this.hitPoint.y += 3;
        fx.emitPuff(frame.position, this.hitPoint, 1.2, 5.5, 1.3, OVERHEAT_STEAM, 0.5);
      }
      this.ctx.emitOverheat();
      return true;
    }
    return false;
  }

  /** 停止照射（松开扳机 / 切换武器 / 过热） */
  public stop(id: SpecialWeaponId): void {
    if (!this.active) return;
    this.active = false;
    this.ctx.fx?.setLaserBeam(false, this.origin, this.end, false, 0);
    this.ctx.emitBeamEnd(id);
  }

  /** 无事件地关闭光束（clear / dispose） */
  public reset(): void {
    this.active = false;
    this.ctx.fx?.setLaserBeam(false, this.origin, this.end, false, 0);
  }
}

const OVERHEAT_STEAM = new THREE.Color(0.85, 0.86, 0.9);

// -----------------------------------------------------------------------------
// 电磁轨道炮
// -----------------------------------------------------------------------------

/** 低于该蓄力松开视为取消（不消耗弹药） */
export const RAILGUN_MIN_CHARGE = 0.25;
const SLUG_RADIUS = 0.8;

interface RailHit {
  target: CombatTarget;
  t: number;
}

export class RailgunController {
  private readonly ctx: WeaponContext;
  private readonly origin = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly surfaceHit: SurfaceHit = { t: 0, water: false };
  private readonly hits: RailHit[] = [];
  private readonly hitPool: RailHit[] = [];

  constructor(ctx: WeaponContext) {
    this.ctx = ctx;
  }

  public begin(runtime: WeaponRuntime): void {
    runtime.charging = true;
    runtime.charge = 0;
    this.ctx.attachFx();
    this.ctx.emitChargeStart();
  }

  public updateCharge(deltaTime: number, runtime: WeaponRuntime, frame: FireFrame): void {
    if (!runtime.charging) return;
    const chargeTime = Math.max(0.05, runtime.stats.chargeTime);
    runtime.charge = Math.min(1, runtime.charge + deltaTime / chargeTime);
    if (runtime.charge > 1 - 1e-6) runtime.charge = 1;
    if (frame.valid) {
      this.point.copy(frame.position).addScaledVector(frame.forward, 1.2);
      this.ctx.fx?.emitRailCharge(
        this.point,
        frame.forward,
        frame.carry,
        runtime.charge,
        deltaTime
      );
    }
  }

  /** 松开扳机：蓄力足够则发射并返回 true，否则取消（dry fire）返回 false */
  public release(runtime: WeaponRuntime, frame: FireFrame): boolean {
    if (!runtime.charging) return false;
    const charge = runtime.charge;
    runtime.charging = false;
    runtime.charge = 0;
    if (charge < RAILGUN_MIN_CHARGE || !frame.valid) {
      this.ctx.emitDryFire(runtime.id);
      return false;
    }
    this.fire(runtime, frame, charge);
    return true;
  }

  /** 取消蓄力（切换武器等）；emit=true 时发出 dry fire 事件 */
  public cancel(runtime: WeaponRuntime, emit: boolean): void {
    if (!runtime.charging) return;
    runtime.charging = false;
    runtime.charge = 0;
    if (emit) this.ctx.emitDryFire(runtime.id);
  }

  private fire(runtime: WeaponRuntime, frame: FireFrame, charge: number): void {
    const stats = runtime.stats;
    const dir = frame.forward;
    this.origin.copy(frame.position).addScaledVector(dir, 1.2);
    let maxT = stats.range;
    let surface: FxSurface = 'air';
    if (raycastSurface(this.ctx.surfaceSampler, this.origin, dir, stats.range, this.surfaceHit)) {
      maxT = this.surfaceHit.t;
      surface = this.surfaceHit.water ? 'water' : 'ground';
    }

    // 收集弹道上所有可伤害目标，按距离排序（贯穿）
    const snapshot = this.ctx.getSnapshot();
    this.hits.length = 0;
    for (let i = 0; i < snapshot.size(); i++) {
      const entry = snapshot.get(i);
      if (!entry.damageable) continue;
      const t = intersectRaySphere(
        this.origin,
        dir,
        entry.position,
        entry.radius + SLUG_RADIUS,
        maxT
      );
      if (t < 0) continue;
      const hit = this.hitPool[this.hits.length] ?? { target: entry.target, t };
      if (!this.hitPool[this.hits.length]) this.hitPool.push(hit);
      hit.target = entry.target;
      hit.t = t;
      this.hits.push(hit);
    }
    this.hits.sort((a, b) => a.t - b.t);

    const damage = stats.damage * charge;
    const fx = this.ctx.fx;
    for (const hit of this.hits) {
      if (!isTargetAlive(hit.target)) continue;
      this.point.copy(this.origin).addScaledVector(dir, hit.t);
      safeApplyDamage(hit.target, damage, 'railgun', this.point);
      this.ctx.emitImpact(runtime.id, this.point, 0.8 + charge * 0.6);
      fx?.emitRailImpact(this.point, dir);
    }
    this.hits.length = 0;

    this.end.copy(this.origin).addScaledVector(dir, maxT);
    if (surface !== 'air') {
      this.ctx.emitImpact(runtime.id, this.end, 0.6 + charge * 0.5);
      fx?.emitDetonation(this.end, 0.45 + charge * 0.35, surface, 'swarm');
      fx?.emitRailImpact(this.end, dir);
    }
    fx?.fireRailTracer(this.origin, this.end, charge);
    this.ctx.emitFired(runtime.id, this.origin, dir);
  }
}

// -----------------------------------------------------------------------------
// 电磁脉冲
// -----------------------------------------------------------------------------

/** 冲击波视觉扩散时长（秒）：被瘫痪目标的电弧按距离延迟出现 */
const EMP_WAVE_TIME = 0.6;

export class EmpController {
  private readonly ctx: WeaponContext;
  private readonly center = new THREE.Vector3();

  constructor(ctx: WeaponContext) {
    this.ctx = ctx;
  }

  /** 释放脉冲：瘫痪半径内所有 ENEMY 目标，并对导弹 / 无人机造成少量伤害；返回受影响数量 */
  public pulse(runtime: WeaponRuntime, frame: FireFrame): number {
    const stats = runtime.stats;
    const radius = stats.radius;
    const stunSeconds = stats.stunSeconds;
    this.center.copy(frame.position);
    this.ctx.attachFx();
    this.ctx.emitEmpPulse(this.center, radius, stunSeconds);

    const snapshot = this.ctx.getSnapshot();
    const fx = this.ctx.fx;
    let affected = 0;
    for (let i = 0; i < snapshot.size(); i++) {
      const entry = snapshot.get(i);
      if (!entry.hostile) continue;
      const distance = entry.position.distanceTo(this.center);
      if (distance - entry.radius > radius) continue;
      const target = entry.target;
      if (!isTargetAlive(target)) continue;
      affected++;
      safeApplyStun(target, stunSeconds);
      if (target.kind === 'projectile' || isDroneTarget(target)) {
        safeApplyDamage(target, stats.damage, 'emp', entry.position);
      }
      fx?.emitStunCrackle(
        entry.position,
        entry.radius,
        (Math.max(0, distance) / Math.max(1, radius)) * EMP_WAVE_TIME
      );
    }

    fx?.fireEmp(this.center, radius);
    this.ctx.emitFired(runtime.id, this.center, frame.forward);
    return affected;
  }
}
