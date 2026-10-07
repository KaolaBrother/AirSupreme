import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BossConfig } from './BossTypes';
import { createGlowMaterial, createGlowSprite } from './MagmaColossusHazards';
import { createOracleShieldMaterial, type OracleShieldMaterial } from './OraclePrimeShaders';

/**
 * 第十关 Boss「神谕主宰」模型：敌方战争智能的“心脏”——悬浮在黑曜城堡上空的几何能量体。
 *
 * 结构（尺寸以设计单位书写，乘以 config.scale（默认 6）得到米；根节点不旋转，世界轴对齐）：
 * - body（随悬浮起伏、缓慢转向玩家）：
 *   - seed（朝向玩家）：白热核心 + 金色虹膜与黑色瞳孔（“神谕之瞳”）+ 11 片十二面体装甲花瓣
 *     （正面一片缺口让瞳孔向外凝视；InstancedMesh：花瓣 1 次绘制 + 电路描边 1 次绘制）。
 *   - latticePivot：核心外的二十面体光栅（支柱 + 节点合并为 1 个网格）。
 *   - halo：赤道光环 + 4 个棱镜发射器（第二阶段的旋转光阵）。
 *   - gyro：两道金色浑天仪环（不同轴进动）。
 *   - crown / root：上下悬浮的黑曜冠与根刺（各自缓慢反向旋转），中轴光脊贯穿。
 * - shield：护盾球（自定义着色器），4 个护盾塔通过能量系索为其供能。
 * - pylons：4 座水晶护盾塔，绕核心公转（各自有独立配色对应攻击方式）。
 *
 * 碰撞部件：核心 / 塔晶体 / 发射器为真实网格；护盾、花瓣与光环装甲用不可见的 Object3D 代理
 * （visible 为 true，便于现有碰撞检测），全部声明 userData.hitRadius（米）。
 */

export type OraclePylonRole = 'prism' | 'arc' | 'seeker' | 'lance';

export const ORACLE_PYLON_ROLES: readonly OraclePylonRole[] = ['prism', 'arc', 'seeker', 'lance'];

/** 护盾塔配色：一眼区分攻击方式（棱镜金 / 电弧蓝 / 追猎紫 / 光矛白青） */
export const ORACLE_PYLON_COLORS: Readonly<Record<OraclePylonRole, number>> = {
  prism: 0xffbf47,
  arc: 0x5fa8ff,
  seeker: 0xb46cff,
  lance: 0xa8fff6,
};

export const ORACLE_PALETTE = {
  core: 0xc4fbff,
  cyan: 0x48e6ff,
  gold: 0xffbe55,
  shield: 0x5fe6ff,
  shieldHot: 0xe8ffff,
  breach: 0xff9a3a,
  overload: 0xc04dff,
  overloadHot: 0xffa8f4,
} as const;

export interface OraclePylonRig {
  index: number;
  role: OraclePylonRole;
  color: THREE.Color;
  /** 根节点局部坐标中的公转位置 */
  group: THREE.Group;
  /** 晶体 + 卡箍（自转） */
  spinner: THREE.Group;
  crystal: THREE.Mesh;
  crystalMaterial: THREE.MeshStandardMaterial;
  collar: THREE.Mesh;
  rings: THREE.Mesh;
  ringMaterial: THREE.MeshStandardMaterial;
  /** 晶体顶端（攻击发射点 / 系索起点） */
  tip: THREE.Object3D;
  tipGlow: THREE.Sprite;
  /** 系索：根节点局部坐标，从塔顶指向护盾 */
  tether: THREE.Mesh;
  tetherMaterial: THREE.MeshBasicMaterial;
  /** 沿系索流向护盾的能量包 */
  packet: THREE.Sprite;
  baseAngle: number;
  /** 设计高度（米，相对根节点） */
  orbitHeight: number;
}

export interface OracleEmitterRig {
  index: number;
  /** 光环上的安装点（随光环旋转） */
  pivot: THREE.Group;
  lens: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  /** 光束起点（棱镜外端） */
  muzzle: THREE.Object3D;
  angle: number;
}

export interface OraclePetalFrame {
  /** seed 局部坐标中的面法线 */
  normal: THREE.Vector3;
  /** 规范花瓣（法线 +Z、首顶点 +Y）→ 该面朝向 */
  basis: THREE.Quaternion;
  /** 0..1 伪随机种子（碎片轨道等） */
  seed: number;
}

export interface OraclePrimeMaterials {
  obsidian: THREE.MeshStandardMaterial;
  circuit: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  lattice: THREE.MeshStandardMaterial;
  iris: THREE.MeshStandardMaterial;
  pupil: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  port: THREE.MeshStandardMaterial;
  spine: THREE.MeshBasicMaterial;
}

