import * as THREE from 'three';
import { GameConfig } from '@/config';

/**
 * 粒子类型
 */
export enum ParticleType {
  EXPLOSION = 'EXPLOSION',
  SMOKE = 'SMOKE',
  SPARK = 'SPARK',
  FIRE = 'FIRE',
  DEBRIS = 'DEBRIS',
}

export type SurfaceImpactType = 'ground' | 'desert' | 'snow' | 'city';
export type HitEffectProfile = 'player' | 'enemy' | 'boss';
export type HeavyWeaponImpactProfile = 'boss-cannon' | 'laser' | 'flak-hit' | 'boss-armor';

/**
 * 单个粒子数据
 */
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  mesh: THREE.Mesh;
  active: boolean;
}

interface DelayedBurst {
  remainingTime: number;
  emit: () => void;
}

/**
 * 粒子效果管理器
 */
export class ParticleSystem {
  private scene: THREE.Scene;
  private activeParticles: Particle[] = [];
  private particlePool: Particle[] = [];
  private particleMeshes: THREE.Group;
  private maxParticles: number;
  private delayedBursts: DelayedBurst[] = [];
  private totalParticles: number = 0;

  // 几何体和材质缓存
  private geometries: Map<ParticleType, THREE.BufferGeometry> = new Map();
  private materials: Map<ParticleType, THREE.MeshBasicMaterial> = new Map();
  private readonly gravity = new THREE.Vector3(0, -9.8, 0);
  private readonly spawnDirection = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();
  private readonly directedVelocity = new THREE.Vector3();
  private readonly tempColorA = new THREE.Color();
  private readonly tempColorB = new THREE.Color();
  private readonly tempColorC = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleMeshes = new THREE.Group();
    this.particleMeshes.name = 'particles';
    this.scene.add(this.particleMeshes);

    this.maxParticles = GameConfig.getParticleCount();

