import * as THREE from 'three';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import type { BossConfig } from '@/features/boss/BossTypes';
import { setLocale, type Locale } from '@/i18n';
import { StartMenu } from '@/ui/StartMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';
import {
  byId,
  click,
  CONFIRM_SHEET,
  HOWTO_SHEET,
  installAnimationFrames,
  isDialogShowing,
  isOperable,
  isShown,
  last,
  press,
  prepareMenuEnvironment,
  readableText,
  resetMenuEnvironment,
  seedCheckpoint,
  SETTINGS_SHEET,
  settle,
  settleUntil,
  stubMatchMedia,
  trackGlobalListeners,
  useMenuFakeTimers,
  watchUnhandledRejections,
  type RejectionWatch,
  userClick,
  type AnimationFrames,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 9：机库（ModelPreview）从标题画面的 #preview-btn 打开。
 *
 * 渲染器只在机库打开期间存在：打开时创建、关闭时释放；“主菜单”（或 Esc）回到标题画面，
 * 焦点落回 #preview-btn；切换模型首尾相接；自动旋转可开可关。
 * 机库与标题画面的 3D 主机不同时占着 WebGL 上下文。
 *
 * 这里用的是真正的 StartMenu + ModelPreview（+ 真正的 MenuHero / MenuHeroScene），
 * 只把 three 的 WebGLRenderer / PMREMGenerator 与各模型工厂换成替身（jsdom 没有 WebGL）。
 */

interface FakeRenderer {
  domElement: HTMLCanvasElement;
  pixelRatios: number[];
  frames: Array<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera }>;
  disposed: number;
  contextLosses: number;
}

const gl = vi.hoisted(() => ({
  renderers: [] as unknown[],
  /** 每次新建渲染器时，连它在内还活着的个数 */
  aliveAtCreation: [] as number[],
  failNextRenderer: false,
}));

const models = vi.hoisted(() => ({
  created: [] as string[],
}));

function fakeRenderers(): FakeRenderer[] {
  return gl.renderers as FakeRenderer[];
}

/** 还占着上下文的渲染器：既没 dispose、也没被强制丢弃上下文 */
function liveRenderers(): FakeRenderer[] {
  return fakeRenderers().filter(
    (renderer) => renderer.disposed === 0 && renderer.contextLosses === 0
  );
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    public readonly domElement = document.createElement('canvas');
    public readonly shadowMap = { enabled: false };
    public toneMapping = 0;
    public toneMappingExposure = 1;
    public readonly pixelRatios: number[] = [];
    public readonly frames: Array<{ scene: unknown; camera: unknown }> = [];
    public disposed = 0;
    public contextLosses = 0;

    constructor() {
      if (gl.failNextRenderer) {
        gl.failNextRenderer = false;
        throw new Error('Error creating WebGL context.');
      }
      gl.renderers.push(this);
      gl.aliveAtCreation.push(
        (gl.renderers as FakeWebGLRenderer[]).filter(
          (renderer) => renderer.disposed === 0 && renderer.contextLosses === 0
        ).length
      );
    }
    public setClearColor(): void {}
    public setPixelRatio(ratio: number): void {
      this.pixelRatios.push(ratio);
    }
    public setSize(): void {}
    public compile(): void {}
    public render(scene: unknown, camera: unknown): void {
      this.frames.push({ scene, camera });
    }
    public dispose(): void {
      this.disposed++;
    }
    public forceContextLoss(): void {
      this.contextLosses++;
    }
  }
  class FakePMREMGenerator {
    public fromScene(): { texture: unknown; dispose: () => void } {
      return { texture: new actual.Texture(), dispose: () => undefined };
    }
    public dispose(): void {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer, PMREMGenerator: FakePMREMGenerator };
});

/** 替身模型：一个盒子，名字记下是哪个工厂造的 */
async function boxModel(tag: string): Promise<THREE.Group> {
  const three = await vi.importActual<typeof import('three')>('three');
  const group = new three.Group();
  group.name = tag;
  group.add(new three.Mesh(new three.BoxGeometry(2, 1, 3), new three.MeshBasicMaterial()));
  return group;
}

vi.mock('@/features/aircraft/AircraftMeshFactory', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  const box = (tag: string): THREE.Group => {
    models.created.push(tag);
    const group = new three.Group();
    group.name = tag;
    group.add(new three.Mesh(new three.BoxGeometry(2, 1, 3), new three.MeshBasicMaterial()));
    return group;
  };
  return {
    createPlayerMesh: () => box('player'),
    createEnemyMesh: (config: { type: string }) => box(`enemy:${config.type}`),
    updateAircraftSignals: () => undefined,
    updatePlayerAfterburner: () => undefined,
  };
});

function bossFactory(): (config: BossConfig) => Promise<THREE.Group> {
  return (config) => {
    models.created.push(`boss:${config.type}`);
    return boxModel(`boss:${config.type}`);
  };
}

vi.mock('@/features/boss/BossAI', () => ({ createBossMesh: bossFactory() }));
vi.mock('@/features/boss/DesertFortressAI', () => ({ createDesertFortressMesh: bossFactory() }));
vi.mock('@/features/boss/OctopusWarshipAI', () => ({ createOctopusWarshipMesh: bossFactory() }));
vi.mock('@/features/boss/MissileDestroyerAI', () => ({
  createMissileDestroyerMesh: bossFactory(),
}));
vi.mock('@/features/boss/SkyCarrierAI', () => ({ createSkyCarrierMesh: bossFactory() }));
vi.mock('@/features/boss/MagmaColossusMesh', () => ({ createMagmaColossusMesh: bossFactory() }));
vi.mock('@/features/boss/AbyssalLeviathanMesh', () => ({
  createAbyssalLeviathanMesh: bossFactory(),
}));
vi.mock('@/features/boss/TempestZeppelinMesh', () => ({
  createTempestZeppelinMesh: bossFactory(),
}));
vi.mock('@/features/boss/PhantomWingMesh', () => ({ createPhantomWingMesh: bossFactory() }));
vi.mock('@/features/boss/OraclePrimeMesh', () => ({ createOraclePrimeMesh: bossFactory() }));
vi.mock('@/features/combat/MissileSystem', () => ({
  createMissileVisualMesh: () => {
    models.created.push('missile:player');
    return boxModel('missile:player');
  },
}));
vi.mock('@/features/boss/BossMissileSystem', () => ({
  createBossMissileVisualMesh: () => {
    models.created.push('missile:boss');
    return boxModel('missile:boss');
  },
}));

