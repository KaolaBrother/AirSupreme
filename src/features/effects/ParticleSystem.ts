import * as THREE from 'three';
import { GameConfig } from '@/config';
import {
  ParticleBatch,
  BATCH_MODE_BILLBOARD,
  BATCH_MODE_PLANAR,
  BATCH_MODE_STREAK,
} from './particles/ParticleBatch';
import { DebrisField } from './particles/DebrisField';
import {
  ParticleType,
  PARTICLE_HARD_CAP,
  computeDetailForPreset,
  computeParticleBudget,
} from './particles/ParticleTypes';
import type {
  HeavyWeaponImpactProfile,
  HitEffectProfile,
  ParticleEmitter,
  SpawnOptions,
  SurfaceImpactType,
} from './particles/ParticleTypes';
import { ARC_CELLS, FIRE_CELLS, SMOKE_CELLS, VfxCell } from './particles/VfxAtlas';
import {
  emitBossDeathExplosion,
  emitBossMissileExplosion,
  emitExplosion,
  emitFlakExplosion,
  emitHeavyWeaponImpact,
  emitHit,
  emitMissileImpact,
} from './particles/recipes/combatRecipes';
import {
  emitGroundImpact,
  emitSplash,
  emitWaterImpact,
} from './particles/recipes/environmentRecipes';
import {
  emitBossMissileTrail,
  emitDamageSmoke,
  emitMissileTrail,
  emitMuzzleFlash,
  emitTrail,
} from './particles/recipes/trailRecipes';
import {
  emitEmpBurst,
  emitLaserBeam,
  emitPickupBurst,
  emitTeleportIn,
  emitTeleportOut,
  emitTentacleExplosion,
} from './particles/recipes/specialRecipes';

export { ParticleType } from './particles/ParticleTypes';
export type {
  HeavyWeaponImpactProfile,
  HitEffectProfile,
  SpawnOptions,
  SurfaceImpactType,
} from './particles/ParticleTypes';
export { getVfxTextures } from './particles/LegacyVfxTextures';
export type { VfxTextures } from './particles/LegacyVfxTextures';

/** 各类型默认参数 */
interface TypeProfile {
  cells: readonly number[];
  additive: number;
  gravity: number;
  drag: number;
  sizeEnd: number;
  intensity: number;
  alpha: number;
  stretch: number;
}

const TYPE_PROFILES: Record<ParticleType, TypeProfile> = {
  [ParticleType.EXPLOSION]: {
    cells: [VfxCell.GLOW],
    additive: 1,
    gravity: 0.02,
    drag: 1.5,
    sizeEnd: 0.55,
    intensity: 3.2,
    alpha: 1,
    stretch: 0,
  },
  [ParticleType.FIRE]: {
    cells: FIRE_CELLS,
    additive: 1,
    gravity: -0.05,
    drag: 2.2,
    sizeEnd: 1.7,
    intensity: 2.4,
    alpha: 0.95,
    stretch: 0,
  },
  [ParticleType.SPARK]: {
    cells: [VfxCell.SPARK],
    additive: 1,
    gravity: 0.45,
    drag: 0.9,
    sizeEnd: 0.5,
    intensity: 3,
    alpha: 1,
    stretch: 0.045,
  },
  [ParticleType.SMOKE]: {
    cells: SMOKE_CELLS,
    additive: 0,
    gravity: -0.12,
    drag: 0.7,
    sizeEnd: 2.6,
    intensity: 1,
    alpha: 0.62,
    stretch: 0,
  },
  [ParticleType.DEBRIS]: {
    cells: [VfxCell.GLOW],
    additive: 0,
    gravity: 1.15,
    drag: 0.35,
    sizeEnd: 1,
    intensity: 1,
    alpha: 1,
    stretch: 0,
  },
  [ParticleType.EMBER]: {
    cells: [VfxCell.GLOW],
    additive: 0.75,
    gravity: 1,
    drag: 0.4,
    sizeEnd: 0.6,
    intensity: 2.6,
    alpha: 1,
    stretch: 0.012,
  },
  [ParticleType.DUST]: {
    cells: SMOKE_CELLS,
    additive: 0,
    gravity: 0.08,
    drag: 1.6,
    sizeEnd: 2.8,
    intensity: 1,
    alpha: 0.7,
    stretch: 0,
  },
  [ParticleType.SPRAY]: {
    cells: [VfxCell.SPRAY],
    additive: 0,
    gravity: 1,
    drag: 0.6,
    sizeEnd: 2.2,
    intensity: 1,
    alpha: 0.85,
    stretch: 0,
  },
  [ParticleType.RING]: {
    cells: [VfxCell.RING],
    additive: 1,
    gravity: 0,
    drag: 0,
    sizeEnd: 6,
    intensity: 1.5,
    alpha: 0.85,
    stretch: 0,
  },
  [ParticleType.ELECTRIC]: {
    cells: ARC_CELLS,
    additive: 1,
    gravity: 0,
    drag: 0,
    sizeEnd: 1.1,
    intensity: 3,
    alpha: 1,
    stretch: 0,
  },
  [ParticleType.GLOW]: {
    cells: [VfxCell.GLOW],
    additive: 1,
    gravity: 0,
    drag: 1,
    sizeEnd: 1,
    intensity: 2,
    alpha: 1,
    stretch: 0,
  },
  [ParticleType.SCORCH]: {
    cells: SMOKE_CELLS,
    additive: 0,
    gravity: 0,
    drag: 0,
    sizeEnd: 1.12,
    intensity: 1,
    alpha: 0.55,
    stretch: 0,
  },
};

