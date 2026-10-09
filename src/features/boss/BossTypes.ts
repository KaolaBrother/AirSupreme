import type { LocalizedText } from '@/i18n';

/**
 * Boss 类型枚举
 */
export enum BossType {
  HEAVY_BOMBER = 'HEAVY_BOMBER', // 第一关 Boss：重型轰炸机
  DESERT_FORTRESS = 'DESERT_FORTRESS', // 第二关 Boss：沙漠堡垒
  OCTOPUS_WARSHIP = 'OCTOPUS_WARSHIP', // 第三关 Boss：八爪鱼战舰
  MISSILE_DESTROYER = 'MISSILE_DESTROYER', // 第四关 Boss：导弹驱逐舰
  SKY_CARRIER = 'SKY_CARRIER', // 第五关 Boss：空中航空母舰
  MAGMA_COLOSSUS = 'MAGMA_COLOSSUS', // 第六关 Boss：熔岩巨像（四足攻城机甲）
  ABYSSAL_LEVIATHAN = 'ABYSSAL_LEVIATHAN', // 第七关 Boss：深渊利维坦（破冰巨型潜艇）
  TEMPEST_ZEPPELIN = 'TEMPEST_ZEPPELIN', // 第八关 Boss：雷霆飞艇（特斯拉线圈装甲飞艇）
  PHANTOM_WING = 'PHANTOM_WING', // 第九关 Boss：幻影之翼（隐形飞翼）
  ORACLE_PRIME = 'ORACLE_PRIME', // 第十关 Boss：神谕主宰（多阶段最终 Boss）
}

/**
 * Boss 四门重炮位置
 */
export enum BossCannonPosition {
  LEFT_WING = 'LEFT_WING', // 左翼
  RIGHT_WING = 'RIGHT_WING', // 右翼
  TOP = 'TOP', // 机背
  BOTTOM = 'BOTTOM', // 机腹
}

/**
 * Boss 配置接口
 */
export interface BossConfig {
  type: BossType;
  /** 配置名（模型预览 / 血条兜底），中英双语 */
  name: LocalizedText;

  // 基础属性
  health: number; // 血量
  speed: number; // 速度
  damage: number; // 单门重炮伤害
  scale: number; // 体型缩放

  // AI 行为参数
  circleRadius: number; // 绕圈半径
  turnSpeed: number; // 转向速度

  // 武器系统
  cannonFireInterval: number; // 重炮发射间隔（秒）
  missileFireInterval: number; // 导弹发射间隔（秒）
  missileDamage: number; // 导弹伤害

  // 射程
  maxRange: number; // 最大射程（导弹飞行距离上限）

  // 分数
  scoreValue: number;
}

/**
 * Boss 导弹配置
 */
export const BOSS_MISSILE_CONFIG = {
  SCALE: 4,
  SPEED_MULTIPLIER: 0.5,
  HEALTH: 20,
  MAX_RANGE: 5000,
  DAMAGE: 90,
};

/**
 * 防空炮配置（第二关 Boss 专用）
 */
export const FLAK_CANNON_CONFIG = {
  SPEED: 42,
  SCALE: 3,
  MAX_RANGE: 1500,
  AOE_RADIUS: 42,
  DAMAGE: 15,
  EXPLOSION_HEIGHT_VARIANCE: 20,
  ARMING_TIME: 0.32,
  WARNING_DISTANCE: 120,
  DETONATION_DISTANCE: 14,
};

/**
 * 激光扫射配置（第三关 Boss 专用）
 */
export const LASER_SWEEP_CONFIG = {
  WARNING_DURATION: 3.0,
  SWEEP_DURATION: 6.0,
  INTERVAL: 5.0,
  DAMAGE: 100,
  ROTATION_SPEED: (Math.PI * 2) / 6, // 60°/s = 6秒一圈
  COLOR: 0x00aaff, // 蓝色
  PLANE_THICKNESS: 15, // 激光平面厚度（米）
  RANGE: 800, // 激光射程
};

/**
 * 眼睛配置（第三关 Boss 专用）
 */
export const EYE_CONFIG = {
  HEALTH: 300,
  DAMAGE: 20,
  FIRE_INTERVAL: 1.5,
  BULLET_SPEED: 80,
  BULLET_LENGTH: 8,
  BULLET_RADIUS: 0.3,
  COUNT: 8,
};

/**
 * 瞬移配置（第三关 Boss 专用）
 */
export const TELEPORT_CONFIG = {
  CHANCE_ON_HIT: 0.05,
  COOLDOWN: 10.0,
  DURATION: 0.5,
  BOUNDS: {
    X: 400,
    Y_MIN: 100,
    Y_MAX: 250,
    Z: 400,
  },
};

export const FIGHTER_LAUNCH_CONFIG = {
  INTERVAL: 60.0,
  COUNT: 2,
  SPAWN_HEIGHT: 10,
};

/**
 * 防空炮位置（第二关 Boss）
 */
export enum FlakCannonPosition {
  FRONT_LEFT = 'FRONT_LEFT',
  FRONT_RIGHT = 'FRONT_RIGHT',
  BACK_LEFT = 'BACK_LEFT',
  BACK_RIGHT = 'BACK_RIGHT',
}

/**
 * Boss 配置预设
 */
