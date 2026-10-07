import * as THREE from 'three';
import { getVfxTextures, type ParticleSystem } from '@/features/effects/ParticleSystem';
import {
  applyVerticalGradient,
  createGlowMaterial,
  createGlowSprite,
  isFiniteVector,
  type HazardProbeResult,
} from './MagmaColossusHazards';

/**
 * 第八关 Boss「雷霆飞艇」的专属特效 / 危险物（部分也供第九关「幻影之翼」复用）：
 * - BossParticleFx：ParticleSystem 的空安全包装（比 HazardFx 覆盖更多方法：冒烟、枪口焰、EMP 等）。
 * - LightningBoltPool：程序化锯齿闪电（双交叉条带 + 分叉），可带胶囊体伤害判定窗口并跟随目标。
 * - StormStrikePool：从云底劈下的竖直落雷（贯穿全高度的光柱 + 目标高度上的收拢预警圈）。
 * - ThunderheadShroud：飞艇周身翻涌的雷暴云层（遮蔽船体，云内持续放电）。
 *
 * 约定同第 6/7 关：对象池在构造时一次建好，运行时只改可见性 / 变换 / 顶点；
 * 透明特效 renderOrder 0、transparent、depthTest 开、depthWrite 关；dispose() 释放自建资源。
 */

// ---------------------------------------------------------------------------------------------
// 粒子系统空安全包装
// ---------------------------------------------------------------------------------------------

/** Boss 特效可能调用的 ParticleSystem 方法（缺失的方法静默跳过，便于无 DOM 测试） */
export type BossFxMethod =
  | 'createExplosion'
  | 'createShockwave'
  | 'createHit'
  | 'createHeavyWeaponImpact'
  | 'createGroundImpact'
  | 'createDamageSmoke'
  | 'createMuzzleFlash'
  | 'createEmpBurst'
  | 'createBossDeathExplosion'
  | 'createTeleportIn'
  | 'createTeleportOut'
  | 'createPickupBurst';

export class BossParticleFx {
  private readonly particles: ParticleSystem | null;

  constructor(particles: ParticleSystem | null | undefined) {
    this.particles = particles ?? null;
  }