const WHITE_HOT = new THREE.Color(1, 0.96, 0.88);
const SOFT_GRAY = new THREE.Color(0.58, 0.58, 0.6);
const GRAVITY = -9.8;
const MAX_TRAIL_EMITS = 32;
const BUDGET_REFRESH_SECONDS = 0.5;

/**
 * 单个粒子（池化复用，渲染由 ParticleBatch 实例化完成）
 */
interface Particle {
  active: boolean;
  type: ParticleType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  axisFixed: boolean;
  life: number;
  maxLife: number;
  size: number;
  sizeEnd: number;
  rotation: number;
  spin: number;
  c0: THREE.Color;
  c1: THREE.Color;
  intensity: number;
  alpha: number;
  additive: number;
  cell: number;
  stretch: number;
  mode: number;
  gravityScale: number;
  drag: number;
  smokeTrail: boolean;
  trailTimer: number;
  seed: number;
}

interface DelayedBurst {
  remainingTime: number;
  emit: () => void;
}

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 粒子效果管理器（稳定外观层）。
 * - 后端：实例化单 draw call 批（预乘混合 + 视深排序）+ 实心碎片 InstancedMesh
 * - 预算：随画质预设与负载动态调整（getBudget）
 * - 配方：particles/recipes/* 分层电影化效果
 */
export class ParticleSystem {
  private scene: THREE.Scene;
  private readonly particleMeshes: THREE.Group;
  private readonly debrisGroup: THREE.Group;
  private readonly batch: ParticleBatch;
  private readonly debrisField: DebrisField;
  private readonly emitter: ParticleEmitter;

  private activeParticles: Particle[] = [];
  private particlePool: Particle[] = [];
  private totalParticles = 0;
  private delayedBursts: DelayedBurst[] = [];
  private budget: number;
  private qualityDetail: number;
  private budgetRefreshTimer = 0;
  private recycleCursor = 0;
  private elapsed = 0;
  private disposed = false;

  private readonly spawnDirection = new THREE.Vector3();
  private readonly rampColor = new THREE.Color();
  private readonly rampTarget = new THREE.Color();
  private readonly trailEmitQueue: THREE.Vector3[] = [];
  private trailEmitCount = 0;
  private readonly trailColor = new THREE.Color();
  private readonly onDebrisTrail = (position: THREE.Vector3): void => {
    if (this.trailEmitCount < MAX_TRAIL_EMITS) {
      this.trailEmitQueue[this.trailEmitCount++].copy(position);
    }
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleMeshes = new THREE.Group();
    this.particleMeshes.name = 'particles';
    this.scene.add(this.particleMeshes);

    this.debrisGroup = new THREE.Group();
    this.debrisGroup.name = 'particle-debris';
    this.scene.add(this.debrisGroup);

    this.budget = computeParticleBudget(GameConfig.getParticleCount());
    this.qualityDetail = this.readQualityDetail();

    this.batch = new ParticleBatch(PARTICLE_HARD_CAP);
    this.particleMeshes.add(this.batch.mesh);

    this.debrisField = new DebrisField(GameConfig.isMobile ? 48 : 128);
    this.debrisGroup.add(this.debrisField.mesh);

    for (let i = 0; i < MAX_TRAIL_EMITS; i++) {
      this.trailEmitQueue.push(new THREE.Vector3());
    }

    const self = this;
    this.emitter = {
      get detail(): number {
        return self.getDetail();
      },
      emit: (type, position, options) => self.spawnParticle(type, position, options) !== null,
      count: (base, min = 1) => Math.max(min, Math.round(base * self.getDetail())),
      schedule: (delaySeconds, emit) => self.scheduleBurst(delaySeconds, emit),
      debris: (position, velocity, size, color, life, smokeTrail = false) => {
        self.debrisField.spawn(position, velocity, size, color, life, smokeTrail);
      },
      shockwave: (position, radius, life, color, opacity = 0.85) =>
        self.createShockwave(position, radius, life, color, opacity),
    };
  }

