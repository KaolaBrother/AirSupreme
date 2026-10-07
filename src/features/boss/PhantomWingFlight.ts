import * as THREE from 'three';

/**
 * 第九关 Boss「幻影之翼」与其全息诱饵共用的飞行模型。
 *
 * - 机头沿本地 +Z；航向 / 俯仰分别限速趋近期望方向，姿态最终以四元数写入（不累积欧拉角）。
 * - 协调转弯：由侧向加速度求出升力方向，机体随转弯自然滚转。
 * - 只操作传入的 position 引用与内部单位向量，逐帧零分配；NaN 时回退到安全状态。
 */

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const GRAVITY_LIFT = 9.8 * 1.25;

function isFiniteVector(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export class WingFlight {
  /** 被驱动对象的位置（引用） */
  public readonly position: THREE.Vector3;
  /** 机头方向（单位向量） */
  public readonly forward = new THREE.Vector3(0, 0, 1);
  /** 升力方向（单位向量，与 forward 正交） */
  public readonly up = new THREE.Vector3(0, 1, 0);
  public speed = 0;

  private readonly lastForward = new THREE.Vector3(0, 0, 1);
  private readonly lateral = new THREE.Vector3();
  private readonly targetUp = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly xAxis = new THREE.Vector3();
  private readonly yAxis = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly roll = new THREE.Quaternion();
  private turnRate = 0;

  constructor(position: THREE.Vector3, forward?: THREE.Vector3) {
    this.position = position;
    if (forward && isFiniteVector(forward) && forward.lengthSq() > 1e-6) {
      this.forward.copy(forward).normalize();
    }
    this.lastForward.copy(this.forward);
    this.reorthogonalizeUp(WORLD_UP);
  }

  /** 直接设定朝向（出生 / 瞬移） */
  public setForward(direction: THREE.Vector3): void {
    if (!isFiniteVector(direction) || direction.lengthSq() < 1e-8) return;
    this.forward.copy(direction).normalize();
    this.lastForward.copy(this.forward);
    this.reorthogonalizeUp(WORLD_UP);
  }

  /**
   * 朝 desired 转向：航向绕世界 Y 轴以 turnRate（弧度/秒）转动，俯仰角以 0.8 × turnRate 趋近
   * 目标俯仰（限制在 ±maxPitch）。大角度转弯时自动改平俯仰（水平盘旋，而不是三维大圆急俯冲）。
   * desired 不会被修改。
   */
  public steer(dt: number, desired: THREE.Vector3, turnRate: number, maxPitch: number): void {
    this.turnRate = 0;
    if (!(dt > 0) || !isFiniteVector(desired) || desired.lengthSq() < 1e-8) return;
    const target = this.desired.copy(desired).normalize();
    const limit = THREE.MathUtils.clamp(maxPitch, 0.05, 1.45);
    const rate = Math.max(0, turnRate);
    const heading = Math.atan2(this.forward.x, this.forward.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(this.forward.y, -1, 1));
    const horizontal = Math.hypot(target.x, target.z);
    const targetHeading = horizontal > 1e-4 ? Math.atan2(target.x, target.z) : heading;
    let deltaHeading = targetHeading - heading;
    while (deltaHeading > Math.PI) deltaHeading -= Math.PI * 2;
    while (deltaHeading < -Math.PI) deltaHeading += Math.PI * 2;
    let targetPitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(target.y, -1, 1)),
      -limit,
      limit
    );
    // 急转弯时放平机头
    targetPitch *= 1 - 0.6 * Math.min(1, Math.abs(deltaHeading) / 1.5);
    const yawStep = THREE.MathUtils.clamp(deltaHeading, -rate * dt, rate * dt);
    const pitchStep = THREE.MathUtils.clamp(targetPitch - pitch, -rate * 0.8 * dt, rate * 0.8 * dt);
    const newHeading = heading + yawStep;
    const newPitch = THREE.MathUtils.clamp(pitch + pitchStep, -limit, limit);
    const cosPitch = Math.cos(newPitch);
    this.forward.set(
      cosPitch * Math.sin(newHeading),
      Math.sin(newPitch),
      cosPitch * Math.cos(newHeading)
    );
    if (!isFiniteVector(this.forward) || this.forward.lengthSq() < 1e-8) {
      this.forward.set(0, 0, 1);
    }
    this.forward.normalize();
    this.turnRate = Math.hypot(yawStep, pitchStep) / dt;
  }

  /** 速度以 response（1/秒）趋近 targetSpeed */
  public throttle(dt: number, targetSpeed: number, response: number): void {
    if (!Number.isFinite(targetSpeed)) return;
    this.speed += (targetSpeed - this.speed) * Math.min(1, Math.max(0, dt * response));
    if (!Number.isFinite(this.speed)) this.speed = 0;
  }

  /** 前进一步，并按侧向加速度更新协调转弯的升力方向 */
  public integrate(dt: number): void {
    if (!(dt > 0)) return;
    this.position.addScaledVector(this.forward, this.speed * dt);
    this.lateral
      .subVectors(this.forward, this.lastForward)
      .multiplyScalar(this.speed / Math.max(dt, 1e-4));
    this.lastForward.copy(this.forward);
    if (!isFiniteVector(this.lateral)) this.lateral.set(0, 0, 0);
    this.lateral.clampLength(0, GRAVITY_LIFT * 3.2);
    this.targetUp.set(0, GRAVITY_LIFT, 0).add(this.lateral);
    this.up.lerp(this.targetUp.normalize(), Math.min(1, dt * 3.5));
    this.reorthogonalizeUp(this.up);
    if (!isFiniteVector(this.position)) this.position.set(0, 0, 0);
  }

  /** 写入对象四元数；extraRoll 为绕机头轴额外滚转（弧度，用于桶滚 / 坠毁螺旋） */
  public orient(quaternion: THREE.Quaternion, extraRoll: number = 0): void {
    this.xAxis.crossVectors(this.up, this.forward);
    if (this.xAxis.lengthSq() < 1e-10) this.xAxis.set(1, 0, 0);
    this.xAxis.normalize();
    this.yAxis.crossVectors(this.forward, this.xAxis).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.forward);
    quaternion.setFromRotationMatrix(this.basis);
    if (extraRoll !== 0 && Number.isFinite(extraRoll)) {
      this.roll.setFromAxisAngle(this.forward, extraRoll);
      quaternion.premultiply(this.roll);
    }
  }

  /** 当前转弯角速度（弧度/秒） */
  public getTurnRate(): number {
    return this.turnRate;
  }

  /** 机体滚转角（相对水平，弧度；正 = 右翼下沉） */
  public getBank(): number {
    this.xAxis.crossVectors(this.up, this.forward);
    if (this.xAxis.lengthSq() < 1e-10) return 0;
    this.xAxis.normalize();
    return Math.asin(THREE.MathUtils.clamp(-this.xAxis.y, -1, 1));
  }

  private reorthogonalizeUp(reference: THREE.Vector3): void {
    this.targetUp.copy(reference);
    this.targetUp.addScaledVector(this.forward, -this.targetUp.dot(this.forward));
    if (this.targetUp.lengthSq() < 1e-8) {
      this.targetUp.copy(WORLD_UP).addScaledVector(this.forward, -this.forward.y);
      if (this.targetUp.lengthSq() < 1e-8) this.targetUp.set(1, 0, 0);
    }
    this.up.copy(this.targetUp.normalize());
  }
}
