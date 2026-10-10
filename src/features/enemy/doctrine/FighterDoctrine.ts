import { Vector3 } from 'three';
import { BurstGun, JetDoctrine } from './JetDoctrine';
import { DOCTRINE_RULES, type DoctrineCommand, type DoctrineContext } from './DoctrineTypes';
import {
  angleBetween,
  angularDistance,
  bearingBetween,
  directionFromBearing,
  horizontalRight,
  rotateAroundUp,
} from './DoctrineMath';

const DEG = Math.PI / 180;

/** 战斗机 / 王牌共用的追击条令参数 */
export interface FighterTuning {
  /** 咬尾位：玩家身后这么远（米），并保持在 SLOT_MIN..SLOT_MAX 之间 */
  SLOT_DISTANCE: number;
  SLOT_MIN_DISTANCE: number;
  SLOT_MAX_DISTANCE: number;
  /** 与指派方位的夹角在这以内（弧度）且距离到位，才算咬住 */
  STATION_ANGLE: number;
  /** 点射：发数 / 发间隔 / 两轮之间的间隔（秒） */
  BURST_ROUNDS: number;
  ROUND_INTERVAL: number;
  BURST_INTERVAL: number;
  /** 开火条件：玩家在机头这个锥角（半角，弧度）之内、距离之内 */
  GUN_CONE: number;
  GUN_RANGE: number;
  /** 一次攻击航路最多打几轮点射、最多在咬尾位停留多久（秒），之后让出令牌 */
  MAX_BURSTS_PER_RUN: number;
  MAX_STATION_SECONDS: number;
  /** 迎头对冲：玩家机头对着本机、本机也朝着玩家的夹角上限，以及触发 / 交错距离（米） */
  HEAD_ON_PLAYER_ANGLE: number;
  HEAD_ON_SELF_ANGLE: number;
  HEAD_ON_MAX_DISTANCE: number;
  HEAD_ON_PASS_DISTANCE: number;
  HEAD_ON_MAX_SECONDS: number;
  /**
   * 咬尾位上的 S 形摆动：玩家比本机的最低速度（0.6× 基础速度）还慢时，用摆动把多余的速度
   * 耗掉，免得冲到玩家前面去。振幅上限（弧度）与周期（秒）
   */
  STATION_WEAVE_MAX: number;
  STATION_WEAVE_PERIOD: number;
  /** 对冲 / 攻击结束后拉开的时间（秒），以及拉开时偏离玩家一侧的转向角（弧度） */
  EXTEND_SECONDS: number;
  EXTEND_TURN: number;
  /** 没有令牌时的侧后方待命位：距离（米）与偏离正后方的角度（弧度） */
  FLANK_DISTANCE: number;
  FLANK_ANGLE: number;
  /** 被锁定 / 导弹来袭时的急转脱离 */
  BREAK_MIN_SECONDS: number;
  BREAK_REROLL_SECONDS: number;
  BREAK_PITCH_SIN: number;
  BREAK_TURN_SCALE: number;
  BREAK_THROTTLE: number;
  /** 追击时的转向倍数 */
  PURSUIT_TURN_SCALE: number;
}

/** 战斗机条令参数：起始值，波次 / 平衡批次可调 */
export const FIGHTER_TUNING: Readonly<FighterTuning> = {
  SLOT_DISTANCE: 200,
  SLOT_MIN_DISTANCE: 150,
  SLOT_MAX_DISTANCE: 250,
  STATION_ANGLE: 45 * DEG,
  BURST_ROUNDS: 4,
  ROUND_INTERVAL: 0.12,
  BURST_INTERVAL: 1.8,
  GUN_CONE: 12 * DEG,
  GUN_RANGE: 320,
  MAX_BURSTS_PER_RUN: 3,
  MAX_STATION_SECONDS: 10,
  HEAD_ON_PLAYER_ANGLE: 30 * DEG,
  HEAD_ON_SELF_ANGLE: 50 * DEG,
  HEAD_ON_MAX_DISTANCE: 450,
  HEAD_ON_PASS_DISTANCE: 80,
  HEAD_ON_MAX_SECONDS: 6,
  STATION_WEAVE_MAX: 75 * DEG,
  STATION_WEAVE_PERIOD: 4,
  EXTEND_SECONDS: 2.5,
  EXTEND_TURN: 35 * DEG,
  FLANK_DISTANCE: 300,
  FLANK_ANGLE: 70 * DEG,
  BREAK_MIN_SECONDS: 1.2,
  BREAK_REROLL_SECONDS: 1.6,
  BREAK_PITCH_SIN: 0.45,
  BREAK_TURN_SCALE: 1.6,
  BREAK_THROTTLE: 1.1,
  PURSUIT_TURN_SCALE: 1,
};

