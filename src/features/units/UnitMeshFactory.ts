import * as THREE from 'three';
import { UNIT_CONFIGS, UnitType, isUnitType } from './UnitTypes';
import {
  NodeBuilder,
  bakeTemplate,
  box,
  disposeTemplate,
  disposeUnitMaterials,
  instantiateTemplate,
  type UnitTemplateNode,
} from './UnitMeshKit';
import {
  buildAaGun,
  buildAllyConvoy,
  buildCivilianTruck,
  buildRadarStation,
  buildSamLauncher,
  buildTank,
} from './UnitMeshesGround';
import {
  buildAllyFrigate,
  buildCivilianShip,
  buildFrigate,
  buildGunboat,
  buildSubmarine,
} from './UnitMeshesSea';
import {
  buildAllyAwacs,
  buildAllyTransport,
  buildAttackHelicopter,
  buildBomber,
  buildCivilianAirliner,
  buildDrone,
} from './UnitMeshesAir';

/**
 * 单位模型工厂
 *
 * createUnitMesh(type) 返回 THREE.Group：
 * - userData.unitType / userData.hitRadius（米）/ userData.faction
 * - userData.displayName：UNIT_CONFIGS[type].name（双语显示名，HUD 血条 / 目标标记用）
 * - userData.aimPoint：车体 / 舰体中部的空节点（玩家导弹 / 自动瞄准的目标点）
 * - 可动部件（按类型存在）：turret、barrel、launcher、rackMissiles[]、muzzle、muzzles[]、
 *   dish、radar、ciws、vls、wake、bowWake、periscope、prop、props[]、mainRotor、tailRotor、
 *   rotodome、tailGun、bombBay、chinGun
 * - 几何与材质跨实例共享（userData.sharedResource = true），实例销毁时不释放。
 */

const BUILDERS: Record<UnitType, () => NodeBuilder> = {
  [UnitType.TANK]: buildTank,
  [UnitType.SAM_LAUNCHER]: buildSamLauncher,
  [UnitType.AA_GUN]: buildAaGun,
  [UnitType.RADAR_STATION]: buildRadarStation,
  [UnitType.GUNBOAT]: buildGunboat,
  [UnitType.FRIGATE]: buildFrigate,
  [UnitType.SUBMARINE]: buildSubmarine,
  [UnitType.ATTACK_HELICOPTER]: buildAttackHelicopter,
  [UnitType.BOMBER]: buildBomber,
  [UnitType.DRONE]: buildDrone,
  [UnitType.ALLY_CONVOY]: buildAllyConvoy,
  [UnitType.ALLY_FRIGATE]: buildAllyFrigate,
  [UnitType.ALLY_AWACS]: buildAllyAwacs,
  [UnitType.ALLY_TRANSPORT]: buildAllyTransport,
  [UnitType.CIVILIAN_AIRLINER]: buildCivilianAirliner,
  [UnitType.CIVILIAN_SHIP]: buildCivilianShip,
  [UnitType.CIVILIAN_TRUCK]: buildCivilianTruck,
};

/**
 * 显示缩放：小型载具在真实尺寸下从空中难以辨认，按街机惯例适度放大
 * （UNIT_CONFIGS.hitRadius 已按放大后的尺寸设定）。
 */
export const UNIT_DISPLAY_SCALE: Readonly<Partial<Record<UnitType, number>>> = {
  [UnitType.TANK]: 1.35,
  [UnitType.SAM_LAUNCHER]: 1.3,
  [UnitType.AA_GUN]: 1.3,
  [UnitType.ATTACK_HELICOPTER]: 1.2,
  [UnitType.DRONE]: 1.6,
  [UnitType.ALLY_CONVOY]: 1.3,
  [UnitType.CIVILIAN_TRUCK]: 1.3,
};

/**
 * 瞄准点高度（模型局部坐标，米）：模型原点在地面 / 水线，导弹与自动瞄准应瞄向车体 / 舰体中部。
 * 实例上以 userData.aimPoint（空 Object3D）暴露，findByMesh 可从它反查单位。
 */
const AIM_POINT_HEIGHT: Readonly<Partial<Record<UnitType, number>>> = {
  [UnitType.TANK]: 2.2,
  [UnitType.SAM_LAUNCHER]: 2.4,
  [UnitType.AA_GUN]: 1.8,
  [UnitType.RADAR_STATION]: 4,
  [UnitType.GUNBOAT]: 2.4,
  [UnitType.FRIGATE]: 6.5,
  [UnitType.SUBMARINE]: 1.4,
  [UnitType.ALLY_CONVOY]: 2.4,
  [UnitType.ALLY_FRIGATE]: 6.5,
  [UnitType.CIVILIAN_SHIP]: 8,
  [UnitType.CIVILIAN_TRUCK]: 2.2,
};

const templateCache = new Map<UnitType, UnitTemplateNode>();
let fallbackTemplate: UnitTemplateNode | null = null;

function getTemplate(type: UnitType): UnitTemplateNode {
  const cached = templateCache.get(type);
  if (cached) return cached;
  const template = bakeTemplate(BUILDERS[type]());
  templateCache.set(type, template);
  return template;
}

function getFallbackTemplate(): UnitTemplateNode {
  if (!fallbackTemplate) {
    const node = new NodeBuilder('UNKNOWN_UNIT');
    node.add('hHull', box(4, 2, 6), [0, 1, 0]);
    fallbackTemplate = bakeTemplate(node);
  }
  return fallbackTemplate;
}

/** 创建单位模型（几何 / 材质共享，Group 与 Mesh 为新实例） */
export function createUnitMesh(type: UnitType): THREE.Group {
  if (!isUnitType(type)) {
    const group = instantiateTemplate(getFallbackTemplate());
    group.name = 'UNIT_UNKNOWN';
    group.userData.hitRadius = 5;
    return group;
  }
  const config = UNIT_CONFIGS[type];
  const group = instantiateTemplate(getTemplate(type));
  group.name = `UNIT_${type}`;
  group.userData.unitType = type;
  // 显示名（双语对象）：HUD 目标标记直接读它，不必把单位模块拉进 HUD 分包
  group.userData.displayName = config.name;
  group.userData.hitRadius = config.hitRadius;
  const displayScale = UNIT_DISPLAY_SCALE[type] ?? 1;
  if (displayScale !== 1) group.scale.setScalar(displayScale);
  group.userData.faction = config.faction;
  const aimPoint = new THREE.Object3D();
  aimPoint.name = 'aimPoint';
  aimPoint.position.set(0, AIM_POINT_HEIGHT[type] ?? 0, 0);
  group.add(aimPoint);
  group.userData.aimPoint = aimPoint;
  if (type === UnitType.RADAR_STATION) {
    group.userData.priorityTarget = true;
  }
  return group;
}

/** 预热：提前烘焙全部模板（加载界面调用可避免首次出现时卡顿） */
export function prewarmUnitMeshes(types: readonly UnitType[] = Object.values(UnitType)): void {
  for (const type of types) {
    if (isUnitType(type)) getTemplate(type);
  }
}

/** 释放所有共享模板与材质（应用彻底退出时调用；之后再创建会重新烘焙） */
export function disposeUnitMeshResources(): void {
  for (const template of templateCache.values()) disposeTemplate(template);
  templateCache.clear();
  if (fallbackTemplate) {
    disposeTemplate(fallbackTemplate);
    fallbackTemplate = null;
  }
  disposeUnitMaterials();
}
