import { describe, it, expect, beforeEach } from 'vitest';
import {
  UpgradeType,
  PlayerUpgrades,
  UPGRADE_CONFIGS,
  PlayerStats,
} from '@/features/upgrade/UpgradeSystem';

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
    it('HP upgrade should cost 1,2,3,4,5', () => {
      upgrades.addScore(10000);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(1);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(2);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(3);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(4);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(5);
    });

    it('Missile upgrades should cost 1,2,3,4,5', () => {
      upgrades.addScore(10000);
      expect(upgrades.getUpgradeCost(UpgradeType.MISSILE_LOCK_TIME)).toBe(1);
      expect(upgrades.getUpgradeCost(UpgradeType.MISSILE_LOCK_RADIUS)).toBe(1);
      expect(upgrades.getUpgradeCost(UpgradeType.MISSILE_RELOAD_TIME)).toBe(1);
    });
  });

  describe('Upgrade Values', () => {
    it('HP should increase by 40 per level (200 -> 400)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(200);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(240);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(280);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(320);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(360);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      expect(upgrades.getValue(UpgradeType.MAX_HEALTH)).toBe(400);
    });

    it('Speed should increase by 8 per level (45 -> 85)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.SPEED)).toBe(45);
      upgrades.upgrade(UpgradeType.SPEED);
      expect(upgrades.getValue(UpgradeType.SPEED)).toBe(53);
    });

    it('Fire Rate should decrease by 0.04 per level (0.30 -> 0.10)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.FIRE_RATE)).toBeCloseTo(0.3, 2);
      upgrades.upgrade(UpgradeType.FIRE_RATE);
      expect(upgrades.getValue(UpgradeType.FIRE_RATE)).toBeCloseTo(0.26, 2);
    });

    it('Damage should increase by 3.5 per level (12.5 -> 30)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.DAMAGE)).toBe(12.5);
      upgrades.upgrade(UpgradeType.DAMAGE);
      expect(upgrades.getValue(UpgradeType.DAMAGE)).toBe(16);
    });

    it('Missile Reload should decrease by 1.0 per level (7.5 -> 2.5)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.MISSILE_RELOAD_TIME)).toBe(7.5);
      upgrades.upgrade(UpgradeType.MISSILE_RELOAD_TIME);
      expect(upgrades.getValue(UpgradeType.MISSILE_RELOAD_TIME)).toBe(6.5);
    });

    it('Missile Lock should decrease by 0.2 per level (1.5 -> 0.5)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_TIME)).toBe(1.5);
      upgrades.upgrade(UpgradeType.MISSILE_LOCK_TIME);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_TIME)).toBeCloseTo(1.3, 1);
    });

    it('Missile Lock Radius should increase by 0.2 per level (1.0x -> 2.0x)', () => {
      upgrades.addScore(10000);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS)).toBe(1);
      upgrades.upgrade(UpgradeType.MISSILE_LOCK_RADIUS);
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS)).toBeCloseTo(1.2, 2);
      for (let i = 0; i < 4; i++) {
        upgrades.upgrade(UpgradeType.MISSILE_LOCK_RADIUS);
      }
      expect(upgrades.getValue(UpgradeType.MISSILE_LOCK_RADIUS)).toBeCloseTo(2, 2);
    });
  });

  describe('Upgrade Limits', () => {
    it('should not exceed max level 5', () => {
      upgrades.addScore(10000);
      for (let i = 0; i < 10; i++) {
        upgrades.upgrade(UpgradeType.MAX_HEALTH);
      }
      expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(5);
    });

    it('should return Infinity cost when maxed', () => {
      upgrades.addScore(10000);
      for (let i = 0; i < 5; i++) {
        upgrades.upgrade(UpgradeType.MAX_HEALTH);
      }
      expect(upgrades.getUpgradeCost(UpgradeType.MAX_HEALTH)).toBe(Infinity);
    });

    it('canUpgrade should return false when maxed', () => {
      upgrades.addScore(10000);
      for (let i = 0; i < 5; i++) {
        upgrades.upgrade(UpgradeType.MAX_HEALTH);
      }
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
      expect(stats.getMaxHealth()).toBe(240);
    });

    it('should return upgraded missile lock time', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MISSILE_LOCK_TIME);
      expect(stats.getMissileLockTime()).toBeCloseTo(1.3, 1);
    });

    it('should return upgraded missile lock radius multiplier', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MISSILE_LOCK_RADIUS);
      expect(stats.getMissileLockRadiusMultiplier()).toBeCloseTo(1.2, 2);
    });

    it('should return upgraded missile reload time', () => {
      stats.getUpgrades().addScore(10000);
      stats.getUpgrades().upgrade(UpgradeType.MISSILE_RELOAD_TIME);
      expect(stats.getMissileReloadTime()).toBe(6.5);
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
      expect(stats.getMaxHealth()).toBe(240);

      stats.reset();

      expect(stats.getMaxHealth()).toBe(200);
      expect(stats.getUpgrades().getAvailablePoints()).toBe(0);
    });
  });
});

describe('UPGRADE_CONFIGS', () => {
  it('should have 7 upgrade types', () => {
    expect(Object.keys(UPGRADE_CONFIGS).length).toBe(7);
  });

  it('should have maxLevel 5 for all upgrades', () => {
    Object.values(UPGRADE_CONFIGS).forEach((config) => {
      expect(config.maxLevel).toBe(5);
    });
  });

  it('should have costs array of length 5', () => {
    Object.values(UPGRADE_CONFIGS).forEach((config) => {
      expect(config.costs.length).toBe(5);
    });
  });
});