const tmpPoint = new Vector3();
const tmpToSelf = new Vector3();
const tmpToPlayer = new Vector3();
const tmpRight = new Vector3();
const tmpBack = new Vector3();

/**
 * FIGHTER — 狗斗机：绕到玩家后半球 150–250 米处咬尾并保持，玩家进入机头 12° 锥角才打四连发；
 * 玩家转过来迎头时对冲一轮点射后拉开。被锁定或有导弹来袭时急转脱离（垂直于视线，带俯冲 / 爬升）。
 *
 * 阶段：flank（没有令牌，在侧后方 300 米待命）→ pursue（咬尾 / 开火）→ extend（让出令牌、
 * 直线拉开）→ flank；head-on（迎头对冲）与 break（急转脱离）随时可能插入。
 */
export class FighterDoctrine extends JetDoctrine {
  public readonly id: string;

  protected readonly tuning: Readonly<FighterTuning>;
  protected readonly gun: BurstGun;
  private flankSide = 0;
  private stationTime = 0;
  private headOnBurstDone = false;
  private breakRollTime = 0;
  /** 拉开的方向（进入拉开时确定，水平单位向量） */
  private readonly extendDirection = new Vector3(0, 0, 1);

  constructor(tuning: Readonly<FighterTuning> = FIGHTER_TUNING, id = 'fighter') {
    super('flank', 2);
    this.id = id;
    this.tuning = tuning;
    this.gun = new BurstGun(tuning.BURST_ROUNDS, tuning.ROUND_INTERVAL, tuning.BURST_INTERVAL);
  }

  protected cancelAttack(): void {
    this.gun.cancel();
    this.gun.resetCompletedBursts();
    this.stationTime = 0;
    this.headOnBurstDone = false;
    this.flankSide = 0;
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    // 想要的进入方位：玩家的正后方（六点钟）
    this.request.desiredBearing = Math.atan2(-context.playerForward.x, -context.playerForward.z);

    if (this.isThreatened(context) && this.phase !== 'break') {
      this.enterBreak(context, command);
    }
    if (this.phase !== 'break' && this.interceptSpecial(context, command)) {
      return;
    }

    switch (this.phase) {
      case 'break':
        this.decideBreak(context, command);
        break;
      case 'pursue':
        this.decidePursue(context, command);
        break;
      case 'head-on':
        this.decideHeadOn(context, command);
        break;
      case 'extend':
        this.decideExtend(context, command);
        break;
      default:
        this.decideFlank(context, command);
        break;
    }
  }

  /** 子类的特殊机动（王牌的剪刀机动）：返回 true 表示本步已由它接管 */
  protected interceptSpecial(_context: DoctrineContext, _command: DoctrineCommand): boolean {
    return false;
  }

  /** 玩家转过来正对本机，且两机相向：迎头对冲 */
  private isHeadOn(context: DoctrineContext): boolean {
    if (context.distance > this.tuning.HEAD_ON_MAX_DISTANCE) return false;
    return (
      this.playerNoseAngle(context) < this.tuning.HEAD_ON_PLAYER_ANGLE &&
      this.noseToPlayerAngle(context) < this.tuning.HEAD_ON_SELF_ANGLE
    );
  }

  /** 没有令牌：飞到玩家侧后方约 300 米处并排待命，不开火 */
  private decideFlank(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (context.hasToken) {
      this.startRun();
      if (this.isHeadOn(context)) {
        this.setPhase('head-on');
        this.decideHeadOn(context, command);
      } else {
        this.setPhase('pursue');
        this.decidePursue(context, command);
      }
      return;
    }

    // 待在自己当前所在的一侧
    tmpToSelf.subVectors(context.position, context.playerPosition);
    horizontalRight(context.playerForward, tmpRight);
    if (this.flankSide === 0) {
      const lateral = tmpToSelf.dot(tmpRight);
      this.flankSide = Math.abs(lateral) > 1 ? Math.sign(lateral) : context.rng() < 0.5 ? -1 : 1;
    }
    const length = Math.hypot(context.playerForward.x, context.playerForward.z);
    if (length > 1e-6) {
      tmpBack.set(-context.playerForward.x / length, 0, -context.playerForward.z / length);
    } else {
      tmpBack.set(0, 0, 1);
    }
    const cos = Math.cos(this.tuning.FLANK_ANGLE);
    const sin = Math.sin(this.tuning.FLANK_ANGLE);
    tmpPoint
      .copy(tmpBack)
      .multiplyScalar(cos)
      .addScaledVector(tmpRight, sin * this.flankSide)
      .multiplyScalar(this.tuning.FLANK_DISTANCE)
      .add(context.playerPosition);
    const gap = tmpPoint.distanceTo(context.position);
    if (gap > 70) {
      // 追上待命位：带一点前置量
      tmpPoint.addScaledVector(context.playerVelocity, Math.min(1.5, gap / 120));
      this.steerToward(context, command, tmpPoint);
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
    } else {
      // 已在待命位：与玩家并排同向飞
      command.direction.copy(context.playerForward);
      this.applyAltitude(context, command, context.playerPosition.y);
      command.throttle = this.matchSpeed(context);
    }
  }

