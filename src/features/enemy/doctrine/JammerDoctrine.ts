import { Vector3 } from 'three';
import { JetDoctrine } from './JetDoctrine';
import { DOCTRINE_RULES, type DoctrineCommand, type DoctrineContext } from './DoctrineTypes';

/** 干扰机条令参数：起始值，波次 / 平衡批次可调 */
export const JAMMER_TUNING = {
  /** 干扰半径（米）：这个距离内有存活的干扰机时，玩家的导弹锁定时间乘以 LOCK_TIME_MULTIPLIER */
  JAM_RANGE: 800,
  LOCK_TIME_MULTIPLIER: 2,
  /** 躲在自己编队身后这么远（米，300–500 的中间），编队在它和玩家之间 */
  BEHIND_MIN: 300,
  BEHIND_MAX: 500,
  BEHIND_DISTANCE: 400,
  /** 离站位点这么近就算到位，改为在站位点附近慢速绕圈（米） */
  ARRIVE_DISTANCE: 90,
  LOITER_RADIUS: 60,
  /** 离站位点这么远时加速赶过去（米） */
  HURRY_DISTANCE: 260,
  /** 没有编队可躲时，在离玩家这么远的地方盘旋（米）：还在干扰半径之内 */
  ALONE_DISTANCE: 650,
} as const;

const tmpAxis = new Vector3();
const tmpStation = new Vector3();

/**
 * JAMMER — 电子战机：没有武器、飞得慢。始终躲在自己编队身后 300–500 米处，让编队挡在它和
 * 玩家之间；从不申请攻击令牌。干扰效果（玩家导弹锁定变慢）由 EnemySystem 按距离判定，
 * 不在条令里。
 *
 * 阶段：trail（赶往 / 守在编队身后的站位点；站位点换到了玩家另一侧时绕着玩家兜过去）；
 * alone（没有编队：在远处绕玩家盘旋）。
 */
export class JammerDoctrine extends JetDoctrine {
  public readonly id = 'jammer';

  private rolled = false;
  private orbitSign = 1;

  constructor() {
    super('trail', 2);
  }

  protected cancelAttack(): void {
    // 没有攻击可取消
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.orbitSign = context.rng() < 0.5 ? -1 : 1;
    }
    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;

    if (!context.hasGroup) {
      this.setPhase('alone');
      this.steerOrbit(context, command, JAMMER_TUNING.ALONE_DISTANCE, this.orbitSign, 0);
      return;
    }
    this.setPhase('trail');

    // 站位点：从玩家看过去，在编队中心的正后方
    tmpAxis.subVectors(context.groupCenter, context.playerPosition);
    tmpAxis.y = 0;
    if (tmpAxis.lengthSq() < 1) {
      tmpAxis.subVectors(context.position, context.playerPosition);
      tmpAxis.y = 0;
    }
    if (tmpAxis.lengthSq() < 1e-6) tmpAxis.set(0, 0, 1);
    tmpAxis.normalize();
    tmpStation.copy(context.groupCenter).addScaledVector(tmpAxis, JAMMER_TUNING.BEHIND_DISTANCE);

    // 站位点在玩家的另一侧（编队刚从玩家身边掠过）：绕着玩家兜过去，不从玩家身边直穿
    const sx = context.position.x - context.playerPosition.x;
    const sz = context.position.z - context.playerPosition.z;
    if (sx * tmpAxis.x + sz * tmpAxis.z < 0) {
      const side = sx * tmpAxis.z - sz * tmpAxis.x;
      const sign = Math.abs(side) > 1e-3 ? Math.sign(side) : this.orbitSign;
      const radius = Math.hypot(
        tmpStation.x - context.playerPosition.x,
        tmpStation.z - context.playerPosition.z
      );
      this.steerOrbit(context, command, radius, sign, tmpStation.y - context.playerPosition.y);
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
      return;
    }

    const dx = context.position.x - tmpStation.x;
    const dz = context.position.z - tmpStation.z;
    const gap = Math.hypot(dx, dz);
    if (gap > JAMMER_TUNING.ARRIVE_DISTANCE) {
      command.direction.set(-dx, 0, -dz);
      command.throttle = gap > JAMMER_TUNING.HURRY_DISTANCE ? DOCTRINE_RULES.MAX_THROTTLE : 1;
    } else if (gap > 1e-3) {
      // 到位：绕站位点慢速转圈（切向为主，径向修正到 LOITER_RADIUS）
      const ux = dx / gap;
      const uz = dz / gap;
      let error = (JAMMER_TUNING.LOITER_RADIUS - gap) / JAMMER_TUNING.LOITER_RADIUS;
      error = error > 1 ? 1 : error < -1 ? -1 : error;
      command.direction.set(-uz * this.orbitSign + ux * error, 0, ux * this.orbitSign + uz * error);
      command.throttle = DOCTRINE_RULES.MIN_THROTTLE;
    } else {
      command.direction.copy(context.forward);
      command.throttle = DOCTRINE_RULES.MIN_THROTTLE;
    }
    this.applyAltitude(context, command, tmpStation.y);
  }
}
