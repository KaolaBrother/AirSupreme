import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { GameConfig } from '@/config';
import { GameCoordinator } from '@/core/GameCoordinator';
import {
  CAMPAIGN_SAVE_KEY,
  getCampaignProgress,
  loadCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import { UpgradeType, type PlayerStats } from '@/features/upgrade/UpgradeSystem';
import type { GameSettings } from '@/ui/StartMenu';
import {
  actionButtons,
  actionTexts,
  createCoordinatorRig,
  flush,
  installPageLifecycle,
  isSettlementUp,
  LABELS,
  rawSave,
  readText,
  runSettings,
  seedSave,
  settlementTitle,
  storageSnapshot,
  stubCallCounts,
  type CoordinatorRig,
  type HostOptions,
  type PageLifecycle,
  type Stub,
} from './gameOverRig';
import { resetLocale } from './i18nTestUtils';

/**
 * 后台存档（批次 R2）：页面转入后台或即将关闭时，把战役进度写进检查点。主人在 iPad 上玩，
 * Safari 会把后台标签页整个丢弃，丢弃时页面收不到任何事件，所以转入后台的那一刻就得写。
 *
 * 规格：
 * 1. 触发：document 的 visibilitychange 且 visibilityState === 'hidden'；window 的 pagehide；
 *    window 的 beforeunload（经 src/main.ts，在游戏被释放之前——见 GameOverRetryBoot.test.ts）。
 * 2. 一次转入后台只做一次：第一个触发干活，同一次里后来的触发什么都不做（第一次什么都没写也算）。
 *    visibilitychange 回到 visible、window 的 pageshow 之后才有下一次。回来本身不写。
 * 3. 什么时候写：只在一局正在进行时（不在启动过程中，任务失败 / 战役通关之后不写），不是 Boss 模式，
 *    已经到过本局第一个检查点。不写的时候存储一个字节都不变。章节卡片、结算、机库期间照样写。
 * 4. 写什么：和“保存并退出”同一个键、同一种记录、同一个存档点，内容是此刻的状态。
 * 5. 生命数：被覆盖的检查点是同一个存档点时，取已存的与此刻的较大者；否则写此刻的。
 *    “保存并退出”不变。三条命开始这一波、掉了两条、切到后台、回来、阵亡 →“从检查点重试”
 *    回到这一波时还是三条命。
 * 6. 对局原样继续：不暂停、会话状态不变、对局里的生命数不变、没有提示 / 刺激音 / 无线电、
 *    不调用退出回调。
 * 7. 存储抛错或拒收时不从事件处理器里漏出异常；监听随协调器释放一起摘掉，重试 / 继续 / 重新开局
 *    不会叠加（之前开过多少局，一次转入后台都只写一次）。
 *
 * 这里是协调器一层（台架见 gameOverRig.ts：真实的 setupEventListeners、saveCampaignInBackground、
 * captureCheckpoint、dispose，真实的战役流程与存档）。战役流程自己的部分——各个时刻存到哪里、
 * 生命数规则的各种组合——在 CampaignExitSave.test.ts。
 */

interface Host {
  onRetry: Mock<() => void>;
  onExitToMenu: Mock<() => void>;
  onContinueFromCheckpoint: Mock<(save: CampaignSaveData) => void>;
}

/** 第 2 关打完第 1 波之后的存档点 */
const SAVE_POINT = { checkpoint: 'wave', level: 2, wave: 1 } as const;
const SAVE_POINT_PLACE = 'Ch. 2 · Sandstorm · Wave 2';

function storedSave(): CampaignSaveData {
  const save = loadCampaignCheckpoint();
  expect(save, 'a valid checkpoint is stored').not.toBeNull();
  return save as CampaignSaveData;
}

/** 存档里除了存档时间之外的全部内容 */
function withoutTime(save: CampaignSaveData): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...save };
  delete rest.savedAt;
  return rest;
}

