import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_START_FLOW_SETTINGS,
  normalizeStartFlowSettings,
  TEST_SCORE_OPTIONS,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import * as SessionSettingsModule from '@/core/SessionSettings';

type StartFlowPersistApi = {
  START_MENU_STORAGE_KEY: string;
  loadStartFlowSettings: () => StartFlowSettings;
  saveStartFlowSettings: (settings?: Partial<StartFlowSettings>) => void;
};

function persistApi(): StartFlowPersistApi {
  const mod = SessionSettingsModule as unknown as Partial<StartFlowPersistApi>;

  expect(mod.START_MENU_STORAGE_KEY).toBe('air-supreme:start-menu-settings');
  expect(typeof mod.loadStartFlowSettings).toBe('function');
  expect(typeof mod.saveStartFlowSettings).toBe('function');

  return mod as StartFlowPersistApi;
}

describe('SessionSettings', () => {
  it('uses the configured test score tiers up to 20000', () => {
    expect(TEST_SCORE_OPTIONS).toEqual([0, 5000, 10000, 15000, 20000]);
    expect(normalizeStartFlowSettings({ testScore: 20000 }).testScore).toBe(20000);
  });

  it('clamps oversized test score values to the highest tier', () => {
    expect(normalizeStartFlowSettings({ testScore: 25000 }).testScore).toBe(20000);
  });

  describe('start-flow persist', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    afterEach(() => {
      window.localStorage.clear();
    });

    it('exports START_MENU_STORAGE_KEY as air-supreme:start-menu-settings', () => {
      expect(
        (SessionSettingsModule as { START_MENU_STORAGE_KEY?: unknown }).START_MENU_STORAGE_KEY
      ).toBe('air-supreme:start-menu-settings');
    });

    it('returns defaults when storage is empty', () => {
      const { loadStartFlowSettings } = persistApi();

      expect(loadStartFlowSettings()).toEqual(DEFAULT_START_FLOW_SETTINGS);
    });

    it('round-trips sfx, music, and quality through localStorage', () => {
      const { START_MENU_STORAGE_KEY, loadStartFlowSettings, saveStartFlowSettings } = persistApi();

      saveStartFlowSettings({
        sfxVolume: 0.4,
        musicVolume: 0.2,
        qualityPreset: 'quality',
      });

      const storedRaw = window.localStorage.getItem(START_MENU_STORAGE_KEY);
      expect(storedRaw).toEqual(expect.any(String));
      const stored = JSON.parse(storedRaw as string) as Partial<StartFlowSettings>;
      expect(stored.sfxVolume).toBe(0.4);
      expect(stored.musicVolume).toBe(0.2);
      expect(stored.qualityPreset).toBe('quality');

      expect(loadStartFlowSettings()).toEqual(
        normalizeStartFlowSettings({
          ...DEFAULT_START_FLOW_SETTINGS,
          sfxVolume: 0.4,
          musicVolume: 0.2,
          qualityPreset: 'quality',
        })
      );
    });

    it('keeps a zero volume instead of treating it as missing', () => {
      const { loadStartFlowSettings, saveStartFlowSettings } = persistApi();

      saveStartFlowSettings({ sfxVolume: 0, musicVolume: 0 });

      const loaded = loadStartFlowSettings();
      expect(loaded.sfxVolume).toBe(0);
      expect(loaded.musicVolume).toBe(0);
    });

    it('merges partial saves so pause audio writes do not reset start-flow fields', () => {
      const { loadStartFlowSettings, saveStartFlowSettings } = persistApi();

      saveStartFlowSettings({
        difficulty: 5,
        playerLives: 7,
        startLevel: 4,
        gameMode: 'boss',
        testScore: 15000,
        sfxVolume: 0.3,
        musicVolume: 0.6,
        qualityPreset: 'balanced',
      });
      saveStartFlowSettings({ sfxVolume: 0.8 });

      const loaded = loadStartFlowSettings();
      expect(loaded.sfxVolume).toBe(0.8);
      expect(loaded.musicVolume).toBe(0.6);
      expect(loaded.qualityPreset).toBe('balanced');
      expect(loaded.difficulty).toBe(5);
      expect(loaded.playerLives).toBe(7);
      expect(loaded.startLevel).toBe(4);
      expect(loaded.gameMode).toBe('boss');
      expect(loaded.testScore).toBe(15000);
    });

    it('normalizes dirty stored JSON through normalizeStartFlowSettings', () => {
      const { START_MENU_STORAGE_KEY, loadStartFlowSettings } = persistApi();

      window.localStorage.setItem(
        START_MENU_STORAGE_KEY,
        JSON.stringify({
          sfxVolume: 0.5,
          qualityPreset: 'ultra',
          testScore: 25000,
        })
      );

      const loaded = loadStartFlowSettings();
      expect(loaded.sfxVolume).toBe(0.5);
      expect(loaded.qualityPreset).toBe('auto');
      expect(loaded.testScore).toBe(20000);
      expect(loaded.difficulty).toBe(DEFAULT_START_FLOW_SETTINGS.difficulty);
    });

    it('falls back to defaults and clears the key when stored JSON is corrupt', () => {
      const { START_MENU_STORAGE_KEY, loadStartFlowSettings } = persistApi();

      window.localStorage.setItem(START_MENU_STORAGE_KEY, '{not-json');

      expect(() => loadStartFlowSettings()).not.toThrow();
      expect(loadStartFlowSettings()).toEqual(DEFAULT_START_FLOW_SETTINGS);
      expect(window.localStorage.getItem(START_MENU_STORAGE_KEY)).toBeNull();
    });

    it('does not throw when localStorage getItem fails', () => {
      const { loadStartFlowSettings } = persistApi();
      const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
      window.localStorage.getItem = () => {
        throw new Error('denied');
      };

      try {
        expect(() => loadStartFlowSettings()).not.toThrow();
        expect(loadStartFlowSettings()).toEqual(DEFAULT_START_FLOW_SETTINGS);
      } finally {
        window.localStorage.getItem = originalGetItem;
      }
    });
  });
});
