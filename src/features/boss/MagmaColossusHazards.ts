import * as THREE from 'three';
import {
  getVfxTextures,
  type HeavyWeaponImpactProfile,
  type ParticleSystem,
} from '@/features/effects/ParticleSystem';

/**
 * 第 6 / 7 关 Boss 共用的特殊武器原语（熔岩巨像与深渊利维坦共同使用）。
 *
 * - HazardFx：对 ParticleSystem 的“可选调用”包装——测试替身往往只实现少数方法，
 *   缺失的方法直接跳过，战斗逻辑永远不因特效缺失而抛错。
 * - HazardRingPool：扩散冲击环（践踏冲击波 / 破冰冲击 / 声呐脉冲）。
 * - HazardColumnPool：先预警后喷发的柱状危险区（熔岩喷泉 / 水柱）。
 * - ArcShellPool：带落点准星的抛物线炮弹（迫击炮 / 布雷弹）。
 *
 * 约定：所有对象池在构造时一次性建好网格，运行时只切换可见性与变换，不做逐帧分配；
 * 透明特效材质 renderOrder 0、transparent、depthTest 开、depthWrite 关；
 * dispose() 从父节点移除并释放自己创建的几何体与材质（共享贴图不释放）。
 */

/** Boss 特效可能调用的 ParticleSystem 方法 */
export type HazardFxMethod =
  | 'createExplosion'
  | 'createShockwave'
  | 'createGroundImpact'
  | 'createWaterImpact'
  | 'createHeavyWeaponImpact'
  | 'createHit'
  | 'createTrail'
  | 'createMissileImpact'
  | 'createBossMissileExplosion'
  | 'createFlakExplosion'
  | 'createBossDeathExplosion';

/** ParticleSystem 的空安全包装：粒子系统缺失或方法缺失时静默跳过 */
export class HazardFx {
  private readonly particles: ParticleSystem | null;

  constructor(particles: ParticleSystem | null | undefined) {
    this.particles = particles ?? null;
  }

  public emit<K extends HazardFxMethod>(method: K, ...args: Parameters<ParticleSystem[K]>): void {
    const target = this.particles;
    if (!target) return;
    const fn: unknown = (target as unknown as Record<string, unknown>)[method];
    if (typeof fn === 'function') {
      (fn as (...params: Parameters<ParticleSystem[K]>) => void).apply(target, args);
    }
  }
}

/** 一次特殊武器判定的可复用结果（取伤害最高的命中） */
export interface HazardProbeResult {
  damage: number;
  profile: HeavyWeaponImpactProfile;
  position: THREE.Vector3;
}

export function createHazardProbe(): HazardProbeResult {
  return { damage: 0, profile: 'boss-cannon', position: new THREE.Vector3() };
}

export function resetHazardProbe(probe: HazardProbeResult): void {
  probe.damage = 0;
  probe.profile = 'boss-cannon';
  probe.position.set(0, 0, 0);
}

export function isFiniteVector(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** 加色发光材质（遵循透明特效约定） */
export function createGlowMaterial(
  color: number,
  opacity: number,
  options: { side?: THREE.Side; fog?: boolean; vertexColors?: boolean; additive?: boolean } = {}
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending: options.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: options.side ?? THREE.FrontSide,
    fog: options.fog ?? true,
    vertexColors: options.vertexColors ?? false,
  });
}

