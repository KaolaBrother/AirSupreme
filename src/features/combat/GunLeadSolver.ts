import { Vector3 } from 'three';
import type { Object3D } from 'three';
import { GAME_CONSTANTS } from '@/config';
import { getDeclaredHitRadius } from '@/core/CombatContracts';

/** 提前量标记：只给这个距离内、大致在机头前方的空中目标 */
const PIP_MAX_RANGE = 500;
const PIP_FRONT_COS = Math.cos((40 * Math.PI) / 180);
/** 已显示的标记换到另一个目标：新目标必须近这么多（避免两架距离相近的敌机来回跳） */
const PIP_SWITCH_RATIO = 0.85;
/** 触屏机炮辅助：偏移量小于这个值（约 0.0006°）且没有辅助目标时直接归零 */
const ASSIST_OFFSET_EPSILON = 1e-5;
const ASSIST_WEIGHT_EPSILON = 1e-3;
/** 机头“压在”提前量点上的最小判定角（桌面高亮用），目标很远时不至于小到按不住 */
const ON_TARGET_MIN_ANGLE = (0.9 * Math.PI) / 180;
/** 子弹的默认命中半径（与 ProjectilePool 一致） */
const BULLET_HIT_RADIUS = 5;
/** 速度估计：先粗筛这个距离内的目标；差分速度超过上限视为瞬移（对象池复用 / 传送） */
const TRACK_MAX_RANGE = 700;
const TRACK_MAX_SPEED = 400;
const TRACK_SMOOTHING = 0.35;
/** 连续差分这么多步之后速度才算可靠 */
const TRACK_MIN_SAMPLES = 3;

interface TrackState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** 最近一次更新的步号 */
  step: number;
  /** 连续差分次数 */
  samples: number;
}

/**
 * 机炮提前量解算（纯逻辑）：
 * - 用相邻两步的位置差估计每个目标的速度（指数平滑），不依赖敌机 AI 的内部状态；
 * - 解 |P + V·t| = s·t 得到子弹（速度 s，不继承载机速度）与目标相遇的时间 t，
 *   提前量点 = 目标位置 + V·t；
 * - 给最近的前方空中目标一个提前量标记；
 * - 触屏辅助（参数见 GAME_CONSTANTS.GUN_ASSIST）：瞄准点（提前量点）离机头轴线的夹角 θ 不超过
 *   FULL_ANGLE 时，辅助方向正对瞄准点；FULL_ANGLE 到 OUTER_ANGLE 之间偏移平滑减到零；再往外、
 *   超过 MAX_RANGE 或没有可靠解时不偏移。偏移不会超过 FULL_ANGLE。目标出现 / 消失 / 更换时，
 *   偏移在 EASE_TIME 内滑到新值，不会跳变。子弹（PlayerSystem）与机炮十字（LockOnIndicator）
 *   用的是同一个辅助方向。
 * 逐步调用零分配（每个目标的跟踪状态只在第一次见到时创建）。
 */
export class GunLeadSolver {
  private readonly tracks = new WeakMap<Object3D, TrackState>();
  private step = 0;

  private pipTarget: Object3D | null = null;
  private pipTime = 0;
  private pipOnTarget = false;
  private readonly pipVelocity = new Vector3();

  /** 触屏辅助：当前辅助目标（粘滞用） */
  private assistTarget: Object3D | null = null;
  /** 辅助偏移（世界坐标，垂直于机头方向）：辅助方向 = normalize(机头方向 + 偏移) */
  private readonly assistOffset = new Vector3();
  /** 上一步的偏移（渲染帧在两步之间插值） */
  private readonly assistPreviousOffset = new Vector3();
  /** 偏移与目标值之差：只在辅助目标变化时产生，按 EASE_TIME 衰减到零 */
  private readonly assistResidual = new Vector3();
  /** 辅助强度 0..1（收窄散布用；随 θ 的变化规律与偏移相同，同样平滑过渡） */
  private assistWeight = 0;
  private readonly assistDirection = new Vector3(0, 0, -1);

