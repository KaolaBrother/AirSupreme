import * as THREE from 'three';

interface DebrisChunk {
  index: number;
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spinSpeed: number;
  scale: THREE.Vector3;
  life: number;
  maxLife: number;
  smokeTrail: boolean;
  trailTimer: number;
}

/**
 * 实心碎片：单个 InstancedMesh（受光 Lambert，逐实例颜色），
 * 受重力翻滚，寿命末段缩小消失；可拖出烟迹（由回调交给粒子系统发射）。
 */
export class DebrisField {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  readonly capacity: number;

  private readonly chunks: DebrisChunk[] = [];
  private activeCount = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly drawScale = new THREE.Vector3();
  private readonly spinStep = new THREE.Quaternion();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private cursor = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(8, Math.floor(capacity));
    const geometry = new THREE.IcosahedronGeometry(0.5, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.name = 'vfx-debris';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // 预先创建 instanceColor，避免首帧 setColorAt 时分配
    mesh.setColorAt(0, new THREE.Color(0x555555));
    mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    this.mesh = mesh;

    for (let i = 0; i < this.capacity; i++) {
      this.chunks.push({
        index: i,
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        spinAxis: new THREE.Vector3(0, 1, 0),
        spinSpeed: 0,
        scale: new THREE.Vector3(1, 1, 1),
        life: 0,
        maxLife: 1,
        smokeTrail: false,
        trailTimer: 0,
      });
      mesh.setMatrixAt(i, this.hiddenMatrix);
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  spawn(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    size: number,
    color: THREE.Color,
    life: number,
    smokeTrail: boolean
  ): boolean {
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return false;
    }
    let chunk: DebrisChunk | undefined;
    for (let i = 0; i < this.capacity; i++) {
      const candidate = this.chunks[(this.cursor + i) % this.capacity];
      if (!candidate.active) {
        chunk = candidate;
        this.cursor = (this.cursor + i + 1) % this.capacity;
        break;
      }
    }
    if (!chunk) {
      // 满载时回收游标处的碎片
      chunk = this.chunks[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;
    } else {
      this.activeCount++;
    }
    const index = chunk.index;
    chunk.active = true;
    chunk.position.copy(position);
    chunk.velocity.copy(velocity);
    chunk.quaternion
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, 1)
      .normalize();
    chunk.spinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    if (chunk.spinAxis.lengthSq() < 1e-6) chunk.spinAxis.set(0, 1, 0);
    chunk.spinSpeed = 4 + Math.random() * 9;
    const s = Math.max(0.05, size);
    chunk.scale.set(
      s * (0.7 + Math.random() * 0.6),
      s * (0.45 + Math.random() * 0.4),
      s * (0.7 + Math.random() * 0.6)
    );
    chunk.life = life;
    chunk.maxLife = life;
    chunk.smokeTrail = smokeTrail;
    chunk.trailTimer = 0.04;
    this.mesh.setColorAt(index, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return true;
  }

  /**
   * 推进物理并写入实例矩阵。onTrail 在需要烟迹时以碎片位置回调。
   */
  update(
    deltaTime: number,
    gravity: number,
    onTrail: ((position: THREE.Vector3) => void) | null
  ): void {
    if (this.activeCount === 0) {
      this.mesh.count = 0;
      return;
    }
    let highest = -1;
    for (let i = 0; i < this.capacity; i++) {
      const chunk = this.chunks[i];
      if (!chunk.active) continue;
      chunk.life -= deltaTime;
      if (chunk.life <= 0 || !Number.isFinite(chunk.position.y)) {
        chunk.active = false;
        this.activeCount--;
        this.mesh.setMatrixAt(i, this.hiddenMatrix);
        continue;
      }
      chunk.velocity.y += gravity * deltaTime;
      chunk.velocity.multiplyScalar(Math.max(0, 1 - 0.35 * deltaTime));
      chunk.position.addScaledVector(chunk.velocity, deltaTime);
      this.spinStep.setFromAxisAngle(chunk.spinAxis, chunk.spinSpeed * deltaTime);
      chunk.quaternion.multiply(this.spinStep);

      const lifeRatio = chunk.life / chunk.maxLife;
      const shrink = lifeRatio < 0.25 ? lifeRatio / 0.25 : 1;
      this.drawScale.copy(chunk.scale).multiplyScalar(shrink);
      this.matrix.compose(chunk.position, chunk.quaternion, this.drawScale);
      this.mesh.setMatrixAt(i, this.matrix);
      highest = i;

      if (chunk.smokeTrail && onTrail) {
        chunk.trailTimer -= deltaTime;
        if (chunk.trailTimer <= 0) {
          chunk.trailTimer = 0.05 + Math.random() * 0.05;
          onTrail(chunk.position);
        }
      }
    }
    this.mesh.count = highest + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      const chunk = this.chunks[i];
      chunk.active = false;
      this.mesh.setMatrixAt(i, this.hiddenMatrix);
    }
    this.activeCount = 0;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.clear();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
