import * as THREE from 'three';
import { CameraShake } from './CameraShake';
import type { ShakeOffsets, ShakeProfile } from './CameraShake';
import { CockpitModel } from './CockpitModel';

/**
 * 相机组：第三人称追尾 / 第一人称座舱两种视角，平滑切换。
 *
 * - 第三人称沿用 ThirdPersonCamera 的调校（机体局部偏移 (0, 5, 15)、每 60 Hz 帧 0.1 的平滑），
 *   改为与帧率无关的指数平滑；保持“地平线水平”的观感，但竖直穿越（筋斗顶点）时
 *   以平滑滚转代替 lookAt 的瞬间翻转。
 * - 第一人称位于飞行员眼点，姿态完全跟随机体四元数（无欧拉角）。
 * - 切换：0.55 s 的 smootherstep 位置/姿态混合，路径带轻微上拱；混合接近座舱时
 *   才隐藏机体外壳（PLAYER_EXTERIOR_LAYER）并显示座舱模型。
 * - 震动：trauma（0..1，累加、衰减）驱动平移 + 旋转噪声，第一/第三人称各自的幅度。
 * - FOV：随速度比与加力平滑放大。
 * - 所有每帧计算复用预分配对象；目标位姿含 NaN/Infinity 时保持上一帧。
 */

export type CameraMode = 'third-person' | 'first-person';

export interface CameraRigFlightState {
  /** 0..1：0 = 最低巡航速度，1 = 最大速度（建议 (speed - minSpeed) / (maxSpeed - minSpeed)） */
  speedRatio: number;
  /** 是否正在加力（按住加速键） */
  boosting: boolean;
}

export interface CameraRigOptions {
  mode?: CameraMode;
  /** 第三人称机体局部偏移，默认 (0, 5, 15)（= GAME_CONSTANTS.CAMERA.OFFSET） */
  thirdPersonOffset?: Readonly<{ x: number; y: number; z: number }>;
  /** 第三人称平滑系数（每 60 Hz 帧的插值比例 0..1），默认 0.1（= GAME_CONSTANTS.CAMERA.SMOOTH_FACTOR） */
  smoothFactor?: number;
  /** 第一人称眼点（机体局部），默认 FIRST_PERSON_EYE_OFFSET */
  eyeOffset?: Readonly<{ x: number; y: number; z: number }>;
  /** 模式切换混合时长（秒），默认 0.55 */
  blendDuration?: number;
  /** 是否创建第一人称座舱模型，默认 true */
  cockpit?: boolean;
  /** 是否自动把 target 子树标记到 PLAYER_EXTERIOR_LAYER，默认 true */
  manageTargetLayers?: boolean;
}

/** 玩家飞机外观所在渲染层：第一人称时相机关闭此层以隐藏机体外壳 */
export const PLAYER_EXTERIOR_LAYER = 3;

/** 第一人称眼点（机体局部坐标：机头 -Z、上 +Y），位于外观模型的座舱气泡内 */
export const FIRST_PERSON_EYE_OFFSET: Readonly<{ x: number; y: number; z: number }> = Object.freeze(
  { x: 0, y: 0.46, z: -0.8 }
);

/** 默认混合时长（秒） */
export const CAMERA_BLEND_SECONDS = 0.55;

/** 把整棵子树（含根）只放到 PLAYER_EXTERIOR_LAYER；相机需开启该层才能看到 */
export function assignPlayerExteriorLayer(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.layers.set(PLAYER_EXTERIOR_LAYER);
  });
}

/** 开/关相机对玩家外观层的可见性 */
export function setPlayerExteriorVisible(camera: THREE.Camera, visible: boolean): void {
  if (visible) {
    camera.layers.enable(PLAYER_EXTERIOR_LAYER);
  } else {
    camera.layers.disable(PLAYER_EXTERIOR_LAYER);
  }
}

/**
 * 爆炸/冲击 → 震动强度（0..1）：随距离二次衰减，规模越大影响半径越大。
 * 例：scale 1 的爆炸 10 m 处约 0.38，60 m 处约 0.11，超出半径为 0。
 */
export function computeExplosionShake(
  distance: number,
  scale: number = 1,
  radius: number = 120
): number {
  if (!Number.isFinite(distance) || !Number.isFinite(scale) || !Number.isFinite(radius)) {
    return 0;
  }
  const size = Math.max(0, scale);
  const reach = Math.max(1, radius) * (0.6 + 0.4 * size);
  const d = Math.max(0, distance);
  if (d >= reach || size <= 0) {
    return 0;
  }
  const falloff = 1 - d / reach;
  return Math.min(1, 0.45 * size * falloff * falloff);
}

