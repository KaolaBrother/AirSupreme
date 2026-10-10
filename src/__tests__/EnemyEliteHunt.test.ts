import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ELITE_ENEMY_TYPES, EnemyType, isEliteEnemyType } from '@/features/enemy/EnemyTypes';
import { LevelWaveEventType, getLevelConfig } from '@/features/terrain/LevelConfig';
import { CampaignRig, installCampaignGlobals, waveCheckpoint } from './campaignRig';
import { seededGameRandom } from './enemyFleetRig';
import { resetLocale } from './i18nTestUtils';
import { WaveRig } from './waveRig';

/**
 * 敌机舰队 M3：“精英歼灭”的名单与目标（规格 §4 “Elite hunt objectives count STRIKER, JAMMER and
 * WRAITH along with HEAVY, ACE and SNIPER”；§4a 规则 5：精英歼灭波次的编成里，精英名单上的敌机
 * 至少与目标要玩家击毁的一样多）。
 *
 * - 名单本身；
 * - 真实的生成路径（LevelManager）：每一个精英歼灭波次开场时，“在场的精英 + 还没现身的精英”
 *   正是编成里的精英架数；只有击毁精英才让它减少；
 * - 游戏里（战役台架，一台真的 GameCoordinator）：目标面板开场就写着本波的精英架数，打掉最后
 *   一架精英后换成“清理尾场”——STRIKER / JAMMER / WRAITH 都算在内。
 */

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

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

const { SCOUT, FIGHTER, HEAVY, SNIPER, ACE, STRIKER, JAMMER, WRAITH } = EnemyType;
const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** 规格的精英名单 */
const SPEC_ELITES: readonly EnemyType[] = [HEAVY, ACE, SNIPER, STRIKER, JAMMER, WRAITH];

interface HuntWave {
  level: number;
  /** 波次（0 起） */
  wave: number;
  lineup: readonly EnemyType[];
}

/** 战役里所有精英歼灭波次（事件来自各关原有的 eventTemplates：第 2 波起轮流） */
function huntWaves(): HuntWave[] {
  const waves: HuntWave[] = [];
  for (const level of ALL_LEVELS) {
    const config = getLevelConfig(level);
    if (!config) throw new Error(`level ${level} missing`);
    const templates = config.eventTemplates ?? [];
    for (let wave = 1; wave < config.totalWaves; wave++) {
      if (templates[(wave - 1) % templates.length] !== LevelWaveEventType.ELITE_HUNT) continue;
      waves.push({ level, wave, lineup: config.waves[wave].lineup });
    }
  }
  return waves;
}

function elitesIn(lineup: readonly EnemyType[]): number {
  return lineup.filter((type) => SPEC_ELITES.includes(type)).length;
}

function label(level: number, wave: number): string {
  return `level ${level} wave ${wave + 1}`;
}

describe('the elite list (spec §4)', () => {
  it('is HEAVY, ACE, SNIPER, STRIKER, JAMMER and WRAITH', () => {
    expect([...ELITE_ENEMY_TYPES].sort()).toEqual([...SPEC_ELITES].sort());
  });

  it.each([STRIKER, JAMMER, WRAITH, HEAVY, ACE, SNIPER])('%s counts as elite', (type) => {
    expect(isEliteEnemyType(type)).toBe(true);
  });

  it.each([SCOUT, FIGHTER])('%s does not', (type) => {
    expect(isEliteEnemyType(type)).toBe(false);
  });

  it('the campaign has elite-hunt waves whose elites include STRIKER, JAMMER and WRAITH (test self-check)', () => {
    const types = new Set(huntWaves().flatMap((hunt) => hunt.lineup));
    for (const type of [STRIKER, JAMMER, WRAITH]) expect(types.has(type), type).toBe(true);
  });
});

describe('the elites to destroy, through the real spawn path (spec §4a rule 5)', () => {
  let canvasSpy: { mockRestore(): void };
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterAll(() => {
    canvasSpy.mockRestore();
  });

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(1357));
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  /** 在场的精英 + 还没现身的精英：目标面板显示的就是这个数 */
  function elitesLeft(rig: WaveRig): number {
    const alive = rig.alive().filter((jet) => isEliteEnemyType(jet.getConfig().type)).length;
    return alive + rig.levels.countEliteJetsToCome();
  }

  it.each(huntWaves().map((hunt) => [label(hunt.level, hunt.wave), hunt] as const))(
    '%s: starts at the line-up’s elite count, unchanged by other kills, down one per elite destroyed',
    async (_name, hunt) => {
      const rig = new WaveRig();
      try {
        rig.load(hunt.level, hunt.wave);
        rig.start();
        expect(rig.records[0].event).toBe(LevelWaveEventType.ELITE_HUNT);
        const expected = elitesIn(hunt.lineup);
        expect(expected, 'the line-up has elites to destroy').toBeGreaterThanOrEqual(1);
        expect(elitesLeft(rig), 'at the start of the wave').toBe(expected);

        // 非精英一现身就击毁；精英留着，直到整波到齐
        const history: number[] = [];
        for (let i = 0; i < 600 && !rig.allArrived(); i++) {
          await rig.step('none');
          for (const jet of rig.alive()) {
            if (!isEliteEnemyType(jet.getConfig().type)) jet.takeDamage(1e9);
          }
          history.push(elitesLeft(rig));
        }
        expect(rig.allArrived(), 'the whole wave arrived').toBe(true);
        expect(new Set(history), 'non-elite kills do not change it').toEqual(new Set([expected]));

        // 精英一架一架击毁
        const elites: EnemyAI[] = rig.alive();
        expect(elites.map((jet) => jet.getConfig().type).sort()).toEqual(
          hunt.lineup.filter((type) => SPEC_ELITES.includes(type)).sort()
        );
        let left = expected;
        for (const jet of elites) {
          jet.takeDamage(1e9);
          await rig.step('none');
          left--;
          expect(elitesLeft(rig), `after a ${jet.getConfig().type} is destroyed`).toBe(left);
        }
        expect(left).toBe(0);
      } finally {
        rig.dispose();
      }
    }
  );
});

