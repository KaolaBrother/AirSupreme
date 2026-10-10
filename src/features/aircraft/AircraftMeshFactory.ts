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
 *
 * 三个阵营一眼可辨：
 * - 玩家机：浅灰 / 白机体，橙色尾焰，座舱盖；
 * - 友军僚机：玩家机同族的独立机体，钢蓝 + 金色识别，金色频闪，座舱盖；
 * - 敌方无人机：深炮铜 / 炭黑机体（与敌方地面 / 海上单位同族），红色自发光饰条、红色尾焰，
 *   没有座舱玻璃（红色传感器“独眼”），没有红绿航行灯，全机不出现金 / 黄色。
 *
 * 敌机与友军机的根节点声明 userData.hitRadius（米）= 2.5 × 机体缩放，
 * 以及 userData.faction（Faction.ENEMY / Faction.FRIENDLY，与单位网格的约定一致）。
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Faction } from '@/core/Faction';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';

type EnemyConfig = (typeof ENEMY_CONFIGS)[EnemyType];

interface CachedMaterials {
  body: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  /** 友军：座舱玻璃；敌方无人机：传感器整流罩的不透明外壳 */
  cockpit: THREE.MeshStandardMaterial;
  engine: THREE.MeshBasicMaterial;
  accent: THREE.MeshStandardMaterial;
  detail: THREE.MeshStandardMaterial;
  light: THREE.MeshBasicMaterial;
  weapon: THREE.MeshStandardMaterial;
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

/**
 * 敌方无人机涂装：与敌方地面 / 海上单位同族（取值对齐 UnitMeshKit 的 hHull / hDark / hRed / hGlow）。
 * 场景没有环境贴图，金属度高的深色机体只剩高光、近乎全黑，所以机体金属度取低值，
 * 并给一点冷灰自发光下限：夜间 / 深色背景下靠它和红色自发光饰条撑起轮廓。
 * 全机不出现金 / 黄色（金色只代表友军）；紫色保留给电子干扰机。
 */
const HOSTILE_LIVERY = {
  /** 深炮铜机体（hHull） */
  hull: 0x3b4048,
  /** 炭黑翼面 / 传感器整流罩（hDark） */
  hullDark: 0x1e2228,
  /** 机体自发光下限的色调（冷灰） */
  hullEmissive: 0x6c7a8c,
  /** 红色识别饰条（hRed） */
  accent: 0xc4252d,
  /**
   * 红色辉光：饰条自发光、传感器“独眼”、尾焰。比 hGlow（0xff3b2b）更纯的红：对局用 ACES
   * 色调映射，亮红会偏橙，这个取值映射后在屏幕上约为 #fe3422，仍是红而不是玩家 / 友军的橙。
   */
  glow: 0xff2018,
  /** 王牌机的精英标记：亮绯红饰条 + 白热灯条 */
  eliteAccent: 0xe5102e,
  eliteGlow: 0xff1238,
  eliteTrim: 0xffe9e0,
  /** 棱线 / 检修缝 / 喷管壳体的钢灰（深色机体上的边缘高光） */
  edge: 0x7c8693,
  /** 挂架与弹体 */
  weapon: 0x59606a,
  /** 电子干扰环的紫色：敌机上唯一的非红色识别，只代表“正在干扰”（与 JAMMER 配置色一致） */
  ecm: 0x9a4dff,
  ecmBright: 0xc7a0ff,
} as const;

function getEnemyMaterialTuning(type: EnemyType): {
  /** 机体 / 翼面的冷灰自发光强度 */
  hullGlow: number;
  /** 识别饰条的自发光颜色与强度 */
  accentEmissive: number;
  accentGlow: number;
  /** 辉光件（传感器“独眼”、灯条）颜色 */
  lightColor: number;
  detailColor: number;
  engineOpacity: number;
  /** 哑光棱面机体（幽灵机）：几乎不反光、按面着色 */
  matteHull?: boolean;
} {
  switch (type) {
    case EnemyType.WRAITH:
      // 哑光黑：自发光下限压到最低（再高机体就成了灰色），轮廓交给红色棱线
      return {
        hullGlow: 0.06,
        accentEmissive: HOSTILE_LIVERY.glow,
        accentGlow: 0.6,
        lightColor: HOSTILE_LIVERY.glow,
        detailColor: HOSTILE_LIVERY.edge,
        engineOpacity: 0.6,
        matteHull: true,
      };
    case EnemyType.SCOUT:
      // 机体最小：自发光与尾焰略强，远处仍能看见
      return {
        hullGlow: 0.36,
        accentEmissive: HOSTILE_LIVERY.glow,
        accentGlow: 0.7,
        lightColor: HOSTILE_LIVERY.glow,
        detailColor: HOSTILE_LIVERY.edge,
        engineOpacity: 0.72,
      };
    case EnemyType.HEAVY:
      return {
        hullGlow: 0.28,
        accentEmissive: HOSTILE_LIVERY.glow,
        accentGlow: 0.6,
        lightColor: HOSTILE_LIVERY.glow,
        detailColor: 0x6d7682,
        engineOpacity: 0.66,
      };
    case EnemyType.ACE:
      return {
        hullGlow: 0.2,
        accentEmissive: HOSTILE_LIVERY.eliteGlow,
        accentGlow: 0.85,
        lightColor: HOSTILE_LIVERY.eliteGlow,
        detailColor: HOSTILE_LIVERY.edge,
        engineOpacity: 0.7,
      };
    case EnemyType.FIGHTER:
    case EnemyType.SNIPER:
    default:
      return {
        hullGlow: 0.3,
        accentEmissive: HOSTILE_LIVERY.glow,
        accentGlow: 0.6,
        lightColor: HOSTILE_LIVERY.glow,
        detailColor: HOSTILE_LIVERY.edge,
        engineOpacity: 0.66,
      };
  }
}

function createHostileHullMaterial(
  color: number,
  glow: number,
  matte: boolean = false
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: matte ? 0.04 : 0.34,
    roughness: matte ? 0.94 : 0.56,
    emissive: HOSTILE_LIVERY.hullEmissive,
    emissiveIntensity: glow,
    // 哑光机体按面着色：棱面之间是硬折线（普通材质开关，不是自定义着色器）
    flatShading: matte,
  });
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
    body: createHostileHullMaterial(bodyColor, tuning.hullGlow, tuning.matteHull),
    // 翼面的自发光下限更低：暗处机身比翼面亮一档，轮廓有层次
    wing: createHostileHullMaterial(wingColor, tuning.hullGlow * 0.6, tuning.matteHull),
    cockpit: createAircraftMaterial(HOSTILE_LIVERY.hullDark, 0.5, 0.36, 0.1),
    engine: (() => {
      const engineMaterial = new THREE.MeshBasicMaterial({
        color: HOSTILE_LIVERY.glow,
        transparent: true,
        opacity: tuning.engineOpacity,
      });
      registerEngineGlowMaterial(engineMaterial);
      return engineMaterial;
    })(),
    accent: new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.2,
      roughness: 0.48,
      emissive: tuning.accentEmissive,
      emissiveIntensity: tuning.accentGlow,
    }),
    // 钢灰边缘高光带一半自发光：暗处仍是一条可见的冷色细线
    detail: createAircraftMaterial(tuning.detailColor, 0.45, 0.55, 0.5),
    light: new THREE.MeshBasicMaterial({ color: tuning.lightColor }),
    weapon: createAircraftMaterial(HOSTILE_LIVERY.weapon, 0.5, 0.45, 0.03),
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
// 友军敌我识别灯：金色频闪 + 金色呼吸信标（与 HUD 友军色一致），替换友军机上的白频闪/红信标
const alliedSignalMaterials = {
  strobe: new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85 }),
  beacon: new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.55 }),
};
// 电子干扰机的紫色干扰环：内圈 / 外圈两种共享材质，同样由 updateAircraftSignals 驱动
// （内圈领先、外圈随后，读作一圈圈向外扩散的干扰波），不需要逐机逐帧的代码
const ecmRingMaterials = {
  inner: new THREE.MeshBasicMaterial({
    color: HOSTILE_LIVERY.ecmBright,
    transparent: true,
    opacity: 0.9,
  }),
  outer: new THREE.MeshBasicMaterial({
    color: HOSTILE_LIVERY.ecm,
    transparent: true,
    opacity: 0.9,
  }),
};

/** 一架飞机的四盏包围盒信号灯（左 / 右翼尖、机尾、机腹）各用哪种材质 */
interface SignalLightSet {
  port: THREE.Material;
  starboard: THREE.Material;
  strobe: THREE.Material;
  beacon: THREE.Material;
}
/** 玩家机：左红右绿航行灯 + 白色双闪 + 红色防撞灯 */
const playerSignalLights: SignalLightSet = signalLightMaterials;
/** 友军僚机：左红右绿航行灯 + 金色识别频闪 / 信标 */
const alliedSignalLights: SignalLightSet = {
  port: signalLightMaterials.port,
  starboard: signalLightMaterials.starboard,
  strobe: alliedSignalMaterials.strobe,
  beacon: alliedSignalMaterials.beacon,
};
/**
 * 敌方无人机：没有红绿航行灯——两个翼尖都是红色位置灯，机尾 / 机腹是红色呼吸信标。
 * 复用已有的两种红色材质，不新增逐帧驱动。
 */
