import * as THREE from 'three';

/**
 * 最终调色/屏幕效果着色器（线性 HDR → ACES → sRGB → 调色 → 屏幕效果）。
 * ACES 与 three r160 的 ACESFilmicToneMapping 完全一致，保证与无后处理路径色彩对齐。
 */

export const ACES_GLSL = /* glsl */ `
vec3 vfxRRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 vfxACESFilmic(vec3 color, float exposure) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = vfxRRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}

// ACES 的逆变换：显示线性值 → 场景线性 HDR（用于天空背景，使其经 ACES 后保持原色）
vec3 vfxInverseACESFilmic(vec3 target, float exposure) {
  const mat3 ACESInputInv = mat3(
    vec3(1.764741, -0.147028, -0.036337),
    vec3(-0.675778, 1.160252, -0.162436),
    vec3(-0.088963, -0.013224, 1.198773)
  );
  const mat3 ACESOutputInv = mat3(
    vec3(0.643038, 0.059269, 0.005962),
    vec3(0.311187, 0.931436, 0.063929),
    vec3(0.045775, 0.009295, 0.930118)
  );
  vec3 y = clamp(ACESOutputInv * target, 0.0, 0.98);
  vec3 A = 1.0 - 0.983729 * y;
  vec3 B = 0.0245786 - 0.4329510 * y;
  vec3 C = -(0.000090537 + 0.238081 * y);
  vec3 v = (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
  return max(ACESInputInv * v, 0.0) * 0.6 / max(exposure, 1e-3);
}

vec3 vfxLinearToSRGB(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform float uDamage;
uniform float uLowHealth;
uniform float uHeartbeat;
uniform float uFlash;
uniform float uSpeed;
uniform float uEmp;
uniform float uTime;
uniform vec2 uAspect;

varying vec2 vUv;

${ACES_GLSL}

float vfxHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;

  // EMP：水平故障条纹
  if (uEmp > 0.001) {
    float frame = floor(uTime * 24.0);
    float band = floor(uv.y * 42.0);
    float gate = step(0.62, vfxHash(vec2(band * 1.7, frame)));
    uv.x += (vfxHash(vec2(band, frame)) - 0.5) * 0.045 * uEmp * gate;
  }

  vec3 hdr;
  float edge = dot(centered, centered);
  if (uDamage > 0.001) {
    // 受击色散（边缘更强）
    vec2 offset = centered * (0.014 * uDamage * (0.25 + edge * 2.4));
    hdr.r = texture2D(tDiffuse, uv + offset).r;
    hdr.g = texture2D(tDiffuse, uv).g;
    hdr.b = texture2D(tDiffuse, uv - offset).b;
  } else {
    hdr = texture2D(tDiffuse, uv).rgb;
  }

  // 加力径向速度拖影
  if (uSpeed > 0.001) {
    float strength = uSpeed * smoothstep(0.08, 0.55, length(centered));
    vec3 accum = hdr;
    float weight = 1.0;
    for (int i = 1; i <= 6; i++) {
      float t = float(i) / 6.0;
      float w = 1.0 - t * 0.75;
      accum += texture2D(tDiffuse, uv - centered * (t * 0.05 * strength)).rgb * w;
      weight += w;
    }
    hdr = accum / weight;
  }

  vec3 color = vfxLinearToSRGB(vfxACESFilmic(max(hdr, 0.0), uExposure));

  // 调色：饱和度 / 对比度（显示空间）
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;

  // 低血量去饱和
  luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(color, vec3(luma) * vec3(1.06, 0.94, 0.94), uLowHealth * 0.4);

  // 暗角（含心跳）
  vec2 vc = centered * uAspect;
  float vig = smoothstep(0.55, 1.15, length(vc) * 1.1);
  float vignette = uVignette + uLowHealth * (0.18 + 0.32 * uHeartbeat) + uSpeed * 0.12;
  color *= 1.0 - vig * clamp(vignette, 0.0, 0.95);

  // 受击红边 + 低血量心跳红边
  color = mix(color, vec3(0.78, 0.05, 0.03), clamp(vig * uDamage * 0.65, 0.0, 1.0));
  color = mix(color, vec3(0.5, 0.0, 0.0), clamp(vig * uLowHealth * uHeartbeat * 0.32, 0.0, 1.0));

  // EMP 青色闪 + 白闪
  color += vec3(0.22, 0.8, 1.0) * uEmp * (0.3 + 0.7 * vig) * 0.75;
  color = mix(color, vec3(0.72, 0.95, 1.0), uEmp * 0.22);
  color = mix(color, vec3(1.0, 0.97, 0.92), clamp(uFlash, 0.0, 1.0) * 0.82);

  // 抖动抑制色带
  color += (vfxHash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export function createGradeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'VfxGradePass',
    uniforms: {
      tDiffuse: { value: null },
      uExposure: { value: 1 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uVignette: { value: 0 },
      uDamage: { value: 0 },
      uLowHealth: { value: 0 },
      uHeartbeat: { value: 0 },
      uFlash: { value: 0 },
      uSpeed: { value: 0 },
      uEmp: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

const backgroundFragment = /* glsl */ `
uniform sampler2D tBackground;
uniform mat3 uvTransform;
uniform float backgroundIntensity;
uniform float uExposure;
uniform float uInvert;
uniform float uMaxTarget;

varying vec2 vUv;

${ACES_GLSL}

void main() {
  vec2 uv = (uvTransform * vec3(vUv, 1.0)).xy;
  vec3 color = texture2D(tBackground, uv).rgb * backgroundIntensity;
  if (uInvert > 0.5) {
    color = vfxInverseACESFilmic(min(color, vec3(uMaxTarget)), uExposure);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * 天空背景（逆 ACES）：sRGB 背景贴图在无后处理路径下不做色调映射，
 * 为让后处理路径的最终 ACES 还原出同样的天空颜色，先写入其逆变换值。
 */
export function createInverseBackgroundMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'VfxSkyBackground',
    uniforms: {
      tBackground: { value: null },
      uvTransform: { value: new THREE.Matrix3() },
      backgroundIntensity: { value: 1 },
      uExposure: { value: 1 },
      uInvert: { value: 1 },
      uMaxTarget: { value: 0.9 },
    },
    vertexShader,
    fragmentShader: backgroundFragment,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}
