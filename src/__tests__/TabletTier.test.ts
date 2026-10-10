import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig, type QualityPreset } from '@/config';
import { GameLoop } from '@/core/GameLoop';

/**
 * 平板档（GameConfig，批次 T）：
 * - isTablet：触控设备且视口短边 ≥ 700 CSS px；
 * - 平板上所有画质档的模拟帧率都是 60，auto 画质的像素比上限是 1.5；
 * - 手机与桌面的取值与改动前（提交 6384e8f 之前的 src/config.ts）一致。
 * jsdom 默认是 1024×768 且带 ontouchstart，GameConfig.isTablet 默认为 true：
 * 每个用例显式设定设备状态，结束后恢复。
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

  function removeFromWindow(name: string): void {
    if (!originalDescriptors.has(name)) {
      originalDescriptors.set(name, Object.getOwnPropertyDescriptor(window, name));
    }
    Reflect.deleteProperty(window, name);
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

  describe('isTablet detection', () => {
    /** 按给定视口重新加载 src/config.ts，读它启动时的判定结果 */
    async function detect(
      width: number,
      height: number,
      touch: boolean
    ): Promise<{ isMobile: boolean; isTablet: boolean }> {
      stubWindow('innerWidth', width);
      stubWindow('innerHeight', height);
      if (!touch) {
        removeFromWindow('ontouchstart');
      }
      vi.resetModules();
      const fresh = await import('@/config');
      return { isMobile: fresh.GameConfig.isMobile, isTablet: fresh.GameConfig.isTablet };
    }

    it('is a boolean', () => {
      expect(typeof GameConfig.isTablet).toBe('boolean');
    });

    it.each([
      ['iPad landscape', 1024, 768],
      ['iPad portrait', 768, 1024],
      ['iPad mini portrait', 744, 1133],
      ['iPad Air landscape', 1180, 820],
      ['iPad Pro 12.9 landscape', 1366, 1024],
      ['short side exactly 700 (landscape)', 1100, 700],
      ['short side exactly 700 (portrait)', 700, 1100],
    ])('%s (%i×%i, touch) is a tablet', async (_name, width, height) => {
      expect(await detect(width, height, true)).toEqual({ isMobile: true, isTablet: true });
    });

    it.each([
      ['phone portrait', 390, 844],
      ['phone landscape', 844, 390],
      ['large phone portrait', 430, 932],
      ['large phone landscape', 932, 430],
      ['short side 699 (landscape)', 1100, 699],
      ['short side 699 (portrait)', 699, 1100],
    ])('%s (%i×%i, touch) is not a tablet', async (_name, width, height) => {
      expect(await detect(width, height, true)).toEqual({ isMobile: true, isTablet: false });
    });

    it.each([
      ['desktop 1920×1080', 1920, 1080],
      ['desktop 1366×768', 1366, 768],
      ['desktop 2560×1440', 2560, 1440],
    ])('%s without touch is not a tablet', async (_name, width, height) => {
      expect(await detect(width, height, false)).toEqual({ isMobile: false, isTablet: false });
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
    // jsdom 里 isTablet 默认为 true：只把 isMobile 改成 false 的用例仍应得到桌面取值
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
