import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';
import { TOTAL_LEVELS, getWeaponUnlockLevel } from '@/features/campaign/CampaignData';
import { SPECIAL_WEAPON_CONFIGS, isSpecialWeaponId } from '@/features/weapons/WeaponTypes';
import type { LocalizedText } from '@/i18n';

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
 * 升级线分类，决定随战役推进的上限曲线：
 * - core：机体与导弹核心属性，每进入新的一关上限 +1
 * - defense：装甲 / 热焰弹，每两关上限 +1
 * - weapon：特殊武器强化，解锁当关开放 2 级，之后每关 +1
 */
export type UpgradeCategory = 'core' | 'defense' | 'weapon';

export interface UpgradeConfig {
  type: UpgradeType;
  name: LocalizedText;
  description: LocalizedText;
  maxLevel: number;
  costs: number[];
  valuePerLevel: number;
  baseValue: number;
  /** 菜单里数值后的单位（符号单位中英相同） */
  unit: LocalizedText;
  category: UpgradeCategory;
  /** 仅特殊武器强化线：对应的武器 */
  weaponId?: SpecialWeaponId;
}

/**
 * 花费曲线（按“层级”递增）：
 * 第 n 关新开放的层级，单级花费约为该关全清得分折算升级点的 10%-15%，
 * 让每一次购买在难度攀升时依然是有分量的取舍；第 10 关前不足以买满所有可用层级。
 * 核心属性 10 级，终值与旧版 5 级满级一致（步长减半）。
 */
const CORE_COSTS: readonly number[] = [1, 1, 2, 3, 4, 5, 7, 9, 11, 13];
const ARMOR_COSTS: readonly number[] = [2, 3, 5, 7, 9];
const FLARE_COSTS: readonly number[] = [2, 3, 5, 7];
/** 武器越晚解锁、战场收益越高，起步花费随之提高 */
const WEAPON_COSTS: Readonly<Record<SpecialWeaponId, readonly number[]>> = {
  rockets: [2, 4, 6, 8, 10],
  laser: [3, 5, 7, 9, 11],
  swarm: [4, 6, 8, 10, 12],
  railgun: [4, 6, 8, 10, 12],
  emp: [5, 7, 9, 11, 13],
};

const WEAPON_UPGRADE_DESCRIPTIONS: Readonly<Record<SpecialWeaponId, LocalizedText>> = {
  rockets: {
    en: 'More rockets per salvo and heavier warheads; faster reload',
    zh: '增加每轮齐射的火箭数量与弹头伤害，缩短装填',
  },
  laser: {
    en: 'More beam damage and range; slower heat build-up, faster cooling',
    zh: '提高照射伤害与射程，减缓积热、加快散热',
  },
  swarm: {
    en: 'More micro-missiles per volley and more damage; faster reload',
    zh: '增加每轮微型导弹数量与伤害，缩短装填',
  },
  railgun: {
    en: 'More piercing damage and range; faster charge and reload',
    zh: '提高穿甲伤害与射程，缩短蓄力与装填',
  },
  emp: {
    en: 'Longer stun and a wider pulse radius; shorter cooldown',
    zh: '延长瘫痪时间、扩大脉冲半径，缩短冷却',
  },
};

/** 数值单位：符号单位中英相同；热焰弹在中文里带量词「发」，英文只显示数量 */
const UNIT_NONE: LocalizedText = { en: '', zh: '' };
const UNIT_SECONDS: LocalizedText = { en: 's', zh: 's' };
const UNIT_MULTIPLIER: LocalizedText = { en: 'x', zh: 'x' };
const UNIT_PERCENT: LocalizedText = { en: '%', zh: '%' };
const UNIT_FLARES: LocalizedText = { en: '', zh: '发' };

/** 核心属性的层级上限：min(10, 关卡 + 1) */
const CORE_TIER_LIMIT = 10;
/** 特殊武器强化的层级上限：min(5, 关卡 - 解锁关卡 + 2) */
const WEAPON_TIER_LIMIT = 5;
/** 装甲满级减伤（getArmorReduction 的上限） */
const MAX_ARMOR_REDUCTION = 0.4;
const BASE_FLARE_CAPACITY = 2;
const MAX_FLARE_CAPACITY = 6;
/**
 * 跳关开局补偿：按“上一关全部升级线买到上限的总花费”的 75% 发放，
 * 约等于正常推进的玩家进入该关时的升级点存量（他们也没能买满）。
 */
const STARTING_POINTS_SHARE = 0.75;

