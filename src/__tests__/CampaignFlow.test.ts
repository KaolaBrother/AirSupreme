import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CampaignFlowController,
  type CampaignFlowDeps,
} from '@/core/campaign/CampaignFlowController';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { GameSessionState } from '@/core/GameSessionState';
import {
  CAMPAIGN_SAVE_KEY,
  describeCheckpoint,
  getCampaignProgress,
  loadCampaignCheckpoint,
  saveCampaignCheckpoint,
  type CampaignCheckpointInput,
  type CampaignSaveData,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
import { TOTAL_LEVELS } from '@/features/campaign/CampaignData';
import { getLevelConfig } from '@/features/terrain/LevelConfig';
import { PlayerStats, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { setLocale, tr, type LocalizedText, type TextParams } from '@/i18n';
import { resetLocale } from './i18nTestUtils';

/**
 * 战役流程（CampaignFlowController，终验修复 F2）：
 * - 正常模式第 1-9 关击破 Boss 时立即写下一关的 'hangar' 检查点（Boss 后的分数）；
 *   机库“出击”时重写（机库里的购买不丢）；读 'hangar' 检查点：机库 → 章节开场 → 战斗；
 *   第 10 关击破即通关并清除检查点；Boss 模式从不存档。
 * - 雨燕入列台词每局只播一次：读档 / 继续不重播（存档 swiftJoined，旧存档按关卡推断），
 *   Boss 模式不播，渡鸦没有入列台词。
 * - Boss 收尾：结算等无线电说完（收尾台词全部播完）；看门狗 = 积压估计 + 6 秒，上限 75 秒；
 *   永远不会卡住。
 * 协调器的部分（关卡加载、机库菜单、Boss 战）用记录调用的替身。
 */

type PresentationCall = [method: string, args: unknown[]];

interface FakePresentation {
  presentation: ICampaignPresentation;
  calls: PresentationCall[];
  state: { radioBusy: boolean; backlog: number };
}

function createPresentation(): FakePresentation {
  const calls: PresentationCall[] = [];
  const state = { radioBusy: false, backlog: 0 };
  const explicit: Record<string, unknown> = {
    isRadioBusy: () => state.radioBusy,
    getRadioBacklogSeconds: () => state.backlog,
    isStoryActive: () => false,
    isWingmanFlying: () => false,
    genericRadio: (...args: unknown[]) => {
      calls.push(['genericRadio', args]);
      return true;
    },
  };
  const presentation = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') return undefined;
        const name = String(key);
        if (name in explicit) return explicit[name];
        return (...args: unknown[]) => {
          calls.push([name, args]);
        };
      },
    }
  ) as ICampaignPresentation;
  return { presentation, calls, state };
}

