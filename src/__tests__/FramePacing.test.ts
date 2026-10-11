import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameLoop } from '@/core/GameLoop';
import type { MenuHeroScene, MenuHeroSceneOptions } from '@/ui/menu/MenuHeroScene';
import {
  ANDROID_PHONE,
  ANDROID_TABLET,
  DESKTOP,
  restoreDevice,
  stubDevice,
  type DeviceSpec,
} from './deviceTestUtils';
import { FakeDisplay, gapsBetween, jitteredFrames, steadyFrames } from './fakeDisplay';
import {
  prepareMenuEnvironment,
  resetMenuEnvironment,
  settle,
  useMenuFakeTimers,
} from './menuTestUtils';

/**
 * 触屏设备的帧节奏（Android 平板性能批次，规格 2）：
 * 对局循环（GameLoop）与标题画面主机（MenuHeroScene）在触屏设备上每 n 个显示帧画一帧，
 * n = max(1, floor(刷新率 / 60 + 0.1))，刷新率由动画帧间隔测得：60 / 90 Hz 每帧都画，
 * 120 / 144 Hz 隔一帧画一帧且均匀；带抖动的 119.9 Hz 仍是隔一帧；刷新率在 120 与 60 Hz 之间
 * 切换时约 2 秒内跟上。被跳过的显示帧既不推进模拟也不渲染；模拟时间跟真实时间走——N 秒里
 * 模拟的总时长与 N 秒相差不超过一帧，任何刷新率都一样。没有触控的桌面在 144 Hz 下每帧都画。
 *
 * 显示器是假的（fakeDisplay.ts）：按给定时间戳逐个 vsync。设备由 deviceTestUtils 扮演，
 * 每个用例都重新加载模块（vi.resetModules），刷新率估计不会从上一个用例带过来。
 * 观察点：GameLoop.start 的 update（模拟步）/ render 回调；MenuHeroScene 的渲染器替身
 * （three 的 WebGLRenderer 换成记账的替身）记下的 render 调用，以及机体模型的世界位姿。
 */

/** 刷新率估计稳定下来的宽限：规格说约 2 秒内跟上，这里放到 2.5 秒 */
const SETTLE_MS = 2_500;

interface FakeRenderer {
  frames: unknown[];
  disposed: number;
}

