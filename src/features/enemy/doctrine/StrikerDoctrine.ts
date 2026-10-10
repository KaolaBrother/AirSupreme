import { JetDoctrine } from './JetDoctrine';
import { DOCTRINE_RULES, type DoctrineCommand, type DoctrineContext } from './DoctrineTypes';
import { MissileRack, type MissileRackTuning } from './MissileRack';
import { wrapAngle } from './DoctrineMath';

const DEG = Math.PI / 180;

/** 导弹机条令参数：起始值，波次 / 平衡批次可调 */
export const STRIKER_TUNING = {
  /** 待在离玩家这个距离带里（米），在带的中线上盘旋 */
  BAND_MIN: 450,
  BAND_MAX: 700,
  STANDOFF_RADIUS: 575,
  /** 站位半径误差的归一化宽度（米）：偏离这么远时径向修正拉满 */
  STANDOFF_BAND: 110,
  /**
   * 待命站位：从玩家看，在玩家正侧方（离玩家机头这么大的角度），自己所在的那一侧；方位误差的
   * 归一化宽度（弧度）。误差拉满时相对玩家的速率（米/秒）：径向 / 绕行分开给，绕行慢一些——
   * 玩家转弯、站位点转得比它快时先守住距离
   */
  STATION_OFF_NOSE: 90 * DEG,
  STATION_BEARING_BAND: 25 * DEG,
  STATION_RADIAL_SPEED: 40,
  STATION_AROUND_SPEED: 15,
  /** 相对玩家机头的方位偏开这么多以上才改换站位的一侧（避免在机头 / 机尾线上来回换边） */
  SIDE_SWITCH_ANGLE: 20 * DEG,
  /**
   * 玩家机头对着它、或对着它的机炮提前量点（夹角 CHASED_NOSE_ANGLE 以内）= 玩家在追它：这时不为了
   * 保持距离而后退得比玩家还快——它是值得冲上去打的目标；两者都偏开到 PASSING_NOSE_ANGLE 以外 =
   * 玩家只是路过：跟着玩家保持距离。提前量点只在拦截距离 GUN_LEAD_MAX_RANGE（米）以内才算数
   */
  CHASED_NOSE_ANGLE: 6 * DEG,
  PASSING_NOSE_ANGLE: 12 * DEG,
  GUN_LEAD_MAX_RANGE: 700,
  /** 相对玩家高度的偏移范围（米，生成时在 ± 一半内随机） */
  HEIGHT_RANGE: 70,
  /** 锁定 2.4 秒（HUD“锁定中”），双发间隔 0.4 秒，之后掉头装填约 10 秒 */
  LOCK_SECONDS: 2.4,
  SALVO: 2,
  SALVO_GAP: 0.4,
  RELOAD_SECONDS: 10,
  BREAK_GRACE: 0.6,
  RETRY_SECONDS: 3,
  /** 发射条件：距离（带的两端各放宽一点）与机头对玩家的夹角 */
  LOCK_MIN_RANGE: 400,
  LOCK_MAX_RANGE: 760,
  /**
   * 开始锁定前按玩家直线飞行估算：转过来（LOCK_TURN_SECONDS）+ 锁定 + 齐射之后离玩家多远——
   * 要还在距离带里，不然会被玩家碾过或甩开（锁定中断，或掉出距离带）；接着掉头装填
   * RELOAD_SECONDS 之后离玩家多远——超过 RELOAD_END_MAX（米）就会被甩到距离带外，这时只要它
   * 正在往前赶（这个估算每秒缩短 GAIN_RATE 米以上），先赶到侧方再锁定；赶不上（玩家和它一样快）
   * 就在原地锁定
   */
  LOCK_TURN_SECONDS: 0.8,
  RELOAD_END_MAX: 760,
  GAIN_RATE: 3,
  GAIN_SAMPLE_SECONDS: 0.5,
  FACING_ANGLE: 30 * DEG,
  /** 锁定时压着机头慢慢靠近；装填时慢速远离——又慢又脆，值得冲上去打 */
  LOCK_THROTTLE: 0.7,
  RELOAD_THROTTLE: 0.6,
  /**
   * 装填时远离到这个距离就改为跟着玩家绕圈（米）：不飞出拴绳范围。远离的航向离“背向玩家”
   * 最多偏 AWAY_CONE（弧度，离“指向玩家”至少 180° − AWAY_CONE），在这个范围里尽量顺着玩家的
   * 航向飞——掉头背着玩家飞，又不至于被直线飞行的玩家甩开太远；离玩家近于 BAND_MIN 时这个
   * 范围随距离收窄，到 LOCK_MIN_RANGE 时径直背向玩家飞（玩家朝它这边转弯时不被追上）
   */
  RELOAD_AWAY_DISTANCE: 760,
  AWAY_CONE: 80 * DEG,
  /**
   * 玩家航向在 AWAY_CONE 以外时贴着范围的哪一边飞：玩家航向离“朝着本机”不到这个角度（玩家几乎
   * 正对着它飞来，两边差不多）时沿用上一步选的那一边，不在两边之间来回掉头
   */
  AWAY_SIDE_HOLD: 60 * DEG,
  /** 拿着攻击令牌却等不到导弹令牌 / 对不准，这么久就让出令牌（秒），之后歇一会儿 */
  TOKEN_IDLE_SECONDS: 4,
  TOKEN_REST_SECONDS: 2,
  /** 生成后第一次锁定前的等待（秒，范围内随机） */
  FIRST_DELAY_MIN: 2,
  FIRST_DELAY_MAX: 4,
} as const satisfies MissileRackTuning & Record<string, number>;

