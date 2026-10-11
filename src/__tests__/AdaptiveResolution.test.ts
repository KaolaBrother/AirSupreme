import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameConfig as GameConfigClass, QualityPreset } from '@/config';
import type { GameLoop } from '@/core/GameLoop';
import {
  ANDROID_PHONE,
  ANDROID_TABLET,
  DESKTOP,
  restoreDevice,
  stubDevice,
  type DeviceSpec,
} from './deviceTestUtils';
import { FakeDisplay, steadyFrames } from './fakeDisplay';

/**
 * 触屏设备的自适应分辨率（Android 平板性能批次，规格 3）：
 * - 只在画质为 auto、且已经在 performance 档时生效（触屏的 auto 就是 performance 档）；
 * - 渲染帧率持续低于现有自动降档的门槛（同一个 0.82 × 60 的量、同一套计时）时，像素比一次降一档：
 *   平板级 1.5 → 1.25 → 1.0，手机 1.2 → 1.0，绝不低于 1.0；
 * - 余量持续够久（与现有恢复同一个 RECOVERY_TIME_MS）后升回一档，绝不超过设备上限；
 * - 帧节奏骗不了它：120 Hz 屏上每两帧画一帧的 60 fps 是满速，不降；
 * - 显式选的 performance / balanced / quality 不会被自动改像素比。
 *
 * 驱动：假显示器（fakeDisplay.ts）按给定帧率逐帧 vsync，GameLoop 照常运行。
 * 每个用例扮演设备（deviceTestUtils）后重新加载 config 与 GameLoop，状态不跨用例。
 * 渲染器真的跟着变（经画质路径）见 AdaptiveResolutionRenderer.test.ts。
 */

/** 高分屏：各档像素比上限总是生效 */
const HIGH_DPR = 3;

/** 现有自动降档的检查间隔与恢复时长（src/core/GameLoop.ts） */
const CHECK_INTERVAL_MS = 1_000;
const RECOVERY_TIME_MS = 4_000;

/** 触屏各显式画质档的像素比上限（与改动前相同，见 TabletTier.test.ts） */
const TOUCH_PRESET_CAPS = [1.5, 1.2];
/** 桌面 balanced / performance 档的像素比上限 */
const DESKTOP_PRESET_CAPS = [2, 1.5];

type ConfigClass = typeof GameConfigClass;

interface Runtime {
  config: ConfigClass;
  loop: GameLoop;
}

/**
 * 画质路径上的像素比：GameScene.applyQualitySettings 交给渲染器的就是这个值
 * （猜测：自适应的一档也反映在 GameConfig.getPixelRatio() 上）。只在这一处读。
 */
function pixelRatioOf(runtime: Runtime): number {
  return runtime.config.getPixelRatio();
}

interface RatioChange {
  /** 距开始的时间（毫秒） */
  at: number;
  ratio: number;
}

