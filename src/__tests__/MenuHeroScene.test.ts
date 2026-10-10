import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { MenuHeroScene, type MenuHeroSceneOptions } from '@/ui/menu/MenuHeroScene';
import { StartMenu } from '@/ui/StartMenu';
import { resetLocale } from './i18nTestUtils';
import {
  click,
  installAnimationFrames,
  last,
  type AnimationFrames,
  prepareMenuEnvironment,
  resetMenuEnvironment,
  settle,
  stubMatchMedia,
  useMenuFakeTimers,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 8（场景一层）：真正的 MenuHeroScene 对它的渲染器做了什么。
 *
 * jsdom 没有 WebGL：three 的 WebGLRenderer / PMREMGenerator 换成记账的替身，机体模型工厂
 * 换成一个盒子。看的是玩家设备上要紧的几件事——只要一个上下文、像素比封顶、减少动态效果时
 * 只画一帧不起渲染循环、释放时把上下文与画布都交还、之后不再画也不再排动画帧。
 * 控制器何时创建 / 释放它见 MenuHero.test.ts；本文件末尾再用真场景走一遍标题画面。
 */

interface FakeRenderer {
  domElement: HTMLCanvasElement;
  pixelRatios: number[];
  sizes: Array<[number, number]>;
  frames: Array<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera }>;
  disposed: number;
  contextLosses: number;
}

const gl = vi.hoisted(() => ({
  renderers: [] as unknown[],
  environments: [] as Array<{ disposed: boolean }>,
  failEnvironment: false,
}));

const jet = vi.hoisted(() => ({
  models: [] as unknown[],
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    public readonly domElement = document.createElement('canvas');
    public readonly shadowMap = { enabled: false };
    public toneMapping = 0;
    public toneMappingExposure = 1;
    public readonly pixelRatios: number[] = [];
    public readonly sizes: Array<[number, number]> = [];
    public readonly frames: Array<{ scene: unknown; camera: unknown }> = [];
    public disposed = 0;
    public contextLosses = 0;

    constructor() {
      gl.renderers.push(this);
    }
    public setClearColor(): void {}
    public setPixelRatio(ratio: number): void {
      this.pixelRatios.push(ratio);
    }
    public setSize(width: number, height: number): void {
      this.sizes.push([width, height]);
    }
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
      if (gl.failEnvironment) {
        throw new Error('float render targets are not supported');
      }
      const target = {
        disposed: false,
        texture: new actual.Texture(),
        dispose(): void {
          target.disposed = true;
        },
      };
      gl.environments.push(target);
      return target;
    }
    public dispose(): void {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer, PMREMGenerator: FakePMREMGenerator };
});

vi.mock('@/features/aircraft/AircraftMeshFactory', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  return {
    createPlayerMesh: () => {
      const group = new three.Group();
      group.add(new three.Mesh(new three.BoxGeometry(4, 1, 6), new three.MeshBasicMaterial()));
      jet.models.push(group);
      return group;
    },
    updateAircraftSignals: () => undefined,
    updatePlayerAfterburner: () => undefined,
  };
});

function renderers(): FakeRenderer[] {
  return gl.renderers as FakeRenderer[];
}

/** 还占着上下文的渲染器：既没 dispose、也没被强制丢弃上下文 */
function liveRenderers(): FakeRenderer[] {
  return renderers().filter((renderer) => renderer.disposed === 0 && renderer.contextLosses === 0);
}

function everyNumberIsFinite(root: THREE.Object3D): boolean {
  let finite = true;
  root.traverse((object) => {
    for (const value of [
      ...object.position.toArray(),
      ...object.quaternion.toArray(),
      ...object.scale.toArray(),
    ]) {
      if (!Number.isFinite(value)) {
        finite = false;
      }
    }
  });
  return finite;
}

function setDevicePixelRatio(value: number | undefined): void {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value });
}