describe('background campaign save, through the coordinator', () => {
  let page: PageLifecycle;
  let host: Host;
  let rigs: CoordinatorRig[];
  let originalIsMobile: boolean;
  let setItem: Mock<(key: string, value: string) => void>;

  /** 对检查点那个键的写入次数（内容相同的重写也算） */
  function saveWrites(): number {
    return setItem.mock.calls.filter(([key]) => key === CAMPAIGN_SAVE_KEY).length;
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    GameConfig.isMobile = false;
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setItem = vi.spyOn(Storage.prototype, 'setItem') as unknown as typeof setItem;
    page = installPageLifecycle();
    rigs = [];
    host = {
      onRetry: vi.fn<() => void>(),
      onExitToMenu: vi.fn<() => void>(),
      onContinueFromCheckpoint: vi.fn<(save: CampaignSaveData) => void>(),
    };
  });

  afterEach(async () => {
    for (const rig of rigs) {
      if (!rig.isDisposed()) rig.dispose();
    }
    await flush(2);
    expect(page.errors(), 'nothing was thrown out of a page event handler').toEqual([]);
    page.restore();
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  function createRig(options: HostOptions = host): CoordinatorRig {
    const rig = createCoordinatorRig(GameCoordinator, { showStartMenu: false, ...options });
    rigs.push(rig);
    return rig;
  }

  /** 开一局并等它开始；默认是存档的战役局（正常模式）从第 2 关起 */
  async function startRun(
    settings: Partial<GameSettings> = {},
    options: HostOptions = host
  ): Promise<CoordinatorRig> {
    const rig = createRig(options);
    rig.boot(runSettings({ startLevel: 2, ...settings }));
    await rig.playing();
    return rig;
  }

  /** 战役局打完第 2 关第 1 波：检查点在第 2 波，三条命 */
  async function runAtSavePoint(): Promise<CoordinatorRig> {
    const run = await startRun();
    run.completeWave(0);
    expect(storedSave()).toMatchObject({ ...SAVE_POINT, lives: 3, score: 0 });
    return run;
  }

  function upgradesOf(run: CoordinatorRig): ReturnType<PlayerStats['getUpgrades']> {
    return (run.target.playerStats as PlayerStats).getUpgrades();
  }

  /** 检查点之后又打了一阵：分数、导弹、视角、升级、击坠数、游戏时间都变了 */
  function playOn(run: CoordinatorRig, score = 7_350): void {
    run.setScore(score);
    run.target.missileCount = 1;
    (run.target.view as { setMode(mode: GameSettings['cameraMode']): void }).setMode(
      'first-person'
    );
    const upgrades = upgradesOf(run);
    upgrades.awardBonusPoints(6);
    expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(true);
    run.campaign.recordKill();
    run.campaign.recordKill();
    run.tick(0.5);
  }

  /** 存档里是 playOn 之后的状态 */
  function expectPlayedOnState(save: CampaignSaveData, run: CoordinatorRig, score = 7_350): void {
    expect(save).toMatchObject(SAVE_POINT);
    expect(save.score).toBe(score);
    expect(save.missiles).toBe(1);
    expect(save.cameraMode).toBe('first-person');
    expect(save.upgrades).toEqual(JSON.parse(JSON.stringify(upgradesOf(run).export())));
    expect((save.upgrades.upgrades as Record<string, number>)[UpgradeType.MAX_HEALTH]).toBe(1);
    expect(save.stats).toEqual(run.campaign.getRunStats());
    expect(save.stats.kills).toBe(2);
  }

  // ───────────────────────────── 触发 ─────────────────────────────

  describe('what triggers it (spec 1)', () => {
    it.each([
      ['the tab going hidden (visibilitychange)', (p: PageLifecycle) => p.hide()],
      ['pagehide', (p: PageLifecycle) => p.pageHide()],
    ] as const)(
      '%s writes the progress as it is now, at the current save point',
      async (_n, go) => {
        const run = await runAtSavePoint();
        playOn(run);
        const writesBefore = saveWrites();

        go(page);

        expect(saveWrites() - writesBefore).toBe(1);
        expectPlayedOnState(storedSave(), run);
      }
    );

    it('a visibilitychange while the page is still visible writes nothing', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      const raw = rawSave();
      const writesBefore = saveWrites();

      page.visibilityChange();
      page.show();

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);
    });

    it('coming back (visible again, pageshow) writes nothing', async () => {
      const run = await runAtSavePoint();
      page.hide();
      page.pageHide();
      playOn(run);
      const raw = rawSave();
      const writesBefore = saveWrites();

      page.pageShow();
      page.show();
      page.pageShow();

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);
    });
  });

  // ───────────────────────────── 一次转入后台只写一次 ─────────────────────────────

  describe('once per hide (spec 2)', () => {
    const SAME_HIDE: Array<[string, Array<(p: PageLifecycle) => void>]> = [
      ['hidden, then pagehide', [(p) => p.hide(), (p) => p.pageHide()]],
      ['pagehide, then hidden', [(p) => p.pageHide(), (p) => p.hide()]],
      [
        'hidden twice and pagehide twice',
        [(p) => p.hide(), (p) => p.hide(), (p) => p.pageHide(), (p) => p.pageHide()],
      ],
      [
        'hidden, a stray visibilitychange while still hidden, then pagehide',
        [(p) => p.hide(), (p) => p.visibilityChange(), (p) => p.pageHide()],
      ],
    ];

    it.each(SAME_HIDE)('%s: one write, by the first of them', async (_name, steps) => {
      const run = await runAtSavePoint();
      playOn(run, 1_000);
      const writesBefore = saveWrites();

      steps[0](page);
      expect(storedSave().score).toBe(1_000);
      // 同一次转入后台里状态就算又变了，后来的触发也不再写
      run.setScore(2_000);
      for (const step of steps.slice(1)) {
        step(page);
      }

      expect(saveWrites() - writesBefore).toBe(1);
      expect(storedSave().score).toBe(1_000);
    });

    it('the first trigger counts even when it had nothing to write', async () => {
      const run = await startRun();
      expect(rawSave(), 'not yet at the first checkpoint').toBeNull();
      page.hide();
      expect(rawSave()).toBeNull();

      // 这一局自己走到了检查点；同一次转入后台里后来的触发不再写
      run.completeWave(0);
      const raw = rawSave();
      playOn(run);
      const writesBefore = saveWrites();
      page.pageHide();
      page.hide();

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);
    });

    it('hidden while the game was still starting up: the rest of that hide writes nothing either', async () => {
      const run = createRig();
      run.boot(runSettings({ startLevel: 2 }));
      expect(run.session.isPlaying(), 'premise: still booting').toBe(false);
      page.hide();

      await run.playing();
      run.completeWave(0);
      const raw = rawSave();
      playOn(run);
      const writesBefore = saveWrites();
      page.pageHide();
      page.hide();

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);

      // 回来之后的下一次照常写
      page.show();
      page.hide();
      expectPlayedOnState(storedSave(), run);
    });

    it.each([
      [
        'visible again',
        (p: PageLifecycle) => p.hide(),
        (p: PageLifecycle) => p.show(),
        (p: PageLifecycle) => p.hide(),
      ],
      [
        'pageshow',
        (p: PageLifecycle) => p.pageHide(),
        (p: PageLifecycle) => p.pageShow(),
        (p: PageLifecycle) => p.pageHide(),
      ],
      [
        'pageshow after a hide by visibilitychange',
        (p: PageLifecycle) => p.hide(),
        (p: PageLifecycle) => p.pageShow(),
        (p: PageLifecycle) => p.pageHide(),
      ],
      [
        'visible again after a pagehide',
        (p: PageLifecycle) => p.pageHide(),
        (p: PageLifecycle) => p.show(),
        (p: PageLifecycle) => p.hide(),
      ],
    ] as const)('%s re-arms it: the next hide writes again', async (_n, away, back, awayAgain) => {
      const run = await runAtSavePoint();
      playOn(run, 1_000);
      const writesBefore = saveWrites();
      away(page);
      expect(storedSave().score).toBe(1_000);

      back(page);
      run.setScore(2_000);
      expect(storedSave().score, 'coming back did not write').toBe(1_000);
      awayAgain(page);

      expect(storedSave().score).toBe(2_000);
      expect(saveWrites() - writesBefore).toBe(2);
    });

    it('three hides, three writes, each with the state of its moment', async () => {
      const run = await runAtSavePoint();
      const writesBefore = saveWrites();

      for (const score of [1_000, 2_000, 3_000]) {
        run.setScore(score);
        page.hide();
        page.pageHide();
        expect(storedSave().score).toBe(score);
        page.pageShow();
        page.show();
      }

      expect(saveWrites() - writesBefore).toBe(3);
    });
  });

  // ───────────────────────────── 什么时候写 ─────────────────────────────

  describe('when it writes and when it leaves storage alone (spec 3)', () => {
    function expectUntouched(before: Record<string, string>, writesBefore: number): void {
      expect(saveWrites(), 'no write to the checkpoint').toBe(writesBefore);
      expect(storageSnapshot()).toEqual(before);
    }

    function hideEveryWay(): void {
      page.hide();
      page.pageHide();
      page.pageShow();
      page.show();
      page.pageHide();
      page.pageShow();
    }

    it('during boot, before the run has started: the checkpoint being resumed is left as it is', async () => {
      const raw = seedSave();
      const rig = createRig({ ...host, resume: storedSave() });
      const before = storageSnapshot();
      const writesBefore = saveWrites();
      rig.boot(runSettings({ startLevel: 2 }));
      expect(rig.session.isPlaying(), 'premise: still booting').toBe(false);

      hideEveryWay();

      expectUntouched(before, writesBefore);
      expect(rawSave()).toBe(raw);
      await rig.playing();
    });

    it('before the run’s first checkpoint: nothing is stored', async () => {
      const run = await startRun();
      playOn(run);
      const before = storageSnapshot();
      const writesBefore = saveWrites();

      hideEveryWay();

      expectUntouched(before, writesBefore);
      expect(rawSave()).toBeNull();
    });

    it('boss mode: the campaign save sitting in storage is not touched', async () => {
      const raw = seedSave();
      const run = await startRun({ gameMode: 'boss', startLevel: 4 });
      playOn(run);
      run.session.setInBossBattle(true);
      const before = storageSnapshot();
      const writesBefore = saveWrites();

      hideEveryWay();

      expectUntouched(before, writesBefore);
      expect(rawSave()).toBe(raw);
    });

    it('after MISSION FAILED: storage and the panel stay as they are', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      run.die();
      expect(readText(actionButtons()[0])).toContain(SAVE_POINT_PLACE);
      const before = storageSnapshot();
      const writesBefore = saveWrites();
      const panel = actionTexts();

      hideEveryWay();

      expectUntouched(before, writesBefore);
      expect(isSettlementUp()).toBe(true);
      expect(settlementTitle()).toBe(LABELS.failed.en);
      expect(actionTexts()).toEqual(panel);
    });

    it('after the campaign is complete: no checkpoint comes back, the win stays recorded', async () => {
      const run = await startRun({ startLevel: 10 });
      run.completeWave(0);
      expect(rawSave()).not.toBeNull();
      run.killBoss(10);
      expect(rawSave(), 'the checkpoint was cleared on completion').toBeNull();
      const before = storageSnapshot();
      const writesBefore = saveWrites();

      // 击破之后、结局之前
      hideEveryWay();
      expectUntouched(before, writesBefore);

      // MISSION COMPLETE 面板亮出之后
      run.tick(3);
      expect(settlementTitle()).toBe(LABELS.complete.en);
      hideEveryWay();
      expectUntouched(before, writesBefore);
      expect(rawSave()).toBeNull();
      expect(getCampaignProgress().completed).toBe(true);
    });

    it('while paused it still writes: a paused run is still being played', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      run.togglePause();
      expect(run.session.isPaused()).toBe(true);

      page.hide();

      expectPlayedOnState(storedSave(), run);
      expect(run.session.isPaused(), 'and it stays paused').toBe(true);
    });

    it('in the hangar after a boss it writes, purchases included', async () => {
      const run = await runAtSavePoint();
      run.destroyBoss(2);
      expect(run.target.showHangar, 'premise: the hangar is up').toHaveBeenCalledTimes(1);
      expect(storedSave()).toMatchObject({ checkpoint: 'hangar', level: 3 });
      const upgrades = upgradesOf(run);
      upgrades.awardBonusPoints(6);
      expect(upgrades.upgrade(UpgradeType.DAMAGE)).toBe(true);
      expect(upgrades.upgrade(UpgradeType.DAMAGE)).toBe(true);
      expect(
        (storedSave().upgrades.upgrades as Record<string, number> | undefined)?.[
          UpgradeType.DAMAGE
        ] ?? 0,
        'premise: not stored yet'
      ).toBe(0);

      page.hide();

      const save = storedSave();
      expect(save).toMatchObject({ checkpoint: 'hangar', level: 3, wave: 0 });
      expect((save.upgrades.upgrades as Record<string, number>)[UpgradeType.DAMAGE]).toBe(2);
      expect(save.upgrades.availablePoints).toBe(upgrades.getAvailablePoints());
    });

    it('during the debrief it writes, at the hangar stop that follows', async () => {
      const run = await runAtSavePoint();
      // 结算卡片停在屏幕上，玩家还没按“继续”
      (run.target.presentation as Stub).showDebrief = vi.fn();
      run.destroyBoss(2);
      expect((run.target.presentation as Stub).showDebrief).toHaveBeenCalledTimes(1);
      expect(run.target.showHangar, 'premise: not in the hangar yet').not.toHaveBeenCalled();
      run.setScore(12_340);

      page.pageHide();

      expect(storedSave()).toMatchObject({ checkpoint: 'hangar', level: 3, wave: 0 });
      expect(storedSave().score).toBe(12_340);
    });

    it('on the next chapter card it writes, still at the hangar stop', async () => {
      const run = await runAtSavePoint();
      run.destroyBoss(2);
      const launch = (run.target.showHangar as Mock).mock.calls[0][1] as () => void;
      launch();
      await flush(2);
      const presentation = run.target.presentation as Stub;
      expect(presentation.showChapterIntro, 'premise: the chapter card is up').toHaveBeenCalled();
      run.setScore(15_000);

      page.hide();

      expect(storedSave()).toMatchObject({ checkpoint: 'hangar', level: 3, wave: 0 });
      expect(storedSave().score).toBe(15_000);
    });
  });

  // ───────────────────────────── 写什么 ─────────────────────────────

  describe('what it writes (spec 4, spec 5)', () => {
    it('the same record Save & Exit writes a moment later, to the same key', async () => {
      const run = await runAtSavePoint();
      playOn(run);

      page.hide();
      const background = storedSave();
      const keys = Object.keys(storageSnapshot()).sort();
      expect(run.campaign.saveForExit().kind).toBe('saved');
      const exit = storedSave();

      expect(withoutTime(background)).toEqual(withoutTime(exit));
      expect(Object.keys(storageSnapshot()).sort()).toEqual(keys);
      expect(keys).toContain('air-supreme:campaign-save');
    });

    it('three lives at the wave start, two lost, hidden, back, shot down: the retry restarts the wave with three lives', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      run.die(2);
      run.die(1);

      page.hide();
      page.pageHide();
      page.pageShow();
      page.show();
      expect(run.lives(), 'the lives in the running game are not changed by the save').toBe(1);
      const raw = rawSave();
      run.die(0);

      expect(settlementTitle()).toBe(LABELS.failed.en);
      expect(readText(actionButtons()[0])).toContain(LABELS.retry.en);
      expect(readText(actionButtons()[0])).toContain(SAVE_POINT_PLACE);
      actionButtons()[0].click();
      const [handed] = host.onContinueFromCheckpoint.mock.calls[0];
      expect(handed).toMatchObject({ ...SAVE_POINT, lives: 3 });
      expect(handed.score, 'with the score as it was when the page was hidden').toBe(7_350);
      expect(rawSave(), 'and that is what is stored').toBe(raw);
      expect(handed).toEqual(JSON.parse(raw as string));
    });

    it('…whereas Save & Exit at that moment writes the one life left', async () => {
      const run = await runAtSavePoint();
      run.die(2);
      run.die(1);

      page.hide();
      expect(storedSave().lives).toBe(3);
      expect(run.campaign.saveForExit().kind).toBe('saved');

      expect(storedSave().lives).toBe(1);
    });

    it('a life gained since the checkpoint is written: the higher of the two', async () => {
      const run = await runAtSavePoint();
      (run.target.playerSystem as { setLives(value: number): void }).setLives(4);

      page.hide();

      expect(storedSave().lives).toBe(4);
      expect(run.lives()).toBe(4);
    });

    it('a stored checkpoint for another save point does not lend its lives', async () => {
      const run = await runAtSavePoint();
      seedSave({ checkpoint: 'wave', level: 2, wave: 3, lives: 5 });
      run.die(1);

      page.hide();

      expect(storedSave()).toMatchObject({ ...SAVE_POINT, lives: 1 });
    });

    it('a corrupt stored record is replaced by the current state', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      run.die(2);
      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, '{"version":1,"checkpoint":"wave","lives":');

      page.hide();

      expectPlayedOnState(storedSave(), run);
      expect(storedSave().lives).toBe(2);
    });
  });

  // ───────────────────────────── 对局不受影响 ─────────────────────────────

  describe('the running game is untouched (spec 6)', () => {
    function sessionFacts(run: CoordinatorRig): unknown[] {
      return [
        run.session.getStatus(),
        run.session.isPlaying(),
        run.session.isPaused(),
        run.session.getLevel(),
        run.session.getWave(),
        run.session.isInBossBattle(),
        run.session.isBossMode(),
        run.session.getDifficulty(),
      ];
    }

    /** 协调器手里的替身（音频、音乐、语音、战役演出、循环、特效、单位、僚机）各被调用了什么 */
    function collaboratorCalls(run: CoordinatorRig): Record<string, Record<string, number>> {
      const calls: Record<string, Record<string, number>> = {};
      for (const name of [
        'audioManager',
        'musicSystem',
        'voiceSystem',
        'presentation',
        'gameLoop',
        'gameScene',
        'vfx',
        'units',
        'wingmen',
      ]) {
        calls[name] = stubCallCounts(run.target[name]);
      }
      return calls;
    }

    it('no pause, no state change, no toast or sound, no callback: only storage changes', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      run.die(2);
      const raw = rawSave();
      const session = sessionFacts(run);
      const calls = collaboratorCalls(run);
      const dom = document.body.innerHTML;
      const stats = run.campaign.getRunStats();
      const exitPreview = run.campaign.describeExitSave();

      page.hide();
      page.pageHide();

      expect(rawSave(), 'premise: it did write').not.toBe(raw);
      expect(sessionFacts(run)).toEqual(session);
      expect(run.session.isPaused()).toBe(false);
      expect(run.lives()).toBe(2);
      expect(collaboratorCalls(run), 'no sound, music, radio, toast or loop call').toEqual(calls);
      expect(document.body.innerHTML, 'nothing on screen changed').toBe(dom);
      expect(document.getElementById('pause-menu')).toBeNull();
      expect(run.campaign.getRunStats()).toEqual(stats);
      expect(run.campaign.describeExitSave()).toEqual(exitPreview);
      expect(host.onExitToMenu).not.toHaveBeenCalled();
      expect(host.onRetry).not.toHaveBeenCalled();
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
      expect(run.isDisposed()).toBe(false);

      // 回来之后也一样
      page.pageShow();
      page.show();
      expect(sessionFacts(run)).toEqual(session);
      expect(collaboratorCalls(run)).toEqual(calls);
      expect(document.body.innerHTML).toBe(dom);
    });

    it('…whereas the wave autosave is announced (the stubs above do record calls)', async () => {
      const run = await startRun();
      const before = stubCallCounts(run.target.presentation);

      run.completeWave(0);

      expect(stubCallCounts(run.target.presentation)).not.toEqual(before);
    });

    it('the game goes on afterwards: the next wave checkpoint is written as usual', async () => {
      const run = await runAtSavePoint();
      page.hide();
      page.show();

      run.setScore(3_300);
      run.completeWave(1);

      expect(storedSave()).toMatchObject({ checkpoint: 'wave', level: 2, wave: 2, score: 3_300 });
    });
  });

  // ───────────────────────────── 稳健性 ─────────────────────────────

  describe('storage that fails, and listeners that go away (spec 7)', () => {
    const ORIGINAL_STORAGE = Object.getOwnPropertyDescriptor(window, 'localStorage');

    afterEach(() => {
      if (ORIGINAL_STORAGE) {
        Object.defineProperty(window, 'localStorage', ORIGINAL_STORAGE);
      }
    });

    const BROKEN: Array<[string, () => void]> = [
      [
        'setItem throws (quota)',
        () => {
          setItem.mockImplementation(() => {
            throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
          });
        },
      ],
      [
        'setItem silently drops the write',
        () => {
          setItem.mockImplementation(() => undefined);
        },
      ],
      [
        'getItem throws',
        () => {
          vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('The operation is insecure.', 'SecurityError');
          });
        },
      ],
      [
        'every storage call throws',
        () => {
          for (const name of ['getItem', 'setItem', 'removeItem'] as const) {
            vi.spyOn(Storage.prototype, name).mockImplementation(() => {
              throw new DOMException('The operation is insecure.', 'SecurityError');
            });
          }
        },
      ],
      [
        'there is no storage at all (the accessor throws)',
        () => {
          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
              throw new DOMException('The operation is insecure.', 'SecurityError');
            },
          });
        },
      ],
    ];

    it.each(BROKEN)(
      '%s: nothing is thrown, by the events or by a direct call',
      async (_n, breakIt) => {
        const run = await runAtSavePoint();
        playOn(run);
        run.die(2);
        breakIt();

        page.hide();
        page.pageHide();
        page.pageShow();
        page.show();
        page.pageHide();
        // 直接调用之前先“回来”一次，否则它只是被“这次已经存过”挡掉
        page.pageShow();
        expect(() => run.call<void>('saveCampaignInBackground')).not.toThrow();

        expect(page.errors()).toEqual([]);
        expect(run.session.isPlaying(), 'the run carries on').toBe(true);
        expect(run.lives()).toBe(2);
        expect(host.onExitToMenu).not.toHaveBeenCalled();
      }
    );

    // 规格第 7 条说的是存储。这一条把“事件处理器不向外抛错”推到存储之外的故障上——拍快照时
    // 出错：同样不能打断页面事件，已存的检查点原样，对局照常，故障过去之后下一次照常写。
    it('a failure while the snapshot is taken does not escape the page event either', async () => {
      const run = await runAtSavePoint();
      const raw = rawSave();
      playOn(run);
      const weapons = run.target.weapons as Stub;
      const exportState = weapons.exportState;
      weapons.exportState = (): never => {
        throw new Error('the snapshot could not be taken');
      };

      page.hide();
      page.pageShow();
      expect(() => run.call<void>('saveCampaignInBackground')).not.toThrow();

      expect(page.errors()).toEqual([]);
      expect(rawSave(), 'the stored checkpoint is as it was').toBe(raw);
      expect(run.session.isPlaying(), 'the run carries on').toBe(true);

      weapons.exportState = exportState;
      page.pageShow();
      page.hide();
      expectPlayedOnState(storedSave(), run);
    });

    it('a failed write leaves the older checkpoint as it was, and the next hide works again', async () => {
      const run = await runAtSavePoint();
      const raw = rawSave();
      playOn(run);
      setItem.mockImplementation(() => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      });

      page.hide();
      expect(rawSave()).toBe(raw);

      // 存储恢复正常（spy 还在，只是不再抛错）
      setItem.mockReset();
      page.show();
      page.hide();

      expectPlayedOnState(storedSave(), run);
    });

    it('…whereas a handler that does throw is noticed (the checks above can fail)', () => {
      const boom = (): void => {
        throw new Error('thrown out of a page event handler');
      };
      window.addEventListener('pagehide', boom);
      page.pageHide();
      window.removeEventListener('pagehide', boom);

      expect(page.errors()).toHaveLength(1);
      page.errors().length = 0;
    });

    it('once the game is disposed its listeners are gone: nothing is written any more', async () => {
      const run = await runAtSavePoint();
      playOn(run);
      const before = storageSnapshot();
      const writesBefore = saveWrites();

      run.dispose();
      page.hide();
      page.pageHide();
      page.pageShow();
      page.show();
      page.hide();
      run.call<void>('saveCampaignInBackground');

      expect(saveWrites()).toBe(writesBefore);
      expect(storageSnapshot()).toEqual(before);
    });

    it('dispose takes off exactly the page listeners the game put on', async () => {
      const added: Array<[EventTarget, string, unknown]> = [];
      const removed: Array<[EventTarget, string, unknown]> = [];
      const PAGE_EVENTS = ['visibilitychange', 'pagehide', 'pageshow'];
      for (const target of [document, window] as const) {
        const add = target.addEventListener.bind(target);
        const remove = target.removeEventListener.bind(target);
        vi.spyOn(target, 'addEventListener').mockImplementation(((
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions
        ) => {
          if (PAGE_EVENTS.includes(type)) added.push([target, type, listener]);
          add(type, listener, options);
        }) as typeof target.addEventListener);
        vi.spyOn(target, 'removeEventListener').mockImplementation(((
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | EventListenerOptions
        ) => {
          if (PAGE_EVENTS.includes(type)) removed.push([target, type, listener]);
          remove(type, listener, options);
        }) as typeof target.removeEventListener);
      }

      const run = await startRun();
      expect(added.length, 'the game listens for the page going away').toBeGreaterThan(0);
      expect(added.map(([, type]) => type)).toEqual(
        expect.arrayContaining(['visibilitychange', 'pagehide'])
      );
      run.dispose();

      expect(removed).toHaveLength(added.length);
      expect(removed).toEqual(expect.arrayContaining(added));
    });

    it('one write per hide however many games came before (retry, continue, a new run)', async () => {
      // 第一局存到检查点后被释放；第二局从那份存档续玩后又被释放；第三局是现在这一局
      const first = await runAtSavePoint();
      first.dispose();
      const second = createRig({ ...host, resume: storedSave() });
      second.boot(runSettings({ startLevel: 2 }));
      await second.playing();
      second.campaign.resumeFromCheckpoint(storedSave());
      second.dispose();
      const third = createRig({ ...host, resume: storedSave() });
      third.boot(runSettings({ startLevel: 2 }));
      await third.playing();
      third.campaign.resumeFromCheckpoint(storedSave());
      playOn(third, 4_400);
      const writesBefore = saveWrites();

      page.hide();
      page.pageHide();

      expect(saveWrites() - writesBefore).toBe(1);
      expect(storedSave()).toMatchObject({ ...SAVE_POINT, score: 4_400 });

      page.pageShow();
      page.show();
      third.setScore(5_500);
      page.pageHide();
      expect(saveWrites() - writesBefore).toBe(2);
      expect(storedSave().score).toBe(5_500);
    });
  });
});
