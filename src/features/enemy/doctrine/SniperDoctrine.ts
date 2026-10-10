import { Vector3 } from 'three';
import { ENEMY_WEAPON_SPECS } from '../EnemyWeapons';
import { JetDoctrine } from './JetDoctrine';
import type { DoctrineCommand, DoctrineContext, DoctrineTell } from './DoctrineTypes';
import { angularDistance, bearingBetween, leadPoint } from './DoctrineMath';

const DEG = Math.PI / 180;

/** 狙击机（长枪手）条令参数：起始值，波次 / 平衡批次可调 */
export const SNIPER_TUNING = {
  /** 盘旋半径：每架在这个范围内取一个值（米）；规则要求的站位带是 380–520 米 */
  ORBIT_RADIUS_MIN: 410,
  ORBIT_RADIUS_MAX: 490,
  /** 盘旋高度相对玩家的偏移范围（米，± 一半） */
  ORBIT_HEIGHT_RANGE: 80,
  /** 蓄力：瞄准光束可见的总时长（秒），其中前 TRACK_SECONDS 跟踪玩家，之后冻结 */
  CHARGE_SECONDS: 1.3,
  TRACK_SECONDS: 0.9,
  /** 两发之间的间隔（秒，乘以开火节奏倍率；含蓄力时间） */
  SHOT_INTERVAL: 4.5,
  /** 生成后第一发之前的等待（秒） */
  FIRST_SHOT_DELAY_MIN: 1.5,
  FIRST_SHOT_DELAY_MAX: 3.5,
  /** 蓄力被打断后的重新准备时间（秒，乘以开火节奏倍率） */
  RETRY_DELAY: 1.2,
  /** 只在这个距离范围内开始蓄力（米） */
  CHARGE_MIN_DISTANCE: 260,
  CHARGE_MAX_DISTANCE: 620,
  /** 长枪弹提前量的最长预测时间（秒） */
  LANCE_MAX_LEAD_SECONDS: 3,
  /** 蓄力时收油门稳住机身 */
  CHARGE_THROTTLE: 0.6,
  /** 本机当前方位与指派方位相差超过这个角度时不蓄力（弧度）；持令牌空等超过这么久就让出 */
  BEARING_TOLERANCE: 25 * DEG,
  TOKEN_IDLE_SECONDS: 2.5,
  /** 玩家逼近到这个距离以内：中止蓄力，以 1.3× 速度拉开，直到这个距离之外 */
  FLEE_DISTANCE: 220,
  FLEE_UNTIL_DISTANCE: 330,
  FLEE_THROTTLE: 1.3,
  /** 被锁定 / 导弹来袭时的急转脱离 */
  BREAK_MIN_SECONDS: 1.4,
  BREAK_REROLL_SECONDS: 1.8,
  BREAK_PITCH_SIN: 0.4,
  BREAK_TURN_SCALE: 1.5,
  BREAK_THROTTLE: 1.3,
} as const;

const tmpDirection = new Vector3();

/**
 * SNIPER — 长枪手：在 380–520 米外盘旋。领到令牌后蓄力 1.3 秒：一条细红色瞄准光束指向玩家的
 * 前置位置，前 0.9 秒跟踪、后 0.4 秒冻结，然后一发高速长枪弹（约 320 米/秒）沿冻结的线打出。
 * 冻结后改变方向就能躲开。玩家逼近到 220 米内它中止蓄力逃开；被锁定或有导弹来袭时中止蓄力并
 * 急转脱离。
 *
 * 阶段：orbit（盘旋 / 等令牌）→ charge（蓄力）→ orbit；flee（拉开距离）与 break（急转脱离）
 * 随时可能插入。
 */
export class SniperDoctrine extends JetDoctrine {
  public readonly id = 'sniper';

  private rolled = false;
  private orbitRadius = (SNIPER_TUNING.ORBIT_RADIUS_MIN + SNIPER_TUNING.ORBIT_RADIUS_MAX) / 2;
  private orbitSign = 1;
  private heightOffset = 0;
  private shotCooldown = 0;
  private charging = false;
  private chargeTime = 0;
  private idleTime = 0;
  private breakRollTime = 0;
  private readonly tell: DoctrineTell = {
    kind: 'lance-beam',
    aimPoint: new Vector3(),
    progress: 0,
    frozen: false,
  };

