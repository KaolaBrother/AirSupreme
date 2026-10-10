import { Vector3 } from 'three';
import { ENEMY_WEAPON_SPECS } from '../EnemyWeapons';
import { JetDoctrine } from './JetDoctrine';
import type { DoctrineCommand, DoctrineContext } from './DoctrineTypes';
import {
  angleBetween,
  angularDistance,
  bearingBetween,
  horizontalRight,
  leadPoint,
  rotateAroundUp,
  scatterDirection,
} from './DoctrineMath';

const DEG = Math.PI / 180;

/** 重型机（炮艇）条令参数：起始值，波次 / 平衡批次可调 */
export const HEAVY_TUNING = {
  /** 两次扇面齐射之间的间隔（秒，乘以开火节奏倍率） */
  FAN_INTERVAL: 2.6,
  /** 扇面弹数：第 6 关之前 3 发，之后 5 发；整个扇面在 ±FAN_HALF_ANGLE 内均匀展开 */
  FAN_SHELLS: 3,
  FAN_SHELLS_LATE: 5,
  FAN_LATE_LEVEL: 6,
  FAN_HALF_ANGLE: 8 * DEG,
  /** 齐射条件：距离内、玩家在机头这个半角之内（炮塔射界） */
  FAN_RANGE: 340,
  FAN_ARC: 70 * DEG,
  /** 高炮弹的最长预测时间（秒） */
  FAN_MAX_LEAD_SECONDS: 5,
  /** 领到令牌后第一次齐射前的准备时间（秒） */
  FAN_FIRST_DELAY: 0.8,
  /** 本机当前方位与指派方位相差超过这个角度时不齐射（弧度）：等导演让出方位 */
  BEARING_TOLERANCE: 25 * DEG,
  /** 尾炮：玩家在正后方这个半角内、这个距离内时单发瞄准射击 */
  TAIL_RANGE: 250,
  TAIL_ARC: 18 * DEG,
  TAIL_INTERVAL: 0.9,
  TAIL_DAMAGE_SCALE: 0.5,
  /** 一次攻击航路：最多几次齐射、最长多久（秒），之后让出令牌并休息 */
  MAX_FANS_PER_RUN: 3,
  MAX_RUN_SECONDS: 12,
  REST_SECONDS: 2,
  /** 进入这个距离才申请令牌（米）；还在射程外时，要正在以至少 ENGAGE_MIN_CLOSING 接近才申请 */
  ENGAGE_DISTANCE: 480,
  ENGAGE_MIN_CLOSING: 5,
  /** 持令牌却打不出去（射程外 / 玩家不在炮塔射界 / 方位被占）超过这么久就让出令牌（秒） */
  TOKEN_IDLE_SECONDS: 3,
  /** 贴近到这个距离就不再转向、直线穿过；拉开到这个距离后再回头（米） */
  PASS_NEAR_DISTANCE: 110,
  PASS_FAR_DISTANCE: 240,
  /** 接近时的最长前置时间（秒） */
  APPROACH_LEAD_SECONDS: 2,
  /** 接近航线对准玩家侧面这么远的一点（米）：从玩家身边压过去，而不是从玩家身上穿过去 */
  PASS_OFFSET: 70,
} as const;

const tmpAim = new Vector3();
const tmpShot = new Vector3();
const tmpToPlayer = new Vector3();
const tmpBackward = new Vector3();
const tmpRight = new Vector3();

/**
 * HEAVY — 炮艇：又大又慢，不躲避。稳稳地朝玩家压过来，每 2.6 秒向玩家的前置位置打出一个
 * 慢速高炮弹扇面（3 发，第 6 关起 5 发）；玩家坐到它正后方 250 米内会吃尾炮的单发瞄准射击
 * （尾炮是防御武器，不占攻击令牌）。
 * 从侧面或下方接近是安全的。对锁定和来袭导弹没有反应。
 *
 * 阶段：advance（接近，没有令牌或还在准备）→ barrage（持令牌齐射）→ advance；
 * pass（贴得太近：保持航向穿过，拉开后再回头）可与开火同时进行。
 */
export class HeavyDoctrine extends JetDoctrine {
  public readonly id = 'heavy';

