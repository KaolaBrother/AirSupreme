import { Vector3 } from 'three';
import { JetDoctrine } from './JetDoctrine';
import { DOCTRINE_RULES, type DoctrineCommand, type DoctrineContext } from './DoctrineTypes';

/** 干扰机条令参数：起始值，波次 / 平衡批次可调 */
export const JAMMER_TUNING = {
  /** 干扰半径（米）：这个距离内有存活的干扰机时，玩家的导弹锁定时间乘以 LOCK_TIME_MULTIPLIER */
  JAM_RANGE: 800,
  LOCK_TIME_MULTIPLIER: 2,
  /**
   * 躲在自己编队身后 300–500 米，编队在它和玩家之间。站位点取 BEHIND_DISTANCE（米），偏近的
   * 一侧：它慢，编队转向 / 前移时常常落在站位点后面，留出余量仍在 500 米以内
   */
  BEHIND_MIN: 300,
  BEHIND_MAX: 500,
  BEHIND_DISTANCE: 350,
  /**
   * 跟着站位点飞：编队中心与站位点的速度都取相邻两步之差、按 VELOCITY_SMOOTHING（秒）平滑；
   * 一步跳过 JUMP_SPEED（米/秒）以上算编队成员变了（击落 / 补位），不计入速度。想要的速度 =
   * 编队的速度 + 站位点随编队方位转动多出来的那部分 + 朝站位点的修正（每米 CLOSE_GAIN 米/秒，
   * 至多 CLOSE_SPEED 米/秒）；超过 1.3× 时先少跟“方位转动”那部分——站位点是一片扇区的中心，
   * 追不上它的摆动时守着编队、留在扇区里，不全速追着跑反被甩开。油门取刚好够用的值（0.6×–1.3×）
   */
  VELOCITY_SMOOTHING: 2,
  /**
   * “玩家 → 编队中心”的方向按这个时间常数（秒）平滑：编队贴着玩家时，编队中心左右一晃，
   * 几百米外的站位点就甩出去一大截，不平滑的话它会全速追着站位点左右摆、反而被甩开
   */
  AXIS_SMOOTHING: 4,
  JUMP_SPEED: 150,
  CLOSE_GAIN: 0.15,
  CLOSE_SPEED: 25,
  /** 站位点几乎不动、本机离它这么近时，改为在站位点附近慢速绕圈（米） */
  ARRIVE_DISTANCE: 90,
  LOITER_RADIUS: 60,
  /** 没有编队可躲时，在离玩家这么远的地方盘旋（米）：还在干扰半径之内 */
  ALONE_DISTANCE: 650,
} as const;

