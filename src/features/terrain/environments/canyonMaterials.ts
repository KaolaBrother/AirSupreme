/**
 * 雷鸣峡谷材质：
 * - createStrataMaterial：层理砂岩（世界高度驱动的色带 + 地层倾角 + 细层理 + 崖面沙漠漆条纹 +
 *   台面风沙 + 雨水打湿的暗色与高光）；地形、孤丘、石柱共用（支持实例化）。
 * - createRiverMaterial：暴雨泥流河（沿河流动的泥浆、浪花条纹、雨点涟漪、闪电映照）。
 * - createWaterfallMaterial：沿崖壁台阶倾泻的暴雨瀑布（向下流动的白色水纹）。
 * - createStormCeilingMaterial：低垂的雷暴云底（漂移的云絮明暗 + 局部闪电照亮）。
 * - createRainShaftMaterial：远处悬垂的雨幕（竖向雨纹向下滚动）。
 * - createRoadMaterial：谷底车队土路（车辙 + 积水坑）。
 * 所有函数在导入时不访问 document / window；透明材质遵循 renderOrder 0 / depthTest / 不写深度。
 */
import * as THREE from 'three';
import type { SceneDesignTokens } from '../LevelConfig';
import { GLSL_NOISE } from './envKit';

/** 局部闪电照亮（雷击时由环境写入） */
export interface CanyonFlashUniforms {
  /** 闪光强度 0..1 */
  uFlash: { value: number };
  /** 闪光中心（世界坐标） */
  uFlashPos: { value: THREE.Vector3 };
}

export function createFlashUniforms(): CanyonFlashUniforms {
  return { uFlash: { value: 0 }, uFlashPos: { value: new THREE.Vector3() } };
}

/* ------------------------------------------------------------------ */
/* 层理砂岩                                                            */
/* ------------------------------------------------------------------ */

export interface StrataMaterialOptions {
  tokens: SceneDesignTokens;
  waterY: number;
  cacheKey: string;
}