/**
 * STRIKER — 导弹机：没有机炮，待在 450–700 米外。领到攻击令牌后把机头对准玩家锁定 2.4 秒，
 * 相隔 0.4 秒打出两枚追踪导弹（受全队导弹令牌限制：只剩一个就只打一枚），然后掉头慢速
 * 远离、装填约 10 秒。对锁定和来袭导弹没有别的反应。Boss 战里不发射。
 *
 * 阶段：standoff（在距离带里盘旋）→ lock（锁定 / 齐射）→ reload（掉头装填）→ standoff。
 */
export class StrikerDoctrine extends JetDoctrine {
  public readonly id = 'striker';

  private readonly rack = new MissileRack(STRIKER_TUNING);
  private rolled = false;
  private orbitSign = 1;
  private heightOffset = 0;
  private startDelay = 0;
  private idleTime = 0;
  private restTime = 0;
  /** 上一次采样的“装填结束时离玩家多远”估算（米）、距今的时间（秒），以及是否正在缩短 */
  private reloadEndSample = Number.NaN;
  private sampleTime = 0;
  private gaining = false;
  /** 装填时远离航向贴着范围的哪一边（1 / -1；0 = 还没选） */
  private awaySide = 0;

  constructor() {
    super('standoff', 0);
  }

  protected cancelAttack(): void {
    this.rack.cancel();
    this.idleTime = 0;
  }

  public getMissileRequest(): number {
    return this.rack.getRequest();
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.orbitSign = context.rng() < 0.5 ? -1 : 1;
      this.heightOffset = (context.rng() - 0.5) * STRIKER_TUNING.HEIGHT_RANGE;
      this.startDelay =
        STRIKER_TUNING.FIRST_DELAY_MIN +
        context.rng() * (STRIKER_TUNING.FIRST_DELAY_MAX - STRIKER_TUNING.FIRST_DELAY_MIN);
    }
    const dt = context.dt;
    this.startDelay = Math.max(0, this.startDelay - dt);
    this.restTime = Math.max(0, this.restTime - dt);
    this.request.desiredBearing = Number.NaN;

    if (this.phase === 'reload') {
      this.decideReload(context, command);
      return;
    }

    // 锁定已完成、齐射打到一半：这一对照常打完（只受导弹令牌限制），不再看距离与朝向
    const firing = this.rack.isFiring();
    const inRange =
      firing ||
      (context.distance >= STRIKER_TUNING.LOCK_MIN_RANGE &&
        context.distance <= STRIKER_TUNING.LOCK_MAX_RANGE);
    const armed =
      this.rack.isEngaged() || (this.rack.isReady() && this.startDelay <= 0 && this.restTime <= 0);
    const canStart = this.rack.isEngaged() || context.hasToken || this.lockFits(context);
    this.request.wants = armed && inRange && canStart && !context.bossFight;

