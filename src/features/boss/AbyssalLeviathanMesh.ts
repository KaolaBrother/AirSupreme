import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BossConfig } from './BossTypes';
import { createGlowSprite } from './MagmaColossusHazards';

/**
 * 第七关 Boss「深渊利维坦」模型：覆冰的巨型破冰潜艇。
 *
 * 朝向：艇艏 +Z，上方向 +Y；根节点原点位于海平面（控制器放在 y = -48）。
 * hullRig 承载下潜深度与俯仰/横滚；其下分为 bow / stern 两段（死亡时断裂）。
 * - 艇体：旋转体（Lathe）+ 平甲板 + 覆冰 + 吃水线青色生物光带。
 * - 指挥塔（子目标）：舰桥窗、围壳舵、潜望镜与旋转声呐阵列。
 * - 垂直发射舱 8 个（舱门可翻开，开启时为弱点）、压载舱 4 个（子目标）。
 * - 前后双联装甲炮塔、艉部布雷管、X 形尾舵与泵喷推进器、艏部破冰撞角与声呐罩。
 *
 * 尺寸以设计单位书写，乘以 config.scale（默认 5.5）得到米。
 */

export interface LeviathanHatchRig {
  index: number;
  pivot: THREE.Group;
  /** 舱门翻开方向（+1 / -1） */
  side: 1 | -1;
  silo: THREE.Mesh;
  siloMaterial: THREE.MeshStandardMaterial;
  launchPoint: THREE.Object3D;
}

export interface LeviathanTankRig {
  index: number;
  mesh: THREE.Mesh;
  valveMaterial: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
}

export interface LeviathanTurretRig {
  yaw: THREE.Group;
  housing: THREE.Mesh;
  muzzles: THREE.Object3D[];
}

export interface AbyssalLeviathanMaterials {
  hull: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  fin: THREE.MeshStandardMaterial;
  ice: THREE.MeshStandardMaterial;
  glowStrip: THREE.MeshStandardMaterial;
  bridge: THREE.MeshStandardMaterial;
  sonar: THREE.MeshStandardMaterial;
  danger: THREE.MeshStandardMaterial;
  propulsor: THREE.MeshStandardMaterial;
  mineTube: THREE.MeshStandardMaterial;
  ram: THREE.MeshStandardMaterial;
}

export interface AbyssalLeviathanRig {
  scale: number;
  hullRig: THREE.Group;
  bow: THREE.Group;
  stern: THREE.Group;
  hullBow: THREE.Mesh;
  hullStern: THREE.Mesh;
  deck: THREE.Mesh;
  sail: THREE.Mesh;
  sonarArray: THREE.Object3D;
  sonarDome: THREE.Mesh;
  hatches: LeviathanHatchRig[];
  tanks: LeviathanTankRig[];
  turrets: LeviathanTurretRig[];
  mineTubes: THREE.Object3D[];
  propulsor: THREE.Mesh;
  propulsorRotor: THREE.Object3D;
  dangerGlows: THREE.Sprite[];
  bowTip: THREE.Object3D;
  /** 导弹舱子目标锚点（8 个发射井的中心，用于血条定位） */
  missileBay: THREE.Object3D;
  /** 潜航深度（米）：完全下潜时 hullRig 的下沉量 */
  diveDepth: number;
  /** 艇长的一半（米） */
  halfLength: number;
  materials: AbyssalLeviathanMaterials;
}

export type AbyssalLeviathanGroup = THREE.Group & { leviathanRig?: AbyssalLeviathanRig };

const HULL_CENTER_Y = -0.6;
const HULL_FLATTEN = 0.82;
const DECK_Y = 2.3;
const BREAK_Z = -1;

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

