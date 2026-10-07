import * as THREE from 'three';
import { ATLAS_CELL_SIZE, ATLAS_COLS, ATLAS_ROWS, getVfxAtlas } from './VfxAtlas';

/** 渲染模式：0 = 面向相机，1 = 沿轴拉伸（曳光/焰瓣），2 = 世界水平面（地面环/焦痕） */
export const BATCH_MODE_BILLBOARD = 0;
export const BATCH_MODE_STREAK = 1;
export const BATCH_MODE_PLANAR = 2;

const SORT_BUCKETS = 1024;

const vertexShader = /* glsl */ `
attribute vec4 aPosSize;
attribute vec4 aColor;
attribute vec4 aParams;
attribute vec4 aAxis;

uniform vec2 uAtlasGrid;
uniform float uUvInset;

varying vec2 vUv;
varying vec4 vColor;
varying float vAdditive;
varying float vShade;

#include <fog_pars_vertex>

void main() {
  vec2 corner = position.xy;
  float size = aPosSize.w;
  float c = cos(aParams.x);
  float s = sin(aParams.x);
  vec2 rotated = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
  float mode = aParams.w;
  float shade = 0.5 + rotated.y;
  vec4 mvPosition;

  if (mode > 1.5) {
    vec3 world = aPosSize.xyz + vec3(rotated.x, 0.0, rotated.y) * size;
    mvPosition = modelViewMatrix * vec4(world, 1.0);
    shade = 0.85;
  } else {
    mvPosition = modelViewMatrix * vec4(aPosSize.xyz, 1.0);
    if (mode > 0.5) {
      vec3 axisView = (modelViewMatrix * vec4(aAxis.xyz, 0.0)).xyz;
      float axisLength = length(axisView.xy);
      vec2 dir = axisLength > 1e-4 ? axisView.xy / axisLength : vec2(1.0, 0.0);
      vec2 across = vec2(-dir.y, dir.x);
      float lengthAlong = size + aParams.z * axisLength;
      mvPosition.xy += dir * corner.x * lengthAlong + across * corner.y * size;
      shade = 0.85;
    } else {
      mvPosition.xy += rotated * size;
    }
  }

  // 贴近相机的大粒子淡出，避免穿烟时整屏糊住
  float viewDepth = -mvPosition.z;
  float nearFade = clamp((viewDepth - 0.8) / max(size * 0.9, 0.6), 0.0, 1.0);

  gl_Position = projectionMatrix * mvPosition;

  float cell = aParams.y;
  float row = floor((cell + 0.5) / uAtlasGrid.x);
  float col = cell - row * uAtlasGrid.x;
  vec2 localUv = uv * (1.0 - 2.0 * uUvInset) + uUvInset;
  vUv = (vec2(col, row) + localUv) / uAtlasGrid;
  vColor = vec4(aColor.rgb, aColor.a * nearFade);
  vAdditive = aAxis.w;
  vShade = clamp(shade, 0.0, 1.0);

  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uAtlas;

varying vec2 vUv;
varying vec4 vColor;
varying float vAdditive;
varying float vShade;

#include <fog_pars_fragment>

void main() {
  vec4 tex = texture2D(uAtlas, vUv);
  float alpha = tex.a * vColor.a;
  if (alpha < 0.002) discard;

  // 普通混合粒子（烟/尘）做顶光近似，增加体积感；加色粒子保持原亮度
  float light = mix(mix(0.68, 1.14, vShade), 1.0, vAdditive);
  vec3 rgb = vColor.rgb * tex.rgb * light;

  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    rgb = mix(mix(rgb, fogColor, fogFactor), rgb * (1.0 - fogFactor), vAdditive);
  #endif

  // 色调映射：烟尘在直通色上映射后再预乘（正确的 over 混合）；
  // 加色粒子映射其预乘辐亮度（柔边保留饱和色，核心才趋白）
  gl_FragColor = vec4(mix(rgb, rgb * alpha, vAdditive), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // 预乘混合：加色粒子 alpha=0 → 纯叠加；烟尘按覆盖度遮挡
  gl_FragColor = vec4(mix(gl_FragColor.rgb * alpha, gl_FragColor.rgb, vAdditive), alpha * (1.0 - vAdditive));
}
`;

interface UpdateRange {
  start: number;
  count: number;
}

