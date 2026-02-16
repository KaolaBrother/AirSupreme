/**
 * Boss 类型枚举
 */
export enum BossType {
  HEAVY_BOMBER = 'HEAVY_BOMBER', // 第一关 Boss：重型轰炸机
  // 后续可添加更多 Boss 类型
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
};

/**
 * 根据关卡获取 Boss 类型
 */
export function getBossForLevel(level: number): BossType | null {
  // 每个关卡都有对应的 Boss
  // 第一关是重型轰炸机，后续关卡可扩展
  switch (level) {
    case 1:
      return BossType.HEAVY_BOMBER;
    case 2:
    case 3:
    case 4:
    case 5:
      // 暂时都返回重型轰炸机，后续可扩展不同的 Boss
      return BossType.HEAVY_BOMBER;
    default:
      return null;
  }
}