/** 艇体旋转体：profile 为 (半径, 轴向 z) 设计单位；几何体以 originZ 为原点 */
function createHullSection(
  profile: Array<[number, number]>,
  s: number,
  originZ: number
): THREE.BufferGeometry {
  const points = profile.map(([r, z]) => new THREE.Vector2(r * s, z * s));
  const geometry = new THREE.LatheGeometry(points, 32);
  geometry.rotateX(Math.PI / 2);
  // rotateX 后轴向 y→z，再压扁竖直方向
  geometry.scale(1, HULL_FLATTEN, 1);
  geometry.translate(0, HULL_CENTER_Y * s, -originZ * s);
  geometry.computeVertexNormals();
  return geometry;
}

export function createAbyssalLeviathanMaterials(): AbyssalLeviathanMaterials {
  return {
    hull: new THREE.MeshStandardMaterial({
      color: 0x41535f,
      roughness: 0.5,
      metalness: 0.32,
      emissive: 0x0b2230,
      emissiveIntensity: 0.55,
    }),
    deck: new THREE.MeshStandardMaterial({
      color: 0x2f3d47,
      roughness: 0.62,
      metalness: 0.28,
      emissive: 0x081a24,
      emissiveIntensity: 0.5,
    }),
    fin: new THREE.MeshStandardMaterial({
      color: 0x384954,
      roughness: 0.55,
      metalness: 0.3,
      emissive: 0x081a24,
      emissiveIntensity: 0.45,
    }),
    ice: new THREE.MeshStandardMaterial({
      color: 0xe2f5ff,
      roughness: 0.22,
      metalness: 0.02,
      flatShading: true,
      emissive: 0x5aa9cc,
      emissiveIntensity: 0.18,
    }),
    glowStrip: new THREE.MeshStandardMaterial({
      color: 0x062a33,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x38e8ff,
      emissiveIntensity: 1.6,
    }),
    bridge: new THREE.MeshStandardMaterial({
      color: 0x0d2a33,
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0x9ff4ff,
      emissiveIntensity: 1.8,
    }),
    sonar: new THREE.MeshStandardMaterial({
      color: 0x0a2a36,
      roughness: 0.25,
      metalness: 0.2,
      emissive: 0x4cf0ff,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.92,
    }),
    danger: new THREE.MeshStandardMaterial({
      color: 0x330608,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0xff2a3a,
      emissiveIntensity: 2,
    }),
    propulsor: new THREE.MeshStandardMaterial({
      color: 0x062a33,
      roughness: 0.35,
      metalness: 0.3,
      emissive: 0x3fd8ff,
      emissiveIntensity: 1.8,
    }),
    mineTube: new THREE.MeshStandardMaterial({
      color: 0x2a0a0a,
      roughness: 0.45,
      metalness: 0.4,
      emissive: 0xff4422,
      emissiveIntensity: 0.6,
    }),
    ram: new THREE.MeshStandardMaterial({
      color: 0x4a5560,
      roughness: 0.3,
      metalness: 0.85,
      emissive: 0x0a1a22,
      emissiveIntensity: 0.4,
    }),
  };
}

/**
 * 创建深渊利维坦模型。返回的 Group 名为 `BOSS_${config.type}`，
 * 可碰撞部件（userData.hitRadius，米）挂在 group.bossParts，骨架挂在 group.leviathanRig。
 */
