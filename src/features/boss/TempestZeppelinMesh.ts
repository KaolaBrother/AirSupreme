import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BossConfig } from './BossTypes';
import { createGlowSprite } from './MagmaColossusHazards';

/**
 * 第八关 Boss「雷霆飞艇」模型：铆接装甲的硬式飞艇 + 特斯拉线圈 + 发光气囊。
 *
 * 朝向：艇艏 +Z，上方向 +Y，左舷 +X；根节点原点位于艇体轴线中点。
 * bow / stern 两段在 BREAK_Z 处分开（死亡时“折断脊梁”）。
 * - 艇体：两段车削装甲壳（顶点色涂装：拼板明暗、背脊走道、艏部警示色）+ 铜质环形龙骨 +
 *   纵向桁条 + 两侧青色电光带。
 * - 气囊（子目标）：左右舷各 3 个外凸的琥珀色发光气囊，外罩铜箍；被击破后泄气起火。
 * - 特斯拉线圈 4 座：背部前后各一（向上）、腹部艏艉各一（向下）；顶端放电球为充能弱点。
 * - 吊舱：流线型指挥吊舱（暖色舷窗）、两座下颚炮塔；尾部无人机舱（两扇舱门 + 琥珀信标）。
 * - 背部前后两座炮塔、背脊 4 个导弹井、4 台带发光涵道的螺旋桨引擎、十字尾翼与避雷针。
 * - 腹部风暴核心（第三阶段炸飞两块龙骨装甲后暴露）。
 *
 * 尺寸以设计单位书写，乘以 config.scale（默认 6）得到米（艇长约 195 米）。
 */

export type ZeppelinSection = 'bow' | 'stern';

export interface ZeppelinCellRig {
  index: number;
  /** +1：左舷（+X）；-1：右舷（-X） */
  side: 1 | -1;
  section: ZeppelinSection;
  /** 沿艇体轴向的位置（米，用于计算俯仰配平） */
  z: number;
  /** 子目标 / 碰撞部件 */
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  /** 破裂后喷出的火焰（默认隐藏） */
  fire: THREE.Sprite;
  baseScale: THREE.Vector3;
}

export interface ZeppelinCoilRig {
  index: number;
  /** true：背部（向上放电）；false：腹部（向下） */
  dorsal: boolean;
  /** 放电球：充能时为弱点（碰撞部件） */
  cap: THREE.Mesh;
  capMaterial: THREE.MeshStandardMaterial;
  ringMaterial: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  /** 闪电起点（放电球外侧） */
  tip: THREE.Object3D;
  /** 线圈环位置（充能时环间爬电） */
  rings: THREE.Object3D[];
}

export interface ZeppelinEngineRig {
  index: number;
  /** 碰撞锚点（引擎舱中心） */
  nacelle: THREE.Mesh;
  prop: THREE.Group;
  exhaust: THREE.Sprite;
}

export interface ZeppelinTurretRig {
  index: number;
  yaw: THREE.Group;
  muzzles: THREE.Object3D[];
  /** 炮塔朝外的法线（局部，+Y 背部 / -Y 下颚） */
  outward: THREE.Vector3;
}

export interface ZeppelinHangarRig {
  /** 舱内发光甲板：开舱时为弱点（子目标 / 碰撞部件） */
  interior: THREE.Mesh;
  interiorMaterial: THREE.MeshStandardMaterial;
  doors: THREE.Group[];
  beacons: THREE.Sprite[];
  beaconMaterial: THREE.MeshStandardMaterial;
  launchPoint: THREE.Object3D;
}

export interface TempestZeppelinMaterials {
  envelope: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  stringer: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  gondola: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
  glowStrip: THREE.MeshStandardMaterial;
  cage: THREE.MeshStandardMaterial;
  coilBody: THREE.MeshStandardMaterial;
  fin: THREE.MeshStandardMaterial;
  rodTip: THREE.MeshStandardMaterial;
  missileCell: THREE.MeshStandardMaterial;
  engineRing: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  keelPlate: THREE.MeshStandardMaterial;
  navLights: THREE.MeshBasicMaterial;
}

export interface TempestZeppelinRig {
  scale: number;
  bow: THREE.Group;
  stern: THREE.Group;
  cells: ZeppelinCellRig[];
  coils: ZeppelinCoilRig[];
  engines: ZeppelinEngineRig[];
  turrets: ZeppelinTurretRig[];
  hangar: ZeppelinHangarRig;
  gondola: THREE.Mesh;
  core: THREE.Mesh;
  coreGlow: THREE.Sprite;
  keelPlates: THREE.Mesh[];
  missileCells: THREE.Object3D[];
  navLights: THREE.Mesh;
  /** 不可见的艇体碰撞锚点（艏 → 艉） */
  hullAnchors: THREE.Object3D[];
  /** 艇长的一半（米） */
  halfLength: number;
  /** 最大艇体半径（米） */
  hullRadius: number;
  /** 原点到最低点（吊舱底）的距离（米，正数） */
  bottomOffset: number;
  /** 断裂面（米） */
  breakZ: number;
  materials: TempestZeppelinMaterials;
}

export type TempestZeppelinGroup = THREE.Group & { zeppelinRig?: TempestZeppelinRig };

