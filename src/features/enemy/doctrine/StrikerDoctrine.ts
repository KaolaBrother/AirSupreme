import { JetDoctrine } from './JetDoctrine';
import type { DoctrineCommand, DoctrineContext } from './DoctrineTypes';
import { MissileRack, type MissileRackTuning } from './MissileRack';

const DEG = Math.PI / 180;

/** 导弹机条令参数：起始值，波次 / 平衡批次可调 */
export const STRIKER_TUNING = {
  /** 待在离玩家这个距离带里（米），在带的中线上盘旋 */
  BAND_MIN: 450,
  BAND_MAX: 700,
  STANDOFF_RADIUS: 575,
  /** 相对玩家高度的偏移范围（米，生成时在 ± 一半内随机） */
  HEIGHT_RANGE: 70,
  /** 锁定 2.4 秒（HUD“锁定中”），双发间隔 0.4 秒，之后掉头装填约 10 秒 */
  LOCK_SECONDS: 2.4,
  SALVO: 2,
  SALVO_GAP: 0.4,
  RELOAD_SECONDS: 10,
  BREAK_GRACE: 0.6,
  RETRY_SECONDS: 3,
  /** 发射条件：距离（带的两端各放宽一点）与机头对玩家的夹角 */
  LOCK_MIN_RANGE: 400,
  LOCK_MAX_RANGE: 760,
  FACING_ANGLE: 30 * DEG,
  /** 锁定时压着机头慢慢靠近；装填时慢速远离——又慢又脆，值得冲上去打 */
  LOCK_THROTTLE: 0.7,
  RELOAD_THROTTLE: 0.6,
  /** 装填时远离到这个距离就改为绕圈（米）：不飞出拴绳范围 */
  RELOAD_AWAY_DISTANCE: 760,
  /** 拿着攻击令牌却等不到导弹令牌 / 对不准，这么久就让出令牌（秒），之后歇一会儿 */
  TOKEN_IDLE_SECONDS: 4,
  TOKEN_REST_SECONDS: 2,
  /** 生成后第一次锁定前的等待（秒，范围内随机） */
  FIRST_DELAY_MIN: 2,
  FIRST_DELAY_MAX: 4,
} as const satisfies MissileRackTuning & Record<string, number>;

/**
 * STRIKER — 导弹机：没有机炮，待在 450–700 米外。领到攻击令牌后把机头对准玩家锁定 2.4 秒，
 * 相隔 0.4 秒打出两枚追踪导弹（受全队导弹令牌限制：只剩一个就只打一枚），然后掉头慢速
 * 远离、装填约 10 秒。对锁定和来袭导弹没有别的反应。Boss 战里不发射。
 *
 * 阶段：standoff（在距离带里盘旋）→ lock（锁定 / 齐射）→ reload（掉头装填）→ standoff。
 */
export class StrikerDoctrine extends JetDoctrine {
  public readonly id = 'striker';

  private readonly rack = new MissileRack(STRIKER_TUNING);
  private rolled = false;
  private orbitSign = 1;
  private heightOffset = 0;
  private startDelay = 0;
  private idleTime = 0;
  private restTime = 0;

  constructor() {
    super('standoff', 0);
  }

  protected cancelAttack(): void {
    this.rack.cancel();
    this.idleTime = 0;
  }

  public getMissileRequest(): number {
    return this.rack.getRequest();
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.orbitSign = context.rng() < 0.5 ? -1 : 1;
      this.heightOffset = (context.rng() - 0.5) * STRIKER_TUNING.HEIGHT_RANGE;
      this.startDelay =
        STRIKER_TUNING.FIRST_DELAY_MIN +
        context.rng() * (STRIKER_TUNING.FIRST_DELAY_MAX - STRIKER_TUNING.FIRST_DELAY_MIN);
    }
    const dt = context.dt;
    this.startDelay = Math.max(0, this.startDelay - dt);
    this.restTime = Math.max(0, this.restTime - dt);
    this.request.desiredBearing = Number.NaN;

    if (this.phase === 'reload') {
      this.decideReload(context, command);
      return;
    }

    const inRange =
      context.distance >= STRIKER_TUNING.LOCK_MIN_RANGE &&
      context.distance <= STRIKER_TUNING.LOCK_MAX_RANGE;
    const armed =
      this.rack.isEngaged() || (this.rack.isReady() && this.startDelay <= 0 && this.restTime <= 0);
    this.request.wants = armed && inRange && !context.bossFight;

    if (!context.hasToken || !this.request.wants) {
      // 没有令牌（或条件不再满足）：放弃锁定，回到距离带里盘旋
      this.rack.tick(context, command, false);
      if (context.hasToken) command.releaseToken = true;
      this.idleTime = 0;
      if (this.rack.isReloading()) {
        // 齐射打到一半丢了令牌：这次算打完，照常掉头装填
        this.request.wants = false;
        this.setPhase('reload');
        this.decideReload(context, command);
        return;
      }
      this.setPhase('standoff');
      this.flyStandoff(context, command);
      return;
    }

    // 持令牌：机头对准玩家，等导弹令牌 → 锁定 → 齐射
    command.direction.subVectors(context.playerPosition, context.position);
    command.throttle = STRIKER_TUNING.LOCK_THROTTLE;
    const facing = this.noseToPlayerAngle(context) < STRIKER_TUNING.FACING_ANGLE;
    this.rack.tick(context, command, inRange && facing);
    if (this.rack.isReloading()) {
      // 打完了（或齐射打到一半被打断）：掉头装填
      command.releaseToken = true;
      this.request.wants = false;
      this.idleTime = 0;
      this.setPhase('reload');
      return;
    }
    if (this.rack.isEngaged()) {
      this.idleTime = 0;
      this.setPhase('lock');
      return;
    }
    this.setPhase('standoff');
    this.idleTime += dt;
    if (this.idleTime > STRIKER_TUNING.TOKEN_IDLE_SECONDS) {
      command.releaseToken = true;
      this.request.wants = false;
      this.idleTime = 0;
      this.restTime = STRIKER_TUNING.TOKEN_REST_SECONDS;
    }
  }

  /** 在距离带的中线上绕玩家盘旋；离得太远时加速赶回来 */
  private flyStandoff(context: DoctrineContext, command: DoctrineCommand): void {
    this.steerOrbit(
      context,
      command,
      STRIKER_TUNING.STANDOFF_RADIUS,
      this.orbitSign,
      this.heightOffset
    );
    command.throttle = context.distance > STRIKER_TUNING.BAND_MAX ? 1.2 : 1;
  }

  /** 装填：背向玩家慢速远离；够远了就慢速绕圈，装填完回到距离带 */
  private decideReload(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;
    this.rack.tick(context, command, false);
    if (!this.rack.isReloading()) {
      this.setPhase('standoff');
      this.flyStandoff(context, command);
      return;
    }
    if (context.distance < STRIKER_TUNING.RELOAD_AWAY_DISTANCE) {
      command.direction.subVectors(context.position, context.playerPosition);
      command.direction.y = 0;
      if (command.direction.lengthSq() < 1e-6) command.direction.copy(context.forward);
      this.applyAltitude(context, command, context.playerPosition.y + this.heightOffset);
    } else {
      this.steerOrbit(
        context,
        command,
        STRIKER_TUNING.RELOAD_AWAY_DISTANCE,
        this.orbitSign,
        this.heightOffset
      );
    }
    command.throttle = STRIKER_TUNING.RELOAD_THROTTLE;
  }
}
