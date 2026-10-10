import { Vector3 } from 'three';
import { ENEMY_WEAPON_SPECS, type EnemyWeaponKind } from '../EnemyWeapons';
import {
  DOCTRINE_RULES,
  type AttackRequest,
  type CloakState,
  type DoctrineCommand,
  type DoctrineContext,
  type DoctrineTell,
  type IEnemyDoctrine,
  type ShotRequest,
} from './DoctrineTypes';
import {
  angleBetween,
  horizontalRight,
  leadPoint,
  rotateAroundUp,
  scatterDirection,
} from './DoctrineMath';

/** 一步里最多的射击请求数（重型机 5 发扇面 + 1 发尾炮） */
export const MAX_SHOTS_PER_STEP = 6;

/**
 * 机炮散布（弧度）：总散布角 = (1 - accuracy) × GUN_SPREAD，偏航与俯仰各自独立均匀分布。
 * 比旧版（0.4）收得更紧：点射要么打在玩家身上、要么擦身而过，靠机动能躲开。
 */
export const GUN_SPREAD = 0.16;
/** 机炮提前量的最长预测时间（秒） */
const GUN_MAX_LEAD_SECONDS = 4;
/** 盘旋半径误差的归一化宽度（米）：偏离这么远时径向修正拉满 */
const ORBIT_BAND = 120;
/** 高度误差的归一化宽度（米）与最大爬升 / 俯冲坡度 */
const ALTITUDE_BAND = 120;
const MAX_ALTITUDE_SLOPE = 0.4;

// 模块级临时量：只在单次调用内使用（各条令共享，update 同步执行）
const tmpToSelf = new Vector3();
const tmpAim = new Vector3();
const tmpShot = new Vector3();
const tmpRight = new Vector3();

export function createDoctrineCommand(): DoctrineCommand {
  const shots: ShotRequest[] = [];
  for (let i = 0; i < MAX_SHOTS_PER_STEP; i++) {
    shots.push({
      weapon: 'bullet',
      direction: new Vector3(0, 0, 1),
      damageScale: 1,
      quiet: false,
      defensive: false,
    });
  }
  return {
    direction: new Vector3(),
    throttle: 1,
    turnScale: 1,
    shots,
    shotCount: 0,
    missileLock: false,
    missileLaunch: 0,
    releaseToken: false,
    cue: null,
    cueDuration: 0,
  };
}

export function resetDoctrineCommand(command: DoctrineCommand): void {
  command.direction.set(0, 0, 0);
  command.throttle = 1;
  command.turnScale = 1;
  command.shotCount = 0;
  command.missileLock = false;
  command.missileLaunch = 0;
  command.releaseToken = false;
  command.cue = null;
  command.cueDuration = 0;
}

/**
 * 点射节拍器：一轮点射 rounds 发、发与发间隔 roundInterval 秒，两轮点射之间休息
 * burstInterval 秒（乘以开火节奏倍率）。只管时间，不管瞄准。
 */
export class BurstGun {
  private remaining = 0;
  private roundTimer = 0;
  private cooldown = 0;
  private completed = 0;

  constructor(
    private readonly rounds: number,
    private readonly roundInterval: number,
    private readonly burstInterval: number
  ) {}

  /**
   * 推进 dt 秒，返回本步应打出的发数。
   * @param canStart 现在可以开始新一轮点射（已对准、在射程内、持有令牌）
   * @param canContinue 点射中的后续弹还可以打出；为 false 时这一轮作废并进入休息
   */
  public tick(dt: number, cadenceScale: number, canStart: boolean, canContinue: boolean): number {
    this.cooldown = Math.max(0, this.cooldown - dt);
    let fired = 0;
    if (this.remaining > 0) {
      if (!canContinue) {
        this.finishBurst(cadenceScale);
        return 0;
      }
      this.roundTimer -= dt;
      while (this.remaining > 0 && this.roundTimer <= 0 && fired < this.rounds) {
        fired++;
        this.remaining--;
        this.roundTimer += this.roundInterval;
      }
      if (this.remaining === 0) this.finishBurst(cadenceScale);
    } else if (canStart && this.cooldown <= 0) {
      fired = 1;
      this.remaining = this.rounds - 1;
      this.roundTimer = this.roundInterval;
      if (this.remaining === 0) this.finishBurst(cadenceScale);
    }
    return fired;
  }

  private finishBurst(cadenceScale: number): void {
    this.remaining = 0;
    this.cooldown = this.burstInterval * (cadenceScale > 0 ? cadenceScale : 1);
    this.completed++;
  }

  /** 正在点射中（已打出第一发、还有后续弹） */
  public isBursting(): boolean {
    return this.remaining > 0;
  }

  /** 休息完了、可以开始新一轮点射 */
  public isReady(): boolean {
    return this.remaining === 0 && this.cooldown <= 0;
  }

  /** 已打完（或中途作废）的点射轮数 */
  public getCompletedBursts(): number {
    return this.completed;
  }

  public resetCompletedBursts(): void {
    this.completed = 0;
  }

