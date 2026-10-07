import * as THREE from 'three';

/**
 * 最终调色/屏幕效果着色器。输入为显示参考的场景（与直出画布逐像素一致，已含 ACES 与 sRGB 编码）
 * 叠加泛光后，在显示空间做饱和度/对比度/暗角与屏幕效果。
 */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
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

  vec3 color = clamp(hdr, 0.0, 1.0);

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