    // 初始化几何体和材质
    this.initAssets();
  }

  /**
   * 初始化粒子资源
   */
  private initAssets(): void {
    // 爆炸粒子 - 球体
    this.geometries.set(ParticleType.EXPLOSION, new THREE.SphereGeometry(0.5, 8, 8));
    this.materials.set(
      ParticleType.EXPLOSION,
      new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 1,
      })
    );

    // 烟雾粒子 - 大球体
    this.geometries.set(ParticleType.SMOKE, new THREE.SphereGeometry(1, 8, 8));
    this.materials.set(
      ParticleType.SMOKE,
      new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.6,
      })
    );

    // 火花粒子 - 小球体
    this.geometries.set(ParticleType.SPARK, new THREE.SphereGeometry(0.1, 4, 4));
    this.materials.set(
      ParticleType.SPARK,
      new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 1,
      })
    );

    // 火焰粒子
    this.geometries.set(ParticleType.FIRE, new THREE.SphereGeometry(0.3, 8, 8));
    this.materials.set(
      ParticleType.FIRE,
      new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.9,
      })
    );

    // 碎片粒子 - 方块
    this.geometries.set(ParticleType.DEBRIS, new THREE.BoxGeometry(0.3, 0.3, 0.3));
    this.materials.set(
      ParticleType.DEBRIS,
      new THREE.MeshBasicMaterial({
        color: 0x666666,
      })
    );
  }

  /**
   * 创建爆炸效果
   */
  public createExplosion(
    position: THREE.Vector3,
    scale: number = 1,
    profile: 'enemy' | 'player' | 'friendly' = 'enemy'
  ): void {
    const particleCount = Math.floor(30 * scale);
    const explosionScale = THREE.MathUtils.clamp(scale, 0.7, 2.4);
    const isPlayer = profile === 'player';
    const isFriendly = profile === 'friendly';
    const isHeavy = explosionScale >= 1.45;
    const fireHueBase = isPlayer ? 0.02 : isFriendly ? 0.08 : 0.05;
    const fireLightBase = isPlayer ? 0.48 : isFriendly ? 0.58 : 0.5;
    const smokeLightBase = isPlayer ? 0.18 : isFriendly ? 0.32 : 0.3;

    // 火焰核心
    for (let i = 0; i < particleCount * 0.4; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 20 * scale,
        life: (isPlayer ? 0.36 : isHeavy ? 0.38 : 0.3)
          + Math.random() * (isPlayer ? 0.34 : isHeavy ? 0.4 : 0.3),
        size: (isPlayer ? 0.65 : isFriendly ? 0.42 : isHeavy ? 0.72 : 0.5)
          + Math.random() * (isPlayer ? 1.8 : isHeavy ? 2.1 : 1.5),
        color: new THREE.Color().setHSL(
          fireHueBase + Math.random() * (isPlayer ? 0.05 : isFriendly ? 0.06 : 0.1),
          isFriendly ? 0.9 : 1,
          fireLightBase + Math.random() * 0.08
        ),
      });
    }

    // 爆炸光芒
    for (let i = 0; i < particleCount * 0.3; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 24 * scale,
        life: (isPlayer ? 0.22 : isHeavy ? 0.24 : 0.18)
          + Math.random() * (isPlayer ? 0.38 : isHeavy ? 0.42 : 0.34),
        size: (isPlayer ? 0.34 : isFriendly ? 0.2 : isHeavy ? 0.42 : 0.24)
          + Math.random() * (isPlayer ? 1 : isHeavy ? 1.18 : 0.84),
        color: new THREE.Color().setHSL(
          isPlayer ? 0.045 : isFriendly ? 0.085 : 0.075,
          isFriendly ? 0.84 : 0.92,
          isPlayer ? 0.7 : isFriendly ? 0.68 : 0.62
        ),
      });
    }

    // 火花
    for (let i = 0; i < particleCount * 0.2; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 50 * scale,
        life: 0.5 + Math.random() * 0.5,
        size: 0.1 + Math.random() * 0.2,
        color: new THREE.Color(isFriendly ? 0xa8fff3 : isPlayer ? 0xffd27a : isHeavy ? 0xffb24d : 0xffff00),
      });
    }

    // 碎片
    for (let i = 0; i < particleCount * 0.1; i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 15 * scale,
        life: 1 + Math.random() * 1,
        size: 0.2 + Math.random() * 0.3,
        color: new THREE.Color(0x666666),
        gravity: true,
      });
    }

    if (explosionScale > 1.05) {
      const ringPosition = position.clone();
      this.scheduleBurst(0.07, () => {
        this.emitMissileSparkRing(
          ringPosition,
          0.4 + explosionScale * 0.35,
          Math.max(5, Math.floor(5 + explosionScale * 3)),
          14 + explosionScale * 5,
          0.14,
          0.08,
          isFriendly ? 0x9af7ff : isPlayer ? 0xff9b52 : 0xffc86d
        );
      });
    }

    if (isHeavy) {
      const heavyRingPosition = position.clone();
      this.scheduleBurst(0.035, () => {
        this.emitMissileSparkRing(
          heavyRingPosition,
          0.9 + explosionScale * 0.55,
          Math.max(8, Math.floor(8 + explosionScale * 4)),
          18 + explosionScale * 6,
          0.18,
          0.12,
          isPlayer ? 0xff7c42 : 0xff9a38
        );
      });
    }

    // 烟雾延迟到 update 内处理，避免高频 setTimeout 对主线程造成压力
    const smokePosition = position.clone();
    this.scheduleBurst(0.1, () => {
      for (let i = 0; i < particleCount * 0.3; i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 5 * scale,
          life: (isPlayer ? 2.4 : isHeavy ? 2.7 : 2) + Math.random() * (isPlayer ? 2.1 : isHeavy ? 2.3 : 2),
          size: (isPlayer ? 2.4 : isFriendly ? 1.7 : isHeavy ? 2.8 : 2)
            + Math.random() * (isPlayer ? 3.4 : isHeavy ? 4.1 : 3),
          color: new THREE.Color().setHSL(
            isFriendly ? 0.06 : 0,
            isFriendly ? 0.08 : 0,
            smokeLightBase + Math.random() * (isPlayer ? 0.18 : isHeavy ? 0.22 : 0.3)
          ),
        });
      }
    });
  }

  public createBossDeathExplosion(position: THREE.Vector3, scale: number = 1): void {
    const blastScale = THREE.MathUtils.clamp(scale, 1.6, 6);
    const coreFlashCount = Math.max(16, Math.floor(18 + blastScale * 8));
    const fireCount = Math.max(28, Math.floor(30 + blastScale * 12));
    const sparkCount = Math.max(30, Math.floor(34 + blastScale * 14));
    const debrisCount = Math.max(12, Math.floor(12 + blastScale * 5));
    const smokeCount = Math.max(16, Math.floor(16 + blastScale * 8));
    const burstRadius = 2.2 + blastScale * 1.05;

    for (let i = 0; i < coreFlashCount; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 24 + Math.random() * (18 + blastScale * 8),
        life: 0.22 + Math.random() * 0.18,
        size: 0.44 + Math.random() * (0.5 + blastScale * 0.26),
        color: this.tempColorA.setHSL(0.045 + Math.random() * 0.03, 1, 0.78 + Math.random() * 0.08),
      });
    }

    for (let i = 0; i < fireCount; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 24 + Math.random() * (20 + blastScale * 10),
        life: 0.3 + Math.random() * 0.24,
        size: 0.5 + Math.random() * (0.44 + blastScale * 0.28),
        color: this.tempColorB.setHSL(0.02 + Math.random() * 0.04, 1, 0.48 + Math.random() * 0.08),
      });
    }

    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 34 + Math.random() * (24 + blastScale * 14),
        life: 0.2 + Math.random() * 0.22,
        size: 0.12 + Math.random() * (0.1 + blastScale * 0.08),
        color: this.tempColorC.setHSL(0.045 + Math.random() * 0.03, 1, 0.58 + Math.random() * 0.08),
      });
    }

    for (let i = 0; i < debrisCount; i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 16 + Math.random() * (14 + blastScale * 8),
        life: 0.75 + Math.random() * 0.65,
        size: 0.16 + Math.random() * (0.16 + blastScale * 0.08),
        color: this.tempColorA.setRGB(0.28, 0.29, 0.33),
        gravity: true,
      });
    }

    this.emitMissileSparkRing(
      position,
      burstRadius,
      Math.max(12, Math.floor(12 + blastScale * 4)),
      26 + blastScale * 8,
      0.18,
      0.14,
      0xff7a40
    );

    const secondRingPosition = position.clone();
    this.scheduleBurst(0.08, () => {
      this.emitMissileSparkRing(
        secondRingPosition,
        burstRadius * 1.45,
        Math.max(10, Math.floor(10 + blastScale * 3)),
        24 + blastScale * 7,
        0.2,
        0.12,
        0xffb861
      );
    });

    const smokePosition = position.clone();
    this.scheduleBurst(0.06, () => {
      for (let i = 0; i < smokeCount; i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 4.4 + Math.random() * (4.2 + blastScale * 2.2),
          life: 1.1 + Math.random() * 0.8,
          size: 0.9 + Math.random() * (0.7 + blastScale * 0.34),
          color: this.tempColorB.setHSL(0.02, 0.06, 0.18 + Math.random() * 0.08),
        });
      }
    });

    const outerSmokePosition = position.clone();
    this.scheduleBurst(0.18, () => {
      for (let i = 0; i < Math.max(10, Math.floor(10 + blastScale * 5)); i++) {
        const angle = (i / Math.max(10, Math.floor(10 + blastScale * 5))) * Math.PI * 2;
        const shellPos = new THREE.Vector3(
          outerSmokePosition.x + Math.cos(angle) * burstRadius * 1.1,
          outerSmokePosition.y + (Math.random() - 0.5) * (1.4 + blastScale * 0.28),
          outerSmokePosition.z + Math.sin(angle) * burstRadius * 1.1
        );
        this.spawnParticle(ParticleType.SMOKE, shellPos, {
          speed: 3 + Math.random() * (3.8 + blastScale * 1.5),
          life: 1.4 + Math.random() * 1.2,
          size: 0.8 + Math.random() * (0.6 + blastScale * 0.28),
          color: this.tempColorC.setHSL(0, 0, 0.12 + Math.random() * 0.08),
        });
      }
    });

    const secondaryBlastPosition = position.clone();
    this.scheduleBurst(0.12, () => {
      for (let i = 0; i < Math.max(8, Math.floor(8 + blastScale * 4)); i++) {
        const angle = Math.random() * Math.PI * 2;
        const offset = 1.2 + Math.random() * burstRadius;
        const burstPos = new THREE.Vector3(
          secondaryBlastPosition.x + Math.cos(angle) * offset,
          secondaryBlastPosition.y + (Math.random() - 0.5) * (1 + blastScale * 0.2),
          secondaryBlastPosition.z + Math.sin(angle) * offset
        );
        this.spawnParticle(ParticleType.FIRE, burstPos, {
          speed: 8 + Math.random() * 10,
          life: 0.18 + Math.random() * 0.16,
          size: 0.22 + Math.random() * 0.16,
          color: this.tempColorA.setHSL(0.02 + Math.random() * 0.03, 1, 0.54 + Math.random() * 0.08),
        });
      }
    });

    const finalRingPosition = position.clone();
    this.scheduleBurst(0.26, () => {
      this.emitMissileSparkRing(
        finalRingPosition,
        burstRadius * 1.85,
        Math.max(8, Math.floor(8 + blastScale * 2)),
        14 + blastScale * 4,
        0.24,
        0.08,
        0xff9a55
      );
    });
  }

  /**
   * 创建击中效果
   */
  public createHit(
    position: THREE.Vector3,
    intensity: number = 1,
    profile: HitEffectProfile = 'player'
  ): void {
    const hitIntensity = THREE.MathUtils.clamp(intensity, 0.6, 2.2);
    const sparkCount = Math.max(4, Math.floor(7 + hitIntensity * 3));
    const flashCount = Math.max(2, Math.floor(2 + hitIntensity * 2));
    const isBoss = profile === 'boss';
    const isEnemy = profile === 'enemy';
    const sparkHueBase = isBoss ? 0.04 : isEnemy ? 0.065 : 0.1;
    const sparkLightnessBase = isBoss ? 0.56 : isEnemy ? 0.66 : 0.62;

    // 高频火花层：命中边缘感
    for (let i = 0; i < sparkCount; i++) {
      const sparkLightness = sparkLightnessBase + Math.random() * 0.18 * hitIntensity;
      this.spawnParticle(ParticleType.SPARK, position, {
        speed:
          (isBoss ? 20 : isEnemy ? 28 : 24) + Math.random() * (16 + hitIntensity * 12),
        life: (isBoss ? 0.11 : 0.08) + Math.random() * (isBoss ? 0.16 : 0.11),
        size:
          (isBoss ? 0.1 : 0.07) + Math.random() * ((isBoss ? 0.09 : 0.05) + hitIntensity * 0.05),
        color: this.tempColorA.setHSL(sparkHueBase + Math.random() * 0.02, 1, sparkLightness),
      });
    }

    // 冲击闪光层：不同强度下更容易区分
    for (let i = 0; i < flashCount; i++) {
      const isHeavy = hitIntensity > 1.25 || isBoss;
      const hue = isBoss
        ? 0.025 + Math.random() * 0.02
        : isEnemy
          ? 0.085 + Math.random() * 0.02
          : isHeavy
            ? 0.06 + Math.random() * 0.03
            : 0.075 + Math.random() * 0.02;
      const sat = isBoss ? 0.9 : isHeavy ? 1 : 0.92;
      const light = isBoss
        ? 0.58 + Math.random() * 0.08
        : isHeavy
          ? 0.74 + Math.random() * 0.08
          : 0.66 + Math.random() * 0.08;
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: (isBoss ? 7 : 9) + Math.random() * (7 + hitIntensity * 5),
        life:
          (isBoss ? 0.09 : 0.06) + Math.random() * ((isBoss ? 0.1 : 0.06) + hitIntensity * 0.03),
        size:
          (isBoss ? 0.22 : 0.12) + Math.random() * ((isBoss ? 0.16 : 0.1) + hitIntensity * 0.07),
        color: this.tempColorB.setHSL(hue, sat, light),
      });
    }

    // 强命中补一点碎片，弱命中不增加额外负担
    if (hitIntensity > 1.35 || isBoss) {
      const debrisCount = isBoss
        ? Math.floor(3 + hitIntensity * 3)
        : Math.floor(2 + (hitIntensity - 1.35) * 4);
      for (let i = 0; i < debrisCount; i++) {
        this.spawnParticle(ParticleType.DEBRIS, position, {
          speed: (isBoss ? 8 : 10) + Math.random() * 8,
          life: (isBoss ? 0.4 : 0.28) + Math.random() * (isBoss ? 0.34 : 0.22),
          size: (isBoss ? 0.14 : 0.1) + Math.random() * (isBoss ? 0.12 : 0.08),
          color: this.tempColorC.setRGB(
            isBoss ? 0.32 : 0.38,
            isBoss ? 0.32 : 0.38,
            isBoss ? 0.36 : 0.42
          ),
          gravity: true,
        });
      }
    }

    // 轻烟痕层
    const smokePosition = position.clone();
    this.scheduleBurst(0.03, () => {
      const smokeCount = isBoss
        ? Math.max(2, Math.floor(2 + hitIntensity * 1.5))
        : Math.max(1, Math.floor(1 + hitIntensity * 1.2));
      for (let i = 0; i < smokeCount; i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: (isBoss ? 1.1 : 1.4) + Math.random() * (isBoss ? 2.8 : 2.2),
          life:
            (isBoss ? 0.18 : 0.1) + Math.random() * ((isBoss ? 0.16 : 0.1) + hitIntensity * 0.04),
          size:
            (isBoss ? 0.22 : 0.12) + Math.random() * ((isBoss ? 0.2 : 0.12) + hitIntensity * 0.08),
          color: this.tempColorA.setHSL(
            isBoss ? 0.04 : 0.08,
            isBoss ? 0.12 : 0.1,
            (isBoss ? 0.26 : 0.34) + Math.random() * 0.08
          ),
        });
      }
    });
  }

  public createGroundImpact(
    position: THREE.Vector3,
    intensity: number = 1,
    surface: SurfaceImpactType = 'ground'
  ): void {
    const impactIntensity = THREE.MathUtils.clamp(intensity, 0.7, 1.8);
    const sparkCount = Math.max(3, Math.floor(4 + impactIntensity * 3));
    const dustCount = Math.max(4, Math.floor(5 + impactIntensity * 4));
    const sparkColor = this.getSurfaceSparkColor(surface);
    const smokeHue = surface === 'snow' ? 0.56 : surface === 'city' ? 0 : 0.08;
    const smokeSaturation = surface === 'desert' ? 0.3 : surface === 'city' ? 0.08 : 0.18;
    const smokeLightness = this.getSurfaceSmokeLightness(surface);
    const dustSpeedBase = surface === 'snow' ? 1.4 : 2;

    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 10 + Math.random() * (8 + impactIntensity * 8),
        life: 0.06 + Math.random() * 0.08,
        size: 0.06 + Math.random() * 0.08,
        color: this.tempColorA.set(sparkColor),
      });
    }

    for (let i = 0; i < dustCount; i++) {
      this.spawnParticle(ParticleType.SMOKE, position, {
        speed: dustSpeedBase + Math.random() * (2 + impactIntensity * 2),
        life: 0.22 + Math.random() * 0.22,
        size:
          (surface === 'desert' ? 0.24 : 0.18)
          + Math.random() * (0.18 + impactIntensity * (surface === 'snow' ? 0.12 : 0.16)),
        color: this.tempColorB.setHSL(
          smokeHue,
          smokeSaturation,
          smokeLightness + Math.random() * 0.08
        ),
      });
    }
  }

  public createWaterImpact(position: THREE.Vector3, intensity: number = 1): void {
    const impactIntensity = THREE.MathUtils.clamp(intensity, 0.75, 2);
    const sprayCount = Math.max(5, Math.floor(6 + impactIntensity * 4));
    const mistCount = Math.max(4, Math.floor(4 + impactIntensity * 3));

    for (let i = 0; i < sprayCount; i++) {
      const particle = this.spawnParticle(ParticleType.SPARK, position, {
        speed: 6 + Math.random() * (8 + impactIntensity * 5),
        life: 0.1 + Math.random() * 0.08,
        size: 0.08 + Math.random() * 0.08,
        color: this.tempColorA.setHSL(0.55 + Math.random() * 0.03, 0.75, 0.78 + Math.random() * 0.08),
      });
      if (!particle) continue;
      particle.velocity.y = 4 + Math.random() * (4 + impactIntensity * 4);
    }

    for (let i = 0; i < mistCount; i++) {
      this.spawnParticle(ParticleType.SMOKE, position, {
        speed: 1.4 + Math.random() * (1.6 + impactIntensity * 1.8),
        life: 0.16 + Math.random() * 0.16,
        size: 0.22 + Math.random() * (0.18 + impactIntensity * 0.16),
        color: this.tempColorB.setHSL(0.56, 0.28, 0.82 + Math.random() * 0.08),
      });
    }

    this.emitFlakRing(
      position,
      0.4 + impactIntensity * 0.5,
      Math.max(6, Math.floor(6 + impactIntensity * 3)),
      0.08,
      0.16,
      6,
      0.05
    );
  }

  public createHeavyWeaponImpact(
    position: THREE.Vector3,
    scale: number = 1,
    profile: HeavyWeaponImpactProfile = 'boss-cannon'
  ): void {
    const impactScale = THREE.MathUtils.clamp(scale, 0.95, 2.8);
    const isLaser = profile === 'laser';
    const isFlak = profile === 'flak-hit';
    const isArmor = profile === 'boss-armor';
    const flashCount = Math.max(5, Math.floor(6 + impactScale * 3));
    const fireCount = Math.max(6, Math.floor(7 + impactScale * 4));
    const sparkCount = Math.max(12, Math.floor(12 + impactScale * 6));
    const smokeCount = Math.max(5, Math.floor(6 + impactScale * 3));
    const debrisCount = isLaser ? 0 : Math.max(3, Math.floor(3 + impactScale * 2));
    const fireHue = isLaser ? 0.06 : isFlak ? 0.02 : isArmor ? 0.055 : 0.025;
    const flashLightness = isLaser ? 0.72 : isFlak ? 0.62 : 0.7;
    const smokeLightness = isLaser ? 0.26 : isFlak ? 0.16 : isArmor ? 0.24 : 0.2;
    const ringColor = isLaser ? 0x66dfff : isFlak ? 0xff5f42 : isArmor ? 0xffbf74 : 0xff7b4f;

    for (let i = 0; i < flashCount; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 18 + Math.random() * (12 + impactScale * 6),
        life: (isLaser ? 0.22 : 0.18) + Math.random() * 0.14,
        size: 0.28 + Math.random() * (0.24 + impactScale * 0.2),
        color: this.tempColorA.setHSL(
          isLaser ? 0.54 + Math.random() * 0.02 : fireHue + Math.random() * 0.025,
          isLaser ? 0.78 : 1,
          flashLightness + Math.random() * 0.08
        ),
      });
    }

    for (let i = 0; i < fireCount; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 16 + Math.random() * (12 + impactScale * 7),
        life: (isLaser ? 0.2 : 0.22) + Math.random() * 0.16,
        size: 0.26 + Math.random() * (0.22 + impactScale * 0.22),
        color: this.tempColorB.setHSL(
          isLaser ? 0.56 + Math.random() * 0.02 : fireHue + Math.random() * 0.03,
          isLaser ? 0.72 : 1,
          isLaser ? 0.62 + Math.random() * 0.08 : 0.5 + Math.random() * 0.08
        ),
      });
    }

    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: (isFlak ? 34 : 26) + Math.random() * (18 + impactScale * 10),
        life: 0.18 + Math.random() * 0.18,
        size: 0.1 + Math.random() * (0.08 + impactScale * 0.06),
        color: isLaser
          ? this.tempColorC.setRGB(0.68, 0.96, 1)
          : isArmor
            ? this.tempColorC.setRGB(1, 0.82, 0.52)
            : this.tempColorC.setRGB(1, 0.62 + Math.random() * 0.14, 0.28),
      });
    }

    for (let i = 0; i < debrisCount; i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 12 + Math.random() * (10 + impactScale * 6),
        life: 0.42 + Math.random() * 0.35,
        size: 0.12 + Math.random() * (0.1 + impactScale * 0.08),
        color: this.tempColorA.setRGB(0.34, 0.35, 0.39),
        gravity: true,
      });
    }

    this.emitFlakRing(
      position,
      0.5 + impactScale * (isFlak ? 0.78 : isLaser ? 0.62 : 0.54),
      Math.max(7, Math.floor(7 + impactScale * 3)),
      isFlak ? 0.13 : isLaser ? 0.11 : 0.1,
      isFlak ? 0.56 : isLaser ? 0.42 : 0.48,
      isFlak ? 16 : isLaser ? 12 : 14,
      isLaser ? 0.08 : 0.12,
      ringColor
    );

    const smokePosition = position.clone();
    this.scheduleBurst(isLaser ? 0.025 : 0.04, () => {
      for (let i = 0; i < smokeCount; i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 3.4 + Math.random() * (3.2 + impactScale * 1.8),
          life: (isFlak ? 0.95 : isLaser ? 0.72 : 0.84) + Math.random() * 0.46,
          size: 0.62 + Math.random() * (0.46 + impactScale * (isFlak ? 0.44 : 0.32)),
          color: this.tempColorB.setHSL(
            isLaser ? 0.56 : 0,
            isLaser ? 0.08 : 0,
            smokeLightness + Math.random() * 0.08
          ),
        });
      }
    });

    if (!isLaser) {
      const followupPosition = position.clone();
      this.scheduleBurst(0.08, () => {
        for (let i = 0; i < Math.max(3, Math.floor(3 + impactScale * 2)); i++) {
          this.spawnParticle(ParticleType.FIRE, followupPosition, {
            speed: 7 + Math.random() * 6,
            life: 0.12 + Math.random() * 0.08,
            size: 0.16 + Math.random() * (0.12 + impactScale * 0.08),
            color: this.tempColorC.setHSL(fireHue + Math.random() * 0.02, 1, 0.56 + Math.random() * 0.08),
          });
        }
      });
    }
  }

  private getSurfaceSparkColor(surface: SurfaceImpactType): number {
    switch (surface) {
      case 'desert':
        return 0xffd07a;
      case 'snow':
        return 0xe6f8ff;
      case 'city':
        return 0xffc48f;
      default:
        return 0xffd36b;
    }
  }

  private getSurfaceSmokeLightness(surface: SurfaceImpactType): number {
    switch (surface) {
      case 'desert':
        return 0.42;
      case 'snow':
        return 0.78;
      case 'city':
        return 0.24;
      default:
        return 0.34;
    }
  }

  /**
   * 创建尾迹效果
   */
  public createTrail(position: THREE.Vector3, color: THREE.Color): void {
    this.trailColor.copy(color);
    this.spawnParticle(ParticleType.SMOKE, position, {
      speed: 2,
      life: 0.3,
      size: 0.3,
      color: this.trailColor,
    });
  }

  public createMissileTrail(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    color: THREE.Color,
    intensity: number = 1
  ): void {
    const trailIntensity = THREE.MathUtils.clamp(intensity, 0.8, 1.9);
    this.trailColor.copy(color);
    this.directedVelocity.copy(direction).normalize();

    const smoke = this.spawnParticle(ParticleType.SMOKE, position, {
      speed: 2.8 + trailIntensity * 2.4,
      life: 0.24 + Math.random() * (0.08 + trailIntensity * 0.08),
      size: 0.26 + Math.random() * (0.14 + trailIntensity * 0.12),
      color: this.trailColor,
    });
    this.applyDirectedBackVelocity(smoke, 8 + trailIntensity * 5, 1.5);

    if (trailIntensity > 1.1 && Math.random() < 0.45) {
      const darkSmoke = this.spawnParticle(ParticleType.SMOKE, position, {
        speed: 2 + trailIntensity * 1.5,
        life: 0.2 + Math.random() * 0.1,
        size: 0.2 + Math.random() * 0.12,
        color: this.tempColorA.setHSL(0.02, 0.08, 0.26 + Math.random() * 0.05),
      });
      this.applyDirectedBackVelocity(darkSmoke, 10 + trailIntensity * 4, 1.3);
    }

    const flame = this.spawnParticle(ParticleType.FIRE, position, {
      speed: 6 + trailIntensity * 2.6,
      life: 0.09 + Math.random() * (0.05 + trailIntensity * 0.03),
      size: 0.16 + Math.random() * (0.1 + trailIntensity * 0.09),
      color: this.tempColorB.setHSL(0.08 + Math.random() * 0.03, 1, 0.56 + Math.random() * 0.08),
    });
    this.applyDirectedBackVelocity(flame, 15 + trailIntensity * 8, 0.8);

    if (Math.random() < 0.22 + trailIntensity * 0.18) {
      const flare = this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 4 + trailIntensity * 3,
        life: 0.07 + Math.random() * 0.05,
        size: 0.1 + Math.random() * 0.08,
        color: this.tempColorC.setHSL(0.095, 1, 0.68),
      });
      this.applyDirectedBackVelocity(flare, 13 + trailIntensity * 7, 0.5);
    }

    if (Math.random() < 0.3 + trailIntensity * 0.12) {
      const spark = this.spawnParticle(ParticleType.SPARK, position, {
        speed: 6 + trailIntensity * 3.5,
        life: 0.07 + Math.random() * 0.07,
        size: 0.08 + Math.random() * 0.06,
        color: this.tempColorA.setRGB(1, 0.82, 0.42),
      });
      this.applyDirectedBackVelocity(spark, 20 + trailIntensity * 8, 1.1);
    }
  }

  public createMissileImpact(position: THREE.Vector3, scale: number = 1): void {
    const impactScale = THREE.MathUtils.clamp(scale, 1, 2.6);
    const sparkCount = Math.max(10, Math.floor(11 + impactScale * 6));
    const flashCount = Math.max(4, Math.floor(5 + impactScale * 3));
    const fireCount = Math.max(6, Math.floor(6 + impactScale * 4));

    // 核心闪光：命中时刻更清晰
    for (let i = 0; i < flashCount; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 16 + Math.random() * (12 + impactScale * 6),
        life: 0.14 + Math.random() * 0.12,
        size: 0.24 + Math.random() * (0.22 + impactScale * 0.2),
        color: this.tempColorA.setHSL(0.08, 1, 0.7 + Math.random() * 0.08),
      });
    }

    // 爆心火团：明显区别于机炮命中
    for (let i = 0; i < fireCount; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 14 + Math.random() * (12 + impactScale * 6),
        life: 0.2 + Math.random() * 0.14,
        size: 0.26 + Math.random() * (0.26 + impactScale * 0.2),
        color: this.tempColorB.setHSL(0.05 + Math.random() * 0.03, 1, 0.52 + Math.random() * 0.08),
      });
    }

    // 主体火花：体现冲击强度
    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 30 + Math.random() * (22 + impactScale * 14),
        life: 0.18 + Math.random() * 0.16,
        size: 0.09 + Math.random() * (0.1 + impactScale * 0.09),
        color: this.tempColorB.setRGB(1, 0.76, 0.36),
      });
    }

    for (let i = 0; i < Math.max(2, Math.floor(3 + impactScale * 2)); i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 12 + Math.random() * (8 + impactScale * 5),
        life: 0.4 + Math.random() * 0.32,
        size: 0.12 + Math.random() * (0.1 + impactScale * 0.08),
        color: this.tempColorC.setRGB(0.37, 0.38, 0.41),
        gravity: true,
      });
    }

    const smokePosition = position.clone();
    this.scheduleBurst(0.04, () => {
      for (let i = 0; i < Math.max(4, Math.floor(5 + impactScale * 3)); i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 3.6 + Math.random() * 4.2,
          life: 0.58 + Math.random() * 0.42,
          size: 0.54 + Math.random() * (0.42 + impactScale * 0.28),
          color: this.tempColorA.setHSL(0.08, 0.08, 0.32 + Math.random() * 0.08),
        });
      }
    });

    this.scheduleBurst(0.025, () => {
      for (let i = 0; i < Math.max(2, Math.floor(2 + impactScale * 2)); i++) {
        this.spawnParticle(ParticleType.FIRE, smokePosition, {
          speed: 10 + Math.random() * 7,
          life: 0.08 + Math.random() * 0.06,
          size: 0.14 + Math.random() * 0.1,
          color: this.tempColorC.setHSL(0.09, 0.95, 0.64 + Math.random() * 0.08),
        });
      }
    });

    // 中高强度导弹增加一圈延迟火花，帮助读到“爆炸规模”
    if (impactScale > 1.25) {
      const ringPosition = position.clone();
      this.scheduleBurst(0.06, () => {
        const ringSparks = Math.floor(4 + impactScale * 2);
        for (let i = 0; i < ringSparks; i++) {
          const angle = (i / ringSparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
          const ringOffset = 0.6 + impactScale * 0.45;
          const ringPos = new THREE.Vector3(
            ringPosition.x + Math.cos(angle) * ringOffset,
            ringPosition.y + (Math.random() - 0.5) * 0.35,
            ringPosition.z + Math.sin(angle) * ringOffset
          );
          this.spawnParticle(ParticleType.SPARK, ringPos, {
            speed: 20 + Math.random() * 12,
            life: 0.12 + Math.random() * 0.08,
            size: 0.06 + Math.random() * 0.05,
            color: this.tempColorB.setRGB(1, 0.8, 0.46),
          });
        }
      });
    }

    if (impactScale > 1.2) {
      const secondaryBlastPosition = position.clone();
      this.scheduleBurst(0.09, () => {
        for (let i = 0; i < Math.max(3, Math.floor(3 + impactScale * 2)); i++) {
          const angle = Math.random() * Math.PI * 2;
          const offset = 0.35 + Math.random() * (0.4 + impactScale * 0.22);
          const burstPos = new THREE.Vector3(
            secondaryBlastPosition.x + Math.cos(angle) * offset,
            secondaryBlastPosition.y + (Math.random() - 0.5) * 0.3,
            secondaryBlastPosition.z + Math.sin(angle) * offset
          );
          this.spawnParticle(ParticleType.FIRE, burstPos, {
            speed: 8 + Math.random() * 8,
            life: 0.14 + Math.random() * 0.12,
            size: 0.18 + Math.random() * 0.12,
            color: this.tempColorC.setHSL(0.03 + Math.random() * 0.02, 1, 0.56 + Math.random() * 0.08),
          });
        }
      });
    }
  }

  public createBossMissileTrail(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.directedVelocity.copy(direction).normalize();

    const smoke = this.spawnParticle(ParticleType.SMOKE, position, {
      speed: 4.2,
      life: 0.46 + Math.random() * 0.2,
      size: 0.56 + Math.random() * 0.28,
      color: new THREE.Color().setHSL(0.01, 0.12, 0.28 + Math.random() * 0.05),
    });
    if (smoke) {
      smoke.velocity.copy(this.directedVelocity).multiplyScalar(-14);
      smoke.velocity.y += (Math.random() - 0.5) * 1.8;
    }

    const fireCore = this.spawnParticle(ParticleType.FIRE, position, {
      speed: 7,
      life: 0.14 + Math.random() * 0.1,
      size: 0.34 + Math.random() * 0.18,
      color: new THREE.Color().setHSL(0.01 + Math.random() * 0.02, 1, 0.5),
    });
    if (fireCore) {
      fireCore.velocity.copy(this.directedVelocity).multiplyScalar(-24);
    }

    const flare = this.spawnParticle(ParticleType.EXPLOSION, position, {
      speed: 5,
      life: 0.1 + Math.random() * 0.06,
      size: 0.22 + Math.random() * 0.12,
      color: new THREE.Color().setHSL(0.035, 1, 0.64),
    });
    if (flare) {
      flare.velocity.copy(this.directedVelocity).multiplyScalar(-18);
    }
  }

  public createBossMissileExplosion(position: THREE.Vector3, scale: number = 1.6): void {
    const blastScale = THREE.MathUtils.clamp(scale, 1.2, 2.6);
    const coreFlashCount = Math.max(6, Math.floor(7 + blastScale * 4));
    const fireCount = Math.max(12, Math.floor(12 + blastScale * 6));
    const sparkCount = Math.max(12, Math.floor(12 + blastScale * 7));
    const debrisCount = Math.max(5, Math.floor(5 + blastScale * 3));

    // 1. 爆心高亮：更白、更硬，先读到“危险级别”
    for (let i = 0; i < coreFlashCount; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 18 + Math.random() * (14 + blastScale * 6),
        life: 0.14 + Math.random() * 0.12,
        size: 0.28 + Math.random() * (0.34 + blastScale * 0.22),
        color: this.tempColorA.setHSL(0.02 + Math.random() * 0.02, 1, 0.76 + Math.random() * 0.08),
      });
    }

    // 2. 主火球：偏红橙，区别于普通导弹的黄橙冲击
    for (let i = 0; i < fireCount; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 22 + Math.random() * (16 + blastScale * 10),
        life: 0.22 + Math.random() * 0.22,
        size: 0.4 + Math.random() * (0.32 + blastScale * 0.28),
        color: this.tempColorB.setHSL(0.015 + Math.random() * 0.03, 1, 0.48 + Math.random() * 0.06),
      });
    }

    // 3. 外抛火花：更尖锐、更远
    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 34 + Math.random() * (24 + blastScale * 14),
        life: 0.16 + Math.random() * 0.16,
        size: 0.1 + Math.random() * (0.1 + blastScale * 0.08),
        color: this.tempColorC.setRGB(1, 0.52 + Math.random() * 0.18, 0.22),
      });
    }

    // 4. 碎片：保留机械爆散感，但数量收住
    for (let i = 0; i < debrisCount; i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 14 + Math.random() * (10 + blastScale * 6),
        life: 0.55 + Math.random() * 0.35,
        size: 0.14 + Math.random() * (0.14 + blastScale * 0.1),
        color: this.tempColorA.setRGB(0.34, 0.34, 0.38),
        gravity: true,
      });
    }

    // 5. 烟壳：延迟出现，体积更重
    const smokePosition = position.clone();
    this.scheduleBurst(0.05, () => {
      for (let i = 0; i < Math.max(5, Math.floor(6 + blastScale * 4)); i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 3.5 + Math.random() * 4.2,
          life: 0.72 + Math.random() * 0.52,
          size: 0.72 + Math.random() * (0.56 + blastScale * 0.34),
          color: this.tempColorB.setHSL(0.02, 0.08, 0.22 + Math.random() * 0.08),
        });
      }
    });

    // 6. 外圈次爆闪：帮助读出 Boss 导弹的规模
    const ringPosition = position.clone();
    this.scheduleBurst(0.07, () => {
      this.emitMissileSparkRing(
        ringPosition,
        0.9 + blastScale * 0.55,
        Math.max(8, Math.floor(8 + blastScale * 4)),
        26 + blastScale * 8,
        0.12,
        0.09,
        0xff7440
      );
    });

    const shellPosition = position.clone();
    this.scheduleBurst(0.13, () => {
      this.emitMissileSparkRing(
        shellPosition,
        1.25 + blastScale * 0.7,
        Math.max(9, Math.floor(9 + blastScale * 4)),
        22 + blastScale * 7,
        0.16,
        0.1,
        0xff4b32
      );
    });

    const emberPosition = position.clone();
    this.scheduleBurst(0.11, () => {
      for (let i = 0; i < Math.max(4, Math.floor(4 + blastScale * 2)); i++) {
        this.spawnParticle(ParticleType.FIRE, emberPosition, {
          speed: 8 + Math.random() * 7,
          life: 0.14 + Math.random() * 0.14,
          size: 0.16 + Math.random() * 0.12,
          color: this.tempColorC.setHSL(0.02, 1, 0.54 + Math.random() * 0.08),
        });
      }
    });
  }

  private emitMissileSparkRing(
    center: THREE.Vector3,
    ringRadius: number,
    count: number,
    speedBase: number,
    lifeBase: number,
    sizeBase: number,
    color: number
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
      const pos = new THREE.Vector3(
        center.x + Math.cos(angle) * ringRadius,
        center.y + (Math.random() - 0.5) * 0.3,
        center.z + Math.sin(angle) * ringRadius
      );
      const particle = this.spawnParticle(ParticleType.SPARK, pos, {
        speed: 0,
        life: lifeBase + Math.random() * 0.08,
        size: sizeBase + Math.random() * 0.05,
        color: this.tempColorA.set(color),
      });
      if (!particle) {
        continue;
      }
      particle.velocity.set(
        Math.cos(angle) * (speedBase + Math.random() * 8),
        (Math.random() - 0.5) * 2.5,
        Math.sin(angle) * (speedBase + Math.random() * 8)
      );
    }
  }

  public createFlakExplosion(position: THREE.Vector3, radius: number = 50): void {
    const radiusScale = THREE.MathUtils.clamp(radius / 50, 0.8, 1.5);
    const visualRadius = radius * 1.34;
    const coreCount = Math.floor(14 * radiusScale);
    const fireballCount = Math.floor(18 * radiusScale);
    const sparkCount = Math.floor(22 * radiusScale);
    const ringCount = Math.floor(24 * radiusScale);
    const coreSize = 2.2 * radiusScale;
    const fireballSize = 1.8 * radiusScale;
    const smokeSize = 7.2 * radiusScale;
    const shellSmokeSize = 5.5 * radiusScale;

    // 0. 爆心闪光层：短寿命高亮，强调命中时刻
    for (let i = 0; i < coreCount; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 34 + Math.random() * 22,
        life: 0.68 + Math.random() * 0.34,
        size: coreSize + Math.random() * (coreSize * 0.9),
        color: new THREE.Color().setHSL(0.02 + Math.random() * 0.015, 1, 0.56 + Math.random() * 0.08),
      });
    }

    // 1. 主火团：空爆主体
    for (let i = 0; i < fireballCount; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 30 + Math.random() * 22,
        life: 1.2 + Math.random() * 0.72,
        size: fireballSize + Math.random() * (fireballSize * 0.85),
        color: new THREE.Color().setHSL(0.01 + Math.random() * 0.02, 1, 0.38 + Math.random() * 0.06),
      });
    }

    // 2. 破片火花：强调防空炮“破片感”
    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 80 + Math.random() * 35,
        life: 0.58 + Math.random() * 0.38,
        size: 0.18 + Math.random() * 0.18,
        color: new THREE.Color().setHSL(0.01 + Math.random() * 0.015, 1, 0.44 + Math.random() * 0.08),
      });
    }

    // 3. 冲击波环：分阶段扩散，帮助玩家读到“爆炸半径与时间”
    this.emitFlakRing(position, visualRadius * 0.24, ringCount, 0.34, 0.9, 22, 0.38, 0xff7048);
    const secondRingPos = position.clone();
    this.scheduleBurst(0.1, () => {
      this.emitFlakRing(
        secondRingPos,
        visualRadius * 0.46,
        Math.max(10, Math.floor(ringCount * 0.9)),
        0.32,
        1.06,
        20,
        0.28,
        0xff5638
      );
    });
    const thirdRingPos = position.clone();
    this.scheduleBurst(0.2, () => {
      this.emitFlakRing(
        thirdRingPos,
        visualRadius * 0.68,
        Math.max(8, Math.floor(ringCount * 0.75)),
        0.28,
        1.16,
        18,
        0.22,
        0xff4634
      );
    });

    // 4. 烟雾体积层：两段出现，既看得见时序又不过量
    const smokePosition = position.clone();
    this.scheduleBurst(0.08, () => {
      for (let i = 0; i < Math.floor(14 * radiusScale); i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 8 + Math.random() * 6,
          life: 3.8 + Math.random() * 2.1,
          size: smokeSize + Math.random() * (smokeSize * 0.8),
          color: new THREE.Color().setHSL(0, 0, 0.1 + Math.random() * 0.07),
        });
      }
    });
    const smokeShellPosition = position.clone();
    this.scheduleBurst(0.24, () => {
      for (let i = 0; i < Math.floor(12 * radiusScale); i++) {
        const angle = (i / Math.max(1, Math.floor(12 * radiusScale))) * Math.PI * 2;
        const shellPos = new THREE.Vector3(
          smokeShellPosition.x + Math.cos(angle) * visualRadius * 0.42,
          smokeShellPosition.y + (Math.random() - 0.5) * 4.2,
          smokeShellPosition.z + Math.sin(angle) * visualRadius * 0.42
        );
        this.spawnParticle(ParticleType.SMOKE, shellPos, {
          speed: 4 + Math.random() * 3.8,
          life: 3.2 + Math.random() * 1.7,
          size: shellSmokeSize + Math.random() * (shellSmokeSize * 0.75),
          color: new THREE.Color().setHSL(0, 0, 0.08 + Math.random() * 0.07),
        });
      }
    });
  }

  private emitFlakRing(
    center: THREE.Vector3,
    ringRadius: number,
    count: number,
    sizeBase: number,
    lifeBase: number,
    speedBase: number,
    verticalJitter: number,
    color: number = 0xffbe74
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const pos = new THREE.Vector3(
        center.x + Math.cos(angle) * ringRadius,
        center.y + (Math.random() - 0.5) * verticalJitter,
        center.z + Math.sin(angle) * ringRadius
      );
      const particle = this.spawnParticle(ParticleType.EXPLOSION, pos, {
        speed: 0,
        life: lifeBase + Math.random() * 0.12,
        size: sizeBase + Math.random() * 0.06,
        color: new THREE.Color(color),
      });
      if (!particle) {
        continue;
      }
      particle.velocity.set(
        Math.cos(angle) * (speedBase + Math.random() * 8),
        (Math.random() - 0.5) * 2,
        Math.sin(angle) * (speedBase + Math.random() * 8)
      );
    }
  }

  private applyDirectedBackVelocity(
    particle: Particle | null,
    speed: number,
    jitterY: number = 0
  ): void {
    if (!particle) return;
    particle.velocity.copy(this.directedVelocity).multiplyScalar(-speed);
    if (jitterY > 0) {
      particle.velocity.y += (Math.random() - 0.5) * jitterY;
    }
  }

  public createTeleportOut(position: THREE.Vector3): void {
    const particleCount = 50;
    const blueColor = new THREE.Color(0x00aaff);

    for (let i = 0; i < particleCount; i++) {
      const speed = 30 + Math.random() * 20;

      this.spawnParticle(ParticleType.SPARK, position, {
        speed: speed,
        life: 0.3 + Math.random() * 0.3,
        size: 0.5 + Math.random() * 0.5,
        color: blueColor.clone(),
      });
    }

    for (let i = 0; i < 20; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 40 + Math.random() * 20,
        life: 0.2 + Math.random() * 0.2,
        size: 1 + Math.random() * 1.5,
        color: new THREE.Color().setHSL(0.55, 1, 0.6),
      });
    }
  }

  public createTeleportIn(position: THREE.Vector3): void {
    const particleCount = 50;
    const blueColor = new THREE.Color(0x00aaff);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const offset = new THREE.Vector3(
        Math.cos(angle) * (5 + Math.random() * 10),
        Math.random() * 10,
        Math.sin(angle) * (5 + Math.random() * 10)
      );

      this.spawnParticle(ParticleType.SPARK, offset.add(position), {
        speed: 0,
        life: 0.4 + Math.random() * 0.2,
        size: 0.3 + Math.random() * 0.3,
        color: blueColor.clone(),
      });
    }

    for (let i = 0; i < 15; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 20,
        life: 0.3,
        size: 1.5 + Math.random() * 1,
        color: new THREE.Color().setHSL(0.55, 1, 0.7),
      });
    }
  }

  public createLaserBeam(start: THREE.Vector3, end: THREE.Vector3, color: number = 0x00aaff): void {
    const laserColor = new THREE.Color(color);
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const pos = start.clone().lerp(end, t);

      this.spawnParticle(ParticleType.SPARK, pos, {
        speed: 5 + Math.random() * 5,
        life: 0.2 + Math.random() * 0.1,
        size: 0.3 + Math.random() * 0.2,
        color: laserColor.clone(),
      });
    }
  }

  public createTentacleExplosion(position: THREE.Vector3): void {
    const particleCount = 40;

    for (let i = 0; i < particleCount * 0.3; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 40 + Math.random() * 30,
        life: 0.3 + Math.random() * 0.3,
        size: 0.8 + Math.random() * 1.2,
        color: new THREE.Color().setHSL(0.08, 0.9, 0.6),
      });
    }

    for (let i = 0; i < particleCount * 0.4; i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 25 + Math.random() * 20,
        life: 0.8 + Math.random() * 0.8,
        size: 0.3 + Math.random() * 0.4,
        color: new THREE.Color(0x666666),
        gravity: true,
      });
    }

    for (let i = 0; i < particleCount * 0.2; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 60 + Math.random() * 40,
        life: 0.3 + Math.random() * 0.3,
        size: 0.2 + Math.random() * 0.3,
        color: new THREE.Color(0xffaa00),
      });
    }

    const smokePosition = position.clone();
    this.scheduleBurst(0.05, () => {
      for (let i = 0; i < particleCount * 0.2; i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 8,
          life: 1 + Math.random() * 1,
          size: 2 + Math.random() * 3,
          color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.2),
        });
      }
    });
  }

  /**
   * 生成单个粒子
   */
  private spawnParticle(
    type: ParticleType,
    position: THREE.Vector3,
    options: {
      speed: number;
      life: number;
      size: number;
      color: THREE.Color;
      gravity?: boolean;
    }
  ): Particle | null {
    const particle = this.acquireParticle();
    if (!particle) {
      return null;
    }

    const geometry = this.geometries.get(type);
    const baseMaterial = this.materials.get(type);

    if (!geometry || !baseMaterial) return null;

    this.spawnDirection
      .set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
      .normalize()
      .multiplyScalar(options.speed);

    const material = particle.mesh.material as THREE.MeshBasicMaterial;
    material.color.copy(options.color);
    material.transparent = baseMaterial.transparent;
    material.opacity = baseMaterial.opacity;

    particle.mesh.geometry = geometry;
    particle.mesh.position.copy(position);
    particle.mesh.scale.setScalar(options.size);
    particle.mesh.rotation.set(0, 0, 0);
    particle.mesh.visible = true;

    particle.position.copy(position);
    particle.velocity.copy(this.spawnDirection);
    particle.life = options.life;
    particle.maxLife = options.life;
    particle.size = options.size;
    particle.type = type;
    particle.active = true;

    this.activeParticles.push(particle);
    return particle;
  }

  private acquireParticle(): Particle | null {
    const pooledParticle = this.particlePool.pop();
    if (pooledParticle) {
      return pooledParticle;
    }

    if (this.totalParticles < this.maxParticles) {
      this.totalParticles++;
      return this.createParticleSlot();
    }

    if (this.activeParticles.length === 0) {
      return null;
    }

    const recycledParticle = this.activeParticles[0];
    this.releaseParticleAtIndex(0);
    return recycledParticle;
  }

  private createParticleSlot(): Particle {
    const initialGeometry = this.geometries.get(ParticleType.EXPLOSION) as THREE.BufferGeometry;
    const initialMaterial = (
      this.materials.get(ParticleType.EXPLOSION) as THREE.MeshBasicMaterial
    ).clone();
    const mesh = new THREE.Mesh(initialGeometry, initialMaterial);
    mesh.visible = false;
    this.particleMeshes.add(mesh);

    return {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      mesh,
      maxLife: 0,
      size: 1,
      type: ParticleType.EXPLOSION,
      active: false,
    };
  }

  private scheduleBurst(delaySeconds: number, emit: () => void): void {
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

      this.delayedBursts.splice(i, 1);
      burst.emit();
    }
  }

  private releaseParticleAtIndex(index: number): void {
    const particle = this.activeParticles[index];
    particle.active = false;
    particle.life = 0;
    particle.mesh.visible = false;
    particle.mesh.scale.setScalar(0.0001);
    particle.mesh.position.set(0, -9999, 0);

    const lastIndex = this.activeParticles.length - 1;
    if (index !== lastIndex) {
      this.activeParticles[index] = this.activeParticles[lastIndex];
    }
    this.activeParticles.pop();
    this.particlePool.push(particle);
  }

  /**
   * 更新所有粒子
   */
  public update(deltaTime: number): void {
    this.flushDelayedBursts(deltaTime);

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const particle = this.activeParticles[i];
      if (!particle.active) continue;

      // 更新生命值
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        this.releaseParticleAtIndex(i);
        continue;
      }

      // 更新位置
      particle.velocity.addScaledVector(this.gravity, deltaTime * 0.3);
      particle.position.addScaledVector(particle.velocity, deltaTime);

      particle.mesh.position.copy(particle.position);

      // 更新透明度
      const lifeRatio = particle.life / particle.maxLife;
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = lifeRatio;

      // 更新大小（烟雾逐渐变大）
      if (particle.type === ParticleType.SMOKE) {
        const scale = particle.size * (1 + (1 - lifeRatio) * 2);
        particle.mesh.scale.setScalar(scale);
      }

      // 旋转碎片
      if (particle.type === ParticleType.DEBRIS) {
        particle.mesh.rotation.x += deltaTime * 5;
        particle.mesh.rotation.y += deltaTime * 3;
      }
    }
  }

  /**
   * 清除所有粒子
   */
  public clear(): void {
    this.delayedBursts = [];

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      this.releaseParticleAtIndex(i);
    }
  }

  /**
   * 获取活跃粒子数量
   */
  public getActiveCount(): number {
    return this.activeParticles.length;
  }

  public dispose(): void {
    this.clear();

    const allParticles = [...this.particlePool, ...this.activeParticles];
    for (const particle of allParticles) {
      this.particleMeshes.remove(particle.mesh);
      (particle.mesh.material as THREE.Material).dispose();
    }

    this.particlePool = [];
    this.activeParticles = [];
    this.particleMeshes.removeFromParent();
  }
}
