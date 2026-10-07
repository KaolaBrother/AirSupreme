import { describe, expect, it } from 'vitest';
import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';
import { CAMPAIGN_LEVEL_CAP, getLevelScaling, type LevelScaling } from '@/core/Difficulty';
import { Faction, areHostile } from '@/core/Faction';
import {
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_SPEAKERS,
  GENERIC_RADIO,
  TOTAL_LEVELS,
  UNIT_FIRST_CONTACT_RADIO,
  getCampaignChapter,
  getChapterRadio,
  getUnlockedWeaponsThrough,
  getWeaponUnlockLevel,
  type RadioLine,
} from '@/features/campaign/CampaignData';
import { LEVELS } from '@/features/terrain/LevelConfig';

/** api-spec：解锁节奏 L2 rockets · L4 laser · L6 swarm · L7 railgun · L9 emp */
const UNLOCK_SCHEDULE: ReadonlyArray<[SpecialWeaponId, number]> = [
  ['rockets', 2],
  ['laser', 4],
  ['swarm', 6],
  ['railgun', 7],
  ['emp', 9],
];

const ALL_LEVELS = Array.from({ length: 10 }, (_, index) => index + 1);

function expectedUnlocksThrough(level: number): SpecialWeaponId[] {
  return UNLOCK_SCHEDULE.filter(([, unlockLevel]) => unlockLevel <= level).map(([id]) => id);
}

