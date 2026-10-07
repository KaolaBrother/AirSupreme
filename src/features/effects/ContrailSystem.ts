import * as THREE from 'three';

/**
 * 翼尖涡流 / 凝结尾迹（带状拖尾）。
 * - 自包含、池化、可释放：所有拖尾共享一个 BufferGeometry（单 draw call）
 * - 可见度随速度、过载（G 值）与高度变化，点随寿命变宽并淡出
 * - 外部只需 attach(aircraft) 一次并每帧 update(dt)
 */

export interface ContrailAttachOptions {
  /** 局部坐标系下的翼尖位置（默认按包围盒推算左右翼尖） */
  wingtips?: THREE.Vector3[];
  /** 拖尾初始宽度（米） */
  width?: number;
  /** 拖尾点寿命（秒） */
  lifetime?: number;
  /** 颜色（线性），默认冷白 */
  color?: number;
  /** 开始出现的速度（m/s） */
  minSpeed?: number;
  /** 速度满额（m/s） */
  fullSpeed?: number;
  /** 过载阈值：从 gStart 开始出现，gFull 满额 */
  gStart?: number;
  gFull?: number;
  /** 凝结尾迹高度带（世界 Y）：从 altitudeStart 开始出现，altitudeFull 满额 */
  altitudeStart?: number;
  altitudeFull?: number;
  /** 常驻基础强度 0..1（如加力时由外部 setBoost 提升） */
  baseIntensity?: number;
}

export type ContrailHandle = number;

interface ResolvedOptions {
  width: number;
  lifetime: number;
  color: THREE.Color;
  minSpeed: number;
  fullSpeed: number;
  gStart: number;
  gFull: number;
  altitudeStart: number;
  altitudeFull: number;
  baseIntensity: number;
}

interface Ribbon {
  inUse: boolean;
  emitterId: number;
  count: number;
  positions: Float32Array;
  births: Float32Array;
  alphas: Float32Array;
  /** 正在发射（最新点跟随翼尖） */
  emitting: boolean;
  lifetime: number;
  width: number;
  color: THREE.Color;
}

interface Emitter {
  id: number;
  target: THREE.Object3D | null;
  wingtips: THREE.Vector3[];
  ribbons: number[];
  options: ResolvedOptions;
  lastPosition: THREE.Vector3;
  lastVelocity: THREE.Vector3;
  hasHistory: boolean;
  smoothedG: number;
  smoothedSpeed: number;
  boost: number;
  intensity: number;
  detached: boolean;
}

const DEFAULTS: ResolvedOptions = {
  width: 0.55,
  lifetime: 2.2,
  color: new THREE.Color(0.93, 0.96, 1),
  minSpeed: 18,
  fullSpeed: 42,
  gStart: 2.2,
  gFull: 5.5,
  altitudeStart: 220,
  altitudeFull: 420,
  baseIntensity: 0,
};

const SEGMENT_LENGTH = 2.6;
const GRAVITY = 9.81;

