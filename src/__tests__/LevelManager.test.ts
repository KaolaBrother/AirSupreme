import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LevelManager, LevelState } from '@/features/levels/LevelManager';
import { LevelWaveEventType } from '@/features/terrain/LevelConfig';
import { setLocale, type LocalizedText } from '@/i18n';
import * as THREE from 'three';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

const INTERCEPT_LABEL: LocalizedText = { en: 'Intercept', zh: '限时拦截' };

vi.mock('@/features/terrain/TerrainGenerator', () => ({
  TerrainGenerator: vi.fn().mockImplementation(() => ({
    generateTerrain: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('LevelManager', () => {
  let levelManager: LevelManager;
  let scene: THREE.Scene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = new THREE.Scene();
    levelManager = new LevelManager(scene);
  });

  afterEach(() => {
    resetLocale();
  });

  describe('constructor', () => {
    it('should create a LevelManager instance', () => {
      expect(levelManager).toBeDefined();
    });
  });

  describe('loadLevel', () => {
    it('should load level 1 without errors', () => {
      expect(() => levelManager.loadLevel(1)).not.toThrow();
    });

    it('should load level 2 without errors', () => {
      expect(() => levelManager.loadLevel(2)).not.toThrow();
    });

    it('should handle invalid level gracefully', () => {
      expect(() => levelManager.loadLevel(999)).not.toThrow();
    });
  });

  describe('startWave', () => {
    beforeEach(() => {
      levelManager.loadLevel(1);
    });

    it('should call onWaveStart callback', () => {
      const onWaveStart = vi.fn();
      levelManager.onWaveStart = onWaveStart;

      levelManager.startWave(new THREE.Vector3(0, 0, 0));
      expect(onWaveStart).toHaveBeenCalled();
    });
  });

  describe('getEnemies', () => {
    beforeEach(() => {
      levelManager.loadLevel(1);
    });

    it('should return empty array initially', () => {
      expect(levelManager.getEnemies()).toEqual([]);
    });
  });

  describe('getAliveEnemyCount', () => {
    beforeEach(() => {
      levelManager.loadLevel(1);
    });

    it('should return 0 initially', () => {
      expect(levelManager.getAliveEnemyCount()).toBe(0);
    });
  });

  describe('getTotalEnemyCount', () => {
    it('should return 0 when no level loaded', () => {
      expect(levelManager.getTotalEnemyCount()).toBe(0);
    });

    it('should return correct count for level 1', () => {
      levelManager.loadLevel(1);
      const total = levelManager.getTotalEnemyCount();
      expect(total).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      levelManager.loadLevel(1);
    });

    it('should clear enemies', () => {
      levelManager.clear();
      expect(levelManager.getEnemies()).toEqual([]);
    });
  });

  describe('getSpawnedEnemyCount', () => {
    it('should return 0 initially', () => {
      levelManager.loadLevel(1);
      expect(levelManager.getSpawnedEnemyCount()).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should have onWaveStart callback', () => {
      expect(levelManager.onWaveStart).toBeUndefined();
      levelManager.onWaveStart = vi.fn();
      expect(levelManager.onWaveStart).toBeDefined();
    });

    it('should have onWaveComplete callback', () => {
      expect(levelManager.onWaveComplete).toBeUndefined();
      levelManager.onWaveComplete = vi.fn();
      expect(levelManager.onWaveComplete).toBeDefined();
    });

    it('should have onWaveEventStart callback', () => {
      expect(levelManager.onWaveEventStart).toBeUndefined();
      levelManager.onWaveEventStart = vi.fn();
      expect(levelManager.onWaveEventStart).toBeDefined();
    });

    it('should have onLevelComplete callback', () => {
      expect(levelManager.onLevelComplete).toBeUndefined();
      levelManager.onLevelComplete = vi.fn();
      expect(levelManager.onLevelComplete).toBeDefined();
    });

    it('should have onEnemySpawned callback', () => {
      expect(levelManager.onEnemySpawned).toBeUndefined();
      levelManager.onEnemySpawned = vi.fn();
      expect(levelManager.onEnemySpawned).toBeDefined();
    });

    it('should have onEnemyKilled callback', () => {
      expect(levelManager.onEnemyKilled).toBeUndefined();
      levelManager.onEnemyKilled = vi.fn();
      expect(levelManager.onEnemyKilled).toBeDefined();
    });
  });

  describe('event wave templates', () => {
    beforeEach(() => {
      levelManager.loadLevel(2);
    });

    it('should trigger an event callback on later waves when templates exist', () => {
      const onWaveEventStart = vi.fn();
      levelManager.onWaveEventStart = onWaveEventStart;

      (levelManager as unknown as { currentWave: number; state: LevelState }).currentWave = 1;
      (levelManager as unknown as { currentWave: number; state: LevelState }).state =
        LevelState.WAVE_COMPLETE;

      levelManager.startWave(undefined, true);

      expect(onWaveEventStart).toHaveBeenCalledWith(LevelWaveEventType.INTERCEPT, 1);
    });

    it('should rotate into escort defense event on later template slots', () => {
      const onWaveEventStart = vi.fn();
      levelManager.onWaveEventStart = onWaveEventStart;

      (levelManager as unknown as { currentWave: number; state: LevelState }).currentWave = 3;
      (levelManager as unknown as { currentWave: number; state: LevelState }).state =
        LevelState.WAVE_COMPLETE;

      levelManager.startWave(undefined, true);

      expect(onWaveEventStart).toHaveBeenCalledWith(LevelWaveEventType.ESCORT_DEFENSE, 3);
    });

    it.each(LOCALES)(
      'should expose onboarding beat data in wave progress snapshots (%s)',
      (locale) => {
        // 波次开始时按当前界面语言取标签
        setLocale(locale);
        (levelManager as unknown as { currentWave: number; state: LevelState }).currentWave = 1;
        (levelManager as unknown as { currentWave: number; state: LevelState }).state =
          LevelState.WAVE_COMPLETE;

        levelManager.startWave(undefined, true);

        const label = textIn(INTERCEPT_LABEL, locale);
        const snapshot = levelManager.getWaveProgressSnapshot();
        expect(snapshot).not.toBeNull();
        expect(snapshot?.eventType).toBe(LevelWaveEventType.INTERCEPT);
        expect(snapshot?.onboardingBeat.eventTypeLabel).toBe(label);
        expect(snapshot?.onboardingBeat.eventPromptDelayMs).toBeGreaterThan(0);
        expect(levelManager.getCurrentWaveOnboardingBeat().eventBannerLabel).toContain(label);
      }
    );
  });
});