const hostileSignalLights: SignalLightSet = {
  port: signalLightMaterials.port,
  starboard: signalLightMaterials.port,
  strobe: signalLightMaterials.beacon,
  beacon: signalLightMaterials.beacon,
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

/**
 * 推进共享信号灯动画。所有飞机共享同一组材质，每帧只需调用一次。
 */
export function updateAircraftSignals(deltaTime: number): void {
  signalClock = (signalClock + deltaTime) % 3600;

  // 真实频闪灯模式：1.2 秒周期内两次短促白闪
  const strobePhase = signalClock % 1.2;
  const strobeOn = strobePhase < 0.06 || (strobePhase >= 0.16 && strobePhase < 0.22);
  signalLightMaterials.strobe.opacity = strobeOn ? 0.95 : 0.05;
  // 友军金色识别频闪：与白频闪错相，保证同屏两种闪光可区分
  const alliedPhase = (signalClock + 0.6) % 1.2;
  const alliedOn = alliedPhase < 0.08 || (alliedPhase >= 0.18 && alliedPhase < 0.26);
  alliedSignalMaterials.strobe.opacity = alliedOn ? 1 : 0.12;

  // 防撞灯呼吸式脉冲
  signalLightMaterials.beacon.opacity = 0.2 + (Math.sin(signalClock * 4.6) * 0.5 + 0.5) * 0.6;
  alliedSignalMaterials.beacon.opacity = 0.35 + (Math.sin(signalClock * 3.2) * 0.5 + 0.5) * 0.6;

  // 电子干扰环：约 1.2 秒一拍，内圈领先外圈约四分之一拍
  const ecmPhase = signalClock * 5.2;
  ecmRingMaterials.inner.opacity = 0.3 + (Math.sin(ecmPhase) * 0.5 + 0.5) * 0.7;
  ecmRingMaterials.outer.opacity = 0.4 + (Math.sin(ecmPhase - 1.5) * 0.5 + 0.5) * 0.6;

  // 引擎尾焰高频轻微抖动
  const flicker =
    0.88 + Math.sin(signalClock * 31) * 0.07 + Math.sin(signalClock * 53 + 1.7) * 0.05;
  for (const material of engineGlowMaterials) {
    const base = (material.userData.baseOpacity as number | undefined) ?? 0.25;
    material.opacity = base * flicker;
  }
}

// ---------------------------------------------------------------------------
// 共享细节资源：单位几何体（建模时按需 scale）+ 跨机型通用材质。
// 模块级常量跨所有飞机实例复用，配合 userData.sharedResource 防止随单机销毁释放。
// ---------------------------------------------------------------------------
const sharedGeometries = {
  /** 单位盒：杆、条、框、挂架、识别带等细节 */
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  /** 单位圆柱：天线杆、空速管、炮管、翼尖/垂尾吊舱 */
  unitCylinder: new THREE.CylinderGeometry(1, 1, 1, 6),
  /** 单位球：座舱盖气泡与菲涅尔镶边壳 */
  unitSphere: new THREE.SphereGeometry(1, 12, 10),
  /** 单位锥：弹头、加力外焰 */
  unitCone: new THREE.ConeGeometry(1, 1, 8),
  /** 喷口收敛外环（开口圆柱，窄端朝 -Y） */
  nozzleRing: new THREE.CylinderGeometry(1, 0.84, 1, 10, 1, true),
  /** 喷口深色内喉（开口收敛筒） */
  nozzleThroat: new THREE.CylinderGeometry(0.8, 0.6, 1, 10, 1, true),
  /** 加力核心亮盘 */
  afterburnerDisc: new THREE.CircleGeometry(1, 10),
  /** 挂载弹体（顶径 1 → 底径 0.92，比例与旧 addStore 一致） */
  storeBody: new THREE.CylinderGeometry(1, 0.92, 1, 8),
};

const nozzleMetalMaterial = new THREE.MeshStandardMaterial({
  color: 0x474c52,
  metalness: 0.92,
  roughness: 0.34,
});
const nozzleThroatMaterial = new THREE.MeshStandardMaterial({
  color: 0x111418,
  metalness: 0.56,
  roughness: 0.82,
});
const canopyFrameMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a3138,
  metalness: 0.86,
  roughness: 0.3,
});
// 菲涅尔式座舱镶边：背面渲染的淡亮壳，廉价模拟玻璃边缘反光（无自定义 shader）
const canopyRimMaterial = new THREE.MeshBasicMaterial({
  color: 0x9fd2ee,
  transparent: true,
  opacity: 0.13,
  side: THREE.BackSide,
  depthWrite: false,
});
// 分层加力尾焰（叠加混合）：注册进引擎闪烁驱动，与现有尾焰同步抖动
const afterburnerCoreMaterial = new THREE.MeshBasicMaterial({
  color: 0xffe2ae,
  transparent: true,
  opacity: 0.78,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
registerEngineGlowMaterial(afterburnerCoreMaterial);
const afterburnerHaloMaterial = new THREE.MeshBasicMaterial({
  color: 0xff7a2c,
  transparent: true,
  opacity: 0.22,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
registerEngineGlowMaterial(afterburnerHaloMaterial);
// 敌方无人机的分层尾焰：红色（白热偏红的核心 + 红色外焰），同样注册进引擎闪烁驱动
const hostileBurnerCoreMaterial = new THREE.MeshBasicMaterial({
  color: 0xff7a62,
  transparent: true,
  opacity: 0.82,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
registerEngineGlowMaterial(hostileBurnerCoreMaterial);
const hostileBurnerHaloMaterial = new THREE.MeshBasicMaterial({
  color: 0xff2014,
  transparent: true,
  opacity: 0.36,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
registerEngineGlowMaterial(hostileBurnerHaloMaterial);

/** 喷口的两层叠加尾焰（核心亮盘 + 外层淡焰锥）用哪一组材质 */
interface ExhaustFlameMaterials {
  core: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
}
/** 橙金尾焰：友军僚机 */
const alliedExhaustFlame: ExhaustFlameMaterials = {
  core: afterburnerCoreMaterial,
  halo: afterburnerHaloMaterial,
};
/** 红色尾焰：敌方无人机 */
const hostileExhaustFlame: ExhaustFlameMaterials = {
  core: hostileBurnerCoreMaterial,
  halo: hostileBurnerHaloMaterial,
};
// 敌机进气道内腔：所有机型同色，模块级共享
const enemyCavityMaterial = new THREE.MeshStandardMaterial({
  color: 0x161a20,
  metalness: 0.42,
  roughness: 0.72,
});
// 王牌机的精英白热灯条（只有王牌机使用，模块级共享）
const eliteTrimMaterial = new THREE.MeshBasicMaterial({ color: HOSTILE_LIVERY.eliteTrim });

/**
 * 信号灯的指定挂点（机体本地坐标；wingtip 给 +X 侧，另一侧镜像）。包围盒推算在后掠尖翼尖、
 * 背负天线罩这类外形上会把灯放到机体外的空中，这些机型自己给出挂点。
 */
interface SignalLightAnchors {
  wingtip: [number, number, number];
  tail: [number, number, number];
  belly: [number, number, number];
}

/**
 * 依据机体包围盒追加航空灯组。tailDirection 指向机尾（+1 表示尾部在 +Z）。
 * lights 决定四盏灯的材质（玩家 / 友军 / 敌方各一组）；网格名三个阵营一致，机库按名字隐藏。
 * anchors 给出时四盏灯改放在指定挂点上。
 */
function addNavigationLights(
  group: THREE.Group,
  tailDirection: 1 | -1,
  lights: SignalLightSet,
  anchors?: SignalLightAnchors
): void {
  const bounds = new THREE.Box3().setFromObject(group);
  if (bounds.isEmpty()) {
    return;
  }
  // setFromObject 含 group 自身缩放，而灯具以 group 本地坐标定位 → 换算回本地空间，
  // 避免缩放后的机体（敌机 scale=2）把灯具放到机体外两倍距离处
  bounds.min.divide(group.scale);
  bounds.max.divide(group.scale);
  const center = bounds.getCenter(new THREE.Vector3());

  const portLight = new THREE.Mesh(signalLightGeometry, lights.port);
  if (anchors) {
    portLight.position.set(-anchors.wingtip[0], anchors.wingtip[1], anchors.wingtip[2]);
  } else {
    portLight.position.set(bounds.min.x + 0.06, center.y + 0.02, center.z);
  }
  portLight.name = 'navLightPort';
  portLight.userData.sharedResource = true;
  group.add(portLight);

  const starboardLight = new THREE.Mesh(signalLightGeometry, lights.starboard);
  if (anchors) {
    starboardLight.position.set(anchors.wingtip[0], anchors.wingtip[1], anchors.wingtip[2]);
  } else {
    starboardLight.position.set(bounds.max.x - 0.06, center.y + 0.02, center.z);
  }
  starboardLight.name = 'navLightStarboard';
  starboardLight.userData.sharedResource = true;
  group.add(starboardLight);

  const tailZ = tailDirection > 0 ? bounds.max.z - 0.08 : bounds.min.z + 0.08;
  const strobeLight = new THREE.Mesh(signalLightGeometry, lights.strobe);
  if (anchors) {
    strobeLight.position.set(anchors.tail[0], anchors.tail[1], anchors.tail[2]);
  } else {
    strobeLight.position.set(center.x, center.y + (bounds.max.y - center.y) * 0.55, tailZ);
  }
  strobeLight.scale.setScalar(0.85);
  strobeLight.name = 'strobeLight';
  strobeLight.userData.sharedResource = true;
  group.add(strobeLight);

  const beaconLight = new THREE.Mesh(signalLightGeometry, lights.beacon);
  if (anchors) {
    beaconLight.position.set(anchors.belly[0], anchors.belly[1], anchors.belly[2]);
  } else {
    beaconLight.position.set(center.x, bounds.min.y + 0.05, center.z);
  }
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
    /** 几何体与材质均为跨机体共享资源，销毁单机时不随之 dispose */
    shared?: boolean;
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

  if (options?.shared) {
    mesh.userData.sharedResource = true;
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
 * 几何体全部取自模块级共享单位几何体（按需 scale）。
 * shared = true 表示弹体/尾翼材质也是跨机体共享（缓存）材质。
 */
function addStore(
  group: THREE.Group,
  bodyMaterial: THREE.Material,
  finMaterial: THREE.Material,
  position: [number, number, number],
  length: number,
  radius: number,
  forward: 1 | -1,
  shared: boolean = false
): void {
  addMeshPart(group, sharedGeometries.storeBody, bodyMaterial, position, {
    rotation: [Math.PI / 2, 0, 0],
    scale: [radius, length, radius],
    shared,
  });
  addMeshPart(
    group,
    sharedGeometries.unitCone,
    bodyMaterial,
    [position[0], position[1], position[2] + forward * (length / 2 + length * 0.13)],
    {
      rotation: [forward * (Math.PI / 2), 0, 0],
      scale: [radius * 0.95, length * 0.28, radius * 0.95],
      shared,
    }
  );
  const finZ = position[2] - forward * length * 0.42;
  addMeshPart(group, sharedGeometries.unitBox, finMaterial, [position[0], position[1], finZ], {
    scale: [radius * 4.2, radius * 0.45, radius * 1.6],
    shared,
  });
  addMeshPart(group, sharedGeometries.unitBox, finMaterial, [position[0], position[1], finZ], {
    scale: [radius * 0.45, radius * 4.2, radius * 1.6],
    shared,
  });
}

/**
 * 引擎喷口与分层加力尾焰。
 * exit 为喷口出口平面中心，tailDirection 指向机尾（+1 = 机尾在 +Z）。
 * 组成：收敛喷口外环（可选）+ 深色金属内喉 + 加力核心亮盘（叠加混合）
 * + 外层淡焰锥（叠加混合）。两层焰使用已注册的共享材质（flame：友军橙金 / 敌方红色），
 * 由 updateAircraftSignals 的引擎闪烁驱动同步抖动。
 */
function addExhaustDetail(
  group: THREE.Group,
  exit: [number, number, number],
  radius: number,
  tailDirection: 1 | -1,
  flame: ExhaustFlameMaterials,
  options?: { nozzle?: boolean; flameLength?: number }
): void {
  const withNozzle = options?.nozzle ?? true;
  const flameLength = options?.flameLength ?? radius * 3.2;
  const nozzleLength = radius * 1.05;
  let coreZ = exit[2] + tailDirection * 0.04;

  if (withNozzle) {
    // 收敛喷口外环（窄端朝尾）
    addMeshPart(
      group,
      sharedGeometries.nozzleRing,
      nozzleMetalMaterial,
      [exit[0], exit[1], exit[2] + tailDirection * nozzleLength * 0.4],
      {
        rotation: [-tailDirection * (Math.PI / 2), 0, 0],
        scale: [radius, nozzleLength, radius],
        shared: true,
      }
    );
    coreZ = exit[2] + tailDirection * nozzleLength * 0.55;
  }
  // 深色内喉
  addMeshPart(
    group,
    sharedGeometries.nozzleThroat,
    nozzleThroatMaterial,
    [exit[0], exit[1], exit[2] + tailDirection * nozzleLength * 0.18],
    {
      rotation: [-tailDirection * (Math.PI / 2), 0, 0],
      scale: [radius * 0.98, nozzleLength * 0.8, radius * 0.98],
      castShadow: false,
      shared: true,
    }
  );
  // 加力核心亮盘（叠加）
  addMeshPart(group, sharedGeometries.afterburnerDisc, flame.core, [exit[0], exit[1], coreZ], {
    rotation: [0, tailDirection > 0 ? 0 : Math.PI, 0],
    scale: [radius * 0.58, radius * 0.58, 1],
    castShadow: false,
    shared: true,
  });
  // 外层淡焰锥（叠加，锥尖朝尾）
  addMeshPart(
    group,
    sharedGeometries.unitCone,
    flame.halo,
    [exit[0], exit[1], coreZ + tailDirection * flameLength * 0.5],
    {
      rotation: [tailDirection * (Math.PI / 2), 0, 0],
      scale: [radius * 0.8, flameLength, radius * 0.8],
      castShadow: false,
      shared: true,
    }
  );
}

/**
 * 垂尾顶端整流舱：沿机身纵轴的小圆柱天线/灯具吊舱 + 共享信号灯
 * （lightMaterial：玩家白色频闪 / 友军金色频闪 / 敌方红色信标）。
 */
function addFinTipPod(
  group: THREE.Group,
  position: [number, number, number],
  length: number,
  lightMaterial: THREE.Material
): void {
  addMeshPart(group, sharedGeometries.unitCylinder, canopyFrameMaterial, position, {
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.05, length, 0.05],
    shared: true,
  });
  const light = new THREE.Mesh(signalLightGeometry, lightMaterial);
  light.position.set(position[0], position[1] + 0.04, position[2]);
  light.scale.setScalar(0.45);
  light.castShadow = false;
  light.userData.sharedResource = true;
  group.add(light);
}

const STRIP_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * 翼前缘加强/涂装条：从翼根前缘到翼尖前缘的细长薄盒。
 * 使用四元数（setFromUnitVectors）对准任意方向，避免欧拉角万向节问题。
 * height 取得比翼面厚时，条带把翼缘整个包住，从上方、下方和正前方都看得见。
 */
function addLeadingEdgeStrip(
  group: THREE.Group,
  material: THREE.Material,
  from: [number, number, number],
  to: [number, number, number],
  width: number = 0.12,
  shared: boolean = true,
  height: number = 0.035
): void {
  const direction = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = direction.length();
  direction.normalize();
  const mesh = addMeshPart(
    group,
    sharedGeometries.unitBox,
    material,
    [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    { scale: [length, height, width], castShadow: false, shared }
  );
  mesh.quaternion.setFromUnitVectors(STRIP_AXIS, direction);
}

/** 左右对称的一对前缘条（from/to 给出 +X 侧坐标）。 */
function addLeadingEdgeStripPair(
  group: THREE.Group,
  material: THREE.Material,
  from: [number, number, number],
  to: [number, number, number],
  width: number = 0.12,
  shared: boolean = true,
  height: number = 0.035
): void {
  for (const side of [1, -1] as const) {
    addLeadingEdgeStrip(
      group,
      material,
      [side * from[0], from[1], from[2]],
      [side * to[0], to[1], to[2]],
      width,
      shared,
      height
    );
  }
}

// ---------------------------------------------------------------------------
// 玩家加力尾焰：核心亮盘 + 内焰 + 外焰 + 马赫环。顶点色沿焰长渐隐、叠加混合，
// 两个喷口合并进同一几何体（每层 1 次绘制）。updatePlayerAfterburner 每帧只改
// 缩放/颜色/不透明度，无分配。资源随玩家机实例创建，不标记 sharedResource。
// ---------------------------------------------------------------------------

/** 与 CameraRigFlightState 结构一致：speedRatio 0..1（最低→最高速度），boosting = 加力键按下 */
export interface AfterburnerFlightState {
  speedRatio: number;
  boosting: boolean;
}

/** 喷口出口平面（机尾 +Z），两喷口横向偏移 */
const PLAYER_NOZZLE_Z = 2.25;
const PLAYER_NOZZLE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0.32, -0.03],
  [-0.32, -0.03],
];
/** 二元矢量喷口为扁矩形：尾焰截面按此比例压扁 */
const PLAYER_PLUME_FLATTEN = 0.72;

type PlumeProfile = ReadonlyArray<readonly [radius: number, t: number]>;

const INNER_PLUME_PROFILE: PlumeProfile = [
  [1, 0],
  [1.06, 0.06],
  [0.96, 0.2],
  [0.74, 0.45],
  [0.46, 0.7],
  [0.18, 0.9],
  [0.02, 1],
];
const OUTER_PLUME_PROFILE: PlumeProfile = [
  [1, 0],
  [1.22, 0.1],
  [1.28, 0.3],
  [1.04, 0.55],
  [0.66, 0.8],
  [0.26, 0.95],
  [0.02, 1],
];
/** 尾焰配色（sRGB 十六进制，Color 内部转线性；每帧只做 copy + lerp） */
const AFTERBURNER_COLORS = {
  coreDry: new THREE.Color(0xffb27a),
  coreBoost: new THREE.Color(0xfff0c8),
  innerDry: new THREE.Color(0xff9a6a),
  innerBoost: new THREE.Color(0xffc45c),
  outerDry: new THREE.Color(0xff5a1f),
  outerBoost: new THREE.Color(0xff7a22),
} as const;

/** 马赫环：沿归一化焰长的位置、半径与亮度 */
const SHOCK_DIAMONDS: ReadonlyArray<{ t: number; radius: number; intensity: number }> = [
  { t: 0.13, radius: 0.085, intensity: 1 },
  { t: 0.28, radius: 0.076, intensity: 0.85 },
  { t: 0.43, radius: 0.064, intensity: 0.66 },
  { t: 0.57, radius: 0.05, intensity: 0.46 },
];

function setGrayVertexColors(
  geometry: THREE.BufferGeometry,
  shade: (index: number, x: number, y: number, z: number) => number
): void {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const value = Math.max(
      0,
      Math.min(1, shade(i, position.getX(i), position.getY(i), position.getZ(i)))
    );
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** 各喷口复制一份并合并；输入几何体随后释放 */
function mergeAcrossNozzles(base: THREE.BufferGeometry): THREE.BufferGeometry {
  const copies = PLAYER_NOZZLE_OFFSETS.map(([x, y]) => base.clone().translate(x, y, 0));
  base.dispose();
  const merged = mergeGeometries(copies, false);
  copies.forEach((copy) => copy.dispose());
  if (!merged) {
    throw new Error('AircraftMeshFactory: failed to merge afterburner geometry');
  }
  return merged;
}

/** 旋成体焰锥：沿 +Z 从 0 延伸到 1（由 mesh.scale.z 拉伸到实际长度），底部亮、尖端透明 */
function createPlumeGeometry(
  profile: PlumeProfile,
  radius: number,
  fade: (t: number) => number
): THREE.BufferGeometry {
  const points = profile.map(([r, t]) => new THREE.Vector2(Math.max(r * radius, 0.0005), t));
  const geometry = new THREE.LatheGeometry(points, 14);
  setGrayVertexColors(geometry, (_index, _x, y) => fade(y));
  geometry.rotateX(Math.PI / 2);
  geometry.scale(1, PLAYER_PLUME_FLATTEN, 1);
  return mergeAcrossNozzles(geometry);
}

/** 喷口核心亮盘（面向机尾），中心亮、边缘透明 */
function createCoreDiscGeometry(radius: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, 20);
  setGrayVertexColors(geometry, (index) => (index === 0 ? 1 : 0));
  geometry.scale(1, PLAYER_PLUME_FLATTEN, 1);
  geometry.translate(0, 0, 0.012);
  return mergeAcrossNozzles(geometry);
}

/** 马赫环：沿焰轴排列的双锥（侧看为菱形），赤道亮、两端暗 */
function createShockDiamondGeometry(): THREE.BufferGeometry {
  const parts = SHOCK_DIAMONDS.map(({ t, radius, intensity }) => {
    const bicone = new THREE.LatheGeometry(
      [new THREE.Vector2(0.0005, -1), new THREE.Vector2(1, 0), new THREE.Vector2(0.0005, 1)],
      10
    );
    setGrayVertexColors(bicone, (_index, _x, y) => intensity * (1 - 0.85 * Math.abs(y)));
    bicone.rotateX(Math.PI / 2);
    // 半长取归一化焰长的 0.045：随 mesh.scale.z 一起拉伸，长焰中呈细长菱形
    bicone.scale(radius, radius * PLAYER_PLUME_FLATTEN, 0.045);
    bicone.translate(0, 0, t);
    return bicone;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) {
    throw new Error('AircraftMeshFactory: failed to merge shock diamond geometry');
  }
  return mergeAcrossNozzles(merged);
}

function createPlumeMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    vertexColors: true,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
}

class PlayerAfterburner {
  private throttle = 0.35;
  private boost = 0;
  private time = 0;

  constructor(
    private readonly core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
    private readonly inner: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
    private readonly outer: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
    private readonly diamonds: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  ) {
    this.apply();
  }

  public update(speedRatio: number, boosting: boolean, deltaTime: number): void {
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? Math.min(deltaTime, 0.1) : 0;
    this.time = (this.time + dt) % 3600;
    const throttleTarget = Number.isFinite(speedRatio) ? Math.max(0, Math.min(1, speedRatio)) : 0;
    this.throttle += (throttleTarget - this.throttle) * (1 - Math.exp(-dt * 4));
    // 点燃加力快（约 0.1 s），熄火稍慢
    const boostTarget = boosting ? 1 : 0;
    const boostRate = boostTarget > this.boost ? 10 : 3.5;
    this.boost += (boostTarget - this.boost) * (1 - Math.exp(-dt * boostRate));
    this.apply();
  }

  private apply(): void {
    const t = this.time;
    const b = this.boost;
    const th = this.throttle;
    const flicker =
      1 + 0.06 * Math.sin(t * 37) + 0.045 * Math.sin(t * 61 + 1.3) + 0.03 * Math.sin(t * 97 + 0.4);
    const surge = 1 + 0.06 * Math.sin(t * 13 + 0.6) * (0.4 + b);

    this.inner.scale.z = (0.4 + 0.3 * th + 0.55 * b) * surge;
    const outerLength = (0.62 + 0.5 * th + 1.45 * b) * surge;
    this.outer.scale.z = outerLength;
    this.diamonds.scale.z = outerLength;

    // 干推力：短、橙粉焰心；加力：长、金黄，喷口处叠加饱和（泛光），尾段渐变为橙色，带马赫环
    this.core.material.color.copy(AFTERBURNER_COLORS.coreDry).lerp(AFTERBURNER_COLORS.coreBoost, b);
    this.core.material.opacity = Math.min(1, (0.55 + 0.15 * th + 0.3 * b) * flicker);
    this.inner.material.color
      .copy(AFTERBURNER_COLORS.innerDry)
      .lerp(AFTERBURNER_COLORS.innerBoost, b);
    this.inner.material.opacity = Math.min(1, (0.3 + 0.12 * th + 0.3 * b) * flicker);
    this.outer.material.color
      .copy(AFTERBURNER_COLORS.outerDry)
      .lerp(AFTERBURNER_COLORS.outerBoost, b);
    this.outer.material.opacity = Math.min(1, (0.16 + 0.1 * th + 0.32 * b) * flicker);
    this.diamonds.visible = b > 0.02;
    this.diamonds.material.opacity = Math.min(1, b * (0.78 + 0.18 * Math.sin(t * 45)));
  }
}

const playerAfterburners = new WeakMap<THREE.Object3D, PlayerAfterburner>();

function addPlumeMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshBasicMaterial,
  name: string
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(0, 0, PLAYER_NOZZLE_Z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 0;
  group.add(mesh);
  return mesh;
}

function addPlayerAfterburner(group: THREE.Group): void {
  const core = addPlumeMesh(
    group,
    createCoreDiscGeometry(0.15),
    createPlumeMaterial(0xffd2a0, 0.7),
    'afterburnerCore'
  );
  const inner = addPlumeMesh(
    group,
    createPlumeGeometry(INNER_PLUME_PROFILE, 0.085, (t) => Math.pow(1 - t, 1.7)),
    createPlumeMaterial(0xffe0b0, 0.5),
    'afterburnerInner'
  );
  const outer = addPlumeMesh(
    group,
    createPlumeGeometry(
      OUTER_PLUME_PROFILE,
      0.13,
      (t) => Math.pow(1 - t, 1.6) * Math.min(1, t / 0.08 + 0.15)
    ),
    createPlumeMaterial(0xff6a26, 0.3),
    'afterburnerOuter'
  );
  const diamonds = addPlumeMesh(
    group,
    createShockDiamondGeometry(),
    createPlumeMaterial(0xfff1c8, 0),
    'afterburnerDiamonds'
  );
  playerAfterburners.set(group, new PlayerAfterburner(core, inner, outer, diamonds));
}

/**
 * 每帧驱动玩家机加力尾焰（长度/亮度/颜色随 speedRatio 与 boosting 平滑变化，带闪烁）。
 * aircraft 必须是 createPlayerMesh() 返回的根节点；其他对象静默忽略。无分配。
 */
export function updatePlayerAfterburner(
  aircraft: THREE.Object3D,
  flight: AfterburnerFlightState | null | undefined,
  deltaTime: number
): void {
  const afterburner = playerAfterburners.get(aircraft);
  if (!afterburner) {
    return;
  }
  afterburner.update(flight?.speedRatio ?? 0, flight?.boosting === true, deltaTime);
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

  // === 气泡座舱盖：玻璃气泡 + 风挡弓框 + 纵梁 + 后拱框 + 菲涅尔镶边壳 ===
  addMeshPart(group, new THREE.SphereGeometry(0.4, 14, 12), cockpitMaterial, [0, 0.32, -0.85], {
    scale: [1.0, 0.62, 1.7],
  });
  addMeshPart(group, sharedGeometries.unitSphere, canopyRimMaterial, [0, 0.32, -0.85], {
    scale: [0.424, 0.263, 0.721],
    castShadow: false,
    shared: true,
  });
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.05, 0.07), accentMaterial, [0, 0.42, -1.4]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.04, 1.1), accentMaterial, [0, 0.55, -0.8]);
  addMeshPart(group, sharedGeometries.unitBox, canopyFrameMaterial, [0, 0.4, -0.28], {
    scale: [0.46, 0.05, 0.07],
    shared: true,
  });

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
  // 矩形喷口深色内喉（加力尾焰见 addPlayerAfterburner，随油门/加力驱动）
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, intakeCavityMaterial, [side * 0.32, -0.03, 2.2], {
      scale: [0.34, 0.22, 0.12],
      castShadow: false,
    });
    addMeshPart(
      group,
      sharedGeometries.nozzleThroat,
      nozzleThroatMaterial,
      [side * 0.32, -0.03, 2.29],
      {
        rotation: [-Math.PI / 2, 0, 0],
        scale: [0.157, 0.134, 0.157],
        castShadow: false,
        shared: true,
      }
    );
  }
  addPlayerAfterburner(group);

  // === 腹鳍 ===
  addMeshPart(group, new THREE.BoxGeometry(0.04, 0.3, 0.6), detailMaterial, [-0.4, -0.32, 1.2], {
    rotation: [0, 0, 0.35],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.04, 0.3, 0.6), detailMaterial, [0.4, -0.32, 1.2], {
    rotation: [0, 0, -0.35],
  });

  // === 翼下挂架 + 格斗弹（内外两对）===
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.18, 0.55), weaponMaterial, [-1.05, -0.2, 0.45]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.18, 0.55), weaponMaterial, [1.05, -0.2, 0.45]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.16, 0.5), weaponMaterial, [-1.65, -0.17, 0.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.07, 0.16, 0.5), weaponMaterial, [1.65, -0.17, 0.6]);
  for (const side of [1, -1] as const) {
    addStore(group, detailMaterial, weaponMaterial, [side * 1.05, -0.36, 0.45], 0.85, 0.05, -1);
    addStore(group, detailMaterial, weaponMaterial, [side * 1.65, -0.31, 0.6], 0.75, 0.045, -1);
  }

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

  // —— 细节强化 ——
  // 主翼前缘涂装条
  addLeadingEdgeStripPair(
    group,
    accentMaterial,
    [0.6, -0.02, -0.6],
    [2.45, -0.13, 0.95],
    0.12,
    false
  );
  // 双垂尾顶端天线吊舱（含频闪灯）
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * 0.9, 1.22, 1.2], 0.45, signalLightMaterials.strobe);
  }
  // 机鼻攻角探头（左右各一，向前外侧斜出）
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitCylinder, accentMaterial, [side * 0.2, 0.04, -2.3], {
      scale: [0.012, 0.16, 0.012],
      rotation: [Math.PI / 2, 0, side * 0.25],
    });
  }
  // 尾撑顶面中队识别带
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, accentMaterial, [side * 0.76, 0.11, 1.2], {
      scale: [0.32, 0.03, 0.2],
      castShadow: false,
    });
  }

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
  addNavigationLights(group, 1, playerSignalLights);

  return group;
}

