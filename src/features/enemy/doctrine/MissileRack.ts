import type { DoctrineCommand, DoctrineContext } from './DoctrineTypes';

/** 一个导弹挂架的参数（王牌：单发；导弹机：双发齐射） */
export interface MissileRackTuning {
  /** 锁定时长（秒）：期间 HUD 显示“锁定中”预警，不随难度缩放 */
  LOCK_SECONDS: number;
  /** 一次齐射的发数，以及两发之间的间隔（秒） */
  SALVO: number;
  SALVO_GAP: number;
  /** 发射后再次可用前的装填时间（秒） */
  RELOAD_SECONDS: number;
  /** 锁定中条件（距离 / 朝向 / 令牌）中断这么久就放弃（秒），以及放弃后的重试间隔（秒） */
  BREAK_GRACE: number;
  RETRY_SECONDS: number;
}

export type MissileRackEvent = 'none' | 'launched' | 'done' | 'aborted';

/**
 * 导弹挂架的时序：就绪 → 锁定（LOCK_SECONDS）→ 发射（齐射时每隔 SALVO_GAP 一发）→ 装填。
 * 只管时间与全队导弹令牌的记账；距离、朝向、攻击令牌等条件由条令算好传进来。
 *
 * 全队导弹令牌（context.missileGrant）由 EnemySystem 每步按 getRequest() 发放：
 * 就绪且条件满足时申请一次齐射的发数，领到几发打几发（至少一发才开始锁定）。
 */
export class MissileRack {
  private state: 'ready' | 'locking' | 'salvo' = 'ready';
  private cooldown = 0;
  private lockTime = 0;
  private breakTime = 0;
  private gapTime = 0;
  /** 这次齐射还要打出的发数 */
  private remaining = 0;
  /** 就绪且上一步条件满足：正在等导弹令牌 */
  private wanting = false;
  /** 当前的冷却是一次发射之后的装填（而不是放弃锁定后的重试等待） */
  private reloading = false;

  constructor(private readonly tuning: Readonly<MissileRackTuning>) {}

  /** 想要的导弹令牌数（上一步 tick 之后的状态） */
  public getRequest(): number {
    if (this.state === 'ready') return this.wanting ? this.tuning.SALVO : 0;
    return this.remaining;
  }

  /** 装填完毕、可以开始新的锁定 */
  public isReady(): boolean {
    return this.state === 'ready' && this.cooldown <= 0;
  }

  /** 正在锁定或齐射中 */
  public isEngaged(): boolean {
    return this.state !== 'ready';
  }

  /** 锁定进度 0..1（未在锁定时为 0） */
  public getLockProgress(): number {
    return this.state === 'locking' ? Math.min(1, this.lockTime / this.tuning.LOCK_SECONDS) : 0;
  }

  /** 装填剩余时间（秒） */
  public getCooldown(): number {
    return this.cooldown;
  }

  /** 发射过后正在装填（放弃锁定后的短暂重试等待不算） */
  public isReloading(): boolean {
    return this.reloading && this.cooldown > 0;
  }

  /**
   * 推进一步。
   * @param conditionsOk 现在满足发射条件（距离、朝向、持有攻击令牌、不在 Boss 战……）
   * @returns 本步发生的事：'launched' = 打出一发且齐射未完；'done' = 打出最后一发；
   *          'aborted' = 锁定被放弃
   */
  public tick(
    context: DoctrineContext,
    command: DoctrineCommand,
    conditionsOk: boolean
  ): MissileRackEvent {
    const dt = context.dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown <= 0) this.reloading = false;

    if (this.state === 'ready') {
      this.wanting = conditionsOk && this.cooldown <= 0;
      if (this.wanting && context.missileGrant >= 1) {
        this.state = 'locking';
        this.lockTime = 0;
        this.breakTime = 0;
        this.remaining = Math.min(this.tuning.SALVO, Math.floor(context.missileGrant));
        command.missileLock = true;
      }
      return 'none';
    }

    if (context.missileGrant < 1) {
      // 导弹令牌被收回（进入 Boss 战等）
      this.abort();
      return 'aborted';
    }

    if (this.state === 'locking') {
      this.breakTime = conditionsOk ? 0 : this.breakTime + dt;
      if (this.breakTime > this.tuning.BREAK_GRACE) {
        this.abort();
        return 'aborted';
      }
      this.lockTime += dt;
      command.missileLock = true;
      this.remaining = Math.min(this.remaining, Math.floor(context.missileGrant));
      if (this.lockTime < this.tuning.LOCK_SECONDS) return 'none';
      return this.launch(command);
    }

    // 齐射中：隔一段时间打出下一发
    this.gapTime -= dt;
    if (this.gapTime > 0) return 'none';
    return this.launch(command);
  }

  private launch(command: DoctrineCommand): MissileRackEvent {
    command.missileLaunch = 1;
    this.remaining--;
    if (this.remaining > 0) {
      this.state = 'salvo';
      this.gapTime = this.tuning.SALVO_GAP;
      return 'launched';
    }
    this.state = 'ready';
    this.wanting = false;
    this.cooldown = this.tuning.RELOAD_SECONDS;
    this.reloading = true;
    return 'done';
  }

  private abort(): void {
    const fired = this.state === 'salvo';
    this.state = 'ready';
    this.wanting = false;
    this.remaining = 0;
    // 已经打出过一发：算一次完整的发射，照常装填
    if (fired) this.reloading = true;
    this.cooldown = Math.max(
      this.cooldown,
      fired ? this.tuning.RELOAD_SECONDS : this.tuning.RETRY_SECONDS
    );
  }

  /** 至少再等这么久才可以开始锁定（生成后的首发延迟、放弃一次航路后的间隔） */
  public hold(seconds: number): void {
    if (Number.isFinite(seconds) && seconds > this.cooldown) this.cooldown = seconds;
  }

  /** 中断（瘫痪、拴绳、重新生成）：放弃进行中的锁定；装填计时保留 */
  public cancel(): void {
    if (this.state !== 'ready') this.abort();
    this.wanting = false;
  }
}