  private startRun(): void {
    this.gun.resetCompletedBursts();
    this.stationTime = 0;
    this.headOnBurstDone = false;
    this.flankSide = 0;
  }

  /** 与玩家同速（油门钳制在规则范围内） */
  private matchSpeed(context: DoctrineContext): number {
    const speed = context.playerVelocity.length();
    const throttle = context.baseSpeed > 0 ? speed / context.baseSpeed : 1;
    return Math.min(DOCTRINE_RULES.MAX_THROTTLE, Math.max(DOCTRINE_RULES.MIN_THROTTLE, throttle));
  }

  /** 持令牌：占住咬尾位，玩家进锥角就点射 */
  private decidePursue(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      this.gun.cancel();
      this.setPhase('flank');
      this.decideFlank(context, command);
      return;
    }
    if (this.isHeadOn(context) && !this.gun.isBursting()) {
      this.setPhase('head-on');
      this.decideHeadOn(context, command);
      return;
    }
    this.stationTime += context.dt;

    tmpToPlayer.subVectors(context.playerPosition, context.position);
    command.turnScale = this.tuning.PURSUIT_TURN_SCALE;

    // 导演指派方位上的咬尾位（最先领到令牌的在正后方，其余错开 60° 以上）
    const bearing = Number.isFinite(context.attackBearing)
      ? context.attackBearing
      : this.request.desiredBearing;
    const actual = bearingBetween(
      context.playerPosition.x,
      context.playerPosition.z,
      context.position.x,
      context.position.z
    );
    const onStation =
      context.distance <= this.tuning.SLOT_MAX_DISTANCE + 20 &&
      angularDistance(actual, bearing) < this.tuning.STATION_ANGLE;

    if (onStation) {
      // 咬住了：机头指向玩家，用油门把距离保持在 150–250 米
      command.direction.copy(tmpToPlayer);
      if (context.distance > this.tuning.SLOT_MAX_DISTANCE - 20) {
        command.throttle = 1.25;
      } else if (context.distance < this.tuning.SLOT_MIN_DISTANCE) {
        command.throttle = DOCTRINE_RULES.MIN_THROTTLE;
      } else {
        command.throttle = this.matchSpeed(context);
      }
      this.applyStationWeave(context, command);
    } else {
      // 还没到位：飞向咬尾位（带前置量）
      directionFromBearing(bearing, tmpPoint)
        .multiplyScalar(this.tuning.SLOT_DISTANCE)
        .add(context.playerPosition);
      const gap = tmpPoint.distanceTo(context.position);
      tmpPoint.addScaledVector(context.playerVelocity, Math.min(1.5, gap / 120));
      this.steerToward(context, command, tmpPoint);
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
    }

    const noseAngle = angleBetween(context.forward, tmpToPlayer);
    const inRange = context.distance < this.tuning.GUN_RANGE;
    const rounds = this.gun.tick(
      context.dt,
      context.cadenceScale,
      inRange && noseAngle < this.tuning.GUN_CONE,
      inRange && noseAngle < this.tuning.GUN_CONE * 2
    );
    for (let i = 0; i < rounds; i++) this.fireGunRound(context, command);

