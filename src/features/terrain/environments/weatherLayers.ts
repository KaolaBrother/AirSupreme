/**
 * 新天气预设的专属天空/大气层（由 TerrainGenerator 的天气流程按预设创建）：
 * - 'ash'    → createEmberField：跟随玩家的上升余烬（叠加在常规灰烬粒子之上）
 * - 'aurora' → createAuroraBand：横跨天空、缓慢起伏的极光帘幕
 * 两者都在 GPU 上推进动画，每帧只更新少量 uniform。
 * 透明材质遵循：renderOrder 0、transparent、depthTest true、depthWrite false。
 */
import * as THREE from 'three';
import { GLSL_NOISE, mulberry32 } from './envKit';

/* ------------------------------------------------------------------ */
/* 余烬场                                                              */
/* ------------------------------------------------------------------ */

export interface EmberFieldOptions {
  count: number;
  /** 水平覆盖边长（米，以玩家为中心循环平铺） */
  extent: number;
  /** 余烬出生高度与顶部高度（世界 Y） */
  floorY: number;
  ceilingY: number;
  color: THREE.ColorRepresentation;
  hotColor?: THREE.ColorRepresentation;
  /** 上升速度（米/秒） */
  rise: number;
  wind: { x: number; z: number };
  /** 粒子世界尺寸（米） */
  size: number;
  seed?: number;
  name?: string;
}

export interface AnimatedLayer {
  object: THREE.Object3D;
  update(elapsed: number, focus: THREE.Vector3): void;
}

