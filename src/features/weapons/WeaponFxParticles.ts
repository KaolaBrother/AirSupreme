import * as THREE from 'three';
import { createParticleSpec, type WeaponParticleField } from './WeaponParticleField';

/**
 * 特殊武器的粒子配方（尾迹、口焰、爆炸、火花、灼烧点、电弧……）。
 * 只往两个 GPU 粒子场（普通混合烟 / 加色光）里发射粒子，不持有任何网格；
 * WeaponFx 负责网格对象池（弹体、光束、冲击环、EMP 球壳）并调用这里的配方。
 */

export type FxSurface = 'air' | 'ground' | 'water';
export type FxDetonationPalette = 'rocket' | 'swarm';

/** 线性 HDR 色板（>1 的分量配合加色混合与泛光呈现“白热”） */
export const FX_COLORS = {
  rocketExhaust: new THREE.Color(2.4, 1.05, 0.32),
  swarmExhaust: new THREE.Color(2.2, 1.7, 1.05),
  rocketSmoke: new THREE.Color(0.74, 0.73, 0.71),
  swarmSmoke: new THREE.Color(0.9, 0.91, 0.93),
  fireball: new THREE.Color(2.2, 0.85, 0.22),
  fireFlash: new THREE.Color(3.2, 2.4, 1.5),
  spark: new THREE.Color(2.6, 1.5, 0.55),
  darkSmoke: new THREE.Color(0.2, 0.19, 0.18),
  dust: new THREE.Color(0.45, 0.39, 0.31),
  spray: new THREE.Color(0.82, 0.9, 0.98),
  laser: new THREE.Color(2.6, 0.18, 0.42),
  laserCore: new THREE.Color(3.2, 2.3, 2.5),
  laserSpark: new THREE.Color(2.8, 1.2, 0.6),
  laserHot: new THREE.Color(2.9, 1.1, 0.25),
  rail: new THREE.Color(1.1, 0.75, 2.8),
  railCore: new THREE.Color(2.6, 2.6, 3.4),
  railSpiral: new THREE.Color(0.85, 0.55, 2.5),
  railRing: new THREE.Color(0.62, 0.42, 1.7),
  railIon: new THREE.Color(0.42, 0.24, 1.05),
  emp: new THREE.Color(0.45, 1.6, 2.6),
  empCore: new THREE.Color(1.6, 2.6, 3.2),
} as const;

export class WeaponFxParticles {
  private readonly smoke: WeaponParticleField;
  private readonly glow: WeaponParticleField;
  private readonly spec = createParticleSpec();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly basisU = new THREE.Vector3();
  private readonly basisW = new THREE.Vector3();
  /** 枪口特效缩放（第一人称 0.35） */
  public muzzleScale = 1;
  /**
   * 第一人称（WeaponFx.setFirstPerson 写入，弹体控制器也读它）：省略贴近镜头的枪口辉光，
   * 减弱火箭近段尾烟与刚离架的喷口光点
   */
  public firstPerson = false;

  constructor(smoke: WeaponParticleField, glow: WeaponParticleField) {
    this.smoke = smoke;
    this.glow = glow;
  }

