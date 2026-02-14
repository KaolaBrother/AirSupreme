import { GAME_CONSTANTS } from '@/config';

/**
 * 升级类型
 */
export enum UpgradeType {
  MAX_HEALTH = 'MAX_HEALTH',
  DAMAGE = 'DAMAGE',
  FIRE_RATE = 'FIRE_RATE',
  SPEED = 'SPEED',
  SHIELD_DURATION = 'SHIELD_DURATION',
}

/**
 * 升级配置
 */
export interface UpgradeConfig {
  type: UpgradeType;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectPerLevel: number;
}

/**
 * 升级配置预设
 */
export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
  [UpgradeType.MAX_HEALTH]: {
    type: UpgradeType.MAX_HEALTH,
    name: '最大生命值',
    description: '增加最大生命值',
    maxLevel: 10,
    baseCost: 100,
    costMultiplier: 1.5,
    effectPerLevel: 20,
  },
  [UpgradeType.DAMAGE]: {
    type: UpgradeType.DAMAGE,
    name: '武器伤害',
    description: '增加子弹伤害',
    maxLevel: 10,
    baseCost: 150,
    costMultiplier: 1.6,
    effectPerLevel: 5,
  },
  [UpgradeType.FIRE_RATE]: {
    type: UpgradeType.FIRE_RATE,
    name: '射速',
    description: '提高射击速度',
    maxLevel: 8,
    baseCost: 200,
    costMultiplier: 1.7,
    effectPerLevel: 0.02,
  },
  [UpgradeType.SPEED]: {
    type: UpgradeType.SPEED,
    name: '飞行速度',
    description: '提高最大飞行速度',
    maxLevel: 8,
    baseCost: 120,
    costMultiplier: 1.5,
    effectPerLevel: 5,
  },
  [UpgradeType.SHIELD_DURATION]: {
    type: UpgradeType.SHIELD_DURATION,
    name: '护盾持续时间',
    description: '增加护盾持续时间',
    maxLevel: 5,
    baseCost: 250,
    costMultiplier: 2.0,
    effectPerLevel: 2,
  },
};

/**
 * 玩家升级数据
 */
export class PlayerUpgrades {
  private upgradeLevels: Map<UpgradeType, number> = new Map();
  private totalScore: number = 0;
  private availablePoints: number = 0;

  constructor() {
    // 初始化所有升级等级为 0
    Object.values(UpgradeType).forEach(type => {
      this.upgradeLevels.set(type, 0);
    });
  }

  /**
   * 添加分数
   */
  public addScore(score: number): void {
    this.totalScore += score;

    // 每 500 分获得 1 升级点
    const newPoints = Math.floor(this.totalScore / 500) - this.availablePoints;
    if (newPoints > 0) {
      this.availablePoints += newPoints;
    }
  }

  /**
   * 获取当前等级
   */
  public getLevel(type: UpgradeType): number {
    return this.upgradeLevels.get(type) || 0;
  }

  /**
   * 升级
   */
  public upgrade(type: UpgradeType): boolean {
    const currentLevel = this.getLevel(type);
    const config = UPGRADE_CONFIGS[type];

    // 检查是否已达最大等级
    if (currentLevel >= config.maxLevel) {
      return false;
    }

    // 计算升级费用
    const cost = this.getUpgradeCost(type);

    // 检查是否有足够的点数
    if (this.availablePoints < cost) {
      return false;
    }

    // 扣除点数并升级
    this.availablePoints -= cost;
    this.upgradeLevels.set(type, currentLevel + 1);

    return true;
  }

  /**
   * 获取升级费用
   */
  public getUpgradeCost(type: UpgradeType): number {
    const currentLevel = this.getLevel(type);
    const config = UPGRADE_CONFIGS[type];

    return Math.floor(config.baseCost * Math.pow(config.costMultiplier, currentLevel));
  }

  /**
   * 获取效果值
   */
  public getEffectValue(type: UpgradeType): number {
    const level = this.getLevel(type);
    const config = UPGRADE_CONFIGS[type];

    return level * config.effectPerLevel;
  }

  /**
   * 获取总分数
   */
  public getTotalScore(): number {
    return this.totalScore;
  }

  /**
   * 获取可用点数
   */
  public getAvailablePoints(): number {
    return this.availablePoints;
  }

  /**
   * 重置升级
   */
  public reset(): void {
    Object.values(UpgradeType).forEach(type => {
      this.upgradeLevels.set(type, 0);
    });
    this.totalScore = 0;
    this.availablePoints = 0;
  }