const vertexShader = /* glsl */ `
attribute vec3 aTangent;
attribute vec4 aParams;
attribute vec3 aColor;

varying float vAlpha;
varying float vSide;
varying vec3 vColor;

#include <fog_pars_vertex>

void main() {
  vec3 toCamera = normalize(cameraPosition - position);
  vec3 side = cross(aTangent, toCamera);
  float sideLength = length(side);
  side = sideLength > 1e-4 ? side / sideLength : vec3(0.0, 1.0, 0.0);
  vec3 world = position + side * (aParams.x * aParams.z * 0.5);
  vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = aParams.y;
  vSide = aParams.x;
  vColor = aColor;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
varying float vAlpha;
varying float vSide;
varying vec3 vColor;

#include <fog_pars_fragment>

void main() {
  float edge = 1.0 - vSide * vSide;
  float alpha = vAlpha * edge * edge;
  if (alpha < 0.003) discard;
  vec3 rgb = vColor;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    rgb = mix(rgb, fogColor, fogFactor);
    alpha *= 1.0 - fogFactor * 0.6;
  #endif
  gl_FragColor = vec4(rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha);
}
`;

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class ContrailSystem {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly scene: THREE.Scene;
  private readonly maxRibbons: number;
  private readonly pointsPerRibbon: number;
  private readonly ribbons: Ribbon[] = [];
  private readonly emitters = new Map<number, Emitter>();
  private nextEmitterId = 1;
  private time = 0;
  private disposed = false;

  private readonly positionAttr: THREE.BufferAttribute;
  private readonly tangentAttr: THREE.BufferAttribute;
  private readonly paramsAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;

  private readonly worldTip = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly acceleration = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();

  constructor(scene: THREE.Scene, options: { maxTrails?: number; pointsPerTrail?: number } = {}) {
    this.scene = scene;
    this.maxRibbons = Math.max(2, Math.floor(options.maxTrails ?? 24));
    this.pointsPerRibbon = Math.max(8, Math.floor(options.pointsPerTrail ?? 40));

    const vertexCount = this.maxRibbons * this.pointsPerRibbon * 2;
    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
    this.tangentAttr = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
    this.paramsAttr = new THREE.BufferAttribute(new Float32Array(vertexCount * 4), 4);
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
    for (const attribute of [
      this.positionAttr,
      this.tangentAttr,
      this.paramsAttr,
      this.colorAttr,
    ]) {
      attribute.setUsage(THREE.DynamicDrawUsage);
    }
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aTangent', this.tangentAttr);
    geometry.setAttribute('aParams', this.paramsAttr);
    geometry.setAttribute('aColor', this.colorAttr);

    // 静态索引：每条拖尾相邻点之间一个四边形
    const indices: number[] = [];
    for (let r = 0; r < this.maxRibbons; r++) {
      const base = r * this.pointsPerRibbon * 2;
      for (let i = 0; i < this.pointsPerRibbon - 1; i++) {
        const a = base + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
    geometry.setIndex(indices);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);

    const material = new THREE.ShaderMaterial({
      name: 'VfxContrail',
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'vfx-contrails';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);

    for (let i = 0; i < this.maxRibbons; i++) {
      this.ribbons.push({
        inUse: false,
        emitterId: 0,
        count: 0,
        positions: new Float32Array(this.pointsPerRibbon * 3),
        births: new Float32Array(this.pointsPerRibbon),
        alphas: new Float32Array(this.pointsPerRibbon),
        emitting: false,
        lifetime: DEFAULTS.lifetime,
        width: DEFAULTS.width,
        color: new THREE.Color(),
      });
    }
  }

  /**
   * 为飞机挂载翼尖拖尾；拖尾池不足时返回 -1。
   */
  attach(target: THREE.Object3D, options: ContrailAttachOptions = {}): ContrailHandle {
    if (this.disposed) return -1;
    const wingtips = (options.wingtips ?? ContrailSystem.estimateWingtips(target)).slice(0, 4);
    const free: number[] = [];
    for (let i = 0; i < this.ribbons.length && free.length < wingtips.length; i++) {
      if (!this.ribbons[i].inUse) free.push(i);
    }
    if (free.length < wingtips.length || wingtips.length === 0) {
      return -1;
    }

    const resolved: ResolvedOptions = {
      width: options.width ?? DEFAULTS.width,
      lifetime: Math.max(0.2, options.lifetime ?? DEFAULTS.lifetime),
      color: options.color !== undefined ? new THREE.Color(options.color) : DEFAULTS.color.clone(),
      minSpeed: options.minSpeed ?? DEFAULTS.minSpeed,
      fullSpeed: options.fullSpeed ?? DEFAULTS.fullSpeed,
      gStart: options.gStart ?? DEFAULTS.gStart,
      gFull: options.gFull ?? DEFAULTS.gFull,
      altitudeStart: options.altitudeStart ?? DEFAULTS.altitudeStart,
      altitudeFull: options.altitudeFull ?? DEFAULTS.altitudeFull,
      baseIntensity: THREE.MathUtils.clamp(options.baseIntensity ?? DEFAULTS.baseIntensity, 0, 1),
    };

    const id = this.nextEmitterId++;
    for (const index of free) {
      const ribbon = this.ribbons[index];
      ribbon.inUse = true;
      ribbon.emitterId = id;
      ribbon.count = 0;
      ribbon.emitting = false;
      ribbon.lifetime = resolved.lifetime;
      ribbon.width = resolved.width;
      ribbon.color.copy(resolved.color);
    }
    this.emitters.set(id, {
      id,
      target,
      wingtips: wingtips.map((tip) => tip.clone()),
      ribbons: free,
      options: resolved,
      lastPosition: new THREE.Vector3(),
      lastVelocity: new THREE.Vector3(),
      hasHistory: false,
      smoothedG: 1,
      smoothedSpeed: 0,
      boost: 0,
      intensity: 0,
      detached: false,
    });
    return id;
  }

  /** 解除挂载：已有拖尾自然淡出后回收 */
  detach(handle: ContrailHandle): void {
    const emitter = this.emitters.get(handle);
    if (!emitter) return;
    emitter.detached = true;
    emitter.target = null;
    for (const index of emitter.ribbons) {
      this.stopRibbon(this.ribbons[index]);
    }
  }

  /** 外部强度提升（如加力 0..1） */
  setBoost(handle: ContrailHandle, boost: number): void {
    const emitter = this.emitters.get(handle);
    if (emitter) emitter.boost = THREE.MathUtils.clamp(Number.isFinite(boost) ? boost : 0, 0, 1);
  }

  /** 当前可见强度（0..1），便于调试/测试 */
  getIntensity(handle: ContrailHandle): number {
    return this.emitters.get(handle)?.intensity ?? 0;
  }

  getActiveTrailCount(): number {
    let count = 0;
    for (const ribbon of this.ribbons) {
      if (ribbon.inUse && ribbon.count > 0) count++;
    }
    return count;
  }

  /** 由包围盒推算左右翼尖（局部坐标，机头 -Z） */
  static estimateWingtips(target: THREE.Object3D): THREE.Vector3[] {
    target.updateWorldMatrix(true, true);
    const inverse = target.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    const childBox = new THREE.Box3();
    const relative = new THREE.Matrix4();
    target.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      if (!bounds || bounds.isEmpty()) return;
      relative.multiplyMatrices(inverse, mesh.matrixWorld);
      childBox.copy(bounds).applyMatrix4(relative);
      box.union(childBox);
    });
    if (box.isEmpty()) {
      return [new THREE.Vector3(-3, 0, 0.5), new THREE.Vector3(3, 0, 0.5)];
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const z = center.z + size.z * 0.12;
    return [
      new THREE.Vector3(box.min.x * 0.96, center.y, z),
      new THREE.Vector3(box.max.x * 0.96, center.y, z),
    ];
  }

  update(deltaTime: number): void {
    if (this.disposed) return;
    const dt = Number.isFinite(deltaTime) ? Math.min(Math.max(deltaTime, 0), 0.1) : 0;
    this.time += dt;

    for (const emitter of this.emitters.values()) {
      if (emitter.detached || !emitter.target) {
        // 拖尾全部淡出后回收发射器
        let alive = false;
        for (const index of emitter.ribbons) {
          const ribbon = this.ribbons[index];
          this.expireRibbon(ribbon);
          if (ribbon.count > 0) alive = true;
        }
        if (!alive) {
          for (const index of emitter.ribbons) {
            const ribbon = this.ribbons[index];
            ribbon.inUse = false;
            ribbon.emitterId = 0;
          }
          this.emitters.delete(emitter.id);
        }
        continue;
      }
      this.updateEmitter(emitter, dt);
    }

    this.writeGeometry();
  }

  private updateEmitter(emitter: Emitter, dt: number): void {
    const target = emitter.target as THREE.Object3D;
    target.updateWorldMatrix(true, false);
    this.position.setFromMatrixPosition(target.matrixWorld);
    const finite =
      Number.isFinite(this.position.x) &&
      Number.isFinite(this.position.y) &&
      Number.isFinite(this.position.z);
    const visible = finite && target.visible;

    if (visible && emitter.hasHistory && dt > 1e-5) {
      this.velocity
        .copy(this.position)
        .sub(emitter.lastPosition)
        .multiplyScalar(1 / dt);
      // 瞬移（重生/传送）时丢弃本帧速度
      if (this.velocity.lengthSq() > 600 * 600) {
        this.velocity.copy(emitter.lastVelocity);
      }
      this.acceleration
        .copy(this.velocity)
        .sub(emitter.lastVelocity)
        .multiplyScalar(1 / dt);
      this.acceleration.y += GRAVITY;
      const g = this.acceleration.length() / GRAVITY;
      const blend = 1 - Math.exp(-dt / 0.15);
      emitter.smoothedG += ((Number.isFinite(g) ? Math.min(g, 15) : 1) - emitter.smoothedG) * blend;
      emitter.smoothedSpeed += (this.velocity.length() - emitter.smoothedSpeed) * blend;
      emitter.lastVelocity.copy(this.velocity);
    }
    if (visible) {
      emitter.lastPosition.copy(this.position);
      emitter.hasHistory = true;
    } else {
      emitter.hasHistory = false;
    }

    const o = emitter.options;
    const speedFactor = smoothstep(o.minSpeed, o.fullSpeed, emitter.smoothedSpeed);
    const gFactor = smoothstep(o.gStart, o.gFull, emitter.smoothedG);
    const altitudeFactor = smoothstep(o.altitudeStart, o.altitudeFull, this.position.y);
    const intensity = visible
      ? speedFactor *
        Math.max(gFactor, altitudeFactor * 0.85, o.baseIntensity, emitter.boost * 0.55)
      : 0;
    emitter.intensity = intensity;

    for (let i = 0; i < emitter.ribbons.length; i++) {
      const ribbon = this.ribbons[emitter.ribbons[i]];
      this.expireRibbon(ribbon);
      if (intensity > 0.02) {
        this.worldTip.copy(emitter.wingtips[i]).applyMatrix4(target.matrixWorld);
        this.emitRibbon(ribbon, this.worldTip, intensity);
      } else {
        this.stopRibbon(ribbon);
      }
    }
  }

  /** 去除过期点（最旧点在数组尾部） */
  private expireRibbon(ribbon: Ribbon): void {
    while (ribbon.count > 0 && this.time - ribbon.births[ribbon.count - 1] > ribbon.lifetime) {
      ribbon.count--;
    }
    if (ribbon.count === 1 && !ribbon.emitting) {
      ribbon.count = 0;
    }
  }

  private pushFront(ribbon: Ribbon, point: THREE.Vector3, alpha: number): void {
    const max = this.pointsPerRibbon;
    const n = Math.min(ribbon.count, max - 1);
    // 新点放在索引 0，旧点后移（点数很少，拷贝成本可忽略）
    ribbon.positions.copyWithin(3, 0, n * 3);
    ribbon.births.copyWithin(1, 0, n);
    ribbon.alphas.copyWithin(1, 0, n);
    ribbon.positions[0] = point.x;
    ribbon.positions[1] = point.y;
    ribbon.positions[2] = point.z;
    ribbon.births[0] = this.time;
    ribbon.alphas[0] = alpha;
    ribbon.count = n + 1;
  }

  private emitRibbon(ribbon: Ribbon, tip: THREE.Vector3, intensity: number): void {
    if (!ribbon.emitting || ribbon.count === 0) {
      // 断点起始：先放一个透明点，避免与旧拖尾连成一片
      this.pushFront(ribbon, tip, 0);
      this.pushFront(ribbon, tip, intensity);
      ribbon.emitting = true;
      return;
    }
    // 最新点（索引 0）跟随翼尖；与上一个点距离超过分段长度时“提交”新点
    const p = ribbon.positions;
    if (ribbon.count >= 2) {
      const dx = tip.x - p[3];
      const dy = tip.y - p[4];
      const dz = tip.z - p[5];
      if (dx * dx + dy * dy + dz * dz > SEGMENT_LENGTH * SEGMENT_LENGTH) {
        this.pushFront(ribbon, tip, intensity);
        return;
      }
    }
    p[0] = tip.x;
    p[1] = tip.y;
    p[2] = tip.z;
    ribbon.births[0] = this.time;
    ribbon.alphas[0] = intensity;
  }

  private stopRibbon(ribbon: Ribbon): void {
    if (!ribbon.emitting) return;
    ribbon.emitting = false;
    if (ribbon.count > 0) {
      // 结尾透明点，与下一段拖尾断开
      ribbon.alphas[0] = 0;
    }
  }

  private writeGeometry(): void {
    const positions = this.positionAttr.array as Float32Array;
    const tangents = this.tangentAttr.array as Float32Array;
    const params = this.paramsAttr.array as Float32Array;
    const colors = this.colorAttr.array as Float32Array;
    let anyVisible = false;

    for (let r = 0; r < this.ribbons.length; r++) {
      const ribbon = this.ribbons[r];
      const base = r * this.pointsPerRibbon;
      const count = ribbon.inUse ? ribbon.count : 0;
      if (count >= 2) anyVisible = true;
      const p = ribbon.positions;

      for (let i = 0; i < this.pointsPerRibbon; i++) {
        const src = Math.min(i, Math.max(0, count - 1));
        const valid = count >= 2 && i < count;
        let x = 0;
        let y = 0;
        let z = 0;
        if (count > 0) {
          x = p[src * 3];
          y = p[src * 3 + 1];
          z = p[src * 3 + 2];
        }
        // 切线：相邻点差分（两端单侧）
        if (valid) {
          const prev = Math.max(0, i - 1);
          const next = Math.min(count - 1, i + 1);
          this.tangent.set(
            p[prev * 3] - p[next * 3],
            p[prev * 3 + 1] - p[next * 3 + 1],
            p[prev * 3 + 2] - p[next * 3 + 2]
          );
          if (this.tangent.lengthSq() < 1e-8) this.tangent.set(0, 0, 1);
          else this.tangent.normalize();
        } else {
          this.tangent.set(0, 0, 1);
        }

        let alpha = 0;
        let width = ribbon.width;
        if (valid) {
          const age = this.time - ribbon.births[i];
          const lifeRatio = Math.min(1, Math.max(0, age / ribbon.lifetime));
          const fade = Math.pow(1 - lifeRatio, 1.6);
          // 翼尖处淡入，避免硬起点
          const headFade = i === 0 ? 0.35 : i === 1 ? 0.8 : 1;
          alpha = ribbon.alphas[i] * fade * headFade * 0.75;
          width = ribbon.width * (1 + 2.6 * lifeRatio);
        }

        for (let side = 0; side < 2; side++) {
          const v = (base + i) * 2 + side;
          positions[v * 3] = x;
          positions[v * 3 + 1] = y;
          positions[v * 3 + 2] = z;
          tangents[v * 3] = this.tangent.x;
          tangents[v * 3 + 1] = this.tangent.y;
          tangents[v * 3 + 2] = this.tangent.z;
          params[v * 4] = side === 0 ? -1 : 1;
          params[v * 4 + 1] = alpha;
          params[v * 4 + 2] = width;
          params[v * 4 + 3] = count > 0 ? i / Math.max(1, count - 1) : 0;
          colors[v * 3] = ribbon.color.r;
          colors[v * 3 + 1] = ribbon.color.g;
          colors[v * 3 + 2] = ribbon.color.b;
        }
      }
    }

    this.mesh.visible = anyVisible;
    if (anyVisible) {
      this.positionAttr.needsUpdate = true;
      this.tangentAttr.needsUpdate = true;
      this.paramsAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    }
  }

  /** 立即清空所有拖尾（保留挂载关系） */
  clear(): void {
    for (const ribbon of this.ribbons) {
      ribbon.count = 0;
      ribbon.emitting = false;
    }
    for (const emitter of this.emitters.values()) {
      emitter.hasHistory = false;
    }
    this.writeGeometry();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.emitters.clear();
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
