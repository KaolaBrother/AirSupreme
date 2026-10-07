import * as THREE from 'three';
import type { DecoyPoint, IDecoyProvider } from '@/core/CombatContracts';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { createParticleSpec, WeaponParticleField } from './WeaponParticleField';
import { isFiniteVector } from './WeaponTargeting';

/**
 * 热焰弹反制系统（实现 IDecoyProvider）
 *
 * - 充能制：默认 2 次，每 12 秒恢复 1 次（可由升级调整）；
 * - deploy() 从机尾两侧抛出一扇 6 枚燃烧的镁热焰弹，带着火花与浓白烟迹
 *   在飞机后下方坠落约 3.6 秒；
 * - getActiveDecoys() 返回燃烧中热焰弹的实时位置与诱骗强度（随燃尽衰减），
 *   SAM / Boss 导弹据此偏转。
 *
 * scene 为 null 时只运行逻辑（诱饵坐标照常计算）。
 */

const DEFAULT_CAPACITY = 2;
const DEFAULT_RECHARGE = 12;
const FLARES_PER_DEPLOY = 6;
const FLARE_POOL_SIZE = 48;
const FLARE_BURN_TIME = 3.6;
/** 未提供载机速度时假定的前飞速度（米/秒，与玩家基础速度一致） */
const ASSUMED_CARRY_SPEED = 45;
const FLARE_DRAG = 1.1;
const FLARE_GRAVITY = 9.8;
/** 每枚热焰弹的烟迹间距（米） */
const SMOKE_SPACING = 1.25;

interface Flare {
  active: boolean;
  position: THREE.Vector3;
  prevPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  burnTime: number;
  seed: number;
  smokeCarry: number;
}

const FLARE_CORE = new THREE.Color(3.2, 2.7, 2.1);
const FLARE_HALO = new THREE.Color(2.1, 1.05, 0.42);
const FLARE_SPARK = new THREE.Color(2.6, 1.55, 0.7);
const FLARE_SMOKE = new THREE.Color(0.93, 0.93, 0.95);

export class CountermeasureSystem implements IDecoyProvider {
  private readonly scene: THREE.Scene | null;
  private readonly particleSystem: ParticleSystem | null;
  private maxCharges = DEFAULT_CAPACITY;
  private charges = DEFAULT_CAPACITY;
  private rechargeTime = DEFAULT_RECHARGE;
  private rechargeTimer = 0;
  private readonly flares: Flare[] = [];
  private decoys: DecoyPoint[] = [];

  // 视觉（仅在有场景时创建）
  private readonly root: THREE.Group | null;
  private readonly smoke: WeaponParticleField | null;
  private readonly glow: WeaponParticleField | null;
  private attached = false;
  private time = 0;

  private readonly spec = createParticleSpec();
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();
  private readonly tmpUp = new THREE.Vector3();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();

  public onDeployed?: () => void;

