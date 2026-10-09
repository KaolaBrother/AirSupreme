/**
 * 天梯之巅（平流层）材质：
 * - createCloudDeckMaterial：云海甲板 / 远方积雨云塔的柔光着色（包裹漫反射、云谷遮蔽、
 *   逆光银边、朝向落日方向的“燃烧”暖色、随风漂移的云影与微起伏、云层内部闪电辉光）；
 * - createMistMaterial：贴着云顶随风流淌的薄雾（透明）；
 * - createNoctilucentMaterial：高空夜光云——近太空的银蓝色细丝（加色）；
 * - createLimbMaterial：地平线处的大气边缘光带（跟随视点的圆筒，加色）。
 * 所有材质参与雾效（夜光云 / 边缘光除外）；透明层遵循 renderOrder 0 / depthTest / 不写深度。
 */
import * as THREE from 'three';
import { GLSL_NOISE } from './envKit';

const DECK_VERTEX = /* glsl */ `
  uniform float uWaterY;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vLocal;
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vLocal = world.y - uWaterY;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const DECK_FRAGMENT = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uLit;
  uniform vec3 uShade;
  uniform vec3 uDeep;
  uniform vec3 uRim;
  uniform vec3 uFlashColor;
  uniform float uTime;
  uniform float uAoBase;
  uniform float uAoRange;
  uniform vec2 uWind;
  uniform vec4 uFlashA;
  uniform vec4 uFlashB;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vLocal;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  float deckPuffs(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float sum = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 r = g + envHash22(i + g) - f;
        sum += exp(-5.0 * dot(r, r)) * (0.6 + 0.4 * envHash12(i + g + 17.0));
      }
    }
    return sum;
  }
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 L = normalize(uSunDir);
    vec2 p = vWorld.xz - uWind * uTime;
    // 菜花状小云包：随机点上的高斯团块之和（无折痕的圆润起伏），用其梯度扰动法线
    float bumpFade = 1.0 - smoothstep(600.0, 1900.0, length(vWorld - cameraPosition));
    vec2 q = p * 0.03;
    vec2 qb = p * 0.0135 + 3.7;
    float h0 = deckPuffs(q) + 0.8 * deckPuffs(qb);
    float hx = deckPuffs(q + vec2(0.1, 0.0)) + 0.8 * deckPuffs(qb + vec2(0.045, 0.0));
    float hz = deckPuffs(q + vec2(0.0, 0.1)) + 0.8 * deckPuffs(qb + vec2(0.0, 0.045));
    N = normalize(N + vec3(h0 - hx, 0.0, h0 - hz) * 2.5 * bumpFade);
    float broad = envFbm(p * 0.006);
    float ndl = dot(N, L);
    // 包裹漫反射：云体散射让背光面也透出柔光
    float wrap = clamp((ndl + 0.28) / 1.28, 0.0, 1.0);
    wrap = wrap * wrap * (3.0 - 2.0 * wrap);
    float ao = smoothstep(uAoBase, uAoBase + uAoRange, vLocal);
    float shadow = smoothstep(0.45, 0.75, envFbm(p * 0.0006 + 3.0));
    vec3 col = mix(uShade, uLit, wrap);
    col *= (0.92 + 0.06 * min(h0, 1.6)) * (0.92 + 0.16 * broad) * (1.0 - 0.15 * shadow);
    // 云谷：越低越暗、越偏蓝紫
    col = mix(uDeep, col, smoothstep(0.0, 0.85, ao * 0.75 + wrap * 0.35));
    // 逆光银边与顶光高光
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    float backlit = pow(max(dot(-V, L), 0.0), 3.0);
    col += uRim * rim * (0.18 + 1.1 * backlit) * (0.35 + 0.65 * wrap);
    col += uSunColor * pow(max(ndl, 0.0), 6.0) * 0.16;
    // 朝向落日的方向：整片云海被“点燃”
    vec2 toFrag = normalize(vWorld.xz - cameraPosition.xz + vec2(1e-3));
    float sunward = pow(max(dot(toFrag, normalize(L.xz + vec2(1e-4))), 0.0), 3.0);
    col = mix(col, col * uSunColor * 1.35, sunward * 0.4 * (0.4 + 0.6 * wrap));
    // 云层内部的闪电：从云谷深处透出的冷白辉光
    float fa = uFlashA.w * exp(-pow(length(vWorld - uFlashA.xyz) / 240.0, 2.0));
    float fb = uFlashB.w * exp(-pow(length(vWorld - uFlashB.xyz) / 180.0, 2.0));
    col += uFlashColor * (fa + fb) * (1.3 - 0.6 * ao);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface CloudDeckUniforms {
  uTime: { value: number };
  uFlashA: { value: THREE.Vector4 };
  uFlashB: { value: THREE.Vector4 };
}

export interface CloudDeckOptions {
  waterY: number;
  sunDirection: THREE.Vector3;
  lit: THREE.ColorRepresentation;
  shade: THREE.ColorRepresentation;
  deep: THREE.ColorRepresentation;
  rim: THREE.ColorRepresentation;
  sun: THREE.ColorRepresentation;
  wind: THREE.Vector2;
  /** 云谷遮蔽：局部高度 aoBase → aoBase + aoRange 由暗到亮 */
  aoBase: number;
  aoRange: number;
  /** 共享的时间 / 闪电 uniform（多个材质同步） */
  shared?: CloudDeckUniforms;
}

export function createCloudDeckUniforms(): CloudDeckUniforms {
  return {
    uTime: { value: 0 },
    uFlashA: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFlashB: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
}

export function createCloudDeckMaterial(options: CloudDeckOptions): THREE.ShaderMaterial {
  const shared = options.shared ?? createCloudDeckUniforms();
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uWaterY: { value: options.waterY },
      uSunDir: { value: options.sunDirection.clone().normalize() },
      uSunColor: { value: new THREE.Color(options.sun) },
      uLit: { value: new THREE.Color(options.lit) },
      uShade: { value: new THREE.Color(options.shade) },
      uDeep: { value: new THREE.Color(options.deep) },
      uRim: { value: new THREE.Color(options.rim) },
      uFlashColor: { value: new THREE.Color(0xd8ccff).multiplyScalar(1.6) },
      uAoBase: { value: options.aoBase },
      uAoRange: { value: options.aoRange },
      uWind: { value: options.wind.clone() },
    },
  ]);
  uniforms.uTime = shared.uTime;
  uniforms.uFlashA = shared.uFlashA;
  uniforms.uFlashB = shared.uFlashB;
  const material = new THREE.ShaderMaterial({
    vertexShader: DECK_VERTEX,
    fragmentShader: DECK_FRAGMENT,
    uniforms,
    fog: true,
  });
  material.name = 'stratosphereCloudDeck';
  return material;
}

/* ------------------------------------------------------------------ */
/* 云顶薄雾                                                            */
/* ------------------------------------------------------------------ */

const MIST_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const MIST_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main() {
    vec2 p = vWorld.xz - uWind * uTime;
    vec2 warp = vec2(envFbm(p * 0.0016 + 1.7), envFbm(p * 0.0016 - 4.1));
    float wisps = envFbm(p * vec2(0.0028, 0.0045) + warp * 2.0);
    float alpha = smoothstep(0.48, 0.8, wisps) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.92 + 0.16 * wisps), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createMistMaterial(
  time: { value: number },
  wind: THREE.Vector2,
  color: THREE.ColorRepresentation,
  opacity: number
): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uWind: { value: wind.clone() },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
  ]);
  uniforms.uTime = time;
  const material = new THREE.ShaderMaterial({
    vertexShader: MIST_VERTEX,
    fragmentShader: MIST_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    side: THREE.DoubleSide,
  });
  material.name = 'stratosphereMist';
  return material;
}

/* ------------------------------------------------------------------ */
/* 夜光云                                                              */
/* ------------------------------------------------------------------ */

const NLC_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec3 uFocus;
  varying vec3 vWorld;
  ${GLSL_NOISE}
  void main() {
    vec2 p = vWorld.xz * 0.00045 + vec2(uTime * 0.0015, 0.0);
    // 平行的波状细带 + 垂直方向的细密波纹（夜光云典型的“鱼骨”纹理）
    float warp = envNoise(p * 1.6) * 0.8;
    float bands = abs(sin((p.y + warp * 0.32) * 28.0 + envNoise(p * 3.0) * 1.1));
    float ripple = 0.78 + 0.22 * sin(p.x * 150.0 + p.y * 34.0);
    float ridge = pow(1.0 - bands, 5.0) * ripple;
    float patches = smoothstep(0.48, 0.82, envFbm(p * 1.1 + 7.0));
    float fade = 1.0 - smoothstep(2500.0, 6000.0, length(vWorld.xz - uFocus.xz));
    float alpha = ridge * patches * fade * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createNoctilucentMaterial(
  time: { value: number },
  focus: THREE.Vector3,
  color: THREE.ColorRepresentation
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: MIST_VERTEX.replace('#include <fog_pars_vertex>', '').replace(
      '#include <fog_vertex>',
      ''
    ),
    fragmentShader: NLC_FRAGMENT,
    uniforms: {
      uTime: time,
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.42 },
      uFocus: { value: focus },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  material.name = 'stratosphereNoctilucent';
  return material;
}

/* ------------------------------------------------------------------ */
/* 大气边缘光带                                                        */
/* ------------------------------------------------------------------ */

const LIMB_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vDir = normalize(position.xyz * vec3(1.0, 0.0, 1.0) + vec3(1e-4, 0.0, 0.0));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const LIMB_FRAGMENT = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform vec3 uSunDir;
  uniform float uBandY;
  uniform float uBandWidth;
  uniform float uGlowHeight;
  uniform float uIntensity;
  varying vec3 vWorld;
  varying vec3 vDir;
  void main() {
    float y = vWorld.y - uBandY;
    float band = exp(-pow(y / uBandWidth, 2.0));
    float glow = y > 0.0 ? exp(-y / uGlowHeight) : exp(y / (uBandWidth * 1.5));
    float sunward = pow(max(dot(vDir.xz, normalize(uSunDir.xz + vec2(1e-4))), 0.0), 2.0);
    vec3 col = mix(uCool, uWarm, sunward);
    float alpha = (band * 0.9 + glow * 0.35) * uIntensity * (0.75 + 0.5 * sunward);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createLimbMaterial(options: {
  sunDirection: THREE.Vector3;
  cool: THREE.ColorRepresentation;
  warm: THREE.ColorRepresentation;
  bandY: number;
}): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: LIMB_VERTEX,
    fragmentShader: LIMB_FRAGMENT,
    uniforms: {
      uCool: { value: new THREE.Color(options.cool) },
      uWarm: { value: new THREE.Color(options.warm) },
      uSunDir: { value: options.sunDirection.clone().normalize() },
      uBandY: { value: options.bandY },
      uBandWidth: { value: 26 },
      uGlowHeight: { value: 200 },
      uIntensity: { value: 0.42 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
  material.name = 'stratosphereLimb';
  return material;
}
