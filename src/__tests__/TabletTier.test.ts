import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig, type QualityPreset } from '@/config';
import { GameLoop } from '@/core/GameLoop';
import {
  ANDROID_PHONE_UA,
  ANDROID_TABLET_UA,
  IPAD_UA,
  LINUX_DESKTOP_UA,
  WINDOWS_DESKTOP_UA,
  restoreDevice,
  stubDevice,
  stubViewport,
  type DeviceSpec,
} from './deviceTestUtils';

/**
 * 平板档（GameConfig，批次 T；Android 平板性能批次改了判定）：
 * - 平板级设备：触控设备（'ontouchstart' in window / maxTouchPoints）且设备屏幕短边
 *   Math.min(screen.width, screen.height) ≥ 600 CSS px。按屏幕而不是视口判定：工具栏、旋转、
 *   全屏都不改变它（改动前是视口短边 ≥ 700）。这只决定运行档，触控布局仍按视口（见
 *   TabletClassLayoutScope.test.ts）；
 * - 平板级设备上所有画质档的模拟帧率都是 60，auto 画质的像素比上限是 1.5；
 * - 手机与桌面的取值与改动前（提交 6384e8f 之前的 src/config.ts）一致。
 * jsdom 的 screen 是 0×0：每个用例显式设定设备状态，结束后恢复。
 * 最后一组用真实的 GameLoop 跑一帧，确认目标帧率确实成了固定模拟步长。
 */

type Device = 'phone' | 'tablet' | 'desktop';
type ExplicitPreset = Exclude<QualityPreset, 'auto'>;

const PRESETS: readonly QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
const EXPLICIT_PRESETS: readonly ExplicitPreset[] = ['performance', 'balanced', 'quality'];

interface QualityValues {
  targetFPS: number;
  maxPixelRatio: number;
  particleCount: number;
  projectilePoolSize: number;
  shadowEnabled: boolean;
  antialiasEnabled: boolean;
}

/** 改动前的取值（git show 6384e8f^:src/config.ts 的 QUALITY_PRESETS） */
const BEFORE: Record<'phone' | 'desktop', Record<ExplicitPreset, QualityValues>> = {
  phone: {
    performance: {
      targetFPS: 30,
      maxPixelRatio: 1.2,
      particleCount: 12,
      projectilePoolSize: 80,
      shadowEnabled: false,
      antialiasEnabled: false,
    },
    balanced: {
      targetFPS: 30,
      maxPixelRatio: 1.5,
      particleCount: 20,
      projectilePoolSize: 100,
      shadowEnabled: false,
      antialiasEnabled: false,
    },
    quality: {
      targetFPS: 45,
      maxPixelRatio: 1.5,
      particleCount: 30,
      projectilePoolSize: 130,
      shadowEnabled: false,
      antialiasEnabled: true,
    },
  },
  desktop: {
    performance: {
      targetFPS: 45,
      maxPixelRatio: 1.5,
      particleCount: 35,
      projectilePoolSize: 160,
      shadowEnabled: false,
      antialiasEnabled: false,
    },
    balanced: {
      targetFPS: 60,
      maxPixelRatio: 2,
      particleCount: 50,
      projectilePoolSize: 200,
      shadowEnabled: true,
      antialiasEnabled: true,
    },
    quality: {
      targetFPS: 75,
      maxPixelRatio: 2,
      particleCount: 75,
      projectilePoolSize: 260,
      shadowEnabled: true,
      antialiasEnabled: true,
    },
  },
};

/** 改动前 auto 画质的解析结果：触控设备 → performance，桌面 → balanced */
const AUTO_RESOLVES_TO: Record<'phone' | 'desktop', ExplicitPreset> = {
  phone: 'performance',
  desktop: 'balanced',
};

function beforeValues(device: 'phone' | 'desktop', preset: QualityPreset): QualityValues {
  return BEFORE[device][preset === 'auto' ? AUTO_RESOLVES_TO[device] : preset];
}

/** 一块高分屏：像素比上限总是生效 */
const HIGH_DPR = 3;

