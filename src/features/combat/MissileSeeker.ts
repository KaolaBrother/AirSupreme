import { Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import { GAME_CONSTANTS } from '@/config';

/** 屏幕像素坐标（左上原点）；visible=false 表示点在相机后方或坐标非法 */
export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

const projectionScratch = new Vector3();

/**
 * 世界坐标 → 视口像素。使用相机当前的 matrixWorldInverse / projectionMatrix
 * （CameraRig 每个渲染帧都会刷新）。点在相机后方或结果非有限数时 visible=false。
 */
export function projectToScreen(
  world: Vector3,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  out: ScreenPoint
): boolean {
  const v = projectionScratch.copy(world).applyMatrix4(camera.matrixWorldInverse);
  // 相机朝 -Z 看：z >= 0 即在相机平面后方（留 1 厘米余量避免除零）
  if (!(v.z < -0.01)) {
    out.visible = false;
    return false;
  }
  v.applyMatrix4(camera.projectionMatrix);
  const x = (v.x + 1) * 0.5 * viewportWidth;
  const y = (1 - v.y) * 0.5 * viewportHeight;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    out.visible = false;
    return false;
  }
  out.x = x;
  out.y = y;
  out.visible = true;
  return true;
}

/** 切换目标所需的最小屏幕距离优势（像素下限 / 相对捕获环半径的比例） */
const SWITCH_MARGIN_MIN_PX = 12;
const SWITCH_MARGIN_RATIO = 0.25;
/** 挑战者需要持续占优的时间（秒）：跟踪中 / 已锁定 */
const SWITCH_DWELL_TRACKING = 0.25;
const SWITCH_DWELL_LOCKED = 0.6;

/**
 * 导弹导引头（纯逻辑，无 DOM）：只要有导弹就一直工作，不需要“开始锁定”的步骤。
 *
 * - 捕获环：以准星为圆心、半径 acquireRadius（像素）。环内离准星最近的候选成为跟踪目标。
 * - 目标在捕获环内：进度按 1/lockTime 增长，满 1 即锁定。
 * - 保持环：半径 = 捕获环 × LOCK_KEEP_RATIO。目标在两环之间时进度按 LOCK_DECAY_RATE 衰减
 *   （不是清零）；已完成的锁定在保持环内一直保持。
 * - 目标离开保持环（或转到相机后方 / 超出距离）：LOCK_GRACE_TIME 秒宽限后才丢失。
 * - 目标不在候选表里（被击毁 / 回收 / 隐形）：立即丢弃，不算“丢锁”。
 * - 换目标：挑战者必须比当前目标明显更靠近准星（或当前目标已出捕获环）并持续一小段时间，
 *   换目标后进度从零开始。
 */
export class MissileSeeker {
  /** 本次 update 内发生的事件（下一次 update 开始时清零） */
  public readonly events = {
    /** 开始跟踪一个新目标（含换目标） */
    acquired: false,
    /** 锁定完成 */
    locked: false,
    /** 目标离开保持环超过宽限时间而丢失（被击毁 / 回收不算） */
    lost: false,
    /** lost 时目标是否已经完成锁定 */
    lostWhileLocked: false,
  };

  private target: Object3D | null = null;
  private progress = 0;
  private lockedOn = false;
  private outsideTimer = 0;
  private challenger: Object3D | null = null;
  private challengerTimer = 0;
  private lockTime = 1;
  private acquireRadius = 100;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private targetRange = 0;
  private readonly targetScreen: ScreenPoint = { x: 0, y: 0, visible: false };
  private readonly scratchWorld = new Vector3();
  private readonly scratchScreen: ScreenPoint = { x: 0, y: 0, visible: false };

  /** 锁定所需时间（秒），下限 0.2 防止除零 */
  public setLockTime(seconds: number): void {
    this.lockTime = Number.isFinite(seconds) ? Math.max(0.2, seconds) : 1;
  }

  public getLockTime(): number {
    return this.lockTime;
  }

  /** 捕获环半径（像素） */
  public setAcquireRadius(pixels: number): void {
    this.acquireRadius = Number.isFinite(pixels) ? Math.max(1, pixels) : 1;
  }

  public getAcquireRadius(): number {
    return this.acquireRadius;
  }

  public getKeepRadius(): number {
    return this.acquireRadius * GAME_CONSTANTS.MISSILE.LOCK_KEEP_RATIO;
  }

  public setViewport(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
  }

  /** 静默清空（复活 / 剧情冻结 / 没有导弹时）：不产生任何事件 */
  public reset(): void {
    this.target = null;
    this.progress = 0;
    this.lockedOn = false;
    this.outsideTimer = 0;
    this.challenger = null;
    this.challengerTimer = 0;
    this.targetScreen.visible = false;
    this.clearEvents();
  }

  /** 当前跟踪目标（锁定中或已锁定） */
  public getTarget(): Object3D | null {
    return this.target;
  }

  /** 已完成锁定的目标；未锁定时为 null */
  public getLockedTarget(): Object3D | null {
    return this.lockedOn ? this.target : null;
  }

  public isLocked(): boolean {
    return this.lockedOn && this.target !== null;
  }

  /** 锁定进度 0..1 */
  public getProgress(): number {
    return this.progress;
  }

  /** 跟踪目标到载机的距离（米）；无目标时为 0 */
  public getTargetRange(): number {
    return this.target ? this.targetRange : 0;
  }

  /** 最近一次 update 时目标的屏幕位置 */
  public getTargetScreen(): Readonly<ScreenPoint> {
    return this.targetScreen;
  }

