/**
 * 环境模块共享工具包：资源释放、无 DOM 容错的画布纹理、星形轮廓（冰架/岛屿/陨石坑边缘）、
 * GPU 驱动的烟柱/蒸汽/灰烬公告板粒子，以及着色器噪声片段。
 * 所有函数在导入时不访问 document / window。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../worldscape/noise';

export { mulberry32 };

/* ------------------------------------------------------------------ */
/* 资源释放                                                            */
/* ------------------------------------------------------------------ */

type TexturedMaterial = THREE.Material & Record<string, unknown>;

const TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'emissiveMap',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'bumpMap',
] as const;

function disposeMaterial(material: THREE.Material, seen: Set<unknown>): void {
  if (seen.has(material) || material.userData.sharedResource === true) {
    return;
  }
  seen.add(material);
  const typed = material as TexturedMaterial;
  for (const slot of TEXTURE_SLOTS) {
    const texture = typed[slot];
    if (texture instanceof THREE.Texture && !seen.has(texture)) {
      seen.add(texture);
      if (texture.userData.sharedResource !== true) {
        texture.dispose();
      }
    }
  }
  if (material instanceof THREE.ShaderMaterial) {
    for (const uniform of Object.values(material.uniforms)) {
      const value = (uniform as { value?: unknown }).value;
      if (value instanceof THREE.Texture && !seen.has(value)) {
        seen.add(value);
        if (value.userData.sharedResource !== true) {
          value.dispose();
        }
      }
    }
  }
  material.dispose();
}

/**
 * 从父节点移除 root，并释放其子树中全部几何体、材质与纹理。
 * 跳过 userData.sharedResource === true 的对象 / 材质 / 纹理；同一资源只释放一次。
 */
export function disposeObjectTree(root: THREE.Object3D): void {
  root.parent?.remove(root);
  const seen = new Set<unknown>();
  root.traverse((object) => {
    if (object.userData.sharedResource === true) {
      return;
    }
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (object instanceof THREE.InstancedMesh) {
      object.dispose();
    }
    if (renderable.geometry && !seen.has(renderable.geometry)) {
      seen.add(renderable.geometry);
      if (renderable.geometry.userData.sharedResource !== true) {
        renderable.geometry.dispose();
      }
    }
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of materials) {
      disposeMaterial(material, seen);
    }
  });
  root.clear();
}

/* ------------------------------------------------------------------ */
/* 纹理                                                                */
/* ------------------------------------------------------------------ */

/** 创建画布纹理；无 document（单元测试 / worker）或无 2D 上下文时返回 null */
export function createCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 星形轮廓：岛屿海岸线、冰架、冰山、陨石坑边缘共用                    */
/* ------------------------------------------------------------------ */

export interface PolarShapeOptions {
  centerX: number;
  centerZ: number;
  /** 平均半径（米） */
  radius: number;
  /** 起伏谐波：振幅为半径比例 */
  harmonics?: ReadonlyArray<{ k: number; amplitude: number; phase: number }>;
}

/** 以中心为极点的星形闭合轮廓：r(θ) = radius · (1 + Σ a·sin(kθ + φ)) */
export class PolarShape {
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
  private readonly harmonics: ReadonlyArray<{ k: number; amplitude: number; phase: number }>;
  private readonly maxRadius: number;

  constructor(options: PolarShapeOptions) {
    this.centerX = options.centerX;
    this.centerZ = options.centerZ;
    this.radius = options.radius;
    this.harmonics = options.harmonics ?? [];
    let amplitudeSum = 0;
    for (const h of this.harmonics) {
      amplitudeSum += Math.abs(h.amplitude);
    }
    this.maxRadius = this.radius * (1 + amplitudeSum);
  }