/**
 * 默认值与 GAME_CONSTANTS.CAMERA 一致（ThirdPersonCamera 的调校）。此处不 import '@/config'：
 * 其 GameConfig 在导入时访问 window，会让本模块无法在无 DOM 的运行器中加载。
 */
const DEFAULT_CHASE_OFFSET: Readonly<{ x: number; y: number; z: number }> = Object.freeze({
  x: 0,
  y: 5,
  z: 15,
});
const DEFAULT_CHASE_SMOOTH_FACTOR = 0.1;
const DEFAULT_FOV = 75;
const REFERENCE_FPS = 60;
const MAX_DELTA_SECONDS = 0.1;
/** 目标单次更新移动超过此距离视为传送（复活/读档），追尾相机直接就位 */
const TELEPORT_DISTANCE = 250;
/** 混合进度达到此值才切到座舱（相机已在座舱气泡附近） */
const COCKPIT_SWITCH_BLEND = 0.97;
/** 混合路径上拱高度（米，沿机体 up） */
const BLEND_ARC_HEIGHT = 1.4;
/** 追尾相机滚转偏移的回正弹簧角频率（rad/s，临界阻尼）：180° 约 0.8 s 回正 */
const CHASE_ROLL_SPRING = 7;
/** 期望上方向单帧跳变超过此角度（弧度，约 25°）视为越过竖直，吸收为滚转偏移 */
const CHASE_ROLL_JUMP = 0.44;
/** 视线与竖直夹角小于约 4.6° 时保持当前上方向（避免 lookAt 翻转） */
const CHASE_VERTICAL_HOLD = 0.08;

const SPEED_FOV_KICK = 4;
const BOOST_FOV_KICK = 5;
const FIRST_PERSON_FOV_KICK_SCALE = 0.85;
const FOV_RISE_SECONDS = 0.28;
const FOV_FALL_SECONDS = 0.55;
const MIN_FOV = 20;
const MAX_FOV = 120;

/** 加力时的持续机身抖动幅度（叠加在 trauma² 上） */
const BOOST_RUMBLE = 0.05;

const THIRD_PERSON_SHAKE: ShakeProfile = {
  translation: 0.6,
  depth: 0.3,
  pitch: 0.035,
  yaw: 0.035,
  roll: 0.06,
};
const FIRST_PERSON_SHAKE: ShakeProfile = {
  translation: 0.025,
  depth: 0.012,
  pitch: 0.034,
  yaw: 0.03,
  roll: 0.055,
};

function isFiniteVector(v: THREE.Vector3 | null | undefined): v is THREE.Vector3 {
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function isFiniteQuaternion(q: THREE.Quaternion | null | undefined): q is THREE.Quaternion {
  return (
    !!q &&
    Number.isFinite(q.x) &&
    Number.isFinite(q.y) &&
    Number.isFinite(q.z) &&
    Number.isFinite(q.w)
  );
}

function readOffset(
  source: Readonly<{ x: number; y: number; z: number }> | undefined,
  fallback: Readonly<{ x: number; y: number; z: number }>,
  out: THREE.Vector3
): THREE.Vector3 {
  if (
    source &&
    Number.isFinite(source.x) &&
    Number.isFinite(source.y) &&
    Number.isFinite(source.z)
  ) {
    return out.set(source.x, source.y, source.z);
  }
  return out.set(fallback.x, fallback.y, fallback.z);
}

/** 5 次 smootherstep：起止速度与加速度均为 0 */
function smootherstep(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** 角度回绕到 (-π, π] */
function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a <= -Math.PI) a += twoPi;
  else if (a > Math.PI) a -= twoPi;
  return a;
}

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

export class CameraRig {
  public onModeChanged?: (mode: CameraMode) => void;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly target: THREE.Object3D;
  private mode: CameraMode;
  /** 线性混合进度：0 = 第三人称，1 = 第一人称 */
  private blend: number;
  private readonly blendDuration: number;
  private readonly chaseSmoothFactor: number;
  private readonly manageTargetLayers: boolean;
  private initialized = false;
  private snapPending = true;
  private disposed = false;
  private taggedChildCount = -1;
  private cockpit: CockpitModel | null;
  private firstPersonView: boolean;