    const spent =
      this.gun.getCompletedBursts() >= this.tuning.MAX_BURSTS_PER_RUN ||
      this.stationTime > this.tuning.MAX_STATION_SECONDS;
    // 贴得太近（要冲过头了）也拉开重来
    const overshoot = context.distance < this.tuning.HEAD_ON_PASS_DISTANCE;
    if ((spent || overshoot) && !this.gun.isBursting()) {
      this.enterExtend(context, command);
    }
  }

  /**
   * 玩家比本机现在的速度慢（油门已经收到底还在逼近）：机头左右摆，把沿玩家航向的平均速度
   * 降到与玩家相当。摆幅 A 下的平均前进速度约为 v × (1 − A² / 4)，反过来求 A；
   * 机头每次扫过玩家时仍可能进入开火锥角。
   */
  private applyStationWeave(context: DoctrineContext, command: DoctrineCommand): void {
    if (context.distance >= this.tuning.SLOT_DISTANCE) return;
    const ratio = context.playerVelocity.length() / Math.max(context.speed, 1);
    if (!(ratio < 0.97)) return;
    const amplitude = Math.min(this.tuning.STATION_WEAVE_MAX, 2.2 * Math.sqrt(1 - ratio));
    this.applyWeave(command, amplitude, this.tuning.STATION_WEAVE_PERIOD);
  }

  /** 迎头对冲：直冲玩家，只打一轮点射，交错后拉开 */
  private decideHeadOn(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      this.gun.cancel();
      this.setPhase('flank');
      this.decideFlank(context, command);
      return;
    }
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    command.direction.copy(tmpToPlayer);
    command.throttle = 1.1;

    const noseAngle = angleBetween(context.forward, tmpToPlayer);
    const inRange = context.distance < this.tuning.GUN_RANGE;
    const rounds = this.gun.tick(
      context.dt,
      1,
      !this.headOnBurstDone && inRange && noseAngle < this.tuning.GUN_CONE,
      inRange && noseAngle < this.tuning.GUN_CONE * 2
    );
    if (rounds > 0) this.headOnBurstDone = true;
    for (let i = 0; i < rounds; i++) this.fireGunRound(context, command);

    const passed = context.forward.dot(tmpToPlayer) < 0;
    const burstOver = this.headOnBurstDone && !this.gun.isBursting();
    if (
      passed ||
      context.distance < this.tuning.HEAD_ON_PASS_DISTANCE ||
      (burstOver && context.distance < this.tuning.SLOT_MIN_DISTANCE) ||
      this.phaseTime > this.tuning.HEAD_ON_MAX_SECONDS
    ) {
      this.enterExtend(context, command);
    }
  }

  private enterExtend(context: DoctrineContext, command: DoctrineCommand): void {
    this.gun.cancel();
    if (context.hasToken) command.releaseToken = true;
    this.request.wants = false;
    this.flankSide = 0;

    // 拉开方向：当前航向朝背离玩家的一侧偏一个角度，不从玩家身上穿过去
    this.extendDirection.set(context.forward.x, 0, context.forward.z);
    if (this.extendDirection.lengthSq() < 1e-6) this.extendDirection.set(0, 0, 1);
    this.extendDirection.normalize();
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    horizontalRight(this.extendDirection, tmpRight);
    const lateral = tmpRight.dot(tmpToPlayer);
    const playerSide = Math.abs(lateral) > 1 ? Math.sign(lateral) : context.rng() < 0.5 ? -1 : 1;
    // horizontalRight 是方位角减小的方向：玩家在右侧（playerSide = 1）时向左转 = 正角度
    rotateAroundUp(this.extendDirection, playerSide * this.tuning.EXTEND_TURN);
    this.setPhase('extend');
  }

  /** 拉开：朝进入拉开时定下的方向飞一小段，再回到待命位重新申请令牌 */
  private decideExtend(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (this.phaseTime >= this.tuning.EXTEND_SECONDS) {
      this.setPhase('flank');
      this.decideFlank(context, command);
      return;
    }
    command.direction.copy(this.extendDirection);
    command.throttle = 1.2;
  }

  protected enterBreak(context: DoctrineContext, command: DoctrineCommand): void {
    this.gun.cancel();
    if (context.hasToken) command.releaseToken = true;
    this.request.wants = false;
    this.beginBreak(context, this.tuning.BREAK_PITCH_SIN);
    this.breakRollTime = 0;
    this.flankSide = 0;
    this.setPhase('break');
  }

  /** 急转脱离：垂直于视线急转并俯冲 / 爬升；威胁持续时每隔一阵换一次方向 */
  private decideBreak(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (!this.isThreatened(context) && this.phaseTime >= this.tuning.BREAK_MIN_SECONDS) {
      this.setPhase('flank');
      this.decideFlank(context, command);
      return;
    }
    this.breakRollTime += context.dt;
    if (this.breakRollTime >= this.tuning.BREAK_REROLL_SECONDS) {
      this.breakRollTime = 0;
      this.beginBreak(context, this.tuning.BREAK_PITCH_SIN);
    }
    command.direction.copy(this.breakDirection);
    command.throttle = this.tuning.BREAK_THROTTLE;
    command.turnScale = this.tuning.BREAK_TURN_SCALE;
  }
}
