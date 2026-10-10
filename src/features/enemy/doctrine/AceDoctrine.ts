import { Vector3 } from 'three';
import { FIGHTER_TUNING, FighterDoctrine, type FighterTuning } from './FighterDoctrine';
import { DOCTRINE_RULES, type DoctrineCommand, type DoctrineContext } from './DoctrineTypes';
import { angleBetween, rotateAroundUp } from './DoctrineMath';
import { MissileRack, type MissileRackTuning } from './MissileRack';

const DEG = Math.PI / 180;

/** 王牌的追击参数：战斗机条令的加强版（更近的咬尾位、五连发、更短的间隔、脱离时加速） */
export const ACE_TUNING: Readonly<FighterTuning> = {
  ...FIGHTER_TUNING,
  SLOT_DISTANCE: 180,
  BURST_ROUNDS: 5,
  BURST_INTERVAL: 1.4,
  GUN_RANGE: 340,
  MAX_BURSTS_PER_RUN: 4,
  MAX_STATION_SECONDS: 12,
  BREAK_TURN_SCALE: 1.7,
  /** 脱离时加速到油门上限 */
  BREAK_THROTTLE: 1.3,
  PURSUIT_TURN_SCALE: 1.15,
};

/** 剪刀机动参数：起始值 */
export const ACE_SCISSORS = {
  /** 玩家在本机尾后这个锥角内（弧度，相对正后方） */
  TAIL_CONE: 60 * DEG,
  /** 玩家机头对着本机的夹角上限（弧度）与距离上限（米） */
  PLAYER_NOSE_ANGLE: 25 * DEG,
  MAX_DISTANCE: 320,
  /** 被咬尾持续这么久才开始剪刀（秒） */
  TRIGGER_SECONDS: 0.4,
  /** 每隔这么久反向一次（秒） */
  REVERSAL_SECONDS: 1.0,
  /** 每次反向相对当前航向的转向角（弧度） */
  TURN_ANGLE: 75 * DEG,
  /** 收油门逼玩家冲前 */
  THROTTLE: 0.7,
  TURN_SCALE: 1.5,
  /** 玩家离开尾后这么久就结束剪刀（秒）；最长持续时间（秒），超时改为加速脱离 */
  CLEAR_SECONDS: 0.6,
  MAX_SECONDS: 5,
} as const;

/** 王牌的追踪导弹：起始值 */
export const ACE_MISSILE = {
  /** 锁定 2.0 秒（HUD“锁定中”），单发，每架王牌 14 秒最多一发 */
  LOCK_SECONDS: 2.0,
  SALVO: 1,
  SALVO_GAP: 0,
  RELOAD_SECONDS: 14,
  BREAK_GRACE: 0.5,
  RETRY_SECONDS: 3,
  /** 发射条件：距离在这之间、机头大致对着玩家（夹角以内） */
  MIN_RANGE: 250,
  MAX_RANGE: 600,
  FACING_ANGLE: 35 * DEG,
  /**
   * 导弹航路：离玩家不到 OPEN_BELOW 就先背向拉开到 SETUP_DISTANCE，再掉头对准；
   * 远于 CLOSE_ABOVE 时加速靠近，其余时候收油门（锁定的两秒里尽量不冲进最小射程）
   */
  OPEN_BELOW: 320,
  SETUP_DISTANCE: 420,
  CLOSE_ABOVE: 540,
  /** 一次导弹航路最多准备这么久（秒，不含已经开始的锁定）：领不到令牌 / 对不准就放弃 */
  RUN_MAX_SECONDS: 8,
  /** 生成后第一次导弹航路之前的等待（秒，范围内随机） */
  FIRST_DELAY_MIN: 4,
  FIRST_DELAY_MAX: 8,
} as const satisfies MissileRackTuning & Record<string, number>;

const tmpToPlayer = new Vector3();
const tmpBackward = new Vector3();

