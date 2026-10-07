import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createGradeMaterial, createInverseBackgroundMaterial } from './GradeShader';
import type { ScreenEffectsValues } from './ScreenEffectsState';
import { installDisplayReferredPatch, setDisplayReferredSceneTarget } from './DisplayReferredPatch';

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
const BASE_BLOOM_STRENGTH = 0.3;
const LEVEL_BLOOM_GAIN = 1.3;
const BLOOM_RADIUS = 0.42;
/** 阈值（场景线性亮度）：高于天空逆变换上限，避免天空/白云整体泛光；爆炸等 HDR 粒子远超此值 */
const BLOOM_THRESHOLD = 2.3;
const BLOOM_SMOOTH_WIDTH = 1.2;
/** 天空逆变换的显示值上限（线性），对应场景亮度约 1.6，低于泛光阈值 */
const SKY_MAX_DISPLAY = 0.86;

/**
 * 场景渲染 Pass：先以逆 ACES 绘制 sRGB 天空背景，再渲染场景（不让 three 绘制背景），
 * 保证经最终 ACES 后天空与无后处理路径一致；其余与 RenderPass 相同。
 */
class SkyAwareScenePass extends Pass {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly backgroundMaterial = createInverseBackgroundMaterial();
  private readonly backgroundQuad = new FullScreenQuad(this.backgroundMaterial);
  private readonly clearColor = new THREE.Color();
  private readonly linearColor = new THREE.Color();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);

    const background = this.scene.background;
    let handled = false;
    const exposure = renderer.toneMappingExposure;

    if (
      background instanceof THREE.Texture &&
      !(background instanceof THREE.CubeTexture) &&
      background.mapping === THREE.UVMapping &&
      this.scene.backgroundBlurriness === 0
    ) {
      renderer.clear(true, true, true);
      const uniforms = this.backgroundMaterial.uniforms;
      uniforms.tBackground.value = background;
      if (background.matrixAutoUpdate) background.updateMatrix();
      (uniforms.uvTransform.value as THREE.Matrix3).copy(background.matrix);
      uniforms.backgroundIntensity.value = this.scene.backgroundIntensity;
      uniforms.uExposure.value = exposure;
      uniforms.uMaxTarget.value = SKY_MAX_DISPLAY;
      uniforms.uInvert.value =
        THREE.ColorManagement.getTransfer(background.colorSpace) === THREE.SRGBTransfer ? 1 : 0;
      this.backgroundQuad.render(renderer);
      handled = true;
    } else if (background instanceof THREE.Color) {
      // 纯色背景同样做逆变换
      renderer.getClearColor(this.clearColor);
      const oldAlpha = renderer.getClearAlpha();
      this.linearColor.copy(inverseAcesColor(background, exposure));
      renderer.setClearColor(this.linearColor, 1);
      renderer.clear(true, true, true);
      renderer.setClearColor(this.clearColor, oldAlpha);
      handled = true;
    } else {
      renderer.clear(true, true, true);
    }

    if (handled) {
      this.scene.background = null;
    }
    setDisplayReferredSceneTarget(this.renderToScreen ? null : readBuffer, exposure);
    try {
      renderer.render(this.scene, this.camera);
    } finally {
      setDisplayReferredSceneTarget(null, exposure);
      if (handled) {
        this.scene.background = background;
      }
      renderer.autoClear = oldAutoClear;
    }
  }

  dispose(): void {
    this.backgroundMaterial.dispose();
    this.backgroundQuad.dispose();
  }
}

const ACES_OUTPUT_INV = new THREE.Matrix3().set(
  0.643038,
  0.311187,
  0.045775,
  0.059269,
  0.931436,
  0.009295,
  0.005962,
  0.063929,
  0.930118
);
const ACES_INPUT_INV = new THREE.Matrix3().set(
  1.764741,
  -0.675778,
  -0.088963,
  -0.147028,
  1.160252,
  -0.013224,
  -0.036337,
  -0.162436,
  1.198773
);
const inverseScratch = new THREE.Vector3();
const inverseColor = new THREE.Color();

/** CPU 版逆 ACES（与着色器一致），输入/输出均为线性工作空间颜色 */
export function inverseAcesColor(color: THREE.Color, exposure: number): THREE.Color {
  inverseScratch.set(
    Math.min(color.r, SKY_MAX_DISPLAY),
    Math.min(color.g, SKY_MAX_DISPLAY),
    Math.min(color.b, SKY_MAX_DISPLAY)
  );
  inverseScratch.applyMatrix3(ACES_OUTPUT_INV);
  const solve = (yRaw: number): number => {
    const y = Math.min(Math.max(yRaw, 0), 0.98);
    const a = 1 - 0.983729 * y;
    const b = 0.0245786 - 0.432951 * y;
    const c = -(0.000090537 + 0.238081 * y);
    return (-b + Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a);
  };
  inverseScratch.set(solve(inverseScratch.x), solve(inverseScratch.y), solve(inverseScratch.z));
  inverseScratch.applyMatrix3(ACES_INPUT_INV);
  const scale = 0.6 / Math.max(exposure, 1e-3);
  return inverseColor.setRGB(
    Math.max(inverseScratch.x, 0) * scale,
    Math.max(inverseScratch.y, 0) * scale,
    Math.max(inverseScratch.z, 0) * scale
  );
}

/**
 * 后处理管线：天空感知场景 Pass → UnrealBloom（HDR）→ 调色/屏幕效果 ShaderPass（ACES + sRGB 输出）
 */
export class PostFxPipeline {
  readonly composer: EffectComposer;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scenePass: SkyAwareScenePass;
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

  /** 当前渲染器是否支持 HDR 浮点渲染目标 */
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
    installDisplayReferredPatch();

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
    // 只有 readBuffer（克隆体）承载场景；writeBuffer 未被使用，换成廉价目标节省显存
    composer.renderTarget1.dispose();
    composer.renderTarget1 = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    composer.writeBuffer = composer.renderTarget1;
    this.composer = composer;

    this.scenePass = new SkyAwareScenePass(scene, camera);
    composer.addPass(this.scenePass);

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
      1.6
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
    uniforms.uExposure.value = this.renderer.toneMappingExposure;
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

    this.composer.render(deltaTime);
  }

  dispose(): void {
    this.scenePass.dispose();
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
