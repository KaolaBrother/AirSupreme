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
  public createExplosion(position: THREE.Vector3, scale: number = 1): void {
    const particleCount = Math.floor(30 * scale);

    // 火焰核心
    for (let i = 0; i < particleCount * 0.4; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 20 * scale,
        life: 0.3 + Math.random() * 0.3,
        size: 0.5 + Math.random() * 1.5,
        color: new THREE.Color().setHSL(0.05 + Math.random() * 0.1, 1, 0.5),
      });
    }

    // 爆炸光芒
    for (let i = 0; i < particleCount * 0.3; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 30 * scale,
        life: 0.2 + Math.random() * 0.4,
        size: 0.3 + Math.random() * 1,
        color: new THREE.Color().setHSL(0.08, 1, 0.6),
      });
    }

    // 火花
    for (let i = 0; i < particleCount * 0.2; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 50 * scale,
        life: 0.5 + Math.random() * 0.5,
        size: 0.1 + Math.random() * 0.2,
        color: new THREE.Color(0xffff00),
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

    // 烟雾延迟到 update 内处理，避免高频 setTimeout 对主线程造成压力
    const smokePosition = position.clone();
    this.scheduleBurst(0.1, () => {
      for (let i = 0; i < particleCount * 0.3; i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 5 * scale,
          life: 2 + Math.random() * 2,
          size: 2 + Math.random() * 3,
          color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.3),
        });
      }
    });
  }

  /**
   * 创建击中效果
   */
  public createHit(position: THREE.Vector3, intensity: number = 1): void {
    const sparkCount = Math.max(6, Math.floor(10 * intensity));

    // 高频火花层：让普通命中更明确
    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 18 + Math.random() * 18 * intensity,
        life: 0.12 + Math.random() * 0.18,
        size: 0.08 + Math.random() * 0.16 * intensity,
        color: new THREE.Color().setHSL(0.1, 1, 0.62),
      });
    }

    // 擦伤热区：短寿命橙白闪
    for (let i = 0; i < Math.max(2, Math.floor(4 * intensity)); i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 8 + Math.random() * 12,
        life: 0.08 + Math.random() * 0.12,
        size: 0.14 + Math.random() * 0.2 * intensity,
        color: new THREE.Color().setHSL(0.075, 0.95, 0.72),
      });
    }

    // 轻微烟痕，增加冲击感但不抢镜
    const smokePosition = position.clone();
    this.scheduleBurst(0.03, () => {
      for (let i = 0; i < Math.max(1, Math.floor(3 * intensity)); i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 2 + Math.random() * 3,
          life: 0.18 + Math.random() * 0.18,
          size: 0.18 + Math.random() * 0.28 * intensity,
          color: new THREE.Color().setHSL(0.08, 0.12, 0.42 + Math.random() * 0.08),
        });
      }
    });
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
    this.trailColor.copy(color);
    this.directedVelocity.copy(direction).normalize();

    const smoke = this.spawnParticle(ParticleType.SMOKE, position, {
      speed: 3 + intensity * 2,
      life: 0.26 + Math.random() * 0.12,
      size: 0.28 + Math.random() * 0.18 * intensity,
      color: this.trailColor,
    });
    if (smoke) {
      smoke.velocity.copy(this.directedVelocity).multiplyScalar(-(8 + intensity * 5));
      smoke.velocity.y += (Math.random() - 0.5) * 1.5;
    }

    const flame = this.spawnParticle(ParticleType.FIRE, position, {
      speed: 5 + intensity * 3,
      life: 0.1 + Math.random() * 0.07,
      size: 0.18 + Math.random() * 0.14 * intensity,
      color: new THREE.Color().setHSL(0.085 + Math.random() * 0.03, 1, 0.58),
    });
    if (flame) {
      flame.velocity.copy(this.directedVelocity).multiplyScalar(-(15 + intensity * 8));
    }

    if (Math.random() < 0.4) {
      const spark = this.spawnParticle(ParticleType.SPARK, position, {
        speed: 6 + intensity * 3,
        life: 0.08 + Math.random() * 0.08,
        size: 0.08 + Math.random() * 0.06,
        color: new THREE.Color(0xffcc66),
      });
      if (spark) {
        spark.velocity.copy(this.directedVelocity).multiplyScalar(-(20 + intensity * 8));
      }
    }
  }

  public createMissileImpact(position: THREE.Vector3, scale: number = 1): void {
    const sparkCount = Math.max(10, Math.floor(14 * scale));

    for (let i = 0; i < Math.max(4, Math.floor(6 * scale)); i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 18 + Math.random() * 14,
        life: 0.12 + Math.random() * 0.12,
        size: 0.18 + Math.random() * 0.28 * scale,
        color: new THREE.Color().setHSL(0.08, 1, 0.72),
      });
    }

    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 34 + Math.random() * 30,
        life: 0.18 + Math.random() * 0.18,
        size: 0.08 + Math.random() * 0.12 * scale,
        color: new THREE.Color(0xffc15c),
      });
    }

    for (let i = 0; i < Math.max(3, Math.floor(5 * scale)); i++) {
      this.spawnParticle(ParticleType.DEBRIS, position, {
        speed: 14 + Math.random() * 10,
        life: 0.45 + Math.random() * 0.35,
        size: 0.12 + Math.random() * 0.14 * scale,
        color: new THREE.Color(0x5f6066),
        gravity: true,
      });
    }

    const smokePosition = position.clone();
    this.scheduleBurst(0.04, () => {
      for (let i = 0; i < Math.max(4, Math.floor(6 * scale)); i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 4 + Math.random() * 4,
          life: 0.45 + Math.random() * 0.35,
          size: 0.45 + Math.random() * 0.4 * scale,
          color: new THREE.Color().setHSL(0.08, 0.08, 0.34 + Math.random() * 0.08),
        });
      }
    });
  }

  public createBossMissileTrail(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.directedVelocity.copy(direction).normalize();

    const smoke = this.spawnParticle(ParticleType.SMOKE, position, {
      speed: 4,
      life: 0.4 + Math.random() * 0.16,
      size: 0.5 + Math.random() * 0.24,
      color: new THREE.Color().setHSL(0.03, 0.18, 0.4 + Math.random() * 0.06),
    });
    if (smoke) {
      smoke.velocity.copy(this.directedVelocity).multiplyScalar(-14);
      smoke.velocity.y += (Math.random() - 0.5) * 1.8;
    }

    const fireCore = this.spawnParticle(ParticleType.FIRE, position, {
      speed: 7,
      life: 0.14 + Math.random() * 0.1,
      size: 0.34 + Math.random() * 0.18,
      color: new THREE.Color().setHSL(0.055 + Math.random() * 0.025, 1, 0.54),
    });
    if (fireCore) {
      fireCore.velocity.copy(this.directedVelocity).multiplyScalar(-24);
    }

    const flare = this.spawnParticle(ParticleType.EXPLOSION, position, {
      speed: 5,
      life: 0.1 + Math.random() * 0.06,
      size: 0.22 + Math.random() * 0.12,
      color: new THREE.Color().setHSL(0.1, 1, 0.7),
    });
    if (flare) {
      flare.velocity.copy(this.directedVelocity).multiplyScalar(-18);
    }
  }

  public createBossMissileExplosion(position: THREE.Vector3, scale: number = 1.6): void {
    this.createExplosion(position, scale);
    this.createMissileImpact(position, scale * 1.1);

    for (let i = 0; i < Math.max(8, Math.floor(10 * scale)); i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 28 + Math.random() * 20,
        life: 0.28 + Math.random() * 0.24,
        size: 0.42 + Math.random() * 0.35 * scale,
        color: new THREE.Color().setHSL(0.04 + Math.random() * 0.03, 1, 0.5),
      });
    }
  }

  public createFlakExplosion(position: THREE.Vector3, radius: number = 50): void {
    const radiusScale = THREE.MathUtils.clamp(radius / 50, 0.8, 1.5);
    const coreCount = Math.floor(10 * radiusScale);
    const fireballCount = Math.floor(14 * radiusScale);
    const sparkCount = Math.floor(16 * radiusScale);
    const ringCount = Math.floor(18 * radiusScale);

    // 0. 爆心闪光层：短寿命高亮，强调命中时刻
    for (let i = 0; i < coreCount; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position, {
        speed: 35 + Math.random() * 25,
        life: 0.16 + Math.random() * 0.12,
        size: 0.55 + Math.random() * 0.8,
        color: new THREE.Color().setHSL(0.095, 0.9, 0.74),
      });
    }

    // 1. 主火团：空爆主体
    for (let i = 0; i < fireballCount; i++) {
      this.spawnParticle(ParticleType.FIRE, position, {
        speed: 34 + Math.random() * 24,
        life: 0.36 + Math.random() * 0.28,
        size: 0.42 + Math.random() * 0.58,
        color: new THREE.Color().setHSL(0.06 + Math.random() * 0.04, 1, 0.52),
      });
    }

    // 2. 破片火花：强调防空炮“破片感”
    for (let i = 0; i < sparkCount; i++) {
      this.spawnParticle(ParticleType.SPARK, position, {
        speed: 80 + Math.random() * 35,
        life: 0.24 + Math.random() * 0.24,
        size: 0.16 + Math.random() * 0.16,
        color: new THREE.Color(0xffd36b),
      });
    }

    // 3. 冲击波环：分阶段扩散，帮助玩家读到“爆炸半径与时间”
    this.emitFlakRing(position, radius * 0.22, ringCount, 0.07, 0.24, 22, 0.16);
    const secondRingPos = position.clone();
    this.scheduleBurst(0.06, () => {
      this.emitFlakRing(secondRingPos, radius * 0.42, Math.max(10, Math.floor(ringCount * 0.9)), 0.06, 0.26, 20, 0.12);
    });
    const thirdRingPos = position.clone();
    this.scheduleBurst(0.13, () => {
      this.emitFlakRing(thirdRingPos, radius * 0.62, Math.max(8, Math.floor(ringCount * 0.75)), 0.05, 0.28, 16, 0.1);
    });

    // 4. 烟雾体积层：两段出现，既看得见时序又不过量
    const smokePosition = position.clone();
    this.scheduleBurst(0.05, () => {
      for (let i = 0; i < Math.floor(10 * radiusScale); i++) {
        this.spawnParticle(ParticleType.SMOKE, smokePosition, {
          speed: 7 + Math.random() * 5,
          life: 1.2 + Math.random() * 0.8,
          size: 2.2 + Math.random() * 2,
          color: new THREE.Color().setHSL(0, 0, 0.2 + Math.random() * 0.16),
        });
      }
    });
    const smokeShellPosition = position.clone();
    this.scheduleBurst(0.14, () => {
      for (let i = 0; i < Math.floor(8 * radiusScale); i++) {
        const angle = (i / Math.max(1, Math.floor(8 * radiusScale))) * Math.PI * 2;
        const shellPos = new THREE.Vector3(
          smokeShellPosition.x + Math.cos(angle) * radius * 0.36,
          smokeShellPosition.y + (Math.random() - 0.5) * 3.4,
          smokeShellPosition.z + Math.sin(angle) * radius * 0.36
        );
        this.spawnParticle(ParticleType.SMOKE, shellPos, {
          speed: 4 + Math.random() * 4,
          life: 1.1 + Math.random() * 0.7,
          size: 1.7 + Math.random() * 1.4,
          color: new THREE.Color().setHSL(0, 0, 0.24 + Math.random() * 0.12),
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
    verticalJitter: number
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
        color: new THREE.Color().setHSL(0.09, 0.84, 0.68),
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
