import * as THREE from 'three';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { setLocale } from '@/i18n';
import { StartMenu } from '@/ui/StartMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';
import {
  byId,
  click,
  installAnimationFrames,
  isShown,
  last,
  press,
  prepareMenuEnvironment,
  resetMenuEnvironment,
  settle,
  settleUntil,
  watchUnhandledRejections,
  type AnimationFrames,
  type RejectionWatch,
} from './menuTestUtils';

/**
 * 批次 X5 追加 · 机库载入飞机模型工厂（玩家机与五种敌机共用的那个模块）。
 *
 * - 载入失败：那一页写明“无法加载：{名称}”；失败的那一次不留着，之后再翻到玩家机 / 敌机的页会
 *   重新 import()，import 能成了就照常显示。
 * - 载入还在路上或已经成功：之后的请求共用这一次，不再 import()。
 *
 * 这里的“载入失败 / 又能载入了”是在模块这一层模拟的（替身模块的工厂抛错 / 不再抛错）。
 * 真实浏览器的模块表自己也会记住一次失败的下载，那种情况要刷新页面才会重新下载——
 * 网络层面的恢复不在这里断言。
 *
 * Vitest 的一个限制决定了“共用一次 import”怎么查：同一个模块里并发的第二个 import() 拿到的不是
 * vi.mock 的替身，而是真模块。正确的实现任何时候都只有一个 import() 在路上，碰不到这个限制；
 * 所以这里看的是“展台上的模型是不是替身模块造的”，而不是去数并发的 import()。
 */

interface FakeRenderer {
  domElement: HTMLCanvasElement;
  frames: Array<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera }>;
  disposed: number;
  contextLosses: number;
}

const gl = vi.hoisted(() => ({ renderers: [] as unknown[] }));

function liveRenderers(): FakeRenderer[] {
  return (gl.renderers as FakeRenderer[]).filter(
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
    public readonly frames: Array<{ scene: unknown; camera: unknown }> = [];
    public disposed = 0;
    public contextLosses = 0;

    constructor() {
      gl.renderers.push(this);
    }
    public setClearColor(): void {}
    public setPixelRatio(): void {}
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

/** 飞机模型工厂模块的“下载”：每个用例重新登记一次替身（vi.doMock），所以每个用例从没载入过开始 */
const download = {
  /** 替身模块的工厂被调用的次数 = 真正走到“下载”那一步的 import() 次数 */
  count: 0,
  /** 为真时这一次下载以失败告终（放行之后才看，所以可以先悬着再决定成败） */
  failing: false,
  /** 非空时下载悬着，等用例放行 */
  gate: null as Promise<void> | null,
  /** 这个模块造出来的模型，按先后 */
  built: [] as string[],
};

const DOWNLOAD_ERROR = 'Failed to fetch dynamically imported module';

async function aircraftFactoryModule(): Promise<Record<string, unknown>> {
  download.count++;
  const gate = download.gate;
  if (gate) {
    await gate;
  }
  if (download.failing) {
    throw new Error(DOWNLOAD_ERROR);
  }
  const box = (tag: string): THREE.Group => {
    download.built.push(tag);
    const group = new THREE.Group();
    group.name = tag;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshBasicMaterial()));
    return group;
  };
  return {
    createPlayerMesh: () => box('player'),
    createEnemyMesh: (config: { type: string }) => box(`enemy:${config.type}`),
    updateAircraftSignals: () => undefined,
    updatePlayerAfterburner: () => undefined,
  };
}

const PLAYER_JET = { en: 'Player jet', zh: '玩家飞机' } as const;
const FAILED = { en: 'Could not load: {name}', zh: '无法加载：{name}' } as const;
const FAILED_LABEL = /^(?:Could not load: |无法加载：)(.+)$/;
/** 第 1 页是玩家机，第 2 – 6 页是敌机：都靠这个模块。用例只在这几页之间翻 */
const LAST_AIRCRAFT_PAGE = 6;

