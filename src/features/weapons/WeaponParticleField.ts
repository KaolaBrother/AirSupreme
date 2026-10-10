import * as THREE from 'three';

/**
 * GPU 粒子场：一个实例化面片 = 一个粒子，粒子年龄 / 位移 / 尺寸 / 透明度全部在顶点着色器里
 * 由出生时间推算，CPU 只在发射时写入一次数据（环形缓冲 + 局部上传）。
 *
 * - 'smoke'：普通混合的程序化烟团（噪声边缘、慢速旋转、雾效）
 * - 'glow'：加色混合的光点 / 火花（可沿速度方向拉成流光）
 *
 * 一个粒子场只有一次绘制调用；武器尾迹、火花、爆炸火球、热焰弹都复用它，
 * 不占用全局 ParticleSystem 的小额度。无贴图依赖，形状完全由着色器生成。
 * 贴近相机的粒子按视深淡出（与 ParticleBatch 一致）：第一人称时自机的口焰 / 尾烟不会糊屏。
 */

export type WeaponParticleBlend = 'smoke' | 'glow';

/** 发射参数（调用方持有并复用同一个对象，避免逐粒子分配） */
export interface WeaponParticleSpec {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  /** 寿命（秒） */
  life: number;
  /** 出生 / 消亡时的直径（米） */
  size0: number;
  size1: number;
  /** 线性色（可 > 1 作为 HDR 亮度） */
  color: THREE.Color;
  alpha: number;
  /** 速度指数阻尼（1/秒） */
  drag: number;
  /** 竖直加速度（米/秒²，负值下坠，正值上浮） */
  gravity: number;
  /** 拉伸时间常数（秒）：>0 时沿速度方向拉成流光 */
  stretch: number;
  /** 淡出指数：越大消失越快 */
  fade: number;
  /** 白热时长占寿命比例（0 = 无白热） */
  heat: number;
  /** 出生时间偏移（秒）：正值延迟出生，负值表示“已经存在了一会儿”（沿线段补帧） */
  delay: number;
}

export function createParticleSpec(): WeaponParticleSpec {
  return {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    life: 1,
    size0: 1,
    size1: 1,
    color: new THREE.Color(1, 1, 1),
    alpha: 1,
    drag: 0,
    gravity: 0,
    stretch: 0,
    fade: 1,
    heat: 0,
    delay: 0,
  };
}

const VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uClearTime;
attribute vec4 aPosBirth;
attribute vec4 aVelLife;
attribute vec4 aColor;
attribute vec4 aSize;
attribute vec4 aPhys;
varying vec2 vUv;
varying vec4 vColor;
varying float vSeed;
varying float vHeat;
varying float vAge;
#include <fog_pars_vertex>
void main() {
  float birth = aPosBirth.w;
  float life = aVelLife.w;
  float age = uTime - birth;
  vUv = uv;
  vSeed = aSize.w;
  vHeat = 0.0;
  vAge = age;
  vColor = vec4(0.0);
  if (birth < uClearTime || age < 0.0 || age >= life || life <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float t = age / life;
  float drag = aPhys.x;
  float decay = exp(-drag * age);
  float travel = drag > 0.001 ? (1.0 - decay) / drag : age;
  vec3 pos = aPosBirth.xyz + aVelLife.xyz * travel;
  pos.y += 0.5 * aPhys.y * age * age;
  vec3 vel = aVelLife.xyz * decay;
  vel.y += aPhys.y * age;

  float grow = 1.0 - (1.0 - t) * (1.0 - t);
  float size = mix(aSize.x, aSize.y, grow);
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  // 贴近相机的大粒子淡出（与 ParticleBatch 相同的曲线），避免尾烟 / 口焰掠过镜头时整屏糊住
  float viewDepth = -mvPosition.z;
  float nearFade = clamp((viewDepth - 0.8) / max(size * 0.9, 0.6), 0.0, 1.0);

  vec2 axis;
  float len = size;
  if (aSize.z > 0.0) {
    vec2 v2 = (modelViewMatrix * vec4(vel, 0.0)).xy;
    float speed = length(v2);
    axis = speed > 0.0001 ? v2 / speed : vec2(0.0, 1.0);
    len = size + speed * aSize.z;
    mvPosition.xy -= axis * (len - size) * 0.5;
  } else {
    float angle = aSize.w * 6.2831853 + age * (aSize.w - 0.5) * 1.8;
    axis = vec2(cos(angle), sin(angle));
  }
  // (perp, axis) 构成右手基，保持面片正面朝向相机
  vec2 perp = vec2(axis.y, -axis.x);
  mvPosition.xy += axis * position.y * len + perp * position.x * size;
  gl_Position = projectionMatrix * mvPosition;

  float fadeOut = pow(max(1.0 - t, 0.0), aPhys.z);
  vColor = vec4(aColor.rgb, aColor.a * fadeOut * nearFade);
  vHeat = aPhys.w > 0.0 ? 1.0 - smoothstep(0.0, aPhys.w, t) : 0.0;
  #include <fog_vertex>
}
`;

const SMOKE_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec4 vColor;
varying float vSeed;
varying float vHeat;
varying float vAge;
#include <fog_pars_fragment>
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r >= 1.0) discard;
  vec2 offset = vec2(vSeed * 37.0, vSeed * 91.0);
  float n = valueNoise(p * 2.4 + offset) * 0.62 + valueNoise(p * 5.1 - offset) * 0.38;
  float shape = (1.0 - smoothstep(0.28, 1.0, r + (n - 0.5) * 0.6)) * (1.0 - smoothstep(0.78, 1.0, r));
  float alpha = vColor.a * shape * clamp(vAge * 30.0, 0.0, 1.0);
  if (alpha < 0.003) discard;
  float shade = 0.72 + 0.42 * n + 0.12 * p.y;
  vec3 color = vColor.rgb * shade;
  color = mix(color, vec3(2.2, 1.05, 0.38), vHeat * (1.0 - r) * 0.85);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const GLOW_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec4 vColor;
varying float vSeed;
varying float vHeat;
varying float vAge;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r >= 1.0) discard;
  float halo = pow(1.0 - r, 2.4);
  float core = exp(-r * r * 10.0);
  float twinkle = 0.85 + 0.15 * sin(vSeed * 113.0);
  vec3 hot = mix(vColor.rgb, vec3(1.0), 0.7);
  vec3 color = vColor.rgb * halo * 0.9 + hot * core * (0.55 + vHeat * 1.4);
  float alpha = vColor.a * twinkle;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** 局部上传区间数量超过该值时退化为整体上传 */
const MAX_UPDATE_RANGES = 24;

export class WeaponParticleField {
  public readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly capacity: number;
  private readonly posBirth: THREE.InstancedBufferAttribute;
  private readonly velLife: THREE.InstancedBufferAttribute;
  private readonly colorAlpha: THREE.InstancedBufferAttribute;
  private readonly sizeSeed: THREE.InstancedBufferAttribute;
  private readonly physics: THREE.InstancedBufferAttribute;
  private readonly attributes: THREE.InstancedBufferAttribute[];
  private cursor = 0;
  private spawned = 0;
  private time = 0;
  private dirtyStart = -1;
  private dirtyEnd = -1;
  private dirtyWrapped = false;
  /** 已请求整体上传、渲染器尚未上传：期间不能再添加局部区间 */
  private fullUploadPending = false;
  private latestBirth = -1e9;
  /** 尾迹 / 火花密度系数（低画质时降低） */
  private density = 1;

  constructor(capacity: number, blend: WeaponParticleBlend) {
    this.capacity = Math.max(16, Math.floor(capacity));
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.geometry.instanceCount = 0;

    const makeAttribute = (): THREE.InstancedBufferAttribute => {
      const attribute = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4);
      attribute.setUsage(THREE.DynamicDrawUsage);
      return attribute;
    };
    this.posBirth = makeAttribute();
    this.velLife = makeAttribute();
    this.colorAlpha = makeAttribute();
    this.sizeSeed = makeAttribute();
    this.physics = makeAttribute();
    // 初始全部视为“已死亡”：出生时间设为极早
    for (let i = 0; i < this.capacity; i++) {
      this.posBirth.array[i * 4 + 3] = -1e9;
    }
    this.geometry.setAttribute('aPosBirth', this.posBirth);
    this.geometry.setAttribute('aVelLife', this.velLife);
    this.geometry.setAttribute('aColor', this.colorAlpha);
    this.geometry.setAttribute('aSize', this.sizeSeed);
    this.geometry.setAttribute('aPhys', this.physics);
    this.attributes = [this.posBirth, this.velLife, this.colorAlpha, this.sizeSeed, this.physics];
    // 五个属性总是一起标记、一起上传：以第一个属性的上传回调为准
    this.posBirth.onUpload(() => {
      this.fullUploadPending = false;
    });

    const isSmoke = blend === 'smoke';
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uClearTime: { value: -1e8 } },
      ]),
      vertexShader: VERTEX_SHADER,
      fragmentShader: isSmoke ? SMOKE_FRAGMENT_SHADER : GLOW_FRAGMENT_SHADER,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: isSmoke ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: isSmoke,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = isSmoke ? 'weapon-smoke-field' : 'weapon-glow-field';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.mesh.matrixAutoUpdate = false;
  }

  public setDensity(density: number): void {
    this.density = Number.isFinite(density) ? Math.max(0.2, Math.min(1.5, density)) : 1;
  }

  /** 按密度系数缩放的发射数量（至少 min 个） */
  public scaledCount(count: number, min = 1): number {
    return Math.max(min, Math.round(count * this.density));
  }

  public getDensity(): number {
    return this.density;
  }

  public getTime(): number {
    return this.time;
  }

  /** 发射一个粒子（写入环形缓冲，覆盖最老的粒子） */
  public emit(spec: WeaponParticleSpec): void {
    const p = spec.position;
    const v = spec.velocity;
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      !Number.isFinite(p.z) ||
      !Number.isFinite(v.x) ||
      !Number.isFinite(v.y) ||
      !Number.isFinite(v.z) ||
      !(spec.life > 0)
    ) {
      return;
    }

    const index = this.cursor;
    const o = index * 4;
    const posBirth = this.posBirth.array as Float32Array;
    const velLife = this.velLife.array as Float32Array;
    const color = this.colorAlpha.array as Float32Array;
    const size = this.sizeSeed.array as Float32Array;
    const physics = this.physics.array as Float32Array;

    posBirth[o] = p.x;
    posBirth[o + 1] = p.y;
    posBirth[o + 2] = p.z;
    const delay = Number.isFinite(spec.delay) ? Math.max(-spec.life, spec.delay) : 0;
    const birth = this.time + delay;
    posBirth[o + 3] = birth;
    if (birth > this.latestBirth) this.latestBirth = birth;
    velLife[o] = v.x;
    velLife[o + 1] = v.y;
    velLife[o + 2] = v.z;
    velLife[o + 3] = spec.life;
    color[o] = spec.color.r;
    color[o + 1] = spec.color.g;
    color[o + 2] = spec.color.b;
    color[o + 3] = spec.alpha;
    size[o] = spec.size0;
    size[o + 1] = spec.size1;
    size[o + 2] = spec.stretch;
    size[o + 3] = Math.random();
    physics[o] = spec.drag;
    physics[o + 1] = spec.gravity;
    physics[o + 2] = spec.fade;
    physics[o + 3] = spec.heat;

    this.markDirty(index);
    this.cursor = (index + 1) % this.capacity;
    if (this.spawned < this.capacity) {
      this.spawned++;
      this.geometry.instanceCount = this.spawned;
    }
  }

  private markDirty(index: number): void {
    if (this.dirtyStart < 0) {
      this.dirtyStart = index;
      this.dirtyEnd = index;
      return;
    }
    if (index === this.dirtyEnd + 1) {
      this.dirtyEnd = index;
    } else if (index < this.dirtyStart || index > this.dirtyEnd) {
      // 环形回绕：本帧整体上传
      this.dirtyWrapped = true;
    }
  }

  /** 推进粒子时钟（每帧发射之前调用） */
  public advance(deltaTime: number): void {
    if (Number.isFinite(deltaTime) && deltaTime > 0) {
      this.time += deltaTime;
    }
    this.material.uniforms.uTime.value = this.time;
  }

  /**
   * 把上次 flush 之后写入的区间标记为待上传（每帧发射之后调用）。
   * 渲染器上传后会自行清空区间；若在两次渲染之间多次 flush，区间会累积，
   * 超过上限或环形回绕时退化为整体上传，并保持整体上传直到真正上传完成。
   */
  public flush(): void {
    if (this.dirtyStart < 0) {
      return;
    }
    const full =
      this.fullUploadPending ||
      this.dirtyWrapped ||
      this.posBirth.updateRanges.length >= MAX_UPDATE_RANGES;
    for (const attribute of this.attributes) {
      if (full) {
        attribute.clearUpdateRanges();
      } else {
        attribute.addUpdateRange(this.dirtyStart * 4, (this.dirtyEnd - this.dirtyStart + 1) * 4);
      }
      attribute.needsUpdate = true;
    }
    if (full) {
      this.fullUploadPending = true;
    }
    this.dirtyStart = -1;
    this.dirtyEnd = -1;
    this.dirtyWrapped = false;
  }

  /** advance + flush（单独使用粒子场时的便捷方法） */
  public update(deltaTime: number): void {
    this.advance(deltaTime);
    this.flush();
  }

  /** 立即隐藏所有存活 / 待出生粒子（无需重新上传缓冲） */
  public clear(): void {
    // 着色器里时间是 float32：留出足够的余量，保证新粒子出生时间严格晚于清除时刻
    const cut = Math.max(this.time, this.latestBirth) + 0.01;
    this.material.uniforms.uClearTime.value = cut;
    this.time = cut + 0.01;
    this.material.uniforms.uTime.value = this.time;
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
