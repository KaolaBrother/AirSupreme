import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import type { GameLoop } from '@/core/GameLoop';
import type { GameScene } from '@/scenes/GameScene';
import { CampaignRig, callPrivate, installCampaignGlobals } from './campaignRig';
import { FakeDisplay, steadyFrames } from './fakeDisplay';

/**
 * 自适应分辨率（Android 平板性能批次，规格 3）的最后一段：渲染器的像素比真的变了，而且是经
 * 画质路径变的——一台真的 GameCoordinator（战役台架 campaignRig.ts）、真的 GameScene，
 * 只有 three 的 WebGLRenderer 换成记账的替身。协调器自己的 GameLoop 由假显示器逐帧驱动，
 * update / render 就是协调器自己的；像素比只从渲染器替身上读。
 *
 * 设备：触屏手机（GameConfig.isMobile = true，不是平板级），auto 画质，×3 高分屏：
 * 起点 1.2；20 fps 持续偏慢 → 1.0；回到 60 fps 并持续够久 → 回到 1.2。
 * 改动前的协调器只在画质档变化时重新应用画质，档位不变时渲染器停在 1.2。
 */

vi.setConfig({ testTimeout: 120_000 });

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  class FakeWebGLRenderer {
    readonly domElement = document.createElement('canvas');
    readonly capabilities = { isWebGL2: true };
    readonly extensions = {
      has: (): boolean => false,
      get: (): null => null,
    };
    readonly shadowMap = { enabled: false, needsUpdate: false, type: actual.PCFShadowMap };
    /** 每次 setPixelRatio 的参数，按调用顺序 */
    readonly pixelRatios: number[] = [];
    autoClear = true;
    toneMapping: number = actual.NoToneMapping;
    toneMappingExposure = 1;
    outputColorSpace: string = actual.SRGBColorSpace;
    private width = 1024;
    private height = 768;
    private pixelRatio = 1;
    private target: unknown = null;
    private readonly clearColor = new actual.Color(0, 0, 0);
    private clearAlpha = 1;

    setSize(width: number, height: number): void {
      this.width = width;
      this.height = height;
    }

    getSize(target: InstanceType<typeof actual.Vector2>): InstanceType<typeof actual.Vector2> {
      return target.set(this.width, this.height);
    }

    setPixelRatio(ratio: number): void {
      this.pixelRatio = ratio;
      this.pixelRatios.push(ratio);
    }

    getPixelRatio(): number {
      return this.pixelRatio;
    }

    getRenderTarget(): unknown {
      return this.target;
    }

    setRenderTarget(target: unknown): void {
      this.target = target;
    }

    getClearColor(target: InstanceType<typeof actual.Color>): InstanceType<typeof actual.Color> {
      return target.copy(this.clearColor);
    }

    setClearColor(color: InstanceType<typeof actual.Color> | number, alpha?: number): void {
      this.clearColor.set(color);
      if (alpha !== undefined) {
        this.clearAlpha = alpha;
      }
    }

    getClearAlpha(): number {
      return this.clearAlpha;
    }

    clear(): void {}

    clearDepth(): void {}

    compile(): void {}

    render(): void {}

    dispose(): void {}
  }

  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

// 飞控换成只报位姿的替身：座机停在出生点
vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: class {
    private readonly aircraft: THREE.Group;

    constructor(aircraft: THREE.Group) {
      this.aircraft = aircraft;
    }

    getPosition(): THREE.Vector3 {
      return this.aircraft.position.clone();
    }

    getQuaternion(): THREE.Quaternion {
      return this.aircraft.quaternion.clone();
    }

    getSpeed(): number {
      return 0;
    }

    update(): void {
      // 座机不动
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

// 地形生成很重，这里用不到：换成一片平坦的海面
vi.mock('@/features/terrain/TerrainGenerator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/terrain/TerrainGenerator')>()),
  TerrainGenerator: vi.fn().mockImplementation(() => ({
    generateTerrain: vi.fn(),
    update: vi.fn(),
    updateLOD: vi.fn(),
    getCrashSurfaceY: vi.fn(() => 0),
    sampleSurface: vi.fn(() => ({ y: 0, kind: 'water' })),
    getSurfaceKind: vi.fn(() => 'water'),
    getEnvironment: vi.fn(() => null),
    dispose: vi.fn(),
  })),
}));

interface FakeRenderer {
  pixelRatios: number[];
  getPixelRatio(): number;
}

describe('adaptive resolution reaches the game renderer (Android tablet batch, spec 3)', () => {
  let restoreGlobals: () => void;
  let rig: CampaignRig | null = null;
  let display: FakeDisplay;
  let originalIsMobile: boolean;
  let originalIsTablet: boolean;
  let originalPreset: ReturnType<typeof GameConfig.getQualityPreset>;
  let pixelRatioDescriptor: PropertyDescriptor | undefined;
  let touchPointsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    restoreGlobals = installCampaignGlobals();
    originalIsMobile = GameConfig.isMobile;
    originalIsTablet = GameConfig.isTablet;
    originalPreset = GameConfig.getQualityPreset();
    pixelRatioDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    touchPointsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');
    // 触屏手机：GameConfig.isMobile 触屏、不是平板级；×3 屏让各档上限都生效
    GameConfig.isMobile = true;
    GameConfig.isTablet = false;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    display = new FakeDisplay().install();
  });

  afterEach(() => {
    rig?.dispose();
    rig = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    GameConfig.clearRuntimeQualityOverride();
    GameConfig.setQualityPreset(originalPreset);
    GameConfig.isMobile = originalIsMobile;
    GameConfig.isTablet = originalIsTablet;
    for (const [target, name, descriptor] of [
      [window, 'devicePixelRatio', pixelRatioDescriptor],
      [navigator, 'maxTouchPoints', touchPointsDescriptor],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(target, name, descriptor);
      } else {
        Reflect.deleteProperty(target, name);
      }
    }
    restoreGlobals();
  });

  it('a touch phone running slow drops the renderer to ×1.0 and brings it back to ×1.2', async () => {
    rig = await CampaignRig.boot();
    const coordinator = rig.coordinator;
    callPrivate(coordinator, 'setQualityPreset', 'auto');
    const renderer = (coordinator.gameScene as GameScene).renderer as unknown as FakeRenderer;
    expect(renderer.getPixelRatio(), 'the phone cap at the start').toBe(1.2);
    const appliedBefore = renderer.pixelRatios.length;

    const loop = coordinator.gameLoop as GameLoop;
    loop.start(
      (deltaTime) => callPrivate(coordinator, 'update', deltaTime),
      (alpha) => callPrivate(coordinator, 'render', alpha)
    );

    /** fps 帧率最多跑 seconds 秒，直到渲染器的像素比等于 ratio */
    const playUntil = (fps: number, seconds: number, ratio: number): boolean => {
      for (const at of steadyFrames(fps, seconds, display.now)) {
        display.vsync(at);
        if (renderer.getPixelRatio() === ratio) {
          return true;
        }
      }
      return false;
    };

    expect(playUntil(20, 15, 1), 'the renderer dropped to ×1.0 at 20 fps').toBe(true);
    expect(playUntil(60, 30, 1.2), 'the renderer came back to ×1.2 at 60 fps').toBe(true);
    loop.stop();

    const applied = renderer.pixelRatios.slice(appliedBefore);
    expect(new Set(applied), 'pixel ratios handed to the renderer').toEqual(new Set([1.2, 1]));
  });
});
