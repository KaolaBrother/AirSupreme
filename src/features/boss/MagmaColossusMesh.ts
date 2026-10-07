import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BossConfig } from './BossTypes';
import { createGlowSprite } from './MagmaColossusHazards';

/**
 * 第六关 Boss「熔岩巨像」模型：黑色玄武岩装甲 + 熔融核心的四足攻城机甲。
 *
 * 朝向：头部 +Z，上方向 +Y；根节点原点位于两对足之间的地面上。
 * 结构：
 * - body（躯干）：玄武岩甲壳三段、侧裙、熔岩腹部、发光裂缝（合并网格）、
 *   胸口熔炉核心 + 两扇装甲闸门、头部（可转动，含发光目镜与两门热能炮）、
 *   双肩迫击炮组（各 3 管）、背部 4 个散热口（百叶可开合）、脊背导弹井、尾部烟囱。
 * - legs：四条腿各自由 髋球 / 大腿 / 膝关节 / 小腿 / 足掌 / 液压杆 组成，
 *   全部挂在根节点下，由 solveColossusLeg 的两段 IK 摆姿（足端固定在世界坐标）。
 *
 * 尺寸以“设计单位”书写，再乘以 config.scale（默认 5）得到米。
 */

export type ColossusLegId = 'FL' | 'FR' | 'BL' | 'BR';

export interface ColossusLegRig {
  id: ColossusLegId;
  /** +1：+X 侧；-1：-X 侧 */
  side: 1 | -1;
  front: boolean;
  /** 躯干局部坐标中的髋关节位置（米） */
  hipOffset: THREE.Vector3;
  /** 根节点局部坐标中的落足基准点（米，y = 0） */
  homeOffset: THREE.Vector3;
  /** 躯干局部坐标中液压杆的上端锚点（米） */
  pistonAnchor: THREE.Vector3;
  upperLength: number;
  lowerLength: number;
  hip: THREE.Mesh;
  thigh: THREE.Group;
  thighCore: THREE.Mesh;
  knee: THREE.Group;
  shin: THREE.Group;
  shinCore: THREE.Mesh;
  foot: THREE.Group;
  footGlowMaterial: THREE.MeshStandardMaterial;
  piston: THREE.Mesh;
}

export interface ColossusVentRig {
  index: number;
  group: THREE.Group;
  /** 子目标网格：散热口发光芯 */
  core: THREE.Mesh;
  coreMaterial: THREE.MeshStandardMaterial;
  slats: THREE.Group[];
  heat: THREE.Sprite;
  /** 散热口被毁后炸飞的邻近装甲板与其下暴露的熔岩 */
  plate: THREE.Mesh;
  magmaPatch: THREE.Mesh;
}

export interface MagmaColossusMaterials {
  basalt: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  crack: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  belly: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
  kneeGlow: THREE.MeshStandardMaterial;
  mortarMuzzle: THREE.MeshStandardMaterial;
  cannonMuzzle: THREE.MeshStandardMaterial;
  missileCell: THREE.MeshStandardMaterial;
}

export interface MagmaColossusRig {
  scale: number;
  body: THREE.Group;
  /** 静止站姿下躯干原点离地高度（米） */
  bodyHeight: number;
  head: THREE.Group;
  visor: THREE.Mesh;
  visorGlows: THREE.Sprite[];
  coreMesh: THREE.Mesh;
  coreGlow: THREE.Sprite;
  coreShutters: THREE.Group[];
  vents: ColossusVentRig[];
  mortarHousings: THREE.Mesh[];
  /** 6 个迫击炮口（躯干子节点，取世界坐标发射） */
  mortarMuzzles: THREE.Object3D[];
  cannonMuzzles: THREE.Object3D[];
  missileCells: THREE.Object3D[];
  chimneyTops: THREE.Object3D[];
  chimneyGlows: THREE.Sprite[];
  hull: THREE.Mesh;
  carapace: THREE.Mesh[];
  headShell: THREE.Mesh;
  legs: ColossusLegRig[];
  materials: MagmaColossusMaterials;
}

export type MagmaColossusGroup = THREE.Group & { colossusRig?: MagmaColossusRig };

/** 设计单位下的腿部参数 */
const LEG_UPPER = 8.6;
const LEG_LOWER = 14.2;
const BODY_HEIGHT = 9.6;
const HIP_X = 3.9;
const HIP_Z = 4.3;
const HIP_Y = -0.9;
const HOME_X = 10.6;
const HOME_Z = 9.6;

const scratchU = new THREE.Vector3();
const scratchV = new THREE.Vector3();
const scratchN = new THREE.Vector3();
const scratchX = new THREE.Vector3();
const scratchY = new THREE.Vector3();
const scratchKnee = new THREE.Vector3();
const scratchMid = new THREE.Vector3();
const scratchBasis = new THREE.Matrix4();
const scratchPole = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * 两段式 IK：给定髋关节与足端（均为根节点局部坐标），求膝关节并摆放大腿/小腿/液压杆。
 * pole 为期望的膝盖弯折方向（腿外侧偏上）。返回膝关节位置（写入 outKnee）。
 */