    if (!context.hasToken || !this.request.wants) {
      // 没有令牌（或条件不再满足）：放弃锁定，回到距离带里盘旋
      this.rack.tick(context, command, false);
      if (context.hasToken) command.releaseToken = true;
      this.idleTime = 0;
      if (this.rack.isReloading()) {
        // 齐射打到一半丢了令牌：这次算打完，照常掉头装填
        this.request.wants = false;
        this.setPhase('reload');
        this.decideReload(context, command);
        return;
      }
      this.setPhase('standoff');
      this.flyStandoff(context, command);
      return;
    }

    // 持令牌：机头对准玩家，等导弹令牌 → 锁定 → 齐射
    command.direction.subVectors(context.playerPosition, context.position);
    command.throttle = STRIKER_TUNING.LOCK_THROTTLE;
    const facing = firing || this.noseToPlayerAngle(context) < STRIKER_TUNING.FACING_ANGLE;
    this.rack.tick(context, command, inRange && facing);
    if (this.rack.isReloading()) {
      // 打完了（或齐射打到一半被打断）：掉头装填
      command.releaseToken = true;
      this.request.wants = false;
      this.idleTime = 0;
      this.setPhase('reload');
      return;
    }
    if (this.rack.isEngaged()) {
      this.idleTime = 0;
      this.setPhase('lock');
      return;
    }
    this.setPhase('standoff');
    this.idleTime += dt;
    if (this.idleTime > STRIKER_TUNING.TOKEN_IDLE_SECONDS) {
      command.releaseToken = true;
      this.request.wants = false;
      this.idleTime = 0;
      this.restTime = STRIKER_TUNING.TOKEN_REST_SECONDS;
    }
  }

  /**
   * 待命：守在玩家正侧方、距离带中线上的站位点（自己所在的那一侧），在随玩家移动的参照系里飞
   * （油门在 0.6×–1.3× 之间取够用的值）：玩家直线飞行或转弯时都跟得住 450–700 米的距离带，不被
   * 甩到身后尾追、也不停在玩家机头前被碾过。玩家把机头对准它追过来时不跟“朝它飞来”的那部分速度，
   * 追得近——它是值得冲上去打的目标。
   */
  private flyStandoff(context: DoctrineContext, command: DoctrineCommand): void {
    this.awaySide = 0;
    const heading = Math.atan2(context.playerForward.x, context.playerForward.z);
    const offNose = wrapAngle(
      Math.atan2(
        context.position.x - context.playerPosition.x,
        context.position.z - context.playerPosition.z
      ) - heading
    );
    if (
      Math.abs(offNose) > STRIKER_TUNING.SIDE_SWITCH_ANGLE &&
      Math.abs(offNose) < Math.PI - STRIKER_TUNING.SIDE_SWITCH_ANGLE
    ) {
      this.orbitSign = offNose > 0 ? 1 : -1;
    }
    const approachYield = this.chaseYield(
      context,
      STRIKER_TUNING.CHASED_NOSE_ANGLE,
      STRIKER_TUNING.PASSING_NOSE_ANGLE,
      STRIKER_TUNING.GUN_LEAD_MAX_RANGE
    );
    this.steerStationMoving(
      context,
      command,
      STRIKER_TUNING.STANDOFF_RADIUS,
      heading + this.orbitSign * STRIKER_TUNING.STATION_OFF_NOSE,
      this.heightOffset,
      DOCTRINE_RULES.MAX_THROTTLE,
      STRIKER_TUNING.STANDOFF_BAND,
      STRIKER_TUNING.STATION_BEARING_BAND,
      STRIKER_TUNING.STATION_RADIAL_SPEED,
      STRIKER_TUNING.STATION_AROUND_SPEED,
      approachYield
    );
  }

  /**
   * 从玩家看本机在 (rx, rz) 处、玩家水平速度 (vx, vz)：装填时远离的航向（世界方位角）——离
   * “背向玩家”最多 AWAY_CONE，在此之内尽量顺着玩家的航向
   */
  private awayHeading(rx: number, rz: number, vx: number, vz: number, holdSide = false): number {
    const tuning = STRIKER_TUNING;
    const away = Math.atan2(rx, rz);
    if (!(Math.hypot(vx, vz) > 1e-3)) return away;
    let near =
      (Math.hypot(rx, rz) - tuning.LOCK_MIN_RANGE) / (tuning.BAND_MIN - tuning.LOCK_MIN_RANGE);
    near = near > 1 ? 1 : near < 0 ? 0 : near;
    const cone = tuning.AWAY_CONE * near;
    const offset = wrapAngle(Math.atan2(vx, vz) - away);
    if (Math.abs(offset) <= cone) return away + offset;
    // 贴着离玩家航向近的那一边；玩家几乎正对着它飞来时沿用上一步的那一边
    let side = offset > 0 ? 1 : offset < 0 ? -1 : this.orbitSign;
    if (holdSide) {
      if (this.awaySide !== 0 && Math.abs(offset) > Math.PI - tuning.AWAY_SIDE_HOLD) {
        side = this.awaySide;
      }
      this.awaySide = side;
    }
    return away + side * cone;
  }

  /**
   * 现在可以开始申请令牌、转向玩家锁定吗：按玩家直线飞行估算锁定完、齐射完时离玩家的距离（要在
   * 距离带里），以及随后掉头装填完时的距离（太远且正在往前赶时先赶上去）
   */
  private lockFits(context: DoctrineContext): boolean {
    const tuning = STRIKER_TUNING;
    const vx = context.playerVelocity.x;
    const vz = context.playerVelocity.z;
    let rx = context.position.x - context.playerPosition.x;
    let rz = context.position.z - context.playerPosition.z;
    const distance = Math.hypot(rx, rz);
    if (!(distance > 1e-3)) return false;
    // 锁定：机头对着玩家、LOCK_THROTTLE 飞
    const lockSpeed = tuning.LOCK_THROTTLE * context.baseSpeed;
    const lockTime = tuning.LOCK_TURN_SECONDS + tuning.LOCK_SECONDS + tuning.SALVO_GAP;
    rx += lockTime * (-lockSpeed * (rx / distance) - vx);
    rz += lockTime * (-lockSpeed * (rz / distance) - vz);
    const lockEnd = Math.hypot(rx, rz);
    // 装填：沿远离航向、RELOAD_THROTTLE 飞
    const heading = this.awayHeading(rx, rz, vx, vz);
    const reloadSpeed = tuning.RELOAD_THROTTLE * context.baseSpeed;
    const reloadEnd = Math.hypot(
      rx + tuning.RELOAD_SECONDS * (reloadSpeed * Math.sin(heading) - vx),
      rz + tuning.RELOAD_SECONDS * (reloadSpeed * Math.cos(heading) - vz)
    );
    // 每隔一小段时间看一次装填终点的估算在不在缩短（正在往前赶）
    this.sampleTime += context.dt;
    if (!Number.isFinite(this.reloadEndSample)) {
      this.reloadEndSample = reloadEnd;
      this.sampleTime = 0;
    } else if (this.sampleTime >= tuning.GAIN_SAMPLE_SECONDS) {
      this.gaining = this.reloadEndSample - reloadEnd > tuning.GAIN_RATE * this.sampleTime;
      this.reloadEndSample = reloadEnd;
      this.sampleTime = 0;
    }
    if (!(lockEnd >= tuning.BAND_MIN) || !(lockEnd <= tuning.BAND_MAX)) return false;
    return !(reloadEnd > tuning.RELOAD_END_MAX && this.gaining);
  }

  /** 装填：掉头背着玩家慢速飞（尽量顺着玩家航向）；够远了就慢速跟着玩家绕圈，装填完回到距离带 */
  private decideReload(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = false;
    this.reloadEndSample = Number.NaN;
    this.gaining = false;
    if (context.hasToken) command.releaseToken = true;
    this.rack.tick(context, command, false);
    if (!this.rack.isReloading()) {
      this.setPhase('standoff');
      this.flyStandoff(context, command);
      return;
    }
    if (context.distance < STRIKER_TUNING.RELOAD_AWAY_DISTANCE) {
      const heading = this.awayHeading(
        context.position.x - context.playerPosition.x,
        context.position.z - context.playerPosition.z,
        context.playerVelocity.x,
        context.playerVelocity.z,
        true
      );
      command.direction.set(Math.sin(heading), 0, Math.cos(heading));
      this.applyAltitude(context, command, context.playerPosition.y + this.heightOffset);
    } else {
      this.steerOrbitMoving(
        context,
        command,
        STRIKER_TUNING.RELOAD_AWAY_DISTANCE,
        this.orbitSign,
        this.heightOffset,
        STRIKER_TUNING.RELOAD_THROTTLE
      );
    }
    command.throttle = STRIKER_TUNING.RELOAD_THROTTLE;
  }
}
