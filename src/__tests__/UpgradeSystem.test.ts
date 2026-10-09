import { describe, it, expect, beforeEach } from 'vitest';
import {
  UpgradeType,
  PlayerUpgrades,
  UPGRADE_CONFIGS,
  PlayerStats,
} from '@/features/upgrade/UpgradeSystem';
import { TOTAL_LEVELS } from '@/features/campaign/CampaignData';

/**
 * api-spec §8：核心升级线扩展到 10 级，满级终值与旧版（a72359b）5 级满级完全一致，
 * 步长随之减半：(终值 - 基础值) / 10。
 */
const CORE_MAX_LEVEL = 10;
const LEGACY_CORE_TRACKS: ReadonlyArray<{ type: UpgradeType; base: number; end: number }> = [
  { type: UpgradeType.MAX_HEALTH, base: 200, end: 400 },
  { type: UpgradeType.DAMAGE, base: 12.5, end: 30 },
  { type: UpgradeType.FIRE_RATE, base: 0.3, end: 0.1 },
  { type: UpgradeType.SPEED, base: 45, end: 85 },
  { type: UpgradeType.MISSILE_LOCK_TIME, base: 1.5, end: 0.5 },
  { type: UpgradeType.MISSILE_LOCK_RADIUS, base: 1, end: 2 },
  { type: UpgradeType.MISSILE_RELOAD_TIME, base: 7.5, end: 2.5 },
];
const WEAPON_TRACKS: readonly UpgradeType[] = [
  UpgradeType.WEAPON_ROCKETS,
  UpgradeType.WEAPON_LASER,
  UpgradeType.WEAPON_SWARM,
  UpgradeType.WEAPON_RAILGUN,
  UpgradeType.WEAPON_EMP,
];
/** 250 个升级点：足够把任意一条升级线从 0 级买满 */
const PLENTY_OF_SCORE = 100_000;

/** 打开全部层级（核心上限 min(10, 关卡 + 1)）后把某条线升到满级 */
function maxOut(upgrades: PlayerUpgrades, type: UpgradeType): void {
  upgrades.setCampaignLevel(TOTAL_LEVELS);
  upgrades.addScore(PLENTY_OF_SCORE);
  for (let i = 0; i < UPGRADE_CONFIGS[type].maxLevel; i++) {
    upgrades.upgrade(type);
  }
}

