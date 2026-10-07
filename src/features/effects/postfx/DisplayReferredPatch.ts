import * as THREE from 'three';
import { ACES_GLSL } from './GradeShader';

/**
 * 兼容补丁：未包含 colorspace_fragment 的自定义 ShaderMaterial（如湖面水体）在直出路径下
 * 把颜色原样写入 sRGB 画布（显示参考值）。经后处理（线性 HDR → ACES → sRGB）时会被二次编码而发白。
 * 安装后，仅当材质为“合成场景目标”编译时（three 会为不同输出色彩空间/色调映射分别缓存程序），
 * 在末尾注入换算：把输出转为“经 ACES + sRGB 后恰好还原原显示值”的场景线性值。
 * 直出路径（画布）使用未注入的程序，画面与原来完全一致。
 */

const compositeExposure = { value: 1 };
let installed = false;
let activeSceneTarget: THREE.WebGLRenderTarget | null = null;

const PREFIX = /* glsl */ `
uniform float vfxCompositeExposure;
${ACES_GLSL}
`;

const INJECT = /* glsl */ `
  {
    vec3 vfxDisplay = clamp(gl_FragColor.rgb, 0.0, 1.0);
    vec3 vfxLinear = mix(
      pow((vfxDisplay + 0.055) / 1.055, vec3(2.4)),
      vfxDisplay / 12.92,
      vec3(lessThanEqual(vfxDisplay, vec3(0.04045)))
    );
    gl_FragColor.rgb = vfxInverseACESFilmic(vfxLinear, vfxCompositeExposure);
  }
`;

/** 片元着色器是否以“显示参考值”直接输出（未做色彩空间转换） */
export function isDisplayReferredShader(fragmentShader: string): boolean {
  return (
    fragmentShader.includes('gl_FragColor') &&
    !fragmentShader.includes('colorspace_fragment') &&
    !fragmentShader.includes('encodings_fragment') &&
    !fragmentShader.includes('vfxACESFilmic')
  );
}

type CompileHook = (
  shader: THREE.WebGLProgramParametersWithUniforms,
  renderer: THREE.WebGLRenderer
) => void;

/**
 * 安装一次（幂等）：包装 Material.prototype.onBeforeCompile，
 * 仅对未自定义 onBeforeCompile 的普通 ShaderMaterial 生效。
 */
export function installDisplayReferredPatch(): void {
  if (installed) return;
  installed = true;
  const prototype = THREE.Material.prototype as unknown as { onBeforeCompile: CompileHook };
  const original = prototype.onBeforeCompile;
  prototype.onBeforeCompile = function vfxDisplayReferredHook(
    this: THREE.Material,
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
  ): void {
    original.call(this, shader, renderer);
    if (activeSceneTarget === null || renderer.getRenderTarget() !== activeSceneTarget) return;
    const material = this as THREE.ShaderMaterial;
    if (!material.isShaderMaterial || (this as THREE.RawShaderMaterial).isRawShaderMaterial) return;
    const source = shader.fragmentShader;
    if (!isDisplayReferredShader(source)) return;
    const end = source.lastIndexOf('}');
    if (end < 0) return;
    shader.uniforms.vfxCompositeExposure = compositeExposure;
    shader.fragmentShader = PREFIX + source.slice(0, end) + INJECT + source.slice(end);
  };
}

/** 场景 Pass 渲染期间登记合成目标（null 结束）；exposure 用于逆 ACES */
export function setDisplayReferredSceneTarget(
  target: THREE.WebGLRenderTarget | null,
  exposure: number
): void {
  activeSceneTarget = target;
  compositeExposure.value = Number.isFinite(exposure) && exposure > 0 ? exposure : 1;
}
