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
  group.userData.hitRadius = config.hitRadius;
  group.userData.faction = config.faction;
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
