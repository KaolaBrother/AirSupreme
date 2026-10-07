import * as THREE from 'three';
import {
  applyVerticalGradient,
  createGlowMaterial,
  createGlowSprite,
  isFiniteVector,
  type HazardProbeResult,
} from './MagmaColossusHazards';

/**
 * 熔岩巨像的两件专属特殊武器视觉：
 * - MagmaColossusBeam：胸口熔炉的熔岩光束横扫。充能阶段先画出整片扇形危险区，
 *   开火后光束在扇面内匀速扫过；扇面正中就是充能开始时玩家所在方向。
 * - MagmaColossusStompMarker：践踏前在落脚点画出冲击波最终半径（地面红圈 + 填充）。
 */

const UP = new THREE.Vector3(0, 1, 0);
const FAN_SEGMENTS = 28;

export type MagmaBeamState = 'idle' | 'charge' | 'fire';

export interface MagmaBeamLaunch {
  chargeTime: number;
  fireTime: number;
  range: number;
  radius: number;
  damage: number;
  /** 扫掠半角（弧度） */
  halfAngle: number;
  /** 1：从左扫到右；-1：反向 */
  direction: 1 | -1;
}

export class MagmaColossusBeam {
  private readonly root: THREE.Group;
  private readonly fan: THREE.Mesh;
  private readonly fanMaterial: THREE.MeshBasicMaterial;
  private readonly fanGeometry: THREE.BufferGeometry;
  private readonly beamGeometry: THREE.CylinderGeometry;
  private readonly outer: THREE.Mesh;
  private readonly outerMaterial: THREE.MeshBasicMaterial;
  private readonly inner: THREE.Mesh;
  private readonly innerMaterial: THREE.MeshBasicMaterial;
  private readonly emitterGlow: THREE.Sprite;
  private readonly endGlow: THREE.Sprite;
  private readonly fanHalfAngle: number;

  private state: MagmaBeamState = 'idle';
  private timer = 0;
  private launch: MagmaBeamLaunch = {
    chargeTime: 1,
    fireTime: 1,
    range: 1,
    radius: 1,
    damage: 0,
    halfAngle: 0.6,
    direction: 1,
  };
  private readonly origin = new THREE.Vector3();
  private readonly basis = new THREE.Quaternion();
  private readonly direction = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly tempA = new THREE.Vector3();
  private readonly tempB = new THREE.Vector3();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private sweepAngle = 0;

