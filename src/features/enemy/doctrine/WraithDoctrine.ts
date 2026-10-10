import { Vector3 } from 'three';
import { BurstGun, JetDoctrine } from './JetDoctrine';
import {
  DOCTRINE_RULES,
  type CloakState,
  type DoctrineCommand,
  type DoctrineContext,
} from './DoctrineTypes';
import { angleBetween, angularDistance, horizontalRight, wrapAngle } from './DoctrineMath';

const DEG = Math.PI / 180;

/** 隐形机条令参数：隐形周期按规格固定，其余为起始值 */
export const WRAITH_TUNING = {
  /** 隐形周期（秒）：淡出 → 最长隐形 → 现形预警 → 至少保持可见 */
  FADE_SECONDS: 0.6,
  /** 至少隐形这么久才现形（秒）：本来就在玩家身后时，也不至于刚淡出就亮眼灯 */
  CLOAK_MIN_SECONDS: 1.5,
  CLOAK_MAX_SECONDS: 5,
  TELL_SECONDS: 0.7,
  VISIBLE_MIN_SECONDS: 4,
  /** 隐形时被击中：立刻现形并僵直这么久（秒） */
  STAGGER_SECONDS: 1,
  /** 隐形时的机体不透明度（规格 12–18%） */
  CLOAK_OPACITY: 0.15,
  /** 生成后第一次隐形前的等待（秒，范围内随机） */
  FIRST_CLOAK_MIN: 1.5,
  FIRST_CLOAK_MAX: 3,
  /** 现形位置：玩家后方四分之一圆（离正后方这个夹角以内）、这个距离以内 */
  REAR_QUARTER: 45 * DEG,
  ATTACK_DISTANCE: 200,
  /**
   * 隐形时飞向的咬尾位：玩家身后这么远（米）。离咬尾位 SLOT_NEAR 米以内时按玩家的速度、
   * 外加每米 SLOT_CLOSE_GAIN 米/秒飞，把剩下的距离也收掉（只配平速度会一直吊在咬尾位外面）
   */
  SLOT_DISTANCE: 150,
  SLOT_NEAR: 60,
  SLOT_CLOSE_GAIN: 0.8,
  /**
   * 进入方位：离玩家正后方 ATTACK_OFFSET（弧度），在开始隐形时自己所在的那一侧。两架同时持
   * 令牌时导演按规格 §2.2 把方位错开 ≥ 60°：各占正后方的一侧，都还在后方四分之一圆里。
   * 指派的方位离自己想要的偏开 SIDE_FLIP_ANGLE 以上（这一侧已被先领到令牌的那架占了）时，
   * 这次持令牌期间换到另一侧一次；咬尾位的方位不超出后方四分之一圆 − REAR_MARGIN
   */
  ATTACK_OFFSET: 44 * DEG,
  SIDE_FLIP_ANGLE: 10 * DEG,
  REAR_MARGIN: 1 * DEG,
  /**
   * 持令牌时，要在咬尾位那一侧、离正后方不少于“咬尾位的偏角 − SLOT_READY_ANGLE”（弧度）才现形：
   * 现形预警的 0.7 秒里机头压向玩家，方位会朝正后方滑十来度，离正后方太近就现形，两架就挤到
   * 一起了（隐形满 5 秒照样现形）
   */
  SLOT_READY_ANGLE: 8 * DEG,
  /** 可见、等待下一次隐形时的侧后方待命位：距离（米）与偏离正后方的角度（弧度） */
  FLANK_DISTANCE: 220,
  FLANK_ANGLE: 60 * DEG,
  /** 五连发：发间隔 / 两轮之间的间隔（秒）；一次现形最多打几轮（规格：一轮） */
  BURST_ROUNDS: 5,
  ROUND_INTERVAL: 0.1,
  BURST_INTERVAL: 1.6,
  MAX_BURSTS: 1,
  /** 开火条件：距离，以及机头与机炮瞄准线的夹角 */
  GUN_RANGE: 260,
  GUN_CONE: 14 * DEG,
  /** 可见时被锁定 / 导弹来袭的急转脱离 */
  BREAK_REROLL_SECONDS: 1.6,
  BREAK_PITCH_SIN: 0.45,
  BREAK_TURN_SCALE: 1.6,
} as const;

const tmpPoint = new Vector3();
const tmpAim = new Vector3();
const tmpToSelf = new Vector3();
const tmpRight = new Vector3();
const tmpBack = new Vector3();