  private readonly baseFov: number;
  private fov: number;
  private readonly shake = new CameraShake();
  private readonly shakeOffsets: ShakeOffsets = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  private readonly shakeProfile: ShakeProfile = { ...THIRD_PERSON_SHAKE };

  private readonly thirdPersonOffset = new THREE.Vector3();
  private readonly eyeOffset = new THREE.Vector3();
  private readonly targetPosition = new THREE.Vector3();
  private readonly targetQuaternion = new THREE.Quaternion();
  private readonly lastTargetPosition = new THREE.Vector3();
  private readonly chasePosition = new THREE.Vector3();
  private readonly chaseLook = new THREE.Vector3();
  private readonly chaseUp = new THREE.Vector3(0, 1, 0);
  /** 屏幕上方向相对“地平线水平”的滚转偏移（rad）及其角速度 */
  private chaseRollOffset = 0;
  private chaseRollVelocity = 0;
  private chaseUpHeld = false;
  private readonly chaseQuaternion = new THREE.Quaternion();
  private readonly eyePosition = new THREE.Vector3();
  private readonly outPosition = new THREE.Vector3();
  private readonly outQuaternion = new THREE.Quaternion();
  private readonly shakeQuaternion = new THREE.Quaternion();
  private readonly lookMatrix = new THREE.Matrix4();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpD = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    target: THREE.Object3D,
    options: CameraRigOptions = {}
  ) {
    this.camera = camera;
    this.target = target;
    this.mode = options.mode === 'first-person' ? 'first-person' : 'third-person';
    this.blend = this.mode === 'first-person' ? 1 : 0;
    this.firstPersonView = this.mode === 'first-person';
    this.blendDuration =
      Number.isFinite(options.blendDuration) && (options.blendDuration as number) > 0
        ? (options.blendDuration as number)
        : CAMERA_BLEND_SECONDS;
    this.manageTargetLayers = options.manageTargetLayers ?? true;
    readOffset(options.thirdPersonOffset, DEFAULT_CHASE_OFFSET, this.thirdPersonOffset);
    this.chaseSmoothFactor =
      Number.isFinite(options.smoothFactor) &&
      (options.smoothFactor as number) > 0 &&
      (options.smoothFactor as number) <= 1
        ? (options.smoothFactor as number)
        : DEFAULT_CHASE_SMOOTH_FACTOR;
    readOffset(options.eyeOffset, FIRST_PERSON_EYE_OFFSET, this.eyeOffset);

    this.baseFov = Number.isFinite(camera.fov) && camera.fov > 1 ? camera.fov : DEFAULT_FOV;
    this.fov = this.baseFov;

    this.cockpit = options.cockpit === false ? null : new CockpitModel(this.eyeOffset);
    if (this.manageTargetLayers) {
      this.retagTarget();
    }
    this.applyView(this.firstPersonView);
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public isFirstPerson(): boolean {
    return this.mode === 'first-person';
  }

  /** 切换视角；immediate = true 时下一帧直接就位（无混合） */
  public setMode(mode: CameraMode, immediate: boolean = false): void {
    if (this.disposed || (mode !== 'first-person' && mode !== 'third-person')) {
      return;
    }
    const changed = mode !== this.mode;
    this.mode = mode;
    if (mode === 'first-person' && this.manageTargetLayers) {
      this.retagTarget();
    }
    if (immediate) {
      this.blend = this.getTargetBlend();
      this.applyView(smootherstep(this.blend) >= COCKPIT_SWITCH_BLEND);
    }
    if (changed) {
      this.onModeChanged?.(mode);
    }
  }

  public toggleMode(): CameraMode {
    const next: CameraMode = this.mode === 'first-person' ? 'third-person' : 'first-person';
    this.setMode(next);
    return next;
  }

  /** 累加震动创伤（0..1，封顶 1，随时间衰减） */
  public addShake(intensity: number): void {
    if (this.disposed) {
      return;
    }
    this.shake.add(intensity);
  }

  /** 当前创伤值（0..1） */
  public getShake(): number {
    return this.shake.getTrauma();
  }

  /** 缓动后的混合值：0 = 第三人称，1 = 第一人称 */
  public getBlend(): number {
    return smootherstep(this.blend);
  }

  public isBlending(): boolean {
    return this.blend !== this.getTargetBlend();
  }

  /** 下一次 update 直接把追尾相机放到理想位置（传送/复活/读档后调用） */
  public snapToTarget(): void {
    this.snapPending = true;
  }

  public update(
    targetPosition: THREE.Vector3,
    targetQuaternion: THREE.Quaternion,
    deltaTime: number,
    flight?: CameraRigFlightState
  ): void {
    if (this.disposed) {
      return;
    }
    const dt =
      Number.isFinite(deltaTime) && deltaTime > 0 ? Math.min(deltaTime, MAX_DELTA_SECONDS) : 0;
    if (!isFiniteVector(targetPosition) || !isFiniteQuaternion(targetQuaternion)) {
      // 非法位姿：保持上一帧画面，只推进震动衰减
      this.shake.update(dt);
      return;
    }
    const lengthSq = targetQuaternion.lengthSq();
    if (lengthSq < 1e-8) {
      this.shake.update(dt);
      return;
    }
    this.targetPosition.copy(targetPosition);
    this.targetQuaternion.copy(targetQuaternion).normalize();

    if (
      this.initialized &&
      this.targetPosition.distanceToSquared(this.lastTargetPosition) >
        TELEPORT_DISTANCE * TELEPORT_DISTANCE
    ) {
      this.snapPending = true;
    }
    this.lastTargetPosition.copy(this.targetPosition);
    const snap = this.snapPending || !this.initialized;

    if (this.manageTargetLayers && this.target.children.length !== this.taggedChildCount) {
      this.retagTarget();
    }

    const speedRatio =
      flight && Number.isFinite(flight.speedRatio) ? clamp01(flight.speedRatio) : 0;
    const boosting = flight?.boosting === true;

    // 1) 追尾位姿（始终更新，保证随时可以切回）
    this.updateChase(dt, snap);
    // 2) 座舱眼点
    this.eyePosition
      .copy(this.eyeOffset)
      .applyQuaternion(this.targetQuaternion)
      .add(this.targetPosition);

    // 3) 混合进度（目标不可见时——坠毁/复活等待——暂用追尾视角观察）
    const targetBlend = this.getTargetBlend();
    if (!this.initialized) {
      this.blend = targetBlend;
    } else if (this.blend !== targetBlend) {
      const step = dt / this.blendDuration;
      this.blend =
        targetBlend > this.blend
          ? Math.min(targetBlend, this.blend + step)
          : Math.max(targetBlend, this.blend - step);
    }
    const w = smootherstep(this.blend);

    // 4) 基础位姿
    this.outPosition.lerpVectors(this.chasePosition, this.eyePosition, w);
    if (w > 0 && w < 1) {
      this.tmpA.set(0, 1, 0).applyQuaternion(this.targetQuaternion);
      this.outPosition.addScaledVector(this.tmpA, BLEND_ARC_HEIGHT * Math.sin(Math.PI * w));
    }
    this.outQuaternion.slerpQuaternions(this.chaseQuaternion, this.targetQuaternion, w);

    // 5) 外壳/座舱可见性
    this.applyView(w >= COCKPIT_SWITCH_BLEND);

    // 6) 震动
    this.shake.setRumble(boosting ? BOOST_RUMBLE * (0.5 + 0.5 * speedRatio) : 0);
    this.shake.update(dt);
    this.applyShake(w);

    // 7) FOV
    this.updateFov(dt, w, speedRatio, boosting, snap);

    // 8) 写入相机（同步矩阵，便于同帧内的投影计算）
    this.camera.position.copy(this.outPosition);
    this.camera.quaternion.copy(this.outQuaternion);
    this.camera.updateMatrixWorld();

    // 9) 座舱跟随机体位姿 + 仪表
    this.updateCockpit(dt, speedRatio, boosting);

    this.initialized = true;
    this.snapPending = false;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.cockpit) {
      this.cockpit.dispose();
      this.cockpit = null;
    }
    setPlayerExteriorVisible(this.camera, true);
    if (this.manageTargetLayers) {
      // 撤销自动标记：外观回到默认层 0，任何相机都能看到
      this.target.traverse((object) => {
        object.layers.set(0);
      });
    }
    if (this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
    this.shake.reset();
    this.onModeChanged = undefined;
  }

  /** 逻辑目标混合值：第一人称且机体可见 → 1，否则 0 */
  private getTargetBlend(): number {
    return this.mode === 'first-person' && this.target.visible ? 1 : 0;
  }

  private retagTarget(): void {
    assignPlayerExteriorLayer(this.target);
    this.taggedChildCount = this.target.children.length;
  }

  /** 第一人称视图：关闭外观层 + 显示座舱；否则相反 */
  private applyView(firstPersonView: boolean): void {
    this.firstPersonView = firstPersonView;
    setPlayerExteriorVisible(this.camera, !firstPersonView);
    this.cockpit?.setVisible(firstPersonView);
  }

  private updateChase(dt: number, snap: boolean): void {
    this.tmpA
      .copy(this.thirdPersonOffset)
      .applyQuaternion(this.targetQuaternion)
      .add(this.targetPosition);
    if (snap) {
      this.chasePosition.copy(this.tmpA);
      this.chaseLook.copy(this.targetPosition);
    } else {
      // 与帧率无关：60 Hz 时每帧恰为 SMOOTH_FACTOR
      const alpha = 1 - Math.pow(1 - this.chaseSmoothFactor, dt * REFERENCE_FPS);
      this.chasePosition.lerp(this.tmpA, alpha);
      this.chaseLook.lerp(this.targetPosition, alpha);
    }

    const direction = this.tmpB.subVectors(this.chaseLook, this.chasePosition);
    const distance = direction.length();
    if (distance < 1e-5) {
      return;
    }
    direction.multiplyScalar(1 / distance);
    this.updateChaseUp(direction, dt, snap);
    this.lookMatrix.lookAt(this.chasePosition, this.chaseLook, this.chaseUp);
    this.chaseQuaternion.setFromRotationMatrix(this.lookMatrix);
  }

  /**
   * 追尾相机的“屏幕上方向”：默认严格等于世界上方向在视线垂直面上的投影（与旧 lookAt
   * 完全一致，地平线水平、无滞后）。视线越过竖直（筋斗顶点）时该投影会突然反向——
   * 此时把跳变吸收进滚转偏移 chaseRollOffset，使画面连续，再由临界阻尼弹簧把偏移
   * 平滑归零（约 0.8 s 滚转 180°），取代 lookAt 的单帧翻转。视线接近竖直时保持当前值。
   */
  private updateChaseUp(direction: THREE.Vector3, dt: number, snap: boolean): void {
    const current = this.tmpC
      .copy(this.chaseUp)
      .addScaledVector(direction, -this.chaseUp.dot(direction));
    let currentLength = current.length();
    if (currentLength < 1e-4) {
      // 退化：用机体上方向重建
      current.set(0, 1, 0).applyQuaternion(this.targetQuaternion);
      current.addScaledVector(direction, -current.dot(direction));
      currentLength = current.length();
      if (currentLength < 1e-4) {
        current.set(0, 0, 1).applyQuaternion(this.targetQuaternion);
        current.addScaledVector(direction, -current.dot(direction));
        currentLength = Math.max(current.length(), 1e-6);
      }
    }
    current.multiplyScalar(1 / currentLength);

    const dy = direction.y;
    const desired = this.tmpD.set(-dy * direction.x, 1 - dy * dy, -dy * direction.z);
    const desiredLength = desired.length();
    if (desiredLength <= CHASE_VERTICAL_HOLD) {
      // 视线近乎竖直：期望值无定义，保持当前上方向
      this.chaseUpHeld = true;
      this.chaseRollVelocity = 0;
      this.chaseUp.copy(current);
      return;
    }
    desired.multiplyScalar(1 / desiredLength);
    if (snap) {
      this.chaseRollOffset = 0;
      this.chaseRollVelocity = 0;
      this.chaseUpHeld = false;
      this.chaseUp.copy(desired);
      return;
    }

    // 当前上方向相对期望值的有符号滚转角：atan2(dir · (des × cur), des · cur)
    const offsetNow = Math.atan2(
      this.tmpA.crossVectors(desired, current).dot(direction),
      desired.dot(current)
    );
    if (
      this.chaseUpHeld ||
      Math.abs(wrapAngle(offsetNow - this.chaseRollOffset)) > CHASE_ROLL_JUMP
    ) {
      // 期望值跳变（越过竖直）或刚离开保持区：吸收为偏移，画面保持连续
      this.chaseRollOffset = offsetNow;
      this.chaseRollVelocity = 0;
    }
    this.chaseUpHeld = false;

    if (this.chaseRollOffset !== 0 || this.chaseRollVelocity !== 0) {
      const omega = CHASE_ROLL_SPRING;
      this.chaseRollVelocity +=
        (-omega * omega * this.chaseRollOffset - 2 * omega * this.chaseRollVelocity) * dt;
      this.chaseRollOffset += this.chaseRollVelocity * dt;
      if (Math.abs(this.chaseRollOffset) < 1e-4 && Math.abs(this.chaseRollVelocity) < 1e-3) {
        this.chaseRollOffset = 0;
        this.chaseRollVelocity = 0;
      }
    }

    if (this.chaseRollOffset === 0) {
      this.chaseUp.copy(desired);
      return;
    }
    // Rodrigues（desired ⊥ direction）：v cosθ + (k × v) sinθ
    this.tmpA.crossVectors(direction, desired);
    this.chaseUp
      .copy(desired)
      .multiplyScalar(Math.cos(this.chaseRollOffset))
      .addScaledVector(this.tmpA, Math.sin(this.chaseRollOffset))
      .normalize();
  }

  private applyShake(w: number): void {
    const profile = this.shakeProfile;
    profile.translation =
      THIRD_PERSON_SHAKE.translation +
      (FIRST_PERSON_SHAKE.translation - THIRD_PERSON_SHAKE.translation) * w;
    profile.depth =
      THIRD_PERSON_SHAKE.depth + (FIRST_PERSON_SHAKE.depth - THIRD_PERSON_SHAKE.depth) * w;
    profile.pitch =
      THIRD_PERSON_SHAKE.pitch + (FIRST_PERSON_SHAKE.pitch - THIRD_PERSON_SHAKE.pitch) * w;
    profile.yaw = THIRD_PERSON_SHAKE.yaw + (FIRST_PERSON_SHAKE.yaw - THIRD_PERSON_SHAKE.yaw) * w;
    profile.roll =
      THIRD_PERSON_SHAKE.roll + (FIRST_PERSON_SHAKE.roll - THIRD_PERSON_SHAKE.roll) * w;

    const offsets = this.shake.sample(profile, this.shakeOffsets);
    if (
      offsets.x === 0 &&
      offsets.y === 0 &&
      offsets.z === 0 &&
      offsets.pitch === 0 &&
      offsets.yaw === 0 &&
      offsets.roll === 0
    ) {
      return;
    }
    // 平移在相机局部坐标中施加
    this.tmpA.set(offsets.x, offsets.y, offsets.z).applyQuaternion(this.outQuaternion);
    this.outPosition.add(this.tmpA);
    // 小角度旋转四元数（≈ 轴角/2），右乘为相机局部旋转
    this.shakeQuaternion
      .set(offsets.pitch * 0.5, offsets.yaw * 0.5, offsets.roll * 0.5, 1)
      .normalize();
    this.outQuaternion.multiply(this.shakeQuaternion);
  }

  private updateFov(
    dt: number,
    w: number,
    speedRatio: number,
    boosting: boolean,
    snap: boolean
  ): void {
    const kick =
      (SPEED_FOV_KICK * speedRatio * speedRatio + (boosting ? BOOST_FOV_KICK : 0)) *
      (1 + (FIRST_PERSON_FOV_KICK_SCALE - 1) * w);
    const targetFov = Math.min(MAX_FOV, Math.max(MIN_FOV, this.baseFov + kick));
    if (snap || !this.initialized) {
      this.fov = targetFov;
    } else if (dt > 0) {
      const tau = targetFov > this.fov ? FOV_RISE_SECONDS : FOV_FALL_SECONDS;
      this.fov += (targetFov - this.fov) * (1 - Math.exp(-dt / tau));
    }
    if (!Number.isFinite(this.fov)) {
      this.fov = this.baseFov;
    }
    if (Math.abs(this.camera.fov - this.fov) > 1e-4) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateCockpit(dt: number, speedRatio: number, boosting: boolean): void {
    const cockpit = this.cockpit;
    if (!cockpit) {
      return;
    }
    // 挂到目标所在场景的根节点（世界坐标 = 根坐标）；目标未入场景时暂不显示
    let host: THREE.Object3D | null = this.target.parent;
    while (host && host.parent) {
      host = host.parent;
    }
    if (!host) {
      if (cockpit.root.parent) {
        cockpit.root.removeFromParent();
      }
      return;
    }
    if (cockpit.root.parent !== host) {
      host.add(cockpit.root);
    }
    cockpit.root.position.copy(this.targetPosition);
    cockpit.root.quaternion.copy(this.targetQuaternion);
    if (this.firstPersonView) {
      cockpit.update(dt, this.targetQuaternion, speedRatio, boosting, this.shake.getTrauma());
    }
  }
}