export function solveColossusLeg(
  leg: ColossusLegRig,
  hip: THREE.Vector3,
  foot: THREE.Vector3,
  pole: THREE.Vector3,
  pistonAnchor: THREE.Vector3,
  outKnee: THREE.Vector3 = scratchKnee
): THREE.Vector3 {
  const a = leg.upperLength;
  const b = leg.lowerLength;
  scratchU.subVectors(foot, hip);
  let distance = scratchU.length();
  if (!Number.isFinite(distance) || distance < 1e-4) {
    scratchU.set(0, -1, 0);
    distance = 1e-4;
  } else {
    scratchU.divideScalar(distance);
  }
  distance = THREE.MathUtils.clamp(distance, Math.abs(a - b) + 0.05 * a, a + b - 0.02 * a);
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));

  scratchV.copy(pole).addScaledVector(scratchU, -pole.dot(scratchU));
  if (scratchV.lengthSq() < 1e-8) scratchV.set(leg.side, 1, 0);
  scratchV.normalize();
  outKnee.copy(hip).addScaledVector(scratchU, along).addScaledVector(scratchV, height);
  scratchN.crossVectors(scratchU, scratchV).normalize();

  // 大腿：原点在髋，+Y 指向膝
  scratchY.subVectors(outKnee, hip).normalize();
  scratchX.crossVectors(scratchY, scratchN).normalize();
  scratchBasis.makeBasis(scratchX, scratchY, scratchN);
  leg.thigh.position.copy(hip);
  leg.thigh.quaternion.setFromRotationMatrix(scratchBasis);

  // 小腿：原点在膝，+Y 指向足
  scratchY.subVectors(foot, outKnee).normalize();
  scratchX.crossVectors(scratchY, scratchN).normalize();
  scratchBasis.makeBasis(scratchX, scratchY, scratchN);
  leg.shin.position.copy(outKnee);
  leg.shin.quaternion.setFromRotationMatrix(scratchBasis);

  leg.knee.position.copy(outKnee);
  leg.knee.quaternion.copy(leg.thigh.quaternion);
  leg.hip.position.copy(hip);

  // 液压杆：躯干锚点 → 大腿 45% 处
  scratchMid.copy(hip).lerp(outKnee, 0.45);
  scratchY.subVectors(scratchMid, pistonAnchor);
  const pistonLength = Math.max(0.01, scratchY.length());
  scratchY.divideScalar(pistonLength);
  leg.piston.position.copy(pistonAnchor);
  leg.piston.quaternion.setFromUnitVectors(UP, scratchY);
  leg.piston.scale.set(1, pistonLength, 1);
  return outKnee;
}

/** 膝盖弯折方向：腿外侧 + 向上（写入 out） */
export function getColossusLegPole(
  leg: ColossusLegRig,
  out: THREE.Vector3 = scratchPole
): THREE.Vector3 {
  out.set(leg.homeOffset.x, 0, leg.homeOffset.z * 0.55).normalize();
  out.y = 1.25;
  return out.normalize();
}

/** 把一组几何体合并为一个网格（同材质的小装饰件，减少 draw call） */
function mergeInto(
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  name: string
): THREE.Mesh {
  const merged = mergeGeometries(geometries, false) ?? new THREE.BufferGeometry();
  for (const geometry of geometries) geometry.dispose();
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name;
  return mesh;
}

function placed(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx: number = 0,
  ry: number = 0,
  rz: number = 0,
  sx: number = 1,
  sy: number = 1,
  sz: number = 1
): THREE.BufferGeometry {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
  // mergeGeometries 要求属性一致：统一为非索引 + position/normal/uv
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
  if (prepared !== geometry) geometry.dispose();
  prepared.applyMatrix4(matrix);
  return prepared;
}

export function createMagmaColossusMaterials(): MagmaColossusMaterials {
  return {
    basalt: new THREE.MeshStandardMaterial({
      color: 0x2c2521,
      roughness: 0.94,
      metalness: 0.08,
      flatShading: true,
      emissive: 0x1a0601,
      emissiveIntensity: 0.4,
    }),
    plate: new THREE.MeshStandardMaterial({
      color: 0x3b322c,
      roughness: 0.86,
      metalness: 0.14,
      flatShading: true,
      emissive: 0x160500,
      emissiveIntensity: 0.3,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x57504b,
      roughness: 0.4,
      metalness: 0.78,
      emissive: 0x120604,
      emissiveIntensity: 0.25,
    }),
    crack: new THREE.MeshStandardMaterial({
      color: 0x2a0800,
      roughness: 0.6,
      metalness: 0,
      emissive: 0xff4a10,
      emissiveIntensity: 1.3,
    }),
    core: new THREE.MeshStandardMaterial({
      color: 0x401000,
      roughness: 0.35,
      metalness: 0,
      emissive: 0xffa03a,
      emissiveIntensity: 2.2,
    }),
    belly: new THREE.MeshStandardMaterial({
      color: 0x3a0c00,
      roughness: 0.55,
      metalness: 0,
      emissive: 0xff5a14,
      emissiveIntensity: 1.5,
      flatShading: true,
    }),
    visor: new THREE.MeshStandardMaterial({
      color: 0x330800,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0xff3c14,
      emissiveIntensity: 2.4,
    }),
    kneeGlow: new THREE.MeshStandardMaterial({
      color: 0x2a0800,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0xff6418,
      emissiveIntensity: 1.6,
    }),
    mortarMuzzle: new THREE.MeshStandardMaterial({
      color: 0x200600,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0xff5a10,
      emissiveIntensity: 0.6,
    }),
    cannonMuzzle: new THREE.MeshStandardMaterial({
      color: 0x1a0500,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0xff6a20,
      emissiveIntensity: 0.7,
    }),
    missileCell: new THREE.MeshStandardMaterial({
      color: 0x220700,
      roughness: 0.45,
      metalness: 0.4,
      emissive: 0xff7a24,
      emissiveIntensity: 0.7,
    }),
  };
}