/**
 * WRAITH — 潜行者：隐形摸到玩家身后，现形后打一轮五连发。
 *
 * 隐形周期：可见（至少 4 秒）→ 淡出 0.6 秒 → 隐形（1.5–5 秒，12–18% 不透明度）→ 现形预警
 * 0.7 秒（红色眼灯 + 提示音，淡入）→ 可以开火 → 可见至少 4 秒 → 重复。预警结束之前绝不开火；
 * 隐形时被击中立刻现形并僵直 1 秒，之后要走完一个完整周期才会再开火。Boss 战里不隐形。
 *
 * 阶段：stalk（可见，在侧后方待命）→ fade → cloaked（飞向玩家身后）→ decloak（预警）→
 * attack（可见，持令牌时点射）→ fade …；stagger（被打出隐形）；可见时被锁定 / 导弹来袭
 * 则急转（阶段名不变，不开火）。
 */
export class WraithDoctrine extends JetDoctrine {
  public readonly id = 'wraith';

  private readonly gun = new BurstGun(
    WRAITH_TUNING.BURST_ROUNDS,
    WRAITH_TUNING.ROUND_INTERVAL,
    WRAITH_TUNING.BURST_INTERVAL
  );
  private readonly cloak: CloakState = { opacity: 1, hidden: false, flare: 0 };
  private rolled = false;
  private flankSide = 0;
  /** 这次进攻从正后方的哪一侧进入（1 / -1；0 = 还没选），以及这次持令牌期间是否已经换过边 */
  private attackSide = 0;
  private sideFlipped = false;
  /** 本次完全可见已经持续的时间（秒） */
  private visibleTime = 0;
  /** 再次隐形前至少要可见这么久（秒）：平时是 VISIBLE_MIN_SECONDS，生成后第一次是随机的短等待 */
  private visibleNeeded: number = WRAITH_TUNING.VISIBLE_MIN_SECONDS;
  private breaking = false;
  private breakRollTime = 0;

  constructor() {
    super('stalk', 2);
  }

  public getCloak(): Readonly<CloakState> {
    return this.cloak;
  }

  /** 取消点射并现形（瘫痪、拴绳、重新生成）：瘫痪的隐形机会现形 */
  protected cancelAttack(): void {
    this.gun.cancel();
    this.gun.resetCompletedBursts();
    this.showFully();
    this.visibleTime = 0;
    this.visibleNeeded = WRAITH_TUNING.VISIBLE_MIN_SECONDS;
    this.flankSide = 0;
    this.attackSide = 0;
    this.breaking = false;
  }

  /** 隐形（含淡出 / 现形途中）时被击中：立刻现形并僵直 */
  public notifyHit(): void {
    if (this.phase !== 'fade' && this.phase !== 'cloaked' && this.phase !== 'decloak') return;
    this.gun.cancel();
    this.showFully();
    this.visibleTime = 0;
    this.visibleNeeded = WRAITH_TUNING.VISIBLE_MIN_SECONDS;
    this.request.wants = false;
    this.setPhase('stagger');
  }

  /** 不开火的一步：只让机炮的休息计时走（此时没有进行中的点射） */
  private restGun(context: DoctrineContext): void {
    this.gun.tick(context.dt, context.cadenceScale, false, false);
  }

  private showFully(): void {
    this.cloak.opacity = 1;
    this.cloak.hidden = false;
    this.cloak.flare = 0;
  }

  protected decide(context: DoctrineContext, command: DoctrineCommand): void {
    if (!this.rolled) {
      this.rolled = true;
      this.visibleNeeded =
        WRAITH_TUNING.FIRST_CLOAK_MIN +
        context.rng() * (WRAITH_TUNING.FIRST_CLOAK_MAX - WRAITH_TUNING.FIRST_CLOAK_MIN);
    }
    this.chooseAttackBearing(context);
    // 不在进攻阶段时机炮也照常休息：上一次现形打完的那轮的休息时间不留到下一次现形
    if (this.phase !== 'attack') this.restGun(context);

    switch (this.phase) {
      case 'fade':
        this.decideFade(context, command);
        break;
      case 'cloaked':
        this.decideCloaked(context, command);
        break;
      case 'decloak':
        this.decideDecloak(context, command);
        break;
      case 'attack':
        this.decideAttack(context, command);
        break;
      case 'stagger':
        this.decideStagger(context, command);
        break;
      default:
        this.decideStalk(context, command);
        break;
    }
  }

