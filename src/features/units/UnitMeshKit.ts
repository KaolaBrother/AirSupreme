import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 单位建模工具箱
 *
 * - 共享材质调色板：敌方深色舰体 + 红色识别带；友军蓝白 + 圆形徽标；平民白色 + 彩色涂装与航行灯。
 * - NodeBuilder：按材质累积零件几何，最终合并为“每材质一个网格”，把一个单位的绘制调用压到个位数。
 * - 模板（UnitTemplate）只构建一次；createUnitMesh 每次只实例化 Group / Mesh 并引用共享几何与材质，
 *   所有共享资源都标记 userData.sharedResource = true，单位销毁时跳过释放。
 *
 * 朝向约定：单位前方为 +Z（与 Object3D.lookAt 一致），上方 +Y，右侧 -X。
 */

export type PaletteKey =
  // 敌方
  | 'hHull'
  | 'hDark'
  | 'hOlive'
  | 'hSand'
  | 'hRed'
  | 'hGlow'
  // 友军
  | 'fWhite'
  | 'fBlue'
  | 'fGrey'
  | 'fGold'
  | 'fGlow'
  | 'fNavy'
  // 平民
  | 'cWhite'
  | 'cTeal'
  | 'cOrange'
  | 'cHullRed'
  | 'cHullBlack'
  | 'cBlueBox'
  | 'cRedBox'
  | 'cYellowBox'
  | 'cGreenBox'
  | 'cCab'
  // 通用
  | 'glass'
  | 'metal'
  | 'rubber'
  | 'deck'
  | 'navRed'
  | 'navGreen'
  | 'navWhite'
  | 'engineGlow'
  | 'beacon'
  | 'foam'
  | 'rotorBlur';

interface StandardSpec {
  kind: 'standard';
  color: number;
  roughness: number;
  metalness: number;
  emissive?: number;
  emissiveIntensity?: number;
}

interface BasicSpec {
  kind: 'basic';
  color: number;
  transparent?: boolean;
  opacity?: number;
}

const PALETTE: Record<PaletteKey, StandardSpec | BasicSpec> = {
  hHull: { kind: 'standard', color: 0x3b4048, roughness: 0.62, metalness: 0.32 },
  hDark: { kind: 'standard', color: 0x1e2228, roughness: 0.7, metalness: 0.3 },
  hOlive: { kind: 'standard', color: 0x4b4e3d, roughness: 0.78, metalness: 0.18 },
  hSand: { kind: 'standard', color: 0x6b6250, roughness: 0.8, metalness: 0.15 },
  hRed: {
    kind: 'standard',
    color: 0xc4252d,
    roughness: 0.48,
    metalness: 0.2,
    emissive: 0x5a0508,
    emissiveIntensity: 0.7,
  },
  hGlow: { kind: 'basic', color: 0xff3b2b },
  fWhite: { kind: 'standard', color: 0xe3e8ee, roughness: 0.5, metalness: 0.22 },
  fBlue: { kind: 'standard', color: 0x2b64cc, roughness: 0.45, metalness: 0.28 },
  fGrey: { kind: 'standard', color: 0x8e9aa8, roughness: 0.55, metalness: 0.28 },
  fGold: {
    kind: 'standard',
    color: 0xe8b23a,
    roughness: 0.4,
    metalness: 0.45,
    emissive: 0x3a2600,
    emissiveIntensity: 0.5,
  },
  fGlow: { kind: 'basic', color: 0x86dcff },
  fNavy: { kind: 'standard', color: 0x1d3462, roughness: 0.55, metalness: 0.25 },
  cWhite: { kind: 'standard', color: 0xf4f4ef, roughness: 0.45, metalness: 0.18 },
  cTeal: { kind: 'standard', color: 0x16a0a0, roughness: 0.45, metalness: 0.2 },
  cOrange: { kind: 'standard', color: 0xf2892a, roughness: 0.45, metalness: 0.2 },
  cHullRed: { kind: 'standard', color: 0x9c3326, roughness: 0.6, metalness: 0.2 },
  cHullBlack: { kind: 'standard', color: 0x23272d, roughness: 0.6, metalness: 0.25 },
  cBlueBox: { kind: 'standard', color: 0x2f6db5, roughness: 0.7, metalness: 0.2 },
  cRedBox: { kind: 'standard', color: 0xc4452f, roughness: 0.7, metalness: 0.2 },
  cYellowBox: { kind: 'standard', color: 0xdba92c, roughness: 0.7, metalness: 0.2 },
  cGreenBox: { kind: 'standard', color: 0x3f8a4b, roughness: 0.7, metalness: 0.2 },
  cCab: { kind: 'standard', color: 0x2f86c9, roughness: 0.42, metalness: 0.3 },
  glass: { kind: 'standard', color: 0x1a2a3a, roughness: 0.12, metalness: 0.65 },
  metal: { kind: 'standard', color: 0x70767e, roughness: 0.42, metalness: 0.6 },
  rubber: { kind: 'standard', color: 0x18191b, roughness: 0.92, metalness: 0.05 },
  deck: { kind: 'standard', color: 0x585d63, roughness: 0.85, metalness: 0.12 },
  navRed: { kind: 'basic', color: 0xff2a2a },
  navGreen: { kind: 'basic', color: 0x2aff6e },
  navWhite: { kind: 'basic', color: 0xffffff },
  engineGlow: { kind: 'basic', color: 0xffa64a },
  beacon: { kind: 'basic', color: 0xff3020, transparent: true, opacity: 1 },
  foam: { kind: 'basic', color: 0xf2fbff, transparent: true, opacity: 0.55 },
  rotorBlur: { kind: 'basic', color: 0x1c1e22, transparent: true, opacity: 0.28 },
};

