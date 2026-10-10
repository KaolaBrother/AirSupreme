import { Vector3 } from 'three';
import { BurstGun, JetDoctrine } from './JetDoctrine';
import type { DoctrineCommand, DoctrineContext } from './DoctrineTypes';
import {
  angleBetween,
  angularDistance,
  bearingBetween,
  horizontalRight,
  rotateAroundUp,
  wrapAngle,
} from './DoctrineMath';

const DEG = Math.PI / 180;

/** 侦察机（袭扰机）条令参数：起始值，波次 / 平衡批次可调 */
export const SCOUT_TUNING = {
  /** 从约这么远开始冲刺（米）；没有令牌时也在这个半径上盘旋待命 */
  RUN_START_DISTANCE: 350,
  /** 冲到这么近就脱离（米） */
  BREAK_DISTANCE: 120,
  /** 脱离后拉开到这个范围内的某个距离再回头（米） */
  EXTEND_MIN_DISTANCE: 300,
  EXTEND_MAX_DISTANCE: 400,
  /** 脱离转向角范围（弧度）与俯冲 / 爬升的俯仰正弦 */
  BREAK_TURN_MIN: 60 * DEG,
  BREAK_TURN_MAX: 90 * DEG,
  BREAK_PITCH_SIN: 0.35,
  /** 脱离转向保持时间（秒） */
  BREAK_SECONDS: 1.2,
  /** 三连发点射：发间隔 / 两轮之间的间隔（秒） */
  BURST_ROUNDS: 3,
  ROUND_INTERVAL: 0.12,
  BURST_INTERVAL: 1.6,
  /** 开火条件：距离，以及机头与机炮瞄准线（带提前量）的夹角 */
  GUN_RANGE: 300,
  GUN_CONE: 18 * DEG,
  /** 冲刺油门 */
  RUN_THROTTLE: 1.2,
  /**
   * 冲刺只从“切得进去”的位置开始：按截击航线算出的接近速率不低于这个值（米/秒）。
   * 对以巡航速度直线飞行的玩家，正后方只有十几米/秒——那不是切入，是尾追；
   * 这个值大约对应离玩家正后方 60° 以外。玩家转弯、迎面飞来或悬停时到处都满足。
   */
  RUN_MIN_CLOSING: 20,
  /** 一次冲刺最长时间（秒） */
  RUN_MAX_SECONDS: 7,
  /**
   * 离脱离距离太近时不再开始新的点射：按当前接近速率，打完三发需要这么多秒的余量
   * （否则刚把机头压过去就该脱离了，点射被拦腰打断）
   */
  BURST_ROOM_SECONDS: 0.45,
  /**
   * 尾追判定：在玩家正后方 TAIL_CONE 半角之内、TAIL_RANGE 之内、航向与玩家基本一致。
   * 冲刺中持续超过 TAIL_CHASE_SECONDS 就脱离（规则：不在玩家身后 30° 锥内、250 米内
   * 连续停留超过 4 秒）。
   */
  TAIL_CONE: 50 * DEG,
  TAIL_RANGE: 420,
  TAIL_SAME_WAY_COS: 0.8,
  TAIL_CHASE_SECONDS: 2.5,
  /**
   * 绕向侧面（玩家后方切不进去时）：在随玩家移动的参照系里朝近的一侧绕。还在玩家后方
   * FLANK_REAR_CONE 扇面里时保持在 FLANK_REAR_RADIUS 之外（不贴在尾后），出了扇面再收回到
   * 冲刺起点的距离。
   */
  FLANK_REAR_CONE: 52 * DEG,
  FLANK_REAR_RADIUS: 415,
  FLANK_BAND: 60,
  FLANK_THROTTLE: 1.3,
  /**
   * 就位（绕到指派方位那一侧）：与指派方位相差超过 ENTER 才绕，绕到 DONE 以内才开始冲刺；
   * 超过 MAX 秒还没到位就让出令牌（不从错的一侧打，也不一直占着令牌）。
   */
  POSITION_MAX_SECONDS: 10,
  POSITION_ENTER_ANGLE: 40 * DEG,
  POSITION_DONE_ANGLE: 30 * DEG,
  /** 点射只在本机方位与指派方位相差不超过这个角度时开始：双机各守玩家的一侧 */
  SIDE_TOLERANCE: 40 * DEG,
  /** 拉开阶段最长时间（秒） */
  EXTEND_MAX_SECONDS: 6,
  /** 玩家机头对准本机（夹角内、距离内）时蛇形摆动 */
  WEAVE_NOSE_ANGLE: 6 * DEG,
  WEAVE_RANGE: 500,
  WEAVE_AMPLITUDE: 20 * DEG,
  WEAVE_PERIOD: 1.1,
  /** 被锁定 / 导弹来袭：更猛的摆动 + 俯冲或爬升 */
  JINK_AMPLITUDE: 42 * DEG,
  JINK_PERIOD: 0.7,
  JINK_PITCH_SIN: 0.45,
  JINK_TURN_SCALE: 1.4,
  /** 威胁解除后再躲这么久（秒） */
  EVADE_LINGER_SECONDS: 0.6,
} as const;