describe('tablet tier (GameConfig)', () => {
  let originalIsMobile: boolean;
  let originalIsTablet: boolean;
  let originalPreset: QualityPreset;
  let originalOverride: ReturnType<typeof GameConfig.getRuntimeQualityOverride>;
  const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

  function stubWindow(name: string, value: number): void {
    if (!originalDescriptors.has(name)) {
      originalDescriptors.set(name, Object.getOwnPropertyDescriptor(window, name));
    }
    Object.defineProperty(window, name, { configurable: true, writable: true, value });
  }

  function setDevice(device: Device): void {
    GameConfig.isMobile = device !== 'desktop';
    GameConfig.isTablet = device === 'tablet';
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalIsTablet = GameConfig.isTablet;
    originalPreset = GameConfig.getQualityPreset();
    originalOverride = GameConfig.getRuntimeQualityOverride();
    GameConfig.clearRuntimeQualityOverride();
    stubWindow('devicePixelRatio', HIGH_DPR);
  });

  afterEach(() => {
    for (const [name, descriptor] of originalDescriptors) {
      if (descriptor) {
        Object.defineProperty(window, name, descriptor);
      } else {
        Reflect.deleteProperty(window, name);
      }
    }
    originalDescriptors.clear();
    GameConfig.isMobile = originalIsMobile;
    GameConfig.isTablet = originalIsTablet;
    GameConfig.setQualityPreset(originalPreset);
    GameConfig.setRuntimeQualityOverride(originalOverride);
    vi.resetModules();
  });

  describe('tablet-class detection (by the device screen)', () => {
    /** 设备启动时判定出的运行档：是否触屏、各画质档的模拟帧率、auto 画质的像素比 */
    interface RuntimeProfile {
      touch: boolean;
      simulationHz: Record<QualityPreset, number>;
      autoPixelRatio: number;
    }

    function simulationRates(
      rates: readonly [number, number, number, number]
    ): Record<QualityPreset, number> {
      const [auto, performance, balanced, quality] = rates;
      return { auto, performance, balanced, quality };
    }

    function tabletProfile(devicePixelRatio: number): RuntimeProfile {
      return {
        touch: true,
        simulationHz: simulationRates([60, 60, 60, 60]),
        autoPixelRatio: Math.min(devicePixelRatio, 1.5),
      };
    }

    function phoneProfile(devicePixelRatio: number): RuntimeProfile {
      return {
        touch: true,
        simulationHz: simulationRates([30, 30, 30, 45]),
        autoPixelRatio: Math.min(devicePixelRatio, 1.2),
      };
    }

    function desktopProfile(devicePixelRatio: number): RuntimeProfile {
      return {
        touch: false,
        simulationHz: simulationRates([60, 45, 60, 75]),
        autoPixelRatio: Math.min(devicePixelRatio, 2),
      };
    }

    /** 读一份 GameConfig 现在给出的运行档（不改它最后的画质：读完回到 auto） */
    function profileOf(config: typeof GameConfig): RuntimeProfile {
      const simulationHz = simulationRates([0, 0, 0, 0]);
      for (const preset of PRESETS) {
        config.setQualityPreset(preset);
        simulationHz[preset] = config.getTargetFPS();
      }
      config.setQualityPreset('auto');
      return { touch: config.isMobile, simulationHz, autoPixelRatio: config.getPixelRatio() };
    }

    /** 扮演设备后重新加载 src/config.ts，返回它启动时判定的 GameConfig */
    async function boot(device: DeviceSpec): Promise<typeof GameConfig> {
      stubDevice(device);
      vi.resetModules();
      return (await import('@/config')).GameConfig;
    }

    function device(
      userAgent: string,
      screen: readonly [number, number],
      viewport: readonly [number, number],
      touch: boolean,
      devicePixelRatio = HIGH_DPR
    ): DeviceSpec {
      return {
        userAgent,
        screen: { width: screen[0], height: screen[1] },
        viewport: { width: viewport[0], height: viewport[1] },
        touch,
        devicePixelRatio,
      };
    }

    afterEach(() => {
      restoreDevice();
    });

    it('is a boolean', () => {
      expect(typeof GameConfig.isTablet).toBe('boolean');
    });

    describe('an Android tablet with a 1280×800 screen is tablet-class at every viewport', () => {
      it.each([
        ['landscape, viewport filling the screen', 1280, 800],
        ['landscape under the browser toolbars', 1280, 650],
        ['landscape under the toolbars and the gesture bar', 1280, 620],
        ['portrait', 800, 1280],
        ['landscape, viewport 1138×712', 1138, 712],
      ])('%s (%i×%i)', async (_name, width, height) => {
        const config = await boot(device(ANDROID_TABLET_UA, [1280, 800], [width, height], true));
        expect(profileOf(config)).toEqual(tabletProfile(HIGH_DPR));
      });

      it('with the screen reported in portrait (800×1280) as well', async () => {
        const config = await boot(device(ANDROID_TABLET_UA, [800, 1280], [800, 1216], true));
        expect(profileOf(config)).toEqual(tabletProfile(HIGH_DPR));
      });
    });

    it('a 1200×800 screen at ×2.5 is tablet-class and capped at ×1.5', async () => {
      const config = await boot(device(ANDROID_TABLET_UA, [1200, 800], [1200, 680], true, 2.5));
      expect(profileOf(config)).toEqual(tabletProfile(2.5));
      expect(config.getPixelRatio()).toBe(1.5);
    });

    it('an Android tablet in desktop-site mode (Linux x86_64 UA, touch, 1280×800 screen) is tablet-class', async () => {
      const config = await boot(device(LINUX_DESKTOP_UA, [1280, 800], [1280, 686], true));
      expect(profileOf(config)).toEqual(tabletProfile(HIGH_DPR));
    });

    it.each([
      ['landscape', [960, 600], [960, 528]],
      ['portrait', [600, 960], [600, 888]],
    ] as const)(
      'a screen whose short side is exactly 600 is tablet-class (%s)',
      async (_name, screen, viewport) => {
        const config = await boot(device(ANDROID_TABLET_UA, screen, viewport, true));
        expect(profileOf(config)).toEqual(tabletProfile(HIGH_DPR));
      }
    );

    describe('every iPad stays tablet-class', () => {
      it.each([
        ['iPad Air 1180×820, landscape', [1180, 820], [1180, 820]],
        ['iPad Air 1180×820, portrait', [1180, 820], [820, 1180]],
        ['iPad mini 744×1133, portrait', [744, 1133], [744, 1133]],
        ['iPad mini 744×1133, landscape', [744, 1133], [1133, 744]],
        ['iPad Pro 12.9 1366×1024, landscape', [1366, 1024], [1366, 1024]],
      ] as const)('%s', async (_name, screen, viewport) => {
        const config = await boot(device(IPAD_UA, screen, viewport, true));
        expect(profileOf(config)).toEqual(tabletProfile(HIGH_DPR));
      });
    });

    describe('touch devices with a short screen side under 600 keep the phone profile', () => {
      it.each([
        ['portrait', 412, 915],
        ['portrait under the toolbars', 412, 839],
        ['landscape', 915, 412],
      ])('an Android phone with a 412×915 screen, %s (%i×%i)', async (_name, width, height) => {
        const config = await boot(device(ANDROID_PHONE_UA, [412, 915], [width, height], true));
        expect(profileOf(config)).toEqual(phoneProfile(HIGH_DPR));
      });

      it('a 412×915 screen with a wide (980 px) layout viewport is still a phone', async () => {
        const config = await boot(device(LINUX_DESKTOP_UA, [412, 915], [980, 1960], true));
        expect(profileOf(config)).toEqual(phoneProfile(HIGH_DPR));
      });

      it.each([
        ['landscape', [960, 599], [960, 527]],
        ['portrait', [599, 960], [599, 888]],
      ] as const)(
        'a screen whose short side is 599 is not tablet-class (%s)',
        async (_name, screen, viewport) => {
          const config = await boot(device(ANDROID_PHONE_UA, screen, viewport, true));
          expect(profileOf(config)).toEqual(phoneProfile(HIGH_DPR));
        }
      );
    });

    it.each([
      ['desktop 1920×1080', [1920, 1080]],
      ['desktop 1366×768', [1366, 768]],
      ['desktop 2560×1440', [2560, 1440]],
    ] as const)('%s without touch keeps the desktop profile', async (_name, size) => {
      const config = await boot(device(WINDOWS_DESKTOP_UA, size, size, false));
      expect(profileOf(config)).toEqual(desktopProfile(HIGH_DPR));
    });

    describe('decided once, from the screen: the viewport changing later does not move it', () => {
      it('a tablet stays tablet-class when the toolbars, rotation or fullscreen change the viewport', async () => {
        const config = await boot(device(ANDROID_TABLET_UA, [1280, 800], [1280, 800], true));
        for (const [width, height] of [
          [1280, 620],
          [800, 1280],
          [1280, 800],
        ]) {
          stubViewport(width, height);
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('orientationchange'));
          expect(profileOf(config), `viewport ${width}×${height}`).toEqual(tabletProfile(HIGH_DPR));
        }
      });

      it('a phone stays a phone when the viewport changes', async () => {
        const config = await boot(device(ANDROID_PHONE_UA, [412, 915], [915, 412], true));
        for (const [width, height] of [
          [412, 915],
          [915, 412],
        ]) {
          stubViewport(width, height);
          window.dispatchEvent(new Event('resize'));
          expect(profileOf(config), `viewport ${width}×${height}`).toEqual(phoneProfile(HIGH_DPR));
        }
      });
    });
  });

  describe('on a tablet', () => {
    beforeEach(() => {
      setDevice('tablet');
    });

    it.each(PRESETS)('the simulation rate is 60 with the %s preset', (preset) => {
      GameConfig.setQualityPreset(preset);
      expect(GameConfig.getTargetFPS()).toBe(60);
    });

    it.each(PRESETS)('getTargetFPSForPreset(%s) is 60 whichever preset is active', (preset) => {
      for (const active of PRESETS) {
        GameConfig.setQualityPreset(active);
        expect(GameConfig.getTargetFPSForPreset(preset), `active preset ${active}`).toBe(60);
      }
    });

    it('the simulation rate stays 60 when the runtime lowers the quality', () => {
      GameConfig.setQualityPreset('quality');
      for (const lowered of ['balanced', 'performance'] as const) {
        GameConfig.setRuntimeQualityOverride(lowered);
        expect(GameConfig.getRuntimeQualityOverride()).toBe(lowered);
        expect(GameConfig.getTargetFPS(), `lowered to ${lowered}`).toBe(60);
      }
    });

    it('the pixel-ratio cap is 1.5 with the auto preset', () => {
      GameConfig.setQualityPreset('auto');
      expect(GameConfig.getPixelRatio()).toBe(1.5);

      stubWindow('devicePixelRatio', 2);
      expect(GameConfig.getPixelRatio(), 'an iPad reports 2').toBe(1.5);
    });

    it('the cap is a cap: a lower device pixel ratio is used as it is', () => {
      GameConfig.setQualityPreset('auto');
      stubWindow('devicePixelRatio', 1);
      expect(GameConfig.getPixelRatio()).toBe(1);

      stubWindow('devicePixelRatio', 1.25);
      expect(GameConfig.getPixelRatio()).toBe(1.25);
    });

    it.each(EXPLICIT_PRESETS)(
      'an explicitly chosen %s preset keeps the touch pixel-ratio cap it had before',
      (preset) => {
        GameConfig.setQualityPreset(preset);
        expect(GameConfig.getPixelRatio()).toBe(BEFORE.phone[preset].maxPixelRatio);
      }
    );
  });

  describe.each(['phone', 'desktop'] as const)('on a %s the values are unchanged', (device) => {
    beforeEach(() => {
      setDevice(device);
    });

    it.each(PRESETS)('%s preset: simulation rate', (preset) => {
      GameConfig.setQualityPreset(preset);
      const expected = beforeValues(device, preset);
      expect(GameConfig.getTargetFPS()).toBe(expected.targetFPS);
      expect(GameConfig.getTargetFPSForPreset(preset)).toBe(expected.targetFPS);
    });

    it.each(PRESETS)('%s preset: pixel-ratio cap', (preset) => {
      GameConfig.setQualityPreset(preset);
      const expected = beforeValues(device, preset);
      expect(GameConfig.getPixelRatio()).toBe(expected.maxPixelRatio);

      stubWindow('devicePixelRatio', 1);
      expect(GameConfig.getPixelRatio()).toBe(1);
    });

    it.each(PRESETS)('%s preset: particles, projectile pool, shadows, antialiasing', (preset) => {
      GameConfig.setQualityPreset(preset);
      const expected = beforeValues(device, preset);
      expect(GameConfig.getParticleCount()).toBe(expected.particleCount);
      expect(GameConfig.getProjectilePoolSize()).toBe(expected.projectilePoolSize);
      expect(GameConfig.getShadowEnabled()).toBe(expected.shadowEnabled);
      expect(GameConfig.getAntialiasEnabled()).toBe(expected.antialiasEnabled);
    });

    it('getTargetFPSForPreset() answers for a preset other than the active one', () => {
      GameConfig.setQualityPreset('balanced');
      for (const preset of PRESETS) {
        expect(GameConfig.getTargetFPSForPreset(preset), preset).toBe(
          beforeValues(device, preset).targetFPS
        );
      }
    });

    it('the concurrent enemy cap is unchanged', () => {
      expect(GameConfig.getMaxEnemies()).toBe(device === 'desktop' ? 6 : 5);
    });
  });

  describe('fixed simulation step in the game loop', () => {
    /** 启动 GameLoop，喂一帧 40ms，收集它交给 update 的步长（秒） */
    function simulationSteps(): number[] {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
        frames.push(callback);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', (): void => undefined);
      vi.spyOn(performance, 'now').mockReturnValue(1000);

      const loop = new GameLoop();
      const steps: number[] = [];
      try {
        loop.start(
          (deltaTime) => steps.push(deltaTime),
          () => undefined
        );
        frames.shift()?.(1040);
      } finally {
        loop.stop();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
      return steps;
    }

    function expectStepRate(rate: number): void {
      const steps = simulationSteps();
      expect(steps.length, 'the loop simulated at least one step').toBeGreaterThan(0);
      for (const step of steps) {
        expect(step).toBeCloseTo(1 / rate, 9);
      }
    }

    it.each(PRESETS)('a tablet simulates in 1/60 s steps with the %s preset', (preset) => {
      setDevice('tablet');
      GameConfig.setQualityPreset(preset);
      expectStepRate(60);
    });

    it.each(PRESETS)('a phone keeps its step with the %s preset', (preset) => {
      setDevice('phone');
      GameConfig.setQualityPreset(preset);
      expectStepRate(beforeValues('phone', preset).targetFPS);
    });

    it.each(PRESETS)('a desktop keeps its step with the %s preset', (preset) => {
      setDevice('desktop');
      GameConfig.setQualityPreset(preset);
      expectStepRate(beforeValues('desktop', preset).targetFPS);
    });
  });

  it('a phone does not get the tablet simulation rate or pixel-ratio cap', () => {
    setDevice('phone');
    GameConfig.setQualityPreset('auto');
    expect(GameConfig.getTargetFPS()).toBe(30);
    expect(GameConfig.getPixelRatio()).toBe(1.2);
  });

  it('a device without touch never gets the tablet tier, even with isTablet left set', () => {
    // isTablet 留着 true、只把 isMobile 改成 false 的用例仍应得到桌面取值
    GameConfig.isMobile = false;
    GameConfig.isTablet = true;

    for (const preset of PRESETS) {
      GameConfig.setQualityPreset(preset);
      const expected = beforeValues('desktop', preset);
      expect(GameConfig.getTargetFPS(), `${preset} fps`).toBe(expected.targetFPS);
      expect(GameConfig.getTargetFPSForPreset(preset), `${preset} fps`).toBe(expected.targetFPS);
      expect(GameConfig.getPixelRatio(), `${preset} pixel ratio`).toBe(expected.maxPixelRatio);
    }
  });
});