  private readonly scratchPos = new Vector3();
  private readonly nearestVelocity = new Vector3();
  private readonly previousVelocity = new Vector3();

  /**
   * @param muzzle 炮口世界坐标
   * @param forward 机头方向（单位向量）
   * @param targets 候选：前 airCount 个是空中目标（可显示提前量标记），其余只参与触屏辅助
   * @param assistEnabled 是否计算触屏辅助瞄准点
   */
  public update(
    deltaTime: number,
    muzzle: Vector3,
    forward: Vector3,
    targets: readonly Object3D[],
    airCount: number,
    assistEnabled: boolean
  ): void {
    this.step++;
    const step = this.step;
    const bulletSpeed = GAME_CONSTANTS.PROJECTILE.SPEED;
    const bulletRange = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;
    const previousPip = this.pipTarget;
    const pos = this.scratchPos;

    // 最近的合格目标 / 上一步的标记目标（仍合格时）各记一份，循环后按粘滞规则二选一
    let nearest: Object3D | null = null;
    let nearestRange = Infinity;
    let nearestTime = 0;
    let nearestOnTarget = false;
    let previousRange = Infinity;
    let previousTime = 0;
    let previousOnTarget = false;
    // 触屏辅助候选：离机头轴线最近的一个 / 上一步的辅助目标（仍合格时），循环后按粘滞规则二选一
    const assist = GAME_CONSTANTS.GUN_ASSIST;
    const previousAssist = this.assistTarget;
    const outerCos = Math.cos(assist.OUTER_ANGLE);
    let bestAssist: Object3D | null = null;
    let bestAngle = Infinity;
    let bestX = 0;
    let bestY = 0;
    let bestZ = 0;
    let heldAngle = Infinity;
    let heldX = 0;
    let heldY = 0;
    let heldZ = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      target.getWorldPosition(pos);
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
        continue;
      }
      const px = pos.x - muzzle.x;
      const py = pos.y - muzzle.y;
      const pz = pos.z - muzzle.z;
      const range = Math.sqrt(px * px + py * py + pz * pz);
      if (range > TRACK_MAX_RANGE) continue;

      const track = this.observe(target, pos, deltaTime, step);
      if (track.samples < TRACK_MIN_SAMPLES || range < 1) continue;

      const time = solveInterceptTime(px, py, pz, track.vx, track.vy, track.vz, bulletSpeed);
      if (time <= 0 || time * bulletSpeed > bulletRange) continue;

      const lx = px + track.vx * time;
      const ly = py + track.vy * time;
      const lz = pz + track.vz * time;
      const leadRange = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (leadRange < 1) continue;
      const cos = (lx * forward.x + ly * forward.y + lz * forward.z) / leadRange;

      if (assistEnabled && range <= assist.MAX_RANGE && cos >= outerCos) {
        // 夹角 θ 与瞄准点方向（单位向量）
        const angle = Math.acos(Math.min(1, cos));
        if (target === previousAssist) {
          heldAngle = angle;
          heldX = lx / leadRange;
          heldY = ly / leadRange;
          heldZ = lz / leadRange;
        }
        if (angle < bestAngle) {
          bestAssist = target;
          bestAngle = angle;
          bestX = lx / leadRange;
          bestY = ly / leadRange;
          bestZ = lz / leadRange;
        }
      }

      if (i >= airCount || range > PIP_MAX_RANGE) continue;
      if ((px * forward.x + py * forward.y + pz * forward.z) / range < PIP_FRONT_COS) continue;

