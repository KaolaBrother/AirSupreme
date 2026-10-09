import * as THREE from 'three';

/** 目标速度估计的合理上限（米/秒）：更大视为瞬移（复活 / 传送），不做提前量 */
const MAX_TRACKED_SPEED = 250;
/** 提前量外推的最长时间（秒） */
const MAX_LEAD_SECONDS = 4;

function isFiniteVector(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/**
 * 第 1-5 关 Boss（重炮 / 高炮 / 导弹）共用的目标速度估计与提前量瞄准：
 * 每帧用目标位置差分估计速度（轻度平滑），按弹速求一阶拦截点，再乘提前量系数。
 * 逐帧零分配；目标瞬移或出现非有限值时清零重来。
 */
export class TargetLeadTracker {
  public readonly velocity = new THREE.Vector3();
  private readonly lastPosition = new THREE.Vector3();
  private readonly step = new THREE.Vector3();
  private hasLast = false;

  /** 每帧调用一次（position 为 null 时保持上一帧估计） */
  public update(deltaTime: number, position: THREE.Vector3 | null | undefined): void {
    if (!position || !(deltaTime > 0) || !isFiniteVector(position)) return;
    if (this.hasLast) {
      this.step.subVectors(position, this.lastPosition).divideScalar(deltaTime);
      if (this.step.lengthSq() < MAX_TRACKED_SPEED * MAX_TRACKED_SPEED) {
        this.velocity.lerp(this.step, Math.min(1, deltaTime * 6));
      } else {
        this.velocity.set(0, 0, 0);
      }
    }
    this.lastPosition.copy(position);
    this.hasLast = true;
  }

  public reset(): void {
    this.velocity.set(0, 0, 0);
    this.hasLast = false;
  }

  /**
   * 瞄准点（写入 out）：target + 速度 × 拦截时间 × lead（0..1）。
   * 拦截时间按 origin → target 的距离 / 弹速迭代两次求得，上限 4 秒。
   */
  public leadPoint(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    projectileSpeed: number,
    lead: number,
    out: THREE.Vector3
  ): THREE.Vector3 {
    out.copy(target);
    const factor = Math.max(0, Math.min(1, Number.isFinite(lead) ? lead : 0));
    if (factor <= 0 || !this.hasLast || !(projectileSpeed > 0)) return out;
    let time = Math.min(MAX_LEAD_SECONDS, origin.distanceTo(target) / projectileSpeed);
    out.copy(target).addScaledVector(this.velocity, time);
    time = Math.min(MAX_LEAD_SECONDS, origin.distanceTo(out) / projectileSpeed);
    out.copy(target).addScaledVector(this.velocity, time * factor);
    if (!isFiniteVector(out)) out.copy(target);
    return out;
  }
}