/** 加色光晕 Sprite；无 DOM 环境下贴图为 null，退化为无贴图方片 */
export function createGlowSprite(
  color: number,
  size: number,
  opacity: number = 1,
  kind: 'glow' | 'ring' | 'fire' = 'glow',
  fog: boolean = true
): THREE.Sprite {
  const textures = getVfxTextures();
  const map = kind === 'ring' ? textures.ring : kind === 'fire' ? textures.fire : textures.glow;
  const material = new THREE.SpriteMaterial({
    color,
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 0;
  return sprite;
}

/** 给几何体烘焙一条自下而上的顶点色渐变（加色材质下等价于向上淡出） */
export function applyVerticalGradient(
  geometry: THREE.BufferGeometry,
  bottom: number,
  top: number,
  exponent: number = 1
): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const span = Math.max(1e-6, box.max.y - box.min.y);
  const from = new THREE.Color(bottom);
  const to = new THREE.Color(top);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.pow(
      THREE.MathUtils.clamp((position.getY(i) - box.min.y) / span, 0, 1),
      exponent
    );
    mixed.copy(from).lerp(to, t);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

type Renderable = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

/** 释放对象树内的几何体与材质（跳过 userData.sharedResource 与 Sprite 的全局共享几何体） */
export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (node.userData.sharedResource === true) return;
    const renderable = node as Renderable;
    if (renderable.geometry && !(node instanceof THREE.Sprite)) {
      if (renderable.geometry.userData.sharedResource !== true) {
        renderable.geometry.dispose();
      }
    }
    const material = renderable.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        if (entry.userData.sharedResource !== true) entry.dispose();
      }
    } else if (material && material.userData.sharedResource !== true) {
      material.dispose();
    }
  });
}

/** 从父节点摘下并释放 */
export function detachAndDispose(root: THREE.Object3D): void {
  root.parent?.remove(root);
  disposeObjectTree(root);
}

// ---------------------------------------------------------------------------------------------
// 扩散冲击环
// ---------------------------------------------------------------------------------------------

export interface HazardRingSpec {
  /** 最终半径（米） */
  maxRadius: number;
  /** 扩散时长（秒） */
  duration: number;
  /** 环墙高度（米）：目标需低于 中心 y + wallHeight 才会被命中 */
  wallHeight: number;
  /** 环带厚度（米） */
  bandWidth: number;
  /** 0 表示纯视觉（如声呐脉冲） */
  damage: number;
  profile: HeavyWeaponImpactProfile;
  color: number;
  startRadius?: number;
  opacity?: number;
}

interface RingSlot {
  root: THREE.Group;
  wall: THREE.Mesh;
  wallMaterial: THREE.MeshBasicMaterial;
  edge: THREE.Mesh;
  edgeMaterial: THREE.MeshBasicMaterial;
  active: boolean;
  center: THREE.Vector3;
  age: number;
  duration: number;
  startRadius: number;
  maxRadius: number;
  radius: number;
  prevRadius: number;
  wallHeight: number;
  bandWidth: number;
  damage: number;
  profile: HeavyWeaponImpactProfile;
  opacity: number;
}

export class HazardRingPool {
  private readonly root: THREE.Group;
  private readonly slots: RingSlot[] = [];
  private readonly wallGeometry: THREE.CylinderGeometry;
  private readonly edgeGeometry: THREE.RingGeometry;