export interface OraclePrimeRig {
  scale: number;
  body: THREE.Group;
  seed: THREE.Group;
  core: THREE.Mesh;
  coreRadius: number;
  coreGlow: THREE.Sprite;
  /** 大型闪光（阶段切换 / 死亡），平时隐藏 */
  coreFlare: THREE.Sprite;
  iris: THREE.Group;
  irisRing: THREE.Mesh;
  pupil: THREE.Mesh;
  pupilGlow: THREE.Sprite;
  irisMuzzle: THREE.Object3D;
  latticePivot: THREE.Group;
  lattice: THREE.Mesh;
  petals: THREE.InstancedMesh;
  petalTrims: THREE.InstancedMesh;
  petalFrames: OraclePetalFrame[];
  /** 闭合时花瓣外表面所在的内切球半径（米） */
  petalInradius: number;
  halo: THREE.Group;
  haloRing: THREE.Mesh;
  haloBand: THREE.Mesh;
  haloRadius: number;
  emitters: OracleEmitterRig[];
  gyroPivots: THREE.Group[];
  gyroRings: THREE.Mesh[];
  crown: THREE.Group;
  root: THREE.Group;
  spine: THREE.Mesh;
  missilePorts: THREE.Object3D[];
  shield: THREE.Mesh;
  shieldMaterial: OracleShieldMaterial;
  shieldRadius: number;
  shieldProxy: THREE.Object3D;
  petalProxies: THREE.Object3D[];
  haloProxies: THREE.Object3D[];
  pylons: OraclePylonRig[];
  pylonOrbitRadius: number;
  materials: OraclePrimeMaterials;
}

export type OraclePrimeGroup = THREE.Group & {
  oracleRig?: OraclePrimeRig;
  bossParts?: THREE.Object3D[];
};

// ===== 设计尺寸（乘以 scale 得到米）=====
const CORE_RADIUS = 2.0;
const LATTICE_RADIUS = 2.75;
const PETAL_INRADIUS = 3.55;
const HALO_RADIUS = 7.6;
/** 光环低于核心中心，平视时近侧不会横穿瞳孔 */
const HALO_Y = -2.4;
const GYRO_RADII: readonly number[] = [8.7, 9.7];
const SHIELD_RADIUS = 12;
const PYLON_ORBIT_RADIUS = 21;
const PYLON_ORBIT_HEIGHTS: readonly number[] = [2.6, -2.6, 2.6, -2.6];
const CROWN_Y = 6.4;
const ROOT_Y = -6.4;
/** 十二面体：面中心距 / 面外接圆半径 = 1.1135 / 0.8507 */
const DODECA_FACE_RATIO = 0.8507 / 1.1135;

const UP = new THREE.Vector3(0, 1, 0);

/** mergeGeometries 要求属性一致：统一为非索引 + position/normal/uv */
function prepare(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  if (prepared !== geometry) geometry.dispose();
  for (const name of Object.keys(prepared.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') prepared.deleteAttribute(name);
  }
  if (!prepared.getAttribute('normal')) prepared.computeVertexNormals();
  return prepared;
}

function placed(
  geometry: THREE.BufferGeometry,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
): THREE.BufferGeometry {
  const prepared = prepare(geometry);
  prepared.applyMatrix4(new THREE.Matrix4().compose(position, quaternion, scale));
  return prepared;
}

function merged(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const result = mergeGeometries(geometries, false) ?? new THREE.BufferGeometry();
  for (const geometry of geometries) geometry.dispose();
  return result;
}

/** 两点之间的细柱（用于光栅支柱 / 刃脊） */
function strut(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  sides: number = 5
): THREE.BufferGeometry {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = Math.max(1e-4, direction.length());
  const geometry = new THREE.CylinderGeometry(radius, radius, length, sides, 1, true);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize());
  const middle = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  return placed(geometry, middle, quaternion);
}

function regularPentagon(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI / 2 + (k * Math.PI * 2) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (k === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function pentagonPath(radius: number): THREE.Path {
  const path = new THREE.Path();
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI / 2 + (k * Math.PI * 2) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (k === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

/**
 * 十二面体的 12 个面（seed 局部坐标）：正面（+Z）一面作为瞳孔开口不放花瓣。
 * 规范花瓣位于 XY 平面、法线 +Z、首顶点 +Y；basis 把它转到面上并对齐真实顶点。
 */
function buildPetalFrames(): OraclePetalFrame[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const normals: THREE.Vector3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      normals.push(new THREE.Vector3(0, a, b * phi));
      normals.push(new THREE.Vector3(a, b * phi, 0));
      normals.push(new THREE.Vector3(b * phi, 0, a));
    }
  }
  const vertices: THREE.Vector3[] = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        vertices.push(new THREE.Vector3(x, y, z));
      }
  const inv = 1 / phi;
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      vertices.push(new THREE.Vector3(0, a * inv, b * phi));
      vertices.push(new THREE.Vector3(a * inv, b * phi, 0));
      vertices.push(new THREE.Vector3(b * phi, 0, a * inv));
    }
  }
  for (const n of normals) n.normalize();
  for (const v of vertices) v.normalize();
  // 让其中一个面法线对准 +Z（瞳孔开口）
  const align = new THREE.Quaternion().setFromUnitVectors(
    normals[0].clone(),
    new THREE.Vector3(0, 0, 1)
  );
  for (const n of normals) n.applyQuaternion(align);
  for (const v of vertices) v.applyQuaternion(align);

  const frames: OraclePetalFrame[] = [];
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  let seed = 11;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (const normal of normals) {
    if (normal.z > 0.99) continue;
    // 面的任一顶点（与法线点积最大）
    let best = -Infinity;
    let vertex = vertices[0];
    for (const candidate of vertices) {
      const d = candidate.dot(normal);
      if (d > best + 1e-6) {
        best = d;
        vertex = candidate;
      }
    }
    yAxis.copy(vertex).addScaledVector(normal, -vertex.dot(normal)).normalize();
    xAxis.crossVectors(yAxis, normal).normalize();
    basis.makeBasis(xAxis, yAxis, normal);
    frames.push({
      normal: normal.clone(),
      basis: new THREE.Quaternion().setFromRotationMatrix(basis),
      seed: rand(),
    });
  }
  return frames;
}

