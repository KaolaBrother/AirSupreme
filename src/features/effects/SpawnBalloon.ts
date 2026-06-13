import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

/**
 * 气球生成效果
 * 从上方降落并弹出，持续 2 秒
 */
export class SpawnBalloon {
  private group: Group;
  private glowSphere!: Mesh;
  private ring!: Mesh;
  private starParticles!: Points;

  private lifetime: number = 0;
  private maxLifetime: number = 2; // 2秒生成时间
  private isComplete: boolean = false;
  private isCancelled: boolean = false; // 标记是否被取消

  private onComplete?: () => void;

  constructor(position: Vector3, onComplete?: () => void) {
    this.onComplete = onComplete;
    this.group = new Group();
    this.group.position.copy(position);

    this.createSpawnEffect();
  }

  /**
   * 创建生成视觉效果
   */
  private createSpawnEffect(): void {
    // 材质
    const glowMaterial = new MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
    });

    const ringMaterial = new MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
      side: DoubleSide,
    });

    // 中心发光球
    const glowGeometry = new SphereGeometry(3, 32, 32);
    this.glowSphere = new Mesh(glowGeometry, glowMaterial);
    this.glowSphere.scale.set(0, 0, 0);
    this.group.add(this.glowSphere);

    // 扩散环
    const ringGeometry = new TorusGeometry(4, 0.3, 16, 100);
    this.ring = new Mesh(ringGeometry, ringMaterial);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.scale.set(0, 0, 0);
    this.group.add(this.ring);

    // 星星粒子
    this.createStarParticles();
  }

  /**
   * 创建星星粒子系统
   */
  private createStarParticles(): void {
    const particleCount = 30;
    const geometry = new BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // 随机分布在球面上
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = 5;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.cos(phi);
      positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // 金黄色
      colors[i3] = 1.0;
      colors[i3 + 1] = 0.84;
      colors[i3 + 2] = 0.0;
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));

    const material = new PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    });

    this.starParticles = new Points(geometry, material);
    this.starParticles.visible = false;
    this.group.add(this.starParticles);
  }

  /**
   * 更新生成动画
   */
  public update(deltaTime: number): void {
    if (this.isComplete || this.isCancelled) return;

    this.lifetime += deltaTime;
    const progress = Math.min(1, this.lifetime / this.maxLifetime);

    // 1. 扩展动画（0-0.5秒）
    if (progress < 0.25) {
      const expandProgress = progress / 0.25;
      const scale = this.easeOutBack(expandProgress);

      this.glowSphere.scale.set(scale, scale, scale);
      this.ring.scale.set(scale * 1.5, scale * 1.5, scale * 1.5);
    } else {
      this.glowSphere.scale.setScalar(1);
      this.ring.scale.setScalar(1.5);
    }

    // 2. 持续旋转和脉动（整个生命周期）
    const rotationSpeed = 3;
    this.ring.rotation.z += rotationSpeed * deltaTime;

    // 脉动效果
    const pulse = 1 + Math.sin(this.lifetime * 6) * 0.15;
    if (progress >= 0.25 && progress <= 0.75) {
      this.glowSphere.scale.setScalar(pulse);
      this.ring.scale.setScalar(1.5 * pulse);
    }

    // 3. 星星粒子效果（0.3-1.5秒）
    if (progress > 0.15 && progress < 0.75) {
      this.starParticles.visible = true;

      // 粒子向外扩散
      const positions = this.starParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const speed = 8 * deltaTime;

        // 从中心向外扩散
        const dx = positions[i];
        const dy = positions[i + 1];
        const dz = positions[i + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > 0) {
          positions[i] += (dx / dist) * speed;
          positions[i + 1] += (dy / dist) * speed;
          positions[i + 2] += (dz / dist) * speed;
        }
      }
      this.starParticles.geometry.attributes.position.needsUpdate = true;
    } else {
      this.starParticles.visible = false;
    }

    // 4. 收缩消失（1.5-2秒）
    if (progress > 0.75) {
      const fadeProgress = Math.min(1, (progress - 0.75) / 0.25);
      const fadeScale = 1 - fadeProgress;

      this.glowSphere.scale.setScalar(fadeScale * pulse);
      this.ring.scale.setScalar(fadeScale * 1.5);

      // 淡出透明度
      const opacity = 1 - fadeProgress;
      (this.glowSphere.material as MeshBasicMaterial).opacity = opacity * 0.6;
      (this.ring.material as MeshBasicMaterial).opacity = opacity * 0.5;
    }

    // 完成检查
    if (this.lifetime >= this.maxLifetime && !this.isCancelled) {
      this.isComplete = true;
      this.onComplete?.();
    }
  }

  /**
   * 取消生成（气球被提前打破）
   */
  public cancel(): void {
    this.isCancelled = true;
    this.isComplete = true;
  }

  /**
   * 弹性缓动函数
   */
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * 获取特效的 Group
   */
  public getMesh(): Group {
    return this.group;
  }

  /**
   * 是否完成
   */
  public isFinished(): boolean {
    return this.isComplete || this.isCancelled;
  }

  /**
   * 是否被取消
   */
  public isCancelledState(): boolean {
    return this.isCancelled;
  }

  /**
   * 销毁特效
   */
  public dispose(): void {
    this.group.removeFromParent();

    // 释放几何体和材质
    this.glowSphere.geometry.dispose();
    (this.glowSphere.material as Material).dispose();

    this.ring.geometry.dispose();
    (this.ring.material as Material).dispose();

    this.starParticles.geometry.dispose();
    (this.starParticles.material as Material).dispose();
  }
}