  constructor() {
    super('orbit', 0);
  }

  public getTell(): Readonly<DoctrineTell> | null {
    return this.charging ? this.tell : null;
  }

  protected cancelAttack(): void {
    this.charging = false;
    this.chargeTime = 0;
    this.idleTime = 0;
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.orbitRadius =
        SNIPER_TUNING.ORBIT_RADIUS_MIN +
        context.rng() * (SNIPER_TUNING.ORBIT_RADIUS_MAX - SNIPER_TUNING.ORBIT_RADIUS_MIN);
      this.orbitSign = context.rng() < 0.5 ? -1 : 1;
      this.heightOffset = (context.rng() - 0.5) * SNIPER_TUNING.ORBIT_HEIGHT_RANGE;
      this.shotCooldown =
        SNIPER_TUNING.FIRST_SHOT_DELAY_MIN +
        context.rng() * (SNIPER_TUNING.FIRST_SHOT_DELAY_MAX - SNIPER_TUNING.FIRST_SHOT_DELAY_MIN);
    }
    this.shotCooldown = Math.max(0, this.shotCooldown - context.dt);
    this.request.desiredBearing = Number.NaN;

    if (this.isThreatened(context)) {
      if (this.phase !== 'break') {
        this.abortCharge(context, command);
        this.beginBreak(context, SNIPER_TUNING.BREAK_PITCH_SIN);
        this.breakRollTime = 0;
        this.setPhase('break');
      }
    } else if (
      context.distance < SNIPER_TUNING.FLEE_DISTANCE &&
      this.phase !== 'flee' &&
      this.phase !== 'break'
    ) {
      this.abortCharge(context, command);
      this.setPhase('flee');
    }

