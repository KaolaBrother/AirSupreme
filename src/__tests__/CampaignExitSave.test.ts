import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CampaignFlowController,
  type CampaignExitSave,
  type CampaignFlowDeps,
} from '@/core/campaign/CampaignFlowController';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { GameSessionState } from '@/core/GameSessionState';
import {
  CAMPAIGN_SAVE_KEY,
  CAMPAIGN_SAVE_VERSION,
  describeCheckpoint,
  loadCampaignCheckpoint,
  saveCampaignCheckpoint,
  type CampaignCheckpointInput,
  type CampaignSaveData,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
import {
  DEFAULT_START_FLOW_SETTINGS,
  type CameraModeSetting,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { TOTAL_LEVELS, getCampaignChapter } from '@/features/campaign/CampaignData';
import { getLevelConfig } from '@/features/terrain/LevelConfig';
import { PlayerStats, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import type { WeaponSaveState } from '@/features/weapons/WeaponSystem';
import { setLocale, type Locale } from '@/i18n';
import { PauseMenu } from '@/ui/PauseMenu';
import { LOCALES, expectBilingual, resetLocale, textIn } from './i18nTestUtils';

/**
 * “保存并退出”的战役侧（CampaignFlowController.describeExitSave / saveForExit），按规格 S1-S4：
 * - S1 describeExitSave 是只读预告：不写存储、不触发任何演出；
 * - S2 saveForExit 把此刻的状态静默写在当前进度的检查点位置上，读回确认；写不进去 / 读不回来是 'failed'，
 *   原有检查点保持不变；存档结构、版本、键名不变；
 * - S3 各个时刻退出会存到哪里（“继续战役”从哪里开始）；
 * - S4 往返：存 → loadCampaignCheckpoint → 读档续玩。
 * 最后一组把暂停菜单接到控制器上（协调器的接线由别的批次完成，这里按规格直接接两个回调）。
 * 存储用 jsdom 的真实 localStorage；写入失败用 setItem 抛错模拟。协调器的部分用记录调用的替身。
 */

type PresentationCall = [method: string, args: unknown[]];

/** 只读查询，不算演出 */
const PRESENTATION_QUERIES: Readonly<Record<string, () => unknown>> = {
  isRadioBusy: () => false,
  getRadioBacklogSeconds: () => 0,
  isStoryActive: () => false,
  isWingmanFlying: () => false,
};

interface FakePresentation {
  presentation: ICampaignPresentation;
  /** 所有演出调用（存档提示、刺激音、无线电、卡片…），按发生顺序 */
  effects: PresentationCall[];
}

function createPresentation(): FakePresentation {
  const effects: PresentationCall[] = [];
  const presentation = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') return undefined;
        const name = String(key);
        const query = PRESENTATION_QUERIES[name];
        if (query) return query;
        return (...args: unknown[]) => {
          effects.push([name, args]);
          return name === 'genericRadio' ? true : undefined;
        };
      },
    }
  ) as ICampaignPresentation;
  return { presentation, effects };
}

/** 协调器侧的运行时状态（captureCheckpoint 的来源）：测试里随时改，模拟“上次自动存档之后又打了一阵” */
interface RunState {
  difficulty: number;
  score: number;
  lives: number;
  missiles: number;
  weapons: WeaponSaveState;
  flares: number;
  cameraMode: CameraModeSetting;
}

interface Harness {
  flow: CampaignFlowController;
  session: GameSessionState;
  stats: PlayerStats;
  fake: FakePresentation;
  run: RunState;
  /** 协调器侧的调用顺序：'hangar:4'、'prepare:4:0'、'combat:4:0'、'boss:5'… */
  log: string[];
  /** 机库“出击” */
  launchHangar(): void;
  /** 章节开场卡片放完 */
  finishIntro(): void;
  /** 结算卡片“继续” */
  continueDebrief(): void;
  /** 推进战斗时间（秒） */
  advance(seconds: number): void;
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function lastEffect(fake: FakePresentation, method: string): unknown[] | null {
  for (let i = fake.effects.length - 1; i >= 0; i--) {
    if (fake.effects[i][0] === method) return fake.effects[i][1];
  }
  return null;
}

function effectNames(fake: FakePresentation, from = 0): string[] {
  return fake.effects.slice(from).map(([name]) => name);
}

function createHarness(mode: 'normal' | 'boss' = 'normal'): Harness {
  const session = new GameSessionState();
  session.setMode(mode);
  session.setPlaying();
  const stats = new PlayerStats();
  const fake = createPresentation();
  const log: string[] = [];
  const run: RunState = {
    difficulty: 3,
    score: 0,
    lives: 3,
    missiles: 4,
    weapons: { unlocked: [], selected: null, ammo: {} },
    flares: 2,
    cameraMode: 'third-person',
  };
  let hangarContinue: (() => void) | null = null;
  const self: { flow: CampaignFlowController | null } = { flow: null };

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
    // 与协调器一样：此刻的运行时快照，统计取自战役流程
    captureCheckpoint: (kind: CheckpointKind, level: number, wave: number) =>
      ({
        checkpoint: kind,
        level,
        wave,
        difficulty: run.difficulty,
        score: run.score,
        lives: run.lives,
        missiles: run.missiles,
        upgrades: stats.getUpgrades().export(),
        weapons: {
          unlocked: [...run.weapons.unlocked],
          selected: run.weapons.selected,
          ammo: { ...run.weapons.ammo },
        },
        flares: run.flares,
        cameraMode: run.cameraMode,
        stats: self.flow?.getRunStats() ?? {
          kills: 0,
          civiliansLost: 0,
          deaths: 0,
          playTimeSeconds: 0,
        },
      }) satisfies CampaignCheckpointInput,
    getScore: () => run.score,
  };
  const flow = new CampaignFlowController(deps);
  self.flow = flow;

  return {
    flow,
    session,
    stats,
    fake,
    run,
    log,
    launchHangar: () => {
      expect(hangarContinue, 'the hangar is showing').not.toBeNull();
      const next = hangarContinue as () => void;
      hangarContinue = null;
      next();
    },
    finishIntro: () => {
      const args = lastEffect(fake, 'showChapterIntro');
      expect(args, 'a chapter intro is showing').not.toBeNull();
      ((args as unknown[])[2] as () => void)();
    },
    continueDebrief: () => {
      const args = lastEffect(fake, 'showDebrief');
      expect(args, 'the debrief is showing').not.toBeNull();
      ((args as unknown[])[1] as () => void)();
    },
    advance: (seconds: number) => {
      const dt = 0.1;
      for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
        flow.tick(dt);
      }
    },
  };
}

// ───────────────────────────── 把一局推进到某个时刻 ─────────────────────────────

function totalWavesOf(level: number): number {
  const total = getLevelConfig(level)?.totalWaves ?? 0;
  expect(total, `level ${level} has several waves`).toBeGreaterThan(2);
  return total;
}

/** 新开一局，停在章节开场卡片上（还没到第一个检查点）；起始关卡 > 1 时先过机库 */
async function beginRun(h: Harness, level = 1): Promise<void> {
  h.flow.setupNewRun(level);
  h.flow.beginNewRun(level);
  await flushPromises();
  if (level > 1) {
    h.launchHangar();
    await flushPromises();
  }
}

/** 开场卡片放完：入关检查点已写，第一波进行中 */
async function enterCombat(h: Harness, level = 1): Promise<void> {
  await beginRun(h, level);
  h.finishIntro();
}

/** 打完第 0..count-1 波（每波：开始 → 清空） */
function clearWaves(h: Harness, count: number): void {
  for (let wave = 0; wave < count; wave++) {
    h.flow.handleWaveStart(wave);
    h.flow.handleWaveComplete(wave);
  }
}

/** 打完全部波次、进入 Boss 战（Boss 检查点已写） */
async function enterBossFight(h: Harness, level: number): Promise<void> {
  await enterCombat(h, level);
  clearWaves(h, totalWavesOf(level));
  h.flow.handleLevelComplete(level);
  h.session.setInBossBattle(true);
}

/** 击破这一关的 Boss（收尾台词还在播） */
async function defeatBoss(h: Harness, level: number): Promise<void> {
  await enterBossFight(h, level);
  h.session.setInBossBattle(false);
  h.flow.handleBossDefeated(level, false);
}

/** 上次自动存档之后又打了一阵：分数、生命、导弹、武器与弹药、热焰弹、视角、升级点、统计都变了 */
function playOn(h: Harness): void {
  h.run.score += 2_350;
  h.run.lives = 2;
  h.run.missiles = 1;
  h.run.flares = 0;
  h.run.cameraMode = 'first-person';
  h.run.weapons = { unlocked: ['rockets', 'laser'], selected: 'laser', ammo: { rockets: 3 } };
  h.stats.getUpgrades().awardBonusPoints(7);
  h.flow.recordKill();
  h.flow.recordKill();
  h.flow.recordAssetLost(true);
  h.flow.recordDeath();
  // 不到 Boss 收尾的最短停顿，不会顺带把流程往前推
  h.flow.tick(0.5);
}

// ───────────────────────────── 存储 ─────────────────────────────

