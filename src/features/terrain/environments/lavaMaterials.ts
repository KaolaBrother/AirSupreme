/**
 * 熔岩着色：
 * - createLavaMaterial：熔岩河 / 熔岩湖的流动自发光材质（冷却外壳板块 + 发光裂缝 + 炽热主流道），
 *   不透明、参与雾效、经过色调映射与输出色彩空间转换（与标准材质一致）。
 * - injectLavaCracks：给玄武岩地形的 MeshStandardMaterial 注入发光裂纹与暖色底光，
 *   强度由逐顶点 aHeat 属性控制（熔岩河岸、湖畔、火山口最强）。
 * - createGlowCards：静态加色公告板辉光（炉口、火山口、熔岩湖上方的热辉），GPU 闪烁。
 */
import * as THREE from 'three';
import { GLSL_NOISE } from './envKit';

export interface LavaUniforms {
  uTime: { value: number };
  [key: string]: { value: unknown };
}

const LAVA_VERTEX = /* glsl */ `
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

const LAVA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uGlow;
  uniform vec3 uHot;
  uniform vec3 uWarm;
  uniform vec3 uCrust;
  varying vec2 vFlowUv;
  varying float vEdge;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main() {
    vec2 flow = vec2(vFlowUv.x, vFlowUv.y - uTime * uFlowSpeed);
    vec2 warp = vec2(envFbm(flow * 0.018 + uTime * 0.03), envFbm(flow * 0.018 - 3.7));
    vec2 cells = envCells((flow + warp * 18.0) * 0.05);
    float crack = 1.0 - smoothstep(0.03, 0.17, cells.y);
    float churn = envFbm(flow * 0.035 + vec2(uTime * 0.11, -uTime * 0.07));
    float channel = smoothstep(0.35, 1.0, vEdge);
    float heat = max(crack * (0.55 + 0.45 * channel), channel * smoothstep(0.35, 0.8, churn));
    heat = max(heat, 0.18 + 0.2 * churn);
    float pulse = 0.82 + 0.18 * sin(uTime * 1.6 + churn * 7.0 + vWorld.x * 0.01);
    heat *= pulse;
    // 岸边冷却：外壳更厚、更暗
    heat *= mix(0.55, 1.0, smoothstep(0.0, 0.45, vEdge));
    vec3 col = mix(uCrust, uWarm, smoothstep(0.18, 0.62, heat));
    col = mix(col, uHot, smoothstep(0.62, 1.0, heat));
    gl_FragColor = vec4(col * uGlow, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface LavaMaterialOptions {
  /** 流速（米/秒，沿 uv.y） */
  flowSpeed: number;
  glow?: number;
  hot?: THREE.ColorRepresentation;
  warm?: THREE.ColorRepresentation;
  crust?: THREE.ColorRepresentation;
}

/** 流动熔岩材质：几何体需提供 uv（x = 横向米，y = 沿流向米）与 aEdge（岸 0 → 中线 1） */
export function createLavaMaterial(options: LavaMaterialOptions): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uFlowSpeed: { value: options.flowSpeed },
      uGlow: { value: options.glow ?? 1 },
      // HDR：炽热主流道 > 1，经色调映射后呈现黄白高光，为泛光留出余量
      uHot: { value: new THREE.Color(options.hot ?? 0xffd27a).multiplyScalar(2.6) },
      uWarm: { value: new THREE.Color(options.warm ?? 0xff4a0c).multiplyScalar(1.6) },
      uCrust: { value: new THREE.Color(options.crust ?? 0x1a0b08) },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: LAVA_VERTEX,
    fragmentShader: LAVA_FRAGMENT,
    uniforms,
    fog: true,
  });
  material.name = 'lavaFlow';
  return material;
}

/**
 * 玄武岩地形发光裂纹：几何体需提供 aHeat（0..1）。
 * timeUniform 由环境每帧推进；customProgramCacheKey 隔离编译程序。
 */
export function injectLavaCracks(
  material: THREE.MeshStandardMaterial,
  timeUniform: { value: number },
  crackColor: THREE.ColorRepresentation
): void {
  const color = new THREE.Color(crackColor);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLavaTime = timeUniform;
    shader.uniforms.uCrackColor = { value: color };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aHeat;
        varying float vLavaHeat;
        varying vec3 vLavaWorld;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vLavaHeat = aHeat;
        vLavaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uLavaTime;
        uniform vec3 uCrackColor;
        varying float vLavaHeat;
        varying vec3 vLavaWorld;
        ${GLSL_NOISE}`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (vLavaHeat > 0.02) {
          vec2 lavaCells = envCells(vLavaWorld.xz * 0.06);
          float crackWidth = 0.035 + 0.06 * vLavaHeat;
          float crack = 1.0 - smoothstep(0.0, crackWidth, lavaCells.y);
          float drift = envNoise(vLavaWorld.xz * 0.012 + uLavaTime * 0.05);
          float pulse = 0.7 + 0.3 * sin(uLavaTime * 1.4 + drift * 6.2831);
          float glow = crack * smoothstep(0.05, 0.9, vLavaHeat) * pulse;
          totalEmissiveRadiance += uCrackColor * (glow * 2.4 + vLavaHeat * vLavaHeat * 0.22);
        }`
      );
  };
  material.customProgramCacheKey = () => 'volcano-lava-cracks';
}

/* ------------------------------------------------------------------ */
/* 静态辉光公告板                                                      */
/* ------------------------------------------------------------------ */

export interface GlowCard {
  x: number;
  y: number;
  z: number;
  size: number;
  color: THREE.ColorRepresentation;
  /** 闪烁速度（0 = 稳定） */
  flicker?: number;
}

const GLOW_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec4 aCard; // xyz 中心, w 尺寸
  attribute vec4 aTint; // rgb 颜色, a 闪烁速度
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vPulse;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(aCard.xyz, 1.0);
    mvPosition.xy += position.xy * aCard.w;
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    vTint = aTint.rgb;
    float seed = fract(aCard.x * 0.013 + aCard.z * 0.007);
    vPulse = 0.78 + 0.22 * sin(uTime * aTint.a + seed * 40.0) * sin(uTime * aTint.a * 0.37 + seed * 11.0);
    #include <fog_vertex>
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vPulse;
  #include <fog_pars_fragment>
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = pow(max(0.0, 1.0 - d), 2.2);
    float alpha = glow * vPulse * uIntensity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(vTint * alpha, alpha);
    #include <fog_fragment>
  }
`;