  private fanCooldown = 0;
  private tailCooldown = 0;
  private fansThisRun = 0;
  private runTime = 0;
  private restTime = 0;
  /** 持令牌但打不出去已经多久（秒） */
  private idleTime = 0;
  private passing = false;
  /** 这次接近从玩家的哪一侧压过去（1 / -1；0 = 还没选） */
  private passSide = 0;

  constructor() {
    super('advance', 0);
  }

  protected cancelAttack(): void {
    this.fansThisRun = 0;
    this.runTime = 0;
    this.idleTime = 0;
    this.passing = false;
    this.passSide = 0;
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    const dt = context.dt;
    this.fanCooldown = Math.max(0, this.fanCooldown - dt);
    this.tailCooldown = Math.max(0, this.tailCooldown - dt);
    this.restTime = Math.max(0, this.restTime - dt);

    this.fly(context, command);
    // 尾炮是防御武器：不需要攻击令牌，玩家坐到正后方就挨打
    if (context.weaponsFree) this.fireTailGun(context, command);

    this.request.desiredBearing = Number.NaN;
    // 追不上的玩家不占令牌：射程内随时申请；射程外要正在接近才申请
    this.request.wants =
      this.restTime <= 0 &&
      context.distance < HEAVY_TUNING.ENGAGE_DISTANCE &&
      (context.distance <= HEAVY_TUNING.FAN_RANGE ||
        this.closingSpeed(context) > HEAVY_TUNING.ENGAGE_MIN_CLOSING);

    if (!context.hasToken || !this.request.wants) {
      if (context.hasToken) command.releaseToken = true;
      if (this.runTime > 0) {
        // 令牌被收回 / 玩家飞远：这次航路结束
        this.runTime = 0;
        this.fansThisRun = 0;
      }
      this.idleTime = 0;
      this.setPhase(this.passing ? 'pass' : 'advance');
      return;
    }

    if (this.runTime === 0) {
      // 刚领到令牌：留出准备时间，不在领到的同一步开火
      this.fanCooldown = Math.max(this.fanCooldown, HEAVY_TUNING.FAN_FIRST_DELAY);
    }
    this.runTime += dt;
    this.setPhase(this.passing ? 'pass' : 'barrage');

    const canFire = this.canFireFan(context);
    this.idleTime = canFire ? 0 : this.idleTime + dt;
    if (canFire && this.fanCooldown <= 0) this.fireFan(context, command);

    if (
      this.fansThisRun >= HEAVY_TUNING.MAX_FANS_PER_RUN ||
      this.runTime > HEAVY_TUNING.MAX_RUN_SECONDS ||
      this.idleTime > HEAVY_TUNING.TOKEN_IDLE_SECONDS
    ) {
      // 打完了 / 打不出去：让出令牌，休息一下再来
      command.releaseToken = true;
      this.request.wants = false;
      this.restTime = HEAVY_TUNING.REST_SECONDS;
      this.runTime = 0;
      this.fansThisRun = 0;
      this.idleTime = 0;
    }
  }

  /** 沿视线接近玩家的速率（米/秒；负值 = 正在被拉开） */
  private closingSpeed(context: DoctrineContext): number {
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    const length = tmpToPlayer.length();
    if (!(length > 1e-3)) return 0;
    const velocity = context.playerVelocity;
    return (
      (tmpToPlayer.x * (context.forward.x * context.speed - velocity.x) +
        tmpToPlayer.y * (context.forward.y * context.speed - velocity.y) +
        tmpToPlayer.z * (context.forward.z * context.speed - velocity.z)) /
      length
    );
  }

  /** 现在打得出扇面：射程内、玩家在炮塔射界里、本机在指派的方位上 */
  private canFireFan(context: DoctrineContext): boolean {
    if (context.distance > HEAVY_TUNING.FAN_RANGE) return false;
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    if (angleBetween(context.forward, tmpToPlayer) > HEAVY_TUNING.FAN_ARC) return false;
    if (Number.isFinite(context.attackBearing)) {
      const actual = bearingBetween(
        context.playerPosition.x,
        context.playerPosition.z,
        context.position.x,
        context.position.z
      );
      if (angularDistance(actual, context.attackBearing) > HEAVY_TUNING.BEARING_TOLERANCE) {
        return false;
      }
    }
    return true;
  }