/**
 * ACE — 决斗者：战斗机的追击条令（数值更强），外加两样：
 * - 剪刀机动（scissors）：玩家咬住它的尾巴时，收油门并左右交替急转，逼玩家冲到前面；
 * - 脱离加速：被锁定 / 导弹来袭或剪刀超时后的急转脱离以 1.3× 油门飞；
 * - 追踪导弹：挂架就绪（每 14 秒一次）时，在待命 / 拉开之后改飞一次导弹航路——拉开到约
 *   420 米、掉头对准玩家，在 250–600 米、机头大致对着玩家、持攻击令牌并领到全队导弹令牌时
 *   锁定 2.0 秒（HUD“锁定中”），发射一枚，然后回到追击。锁定中条件中断超过半秒就放弃；
 *   被锁定 / 导弹来袭照样急转脱离。Boss 战不发射。
 *
 * 阶段：战斗机的 flank / pursue / head-on / extend / break，加上 scissors、missile（导弹航路的
 * 准备）与 lock（锁定中）。
 */
export class AceDoctrine extends FighterDoctrine {
  private tailTime = 0;
  private clearTime = 0;
  private reversalTime = 0;
  private scissorSide = 1;
  private readonly rack = new MissileRack(ACE_MISSILE);
  private rolled = false;
  /** 本步已经推进过挂架计时（导弹航路里推进过就不再重复） */
  private rackTicked = false;
  /** 导弹航路：正在背向玩家拉开距离 */
  private opening = false;

  constructor() {
    super(ACE_TUNING, 'ace');
  }

  protected cancelAttack(): void {
    super.cancelAttack();
    this.tailTime = 0;
    this.clearTime = 0;
    this.reversalTime = 0;
    this.rack.cancel();
    this.opening = false;
  }

  public getPhase(): string {
    const phase = super.getPhase();
    return phase === 'missile' && this.rack.isEngaged() ? 'lock' : phase;
  }

