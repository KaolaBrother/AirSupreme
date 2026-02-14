/**
 * 敌人类型枚举
 */
export enum EnemyType {
  SCOUT = 'SCOUT',         // 侦察机 - 快速但脆弱
  FIGHTER = 'FIGHTER',     // 战斗机 - 平衡型
  HEAVY = 'HEAVY',         // 重型机 - 慢但血厚
  SNIPER = 'SNIPER',       // 狙击手 - 远距离攻击
  ACE = 'ACE',             // 王牌 - 高难度，聪明AI
}

/**
 * 敌人AI状态枚举
 */
export enum EnemyAIState {
  CHASE = 'chase',                      // 追逐玩家
  FIXED_DIRECTION = 'fixed_direction',   // 固定方向飞行
  CIRCLE = 'circle'                      // 盘旋
}

/**
 * 敌人配置接口
 */
export interface EnemyConfig {
  type: EnemyType;
  name: string;

  // 基础属性
  health: number;
  speed: number;
  damage: number;

  // AI 行为参数
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  evasionChance: number;      // 闪避概率 0-1
  accuracy: number;           // 命中精度 0-1

  // 移动参数
  turnSpeed: number;          // 转向速度
  maxRollAngle: number;       // 最大翻滚角度
  wanderRadius: number;       // 巡逻半径

  // 状态概率分布（基于导弹的新AI系统）
  stateProbabilities: {
    [EnemyAIState.CHASE]: number;
    [EnemyAIState.FIXED_DIRECTION]: number;
    [EnemyAIState.CIRCLE]: number;
  };

  // 状态持续时间范围（秒）
  stateDurationRange: [number, number];

  // 盘旋特定配置
  circleRadius: number;        // 盘旋半径（米）
  circleHeight: number;        // 盘旋高度偏移（米）

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
    name: '侦察机',
    health: 30,
    speed: 40,              // 基于导弹（80）的一半
    damage: 10,
    detectionRange: 120,
    attackRange: 25,
    attackCooldown: 0.4,
    evasionChance: 0.3,
    accuracy: 0.4,
    turnSpeed: 1.5,         // 比导弹（2.5）慢很多
    maxRollAngle: Math.PI / 4,
    wanderRadius: 80,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.25,          // 25% 追逐（降低）
      [EnemyAIState.FIXED_DIRECTION]: 0.50,  // 50% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.25            // 25% 盘旋
    },
    stateDurationRange: [4, 8],    // 4-8秒
    circleRadius: 150,               // 150米半径
    circleHeight: 30,                // 30米高度差
    scoreValue: 50,
    color: 0x44ff44,
    scale: 0.7,
  },

  [EnemyType.FIGHTER]: {
    type: EnemyType.FIGHTER,
    name: '战斗机',
    health: 50,
    speed: 55,              // 比导弹慢30%
    damage: 15,
    detectionRange: 100,
    attackRange: 30,
    attackCooldown: 0.5,
    evasionChance: 0.15,
    accuracy: 0.5,
    turnSpeed: 2.0,         // 中等转向速度
    maxRollAngle: Math.PI / 4,
    wanderRadius: 60,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.325,          // 32.5% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.475,  // 47.5% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.20            // 20% 盘旋
    },
    stateDurationRange: [4, 8],    // 4-8秒
    circleRadius: 120,               // 120米半径
    circleHeight: 40,                // 40米高度差
    scoreValue: 100,
    color: 0xff4444,  // 红色
    scale: 1.0,
  },

  [EnemyType.HEAVY]: {
    type: EnemyType.HEAVY,
    name: '重型轰炸机',
    health: 150,
    speed: 35,              // 慢速但转向慢
    damage: 30,
    detectionRange: 80,
    attackRange: 40,
    attackCooldown: 0.8,
    evasionChance: 0.02,
    accuracy: 0.6,
    turnSpeed: 0.8,         // 转向慢
    maxRollAngle: Math.PI / 10,
    wanderRadius: 40,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.35,          // 35% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.45,  // 45% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.20            // 20% 盘旋
    },
    stateDurationRange: [5, 9],    // 5-9秒（稍长，重型机反应慢）
    circleRadius: 100,               // 100米半径
    circleHeight: 20,                // 20米高度差
    scoreValue: 200,
    color: 0x884400,
    scale: 1.8,
  },

  [EnemyType.SNIPER]: {
    type: EnemyType.SNIPER,
    name: '狙击机',
    health: 40,
    speed: 45,              // 中等速度
    damage: 40,
    detectionRange: 200,
    attackRange: 80,
    attackCooldown: 1.0,
    evasionChance: 0.2,
    accuracy: 0.7,
    turnSpeed: 1.2,         // 中等转向
    maxRollAngle: Math.PI / 8,
    wanderRadius: 100,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.30,          // 30% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.50,  // 50% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.20            // 20% 盘旋
    },
    stateDurationRange: [4, 8],    // 4-8秒
    circleRadius: 180,               // 180米半径（狙击机保持距离）
    circleHeight: 50,                // 50米高度差
    scoreValue: 150,
    color: 0x8800ff,
    scale: 0.9,
  },

  [EnemyType.ACE]: {
    type: EnemyType.ACE,
    name: '王牌飞行员',
    health: 80,
    speed: 70,              // 接近导弹速度
    damage: 25,
    detectionRange: 150,
    attackRange: 35,
    attackCooldown: 0.4,
    evasionChance: 0.4,
    accuracy: 0.6,
    turnSpeed: 2.4,         // 接近导弹的转向速度
    maxRollAngle: Math.PI / 3,
    wanderRadius: 60,
    // 新AI状态概率
    stateProbabilities: {
      [EnemyAIState.CHASE]: 0.40,          // 40% 追逐（减半）
      [EnemyAIState.FIXED_DIRECTION]: 0.45,  // 45% 固定方向（提高）
      [EnemyAIState.CIRCLE]: 0.15            // 15% 盘旋
    },
    stateDurationRange: [3, 7],    // 3-7秒（反应快，状态切换频繁）
    circleRadius: 100,               // 100米半径
    circleHeight: 50,                // 50米高度差
    scoreValue: 500,
    color: 0xffdd00,  // 金色
    scale: 1.2,
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
    if (wave <= 2) {
      types.push(EnemyType.SCOUT);
    } else {
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
  const weights = availableTypes.map(type => {
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