function makeSave(overrides: Partial<CampaignCheckpointInput> = {}): CampaignCheckpointInput {
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

function storedCheckpoint(): CampaignSaveData {
  const save = loadCampaignCheckpoint();
  expect(save, 'a checkpoint is stored').not.toBeNull();
  return save as CampaignSaveData;
}

function rawCheckpoint(): string | null {
  return window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
}

function storageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key !== null) {
      snapshot[key] = window.localStorage.getItem(key) ?? '';
    }
  }
  return snapshot;
}

interface StorageWrites {
  setItem: ReturnType<typeof vi.spyOn>;
  expectNone(where: string): void;
}

/** 监视真实 localStorage 的写操作（写入照常执行） */
function watchStorageWrites(): StorageWrites {
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
  const clear = vi.spyOn(Storage.prototype, 'clear');
  return {
    setItem,
    expectNone: (where: string) => {
      expect(setItem, `${where}: setItem`).not.toHaveBeenCalled();
      expect(removeItem, `${where}: removeItem`).not.toHaveBeenCalled();
      expect(clear, `${where}: clear`).not.toHaveBeenCalled();
    },
  };
}

/** 存储写不进去（配额已满 / 隐私模式）：setItem 抛错，已有内容保持原样 */
function breakStorageWrites(): void {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
}

/** 存储悄悄丢弃写入：setItem 不抛错也不落盘，已有内容保持原样，读取照常 */
function dropStorageWrites(): void {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
}

/** 固定时钟用的时刻（Date.now 毫秒）：让“存档时间”在测试里是确定的 */
const FROZEN_NOW = 1_760_000_000_000;

const ORIGINAL_STORAGE = Object.getOwnPropertyDescriptor(window, 'localStorage');

function restoreStorage(): void {
  if (ORIGINAL_STORAGE) {
    Object.defineProperty(window, 'localStorage', ORIGINAL_STORAGE);
  }
}

// ───────────────────────────── 结果断言 ─────────────────────────────

type SavedExit = Extract<CampaignExitSave, { kind: 'saved' }>;
type UnsavedKind = Exclude<CampaignExitSave['kind'], 'saved' | 'failed'>;

interface SavePoint {
  stage: CheckpointKind;
  level: number;
  wave: number;
}

function expectSaved(result: CampaignExitSave, stage: CheckpointKind): SavedExit {
  expect(result.kind).toBe('saved');
  const saved = result as SavedExit;
  expect(saved.stage).toBe(stage);
  expectBilingual(saved.position, 'the save point description');
  return saved;
}

/** 这个存档点的双语描述（开始菜单“继续战役”卡片上显示的同一句） */
function describePoint(point: SavePoint, locale: Locale): string {
  const save: CampaignSaveData = {
    version: CAMPAIGN_SAVE_VERSION,
    savedAt: 0,
    ...makeSave({ checkpoint: point.stage, level: point.level, wave: point.wave }),
  };
  return describeCheckpoint(save, locale);
}

function expectOutcome(result: CampaignExitSave, expected: SavePoint | UnsavedKind): void {
  if (typeof expected === 'string') {
    expect(result.kind).toBe(expected);
    return;
  }
  const saved = expectSaved(result, expected.stage);
  expect(saved.position.en).toBe(describePoint(expected, 'en'));
  expect(saved.position.zh).toBe(describePoint(expected, 'zh-CN'));
}

/** 检查点里是此刻的状态，而不是上一次自动存档时的 */
function expectCurrentState(save: CampaignSaveData, h: Harness): void {
  expect(save.score, 'score').toBe(h.run.score);
  expect(save.lives, 'lives').toBe(h.run.lives);
  expect(save.missiles, 'missiles').toBe(h.run.missiles);
  expect(save.flares, 'flares').toBe(h.run.flares);
  expect(save.cameraMode, 'camera mode').toBe(h.run.cameraMode);
  expect(save.difficulty, 'difficulty').toBe(h.run.difficulty);
  expect(save.weapons, 'special weapons and ammo').toEqual(h.run.weapons);
  expect(save.upgrades, 'upgrades').toEqual(
    JSON.parse(JSON.stringify(h.stats.getUpgrades().export()))
  );
  expect(save.stats, 'run stats').toEqual(h.flow.getRunStats());
}

function upgradeLevel(save: CampaignSaveData, type: UpgradeType): number {
  return (save.upgrades.upgrades as Record<string, number> | undefined)?.[type] ?? 0;
}

// ───────────────────────────── 各个时刻 ─────────────────────────────

interface Scenario {
  name: string;
  mode?: 'boss';
  /** 把一局推进到这个时刻；返回此刻退出应当存到哪里，或者为什么不存 */
  arrange(h: Harness): Promise<SavePoint | UnsavedKind>;
}

const SCENARIOS: readonly Scenario[] = [
  {
    name: 'a new run still on its opening chapter card',
    arrange: async (h) => {
      await beginRun(h, 1);
      return 'not-started';
    },
  },
  {
    name: 'a new run started at level 4, still in the hangar',
    arrange: async (h) => {
      h.flow.setupNewRun(4);
      h.flow.beginNewRun(4);
      await flushPromises();
      return 'not-started';
    },
  },
  {
    name: 'the first wave, after the level-start checkpoint',
    arrange: async (h) => {
      await enterCombat(h, 1);
      h.flow.handleWaveStart(0);
      return { stage: 'level-start', level: 1, wave: 0 };
    },
  },
  {
    name: 'between the first and the second wave',
    arrange: async (h) => {
      await enterCombat(h, 1);
      clearWaves(h, 1);
      return { stage: 'wave', level: 1, wave: 1 };
    },
  },
  {
    name: 'the middle of the third wave',
    arrange: async (h) => {
      await enterCombat(h, 3);
      clearWaves(h, 2);
      h.flow.handleWaveStart(2);
      return { stage: 'wave', level: 3, wave: 2 };
    },
  },
  {
    name: 'the last wave cleared, before the boss checkpoint is written',
    arrange: async (h) => {
      await enterCombat(h, 2);
      clearWaves(h, totalWavesOf(2));
      return { stage: 'boss', level: 2, wave: totalWavesOf(2) };
    },
  },
  {
    name: 'the boss briefing',
    arrange: async (h) => {
      await enterCombat(h, 2);
      clearWaves(h, totalWavesOf(2));
      h.flow.handleLevelComplete(2);
      return { stage: 'boss', level: 2, wave: totalWavesOf(2) };
    },
  },
  {
    name: 'the boss fight',
    arrange: async (h) => {
      await enterBossFight(h, 6);
      return { stage: 'boss', level: 6, wave: totalWavesOf(6) };
    },
  },
  {
    name: 'a defeated level 4 boss, outro lines still playing',
    arrange: async (h) => {
      await defeatBoss(h, 4);
      return { stage: 'hangar', level: 5, wave: 0 };
    },
  },
  {
    name: 'the hangar after the level 4 debrief',
    arrange: async (h) => {
      await defeatBoss(h, 4);
      h.advance(10);
      h.continueDebrief();
      expect(h.log).toContain('hangar:5');
      return { stage: 'hangar', level: 5, wave: 0 };
    },
  },
  {
    name: 'the next chapter card, after launching from the hangar',
    arrange: async (h) => {
      await defeatBoss(h, 4);
      h.advance(10);
      h.continueDebrief();
      h.launchHangar();
      await flushPromises();
      expect(lastEffect(h.fake, 'showChapterIntro')?.[0]).toBe(5);
      return { stage: 'hangar', level: 5, wave: 0 };
    },
  },
  {
    name: 'a defeated level 9 boss',
    arrange: async (h) => {
      await defeatBoss(h, 9);
      return { stage: 'hangar', level: 10, wave: 0 };
    },
  },
  {
    name: 'the defeated final boss',
    arrange: async (h) => {
      await defeatBoss(h, TOTAL_LEVELS);
      return 'complete';
    },
  },
  {
    name: 'a new run started after finishing the campaign',
    arrange: async (h) => {
      await defeatBoss(h, TOTAL_LEVELS);
      await beginRun(h, 1);
      return 'not-started';
    },
  },
  {
    name: 'a checkpoint that was just resumed',
    arrange: async (h) => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 5, wave: 3 }));
      h.flow.resumeFromCheckpoint(storedCheckpoint());
      return { stage: 'wave', level: 5, wave: 3 };
    },
  },
  {
    name: 'a boss practice fight',
    mode: 'boss',
    arrange: async (h) => {
      h.flow.setupNewRun(3);
      h.flow.beginNewRun(3);
      await flushPromises();
      h.launchHangar();
      await flushPromises();
      h.session.setInBossBattle(true);
      expect(h.log).toContain('boss:3');
      return 'no-save-mode';
    },
  },
];