  /**
   * 推进导引头。
   * @param origin 载机世界坐标（距离判定）
   * @param aim 准星的屏幕位置；visible=false 时不捕获新目标
   * @param candidates 本步的全部可锁定对象（必须是完整列表：不在表里的目标立即丢弃）
   */
  public update(
    deltaTime: number,
    origin: Vector3,
    aim: Readonly<ScreenPoint>,
    candidates: readonly Object3D[],
    camera: Camera
  ): void {
    this.clearEvents();
    // 载机坐标不是有限数：距离无从判定（NaN 的比较恒为 false，会把目标当成“在射程内”，
    // 距离读数也成了 NaN），这一步什么都不跟踪
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) {
      if (this.target) this.clearTarget();
      return;
    }
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
    const acquireRadius = this.acquireRadius;
    const keepRadius = this.getKeepRadius();
    const maxRange = GAME_CONSTANTS.MISSILE.MAX_LOCK_DISTANCE;
    const maxRangeSq = maxRange * maxRange;
    const world = this.scratchWorld;
    const screen = this.scratchScreen;

    let targetListed = false;
    let targetDistance = Infinity; // 当前目标到准星的屏幕距离；不可见 / 超距时为 Infinity
    let best: Object3D | null = null;
    let bestDistance = Infinity;
    let bestRange = 0;
    let bestX = 0;
    let bestY = 0;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const isTarget = candidate === this.target;
      if (isTarget) targetListed = true;

      candidate.getWorldPosition(world);
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(world.z)) {
        continue;
      }
      const rangeSq = world.distanceToSquared(origin);
      if (isTarget) this.targetRange = Math.sqrt(rangeSq);
      if (rangeSq > maxRangeSq) continue;
      if (!aim.visible) continue;
      if (!projectToScreen(world, camera, this.viewportWidth, this.viewportHeight, screen)) {
        if (isTarget) this.targetScreen.visible = false;
        continue;
      }

      const dx = screen.x - aim.x;
      const dy = screen.y - aim.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (isTarget) {
        targetDistance = distance;
        this.targetScreen.x = screen.x;
        this.targetScreen.y = screen.y;
        this.targetScreen.visible = true;
      }
      if (distance <= acquireRadius && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
        bestRange = Math.sqrt(rangeSq);
        bestX = screen.x;
        bestY = screen.y;
      }
    }

    // 目标已不在候选表：被击毁 / 回收 / 隐形，立即丢弃（不是丢锁，不触发 lost）
    if (this.target && !targetListed) {
      this.clearTarget();
    }

    if (this.target) {
      if (targetDistance <= keepRadius) {
        this.outsideTimer = 0;
        if (!this.lockedOn) {
          if (targetDistance <= acquireRadius) {
            this.progress = Math.min(1, this.progress + dt / this.lockTime);
          } else {
            this.decayProgress(dt);
          }
        }
      } else {
        // 保持环外 / 相机后方 / 超出距离：宽限计时，未锁定的进度同时衰减
        this.outsideTimer += dt;
        if (!this.lockedOn) this.decayProgress(dt);
        if (this.outsideTimer >= GAME_CONSTANTS.MISSILE.LOCK_GRACE_TIME) {
          this.events.lost = this.lockedOn || this.progress > 0;
          this.events.lostWhileLocked = this.lockedOn;
          this.clearTarget();
        }
      }

      if (this.target && !this.lockedOn && this.progress >= 1) {
        this.progress = 1;
        this.lockedOn = true;
        this.events.locked = true;
      }
    }

    if (!this.target) {
      if (best) this.adopt(best, bestRange, bestX, bestY);
      return;
    }

    if (!best || best === this.target) {
      this.challenger = null;
      this.challengerTimer = 0;
      return;
    }

    // 粘滞：当前目标仍在捕获环内时，挑战者必须明显更靠近准星
    const margin = Math.max(SWITCH_MARGIN_MIN_PX, acquireRadius * SWITCH_MARGIN_RATIO);
    const currentInside = targetDistance <= acquireRadius;
    if (currentInside && bestDistance + margin >= targetDistance) {
      this.challenger = null;
      this.challengerTimer = 0;
      return;
    }

    if (this.challenger !== best) {
      this.challenger = best;
      this.challengerTimer = 0;
    }
    this.challengerTimer += dt;
    const dwell = this.lockedOn ? SWITCH_DWELL_LOCKED : SWITCH_DWELL_TRACKING;
    if (this.challengerTimer >= dwell) {
      this.adopt(best, bestRange, bestX, bestY);
    }
  }

  private adopt(target: Object3D, range: number, screenX: number, screenY: number): void {
    this.target = target;
    this.progress = 0;
    this.lockedOn = false;
    this.outsideTimer = 0;
    this.challenger = null;
    this.challengerTimer = 0;
    this.targetRange = range;
    this.targetScreen.x = screenX;
    this.targetScreen.y = screenY;
    this.targetScreen.visible = true;
    this.events.acquired = true;
  }

  private clearTarget(): void {
    this.target = null;
    this.progress = 0;
    this.lockedOn = false;
    this.outsideTimer = 0;
    this.challenger = null;
    this.challengerTimer = 0;
    this.targetScreen.visible = false;
  }

  private decayProgress(dt: number): void {
    this.progress = Math.max(0, this.progress - GAME_CONSTANTS.MISSILE.LOCK_DECAY_RATE * dt);
  }

  private clearEvents(): void {
    this.events.acquired = false;
    this.events.locked = false;
    this.events.lost = false;
    this.events.lostWhileLocked = false;
  }
}
