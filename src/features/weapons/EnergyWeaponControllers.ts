import * as THREE from 'three';
import type { CombatTarget, SpecialWeaponId } from '@/core/CombatContracts';
import type { FxSurface } from './WeaponFx';
import type { WeaponRuntime } from './WeaponSystem';
import {
  raycastSurface,
  type FireFrame,
  type SurfaceHit,
  type WeaponContext,
} from './WeaponContext';
import {
  intersectRaySphere,
  isDroneTarget,
  isTargetAlive,
  safeApplyDamage,
  safeApplyStun,
} from './WeaponTargeting';

/**
 * 能量武器：脉冲激光（持续光束 + 热量）、电磁轨道炮（蓄力贯穿）、电磁脉冲（范围瘫痪）。
 */

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
      fx.particles.emitLaserMuzzle(frame.position, frame.carry);
      if (hitSomething) {
        fx.particles.emitLaserImpact(this.end, dir, deltaTime, surface);
      }
    }

    if (runtime.heat >= 1) {
      runtime.overheated = true;
      this.stop(runtime.id);
      // 过热：枪口喷出一团蒸汽
      if (fx) {
        this.hitPoint.copy(frame.carry).multiplyScalar(0.6);
        this.hitPoint.y += 3;
        fx.particles.emitPuff(frame.position, this.hitPoint, 1.2, 5.5, 1.3, OVERHEAT_STEAM, 0.5);
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
      fx?.particles.emitRailImpact(this.point, dir);
    }
    this.hits.length = 0;

    this.end.copy(this.origin).addScaledVector(dir, maxT);
    if (surface !== 'air') {
      this.ctx.emitImpact(runtime.id, this.end, 0.6 + charge * 0.5);
      fx?.particles.emitDetonation(this.end, 0.45 + charge * 0.35, surface, 'swarm');
      fx?.particles.emitRailImpact(this.end, dir);
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
      fx?.particles.emitStunCrackle(
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