  /**
   * 火箭 / 微型导弹尾迹：沿本帧位移等距补点（老的点按比例回拨出生时间），
   * 加上喷口处随弹体同速移动的白热光点。
   */
  public emitTrail(
    kind: 'rocket' | 'swarm',
    from: THREE.Vector3,
    to: THREE.Vector3,
    velocity: THREE.Vector3,
    deltaTime: number,
    carry: { value: number },
    age: number
  ): void {
    const isRocket = kind === 'rocket';
    const spacing = (isRocket ? 1.5 : 0.95) / this.smoke.getDensity();
    const distance = from.distanceTo(to);
    const spec = this.spec;
    // 火箭尾烟：末端直径 3.6–5.0 m、不透明度 0.34。第一人称时，离机不久的那段烟会被载机追上、
    // 横掠过座舱 —— 减到 2.2–3.0 m、0.18；飞远之后（nearSmoke → 0）恢复原样
    const nearSmoke = this.firstPerson
      ? 1 - THREE.MathUtils.smoothstep(age, FIRST_PERSON_TRAIL_NEAR_AGE, FIRST_PERSON_TRAIL_FAR_AGE)
      : 0;
    const rocketSmokeSize = THREE.MathUtils.lerp(3.6, 2.2, nearSmoke);
    const rocketSmokeSpread = THREE.MathUtils.lerp(1.4, 0.8, nearSmoke);
    const rocketSmokeAlpha = THREE.MathUtils.lerp(0.34, 0.18, nearSmoke);
    if (distance > 1e-4 && Number.isFinite(distance)) {
      let travelled = carry.value;
      while (travelled < distance) {
        const f = travelled / distance;
        spec.position.lerpVectors(from, to, f);
        spec.velocity.set(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.6
        );
        spec.velocity.addScaledVector(velocity, 0.035);
        spec.delay = -(1 - f) * deltaTime;
        if (isRocket) {
          spec.life = 1.3 + Math.random() * 0.7;
          spec.size0 = 1.5;
          spec.size1 = rocketSmokeSize + Math.random() * rocketSmokeSpread;
          spec.color.copy(COLORS.rocketSmoke).multiplyScalar(0.88 + Math.random() * 0.2);
          spec.alpha = rocketSmokeAlpha;
          spec.heat = 0.14;
        } else {
          spec.life = 0.85 + Math.random() * 0.45;
          spec.size0 = 0.95;
          spec.size1 = 2 + Math.random() * 0.8;
          spec.color.copy(COLORS.swarmSmoke).multiplyScalar(0.92 + Math.random() * 0.12);
          spec.alpha = 0.3;
          spec.heat = 0.1;
        }
        spec.drag = 1.6;
        spec.gravity = 0.7;
        spec.stretch = 0;
        spec.fade = 1.25;
        this.smoke.emit(spec);
        travelled += spacing;
      }
      carry.value = travelled - distance;
    }

    // 喷口白热光点（与弹体同速移动，寿命极短）
    this.tmpA.copy(velocity);
    const speed = this.tmpA.length();
    if (speed > 1e-4) {
      this.tmpA.divideScalar(speed);
      spec.position.copy(to).addScaledVector(this.tmpA, isRocket ? -0.75 : -0.45);
      spec.velocity.copy(velocity);
      spec.delay = 0;
      spec.life = 0.06;
      // 点火渐亮：第一人称时弹体刚离架还在镜头旁，光点起步更小、亮起更慢（约 0.25 s 后与第三人称一致）
      const ignition = Math.min(1, age * (this.firstPerson ? 4 : 8));
      const ignitionFloor = this.firstPerson ? 0.3 : 0.6;
      spec.size0 =
        (isRocket ? 2.2 : 1.0) *
        (0.85 + Math.random() * 0.3) *
        (ignitionFloor + ignition * (1 - ignitionFloor));
      spec.size1 = spec.size0 * 0.7;
      spec.color.copy(isRocket ? COLORS.rocketExhaust : COLORS.swarmExhaust);
      spec.alpha = 0.95;
      spec.drag = 0;
      spec.gravity = 0;
      spec.stretch = isRocket ? 0.012 : 0.006;
      spec.fade = 1;
      spec.heat = 0.6;
      this.glow.emit(spec);
    }
  }

  /** 发射口焰：火光 + 一团发射烟（carry = 载机速度，避免火光被甩在身后） */
  public emitMuzzleFlash(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    carry: THREE.Vector3,
    color: THREE.Color,
    scale: number
  ): void {
    const spec = this.spec;
    scale *= this.muzzleScale;
    spec.position.copy(position);
    spec.velocity.copy(carry).addScaledVector(direction, 6);
    spec.delay = 0;
    spec.life = 0.09;
    spec.size0 = 2.6 * scale;
    spec.size1 = 1.4 * scale;
    spec.color.copy(color);
    spec.alpha = 1;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 1.2;
    spec.heat = 0.8;
    this.glow.emit(spec);

    spec.velocity.copy(carry).multiplyScalar(0.55).addScaledVector(direction, 4);
    spec.life = 0.9 + Math.random() * 0.4;
    spec.size0 = 0.9 * scale;
    spec.size1 = 3.4 * scale;
    spec.color.copy(COLORS.rocketSmoke);
    spec.alpha = 0.32;
    spec.drag = 2.4;
    spec.gravity = 0.5;
    spec.fade = 1.4;
    spec.heat = 0.1;
    this.smoke.emit(spec);
  }

