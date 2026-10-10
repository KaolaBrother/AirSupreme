import type { LocalizedText } from '@/i18n';

/**
 * 敌人类型枚举
 */
export enum EnemyType {
  SCOUT = 'SCOUT', // 侦察机 - 快速但脆弱
  FIGHTER = 'FIGHTER', // 战斗机 - 平衡型
  HEAVY = 'HEAVY', // 重型机 - 慢但血厚
  SNIPER = 'SNIPER', // 狙击手 - 远距离攻击
  ACE = 'ACE', // 王牌 - 高难度，聪明AI
  JAMMER = 'JAMMER', // 电子干扰机 - 无武装，拖慢玩家导弹锁定
  STRIKER = 'STRIKER', // 导弹攻击机 - 远距离导弹齐射
  WRAITH = 'WRAITH', // 幽灵机 - 隐形接近后偷袭
}

/**
 * 阵营尾迹颜色（粒子尾迹 / 凝结尾共用这一处定义）：敌方无人机红橙，友军僚机淡蓝；
 * 玩家座机保持白色。
 */
export const ENEMY_TRAIL_COLOR = 0xff5a3c;
export const FRIENDLY_TRAIL_COLOR = 0x7fd4ff;

/**
 * 敌人AI状态枚举
 */
export enum EnemyAIState {
  CHASE = 'chase', // 追逐玩家
  FIXED_DIRECTION = 'fixed_direction', // 固定方向飞行
  CIRCLE = 'circle', // 盘旋
}

/**
 * 敌人配置接口
 */
export interface EnemyConfig {
  type: EnemyType;
  /** 显示名（血条 / 模型预览），中英双语 */
  name: LocalizedText;

  // 基础属性
  health: number;
  speed: number;
  damage: number;

  // AI 行为参数
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  evasionChance: number; // 闪避概率 0-1
  accuracy: number; // 命中精度 0-1
  /**
   * 射击提前量 0..1（可选，缺省 0 = 瞄准目标当前位置）：由关卡曲线（Difficulty.enemyAimLead）
   * 在 LevelManager 生成敌机时写入；友军僚机不设置。
   */
  aimLead?: number;
  /**
   * 开火节奏倍率（可选，缺省 1）：条令里“两次点射 / 齐射 / 蓄力之间”的间隔乘以它
   * （难度档 × 关卡曲线的冷却倍率，由 LevelManager 生成敌机时写入）。预警时长不随它变化。
   */
  cadenceScale?: number;
  fireSpreadAngle: number; // 开火角度（度数）- 机头朝向目标在此角度范围内即可开火

  // 移动参数
  turnSpeed: number; // 转向速度
  maxRollAngle: number; // 最大翻滚角度
  wanderRadius: number; // 巡逻半径

  // 状态概率分布（基于导弹的新AI系统）
  stateProbabilities: {
    [EnemyAIState.CHASE]: number;
    [EnemyAIState.FIXED_DIRECTION]: number;
    [EnemyAIState.CIRCLE]: number;
  };

  // 状态持续时间范围（秒）
  stateDurationRange: [number, number];

  // 盘旋特定配置
  circleRadius: number; // 盘旋半径（米）
  circleHeight: number; // 盘旋高度偏移（米）

  // 分数
  scoreValue: number;

  // 颜色
  color: number;

  // 尺寸
  scale: number;
}

/**
 * 敌人配置预设
 */