  /** 中断：正在进行的点射作废（不计入轮数）；休息计时保留 */
  public cancel(): void {
    this.remaining = 0;
  }
}

/**
 * 条令基类：所有机型共用的规则——没有目标时保持航向、拴绳（离玩家超过 900 米直线飞回）、
 * 令牌请求记账，以及盘旋 / 摆动 / 急转脱离 / 机炮点射等共用动作。
 */
export abstract class JetDoctrine implements IEnemyDoctrine {
  public abstract readonly id: string;

  protected phase: string;
  /** 当前阶段已持续的时间（秒） */
  protected phaseTime = 0;
  /** 条令自己的累计时间（秒）：摆动相位用 */
  protected clock = 0;
  private leashed = false;
  private readonly initialPhase: string;
  protected readonly request: AttackRequest;

  /** 急转脱离的方向（进入脱离时确定，世界坐标单位向量） */
  protected readonly breakDirection = new Vector3(1, 0, 0);
  private breakVertical = 1;

  protected constructor(initialPhase: string, bearingPriority: number, pairsOpposite = false) {
    this.initialPhase = initialPhase;
    this.phase = initialPhase;
    this.request = {
      wants: false,
      desiredBearing: Number.NaN,
      bearingPriority,
      pairsOpposite,
    };
  }

  public getPhase(): string {
    return this.leashed ? 'return' : this.phase;
  }

  public getAttackRequest(): Readonly<AttackRequest> {
    return this.request;
  }

  public getTell(): Readonly<DoctrineTell> | null {
    return null;
  }

  public getMissileRequest(): number {
    return 0;
  }

  public getCloak(): Readonly<CloakState> | null {
    return null;
  }

  public notifyHit(): void {
    // 大多数机型挨打没有特别反应
  }

  public update(context: DoctrineContext, command: DoctrineCommand): void {
    const dt = context.dt > 0 ? context.dt : 0;
    this.clock += dt;
    this.phaseTime += dt;

    if (!context.hasPlayer) {
      // 没有目标：保持航向巡航，不占令牌
      this.standDown(context, command);
      command.direction.copy(context.forward);
      return;
    }

    // 拴绳：离玩家太远就直线飞回战场
    const limit = this.leashed
      ? DOCTRINE_RULES.LEASH_RESUME_DISTANCE
      : DOCTRINE_RULES.LEASH_DISTANCE;
    if (context.distance > limit) {
      if (!this.leashed) {
        this.leashed = true;
        this.interrupt();
      }
      this.standDown(context, command);
      command.direction.subVectors(context.playerPosition, context.position);
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
      return;
    }
    this.leashed = false;

    this.decide(context, command);
  }

  public interrupt(): void {
    this.phase = this.initialPhase;
    this.phaseTime = 0;
    this.request.wants = false;
    this.cancelAttack();
  }

  /** 机型自己的决策（已有玩家目标、未被拴绳） */
  protected abstract decide(context: DoctrineContext, command: DoctrineCommand): void;

  /** 取消进行中的点射 / 蓄力（瘫痪、拴绳、重新生成时调用） */
  protected abstract cancelAttack(): void;

  private standDown(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;
  }

  protected setPhase(phase: string): void {
    if (this.phase !== phase) {
      this.phase = phase;
      this.phaseTime = 0;
    }
  }

  // -------------------------------------------------------------------------------------------
  // 感知
  // -------------------------------------------------------------------------------------------

  protected isThreatened(context: DoctrineContext): boolean {
    return context.lockedOn || context.missileInbound;
  }

  /** 玩家机头与“玩家 → 本机”连线的夹角（弧度）：小 = 玩家正对着本机 */
  protected playerNoseAngle(context: DoctrineContext): number {
    tmpToSelf.subVectors(context.position, context.playerPosition);
    return angleBetween(context.playerForward, tmpToSelf);
  }

  /** 本机机头与“本机 → 玩家”连线的夹角（弧度）：小 = 玩家在本机正前方 */
  protected noseToPlayerAngle(context: DoctrineContext): number {
    tmpToSelf.subVectors(context.playerPosition, context.position);
    return angleBetween(context.forward, tmpToSelf);
  }

  /** 与玩家同速所需的油门（钳制在规则范围内） */
  protected throttleToMatch(context: DoctrineContext): number {
    const speed = context.playerVelocity.length();
    const throttle = context.baseSpeed > 0 ? speed / context.baseSpeed : 1;
    return Math.min(DOCTRINE_RULES.MAX_THROTTLE, Math.max(DOCTRINE_RULES.MIN_THROTTLE, throttle));
  }

  // -------------------------------------------------------------------------------------------
  // 飞行动作
  // -------------------------------------------------------------------------------------------

  /** 朝世界坐标点飞 */
  protected steerToward(context: DoctrineContext, command: DoctrineCommand, point: Vector3): void {
    command.direction.subVectors(point, context.position);
  }

