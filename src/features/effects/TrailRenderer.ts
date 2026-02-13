import * as THREE from 'three';

/**
 * 飞迹/拖尾效果
 * 为飞机和敌人添加可见的飞行轨迹
 */
export class TrailRenderer {
  private scene: THREE.Scene;
  private points: THREE.Vector3[] = [];
  private line: THREE.Line;
  private glowLine: THREE.Line; // 发光底层线，让尾迹看起来更粗
  private maxPoints: number = 50; // 最多保留50个点
  private updateInterval: number = 0.05; // 每0.05秒更新一次

  constructor(scene: THREE.Scene, _owner: THREE.Object3D, color: number = 0x00ffff) {
    this.scene = scene;

    // 创建主线条
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxPoints * 3);
    const attribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', attribute);

    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });

    this.line = new THREE.Line(geometry, material);
    this.line.frustumCulled = false;

    // 创建发光底层线（使用更透明和更低的不透明度）
    const glowGeometry = new THREE.BufferGeometry();
    const glowPositions = new Float32Array(this.maxPoints * 3);
    const glowAttribute = new THREE.BufferAttribute(glowPositions, 3);
    glowGeometry.setAttribute('position', glowAttribute);

    const glowMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      depthTest: false, // 不进行深度测试，让发光效果叠加
    });

    this.glowLine = new THREE.Line(glowGeometry, glowMaterial);
    this.glowLine.frustumCulled = false;
    this.glowLine.renderOrder = -1; // 在主线条之前渲染

    this.scene.add(this.glowLine);
    this.scene.add(this.line);
  }

  /**
   * 添加新位置点
   */
  public addPoint(position: THREE.Vector3): void {
    this.points.push(position.clone());

    // 限制点数量
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    this.updateGeometry();
  }

  /**
   * 更新尾迹（每帧调用）
   */
  public update(deltaTime: number): void {
    this.updateInterval += deltaTime;

    // 每隔一段时间更新一次几何体
    if (this.updateInterval >= this.updateInterval) {
      this.updateInterval = 0;

      // 只在所有者移动时更新
      if (this.points.length > 1) {
        this.updateGeometry();
      }
    }
  }

  /**
   * 更新线条几何体
   */
  private updateGeometry(): void {
    // 更新主线条
    const positions = this.line.geometry.attributes.position.array as Float32Array;

    // 更新所有点的位置
    for (let i = 0; i < this.points.length; i++) {
      positions[i * 3] = this.points[i].x;
      positions[i * 3 + 1] = this.points[i].y;
      positions[i * 3 + 2] = this.points[i].z;
    }

    // 填充剩余位置为0
    for (let i = this.points.length; i < this.maxPoints; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    this.line.geometry.attributes.position.needsUpdate = true;

    // 更新发光底层线
    const glowPositions = this.glowLine.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < this.points.length; i++) {
      glowPositions[i * 3] = this.points[i].x;
      glowPositions[i * 3 + 1] = this.points[i].y;
      glowPositions[i * 3 + 2] = this.points[i].z;
    }

    for (let i = this.points.length; i < this.maxPoints; i++) {
      glowPositions[i * 3] = 0;
      glowPositions[i * 3 + 1] = 0;
      glowPositions[i * 3 + 2] = 0;
    }

    this.glowLine.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 清除尾迹
   */
  public dispose(): void {
    if (this.line) {
      this.scene.remove(this.line);
      this.line.geometry.dispose();
      (this.line.material as THREE.Material).dispose();
    }
    if (this.glowLine) {
      this.scene.remove(this.glowLine);
      this.glowLine.geometry.dispose();
      (this.glowLine.material as THREE.Material).dispose();
    }
  }
}