  constructor(parent: THREE.Object3D, capacity: number, name: string) {
    this.root = new THREE.Group();
    this.root.name = name;
    parent.add(this.root);

    this.wallGeometry = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true);
    this.wallGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.wallGeometry, 0xffffff, 0x000000, 0.8);
    this.edgeGeometry = new THREE.RingGeometry(0.92, 1, 72, 1);
    this.edgeGeometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < capacity; i++) {
      const slotRoot = new THREE.Group();
      slotRoot.name = `${name}_${i}`;
      slotRoot.visible = false;
      const wallMaterial = createGlowMaterial(0xffffff, 0, {
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      const wall = new THREE.Mesh(this.wallGeometry, wallMaterial);
      wall.renderOrder = 0;
      wall.frustumCulled = false;
      const edgeMaterial = createGlowMaterial(0xffffff, 0, { side: THREE.DoubleSide });
      const edge = new THREE.Mesh(this.edgeGeometry, edgeMaterial);
      edge.position.y = 0.6;
      edge.renderOrder = 0;
      edge.frustumCulled = false;
      slotRoot.add(wall, edge);
      this.root.add(slotRoot);
      this.slots.push({
        root: slotRoot,
        wall,
        wallMaterial,
        edge,
        edgeMaterial,
        active: false,
        center: new THREE.Vector3(),
        age: 0,
        duration: 1,
        startRadius: 0,
        maxRadius: 1,
        radius: 0,
        prevRadius: 0,
        wallHeight: 1,
        bandWidth: 1,
        damage: 0,
        profile: 'boss-armor',
        opacity: 0.8,
      });
    }
  }

  public spawn(center: THREE.Vector3, spec: HazardRingSpec): boolean {
    if (!isFiniteVector(center)) return false;
    const slot = this.slots.find((entry) => !entry.active);
    if (!slot) return false;
    slot.active = true;
    slot.center.copy(center);
    slot.age = 0;
    slot.duration = Math.max(0.05, spec.duration);
    slot.startRadius = Math.max(0.5, spec.startRadius ?? spec.maxRadius * 0.04);
    slot.maxRadius = Math.max(slot.startRadius + 1, spec.maxRadius);
    slot.radius = slot.startRadius;
    slot.prevRadius = slot.startRadius;
    slot.wallHeight = Math.max(0.5, spec.wallHeight);
    slot.bandWidth = Math.max(0.5, spec.bandWidth);
    slot.damage = Math.max(0, spec.damage);
    slot.profile = spec.profile;
    slot.opacity = spec.opacity ?? 0.85;
    slot.wallMaterial.color.set(spec.color);
    slot.edgeMaterial.color.set(spec.color);
    slot.root.position.copy(center);
    slot.root.visible = true;
    this.applyVisual(slot, 0);
    return true;
  }

  public update(deltaTime: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += deltaTime;
      const progress = Math.min(1, slot.age / slot.duration);
      slot.prevRadius = slot.radius;
      const eased = 1 - (1 - progress) * (1 - progress);
      slot.radius = slot.startRadius + (slot.maxRadius - slot.startRadius) * eased;
      this.applyVisual(slot, progress);
      if (progress >= 1) {
        slot.active = false;
        slot.root.visible = false;
      }
    }
  }

  private applyVisual(slot: RingSlot, progress: number): void {
    const radius = Math.max(0.01, slot.radius);
    slot.wall.scale.set(radius, slot.wallHeight, radius);
    slot.edge.scale.set(radius, 1, radius);
    const fade = Math.pow(1 - progress, 1.25);
    slot.wallMaterial.opacity = slot.opacity * fade;
    slot.edgeMaterial.opacity = Math.min(1, slot.opacity * 1.25) * fade;
  }

  /** 环带扫过判定（考虑本帧扫过的半径区间，低帧率也不会漏判） */
  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (!slot.active || slot.damage <= 0) continue;
      const dy = target.y - slot.center.y;
      if (dy < -targetRadius - 4 || dy > slot.wallHeight + targetRadius) continue;
      const dx = target.x - slot.center.x;
      const dz = target.z - slot.center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const half = slot.bandWidth * 0.5 + targetRadius;
      const inner = Math.min(slot.prevRadius, slot.radius) - half;
      const outer = Math.max(slot.prevRadius, slot.radius) + half;
      if (distance < inner || distance > outer) continue;
      if (slot.damage > out.damage) {
        out.damage = slot.damage;
        out.profile = slot.profile;
        const inv = distance > 1e-4 ? slot.radius / distance : 0;
        out.position.set(slot.center.x + dx * inv, target.y, slot.center.z + dz * inv);
      }
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) {
      slot.active = false;
      slot.root.visible = false;
    }
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.wallMaterial.dispose();
      slot.edgeMaterial.dispose();
    }
    this.wallGeometry.dispose();
    this.edgeGeometry.dispose();
    this.slots.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// 柱状喷发危险区（先在地表预警，再喷发）
// ---------------------------------------------------------------------------------------------

export interface HazardColumnPalette {
  warn: number;
  outerBottom: number;
  outerTop: number;
  core: number;
  cap: number;
  /** 整体不透明度系数 */
  opacity: number;
  /** 柱体顶 / 底半径系数（水柱上宽下窄像浪花，熔岩柱下宽上窄像喷泉） */
  topRadius: number;
  bottomRadius: number;
}

export const LAVA_COLUMN_PALETTE: HazardColumnPalette = {
  warn: 0xff3a12,
  outerBottom: 0xffb347,
  outerTop: 0x6a0a00,
  core: 0xfff0b8,
  cap: 0xff8a2a,
  opacity: 1,
  topRadius: 0.82,
  bottomRadius: 1.18,
};

