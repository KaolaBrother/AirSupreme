import * as THREE from 'three';

/**
 * 第十关 Boss「神谕主宰」专用着色器材质（全部为加色、透明、深度测试开、不写深度）。
 *
 * - createOracleShieldMaterial：护盾球。三平面投影六边形网格 + 菲涅尔边缘 + 扫描带 +
 *   护盾塔供能锚点（存活时向外扩散的供能波纹，被毁后变成闪烁的破口）+ 命中涟漪 + 崩溃溶解。
 * - createOracleBeamMaterial：光束 / 预警虚线 / 电弧共用。圆柱几何体（底端在原点、沿 +Y 延伸、
 *   高度 1），由网格缩放成 (半径, 长度, 半径)；按视线夹角做“白热芯 + 彩色辉光”的体积感。
 * - createOracleBandMaterial：过载冲击环。单位圆柱（y ∈ [-0.5, 0.5]）按 (半径, 高度, 半径) 缩放；
 *   支持角向缺口（可穿越的“门”）与竖直安全槽（双环之间的安全高度）。
 *
 * 约定（与 ContrailSystem / ParticleBatch 一致）：先色调映射与色彩空间转换，再在输出空间做雾；
 * 加色材质按雾淡出（乘 1 - fogFactor）而不是混向雾色。
 */

export const ORACLE_SHIELD_MAX_HITS = 4;
export const ORACLE_SHIELD_ANCHORS = 4;
export const ORACLE_BAND_MAX_GAPS = 4;
/** 未使用的缺口角度（远大于 π，着色器据此跳过） */
export const ORACLE_BAND_UNUSED_GAP = 100;

export type OracleBeamMode = 'beam' | 'telegraph' | 'arc';

const FOG_FRAGMENT_ADDITIVE = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb *= 1.0 - fogFactor;
  #endif
`;

// ---------------------------------------------------------------------------------------------
// 护盾
// ---------------------------------------------------------------------------------------------

const shieldVertexShader = /* glsl */ `
varying vec3 vDir;
varying vec3 vNormalView;
varying vec3 vViewPosition;
#include <fog_pars_vertex>

