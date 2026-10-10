import { Vector3 } from 'three';
import type { Object3D } from 'three';
import { GAME_CONSTANTS } from '@/config';
import { getDeclaredHitRadius } from '@/core/CombatContracts';

/** 提前量标记：只给这个距离内、大致在机头前方的空中目标 */
const PIP_MAX_RANGE = 500;
const PIP_FRONT_COS = Math.cos((40 * Math.PI) / 180);
/** 已显示的标记换到另一个目标：新目标必须近这么多（避免两架距离相近的敌机来回跳） */
const PIP_SWITCH_RATIO = 0.85;
/** 触屏机炮辅助：提前量点离机头轴线的最大夹角与最大距离 */
const ASSIST_MAX_RANGE = 480;
const ASSIST_CONE_COS = Math.cos((2.5 * Math.PI) / 180);
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
 * - 触屏辅助：提前量点在机头轴线 2.5° 以内且不超过 480 米时，给出这一点供机炮对准。
 * 逐步调用零分配（每个目标的跟踪状态只在第一次见到时创建）。
 */
export class GunLeadSolver {
  private readonly tracks = new WeakMap<Object3D, TrackState>();
  private step = 0;

  private pipTarget: Object3D | null = null;
  private pipTime = 0;
  private pipOnTarget = false;
  private readonly pipVelocity = new Vector3();

  private assistActive = false;
  private readonly assistPoint = new Vector3();

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
    let assistCos = ASSIST_CONE_COS;
    let assistTarget: Object3D | null = null;

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

      if (assistEnabled && range <= ASSIST_MAX_RANGE && cos >= assistCos) {
        assistCos = cos;
        assistTarget = target;
        this.assistPoint.set(muzzle.x + lx, muzzle.y + ly, muzzle.z + lz);
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

    this.assistActive = assistTarget !== null;
    // 触屏辅助生效时子弹会朝提前量点飞：标记目标正被辅助瞄准也算“压住”
    if (assistTarget !== null && assistTarget === this.pipTarget) {
      this.pipOnTarget = true;
    }
  }

  /** 清空（关卡切换 / 复活）：下一步重新累积速度样本 */
  public reset(): void {
    this.pipTarget = null;
    this.pipTime = 0;
    this.pipOnTarget = false;
    this.assistActive = false;
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

  /** 触屏辅助瞄准点（世界坐标，内部复用向量）；不满足条件时为 null */
  public getAssistPoint(): Vector3 | null {
    return this.assistActive ? this.assistPoint : null;
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