const tmpAim = new Vector3();
const tmpToSelf = new Vector3();
const tmpToPlayer = new Vector3();
const tmpRight = new Vector3();
const tmpTrack = new Vector3();

/**
 * SCOUT — 袭扰机：从侧面高速切入、三连发点射、近距离脱离、拉开、再来。从不尾追。
 *
 * 阶段：hold（没有令牌：在约 350 米外盘旋；落在玩家身后切不进去时改为绕向侧面）→
 * position（飞到导演指派的进入方位，到位才冲刺）→ run（沿截击航线冲向玩家并点射）→
 * break（转 60–90° 并改变高度）→ extend（拉开到 300–400 米）→ hold。
 * 被锁定或有导弹来袭时进入 evade（猛烈摆动 + 俯冲 / 爬升）。
 */
export class ScoutDoctrine extends JetDoctrine {
  public readonly id = 'scout';

  private readonly gun = new BurstGun(
    SCOUT_TUNING.BURST_ROUNDS,
    SCOUT_TUNING.ROUND_INTERVAL,
    SCOUT_TUNING.BURST_INTERVAL
  );
  private rolled = false;
  private orbitSign = 1;
  private heightOffset = 0;
  private extendDistance: number = SCOUT_TUNING.RUN_START_DISTANCE;
  private tailChaseTime = 0;
  /** 绕向侧面时走玩家航迹的哪一侧（1 = 右、-1 = 左；0 = 还没选） */
  private flankSide = 0;
  private jinkVertical = 1;
  private jinkSide = 1;
  private calmTime = 0;

  constructor() {
    super('hold', 1, true);
  }

  protected cancelAttack(): void {
    this.gun.cancel();
    this.tailChaseTime = 0;
    this.flankSide = 0;
    this.calmTime = 0;
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.orbitSign = context.rng() < 0.5 ? -1 : 1;
      this.heightOffset = (context.rng() - 0.5) * 60;
    }

    if (this.isThreatened(context) && this.phase !== 'evade') {
      this.enterEvade(context, command);
    }

    switch (this.phase) {
      case 'evade':
        this.decideEvade(context, command);
        return;
      case 'position':
        this.decidePosition(context, command);
        break;
      case 'run':
        this.decideRun(context, command);
        break;
      case 'break':
        this.decideBreak(context, command);
        break;
      case 'extend':
        this.decideExtend(context, command);
        break;
      default:
        this.decideHold(context, command);
        break;
    }