const gl = vi.hoisted(() => ({
  renderers: [] as unknown[],
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
    public readonly frames: unknown[] = [];
    public disposed = 0;

    constructor() {
      gl.renderers.push(this);
    }
    public setClearColor(): void {}
    public setPixelRatio(): void {}
    public setSize(): void {}
    public compile(): void {}
    public render(scene: unknown): void {
      this.frames.push(scene);
    }
    public dispose(): void {
      this.disposed++;
    }
    public forceContextLoss(): void {}
  }
  class FakePMREMGenerator {
    public fromScene(): { texture: unknown; dispose: () => void } {
      return { texture: new actual.Texture(), dispose: () => undefined };
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

function lastRenderer(): FakeRenderer {
  const renderer = gl.renderers[gl.renderers.length - 1] as FakeRenderer | undefined;
  expect(renderer, 'a renderer was created').toBeDefined();
  return renderer as FakeRenderer;
}

/** 间隔直方图（{ 间隔: 次数 }）：失败时一眼看出是哪种节奏 */
function histogram(values: readonly number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

/** 一个显示帧里发生了什么 */
interface DisplayFrame {
  at: number;
  renders: number;
  updates: number;
  /** 这一帧里模拟推进的总时长（秒） */
  simulated: number;
}

/** 渲染了的显示帧序号（at ≥ fromMs 的那一段里） */
function renderedIndices(frames: readonly DisplayFrame[], fromMs: number): number[] {
  const indices: number[] = [];
  frames.forEach((frame, index) => {
    if (frame.at >= fromMs && frame.renders > 0) {
      indices.push(index);
    }
  });
  return indices;
}

function framesFrom<T extends DisplayFrame>(frames: readonly T[], fromMs: number): T[] {
  return frames.filter((frame) => frame.at >= fromMs);
}

/** fromMs 起每个显示帧都恰好画一次 */
function expectEveryFrameRendered(frames: readonly DisplayFrame[], fromMs: number): void {
  const span = framesFrom(frames, fromMs);
  expect(span.length, 'display frames in the window').toBeGreaterThan(30);
  const missed = span.filter((frame) => frame.renders !== 1).map((frame) => frame.at);
  expect(missed, 'display frames that did not render exactly once').toEqual([]);
}

/** fromMs 起恰好每隔一个显示帧画一次，均匀，且每次只画一次 */
function expectEverySecondFrameRendered(frames: readonly DisplayFrame[], fromMs: number): void {
  const span = framesFrom(frames, fromMs);
  expect(span.length, 'display frames in the window').toBeGreaterThan(60);
  const indices = renderedIndices(frames, fromMs);
  expect(indices.length, 'rendered display frames in the window').toBeGreaterThan(30);
  expect(histogram(gapsBetween(indices)), 'gaps between rendered display frames').toEqual({
    2: indices.length - 1,
  });
  const doubled = span.filter((frame) => frame.renders > 1).map((frame) => frame.at);
  expect(doubled, 'display frames that rendered more than once').toEqual([]);
}

// ───────────────────────────── 对局循环 ─────────────────────────────

describe('game loop frame pacing (Android tablet batch, spec 2)', () => {
  let display: FakeDisplay;

  interface LoopRuntime {
    loop: GameLoop;
    /** 当前的固定模拟步长（秒） */
    step: number;
  }

  /** 扮演设备后重新加载 config 与 GameLoop（auto 画质） */
  async function loadLoop(device: DeviceSpec): Promise<LoopRuntime> {
    stubDevice(device);
    vi.resetModules();
    const { GameConfig } = await import('@/config');
    const { GameLoop: FreshGameLoop } = await import('@/core/GameLoop');
    GameConfig.setQualityPreset('auto');
    return { loop: new FreshGameLoop(), step: 1 / GameConfig.getTargetFPS() };
  }

  /** 一次运行：每个 vsync 记下渲染次数、模拟步数与模拟时长 */
  class LoopRun {
    public readonly frames: DisplayFrame[] = [];
    public readonly startedAt: number;
    private renders = 0;
    private updates = 0;
    private simulated = 0;

    constructor(private readonly runtime: LoopRuntime) {
      this.startedAt = display.now;
      runtime.loop.start(
        (deltaTime) => {
          this.updates++;
          this.simulated += deltaTime;
        },
        () => {
          this.renders++;
        }
      );
    }

    public play(timestamps: readonly number[]): void {
      for (const at of timestamps) {
        display.vsync(at);
        this.frames.push({
          at,
          renders: this.renders,
          updates: this.updates,
          simulated: this.simulated,
        });
        this.renders = 0;
        this.updates = 0;
        this.simulated = 0;
      }
    }

    public lastAt(): number {
      return this.frames.length > 0 ? this.frames[this.frames.length - 1].at : this.startedAt;
    }

    public stop(): void {
      this.runtime.loop.stop();
    }
  }

  async function startLoop(device: DeviceSpec): Promise<LoopRun> {
    return new LoopRun(await loadLoop(device));
  }

  function expectSimulatedTimeFollowsRealTime(run: LoopRun, step: number): void {
    const elapsed = (run.lastAt() - run.startedAt) / 1000;
    const simulated = run.frames.reduce((total, frame) => total + frame.simulated, 0);
    // 一帧：不足一个模拟步的余量，加上最后一个渲染帧之后被跳过的显示帧
    expect(Math.abs(simulated - elapsed), `simulated ${simulated}s over ${elapsed}s`).toBeLessThan(
      step + 1 / 60
    );
  }

  beforeEach(() => {
    display = new FakeDisplay().install();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreDevice();
    vi.resetModules();
  });

  const TOUCH_DEVICES = [
    ['tablet', ANDROID_TABLET],
    ['phone', ANDROID_PHONE],
  ] as const;

  describe.each(TOUCH_DEVICES)('on a touch %s', (_name, device) => {
    it.each([60, 90])('at %i Hz renders every display frame, from the first', async (hz) => {
      const run = await startLoop(device);
      run.play(steadyFrames(hz, 5, display.now));
      run.stop();

      expectEveryFrameRendered(run.frames, Number.NEGATIVE_INFINITY);
    });

    it.each([120, 144])('at %i Hz renders every second display frame, evenly', async (hz) => {
      const run = await startLoop(device);
      run.play(steadyFrames(hz, 6, display.now));
      run.stop();

      expectEverySecondFrameRendered(run.frames, run.startedAt + SETTLE_MS);
    });

    it('with jittery 119.9 Hz timestamps (±1 ms) still renders every second frame', async () => {
      const run = await startLoop(device);
      run.play(jitteredFrames(119.9, 6, display.now, 1));
      run.stop();

      expectEverySecondFrameRendered(run.frames, run.startedAt + SETTLE_MS);
    });

    it.each([120, 144])(
      'at %i Hz a skipped display frame runs no simulation step and no render',
      async (hz) => {
        const run = await startLoop(device);
        run.play(steadyFrames(hz, 6, display.now));
        run.stop();

        const skipped = framesFrom(run.frames, run.startedAt + SETTLE_MS).filter(
          (frame) => frame.renders === 0
        );
        expect(skipped.length, 'display frames that were skipped').toBeGreaterThan(100);
        const stepped = skipped.filter((frame) => frame.updates > 0).map((frame) => frame.at);
        expect(stepped, 'skipped display frames that still simulated').toEqual([]);
      }
    );

    it.each([
      ['60 Hz', (from: number) => steadyFrames(60, 7, from)],
      ['90 Hz', (from: number) => steadyFrames(90, 7, from)],
      ['120 Hz', (from: number) => steadyFrames(120, 7, from)],
      ['144 Hz', (from: number) => steadyFrames(144, 7, from)],
      ['jittery 119.9 Hz', (from: number) => jitteredFrames(119.9, 7, from, 1)],
    ] as const)(
      'at %s the simulated time equals the real elapsed time within one frame',
      async (_rate, timeline) => {
        const runtime = await loadLoop(device);
        const run = new LoopRun(runtime);
        run.play(timeline(display.now));
        run.stop();

        expectSimulatedTimeFollowsRealTime(run, runtime.step);
      }
    );
  });

  describe('when the refresh rate changes (touch tablet)', () => {
    it('goes back to every frame within about 2 s after 120 Hz drops to 60 Hz', async () => {
      const run = await startLoop(ANDROID_TABLET);
      run.play(steadyFrames(120, 5, display.now));
      expectEverySecondFrameRendered(run.frames, run.startedAt + SETTLE_MS);

      const switchedAt = display.now;
      run.play(steadyFrames(60, 5, switchedAt));
      run.stop();

      expectEveryFrameRendered(run.frames, switchedAt + SETTLE_MS);
    });

    it('settles on every second frame within about 2 s after 60 Hz rises to 120 Hz', async () => {
      const run = await startLoop(ANDROID_TABLET);
      run.play(steadyFrames(60, 4, display.now));
      expectEveryFrameRendered(run.frames, Number.NEGATIVE_INFINITY);

      const switchedAt = display.now;
      run.play(steadyFrames(120, 5, switchedAt));
      run.stop();

      expectEverySecondFrameRendered(run.frames, switchedAt + SETTLE_MS);
    });

    it('keeps simulated time on real time across the switch', async () => {
      const runtime = await loadLoop(ANDROID_TABLET);
      const run = new LoopRun(runtime);
      run.play(steadyFrames(120, 4, display.now));
      run.play(steadyFrames(60, 4, display.now));
      run.play(steadyFrames(120, 4, display.now));
      run.stop();

      expectSimulatedTimeFollowsRealTime(run, runtime.step);
    });
  });

  describe('on a desktop without touch', () => {
    it('renders every display frame at 144 Hz', async () => {
      const run = await startLoop(DESKTOP);
      run.play(steadyFrames(144, 5, display.now));
      run.stop();

      expectEveryFrameRendered(run.frames, Number.NEGATIVE_INFINITY);
    });

    it('keeps simulated time on real time at 144 Hz', async () => {
      const runtime = await loadLoop(DESKTOP);
      const run = new LoopRun(runtime);
      run.play(steadyFrames(144, 7, display.now));
      run.stop();

      expectSimulatedTimeFollowsRealTime(run, runtime.step);
    });
  });
});

// ───────────────────────────── 标题画面主机 ─────────────────────────────

/**
 * 场景怎么知道自己在触屏设备上：设备替身（UA / 触控）让重新加载的 GameConfig.isMobile 判成
 * 触屏；另外按 MenuHero 的 MenuHeroOptions.touchDevice 的叫法递一个同名选项（猜测：场景的
 * 选项里若新增了触屏开关，大概也叫这个名字）。名字只在这一处。
 */
function heroTouchOption(touch: boolean): Record<string, unknown> {
  return { touchDevice: touch };
}

describe('menu hero frame pacing (Android tablet batch, spec 2)', () => {
  let display: FakeDisplay;
  let host: HTMLElement;
  const scenes: MenuHeroScene[] = [];

  interface HeroFrame extends DisplayFrame {
    /** 这一帧前后机体的世界位姿变了没有（变了 = 场景推进了一步） */
    moved: boolean;
  }

  interface HeroRig {
    scene: MenuHeroScene;
    renderer: FakeRenderer;
    model: THREE.Group;
  }

  async function loadHero(device: DeviceSpec): Promise<HeroRig> {
    stubDevice(device);
    vi.resetModules();
    const { MenuHeroScene: FreshScene } = await import('@/ui/menu/MenuHeroScene');
    const options: MenuHeroSceneOptions = Object.assign(
      {
        host,
        maxPixelRatio: 2,
        reducedMotion: false,
        onContextLost: (): void => undefined,
      },
      heroTouchOption(device.touch)
    );
    const scene = new FreshScene(options);
    scenes.push(scene);
    return {
      scene,
      renderer: lastRenderer(),
      model: jet.models[jet.models.length - 1] as THREE.Group,
    };
  }

  function pose(model: THREE.Group): number[] {
    model.updateWorldMatrix(true, false);
    return [...model.matrixWorld.elements];
  }

  function play(rig: HeroRig, timestamps: readonly number[], into: HeroFrame[]): void {
    for (const at of timestamps) {
      const drawn = rig.renderer.frames.length;
      const before = pose(rig.model);
      display.vsync(at);
      const after = pose(rig.model);
      into.push({
        at,
        renders: rig.renderer.frames.length - drawn,
        updates: 0,
        simulated: 0,
        moved: after.some((value, index) => value !== before[index]),
      });
    }
  }

  async function startHero(device: DeviceSpec): Promise<{ rig: HeroRig; startedAt: number }> {
    const rig = await loadHero(device);
    const startedAt = display.now;
    rig.scene.start();
    return { rig, startedAt };
  }

  /** 机体的世界位置与朝向（场景时间的解析函数） */
  function worldPose(model: THREE.Group): { position: number[]; quaternion: number[] } {
    model.updateWorldMatrix(true, false);
    const elements = model.matrixWorld.elements;
    const position = [elements[12], elements[13], elements[14]];
    const quaternion = model.getWorldQuaternion(model.quaternion.clone()).toArray();
    return { position, quaternion };
  }

  function distance(a: readonly number[], b: readonly number[]): number {
    return Math.hypot(...a.map((value, index) => value - b[index]));
  }

  /** 两个单位四元数之间的转角（弧度） */
  function angleBetween(a: readonly number[], b: readonly number[]): number {
    const dot = Math.abs(a.reduce((total, value, index) => total + value * b[index], 0));
    return 2 * Math.acos(Math.min(1, dot));
  }

  beforeEach(() => {
    gl.renderers.length = 0;
    jet.models.length = 0;
    display = new FakeDisplay().install();
    host = document.createElement('div');
    document.body.appendChild(host);
    Object.defineProperty(host, 'clientWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => 800 });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const scene of scenes.splice(0)) {
      scene.dispose();
    }
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreDevice();
    vi.resetModules();
  });

  describe('on a touch tablet', () => {
    it.each([60, 90])('at %i Hz draws every display frame, from the first', async (hz) => {
      const { rig } = await startHero(ANDROID_TABLET);
      const frames: HeroFrame[] = [];
      play(rig, steadyFrames(hz, 5, display.now), frames);

      expectEveryFrameRendered(frames, Number.NEGATIVE_INFINITY);
    });

    it.each([120, 144])('at %i Hz draws every second display frame, evenly', async (hz) => {
      const { rig, startedAt } = await startHero(ANDROID_TABLET);
      const frames: HeroFrame[] = [];
      play(rig, steadyFrames(hz, 6, display.now), frames);

      expectEverySecondFrameRendered(frames, startedAt + SETTLE_MS);
    });

    it('with jittery 119.9 Hz timestamps (±1 ms) still draws every second frame', async () => {
      const { rig, startedAt } = await startHero(ANDROID_TABLET);
      const frames: HeroFrame[] = [];
      play(rig, jitteredFrames(119.9, 6, display.now, 1), frames);

      expectEverySecondFrameRendered(frames, startedAt + SETTLE_MS);
    });

    it('goes back to every frame within about 2 s after 120 Hz drops to 60 Hz', async () => {
      const { rig, startedAt } = await startHero(ANDROID_TABLET);
      const frames: HeroFrame[] = [];
      play(rig, steadyFrames(120, 5, display.now), frames);
      expectEverySecondFrameRendered(frames, startedAt + SETTLE_MS);

      const switchedAt = display.now;
      play(rig, steadyFrames(60, 5, switchedAt), frames);

      expectEveryFrameRendered(frames, switchedAt + SETTLE_MS);
    });

    it('a skipped display frame does not advance the scene', async () => {
      const { rig, startedAt } = await startHero(ANDROID_TABLET);
      const frames: HeroFrame[] = [];
      play(rig, steadyFrames(120, 6, display.now), frames);

      const settled = framesFrom(frames, startedAt + SETTLE_MS);
      const skipped = settled.filter((frame) => frame.renders === 0);
      expect(skipped.length, 'display frames that were skipped').toBeGreaterThan(100);
      expect(
        skipped.filter((frame) => frame.moved).map((frame) => frame.at),
        'skipped display frames that moved the aircraft'
      ).toEqual([]);
      const drawn = settled.filter((frame) => frame.renders > 0);
      expect(
        drawn.filter((frame) => frame.moved).length,
        'drawn frames move the aircraft'
      ).toBeGreaterThan(drawn.length * 0.9);
    });

    it('the scene clock follows real time at 120 Hz: same pose as a 60 Hz desktop after 4 s', async () => {
      // 参照：桌面 60 Hz，每帧都画，场景时间就是真实时间
      const reference = await startHero(DESKTOP);
      const referenceFrames: HeroFrame[] = [];
      play(reference.rig, steadyFrames(60, 2, display.now), referenceFrames);
      const halfway = worldPose(reference.rig.model);
      play(reference.rig, steadyFrames(60, 2, display.now), referenceFrames);
      const expected = worldPose(reference.rig.model);
      reference.rig.scene.dispose();

      const { rig } = await startHero(ANDROID_TABLET);
      const frames: HeroFrame[] = [];
      play(rig, steadyFrames(120, 4, display.now), frames);
      const actual = worldPose(rig.model);

      const POSITION_TOLERANCE = 0.012;
      const ANGLE_TOLERANCE = 0.005;
      // 这个比较分得清：只走了一半时间的位姿差得远
      expect(distance(halfway.position, expected.position)).toBeGreaterThan(5 * POSITION_TOLERANCE);
      expect(distance(actual.position, expected.position)).toBeLessThan(POSITION_TOLERANCE);
      expect(angleBetween(actual.quaternion, expected.quaternion)).toBeLessThan(ANGLE_TOLERANCE);
    });
  });

  describe('on a desktop without touch', () => {
    it('draws every display frame at 144 Hz', async () => {
      const { rig } = await startHero(DESKTOP);
      const frames: HeroFrame[] = [];
      play(rig, steadyFrames(144, 5, display.now), frames);

      expectEveryFrameRendered(frames, Number.NEGATIVE_INFINITY);
    });
  });

  /**
   * 同一件事从玩家这头看：真的标题画面（StartMenu → MenuHero → MenuHeroScene），不递任何
   * 选项，只扮演设备。触屏平板 120 Hz 隔一帧画一帧；桌面 144 Hz 每帧都画。
   */
  describe('through the real title screen', () => {
    async function showTitle(device: DeviceSpec): Promise<{ renderer: FakeRenderer; at: number }> {
      prepareMenuEnvironment();
      useMenuFakeTimers();
      vi.stubGlobal('WebGLRenderingContext', class {});
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
      stubDevice(device);
      vi.resetModules();
      const { StartMenu } = await import('@/ui/StartMenu');
      const menu = new StartMenu();
      cleanups.push(() => menu.dispose());
      // 主机按需加载（重新加载的模块要花真实时间）：推进假时钟，直到它画了首帧、排上了动画帧
      const animating = (): boolean =>
        gl.renderers.length > 0 && lastRenderer().frames.length > 0 && display.pending() > 0;
      for (let i = 0; i < 50 && !animating(); i++) {
        await vi.advanceTimersByTimeAsync(200);
        await vi.dynamicImportSettled();
        await settle();
      }
      expect(animating(), 'the hero drew its first frame and is animating').toBe(true);
      return { renderer: lastRenderer(), at: display.now };
    }

    const cleanups: Array<() => void> = [];

    afterEach(async () => {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
      await settle(2);
      resetMenuEnvironment();
    });

    it('a touch tablet at 120 Hz draws the hero every second display frame', async () => {
      const { renderer, at } = await showTitle(ANDROID_TABLET);
      const frames: DisplayFrame[] = [];
      for (const timestamp of steadyFrames(120, 6, at)) {
        const drawn = renderer.frames.length;
        display.vsync(timestamp);
        frames.push({
          at: timestamp,
          renders: renderer.frames.length - drawn,
          updates: 0,
          simulated: 0,
        });
      }

      expectEverySecondFrameRendered(frames, at + SETTLE_MS);
    });

    it('a desktop at 144 Hz draws the hero every display frame', async () => {
      const { renderer, at } = await showTitle(DESKTOP);
      const frames: DisplayFrame[] = [];
      for (const timestamp of steadyFrames(144, 5, at)) {
        const drawn = renderer.frames.length;
        display.vsync(timestamp);
        frames.push({
          at: timestamp,
          renders: renderer.frames.length - drawn,
          updates: 0,
          simulated: 0,
        });
      }

      expectEveryFrameRendered(frames, Number.NEGATIVE_INFINITY);
    });
  });
});