const materialCache = new Map<PaletteKey, THREE.Material>();

function markShared<T extends { userData: Record<string, unknown> }>(resource: T): T {
  resource.userData.sharedResource = true;
  return resource;
}

/** 取共享材质（按需创建，全局复用） */
export function getUnitMaterial(key: PaletteKey): THREE.Material {
  const cached = materialCache.get(key);
  if (cached) return cached;
  const spec = PALETTE[key];
  let material: THREE.Material;
  if (spec.kind === 'standard') {
    material = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 0,
    });
  } else {
    const basic = new THREE.MeshBasicMaterial({ color: spec.color });
    if (spec.transparent) {
      basic.transparent = true;
      basic.opacity = spec.opacity ?? 1;
      basic.depthTest = true;
      basic.depthWrite = false;
    }
    material = basic;
  }
  material.name = `unit-${key}`;
  markShared(material);
  materialCache.set(key, material);
  return material;
}

let flashMaterial: THREE.MeshBasicMaterial | null = null;
let charredMaterial: THREE.MeshStandardMaterial | null = null;

/** 受击闪白材质（共享） */
export function getUnitFlashMaterial(): THREE.Material {
  if (!flashMaterial) {
    flashMaterial = markShared(new THREE.MeshBasicMaterial({ color: 0xffe2c8 }));
    flashMaterial.name = 'unit-hit-flash';
  }
  return flashMaterial;
}

/** 残骸焦黑材质（共享） */
export function getUnitCharredMaterial(): THREE.Material {
  if (!charredMaterial) {
    charredMaterial = markShared(
      new THREE.MeshStandardMaterial({
        color: 0x17181a,
        roughness: 1,
        metalness: 0.05,
        emissive: 0x2a0d02,
        emissiveIntensity: 0.35,
      })
    );
    charredMaterial.name = 'unit-charred';
  }
  return charredMaterial;
}

/** 全局闪烁信标：所有单位共享一个材质，每帧只改一次透明度 */
export function setUnitBeaconPhase(time: number): void {
  const beacon = materialCache.get('beacon');
  if (!beacon) return;
  const phase = time % 1.2;
  (beacon as THREE.MeshBasicMaterial).opacity = phase < 0.12 ? 1 : 0.08;
}

