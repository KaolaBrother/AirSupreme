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
    speed: 25,              // 进一步降低速度: 40 -> 25
    damage: 10,
    detectionRange: 120,
    attackRange: 25,
    attackCooldown: 0.4,    // 增加冷却: 1.5 -> 2.0 -> 0.4（提高攻击频率5倍）
    evasionChance: 0.3,     // 降低闪避: 0.6 -> 0.3
    accuracy: 0.4,          // 降低精度: 0.5 -> 0.4
    turnSpeed: 1.5,         // 降低转向: 3.0 -> 1.5
    maxRollAngle: Math.PI / 4,
    wanderRadius: 80,
    scoreValue: 50,
    color: 0x44ff44,
    scale: 0.7,
  },

  [EnemyType.FIGHTER]: {
    type: EnemyType.FIGHTER,
    name: '战斗机',
    health: 50,
    speed: 20,              // 进一步降低速度: 30 -> 20
    damage: 15,
    detectionRange: 100,
    attackRange: 30,
    attackCooldown: 0.5,    // 增加冷却: 2.0 -> 2.5 -> 0.5（提高攻击频率5倍）
    evasionChance: 0.15,    // 降低闪避: 0.3 -> 0.15
    accuracy: 0.5,          // 降低精度: 0.7 -> 0.5
    turnSpeed: 1.0,         // 降低转向: 2.0 -> 1.0
    maxRollAngle: Math.PI / 4,
    wanderRadius: 60,
    scoreValue: 100,
    color: 0xff4444,  // 红色
    scale: 1.0,
  },

  [EnemyType.HEAVY]: {
    type: EnemyType.HEAVY,
    name: '重型轰炸机',
    health: 150,
    speed: 10,              // 进一步降低速度: 15 -> 10
    damage: 30,
    detectionRange: 80,
    attackRange: 40,
    attackCooldown: 0.8,    // 增加冷却: 3.0 -> 4.0 -> 0.8（提高攻击频率5倍）
    evasionChance: 0.02,    // 降低闪避: 0.05 -> 0.02
    accuracy: 0.6,          // 降低精度: 0.9 -> 0.6
    turnSpeed: 0.4,         // 降低转向: 0.8 -> 0.4
    maxRollAngle: Math.PI / 10,
    wanderRadius: 40,
    scoreValue: 200,
    color: 0x884400,
    scale: 1.8,
  },

  [EnemyType.SNIPER]: {
    type: EnemyType.SNIPER,
    name: '狙击机',
    health: 40,
    speed: 15,              // 进一步降低速度: 20 -> 15
    damage: 40,
    detectionRange: 200,
    attackRange: 80,
    attackCooldown: 1.0,    // 增加冷却: 4.0 -> 5.0 -> 1.0（提高攻击频率5倍）
    evasionChance: 0.2,     // 降低闪避: 0.4 -> 0.2
    accuracy: 0.7,          // 降低精度: 0.95 -> 0.7
    turnSpeed: 0.8,         // 降低转向: 1.5 -> 0.8
    maxRollAngle: Math.PI / 8,
    wanderRadius: 100,
    scoreValue: 150,
    color: 0x8800ff,
    scale: 0.9,
  },

  [EnemyType.ACE]: {
    type: EnemyType.ACE,
    name: '王牌飞行员',
    health: 80,
    speed: 22,              // 进一步降低速度: 35 -> 22
    damage: 25,
    detectionRange: 150,
    attackRange: 35,
    attackCooldown: 0.4,    // 增加冷却: 1.2 -> 2.0 -> 0.4（提高攻击频率5倍）
    evasionChance: 0.4,     // 降低闪避: 0.8 -> 0.4
    accuracy: 0.6,          // 降低精度: 0.85 -> 0.6
    turnSpeed: 2.0,         // 降低转向: 4.0 -> 2.0
    maxRollAngle: Math.PI / 3,
    wanderRadius: 60,
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