  constructor(parent: THREE.Object3D, halfAngle: number = 0.62) {
    this.fanHalfAngle = halfAngle;
    this.root = new THREE.Group();
    this.root.name = 'colossus_beam';
    this.root.visible = false;
    parent.add(this.root);

    // 扇形危险区：顶点在原点，位于局部 XZ 平面，弧半径 1（运行时按射程缩放）
    const positions: number[] = [0, 0, 0];
    const colors: number[] = [1, 1, 1];
    for (let i = 0; i <= FAN_SEGMENTS; i++) {
      const theta = -halfAngle + (2 * halfAngle * i) / FAN_SEGMENTS;
      positions.push(Math.sin(theta), 0, Math.cos(theta));
      colors.push(0.28, 0.28, 0.28);
    }
    const indices: number[] = [];
    for (let i = 1; i <= FAN_SEGMENTS; i++) indices.push(0, i, i + 1);
    this.fanGeometry = new THREE.BufferGeometry();
    this.fanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.fanGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.fanGeometry.setIndex(indices);
    this.fanMaterial = createGlowMaterial(0xff2a12, 0, {
      side: THREE.DoubleSide,
      fog: false,
      vertexColors: true,
    });
    this.fan = new THREE.Mesh(this.fanGeometry, this.fanMaterial);
    this.fan.name = 'colossus_beam_fan';
    this.fan.frustumCulled = false;
    this.fan.renderOrder = 0;

    this.beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
    this.beamGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.beamGeometry, 0xffffff, 0x401000, 0.7);
    this.outerMaterial = createGlowMaterial(0xff6a1c, 0, {
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    this.innerMaterial = createGlowMaterial(0xfff0c0, 0, { vertexColors: true });
    this.outer = new THREE.Mesh(this.beamGeometry, this.outerMaterial);
    this.outer.name = 'colossus_beam_outer';
    this.inner = new THREE.Mesh(this.beamGeometry, this.innerMaterial);
    this.inner.name = 'colossus_beam_inner';
    for (const mesh of [this.outer, this.inner]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      mesh.visible = false;
    }
    this.emitterGlow = createGlowSprite(0xffa040, 1, 0);
    this.endGlow = createGlowSprite(0xff7a28, 1, 0, 'fire');
    this.root.add(this.fan, this.outer, this.inner, this.emitterGlow, this.endGlow);
  }

  /** 开始充能：aim 为充能开始时指向玩家的单位向量 */
  public start(origin: THREE.Vector3, aim: THREE.Vector3, launch: MagmaBeamLaunch): boolean {
    if (!isFiniteVector(origin) || !isFiniteVector(aim) || aim.lengthSq() < 1e-6) return false;
    this.launch = { ...launch, halfAngle: Math.min(launch.halfAngle, this.fanHalfAngle) };
    this.state = 'charge';
    this.timer = 0;
    this.origin.copy(origin);
    this.tempA.copy(aim).normalize();
    const yaw = Math.atan2(this.tempA.x, this.tempA.z);
    const pitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(this.tempA.y, -1, 1)),
      -0.25,
      1.15
    );
    this.euler.set(-pitch, yaw, 0, 'YXZ');
    this.basis.setFromEuler(this.euler);
    this.root.visible = true;
    this.root.position.copy(origin);
    this.fan.quaternion.copy(this.basis);
    this.fan.scale.setScalar(this.launch.range);
    // 扇面角度与发射时一致（构造时的半角为上限）
    const fanScale = this.launch.halfAngle / this.fanHalfAngle;
    this.fan.scale.x = this.launch.range * Math.max(0.2, fanScale);
    this.sweepAngle = -this.launch.halfAngle * this.launch.direction;
    this.updateDirection();
    return true;
  }

  /** 光束发射点随躯干微动 */
  public setOrigin(origin: THREE.Vector3): void {
    if (!isFiniteVector(origin)) return;
    this.origin.copy(origin);
    this.root.position.copy(origin);
  }

  /** 推进状态；返回本帧是否刚进入开火阶段 */
  public update(deltaTime: number): boolean {
    if (this.state === 'idle') return false;
    this.timer += deltaTime;
    let fireStarted = false;
    const { chargeTime, fireTime, radius, range } = this.launch;

    if (this.state === 'charge') {
      const c = Math.min(1, this.timer / chargeTime);
      const pulse = 0.5 + 0.5 * Math.sin(this.timer * (10 + 24 * c));
      this.fanMaterial.opacity = 0.1 + 0.32 * c + 0.12 * pulse;
      const glow = radius * (2 + 5 * c);
      this.emitterGlow.scale.set(glow, glow, 1);
      this.emitterGlow.material.opacity = 0.35 + 0.6 * c;
      if (this.timer >= chargeTime) {
        this.state = 'fire';
        this.timer = 0;
        fireStarted = true;
        this.outer.visible = true;
        this.inner.visible = true;
      }
      return fireStarted;
    }

    // 开火：在扇面内从一侧扫到另一侧（缓入缓出）
    const f = Math.min(1, this.timer / fireTime);
    const eased = f * f * (3 - 2 * f);
    this.sweepAngle = (-1 + 2 * eased) * this.launch.halfAngle * this.launch.direction;
    this.updateDirection();
    const flicker = 1 + 0.12 * Math.sin(this.timer * 47) + 0.08 * Math.sin(this.timer * 83);
    this.outer.position.set(0, 0, 0);
    this.outer.quaternion.setFromUnitVectors(UP, this.direction);
    this.outer.scale.set(radius * 1.3 * flicker, range, radius * 1.3 * flicker);
    this.inner.quaternion.copy(this.outer.quaternion);
    this.inner.scale.set(radius * 0.48, range, radius * 0.48);
    const fade = f > 0.85 ? 1 - (f - 0.85) / 0.15 : 1;
    this.outerMaterial.opacity = 0.75 * fade;
    this.innerMaterial.opacity = 0.95 * fade;
    this.fanMaterial.opacity = 0.16 * fade;
    this.endGlow.position.copy(this.end).sub(this.origin);
    const endSize = radius * 6 * flicker;
    this.endGlow.scale.set(endSize, endSize, 1);
    this.endGlow.material.opacity = 0.8 * fade;
    const emitter = radius * 5.5 * flicker;
    this.emitterGlow.scale.set(emitter, emitter, 1);
    this.emitterGlow.material.opacity = 0.95 * fade;
    if (f >= 1) this.clear();
    return false;
  }

  private updateDirection(): void {
    this.direction.set(Math.sin(this.sweepAngle), 0, Math.cos(this.sweepAngle));
    this.direction.applyQuaternion(this.basis).normalize();
    this.end.copy(this.origin).addScaledVector(this.direction, this.launch.range);
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    if (this.state !== 'fire' || this.launch.damage <= 0) return;
    if (this.outerMaterial.opacity < 0.2) return;
    this.tempA.subVectors(target, this.origin);
    const along = THREE.MathUtils.clamp(this.tempA.dot(this.direction), 0, this.launch.range);
    this.tempB.copy(this.origin).addScaledVector(this.direction, along);
    const reach = this.launch.radius + targetRadius;
    if (this.tempB.distanceToSquared(target) > reach * reach) return;
    if (this.launch.damage > out.damage) {
      out.damage = this.launch.damage;
      out.profile = 'laser';
      out.position.copy(this.tempB);
    }
  }

  public getState(): MagmaBeamState {
    return this.state;
  }

  public getChargeProgress(): number {
    return this.state === 'charge' ? Math.min(1, this.timer / this.launch.chargeTime) : 0;
  }

  /** 当前光束末端（开火时有效） */
  public getEnd(): THREE.Vector3 {
    return this.end;
  }

  public clear(): void {
    this.state = 'idle';
    this.timer = 0;
    this.root.visible = false;
    this.outer.visible = false;
    this.inner.visible = false;
    this.fanMaterial.opacity = 0;
    this.outerMaterial.opacity = 0;
    this.innerMaterial.opacity = 0;
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    this.fanGeometry.dispose();
    this.beamGeometry.dispose();
    this.fanMaterial.dispose();
    this.outerMaterial.dispose();
    this.innerMaterial.dispose();
    this.emitterGlow.material.dispose();
    this.endGlow.material.dispose();
  }
}