// ---------------------------------------------------------------------------
// 敌机：八种机型轮廓（敌方无人机涂装）；友军僚机机体共用同一套机头 +Z 的构件
// ---------------------------------------------------------------------------

interface EnemyBuildContext {
  group: THREE.Group;
  materials: CachedMaterials;
  weaponMaterial: THREE.MeshStandardMaterial;
  cavityMaterial: THREE.MeshStandardMaterial;
  /** 喷口叠加尾焰（敌方红色 / 友军橙金） */
  flame: ExhaustFlameMaterials;
  /** 垂尾顶端吊舱上的信号灯（敌方红色信标 / 友军金色频闪） */
  tipLight: THREE.Material;
  bodySize: number;
  bodyLength: number;
  wingSpan: number;
}

/**
 * 敌方无人机的传感器整流罩，取代座舱盖（无人机没有玻璃舱盖）：不透明的深色鼓包 +
 * 环绕前半圈的红色“独眼”护目带 + 中央纵脊。参数与座舱盖一致，机体轮廓不变。
 */
function addSensorVisor(
  ctx: EnemyBuildContext,
  position: [number, number, number],
  radius: number,
  scale: [number, number, number]
): void {
  const sx = radius * scale[0];
  const sy = radius * scale[1];
  const sz = radius * scale[2];
  addMeshPart(ctx.group, sharedGeometries.unitSphere, ctx.materials.cockpit, position, {
    scale: [sx, sy, sz],
    shared: true,
  });
  // 护目带：略宽的扁椭球整体前移，只有前半圈露出鼓包表面，后半截埋在鼓包里
  addMeshPart(
    ctx.group,
    sharedGeometries.unitSphere,
    ctx.materials.light,
    [position[0], position[1] + sy * 0.3, position[2] + sz * 0.3],
    { scale: [sx * 1.04, sy * 0.3, sz * 0.78], castShadow: false, shared: true }
  );
  // 中央纵脊
  addMeshPart(
    ctx.group,
    sharedGeometries.unitBox,
    canopyFrameMaterial,
    [position[0], position[1] + sy * 0.86, position[2] - sz * 0.2],
    { scale: [0.05, 0.045, sz * 1.0], shared: true }
  );
}