describe('MenuHeroScene: what the hero does with its WebGL context (batch X5, spec 8)', () => {
  let host: HTMLElement;
  let frames: AnimationFrames;
  let scene: MenuHeroScene | null = null;
  let originalPixelRatio: number;
  let consoleError: ReturnType<typeof vi.spyOn>;

  function createScene(options: Partial<MenuHeroSceneOptions> = {}): MenuHeroScene {
    scene = new MenuHeroScene({
      host,
      maxPixelRatio: 2,
      reducedMotion: false,
      onContextLost: () => undefined,
      ...options,
    });
    return scene;
  }

  function sizeHost(width: number, height: number): void {
    Object.defineProperty(host, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => height });
  }

  beforeEach(() => {
    prepareMenuEnvironment();
    originalPixelRatio = window.devicePixelRatio;
    gl.renderers.length = 0;
    gl.environments.length = 0;
    gl.failEnvironment = false;
    jet.models.length = 0;
    frames = installAnimationFrames();
    host = document.createElement('div');
    document.body.appendChild(host);
    sizeHost(1024, 640);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    scene?.dispose();
    scene = null;
    setDevicePixelRatio(originalPixelRatio);
    resetMenuEnvironment();
  });

  describe('one context', () => {
    it('creates exactly one renderer and puts its canvas in the host', () => {
      const created = createScene();

      expect(renderers()).toHaveLength(1);
      expect(created.canvas).toBe(renderers()[0].domElement);
      expect(host.contains(created.canvas)).toBe(true);
      expect(host.querySelectorAll('canvas')).toHaveLength(1);
    });

    it('creates no further renderer however long it runs or however often it is resized', () => {
      const created = createScene();
      created.start();
      for (let i = 1; i <= 30; i++) {
        frames.run(i * 16);
        created.resize(800 + i, 600);
      }
      created.stop();
      created.start();

      expect(renderers()).toHaveLength(1);
      expect(host.querySelectorAll('canvas')).toHaveLength(1);
    });

    it('builds the hero from the same player model the game uses, once', () => {
      createScene();
      expect(jet.models).toHaveLength(1);
    });
  });

  describe('pixel ratio cap', () => {
    it.each([
      { device: 3, cap: 1.5, expected: 1.5 },
      { device: 2, cap: 1.5, expected: 1.5 },
      { device: 3, cap: 2, expected: 2 },
      { device: 1, cap: 1.5, expected: 1 },
      { device: 1.25, cap: 2, expected: 1.25 },
    ])(
      'a ×$device screen with a cap of $cap renders at ×$expected',
      ({ device, cap, expected }) => {
        setDevicePixelRatio(device);
        const created = createScene({ maxPixelRatio: cap });
        created.resize(1280, 720);
        created.resize(390, 844);

        const used = renderers()[0].pixelRatios;
        expect(used.length).toBeGreaterThan(0);
        expect(new Set(used)).toEqual(new Set([expected]));
      }
    );

    it.each([undefined, 0, Number.NaN])(
      'falls back to ×1 when the browser reports a pixel ratio of %s',
      (device) => {
        setDevicePixelRatio(device);
        createScene({ maxPixelRatio: 1.5 });
        expect(new Set(renderers()[0].pixelRatios)).toEqual(new Set([1]));
      }
    );

    it('never exceeds the cap when the pixel ratio changes later (window moved between screens)', () => {
      setDevicePixelRatio(1);
      const created = createScene({ maxPixelRatio: 1.5 });
      setDevicePixelRatio(3);
      created.resize(1600, 900);

      expect(Math.max(...renderers()[0].pixelRatios)).toBe(1.5);
      expect(last(renderers()[0].pixelRatios)).toBe(1.5);
    });
  });

  describe('sizing', () => {
    it('sizes the drawing buffer to the host', () => {
      sizeHost(820, 1180);
      createScene();
      expect(last(renderers()[0].sizes)).toEqual([820, 1180]);
    });

    it.each([
      [0, 600],
      [800, 0],
      [0, 0],
      [-10, 400],
      [Number.NaN, 400],
    ])('ignores a %s × %s host instead of producing a broken projection', (width, height) => {
      const created = createScene();
      created.start();
      frames.run(16);
      const before = renderers()[0].sizes.length;

      created.resize(width, height);
      frames.run(32);

      const renderer = renderers()[0];
      expect(renderer.sizes).toHaveLength(before);
      const camera = last(renderer.frames)?.camera as THREE.PerspectiveCamera;
      expect(camera.projectionMatrix.elements.every((value) => Number.isFinite(value))).toBe(true);
    });

    it('a host with no layout yet (0 × 0) still constructs, and frames once it has a size', () => {
      sizeHost(0, 0);
      const created = createScene();
      expect(renderers()[0].sizes).toHaveLength(0);

      created.resize(640, 360);
      created.renderStill();

      expect(last(renderers()[0].sizes)).toEqual([640, 360]);
      expect(renderers()[0].frames).toHaveLength(1);
    });

    it('redraws a paused scene after a resize, so a still frame is never left stretched', () => {
      const created = createScene({ reducedMotion: true });
      created.start();
      const drawn = renderers()[0].frames.length;

      created.resize(700, 500);

      expect(renderers()[0].frames.length).toBe(drawn + 1);
      expect(frames.requested()).toBe(0);
    });
  });

  describe('animation loop', () => {
    it('draws nothing by itself until it is started', () => {
      createScene();
      expect(renderers()[0].frames).toHaveLength(0);
      expect(frames.requested()).toBe(0);
    });

    it('start() draws one frame per animation frame and reports that it is running', () => {
      const created = createScene();
      created.start();
      expect(created.isRunning()).toBe(true);
      expect(frames.pending()).toBe(1);

      for (let i = 1; i <= 5; i++) {
        frames.run(i * 16);
      }

      expect(renderers()[0].frames).toHaveLength(5);
      expect(frames.pending(), 'exactly one frame queued at a time').toBe(1);
    });

    it('start() twice does not run two loops', () => {
      const created = createScene();
      created.start();
      created.start();
      expect(frames.pending()).toBe(1);

      frames.run(16);
      expect(renderers()[0].frames).toHaveLength(1);
      expect(frames.pending()).toBe(1);
    });

    it('stop() cancels the queued frame and nothing more is drawn', () => {
      const created = createScene();
      created.start();
      frames.run(16);
      const drawn = renderers()[0].frames.length;

      created.stop();

      expect(created.isRunning()).toBe(false);
      expect(frames.pending()).toBe(0);
      frames.run(32);
      expect(renderers()[0].frames).toHaveLength(drawn);
    });

    it('a frame callback that fires after stop() draws nothing and queues nothing', () => {
      const created = createScene();
      const callbacks: FrameRequestCallback[] = [];
      // 一个取消不掉的宿主：回调照样会来
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
      created.start();
      created.stop();

      callbacks.forEach((callback) => callback(16));

      expect(renderers()[0].frames).toHaveLength(0);
      expect(callbacks).toHaveLength(1);
    });

    it('stop() then start() resumes with a single loop', () => {
      const created = createScene();
      for (let i = 0; i < 5; i++) {
        created.start();
        created.stop();
      }
      created.start();
      expect(frames.pending()).toBe(1);
      frames.run(16);
      expect(renderers()[0].frames).toHaveLength(1);
    });

    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['a time in the past', -5_000],
      ['a ten-minute gap (tab was in the background)', 600_000],
    ])('keeps every position finite when a frame arrives with %s', (_name, now) => {
      const created = createScene();
      created.start();
      frames.run(16);
      frames.run(now);
      frames.run(now + 16);
      frames.run(48);

      const finalFrame = last(renderers()[0].frames);
      expect(finalFrame).toBeDefined();
      expect(everyNumberIsFinite(finalFrame?.scene as THREE.Scene)).toBe(true);
      expect(everyNumberIsFinite(finalFrame?.camera as THREE.PerspectiveCamera)).toBe(true);
    });

    it('the launch fly-out moves the aircraft away and stays finite', () => {
      const created = createScene();
      created.start();
      frames.run(16);
      const flight = jet.models[0] as THREE.Group;
      const positionBefore = flight.getWorldPosition(new THREE.Vector3());

      created.launch();
      created.launch();
      let now = performance.now();
      for (let i = 0; i < 40; i++) {
        now += 16;
        frames.run(now);
      }

      const positionAfter = flight.getWorldPosition(new THREE.Vector3());
      expect(positionAfter.distanceTo(positionBefore)).toBeGreaterThan(1);
      expect(everyNumberIsFinite(last(renderers()[0].frames)?.scene as THREE.Scene)).toBe(true);
    });

    it('pointer input never produces a non-finite camera', () => {
      const created = createScene();
      created.start();
      for (const [x, y] of [
        [Number.NaN, 0],
        [0, Number.POSITIVE_INFINITY],
        [Number.NEGATIVE_INFINITY, Number.NaN],
        [1, -1],
      ]) {
        created.setPointer(x, y);
        frames.run(performance.now() + 16);
        frames.run(performance.now() + 32);
      }
      expect(
        everyNumberIsFinite(last(renderers()[0].frames)?.camera as THREE.PerspectiveCamera)
      ).toBe(true);
    });
  });

  describe('prefers-reduced-motion: a still frame', () => {
    it('start() draws exactly one frame and requests no animation frames', () => {
      const created = createScene({ reducedMotion: true });
      created.start();

      expect(renderers()[0].frames).toHaveLength(1);
      expect(frames.requested()).toBe(0);
      expect(created.isRunning()).toBe(false);
    });

    it('stays still: repeated start() and launch() never start a loop', () => {
      const created = createScene({ reducedMotion: true });
      created.start();
      created.launch();
      created.start();
      created.setPointer(0.5, 0.5);

      expect(frames.requested()).toBe(0);
      expect(created.isRunning()).toBe(false);
    });

    it('the still frame is the same picture every time it is drawn', () => {
      const created = createScene({ reducedMotion: true });
      const flight = jet.models[0] as THREE.Group;
      created.renderStill();
      const first = flight.getWorldQuaternion(new THREE.Quaternion()).toArray();
      const firstPosition = flight.getWorldPosition(new THREE.Vector3()).toArray();

      created.launch();
      created.renderStill();
      created.renderStill();

      expect(flight.getWorldQuaternion(new THREE.Quaternion()).toArray()).toEqual(first);
      expect(flight.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(firstPosition);
    });
  });

  describe('release', () => {
    it('dispose() gives the context back and takes the canvas out of the document', () => {
      const created = createScene();
      created.start();
      frames.run(16);
      const renderer = renderers()[0];

      created.dispose();

      expect(renderer.disposed).toBe(1);
      expect(renderer.contextLosses, 'the context is dropped, not left for GC').toBe(1);
      expect(created.canvas.isConnected).toBe(false);
      expect(host.querySelectorAll('canvas')).toHaveLength(0);
      expect(liveRenderers()).toHaveLength(0);
    });

    it('dispose() cancels the animation loop', () => {
      const created = createScene();
      created.start();
      expect(frames.pending()).toBe(1);

      created.dispose();

      expect(frames.pending()).toBe(0);
      expect(created.isRunning()).toBe(false);
    });

    it('frees the model, the environment map and its own geometry', () => {
      const created = createScene();
      const model = jet.models[0] as THREE.Group;
      const mesh = model.children[0] as THREE.Mesh;
      const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
      const materialDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
      created.renderStill();
      const drawnScene = renderers()[0].frames[0].scene;
      expect(drawnScene.children.length).toBeGreaterThan(0);
      expect(gl.environments).toHaveLength(1);

      created.dispose();

      expect(geometryDispose).toHaveBeenCalled();
      expect(materialDispose).toHaveBeenCalled();
      expect(gl.environments[0].disposed).toBe(true);
      expect(drawnScene.children, 'the scene graph is emptied').toHaveLength(0);
      expect(drawnScene.environment).toBeNull();
    });

    it('is dead afterwards: no draw, no animation frame, no resize', () => {
      const created = createScene();
      created.dispose();
      const renderer = renderers()[0];
      const drawn = renderer.frames.length;
      const sized = renderer.sizes.length;
      const requested = frames.requested();

      created.start();
      created.renderStill();
      created.resize(500, 500);
      created.launch();
      created.setPointer(1, 1);

      expect(renderer.frames).toHaveLength(drawn);
      expect(renderer.sizes).toHaveLength(sized);
      expect(frames.requested()).toBe(requested);
      expect(created.isRunning()).toBe(false);
    });

    it('dispose() twice releases once', () => {
      const created = createScene();
      created.dispose();
      created.dispose();
      expect(renderers()[0].disposed).toBe(1);
      expect(renderers()[0].contextLosses).toBe(1);
    });

    it('creating and disposing in a loop leaves nothing behind', () => {
      for (let i = 0; i < 12; i++) {
        const created = createScene({ reducedMotion: i % 2 === 0 });
        created.start();
        frames.run(i * 16);
        created.dispose();
      }
      scene = null;

      expect(renderers()).toHaveLength(12);
      expect(liveRenderers()).toHaveLength(0);
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
      expect(frames.pending()).toBe(0);
      expect(gl.environments.every((environment) => environment.disposed)).toBe(true);
    });
  });

  describe('when the context goes wrong', () => {
    it('tells the controller when the context is lost, stops drawing, and claims the event', () => {
      const onContextLost = vi.fn();
      const created = createScene({ onContextLost });
      created.start();
      frames.run(16);

      const event = new Event('webglcontextlost', { cancelable: true });
      created.canvas.dispatchEvent(event);

      expect(onContextLost).toHaveBeenCalledTimes(1);
      expect(created.isRunning()).toBe(false);
      expect(frames.pending()).toBe(0);
      expect(event.defaultPrevented).toBe(true);
    });

    it('a context-lost event after dispose() is ignored', () => {
      const onContextLost = vi.fn();
      const created = createScene({ onContextLost });
      const canvas = created.canvas;
      created.dispose();

      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));

      expect(onContextLost).not.toHaveBeenCalled();
    });

    it('still builds a hero when the environment map cannot be generated', () => {
      gl.failEnvironment = true;
      const created = createScene();
      created.start();
      frames.run(16);

      expect(renderers()[0].frames).toHaveLength(1);
      expect(consoleError).not.toHaveBeenCalled();
      created.dispose();
      expect(liveRenderers()).toHaveLength(0);
    });

    it('releasing does not throw when the renderer itself throws on dispose', () => {
      const created = createScene();
      const renderer = renderers()[0] as FakeRenderer & {
        dispose: () => void;
        forceContextLoss: () => void;
      };
      renderer.dispose = () => {
        throw new Error('context already lost');
      };
      renderer.forceContextLoss = () => {
        throw new Error('extension unavailable');
      };

      expect(() => created.dispose()).not.toThrow();
      expect(created.canvas.isConnected, 'the canvas still leaves the page').toBe(false);
    });
  });
});