    switch (this.phase) {
      case 'break':
        this.decideBreak(context, command);
        break;
      case 'flee':
        this.decideFlee(context, command);
        break;
      case 'charge':
        this.decideCharge(context, command);
        break;
      default:
        this.decideOrbit(context, command);
        break;
    }
  }

  /** 中止蓄力（光束消失）、交还令牌，稍后重新准备 */
  private abortCharge(context: DoctrineContext, command: DoctrineCommand): void {
    if (this.charging) {
      this.shotCooldown = Math.max(
        this.shotCooldown,
        this.scaled(context, SNIPER_TUNING.RETRY_DELAY)
      );
    }
    this.charging = false;
    this.chargeTime = 0;
    this.idleTime = 0;
    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;
  }

  private scaled(context: DoctrineContext, seconds: number): number {
    return seconds * (context.cadenceScale > 0 ? context.cadenceScale : 1);
  }

  /** 盘旋待机；可以开火时申请令牌，领到且方位合适就开始蓄力 */
  private decideOrbit(context: DoctrineContext, command: DoctrineCommand): void {
    this.steerOrbit(context, command, this.orbitRadius, this.orbitSign, this.heightOffset);

    const ready =
      this.shotCooldown <= 0 &&
      context.distance >= SNIPER_TUNING.CHARGE_MIN_DISTANCE &&
      context.distance <= SNIPER_TUNING.CHARGE_MAX_DISTANCE;
    this.request.wants = ready;

    if (!context.hasToken) {
      this.idleTime = 0;
      return;
    }
    if (!ready) {
      command.releaseToken = true;
      this.idleTime = 0;
      return;
    }
    if (Number.isFinite(context.attackBearing)) {
      const actual = bearingBetween(
        context.playerPosition.x,
        context.playerPosition.z,
        context.position.x,
        context.position.z
      );
      if (angularDistance(actual, context.attackBearing) > SNIPER_TUNING.BEARING_TOLERANCE) {
        // 另一架持令牌的敌机占着这个方位：等一会儿，等不到就让出令牌
        this.idleTime += context.dt;
        if (this.idleTime > SNIPER_TUNING.TOKEN_IDLE_SECONDS) {
          command.releaseToken = true;
          this.request.wants = false;
          this.idleTime = 0;
          this.shotCooldown = this.scaled(context, SNIPER_TUNING.RETRY_DELAY);
        }
        return;
      }
    }

    // 开始蓄力：光束出现，播放蓄力音
    this.charging = true;
    this.chargeTime = 0;
    this.idleTime = 0;
    this.setPhase('charge');
    command.cue = 'lance-charge';
    command.cueDuration = SNIPER_TUNING.CHARGE_SECONDS;
    command.throttle = SNIPER_TUNING.CHARGE_THROTTLE;
    this.updateTell(context);
  }

  /** 蓄力：前 0.9 秒光束跟踪玩家的前置位置，之后冻结；满 1.3 秒沿冻结的线开火 */
  private decideCharge(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    if (!context.hasToken) {
      this.abortCharge(context, command);
      this.setPhase('orbit');
      this.steerOrbit(context, command, this.orbitRadius, this.orbitSign, this.heightOffset);
      return;
    }
    this.steerOrbit(context, command, this.orbitRadius, this.orbitSign, this.heightOffset);
    command.throttle = SNIPER_TUNING.CHARGE_THROTTLE;

    this.chargeTime += context.dt;
    this.updateTell(context);
    if (this.chargeTime < SNIPER_TUNING.CHARGE_SECONDS) return;

    // 开火：从当前位置沿冻结的瞄准线
    tmpDirection.subVectors(this.tell.aimPoint, context.position);
    this.pushShot(command, 'lance', tmpDirection, 1, false);
    this.charging = false;
    this.chargeTime = 0;
    this.shotCooldown = Math.max(
      1,
      this.scaled(context, SNIPER_TUNING.SHOT_INTERVAL) - SNIPER_TUNING.CHARGE_SECONDS
    );
    command.releaseToken = true;
    this.request.wants = false;
    this.setPhase('orbit');
  }

  /** 更新预警：跟踪阶段把瞄准点移到“开火时刻 + 弹丸飞行时间”后玩家会在的位置 */
  private updateTell(context: DoctrineContext): void {
    const tell = this.tell;
    const frozen = this.chargeTime >= SNIPER_TUNING.TRACK_SECONDS;
    if (!frozen || !tell.frozen) {
      // 跟踪中，或刚越过冻结时刻的这一步：最后更新一次瞄准点
      leadPoint(
        context.position,
        context.playerPosition,
        context.playerVelocity,
        ENEMY_WEAPON_SPECS.lance.speed,
        1,
        SNIPER_TUNING.LANCE_MAX_LEAD_SECONDS,
        Math.max(0, SNIPER_TUNING.CHARGE_SECONDS - this.chargeTime),
        tell.aimPoint
      );
    }
    tell.frozen = frozen;
    tell.progress = Math.min(1, this.chargeTime / SNIPER_TUNING.CHARGE_SECONDS);
  }

  /** 拉开距离：背向玩家以 1.3× 速度飞，直到重新拉开 */
  private decideFlee(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (context.distance > SNIPER_TUNING.FLEE_UNTIL_DISTANCE) {
      this.setPhase('orbit');
      this.decideOrbit(context, command);
      return;
    }
    command.direction.subVectors(context.position, context.playerPosition);
    command.direction.y = 0;
    if (command.direction.lengthSq() < 1e-6) command.direction.copy(context.forward);
    this.applyAltitude(context, command, context.playerPosition.y + this.heightOffset);
    command.throttle = SNIPER_TUNING.FLEE_THROTTLE;
  }

  /** 急转脱离：垂直于视线急转并俯冲 / 爬升；威胁持续时隔一阵换一次方向 */
  private decideBreak(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (!this.isThreatened(context) && this.phaseTime >= SNIPER_TUNING.BREAK_MIN_SECONDS) {
      this.setPhase('orbit');
      this.decideOrbit(context, command);
      return;
    }
    this.breakRollTime += context.dt;
    if (this.breakRollTime >= SNIPER_TUNING.BREAK_REROLL_SECONDS) {
      this.breakRollTime = 0;
      this.beginBreak(context, SNIPER_TUNING.BREAK_PITCH_SIN);
    }
    command.direction.copy(this.breakDirection);
    command.throttle = SNIPER_TUNING.BREAK_THROTTLE;
    command.turnScale = SNIPER_TUNING.BREAK_TURN_SCALE;
  }
}