/** 友军僚机座舱盖：染色玻璃气泡 + 前弓风挡框 + 后拱框 + 中央纵梁 + 菲涅尔式镶边壳。 */
function addBubbleCanopy(
  ctx: EnemyBuildContext,
  position: [number, number, number],
  radius: number,
  scale: [number, number, number]
): void {
  const sx = radius * scale[0];
  const sy = radius * scale[1];
  const sz = radius * scale[2];
  addMeshPart(ctx.group, sharedGeometries.unitSphere, ctx.materials.cockpit, position, {
    scale: [sx, sy, sz],
    shared: true,
  });
  // 菲涅尔式镶边壳：略大的背面渲染淡亮壳，模拟玻璃边缘反光
  addMeshPart(ctx.group, sharedGeometries.unitSphere, canopyRimMaterial, position, {
    scale: [sx * 1.06, sy * 1.06, sz * 1.06],
    castShadow: false,
    shared: true,
  });
  // 前弓风挡框
  addMeshPart(
    ctx.group,
    sharedGeometries.unitBox,
    ctx.materials.accent,
    [position[0], position[1] + sy * 0.5, position[2] + sz * 0.72],
    { scale: [sx * 1.6, 0.05, 0.07], shared: true }
  );
  // 后拱框
  addMeshPart(
    ctx.group,
    sharedGeometries.unitBox,
    canopyFrameMaterial,
    [position[0], position[1] + sy * 0.45, position[2] - sz * 0.62],
    { scale: [sx * 1.5, 0.05, 0.07], shared: true }
  );
  // 中央纵梁
  addMeshPart(
    ctx.group,
    sharedGeometries.unitBox,
    canopyFrameMaterial,
    [position[0], position[1] + sy * 0.86, position[2]],
    { scale: [0.05, 0.045, sz * 1.35], shared: true }
  );
}

/**
 * 敌机引擎：喷管壳体 + 收敛喷口外环 + 深色内喉 + 主尾焰锥 + 分层加力
 * （机尾 -Z 方向）。name 用于 'engineGlow' 查询（尾迹采样等），保持唯一。
 */
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
  // 真实喷口几何（出口在壳体后端面）+ 分层加力辉光
  addExhaustDetail(
    ctx.group,
    [position[0], position[1], position[2] - radius * 1.2],
    radius * 0.95,
    -1,
    ctx.flame,
    { flameLength: (options?.glowLength ?? radius * 4) * 0.85 }
  );
}

/**
 * 两侧进气道：箱体 + 斜切唇口 + 深色内腔（机头 +Z 方向）。
 * 唇口默认用识别色（accent）；lipMaterial 可换成不抢眼的材质。
 */
