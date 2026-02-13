import * as THREE from 'three';

/**
 * 敌人生成传送门效果
 * 持续 5 秒的显眼生成动画
 */
export class SpawnPortal {
  private group: THREE.Group;
  private ring1: THREE.Mesh;
  private ring2: THREE.Mesh;
  private ring3: THREE.Mesh;
  private coreSphere: THREE.Mesh;
  private outerGlow: THREE.Mesh;

  private particleSystem: THREE.Points;
  private particleCount: number = 100;
  private particleSpeeds: number[] = [];

  private lifetime: number = 0;
  private maxLifetime: number = 5; // 5秒生成时间
  private isComplete: boolean = false;

  private onComplete?: () => void;

  constructor(position: THREE.Vector3, onComplete?: () => void) {
    this.onComplete = onComplete;
    this.group = new THREE.Group();
    this.group.position.copy(position);

    this.createPortalEffect();
    this.createParticles();
  }

  /**
   * 创建传送门视觉效果
   */
  private createPortalEffect(): void {
    // 材质
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.3,
    });

    // 核心（明亮的球体）
    const coreGeometry = new THREE.SphereGeometry(2, 32, 32);
    this.coreSphere = new THREE.Mesh(coreGeometry, coreMaterial);
    this.coreSphere.scale.set(0, 0, 0); // 从零开始
    this.group.add(this.coreSphere);

    // 内环（小环）
    const ring1Geometry = new THREE.TorusGeometry(4, 0.5, 16, 100);
    this.ring1 = new THREE.Mesh(ring1Geometry, ringMaterial);
    this.ring1.rotation.x = Math.PI / 2;
    this.ring1.scale.set(0, 0, 0);
    this.group.add(this.ring1);

    // 中环（中等）
    const ring2Geometry = new THREE.TorusGeometry(6, 0.8, 16, 100);
    this.ring2 = new THREE.Mesh(ring2Geometry, ringMaterial);
    this.ring2.rotation.x = Math.PI / 2;
    this.ring2.scale.set(0, 0, 0);
    this.group.add(this.ring2);

    // 外环（大环）
    const ring3Geometry = new THREE.TorusGeometry(8, 1, 16, 100);
    this.ring3 = new THREE.Mesh(ring3Geometry, ringMaterial);
    this.ring3.rotation.x = Math.PI / 2;
    this.ring3.scale.set(0, 0, 0);
    this.group.add(this.ring3);

    // 外发光球
    const glowGeometry = new THREE.SphereGeometry(12, 32, 32);
    this.outerGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.outerGlow.scale.set(0, 0, 0);
    this.group.add(this.outerGlow);
  }

  /**
   * 创建粒子系统
   */
  private createParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    const color1 = new THREE.Color(0x00ffff);
    const color2 = new THREE.Color(0xff00ff);

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // 螺旋分布
      const angle = (i / this.particleCount) * Math.PI * 2 * 5; // 5圈螺旋
      const radius = 3 + (i / this.particleCount) * 8;
      const height = (i / this.particleCount - 0.5) * 10;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = height;
      positions[i3 + 2] = Math.sin(angle) * radius;

      // 颜色渐变
      const t = i / this.particleCount;
      const color = color1.clone().lerp(color2, t);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      // 粒子速度（随机）
      this.particleSpeeds[i] = 5 + Math.random() * 10;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.particleSystem.visible = false; // 初始隐藏
    this.group.add(this.particleSystem);
  }

  /**
   * 更新传送门动画
   */
  public update(deltaTime: number): void {
    if (this.isComplete) return;

    this.lifetime += deltaTime;
    const progress = this.lifetime / this.maxLifetime;

    // 1. 扩展动画（0-2秒）
    if (progress < 0.4) {
      const expandProgress = progress / 0.4;
      const scale = this.easeOutBack(expandProgress);

      this.coreSphere.scale.set(scale * 1.5, scale * 1.5, scale * 1.5);
      this.ring1.scale.set(scale, scale, scale);
      this.ring2.scale.set(scale * 0.9, scale * 0.9, scale * 0.9);
      this.ring3.scale.set(scale * 0.8, scale * 0.8, scale * 0.8);
      this.outerGlow.scale.set(scale * 2, scale * 2, scale * 2);
    }

    // 2. 持续旋转和脉动（整个生命周期）
    const rotationSpeed = 2;
    this.ring1.rotation.z += rotationSpeed * deltaTime;
    this.ring2.rotation.z -= rotationSpeed * 1.5 * deltaTime;
    this.ring3.rotation.z += rotationSpeed * 2 * deltaTime;

    // 脉动效果
    const pulse = 1 + Math.sin(this.lifetime * 4) * 0.1;
    this.coreSphere.scale.multiplyScalar(pulse);

    // 颜色循环
    const hue = (this.lifetime * 0.5) % 1;
    const color = new THREE.Color().setHSL(hue, 1, 0.5);
    (this.ring1.material as THREE.MeshBasicMaterial).color = color;
    (this.ring2.material as THREE.MeshBasicMaterial).color = color;
    (this.ring3.material as THREE.MeshBasicMaterial).color = color;

    // 3. 粒子效果（1-4秒）
    if (progress > 0.2 && progress < 0.8) {
      this.particleSystem.visible = true;

      // 粒子向外扩散
      const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3;
        const speed = this.particleSpeeds[i] * deltaTime;

        // 从中心向外扩散
        const dx = positions[i3];
        const dy = positions[i3 + 1];
        const dz = positions[i3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > 0) {
          positions[i3] += (dx / dist) * speed;
          positions[i3 + 1] += (dy / dist) * speed * 0.5;
          positions[i3 + 2] += (dz / dist) * speed;
        }
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    } else {
      this.particleSystem.visible = false;
    }

    // 4. 收缩消失（4-5秒）
    if (progress > 0.8) {
      const fadeProgress = (progress - 0.8) / 0.2;
      const fadeScale = 1 - fadeProgress;

      this.coreSphere.scale.multiplyScalar(fadeScale);
      this.ring1.scale.multiplyScalar(fadeScale);
      this.ring2.scale.multiplyScalar(fadeScale);
      this.ring3.scale.multiplyScalar(fadeScale);
      this.outerGlow.scale.multiplyScalar(fadeScale);

      // 淡出透明度
      const opacity = 1 - fadeProgress;
      (this.coreSphere.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
      (this.ring1.material as THREE.MeshBasicMaterial).opacity = opacity * 0.6;
      (this.ring2.material as THREE.MeshBasicMaterial).opacity = opacity * 0.6;
      (this.ring3.material as THREE.MeshBasicMaterial).opacity = opacity * 0.6;
      (this.outerGlow.material as THREE.MeshBasicMaterial).opacity = opacity * 0.3;
    }

    // 完成检查
    if (this.lifetime >= this.maxLifetime) {
      this.isComplete = true;
      this.onComplete?.();
    }
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
   * 获取传送门的 Group
   */
  public getMesh(): THREE.Group {
    return this.group;
  }

  /**
   * 是否完成
   */
  public isFinished(): boolean {
    return this.isComplete;
  }

  /**
   * 销毁传送门
   */
  public dispose(): void {
    this.group.removeFromParent();

    // 释放几何体和材质
    this.coreSphere.geometry.dispose();
    (this.coreSphere.material as THREE.Material).dispose();

    this.ring1.geometry.dispose();
    (this.ring1.material as THREE.Material).dispose();

    this.ring2.geometry.dispose();
    (this.ring2.material as THREE.Material).dispose();

    this.ring3.geometry.dispose();
    (this.ring3.material as THREE.Material).dispose();

    this.outerGlow.geometry.dispose();
    (this.outerGlow.material as THREE.Material).dispose();

    this.particleSystem.geometry.dispose();
    (this.particleSystem.material as THREE.Material).dispose();
  }
}