/** 花瓣几何（规范空间）：倒角五边形甲板 + 浅五棱锥（外表面在 z = 0 处，锥尖朝 +Z） */
function buildPetalGeometry(s: number, radius: number): THREE.BufferGeometry {
  const depth = 0.3 * s;
  const bevel = 0.09 * s;
  const plate = new THREE.ExtrudeGeometry(regularPentagon(radius), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  });
  plate.translate(0, 0, -(depth + bevel));
  const pyramidHeight = 0.55 * s;
  const pyramid = new THREE.ConeGeometry(radius * 0.86, pyramidHeight, 5, 1, true, Math.PI);
  pyramid.rotateX(Math.PI / 2);
  pyramid.translate(0, 0, pyramidHeight / 2 + bevel * 0.5);
  return merged([prepare(plate), prepare(pyramid)]);
}

/** 花瓣电路描边（规范空间）：五边形框 + 锥棱亮脊 + 锥尖晶点 */
function buildPetalTrimGeometry(s: number, radius: number): THREE.BufferGeometry {
  const frameShape = regularPentagon(radius * 1.04);
  frameShape.holes.push(pentagonPath(radius * 0.93));
  const frame = new THREE.ShapeGeometry(frameShape, 1);
  frame.translate(0, 0, 0.1 * s);
  const parts: THREE.BufferGeometry[] = [prepare(frame)];
  const pyramidHeight = 0.55 * s;
  const apex = new THREE.Vector3(0, 0, pyramidHeight + 0.09 * s);
  const baseRadius = radius * 0.86;
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI / 2 + (k * Math.PI * 2) / 5;
    const from = new THREE.Vector3(
      Math.cos(angle) * baseRadius,
      Math.sin(angle) * baseRadius,
      0.06 * s
    );
    const to = from.clone().lerp(apex, 0.86);
    parts.push(strut(from, to, 0.05 * s, 4));
  }
  parts.push(
    placed(
      new THREE.OctahedronGeometry(0.17 * s, 0),
      apex,
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1.6)
    )
  );
  return merged(parts);
}

/** 二十面体光栅：30 根支柱 + 12 个节点 */
function buildLatticeGeometry(radius: number, strutRadius: number): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const position = ico.getAttribute('position');
  const unique: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(position, i);
    if (!unique.some((u) => u.distanceToSquared(v) < 1e-6)) unique.push(v);
  }
  ico.dispose();
  let minDistance = Infinity;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      minDistance = Math.min(minDistance, unique[i].distanceTo(unique[j]));
    }
  }
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (unique[i].distanceTo(unique[j]) > minDistance * 1.01) continue;
      parts.push(
        strut(
          unique[i].clone().multiplyScalar(radius),
          unique[j].clone().multiplyScalar(radius),
          strutRadius
        )
      );
    }
  }
  for (const v of unique) {
    parts.push(
      placed(
        new THREE.OctahedronGeometry(strutRadius * 3.4, 0),
        v.clone().multiplyScalar(radius),
        new THREE.Quaternion().setFromUnitVectors(UP, v)
      )
    );
  }
  return merged(parts);
}

/** 浑天仪环：细环 + 4 颗珠节（旋转时可见） */
function buildGyroGeometry(radius: number, tube: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [prepare(new THREE.TorusGeometry(radius, tube, 6, 120))];
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    parts.push(
      placed(
        new THREE.OctahedronGeometry(tube * 4.2, 0),
        new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0),
        new THREE.Quaternion()
      )
    );
  }
  return merged(parts);
}

export function createOraclePrimeMaterials(): OraclePrimeMaterials {
  return {
    obsidian: new THREE.MeshStandardMaterial({
      color: 0x161923,
      roughness: 0.3,
      metalness: 0.85,
      flatShading: true,
      emissive: 0x0b1a24,
      emissiveIntensity: 0.55,
    }),
    circuit: new THREE.MeshStandardMaterial({
      color: 0x062029,
      roughness: 0.4,
      metalness: 0.2,
      emissive: ORACLE_PALETTE.cyan,
      emissiveIntensity: 1.5,
    }),
    core: new THREE.MeshStandardMaterial({
      color: 0x123842,
      roughness: 0.25,
      metalness: 0,
      emissive: ORACLE_PALETTE.core,
      emissiveIntensity: 3.2,
    }),
    lattice: new THREE.MeshStandardMaterial({
      color: 0x0a2028,
      roughness: 0.35,
      metalness: 0.3,
      emissive: 0x6ff4ff,
      emissiveIntensity: 1.7,
    }),
    iris: new THREE.MeshStandardMaterial({
      color: 0x3a2a08,
      roughness: 0.3,
      metalness: 0.6,
      emissive: ORACLE_PALETTE.gold,
      emissiveIntensity: 2.2,
    }),
    pupil: new THREE.MeshStandardMaterial({
      color: 0x020306,
      roughness: 0.12,
      metalness: 0.7,
      emissive: 0x000000,
      emissiveIntensity: 0,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0x4a3510,
      roughness: 0.3,
      metalness: 0.8,
      emissive: ORACLE_PALETTE.gold,
      emissiveIntensity: 1.5,
    }),
    port: new THREE.MeshStandardMaterial({
      color: 0x101418,
      roughness: 0.4,
      metalness: 0.5,
      emissive: ORACLE_PALETTE.cyan,
      emissiveIntensity: 0.8,
    }),
    spine: createGlowMaterial(0x7ff2ff, 0.55, { side: THREE.DoubleSide }),
  };
}

