/**
 * 神谕核心（黑曜城堡）材质——多色调、易读的调色：
 * - 黑曜石（墨紫）：冷紫蓝的掠射边缘光勾勒轮廓 + 品红电路纹（部分线段点亮、脉冲流动）；
 * - 坑底玄武岩：熔火裂纹（橙红，aHeat 驱动）+ 冲击玻璃斑（暗青、高光泽）；
 * - 能量导管：暗色玻璃槽中奔向核心的青色数据流，两侧品红能量边；
 * - 核心井：同心旋转的光环“虹膜”；核心光柱：白青色、向上奔流的脉冲；全息数据环；
 * - 探照灯光锥。
 * 透明层遵循 renderOrder 0 / depthTest / 不写深度；不透明着色器参与雾效。
 */
import * as THREE from 'three';
import { GLSL_NOISE } from './envKit';

/** 品红（神谕能量）与青（数据）两种霓虹主色 */
export const CITADEL_MAGENTA = 0xff2a7a;
export const CITADEL_CYAN = 0x38e8ff;

/* ------------------------------------------------------------------ */
/* 黑曜石                                                              */
/* ------------------------------------------------------------------ */

export interface ObsidianOptions {
  color: THREE.ColorRepresentation;
  /** 电路纹强度（0 = 无） */
  circuits: number;
  /** 镜面反射强度：掠射角映出紫罗兰夜空 / 熔岩橙色地光 */
  gloss?: number;
}

