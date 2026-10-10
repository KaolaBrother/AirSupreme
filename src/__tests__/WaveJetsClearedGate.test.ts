import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelManager, LevelState } from '@/features/levels/LevelManager';

/**
 * “还有目标”提示与防卡关计时只在进行中的波次里生效（规格 M3：Boss 战、两波之间绝不出现）。
 * UnitController 只看协调器每帧传进来的 jetsCleared，而它来自 LevelManager.areWaveJetsCleared()；
 * 这里验证这个门：只有波次进行中、敌机全部进场并被清空、波次又被别的东西（敌方单位）拖住时才为
 * true；开波之前、敌机还没出完、波次结束之后都是 false。
 */

// 地形生成很重，这里用不到：换成一片平坦的海面
vi.mock('@/features/terrain/TerrainGenerator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/terrain/TerrainGenerator')>()),
  TerrainGenerator: vi.fn().mockImplementation(() => ({
    generateTerrain: vi.fn(),
    update: vi.fn(),
    updateLOD: vi.fn(),
    getCrashSurfaceY: vi.fn(() => 0),
    sampleSurface: vi.fn(() => ({ y: 0, kind: 'water' })),
    getSurfaceKind: vi.fn(() => 'water'),
    getEnvironment: vi.fn(() => null),
    dispose: vi.fn(),
  })),
}));

const PLAYER = new THREE.Vector3(0, 300, 0);
const DT = 0.1;

describe('LevelManager.areWaveJetsCleared (the jetsCleared flag given to the units)', () => {
  let scene: THREE.Scene;
  let levels: LevelManager;
  /** 拖住波次的敌方单位数（UnitController.getWaveHoldCount 的替身） */
  let unitsHolding: number;
  let canvasSpy: { mockRestore(): void };

  beforeEach(() => {
    // 敌机模型会试着画贴图：jsdom 没有 canvas，直接返回 null
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    scene = new THREE.Scene();
    levels = new LevelManager(scene);
    unitsHolding = 0;
    levels.setWaveHoldProvider(() => unitsHolding);
  });

  afterEach(() => {
    levels.dispose(scene);
    // 只还原这一个：restoreAllMocks 会连地形生成器的替身一起清掉
    canvasSpy.mockRestore();
  });

  /** 敌机经传送门进场，传送门模块是按需加载的：让挂起的加载与回调跑完 */
  async function settle(): Promise<void> {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 4; i++) await Promise.resolve();
  }

  /** 推进到本波敌机全部进场（进场的敌机立刻击毁），返回期间 areWaveJetsCleared 是否出现过 true */
  async function clearJets(maxSeconds = 120): Promise<{ clearedEarly: boolean; killed: number }> {
    let clearedEarly = false;
    let killed = 0;
    const wave = levels.getCurrentWaveIndex();
    const total = levels.getCurrentLevelConfig()?.enemiesPerWave[wave] ?? 0;
    expect(total, 'the wave has jets').toBeGreaterThan(0);
    for (let elapsed = 0; elapsed < maxSeconds; elapsed += DT) {
      levels.update(DT, PLAYER);
      await settle();
      for (const enemy of levels.getEnemies()) {
        if (enemy.isAlive()) {
          enemy.takeDamage(1e9);
          killed++;
        }
      }
      if (killed >= total && levels.getActivePortalPositions().length === 0) break;
      if (levels.areWaveJetsCleared()) clearedEarly = true;
    }
    expect(killed, 'every jet of the wave came in and was shot down').toBe(total);
    return { clearedEarly, killed };
  }

  it('is false before a level is loaded and before the first wave starts', () => {
    expect(levels.areWaveJetsCleared()).toBe(false);
    levels.loadLevel(1);
    expect(levels.getState()).toBe(LevelState.IDLE);
    expect(levels.areWaveJetsCleared()).toBe(false);
  });

  it('is false while the wave still has jets to bring in, true once they are all gone', async () => {
    unitsHolding = 1;
    levels.loadLevel(1);
    levels.startWave(PLAYER);
    expect(levels.getState()).toBe(LevelState.WAVE_ACTIVE);
    expect(levels.areWaveJetsCleared(), 'no jet has come in yet').toBe(false);

    const { clearedEarly } = await clearJets();
    expect(clearedEarly, 'never true while jets were still to come').toBe(false);

    levels.update(DT, PLAYER);
    expect(levels.getState(), 'a hostile unit holds the wave').toBe(LevelState.WAVE_ACTIVE);
    expect(levels.areWaveJetsCleared()).toBe(true);

    // 单位一直拖着：一直为 true
    for (let i = 0; i < 100; i++) levels.update(DT, PLAYER);
    expect(levels.areWaveJetsCleared()).toBe(true);
  });

  it('is false again between waves, once nothing holds the wave any more', async () => {
    unitsHolding = 1;
    levels.loadLevel(1);
    levels.startWave(PLAYER);
    await clearJets();
    levels.update(DT, PLAYER);
    expect(levels.areWaveJetsCleared()).toBe(true);

    // 最后一个单位被击毁（或防卡关放行）：波次结束，进入两波之间的间隔
    unitsHolding = 0;
    levels.update(DT, PLAYER);
    expect(levels.getState()).toBe(LevelState.WAVE_COMPLETE);
    expect(levels.areWaveJetsCleared(), 'between waves').toBe(false);
    for (let i = 0; i < 20; i++) {
      levels.update(DT, PLAYER);
      if (levels.getState() === LevelState.WAVE_COMPLETE) {
        expect(levels.areWaveJetsCleared()).toBe(false);
      }
    }
  });

  it('is never true in a wave that no unit holds', async () => {
    levels.loadLevel(1);
    levels.startWave(PLAYER);
    const { clearedEarly } = await clearJets();
    expect(clearedEarly).toBe(false);
    levels.update(DT, PLAYER);
    expect(levels.getState()).toBe(LevelState.WAVE_COMPLETE);
    expect(levels.areWaveJetsCleared()).toBe(false);
  });
});