describe('campaign exit save', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    restoreStorage();
    resetLocale();
    window.localStorage.clear();
  });

  // ───────────────────────────── S1 ─────────────────────────────

  describe('S1: describeExitSave is a read-only preview', () => {
    it.each(SCENARIOS)(
      'from $name: says where, writes nothing, shows nothing',
      async (scenario) => {
        const h = createHarness(scenario.mode);
        const expected = await scenario.arrange(h);
        playOn(h);
        const before = storageSnapshot();
        const effectsBefore = h.fake.effects.length;
        const logBefore = [...h.log];
        const writes = watchStorageWrites();

        const first = h.flow.describeExitSave();
        const second = h.flow.describeExitSave();

        expectOutcome(first, expected);
        expect(second, 'asking twice gives the same answer').toEqual(first);
        writes.expectNone('describeExitSave');
        expect(storageSnapshot()).toEqual(before);
        expect(effectNames(h.fake, effectsBefore), 'no toast, no sound, no radio').toEqual([]);
        expect(h.log, 'no level load, hangar or boss start').toEqual(logBefore);
      }
    );

    it('a saving run gets the stage and a bilingual position; the others only a kind', async () => {
      const h = createHarness();
      await enterCombat(h, 1);
      clearWaves(h, 1);

      const saved = expectSaved(h.flow.describeExitSave(), 'wave');
      // 第 1 关、下一波是第 2 波
      expect(saved.position.en).toContain(getCampaignChapter(1).title.en);
      expect(saved.position.en).toContain('Wave 2');
      expect(saved.position.zh).toContain(getCampaignChapter(1).title.zh);
      expect(saved.position.zh).toContain('第2波');

      expect(createHarness('boss').flow.describeExitSave()).toEqual({ kind: 'no-save-mode' });
      expect(createHarness().flow.describeExitSave()).toEqual({ kind: 'not-started' });
    });

    it('previews the run, not what happens to be stored', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 2);
      const preview = h.flow.describeExitSave();

      // 存储被别处清空 / 换成别的检查点：此刻退出仍然存到这一局所在的位置
      window.localStorage.clear();
      expect(h.flow.describeExitSave()).toEqual(preview);
      saveCampaignCheckpoint(makeSave({ checkpoint: 'boss', level: 8, wave: 7 }));
      expect(h.flow.describeExitSave()).toEqual(preview);
      expectOutcome(preview, { stage: 'wave', level: 3, wave: 2 });
    });

    it('what it previews is what saveForExit then reports and stores', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 2);
      playOn(h);

      const preview = h.flow.describeExitSave();
      const result = h.flow.saveForExit();

      expect(result).toEqual(preview);
      const save = storedCheckpoint();
      const saved = expectSaved(result, save.checkpoint);
      expect(saved.position.en).toBe(describeCheckpoint(save, 'en'));
      expect(saved.position.zh).toBe(describeCheckpoint(save, 'zh-CN'));
    });

    it('does not throw or write when the store is broken', async () => {
      const h = createHarness();
      await enterCombat(h, 1);
      const before = storageSnapshot();
      breakStorageWrites();

      expect(() => h.flow.describeExitSave()).not.toThrow();
      vi.restoreAllMocks();
      expect(storageSnapshot()).toEqual(before);
    });
  });

  // ───────────────────────────── S2 ─────────────────────────────

  describe('S2: saveForExit writes the current state at the current position', () => {
    it('stores score, lives, missiles, upgrades, weapons and ammo, flares, camera and stats as they are now', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 1);
      const autosave = storedCheckpoint();
      expect(autosave.score, 'the autosave was taken before any of this').toBe(0);

      h.run.score = 18_640;
      h.run.lives = 1;
      h.run.missiles = 2;
      h.run.flares = 1;
      h.run.cameraMode = 'first-person';
      h.run.weapons = {
        unlocked: ['rockets', 'laser', 'swarm'],
        selected: 'swarm',
        ammo: { rockets: 5, swarm: 1 },
      };
      const upgrades = h.stats.getUpgrades();
      upgrades.awardBonusPoints(6);
      expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
      const pointsLeft = upgrades.getAvailablePoints();
      for (let kill = 0; kill < 7; kill++) h.flow.recordKill();
      h.flow.recordAssetLost(true);
      h.flow.recordDeath();
      h.flow.recordDeath();
      h.flow.tick(42.5);

      expectSaved(h.flow.saveForExit(), 'wave');

      const save = storedCheckpoint();
      expect(save.score).toBe(18_640);
      expect(save.lives).toBe(1);
      expect(save.missiles).toBe(2);
      expect(save.flares).toBe(1);
      expect(save.cameraMode).toBe('first-person');
      expect(save.weapons).toEqual({
        unlocked: ['rockets', 'laser', 'swarm'],
        selected: 'swarm',
        ammo: { rockets: 5, swarm: 1 },
      });
      expect(upgradeLevel(save, UpgradeType.MAX_HEALTH)).toBe(1);
      expect(save.upgrades.availablePoints).toBe(pointsLeft);
      expect(save.stats).toEqual({
        kills: 7,
        civiliansLost: 1,
        deaths: 2,
        playTimeSeconds: 42.5,
      });
      expectCurrentState(save, h);
      // 位置没动：还是自动存档的那一波
      expect([save.checkpoint, save.level, save.wave]).toEqual(['wave', 3, 1]);
    });

    it('is silent where the autosave at the same moment is not', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      const beforeAutosave = h.fake.effects.length;
      h.flow.handleWaveStart(0);
      h.flow.handleWaveComplete(0);
      // 对照：波次自动存档有提示和 checkpoint 刺激音（替身确实记得住它们）
      expect(effectNames(h.fake, beforeAutosave)).toContain('showAutosave');
      expect(h.fake.effects.slice(beforeAutosave)).toContainEqual(['playStinger', ['checkpoint']]);

      const beforeExit = h.fake.effects.length;
      expectSaved(h.flow.saveForExit(), 'wave');
      expectSaved(h.flow.saveForExit(), 'wave');

      expect(effectNames(h.fake, beforeExit), 'no toast, no stinger, nothing').toEqual([]);
    });

    it('writes the same record the autosave writes: same key, version and fields', async () => {
      expect(CAMPAIGN_SAVE_KEY).toBe('air-supreme:campaign-save');
      expect(CAMPAIGN_SAVE_VERSION).toBe(1);
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 2);
      const autosave = JSON.parse(rawCheckpoint() ?? 'null') as Record<string, unknown>;
      playOn(h);
      const writes = watchStorageWrites();

      expectSaved(h.flow.saveForExit(), 'wave');

      const keysWritten = writes.setItem.mock.calls.map(([key]) => key);
      expect(keysWritten.length, 'the checkpoint is written').toBeGreaterThan(0);
      expect(new Set(keysWritten)).toEqual(new Set([CAMPAIGN_SAVE_KEY]));
      const exitSave = JSON.parse(rawCheckpoint() ?? 'null') as Record<string, unknown>;
      expect(exitSave.version).toBe(1);
      expect(Object.keys(exitSave).sort()).toEqual(Object.keys(autosave).sort());
      for (const [field, value] of Object.entries(autosave)) {
        expect(typeof exitSave[field], `type of ${field}`).toBe(typeof value);
      }
      expect(loadCampaignCheckpoint(), 'loads through the normal loader').not.toBeNull();
    });

    it("keeps Swift's join flag, so Continue does not replay her line", async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      h.flow.handleWingmanLaunched('swift');
      clearWaves(h, 1);

      expectSaved(h.flow.saveForExit(), 'wave');

      expect(storedCheckpoint().swiftJoined).toBe(true);
    });

    it('can be repeated and does not move the save point', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 2);
      const preview = h.flow.describeExitSave();

      const first = h.flow.saveForExit();
      h.run.score = 777;
      const second = h.flow.saveForExit();

      expect(second).toEqual(first);
      expect(h.flow.describeExitSave()).toEqual(preview);
      expect(storedCheckpoint().score).toBe(777);
      // 之后的自动存档照常推进并提示
      const effectsBefore = h.fake.effects.length;
      h.flow.handleWaveStart(2);
      h.flow.handleWaveComplete(2);
      expect(storedCheckpoint().wave).toBe(3);
      expect(effectNames(h.fake, effectsBefore)).toContain('showAutosave');
    });

    describe('when the store refuses', () => {
      it('a throwing setItem is "failed" and leaves the stored checkpoint intact', async () => {
        const h = createHarness();
        await enterCombat(h, 3);
        clearWaves(h, 2);
        const storedBefore = rawCheckpoint();
        expect(storedBefore).not.toBeNull();
        playOn(h);
        const effectsBefore = h.fake.effects.length;
        breakStorageWrites();

        let result: CampaignExitSave | null = null;
        expect(() => {
          result = h.flow.saveForExit();
        }).not.toThrow();

        expect(result).toEqual({ kind: 'failed' });
        vi.restoreAllMocks();
        expect(rawCheckpoint(), 'byte-identical to the last autosave').toBe(storedBefore);
        const save = storedCheckpoint();
        expect([save.checkpoint, save.wave, save.score]).toEqual(['wave', 2, 0]);
        expect(effectNames(h.fake, effectsBefore)).toEqual([]);
      });

      it('is "failed" with nothing stored when no write ever got through', async () => {
        breakStorageWrites();
        const h = createHarness();
        await enterCombat(h, 1);
        clearWaves(h, 1);

        expect(h.flow.saveForExit()).toEqual({ kind: 'failed' });

        vi.restoreAllMocks();
        expect(rawCheckpoint()).toBeNull();
      });

      it('is "failed" when localStorage itself is unavailable', async () => {
        const h = createHarness();
        await enterCombat(h, 1);
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get: () => {
            throw new Error('SecurityError');
          },
        });

        let result: CampaignExitSave | null = null;
        expect(() => {
          result = h.flow.saveForExit();
        }).not.toThrow();
        expect(result).toEqual({ kind: 'failed' });
      });

      it('is "failed" when the write goes through but cannot be read back', async () => {
        const h = createHarness();
        await enterCombat(h, 1);
        clearWaves(h, 1);
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('getItem denied');
        });

        expect(h.flow.saveForExit()).toEqual({ kind: 'failed' });
      });

      it('is "failed" when the store silently drops the write and nothing is stored', async () => {
        const h = createHarness();
        await enterCombat(h, 1);
        clearWaves(h, 1);
        window.localStorage.clear();
        dropStorageWrites();

        expect(h.flow.saveForExit()).toEqual({ kind: 'failed' });
        expect(rawCheckpoint()).toBeNull();
      });

      // “写入后读回确认”确认的是刚写的那一份：写入被悄悄丢弃（setItem 不抛错也不落盘）、
      // 读回来的还是存储里原有的旧检查点时，不能把旧检查点当成这次存档成功。
      it('is "failed" when the write is dropped and the read-back finds the older checkpoint', async () => {
        const h = createHarness();
        await enterCombat(h, 3);
        clearWaves(h, 2);
        const storedBefore = rawCheckpoint();
        h.flow.handleWaveStart(2);
        h.flow.handleWaveComplete(2);
        // 存储退回到上一波的自动存档，之后的写入被悄悄丢弃
        window.localStorage.setItem(CAMPAIGN_SAVE_KEY, storedBefore ?? '');
        playOn(h);
        dropStorageWrites();

        const result = h.flow.saveForExit();

        expect(rawCheckpoint(), 'nothing was written').toBe(storedBefore);
        // 读回来的不是刚写的那份（第 4 波、此刻的分数），不能报“已保存”
        expect(result).toEqual({ kind: 'failed' });
      });

      it('is "failed" when the dropped write and the older checkpoint share score and time but not the position', async () => {
        // 同一毫秒、分数也没变：只有位置（第 3 波 / 第 4 波）分得出读回来的是旧检查点
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        const h = createHarness();
        await enterCombat(h, 3);
        h.run.score = 3_000;
        clearWaves(h, 2);
        const storedBefore = rawCheckpoint();
        // 从这里起存储悄悄丢弃写入：下一波的自动存档也没落盘
        dropStorageWrites();
        h.flow.handleWaveStart(2);
        h.flow.handleWaveComplete(2);
        expectOutcome(h.flow.describeExitSave(), { stage: 'wave', level: 3, wave: 3 });

        const result = h.flow.saveForExit();

        expect(rawCheckpoint(), 'nothing was written').toBe(storedBefore);
        const stale = storedCheckpoint();
        expect([stale.checkpoint, stale.level, stale.wave, stale.score]).toEqual([
          'wave',
          3,
          2,
          3_000,
        ]);
        expect(result).toEqual({ kind: 'failed' });
      });

      it('is "failed" when the dropped write and the older checkpoint share the position but not the score', async () => {
        // 整个过程在同一毫秒里：存档时间分不出新旧，位置也一样，只有分数不同
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        const h = createHarness();
        await enterCombat(h, 3);
        h.run.score = 3_000;
        clearWaves(h, 2);
        const storedBefore = rawCheckpoint();
        expect(storedCheckpoint().savedAt).toBe(FROZEN_NOW);
        // 同一波里又加了分，然后退出
        h.flow.handleWaveStart(2);
        h.run.score = 4_200;
        expectOutcome(h.flow.describeExitSave(), { stage: 'wave', level: 3, wave: 2 });
        dropStorageWrites();

        const result = h.flow.saveForExit();

        expect(rawCheckpoint(), 'nothing was written').toBe(storedBefore);
        const stale = storedCheckpoint();
        expect([stale.checkpoint, stale.level, stale.wave, stale.score]).toEqual([
          'wave',
          3,
          2,
          3_000,
        ]);
        expect(result).toEqual({ kind: 'failed' });
      });

      it('is "failed" when the dropped write and the older checkpoint share position and score but not the time', async () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        const h = createHarness();
        await enterCombat(h, 3);
        h.run.score = 3_000;
        clearWaves(h, 2);
        const storedBefore = rawCheckpoint();
        // 五分钟之后：分数没变，但掉了两条命、买了升级——这些都没存上
        clock.mockReturnValue(FROZEN_NOW + 5 * 60_000);
        h.flow.handleWaveStart(2);
        h.run.lives = 1;
        const upgrades = h.stats.getUpgrades();
        upgrades.awardBonusPoints(6);
        expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
        dropStorageWrites();

        const result = h.flow.saveForExit();

        expect(rawCheckpoint(), 'nothing was written').toBe(storedBefore);
        const stale = storedCheckpoint();
        expect([stale.checkpoint, stale.level, stale.wave, stale.score]).toEqual([
          'wave',
          3,
          2,
          3_000,
        ]);
        expect([stale.lives, upgradeLevel(stale, UpgradeType.MAX_HEALTH)]).toEqual([3, 0]);
        expect(result).toEqual({ kind: 'failed' });
      });

      it.each([0, 1, 5 * 60_000])(
        'a write that lands is "saved" with the clock %i ms after the autosave',
        async (elapsed) => {
          // 对照：读回确认不能把真的写进去的存档判成失败（包括与自动存档落在同一毫秒）
          const clock = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
          const h = createHarness();
          await enterCombat(h, 3);
          h.run.score = 3_000;
          clearWaves(h, 2);
          clock.mockReturnValue(FROZEN_NOW + elapsed);
          h.flow.handleWaveStart(2);
          h.run.lives = 1;

          expectOutcome(h.flow.saveForExit(), { stage: 'wave', level: 3, wave: 2 });

          const save = storedCheckpoint();
          expect(save.savedAt).toBe(FROZEN_NOW + elapsed);
          expectCurrentState(save, h);
        }
      );

      it('a write that lands is "saved" when the store rounds a fractional score', async () => {
        const h = createHarness();
        await enterCombat(h, 3);
        clearWaves(h, 2);
        h.run.score = 7_350.5;

        expectOutcome(h.flow.saveForExit(), { stage: 'wave', level: 3, wave: 2 });

        const save = storedCheckpoint();
        expect(Number.isInteger(save.score)).toBe(true);
        expect(Math.abs(save.score - 7_350.5)).toBeLessThanOrEqual(0.5);
        expect([save.checkpoint, save.level, save.wave]).toEqual(['wave', 3, 2]);
      });

      it('saves at the same position once the store works again', async () => {
        const h = createHarness();
        await enterCombat(h, 3);
        clearWaves(h, 2);
        playOn(h);
        breakStorageWrites();
        expect(h.flow.saveForExit()).toEqual({ kind: 'failed' });
        vi.restoreAllMocks();

        expectOutcome(h.flow.saveForExit(), { stage: 'wave', level: 3, wave: 2 });
        expectCurrentState(storedCheckpoint(), h);
      });
    });
  });

  // ───────────────────────────── S3 ─────────────────────────────

  describe('S3: where leaving now saves', () => {
    it.each(SCENARIOS)('leaving from $name', async (scenario) => {
      const h = createHarness(scenario.mode);
      const expected = await scenario.arrange(h);
      playOn(h);
      const before = storageSnapshot();
      const effectsBefore = h.fake.effects.length;
      const logBefore = [...h.log];
      const writes = watchStorageWrites();

      const result = h.flow.saveForExit();

      expectOutcome(result, expected);
      expect(effectNames(h.fake, effectsBefore), 'silent').toEqual([]);
      expect(h.log, 'the run itself does not move').toEqual(logBefore);
      if (typeof expected === 'string') {
        writes.expectNone(`saveForExit (${expected})`);
        expect(storageSnapshot()).toEqual(before);
        return;
      }
      const save = storedCheckpoint();
      expect({ stage: save.checkpoint, level: save.level, wave: save.wave }).toEqual(expected);
      expectCurrentState(save, h);
    });

    it('a new run before its first checkpoint stores no checkpoint at all', async () => {
      // 上一局留下的检查点在新开一局时就被清掉了；此刻退出不会再写一个
      saveCampaignCheckpoint(makeSave({ checkpoint: 'boss', level: 7, wave: 7 }));
      const h = createHarness();
      await beginRun(h, 1);
      playOn(h);

      expect(h.flow.describeExitSave()).toEqual({ kind: 'not-started' });
      expect(h.flow.saveForExit()).toEqual({ kind: 'not-started' });

      expect(rawCheckpoint()).toBeNull();
      expect(loadCampaignCheckpoint()).toBeNull();
    });

    it('each wave moves the save point to the wave being played', async () => {
      const level = 5;
      const totalWaves = totalWavesOf(level);
      const h = createHarness();
      await enterCombat(h, level);
      expectOutcome(h.flow.describeExitSave(), { stage: 'level-start', level, wave: 0 });

      for (let wave = 0; wave + 1 < totalWaves; wave++) {
        h.flow.handleWaveStart(wave);
        h.flow.handleWaveComplete(wave);
        // 波次之间：即将打的那一波
        expectOutcome(h.flow.describeExitSave(), { stage: 'wave', level, wave: wave + 1 });
        h.flow.handleWaveStart(wave + 1);
        // 那一波打到一半：还是这一波
        h.run.score += 500;
        expectOutcome(h.flow.saveForExit(), { stage: 'wave', level, wave: wave + 1 });
        const save = storedCheckpoint();
        expect([save.checkpoint, save.wave, save.score]).toEqual(['wave', wave + 1, h.run.score]);
      }
    });

    it('after the last wave Continue goes to the boss, not back into the cleared wave', async () => {
      const level = 2;
      const totalWaves = totalWavesOf(level);
      const h = createHarness();
      await enterCombat(h, level);
      clearWaves(h, totalWaves);
      // 存储里还是最后一波之前的自动存档
      expect(storedCheckpoint().checkpoint).toBe('wave');
      expect(storedCheckpoint().wave).toBe(totalWaves - 1);
      h.run.score = 12_000;

      const saved = expectSaved(h.flow.saveForExit(), 'boss');
      expect(saved.position.en).toContain('Boss');
      expect(saved.position.en).not.toMatch(/Wave/);

      const save = storedCheckpoint();
      expect([save.checkpoint, save.level, save.wave]).toEqual(['boss', level, totalWaves]);
      expect(save.score).toBe(12_000);

      const next = createHarness();
      next.flow.resumeFromCheckpoint(save);
      await flushPromises();
      expect(next.log).toContain(`boss:${level}`);
      expect(next.log.some((entry) => entry.startsWith('combat:'))).toBe(false);
    });

    it('wave events during the boss fight do not move the save point', async () => {
      const level = 6;
      const h = createHarness();
      await enterBossFight(h, level);
      const point: SavePoint = { stage: 'boss', level, wave: totalWavesOf(level) };

      // Boss 战里的增援波次不是检查点
      h.flow.handleWaveStart(0);
      h.flow.handleWaveComplete(0);
      h.run.lives = 1;

      expectOutcome(h.flow.describeExitSave(), point);
      expectOutcome(h.flow.saveForExit(), point);
      const save = storedCheckpoint();
      expect([save.checkpoint, save.wave, save.lives]).toEqual(['boss', point.wave, 1]);
    });

    it('after a boss kill it saves the hangar of the next level with what was earned and bought since', async () => {
      const h = createHarness();
      await enterBossFight(h, 4);
      h.run.score = 30_000;
      h.session.setInBossBattle(false);
      h.flow.handleBossDefeated(4, false);
      h.advance(10);
      h.continueDebrief();
      // 结算之后、机库里：又加了分，买了升级，还没“出击”
      h.run.score = 31_500;
      const upgrades = h.stats.getUpgrades();
      upgrades.awardBonusPoints(6);
      expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
      expect(upgradeLevel(storedCheckpoint(), UpgradeType.MAX_HEALTH)).toBe(0);

      const saved = expectSaved(h.flow.saveForExit(), 'hangar');
      expect(saved.position.en).toContain(getCampaignChapter(5).title.en);
      expect(saved.position.en).toContain('Hangar');
      expect(saved.position.zh).toContain(getCampaignChapter(5).title.zh);
      expect(saved.position.zh).toContain('机库');

      const save = storedCheckpoint();
      expect([save.checkpoint, save.level, save.wave]).toEqual(['hangar', 5, 0]);
      expect(save.score).toBe(31_500);
      expect(upgradeLevel(save, UpgradeType.MAX_HEALTH)).toBe(1);
    });

    it('after the final boss nothing is stored and nothing is written', async () => {
      const h = createHarness();
      await defeatBoss(h, TOTAL_LEVELS);
      expect(rawCheckpoint(), 'the checkpoint is cleared on victory').toBeNull();
      const before = storageSnapshot();
      const writes = watchStorageWrites();

      expect(h.flow.describeExitSave()).toEqual({ kind: 'complete' });
      expect(h.flow.saveForExit()).toEqual({ kind: 'complete' });

      writes.expectNone('saveForExit after victory');
      expect(storageSnapshot()).toEqual(before);
      expect(rawCheckpoint()).toBeNull();
    });

    it('boss practice leaves the storage byte-identical from start to finish', async () => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 2, wave: 1, score: 1234 }));
      const before = storageSnapshot();
      expect(before[CAMPAIGN_SAVE_KEY]).toBeTruthy();
      const h = createHarness('boss');
      const leave = (): void => {
        expect(h.flow.describeExitSave()).toEqual({ kind: 'no-save-mode' });
        expect(h.flow.saveForExit()).toEqual({ kind: 'no-save-mode' });
        expect(storageSnapshot()).toEqual(before);
      };

      h.flow.setupNewRun(3);
      leave();
      h.flow.beginNewRun(3);
      await flushPromises();
      leave();
      h.launchHangar();
      await flushPromises();
      h.session.setInBossBattle(true);
      playOn(h);
      leave();
      h.session.setInBossBattle(false);
      h.flow.handleBossDefeated(3, true);
      leave();
      h.advance(10);
      leave();
      h.launchHangar();
      await flushPromises();
      leave();
    });

    it.each<[CheckpointKind, number, number]>([
      ['level-start', 2, 0],
      ['wave', 5, 3],
      ['boss', 5, 7],
      ['hangar', 8, 0],
    ])('resuming a %s checkpoint sets the save point at once', (kind, level, wave) => {
      saveCampaignCheckpoint(makeSave({ checkpoint: kind, level, wave, score: 9000 }));
      const save = storedCheckpoint();
      const h = createHarness();
      h.run.score = 9000;

      // 不等关卡加载完成
      h.flow.resumeFromCheckpoint(save);

      const point: SavePoint = { stage: kind, level, wave };
      expectOutcome(h.flow.describeExitSave(), point);
      playOn(h);
      expectOutcome(h.flow.saveForExit(), point);
      const rewritten = storedCheckpoint();
      expect([rewritten.checkpoint, rewritten.level, rewritten.wave]).toEqual([kind, level, wave]);
      expectCurrentState(rewritten, h);
    });

    it('starting a new run resets the save point to "not started"', async () => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 5, wave: 3 }));
      const h = createHarness();
      h.flow.resumeFromCheckpoint(storedCheckpoint());
      await flushPromises();
      expectSaved(h.flow.describeExitSave(), 'wave');

      h.flow.setupNewRun(1);
      expect(h.flow.describeExitSave()).toEqual({ kind: 'not-started' });
      h.flow.beginNewRun(1);
      await flushPromises();
      expect(h.flow.describeExitSave()).toEqual({ kind: 'not-started' });
      expect(h.flow.saveForExit()).toEqual({ kind: 'not-started' });
      expect(rawCheckpoint()).toBeNull();

      h.finishIntro();
      expectOutcome(h.flow.describeExitSave(), { stage: 'level-start', level: 1, wave: 0 });
    });
  });

  // ───────────────────────────── S4 ─────────────────────────────

  describe('S4: round trip', () => {
    it('a mid-wave exit save comes back with the changed score, lives and upgrades at the wave being played', async () => {
      const level = 3;
      const h = createHarness();
      await enterCombat(h, level);
      h.run.score = 5_000;
      clearWaves(h, 2);
      const autosave = storedCheckpoint();
      expect([autosave.checkpoint, autosave.wave, autosave.score, autosave.lives]).toEqual([
        'wave',
        2,
        5_000,
        3,
      ]);

      // 第 3 波打到一半：加分、掉了一条命、暂停菜单里买了升级
      h.flow.handleWaveStart(2);
      h.run.score = 7_350;
      h.run.lives = 2;
      const upgrades = h.stats.getUpgrades();
      upgrades.awardBonusPoints(6);
      expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
      expect(upgrades.upgrade(UpgradeType.DAMAGE)).toBe(true);
      const exported = JSON.parse(JSON.stringify(upgrades.export())) as Record<string, unknown>;

      expectSaved(h.flow.saveForExit(), 'wave');

      const loaded = storedCheckpoint();
      expect(loaded.version).toBe(CAMPAIGN_SAVE_VERSION);
      expect([loaded.checkpoint, loaded.level, loaded.wave]).toEqual(['wave', level, 2]);
      expect(loaded.score).toBe(7_350);
      expect(loaded.lives).toBe(2);
      expect(upgradeLevel(loaded, UpgradeType.MAX_HEALTH)).toBe(1);
      expect(upgradeLevel(loaded, UpgradeType.DAMAGE)).toBe(1);
      expect(loaded.upgrades).toEqual(exported);

      // “继续战役”：新的会话读这份存档，回到那一波的开头，升级还在
      const next = createHarness();
      next.stats.getUpgrades().import(loaded.upgrades);
      next.run.score = loaded.score;
      next.run.lives = loaded.lives;
      next.flow.resumeFromCheckpoint(loaded);
      await flushPromises();

      expect(next.log).toEqual([`prepare:${level}:2`, `combat:${level}:2`]);
      expect(next.stats.getUpgrades().getLevel(UpgradeType.MAX_HEALTH)).toBe(1);
      expect(next.stats.getUpgrades().getAvailablePoints()).toBe(upgrades.getAvailablePoints());
      expect(next.flow.getRunStats()).toEqual(loaded.stats);
      expectOutcome(next.flow.describeExitSave(), { stage: 'wave', level, wave: 2 });
    });

    it('saving again after Continue keeps the position and adds the new progress', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 2);
      h.run.score = 4_000;
      h.flow.recordKill();
      expectSaved(h.flow.saveForExit(), 'wave');

      const next = createHarness();
      const loaded = storedCheckpoint();
      next.run.score = loaded.score;
      next.flow.resumeFromCheckpoint(loaded);
      await flushPromises();
      next.run.score = 4_900;
      next.flow.recordKill();
      next.flow.recordKill();
      expectSaved(next.flow.saveForExit(), 'wave');

      const again = storedCheckpoint();
      expect([again.checkpoint, again.level, again.wave]).toEqual(['wave', 3, 2]);
      expect(again.score).toBe(4_900);
      expect(again.stats.kills).toBe(3);
    });
  });

  // ───────────────────────────── 接到暂停菜单上 ─────────────────────────────

  describe('wired to the pause menu', () => {
    const EXIT_LABELS = {
      saveAndExit: { en: 'Save & Exit', zh: '保存并退出' },
      mainMenu: { en: 'Main Menu', zh: '返回菜单' },
    };
    let menu: PauseMenu | null = null;
    let onExitToMenu: ReturnType<typeof vi.fn>;

    function openMenu(h: Harness): PauseMenu {
      const settings: StartFlowSettings = { ...DEFAULT_START_FLOW_SETTINGS };
      menu = new PauseMenu({
        onContinue: () => undefined,
        onUpgrade: () => undefined,
        onExitToMenu,
        getSaveStatus: () => h.flow.describeExitSave(),
        onSaveAndExit: () => h.flow.saveForExit(),
        applyAudio: () => undefined,
        applyQuality: () => undefined,
        loadSettings: () => ({ ...settings }),
        saveSettings: () => undefined,
      });
      menu.show();
      return menu;
    }

    function panelText(): string {
      return document.querySelector('#pause-menu .pause-panel')?.textContent ?? '';
    }

    function buttons(): HTMLButtonElement[] {
      return Array.from(document.querySelectorAll<HTMLButtonElement>('#pause-menu button'));
    }

    function buttonLabels(): string[] {
      return buttons().map((button) => (button.textContent ?? '').trim());
    }

    function clickButton(label: string): void {
      const button = buttons().find((candidate) => (candidate.textContent ?? '').trim() === label);
      expect(button, `a "${label}" button among ${buttonLabels().join(' / ')}`).toBeTruthy();
      (button as HTMLButtonElement).click();
    }

    beforeEach(() => {
      document.body.innerHTML = '';
      onExitToMenu = vi.fn();
      menu = null;
    });

    afterEach(() => {
      menu?.dispose();
      menu = null;
      document.body.innerHTML = '';
    });

    it.each(LOCALES)(
      'Save & Exit mid-wave stores the run as it is and then leaves (%s)',
      async (locale) => {
        setLocale(locale);
        const h = createHarness();
        await enterCombat(h, 3);
        clearWaves(h, 2);
        h.flow.handleWaveStart(2);
        playOn(h);
        const autosave = rawCheckpoint();
        openMenu(h);
        const saveAndExit = textIn(EXIT_LABELS.saveAndExit, locale);

        expect(buttonLabels()).toContain(saveAndExit);
        clickButton(saveAndExit);

        // 确认页说出存档点；这时什么都还没写
        expect(panelText()).toContain(describePoint({ stage: 'wave', level: 3, wave: 2 }, locale));
        expect(rawCheckpoint()).toBe(autosave);
        expect(onExitToMenu).not.toHaveBeenCalled();

        clickButton(saveAndExit);

        expect(onExitToMenu).toHaveBeenCalledTimes(1);
        const save = storedCheckpoint();
        expect([save.checkpoint, save.level, save.wave]).toEqual(['wave', 3, 2]);
        expectCurrentState(save, h);
      }
    );

    it('a full store stops on Save Failed, keeps the old checkpoint and leaves only on request', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 2);
      playOn(h);
      const autosave = rawCheckpoint();
      const autosaveDescription = describeCheckpoint(storedCheckpoint(), 'en');
      openMenu(h);
      clickButton('Save & Exit');
      breakStorageWrites();

      clickButton('Save & Exit');

      expect(onExitToMenu).not.toHaveBeenCalled();
      expect(panelText()).toContain('Save Failed');
      // “继续战役”还剩下的是上一次自动存档
      expect(panelText()).toContain(autosaveDescription);
      expect(buttonLabels()).toEqual(['Back', 'Exit Anyway']);

      clickButton('Exit Anyway');

      expect(onExitToMenu).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
      expect(rawCheckpoint()).toBe(autosave);
    });

    it('boss practice offers Main Menu, says it does not save and leaves the storage alone', async () => {
      saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 2, wave: 1, score: 1234 }));
      const before = storageSnapshot();
      const h = createHarness('boss');
      h.flow.setupNewRun(1);
      h.flow.beginNewRun(1);
      await flushPromises();
      openMenu(h);

      expect(buttonLabels()).toContain('Main Menu');
      expect(buttonLabels()).not.toContain('Save & Exit');
      clickButton('Main Menu');
      expect(panelText()).toContain('does not save');
      expect(buttonLabels()).toEqual(['Cancel', 'Exit']);
      clickButton('Exit');

      expect(onExitToMenu).toHaveBeenCalledTimes(1);
      expect(storageSnapshot()).toEqual(before);
    });

    it('a run that has not reached its first checkpoint leaves without writing one', async () => {
      const h = createHarness();
      await beginRun(h, 1);
      openMenu(h);

      expect(buttonLabels()).toContain('Main Menu');
      expect(buttonLabels()).not.toContain('Save & Exit');
      clickButton('Main Menu');
      expect(panelText()).toMatch(/nothing to save/i);
      clickButton('Exit');

      expect(onExitToMenu).toHaveBeenCalledTimes(1);
      expect(rawCheckpoint()).toBeNull();
    });

    it('a finished campaign leaves without bringing a checkpoint back', async () => {
      const h = createHarness();
      await defeatBoss(h, TOTAL_LEVELS);
      openMenu(h);

      expect(buttonLabels()).toContain('Main Menu');
      clickButton('Main Menu');
      expect(panelText()).toMatch(/campaign is complete/i);
      clickButton('Exit');

      expect(onExitToMenu).toHaveBeenCalledTimes(1);
      expect(rawCheckpoint()).toBeNull();
    });

    it('the exit label follows the run: Main Menu on the chapter card, Save & Exit once in combat', async () => {
      const h = createHarness();
      await beginRun(h, 1);
      const pauseMenu = openMenu(h);
      expect(buttonLabels()).toContain('Main Menu');
      pauseMenu.hide();

      h.finishIntro();
      pauseMenu.show();

      expect(buttonLabels()).toContain('Save & Exit');
      expect(buttonLabels()).not.toContain('Main Menu');
    });
  });
});

