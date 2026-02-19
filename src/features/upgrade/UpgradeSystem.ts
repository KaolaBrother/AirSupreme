export enum UpgradeType {
  MAX_HEALTH = 'MAX_HEALTH',
  DAMAGE = 'DAMAGE',
  FIRE_RATE = 'FIRE_RATE',
  SPEED = 'SPEED',
  MISSILE_LOCK_TIME = 'MISSILE_LOCK_TIME',
  MISSILE_RELOAD_TIME = 'MISSILE_RELOAD_TIME',
}

export interface UpgradeConfig {
  type: UpgradeType;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  valuePerLevel: number;
  baseValue: number;
  unit: string;
}

export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
  [UpgradeType.MAX_HEALTH]: {
    type: UpgradeType.MAX_HEALTH,
    name: '最大生命值',
    description: '增加最大生命值',
    maxLevel: 5,
    costs: [1, 2, 3, 4, 5],
    valuePerLevel: 40,
    baseValue: 200,
    unit: '',
  },
  [UpgradeType.DAMAGE]: {
    type: UpgradeType.DAMAGE,
    name: '武器伤害',
    description: '增加子弹伤害',
    maxLevel: 5,
    costs: [1, 2, 3, 4, 5],
    valuePerLevel: 3.5,
    baseValue: 12.5,
    unit: '',
  },
  [UpgradeType.FIRE_RATE]: {
    type: UpgradeType.FIRE_RATE,
    name: '射速',
    description: '提高射击速度（降低间隔）',
    maxLevel: 5,
    costs: [1, 2, 3, 4, 5],
    valuePerLevel: -0.04,
    baseValue: 0.3,
    unit: 's',
  },
  [UpgradeType.SPEED]: {
    type: UpgradeType.SPEED,
    name: '飞行速度',
    description: '提高最大飞行速度',
    maxLevel: 5,
    costs: [1, 2, 3, 4, 5],
    valuePerLevel: 8,
    baseValue: 45,
    unit: '',
  },
  [UpgradeType.MISSILE_LOCK_TIME]: {
    type: UpgradeType.MISSILE_LOCK_TIME,
    name: '导弹锁定速度',
    description: '减少导弹锁定所需时间',
    maxLevel: 5,
    costs: [1, 2, 3, 4, 5],
    valuePerLevel: -0.2,
    baseValue: 1.5,
    unit: 's',
  },
  [UpgradeType.MISSILE_RELOAD_TIME]: {
    type: UpgradeType.MISSILE_RELOAD_TIME,
    name: '导弹装填速度',
    description: '减少导弹补给时间',
    maxLevel: 5,
    costs: [1, 2, 3, 4, 5],
    valuePerLevel: -1.0,
    baseValue: 7.5,
    unit: 's',
  },
};

export class PlayerUpgrades {
  private upgradeLevels: Map<UpgradeType, number> = new Map();
  private totalScore: number = 0;
  private availablePoints: number = 0;

  private static readonly POINTS_THRESHOLD = 400;

  constructor() {
    Object.values(UpgradeType).forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
  }

  public addScore(score: number): number {
    const previousThreshold = Math.floor(this.totalScore / PlayerUpgrades.POINTS_THRESHOLD);
    this.totalScore += score;
    const newThreshold = Math.floor(this.totalScore / PlayerUpgrades.POINTS_THRESHOLD);
    const earnedPoints = newThreshold - previousThreshold;
    this.availablePoints += earnedPoints;
    return earnedPoints;
  }

  public getLevel(type: UpgradeType): number {
    return this.upgradeLevels.get(type) || 0;
  }

  public getValue(type: UpgradeType): number {
    const config = UPGRADE_CONFIGS[type];
    const level = this.getLevel(type);
    return config.baseValue + level * config.valuePerLevel;
  }

  public getUpgradeCost(type: UpgradeType): number {
    const config = UPGRADE_CONFIGS[type];
    const currentLevel = this.getLevel(type);
    if (currentLevel >= config.maxLevel) {
      return Infinity;
    }
    return config.costs[currentLevel];
  }