/** 艇体纵剖面（半径, 轴向 z），设计单位，艉 → 艏 */
const HULL_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0, -16.4],
  [0.7, -16.0],
  [1.5, -15.0],
  [2.3, -13.4],
  [3.1, -11.2],
  [3.75, -8.6],
  [4.25, -5.6],
  [4.55, -2.4],
  [4.62, 0.6],
  [4.55, 3.6],
  [4.3, 6.6],
  [3.85, 9.4],
  [3.15, 11.9],
  [2.2, 14.0],
  [1.15, 15.4],
  [0.35, 16.1],
  [0.0, 16.3],
];
const BREAK_Z = -2.0;
const FRAME_ZS: readonly number[] = [-13.4, -11.2, -8.6, -5.6, 0.6, 3.6, 6.6, 9.4, 11.9, 14.0];
const STRINGER_ANGLES: readonly number[] = [
  Math.PI / 2,
  0.42,
  Math.PI - 0.42,
  -0.42,
  -(Math.PI - 0.42),
  -Math.PI / 2,
];
const GONDOLA_Y = -6.35;
const GONDOLA_Z = 1.0;
const GONDOLA_HALF_HEIGHT = 1.125;

/** 设计单位下的艇体半径 */
export function zeppelinHullRadiusAt(z: number): number {
  if (z <= HULL_PROFILE[0][1]) return HULL_PROFILE[0][0];
  for (let i = 1; i < HULL_PROFILE.length; i++) {
    const [r1, z1] = HULL_PROFILE[i];
    if (z <= z1) {
      const [r0, z0] = HULL_PROFILE[i - 1];
      const t = (z - z0) / Math.max(1e-6, z1 - z0);
      return r0 + (r1 - r0) * t;
    }
  }
  return HULL_PROFILE[HULL_PROFILE.length - 1][0];
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

/** 两点之间的细长方杆（沿 a → b），设计单位 */
function strut(
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number,
  depth: number,
  s: number
): THREE.BufferGeometry {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = Math.max(1e-3, direction.length());
  const geometry = new THREE.BoxGeometry(width * s, length * s, depth * s).toNonIndexed();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.divideScalar(length)
  );
  const middle = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5 * s);
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(middle, quaternion, new THREE.Vector3(1, 1, 1))
  );
  return geometry;
}

/** 截取 [zMin, zMax] 内的剖面点（含端点插值） */
function profileSlice(zMin: number, zMax: number): Array<[number, number]> {
  const points: Array<[number, number]> = [[zeppelinHullRadiusAt(zMin), zMin]];
  for (const [r, z] of HULL_PROFILE) {
    if (z > zMin + 1e-4 && z < zMax - 1e-4) points.push([r, z]);
  }
  points.push([zeppelinHullRadiusAt(zMax), zMax]);
  return points;
}

/** 车削艇壳并烘焙顶点色涂装 */
function createEnvelope(zMin: number, zMax: number, s: number): THREE.BufferGeometry {
  const points = profileSlice(zMin, zMax).map(([r, z]) => new THREE.Vector2(r * s, z * s));
  const geometry = new THREE.LatheGeometry(points, 44);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(0x66707e);
  const panelDark = new THREE.Color(0x535c6a);
  const walkway = new THREE.Color(0x8a929e);
  const belly = new THREE.Color(0x3a414b);
  const hazard = new THREE.Color(0x8a2a24);
  const stripe = new THREE.Color(0xe8c870);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / s;
    const y = position.getY(i) / s;
    const z = position.getZ(i) / s;
    const radius = Math.max(1e-3, Math.hypot(x, y));
    const up = y / radius;
    const angle = Math.atan2(y, x);
    // 拼板：沿轴向按龙骨间距、沿周向按 30° 交错明暗
    const bay = Math.floor((z + 20) / 2.9);
    const sector = Math.floor((angle + Math.PI) / (Math.PI / 6));
    color.copy((bay + sector) % 2 === 0 ? base : panelDark);
    if (up > 0.93) color.lerp(walkway, 0.75);
    if (up < -0.7) color.lerp(belly, Math.min(1, (-0.7 - up) / 0.25));
    if (z > 13.2) {
      // 艏部警示色 + 一道琥珀警戒环
      color.lerp(hazard, Math.min(1, (z - 13.2) / 0.8));
      if (z > 13.6 && z < 13.95) color.copy(stripe);
    }
    if (z < -14.6) color.lerp(belly, 0.6);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createTempestZeppelinMaterials(): TempestZeppelinMaterials {
  return {
    envelope: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.18,
      emissive: 0x12243a,
      emissiveIntensity: 0.5,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: 0xc08a52,
      roughness: 0.42,
      metalness: 0.45,
      emissive: 0x4a2208,
      emissiveIntensity: 0.45,
    }),
    stringer: new THREE.MeshStandardMaterial({
      color: 0x444b56,
      roughness: 0.5,
      metalness: 0.35,
      emissive: 0x0c121a,
      emissiveIntensity: 0.35,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x5e6672,
      roughness: 0.45,
      metalness: 0.45,
      emissive: 0x101822,
      emissiveIntensity: 0.4,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x2a2f37,
      roughness: 0.55,
      metalness: 0.35,
      emissive: 0x080b10,
      emissiveIntensity: 0.3,
    }),
    gondola: new THREE.MeshStandardMaterial({
      color: 0x56606c,
      roughness: 0.48,
      metalness: 0.32,
      emissive: 0x101c2c,
      emissiveIntensity: 0.45,
    }),
    window: new THREE.MeshStandardMaterial({
      color: 0x2a1a08,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0xffc878,
      emissiveIntensity: 1.8,
    }),
    glowStrip: new THREE.MeshStandardMaterial({
      color: 0x06202c,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x56c8ff,
      emissiveIntensity: 2.0,
    }),
    cage: new THREE.MeshStandardMaterial({
      color: 0x8a6038,
      roughness: 0.42,
      metalness: 0.5,
      emissive: 0x1a0e04,
      emissiveIntensity: 0.3,
    }),
    coilBody: new THREE.MeshStandardMaterial({
      color: 0xc88a52,
      roughness: 0.36,
      metalness: 0.5,
      emissive: 0x24120a,
      emissiveIntensity: 0.35,
    }),
    fin: new THREE.MeshStandardMaterial({
      color: 0x5a6472,
      roughness: 0.55,
      metalness: 0.28,
      emissive: 0x0a1220,
      emissiveIntensity: 0.4,
    }),
    rodTip: new THREE.MeshStandardMaterial({
      color: 0x0a2030,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x9fdcff,
      emissiveIntensity: 2.2,
    }),
    missileCell: new THREE.MeshStandardMaterial({
      color: 0x2a0a06,
      roughness: 0.45,
      metalness: 0.35,
      emissive: 0xff5a2a,
      emissiveIntensity: 0.6,
    }),
    engineRing: new THREE.MeshStandardMaterial({
      color: 0x062030,
      roughness: 0.35,
      metalness: 0.4,
      emissive: 0x4cd2ff,
      emissiveIntensity: 1.8,
    }),
    core: new THREE.MeshStandardMaterial({
      color: 0x1a0c38,
      roughness: 0.25,
      metalness: 0.1,
      emissive: 0xa48aff,
      emissiveIntensity: 1.2,
    }),
    keelPlate: new THREE.MeshStandardMaterial({
      color: 0x5a636f,
      roughness: 0.5,
      metalness: 0.4,
      emissive: 0x0a1018,
      emissiveIntensity: 0.35,
    }),
    navLights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };
}

