import { describe, it, expect } from 'vitest';
import {
  BossType,
  BossCannonPosition,
  BOSS_CONFIGS,
  BOSS_MISSILE_CONFIG,
  FLAK_CANNON_CONFIG,
  getBossForLevel,
  FlakCannonPosition,
} from '@/features/boss/BossTypes';

describe('BossTypes', () => {
  describe('BOSS_CONFIGS', () => {
    it('should have HEAVY_BOMBER configuration', () => {
      expect(BOSS_CONFIGS[BossType.HEAVY_BOMBER]).toBeDefined();
    });

    it('should have DESERT_FORTRESS configuration', () => {
      expect(BOSS_CONFIGS[BossType.DESERT_FORTRESS]).toBeDefined();
    });

    it('should have correct HEAVY_BOMBER stats', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.health).toBe(2000);
      expect(config.speed).toBe(10);
      expect(config.scale).toBe(5);
      expect(config.damage).toBe(15);
    });

    it('should have correct DESERT_FORTRESS stats', () => {
      const config = BOSS_CONFIGS[BossType.DESERT_FORTRESS];
      expect(config.health).toBe(2500);
      expect(config.speed).toBe(0);
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

    it('should have valid circle radius for HEAVY_BOMBER', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.circleRadius).toBeGreaterThan(0);
      expect(config.turnSpeed).toBeGreaterThan(0);
    });

    it('should have zero circle radius for DESERT_FORTRESS (ground unit)', () => {
      const config = BOSS_CONFIGS[BossType.DESERT_FORTRESS];
      expect(config.circleRadius).toBe(0);
      expect(config.turnSpeed).toBe(0);
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

  describe('FLAK_CANNON_CONFIG', () => {
    it('should have correct speed (50% of normal)', () => {
      expect(FLAK_CANNON_CONFIG.SPEED).toBe(50);
    });

    it('should have correct scale (3x)', () => {
      expect(FLAK_CANNON_CONFIG.SCALE).toBe(3);
    });

    it('should have correct max range', () => {
      expect(FLAK_CANNON_CONFIG.MAX_RANGE).toBe(1500);
    });

    it('should have correct AOE radius', () => {
      expect(FLAK_CANNON_CONFIG.AOE_RADIUS).toBe(50);
    });

    it('should have correct damage', () => {
      expect(FLAK_CANNON_CONFIG.DAMAGE).toBe(15);
    });

    it('should have correct explosion height variance', () => {
      expect(FLAK_CANNON_CONFIG.EXPLOSION_HEIGHT_VARIANCE).toBe(20);
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

  describe('FlakCannonPosition', () => {
    it('should have four cannon positions', () => {
      expect(Object.keys(FlakCannonPosition).length).toBe(4);
    });

    it('should have FRONT_LEFT and FRONT_RIGHT positions', () => {
      expect(FlakCannonPosition.FRONT_LEFT).toBe('FRONT_LEFT');
      expect(FlakCannonPosition.FRONT_RIGHT).toBe('FRONT_RIGHT');
    });

    it('should have BACK_LEFT and BACK_RIGHT positions', () => {
      expect(FlakCannonPosition.BACK_LEFT).toBe('BACK_LEFT');
      expect(FlakCannonPosition.BACK_RIGHT).toBe('BACK_RIGHT');
    });
  });

  describe('getBossForLevel', () => {
    it('should return HEAVY_BOMBER for level 1', () => {
      expect(getBossForLevel(1)).toBe(BossType.HEAVY_BOMBER);
    });

    it('should return DESERT_FORTRESS for level 2', () => {
      expect(getBossForLevel(2)).toBe(BossType.DESERT_FORTRESS);
    });

    it('should return OCTOPUS_WARSHIP for level 3', () => {
      expect(getBossForLevel(3)).toBe(BossType.OCTOPUS_WARSHIP);
    });

    it('should return MISSILE_DESTROYER for level 4', () => {
      expect(getBossForLevel(4)).toBe(BossType.MISSILE_DESTROYER);
    });

    it('should return SKY_CARRIER for level 5', () => {
      expect(getBossForLevel(5)).toBe(BossType.SKY_CARRIER);
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

    it('should have DESERT_FORTRESS type', () => {
      expect(BossType.DESERT_FORTRESS).toBe('DESERT_FORTRESS');
    });
  });
});
