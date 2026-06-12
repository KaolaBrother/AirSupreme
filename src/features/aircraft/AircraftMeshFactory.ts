/**
 * 飞机模型工厂 - 统一的飞机 mesh 创建函数
 *
 * 方向约定：
 * - 玩家机：机头 -Z（前进方向 = (0,0,-1)），机尾 +Z
 * - 敌机：机头 +Z（由 lookAt 驱动），机尾/引擎 -Z
 * - 上方向 = +Y，右方向 = +X
 *
 * 造型方法（v3 真实轮廓重塑）：
 * - 机身：LatheGeometry 旋成体 + 椭圆截面缩放（取代旧的盒子拼装）
 * - 翼面：Shape + ExtrudeGeometry 真实平面形（前缘后掠 + 梯形收窄 + 上反/下反角）
 * - 垂尾：Shape + ExtrudeGeometry + 绕机身轴外倾（cant）
 */

import * as THREE from 'three';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';

type EnemyConfig = (typeof ENEMY_CONFIGS)[EnemyType];

interface CachedMaterials {
  body: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  cockpit: THREE.MeshStandardMaterial;
  engine: THREE.MeshBasicMaterial;
  accent: THREE.MeshStandardMaterial;
  detail: THREE.MeshStandardMaterial;
  light: THREE.MeshBasicMaterial;
}

const materialsCache: Map<EnemyType, CachedMaterials> = new Map();

function createAircraftMaterial(
  color: number,
  metalness: number,
  roughness: number,
  emissiveIntensity: number = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive: color,
    emissiveIntensity,
  });
}

function getEnemyMaterialTuning(type: EnemyType): {
  body: { metalness: number; roughness: number; emissiveIntensity: number };
  wing: { metalness: number; roughness: number; emissiveIntensity: number };
  cockpit: { metalness: number; roughness: number; emissiveIntensity: number };
  accent: { metalness: number; roughness: number; emissiveIntensity: number };
  detailColor: number;
  lightOpacity: number;
  engineOpacity: number;
} {
  switch (type) {
    case EnemyType.SCOUT:
      return {
        body: { metalness: 0.8, roughness: 0.24, emissiveIntensity: 0.007 },
        wing: { metalness: 0.74, roughness: 0.3, emissiveIntensity: 0.002 },
        cockpit: { metalness: 0.96, roughness: 0.1, emissiveIntensity: 0.012 },
        accent: { metalness: 0.86, roughness: 0.22, emissiveIntensity: 0.004 },
        detailColor: 0xa7b0ba,
        lightOpacity: 0.14,
        engineOpacity: 0.22,
      };
    case EnemyType.FIGHTER:
      return {
        body: { metalness: 0.84, roughness: 0.22, emissiveIntensity: 0.008 },
        wing: { metalness: 0.78, roughness: 0.26, emissiveIntensity: 0.002 },
        cockpit: { metalness: 0.96, roughness: 0.1, emissiveIntensity: 0.012 },
        accent: { metalness: 0.88, roughness: 0.19, emissiveIntensity: 0.004 },
        detailColor: 0xb3bbc4,
        lightOpacity: 0.14,
        engineOpacity: 0.24,
      };
    case EnemyType.HEAVY:
      return {
        body: { metalness: 0.74, roughness: 0.3, emissiveIntensity: 0.005 },
        wing: { metalness: 0.7, roughness: 0.34, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.92, roughness: 0.14, emissiveIntensity: 0.01 },
        accent: { metalness: 0.8, roughness: 0.24, emissiveIntensity: 0.003 },
        detailColor: 0x949da7,
        lightOpacity: 0.12,
        engineOpacity: 0.22,
      };
    case EnemyType.SNIPER:
      return {
        body: { metalness: 0.82, roughness: 0.22, emissiveIntensity: 0.007 },
        wing: { metalness: 0.76, roughness: 0.28, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.96, roughness: 0.08, emissiveIntensity: 0.012 },
        accent: { metalness: 0.86, roughness: 0.18, emissiveIntensity: 0.004 },
        detailColor: 0xaab3bc,
        lightOpacity: 0.13,
        engineOpacity: 0.21,
      };
    case EnemyType.ACE:
      return {
        body: { metalness: 0.86, roughness: 0.2, emissiveIntensity: 0.009 },
        wing: { metalness: 0.8, roughness: 0.24, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.98, roughness: 0.08, emissiveIntensity: 0.012 },
        accent: { metalness: 0.9, roughness: 0.16, emissiveIntensity: 0.005 },
        detailColor: 0xaaa6a2,
        lightOpacity: 0.14,
        engineOpacity: 0.23,
      };
    default:
      return {
        body: { metalness: 0.7, roughness: 0.3, emissiveIntensity: 0.006 },
        wing: { metalness: 0.62, roughness: 0.38, emissiveIntensity: 0.003 },
        cockpit: { metalness: 0.92, roughness: 0.12, emissiveIntensity: 0.01 },
        accent: { metalness: 0.82, roughness: 0.24, emissiveIntensity: 0.005 },
        detailColor: 0xcfd6df,
        lightOpacity: 0.95,
        engineOpacity: 0.8,
      };
  }
}

function getOrCreateMaterials(
  type: EnemyType,
  bodyColor: number,
  wingColor: number,
  accentColor: number
): CachedMaterials {
  const cached = materialsCache.get(type);
  if (cached) return cached;
  const tuning = getEnemyMaterialTuning(type);

  const materials: CachedMaterials = {
    body: createAircraftMaterial(
      bodyColor,
      tuning.body.metalness,
      tuning.body.roughness,
      tuning.body.emissiveIntensity
    ),
    wing: createAircraftMaterial(
      wingColor,
      tuning.wing.metalness,
      tuning.wing.roughness,
      tuning.wing.emissiveIntensity
    ),
    cockpit: new THREE.MeshStandardMaterial({
      color: 0x1f252c,
      metalness: tuning.cockpit.metalness,
      roughness: tuning.cockpit.roughness,
      transparent: true,
      opacity: 0.88,
      emissive: 0x486170,
      emissiveIntensity: tuning.cockpit.emissiveIntensity,
    }),
    engine: (() => {
      const engineMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: tuning.engineOpacity,
      });
      registerEngineGlowMaterial(engineMaterial);
      return engineMaterial;
    })(),
    accent: createAircraftMaterial(
      accentColor,
      tuning.accent.metalness,
      tuning.accent.roughness,
      tuning.accent.emissiveIntensity
    ),
    detail: createAircraftMaterial(tuning.detailColor, 0.45, 0.6, 0),
    light: new THREE.MeshBasicMaterial({
      color: 0x7fd7ff,
      transparent: true,
      opacity: tuning.lightOpacity,
    }),
  };

  materialsCache.set(type, materials);
  return materials;
}