// ───────────────────────────── 几何工具 ─────────────────────────────

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** 竖直圆柱（沿 Y 轴） */
export function cyl(rTop: number, rBottom: number, h: number, seg = 12): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg);
}

/** 沿 Z 轴的圆柱（炮管、导弹、发动机舱） */
export function cylZ(
  rFront: number,
  rBack: number,
  length: number,
  seg = 10
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rFront, rBack, length, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 沿 X 轴的圆柱（车轴、横梁） */
export function cylX(r: number, length: number, seg = 10): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, length, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function sphere(r: number, wSeg = 12, hSeg = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, wSeg, hSeg);
}

/** 沿 +Z 指向的圆锥（机头、弹头） */
export function coneZ(r: number, length: number, seg = 10): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, length, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 圆盘徽标（法线朝 +Y，厚度极薄） */
export function disc(r: number, seg = 18): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r, r, 0.06, seg);
}

export function torus(r: number, tube: number, seg = 18): THREE.BufferGeometry {
  return new THREE.TorusGeometry(r, tube, 6, seg);
}

/**
 * 沿 Z 轴的旋成体机身。profile 为 [z, radius] 序列（从尾到头，z 递增）。
 */
export function fuselage(profile: ReadonlyArray<[number, number]>, seg = 14): THREE.BufferGeometry {
  const points = profile.map(([z, r]) => new THREE.Vector2(Math.max(0.001, r), z));
  const g = new THREE.LatheGeometry(points, seg);
  // Lathe 绕 Y 轴旋转，profile 的 z 在 Y 上 → 转到 Z 轴
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * 翼面（左右对称一体）：span 为单侧展长，rootChord/tipChord 弦长，sweep 为翼尖前缘后移量，
 * thickness 厚度，dihedral 上反角（弧度）。翼根前缘位于 z = 0，向 -Z 方向延伸弦长。
 */
export function wing(
  span: number,
  rootChord: number,
  tipChord: number,
  sweep: number,
  thickness: number,
  dihedral = 0
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Shape 在 XY 平面绘制：x = 展向，y = 弦向（之后 y → -z）
  shape.moveTo(-span, -sweep);
  shape.lineTo(0, 0);
  shape.lineTo(span, -sweep);
  shape.lineTo(span, -sweep - tipChord);
  shape.lineTo(0, -rootChord);
  shape.lineTo(-span, -sweep - tipChord);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // 挤出方向 Z → 竖直；绘制平面 XY → 水平 XZ（y → -z）
  g.translate(0, 0, -thickness / 2);
  g.rotateX(Math.PI / 2);
  if (dihedral !== 0) {
    const pos = g.getAttribute('position');
    const k = Math.tan(dihedral);
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) + Math.abs(pos.getX(i)) * k);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** 垂直尾翼：高 height、根弦 rootChord、尖弦 tipChord、后掠 sweep（前缘在 z = 0） */
export function fin(
  height: number,
  rootChord: number,
  tipChord: number,
  sweep: number,
  thickness: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-sweep, height);
  shape.lineTo(-sweep - tipChord, height);
  shape.lineTo(-rootChord, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  // 绘制平面 XY：x = 弦向（→ z），y = 高度；挤出 Z → 厚度（→ x）
  g.rotateY(-Math.PI / 2);
  return g;
}

export interface HullOptions {
  length: number;
  beam: number;
  /** 甲板到龙骨的深度 */
  depth: number;
  /** 船首收窄起点（0 = 船尾，1 = 船首） */
  bowStart?: number;
  /** 船尾宽度比例 */
  sternWidth?: number;
  /** 龙骨宽度比例 */
  keel?: number;
  /** 船首甲板上翘高度 */
  sheer?: number;
  stations?: number;
}

/**
 * 程序化船体：沿 Z 轴（船尾 -Z → 船首 +Z）放样 U 形截面，船首尖削并上翘。
 * 三角面朝向自动校正为向外，避免手写索引绕序出错。
 */
export function hull(options: HullOptions): THREE.BufferGeometry {
  const {
    length: L,
    beam: B,
    depth: D,
    bowStart = 0.62,
    sternWidth = 0.84,
    keel = 0.32,
    sheer = D * 0.3,
    stations = 16,
  } = options;
  const positions: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ref = new THREE.Vector3();

  const widthAt = (t: number): number => {
    if (t <= bowStart) {
      const s = Math.min(1, t / 0.22);
      return sternWidth + (1 - sternWidth) * (1 - (1 - s) * (1 - s));
    }
    const u = (t - bowStart) / (1 - bowStart);
    return Math.max(0.015, 1 - Math.pow(u, 1.75));
  };
  const deckAt = (t: number): number => sheer * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2);
  const keelAt = (t: number): number => {
    if (t < 0.84) return -D;
    const u = (t - 0.84) / 0.16;
    return -D * (1 - 0.7 * u);
  };

  const sections: THREE.Vector3[][] = [];
  for (let i = 0; i < stations; i++) {
    const t = i / (stations - 1);
    const z = -L / 2 + t * L;
    const hw = (B / 2) * widthAt(t);
    const top = deckAt(t);
    const bottom = keelAt(t);
    const mid = top - 0.58 * (top - bottom);
    sections.push([
      new THREE.Vector3(-hw, top, z),
      new THREE.Vector3(-hw * 0.93, mid, z),
      new THREE.Vector3(-hw * keel, bottom, z),
      new THREE.Vector3(hw * keel, bottom, z),
      new THREE.Vector3(hw * 0.93, mid, z),
      new THREE.Vector3(hw, top, z),
    ]);
  }

  const pushTri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): void => {
    a.copy(p);
    b.copy(q);
    c.copy(r);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    if (n.lengthSq() < 1e-10) return;
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    // 参考向量：质心 - 船体中线内点（x=0，y=半深，z 钳制在船身内部）
    ref.set(cx, cy + D * 0.45, cz - THREE.MathUtils.clamp(cz, -L * 0.42, L * 0.42));
    if (n.dot(ref) < 0) {
      positions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    } else {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  };

  for (let i = 0; i < stations - 1; i++) {
    const s0 = sections[i];
    const s1 = sections[i + 1];
    for (let k = 0; k < s0.length - 1; k++) {
      pushTri(s0[k], s0[k + 1], s1[k + 1]);
      pushTri(s0[k], s1[k + 1], s1[k]);
    }
    // 甲板
    pushTri(s0[0], s0[5], s1[5]);
    pushTri(s0[0], s1[5], s1[0]);
  }
  // 船尾封板（扇形）
  const stern = sections[0];
  for (let k = 1; k < stern.length - 1; k++) {
    pushTri(stern[0], stern[k], stern[k + 1]);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

// ───────────────────────────── 模板构建 ─────────────────────────────

type Vec3Tuple = readonly [number, number, number];

interface PendingPart {
  key: PaletteKey;
  geometry: THREE.BufferGeometry;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/**
 * 节点构建器：add() 把零件按材质累积；child() 创建可动子节点（炮塔、旋翼、雷达盘…）。
 * 子节点名称会映射到实例 mesh.userData[name]。
 */
export class NodeBuilder {
  readonly name: string;
  readonly position = new THREE.Vector3();
  readonly quaternion = new THREE.Quaternion();
  readonly parts: PendingPart[] = [];
  readonly children: NodeBuilder[] = [];
  /** 同名多实例节点收集为数组（例如多个螺旋桨、多个挂架） */
  readonly collect: boolean;

  constructor(name: string, collect = false) {
    this.name = name;
    this.collect = collect;
  }

  add(
    key: PaletteKey,
    geometry: THREE.BufferGeometry,
    position: Vec3Tuple = [0, 0, 0],
    rotation: Vec3Tuple = [0, 0, 0],
    scale: Vec3Tuple = [1, 1, 1]
  ): this {
    tmpEuler.set(rotation[0], rotation[1], rotation[2]);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(position[0], position[1], position[2]);
    tmpScale.set(scale[0], scale[1], scale[2]);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    geometry.applyMatrix4(tmpMatrix);
    if (scale[0] * scale[1] * scale[2] < 0) {
      flipWinding(geometry);
    }
    this.parts.push({ key, geometry });
    return this;
  }

  /** 左右镜像添加（x 与 -x 各一份） */
  addMirrored(
    key: PaletteKey,
    factory: () => THREE.BufferGeometry,
    position: Vec3Tuple,
    rotation: Vec3Tuple = [0, 0, 0],
    scale: Vec3Tuple = [1, 1, 1]
  ): this {
    this.add(key, factory(), position, rotation, scale);
    this.add(
      key,
      factory(),
      [-position[0], position[1], position[2]],
      [rotation[0], -rotation[1], -rotation[2]],
      scale
    );
    return this;
  }

  child(
    name: string,
    position: Vec3Tuple = [0, 0, 0],
    rotation: Vec3Tuple = [0, 0, 0],
    collect = false
  ): NodeBuilder {
    const node = new NodeBuilder(name, collect);
    node.position.set(position[0], position[1], position[2]);
    tmpEuler.set(rotation[0], rotation[1], rotation[2]);
    node.quaternion.setFromEuler(tmpEuler);
    this.children.push(node);
    return node;
  }
}

function flipWinding(geometry: THREE.BufferGeometry): void {
  if (geometry.index) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const t = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, t);
    }
    index.needsUpdate = true;
  } else {
    const pos = geometry.getAttribute('position');
    const nor = geometry.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 3) {
      for (const attr of [pos, nor]) {
        if (!attr) continue;
        const x = attr.getX(i + 1);
        const y = attr.getY(i + 1);
        const z = attr.getZ(i + 1);
        attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
        attr.setXYZ(i + 2, x, y, z);
      }
    }
    pos.needsUpdate = true;
  }
  geometry.computeVertexNormals();
}

