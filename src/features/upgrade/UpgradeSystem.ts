import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';
import { TOTAL_LEVELS, getWeaponUnlockLevel } from '@/features/campaign/CampaignData';

export enum UpgradeType {
  MAX_HEALTH = 'MAX_HEALTH',
  DAMAGE = 'DAMAGE',
  FIRE_RATE = 'FIRE_RATE',
  SPEED = 'SPEED',
  MISSILE_LOCK_TIME = 'MISSILE_LOCK_TIME',
  MISSILE_LOCK_RADIUS = 'MISSILE_LOCK_RADIUS',
  MISSILE_RELOAD_TIME = 'MISSILE_RELOAD_TIME',
  ARMOR = 'ARMOR',
  FLARES = 'FLARES',
  WEAPON_ROCKETS = 'WEAPON_ROCKETS',
  WEAPON_LASER = 'WEAPON_LASER',
  WEAPON_SWARM = 'WEAPON_SWARM',
  WEAPON_RAILGUN = 'WEAPON_RAILGUN',
  WEAPON_EMP = 'WEAPON_EMP',
}

/**
 * 升级线分类（决定随战役推进的上限曲线）：
 * - core：机体与导弹核心属性，每进入新的一关上限 +1
 * - defense：装甲 / 热焰弹，每两关上限 +1
 * - weapon：特殊武器强化，解锁后逐关开放
 */
export type UpgradeCategory = 'core' | 'defense' | 'weapon';

export interface UpgradeConfig {
  type: UpgradeType;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  valuePerLevel: number;
  baseValue: number;
  unit: string;
  category: UpgradeCategory;
  /** 仅特殊武器强化线：对应的武器 */
  weaponId?: SpecialWeaponId;
}

/** 核心属性：10 级，终值与旧版 5 级满级一致（步长减半），花费平缓递增 */
const CORE_COSTS: readonly number[] = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4];
const ARMOR_COSTS: readonly number[] = [2, 2, 3, 3, 4];
const FLARE_COSTS: readonly number[] = [1, 2, 2, 3];
const WEAPON_COSTS: readonly number[] = [1, 2, 2, 3, 3];

/** 核心属性的层级上限：min(10, 关卡 + 1) */
const CORE_TIER_LIMIT = 10;
/** 特殊武器强化的层级上限：min(5, 关卡 - 解锁关卡 + 2) */
const WEAPON_TIER_LIMIT = 5;
/** 武器在当前关卡之前被显式解锁时，至少开放到解锁当关的上限 */
const WEAPON_ENTRY_CAP = 2;
/** 装甲满级减伤（getArmorReduction 的上限） */
const MAX_ARMOR_REDUCTION = 0.4;
const BASE_FLARE_CAPACITY = 2;
const MAX_FLARE_CAPACITY = 6;

/** 跳关开局补偿：之前每一章折算的升级点 */
const STARTING_POINTS_PER_CHAPTER = 6;

function coreConfig(
  type: UpgradeType,
  name: string,
  description: string,
  baseValue: number,
  valuePerLevel: number,
  unit: string
): UpgradeConfig {
  return {
    type,
    name,
    description,
    maxLevel: CORE_COSTS.length,
    costs: [...CORE_COSTS],
    valuePerLevel,
    baseValue,
    unit,
    category: 'core',
  };
}

function weaponConfig(
  type: UpgradeType,
  weaponId: SpecialWeaponId,
  name: string,
  description: string
): UpgradeConfig {
  return {
    type,
    name,
    description,
    maxLevel: WEAPON_COSTS.length,
    costs: [...WEAPON_COSTS],
    valuePerLevel: 1,
    baseValue: 0,
    unit: '',
    category: 'weapon',
    weaponId,
  };
}