  private readQualityDetail(): number {
    try {
      return computeDetailForPreset(GameConfig.getEffectiveQualityPreset(), GameConfig.isMobile);
    } catch {
      return 0.85;
    }
  }

  /** 当前活跃粒子上限（随画质预设变化） */
  public getBudget(): number {
    return this.budget;
  }

  /** LOD 细节系数：画质 × 负载（接近预算时自动降级新效果的粒子数） */
  private getDetail(): number {
    const load = this.activeParticles.length / Math.max(1, this.budget);
    return this.qualityDetail * (1 - 0.6 * smoothstep(0.55, 1, load));
  }

  // ---------------------------------------------------------------------------
  // 公共效果 API（保持旧签名）
  // ---------------------------------------------------------------------------

  /**
   * 水平扩散冲击波环（加色，随扩散淡出）
   */
  public createShockwave(
    position: THREE.Vector3,
    radius: number,
    life: number,
    color: number,
    opacity: number = 0.85
  ): void {
    if (!(radius > 0) || !(life > 0)) return;
    // RING 格的环位于半径 0.7 处：四边形边长 = 2r/0.7
    const endSize = (radius * 2) / 0.7;
    this.trailColor.set(color);
    this.spawnParticle(ParticleType.RING, position, {
      speed: 0,
      life,
      size: endSize * 0.12,
      sizeEnd: 1 / 0.12,
      color: this.trailColor,
      alpha: opacity,
      planar: true,
      intensity: 1.6,
    });
  }

  /** 爆炸：白热闪光 → 膨胀火球 → 浓烟柱 → 火花/余烬/碎片 → 冲击环 */
  public createExplosion(
    position: THREE.Vector3,
    scale: number = 1,
    profile: 'enemy' | 'player' | 'friendly' = 'enemy'
  ): void {
    emitExplosion(this.emitter, position, scale, profile);
  }

  /** Boss 多段死亡爆炸 */
  public createBossDeathExplosion(position: THREE.Vector3, scale: number = 1): void {
    emitBossDeathExplosion(this.emitter, position, scale);
  }

  /** 命中：火花 + 小闪光 + 烟丝 */
  public createHit(
    position: THREE.Vector3,
    intensity: number = 1,
    profile: HitEffectProfile = 'player'
  ): void {
    emitHit(this.emitter, position, intensity, profile);
  }

  /** 地面命中（按地表类型） */
  public createGroundImpact(
    position: THREE.Vector3,
    intensity: number = 1,
    surface: SurfaceImpactType = 'ground'
  ): void {
    emitGroundImpact(this.emitter, position, intensity, surface);
  }

  /** 小型水面命中：水柱 + 水雾 + 泡沫环 */
  public createWaterImpact(position: THREE.Vector3, intensity: number = 1): void {
    emitWaterImpact(this.emitter, position, intensity);
  }

  /** 舰船/潜艇级大水花 */
  public createSplash(position: THREE.Vector3, scale: number = 1): void {
    emitSplash(this.emitter, position, scale);
  }

  public createHeavyWeaponImpact(
    position: THREE.Vector3,
    scale: number = 1,
    profile: HeavyWeaponImpactProfile = 'boss-cannon'
  ): void {
    emitHeavyWeaponImpact(this.emitter, position, scale, profile);
  }

  public createTrail(position: THREE.Vector3, color: THREE.Color): void {
    emitTrail(this.emitter, position, color);
  }

