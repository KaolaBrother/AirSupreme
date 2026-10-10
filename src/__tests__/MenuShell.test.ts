import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadStartFlowSettings,
  saveStartFlowSettings,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { loadCampaignCheckpoint, type CampaignSaveData } from '@/core/save/SaveSystem';
import type { Locale, LocalizedText } from '@/i18n';
import type { GameSettings, StartMenu } from '@/ui/StartMenu';
import { LOCALES, textIn } from './i18nTestUtils';
import {
  byId,
  CHECKPOINT,
  click,
  isOperable,
  isShown,
  prepareMenuEnvironment,
  readableText,
  resetMenuEnvironment,
  seedCheckpoint,
  settle,
  settleUntil,
  stubMatchMedia,
  useMenuFakeTimers,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 10：启动外壳（src/main.ts + index.html 的 #loading-screen）。
 *
 * 入口模块启动时不等任何东西：文档解析完（readyState 不再是 loading）就当场建好菜单，随 index.html
 * 一起发下来的加载画面随即淡出；启动不了（没有 WebGL、菜单建不出来）时加载画面换成一条报错。
 * 加载画面与“进入战场”画面按界面语言显示、不带表情符号；从菜单开局要等菜单的过场
 * （whenLaunched()）结束、菜单已经隐藏之后才启动游戏；退回主菜单时先销毁游戏、
 * 再 reloadFromStorage()、再显示菜单。
 *
 * 入口模块每个用例重新载入一次（vi.resetModules）。游戏本体（GameCoordinator）与菜单音乐
 * 换成记账的替身；菜单是真的，页面骨架取自仓库里的 index.html。
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHIPPED_HTML = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');

/** 表情符号 / 图画字符（✈ ⚠ 🎮 之类）；省略号、间隔号、汉字都不算 */
const EMOJI = /\p{Extended_Pictographic}/u;

const COPY = {
  pageTitle: { en: 'Air Supreme - 3D Air Combat', zh: 'Air Supreme - 3D 空战游戏' },
  loading: { en: 'Loading', zh: '加载中' },
  tagline: { en: 'The Skydome War', zh: '天穹之战' },
  entering: { en: 'Entering the battlefield', zh: '正在进入战场' },
  failed: { en: 'Failed to load', zh: '加载失败' },
  noWebGL: { en: 'Your browser does not support WebGL.', zh: '您的浏览器不支持 WebGL' },
  initFailed: { en: 'failed to initialize', zh: '初始化失败' },
  retryAdvice: {
    en: 'Try reloading the page or using a different browser.',
    zh: '请尝试刷新页面或使用其他浏览器',
  },
  newCampaign: { en: 'New Campaign', zh: '新战役' },
} satisfies Record<string, LocalizedText>;

interface CoordinatorOptions {
  showStartMenu?: boolean;
  onRetry?: () => void;
  onExitToMenu?: () => void;
  resume?: CampaignSaveData | null;
  onContinueFromCheckpoint?: (save: CampaignSaveData) => void;
}

interface FakeCoordinator {
  options: CoordinatorOptions;
  booted: GameSettings[];
  disposed: boolean;
  /** 构造的那一刻菜单还在屏幕上吗 */
  menuShowingAtConstruction: boolean;
  /** 构造的那一刻（连自己在内）还没销毁的游戏个数 */
  aliveAtConstruction: number;
}

const game = vi.hoisted(() => ({
  instances: [] as unknown[],
  /** 事件先后：game:construct / game:boot / game:dispose / menu:… */
  log: [] as string[],
  failConstruct: false,
}));

function coordinators(): FakeCoordinator[] {
  return game.instances as FakeCoordinator[];
}

vi.mock('@/core/GameCoordinator', () => {
  class GameCoordinator {
    public static warmRuntimeChunks(): Promise<void> {
      return Promise.resolve();
    }
    public readonly booted: unknown[] = [];
    public disposed = false;
    public readonly menuShowingAtConstruction: boolean;
    public readonly aliveAtConstruction: number;

    constructor(public readonly options: unknown) {
      if (game.failConstruct) {
        throw new Error('the game runtime could not be created');
      }
      const menu = document.getElementById('start-menu');
      this.menuShowingAtConstruction = menu !== null && menu.style.display !== 'none';
      game.instances.push(this);
      this.aliveAtConstruction = (game.instances as GameCoordinator[]).filter(
        (instance) => !instance.disposed
      ).length;
      game.log.push('game:construct');
    }
    public boot(settings: unknown): void {
      this.booted.push(settings);
      game.log.push('game:boot');
    }
    public dispose(): void {
      this.disposed = true;
      game.log.push('game:dispose');
    }
  }
  return { GameCoordinator };
});

vi.mock('@/core/campaign/MenuMusic', () => ({
  MenuMusic: class {
    public install(): void {}
    public onMenuShown(): void {
      game.log.push('music:menu-shown');
    }
    public onMenuHidden(): void {
      game.log.push('music:menu-hidden');
    }
    public dispose(): void {}
  },
}));

interface BootOptions {
  language?: Locale;
  /**
   * 入口模块载入那一刻文档所处的状态（缺省 'complete'）。
   * 'loading' = 文档还没解析完：入口模块要等 DOMContentLoaded，见 Shell.documentReady()
   */
  readyState?: DocumentReadyState;
  /** 菜单建不出来（构造函数抛错） */
  failMenu?: boolean;
  /** 浏览器不支持 WebGL */
  noWebGL?: boolean;
}

interface Shell {
  /** 入口模块所用的那份 i18n（与本文件静态导入的不是同一个实例） */
  i18n: typeof import('@/i18n');
  /** 文档解析完了：readyState 变成 'interactive'，并派发 DOMContentLoaded */
  documentReady: () => void;
}

/** 入口模块交给菜单的两个回调：菜单“要求开局 / 续玩”时调用的就是它们 */
interface MenuRequests {
  start: ((settings: GameSettings) => void) | null;
  resume: ((save: CampaignSaveData) => void) | null;
}

describe('boot shell: src/main.ts and #loading-screen (batch X5, spec 10)', () => {
  let menus: StartMenu[] = [];
  let menuRequests: MenuRequests = { start: null, resume: null };
  let menuModuleReplaced = false;
  let originalTitle: string;
  let originalLang: string | null;
  let consoleError: ReturnType<typeof vi.spyOn>;

  function loadingScreen(): HTMLElement {
    return byId('loading-screen');
  }

  /** 加载 / 进入战场 / 报错画面此刻盖在页面上吗（.hidden 是全站的“不显示”开关） */
  function isLoadingScreenUp(): boolean {
    const screen = document.getElementById('loading-screen');
    return screen !== null && !screen.classList.contains('hidden') && isShown(screen);
  }

  function loadingText(): string {
    return readableText(loadingScreen());
  }

  function isMenuShowing(): boolean {
    const menu = document.getElementById('start-menu');
    return menu !== null && isShown(menu);
  }

  /** 载入入口模块，等它走到“菜单出现 / 报错 / 等文档解析完” */
  async function boot(options: BootOptions = {}): Promise<Shell> {
    if (options.language) {
      saveStartFlowSettings({ language: options.language });
    }
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      !options.noWebGL && kind.includes('webgl')
        ? ({} as RenderingContext)
        : null) as HTMLCanvasElement['getContext']);

    let readyState: DocumentReadyState = options.readyState ?? 'complete';
    vi.spyOn(document, 'readyState', 'get').mockImplementation(() => readyState);
    const documentReady = (): void => {
      readyState = 'interactive';
      document.dispatchEvent(new Event('DOMContentLoaded'));
    };

    if (options.failMenu) {
      // 菜单建不出来：入口模块拿到的 StartMenu 一构造就抛错（真的菜单这个用例里不出场）
      vi.doMock('@/ui/StartMenu', () => ({
        StartMenu: class {
          constructor() {
            throw new Error('the menu could not be built');
          }
        },
      }));
      menuModuleReplaced = true;
      await import('@/main');
      const failedShellI18n = await import('@/i18n');
      await settle();
      return { i18n: failedShellI18n, documentReady };
    }

    // 入口模块自己造菜单、不对外暴露：从原型上接住实例，并给生命周期调用记个先后
    const { StartMenu: MenuClass } = await import('@/ui/StartMenu');
    const original = {
      reloadFromStorage: MenuClass.prototype.reloadFromStorage,
      show: MenuClass.prototype.show,
      hide: MenuClass.prototype.hide,
      whenLaunched: MenuClass.prototype.whenLaunched,
      setOnStart: MenuClass.prototype.setOnStart,
      setOnContinue: MenuClass.prototype.setOnContinue,
    };
    vi.spyOn(MenuClass.prototype, 'setOnStart').mockImplementation(function (
      this: StartMenu,
      callback
    ) {
      if (!menus.includes(this)) {
        menus.push(this);
      }
      menuRequests.start = callback;
      original.setOnStart.call(this, callback);
    });
    vi.spyOn(MenuClass.prototype, 'setOnContinue').mockImplementation(function (
      this: StartMenu,
      callback
    ) {
      menuRequests.resume = callback;
      original.setOnContinue.call(this, callback);
    });
    vi.spyOn(MenuClass.prototype, 'reloadFromStorage').mockImplementation(function (
      this: StartMenu
    ) {
      game.log.push('menu:reloadFromStorage');
      original.reloadFromStorage.call(this);
    });
    vi.spyOn(MenuClass.prototype, 'show').mockImplementation(function (this: StartMenu) {
      game.log.push('menu:show');
      original.show.call(this);
    });
    vi.spyOn(MenuClass.prototype, 'hide').mockImplementation(function (this: StartMenu) {
      game.log.push('menu:hide');
      original.hide.call(this);
    });
    vi.spyOn(MenuClass.prototype, 'whenLaunched').mockImplementation(function (this: StartMenu) {
      const promise = original.whenLaunched.call(this);
      game.log.push('menu:whenLaunched');
      void promise.then(() => game.log.push('menu:launched'));
      return promise;
    });

    await import('@/main');
    const i18n = await import('@/i18n');
    if (readyState !== 'loading' && !options.noWebGL) {
      await settleUntil(() => document.getElementById('start-menu') !== null);
    }
    await settle();
    return { i18n, documentReady };
  }

  /** 等替身游戏被造出来（import('./core/GameCoordinator') 要让出几轮事件循环） */
  async function gameBooted(count: number = 1): Promise<FakeCoordinator> {
    await settleUntil(
      () => coordinators().length >= count && coordinators()[count - 1].booted.length > 0
    );
    await settle(2);
    expect(coordinators().length, 'a game was booted').toBeGreaterThanOrEqual(count);
    return coordinators()[count - 1];
  }

  /** 点“新战役”，走完过场，等游戏启动 */
  async function startRun(count: number = 1): Promise<FakeCoordinator> {
    click('start-btn');
    await vi.advanceTimersByTimeAsync(1500);
    return gameBooted(count);
  }

  function logIndex(entry: string, from: number = 0): number {
    return game.log.indexOf(entry, from);
  }

  beforeEach(() => {
    originalTitle = document.title;
    originalLang = document.documentElement.getAttribute('lang');
    prepareMenuEnvironment();
    useMenuFakeTimers();
    const shipped = new DOMParser().parseFromString(SHIPPED_HTML, 'text/html');
    document.title = shipped.title;
    document.documentElement.setAttribute('lang', shipped.documentElement.lang);
    document.body.innerHTML = shipped.body.innerHTML;
    menus = [];
    menuRequests = { start: null, resume: null };
    game.instances.length = 0;
    game.log.length = 0;
    game.failConstruct = false;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    for (const menu of menus) {
      menu.dispose();
    }
    menus = [];
    await settle(2);
    if (menuModuleReplaced) {
      vi.doUnmock('@/ui/StartMenu');
      menuModuleReplaced = false;
    }
    resetMenuEnvironment();
    document.title = originalTitle;
    if (originalLang === null) {
      document.documentElement.removeAttribute('lang');
    } else {
      document.documentElement.setAttribute('lang', originalLang);
    }
  });

  describe('the loading screen as shipped in index.html', () => {
    it('is the first thing on the page, with the game name and a loading line', () => {
      const shipped = new DOMParser().parseFromString(SHIPPED_HTML, 'text/html');
      const screen = shipped.getElementById('loading-screen');

      expect(screen, '#loading-screen in index.html').not.toBeNull();
      expect(screen?.classList.contains('hidden'), 'visible before any script runs').toBe(false);
      expect(readableText(screen)).toMatch(/AIR\s*SUPREME/);
      expect(readableText(screen)).toContain('Loading');
      expect(shipped.body.firstElementChild).toBe(screen);
    });

    it('carries no emoji', () => {
      const shipped = new DOMParser().parseFromString(SHIPPED_HTML, 'text/html');
      expect(shipped.getElementById('loading-screen')?.textContent ?? '').not.toMatch(EMOJI);
      expect(shipped.title).not.toMatch(EMOJI);
    });

    it('is on screen while the game script downloads: no script blocks the page before it', () => {
      // 启动时不再等任何东西，加载画面只管“脚本还没下载、执行完”的这一段：
      // 页面里的脚本都不阻塞解析（模块脚本 / defer / async），而且排在加载画面之后
      const shipped = new DOMParser().parseFromString(SHIPPED_HTML, 'text/html');
      const screen = shipped.getElementById('loading-screen') as HTMLElement;
      const scripts = Array.from(shipped.querySelectorAll('script'));

      expect(scripts.some((script) => (script.getAttribute('src') ?? '').includes('main'))).toBe(
        true
      );
      for (const script of scripts) {
        const where = script.getAttribute('src') ?? 'inline script';
        expect(
          script.getAttribute('type') === 'module' ||
            script.hasAttribute('defer') ||
            script.hasAttribute('async'),
          `${where}: does not block parsing`
        ).toBe(true);
        expect(
          (screen.compareDocumentPosition(script) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          `${where}: comes after the loading screen`
        ).toBe(true);
      }
    });
  });

  describe('before the document is ready', () => {
    // 入口模块在文档还没解析完时载入（readyState === 'loading'）：等 DOMContentLoaded，
    // 这之前页面上只有随 index.html 发下来的那张加载画面
    it('leaves the shipped loading screen up and builds nothing', async () => {
      await boot({ language: 'zh-CN', readyState: 'loading' });
      await vi.advanceTimersByTimeAsync(2000);

      expect(isLoadingScreenUp()).toBe(true);
      expect(loadingText()).toMatch(/AIR\s*SUPREME/);
      expect(loadingScreen().querySelector('[role="alert"]'), 'no error').toBeNull();
      expect(document.getElementById('start-menu'), 'no menu yet').toBeNull();
      expect(coordinators(), 'no game').toHaveLength(0);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('the title screen is there the moment the document is ready: nothing else is waited for', async () => {
      const shell = await boot({ readyState: 'loading' });
      expect(document.getElementById('start-menu')).toBeNull();

      shell.documentReady();

      // 同一步里：没有让出事件循环，也没有走任何定时器
      expect(isMenuShowing()).toBe(true);
      expect(isOperable(byId('start-btn'))).toBe(true);
    });

    it.each(LOCALES)(
      'once ready, the title screen takes over in the saved language (%s)',
      async (locale) => {
        const shell = await boot({ language: locale, readyState: 'loading' });

        shell.documentReady();
        await vi.advanceTimersByTimeAsync(1000);

        expect(isMenuShowing()).toBe(true);
        expect(readableText(byId('start-btn'))).toContain(textIn(COPY.newCampaign, locale));
        expect(document.title).toBe(textIn(COPY.pageTitle, locale));
        expect(document.documentElement.lang).toBe(locale);
        expect(isLoadingScreenUp()).toBe(false);
        expect(coordinators(), 'no game was started').toHaveLength(0);
      }
    );
  });

  describe('at start-up', () => {
    it.each(['interactive', 'complete'] as const)(
      'starts straight away when the document is already %s',
      async (readyState) => {
        await boot({ readyState });

        expect(isMenuShowing()).toBe(true);
        expect(document.querySelectorAll('#start-menu')).toHaveLength(1);
      }
    );

    it.each(LOCALES)(
      'the loading screen reads in the saved language for as long as it is up (%s)',
      async (locale) => {
        await boot({ language: locale });

        // 没有要等的东西了：菜单已经在它后面，加载画面正在淡出（还没收起）
        expect(isLoadingScreenUp(), 'it leaves with a fade, not in the same frame').toBe(true);
        expect(loadingText()).toContain(textIn(COPY.loading, locale));
        expect(loadingText()).toContain(textIn(COPY.tagline, locale));
        expect(loadingText()).toMatch(/AIR\s*SUPREME/);
        expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
        expect(loadingScreen().querySelector('[role="alert"]'), 'no error').toBeNull();
        expect(document.title).toBe(textIn(COPY.pageTitle, locale));
        expect(document.documentElement.lang).toBe(locale);
        expect(isMenuShowing(), 'the title screen is already behind it').toBe(true);
      }
    );

    it('is in English when no language was ever saved', async () => {
      await boot();

      expect(loadingText()).toContain(COPY.loading.en);
      expect(loadingText()).not.toContain(COPY.loading.zh);
      expect(document.title).toBe(COPY.pageTitle.en);
      expect(readableText(byId('start-btn'))).toContain(COPY.newCampaign.en);
    });

    it('gives way to the title screen', async () => {
      await boot();
      expect(isLoadingScreenUp()).toBe(true);

      await vi.advanceTimersByTimeAsync(1000);

      expect(isMenuShowing()).toBe(true);
      expect(isLoadingScreenUp()).toBe(false);
      expect(coordinators(), 'no game was started').toHaveLength(0);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('goes at once, without a fade, under prefers-reduced-motion', async () => {
      stubMatchMedia({ reducedMotion: true });
      await boot();

      expect(isMenuShowing()).toBe(true);
      expect(isLoadingScreenUp()).toBe(false);
    });

    it('stays away: nothing brings the loading screen back while the player is on the menu', async () => {
      await boot();
      await vi.advanceTimersByTimeAsync(1000);
      expect(isLoadingScreenUp()).toBe(false);

      await vi.advanceTimersByTimeAsync(5000);
      await settle();

      expect(isLoadingScreenUp()).toBe(false);
      expect(isMenuShowing()).toBe(true);
    });
  });

  describe('when start-up cannot go ahead', () => {
    it.each(LOCALES)(
      'a browser without WebGL gets a localized error instead of a menu (%s)',
      async (locale) => {
        await boot({ language: locale, noWebGL: true });

        expect(isLoadingScreenUp()).toBe(true);
        const alert = loadingScreen().querySelector('[role="alert"]');
        expect(alert, 'announced as an alert').not.toBeNull();
        expect(readableText(alert)).toContain(textIn(COPY.failed, locale));
        expect(readableText(alert)).toContain(textIn(COPY.noWebGL, locale));
        expect(readableText(alert)).toContain(textIn(COPY.retryAdvice, locale));
        expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
        expect(document.getElementById('start-menu')).toBeNull();
      }
    );

    it.each(LOCALES)(
      'a failed start-up says so, localized and without emoji (%s)',
      async (locale) => {
        await boot({ language: locale, failMenu: true });

        expect(isLoadingScreenUp()).toBe(true);
        const alert = loadingScreen().querySelector('[role="alert"]');
        expect(alert, 'announced as an alert').not.toBeNull();
        expect(readableText(alert)).toContain(textIn(COPY.failed, locale));
        expect(readableText(alert)).toContain(textIn(COPY.initFailed, locale));
        expect(readableText(alert)).toContain(textIn(COPY.retryAdvice, locale));
        expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
        expect(isMenuShowing()).toBe(false);
        expect(coordinators(), 'no game').toHaveLength(0);
      }
    );

    it('a failed start-up is reported to the console once, with the cause', async () => {
      await boot({ failMenu: true });

      expect(consoleError).toHaveBeenCalledTimes(1);
      const reported = consoleError.mock.calls[0].filter(
        (argument: unknown) => argument instanceof Error
      );
      expect(reported.map((error: Error) => error.message)).toEqual([
        'the menu could not be built',
      ]);
    });

    it.each([
      ['a browser without WebGL', { noWebGL: true }],
      ['a failed start-up', { failMenu: true }],
    ] as const)('%s: the error stays on screen, it does not fade away', async (_name, options) => {
      await boot(options);

      await vi.advanceTimersByTimeAsync(5000);
      await settle();

      expect(isLoadingScreenUp()).toBe(true);
      expect(loadingScreen().querySelector('[role="alert"]')).not.toBeNull();
      expect(loadingText()).not.toContain(COPY.loading.en + '…');
    });

    it.each([
      ['a browser without WebGL', { noWebGL: true }],
      ['a failed start-up', { failMenu: true }],
    ] as const)('%s: the error shows under prefers-reduced-motion too', async (_name, options) => {
      stubMatchMedia({ reducedMotion: true });
      await boot(options);

      expect(isLoadingScreenUp()).toBe(true);
      expect(readableText(loadingScreen().querySelector('[role="alert"]'))).toContain(
        COPY.failed.en
      );
    });

    it('an error found once the document is ready is shown the same way', async () => {
      const shell = await boot({ readyState: 'loading', noWebGL: true });
      expect(loadingScreen().querySelector('[role="alert"]'), 'not before').toBeNull();

      shell.documentReady();

      expect(isLoadingScreenUp()).toBe(true);
      expect(readableText(loadingScreen().querySelector('[role="alert"]'))).toContain(
        COPY.noWebGL.en
      );
      expect(document.getElementById('start-menu')).toBeNull();
    });
  });

  describe('starting a run from the menu', () => {
    it.each(LOCALES)(
      'puts up "Entering the battlefield" at once, in the interface language (%s)',
      async (locale) => {
        await boot({ language: locale });
        await vi.advanceTimersByTimeAsync(1000);
        expect(isLoadingScreenUp()).toBe(false);

        click('start-btn');

        expect(isLoadingScreenUp(), 'in the same tick as the tap').toBe(true);
        expect(loadingText()).toContain(textIn(COPY.entering, locale));
        expect(
          loadingScreen().querySelector('[role="status"]'),
          'a status, not an alert'
        ).not.toBeNull();
        expect(loadingScreen().querySelector('[role="alert"]')).toBeNull();
        expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
        expect(loadingText()).not.toContain(textIn(COPY.failed, locale));
      }
    );

    it('follows a language change made in Settings before the run', async () => {
      const shell = await boot();
      shell.i18n.setLocale('zh-CN');

      click('start-btn');

      expect(loadingText()).toContain(COPY.entering.zh);
      expect(loadingText()).not.toContain(COPY.entering.en);
    });

    it('does not boot the game while the menu is still playing its launch transition', async () => {
      await boot();
      click('start-btn');

      await vi.advanceTimersByTimeAsync(120);
      await settle();

      expect(coordinators(), 'nothing booted yet').toHaveLength(0);
      expect(game.log).not.toContain('menu:hide');
      expect(isLoadingScreenUp(), 'the entering screen waits underneath').toBe(true);
    });

    it('boots the game once the transition is over and the menu has gone', async () => {
      await boot();
      const coordinator = await startRun();

      expect(coordinators()).toHaveLength(1);
      expect(coordinator.booted).toHaveLength(1);
      expect(coordinator.menuShowingAtConstruction, 'the menu was already hidden').toBe(false);
      expect(isMenuShowing()).toBe(false);
    });

    it('waits for whenLaunched(): asked, resolved, then the game is created', async () => {
      await boot();
      await startRun();

      const asked = logIndex('menu:whenLaunched');
      const launched = logIndex('menu:launched');
      const constructed = logIndex('game:construct');
      expect(asked, 'whenLaunched() was asked for').toBeGreaterThanOrEqual(0);
      expect(launched).toBeGreaterThan(asked);
      expect(constructed).toBeGreaterThan(launched);
      expect(logIndex('game:boot')).toBeGreaterThan(constructed);
    });

    it('hands the game the settings chosen in the menu', async () => {
      saveStartFlowSettings({
        difficulty: 5,
        playerLives: 7,
        sfxVolume: 0.2,
        musicVolume: 0.4,
        voiceVolume: 0.6,
        qualityPreset: 'performance',
        tutorialEnabled: false,
        cameraMode: 'first-person',
        gameMode: 'boss',
        startLevel: 3,
        testScore: 5000,
      });
      await boot();
      const coordinator = await startRun();

      const expected: StartFlowSettings = {
        difficulty: 5,
        playerLives: 7,
        sfxVolume: 0.2,
        musicVolume: 0.4,
        voiceVolume: 0.6,
        qualityPreset: 'performance',
        tutorialEnabled: false,
        cameraMode: 'first-person',
        gameMode: 'boss',
        startLevel: 3,
        testScore: 5000,
        language: 'en',
      };
      expect(coordinator.booted[0]).toEqual(expected);
      expect(coordinator.options.resume ?? null, 'a new run, not a resume').toBeNull();
      expect(coordinator.options.showStartMenu).toBe(false);
    });

    it('takes the entering screen away when the game is up', async () => {
      await boot();
      await startRun();
      await vi.advanceTimersByTimeAsync(1000);

      expect(isLoadingScreenUp()).toBe(false);
      expect(isMenuShowing()).toBe(false);
    });

    it('a double tap on New Campaign boots one game', async () => {
      await boot();
      const button = byId('start-btn');
      button.click();
      button.click();
      document.getElementById('start-btn')?.click();
      await vi.advanceTimersByTimeAsync(1500);
      await gameBooted();
      await vi.advanceTimersByTimeAsync(1500);
      await settle();

      expect(coordinators()).toHaveLength(1);
      expect(coordinators()[0].booted).toHaveLength(1);
    });

    it('under prefers-reduced-motion the game boots promptly, with no transition to wait for', async () => {
      stubMatchMedia({ reducedMotion: true });
      await boot();

      click('start-btn');
      expect(isMenuShowing(), 'the menu is gone in the same tick').toBe(false);
      expect(isLoadingScreenUp()).toBe(true);
      expect(loadingText()).toContain(COPY.entering.en);
      const coordinator = await gameBooted();

      expect(coordinator.menuShowingAtConstruction).toBe(false);
      expect(coordinators()).toHaveLength(1);
      expect(isLoadingScreenUp(), 'and the entering screen goes without a fade').toBe(false);
    });

    it.each(LOCALES)(
      'a game that fails to start says so, localized, without emoji (%s)',
      async (locale) => {
        await boot({ language: locale });
        game.failConstruct = true;

        click('start-btn');
        await vi.advanceTimersByTimeAsync(1500);
        await settleUntil(() => loadingScreen().querySelector('[role="alert"]') !== null);

        const alert = loadingScreen().querySelector('[role="alert"]');
        expect(alert, 'an error is shown').not.toBeNull();
        expect(isLoadingScreenUp()).toBe(true);
        expect(readableText(alert)).toContain(textIn(COPY.failed, locale));
        expect(readableText(alert)).toContain(textIn(COPY.retryAdvice, locale));
        expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
        await vi.advanceTimersByTimeAsync(2000);
        expect(isLoadingScreenUp(), 'the error stays up').toBe(true);
      }
    );
  });

  describe('Continue Campaign', () => {
    it('waits for the transition too, then resumes from the validated checkpoint', async () => {
      seedCheckpoint();
      saveStartFlowSettings({
        sfxVolume: 0.3,
        qualityPreset: 'quality',
        difficulty: 1,
        playerLives: 9,
      });
      await boot();

      click('continue-btn');
      expect(isLoadingScreenUp()).toBe(true);
      expect(loadingText()).toContain(COPY.entering.en);
      await vi.advanceTimersByTimeAsync(120);
      await settle();
      expect(coordinators()).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1500);
      const coordinator = await gameBooted();

      expect(coordinator.menuShowingAtConstruction).toBe(false);
      expect(coordinator.options.resume).toMatchObject({
        level: CHECKPOINT.level,
        wave: CHECKPOINT.wave,
        score: CHECKPOINT.score,
        lives: CHECKPOINT.lives,
      });
      // 难度 / 关卡 / 生命 / 视角取自存档，音画设置沿用本机
      expect(coordinator.booted[0]).toMatchObject({
        difficulty: CHECKPOINT.difficulty,
        startLevel: CHECKPOINT.level,
        playerLives: CHECKPOINT.lives,
        cameraMode: CHECKPOINT.cameraMode,
        gameMode: 'normal',
        testScore: 0,
        sfxVolume: 0.3,
        qualityPreset: 'quality',
      });
      expect(logIndex('game:construct')).toBeGreaterThan(logIndex('menu:launched'));
      expect(coordinators()).toHaveLength(1);
    });

    it('a new campaign over a save starts only after the confirmation, and only one game', async () => {
      seedCheckpoint();
      await boot();

      click('start-btn');
      await vi.advanceTimersByTimeAsync(1500);
      await settle();
      expect(coordinators(), 'still asking').toHaveLength(0);
      expect(isLoadingScreenUp(), 'no entering screen while the question is open').toBe(false);

      click('new-campaign-confirm-btn');
      expect(isLoadingScreenUp()).toBe(true);
      await vi.advanceTimersByTimeAsync(1500);
      const coordinator = await gameBooted();

      expect(coordinators()).toHaveLength(1);
      expect(coordinator.options.resume ?? null).toBeNull();
    });
  });

  describe('exit to menu', () => {
    it('disposes the game, reloads the menu from storage, then shows it — in that order', async () => {
      await boot();
      const coordinator = await startRun();
      game.log.length = 0;

      coordinator.options.onExitToMenu?.();

      const disposed = logIndex('game:dispose');
      const reloaded = logIndex('menu:reloadFromStorage');
      const shown = logIndex('menu:show');
      expect(disposed, 'the game was disposed').toBeGreaterThanOrEqual(0);
      expect(reloaded).toBeGreaterThan(disposed);
      expect(shown).toBeGreaterThan(reloaded);
      expect(coordinator.disposed).toBe(true);
      expect(isMenuShowing()).toBe(true);
    });

    it('brings back a usable title screen', async () => {
      await boot();
      const coordinator = await startRun();
      await vi.advanceTimersByTimeAsync(1000);

      coordinator.options.onExitToMenu?.();

      expect(isMenuShowing()).toBe(true);
      expect(isLoadingScreenUp()).toBe(false);
      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isOperable(byId(id)), `#${id}`).toBe(true);
      }
    });

    it('offers Continue for a checkpoint the run wrote', async () => {
      await boot();
      const coordinator = await startRun();
      expect(isOperable(document.getElementById('continue-btn'))).toBe(false);
      seedCheckpoint({ level: 4, wave: 1 });

      coordinator.options.onExitToMenu?.();

      expect(isOperable(byId('continue-btn'))).toBe(true);
      expect(readableText(byId('continue-btn'))).toMatch(/Ch\. 4\b.*Wave 2/);
    });

    it('drops Continue when the run finished the campaign and cleared the save', async () => {
      seedCheckpoint();
      await boot();
      click('continue-btn');
      await vi.advanceTimersByTimeAsync(1500);
      const coordinator = await gameBooted();
      window.localStorage.removeItem('air-supreme:campaign-save');

      coordinator.options.onExitToMenu?.();

      expect(isOperable(document.getElementById('continue-btn'))).toBe(false);
      expect(isOperable(byId('start-btn'))).toBe(true);
    });

    it('picks up settings changed during the run (pause menu), and the next run uses them', async () => {
      await boot();
      const first = await startRun();
      saveStartFlowSettings({ sfxVolume: 0.1, difficulty: 2 });

      first.options.onExitToMenu?.();
      const second = await startRun(2);

      expect(second.booted[0]).toMatchObject({ sfxVolume: 0.1, difficulty: 2 });
      expect(second).not.toBe(first);
    });

    it('comes back in the language chosen during the run', async () => {
      const shell = await boot();
      const coordinator = await startRun();
      saveStartFlowSettings({ language: 'zh-CN' });
      shell.i18n.setLocale('zh-CN');

      coordinator.options.onExitToMenu?.();

      expect(readableText(byId('start-btn'))).toContain(COPY.newCampaign.zh);
      click('start-btn');
      expect(loadingText()).toContain(COPY.entering.zh);
    });

    it('never has two games alive: the old one is disposed before the next is created', async () => {
      await boot();
      for (let run = 1; run <= 4; run++) {
        const coordinator = await startRun(run);
        expect(coordinator.aliveAtConstruction, `run ${run}`).toBe(1);
        coordinator.options.onExitToMenu?.();
        expect(coordinators().filter((instance) => !instance.disposed)).toHaveLength(0);
      }
      expect(coordinators()).toHaveLength(4);
    });

    it('called twice (two exit paths firing) leaves one working menu', async () => {
      await boot();
      const coordinator = await startRun();

      coordinator.options.onExitToMenu?.();
      expect(() => coordinator.options.onExitToMenu?.()).not.toThrow();

      expect(isMenuShowing()).toBe(true);
      expect(document.querySelectorAll('#start-menu')).toHaveLength(1);
      await startRun(2);
      expect(coordinators()).toHaveLength(2);
    });

    it('the next run waits for its own launch transition again', async () => {
      await boot();
      const first = await startRun();
      first.options.onExitToMenu?.();
      game.log.length = 0;

      click('start-btn');
      await vi.advanceTimersByTimeAsync(120);
      await settle();
      expect(coordinators()).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1500);
      const second = await gameBooted(2);
      expect(second.menuShowingAtConstruction).toBe(false);
      expect(logIndex('game:construct')).toBeGreaterThan(logIndex('menu:launched'));
    });
  });

  describe('retry and continue-from-checkpoint from the results screen', () => {
    it('retry boots a fresh game with the same settings and keeps the menu away', async () => {
      await boot();
      const first = await startRun();

      first.options.onRetry?.();
      const second = await gameBooted(2);

      expect(first.disposed).toBe(true);
      expect(second.aliveAtConstruction).toBe(1);
      expect(second.booted[0]).toEqual(first.booted[0]);
      expect(isMenuShowing()).toBe(false);
    });

    it('continue-from-checkpoint boots a resume of that checkpoint', async () => {
      await boot();
      const first = await startRun();
      seedCheckpoint({ level: 3, wave: 0, lives: 1 });
      const stored = JSON.parse(
        window.localStorage.getItem('air-supreme:campaign-save') ?? 'null'
      ) as CampaignSaveData;

      first.options.onContinueFromCheckpoint?.(stored);
      const second = await gameBooted(2);

      expect(first.disposed).toBe(true);
      expect(second.options.resume).toEqual(stored);
      expect(second.booted[0]).toMatchObject({ startLevel: 3, playerLives: 1, gameMode: 'normal' });
      expect(isMenuShowing()).toBe(false);
    });
  });

  /**
   * 启动不可重入（src/main.ts 的 booting）：上一次启动还在等游戏代码时再来的启动请求不做任何事；
   * 启动失败后放开，之后还能再试。
   *
   * 菜单自己已经不会连着要求两次（隐藏 / 过场中的菜单不理按钮），所以这里直接调用入口模块交给
   * 菜单的那两个回调（setOnStart / setOnContinue 收到的函数）来模拟“菜单又要求了一次”。
   * 结算界面的重试 / 检查点续玩由别的测试文件负责。
   *
   * 关于“只有一个游戏”这条断言的局限：Vitest 里同一个被 vi.mock 替身的模块若被并发 import() 两次，
   * 第二次会绕过替身去载入真模块（vitest 的 requestWithMock 里写明了这个限制），所以即使没有
   * booting 这道闸，这里也数不出第二个替身游戏。能如实观察到的是第二次请求有没有走进 bootGame：
   * 走进去就会再通知一次菜单音乐、再调一次 disposeGame。因此每个场景都用 expectExactlyOneBoot()
   * 连这些痕迹一起数（变异检查：去掉闸之后这些用例全部失败）。
   */
  describe('one boot at a time: a second request from the menu while a boot is in progress', () => {
    /**
     * 游戏模块先载入好：之后入口模块里的 import() 只差几个微任务。
     * （Vitest 里同一个被替身的模块头一次载入时并发 import() 两次，第二个拿不到替身；
     * 先载入一次就没有这个问题，两次请求才能真的撞在一起。）
     */
    async function bootWithGameCodeLoaded(): Promise<void> {
      await boot();
      await import('@/core/GameCoordinator');
      game.log.length = 0;
    }

    /** 一次启动该留下的痕迹恰好一份：造了一个游戏、启动一次、没销毁过谁、菜单音乐只被通知一次 */
    function expectExactlyOneBoot(): void {
      expect(coordinators()).toHaveLength(1);
      expect(count('game:construct')).toBe(1);
      expect(count('game:boot')).toBe(1);
      expect(count('game:dispose')).toBe(0);
      expect(count('music:menu-hidden'), 'the shell ran its boot steps once').toBe(1);
    }

    function requestStart(overrides: Partial<GameSettings> = {}): GameSettings {
      const settings: GameSettings = { ...loadStartFlowSettings(), ...overrides };
      expect(menuRequests.start, 'the shell registered a start handler').not.toBeNull();
      menuRequests.start?.(settings);
      return settings;
    }

    function requestContinue(): CampaignSaveData {
      const save = loadCampaignCheckpoint();
      expect(save, 'a checkpoint is stored').not.toBeNull();
      expect(menuRequests.resume, 'the shell registered a continue handler').not.toBeNull();
      menuRequests.resume?.(save as CampaignSaveData);
      return save as CampaignSaveData;
    }

    /** 所有启动都尘埃落定：模块到了、游戏造好、“进入战场”画面淡出完 */
    async function bootsSettled(): Promise<void> {
      await settle(20);
      await vi.advanceTimersByTimeAsync(1500);
      await settle();
    }

    function count(entry: string): number {
      return game.log.filter((logged) => logged === entry).length;
    }

    it('start, then start again: one game, and it is the first request that runs', async () => {
      await bootWithGameCodeLoaded();

      const first = requestStart({ difficulty: 2 });
      requestStart({ difficulty: 5 });
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators()[0].booted).toEqual([first]);
      expect(coordinators()[0].options.resume ?? null).toBeNull();
      expect(coordinators()[0].disposed).toBe(false);
    });

    it('start, then continue: one game, a new run, not the resume', async () => {
      seedCheckpoint();
      await bootWithGameCodeLoaded();

      const first = requestStart({ difficulty: 2 });
      requestContinue();
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators()[0].booted).toEqual([first]);
      expect(coordinators()[0].options.resume ?? null).toBeNull();
    });

    it('continue, then start: one game, the resume', async () => {
      seedCheckpoint();
      await bootWithGameCodeLoaded();

      const save = requestContinue();
      requestStart({ difficulty: 5, gameMode: 'boss' });
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators()[0].options.resume).toEqual(save);
      expect(coordinators()[0].booted).toHaveLength(1);
      expect(coordinators()[0].booted[0]).toMatchObject({
        gameMode: 'normal',
        startLevel: CHECKPOINT.level,
        difficulty: CHECKPOINT.difficulty,
      });
    });

    it('continue twice: one game', async () => {
      seedCheckpoint();
      await bootWithGameCodeLoaded();

      const save = requestContinue();
      requestContinue();
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators()[0].booted).toHaveLength(1);
      expect(coordinators()[0].options.resume).toEqual(save);
    });

    it('five requests on top of each other: still one game, never two alive', async () => {
      seedCheckpoint();
      await bootWithGameCodeLoaded();

      requestStart();
      requestContinue();
      requestStart();
      requestStart();
      requestContinue();
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators().map((instance) => instance.aliveAtConstruction)).toEqual([1]);
    });

    it('a request that arrives a moment later, still during the boot, is ignored as well', async () => {
      await bootWithGameCodeLoaded();

      const first = requestStart({ difficulty: 2 });
      // 第一次请求已经走进 bootGame、正在等游戏模块
      await Promise.resolve();
      await Promise.resolve();
      expect(count('music:menu-hidden'), 'the first boot is under way').toBe(1);
      expect(coordinators(), 'and not finished yet').toHaveLength(0);
      requestStart({ difficulty: 5 });
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators()[0].booted).toEqual([first]);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('leaves the screen as one boot would: menu gone, entering screen gone, game up', async () => {
      await bootWithGameCodeLoaded();

      requestStart();
      expect(isLoadingScreenUp(), 'the entering screen is up while it boots').toBe(true);
      requestStart();
      await bootsSettled();

      expectExactlyOneBoot();
      expect(isMenuShowing()).toBe(false);
      expect(isLoadingScreenUp()).toBe(false);
      expect(loadingScreen().querySelector('[role="alert"]')).toBeNull();
    });

    it('a request after the boot has finished is a new boot: the old game goes first', async () => {
      await bootWithGameCodeLoaded();
      const first = requestStart({ difficulty: 2 });
      await bootsSettled();
      expect(coordinators()).toHaveLength(1);

      const second = requestStart({ difficulty: 5 });
      await bootsSettled();

      expect(coordinators()).toHaveLength(2);
      expect(coordinators()[0].booted).toEqual([first]);
      expect(coordinators()[0].disposed).toBe(true);
      expect(coordinators()[1].booted).toEqual([second]);
      expect(coordinators()[1].aliveAtConstruction).toBe(1);
    });

    it('exit to menu and start again right after an ignored request: the next run boots', async () => {
      await bootWithGameCodeLoaded();
      requestStart();
      requestStart();
      await bootsSettled();

      coordinators()[0].options.onExitToMenu?.();
      const second = await startRun(2);

      expect(coordinators()).toHaveLength(2);
      expect(second.aliveAtConstruction).toBe(1);
      expect(isMenuShowing()).toBe(false);
    });

    describe('when the boot fails', () => {
      /** 要求开局、游戏造不出来，等到出错画面 */
      async function failedBoot(): Promise<void> {
        game.failConstruct = true;
        requestStart();
        await settleUntil(() => loadingScreen().querySelector('[role="alert"]') !== null);
        await settle();
        expect(
          loadingScreen().querySelector('[role="alert"]'),
          'the error is shown'
        ).not.toBeNull();
        expect(coordinators()).toHaveLength(0);
        game.failConstruct = false;
      }

      it('a later start request boots the game and takes the error screen away', async () => {
        await bootWithGameCodeLoaded();
        await failedBoot();

        const settings = requestStart({ difficulty: 4 });
        await bootsSettled();

        expect(coordinators()).toHaveLength(1);
        expect(coordinators()[0].booted).toEqual([settings]);
        expect(isLoadingScreenUp()).toBe(false);
        expect(loadingScreen().querySelector('[role="alert"]')).toBeNull();
      });

      it('a later continue request boots the resume', async () => {
        seedCheckpoint();
        await bootWithGameCodeLoaded();
        await failedBoot();

        const save = requestContinue();
        await bootsSettled();

        expect(coordinators()).toHaveLength(1);
        expect(coordinators()[0].options.resume).toEqual(save);
        expect(isLoadingScreenUp()).toBe(false);
      });

      it('two failures in a row, then a success', async () => {
        await bootWithGameCodeLoaded();
        await failedBoot();
        await failedBoot();

        requestStart();
        await bootsSettled();

        expect(coordinators()).toHaveLength(1);
        expect(coordinators()[0].booted).toHaveLength(1);
      });

      it('a second request on top of the failing one is ignored too, and does not hide the error', async () => {
        await bootWithGameCodeLoaded();
        game.failConstruct = true;

        requestStart();
        requestStart();
        await settleUntil(() => loadingScreen().querySelector('[role="alert"]') !== null);
        await bootsSettled();

        expect(coordinators()).toHaveLength(0);
        expect(count('music:menu-hidden'), 'the shell ran its boot steps once').toBe(1);
        expect(isLoadingScreenUp(), 'the error stays up').toBe(true);
        expect(readableText(loadingScreen().querySelector('[role="alert"]'))).toContain(
          COPY.failed.en
        );
        expect(consoleError, 'the failure was reported once').toHaveBeenCalledTimes(1);
      });
    });

    it('through the real menu: two quick taps under reduced motion are one boot', async () => {
      stubMatchMedia({ reducedMotion: true });
      await bootWithGameCodeLoaded();
      const button = byId('start-btn');

      button.click();
      button.click();
      await bootsSettled();

      expectExactlyOneBoot();
      expect(coordinators()[0].booted).toHaveLength(1);
    });
  });

  it('logs no error on the ordinary path: boot, run, exit, run again', async () => {
    await boot();
    const first = await startRun();
    first.options.onExitToMenu?.();
    await startRun(2);
    await vi.advanceTimersByTimeAsync(2000);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