const COPY = {
  heading: { en: 'Hangar', zh: '机库' },
  back: { en: 'Main Menu', zh: '主菜单' },
  backLabel: { en: 'Back to main menu', zh: '返回主菜单' },
  previous: { en: 'Previous model', zh: '上一个模型' },
  next: { en: 'Next model', zh: '下一个模型' },
  rotateOn: { en: 'Auto-rotate: On', zh: '自动旋转：开' },
  rotateOff: { en: 'Auto-rotate: Off', zh: '自动旋转：关' },
  firstModel: { en: 'Player jet', zh: '玩家飞机' },
  hangarButton: { en: 'Hangar', zh: '机库' },
} as const;

describe('Hangar (batch X5, spec 9)', () => {
  let menu: StartMenu | null = null;
  let frames: AnimationFrames;
  let originalIsMobile: boolean;
  let originalPixelRatio: number;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let rejections: RejectionWatch;
  let unhandled: unknown[] = [];

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  function hangar(): HTMLElement | null {
    return document.getElementById('model-preview');
  }

  function isHangarOpen(): boolean {
    return isShown(hangar());
  }

  function isTitleShowing(): boolean {
    return isShown(byId('start-menu'));
  }

  /** 等当前这一页的模型载入完（名称标签不再是“加载中”） */
  async function modelLoaded(): Promise<void> {
    await settleUntil(() => !/loading|加载中/i.test(modelName()));
    await settle(2);
  }

  /** 点“机库”并等模块、第一个模型载入 */
  async function openHangar(): Promise<void> {
    click('preview-btn');
    await settleUntil(() => isHangarOpen());
    expect(isHangarOpen(), 'the Hangar opened').toBe(true);
    await modelLoaded();
    frames.run();
  }

  function page(): { index: number; total: number } {
    const text = byId('page-indicator').textContent ?? '';
    const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
    expect(match, `page indicator "${text}"`).not.toBeNull();
    return { index: Number(match?.[1]), total: Number(match?.[2]) };
  }

  function modelName(): string {
    return (byId('aircraft-name').textContent ?? '').trim();
  }

  /** 机库渲染器此刻画的场景里的模型（最外层的转台组；灯光不是 Group） */
  function stageModels(): THREE.Object3D[] {
    const renderer = last(liveRenderers());
    expect(renderer, 'the Hangar has a renderer').toBeDefined();
    frames.run();
    const scene = renderer ? last(renderer.frames)?.scene : undefined;
    expect(scene, 'a frame was drawn').toBeDefined();
    return (scene as THREE.Scene).children.filter((child) => child.type === 'Group');
  }

  function hangarRenderer(): FakeRenderer {
    const renderer = last(fakeRenderers());
    expect(renderer, 'a renderer was created for the Hangar').toBeDefined();
    return renderer as FakeRenderer;
  }

  beforeAll(async () => {
    // 按需加载的两个模块先各载入一次：之后每个用例里的 import() 只差几个微任务
    await import('@/ui/ModelPreview');
    await import('@/ui/menu/MenuHeroScene');
  });

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalPixelRatio = window.devicePixelRatio;
    GameConfig.isMobile = false;
    prepareMenuEnvironment();
    frames = installAnimationFrames();
    gl.renderers.length = 0;
    gl.aliveAtCreation.length = 0;
    gl.failNextRenderer = false;
    models.created.length = 0;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    rejections = watchUnhandledRejections();
    unhandled = rejections.seen;
  });

  afterEach(async () => {
    menu?.dispose();
    menu = null;
    await settle(2);
    rejections.stop();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: originalPixelRatio,
    });
    resetLocale();
    resetMenuEnvironment();
    // 监听在本文件里接管了未处理的 Promise 拒绝：每个用例结束时都必须一个不剩
    expect(unhandled, 'no unhandled promise rejection').toEqual([]);
  });

  describe('opening from #preview-btn', () => {
    it('costs nothing until it is asked for: no renderer, no Hangar on screen', async () => {
      createMenu();
      await settle();

      expect(fakeRenderers()).toHaveLength(0);
      expect(isHangarOpen()).toBe(false);
      expect(models.created).toEqual([]);
    });

    it.each(LOCALES)('the title offers it by name (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      expect(readableText(byId('preview-btn'))).toContain(textIn(COPY.hangarButton, locale));
    });

    it('replaces the title screen with the Hangar', async () => {
      createMenu();
      await openHangar();

      expect(isHangarOpen()).toBe(true);
      expect(isTitleShowing()).toBe(false);
    });

    it('creates its renderer on opening and puts the canvas on the stage', async () => {
      createMenu();
      await openHangar();

      expect(fakeRenderers()).toHaveLength(1);
      expect(liveRenderers()).toHaveLength(1);
      expect(byId('canvas-container').contains(hangarRenderer().domElement)).toBe(true);
      expect(hangarRenderer().frames.length, 'and draws').toBeGreaterThan(0);
    });

    it('moves keyboard focus into the Hangar', async () => {
      createMenu();
      byId('preview-btn').focus();
      await openHangar();

      expect(hangar()?.contains(document.activeElement)).toBe(true);
    });

    it.each(LOCALES)('opens on the player jet, page 1 (%s)', async (locale) => {
      setLocale(locale);
      createMenu();
      await openHangar();

      expect(page().index).toBe(1);
      expect(page().total).toBeGreaterThan(3);
      expect(modelName()).toBe(textIn(COPY.firstModel, locale));
      expect(models.created).toEqual(['player']);
      expect(stageModels()).toHaveLength(1);
    });

    it.each(LOCALES)('names itself and its controls (%s)', async (locale) => {
      setLocale(locale);
      createMenu();
      await openHangar();

      expect(readableText(hangar()?.querySelector('h1, h2') ?? null)).toBe(
        textIn(COPY.heading, locale)
      );
      expect(hangar()?.getAttribute('aria-label')).toBe(textIn(COPY.heading, locale));
      expect(readableText(byId('back-btn'))).toBe(textIn(COPY.back, locale));
      expect(byId('back-btn').getAttribute('aria-label')).toBe(textIn(COPY.backLabel, locale));
      expect(byId('prev-btn').getAttribute('aria-label')).toBe(textIn(COPY.previous, locale));
      expect(byId('next-btn').getAttribute('aria-label')).toBe(textIn(COPY.next, locale));
    });

    it('a double activation opens one Hangar with one renderer', async () => {
      createMenu();
      const button = byId('preview-btn');
      button.click();
      // 第二下落在同一个按钮上（它可能已经因“加载中”被重建 / 禁用）
      button.click();
      document.getElementById('preview-btn')?.click();
      await settleUntil(() => isHangarOpen());
      await settle();

      expect(document.querySelectorAll('#model-preview')).toHaveLength(1);
      expect(fakeRenderers()).toHaveLength(1);
      expect(isHangarOpen()).toBe(true);
    });

    it('the Hangar button cannot be activated again while the Hangar is still loading', () => {
      createMenu();
      click('preview-btn');
      expect(userClick('preview-btn')).toBe(false);
    });

    it('title actions are out of reach while the Hangar is open', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      await openHangar();

      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isOperable(document.getElementById(id)), `#${id}`).toBe(false);
      }
      press('Enter');
      press('Enter', {}, document.body);
      expect(onStart).not.toHaveBeenCalled();
      expect(isHangarOpen()).toBe(true);
    });

    it('activation events that still reach the hidden title start nothing behind the Hangar', async () => {
      seedCheckpoint();
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);
      await openHangar();

      // 藏起来的按钮上仍可能来 click（留着焦点的按钮上的 Enter 连发、脚本）
      for (const id of ['continue-btn', 'start-btn', 'settings-btn', 'howto-btn', 'preview-btn']) {
        document.getElementById(id)?.click();
      }
      document.getElementById('new-campaign-confirm-btn')?.click();
      await settle();

      expect(onStart).not.toHaveBeenCalled();
      expect(onContinue).not.toHaveBeenCalled();
      expect(isHangarOpen()).toBe(true);
      expect(liveRenderers()).toHaveLength(1);

      // 回到标题画面时没有哪张面板被悄悄打开
      press('Escape');
      expect(isTitleShowing()).toBe(true);
      for (const sheet of [SETTINGS_SHEET, HOWTO_SHEET, CONFIRM_SHEET]) {
        expect(isDialogShowing(sheet), sheet).toBe(false);
      }
      expect(document.activeElement).toBe(byId('preview-btn'));
    });
  });

  describe('going back', () => {
    it.each(LOCALES)(
      '"Main Menu" returns to the title with focus on #preview-btn (%s)',
      async (locale) => {
        setLocale(locale);
        createMenu();
        await openHangar();
        expect(readableText(byId('back-btn'))).toBe(textIn(COPY.back, locale));

        click('back-btn');

        expect(isHangarOpen()).toBe(false);
        expect(isTitleShowing()).toBe(true);
        expect(document.activeElement).toBe(byId('preview-btn'));
        expect(readableText(byId('preview-btn'))).toContain(textIn(COPY.hangarButton, locale));
      }
    );

    it('Escape returns to the title too, with focus on #preview-btn', async () => {
      createMenu();
      await openHangar();

      const event = press('Escape');

      expect(isHangarOpen()).toBe(false);
      expect(isTitleShowing()).toBe(true);
      expect(document.activeElement).toBe(byId('preview-btn'));
      expect(event.defaultPrevented).toBe(true);
    });

    it('disposes the renderer on closing and takes its canvas away', async () => {
      createMenu();
      await openHangar();
      const renderer = hangarRenderer();

      click('back-btn');

      expect(renderer.disposed).toBe(1);
      expect(renderer.contextLosses, 'the context itself is given back').toBe(1);
      expect(renderer.domElement.isConnected).toBe(false);
      expect(liveRenderers()).toHaveLength(0);
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
    });

    it('stops drawing on closing', async () => {
      createMenu();
      await openHangar();
      const renderer = hangarRenderer();
      frames.run();
      frames.run();

      click('back-btn');
      const drawn = renderer.frames.length;

      expect(frames.pending()).toBe(0);
      frames.run();
      expect(renderer.frames).toHaveLength(drawn);
    });

    it('the title is fully usable afterwards', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      await openHangar();
      click('back-btn');

      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isOperable(byId(id)), `#${id}`).toBe(true);
      }
      click('settings-btn');
      expect(isDialogShowing(SETTINGS_SHEET)).toBe(true);
      press('Escape');
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('a second Escape, after the Hangar has closed, does nothing', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      await openHangar();
      press('Escape');

      press('Escape');
      press('Escape', {}, document.body);

      expect(isTitleShowing()).toBe(true);
      expect(isHangarOpen()).toBe(false);
      expect(onStart).not.toHaveBeenCalled();
      expect(fakeRenderers()).toHaveLength(1);
    });

    it('Hangar keys are dead once it has closed', async () => {
      createMenu();
      await openHangar();
      click('back-btn');
      const created = models.created.length;

      press('ArrowRight', {}, document.body);
      press('ArrowLeft', {}, document.body);
      await settle();

      expect(models.created).toHaveLength(created);
      expect(isHangarOpen()).toBe(false);
    });

    it('opens again with a fresh renderer; five visits leave none alive', async () => {
      createMenu();
      for (let visit = 1; visit <= 5; visit++) {
        await openHangar();
        expect(fakeRenderers(), `visit ${visit}`).toHaveLength(visit);
        expect(liveRenderers(), `visit ${visit}`).toHaveLength(1);
        expect(stageModels(), `visit ${visit}`).toHaveLength(1);
        if (visit % 2 === 0) {
          press('Escape');
        } else {
          click('back-btn');
        }
        expect(liveRenderers(), `after visit ${visit}`).toHaveLength(0);
        expect(document.activeElement).toBe(byId('preview-btn'));
      }

      expect(document.querySelectorAll('#model-preview')).toHaveLength(1);
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
      expect(frames.pending()).toBe(0);
    });

    it('leaves no document or window listener behind after each visit', async () => {
      const ledger = trackGlobalListeners();
      createMenu();
      await openHangar();
      click('back-btn');
      // 第一次进出之后（机库模块已常驻）的监听集合就是基准
      const baseline = ledger.snapshot();

      for (let visit = 0; visit < 4; visit++) {
        await openHangar();
        expect(ledger.snapshot().length, 'the open Hangar listens for keys').toBeGreaterThan(0);
        press('Escape');
        expect(ledger.snapshot(), `after visit ${visit}`).toEqual(baseline);
      }
    });

    it('a closed Hangar no longer listens for keys or pointer moves on the document', async () => {
      const ledger = trackGlobalListeners();
      const onDocument = (): string[] =>
        ledger.snapshot().filter((key) => key.startsWith('document:'));
      createMenu();
      // 基准取在第一次进机库之前：机库自己的按键监听不该在关掉之后留下
      // （机库实例常驻的那一个 window resize 监听不在此列，它随菜单 dispose 一起走）
      const onTitle = onDocument();

      await openHangar();
      click('back-btn');
      expect(onDocument(), 'after Main Menu').toEqual(onTitle);

      await openHangar();
      press('Escape');
      expect(onDocument(), 'after Escape').toEqual(onTitle);
    });
  });

  describe('switching models', () => {
    it('Next walks through every model and wraps round to the first', async () => {
      createMenu();
      await openHangar();
      const { total } = page();
      const names = [modelName()];

      for (let step = 1; step < total; step++) {
        click('next-btn');
        await modelLoaded();
        expect(page().index).toBe(step + 1);
        names.push(modelName());
      }
      expect(new Set(names).size, `every page shows a different model: ${names.join(', ')}`).toBe(
        total
      );

      click('next-btn');
      await modelLoaded();
      expect(page()).toEqual({ index: 1, total });
      expect(modelName()).toBe(names[0]);
    });

    it('Previous from the first model wraps round to the last', async () => {
      createMenu();
      await openHangar();
      const { total } = page();

      click('prev-btn');
      await modelLoaded();
      expect(page()).toEqual({ index: total, total });
      const lastName = modelName();
      expect(lastName).not.toBe(COPY.firstModel.en);

      click('next-btn');
      await modelLoaded();
      expect(page().index).toBe(1);
      expect(modelName()).toBe(COPY.firstModel.en);

      click('prev-btn');
      click('prev-btn');
      await modelLoaded();
      expect(page().index).toBe(total - 1);
    });

    it('the arrow keys switch models and wrap the same way', async () => {
      createMenu();
      await openHangar();
      const { total } = page();

      expect(press('ArrowLeft').defaultPrevented).toBe(true);
      await modelLoaded();
      expect(page().index).toBe(total);

      expect(press('ArrowRight').defaultPrevented).toBe(true);
      await modelLoaded();
      expect(page().index).toBe(1);

      press('ArrowRight');
      await modelLoaded();
      expect(page().index).toBe(2);
    });

    it('arrow keys with a modifier are left to the browser', async () => {
      createMenu();
      await openHangar();

      for (const modifier of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
        expect(press('ArrowRight', modifier).defaultPrevented).toBe(false);
        expect(press('ArrowLeft', modifier).defaultPrevented).toBe(false);
      }
      await settle();

      expect(page().index).toBe(1);
    });

    it('shows one model at a time, also when Next is hit faster than models load', async () => {
      createMenu();
      await openHangar();

      for (let i = 0; i < 6; i++) {
        byId('next-btn').click();
      }
      press('ArrowLeft');
      await modelLoaded();

      expect(page().index).toBe(6);
      expect(stageModels()).toHaveLength(1);
      expect(modelName()).not.toMatch(/loading|加载/i);
    });

    it('names the kind of model shown (player, enemy, boss, ordnance)', async () => {
      createMenu();
      await openHangar();
      const { total } = page();
      const kinds: string[] = [readableText(byId('aircraft-type'))];
      for (let step = 1; step < total; step++) {
        click('next-btn');
        await modelLoaded();
        kinds.push(readableText(byId('aircraft-type')));
      }

      expect(kinds[0]).toBe('Player');
      expect(new Set(kinds)).toEqual(new Set(['Player', 'Enemy', 'Boss', 'Ordnance']));
      expect(kinds.every((kind) => kind.length > 0)).toBe(true);
    });

    it('a sideways swipe on the stage switches models; a tap does not', async () => {
      createMenu();
      await openHangar();
      const stage = byId('canvas-container');
      const touch = (type: string, key: 'touches' | 'changedTouches', clientX: number): void => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, key, { value: [{ clientX, clientY: 200 }] });
        stage.dispatchEvent(event);
      };
      const { total } = page();

      touch('touchstart', 'touches', 300);
      touch('touchend', 'changedTouches', 60);
      await modelLoaded();
      expect(page().index, 'swipe left: next').toBe(2);

      touch('touchstart', 'touches', 60);
      touch('touchend', 'changedTouches', 300);
      await modelLoaded();
      expect(page().index, 'swipe right: previous').toBe(1);

      touch('touchstart', 'touches', 60);
      touch('touchend', 'changedTouches', 300);
      await modelLoaded();
      expect(page().index, 'swipe right from the first wraps').toBe(total);

      touch('touchstart', 'touches', 200);
      touch('touchend', 'changedTouches', 204);
      await modelLoaded();
      expect(page().index, 'a tap stays put').toBe(total);
    });

    it('closing while a model is still loading leaves nothing on the next visit', async () => {
      createMenu();
      await openHangar();

      byId('next-btn').click();
      byId('back-btn').click();
      await settle();

      expect(isTitleShowing()).toBe(true);
      expect(liveRenderers()).toHaveLength(0);

      await openHangar();
      expect(stageModels()).toHaveLength(1);
      expect(page().index).toBe(1);
      expect(modelName()).toBe(COPY.firstModel.en);
    });
  });

  describe('auto-rotate', () => {
    function rotateToggle(): HTMLElement {
      return byId('rotate-toggle');
    }

    function turnOver(frameCount: number): number {
      const [model] = stageModels();
      const before = model.rotation.y;
      for (let i = 0; i < frameCount; i++) {
        frames.run();
      }
      return model.rotation.y - before;
    }

    it.each(LOCALES)('is on when the Hangar opens, and says so (%s)', async (locale) => {
      setLocale(locale);
      createMenu();
      await openHangar();

      expect(rotateToggle().getAttribute('aria-pressed')).toBe('true');
      expect(readableText(rotateToggle())).toBe(textIn(COPY.rotateOn, locale));
    });

    it.each(LOCALES)('toggles off and on again, relabelling each time (%s)', async (locale) => {
      setLocale(locale);
      createMenu();
      await openHangar();

      click('rotate-toggle');
      expect(rotateToggle().getAttribute('aria-pressed')).toBe('false');
      expect(readableText(rotateToggle())).toBe(textIn(COPY.rotateOff, locale));

      click('rotate-toggle');
      expect(rotateToggle().getAttribute('aria-pressed')).toBe('true');
      expect(readableText(rotateToggle())).toBe(textIn(COPY.rotateOn, locale));
    });

    it('the model turns while it is on and holds still while it is off', async () => {
      createMenu();
      await openHangar();

      expect(turnOver(10)).toBeGreaterThan(0);

      click('rotate-toggle');
      expect(turnOver(10)).toBe(0);

      click('rotate-toggle');
      expect(turnOver(10)).toBeGreaterThan(0);
    });

    it('keeps turning in the same direction at a steady, finite rate', async () => {
      createMenu();
      await openHangar();

      const first = turnOver(20);
      const second = turnOver(20);

      expect(Number.isFinite(first) && Number.isFinite(second)).toBe(true);
      expect(Math.sign(first)).toBe(Math.sign(second));
      expect(second).toBeCloseTo(first, 5);
    });

    it('a long gap between frames (tab in the background) does not spin the model wildly', async () => {
      createMenu();
      await openHangar();
      const [model] = stageModels();
      const before = model.rotation.y;

      frames.run(10 * 60 * 1000);

      expect(Math.abs(model.rotation.y - before)).toBeLessThan(Math.PI / 4);
      expect(Number.isFinite(model.rotation.y)).toBe(true);
    });

    it('stays off when another model is selected', async () => {
      createMenu();
      await openHangar();
      click('rotate-toggle');

      click('next-btn');
      await modelLoaded();

      expect(rotateToggle().getAttribute('aria-pressed')).toBe('false');
      expect(readableText(rotateToggle())).toBe(COPY.rotateOff.en);
      expect(turnOver(10)).toBe(0);
    });

    it('the label follows a language change while it is off', async () => {
      createMenu();
      await openHangar();
      click('rotate-toggle');

      setLocale('zh-CN');
      expect(readableText(rotateToggle())).toBe(COPY.rotateOff.zh);
      expect(rotateToggle().getAttribute('aria-pressed')).toBe('false');

      click('rotate-toggle');
      expect(readableText(rotateToggle())).toBe(COPY.rotateOn.zh);
    });

    it('label and pressed state agree after a close and reopen', async () => {
      createMenu();
      await openHangar();
      click('rotate-toggle');
      click('back-btn');

      await openHangar();

      const pressed = rotateToggle().getAttribute('aria-pressed') === 'true';
      expect(readableText(rotateToggle())).toBe(pressed ? COPY.rotateOn.en : COPY.rotateOff.en);
      const turned = turnOver(10);
      expect(turned > 0, 'what it says is what the model does').toBe(pressed);
    });

    it('dragging the model turns it by hand, and letting go hands back to auto-rotate', async () => {
      createMenu();
      await openHangar();
      click('rotate-toggle');
      const [model] = stageModels();
      const stage = byId('canvas-container');

      stage.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 180 }));
      const dragged = model.rotation.y;
      expect(dragged).not.toBe(0);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 400 }));
      expect(model.rotation.y, 'no longer dragging').toBe(dragged);
    });
  });

  describe('language', () => {
    it('relabels the open Hangar when the language changes', async () => {
      createMenu();
      await openHangar();
      const check = (locale: Locale): void => {
        expect(readableText(byId('back-btn'))).toBe(textIn(COPY.back, locale));
        expect(modelName()).toBe(textIn(COPY.firstModel, locale));
        expect(readableText(byId('rotate-toggle'))).toBe(textIn(COPY.rotateOn, locale));
      };
      check('en');

      setLocale('zh-CN');
      check('zh-CN');
      expect(isHangarOpen()).toBe(true);
      expect(page().index).toBe(1);

      setLocale('en');
      check('en');
    });

    it('keeps the model being looked at when the language changes', async () => {
      createMenu();
      await openHangar();
      click('next-btn');
      click('next-btn');
      await modelLoaded();
      const { index } = page();
      const englishName = modelName();

      setLocale('zh-CN');

      expect(page().index).toBe(index);
      expect(modelName()).not.toBe('');
      expect(stageModels()).toHaveLength(1);
      setLocale('en');
      expect(modelName()).toBe(englishName);
    });

    it('returns to a title in the current language', async () => {
      createMenu();
      await openHangar();
      setLocale('zh-CN');

      click('back-btn');

      expect(readableText(byId('preview-btn'))).toContain(COPY.hangarButton.zh);
      expect(document.activeElement).toBe(byId('preview-btn'));
    });
  });

  describe('pixel ratio', () => {
    function setDevicePixelRatio(value: number): void {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value });
    }

    it('is capped at 1.5 on touch devices', async () => {
      GameConfig.isMobile = true;
      setDevicePixelRatio(3);
      createMenu();
      await openHangar();

      expect(hangarRenderer().pixelRatios.length).toBeGreaterThan(0);
      expect(Math.max(...hangarRenderer().pixelRatios)).toBe(1.5);
    });

    it('is capped on desktop too, and never below 1', async () => {
      setDevicePixelRatio(3);
      createMenu();
      await openHangar();
      expect(Math.max(...hangarRenderer().pixelRatios)).toBeLessThan(3);
      click('back-btn');

      setDevicePixelRatio(0.5);
      await openHangar();
      expect(Math.min(...hangarRenderer().pixelRatios)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('adversarial sequences', () => {
    it('New Campaign pressed while the Hangar is loading: the run starts, the Hangar never appears', async () => {
      useMenuFakeTimers();
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      click('preview-btn');
      click('start-btn');
      await settle();
      await vi.advanceTimersByTimeAsync(1500);
      await settle();

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(isHangarOpen()).toBe(false);
      expect(liveRenderers()).toHaveLength(0);
      expect(isTitleShowing()).toBe(false);
    });

    it('the menu hidden while the Hangar is loading: the Hangar does not pop up over the game', async () => {
      const startMenu = createMenu();
      click('preview-btn');
      startMenu.hide();
      await settle();

      expect(isHangarOpen()).toBe(false);
      expect(fakeRenderers()).toHaveLength(0);

      startMenu.show();
      expect(isOperable(byId('preview-btn')), 'and the button is not left stuck').toBe(true);
      await openHangar();
      expect(liveRenderers()).toHaveLength(1);
    });

    it('the menu disposed while the Hangar is loading: nothing appears, nothing is reported', async () => {
      const startMenu = createMenu();
      click('preview-btn');
      startMenu.dispose();
      menu = null;
      await settle();

      expect(document.getElementById('start-menu')).toBeNull();
      expect(isHangarOpen()).toBe(false);
      expect(fakeRenderers()).toHaveLength(0);
      expect(consoleError).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    });

    it('the menu disposed with the Hangar open: Hangar, renderer and listeners all go', async () => {
      const ledger = trackGlobalListeners();
      const before = ledger.snapshot();
      const startMenu = createMenu();
      await openHangar();
      const renderer = hangarRenderer();

      startMenu.dispose();
      menu = null;

      expect(document.getElementById('model-preview')).toBeNull();
      expect(document.getElementById('start-menu')).toBeNull();
      expect(renderer.disposed).toBe(1);
      expect(liveRenderers()).toHaveLength(0);
      expect(frames.pending()).toBe(0);
      expect(ledger.snapshot()).toEqual(before);
      press('Escape', {}, document.body);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('show() with the Hangar open closes the Hangar and brings the title back', async () => {
      const startMenu = createMenu();
      await openHangar();

      startMenu.show();

      expect(isHangarOpen()).toBe(false);
      expect(isTitleShowing()).toBe(true);
      expect(liveRenderers()).toHaveLength(0);
      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isOperable(byId(id)), `#${id}`).toBe(true);
      }
    });

    it('closing in the middle of a drag leaves no document listener behind', async () => {
      const ledger = trackGlobalListeners();
      createMenu();
      await openHangar();
      click('back-btn');
      const baseline = ledger.snapshot();
      await openHangar();

      byId('canvas-container').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100 })
      );
      press('Escape');

      expect(ledger.snapshot()).toEqual(baseline);
    });

    it('Settings opened while the Hangar was loading does not strand the player', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      useMenuFakeTimers();

      click('preview-btn');
      click('settings-btn');
      await settle();
      if (isHangarOpen()) {
        press('Escape');
      }
      vi.advanceTimersByTime(600);
      if (isDialogShowing(SETTINGS_SHEET)) {
        press('Escape', {}, document.body);
        vi.advanceTimersByTime(600);
      }

      expect(isHangarOpen()).toBe(false);
      expect(isTitleShowing()).toBe(true);
      expect(isDialogShowing(SETTINGS_SHEET)).toBe(false);
      for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isOperable(byId(id)), `#${id}`).toBe(true);
      }
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    // 机库模块还在下载（按钮写着“加载中”）时玩家开了一张面板：机库不盖到面板上面，这一次就不进了——
    // 面板留着、焦点在面板里；关掉面板之后再点“机库”照常打开。
    // （最初是 FINDING：openHangar 只看 disposed / visible / launching，机库会盖在开着的面板上，
    // 返回后焦点落在面板背后 inert 的 #preview-btn 上。已在 src/ui/StartMenu.ts:634 修复。）
    describe.each([
      { name: 'Settings', opener: 'settings-btn', sheet: SETTINGS_SHEET, needsSave: false },
      { name: 'How to Play', opener: 'howto-btn', sheet: HOWTO_SHEET, needsSave: false },
      {
        name: 'the New Campaign confirmation',
        opener: 'start-btn',
        sheet: CONFIRM_SHEET,
        needsSave: true,
      },
    ])('$name opened while the Hangar was loading', ({ opener, sheet, needsSave }) => {
      /** 点“机库”，趁模块还没到点开面板，再等到机库模块早该到了 */
      async function openSheetDuringLoad(): Promise<void> {
        if (needsSave) {
          seedCheckpoint();
        }
        createMenu();
        useMenuFakeTimers();
        click('preview-btn');
        click(opener);
        expect(isDialogShowing(sheet)).toBe(true);
        await settle(30);
      }

      it('keeps the screen: the Hangar does not appear and takes no WebGL context', async () => {
        await openSheetDuringLoad();

        expect(isHangarOpen()).toBe(false);
        expect(fakeRenderers()).toHaveLength(0);
        expect(models.created).toEqual([]);
        expect(isTitleShowing()).toBe(true);
        expect(isDialogShowing(sheet), 'the sheet is still up').toBe(true);
        expect(byId(sheet).contains(document.activeElement), 'focus is inside the open sheet').toBe(
          true
        );
        expect(consoleError).not.toHaveBeenCalled();
      });

      it('the sheet still works: Escape closes it and focus goes back to its opener', async () => {
        await openSheetDuringLoad();

        press('Escape');
        vi.advanceTimersByTime(600);

        expect(isDialogShowing(sheet)).toBe(false);
        expect(isHangarOpen(), 'the Hangar does not pop up late either').toBe(false);
        expect(document.activeElement).toBe(byId(opener));
        for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
          expect(isOperable(byId(id)), `#${id}`).toBe(true);
        }
      });

      it('a later Hangar activation, after closing the sheet, opens it', async () => {
        await openSheetDuringLoad();
        press('Escape');
        vi.advanceTimersByTime(600);

        await openHangar();

        expect(isTitleShowing()).toBe(false);
        expect(liveRenderers()).toHaveLength(1);
        expect(modelName()).toBe(COPY.firstModel.en);
        expect(stageModels()).toHaveLength(1);
        press('Escape');
        expect(isTitleShowing()).toBe(true);
        expect(document.activeElement).toBe(byId('preview-btn'));
        expect(isDialogShowing(sheet), 'and the sheet does not come back').toBe(false);
      });
    });

    describe('the Hangar cannot get a WebGL context (the browser refuses to create one)', () => {
      // 渲染器建不出来时机库自己收起、标题画面回来（焦点在“机库”按钮上），不留下一个没有模型、
      // 按键也没接上的空机库；WebGL 恢复之后再点照常打开。
      // （最初是 FINDING：菜单已经隐藏、机库显示之后才抛错，Esc 与方向键都是死的，只有“主菜单”
      // 按钮能出去。已在 src/ui/ModelPreview.ts:1122-1130 修复。）
      async function openWithoutContext(): Promise<void> {
        gl.failNextRenderer = true;
        click('preview-btn');
        await settleUntil(() => !gl.failNextRenderer);
        expect(gl.failNextRenderer, 'a renderer was attempted').toBe(false);
        await settle(12);
        frames.run();
      }

      function documentListeners(ledger: { snapshot: () => string[] }): string[] {
        return ledger.snapshot().filter((key) => key.startsWith('document:'));
      }

      it('brings the player straight back to a working title', async () => {
        const startMenu = createMenu();
        const onStart = vi.fn();
        startMenu.setOnStart(onStart);

        await openWithoutContext();

        expect(isHangarOpen()).toBe(false);
        expect(isTitleShowing()).toBe(true);
        for (const id of ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
          expect(isOperable(byId(id)), `#${id}`).toBe(true);
        }
        click('start-btn');
        expect(onStart).toHaveBeenCalledTimes(1);
      });

      // 标题画面回来时焦点在“机库”按钮上，与“主菜单”/ Esc 离开机库时一样。
      // （最初是 FINDING：机库自己收起并回调时按钮还因“加载中”停用着，focus() 落空，焦点掉到
      // <body> 上，键盘玩家得从页首重新 Tab。已在 src/ui/StartMenu.ts:639-641 修复：显示机库之前
      // 先恢复按钮。）
      it('puts keyboard focus back on the Hangar button', async () => {
        createMenu();
        byId('preview-btn').focus();

        await openWithoutContext();

        expect(isTitleShowing()).toBe(true);
        expect(document.activeElement).toBe(byId('preview-btn'));
        expect(isOperable(byId('preview-btn')), 'and the button takes the next activation').toBe(
          true
        );
      });

      it('focus comes back to the Hangar button wherever it was when the refusal arrived', async () => {
        createMenu();
        // 载入期间玩家把焦点挪到了别的按钮上：机库被拒之后回到的仍是“机库”按钮
        click('preview-btn');
        byId('settings-btn').focus();
        gl.failNextRenderer = true;
        await settleUntil(() => !gl.failNextRenderer);
        await settle(12);

        expect(isTitleShowing()).toBe(true);
        expect(isHangarOpen()).toBe(false);
        expect(document.activeElement).toBe(byId('preview-btn'));
      });

      it('leaves nothing behind: no renderer, canvas, frame, listener or rejection', async () => {
        const ledger = trackGlobalListeners();
        createMenu();
        const onTitle = documentListeners(ledger);

        await openWithoutContext();

        expect(liveRenderers()).toHaveLength(0);
        expect(document.querySelectorAll('canvas')).toHaveLength(0);
        expect(frames.pending()).toBe(0);
        expect(models.created, 'no model was built for a Hangar that never opened').toEqual([]);
        expect(documentListeners(ledger)).toEqual(onTitle);
        expect(unhandled).toEqual([]);
      });

      it('the keys the Hangar would have taken do nothing: no dead Hangar is listening', async () => {
        createMenu();
        await openWithoutContext();

        for (const key of ['Escape', 'ArrowLeft', 'ArrowRight']) {
          press(key);
        }
        await settle();

        expect(isHangarOpen()).toBe(false);
        expect(isTitleShowing()).toBe(true);
        expect(models.created).toEqual([]);
      });

      it('a later attempt works once WebGL is available again', async () => {
        createMenu();
        await openWithoutContext();

        await openHangar();

        expect(isTitleShowing()).toBe(false);
        expect(liveRenderers()).toHaveLength(1);
        expect(page().index).toBe(1);
        expect(modelName()).toBe(COPY.firstModel.en);
        expect(stageModels()).toHaveLength(1);
        expect(press('ArrowRight').defaultPrevented, 'its keys are wired this time').toBe(true);
        await modelLoaded();
        expect(page().index).toBe(2);
        press('Escape');
        expect(isTitleShowing()).toBe(true);
        expect(document.activeElement).toBe(byId('preview-btn'));
        expect(liveRenderers()).toHaveLength(0);
      });

      it('refused several times in a row: the title comes back every time, nothing piles up', async () => {
        const ledger = trackGlobalListeners();
        createMenu();
        await openWithoutContext();
        const afterFirst = ledger.snapshot();

        for (let attempt = 0; attempt < 3; attempt++) {
          await openWithoutContext();
          expect(isHangarOpen(), `attempt ${attempt}`).toBe(false);
          expect(isTitleShowing(), `attempt ${attempt}`).toBe(true);
          expect(isOperable(byId('preview-btn')), `attempt ${attempt}`).toBe(true);
          expect(document.activeElement, `focus after attempt ${attempt}`).toBe(
            byId('preview-btn')
          );
          expect(ledger.snapshot(), `listeners after attempt ${attempt}`).toEqual(afterFirst);
        }

        expect(document.querySelectorAll('#model-preview')).toHaveLength(1);
        expect(liveRenderers()).toHaveLength(0);
        expect(unhandled).toEqual([]);
        await openHangar();
        expect(stageModels()).toHaveLength(1);
      });

      it.each(LOCALES)(
        'the title that comes back is in the chosen language (%s)',
        async (locale) => {
          setLocale(locale);
          createMenu();
          await openWithoutContext();

          const label = readableText(byId('preview-btn'));
          expect(label).toContain(textIn(COPY.hangarButton, locale));
          expect(label, 'not left saying "Loading"').not.toMatch(/loading|加载/i);
          expect(isOperable(byId('preview-btn'))).toBe(true);
        }
      );
    });

    describe('a model that cannot be loaded (its chunk fails to download, or its factory throws)', () => {
      // 载入失败的那一页写明“无法加载：{名称}”、错误记到控制台、没有未处理的 Promise 拒绝；
      // 其余模型与返回照常可用。
      // （最初是 FINDING：showAircraft 等 createMesh() 时没有 catch，标签一直停在“加载中”，失败只以
      // 未处理的 Promise 拒绝的形式冒出来。已在 src/ui/ModelPreview.ts:1037-1047 修复。）
      type MissileModule = { createBossMissileVisualMesh: () => unknown };
      const FAILED = { en: 'Could not load: {name}', zh: '无法加载：{name}' } as const;
      let missiles: MissileModule;
      let original: MissileModule['createBossMissileVisualMesh'];
      let failing: ReturnType<typeof vi.fn>;
      const buildError = new Error('model failed to build');

      beforeEach(async () => {
        missiles = (await import('@/features/boss/BossMissileSystem')) as unknown as MissileModule;
        original = missiles.createBossMissileVisualMesh;
        failing = vi.fn(() => {
          throw buildError;
        });
      });

      afterEach(() => {
        missiles.createBossMissileVisualMesh = original;
      });

      /** 最后一页是 Boss 导弹：从现在起它的工厂抛错 */
      function breakLastModel(): void {
        missiles.createBossMissileVisualMesh = failing;
      }

      function repairLastModel(): void {
        missiles.createBossMissileVisualMesh = original;
      }

      /** 工厂还正常时翻到最后一页看一眼它的名字，再回到第一页 */
      async function nameOfLastModel(): Promise<string> {
        click('prev-btn');
        await modelLoaded();
        const name = modelName();
        expect(name).toMatch(/\S/);
        click('next-btn');
        await modelLoaded();
        expect(page().index).toBe(1);
        return name;
      }

      /** 翻到坏掉的那一页（第一页往前一页），等它失败 */
      async function goToBrokenModel(): Promise<number> {
        const { total } = page();
        const attemptsBefore = failing.mock.calls.length;
        click('prev-btn');
        await settleUntil(() => failing.mock.calls.length > attemptsBefore);
        await settle();
        expect(failing.mock.calls.length).toBeGreaterThan(attemptsBefore);
        expect(page().index).toBe(total);
        return total;
      }

      it.each(LOCALES)('says which model could not be loaded (%s)', async (locale) => {
        setLocale(locale);
        createMenu();
        await openHangar();
        const name = await nameOfLastModel();
        breakLastModel();

        await goToBrokenModel();

        expect(modelName()).toBe(textIn(FAILED, locale).replace('{name}', name));
        expect(modelName()).not.toMatch(/loading|加载中/i);
        expect(readableText(byId('aircraft-type')), 'the kind of model is still named').toMatch(
          /\S/
        );
      });

      it('lets no rejection escape and reports the underlying error to the console', async () => {
        breakLastModel();
        createMenu();
        await openHangar();
        expect(consoleError).not.toHaveBeenCalled();

        await goToBrokenModel();

        expect(unhandled).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]).toContain(buildError);
      });

      it('does not leave the previous model on the stage under the failed label', async () => {
        breakLastModel();
        createMenu();
        await openHangar();
        expect(stageModels()).toHaveLength(1);

        await goToBrokenModel();

        expect(stageModels()).toHaveLength(0);
      });

      it('does not take the Hangar down with it: the other models and the way back still work', async () => {
        breakLastModel();
        createMenu();
        await openHangar();
        const total = await goToBrokenModel();

        click('next-btn');
        await modelLoaded();
        expect(page()).toEqual({ index: 1, total });
        expect(modelName()).toBe(COPY.firstModel.en);
        expect(stageModels()).toHaveLength(1);

        // 往另一个方向翻过坏的那一页
        click('prev-btn');
        click('prev-btn');
        await modelLoaded();
        expect(page().index).toBe(total - 1);
        expect(modelName()).not.toMatch(/could not load|无法加载|loading|加载中/i);
        expect(stageModels()).toHaveLength(1);

        click('back-btn');
        expect(isTitleShowing()).toBe(true);
        expect(document.activeElement).toBe(byId('preview-btn'));
        expect(liveRenderers()).toHaveLength(0);
        expect(unhandled).toEqual([]);
      });

      it('the arrow keys and Escape still work on the failed page', async () => {
        breakLastModel();
        createMenu();
        await openHangar();
        const total = await goToBrokenModel();

        expect(press('ArrowLeft').defaultPrevented).toBe(true);
        await modelLoaded();
        expect(page().index).toBe(total - 1);

        // 回到坏的那一页，在它上面按 Esc
        const attempts = failing.mock.calls.length;
        expect(press('ArrowRight').defaultPrevented).toBe(true);
        await settleUntil(() => failing.mock.calls.length > attempts);
        await settle();
        expect(page().index).toBe(total);
        press('Escape');
        expect(isHangarOpen()).toBe(false);
        expect(isTitleShowing()).toBe(true);
        expect(document.activeElement).toBe(byId('preview-btn'));
      });

      it('shows the model on a later visit to its page once it can be loaded again', async () => {
        createMenu();
        await openHangar();
        const name = await nameOfLastModel();
        breakLastModel();
        await goToBrokenModel();
        expect(modelName()).toContain('Could not load');

        repairLastModel();
        click('next-btn');
        await modelLoaded();
        click('prev-btn');
        await modelLoaded();

        expect(modelName()).toBe(name);
        expect(stageModels()).toHaveLength(1);
        expect(consoleError, 'only the one failure was reported').toHaveBeenCalledTimes(1);
      });

      it('the next visit to the Hangar opens on the first model, not on the failure', async () => {
        breakLastModel();
        createMenu();
        await openHangar();
        await goToBrokenModel();
        click('back-btn');

        await openHangar();

        expect(page().index).toBe(1);
        expect(modelName()).toBe(COPY.firstModel.en);
        expect(stageModels()).toHaveLength(1);
      });

      describe('a failure that arrives late', () => {
        let fail: () => void;
        let pending: ReturnType<typeof vi.fn>;

        beforeEach(() => {
          fail = () => undefined;
          pending = vi.fn(
            () =>
              new Promise((_resolve, reject) => {
                fail = () => reject(buildError);
              })
          );
          missiles.createBossMissileVisualMesh = pending;
        });

        /** 翻到那一页，它的模型还在路上 */
        async function goToPendingModel(): Promise<void> {
          click('prev-btn');
          await settleUntil(() => pending.mock.calls.length > 0);
          expect(pending).toHaveBeenCalledTimes(1);
          expect(modelName()).toMatch(/loading/i);
        }

        it('after the player moved on: the model now showing keeps its own label', async () => {
          createMenu();
          await openHangar();
          await goToPendingModel();
          click('next-btn');
          await modelLoaded();

          fail();
          await settle();

          expect(page().index).toBe(1);
          expect(modelName()).toBe(COPY.firstModel.en);
          expect(stageModels()).toHaveLength(1);
          expect(unhandled).toEqual([]);
        });

        it('after the Hangar was closed: nothing is written, nothing escapes', async () => {
          createMenu();
          await openHangar();
          await goToPendingModel();
          press('Escape');
          expect(isTitleShowing()).toBe(true);

          fail();
          await settle();

          expect(isHangarOpen()).toBe(false);
          expect(unhandled).toEqual([]);
          expect(modelName()).not.toMatch(/could not load|无法加载/i);

          await openHangar();
          expect(modelName()).toBe(COPY.firstModel.en);
          expect(stageModels()).toHaveLength(1);
        });

        it('while the player is still on that page: the label says so', async () => {
          createMenu();
          await openHangar();
          await goToPendingModel();

          fail();
          await settle();

          expect(modelName()).toMatch(/^Could not load: \S/);
          expect(unhandled).toEqual([]);
        });
      });
    });
  });

  describe('alongside the title-screen 3D hero: never two WebGL contexts', () => {
    async function letHeroArrive(): Promise<void> {
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(500);
        await settle();
      }
    }

    beforeEach(() => {
      useMenuFakeTimers();
      vi.stubGlobal('WebGLRenderingContext', class {});
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720);
    });

    it('the hero gives its context back before the Hangar takes one, and returns afterwards', async () => {
      createMenu();
      await letHeroArrive();
      expect(liveRenderers(), 'the hero').toHaveLength(1);
      const heroRenderer = liveRenderers()[0];
      expect(byId('start-menu').contains(heroRenderer.domElement)).toBe(true);

      await openHangar();

      expect(heroRenderer.disposed, 'the hero was released').toBe(1);
      expect(liveRenderers(), 'only the Hangar').toHaveLength(1);
      expect(byId('canvas-container').contains(liveRenderers()[0].domElement)).toBe(true);

      click('back-btn');
      expect(liveRenderers(), 'nothing during the hand-back').toHaveLength(0);

      await letHeroArrive();
      expect(liveRenderers(), 'the hero again').toHaveLength(1);
      expect(byId('start-menu').contains(liveRenderers()[0].domElement)).toBe(true);
      expect(Math.max(...gl.aliveAtCreation), 'never two at once').toBe(1);
    });

    it('holds across repeated visits, quick ones included', async () => {
      createMenu();
      for (let visit = 0; visit < 6; visit++) {
        if (visit % 2 === 0) {
          await letHeroArrive();
        }
        await openHangar();
        expect(liveRenderers(), `in the Hangar, visit ${visit}`).toHaveLength(1);
        press('Escape');
      }
      await letHeroArrive();

      expect(Math.max(...gl.aliveAtCreation)).toBe(1);
      expect(liveRenderers()).toHaveLength(1);
      expect(document.querySelectorAll('canvas')).toHaveLength(1);
    });

    it('with reduced motion as well', async () => {
      stubMatchMedia({ reducedMotion: true });
      createMenu();
      await letHeroArrive();
      expect(liveRenderers()).toHaveLength(1);

      await openHangar();
      expect(liveRenderers()).toHaveLength(1);
      click('back-btn');
      await letHeroArrive();

      expect(Math.max(...gl.aliveAtCreation)).toBe(1);
      expect(liveRenderers()).toHaveLength(1);
    });

    it('starting a run after a Hangar visit leaves no context for the game to compete with', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);
      await letHeroArrive();
      await openHangar();
      click('back-btn');
      await letHeroArrive();

      click('start-btn');
      await vi.advanceTimersByTimeAsync(1500);

      expect(liveRenderers()).toHaveLength(0);
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
      expect(frames.pending()).toBe(0);
    });
  });
});