export function createAbyssalLeviathanMesh(config: BossConfig): THREE.Group {
  const s = Number.isFinite(config.scale) && config.scale > 0 ? config.scale : 5.5;
  const group = new THREE.Group() as AbyssalLeviathanGroup & { bossParts?: THREE.Mesh[] };
  group.name = `BOSS_${config.type}`;
  const materials = createAbyssalLeviathanMaterials();
  const parts: THREE.Mesh[] = [];

  const hullRig = new THREE.Group();
  hullRig.name = 'leviathan_hull_rig';
  group.add(hullRig);
  const bow = new THREE.Group();
  bow.name = 'leviathan_bow_section';
  const stern = new THREE.Group();
  stern.name = 'leviathan_stern_section';
  hullRig.add(bow, stern);

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

  // ===== 艇体（艏段 / 艉段）=====
  const bowZ = 8;
  const sternZ = -9;
  const hullBow = new THREE.Mesh(
    createHullSection(
      [
        [3.36, BREAK_Z],
        [3.38, 6],
        [3.22, 10],
        [2.75, 13],
        [1.85, 15.4],
        [0.65, 16.9],
        [0.04, 17.3],
      ],
      s,
      bowZ
    ),
    materials.hull
  );
  hullBow.name = 'leviathan_hull_bow';
  hullBow.position.set(0, 0, bowZ * s);
  hullBow.castShadow = true;
  hullBow.userData.hitRadius = 7 * s;
  bow.add(hullBow);
  parts.push(hullBow);
  const hullStern = new THREE.Mesh(
    createHullSection(
      [
        [0.22, -17.2],
        [1.25, -16],
        [2.35, -13.5],
        [3.05, -10],
        [3.32, -6],
        [3.36, BREAK_Z],
      ],
      s,
      sternZ
    ),
    materials.hull
  );
  hullStern.name = 'leviathan_hull_stern';
  hullStern.position.set(0, 0, sternZ * s);
  hullStern.castShadow = true;
  hullStern.userData.hitRadius = 7 * s;
  stern.add(hullStern);
  parts.push(hullStern);

  // 甲板（中段碰撞锚点）
  const deck = add(bow, box(3.4, 0.5, 11), materials.deck, 'leviathan_deck', 0, DECK_Y, 4.6, {}, 6);
  add(stern, box(3.4, 0.5, 11.5), materials.deck, 'leviathan_deck_aft', 0, DECK_Y, -6.6);

  // 吃水线生物光带 + 甲板边缘光带
  const stripGeometries: THREE.BufferGeometry[] = [];
  const sternStripGeometries: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    stripGeometries.push(placed(box(0.16, 0.26, 15), side * 3.24 * s, 0.25 * s, 6.5 * s));
    sternStripGeometries.push(placed(box(0.16, 0.26, 12), side * 3.2 * s, 0.25 * s, -7 * s));
    stripGeometries.push(
      placed(box(0.12, 0.12, 10.5), side * 1.72 * s, (DECK_Y + 0.27) * s, 4.6 * s)
    );
    sternStripGeometries.push(
      placed(box(0.12, 0.12, 11), side * 1.72 * s, (DECK_Y + 0.27) * s, -6.6 * s)
    );
    for (let i = 0; i < 5; i++) {
      // 斜向“鳃纹”
      stripGeometries.push(
        placed(box(0.14, 1.4, 0.18), side * 3.1 * s, -0.8 * s, (10.5 - i * 1.1) * s, 0.5, 0, 0)
      );
    }
  }
  const strips = mergeInto(stripGeometries, materials.glowStrip, 'leviathan_glow_strips');
  strips.castShadow = false;
  bow.add(strips);
  const sternStrips = mergeInto(
    sternStripGeometries,
    materials.glowStrip,
    'leviathan_glow_strips_aft'
  );
  sternStrips.castShadow = false;
  stern.add(sternStrips);

  // 覆冰
  let seed = 11;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const iceBow: THREE.BufferGeometry[] = [];
  const iceStern: THREE.BufferGeometry[] = [];
  // 冰壳：沿甲板两侧与艇肩铺开的扁平冰板（只绕竖轴旋转，贴合艇体）
  for (let i = 0; i < 30; i++) {
    const z = 12.5 - (i % 15) * 1.75 + (rand() - 0.5) * 0.7;
    const side = i < 15 ? 1 : -1;
    const x = side * (1.55 + rand() * 1.5);
    const surface = Math.sqrt(Math.max(0, 1 - (x / 3.36) ** 2)) * 2.75 + HULL_CENTER_Y;
    const taper = Math.abs(z) > 11 ? 0.65 : 1;
    const tilt = -side * Math.asin(Math.min(0.9, Math.abs(x) / 3.36)) * 0.8;
    const geometry = placed(
      new THREE.DodecahedronGeometry((0.65 + rand() * 0.6) * s * taper, 0),
      x * s,
      (surface + 0.05) * s,
      z * s,
      (rand() - 0.5) * 0.25,
      rand() * 3,
      tilt,
      1.5,
      0.32,
      1.3
    );
    if (z > BREAK_Z) iceBow.push(geometry);
    else iceStern.push(geometry);
  }
  // 指挥塔顶积冰
  iceBow.push(
    placed(
      new THREE.DodecahedronGeometry(1.0 * s, 0),
      0.1 * s,
      (DECK_Y + 6.9) * s,
      5.6 * s,
      0,
      0.5,
      0,
      1.35,
      0.35,
      3.2
    )
  );
  const ice = mergeInto(iceBow, materials.ice, 'leviathan_ice_crust');
  ice.castShadow = true;
  bow.add(ice);
  const iceAft = mergeInto(iceStern, materials.ice, 'leviathan_ice_crust_aft');
  iceAft.castShadow = true;
  stern.add(iceAft);

  // ===== 指挥塔（子目标）=====
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-3.4 * s, 0);
  sailShape.lineTo(3.0 * s, 0);
  sailShape.quadraticCurveTo(4.0 * s, 1.6 * s, 3.6 * s, 4.2 * s);
  sailShape.lineTo(3.2 * s, 6.3 * s);
  sailShape.lineTo(-1.8 * s, 6.7 * s);
  sailShape.lineTo(-3.7 * s, 5.4 * s);
  sailShape.lineTo(-3.4 * s, 0);
  const sailDepth = 1.9 * s;
  const sailGeometry = new THREE.ExtrudeGeometry(sailShape, {
    depth: sailDepth,
    bevelEnabled: true,
    bevelThickness: 0.22 * s,
    bevelSize: 0.22 * s,
    bevelSegments: 2,
    curveSegments: 6,
  });
  sailGeometry.rotateY(-Math.PI / 2);
  sailGeometry.translate(sailDepth / 2, 0, 0);
  // 原点移到指挥塔中心，方便作为碰撞锚点
  sailGeometry.translate(0, -3.2 * s, 0);
  const sail = add(
    bow,
    sailGeometry,
    materials.hull,
    'leviathan_sail',
    0,
    DECK_Y + 3.45,
    5.2,
    {},
    4
  );
  add(
    sail,
    box(2.25, 0.55, 3.0),
    materials.bridge,
    'leviathan_bridge_windows',
    0,
    2.5,
    2.0
  ).castShadow = false;
  add(sail, box(6.2, 0.24, 1.7), materials.fin, 'leviathan_sail_planes', 0, 0.9, 1.8);
  // 指挥塔前缘与顶部的生物光带（极夜里勾勒轮廓）
  const sailStripGeometries: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    sailStripGeometries.push(placed(box(0.08, 4.4, 0.16), side * 1.18 * s, -0.5 * s, 2.7 * s));
    sailStripGeometries.push(placed(box(0.08, 0.16, 5.2), side * 1.18 * s, 2.75 * s, 0.1 * s));
    for (let i = 0; i < 3; i++) {
      sailStripGeometries.push(
        placed(box(0.06, 0.22, 0.22), side * 1.2 * s, (0.4 + i * 0.75) * s, (-1.2 - i * 0.4) * s)
      );
    }
  }
  const sailStrips = mergeInto(sailStripGeometries, materials.glowStrip, 'leviathan_sail_strips');
  sailStrips.castShadow = false;
  sail.add(sailStrips);
  for (const [x, h] of [
    [0.45, 2.6],
    [-0.4, 3.4],
  ] as const) {
    add(
      sail,
      new THREE.CylinderGeometry(0.12 * s, 0.16 * s, h * s, 6),
      materials.fin,
      'leviathan_mast',
      x,
      3.3 + h / 2,
      -0.6
    );
  }
  const sonarArray = new THREE.Group();
  sonarArray.name = 'leviathan_sonar_array';
  sonarArray.position.set(0, 3.55 * s, 1.0 * s);
  sail.add(sonarArray);
  add(
    sonarArray,
    new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.9 * s, 6),
    materials.fin,
    'leviathan_sonar_mast',
    0,
    0.45,
    0
  );
  add(
    sonarArray,
    box(2.6, 0.32, 0.3),
    materials.sonar,
    'leviathan_sonar_bar',
    0,
    0.95,
    0
  ).castShadow = false;
  const dangerGlows: THREE.Sprite[] = [];
  const sailBeacon = add(
    sail,
    new THREE.SphereGeometry(0.22 * s, 8, 6),
    materials.danger,
    'leviathan_sail_beacon',
    -1.5,
    3.55,
    0
  );
  sailBeacon.castShadow = false;
  const sailBeaconGlow = createGlowSprite(0xff3040, 2.4 * s, 0.8);
  sailBeaconGlow.position.copy(sailBeacon.position);
  sail.add(sailBeaconGlow);
  dangerGlows.push(sailBeaconGlow);

  // ===== 垂直发射舱 =====
  const hatches: LeviathanHatchRig[] = [];
  for (let row = 0; row < 4; row++) {
    for (const side of [1, -1] as const) {
      const index = hatches.length;
      const z = 0.4 - row * 2.15;
      const parent = z > BREAK_Z ? bow : stern;
      const siloMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a0806,
        roughness: 0.4,
        metalness: 0.2,
        emissive: 0xff4a24,
        emissiveIntensity: 0.25,
      });
      const silo = add(
        parent,
        new THREE.CylinderGeometry(0.62 * s, 0.62 * s, 0.14 * s, 12),
        siloMaterial,
        `leviathan_silo_${index}`,
        side * 0.86,
        DECK_Y + 0.22,
        z,
        {},
        1.3
      );
      silo.castShadow = false;
      const pivot = new THREE.Group();
      pivot.name = `leviathan_hatch_${index}`;
      pivot.position.set(side * 1.62 * s, (DECK_Y + 0.3) * s, z * s);
      parent.add(pivot);
      add(
        pivot,
        box(1.5, 0.18, 1.62),
        materials.deck,
        `leviathan_hatch_door_${index}`,
        -side * 0.76,
        0,
        0
      );
      add(
        pivot,
        box(1.2, 0.06, 0.14),
        materials.danger,
        `leviathan_hatch_light_${index}`,
        -side * 0.76,
        0.12,
        0.62
      ).castShadow = false;
      const launchPoint = new THREE.Object3D();
      launchPoint.name = `leviathan_silo_launch_${index}`;
      launchPoint.position.set(side * 0.86 * s, (DECK_Y + 1.6) * s, z * s);
      parent.add(launchPoint);
      hatches.push({ index, pivot, side, silo, siloMaterial, launchPoint });
    }
  }

  // ===== 压载舱（子目标）=====
  const tanks: LeviathanTankRig[] = [];
  const tankSpots: Array<[number, number]> = [
    [1, 7.6],
    [-1, 7.6],
    [1, -7.2],
    [-1, -7.2],
  ];
  tankSpots.forEach(([side, z], index) => {
    const parent = z > BREAK_Z ? bow : stern;
    const valveMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a1404,
      roughness: 0.45,
      metalness: 0.3,
      emissive: 0xffa040,
      emissiveIntensity: 1.2,
    });
    const tank = add(
      parent,
      new THREE.SphereGeometry(1 * s, 16, 10),
      materials.fin,
      `leviathan_ballast_tank_${index}`,
      side * 3.3,
      -0.15,
      z,
      {},
      2.6
    );
    tank.scale.set(1.25, 1.15, 3.4);
    const valve = add(
      tank,
      new THREE.BoxGeometry(0.22 * s, 0.5 * s, 2.0 * s),
      valveMaterial,
      `leviathan_ballast_valve_${index}`,
      0,
      0,
      0
    );
    // 子网格位于缩放后的父节点内：抵消父缩放后贴在外侧
    valve.position.set((side * 1.02 * s) / 1, 0.25 * s, 0);
    valve.scale.set(1 / 1.25, 1 / 1.15, 1 / 3.4);
    valve.castShadow = false;
    const glow = createGlowSprite(0xffa040, 2.6 * s, 0.7);
    glow.position.set(side * 3.3 * s + side * 1.4 * s, 0.1 * s, z * s);
    parent.add(glow);
    tanks.push({ index, mesh: tank, valveMaterial, glow });
  });

  // ===== 甲板炮塔 =====
  const turrets: LeviathanTurretRig[] = [];
  for (const [z, parent] of [
    [11.2, bow],
    [-11.4, stern],
  ] as const) {
    const yaw = new THREE.Group();
    yaw.name = `leviathan_turret_${z > 0 ? 'fore' : 'aft'}`;
    yaw.position.set(0, (DECK_Y - 0.15) * s, z * s);
    parent.add(yaw);
    add(
      yaw,
      new THREE.CylinderGeometry(1.2 * s, 1.35 * s, 0.6 * s, 14),
      materials.deck,
      `leviathan_turret_base_${z > 0 ? 'fore' : 'aft'}`,
      0,
      0.3,
      0
    );
    const housing = add(
      yaw,
      box(2.0, 1.0, 2.4),
      materials.hull,
      `leviathan_turret_housing_${z > 0 ? 'fore' : 'aft'}`,
      0,
      1.0,
      0.1,
      {},
      1.8
    );
    const muzzles: THREE.Object3D[] = [];
    for (const side of [1, -1]) {
      add(
        yaw,
        new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 3.0 * s, 8),
        materials.fin,
        'leviathan_turret_barrel',
        side * 0.45,
        1.05,
        2.4,
        {
          x: Math.PI / 2,
        }
      );
      const muzzle = new THREE.Object3D();
      muzzle.name = 'leviathan_turret_muzzle';
      muzzle.position.set(side * 0.45 * s, 1.05 * s, 4.0 * s);
      yaw.add(muzzle);
      muzzles.push(muzzle);
    }
    turrets.push({ yaw, housing, muzzles });
  }

  // ===== 艉部：布雷管 + X 形尾舵 + 泵喷推进器 =====
  const mineTubes: THREE.Object3D[] = [];
  for (const side of [1, -1]) {
    const tube = add(
      stern,
      new THREE.CylinderGeometry(0.42 * s, 0.5 * s, 1.8 * s, 10),
      materials.deck,
      'leviathan_mine_tube',
      side * 1.05,
      DECK_Y + 0.35,
      -11.9,
      {
        x: -0.75,
      }
    );
    add(
      tube,
      new THREE.CylinderGeometry(0.34 * s, 0.34 * s, 0.1 * s, 10),
      materials.mineTube,
      'leviathan_mine_tube_mouth',
      0,
      0.92,
      0
    ).castShadow = false;
    const mouth = new THREE.Object3D();
    mouth.name = 'leviathan_mine_tube_launch';
    mouth.position.set(0, 1.2 * s, 0);
    tube.add(mouth);
    mineTubes.push(mouth);
  }
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k * Math.PI) / 2;
    add(
      stern,
      box(0.26, 3.4, 2.8),
      materials.fin,
      `leviathan_tail_fin_${k}`,
      Math.cos(angle) * 1.9,
      HULL_CENTER_Y + Math.sin(angle) * 1.9 * HULL_FLATTEN,
      -15.2,
      {
        z: angle - Math.PI / 2,
      }
    );
  }
  const propulsor = add(
    stern,
    new THREE.TorusGeometry(1.55 * s, 0.38 * s, 8, 24),
    materials.fin,
    'leviathan_propulsor',
    0,
    HULL_CENTER_Y,
    -16.7,
    {},
    2
  );
  const propulsorCore = add(
    stern,
    new THREE.CircleGeometry(1.3 * s, 24),
    materials.propulsor,
    'leviathan_propulsor_glow',
    0,
    HULL_CENTER_Y,
    -16.8,
    {
      y: Math.PI,
    }
  );
  propulsorCore.castShadow = false;
  const propulsorRotor = new THREE.Group();
  propulsorRotor.name = 'leviathan_propulsor_rotor';
  propulsorRotor.position.set(0, HULL_CENTER_Y * s, -16.75 * s);
  stern.add(propulsorRotor);
  for (let b = 0; b < 5; b++) {
    add(propulsorRotor, box(0.22, 1.2, 0.08), materials.fin, 'leviathan_rotor_blade', 0, 0, 0, {
      z: (b * Math.PI * 2) / 5,
    }).geometry.translate(0, 0.6 * s, 0);
  }
  const sternBeacon = add(
    stern,
    new THREE.SphereGeometry(0.2 * s, 8, 6),
    materials.danger,
    'leviathan_stern_beacon',
    0,
    1.35,
    -15.0
  );
  sternBeacon.castShadow = false;
  const sternGlow = createGlowSprite(0xff3040, 2.2 * s, 0.75);
  sternGlow.position.copy(sternBeacon.position);
  stern.add(sternGlow);
  dangerGlows.push(sternGlow);

  // ===== 艏部：破冰撞角 + 声呐罩 =====
  const ramGeometries: THREE.BufferGeometry[] = [
    placed(
      new THREE.ConeGeometry(1.5 * s, 4.6 * s, 4),
      0,
      -1.2 * s,
      17.0 * s,
      Math.PI / 2,
      Math.PI / 4,
      0,
      1,
      1,
      0.55
    ),
  ];
  for (let i = 0; i < 6; i++) {
    ramGeometries.push(
      placed(
        new THREE.ConeGeometry(0.28 * s, 1.1 * s, 4),
        0,
        (-2.3 + i * 0.05) * s,
        (15.6 - i * 1.25) * s,
        Math.PI,
        0,
        0
      )
    );
  }
  const ram = mergeInto(ramGeometries, materials.ram, 'leviathan_ice_ram');
  ram.castShadow = true;
  bow.add(ram);
  const sonarDome = add(
    bow,
    new THREE.SphereGeometry(1.25 * s, 18, 10),
    materials.sonar,
    'leviathan_sonar_dome',
    0,
    -1.6,
    14.6
  );
  sonarDome.scale.set(1.1, 0.7, 1.6);
  sonarDome.castShadow = false;
  const missileBay = new THREE.Object3D();
  missileBay.name = 'leviathan_missile_bay';
  missileBay.position.set(0, (DECK_Y + 0.4) * s, -2.8 * s);
  stern.add(missileBay);
  const bowTip = new THREE.Object3D();
  bowTip.name = 'leviathan_bow_tip';
  bowTip.position.set(0, -0.4 * s, 18.6 * s);
  bow.add(bowTip);

  const rig: AbyssalLeviathanRig = {
    scale: s,
    hullRig,
    bow,
    stern,
    hullBow,
    hullStern,
    deck,
    sail,
    sonarArray,
    sonarDome,
    hatches,
    tanks,
    turrets,
    mineTubes,
    propulsor,
    propulsorRotor,
    dangerGlows,
    bowTip,
    missileBay,
    diveDepth: 11.5 * s,
    halfLength: 17.3 * s,
    materials,
  };
  group.leviathanRig = rig;
  group.bossParts = parts;
  return group;
}
