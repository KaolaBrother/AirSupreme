import { Faction } from '@/core/Faction';

/**
 * 地面 / 海上 / 空中作战单位类型。
 *
 * 与喷气式敌机（EnemyType）互补：这里的单位有各自的作战域、阵营与行为，
 * 由 UnitSystem 统一驱动。枚举值为大写字符串，与 CampaignData.UNIT_FIRST_CONTACT_RADIO 的键一致。
 */
export enum UnitType {
  TANK = 'TANK',
  SAM_LAUNCHER = 'SAM_LAUNCHER',
  AA_GUN = 'AA_GUN',
  RADAR_STATION = 'RADAR_STATION',
  GUNBOAT = 'GUNBOAT',
  FRIGATE = 'FRIGATE',
  SUBMARINE = 'SUBMARINE',
  ATTACK_HELICOPTER = 'ATTACK_HELICOPTER',
  BOMBER = 'BOMBER',
  DRONE = 'DRONE',
  ALLY_CONVOY = 'ALLY_CONVOY',
  ALLY_FRIGATE = 'ALLY_FRIGATE',
  ALLY_AWACS = 'ALLY_AWACS',
  ALLY_TRANSPORT = 'ALLY_TRANSPORT',
  CIVILIAN_AIRLINER = 'CIVILIAN_AIRLINER',
  CIVILIAN_SHIP = 'CIVILIAN_SHIP',
  CIVILIAN_TRUCK = 'CIVILIAN_TRUCK',
}

/** 作战域：决定放置（贴地 / 浮于水面 / 空中）与雷达分类 */
export type UnitDomain = 'ground' | 'sea' | 'air';

/** 雷达小地图上的点位分类 */
export type UnitRadarKind = 'enemy-ground' | 'enemy-sea' | 'enemy-air' | 'ally' | 'neutral';

export interface UnitConfig {
  type: UnitType;
  /** 中文显示名（HUD / 无线电 / 结算） */
  name: string;
  domain: UnitDomain;
  faction: Faction;
  /** 基础血量（关卡强度倍率在 UnitSystem.setLevelScaling 中叠乘） */
  health: number;
  /** 巡航速度（米/秒） */
  speed: number;
  /** 命中判定半径（米），同时写入 mesh.userData.hitRadius */
  hitRadius: number;
  /** 击毁敌方单位的基础得分（非敌方为 0） */
  scoreValue: number;
  /** 玩家击毁平民 / 友军时的扣分（不适用为 0） */
  penalty: number;
  radarKind: UnitRadarKind;
  /** 护送目标：ALLY_CONVOY、ALLY_TRANSPORT */
  isEscort: boolean;
}

