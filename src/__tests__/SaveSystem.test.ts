import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPECIAL_WEAPON_IDS } from '@/core/CombatContracts';
import {
  CAMPAIGN_PROGRESS_KEY,
  CAMPAIGN_SAVE_KEY,
  CAMPAIGN_SAVE_VERSION,
  clearCampaignCheckpoint,
  describeCheckpoint,
  getCampaignProgress,
  hasCampaignCheckpoint,
  loadCampaignCheckpoint,
  markCampaignCompleted,
  recordLevelReached,
  saveCampaignCheckpoint,
  type CampaignSaveData,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
import { CAMPAIGN_CHAPTERS, TOTAL_LEVELS } from '@/features/campaign/CampaignData';
import { PlayerUpgrades, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { setLocale } from '@/i18n';
import { resetLocale } from './i18nTestUtils';

type CheckpointInput = Omit<CampaignSaveData, 'version' | 'savedAt'>;

const CHECKPOINT_KINDS: readonly CheckpointKind[] = ['level-start', 'wave', 'boss'];
const SAVED_AT = 1_700_000_123_000;

function makeCheckpoint(overrides: Partial<CheckpointInput> = {}): CheckpointInput {
  return {
    checkpoint: 'wave',
    level: 6,
    wave: 2,
    difficulty: 4,
    score: 12_340,
    lives: 2,
    missiles: 5,
    upgrades: { totalScore: 12_340, availablePoints: 3, upgrades: { MAX_HEALTH: 4 } },
    weapons: {
      unlocked: ['rockets', 'laser', 'swarm'],
      selected: 'laser',
      ammo: { rockets: 3, swarm: 2 },
    },
    flares: 3,
    cameraMode: 'first-person',
    stats: { kills: 87, civiliansLost: 1, deaths: 2, playTimeSeconds: 1234.5 },
    ...overrides,
  };
}

function makeSave(overrides: Partial<CampaignSaveData> = {}): CampaignSaveData {
  return { version: 1, savedAt: SAVED_AT, ...makeCheckpoint(), ...overrides };
}

/** 直接写入存储（模拟旧版本 / 外来 / 损坏的数据） */
function writeRawSave(value: unknown): void {
  window.localStorage.setItem(
    CAMPAIGN_SAVE_KEY,
    typeof value === 'string' ? value : JSON.stringify(value)
  );
}

function loadOrFail(): CampaignSaveData {
  const save = loadCampaignCheckpoint();
  expect(save, 'expected a valid checkpoint').not.toBeNull();
  return save as CampaignSaveData;
}

type StorageMethod = 'getItem' | 'setItem' | 'removeItem';

/** Map 实现的 Storage 替身，可让指定方法抛错（隐私模式 / 配额已满） */
class FakeStorage {
  readonly data = new Map<string, string>();
  readonly failing = new Set<StorageMethod>();

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    this.guard('getItem');
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.guard('setItem');
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.guard('removeItem');
    this.data.delete(key);
  }

  private guard(method: StorageMethod): void {
    if (this.failing.has(method)) {
      throw new Error(`${method} denied`);
    }
  }
}

const ORIGINAL_STORAGE = Object.getOwnPropertyDescriptor(window, 'localStorage');

function installStorage(getter: () => unknown): void {
  Object.defineProperty(window, 'localStorage', { configurable: true, get: getter });
}

function restoreStorage(): void {
  if (ORIGINAL_STORAGE) {
    Object.defineProperty(window, 'localStorage', ORIGINAL_STORAGE);
  }
}

/** 每个公开函数都不得抛出 */
function exerciseEverything(): void {
  expect(() => saveCampaignCheckpoint(makeCheckpoint())).not.toThrow();
  expect(() => loadCampaignCheckpoint()).not.toThrow();
  expect(() => hasCampaignCheckpoint()).not.toThrow();
  expect(() => clearCampaignCheckpoint()).not.toThrow();
  expect(() => getCampaignProgress()).not.toThrow();
  expect(() => recordLevelReached(5)).not.toThrow();
  expect(() => markCampaignCompleted(1000)).not.toThrow();
  expect(() => describeCheckpoint(makeSave())).not.toThrow();
}

describe('SaveSystem', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    restoreStorage();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the documented storage keys and version', () => {
    expect(CAMPAIGN_SAVE_KEY).toBe('air-supreme:campaign-save');
    expect(CAMPAIGN_PROGRESS_KEY).toBe('air-supreme:campaign-progress');
    expect(CAMPAIGN_SAVE_VERSION).toBe(1);
  });

  describe('checkpoint round trip', () => {
    it('save → load returns the same checkpoint stamped with version and savedAt', () => {
      vi.spyOn(Date, 'now').mockReturnValue(SAVED_AT);
      const input = makeCheckpoint();

      expect(saveCampaignCheckpoint(input)).toBe(true);

      const raw = JSON.parse(window.localStorage.getItem(CAMPAIGN_SAVE_KEY) ?? 'null') as {
        version?: unknown;
      } | null;
      expect(raw?.version).toBe(CAMPAIGN_SAVE_VERSION);
      expect(loadCampaignCheckpoint()).toEqual({ version: 1, savedAt: SAVED_AT, ...input });
    });

    it.each(CHECKPOINT_KINDS)('keeps the %s checkpoint kind', (kind) => {
      expect(saveCampaignCheckpoint(makeCheckpoint({ checkpoint: kind, wave: 0 }))).toBe(true);
      expect(loadOrFail().checkpoint).toBe(kind);
    });

    it('hasCampaignCheckpoint follows save and clear', () => {
      expect(hasCampaignCheckpoint()).toBe(false);
      saveCampaignCheckpoint(makeCheckpoint());
      expect(hasCampaignCheckpoint()).toBe(true);

      clearCampaignCheckpoint();
      expect(hasCampaignCheckpoint()).toBe(false);
      expect(loadCampaignCheckpoint()).toBeNull();
      expect(window.localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();
    });

    it('a new save replaces the previous checkpoint', () => {
      saveCampaignCheckpoint(makeCheckpoint({ level: 3, wave: 1 }));
      saveCampaignCheckpoint(makeCheckpoint({ level: 4, wave: 5, checkpoint: 'boss' }));

      const save = loadOrFail();
      expect(save.level).toBe(4);
      expect(save.wave).toBe(5);
      expect(save.checkpoint).toBe('boss');
    });

    it('carries PlayerUpgrades.export() through intact for import()', () => {
      const upgrades = new PlayerUpgrades();
      upgrades.setCampaignLevel(6);
      upgrades.setUnlockedWeapons(['rockets', 'laser', 'swarm']);
      upgrades.addScore(8000);
      upgrades.upgrade(UpgradeType.MAX_HEALTH);
      upgrades.upgrade(UpgradeType.WEAPON_ROCKETS);

      saveCampaignCheckpoint(makeCheckpoint({ upgrades: upgrades.export() }));
      const restored = new PlayerUpgrades();
      restored.import(loadOrFail().upgrades);

      expect(restored.export()).toEqual(upgrades.export());
      expect(restored.getLevel(UpgradeType.MAX_HEALTH)).toBe(1);
      expect(restored.getLevel(UpgradeType.WEAPON_ROCKETS)).toBe(1);
      expect(restored.getCampaignLevel()).toBe(6);
      expect(restored.getAvailablePoints()).toBe(upgrades.getAvailablePoints());
    });
  });

  describe('normalisation on load', () => {
    it('clamps the level into 1..TOTAL_LEVELS', () => {
      writeRawSave(makeSave({ level: 42 }));
      expect(loadOrFail().level).toBe(TOTAL_LEVELS);

      writeRawSave(makeSave({ level: 0 }));
      expect(loadOrFail().level).toBe(1);

      writeRawSave(makeSave({ level: 6.4 }));
      const level = loadOrFail().level;
      expect(Number.isInteger(level)).toBe(true);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(TOTAL_LEVELS);
    });

    it('clamps counters into their valid ranges', () => {
      writeRawSave(
        makeSave({
          wave: -3,
          difficulty: 99,
          score: -500,
          lives: 0,
          missiles: -2,
          flares: -1,
          stats: { kills: -4, civiliansLost: -1, deaths: -2, playTimeSeconds: -30 },
        })
      );
      const save = loadOrFail();
      expect(save.wave).toBe(0);
      expect(save.difficulty).toBe(5);
      expect(save.score).toBe(0);
      expect(save.lives).toBeGreaterThanOrEqual(1);
      expect(save.missiles).toBe(0);
      expect(save.flares).toBe(0);
      expect(save.stats).toEqual({ kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 });

      writeRawSave(makeSave({ difficulty: -2 }));
      expect(loadOrFail().difficulty).toBe(1);
    });

    it('fills missing optional fields with safe defaults', () => {
      writeRawSave({ version: 1, level: 3 });
      const save = loadOrFail();

      expect(save.version).toBe(1);
      expect(save.level).toBe(3);
      expect(CHECKPOINT_KINDS).toContain(save.checkpoint);
      expect(save.wave).toBe(0);
      expect(save.cameraMode).toBe('third-person');
      expect(save.upgrades).toEqual({});
      expect(save.weapons).toEqual({ unlocked: [], selected: null, ammo: {} });
      expect(save.stats).toEqual({ kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 });
      expect(save.difficulty).toBeGreaterThanOrEqual(1);
      expect(save.difficulty).toBeLessThanOrEqual(5);
      expect(save.lives).toBeGreaterThanOrEqual(1);
      for (const value of [save.savedAt, save.score, save.missiles, save.flares]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    it('normalises an unknown camera mode to third-person and a bad kind to a valid one', () => {
      writeRawSave({ ...makeSave(), cameraMode: 'cinematic', checkpoint: 'halfway' });
      const save = loadOrFail();
      expect(save.cameraMode).toBe('third-person');
      expect(CHECKPOINT_KINDS).toContain(save.checkpoint);
    });

    it('sanitises the weapons block', () => {
      writeRawSave({
        ...makeSave(),
        weapons: {
          unlocked: ['rockets', 'plasma', 'rockets', 'emp', 42],
          selected: 'laser',
          ammo: { rockets: 2, emp: -3, laser: 4, swarm: 'many', plasma: 9 },
        },
      });
      const { weapons } = loadOrFail();

      expect(weapons.unlocked).toEqual(['rockets', 'emp']);
      // 选中的武器必须已解锁
      expect(weapons.selected).toBeNull();
      expect(weapons.ammo.rockets).toBe(2);
      for (const [id, count] of Object.entries(weapons.ammo)) {
        expect(weapons.unlocked as string[], `ammo for ${id}`).toContain(id);
        expect(Number.isFinite(count) && (count ?? -1) >= 0, `ammo ${id}=${count}`).toBe(true);
      }
    });

    it('keeps a selected weapon that is unlocked, and every valid id', () => {
      writeRawSave({
        ...makeSave(),
        weapons: { unlocked: [...SPECIAL_WEAPON_IDS], selected: 'emp', ammo: {} },
      });
      const { weapons } = loadOrFail();
      expect(weapons.unlocked).toEqual([...SPECIAL_WEAPON_IDS]);
      expect(weapons.selected).toBe('emp');
    });

    it('refuses to save a checkpoint without a numeric level', () => {
      const bad = { ...makeCheckpoint(), level: 'six' } as unknown as CheckpointInput;
      expect(saveCampaignCheckpoint(bad)).toBe(false);
      expect(hasCampaignCheckpoint()).toBe(false);
    });
  });

  describe('corrupt or foreign data → null and the key is removed', () => {
    const withoutField = (field: keyof CampaignSaveData): Record<string, unknown> => {
      const record: Record<string, unknown> = { ...makeSave() };
      delete record[field];
      return record;
    };
    const cases: Array<[string, unknown]> = [
      ['corrupt JSON', '{not-json'],
      ['a JSON array', '[1, 2, 3]'],
      ['a JSON string', '"checkpoint"'],
      ['JSON null', 'null'],
      ['version 2', { ...makeSave(), version: 2 }],
      ['a string version', { ...makeSave(), version: '1' }],
      ['no version', withoutField('version')],
      ['no level', withoutField('level')],
      ['a string level', { ...makeSave(), level: 'six' }],
      ['a null level', { ...makeSave(), level: null }],
    ];

    it.each(cases)('%s', (_label, stored) => {
      writeRawSave(stored);

      expect(loadCampaignCheckpoint()).toBeNull();
      expect(window.localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();
      expect(hasCampaignCheckpoint()).toBe(false);
    });
  });

  describe('storage failures never throw', () => {
    it('works without localStorage at all', () => {
      installStorage(() => undefined);

      exerciseEverything();
      expect(saveCampaignCheckpoint(makeCheckpoint())).toBe(false);
      expect(loadCampaignCheckpoint()).toBeNull();
      expect(hasCampaignCheckpoint()).toBe(false);
      expect(getCampaignProgress()).toEqual({ completed: false, bestScore: 0, highestLevel: 1 });
    });

    it('works when reading localStorage itself throws', () => {
      installStorage(() => {
        throw new Error('SecurityError');
      });

      exerciseEverything();
      expect(saveCampaignCheckpoint(makeCheckpoint())).toBe(false);
      expect(loadCampaignCheckpoint()).toBeNull();
      expect(getCampaignProgress()).toEqual({ completed: false, bestScore: 0, highestLevel: 1 });
    });

    it('reports a failed write (quota) as false', () => {
      const storage = new FakeStorage();
      storage.failing.add('setItem');
      installStorage(() => storage);

      exerciseEverything();
      expect(saveCampaignCheckpoint(makeCheckpoint())).toBe(false);
      expect(storage.data.size).toBe(0);
    });

    it('returns null / defaults when getItem throws', () => {
      const storage = new FakeStorage();
      storage.data.set(CAMPAIGN_SAVE_KEY, JSON.stringify(makeSave()));
      storage.failing.add('getItem');
      installStorage(() => storage);

      exerciseEverything();
      expect(loadCampaignCheckpoint()).toBeNull();
      expect(hasCampaignCheckpoint()).toBe(false);
      expect(getCampaignProgress()).toEqual({ completed: false, bestScore: 0, highestLevel: 1 });
    });

    it('still returns null when a corrupt save cannot be removed', () => {
      const storage = new FakeStorage();
      storage.data.set(CAMPAIGN_SAVE_KEY, '{not-json');
      storage.failing.add('removeItem');
      installStorage(() => storage);

      expect(loadCampaignCheckpoint()).toBeNull();
      expect(() => clearCampaignCheckpoint()).not.toThrow();
      exerciseEverything();
    });

    it('round-trips through a working fake storage too', () => {
      const storage = new FakeStorage();
      installStorage(() => storage);

      expect(saveCampaignCheckpoint(makeCheckpoint())).toBe(true);
      expect(storage.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);
      expect(loadOrFail().level).toBe(6);
    });
  });

  describe('describeCheckpoint', () => {
    afterEach(() => {
      resetLocale();
    });

    it('shows chapter, title and the 1-based number of the next wave (English by default)', () => {
      expect(describeCheckpoint(makeSave({ checkpoint: 'wave', level: 6, wave: 2 }))).toBe(
        'Ch. 6 · Heart of the Forge · Wave 3'
      );
      setLocale('zh-CN');
      expect(describeCheckpoint(makeSave({ checkpoint: 'wave', level: 6, wave: 2 }))).toBe(
        '第6关 · 熔炉之心 · 第3波'
      );
    });

    it('shows wave 1 for a level-start checkpoint', () => {
      const save = makeSave({ checkpoint: 'level-start', level: 1, wave: 0 });
      expect(describeCheckpoint(save)).toBe('Ch. 1 · Dawn at the Lake · Wave 1');
      setLocale('zh-CN');
      expect(describeCheckpoint(save)).toBe('第1关 · 湖畔晨曦 · 第1波');
    });

    it('labels a boss checkpoint as the boss fight instead of a wave', () => {
      const save = makeSave({ checkpoint: 'boss', level: 6, wave: 7 });
      expect(describeCheckpoint(save)).toBe('Ch. 6 · Heart of the Forge · Boss');
      setLocale('zh-CN');
      expect(describeCheckpoint(save)).toBe('第6关 · 熔炉之心 · Boss 战');
    });

    it.each(CAMPAIGN_CHAPTERS.map((chapter) => [chapter.level, chapter.title.en] as const))(
      'uses the chapter title for level %i (%s) in both languages',
      (level) => {
        const save = makeSave({ level, wave: 0, checkpoint: 'level-start' });
        const title = CAMPAIGN_CHAPTERS[level - 1].title;
        expect(describeCheckpoint(save)).toBe(`Ch. ${level} · ${title.en} · Wave 1`);
        setLocale('zh-CN');
        expect(describeCheckpoint(save)).toBe(`第${level}关 · ${title.zh} · 第1波`);
      }
    );
  });

  describe('campaign progress', () => {
    const DEFAULT_PROGRESS = { completed: false, bestScore: 0, highestLevel: 1 };

    it('defaults to not completed, no best score and level 1', () => {
      expect(getCampaignProgress()).toEqual(DEFAULT_PROGRESS);
    });

    it('recordLevelReached only ever raises the highest level, clamped to the campaign', () => {
      recordLevelReached(4);
      expect(getCampaignProgress().highestLevel).toBe(4);

      recordLevelReached(2);
      expect(getCampaignProgress().highestLevel).toBe(4);

      recordLevelReached(99);
      expect(getCampaignProgress().highestLevel).toBe(TOTAL_LEVELS);
      expect(window.localStorage.getItem(CAMPAIGN_PROGRESS_KEY)).not.toBeNull();
    });

    it('recordLevelReached ignores non-finite levels', () => {
      recordLevelReached(3);
      recordLevelReached(Number.NaN);
      recordLevelReached(Infinity);
      expect(getCampaignProgress().highestLevel).toBe(3);
    });

    it('markCampaignCompleted records completion, the best score and the final level', () => {
      markCampaignCompleted(54_321);
      expect(getCampaignProgress()).toEqual({
        completed: true,
        bestScore: 54_321,
        highestLevel: TOTAL_LEVELS,
      });

      markCampaignCompleted(1_000);
      expect(getCampaignProgress().bestScore).toBe(54_321);
      expect(getCampaignProgress().completed).toBe(true);

      markCampaignCompleted(60_000);
      expect(getCampaignProgress().bestScore).toBe(60_000);
    });

    it('never stores a negative best score', () => {
      markCampaignCompleted(-500);
      expect(getCampaignProgress().bestScore).toBe(0);
      expect(getCampaignProgress().completed).toBe(true);
    });

    it('is independent of the checkpoint slot', () => {
      saveCampaignCheckpoint(makeCheckpoint());
      recordLevelReached(6);
      markCampaignCompleted(9_000);
      expect(hasCampaignCheckpoint()).toBe(true);

      clearCampaignCheckpoint();
      expect(getCampaignProgress()).toEqual({
        completed: true,
        bestScore: 9_000,
        highestLevel: TOTAL_LEVELS,
      });
    });

    it('falls back to defaults and drops a corrupt progress record', () => {
      window.localStorage.setItem(CAMPAIGN_PROGRESS_KEY, '{oops');
      expect(getCampaignProgress()).toEqual(DEFAULT_PROGRESS);
      expect(window.localStorage.getItem(CAMPAIGN_PROGRESS_KEY)).toBeNull();
    });
  });
});
