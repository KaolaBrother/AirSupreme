import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createGradeMaterial } from './GradeShader';
import type { ScreenEffectsValues } from './ScreenEffectsState';

export interface PostFxGrade {
  exposure: number;
  contrast: number;
  saturation: number;
  bloomStrength: number;
  vignetteStrength: number;
}

export interface PostFxQualityOptions {
  /** MSAA 采样数（0 = 关闭） */
  samples: number;
  /** 泛光分辨率系数（1 = 标准半分辨率起步，0.5 = 再减半） */
  bloomResolution: number;
}

/** 泛光：基础强度（保证爆炸/自发光有辉光）+ 关卡附加强度 */
const BASE_BLOOM_STRENGTH = 0.34;
const LEVEL_BLOOM_GAIN = 1.3;
const BLOOM_RADIUS = 0.22;
/**
 * 阈值（显示空间亮度 0..1）：只有接近饱和的高光（爆心、曳光、闪光）才泛光，
 * 普通云层/雪面（< 0.9）不受影响。
 */
const BLOOM_THRESHOLD = 0.9;
const BLOOM_SMOOTH_WIDTH = 0.1;

type FlaggedRenderTarget = THREE.WebGLRenderTarget & { isXRRenderTarget?: boolean };

/**
 * three 为画布传入的“非光照颜色”（雾色、纯色背景清屏色）会先编码到输出色彩空间，
 * 而渲染到目标时保持工作空间（线性）。场景目标已改为显示参考输出，
 * 因此渲染期间临时把雾色/背景色换成其 sRGB 编码值，渲染后精确还原。
 */
class DisplayReferredRenderPass extends RenderPass {
  private readonly savedFogColor = new THREE.Color();
  private readonly savedBackground = new THREE.Color();

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    const fog = this.scene.fog;
    const background = this.scene.background;
    const backgroundColor = background instanceof THREE.Color ? background : null;
    if (fog) {
      this.savedFogColor.copy(fog.color);
      fog.color.convertLinearToSRGB();
    }
    if (backgroundColor) {
      this.savedBackground.copy(backgroundColor);
      backgroundColor.convertLinearToSRGB();
    }
    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      if (fog) fog.color.copy(this.savedFogColor);
      if (backgroundColor) backgroundColor.copy(this.savedBackground);
    }
  }
}

/**
 * 让场景渲染目标与画布走完全相同的着色路径：
 * three 仅在“画布或 XR 目标”上启用逐材质色调映射与 sRGB 输出编码。
 * 标记后，场景（含天空背景、未做色彩转换的自定义着色器、加色/半透明混合）
 * 在目标中得到与直出画布逐像素一致的显示参考结果，后续泛光/调色均在显示空间进行。
 */
function markDisplayReferred(target: THREE.WebGLRenderTarget): void {
  (target as FlaggedRenderTarget).isXRRenderTarget = true;
  target.texture.colorSpace = THREE.SRGBColorSpace;
}

/**
 * 后处理管线：RenderPass（显示参考场景）→ UnrealBloom → 调色/屏幕效果 ShaderPass
 */
export class PostFxPipeline {
  readonly composer: EffectComposer;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly renderPass: DisplayReferredRenderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradePass: ShaderPass;
  private readonly bloomResolution: number;
  private grade: PostFxGrade = {
    exposure: 1,
    contrast: 1,
    saturation: 1,
    bloomStrength: 0,
    vignetteStrength: 0,
  };

  /** 当前渲染器是否支持半浮点渲染目标 */
  static isSupported(renderer: THREE.WebGLRenderer): boolean {
    try {
      const extensions = renderer.extensions;
      return (
        extensions.has('EXT_color_buffer_float') || extensions.has('EXT_color_buffer_half_float')
      );
    } catch {
      return false;
    }
  }

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    quality: PostFxQualityOptions
  ) {
    this.renderer = renderer;
    this.bloomResolution = THREE.MathUtils.clamp(quality.bloomResolution, 0.25, 1);

    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();
    const width = Math.max(1, Math.floor(size.x * pixelRatio));
    const height = Math.max(1, Math.floor(size.y * pixelRatio));
    const samples = renderer.capabilities.isWebGL2 ? Math.max(0, Math.floor(quality.samples)) : 0;

    const sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples,
    });
    sceneTarget.texture.name = 'VfxPostFx.scene';
    const composer = new EffectComposer(renderer, sceneTarget);
    // 所有 Pass 都不交换缓冲：readBuffer（克隆体）承载场景；writeBuffer 未使用，换成廉价目标节省显存
    composer.renderTarget1.dispose();
    composer.renderTarget1 = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    composer.writeBuffer = composer.renderTarget1;
    markDisplayReferred(composer.readBuffer);
    this.composer = composer;

    this.renderPass = new DisplayReferredRenderPass(scene, camera);
    composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BASE_BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    const smoothWidth = this.bloomPass.materialHighPassFilter.uniforms.smoothWidth;
    if (smoothWidth) smoothWidth.value = BLOOM_SMOOTH_WIDTH;
    const bloomResolution = this.bloomResolution;
    const bloomSetSize = this.bloomPass.setSize.bind(this.bloomPass);
    this.bloomPass.setSize = (w: number, h: number): void => {
      bloomSetSize(
        Math.max(2, Math.round(w * bloomResolution)),
        Math.max(2, Math.round(h * bloomResolution))
      );
    };
    composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(createGradeMaterial());
    composer.addPass(this.gradePass);

    composer.setPixelRatio(pixelRatio);
    composer.setSize(size.x, size.y);
  }

  setGrade(grade: Partial<PostFxGrade>): void {
    this.grade = { ...this.grade, ...grade };
    const bloomStrength = Number.isFinite(this.grade.bloomStrength) ? this.grade.bloomStrength : 0;
    this.bloomPass.strength = THREE.MathUtils.clamp(
      BASE_BLOOM_STRENGTH + bloomStrength * LEVEL_BLOOM_GAIN,
      0,
      1.4
    );
  }

  getGrade(): PostFxGrade {
    return this.grade;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(deltaTime: number, effects: ScreenEffectsValues): void {
    const uniforms = this.gradePass.uniforms;
    const size = this.renderer.getSize(scratchSize);
    const aspect = size.y > 0 ? size.x / size.y : 1;
    uniforms.uContrast.value = finiteOr(this.grade.contrast, 1);
    uniforms.uSaturation.value = finiteOr(this.grade.saturation, 1);
    uniforms.uVignette.value = THREE.MathUtils.clamp(
      finiteOr(this.grade.vignetteStrength, 0),
      0,
      0.9
    );
    uniforms.uDamage.value = effects.damagePulse;
    uniforms.uLowHealth.value = effects.lowHealth;
    uniforms.uHeartbeat.value = effects.heartbeat;
    uniforms.uFlash.value = effects.flash;
    uniforms.uSpeed.value = effects.speed;
    uniforms.uEmp.value = effects.empFlash;
    uniforms.uTime.value = effects.time;
    (uniforms.uAspect.value as THREE.Vector2).set(Math.max(1, aspect), Math.max(1, 1 / aspect));
    // 每帧确认场景目标标记（尺寸变化不会丢失，但重建缓冲后需要）
    markDisplayReferred(this.composer.readBuffer);
    this.composer.render(deltaTime);
  }

  dispose(): void {
    this.renderPass.dispose();
    this.bloomPass.dispose();
    this.gradePass.material.dispose();
    this.gradePass.dispose();
    this.composer.dispose();
  }
}

const scratchSize = new THREE.Vector2();

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