describe('CampaignData', () => {
  it('spans exactly ten levels, in sync with the difficulty cap', () => {
    expect(TOTAL_LEVELS).toBe(10);
    expect(CAMPAIGN_LEVEL_CAP).toBe(TOTAL_LEVELS);
    expect(CAMPAIGN_CHAPTERS).toHaveLength(TOTAL_LEVELS);
    expect(CAMPAIGN_CHAPTERS.map((chapter) => chapter.level)).toEqual(ALL_LEVELS);
  });

  it.each(ALL_LEVELS)('chapter %i title equals the LEVELS name for the same id', (level) => {
    const levelConfig = LEVELS.find((config) => config.id === level);
    expect(levelConfig, `LEVELS entry ${level}`).toBeDefined();
    expect(getCampaignChapter(level).title).toBe(levelConfig?.name);
  });

  it('gives every chapter a complete story card, objectives and debrief', () => {
    for (const chapter of CAMPAIGN_CHAPTERS) {
      const where = `chapter ${chapter.level}`;
      expect(chapter.chapterLabel, where).not.toBe('');
      expect(chapter.codename, where).not.toBe('');
      expect(chapter.title, where).not.toBe('');
      expect(chapter.intro.length, where).toBeGreaterThan(0);
      expect(chapter.objectives.length, where).toBeGreaterThan(0);
      expect(chapter.boss.name, where).not.toBe('');
      expect(chapter.debriefSummary, where).not.toBe('');
      expect(getChapterRadio(chapter.level, 'level-start').length, where).toBeGreaterThan(0);
      expect(getChapterRadio(chapter.level, 'boss-spawn').length, where).toBeGreaterThan(0);
      expect(getChapterRadio(chapter.level, 'boss-defeated').length, where).toBeGreaterThan(0);
    }
  });

  it('only uses known speakers and in-range wave indexes in radio lines', () => {
    const speakers = new Set(Object.keys(CAMPAIGN_SPEAKERS));
    const allLines: RadioLine[] = [
      ...CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.radio),
      ...Object.values(UNIT_FIRST_CONTACT_RADIO),
      ...Object.values(GENERIC_RADIO),
    ];
    for (const line of allLines) {
      expect(speakers.has(line.speaker), `speaker ${line.speaker}`).toBe(true);
      expect(line.text.length).toBeGreaterThan(0);
    }

    for (const chapter of CAMPAIGN_CHAPTERS) {
      const totalWaves = LEVELS.find((config) => config.id === chapter.level)?.totalWaves ?? 0;
      for (const line of chapter.radio) {
        if (line.trigger === 'wave-start' || line.trigger === 'wave-complete') {
          // 波次序号从 0 开始
          expect(line.index, `chapter ${chapter.level} ${line.trigger}`).toBeGreaterThanOrEqual(0);
          expect(line.index, `chapter ${chapter.level} ${line.trigger}`).toBeLessThan(totalWaves);
        }
        if (line.trigger === 'boss-phase') {
          expect(line.index, `chapter ${chapter.level} boss-phase`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('getChapterRadio returns only lines for the requested trigger and index', () => {
    for (const level of ALL_LEVELS) {
      const bossDefeated = getChapterRadio(level, 'boss-defeated');
      expect(bossDefeated.every((line) => line.trigger === 'boss-defeated')).toBe(true);

      for (const line of getChapterRadio(level, 'wave-start', 2)) {
        expect(line.trigger).toBe('wave-start');
        expect(line.index === undefined || line.index === 2).toBe(true);
      }
    }
  });

  it('getCampaignChapter clamps out-of-range and non-finite levels to 1..10', () => {
    expect(getCampaignChapter(0).level).toBe(1);
    expect(getCampaignChapter(-4).level).toBe(1);
    expect(getCampaignChapter(11).level).toBe(10);
    expect(getCampaignChapter(Number.NaN).level).toBe(1);
  });

  describe('special weapon unlock schedule', () => {
    it.each(UNLOCK_SCHEDULE)('%s unlocks at level %i', (weapon, level) => {
      expect(getWeaponUnlockLevel(weapon)).toBe(level);
      expect(getCampaignChapter(level).unlockedWeapons).toContain(weapon);
    });

    it('unlocks every special weapon exactly once, in HUD order', () => {
      const unlockedInChapters = CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.unlockedWeapons);
      expect(unlockedInChapters).toEqual([...SPECIAL_WEAPON_IDS]);
    });

    it('has an unlock line exactly on the chapters that unlock a weapon', () => {
      for (const chapter of CAMPAIGN_CHAPTERS) {
        if (chapter.unlockedWeapons.length > 0) {
          expect(chapter.unlockLine, `chapter ${chapter.level}`).toEqual(expect.any(String));
          expect(chapter.unlockLine?.length ?? 0).toBeGreaterThan(0);
        } else {
          expect(chapter.unlockLine, `chapter ${chapter.level}`).toBeNull();
        }
      }
    });

    it.each(ALL_LEVELS)('getUnlockedWeaponsThrough(%i) lists every earlier unlock', (level) => {
      expect(getUnlockedWeaponsThrough(level)).toEqual(expectedUnlocksThrough(level));
    });

    it('getUnlockedWeaponsThrough is empty before level 2 and complete from level 9 on', () => {
      expect(getUnlockedWeaponsThrough(0)).toEqual([]);
      expect(getUnlockedWeaponsThrough(1)).toEqual([]);
      expect(getUnlockedWeaponsThrough(9)).toEqual([...SPECIAL_WEAPON_IDS]);
      expect(getUnlockedWeaponsThrough(TOTAL_LEVELS + 5)).toEqual([...SPECIAL_WEAPON_IDS]);
    });

    it('getUnlockedWeaponsThrough returns a fresh array each call', () => {
      const first = getUnlockedWeaponsThrough(TOTAL_LEVELS);
      first.length = 0;
      expect(getUnlockedWeaponsThrough(TOTAL_LEVELS)).toEqual([...SPECIAL_WEAPON_IDS]);
    });
  });
});

describe('getLevelScaling', () => {
  const scalings: LevelScaling[] = ALL_LEVELS.map((level) => getLevelScaling(level));

  it('is the 1.0 baseline at level 1 and reaches full progress at the cap', () => {
    const first = getLevelScaling(1);
    expect(first.level).toBe(1);
    expect(first.progress).toBe(0);
    expect(first.enemyHealthMultiplier).toBe(1);
    expect(first.enemyDamageMultiplier).toBe(1);
    expect(first.enemyCooldownMultiplier).toBe(1);
    expect(first.enemyAccuracyBonus).toBe(0);
    expect(first.unitHealthMultiplier).toBe(1);
    expect(first.bossCooldownMultiplier).toBe(1);
    expect(first.scoreMultiplier).toBe(1);

    const last = getLevelScaling(CAMPAIGN_LEVEL_CAP);
    expect(last.level).toBe(CAMPAIGN_LEVEL_CAP);
    expect(last.progress).toBe(1);
  });

  it('gets monotonically harder (and better paid) level by level', () => {
    for (let i = 1; i < scalings.length; i++) {
      const previous = scalings[i - 1];
      const current = scalings[i];
      const where = `level ${current.level}`;
      expect(current.level, where).toBe(previous.level + 1);
      expect(current.progress, where).toBeGreaterThan(previous.progress);
      expect(current.enemyHealthMultiplier, where).toBeGreaterThanOrEqual(
        previous.enemyHealthMultiplier
      );
      expect(current.enemyDamageMultiplier, where).toBeGreaterThanOrEqual(
        previous.enemyDamageMultiplier
      );
      expect(current.enemyAccuracyBonus, where).toBeGreaterThanOrEqual(previous.enemyAccuracyBonus);
      expect(current.unitHealthMultiplier, where).toBeGreaterThanOrEqual(
        previous.unitHealthMultiplier
      );
      expect(current.scoreMultiplier, where).toBeGreaterThanOrEqual(previous.scoreMultiplier);
      // 冷却倍率 < 1 表示开火更频繁
      expect(current.enemyCooldownMultiplier, where).toBeLessThanOrEqual(
        previous.enemyCooldownMultiplier
      );
      expect(current.bossCooldownMultiplier, where).toBeLessThanOrEqual(
        previous.bossCooldownMultiplier
      );
    }

    const [first, last] = [scalings[0], scalings[scalings.length - 1]];
    expect(last.enemyHealthMultiplier).toBeGreaterThan(first.enemyHealthMultiplier);
    expect(last.enemyDamageMultiplier).toBeGreaterThan(first.enemyDamageMultiplier);
    expect(last.unitHealthMultiplier).toBeGreaterThan(first.unitHealthMultiplier);
    expect(last.scoreMultiplier).toBeGreaterThan(first.scoreMultiplier);
    expect(last.enemyCooldownMultiplier).toBeLessThan(first.enemyCooldownMultiplier);
    expect(last.bossCooldownMultiplier).toBeLessThan(first.bossCooldownMultiplier);
    expect(last.enemyCooldownMultiplier).toBeGreaterThan(0);
    expect(last.bossCooldownMultiplier).toBeGreaterThan(0);
  });

  it('caps at CAMPAIGN_LEVEL_CAP and floors at level 1', () => {
    expect(getLevelScaling(CAMPAIGN_LEVEL_CAP + 1)).toEqual(getLevelScaling(CAMPAIGN_LEVEL_CAP));
    expect(getLevelScaling(99)).toEqual(getLevelScaling(CAMPAIGN_LEVEL_CAP));
    expect(getLevelScaling(0)).toEqual(getLevelScaling(1));
    expect(getLevelScaling(-7)).toEqual(getLevelScaling(1));
  });

  it('stays finite and in range for non-finite input', () => {
    for (const input of [Number.NaN, Infinity, -Infinity]) {
      const scaling = getLevelScaling(input);
      expect(scaling.level).toBeGreaterThanOrEqual(1);
      expect(scaling.level).toBeLessThanOrEqual(CAMPAIGN_LEVEL_CAP);
      for (const value of Object.values(scaling)) {
        expect(Number.isFinite(value), `${String(input)} → ${String(value)}`).toBe(true);
      }
    }
  });
});

describe('Faction.CIVILIAN', () => {
  const ALL_FACTIONS = [Faction.ENEMY, Faction.FRIENDLY, Faction.NEUTRAL, Faction.CIVILIAN];

  it('is a string-valued member like the others', () => {
    expect(Faction.CIVILIAN).toBe('CIVILIAN');
  });

  it.each(ALL_FACTIONS)('is never hostile to or from %s', (other) => {
    expect(areHostile(Faction.CIVILIAN, other)).toBe(false);
    expect(areHostile(other, Faction.CIVILIAN)).toBe(false);
  });

  it('leaves the existing combat relations unchanged', () => {
    expect(areHostile(Faction.ENEMY, Faction.NEUTRAL)).toBe(true);
    expect(areHostile(Faction.ENEMY, Faction.FRIENDLY)).toBe(true);
    expect(areHostile(Faction.FRIENDLY, Faction.NEUTRAL)).toBe(false);
    expect(areHostile(Faction.NEUTRAL, Faction.FRIENDLY)).toBe(false);
  });
});
