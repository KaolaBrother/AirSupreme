import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LevelManager } from '@/features/levels/LevelManager';
import * as THREE from 'three';

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
});