  /**
   * 导出数据
   */
  public export(): Record<string, any> {
    const data: Record<string, any> = {
      totalScore: this.totalScore,
      availablePoints: this.availablePoints,
      upgrades: {},
    };

    this.upgradeLevels.forEach((level, type) => {
      data.upgrades[type] = level;
    });

    return data;
  }

  /**
   * 导入数据
   */
  public import(data: Record<string, any>): void {
    this.totalScore = data.totalScore || 0;
    this.availablePoints = data.availablePoints || 0;

    if (data.upgrades) {
      Object.entries(data.upgrades).forEach(([type, level]) => {
        this.upgradeLevels.set(type as UpgradeType, level as number);
      });
    }
  }
}

/**
 * 玩家状态（包含升级效果）
 */
export class PlayerStats {
  private upgrades: PlayerUpgrades;
  private baseHealth: number = GAME_CONSTANTS.PLAYER.BASE_HEALTH;  // 使用配置文件（200）
  private baseDamage: number = GAME_CONSTANTS.PLAYER.BASE_DAMAGE;  // 使用配置文件（12.5）
  private baseFireRate: number = GAME_CONSTANTS.PLAYER.BASE_FIRE_RATE;  // 使用配置文件（0.3）
  private baseSpeed: number = GAME_CONSTANTS.PLAYER.MAX_SPEED;  // 使用配置文件（50，不是硬编码的100）
  private baseShieldDuration: number = 10;

  // 道具倍数
  private speedMultiplier: number = 1;           // 速度道具倍数
  private damageMultiplier: number = 1;          // 伤害道具倍数
  private multiShotCount: number = 1;             // 多重射击子弹数量

  constructor() {
    this.upgrades = new PlayerUpgrades();
  }

  /**
   * 获取最大生命值
   */
  public getMaxHealth(): number {
    return this.baseHealth + this.upgrades.getEffectValue(UpgradeType.MAX_HEALTH);
  }

  /**
   * 获取伤害
   */
  public getDamage(multiplier: number = 1): number {
    const baseDamage = this.baseDamage + this.upgrades.getEffectValue(UpgradeType.DAMAGE);
    return baseDamage * multiplier * this.damageMultiplier;
  }

  /**
   * 设置伤害倍数（道具效果）
   */
  public setDamageMultiplier(value: number): void {
    this.damageMultiplier = value;
  }

  /**
   * 重置伤害倍数
   */
  public resetDamageMultiplier(): void {
    this.damageMultiplier = 1;
  }

  /**
   * 获取射击间隔
   */
  public getFireRate(): number {
    const reduction = this.upgrades.getEffectValue(UpgradeType.FIRE_RATE);
    return Math.max(0.05, this.baseFireRate - reduction);
  }

  /**
   * 获取最大速度
   */
  public getMaxSpeed(): number {
    const baseSpeed = this.baseSpeed + this.upgrades.getEffectValue(UpgradeType.SPEED);
    return baseSpeed * this.speedMultiplier;
  }

  /**
   * 设置速度倍数（道具效果）
   */
  public setSpeedMultiplier(value: number): void {
    this.speedMultiplier = value;
  }

  /**
   * 重置速度倍数
   */
  public resetSpeedMultiplier(): void {
    this.speedMultiplier = 1;
  }

  /**
   * 获取护盾持续时间
   */
  public getShieldDuration(): number {
    return this.baseShieldDuration + this.upgrades.getEffectValue(UpgradeType.SHIELD_DURATION);
  }

  /**
   * 获取精度（用于射击扰动）
   */
  public getAccuracy(): number {
    // 基础精度 0.9（可以通过未来升级提升）
    return 0.9;
  }

  /**
   * 获取多重射击子弹数量
   */
  public getMultiShotCount(): number {
    return this.multiShotCount;
  }

  /**
   * 设置多重射击子弹数量（道具效果）
   */
  public setMultiShotCount(value: number): void {
    this.multiShotCount = value;
  }

  /**
   * 重置多重射击
   */
  public resetMultiShot(): void {
    this.multiShotCount = 1;
  }

  /**
   * 获取升级管理器
   */
  public getUpgrades(): PlayerUpgrades {
    return this.upgrades;
  }

  /**
   * 添加分数
   */
  public addScore(score: number): void {
    this.upgrades.addScore(score);
  }

  /**
   * 重置
   */
  public reset(): void {
    this.upgrades.reset();
    // 重置所有道具倍数
    this.speedMultiplier = 1;
    this.damageMultiplier = 1;
    this.multiShotCount = 1;
  }
}