function buildCrown(s: number, materials: OraclePrimeMaterials): THREE.Group {
  const crown = new THREE.Group();
  crown.name = 'oracle_crown';
  crown.position.set(0, CROWN_Y * s, 0);
  const armor: THREE.BufferGeometry[] = [];
  const veins: THREE.BufferGeometry[] = [];
  // 八角托盘
  armor.push(
    placed(
      new THREE.CylinderGeometry(2.1 * s, 1.5 * s, 0.4 * s, 8),
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion()
    )
  );
  veins.push(
    placed(
      new THREE.TorusGeometry(1.95 * s, 0.07 * s, 4, 48),
      new THREE.Vector3(0, 0.22 * s, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    )
  );
  // 八片冠刃：外倾，长短交替
  for (let k = 0; k < 8; k++) {
    const angle = (k * Math.PI * 2) / 8;
    const tall = k % 2 === 0;
    const height = (tall ? 3.3 : 2.2) * s;
    const radius = 1.55 * s;
    const tilt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, -angle, tall ? 0.24 : 0.36, 'YXZ')
    );
    const base = new THREE.Vector3(Math.cos(angle) * radius, 0.2 * s, Math.sin(angle) * radius);
    const center = new THREE.Vector3(0, height * 0.5, 0).applyQuaternion(tilt).add(base);
    armor.push(
      placed(
        new THREE.OctahedronGeometry(1, 0),
        center,
        tilt,
        new THREE.Vector3(0.34 * s, height * 0.5, 0.14 * s)
      )
    );
    const veinFrom = new THREE.Vector3(0, height * 0.12, 0.1 * s).applyQuaternion(tilt).add(base);
    const veinTo = new THREE.Vector3(0, height * 0.86, 0.06 * s).applyQuaternion(tilt).add(base);
    veins.push(strut(veinFrom, veinTo, 0.045 * s, 4));
  }
  // 中央尖塔
  armor.push(
    placed(
      new THREE.ConeGeometry(0.5 * s, 4 * s, 6),
      new THREE.Vector3(0, 2.2 * s, 0),
      new THREE.Quaternion()
    )
  );
  veins.push(
    placed(
      new THREE.OctahedronGeometry(0.32 * s, 0),
      new THREE.Vector3(0, 4.5 * s, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 2.2, 1)
    )
  );
  const armorMesh = new THREE.Mesh(merged(armor), materials.obsidian);
  armorMesh.name = 'oracle_crown_armor';
  armorMesh.castShadow = true;
  const veinMesh = new THREE.Mesh(merged(veins), materials.circuit);
  veinMesh.name = 'oracle_crown_veins';
  crown.add(armorMesh, veinMesh);
  return crown;
}

function buildRoot(
  s: number,
  materials: OraclePrimeMaterials
): { root: THREE.Group; ports: THREE.Object3D[] } {
  const root = new THREE.Group();
  root.name = 'oracle_root';
  root.position.set(0, ROOT_Y * s, 0);
  const armor: THREE.BufferGeometry[] = [];
  const veins: THREE.BufferGeometry[] = [];
  armor.push(
    placed(
      new THREE.CylinderGeometry(1.4 * s, 2.0 * s, 0.45 * s, 8),
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion()
    )
  );
  // 主根刺（向下）+ 四根侧刺
  armor.push(
    placed(
      new THREE.ConeGeometry(0.95 * s, 5.2 * s, 6),
      new THREE.Vector3(0, -2.8 * s, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    )
  );
  veins.push(
    strut(new THREE.Vector3(0, -0.4 * s, 0), new THREE.Vector3(0, -4.9 * s, 0), 0.09 * s, 6)
  );
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    const tilt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, -angle, Math.PI - 0.45, 'YXZ')
    );
    const base = new THREE.Vector3(Math.cos(angle) * 1.2 * s, -0.2 * s, Math.sin(angle) * 1.2 * s);
    const center = new THREE.Vector3(0, 1.4 * s, 0).applyQuaternion(tilt).add(base);
    armor.push(placed(new THREE.ConeGeometry(0.38 * s, 2.8 * s, 5), center, tilt));
  }
  const ports: THREE.Object3D[] = [];
  for (let k = 0; k < 6; k++) {
    const angle = (k * Math.PI * 2) / 6 + Math.PI / 6;
    const position = new THREE.Vector3(Math.cos(angle) * 1.78 * s, 0, Math.sin(angle) * 1.78 * s);
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    veins.push(
      placed(
        new THREE.CylinderGeometry(0.26 * s, 0.26 * s, 0.12 * s, 10),
        position,
        new THREE.Quaternion().setFromUnitVectors(UP, outward)
      )
    );
    const port = new THREE.Object3D();
    port.name = `oracle_missile_port_${k}`;
    port.position.copy(position).addScaledVector(outward, 0.5 * s);
    root.add(port);
    ports.push(port);
  }
  const armorMesh = new THREE.Mesh(merged(armor), materials.obsidian);
  armorMesh.name = 'oracle_root_armor';
  armorMesh.castShadow = true;
  const veinMesh = new THREE.Mesh(merged(veins), materials.port);
  veinMesh.name = 'oracle_root_veins';
  root.add(armorMesh, veinMesh);
  return { root, ports };
}