/**
 * 实例化粒子批：全部粒子（加色 + 普通混合）在单个 draw call 内，
 * 预乘 alpha 混合 + 按视深计数排序（远→近），火焰与烟柱可正确穿插。
 */
export class ParticleBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  readonly capacity: number;

  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly posSizeAttr: THREE.InstancedBufferAttribute;
  private readonly colorAttr: THREE.InstancedBufferAttribute;
  private readonly paramsAttr: THREE.InstancedBufferAttribute;
  private readonly axisAttr: THREE.InstancedBufferAttribute;
  private readonly ranges: UpdateRange[] = [
    { start: 0, count: 0 },
    { start: 0, count: 0 },
    { start: 0, count: 0 },
    { start: 0, count: 0 },
  ];

  // 未排序的暂存数据（push 写入），end() 时按排序结果拷入 GPU 属性数组
  private readonly stagePosSize: Float32Array;
  private readonly stageColor: Float32Array;
  private readonly stageParams: Float32Array;
  private readonly stageAxis: Float32Array;
  private readonly depthKeys: Float32Array;
  private readonly order: Uint32Array;
  private readonly bucketOf: Uint16Array;
  private readonly bucketCounts = new Uint32Array(SORT_BUCKETS + 1);

  private count = 0;
  private sortCamera: THREE.Camera | null = null;

  constructor(capacity: number) {
    this.capacity = Math.max(16, Math.floor(capacity));

    const base = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('uv', base.getAttribute('uv'));
    geometry.instanceCount = 0;

    const n = this.capacity;
    this.posSizeAttr = this.createAttribute(n);
    this.colorAttr = this.createAttribute(n);
    this.paramsAttr = this.createAttribute(n);
    this.axisAttr = this.createAttribute(n);
    geometry.setAttribute('aPosSize', this.posSizeAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aParams', this.paramsAttr);
    geometry.setAttribute('aAxis', this.axisAttr);
    // 粒子散布全场景：给一个巨大包围球，配合 frustumCulled=false
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.geometry = geometry;

    this.stagePosSize = new Float32Array(n * 4);
    this.stageColor = new Float32Array(n * 4);
    this.stageParams = new Float32Array(n * 4);
    this.stageAxis = new Float32Array(n * 4);
    this.depthKeys = new Float32Array(n);
    this.order = new Uint32Array(n);
    this.bucketOf = new Uint16Array(n);

    this.material = new THREE.ShaderMaterial({
      name: 'VfxParticleBatch',
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uAtlas: { value: null },
          uAtlasGrid: { value: new THREE.Vector2(ATLAS_COLS, ATLAS_ROWS) },
          uUvInset: { value: 1.5 / ATLAS_CELL_SIZE },
        },
      ]),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.material.uniforms.uAtlas.value = getVfxAtlas();

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = 'vfx-particle-batch';
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    mesh.visible = false;
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      this.sortCamera = camera;
    };
    this.mesh = mesh;
  }

  private createAttribute(capacity: number): THREE.InstancedBufferAttribute {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    attribute.setUsage(THREE.DynamicDrawUsage);
    return attribute;
  }

  /** 最近一次渲染使用的相机（用于排序，可外部指定） */
  setSortCamera(camera: THREE.Camera | null): void {
    this.sortCamera = camera;
  }

  getCount(): number {
    return this.count;
  }

  begin(): void {
    this.count = 0;
  }

  /**
   * 写入一个粒子实例。color 为线性 HDR 颜色（可 >1 驱动泛光）。
   * axis：拉伸模式下的世界轴向量（长度参与拉伸）；additive 0..1。
   */
  push(
    x: number,
    y: number,
    z: number,
    size: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    rotation: number,
    cell: number,
    stretch: number,
    mode: number,
    axisX: number,
    axisY: number,
    axisZ: number,
    additive: number
  ): void {
    if (this.count >= this.capacity) return;
    if (!(alpha > 0.001) || !(size > 0)) return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    const i4 = this.count * 4;
    this.stagePosSize[i4] = x;
    this.stagePosSize[i4 + 1] = y;
    this.stagePosSize[i4 + 2] = z;
    this.stagePosSize[i4 + 3] = size;
    this.stageColor[i4] = r;
    this.stageColor[i4 + 1] = g;
    this.stageColor[i4 + 2] = b;
    this.stageColor[i4 + 3] = alpha;
    this.stageParams[i4] = rotation;
    this.stageParams[i4 + 1] = cell;
    this.stageParams[i4 + 2] = stretch;
    this.stageParams[i4 + 3] = mode;
    this.stageAxis[i4] = axisX;
    this.stageAxis[i4 + 1] = axisY;
    this.stageAxis[i4 + 2] = axisZ;
    this.stageAxis[i4 + 3] = additive;
    this.count++;
  }

  /** 排序（远→近）并上传本帧实例数据 */
  end(): void {
    const n = this.count;
    this.mesh.visible = n > 0;
    this.geometry.instanceCount = n;
    if (n === 0) return;

    const camera = this.sortCamera;
    if (camera && n > 1) {
      this.computeOrder(camera, n);
    } else {
      for (let i = 0; i < n; i++) this.order[i] = i;
    }

    const dstPos = this.posSizeAttr.array as Float32Array;
    const dstColor = this.colorAttr.array as Float32Array;
    const dstParams = this.paramsAttr.array as Float32Array;
    const dstAxis = this.axisAttr.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const src = this.order[i] * 4;
      const dst = i * 4;
      dstPos[dst] = this.stagePosSize[src];
      dstPos[dst + 1] = this.stagePosSize[src + 1];
      dstPos[dst + 2] = this.stagePosSize[src + 2];
      dstPos[dst + 3] = this.stagePosSize[src + 3];
      dstColor[dst] = this.stageColor[src];
      dstColor[dst + 1] = this.stageColor[src + 1];
      dstColor[dst + 2] = this.stageColor[src + 2];
      dstColor[dst + 3] = this.stageColor[src + 3];
      dstParams[dst] = this.stageParams[src];
      dstParams[dst + 1] = this.stageParams[src + 1];
      dstParams[dst + 2] = this.stageParams[src + 2];
      dstParams[dst + 3] = this.stageParams[src + 3];
      dstAxis[dst] = this.stageAxis[src];
      dstAxis[dst + 1] = this.stageAxis[src + 1];
      dstAxis[dst + 2] = this.stageAxis[src + 2];
      dstAxis[dst + 3] = this.stageAxis[src + 3];
    }

    this.markDirty(this.posSizeAttr, this.ranges[0], n);
    this.markDirty(this.colorAttr, this.ranges[1], n);
    this.markDirty(this.paramsAttr, this.ranges[2], n);
    this.markDirty(this.axisAttr, this.ranges[3], n);
  }

  private markDirty(
    attribute: THREE.InstancedBufferAttribute,
    range: UpdateRange,
    n: number
  ): void {
    // 复用预分配的 range 对象，避免 addUpdateRange 每帧分配
    range.start = 0;
    range.count = n * 4;
    attribute.updateRanges.length = 0;
    attribute.updateRanges.push(range);
    attribute.needsUpdate = true;
  }

  /** 计数排序：按视深量化到桶，远处先画 */
  private computeOrder(camera: THREE.Camera, n: number): void {
    const e = camera.matrixWorld.elements;
    const cx = e[12];
    const cy = e[13];
    const cz = e[14];
    const fx = -e[8];
    const fy = -e[9];
    const fz = -e[10];
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    for (let i = 0; i < n; i++) {
      const i4 = i * 4;
      const depth =
        (this.stagePosSize[i4] - cx) * fx +
        (this.stagePosSize[i4 + 1] - cy) * fy +
        (this.stagePosSize[i4 + 2] - cz) * fz;
      this.depthKeys[i] = depth;
      if (depth < minDepth) minDepth = depth;
      if (depth > maxDepth) maxDepth = depth;
    }
    const range = maxDepth - minDepth;
    if (!(range > 1e-4)) {
      for (let i = 0; i < n; i++) this.order[i] = i;
      return;
    }
    const scale = (SORT_BUCKETS - 1) / range;
    const counts = this.bucketCounts;
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      // 远处 → 小桶号（先画）
      const bucket = Math.min(
        SORT_BUCKETS - 1,
        Math.max(0, Math.floor((maxDepth - this.depthKeys[i]) * scale))
      );
      this.bucketOf[i] = bucket;
      counts[bucket + 1]++;
    }
    for (let b = 0; b < SORT_BUCKETS; b++) {
      counts[b + 1] += counts[b];
    }
    for (let i = 0; i < n; i++) {
      const bucket = this.bucketOf[i];
      this.order[counts[bucket]++] = i;
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.sortCamera = null;
  }
}