export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
  [UpgradeType.MAX_HEALTH]: coreConfig(
    UpgradeType.MAX_HEALTH,
    '最大生命值',
    '增加最大生命值',
    200,
    20,
    ''
  ),
  [UpgradeType.DAMAGE]: coreConfig(
    UpgradeType.DAMAGE,
    '武器伤害',
    '增加子弹伤害',
    12.5,
    1.75,
    ''
  ),
  [UpgradeType.FIRE_RATE]: coreConfig(
    UpgradeType.FIRE_RATE,
    '射速',
    '提高射击速度（降低间隔）',
    0.3,
    -0.02,
    's'
  ),
  [UpgradeType.SPEED]: coreConfig(UpgradeType.SPEED, '飞行速度', '提高最大飞行速度', 45, 4, ''),
  [UpgradeType.MISSILE_LOCK_TIME]: coreConfig(
    UpgradeType.MISSILE_LOCK_TIME,
    '导弹锁定速度',
    '减少导弹锁定所需时间',
    1.5,
    -0.1,
    's'
  ),
  [UpgradeType.MISSILE_LOCK_RADIUS]: coreConfig(
    UpgradeType.MISSILE_LOCK_RADIUS,
    '导弹锁定范围',
    '扩大锁定圈范围，满级达到当前两倍',
    1,
    0.1,
    'x'
  ),
  [UpgradeType.MISSILE_RELOAD_TIME]: coreConfig(
    UpgradeType.MISSILE_RELOAD_TIME,
    '导弹装填速度',
    '减少导弹补给时间',
    7.5,
    -0.5,
    's'
  ),
  [UpgradeType.ARMOR]: {
    type: UpgradeType.ARMOR,
    name: '复合装甲',
    description: '降低受到的伤害，满级减伤 40%',
    maxLevel: ARMOR_COSTS.length,
    costs: [...ARMOR_COSTS],
    // 以百分点存储，便于菜单显示；PlayerStats.getArmorReduction() 换算为 0-1
    valuePerLevel: 8,
    baseValue: 0,
    unit: '%',
    category: 'defense',
  },
  [UpgradeType.FLARES]: {
    type: UpgradeType.FLARES,
    name: '热焰弹挂架',
    description: '增加热焰弹携带数量（2 → 6 发）',
    maxLevel: FLARE_COSTS.length,
    costs: [...FLARE_COSTS],
    valuePerLevel: 1,
    baseValue: BASE_FLARE_CAPACITY,
    unit: '发',
    category: 'defense',
  },
  [UpgradeType.WEAPON_ROCKETS]: weaponConfig(
    UpgradeType.WEAPON_ROCKETS,
    'rockets',
    '集束火箭',
    '强化集束火箭的整体性能'
  ),
  [UpgradeType.WEAPON_LASER]: weaponConfig(
    UpgradeType.WEAPON_LASER,
    'laser',
    '脉冲激光',
    '强化脉冲激光的整体性能'
  ),
  [UpgradeType.WEAPON_SWARM]: weaponConfig(
    UpgradeType.WEAPON_SWARM,
    'swarm',
    '蜂群导弹',
    '强化蜂群导弹的整体性能'
  ),
  [UpgradeType.WEAPON_RAILGUN]: weaponConfig(
    UpgradeType.WEAPON_RAILGUN,
    'railgun',
    '电磁轨道炮',
    '强化电磁轨道炮的整体性能'
  ),
  [UpgradeType.WEAPON_EMP]: weaponConfig(
    UpgradeType.WEAPON_EMP,
    'emp',
    '电磁脉冲',
    '强化电磁脉冲的整体性能'
  ),
};

/** 特殊武器 → 对应强化线 */
export const WEAPON_UPGRADE_TYPES: Record<SpecialWeaponId, UpgradeType> = {
  rockets: UpgradeType.WEAPON_ROCKETS,
  laser: UpgradeType.WEAPON_LASER,
  swarm: UpgradeType.WEAPON_SWARM,
  railgun: UpgradeType.WEAPON_RAILGUN,
  emp: UpgradeType.WEAPON_EMP,
};

const UPGRADE_TYPE_VALUES: readonly UpgradeType[] = Object.values(UpgradeType);

/** 强化线对应的特殊武器；非武器强化线返回 null */
export function getWeaponIdForUpgrade(type: UpgradeType): SpecialWeaponId | null {
  return UPGRADE_CONFIGS[type]?.weaponId ?? null;
}

function isSpecialWeaponId(value: unknown): value is SpecialWeaponId {
  return typeof value === 'string' && (SPECIAL_WEAPON_IDS as readonly string[]).includes(value);
}

function isUpgradeType(value: unknown): value is UpgradeType {
  return typeof value === 'string' && (UPGRADE_TYPE_VALUES as readonly string[]).includes(value);
}

/** 关卡号规范化到 1..TOTAL_LEVELS；非有限值视为第 1 关 */
function normalizeCampaignLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.min(TOTAL_LEVELS, Math.round(level)));
}

function toNonNegativeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, value);
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  return Math.floor(toNonNegativeNumber(value, fallback));
}