// ══════════════════════════════════ 后台存档 ══════════════════════════════════

/**
 * 后台存档的战役侧（CampaignFlowController.saveInBackground）：页面转入后台 / 关闭时，协调器让战役
 * 流程把此刻的进度写进检查点（iPad 的 Safari 会把后台标签页整个丢弃）。按规格 B1-B4：
 * - B1 写在哪、写什么：与“保存并退出”同一个键、同一种记录、同一个存档点，内容是此刻的状态；
 *   之后“继续战役”与保存并退出之后一样，从那一波 / Boss 战 / 机库重新开始；
 * - B2 什么时候不写：Boss 模式、还没到第一个检查点、战役已通关、本局已结束——存储一个字节都不动；
 *   章节卡片、结算、机库期间照样写（机库里买的升级靠它保住）；
 * - B3 生命数（与保存并退出唯一的不同）：转入后台不是玩家自己选的，不能让重试比被它覆盖的检查点
 *   更糟。存储里那份如果是同一个存档点（类型、关卡、波次都相同），写入的生命数取已存的与此刻的
 *   较大者；是别的存档点、没有、或读不出来，写此刻的生命数。“保存并退出”照旧写此刻的生命数；
 * - B4 对局原样继续：不触发任何演出，流程不动。
 * 页面事件、一次转入后台只写一次、协调器一侧的“对局不受影响”在 BackgroundCampaignSave.test.ts。
 */