      const hitRadius = Math.max(
        BULLET_HIT_RADIUS,
        getDeclaredHitRadius(target, BULLET_HIT_RADIUS)
      );
      const onAngle = Math.max(ON_TARGET_MIN_ANGLE, Math.atan2(hitRadius, leadRange));
      const onTarget = cos >= Math.cos(onAngle);
      if (target === previousPip) {
        previousRange = range;
        previousTime = time;
        previousOnTarget = onTarget;
        this.previousVelocity.set(track.vx, track.vy, track.vz);
      }
      if (range < nearestRange) {
        nearest = target;
        nearestRange = range;
        nearestTime = time;
        nearestOnTarget = onTarget;
        this.nearestVelocity.set(track.vx, track.vy, track.vz);
      }
    }

    // 粘滞：上一步的标记目标仍然合格、且最近目标没有近出一截时，保持原目标
    const keepPrevious =
      previousPip !== null &&
      previousRange < Infinity &&
      nearest !== previousPip &&
      nearestRange > previousRange * PIP_SWITCH_RATIO;
    if (keepPrevious) {
      this.pipTarget = previousPip;
      this.pipTime = previousTime;
      this.pipOnTarget = previousOnTarget;
      this.pipVelocity.copy(this.previousVelocity);
    } else {
      this.pipTarget = nearest;
      this.pipTime = nearestTime;
      this.pipOnTarget = nearestOnTarget;
      this.pipVelocity.copy(this.nearestVelocity);
    }

    // 粘滞：上一步的辅助目标仍在外锥内、且新目标没有近出一截时，保持原目标
    let assistTarget = bestAssist;
    let assistAngle = bestAngle;
    if (
      heldAngle < Infinity &&
      bestAssist !== previousAssist &&
      bestAngle > heldAngle - assist.SWITCH_MARGIN
    ) {
      assistTarget = previousAssist;
      assistAngle = heldAngle;
      bestX = heldX;
      bestY = heldY;
      bestZ = heldZ;
    }
    this.updateAssist(deltaTime, forward, assistTarget, assistAngle, bestX, bestY, bestZ);

    // 辅助方向正对提前量点时子弹会朝它飞：标记目标正被这样瞄准也算“压住”
    if (
      assistTarget !== null &&
      assistTarget === this.pipTarget &&
      assistAngle <= assist.FULL_ANGLE
    ) {
      this.pipOnTarget = true;
    }
  }

  /**
   * 触屏辅助的偏移量：目标值 g 只由夹角 θ 决定（见 assistPull），同一个目标上 g 连续变化、
   * 偏移直接跟随（不滞后）；辅助目标变化（出现 / 消失 / 更换）时 g 会跳变，差值记进 residual，
   * 按 EASE_TIME 指数衰减，偏移因此是滑过去的。
   * @param aimX 瞄准点方向（单位向量）的分量；没有辅助目标时不使用
   */
  private updateAssist(
    deltaTime: number,
    forward: Vector3,
    target: Object3D | null,
    angle: number,
    aimX: number,
    aimY: number,
    aimZ: number
  ): void {
    const assist = GAME_CONSTANTS.GUN_ASSIST;
    const offset = this.assistOffset;
    const residual = this.assistResidual;
    this.assistPreviousOffset.copy(offset);

    // 目标偏移 g：沿“机头 → 瞄准点”的方向转过 pull × θ 的角度
    let goalX = 0;
    let goalY = 0;
    let goalZ = 0;
    let goalWeight = 0;
    if (target !== null) {
      goalWeight = assistPull(angle, assist.FULL_ANGLE, assist.OUTER_ANGLE);
      const shift = angle <= assist.FULL_ANGLE ? angle : assist.FULL_ANGLE * goalWeight;
      const sin = Math.sin(angle);
      if (sin > 1e-6) {
        const cos = Math.cos(angle);
        const scale = Math.tan(shift) / sin;
        goalX = (aimX - forward.x * cos) * scale;
        goalY = (aimY - forward.y * cos) * scale;
        goalZ = (aimZ - forward.z * cos) * scale;
      }
    }

    // deltaTime 非正 / 非有限时不衰减也不前进
    const decay = deltaTime > 0 ? Math.exp((-3 * deltaTime) / assist.EASE_TIME) : 1;
    if (target !== this.assistTarget) {
      residual.set(offset.x - goalX, offset.y - goalY, offset.z - goalZ);
      this.assistTarget = target;
    }
    residual.multiplyScalar(decay);
    offset.set(goalX + residual.x, goalY + residual.y, goalZ + residual.z);

    // 机头方向每步都在变：去掉沿机头方向的分量，并把偏移夹在 FULL_ANGLE 以内
    offset.addScaledVector(forward, -offset.dot(forward));
    const maxOffset = Math.tan(assist.FULL_ANGLE);
    const lengthSq = offset.lengthSq();
    if (!Number.isFinite(lengthSq)) {
      offset.set(0, 0, 0);
    } else if (lengthSq > maxOffset * maxOffset) {
      offset.multiplyScalar(maxOffset / Math.sqrt(lengthSq));
    } else if (target === null && lengthSq < ASSIST_OFFSET_EPSILON * ASSIST_OFFSET_EPSILON) {
      offset.set(0, 0, 0);
    }
    residual.set(offset.x - goalX, offset.y - goalY, offset.z - goalZ);

    this.assistWeight += (goalWeight - this.assistWeight) * (1 - decay);
    if (target === null && this.assistWeight < ASSIST_WEIGHT_EPSILON) {
      this.assistWeight = 0;
    }

    this.assistDirection.copy(forward).add(offset).normalize();
  }

  /** 清空（关卡切换 / 复活）：下一步重新累积速度样本 */
  public reset(): void {
    this.pipTarget = null;
    this.pipTime = 0;
    this.pipOnTarget = false;
    this.assistTarget = null;
    this.assistOffset.set(0, 0, 0);
    this.assistPreviousOffset.set(0, 0, 0);
    this.assistResidual.set(0, 0, 0);
    this.assistWeight = 0;
    // 步号跳变让所有旧跟踪状态失效（下一次 observe 时样本数归零）
    this.step += 2;
  }

  /** 提前量标记对应的目标；没有可靠解时为 null */
  public getPipTarget(): Object3D | null {
    return this.pipTarget;
  }

  /** 机头轴线是否已经压在提前量点上（开火即可命中） */
  public isPipOnTarget(): boolean {
    return this.pipTarget !== null && this.pipOnTarget;
  }

  /**
   * 提前量点的世界坐标：目标当前位置（渲染帧里是插值后的位置）+ 估计速度 × 相遇时间。
   * @returns 没有标记目标时返回 false
   */
  public getPipPoint(out: Vector3): boolean {
    const target = this.pipTarget;
    if (!target) return false;
    target.getWorldPosition(out);
    out.addScaledVector(this.pipVelocity, this.pipTime);
    return Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z);
  }

  /** 触屏辅助的当前目标；没有时为 null */
  public getAssistTarget(): Object3D | null {
    return this.assistTarget;
  }

  /**
   * 这一步的辅助方向（世界坐标单位向量，内部复用向量）：子弹沿它发射。
   * 没有辅助（偏移与强度都为零）时为 null，子弹沿机头方向发射。
   */
  public getAssistDirection(): Vector3 | null {
    if (this.assistWeight <= 0 && this.assistOffset.lengthSq() === 0) return null;
    const direction = this.assistDirection;
    const finite =
      Number.isFinite(direction.x) && Number.isFinite(direction.y) && Number.isFinite(direction.z);
    return finite ? direction : null;
  }

  /** 辅助强度 0..1：θ 在 FULL_ANGLE 以内为 1，到 OUTER_ANGLE 平滑减到 0 */
  public getAssistWeight(): number {
    return this.assistWeight;
  }

  /**
   * 渲染帧的辅助方向：上一步与这一步的偏移按 alpha 插值，加到（插值后的）机头方向上。
   * 与 getAssistDirection 是同一个量——alpha = 1 时就是这一步子弹用的方向。
   * @param forward 渲染帧的机头方向（单位向量）；可以与 out 是同一个对象
   * @returns 没有偏移（机炮十字就在机头轴线上）时返回 false，out 不变
   */
  public getRenderAssistDirection(forward: Vector3, alpha: number, out: Vector3): boolean {
    const previous = this.assistPreviousOffset;
    const current = this.assistOffset;
    if (previous.lengthSq() === 0 && current.lengthSq() === 0) return false;
    const t = alpha <= 0 ? 0 : alpha >= 1 ? 1 : alpha;
    const x = forward.x + previous.x + (current.x - previous.x) * t;
    const y = forward.y + previous.y + (current.y - previous.y) * t;
    const z = forward.z + previous.z + (current.z - previous.z) * t;
    const length = Math.sqrt(x * x + y * y + z * z);
    if (!Number.isFinite(length) || length < 1e-6) return false;
    out.set(x / length, y / length, z / length);
    return true;
  }

  private observe(target: Object3D, pos: Vector3, deltaTime: number, step: number): TrackState {
    let track = this.tracks.get(target);
    if (!track) {
      track = { x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, step, samples: 0 };
      this.tracks.set(target, track);
      return track;
    }

    if (track.step === step - 1 && deltaTime > 1e-5) {
      const vx = (pos.x - track.x) / deltaTime;
      const vy = (pos.y - track.y) / deltaTime;
      const vz = (pos.z - track.z) / deltaTime;
      const speedSq = vx * vx + vy * vy + vz * vz;
      if (speedSq > TRACK_MAX_SPEED * TRACK_MAX_SPEED || !Number.isFinite(speedSq)) {
        track.samples = 0;
        track.vx = 0;
        track.vy = 0;
        track.vz = 0;
      } else if (track.samples === 0) {
        track.vx = vx;
        track.vy = vy;
        track.vz = vz;
        track.samples = 1;
      } else {
        track.vx += (vx - track.vx) * TRACK_SMOOTHING;
        track.vy += (vy - track.vy) * TRACK_SMOOTHING;
        track.vz += (vz - track.vz) * TRACK_SMOOTHING;
        track.samples++;
      }
    } else if (track.step !== step) {
      // 中间有步数没见到这个目标：样本作废，重新累积
      track.samples = 0;
      track.vx = 0;
      track.vy = 0;
      track.vz = 0;
    }

    track.x = pos.x;
    track.y = pos.y;
    track.z = pos.z;
    track.step = step;
    return track;
  }
}