describe('Hangar: loading the aircraft factory (batch X5 follow-up 2)', () => {
  let menu: StartMenu | null = null;
  let frames: AnimationFrames;
  let originalIsMobile: boolean;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let rejections: RejectionWatch;
  let releaseHeldDownload: (() => void) | null = null;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  function isHangarOpen(): boolean {
    return isShown(document.getElementById('model-preview'));
  }

  function modelName(): string {
    return (byId('aircraft-name').textContent ?? '').trim();
  }

  function page(): number {
    const text = byId('page-indicator').textContent ?? '';
    const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
    expect(match, `page indicator "${text}"`).not.toBeNull();
    return Number(match?.[1]);
  }

  function isStillLoading(): boolean {
    return /loading|加载中/i.test(modelName());
  }

  /** 失败标签里写的模型名称；这一页没有失败就是 undefined */
  function failedName(): string | undefined {
    return FAILED_LABEL.exec(modelName())?.[1];
  }

  /** 当前这一页有了结果：模型显示出来，或者写明了无法加载 */
  async function pageSettled(): Promise<void> {
    await settleUntil(() => !isStillLoading());
    await settle(2);
    frames.run();
  }

  /** 点“机库”，等它打开（第一页的模型可能还在路上） */
  async function enterHangar(): Promise<void> {
    click('preview-btn');
    await settleUntil(() => isHangarOpen());
    expect(isHangarOpen(), 'the Hangar opened').toBe(true);
  }

  async function openHangar(): Promise<void> {
    await enterHangar();
    await pageSettled();
  }

  async function turn(button: 'next-btn' | 'prev-btn'): Promise<void> {
    click(button);
    await pageSettled();
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

  /** 展台上的模型是替身模块造的哪一个；不是它造的（或展台上没有模型）就是 undefined */
  function builtModelOnStage(): string | undefined {
    const tags: string[] = [];
    for (const model of stageModels()) {
      model.traverse((object) => {
        if (download.built.includes(object.name)) {
          tags.push(object.name);
        }
      });
    }
    expect(tags.length, 'one model at most').toBeLessThanOrEqual(1);
    return tags[0];
  }

  /** 从现在起下载悬着；返回放行的函数 */
  function holdDownload(): () => void {
    let open: () => void = () => undefined;
    download.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const release = (): void => {
      download.gate = null;
      releaseHeldDownload = null;
      open();
    };
    releaseHeldDownload = release;
    return release;
  }

  /**
   * 从现在起，再有 import() 就会重新走到“下载”那一步。
   * Vitest 自己缓存着载入成功的替身模块（之后的 import() 不再调用工厂），重新登记一次把这份缓存清掉；
   * 机库手里已经拿到的那份模块不受影响。
   */
  function anyFurtherImportDownloadsAgain(): void {
    vi.doMock('@/features/aircraft/AircraftMeshFactory', aircraftFactoryModule);
  }

  /** console.error 收到的参数里，有没有那次下载失败本身（Vitest 把工厂抛的错包了一层，原错在 cause 上） */
  function reportedTheDownloadFailure(call: readonly unknown[]): boolean {
    return call.some((argument) => {
      if (!(argument instanceof Error)) {
        return false;
      }
      const cause = (argument as { cause?: unknown }).cause;
      return [argument, cause].some(
        (error) => error instanceof Error && error.message === DOWNLOAD_ERROR
      );
    });
  }

  /** 悬着的那一次下载已经开始，其余请求也都排上了 */
  async function downloadPending(count: number): Promise<void> {
    await settleUntil(() => download.count >= count);
    await settle(20);
    expect(download.count).toBe(count);
  }

  beforeAll(async () => {
    // 机库模块先载入一次：之后每个用例里的 import('./ModelPreview') 只差几个微任务
    await import('@/ui/ModelPreview');
  });

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    GameConfig.isMobile = false;
    prepareMenuEnvironment();
    frames = installAnimationFrames();
    gl.renderers.length = 0;
    download.count = 0;
    download.failing = false;
    download.gate = null;
    download.built.length = 0;
    // 重新登记替身：上一个用例载入成功的那一份不留到这个用例
    vi.doMock('@/features/aircraft/AircraftMeshFactory', aircraftFactoryModule);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    rejections = watchUnhandledRejections();
  });

  afterEach(async () => {
    releaseHeldDownload?.();
    menu?.dispose();
    menu = null;
    await settle(4);
    rejections.stop();
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    resetMenuEnvironment();
    expect(rejections.seen, 'no unhandled promise rejection').toEqual([]);
  });

  describe('when the load fails', () => {
    it.each(LOCALES)('the player jet page says it could not be loaded (%s)', async (locale) => {
      setLocale(locale);
      download.failing = true;
      createMenu();

      await openHangar();

      expect(modelName()).toBe(
        textIn(FAILED, locale).replace('{name}', textIn(PLAYER_JET, locale))
      );
      expect(page()).toBe(1);
      expect(isHangarOpen(), 'the Hangar stays open').toBe(true);
      expect(stageModels()).toHaveLength(0);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(
        reportedTheDownloadFailure(consoleError.mock.calls[0]),
        'the console gets the failed load itself, not a later symptom of it'
      ).toBe(true);
      expect(rejections.seen).toEqual([]);
    });

    it('an enemy page says so as well, under its own name', async () => {
      download.failing = true;
      createMenu();
      await openHangar();

      await turn('next-btn');

      expect(page()).toBe(2);
      expect(failedName()).toMatch(/\S/);
      expect(failedName()).not.toBe(PLAYER_JET.en);
      expect(stageModels()).toHaveLength(0);
      expect(rejections.seen).toEqual([]);
    });

    it('the player jet shows on a later visit once the import works', async () => {
      download.failing = true;
      createMenu();
      await openHangar();
      expect(failedName()).toBe(PLAYER_JET.en);

      download.failing = false;
      await turn('next-btn');
      await turn('prev-btn');

      expect(page()).toBe(1);
      expect(modelName()).toBe(PLAYER_JET.en);
      expect(builtModelOnStage()).toBe('player');
      expect(consoleError, 'only the one failure was reported').toHaveBeenCalledTimes(1);
    });

    it('an enemy model shows on a later visit once the import works', async () => {
      download.failing = true;
      createMenu();
      await openHangar();
      await turn('next-btn');
      const enemy = failedName();
      expect(enemy).toMatch(/\S/);

      download.failing = false;
      await turn('next-btn');
      expect(page()).toBe(3);
      expect(failedName(), 'the page after it loads').toBeUndefined();
      await turn('prev-btn');

      expect(page()).toBe(2);
      expect(modelName()).toBe(enemy);
      expect(builtModelOnStage()).toMatch(/^enemy:/);
    });

    it('the page that failed is the one that recovers: no need to visit another first', async () => {
      download.failing = true;
      createMenu();
      await openHangar();
      expect(failedName()).toBe(PLAYER_JET.en);

      // 离开机库再进来，直接回到第 1 页
      press('Escape');
      expect(isHangarOpen()).toBe(false);
      download.failing = false;
      await openHangar();

      expect(page()).toBe(1);
      expect(modelName()).toBe(PLAYER_JET.en);
      expect(builtModelOnStage()).toBe('player');
    });

    it('tries again exactly once: the retry that worked is kept', async () => {
      download.failing = true;
      createMenu();
      await openHangar();
      expect(download.count).toBe(1);

      download.failing = false;
      for (let visited = 2; visited <= LAST_AIRCRAFT_PAGE; visited++) {
        await turn('next-btn');
        expect(failedName(), `page ${visited}`).toBeUndefined();
      }

      expect(download.count, 'one failed import, one that worked').toBe(2);
      expect(download.built).toHaveLength(LAST_AIRCRAFT_PAGE - 1);
    });

    it('while the import keeps failing, every visit tries again and says so again', async () => {
      download.failing = true;
      createMenu();
      await openHangar();
      await turn('next-btn');
      const enemy = failedName();
      await turn('prev-btn');

      expect(page()).toBe(1);
      expect(failedName()).toBe(PLAYER_JET.en);
      expect(enemy).not.toBe(PLAYER_JET.en);
      expect(download.count, 'one attempt per visit').toBe(3);
      expect(consoleError).toHaveBeenCalledTimes(3);
      expect(stageModels()).toHaveLength(0);
      expect(rejections.seen).toEqual([]);

      // 机库没有被拖垮：Esc 照常回标题画面
      press('Escape');
      expect(isHangarOpen()).toBe(false);
      expect(isShown(byId('start-menu'))).toBe(true);
      expect(document.activeElement).toBe(byId('preview-btn'));
    });
  });

  describe('while one load is pending', () => {
    it('later requests share it: one import serves every page asked for meanwhile', async () => {
      const release = holdDownload();
      createMenu();
      await enterHangar();
      for (let i = 0; i < 3; i++) {
        click('next-btn');
      }
      await downloadPending(1);

      // 还在路上：谁也没等到，页面如实写着“加载中”
      expect(page()).toBe(4);
      expect(isStillLoading()).toBe(true);
      expect(download.built).toEqual([]);

      release();
      await pageSettled();

      expect(page()).toBe(4);
      expect(failedName()).toBeUndefined();
      expect(stageModels()).toHaveLength(1);
      expect(builtModelOnStage(), 'the model on show came from that one import').toMatch(/^enemy:/);
      expect(download.count).toBe(1);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('if it then fails, the page on show says so once and nothing escapes', async () => {
      const release = holdDownload();
      download.failing = true;
      createMenu();
      await enterHangar();
      click('next-btn');
      click('next-btn');
      await downloadPending(1);

      release();
      await pageSettled();

      expect(page()).toBe(3);
      expect(failedName()).toMatch(/\S/);
      expect(failedName()).not.toBe(PLAYER_JET.en);
      expect(consoleError, 'reported for the page on show only').toHaveBeenCalledTimes(1);
      expect(rejections.seen).toEqual([]);
      expect(download.count).toBe(1);

      // 之后 import 能成了：下一页照常显示
      download.failing = false;
      await turn('next-btn');
      expect(page()).toBe(4);
      expect(builtModelOnStage()).toMatch(/^enemy:/);
      expect(download.count).toBe(2);
    });

    it('the Hangar closed before it fails: nothing is reported, and the next visit tries again', async () => {
      const release = holdDownload();
      download.failing = true;
      createMenu();
      await enterHangar();
      await downloadPending(1);
      press('Escape');
      expect(isHangarOpen()).toBe(false);

      release();
      await settle(12);

      expect(consoleError).not.toHaveBeenCalled();
      expect(rejections.seen).toEqual([]);

      download.failing = false;
      await openHangar();
      expect(modelName()).toBe(PLAYER_JET.en);
      expect(builtModelOnStage()).toBe('player');
      expect(download.count).toBe(2);
    });

    it('the Hangar closed before it arrives: the next visit uses it, without another import', async () => {
      const release = holdDownload();
      createMenu();
      await enterHangar();
      await downloadPending(1);
      press('Escape');

      release();
      await settle(12);
      await openHangar();

      expect(modelName()).toBe(PLAYER_JET.en);
      expect(builtModelOnStage()).toBe('player');
      expect(download.count).toBe(1);
    });

    it('the menu disposed before it fails: nothing is reported, nothing escapes', async () => {
      const release = holdDownload();
      download.failing = true;
      const startMenu = createMenu();
      await enterHangar();
      await downloadPending(1);

      startMenu.dispose();
      menu = null;
      release();
      await settle(12);

      expect(consoleError).not.toHaveBeenCalled();
      expect(rejections.seen).toEqual([]);
      expect(liveRenderers()).toHaveLength(0);
    });
  });

  describe('once it has loaded', () => {
    it('quick page turns are all served by it', async () => {
      createMenu();
      await openHangar();
      expect(builtModelOnStage()).toBe('player');
      anyFurtherImportDownloadsAgain();

      // 一口气翻到最后一架敌机：每一页都要这个模块，哪一页都不该再去 import()
      for (let visited = 2; visited <= LAST_AIRCRAFT_PAGE; visited++) {
        click('next-btn');
      }
      await pageSettled();

      expect(page()).toBe(LAST_AIRCRAFT_PAGE);
      expect(failedName()).toBeUndefined();
      expect(stageModels()).toHaveLength(1);
      expect(builtModelOnStage(), 'the model on show came from the loaded module').toMatch(
        /^enemy:/
      );
      expect(download.count, 'nothing was imported again').toBe(1);
    });

    it('one page at a time, it is not imported again either', async () => {
      createMenu();
      await openHangar();
      anyFurtherImportDownloadsAgain();

      for (let visited = 2; visited <= LAST_AIRCRAFT_PAGE; visited++) {
        await turn('next-btn');
        expect(builtModelOnStage(), `page ${visited}`).toMatch(/^enemy:/);
      }
      await turn('prev-btn');

      expect(download.count).toBe(1);
    });

    it('a later failure of the import does not matter any more', async () => {
      createMenu();
      await openHangar();

      // 从这里起 import() 只会失败——但已经载入过，谁也不该再去 import()
      anyFurtherImportDownloadsAgain();
      download.failing = true;
      await turn('next-btn');
      expect(page()).toBe(2);
      expect(failedName()).toBeUndefined();
      expect(builtModelOnStage()).toMatch(/^enemy:/);
      press('Escape');
      await openHangar();

      expect(modelName()).toBe(PLAYER_JET.en);
      expect(builtModelOnStage()).toBe('player');
      expect(consoleError).not.toHaveBeenCalled();
      expect(download.count).toBe(1);
    });
  });

  describe('a retry is shared like any other load', () => {
    it('after a failure, pages asked for during the retry wait for that one import', async () => {
      download.failing = true;
      createMenu();
      await openHangar();
      expect(failedName()).toBe(PLAYER_JET.en);

      download.failing = false;
      const release = holdDownload();
      for (let i = 0; i < 3; i++) {
        click('next-btn');
      }
      await downloadPending(2);
      expect(isStillLoading()).toBe(true);

      release();
      await pageSettled();

      expect(page()).toBe(4);
      expect(failedName()).toBeUndefined();
      expect(builtModelOnStage()).toMatch(/^enemy:/);
      expect(download.count, 'the failed import and one retry').toBe(2);
      expect(consoleError, 'only the first failure was reported').toHaveBeenCalledTimes(1);
    });
  });
});