  public getMissileRequest(): number {
    return this.rack.getRequest();
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.rack.hold(
        ACE_MISSILE.FIRST_DELAY_MIN +
          context.rng() * (ACE_MISSILE.FIRST_DELAY_MAX - ACE_MISSILE.FIRST_DELAY_MIN)
      );
    }
    this.rackTicked = false;
    super.decide(context, command);
    // 不在导弹航路里：只推进装填计时
    if (!this.rackTicked) this.rack.tick(context, command, false);
  }

  /** 被锁定 / 导弹来袭：放弃导弹锁定，照战斗机的办法急转脱离 */
  protected enterBreak(context: DoctrineContext, command: DoctrineCommand): void {
    this.rack.cancel();
    this.opening = false;
    super.enterBreak(context, command);
  }

  protected interceptSpecial(context: DoctrineContext, command: DoctrineCommand): boolean {
    if (this.interceptScissors(context, command)) return true;
    return this.interceptMissileRun(context, command);
  }

  /**
   * 导弹航路：挂架就绪时，从待命 / 拉开阶段转入——拉开到 SETUP_DISTANCE，掉头对准玩家，
   * 条件满足（250–600 米、机头对着玩家、持攻击令牌、领到导弹令牌）就锁定并发射，然后回到追击。
   * 返回 true 表示本步由它接管。
   */
  private interceptMissileRun(context: DoctrineContext, command: DoctrineCommand): boolean {
    if (this.phase !== 'missile') {
      const idle = this.phase === 'flank' || this.phase === 'extend';
      if (!idle || context.bossFight || !this.rack.isReady()) return false;
      this.gun.cancel();
      this.opening = context.distance < ACE_MISSILE.OPEN_BELOW;
      this.setPhase('missile');
    }

    this.request.wants = true;
    const engaged = this.rack.isEngaged();
    if (context.bossFight || (!engaged && this.phaseTime > ACE_MISSILE.RUN_MAX_SECONDS)) {
      // 放弃这次航路：过一会儿再试，先回到追击循环
      this.rack.cancel();
      this.rack.hold(ACE_MISSILE.RETRY_SECONDS);
      this.opening = false;
      this.setPhase('flank');
      return false;
    }

    if (!engaged) {
      if (context.distance < ACE_MISSILE.OPEN_BELOW) this.opening = true;
      else if (context.distance >= ACE_MISSILE.SETUP_DISTANCE) this.opening = false;
    } else {
      this.opening = false;
    }

    tmpToPlayer.subVectors(context.playerPosition, context.position);
    if (this.opening) {
      // 背向玩家拉开距离
      command.direction.set(-tmpToPlayer.x, 0, -tmpToPlayer.z);
      if (command.direction.lengthSq() < 1e-6) command.direction.copy(context.forward);
      this.applyAltitude(context, command, context.playerPosition.y);
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
    } else {
      command.direction.copy(tmpToPlayer);
      command.throttle =
        context.distance > ACE_MISSILE.CLOSE_ABOVE ? 1 : DOCTRINE_RULES.MIN_THROTTLE;
    }

    const ok =
      context.hasToken &&
      !this.opening &&
      context.distance >= ACE_MISSILE.MIN_RANGE &&
      context.distance <= ACE_MISSILE.MAX_RANGE &&
      angleBetween(context.forward, tmpToPlayer) < ACE_MISSILE.FACING_ANGLE;
    const event = this.rack.tick(context, command, ok);
    this.rackTicked = true;
    if (event === 'done' || event === 'aborted') {
      // 打完了（或锁定被打断）：回到追击循环——还拿着令牌就直接咬上去
      this.setPhase('flank');
      return false;
    }
    return true;
  }

  /** 玩家在本机尾后、机头对着本机、距离够近 */
  private isPlayerOnTail(context: DoctrineContext): boolean {
    if (context.distance > ACE_SCISSORS.MAX_DISTANCE) return false;
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    tmpBackward.copy(context.forward).multiplyScalar(-1);
    return (
      angleBetween(tmpBackward, tmpToPlayer) < ACE_SCISSORS.TAIL_CONE &&
      this.playerNoseAngle(context) < ACE_SCISSORS.PLAYER_NOSE_ANGLE
    );
  }

  /** 剪刀机动：返回 true 表示本步由它接管 */
  private interceptScissors(context: DoctrineContext, command: DoctrineCommand): boolean {
    const onTail = this.isPlayerOnTail(context);

    if (this.phase !== 'scissors') {
      this.tailTime = onTail ? this.tailTime + context.dt : 0;
      if (this.tailTime < ACE_SCISSORS.TRIGGER_SECONDS) return false;
      // 被咬尾：放弃当前航路（含导弹锁定），开始剪刀
      this.rack.cancel();
      this.opening = false;
      this.gun.cancel();
      if (context.hasToken) command.releaseToken = true;
      this.scissorSide = context.rng() < 0.5 ? -1 : 1;
      // 第一段只飞半程，之后的反向以原航向为中线左右对称
      this.reversalTime = ACE_SCISSORS.REVERSAL_SECONDS / 2;
      this.clearTime = 0;
      this.setPhase('scissors');
    }

    this.request.wants = false;
    this.clearTime = onTail ? 0 : this.clearTime + context.dt;
    if (this.clearTime > ACE_SCISSORS.CLEAR_SECONDS) {
      // 甩掉了：回到待命位重新申请令牌
      this.tailTime = 0;
      this.setPhase('flank');
      return false;
    }
    if (this.phaseTime > ACE_SCISSORS.MAX_SECONDS) {
      // 甩不掉：加速急转脱离
      this.tailTime = 0;
      this.enterBreak(context, command);
      return false;
    }

    this.reversalTime += context.dt;
    if (this.reversalTime >= ACE_SCISSORS.REVERSAL_SECONDS) {
      this.reversalTime = 0;
      this.scissorSide = -this.scissorSide;
    }
    command.direction.set(context.forward.x, 0, context.forward.z);
    if (command.direction.lengthSq() < 1e-8) command.direction.set(0, 0, 1);
    rotateAroundUp(command.direction, this.scissorSide * ACE_SCISSORS.TURN_ANGLE);
    this.applyAltitude(context, command, context.playerPosition.y);
    command.throttle = ACE_SCISSORS.THROTTLE;
    command.turnScale = ACE_SCISSORS.TURN_SCALE;
    return true;
  }
}