/**
 * 辅助强度：夹角 θ ≤ full 时为 1；full 到 outer 之间按 smoothstep 减到 0；再往外为 0。
 * 偏移角 = θ（θ ≤ full）或 full × 强度（full < θ < outer），两个边界上都连续，且不超过 full。
 */
function assistPull(angle: number, full: number, outer: number): number {
  if (!(angle < outer)) return 0;
  if (angle <= full) return 1;
  const u = (outer - angle) / (outer - full);
  return u * u * (3 - 2 * u);
}

/**
 * 解 |P + V·t| = s·t 的最小正根（子弹从原点以速度 s 直线飞行，目标相对位置 P、速度 V）。
 * 无解返回 -1。
 */
function solveInterceptTime(
  px: number,
  py: number,
  pz: number,
  vx: number,
  vy: number,
  vz: number,
  bulletSpeed: number
): number {
  const a = vx * vx + vy * vy + vz * vz - bulletSpeed * bulletSpeed;
  const b = 2 * (px * vx + py * vy + pz * vz);
  const c = px * px + py * py + pz * pz;
  if (Math.abs(a) < 1e-6) {
    return b < -1e-6 ? -c / b : -1;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return -1;
  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  const low = Math.min(t1, t2);
  const high = Math.max(t1, t2);
  if (low > 0) return low;
  return high > 0 ? high : -1;
}