// ---------------------------------------------------------------------------
// 航空信号灯系统：所有机型共享材质，由 updateAircraftSignals 每帧统一驱动。
// 翼尖左红右绿航行灯、尾部白色双闪频闪灯、机腹红色防撞灯、引擎尾焰抖动。
// ---------------------------------------------------------------------------
const signalLightMaterials = {
  port: new THREE.MeshBasicMaterial({ color: 0xff4438, transparent: true, opacity: 0.92 }),
  starboard: new THREE.MeshBasicMaterial({ color: 0x3ddc68, transparent: true, opacity: 0.92 }),
  strobe: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  beacon: new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.55 }),
};
const signalLightGeometry = new THREE.SphereGeometry(0.09, 6, 6);
const engineGlowMaterials: Array<THREE.Material & { opacity: number }> = [];
let signalClock = 0;

function registerEngineGlowMaterial(material: THREE.Material & { opacity: number }): void {
  if (engineGlowMaterials.length < 64 && !engineGlowMaterials.includes(material)) {
    material.userData.baseOpacity = material.opacity;
    engineGlowMaterials.push(material);
  }
}

// 玩家引擎尾焰共享材质：跨多次建机复用，只注册一次即持续受 updateAircraftSignals 驱动
let playerEngineGlowMaterial: THREE.MeshBasicMaterial | null = null;
function getPlayerEngineGlowMaterial(): THREE.MeshBasicMaterial {
  if (!playerEngineGlowMaterial) {
    playerEngineGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.6,
    });
    registerEngineGlowMaterial(playerEngineGlowMaterial);
  }
  return playerEngineGlowMaterial;
}

/**
 * 推进共享信号灯动画。所有飞机共享同一组材质，每帧只需调用一次。
 */
export function updateAircraftSignals(deltaTime: number): void {
  signalClock = (signalClock + deltaTime) % 3600;

  // 真实频闪灯模式：1.2 秒周期内两次短促白闪
  const strobePhase = signalClock % 1.2;
  const strobeOn = strobePhase < 0.06 || (strobePhase >= 0.16 && strobePhase < 0.22);
  signalLightMaterials.strobe.opacity = strobeOn ? 0.95 : 0.05;

  // 防撞灯呼吸式脉冲
  signalLightMaterials.beacon.opacity = 0.2 + (Math.sin(signalClock * 4.6) * 0.5 + 0.5) * 0.6;

  // 引擎尾焰高频轻微抖动
  const flicker =
    0.88 + Math.sin(signalClock * 31) * 0.07 + Math.sin(signalClock * 53 + 1.7) * 0.05;
  for (const material of engineGlowMaterials) {
    const base = (material.userData.baseOpacity as number | undefined) ?? 0.25;
    material.opacity = base * flicker;
  }
}

/**
 * 依据机体包围盒追加航空灯组。tailDirection 指向机尾（+1 表示尾部在 +Z）。
 */
function addNavigationLights(group: THREE.Group, tailDirection: 1 | -1): void {
  const bounds = new THREE.Box3().setFromObject(group);
  if (bounds.isEmpty()) {
    return;
  }
  const center = bounds.getCenter(new THREE.Vector3());

  const portLight = new THREE.Mesh(signalLightGeometry, signalLightMaterials.port);
  portLight.position.set(bounds.min.x + 0.06, center.y + 0.02, center.z);
  portLight.name = 'navLightPort';
  portLight.userData.sharedResource = true;
  group.add(portLight);

  const starboardLight = new THREE.Mesh(signalLightGeometry, signalLightMaterials.starboard);
  starboardLight.position.set(bounds.max.x - 0.06, center.y + 0.02, center.z);
  starboardLight.name = 'navLightStarboard';
  starboardLight.userData.sharedResource = true;
  group.add(starboardLight);

  const tailZ = tailDirection > 0 ? bounds.max.z - 0.08 : bounds.min.z + 0.08;
  const strobeLight = new THREE.Mesh(signalLightGeometry, signalLightMaterials.strobe);
  strobeLight.position.set(center.x, center.y + (bounds.max.y - center.y) * 0.55, tailZ);
  strobeLight.scale.setScalar(0.85);
  strobeLight.name = 'strobeLight';
  strobeLight.userData.sharedResource = true;
  group.add(strobeLight);

  const beaconLight = new THREE.Mesh(signalLightGeometry, signalLightMaterials.beacon);
  beaconLight.position.set(center.x, bounds.min.y + 0.05, center.z);
  beaconLight.scale.setScalar(0.8);
  beaconLight.name = 'beaconLight';
  beaconLight.userData.sharedResource = true;
  group.add(beaconLight);
}

function addMeshPart(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  options?: {
    rotation?: [number, number, number];
    scale?: [number, number, number];
    castShadow?: boolean;
    name?: string;
  }
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);

  if (options?.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  }

  if (options?.scale) {
    mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
  }

  mesh.castShadow = options?.castShadow ?? true;

  if (options?.name) {
    mesh.name = options.name;
  }

  group.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// 真实轮廓造型辅助：翼面平面形 / 旋成体机身 / 垂尾
// ---------------------------------------------------------------------------

/** 平面形轮廓点：翼面坐标 [x=外侧（向翼尖）, y=前方（向机头）]；垂尾坐标 [x=前方, y=上方]。 */
type PlanformPoint = [number, number];

/** 由轮廓点创建薄片拉伸几何体，厚度沿拉伸方向居中。 */
function createPlanformGeometry(
  outline: PlanformPoint[],
  thickness: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i += 1) {
    shape.lineTo(outline[i][0], outline[i][1]);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

/**
 * 添加左右对称的一对翼面。
 * outline 使用翼面坐标（x 向翼尖、y 向机头），由 forward 决定机头朝向：
 * forward = -1 → 机头 -Z（玩家机）；forward = +1 → 机头 +Z（敌机）。
 * dihedral > 0 为上反角，< 0 为下反角（绕机身纵轴整体偏转）。
 */
function addWingPair(
  group: THREE.Group,
  outline: PlanformPoint[],
  thickness: number,
  material: THREE.Material,
  position: [number, number, number],
  forward: 1 | -1,
  options?: { dihedral?: number; castShadow?: boolean }
): void {
  const geometry = createPlanformGeometry(outline, thickness);
  const dihedral = options?.dihedral ?? 0;
  for (const side of [1, -1] as const) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.order = 'ZYX';
    mesh.rotation.x = forward * (Math.PI / 2);
    mesh.rotation.z = side * dihedral;
    mesh.scale.x = side;
    mesh.position.set(side * position[0], position[1], position[2]);
    mesh.castShadow = options?.castShadow ?? true;
    group.add(mesh);
  }
}

