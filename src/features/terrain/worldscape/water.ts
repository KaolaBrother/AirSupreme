/**
 * worldscape/water — 全幅水面波浪着色器。
 * 从 worldshowcase (src/world/water.js) 移植：地形深度按顶点烘焙进
 * aDepth 属性，着色器据此绘制浅滩渐变与岸线浪沫，运行时无需再采样地形。
 * 三个方向性正弦波叠加，法线由解析斜率求出；菲涅尔天空染色 + pow90 太阳高光。
 * 所有颜色/太阳 uniform 可覆盖，便于按关卡调色。
 */
import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform float uTime;
  attribute float aDepth;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDepth;
  #include <fog_pars_vertex>

  // 三个交叠的方向波；法线来自解析斜率
  vec3 waveOffset(vec2 p, float t, out vec3 nrm) {
    vec2 d1 = normalize(vec2(0.8, 0.35));
    vec2 d2 = normalize(vec2(-0.45, 0.85));
    vec2 d3 = normalize(vec2(0.2, -0.95));
    float f1 = 0.055, f2 = 0.085, f3 = 0.16;
    float a1 = 0.55, a2 = 0.32, a3 = 0.14;
    float p1 = dot(p, d1) * f1 + t * 0.9;
    float p2 = dot(p, d2) * f2 + t * 1.25;
    float p3 = dot(p, d3) * f3 + t * 1.9;
    float y = a1 * sin(p1) + a2 * sin(p2) + a3 * sin(p3);
    float dx = a1 * cos(p1) * d1.x * f1 + a2 * cos(p2) * d2.x * f2 + a3 * cos(p3) * d3.x * f3;
    float dz = a1 * cos(p1) * d1.y * f1 + a2 * cos(p2) * d2.y * f2 + a3 * cos(p3) * d3.y * f3;
    nrm = normalize(vec3(-dx, 1.0, -dz));
    return vec3(0.0, y, 0.0);
  }

  void main() {
    vDepth = aDepth;
    vec3 pos = position;
    vec3 nrm;
    // 浪在沙滩上渐隐，浪尖永不戳穿沙面
    float waveScale = smoothstep(0.0, 3.5, aDepth);
    vec3 off = waveOffset(pos.xz, uTime, nrm) * waveScale;
    pos += off;
    vNormal = normalize(mix(vec3(0.0, 1.0, 0.0), nrm, waveScale));
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyTint;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDepth;
  #include <fog_pars_fragment>

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    if (vDepth < -0.5) discard; // 旱地之下

    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    vec3 col = mix(uShallowColor, uDeepColor, smoothstep(0.5, 16.0, vDepth));

    float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
    col = mix(col, uSkyTint, fres * 0.65);

    // 太阳碎光
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 90.0) * uSunIntensity;
    col += uSunColor * spec * 0.9;

    // 岸线浪沫：水深及踝处的动态浪带
    float foamNoise = vnoise(vWorldPos.xz * 0.55 + vec2(uTime * 0.35, -uTime * 0.22));
    float band = smoothstep(2.4, 0.25, vDepth);
    float foam = band * smoothstep(0.36, 0.72, foamNoise * (0.55 + 0.45 * sin(uTime * 1.4 + vDepth * 5.0)));
    col = mix(col, vec3(0.93, 0.97, 0.95), clamp(foam, 0.0, 0.85));

    float alpha = mix(0.7, 0.94, smoothstep(0.0, 10.0, vDepth));
    alpha = max(alpha, foam * 0.9);

    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`;

export interface WaterEnvironment {
  sunDir?: THREE.Vector3;
  sunIntensity?: number;
  skyTint?: THREE.ColorRepresentation;
  deep?: THREE.ColorRepresentation;
  shallow?: THREE.ColorRepresentation;
  sunColor?: THREE.ColorRepresentation;
}

export interface WorldscapeWaterOptions {
  /** 水面边长（米，X 方向） */
  size: number;
  /** 网格细分数（X 方向） */
  grid: number;
  /** Z 方向边长（米），缺省与 size 相同（方形水面，向后兼容） */
  sizeZ?: number;
  /** Z 方向网格细分数，缺省与 grid 相同 */
  gridZ?: number;
  /** 局部水深采样（正 = 水下深度，负 = 旱地高出水面），按顶点烘焙 */
  depthAt: (x: number, z: number) => number;
  deepColor?: THREE.ColorRepresentation;
  shallowColor?: THREE.ColorRepresentation;
  skyTint?: THREE.ColorRepresentation;
  sunDir?: THREE.Vector3;
  sunColor?: THREE.ColorRepresentation;
  sunIntensity?: number;
}

export interface WorldscapeWater {
  mesh: THREE.Mesh;
  update(time: number): void;
  setEnvironment(env: WaterEnvironment): void;
  dispose(): void;
}

interface WaterUniforms {
  uTime: { value: number };
  uDeepColor: { value: THREE.Color };
  uShallowColor: { value: THREE.Color };
  uSkyTint: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uSunIntensity: { value: number };
  [key: string]: { value: unknown };
}

export function buildWorldscapeWater(options: WorldscapeWaterOptions): WorldscapeWater {
  const geo = new THREE.PlaneGeometry(
    options.size,
    options.sizeZ ?? options.size,
    options.grid,
    options.gridZ ?? options.grid
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    depth[i] = options.depthAt(pos.getX(i), pos.getZ(i));
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(options.deepColor ?? 0x16555e) },
      uShallowColor: { value: new THREE.Color(options.shallowColor ?? 0x39a08c) },
      uSkyTint: { value: new THREE.Color(options.skyTint ?? 0xbcd6da) },
      uSunDir: { value: (options.sunDir ?? new THREE.Vector3(0.5, 0.7, 0.3)).clone() },
      uSunColor: { value: new THREE.Color(options.sunColor ?? 0xfff2d8) },
      uSunIntensity: { value: options.sunIntensity ?? 1.0 },
    },
  ]) as WaterUniforms;

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 0;
  mesh.name = 'worldscapeWater';

  return {
    mesh,
    update(time: number) {
      uniforms.uTime.value = time;
    },
    setEnvironment({ sunDir, sunIntensity, skyTint, deep, shallow, sunColor }: WaterEnvironment) {
      if (sunDir) uniforms.uSunDir.value.copy(sunDir);
      if (sunIntensity !== undefined) uniforms.uSunIntensity.value = sunIntensity;
      if (skyTint !== undefined) uniforms.uSkyTint.value.set(skyTint);
      if (deep !== undefined) uniforms.uDeepColor.value.set(deep);
      if (shallow !== undefined) uniforms.uShallowColor.value.set(shallow);
      if (sunColor !== undefined) uniforms.uSunColor.value.set(sunColor);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

const _d1x = 0.8 / Math.hypot(0.8, 0.35);
const _d1y = 0.35 / Math.hypot(0.8, 0.35);
const _d2x = -0.45 / Math.hypot(0.45, 0.85);
const _d2y = 0.85 / Math.hypot(0.45, 0.85);
const _d3x = 0.2 / Math.hypot(0.2, 0.95);
const _d3y = -0.95 / Math.hypot(0.2, 0.95);

/** GPU 波形的 CPU 镜像：船只/浮标随浪起伏时调用（深水处 waveScale = 1） */
export function sampleWaveHeight(x: number, z: number, time: number): number {
  const p1 = (x * _d1x + z * _d1y) * 0.055 + time * 0.9;
  const p2 = (x * _d2x + z * _d2y) * 0.085 + time * 1.25;
  const p3 = (x * _d3x + z * _d3y) * 0.16 + time * 1.9;
  return 0.55 * Math.sin(p1) + 0.32 * Math.sin(p2) + 0.14 * Math.sin(p3);
}