  /** 玩家后方四分之一圆之内、够近 */
  private isInAttackPosition(context: DoctrineContext): boolean {
    if (context.distance > WRAITH_TUNING.ATTACK_DISTANCE) return false;
    tmpToSelf.subVectors(context.position, context.playerPosition);
    tmpBack.copy(context.playerForward).multiplyScalar(-1);
    return angleBetween(tmpBack, tmpToSelf) < WRAITH_TUNING.REAR_QUARTER;
  }

  /**
   * 想要的进入方位：玩家正后方偏向自己那一侧 ATTACK_OFFSET。持令牌时指派的方位被挤开（这一侧
   * 已有先到的一架）就换到另一侧，每次持令牌最多换一次
   */
  private chooseAttackBearing(context: DoctrineContext): void {
    const tail = Math.atan2(-context.playerForward.x, -context.playerForward.z);
    if (this.attackSide === 0) {
      const own = Math.atan2(
        context.position.x - context.playerPosition.x,
        context.position.z - context.playerPosition.z
      );
      const off = wrapAngle(own - tail);
      this.attackSide = off > 0 ? 1 : off < 0 ? -1 : context.rng() < 0.5 ? -1 : 1;
      this.sideFlipped = false;
    }
    let desired = wrapAngle(tail + this.attackSide * WRAITH_TUNING.ATTACK_OFFSET);
    if (!context.hasToken) {
      this.sideFlipped = false;
    } else if (
      !this.sideFlipped &&
      Number.isFinite(context.attackBearing) &&
      angularDistance(context.attackBearing, desired) > WRAITH_TUNING.SIDE_FLIP_ANGLE
    ) {
      this.sideFlipped = true;
      this.attackSide = -this.attackSide;
      desired = wrapAngle(tail + this.attackSide * WRAITH_TUNING.ATTACK_OFFSET);
    }
    this.request.desiredBearing = desired;
  }

  /**
   * 咬尾位的方位：持令牌时用指派的方位，否则用自己想要的；都限制在后方四分之一圆以内
   */
  private slotBearing(context: DoctrineContext): number {
    const tail = Math.atan2(-context.playerForward.x, -context.playerForward.z);
    const wanted =
      context.hasToken && Number.isFinite(context.attackBearing)
        ? context.attackBearing
        : this.request.desiredBearing;
    const limit = WRAITH_TUNING.REAR_QUARTER - WRAITH_TUNING.REAR_MARGIN;
    let off = Number.isFinite(wanted) ? wrapAngle(wanted - tail) : 0;
    off = off > limit ? limit : off < -limit ? -limit : off;
    return tail + off;
  }

  /** 离正后方至少有咬尾位那么远（差 SLOT_READY_ANGLE 以内也算），且在咬尾位的那一侧 */
  private isOutAtSlotBearing(context: DoctrineContext): boolean {
    const tail = Math.atan2(-context.playerForward.x, -context.playerForward.z);
    const own = Math.atan2(
      context.position.x - context.playerPosition.x,
      context.position.z - context.playerPosition.z
    );
    const slot = wrapAngle(this.slotBearing(context) - tail);
    const side = slot >= 0 ? 1 : -1;
    return side * (wrapAngle(own - tail) - slot) >= -WRAITH_TUNING.SLOT_READY_ANGLE;
  }

  /** 飞向玩家身后、自己进入方位上的咬尾位（带前置量） */
  private steerToSlot(context: DoctrineContext, command: DoctrineCommand): void {
    const bearing = this.slotBearing(context);
    tmpBack.set(Math.sin(bearing), 0, Math.cos(bearing));
    tmpPoint.copy(context.playerPosition).addScaledVector(tmpBack, WRAITH_TUNING.SLOT_DISTANCE);
    const gap = tmpPoint.distanceTo(context.position);
    tmpPoint.addScaledVector(context.playerVelocity, Math.min(1.5, gap / 120));
    this.steerToward(context, command, tmpPoint);
    if (gap > WRAITH_TUNING.SLOT_NEAR || !(context.baseSpeed > 0)) {
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
      return;
    }
    const speed = context.playerVelocity.length() + gap * WRAITH_TUNING.SLOT_CLOSE_GAIN;
    command.throttle = Math.min(
      DOCTRINE_RULES.MAX_THROTTLE,
      Math.max(DOCTRINE_RULES.MIN_THROTTLE, speed / context.baseSpeed)
    );
  }