/**
 * 添加单片垂尾/腹鳍。outline 使用垂尾坐标（x 向机头、y 向上）。
 * cant 为绕机身纵轴的滚转角（正值 = 顶端朝 +X 倾斜）。
 */
function addFin(
  group: THREE.Group,
  outline: PlanformPoint[],
  thickness: number,
  material: THREE.Material,
  position: [number, number, number],
  forward: 1 | -1,
  cant: number = 0
): THREE.Mesh {
  const geometry = createPlanformGeometry(outline, thickness);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.order = 'ZYX';
  mesh.rotation.y = -forward * (Math.PI / 2);
  mesh.rotation.z = cant;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * 添加左右对称的一对垂尾。cant > 0 为顶端向外倾斜（外倾双垂尾）。
 */
function addFinPair(
  group: THREE.Group,
  outline: PlanformPoint[],
  thickness: number,
  material: THREE.Material,
  position: [number, number, number],
  forward: 1 | -1,
  cant: number = 0
): void {
  for (const side of [1, -1] as const) {
    addFin(
      group,
      outline,
      thickness,
      material,
      [side * position[0], position[1], position[2]],
      forward,
      -side * cant
    );
  }
}

/**
 * 旋成体机身：profile 为 [半径, 轴向位置] 数组，按机尾 → 机头排列（轴向值递增）。
 * widthScale/heightScale 把圆截面压成椭圆，得到扁宽或瘦高的机体。
 */
function addFuselage(
  group: THREE.Group,
  profile: PlanformPoint[],
  material: THREE.Material,
  forward: 1 | -1,
  options?: {
    segments?: number;
    widthScale?: number;
    heightScale?: number;
    offsetY?: number;
  }
): THREE.Mesh {
  const points = profile.map(
    ([radius, axial]) => new THREE.Vector2(Math.max(radius, 0.001), axial)
  );
  const geometry = new THREE.LatheGeometry(points, options?.segments ?? 12);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = forward * (Math.PI / 2);
  mesh.scale.set(options?.widthScale ?? 1, 1, options?.heightScale ?? 1);
  mesh.position.set(0, options?.offsetY ?? 0, 0);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * 挂载物（导弹/炸弹）：弹体圆柱 + 弹头锥 + 十字尾翼，轴向沿 Z。
 */
function addStore(
  group: THREE.Group,
  bodyMaterial: THREE.Material,
  finMaterial: THREE.Material,
  position: [number, number, number],
  length: number,
  radius: number,
  forward: 1 | -1
): void {
  addMeshPart(
    group,
    new THREE.CylinderGeometry(radius, radius * 0.92, length, 8),
    bodyMaterial,
    position,
    { rotation: [Math.PI / 2, 0, 0] }
  );
  addMeshPart(
    group,
    new THREE.ConeGeometry(radius * 0.95, length * 0.28, 8),
    bodyMaterial,
    [position[0], position[1], position[2] + forward * (length / 2 + length * 0.13)],
    { rotation: [forward * (Math.PI / 2), 0, 0] }
  );
  const finZ = position[2] - forward * length * 0.42;
  addMeshPart(
    group,
    new THREE.BoxGeometry(radius * 4.2, radius * 0.45, radius * 1.6),
    finMaterial,
    [position[0], position[1], finZ]
  );
  addMeshPart(
    group,
    new THREE.BoxGeometry(radius * 0.45, radius * 4.2, radius * 1.6),
    finMaterial,
    [position[0], position[1], finZ]
  );
}

// ---------------------------------------------------------------------------
// 玩家机：F-22 风格五代空优战斗机
// ---------------------------------------------------------------------------

/**
 * 创建玩家飞机模型 - F-22 风格五代战斗机
 * 旋成体融合机身、鸭蛋舱盖、菱形主翼、外倾双垂尾、二元矢量喷口
 */
export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();

  const bodyMaterial = createAircraftMaterial(0xe8e8e8, 0.82, 0.24, 0.02);
  const wingMaterial = createAircraftMaterial(0xa0a0a0, 0.72, 0.32, 0.03);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.95,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
    emissive: 0x4fc3ff,
    emissiveIntensity: 0.03,
  });
  const accentMaterial = createAircraftMaterial(0x707070, 0.9, 0.22, 0.02);
  const detailMaterial = createAircraftMaterial(0x45505c, 0.72, 0.4, 0.01);
  const weaponMaterial = createAircraftMaterial(0x5f6875, 0.92, 0.22, 0.01);
  const engineMaterial = createAircraftMaterial(0x404040, 0.82, 0.28, 0.04);
  const intakeCavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x161a20,
    metalness: 0.38,
    roughness: 0.74,
  });
  const playerLightMaterial = new THREE.MeshBasicMaterial({
    color: 0x58d5ff,
    transparent: true,
    opacity: 0.75,
  });
  const navRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5544,
    transparent: true,
    opacity: 0.45,
  });
  const navGreenMaterial = new THREE.MeshBasicMaterial({
    color: 0x6dff8c,
    transparent: true,
    opacity: 0.45,
  });

  // === 融合机身：扁宽旋成体（机头 -Z）===
  addFuselage(
    group,
    [
      [0.05, -2.2],
      [0.18, -1.9],
      [0.32, -1.35],
      [0.43, -0.7],
      [0.5, 0.1],
      [0.46, 0.8],
      [0.36, 1.5],
      [0.2, 2.15],
      [0.02, 2.74],
    ],
    bodyMaterial,
    -1,
    { segments: 12, widthScale: 1.3, heightScale: 0.9 }
  );

  // === 棱线机头（chined nose）：两侧细长棱缘 ===
  addMeshPart(group, new THREE.BoxGeometry(0.46, 0.05, 1.7), accentMaterial, [-0.26, 0, -1.5], {
    rotation: [0, -0.12, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.46, 0.05, 1.7), accentMaterial, [0.26, 0, -1.5], {
    rotation: [0, 0.12, 0],
  });

  // === 气泡座舱盖 ===
  addMeshPart(group, new THREE.SphereGeometry(0.4, 14, 12), cockpitMaterial, [0, 0.32, -0.85], {
    scale: [1.0, 0.62, 1.7],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.05, 0.07), accentMaterial, [0, 0.42, -1.4]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.04, 1.1), accentMaterial, [0, 0.55, -0.8]);

  // === 前缘根部延伸（LERX）===
  addWingPair(
    group,
    [
      [0, 0],
      [0.45, 0.05],
      [0, 1.15],
    ],
    0.05,
    accentMaterial,
    [0.42, 0.1, -0.45],
    -1
  );

  // === 主翼：~40° 前缘后掠梯形翼，强收窄，轻微下反 ===
  addWingPair(
    group,
    [
      [0, 1.05],
      [2.05, -0.67],
      [2.05, -1.02],
      [0, -1.05],
    ],
    0.07,
    wingMaterial,
    [0.5, -0.02, 0.35],
    -1,
    { dihedral: -0.06 }
  );

  // === 全动平尾 ===
  addWingPair(
    group,
    [
      [0, 0.52],
      [1.0, -0.12],
      [1.0, -0.4],
      [0, -0.55],
    ],
    0.05,
    wingMaterial,
    [0.38, 0, 1.62],
    -1,
    { dihedral: -0.04 }
  );

  // === 外倾双垂尾（cant ±0.32）===
  addFinPair(
    group,
    [
      [0, 0],
      [1.1, 0],
      [0.74, 1.05],
      [0.3, 1.05],
    ],
    0.05,
    wingMaterial,
    [0.58, 0.25, 1.7],
    -1,
    0.32
  );

  // === DSI 进气道：两侧斜切唇口 + 深色内腔 ===
  addMeshPart(group, new THREE.BoxGeometry(0.36, 0.34, 1.15), bodyMaterial, [-0.6, -0.1, -0.15], {
    rotation: [0, -0.05, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.36, 0.34, 1.15), bodyMaterial, [0.6, -0.1, -0.15], {
    rotation: [0, 0.05, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.4, 0.07, 0.36), accentMaterial, [-0.62, 0.08, -0.78], {
    rotation: [0.35, -0.12, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.4, 0.07, 0.36), accentMaterial, [0.62, 0.08, -0.78], {
    rotation: [0.35, 0.12, 0],
  });
  addMeshPart(
    group,
    new THREE.BoxGeometry(0.3, 0.28, 0.14),
    intakeCavityMaterial,
    [-0.62, -0.1, -0.72]
  );
  addMeshPart(
    group,
    new THREE.BoxGeometry(0.3, 0.28, 0.14),
    intakeCavityMaterial,
    [0.62, -0.1, -0.72]
  );

  // === 尾部平台与尾撑 ===
  addMeshPart(group, new THREE.BoxGeometry(1.15, 0.1, 1.3), bodyMaterial, [0, 0.16, 1.5]);
  addMeshPart(group, new THREE.BoxGeometry(0.3, 0.2, 1.05), wingMaterial, [-0.76, 0, 1.55]);
  addMeshPart(group, new THREE.BoxGeometry(0.3, 0.2, 1.05), wingMaterial, [0.76, 0, 1.55]);

  // === 二元矢量喷口（矩形）+ 调节片 ===
  const glowMaterial = getPlayerEngineGlowMaterial();
  for (const side of [1, -1] as const) {
    addMeshPart(group, new THREE.BoxGeometry(0.42, 0.3, 0.55), engineMaterial, [
      side * 0.32,
      -0.03,
      1.95,
    ]);
    addMeshPart(
      group,
      new THREE.BoxGeometry(0.36, 0.04, 0.3),
      weaponMaterial,
      [side * 0.32, 0.13, 2.16],
      {
        rotation: [0.25, 0, 0],
      }
    );
    addMeshPart(
      group,
      new THREE.BoxGeometry(0.36, 0.04, 0.3),
      weaponMaterial,
      [side * 0.32, -0.19, 2.16],
      {
        rotation: [-0.25, 0, 0],
      }
    );
  }
  const leftGlow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 8), glowMaterial);
  leftGlow.rotation.x = Math.PI / 2;
  leftGlow.position.set(-0.32, -0.03, 2.25);
  leftGlow.name = 'engineGlow';
  leftGlow.userData.sharedResource = true;
  group.add(leftGlow);

  const rightGlow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 8), glowMaterial);
  rightGlow.rotation.x = Math.PI / 2;
  rightGlow.position.set(0.32, -0.03, 2.25);
  rightGlow.name = 'engineGlow2';
  rightGlow.userData.sharedResource = true;
  group.add(rightGlow);

  // === 腹鳍 ===
  addMeshPart(group, new THREE.BoxGeometry(0.04, 0.3, 0.6), detailMaterial, [-0.4, -0.32, 1.2], {
    rotation: [0, 0, 0.35],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.04, 0.3, 0.6), detailMaterial, [0.4, -0.32, 1.2], {
    rotation: [0, 0, -0.35],
  });

  // === 翼下挂架 ===
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.18, 0.55), weaponMaterial, [-1.05, -0.2, 0.45]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.18, 0.55), weaponMaterial, [1.05, -0.2, 0.45]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.16, 0.5), weaponMaterial, [-1.65, -0.17, 0.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.16, 0.5), weaponMaterial, [1.65, -0.17, 0.6]);

  // === 翼尖导弹（发射轨 + 弹体）===
  for (const side of [1, -1] as const) {
    addMeshPart(group, new THREE.BoxGeometry(0.05, 0.07, 0.95), weaponMaterial, [
      side * 2.48,
      -0.03,
      0.3,
    ]);
    addStore(group, detailMaterial, weaponMaterial, [side * 2.48, -0.12, 0.25], 0.9, 0.05, -1);
  }

  // === 细节：空速管 / 天线 / 检修缝 / 编队灯 ===
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6),
    accentMaterial,
    [0, 0.02, -2.86],
    {
      rotation: [Math.PI / 2, 0, 0],
    }
  );
  addMeshPart(group, new THREE.BoxGeometry(0.03, 0.14, 0.2), detailMaterial, [0, 0.5, 0.35]);
  addMeshPart(group, new THREE.BoxGeometry(0.03, 0.12, 0.18), detailMaterial, [0, 0.46, 0.95]);
  addMeshPart(group, new THREE.BoxGeometry(0.9, 0.02, 0.14), detailMaterial, [-1.3, 0.04, 0.45], {
    rotation: [0, -0.3, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.9, 0.02, 0.14), detailMaterial, [1.3, 0.04, 0.45], {
    rotation: [0, 0.3, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.1, 0.02, 1.2), detailMaterial, [0, 0.47, 0.2]);

  // 机身侧编队灯条（低亮度）
  addMeshPart(
    group,
    new THREE.BoxGeometry(0.02, 0.04, 1.3),
    playerLightMaterial,
    [-0.61, 0.05, 0.2],
    {
      castShadow: false,
    }
  );
  addMeshPart(
    group,
    new THREE.BoxGeometry(0.02, 0.04, 1.3),
    playerLightMaterial,
    [0.61, 0.05, 0.2],
    {
      castShadow: false,
    }
  );

  // 机鼻传感器
  const noseSensor = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), playerLightMaterial);
  noseSensor.scale.set(0.7, 0.5, 1.2);
  noseSensor.position.set(0, -0.05, -2.3);
  group.add(noseSensor);

  // 翼尖航行灯（左红右绿）
  const leftNavLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), navRedMaterial);
  leftNavLight.position.set(-2.52, -0.02, -0.3);
  group.add(leftNavLight);
  const rightNavLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), navGreenMaterial);
  rightNavLight.position.set(2.52, -0.02, -0.3);
  group.add(rightNavLight);

  // 设置阴影
  group.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      !child.name.includes('Glow') &&
      !(child.material instanceof THREE.MeshBasicMaterial)
    ) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // 玩家机机头朝 -Z，机尾在 +Z
  addNavigationLights(group, 1);

  return group;
}