/**
 * 同一件事从玩家这头看：标题画面（StartMenu）带着真场景显示、隐藏、开局，
 * 任何时候最多一个渲染器活着，菜单不在屏幕上时一个都没有。
 */
describe('title screen with the real hero scene: WebGL contexts over time (batch X5, spec 8)', () => {
  let menu: StartMenu | null = null;
  let originalIsMobile: boolean;
  let originalPixelRatio: number;
  let frames: AnimationFrames;

  async function letHeroArrive(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(500);
      await settle();
    }
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalPixelRatio = window.devicePixelRatio;
    GameConfig.isMobile = false;
    prepareMenuEnvironment();
    useMenuFakeTimers();
    vi.stubGlobal('WebGLRenderingContext', class {});
    frames = installAnimationFrames();
    gl.renderers.length = 0;
    gl.environments.length = 0;
    gl.failEnvironment = false;
    jet.models.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    menu?.dispose();
    menu = null;
    await settle(2);
    GameConfig.isMobile = originalIsMobile;
    setDevicePixelRatio(originalPixelRatio);
    resetLocale();
    resetMenuEnvironment();
  });

  function sizeMenu(width: number, height: number): void {
    // jsdom 不做布局：给所有元素一个尺寸，主机的挂载点也在其中
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
  }

  it('holds one context while the menu shows and none after it hides, cycle after cycle', async () => {
    sizeMenu(1280, 720);
    menu = new StartMenu();
    let mostAlive = 0;

    for (let cycle = 0; cycle < 5; cycle++) {
      await letHeroArrive();
      mostAlive = Math.max(mostAlive, liveRenderers().length);
      expect(liveRenderers(), `showing, cycle ${cycle}`).toHaveLength(1);
      expect(document.querySelectorAll('#start-menu canvas')).toHaveLength(1);

      menu.hide();
      expect(liveRenderers(), `hidden, cycle ${cycle}`).toHaveLength(0);
      expect(document.querySelectorAll('#start-menu canvas')).toHaveLength(0);
      expect(frames.pending(), 'no animation frame left queued').toBe(0);
      menu.show();
    }

    expect(mostAlive).toBe(1);
    expect(renderers().length).toBe(5);
  });

  it('draws a first frame and keeps animating while the title shows', async () => {
    sizeMenu(1280, 720);
    menu = new StartMenu();
    await letHeroArrive();
    const renderer = renderers()[0];
    const drawn = renderer.frames.length;
    expect(drawn).toBeGreaterThan(0);

    frames.run(performance.now() + 16);
    frames.run(performance.now() + 32);

    expect(renderer.frames.length).toBe(drawn + 2);
  });

  it('has released the context by the time a started run is told the transition is over', async () => {
    sizeMenu(1280, 720);
    menu = new StartMenu();
    const startMenu = menu;
    let aliveWhenLaunched = -1;
    startMenu.setOnStart(() => {
      void startMenu.whenLaunched().then(() => {
        aliveWhenLaunched = liveRenderers().length;
      });
    });
    await letHeroArrive();
    expect(liveRenderers()).toHaveLength(1);

    click('start-btn');
    await vi.advanceTimersByTimeAsync(1500);

    expect(aliveWhenLaunched, 'the game renderer never coexists with the hero').toBe(0);
    expect(frames.pending()).toBe(0);
  });

  it('reduced motion: a still frame, no animation frames at all, released on hide', async () => {
    stubMatchMedia({ reducedMotion: true });
    sizeMenu(1024, 768);
    menu = new StartMenu();
    await letHeroArrive();

    expect(liveRenderers()).toHaveLength(1);
    expect(renderers()[0].frames.length).toBeGreaterThan(0);
    expect(frames.requested()).toBe(0);

    menu.hide();
    expect(liveRenderers()).toHaveLength(0);
    expect(frames.requested()).toBe(0);
  });

  it.each([
    { touch: true, device: 3, expected: 1.5 },
    { touch: true, device: 2, expected: 1.5 },
    { touch: true, device: 1, expected: 1 },
  ])(
    'touch device with a ×$device screen renders the hero at ×$expected',
    async ({ touch, device, expected }) => {
      GameConfig.isMobile = touch;
      setDevicePixelRatio(device);
      sizeMenu(820, 1180);
      menu = new StartMenu();
      await letHeroArrive();

      const used = renderers()[0].pixelRatios;
      expect(used.length).toBeGreaterThan(0);
      expect(Math.max(...used)).toBe(expected);
    }
  );

  it('desktop with a ×3 screen is capped too', async () => {
    setDevicePixelRatio(3);
    sizeMenu(1920, 1080);
    menu = new StartMenu();
    await letHeroArrive();

    const used = renderers()[0].pixelRatios;
    expect(used.length).toBeGreaterThan(0);
    expect(Math.max(...used)).toBeLessThan(3);
  });

  it('dispose() while the hero is animating leaves no context, canvas or frame behind', async () => {
    sizeMenu(1280, 720);
    menu = new StartMenu();
    await letHeroArrive();

    menu.dispose();
    menu = null;

    expect(liveRenderers()).toHaveLength(0);
    expect(document.querySelectorAll('canvas')).toHaveLength(0);
    expect(frames.pending()).toBe(0);
  });
});