describe('adaptive resolution (Android tablet batch, spec 3)', () => {
  let display: FakeDisplay;

  /** 扮演设备，重新加载 config 与 GameLoop，按协调器的做法选定画质 */
  async function load(device: DeviceSpec, preset: QualityPreset): Promise<Runtime> {
    stubDevice({ ...device, devicePixelRatio: HIGH_DPR });
    vi.resetModules();
    const { GameConfig } = await import('@/config');
    const { GameLoop: FreshGameLoop } = await import('@/core/GameLoop');
    const loop = new FreshGameLoop();
    GameConfig.clearRuntimeQualityOverride();
    GameConfig.setQualityPreset(preset);
    loop.setQualityPreset(preset);
    return { config: GameConfig, loop };
  }

  /** 一次运行：每个 vsync 之后读像素比，记下每次变化 */
  class ResolutionRun {
    public readonly startedAt: number;
    public readonly changes: RatioChange[];
    public readonly samples: number[] = [];

    constructor(private readonly runtime: Runtime) {
      this.startedAt = display.now;
      const initial = pixelRatioOf(runtime);
      this.changes = [{ at: 0, ratio: initial }];
      this.samples.push(initial);
      runtime.loop.start(
        () => undefined,
        () => undefined
      );
    }

    public elapsed(): number {
      return display.now - this.startedAt;
    }

    public current(): number {
      return this.changes[this.changes.length - 1].ratio;
    }

    /** fps 帧率跑 seconds 秒；until 成立就提前停下，返回是否成立 */
    public play(fps: number, seconds: number, until?: () => boolean): boolean {
      for (const at of steadyFrames(fps, seconds, display.now)) {
        display.vsync(at);
        const ratio = pixelRatioOf(this.runtime);
        this.samples.push(ratio);
        if (ratio !== this.current()) {
          this.changes.push({ at: this.elapsed(), ratio });
        }
        if (until?.()) {
          return true;
        }
      }
      return until ? until() : false;
    }

    /** 从 fromMs 起的变化序列（含那一刻的值） */
    public sequenceFrom(fromMs: number): number[] {
      const before = this.changes.filter((change) => change.at <= fromMs);
      const after = this.changes.filter((change) => change.at > fromMs);
      return [before[before.length - 1].ratio, ...after.map((change) => change.ratio)];
    }

    public firstTimeAt(ratio: number, fromMs = 0): number | undefined {
      return this.changes.find((change) => change.at > fromMs && change.ratio === ratio)?.at;
    }

    public stop(): void {
      this.runtime.loop.stop();
    }
  }

  async function startRun(device: DeviceSpec, preset: QualityPreset): Promise<ResolutionRun> {
    return new ResolutionRun(await load(device, preset));
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

  describe('stepping down', () => {
    it('a tablet that stays below the threshold steps 1.5 → 1.25 → 1.0, one notch at a time', async () => {
      const run = await startRun(ANDROID_TABLET, 'auto');
      expect(run.current(), 'the tablet cap').toBe(1.5);

      run.play(40, 30);
      run.stop();

      expect(run.sequenceFrom(0)).toEqual([1.5, 1.25, 1]);
      expect(Math.min(...run.samples), 'never below 1.0').toBe(1);
    });

    it('a phone that stays below the threshold steps 1.2 → 1.0 and no further', async () => {
      const run = await startRun(ANDROID_PHONE, 'auto');
      expect(run.current(), 'the phone cap').toBe(1.2);

      run.play(20, 30);
      run.stop();

      expect(run.sequenceFrom(0)).toEqual([1.2, 1]);
      expect(Math.min(...run.samples), 'never below 1.0').toBe(1);
    });

    it('uses the existing auto-quality timers: nothing in the first check interval, a notch soon after', async () => {
      const run = await startRun(ANDROID_TABLET, 'auto');
      run.play(40, 10);
      run.stop();

      const firstNotch = run.firstTimeAt(1.25);
      const secondNotch = run.firstTimeAt(1);
      expect(firstNotch, 'stepped to 1.25').toBeDefined();
      expect(secondNotch, 'stepped to 1.0').toBeDefined();
      expect(firstNotch as number).toBeGreaterThanOrEqual(CHECK_INTERVAL_MS * 0.9);
      expect(firstNotch as number).toBeLessThanOrEqual(3 * CHECK_INTERVAL_MS);
      expect(secondNotch as number).toBeGreaterThan(firstNotch as number);
    });

    it('a tablet just above the threshold (52 fps > 0.82 × 60) keeps 1.5', async () => {
      const run = await startRun(ANDROID_TABLET, 'auto');
      run.play(52, 20);
      run.stop();

      expect(run.sequenceFrom(0)).toEqual([1.5]);
    });
  });

  describe('stepping back up', () => {
    it('a tablet climbs back 1.0 → 1.25 → 1.5 one notch per sustained headroom, never above 1.5', async () => {
      const run = await startRun(ANDROID_TABLET, 'auto');
      expect(
        run.play(40, 15, () => run.current() === 1),
        'reached 1.0 at 40 fps'
      ).toBe(true);

      const recoveryFrom = run.elapsed();
      run.play(60, 40);
      run.stop();

      expect(run.sequenceFrom(recoveryFrom)).toEqual([1, 1.25, 1.5]);
      const firstUp = run.firstTimeAt(1.25, recoveryFrom) as number;
      const secondUp = run.firstTimeAt(1.5, recoveryFrom) as number;
      expect(
        firstUp - recoveryFrom,
        'the first notch waits for sustained headroom'
      ).toBeGreaterThan(RECOVERY_TIME_MS - 500);
      expect(firstUp - recoveryFrom, 'the first notch comes back').toBeLessThan(12_000);
      expect(secondUp - firstUp, 'each notch waits for its own headroom').toBeGreaterThan(
        RECOVERY_TIME_MS - 500
      );
      expect(secondUp - recoveryFrom, 'the second notch comes back').toBeLessThan(24_000);
      expect(Math.max(...run.samples), 'never above the tablet cap').toBe(1.5);
    });

    it('a phone climbs back to 1.2 and no higher', async () => {
      const run = await startRun(ANDROID_PHONE, 'auto');
      expect(
        run.play(20, 15, () => run.current() === 1),
        'reached 1.0 at 20 fps'
      ).toBe(true);

      const recoveryFrom = run.elapsed();
      run.play(60, 30);
      run.stop();

      expect(run.sequenceFrom(recoveryFrom)).toEqual([1, 1.2]);
      expect(Math.max(...run.samples), 'never above the phone cap').toBe(1.2);
    });

    it('a short burst of headroom does not bring a notch back', async () => {
      const run = await startRun(ANDROID_TABLET, 'auto');
      expect(run.play(40, 15, () => run.current() === 1)).toBe(true);

      const recoveryFrom = run.elapsed();
      run.play(60, 3);
      run.play(40, 3);
      run.stop();

      expect(run.sequenceFrom(recoveryFrom)).toEqual([1]);
    });
  });

  describe('frame pacing does not fool it', () => {
    it.each([
      ['tablet', ANDROID_TABLET, 1.5],
      ['phone', ANDROID_PHONE, 1.2],
    ] as const)(
      'a %s rendering 60 fps on a 120 Hz panel is at full speed: no step-down',
      async (_name, device, cap) => {
        const run = await startRun(device, 'auto');
        run.play(120, 20);
        run.stop();

        expect(run.sequenceFrom(0)).toEqual([cap]);
      }
    );

    it.each([
      ['tablet', ANDROID_TABLET, 1.5],
      ['phone', ANDROID_PHONE, 1.2],
    ] as const)('a %s on a 144 Hz panel keeps its cap', async (_name, device, cap) => {
      const run = await startRun(device, 'auto');
      run.play(144, 20);
      run.stop();

      expect(run.sequenceFrom(0)).toEqual([cap]);
    });

    it('a tablet at a steady 60 fps keeps 1.5', async () => {
      const run = await startRun(ANDROID_TABLET, 'auto');
      run.play(60, 20);
      run.stop();

      expect(run.sequenceFrom(0)).toEqual([1.5]);
    });
  });

  describe('explicit presets never change the pixel ratio automatically', () => {
    describe.each([
      ['tablet', ANDROID_TABLET],
      ['phone', ANDROID_PHONE],
    ] as const)('on a %s', (_name, device) => {
      it('an explicit performance preset stays at 1.2 however slow it runs', async () => {
        const run = await startRun(device, 'performance');
        run.play(20, 30);
        run.stop();

        expect(run.sequenceFrom(0)).toEqual([1.2]);
      });

      it.each(['balanced', 'quality'] as const)(
        'an explicit %s preset never takes an adaptive notch below the preset caps',
        async (preset) => {
          const run = await startRun(device, preset);
          run.play(20, 30);
          run.stop();

          const unexpected = run.samples.filter((ratio) => !TOUCH_PRESET_CAPS.includes(ratio));
          expect(unexpected, 'pixel ratios that are not a preset cap').toEqual([]);
        }
      );
    });
  });

  describe('desktop without touch', () => {
    it('the auto preset never takes an adaptive notch below the desktop preset caps', async () => {
      const run = await startRun(DESKTOP, 'auto');
      run.play(20, 30);
      run.stop();

      const unexpected = run.samples.filter((ratio) => !DESKTOP_PRESET_CAPS.includes(ratio));
      expect(unexpected, 'pixel ratios that are not a desktop preset cap').toEqual([]);
    });
  });
});