function coreConfig(
  type: UpgradeType,
  name: LocalizedText,
  description: LocalizedText,
  baseValue: number,
  valuePerLevel: number,
  unit: LocalizedText
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

function weaponConfig(type: UpgradeType, weaponId: SpecialWeaponId): UpgradeConfig {
  return {
    type,
    name: SPECIAL_WEAPON_CONFIGS[weaponId].name,
    description: WEAPON_UPGRADE_DESCRIPTIONS[weaponId],
    maxLevel: WEAPON_COSTS[weaponId].length,
    costs: [...WEAPON_COSTS[weaponId]],
    // 数值即强化等级 0..5，实际性能见 getSpecialWeaponStats
    valuePerLevel: 1,
    baseValue: 0,
    unit: UNIT_NONE,
    category: 'weapon',
    weaponId,
  };
}

export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
  [UpgradeType.MAX_HEALTH]: coreConfig(
    UpgradeType.MAX_HEALTH,
    { en: 'Max Health', zh: '最大生命值' },
    { en: 'Raise your maximum health', zh: '增加最大生命值' },
    200,
    20,
    UNIT_NONE
  ),
  [UpgradeType.DAMAGE]: coreConfig(
    UpgradeType.DAMAGE,
    { en: 'Weapon Damage', zh: '武器伤害' },
    { en: 'Hit harder with every bullet', zh: '增加子弹伤害' },
    12.5,
    1.75,
    UNIT_NONE
  ),
  [UpgradeType.FIRE_RATE]: coreConfig(
    UpgradeType.FIRE_RATE,
    { en: 'Fire Rate', zh: '射速' },
    { en: 'Fire faster (shorter interval)', zh: '提高射击速度（降低间隔）' },
    0.3,
    -0.02,
    UNIT_SECONDS
  ),
  [UpgradeType.SPEED]: coreConfig(
    UpgradeType.SPEED,
    { en: 'Flight Speed', zh: '飞行速度' },
    { en: 'Raise your top speed', zh: '提高最大飞行速度' },
    45,
    4,
    UNIT_NONE
  ),
  [UpgradeType.MISSILE_LOCK_TIME]: coreConfig(
    UpgradeType.MISSILE_LOCK_TIME,
    { en: 'Missile Lock Speed', zh: '导弹锁定速度' },
    { en: 'Lock on with missiles faster', zh: '减少导弹锁定所需时间' },
    1.5,
    -0.1,
    UNIT_SECONDS
  ),
  [UpgradeType.MISSILE_LOCK_RADIUS]: coreConfig(
    UpgradeType.MISSILE_LOCK_RADIUS,
    { en: 'Missile Lock Radius', zh: '导弹锁定范围' },
    {
      en: 'Widen the lock circle, up to double size at max level',
      zh: '扩大锁定圈范围，满级达到当前两倍',
    },
    1,
    0.1,
    UNIT_MULTIPLIER
  ),
  [UpgradeType.MISSILE_RELOAD_TIME]: coreConfig(
    UpgradeType.MISSILE_RELOAD_TIME,
    { en: 'Missile Reload Speed', zh: '导弹装填速度' },
    { en: 'Resupply missiles faster', zh: '减少导弹补给时间' },
    7.5,
    -0.5,
    UNIT_SECONDS
  ),
  [UpgradeType.ARMOR]: {
    type: UpgradeType.ARMOR,
    name: { en: 'Composite Armor', zh: '复合装甲' },
    description: {
      en: 'Take less damage: 40% less at max level',
      zh: '降低受到的伤害，满级减伤 40%',
    },
    maxLevel: ARMOR_COSTS.length,
    costs: [...ARMOR_COSTS],
    // 以百分点存储便于菜单显示；PlayerStats.getArmorReduction() 换算为 0-1
    valuePerLevel: 8,
    baseValue: 0,
    unit: UNIT_PERCENT,
    category: 'defense',
  },
  [UpgradeType.FLARES]: {
    type: UpgradeType.FLARES,
    name: { en: 'Flare Rack', zh: '热焰弹挂架' },
    description: { en: 'Carry more flares (2 → 6)', zh: '增加热焰弹携带数量（2 → 6 发）' },
    maxLevel: FLARE_COSTS.length,
    costs: [...FLARE_COSTS],
    valuePerLevel: 1,
    baseValue: BASE_FLARE_CAPACITY,
    unit: UNIT_FLARES,
    category: 'defense',
  },
  [UpgradeType.WEAPON_ROCKETS]: weaponConfig(UpgradeType.WEAPON_ROCKETS, 'rockets'),
  [UpgradeType.WEAPON_LASER]: weaponConfig(UpgradeType.WEAPON_LASER, 'laser'),
  [UpgradeType.WEAPON_SWARM]: weaponConfig(UpgradeType.WEAPON_SWARM, 'swarm'),
  [UpgradeType.WEAPON_RAILGUN]: weaponConfig(UpgradeType.WEAPON_RAILGUN, 'railgun'),
  [UpgradeType.WEAPON_EMP]: weaponConfig(UpgradeType.WEAPON_EMP, 'emp'),
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

function isUpgradeType(value: unknown): value is UpgradeType {
  return typeof value === 'string' && (UPGRADE_TYPE_VALUES as readonly string[]).includes(value);
}

/** 关卡号规范化到 1..TOTAL_LEVELS；非有限值视为第 1 关 */
function normalizeCampaignLevel(level: number): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
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
 * 某条升级线在指定战役关卡的层级上限（关卡越界时钳制到 1..TOTAL_LEVELS）：
 * - 核心属性：min(10, 关卡 + 1)
 * - 装甲 / 热焰弹：min(满级, ceil(关卡 / 2) + 1)
 * - 特殊武器：解锁关卡之前为 0（锁定）；之后 min(5, 关卡 - 解锁关卡 + 2)
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

/** min(满级, 层级上限)：该关能升到的最高等级 */
function getEffectiveCap(type: UpgradeType, campaignLevel: number): number {
  return Math.min(UPGRADE_CONFIGS[type].maxLevel, getUpgradeCapForLevel(type, campaignLevel));
}

/** 把所有升级线（含截至该关已解锁的武器）买到该关上限的总花费 */
function getCostToReachCaps(campaignLevel: number): number {
  let total = 0;
  for (const type of UPGRADE_TYPE_VALUES) {
    const cap = getEffectiveCap(type, campaignLevel);
    const costs = UPGRADE_CONFIGS[type].costs;
    for (let tier = 0; tier < cap; tier++) {
      total += costs[tier];
    }
  }
  return total;
}

/**
 * 从第 1 关以外的关卡直接开局（选关 / Boss 模式）时补发的升级点：
 * 第 1 关为 0；第 N 关 = 第 N-1 关全部上限总花费 × 75%（向下取整），随关卡单调递增。
 * 本关的层级上限仍然生效，补偿点不会让机体越级。
 */
export function getStartingUpgradePoints(level: number): number {
  const normalized = normalizeCampaignLevel(level);
  if (normalized <= 1) {
    return 0;
  }
  return Math.floor(getCostToReachCaps(normalized - 1) * STARTING_POINTS_SHARE);
}

export class PlayerUpgrades {
  private upgradeLevels: Map<UpgradeType, number> = new Map();
  private totalScore: number = 0;
  private availablePoints: number = 0;
  /** 已按分数发放过的升级点数量（分数高水位），扣分后再涨分不会重复发放 */
  private scorePointsAwarded: number = 0;
  private campaignLevel: number = 1;
  /** 已解锁的特殊武器（与 WeaponSystem.setUnlocked 同步）；未解锁的武器强化线锁定 */
  private unlockedWeapons: Set<SpecialWeaponId> = new Set();

  private static readonly POINTS_THRESHOLD = 400;

  constructor() {
    UPGRADE_TYPE_VALUES.forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
  }

  /**
   * 累加分数，每 400 分发放 1 个升级点；返回本次新获得的点数。
   * 关卡得分倍率由调用方先行乘入。负分（扣分）只降低总分（不低于 0），不收回已发放的点数。
   */
  public addScore(score: number): number {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return 0;
    }
    this.totalScore = Math.max(0, this.totalScore + score);
    const reached = Math.floor(this.totalScore / PlayerUpgrades.POINTS_THRESHOLD);
    const earnedPoints = Math.max(0, reached - this.scorePointsAwarded);
    this.scorePointsAwarded = Math.max(this.scorePointsAwarded, reached);
    this.availablePoints += earnedPoints;
    return earnedPoints;
  }

  /** 章节奖励 / 跳关补偿等额外升级点（非正数、非有限值忽略，小数向下取整） */
  public awardBonusPoints(points: number): void {
    if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0) {
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

  /** 下一级的花费（只看满级，不看本关上限，便于菜单预告）；已满级返回 Infinity */
  public getUpgradeCost(type: UpgradeType): number {
    const config = UPGRADE_CONFIGS[type];
    const currentLevel = this.getLevel(type);
    if (currentLevel >= config.maxLevel) {
      return Infinity;
    }
    return config.costs[currentLevel];
  }

  /** 未锁定、未满级、未达本关上限，且升级点足够 */
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

  /** 当前战役关卡（决定各升级线的层级上限）；钳制到 1..TOTAL_LEVELS */
  public setCampaignLevel(level: number): void {
    this.campaignLevel = normalizeCampaignLevel(level);
  }

  public getCampaignLevel(): number {
    return this.campaignLevel;
  }

  /** 替换已解锁武器列表（非法 id 忽略）；建议传 getUnlockedWeaponsThrough(关卡) */
  public setUnlockedWeapons(ids: readonly SpecialWeaponId[]): void {
    const next = new Set<SpecialWeaponId>();
    if (Array.isArray(ids)) {
      for (const id of ids as readonly unknown[]) {
        if (isSpecialWeaponId(id)) {
          next.add(id);
        }
      }
    }
    this.unlockedWeapons = next;
  }

  /** 已解锁的特殊武器，按 SPECIAL_WEAPON_IDS 顺序 */
  public getUnlockedWeapons(): SpecialWeaponId[] {
    return SPECIAL_WEAPON_IDS.filter((id) => this.unlockedWeapons.has(id));
  }

  /** 武器强化线在对应武器解锁前锁定；其他升级线永不锁定 */
  public isLocked(type: UpgradeType): boolean {
    const weaponId = getWeaponIdForUpgrade(type);
    return weaponId !== null && !this.unlockedWeapons.has(weaponId);
  }

  /** 本关可升到的最高等级：min(满级, 层级上限) */
  public getCap(type: UpgradeType): number {
    return getEffectiveCap(type, this.campaignLevel);
  }

  /**
   * 上限下一次提升发生在第几关；已到满级上限或本战役内不再提升时返回 null。
   * 菜单据此提示“第 N 关提升上限”。
   */
  public getNextCapRaiseLevel(type: UpgradeType): number | null {
    const currentCap = this.getCap(type);
    if (currentCap >= UPGRADE_CONFIGS[type].maxLevel) {
      return null;
    }
    for (let level = this.campaignLevel + 1; level <= TOTAL_LEVELS; level++) {
      if (getEffectiveCap(type, level) > currentCap) {
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

  /** 新游戏：清空等级、分数、升级点、已解锁武器，并回到第 1 关 */
  public reset(): void {
    UPGRADE_TYPE_VALUES.forEach((type) => {
      this.upgradeLevels.set(type, 0);
    });
    this.totalScore = 0;
    this.availablePoints = 0;
    this.scorePointsAwarded = 0;
    this.campaignLevel = 1;
    this.unlockedWeapons = new Set();
  }

  public export(): Record<string, unknown> {
    const upgrades: Record<string, number> = {};
    this.upgradeLevels.forEach((level, type) => {
      upgrades[type] = level;
    });

    return {
      totalScore: this.totalScore,
      availablePoints: this.availablePoints,
      upgrades,
      campaignLevel: this.campaignLevel,
      unlockedWeapons: this.getUnlockedWeapons(),
      scorePointsAwarded: this.scorePointsAwarded,
    };
  }

  /**
   * 读取 export() 的数据（整体替换等级、分数与升级点）。
   * 兼容旧格式（只有 7 条升级线、没有 campaignLevel / unlockedWeapons 字段）：
   * 缺失的升级线视为 0 级，缺失的关卡 / 解锁字段保留当前值；未知键与非法值被忽略，
   * 等级钳制到 0..满级（不受本关上限约束，上限只限制购买）。
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
      this.setUnlockedWeapons(source.unlockedWeapons as SpecialWeaponId[]);
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

  public getMissileLockRadiusMultiplier(): number {
    return this.upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS);
  }

  /** 装甲减伤比例 0..0.4：实际受到的伤害 = 原伤害 × (1 - 减伤) */
  public getArmorReduction(): number {
    const percent = this.upgrades.getValue(UpgradeType.ARMOR);
    return Math.max(0, Math.min(MAX_ARMOR_REDUCTION, percent / 100));
  }

  /** 热焰弹携带上限 2..6（传给 CountermeasureSystem.setCapacity） */
  public getFlareCapacity(): number {
    const capacity = Math.round(this.upgrades.getValue(UpgradeType.FLARES));
    return Math.max(BASE_FLARE_CAPACITY, Math.min(MAX_FLARE_CAPACITY, capacity));
  }

  /** 特殊武器强化等级 0..5（传给 WeaponSystem.setUpgradeLevel） */
  public getWeaponUpgradeLevel(id: SpecialWeaponId): number {
    const type = isSpecialWeaponId(id) ? WEAPON_UPGRADE_TYPES[id] : undefined;
    if (!type) {
      return 0;
    }
    return Math.max(0, Math.min(WEAPON_TIER_LIMIT, this.upgrades.getLevel(type)));
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