export function createStrataMaterial(options: StrataMaterialOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const tokens = options.tokens;
  const uniforms = {
    uStrataWaterY: { value: options.waterY },
    uStrataBase: {
      value: new THREE.Color(tokens.terrainSecondary).lerp(new THREE.Color(0xb27050), 0.66),
    },
    uStrataShale: { value: new THREE.Color(0x92736c) },
    uStrataRed: { value: new THREE.Color(tokens.terrainPrimary).multiplyScalar(0.92) },
    uStrataOrange: { value: new THREE.Color(0xb9603a) },
    uStrataCream: {
      value: new THREE.Color(tokens.terrainAccent).lerp(new THREE.Color(0xe6cba6), 0.55),
    },
    uStrataCap: { value: new THREE.Color(0xb49a7c) },
    uStrataPlateau: { value: new THREE.Color(0x8f5f44) },
    uStrataHigh: { value: new THREE.Color(0xcdb796) },
    uStrataSand: { value: new THREE.Color(0xb98a62) },
    uStrataScrub: { value: new THREE.Color(tokens.vegetation) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vStrataWorld;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 strataWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            strataWorld = instanceMatrix * strataWorld;
          #endif
          vStrataWorld = (modelMatrix * strataWorld).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uStrataWaterY;
        uniform vec3 uStrataBase;
        uniform vec3 uStrataShale;
        uniform vec3 uStrataRed;
        uniform vec3 uStrataOrange;
        uniform vec3 uStrataCream;
        uniform vec3 uStrataCap;
        uniform vec3 uStrataPlateau;
        uniform vec3 uStrataHigh;
        uniform vec3 uStrataSand;
        uniform vec3 uStrataScrub;
        varying vec3 vStrataWorld;
        ${GLSL_NOISE}
        vec3 strataBands(float s) {
          vec3 c = uStrataBase;
          c = mix(c, uStrataShale, smoothstep(13.0, 15.5, s));
          c = mix(c, uStrataRed, smoothstep(43.0, 45.5, s));
          c = mix(c, uStrataOrange, smoothstep(79.0, 81.5, s));
          // 橙红砂岩中夹深红薄层
          c = mix(c, uStrataRed * 0.86, smoothstep(93.0, 94.5, s) * (1.0 - smoothstep(98.0, 99.5, s)));
          c = mix(c, uStrataCream, smoothstep(111.0, 113.5, s));
          c = mix(c, uStrataCap, smoothstep(131.0, 133.5, s));
          c = mix(c, uStrataPlateau, smoothstep(151.0, 157.0, s));
          c = mix(c, uStrataRed * 1.05, smoothstep(176.0, 178.0, s) * (1.0 - smoothstep(196.0, 198.0, s)));
          c = mix(c, uStrataHigh, smoothstep(197.0, 199.5, s));
          return c;
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 strataWp = vStrataWorld;
        vec3 strataN = normalize(cross(dFdx(strataWp), dFdy(strataWp)));
        float strataUp = abs(strataN.y);
        float strataLocal = strataWp.y - uStrataWaterY;
        // 地层倾角 + 低频翘曲：层理线既非水平也不完全平直
        float strataWarp = envNoise(strataWp.xz * 0.0035) * 10.0 + envNoise(strataWp.xz * 0.02) * 2.2;
        float strataS = strataLocal + strataWarp + strataWp.x * 0.006 - strataWp.z * 0.004;
        vec3 strataCol = strataBands(strataS);
        // 细层理 + 每隔约 11 米一道硬层突出形成的暗色檐线
        float strataBed = sin(strataS * 2.3 + envNoise(strataWp.xz * 0.06) * 2.5);
        strataCol *= 0.93 + 0.07 * strataBed;
        float strataSteep = 1.0 - smoothstep(0.5, 0.82, strataUp);
        float strataFlat = smoothstep(0.78, 0.96, strataUp);
        float strataLedge = smoothstep(0.86, 0.98, sin(strataS * 0.57 + envNoise(strataWp.xz * 0.01) * 3.0));
        strataCol *= 1.0 - strataLedge * strataSteep * 0.32;
        // 崖面：竖向沙漠漆 / 雨水冲刷条纹 + 斑驳风化
        float strataStreak = envNoise(vec2(dot(strataWp.xz, vec2(0.13, 0.11)), strataWp.y * 0.012));
        float strataBlotch = envNoise(vec2(dot(strataWp.xz, vec2(0.05, -0.04)), strataWp.y * 0.05) + 11.0);
        strataCol *= mix(1.0, (0.68 + 0.32 * strataStreak) * (0.86 + 0.28 * strataBlotch), strataSteep * 0.9);
        // 台面：风沙覆盖 + 零星灌丛暗斑 + 节理裂缝与积水坑（台地 / 台阶）
        float strataHigh = smoothstep(18.0, 40.0, strataLocal);
        float strataScrub = smoothstep(0.55, 0.85, envNoise(strataWp.xz * 0.05 + 3.0));
        strataCol = mix(strataCol, uStrataSand, strataFlat * 0.3 * strataHigh);
        strataCol = mix(strataCol, uStrataScrub, strataFlat * strataScrub * 0.3 * strataHigh);
        // 节理：只在成片的裸岩区出现的细裂缝；积水坑稀疏且小
        vec2 strataJoint = envCells(strataWp.xz * vec2(0.03, 0.045) + envNoise(strataWp.xz * 0.012) * 0.8);
        float strataBare = smoothstep(0.5, 0.75, envNoise(strataWp.xz * 0.004 + 21.0));
        float strataCrack = (1.0 - smoothstep(0.0, 0.035, strataJoint.y)) * strataFlat * strataHigh * strataBare;
        float strataPool = (1.0 - smoothstep(0.06, 0.1, strataJoint.x)) * strataFlat * strataHigh
          * step(0.9, envHash12(floor(strataWp.xz * vec2(0.03, 0.045) + 0.5)));
        strataCol *= 1.0 - strataCrack * 0.22;
        // 谷底：冲积沙洲（较亮）与湿泥（较暗）
        float strataLow = 1.0 - smoothstep(10.0, 22.0, strataLocal);
        float strataBar = smoothstep(0.35, 0.75, envNoise(strataWp.xz * vec2(0.012, 0.006)));
        float strataGravel = envNoise(strataWp.xz * 0.35);
        strataCol *= mix(1.0, (0.78 + 0.36 * strataBar) * (0.9 + 0.2 * strataGravel), strataLow * strataFlat);
        // 雨水：谷底与崖面径流打湿 → 更暗、更亮泽；积水坑映出天光
        float strataWet = strataLow * (1.0 - strataBar) * 0.35
          + strataSteep * smoothstep(0.62, 0.92, strataStreak) * 0.35
          + strataFlat * smoothstep(0.7, 0.9, envNoise(strataWp.xz * 0.03 - 7.0)) * 0.25
          + strataPool;
        strataWet = clamp(strataWet, 0.0, 1.0);
        strataCol *= 1.0 - strataWet * 0.3;
        strataCol = mix(strataCol, vec3(0.06, 0.07, 0.09), strataPool * 0.75);
        diffuseColor.rgb *= strataCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32, strataWet);
        roughnessFactor = mix(roughnessFactor, 0.06, strataPool);`
      );
  };
  material.customProgramCacheKey = () => `canyon-strata:${options.cacheKey}`;
  return material;
}

/* ------------------------------------------------------------------ */
/* 泥流河                                                              */
/* ------------------------------------------------------------------ */

const RIVER_VERTEX = /* glsl */ `
  attribute float aEdge;
  varying vec2 vFlowUv;
  varying float vEdge;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vFlowUv = uv;
    vEdge = aEdge;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const RIVER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSky;
  uniform float uFlash;
  uniform vec3 uFlashPos;
  varying vec2 vFlowUv;
  varying float vEdge;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main() {
    vec2 flow = vec2(vFlowUv.x, vFlowUv.y - uTime * uSpeed);
    float turb = envFbm(flow * vec2(0.08, 0.035) + vec2(0.0, uTime * 0.04));
    float streak = envNoise(vec2(flow.x * 0.5 + turb * 1.3, flow.y * 0.016));
    float fine = envNoise(vec2(flow.x * 1.4 + turb, flow.y * 0.05));
    float churn = envNoise(flow * 0.18 + turb * 2.0);
    float center = smoothstep(0.0, 0.85, vEdge);
    vec3 col = mix(uShallow, uDeep, center);
    col *= 0.84 + 0.28 * turb;
    // 浪花条纹：顺流拉长的细白纹，急流中线最密；岸边泡沫带
    float foam = smoothstep(0.7, 0.95, streak * 0.7 + fine * 0.35) * (0.3 + 0.7 * center);
    foam += smoothstep(0.2, 0.0, vEdge) * smoothstep(0.5, 0.85, churn) * 0.6;
    // 雨点涟漪：网格中随机相位的扩散圆环
    vec2 cellId = floor(vWorld.xz * 0.35);
    vec2 cellUv = fract(vWorld.xz * 0.35) - 0.5;
    float phase = fract(uTime * 1.3 + envHash12(cellId) * 7.0);
    float ring = abs(length(cellUv) - phase * 0.45);
    float ripple = (1.0 - smoothstep(0.0, 0.035, ring)) * (1.0 - phase) * step(0.55, envHash12(cellId + 3.1));
    vec3 V = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
    col = mix(col, uSky, fresnel * 0.38);
    col = mix(col, uFoam, clamp(foam, 0.0, 0.9));
    col += uFoam * ripple * 0.25;
    // 闪电映照：整片河面短暂发白 + 落雷点附近更亮
    float flashNear = exp(-length(vWorld - uFlashPos) * 0.0016);
    col += vec3(0.75, 0.82, 1.0) * uFlash * (0.12 + 0.5 * flashNear) * (0.5 + fresnel);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createRiverMaterial(
  flash: CanyonFlashUniforms
): THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } } {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSpeed: { value: 3.4 },
      uDeep: { value: new THREE.Color(0x3c2820) },
      uShallow: { value: new THREE.Color(0x6e4634) },
      uFoam: { value: new THREE.Color(0xcfc6bc) },
      uSky: { value: new THREE.Color(0x585e6c) },
    },
  ]);
  // 闪电 uniform 与环境共享同一对象（每帧只写一次）
  uniforms.uFlash = flash.uFlash;
  uniforms.uFlashPos = flash.uFlashPos;
  const material = new THREE.ShaderMaterial({
    vertexShader: RIVER_VERTEX,
    fragmentShader: RIVER_FRAGMENT,
    uniforms,
    fog: true,
  });
  material.name = 'canyonRiver';
  return material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } };
}