  /** 随机谐波轮廓（seed 决定形状） */
  static random(
    rng: () => number,
    centerX: number,
    centerZ: number,
    radius: number,
    roughness = 0.16
  ): PolarShape {
    return new PolarShape({
      centerX,
      centerZ,
      radius,
      harmonics: [
        { k: 2, amplitude: roughness * (0.4 + rng() * 0.5), phase: rng() * Math.PI * 2 },
        { k: 3, amplitude: roughness * (0.3 + rng() * 0.4), phase: rng() * Math.PI * 2 },
        { k: 5, amplitude: roughness * (0.15 + rng() * 0.25), phase: rng() * Math.PI * 2 },
        { k: 9, amplitude: roughness * (0.06 + rng() * 0.1), phase: rng() * Math.PI * 2 },
      ],
    });
  }

  radiusAt(theta: number): number {
    let r = 1;
    for (const h of this.harmonics) {
      r += h.amplitude * Math.sin(h.k * theta + h.phase);
    }
    return this.radius * r;
  }

  /** 归一化径向距离：< 1 在轮廓内；中心为 0 */
  normalizedDistance(worldX: number, worldZ: number): number {
    const dx = worldX - this.centerX;
    const dz = worldZ - this.centerZ;
    const distance = Math.hypot(dx, dz);
    if (distance > this.maxRadius * 1.6) {
      return distance / Math.max(1, this.radius);
    }
    return distance / Math.max(1e-3, this.radiusAt(Math.atan2(dz, dx)));
  }

  /** 到轮廓边缘的有符号距离（米，近似）：负 = 内部 */
  edgeDistance(worldX: number, worldZ: number): number {
    const dx = worldX - this.centerX;
    const dz = worldZ - this.centerZ;
    const distance = Math.hypot(dx, dz);
    return distance - this.radiusAt(Math.atan2(dz, dx));
  }

  contains(worldX: number, worldZ: number): boolean {
    return this.normalizedDistance(worldX, worldZ) < 1;
  }

  /** 是否可能与半径 r 的圆相交（粗筛） */
  mayOverlap(worldX: number, worldZ: number, r: number): boolean {
    return Math.hypot(worldX - this.centerX, worldZ - this.centerZ) < this.maxRadius + r;
  }

  /** 生成局部坐标（相对中心）的 THREE.Shape：x → shape.x，z → -shape.y（配合 rotateX(-π/2)） */
  toShape(segments: number, scale = 1): THREE.Shape {
    const shape = new THREE.Shape();
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = this.radiusAt(theta) * scale;
      const x = Math.cos(theta) * r;
      const y = -Math.sin(theta) * r;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();
    return shape;
  }
}

/* ------------------------------------------------------------------ */
/* GPU 公告板烟柱：火山灰柱 / 冷却塔蒸汽 / 熔岩入海蒸汽 / 烟囱黑烟       */
/* ------------------------------------------------------------------ */

export interface PuffEmitter {
  x: number;
  y: number;
  z: number;
  /** 本发射源的粒子数 */
  count: number;
  /** 单个粒子寿命（秒） */
  life: number;
  /** 上升速度（米/秒） */
  rise: number;
  /** 初始尺寸（米） */
  size: number;
  /** 寿命末尾尺寸倍数 */
  growth: number;
  /** 水平扩散半径（米） */
  spread: number;
  color: THREE.ColorRepresentation;
  /** 颜色随机明暗抖动 0..1 */
  colorJitter?: number;
}

export interface PuffFieldOptions {
  emitters: readonly PuffEmitter[];
  /** 风漂移（米/秒，世界 XZ） */
  wind: { x: number; z: number };
  opacity: number;
  additive?: boolean;
  /** 出生瞬间的提亮（熔岩蒸汽、炉口火光：底部发亮） */
  baseGlow?: THREE.ColorRepresentation;
  name: string;
  seed?: number;
}

export interface PuffField {
  mesh: THREE.Mesh;
  update(elapsed: number): void;
}

