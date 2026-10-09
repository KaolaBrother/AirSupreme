import { describe, it, expect } from 'vitest';
import { getDifficultyProfile } from '@/core/Difficulty';
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

    // 生命值按实测击杀时间重新标定（21ad1a0）；只在专门针对单个 Boss 配置的用例里写死数值
    it('should have correct HEAVY_BOMBER stats', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      expect(config.health).toBe(1400);
      expect(config.speed).toBe(10);
      expect(config.scale).toBe(5);
      expect(config.damage).toBe(15);
    });

    it('should have correct DESERT_FORTRESS stats (flak base damage 30, still 15 on Normal)', () => {
      const config = BOSS_CONFIGS[BossType.DESERT_FORTRESS];
      expect(config.health).toBe(2800);
      expect(config.speed).toBe(0);
      expect(config.scale).toBe(5);
      // 配置里是未缩放的基础值；Boss 战开始时按难度档的伤害倍率缩放（“普通”档 ×0.5 = 15）
      expect(config.damage).toBe(30);
      const normal = getDifficultyProfile(3).enemyDamageMultiplier;
      expect(Math.round(config.damage * normal)).toBe(15);
    });

    // 规范 / 集成说明没有规定 Boss 之间的血量顺序（实测标定后并非随关卡递增），因此不固定顺序
    it('gives every boss a positive, finite health', () => {
      for (const type of Object.values(BossType)) {
        const health = BOSS_CONFIGS[type].health;
        expect(Number.isFinite(health), `${type} health ${health}`).toBe(true);
        expect(health, type).toBeGreaterThan(0);
      }
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
    it('should have tuned speed for readable airburst travel', () => {
      expect(FLAK_CANNON_CONFIG.SPEED).toBe(42);
    });

    it('should have correct scale (3x)', () => {
      expect(FLAK_CANNON_CONFIG.SCALE).toBe(3);
    });

    it('should have correct max range', () => {
      expect(FLAK_CANNON_CONFIG.MAX_RANGE).toBe(1500);
    });

    it('should have tuned AOE radius for dodgeable area denial', () => {
      expect(FLAK_CANNON_CONFIG.AOE_RADIUS).toBe(42);
    });

    it('should have correct damage', () => {
      expect(FLAK_CANNON_CONFIG.DAMAGE).toBe(15);
    });

    it('should have correct explosion height variance', () => {
      expect(FLAK_CANNON_CONFIG.EXPLOSION_HEIGHT_VARIANCE).toBe(20);
    });

    it('should include warning and arming parameters', () => {
      expect(FLAK_CANNON_CONFIG.ARMING_TIME).toBe(0.32);
      expect(FLAK_CANNON_CONFIG.WARNING_DISTANCE).toBe(120);
      expect(FLAK_CANNON_CONFIG.DETONATION_DISTANCE).toBe(14);
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

    it('should return MAGMA_COLOSSUS for level 6', () => {
      expect(getBossForLevel(6)).toBe(BossType.MAGMA_COLOSSUS);
    });

    it('should return ABYSSAL_LEVIATHAN for level 7', () => {
      expect(getBossForLevel(7)).toBe(BossType.ABYSSAL_LEVIATHAN);
    });

    it('should return TEMPEST_ZEPPELIN for level 8', () => {
      expect(getBossForLevel(8)).toBe(BossType.TEMPEST_ZEPPELIN);
    });

    it('should return PHANTOM_WING for level 9', () => {
      expect(getBossForLevel(9)).toBe(BossType.PHANTOM_WING);
    });

    it('should return ORACLE_PRIME for level 10', () => {
      expect(getBossForLevel(10)).toBe(BossType.ORACLE_PRIME);
    });

    it('should return null for invalid levels', () => {
      expect(getBossForLevel(0)).toBeNull();
      expect(getBossForLevel(11)).toBeNull();
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