  /** 可见时被锁定 / 导弹来袭：垂直于视线急转并俯冲 / 爬升；返回 true 表示本步已接管飞行 */
  private flyBreakIfThreatened(context: DoctrineContext, command: DoctrineCommand): boolean {
    if (!this.isThreatened(context)) {
      this.breaking = false;
      return false;
    }
    this.breakRollTime += context.dt;
    if (!this.breaking || this.breakRollTime >= WRAITH_TUNING.BREAK_REROLL_SECONDS) {
      this.breaking = true;
      this.breakRollTime = 0;
      this.beginBreak(context, WRAITH_TUNING.BREAK_PITCH_SIN);
    }
    this.gun.cancel();
    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;
    command.direction.copy(this.breakDirection);
    command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
    command.turnScale = WRAITH_TUNING.BREAK_TURN_SCALE;
    return true;
  }

  /** 可见、不开火：在玩家侧后方待命；可见够久后开始隐形（Boss 战里改为不隐形的咬尾攻击） */
  private decideStalk(context: DoctrineContext, command: DoctrineCommand): void {
    this.showFully();
    this.visibleTime += context.dt;
    const rested = this.visibleTime >= this.visibleNeeded;

    if (context.bossFight) {
      // Boss 战不隐形：歇够了就申请令牌，咬到玩家身后、持令牌才打
      this.request.wants = rested;
      if (this.flyBreakIfThreatened(context, command)) return;
      if (rested) {
        this.steerToSlot(context, command);
        if (context.hasToken && this.isInAttackPosition(context)) this.enterAttack();
      } else {
        this.flyFlank(context, command);
      }
      return;
    }

    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;
    if (rested) {
      // 新的一次进攻：从开始隐形时所在的那一侧进入
      this.attackSide = 0;
      this.chooseAttackBearing(context);
      this.setPhase('fade');
      this.decideFade(context, command);
      return;
    }
    if (this.flyBreakIfThreatened(context, command)) return;
    this.flyFlank(context, command);
  }

  /** 侧后方待命位：待在自己当前所在的一侧，与玩家并排同向飞 */
  private flyFlank(context: DoctrineContext, command: DoctrineCommand): void {
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
    tmpPoint
      .copy(tmpBack)
      .multiplyScalar(Math.cos(WRAITH_TUNING.FLANK_ANGLE))
      .addScaledVector(tmpRight, Math.sin(WRAITH_TUNING.FLANK_ANGLE) * this.flankSide)
      .multiplyScalar(WRAITH_TUNING.FLANK_DISTANCE)
      .add(context.playerPosition);
    const gap = tmpPoint.distanceTo(context.position);
    if (gap > 70) {
      tmpPoint.addScaledVector(context.playerVelocity, Math.min(1.5, gap / 120));
      this.steerToward(context, command, tmpPoint);
      command.throttle = DOCTRINE_RULES.MAX_THROTTLE;
    } else {
      command.direction.copy(context.playerForward);
      this.applyAltitude(context, command, context.playerPosition.y);
      command.throttle = this.throttleToMatch(context);
    }
  }

  /** 淡出 0.6 秒：还看得见、还能被锁定；开始向玩家身后机动 */
  private decideFade(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    const progress = Math.min(1, this.phaseTime / WRAITH_TUNING.FADE_SECONDS);
    this.cloak.opacity = 1 + (WRAITH_TUNING.CLOAK_OPACITY - 1) * progress;
    this.cloak.hidden = false;
    this.cloak.flare = 0;
    this.steerToSlot(context, command);
    if (progress >= 1) {
      this.cloak.hidden = true;
      this.setPhase('cloaked');
    }
  }

  /**
   * 隐形（1.5–5 秒）：飞向玩家身后；持令牌、在后方四分之一圆里且到了咬尾位的方位上，或隐形满
   * 5 秒，就开始现形预警
   */
  private decideCloaked(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    this.cloak.opacity = WRAITH_TUNING.CLOAK_OPACITY;
    this.cloak.hidden = true;
    this.cloak.flare = 0;
    this.steerToSlot(context, command);
    const inPosition =
      this.phaseTime >= WRAITH_TUNING.CLOAK_MIN_SECONDS &&
      context.hasToken &&
      this.isInAttackPosition(context) &&
      this.isOutAtSlotBearing(context);
    if (inPosition || this.phaseTime >= WRAITH_TUNING.CLOAK_MAX_SECONDS) {
      this.cloak.hidden = false;
      command.cue = 'decloak';
      command.cueDuration = WRAITH_TUNING.TELL_SECONDS;
      this.setPhase('decloak');
    }
  }