function addIntakePair(
  ctx: EnemyBuildContext,
  position: [number, number, number],
  size: [number, number, number],
  yaw: number,
  lipMaterial: THREE.Material = ctx.materials.accent
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
      lipMaterial,
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
 * 红色识别：两个翼尖吊舱 + 机鼻下的红色“独眼” + 尾部环带。
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

  // 机鼻下传感器球：红色“独眼”
  addMeshPart(group, new THREE.SphereGeometry(0.17, 10, 10), materials.light, [0, -0.26, 3.05], {
    castShadow: false,
  });

  // 传感器整流罩（原座舱位置）
  addSensorVisor(ctx, [0, 0.27, 1.9], 0.26, [0.85, 0.62, 1.5]);

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

  // —— 细节强化 ——
  // 主翼前缘涂装条
  addLeadingEdgeStripPair(group, materials.accent, [0.36, 0.19, 0.14], [2.6, 0.39, -0.1], 0.14);
  // V 型尾翼顶端天线吊舱（含信标灯）
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * 0.55, 0.74, -3.2], 0.36, ctx.tipLight);
  }
  // 尾部中队识别带（环绕机身的涂装带）
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0, -2.9], {
    scale: [0.38, 0.36, 0.3],
    shared: true,
  });
  // 机身侧查线（中队色细条）
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.accent, [side * 0.3, 0.1, 0.3], {
      scale: [0.02, 0.06, 2.0],
      castShadow: false,
      shared: true,
    });
  }
  // 腹部刀形天线
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, -0.34, 1.4], {
    scale: [0.025, 0.12, 0.2],
    shared: true,
  });
  // 翼尖侦察吊舱前端传感器灯
  for (const side of [1, -1] as const) {
    addMeshPart(group, signalLightGeometry, materials.light, [side * 2.66, 0.4, -0.02], {
      scale: [0.6, 0.6, 0.6],
      castShadow: false,
      shared: true,
    });
  }
}

/**
 * FIGHTER - 鸭式三角翼战斗机（台风/阵风风格）：
 * 大三角主翼、座舱旁鸭翼、单片高垂尾、下颌进气道、双发窄间距。
 * 红色识别：三角翼前缘的箭头形红边 + 机头棱线 + 背脊条。
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

  // 传感器整流罩（原座舱位置）
  addSensorVisor(ctx, [0, 0.42, 2.6], 0.3, [0.95, 0.65, 1.6]);

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
    addStore(
      group,
      materials.detail,
      weaponMaterial,
      [side * 3.32, -0.12, -2.0],
      1.1,
      0.07,
      1,
      true
    );
  }

  // 翼下挂架（内侧）+ 中距弹，外侧再加一对挂架 + 格斗弹
  addMeshPart(group, new THREE.BoxGeometry(0.08, 0.22, 0.7), weaponMaterial, [-1.6, -0.22, -1.6]);
  addMeshPart(group, new THREE.BoxGeometry(0.08, 0.22, 0.7), weaponMaterial, [1.6, -0.22, -1.6]);
  for (const side of [1, -1] as const) {
    addStore(
      group,
      materials.detail,
      weaponMaterial,
      [side * 1.6, -0.42, -1.55],
      1.05,
      0.06,
      1,
      true
    );
    addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [side * 2.35, -0.16, -2.4], {
      scale: [0.07, 0.18, 0.6],
      shared: true,
    });
    addStore(
      group,
      materials.detail,
      weaponMaterial,
      [side * 2.35, -0.31, -2.4],
      0.9,
      0.055,
      1,
      true
    );
  }

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

  // —— 细节强化 ——
  // 三角翼前缘涂装条
  addLeadingEdgeStripPair(group, materials.accent, [0.55, -0.02, 0.38], [3.3, -0.02, -2.92], 0.18);
  // 垂尾顶端天线吊舱（含信标灯）+ 垂尾前缘涂装条
  addFinTipPod(group, [0, 1.06, -4.2], 0.55, ctx.tipLight);
  addLeadingEdgeStrip(group, materials.accent, [0, 0.5, -3.3], [0, 1.08, -3.87], 0.09);
  // 背脊涂装条（中队色）
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0.49, 0.2], {
    scale: [0.22, 0.02, 2.4],
    castShadow: false,
    shared: true,
  });
  // 尾部中队识别带
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0, -3.9], {
    scale: [0.62, 0.52, 0.3],
    shared: true,
  });
  // 背部/腹部刀形天线
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.55, 1.4], {
    scale: [0.03, 0.16, 0.24],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, -0.46, 0.6], {
    scale: [0.03, 0.12, 0.2],
    shared: true,
  });
}

/**
 * HEAVY - 重型打击平台：宽扁机身、后掠下反翼、
 * 双发短舱、四个翼下挂架挂炸弹、外倾双垂尾。
 * 红色识别：两个短舱进气口像炉膛一样发红（迎头看是一对红眼）+ 红色唇口环 + 机身侧条 + 前缘。
 */
function buildHeavy(ctx: EnemyBuildContext): void {
  const { group, materials, weaponMaterial, bodyLength, wingSpan } = ctx;
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

  // 宽传感器整流罩（原座舱位置）
  addSensorVisor(ctx, [0, 0.56, 4.5], 0.34, [1.25, 0.6, 1.5]);

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

  // 双发引擎短舱（机身两侧）+ 红色进气唇口 + 发红的进气口内腔
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
      materials.light,
      [side * 1.35, -0.05, -2.78],
      { rotation: [Math.PI / 2, 0, 0], castShadow: false }
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
    addStore(
      group,
      weaponMaterial,
      materials.detail,
      [side * 2.3, -0.18, -1.1],
      1.5,
      0.17,
      1,
      true
    );
    addMeshPart(group, new THREE.BoxGeometry(0.1, 0.26, 0.8), weaponMaterial, [
      side * 3.5,
      0,
      -1.5,
    ]);
    addStore(
      group,
      weaponMaterial,
      materials.detail,
      [side * 3.5, -0.26, -1.4],
      1.3,
      0.15,
      1,
      true
    );
  }

  // 腹部龙骨 / 检修缝 / 信标
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.14, 3.0), materials.detail, [0, -0.62, 0.4]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.04, 3.4), materials.detail, [-1.0, 0.2, 0.8]);
  addMeshPart(group, new THREE.BoxGeometry(0.02, 0.04, 3.4), materials.detail, [1.0, 0.2, 0.8]);
  addMeshPart(group, new THREE.SphereGeometry(0.08, 8, 8), materials.light, [0, 0.62, 0.6], {
    castShadow: false,
  });

  // —— 细节强化 ——
  // 发动机短舱真实喷口（外环 + 内喉 + 分层加力）
  for (const side of [1, -1] as const) {
    addExhaustDetail(group, [side * 1.35, -0.05, -6.0], 0.36, -1, ctx.flame, {
      flameLength: 1.0,
    });
  }
  // 机腹纵列弹架 + 三枚炸弹
  addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [0, -0.78, 0.2], {
    scale: [0.5, 0.1, 2.8],
    shared: true,
  });
  for (const z of [1.2, 0.2, -0.8]) {
    addStore(group, weaponMaterial, materials.detail, [0, -0.97, z], 1.35, 0.16, 1, true);
  }
  // 主翼前缘涂装条
  addLeadingEdgeStripPair(group, materials.accent, [1.1, 0.39, 0.62], [5.3, 0.1, -1.82], 0.22);
  // 翼尖整流条
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.detail, [side * 5.32, 0.02, -1.55], {
      scale: [0.07, 0.09, 1.1],
      shared: true,
    });
  }
  // 双垂尾顶端天线吊舱（含信标灯）
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * 1.05, 1.5, -6.0], 0.5, ctx.tipLight);
  }
  // 机背刀形天线排
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.66, 2.6], {
    scale: [0.04, 0.18, 0.3],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.62, -0.6], {
    scale: [0.04, 0.16, 0.26],
    shared: true,
  });
  // 机身侧中队识别条
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.accent, [side * 1.05, 0.2, 3.2], {
      scale: [0.025, 0.09, 2.2],
      castShadow: false,
      shared: true,
    });
  }
  // 机鼻空速管
  addMeshPart(group, sharedGeometries.unitCylinder, materials.detail, [0, 0, nose + 0.16], {
    scale: [0.016, 0.4, 0.016],
    rotation: [Math.PI / 2, 0, 0],
    shared: true,
  });
}

