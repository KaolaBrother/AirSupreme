import { describe, it, expect } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import {
  EnemyType,
  EnemyAIState,
  ENEMY_CONFIGS,
  getEnemyTypesForWave,
  getRandomEnemyType,
} from '@/features/enemy/EnemyTypes';
import { WINGMAN_CONFIG } from '@/features/enemy/FriendlyAI';

/**
 * 敌机编制表（敌机舰队重做，规格 §3）。只钉规格里写死的规则：八个机型的键、侦察机 60 血
 * （一枚玩家导弹击落）、干扰机无武装、各机型之间“谁更快 / 更灵活 / 更耐打”的关系。
 * 标了“起始值”的血量 / 速度 / 分数不在这里钉具体数字；旧 AI 才用的字段（状态概率、盘旋半径、
 * 开火锥角等）不再要求每个机型都有——还在用它们的只有僚机的固定属性块。
 */

const ALL_TYPES = Object.values(EnemyType);
/** 带机炮 / 高炮 / 长枪的五个机型 */
const GUN_TYPES = [
  EnemyType.SCOUT,
  EnemyType.FIGHTER,
  EnemyType.HEAVY,
  EnemyType.SNIPER,
  EnemyType.ACE,
];

describe('EnemyTypes', () => {
  describe('the roster', () => {
    it('has exactly the eight types: the five existing keys plus Jammer, Striker and Wraith', () => {
      expect([...ALL_TYPES].sort()).toEqual(
        ['ACE', 'FIGHTER', 'HEAVY', 'JAMMER', 'SCOUT', 'SNIPER', 'STRIKER', 'WRAITH'].sort()
      );
      for (const type of ALL_TYPES) {
        // 波次表、Boss 小兵与旧测试都按这些键引用：枚举名与值一致
        expect(EnemyType[type as keyof typeof EnemyType]).toBe(type);
      }
    });

    it('has a config for every type, filed under its own key', () => {
      for (const type of ALL_TYPES) {
        expect(ENEMY_CONFIGS[type], type).toBeDefined();
        expect(ENEMY_CONFIGS[type].type).toBe(type);
      }
      expect(Object.keys(ENEMY_CONFIGS).sort()).toEqual([...ALL_TYPES].sort());
    });

    it.each(ALL_TYPES)('%s: the stats every jet needs are present and sane', (type) => {
      const config = ENEMY_CONFIGS[type];
      expect(config.name.en.trim().length, 'English name').toBeGreaterThan(0);
      expect(config.name.zh.trim().length, 'Chinese name').toBeGreaterThan(0);
      for (const key of ['health', 'speed', 'turnSpeed', 'scoreValue'] as const) {
        expect(Number.isFinite(config[key]), `${key} is finite`).toBe(true);
        expect(config[key], key).toBeGreaterThan(0);
      }
      expect(Number.isFinite(config.damage)).toBe(true);
      expect(config.damage, 'damage is never negative').toBeGreaterThanOrEqual(0);
      expect(config.accuracy).toBeGreaterThanOrEqual(0);
      expect(config.accuracy).toBeLessThanOrEqual(1);
    });

    it('display names are distinct', () => {
      const english = ALL_TYPES.map((type) => ENEMY_CONFIGS[type].name.en);
      const chinese = ALL_TYPES.map((type) => ENEMY_CONFIGS[type].name.zh);
      expect(new Set(english).size).toBe(ALL_TYPES.length);
      expect(new Set(chinese).size).toBe(ALL_TYPES.length);
    });
  });

  describe('what the spec fixes about each type', () => {
    it('SCOUT has exactly 60 health: one player missile (80) kills it at base', () => {
      expect(ENEMY_CONFIGS[EnemyType.SCOUT].health).toBe(60);
      expect(GAME_CONSTANTS.MISSILE.DAMAGE, 'player missile damage stays 80').toBe(80);
      expect(ENEMY_CONFIGS[EnemyType.SCOUT].health).toBeLessThanOrEqual(
        GAME_CONSTANTS.MISSILE.DAMAGE
      );
    });

    it('SCOUT is the most agile: no type turns faster', () => {
      const scout = ENEMY_CONFIGS[EnemyType.SCOUT];
      for (const type of ALL_TYPES) {
        if (type === EnemyType.SCOUT) continue;
        expect(scout.turnSpeed, `turns faster than ${type}`).toBeGreaterThan(
          ENEMY_CONFIGS[type].turnSpeed
        );
      }
    });

    it('HEAVY is the big slow one: most health of all, slowest and least agile of the gun jets', () => {
      const heavy = ENEMY_CONFIGS[EnemyType.HEAVY];
      for (const type of ALL_TYPES) {
        if (type === EnemyType.HEAVY) continue;
        expect(heavy.health, `more health than ${type}`).toBeGreaterThan(
          ENEMY_CONFIGS[type].health
        );
      }
      for (const type of GUN_TYPES) {
        if (type === EnemyType.HEAVY) continue;
        expect(heavy.speed, `slower than ${type}`).toBeLessThan(ENEMY_CONFIGS[type].speed);
        expect(heavy.turnSpeed, `turns slower than ${type}`).toBeLessThan(
          ENEMY_CONFIGS[type].turnSpeed
        );
      }
    });

    it('ACE is the fastest jet and a Fighter with better numbers', () => {
      const ace = ENEMY_CONFIGS[EnemyType.ACE];
      const fighter = ENEMY_CONFIGS[EnemyType.FIGHTER];
      for (const type of ALL_TYPES) {
        if (type === EnemyType.ACE) continue;
        expect(ace.speed, `faster than ${type}`).toBeGreaterThan(ENEMY_CONFIGS[type].speed);
      }
      expect(ace.health).toBeGreaterThan(fighter.health);
      expect(ace.turnSpeed).toBeGreaterThan(fighter.turnSpeed);
      expect(ace.damage).toBeGreaterThan(fighter.damage);
    });

    it('SNIPER hits hardest per round among the gun jets (lance, base 20)', () => {
      const sniper = ENEMY_CONFIGS[EnemyType.SNIPER];
      expect(sniper.damage).toBe(20);
      for (const type of GUN_TYPES) {
        if (type === EnemyType.SNIPER) continue;
        expect(sniper.damage, `more per round than ${type}`).toBeGreaterThan(
          ENEMY_CONFIGS[type].damage
        );
      }
    });

    it('the five gun jets are armed: positive damage per round', () => {
      for (const type of GUN_TYPES) {
        expect(ENEMY_CONFIGS[type].damage, type).toBeGreaterThan(0);
      }
    });

    it('JAMMER is unarmed and slow', () => {
      const jammer = ENEMY_CONFIGS[EnemyType.JAMMER];
      expect(jammer.damage).toBe(0);
      expect(jammer.speed).toBeLessThan(ENEMY_CONFIGS[EnemyType.FIGHTER].speed);
    });
  });

  describe('the wingman stat block (the only user of the old three-state fields)', () => {
    it('has state probabilities that sum to 1 and a sane state duration range', () => {
      const probabilities = WINGMAN_CONFIG.stateProbabilities;
      const sum =
        probabilities[EnemyAIState.CHASE] +
        probabilities[EnemyAIState.FIXED_DIRECTION] +
        probabilities[EnemyAIState.CIRCLE];
      expect(sum).toBeCloseTo(1, 6);
      const [shortest, longest] = WINGMAN_CONFIG.stateDurationRange;
      expect(shortest).toBeGreaterThan(0);
      expect(longest).toBeGreaterThanOrEqual(shortest);
    });

    it('has a valid firing cone, accuracy and cooldown', () => {
      expect(WINGMAN_CONFIG.fireSpreadAngle).toBeGreaterThan(0);
      expect(WINGMAN_CONFIG.fireSpreadAngle).toBeLessThanOrEqual(90);
      expect(WINGMAN_CONFIG.accuracy).toBeGreaterThanOrEqual(0);
      expect(WINGMAN_CONFIG.accuracy).toBeLessThanOrEqual(1);
      expect(WINGMAN_CONFIG.attackCooldown).toBeGreaterThan(0);
      expect(WINGMAN_CONFIG.damage).toBeGreaterThan(0);
    });
  });

  // 波次里出哪些机型：现行的按关卡 / 波次取类型（规格 §4 的固定编成属于后面的里程碑）
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
