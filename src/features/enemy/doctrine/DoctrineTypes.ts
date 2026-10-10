import type { Vector3 } from 'three';
import type { EnemyWeaponKind } from '../EnemyWeapons';

/**
 * 敌机条令（doctrine）：每种机型一套“往哪飞、飞多快、何时开火”的决策。
 *
 * EnemyAI 负责运动积分、地形避让、血量、EMP 瘫痪、尾迹与开火的收发；条令只读一份战场快照
 * （DoctrineContext），把决定写进 DoctrineCommand。条令不接触渲染器、不读系统时钟，
 * 随机数只从 context.rng 取，可以在测试里脱离场景单独推进。
 */

/** 所有机型共用的规则常量 */
export const DOCTRINE_RULES = {
  /** 油门范围：机型基础速度的倍数 */
  MIN_THROTTLE: 0.6,
  MAX_THROTTLE: 1.3,
  /** 拴绳：离玩家超过这么远就直线飞回战场（米） */
  LEASH_DISTANCE: 900,
  /** 拴绳回落到这个距离以内才交还条令（防止在边界来回切换） */
  LEASH_RESUME_DISTANCE: 850,
  /** 招牌攻击的最短预警（秒）：光束 / 锁定告警 / 蓄力 / 现形 */
  MIN_TELL_SECONDS: 0.7,
  /** 敌机主动交还令牌后的冷却（秒）：期间不会再领到，让别的敌机轮上 */
  TOKEN_RELEASE_COOLDOWN: 1.5,
} as const;

/** 条令每步读到的战场快照。EnemyAI 逐步填写并复用同一个对象：不要保存其中向量的引用 */
export interface DoctrineContext {
  /** 步长（秒） */
  dt: number;

  // ---- 本机 ----
  position: Vector3;
  /** 当前飞行方向（单位向量） */
  forward: Vector3;
  /** 当前速率（米/秒） */
  speed: number;
  /** 机型基础速度（米/秒）；油门是它的倍数 */
  baseSpeed: number;
  /** 机型转向角速度（弧度/秒） */
  turnRate: number;
  /** 命中精度 0..1（越高散布越小） */
  accuracy: number;
  /** 机炮提前量 0..1（关卡曲线给出） */
  aimLead: number;
  /** 开火节奏倍率（1 = 条令表里的间隔；> 1 更慢） */
  cadenceScale: number;

  // ---- 玩家 ----
  /** 没有可追踪的玩家位置时为 false：其余玩家字段无效 */
  hasPlayer: boolean;
  playerPosition: Vector3;
  /** 玩家速度估计（米/秒）；未知时为零向量 */
  playerVelocity: Vector3;
  /** 玩家机头方向（单位向量） */
  playerForward: Vector3;
  /** 本机到玩家的距离（米） */
  distance: number;

  // ---- 玩家对本机的威胁 ----
  /** 玩家导引头已对本机完成锁定（LOCK） */
  lockedOn: boolean;
  /** 有玩家导弹正飞向本机 */
  missileInbound: boolean;

  // ---- 导演的指令 ----
  /** 持有攻击令牌：只有持令牌时才可以对玩家开火 */
  hasToken: boolean;
  /**
   * 指派的进入方位（弧度，atan2(x, z)：从玩家指向攻击者应在的方向，世界坐标）；
   * 没有令牌时为 NaN。
   */
  attackBearing: number;

  /** 当前关卡（1..10） */
  level: number;
  /** Boss 战：小兵不发射导弹、不隐形 */
  bossFight: boolean;
  /** 0..1 的随机数来源（可注入种子） */
  rng: () => number;
}

/** 一次射击请求（方向已含提前量与散布） */
export interface ShotRequest {
  weapon: EnemyWeaponKind;
  /** 单位向量（世界坐标） */
  direction: Vector3;
  /** 伤害 = 机型 damage × damageScale */
  damageScale: number;
  /** 同一次齐射里的后续弹：不单独播放开火音与枪口焰 */
  quiet: boolean;
}