  /** 火箭 / 蜂群导弹爆炸：闪光 + 火球 + 火花 + 浓烟（地面加尘土，水面加水花） */
  public emitDetonation(
    position: THREE.Vector3,
    scale: number,
    surface: FxSurface,
    palette: FxDetonationPalette
  ): void {
    const s = THREE.MathUtils.clamp(scale, 0.4, 3);
    const spec = this.spec;
    const glow = this.glow;
    const smoke = this.smoke;

    // 核心闪光
    spec.position.copy(position);
    spec.velocity.set(0, 0, 0);
    spec.delay = 0;
    spec.life = 0.14;
    spec.size0 = 7 * s;
    spec.size1 = 11 * s;
    spec.color.copy(COLORS.fireFlash);
    spec.alpha = 1;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 1.6;
    spec.heat = 1;
    glow.emit(spec);

    // 火球
    const fireballs = glow.scaledCount((palette === 'rocket' ? 6 : 4) * s, 2);
    for (let i = 0; i < fireballs; i++) {
      randomUnit(spec.velocity).multiplyScalar((6 + Math.random() * 10) * s);
      if (surface !== 'air') spec.velocity.y = Math.abs(spec.velocity.y) + 3 * s;
      spec.life = 0.38 + Math.random() * 0.3;
      spec.size0 = (3 + Math.random() * 1.8) * s;
      spec.size1 = (5.5 + Math.random() * 3.5) * s;
      spec.color.copy(COLORS.fireball).multiplyScalar(0.8 + Math.random() * 0.4);
      spec.alpha = 0.9;
      spec.drag = 4.5;
      spec.gravity = 2.5;
      spec.fade = 1.35;
      spec.heat = 0.35;
      spec.delay = Math.random() * 0.04;
      glow.emit(spec);
    }

    // 火花流光
    const sparks = glow.scaledCount((palette === 'rocket' ? 12 : 8) * s, 3);
    for (let i = 0; i < sparks; i++) {
      randomUnit(spec.velocity).multiplyScalar((22 + Math.random() * 28) * Math.sqrt(s));
      if (surface !== 'air' && spec.velocity.y < 0) spec.velocity.y *= -0.6;
      spec.life = 0.35 + Math.random() * 0.5;
      spec.size0 = 0.32;
      spec.size1 = 0.18;
      spec.color.copy(COLORS.spark);
      spec.alpha = 1;
      spec.drag = 1.4;
      spec.gravity = -16;
      spec.stretch = 0.035;
      spec.fade = 1.1;
      spec.heat = 0.25;
      spec.delay = 0;
      glow.emit(spec);
    }
    spec.stretch = 0;

    // 浓烟
    const puffs = smoke.scaledCount((palette === 'rocket' ? 5 : 3) * s, 2);
    for (let i = 0; i < puffs; i++) {
      randomUnit(spec.velocity).multiplyScalar((2.5 + Math.random() * 4) * s);
      spec.velocity.y = Math.abs(spec.velocity.y) * 0.6 + 1.5;
      spec.position.copy(position).addScaledVector(spec.velocity, 0.12);
      spec.life = 1.8 + Math.random() * 1.1;
      spec.size0 = 2 * s;
      spec.size1 = (6 + Math.random() * 3) * s;
      spec.color.copy(COLORS.darkSmoke).multiplyScalar(0.85 + Math.random() * 0.4);
      spec.alpha = 0.62;
      spec.drag = 1.6;
      spec.gravity = 1.1;
      spec.fade = 1.2;
      spec.heat = 0.16;
      spec.delay = 0.03 + Math.random() * 0.05;
      smoke.emit(spec);
    }

    if (surface === 'ground') {
      const dust = smoke.scaledCount(5 * s, 2);
      for (let i = 0; i < dust; i++) {
        spec.position.copy(position);
        spec.velocity.set(
          (Math.random() - 0.5) * 10 * s,
          (7 + Math.random() * 9) * s,
          (Math.random() - 0.5) * 10 * s
        );
        spec.life = 1.4 + Math.random() * 0.9;
        spec.size0 = 1.6 * s;
        spec.size1 = (5.5 + Math.random() * 2.5) * s;
        spec.color.copy(COLORS.dust).multiplyScalar(0.85 + Math.random() * 0.3);
        spec.alpha = 0.7;
        spec.drag = 2.2;
        spec.gravity = -3;
        spec.fade = 1.1;
        spec.heat = 0;
        spec.delay = Math.random() * 0.06;
        smoke.emit(spec);
      }
    } else if (surface === 'water') {
      // 白色水柱（普通混合，蓝色海面上清晰可见）
      const column = smoke.scaledCount(9 * s, 4);
      for (let i = 0; i < column; i++) {
        spec.position.copy(position);
        spec.velocity.set(
          (Math.random() - 0.5) * 5 * s,
          (10 + Math.random() * 18) * s,
          (Math.random() - 0.5) * 5 * s
        );
        spec.life = 1.1 + Math.random() * 0.6;
        spec.size0 = 1.6 * s;
        spec.size1 = (4.5 + Math.random() * 2) * s;
        spec.color.copy(COLORS.spray);
        spec.alpha = 0.75;
        spec.drag = 1.1;
        spec.gravity = -14;
        spec.stretch = 0;
        spec.fade = 1.6;
        spec.heat = 0;
        spec.delay = Math.random() * 0.05;
        smoke.emit(spec);
      }
      const spray = glow.scaledCount(10 * s, 3);
      for (let i = 0; i < spray; i++) {
        spec.position.copy(position);
        spec.velocity.set(
          (Math.random() - 0.5) * 9 * s,
          (14 + Math.random() * 16) * s,
          (Math.random() - 0.5) * 9 * s
        );
        spec.life = 0.8 + Math.random() * 0.5;
        spec.size0 = 0.9 * s;
        spec.size1 = 2.2 * s;
        spec.color.copy(COLORS.spray).multiplyScalar(0.5);
        spec.alpha = 0.8;
        spec.drag = 0.6;
        spec.gravity = -20;
        spec.stretch = 0.02;
        spec.fade = 1.2;
        spec.heat = 0;
        spec.delay = Math.random() * 0.05;
        glow.emit(spec);
      }
      spec.stretch = 0;
      const mist = smoke.scaledCount(4 * s, 2);
      for (let i = 0; i < mist; i++) {
        spec.position.copy(position);
        randomUnit(spec.velocity).multiplyScalar(4 * s);
        spec.velocity.y = Math.abs(spec.velocity.y) + 3;
        spec.life = 1.6 + Math.random() * 0.8;
        spec.size0 = 2.5 * s;
        spec.size1 = 7 * s;
        spec.color.copy(COLORS.spray);
        spec.alpha = 0.45;
        spec.drag = 1.8;
        spec.gravity = 0.3;
        spec.fade = 1.2;
        spec.heat = 0;
        spec.delay = 0.05;
        smoke.emit(spec);
      }
    }
  }

