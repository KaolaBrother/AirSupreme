/**
 * worldscape/clouds — 漂移的积云。
 * 从 worldshowcase (src/world/clouds.js) 移植：合并球体云团按变体实例化，
 * coverage 0..1 决定多少朵在天上；tone 为雨/雪/风暴压暗云层；
 * 一切渐变缓动而非瞬间切换。云沿风向持续漂移并环绕回卷、
 * 垂直浮沉、按天气色调调制颜色与自发光——云永远在动。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, smoothstep as smoothstepRange } from './noise';

function makeCloudGeometry(rand: () => number): THREE.BufferGeometry {
  const puffs: THREE.BufferGeometry[] = [];
  const n = 6 + Math.floor(rand() * 4);
  let cx = 0;
  for (let i = 0; i < n; i++) {
    const g = new THREE.SphereGeometry(1, 9, 6);
    const s = 6 + rand() * 9;
    g.scale(s * (1 + rand() * 0.6), s * (0.42 + rand() * 0.22), s * (0.8 + rand() * 0.5));
    g.translate(cx, (rand() - 0.3) * 3.5, (rand() - 0.5) * 10);
    cx += s * (0.85 + rand() * 0.5);
    puffs.push(g);
  }
  const merged = mergeGeometries(puffs);
  merged.center();
  puffs.forEach((g) => g.dispose());
  merged.computeBoundingBox();
  return merged;
}

/**
 * 云团着色（注入 MeshStandardMaterial）：
 * - uCloudFacet：晴日保留低多边形切面（1），阴沉 / 风暴天气过渡到平滑球面法线（0）；
 * - uCloudSoft：轮廓柔化——掠射角处淡出，团块边缘与彼此交叠处不再是硬多边形；
 * - 云底压暗、云顶受光（按团块局部高度），风暴云呈现厚重的暗底与亮边；
 * - 低频噪声侵蚀透明度，打散整齐的边缘。
 */
function injectCloudShading(
  material: THREE.MeshStandardMaterial,
  uniforms: {
    uCloudFacet: { value: number };
    uCloudSoft: { value: number };
    uCloudHalfHeight: { value: number };
  }
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vCloudLocalY;
        varying vec3 vCloudWorld;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vCloudLocalY = position.y;
        {
          vec4 cloudWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cloudWorld = instanceMatrix * cloudWorld;
          #endif
          vCloudWorld = (modelMatrix * cloudWorld).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uCloudFacet;
        uniform float uCloudSoft;
        uniform float uCloudHalfHeight;
        varying float vCloudLocalY;
        varying vec3 vCloudWorld;
        float cloudHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float cloudNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(cloudHash(i), cloudHash(i + vec2(1.0, 0.0)), f.x),
            mix(cloudHash(i + vec2(0.0, 1.0)), cloudHash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float cloudHeightT = clamp(vCloudLocalY / max(1.0, uCloudHalfHeight) * 0.5 + 0.5, 0.0, 1.0);
        // 云底压暗、云顶提亮（阴沉 / 风暴时对比更强，晴日几乎不变）
        diffuseColor.rgb *= mix(1.0 - 0.45 * uCloudSoft, 1.0 + 0.08 * uCloudSoft, smoothstep(0.0, 0.85, cloudHeightT));`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          vec3 cloudFlat = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          normal = normalize(mix(normal, cloudFlat, uCloudFacet));
          // 掠射角淡出：边缘柔化成絮状
          vec3 cloudView = normalize(vViewPosition);
          float cloudFacing = abs(dot(normal, cloudView));
          float cloudEdge = smoothstep(0.0, 0.5 + 0.25 * uCloudSoft, cloudFacing);
          float cloudWisp = cloudNoise(vCloudWorld.xz * 0.045 + vCloudWorld.y * 0.03);
          diffuseColor.a *= mix(1.0, cloudEdge * (0.78 + 0.22 * cloudWisp), uCloudSoft);
        }`
      );
  };
  material.customProgramCacheKey = () => 'worldscape-cloud-soft';
}

interface CloudEntry {
  mesh: THREE.InstancedMesh;
  index: number;
  x: number;
  z: number;
  y: number;
  baseScale: number;
  speed: number;
  /** 显隐次序（coverage 阈值），空间上打乱 */
  rank: number;
  /** 缓动后的可见度 0..1 */
  shown: number;
  rot: number;
}

export interface CloudFieldOptions {
  seed?: number;
  /** 云形变体数（每个变体一份合并几何 + 一个 InstancedMesh） */
  variants?: number;
  /** 每个变体的实例数 */
  perVariant: number;
  /** 漂移环绕场边长（米） */
  fieldSize?: number;
  /** 云底/云顶高度（世界 Y） */
  altitudeMin: number;
  altitudeMax: number;
  /** 云色（天气色调在此基础上调制明暗） */
  tint?: THREE.ColorRepresentation;
  /** 基础尺寸放大（worldshowcase 云为 1800m 世界设计，4000m 世界需放大） */
  scaleMultiplier?: number;
  opacity?: number;
  renderOrder?: number;
}

/**
 * 实例化积云场。每帧调用 update() 推进漂移/浮沉/显隐缓动，
 * coverage/tone/wind 由关卡天气提供。
 */