export interface TemplateMesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  key: PaletteKey;
}

export interface UnitTemplateNode {
  name: string;
  collect: boolean;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  meshes: TemplateMesh[];
  children: UnitTemplateNode[];
}

function normalizeForMerge(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  g.clearGroups();
  return g;
}

/** 把构建器树烘焙为模板：每个节点内按材质合并几何 */
export function bakeTemplate(builder: NodeBuilder): UnitTemplateNode {
  const groups = new Map<PaletteKey, THREE.BufferGeometry[]>();
  for (const part of builder.parts) {
    const list = groups.get(part.key) ?? [];
    list.push(normalizeForMerge(part.geometry));
    groups.set(part.key, list);
  }
  const meshes: TemplateMesh[] = [];
  for (const [key, list] of groups) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) continue;
    if (list.length > 1) {
      for (const g of list) g.dispose();
    }
    merged.computeBoundingSphere();
    markShared(merged);
    meshes.push({ geometry: merged, material: getUnitMaterial(key), key });
  }
  return {
    name: builder.name,
    collect: builder.collect,
    position: builder.position.clone(),
    quaternion: builder.quaternion.clone(),
    meshes,
    children: builder.children.map((child) => bakeTemplate(child)),
  };
}

const TRANSPARENT_KEYS: ReadonlySet<PaletteKey> = new Set<PaletteKey>([
  'foam',
  'rotorBlur',
  'beacon',
]);