  /** 通用命中火花（流光沿 normal 半球飞散） */
  public emitSparks(
    position: THREE.Vector3,
    normal: THREE.Vector3 | null,
    count: number,
    color: THREE.Color,
    speed: number,
    life: number,
    size = 0.3
  ): void {
    const spec = this.spec;
    const total = this.glow.scaledCount(count, 1);
    for (let i = 0; i < total; i++) {
      randomUnit(spec.velocity);
      if (normal && spec.velocity.dot(normal) < 0) {
        spec.velocity.addScaledVector(normal, -2 * spec.velocity.dot(normal));
      }
      spec.velocity.multiplyScalar(speed * (0.45 + Math.random() * 0.75));
      spec.position.copy(position);
      spec.delay = 0;
      spec.life = life * (0.6 + Math.random() * 0.7);
      spec.size0 = size;
      spec.size1 = size * 0.45;
      spec.color.copy(color);
      spec.alpha = 1;
      spec.drag = 1.2;
      spec.gravity = -18;
      spec.stretch = 0.032;
      spec.fade = 1;
      spec.heat = 0.3;
      this.glow.emit(spec);
    }
    spec.stretch = 0;
  }

  /** 单个加色光斑（命中点 / 枪口辉光） */
  public emitFlash(
    position: THREE.Vector3,
    velocity: THREE.Vector3 | null,
    size: number,
    life: number,
    color: THREE.Color,
    heat = 0.8
  ): void {
    const spec = this.spec;
    spec.position.copy(position);
    if (velocity) spec.velocity.copy(velocity);
    else spec.velocity.set(0, 0, 0);
    spec.delay = 0;
    spec.life = life;
    spec.size0 = size;
    spec.size1 = size * 0.8;
    spec.color.copy(color);
    spec.alpha = 1;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 1.2;
    spec.heat = heat;
    this.glow.emit(spec);
  }