export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.SCOUT]: {
    type: EnemyType.SCOUT,
    name: { en: 'Scout', zh: '侦察机' },
    health: 60, // 固定值：基础难度下一枚玩家导弹（80）击落
    speed: 48, // 袭扰机：小而灵活，冲刺（1.3×）时略快于玩家基础速度
    damage: 5, // 三连发点射的单发伤害
    detectionRange: 120,
    attackRange: 25,
    attackCooldown: 0.4,
    evasionChance: 0.3,
    accuracy: 0.4,
    fireSpreadAngle: 50,
    turnSpeed: 2.8, // 转向最快的机型
    maxRollAngle: Math.PI / 4,
    wanderRadius: 80,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.25, // 25% 追逐（降低）
      [EnemyAIState.FIXED_DIRECTION]: 0.5, // 50% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.25, // 25% 盘旋
    },
    stateDurationRange: [4, 8], // 4-8秒
    circleRadius: 150, // 150米半径
    circleHeight: 30, // 30米高度差
    scoreValue: 50,
    color: 0x44ff44,
    scale: 0.7,
  },

  [EnemyType.FIGHTER]: {
    type: EnemyType.FIGHTER,
    name: { en: 'Fighter', zh: '战斗机' },
    health: 100,
    speed: 55, // 比导弹慢30%
    damage: 7.5, // 伤害减半
    detectionRange: 100,
    attackRange: 30,
    attackCooldown: 0.5,
    evasionChance: 0.15,
    accuracy: 0.5,
    fireSpreadAngle: 45,
    turnSpeed: 2.0, // 中等转向速度
    maxRollAngle: Math.PI / 4,
    wanderRadius: 60,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.325, // 32.5% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.475, // 47.5% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.2, // 20% 盘旋
    },
    stateDurationRange: [4, 8], // 4-8秒
    circleRadius: 120, // 120米半径
    circleHeight: 40, // 40米高度差
    scoreValue: 100,
    color: 0xff4444, // 红色
    scale: 1.0,
  },

  [EnemyType.HEAVY]: {
    type: EnemyType.HEAVY,
    name: { en: 'Heavy Bomber', zh: '重型轰炸机' },
    health: 300,
    speed: 35, // 慢速但转向慢
    damage: 15, // 高炮弹单发伤害（尾炮按条令取其一半）
    detectionRange: 80,
    attackRange: 40,
    attackCooldown: 0.8,
    evasionChance: 0.02,
    accuracy: 0.6,
    fireSpreadAngle: 35,
    turnSpeed: 0.9, // 转向慢：不躲避
    maxRollAngle: Math.PI / 10,
    wanderRadius: 40,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.35, // 35% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.45, // 45% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.2, // 20% 盘旋
    },
    stateDurationRange: [5, 9], // 5-9秒（稍长，重型机反应慢）
    circleRadius: 100, // 100米半径
    circleHeight: 20, // 20米高度差
    scoreValue: 200,
    color: 0x884400,
    scale: 1.8,
  },

  [EnemyType.SNIPER]: {
    type: EnemyType.SNIPER,
    name: { en: 'Sniper', zh: '狙击机' },
    health: 80,
    speed: 45, // 中等速度
    damage: 20, // 蓄力长枪弹的伤害
    detectionRange: 200,
    attackRange: 80,
    attackCooldown: 1.0,
    evasionChance: 0.2,
    accuracy: 0.7,
    fireSpreadAngle: 60,
    turnSpeed: 1.5, // 中等转向
    maxRollAngle: Math.PI / 8,
    wanderRadius: 100,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.3, // 30% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.5, // 50% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.2, // 20% 盘旋
    },
    stateDurationRange: [4, 8], // 4-8秒
    circleRadius: 180, // 180米半径（狙击机保持距离）
    circleHeight: 50, // 50米高度差
    scoreValue: 150,
    color: 0x8800ff,
    scale: 0.9,
  },

  [EnemyType.ACE]: {
    type: EnemyType.ACE,
    name: { en: 'Ace', zh: '王牌飞行员' },
    health: 160,
    speed: 70, // 接近导弹速度
    damage: 12.5, // 伤害减半
    detectionRange: 150,
    attackRange: 35,
    attackCooldown: 0.4,
    evasionChance: 0.4,
    accuracy: 0.6,
    fireSpreadAngle: 55,
    turnSpeed: 2.4, // 接近导弹的转向速度
    maxRollAngle: Math.PI / 3,
    wanderRadius: 60,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.4, // 40% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.45, // 45% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.15, // 15% 盘旋
    },
    stateDurationRange: [3, 7], // 3-7秒（反应快，状态切换频繁）
    circleRadius: 100, // 100米半径
    circleHeight: 50, // 50米高度差
    scoreValue: 500,
    color: 0xffdd00, // 金色
    scale: 1.2,
  },

  [EnemyType.JAMMER]: {
    type: EnemyType.JAMMER,
    name: { en: 'Jammer', zh: '电子干扰机' },
    health: 120,
    speed: 38, // 慢速支援机
    damage: 0, // 无武装
    detectionRange: 200,
    attackRange: 0,
    attackCooldown: 1.0,
    evasionChance: 0.1,
    accuracy: 0.5,
    fireSpreadAngle: 30,
    turnSpeed: 1.1,
    maxRollAngle: Math.PI / 8,
    wanderRadius: 80,
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.2,
      [EnemyAIState.FIXED_DIRECTION]: 0.5,
      [EnemyAIState.CIRCLE]: 0.3,
    },
    stateDurationRange: [5, 9],
    circleRadius: 200,
    circleHeight: 40,
    scoreValue: 250,
    color: 0x9a4dff, // 紫色：干扰专用的识别色
    scale: 1.1,
  },

  [EnemyType.STRIKER]: {
    type: EnemyType.STRIKER,
    name: { en: 'Striker', zh: '导弹攻击机' },
    health: 140,
    speed: 46,
    damage: 24, // 单枚导弹伤害（没有机炮）
    detectionRange: 300,
    attackRange: 120,
    attackCooldown: 1.0,
    evasionChance: 0.1,
    accuracy: 0.6,
    fireSpreadAngle: 30,
    turnSpeed: 1.3,
    maxRollAngle: Math.PI / 6,
    wanderRadius: 100,
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.3,
      [EnemyAIState.FIXED_DIRECTION]: 0.5,
      [EnemyAIState.CIRCLE]: 0.2,
    },
    stateDurationRange: [5, 9],
    circleRadius: 220,
    circleHeight: 40,
    scoreValue: 300,
    color: 0xff5a3c,
    scale: 1.3,
  },

  [EnemyType.WRAITH]: {
    type: EnemyType.WRAITH,
    name: { en: 'Wraith', zh: '幽灵机' },
    health: 110,
    speed: 58,
    damage: 9, // 五连发点射的单发伤害
    detectionRange: 150,
    attackRange: 35,
    attackCooldown: 0.5,
    evasionChance: 0.3,
    accuracy: 0.6,
    fireSpreadAngle: 30,
    turnSpeed: 2.3,
    maxRollAngle: Math.PI / 4,
    wanderRadius: 60,
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.4,
      [EnemyAIState.FIXED_DIRECTION]: 0.4,
      [EnemyAIState.CIRCLE]: 0.2,
    },
    stateDurationRange: [3, 7],
    circleRadius: 110,
    circleHeight: 40,
    scoreValue: 350,
    color: 0x2a2a30,
    scale: 1.0,
  },
};