/** 最后一波已清空、Boss 检查点还没写：存储里还是上一波的检查点，算另一个存档点 */
const BEFORE_BOSS_CHECKPOINT = 'the last wave cleared, before the boss checkpoint is written';

/** 存档里除了生命数和存档时间之外的全部内容 */
function withoutLivesAndTime(save: CampaignSaveData): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...save };
  delete rest.lives;
  delete rest.savedAt;
  return rest;
}

/** “继续战役”读这份存档后，流程往协调器发了哪些指令 */
async function resumeLog(save: CampaignSaveData): Promise<string[]> {
  const next = createHarness();
  next.flow.resumeFromCheckpoint(save);
  await flushPromises();
  return next.log;
}

function pointOf(save: CampaignSaveData): SavePoint {
  return { stage: save.checkpoint, level: save.level, wave: save.wave };
}

/** 第 3 关第 3 波打到一半；这一波开始时的检查点里是 livesAtCheckpoint 条命 */
async function midThirdWave(h: Harness, livesAtCheckpoint = 3): Promise<SavePoint> {
  await enterCombat(h, 3);
  clearWaves(h, 1);
  h.run.lives = livesAtCheckpoint;
  h.flow.handleWaveStart(1);
  h.flow.handleWaveComplete(1);
  h.flow.handleWaveStart(2);
  const stored = storedCheckpoint();
  expect([stored.checkpoint, stored.level, stored.wave, stored.lives]).toEqual([
    'wave',
    3,
    2,
    livesAtCheckpoint,
  ]);
  return { stage: 'wave', level: 3, wave: 2 };
}

