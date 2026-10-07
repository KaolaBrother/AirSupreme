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
import { WeaponParticleField } from './WeaponParticleField';
import { FX_COLORS as COLORS, WeaponFxParticles } from './WeaponFxParticles';

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

export type { FxSurface, FxDetonationPalette } from './WeaponFxParticles';

const ROCKET_POOL = 96;
const SWARM_POOL = 96;
const RING_POOL = 14;
const TRACER_POOL = 4;
const SHELL_POOL = 2;

const LASER_SHEATH_COLOR = 0xff2a55;
const LASER_SHEATH = new THREE.Color(LASER_SHEATH_COLOR);
const LASER_SHEATH_HOT = new THREE.Color(0xff8a1e);
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
  /** 粒子配方（尾迹、爆炸、火花等），控制器通过它发射纯粒子特效 */
  public readonly particles: WeaponFxParticles;
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
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpMatrix = new THREE.Matrix4();
  private railRingTimer = 0;
  private beamStartOffset = 0;
  private readonly beamStart = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'special-weapons-fx';

    this.smoke = new WeaponParticleField(4096, 'smoke');
    this.glow = new WeaponParticleField(3072, 'glow');
    this.root.add(this.smoke.mesh, this.glow.mesh);
    this.particles = new WeaponFxParticles(this.smoke, this.glow);

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

  /**
   * 第一人称时枪口就在镜头前：缩小枪口特效，并把光束起点前移，避免糊屏。
   */
  public setFirstPerson(enabled: boolean): void {
    this.particles.muzzleScale = enabled ? 0.35 : 1;
    this.particles.firstPerson = enabled;
    this.beamStartOffset = enabled ? 4 : 0;
  }

  /** 光束可见起点：第一人称时沿光束方向前移 */
  private offsetBeamStart(
    start: THREE.Vector3,
    end: THREE.Vector3,
    out: THREE.Vector3
  ): THREE.Vector3 {
    out.copy(start);
    if (this.beamStartOffset > 0) {
      this.tmpC.subVectors(end, start);
      const length = this.tmpC.length();
      if (length > this.beamStartOffset * 2) {
        out.addScaledVector(this.tmpC, this.beamStartOffset / length);
      }
    }
    return out;
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

  // ---------------------------------------------------------------------------
  // 爆炸 / 命中
  // ---------------------------------------------------------------------------

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
    this.laser.setEndpoints(this.offsetBeamStart(start, end, this.beamStart), end);
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
    // 过热预警：热量超过 60% 后光束由品红逐渐转为橙白
    const warn = THREE.MathUtils.smoothstep(strain, 0.6, 1);
    this.laser.coreUniforms.uColor.value.copy(COLORS.laser).lerp(COLORS.laserHot, warn);
    this.laser.sheathUniforms.uColor.value.copy(LASER_SHEATH).lerp(LASER_SHEATH_HOT, warn);
    this.laser.setVisible(true);
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
    const firstPerson = this.beamStartOffset > 0;
    // 第一人称：能量球挪到机头前方，不再让粒子从镜头旁掠过
    const anchor = firstPerson
      ? this.tmpC.copy(position).addScaledVector(forward, this.beamStartOffset)
      : position;
    this.particles.emitRailCharge(anchor, forward, carry, c, deltaTime, this.time, !firstPerson);
    // 满蓄力：周期性的能量环
    if (c >= 0.999) {
      this.railRingTimer -= deltaTime;
      if (this.railRingTimer <= 0) {
        this.railRingTimer = 0.32;
        this.spawnRing(anchor, forward, 0.4, 2.6, 0.28, RAIL_RING_TINT, 0.65, 0.2, false);
      }
    } else {
      this.railRingTimer = 0;
    }
  }

  /** 轨道炮射击：白紫曳光 + 螺旋电离尾迹 + 炮口冲击环 */
  public fireRailTracer(start: THREE.Vector3, end: THREE.Vector3, charge: number): void {
    const c = THREE.MathUtils.clamp(charge, 0, 1);
    const tracer = this.tracers.find((entry) => entry.life <= 0) ?? this.tracers[0];
    tracer.beam.setEndpoints(this.offsetBeamStart(start, end, this.beamStart), end);
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
    this.particles.emitRailHelix(start, this.tmpDir, length, c);

    // 炮口：强闪光 + 余烟 + 三道垂直于弹道的冲击环
    this.particles.emitRailMuzzle(start, this.tmpDir, c);
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

    this.particles.emitEmpBurst(center, radius);
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
}