/**
 * 根据关卡和波次获取敌人配置
 */
export function getEnemyTypesForWave(level: number, wave: number): EnemyType[] {
  const types: EnemyType[] = [];

  // 根据关卡和波次决定出现什么类型的敌人
  if (level === 1) {
    // 第一关：主要是侦察机和战斗机
    if (wave === 1) {
      types.push(EnemyType.SCOUT);
    } else if (wave === 2) {
      types.push(EnemyType.SCOUT, EnemyType.FIGHTER);
    } else if (wave >= 3) {
      types.push(EnemyType.SCOUT, EnemyType.FIGHTER);
    }
  } else if (level === 2) {
    // 第二关：加入狙击手
    types.push(EnemyType.FIGHTER);
    if (wave >= 2) types.push(EnemyType.SNIPER);
    if (wave >= 3) types.push(EnemyType.SCOUT);
  } else if (level === 3) {
    // 第三关：重型机出现
    types.push(EnemyType.FIGHTER, EnemyType.SNIPER);
    if (wave >= 2) types.push(EnemyType.HEAVY);
  } else {
    // 第四关及以后：王牌出现
    types.push(EnemyType.FIGHTER, EnemyType.HEAVY);
    if (wave >= 2) types.push(EnemyType.ACE);
    if (wave >= 3) types.push(EnemyType.SNIPER);
  }

  return types;
}

/**
 * 根据敌人类型随机选择
 */
export function getRandomEnemyType(availableTypes: EnemyType[]): EnemyType {
  // 加权随机选择
  const weights = availableTypes.map((type) => {
    const config = ENEMY_CONFIGS[type];
    // 分数越高，出现概率越低
    return 1000 / config.scoreValue;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < availableTypes.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return availableTypes[i];
    }
  }

  return availableTypes[0];
}