// ---------------------------------------------------------------------------
// 敌机：五种真实机型轮廓
// ---------------------------------------------------------------------------

interface EnemyBuildContext {
  group: THREE.Group;
  materials: CachedMaterials;
  weaponMaterial: THREE.MeshStandardMaterial;
  cavityMaterial: THREE.MeshStandardMaterial;
  bodySize: number;
  bodyLength: number;
  wingSpan: number;
}

/** 敌机座舱盖：染色玻璃气泡 + 风挡弓形框。 */
function addEnemyCanopy(
  ctx: EnemyBuildContext,
  position: [number, number, number],
  radius: number,
  scale: [number, number, number]
): void {
  addMeshPart(
    ctx.group,
    new THREE.SphereGeometry(radius, 12, 10),
    ctx.materials.cockpit,
    position,
    {
      scale,
    }
  );
  addMeshPart(
    ctx.group,
    new THREE.BoxGeometry(radius * scale[0] * 1.6, 0.05, 0.07),
    ctx.materials.accent,
    [position[0], position[1] + radius * scale[1] * 0.5, position[2] + radius * scale[2] * 0.72]
  );
}

/** 敌机引擎：喷管圆柱 + 尾焰锥（机尾 -Z 方向）。name 用于 'engineGlow' 查询。 */
function addEnemyEngine(
  ctx: EnemyBuildContext,
  position: [number, number, number],
  radius: number,
  options?: { name?: string; glowLength?: number }
): void {
  addMeshPart(
    ctx.group,
    new THREE.CylinderGeometry(radius, radius * 0.88, radius * 2.4, 10),
    ctx.materials.detail,
    position,
    { rotation: [Math.PI / 2, 0, 0] }
  );
  addMeshPart(
    ctx.group,
    new THREE.ConeGeometry(radius * 0.74, options?.glowLength ?? radius * 4, 8),
    ctx.materials.engine,
    [position[0], position[1], position[2] - radius * 1.7],
    {
      rotation: [-Math.PI / 2, 0, 0],
      castShadow: false,
      name: options?.name,
    }
  );
}