const EMBER_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFocus;
  uniform float uExtent;
  uniform float uFloor;
  uniform float uHeight;
  uniform float uRise;
  uniform vec2 uWind;
  uniform float uScale;
  uniform float uSize;
  attribute vec4 aSeed; // xyz 归一化初始位置, w 随机
  varying float vHeat;
  varying float vFade;
  #include <fog_pars_vertex>
  void main() {
    float speed = uRise * (0.6 + aSeed.w * 0.8);
    float travel = uTime * speed + aSeed.y * uHeight;
    float h = mod(travel, uHeight);
    vec2 drift = uWind * (h / max(speed, 0.1));
    vec2 swirl = vec2(sin(uTime * 0.9 + aSeed.w * 20.0), cos(uTime * 0.7 + aSeed.x * 17.0)) * 6.0;
    vec2 local = aSeed.xz * uExtent + drift + swirl;
    vec2 rel = mod(local - uFocus.xz + 0.5 * uExtent, uExtent) - 0.5 * uExtent;
    vec3 world = vec3(uFocus.x + rel.x, uFloor + h, uFocus.z + rel.y);
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    float life = h / uHeight;
    vFade = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life));
    vFade *= 1.0 - smoothstep(0.42, 0.5, max(abs(rel.x), abs(rel.y)) / uExtent);
    vHeat = (1.0 - life) * (0.6 + 0.4 * sin(uTime * 9.0 + aSeed.w * 40.0));
    gl_PointSize = max(1.5, uSize * (0.6 + aSeed.w * 0.8) * uScale / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const EMBER_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHotColor;
  varying float vHeat;
  varying float vFade;
  #include <fog_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float core = smoothstep(1.0, 0.0, d);
    float alpha = core * core * vFade;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        alpha *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
    #endif
    if (alpha < 0.01) discard;
    vec3 col = mix(uColor, uHotColor, clamp(vHeat, 0.0, 1.0));
    gl_FragColor = vec4(col * (0.6 + core), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** 上升余烬：以 focus 为中心循环平铺，飞到哪里都有火星在身边飘 */
export function createEmberField(options: EmberFieldOptions): AnimatedLayer {
  const rng = mulberry32(options.seed ?? 6061);
  const count = Math.max(1, Math.floor(options.count));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = rng() - 0.5;
    seeds[i * 4 + 1] = rng();
    seeds[i * 4 + 2] = rng() - 0.5;
    seeds[i * 4 + 3] = rng();
  }
  const geometry = new THREE.BufferGeometry();
  // position 只用于满足 three 的属性要求；真实位置在着色器中计算
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uFocus: { value: new THREE.Vector3() },
      uExtent: { value: options.extent },
      uFloor: { value: options.floorY },
      uHeight: { value: Math.max(10, options.ceilingY - options.floorY) },
      uRise: { value: options.rise },
      uWind: { value: new THREE.Vector2(options.wind.x, options.wind.z) },
      uScale: { value: 420 },
      uSize: { value: options.size },
      uColor: { value: new THREE.Color(options.color) },
      uHotColor: { value: new THREE.Color(options.hotColor ?? 0xffe2a0) },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: EMBER_VERTEX,
    fragmentShader: EMBER_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = options.name ?? 'weatherEmbers';
  points.frustumCulled = false;
  points.renderOrder = 0;

  return {
    object: points,
    update(elapsed: number, focus: THREE.Vector3) {
      uniforms.uTime.value = elapsed;
      if (Number.isFinite(focus.x) && Number.isFinite(focus.z)) {
        (uniforms.uFocus.value as THREE.Vector3).copy(focus);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 极光帘幕                                                            */
/* ------------------------------------------------------------------ */

export interface AuroraBandOptions {
  /** 帘幕条数 */
  ribbons: number;
  /** 帘幕所在圆弧半径（米） */
  radius: number;
  /** 底边 / 顶边世界高度 */
  baseY: number;
  height: number;
  /** 弧心方位（弧度）与张角（弧度） */
  centerAngle: number;
  span: number;
  /** 底部主色（绿）/ 中部（青）/ 顶部（品红） */
  lowColor?: THREE.ColorRepresentation;
  midColor?: THREE.ColorRepresentation;
  highColor?: THREE.ColorRepresentation;
  intensity?: number;
  segments?: number;
  seed?: number;
}

const AURORA_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec3 aRadial;
  attribute float aPhase;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vec3 p = position;
    float along = uv.x;
    float sway = sin(along * 23.0 + uTime * 0.31 + aPhase) * 0.6
      + sin(along * 9.0 - uTime * 0.17 + aPhase * 2.0) * 1.0
      + sin(along * 51.0 + uTime * 0.83) * 0.18;
    p += aRadial * sway * 70.0 * (0.35 + uv.y);
    p.y += sin(along * 14.0 + uTime * 0.23 + aPhase) * 26.0;
    vUv = uv;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const AURORA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  varying vec2 vUv;
  varying float vPhase;
  ${GLSL_NOISE}
  void main() {
    float along = vUv.x;
    float v = vUv.y;
    // 竖直光束：沿弧向高频条纹 + 缓慢游走
    float rays = envNoise(vec2(along * 260.0 + vPhase * 13.0, uTime * 0.35));
    rays = 0.35 + 0.65 * pow(rays, 1.6);
    float streak = envNoise(vec2(along * 46.0 - uTime * 0.12, vPhase));
    float curtain = smoothstep(0.0, 0.1, v) * (1.0 - smoothstep(0.42, 1.0, v));
    curtain *= 0.55 + 0.45 * streak;
    float ends = smoothstep(0.0, 0.14, along) * (1.0 - smoothstep(0.86, 1.0, along));
    float pulse = 0.82 + 0.18 * sin(uTime * 0.6 + along * 9.0 + vPhase);
    vec3 col = mix(uLow, uMid, smoothstep(0.08, 0.45, v));
    col = mix(col, uHigh, smoothstep(0.5, 0.95, v));
    // 底边亮带（极光下缘最亮）
    float hem = exp(-pow((v - 0.07) * 18.0, 2.0));
    float alpha = curtain * ends * rays * pulse * uIntensity;
    col *= 0.75 + hem * 1.1;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** 极光：沿天空圆弧排布的数条帘幕，顶点着色器摆动、片元着色器生成竖直光束 */
export function createAuroraBand(options: AuroraBandOptions): AnimatedLayer {
  const rng = mulberry32(options.seed ?? 7007);
  const group = new THREE.Group();
  group.name = 'auroraBand';
  const segments = Math.max(16, options.segments ?? 96);
  const rows = 6;
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: options.intensity ?? 1 },
    uLow: { value: new THREE.Color(options.lowColor ?? 0x3dff9a) },
    uMid: { value: new THREE.Color(options.midColor ?? 0x2fe0d0) },
    uHigh: { value: new THREE.Color(options.highColor ?? 0xb04cff) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: AURORA_VERTEX,
    fragmentShader: AURORA_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  for (let ribbon = 0; ribbon < options.ribbons; ribbon++) {
    const vertexCount = (segments + 1) * (rows + 1);
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const radial = new Float32Array(vertexCount * 3);
    const phase = new Float32Array(vertexCount);
    const ribbonPhase = rng() * 10;
    const ribbonCenter = options.centerAngle + (rng() - 0.5) * options.span * 0.35;
    const ribbonSpan = options.span * (0.55 + rng() * 0.45);
    const ribbonRadius = options.radius * (0.85 + rng() * 0.3);
    const ribbonBase = options.baseY + (rng() - 0.3) * options.height * 0.35;
    const ribbonHeight = options.height * (0.7 + rng() * 0.5);
    const foldA = 2 + rng() * 3;
    const foldB = 5 + rng() * 5;
    for (let i = 0; i <= segments; i++) {
      const along = i / segments;
      const theta = ribbonCenter + (along - 0.5) * ribbonSpan;
      const fold =
        Math.sin(along * Math.PI * foldA + ribbonPhase) * 0.09 +
        Math.sin(along * Math.PI * foldB + ribbonPhase * 1.7) * 0.035;
      const r = ribbonRadius * (1 + fold);
      const cx = Math.cos(theta);
      const cz = Math.sin(theta);
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        const index = i * (rows + 1) + j;
        positions[index * 3] = cx * r;
        positions[index * 3 + 1] = ribbonBase + v * ribbonHeight;
        positions[index * 3 + 2] = cz * r;
        uvs[index * 2] = along;
        uvs[index * 2 + 1] = v;
        radial[index * 3] = cx;
        radial[index * 3 + 1] = 0;
        radial[index * 3 + 2] = cz;
        phase[index] = ribbonPhase;
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j;
        const b = (i + 1) * (rows + 1) + j;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('aRadial', new THREE.BufferAttribute(radial, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'auroraRibbon';
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    group.add(mesh);
  }

  return {
    object: group,
    update(elapsed: number) {
      uniforms.uTime.value = elapsed;
    },
  };
}