    // 玩家机头正对着本机：蛇形摆动（冲刺中也摆，脱离转向时不摆）
    if (
      this.phase !== 'break' &&
      context.distance < SCOUT_TUNING.WEAVE_RANGE &&
      this.playerNoseAngle(context) < SCOUT_TUNING.WEAVE_NOSE_ANGLE
    ) {
      this.applyWeave(command, SCOUT_TUNING.WEAVE_AMPLITUDE, SCOUT_TUNING.WEAVE_PERIOD);
    }
  }

  /** 本机相对玩家的方位角（从玩家看，世界坐标） */
  private ownBearing(context: DoctrineContext): number {
    return bearingBetween(
      context.playerPosition.x,
      context.playerPosition.z,
      context.position.x,
      context.position.z
    );
  }

  /** 从这里冲刺切得进去：按截击航线的接近速率够快（玩家直线飞行时，正后方不够） */
  private canSlash(context: DoctrineContext): boolean {
    return (
      this.interceptClosingSpeed(context, context.baseSpeed * SCOUT_TUNING.RUN_THROTTLE) >=
      SCOUT_TUNING.RUN_MIN_CLOSING
    );
  }

  /** 玩家的航迹方向（水平）：有速度用速度，悬停时用机头；写入 tmpTrack */
  private playerTrack(context: DoctrineContext): Vector3 {
    const velocity = context.playerVelocity;
    if (velocity.x * velocity.x + velocity.z * velocity.z > 25) {
      return tmpTrack.set(velocity.x, 0, velocity.z);
    }
    return tmpTrack.set(context.playerForward.x, 0, context.playerForward.z);
  }

  /**
   * 绕行半径：切不进去、且还在玩家后方扇面里时留在 415 米之外（不贴在尾后），
   * 否则回到冲刺起点的距离。
   */
  private flankRadius(context: DoctrineContext, canSlash: boolean): number {
    if (canSlash) return SCOUT_TUNING.RUN_START_DISTANCE;
    tmpToSelf.subVectors(context.position, context.playerPosition).setY(0);
    const astern = angleBetween(tmpToSelf, this.playerTrack(context).negate());
    return astern < SCOUT_TUNING.FLANK_REAR_CONE
      ? SCOUT_TUNING.FLANK_REAR_RADIUS
      : SCOUT_TUNING.RUN_START_DISTANCE;
  }

  /**
   * 绕向侧面：玩家直线飞行、本机落在后方切不进去时，在随玩家移动的参照系里朝本机所在的
   * 一侧绕开正后方，绕到切得进去的位置为止。
   */
  private steerFlank(context: DoctrineContext, command: DoctrineCommand): void {
    tmpToSelf.subVectors(context.position, context.playerPosition).setY(0);
    horizontalRight(this.playerTrack(context), tmpRight);
    const lateral = tmpToSelf.dot(tmpRight);
    if (this.flankSide === 0 || Math.abs(lateral) > 40) {
      this.flankSide = Math.abs(lateral) > 1 ? Math.sign(lateral) : this.orbitSign;
    }
    // horizontalRight 指向方位角减小的一侧；从正后方绕到右侧是方位角增大，即 steerOrbit 的 sign = -1
    this.steerOrbitMoving(
      context,
      command,
      this.flankRadius(context, false),
      -this.flankSide,
      this.heightOffset,
      SCOUT_TUNING.FLANK_THROTTLE,
      SCOUT_TUNING.FLANK_BAND
    );
  }

  /**
   * 待命：切得进去的位置上在冲刺起点的距离盘旋并申请令牌，领到后就位或直接冲刺；
   * 切不进去（落在直线飞行的玩家身后）时不申请令牌，先绕向侧面。
   */
  private decideHold(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.desiredBearing = Number.NaN;
    const canSlash = this.canSlash(context);
    this.request.wants = canSlash;
    if (!canSlash) {
      // 令牌留给打得到的敌机
      if (context.hasToken) command.releaseToken = true;
      this.steerFlank(context, command);
      return;
    }
    this.flankSide = 0;
    if (context.hasToken) {
      const offBearing =
        Number.isFinite(context.attackBearing) &&
        angularDistance(this.ownBearing(context), context.attackBearing) >
          SCOUT_TUNING.POSITION_ENTER_ANGLE;
      if (offBearing) {
        this.setPhase('position');
        this.decidePosition(context, command);
      } else {
        this.startRun();
        this.decideRun(context, command);
      }
      return;
    }
    this.steerOrbit(
      context,
      command,
      SCOUT_TUNING.RUN_START_DISTANCE,
      this.orbitSign,
      this.heightOffset
    );
  }

  /**
   * 就位：绕到指派方位那一侧（双机时与僚机分居玩家两侧）再冲刺；绕着走，不从玩家身上穿过去。
   * 太久绕不到位就让出令牌，回去待命时接着朝同一边绕。
   */
  private decidePosition(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      this.setPhase('hold');
      this.decideHold(context, command);
      return;
    }
    const canSlash = this.canSlash(context);
    const bearing = context.attackBearing;
    if (!Number.isFinite(bearing)) {
      this.setPhase('hold');
      this.decideHold(context, command);
      return;
    }
    const actual = this.ownBearing(context);
    if (canSlash && angularDistance(actual, bearing) < SCOUT_TUNING.POSITION_DONE_ANGLE) {
      this.startRun();
      this.decideRun(context, command);
      return;
    }
    // steerOrbit 的 sign = 1 朝方位角减小的方向绕：选近的那一边
    const sign = wrapAngle(bearing - actual) > 0 ? -1 : 1;
    if (this.phaseTime > SCOUT_TUNING.POSITION_MAX_SECONDS) {
      command.releaseToken = true;
      this.request.wants = false;
      this.orbitSign = sign;
      this.setPhase('hold');
    }
    this.steerOrbitMoving(
      context,
      command,
      this.flankRadius(context, canSlash),
      sign,
      this.heightOffset,
      SCOUT_TUNING.FLANK_THROTTLE,
      SCOUT_TUNING.FLANK_BAND
    );
  }

  private startRun(): void {
    this.setPhase('run');
    this.tailChaseTime = 0;
    this.flankSide = 0;
  }

  /** 冲刺：沿截击航线冲向玩家，对上就三连发；到 120 米、尾追或超时就脱离 */
  private decideRun(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      // 令牌被收回：不开火，直接脱离
      this.enterBreak(context, command);
      this.decideBreak(context, command);
      return;
    }

    // 双机各守一侧：本机不在指派方位那一侧时不开始新的点射
    const onSide =
      !Number.isFinite(context.attackBearing) ||
      angularDistance(this.ownBearing(context), context.attackBearing) <=
        SCOUT_TUNING.SIDE_TOLERANCE;

    // 航迹：平时沿截击航线（恒定方位）接近；进入射程且机炮就绪（或正在点射）时
    // 把机头压到机炮瞄准点上，打完这一轮再回到截击航线
    const inRange = context.distance < SCOUT_TUNING.GUN_RANGE;
    const closing = this.steerIntercept(
      context,
      command,
      context.baseSpeed * SCOUT_TUNING.RUN_THROTTLE
    );
    // 还来得及在脱离前打完一轮
    const canOpen =
      inRange &&
      onSide &&
      context.distance - SCOUT_TUNING.BREAK_DISTANCE > closing * SCOUT_TUNING.BURST_ROOM_SECONDS;
    this.gunAimPoint(context, tmpAim);
    if (this.gun.isBursting() || (canOpen && this.gun.isReady())) {
      this.steerToward(context, command, tmpAim);
    }
    command.throttle = SCOUT_TUNING.RUN_THROTTLE;

    // 开火条件看机头与机炮瞄准线的夹角：子弹基本沿机头方向出膛
    tmpToPlayer.subVectors(tmpAim, context.position);
    const noseAngle = angleBetween(context.forward, tmpToPlayer);
    const rounds = this.gun.tick(
      context.dt,
      context.cadenceScale,
      canOpen && noseAngle < SCOUT_TUNING.GUN_CONE,
      inRange && noseAngle < SCOUT_TUNING.GUN_CONE * 2
    );
    for (let i = 0; i < rounds; i++) this.fireGunRound(context, command);

    // 尾追判定：在玩家正后方的扇面里、离得不远、与玩家同向飞
    tmpToSelf.subVectors(context.position, context.playerPosition);
    tmpTrack.copy(context.playerForward).negate();
    const chasing =
      context.distance < SCOUT_TUNING.TAIL_RANGE &&
      context.forward.dot(context.playerForward) > SCOUT_TUNING.TAIL_SAME_WAY_COS &&
      angleBetween(tmpToSelf, tmpTrack) < SCOUT_TUNING.TAIL_CONE;
    this.tailChaseTime = chasing ? this.tailChaseTime + context.dt : 0;

    // 到了脱离距离立刻脱离；超时 / 尾追则等这一轮点射打完
    const spent =
      this.phaseTime > SCOUT_TUNING.RUN_MAX_SECONDS ||
      this.tailChaseTime > SCOUT_TUNING.TAIL_CHASE_SECONDS;
    if (context.distance < SCOUT_TUNING.BREAK_DISTANCE || (spent && !this.gun.isBursting())) {
      this.enterBreak(context, command);
    }
  }

  /** 脱离：相对当前航向转 60–90°（朝背离玩家航向的一侧），同时爬升或俯冲 */
  private enterBreak(context: DoctrineContext, command: DoctrineCommand): void {
    this.gun.cancel();
    if (context.hasToken) command.releaseToken = true;
    this.request.wants = false;

    const turn =
      SCOUT_TUNING.BREAK_TURN_MIN +
      context.rng() * (SCOUT_TUNING.BREAK_TURN_MAX - SCOUT_TUNING.BREAK_TURN_MIN);
    // 选边：转向与玩家航向相反的一侧，玩家要多转才能咬住
    horizontalRight(context.forward, tmpRight);
    const along = tmpRight.dot(context.playerForward);
    const side = Math.abs(along) > 0.1 ? -Math.sign(along) : context.rng() < 0.5 ? -1 : 1;
    const vertical = context.rng() < 0.5 ? -1 : 1;
    const horizontal = Math.sqrt(1 - SCOUT_TUNING.BREAK_PITCH_SIN * SCOUT_TUNING.BREAK_PITCH_SIN);
    this.breakDirection.set(context.forward.x, 0, context.forward.z);
    if (this.breakDirection.lengthSq() < 1e-8) this.breakDirection.set(0, 0, 1);
    this.breakDirection.normalize();
    // horizontalRight 是方位角减小的方向：side = 1（向右）对应负角度
    rotateAroundUp(this.breakDirection, -side * turn);
    this.breakDirection.multiplyScalar(horizontal);
    this.breakDirection.y = vertical * SCOUT_TUNING.BREAK_PITCH_SIN;

    this.extendDistance =
      SCOUT_TUNING.EXTEND_MIN_DISTANCE +
      context.rng() * (SCOUT_TUNING.EXTEND_MAX_DISTANCE - SCOUT_TUNING.EXTEND_MIN_DISTANCE);
    this.setPhase('break');
  }

  private decideBreak(_context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    command.direction.copy(this.breakDirection);
    command.throttle = 1.3;
    command.turnScale = 1.4;
    if (this.phaseTime >= SCOUT_TUNING.BREAK_SECONDS) {
      this.setPhase('extend');
    }
  }

  /** 拉开：背向玩家飞到 300–400 米外，再回到待命盘旋 */
  private decideExtend(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (
      context.distance >= this.extendDistance ||
      this.phaseTime > SCOUT_TUNING.EXTEND_MAX_SECONDS
    ) {
      this.setPhase('hold');
      this.decideHold(context, command);
      return;
    }
    command.direction.subVectors(context.position, context.playerPosition);
    command.direction.y = 0;
    if (command.direction.lengthSq() < 1e-6) command.direction.copy(context.forward);
    // 保留脱离时的高度变化趋势
    command.direction.normalize();
    command.direction.y = this.breakDirection.y * 0.5;
    command.throttle = 1.2;
  }

  private enterEvade(context: DoctrineContext, command: DoctrineCommand): void {
    this.gun.cancel();
    if (context.hasToken) command.releaseToken = true;
    this.jinkVertical = context.rng() < 0.5 ? -1 : 1;
    tmpToSelf.subVectors(context.position, context.playerPosition);
    horizontalRight(tmpToSelf, tmpRight);
    const along = context.forward.dot(tmpRight);
    this.jinkSide = Math.abs(along) > 0.15 ? Math.sign(along) : context.rng() < 0.5 ? -1 : 1;
    this.calmTime = 0;
    this.setPhase('evade');
  }

  /** 被锁定 / 导弹来袭：横向于视线猛烈摆动，同时俯冲或爬升；威胁解除后拉开 */
  private decideEvade(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    this.calmTime = this.isThreatened(context) ? 0 : this.calmTime + context.dt;
    if (this.calmTime > SCOUT_TUNING.EVADE_LINGER_SECONDS) {
      this.extendDistance = SCOUT_TUNING.EXTEND_MIN_DISTANCE;
      this.breakDirection.set(0, 0, 0);
      this.setPhase('extend');
      this.decideExtend(context, command);
      return;
    }
    tmpToSelf.subVectors(context.position, context.playerPosition);
    horizontalRight(tmpToSelf, tmpRight);
    const horizontal = Math.sqrt(1 - SCOUT_TUNING.JINK_PITCH_SIN * SCOUT_TUNING.JINK_PITCH_SIN);
    command.direction.set(
      tmpRight.x * this.jinkSide * horizontal,
      this.jinkVertical * SCOUT_TUNING.JINK_PITCH_SIN,
      tmpRight.z * this.jinkSide * horizontal
    );
    this.applyWeave(command, SCOUT_TUNING.JINK_AMPLITUDE, SCOUT_TUNING.JINK_PERIOD);
    command.throttle = 1.3;
    command.turnScale = SCOUT_TUNING.JINK_TURN_SCALE;
  }
}