/** 实例化模板：只创建 Group / Mesh，几何与材质全部共享 */
export function instantiateTemplate(template: UnitTemplateNode, root?: THREE.Group): THREE.Group {
  const group = new THREE.Group();
  group.name = template.name;
  group.position.copy(template.position);
  group.quaternion.copy(template.quaternion);
  const owner = root ?? group;
  for (const entry of template.meshes) {
    const mesh = new THREE.Mesh(entry.geometry, entry.material);
    mesh.name = `${template.name}:${entry.key}`;
    mesh.userData.sharedResource = true;
    mesh.userData.paletteKey = entry.key;
    if (TRANSPARENT_KEYS.has(entry.key)) {
      mesh.renderOrder = 0;
      mesh.userData.noFlash = true;
    }
    group.add(mesh);
  }
  for (const child of template.children) {
    const childGroup = instantiateTemplate(child, owner);
    group.add(childGroup);
    if (child.collect) {
      const list = (owner.userData[child.name] as THREE.Object3D[] | undefined) ?? [];
      list.push(childGroup);
      owner.userData[child.name] = list;
    } else {
      owner.userData[child.name] = childGroup;
    }
  }
  return group;
}

/** 释放模板几何（应用退出时调用；单位实例从不释放共享资源） */
export function disposeTemplate(template: UnitTemplateNode): void {
  for (const entry of template.meshes) entry.geometry.dispose();
  for (const child of template.children) disposeTemplate(child);
}