/**
 * 创建熔岩巨像模型。返回的 Group 名为 `BOSS_${config.type}`，
 * 可碰撞部件（含 userData.hitRadius，单位米）挂在 group.bossParts，
 * 动画骨架挂在 group.colossusRig。
 */
export function createMagmaColossusMesh(config: BossConfig): THREE.Group {
  const s = Number.isFinite(config.scale) && config.scale > 0 ? config.scale : 5;
  const group = new THREE.Group() as MagmaColossusGroup & { bossParts?: THREE.Mesh[] };
  group.name = `BOSS_${config.type}`;
  const materials = createMagmaColossusMaterials();
  const parts: THREE.Mesh[] = [];

  const body = new THREE.Group();
  body.name = 'colossus_body';
  body.position.set(0, BODY_HEIGHT * s, 0);
  group.add(body);

  const box = (w: number, h: number, d: number): THREE.BoxGeometry =>
    new THREE.BoxGeometry(w * s, h * s, d * s);
  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    x: number,
    y: number,
    z: number,
    rotation: { x?: number; y?: number; z?: number } = {},
    hitRadius: number = 0
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x * s, y * s, z * s);
    mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
    mesh.castShadow = true;
    parent.add(mesh);
    if (hitRadius > 0) {
      mesh.userData.hitRadius = hitRadius * s;
      parts.push(mesh);
    }
    return mesh;
  };

  // ===== 躯干：内壳 + 三段甲壳 + 侧裙 =====
  // 内壳：多面体巨岩（平直着色的切面像玄武岩柱）
  const hull = add(
    body,
    new THREE.IcosahedronGeometry(1 * s, 1),
    materials.basalt,
    'colossus_hull',
    0,
    0.2,
    0,
    {},
    5.6
  );
  hull.scale.set(4.5, 2.5, 6.6);
  const carapace = [
    add(body, box(9.0, 1.4, 4.7), materials.plate, 'colossus_carapace_front', 0, 2.3, 3.5, {
      x: -0.1,
    }),
    add(body, box(9.8, 1.5, 4.5), materials.plate, 'colossus_carapace_mid', 0, 2.62, -0.6),
    add(body, box(9.0, 1.4, 4.3), materials.plate, 'colossus_carapace_rear', 0, 2.36, -4.75, {
      x: 0.12,
    }),
  ];
  carapace[0].userData.hitRadius = 3.4 * s;
  carapace[2].userData.hitRadius = 3.4 * s;
  parts.push(carapace[0], carapace[2]);
  for (const side of [1, -1] as const) {
    add(
      body,
      box(1.0, 3.4, 10.8),
      materials.plate,
      `colossus_skirt_${side > 0 ? 'L' : 'R'}`,
      side * 4.4,
      -0.3,
      -0.2,
      {
        z: side * 0.22,
      }
    );
    // 肩部岩块
    const rock = new THREE.DodecahedronGeometry(1.5 * s, 0);
    add(
      body,
      rock,
      materials.basalt,
      `colossus_shoulder_rock_${side > 0 ? 'L' : 'R'}`,
      side * 3.7,
      1.9,
      4.6,
      {
        x: 0.4,
        y: side * 0.6,
      }
    ).scale.set(1.25, 0.8, 1.1);
  }

  // 层叠玄武岩鳞甲（合并网格，打破方盒轮廓）
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const scaleGeometries: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col <= 1; col++) {
      const z = 4.6 - row * 3.1 + (rand() - 0.5) * 0.6;
      const x = col * 3.0 + (rand() - 0.5) * 0.5;
      const y = 3.15 - Math.abs(col) * 0.55 - Math.abs(z) * 0.04;
      scaleGeometries.push(
        placed(
          new THREE.DodecahedronGeometry(1.25 * s, 0),
          x * s,
          y * s,
          z * s,
          0.15 + rand() * 0.3,
          rand() * 1.4,
          col * 0.35 + (rand() - 0.5) * 0.2,
          1.35,
          0.42,
          1.15
        )
      );
    }
  }
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      scaleGeometries.push(
        placed(
          new THREE.DodecahedronGeometry(1.1 * s, 0),
          side * 4.9 * s,
          (0.9 - (i % 2) * 0.5) * s,
          (4.2 - i * 2.9) * s,
          rand() * 0.6,
          rand(),
          side * (0.9 + rand() * 0.3),
          0.55,
          1.2,
          1.1
        )
      );
    }
  }
  // 髋部巨岩护甲：盖住四个髋关节，让躯干在远处显得更宽更重
  for (const side of [1, -1]) {
    for (const zSign of [1, -1]) {
      scaleGeometries.push(
        placed(
          new THREE.DodecahedronGeometry(1.6 * s, 0),
          side * 4.4 * s,
          0.55 * s,
          zSign * 4.5 * s,
          0.2 * zSign,
          side * 0.5,
          -side * 0.35,
          1.45,
          1.05,
          1.5
        )
      );
    }
  }
  const basaltScales = mergeInto(scaleGeometries, materials.plate, 'colossus_basalt_scales');
  basaltScales.castShadow = true;
  body.add(basaltScales);

  // 熔岩腹部（从下方仰视可见的熔融层）
  const belly = add(
    body,
    new THREE.IcosahedronGeometry(1 * s, 1),
    materials.belly,
    'colossus_belly_glow',
    0,
    -1.95,
    -0.4
  );
  belly.scale.set(3.3, 1.0, 5.2);
  belly.castShadow = false;

  // 背脊玄武岩尖刺
  const spikeGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const z = 5.0 - i * 2.05;
    const h = 1.6 + (i % 2) * 0.7;
    spikeGeometries.push(
      placed(new THREE.ConeGeometry(0.55 * s, h * s, 5), 0, (3.35 + h * 0.4) * s, z * s, -0.35)
    );
  }
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      spikeGeometries.push(
        placed(
          new THREE.ConeGeometry(0.42 * s, 1.5 * s, 5),
          side * 4.9 * s,
          1.2 * s,
          (3.6 - i * 2.9) * s,
          0,
          0,
          -side * 1.05
        )
      );
    }
  }
  const spikes = mergeInto(spikeGeometries, materials.basalt, 'colossus_spikes');
  spikes.castShadow = true;
  body.add(spikes);

  // ===== 发光裂缝（合并网格，阶段越高越亮）=====
  const crackGeometries: THREE.BufferGeometry[] = [
    placed(box(9.1, 0.24, 0.42), 0, 2.08 * s, 1.2 * s),
    placed(box(9.9, 0.24, 0.42), 0, 2.2 * s, -2.85 * s),
    placed(box(0.22, 0.18, 4.2), 1.6 * s, 3.33 * s, 3.4 * s, -0.1, 0.25),
    placed(box(0.22, 0.18, 3.6), -2.4 * s, 3.36 * s, 3.1 * s, -0.1, -0.4),
    placed(box(0.2, 0.18, 3.2), 3.9 * s, 3.1 * s, -4.9 * s, 0.12, 0.5),
    placed(box(0.2, 0.18, 3.0), -3.6 * s, 3.1 * s, -5.2 * s, 0.12, -0.3),
    placed(box(7.6, 0.3, 0.3), 0, -1.85 * s, 5.95 * s),
    placed(box(7.6, 0.3, 0.3), 0, -1.85 * s, -6.0 * s),
  ];
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      crackGeometries.push(
        placed(
          box(0.2, 2.6, 0.3),
          side * 4.95 * s,
          -0.4 * s,
          (3.8 - i * 2.6) * s,
          0.25 * (i % 2 === 0 ? 1 : -1),
          0,
          side * 0.22
        )
      );
    }
    // 腹下熔岩钟乳
    for (let i = 0; i < 3; i++) {
      crackGeometries.push(
        placed(
          new THREE.ConeGeometry(0.35 * s, 1.6 * s, 5),
          side * 2.6 * s,
          -2.6 * s,
          (3 - i * 3) * s,
          Math.PI
        )
      );
    }
  }
  const cracks = mergeInto(crackGeometries, materials.crack, 'colossus_cracks');
  cracks.castShadow = false;
  body.add(cracks);

  // ===== 胸口熔炉核心 + 闸门 =====
  const coreMesh = add(
    body,
    new THREE.IcosahedronGeometry(1.4 * s, 2),
    materials.core,
    'colossus_core',
    0,
    -1.45,
    5.7,
    {},
    1.9
  );
  coreMesh.castShadow = false;
  const coreGlow = createGlowSprite(0xff8a2a, 7.5 * s, 0.75);
  coreGlow.name = 'colossus_core_glow';
  coreGlow.position.set(0, -1.45 * s, 6.6 * s);
  body.add(coreGlow);
  const coreShutters: THREE.Group[] = [];
  for (const side of [1, -1] as const) {
    const pivot = new THREE.Group();
    pivot.name = `colossus_core_shutter_${side > 0 ? 'L' : 'R'}`;
    pivot.position.set(side * 1.75 * s, -1.45 * s, 6.55 * s);
    body.add(pivot);
    add(
      pivot,
      box(1.85, 2.9, 0.55),
      materials.plate,
      `colossus_core_shutter_plate_${side > 0 ? 'L' : 'R'}`,
      -side * 0.92,
      0,
      0.2
    );
    add(
      pivot,
      box(0.25, 2.6, 0.3),
      materials.crack,
      `colossus_core_shutter_seam_${side > 0 ? 'L' : 'R'}`,
      -side * 1.78,
      0,
      0.42
    );
    coreShutters.push(pivot);
  }

  // ===== 头部（可转动）=====
  const head = new THREE.Group();
  head.name = 'colossus_head';
  head.position.set(0, 0.9 * s, 5.4 * s);
  body.add(head);
  const headShell = add(
    head,
    box(3.9, 2.5, 3.4),
    materials.plate,
    'colossus_head_shell',
    0,
    0.2,
    1.5,
    { x: 0.08 },
    2.4
  );
  add(head, box(4.3, 0.85, 2.7), materials.basalt, 'colossus_jaw', 0, -0.95, 1.9, { x: -0.22 });
  add(head, box(4.5, 0.75, 1.3), materials.basalt, 'colossus_brow', 0, 1.45, 2.6, { x: 0.32 });
  const visor = add(
    head,
    box(3.1, 0.42, 0.34),
    materials.visor,
    'colossus_visor',
    0,
    0.55,
    3.25,
    {},
    1.3
  );
  visor.castShadow = false;
  const visorGlows: THREE.Sprite[] = [];
  for (const side of [1, -1]) {
    const glow = createGlowSprite(0xff4a1c, 2.6 * s, 0.85);
    glow.name = `colossus_visor_glow_${side > 0 ? 'L' : 'R'}`;
    glow.position.set(side * 1.15 * s, 0.55 * s, 3.5 * s);
    head.add(glow);
    visorGlows.push(glow);
    add(
      head,
      new THREE.ConeGeometry(0.42 * s, 2.8 * s, 5),
      materials.basalt,
      `colossus_horn_${side > 0 ? 'L' : 'R'}`,
      side * 1.65,
      1.9,
      0.6,
      {
        x: -0.75,
        z: -side * 0.45,
      }
    );
  }
  // 獠牙与熔岩涎：上下颚交错的玄武岩齿 + 齿间垂落的熔流；两对后掠角
  const teethGeometries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.62;
    teethGeometries.push(
      placed(new THREE.ConeGeometry(0.2 * s, 0.85 * s, 4), x * s, -0.42 * s, 3.18 * s, Math.PI)
    );
    teethGeometries.push(
      placed(
        new THREE.ConeGeometry(0.18 * s, 0.7 * s, 4),
        (x + 0.31) * s,
        -1.0 * s,
        3.05 * s,
        -0.25
      )
    );
  }
  for (const side of [1, -1]) {
    teethGeometries.push(
      placed(
        new THREE.ConeGeometry(0.38 * s, 3.2 * s, 5),
        side * 2.0 * s,
        1.0 * s,
        -0.3 * s,
        -1.25,
        0,
        -side * 0.55
      )
    );
  }
  const teeth = mergeInto(teethGeometries, materials.plate, 'colossus_teeth');
  teeth.castShadow = true;
  head.add(teeth);
  const droolGeometries: THREE.BufferGeometry[] = [];
  for (const x of [-0.95, 0.15, 1.05]) {
    droolGeometries.push(placed(box(0.14, 0.75, 0.14), x * s, -0.7 * s, 3.0 * s));
  }
  const drool = mergeInto(droolGeometries, materials.crack, 'colossus_magma_drool');
  drool.castShadow = false;
  head.add(drool);

  const cannonMuzzles: THREE.Object3D[] = [];
  for (const side of [1, -1]) {
    add(
      head,
      new THREE.CylinderGeometry(0.33 * s, 0.42 * s, 3.4 * s, 10),
      materials.metal,
      `colossus_cannon_barrel_${side > 0 ? 'L' : 'R'}`,
      side * 1.25,
      -0.55,
      3.3,
      {
        x: Math.PI / 2,
      }
    );
    const muzzle = add(
      head,
      new THREE.SphereGeometry(0.3 * s, 10, 8),
      materials.cannonMuzzle,
      `colossus_cannon_muzzle_${side > 0 ? 'L' : 'R'}`,
      side * 1.25,
      -0.55,
      5.05
    );
    muzzle.castShadow = false;
    cannonMuzzles.push(muzzle);
  }

  // ===== 双肩迫击炮组 =====
  const mortarHousings: THREE.Mesh[] = [];
  const mortarMuzzles: THREE.Object3D[] = [];
  for (const side of [1, -1] as const) {
    const housing = add(
      body,
      box(2.6, 1.7, 3.0),
      materials.metal,
      `colossus_mortar_${side > 0 ? 'L' : 'R'}`,
      side * 4.35,
      3.25,
      2.9,
      { y: side * 0.12 },
      2.0
    );
    mortarHousings.push(housing);
    for (let i = 0; i < 3; i++) {
      const tube = add(
        housing,
        new THREE.CylinderGeometry(0.36 * s, 0.42 * s, 2.5 * s, 10),
        materials.basalt,
        `colossus_mortar_tube_${side > 0 ? 'L' : 'R'}_${i}`,
        (i - 1) * 0.78,
        1.3,
        0.2,
        { x: 0.5 }
      );
      const muzzle = add(
        tube,
        new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.12 * s, 10),
        materials.mortarMuzzle,
        `colossus_mortar_muzzle_${side > 0 ? 'L' : 'R'}_${i}`,
        0,
        1.26,
        0
      );
      muzzle.castShadow = false;
      mortarMuzzles.push(muzzle);
    }
  }

  // ===== 背部散热口（子目标）+ 可炸飞装甲板 =====
  const vents: ColossusVentRig[] = [];
  const ventSpots: Array<[number, number, number]> = [
    [2.35, 3.42, -0.7],
    [-2.35, 3.42, -0.7],
    [2.3, 3.12, -4.4],
    [-2.3, 3.12, -4.4],
  ];
  ventSpots.forEach(([x, y, z], index) => {
    const ventGroup = new THREE.Group();
    ventGroup.name = `colossus_vent_${index}`;
    ventGroup.position.set(x * s, y * s, z * s);
    ventGroup.rotation.x = z < -2 ? 0.12 : 0;
    body.add(ventGroup);
    add(ventGroup, box(2.7, 0.5, 2.6), materials.metal, `colossus_vent_frame_${index}`, 0, 0, 0);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a0800,
      roughness: 0.45,
      metalness: 0.1,
      emissive: 0xff6a1a,
      emissiveIntensity: 0.45,
    });
    const core = add(
      ventGroup,
      box(2.25, 0.3, 2.15),
      coreMaterial,
      `colossus_vent_core_${index}`,
      0,
      0.12,
      0,
      {},
      1.7
    );
    core.castShadow = false;
    const slats: THREE.Group[] = [];
    for (let i = 0; i < 5; i++) {
      const pivot = new THREE.Group();
      pivot.name = `colossus_vent_${index}_slat_${i}`;
      pivot.position.set(0, 0.36 * s, (i - 2) * 0.43 * s);
      ventGroup.add(pivot);
      add(
        pivot,
        box(2.3, 0.1, 0.42),
        materials.plate,
        `colossus_vent_${index}_slat_plate_${i}`,
        0,
        0,
        0
      );
      slats.push(pivot);
    }
    const heat = createGlowSprite(0xff7a28, 4.2 * s, 0.0);
    heat.name = `colossus_vent_heat_${index}`;
    heat.position.set(0, 1.4 * s, 0);
    ventGroup.add(heat);
    const side = x > 0 ? 1 : -1;
    const plate = add(
      body,
      box(2.1, 0.7, 2.3),
      materials.plate,
      `colossus_breakaway_plate_${index}`,
      side * 4.15,
      y - 0.15,
      z,
      {
        z: side * -0.28,
      }
    );
    const magmaPatch = add(
      body,
      box(1.8, 0.3, 2.0),
      materials.crack,
      `colossus_magma_patch_${index}`,
      side * 4.0,
      y - 0.35,
      z,
      {
        z: side * -0.28,
      }
    );
    magmaPatch.visible = false;
    magmaPatch.castShadow = false;
    vents.push({ index, group: ventGroup, core, coreMaterial, slats, heat, plate, magmaPatch });
  });

  // ===== 脊背导弹井 + 尾部烟囱 =====
  add(body, box(1.6, 1.3, 5.4), materials.metal, 'colossus_missile_spine', 0, 3.55, -2.6);
  const missileCells: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const cell = add(
      body,
      new THREE.CylinderGeometry(0.38 * s, 0.38 * s, 0.3 * s, 10),
      materials.missileCell,
      `colossus_missile_cell_${i}`,
      0,
      4.28,
      -0.7 - i * 1.3
    );
    cell.castShadow = false;
    missileCells.push(cell);
  }
  const chimneyTops: THREE.Object3D[] = [];
  const chimneyGlows: THREE.Sprite[] = [];
  for (const side of [1, 0, -1]) {
    const chimney = add(
      body,
      new THREE.CylinderGeometry(
        (side === 0 ? 0.8 : 0.6) * s,
        (side === 0 ? 1.15 : 0.85) * s,
        (side === 0 ? 4.6 : 3.4) * s,
        7
      ),
      materials.basalt,
      `colossus_chimney_${side > 0 ? 'L' : side < 0 ? 'R' : 'C'}`,
      side * 2.0,
      side === 0 ? 4.3 : 3.7,
      side === 0 ? -6.0 : -6.6,
      {
        x: -0.5,
        z: -side * 0.25,
      }
    );
    const top = new THREE.Object3D();
    top.name = `colossus_chimney_top_${side > 0 ? 'L' : side < 0 ? 'R' : 'C'}`;
    top.position.set(0, (side === 0 ? 2.4 : 1.8) * s, 0);
    chimney.add(top);
    chimneyTops.push(top);
    add(
      chimney,
      new THREE.TorusGeometry((side === 0 ? 0.82 : 0.62) * s, 0.12 * s, 5, 14),
      materials.crack,
      `colossus_chimney_rim_${side > 0 ? 'L' : side < 0 ? 'R' : 'C'}`,
      0,
      side === 0 ? 2.3 : 1.7,
      0,
      { x: Math.PI / 2 }
    ).castShadow = false;
    const glow = createGlowSprite(0xff6a1c, (side === 0 ? 3.4 : 2.6) * s, 0.75, 'fire');
    glow.position.copy(top.position);
    chimney.add(glow);
    chimneyGlows.push(glow);
  }

  // ===== 四条腿 =====
  const legs: ColossusLegRig[] = [];
  const legDefs: Array<{ id: ColossusLegId; side: 1 | -1; front: boolean }> = [
    { id: 'FL', side: 1, front: true },
    { id: 'FR', side: -1, front: true },
    { id: 'BL', side: 1, front: false },
    { id: 'BR', side: -1, front: false },
  ];
  const legsRoot = new THREE.Group();
  legsRoot.name = 'colossus_legs';
  group.add(legsRoot);
  for (const def of legDefs) {
    const zSign = def.front ? 1 : -1;
    const upper = LEG_UPPER * s;
    const lower = LEG_LOWER * s;
    const hip = add(
      legsRoot,
      new THREE.IcosahedronGeometry(1.45 * s, 1),
      materials.metal,
      `colossus_hip_${def.id}`,
      0,
      0,
      0
    );

    const thigh = new THREE.Group();
    thigh.name = `colossus_thigh_${def.id}`;
    legsRoot.add(thigh);
    const thighCore = add(
      thigh,
      box(1.6, LEG_UPPER, 1.7),
      materials.basalt,
      `colossus_thigh_core_${def.id}`,
      0,
      LEG_UPPER * 0.5,
      0,
      {},
      2.3
    );
    add(
      thigh,
      box(0.55, LEG_UPPER * 0.82, 2.1),
      materials.plate,
      `colossus_thigh_plate_${def.id}`,
      -0.95,
      LEG_UPPER * 0.5,
      0
    );
    add(
      thigh,
      box(0.2, LEG_UPPER * 0.7, 0.3),
      materials.crack,
      `colossus_thigh_seam_${def.id}`,
      0.86,
      LEG_UPPER * 0.5,
      0
    );

    const knee = new THREE.Group();
    knee.name = `colossus_knee_${def.id}`;
    legsRoot.add(knee);
    add(
      knee,
      new THREE.IcosahedronGeometry(1.3 * s, 1),
      materials.metal,
      `colossus_knee_ball_${def.id}`,
      0,
      0,
      0
    );
    const kneeRing = add(
      knee,
      new THREE.TorusGeometry(1.3 * s, 0.2 * s, 6, 18),
      materials.kneeGlow,
      `colossus_knee_glow_${def.id}`,
      0,
      0,
      0
    );
    kneeRing.castShadow = false;

    const shin = new THREE.Group();
    shin.name = `colossus_shin_${def.id}`;
    legsRoot.add(shin);
    const shinCore = add(
      shin,
      new THREE.CylinderGeometry(0.62 * s, 1.0 * s, LEG_LOWER * s, 8),
      materials.basalt,
      `colossus_shin_core_${def.id}`,
      0,
      LEG_LOWER * 0.5,
      0,
      {},
      2.6
    );
    add(
      shin,
      box(0.6, LEG_LOWER * 0.8, 1.5),
      materials.plate,
      `colossus_shin_plate_${def.id}`,
      -0.85,
      LEG_LOWER * 0.45,
      0
    );
    add(
      shin,
      new THREE.CylinderGeometry(0.2 * s, 0.2 * s, LEG_LOWER * 0.6 * s, 6),
      materials.metal,
      `colossus_shin_rod_${def.id}`,
      0.95,
      LEG_LOWER * 0.45,
      0
    );
    add(
      shin,
      box(0.2, LEG_LOWER * 0.5, 0.3),
      materials.crack,
      `colossus_shin_seam_${def.id}`,
      0.7,
      LEG_LOWER * 0.35,
      0.55
    );

    // 腿部玄武岩甲块（外侧）与膝盖尖刺：让细长的腿在近处也有岩石质感
    const thighRocks = mergeInto(
      [
        placed(
          new THREE.DodecahedronGeometry(1.0 * s, 0),
          -0.95 * s,
          LEG_UPPER * 0.32 * s,
          0.2 * s,
          0.3,
          0.6,
          0,
          0.8,
          1.5,
          1.1
        ),
        placed(
          new THREE.DodecahedronGeometry(0.9 * s, 0),
          -0.9 * s,
          LEG_UPPER * 0.72 * s,
          -0.25 * s,
          -0.2,
          1.1,
          0,
          0.75,
          1.3,
          1.0
        ),
      ],
      materials.plate,
      `colossus_thigh_rocks_${def.id}`
    );
    thighRocks.castShadow = true;
    thigh.add(thighRocks);
    const shinRocks = mergeInto(
      [
        placed(
          new THREE.DodecahedronGeometry(1.05 * s, 0),
          -0.85 * s,
          LEG_LOWER * 0.18 * s,
          0.15 * s,
          0.2,
          0.4,
          0,
          0.8,
          1.7,
          1.1
        ),
        placed(
          new THREE.DodecahedronGeometry(0.95 * s, 0),
          -0.8 * s,
          LEG_LOWER * 0.46 * s,
          -0.2 * s,
          -0.3,
          1.3,
          0,
          0.75,
          1.6,
          1.0
        ),
        placed(
          new THREE.DodecahedronGeometry(0.8 * s, 0),
          -0.7 * s,
          LEG_LOWER * 0.7 * s,
          0.1 * s,
          0.1,
          2.1,
          0,
          0.7,
          1.4,
          0.9
        ),
      ],
      materials.plate,
      `colossus_shin_rocks_${def.id}`
    );
    shinRocks.castShadow = true;
    shin.add(shinRocks);
    add(
      knee,
      new THREE.ConeGeometry(0.55 * s, 2.4 * s, 5),
      materials.basalt,
      `colossus_knee_spike_${def.id}`,
      -1.6,
      0.3,
      0,
      {
        z: Math.PI / 2 + 0.35,
      }
    );

    const foot = new THREE.Group();
    foot.name = `colossus_foot_${def.id}`;
    legsRoot.add(foot);
    add(
      foot,
      new THREE.CylinderGeometry(1.7 * s, 2.1 * s, 0.9 * s, 8),
      materials.basalt,
      `colossus_foot_pad_${def.id}`,
      0,
      0.45,
      0
    );
    const footGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a0800,
      roughness: 0.5,
      metalness: 0.1,
      emissive: 0xff5a14,
      emissiveIntensity: 0.22,
    });
    const footRing = add(
      foot,
      new THREE.TorusGeometry(1.5 * s, 0.13 * s, 6, 20),
      footGlowMaterial,
      `colossus_foot_glow_${def.id}`,
      0,
      0.95,
      0,
      {
        x: Math.PI / 2,
      }
    );
    footRing.castShadow = false;
    for (let c = 0; c < 3; c++) {
      const angle = (c - 1) * 0.65;
      add(
        foot,
        new THREE.ConeGeometry(0.42 * s, 2.0 * s, 5),
        materials.plate,
        `colossus_foot_claw_${def.id}_${c}`,
        Math.sin(angle) * 2.0 * def.side,
        0.35,
        Math.cos(angle) * 2.0 * zSign,
        {
          x: zSign * (Math.PI / 2 + 0.25),
          z: -Math.sin(angle) * 0.9 * def.side,
        }
      );
    }

    const pistonGeometry = new THREE.CylinderGeometry(0.32 * s, 0.4 * s, 1, 8);
    pistonGeometry.translate(0, 0.5, 0);
    const piston = add(
      legsRoot,
      pistonGeometry,
      materials.metal,
      `colossus_piston_${def.id}`,
      0,
      0,
      0
    );

    legs.push({
      id: def.id,
      side: def.side,
      front: def.front,
      hipOffset: new THREE.Vector3(def.side * HIP_X * s, HIP_Y * s, zSign * HIP_Z * s),
      homeOffset: new THREE.Vector3(def.side * HOME_X * s, 0, zSign * HOME_Z * s),
      pistonAnchor: new THREE.Vector3(
        def.side * (HIP_X - 0.9) * s,
        (HIP_Y + 2.2) * s,
        zSign * (HIP_Z - 1.4) * s
      ),
      upperLength: upper,
      lowerLength: lower,
      hip,
      thigh,
      thighCore,
      knee,
      shin,
      shinCore,
      foot,
      footGlowMaterial,
      piston,
    });
  }

  const rig: MagmaColossusRig = {
    scale: s,
    body,
    bodyHeight: BODY_HEIGHT * s,
    head,
    visor,
    visorGlows,
    coreMesh,
    coreGlow,
    coreShutters,
    vents,
    mortarHousings,
    mortarMuzzles,
    cannonMuzzles,
    missileCells,
    chimneyTops,
    chimneyGlows,
    hull,
    carapace,
    headShell,
    legs,
    materials,
  };
  group.colossusRig = rig;
  group.bossParts = parts;
  poseColossusStanding(rig);
  return group;
}

const standHip = new THREE.Vector3();
const standFoot = new THREE.Vector3();
const standAnchor = new THREE.Vector3();
const standPole = new THREE.Vector3();

/** 默认站姿：足端落在基准点（预览 / 首帧使用） */
export function poseColossusStanding(rig: MagmaColossusRig): void {
  rig.body.updateMatrix();
  for (const leg of rig.legs) {
    standHip.copy(leg.hipOffset).applyMatrix4(rig.body.matrix);
    standAnchor.copy(leg.pistonAnchor).applyMatrix4(rig.body.matrix);
    standFoot.copy(leg.homeOffset);
    leg.foot.position.copy(standFoot);
    solveColossusLeg(leg, standHip, standFoot, getColossusLegPole(leg, standPole), standAnchor);
  }
}