/**
 * SNIPER - 远程截击机（米格-31 风格）：超长尖锐机头、
 * 巨大侧置进气道、双发大间距、双垂尾 + 腹鳍、中置细长后掠翼。
 * 红色识别：贯穿背脊的一条长红线 + 鼻下狙击炮的红色光电窗与炮口（机头棱线 / 进气唇口是钢灰高光）。
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

  // 长机头棱线（钢灰高光）
  addMeshPart(group, new THREE.BoxGeometry(0.24, 0.04, 2.6), materials.detail, [-0.14, 0, 4.4], {
    rotation: [0, 0.05, 0],
  });
  addMeshPart(group, new THREE.BoxGeometry(0.24, 0.04, 2.6), materials.detail, [0.14, 0, 4.4], {
    rotation: [0, -0.05, 0],
  });

  // 长传感器整流罩（原纵列双座座舱位置）
  addSensorVisor(ctx, [0, 0.36, 3.3], 0.28, [0.8, 0.55, 2.1]);

  // 背脊
  addMeshPart(group, new THREE.BoxGeometry(0.3, 0.14, 4.6), materials.body, [0, 0.4, -0.6]);

  // 巨大侧置进气道（唇口钢灰：红色留给背脊长线）
  addIntakePair(ctx, [0.66, -0.02, 1.7], [0.5, 0.6, 2.6], 0.04, materials.detail);

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

  // —— 细节强化 ——
  // 鼻下长身管狙击炮：长炮管 + 红色炮口套环 + 传感器整流罩 + 红色光电窗
  addMeshPart(group, sharedGeometries.unitCylinder, nozzleMetalMaterial, [0, -0.16, 5.4], {
    scale: [0.045, 2.4, 0.045],
    rotation: [Math.PI / 2, 0, 0],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitCylinder, materials.light, [0, -0.16, 6.5], {
    scale: [0.065, 0.14, 0.065],
    rotation: [Math.PI / 2, 0, 0],
    castShadow: false,
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, -0.26, 4.3], {
    scale: [0.16, 0.14, 0.9],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitSphere, materials.light, [0, -0.3, 4.75], {
    scale: [0.1, 0.085, 0.14],
    castShadow: false,
    shared: true,
  });
  // 主翼前缘涂装条
  addLeadingEdgeStripPair(group, materials.accent, [0.75, 0.05, -0.28], [2.2, 0.0, -1.52], 0.14);
  // 双垂尾顶端天线吊舱（含信标灯）
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * 0.63, 0.95, -5.45], 0.45, ctx.tipLight);
  }
  // 背脊中队涂装条
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0.49, -0.6], {
    scale: [0.2, 0.025, 4.2],
    castShadow: false,
    shared: true,
  });
  // 尾部中队识别带
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0, -4.6], {
    scale: [0.62, 0.5, 0.26],
    shared: true,
  });
  // 背部刀形天线
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.52, 1.8], {
    scale: [0.03, 0.16, 0.24],
    shared: true,
  });
}

/**
 * ACE - 前掠翼试验机（苏-47 风格）：前掠主翼、鸭翼、
 * 外倾双垂尾、双发、精英专属的发光饰条。
 * 精英标记：亮绯红的前掠翼前缘 / 机头棱线 / 机鼻环带 + 白热灯条（翼根、背脊、尾部）。
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

  // 传感器整流罩（原座舱位置）
  addSensorVisor(ctx, [0, 0.46, 2.5], 0.3, [0.95, 0.66, 1.55]);

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

  // 精英白热灯条：翼根沿前掠前缘 + 背脊 + 尾部环带
  addMeshPart(
    group,
    new THREE.BoxGeometry(1.4, 0.03, 0.12),
    eliteTrimMaterial,
    [-1.3, 0.16, -0.7],
    {
      rotation: [0, -0.42, 0],
      castShadow: false,
    }
  );
  addMeshPart(group, new THREE.BoxGeometry(1.4, 0.03, 0.12), eliteTrimMaterial, [1.3, 0.16, -0.7], {
    rotation: [0, 0.42, 0],
    castShadow: false,
  });
  addMeshPart(group, new THREE.BoxGeometry(0.06, 0.03, 2.4), eliteTrimMaterial, [0, 0.52, 0], {
    castShadow: false,
  });
  addMeshPart(group, new THREE.BoxGeometry(0.5, 0.03, 0.08), eliteTrimMaterial, [0, 0.34, -4.2], {
    castShadow: false,
  });

  // 翼尖导弹 + 发射轨
  for (const side of [1, -1] as const) {
    addMeshPart(group, new THREE.BoxGeometry(0.05, 0.06, 1.2), weaponMaterial, [
      side * 3.62,
      0.16,
      0.85,
    ]);
    addStore(
      group,
      materials.detail,
      weaponMaterial,
      [side * 3.62, 0.07, 0.85],
      1.2,
      0.07,
      1,
      true
    );
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

  // —— 细节强化 ——
  // 翼下双排挂架 + 格斗弹
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [side * 1.8, -0.04, -1.2], {
      scale: [0.07, 0.22, 0.7],
      shared: true,
    });
    addStore(
      group,
      materials.detail,
      weaponMaterial,
      [side * 1.8, -0.21, -1.2],
      1.05,
      0.06,
      1,
      true
    );
    addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [side * 2.5, 0.0, -0.85], {
      scale: [0.06, 0.2, 0.6],
      shared: true,
    });
    addStore(
      group,
      materials.detail,
      weaponMaterial,
      [side * 2.5, -0.16, -0.85],
      0.9,
      0.055,
      1,
      true
    );
  }
  // 前掠主翼前缘涂装条（精英绯红）
  addLeadingEdgeStripPair(group, materials.accent, [0.7, 0.09, -0.95], [3.6, 0.14, 0.35], 0.18);
  // 双垂尾顶端天线吊舱（含信标灯）
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * 0.82, 1.1, -4.4], 0.5, ctx.tipLight);
  }
  // 机鼻中队识别带
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0, 3.6], {
    scale: [0.9, 0.64, 0.28],
    shared: true,
  });
  // 腹部刀形天线
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, -0.52, 1.2], {
    scale: [0.03, 0.14, 0.22],
    shared: true,
  });
}

// 电子干扰环的几何体：模块级共享（单位半径，按需 scale）
const ecmRingGeometries = {
  /** 天线罩外缘的环带（XY 平面内的圆环，使用时放平并沿轴向拉高） */
  rim: new THREE.TorusGeometry(1, 0.085, 5, 24),
  /** 贴在天线罩 / 机腹天线鼓表面的扁环（朝 +Z，使用时转向上 / 下） */
  band: new THREE.RingGeometry(0.8, 1, 24),
};

/**
 * JAMMER - 电子干扰机：无武装的飞翼 + 背负圆盘天线罩 + 机腹天线鼓 + 背 / 腹刀形天线阵
 * + 翼面碟形天线 + 翼尖电子战吊舱，单发。
 * 紫色干扰环：天线罩外缘一圈环带（侧面看是一道紫色横条，俯视是一个圆环）、罩面上下各一圈
 * 扁环、机腹天线鼓下一圈扁环，四面八方都看得见紫色；脉冲由共享材质统一驱动。
 * 紫色只出现在这里（敌机上唯一的非红色识别）：看到紫色就知道是它在拖慢锁定。
 */
function buildJammer(ctx: EnemyBuildContext): SignalLightAnchors {
  const { group, materials } = ctx;
  const domeY = 1.22;
  const domeZ = -0.95;
  const domeRadius = 1.5;
  const tipX = 4.3;

  // 中央机身：扁宽旋成体，埋在飞翼里，机头只比翼尖顶点探出一点
  addFuselage(
    group,
    [
      [0.04, -2.3],
      [0.34, -2.05],
      [0.52, -1.4],
      [0.6, -0.5],
      [0.58, 0.4],
      [0.46, 1.2],
      [0.28, 1.9],
      [0.1, 2.4],
      [0.02, 2.6],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.9, heightScale: 0.78 }
  );

  // 传感器整流罩
  addSensorVisor(ctx, [0, 0.28, 1.35], 0.4, [0.95, 0.6, 1.5]);

  // 飞翼：前缘后掠约 37°，后缘向内折回中央的“海狸尾”
  addWingPair(
    group,
    [
      [0, 2.25],
      [tipX, -0.95],
      [tipX, -1.7],
      [1.8, -1.3],
      [0, -2.1],
    ],
    0.12,
    materials.wing,
    [0, 0, 0],
    1,
    { dihedral: 0.03 }
  );
  // 前缘红色识别条（包住翼缘，上下都看得见）
  addLeadingEdgeStripPair(
    group,
    materials.accent,
    [0.75, 0.02, 1.69],
    [tipX, 0.13, -0.95],
    0.14,
    true,
    0.14
  );

  // 背部两个进气斗
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.body, [side * 0.52, 0.44, 0.0], {
      scale: [0.36, 0.2, 1.0],
      shared: true,
    });
    addMeshPart(group, sharedGeometries.unitBox, ctx.cavityMaterial, [side * 0.52, 0.45, 0.5], {
      scale: [0.3, 0.14, 0.06],
      castShadow: false,
      shared: true,
    });
  }

  // 背负天线罩：支柱 + 扁圆盘
  addMeshPart(group, sharedGeometries.unitBox, materials.body, [0, 0.78, domeZ + 0.05], {
    scale: [0.13, 0.8, 0.95],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitSphere, materials.cockpit, [0, domeY, domeZ], {
    scale: [domeRadius * 0.97, 0.17, domeRadius * 0.97],
    shared: true,
  });
  // —— 紫色干扰环 ——
  // 罩缘环带（外圈）
  addMeshPart(group, ecmRingGeometries.rim, ecmRingMaterials.outer, [0, domeY, domeZ], {
    rotation: [Math.PI / 2, 0, 0],
    scale: [domeRadius, domeRadius, 2.6],
    castShadow: false,
    shared: true,
  });
  // 罩面上 / 下的扁环（内圈）
  addMeshPart(group, ecmRingGeometries.band, ecmRingMaterials.inner, [0, domeY + 0.158, domeZ], {
    rotation: [-Math.PI / 2, 0, 0],
    scale: [0.85, 0.85, 1],
    castShadow: false,
    shared: true,
  });
  addMeshPart(group, ecmRingGeometries.band, ecmRingMaterials.inner, [0, domeY - 0.158, domeZ], {
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.85, 0.85, 1],
    castShadow: false,
    shared: true,
  });
  // 机腹天线鼓 + 朝下的扁环（内圈）
  addMeshPart(group, sharedGeometries.unitCylinder, materials.cockpit, [0, -0.5, -0.3], {
    scale: [0.62, 0.18, 0.62],
    shared: true,
  });
  addMeshPart(group, ecmRingGeometries.band, ecmRingMaterials.inner, [0, -0.6, -0.3], {
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.76, 0.76, 1],
    castShadow: false,
    shared: true,
  });

  // 背部 / 腹部刀形天线阵
  for (const z of [0.5, 0.15, -0.2]) {
    addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.6, z], {
      scale: [0.03, 0.3, 0.2],
      shared: true,
    });
  }
  for (const z of [1.3, 0.85, 0.4]) {
    addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, -0.5, z], {
      scale: [0.03, 0.28, 0.22],
      shared: true,
    });
  }

  // 翼面碟形天线（支杆 + 朝前上方的碟面）与翼尖电子战吊舱
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitCylinder, materials.detail, [side * 2.5, 0.25, -0.45], {
      scale: [0.035, 0.22, 0.035],
      shared: true,
    });
    addMeshPart(group, sharedGeometries.unitCone, materials.detail, [side * 2.5, 0.41, -0.45], {
      rotation: [Math.PI + 0.45, 0, 0],
      scale: [0.34, 0.14, 0.34],
      shared: true,
    });
    addMeshPart(group, sharedGeometries.unitCylinder, materials.wing, [side * tipX, 0.13, -1.35], {
      rotation: [Math.PI / 2, 0, 0],
      scale: [0.12, 1.6, 0.12],
      shared: true,
    });
    addMeshPart(group, sharedGeometries.unitCone, materials.detail, [side * tipX, 0.13, -0.4], {
      rotation: [Math.PI / 2, 0, 0],
      scale: [0.12, 0.3, 0.12],
      shared: true,
    });
  }

  // 单发（红色尾焰）
  addEnemyEngine(ctx, [0, 0.04, -2.15], 0.3, { name: 'engineGlow', glowLength: 1.0 });

  return {
    wingtip: [tipX, 0.28, -1.35],
    tail: [0, domeY + 0.2, domeZ],
    belly: [0, -0.64, -0.3],
  };
}

/** 导弹攻击机每侧两个翼下挂点：[展向位置, 弹体中心的纵向位置]（外侧挂点随后掠略靠后） */
const STRIKER_RACKS: ReadonlyArray<readonly [number, number]> = [
  [1.02, 0.0],
  [2.8, -0.3],
];

/**
 * STRIKER - 导弹攻击机：中央短舱 + 上单翼 + 双尾撑 + 双垂尾顶着一片高平尾，单发从两条尾撑之间
 * 喷出。没有机炮：翼下四个挂架各吊一枚大型导弹（浅钢色弹体 + 红色导引头环带），弹体吊得比
 * 短舱还低、弹头伸出翼前缘，从侧面和下方看都是最显眼的部分。
 * 红色识别：主翼 / 垂尾前缘、尾撑环带、尾撑前端的两只照射器“眼”。
 */