/** 释放共享材质缓存 */
export function disposeUnitMaterials(): void {
  for (const material of materialCache.values()) material.dispose();
  materialCache.clear();
  flashMaterial?.dispose();
  flashMaterial = null;
  charredMaterial?.dispose();
  charredMaterial = null;
}

// ───────────────────────────── 阵营标识 ─────────────────────────────

/** 姿态：徽标法线方向 */
export type EmblemFacing = 'up' | 'port' | 'starboard' | 'forward' | 'back';

function emblemRotation(facing: EmblemFacing): Vec3Tuple {
  switch (facing) {
    case 'port':
      return [0, 0, -Math.PI / 2];
    case 'starboard':
      return [0, 0, Math.PI / 2];
    case 'forward':
      return [Math.PI / 2, 0, 0];
    case 'back':
      return [-Math.PI / 2, 0, 0];
    default:
      return [0, 0, 0];
  }
}

function emblemOffset(facing: EmblemFacing, distance: number): Vec3Tuple {
  switch (facing) {
    case 'port':
      return [distance, 0, 0];
    case 'starboard':
      return [-distance, 0, 0];
    case 'forward':
      return [0, 0, distance];
    case 'back':
      return [0, 0, -distance];
    default:
      return [0, distance, 0];
  }
}

function stackEmblem(
  node: NodeBuilder,
  layers: ReadonlyArray<{ key: PaletteKey; radius: number; seg: number }>,
  position: Vec3Tuple,
  facing: EmblemFacing
): void {
  const rotation = emblemRotation(facing);
  layers.forEach((layer, index) => {
    const offset = emblemOffset(facing, 0.035 * (index + 1));
    node.add(
      layer.key,
      disc(layer.radius, layer.seg),
      [position[0] + offset[0], position[1] + offset[1], position[2] + offset[2]],
      rotation
    );
  });
}

/** 友军圆形徽标：蓝 / 白 / 金 */
export function addRoundel(
  node: NodeBuilder,
  position: Vec3Tuple,
  radius: number,
  facing: EmblemFacing = 'up'
): void {
  stackEmblem(
    node,
    [
      { key: 'fBlue', radius, seg: 20 },
      { key: 'fWhite', radius: radius * 0.66, seg: 20 },
      { key: 'fGold', radius: radius * 0.3, seg: 16 },
    ],
    position,
    facing
  );
}

/** 敌方识别标：红色六边形外框 + 黑色内核 + 红色瞳孔（神谕之眼） */
export function addHostileMark(
  node: NodeBuilder,
  position: Vec3Tuple,
  radius: number,
  facing: EmblemFacing = 'up'
): void {
  stackEmblem(
    node,
    [
      { key: 'hRed', radius, seg: 6 },
      { key: 'hDark', radius: radius * 0.68, seg: 6 },
      { key: 'hRed', radius: radius * 0.28, seg: 12 },
    ],
    position,
    facing
  );
}