/** 一次绘制的加色辉光公告板组（transparent / depthTest / 不写深度 / renderOrder 0） */
export function createGlowCards(
  cards: readonly GlowCard[],
  name: string,
  intensity = 1
): { mesh: THREE.Mesh; update(elapsed: number): void } {
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('uv', base.getAttribute('uv'));
  const count = Math.max(1, cards.length);
  const cardData = new Float32Array(count * 4);
  const tintData = new Float32Array(count * 4);
  const color = new THREE.Color();
  cards.forEach((card, i) => {
    cardData[i * 4] = card.x;
    cardData[i * 4 + 1] = card.y;
    cardData[i * 4 + 2] = card.z;
    cardData[i * 4 + 3] = card.size;
    color.set(card.color);
    tintData[i * 4] = color.r;
    tintData[i * 4 + 1] = color.g;
    tintData[i * 4 + 2] = color.b;
    tintData[i * 4 + 3] = card.flicker ?? 1.5;
  });
  geometry.setAttribute('aCard', new THREE.InstancedBufferAttribute(cardData, 4));
  geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintData, 4));
  geometry.instanceCount = cards.length;
  base.dispose();

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uTime: { value: 0 }, uIntensity: { value: intensity } },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return {
    mesh,
    update(elapsed: number) {
      uniforms.uTime.value = elapsed;
    },
  };
}