function buildStriker(ctx: EnemyBuildContext): SignalLightAnchors {
  const { group, materials, weaponMaterial } = ctx;
  const boomX = 1.75;

  // 中央短舱
  addFuselage(
    group,
    [
      [0.04, -2.0],
      [0.4, -1.75],
      [0.56, -1.0],
      [0.62, 0.0],
      [0.58, 1.0],
      [0.44, 1.9],
      [0.24, 2.6],
      [0.07, 3.05],
      [0.02, 3.2],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.0, heightScale: 1.08 }
  );

  // 传感器整流罩
  addSensorVisor(ctx, [0, 0.5, 1.55], 0.42, [0.85, 0.62, 1.7]);

  // 上单翼：小后掠梯形翼
  addWingPair(
    group,
    [
      [0, 1.0],
      [3.7, 0.3],
      [3.7, -0.6],
      [0, -1.15],
    ],
    0.11,
    materials.wing,
    [0.35, 0.28, -0.3],
    1
  );
  addLeadingEdgeStripPair(
    group,
    materials.accent,
    [0.7, 0.28, 0.63],
    [4.05, 0.28, 0.0],
    0.16,
    true,
    0.13
  );

  // 两侧进气道（钢灰唇口）
  addIntakePair(ctx, [0.6, 0.0, 0.3], [0.3, 0.44, 1.5], 0.04, materials.detail);

  // 双尾撑 + 前端照射器 + 红色环带
  for (const side of [1, -1] as const) {
    const boom = addFuselage(
      group,
      [
        [0.02, -4.0],
        [0.13, -3.8],
        [0.19, -2.2],
        [0.24, 0.0],
        [0.2, 1.0],
        [0.04, 1.55],
      ],
      materials.body,
      1,
      { segments: 8, offsetY: 0.2 }
    );
    boom.position.x = side * boomX;
    addMeshPart(group, signalLightGeometry, materials.light, [side * boomX, 0.2, 1.52], {
      scale: [1.5, 1.5, 2.0],
      castShadow: false,
      shared: true,
    });
    addMeshPart(group, sharedGeometries.storeBody, materials.accent, [side * boomX, 0.2, -2.6], {
      rotation: [Math.PI / 2, 0, 0],
      scale: [0.21, 0.18, 0.21],
      castShadow: false,
      shared: true,
    });
  }

  // 双垂尾 + 顶部高平尾
  addFinPair(
    group,
    [
      [0, 0],
      [1.3, 0],
      [0.6, 1.4],
      [0.12, 1.4],
    ],
    0.07,
    materials.wing,
    [boomX, 0.3, -3.95],
    1
  );
  addMeshPart(group, sharedGeometries.unitBox, materials.wing, [0, 1.68, -3.6], {
    scale: [3.9, 0.07, 0.62],
    shared: true,
  });
  addLeadingEdgeStripPair(group, materials.accent, [boomX, 0.34, -2.66], [boomX, 1.68, -3.36], 0.1);
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * boomX, 1.78, -3.6], 0.7, ctx.tipLight);
  }

  // 单发：喷口在短舱尾端、两条尾撑之间
  addEnemyEngine(ctx, [0, 0, -2.05], 0.38, { name: 'engineGlow', glowLength: 1.4 });

  // 翼下四个挂架：挂架 + 发射导轨 + 大型导弹 + 红色导引头环带
  for (const side of [1, -1] as const) {
    for (const [x, z] of STRIKER_RACKS) {
      const px = side * x;
      addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [px, -0.08, z - 0.25], {
        scale: [0.09, 0.62, 0.95],
        shared: true,
      });
      addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [px, -0.41, z - 0.1], {
        scale: [0.13, 0.07, 1.9],
        shared: true,
      });
      addStore(group, materials.detail, weaponMaterial, [px, -0.6, z], 2.5, 0.15, 1, true);
      addMeshPart(group, sharedGeometries.storeBody, materials.accent, [px, -0.6, z + 1.05], {
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.162, 0.2, 0.162],
        castShadow: false,
        shared: true,
      });
    }
  }

  // 细节：空速管 / 背部刀形天线
  addMeshPart(group, sharedGeometries.unitCylinder, materials.detail, [0, 0, 3.4], {
    scale: [0.016, 0.42, 0.016],
    rotation: [Math.PI / 2, 0, 0],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.76, -0.4], {
    scale: [0.03, 0.2, 0.26],
    shared: true,
  });

  return {
    wingtip: [4.05, 0.3, -0.45],
    tail: [0, 1.76, -3.6],
    belly: [0, -0.72, 0.2],
  };
}

/** 幽灵机翼面的下反角（弧度）：正面看是一道压低的“人”字 */
const WRAITH_ANHEDRAL = 0.1;
/** 幽灵机的哑光黑机体色 */
const WRAITH_HULL_COLOR = 0x101216;

/**
 * WRAITH - 幽灵机：棱角分明的哑光黑飞翼（箭头形平面 + 锯齿后缘 + 菱形截面机身与背鳍），
 * 细红线勾出整圈翼缘，机头一只红色“独眼”（网格名 wraithEye），尾端一道扁喷口辉光。
 * 为配合隐形淡出（逐机克隆材质改不透明度），全机只用两种材质：哑光黑机体（materials.body）
 * 与红色辉光（materials.light），外加四盏共享信号灯；没有叠加混合的部件。
 */
function buildWraith(ctx: EnemyBuildContext): SignalLightAnchors {
  const { group, materials } = ctx;
  const hull = materials.body;
  const glow = materials.light;
  const cos = Math.cos(WRAITH_ANHEDRAL);
  const sin = Math.sin(WRAITH_ANHEDRAL);
  /** 翼面坐标（外侧，前方）→ +X 侧的机体坐标（翼面带下反角） */
  const onWing = ([outward, forward]: PlanformPoint): [number, number, number] => [
    outward * cos,
    -outward * sin,
    forward,
  ];

  // 机身：四段旋成体 = 菱形截面，两侧是锐利的棱线
  addFuselage(
    group,
    [
      // 尾段收得比中央尾齿还窄，不从锯齿缺口里露出来
      [0.02, -2.2],
      [0.12, -1.9],
      [0.3, -1.4],
      [0.5, -0.6],
      [0.55, 0.35],
      [0.36, 1.7],
      [0.12, 2.75],
      [0.02, 3.3],
    ],
    hull,
    1,
    { segments: 4, widthScale: 2.4, heightScale: 0.62 }
  );
  // 背鳍状的发动机整流包（同样是菱形截面）
  addFuselage(
    group,
    [
      [0.02, -1.7],
      [0.28, -1.2],
      [0.36, -0.4],
      [0.24, 0.6],
      [0.02, 1.45],
    ],
    hull,
    1,
    { segments: 4, widthScale: 1.5, heightScale: 1.0, offsetY: 0.17 }
  );

  // 箭头形飞翼 + 三齿锯齿后缘
  const outline: PlanformPoint[] = [
    [0, 3.1],
    [4.2, -1.8],
    [2.7, -1.15],
    [1.75, -2.35],
    [0.8, -1.4],
    [0, -2.4],
  ];
  addWingPair(group, outline, 0.08, hull, [0, 0, 0], 1, { dihedral: -WRAITH_ANHEDRAL });

  // 细红线勾出整圈翼缘（比翼面略厚，上下和正面都看得见）
  const edge: PlanformPoint[] = [[0.14, 2.94], ...outline.slice(1)];
  for (let i = 0; i < edge.length - 1; i += 1) {
    addLeadingEdgeStripPair(group, glow, onWing(edge[i]), onWing(edge[i + 1]), 0.12, true, 0.12);
  }

  // 机头“独眼”
  addMeshPart(group, signalLightGeometry, glow, [0, 0.03, 3.1], {
    scale: [2.1, 1.5, 4.2],
    castShadow: false,
    name: 'wraithEye',
    shared: true,
  });

  // 扁喷口辉光：整流包后面、贴在中央尾齿上表面的一道红条，从下方看不到（尾迹从这里采样）
  addMeshPart(group, sharedGeometries.unitBox, glow, [0, 0.055, -1.9], {
    scale: [0.4, 0.04, 0.26],
    castShadow: false,
    name: 'engineGlow',
    shared: true,
  });

  return {
    wingtip: onWing([4.05, -1.7]),
    tail: [0, 0.46, -1.25],
    belly: [0, -0.36, 0.35],
  };
}

/** 命中半径（米）= 2.5 × 机体缩放：缩放 2.0 对应沿用至今的 5 米 */
const HIT_RADIUS_PER_SCALE = 2.5;

/**
 * 创建敌机模型 - 八种机型轮廓（机头朝 +Z，机尾在 -Z），敌方无人机涂装。
 * 各机型大小不同（scaleMultiplier），根节点 userData.hitRadius 随之变化；
 * 根节点 name 是机型的 EnemyType 字符串（血条标签等按它识别）。
 */
export function createEnemyMesh(config: EnemyConfig): THREE.Group {
  const group = new THREE.Group();

  // 机型之间靠红色饰条的位置区分（见各 build 函数），机体色只在同一族里微调
  let bodyColor: number = HOSTILE_LIVERY.hull;
  let wingColor: number = 0x2b3036;
  let accentColor: number = HOSTILE_LIVERY.accent;
  let bodySize = 1.6;
  let bodyLength = 6;
  let wingSpan = 3;
  let scaleMultiplier = 2.0;

  switch (config.type) {
    case EnemyType.SCOUT:
      // 最小的机型：机体略浅一档，远处不至于只剩一个黑点
      bodyColor = 0x464c56;
      wingColor = 0x33383f;
      bodySize = 1.42;
      bodyLength = 6.2;
      wingSpan = 5.4;
      scaleMultiplier = 1.5;
      break;
    case EnemyType.FIGHTER:
      bodySize = 1.86;
      bodyLength = 8.4;
      wingSpan = 7.4;
      scaleMultiplier = 2.0;
      break;
    case EnemyType.HEAVY:
      bodyColor = 0x363a42;
      wingColor = 0x272b31;
      bodySize = 2.52;
      bodyLength = 10.6;
      wingSpan = 10.8;
      scaleMultiplier = 3.0;
      break;
    case EnemyType.SNIPER:
      wingColor = 0x2e3339;
      bodySize = 1.6;
      bodyLength = 10.4;
      wingSpan = 6.6;
      scaleMultiplier = 2.1;
      break;
    case EnemyType.ACE:
      // 精英：近黑机体 + 亮绯红饰条
      bodyColor = 0x2a2d34;
      wingColor = HOSTILE_LIVERY.hullDark;
      accentColor = HOSTILE_LIVERY.eliteAccent;
      bodySize = 2.04;
      bodyLength = 8.8;
      wingSpan = 7.8;
      scaleMultiplier = 2.2;
      break;
    // 以下三种机型的 build 函数直接写机体坐标，不用 bodySize / bodyLength / wingSpan
    case EnemyType.JAMMER:
      scaleMultiplier = 2.2;
      break;
    case EnemyType.STRIKER:
      scaleMultiplier = 2.4;
      break;
    case EnemyType.WRAITH:
      // 哑光黑：机身与翼面同色
      bodyColor = WRAITH_HULL_COLOR;
      wingColor = WRAITH_HULL_COLOR;
      scaleMultiplier = 2.0;
      break;
    default:
      // 还没有专属机体的机型：通用敌方涂装 + 王牌机轮廓，缩放 2.0
      bodySize = 2.04;
      bodyLength = 8.8;
      wingSpan = 7.8;
  }

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  const materials = getOrCreateMaterials(config.type, bodyColor, wingColor, accentColor);
  // 武器/内腔材质同样跨实例共享：武器取自按机型缓存，内腔为模块级常量
  const weaponMaterial = materials.weapon;
  const cavityMaterial = enemyCavityMaterial;

  const ctx: EnemyBuildContext = {
    group,
    materials,
    weaponMaterial,
    cavityMaterial,
    flame: hostileExhaustFlame,
    tipLight: hostileSignalLights.beacon,
    bodySize,
    bodyLength,
    wingSpan,
  };

  // 新机型自己给出信号灯挂点；其余机型按包围盒推算
  let lightAnchors: SignalLightAnchors | undefined;
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
    case EnemyType.JAMMER:
      lightAnchors = buildJammer(ctx);
      break;
    case EnemyType.STRIKER:
      lightAnchors = buildStriker(ctx);
      break;
    case EnemyType.WRAITH:
      lightAnchors = buildWraith(ctx);
      break;
    case EnemyType.ACE:
    default:
      buildAce(ctx);
      break;
  }

  // 敌机机头朝 +Z，机尾在 -Z
  addNavigationLights(group, -1, hostileSignalLights, lightAnchors);

  group.name = config.type;
  group.userData.faction = Faction.ENEMY;
  group.userData.hitRadius = HIT_RADIUS_PER_SCALE * scaleMultiplier;
  return group;
}