const PUFF_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  attribute vec3 aOrigin;
  attribute vec4 aParams;  // x 相位, y 寿命, z 上升速度, w 初始尺寸
  attribute vec4 aSpread;  // x 末尾倍数, y 扩散半径, zw 扩散方向
  attribute vec3 aColor;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vAge;
  varying vec3 vColor;
  #include <fog_pars_vertex>
  void main() {
    float t = fract(uTime / aParams.y + aParams.x);
    float age = t * aParams.y;
    vec3 center = aOrigin;
    center.y += aParams.z * age * (1.0 - 0.35 * t);
    center.xz += uWind * age * (0.35 + 0.65 * t) + aSpread.zw * aSpread.y * sqrt(t);
    float size = aParams.w * mix(0.55, aSpread.x, sqrt(t));
    vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
    float angle = aParams.x * 6.2831 + age * 0.15;
    float c = cos(angle);
    float s = sin(angle);
    vec2 corner = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    mvPosition.xy += corner * size;
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    vAge = t;
    vAlpha = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.5, 1.0, t));
    vColor = aColor;
    #include <fog_vertex>
  }
`;

const PUFF_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uBaseGlow;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vAge;
  varying vec3 vColor;
  #include <fog_pars_fragment>
  float puffHash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
  }
  float puffNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(puffHash(i), puffHash(i + vec2(1.0, 0.0)), f.x),
      mix(puffHash(i + vec2(0.0, 1.0)), puffHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    float billow = 0.65 + 0.35 * puffNoise(vUv * 5.0 + vAge * 2.0);
    float soft = smoothstep(1.0, 0.15, d * (1.15 - 0.3 * billow));
    float alpha = soft * vAlpha * uOpacity;
    #if defined(PUFF_ADDITIVE) && defined(USE_FOG)
      // 加色粒子随雾衰减，而不是叠加雾色
      #ifdef FOG_EXP2
        alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        alpha *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
    #endif
    if (alpha < 0.004) discard;
    vec3 col = vColor * (0.82 + 0.3 * billow);
    col += uBaseGlow * (1.0 - smoothstep(0.0, 0.35, vAge));
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifndef PUFF_ADDITIVE
      #include <fog_fragment>
    #endif
  }
`;

