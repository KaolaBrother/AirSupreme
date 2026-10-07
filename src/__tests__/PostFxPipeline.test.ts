import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PostFxPipeline } from '@/features/effects/postfx/PostFxPipeline';
import { ScreenEffectsState } from '@/features/effects/postfx/ScreenEffectsState';

/**
 * 回归：游戏场景必须每帧都画进同一个带深度缓冲的（MSAA）目标。
 * 若 EffectComposer 每帧交换读写缓冲，RenderPass 会隔帧把场景画进无深度缓冲的目标，
 * 不透明战机深度测试失效（玩家机身消失、其他战机呈半透明）。
 */

/** 连续渲染帧数：覆盖读写缓冲交换的奇偶两种相位 */
const FRAME_COUNT = 4;
const FRAME_DT = 1 / 60;
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 180;

/** 调用时绑定的渲染目标；null 表示屏幕（画布） */
type BoundTarget = THREE.WebGLRenderTarget | null;

type RendererCall =
  | { op: 'getRenderTarget' | 'setRenderTarget' | 'clear'; target: BoundTarget }
  | { op: 'render'; target: BoundTarget; object: THREE.Object3D };

type DrawCall = Extract<RendererCall, { op: 'render' }>;

type PipelineHarness = {
  renderer: FakeWebGLRenderer;
  scene: THREE.Scene;
  pipeline: PostFxPipeline;
};

/**
 * jsdom 没有 WebGL：只实现 PostFxPipeline 及 three r160 的 EffectComposer / RenderPass /
 * UnrealBloomPass / ShaderPass / FullScreenQuad 会触及的渲染器表面，并按顺序记录目标绑定与绘制。
 */
class FakeWebGLRenderer {
  readonly capabilities = { isWebGL2: true };
  readonly calls: RendererCall[] = [];
  autoClear = true;
  autoClearColor = true;
  autoClearDepth = true;
  autoClearStencil = true;
  private boundTarget: BoundTarget = null;
  private readonly clearColor = new THREE.Color(0x000000);
  private clearAlpha = 1;

  getSize(target: THREE.Vector2): THREE.Vector2 {
    return target.set(CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  getPixelRatio(): number {
    return 1;
  }

  getRenderTarget(): BoundTarget {
    this.calls.push({ op: 'getRenderTarget', target: this.boundTarget });
    return this.boundTarget;
  }

  setRenderTarget(target: BoundTarget): void {
    this.boundTarget = target;
    this.calls.push({ op: 'setRenderTarget', target });
  }

  getClearColor(target: THREE.Color): THREE.Color {
    return target.copy(this.clearColor);
  }

  setClearColor(color: THREE.ColorRepresentation, alpha?: number): void {
    this.clearColor.set(color);
    if (alpha !== undefined) this.clearAlpha = alpha;
  }

  getClearAlpha(): number {
    return this.clearAlpha;
  }

  setClearAlpha(alpha: number): void {
    this.clearAlpha = alpha;
  }

  clear(): void {
    this.calls.push({ op: 'clear', target: this.boundTarget });
  }

  clearDepth(): void {
    this.clear();
  }

  render(object: THREE.Object3D): void {
    this.calls.push({ op: 'render', target: this.boundTarget, object });
  }
}

function createHarness(samples: number): PipelineHarness {
  const renderer = new FakeWebGLRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 2000);
  const pipeline = new PostFxPipeline(renderer as unknown as THREE.WebGLRenderer, scene, camera, {
    samples,
    bloomResolution: 0.5,
  });
  return { renderer, scene, pipeline };
}

function isDrawCall(call: RendererCall): call is DrawCall {
  return call.op === 'render';
}

/** 与 GameScene.render 相同：每帧推进屏幕效果再渲染；返回每帧的绘制调用 */
function renderFrames({ renderer, pipeline }: PipelineHarness, frameCount: number): DrawCall[][] {
  const screenEffects = new ScreenEffectsState();
  const frames: DrawCall[][] = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const firstCall = renderer.calls.length;
    pipeline.render(FRAME_DT, screenEffects.update(FRAME_DT));
    frames.push(renderer.calls.slice(firstCall).filter(isDrawCall));
  }
  return frames;
}

describe('PostFxPipeline', () => {
  it.each([4, 0])(
    'renders the game scene into one depth-buffered target every frame (samples: %i)',
    (samples) => {
      const harness = createHarness(samples);
      const sceneTargetsPerFrame = renderFrames(harness, FRAME_COUNT).map((draws) =>
        draws.filter((draw) => draw.object === harness.scene).map((draw) => draw.target)
      );
      const firstSceneTarget = sceneTargetsPerFrame[0][0];

      sceneTargetsPerFrame.forEach((targets, frame) => {
        expect(targets.length, `frame ${frame}: game scene draws`).toBeGreaterThan(0);
        for (const target of targets) {
          const where = `frame ${frame}: game scene`;
          expect(target, `${where} drawn straight to the screen`).not.toBeNull();
          expect(target?.depthBuffer, `${where} target has a depth buffer`).toBe(true);
          expect(target === firstSceneTarget, `${where} target is the frame-0 target`).toBe(true);
          if (samples > 0) {
            expect(target?.samples, `${where} target is multisampled`).toBeGreaterThan(0);
          }
        }
      });

      harness.pipeline.dispose();
    }
  );

  it('draws the final pass to the screen every frame', () => {
    const harness = createHarness(4);
    const frames = renderFrames(harness, FRAME_COUNT);

    frames.forEach((draws, frame) => {
      expect(draws.length, `frame ${frame}: draw calls`).toBeGreaterThan(0);
      const finalDraw = draws[draws.length - 1];
      expect(finalDraw.target, `frame ${frame}: final pass render target`).toBeNull();
    });

    harness.pipeline.dispose();
  });
});
