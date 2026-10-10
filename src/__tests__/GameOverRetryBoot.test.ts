import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { GameConfig } from '@/config';
import { saveStartFlowSettings, START_MENU_STORAGE_KEY } from '@/core/SessionSettings';
import {
  CAMPAIGN_SAVE_KEY,
  loadCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import { setLocale, type Locale } from '@/i18n';
import type { GameSettings } from '@/ui/StartMenu';
import {
  actionButtons,
  actionTexts,
  CHECKPOINT_WORDING,
  createCoordinatorRig,
  flush,
  installPageLifecycle,
  isSettlementUp,
  LABELS,
  rawSave,
  readText,
  resetKeyboardModel,
  runSettings,
  seedSave,
  settlementPanel,
  settlementTitle,
  START_OVER_WORDING,
  storageSnapshot,
  waitUntil,
  type CoordinatorClass,
  type CoordinatorRig,
  type HostOptions,
  type PageLifecycle,
} from './gameOverRig';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * 结算界面上的“从检查点重试 / 再来一局 / 返回菜单”经 src/main.ts 重新开局（批次 P3a）。
 *
 * 入口模块是真的：onRetry、onExitToMenu、continueFromCheckpoint、bootGame（含防重入）都是生产代码。
 * 它造出来的每一局是一台协调器台架（gameOverRig.ts）：真实的 GameCoordinator 原型方法——
 * boot、applyGameSettings（新开一局时清检查点的地方）、阵亡事件处理、resolveCheckpointRetry、
 * dispose——加真实的 HUD 与存档，只有渲染 / 音频 / 敌机这些重量级部分是替身。
 * 开始菜单与菜单音乐是记账的替身（菜单那一侧由菜单的测试负责）。
 *
 * 入口模块一导入就执行 main()：每个用例用不同的查询串重新导入一次，其余模块都是同一份。
 *
 * 规格（与 GameOverCheckpointRetry.test.ts 同一份）在这里落到“重新开出来的那一局”上：
 * - 第 1 条：重试开出的是从那份存档续玩的一局；显示面板、重试、返回菜单，存储里的检查点逐字节不变；
 * - 第 2 条：Boss 模式下“再来一局”开出同样设置的一局，存储里的战役存档不变；
 * - 第 5 条：两局之间换了语言，下一局的面板用新语言；
 * - 第 6 条：重试后再阵亡、存档与当前设置不一致、启动失败；
 * - 第 8 条：重试键连点只开出一局；启动失败后还能再试。
 *
 * 后台存档（批次 R2，规格见 BackgroundCampaignSave.test.ts）在这里落到入口模块上：关闭页面
 * （beforeunload）先存档再释放游戏；菜单上、启动过程中不写；重试 / 回菜单 / 继续开过多少局，
 * 一次转入后台都只由活着的那一局写一次；转入后台时存下的那一份，重试与“继续战役”都照它开局。
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHIPPED_HTML = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');

const WAVE_4 = { en: 'Ch. 2 · Sandstorm · Wave 4', zh: '第2关 · 沙漠风暴 · 第4波' };
const WAVE_5 = { en: 'Ch. 2 · Sandstorm · Wave 5', zh: '第2关 · 沙漠风暴 · 第5波' };

interface FakeMenu {
  onStart: ((settings: GameSettings) => void) | null;
  onContinue: ((save: CampaignSaveData) => void) | null;
  showing: boolean;
}

interface RigHandle {
  boot(settings: unknown): void;
  saveInBackground(): void;
  dispose(): void;
}

const shell = vi.hoisted(() => ({
  build: null as null | ((options: unknown) => RigHandle),
  failConstruct: false,
  menus: [] as unknown[],
  /** 每一局开局时 main.ts 交给协调器的设置 */
  booted: [] as unknown[],
  /**
   * 事件先后：game:construct / game:background-save / game:dispose /
   * menu:show / menu:hide / menu:reload
   */
  log: [] as string[],
}));

vi.mock('@/core/GameCoordinator', () => {
  class GameCoordinator {
    public static warmRuntimeChunks(): Promise<void> {
      return Promise.resolve();
    }
    private readonly rig: RigHandle;
    constructor(options: unknown) {
      if (shell.failConstruct) {
        throw new Error('the game runtime could not be created');
      }
      if (!shell.build) {
        throw new Error('no rig builder installed');
      }
      shell.log.push('game:construct');
      this.rig = shell.build(options);
    }
    public boot(settings: unknown): void {
      shell.booted.push(settings);
      this.rig.boot(settings);
    }
    public saveCampaignInBackground(): void {
      shell.log.push('game:background-save');
      this.rig.saveInBackground();
    }
    public dispose(): void {
      shell.log.push('game:dispose');
      this.rig.dispose();
    }
  }
  return { GameCoordinator };
});

vi.mock('@/ui/StartMenu', () => {
  class StartMenu {
    public onStart: unknown = null;
    public onContinue: unknown = null;
    public showing = true;
    constructor() {
      shell.menus.push(this);
    }
    public setOnStart(callback: unknown): void {
      this.onStart = callback;
    }
    public setOnContinue(callback: unknown): void {
      this.onContinue = callback;
    }
    public whenLaunched(): Promise<void> {
      return Promise.resolve();
    }
    public show(): void {
      this.showing = true;
      shell.log.push('menu:show');
    }
    public hide(): void {
      this.showing = false;
      shell.log.push('menu:hide');
    }
    public reloadFromStorage(): void {
      shell.log.push('menu:reload');
    }
    public dispose(): void {}
  }
  return { StartMenu };
});

vi.mock('@/core/campaign/MenuMusic', () => ({
  MenuMusic: class {
    public install(): void {}
    public onMenuShown(): void {}
    public onMenuHidden(): void {}
    public dispose(): void {}
  },
}));

describe('retry, play again and main menu from the result screen, through main.ts', () => {
  let Real: CoordinatorClass;
  let rigs: CoordinatorRig[] = [];
  let run = 0;
  let originalIsMobile: boolean;
  /**
   * 入口模块自己挂在 window 上的监听（beforeunload）。每个用例重新执行一次 main()，旧的那些
   * 还握着上一个用例的游戏：用例结束时摘掉，免得下一个用例发 beforeunload 时它们也响。
   */
  let mainListeners: Array<Parameters<Window['addEventListener']>> = [];

  beforeAll(async () => {
    const actual = await vi.importActual<{ GameCoordinator: CoordinatorClass }>(
      '@/core/GameCoordinator'
    );
    Real = actual.GameCoordinator;
  });

  function menu(): FakeMenu {
    return shell.menus[shell.menus.length - 1] as FakeMenu;
  }

  /** 载入入口模块：main() 是同步的，模块一求值完菜单就已经接好 */
  async function loadMain(): Promise<void> {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind.includes('webgl') ? ({} as RenderingContext) : null) as HTMLCanvasElement['getContext']);
    const entry = `@/main?game-over-run=${++run}`;
    const add = window.addEventListener.bind(window);
    const adding = vi.spyOn(window, 'addEventListener').mockImplementation(((
      ...args: Parameters<Window['addEventListener']>
    ) => {
      mainListeners.push(args);
      add(...args);
    }) as Window['addEventListener']);
    await import(/* @vite-ignore */ entry);
    adding.mockRestore();
    expect(shell.menus, 'main.ts created the menu').toHaveLength(1);
    expect(menu().onStart, 'main.ts wired the menu').not.toBeNull();
    expect(menu().onContinue, 'main.ts wired Continue').not.toBeNull();
  }

  /** 第 count 局已经开出来并进入对局 */
  async function game(count: number): Promise<CoordinatorRig> {
    await waitUntil(() => rigs.length >= count);
    expect(rigs.length, `game #${count} was created`).toBeGreaterThanOrEqual(count);
    await rigs[count - 1].playing();
    return rigs[count - 1];
  }

  function alive(): CoordinatorRig[] {
    return rigs.filter((rig) => !rig.isDisposed());
  }

  function settingsOfGame(count: number): GameSettings {
    return shell.booted[count - 1] as GameSettings;
  }

  /** 菜单上的“新战役 / Boss 模式出击” */
  async function startFromMenu(settings: Partial<GameSettings> = {}): Promise<CoordinatorRig> {
    const count = rigs.length + 1;
    menu().onStart?.(runSettings(settings));
    return game(count);
  }

  /** 菜单上的“继续战役” */
  async function continueFromMenu(save: CampaignSaveData): Promise<CoordinatorRig> {
    const count = rigs.length + 1;
    menu().onContinue?.(save);
    return game(count);
  }

  function storedSave(): CampaignSaveData {
    const save = loadCampaignCheckpoint();
    expect(save, 'a valid checkpoint is stored').not.toBeNull();
    return save as CampaignSaveData;
  }

  /** 战役局打到第 2 关第 4 波的检查点后阵亡，面板已经亮出 */
  async function campaignRunDeadAtCheckpoint(): Promise<{ first: CoordinatorRig; raw: string }> {
    await loadMain();
    const first = await startFromMenu({ startLevel: 2 });
    const raw = seedSave();
    first.die();
    expect(readText(actionButtons()[0])).toContain(LABELS.retry.en);
    return { first, raw };
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    GameConfig.isMobile = false;
    window.localStorage.clear();
    const shipped = new DOMParser().parseFromString(SHIPPED_HTML, 'text/html');
    document.body.innerHTML = shipped.body.innerHTML;
    rigs = [];
    shell.menus.length = 0;
    shell.booted.length = 0;
    shell.log.length = 0;
    shell.failConstruct = false;
    shell.build = (options): RigHandle => {
      const rig = createCoordinatorRig(Real, options as HostOptions);
      rigs.push(rig);
      return {
        boot: (settings) => rig.boot(settings as GameSettings),
        saveInBackground: () => rig.call<void>('saveCampaignInBackground'),
        dispose: () => rig.dispose(),
      };
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    for (const rig of alive()) {
      rig.dispose();
    }
    await flush();
    for (const [type, listener, options] of mainListeners) {
      window.removeEventListener(type, listener, options);
    }
    mainListeners = [];
    resetKeyboardModel();
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('Retry from checkpoint (spec 1)', () => {
    it('boots a new game resumed from exactly that save, with the save’s level, difficulty, lives and view', async () => {
      const { first, raw } = await campaignRunDeadAtCheckpoint();

      actionButtons()[0].click();
      const second = await game(2);

      expect(second.options.resume).toEqual(JSON.parse(raw));
      expect(second.session.isBossMode()).toBe(false);
      expect(second.session.getLevel()).toBe(2);
      expect(second.session.getDifficulty()).toBe(4);
      expect(second.lives()).toBe(2);
      expect(second.cameraMode()).toBe('first-person');
      expect(settingsOfGame(2)).toMatchObject({ gameMode: 'normal', startLevel: 2, testScore: 0 });
      expect(first.isDisposed(), 'the dead game was disposed').toBe(true);
      expect(alive()).toEqual([second]);
      expect(menu().showing, 'the menu stays away').toBe(false);
    });

    it('leaves the stored checkpoint byte-for-byte: panel, retry, and the new game starting up', async () => {
      await loadMain();
      const first = await startFromMenu({ startLevel: 2 });
      const raw = seedSave();
      const everything = storageSnapshot();

      first.die();
      expect(rawSave(), 'after the panel came up').toBe(raw);

      actionButtons()[0].click();
      expect(rawSave(), 'right after the press').toBe(raw);

      await game(2);
      await flush(8);
      expect(rawSave(), 'after the resumed game started').toBe(raw);
      expect(storageSnapshot()).toEqual(everything);
    });

    it('takes the old result panel away at once and starts the new game without one', async () => {
      await campaignRunDeadAtCheckpoint();
      const retry = actionButtons()[0];

      retry.click();

      expect(retry.isConnected, 'nothing left on screen to press a second time').toBe(false);
      await game(2);
      expect(document.querySelectorAll('#hud-settlement-panel')).toHaveLength(1);
      expect(isSettlementUp()).toBe(false);
    });

    it('Main Menu disposes the game, brings the menu back and leaves the checkpoint for Continue', async () => {
      const { first, raw } = await campaignRunDeadAtCheckpoint();
      const everything = storageSnapshot();
      shell.log.length = 0;

      actionButtons()[1].click();
      await flush(8);

      expect(first.isDisposed()).toBe(true);
      expect(alive()).toHaveLength(0);
      expect(rigs, 'no new game').toHaveLength(1);
      expect(menu().showing).toBe(true);
      expect(shell.log.indexOf('menu:reload')).toBeGreaterThan(shell.log.indexOf('game:dispose'));
      expect(shell.log.indexOf('menu:show')).toBeGreaterThan(shell.log.indexOf('menu:reload'));
      expect(rawSave()).toBe(raw);
      expect(storageSnapshot()).toEqual(everything);
    });
  });

  describe('one game per press (spec 8)', () => {
    /**
     * 第 count 局造出来之前一直按：先在同一刻连按三下，再在启动过程的每一小步里各按一下。
     * 返回一共按了几下。
     *
     * 为什么不只是同步连按：vi.mock 的工厂替身对“同一个模块里同时在途的第二个动态导入”不生效
     * （vitest 的已知限制），那一次拿到的是真模块，真的 GameCoordinator 在 jsdom 里建不出渲染器，
     * 被 bootGame 的 catch 吞掉。于是只同步连按的话，就算没有防重入也只多出一个错误画面，
     * 不会多出一局。把按键铺满整个启动过程，就有按键落在替身生效的那几步里。
     *
     * 按在面板按钮上的那两条用例里，同一个键的后几下先被面板自己的“每个动作只交一次”挡掉；
     * 直接反复调用宿主回调的两条才压到 bootGame 的防重入上。
     */
    async function hammerUntilGame(count: number, press: () => void): Promise<number> {
      let presses = 0;
      const pressOnce = (): void => {
        press();
        presses++;
      };
      pressOnce();
      pressOnce();
      pressOnce();
      for (let step = 0; step < 400 && rigs.length < count; step++) {
        await (step % 8 === 7 ? flush(1) : Promise.resolve());
        if (rigs.length < count) {
          pressOnce();
        }
      }
      return presses;
    }

    /** 连按之后：只多出一局，没有出错画面，也没有第二个游戏被造出来又丢掉 */
    async function expectOneNewGame(first: CoordinatorRig): Promise<CoordinatorRig> {
      const second = await game(2);
      await flush(12);

      expect(rigs, 'the dead game and one new one').toHaveLength(2);
      expect(shell.booted, 'games booted').toHaveLength(2);
      expect(
        shell.log.filter((entry) => entry === 'game:construct'),
        'games constructed'
      ).toHaveLength(2);
      expect(
        document.querySelector('#loading-screen [role="alert"]'),
        'no "failed to start" screen'
      ).toBeNull();
      expect(first.isDisposed()).toBe(true);
      expect(alive()).toEqual([second]);
      return second;
    }

    it('a double tap on Retry from checkpoint produces one game', async () => {
      const { first, raw } = await campaignRunDeadAtCheckpoint();
      const retry = actionButtons()[0];

      const presses = await hammerUntilGame(2, () => retry.click());

      expect(presses, 'presses that landed while the game was being created').toBeGreaterThan(3);
      const second = await expectOneNewGame(first);
      expect(second.options.resume).toEqual(JSON.parse(raw));
      expect(rawSave()).toBe(raw);
    });

    it('the host callback called again and again while the game is being created produces one game', async () => {
      const { first, raw } = await campaignRunDeadAtCheckpoint();
      const save = storedSave();

      const presses = await hammerUntilGame(2, () =>
        first.options.onContinueFromCheckpoint?.(save)
      );

      expect(presses).toBeGreaterThan(3);
      const second = await expectOneNewGame(first);
      expect(second.options.resume).toEqual(JSON.parse(raw));
      expect(rawSave()).toBe(raw);
    });

    it('a double tap on Play Again produces one game', async () => {
      await loadMain();
      const first = await startFromMenu();
      first.die();
      const playAgain = actionButtons()[0];
      expect(readText(playAgain)).toBe(LABELS.playAgain.en);

      const presses = await hammerUntilGame(2, () => playAgain.click());

      expect(presses).toBeGreaterThan(3);
      const second = await expectOneNewGame(first);
      expect(second.options.resume ?? null).toBeNull();
    });

    it('the host’s Play Again callback called again and again while the game is being created produces one game', async () => {
      await loadMain();
      const first = await startFromMenu();
      first.die();

      const presses = await hammerUntilGame(2, () => first.options.onRetry?.());

      expect(presses).toBeGreaterThan(3);
      const second = await expectOneNewGame(first);
      expect(second.options.resume ?? null).toBeNull();
    });

    it('a retry whose boot fails says so, keeps the checkpoint, and a later attempt works', async () => {
      const { first, raw } = await campaignRunDeadAtCheckpoint();
      const save = storedSave();
      shell.failConstruct = true;

      actionButtons()[0].click();
      await waitUntil(() => document.querySelector('#loading-screen [role="alert"]') !== null, 200);

      expect(document.querySelector('#loading-screen [role="alert"]')).not.toBeNull();
      expect(rigs, 'no second game').toHaveLength(1);
      expect(first.isDisposed()).toBe(true);
      expect(rawSave()).toBe(raw);

      shell.failConstruct = false;
      first.options.onContinueFromCheckpoint?.(save);
      const second = await game(2);

      expect(second.options.resume).toEqual(JSON.parse(raw));
      expect(alive()).toEqual([second]);
      expect(rawSave()).toBe(raw);
    });
  });

  describe('dying again after a retry (spec 6)', () => {
    it('offers the same retry again, with the checkpoint still untouched', async () => {
      const { raw } = await campaignRunDeadAtCheckpoint();
      actionButtons()[0].click();
      const second = await game(2);

      second.die();

      const [first, last] = actionButtons();
      expect(settlementTitle()).toBe(LABELS.failed.en);
      expect(readText(first)).toContain(LABELS.retry.en);
      expect(readText(first)).toContain(WAVE_4.en);
      expect(readText(last)).toBe(LABELS.mainMenu.en);
      expect(actionTexts()).toHaveLength(2);
      expect(readText(settlementPanel())).not.toMatch(START_OVER_WORDING);
      expect(document.activeElement).toBe(first);
      expect(rawSave()).toBe(raw);
    });

    it('can be retried a second and a third time, one game alive each time', async () => {
      const { raw } = await campaignRunDeadAtCheckpoint();

      for (let attempt = 2; attempt <= 4; attempt++) {
        actionButtons()[0].click();
        const next = await game(attempt);
        expect(alive(), `attempt ${attempt}`).toEqual([next]);
        expect(next.options.resume, `attempt ${attempt}`).toEqual(JSON.parse(raw));
        next.die();
        expect(rawSave(), `attempt ${attempt}`).toBe(raw);
      }
      expect(rigs).toHaveLength(4);
    });

    it('after progress in the resumed run, the retry goes back to the newer checkpoint', async () => {
      await campaignRunDeadAtCheckpoint();
      actionButtons()[0].click();
      const second = await game(2);

      second.completeWave(3);
      const newer = rawSave();
      second.die();

      expect(readText(actionButtons()[0])).toContain(WAVE_5.en);
      expect(readText(actionButtons()[0])).not.toContain(WAVE_4.en);
      actionButtons()[0].click();
      const third = await game(3);
      expect(third.options.resume).toMatchObject({ checkpoint: 'wave', level: 2, wave: 4 });
      expect(third.options.resume).toEqual(JSON.parse(newer as string));
      expect(rawSave()).toBe(newer);
    });

    it('a game continued from the main menu behaves the same on its first death', async () => {
      await loadMain();
      const raw = seedSave();
      const first = await continueFromMenu(storedSave());
      expect(rawSave(), 'continuing left the save in place').toBe(raw);

      first.die();
      expect(readText(actionButtons()[0])).toContain(WAVE_4.en);
      actionButtons()[0].click();
      const second = await game(2);

      expect(second.options.resume).toEqual(JSON.parse(raw));
      expect(rawSave()).toBe(raw);
    });
  });

  describe('a save that differs from the saved settings (spec 6)', () => {
    it('the retried game follows the save for level, difficulty, lives and view, the device for audio and quality', async () => {
      saveStartFlowSettings({
        difficulty: 1,
        startLevel: 7,
        playerLives: 9,
        cameraMode: 'third-person',
        gameMode: 'boss',
        sfxVolume: 0.3,
        musicVolume: 0.2,
        qualityPreset: 'performance',
      });
      const settingsBefore = window.localStorage.getItem(START_MENU_STORAGE_KEY);
      await loadMain();
      const raw = seedSave();
      const first = await continueFromMenu(storedSave());
      first.die();

      actionButtons()[0].click();
      const second = await game(2);

      expect(settingsOfGame(2)).toMatchObject({
        difficulty: 4,
        startLevel: 2,
        playerLives: 2,
        cameraMode: 'first-person',
        gameMode: 'normal',
        testScore: 0,
        sfxVolume: 0.3,
        musicVolume: 0.2,
        qualityPreset: 'performance',
      });
      expect(second.session.isBossMode()).toBe(false);
      expect(second.session.getDifficulty()).toBe(4);
      expect(rawSave()).toBe(raw);
      expect(
        window.localStorage.getItem(START_MENU_STORAGE_KEY),
        'the saved settings were not overwritten with the checkpoint’s'
      ).toBe(settingsBefore);
    });
  });

  describe('Play Again where there is nothing to retry (spec 2)', () => {
    it('boss mode with a campaign save in storage: same boss run again, save untouched throughout', async () => {
      await loadMain();
      const raw = seedSave();
      const first = await startFromMenu({ gameMode: 'boss', startLevel: 3, playerLives: 5 });
      expect(rawSave(), 'starting boss mode left the campaign save alone').toBe(raw);
      const everything = storageSnapshot();

      first.die();
      expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
      expect(readText(settlementPanel())).not.toMatch(CHECKPOINT_WORDING);
      expect(rawSave(), 'after the panel came up').toBe(raw);

      actionButtons()[0].click();
      const second = await game(2);
      await flush(8);

      expect(second.options.resume ?? null, 'a fresh run, not a resume').toBeNull();
      expect(second.session.isBossMode()).toBe(true);
      expect(second.session.getLevel()).toBe(3);
      expect(second.lives()).toBe(5);
      expect(settingsOfGame(2)).toEqual(settingsOfGame(1));
      expect(alive()).toEqual([second]);
      expect(rawSave(), 'after Play Again booted the next run').toBe(raw);

      second.die();
      actionButtons()[1].click();
      await flush(4);

      expect(alive()).toHaveLength(0);
      expect(menu().showing).toBe(true);
      expect(rawSave(), 'after Main Menu').toBe(raw);
      expect(storageSnapshot()).toEqual(everything);
    });

    it('a campaign run that died before its first checkpoint: same run again, still nothing saved', async () => {
      await loadMain();
      const first = await startFromMenu({ difficulty: 2, playerLives: 4 });
      expect(rawSave()).toBeNull();

      first.die();
      expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
      actionButtons()[0].click();
      const second = await game(2);

      expect(second.options.resume ?? null).toBeNull();
      expect(second.session.isBossMode()).toBe(false);
      expect(second.session.getLevel()).toBe(1);
      expect(second.session.getDifficulty()).toBe(2);
      expect(second.lives()).toBe(4);
      expect(settingsOfGame(2)).toEqual(settingsOfGame(1));
      expect(alive()).toEqual([second]);
      expect(rawSave()).toBeNull();
    });
  });

  describe('language changed between runs (spec 5)', () => {
    function otherLocale(locale: Locale): Locale {
      return locale === 'en' ? 'zh-CN' : 'en';
    }

    it.each(LOCALES)('the next run’s result panel is in %s', async (locale) => {
      saveStartFlowSettings({ language: otherLocale(locale) });
      await loadMain();
      const first = await startFromMenu({ startLevel: 2 });
      seedSave();
      first.die();
      expect(readText(actionButtons()[0])).toContain(textIn(LABELS.retry, otherLocale(locale)));
      expect(readText(actionButtons()[0])).toContain(textIn(WAVE_4, otherLocale(locale)));

      // 两局之间换语言（暂停菜单 / 主菜单的设置都是这样落到 i18n 上的）
      saveStartFlowSettings({ language: locale });
      setLocale(locale);
      actionButtons()[0].click();
      const second = await game(2);
      second.die();

      const [retry, mainMenu] = actionButtons();
      expect(settlementTitle()).toBe(textIn(LABELS.failed, locale));
      expect(readText(retry)).toContain(textIn(LABELS.retry, locale));
      expect(readText(retry)).toContain(textIn(WAVE_4, locale));
      expect(readText(retry)).not.toContain(textIn(WAVE_4, otherLocale(locale)));
      expect(readText(mainMenu)).toBe(textIn(LABELS.mainMenu, locale));
    });

    it.each(LOCALES)('Play Again’s next run too (%s)', async (locale) => {
      saveStartFlowSettings({ language: otherLocale(locale) });
      await loadMain();
      const first = await startFromMenu();
      first.die();
      expect(actionTexts()).toEqual([
        textIn(LABELS.playAgain, otherLocale(locale)),
        textIn(LABELS.mainMenu, otherLocale(locale)),
      ]);

      saveStartFlowSettings({ language: locale });
      setLocale(locale);
      actionButtons()[0].click();
      const second = await game(2);
      second.die();

      expect(settlementTitle()).toBe(textIn(LABELS.failed, locale));
      expect(actionTexts()).toEqual([
        textIn(LABELS.playAgain, locale),
        textIn(LABELS.mainMenu, locale),
      ]);
    });
  });

  describe('the page going away: background save (batch R2)', () => {
    /** 第 2 关打完第 1 波之后的存档点 */
    const SECOND_WAVE = { checkpoint: 'wave', level: 2, wave: 1 } as const;
    const WAVE_2 = 'Ch. 2 · Sandstorm · Wave 2';
    let page: PageLifecycle;
    let setItem: Mock<(key: string, value: string) => void>;

    beforeEach(() => {
      page = installPageLifecycle();
      setItem = vi.spyOn(Storage.prototype, 'setItem') as unknown as typeof setItem;
    });

    afterEach(() => {
      expect(page.errors(), 'nothing was thrown out of a page event handler').toEqual([]);
      page.restore();
    });

    /** 对检查点那个键的写入次数 */
    function saveWrites(): number {
      return setItem.mock.calls.filter(([key]) => key === CAMPAIGN_SAVE_KEY).length;
    }

    function backgroundSaves(): number {
      return shell.log.filter((entry) => entry === 'game:background-save').length;
    }

    /** 从菜单开出战役局，打完第 2 关第 1 波：检查点在第 2 波，三条命 */
    async function runAtSavePoint(): Promise<CoordinatorRig> {
      await loadMain();
      const first = await startFromMenu({ startLevel: 2 });
      first.completeWave(0);
      expect(storedSave()).toMatchObject({ ...SECOND_WAVE, lives: 3, score: 0 });
      return first;
    }

    function goAwayEveryWay(): void {
      page.hide();
      page.pageHide();
      page.pageShow();
      page.show();
      page.beforeUnload();
      page.pageHide();
    }

    it('closing the page saves the run as it is now, before the game is disposed', async () => {
      const first = await runAtSavePoint();
      first.setScore(6_600);
      first.die(2);
      shell.log.length = 0;
      const writesBefore = saveWrites();

      page.beforeUnload();

      expect(storedSave()).toMatchObject({ ...SECOND_WAVE, score: 6_600, lives: 3 });
      expect(saveWrites() - writesBefore).toBe(1);
      expect(shell.log).toEqual(['game:background-save', 'game:dispose']);
      expect(first.isDisposed()).toBe(true);

      // 页面真的走了：后面跟着的 pagehide / visibilitychange 不再写
      const raw = rawSave();
      first.setScore(9_900);
      page.pageHide();
      page.hide();
      expect(saveWrites() - writesBefore).toBe(1);
      expect(rawSave()).toBe(raw);
    });

    it('closing after the tab was already hidden does not write a second time', async () => {
      const first = await runAtSavePoint();
      first.setScore(1_000);
      page.hide();
      const raw = rawSave();
      expect(storedSave().score).toBe(1_000);
      const writesBefore = saveWrites();
      first.setScore(2_000);

      page.pageHide();
      page.beforeUnload();

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);
      expect(first.isDisposed()).toBe(true);
    });

    it('hidden, back, then closed: the close saves what happened since', async () => {
      const first = await runAtSavePoint();
      first.setScore(1_000);
      page.hide();
      page.show();
      first.setScore(2_000);
      first.die(2);

      page.beforeUnload();

      expect(storedSave()).toMatchObject({ ...SECOND_WAVE, score: 2_000, lives: 3 });
    });

    it('on the menu, before any game was started: nothing is written, nothing is thrown', async () => {
      await loadMain();
      const raw = seedSave();
      const everything = storageSnapshot();
      const writesBefore = saveWrites();

      goAwayEveryWay();

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);
      expect(storageSnapshot()).toEqual(everything);
      expect(backgroundSaves(), 'there is no game to ask').toBe(0);
      expect(menu().showing).toBe(true);
    });

    it('while the game is still being created: the save being continued stays as it is', async () => {
      await loadMain();
      const raw = seedSave();
      const everything = storageSnapshot();
      const writesBefore = saveWrites();

      menu().onContinue?.(storedSave());
      page.hide();
      page.pageHide();
      expect(rawSave()).toBe(raw);
      const first = await game(1);

      expect(saveWrites()).toBe(writesBefore);
      expect(rawSave()).toBe(raw);
      expect(storageSnapshot()).toEqual(everything);
      expect(first.options.resume).toEqual(JSON.parse(raw));
    });

    it('back on the menu after Main Menu: the dead run writes nothing more', async () => {
      const first = await runAtSavePoint();
      first.setScore(1_000);
      first.die();
      actionButtons()[1].click();
      await flush(8);
      expect(menu().showing).toBe(true);
      expect(first.isDisposed()).toBe(true);
      const everything = storageSnapshot();
      const writesBefore = saveWrites();
      shell.log.length = 0;

      goAwayEveryWay();

      expect(saveWrites()).toBe(writesBefore);
      expect(storageSnapshot()).toEqual(everything);
      expect(backgroundSaves()).toBe(0);
    });

    it('back on the menu after Save & Exit: the record stays as Save & Exit wrote it', async () => {
      const first = await runAtSavePoint();
      first.setScore(1_000);
      first.die(2);
      first.die(1);
      // 暂停菜单的“保存并退出”：先存，再交回宿主
      expect(first.campaign.saveForExit().kind).toBe('saved');
      first.options.onExitToMenu?.();
      await flush(8);
      expect(menu().showing).toBe(true);
      expect(storedSave()).toMatchObject({ ...SECOND_WAVE, score: 1_000, lives: 1 });
      const everything = storageSnapshot();
      const writesBefore = saveWrites();

      goAwayEveryWay();

      expect(saveWrites()).toBe(writesBefore);
      expect(storageSnapshot()).toEqual(everything);
      expect(storedSave().lives).toBe(1);
    });

    it('one write per hide, by the game that is alive, after a retry, the menu, Continue and another retry', async () => {
      const first = await runAtSavePoint();
      first.die();
      actionButtons()[0].click();
      const second = await game(2);
      second.die();
      actionButtons()[1].click();
      await flush(8);
      expect(menu().showing).toBe(true);
      const third = await continueFromMenu(storedSave());
      third.die();
      actionButtons()[0].click();
      const fourth = await game(4);
      expect(alive()).toEqual([fourth]);
      // 这一局打到下一波的检查点，之后又得了些分
      fourth.completeWave(1);
      expect(storedSave()).toMatchObject({ checkpoint: 'wave', level: 2, wave: 2 });
      fourth.setScore(8_800);
      const writesBefore = saveWrites();
      shell.log.length = 0;

      page.hide();
      page.pageHide();

      expect(saveWrites() - writesBefore).toBe(1);
      expect(storedSave()).toMatchObject({ checkpoint: 'wave', level: 2, wave: 2, score: 8_800 });

      page.pageShow();
      page.show();
      fourth.setScore(9_900);
      page.beforeUnload();

      expect(saveWrites() - writesBefore).toBe(2);
      expect(storedSave().score).toBe(9_900);
      expect(backgroundSaves(), 'only the live game was asked on close').toBe(1);
      expect(alive()).toHaveLength(0);
    });

    it('three lives at the wave start, two lost, hidden, back, shot down: the retried game has three lives', async () => {
      const first = await runAtSavePoint();
      first.setScore(4_200);
      first.die(2);
      first.die(1);

      page.hide();
      page.pageHide();
      page.pageShow();
      page.show();
      expect(first.lives(), 'the running game keeps its one life').toBe(1);
      expect(alive()).toEqual([first]);
      const raw = rawSave();
      first.die(0);

      expect(settlementTitle()).toBe(LABELS.failed.en);
      expect(readText(actionButtons()[0])).toContain(LABELS.retry.en);
      expect(readText(actionButtons()[0])).toContain(WAVE_2);
      actionButtons()[0].click();
      const second = await game(2);

      expect(second.options.resume).toEqual(JSON.parse(raw as string));
      expect(second.options.resume).toMatchObject({ ...SECOND_WAVE, lives: 3, score: 4_200 });
      expect(second.lives()).toBe(3);
      expect(settingsOfGame(2)).toMatchObject({
        startLevel: 2,
        playerLives: 3,
        gameMode: 'normal',
      });
      expect(rawSave(), 'the retry left the record in place').toBe(raw);
    });

    it('…and Continue on the next visit starts that wave with what the hide stored', async () => {
      const first = await runAtSavePoint();
      first.setScore(4_200);
      first.die(2);
      first.die(1);
      page.hide();
      const raw = rawSave();
      page.show();

      // 下一次打开游戏：菜单读出这份存档，交给“继续战役”
      const second = await continueFromMenu(storedSave());

      expect(first.isDisposed()).toBe(true);
      expect(second.options.resume).toEqual(JSON.parse(raw as string));
      expect(second.options.resume).toMatchObject({ ...SECOND_WAVE, lives: 3, score: 4_200 });
      expect(second.lives()).toBe(3);
      expect(second.session.getLevel()).toBe(2);
      expect(rawSave()).toBe(raw);
    });
  });
});
