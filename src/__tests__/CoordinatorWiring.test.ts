import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDifficultyProfile } from '@/core/Difficulty';
import { GameCoordinator } from '@/core/GameCoordinator';
import { GameSessionState } from '@/core/GameSessionState';
import { DEFAULT_START_FLOW_SETTINGS } from '@/core/SessionSettings';
import { WingmanRoster } from '@/core/campaign/Wingmen';
import { EnemySystem } from '@/core/systems/EnemySystem';
import {
  BOSS_CONFIGS,
  BossType,
  getBossForLevel,
  type BossConfig,
} from '@/features/boss/BossTypes';
import { getCampaignChapter, TOTAL_LEVELS } from '@/features/campaign/CampaignData';
import type { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { setLocale } from '@/i18n';
import { HUD, type BriefingRequest } from '@/ui/HUD';
import type { GameSettings } from '@/ui/StartMenu';
import { resetLocale } from './i18nTestUtils';

/**
 * 协调器接线（GameCoordinator，终验修复第 2 波 G1 / G2）。协调器整体依赖 WebGL，这里在原型上
 * 直接调用相关的私有方法，协作者换成替身（只给方法用到的字段）：
 * - 入关 / Boss 简报把章节的双语原文（LocalizedText）交给 HUD，切换语言时横幅随之重绘；
 * - 开始菜单选的难度就是本局与检查点用的难度；
 * - Boss 导弹单发伤害随难度档严格递增，并由 Boss 配置的 missileDamage 决定；
 * - 新友机在创建 AI 之前就摆好入场位姿（首帧渲染不会跳回世界原点），朝玩家航向、离地有余量。
 */

type Stub = Record<string, unknown>;

/** 任意方法都是 vi.fn() 的替身 */
function autoStub(): Stub {
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') return undefined;
        let method = methods.get(key);
        if (!method) {
          method = vi.fn();
          methods.set(key, method);
        }
        return method;
      },
    }
  ) as Stub;
}

/** 以 GameCoordinator 原型为原型、字段由测试提供的对象 */
function coordinatorWith(fields: Stub): Stub {
  const target = Object.create(GameCoordinator.prototype) as Stub;
  Object.assign(target, fields);
  return target;
}

function callPrivate<T>(target: Stub, name: string, ...args: unknown[]): T {
  const method = (GameCoordinator.prototype as unknown as Record<string, unknown>)[name];
  expect(typeof method, `GameCoordinator.${name}`).toBe('function');
  return (method as (...params: unknown[]) => T).apply(target, args);
}

const LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1);
const UP = new THREE.Vector3(0, 1, 0);

