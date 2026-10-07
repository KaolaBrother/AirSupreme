import * as THREE from 'three';
import {
  BeamVisual,
  createBeamGeometry,
  createFlameGeometry,
  createProjectileBodyGeometry,
  createShellMaterial,
  createShockRing,
  type ShockRing,
} from './WeaponFxShaders';
import { createParticleSpec, WeaponParticleField } from './WeaponParticleField';

/**
 * 特殊武器视觉层（只在有场景时创建）。
 *
 * 所有对象预分配并挂在一个根节点下：首次出现特效时根节点才加入场景，
 * clear() 隐藏一切并把根节点移出场景，dispose() 释放全部几何体与材质。
 */

/** 弹体视图：WeaponSystem 的弹体状态只需满足这几个字段 */
export interface FxProjectileView {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  seed: number;
}

export type FxSurface = 'air' | 'ground' | 'water';
export type FxDetonationPalette = 'rocket' | 'swarm';

const ROCKET_POOL = 96;
const SWARM_POOL = 96;
const RING_POOL = 14;
const TRACER_POOL = 4;
const SHELL_POOL = 2;

/** 线性 HDR 色板（>1 的分量配合加色混合与泛光呈现“白热”） */
const COLORS = {
  rocketExhaust: new THREE.Color(2.4, 1.05, 0.32),
  swarmExhaust: new THREE.Color(2.2, 1.7, 1.05),
  rocketSmoke: new THREE.Color(0.74, 0.73, 0.71),
  swarmSmoke: new THREE.Color(0.9, 0.91, 0.93),
  fireball: new THREE.Color(2.2, 0.85, 0.22),
  fireFlash: new THREE.Color(3.2, 2.4, 1.5),
  spark: new THREE.Color(2.6, 1.5, 0.55),
  darkSmoke: new THREE.Color(0.2, 0.19, 0.18),
  dust: new THREE.Color(0.45, 0.39, 0.31),
  spray: new THREE.Color(0.82, 0.9, 0.98),
  laser: new THREE.Color(2.6, 0.18, 0.42),
  laserCore: new THREE.Color(3.2, 2.3, 2.5),
  laserSpark: new THREE.Color(2.8, 1.2, 0.6),
  rail: new THREE.Color(1.1, 0.75, 2.8),
  railCore: new THREE.Color(2.6, 2.6, 3.4),
  railSpiral: new THREE.Color(0.85, 0.55, 2.5),
  railRing: new THREE.Color(0.62, 0.42, 1.7),
  railIon: new THREE.Color(0.42, 0.24, 1.05),
  emp: new THREE.Color(0.45, 1.6, 2.6),
  empCore: new THREE.Color(1.6, 2.6, 3.2),
} as const;

const LASER_SHEATH_COLOR = 0xff2a55;
/** 轨道炮冲击环（普通混合，线性色） */
const RAIL_RING_TINT = new THREE.Color(0.32, 0.16, 0.95);
const RAIL_SHEATH_COLOR = 0x7a5cff;

/** 火箭弹体剖面：[半径, 轴向, 颜色] —— 喷管 → 弹体 → 黄色战斗部带 → 弹头 */
const ROCKET_PROFILE: ReadonlyArray<readonly [number, number, number]> = [
  [0.06, -0.68, 0x2b2d30],
  [0.085, -0.62, 0x3a3d40],
  [0.09, -0.5, 0x6f7560],
  [0.09, 0.22, 0x6f7560],
  [0.092, 0.24, 0xd8b23a],
  [0.092, 0.34, 0xd8b23a],
  [0.09, 0.36, 0x7a8068],
  [0.08, 0.5, 0x7a8068],
  [0.05, 0.62, 0x9aa0a6],
  [0.0, 0.7, 0x9aa0a6],
];