void main() {
  vDir = normalize(position);
  vNormalView = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const shieldFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHotColor;
uniform vec3 uBreachColor;
uniform float uTime;
uniform float uFade;
uniform float uIntegrity;
uniform float uHexScale;
uniform float uCollapse;
uniform float uFlash;
uniform vec4 uHits[${ORACLE_SHIELD_MAX_HITS}];
uniform vec4 uAnchors[${ORACLE_SHIELD_ANCHORS}];

varying vec3 vDir;
varying vec3 vNormalView;
varying vec3 vViewPosition;
#include <fog_pars_fragment>

float hexDistance(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

float hexEdge(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return smoothstep(0.42, 0.49, hexDistance(gv));
}

// 三平面投影的六边形网格，避免球面极点拉伸
float hexPattern(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);
  return hexEdge(n.yz * uHexScale) * w.x
    + hexEdge(n.zx * uHexScale) * w.y
    + hexEdge(n.xy * uHexScale) * w.z;
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 n = normalize(vDir);
  vec3 viewDir = normalize(-vViewPosition);
  float facing = abs(dot(normalize(vNormalView), viewDir));
  float fresnel = pow(1.0 - facing, 2.2);
  float lines = hexPattern(n);

  // 崩溃：按格溶解，溶解边缘发白热光
  float cell = hash13(floor(n * 9.0 + 17.0));
  if (uCollapse > 0.0 && cell < uCollapse) discard;
  float dissolveEdge = uCollapse > 0.0 ? 1.0 - smoothstep(uCollapse, uCollapse + 0.09, cell) : 0.0;

  // 自下而上的扫描带
  float scanY = fract(uTime * 0.16) * 2.6 - 1.3;
  float scan = exp(-pow((n.y - scanY) / 0.06, 2.0));

  // 供能锚点 / 破口
  float feed = 0.0;
  float breach = 0.0;
  for (int i = 0; i < ${ORACLE_SHIELD_ANCHORS}; i++) {
    vec4 a = uAnchors[i];
    if (abs(a.w) < 0.001) continue;
    float ang = acos(clamp(dot(n, a.xyz), -1.0, 1.0));
    if (a.w > 0.0) {
      float spot = exp(-ang * ang / 0.006);
      float waves = 0.5 + 0.5 * sin(ang * 22.0 - uTime * 6.0);
      feed += a.w * (spot * 0.9 + exp(-ang * ang / 0.25) * waves * lines * 0.7);
    } else {
      breach += -a.w * exp(-ang * ang / 0.16);
    }
  }
  float flicker = step(0.42, fract(sin(floor(uTime * 17.0) * 12.9898) * 43758.5453));
  breach = clamp(breach, 0.0, 1.0);

  // 命中涟漪
  float ripple = 0.0;
  float hitFlash = 0.0;
  for (int i = 0; i < ${ORACLE_SHIELD_MAX_HITS}; i++) {
    vec4 hit = uHits[i];
    float age = uTime - hit.w;
    if (hit.w < 0.0 || age < 0.0 || age > 0.9) continue;
    float ang = acos(clamp(dot(n, hit.xyz), -1.0, 1.0));
    float life = 1.0 - age / 0.9;
    ripple += exp(-pow((ang - age * 2.6) / 0.16, 2.0)) * life * life;
    hitFlash += exp(-ang * ang / 0.03) * pow(max(0.0, 1.0 - age / 0.3), 2.0);
  }

  float integrity = 0.3 + 0.7 * uIntegrity;
  float idle = ((0.014 + 0.13 * fresnel) * lines + fresnel * 0.1) * integrity;
  idle *= 1.0 - breach * (0.85 - 0.6 * flicker);
  float energy = scan * (0.03 + lines * 0.16) * integrity
    + feed * 0.55
    + lines * ripple * 1.1 + ripple * 0.12 + hitFlash * (0.3 + lines * 0.6)
    + uFlash * (0.08 + lines * 0.5 + fresnel * 0.3)
    + dissolveEdge * 1.4;
  float crack = breach * lines * flicker * 0.55;
  float intensity = (idle + energy) * uFade;
  if (intensity + crack * uFade < 0.003) discard;

  vec3 rgb = mix(uColor, uHotColor, clamp(hitFlash * 0.7 + ripple * 0.3 + uFlash * 0.6 + dissolveEdge, 0.0, 1.0));
  rgb = rgb * intensity + uBreachColor * crack * uFade;
  gl_FragColor = vec4(rgb, 1.0);
  ${FOG_FRAGMENT_ADDITIVE}
}
`;

export interface OracleShieldUniforms {
  [uniform: string]: THREE.IUniform;
  uColor: THREE.IUniform<THREE.Color>;
  uHotColor: THREE.IUniform<THREE.Color>;
  uBreachColor: THREE.IUniform<THREE.Color>;
  uTime: THREE.IUniform<number>;
  uFade: THREE.IUniform<number>;
  uIntegrity: THREE.IUniform<number>;
  uHexScale: THREE.IUniform<number>;
  uCollapse: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
  uHits: THREE.IUniform<THREE.Vector4[]>;
  uAnchors: THREE.IUniform<THREE.Vector4[]>;
}

export type OracleShieldMaterial = THREE.ShaderMaterial & { uniforms: OracleShieldUniforms };

export function createOracleShieldMaterial(
  color: number,
  hotColor: number,
  breachColor: number
): OracleShieldMaterial {
  const hits: THREE.Vector4[] = [];
  for (let i = 0; i < ORACLE_SHIELD_MAX_HITS; i++) hits.push(new THREE.Vector4(0, 0, 1, -1));
  const anchors: THREE.Vector4[] = [];
  for (let i = 0; i < ORACLE_SHIELD_ANCHORS; i++) anchors.push(new THREE.Vector4(0, 1, 0, 0));
  const uniforms: OracleShieldUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: new THREE.Color(color) },
    uHotColor: { value: new THREE.Color(hotColor) },
    uBreachColor: { value: new THREE.Color(breachColor) },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uIntegrity: { value: 1 },
    uHexScale: { value: 6.2 },
    uCollapse: { value: 0 },
    uFlash: { value: 0 },
    uHits: { value: hits },
    uAnchors: { value: anchors },
  };
  const material = new THREE.ShaderMaterial({
    name: 'OracleShield',
    uniforms,
    vertexShader: shieldVertexShader,
    fragmentShader: shieldFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  return material as OracleShieldMaterial;
}

// ---------------------------------------------------------------------------------------------
// 光束 / 预警虚线 / 电弧
// ---------------------------------------------------------------------------------------------

const beamVertexShader = /* glsl */ `
uniform float uTime;
uniform float uJitter;
uniform float uSeed;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewPosition;
#include <fog_pars_vertex>

float wobble(float x) {
  return sin(x) * 0.6 + sin(x * 2.17 + 1.3) * 0.3 + sin(x * 5.3 + 0.7) * 0.1;
}

void main() {
  vec3 pos = position;
  vAlong = clamp(position.y, 0.0, 1.0);
  if (uJitter > 0.0) {
    // 电弧：两端钉住、中段折线抖动，每秒重排 24 次
    float envelope = sin(vAlong * 3.14159);
    float k = floor(uTime * 24.0);
    pos.x += wobble(vAlong * 13.0 + k * 1.7 + uSeed) * uJitter * envelope;
    pos.z += wobble(vAlong * 11.0 + k * 2.3 + uSeed * 1.3) * uJitter * envelope;
  }
  vNormalView = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const beamFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCoreColor;
uniform float uIntensity;
uniform float uMode;
uniform float uLength;
uniform float uTime;
uniform float uFlow;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewPosition;
#include <fog_pars_fragment>

void main() {
  float along = vAlong;
  vec3 viewDir = normalize(-vViewPosition);
  float facing = abs(dot(normalize(vNormalView), viewDir));
  float glow = pow(facing, 1.5);
  float core = pow(facing, 7.0);
  float tip = 1.0 - smoothstep(0.86, 1.0, along);
  float base = smoothstep(0.0, 0.012, along);
  vec3 rgb;
  float level;
  if (uMode < 0.5) {
    // 实体光束：白热芯 + 辉光，沿束流动的亮纹
    float ripple = 0.84 + 0.16 * sin(along * uLength * 0.11 - uTime * 38.0);
    rgb = uColor * glow * 1.25 + uCoreColor * core * 2.4;
    level = ripple;
  } else if (uMode < 1.5) {
    // 预警：沿发射方向流动的虚线
    float dash = step(0.42, fract(along * uLength / 24.0 - uTime * uFlow));
    rgb = uColor * (glow * 0.85 + core * 0.9);
    level = 0.3 + 0.7 * dash;
  } else {
    // 电弧：高频闪烁
    float crackle = 0.65 + 0.35 * sin(uTime * 93.0 + along * 37.0);
    rgb = uColor * glow * 1.4 + uCoreColor * core * 2.8;
    level = crackle;
  }
  float intensity = level * tip * base * uIntensity;
  if (intensity < 0.002) discard;
  gl_FragColor = vec4(rgb * intensity, 1.0);
  ${FOG_FRAGMENT_ADDITIVE}
}
`;

export interface OracleBeamUniforms {
  [uniform: string]: THREE.IUniform;
  uColor: THREE.IUniform<THREE.Color>;
  uCoreColor: THREE.IUniform<THREE.Color>;
  uIntensity: THREE.IUniform<number>;
  uMode: THREE.IUniform<number>;
  uLength: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uFlow: THREE.IUniform<number>;
  uJitter: THREE.IUniform<number>;
  uSeed: THREE.IUniform<number>;
}

export type OracleBeamMaterial = THREE.ShaderMaterial & { uniforms: OracleBeamUniforms };

export function createOracleBeamMaterial(
  color: number,
  coreColor: number = 0xffffff
): OracleBeamMaterial {
  const uniforms: OracleBeamUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: new THREE.Color(color) },
    uCoreColor: { value: new THREE.Color(coreColor) },
    uIntensity: { value: 0 },
    uMode: { value: 0 },
    uLength: { value: 100 },
    uTime: { value: 0 },
    uFlow: { value: 1.6 },
    uJitter: { value: 0 },
    uSeed: { value: Math.random() * 10 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'OracleBeam',
    uniforms,
    vertexShader: beamVertexShader,
    fragmentShader: beamFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  return material as OracleBeamMaterial;
}

export function setOracleBeamMode(material: OracleBeamMaterial, mode: OracleBeamMode): void {
  material.uniforms.uMode.value = mode === 'beam' ? 0 : mode === 'telegraph' ? 1 : 2;
}

/** 光束共用几何体：底端在原点、沿 +Y、长度 1、半径 1 的开口圆柱 */
export function createOracleBeamGeometry(heightSegments: number = 1): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 14, Math.max(1, heightSegments), true);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// 过载冲击环
// ---------------------------------------------------------------------------------------------

const bandVertexShader = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewPosition;
#include <fog_pars_vertex>

void main() {
  vLocal = position;
  vNormalView = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const bandFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHotColor;
uniform vec3 uGateColor;
uniform float uTime;
uniform float uOpacity;
uniform float uMode;
uniform vec4 uGaps;
uniform float uGapHalf;
uniform float uSlotHalf;
uniform float uRadius;
uniform float uHeight;
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewPosition;
#include <fog_pars_fragment>

const float PI = 3.14159265;
const float TWO_PI = 6.2831853;

void main() {
  float angle = atan(vLocal.z, vLocal.x);
  float gateDist = 1000.0;
  for (int i = 0; i < ${ORACLE_BAND_MAX_GAPS}; i++) {
    float g = uGaps[i];
    if (g > 50.0) continue;
    float d = abs(mod(angle - g + PI, TWO_PI) - PI);
    if (d < uGapHalf) discard;
    gateDist = min(gateDist, d - uGapHalf);
  }
  float ay = abs(vLocal.y);
  if (uSlotHalf > 0.0 && ay < uSlotHalf) discard;

  // 上下沿 / 安全槽沿：按米计宽度，远近一致
  float rimMeters = 2.2;
  float rim = exp(-(0.5 - ay) * uHeight / rimMeters);
  if (uSlotHalf > 0.0) rim = max(rim, exp(-(ay - uSlotHalf) * uHeight / rimMeters));
  // 缺口两侧的“门柱”
  float gate = exp(-gateDist * uRadius / 2.6);

  float facing = abs(dot(normalize(vNormalView), normalize(-vViewPosition)));
  float silhouette = pow(1.0 - facing, 2.0);
  float streak = 0.5 + 0.5 * sin(angle * 140.0 + vLocal.y * 9.0 - uTime * 9.0)
    * sin(angle * 53.0 + uTime * 2.7);
  vec3 rgb;
  if (uMode < 0.5) {
    float body = 0.2 + 0.2 * streak + 0.4 * silhouette;
    rgb = uColor * body + uHotColor * rim * 1.15 + uGateColor * gate * 1.5;
  } else {
    float pulse = 0.55 + 0.45 * sin(uTime * 13.0);
    rgb = uColor * (0.08 + 0.22 * silhouette) + (uHotColor * rim + uGateColor * gate * 1.4) * pulse;
  }
  rgb *= uOpacity;
  if (max(rgb.r, max(rgb.g, rgb.b)) < 0.002) discard;
  gl_FragColor = vec4(rgb, 1.0);
  ${FOG_FRAGMENT_ADDITIVE}
}
`;

export interface OracleBandUniforms {
  [uniform: string]: THREE.IUniform;
  uColor: THREE.IUniform<THREE.Color>;
  uHotColor: THREE.IUniform<THREE.Color>;
  uGateColor: THREE.IUniform<THREE.Color>;
  uTime: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uMode: THREE.IUniform<number>;
  uGaps: THREE.IUniform<THREE.Vector4>;
  uGapHalf: THREE.IUniform<number>;
  uSlotHalf: THREE.IUniform<number>;
  uRadius: THREE.IUniform<number>;
  uHeight: THREE.IUniform<number>;
}

export type OracleBandMaterial = THREE.ShaderMaterial & { uniforms: OracleBandUniforms };

export function createOracleBandMaterial(
  color: number,
  hotColor: number,
  gateColor: number
): OracleBandMaterial {
  const uniforms: OracleBandUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: new THREE.Color(color) },
    uHotColor: { value: new THREE.Color(hotColor) },
    uGateColor: { value: new THREE.Color(gateColor) },
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uMode: { value: 0 },
    uGaps: {
      value: new THREE.Vector4(
        ORACLE_BAND_UNUSED_GAP,
        ORACLE_BAND_UNUSED_GAP,
        ORACLE_BAND_UNUSED_GAP,
        ORACLE_BAND_UNUSED_GAP
      ),
    },
    uGapHalf: { value: 0 },
    uSlotHalf: { value: 0 },
    uRadius: { value: 1 },
    uHeight: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'OracleOverloadBand',
    uniforms,
    vertexShader: bandVertexShader,
    fragmentShader: bandFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  return material as OracleBandMaterial;
}