export const BOSS_CONFIGS: Record<BossType, BossConfig> = {
  [BossType.HEAVY_BOMBER]: {
    type: BossType.HEAVY_BOMBER,
    name: { en: 'Heavy Bomber Boss', zh: '重型轰炸机 Boss' },
    health: 1400,
    speed: 10,
    damage: 15,
    scale: 5,
    circleRadius: 300,
    turnSpeed: 0.3,
    cannonFireInterval: 0.5,
    missileFireInterval: 10,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 2000,
  },
  [BossType.DESERT_FORTRESS]: {
    type: BossType.DESERT_FORTRESS,
    name: { en: 'Desert Fortress Boss', zh: '沙漠堡垒 Boss' },
    health: 2800,
    speed: 0,
    damage: FLAK_CANNON_CONFIG.DAMAGE,
    scale: 5,
    circleRadius: 0,
    turnSpeed: 0,
    cannonFireInterval: 2.0,
    missileFireInterval: 10,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: FLAK_CANNON_CONFIG.MAX_RANGE,
    scoreValue: 2500,
  },
  [BossType.OCTOPUS_WARSHIP]: {
    type: BossType.OCTOPUS_WARSHIP,
    name: { en: 'Octopus Warship Boss', zh: '八爪鱼战舰 Boss' },
    health: 6300,
    speed: 5,
    damage: LASER_SWEEP_CONFIG.DAMAGE,
    scale: 5,
    circleRadius: 100,
    turnSpeed: 0.3,
    cannonFireInterval: 0,
    missileFireInterval: 0,
    missileDamage: 0,
    maxRange: LASER_SWEEP_CONFIG.RANGE,
    scoreValue: 3000,
  },
  [BossType.MISSILE_DESTROYER]: {
    type: BossType.MISSILE_DESTROYER,
    name: { en: 'Missile Destroyer Boss', zh: '导弹驱逐舰 Boss' },
    health: 2500,
    speed: 10,
    damage: FLAK_CANNON_CONFIG.DAMAGE,
    scale: 5,
    circleRadius: 0,
    turnSpeed: 0.2,
    cannonFireInterval: 2.0,
    missileFireInterval: 15,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: FLAK_CANNON_CONFIG.MAX_RANGE,
    scoreValue: 3500,
  },
  [BossType.SKY_CARRIER]: {
    type: BossType.SKY_CARRIER,
    name: { en: 'Sky Carrier Boss', zh: '空中航空母舰 Boss' },
    health: 5000,
    speed: 8,
    damage: 30,
    scale: 5,
    circleRadius: 200,
    turnSpeed: 0.15,
    cannonFireInterval: 0.8,
    missileFireInterval: 12,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 4000,
  },
  [BossType.MAGMA_COLOSSUS]: {
    type: BossType.MAGMA_COLOSSUS,
    name: { en: 'Magma Colossus Boss', zh: '熔岩巨像 Boss' },
    health: 8100,
    speed: 6,
    damage: 19,
    scale: 5,
    circleRadius: 0,
    turnSpeed: 0.25,
    cannonFireInterval: 1.1,
    missileFireInterval: 14,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 5000,
  },
  [BossType.ABYSSAL_LEVIATHAN]: {
    type: BossType.ABYSSAL_LEVIATHAN,
    name: { en: 'Abyssal Leviathan Boss', zh: '深渊利维坦 Boss' },
    health: 4800,
    speed: 10,
    damage: 40,
    scale: 5.5,
    circleRadius: 0,
    turnSpeed: 0.12,
    cannonFireInterval: 0.9,
    missileFireInterval: 9,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 5500,
  },
  [BossType.TEMPEST_ZEPPELIN]: {
    type: BossType.TEMPEST_ZEPPELIN,
    name: { en: 'Tempest Zeppelin Boss', zh: '雷霆飞艇 Boss' },
    health: 14500,
    speed: 7,
    damage: 21,
    scale: 6,
    circleRadius: 0,
    turnSpeed: 0.1,
    cannonFireInterval: 0.7,
    missileFireInterval: 11,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 6000,
  },
  [BossType.PHANTOM_WING]: {
    type: BossType.PHANTOM_WING,
    name: { en: 'Phantom Wing Boss', zh: '幻影之翼 Boss' },
    health: 5600,
    speed: 26,
    damage: 36,
    scale: 5,
    circleRadius: 260,
    turnSpeed: 0.35,
    cannonFireInterval: 0.6,
    missileFireInterval: 10,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 6500,
  },
  [BossType.ORACLE_PRIME]: {
    type: BossType.ORACLE_PRIME,
    name: { en: 'Oracle Prime Boss', zh: '神谕主宰 Boss' },
    health: 10000,
    speed: 4,
    damage: 48,
    scale: 6,
    circleRadius: 0,
    turnSpeed: 0.2,
    cannonFireInterval: 0.55,
    missileFireInterval: 8,
    missileDamage: BOSS_MISSILE_CONFIG.DAMAGE,
    maxRange: BOSS_MISSILE_CONFIG.MAX_RANGE,
    scoreValue: 10000,
  },
};

/** 关卡 → Boss（战役十关一一对应） */
const LEVEL_BOSSES: readonly BossType[] = [
  BossType.HEAVY_BOMBER,
  BossType.DESERT_FORTRESS,
  BossType.OCTOPUS_WARSHIP,
  BossType.MISSILE_DESTROYER,
  BossType.SKY_CARRIER,
  BossType.MAGMA_COLOSSUS,
  BossType.ABYSSAL_LEVIATHAN,
  BossType.TEMPEST_ZEPPELIN,
  BossType.PHANTOM_WING,
  BossType.ORACLE_PRIME,
];

/**
 * 根据关卡获取 Boss 类型
 */
export function getBossForLevel(level: number): BossType | null {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_BOSSES.length) {
    return null;
  }

  return LEVEL_BOSSES[level - 1];
}