export const WATER_COLUMN_PALETTE: HazardColumnPalette = {
  warn: 0x6fe8ff,
  outerBottom: 0x9fd6e8,
  outerTop: 0x061a24,
  core: 0xc8eeff,
  cap: 0xb8e6ff,
  opacity: 0.5,
  topRadius: 1.45,
  bottomRadius: 0.85,
};

export interface HazardColumnSpec {
  radius: number;
  height: number;
  warnTime: number;
  eruptTime: number;
  damage: number;
  profile: HeavyWeaponImpactProfile;
}

interface ColumnSlot {
  root: THREE.Group;
  disc: THREE.Mesh;
  discMaterial: THREE.MeshBasicMaterial;
  ring: THREE.Mesh;
  ringMaterial: THREE.MeshBasicMaterial;
  outer: THREE.Mesh;
  outerMaterial: THREE.MeshBasicMaterial;
  core: THREE.Mesh;
  coreMaterial: THREE.MeshBasicMaterial;
  cap: THREE.Sprite;
  capMaterial: THREE.SpriteMaterial;
  active: boolean;
  erupted: boolean;
  base: THREE.Vector3;
  age: number;
  radius: number;
  height: number;
  currentHeight: number;
  warnTime: number;
  eruptTime: number;
  damage: number;
  damageActive: boolean;
  profile: HeavyWeaponImpactProfile;
  seed: number;
}

export class HazardColumnPool {
  /** 喷发瞬间回调（粒子 / 音效 / 镜头震动由宿主处理） */
  public onErupt?: (base: THREE.Vector3, radius: number, height: number) => void;

  private readonly root: THREE.Group;
  private readonly slots: ColumnSlot[] = [];
  private readonly discGeometry: THREE.CircleGeometry;
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly outerGeometry: THREE.CylinderGeometry;
  private readonly coreGeometry: THREE.CylinderGeometry;
  private readonly opacityScale: number;