interface Harness {
  flow: CampaignFlowController;
  session: GameSessionState;
  stats: PlayerStats;
  fake: FakePresentation;
  /** 协调器侧的调用顺序：'hangar:4'、'prepare:4:0'、'intro:4'、'combat:4:0'、'boss:5'、'debrief:3'… */
  log: string[];
  runtime: { score: number };
  /** 机库“出击” */
  launchHangar(): void;
  /** 章节开场卡片放完 */
  finishIntro(): void;
  /** 结算卡片“继续” */
  continueDebrief(): void;
  /** 推进战斗时间（秒） */
  advance(seconds: number, dt?: number): void;
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function lastCall(fake: FakePresentation, method: string): unknown[] | null {
  for (let i = fake.calls.length - 1; i >= 0; i--) {
    if (fake.calls[i][0] === method) return fake.calls[i][1];
  }
  return null;
}

function countCalls(fake: FakePresentation, method: string): number {
  return fake.calls.filter(([name]) => name === method).length;
}

function createHarness(mode: 'normal' | 'boss' = 'normal'): Harness {
  const session = new GameSessionState();
  session.setMode(mode);
  session.setPlaying();
  const stats = new PlayerStats();
  const fake = createPresentation();
  const log: string[] = [];
  const runtime = { score: 0 };
  let hangarContinue: (() => void) | null = null;

  const deps: CampaignFlowDeps = {
    session,
    stats,
    presentation: fake.presentation,
    prepareLevel: (level, startWave) => {
      log.push(`prepare:${level}:${startWave}`);
      return Promise.resolve();
    },
    startLevelCombat: (level, startWave) => {
      log.push(`combat:${level}:${startWave}`);
    },
    startBossEncounter: (level) => {
      log.push(`boss:${level}`);
    },
    showHangar: (level, onContinue) => {
      log.push(`hangar:${level}`);
      hangarContinue = onContinue;
    },
    syncProgression: () => undefined,
    setStoryHold: () => undefined,
    showMissionComplete: (finalScore) => {
      log.push(`mission-complete:${finalScore}`);
    },
    captureCheckpoint: (kind: CheckpointKind, level: number, wave: number) =>
      ({
        checkpoint: kind,
        level,
        wave,
        difficulty: 3,
        score: runtime.score,
        lives: 3,
        missiles: 4,
        upgrades: stats.getUpgrades().export(),
        weapons: { unlocked: [], selected: null, ammo: {} },
        flares: 2,
        cameraMode: 'third-person',
        stats: { kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 },
      }) satisfies CampaignCheckpointInput,
    getScore: () => runtime.score,
  };
  const flow = new CampaignFlowController(deps);

  return {
    flow,
    session,
    stats,
    fake,
    log,
    runtime,
    launchHangar: () => {
      expect(hangarContinue, 'the hangar is showing').not.toBeNull();
      const next = hangarContinue as () => void;
      hangarContinue = null;
      next();
    },
    finishIntro: () => {
      const args = lastCall(fake, 'showChapterIntro');
      expect(args, 'a chapter intro is showing').not.toBeNull();
      const level = (args as unknown[])[0] as number;
      log.push(`intro:${level}`);
      ((args as unknown[])[2] as () => void)();
    },
    continueDebrief: () => {
      const args = lastCall(fake, 'showDebrief');
      expect(args, 'the debrief is showing').not.toBeNull();
      ((args as unknown[])[1] as () => void)();
    },
    advance: (seconds: number, dt = 0.1) => {
      for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
        flow.tick(dt);
      }
    },
  };
}

function savedCheckpoint(): CampaignSaveData {
  const save = loadCampaignCheckpoint();
  expect(save, 'a checkpoint is saved').not.toBeNull();
  return save as CampaignSaveData;
}

function makeSave(overrides: Partial<CampaignCheckpointInput>): CampaignCheckpointInput {
  return {
    checkpoint: 'wave',
    level: 3,
    wave: 2,
    difficulty: 3,
    score: 9000,
    lives: 3,
    missiles: 4,
    upgrades: {},
    weapons: { unlocked: [], selected: null, ammo: {} },
    flares: 2,
    cameraMode: 'third-person',
    stats: { kills: 10, civiliansLost: 0, deaths: 1, playTimeSeconds: 600 },
    ...overrides,
  };
}

