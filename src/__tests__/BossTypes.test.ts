import { describe, it, expect } from 'vitest';
import {
  BossType,
  BossCannonPosition,
  BOSS_CONFIGS,
  BOSS_MISSILE_CONFIG,
  getBossForLevel,
} from '@/features/boss/BossTypes';

describe('BossTypes', () => {
  describe('BOSS_CONFIGS', () => {
    it('should have HEAVY_BOMBER configuration', () => {
      expect(BOSS_CONFIGS[BossType.HEAVY_BOMBER]).toBeDefined();
    });

    it('should have correct HEAVY_BOMBER stats', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.health).toBe(2000);
      expect(config.speed).toBe(10);
      expect(config.scale).toBe(5);
      expect(config.damage).toBe(15);
    });

    it('should have correct weapon intervals', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.cannonFireInterval).toBe(0.5);
      expect(config.missileFireInterval).toBe(10);
    });

    it('should have positive score value', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.scoreValue).toBeGreaterThan(0);
    });

    it('should have valid circle radius', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.circleRadius).toBeGreaterThan(0);
      expect(config.turnSpeed).toBeGreaterThan(0);
    });
  });

  describe('BOSS_MISSILE_CONFIG', () => {
    it('should have correct scale (4x player missile)', () => {
      expect(BOSS_MISSILE_CONFIG.SCALE).toBe(4);
    });

    it('should have correct speed multiplier (half speed)', () => {
      expect(BOSS_MISSILE_CONFIG.SPEED_MULTIPLIER).toBe(0.5);
    });

    it('should have correct health (20 HP)', () => {
      expect(BOSS_MISSILE_CONFIG.HEALTH).toBe(20);
    });

    it('should have correct max range', () => {
      expect(BOSS_MISSILE_CONFIG.MAX_RANGE).toBe(5000);
    });

    it('should have correct damage (90 = 3x original)', () => {
      expect(BOSS_MISSILE_CONFIG.DAMAGE).toBe(90);
    });
  });

  describe('BossCannonPosition', () => {
    it('should have four cannon positions', () => {
      expect(Object.keys(BossCannonPosition).length).toBe(4);
    });

    it('should have LEFT_WING and RIGHT_WING positions', () => {
      expect(BossCannonPosition.LEFT_WING).toBe('LEFT_WING');
      expect(BossCannonPosition.RIGHT_WING).toBe('RIGHT_WING');
    });

    it('should have TOP and BOTTOM positions', () => {
      expect(BossCannonPosition.TOP).toBe('TOP');
      expect(BossCannonPosition.BOTTOM).toBe('BOTTOM');
    });
  });

  describe('getBossForLevel', () => {
    it('should return HEAVY_BOMBER for level 1', () => {
      expect(getBossForLevel(1)).toBe(BossType.HEAVY_BOMBER);
    });

    it('should return HEAVY_BOMBER for levels 2-5', () => {
      expect(getBossForLevel(2)).toBe(BossType.HEAVY_BOMBER);
      expect(getBossForLevel(3)).toBe(BossType.HEAVY_BOMBER);
      expect(getBossForLevel(4)).toBe(BossType.HEAVY_BOMBER);
      expect(getBossForLevel(5)).toBe(BossType.HEAVY_BOMBER);
    });

    it('should return null for invalid levels', () => {
      expect(getBossForLevel(0)).toBeNull();
      expect(getBossForLevel(6)).toBeNull();
      expect(getBossForLevel(-1)).toBeNull();
      expect(getBossForLevel(100)).toBeNull();
    });
  });

  describe('BossType enum', () => {
    it('should have HEAVY_BOMBER type', () => {
      expect(BossType.HEAVY_BOMBER).toBe('HEAVY_BOMBER');
    });
  });
});