describe('in the game: the elite-hunt objective panel', () => {
  let restoreGlobals: () => void;
  let rig: CampaignRig | null = null;

  beforeEach(() => {
    restoreGlobals = installCampaignGlobals();
    window.localStorage.clear();
  });

  afterEach(() => {
    rig?.dispose();
    rig = null;
    restoreGlobals();
    resetLocale();
    window.localStorage.clear();
  });

  // 每种新精英各挑一个精英歼灭波次（再加一个只有老精英的作对照）
  const CASES = [
    ['STRIKER', 4, 2],
    ['JAMMER', 5, 1],
    ['WRAITH', 7, 3],
    ['HEAVY + SNIPER', 3, 1],
  ] as const;

  it.each(CASES)(
    '%s: the panel counts the wave’s elites from the start and switches to mop-up once the last one is down',
    async (_name, level, wave) => {
      const hunt = huntWaves().find((entry) => entry.level === level && entry.wave === wave);
      expect(hunt, `${label(level, wave)} is an elite hunt`).toBeDefined();
      const expected = elitesIn(hunt?.lineup ?? []);
      const current = await CampaignRig.boot();
      rig = current;
      const shown: string[][] = [];
      const presentation = current.coordinator.presentationController as {
        showEventObjective(title: string, objective: string, status: string): void;
      };
      const original = presentation.showEventObjective.bind(presentation);
      vi.spyOn(presentation, 'showEventObjective').mockImplementation((...args) => {
        shown.push(args);
        original(...args);
      });
      const status = (): string => shown[shown.length - 1]?.[2] ?? '';

      await current.resume(waveCheckpoint(level, wave));
      const started = await current.runUntil(
        () => current.waveStarts.some((start) => start.level === level && start.wave === wave),
        10
      );
      expect(started).toBe(true);
      // 开场一秒内：还没有一架现身，面板已经写着本波的精英总数
      await current.run(1);
      expect(current.levelManager.getEnemies().length, 'nobody has arrived yet').toBe(0);
      expect(shown[shown.length - 1]?.[0]).toMatch(/Elite hunt/);
      expect(status()).toMatch(new RegExp(`^Elites: ${expected} `));

      // 非精英一现身就击毁（留下第一架，让这一波在精英清空后还没结束），直到整波到齐
      const lineupSize = hunt?.lineup.length ?? 0;
      const arrived = new Set<EnemyAI>();
      let spared: EnemyAI | null = null;
      for (let i = 0; i < 600 && arrived.size < lineupSize; i++) {
        await current.step();
        for (const jet of current.levelManager.getEnemies()) {
          if (!jet.isAlive()) continue;
          arrived.add(jet);
          if (isEliteEnemyType(jet.getConfig().type)) continue;
          spared ??= jet;
          if (jet !== spared) jet.takeDamage(1e9);
        }
      }
      expect(spared, 'a non-elite jet is left').not.toBeNull();
      expect(arrived.size, 'the whole wave arrived').toBe(lineupSize);
      await current.step();
      expect(status()).toMatch(new RegExp(`^Elites: ${expected} `));

      // 精英一架一架击毁
      const elites = current.levelManager
        .getEnemies()
        .filter((jet) => jet.isAlive() && isEliteEnemyType(jet.getConfig().type));
      expect(elites).toHaveLength(expected);
      for (let i = 0; i < elites.length; i++) {
        elites[i].takeDamage(1e9);
        await current.run(0.2);
        const left = expected - i - 1;
        if (left > 0) {
          expect(status()).toMatch(new RegExp(`^Elites: ${left} `));
        }
      }
      // 精英清空：还剩一架普通敌机，目标换成清理尾场
      expect(spared?.isAlive(), 'the spared jet is still flying').toBe(true);
      expect(shown[shown.length - 1]?.[1]).toBe('Main threats down. Mop up the rest.');
      expect(status()).toBe('Mop-up: key targets down · 1 left');
    }
  );
});