/** 微型导弹剖面：白色弹体 + 红色导引头 */
const SWARM_PROFILE: ReadonlyArray<readonly [number, number, number]> = [
  [0.045, -0.42, 0x303236],
  [0.06, -0.36, 0xe9ecef],
  [0.06, 0.18, 0xe9ecef],
  [0.061, 0.2, 0xc8323c],
  [0.061, 0.26, 0xc8323c],
  [0.058, 0.28, 0xdfe3e7],
  [0.04, 0.38, 0x1c2026],
  [0.0, 0.44, 0x1c2026],
];

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export class WeaponFx {
  public readonly root: THREE.Group;
  public readonly smoke: WeaponParticleField;
  public readonly glow: WeaponParticleField;
  private readonly scene: THREE.Scene;
  private attached = false;
  private time = 0;

  // 弹体
  private readonly rocketBodies: THREE.InstancedMesh;
  private readonly rocketFlames: THREE.InstancedMesh;
  private readonly swarmBodies: THREE.InstancedMesh;
  private readonly swarmFlames: THREE.InstancedMesh;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly rocketFlameMaterial: THREE.MeshBasicMaterial;
  private readonly swarmFlameMaterial: THREE.MeshBasicMaterial;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];

  // 光束 / 曳光
  private readonly laser: BeamVisual;
  private readonly tracers: Array<{
    beam: BeamVisual;
    life: number;
    maxLife: number;
    width: number;
  }>;

  // 冲击环 / EMP 球壳
  private readonly rings: ShockRing[] = [];
  private readonly shells: Array<{
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    life: number;
    maxLife: number;
    radius: number;
    active: boolean;
  }> = [];

  // 复用临时对象
  private readonly spec = createParticleSpec();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly basisU = new THREE.Vector3();
  private readonly basisW = new THREE.Vector3();
  private railRingTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'special-weapons-fx';

    this.smoke = new WeaponParticleField(4096, 'smoke');
    this.glow = new WeaponParticleField(3072, 'glow');
    this.root.add(this.smoke.mesh, this.glow.mesh);

    // 弹体：实例化车削体 + 加色尾焰锥
    const rocketGeometry = createProjectileBodyGeometry(ROCKET_PROFILE, 10);
    const swarmGeometry = createProjectileBodyGeometry(SWARM_PROFILE, 8);
    const rocketFlameGeometry = createFlameGeometry(0.11, 1.5);
    const swarmFlameGeometry = createFlameGeometry(0.075, 1.0);
    this.ownedGeometries.push(
      rocketGeometry,
      swarmGeometry,
      rocketFlameGeometry,
      swarmFlameGeometry
    );

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.45,
      roughness: 0.42,
      emissive: new THREE.Color(0x1a1410),
    });
    this.rocketFlameMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 0.62, 0.25),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });
    this.swarmFlameMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 0.86, 0.62),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    this.rocketBodies = this.createInstanced(rocketGeometry, this.bodyMaterial, ROCKET_POOL);
    this.rocketFlames = this.createInstanced(
      rocketFlameGeometry,
      this.rocketFlameMaterial,
      ROCKET_POOL
    );
    this.swarmBodies = this.createInstanced(swarmGeometry, this.bodyMaterial, SWARM_POOL);
    this.swarmFlames = this.createInstanced(
      swarmFlameGeometry,
      this.swarmFlameMaterial,
      SWARM_POOL
    );

    // 光束：激光（品红赤色）与轨道炮曳光（电紫色）
    const beamGeometry = createBeamGeometry(24);
    this.ownedGeometries.push(beamGeometry);
    this.laser = new BeamVisual(
      beamGeometry,
      { color: COLORS.laser, coreColor: COLORS.laserCore, width: 0.42, pulse: 1 },
      LASER_SHEATH_COLOR
    );
    this.root.add(this.laser.sheath, this.laser.core);
    this.tracers = [];
    for (let i = 0; i < TRACER_POOL; i++) {
      const beam = new BeamVisual(
        beamGeometry,
        { color: COLORS.rail, coreColor: COLORS.railCore, width: 0.5, pulse: 0 },
        RAIL_SHEATH_COLOR
      );
      this.root.add(beam.sheath, beam.core);
      this.tracers.push({ beam, life: 0, maxLife: 1, width: 0.5 });
    }

    // 冲击环
    const ringGeometry = new THREE.CircleGeometry(1, 72);
    this.ownedGeometries.push(ringGeometry);
    for (let i = 0; i < RING_POOL; i++) {
      const ring = createShockRing(ringGeometry);
      this.rings.push(ring);
      this.root.add(ring.mesh);
    }

    // EMP 球壳
    const shellGeometry = new THREE.SphereGeometry(1, 40, 24);
    this.ownedGeometries.push(shellGeometry);
    for (let i = 0; i < SHELL_POOL; i++) {
      const material = createShellMaterial(COLORS.emp);
      const mesh = new THREE.Mesh(shellGeometry, material);
      mesh.visible = false;
      mesh.renderOrder = 0;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.shells.push({ mesh, material, life: 0, maxLife: 1, radius: 1, active: false });
    }
  }

  private createInstanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    this.root.add(mesh);
    return mesh;
  }

  /** 首个特效出现时把根节点挂进场景 */
  public attach(): void {
    if (!this.attached) {
      this.scene.add(this.root);
      this.attached = true;
    }
  }

  public isAttached(): boolean {
    return this.attached;
  }

  public setDensity(density: number): void {
    this.smoke.setDensity(density);
    this.glow.setDensity(density);
  }

  // ---------------------------------------------------------------------------
  // 每帧更新
  // ---------------------------------------------------------------------------

  /** 帧开始：推进时钟与各类动画（之后才发射本帧粒子） */
  public update(deltaTime: number): void {
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
    this.time += dt;
    this.smoke.advance(dt);
    this.glow.advance(dt);
    this.laser.coreUniforms.uTime.value = this.time;

    for (const tracer of this.tracers) {
      if (tracer.life <= 0) continue;
      tracer.life -= dt;
      if (tracer.life <= 0) {
        tracer.beam.setVisible(false);
        continue;
      }
      const k = tracer.life / tracer.maxLife;
      const fade = k * k;
      tracer.beam.coreUniforms.uIntensity.value = 0.25 + fade * 1.4;
      tracer.beam.coreUniforms.uWidth.value = tracer.width * (0.35 + 0.65 * k);
      tracer.beam.sheathUniforms.uIntensity.value = 0.55 * fade;
      tracer.beam.sheathUniforms.uWidth.value = tracer.width * (2.2 + (1 - k) * 2.6);
      tracer.beam.coreUniforms.uTime.value = this.time;
    }

    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = ring.fromRadius + (ring.toRadius - ring.fromRadius) * eased;
      ring.mesh.scale.setScalar(Math.max(0.001, radius));
      ring.material.uniforms.uOpacity.value = ring.baseOpacity * Math.pow(1 - progress, 1.5);
    }

    for (const shell of this.shells) {
      if (!shell.active) continue;
      shell.life -= dt;
      if (shell.life <= 0) {
        shell.active = false;
        shell.mesh.visible = false;
        continue;
      }
      const progress = 1 - shell.life / shell.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2.6);
      shell.mesh.scale.setScalar(Math.max(0.5, shell.radius * eased));
      shell.material.uniforms.uOpacity.value = 1.15 * Math.pow(1 - progress, 1.6);
      shell.material.uniforms.uTime.value = this.time;
    }
  }

  /** 帧结束：提交本帧发射的粒子 */
  public endFrame(): void {
    this.smoke.flush();
    this.glow.flush();
  }

  /** 把逻辑层的弹体同步到实例化网格 */
  public renderBodies(kind: 'rocket' | 'swarm', projectiles: readonly FxProjectileView[]): void {
    const bodies = kind === 'rocket' ? this.rocketBodies : this.swarmBodies;
    const flames = kind === 'rocket' ? this.rocketFlames : this.swarmFlames;
    const capacity = kind === 'rocket' ? ROCKET_POOL : SWARM_POOL;
    const nozzleOffset = kind === 'rocket' ? -0.66 : -0.4;
    let count = 0;
    for (const projectile of projectiles) {
      if (!projectile.active || count >= capacity) continue;
      const speed = projectile.velocity.length();
      if (speed < 1e-4) continue;
      this.tmpDir.copy(projectile.velocity).divideScalar(speed);
      this.tmpQuat.setFromUnitVectors(Z_AXIS, this.tmpDir);
      this.tmpScale.set(1, 1, 1);
      this.tmpMatrix.compose(projectile.position, this.tmpQuat, this.tmpScale);
      bodies.setMatrixAt(count, this.tmpMatrix);

      // 尾焰：锚定喷口，长度高频抖动
      const flicker =
        0.75 + 0.25 * Math.sin(this.time * 61 + projectile.seed * 40) + Math.random() * 0.18;
      this.tmpA.copy(this.tmpDir).multiplyScalar(nozzleOffset).add(projectile.position);
      this.tmpScale.set(0.9 + flicker * 0.25, 0.9 + flicker * 0.25, flicker * 1.3);
      this.tmpMatrix.compose(this.tmpA, this.tmpQuat, this.tmpScale);
      flames.setMatrixAt(count, this.tmpMatrix);
      count++;
    }
    bodies.count = count;
    flames.count = count;
    bodies.visible = count > 0;
    flames.visible = count > 0;
    if (count > 0) {
      bodies.instanceMatrix.needsUpdate = true;
      flames.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------------------
  // 弹道尾迹
  // ---------------------------------------------------------------------------

  /**
   * 火箭 / 微型导弹尾迹：沿本帧位移等距补点（老的点按比例回拨出生时间），
   * 加上喷口处随弹体同速移动的白热光点。
   */
  public emitTrail(
    kind: 'rocket' | 'swarm',
    from: THREE.Vector3,
    to: THREE.Vector3,
    velocity: THREE.Vector3,
    deltaTime: number,
    carry: { value: number },
    age: number
  ): void {
    const isRocket = kind === 'rocket';
    const spacing = (isRocket ? 1.5 : 0.95) / this.smoke.getDensity();
    const distance = from.distanceTo(to);
    const spec = this.spec;
    if (distance > 1e-4 && Number.isFinite(distance)) {
      let travelled = carry.value;
      while (travelled < distance) {
        const f = travelled / distance;
        spec.position.lerpVectors(from, to, f);
        spec.velocity.set(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.6
        );
        spec.velocity.addScaledVector(velocity, 0.035);
        spec.delay = -(1 - f) * deltaTime;
        if (isRocket) {
          spec.life = 1.3 + Math.random() * 0.7;
          spec.size0 = 1.5;
          spec.size1 = 3.6 + Math.random() * 1.4;
          spec.color.copy(COLORS.rocketSmoke).multiplyScalar(0.88 + Math.random() * 0.2);
          spec.alpha = 0.34;
          spec.heat = 0.14;
        } else {
          spec.life = 0.85 + Math.random() * 0.45;
          spec.size0 = 0.95;
          spec.size1 = 2 + Math.random() * 0.8;
          spec.color.copy(COLORS.swarmSmoke).multiplyScalar(0.92 + Math.random() * 0.12);
          spec.alpha = 0.3;
          spec.heat = 0.1;
        }
        spec.drag = 1.6;
        spec.gravity = 0.7;
        spec.stretch = 0;
        spec.fade = 1.25;
        this.smoke.emit(spec);
        travelled += spacing;
      }
      carry.value = travelled - distance;
    }

    // 喷口白热光点（与弹体同速移动，寿命极短）
    this.tmpA.copy(velocity);
    const speed = this.tmpA.length();
    if (speed > 1e-4) {
      this.tmpA.divideScalar(speed);
      spec.position.copy(to).addScaledVector(this.tmpA, isRocket ? -0.75 : -0.45);
      spec.velocity.copy(velocity);
      spec.delay = 0;
      spec.life = 0.06;
      const ignition = Math.min(1, age * 8);
      spec.size0 = (isRocket ? 2.2 : 1.0) * (0.85 + Math.random() * 0.3) * (0.6 + ignition * 0.4);
      spec.size1 = spec.size0 * 0.7;
      spec.color.copy(isRocket ? COLORS.rocketExhaust : COLORS.swarmExhaust);
      spec.alpha = 0.95;
      spec.drag = 0;
      spec.gravity = 0;
      spec.stretch = isRocket ? 0.012 : 0.006;
      spec.fade = 1;
      spec.heat = 0.6;
      this.glow.emit(spec);
    }
  }

  /** 发射口焰：火光 + 一团发射烟（carry = 载机速度，避免火光被甩在身后） */
  public emitMuzzleFlash(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    carry: THREE.Vector3,
    color: THREE.Color,
    scale: number
  ): void {
    const spec = this.spec;
    spec.position.copy(position);
    spec.velocity.copy(carry).addScaledVector(direction, 6);
    spec.delay = 0;
    spec.life = 0.09;
    spec.size0 = 2.6 * scale;
    spec.size1 = 1.4 * scale;
    spec.color.copy(color);
    spec.alpha = 1;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 1.2;
    spec.heat = 0.8;
    this.glow.emit(spec);

    spec.velocity.copy(carry).multiplyScalar(0.55).addScaledVector(direction, 4);
    spec.life = 0.9 + Math.random() * 0.4;
    spec.size0 = 0.9 * scale;
    spec.size1 = 3.4 * scale;
    spec.color.copy(COLORS.rocketSmoke);
    spec.alpha = 0.32;
    spec.drag = 2.4;
    spec.gravity = 0.5;
    spec.fade = 1.4;
    spec.heat = 0.1;
    this.smoke.emit(spec);
  }

  // ---------------------------------------------------------------------------
  // 爆炸 / 命中
  // ---------------------------------------------------------------------------

  /** 火箭 / 蜂群导弹爆炸：闪光 + 火球 + 火花 + 浓烟（地面加尘土，水面加水花） */
  public emitDetonation(
    position: THREE.Vector3,
    scale: number,
    surface: FxSurface,
    palette: FxDetonationPalette
  ): void {
    const s = THREE.MathUtils.clamp(scale, 0.4, 3);
    const spec = this.spec;
    const glow = this.glow;
    const smoke = this.smoke;

    // 核心闪光
    spec.position.copy(position);
    spec.velocity.set(0, 0, 0);
    spec.delay = 0;
    spec.life = 0.14;
    spec.size0 = 7 * s;
    spec.size1 = 11 * s;
    spec.color.copy(COLORS.fireFlash);
    spec.alpha = 1;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 1.6;
    spec.heat = 1;
    glow.emit(spec);

    // 火球
    const fireballs = glow.scaledCount((palette === 'rocket' ? 6 : 4) * s, 2);
    for (let i = 0; i < fireballs; i++) {
      randomUnit(spec.velocity).multiplyScalar((6 + Math.random() * 10) * s);
      if (surface !== 'air') spec.velocity.y = Math.abs(spec.velocity.y) + 3 * s;
      spec.life = 0.38 + Math.random() * 0.3;
      spec.size0 = (3 + Math.random() * 1.8) * s;
      spec.size1 = (5.5 + Math.random() * 3.5) * s;
      spec.color.copy(COLORS.fireball).multiplyScalar(0.8 + Math.random() * 0.4);
      spec.alpha = 0.9;
      spec.drag = 4.5;
      spec.gravity = 2.5;
      spec.fade = 1.35;
      spec.heat = 0.35;
      spec.delay = Math.random() * 0.04;
      glow.emit(spec);
    }

    // 火花流光
    const sparks = glow.scaledCount((palette === 'rocket' ? 12 : 8) * s, 3);
    for (let i = 0; i < sparks; i++) {
      randomUnit(spec.velocity).multiplyScalar((22 + Math.random() * 28) * Math.sqrt(s));
      if (surface !== 'air' && spec.velocity.y < 0) spec.velocity.y *= -0.6;
      spec.life = 0.35 + Math.random() * 0.5;
      spec.size0 = 0.32;
      spec.size1 = 0.18;
      spec.color.copy(COLORS.spark);
      spec.alpha = 1;
      spec.drag = 1.4;
      spec.gravity = -16;
      spec.stretch = 0.035;
      spec.fade = 1.1;
      spec.heat = 0.25;
      spec.delay = 0;
      glow.emit(spec);
    }
    spec.stretch = 0;

    // 浓烟
    const puffs = smoke.scaledCount((palette === 'rocket' ? 5 : 3) * s, 2);
    for (let i = 0; i < puffs; i++) {
      randomUnit(spec.velocity).multiplyScalar((2.5 + Math.random() * 4) * s);
      spec.velocity.y = Math.abs(spec.velocity.y) * 0.6 + 1.5;
      spec.position.copy(position).addScaledVector(spec.velocity, 0.12);
      spec.life = 1.8 + Math.random() * 1.1;
      spec.size0 = 2 * s;
      spec.size1 = (6 + Math.random() * 3) * s;
      spec.color.copy(COLORS.darkSmoke).multiplyScalar(0.85 + Math.random() * 0.4);
      spec.alpha = 0.62;
      spec.drag = 1.6;
      spec.gravity = 1.1;
      spec.fade = 1.2;
      spec.heat = 0.16;
      spec.delay = 0.03 + Math.random() * 0.05;
      smoke.emit(spec);
    }

    if (surface === 'ground') {
      const dust = smoke.scaledCount(5 * s, 2);
      for (let i = 0; i < dust; i++) {
        spec.position.copy(position);
        spec.velocity.set(
          (Math.random() - 0.5) * 10 * s,
          (7 + Math.random() * 9) * s,
          (Math.random() - 0.5) * 10 * s
        );
        spec.life = 1.4 + Math.random() * 0.9;
        spec.size0 = 1.6 * s;
        spec.size1 = (5.5 + Math.random() * 2.5) * s;
        spec.color.copy(COLORS.dust).multiplyScalar(0.85 + Math.random() * 0.3);
        spec.alpha = 0.7;
        spec.drag = 2.2;
        spec.gravity = -3;
        spec.fade = 1.1;
        spec.heat = 0;
        spec.delay = Math.random() * 0.06;
        smoke.emit(spec);
      }
    } else if (surface === 'water') {
      // 白色水柱（普通混合，蓝色海面上清晰可见）
      const column = smoke.scaledCount(9 * s, 4);
      for (let i = 0; i < column; i++) {
        spec.position.copy(position);
        spec.velocity.set(
          (Math.random() - 0.5) * 5 * s,
          (10 + Math.random() * 18) * s,
          (Math.random() - 0.5) * 5 * s
        );
        spec.life = 1.1 + Math.random() * 0.6;
        spec.size0 = 1.6 * s;
        spec.size1 = (4.5 + Math.random() * 2) * s;
        spec.color.copy(COLORS.spray);
        spec.alpha = 0.75;
        spec.drag = 1.1;
        spec.gravity = -14;
        spec.stretch = 0;
        spec.fade = 1.6;
        spec.heat = 0;
        spec.delay = Math.random() * 0.05;
        smoke.emit(spec);
      }
      const spray = glow.scaledCount(10 * s, 3);
      for (let i = 0; i < spray; i++) {
        spec.position.copy(position);
        spec.velocity.set(
          (Math.random() - 0.5) * 9 * s,
          (14 + Math.random() * 16) * s,
          (Math.random() - 0.5) * 9 * s
        );
        spec.life = 0.8 + Math.random() * 0.5;
        spec.size0 = 0.9 * s;
        spec.size1 = 2.2 * s;
        spec.color.copy(COLORS.spray).multiplyScalar(0.5);
        spec.alpha = 0.8;
        spec.drag = 0.6;
        spec.gravity = -20;
        spec.stretch = 0.02;
        spec.fade = 1.2;
        spec.heat = 0;
        spec.delay = Math.random() * 0.05;
        glow.emit(spec);
      }
      spec.stretch = 0;
      const mist = smoke.scaledCount(4 * s, 2);
      for (let i = 0; i < mist; i++) {
        spec.position.copy(position);
        randomUnit(spec.velocity).multiplyScalar(4 * s);
        spec.velocity.y = Math.abs(spec.velocity.y) + 3;
        spec.life = 1.6 + Math.random() * 0.8;
        spec.size0 = 2.5 * s;
        spec.size1 = 7 * s;
        spec.color.copy(COLORS.spray);
        spec.alpha = 0.45;
        spec.drag = 1.8;
        spec.gravity = 0.3;
        spec.fade = 1.2;
        spec.heat = 0;
        spec.delay = 0.05;
        smoke.emit(spec);
      }
    }
  }

  /** 通用命中火花（流光沿 normal 半球飞散） */
  public emitSparks(
    position: THREE.Vector3,
    normal: THREE.Vector3 | null,
    count: number,
    color: THREE.Color,
    speed: number,
    life: number,
    size = 0.3
  ): void {
    const spec = this.spec;
    const total = this.glow.scaledCount(count, 1);
    for (let i = 0; i < total; i++) {
      randomUnit(spec.velocity);
      if (normal && spec.velocity.dot(normal) < 0) {
        spec.velocity.addScaledVector(normal, -2 * spec.velocity.dot(normal));
      }
      spec.velocity.multiplyScalar(speed * (0.45 + Math.random() * 0.75));
      spec.position.copy(position);
      spec.delay = 0;
      spec.life = life * (0.6 + Math.random() * 0.7);
      spec.size0 = size;
      spec.size1 = size * 0.45;
      spec.color.copy(color);
      spec.alpha = 1;
      spec.drag = 1.2;
      spec.gravity = -18;
      spec.stretch = 0.032;
      spec.fade = 1;
      spec.heat = 0.3;
      this.glow.emit(spec);
    }
    spec.stretch = 0;
  }

  /** 单个加色光斑（命中点 / 枪口辉光） */
  public emitFlash(
    position: THREE.Vector3,
    velocity: THREE.Vector3 | null,
    size: number,
    life: number,
    color: THREE.Color,
    heat = 0.8
  ): void {
    const spec = this.spec;
    spec.position.copy(position);
    if (velocity) spec.velocity.copy(velocity);
    else spec.velocity.set(0, 0, 0);
    spec.delay = 0;
    spec.life = life;
    spec.size0 = size;
    spec.size1 = size * 0.8;
    spec.color.copy(color);
    spec.alpha = 1;
    spec.drag = 0;
    spec.gravity = 0;
    spec.stretch = 0;
    spec.fade = 1.2;
    spec.heat = heat;
    this.glow.emit(spec);
  }

  /** 单团烟（命中点灼烧烟 / 蓄力余烟） */
  public emitPuff(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    size0: number,
    size1: number,
    life: number,
    color: THREE.Color,
    alpha: number,
    heat = 0
  ): void {
    const spec = this.spec;
    spec.position.copy(position);
    spec.velocity.copy(velocity);
    spec.delay = 0;
    spec.life = life;
    spec.size0 = size0;
    spec.size1 = size1;
    spec.color.copy(color);
    spec.alpha = alpha;
    spec.drag = 1.4;
    spec.gravity = 1.2;
    spec.stretch = 0;
    spec.fade = 1.2;
    spec.heat = heat;
    this.smoke.emit(spec);
  }

  // ---------------------------------------------------------------------------
  // 激光
  // ---------------------------------------------------------------------------

  /**
   * 激光光束状态（每帧调用）：heat 0..1 让光束随过热变细、闪烁加剧；
   * hit=false 时尾端淡出（打空）。
   */
  public setLaserBeam(
    active: boolean,
    start: THREE.Vector3,
    end: THREE.Vector3,
    hit: boolean,
    heat: number
  ): void {
    if (!active) {
      this.laser.setVisible(false);
      return;
    }
    this.laser.setEndpoints(start, end);
    const strain = THREE.MathUtils.clamp(heat, 0, 1);
    const flicker = 0.88 + Math.random() * 0.12 - strain * strain * Math.random() * 0.35;
    this.laser.coreUniforms.uIntensity.value = 1.15 * flicker;
    this.laser.coreUniforms.uWidth.value =
      0.42 * (1 + strain * 0.25) * (0.94 + Math.random() * 0.12);
    this.laser.coreUniforms.uFadeTail.value = hit ? 0 : 1;
    this.laser.coreUniforms.uEndWidth.value = hit ? 1.25 : 0.6;
    this.laser.sheathUniforms.uIntensity.value = 0.42 + strain * 0.18;
    this.laser.sheathUniforms.uWidth.value = 1.05 * (1 + strain * 0.3);
    this.laser.sheathUniforms.uFadeTail.value = hit ? 0 : 1;
    this.laser.sheathUniforms.uEndWidth.value = hit ? 1.3 : 0.7;
    this.laser.setVisible(true);
  }

  /** 激光枪口辉光（跟随载机） */
  public emitLaserMuzzle(position: THREE.Vector3, carry: THREE.Vector3): void {
    this.emitFlash(position, carry, 2 + Math.random() * 0.8, 0.05, COLORS.laser, 0.9);
  }

  /** 激光灼烧点：白热光斑 + 熔融火花 + 灼烧烟（按帧调用，内部按时间节流烟团） */
  public emitLaserImpact(
    position: THREE.Vector3,
    beamDirection: THREE.Vector3,
    deltaTime: number,
    surface: FxSurface
  ): void {
    this.tmpB.copy(beamDirection).multiplyScalar(-1);
    this.emitFlash(position, null, 2.6 + Math.random() * 1.2, 0.05, COLORS.laserCore, 1);
    this.emitFlash(position, null, 6.5 + Math.random() * 2, 0.06, COLORS.laser, 0.3);
    const sparkRate = surface === 'water' ? 30 : 90;
    const sparks = randomCount(sparkRate * deltaTime);
    if (sparks > 0) {
      this.emitSparks(position, this.tmpB, sparks, COLORS.laserSpark, 38, 0.6, 0.5);
    }
    if (Math.random() < deltaTime * 14) {
      this.tmpC.set(
        (Math.random() - 0.5) * 1.5,
        2.5 + Math.random() * 2,
        (Math.random() - 0.5) * 1.5
      );
      if (surface === 'water') {
        this.emitPuff(position, this.tmpC, 1.2, 4.5, 1.1, COLORS.spray, 0.35);
      } else {
        this.emitPuff(position, this.tmpC, 0.9, 4, 1.4, COLORS.darkSmoke, 0.5, 0.2);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 轨道炮
  // ---------------------------------------------------------------------------

  /** 蓄力：能量向枪口汇聚 + 脉动电光；charge 0..1 */
  public emitRailCharge(
    position: THREE.Vector3,
    forward: THREE.Vector3,
    carry: THREE.Vector3,
    charge: number,
    deltaTime: number
  ): void {
    const c = THREE.MathUtils.clamp(charge, 0, 1);
    // 枪口能量球：白热小核 + 电紫光晕，随蓄力增大并脉动
    const pulse = 0.85 + 0.15 * Math.sin(this.time * (18 + c * 24));
    this.emitFlash(position, carry, (0.5 + c * 1.3) * pulse, 0.05, COLORS.railCore, 0.6 + c * 0.4);
    this.emitFlash(position, carry, (1.6 + c * 3) * pulse, 0.05, COLORS.railRing, 0.1);
    const spec = this.spec;
    const count = randomCount((30 + c * 70) * deltaTime * this.glow.getDensity());
    for (let i = 0; i < count; i++) {
      // 电离粒子从四周被吸向枪口（流光细线）
      const distance = 2.5 + Math.random() * 4.5;
      randomUnit(this.tmpA);
      spec.position.copy(position).addScaledVector(this.tmpA, distance);
      const life = 0.16 + Math.random() * 0.1;
      spec.velocity
        .copy(this.tmpA)
        .multiplyScalar(-distance / life)
        .add(carry);
      spec.delay = 0;
      spec.life = life;
      spec.size0 = 0.14 + c * 0.08;
      spec.size1 = 0.22 + c * 0.1;
      spec.color.copy(i % 4 === 0 ? COLORS.railCore : COLORS.railRing);
      spec.alpha = 0.95;
      spec.drag = 0;
      spec.gravity = 0;
      spec.stretch = 0.018;
      spec.fade = 0.5;
      spec.heat = 0.3;
      this.glow.emit(spec);
    }
    spec.stretch = 0;
    // 满蓄力：炮管电弧闪烁 + 周期性的能量环
    if (c >= 0.999) {
      if (Math.random() < deltaTime * 20) {
        this.tmpB.copy(position).addScaledVector(forward, 1.2);
        this.emitSparks(this.tmpB, forward, 3, COLORS.railCore, 12, 0.18, 0.22);
      }
      this.railRingTimer -= deltaTime;
      if (this.railRingTimer <= 0) {
        this.railRingTimer = 0.32;
        this.spawnRing(position, forward, 0.4, 2.6, 0.28, RAIL_RING_TINT, 0.65, 0.2, false);
      }
    } else {
      this.railRingTimer = 0;
    }
  }

  /** 轨道炮射击：白紫曳光 + 螺旋电离尾迹 + 炮口冲击环 */
  public fireRailTracer(start: THREE.Vector3, end: THREE.Vector3, charge: number): void {
    const c = THREE.MathUtils.clamp(charge, 0, 1);
    const tracer = this.tracers.find((entry) => entry.life <= 0) ?? this.tracers[0];
    tracer.beam.setEndpoints(start, end);
    tracer.width = 0.32 + c * 0.38;
    tracer.maxLife = 0.38 + c * 0.22;
    tracer.life = tracer.maxLife;
    tracer.beam.coreUniforms.uIntensity.value = 1.6;
    tracer.beam.coreUniforms.uWidth.value = tracer.width;
    tracer.beam.coreUniforms.uEndWidth.value = 0.8;
    tracer.beam.sheathUniforms.uIntensity.value = 0.55;
    tracer.beam.sheathUniforms.uWidth.value = tracer.width * 2.2;
    tracer.beam.sheathUniforms.uEndWidth.value = 0.9;
    tracer.beam.setVisible(true);

    // 螺旋电离尾迹：沿弹道的正交基绕圈，越远越稀疏
    this.tmpDir.subVectors(end, start);
    const length = this.tmpDir.length();
    if (length < 1e-3 || !Number.isFinite(length)) return;
    this.tmpDir.divideScalar(length);
    buildBasis(this.tmpDir, this.basisU, this.basisW);
    const spec = this.spec;
    const helixRadius = 0.7 + c * 0.5;
    const pitch = 3.4;
    const maxPoints = Math.round(240 * this.glow.getDensity());
    let s = 1.5;
    let emitted = 0;
    while (s < length && emitted < maxPoints) {
      const theta = (s / pitch) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      this.tmpA.copy(this.basisU).multiplyScalar(cos).addScaledVector(this.basisW, sin);
      spec.position
        .copy(start)
        .addScaledVector(this.tmpDir, s)
        .addScaledVector(this.tmpA, helixRadius);
      spec.velocity.copy(this.tmpA).multiplyScalar(1.6 + Math.random() * 0.8);
      spec.delay = s / 2600;
      spec.stretch = 0;
      spec.gravity = 0;
      // 电离紫色螺旋（普通混合，任何背景下都保留色相）
      spec.life = 0.6 + Math.random() * 0.35 + c * 0.25;
      spec.size0 = 0.75;
      spec.size1 = 1.7;
      spec.color.copy(COLORS.railIon).multiplyScalar(0.9 + Math.random() * 0.25);
      spec.alpha = 0.62;
      spec.drag = 1.5;
      spec.fade = 1.2;
      spec.heat = 0;
      this.smoke.emit(spec);
      // 白热电火花点缀
      if (emitted % 3 === 0) {
        spec.life = 0.35 + Math.random() * 0.25;
        spec.size0 = 0.6;
        spec.size1 = 0.9;
        spec.color.copy(COLORS.railSpiral);
        spec.alpha = 0.9;
        spec.drag = 1.5;
        spec.fade = 1.3;
        spec.heat = 0.3;
        this.glow.emit(spec);
      }
      emitted++;
      // 近处密、远处疏：远处在屏幕上很小，不必逐米补点
      s += 0.55 + s * 0.006;
    }

    // 炮口：强闪光 + 两道垂直于弹道的冲击环 + 余烟
    this.emitFlash(start, null, 2.6 + c * 1.6, 0.1, COLORS.railCore, 1);
    this.emitFlash(start, null, 4.5 + c * 2, 0.14, COLORS.railRing, 0.2);
    // 冲击环用普通混合的电紫色：亮天空下也能看出颜色
    this.spawnRing(start, this.tmpDir, 0.6, 4.5 + c * 3.5, 0.34, RAIL_RING_TINT, 0.85, 0.1, false);
    this.tmpB.copy(start).addScaledVector(this.tmpDir, 7 + c * 3);
    this.spawnRing(
      this.tmpB,
      this.tmpDir,
      0.5,
      3 + c * 2.5,
      0.42,
      RAIL_RING_TINT,
      0.7,
      0.14,
      false
    );
    this.tmpB.copy(start).addScaledVector(this.tmpDir, 16 + c * 6);
    this.spawnRing(
      this.tmpB,
      this.tmpDir,
      0.4,
      2.2 + c * 1.8,
      0.48,
      RAIL_RING_TINT,
      0.55,
      0.18,
      false
    );
    this.tmpC.copy(this.tmpDir).multiplyScalar(3);
    this.emitPuff(start, this.tmpC, 1, 4.5, 1, COLORS.swarmSmoke, 0.28);
  }

  /** 轨道炮贯穿命中：电紫闪光 + 火花 */
  public emitRailImpact(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.emitFlash(position, null, 7, 0.12, COLORS.railCore, 1);
    this.emitFlash(position, null, 11, 0.18, COLORS.rail, 0.2);
    this.tmpB.copy(direction).multiplyScalar(-1);
    this.emitSparks(position, this.tmpB, 10, COLORS.railSpiral, 40, 0.45, 0.5);
    this.emitSparks(position, direction, 10, COLORS.spark, 52, 0.6, 0.55);
  }

  // ---------------------------------------------------------------------------
  // 冲击环 / EMP
  // ---------------------------------------------------------------------------

  /** 扩散冲击环：normal 为环面法线 */
  public spawnRing(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    fromRadius: number,
    toRadius: number,
    life: number,
    color: THREE.Color,
    opacity: number,
    thickness: number,
    additive = true
  ): void {
    const ring = this.rings.find((entry) => !entry.active);
    if (!ring || !(life > 0)) return;
    ring.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    ring.material.uniforms.uAdditive.value = additive ? 1 : 0;
    ring.active = true;
    ring.life = life;
    ring.maxLife = life;
    ring.fromRadius = Math.max(0.001, fromRadius);
    ring.toRadius = Math.max(ring.fromRadius, toRadius);
    ring.baseOpacity = opacity;
    ring.material.uniforms.uColor.value.copy(color);
    ring.material.uniforms.uOpacity.value = opacity;
    ring.material.uniforms.uThickness.value = THREE.MathUtils.clamp(thickness, 0.02, 1);
    ring.mesh.position.copy(position);
    this.tmpA.copy(normal);
    if (this.tmpA.lengthSq() < 1e-8) this.tmpA.set(0, 1, 0);
    ring.mesh.quaternion.setFromUnitVectors(Z_AXIS, this.tmpA.normalize());
    ring.mesh.scale.setScalar(ring.fromRadius);
    ring.mesh.visible = true;
  }

  /** EMP：电光球壳扩散 + 水平 / 倾斜双冲击环 + 放射状电火花 */
  public fireEmp(center: THREE.Vector3, radius: number): void {
    const shell = this.shells.find((entry) => !entry.active) ?? this.shells[0];
    shell.active = true;
    shell.maxLife = 0.85;
    shell.life = shell.maxLife;
    shell.radius = radius;
    shell.mesh.position.copy(center);
    shell.mesh.scale.setScalar(0.5);
    shell.mesh.visible = true;

    this.tmpA.set(0, 1, 0);
    this.spawnRing(center, this.tmpA, 2, radius, 0.95, COLORS.emp, 0.75, 0.06);
    this.tmpA.set(0.35, 1, 0.2).normalize();
    this.spawnRing(center, this.tmpA, 1, radius * 0.82, 0.8, COLORS.empCore, 0.35, 0.035);

    // 中心闪光克制一些：玩家就在球心，过大的光团会糊住整个屏幕
    this.emitFlash(center, null, 6, 0.16, COLORS.empCore, 1);
    this.emitFlash(center, null, 13, 0.3, COLORS.emp, 0.2);
    const spec = this.spec;
    const arcs = this.glow.scaledCount(56, 16);
    for (let i = 0; i < arcs; i++) {
      randomUnit(this.tmpB);
      // 电火花从 18 米外起跳，沿冲击波向外飞散，不会贴着镜头划过
      spec.position.copy(center).addScaledVector(this.tmpB, 18 + Math.random() * 10);
      spec.velocity.copy(this.tmpB).multiplyScalar(radius * (0.7 + Math.random() * 0.6));
      spec.delay = Math.random() * 0.08;
      spec.life = 0.65 + Math.random() * 0.35;
      spec.size0 = 0.55;
      spec.size1 = 0.22;
      spec.color.copy(i % 3 === 0 ? COLORS.empCore : COLORS.emp);
      spec.alpha = 1;
      spec.drag = 2.4;
      spec.gravity = 0;
      spec.stretch = 0.012;
      spec.fade = 0.9;
      spec.heat = 0.35;
      this.glow.emit(spec);
    }
    spec.stretch = 0;
  }

  /** 被 EMP 瘫痪的目标：短促电弧火花 + 青色闪光 */
  public emitStunCrackle(position: THREE.Vector3, radius: number, delay: number): void {
    const spec = this.spec;
    const r = THREE.MathUtils.clamp(radius, 1, 20);
    // 三次逐渐减弱的电弧爆闪，持续约 0.9 秒，清楚标示被瘫痪的目标
    for (let burst = 0; burst < 3; burst++) {
      const burstDelay = delay + burst * 0.3 + Math.random() * 0.06;
      spec.position.copy(position);
      spec.velocity.set(0, 0, 0);
      spec.delay = burstDelay;
      spec.life = 0.2;
      spec.size0 = r * (1.5 - burst * 0.3);
      spec.size1 = spec.size0 * 0.75;
      spec.color.copy(COLORS.emp);
      spec.alpha = 1 - burst * 0.2;
      spec.drag = 0;
      spec.gravity = 0;
      spec.stretch = 0;
      spec.fade = 1.3;
      spec.heat = 0.6;
      this.glow.emit(spec);
      const sparks = this.glow.scaledCount(7 - burst * 2, 2);
      for (let i = 0; i < sparks; i++) {
        randomUnit(this.tmpA);
        spec.position.copy(position).addScaledVector(this.tmpA, r * 0.6);
        spec.velocity.copy(this.tmpA).multiplyScalar(10 + Math.random() * 18);
        spec.delay = burstDelay + Math.random() * 0.12;
        spec.life = 0.2 + Math.random() * 0.25;
        spec.size0 = 0.35;
        spec.size1 = 0.15;
        spec.color.copy(COLORS.empCore);
        spec.alpha = 1;
        spec.drag = 2;
        spec.gravity = -6;
        spec.stretch = 0.03;
        spec.fade = 0.8;
        spec.heat = 0.4;
        this.glow.emit(spec);
      }
    }
    spec.stretch = 0;
  }

  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /** 隐藏所有特效并把根节点移出场景（对象池保留，可继续使用） */
  public clear(): void {
    this.smoke.clear();
    this.glow.clear();
    this.laser.setVisible(false);
    for (const tracer of this.tracers) {
      tracer.life = 0;
      tracer.beam.setVisible(false);
    }
    for (const ring of this.rings) {
      ring.active = false;
      ring.mesh.visible = false;
    }
    for (const shell of this.shells) {
      shell.active = false;
      shell.mesh.visible = false;
    }
    for (const mesh of [this.rocketBodies, this.rocketFlames, this.swarmBodies, this.swarmFlames]) {
      mesh.count = 0;
      mesh.visible = false;
    }
    if (this.attached) {
      this.scene.remove(this.root);
      this.attached = false;
    }
  }

  public dispose(): void {
    this.clear();
    this.smoke.dispose();
    this.glow.dispose();
    this.laser.dispose();
    for (const tracer of this.tracers) {
      tracer.beam.dispose();
    }
    for (const ring of this.rings) {
      ring.mesh.removeFromParent();
      ring.material.dispose();
    }
    for (const shell of this.shells) {
      shell.mesh.removeFromParent();
      shell.material.dispose();
    }
    for (const mesh of [this.rocketBodies, this.rocketFlames, this.swarmBodies, this.swarmFlames]) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.bodyMaterial.dispose();
    this.rocketFlameMaterial.dispose();
    this.swarmFlameMaterial.dispose();
    for (const geometry of this.ownedGeometries) {
      geometry.dispose();
    }
    this.ownedGeometries.length = 0;
    this.root.clear();
  }

  /** 供逻辑层引用的色板（爆炸 / 枪口等） */
  public static readonly colors = COLORS;
}

/** 由期望数量（可为小数）随机取整：期望值不变，低帧率 / 高帧率下发射率一致 */
function randomCount(expected: number): number {
  if (!(expected > 0)) return 0;
  const base = Math.floor(expected);
  return base + (Math.random() < expected - base ? 1 : 0);
}

/** 构造与 dir 正交的单位基 u、w */
function buildBasis(dir: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3): void {
  if (Math.abs(dir.y) < 0.95) {
    u.set(0, 1, 0);
  } else {
    u.set(1, 0, 0);
  }
  w.crossVectors(dir, u).normalize();
  u.crossVectors(w, dir).normalize();
}

/** 随机单位向量（写入 out） */
function randomUnit(out: THREE.Vector3): THREE.Vector3 {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return out.set(r * Math.cos(theta), u, r * Math.sin(theta));
}