/** 敌机两侧进气道：箱体 + 斜切唇口 + 深色内腔（机头 +Z 方向）。 */
function addIntakePair(
  ctx: EnemyBuildContext,
  position: [number, number, number],
  size: [number, number, number],
  yaw: number
): void {
  for (const side of [1, -1] as const) {
    addMeshPart(
      ctx.group,
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      ctx.materials.body,
      [side * position[0], position[1], position[2]],
      { rotation: [0, -side * yaw, 0] }
    );
    addMeshPart(
      ctx.group,
      new THREE.BoxGeometry(size[0] * 1.05, size[1] * 0.2, size[2] * 0.26),
      ctx.materials.accent,
      [side * position[0], position[1] + size[1] * 0.48, position[2] + size[2] * 0.46],
      { rotation: [0.3, -side * yaw, 0] }
    );
    addMeshPart(
      ctx.group,
      new THREE.BoxGeometry(size[0] * 0.8, size[1] * 0.78, 0.12),
      ctx.cavityMaterial,
      [side * position[0], position[1], position[2] + size[2] * 0.5],
      { rotation: [0, -side * yaw, 0] }
    );
  }
}

/**
 * SCOUT - 轻型侦察机：纤细机身、平直大展弦比梯形翼、单发、
 * 机鼻下传感器球、V 型尾翼、翼尖侦察吊舱。
 */
function buildScout(ctx: EnemyBuildContext): void {
  const { group, materials, bodyLength, wingSpan } = ctx;
  const nose = bodyLength * 0.64;
  const tail = -bodyLength * 0.64;
  const halfSpan = wingSpan / 2;

  // 纤细旋成体机身
  addFuselage(
    group,
    [
      [0.03, tail],
      [0.13, tail + 0.7],
      [0.24, -2.2],
      [0.3, -0.6],
      [0.3, 0.9],
      [0.23, 2.3],
      [0.11, 3.4],
      [0.02, nose],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.05 }
  );

  // 机鼻下传感器球
  addMeshPart(group, new THREE.SphereGeometry(0.17, 10, 10), materials.cockpit, [0, -0.26, 3.05]);

  // 座舱
  addEnemyCanopy(ctx, [0, 0.27, 1.9], 0.26, [0.85, 0.62, 1.5]);

  // 平直大展弦比梯形翼（轻微上反）
  addWingPair(
    group,
    [
      [0, 0.55],
      [halfSpan - 0.28, 0.28],
      [halfSpan - 0.28, -0.2],
      [0, -0.55],
    ],
    0.05,
    materials.wing,
    [0.28, 0.18, -0.4],
    1,
    { dihedral: 0.09 }
  );

  // 翼尖侦察吊舱
  for (const side of [1, -1] as const) {
    addMeshPart(
      group,
      new THREE.CylinderGeometry(0.07, 0.07, 0.66, 8),
      materials.accent,
      [side * (halfSpan - 0.04), 0.18 + (halfSpan - 0.28) * 0.09, -0.36],
      { rotation: [Math.PI / 2, 0, 0] }
    );
  }

  // V 型尾翼
  addFinPair(
    group,
    [
      [0, 0],
      [0.8, 0.12],
      [0.55, 0.72],
      [0.12, 0.62],
    ],
    0.04,
    materials.wing,
    [0.18, 0.15, -3.5],
    1,
    0.6
  );

  // 单发引擎
  addEnemyEngine(ctx, [0, 0, -3.6], 0.2, { name: 'engineGlow', glowLength: 0.8 });

  // 侧面小进气口
  addIntakePair(ctx, [0.33, -0.02, 0.9], [0.16, 0.2, 0.5], 0.1);

  // 细节：天线 / 腹部纵鳍 / 检修缝 / 空速管 / 信标
  addMeshPart(group, new THREE.BoxGeometry(0.03, 0.16, 0.22), materials.detail, [0, 0.42, 0.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.03, 0.12, 0.2), materials.detail, [0, 0.36, -1.2]);
  addMeshPart(group, new THREE.BoxGeometry(0.05, 0.18, 1.0), materials.detail, [0, -0.32, -1.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 1.5), materials.detail, [-0.29, 0.04, 0.4]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 1.5), materials.detail, [0.29, 0.04, 0.4]);
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6),
    materials.detail,
    [0, 0, nose + 0.15],
    {
      rotation: [Math.PI / 2, 0, 0],
    }
  );
  addMeshPart(group, new THREE.SphereGeometry(0.06, 8, 8), materials.light, [0, 0.3, -0.5], {
    castShadow: false,
  });
}