  /** 导弹尾迹：亮尾焰 + 滞留烟带 */
  public createMissileTrail(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    color: THREE.Color,
    intensity: number = 1
  ): void {
    emitMissileTrail(this.emitter, position, direction, color, intensity);
  }

  public createMissileImpact(position: THREE.Vector3, scale: number = 1): void {
    emitMissileImpact(this.emitter, position, scale);
  }

  public createBossMissileTrail(position: THREE.Vector3, direction: THREE.Vector3): void {
    emitBossMissileTrail(this.emitter, position, direction);
  }

  public createBossMissileExplosion(position: THREE.Vector3, scale: number = 1.6): void {
    emitBossMissileExplosion(this.emitter, position, scale);
  }

  public createFlakExplosion(position: THREE.Vector3, radius: number = 50): void {
    emitFlakExplosion(this.emitter, position, radius);
  }

  public createTeleportOut(position: THREE.Vector3): void {
    emitTeleportOut(this.emitter, position);
  }

  public createTeleportIn(position: THREE.Vector3): void {
    emitTeleportIn(this.emitter, position);
  }

  public createLaserBeam(start: THREE.Vector3, end: THREE.Vector3, color: number = 0x00aaff): void {
    emitLaserBeam(this.emitter, start, end, color);
  }

  public createTentacleExplosion(position: THREE.Vector3): void {
    emitTentacleExplosion(this.emitter, position);
  }

  /** 枪口焰：星芒核心 + 前向焰瓣 + 少量火花 */
  public createMuzzleFlash(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    scale: number = 1
  ): void {
    emitMuzzleFlash(this.emitter, position, direction, scale);
  }

  /** 受损冒烟（建议 6-10 Hz 调用；intensity 0..1，越高越黑并带火舌） */
  public createDamageSmoke(position: THREE.Vector3, intensity: number): void {
    emitDamageSmoke(this.emitter, position, intensity);
  }

  /** 拾取爆闪 */
  public createPickupBurst(position: THREE.Vector3, color?: number): void {
    emitPickupBurst(this.emitter, position, color);
  }

  /** EMP：扩散电环 + 电弧 */
  public createEmpBurst(center: THREE.Vector3, radius: number): void {
    emitEmpBurst(this.emitter, center, radius);
  }

  // ---------------------------------------------------------------------------
  // 核心：生成 / 池 / 更新
  // ---------------------------------------------------------------------------

  /**
   * 生成单个粒子
   */
  private spawnParticle(
    type: ParticleType,
    position: THREE.Vector3,
    options: SpawnOptions
  ): Particle | null {
    if (this.disposed) return null;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return null;
    }
    if (!(options.life > 0)) return null;

    this.spawnDirection
      .set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
      .normalize()
      .multiplyScalar(Number.isFinite(options.speed) ? options.speed : 0);
    if (options.velocity) {
      this.spawnDirection.add(options.velocity);
    }

    if (type === ParticleType.DEBRIS) {
      this.debrisField.spawn(
        position,
        this.spawnDirection,
        options.size,
        options.color,
        options.life,
        options.smokeTrail === true
      );
      return null;
    }

    const particle = this.acquireParticle();
    if (!particle) {
      return null;
    }

    const profile = TYPE_PROFILES[type];
    particle.type = type;
    particle.position.copy(position);
    particle.velocity.copy(this.spawnDirection);
    particle.life = options.life;
    particle.maxLife = options.life;
    particle.size = Math.max(0.01, options.size);
    particle.sizeEnd = options.sizeEnd ?? profile.sizeEnd;
    particle.rotation = options.rotation ?? Math.random() * Math.PI * 2;
    particle.spin =
      options.spin ??
      (type === ParticleType.SMOKE || type === ParticleType.DUST
        ? (Math.random() - 0.5) * 1.2
        : type === ParticleType.FIRE
          ? (Math.random() - 0.5) * 1.6
          : 0);
    particle.intensity = options.intensity ?? profile.intensity;
    particle.alpha = options.alpha ?? profile.alpha;
    particle.additive = options.additive ?? profile.additive;
    particle.cell =
      options.cell ??
      profile.cells[Math.floor(Math.random() * profile.cells.length) % profile.cells.length];
    particle.drag = options.drag ?? profile.drag;
    particle.gravityScale =
      options.gravityScale ??
      (options.gravity === true ? Math.max(1, profile.gravity) : profile.gravity);
    particle.smokeTrail = options.smokeTrail === true;
    particle.trailTimer = 0.05;
    particle.seed = Math.random() * 100;