/** 践踏预警：落脚点地面红圈（标出冲击波最终半径）+ 中心填充 */
export class MagmaColossusStompMarker {
  private readonly root: THREE.Group;
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly discGeometry: THREE.CircleGeometry;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly discMaterial: THREE.MeshBasicMaterial;
  private readonly innerRing: THREE.Mesh;
  private time = 0;
  private visibleProgress = 0;

  constructor(parent: THREE.Object3D) {
    this.root = new THREE.Group();
    this.root.name = 'colossus_stomp_marker';
    this.root.visible = false;
    parent.add(this.root);
    this.ringGeometry = new THREE.RingGeometry(0.95, 1, 72, 1);
    this.ringGeometry.rotateX(-Math.PI / 2);
    this.discGeometry = new THREE.CircleGeometry(1, 48);
    this.discGeometry.rotateX(-Math.PI / 2);
    this.ringMaterial = createGlowMaterial(0xff3a14, 0, { side: THREE.DoubleSide, fog: false });
    this.discMaterial = createGlowMaterial(0xff2a10, 0, { side: THREE.DoubleSide, fog: false });
    const outerRing = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    outerRing.position.y = 1.2;
    this.innerRing = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    this.innerRing.position.y = 1.2;
    const disc = new THREE.Mesh(this.discGeometry, this.discMaterial);
    disc.position.y = 0.9;
    for (const mesh of [outerRing, this.innerRing, disc]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
    }
    this.root.add(outerRing, this.innerRing, disc);
  }

  public show(center: THREE.Vector3, radius: number): void {
    if (!isFiniteVector(center)) return;
    this.root.position.copy(center);
    this.root.scale.set(Math.max(1, radius), 1, Math.max(1, radius));
    this.root.visible = true;
    this.time = 0;
  }

  /** progress：0 → 1 为践踏蓄力进度 */
  public update(deltaTime: number, progress: number): void {
    if (!this.root.visible) return;
    this.time += deltaTime;
    this.visibleProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (8 + 20 * this.visibleProgress));
    this.ringMaterial.opacity = 0.35 + 0.5 * pulse;
    this.discMaterial.opacity = 0.05 + 0.12 * this.visibleProgress;
    // 内圈从中心向外收拢到边缘，直观显示“还有多久”
    const inner = 0.15 + 0.85 * this.visibleProgress;
    this.innerRing.scale.set(inner, 1, inner);
  }

  public hide(): void {
    this.root.visible = false;
    this.ringMaterial.opacity = 0;
    this.discMaterial.opacity = 0;
  }

  public dispose(): void {
    this.hide();
    this.root.parent?.remove(this.root);
    this.ringGeometry.dispose();
    this.discGeometry.dispose();
    this.ringMaterial.dispose();
    this.discMaterial.dispose();
  }
}