  constructor(scene: THREE.Scene | null, particleSystem: ParticleSystem | null) {
    this.scene = scene;
    this.particleSystem = particleSystem;
    for (let i = 0; i < FLARE_POOL_SIZE; i++) {
      this.flares.push({
        active: false,
        position: new THREE.Vector3(),
        prevPosition: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        burnTime: FLARE_BURN_TIME,
        seed: 0,
        smokeCarry: 0,
      });
    }
    if (scene) {
      this.root = new THREE.Group();
      this.root.name = 'countermeasure-flares';
      this.smoke = new WeaponParticleField(1400, 'smoke');
      this.glow = new WeaponParticleField(1600, 'glow');
      this.root.add(this.smoke.mesh, this.glow.mesh);
    } else {
      this.root = null;
      this.smoke = null;
      this.glow = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 充能
  // ---------------------------------------------------------------------------

  /** 充能上限（默认 2；升级后 2..6） */
  public setCapacity(maxCharges: number): void {
    const next = Number.isFinite(maxCharges)
      ? Math.max(0, Math.floor(maxCharges))
      : DEFAULT_CAPACITY;
    const wasFull = this.charges >= this.maxCharges;
    this.maxCharges = next;
    // 原本满充能则保持满充能；否则只钳制到新上限
    this.charges = wasFull ? next : Math.min(this.charges, next);
    if (this.charges >= this.maxCharges) this.rechargeTimer = 0;
  }

  /** 恢复 1 次充能所需秒数（默认 12） */
  public setRechargeTime(seconds: number): void {
    this.rechargeTime =
      Number.isFinite(seconds) && seconds > 0 ? Math.max(0.5, seconds) : DEFAULT_RECHARGE;
  }

  public getCharges(): number {
    return this.charges;
  }

  public getMaxCharges(): number {
    return this.maxCharges;
  }

  /** 0..1：下一次充能的进度（已满为 1） */
  public getRechargeProgress(): number {
    if (this.charges >= this.maxCharges) return 1;
    return Math.max(0, Math.min(1, this.rechargeTimer / this.rechargeTime));
  }

  // ---------------------------------------------------------------------------
  // 投放
  // ---------------------------------------------------------------------------

  /**
   * 投放一组热焰弹。origin 为机体位置，quaternion 为机体朝向（本地 -Z 为前）。
   * velocity（扩展，可选）为载机速度；缺省按机头方向 45 米/秒估算。
   * 没有充能时返回 false。
   */
  public deploy(
    origin: THREE.Vector3,
    quaternion: THREE.Quaternion,
    velocity?: THREE.Vector3
  ): boolean {
    if (this.charges < 1 || !origin || !quaternion || !isFiniteVector(origin)) {
      return false;
    }
    const q = quaternion;
    if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) {
      return false;
    }

    this.tmpForward.set(0, 0, -1).applyQuaternion(q).normalize();
    this.tmpRight.set(1, 0, 0).applyQuaternion(q).normalize();
    this.tmpUp.set(0, 1, 0).applyQuaternion(q).normalize();
    const carry = this.tmpB;
    if (velocity && isFiniteVector(velocity) && velocity.length() < 400) {
      carry.copy(velocity);
    } else {
      carry.copy(this.tmpForward).multiplyScalar(ASSUMED_CARRY_SPEED);
    }

    this.charges -= 1;
    let spawned = 0;
    for (const flare of this.flares) {
      if (spawned >= FLARES_PER_DEPLOY) break;
      if (flare.active) continue;
      const side = spawned % 2 === 0 ? 1 : -1;
      const rank = Math.floor(spawned / 2);
      // 扇形：左右对称，越往外越向侧下方
      const spread = 0.35 + rank * 0.42 + Math.random() * 0.12;
      this.tmpA
        .copy(this.tmpRight)
        .multiplyScalar(side * Math.sin(spread))
        .addScaledVector(this.tmpUp, -0.55 - rank * 0.12)
        .addScaledVector(this.tmpForward, -0.75)
        .normalize();

      flare.active = true;
      flare.age = 0;
      flare.burnTime = FLARE_BURN_TIME + (Math.random() - 0.5) * 0.5;
      flare.seed = Math.random();
      flare.smokeCarry = 0;
      flare.position
        .copy(origin)
        .addScaledVector(this.tmpRight, side * 0.9)
        .addScaledVector(this.tmpUp, -0.6)
        .addScaledVector(this.tmpForward, -2.2);
      flare.prevPosition.copy(flare.position);
      flare.velocity
        .copy(carry)
        .multiplyScalar(0.92)
        .addScaledVector(this.tmpA, 20 + Math.random() * 7);
      spawned++;
    }

    this.rebuildDecoys();
    if (this.root && this.glow) {
      this.attach();
      for (const flare of this.flares) {
        if (flare.active && flare.age === 0) {
          this.emitIgnition(flare);
        }
      }
      try {
        this.particleSystem?.createShockwave(origin, 7, 0.28, 0xffd9a0, 0.45);
      } catch {
        // 特效失败不影响诱饵逻辑
      }
    }
    this.onDeployed?.();
    return true;
  }

  // ---------------------------------------------------------------------------
  // 更新
  // ---------------------------------------------------------------------------

  public update(deltaTime: number): void {
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
    this.time += dt;
    this.smoke?.update(dt);
    this.glow?.update(dt);

    // 充能恢复
    if (this.charges < this.maxCharges) {
      this.rechargeTimer += dt;
      while (this.rechargeTimer >= this.rechargeTime && this.charges < this.maxCharges) {
        this.rechargeTimer -= this.rechargeTime;
        this.charges += 1;
      }
      if (this.charges >= this.maxCharges) this.rechargeTimer = 0;
    } else {
      this.rechargeTimer = 0;
    }

    // 热焰弹飞行：大步长分段积分，阻力 + 重力
    for (const flare of this.flares) {
      if (!flare.active) continue;
      let remaining = dt;
      while (remaining > 0 && flare.active) {
        const step = Math.min(remaining, 1 / 30);
        remaining -= step;
        this.stepFlare(flare, step);
      }
    }
    this.rebuildDecoys();
  }

  private stepFlare(flare: Flare, step: number): void {
    flare.prevPosition.copy(flare.position);
    flare.age += step;
    if (flare.age >= flare.burnTime) {
      flare.active = false;
      return;
    }
    const decay = Math.exp(-FLARE_DRAG * step);
    flare.velocity.multiplyScalar(decay);
    flare.velocity.y -= FLARE_GRAVITY * step;
    flare.position.addScaledVector(flare.velocity, step);
    if (!isFiniteVector(flare.position)) {
      flare.active = false;
      return;
    }
    if (this.glow && this.smoke) {
      this.emitBurning(flare, step);
    }
  }

  /** 燃烧强度 0..1：点燃瞬间即有诱骗力，末段快速衰减 */
  private getStrength(flare: Flare): number {
    if (!flare.active) return 0;
    const t = flare.age / flare.burnTime;
    const ignition = Math.min(1, 0.6 + flare.age * 4);
    return Math.max(0, Math.min(1, ignition * (1 - Math.pow(t, 2.2))));
  }

  /** 每次更新重建一次诱饵快照（返回的新数组在下一次 update 前保持不变） */
  private rebuildDecoys(): void {
    const decoys: DecoyPoint[] = [];
    for (const flare of this.flares) {
      if (!flare.active) continue;
      const strength = this.getStrength(flare);
      if (strength <= 0) continue;
      decoys.push({ position: flare.position.clone(), strength });
    }
    this.decoys = decoys;
  }

  public getActiveDecoys(): readonly DecoyPoint[] {
    return this.decoys;
  }

  // ---------------------------------------------------------------------------
  // 视觉
  // ---------------------------------------------------------------------------

  private attach(): void {
    if (!this.attached && this.scene && this.root) {
      this.scene.add(this.root);
      this.attached = true;
    }
  }

  private emitIgnition(flare: Flare): void {
    const glow = this.glow;
    if (!glow) return;
    const spec = this.spec;
    spec.position.copy(flare.position);
    spec.velocity.copy(flare.velocity);
    spec.delay = 0;
    spec.life = 0.12;
    spec.size0 = 7;
    spec.size1 = 3;
    spec.color.copy(FLARE_CORE);
    spec.alpha = 1;
    spec.drag = FLARE_DRAG;
    spec.gravity = -FLARE_GRAVITY;
    spec.stretch = 0;
    spec.fade = 1.4;
    spec.heat = 1;
    glow.emit(spec);
  }

  /** 燃烧中的热焰弹：白热核心 + 暖色光晕 + 下坠火花 + 浓白烟迹 */
  private emitBurning(flare: Flare, step: number): void {
    const glow = this.glow;
    const smoke = this.smoke;
    if (!glow || !smoke) return;
    const spec = this.spec;
    const strength = this.getStrength(flare);
    const flicker = 0.78 + 0.22 * Math.sin(this.time * 47 + flare.seed * 31) + Math.random() * 0.15;

    // 核心与光晕：随热焰弹同速移动，寿命略长于一个子步
    spec.position.copy(flare.position);
    spec.velocity.copy(flare.velocity);
    spec.delay = 0;
    spec.life = step * 1.6 + 0.02;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 0.5;
    spec.heat = 1;
    spec.size0 = (2.6 + flicker * 1.6) * (0.5 + strength * 0.5);
    spec.size1 = spec.size0;
    spec.color.copy(FLARE_CORE);
    spec.alpha = 0.55 + strength * 0.45;
    glow.emit(spec);
    spec.size0 = (7 + flicker * 3) * strength;
    spec.size1 = spec.size0;
    spec.color.copy(FLARE_HALO);
    spec.alpha = 0.32 * strength;
    spec.heat = 0;
    glow.emit(spec);

    // 火花：向下飘落的镁屑
    const sparkExpected = 38 * step * strength * glow.getDensity();
    let sparks = Math.floor(sparkExpected);
    if (Math.random() < sparkExpected - sparks) sparks++;
    for (let i = 0; i < sparks; i++) {
      spec.position.copy(flare.position);
      spec.velocity
        .copy(flare.velocity)
        .multiplyScalar(0.35)
        .add(
          this.tmpA
            .set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5)
            .multiplyScalar(9)
        );
      spec.life = 0.35 + Math.random() * 0.45;
      spec.size0 = 0.32;
      spec.size1 = 0.12;
      spec.color.copy(FLARE_SPARK);
      spec.alpha = 1;
      spec.drag = 1.5;
      spec.gravity = -12;
      spec.stretch = 0.03;
      spec.fade = 1;
      spec.heat = 0.4;
      glow.emit(spec);
    }
    spec.stretch = 0;

    // 烟迹：按飞行距离等距补点
    const distance = flare.prevPosition.distanceTo(flare.position);
    const spacing = SMOKE_SPACING / smoke.getDensity();
    let travelled = flare.smokeCarry;
    while (travelled < distance) {
      const f = distance > 1e-5 ? travelled / distance : 1;
      spec.position.lerpVectors(flare.prevPosition, flare.position, f);
      spec.velocity.set(
        (Math.random() - 0.5) * 1.2,
        0.4 + Math.random() * 0.6,
        (Math.random() - 0.5) * 1.2
      );
      spec.delay = -(1 - f) * step;
      spec.life = 2.2 + Math.random() * 1.1;
      spec.size0 = 0.7;
      spec.size1 = 4.2 + Math.random() * 1.8;
      spec.color.copy(FLARE_SMOKE).multiplyScalar(0.92 + Math.random() * 0.1);
      spec.alpha = 0.52 * (0.35 + strength * 0.65);
      spec.drag = 1.2;
      spec.gravity = 0.45;
      spec.fade = 1.15;
      spec.heat = 0.08;
      smoke.emit(spec);
      travelled += spacing;
    }
    flare.smokeCarry = travelled - distance;
  }

  // ---------------------------------------------------------------------------
  // 存档 / 生命周期
  // ---------------------------------------------------------------------------

  public exportState(): { charges: number } {
    return { charges: this.charges };
  }

  public importState(state: { charges: number }): void {
    const value = state && typeof state.charges === 'number' ? state.charges : NaN;
    this.charges = Number.isFinite(value)
      ? Math.max(0, Math.min(this.maxCharges, Math.floor(value)))
      : this.maxCharges;
    this.rechargeTimer = 0;
  }

  /** 熄灭所有热焰弹并移除特效（充能保留） */
  public clear(): void {
    for (const flare of this.flares) {
      flare.active = false;
    }
    this.decoys = [];
    this.smoke?.clear();
    this.glow?.clear();
    if (this.attached && this.scene && this.root) {
      this.scene.remove(this.root);
      this.attached = false;
    }
  }

  public dispose(): void {
    this.clear();
    this.smoke?.dispose();
    this.glow?.dispose();
    this.root?.clear();
    this.onDeployed = undefined;
  }
}