    const stretch = options.stretch ?? profile.stretch;
    particle.stretch = stretch;
    if (options.planar === true) {
      particle.mode = BATCH_MODE_PLANAR;
    } else if (stretch > 0 || options.axis) {
      particle.mode = BATCH_MODE_STREAK;
    } else {
      particle.mode = BATCH_MODE_BILLBOARD;
    }
    if (options.axis) {
      particle.axis.copy(options.axis);
      particle.axisFixed = true;
    } else {
      particle.axis.set(0, 0, 0);
      particle.axisFixed = false;
    }

    // 颜色渐变端点
    particle.c1.copy(options.color);
    switch (type) {
      case ParticleType.SMOKE:
        particle.c0.copy(options.color).multiplyScalar(0.6);
        particle.c1.copy(
          options.colorEnd ?? this.rampTarget.copy(options.color).lerp(SOFT_GRAY, 0.45)
        );
        break;
      case ParticleType.FIRE:
        // c0 = 冷却后的煤烟色
        particle.c0.copy(options.colorEnd ?? this.rampTarget.setRGB(0.07, 0.06, 0.055));
        break;
      case ParticleType.EMBER:
        particle.c0.copy(options.color);
        particle.c1.copy(
          options.colorEnd ?? this.rampTarget.copy(options.color).multiplyScalar(0.35)
        );
        break;
      case ParticleType.SPRAY:
        particle.c0.setRGB(0.95, 0.98, 1);
        particle.c1.copy(options.colorEnd ?? options.color);
        break;
      default:
        particle.c0.copy(options.color);
        if (options.colorEnd) particle.c1.copy(options.colorEnd);
        break;
    }