/**
 * FIGHTER - 鸭式三角翼战斗机（台风/阵风风格）：
 * 大三角主翼、座舱旁鸭翼、单片高垂尾、下颌进气道、双发窄间距。
 */
function buildFighter(ctx: EnemyBuildContext): void {
  const { group, materials, weaponMaterial, cavityMaterial, bodyLength } = ctx;
  const nose = bodyLength * 0.65;
  const tail = -bodyLength * 0.655;

  // 旋成体机身
  addFuselage(
    group,
    [
      [0.04, tail],
      [0.18, -4.6],
      [0.34, -3.2],
      [0.46, -1.4],
      [0.5, 0.4],
      [0.45, 2.0],
      [0.32, 3.5],
      [0.16, 4.7],
      [0.02, nose],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.15, heightScale: 0.95 }
  );

  // 机头棱线
  addMeshPart(group, new THREE.BoxGeometry(0.3, 0.05, 1.8), materials.accent, [-0.18, -0.02, 4.0], {
    rotation: [0, 0.07, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.3, 0.05, 1.8), materials.accent, [0.18, -0.02, 4.0], {
    rotation: [0, -0.07, 0],
  });

  // 座舱
  addEnemyCanopy(ctx, [0, 0.42, 2.6], 0.3, [0.95, 0.65, 1.6]);

  // 大三角主翼
  addWingPair(
    group,
    [
      [0, 1.55],
      [3.0, -2.0],
      [3.0, -2.3],
      [0, -2.25],
    ],
    0.06,
    materials.wing,
    [0.4, -0.06, -1.05],
    1
  );

  // 鸭翼（座舱旁）
  addWingPair(
    group,
    [
      [0, 0.45],
      [1.0, -0.15],
      [1.0, -0.38],
      [0, -0.45],
    ],
    0.05,
    materials.wing,
    [0.48, 0.18, 2.45],
    1,
    { dihedral: 0.06 }
  );

  // 单片高垂尾
  addFin(
    group,
    [
      [0, 0],
      [1.6, 0.12],
      [1.0, 0.75],
      [0.38, 0.7],
    ],
    0.06,
    materials.wing,
    [0, 0.35, -4.85],
    1
  );

  // 下颌进气道
  addMeshPart(group, new THREE.BoxGeometry(0.6, 0.32, 1.3), materials.body, [0, -0.36, 2.2]);
  addMeshPart(group, new THREE.BoxGeometry(0.62, 0.08, 0.36), materials.accent, [0, -0.2, 2.9], {
    rotation: [-0.28, 0, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.24, 0.12), cavityMaterial, [0, -0.38, 2.84]);

  // 双发窄间距引擎（仅第一个命名 engineGlow）
  addEnemyEngine(ctx, [-0.26, 0, -5.35], 0.24, { name: 'engineGlow', glowLength: 0.9 });
  addEnemyEngine(ctx, [0.26, 0, -5.35], 0.24, { glowLength: 0.9 });

  // 翼尖导弹 + 发射轨
  for (const side of [1, -1] as const) {
    addMeshPart(group, new THREE.BoxGeometry(0.05, 0.06, 1.1), weaponMaterial, [
      side * 3.32,
      -0.04,
      -2.0,
    ]);
    addStore(group, materials.detail, weaponMaterial, [side * 3.32, -0.12, -2.0], 1.1, 0.07, 1);
  }

  // 翼下挂架
  addMeshPart(group, new THREE.BoxGeometry(0.08, 0.22, 0.7), weaponMaterial, [-1.6, -0.22, -1.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.08, 0.22, 0.7), weaponMaterial, [1.6, -0.22, -1.6]);

  // 背脊整流罩 / 检修缝 / 信标 / 空速管
  addMeshPart(group, new THREE.BoxGeometry(0.24, 0.12, 2.6), materials.body, [0, 0.42, 0.2]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 2.0), materials.detail, [-0.46, 0.05, 0.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 2.0), materials.detail, [0.46, 0.05, 0.6]);
  addMeshPart(group, new THREE.SphereGeometry(0.07, 8, 8), materials.light, [0, 0.4, -2.0], {
    castShadow: false,
  });
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6),
    materials.detail,
    [0, 0, nose + 0.18],
    {
      rotation: [Math.PI / 2, 0, 0],
    }
  );
}

/**
 * HEAVY - 重型打击平台：宽扁机身、后掠下反翼、
 * 双发短舱、四个翼下挂架挂炸弹、外倾双垂尾。
 */
