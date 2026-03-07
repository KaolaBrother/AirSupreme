import { describe, it, expect } from 'vitest';
import { EnemyType, EnemyAIState, ENEMY_CONFIGS, EnemyConfig, getEnemyTypesForWave, getRandomEnemyType } from '@/features/enemy/EnemyTypes';

describe('EnemyTypes', () => {
  describe('ENEMY_CONFIGS', () => {
    it('should have config for all enemy types', () => {
      const types = Object.values(EnemyType);
      for (const type of types) {
        expect(ENEMY_CONFIGS[type]).toBeDefined();
        expect(ENEMY_CONFIGS[type].type).toBe(type);
      }
    });

    it('should have all required properties for each config', () => {
      const requiredProps: (keyof EnemyConfig)[] = [
        'type', 'name', 'health', 'speed', 'damage',
        'detectionRange', 'attackRange', 'attackCooldown',
        'evasionChance', 'accuracy', 'fireSpreadAngle',
        'turnSpeed', 'maxRollAngle', 'wanderRadius',
        'stateProbabilities', 'stateDurationRange',
        'circleRadius', 'circleHeight', 'scoreValue', 'color', 'scale'
      ];

      for (const type of Object.values(EnemyType)) {
        const config = ENEMY_CONFIGS[type];
        for (const prop of requiredProps) {
          expect(config[prop], `Missing ${prop} in ${type}`).toBeDefined();
        }
      }
    });

    it('should have valid fireSpreadAngle (1-90 degrees)', () => {
      for (const type of Object.values(EnemyType)) {
        const config = ENEMY_CONFIGS[type];
        expect(config.fireSpreadAngle).toBeGreaterThan(0);
        expect(config.fireSpreadAngle).toBeLessThanOrEqual(90);
      }
    });

    it('should have valid state probabilities (sum to 1)', () => {
      for (const type of Object.values(EnemyType)) {
        const config = ENEMY_CONFIGS[type];
        const probs = config.stateProbabilities;
        const sum = probs[EnemyAIState.CHASE] + probs[EnemyAIState.FIXED_DIRECTION] + probs[EnemyAIState.CIRCLE];
        expect(sum).toBeCloseTo(1, 1);
      }
    });

    it('should have positive health, speed, damage', () => {
      for (const type of Object.values(EnemyType)) {
        const config = ENEMY_CONFIGS[type];
        expect(config.health).toBeGreaterThan(0);
        expect(config.speed).toBeGreaterThan(0);
        expect(config.damage).toBeGreaterThan(0);
      }
    });

    it('should have accuracy between 0 and 1', () => {
      for (const type of Object.values(EnemyType)) {
        const config = ENEMY_CONFIGS[type];
        expect(config.accuracy).toBeGreaterThanOrEqual(0);
        expect(config.accuracy).toBeLessThanOrEqual(1);
      }
    });

    it('should have evasionChance between 0 and 1', () => {
      for (const type of Object.values(EnemyType)) {
        const config = ENEMY_CONFIGS[type];
        expect(config.evasionChance).toBeGreaterThanOrEqual(0);
        expect(config.evasionChance).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getEnemyTypesForWave', () => {
    it('should return SCOUT for level 1 wave 1', () => {
      const types = getEnemyTypesForWave(1, 1);
      expect(types).toContain(EnemyType.SCOUT);
    });

    it('should return FIGHTER for level 1 wave 2+', () => {
      const types = getEnemyTypesForWave(1, 2);
      expect(types).toContain(EnemyType.FIGHTER);
    });

    it('should return SNIPER for level 2+', () => {
      const types = getEnemyTypesForWave(2, 2);
      expect(types).toContain(EnemyType.SNIPER);
    });

    it('should return HEAVY for level 3+', () => {
      const types = getEnemyTypesForWave(3, 2);
      expect(types).toContain(EnemyType.HEAVY);
    });

    it('should return ACE for level 4+ wave 2+', () => {
      const types = getEnemyTypesForWave(4, 2);
      expect(types).toContain(EnemyType.ACE);
    });
  });

  describe('getRandomEnemyType', () => {
    it('should return one of the available types', () => {
      const availableTypes = [EnemyType.SCOUT, EnemyType.FIGHTER];
      const result = getRandomEnemyType(availableTypes);
      expect(availableTypes).toContain(result);
    });

    it('should return first type when only one available', () => {
      const result = getRandomEnemyType([EnemyType.ACE]);
      expect(result).toBe(EnemyType.ACE);
    });
  });
});