  /** 朝玩家的前置位置飞；贴得太近时保持航向穿过，拉开后再回头（转向慢，不做机动） */
  private fly(context: DoctrineContext, command: DoctrineCommand): void {
    if (this.passing) {
      if (context.distance > HEAVY_TUNING.PASS_FAR_DISTANCE) {
        this.passing = false;
        this.passSide = 0;
      }
    } else if (context.distance < HEAVY_TUNING.PASS_NEAR_DISTANCE) {
      this.passing = true;
    }

    if (this.passing) {
      command.direction.set(context.forward.x, 0, context.forward.z);
      if (command.direction.lengthSq() < 1e-8) command.direction.copy(context.forward);
      this.applyAltitude(context, command, context.playerPosition.y);
      command.throttle = 1;
      return;
    }
    const lead = Math.min(
      HEAVY_TUNING.APPROACH_LEAD_SECONDS,
      context.distance / Math.max(context.speed, 1)
    );
    tmpAim.copy(context.playerPosition).addScaledVector(context.playerVelocity, lead);
    // 瞄着玩家侧面的一点飞：选本机已经偏向的那一侧，分不清时随机
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    horizontalRight(tmpToPlayer, tmpRight);
    if (this.passSide === 0) {
      const lateral = context.forward.dot(tmpRight);
      this.passSide = Math.abs(lateral) > 0.05 ? Math.sign(lateral) : context.rng() < 0.5 ? -1 : 1;
    }
    tmpAim.addScaledVector(tmpRight, this.passSide * HEAVY_TUNING.PASS_OFFSET);
    this.steerToward(context, command, tmpAim);
    // 远了加速压上去，近了收油门稳住炮口
    command.throttle = context.distance > HEAVY_TUNING.FAN_RANGE ? 1.2 : 0.85;
  }

  /** 高炮弹扇面：瞄准玩家的前置位置，绕竖轴在 ±8° 内均匀展开（调用前已确认打得出去） */
  private fireFan(context: DoctrineContext, command: DoctrineCommand): void {
    leadPoint(
      context.position,
      context.playerPosition,
      context.playerVelocity,
      ENEMY_WEAPON_SPECS['heavy-shell'].speed,
      1,
      HEAVY_TUNING.FAN_MAX_LEAD_SECONDS,
      0,
      tmpAim
    );
    tmpAim.sub(context.position);
    if (!(tmpAim.lengthSq() > 1e-8)) return;
    tmpAim.normalize();

    const shells =
      context.level >= HEAVY_TUNING.FAN_LATE_LEVEL
        ? HEAVY_TUNING.FAN_SHELLS_LATE
        : HEAVY_TUNING.FAN_SHELLS;
    for (let i = 0; i < shells; i++) {
      const offset = shells > 1 ? (i / (shells - 1)) * 2 - 1 : 0;
      tmpShot.copy(tmpAim);
      rotateAroundUp(tmpShot, offset * HEAVY_TUNING.FAN_HALF_ANGLE);
      // 整个扇面只响一声、只闪一次：第一发之后的都是静音弹
      this.pushShot(command, 'heavy-shell', tmpShot, 1, i > 0);
    }
    this.fanCooldown =
      HEAVY_TUNING.FAN_INTERVAL * (context.cadenceScale > 0 ? context.cadenceScale : 1);
    this.fansThisRun++;
  }

  /** 尾炮：玩家坐在正后方时的单发瞄准射击 */
  private fireTailGun(context: DoctrineContext, command: DoctrineCommand): void {
    if (this.tailCooldown > 0 || context.distance > HEAVY_TUNING.TAIL_RANGE) return;
    tmpToPlayer.subVectors(context.playerPosition, context.position);
    tmpBackward.copy(context.forward).multiplyScalar(-1);
    if (angleBetween(tmpBackward, tmpToPlayer) > HEAVY_TUNING.TAIL_ARC) return;

    this.gunAimPoint(context, tmpAim);
    tmpShot.subVectors(tmpAim, context.position);
    if (!(tmpShot.lengthSq() > 1e-8)) return;
    tmpShot.normalize();
    scatterDirection(tmpShot, Math.max(0, 1 - context.accuracy) * 0.08, context.rng);
    this.pushShot(command, 'bullet', tmpShot, HEAVY_TUNING.TAIL_DAMAGE_SCALE, false, true);
    this.tailCooldown =
      HEAVY_TUNING.TAIL_INTERVAL * (context.cadenceScale > 0 ? context.cadenceScale : 1);
  }
}
