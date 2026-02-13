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
  color: THREE.Color;
  type: ParticleType;
  mesh?: THREE.Mesh;
  active: boolean;
}

/**
 * 粒子效果管理器
 */
export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private particleMeshes: THREE.Group;
  private maxParticles: number;

  // 几何体和材质缓存
  private geometries: Map<ParticleType, THREE.BufferGeometry> = new Map();
  private materials: Map<ParticleType, THREE.Material> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleMeshes = new THREE.Group();
    this.particleMeshes.name = 'particles';
    this.scene.add(this.particleMeshes);

    this.maxParticles = GameConfig.isMobile ? 200 : 500;

    // 初始化几何体和材质
    this.initAssets();
  }

  /**
   * 初始化粒子资源
   */
  private initAssets(): void {
    // 爆炸粒子 - 球体
    this.geometries.set(ParticleType.EXPLOSION, new THREE.SphereGeometry(0.5, 8, 8));
    this.materials.set(ParticleType.EXPLOSION, new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 1,
    }));

    // 烟雾粒子 - 大球体
    this.geometries.set(ParticleType.SMOKE, new THREE.SphereGeometry(1, 8, 8));
    this.materials.set(ParticleType.SMOKE, new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.6,
    }));

    // 火花粒子 - 小球体
    this.geometries.set(ParticleType.SPARK, new THREE.SphereGeometry(0.1, 4, 4));
    this.materials.set(ParticleType.SPARK, new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    }));

    // 火焰粒子
    this.geometries.set(ParticleType.FIRE, new THREE.SphereGeometry(0.3, 8, 8));
    this.materials.set(ParticleType.FIRE, new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
    }));

    // 碎片粒子 - 方块
    this.geometries.set(ParticleType.DEBRIS, new THREE.BoxGeometry(0.3, 0.3, 0.3));
    this.materials.set(ParticleType.DEBRIS, new THREE.MeshBasicMaterial({
      color: 0x666666,
    }));
  }

  /**
   * 创建爆炸效果
   */
  public createExplosion(position: THREE.Vector3, scale: number = 1): void {
    const particleCount = Math.floor(30 * scale);

    // 火焰核心
    for (let i = 0; i < particleCount * 0.4; i++) {
      this.spawnParticle(ParticleType.FIRE, position.clone(), {
        speed: 20 * scale,
        life: 0.3 + Math.random() * 0.3,
        size: 0.5 + Math.random() * 1.5,
        color: new THREE.Color().setHSL(0.05 + Math.random() * 0.1, 1, 0.5),
      });
    }

    // 爆炸光芒
    for (let i = 0; i < particleCount * 0.3; i++) {
      this.spawnParticle(ParticleType.EXPLOSION, position.clone(), {
        speed: 30 * scale,
        life: 0.2 + Math.random() * 0.4,
        size: 0.3 + Math.random() * 1,
        color: new THREE.Color().setHSL(0.08, 1, 0.6),
      });
    }

    // 火花
    for (let i = 0; i < particleCount * 0.2; i++) {
      this.spawnParticle(ParticleType.SPARK, position.clone(), {
        speed: 50 * scale,
        life: 0.5 + Math.random() * 0.5,
        size: 0.1 + Math.random() * 0.2,
        color: new THREE.Color(0xffff00),
      });
    }

    // 碎片
    for (let i = 0; i < particleCount * 0.1; i++) {
      this.spawnParticle(ParticleType.DEBRIS, position.clone(), {
        speed: 15 * scale,
        life: 1 + Math.random() * 1,
        size: 0.2 + Math.random() * 0.3,
        color: new THREE.Color(0x666666),
        gravity: true,
      });
    }

    // 烟雾（延迟）
    setTimeout(() => {
      for (let i = 0; i < particleCount * 0.3; i++) {
        this.spawnParticle(ParticleType.SMOKE, position.clone(), {
          speed: 5 * scale,
          life: 2 + Math.random() * 2,
          size: 2 + Math.random() * 3,
          color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.3),
        });
      }
    }, 100);
  }

  /**
   * 创建击中效果
   */
  public createHit(position: THREE.Vector3): void {
    // 小型火花
    for (let i = 0; i < 10; i++) {
      this.spawnParticle(ParticleType.SPARK, position.clone(), {
        speed: 20,
        life: 0.2 + Math.random() * 0.3,
        size: 0.1 + Math.random() * 0.2,
        color: new THREE.Color(0xffaa00),
      });
    }
  }

  /**
   * 创建尾迹效果
   */
  public createTrail(position: THREE.Vector3, color: THREE.Color): void {
    this.spawnParticle(ParticleType.SMOKE, position.clone(), {
      speed: 2,
      life: 0.3,
      size: 0.3,
      color: color.clone(),
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
  ): void {
    // 检查粒子数量限制
    if (this.particles.length >= this.maxParticles) {
      // 移除最老的粒子
      const oldParticle = this.particles.shift();
      if (oldParticle?.mesh) {
        this.particleMeshes.remove(oldParticle.mesh);
      }
    }

    // 随机方向
    const direction = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize();

    const velocity = direction.multiplyScalar(options.speed);

    // 创建网格
    const geometry = this.geometries.get(type);
    const baseMaterial = this.materials.get(type);

    if (!geometry || !baseMaterial) return;

    const material = baseMaterial.clone();
    (material as THREE.MeshBasicMaterial).color = options.color;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.scale.setScalar(options.size);
    this.particleMeshes.add(mesh);

    // 创建粒子数据
    const particle: Particle = {
      position: position.clone(),
      velocity,
      life: options.life,
      maxLife: options.life,
      size: options.size,
      color: options.color,
      type,
      mesh,
      active: true,
    };

    this.particles.push(particle);
  }

  /**
   * 更新所有粒子
   */
  public update(deltaTime: number): void {
    const gravity = new THREE.Vector3(0, -9.8, 0);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      // 更新生命值
      particle.life -= deltaTime;

      if (particle.life <= 0) {
        // 移除死亡粒子
        if (particle.mesh) {
          this.particleMeshes.remove(particle.mesh);
          particle.mesh.geometry.dispose();
          (particle.mesh.material as THREE.Material).dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }

      // 更新位置
      particle.velocity.add(gravity.clone().multiplyScalar(deltaTime * 0.3));
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

      if (particle.mesh) {
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
  }

  /**
   * 清除所有粒子
   */
  public clear(): void {
    for (const particle of this.particles) {
      if (particle.mesh) {
        this.particleMeshes.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
      }
    }
    this.particles = [];
  }

  /**
   * 获取活跃粒子数量
   */
  public getActiveCount(): number {
    return this.particles.length;
  }
}
