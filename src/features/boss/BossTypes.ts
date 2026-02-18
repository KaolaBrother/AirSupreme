/**
 * Boss 类型枚举
 */
export enum BossType {
  HEAVY_BOMBER = 'HEAVY_BOMBER', // 第一关 Boss：重型轰炸机
  DESERT_FORTRESS = 'DESERT_FORTRESS', // 第二关 Boss：沙漠堡垒
  OCTOPUS_WARSHIP = 'OCTOPUS_WARSHIP', // 第三关 Boss：八爪鱼战舰
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
  name: string;

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
  SPEED: 50,
  SCALE: 3,
  MAX_RANGE: 1500,
  AOE_RADIUS: 50,
  DAMAGE: 15,
  EXPLOSION_HEIGHT_VARIANCE: 20,
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
  CHANCE_ON_HIT: 0.05, // 5% 概率
  COOLDOWN: 10.0, // 10 秒冷却
  DURATION: 0.5, // 瞬移动画时长
  BOUNDS: {
    X: 400,
    Y_MIN: 100,
    Y_MAX: 250,
    Z: 400,
  },
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
    name: '重型轰炸机 Boss',
    health: 2000,
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
    name: '沙漠堡垒 Boss',
    health: 2500,
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
    name: '八爪鱼战舰 Boss',
    health: 3000,
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
};

/**
 * 根据关卡获取 Boss 类型
 */
export function getBossForLevel(level: number): BossType | null {
  switch (level) {
    case 1:
      return BossType.HEAVY_BOMBER;
    case 2:
      return BossType.DESERT_FORTRESS;
    case 3:
      return BossType.OCTOPUS_WARSHIP;
    case 4:
    case 5:
      return BossType.HEAVY_BOMBER;
    default:
      return null;
  }
}
