import * as THREE from 'three';
import type { CombatTarget, SpecialWeaponId } from '@/core/CombatContracts';
import type { FxSurface } from './WeaponFx';
import type { WeaponRuntime } from './WeaponSystem';
import {
  WEAPON_DAMAGE_SOURCE,
  raycastSurface,
  safeSample,
  type FireFrame,
  type SurfaceHit,
  type WeaponContext,
} from './WeaponContext';
import {
  acquireConeTargets,
  applySplashDamage,
  intersectRaySphere,
  isFiniteVector,
  isTargetAlive,
  segmentPointDistanceSq,
  type TargetSnapshot,
} from './WeaponTargeting';

/**
 * 集束火箭与蜂群导弹：排队连射、飞行积分（子步 + 扫掠命中）、近炸 / 触地 / 射程尽头引爆、
 * 溅射伤害。弹体对象池预分配，逐帧零分配。
 */

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
const SWARM_MAX_SPEED = 170;
const SWARM_ACCELERATION = 280;
/** 弹出阶段（秒）：只做侧向弹射与点火，不制导 */
const SWARM_BOOST_TIME = 0.2;
/** 蜂群最内侧发射点的横向距离（米，机体局部）；第一人称改用更靠外的翼下挂点 */
const SWARM_LATERAL = 0.9;
const SWARM_LATERAL_FIRST_PERSON = 1.6;
/** 蜂群发射口焰缩放（进入 emitMuzzleFlash 前的值）；第一人称大幅压低 */
const SWARM_FLASH_SCALE = 0.55;
const SWARM_FLASH_SCALE_FIRST_PERSON = 0.15;
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
        fx.particles.emitMuzzleFlash(
          projectile.position,
          this.tmpB,
          frame.carry,
          ROCKET_FLASH,
          0.9
        );
      }
    } else {
      // 微型导弹：从机腹两侧弹出，向外 / 向上绽开后点火。
      // 第一人称时发射点就在眼点下方：改从更靠外的翼下弹出并压低口焰，起飞段不横穿中央视野
      const firstPerson = fx?.particles.firstPerson === true;
      const lateral = firstPerson ? SWARM_LATERAL_FIRST_PERSON : SWARM_LATERAL;
      this.tmpA.set(side * (lateral + (projectile.slot % 4) * 0.18), -0.7, -0.4);
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
        fx.particles.emitMuzzleFlash(
          projectile.position,
          this.tmpB,
          frame.carry,
          SWARM_FLASH,
          firstPerson ? SWARM_FLASH_SCALE_FIRST_PERSON : SWARM_FLASH_SCALE
        );
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

    this.ctx.fx?.particles.emitTrail(
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

    this.ctx.fx?.particles.emitTrail(
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
      WEAPON_DAMAGE_SOURCE[id],
      direct
    );

    const scale = projectile.kind === 'rocket' ? 1 : 0.7;
    this.ctx.emitImpact(id, position, scale);
    const fx = this.ctx.fx;
    if (fx) {
      fx.particles.emitDetonation(
        position,
        projectile.kind === 'rocket' ? 1 : 0.7,
        surface,
        projectile.kind
      );
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