/** 消除 0.1 / 0.02 等步长累加的浮点误差 */
function roundValue(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * 某条升级线在指定战役关卡的层级上限（不含显式解锁的修正）。
 * - 核心属性：min(10, 关卡 + 1)
 * - 装甲 / 热焰弹：min(满级, ceil(关卡 / 2) + 1)
 * - 特殊武器：解锁前为 0；之后 min(5, 关卡 - 解锁关卡 + 2)
 */
export function getUpgradeCapForLevel(type: UpgradeType, campaignLevel: number): number {
  const config = UPGRADE_CONFIGS[type];
  if (!config) {
    return 0;
  }
  const level = normalizeCampaignLevel(campaignLevel);

  switch (config.category) {
    case 'core':
      return Math.min(CORE_TIER_LIMIT, level + 1);
    case 'defense':
      return Math.min(config.maxLevel, Math.ceil(level / 2) + 1);
    case 'weapon': {
      const unlockLevel = config.weaponId ? getWeaponUnlockLevel(config.weaponId) : null;
      if (unlockLevel === null || level < unlockLevel) {
        return 0;
      }
      return Math.min(WEAPON_TIER_LIMIT, level - unlockLevel + 2);
    }
    default:
      return 0;
  }
}

/**
 * 从第 1 关以外的关卡直接开局（选关 / Boss 模式）时的补偿升级点：
 * 第 1 关为 0，之前每一章折算 6 点（第 10 关 = 54 点）。
 * 本关的层级上限仍然生效，补偿点不会让机体越级。
 */
export function getStartingUpgradePoints(level: number): number {
  return (normalizeCampaignLevel(level) - 1) * STARTING_POINTS_PER_CHAPTER;
}

export class PlayerUpgrades {
  private upgradeLevels: Map<UpgradeType, number> = new Map();
  private totalScore: number = 0;
  private availablePoints: number = 0;
  /** 已按分数发放过的升级点数量（分数高水位），扣分后再涨分不会重复发放 */
  private scorePointsAwarded: number = 0;
  private campaignLevel: number = 1;
  /** 通过 setUnlockedWeapons 显式解锁的武器；与战役关卡解锁取并集 */
  private unlockedWeapons: Set<SpecialWeaponId> = new Set();

  private static readonly POINTS_THRESHOLD = 400;

  constructor() {
    Object.values(UpgradeType).forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
  }

  /**
   * 累加分数，每 400 分发放 1 个升级点；返回本次新获得的点数。
   * 关卡得分倍率由调用方先行乘入。负分（扣分）只降低总分，不收回已发放的点数。
   */
  public addScore(score: number): number {
    if (!Number.isFinite(score)) {
      return 0;
    }
    this.totalScore = Math.max(0, this.totalScore + score);
    const reached = Math.floor(this.totalScore / PlayerUpgrades.POINTS_THRESHOLD);
    const earnedPoints = Math.max(0, reached - this.scorePointsAwarded);
    this.scorePointsAwarded = Math.max(this.scorePointsAwarded, reached);
    this.availablePoints += earnedPoints;
    return earnedPoints;
  }

  /** 章节奖励等额外升级点（非正数 / 非有限值忽略，小数向下取整） */
  public awardBonusPoints(points: number): void {
    if (!Number.isFinite(points) || points <= 0) {
      return;
    }
    this.availablePoints += Math.floor(points);
  }

  public getLevel(type: UpgradeType): number {
    return this.upgradeLevels.get(type) || 0;
  }

  public getValue(type: UpgradeType): number {
    const config = UPGRADE_CONFIGS[type];
    const level = this.getLevel(type);
    return roundValue(config.baseValue + level * config.valuePerLevel);
  }

  /** 下一级的花费（只看满级，不看本关上限）；已满级返回 Infinity */
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
    if (this.isLocked(type) || currentLevel >= config.maxLevel) {
      return false;
    }
    if (currentLevel >= this.getCap(type)) {
      return false;
    }
    return this.availablePoints >= this.getUpgradeCost(type);
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

  public setCampaignLevel(level: number): void {
    this.campaignLevel = normalizeCampaignLevel(level);
  }

  public getCampaignLevel(): number {
    return this.campaignLevel;
  }

  /** 替换显式解锁列表（非法 id 忽略）；按战役关卡已解锁的武器始终可用 */
  public setUnlockedWeapons(ids: readonly SpecialWeaponId[]): void {
    this.unlockedWeapons = new Set(ids.filter((id) => isSpecialWeaponId(id)));
  }

  /** 当前可强化的特殊武器（显式解锁 ∪ 关卡解锁），按 SPECIAL_WEAPON_IDS 顺序 */
  public getUnlockedWeapons(): SpecialWeaponId[] {
    return SPECIAL_WEAPON_IDS.filter((id) => this.isWeaponUnlocked(id));
  }

  /** 武器强化线在武器解锁前锁定；其他升级线永不锁定 */
  public isLocked(type: UpgradeType): boolean {
    const weaponId = getWeaponIdForUpgrade(type);
    return weaponId !== null && !this.isWeaponUnlocked(weaponId);
  }

  /** 本关可升到的最高等级：min(满级, 层级上限)；锁定时为 0 */
  public getCap(type: UpgradeType): number {
    return this.computeCap(type, this.campaignLevel);
  }

  /**
   * 上限下一次提升发生在第几关；已满级或本战役内不再提升时返回 null。
   * 菜单据此提示“下一关提升上限 / 第 N 关提升上限”。
   */
  public getNextCapRaiseLevel(type: UpgradeType): number | null {
    const config = UPGRADE_CONFIGS[type];
    const currentCap = this.getCap(type);
    if (currentCap >= config.maxLevel) {
      return null;
    }
    for (let level = this.campaignLevel + 1; level <= TOTAL_LEVELS; level++) {
      if (this.computeCap(type, level) > currentCap) {
        return level;
      }
    }
    return null;
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

  /** 新游戏：清空等级、分数、升级点、显式解锁，并回到第 1 关 */
  public reset(): void {
    Object.values(UpgradeType).forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
    this.totalScore = 0;
    this.availablePoints = 0;
    this.scorePointsAwarded = 0;
    this.campaignLevel = 1;
    this.unlockedWeapons.clear();
  }

  public export(): Record<string, unknown> {
    const data: Record<string, unknown> = {
      totalScore: this.totalScore,
      availablePoints: this.availablePoints,
      upgrades: {},
      campaignLevel: this.campaignLevel,
      unlockedWeapons: SPECIAL_WEAPON_IDS.filter((id) => this.unlockedWeapons.has(id)),
      scorePointsAwarded: this.scorePointsAwarded,
    };

    this.upgradeLevels.forEach((level, type) => {
      (data.upgrades as Record<string, number>)[type] = level;
    });

    return data;
  }

  /**
   * 读取 export() 的数据（整体替换当前等级）。
   * 兼容旧格式（只有 7 条升级线、没有 campaignLevel / unlockedWeapons 字段）：
   * 缺失的升级线视为 0 级，缺失的关卡 / 解锁字段保留当前值；未知键与非法值被忽略。
   */
  public import(data: Record<string, unknown>): void {
    const source: Record<string, unknown> =
      data && typeof data === 'object' && !Array.isArray(data) ? data : {};

    this.totalScore = toNonNegativeNumber(source.totalScore, 0);
    this.availablePoints = toNonNegativeInt(source.availablePoints, 0);
    const scoreFloor = Math.floor(this.totalScore / PlayerUpgrades.POINTS_THRESHOLD);
    this.scorePointsAwarded = Math.max(
      scoreFloor,
      toNonNegativeInt(source.scorePointsAwarded, scoreFloor)
    );

    UPGRADE_TYPE_VALUES.forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
    const levels = source.upgrades;
    if (levels && typeof levels === 'object' && !Array.isArray(levels)) {
      Object.entries(levels as Record<string, unknown>).forEach(([type, level]) => {
        if (!isUpgradeType(type)) {
          return;
        }
        const maxLevel = UPGRADE_CONFIGS[type].maxLevel;
        this.upgradeLevels.set(type, Math.min(maxLevel, toNonNegativeInt(level, 0)));
      });
    }

    if (typeof source.campaignLevel === 'number' && Number.isFinite(source.campaignLevel)) {
      this.setCampaignLevel(source.campaignLevel);
    }
    if (Array.isArray(source.unlockedWeapons)) {
      const ids: unknown[] = source.unlockedWeapons;
      this.unlockedWeapons = new Set(ids.filter(isSpecialWeaponId));
    }
  }

  private isWeaponUnlocked(id: SpecialWeaponId): boolean {
    if (this.unlockedWeapons.has(id)) {
      return true;
    }
    const unlockLevel = getWeaponUnlockLevel(id);
    return unlockLevel !== null && this.campaignLevel >= unlockLevel;
  }

  private computeCap(type: UpgradeType, campaignLevel: number): number {
    const config = UPGRADE_CONFIGS[type];
    if (this.isLocked(type)) {
      return 0;
    }
    let tierCap = getUpgradeCapForLevel(type, campaignLevel);
    if (config.category === 'weapon') {
      // 显式提前解锁的武器至少开放到“解锁当关”的上限
      tierCap = Math.max(WEAPON_ENTRY_CAP, tierCap);
    }
    return Math.min(config.maxLevel, tierCap);
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

  public getMissileLockRadiusMultiplier(): number {
    return this.upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS);
  }

  /** 装甲减伤比例 0..0.4：受到的伤害 × (1 - 减伤) */
  public getArmorReduction(): number {
    const percent = this.upgrades.getValue(UpgradeType.ARMOR);
    return Math.max(0, Math.min(MAX_ARMOR_REDUCTION, percent / 100));
  }

  /** 热焰弹携带上限 2..6 */
  public getFlareCapacity(): number {
    const capacity = Math.round(this.upgrades.getValue(UpgradeType.FLARES));
    return Math.max(BASE_FLARE_CAPACITY, Math.min(MAX_FLARE_CAPACITY, capacity));
  }

  /** 特殊武器强化等级 0..5（传给 WeaponSystem.setUpgradeLevel） */
  public getWeaponUpgradeLevel(id: SpecialWeaponId): number {
    const type = WEAPON_UPGRADE_TYPES[id];
    return type ? this.upgrades.getLevel(type) : 0;
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