export function createObsidianMaterial(
  time: { value: number },
  options: ObsidianOptions
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: 0.34,
    metalness: 0.12,
    flatShading: true,
  });
  const sky = new THREE.Color(0x5a58b8).multiplyScalar(0.62);
  const ground = new THREE.Color(0xff6a2a).multiplyScalar(0.32);
  const trace = new THREE.Color(CITADEL_MAGENTA).multiplyScalar(1.25);
  const gloss = options.gloss ?? 1;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uObsTime = time;
    shader.uniforms.uObsSky = { value: sky };
    shader.uniforms.uObsGround = { value: ground };
    shader.uniforms.uObsTrace = { value: trace };
    shader.uniforms.uObsCircuits = { value: options.circuits };
    shader.uniforms.uObsGloss = { value: gloss };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObsWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 obsWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            obsWorld = instanceMatrix * obsWorld;
          #endif
          vObsWorld = (modelMatrix * obsWorld).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uObsTime;
        uniform vec3 uObsSky;
        uniform vec3 uObsGround;
        uniform vec3 uObsTrace;
        uniform float uObsCircuits;
        uniform float uObsGloss;
        varying vec3 vObsWorld;
        vec3 obsN;
        float obsAlong;
        float obsShade;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // 面法线（朝向相机）与立面水平切向坐标
          obsN = normalize(cross(dFdx(vObsWorld), dFdy(vObsWorld)));
          vec2 obsT = normalize(vec2(-obsN.z, obsN.x) + vec2(1e-4));
          obsAlong = dot(vObsWorld.xz, obsT);
          // 石板拼缝：7 × 4.5 米的面板，逐块明暗起伏，给巨构以尺度
          vec2 obsPanel = floor(vec2(obsAlong / 7.0, vObsWorld.y / 4.5));
          obsShade = envHash12(obsPanel + 17.0);
          float seamA = abs(fract(obsAlong / 7.0 + 0.5) - 0.5) * 7.0;
          float seamY = abs(fract(vObsWorld.y / 4.5 + 0.5) - 0.5) * 4.5;
          float seamW = 0.12 + fwidth(vObsWorld.y) * 0.8;
          float seam = 1.0 - smoothstep(seamW * 0.5, seamW, min(seamA, seamY));
          diffuseColor.rgb *= (0.8 + 0.4 * obsShade) * (1.0 - 0.5 * seam);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 obsV = normalize(cameraPosition - vObsWorld);
          float obsFacing = clamp(abs(dot(obsN, obsV)), 0.0, 1.0);
          float obsFresnel = 0.05 + 0.95 * pow(1.0 - obsFacing, 4.0);
          vec3 obsR = reflect(-obsV, obsN);
          vec3 obsRefl = mix(uObsGround, uObsSky, smoothstep(-0.3, 0.4, obsR.y));
          totalEmissiveRadiance += obsRefl * obsFresnel * uObsGloss * (0.75 + 0.5 * obsShade);
          float obsWall = 1.0 - smoothstep(0.6, 0.9, abs(obsN.y));
          // 电路走线：沿面板网格的水平走线（每 9 米一行，14 米一段）与稀疏的竖向跳线，
          // 点亮的段首尾相接成长短不一的走线；数据包沿走线流动
          float hDist = abs(fract(vObsWorld.y / 9.0 + 0.5) - 0.5) * 9.0;
          float vDist = abs(fract(obsAlong / 14.0 + 0.5) - 0.5) * 14.0;
          // 屏幕空间抗锯齿：远处线宽随像素足迹放宽并按比例减弱，避免闪烁
          float fwY = max(fwidth(vObsWorld.y), 1e-3);
          float fwA = max(fwidth(obsAlong), 1e-3);
          float hLine = (1.0 - smoothstep(0.2, 0.2 + 1.5 * fwY, hDist)) * min(1.0, 0.8 / fwY);
          float vLine = (1.0 - smoothstep(0.2, 0.2 + 1.5 * fwA, vDist)) * min(1.0, 0.8 / fwA);
          float hRow = floor(vObsWorld.y / 9.0 + 0.5);
          float hLit = step(0.62, envHash12(vec2(floor(obsAlong / 14.0), hRow) + 3.7));
          float vLit = step(0.84, envHash12(vec2(floor(obsAlong / 14.0 + 0.5), floor(vObsWorld.y / 9.0)) + 11.3));
          float packet = fract(obsAlong * 0.018 - uObsTime * 0.3 + envHash12(vec2(hRow, 1.7)));
          float flow = 0.4 + 0.6 * smoothstep(0.0, 0.04, packet) * (1.0 - smoothstep(0.04, 0.3, packet));
          float circuit = max(hLine * hLit * flow, vLine * vLit * 0.55) * obsWall;
          totalEmissiveRadiance += uObsTrace * circuit * uObsCircuits;
        }`
      );
  };
  material.customProgramCacheKey = () =>
    `citadel-obsidian:${options.circuits.toFixed(2)}:${gloss.toFixed(2)}`;
  return material;
}

/* ------------------------------------------------------------------ */
/* 内庭甲板：环绕核心的电路曼陀罗                                       */
/* ------------------------------------------------------------------ */

/**
 * 台基顶面：以核心为圆心的同心环 + 放射线拼缝（深色），部分环段点亮品红，
 * 辐条上的青色数据包向核心奔流——从空中俯瞰是一幅巨大的电路曼陀罗。
 */
export function createDeckMaterial(
  time: { value: number },
  color: THREE.ColorRepresentation,
  center: { x: number; z: number }
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.35,
  });
  const cyan = new THREE.Color(CITADEL_CYAN).multiplyScalar(1.2);
  const magenta = new THREE.Color(CITADEL_MAGENTA).multiplyScalar(0.9);
  const centerUniform = new THREE.Vector2(center.x, center.z);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDeckTime = time;
    shader.uniforms.uDeckCenter = { value: centerUniform };
    shader.uniforms.uDeckCyan = { value: cyan };
    shader.uniforms.uDeckMagenta = { value: magenta };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDeckWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vDeckWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uDeckTime;
        uniform vec2 uDeckCenter;
        uniform vec3 uDeckCyan;
        uniform vec3 uDeckMagenta;
        varying vec3 vDeckWorld;
        float deckRing;
        float deckSpoke;
        float deckRingIndex;
        float deckSpokeIndex;
        float deckRadius;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 d = vDeckWorld.xz - uDeckCenter;
          deckRadius = length(d);
          float a = atan(d.y, d.x) / 6.2831853 + 0.5;
          const float SPOKES = 48.0;
          float ringDist = abs(fract(deckRadius / 24.0 + 0.5) - 0.5) * 24.0;
          float spokeDist = abs(fract(a * SPOKES + 0.5) - 0.5) * (6.2831853 / SPOKES) * deckRadius;
          float fw = max(fwidth(deckRadius), 1e-3);
          deckRing = (1.0 - smoothstep(0.3, 0.3 + 1.5 * fw, ringDist)) * min(1.0, 1.2 / fw);
          deckSpoke = (1.0 - smoothstep(0.3, 0.3 + 1.5 * fw, spokeDist)) * min(1.0, 1.2 / fw);
          deckRingIndex = floor(deckRadius / 24.0 + 0.5);
          deckSpokeIndex = floor(a * SPOKES);
          // 拼缝更暗，面板逐块明暗
          float panel = envHash12(vec2(floor(deckRadius / 24.0), floor(a * SPOKES)) + 5.0);
          diffuseColor.rgb *= (0.82 + 0.3 * panel) * (1.0 - 0.55 * max(deckRing, deckSpoke));
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float ringLit = step(0.55, envHash12(vec2(deckRingIndex, floor(deckSpokeIndex / 3.0)) + 9.1));
          float spokeLit = step(0.5, envHash12(vec2(deckSpokeIndex, 2.3)));
          // 数据包沿辐条向核心奔流
          float packet = fract(deckRadius * 0.008 + uDeckTime * 0.45 + envHash12(vec2(deckSpokeIndex, 7.7)));
          float flow = smoothstep(0.0, 0.04, packet) * (1.0 - smoothstep(0.04, 0.22, packet));
          totalEmissiveRadiance += uDeckCyan * deckSpoke * spokeLit * (0.12 + 1.4 * flow);
          totalEmissiveRadiance += uDeckMagenta * deckRing * ringLit * (0.45 + 0.25 * sin(uDeckTime * 1.4 + deckRingIndex));
        }`
      );
  };
  material.customProgramCacheKey = () => 'citadel-deck';
  return material;
}