  /**
   * 绕玩家盘旋：切向前进 + 径向修正到 radius，高度向“玩家高度 + heightOffset”靠拢。
   * sign = 1 / -1 决定绕行方向。
   */
  protected steerOrbit(
    context: DoctrineContext,
    command: DoctrineCommand,
    radius: number,
    sign: number,
    heightOffset: number
  ): void {
    const rx = context.position.x - context.playerPosition.x;
    const rz = context.position.z - context.playerPosition.z;
    const distance = Math.hypot(rx, rz);
    if (!(distance > 1e-3)) {
      command.direction.copy(context.forward);
      return;
    }
    const ux = rx / distance;
    const uz = rz / distance;
    let error = (radius - distance) / ORBIT_BAND;
    error = error > 1 ? 1 : error < -1 ? -1 : error;
    const tangential = 1 - 0.6 * Math.abs(error);
    command.direction.set(
      -uz * sign * tangential + ux * error,
      0,
      ux * sign * tangential + uz * error
    );
    this.applyAltitude(context, command, context.playerPosition.y + heightOffset);
  }

  /** 给已写好的水平方向加上高度修正：向 targetY 靠拢，坡度受限 */
  protected applyAltitude(
    context: DoctrineContext,
    command: DoctrineCommand,
    targetY: number
  ): void {
    const horizontal = Math.hypot(command.direction.x, command.direction.z);
    let slope = (targetY - context.position.y) / ALTITUDE_BAND;
    slope =
      slope > MAX_ALTITUDE_SLOPE
        ? MAX_ALTITUDE_SLOPE
        : slope < -MAX_ALTITUDE_SLOPE
          ? -MAX_ALTITUDE_SLOPE
          : slope;
    command.direction.y = slope * (horizontal > 1e-6 ? horizontal : 1);
  }

  /** 蛇形摆动：把已写好的方向绕竖轴左右摆（amplitude 弧度、period 秒） */
  protected applyWeave(command: DoctrineCommand, amplitude: number, period: number): void {
    const phase = (this.clock / period) * Math.PI * 2;
    rotateAroundUp(command.direction, amplitude * Math.sin(phase));
  }

  /**
   * 急转脱离：方向垂直于“玩家 → 本机”的视线（顺着本机已有的侧向分量，分不清时随机选边），
   * 再加上俯冲或爬升（pitchSin 为俯仰角的正弦）。每次调用上下方向交替。
   */
  protected beginBreak(context: DoctrineContext, pitchSin: number): void {
    tmpToSelf.subVectors(context.position, context.playerPosition);
    horizontalRight(tmpToSelf, tmpRight);
    const along = context.forward.dot(tmpRight);
    const side = Math.abs(along) > 0.15 ? Math.sign(along) : context.rng() < 0.5 ? -1 : 1;
    this.breakVertical =
      this.phase === 'break' ? -this.breakVertical : context.rng() < 0.5 ? -1 : 1;
    const horizontal = Math.sqrt(Math.max(0, 1 - pitchSin * pitchSin));
    this.breakDirection.set(
      tmpRight.x * side * horizontal,
      this.breakVertical * pitchSin,
      tmpRight.z * side * horizontal
    );
  }

  // -------------------------------------------------------------------------------------------
  // 射击
  // -------------------------------------------------------------------------------------------

  /**
   * 追加一次射击请求（direction 会被复制并归一化）；超出上限时忽略。
   * defensive = 防御性射击：没有攻击令牌也会打出（只有重型机尾炮使用）。
   */
  protected pushShot(
    command: DoctrineCommand,
    weapon: EnemyWeaponKind,
    direction: Vector3,
    damageScale: number,
    quiet: boolean,
    defensive = false
  ): void {
    if (command.shotCount >= command.shots.length) return;
    const lengthSq = direction.lengthSq();
    if (!(lengthSq > 1e-12) || !Number.isFinite(lengthSq)) return;
    const shot = command.shots[command.shotCount++];
    shot.weapon = weapon;
    shot.direction.copy(direction).multiplyScalar(1 / Math.sqrt(lengthSq));
    shot.damageScale = damageScale;
    shot.quiet = quiet;
    shot.defensive = defensive;
  }

  /** 机炮瞄准点：按关卡给的提前量系数瞄准拦截点，写入 out */
  protected gunAimPoint(context: DoctrineContext, out: Vector3): Vector3 {
    return leadPoint(
      context.position,
      context.playerPosition,
      context.playerVelocity,
      ENEMY_WEAPON_SPECS.bullet.speed,
      context.aimLead,
      GUN_MAX_LEAD_SECONDS,
      0,
      out
    );
  }

  /** 打出一发机炮弹：瞄准提前点，再按命中精度加散布 */
  protected fireGunRound(
    context: DoctrineContext,
    command: DoctrineCommand,
    damageScale = 1
  ): void {
    this.gunAimPoint(context, tmpAim);
    tmpShot.subVectors(tmpAim, context.position);
    if (!(tmpShot.lengthSq() > 1e-8)) return;
    tmpShot.normalize();
    scatterDirection(tmpShot, Math.max(0, 1 - context.accuracy) * GUN_SPREAD, context.rng);
    this.pushShot(command, 'bullet', tmpShot, damageScale, false);
  }
}