/** 规范顺序（与枚举声明顺序一致），用于遍历 / 预览 / 测试 */
export const UNIT_TYPES: readonly UnitType[] = [
  UnitType.TANK,
  UnitType.SAM_LAUNCHER,
  UnitType.AA_GUN,
  UnitType.RADAR_STATION,
  UnitType.GUNBOAT,
  UnitType.FRIGATE,
  UnitType.SUBMARINE,
  UnitType.ATTACK_HELICOPTER,
  UnitType.BOMBER,
  UnitType.DRONE,
  UnitType.ALLY_CONVOY,
  UnitType.ALLY_FRIGATE,
  UnitType.ALLY_AWACS,
  UnitType.ALLY_TRANSPORT,
  UnitType.CIVILIAN_AIRLINER,
  UnitType.CIVILIAN_SHIP,
  UnitType.CIVILIAN_TRUCK,
];

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  // ───────────────────────── 敌方地面 ─────────────────────────
  [UnitType.TANK]: {
    type: UnitType.TANK,
    name: '主战坦克',
    domain: 'ground',
    faction: Faction.ENEMY,
    health: 220,
    speed: 9,
    hitRadius: 7,
    scoreValue: 120,
    penalty: 0,
    radarKind: 'enemy-ground',
    isEscort: false,
  },
  [UnitType.SAM_LAUNCHER]: {
    type: UnitType.SAM_LAUNCHER,
    name: '地空导弹车',
    domain: 'ground',
    faction: Faction.ENEMY,
    health: 180,
    speed: 7,
    hitRadius: 8,
    scoreValue: 180,
    penalty: 0,
    radarKind: 'enemy-ground',
    isEscort: false,
  },
  [UnitType.AA_GUN]: {
    type: UnitType.AA_GUN,
    name: '双联高炮',
    domain: 'ground',
    faction: Faction.ENEMY,
    health: 160,
    speed: 0,
    hitRadius: 6.5,
    scoreValue: 150,
    penalty: 0,
    radarKind: 'enemy-ground',
    isEscort: false,
  },
  [UnitType.RADAR_STATION]: {
    type: UnitType.RADAR_STATION,
    name: '雷达站',
    domain: 'ground',
    faction: Faction.ENEMY,
    health: 300,
    speed: 0,
    hitRadius: 11,
    scoreValue: 250,
    penalty: 0,
    radarKind: 'enemy-ground',
    isEscort: false,
  },
  // ───────────────────────── 敌方海上 ─────────────────────────
  [UnitType.GUNBOAT]: {
    type: UnitType.GUNBOAT,
    name: '高速炮艇',
    domain: 'sea',
    faction: Faction.ENEMY,
    health: 200,
    speed: 26,
    hitRadius: 10,
    scoreValue: 140,
    penalty: 0,
    radarKind: 'enemy-sea',
    isEscort: false,
  },
  [UnitType.FRIGATE]: {
    type: UnitType.FRIGATE,
    name: '导弹护卫舰',
    domain: 'sea',
    faction: Faction.ENEMY,
    health: 650,
    speed: 11,
    hitRadius: 30,
    scoreValue: 400,
    penalty: 0,
    radarKind: 'enemy-sea',
    isEscort: false,
  },
  [UnitType.SUBMARINE]: {
    type: UnitType.SUBMARINE,
    name: '攻击潜艇',
    domain: 'sea',
    faction: Faction.ENEMY,
    health: 380,
    speed: 8,
    hitRadius: 20,
    scoreValue: 320,
    penalty: 0,
    radarKind: 'enemy-sea',
    isEscort: false,
  },
  // ───────────────────────── 敌方空中 ─────────────────────────
  [UnitType.ATTACK_HELICOPTER]: {
    type: UnitType.ATTACK_HELICOPTER,
    name: '武装直升机',
    domain: 'air',
    faction: Faction.ENEMY,
    health: 170,
    speed: 32,
    hitRadius: 8,
    scoreValue: 160,
    penalty: 0,
    radarKind: 'enemy-air',
    isEscort: false,
  },
  [UnitType.BOMBER]: {
    type: UnitType.BOMBER,
    name: '战略轰炸机',
    domain: 'air',
    faction: Faction.ENEMY,
    health: 700,
    speed: 38,
    hitRadius: 20,
    scoreValue: 450,
    penalty: 0,
    radarKind: 'enemy-air',
    isEscort: false,
  },
  [UnitType.DRONE]: {
    type: UnitType.DRONE,
    name: '自杀无人机',
    domain: 'air',
    faction: Faction.ENEMY,
    health: 35,
    speed: 52,
    hitRadius: 3.5,
    scoreValue: 40,
    penalty: 0,
    radarKind: 'enemy-air',
    isEscort: false,
  },
  // ───────────────────────── 友军 ─────────────────────────
  [UnitType.ALLY_CONVOY]: {
    type: UnitType.ALLY_CONVOY,
    name: '友军车队',
    domain: 'ground',
    faction: Faction.FRIENDLY,
    health: 420,
    speed: 11,
    hitRadius: 7,
    scoreValue: 0,
    penalty: 300,
    radarKind: 'ally',
    isEscort: true,
  },
  [UnitType.ALLY_FRIGATE]: {
    type: UnitType.ALLY_FRIGATE,
    name: '友军护卫舰',
    domain: 'sea',
    faction: Faction.FRIENDLY,
    health: 1400,
    speed: 9,
    hitRadius: 30,
    scoreValue: 0,
    penalty: 600,
    radarKind: 'ally',
    isEscort: false,
  },
  [UnitType.ALLY_AWACS]: {
    type: UnitType.ALLY_AWACS,
    name: '友军预警机',
    domain: 'air',
    faction: Faction.FRIENDLY,
    health: 700,
    speed: 34,
    hitRadius: 18,
    scoreValue: 0,
    penalty: 500,
    radarKind: 'ally',
    isEscort: false,
  },
  [UnitType.ALLY_TRANSPORT]: {
    type: UnitType.ALLY_TRANSPORT,
    name: '友军运输机',
    domain: 'air',
    faction: Faction.FRIENDLY,
    health: 560,
    speed: 30,
    hitRadius: 17,
    scoreValue: 0,
    penalty: 500,
    radarKind: 'ally',
    isEscort: true,
  },
  // ───────────────────────── 平民 ─────────────────────────
  [UnitType.CIVILIAN_AIRLINER]: {
    type: UnitType.CIVILIAN_AIRLINER,
    name: '民航客机',
    domain: 'air',
    faction: Faction.CIVILIAN,
    health: 260,
    speed: 44,
    hitRadius: 22,
    scoreValue: 0,
    penalty: 800,
    radarKind: 'neutral',
    isEscort: false,
  },
  [UnitType.CIVILIAN_SHIP]: {
    type: UnitType.CIVILIAN_SHIP,
    name: '民用货轮',
    domain: 'sea',
    faction: Faction.CIVILIAN,
    health: 500,
    speed: 7,
    hitRadius: 34,
    scoreValue: 0,
    penalty: 500,
    radarKind: 'neutral',
    isEscort: false,
  },
  [UnitType.CIVILIAN_TRUCK]: {
    type: UnitType.CIVILIAN_TRUCK,
    name: '民用卡车',
    domain: 'ground',
    faction: Faction.CIVILIAN,
    health: 70,
    speed: 13,
    hitRadius: 6,
    scoreValue: 0,
    penalty: 250,
    radarKind: 'neutral',
    isEscort: false,
  },
};

/** 运行时类型守卫：字符串是否为合法 UnitType */
export function isUnitType(value: unknown): value is UnitType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UNIT_CONFIGS, value);
}

/** 敌方单位（计入波次清场） */
export function isHostileUnitType(type: UnitType): boolean {
  return UNIT_CONFIGS[type].faction === Faction.ENEMY;
}