describe('campaign background save', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    restoreStorage();
    resetLocale();
    window.localStorage.clear();
  });

  // ───────────────────────────── B1 / B2 ─────────────────────────────

  describe('B1, B2: where and what it writes, and when it does not', () => {
    it.each(SCENARIOS)('hidden during $name', async (scenario) => {
      // 对照：同一时刻按下“保存并退出”
      const twin = createHarness(scenario.mode);
      const expected = await scenario.arrange(twin);
      playOn(twin);
      twin.flow.saveForExit();
      const exitRecord = loadCampaignCheckpoint();
      const exitKeys = Object.keys(storageSnapshot()).sort();
      window.localStorage.clear();

      const h = createHarness(scenario.mode);
      await scenario.arrange(h);
      playOn(h);
      const before = storageSnapshot();
      const replaced = loadCampaignCheckpoint();
      const writes = watchStorageWrites();

      h.flow.saveInBackground();

      if (typeof expected === 'string') {
        writes.expectNone(`saveInBackground (${expected})`);
        expect(storageSnapshot()).toEqual(before);
        return;
      }
      const save = storedCheckpoint();
      expect(pointOf(save), 'the same save point as Save & Exit').toEqual(expected);
      expect(exitRecord, 'Save & Exit stored a record at this moment').not.toBeNull();
      const exit = exitRecord as CampaignSaveData;
      expect(Object.keys(save).sort(), 'the same fields').toEqual(Object.keys(exit).sort());
      expect(withoutLivesAndTime(save), 'the same content, lives aside').toEqual(
        withoutLivesAndTime(exit)
      );
      expect(save.version).toBe(CAMPAIGN_SAVE_VERSION);
      expect(
        writes.setItem.mock.calls.map(([key]) => key),
        'one write, to the checkpoint key'
      ).toEqual([CAMPAIGN_SAVE_KEY]);
      expect(Object.keys(storageSnapshot()).sort()).toEqual(exitKeys);

      // 生命数：playOn 之后是 2 条。被覆盖的检查点就是这个存档点上的那份（3 条命）时保住 3 条；
      // 最后一波清空后的空档里，被覆盖的是上一波的检查点，写此刻的 2 条
      expect(exit.lives, 'Save & Exit writes the current lives').toBe(2);
      if (scenario.name === BEFORE_BOSS_CHECKPOINT) {
        expect(replaced ? pointOf(replaced) : null, 'premise: another save point').not.toEqual(
          expected
        );
        expect(save.lives).toBe(2);
      } else {
        expect(replaced ? pointOf(replaced) : null, 'premise: the same save point').toEqual(
          expected
        );
        expect(replaced?.lives, 'premise: saved there with three lives').toBe(3);
        expect(save.lives).toBe(3);
      }

      // “继续战役”：与保存并退出之后走的是同一条路
      const route = await resumeLog(save);
      expect(route.length).toBeGreaterThan(0);
      expect(route).toEqual(await resumeLog(exit));
    });

    it('stores score, missiles, upgrades, weapons and ammo, flares, camera, stats and Swift as they are now', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      clearWaves(h, 1);
      const autosave = storedCheckpoint();
      expect(autosave.score, 'the autosave was taken before any of this').toBe(0);
      expect(autosave.swiftJoined ?? false).toBe(false);

      h.run.score = 18_640;
      h.run.missiles = 2;
      h.run.flares = 1;
      h.run.cameraMode = 'first-person';
      h.run.weapons = {
        unlocked: ['rockets', 'laser', 'swarm'],
        selected: 'swarm',
        ammo: { rockets: 5, swarm: 1 },
      };
      const upgrades = h.stats.getUpgrades();
      upgrades.awardBonusPoints(6);
      expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
      const pointsLeft = upgrades.getAvailablePoints();
      for (let kill = 0; kill < 7; kill++) h.flow.recordKill();
      h.flow.recordAssetLost(true);
      h.flow.recordDeath();
      h.flow.handleWingmanLaunched('swift');
      h.flow.tick(42.5);

      h.flow.saveInBackground();

      const save = storedCheckpoint();
      expect(save.score).toBe(18_640);
      expect(save.missiles).toBe(2);
      expect(save.flares).toBe(1);
      expect(save.cameraMode).toBe('first-person');
      expect(save.weapons).toEqual({
        unlocked: ['rockets', 'laser', 'swarm'],
        selected: 'swarm',
        ammo: { rockets: 5, swarm: 1 },
      });
      expect(upgradeLevel(save, UpgradeType.MAX_HEALTH)).toBe(1);
      expect(save.upgrades.availablePoints).toBe(pointsLeft);
      expect(save.stats).toEqual({ kills: 7, civiliansLost: 1, deaths: 1, playTimeSeconds: 42.5 });
      expect(save.swiftJoined).toBe(true);
      expect(pointOf(save)).toEqual({ stage: 'wave', level: 3, wave: 1 });
    });

    it('keeps what was bought in the hangar', async () => {
      const h = createHarness();
      await defeatBoss(h, 4);
      h.advance(10);
      h.continueDebrief();
      expect(h.log).toContain('hangar:5');
      const upgrades = h.stats.getUpgrades();
      upgrades.awardBonusPoints(6);
      expect(upgradeLevel(storedCheckpoint(), UpgradeType.DAMAGE)).toBe(0);
      expect(upgrades.upgrade(UpgradeType.DAMAGE)).toBe(true);
      expect(upgrades.upgrade(UpgradeType.DAMAGE)).toBe(true);

      h.flow.saveInBackground();

      const save = storedCheckpoint();
      expect(pointOf(save)).toEqual({ stage: 'hangar', level: 5, wave: 0 });
      expect(upgradeLevel(save, UpgradeType.DAMAGE)).toBe(2);
      expect(save.upgrades.availablePoints).toBe(upgrades.getAvailablePoints());
    });

    it.each(SCENARIOS)('once the run is over, nothing is written: $name', async (scenario) => {
      const h = createHarness(scenario.mode);
      await scenario.arrange(h);
      playOn(h);
      h.session.setGameOver();
      const before = storageSnapshot();
      const writes = watchStorageWrites();

      h.flow.saveInBackground();

      writes.expectNone('saveInBackground after the run is over');
      expect(storageSnapshot()).toEqual(before);
    });

    it.each(SCENARIOS)(
      'when nothing is to be written, a stored record nobody can read stays as it is: $name',
      async (scenario) => {
        const unreadable = '{"version":1,"checkpoint":"wave","level":3,"wave":2,"lives":';
        const h = createHarness(scenario.mode);
        const expected = await scenario.arrange(h);
        playOn(h);
        // 本来会写的时刻：换成本局已经结束
        if (typeof expected !== 'string') h.session.setGameOver();
        window.localStorage.setItem(CAMPAIGN_SAVE_KEY, unreadable);
        const before = storageSnapshot();
        const writes = watchStorageWrites();

        h.flow.saveInBackground();

        writes.expectNone('saveInBackground');
        expect(rawCheckpoint()).toBe(unreadable);
        expect(storageSnapshot()).toEqual(before);
      }
    );

    // Boss 模式下流程本来就走不到任何存档点（协调器也不会在 Boss 模式下读档）。这里硬塞一个
    // 存档点给它：“Boss 模式不写”是流程自己的保证，不靠“碰巧没有存档点”。
    it.each([
      [
        'a campaign save',
        (): void => {
          saveCampaignCheckpoint(makeSave({ checkpoint: 'wave', level: 3, wave: 2, lives: 3 }));
        },
      ],
      [
        'a record nobody can read',
        (): void => {
          window.localStorage.setItem(CAMPAIGN_SAVE_KEY, '{"version":1,"checkpoint":"wave",');
        },
      ],
    ])(
      'boss mode never writes, even with a save point forced on the flow: %s stays as it is',
      async (_name, store) => {
        const h = createHarness('boss');
        h.flow.resumeFromCheckpoint({
          ...makeSave({ checkpoint: 'wave', level: 3, wave: 2, lives: 3 }),
          version: CAMPAIGN_SAVE_VERSION,
          savedAt: FROZEN_NOW,
        });
        await flushPromises();
        playOn(h);
        store();
        const before = storageSnapshot();
        const writes = watchStorageWrites();

        h.flow.saveInBackground();

        writes.expectNone('saveInBackground in boss mode');
        expect(storageSnapshot()).toEqual(before);
      }
    );
  });

  // ───────────────────────────── B3 ─────────────────────────────

  describe('B3: the lives it writes', () => {
    it.each([
      { stored: 3, now: 1, written: 3 },
      { stored: 3, now: 2, written: 3 },
      { stored: 5, now: 1, written: 5 },
      { stored: 2, now: 2, written: 2 },
      { stored: 1, now: 3, written: 3 },
      { stored: 1, now: 2, written: 2 },
    ])(
      'same save point, $stored stored and $now now: $written written',
      async ({ stored, now, written }) => {
        const h = createHarness();
        const point = await midThirdWave(h, stored);
        h.run.lives = now;
        h.run.score = 6_600;

        h.flow.saveInBackground();

        const save = storedCheckpoint();
        expect(pointOf(save)).toEqual(point);
        expect(save.lives).toBe(written);
        expect(save.score, 'the rest is as of now').toBe(6_600);
        expect(h.run.lives, 'the lives in the running game are not touched').toBe(now);
      }
    );

    it('with the lives kept, everything else is still the state as of now', async () => {
      const h = createHarness();
      await midThirdWave(h);
      playOn(h);

      h.flow.saveInBackground();

      const save = storedCheckpoint();
      expect(save.lives).toBe(3);
      expectCurrentState({ ...save, lives: h.run.lives }, h);
    });

    it.each([
      ['an earlier wave of this level', { checkpoint: 'wave', level: 3, wave: 1 }],
      ['a later wave of this level', { checkpoint: 'wave', level: 3, wave: 3 }],
      ['the same wave of another level', { checkpoint: 'wave', level: 4, wave: 2 }],
      ['the start of this level', { checkpoint: 'level-start', level: 3, wave: 0 }],
      ['another kind with the same level and wave', { checkpoint: 'boss', level: 3, wave: 2 }],
      ['the hangar before this level', { checkpoint: 'hangar', level: 3, wave: 0 }],
    ] as const)(
      'a stored checkpoint for another save point (%s) does not lend its lives',
      async (_name, other) => {
        const h = createHarness();
        const point = await midThirdWave(h);
        saveCampaignCheckpoint(makeSave({ ...other, lives: 5 }));
        h.run.lives = 1;

        h.flow.saveInBackground();

        const save = storedCheckpoint();
        expect(pointOf(save)).toEqual(point);
        expect(save.lives).toBe(1);
      }
    );

    it('no stored checkpoint: the current lives are written', async () => {
      const h = createHarness();
      const point = await midThirdWave(h);
      window.localStorage.removeItem(CAMPAIGN_SAVE_KEY);
      h.run.lives = 1;

      h.flow.saveInBackground();

      expect(pointOf(storedCheckpoint())).toEqual(point);
      expect(storedCheckpoint().lives).toBe(1);
    });

    it.each([
      ['text that is not JSON', '{"version":1,"checkpoint":"wave","level":3,"wave":2,"lives":'],
      ['an empty string', ''],
      ['a JSON array', '[3,2,9]'],
      [
        'a record from another save format, same save point, nine lives',
        JSON.stringify({
          ...makeSave({ checkpoint: 'wave', level: 3, wave: 2, lives: 9 }),
          version: 99,
          savedAt: FROZEN_NOW,
        }),
      ],
    ])('an unreadable stored record (%s) is replaced by the current state', async (_name, raw) => {
      const h = createHarness();
      const point = await midThirdWave(h);
      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
      playOn(h);

      expect(() => h.flow.saveInBackground()).not.toThrow();

      const save = storedCheckpoint();
      expect(pointOf(save)).toEqual(point);
      expect(save.lives).toBe(2);
      expectCurrentState(save, h);
    });

    it.each([
      ['the boss fight', async (h: Harness) => enterBossFight(h, 6), 'boss'],
      ['the hangar after a boss', async (h: Harness) => defeatBoss(h, 4), 'hangar'],
      ['the first wave of a level', async (h: Harness) => enterCombat(h, 2), 'level-start'],
    ] as const)('%s keeps the higher lives too', async (_name, reach, kind) => {
      const h = createHarness();
      await reach(h);
      expect([storedCheckpoint().checkpoint, storedCheckpoint().lives]).toEqual([kind, 3]);
      h.run.lives = 1;

      h.flow.saveInBackground();

      expect([storedCheckpoint().checkpoint, storedCheckpoint().lives]).toEqual([kind, 3]);
    });

    it('last wave cleared, boss checkpoint not yet written: the save moves to the boss with the current lives', async () => {
      const level = 2;
      const totalWaves = totalWavesOf(level);
      const h = createHarness();
      await enterCombat(h, level);
      clearWaves(h, totalWaves);
      // 存储里还是最后一波开始时的检查点（3 条命）
      expect(pointOf(storedCheckpoint())).toEqual({
        stage: 'wave',
        level,
        wave: totalWaves - 1,
      });
      expect(storedCheckpoint().lives).toBe(3);
      h.run.lives = 1;

      h.flow.saveInBackground();

      const save = storedCheckpoint();
      expect(pointOf(save)).toEqual({ stage: 'boss', level, wave: totalWaves });
      expect(save.lives).toBe(1);
    });

    it('hiding again and again keeps the lives; Save & Exit afterwards writes the current ones', async () => {
      const h = createHarness();
      await midThirdWave(h);
      h.run.lives = 2;
      h.flow.saveInBackground();
      expect(storedCheckpoint().lives).toBe(3);

      h.run.lives = 1;
      h.run.score = 9_100;
      h.flow.saveInBackground();
      expect([storedCheckpoint().lives, storedCheckpoint().score]).toEqual([3, 9_100]);

      expectSaved(h.flow.saveForExit(), 'wave');
      expect(storedCheckpoint().lives, 'the player chose this one').toBe(1);
    });

    it('after a Save & Exit at one life, later background saves keep that one life', async () => {
      const h = createHarness();
      const point = await midThirdWave(h);
      h.run.lives = 1;
      expectSaved(h.flow.saveForExit(), 'wave');
      const chosen = storedCheckpoint();
      expect(chosen.lives).toBe(1);

      // “继续战役”：新的一局从这份存档开始
      const next = createHarness();
      next.run.lives = chosen.lives;
      next.run.score = chosen.score;
      next.flow.resumeFromCheckpoint(chosen);
      await flushPromises();
      next.flow.saveInBackground();
      expect(pointOf(storedCheckpoint())).toEqual(point);
      expect(storedCheckpoint().lives).toBe(1);

      // 续玩时多了一条命：两者取大，写 2
      next.run.lives = 2;
      next.flow.saveInBackground();
      expect(storedCheckpoint().lives).toBe(2);
    });

    it('once the run reaches the next checkpoint, the lives are those of that checkpoint', async () => {
      const h = createHarness();
      await midThirdWave(h);
      h.run.lives = 1;
      h.flow.handleWaveComplete(2);
      const autosave = storedCheckpoint();
      expect([autosave.wave, autosave.lives]).toEqual([3, 1]);
      h.flow.handleWaveStart(3);

      h.flow.saveInBackground();

      expect(pointOf(storedCheckpoint())).toEqual({ stage: 'wave', level: 3, wave: 3 });
      expect(storedCheckpoint().lives).toBe(1);
    });
  });

  // ───────────────────────────── B4 ─────────────────────────────

  describe('B4: the run itself does not notice', () => {
    function sessionFacts(h: Harness): unknown[] {
      return [
        h.session.getStatus(),
        h.session.getLevel(),
        h.session.getWave(),
        h.session.isInBossBattle(),
        h.session.isPaused(),
      ];
    }

    it.each(SCENARIOS)(
      '$name: no toast, stinger or radio, and the flow does not move',
      async (scenario) => {
        const h = createHarness(scenario.mode);
        await scenario.arrange(h);
        playOn(h);
        const effectsBefore = h.fake.effects.length;
        const logBefore = [...h.log];
        const runBefore = JSON.parse(JSON.stringify(h.run)) as unknown;
        const statsBefore = h.flow.getRunStats();
        const preview = h.flow.describeExitSave();
        const session = sessionFacts(h);

        h.flow.saveInBackground();
        h.flow.saveInBackground();

        expect(effectNames(h.fake, effectsBefore), 'silent').toEqual([]);
        expect(h.log, 'the run does not move').toEqual(logBefore);
        expect(JSON.parse(JSON.stringify(h.run))).toEqual(runBefore);
        expect(h.flow.getRunStats()).toEqual(statsBefore);
        expect(h.flow.describeExitSave(), 'the save point stays where it was').toEqual(preview);
        expect(sessionFacts(h)).toEqual(session);
      }
    );

    it('…whereas the autosave at the same moment is announced (the fake does record it)', async () => {
      const h = createHarness();
      await enterCombat(h, 3);
      const before = h.fake.effects.length;

      h.flow.handleWaveStart(0);
      h.flow.handleWaveComplete(0);

      expect(effectNames(h.fake, before)).toContain('showAutosave');
    });
  });
});