    particle.active = true;
    this.activeParticles.push(particle);
    return particle;
  }

  private acquireParticle(): Particle | null {
    if (this.activeParticles.length >= this.budget) {
      // 满预算：轮转回收（近似最旧）
      if (this.activeParticles.length === 0) return null;
      const index = this.recycleCursor % this.activeParticles.length;
      this.recycleCursor = (this.recycleCursor + 7) % 1048576;
      const recycled = this.activeParticles[index];
      this.releaseParticleAtIndex(index);
      this.particlePool.pop();
      return recycled;
    }

    const pooledParticle = this.particlePool.pop();
    if (pooledParticle) {
      return pooledParticle;
    }

    if (this.totalParticles < PARTICLE_HARD_CAP) {
      this.totalParticles++;
      return this.createParticleSlot();
    }
    return null;
  }

  private createParticleSlot(): Particle {
    return {
      active: false,
      type: ParticleType.EXPLOSION,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      axisFixed: false,
      life: 0,
      maxLife: 1,
      size: 1,
      sizeEnd: 1,
      rotation: 0,
      spin: 0,
      c0: new THREE.Color(),
      c1: new THREE.Color(),
      intensity: 1,
      alpha: 1,
      additive: 1,
      cell: 0,
      stretch: 0,
      mode: BATCH_MODE_BILLBOARD,
      gravityScale: 0,
      drag: 0,
      smokeTrail: false,
      trailTimer: 0,
      seed: 0,
    };
  }

  private scheduleBurst(delaySeconds: number, emit: () => void): void {
    if (this.disposed) return;
    this.delayedBursts.push({
      remainingTime: delaySeconds,
      emit,
    });
  }

  private flushDelayedBursts(deltaTime: number): void {
    for (let i = this.delayedBursts.length - 1; i >= 0; i--) {
      const burst = this.delayedBursts[i];
      burst.remainingTime -= deltaTime;
      if (burst.remainingTime > 0) {
        continue;
      }

      const last = this.delayedBursts.length - 1;
      if (i !== last) this.delayedBursts[i] = this.delayedBursts[last];
      this.delayedBursts.pop();
      burst.emit();
    }
  }

  private releaseParticleAtIndex(index: number): void {
    const particle = this.activeParticles[index];
    particle.active = false;
    particle.life = 0;
    particle.smokeTrail = false;

    const lastIndex = this.activeParticles.length - 1;
    if (index !== lastIndex) {
      this.activeParticles[index] = this.activeParticles[lastIndex];
    }
    this.activeParticles.pop();
    this.particlePool.push(particle);
  }

  /**
   * 更新所有粒子并写入实例批
   */
  public update(deltaTime: number): void {
    if (this.disposed) return;
    const dt = Number.isFinite(deltaTime) ? Math.min(Math.max(deltaTime, 0), 0.1) : 0;
    this.elapsed += dt;

    this.budgetRefreshTimer -= dt;
    if (this.budgetRefreshTimer <= 0) {
      this.budgetRefreshTimer = BUDGET_REFRESH_SECONDS;
      this.budget = computeParticleBudget(GameConfig.getParticleCount());
      this.qualityDetail = this.readQualityDetail();
    }

    this.flushDelayedBursts(dt);
    this.debrisField.update(dt, GRAVITY * 1.15, this.onDebrisTrail);

    const batch = this.batch;
    batch.begin();
    const frameFlip = Math.floor(this.elapsed * 30) % 2;

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.releaseParticleAtIndex(i);
        continue;
      }

      p.velocity.y += GRAVITY * p.gravityScale * dt;
      if (p.drag > 0) {
        p.velocity.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      }
      p.position.addScaledVector(p.velocity, dt);
      if (
        !Number.isFinite(p.position.x) ||
        !Number.isFinite(p.position.y) ||
        !Number.isFinite(p.position.z)
      ) {
        this.releaseParticleAtIndex(i);
        continue;
      }
      p.rotation += p.spin * dt;

      const age = 1 - p.life / p.maxLife;
      let sizeMul = 1;
      let alpha = p.alpha;
      let additive = p.additive;
      let intensity = p.intensity;
      let cell = p.cell;
      const color = this.rampColor;

      switch (p.type) {
        case ParticleType.EXPLOSION: {
          sizeMul =
            age < 0.18
              ? 0.55 + 0.7 * (age / 0.18)
              : 1.25 - (1.25 - p.sizeEnd) * ((age - 0.18) / 0.82);
          alpha *= Math.pow(1 - age, 0.6);
          color.copy(WHITE_HOT).lerp(p.c1, Math.min(1, age / 0.3));
          if (age > 0.55) {
            this.rampTarget.copy(p.c1).multiplyScalar(0.3);
            color.lerp(this.rampTarget, ((age - 0.55) / 0.45) * 0.85);
          }
          break;
        }
        case ParticleType.FIRE: {
          sizeMul =
            age < 0.2
              ? 0.55 + 0.45 * easeOutCubic(age / 0.2)
              : 1 + (p.sizeEnd - 1) * easeOutCubic((age - 0.2) / 0.8);
          if (age < 0.18) {
            color.copy(WHITE_HOT).lerp(p.c1, age / 0.18);
          } else {
            // 先在加色阶段变暗（避免中间色调的“土黄”），再切换为普通混合的煤烟
            color.copy(p.c1).lerp(p.c0, smoothstep(0.3, 0.62, age));
          }
          intensity = p.intensity + (1 - p.intensity) * smoothstep(0.25, 0.55, age);
          additive = p.additive * (1 - smoothstep(0.45, 0.75, age));
          alpha *= Math.min(1, age * 14) * Math.pow(1 - age, 0.75);
          break;
        }
        case ParticleType.SPARK: {
          sizeMul = 1.1 - 0.5 * age;
          alpha *= 1 - age;
          color.copy(WHITE_HOT).lerp(p.c1, Math.min(1, age / 0.25));
          break;
        }
        case ParticleType.SMOKE: {
          sizeMul = 0.55 + (p.sizeEnd - 0.55) * (1 - (1 - age) * (1 - age));
          alpha *= Math.min(1, age * 7) * Math.pow(1 - age, 1.25);
          color.copy(p.c0).lerp(p.c1, Math.min(1, age * 1.4));
          break;
        }
        case ParticleType.EMBER: {
          sizeMul = 1 - 0.4 * age;
          const flicker = 0.72 + 0.28 * Math.sin(this.elapsed * 38 + p.seed * 7.1);
          alpha *= flicker * (1 - age * age);
          color.copy(p.c0).lerp(p.c1, age);
          intensity *= 1 - 0.6 * age;
          break;
        }
        case ParticleType.DUST: {
          sizeMul = 0.6 + (p.sizeEnd - 0.6) * easeOutCubic(age);
          alpha *= Math.min(1, age * 10) * Math.pow(1 - age, 1.4);
          color.copy(p.c0).lerp(p.c1, age);
          break;
        }
        case ParticleType.SPRAY: {
          sizeMul = 0.7 + (p.sizeEnd - 0.7) * easeOutCubic(age);
          alpha *= Math.min(1, age * 10) * Math.pow(1 - age, 1.2);
          color.copy(p.c0).lerp(p.c1, Math.min(1, age * 1.5));
          break;
        }
        case ParticleType.RING: {
          sizeMul = 1 + (p.sizeEnd - 1) * easeOutCubic(age);
          alpha *= Math.pow(1 - age, 1.6);
          color.copy(p.c1);
          break;
        }
        case ParticleType.ELECTRIC: {
          sizeMul = 1 + (p.sizeEnd - 1) * age;
          const crackle = Math.sin(this.elapsed * 91 + p.seed * 13.7) * 0.5 + 0.5;
          alpha *= (0.35 + 0.65 * crackle) * Math.pow(1 - age, 0.5);
          if (frameFlip === 1) cell = p.cell === ARC_CELLS[0] ? ARC_CELLS[1] : ARC_CELLS[0];
          color.copy(WHITE_HOT).lerp(p.c1, 0.65);
          break;
        }
        case ParticleType.GLOW: {
          sizeMul = 1 + (p.sizeEnd - 1) * easeOutCubic(age);
          alpha *= Math.min(1, age * 12) * Math.pow(1 - age, 1.2);
          color.copy(p.c0).lerp(p.c1, age);
          break;
        }
        case ParticleType.SCORCH: {
          sizeMul = 1 + (p.sizeEnd - 1) * easeOutCubic(Math.min(1, age * 6));
          alpha *= Math.min(1, age * 25) * (age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1);
          color.copy(p.c1);
          break;
        }
        default:
          color.copy(p.c1);
          break;
      }

      let axisX = 0;
      let axisY = 0;
      let axisZ = 0;
      if (p.mode === BATCH_MODE_STREAK) {
        const axis = p.axisFixed ? p.axis : p.velocity;
        axisX = axis.x;
        axisY = axis.y;
        axisZ = axis.z;
      }

      batch.push(
        p.position.x,
        p.position.y,
        p.position.z,
        p.size * sizeMul,
        color.r * intensity,
        color.g * intensity,
        color.b * intensity,
        alpha,
        p.rotation,
        cell,
        p.stretch,
        p.mode,
        axisX,
        axisY,
        axisZ,
        additive
      );

      if (p.smokeTrail) {
        p.trailTimer -= dt;
        if (p.trailTimer <= 0 && this.trailEmitCount < MAX_TRAIL_EMITS) {
          p.trailTimer = 0.035 + Math.random() * 0.025;
          this.trailEmitQueue[this.trailEmitCount++].copy(p.position);
        }
      }
    }

    batch.end();

    // 遍历结束后再生成烟迹，避免遍历期间修改 activeParticles
    if (this.trailEmitCount > 0) {
      for (let i = 0; i < this.trailEmitCount; i++) {
        this.spawnParticle(ParticleType.SMOKE, this.trailEmitQueue[i], {
          speed: 0.4 + Math.random() * 0.5,
          life: 0.8 + Math.random() * 0.5,
          size: 1 + Math.random() * 0.4,
          sizeEnd: 2.6,
          color: this.trailColor.setRGB(0.16, 0.15, 0.14),
          alpha: 0.5,
        });
      }
      this.trailEmitCount = 0;
    }
  }

  /**
   * 清除所有粒子
   */
  public clear(): void {
    this.delayedBursts = [];
    this.trailEmitCount = 0;

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      this.releaseParticleAtIndex(i);
    }
    this.debrisField.clear();
    this.batch.begin();
    this.batch.end();
  }

  /**
   * 获取活跃粒子数量（含实心碎片）
   */
  public getActiveCount(): number {
    return this.activeParticles.length + this.debrisField.getActiveCount();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;

    this.batch.dispose();
    this.debrisField.dispose();
    this.particlePool = [];
    this.activeParticles = [];
    this.particleMeshes.removeFromParent();
    this.debrisGroup.removeFromParent();
  }
}