  /** 单团烟（命中点灼烧烟 / 蓄力余烟） */
  public emitPuff(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    size0: number,
    size1: number,
    life: number,
    color: THREE.Color,
    alpha: number,
    heat = 0
  ): void {
    const spec = this.spec;
    spec.position.copy(position);
    spec.velocity.copy(velocity);
    spec.delay = 0;
    spec.life = life;
    spec.size0 = size0;
    spec.size1 = size1;
    spec.color.copy(color);
    spec.alpha = alpha;
    spec.drag = 1.4;
    spec.gravity = 1.2;
    spec.stretch = 0;
    spec.fade = 1.2;
    spec.heat = heat;
    this.smoke.emit(spec);
  }

  /** 激光枪口辉光（跟随载机） */
  public emitLaserMuzzle(position: THREE.Vector3, carry: THREE.Vector3): void {
    // 第一人称：枪口辉光就在镜头下方，直接省略
    if (this.firstPerson) return;
    this.emitFlash(
      position,
      carry,
      (2 + Math.random() * 0.8) * this.muzzleScale,
      0.05,
      COLORS.laser,
      0.9
    );
  }

  /** 激光灼烧点：白热光斑 + 熔融火花 + 灼烧烟（按帧调用，内部按时间节流烟团） */
  public emitLaserImpact(
    position: THREE.Vector3,
    beamDirection: THREE.Vector3,
    deltaTime: number,
    surface: FxSurface
  ): void {
    this.tmpB.copy(beamDirection).multiplyScalar(-1);
    this.emitFlash(position, null, 2.6 + Math.random() * 1.2, 0.05, COLORS.laserCore, 1);
    this.emitFlash(position, null, 6.5 + Math.random() * 2, 0.06, COLORS.laser, 0.3);
    const sparkRate = surface === 'water' ? 30 : 90;
    const sparks = randomCount(sparkRate * deltaTime);
    if (sparks > 0) {
      this.emitSparks(position, this.tmpB, sparks, COLORS.laserSpark, 38, 0.6, 0.5);
    }
    if (Math.random() < deltaTime * 14) {
      this.tmpC.set(
        (Math.random() - 0.5) * 1.5,
        2.5 + Math.random() * 2,
        (Math.random() - 0.5) * 1.5
      );
      if (surface === 'water') {
        this.emitPuff(position, this.tmpC, 1.2, 4.5, 1.1, COLORS.spray, 0.35);
      } else {
        this.emitPuff(position, this.tmpC, 0.9, 4, 1.4, COLORS.darkSmoke, 0.5, 0.2);
      }
    }
  }

  /** 轨道炮贯穿命中：电紫闪光 + 火花 */
  public emitRailImpact(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.emitFlash(position, null, 7, 0.12, COLORS.railCore, 1);
    this.emitFlash(position, null, 11, 0.18, COLORS.rail, 0.2);
    this.tmpB.copy(direction).multiplyScalar(-1);
    this.emitSparks(position, this.tmpB, 10, COLORS.railSpiral, 40, 0.45, 0.5);
    this.emitSparks(position, direction, 10, COLORS.spark, 52, 0.6, 0.55);
  }

  /** 被 EMP 瘫痪的目标：短促电弧火花 + 青色闪光 */
  public emitStunCrackle(position: THREE.Vector3, radius: number, delay: number): void {
    const spec = this.spec;
    const r = THREE.MathUtils.clamp(radius, 1, 20);
    // 三次逐渐减弱的电弧爆闪，持续约 0.9 秒，清楚标示被瘫痪的目标
    for (let burst = 0; burst < 3; burst++) {
      const burstDelay = delay + burst * 0.3 + Math.random() * 0.06;
      spec.position.copy(position);
      spec.velocity.set(0, 0, 0);
      spec.delay = burstDelay;
      spec.life = 0.2;
      spec.size0 = r * (1.5 - burst * 0.3);
      spec.size1 = spec.size0 * 0.75;
      spec.color.copy(COLORS.emp);
      spec.alpha = 1 - burst * 0.2;
      spec.drag = 0;
      spec.gravity = 0;
      spec.stretch = 0;
      spec.fade = 1.3;
      spec.heat = 0.6;
      this.glow.emit(spec);
      const sparks = this.glow.scaledCount(7 - burst * 2, 2);
      for (let i = 0; i < sparks; i++) {
        randomUnit(this.tmpA);
        spec.position.copy(position).addScaledVector(this.tmpA, r * 0.6);
        spec.velocity.copy(this.tmpA).multiplyScalar(10 + Math.random() * 18);
        spec.delay = burstDelay + Math.random() * 0.12;
        spec.life = 0.2 + Math.random() * 0.25;
        spec.size0 = 0.35;
        spec.size1 = 0.15;
        spec.color.copy(COLORS.empCore);
        spec.alpha = 1;
        spec.drag = 2;
        spec.gravity = -6;
        spec.stretch = 0.03;
        spec.fade = 0.8;
        spec.heat = 0.4;
        this.glow.emit(spec);
      }
    }
    spec.stretch = 0;
  }

