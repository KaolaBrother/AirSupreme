import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveStartFlowSettings, type StartFlowSettings } from '@/core/SessionSettings';
import type { CampaignSaveData } from '@/core/save/SaveSystem';
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
  /** 配置迟迟不来：停在加载画面 */
  holdConfig?: boolean;
  /** 配置加载失败 */
  failConfig?: boolean;
  /** 浏览器不支持 WebGL */
  noWebGL?: boolean;
}

interface Shell {
  /** 入口模块所用的那份 i18n（与本文件静态导入的不是同一个实例） */
  i18n: typeof import('@/i18n');
  releaseConfig: () => void;
}

describe('boot shell: src/main.ts and #loading-screen (batch X5, spec 10)', () => {
  let menus: StartMenu[] = [];
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

  /** 载入入口模块，等它走到“菜单出现 / 报错 / 等配置” */
  async function boot(options: BootOptions = {}): Promise<Shell> {
    if (options.language) {
      saveStartFlowSettings({ language: options.language });
    }
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      !options.noWebGL && kind.includes('webgl')
        ? ({} as RenderingContext)
        : null) as HTMLCanvasElement['getContext']);

    const { configLoader } = await import('@/core/utils/ConfigLoader');
    let releaseConfig = (): void => undefined;
    vi.spyOn(configLoader, 'load').mockImplementation(() => {
      if (options.failConfig) {
        return Promise.reject(new Error('config unavailable'));
      }
      if (!options.holdConfig) {
        return Promise.resolve({} as Awaited<ReturnType<typeof configLoader.load>>);
      }
      return new Promise((resolve) => {
        releaseConfig = () => resolve({} as Awaited<ReturnType<typeof configLoader.load>>);
      });
    });

    // 入口模块自己造菜单、不对外暴露：从原型上接住实例，并给生命周期调用记个先后
    const { StartMenu: MenuClass } = await import('@/ui/StartMenu');
    const original = {
      reloadFromStorage: MenuClass.prototype.reloadFromStorage,
      show: MenuClass.prototype.show,
      hide: MenuClass.prototype.hide,
      whenLaunched: MenuClass.prototype.whenLaunched,
      setOnStart: MenuClass.prototype.setOnStart,
    };
    vi.spyOn(MenuClass.prototype, 'setOnStart').mockImplementation(function (
      this: StartMenu,
      callback
    ) {
      if (!menus.includes(this)) {
        menus.push(this);
      }
      original.setOnStart.call(this, callback);
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
    if (!options.holdConfig && !options.failConfig && !options.noWebGL) {
      await settleUntil(() => document.getElementById('start-menu') !== null);
    }
    await settle();
    return { i18n, releaseConfig: () => releaseConfig() };
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
  });

  describe('while the game is loading', () => {
    it.each(LOCALES)('shows the loading screen in the saved language (%s)', async (locale) => {
      await boot({ language: locale, holdConfig: true });

      expect(isLoadingScreenUp()).toBe(true);
      expect(loadingText()).toContain(textIn(COPY.loading, locale));
      expect(loadingText()).toContain(textIn(COPY.tagline, locale));
      expect(loadingText()).toMatch(/AIR\s*SUPREME/);
      expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
      expect(document.title).toBe(textIn(COPY.pageTitle, locale));
      expect(document.documentElement.lang).toBe(locale);
      expect(document.getElementById('start-menu'), 'no menu yet').toBeNull();
    });

    it('is in English when no language was ever saved', async () => {
      await boot({ holdConfig: true });
      expect(loadingText()).toContain(COPY.loading.en);
      expect(loadingText()).not.toContain(COPY.loading.zh);
    });

    it('gives way to the title screen once loading is done', async () => {
      const shell = await boot({ holdConfig: true });
      expect(isLoadingScreenUp()).toBe(true);

      shell.releaseConfig();
      await settleUntil(() => document.getElementById('start-menu') !== null);
      await vi.advanceTimersByTimeAsync(1000);

      expect(isMenuShowing()).toBe(true);
      expect(isLoadingScreenUp()).toBe(false);
      expect(coordinators(), 'no game was started').toHaveLength(0);
    });

    it('goes at once, without a fade, under prefers-reduced-motion', async () => {
      stubMatchMedia({ reducedMotion: true });
      await boot();

      expect(isMenuShowing()).toBe(true);
      expect(isLoadingScreenUp()).toBe(false);
    });

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
        await boot({ language: locale, failConfig: true });
        await settle();

        expect(isLoadingScreenUp()).toBe(true);
        const alert = loadingScreen().querySelector('[role="alert"]');
        expect(readableText(alert)).toContain(textIn(COPY.failed, locale));
        expect(readableText(alert)).toContain(textIn(COPY.retryAdvice, locale));
        expect(loadingScreen().textContent ?? '').not.toMatch(EMOJI);
        expect(isMenuShowing()).toBe(false);
      }
    );
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

  it('logs no error on the ordinary path: boot, run, exit, run again', async () => {
    await boot();
    const first = await startRun();
    first.options.onExitToMenu?.();
    await startRun(2);
    await vi.advanceTimersByTimeAsync(2000);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
