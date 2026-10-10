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
  /** 截击航线的最长前置时间（秒） */
  RUN_LEAD_SECONDS: 2.5,
  /** 一次冲刺最长时间（秒）；在射程内尾追玩家超过 TAIL_CHASE_SECONDS 也立刻脱离 */
  RUN_MAX_SECONDS: 7,
  TAIL_CHASE_SECONDS: 2,
  /**
   * 就位（绕到指派方位那一侧）：与指派方位相差超过 ENTER 才绕，绕到 DONE 以内或超过
   * MAX 秒就开始冲刺（绕不到位也不再等，令牌不能一直占着不打）
   */
  POSITION_MAX_SECONDS: 5,
  POSITION_ENTER_ANGLE: 60 * DEG,
  POSITION_DONE_ANGLE: 45 * DEG,
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

const tmpPoint = new Vector3();
const tmpAim = new Vector3();
const tmpToSelf = new Vector3();
const tmpToPlayer = new Vector3();
const tmpRight = new Vector3();

/**
 * SCOUT — 袭扰机：从侧面高速切入、三连发点射、近距离脱离、拉开、再来。从不尾追。
 *
 * 阶段：hold（没有令牌，在约 350 米外盘旋）→ position（飞到导演指派的进入方位）→
 * run（冲向玩家的前置位置并点射）→ break（转 60–90° 并改变高度）→ extend（拉开到
 * 300–400 米）→ hold。被锁定或有导弹来袭时进入 evade（猛烈摆动 + 俯冲 / 爬升）。
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
  private jinkVertical = 1;
  private jinkSide = 1;
  private calmTime = 0;

  constructor() {
    super('hold', 1, true);
  }

  protected cancelAttack(): void {
    this.gun.cancel();
    this.tailChaseTime = 0;
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

  /** 没有令牌：在冲刺起点的距离上盘旋待命；领到令牌后就位或直接冲刺 */
  private decideHold(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    this.request.desiredBearing = Number.NaN;
    if (context.hasToken) {
      const actual = bearingBetween(
        context.playerPosition.x,
        context.playerPosition.z,
        context.position.x,
        context.position.z
      );
      const offBearing =
        Number.isFinite(context.attackBearing) &&
        angularDistance(actual, context.attackBearing) > SCOUT_TUNING.POSITION_ENTER_ANGLE;
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

  /** 沿冲刺起点的圆周绕到指派方位那一侧（双机时与僚机分居玩家两侧）；绕着走，不从玩家身上穿过去 */
  private decidePosition(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      this.setPhase('hold');
      this.decideHold(context, command);
      return;
    }
    const actual = bearingBetween(
      context.playerPosition.x,
      context.playerPosition.z,
      context.position.x,
      context.position.z
    );
    if (
      !Number.isFinite(context.attackBearing) ||
      angularDistance(actual, context.attackBearing) < SCOUT_TUNING.POSITION_DONE_ANGLE ||
      this.phaseTime > SCOUT_TUNING.POSITION_MAX_SECONDS
    ) {
      this.startRun();
      this.decideRun(context, command);
      return;
    }
    // steerOrbit 的 sign = 1 朝方位角减小的方向绕：选近的那一边
    const sign = wrapAngle(context.attackBearing - actual) > 0 ? -1 : 1;
    this.steerOrbit(context, command, SCOUT_TUNING.RUN_START_DISTANCE, sign, this.heightOffset);
    command.throttle = 1.3;
  }

  private startRun(): void {
    this.setPhase('run');
    this.tailChaseTime = 0;
  }

  /** 冲刺：飞向玩家的前置位置，对上就三连发；到 120 米、尾追或超时就脱离 */
  private decideRun(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      // 令牌被收回：不开火，直接脱离
      this.enterBreak(context, command);
      this.decideBreak(context, command);
      return;
    }

    // 航迹：平时飞向“玩家将要到的位置”（截击航线）；进入射程且机炮就绪（或正在点射）时
    // 把机头压到机炮瞄准点上，打完这一轮再回到截击航线
    const inRange = context.distance < SCOUT_TUNING.GUN_RANGE;
    this.gunAimPoint(context, tmpAim);
    if (inRange && (this.gun.isBursting() || this.gun.isReady())) {
      this.steerToward(context, command, tmpAim);
    } else {
      const closeTime = Math.min(
        SCOUT_TUNING.RUN_LEAD_SECONDS,
        context.distance / Math.max(context.speed, 1)
      );
      tmpPoint.copy(context.playerPosition).addScaledVector(context.playerVelocity, closeTime);
      this.steerToward(context, command, tmpPoint);
    }
    command.throttle = 1.2;

    // 开火条件看机头与机炮瞄准线的夹角：子弹基本沿机头方向出膛
    tmpToPlayer.subVectors(tmpAim, context.position);
    const noseAngle = angleBetween(context.forward, tmpToPlayer);
    const rounds = this.gun.tick(
      context.dt,
      context.cadenceScale,
      inRange && noseAngle < SCOUT_TUNING.GUN_CONE,
      inRange && noseAngle < SCOUT_TUNING.GUN_CONE * 2
    );
    for (let i = 0; i < rounds; i++) this.fireGunRound(context, command);

    // 尾追判定：进了射程、在玩家身后、与玩家同向飞（从后方追上来的途中不算）
    tmpToSelf.subVectors(context.position, context.playerPosition);
    const behind = tmpToSelf.dot(context.playerForward) < 0;
    const sameWay = context.forward.dot(context.playerForward) > 0.8;
    this.tailChaseTime = inRange && behind && sameWay ? this.tailChaseTime + context.dt : 0;

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