  constructor(
    parent: THREE.Object3D,
    capacity: number,
    name: string,
    palette: HazardColumnPalette
  ) {
    this.opacityScale = THREE.MathUtils.clamp(palette.opacity, 0.05, 1);
    this.root = new THREE.Group();
    this.root.name = name;
    parent.add(this.root);

    this.discGeometry = new THREE.CircleGeometry(1, 40);
    this.discGeometry.rotateX(-Math.PI / 2);
    this.ringGeometry = new THREE.RingGeometry(0.9, 1, 48, 1);
    this.ringGeometry.rotateX(-Math.PI / 2);
    this.outerGeometry = new THREE.CylinderGeometry(
      palette.topRadius,
      palette.bottomRadius,
      1,
      22,
      8,
      true
    );
    this.outerGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.outerGeometry, palette.outerBottom, palette.outerTop, 0.9);
    this.coreGeometry = new THREE.CylinderGeometry(0.4, 0.62, 1, 14, 4, true);
    this.coreGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.coreGeometry, palette.core, palette.outerBottom, 1.4);

    for (let i = 0; i < capacity; i++) {
      const slotRoot = new THREE.Group();
      slotRoot.name = `${name}_${i}`;
      slotRoot.visible = false;

      const discMaterial = createGlowMaterial(palette.warn, 0, {
        side: THREE.DoubleSide,
        fog: false,
      });
      const disc = new THREE.Mesh(this.discGeometry, discMaterial);
      disc.position.y = 0.8;
      const ringMaterial = createGlowMaterial(palette.warn, 0, {
        side: THREE.DoubleSide,
        fog: false,
      });
      const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
      ring.position.y = 1.0;
      const outerMaterial = createGlowMaterial(0xffffff, 0, {
        side: THREE.DoubleSide,
        vertexColors: true,
      });
      const outer = new THREE.Mesh(this.outerGeometry, outerMaterial);
      const coreMaterial = createGlowMaterial(0xffffff, 0, { vertexColors: true });
      const core = new THREE.Mesh(this.coreGeometry, coreMaterial);
      const cap = createGlowSprite(palette.cap, 1, 0, 'fire');
      const capMaterial = cap.material;
      for (const mesh of [disc, ring, outer, core]) {
        mesh.renderOrder = 0;
        mesh.frustumCulled = false;
      }
      slotRoot.add(disc, ring, outer, core, cap);
      this.root.add(slotRoot);
      this.slots.push({
        root: slotRoot,
        disc,
        discMaterial,
        ring,
        ringMaterial,
        outer,
        outerMaterial,
        core,
        coreMaterial,
        cap,
        capMaterial,
        active: false,
        erupted: false,
        base: new THREE.Vector3(),
        age: 0,
        radius: 1,
        height: 1,
        currentHeight: 0,
        warnTime: 1,
        eruptTime: 1,
        damage: 0,
        damageActive: false,
        profile: 'boss-cannon',
        seed: i * 1.37,
      });
    }
  }

  public spawn(base: THREE.Vector3, spec: HazardColumnSpec): boolean {
    if (!isFiniteVector(base)) return false;
    const slot = this.slots.find((entry) => !entry.active);
    if (!slot) return false;
    slot.active = true;
    slot.erupted = false;
    slot.base.copy(base);
    slot.age = 0;
    slot.radius = Math.max(1, spec.radius);
    slot.height = Math.max(2, spec.height);
    slot.currentHeight = 0;
    slot.warnTime = Math.max(0.2, spec.warnTime);
    slot.eruptTime = Math.max(0.2, spec.eruptTime);
    slot.damage = Math.max(0, spec.damage);
    slot.damageActive = false;
    slot.profile = spec.profile;
    slot.root.position.copy(base);
    slot.root.visible = true;
    slot.outer.visible = false;
    slot.core.visible = false;
    slot.cap.visible = false;
    slot.ring.visible = true;
    slot.disc.visible = true;
    slot.ring.scale.set(slot.radius, 1, slot.radius);
    return true;
  }

  public update(deltaTime: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += deltaTime;
      const t = slot.age;

      if (t < slot.warnTime) {
        // 预警：地表发光盘逐渐扩大、闪烁加速；外圈精确标出危险半径
        const w = t / slot.warnTime;
        const pulse = 0.5 + 0.5 * Math.sin(t * (7 + 26 * w) + slot.seed);
        const discRadius = slot.radius * (0.45 + 0.55 * w);
        slot.disc.scale.set(discRadius, 1, discRadius);
        slot.discMaterial.opacity = 0.12 + 0.42 * w + 0.18 * pulse * w;
        slot.ringMaterial.opacity = 0.3 + 0.55 * pulse;
        slot.damageActive = false;
        continue;
      }

      const eruptAge = t - slot.warnTime;
      if (eruptAge < slot.eruptTime) {
        if (!slot.erupted) {
          slot.erupted = true;
          slot.outer.visible = true;
          slot.core.visible = true;
          slot.cap.visible = true;
          slot.ring.visible = false;
          this.onErupt?.(slot.base, slot.radius, slot.height);
        }
        const e = eruptAge / slot.eruptTime;
        const rise = 1 - Math.pow(1 - Math.min(1, e / 0.16), 3);
        const tail = e > 0.72 ? (e - 0.72) / 0.28 : 0;
        const wobble = 1 + 0.08 * Math.sin(t * 23 + slot.seed) + 0.05 * Math.sin(t * 41);
        const width = slot.radius * wobble * (1 - 0.55 * tail);
        slot.currentHeight = slot.height * rise * (1 - 0.3 * tail);
        slot.outer.scale.set(width, Math.max(0.01, slot.currentHeight), width);
        slot.core.scale.set(width * 0.62, Math.max(0.01, slot.currentHeight * 1.02), width * 0.62);
        slot.outer.rotation.y = t * 1.7 + slot.seed;
        slot.core.rotation.y = -t * 2.3;
        const fade = 1 - tail;
        slot.outerMaterial.opacity = 0.82 * fade * this.opacityScale;
        slot.coreMaterial.opacity = 0.95 * fade * this.opacityScale;
        slot.discMaterial.opacity = 0.65 * fade * this.opacityScale;
        slot.disc.scale.set(slot.radius * 1.35, 1, slot.radius * 1.35);
        slot.cap.position.y = slot.currentHeight;
        const capSize = slot.radius * (3.4 + 0.6 * Math.sin(t * 17 + slot.seed));
        slot.cap.scale.set(capSize, capSize, 1);
        slot.capMaterial.opacity = 0.85 * fade * Math.sqrt(this.opacityScale);
        slot.damageActive = rise > 0.3 && tail < 0.55;
        continue;
      }

      slot.active = false;
      slot.damageActive = false;
      slot.root.visible = false;
    }
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (!slot.active || !slot.damageActive || slot.damage <= 0) continue;
      const dy = target.y - slot.base.y;
      if (dy < -targetRadius - 2 || dy > slot.currentHeight + targetRadius) continue;
      const dx = target.x - slot.base.x;
      const dz = target.z - slot.base.z;
      const reach = slot.radius + targetRadius;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (slot.damage > out.damage) {
        out.damage = slot.damage;
        out.profile = slot.profile;
        out.position.set(slot.base.x, target.y, slot.base.z);
      }
    }
  }

  /** 预警阶段（未喷发）的柱子数量 */
  public getWarningCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active && !slot.erupted) count++;
    return count;
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) {
      slot.active = false;
      slot.damageActive = false;
      slot.root.visible = false;
    }
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.discMaterial.dispose();
      slot.ringMaterial.dispose();
      slot.outerMaterial.dispose();
      slot.coreMaterial.dispose();
      slot.capMaterial.dispose();
    }
    this.discGeometry.dispose();
    this.ringGeometry.dispose();
    this.outerGeometry.dispose();
    this.coreGeometry.dispose();
    this.slots.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// 抛物线炮弹（落点准星预警 → 落地 / 空爆）
