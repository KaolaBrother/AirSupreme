import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import type { GameState } from '@/core/GameState';
import { getUnlockedWeaponsThrough } from '@/features/campaign/CampaignData';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { getLevelConfig } from '@/features/terrain/LevelConfig';
import { UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { FIRST_CONTACT_HINTS } from '@/ui/OnboardingManager';
import { CampaignRig, callPrivate, installCampaignGlobals, waveCheckpoint } from './campaignRig';
import { resetLocale } from './i18nTestUtils';
import { settle } from './waveRig';

/**
 * 敌机舰队 M3：开发钩子 startLevel(level, wave = 1)（window.__AIR_SUPREME_DEV__，验收后期关卡用）。
 * 约定（DevHooks.ts 里钩子的说明）：
 * - wave 是 HUD 上显示的波次号（从 1 起，缺省 1）；
 * - 走读档续玩的同一条入关路径：清场 → 加载关卡 → 入关简报 → 开波；
 * - 解锁到该关为止的武器；已买的升级、升级点、分数与生命数不变；
 * - 剧情卡片 / 机库打开时不执行；不存在的关卡、不在战斗中、Boss 模式时也不执行；
 * - 返回 { level, wave, waveIndex }，没有执行时返回 false。
 *
 * 台架：战役台架（campaignRig.ts，一台真的 GameCoordinator），钩子由协调器自己安装。
 */

vi.setConfig({ testTimeout: 120_000 });

vi.mock('@/scenes/GameScene', () => ({
  GameScene: class {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(
      GAME_CONSTANTS.CAMERA.FOV,
      1.6,
      GAME_CONSTANTS.CAMERA.NEAR,
      GAME_CONSTANTS.CAMERA.FAR
    );

    setScreenEffects(): void {
      // 没有后处理
    }

    render(): void {
      // 不渲染
    }

    applyQualitySettings(): void {
      // 没有画质可调
    }

    applyLevelEnvironment(): void {
      // 没有环境
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: class {
    private readonly aircraft: THREE.Group;

    constructor(aircraft: THREE.Group) {
      this.aircraft = aircraft;
    }

    getPosition(): THREE.Vector3 {
      return this.aircraft.position.clone();
    }

    getQuaternion(): THREE.Quaternion {
      return this.aircraft.quaternion.clone();
    }

    getSpeed(): number {
      return 0;
    }

    update(): void {
      // 座机不动
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

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

interface StartLevelHooks {
  startLevel(
    level: number,
    wave?: number
  ): { level: number; wave: number; waveIndex: number } | false;
  spawnEnemy(type: string, opts?: { distance?: number; count?: number }): unknown;
}

const UPGRADE_TYPES = Object.values(UpgradeType);

describe('dev hook startLevel(level, wave)', () => {
  let restoreGlobals: () => void;
  let rig: CampaignRig;
  let hooks: StartLevelHooks;

  beforeEach(async () => {
    restoreGlobals = installCampaignGlobals();
    window.localStorage.clear();
    // 钩子里“上帝模式”的抬升循环每帧排一次：测试里不跑
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    rig = await CampaignRig.boot();
    // 先有一局正在进行的战役：第 1 关第 1 波
    await rig.resume(waveCheckpoint(1, 0));
    await rig.run(3, true);
    callPrivate(rig.coordinator, 'installDevHooks');
    let installed: unknown = undefined;
    for (let i = 0; i < 20 && !installed; i++) {
      await settle();
      installed = (window as unknown as { __AIR_SUPREME_DEV__?: unknown }).__AIR_SUPREME_DEV__;
    }
    expect(installed, 'the dev hooks are installed in a dev build').toBeTruthy();
    hooks = installed as StartLevelHooks;
  });

  afterEach(() => {
    rig.dispose();
    delete (window as unknown as { __AIR_SUPREME_DEV__?: unknown }).__AIR_SUPREME_DEV__;
    vi.mocked(window.requestAnimationFrame).mockRestore();
    restoreGlobals();
    resetLocale();
    window.localStorage.clear();
  });

  function score(): number {
    return (rig.coordinator.gameState as GameState).getScore();
  }

  function upgradeLevels(): Record<string, number> {
    const upgrades = rig.playerStats.getUpgrades();
    return Object.fromEntries(UPGRADE_TYPES.map((type) => [type, upgrades.getLevel(type)]));
  }

  /** 等入关完成，再等本关第 waveIndex 波开波 */
  async function untilWaveStarts(level: number, waveIndex: number, entered: number): Promise<void> {
    await rig.untilEntered(entered);
    const startsBefore = rig.waveStarts.length;
    const started = await rig.runUntil(() => rig.waveStarts.length > startsBefore, 10);
    expect(started, 'a wave started').toBe(true);
    expect(rig.waveStarts[rig.waveStarts.length - 1]).toMatchObject({ level, wave: waveIndex });
  }

  it('goes to level 7 wave 3 (wave counted from 1, as on the HUD), and that wave brings its own line-up', async () => {
    const entered = rig.enteredCount();
    expect(hooks.startLevel(7, 3)).toEqual({ level: 7, wave: 3, waveIndex: 2 });
    await untilWaveStarts(7, 2, entered);
    expect(rig.session.getLevel()).toBe(7);
    expect(rig.session.getWave()).toBe(2);
    expect(rig.levelManager.getCurrentLevelConfig()?.id).toBe(7);
    expect(rig.levelManager.getCurrentWaveIndex()).toBe(2);
    // 这一波按写定的编成出场
    const lineup = [...(getLevelConfig(7)?.waves[2].lineup ?? [])];
    const arrivedFrom = rig.arrivals.length;
    await rig.runUntil(() => rig.arrivals.length - arrivedFrom >= lineup.length, 30, true);
    expect(rig.arrivals.slice(arrivedFrom).map((arrival) => arrival.jet.getConfig().type)).toEqual(
      lineup
    );
  });

  it('takes the checkpoint-resume way in: the sky is cleared without scoring, the level briefing plays, the wave starts after the usual delay', async () => {
    hooks.spawnEnemy('FIGHTER', { count: 3 });
    expect(rig.levelManager.getEnemies().filter((jet) => jet.isAlive())).toHaveLength(3);
    const scoreBefore = score();
    const entered = rig.enteredCount();
    const calledAt = rig.time;
    expect(hooks.startLevel(5)).toEqual({ level: 5, wave: 1, waveIndex: 0 });
    await rig.untilEntered(entered);
    expect(rig.levelManager.getEnemies(), 'the old jets are gone').toHaveLength(0);
    expect(score(), 'nobody scored for them').toBe(scoreBefore);
    const startsBefore = rig.waveStarts.length;
    await rig.runUntil(() => rig.waveStarts.length > startsBefore, 10);
    const start = rig.waveStarts[rig.waveStarts.length - 1];
    expect(start).toMatchObject({ level: 5, wave: 0 });
    // 与读档入关一样：开波在入关后 START_DELAY
    expect(start.at - calledAt).toBeGreaterThanOrEqual(GAME_CONSTANTS.LEVEL.START_DELAY - 0.05);
    expect(start.at - calledAt).toBeLessThan(GAME_CONSTANTS.LEVEL.START_DELAY + 0.5);
  });

  it('unlocks the weapons through the level; bought upgrades, points, score and lives stay as they were', async () => {
    const stats = rig.playerStats;
    stats.getUpgrades().awardBonusPoints(5);
    expect(stats.getUpgrades().upgrade(UpgradeType.SPEED)).toBe(true);
    expect(stats.getUpgrades().upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
    (rig.coordinator.gameState as GameState).addScore(1234);
    rig.playerSystem.setLives(2);
    const before = {
      upgrades: upgradeLevels(),
      points: stats.getUpgrades().getAvailablePoints(),
      score: score(),
      lives: rig.playerSystem.getLives(),
    };
    expect(stats.getUpgrades().getUnlockedWeapons()).toEqual(getUnlockedWeaponsThrough(1));

    const entered = rig.enteredCount();
    expect(hooks.startLevel(8, 2)).toEqual({ level: 8, wave: 2, waveIndex: 1 });
    await untilWaveStarts(8, 1, entered);

    expect([...stats.getUpgrades().getUnlockedWeapons()].sort()).toEqual(
      [...getUnlockedWeaponsThrough(8)].sort()
    );
    expect(getUnlockedWeaponsThrough(8).length).toBeGreaterThan(
      getUnlockedWeaponsThrough(1).length
    );
    expect({
      upgrades: upgradeLevels(),
      points: stats.getUpgrades().getAvailablePoints(),
      score: score(),
      lives: rig.playerSystem.getLives(),
    }).toEqual(before);
  });

  it('a wave beyond the level’s last goes to the last wave; wave 0 or less to the first', async () => {
    const last = getLevelConfig(4)?.totalWaves ?? 0;
    const entered = rig.enteredCount();
    expect(hooks.startLevel(4, 99)).toEqual({ level: 4, wave: last, waveIndex: last - 1 });
    await untilWaveStarts(4, last - 1, entered);
    expect(hooks.startLevel(3, 0)).toEqual({ level: 3, wave: 1, waveIndex: 0 });
    expect(hooks.startLevel(3, -2)).toEqual({ level: 3, wave: 1, waveIndex: 0 });
  });

  it('starting at an introduction wave shows its first-contact hint', async () => {
    const entered = rig.enteredCount();
    expect(hooks.startLevel(7, 2)).toEqual({ level: 7, wave: 2, waveIndex: 1 });
    await untilWaveStarts(7, 1, entered);
    await rig.run(6);
    const hint = FIRST_CONTACT_HINTS[EnemyType.WRAITH]?.en ?? '';
    expect(hint).not.toBe('');
    expect(rig.showingsOf(hint)).toHaveLength(1);
  });

  describe('does nothing and returns false', () => {
    async function expectNothingHappened(result: unknown): Promise<void> {
      expect(result).toBe(false);
      const entered = rig.enteredCount();
      for (let i = 0; i < 5; i++) await settle();
      expect(rig.enteredCount(), 'no level was entered').toBe(entered);
      expect(rig.session.getLevel()).toBe(1);
      expect(rig.session.getWave()).toBe(0);
      expect(rig.levelManager.getCurrentLevelConfig()?.id).toBe(1);
    }

    it.each([
      ['level 0', 0],
      ['level 11', 11],
      ['level NaN', Number.NaN],
    ] as const)('for %s', async (_name, level) => {
      await expectNothingHappened(hooks.startLevel(level, 1));
    });

    it('while a story card holds the game', async () => {
      rig.coordinator.storyHold = true;
      const result = hooks.startLevel(6, 1);
      rig.coordinator.storyHold = false;
      await expectNothingHappened(result);
    });

    it('while the hangar is open', async () => {
      const menu = rig.coordinator.upgradeMenu;
      rig.coordinator.upgradeMenu = { isVisible: () => true };
      const result = hooks.startLevel(6, 1);
      rig.coordinator.upgradeMenu = menu;
      await expectNothingHappened(result);
    });

    it('in boss mode', async () => {
      rig.session.setMode('boss');
      const result = hooks.startLevel(6, 1);
      rig.session.setMode('normal');
      await expectNothingHappened(result);
    });

    it('when no battle is going on (game over)', async () => {
      rig.session.setGameOver();
      const result = hooks.startLevel(6, 1);
      rig.session.setPlaying();
      await expectNothingHappened(result);
    });
  });
});
