import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { StartMenu } from '@/ui/StartMenu';
import { resetLocale } from './i18nTestUtils';
import {
  byId,
  click,
  isOperable,
  isShown,
  pendingTimers,
  prepareMenuEnvironment,
  resetMenuEnvironment,
  settle,
  stubMatchMedia,
  trackGlobalListeners,
  useMenuFakeTimers,
  watchUnhandledRejections,
  type RejectionWatch,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 8：标题画面的 3D 主机（MenuHero → 按需 import('./MenuHeroScene')）。
 *
 * 标题显示之后才懒创建；只占一个 WebGL 上下文；菜单隐藏、进机库、开始一局时释放，
 * 菜单再显示时回来。减少动态效果时是一帧定格。WebGL 或加载失败时标题画面照常可用、
 * 不冒出任何错误。像素比封顶（触屏 1.5）。反复显示 / 隐藏不泄漏监听、动画帧与画布。
 *
 * 这个文件把 MenuHeroScene（真正碰 three 与 WebGL 的那一层）换成记账的替身，只看控制器
 * 何时创建、何时释放；真实场景对渲染器做了什么见 MenuHeroScene.test.ts。
 */

interface SceneOptions {
  host: HTMLElement;
  maxPixelRatio: number;
  reducedMotion: boolean;
  onContextLost: () => void;
}

interface FakeScene {
  options: SceneOptions;
  canvas: HTMLCanvasElement;
  disposed: boolean;
  running: boolean;
  stills: number;
  launches: number;
}

const hero = vi.hoisted(() => ({
  /** 模块被求值的次数：0 表示 import('./MenuHeroScene') 还没发生 */
  moduleLoads: 0,
  scenes: [] as unknown[],
  attempts: 0,
  failConstruct: false,
}));

const hangar = vi.hoisted(() => ({
  instances: [] as Array<{ shown: boolean; hide: () => void }>,
  /** 每次机库打开的那一刻，还活着的主机场景数 */
  heroesAliveWhenShown: [] as number[],
}));

function scenes(): FakeScene[] {
  return hero.scenes as FakeScene[];
}

function liveScenes(): FakeScene[] {
  return scenes().filter((scene) => !scene.disposed);
}

vi.mock('@/ui/menu/MenuHeroScene', () => {
  hero.moduleLoads++;
  class MenuHeroScene implements FakeScene {
    public readonly canvas = document.createElement('canvas');
    public disposed = false;
    public running = false;
    public stills = 0;
    public launches = 0;

    constructor(public readonly options: SceneOptions) {
      hero.attempts++;
      if (hero.failConstruct) {
        throw new Error('WebGL context could not be created');
      }
      hero.scenes.push(this);
      options.host.appendChild(this.canvas);
    }
    public start(): void {
      this.running = !this.disposed;
    }
    public stop(): void {
      this.running = false;
    }
    public isRunning(): boolean {
      return this.running;
    }
    public renderStill(): void {
      this.stills++;
    }
    public resize(): void {}
    public setPointer(): void {}
    public launch(): void {
      this.launches++;
    }
    public dispose(): void {
      this.disposed = true;
      this.running = false;
      this.canvas.remove();
    }
  }
  return { MenuHeroScene };
});

vi.mock('@/ui/ModelPreview', () => {
  class ModelPreview {
    public shown = false;
    private onBack?: () => void;

    constructor() {
      hangar.instances.push(this);
    }
    public setOnBack(callback: () => void): void {
      this.onBack = callback;
    }
    public show(): void {
      this.shown = true;
      hangar.heroesAliveWhenShown.push(
        (hero.scenes as FakeScene[]).filter((scene) => !scene.disposed).length
      );
    }
    public hide(): void {
      this.shown = false;
      this.onBack?.();
    }
    public dispose(): void {
      this.shown = false;
    }
  }
  return { ModelPreview };
});

describe('title-screen 3D hero (batch X5, spec 8)', () => {
  let menu: StartMenu | null = null;
  let originalIsMobile: boolean;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let rejections: RejectionWatch;
  let unhandled: unknown[] = [];

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  /** 走完“菜单出现 → 稍后加载主机 → 画出首帧”的全过程（不超过 2 秒） */
  async function letHeroArrive(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(500);
      await settle();
    }
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    GameConfig.isMobile = false;
    prepareMenuEnvironment();
    useMenuFakeTimers();
    // jsdom 没有 WebGL：声明“这个浏览器有 WebGL”，场景本身是替身
    vi.stubGlobal('WebGLRenderingContext', class {});
    hero.scenes.length = 0;
    hero.attempts = 0;
    hero.failConstruct = false;
    hangar.instances.length = 0;
    hangar.heroesAliveWhenShown.length = 0;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    rejections = watchUnhandledRejections();
    unhandled = rejections.seen;
  });

  afterEach(async () => {
    menu?.dispose();
    menu = null;
    await settle(2);
    rejections.stop();
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    resetMenuEnvironment();
    // 监听在本文件里接管了未处理的 Promise 拒绝：每个用例结束时都必须一个不剩
    expect(unhandled, 'no unhandled promise rejection').toEqual([]);
  });

  describe('created lazily, after the title is shown', () => {
    it('creates nothing 3D while the title screen is being put up', async () => {
      const loadsBefore = hero.moduleLoads;
      createMenu();

      expect(scenes()).toHaveLength(0);
      expect(isOperable(byId('start-btn')), 'the title is already usable').toBe(true);
      await settle();
      expect(scenes(), 'still nothing a moment later').toHaveLength(0);
      expect(hero.moduleLoads, 'the scene module has not even been imported').toBe(loadsBefore);
    });

    it('creates one hero shortly afterwards, inside #start-menu', async () => {
      createMenu();
      await letHeroArrive();

      expect(scenes()).toHaveLength(1);
      expect(hero.moduleLoads).toBeGreaterThan(0);
      const scene = scenes()[0];
      expect(byId('start-menu').contains(scene.options.host)).toBe(true);
      expect(byId('start-menu').contains(scene.canvas)).toBe(true);
      expect(scene.disposed).toBe(false);
      expect(scene.stills, 'a first frame was drawn').toBeGreaterThan(0);
      expect(scene.running, 'and it is animating').toBe(true);
    });

    it('does not put the hero in front of the actions: the canvas is in the hidden backdrop', async () => {
      createMenu();
      await letHeroArrive();
      const canvas = scenes()[0].canvas;
      expect(
        canvas.closest('[aria-hidden="true"]'),
        'decorative, skipped by assistive tech'
      ).not.toBeNull();
      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(canvas.contains(byId(id))).toBe(false);
        expect(isOperable(byId(id))).toBe(true);
      }
    });

    it('never asks for one when the browser has no WebGL', async () => {
      vi.stubGlobal('WebGLRenderingContext', undefined);
      vi.stubGlobal('WebGL2RenderingContext', undefined);
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      await letHeroArrive();

      expect(hero.attempts).toBe(0);
      expect(scenes()).toHaveLength(0);
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('one WebGL context', () => {
    it('show() on a menu that is already showing does not create a second hero', async () => {
      const startMenu = createMenu();
      await letHeroArrive();

      startMenu.show();
      startMenu.show();
      await letHeroArrive();

      expect(scenes()).toHaveLength(1);
      expect(liveScenes()).toHaveLength(1);
    });

    it('never has two alive at once through show / hide cycles', async () => {
      const startMenu = createMenu();
      let mostAlive = 0;
      const sample = (): void => {
        mostAlive = Math.max(mostAlive, liveScenes().length);
      };

      for (let cycle = 0; cycle < 6; cycle++) {
        await letHeroArrive();
        sample();
        startMenu.hide();
        sample();
        startMenu.show();
        sample();
      }
      await letHeroArrive();
      sample();

      expect(mostAlive).toBe(1);
      expect(liveScenes()).toHaveLength(1);
      expect(scenes().length).toBeGreaterThan(1);
    });

    it('rapid hide / show within the start-up delay still ends with exactly one', async () => {
      const startMenu = createMenu();
      for (let i = 0; i < 20; i++) {
        startMenu.hide();
        startMenu.show();
        await vi.advanceTimersByTimeAsync(40);
      }
      await letHeroArrive();

      expect(liveScenes()).toHaveLength(1);
      expect(scenes().filter((scene) => scene.canvas.isConnected)).toHaveLength(1);
    });
  });

  describe('released', () => {
    it('when the menu hides', async () => {
      const startMenu = createMenu();
      await letHeroArrive();
      const scene = scenes()[0];

      startMenu.hide();

      expect(scene.disposed).toBe(true);
      expect(scene.canvas.isConnected, 'its canvas left the document').toBe(false);
      expect(liveScenes()).toHaveLength(0);
    });

    it('when the menu hides before the hero ever arrived: it never arrives', async () => {
      const startMenu = createMenu();
      startMenu.hide();

      await letHeroArrive();

      expect(liveScenes()).toHaveLength(0);
      expect(scenes().every((scene) => !scene.canvas.isConnected)).toBe(true);
    });

    it('when the menu hides while the hero module is still loading', async () => {
      const startMenu = createMenu();
      // 启动延时已到、import() 还在路上
      vi.advanceTimersByTime(600);
      startMenu.hide();

      await letHeroArrive();

      expect(liveScenes()).toHaveLength(0);
      expect(document.querySelectorAll('#start-menu canvas')).toHaveLength(0);
    });

    it('when a run starts: it flies out during the transition and is gone after it', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);
      await letHeroArrive();
      const scene = scenes()[0];

      click('start-btn');
      expect(scene.launches, 'the launch fly-out was triggered').toBe(1);

      await vi.advanceTimersByTimeAsync(1500);
      expect(scene.disposed).toBe(true);
      expect(scene.canvas.isConnected).toBe(false);
      expect(liveScenes()).toHaveLength(0);
    });

    it('when a run starts by Continue Campaign', async () => {
      window.localStorage.setItem(
        'air-supreme:campaign-save',
        JSON.stringify({ version: 1, level: 3, wave: 1 })
      );
      const startMenu = createMenu();
      startMenu.setOnContinue(() => undefined);
      await letHeroArrive();

      click('continue-btn');
      await vi.advanceTimersByTimeAsync(1500);

      expect(liveScenes()).toHaveLength(0);
    });

    it('at once when the caller hides the menu during the launch transition', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);
      await letHeroArrive();

      click('start-btn');
      startMenu.hide();

      expect(liveScenes()).toHaveLength(0);
    });

    it('when a run starts before the hero arrived: none is created for the game to fight over', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);

      click('start-btn');
      await letHeroArrive();

      expect(liveScenes()).toHaveLength(0);
      expect(isShown(byId('start-menu'))).toBe(false);
    });

    it('when the Hangar opens, before the Hangar takes its own context', async () => {
      createMenu();
      await letHeroArrive();
      const scene = scenes()[0];

      click('preview-btn');
      await settle();

      expect(hangar.instances).toHaveLength(1);
      expect(hangar.instances[0].shown).toBe(true);
      expect(scene.disposed).toBe(true);
      expect(hangar.heroesAliveWhenShown, 'no hero alive when the Hangar came up').toEqual([0]);
    });

    it('when the menu is disposed', async () => {
      const startMenu = createMenu();
      await letHeroArrive();
      const scene = scenes()[0];

      startMenu.dispose();
      menu = null;
      await letHeroArrive();

      expect(scene.disposed).toBe(true);
      expect(liveScenes()).toHaveLength(0);
      expect(scenes()).toHaveLength(1);
    });

    it('when the menu is disposed before the hero arrived', async () => {
      const startMenu = createMenu();
      startMenu.dispose();
      menu = null;

      await letHeroArrive();

      expect(scenes()).toHaveLength(0);
    });

    it('for good: show() on a disposed menu does not ask for another WebGL context', async () => {
      const startMenu = createMenu();
      await letHeroArrive();
      startMenu.dispose();
      menu = null;
      const attemptsBefore = hero.attempts;
      // 被 dispose 的菜单再 show() 时挂到 document 上的监听，用例结束时由这里摘掉
      const added: Array<[string, EventListenerOrEventListenerObject]> = [];
      const addToDocument = document.addEventListener.bind(document);
      vi.spyOn(document, 'addEventListener').mockImplementation(((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => {
        added.push([type, listener]);
        addToDocument(type, listener, options);
      }) as typeof document.addEventListener);

      try {
        startMenu.show();
        await letHeroArrive();

        expect(hero.attempts, 'no new hero was built').toBe(attemptsBefore);
        expect(liveScenes()).toHaveLength(0);
        expect(document.querySelectorAll('canvas')).toHaveLength(0);
      } finally {
        for (const [type, listener] of added) {
          document.removeEventListener(type, listener);
        }
      }
    });
  });

  describe('comes back', () => {
    it('when the menu is shown again', async () => {
      const startMenu = createMenu();
      await letHeroArrive();
      startMenu.hide();

      startMenu.show();
      expect(liveScenes(), 'lazily again, not in the same tick').toHaveLength(0);
      await letHeroArrive();

      expect(liveScenes()).toHaveLength(1);
      expect(liveScenes()[0]).not.toBe(scenes()[0]);
      expect(byId('start-menu').contains(liveScenes()[0].canvas)).toBe(true);
    });

    it('after a run, when the player exits to the menu', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);
      await letHeroArrive();
      click('start-btn');
      await vi.advanceTimersByTimeAsync(1500);
      expect(liveScenes()).toHaveLength(0);

      startMenu.show();
      await letHeroArrive();

      expect(liveScenes()).toHaveLength(1);
    });

    it('after the Hangar closes', async () => {
      createMenu();
      await letHeroArrive();
      click('preview-btn');
      await settle();
      expect(liveScenes()).toHaveLength(0);

      hangar.instances[0].hide();
      await letHeroArrive();

      expect(isShown(byId('start-menu'))).toBe(true);
      expect(liveScenes()).toHaveLength(1);
    });

    it('through repeated Hangar visits, never overlapping the Hangar', async () => {
      createMenu();
      for (let visit = 0; visit < 4; visit++) {
        await letHeroArrive();
        click('preview-btn');
        await settle();
        expect(liveScenes(), `visit ${visit}`).toHaveLength(0);
        hangar.instances[0].hide();
      }
      await letHeroArrive();

      expect(hangar.heroesAliveWhenShown).toEqual([0, 0, 0, 0]);
      expect(liveScenes()).toHaveLength(1);
    });
  });

  describe('prefers-reduced-motion', () => {
    it('asks the scene for a still frame rather than an animation', async () => {
      stubMatchMedia({ reducedMotion: true });
      createMenu();
      await letHeroArrive();

      expect(scenes()).toHaveLength(1);
      expect(scenes()[0].options.reducedMotion).toBe(true);
      expect(scenes()[0].stills).toBeGreaterThan(0);
    });

    it('asks for animation otherwise', async () => {
      createMenu();
      await letHeroArrive();
      expect(scenes()[0].options.reducedMotion).toBe(false);
    });

    it('releases it the moment a run starts (there is no transition to wait for)', async () => {
      stubMatchMedia({ reducedMotion: true });
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);
      await letHeroArrive();

      click('start-btn');

      expect(liveScenes()).toHaveLength(0);
    });
  });

  describe('pixel ratio cap', () => {
    it('is 1.5 on touch devices', async () => {
      GameConfig.isMobile = true;
      createMenu();
      await letHeroArrive();
      expect(scenes()[0].options.maxPixelRatio).toBe(1.5);
    });

    it('is a finite cap on desktop, no lower than the touch cap', async () => {
      GameConfig.isMobile = false;
      createMenu();
      await letHeroArrive();
      const cap = scenes()[0].options.maxPixelRatio;
      expect(Number.isFinite(cap)).toBe(true);
      expect(cap).toBeGreaterThanOrEqual(1.5);
      expect(cap).toBeLessThanOrEqual(3);
    });
  });

  describe('when WebGL fails', () => {
    it('a context that cannot be created leaves a working title screen and no error', async () => {
      hero.failConstruct = true;
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      await letHeroArrive();

      expect(hero.attempts).toBeGreaterThan(0);
      expect(liveScenes()).toHaveLength(0);
      expect(document.querySelectorAll('#start-menu canvas')).toHaveLength(0);
      expect(consoleError).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isOperable(byId(id)), `#${id}`).toBe(true);
      }
      click('settings-btn');
      expect(isShown(byId('settings-sheet'))).toBe(true);
      click(byId('settings-sheet').querySelector('button'));
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('does not keep hammering a device that refuses: attempts stop after a few shows', async () => {
      hero.failConstruct = true;
      const startMenu = createMenu();
      for (let cycle = 0; cycle < 8; cycle++) {
        await letHeroArrive();
        startMenu.hide();
        startMenu.show();
      }
      await letHeroArrive();

      expect(hero.attempts).toBeGreaterThan(0);
      expect(hero.attempts, 'bounded, not one per show').toBeLessThan(8);
      expect(consoleError).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    });

    it('a context lost while showing releases the hero and leaves the title working', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      await letHeroArrive();
      const scene = scenes()[0];

      scene.options.onContextLost();

      expect(scene.disposed).toBe(true);
      expect(scene.canvas.isConnected).toBe(false);
      expect(consoleError).not.toHaveBeenCalled();
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('recovers on the next show after a context loss', async () => {
      const startMenu = createMenu();
      await letHeroArrive();
      scenes()[0].options.onContextLost();

      startMenu.hide();
      startMenu.show();
      await letHeroArrive();

      expect(liveScenes()).toHaveLength(1);
    });
  });

  // 规格没有写页面进后台时怎样；按“不在看不见的页面上空转”来测
  describe('while the page is in the background', () => {
    function setPageVisibility(state: 'visible' | 'hidden'): void {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    }

    afterEach(() => {
      Reflect.deleteProperty(document, 'visibilityState');
    });

    it('stops animating when the tab is hidden and resumes when it is visible again', async () => {
      createMenu();
      await letHeroArrive();
      const scene = scenes()[0];
      expect(scene.running).toBe(true);

      setPageVisibility('hidden');
      expect(scene.running).toBe(false);
      expect(scene.disposed, 'kept, only paused').toBe(false);

      setPageVisibility('visible');
      expect(scene.running).toBe(true);
      expect(scenes()).toHaveLength(1);
    });

    it('does not start animating in a tab that is already hidden', async () => {
      setPageVisibility('hidden');
      createMenu();
      await letHeroArrive();

      expect(scenes().every((scene) => !scene.running)).toBe(true);

      setPageVisibility('visible');
      await letHeroArrive();
      expect(liveScenes()).toHaveLength(1);
      expect(liveScenes()[0].running).toBe(true);
    });

    it('a visibility change after the menu was hidden wakes nothing up', async () => {
      const startMenu = createMenu();
      await letHeroArrive();
      startMenu.hide();

      setPageVisibility('hidden');
      setPageVisibility('visible');
      await letHeroArrive();

      expect(liveScenes()).toHaveLength(0);
      expect(scenes().every((scene) => !scene.running)).toBe(true);
    });
  });

  describe('nothing leaks across show / hide cycles', () => {
    it('size observers are disconnected whenever the hero is released', async () => {
      const observing = new Set<object>();
      class FakeResizeObserver {
        public observe(): void {
          observing.add(this);
        }
        public unobserve(): void {
          observing.delete(this);
        }
        public disconnect(): void {
          observing.delete(this);
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      const startMenu = createMenu();

      for (let cycle = 0; cycle < 4; cycle++) {
        await letHeroArrive();
        expect(observing.size, `shown, cycle ${cycle}`).toBeLessThanOrEqual(1);
        startMenu.hide();
        expect(observing.size, `hidden, cycle ${cycle}`).toBe(0);
        startMenu.show();
      }
      startMenu.dispose();
      menu = null;
      expect(observing.size, 'disposed').toBe(0);
    });

    it('document and window listeners return to the same set every time', async () => {
      stubMatchMedia({ finePointer: true });
      const ledger = trackGlobalListeners();
      const before = ledger.snapshot();
      const startMenu = createMenu();
      await letHeroArrive();
      const shown = ledger.snapshot();
      startMenu.hide();
      const hidden = ledger.snapshot();
      expect(shown.length, 'the visible menu listens for keys').toBeGreaterThan(hidden.length);

      for (let cycle = 0; cycle < 5; cycle++) {
        startMenu.show();
        await letHeroArrive();
        expect(ledger.snapshot(), `shown, cycle ${cycle}`).toEqual(shown);
        startMenu.hide();
        expect(ledger.snapshot(), `hidden, cycle ${cycle}`).toEqual(hidden);
      }

      startMenu.dispose();
      menu = null;
      expect(ledger.snapshot(), 'after dispose').toEqual(before);
    });

    it('a hidden menu holds no global listener of its own', async () => {
      const ledger = trackGlobalListeners();
      const before = ledger.snapshot();
      const startMenu = createMenu();
      await letHeroArrive();

      startMenu.hide();

      expect(ledger.snapshot()).toEqual(before);
    });

    it('no timer is left running once the menu is hidden or disposed', async () => {
      const startMenu = createMenu();
      for (let cycle = 0; cycle < 3; cycle++) {
        await vi.advanceTimersByTimeAsync(cycle * 130);
        startMenu.hide();
        expect(pendingTimers(), `hidden, cycle ${cycle}`).toBe(0);
        startMenu.show();
      }
      await letHeroArrive();
      startMenu.dispose();
      menu = null;
      expect(pendingTimers(), 'disposed').toBe(0);
    });

    it('hidden between the hero being built and its first frame: nothing stays scheduled', async () => {
      const startMenu = createMenu();
      // 启动延时已过、场景刚建好、首帧还没画
      await vi.advanceTimersByTimeAsync(400);
      await settle();
      expect(scenes(), 'the hero was built').toHaveLength(1);
      const scene = scenes()[0];
      expect(scene.stills, 'its first frame is still to come').toBe(0);

      startMenu.hide();

      expect(scene.disposed).toBe(true);
      expect(pendingTimers(), 'no timer left armed').toBe(0);
      await vi.advanceTimersByTimeAsync(1000);
      expect(scene.stills, 'a released hero is never drawn').toBe(0);
      expect(scene.running).toBe(false);
    });

    it('canvases do not pile up: one while showing, none while hidden', async () => {
      const startMenu = createMenu();
      for (let cycle = 0; cycle < 5; cycle++) {
        await letHeroArrive();
        expect(
          document.querySelectorAll('#start-menu canvas'),
          `shown, cycle ${cycle}`
        ).toHaveLength(1);
        startMenu.hide();
        expect(
          document.querySelectorAll('#start-menu canvas'),
          `hidden, cycle ${cycle}`
        ).toHaveLength(0);
        startMenu.show();
      }
    });

    it('pointer parallax frames are cancelled when the menu hides', async () => {
      stubMatchMedia({ finePointer: true });
      const pending = new Map<number, FrameRequestCallback>();
      let nextHandle = 1;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        pending.set(nextHandle, callback);
        return nextHandle++;
      });
      vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
        pending.delete(handle);
      });
      const startMenu = createMenu();
      await letHeroArrive();

      byId('start-menu').dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 120 })
      );
      startMenu.hide();

      expect(pending.size, 'no animation frame left requested').toBe(0);
      // 隐藏之后的指针移动不再排新的帧
      byId('start-menu').dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 20 })
      );
      expect(pending.size).toBe(0);
    });
  });

  it('warns once, quietly, instead of raising an error when the hero cannot start', async () => {
    hero.failConstruct = true;
    createMenu();
    await letHeroArrive();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