  public emit<K extends BossFxMethod>(method: K, ...args: Parameters<ParticleSystem[K]>): void {
    const target = this.particles;
    if (!target) return;
    const fn: unknown = (target as unknown as Record<string, unknown>)[method];
    if (typeof fn === 'function') {
      (fn as (...params: Parameters<ParticleSystem[K]>) => void).apply(target, args);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 程序化闪电
// ---------------------------------------------------------------------------------------------

const BOLT_MAIN_POINTS = 16;
const BOLT_BRANCH_POINTS = 6;
const BOLT_MAX_BRANCHES = 2;
const BOLT_LANES = 5;
const BOLT_RIBBONS = 2;
/** 条带横截面：边缘 → 中心 → 边缘（加色混合下边缘为黑 = 柔和淡出） */
const LANE_OFFSETS: readonly number[] = [-1, -0.3, 0, 0.3, 1];
const LANE_WEIGHTS: readonly number[] = [0, 0.5, 1, 0.5, 0];
const VERTS_MAIN = BOLT_MAIN_POINTS * BOLT_LANES * BOLT_RIBBONS;
const VERTS_BRANCH = BOLT_BRANCH_POINTS * BOLT_LANES * BOLT_RIBBONS;
const VERTS_PER_BOLT = VERTS_MAIN + VERTS_BRANCH * BOLT_MAX_BRANCHES;
const BOLT_REJITTER = 0.05;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_X = new THREE.Vector3(1, 0, 0);

export interface LightningStrikeOptions {
  /** 核心半宽（米） */
  width?: number;
  color?: number;
  /** 可见时长（秒） */
  life?: number;
  /** 伤害判定窗口（秒）；0 表示纯视觉 */
  hitWindow?: number;
  damage?: number;
  /** 胶囊体判定半径（米） */
  hitRadius?: number;
  /** 抖动幅度（相对长度） */
  jitter?: number;
  /** 分叉数 0..2 */
  branches?: number;
  /** 判定窗口内终点跟随该目标（被击中的玩家 / 友军） */
  follow?: THREE.Object3D | null;
  /** 颜色倍率（> 1 更亮，配合泛光） */
  intensity?: number;
}

interface BoltSlot {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  positionAttribute: THREE.BufferAttribute;
  colorAttribute: THREE.BufferAttribute;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
  life: number;
  hitWindow: number;
  damage: number;
  hitRadius: number;
  width: number;
  jitter: number;
  branches: number;
  follow: THREE.Object3D | null;
  jitterTimer: number;
  color: THREE.Color;
  intensity: number;
  serial: number;
}

/** 构造 2 条交叉条带 × 若干路径的索引（每条路径：点 × 5 车道） */
function buildBoltIndex(): number[] {
  const indices: number[] = [];
  const pushPath = (base: number, points: number): void => {
    for (let ribbon = 0; ribbon < BOLT_RIBBONS; ribbon++) {
      const ribbonBase = base + ribbon * points * BOLT_LANES;
      for (let i = 0; i < points - 1; i++) {
        for (let lane = 0; lane < BOLT_LANES - 1; lane++) {
          const a = ribbonBase + i * BOLT_LANES + lane;
          const b = a + 1;
          const c = a + BOLT_LANES;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  };
  pushPath(0, BOLT_MAIN_POINTS);
  for (let k = 0; k < BOLT_MAX_BRANCHES; k++) {
    pushPath(VERTS_MAIN + k * VERTS_BRANCH, BOLT_BRANCH_POINTS);
  }
  return indices;
}

/**
 * 闪电池：每道闪电是一个动态几何体（世界坐标写入顶点），约每 0.05 秒重新抖动一次形成闪烁。
 * damage > 0 时在 hitWindow 内按“起点 → 终点”的胶囊体做判定（checkHazard 由宿主汇总）。
 */
export class LightningBoltPool {
  private readonly root: THREE.Group;
  private readonly slots: BoltSlot[] = [];
  private readonly mainPoints: THREE.Vector3[] = [];
  private readonly branchPoints: THREE.Vector3[] = [];
  private readonly dir = new THREE.Vector3();
  private readonly side1 = new THREE.Vector3();
  private readonly side2 = new THREE.Vector3();
  private readonly branchDir = new THREE.Vector3();
  private readonly temp = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly white = new THREE.Color(0xffffff);
  private readonly mixed = new THREE.Color();
  private serial = 0;

  constructor(parent: THREE.Object3D, capacity: number, name: string = 'storm_bolts') {
    this.root = new THREE.Group();
    this.root.name = name;
    parent.add(this.root);
    for (let i = 0; i < BOLT_MAIN_POINTS; i++) this.mainPoints.push(new THREE.Vector3());
    for (let i = 0; i < BOLT_BRANCH_POINTS; i++) this.branchPoints.push(new THREE.Vector3());

    const indices = buildBoltIndex();
    for (let i = 0; i < capacity; i++) {
      const geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(new Float32Array(VERTS_PER_BOLT * 3), 3);
      positionAttribute.setUsage(THREE.DynamicDrawUsage);
      const colorAttribute = new THREE.BufferAttribute(new Float32Array(VERTS_PER_BOLT * 3), 3);
      colorAttribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', positionAttribute);
      geometry.setAttribute('color', colorAttribute);
      geometry.setIndex(indices.slice());
      const material = createGlowMaterial(0xffffff, 0, {
        side: THREE.DoubleSide,
        fog: false,
        vertexColors: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${name}_${i}`;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      this.root.add(mesh);
      this.slots.push({
        mesh,
        geometry,
        positionAttribute,
        colorAttribute,
        material,
        active: false,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        age: 0,
        life: 0.3,
        hitWindow: 0,
        damage: 0,
        hitRadius: 8,
        width: 1,
        jitter: 0.06,
        branches: 0,
        follow: null,
        jitterTimer: 0,
        color: new THREE.Color(0x8fd8ff),
        intensity: 1,
        serial: 0,
      });
    }
  }

  /** 劈出一道闪电；池满时回收最早的一道（优先回收纯视觉闪电） */
  public strike(
    from: THREE.Vector3,
    to: THREE.Vector3,
    options: LightningStrikeOptions = {}
  ): boolean {
    if (!isFiniteVector(from) || !isFiniteVector(to)) return false;
    let slot = this.slots.find((entry) => !entry.active);
    if (!slot) {
      let oldest: BoltSlot | null = null;
      for (const entry of this.slots) {
        const harmful = entry.damage > 0 && entry.age <= entry.hitWindow;
        if (harmful) continue;
        if (!oldest || entry.serial < oldest.serial) oldest = entry;
      }
      if (!oldest) return false;
      slot = oldest;
    }
    slot.active = true;
    slot.serial = ++this.serial;
    slot.from.copy(from);
    slot.to.copy(to);
    slot.age = 0;
    slot.life = Math.max(0.05, options.life ?? 0.32);
    slot.hitWindow = Math.max(0, options.hitWindow ?? 0);
    slot.damage = Math.max(0, options.damage ?? 0);
    slot.hitRadius = Math.max(0.5, options.hitRadius ?? 8);
    slot.width = Math.max(0.05, options.width ?? 1.2);
    slot.jitter = THREE.MathUtils.clamp(options.jitter ?? 0.06, 0, 0.3);
    slot.branches = THREE.MathUtils.clamp(Math.round(options.branches ?? 2), 0, BOLT_MAX_BRANCHES);
    slot.follow = options.follow ?? null;
    slot.color.set(options.color ?? 0x8fd8ff);
    slot.intensity = Math.max(0, options.intensity ?? 1);
    slot.jitterTimer = BOLT_REJITTER;
    this.writeColors(slot);
    this.writePath(slot);
    slot.material.opacity = 1;
    slot.mesh.visible = true;
    return true;
  }

  public update(deltaTime: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += deltaTime;
      if (slot.age >= slot.life) {
        this.release(slot);
        continue;
      }
      let moved = false;
      if (slot.follow && slot.age <= slot.hitWindow && slot.follow.parent) {
        slot.follow.getWorldPosition(this.temp);
        if (isFiniteVector(this.temp)) {
          slot.to.copy(this.temp);
          moved = true;
        }
      }
      slot.jitterTimer -= deltaTime;
      if (slot.jitterTimer <= 0 || moved) {
        slot.jitterTimer = BOLT_REJITTER;
        this.writePath(slot);
      }
      const p = slot.age / slot.life;
      const fade = p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7;
      slot.material.opacity = Math.max(0, fade * (0.72 + 0.28 * Math.random()));
    }
  }

  /** 胶囊体判定（起点 → 终点），只在 hitWindow 内有效 */
  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (!slot.active || slot.damage <= 0 || slot.age > slot.hitWindow) continue;
      this.closestOnSegment(slot.from, slot.to, target, this.closest);
      const reach = slot.hitRadius + targetRadius;
      if (this.closest.distanceToSquared(target) > reach * reach) continue;
      if (slot.damage > out.damage) {
        out.damage = slot.damage;
        out.profile = 'laser';
        out.position.copy(this.closest);
      }
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  /** 正在判定窗口内的伤害闪电数量 */
  public getHarmfulCount(): number {
    let count = 0;
    for (const slot of this.slots) {
      if (slot.active && slot.damage > 0 && slot.age <= slot.hitWindow) count++;
    }
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) this.release(slot);
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.geometry.dispose();
      slot.material.dispose();
    }
    this.slots.length = 0;
  }

  private release(slot: BoltSlot): void {
    slot.active = false;
    slot.follow = null;
    slot.damage = 0;
    slot.mesh.visible = false;
    slot.material.opacity = 0;
  }

  private closestOnSegment(
    a: THREE.Vector3,
    b: THREE.Vector3,
    point: THREE.Vector3,
    out: THREE.Vector3
  ): THREE.Vector3 {
    this.dir.subVectors(b, a);
    const lengthSq = this.dir.lengthSq();
    if (lengthSq < 1e-8) return out.copy(a);
    const t = THREE.MathUtils.clamp(this.temp.subVectors(point, a).dot(this.dir) / lengthSq, 0, 1);
    return out.copy(a).addScaledVector(this.dir, t);
  }

  private writeColors(slot: BoltSlot): void {
    const colors = slot.colorAttribute.array as Float32Array;
    const intensity = slot.intensity;
    for (let v = 0; v < VERTS_PER_BOLT; v++) {
      const lane = v % BOLT_LANES;
      const weight = LANE_WEIGHTS[lane];
      // 中心车道接近白热，两侧为闪电本色
      this.mixed.copy(slot.color).lerp(this.white, lane === 2 ? 0.7 : 0.1);
      colors[v * 3] = this.mixed.r * weight * intensity;
      colors[v * 3 + 1] = this.mixed.g * weight * intensity;
      colors[v * 3 + 2] = this.mixed.b * weight * intensity;
    }
    slot.colorAttribute.needsUpdate = true;
  }

  private writePath(slot: BoltSlot): void {
    const positions = slot.positionAttribute.array as Float32Array;
    this.dir.subVectors(slot.to, slot.from);
    let length = this.dir.length();
    if (!Number.isFinite(length) || length < 0.5) {
      this.dir.set(0, 1, 0);
      length = 0.5;
    } else {
      this.dir.divideScalar(length);
    }
    this.side1.crossVectors(this.dir, Math.abs(this.dir.y) > 0.92 ? WORLD_X : WORLD_UP);
    this.side1.normalize();
    this.side2.crossVectors(this.dir, this.side1).normalize();
    const amp = slot.jitter * length;

    // 主干：带包络的随机游走（两端收拢到端点）
    let o1 = 0;
    let o2 = 0;
    for (let i = 0; i < BOLT_MAIN_POINTS; i++) {
      const t = i / (BOLT_MAIN_POINTS - 1);
      o1 = o1 * 0.5 + (Math.random() * 2 - 1) * amp;
      o2 = o2 * 0.5 + (Math.random() * 2 - 1) * amp;
      const envelope = Math.sin(Math.PI * t);
      this.mainPoints[i]
        .copy(slot.from)
        .addScaledVector(this.dir, length * t)
        .addScaledVector(this.side1, o1 * envelope)
        .addScaledVector(this.side2, o2 * envelope);
    }
    this.writeRibbons(positions, 0, this.mainPoints, BOLT_MAIN_POINTS, slot.width, 0.55, false);

    // 分叉：从主干中段斜向伸出，逐渐变细
    for (let k = 0; k < BOLT_MAX_BRANCHES; k++) {
      const base = VERTS_MAIN + k * VERTS_BRANCH;
      if (k >= slot.branches) {
        this.collapse(positions, base, VERTS_BRANCH, slot.from);
        continue;
      }
      const rootIndex = 3 + Math.floor(Math.random() * (BOLT_MAIN_POINTS - 7));
      const root = this.mainPoints[rootIndex];
      this.branchDir
        .copy(this.dir)
        .addScaledVector(this.side1, (Math.random() * 2 - 1) * 0.9)
        .addScaledVector(this.side2, (Math.random() * 2 - 1) * 0.9)
        .normalize();
      const branchLength = length * (0.12 + Math.random() * 0.16);
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < BOLT_BRANCH_POINTS; i++) {
        const t = i / (BOLT_BRANCH_POINTS - 1);
        b1 = b1 * 0.5 + (Math.random() * 2 - 1) * amp * 0.5;
        b2 = b2 * 0.5 + (Math.random() * 2 - 1) * amp * 0.5;
        this.branchPoints[i]
          .copy(root)
          .addScaledVector(this.branchDir, branchLength * t)
          .addScaledVector(this.side1, b1 * t)
          .addScaledVector(this.side2, b2 * t);
      }
      this.writeRibbons(
        positions,
        base,
        this.branchPoints,
        BOLT_BRANCH_POINTS,
        slot.width * 0.55,
        0,
        true
      );
    }
    slot.positionAttribute.needsUpdate = true;
  }

  /** 写入两条交叉条带；taperEnds：两端收细比例；fadeToTip：分叉尖端收成一点 */
  private writeRibbons(
    positions: Float32Array,
    vertexBase: number,
    points: readonly THREE.Vector3[],
    count: number,
    width: number,
    taperEnds: number,
    fadeToTip: boolean
  ): void {
    for (let ribbon = 0; ribbon < BOLT_RIBBONS; ribbon++) {
      const side = ribbon === 0 ? this.side1 : this.side2;
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0;
        const halfWidth = fadeToTip
          ? width * (1 - t * 0.85)
          : width * (1 - taperEnds + taperEnds * Math.sin(Math.PI * t));
        const point = points[i];
        for (let lane = 0; lane < BOLT_LANES; lane++) {
          const offset = LANE_OFFSETS[lane] * halfWidth;
          const index = (vertexBase + (ribbon * count + i) * BOLT_LANES + lane) * 3;
          positions[index] = point.x + side.x * offset;
          positions[index + 1] = point.y + side.y * offset;
          positions[index + 2] = point.z + side.z * offset;
        }
      }
    }
  }

  private collapse(
    positions: Float32Array,
    vertexBase: number,
    count: number,
    at: THREE.Vector3
  ): void {
    for (let v = 0; v < count; v++) {
      const index = (vertexBase + v) * 3;
      positions[index] = at.x;
      positions[index + 1] = at.y;
      positions[index + 2] = at.z;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 竖直落雷（召雷）
// ---------------------------------------------------------------------------------------------

export interface StormStrikeSpec {
  /** 判定半径（米） */
  radius: number;
  /** 预警时长（秒） */
  warnTime: number;
  damage: number;
  /** 云底高度：闪电起点 */
  topY: number;
  /** 地表高度：闪电终点 */
  bottomY: number;
  /** 预警圈所在高度（施放时目标所在高度） */
  markerY: number;
}

interface StrikeSlot {
  root: THREE.Group;
  column: THREE.Mesh;
  columnMaterial: THREE.MeshBasicMaterial;
  marker: THREE.Mesh;
  markerMaterial: THREE.MeshBasicMaterial;
  inner: THREE.Mesh;
  innerMaterial: THREE.MeshBasicMaterial;
  disc: THREE.Mesh;
  discMaterial: THREE.MeshBasicMaterial;
  topGlow: THREE.Sprite;
  active: boolean;
  struck: boolean;
  age: number;
  afterglow: number;
  seed: number;
  spec: StormStrikeSpec;
}

const STRIKE_AFTERGLOW = 0.35;

/**
 * 召雷：每一发在“目标高度”画出收拢的预警圈，并用一根贯穿云底到地面的淡光柱标出整条落雷通道，
 * 预警结束后由 LightningBoltPool 劈下真正的闪电（伤害判定在闪电池里完成）。
 */
export class StormStrikePool {
  /** 落雷瞬间（粒子 / 音效 / 震屏由宿主处理）；参数为复用向量 */
  public onStrike?: (top: THREE.Vector3, bottom: THREE.Vector3, marker: THREE.Vector3) => void;

  private readonly root: THREE.Group;
  private readonly slots: StrikeSlot[] = [];
  private readonly bolts: LightningBoltPool;
  private readonly columnGeometry: THREE.CylinderGeometry;
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly discGeometry: THREE.CircleGeometry;
  private readonly top = new THREE.Vector3();
  private readonly bottom = new THREE.Vector3();
  private readonly marker = new THREE.Vector3();
  private readonly color: number;

  constructor(
    parent: THREE.Object3D,
    capacity: number,
    bolts: LightningBoltPool,
    color: number = 0x9fd8ff,
    name: string = 'storm_strikes'
  ) {
    this.bolts = bolts;
    this.color = color;
    this.root = new THREE.Group();
    this.root.name = name;
    parent.add(this.root);
    this.columnGeometry = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    this.columnGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.columnGeometry, 0x1a3450, 0xa8d4ff, 1.6);
    this.ringGeometry = new THREE.RingGeometry(0.88, 1, 48, 1);
    this.ringGeometry.rotateX(-Math.PI / 2);
    this.discGeometry = new THREE.CircleGeometry(1, 40);
    this.discGeometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < capacity; i++) {
      const slotRoot = new THREE.Group();
      slotRoot.name = `${name}_${i}`;
      slotRoot.visible = false;
      const columnMaterial = createGlowMaterial(color, 0, {
        side: THREE.DoubleSide,
        vertexColors: true,
        fog: false,
      });
      const column = new THREE.Mesh(this.columnGeometry, columnMaterial);
      const markerMaterial = createGlowMaterial(color, 0, { side: THREE.DoubleSide, fog: false });
      const marker = new THREE.Mesh(this.ringGeometry, markerMaterial);
      const innerMaterial = createGlowMaterial(0xffffff, 0, { side: THREE.DoubleSide, fog: false });
      const inner = new THREE.Mesh(this.ringGeometry, innerMaterial);
      const discMaterial = createGlowMaterial(color, 0, { side: THREE.DoubleSide, fog: false });
      const disc = new THREE.Mesh(this.discGeometry, discMaterial);
      const topGlow = createGlowSprite(0xcfe8ff, 1, 0, 'glow', false);
      for (const mesh of [column, marker, inner, disc]) {
        mesh.frustumCulled = false;
        mesh.renderOrder = 0;
      }
      slotRoot.add(column, marker, inner, disc, topGlow);
      this.root.add(slotRoot);
      this.slots.push({
        root: slotRoot,
        column,
        columnMaterial,
        marker,
        markerMaterial,
        inner,
        innerMaterial,
        disc,
        discMaterial,
        topGlow,
        active: false,
        struck: false,
        age: 0,
        afterglow: 0,
        seed: i * 1.73,
        spec: { radius: 1, warnTime: 1, damage: 0, topY: 1, bottomY: 0, markerY: 0 },
      });
    }
  }

  public spawn(x: number, z: number, spec: StormStrikeSpec): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (![spec.topY, spec.bottomY, spec.markerY].every((v) => Number.isFinite(v))) return false;
    const slot = this.slots.find((entry) => !entry.active);
    if (!slot) return false;
    slot.active = true;
    slot.struck = false;
    slot.age = 0;
    slot.afterglow = 0;
    slot.spec = { ...spec, topY: Math.max(spec.topY, spec.bottomY + 10) };
    const radius = Math.max(1, spec.radius);
    const height = slot.spec.topY - slot.spec.bottomY;
    slot.root.position.set(x, 0, z);
    slot.column.position.y = slot.spec.bottomY;
    slot.column.scale.set(radius, height, radius);
    const markerY = THREE.MathUtils.clamp(spec.markerY, slot.spec.bottomY, slot.spec.topY);
    slot.marker.position.y = markerY;
    slot.marker.scale.set(radius, 1, radius);
    slot.inner.position.y = markerY + 0.3;
    slot.disc.position.y = markerY - 0.3;
    slot.disc.scale.set(radius, 1, radius);
    slot.topGlow.position.y = slot.spec.topY;
    slot.column.visible = true;
    slot.marker.visible = true;
    slot.inner.visible = true;
    slot.disc.visible = true;
    slot.root.visible = true;
    this.animateTelegraph(slot);
    return true;
  }

  public update(deltaTime: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += deltaTime;
      if (!slot.struck) {
        if (slot.age >= slot.spec.warnTime) {
          this.fire(slot);
        } else {
          this.animateTelegraph(slot);
        }
        continue;
      }
      slot.afterglow += deltaTime;
      const fade = Math.max(0, 1 - slot.afterglow / STRIKE_AFTERGLOW);
      slot.columnMaterial.opacity = 0.55 * fade;
      slot.topGlow.material.opacity = 0.9 * fade;
      if (slot.afterglow >= STRIKE_AFTERGLOW) this.release(slot);
    }
  }

  /** 预警阶段（未落雷）的数量 */
  public getWarningCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active && !slot.struck) count++;
    return count;
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) this.release(slot);
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.columnMaterial.dispose();
      slot.markerMaterial.dispose();
      slot.innerMaterial.dispose();
      slot.discMaterial.dispose();
      slot.topGlow.material.dispose();
    }
    this.columnGeometry.dispose();
    this.ringGeometry.dispose();
    this.discGeometry.dispose();
    this.slots.length = 0;
  }

  private animateTelegraph(slot: StrikeSlot): void {
    const w = Math.min(1, slot.age / slot.spec.warnTime);
    const pulse = 0.5 + 0.5 * Math.sin(slot.age * (8 + 28 * w) + slot.seed);
    slot.columnMaterial.opacity = 0.04 + 0.1 * w + 0.05 * pulse * w;
    slot.markerMaterial.opacity = 0.35 + 0.5 * pulse;
    slot.discMaterial.opacity = 0.04 + 0.14 * w;
    // 内圈从中心扩到外圈边缘：直观显示倒计时
    const inner = Math.max(0.05, w) * Math.max(1, slot.spec.radius);
    slot.inner.scale.set(inner, 1, inner);
    slot.innerMaterial.opacity = 0.25 + 0.55 * w;
    const glow = slot.spec.radius * (1.5 + 3.5 * w);
    slot.topGlow.scale.set(glow, glow, 1);
    slot.topGlow.material.opacity = 0.2 + 0.6 * w * (0.7 + 0.3 * pulse);
  }

  private fire(slot: StrikeSlot): void {
    slot.struck = true;
    slot.afterglow = 0;
    slot.marker.visible = false;
    slot.inner.visible = false;
    slot.disc.visible = false;
    const { radius, damage, topY, bottomY } = slot.spec;
    const x = slot.root.position.x;
    const z = slot.root.position.z;
    this.top.set(x, topY, z);
    this.bottom.set(x, bottomY, z);
    this.marker.set(x, slot.marker.position.y, z);
    this.bolts.strike(this.top, this.bottom, {
      width: Math.max(3, radius * 0.24),
      color: this.color,
      life: 0.42,
      hitWindow: 0.24,
      damage,
      hitRadius: radius,
      jitter: 0.035,
      branches: 2,
      intensity: 1.6,
    });
    const flash = radius * 6;
    slot.topGlow.scale.set(flash, flash, 1);
    this.onStrike?.(this.top, this.bottom, this.marker);
  }

  private release(slot: StrikeSlot): void {
    slot.active = false;
    slot.struck = false;
    slot.root.visible = false;
    slot.columnMaterial.opacity = 0;
    slot.markerMaterial.opacity = 0;
    slot.innerMaterial.opacity = 0;
    slot.discMaterial.opacity = 0;
    slot.topGlow.material.opacity = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// 雷暴云层
// ---------------------------------------------------------------------------------------------

type ShroudState = 'idle' | 'forming' | 'active' | 'dispersing';

interface PuffSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  base: THREE.Vector3;
  size: number;
  spin: number;
  seed: number;
}

interface GlowSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  seed: number;
}

interface FlashSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  timer: number;
  life: number;
}

const SHROUD_FORM_TIME = 1.6;
const SHROUD_DISPERSE_TIME = 2.2;

/**
 * 飞艇周身的雷暴云：挂在飞艇根节点下（局部坐标，米），随船体移动。
 * 云团为普通混合的烟雾精灵（遮挡船体），内部有加色闪光；宿主据 contains() 做云内放电判定。
 */
export class ThunderheadShroud {
  public readonly root: THREE.Group;
  private readonly puffs: PuffSlot[] = [];
  private readonly flashes: FlashSlot[] = [];
  private readonly glows: GlowSlot[] = [];
  private readonly halfLength: number;
  private readonly radius: number;
  private state: ShroudState = 'idle';
  private timer = 0;
  private duration = 6;
  private coverage = 0;
  private time = 0;

  constructor(parent: THREE.Object3D, halfLength: number, radius: number, puffCount: number = 20) {
    this.halfLength = Math.max(1, halfLength);
    this.radius = Math.max(1, radius);
    this.root = new THREE.Group();
    this.root.name = 'zeppelin_thunderhead';
    this.root.visible = false;
    parent.add(this.root);
    const smoke = getVfxTextures().smoke;
    let seed = 17;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const rows = 6;
    const perRow = Math.max(1, Math.ceil(puffCount / rows));
    for (let i = 0; i < puffCount; i++) {
      // 沿船体轴向分 6 排，每排的云团绕船体一周（上方更厚 = 雷暴云顶），把船身整个裹住
      const row = i % rows;
      const k = Math.floor(i / rows);
      const along = (row / (rows - 1)) * 2 - 1;
      const taper = 1 - 0.35 * Math.abs(along);
      const angle = (k / perRow) * Math.PI * 2 + row * 0.9 + (rand() - 0.5) * 0.7;
      const ring = this.radius * (1.35 + rand() * 0.7) * taper;
      const base = new THREE.Vector3(
        Math.cos(angle) * ring * 1.15,
        Math.sin(angle) * ring * 0.85 + this.radius * 0.45,
        along * this.halfLength * 0.9
      );
      const material = new THREE.SpriteMaterial({
        map: smoke,
        color: new THREE.Color(0x56648a).lerp(new THREE.Color(0x9aa8cc), rand()),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        fog: true,
      });
      const sprite = new THREE.Sprite(material);
      sprite.name = `zeppelin_thunderhead_puff_${i}`;
      sprite.renderOrder = 0;
      sprite.position.copy(base);
      this.root.add(sprite);
      this.puffs.push({
        sprite,
        material,
        base,
        size: this.radius * (2.7 + rand() * 1.3) * (0.75 + 0.25 * taper),
        spin: (rand() - 0.5) * 0.3,
        seed: rand() * 10,
      });
    }
    // 云层内部常亮的电光底色：让整团云看起来“带电”
    for (let i = 0; i < 3; i++) {
      const sprite = createGlowSprite(0x3a7cff, 1, 0, 'glow', true);
      sprite.name = `zeppelin_thunderhead_glow_${i}`;
      sprite.position.set(0, this.radius * 1.6, (i - 1) * this.halfLength * 0.6);
      this.root.add(sprite);
      this.glows.push({ sprite, material: sprite.material, seed: i * 2.1 });
    }
    for (let i = 0; i < 5; i++) {
      const sprite = createGlowSprite(0xcfe6ff, 1, 0, 'glow', true);
      sprite.name = `zeppelin_thunderhead_flash_${i}`;
      this.root.add(sprite);
      this.flashes.push({ sprite, material: sprite.material, timer: rand() * 0.6, life: 0 });
    }
  }

  /** 开始翻涌；已在活动中返回 false */
  public start(duration: number): boolean {
    if (this.state === 'forming' || this.state === 'active') return false;
    this.state = 'forming';
    this.timer = 0;
    this.duration = Math.max(1, duration);
    this.root.visible = true;
    return true;
  }

  /** 立即开始消散（EMP / 死亡） */
  public stop(): void {
    if (this.state === 'idle' || this.state === 'dispersing') return;
    this.state = 'dispersing';
    this.timer = 0;
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    if (this.state === 'idle') return;
    this.timer += deltaTime;
    let grow = 1;
    switch (this.state) {
      case 'forming': {
        const p = Math.min(1, this.timer / SHROUD_FORM_TIME);
        this.coverage = p * p * (3 - 2 * p);
        grow = 0.55 + 0.45 * this.coverage;
        if (p >= 1) {
          this.state = 'active';
          this.timer = 0;
        }
        break;
      }
      case 'active':
        this.coverage = 1;
        if (this.timer >= this.duration) {
          this.state = 'dispersing';
          this.timer = 0;
        }
        break;
      case 'dispersing': {
        const p = Math.min(1, this.timer / SHROUD_DISPERSE_TIME);
        this.coverage = 1 - p;
        grow = 1 + 0.35 * p;
        if (p >= 1) {
          this.state = 'idle';
          this.coverage = 0;
          this.root.visible = false;
        }
        break;
      }
    }
    const t = this.time;
    for (const puff of this.puffs) {
      const breathe = 1 + 0.06 * Math.sin(t * 0.9 + puff.seed);
      const size = puff.size * grow * breathe;
      puff.sprite.scale.set(size, size * 0.82, 1);
      puff.sprite.position.set(
        puff.base.x * grow,
        puff.base.y * grow + Math.sin(t * 0.5 + puff.seed) * this.radius * 0.06,
        puff.base.z
      );
      puff.material.rotation += puff.spin * deltaTime;
      puff.material.opacity = 0.92 * this.coverage;
    }
    for (const glow of this.glows) {
      const size = this.radius * (5.2 + 0.6 * Math.sin(t * 1.3 + glow.seed)) * grow;
      glow.sprite.scale.set(size, size * 0.8, 1);
      glow.material.opacity = (0.13 + 0.06 * Math.sin(t * 3.1 + glow.seed)) * this.coverage;
    }
    // 云内闪光：随机点亮某个云团的内部
    for (const flash of this.flashes) {
      flash.timer -= deltaTime;
      if (flash.timer <= 0 && this.coverage > 0.3) {
        const puff = this.puffs[Math.floor(Math.random() * this.puffs.length)];
        if (puff) flash.sprite.position.copy(puff.sprite.position);
        flash.life = 0.1 + Math.random() * 0.14;
        flash.timer = 0.18 + Math.random() * 0.6;
      }
      flash.life = Math.max(0, flash.life - deltaTime);
      const on = flash.life > 0 ? 1 : 0;
      const size = this.radius * (3 + Math.random() * 1.6);
      flash.sprite.scale.set(size, size, 1);
      flash.material.opacity = on * 0.85 * this.coverage;
    }
  }

  /** 云层是否足以遮蔽并放电（成形后期 / 持续中） */
  public isCharged(): boolean {
    return (this.state === 'forming' && this.coverage > 0.75) || this.state === 'active';
  }

  public isBusy(): boolean {
    return this.state !== 'idle';
  }

  public getCoverage(): number {
    return this.coverage;
  }

  public getState(): ShroudState {
    return this.state;
  }

  /** 局部坐标点是否位于云层椭球内（含目标半径） */
  public containsLocal(local: THREE.Vector3, targetRadius: number = 0): boolean {
    if (!isFiniteVector(local)) return false;
    const a = this.radius * 2.6 + targetRadius;
    const b = this.radius * 2.4 + targetRadius;
    const c = this.halfLength * 1.15 + targetRadius;
    const x = local.x / a;
    const y = (local.y - this.radius * 0.25) / b;
    const z = local.z / c;
    return x * x + y * y + z * z <= 1;
  }

  /** 离局部坐标点最近的云团（局部坐标写入 out） */
  public nearestPuffLocal(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    let best = Infinity;
    for (const puff of this.puffs) {
      const d = puff.sprite.position.distanceToSquared(local);
      if (d < best) {
        best = d;
        out.copy(puff.sprite.position);
      }
    }
    if (best === Infinity) out.set(0, this.radius, 0);
    return out;
  }

  public clear(): void {
    this.state = 'idle';
    this.timer = 0;
    this.coverage = 0;
    this.root.visible = false;
    for (const puff of this.puffs) puff.material.opacity = 0;
    for (const flash of this.flashes) flash.material.opacity = 0;
    for (const glow of this.glows) glow.material.opacity = 0;
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const puff of this.puffs) puff.material.dispose();
    for (const flash of this.flashes) flash.material.dispose();
    for (const glow of this.glows) glow.material.dispose();
    this.puffs.length = 0;
    this.flashes.length = 0;
    this.glows.length = 0;
  }
}
