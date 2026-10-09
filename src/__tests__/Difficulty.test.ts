import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_LEVEL_CAP,
  getDifficultyProfile,
  getLevelScaling,
  type LevelScaling,
} from '@/core/Difficulty';

/**
 * 难度曲线（终验修复 F4b）：关卡强度曲线的每一项压力倍率从第 1 关到第 10 关都不下降（只钉单调性，
 * 不钉具体数值）；每一关上 Very Easy < Normal < Expert（难度档与关卡曲线叠乘，见 LevelManager）。
 * “压力”：敌机 / 单位血量、伤害、命中、提前量、同时在场数、开火频率（冷却越小压力越大）、Boss 武器频率；
 * 单位伤害 = 敌机伤害倍率 × unitDamageShare；敌机火力 = 伤害 ÷ 冷却。
 */

const LEVELS = Array.from({ length: CAMPAIGN_LEVEL_CAP }, (_, index) => index + 1);
const TIERS = [1, 2, 3, 4, 5] as const;
const VERY_EASY = 1;
const NORMAL = 3;
const EXPERT = 5;

/** 越大压力越大的量 */
const RISING: ReadonlyArray<[string, (scaling: LevelScaling) => number]> = [
  ['enemy health', (s) => s.enemyHealthMultiplier],
  ['enemy damage', (s) => s.enemyDamageMultiplier],
  ['enemy accuracy bonus', (s) => s.enemyAccuracyBonus],
  ['enemy aim lead', (s) => s.enemyAimLead],
  ['concurrent enemies', (s) => s.concurrentEnemyBonus],
  ['unit health', (s) => s.unitHealthMultiplier],
  ['unit damage (enemy damage × unit share)', (s) => s.enemyDamageMultiplier * s.unitDamageShare],
  [
    'enemy firepower (damage ÷ cooldown)',
    (s) => s.enemyDamageMultiplier / s.enemyCooldownMultiplier,
  ],
];

/** 越小压力越大的量 */
const FALLING: ReadonlyArray<[string, (scaling: LevelScaling) => number]> = [
  ['enemy fire cooldown', (s) => s.enemyCooldownMultiplier],
  ['boss weapon cooldown', (s) => s.bossCooldownMultiplier],
];

interface Pressure {
  enemyHealth: number;
  enemyFirepower: number;
  unitDamage: number;
  bossCooldown: number;
}

/** 某难度档在某关的实际敌方强度（难度档 × 关卡曲线） */
function pressure(tier: number, level: number): Pressure {
  const profile = getDifficultyProfile(tier);
  const scaling = getLevelScaling(level);
  const damage = profile.enemyDamageMultiplier * scaling.enemyDamageMultiplier;
  const cooldown = profile.enemyAttackCooldownMultiplier * scaling.enemyCooldownMultiplier;
  return {
    enemyHealth: profile.enemyHealthMultiplier * scaling.enemyHealthMultiplier,
    enemyFirepower: damage / cooldown,
    unitDamage: damage * scaling.unitDamageShare,
    bossCooldown: profile.bossCooldownMultiplier * scaling.bossCooldownMultiplier,
  };
}

describe('level pressure curve, L1 → L10', () => {
  const scalings = LEVELS.map((level) => getLevelScaling(level));

  it.each(RISING)('%s never decreases from one level to the next', (_label, pick) => {
    for (let i = 1; i < scalings.length; i++) {
      expect(pick(scalings[i]), `level ${i + 1} vs ${i}`).toBeGreaterThanOrEqual(
        pick(scalings[i - 1])
      );
    }
  });

  it.each(FALLING)('%s never increases from one level to the next', (_label, pick) => {
    for (let i = 1; i < scalings.length; i++) {
      expect(pick(scalings[i]), `level ${i + 1} vs ${i}`).toBeLessThanOrEqual(
        pick(scalings[i - 1])
      );
    }
  });

  it('ends clearly harder than it starts', () => {
    const first = scalings[0];
    const last = scalings[scalings.length - 1];
    for (const [label, pick] of RISING) {
      if (label === 'concurrent enemies') continue;
      expect(pick(last), label).toBeGreaterThan(pick(first));
    }
    expect(last.concurrentEnemyBonus).toBeGreaterThanOrEqual(first.concurrentEnemyBonus);
    for (const [label, pick] of FALLING) {
      expect(pick(last), label).toBeLessThan(pick(first));
    }
  });
});

describe('difficulty tiers at every level', () => {
  it.each(LEVELS)('level %i: Very Easy < Normal < Expert', (level) => {
    const veryEasy = pressure(VERY_EASY, level);
    const normal = pressure(NORMAL, level);
    const expert = pressure(EXPERT, level);

    expect(veryEasy.enemyFirepower).toBeLessThan(normal.enemyFirepower);
    expect(normal.enemyFirepower).toBeLessThan(expert.enemyFirepower);
    expect(veryEasy.enemyHealth).toBeLessThan(normal.enemyHealth);
    expect(normal.enemyHealth).toBeLessThan(expert.enemyHealth);
    expect(veryEasy.unitDamage).toBeLessThan(normal.unitDamage);
    expect(normal.unitDamage).toBeLessThan(expert.unitDamage);
    // Boss 武器冷却：越长越容易
    expect(veryEasy.bossCooldown).toBeGreaterThan(normal.bossCooldown);
    expect(normal.bossCooldown).toBeGreaterThan(expert.bossCooldown);
  });

  it('orders all five tiers the way their labels read (Very Easy → Expert)', () => {
    for (const level of LEVELS) {
      const tiers = TIERS.map((tier) => pressure(tier, level));
      for (let i = 1; i < tiers.length; i++) {
        const where = `level ${level}, tier ${i + 1} vs ${i}`;
        expect(tiers[i].enemyFirepower, where).toBeGreaterThan(tiers[i - 1].enemyFirepower);
        expect(tiers[i].enemyHealth, where).toBeGreaterThanOrEqual(tiers[i - 1].enemyHealth);
        expect(tiers[i].bossCooldown, where).toBeLessThanOrEqual(tiers[i - 1].bossCooldown);
      }
    }
  });

  it('gives fewer power-ups the harder the tier', () => {
    const drops = TIERS.map((tier) => getDifficultyProfile(tier).powerUpDropMultiplier);
    for (let i = 1; i < drops.length; i++) {
      expect(drops[i]).toBeLessThanOrEqual(drops[i - 1]);
    }
    expect(drops[EXPERT - 1]).toBeLessThan(drops[VERY_EASY - 1]);
  });
});