/** 条令触发的一次性提示（音效等） */
export type DoctrineCue = 'lance-charge';

/** 条令每步的输出。EnemyAI 持有并复用；每步开始时已被重置 */
export interface DoctrineCommand {
  /** 期望飞行方向（不必归一化；零向量 = 保持当前方向） */
  direction: Vector3;
  /** 油门（基础速度倍数），EnemyAI 钳制到 0.6..1.3 */
  throttle: number;
  /** 转向角速度倍数（1 = 机型数值） */
  turnScale: number;
  /** 本步的射击请求：前 shotCount 个有效 */
  shots: ShotRequest[];
  shotCount: number;
  /** 本次攻击航路结束：交还令牌 */
  releaseToken: boolean;
  /** 本步触发的提示；没有为 null */
  cue: DoctrineCue | null;
  /** 提示时长（秒），如蓄力时长 */
  cueDuration: number;
}

/** 需要画出来的预警（狙击机的瞄准光束） */
export interface DoctrineTell {
  kind: 'lance-beam';
  /** 光束指向的世界坐标（冻结后不再变化） */
  aimPoint: Vector3;
  /** 蓄力进度 0..1 */
  progress: number;
  /** 光束已冻结：长枪弹将沿这条线飞 */
  frozen: boolean;
}

/** 条令向导演提出的令牌请求（对象由条令持有并复用） */
export interface AttackRequest {
  /** 想要开始攻击航路 */
  wants: boolean;
  /** 期望的进入方位（世界坐标弧度）；NaN = 就用当前所在的方位 */
  desiredBearing: number;
  /**
   * 方位分配的先后：数值小的先定，灵活的机型绕开它们。0 = 原地开火的机型（狙击机 / 重型机）：
   * 指派方位首选它当前所在的方位，且导演只在这个方位与已有持令牌者错开足够远时才发令牌。
   */
  bearingPriority: number;
  /** 两架同机型同时持令牌时从玩家两侧对向进入（侦察机双机） */
  pairsOpposite: boolean;
}

export interface IEnemyDoctrine {
  /** 条令名（'scout' / 'fighter' / ...） */
  readonly id: string;
  /** 当前阶段的简短名字（调试 / 开发钩子） */
  getPhase(): string;
  /** 每步决策：读 context，写 command */
  update(context: DoctrineContext, command: DoctrineCommand): void;
  /** 被 EMP 瘫痪 / 重新生成：取消蓄力与点射，回到初始阶段 */
  interrupt(): void;
  /** 令牌请求（上一步 update 之后的状态） */
  getAttackRequest(): Readonly<AttackRequest>;
  /** 当前需要显示的预警；没有为 null */
  getTell(): Readonly<DoctrineTell> | null;
}

/** 导演写在每架敌机上的指令与记账（对象由 EnemyAI 持有，导演读写） */
export interface AttackOrders {
  hasToken: boolean;
  /** 指派的进入方位（弧度）；没有令牌时为 NaN */
  bearing: number;
  /** 交还令牌后的冷却（秒）：期间不会再领到令牌，让别的敌机轮上 */
  cooldown: number;
  /** 已经等了多久（秒）：等得久的先领 */
  waiting: number;
  /** 领到令牌的先后序号 */
  sequence: number;
}

export function createAttackOrders(): AttackOrders {
  return { hasToken: false, bearing: Number.NaN, cooldown: 0, waiting: 0, sequence: 0 };
}

/** 交还 / 收回令牌：cooldown 秒内不会再领到（重新生成时传 0） */
export function releaseAttackOrders(orders: AttackOrders, cooldown: number): void {
  orders.hasToken = false;
  orders.bearing = Number.NaN;
  orders.waiting = 0;
  orders.cooldown = cooldown > 0 ? cooldown : 0;
}