/**
 * 护盾塔的职能轮廓（合并进卡箍 / 光环网格，不增加绘制调用）：
 * 棱镜塔顶端三枚扇形棱晶；电弧塔特斯拉线圈 + 放电球；追猎塔两侧导弹巢；光矛塔长炮管。
 */
function buildPylonAccents(
  role: OraclePylonRole,
  s: number
): { armor: THREE.BufferGeometry[]; glow: THREE.BufferGeometry[] } {
  const armor: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const identity = new THREE.Quaternion();
  const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  switch (role) {
    case 'prism':
      for (let k = 0; k < 3; k++) {
        const angle = (k * Math.PI * 2) / 3;
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, 0.55, 'YXZ'));
        const center = new THREE.Vector3(0, 0.95 * s, 0)
          .applyQuaternion(tilt)
          .add(new THREE.Vector3(Math.cos(angle) * 0.45 * s, 2.75 * s, Math.sin(angle) * 0.45 * s));
        glow.push(
          placed(
            new THREE.OctahedronGeometry(1, 0),
            center,
            tilt,
            new THREE.Vector3(0.2 * s, 0.95 * s, 0.09 * s)
          )
        );
      }
      break;
    case 'arc': {
      const coils: ReadonlyArray<readonly [number, number]> = [
        [1.25, 1.18],
        [1.8, 0.98],
        [2.35, 0.78],
      ];
      for (const [y, radius] of coils) {
        glow.push(
          placed(
            new THREE.TorusGeometry(radius * s, 0.08 * s, 5, 28),
            new THREE.Vector3(0, y * s, 0),
            flat
          )
        );
      }
      glow.push(
        placed(
          new THREE.IcosahedronGeometry(0.42 * s, 1),
          new THREE.Vector3(0, 3.35 * s, 0),
          identity
        )
      );
      break;
    }
    case 'seeker':
      for (const side of [1, -1]) {
        armor.push(
          placed(
            new THREE.BoxGeometry(0.62 * s, 1.7 * s, 0.62 * s),
            new THREE.Vector3(side * 1.5 * s, 0.35 * s, 0),
            identity
          )
        );
        for (const dz of [-0.16, 0.16]) {
          glow.push(
            placed(
              new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.34 * s, 8),
              new THREE.Vector3(side * 1.5 * s, 1.32 * s, dz * s),
              identity
            )
          );
        }
      }
      break;
    case 'lance':
      armor.push(
        placed(
          new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 3.4 * s, 8),
          new THREE.Vector3(0, 4.25 * s, 0),
          identity
        )
      );
      for (const y of [3.3, 4.2, 5.1]) {
        glow.push(
          placed(
            new THREE.TorusGeometry(0.34 * s, 0.07 * s, 5, 20),
            new THREE.Vector3(0, y * s, 0),
            flat
          )
        );
      }
      glow.push(
        placed(
          new THREE.OctahedronGeometry(0.22 * s, 0),
          new THREE.Vector3(0, 6.05 * s, 0),
          identity,
          new THREE.Vector3(1, 1.8, 1)
        )
      );
      break;
  }
  return { armor, glow };
}