function buildHeavy(ctx: EnemyBuildContext): void {
  const { group, materials, weaponMaterial, cavityMaterial, bodyLength, wingSpan } = ctx;
  const nose = bodyLength * 0.645;
  const halfSpan = wingSpan / 2;

  // 宽扁旋成体机身
  addFuselage(
    group,
    [
      [0.06, -6.7],
      [0.3, -5.6],
      [0.56, -4.0],
      [0.78, -2.0],
      [0.86, 0],
      [0.83, 1.8],
      [0.68, 3.5],
      [0.42, 5.1],
      [0.18, 6.3],
      [0.03, nose],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.65, heightScale: 0.8 }
  );

  // 宽座舱
  addEnemyCanopy(ctx, [0, 0.56, 4.5], 0.34, [1.25, 0.6, 1.5]);

  // 后掠下反主翼
  addWingPair(
    group,
    [
      [0, 1.4],
      [halfSpan - 0.95, -1.2],
      [halfSpan - 0.95, -1.9],
      [0, -1.5],
    ],
    0.1,
    materials.wing,
    [0.95, 0.4, -0.7],
    1,
    { dihedral: -0.09 }
  );

  // 双发引擎短舱（机身两侧）+ 进气唇口 + 深色内腔
  for (const side of [1, -1] as const) {
    addMeshPart(
      group,
      new THREE.CylinderGeometry(0.42, 0.38, 3.2, 10),
      materials.body,
      [side * 1.35, -0.05, -4.4],
      { rotation: [Math.PI / 2, 0, 0] }
    );
    addMeshPart(
      group,
      new THREE.CylinderGeometry(0.45, 0.45, 0.16, 10),
      materials.accent,
      [side * 1.35, -0.05, -2.86],
      { rotation: [Math.PI / 2, 0, 0] }
    );
    addMeshPart(
      group,
      new THREE.CylinderGeometry(0.34, 0.34, 0.1, 10),
      cavityMaterial,
      [side * 1.35, -0.05, -2.78],
      { rotation: [Math.PI / 2, 0, 0] }
    );
  }
  // 喷焰（圆柱状尾焰，仅第一个命名 engineGlow）
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.3, 0.34, 0.9, 8),
    materials.engine,
    [-1.35, -0.05, -6.3],
    {
      rotation: [Math.PI / 2, 0, 0],
      name: 'engineGlow',
      castShadow: false,
    }
  );
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.3, 0.34, 0.9, 8),
    materials.engine,
    [1.35, -0.05, -6.3],
    {
      rotation: [Math.PI / 2, 0, 0],
      castShadow: false,
    }
  );

  // 外倾双垂尾
  addFinPair(
    group,
    [
      [0, 0],
      [1.6, 0.15],
      [0.95, 1.05],
      [0.3, 0.95],
    ],
    0.07,
    materials.wing,
    [0.95, 0.55, -6.6],
    1,
    0.1
  );

  // 平尾
  addWingPair(
    group,
    [
      [0, 0.75],
      [2.0, -0.55],
      [2.0, -0.95],
      [0, -0.85],
    ],
    0.07,
    materials.wing,
    [0.5, 0.6, -5.9],
    1,
    { dihedral: 0.05 }
  );

  // 四个翼下挂架 + 炸弹
  for (const side of [1, -1] as const) {
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.3, 0.9), weaponMaterial, [
      side * 2.3,
      0.1,
      -1.2,
    ]);
    addStore(group, weaponMaterial, materials.detail, [side * 2.3, -0.18, -1.1], 1.5, 0.17, 1);
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.26, 0.8), weaponMaterial, [
      side * 3.5,
      0,
      -1.5,
    ]);
    addStore(group, weaponMaterial, materials.detail, [side * 3.5, -0.26, -1.4], 1.3, 0.15, 1);
  }

  // 腹部龙骨 / 检修缝 / 信标
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.14, 3.0), materials.detail, [0, -0.62, 0.4]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.04, 3.4), materials.detail, [-1.0, 0.2, 0.8]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.04, 3.4), materials.detail, [1.0, 0.2, 0.8]);
  addMeshPart(group, new THREE.SphereGeometry(0.08, 8, 8), materials.light, [0, 0.62, 0.6], {
    castShadow: false,
  });
}

/**
 * SNIPER - 远程截击机（米格-31 风格）：超长尖锐机头、
 * 巨大侧置进气道、双发大间距、双垂尾 + 腹鳍、中置细长后掠翼。
 */
function buildSniper(ctx: EnemyBuildContext): void {
  const { group, materials, bodyLength } = ctx;
  const nose = bodyLength * 0.63;
  const tail = -bodyLength * 0.615;

  // 细长旋成体机身（超长机头）
  addFuselage(
    group,
    [
      [0.04, tail],
      [0.2, -5.4],
      [0.34, -3.6],
      [0.44, -1.4],
      [0.46, 0.6],
      [0.4, 2.4],
      [0.27, 4.0],
      [0.13, 5.5],
      [0.02, nose],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.2, heightScale: 0.95 }
  );

  // 长机头棱线
  addMeshPart(group, new THREE.BoxGeometry(0.24, 0.04, 2.6), materials.accent, [-0.14, 0, 4.4], {
    rotation: [0, 0.05, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.24, 0.04, 2.6), materials.accent, [0.14, 0, 4.4], {
    rotation: [0, -0.05, 0],
  });

  // 纵列双座长座舱
  addEnemyCanopy(ctx, [0, 0.36, 3.3], 0.28, [0.8, 0.55, 2.1]);

  // 背脊
  addMeshPart(group, new THREE.BoxGeometry(0.3, 0.14, 4.6), materials.body, [0, 0.4, -0.6]);

  // 巨大侧置进气道
  addIntakePair(ctx, [0.66, -0.02, 1.7], [0.5, 0.6, 2.6], 0.04);

  // 中置细长后掠翼（轻微下反）
  addWingPair(
    group,
    [
      [0, 1.15],
      [1.6, -0.25],
      [1.6, -0.65],
      [0, -1.05],
    ],
    0.06,
    materials.wing,
    [0.66, 0.05, -1.3],
    1,
    { dihedral: -0.04 }
  );

  // 平尾
  addWingPair(
    group,
    [
      [0, 0.6],
      [1.4, -0.4],
      [1.4, -0.66],
      [0, -0.66],
    ],
    0.05,
    materials.wing,
    [0.46, 0.08, -5.6],
    1
  );

  // 双垂尾（外倾）
  addFinPair(
    group,
    [
      [0, 0],
      [1.4, 0.1],
      [0.8, 0.7],
      [0.25, 0.65],
    ],
    0.06,
    materials.wing,
    [0.52, 0.32, -5.9],
    1,
    0.16
  );

  // 腹鳍（向外张开）
  addMeshPart(group, new THREE.BoxGeometry(0.04, 0.36, 0.8), materials.detail, [-0.4, -0.4, -5.3], {
    rotation: [0, 0, 0.45],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.04, 0.36, 0.8), materials.detail, [0.4, -0.4, -5.3], {
    rotation: [0, 0, -0.45],
  });

  // 双发大间距引擎（仅第一个命名 engineGlow）
  addEnemyEngine(ctx, [-0.42, -0.04, -6.1], 0.24, { name: 'engineGlow', glowLength: 0.9 });
  addEnemyEngine(ctx, [0.42, -0.04, -6.1], 0.24, { glowLength: 0.9 });

  // 长空速管 / 检修缝 / 信标
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6),
    materials.detail,
    [0, 0.02, nose + 0.28],
    {
      rotation: [Math.PI / 2, 0, 0],
    }
  );
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 2.6), materials.detail, [-0.43, 0.06, 0.2]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 2.6), materials.detail, [0.43, 0.06, 0.2]);
  addMeshPart(group, new THREE.SphereGeometry(0.07, 8, 8), materials.light, [0, 0.5, -2.6], {
    castShadow: false,
  });
}

/**
 * ACE - 前掠翼试验机（苏-47 风格）：前掠主翼、鸭翼、
 * 外倾双垂尾、双发、精英专属的发光饰条。
 */