/* ------------------------------------------------------------------ */
/* 暴雨瀑布                                                            */
/* ------------------------------------------------------------------ */

const FALL_VERTEX = /* glsl */ `
  attribute float aEdge;
  attribute float aDrop;
  varying vec2 vUv;
  varying float vEdge;
  varying float vDrop;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vEdge = aEdge;
    vDrop = aDrop;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FALL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWater;
  uniform vec3 uFoam;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vEdge;
  varying float vDrop;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main() {
    // uv.x = 横向米，uv.y = 自崖顶沿剖面向下的米数
    float speed = mix(2.5, 11.0, vDrop);
    float streak = envNoise(vec2(vUv.x * 0.55, vUv.y * 0.07 - uTime * speed * 0.07));
    float fine = envNoise(vec2(vUv.x * 1.7, vUv.y * 0.22 - uTime * speed * 0.2));
    float body = 0.4 + 0.6 * streak;
    float sides = smoothstep(0.0, 0.35, vEdge);
    float top = smoothstep(0.0, 3.0, vUv.y);
    float alpha = body * sides * top * uOpacity;
    alpha *= 0.55 + 0.45 * fine;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth * 0.6);
      #endif
    #endif
    if (alpha < 0.01) discard;
    vec3 col = mix(uWater, uFoam, smoothstep(0.35, 0.85, streak * 0.7 + fine * 0.4) * (0.5 + 0.5 * vDrop));
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createWaterfallMaterial(): THREE.ShaderMaterial & {
  uniforms: { uTime: { value: number } };
} {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uWater: { value: new THREE.Color(0x9a7258) },
      uFoam: { value: new THREE.Color(0xf0ebe4) },
      uOpacity: { value: 0.88 },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: FALL_VERTEX,
    fragmentShader: FALL_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    side: THREE.DoubleSide,
  });
  material.name = 'canyonWaterfall';
  return material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } };
}

/* ------------------------------------------------------------------ */
/* 雷暴云底                                                            */
/* ------------------------------------------------------------------ */

export function createStormCeilingMaterial(
  flash: CanyonFlashUniforms,
  time: { value: number },
  wind: THREE.Vector2,
  dark: THREE.ColorRepresentation,
  light: THREE.ColorRepresentation
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const uniforms = {
    uCeilTime: time,
    uCeilWind: { value: wind.clone() },
    uCeilDark: { value: new THREE.Color(dark) },
    uCeilLight: { value: new THREE.Color(light) },
    uCeilFlash: flash.uFlash,
    uCeilFlashPos: flash.uFlashPos,
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCeilWorld;`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vCeilWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uCeilTime;
        uniform vec2 uCeilWind;
        uniform vec3 uCeilDark;
        uniform vec3 uCeilLight;
        uniform float uCeilFlash;
        uniform vec3 uCeilFlashPos;
        varying vec3 vCeilWorld;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 ceilP = vCeilWorld.xz * 0.0011 - uCeilWind * uCeilTime * 0.0011;
        vec2 ceilWarp = vec2(envFbm(ceilP * 1.7 + 4.0), envFbm(ceilP * 1.7 - 2.0));
        float ceilBillow = envFbm(ceilP * 2.2 + ceilWarp * 1.6);
        float ceilFine = envNoise(vCeilWorld.xz * 0.012 - uCeilWind * uCeilTime * 0.012);
        // 云底的乳状翻涌：暗色团块之间透出稍亮的缝隙
        float ceilShape = smoothstep(0.28, 0.78, ceilBillow) * 0.85 + ceilFine * 0.15;
        diffuseColor.rgb *= mix(uCeilDark, uCeilLight, ceilShape);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float ceilDist = length(vCeilWorld.xz - uCeilFlashPos.xz);
          float ceilGlow = exp(-ceilDist * 0.0022) * uCeilFlash;
          totalEmissiveRadiance += vec3(0.62, 0.7, 1.0) * ceilGlow * (0.5 + 0.9 * ceilShape) * 1.6;
          totalEmissiveRadiance += uCeilLight * 0.05 * ceilShape;
        }`
      );
  };
  material.customProgramCacheKey = () => 'canyon-storm-ceiling';
  return material;
}

/* ------------------------------------------------------------------ */
/* 远处雨幕                                                            */
/* ------------------------------------------------------------------ */

const RAIN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying float vSeed;
  attribute float aSeed;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vSeed;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main() {
    float streaks = envNoise(vec2(vUv.x * 150.0 + vSeed * 13.0, vUv.y * 4.0 + uTime * 1.6));
    float sheets = envFbm(vec2(vUv.x * 4.0 + vSeed * 3.0 - uTime * 0.04, vUv.y * 1.2 + uTime * 0.02));
    float sides = smoothstep(0.0, 0.32, vUv.x) * (1.0 - smoothstep(0.68, 1.0, vUv.x));
    float vertical = smoothstep(0.0, 0.3, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y) * 0.75);
    float alpha = (0.6 + 0.4 * streaks) * smoothstep(0.25, 0.75, sheets) * sides * vertical * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.85 + 0.3 * streaks), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createRainShaftMaterial(
  color: THREE.ColorRepresentation
): THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } } {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.26 },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERTEX,
    fragmentShader: RAIN_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    side: THREE.DoubleSide,
  });
  material.name = 'canyonRainShafts';
  return material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } };
}

/* ------------------------------------------------------------------ */
/* 车队土路                                                            */
/* ------------------------------------------------------------------ */

export function createRoadMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec2 vRoadUv;\nvarying vec3 vRoadWorld;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vRoadUv = uv;
        vRoadWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vRoadUv;
        varying vec3 vRoadWorld;
        float roadWet = 0.0;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // uv.x：0..1 横向；uv.y：沿路米数
          float lane = abs(vRoadUv.x - 0.5) * 2.0;
          float ruts = smoothstep(0.08, 0.0, abs(lane - 0.45)) * 0.35;
          float gravel = envNoise(vRoadWorld.xz * 0.6) * 0.12;
          float puddle = smoothstep(0.62, 0.72, envNoise(vec2(vRoadUv.x * 3.0, vRoadUv.y * 0.08)));
          roadWet = max(puddle, ruts * 0.8);
          diffuseColor.rgb *= (1.0 - ruts) * (0.94 + gravel) * (1.0 - puddle * 0.45);
          diffuseColor.rgb *= 0.85 + 0.15 * smoothstep(1.0, 0.7, lane);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.12, roadWet);`
      );
  };
  material.customProgramCacheKey = () => 'canyon-road';
  return material;
}