  /** 轨道炮蓄力：枪口能量球 + 被吸入的电离流光 + 满蓄力电弧；motes=false 时不发射流光 */
  public emitRailCharge(
    position: THREE.Vector3,
    forward: THREE.Vector3,
    carry: THREE.Vector3,
    c: number,
    deltaTime: number,
    time: number,
    motes: boolean
  ): void {
    // 枪口能量球：白热小核 + 电紫光晕，随蓄力增大并脉动
    const pulse = (0.85 + 0.15 * Math.sin(time * (18 + c * 24))) * this.muzzleScale;
    this.emitFlash(position, carry, (0.5 + c * 1.3) * pulse, 0.05, COLORS.railCore, 0.6 + c * 0.4);
    this.emitFlash(position, carry, (1.6 + c * 3) * pulse, 0.05, COLORS.railRing, 0.1);
    const spec = this.spec;
    const count = motes ? randomCount((30 + c * 70) * deltaTime * this.glow.getDensity()) : 0;
    for (let i = 0; i < count; i++) {
      // 电离粒子从四周被吸向枪口（流光细线）
      const distance = 2.5 + Math.random() * 4.5;
      randomUnit(this.tmpA);
      spec.position.copy(position).addScaledVector(this.tmpA, distance);
      const life = 0.16 + Math.random() * 0.1;
      spec.velocity
        .copy(this.tmpA)
        .multiplyScalar(-distance / life)
        .add(carry);
      spec.delay = 0;
      spec.life = life;
      spec.size0 = 0.14 + c * 0.08;
      spec.size1 = 0.22 + c * 0.1;
      spec.color.copy(i % 4 === 0 ? COLORS.railCore : COLORS.railRing);
      spec.alpha = 0.95;
      spec.drag = 0;
      spec.gravity = 0;
      spec.stretch = 0.018;
      spec.fade = 0.5;
      spec.heat = 0.3;
      this.glow.emit(spec);
    }
    spec.stretch = 0;
    // 满蓄力：炮管电弧闪烁
    if (c >= 0.999 && Math.random() < deltaTime * 20) {
      this.tmpB.copy(position).addScaledVector(forward, 1.2);
      this.emitSparks(this.tmpB, forward, 3, COLORS.railCore, 12, 0.18, 0.22);
    }
  }

  /** 轨道炮螺旋电离尾迹：dir 为单位弹道方向，近处密、远处疏 */
  public emitRailHelix(start: THREE.Vector3, dir: THREE.Vector3, length: number, c: number): void {
    buildBasis(dir, this.basisU, this.basisW);
    const spec = this.spec;
    const helixRadius = 0.7 + c * 0.5;
    const pitch = 3.4;
    const maxPoints = Math.round(240 * this.glow.getDensity());
    let s = 1.5;
    let emitted = 0;
    while (s < length && emitted < maxPoints) {
      const theta = (s / pitch) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      this.tmpA.copy(this.basisU).multiplyScalar(cos).addScaledVector(this.basisW, sin);
      spec.position.copy(start).addScaledVector(dir, s).addScaledVector(this.tmpA, helixRadius);
      spec.velocity.copy(this.tmpA).multiplyScalar(1.6 + Math.random() * 0.8);
      spec.delay = s / 2600;
      spec.stretch = 0;
      spec.gravity = 0;
      // 电离紫色螺旋（普通混合，任何背景下都保留色相）
      spec.life = 0.6 + Math.random() * 0.35 + c * 0.25;
      spec.size0 = 0.75;
      spec.size1 = 1.7;
      spec.color.copy(COLORS.railIon).multiplyScalar(0.9 + Math.random() * 0.25);
      spec.alpha = 0.62;
      spec.drag = 1.5;
      spec.fade = 1.2;
      spec.heat = 0;
      this.smoke.emit(spec);
      // 白热电火花点缀
      if (emitted % 3 === 0) {
        spec.life = 0.35 + Math.random() * 0.25;
        spec.size0 = 0.6;
        spec.size1 = 0.9;
        spec.color.copy(COLORS.railSpiral);
        spec.alpha = 0.9;
        spec.drag = 1.5;
        spec.fade = 1.3;
        spec.heat = 0.3;
        this.glow.emit(spec);
      }
      emitted++;
      // 近处密、远处疏：远处在屏幕上很小，不必逐米补点
      s += 0.55 + s * 0.006;
    }
  }