/**
 * 创建雷霆飞艇模型。返回的 Group 名为 `BOSS_${config.type}`，
 * 可碰撞部件（userData.hitRadius，米）挂在 group.bossParts，骨架挂在 group.zeppelinRig。
 */
export function createTempestZeppelinMesh(config: BossConfig): THREE.Group {
  const s = Number.isFinite(config.scale) && config.scale > 0 ? config.scale : 6;
  const group = new THREE.Group() as TempestZeppelinGroup & { bossParts?: THREE.Object3D[] };
  group.name = `BOSS_${config.type}`;
  const materials = createTempestZeppelinMaterials();
  const parts: THREE.Object3D[] = [];
  const bow = new THREE.Group();
  bow.name = 'zeppelin_bow_section';
  const stern = new THREE.Group();
  stern.name = 'zeppelin_stern_section';
  group.add(bow, stern);
  const sectionOf = (z: number): THREE.Group => (z >= BREAK_Z ? bow : stern);

  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    x: number,
    y: number,
    z: number,
    hitRadius: number = 0
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x * s, y * s, z * s);
    mesh.castShadow = true;
    parent.add(mesh);
    if (hitRadius > 0) {
      mesh.userData.hitRadius = hitRadius * s;
      parts.push(mesh);
    }
    return mesh;
  };

  // 静态零件按“段 × 材质”合并
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  const bucket = (section: ZeppelinSection, key: string): THREE.BufferGeometry[] => {
    const id = `${section}:${key}`;
    let list = buckets.get(id);
    if (!list) {
      list = [];
      buckets.set(id, list);
    }
    return list;
  };
  const sectionKey = (z: number): ZeppelinSection => (z >= BREAK_Z ? 'bow' : 'stern');

  // ===== 艇壳 =====
  const bowEnvelope = new THREE.Mesh(createEnvelope(BREAK_Z, 16.3, s), materials.envelope);
  bowEnvelope.name = 'zeppelin_envelope_bow';
  bowEnvelope.castShadow = true;
  bow.add(bowEnvelope);
  const sternEnvelope = new THREE.Mesh(createEnvelope(-16.4, BREAK_Z, s), materials.envelope);
  sternEnvelope.name = 'zeppelin_envelope_stern';
  sternEnvelope.castShadow = true;
  stern.add(sternEnvelope);

  // 铜质环形龙骨
  for (const z of FRAME_ZS) {
    const r = zeppelinHullRadiusAt(z) + 0.05;
    bucket(sectionKey(z), 'frame').push(
      placed(new THREE.TorusGeometry(r * s, 0.15 * s, 6, 56), 0, 0, z * s)
    );
  }
  // 纵向桁条 + 电光带：沿剖面逐段铺设
  for (let i = 1; i < HULL_PROFILE.length - 1; i++) {
    const [r0, z0] = HULL_PROFILE[i - 1];
    const [r1, z1] = HULL_PROFILE[i];
    if (r0 < 0.5 || r1 < 0.5) continue;
    for (const angle of STRINGER_ANGLES) {
      const a = new THREE.Vector3(Math.cos(angle) * (r0 + 0.04), Math.sin(angle) * (r0 + 0.04), z0);
      const b = new THREE.Vector3(Math.cos(angle) * (r1 + 0.04), Math.sin(angle) * (r1 + 0.04), z1);
      const mid = (z0 + z1) / 2;
      bucket(sectionKey(mid), 'stringer').push(strut(a, b, 0.16, 0.22, s));
    }
    if (z0 > -12.5 && z1 < 13) {
      for (const side of [1, -1]) {
        const angle = side > 0 ? 0.92 : Math.PI - 0.92;
        const a = new THREE.Vector3(
          Math.cos(angle) * (r0 + 0.06),
          Math.sin(angle) * (r0 + 0.06),
          z0
        );
        const b = new THREE.Vector3(
          Math.cos(angle) * (r1 + 0.06),
          Math.sin(angle) * (r1 + 0.06),
          z1
        );
        const mid = (z0 + z1) / 2;
        bucket(sectionKey(mid), 'glow').push(strut(a, b, 0.1, 0.12, s));
      }
    }
  }

  // ===== 气囊（子目标）=====
  const cells: ZeppelinCellRig[] = [];
  const cellZs = [7.6, 1.2, -5.6];
  let cellIndex = 0;
  for (const side of [1, -1] as const) {
    for (const z of cellZs) {
      const parent = sectionOf(z);
      const r = zeppelinHullRadiusAt(z);
      const material = new THREE.MeshStandardMaterial({
        color: 0x3a1e06,
        roughness: 0.32,
        metalness: 0.05,
        emissive: 0xffa43a,
        emissiveIntensity: 1.5,
      });
      const mesh = add(
        parent,
        new THREE.SphereGeometry(1 * s, 22, 16),
        material,
        `zeppelin_gas_cell_${cellIndex}`,
        side * (r - 0.35),
        0.15,
        z,
        2.5
      );
      mesh.scale.set(1.45, 2.15, 2.55);
      mesh.castShadow = false;
      const glow = createGlowSprite(0xffa040, 7.2 * s, 0.45);
      glow.name = `zeppelin_gas_cell_glow_${cellIndex}`;
      glow.position.set(side * (r + 1.0) * s, 0.15 * s, z * s);
      parent.add(glow);
      const fire = createGlowSprite(0xff6a1c, 5 * s, 0, 'fire');
      fire.name = `zeppelin_gas_cell_fire_${cellIndex}`;
      fire.position.set(side * (r + 1.2) * s, 0.4 * s, z * s);
      fire.visible = false;
      parent.add(fire);
      cells.push({
        index: cellIndex,
        side,
        section: sectionKey(z),
        z: z * s,
        mesh,
        material,
        glow,
        fire,
        baseScale: mesh.scale.clone(),
      });
      cellIndex++;

      // 铜箍：两道半圆箍跨过气囊 + 舱口边框
      const cage = bucket(sectionKey(z), 'cage');
      for (const dz of [-1.15, 1.15]) {
        const hoop = new THREE.TorusGeometry(2.0 * s, 0.11 * s, 5, 18, Math.PI);
        cage.push(
          placed(
            hoop,
            side * (r - 0.35) * s,
            0.15 * s,
            (z + dz) * s,
            0,
            0,
            side > 0 ? -Math.PI / 2 : Math.PI / 2,
            1.12,
            0.8,
            1
          )
        );
      }
      for (const dy of [-2.25, 2.55]) {
        const rimR = zeppelinHullRadiusAt(z) + 0.02;
        const x = Math.sqrt(Math.max(0.1, rimR * rimR - dy * dy));
        cage.push(
          placed(new THREE.BoxGeometry(0.28 * s, 0.28 * s, 5.6 * s), side * x * s, dy * s, z * s)
        );
      }
    }
  }

  // ===== 吊舱 =====
  const gondolaGeometry = new THREE.CapsuleGeometry(1.25 * s, 11.5 * s, 6, 20);
  gondolaGeometry.rotateX(Math.PI / 2);
  const gondola = add(
    bow,
    gondolaGeometry,
    materials.gondola,
    'zeppelin_gondola',
    0,
    GONDOLA_Y,
    GONDOLA_Z,
    3.4
  );
  gondola.scale.set(1.2, 0.9, 1);
  // 舷窗带 + 艏部舰桥窗
  const windows = bucket('bow', 'window');
  for (const side of [1, -1]) {
    windows.push(
      placed(
        new THREE.BoxGeometry(0.08 * s, 0.34 * s, 10.5 * s),
        side * 1.47 * s,
        (GONDOLA_Y + 0.22) * s,
        (GONDOLA_Z + 0.2) * s
      )
    );
  }
  windows.push(
    placed(
      new THREE.CylinderGeometry(1.0 * s, 1.0 * s, 0.42 * s, 20, 1, true, -1.2, 2.4),
      0,
      (GONDOLA_Y + 0.25) * s,
      (GONDOLA_Z + 6.15) * s,
      0,
      0,
      0,
      1.25,
      1,
      0.9
    )
  );
  // 吊舱与艇体之间的撑杆
  const metalBow = bucket('bow', 'metal');
  for (const z of [-3.6, 1.0, 5.4]) {
    for (const side of [1, -1]) {
      const top = new THREE.Vector3(side * 1.4, -zeppelinHullRadiusAt(z) + 0.35, z);
      const bottom = new THREE.Vector3(side * 0.85, GONDOLA_Y + 0.95, z + 0.4);
      metalBow.push(strut(bottom, top, 0.26, 0.4, s));
    }
  }
  // 吊舱龙骨鳍
  metalBow.push(
    placed(
      new THREE.BoxGeometry(0.16 * s, 0.8 * s, 6.5 * s),
      0,
      (GONDOLA_Y - GONDOLA_HALF_HEIGHT - 0.1) * s,
      (GONDOLA_Z + 2.4) * s
    )
  );

  // ===== 炮塔：下颚两座 + 背部前后两座 =====
  const turrets: ZeppelinTurretRig[] = [];
  const turretDefs: Array<{ x: number; y: number; z: number; up: 1 | -1 }> = [
    { x: 0.85, y: GONDOLA_Y - 1.0, z: GONDOLA_Z + 4.6, up: -1 },
    { x: -0.85, y: GONDOLA_Y - 1.0, z: GONDOLA_Z + 4.6, up: -1 },
    { x: 0, y: zeppelinHullRadiusAt(10.4) + 0.1, z: 10.4, up: 1 },
    { x: 0, y: zeppelinHullRadiusAt(-9.4) + 0.1, z: -9.4, up: 1 },
  ];
  turretDefs.forEach((def, index) => {
    const parent = sectionOf(def.z);
    const yaw = new THREE.Group();
    yaw.name = `zeppelin_turret_${index}`;
    yaw.position.set(def.x * s, def.y * s, def.z * s);
    if (def.up < 0) yaw.rotation.z = Math.PI;
    parent.add(yaw);
    const housing: THREE.BufferGeometry[] = [
      placed(new THREE.SphereGeometry(0.62 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0),
      placed(new THREE.CylinderGeometry(0.66 * s, 0.7 * s, 0.22 * s, 14), 0, 0.05 * s, 0),
    ];
    const muzzles: THREE.Object3D[] = [];
    for (const bx of [0.2, -0.2]) {
      housing.push(
        placed(
          new THREE.CylinderGeometry(0.075 * s, 0.09 * s, 1.7 * s, 8),
          bx * s,
          0.3 * s,
          0.95 * s,
          Math.PI / 2
        )
      );
      const muzzle = new THREE.Object3D();
      muzzle.name = `zeppelin_turret_${index}_muzzle`;
      muzzle.position.set(bx * s, 0.3 * s, 1.85 * s);
      yaw.add(muzzle);
      muzzles.push(muzzle);
    }
    const turretMesh = mergeInto(housing, materials.metal, `zeppelin_turret_${index}_housing`);
    turretMesh.castShadow = true;
    yaw.add(turretMesh);
    turrets.push({ index, yaw, muzzles, outward: new THREE.Vector3(0, def.up, 0) });
  });

  // ===== 无人机舱：吊舱尾部下方的开底舱（四面舱壁 + 两扇下翻舱门）=====
  const hangarZ = GONDOLA_Z - 4.7;
  const hangarTop = GONDOLA_Y - GONDOLA_HALF_HEIGHT + 0.2;
  const hangarBottom = GONDOLA_Y - GONDOLA_HALF_HEIGHT - 0.42;
  const hangarHeight = hangarTop - hangarBottom;
  const hangarMid = (hangarTop + hangarBottom) / 2;
  const interiorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1404,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0xff9a2a,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide,
  });
  // 舱顶发光甲板（开舱后从下方可见；弱点 / 子目标）
  const interiorGeometry = new THREE.PlaneGeometry(1.86 * s, 3.86 * s);
  interiorGeometry.rotateX(Math.PI / 2);
  const interior = add(
    bow,
    interiorGeometry,
    interiorMaterial,
    'zeppelin_hangar_interior',
    0,
    hangarBottom + 0.16,
    hangarZ,
    2.3
  );
  interior.castShadow = false;
  const bayWalls = bucket('bow', 'metal');
  for (const side of [1, -1]) {
    bayWalls.push(
      placed(
        new THREE.BoxGeometry(0.12 * s, hangarHeight * s, 4.0 * s),
        side * 1.0 * s,
        hangarMid * s,
        hangarZ * s
      )
    );
    bayWalls.push(
      placed(
        new THREE.BoxGeometry(2.12 * s, hangarHeight * s, 0.12 * s),
        0,
        hangarMid * s,
        (hangarZ + side * 2.0) * s
      )
    );
  }
  // 舱内两道琥珀色引导灯带（开舱时与甲板一起亮起）
  const bayStrips = bucket('bow', 'window');
  for (const side of [1, -1]) {
    bayStrips.push(
      placed(
        new THREE.BoxGeometry(0.06 * s, 0.1 * s, 3.7 * s),
        side * 0.92 * s,
        (hangarBottom + 0.12) * s,
        hangarZ * s
      )
    );
  }
  const doors: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.name = `zeppelin_hangar_door_${side > 0 ? 'L' : 'R'}`;
    pivot.position.set(side * 1.0 * s, (hangarBottom - 0.06) * s, hangarZ * s);
    bow.add(pivot);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.0 * s, 0.12 * s, 3.96 * s),
      materials.keelPlate
    );
    door.name = `zeppelin_hangar_door_plate_${side > 0 ? 'L' : 'R'}`;
    door.position.set(-side * 0.5 * s, 0, 0);
    door.castShadow = true;
    pivot.add(door);
    doors.push(pivot);
  }
  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1604,
    roughness: 0.35,
    metalness: 0.2,
    emissive: 0xffb43a,
    emissiveIntensity: 0.5,
  });
  const beaconGeometries: THREE.BufferGeometry[] = [];
  const beacons: THREE.Sprite[] = [];
  for (const dz of [-2.1, 2.1]) {
    beaconGeometries.push(
      placed(
        new THREE.SphereGeometry(0.18 * s, 8, 6),
        0,
        (hangarBottom - 0.05) * s,
        (hangarZ + dz) * s
      )
    );
    const glow = createGlowSprite(0xffb040, 2.6 * s, 0);
    glow.name = 'zeppelin_hangar_beacon_glow';
    glow.position.set(0, (hangarBottom - 0.15) * s, (hangarZ + dz) * s);
    bow.add(glow);
    beacons.push(glow);
  }
  const beaconMesh = mergeInto(beaconGeometries, beaconMaterial, 'zeppelin_hangar_beacons');
  beaconMesh.castShadow = false;
  bow.add(beaconMesh);
  const launchPoint = new THREE.Object3D();
  launchPoint.name = 'zeppelin_hangar_launch';
  launchPoint.position.set(0, (hangarBottom - 1.8) * s, hangarZ * s);
  bow.add(launchPoint);

  // ===== 特斯拉线圈 =====
  const coils: ZeppelinCoilRig[] = [];
  const coilDefs: Array<{ z: number; dorsal: boolean }> = [
    { z: 5.6, dorsal: true },
    { z: -5.0, dorsal: true },
    { z: 11.2, dorsal: false },
    { z: -11.8, dorsal: false },
  ];
  coilDefs.forEach((def, index) => {
    const parent = sectionOf(def.z);
    const dir = def.dorsal ? 1 : -1;
    const baseY = dir * (zeppelinHullRadiusAt(def.z) - 0.1);
    const body = bucket(sectionKey(def.z), 'coil');
    const at = (offset: number): number => (baseY + dir * offset) * s;
    body.push(
      placed(new THREE.CylinderGeometry(0.85 * s, 1.05 * s, 0.6 * s, 10), 0, at(0.2), def.z * s)
    );
    body.push(
      placed(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 3.4 * s, 10), 0, at(2.0), def.z * s)
    );
    body.push(
      placed(new THREE.TorusGeometry(0.95 * s, 0.3 * s, 10, 24), 0, at(3.6), def.z * s, Math.PI / 2)
    );
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a2232,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x6fcaff,
      emissiveIntensity: 0.6,
    });
    const ringGeometries: THREE.BufferGeometry[] = [];
    const rings: THREE.Object3D[] = [];
    [0.95, 1.6, 2.25, 2.9].forEach((offset, k) => {
      const radius = 0.62 - k * 0.06;
      ringGeometries.push(
        placed(
          new THREE.TorusGeometry(radius * s, 0.085 * s, 6, 20),
          0,
          at(offset),
          def.z * s,
          Math.PI / 2
        )
      );
      const anchor = new THREE.Object3D();
      anchor.name = `zeppelin_coil_${index}_ring_${k}`;
      anchor.position.set(radius * s, at(offset), def.z * s);
      parent.add(anchor);
      rings.push(anchor);
    });
    const ringMesh = mergeInto(ringGeometries, ringMaterial, `zeppelin_coil_${index}_rings`);
    ringMesh.castShadow = false;
    parent.add(ringMesh);
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1a28,
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0xbfe6ff,
      emissiveIntensity: 0.8,
    });
    const cap = add(
      parent,
      new THREE.SphereGeometry(0.62 * s, 18, 12),
      capMaterial,
      `zeppelin_coil_${index}_cap`,
      0,
      baseY + dir * 4.25,
      def.z,
      1.4
    );
    cap.castShadow = false;
    const glow = createGlowSprite(0x8fd4ff, 4 * s, 0.35);
    glow.name = `zeppelin_coil_${index}_glow`;
    glow.position.copy(cap.position);
    parent.add(glow);
    const tip = new THREE.Object3D();
    tip.name = `zeppelin_coil_${index}_tip`;
    tip.position.set(0, at(4.9), def.z * s);
    parent.add(tip);
    coils.push({ index, dorsal: def.dorsal, cap, capMaterial, ringMaterial, glow, tip, rings });
  });

  // ===== 引擎 =====
  const engines: ZeppelinEngineRig[] = [];
  const engineDefs: Array<{ z: number; side: 1 | -1 }> = [
    { z: 4.4, side: 1 },
    { z: 4.4, side: -1 },
    { z: -8.8, side: 1 },
    { z: -8.8, side: -1 },
  ];
  engineDefs.forEach((def, index) => {
    const parent = sectionOf(def.z);
    const key = sectionKey(def.z);
    const r = zeppelinHullRadiusAt(def.z);
    const x = def.side * (r + 2.5);
    const y = -2.5;
    const hullX = Math.sqrt(Math.max(0.1, r * r - 2.2 * 2.2));
    const pylonFrom = new THREE.Vector3(def.side * (hullX - 0.2), -2.2, def.z);
    const pylonTo = new THREE.Vector3(x - def.side * 0.4, y, def.z);
    bucket(key, 'metal').push(strut(pylonFrom, pylonTo, 0.36, 1.3, s));
    const nacelleGeometry = new THREE.CapsuleGeometry(0.72 * s, 2.5 * s, 5, 14);
    nacelleGeometry.rotateX(Math.PI / 2);
    const nacelle = add(
      parent,
      nacelleGeometry,
      materials.gondola,
      `zeppelin_engine_${index}`,
      x,
      y,
      def.z,
      1.7
    );
    const ring = placed(
      new THREE.TorusGeometry(1.7 * s, 0.12 * s, 6, 28),
      x * s,
      y * s,
      (def.z - 2.0) * s
    );
    bucket(key, 'engineRing').push(ring);
    bucket(key, 'dark').push(
      placed(new THREE.TorusGeometry(1.72 * s, 0.22 * s, 6, 28), x * s, y * s, (def.z - 1.75) * s)
    );
    const prop = new THREE.Group();
    prop.name = `zeppelin_engine_${index}_prop`;
    prop.position.set(x * s, y * s, (def.z - 2.05) * s);
    parent.add(prop);
    const blades: THREE.BufferGeometry[] = [
      placed(new THREE.ConeGeometry(0.34 * s, 0.9 * s, 10), 0, 0, -0.3 * s, -Math.PI / 2),
    ];
    for (let b = 0; b < 4; b++) {
      const angle = (b * Math.PI) / 2;
      // 先绕桨叶自身长轴扭转，再转到对应方位
      const blade = new THREE.BoxGeometry(0.3 * s, 1.5 * s, 0.07 * s).toNonIndexed();
      blade.rotateY(0.45);
      blade.rotateZ(-angle);
      blade.translate(Math.sin(angle) * 0.8 * s, Math.cos(angle) * 0.8 * s, 0);
      blades.push(blade);
    }
    const propMesh = mergeInto(blades, materials.dark, `zeppelin_engine_${index}_blades`);
    prop.add(propMesh);
    const exhaust = createGlowSprite(0x6fd8ff, 3.4 * s, 0.4);
    exhaust.name = `zeppelin_engine_${index}_exhaust`;
    exhaust.position.set(x * s, y * s, (def.z - 2.6) * s);
    parent.add(exhaust);
    engines.push({ index, nacelle, prop, exhaust });
  });

  // ===== 十字尾翼 + 避雷针 =====
  const finShape = new THREE.Shape();
  // 翼根向下延伸 1 个单位埋进收窄的艉部，避免翼根与艇壳之间露缝
  finShape.moveTo(0, -1.0);
  finShape.lineTo(4.4, -1.0);
  finShape.lineTo(3.2, 3.6);
  finShape.lineTo(1.4, 3.6);
  finShape.lineTo(0, -1.0);
  const finGeometry = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  // 形状平面 (x→弦向 z, y→展向)；挤出沿 z → 厚度沿 x
  finGeometry.translate(0, 0, -0.12);
  finGeometry.rotateY(-Math.PI / 2);
  finGeometry.scale(s, s, s);
  const rodTips = bucket('stern', 'rodTip');
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2;
    const rootZ = -15.3;
    const rootR = zeppelinHullRadiusAt(-13.4) - 0.25;
    const geometry = finGeometry.clone();
    // 先绕 z 轴转到对应象限，再放到艇体表面
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(
        Math.cos(angle + Math.PI / 2) * rootR * s,
        Math.sin(angle + Math.PI / 2) * rootR * s,
        rootZ * s
      ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle)),
      new THREE.Vector3(1, 1, 1)
    );
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
    if (prepared !== geometry) geometry.dispose();
    prepared.applyMatrix4(matrix);
    bucket('stern', 'fin').push(prepared);
    const tipR = rootR + 3.6;
    const tipX = Math.cos(angle + Math.PI / 2) * tipR;
    const tipY = Math.sin(angle + Math.PI / 2) * tipR;
    bucket('stern', 'metal').push(
      placed(
        new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 2.6 * s, 6),
        tipX * s,
        tipY * s,
        (rootZ - 0.2) * s,
        Math.PI / 2
      )
    );
    rodTips.push(
      placed(new THREE.SphereGeometry(0.2 * s, 8, 6), tipX * s, tipY * s, (rootZ - 1.55) * s)
    );
  }
  finGeometry.dispose();
  // 背脊避雷针
  for (const z of [13.2, 9.0, -8.2, -12.0]) {
    const key = sectionKey(z);
    const y = zeppelinHullRadiusAt(z);
    bucket(key, 'metal').push(
      placed(new THREE.CylinderGeometry(0.05 * s, 0.14 * s, 2.2 * s, 6), 0, (y + 1.05) * s, z * s)
    );
    bucket(key, 'rodTip').push(
      placed(new THREE.SphereGeometry(0.17 * s, 8, 6), 0, (y + 2.2) * s, z * s)
    );
  }

  // ===== 背部导弹井 =====
  const missileCells: THREE.Object3D[] = [];
  for (const z of [2.6, 0.9]) {
    for (const side of [1, -1]) {
      const y = zeppelinHullRadiusAt(z) - 0.02;
      bucket('bow', 'missile').push(
        placed(new THREE.BoxGeometry(0.85 * s, 0.14 * s, 0.85 * s), side * 0.75 * s, y * s, z * s)
      );
      bucket('bow', 'metal').push(
        placed(
          new THREE.BoxGeometry(1.05 * s, 0.1 * s, 1.05 * s),
          side * 0.75 * s,
          (y - 0.04) * s,
          z * s
        )
      );
      const anchor = new THREE.Object3D();
      anchor.name = 'zeppelin_missile_cell';
      anchor.position.set(side * 0.75 * s, (y + 1.6) * s, z * s);
      bow.add(anchor);
      missileCells.push(anchor);
    }
  }

  // ===== 风暴核心 + 龙骨装甲 =====
  const coreZ = -7.6;
  const coreY = -(zeppelinHullRadiusAt(coreZ) - 0.4);
  const core = add(
    stern,
    new THREE.IcosahedronGeometry(1.5 * s, 2),
    materials.core,
    'zeppelin_storm_core',
    0,
    coreY,
    coreZ,
    1.9
  );
  core.castShadow = false;
  const coreGlow = createGlowSprite(0xa890ff, 7 * s, 0.25);
  coreGlow.name = 'zeppelin_storm_core_glow';
  coreGlow.position.set(0, (coreY - 0.8) * s, coreZ * s);
  stern.add(coreGlow);
  const keelPlates: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    // 蚌壳式龙骨装甲：两片半球壳从左右包住核心，阶段 3 被炸飞
    const shell = new THREE.SphereGeometry(1.75 * s, 16, 10, 0, Math.PI, 0, Math.PI);
    const plate = add(
      stern,
      shell,
      materials.keelPlate,
      `zeppelin_keel_plate_${side > 0 ? 'L' : 'R'}`,
      0,
      coreY - 0.15,
      coreZ
    );
    // 半球 phi∈[0,π] 位于 +Z 一侧：绕 Y 转 ±90° 变成左右两半，本地 X 拉长对应船体轴向
    plate.rotation.y = (side * Math.PI) / 2;
    plate.scale.set(1.25, 0.95, 1);
    keelPlates.push(plate);
  }

  // ===== 航行灯（左红右绿，艉部白色频闪）=====
  const navGeometries: THREE.BufferGeometry[] = [];
  const navColors: number[] = [];
  const pushNav = (geometry: THREE.BufferGeometry, color: number): void => {
    const c = new THREE.Color(color);
    const count = geometry.getAttribute('position').count;
    for (let i = 0; i < count; i++) navColors.push(c.r, c.g, c.b);
    navGeometries.push(geometry);
  };
  pushNav(placed(new THREE.SphereGeometry(0.22 * s, 8, 6), 4.5 * s, 0, 4 * s), 0xff2a2a);
  pushNav(placed(new THREE.SphereGeometry(0.22 * s, 8, 6), -4.5 * s, 0, 4 * s), 0x2aff6a);
  pushNav(placed(new THREE.SphereGeometry(0.2 * s, 8, 6), 0, 0.8 * s, -16.25 * s), 0xffffff);
  const navMerged = mergeGeometries(navGeometries, false) ?? new THREE.BufferGeometry();
  for (const geometry of navGeometries) geometry.dispose();
  navMerged.setAttribute('color', new THREE.Float32BufferAttribute(navColors, 3));
  const nav = new THREE.Mesh(navMerged, materials.navLights);
  nav.name = 'zeppelin_nav_lights';
  group.add(nav);

  // ===== 合并静态零件 =====
  const bucketMaterial: Record<string, THREE.Material> = {
    frame: materials.frame,
    stringer: materials.stringer,
    glow: materials.glowStrip,
    cage: materials.cage,
    window: materials.window,
    metal: materials.metal,
    dark: materials.dark,
    coil: materials.coilBody,
    engineRing: materials.engineRing,
    fin: materials.fin,
    rodTip: materials.rodTip,
    missile: materials.missileCell,
  };
  for (const [id, geometries] of buckets) {
    if (geometries.length === 0) continue;
    const [section, key] = id.split(':') as [ZeppelinSection, string];
    const material = bucketMaterial[key];
    if (!material) continue;
    const mesh = mergeInto(geometries, material, `zeppelin_${section}_${key}`);
    const emissiveOnly =
      key === 'glow' || key === 'window' || key === 'engineRing' || key === 'rodTip';
    mesh.castShadow = !emissiveOnly;
    (section === 'bow' ? bow : stern).add(mesh);
  }

  // ===== 艇体碰撞锚点（不可见）=====
  const hullAnchors: THREE.Object3D[] = [];
  const anchorDefs: Array<[number, number]> = [
    [12.2, 3.4],
    [6.0, 4.6],
    [0.2, 4.8],
    [-5.8, 4.5],
    [-11.6, 3.4],
  ];
  anchorDefs.forEach(([z, radius], index) => {
    const anchor = new THREE.Object3D();
    anchor.name = `zeppelin_hull_anchor_${index}`;
    anchor.position.set(0, 0, z * s);
    anchor.userData.hitRadius = radius * s;
    sectionOf(z).add(anchor);
    hullAnchors.push(anchor);
    parts.push(anchor);
  });

  group.userData.hitRadius = 5 * s;
  const rig: TempestZeppelinRig = {
    scale: s,
    bow,
    stern,
    cells,
    coils,
    engines,
    turrets,
    hangar: { interior, interiorMaterial, doors, beacons, beaconMaterial, launchPoint },
    gondola,
    core,
    coreGlow,
    keelPlates,
    missileCells,
    navLights: nav,
    hullAnchors,
    halfLength: 16.4 * s,
    hullRadius: 4.62 * s,
    bottomOffset: (-GONDOLA_Y + GONDOLA_HALF_HEIGHT + 1.1) * s,
    breakZ: BREAK_Z * s,
    materials,
  };
  group.zeppelinRig = rig;
  group.bossParts = parts;
  return group;
}
