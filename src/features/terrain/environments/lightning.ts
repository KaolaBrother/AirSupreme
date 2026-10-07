/**
 * 闪电表现（共享）：屏幕朝向的带状闪电（加色、核心高光 + 外晕，宽度为世界米）与
 * 原地中点位移的锯齿折线。雷鸣峡谷的收集塔雷击 / 跨谷电弧与 'storm' 天气的全局雷暴共用。
 * 透明材质遵循 renderOrder 0 / depthTest / 不写深度；折线生成不分配内存。
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* 带状闪电（屏幕朝向四边形）                                           */
/* ------------------------------------------------------------------ */

const BOLT_VERTEX = /* glsl */ `
  attribute vec3 aOther;
  attribute float aSide;
  attribute float aWidth;
  attribute float aIntensity;
  varying float vAcross;
  varying float vIntensity;
  void main() {
    vec4 worldA = modelMatrix * vec4(position, 1.0);
    vec4 worldB = modelMatrix * vec4(aOther, 1.0);
    vec3 dir = normalize(worldB.xyz - worldA.xyz + vec3(1e-4));
    vec3 toCam = normalize(cameraPosition - worldA.xyz);
    vec3 side = normalize(cross(dir, toCam) + vec3(1e-5));
    worldA.xyz += side * aSide * aWidth;
    vAcross = aSide;
    vIntensity = aIntensity;
    gl_Position = projectionMatrix * viewMatrix * worldA;
  }
`;

const BOLT_FRAGMENT = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uGlow;
  varying float vAcross;
  varying float vIntensity;
  void main() {
    float d = abs(vAcross);
    float core = 1.0 - smoothstep(0.0, 0.35, d);
    float glow = pow(1.0 - d, 2.0);
    float alpha = (core + glow * 0.6) * vIntensity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(uGlow, uCore, core), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class BoltRibbons {
  readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly others: Float32Array;
  private readonly widths: Float32Array;
  private readonly intensities: Float32Array;
  private readonly geometry: THREE.BufferGeometry;

  constructor(
    readonly capacity: number,
    name = 'lightningRibbons'
  ) {
    const vertices = capacity * 4;
    this.positions = new Float32Array(vertices * 3);
    this.others = new Float32Array(vertices * 3);
    this.widths = new Float32Array(vertices);
    this.intensities = new Float32Array(vertices);
    const sides = new Float32Array(vertices);
    const indices: number[] = [];
    for (let s = 0; s < capacity; s++) {
      const v = s * 4;
      sides[v] = -1;
      sides[v + 1] = 1;
      sides[v + 2] = -1;
      sides[v + 3] = 1;
      indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
    const geometry = new THREE.BufferGeometry();
    const dynamic = (array: Float32Array, size: number): THREE.BufferAttribute => {
      const attribute = new THREE.BufferAttribute(array, size);
      attribute.setUsage(THREE.DynamicDrawUsage);
      return attribute;
    };
    geometry.setAttribute('position', dynamic(this.positions, 3));
    geometry.setAttribute('aOther', dynamic(this.others, 3));
    geometry.setAttribute('aWidth', dynamic(this.widths, 1));
    geometry.setAttribute('aIntensity', dynamic(this.intensities, 1));
    geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
    geometry.setIndex(indices);
    this.geometry = geometry;
    const material = new THREE.ShaderMaterial({
      vertexShader: BOLT_VERTEX,
      fragmentShader: BOLT_FRAGMENT,
      uniforms: {
        uCore: { value: new THREE.Color(0xffffff).multiplyScalar(2.4) },
        uGlow: { value: new THREE.Color(0x8ab4ff).multiplyScalar(1.4) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
  }

  /** 写入一段：a → b */
  setSegment(
    slot: number,
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number,
    intensity: number
  ): void {
    if (slot < 0 || slot >= this.capacity) return;
    const v = slot * 4;
    for (let k = 0; k < 4; k++) {
      const start = k < 2 ? a : b;
      const end = k < 2 ? b : a;
      const i = (v + k) * 3;
      this.positions[i] = start.x;
      this.positions[i + 1] = start.y;
      this.positions[i + 2] = start.z;
      this.others[i] = end.x;
      this.others[i + 1] = end.y;
      this.others[i + 2] = end.z;
      this.widths[v + k] = width;
      this.intensities[v + k] = intensity;
    }
  }

  /** 统一调整一段区间的亮度（淡出） */
  setIntensity(from: number, to: number, intensity: number): void {
    for (let slot = from; slot < to && slot < this.capacity; slot++) {
      const v = slot * 4;
      this.intensities[v] = intensity;
      this.intensities[v + 1] = intensity;
      this.intensities[v + 2] = intensity;
      this.intensities[v + 3] = intensity;
    }
  }

  clear(from: number, to: number): void {
    this.setIntensity(from, to, 0);
  }

  commit(): void {
    for (const name of ['position', 'aOther', 'aWidth', 'aIntensity']) {
      (this.geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 折线生成                                                            */
/* ------------------------------------------------------------------ */

/** 预分配的折线点池（2^depth + 1 个点） */
export function createPath(depth: number): THREE.Vector3[] {
  return Array.from({ length: (1 << depth) + 1 }, () => new THREE.Vector3());
}

/**
 * 原地中点位移的锯齿折线：out.length 必须为 2^depth + 1（由 createPath 创建），不分配内存。
 */
export function jaggedPath(
  a: THREE.Vector3,
  b: THREE.Vector3,
  roughness: number,
  rng: () => number,
  out: THREE.Vector3[]
): THREE.Vector3[] {
  const last = out.length - 1;
  out[0].copy(a);
  out[last].copy(b);
  let displacement = a.distanceTo(b) * roughness;
  for (let step = last >> 1; step >= 1; step >>= 1) {
    for (let i = step; i < last; i += step * 2) {
      const mid = out[i].copy(out[i - step]).lerp(out[i + step], 0.5);
      mid.x += (rng() - 0.5) * displacement;
      mid.y += (rng() - 0.5) * displacement * 0.35;
      mid.z += (rng() - 0.5) * displacement;
    }
    displacement *= 0.55;
  }
  return out;
}