function buildPylon(
  index: number,
  role: OraclePylonRole,
  s: number,
  materials: OraclePrimeMaterials,
  tetherGeometry: THREE.BufferGeometry,
  parts: THREE.Object3D[]
): OraclePylonRig {
  const color = new THREE.Color(ORACLE_PYLON_COLORS[role]);
  const group = new THREE.Group();
  group.name = `oracle_pylon_${index}_${role}`;
  const spinner = new THREE.Group();
  spinner.name = `oracle_pylon_${index}_spinner`;
  group.add(spinner);

  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.18),
    roughness: 0.18,
    metalness: 0.1,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 1.35,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMaterial);
  crystal.name = `oracle_pylon_crystal_${index}`;
  crystal.scale.set(0.95 * s, 2.7 * s, 0.95 * s);
  crystal.userData.hitRadius = 2.5 * s;
  spinner.add(crystal);
  parts.push(crystal);

  const accents = buildPylonAccents(role, s);
  // 卡箍：腰部六角箍 + 三片短夹翼 + 下垂尖刺（晶体上下大部分外露）+ 职能轮廓
  const collarParts: THREE.BufferGeometry[] = [
    ...accents.armor,
    prepare(new THREE.CylinderGeometry(1.0 * s, 1.18 * s, 0.42 * s, 6, 1, true)),
    placed(
      new THREE.ConeGeometry(0.55 * s, 2.6 * s, 6),
      new THREE.Vector3(0, -3.6 * s, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    ),
  ];
  for (let k = 0; k < 3; k++) {
    const angle = (k * Math.PI * 2) / 3;
    collarParts.push(
      placed(
        new THREE.BoxGeometry(0.16 * s, 1.5 * s, 0.5 * s),
        new THREE.Vector3(Math.cos(angle) * 0.86 * s, -0.1 * s, Math.sin(angle) * 0.86 * s),
        new THREE.Quaternion().setFromAxisAngle(UP, -angle)
      )
    );
  }
  const collar = new THREE.Mesh(merged(collarParts), materials.obsidian);
  collar.name = `oracle_pylon_collar_${index}`;
  collar.castShadow = true;
  spinner.add(collar);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.2),
    roughness: 0.3,
    metalness: 0.6,
    emissive: color,
    emissiveIntensity: 1.8,
  });
  const rings = new THREE.Mesh(
    merged([
      ...accents.glow,
      placed(
        new THREE.TorusGeometry(1.95 * s, 0.07 * s, 5, 56),
        new THREE.Vector3(),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + 0.45, 0, 0))
      ),
      placed(
        new THREE.TorusGeometry(2.4 * s, 0.06 * s, 5, 64),
        new THREE.Vector3(0, 0.3 * s, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.5, 0, 0.35))
      ),
    ]),
    ringMaterial
  );
  rings.name = `oracle_pylon_rings_${index}`;
  group.add(rings);

  const tip = new THREE.Object3D();
  tip.name = `oracle_pylon_tip_${index}`;
  // 光矛塔从炮管口发射；其余塔从晶体尖端
  tip.position.set(0, (role === 'lance' ? 6.2 : 2.85) * s, 0);
  group.add(tip);
  const tipGlow = createGlowSprite(color.getHex(), 2.6 * s, 0.75);
  tipGlow.name = `oracle_pylon_tip_glow_${index}`;
  tipGlow.position.copy(tip.position);
  group.add(tipGlow);

  const tetherMaterial = createGlowMaterial(color.getHex(), 0.5, { side: THREE.DoubleSide });
  const tether = new THREE.Mesh(tetherGeometry, tetherMaterial);
  tether.name = `oracle_pylon_tether_${index}`;
  tether.frustumCulled = false;
  tether.renderOrder = 0;
  const packet = createGlowSprite(color.getHex(), 2.6 * s, 0.9);
  packet.name = `oracle_pylon_packet_${index}`;

  return {
    index,
    role,
    color,
    group,
    spinner,
    crystal,
    crystalMaterial,
    collar,
    rings,
    ringMaterial,
    tip,
    tipGlow,
    tether,
    tetherMaterial,
    packet,
    baseAngle: Math.PI / 4 + (index * Math.PI) / 2,
    orbitHeight: (PYLON_ORBIT_HEIGHTS[index] ?? 0) * s,
  };
}

/**
 * 创建神谕主宰模型。返回的 Group 名为 `BOSS_${config.type}`；
 * 骨架挂在 group.oracleRig，可碰撞部件（含 userData.hitRadius，米）挂在 group.bossParts。
 */