describe('PlayerUpgrades', () => {
  let upgrades: PlayerUpgrades;

  beforeEach(() => {
    upgrades = new PlayerUpgrades();
  });

  describe('Initial State', () => {
    it('should start with 0 upgrade points', () => {
      expect(upgrades.getAvailablePoints()).toBe(0);
    });

    it('should start with level 0 for all upgrades', () => {
      Object.values(UpgradeType).forEach((type) => {
        expect(upgrades.getLevel(type)).toBe(0);
      });
    });
  });

  describe('Score Calculation', () => {
    it('should award 1 point per 400 score', () => {
      upgrades.addScore(400);
      expect(upgrades.getAvailablePoints()).toBe(1);
    });

    it('should award 2 points for 800 score', () => {
      upgrades.addScore(800);
      expect(upgrades.getAvailablePoints()).toBe(2);
    });

    it('should accumulate partial score across calls', () => {
      upgrades.addScore(200);
      expect(upgrades.getAvailablePoints()).toBe(0);
      upgrades.addScore(200);
      expect(upgrades.getAvailablePoints()).toBe(1);
    });

    it('should calculate points correctly at boundaries', () => {
      upgrades.addScore(399);
      expect(upgrades.getAvailablePoints()).toBe(0);
      upgrades.addScore(1);
      expect(upgrades.getAvailablePoints()).toBe(1);
    });

    it('should return earned points from addScore', () => {
      const earned = upgrades.addScore(800);
      expect(earned).toBe(2);
    });
  });

  describe('Upgrade Costs', () => {
    it('HP upgrade costs follow its 10-tier cost table: start at 1, never fall', () => {
      upgrades.setCampaignLevel(TOTAL_LEVELS);
      upgrades.addScore(PLENTY_OF_SCORE);
      const costs = UPGRADE_CONFIGS[UpgradeType.MAX_HEALTH].costs;
      expect(costs).toHaveLength(CORE_MAX_LEVEL);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(1);

      let previousCost = 0;
      for (let level = 0; level < CORE_MAX_LEVEL; level++) {
        const cost = upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH);
        expect(cost).toBe(costs[level]);
        expect(cost).toBeGreaterThanOrEqual(previousCost);
        previousCost = cost;

        const pointsBefore = upgrades.getAvailablePoints();
        expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
        expect(upgrades.getAvailablePoints()).toBe(pointsBefore - cost);
      }
    });

    it('Missile upgrades should start at cost 1', () => {
      upgrades.addScore(10000);
      expect(upgrades.getUpgradeCost(UpgradeType.MISSILE_LOCK_TIME)).toBe(1);
      expect(upgrades.getUpgradeCost(UpgradeType.MISSILE_LOCK_RADIUS)).toBe(1);
      expect(upgrades.getUpgradeCost(UpgradeType.MISSILE_RELOAD_TIME)).toBe(1);
    });
  });

  describe('Upgrade Values', () => {
    it('HP should increase by 20 per level (200 -> 400 over 10 levels)', () => {
      upgrades.setCampaignLevel(TOTAL_LEVELS);
      upgrades.addScore(PLENTY_OF_SCORE);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(200);
      for (let level = 1; level <= CORE_MAX_LEVEL; level++) {
        upgrades.upgrade(UpgradeType.MAX_HEALTH);
        expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(200 + 20 * level);
      }
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(400);
    });

    it('Speed should increase by 4 per level (45 -> 85)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.SPEED)).toBe(45);
      upgrades.upgrade(UpgradeType.SPEED);
      expect(upgrades.getValue(UpgradeType.SPEED)).toBe(49);
    });

    it('Fire Rate should decrease by 0.02 per level (0.30 -> 0.10)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.FIRE_RATE)).toBeCloseTo(0.3, 2);
      upgrades.upgrade(UpgradeType.FIRE_RATE);
      expect(upgrades.getValue(UpgradeType.FIRE_RATE)).toBeCloseTo(0.28, 2);
    });

    it('Damage should increase by 1.75 per level (12.5 -> 30)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.DAMAGE)).toBe(12.5);
      upgrades.upgrade(UpgradeType.DAMAGE);
      expect(upgrades.getValue(UpgradeType.DAMAGE)).toBe(14.25);
    });

    it('Missile Reload should decrease by 0.5 per level (7.5 -> 2.5)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.MISSILE_RELOAD_TIME)).toBe(7.5);
      upgrades.upgrade(UpgradeType.MISSILE_RELOAD_TIME);
      expect(upgrades.getValue(UpgradeType.MISSILE_RELOAD_TIME)).toBe(7);
    });

    it('Missile Lock should decrease by 0.1 per level (1.5 -> 0.5)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_TIME)).toBe(1.5);
      upgrades.upgrade(UpgradeType.MISSILE_LOCK_TIME);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_TIME)).toBeCloseTo(1.4, 2);
    });

    it('Missile Lock Radius should increase by 0.1 per level (1.0x -> 2.0x)', () => {
      upgrades.setCampaignLevel(TOTAL_LEVELS);
      upgrades.addScore(PLENTY_OF_SCORE);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS)).toBe(1);
      upgrades.upgrade(UpgradeType.MISSILE_LOCK_RADIUS);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS)).toBeCloseTo(1.1, 2);
      for (let i = 0; i < CORE_MAX_LEVEL - 1; i++) {
        upgrades.upgrade(UpgradeType.MISSILE_LOCK_RADIUS);
      }
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS)).toBeCloseTo(2, 2);
    });

    it.each(LEGACY_CORE_TRACKS)(
      '$type reaches the legacy level-5 end value $end at level 10 in equal steps',
      ({ type, base, end }) => {
        const step = (end - base) / CORE_MAX_LEVEL;
        upgrades.setCampaignLevel(TOTAL_LEVELS);
        upgrades.addScore(PLENTY_OF_SCORE);
        expect(upgrades.getValue(type)).toBeCloseTo(base, 6);
        for (let level = 1; level <= CORE_MAX_LEVEL; level++) {
          expect(upgrades.upgrade(type)).toBe(true);
          expect(upgrades.getValue(type)).toBeCloseTo(base + step * level, 6);
        }
        expect(upgrades.getLevel(type)).toBe(CORE_MAX_LEVEL);
        expect(upgrades.getValue(type)).toBeCloseTo(end, 6);
      }
    );
  });

  describe('Upgrade Limits', () => {
    it('should not exceed max level 10', () => {
      upgrades.setCampaignLevel(TOTAL_LEVELS);
      upgrades.addScore(PLENTY_OF_SCORE);
      for (let i = 0; i < 2 * CORE_MAX_LEVEL; i++) {
        upgrades.upgrade(UpgradeType.MAX_HEALTH);
      }
      expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(CORE_MAX_LEVEL);
    });

    it('should return Infinity cost when maxed', () => {
      maxOut(upgrades, UpgradeType.MAX_HEALTH);
      expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(CORE_MAX_LEVEL);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(Infinity);
    });

    it('canUpgrade should return false when maxed', () => {
      maxOut(upgrades, UpgradeType.MAX_HEALTH);
      expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(CORE_MAX_LEVEL);
      expect(upgrades.getAvailablePoints()).toBeGreaterThan(0);
      expect(upgrades.canUpgrade(UpgradeType.MAX_HEALTH)).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset all state on reset()', () => {
      upgrades.addScore(1000);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      upgrades.upgrade(UpgradeType.SPEED);

      upgrades.reset();

      expect(upgrades.getAvailablePoints()).toBe(0);
      expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(0);
      expect(upgrades.getLevel(UpgradeType.SPEED)).toBe(0);
      expect(upgrades.getTotalScore()).toBe(0);
    });
  });
});

