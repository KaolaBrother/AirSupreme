import { describe, expect, it } from 'vitest';
import { getDifficultyProfile } from '@/core/Difficulty';
import { BOSS_CONFIGS, BossType } from '@/features/boss/BossTypes';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { POWER_UP_CONFIGS, PowerUpType } from '@/features/powerups/PowerUpSystem';
import { UPGRADE_CONFIGS, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { expectBilingual } from './i18nTestUtils';

/**
 * 数据表里面向玩家的名称都是双语对象（英文默认，简体中文可切换）。
 * 单位名见 UnitSystem.test.ts，特殊武器名见 SpecialWeapons.test.ts，关卡名见 TerrainLevels.test.ts。
 */

describe('bilingual data tables', () => {
  it('labels the five difficulty tiers Very Easy → Expert, Chinese labels 1:1 with English', () => {
    const labels = [1, 2, 3, 4, 5].map((level) => getDifficultyProfile(level).label);
    expect(labels.map((label) => label.en)).toEqual([
      'Very Easy',
      'Easy',
      'Normal',
      'Hard',
      'Expert',
    ]);
    // 逐档一一对应：非常简单 = Very Easy、简单 = Easy、普通 = Normal、困难 = Hard、专家 = Expert
    expect(labels.map((label) => label.zh)).toEqual(['非常简单', '简单', '普通', '困难', '专家']);
  });

  it.each(Object.values(BossType))('names the %s boss in both languages', (type) => {
    expectBilingual(BOSS_CONFIGS[type].name, `${type} name`);
  });

  it('gives every boss a distinct English name', () => {
    const names = Object.values(BossType).map((type) => BOSS_CONFIGS[type].name.en);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(Object.values(EnemyType))('names the %s enemy in both languages', (type) => {
    expectBilingual(ENEMY_CONFIGS[type].name, `${type} name`);
  });

  it.each(Object.values(UpgradeType))(
    'names and describes the %s upgrade in both languages',
    (type) => {
      expectBilingual(UPGRADE_CONFIGS[type].name, `${type} name`);
      expectBilingual(UPGRADE_CONFIGS[type].description, `${type} description`);
    }
  );

  it.each(Object.values(PowerUpType))(
    'names and describes the %s power-up in both languages',
    (type) => {
      expectBilingual(POWER_UP_CONFIGS[type].name, `${type} name`);
      expectBilingual(POWER_UP_CONFIGS[type].description, `${type} description`);
    }
  );

  it('describes the Repair Kit by what it does: +1 life and a full repair (both languages)', () => {
    // 效果（GameCoordinator.handlePowerUpEffect）：生命 +1，并把血量回满
    const { en, zh } = POWER_UP_CONFIGS[PowerUpType.HEALTH].description;
    expect(en).toMatch(/extra life|\+\s*1\s*(life|lives)|one more life|additional life/i);
    expect(en).toMatch(/full(y)?\s+repair|repairs?\b.*\bfully|full health|restores? full/i);
    expect(en, 'no stale "restores 30 health"').not.toMatch(/\b30\b/);
    expect(zh).toMatch(/生命\s*[+＋]\s*1|额外.{0,2}(生命|一条命)|多一条命/);
    expect(zh).toMatch(/完全修复|完全恢复|回满|满血/);
    expect(zh).not.toMatch(/30/);
  });
});