const tmpAxis = new Vector3();
const tmpStation = new Vector3();
const tmpVelocity = new Vector3();
const tmpTurn = new Vector3();

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
  /** 编队中心、站位点的平滑速度（水平，米/秒），以及上一步的编队中心、站位点 */
  private readonly groupVelocity = new Vector3();
  private readonly stationVelocity = new Vector3();
  private readonly lastGroupCenter = new Vector3();
  private readonly lastStation = new Vector3();
  private hasLast = false;
  /** 平滑后的“玩家 → 编队中心”水平方向（单位向量；hasAxis 为 false 时还没有） */
  private readonly axis = new Vector3();
  private hasAxis = false;

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
      this.hasLast = false;
      this.hasAxis = false;
      this.groupVelocity.set(0, 0, 0);
      this.stationVelocity.set(0, 0, 0);
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
    this.smoothAxis(context.dt);
    tmpStation.copy(context.groupCenter).addScaledVector(tmpAxis, JAMMER_TUNING.BEHIND_DISTANCE);
    this.trackVelocities(context.groupCenter, context.dt);

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
    // 编队的速度 + 朝站位点的修正 + 站位点随方位转动的那部分（超过上限时先少跟这部分）
    tmpVelocity.copy(this.groupVelocity);
    if (gap > 1e-3) {
      const closing = Math.min(JAMMER_TUNING.CLOSE_SPEED, gap * JAMMER_TUNING.CLOSE_GAIN);
      tmpVelocity.x -= (dx / gap) * closing;
      tmpVelocity.z -= (dz / gap) * closing;
    }
    tmpTurn.subVectors(this.stationVelocity, this.groupVelocity);
    tmpVelocity.addScaledVector(
      tmpTurn,
      followShare(tmpVelocity, tmpTurn, DOCTRINE_RULES.MAX_THROTTLE * context.baseSpeed)
    );
    const wanted = Math.hypot(tmpVelocity.x, tmpVelocity.z);
    const minSpeed = DOCTRINE_RULES.MIN_THROTTLE * context.baseSpeed;
    if (wanted >= minSpeed || gap > JAMMER_TUNING.ARRIVE_DISTANCE) {
      command.direction.set(tmpVelocity.x, 0, tmpVelocity.z);
      if (wanted < 1e-3) command.direction.set(-dx, 0, -dz);
      const throttle = context.baseSpeed > 0 ? wanted / context.baseSpeed : 1;
      command.throttle = Math.min(
        DOCTRINE_RULES.MAX_THROTTLE,
        Math.max(DOCTRINE_RULES.MIN_THROTTLE, throttle)
      );
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

  /** 把这一步的方向（tmpAxis，单位向量）并入平滑后的方向，结果写回 tmpAxis */
  private smoothAxis(dt: number): void {
    if (!this.hasAxis || !(dt > 0)) {
      this.axis.copy(tmpAxis);
      this.hasAxis = true;
      return;
    }
    const k = 1 - Math.exp(-dt / JAMMER_TUNING.AXIS_SMOOTHING);
    this.axis.x += (tmpAxis.x - this.axis.x) * k;
    this.axis.z += (tmpAxis.z - this.axis.z) * k;
    this.axis.y = 0;
    // 方向几乎反过来（编队从玩家身边掠过）时平均值会缩成零：直接换成新方向
    if (this.axis.lengthSq() < 0.04) this.axis.copy(tmpAxis);
    else this.axis.normalize();
    tmpAxis.copy(this.axis);
  }

  /** 由相邻两步的编队中心、站位点（tmpStation）更新两者的平滑速度 */
  private trackVelocities(center: Readonly<Vector3>, dt: number): void {
    if (this.hasLast && dt > 0) {
      smoothVelocity(this.groupVelocity, center, this.lastGroupCenter, dt);
      smoothVelocity(this.stationVelocity, tmpStation, this.lastStation, dt);
    }
    this.lastGroupCenter.copy(center);
    this.lastStation.copy(tmpStation);
    this.hasLast = true;
  }
}

/** 把 (point − last) / dt 并入平滑速度 velocity（水平）；一步跳得太远（编队成员变了）不计入 */
function smoothVelocity(
  velocity: Vector3,
  point: Readonly<Vector3>,
  last: Readonly<Vector3>,
  dt: number
): void {
  const vx = (point.x - last.x) / dt;
  const vz = (point.z - last.z) / dt;
  if (!(Math.hypot(vx, vz) < JAMMER_TUNING.JUMP_SPEED)) return;
  const k = 1 - Math.exp(-dt / JAMMER_TUNING.VELOCITY_SMOOTHING);
  velocity.x += (vx - velocity.x) * k;
  velocity.z += (vz - velocity.z) * k;
}

/** 0..1：base + share × extra 的水平速率不超过 limit 时 share 能取的最大值（base 已超过时为 0） */
function followShare(base: Readonly<Vector3>, extra: Readonly<Vector3>, limit: number): number {
  const bb = base.x * base.x + base.z * base.z;
  const ee = extra.x * extra.x + extra.z * extra.z;
  const be = base.x * extra.x + base.z * extra.z;
  const ll = limit * limit;
  if (bb + 2 * be + ee <= ll) return 1;
  if (bb >= ll || !(ee > 1e-9)) return 0;
  const root = (-be + Math.sqrt(be * be - ee * (bb - ll))) / ee;
  return root > 1 ? 1 : root > 0 ? root : 0;
}