  /** 轨道炮炮口：强闪光 + 余烟 */
  public emitRailMuzzle(start: THREE.Vector3, dir: THREE.Vector3, c: number): void {
    const m = this.muzzleScale;
    this.emitFlash(start, null, (2.6 + c * 1.6) * m, 0.1, COLORS.railCore, 1);
    this.emitFlash(start, null, (4.5 + c * 2) * m, 0.14, COLORS.railRing, 0.2);
    this.tmpC.copy(dir).multiplyScalar(3);
    this.emitPuff(start, this.tmpC, 1, 4.5, 1, COLORS.swarmSmoke, 0.28);
  }

  /** EMP 中心闪光 + 放射状电火花 */
  public emitEmpBurst(center: THREE.Vector3, radius: number): void {
    // 中心闪光克制一些：玩家就在球心，追尾镜头只在 16 米外（泛光会把光团放大成整片白），
    // 第一人称时镜头就在闪光里，只留电火花
    if (!this.firstPerson) {
      this.emitFlash(center, null, 3.5, 0.14, COLORS.empCore, 0.4);
      this.emitFlash(center, null, 7, 0.24, EMP_HALO, 0.15);
    }
    const spec = this.spec;
    const arcs = this.glow.scaledCount(56, 16);
    for (let i = 0; i < arcs; i++) {
      randomUnit(this.tmpB);
      // 电火花从 18 米外起跳，沿冲击波向外飞散，不会贴着镜头划过
      spec.position.copy(center).addScaledVector(this.tmpB, 18 + Math.random() * 10);
      spec.velocity.copy(this.tmpB).multiplyScalar(radius * (0.7 + Math.random() * 0.6));
      spec.delay = Math.random() * 0.08;
      spec.life = 0.65 + Math.random() * 0.35;
      spec.size0 = 0.55;
      spec.size1 = 0.22;
      spec.color.copy(i % 3 === 0 ? COLORS.empCore : COLORS.emp);
      spec.alpha = 1;
      spec.drag = 2.4;
      spec.gravity = 0;
      spec.stretch = 0.012;
      spec.fade = 0.9;
      spec.heat = 0.35;
      this.glow.emit(spec);
    }
    spec.stretch = 0;
  }
}

const COLORS = FX_COLORS;
/** EMP 中心外晕（比冲击波电光色暗一档） */
const EMP_HALO = FX_COLORS.emp.clone().multiplyScalar(0.45);
/**
 * 第一人称火箭尾烟减弱的弹龄窗口（秒）：0.6 s 内（离机约 105 m）发出的烟会在消散前被载机追上，
 * 全额减弱；到 1.2 s 平滑恢复，远处的尾迹与第三人称一致。
 */
const FIRST_PERSON_TRAIL_NEAR_AGE = 0.6;
const FIRST_PERSON_TRAIL_FAR_AGE = 1.2;

/** 由期望数量（可为小数）随机取整：期望值不变，低帧率 / 高帧率下发射率一致 */
function randomCount(expected: number): number {
  if (!(expected > 0)) return 0;
  const base = Math.floor(expected);
  return base + (Math.random() < expected - base ? 1 : 0);
}

/** 构造与 dir 正交的单位基 u、w */
function buildBasis(dir: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3): void {
  if (Math.abs(dir.y) < 0.95) {
    u.set(0, 1, 0);
  } else {
    u.set(1, 0, 0);
  }
  w.crossVectors(dir, u).normalize();
  u.crossVectors(w, dir).normalize();
}

/** 随机单位向量（写入 out） */
function randomUnit(out: THREE.Vector3): THREE.Vector3 {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return out.set(r * Math.cos(theta), u, r * Math.sin(theta));
}