describe('PlayerStats', () => {
  let stats: PlayerStats;

  beforeEach(() => {
    stats = new PlayerStats();
  });

  describe('Base Values', () => {
    it('should return base max health', () => {
      expect(stats.getMaxHealth()).toBe(200);
    });

    it('should return base damage', () => {
      expect(stats.getDamage()).toBe(12.5);
    });

    it('should return base fire rate', () => {
      expect(stats.getFireRate()).toBe(0.3);
    });

    it('should return base speed', () => {
      expect(stats.getMaxSpeed()).toBe(45);
    });

    it('should return base missile lock time', () => {
      expect(stats.getMissileLockTime()).toBe(1.5);
    });

    it('should return base missile lock radius multiplier', () => {
      expect(stats.getMissileLockRadiusMultiplier()).toBe(1);
    });

    it('should return base missile reload time', () => {
      expect(stats.getMissileReloadTime()).toBe(7.5);
    });
  });

  describe('Upgraded Values', () => {
    it('should return upgraded max health', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MAX_HEALTH);
      expect(stats.getMaxHealth()).toBe(220);
    });

    it('should return upgraded missile lock time', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MISSILE_LOCK_TIME);
      expect(stats.getMissileLockTime()).toBeCloseTo(1.4, 2);
    });

    it('should return upgraded missile lock radius multiplier', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MISSILE_LOCK_RADIUS);
      expect(stats.getMissileLockRadiusMultiplier()).toBeCloseTo(1.1, 2);
    });

    it('should return upgraded missile reload time', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MISSILE_RELOAD_TIME);
      expect(stats.getMissileReloadTime()).toBe(7);
    });

    it('should return the legacy level-5 values once core tracks reach level 10', () => {
      const upgrades = stats.getUpgrades();
      for (const { type } of LEGACY_CORE_TRACKS) {
        maxOut(upgrades, type);
      }
      expect(stats.getMaxHealth()).toBe(400);
      expect(stats.getDamage()).toBeCloseTo(30, 6);
      expect(stats.getFireRate()).toBeCloseTo(0.1, 6);
      expect(stats.getMaxSpeed()).toBe(85);
      expect(stats.getMissileLockTime()).toBeCloseTo(0.5, 6);
      expect(stats.getMissileLockRadiusMultiplier()).toBeCloseTo(2, 6);
      expect(stats.getMissileReloadTime()).toBeCloseTo(2.5, 6);
    });
  });

  describe('Multipliers', () => {
    it('should apply damage multiplier', () => {
      stats.setDamageMultiplier(2);
      expect(stats.getDamage()).toBe(25);
      stats.resetDamageMultiplier();
      expect(stats.getDamage()).toBe(12.5);
    });

    it('should apply speed multiplier', () => {
      stats.setSpeedMultiplier(1.5);
      expect(stats.getMaxSpeed()).toBe(67.5);
      stats.resetSpeedMultiplier();
      expect(stats.getMaxSpeed()).toBe(45);
    });
  });

  describe('Reset', () => {
    it('should reset upgrades on reset()', () => {
      stats.getUpgrades().addScore(1000);
      stats.getUpgrades().upgrade(UpgradeType.MAX_HEALTH);
      expect(stats.getMaxHealth()).toBe(220);

      stats.reset();

      expect(stats.getMaxHealth()).toBe(200);
      expect(stats.getUpgrades().getAvailablePoints()).toBe(0);
    });
  });
});

