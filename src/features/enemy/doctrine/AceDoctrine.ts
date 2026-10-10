import { Vector3 } from 'three';
import { FIGHTER_TUNING, FighterDoctrine, type FighterTuning } from './FighterDoctrine';
import type { DoctrineCommand, DoctrineContext } from './DoctrineTypes';
import { angleBetween, rotateAroundUp } from './DoctrineMath';

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

const tmpToPlayer = new Vector3();
const tmpBackward = new Vector3();

/**
 * ACE — 决斗者：战斗机的追击条令（数值更强），外加两样：
 * - 剪刀机动（scissors）：玩家咬住它的尾巴时，收油门并左右交替急转，逼玩家冲到前面；
 * - 脱离加速：被锁定 / 导弹来袭或剪刀超时后的急转脱离以 1.3× 油门飞。
 *
 * 导弹（里程碑 2）不在这里。
 */
export class AceDoctrine extends FighterDoctrine {
  private tailTime = 0;
  private clearTime = 0;
  private reversalTime = 0;
  private scissorSide = 1;

  constructor() {
    super(ACE_TUNING, 'ace');
  }

  protected cancelAttack(): void {
    super.cancelAttack();
    this.tailTime = 0;
    this.clearTime = 0;
    this.reversalTime = 0;
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

  protected interceptSpecial(context: DoctrineContext, command: DoctrineCommand): boolean {
    const onTail = this.isPlayerOnTail(context);

    if (this.phase !== 'scissors') {
      this.tailTime = onTail ? this.tailTime + context.dt : 0;
      if (this.tailTime < ACE_SCISSORS.TRIGGER_SECONDS) return false;
      // 被咬尾：放弃当前航路，开始剪刀
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
