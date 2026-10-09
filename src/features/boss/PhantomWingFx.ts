import * as THREE from 'three';
import {
  applyVerticalGradient,
  createGlowMaterial,
  createGlowSprite,
  isFiniteVector,
  type HazardProbeResult,
} from './MagmaColossusHazards';

/**
 * 第九关 Boss「幻影之翼」的专属特效 / 危险物：
 * - createPhaseShimmerMaterial：隐形 / 现形时扫过机体的六边形相位网格 + 菲涅尔轮廓光
 *   （纯着色器，无贴图，无 DOM 也能创建）。
 * - PhantomLance：激光长矛——先在航线上画出红色危险航道（半透明管道 + 四条边线 + 滚动箭头），
 *   开火后光束从机头射出并随机体沿航道推进；胶囊体判定。
 * - HoloTracerPool：全息诱饵射出的曳光（纯视觉，不造成伤害）。
 */

// ---------------------------------------------------------------------------------------------
// 相位闪烁着色器
// ---------------------------------------------------------------------------------------------

const SHIMMER_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewPosition;
void main() {
  vLocal = position;
  vNormalView = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const SHIMMER_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRimColor;
uniform float uTime;
uniform float uSweep;
uniform float uSweepGain;
uniform float uRim;
uniform float uFlash;
uniform float uPeel;
uniform float uCellSize;
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewPosition;

float hexEdge(vec2 p) {
  p /= uCellSize;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  float d = max(dot(q, vec2(0.5, 0.8660254)), q.x);
  return smoothstep(0.38, 0.49, d);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 n = normalize(vNormalView);
  vec3 v = normalize(-vViewPosition);
  float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.4);
  float edge = hexEdge(vLocal.xz);
  float band = exp(-pow((vLocal.z - uSweep) / (uCellSize * 2.4), 2.0));
  vec2 cell = floor(vLocal.xz / (uCellSize * 1.6));
  float flick = hash(cell + floor(uTime * 7.0));
  float peel = uPeel * step(0.8, hash(cell + floor(uTime * 1.4))) * (0.55 + 0.45 * flick);
  // 隐形时只剩稀疏闪烁的格子与极淡的轮廓光（细心才能追踪）；扫描带是醒目但不过曝的预警
  float lattice = uSweepGain * band * 1.5 + uFlash * 1.3 + uRim * (0.03 + 0.07 * flick * flick) + peel * 1.8;
  float intensity = edge * lattice + fres * uRim * 0.45 + band * uSweepGain * 0.22;
  vec3 color = mix(uColor, uRimColor, clamp(fres * 1.4, 0.0, 1.0)) * intensity;
  gl_FragColor = vec4(color, 1.0);
}
`;

export interface PhaseShimmerUniforms {
  [uniform: string]: THREE.IUniform;
  uColor: THREE.IUniform<THREE.Color>;
  uRimColor: THREE.IUniform<THREE.Color>;
  uTime: THREE.IUniform<number>;
  uSweep: THREE.IUniform<number>;
  uSweepGain: THREE.IUniform<number>;
  uRim: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
  uPeel: THREE.IUniform<number>;
  uCellSize: THREE.IUniform<number>;
}

export type PhaseShimmerMaterial = THREE.ShaderMaterial & { uniforms: PhaseShimmerUniforms };

/** 相位闪烁材质（加色、不写深度；cellSize 为六边形格子尺寸，米） */
export function createPhaseShimmerMaterial(
  color: number,
  rimColor: number,
  cellSize: number
): PhaseShimmerMaterial {
  const uniforms: PhaseShimmerUniforms = {
    uColor: { value: new THREE.Color(color) },
    uRimColor: { value: new THREE.Color(rimColor) },
    uTime: { value: 0 },
    uSweep: { value: 0 },
    uSweepGain: { value: 0 },
    uRim: { value: 0 },
    uFlash: { value: 0 },
    uPeel: { value: 0 },
    uCellSize: { value: Math.max(0.1, cellSize) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SHIMMER_VERTEX,
    fragmentShader: SHIMMER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  return material as PhaseShimmerMaterial;
}

// ---------------------------------------------------------------------------------------------
// 激光长矛 + 危险航道
// ---------------------------------------------------------------------------------------------

export type LanceState = 'idle' | 'telegraph' | 'fire' | 'fade';

export interface LanceSpec {
  /** 光束长度（米） */
  length: number;
  /** 光束判定半径（米） */
  radius: number;
  damage: number;
  /** 航道长度（米）：光束长度 + 机体在预警 / 开火期间的推进距离 */
  laneLength: number;
  /** 航道绘制半径（米，略大于判定半径） */
  laneRadius: number;
}

const CHEVRON_COUNT = 14;
const LANCE_FADE_TIME = 0.25;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 单位箭头组：沿 +Z 每隔 1 个单位一个“^”形箭头（水平 + 竖直两组，任何角度都看得见） */
function createChevronGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  // 线段 a→b 沿 z 方向加宽 w 的平行四边形（同时位于 a、b 所在的平面内）
  const pushQuad = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    w: number
  ): void => {
    const dz = w * 0.5;
    positions.push(ax, ay, az - dz, bx, by, bz - dz, bx, by, bz + dz);
    positions.push(ax, ay, az - dz, bx, by, bz + dz, ax, ay, az + dz);
  };
  for (let i = 0; i < CHEVRON_COUNT; i++) {
    const tip = i + 0.42;
    const back = i;
    // 水平组（XZ 平面）
    pushQuad(-0.75, 0, back, 0, 0, tip, 0.08);
    pushQuad(0, 0, tip, 0.75, 0, back, 0.08);
    // 竖直组（YZ 平面）
    pushQuad(0, -0.75, back, 0, 0, tip, 0.08);
    pushQuad(0, 0, tip, 0, 0.75, back, 0.08);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class PhantomLance {
  private readonly laneRoot: THREE.Group;
  private readonly beamRoot: THREE.Group;
  private readonly tubeGeometry: THREE.CylinderGeometry;
  private readonly railGeometry: THREE.BufferGeometry;
  private readonly chevronGeometry: THREE.BufferGeometry;
  private readonly beamGeometry: THREE.CylinderGeometry;
  private readonly tube: THREE.Mesh;
  private readonly tubeMaterial: THREE.MeshBasicMaterial;
  private readonly rails: THREE.Mesh;
  private readonly railMaterial: THREE.MeshBasicMaterial;
  private readonly chevrons: THREE.Mesh;
  private readonly chevronMaterial: THREE.MeshBasicMaterial;
  private readonly outer: THREE.Mesh;
  private readonly outerMaterial: THREE.MeshBasicMaterial;
  private readonly inner: THREE.Mesh;
  private readonly innerMaterial: THREE.MeshBasicMaterial;
  private readonly emitterGlow: THREE.Sprite;
  private readonly endGlow: THREE.Sprite;
  private state: LanceState = 'idle';
  private timer = 0;
  private time = 0;
  private telegraphTime = 1;
  private spec: LanceSpec = { length: 1, radius: 1, damage: 0, laneLength: 1, laneRadius: 1 };
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3(0, 0, 1);
  private readonly laneOrigin = new THREE.Vector3();
  private readonly laneDirection = new THREE.Vector3(0, 0, 1);
  private readonly temp = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly end = new THREE.Vector3();

  constructor(parent: THREE.Object3D, color: number = 0xff2a44, name: string = 'phantom_lance') {
    this.laneRoot = new THREE.Group();
    this.laneRoot.name = `${name}_lane`;
    this.laneRoot.visible = false;
    this.beamRoot = new THREE.Group();
    this.beamRoot.name = `${name}_beam`;
    this.beamRoot.visible = false;
    parent.add(this.laneRoot, this.beamRoot);

    // 航道管道：沿 +Z 由近及远渐隐
    this.tubeGeometry = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    this.tubeGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.tubeGeometry, 0xffffff, 0x2a0606, 0.7);
    this.tubeGeometry.rotateX(Math.PI / 2);
    this.tubeMaterial = createGlowMaterial(color, 0, {
      side: THREE.DoubleSide,
      fog: false,
      vertexColors: true,
    });
    this.tube = new THREE.Mesh(this.tubeGeometry, this.tubeMaterial);
    // 四条边线（45° 方位），同样沿航道渐隐
    const railParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const angle = Math.PI / 4 + (k * Math.PI) / 2;
      const rail = new THREE.BoxGeometry(0.05, 0.05, 1).toNonIndexed();
      rail.translate(Math.cos(angle), Math.sin(angle), 0.5);
      railParts.push(rail);
    }
    this.railGeometry = mergeSimple(railParts);
    this.railMaterial = createGlowMaterial(color, 0, { fog: false });
    this.rails = new THREE.Mesh(this.railGeometry, this.railMaterial);
    this.chevronGeometry = createChevronGeometry();
    this.chevronMaterial = createGlowMaterial(0xffc0c8, 0, { side: THREE.DoubleSide, fog: false });
    this.chevrons = new THREE.Mesh(this.chevronGeometry, this.chevronMaterial);
    for (const mesh of [this.tube, this.rails, this.chevrons]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
    }
    this.laneRoot.add(this.tube, this.rails, this.chevrons);

    // 光束：外层红色 + 内层白热核心
    this.beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
    this.beamGeometry.translate(0, 0.5, 0);
    applyVerticalGradient(this.beamGeometry, 0xffffff, 0x300610, 0.55);
    this.beamGeometry.rotateX(Math.PI / 2);
    // 外层只画正面：双面叠加会在侧视时过曝成一堵白墙
    this.outerMaterial = createGlowMaterial(color, 0, { vertexColors: true, fog: false });
    this.innerMaterial = createGlowMaterial(0xffe0ea, 0, { vertexColors: true, fog: false });
    this.outer = new THREE.Mesh(this.beamGeometry, this.outerMaterial);
    this.inner = new THREE.Mesh(this.beamGeometry, this.innerMaterial);
    for (const mesh of [this.outer, this.inner]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
    }
    this.emitterGlow = createGlowSprite(0xff5a7a, 1, 0, 'glow', false);
    this.endGlow = createGlowSprite(color, 1, 0, 'fire', false);
    this.beamRoot.add(this.outer, this.inner, this.emitterGlow, this.endGlow);
  }

  /** 画出航道（世界坐标固定）；direction 为锁定后的开火方向 */
  public telegraph(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spec: LanceSpec,
    telegraphTime: number
  ): boolean {
    if (!isFiniteVector(origin) || !isFiniteVector(direction) || direction.lengthSq() < 1e-8) {
      return false;
    }
    this.spec = { ...spec };
    this.state = 'telegraph';
    this.timer = 0;
    this.telegraphTime = Math.max(0.2, telegraphTime);
    this.laneOrigin.copy(origin);
    this.laneDirection.copy(direction).normalize();
    this.origin.copy(origin);
    this.direction.copy(this.laneDirection);
    this.laneRoot.position.copy(origin);
    this.laneRoot.quaternion.setFromUnitVectors(Z_AXIS, this.laneDirection);
    const r = Math.max(1, spec.laneRadius);
    const length = Math.max(10, spec.laneLength);
    this.tube.scale.set(r, r, length);
    this.rails.scale.set(r, r, length);
    this.chevrons.scale.set(r, r, length / CHEVRON_COUNT);
    this.laneRoot.visible = true;
    this.beamRoot.visible = false;
    return true;
  }

  /** 开火：光束从机头沿锁定方向射出 */
  public fire(): void {
    if (this.state !== 'telegraph') return;
    this.state = 'fire';
    this.timer = 0;
    this.beamRoot.visible = true;
  }

  /** 光束起点跟随机头（方向保持锁定） */
  public setOrigin(origin: THREE.Vector3): void {
    if (!isFiniteVector(origin)) return;
    this.origin.copy(origin);
  }

  /** 停止（自然结束或被打断），光束 / 航道在短时间内淡出 */
  public stop(): void {
    if (this.state === 'idle' || this.state === 'fade') return;
    this.state = 'fade';
    this.timer = 0;
  }

  public update(deltaTime: number): void {
    if (this.state === 'idle') return;
    this.time += deltaTime;
    this.timer += deltaTime;
    const t = this.time;
    const spacing = Math.max(10, this.spec.laneLength) / CHEVRON_COUNT;
    if (this.state === 'telegraph') {
      const p = Math.min(1, this.timer / this.telegraphTime);
      const pulse = 0.5 + 0.5 * Math.sin(t * (9 + 22 * p));
      this.tubeMaterial.opacity = 0.08 + 0.2 * p + 0.06 * pulse;
      this.railMaterial.opacity = 0.35 + 0.45 * pulse;
      this.chevronMaterial.opacity = 0.3 + 0.5 * p;
      // 箭头沿航道向前滚动，越接近开火越快
      this.chevrons.position.z = ((t * (60 + 220 * p)) % spacing) * 1;
      return;
    }
    if (this.state === 'fire') {
      this.applyBeam(1, t);
      this.tubeMaterial.opacity = 0.1;
      this.railMaterial.opacity = 0.35;
      this.chevronMaterial.opacity = 0.2;
      this.chevrons.position.z = (t * 320) % spacing;
      return;
    }
    // fade
    const f = Math.max(0, 1 - this.timer / LANCE_FADE_TIME);
    this.applyBeam(f, t);
    this.tubeMaterial.opacity *= f;
    this.railMaterial.opacity *= f;
    this.chevronMaterial.opacity *= f;
    if (this.timer >= LANCE_FADE_TIME) this.clear();
  }

  private applyBeam(strength: number, t: number): void {
    const { length, radius } = this.spec;
    this.beamRoot.position.copy(this.origin);
    this.beamRoot.quaternion.setFromUnitVectors(Z_AXIS, this.direction);
    const flicker = 1 + 0.14 * Math.sin(t * 53) + 0.08 * Math.sin(t * 91);
    this.outer.scale.set(radius * flicker, radius * flicker, length);
    this.inner.scale.set(radius * 0.3, radius * 0.3, length);
    this.outerMaterial.opacity = 0.5 * strength;
    this.innerMaterial.opacity = 0.85 * strength;
    const emitter = radius * 3.2 * flicker;
    this.emitterGlow.scale.set(emitter, emitter, 1);
    this.emitterGlow.material.opacity = 0.75 * strength;
    this.endGlow.position.set(0, 0, length);
    const endSize = radius * 6 * flicker;
    this.endGlow.scale.set(endSize, endSize, 1);
    this.endGlow.material.opacity = 0.7 * strength;
  }

  /** 光束胶囊体判定（仅开火阶段） */
  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    if (this.state !== 'fire' || this.spec.damage <= 0) return;
    this.temp.subVectors(target, this.origin);
    const along = THREE.MathUtils.clamp(this.temp.dot(this.direction), 0, this.spec.length);
    this.closest.copy(this.origin).addScaledVector(this.direction, along);
    const reach = this.spec.radius + targetRadius;
    if (this.closest.distanceToSquared(target) > reach * reach) return;
    if (this.spec.damage > out.damage) {
      out.damage = this.spec.damage;
      out.profile = 'laser';
      out.position.copy(this.closest);
    }
  }

  /** 目标是否位于航道内（含半径），用于测试 / 难度统计 */
  public isInLane(target: THREE.Vector3, targetRadius: number = 0): boolean {
    if (this.state === 'idle') return false;
    this.temp.subVectors(target, this.laneOrigin);
    const along = this.temp.dot(this.laneDirection);
    if (along < 0 || along > this.spec.laneLength) return false;
    this.closest.copy(this.laneOrigin).addScaledVector(this.laneDirection, along);
    const reach = this.spec.radius + targetRadius;
    return this.closest.distanceToSquared(target) <= reach * reach;
  }

  public getState(): LanceState {
    return this.state;
  }

  /** 当前光束末端（开火时有效） */
  public getEnd(out: THREE.Vector3 = this.end): THREE.Vector3 {
    return out.copy(this.origin).addScaledVector(this.direction, this.spec.length);
  }

  public clear(): void {
    this.state = 'idle';
    this.timer = 0;
    this.laneRoot.visible = false;
    this.beamRoot.visible = false;
    this.tubeMaterial.opacity = 0;
    this.railMaterial.opacity = 0;
    this.chevronMaterial.opacity = 0;
    this.outerMaterial.opacity = 0;
    this.innerMaterial.opacity = 0;
  }

  public dispose(): void {
    this.clear();
    this.laneRoot.parent?.remove(this.laneRoot);
    this.beamRoot.parent?.remove(this.beamRoot);
    this.tubeGeometry.dispose();
    this.railGeometry.dispose();
    this.chevronGeometry.dispose();
    this.beamGeometry.dispose();
    this.tubeMaterial.dispose();
    this.railMaterial.dispose();
    this.chevronMaterial.dispose();
    this.outerMaterial.dispose();
    this.innerMaterial.dispose();
    this.emitterGlow.material.dispose();
    this.endGlow.material.dispose();
  }
}

/** 合并若干非索引几何体的 position（不依赖 BufferGeometryUtils，便于无 DOM 测试） */
function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const part of parts) count += part.getAttribute('position').count;
  const positions = new Float32Array(count * 3);
  let offset = 0;
  for (const part of parts) {
    const source = part.getAttribute('position').array as Float32Array;
    positions.set(source, offset);
    offset += source.length;
    part.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// 全息曳光（纯视觉）
// ---------------------------------------------------------------------------------------------

interface TracerSlot {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  life: number;
  active: boolean;
}

const ZERO_SCALE = new THREE.Vector3(0, 0, 0);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

/** 全息曳光：单个 InstancedMesh（一次 draw call），未激活的实例缩放为 0 */
export class HoloTracerPool {
  private readonly mesh: THREE.InstancedMesh;
  private readonly slots: TracerSlot[] = [];
  private readonly geometry: THREE.BoxGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly temp = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private cursor = 0;
  private dirty = true;

  constructor(parent: THREE.Object3D, capacity: number, color: number, length: number) {
    this.geometry = new THREE.BoxGeometry(0.5, 0.5, Math.max(1, length));
    this.material = createGlowMaterial(color, 0.85, { fog: false });
    const count = Math.max(1, capacity);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.name = 'phantom_holo_tracers';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.visible = false;
    for (let i = 0; i < count; i++) {
      this.slots.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        life: 0,
        active: false,
      });
      this.matrix.compose(this.temp.set(0, 0, 0), new THREE.Quaternion(), ZERO_SCALE);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    parent.add(this.mesh);
  }

  public fire(origin: THREE.Vector3, direction: THREE.Vector3, speed: number, life: number): void {
    if (!isFiniteVector(origin) || !isFiniteVector(direction) || this.slots.length === 0) return;
    this.temp.copy(direction);
    if (this.temp.lengthSq() < 1e-8) return;
    this.temp.normalize();
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.slots.length;
    slot.velocity.copy(this.temp).multiplyScalar(speed);
    slot.position.copy(origin);
    slot.quaternion.setFromUnitVectors(Z_AXIS, this.temp);
    slot.life = life;
    slot.active = true;
    this.dirty = true;
  }

  public update(deltaTime: number): void {
    let any = false;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.active) continue;
      slot.life -= deltaTime;
      slot.position.addScaledVector(slot.velocity, deltaTime);
      if (slot.life <= 0) {
        slot.active = false;
        this.matrix.compose(slot.position, slot.quaternion, ZERO_SCALE);
      } else {
        any = true;
        this.matrix.compose(slot.position, slot.quaternion, UNIT_SCALE);
      }
      this.mesh.setMatrixAt(i, this.matrix);
      this.dirty = true;
    }
    if (this.dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.dirty = false;
    }
    this.mesh.visible = any;
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.active) count++;
    return count;
  }

  public clear(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].active = false;
      this.matrix.compose(this.slots[i].position, this.slots[i].quaternion, ZERO_SCALE);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }

  public dispose(): void {
    this.clear();
    this.mesh.parent?.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.slots.length = 0;
  }
}
