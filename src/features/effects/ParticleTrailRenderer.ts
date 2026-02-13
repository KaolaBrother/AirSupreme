import * as THREE from 'three';

/**
 * 粒子尾迹效果
 * 使用粒子系统代替线条，让尾迹更粗更明显
 */
export class ParticleTrailRenderer {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private maxParticles: number = 25;
  private spawnInterval: number = 0.2; // 每0.2秒生成一个粒子
  private spawnTimer: number = 0;

  // 粒子材质（复用）
  private material: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene, _owner: THREE.Object3D, color: number = 0x00ffff) {
    this.scene = scene;

    // 创建圆形渐变纹理
    const texture = this.createParticleTexture();

    this.material = new THREE.SpriteMaterial({
      map: texture,
      color: color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthWrite: false, // 不写入深度缓冲，让尾迹看起来更柔和
    });
  }

  /**
   * 创建粒子纹理（渐变圆形）
   */
  private createParticleTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get 2D context');
    }

    // 创建径向渐变（中心亮，边缘透明）
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 添加新位置点（每帧调用）
   * @param position - 位置
   * @param offset - 从位置偏移（例如飞机尾部的偏移）
   */
  public addPoint(position: THREE.Vector3, offset?: THREE.Vector3): void {
    this.spawnTimer += 0.016; // 假设60fps

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // 如果有偏移，加上偏移
      const spawnPosition = offset ? position.clone().add(offset) : position;
      this.spawnParticle(spawnPosition);
    }
  }

  /**
   * 生成一个粒子
   */
  private spawnParticle(position: THREE.Vector3): void {
    // 如果粒子数量达到最大值，移除最旧的粒子
    if (this.particles.length >= this.maxParticles) {
      const oldest = this.particles.shift();
      if (oldest) {
        this.scene.remove(oldest.sprite);
        oldest.sprite.material.dispose();
      }
    }

    // 创建精灵粒子
    const sprite = new THREE.Sprite(this.material.clone());
    sprite.position.copy(position);

    // 随机大小
    const baseSize = 2.5;
    const randomVariation = 0.8 + Math.random() * 0.2;
    sprite.scale.set(baseSize * randomVariation, baseSize * randomVariation, 1);

    this.scene.add(sprite);

    // 添加到粒子列表
    const particle: Particle = {
      sprite,
      life: 1.0, // 生命值 1.0 -> 0.0
      decay: 0.008 + Math.random() * 0.004, // 随机淡出速度
      initialScale: baseSize * randomVariation,
    };
    this.particles.push(particle);
  }

  /**
   * 更新尾迹（每帧调用）
   */
  public update(deltaTime: number): void {
    // 更新所有粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= particle.decay * deltaTime * 60;

      // 更新透明度
      if (particle.sprite.material instanceof THREE.SpriteMaterial) {
        particle.sprite.material.opacity = Math.max(0, particle.life * 0.8);
      }

      // 粒子逐渐变小
      const scale = particle.initialScale * particle.life;
      particle.sprite.scale.set(scale, scale, 1);

      // 移除死亡粒子
      if (particle.life <= 0) {
        this.scene.remove(particle.sprite);
        particle.sprite.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    for (const particle of this.particles) {
      this.scene.remove(particle.sprite);
      particle.sprite.material.dispose();
    }
    this.particles = [];
    this.material.dispose();
  }
}

/**
 * 粒子数据结构
 */
interface Particle {
  sprite: THREE.Sprite;
  life: number;
  decay: number;
  initialScale: number;
}