// ---------------------------------------------------------------------------------------------

export interface ArcShellSpec {
  flightTime: number;
  /** 弹道顶点相对两端连线的抬升（米） */
  apexHeight: number;
  burstRadius: number;
  /** 0 表示无爆炸伤害（例如布雷弹落水后由宿主生成水雷） */
  damage: number;
  profile: HeavyWeaponImpactProfile;
  /** 宿主自定义标记，随 onArrive 回传 */
  payload: number;
  /** 地表高度：落点贴近地表时额外绘制地面圈 */
  groundY: number | null;
}

export interface ArcShellPalette {
  shell: number;
  glow: number;
  streak: number;
  reticleFar: number;
  reticleNear: number;
}

export const MAGMA_SHELL_PALETTE: ArcShellPalette = {
  shell: 0xffd27a,
  glow: 0xff7a1c,
  streak: 0xff5a10,
  reticleFar: 0xffb02e,
  reticleNear: 0xff2a14,
};

interface ShellSlot {
  shell: THREE.Group;
  glow: THREE.Sprite;
  streak: THREE.Mesh;
  reticle: THREE.Sprite;
  reticleMaterial: THREE.SpriteMaterial;
  groundRing: THREE.Mesh;
  groundRingMaterial: THREE.MeshBasicMaterial;
  active: boolean;
  bursting: boolean;
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
  burstAge: number;
  spec: ArcShellSpec;
}

const SHELL_BURST_WINDOW = 0.28;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

export class ArcShellPool {
  /** 抵达落点（空爆或落地）时回调；position 为复用向量，需要保存请 clone */
  public onArrive?: (position: THREE.Vector3, payload: number, spec: ArcShellSpec) => void;

  private readonly root: THREE.Group;
  private readonly slots: ShellSlot[] = [];
  private readonly shellGeometry: THREE.SphereGeometry;
  private readonly streakGeometry: THREE.CylinderGeometry;
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly shellMaterial: THREE.MeshBasicMaterial;
  private readonly streakMaterial: THREE.MeshBasicMaterial;
  private readonly glowMaterials: THREE.SpriteMaterial[] = [];
  private readonly palette: ArcShellPalette;
  private readonly tempA = new THREE.Vector3();
  private readonly tempB = new THREE.Vector3();
  private readonly reticleColor = new THREE.Color();
  private readonly farColor: THREE.Color;
  private readonly nearColor: THREE.Color;