/** HDR 霓虹（泛光） */
export function createNeonMaterial(
  color: THREE.ColorRepresentation,
  intensity: number
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
}

/* ------------------------------------------------------------------ */
/* 坑底                                                                */
/* ------------------------------------------------------------------ */

export function createCraterGroundMaterial(time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.82,
    metalness: 0.08,
  });
  const crack = new THREE.Color(0xff4a14);
  const glass = new THREE.Color(0x0e1c22);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGroundTime = time;
    shader.uniforms.uGroundCrack = { value: crack };
    shader.uniforms.uGroundGlass = { value: glass };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aHeat;
        varying float vGroundHeat;
        varying vec3 vGroundWorld;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vGroundHeat = aHeat;
        vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uGroundTime;
        uniform vec3 uGroundCrack;
        uniform vec3 uGroundGlass;
        varying float vGroundHeat;
        varying vec3 vGroundWorld;
        float groundGlass = 0.0;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 gN = normalize(cross(dFdx(vGroundWorld), dFdy(vGroundWorld)));
          float gFlat = smoothstep(0.75, 0.95, abs(gN.y));
          float gSteep = 1.0 - smoothstep(0.35, 0.72, abs(gN.y));
          // 冲击玻璃：坑底成片的暗青色熔融玻璃
          groundGlass = smoothstep(0.55, 0.72, envFbm(vGroundWorld.xz * 0.0045 + 13.0)) * gFlat
            * (1.0 - smoothstep(-20.0, 30.0, vGroundWorld.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, uGroundGlass, groundGlass * 0.85);
          // 坑壁崖面：更深的玄武岩 + 水平熔岩层理（台阶顶面保持浅色，同心环清晰）
          float gBands = envNoise(vec2(vGroundWorld.y * 0.42, envNoise(vGroundWorld.xz * 0.015) * 2.0));
          float gLayer = smoothstep(0.35, 0.65, gBands);
          vec3 gCliff = diffuseColor.rgb * mix(vec3(0.5, 0.48, 0.58), vec3(0.78, 0.7, 0.72), gLayer);
          diffuseColor.rgb = mix(diffuseColor.rgb, gCliff, gSteep);
          // 多尺度岩面：大片火山灰斑驳 + 中尺度颗粒 + 近处细碎纹理（远处按像素足迹淡出，避免闪烁）
          float gMottle = smoothstep(0.25, 0.75, envFbm(vGroundWorld.xz * 0.0055 + 4.0));
          float gGrain = envNoise(vGroundWorld.xz * 0.08 + vGroundWorld.y * 0.05);
          float gFineFade = 1.0 - smoothstep(0.4, 1.6, length(fwidth(vGroundWorld.xz)) * 0.45);
          float gFine = (envNoise(vGroundWorld.xz * 0.45 + 2.0) - 0.5) * gFineFade;
          diffuseColor.rgb *= (0.8 + 0.4 * gMottle) * (0.88 + 0.24 * gGrain) * (1.0 + 0.3 * gFine);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.12, groundGlass);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (vGroundHeat > 0.02) {
          // 域扭曲的冷却外壳裂纹：强扭曲让胞元不规则，细线宽
          vec2 crackUv = vGroundWorld.xz * 0.12;
          crackUv += vec2(envFbm(crackUv * 0.25), envFbm(crackUv * 0.25 + 7.1)) * 2.6;
          vec2 cells = envCells(crackUv);
          float crack = 1.0 - smoothstep(0.0, 0.016 + 0.03 * vGroundHeat, cells.y);
          // 断续：低频遮罩成片 + 高频噪声打断线段，只有一部分裂纹发光（不铺满蜂窝）
          float patches = smoothstep(0.45, 0.75, envNoise(vGroundWorld.xz * 0.028 + 3.3) + vGroundHeat * 0.2);
          float broken = smoothstep(0.35, 0.65, envNoise(vGroundWorld.xz * 0.15 + 1.7));
          float pulse = 0.65 + 0.35 * sin(uGroundTime * 1.3 + envNoise(vGroundWorld.xz * 0.01) * 6.2831);
          float glow = crack * patches * broken * smoothstep(0.08, 0.95, vGroundHeat) * pulse;
          totalEmissiveRadiance += uGroundCrack * (glow * 1.8 + vGroundHeat * vGroundHeat * 0.1);
        }`
      );
  };
  material.customProgramCacheKey = () => 'citadel-crater-ground';
  return material;
}

/* ------------------------------------------------------------------ */
/* 能量导管                                                            */
/* ------------------------------------------------------------------ */

const FLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const CONDUIT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCyan;
  uniform vec3 uMagenta;
  uniform vec3 uBase;
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main() {
    // uv.x：横向 -1..1；uv.y：距核心的米数（数据流向核心方向奔流）
    float across = abs(vUv.x);
    float core = 1.0 - smoothstep(0.0, 0.18, across);
    float edge = smoothstep(0.72, 0.86, across) * (1.0 - smoothstep(0.92, 1.0, across));
    float packet = fract(vUv.y * 0.012 + uTime * 0.55);
    float pulse = smoothstep(0.0, 0.05, packet) * (1.0 - smoothstep(0.05, 0.35, packet));
    float shimmer = envNoise(vec2(vUv.x * 3.0, vUv.y * 0.08 + uTime * 2.0));
    vec3 col = uBase * (0.8 + 0.3 * shimmer);
    col += uCyan * core * (0.5 + 2.6 * pulse);
    col += uCyan * 0.18 * (1.0 - across);
    col += uMagenta * edge * (0.9 + 0.4 * sin(uTime * 3.0 + vUv.y * 0.05));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createConduitMaterial(time: { value: number }): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uCyan: { value: new THREE.Color(CITADEL_CYAN).multiplyScalar(1.3) },
      uMagenta: { value: new THREE.Color(CITADEL_MAGENTA).multiplyScalar(1.4) },
      uBase: { value: new THREE.Color(0x0c0a16) },
    },
  ]);
  uniforms.uTime = time;
  const material = new THREE.ShaderMaterial({
    vertexShader: FLOW_VERTEX,
    fragmentShader: CONDUIT_FRAGMENT,
    uniforms,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.name = 'citadelConduit';
  return material;
}

/* ------------------------------------------------------------------ */
/* 核心井虹膜                                                          */
/* ------------------------------------------------------------------ */

const IRIS_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCyan;
  uniform vec3 uMagenta;
  uniform vec3 uWhite;
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main() {
    // uv：以井心为原点的米数
    float r = length(vUv);
    float a = atan(vUv.y, vUv.x);
    vec3 col = vec3(0.02, 0.015, 0.04);
    // 同心环：交替旋转的分段光环
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float radius = 34.0 + fi * 14.0;
      float ring = 1.0 - smoothstep(0.6, 2.2, abs(r - radius));
      float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
      float segments = 6.0 + fi * 4.0;
      float seg = step(0.35, fract((a / 6.2831853) * segments + uTime * 0.05 * dir * (1.0 + fi * 0.3)));
      vec3 tint = mod(fi, 2.0) < 0.5 ? uCyan : uMagenta;
      col += tint * ring * seg * (1.1 + 0.4 * sin(uTime * 2.0 + fi));
    }
    // 径向辐条：向中心汇聚的脉冲
    float spokes = pow(abs(cos(a * 6.0)), 40.0) * smoothstep(100.0, 30.0, r);
    float inward = fract(r * 0.03 + uTime * 0.8);
    col += uCyan * spokes * smoothstep(0.0, 0.2, inward) * (1.0 - smoothstep(0.2, 0.5, inward)) * 2.0;
    // 中心辉光
    col += uWhite * smoothstep(40.0, 0.0, r) * 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createIrisMaterial(time: { value: number }): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uCyan: { value: new THREE.Color(CITADEL_CYAN).multiplyScalar(1.5) },
      uMagenta: { value: new THREE.Color(CITADEL_MAGENTA).multiplyScalar(1.5) },
      uWhite: { value: new THREE.Color(0xfff2d8).multiplyScalar(1.6) },
    },
  ]);
  uniforms.uTime = time;
  const material = new THREE.ShaderMaterial({
    vertexShader: FLOW_VERTEX,
    fragmentShader: IRIS_FRAGMENT,
    uniforms,
    fog: true,
  });
  material.name = 'citadelIris';
  return material;
}

/* ------------------------------------------------------------------ */
/* 核心光柱 / 能量馈线 / 全息环 / 探照灯（加色）                        */
/* ------------------------------------------------------------------ */

const BEAM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uFringe;
  uniform float uIntensity;
  uniform float uPulseScale;
  uniform float uPulseDepth;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vNormalW), V));
    float body = pow(facing, 1.6);
    float pulse = fract(vWorld.y * uPulseScale - uTime * 0.7);
    float wave = 1.0 - uPulseDepth
      + uPulseDepth * smoothstep(0.0, 0.08, pulse) * (1.0 - smoothstep(0.08, 0.5, pulse));
    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vWorld.y);
    vec3 col = mix(uFringe, uCore, body);
    float alpha = (0.25 + 0.75 * body) * wave * fade * uIntensity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createBeamMaterial(
  time: { value: number },
  options: {
    core: THREE.ColorRepresentation;
    fringe: THREE.ColorRepresentation;
    intensity: number;
    pulseScale: number;
    /** 脉冲调制深度（默认 0.35） */
    pulseDepth?: number;
    fadeStart: number;
    fadeEnd: number;
  }
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: BEAM_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    uniforms: {
      uTime: time,
      uCore: { value: new THREE.Color(options.core).multiplyScalar(1.6) },
      uFringe: { value: new THREE.Color(options.fringe).multiplyScalar(1.2) },
      uIntensity: { value: options.intensity },
      uPulseScale: { value: options.pulseScale },
      uPulseDepth: { value: options.pulseDepth ?? 0.35 },
      uFadeStart: { value: options.fadeStart },
      uFadeEnd: { value: options.fadeEnd },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  material.name = 'citadelBeam';
  return material;
}

const CONE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vNormalW), V));
    // uv.y：0 = 灯头，1 = 远端开口
    float along = 1.0 - smoothstep(0.1, 1.0, vUv.y);
    float alpha = pow(facing, 2.0) * along * uIntensity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSearchlightMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader: BEAM_VERTEX,
    fragmentShader: CONE_FRAGMENT,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 0.16 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  material.name = 'citadelSearchlight';
  return material;
}