describe('campaign flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  describe('hangar checkpoint after a boss kill', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
      'level %i: the boss kill saves a hangar checkpoint for the next level with the post-boss score',
      (level) => {
        const harness = createHarness();
        harness.session.setLevel(level);
        harness.runtime.score = 41_000 + level;

        harness.flow.handleBossDefeated(level, false);

        // 立即写入（收尾台词 / 结算期间退出也能从机库继续）
        const save = savedCheckpoint();
        expect(save.checkpoint).toBe('hangar');
        expect(save.level).toBe(level + 1);
        expect(save.wave).toBe(0);
        expect(save.score).toBe(41_000 + level);
      }
    );

    it('launching from the hangar rewrites the checkpoint, keeping what was bought there', async () => {
      const harness = createHarness();
      harness.session.setLevel(3);
      harness.runtime.score = 20_000;
      harness.flow.handleBossDefeated(3, false);
      harness.advance(10);
      harness.continueDebrief();
      expect(harness.log).toContain('hangar:4');
      const levelOf = (save: CampaignSaveData): number =>
        (save.upgrades.upgrades as Record<string, number> | undefined)?.[UpgradeType.MAX_HEALTH] ??
        0;
      expect(levelOf(savedCheckpoint())).toBe(0);

      // 机库里花点数买升级，再“出击”
      const upgrades = harness.stats.getUpgrades();
      upgrades.awardBonusPoints(5);
      expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
      const pointsLeft = upgrades.getAvailablePoints();
      harness.launchHangar();

      const save = savedCheckpoint();
      expect(save.checkpoint).toBe('hangar');
      expect(save.level).toBe(4);
      expect(levelOf(save)).toBe(1);
      expect(save.upgrades.availablePoints).toBe(pointsLeft);

      // 然后才是第 4 章开场
      await flushPromises();
      expect(lastCall(harness.fake, 'showChapterIntro')?.[0]).toBe(4);
    });

    it('resuming a hangar checkpoint goes hangar → chapter intro → combat', async () => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'hangar', level: 4, wave: 0, score: 30_000 }));
      const harness = createHarness();
      harness.runtime.score = 30_000;

      harness.flow.resumeFromCheckpoint(savedCheckpoint());
      await flushPromises();
      expect(harness.log).toEqual(['hangar:4']);

      harness.launchHangar();
      await flushPromises();
      harness.finishIntro();
      await flushPromises();

      const order = ['hangar:4', 'intro:4', 'combat:4:0'].map((entry) =>
        harness.log.indexOf(entry)
      );
      expect(
        order.every((index) => index >= 0),
        harness.log.join(' → ')
      ).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(harness.log.some((entry) => entry.startsWith('boss:'))).toBe(false);
      expect(harness.session.getLevel()).toBe(4);
    });

    it('old checkpoint kinds still resume into their wave or boss fight', async () => {
      const totalWaves = getLevelConfig(5)?.totalWaves ?? 0;
      expect(totalWaves).toBeGreaterThan(2);

      saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 5, wave: 2 }));
      const waveHarness = createHarness();
      waveHarness.flow.resumeFromCheckpoint(savedCheckpoint());
      await flushPromises();
      expect(waveHarness.log).toEqual(['prepare:5:2', 'combat:5:2']);

      saveCampaignCheckpoint(makeSave({ checkpoint: 'boss', level: 5, wave: totalWaves }));
      const bossHarness = createHarness();
      bossHarness.flow.resumeFromCheckpoint(savedCheckpoint());
      await flushPromises();
      expect(bossHarness.log).toEqual([`prepare:5:${totalWaves - 1}`, 'boss:5']);
    });

    it('level 10: the boss kill completes the campaign and clears the checkpoint', async () => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'boss', level: TOTAL_LEVELS, wave: 8 }));
      const harness = createHarness();
      harness.session.setLevel(TOTAL_LEVELS);
      harness.runtime.score = 99_000;

      harness.flow.handleBossDefeated(TOTAL_LEVELS, false);
      expect(loadCampaignCheckpoint()).toBeNull();
      expect(window.localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();
      expect(getCampaignProgress().completed).toBe(true);

      harness.advance(10);
      harness.continueDebrief();
      const ending = lastCall(harness.fake, 'showEnding');
      expect(ending, 'the ending plays').not.toBeNull();
      ((ending as unknown[])[1] as () => void)();
      expect(harness.log).toContain('mission-complete:99000');
      expect(loadCampaignCheckpoint()).toBeNull();
    });

    it.each([3, TOTAL_LEVELS])('boss mode never saves (boss %i)', (level) => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 2, wave: 1, score: 1234 }));
      const before = window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
      const harness = createHarness('boss');
      harness.session.setLevel(level);
      harness.runtime.score = 50_000;

      harness.flow.handleBossDefeated(level, true);
      harness.advance(10);
      if (level < TOTAL_LEVELS) {
        harness.launchHangar();
      }

      expect(window.localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBe(before);
      expect(countCalls(harness.fake, 'showAutosave')).toBe(0);
      expect(getCampaignProgress().completed).toBe(false);
    });
  });

  describe("Swift's join line", () => {
    function joinLines(harness: Harness): number {
      return harness.fake.calls.filter(
        ([name, args]) => name === 'onWingmanEvent' && args[0] === 'swift' && args[1] === 'joined'
      ).length;
    }

    it('plays the first time Swift launches in a run, and never again in that run', () => {
      const harness = createHarness();
      harness.flow.setupNewRun(3);
      harness.flow.handleWingmanLaunched('raven');
      harness.flow.handleWingmanLaunched('swift');
      expect(joinLines(harness)).toBe(1);

      harness.flow.handleWingmanLaunched('swift');
      harness.flow.handleWingmanLaunched('swift');
      expect(joinLines(harness)).toBe(1);
      expect(
        harness.fake.calls.some(([name, args]) => name === 'onWingmanEvent' && args[0] === 'raven')
      ).toBe(false);
    });

    it('plays again in a new run', () => {
      const harness = createHarness();
      harness.flow.setupNewRun(3);
      harness.flow.handleWingmanLaunched('swift');
      harness.flow.setupNewRun(3);
      harness.flow.handleWingmanLaunched('swift');
      expect(joinLines(harness)).toBe(2);
    });

    it('is recorded in the checkpoint at once, so Continue does not replay it', () => {
      const first = createHarness();
      saveCampaignCheckpoint(makeSave({ checkpoint: 'level-start', level: 3, wave: 0 }));
      first.flow.handleWingmanLaunched('swift');
      expect(joinLines(first)).toBe(1);
      expect(savedCheckpoint().swiftJoined).toBe(true);

      const resumed = createHarness();
      resumed.flow.resumeFromCheckpoint(savedCheckpoint());
      resumed.flow.handleWingmanLaunched('swift');
      expect(joinLines(resumed)).toBe(0);
    });

    it('checkpoints written later in the run keep the flag', () => {
      const harness = createHarness();
      harness.flow.setupNewRun(3);
      harness.flow.handleWingmanLaunched('swift');
      harness.session.setLevel(3);
      harness.flow.handleBossDefeated(3, false);
      expect(savedCheckpoint().swiftJoined).toBe(true);
    });

    it.each([
      [4, true],
      [7, true],
      [3, false],
    ] as const)(
      'an old save without the flag at level %i counts as announced: %s',
      (level, announced) => {
        // 旧存档：没有 swiftJoined 字段
        saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level, wave: 1 }));
        const save = savedCheckpoint();
        expect(save.swiftJoined).toBeUndefined();

        const harness = createHarness();
        harness.flow.resumeFromCheckpoint(save);
        harness.flow.handleWingmanLaunched('swift');
        expect(joinLines(harness)).toBe(announced ? 0 : 1);
      }
    );

    it('a save that says she has not joined yet still gets the line once', () => {
      saveCampaignCheckpoint(
        makeSave({ checkpoint: 'boss', level: 5, wave: 7, swiftJoined: false })
      );
      const harness = createHarness();
      harness.flow.resumeFromCheckpoint(savedCheckpoint());
      harness.flow.handleWingmanLaunched('swift');
      harness.flow.handleWingmanLaunched('swift');
      expect(joinLines(harness)).toBe(1);
    });

    it('never plays in boss mode', () => {
      const harness = createHarness('boss');
      harness.flow.setupNewRun(5);
      harness.flow.handleWingmanLaunched('swift');
      expect(joinLines(harness)).toBe(0);
    });
  });

  describe('autosave toasts are localizable (wave 2)', () => {
    afterEach(() => {
      resetLocale();
    });

    /** 存档提示的原始参数（交给 HUD 的 HudText） */
    function toastLabels(harness: Harness): unknown[] {
      return harness.fake.calls
        .filter(([name]) => name === 'showAutosave')
        .map(([, args]) => args[0]);
    }

    function isTextWithParams(
      value: unknown
    ): value is { text: LocalizedText; params?: TextParams } {
      const text = (value as { text?: unknown } | null)?.text as LocalizedText | undefined;
      return typeof text?.en === 'string' && typeof text?.zh === 'string';
    }

    /** 按两种语言展开一条 { text, params } 提示 */
    function render(value: unknown): { en: string; zh: string } {
      expect(isTextWithParams(value), `a { text, params } label: ${JSON.stringify(value)}`).toBe(
        true
      );
      const { text, params } = value as { text: LocalizedText; params?: TextParams };
      setLocale('en');
      const en = tr(text, params);
      setLocale('zh-CN');
      const zh = tr(text, params);
      resetLocale();
      return { en, zh };
    }

    it('a wave checkpoint toast is { text, params } naming the level and the next wave', () => {
      const harness = createHarness();
      harness.session.setLevel(4);
      harness.flow.handleWaveComplete(1);
      const [label] = toastLabels(harness);
      const { en, zh } = render(label);
      expect(en).toContain('4');
      expect(en).toMatch(/Wave 3/);
      expect(zh).toContain('第4关');
      expect(zh).toContain('第3波');
    });

    it('a before-the-boss toast is { text, params } naming the level', () => {
      const harness = createHarness();
      harness.session.setLevel(5);
      harness.flow.handleLevelComplete(5);
      const [label] = toastLabels(harness);
      const { en, zh } = render(label);
      expect(en).toContain('5');
      expect(zh).toContain('第5关');
      expect(en).not.toBe(zh);
    });

    it('the boss-kill toast says "Level N cleared" for the level just beaten, as { text, params }', () => {
      const harness = createHarness();
      harness.session.setLevel(3);
      harness.flow.handleBossDefeated(3, false);
      const labels = toastLabels(harness);
      expect(labels).toHaveLength(1);
      const { en, zh } = render(labels[0]);
      expect(en).toMatch(/Level 3 cleared/);
      expect(zh).toContain('第3关');
      expect(en).not.toMatch(/\b4\b/);
    });

    it.each<[string, Partial<CampaignCheckpointInput>]>([
      ['wave', { checkpoint: 'wave', level: 5, wave: 2 }],
      ['boss', { checkpoint: 'boss', level: 5, wave: 7 }],
    ])(
      '"Resumed: …" for a %s checkpoint carries both languages of the checkpoint',
      async (_kind, overrides) => {
        saveCampaignCheckpoint(makeSave(overrides));
        const save = savedCheckpoint();
        const harness = createHarness();
        harness.flow.resumeFromCheckpoint(save);
        await flushPromises();

        const [label] = toastLabels(harness);
        const text = label as LocalizedText;
        expect(typeof text?.en, 'a bilingual { en, zh } label').toBe('string');
        expect(typeof text?.zh).toBe('string');
        expect(text.en).toContain(describeCheckpoint(save, 'en'));
        expect(text.en).toMatch(/^Resumed/);
        expect(text.zh).toContain(describeCheckpoint(save, 'zh-CN'));
        expect(text.zh).toMatch(/^继续/);
      }
    );
  });

  describe('boss outro', () => {
    function defeatBoss(backlog: number, radioBusy: boolean): Harness {
      const harness = createHarness();
      harness.session.setLevel(4);
      harness.fake.state.backlog = backlog;
      harness.fake.state.radioBusy = radioBusy;
      harness.flow.handleBossDefeated(4, false);
      return harness;
    }

    /** 推进直到结算出现，返回所用的战斗时间（上限 maxSeconds） */
    function secondsUntilDebrief(harness: Harness, maxSeconds = 200, dt = 0.05): number {
      let elapsed = 0;
      while (countCalls(harness.fake, 'showDebrief') === 0 && elapsed < maxSeconds) {
        harness.flow.tick(dt);
        elapsed += dt;
      }
      return elapsed;
    }

    it('waits until the radio has delivered every boss-defeated line', () => {
      const harness = defeatBoss(30, true);
      harness.advance(20);
      expect(countCalls(harness.fake, 'showDebrief'), 'radio still talking').toBe(0);

      harness.fake.state.radioBusy = false;
      harness.advance(0.2);
      expect(countCalls(harness.fake, 'showDebrief')).toBe(1);
    });

    it('watchdog: a radio that never goes idle releases the debrief at backlog + 6 s', () => {
      const harness = defeatBoss(20, true);
      const seconds = secondsUntilDebrief(harness);
      expect(seconds).toBeGreaterThanOrEqual(26 - 0.1);
      expect(seconds).toBeLessThanOrEqual(26 + 0.1);
    });

    it('watchdog is capped at 75 s however long the backlog', () => {
      const harness = defeatBoss(500, true);
      const seconds = secondsUntilDebrief(harness);
      expect(seconds).toBeGreaterThan(74);
      expect(seconds).toBeLessThanOrEqual(75 + 0.1);
    });

    it.each([Number.NaN, Infinity, -5])('never hangs, even with a backlog of %s', (backlog) => {
      const harness = defeatBoss(backlog, true);
      expect(secondsUntilDebrief(harness)).toBeLessThanOrEqual(75 + 0.1);
    });

    it('with a quiet radio the debrief follows after a short pause', () => {
      const harness = defeatBoss(0, false);
      const seconds = secondsUntilDebrief(harness);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(6);
    });
  });
});