  constructor(
    parent: THREE.Object3D,
    capacity: number,
    name: string,
    shellSize: number,
    palette: ArcShellPalette
  ) {
    this.palette = palette;
    this.farColor = new THREE.Color(palette.reticleFar);
    this.nearColor = new THREE.Color(palette.reticleNear);
    this.root = new THREE.Group();
    this.root.name = name;
    parent.add(this.root);

    this.shellGeometry = new THREE.SphereGeometry(shellSize, 10, 8);
    this.streakGeometry = new THREE.CylinderGeometry(
      shellSize * 0.15,
      shellSize * 0.75,
      1,
      8,
      1,
      true
    );
    this.streakGeometry.translate(0, -0.5, 0);
    applyVerticalGradient(this.streakGeometry, 0x000000, 0xffffff, 1.2);
    this.ringGeometry = new THREE.RingGeometry(0.86, 1, 48, 1);
    this.ringGeometry.rotateX(-Math.PI / 2);
    this.shellMaterial = new THREE.MeshBasicMaterial({ color: palette.shell });
    this.streakMaterial = createGlowMaterial(palette.streak, 0.85, {
      side: THREE.DoubleSide,
      vertexColors: true,
    });

    for (let i = 0; i < capacity; i++) {
      const shell = new THREE.Group();
      shell.name = `${name}_shell_${i}`;
      shell.visible = false;
      const core = new THREE.Mesh(this.shellGeometry, this.shellMaterial);
      const glow = createGlowSprite(palette.glow, shellSize * 9, 0.95);
      this.glowMaterials.push(glow.material);
      const streak = new THREE.Mesh(this.streakGeometry, this.streakMaterial);
      streak.scale.set(1, shellSize * 14, 1);
      streak.renderOrder = 0;
      shell.add(core, glow, streak);

      const reticle = createGlowSprite(palette.reticleFar, 1, 0, 'ring', false);
      reticle.visible = false;
      const groundRingMaterial = createGlowMaterial(palette.reticleNear, 0, {
        side: THREE.DoubleSide,
        fog: false,
      });
      const groundRing = new THREE.Mesh(this.ringGeometry, groundRingMaterial);
      groundRing.visible = false;
      groundRing.renderOrder = 0;
      groundRing.frustumCulled = false;
      this.root.add(shell, reticle, groundRing);
      this.slots.push({
        shell,
        glow,
        streak,
        reticle,
        reticleMaterial: reticle.material,
        groundRing,
        groundRingMaterial,
        active: false,
        bursting: false,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        age: 0,
        burstAge: 0,
        spec: {
          flightTime: 1,
          apexHeight: 0,
          burstRadius: 1,
          damage: 0,
          profile: 'flak-hit',
          payload: 0,
          groundY: null,
        },
      });
    }
  }

  public launch(from: THREE.Vector3, to: THREE.Vector3, spec: ArcShellSpec): boolean {
    if (!isFiniteVector(from) || !isFiniteVector(to)) return false;
    const slot = this.slots.find((entry) => !entry.active);
    if (!slot) return false;
    slot.active = true;
    slot.bursting = false;
    slot.from.copy(from);
    slot.to.copy(to);
    slot.age = 0;
    slot.burstAge = 0;
    slot.spec.flightTime = Math.max(0.2, spec.flightTime);
    slot.spec.apexHeight = Math.max(0, spec.apexHeight);
    slot.spec.burstRadius = Math.max(1, spec.burstRadius);
    slot.spec.damage = Math.max(0, spec.damage);
    slot.spec.profile = spec.profile;
    slot.spec.payload = spec.payload;
    slot.spec.groundY = spec.groundY;
    slot.shell.visible = true;
    slot.shell.position.copy(from);
    slot.reticle.visible = true;
    slot.reticle.position.copy(to);
    const nearGround = spec.groundY !== null && to.y - spec.groundY < 30;
    slot.groundRing.visible = nearGround;
    if (nearGround && spec.groundY !== null) {
      slot.groundRing.position.set(to.x, spec.groundY + 0.7, to.z);
      slot.groundRing.scale.set(slot.spec.burstRadius, 1, slot.spec.burstRadius);
    }
    this.updateTelegraph(slot, 0);
    return true;
  }