describe('UPGRADE_CONFIGS', () => {
  it('should have 14 upgrade types: the 7 core tracks plus armor, flares and 5 weapons', () => {
    expect(Object.keys(UPGRADE_CONFIGS).length).toBe(14);
    expect(Object.keys(UPGRADE_CONFIGS).sort()).toEqual(
      [
        ...LEGACY_CORE_TRACKS.map(({ type }) => type),
        UpgradeType.ARMOR,
        UpgradeType.FLARES,
        ...WEAPON_TRACKS,
      ].sort()
    );
    expect(Object.values(UpgradeType).sort()).toEqual(Object.keys(UPGRADE_CONFIGS).sort());
  });

  it('should have maxLevel 10 for core tracks and 5 for special-weapon tracks', () => {
    for (const { type } of LEGACY_CORE_TRACKS) {
      expect(UPGRADE_CONFIGS[type].maxLevel, type).toBe(CORE_MAX_LEVEL);
    }
    for (const type of WEAPON_TRACKS) {
      expect(UPGRADE_CONFIGS[type].maxLevel, type).toBe(5);
    }
    for (const type of [UpgradeType.ARMOR, UpgradeType.FLARES]) {
      expect(Number.isInteger(UPGRADE_CONFIGS[type].maxLevel), type).toBe(true);
      expect(UPGRADE_CONFIGS[type].maxLevel, type).toBeGreaterThan(0);
    }
  });

  it('should keep the legacy base values on the core tracks', () => {
    for (const { type, base } of LEGACY_CORE_TRACKS) {
      expect(UPGRADE_CONFIGS[type].baseValue, type).toBe(base);
    }
  });

  it('should have a costs array sized to maxLevel for every track', () => {
    Object.values(UPGRADE_CONFIGS).forEach((config) => {
      expect(config.costs.length, config.type).toBe(config.maxLevel);
      config.costs.forEach((cost) => {
        expect(Number.isInteger(cost) && cost > 0, `${config.type} cost ${cost}`).toBe(true);
      });
    });
  });
});