  /** 现形预警 0.7 秒：淡入 + 红色眼灯；不开火 */
  private decideDecloak(context: DoctrineContext, command: DoctrineCommand): void {
    this.request.wants = true;
    const progress = Math.min(1, this.phaseTime / WRAITH_TUNING.TELL_SECONDS);
    this.cloak.opacity = WRAITH_TUNING.CLOAK_OPACITY + (1 - WRAITH_TUNING.CLOAK_OPACITY) * progress;
    this.cloak.hidden = false;
    // 眼灯：很快亮到最强，随后略微回落
    this.cloak.flare = progress < 0.2 ? progress / 0.2 : 1 - 0.5 * ((progress - 0.2) / 0.8);
    this.gunAimPoint(context, tmpAim);
    this.steerToward(context, command, tmpAim);
    command.throttle = this.throttleToMatch(context);
    if (progress >= 1) this.enterAttack();
  }

  private enterAttack(): void {
    this.showFully();
    this.cloak.flare = 0.5;
    this.visibleTime = 0;
    this.visibleNeeded = WRAITH_TUNING.VISIBLE_MIN_SECONDS;
    this.breaking = false;
    this.gun.resetCompletedBursts();
    this.setPhase('attack');
  }

  /** 现形后：持令牌时把机头压到机炮瞄准点上点射；可见满 4 秒后交还令牌、再次隐形 */
  private decideAttack(context: DoctrineContext, command: DoctrineCommand): void {
    this.cloak.opacity = 1;
    this.cloak.hidden = false;
    this.cloak.flare = Math.max(0, 0.5 - this.phaseTime * 1.5);
    this.visibleTime += context.dt;
    const spent = this.gun.getCompletedBursts() >= WRAITH_TUNING.MAX_BURSTS;
    this.request.wants = !spent;

    if (this.visibleTime >= WRAITH_TUNING.VISIBLE_MIN_SECONDS && !this.gun.isBursting()) {
      if (context.hasToken) command.releaseToken = true;
      this.request.wants = false;
      this.flankSide = 0;
      if (context.bossFight) {
        // Boss 战不隐形：回到待命位，歇够了再来
        this.visibleTime = 0;
        this.setPhase('stalk');
        this.flyFlank(context, command);
      } else {
        this.attackSide = 0;
        this.chooseAttackBearing(context);
        this.setPhase('fade');
        this.decideFade(context, command);
      }
      return;
    }
    if (this.flyBreakIfThreatened(context, command)) return;

    if (spent || !context.hasToken) {
      // 打完了 / 没领到令牌：拉到侧后方，等可见时间走完
      if (spent && context.hasToken) command.releaseToken = true;
      this.gun.cancel();
      this.restGun(context);
      this.flyFlank(context, command);
      return;
    }

    this.gunAimPoint(context, tmpAim);
    this.steerToward(context, command, tmpAim);
    command.throttle =
      context.distance < 110 ? DOCTRINE_RULES.MIN_THROTTLE : this.throttleToMatch(context);
    tmpPoint.subVectors(tmpAim, context.position);
    const noseAngle = angleBetween(context.forward, tmpPoint);
    const inRange = context.distance < WRAITH_TUNING.GUN_RANGE;
    const rounds = this.gun.tick(
      context.dt,
      context.cadenceScale,
      inRange && noseAngle < WRAITH_TUNING.GUN_CONE,
      inRange && noseAngle < WRAITH_TUNING.GUN_CONE * 2
    );
    for (let i = 0; i < rounds; i++) this.fireGunRound(context, command);
  }

  /** 被打出隐形：僵直 1 秒（保持航向、不机动、不开火），之后回到可见待命 */
  private decideStagger(context: DoctrineContext, command: DoctrineCommand): void {
    this.showFully();
    this.request.wants = false;
    if (context.hasToken) command.releaseToken = true;
    command.direction.copy(context.forward);
    command.throttle = DOCTRINE_RULES.MIN_THROTTLE;
    this.visibleTime += context.dt;
    if (this.phaseTime >= WRAITH_TUNING.STAGGER_SECONDS) {
      this.flankSide = 0;
      this.setPhase('stalk');
    }
  }
}