  public canUpgrade(type: UpgradeType): boolean {
    const config = UPGRADE_CONFIGS[type];
    const currentLevel = this.getLevel(type);
    const cost = this.getUpgradeCost(type);
    return currentLevel < config.maxLevel && this.availablePoints >= cost;
  }

  public upgrade(type: UpgradeType): boolean {
    if (!this.canUpgrade(type)) {
      return false;
    }

    const cost = this.getUpgradeCost(type);
    this.availablePoints -= cost;
    const currentLevel = this.getLevel(type);
    this.upgradeLevels.set(type, currentLevel + 1);

    return true;
  }

  public getTotalScore(): number {
    return this.totalScore;
  }

  public getAvailablePoints(): number {
    return this.availablePoints;
  }

  public getConfig(type: UpgradeType): UpgradeConfig {
    return UPGRADE_CONFIGS[type];
  }

  public reset(): void {
    Object.values(UpgradeType).forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
    this.totalScore = 0;
    this.availablePoints = 0;
  }

  public export(): Record<string, unknown> {
    const data: Record<string, unknown> = {
      totalScore: this.totalScore,
      availablePoints: this.availablePoints,
      upgrades: {},
    };

    this.upgradeLevels.forEach((level, type) => {
      (data.upgrades as Record<string, number>)[type] = level;
    });

    return data;
  }

  public import(data: Record<string, unknown>): void {
    this.totalScore = (data.totalScore as number) || 0;
    this.availablePoints = (data.availablePoints as number) || 0;

    if (data.upgrades && typeof data.upgrades === 'object') {
      Object.entries(data.upgrades as Record<string, unknown>).forEach(([type, level]) => {
        this.upgradeLevels.set(type as UpgradeType, level as number);
      });
    }
  }
}

export class PlayerStats {
  private upgrades: PlayerUpgrades;

  private speedMultiplier: number = 1;
  private damageMultiplier: number = 1;
  private rapidFireMultiplier: number = 1;
  private spreadAngle: number = 0;

  constructor() {
    this.upgrades = new PlayerUpgrades();
  }

  public getMaxHealth(): number {
    return this.upgrades.getValue(UpgradeType.MAX_HEALTH);
  }

  public getDamage(multiplier: number = 1): number {
    const baseDamage = this.upgrades.getValue(UpgradeType.DAMAGE);
    return baseDamage * multiplier * this.damageMultiplier;
  }

  public setDamageMultiplier(value: number): void {
    this.damageMultiplier = value;
  }

  public resetDamageMultiplier(): void {
    this.damageMultiplier = 1;
  }

  public getFireRate(): number {
    const fireRate = this.upgrades.getValue(UpgradeType.FIRE_RATE);
    return Math.max(0.05, fireRate);
  }

  public getMaxSpeed(): number {
    const baseSpeed = this.upgrades.getValue(UpgradeType.SPEED);
    return baseSpeed * this.speedMultiplier;
  }

  public setSpeedMultiplier(value: number): void {
    this.speedMultiplier = value;
  }

  public resetSpeedMultiplier(): void {
    this.speedMultiplier = 1;
  }

  public getMissileLockTime(): number {
    return this.upgrades.getValue(UpgradeType.MISSILE_LOCK_TIME);
  }

  public getMissileReloadTime(): number {
    return this.upgrades.getValue(UpgradeType.MISSILE_RELOAD_TIME);
  }

  public getAccuracy(): number {
    return 0.9;
  }

  public getRapidFireMultiplier(): number {
    return this.rapidFireMultiplier;
  }

  public getSpreadAngle(): number {
    return this.spreadAngle;
  }

  public setRapidFire(multiplier: number, spreadAngle: number): void {
    this.rapidFireMultiplier = multiplier;
    this.spreadAngle = spreadAngle;
  }

  public resetRapidFire(): void {
    this.rapidFireMultiplier = 1;
    this.spreadAngle = 0;
  }

  public getUpgrades(): PlayerUpgrades {
    return this.upgrades;
  }

  public addScore(score: number): number {
    return this.upgrades.addScore(score);
  }

  public reset(): void {
    this.upgrades.reset();
    this.speedMultiplier = 1;
    this.damageMultiplier = 1;
    this.rapidFireMultiplier = 1;
    this.spreadAngle = 0;
  }
}