export function createOraclePrimeMesh(config: BossConfig): THREE.Group {
  const s = Number.isFinite(config.scale) && config.scale > 0 ? config.scale : 6;
  const group = new THREE.Group() as OraclePrimeGroup;
  group.name = `BOSS_${config.type}`;
  group.userData.hitRadius = SHIELD_RADIUS * s;
  const materials = createOraclePrimeMaterials();
  const parts: THREE.Object3D[] = [];

  const body = new THREE.Group();
  body.name = 'oracle_body';
  group.add(body);

  // ===== seed：核心 + 瞳孔 + 花瓣（朝向玩家）=====
  const seed = new THREE.Group();
  seed.name = 'oracle_seed';
  body.add(seed);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(CORE_RADIUS * s, 3), materials.core);
  core.name = 'oracle_core';
  core.userData.hitRadius = 2.5 * s;
  seed.add(core);
  parts.push(core);
  const coreGlow = createGlowSprite(0x8ff2ff, 7.2 * s, 0.85);
  coreGlow.name = 'oracle_core_glow';
  seed.add(coreGlow);
  const coreFlare = createGlowSprite(0xf2fbff, 16 * s, 0);
  coreFlare.name = 'oracle_core_flare';
  coreFlare.visible = false;
  seed.add(coreFlare);

  const iris = new THREE.Group();
  iris.name = 'oracle_iris';
  seed.add(iris);
  const irisRadius = 1.34;
  const irisRing = new THREE.Mesh(
    new THREE.TorusGeometry(irisRadius * s, 0.13 * s, 8, 56),
    materials.iris
  );
  irisRing.name = 'oracle_iris_ring';
  irisRing.position.z =
    Math.sqrt(CORE_RADIUS * CORE_RADIUS - irisRadius * irisRadius) * s + 0.06 * s;
  iris.add(irisRing);
  const pupilAngle = Math.asin(1.16 / CORE_RADIUS);
  const pupilGeometry = new THREE.SphereGeometry(
    (CORE_RADIUS + 0.035) * s,
    32,
    10,
    0,
    Math.PI * 2,
    0,
    pupilAngle
  );
  pupilGeometry.rotateX(Math.PI / 2);
  const pupil = new THREE.Mesh(pupilGeometry, materials.pupil);
  pupil.name = 'oracle_pupil';
  iris.add(pupil);
  const pupilGlow = createGlowSprite(0xfff0c8, 3.2 * s, 0);
  pupilGlow.name = 'oracle_pupil_glow';
  pupilGlow.position.set(0, 0, (CORE_RADIUS + 0.45) * s);
  pupilGlow.visible = false;
  iris.add(pupilGlow);
  const irisMuzzle = new THREE.Object3D();
  irisMuzzle.name = 'oracle_iris_muzzle';
  irisMuzzle.position.set(0, 0, (CORE_RADIUS + 0.6) * s);
  iris.add(irisMuzzle);

  const petalFrames = buildPetalFrames();
  const faceRadius = PETAL_INRADIUS * DODECA_FACE_RATIO * 0.9;
  const petalGeometry = buildPetalGeometry(s, faceRadius * s);
  const trimGeometry = buildPetalTrimGeometry(s, faceRadius * s);
  const petals = new THREE.InstancedMesh(petalGeometry, materials.obsidian, petalFrames.length);
  petals.name = 'oracle_petals';
  petals.castShadow = true;
  petals.frustumCulled = false;
  const petalTrims = new THREE.InstancedMesh(trimGeometry, materials.circuit, petalFrames.length);
  petalTrims.name = 'oracle_petal_trims';
  petalTrims.frustumCulled = false;
  const matrix = new THREE.Matrix4();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  petalFrames.forEach((frame, i) => {
    position.copy(frame.normal).multiplyScalar(PETAL_INRADIUS * s);
    matrix.compose(position, frame.basis, unitScale);
    petals.setMatrixAt(i, matrix);
    petalTrims.setMatrixAt(i, matrix);
  });
  petals.instanceMatrix.needsUpdate = true;
  petalTrims.instanceMatrix.needsUpdate = true;
  seed.add(petals, petalTrims);

  // 花瓣装甲代理（阶段 2 张开后才进入碰撞列表）：选取赤道附近 6 片
  const petalProxies: THREE.Object3D[] = [];
  const equatorial = petalFrames
    .map((frame, index) => ({ index, weight: Math.abs(frame.normal.y) - frame.normal.z * 0.3 }))
    .sort((a, b) => a.weight - b.weight)
    .slice(0, 6);
  for (const entry of equatorial) {
    const proxy = new THREE.Object3D();
    proxy.name = `oracle_petal_proxy_${entry.index}`;
    proxy.userData.hitRadius = 2.3 * s;
    proxy.userData.petalIndex = entry.index;
    proxy.position.copy(petalFrames[entry.index].normal).multiplyScalar(PETAL_INRADIUS * s);
    seed.add(proxy);
    petalProxies.push(proxy);
  }

  // ===== 光栅 =====
  const latticePivot = new THREE.Group();
  latticePivot.name = 'oracle_lattice_pivot';
  body.add(latticePivot);
  const lattice = new THREE.Mesh(
    buildLatticeGeometry(LATTICE_RADIUS * s, 0.055 * s),
    materials.lattice
  );
  lattice.name = 'oracle_lattice';
  latticePivot.add(lattice);

  // ===== 赤道光环 + 发射器 =====
  const halo = new THREE.Group();
  halo.name = 'oracle_halo';
  halo.position.y = HALO_Y * s;
  body.add(halo);
  const haloRing = new THREE.Mesh(
    new THREE.TorusGeometry(HALO_RADIUS * s, 0.28 * s, 8, 128),
    materials.obsidian
  );
  haloRing.name = 'oracle_halo_ring';
  haloRing.rotation.x = Math.PI / 2;
  haloRing.castShadow = true;
  halo.add(haloRing);
  const haloBand = new THREE.Mesh(
    new THREE.TorusGeometry((HALO_RADIUS - 0.3) * s, 0.09 * s, 4, 128),
    materials.circuit
  );
  haloBand.name = 'oracle_halo_band';
  haloBand.rotation.x = Math.PI / 2;
  halo.add(haloBand);

  const emitters: OracleEmitterRig[] = [];
  const lensGeometry = merged([
    placed(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.Vector3(0, 0, 0.45 * s),
      new THREE.Quaternion(),
      new THREE.Vector3(0.62 * s, 0.62 * s, 1.35 * s)
    ),
    placed(
      new THREE.TorusGeometry(0.72 * s, 0.08 * s, 4, 16),
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion()
    ),
  ]);
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2;
    const pivot = new THREE.Group();
    pivot.name = `oracle_emitter_${k}`;
    pivot.position.set(Math.cos(angle) * HALO_RADIUS * s, 0, Math.sin(angle) * HALO_RADIUS * s);
    // +Z 朝外
    pivot.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    );
    halo.add(pivot);
    const material = new THREE.MeshStandardMaterial({
      color: 0x0e2a33,
      roughness: 0.2,
      metalness: 0.4,
      flatShading: true,
      emissive: 0x9ff8ff,
      emissiveIntensity: 1.1,
    });
    // 4 个发射器共享同一几何体（重复 dispose 无副作用）
    const lens = new THREE.Mesh(lensGeometry, material);
    lens.name = `oracle_emitter_lens_${k}`;
    lens.userData.hitRadius = 1.6 * s;
    pivot.add(lens);
    parts.push(lens);
    const glow = createGlowSprite(0xaef8ff, 3.6 * s, 0);
    glow.name = `oracle_emitter_glow_${k}`;
    glow.position.set(0, 0, 1.6 * s);
    glow.visible = false;
    pivot.add(glow);
    const muzzle = new THREE.Object3D();
    muzzle.name = `oracle_emitter_muzzle_${k}`;
    muzzle.position.set(0, 0, 1.9 * s);
    pivot.add(muzzle);
    emitters.push({ index: k, pivot, lens, material, glow, muzzle, angle });
  }

  const haloProxies: THREE.Object3D[] = [];
  for (let k = 0; k < 8; k++) {
    const angle = Math.PI / 4 / 2 + (k * Math.PI) / 4;
    const proxy = new THREE.Object3D();
    proxy.name = `oracle_halo_proxy_${k}`;
    proxy.userData.hitRadius = 1.5 * s;
    proxy.position.set(Math.cos(angle) * HALO_RADIUS * s, 0, Math.sin(angle) * HALO_RADIUS * s);
    halo.add(proxy);
    haloProxies.push(proxy);
  }

  // ===== 浑天仪环 =====
  const gyroPivots: THREE.Group[] = [];
  const gyroRings: THREE.Mesh[] = [];
  GYRO_RADII.forEach((radius, i) => {
    const pivot = new THREE.Group();
    pivot.name = `oracle_gyro_pivot_${i}`;
    body.add(pivot);
    const ring = new THREE.Mesh(buildGyroGeometry(radius * s, 0.1 * s), materials.gold);
    ring.name = `oracle_gyro_ring_${i}`;
    ring.rotation.x = i === 0 ? 1.15 : -0.55;
    ring.rotation.y = i === 0 ? 0.25 : 1.2;
    pivot.add(ring);
    gyroPivots.push(pivot);
    gyroRings.push(ring);
  });

  // ===== 冠 / 根 / 中轴光脊 =====
  const crown = buildCrown(s, materials);
  body.add(crown);
  const { root, ports } = buildRoot(s, materials);
  body.add(root);
  const spineGeometry = new THREE.CylinderGeometry(
    0.1 * s,
    0.1 * s,
    (CROWN_Y - ROOT_Y) * s,
    6,
    1,
    true
  );
  const spine = new THREE.Mesh(spineGeometry, materials.spine);
  spine.name = 'oracle_spine';
  spine.renderOrder = 0;
  body.add(spine);

  // ===== 护盾 =====
  const shieldMaterial = createOracleShieldMaterial(
    ORACLE_PALETTE.shield,
    ORACLE_PALETTE.shieldHot,
    ORACLE_PALETTE.breach
  );
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(SHIELD_RADIUS * s, 56, 36),
    shieldMaterial
  );
  shield.name = 'oracle_shield';
  shield.renderOrder = 0;
  group.add(shield);
  const shieldProxy = new THREE.Object3D();
  shieldProxy.name = 'oracle_shield_proxy';
  shieldProxy.userData.hitRadius = SHIELD_RADIUS * s;
  shieldProxy.userData.bossDeflector = true;
  group.add(shieldProxy);

  // ===== 护盾塔 =====
  // 系索几何体由 4 根系索共享（重复 dispose 无副作用）
  const tetherGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  tetherGeometry.translate(0, 0.5, 0);
  const pylons: OraclePylonRig[] = [];
  ORACLE_PYLON_ROLES.forEach((role, index) => {
    const pylon = buildPylon(index, role, s, materials, tetherGeometry, parts);
    pylon.group.position.set(
      Math.cos(pylon.baseAngle) * PYLON_ORBIT_RADIUS * s,
      pylon.orbitHeight,
      Math.sin(pylon.baseAngle) * PYLON_ORBIT_RADIUS * s
    );
    group.add(pylon.group, pylon.tether, pylon.packet);
    pylons.push(pylon);
  });

  const rig: OraclePrimeRig = {
    scale: s,
    body,
    seed,
    core,
    coreRadius: CORE_RADIUS * s,
    coreGlow,
    coreFlare,
    iris,
    irisRing,
    pupil,
    pupilGlow,
    irisMuzzle,
    latticePivot,
    lattice,
    petals,
    petalTrims,
    petalFrames,
    petalInradius: PETAL_INRADIUS * s,
    halo,
    haloRing,
    haloBand,
    haloRadius: HALO_RADIUS * s,
    emitters,
    gyroPivots,
    gyroRings,
    crown,
    root,
    spine,
    missilePorts: ports,
    shield,
    shieldMaterial,
    shieldRadius: SHIELD_RADIUS * s,
    shieldProxy,
    petalProxies,
    haloProxies,
    pylons,
    pylonOrbitRadius: PYLON_ORBIT_RADIUS * s,
    materials,
  };
  group.oracleRig = rig;
  group.bossParts = parts;
  group.updateMatrixWorld(true);
  return group;
}

const petalPosition = new THREE.Vector3();
const petalScale = new THREE.Vector3();
const petalTwist = new THREE.Quaternion();
const petalRotation = new THREE.Quaternion();

/**
 * 花瓣姿态：open 0（闭合）→ 1（沿法线张开并扭转）；radiusOverride 用于碎片轨道。
 * 写入 out（seed 局部坐标）。
 */
export function composeOraclePetalMatrix(
  rig: OraclePrimeRig,
  index: number,
  open: number,
  twist: number,
  out: THREE.Matrix4
): THREE.Matrix4 {
  const frame = rig.petalFrames[index];
  if (!frame) return out.identity();
  const s = rig.scale;
  const distance = rig.petalInradius + open * 2.1 * s;
  petalPosition.copy(frame.normal).multiplyScalar(distance);
  petalTwist.setFromAxisAngle(frame.normal, twist);
  petalRotation.copy(petalTwist).multiply(frame.basis);
  const size = 1 - 0.14 * open;
  petalScale.set(size, size, size);
  return out.compose(petalPosition, petalRotation, petalScale);
}