describe('GameCoordinator wiring', () => {
  beforeAll(() => {
    expect(GameCoordinator).toBeTypeOf('function');
  });

  afterEach(() => {
    resetLocale();
    document.body.innerHTML = '';
  });

  describe('briefings pass the chapter’s bilingual text', () => {
    function briefingsOf(showBriefing: ReturnType<typeof vi.fn>): BriefingRequest[] {
      return showBriefing.mock.calls.map(([request]) => request as BriefingRequest);
    }

    it.each(LEVELS)('level %i briefing: chapter label, title and line objects', (level) => {
      const showBriefing = vi.fn();
      const coordinator = coordinatorWith({ hud: { showBriefing }, audioManager: autoStub() });
      callPrivate(coordinator, 'presentLevelBriefing', level);

      const chapter = getCampaignChapter(level);
      const [briefing] = briefingsOf(showBriefing);
      expect(briefing.kicker).toBe(chapter.chapterLabel);
      expect(briefing.title).toBe(chapter.title);
      expect(briefing.line).toBe(chapter.levelBriefingLine);
    });

    it.each(LEVELS)('level %i boss briefing: boss name and line objects', (level) => {
      const showBriefing = vi.fn();
      const thenStart = vi.fn();
      const scheduled: Array<() => void> = [];
      const coordinator = coordinatorWith({
        hud: { showBriefing },
        audioManager: autoStub(),
        scheduleTimeout: (callback: () => void) => {
          scheduled.push(callback);
          return 0;
        },
      });
      callPrivate(coordinator, 'presentBossBriefing', level, thenStart);

      const boss = getCampaignChapter(level).boss;
      const [briefing] = briefingsOf(showBriefing);
      expect(briefing.title).toBe(boss.name);
      expect(briefing.line).toBe(boss.briefingLine);
      expect(thenStart).not.toHaveBeenCalled();
      scheduled.forEach((callback) => callback());
      expect(thenStart).toHaveBeenCalledTimes(1);
    });

    it('a level briefing on the real HUD switches language while it is up', () => {
      const hud = new HUD();
      hud.init();
      try {
        const coordinator = coordinatorWith({ hud, audioManager: autoStub() });
        callPrivate(coordinator, 'presentLevelBriefing', 6);
        const chapter = getCampaignChapter(6);
        const card = (): string => document.getElementById('hud-briefing')?.textContent ?? '';
        expect(card()).toContain(chapter.title.en);

        setLocale('zh-CN');
        expect(card()).toContain(chapter.title.zh);
        expect(card()).toContain(chapter.levelBriefingLine.zh);
        expect(card()).not.toContain(chapter.title.en);
      } finally {
        hud.dispose();
      }
    });
  });

  describe('the chosen difficulty is the one the run and its checkpoints use', () => {
    function settings(difficulty: number): GameSettings {
      return { ...DEFAULT_START_FLOW_SETTINGS, difficulty } as GameSettings;
    }

    function startRun(difficulty: number): { coordinator: Stub; session: GameSessionState } {
      const session = new GameSessionState();
      const enemySystem = { setDifficultyProfile: vi.fn() };
      const coordinator = coordinatorWith({
        sessionState: session,
        enemySystem,
        playerSystem: autoStub(),
        audioManager: autoStub(),
        musicSystem: autoStub(),
        voiceSystem: autoStub(),
        gameState: { reset: vi.fn(), getScore: () => 4321, addScore: vi.fn() },
        view: { setMode: vi.fn(), getMode: () => 'third-person' },
        campaign: {
          setupNewRun: vi.fn(),
          getRunStats: () => ({ kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 }),
        },
        hud: autoStub(),
        lockOnIndicator: autoStub(),
        playerStats: new PlayerStats(),
        options: { resume: null },
        setQualityPreset: () => undefined,
      });
      callPrivate(coordinator, 'applyGameSettings', settings(difficulty));
      return { coordinator, session };
    }

    it.each([1, 2, 3, 4, 5])(
      'difficulty %i reaches the session and the enemy system',
      (difficulty) => {
        const { coordinator, session } = startRun(difficulty);
        expect(session.getDifficulty()).toBe(difficulty);
        const enemySystem = coordinator.enemySystem as {
          setDifficultyProfile: ReturnType<typeof vi.fn>;
        };
        expect(enemySystem.setDifficultyProfile).toHaveBeenLastCalledWith(
          getDifficultyProfile(difficulty)
        );
      }
    );

    it.each([1, 3, 5])('difficulty %i is written into the checkpoint', (difficulty) => {
      const { coordinator } = startRun(difficulty);
      Object.assign(coordinator, {
        playerSystem: { getLives: () => 2 },
        missileCount: 4,
        weapons: {
          exportState: () => ({ unlocked: [], selected: null, ammo: {} }),
          getFlareCharges: () => 2,
        },
      });
      const snapshot = callPrivate<{ difficulty: number }>(
        coordinator,
        'captureCheckpoint',
        'wave',
        4,
        2
      );
      expect(snapshot.difficulty).toBe(difficulty);
    });
  });

  describe('boss missile damage follows the difficulty tier and the boss config', () => {
    function adjustedMissileDamage(config: BossConfig, difficulty: number, level: number): number {
      const session = new GameSessionState();
      session.setDifficulty(difficulty);
      session.setLevel(level);
      const coordinator = coordinatorWith({ sessionState: session });
      return callPrivate<BossConfig>(coordinator, 'getAdjustedBossConfig', config).missileDamage;
    }

    const MISSILE_BOSSES = LEVELS.map(
      (level) => [level, getBossForLevel(level) as BossType] as const
    ).filter(([, type]) => BOSS_CONFIGS[type].missileDamage > 0);

    it('covers every missile-firing boss', () => {
      expect(MISSILE_BOSSES.length).toBeGreaterThanOrEqual(8);
    });

    it.each(MISSILE_BOSSES)(
      'level %i (%s): per-hit damage rises strictly from Very Easy to Expert',
      (level, type) => {
        const damage = [1, 2, 3, 4, 5].map((tier) =>
          adjustedMissileDamage(BOSS_CONFIGS[type], tier, level)
        );
        for (let i = 1; i < damage.length; i++) {
          expect(damage[i], `tier ${i + 1} vs ${i}: ${damage.join(', ')}`).toBeGreaterThan(
            damage[i - 1]
          );
        }
      }
    );

    it('scales with the boss config’s missileDamage', () => {
      const base = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      for (const tier of [1, 3, 5]) {
        const single = adjustedMissileDamage(base, tier, 1);
        const doubled = adjustedMissileDamage(
          { ...base, missileDamage: base.missileDamage * 2 },
          tier,
          1
        );
        expect(Math.abs(doubled - single * 2), `tier ${tier}`).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('a new friendly jet', () => {
    /** 只还原本组的画布替身（全局 setup 里的尾迹替身不能被 restoreAllMocks 清掉） */
    let canvasSpy: { mockRestore(): void } | null = null;

    afterEach(() => {
      canvasSpy?.mockRestore();
      canvasSpy = null;
    });

    interface SpawnRig {
      coordinator: Stub;
      scene: THREE.Scene;
      playerAircraft: THREE.Group;
      enemySystem: EnemySystem;
    }

    function spawnRig(heading: number, ground: number): SpawnRig {
      canvasSpy ??= vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(() => null);
      const scene = new THREE.Scene();
      const enemySystem = new EnemySystem(scene);
      const playerAircraft = new THREE.Group();
      playerAircraft.position.set(240, 150, -320);
      playerAircraft.quaternion.setFromAxisAngle(UP, heading);
      const session = new GameSessionState();
      session.setLevel(3);
      const coordinator = coordinatorWith({
        enemySystem,
        playerSystem: { getPosition: () => playerAircraft.position.clone(), getSpeed: () => 72 },
        playerAircraft,
        friendlySpawnForward: new THREE.Vector3(),
        friendlySpawnHeading: new THREE.Vector3(),
        terrainHeightSampler: () => ground,
        gameScene: { scene },
        wingmen: new WingmanRoster(),
        sessionState: session,
        handleTutorialFriendlySupport: () => undefined,
      });
      return { coordinator, scene, playerAircraft, enemySystem };
    }

    function spawn(rig: SpawnRig): FriendlyAI {
      return callPrivate<{ friendly: FriendlyAI }>(rig.coordinator, 'spawnFriendlyJet').friendly;
    }

    /** 玩家水平航向坐标系：along 沿机头为正，lateral 向右为正 */
    function relative(rig: SpawnRig, point: THREE.Vector3): { along: number; lateral: number } {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.playerAircraft.quaternion);
      forward.y = 0;
      forward.normalize();
      const dx = point.x - rig.playerAircraft.position.x;
      const dz = point.z - rig.playerAircraft.position.z;
      return { along: dx * forward.x + dz * forward.z, lateral: dx * -forward.z + dz * forward.x };
    }

    it('is placed before its first render: interpolation starts at the spawn pose, not the origin', () => {
      const rig = spawnRig(0.6, 0);
      const friendly = spawn(rig);
      const spawned = friendly.getMesh().position.clone();
      expect(spawned.distanceTo(rig.playerAircraft.position)).toBeLessThan(150);

      for (const alpha of [0, 0.5, 1]) {
        friendly.getEnemy().applyInterpolatedVisual(alpha);
        expect(
          friendly.getMesh().position.distanceTo(spawned),
          `render alpha ${alpha}`
        ).toBeLessThan(1e-6);
      }
      expect(friendly.getMesh().position.length()).toBeGreaterThan(100);
    });

    it('spawns well out to the side, alternating sides, facing and flying the player’s heading', () => {
      const heading = -2.1;
      const rig = spawnRig(heading, 0);
      const first = spawn(rig);
      const second = spawn(rig);
      const third = spawn(rig);
      const offsets = [first, second, third].map((jet) => relative(rig, jet.getMesh().position));
      for (const offset of offsets) {
        expect(Math.abs(offset.lateral)).toBeGreaterThanOrEqual(35);
      }
      expect(Math.sign(offsets[0].lateral)).toBe(-Math.sign(offsets[1].lateral));
      expect(Math.sign(offsets[2].lateral)).toBe(Math.sign(offsets[0].lateral));

      const playerForward = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
      for (const jet of [first, second, third]) {
        // 机体本地 +Z 为机头
        const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(jet.getMesh().quaternion);
        expect(nose.dot(playerForward), 'nose along the player heading').toBeGreaterThan(0.99);
        const velocity = jet.getEnemy().velocity;
        expect(velocity.clone().normalize().dot(playerForward)).toBeGreaterThan(0.99);
        expect(velocity.length(), 'not slower than the player').toBeGreaterThanOrEqual(72);
      }
    });

    it('keeps clear of high terrain under the spawn point', () => {
      const ground = 160;
      const rig = spawnRig(0, ground);
      const friendly = spawn(rig);
      expect(friendly.getMesh().position.y).toBeGreaterThanOrEqual(ground + 20);
    });
  });
});