export class CloudField {
  readonly group: THREE.Group;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly entries: CloudEntry[] = [];
  private readonly fieldSize: number;
  private readonly tintColor: THREE.Color;
  private tone = 1;
  private readonly shading = {
    uCloudFacet: { value: 1 },
    uCloudSoft: { value: 0 },
    uCloudHalfHeight: { value: 8 },
  };

  private readonly _mat4 = new THREE.Matrix4();
  private readonly _quat = new THREE.Quaternion();
  private readonly _scl = new THREE.Vector3();
  private readonly _pos = new THREE.Vector3();
  private readonly _yAxis = new THREE.Vector3(0, 1, 0);

  constructor(options: CloudFieldOptions) {
    const rand = mulberry32(options.seed ?? 4242);
    const variants = options.variants ?? 5;
    const perVariant = options.perVariant;
    this.fieldSize = options.fieldSize ?? 4800;
    this.tintColor = new THREE.Color(options.tint ?? 0xffffff);
    const scaleMultiplier = options.scaleMultiplier ?? 2.3;
    const renderOrder = options.renderOrder ?? 0;

    this.group = new THREE.Group();
    this.group.name = 'worldscapeClouds';
    this.group.renderOrder = renderOrder;
    // 平滑法线由着色器按天气在“低多边形切面 ↔ 柔和球面”之间混合（见 injectCloudShading）
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.42,
      flatShading: false,
      roughness: 1,
      transparent: true,
      opacity: options.opacity ?? 0.92,
      depthWrite: false,
      depthTest: true,
    });
    this.material.emissive.copy(this.tintColor);
    injectCloudShading(this.material, this.shading);

    let halfHeight = 1;
    for (let v = 0; v < variants; v++) {
      const geo = makeCloudGeometry(rand);
      const box = geo.boundingBox;
      if (box) halfHeight = Math.max(halfHeight, (box.max.y - box.min.y) * 0.5);
      this.geometries.push(geo);
      const im = new THREE.InstancedMesh(geo, this.material, perVariant);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = false;
      im.renderOrder = renderOrder;
      this.meshes.push(im);
      this.group.add(im);

      for (let i = 0; i < perVariant; i++) {
        this.entries.push({
          mesh: im,
          index: i,
          x: (rand() - 0.5) * this.fieldSize,
          z: (rand() - 0.5) * this.fieldSize,
          y: options.altitudeMin + rand() * Math.max(1, options.altitudeMax - options.altitudeMin),
          baseScale: (1.4 + rand() * 2.4) * scaleMultiplier,
          speed: 0.55 + rand() * 0.7,
          rank: (v * perVariant + i) / (variants * perVariant),
          shown: 0,
          rot: rand() * Math.PI * 2,
        });
      }
    }

    this.shading.uCloudHalfHeight.value = halfHeight;

    // 打乱显隐次序，让 coverage 的增减在空间上均匀铺开
    const ranks = this.entries.map((e) => e.rank);
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
    }
    this.entries.forEach((e, i) => {
      e.rank = ranks[i];
    });
  }

  /**
   * coverage/tone 来自天气；windAngle（弧度）+ windSpeed（米/秒）驱动漂移；
   * stormSag 让风暴云整体下压。
   */
  update(
    dt: number,
    time: number,
    coverage: number,
    tone: number,
    windAngle: number,
    windSpeed: number,
    stormSag = 0
  ): void {
    const safeTone = Number.isFinite(tone) ? tone : 1;
    this.tone += (safeTone - this.tone) * Math.min(1, dt * 1.2);
    // 自发光抬升让云底保持柔和而非死黑；两个通道都跟随天气色调
    const luminance = 0.36 + 0.5 * this.tone;
    this.material.color.copy(this.tintColor).multiplyScalar(luminance);
    this.material.emissiveIntensity = 0.1 + 0.36 * this.tone;
    // 晴日（tone ≈ 1）保持低多边形切面与硬朗轮廓；阴沉 / 风暴云平滑、轮廓柔化
    this.shading.uCloudFacet.value = smoothstepRange(0.55, 0.95, this.tone);
    this.shading.uCloudSoft.value = 1 - smoothstepRange(0.7, 1.0, this.tone) * 0.75;

    const dirX = Math.cos(windAngle);
    const dirZ = Math.sin(windAngle);
    const half = this.fieldSize / 2;

    for (const e of this.entries) {
      const drift = windSpeed * e.speed * dt;
      e.x += dirX * drift;
      e.z += dirZ * drift * 0.85;
      if (e.x > half) e.x -= this.fieldSize;
      if (e.x < -half) e.x += this.fieldSize;
      if (e.z > half) e.z -= this.fieldSize;
      if (e.z < -half) e.z += this.fieldSize;

      const want = coverage > e.rank ? 1 : 0;
      e.shown += (want - e.shown) * Math.min(1, dt * 0.9);

      const s = e.baseScale * (0.0001 + e.shown);
      const sag = stormSag * 70 * e.shown;
      const bob = Math.sin(time * 0.11 + e.rank * 31) * 6;

      this._pos.set(e.x, e.y - sag + bob, e.z);
      this._quat.setFromAxisAngle(this._yAxis, e.rot);
      this._scl.setScalar(s);
      this._mat4.compose(this._pos, this._quat, this._scl);
      e.mesh.setMatrixAt(e.index, this._mat4);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