/** 一组 GPU 驱动的公告板粒子：每帧只更新一个 uniform，零 CPU 粒子开销 */
export function createPuffField(options: PuffFieldOptions): PuffField {
  const rng = mulberry32(options.seed ?? 1337);
  let total = 0;
  for (const emitter of options.emitters) {
    total += Math.max(0, Math.floor(emitter.count));
  }
  total = Math.max(1, total);

  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('uv', base.getAttribute('uv'));

  const origins = new Float32Array(total * 3);
  const params = new Float32Array(total * 4);
  const spreads = new Float32Array(total * 4);
  const colors = new Float32Array(total * 3);
  const color = new THREE.Color();
  let index = 0;
  for (const emitter of options.emitters) {
    const count = Math.max(0, Math.floor(emitter.count));
    const jitter = emitter.colorJitter ?? 0.12;
    for (let i = 0; i < count && index < total; i++, index++) {
      origins[index * 3] = emitter.x + (rng() - 0.5) * emitter.spread * 0.3;
      origins[index * 3 + 1] = emitter.y;
      origins[index * 3 + 2] = emitter.z + (rng() - 0.5) * emitter.spread * 0.3;
      params[index * 4] = count > 0 ? (i + rng() * 0.6) / count : rng();
      params[index * 4 + 1] = emitter.life * (0.8 + rng() * 0.4);
      params[index * 4 + 2] = emitter.rise * (0.75 + rng() * 0.5);
      params[index * 4 + 3] = emitter.size * (0.75 + rng() * 0.5);
      const angle = rng() * Math.PI * 2;
      spreads[index * 4] = emitter.growth * (0.8 + rng() * 0.4);
      spreads[index * 4 + 1] = emitter.spread * (0.4 + rng() * 0.6);
      spreads[index * 4 + 2] = Math.cos(angle);
      spreads[index * 4 + 3] = Math.sin(angle);
      color.set(emitter.color).multiplyScalar(1 - jitter * 0.5 + rng() * jitter);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
  }
  geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 3));
  geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
  geometry.setAttribute('aSpread', new THREE.InstancedBufferAttribute(spreads, 4));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.instanceCount = index;

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(options.wind.x, options.wind.z) },
      uOpacity: { value: options.opacity },
      uBaseGlow: { value: new THREE.Color(options.baseGlow ?? 0x000000) },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    vertexShader: PUFF_VERTEX,
    fragmentShader: PUFF_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    defines: options.additive ? { PUFF_ADDITIVE: '' } : {},
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = options.name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  base.dispose();

  return {
    mesh,
    update(elapsed: number) {
      uniforms.uTime.value = elapsed;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 高度场网格                                                          */
/* ------------------------------------------------------------------ */

export interface HeightGridOptions {
  /** 网格中心（世界 XZ） */
  centerX?: number;
  centerZ?: number;
  sizeX: number;
  sizeZ: number;
  segmentsX: number;
  segmentsZ: number;
  /** 世界坐标 → 世界 Y */
  heightAt: (worldX: number, worldZ: number) => number;
  /** 顶点色（可选）：slope 0 = 平地 … 1 = 垂直 */
  colorAt?: (worldX: number, worldZ: number, worldY: number, slope: number, out: THREE.Color) => void;
  /** 额外的逐顶点标量属性（如熔岩热度） */
  scalarAttributes?: Record<string, (worldX: number, worldZ: number, worldY: number) => number>;
}

/**
 * 由高度函数构建世界坐标网格几何（顶点直接写世界 XZ/Y，网格放在原点即可）。
 * 坡度用中心差分估计，供顶点着色区分崖壁与平台。
 */
export function buildHeightGridGeometry(options: HeightGridOptions): THREE.BufferGeometry {
  const centerX = options.centerX ?? 0;
  const centerZ = options.centerZ ?? 0;
  const geometry = new THREE.PlaneGeometry(
    options.sizeX,
    options.sizeZ,
    options.segmentsX,
    options.segmentsZ
  );
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = options.colorAt ? new Float32Array(position.count * 3) : null;
  const scalarNames = Object.keys(options.scalarAttributes ?? {});
  const scalars = scalarNames.map(() => new Float32Array(position.count));
  const color = new THREE.Color();
  const eps = Math.max(1.5, options.sizeX / options.segmentsX / 2);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + centerX;
    const z = position.getZ(i) + centerZ;
    const y = options.heightAt(x, z);
    position.setXYZ(i, x, y, z);
    if (colors && options.colorAt) {
      const dx = options.heightAt(x + eps, z) - options.heightAt(x - eps, z);
      const dz = options.heightAt(x, z + eps) - options.heightAt(x, z - eps);
      const normalY = (2 * eps) / Math.hypot(dx, 2 * eps, dz);
      options.colorAt(x, z, y, 1 - normalY, color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    for (let s = 0; s < scalarNames.length; s++) {
      const sampler = options.scalarAttributes?.[scalarNames[s]];
      scalars[s][i] = sampler ? sampler(x, z, y) : 0;
    }
  }
  if (colors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  scalarNames.forEach((name, s) => {
    geometry.setAttribute(name, new THREE.BufferAttribute(scalars[s], 1));
  });
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

/* ------------------------------------------------------------------ */
/* 静态网格合批                                                        */
/* ------------------------------------------------------------------ */

/**
 * 把 group 子树中的静态不透明网格按材质合并为少量网格（大幅降低绘制调用）。
 * 跳过：InstancedMesh、实例化几何、透明材质、多材质网格，以及 userData.dynamic === true 的子树
 * （例如需要逐帧旋转的雷达天线）。返回合并后减少的网格数。
 */
export function mergeStaticMeshes(group: THREE.Group): number {
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<
    THREE.Material,
    { geometries: THREE.BufferGeometry[]; cast: boolean; receive: boolean }
  >();
  const merged: THREE.Mesh[] = [];

  const visit = (object: THREE.Object3D): void => {
    if (object.userData.dynamic === true) {
      return;
    }
    for (const child of object.children) {
      visit(child);
    }
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) {
      return;
    }
    const material = object.material;
    if (Array.isArray(material) || material.transparent) {
      return;
    }
    const source = object.geometry as THREE.BufferGeometry;
    if (source instanceof THREE.InstancedBufferGeometry || !source.getAttribute('position')) {
      return;
    }
    const useColor = (material as THREE.Material & { vertexColors?: boolean }).vertexColors === true;
    if (useColor && !source.getAttribute('color')) {
      return;
    }
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    const keep = new Set(['position', 'normal', 'uv', ...(useColor ? ['color'] : [])]);
    for (const name of Object.keys(geometry.attributes)) {
      if (!keep.has(name)) {
        geometry.deleteAttribute(name);
      }
    }
    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals();
    }
    if (!geometry.getAttribute('uv')) {
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    geometry.morphAttributes = {};
    let bucket = buckets.get(material);
    if (!bucket) {
      bucket = { geometries: [], cast: false, receive: false };
      buckets.set(material, bucket);
    }
    bucket.geometries.push(geometry);
    bucket.cast ||= object.castShadow;
    bucket.receive ||= object.receiveShadow;
    merged.push(object);
  };
  visit(group);

  const removedGeometries = new Set<THREE.BufferGeometry>();
  const mergedMaterials = new Set<THREE.Material>();
  let created = 0;
  for (const [material, bucket] of buckets) {
    const combined = bucket.geometries.length > 0 ? mergeGeometries(bucket.geometries, false) : null;
    bucket.geometries.forEach((geometry) => geometry.dispose());
    if (!combined) {
      continue;
    }
    combined.computeBoundingSphere();
    const mesh = new THREE.Mesh(combined, material);
    mesh.name = `${group.name}Merged${created}`;
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    group.add(mesh);
    mergedMaterials.add(material);
    created++;
  }
  // 只移除已成功合并的材质对应的原网格
  for (const object of merged) {
    const material = object.material as THREE.Material;
    if (!mergedMaterials.has(material)) continue;
    object.parent?.remove(object);
    removedGeometries.add(object.geometry);
  }
  // 仍被其余对象引用的几何不释放
  group.traverse((object) => {
    const geometry = (object as THREE.Mesh).geometry;
    if (geometry) removedGeometries.delete(geometry);
  });
  removedGeometries.forEach((geometry) => geometry.dispose());
  // 清理空分组
  const empties: THREE.Object3D[] = [];
  group.traverse((object) => {
    if (object !== group && object.type === 'Group' && object.children.length === 0) {
      empties.push(object);
    }
  });
  empties.forEach((object) => object.parent?.remove(object));
  let removed = 0;
  for (const object of merged) {
    if (mergedMaterials.has(object.material as THREE.Material)) removed++;
  }
  return removed - created;
}

/* ------------------------------------------------------------------ */
/* 实例化放置                                                          */
/* ------------------------------------------------------------------ */

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

/** 写入一个实例：位置 + 欧拉朝向（仅构建期使用）+ 非等比缩放 */
export function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  scaleX: number,
  scaleY: number = scaleX,
  scaleZ: number = scaleX,
  tiltX = 0,
  tiltZ = 0
): void {
  _position.set(x, y, z);
  _euler.set(tiltX, rotationY, tiltZ, 'YXZ');
  _quaternion.setFromEuler(_euler);
  _scale.set(scaleX, scaleY, scaleZ);
  _matrix.compose(_position, _quaternion, _scale);
  mesh.setMatrixAt(index, _matrix);
}

/* ------------------------------------------------------------------ */
/* GLSL 片段                                                           */
/* ------------------------------------------------------------------ */

/** 值噪声 / fbm / Voronoi 边缘距离（熔岩裂纹、冰面纹理共用） */
export const GLSL_NOISE = /* glsl */ `
  float envHash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 envHash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  float envNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(envHash12(i), envHash12(i + vec2(1.0, 0.0)), f.x),
      mix(envHash12(i + vec2(0.0, 1.0)), envHash12(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float envFbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * envNoise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      amp *= 0.5;
    }
    return sum;
  }
  // Voronoi：x = 到最近胞元中心距离，y = 到胞元边界的近似距离（F2 - F1）
  vec2 envCells(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 r = g + envHash22(i + g) - f;
        float d = dot(r, r);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
    return vec2(sqrt(f1), sqrt(f2) - sqrt(f1));
  }
`;