  public update(deltaTime: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;

      if (slot.bursting) {
        slot.burstAge += deltaTime;
        if (slot.burstAge >= SHELL_BURST_WINDOW) {
          slot.active = false;
          slot.bursting = false;
        }
        continue;
      }

      slot.age += deltaTime;
      const s = Math.min(1, slot.age / slot.spec.flightTime);
      this.sample(slot, s, slot.shell.position);
      // 弹体朝向：沿切线方向拉出尾焰
      this.tangent(slot, s, this.tempA);
      if (this.tempA.lengthSq() > 1e-6) {
        this.tempA.normalize();
        slot.streak.quaternion.setFromUnitVectors(UP_AXIS, this.tempA);
      }
      this.updateTelegraph(slot, s);

      if (s >= 1) {
        slot.shell.visible = false;
        slot.reticle.visible = false;
        slot.groundRing.visible = false;
        slot.bursting = slot.spec.damage > 0;
        if (!slot.bursting) slot.active = false;
        this.onArrive?.(slot.to, slot.spec.payload, slot.spec);
      }
    }
  }

  private updateTelegraph(slot: ShellSlot, s: number): void {
    const diameter = slot.spec.burstRadius * 2 * (2.3 - 1.3 * s);
    slot.reticle.scale.set(diameter, diameter, 1);
    this.reticleColor.copy(this.farColor).lerp(this.nearColor, s);
    slot.reticleMaterial.color.copy(this.reticleColor);
    const blink = 0.75 + 0.25 * Math.sin(slot.age * (10 + 30 * s));
    slot.reticleMaterial.opacity = (0.35 + 0.6 * s) * blink;
    slot.reticleMaterial.rotation = slot.age * 1.6;
    slot.groundRingMaterial.opacity = (0.25 + 0.6 * s) * blink;
  }

  private sample(slot: ShellSlot, s: number, out: THREE.Vector3): void {
    out.copy(slot.from).lerp(slot.to, s);
    out.y += slot.spec.apexHeight * 4 * s * (1 - s);
  }

  private tangent(slot: ShellSlot, s: number, out: THREE.Vector3): void {
    out.subVectors(slot.to, slot.from);
    out.y += slot.spec.apexHeight * 4 * (1 - 2 * s);
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (!slot.active || !slot.bursting || slot.spec.damage <= 0) continue;
      const reach = slot.spec.burstRadius + targetRadius;
      if (this.tempB.subVectors(target, slot.to).lengthSq() > reach * reach) continue;
      if (slot.spec.damage > out.damage) {
        out.damage = slot.spec.damage;
        out.profile = slot.spec.profile;
        out.position.copy(slot.to);
      }
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  /** 飞行中的炮弹数（不含爆炸窗口） */
  public getInFlightCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active && !slot.bursting) count++;
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) {
      slot.active = false;
      slot.bursting = false;
      slot.shell.visible = false;
      slot.reticle.visible = false;
      slot.groundRing.visible = false;
    }
  }

  public getPalette(): ArcShellPalette {
    return this.palette;
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.reticleMaterial.dispose();
      slot.groundRingMaterial.dispose();
    }
    for (const material of this.glowMaterials) material.dispose();
    this.shellGeometry.dispose();
    this.streakGeometry.dispose();
    this.ringGeometry.dispose();
    this.shellMaterial.dispose();
    this.streakMaterial.dispose();
    this.slots.length = 0;
  }
}

/**
 * BossMissileSystem 直接调用 createBossMissileTrail / createBossMissileExplosion / createHit；
 * 粒子系统缺失或是不完整的测试替身时，给它一个空实现，保证导弹逻辑照常运行。
 */
export function resolveMissileParticles(
  particles: ParticleSystem | null | undefined
): ParticleSystem {
  const candidate = particles as unknown as Record<string, unknown> | null | undefined;
  if (
    particles &&
    candidate &&
    typeof candidate.createBossMissileTrail === 'function' &&
    typeof candidate.createBossMissileExplosion === 'function' &&
    typeof candidate.createHit === 'function'
  ) {
    return particles;
  }
  const noop = (): void => undefined;
  return {
    createBossMissileTrail: noop,
    createBossMissileExplosion: noop,
    createHit: noop,
  } as unknown as ParticleSystem;
}