function buildAce(ctx: EnemyBuildContext): void {
  const { group, materials, weaponMaterial, bodyLength } = ctx;
  const nose = bodyLength * 0.63;
  const tail = -bodyLength * 0.64;

  // 旋成体机身
  addFuselage(
    group,
    [
      [0.05, tail],
      [0.22, -4.7],
      [0.4, -3.2],
      [0.53, -1.4],
      [0.56, 0.4],
      [0.5, 2.0],
      [0.34, 3.5],
      [0.16, 4.8],
      [0.02, nose],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.3, heightScale: 0.92 }
  );

  // 机头棱线
  addMeshPart(group, new THREE.BoxGeometry(0.32, 0.05, 1.9), materials.accent, [-0.2, 0.02, 4.0], {
    rotation: [0, 0.08, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.32, 0.05, 1.9), materials.accent, [0.2, 0.02, 4.0], {
    rotation: [0, -0.08, 0],
  });

  // 座舱
  addEnemyCanopy(ctx, [0, 0.46, 2.5], 0.3, [0.95, 0.66, 1.55]);

  // 前掠主翼（翼尖朝前，苏-47 标志性轮廓）
  addWingPair(
    group,
    [
      [0, 0.7],
      [3.1, 2.1],
      [3.1, 1.5],
      [0, -2.0],
    ],
    0.07,
    materials.wing,
    [0.6, 0.08, -1.7],
    1,
    { dihedral: 0.02 }
  );

  // 鸭翼
  addWingPair(
    group,
    [
      [0, 0.5],
      [1.15, -0.1],
      [1.15, -0.38],
      [0, -0.55],
    ],
    0.05,
    materials.wing,
    [0.52, 0.2, 2.35],
    1,
    { dihedral: 0.08 }
  );

  // 外倾双垂尾
  addFinPair(
    group,
    [
      [0, 0],
      [1.45, 0.12],
      [0.85, 0.8],
      [0.3, 0.74],
    ],
    0.06,
    materials.wing,
    [0.62, 0.4, -4.9],
    1,
    0.26
  );

  // 平尾
  addWingPair(
    group,
    [
      [0, 0.5],
      [1.4, -0.32],
      [1.4, -0.58],
      [0, -0.58],
    ],
    0.05,
    materials.wing,
    [0.52, 0.06, -5.0],
    1
  );

  // 双发引擎（仅第一个命名 engineGlow）
  addEnemyEngine(ctx, [-0.32, -0.02, -5.6], 0.24, { name: 'engineGlow', glowLength: 0.9 });
  addEnemyEngine(ctx, [0.32, -0.02, -5.6], 0.24, { glowLength: 0.9 });

  // 侧置进气道
  addIntakePair(ctx, [0.74, -0.12, 0.9], [0.4, 0.5, 1.6], 0.05);

  // 精英发光饰条：翼根沿前掠前缘 + 背脊 + 尾部环带
  addMeshPart(group, new THREE.BoxGeometry(1.4, 0.03, 0.12), materials.light, [-1.3, 0.16, -0.7], {
    rotation: [0, -0.42, 0],
    castShadow: false,
  });
  addMeshPart(group, new THREE.BoxGeometry(1.4, 0.03, 0.12), materials.light, [1.3, 0.16, -0.7], {
    rotation: [0, 0.42, 0],
    castShadow: false,
  });
  addMeshPart(group, new THREE.BoxGeometry(0.06, 0.03, 2.4), materials.light, [0, 0.52, 0], {
    castShadow: false,
  });
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.03, 0.08), materials.light, [0, 0.34, -4.2], {
    castShadow: false,
  });

  // 翼尖导弹 + 发射轨
  for (const side of [1, -1] as const) {
    addMeshPart(group, new THREE.BoxGeometry(0.05, 0.06, 1.2), weaponMaterial, [
      side * 3.62,
      0.16,
      0.85,
    ]);
    addStore(group, materials.detail, weaponMaterial, [side * 3.62, 0.07, 0.85], 1.2, 0.07, 1);
  }

  // 检修缝 / 空速管
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 2.2), materials.detail, [-0.52, 0.08, 0.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.03, 2.2), materials.detail, [0.52, 0.08, 0.6]);
  addMeshPart(
    group,
    new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6),
    materials.detail,
    [0, 0.02, nose + 0.18],
    {
      rotation: [Math.PI / 2, 0, 0],
    }
  );
}

/**
 * 创建敌机模型 - 五种真实机型轮廓（机头朝 +Z，机尾在 -Z）
 */
export function createEnemyMesh(config: EnemyConfig): THREE.Group {
  const group = new THREE.Group();

  let bodyColor: number;
  let wingColor: number;
  let accentColor: number;
  let bodySize = 1.6;
  let bodyLength = 6;
  let wingSpan = 3;
  let scaleMultiplier = 1;

  switch (config.type) {
    case EnemyType.SCOUT:
      bodyColor = 0xc5ccd3;
      wingColor = 0x9ea8b3;
      accentColor = 0x566472;
      bodySize = 1.42;
      bodyLength = 6.2;
      wingSpan = 5.4;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.FIGHTER:
      bodyColor = 0xc9d0d6;
      wingColor = 0xa8b2bc;
      accentColor = 0x56616d;
      bodySize = 1.86;
      bodyLength = 8.4;
      wingSpan = 7.4;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.HEAVY:
      bodyColor = 0xb0b7bf;
      wingColor = 0x8f98a3;
      accentColor = 0x4b5560;
      bodySize = 2.52;
      bodyLength = 10.6;
      wingSpan = 10.8;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.SNIPER:
      bodyColor = 0xc2cad2;
      wingColor = 0x9aa5af;
      accentColor = 0x4f5d6a;
      bodySize = 1.6;
      bodyLength = 10.4;
      wingSpan = 6.6;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.ACE:
      bodyColor = 0xd0d4d8;
      wingColor = 0xa5adb6;
      accentColor = 0x7a5046;
      bodySize = 2.04;
      bodyLength = 8.8;
      wingSpan = 7.8;
      scaleMultiplier = 2.0;
      break;
    default:
      bodyColor = config.color;
      wingColor = config.color;
      accentColor = config.color;
  }

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  const materials = getOrCreateMaterials(config.type, bodyColor, wingColor, accentColor);
  const weaponMaterial = createAircraftMaterial(accentColor, 0.88, 0.24, 0.02);
  const cavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x161a20,
    metalness: 0.42,
    roughness: 0.72,
  });

  const ctx: EnemyBuildContext = {
    group,
    materials,
    weaponMaterial,
    cavityMaterial,
    bodySize,
    bodyLength,
    wingSpan,
  };

  switch (config.type) {
    case EnemyType.SCOUT:
      buildScout(ctx);
      break;
    case EnemyType.FIGHTER:
      buildFighter(ctx);
      break;
    case EnemyType.HEAVY:
      buildHeavy(ctx);
      break;
    case EnemyType.SNIPER:
      buildSniper(ctx);
      break;
    case EnemyType.ACE:
    default:
      buildAce(ctx);
      break;
  }

  // 敌机机头朝 +Z，机尾在 -Z
  addNavigationLights(group, -1);

  group.name = config.type;
  return group;
}

/**
 * 创建友军飞机模型 - 与敌机相同但标记为友军
 */
export function createFriendlyMesh(config: EnemyConfig): THREE.Group {
  return createEnemyMesh(config);
}