// ---------------------------------------------------------------------------
// 友军僚机：玩家机同族的独立机体（融合机身、气泡座舱盖、梯形主翼、外倾双垂尾、双发），
// 不再借用敌机机体。钢蓝机身 + 金色识别（主翼 / 垂尾前缘、背脊条、尾撑识别带，与 HUD 友军色
// 一致）+ 金色镀膜座舱 + 金色识别频闪 / 信标 + 橙金尾焰。
// 机头朝 +Z（与敌机一样由 lookAt 驱动），所有部件直接挂在根节点上。
// ---------------------------------------------------------------------------

const ALLIED_LIVERY = {
  body: 0x5c7fa6,
  wing: 0x4a6b90,
  accent: 0xf2c94c,
  accentEmissive: 0.2,
  detail: 0x34414f,
  weapon: 0x98a2ad,
  canopy: 0x3a3218,
  canopyEmissive: 0xd9a933,
  light: 0xffd36a,
  engine: 0xff8a2a,
} as const;

/** 友军僚机的机体缩放（命中半径 5 米）与根节点名（血条按它显示“友军战斗机”/ 呼号） */
const ALLIED_SCALE = 2.0;
const ALLIED_MESH_NAME = EnemyType.FIGHTER;

let alliedMaterials: CachedMaterials | null = null;

function getOrCreateAlliedMaterials(): CachedMaterials {
  if (alliedMaterials) return alliedMaterials;

  const engine = new THREE.MeshBasicMaterial({
    color: ALLIED_LIVERY.engine,
    transparent: true,
    opacity: 0.4,
  });
  registerEngineGlowMaterial(engine);

  alliedMaterials = {
    // 场景没有环境贴图：金属度取低值并带蓝色自发光下限，背光面也读得出钢蓝，
    // 不会和深色的敌机混在一起
    body: createAircraftMaterial(ALLIED_LIVERY.body, 0.3, 0.42, 0.3),
    wing: createAircraftMaterial(ALLIED_LIVERY.wing, 0.3, 0.46, 0.26),
    cockpit: new THREE.MeshStandardMaterial({
      color: ALLIED_LIVERY.canopy,
      metalness: 0.96,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9,
      emissive: ALLIED_LIVERY.canopyEmissive,
      emissiveIntensity: 0.14,
    }),
    engine,
    accent: createAircraftMaterial(ALLIED_LIVERY.accent, 0.55, 0.32, ALLIED_LIVERY.accentEmissive),
    detail: createAircraftMaterial(ALLIED_LIVERY.detail, 0.45, 0.6, 0),
    light: new THREE.MeshBasicMaterial({
      color: ALLIED_LIVERY.light,
      transparent: true,
      opacity: 0.85,
    }),
    weapon: createAircraftMaterial(ALLIED_LIVERY.weapon, 0.86, 0.26, 0.01),
  };
  return alliedMaterials;
}

/**
 * 友军僚机机体（玩家机同族）：扁宽融合机身 + 棱线机头 + 气泡座舱盖 + 边条 + 40° 后掠梯形主翼
 * + 全动平尾 + 外倾双垂尾 + 两侧进气道 + 双发圆喷口；翼下 / 翼尖各一对格斗弹。
 */
function buildAlliedFighter(ctx: EnemyBuildContext): void {
  const { group, materials, weaponMaterial } = ctx;

  // 融合机身：扁宽旋成体，尾端收圆，双发喷管从两侧伸出
  addFuselage(
    group,
    [
      [0.03, -3.85],
      [0.42, -3.6],
      [0.56, -2.9],
      [0.68, -1.6],
      [0.72, -0.2],
      [0.66, 1.1],
      [0.5, 2.3],
      [0.28, 3.3],
      [0.08, 4.0],
      [0.02, 4.3],
    ],
    materials.body,
    1,
    { segments: 10, widthScale: 1.3, heightScale: 0.9 }
  );

  // 棱线机头
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.wing, [side * 0.33, 0, 3.0], {
      scale: [0.62, 0.06, 2.3],
      rotation: [0, -side * 0.13, 0],
      shared: true,
    });
  }

  // 气泡座舱盖（金色镀膜）
  addBubbleCanopy(ctx, [0, 0.5, 1.75], 0.5, [0.95, 0.64, 1.75]);

  // 前缘根部延伸（LERX）
  addWingPair(
    group,
    [
      [0, 0],
      [0.7, 0.08],
      [0, 1.9],
    ],
    0.06,
    materials.wing,
    [0.62, 0.12, 0.9],
    1
  );

  // 主翼：~40° 前缘后掠梯形翼，强收窄，轻微下反
  addWingPair(
    group,
    [
      [0, 1.7],
      [2.75, -1.0],
      [2.75, -1.6],
      [0, -1.7],
    ],
    0.08,
    materials.wing,
    [0.66, -0.02, -0.5],
    1,
    { dihedral: -0.05 }
  );

  // 全动平尾
  addWingPair(
    group,
    [
      [0, 0.8],
      [1.5, -0.25],
      [1.5, -0.65],
      [0, -0.85],
    ],
    0.06,
    materials.wing,
    [0.6, 0, -3.2],
    1,
    { dihedral: -0.04 }
  );

  // 外倾双垂尾
  addFinPair(
    group,
    [
      [0, 0],
      [1.75, 0],
      [1.15, 1.6],
      [0.45, 1.6],
    ],
    0.06,
    materials.wing,
    [0.85, 0.3, -3.75],
    1,
    0.3
  );

  // 两侧进气道
  addIntakePair(ctx, [0.92, -0.12, 0.7], [0.5, 0.48, 1.9], 0.05, materials.wing);

  // 尾部平台与尾撑
  addMeshPart(group, sharedGeometries.unitBox, materials.body, [0, 0.24, -2.8], {
    scale: [1.75, 0.14, 2.1],
    shared: true,
  });
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.wing, [side * 1.08, 0, -3.0], {
      scale: [0.44, 0.3, 1.7],
      shared: true,
    });
  }

  // 双发圆喷口 + 橙金尾焰（仅第一个命名 engineGlow）
  addEnemyEngine(ctx, [-0.36, -0.02, -3.75], 0.3, { name: 'engineGlow', glowLength: 1.1 });
  addEnemyEngine(ctx, [0.36, -0.02, -3.75], 0.3, { glowLength: 1.1 });

  // 腹鳍
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.detail, [side * 0.6, -0.46, -2.6], {
      scale: [0.05, 0.42, 0.9],
      rotation: [0, 0, -side * 0.35],
      shared: true,
    });
  }

  // 翼下挂架 + 格斗弹，翼尖发射轨 + 格斗弹
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [side * 1.7, -0.24, -0.7], {
      scale: [0.09, 0.24, 0.8],
      shared: true,
    });
    addStore(
      group,
      weaponMaterial,
      materials.detail,
      [side * 1.7, -0.46, -0.65],
      1.3,
      0.08,
      1,
      true
    );
    addMeshPart(group, sharedGeometries.unitBox, weaponMaterial, [side * 3.44, -0.16, -1.75], {
      scale: [0.07, 0.09, 1.5],
      shared: true,
    });
    addStore(
      group,
      weaponMaterial,
      materials.detail,
      [side * 3.44, -0.27, -1.8],
      1.4,
      0.075,
      1,
      true
    );
  }

  // —— 金色识别 ——
  // 主翼前缘
  addLeadingEdgeStripPair(group, materials.accent, [0.72, -0.01, 1.14], [3.4, -0.15, -1.52], 0.16);
  // 垂尾前缘 + 垂尾顶端吊舱（金色识别频闪）
  addLeadingEdgeStripPair(group, materials.accent, [0.85, 0.3, -2.0], [1.32, 1.83, -2.6], 0.1);
  for (const side of [1, -1] as const) {
    addFinTipPod(group, [side * 1.33, 1.86, -2.95], 0.7, ctx.tipLight);
  }
  // 背脊整流罩 + 背脊条
  addMeshPart(group, sharedGeometries.unitBox, materials.body, [0, 0.58, -0.9], {
    scale: [0.26, 0.14, 2.8],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitBox, materials.accent, [0, 0.66, -0.9], {
    scale: [0.2, 0.025, 2.6],
    castShadow: false,
    shared: true,
  });
  // 尾撑顶面识别带
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.accent, [side * 1.08, 0.16, -2.5], {
      scale: [0.46, 0.03, 0.32],
      castShadow: false,
      shared: true,
    });
  }

  // 细节：机身侧编队灯条（金色）/ 空速管 / 背部刀形天线
  for (const side of [1, -1] as const) {
    addMeshPart(group, sharedGeometries.unitBox, materials.light, [side * 0.94, 0.08, -0.5], {
      scale: [0.02, 0.05, 1.6],
      castShadow: false,
      shared: true,
    });
  }
  addMeshPart(group, sharedGeometries.unitCylinder, materials.detail, [0, 0, 4.48], {
    scale: [0.016, 0.4, 0.016],
    rotation: [Math.PI / 2, 0, 0],
    shared: true,
  });
  addMeshPart(group, sharedGeometries.unitBox, materials.detail, [0, 0.74, -1.6], {
    scale: [0.03, 0.16, 0.24],
    shared: true,
  });
}

/**
 * 创建友军僚机模型：玩家机同族的独立机体，与 config.type 无关（参数只为保持调用方签名）。
 * 根节点 name 固定为 'FIGHTER'，userData.faction = Faction.FRIENDLY（尾迹等按它分辨阵营），
 * userData.hitRadius = 5。
 */
export function createFriendlyMesh(_config: EnemyConfig): THREE.Group {
  const group = new THREE.Group();
  group.scale.setScalar(ALLIED_SCALE);

  const materials = getOrCreateAlliedMaterials();
  buildAlliedFighter({
    group,
    materials,
    weaponMaterial: materials.weapon,
    cavityMaterial: enemyCavityMaterial,
    flame: alliedExhaustFlame,
    tipLight: alliedSignalLights.strobe,
    bodySize: 1.9,
    bodyLength: 8.2,
    wingSpan: 6.9,
  });

  // 机头朝 +Z，机尾在 -Z
  addNavigationLights(group, -1, alliedSignalLights);

  group.name = ALLIED_MESH_NAME;
  group.userData.faction = Faction.FRIENDLY;
  group.userData.hitRadius = HIT_RADIUS_PER_SCALE * ALLIED_SCALE;
  return group;
}
