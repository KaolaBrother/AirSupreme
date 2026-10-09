import * as THREE from 'three';
import type { InputState } from '@/core/Input/InputHandler';
import { GAME_CONSTANTS } from '@/config';

/**
 * 开发构建专用：平衡测量用的脚本飞行员（只由 src/core/dev/BalanceHarness.ts 驱动）。
 *
 * 模拟“称职但普通”的玩家：保持油门，转向最近的威胁，大致瞄准后用机炮射击，
 * 目标进入锁定圈就按住导弹键，按当前特殊武器的模式扣扳机，导弹来袭时投放热焰弹，
 * 前瞻地形防撞。'passive' 模式不做任何输入（测“放手不管能活多久”）。
 *
 * 输入直接写入 InputHandler 每步复用的 InputState（在 PlayerController.update 之前），
 * 机炮 / 导弹 / 特殊武器随后在同一模拟步读取；热焰弹由调用方按返回值派发 G 键。
 */

export type PilotKind = 'scripted' | 'passive';
export type PilotTargetKind = 'jet' | 'unit-air' | 'unit-ground' | 'unit-sea' | 'boss';
export type PilotSpecialMode = 'salvo' | 'beam' | 'charge' | 'pulse';

/** 一个可攻击的敌方目标（每步由测量框架收集） */
export interface PilotTarget {
  object: THREE.Object3D;
  /** 世界坐标瞄准点 */
  position: THREE.Vector3;
  /** 世界速度估计（米/秒） */
  velocity: THREE.Vector3;
  kind: PilotTargetKind;
  /** 命中半径（米） */
  radius: number;
  /** 距离加权：越小越优先（Boss 弱点 < 1） */
  weight: number;
}

export interface PilotSpecialState {
  mode: PilotSpecialMode | null;
  ready: boolean;
  /** 0..1 蓄力进度（railgun） */
  charge: number;
  overheated: boolean;
  /** 射程 / EMP 半径（米） */
  range: number;
}

export interface PilotWorld {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  speed: number;
  targets: readonly PilotTarget[];
  /** 坠毁判定地表高度（世界 Y） */
  groundY: (x: number, z: number) => number;
  /** 最近一枚追踪玩家的导弹距离（无则 Infinity） */
  incomingMissileDistance: number;
  special: PilotSpecialState;
  flareCharges: number;
  /** 距上次受到伤害的秒数（用于受击后的规避机动） */
  secondsSinceHit: number;
  /** 距上次复活的秒数：复活后先沿复活航向飞离（复活点可能紧贴岩壁 / 立柱） */
  secondsSinceRespawn: number;
  /** Boss 机体（不是部件）的速度估计（米/秒），无 Boss 时为 0；转动的炮塔 / 眼睛不算“高速 Boss” */
  bossSpeed: number;
}

export interface PilotDecision {
  /** 本步请求投放热焰弹（调用方派发 G 键） */
  deployFlare: boolean;
}

/** 飞行员行为统计（秒 / 次），测量框架按波次累计 */
export interface PilotStats {
  targetSeconds: Record<PilotTargetKind | 'none', number>;
  fireSeconds: number;
  missileSeconds: number;
  specialPresses: number;
  terrainSeconds: number;
  extendSeconds: number;
  /** 目标在机炮射程内的时间 / 机头对准（开火锥内，不论距离）的时间 / 蛇行时间 */
  inRangeSeconds: number;
  onTargetSeconds: number;
  jinkSeconds: number;
}

export function createPilotStats(): PilotStats {
  return {
    targetSeconds: { jet: 0, 'unit-air': 0, 'unit-ground': 0, 'unit-sea': 0, boss: 0, none: 0 },
    fireSeconds: 0,
    missileSeconds: 0,
    specialPresses: 0,
    terrainSeconds: 0,
    extendSeconds: 0,
    inRangeSeconds: 0,
    onTargetSeconds: 0,
    jinkSeconds: 0,
  };
}

/** 机炮弹速与射程（玩家子弹不继承载机速度） */
const BULLET_SPEED = GAME_CONSTANTS.PROJECTILE.SPEED;
const GUN_RANGE = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE * 0.9;
/** 锁定距离（LockOnIndicator：最大飞行距离的一半）留一点余量 */
const MISSILE_HOLD_RANGE = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE / 2 - 100;
/** 机炮开火锥（度）：在命中半径对应的张角之外再放宽一点，模拟“大致瞄准就按住开火” */
const FIRE_CONE_SLACK_DEG = 2.5;
const FIRE_CONE_MIN_DEG = 4;
/** 导弹：目标在机头 10° 内才按住锁定 */
const MISSILE_CONE_DEG = 10;
/** 键盘转向速率（弧度/秒），小误差时按“点按”占空比微调（玩家同样靠点按细调准星） */
const YAW_RATE = GAME_CONSTANTS.PLAYER.YAW_SPEED;
const PITCH_RATE = GAME_CONSTANTS.PLAYER.PITCH_SPEED;
const ROLL_DEADBAND = 0.08;
/** 复活后保持复活航向、缓慢爬升的时间（秒）：先飞离复活点附近的岩壁 / 立柱再找目标 */
const RESPAWN_HOLD_SECONDS = 1.8;
/** 受击后的规避蛇行：幅度（弧度）、周期（秒）、持续（秒）；近距离射击窗口内不蛇行 */
const JINK_AMPLITUDE = 0.22;
const JINK_PERIOD = 2.6;
const JINK_AFTER_HIT = 2;
const JINK_MIN_TARGET_DISTANCE = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;
/** 地形：前瞻时间点（秒）与需要的离地余量（米） */
const TERRAIN_LOOKAHEAD_SECONDS = 2.6;
/** 前瞻采样间距（米）：细立柱（城堡塔楼、天梯支柱）只有十几米粗，采样必须比它们密 */
const TERRAIN_PROBE_SPACING = 12;
const TERRAIN_MARGIN = 14;
/** 地形告警时试探的相对航向（弧度）与距离（米） */
const ESCAPE_OFFSETS: readonly number[] = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4];
const ESCAPE_PROBE_DISTANCES: readonly number[] = Array.from({ length: 16 }, (_, i) => 15 + i * 14);
/** 对地攻击时允许的最低离地高度（米）与最大俯冲角（sin） */
const ATTACK_FLOOR_AGL = 22;
const MAX_DIVE_SIN = 0.62;
/** 对地攻击：最大可射击俯角（弧度）、拉开距离后再回头的最小水平距离（米）与进入高度 */
const SURFACE_MAX_DEPRESSION = 0.55;
const SURFACE_EXTEND_MIN = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE * 0.85;
const SURFACE_SETUP_AGL = 65;
/**
 * Boss：贴得太近（钻进机体 / 部件间来回打转）时先拉开到再进入距离，再回头射击；
 * 拉开有时限——绕玩家盘旋的高速 Boss（幻影）会一直跟在再进入距离以内，边界 / 地形折返也可能
 * 让拉开永远到不了再进入距离（之前整场卡在“拉开”）。
 */
const BOSS_MIN_RANGE = 100;
const BOSS_REENGAGE_RANGE = 290;
const BOSS_EXTEND_MAX = 8;
const AGILE_BOSS_EXTEND_MAX = 4;
/** 高速 Boss（米/秒）：与敌机一样按狗斗收油门，转进它的盘旋圈（盘旋半径约 260 米） */
const AGILE_BOSS_SPEED = 25;
const AGILE_BOSS_TURN_RANGE = 340;
/**
 * 狗斗：敌机贴近（< JET_TOO_CLOSE 米）且机头指不过去（> JET_OFF_AXIS）时先直线拉开，
 * 拉到 JET_REENGAGE 米或 JET_EXTEND_MAX 秒后回头对头；近距离转弯缠斗时收油门缩小转弯半径。
 */
const JET_TOO_CLOSE = 70;
const JET_OFF_AXIS = 0.9;
const JET_REENGAGE = 240;
const JET_EXTEND_MAX = 3.5;
const TURN_FIGHT_RANGE = 220;
/** 选目标时机头夹角的权重：正后方的目标按 1 + ANGLE_WEIGHT 倍距离计 */
const ANGLE_WEIGHT = 0.8;
/** 巡航高度（无目标时，离地米） */
const CRUISE_AGL = 120;
/** 战场软边界之前开始折返（米） */
const BOUNDARY_TURN_RADIUS = GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS - 150;
const CEILING_Y = GAME_CONSTANTS.WORLD.SOFT_CEILING - 60;
/** 导弹来袭多近时投热焰弹（米）与两次投放的最小间隔（秒） */
const FLARE_TRIGGER_DISTANCE = 260;
const FLARE_INTERVAL = 1.2;
/** 换目标：新目标需近 30% 以上才切换，且至少每 0.4 秒重新评估一次 */
const RETARGET_INTERVAL = 0.4;
const RETARGET_HYSTERESIS = 0.7;

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpLocal = new THREE.Vector3();
const tmpAim = new THREE.Vector3();
const tmpToTarget = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();
const tmpInverse = new THREE.Quaternion();

function clearInput(input: InputState): void {
  input.pitchUp = false;
  input.pitchDown = false;
  input.yawLeft = false;
  input.yawRight = false;
  input.rollLeft = false;
  input.rollRight = false;
  input.fire = false;
  input.missile = false;
  input.throttle = false;
  input.special = false;
}

/** 把单位方向的竖直分量抬到至少 sinClimb（水平分量按比例缩放，保持航向） */
function setMinimumClimb(direction: THREE.Vector3, sinClimb: number): void {
  const target = THREE.MathUtils.clamp(sinClimb, -0.95, 0.95);
  if (direction.y >= target) return;
  const horizontal = Math.hypot(direction.x, direction.z);
  const scale = horizontal > 1e-6 ? Math.sqrt(1 - target * target) / horizontal : 0;
  direction.set(direction.x * scale, target, direction.z * scale);
  if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0);
  direction.normalize();
}

/** 两向量夹角（弧度），零向量视为 π */
function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  const denominator = a.length() * b.length();
  if (denominator < 1e-6) return Math.PI;
  return Math.acos(THREE.MathUtils.clamp(a.dot(b) / denominator, -1, 1));
}

/**
 * 一阶提前量：解 |r + v·t| = s·t 的最小正根，返回瞄准点（写入 out）。
 * 无解（目标比子弹快且背离）时直接瞄准目标当前位置。
 */
export function computeLeadPoint(
  shooter: THREE.Vector3,
  target: THREE.Vector3,
  targetVelocity: THREE.Vector3,
  projectileSpeed: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const rx = target.x - shooter.x;
  const ry = target.y - shooter.y;
  const rz = target.z - shooter.z;
  const a = targetVelocity.lengthSq() - projectileSpeed * projectileSpeed;
  const b = 2 * (rx * targetVelocity.x + ry * targetVelocity.y + rz * targetVelocity.z);
  const c = rx * rx + ry * ry + rz * rz;
  let t = -1;
  if (Math.abs(a) < 1e-6) {
    t = b !== 0 ? -c / b : -1;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);
      const candidates = [t1, t2].filter((value) => value > 0);
      t = candidates.length > 0 ? Math.min(...candidates) : -1;
    }
  }
  if (!(t > 0) || t > 8) {
    return out.copy(target);
  }
  return out.copy(target).addScaledVector(targetVelocity, t);
}

export class ScriptedPilot {
  private targetObject: THREE.Object3D | null = null;
  private retargetTimer = 0;
  private flareTimer = 0;
  private specialPressed = false;
  private chargeHeld = false;
  /** 对地攻击：拉开距离中（掠过目标后先飞远再回头） */
  private extending = false;
  private extendTimer = 0;
  private wasSpecial = false;
  /** checkTerrain 的附带结果：越过前方地形所需的最小爬升（sin）、是否迎面岩壁 */
  private terrainRequiredSlope = -1;
  private terrainWall = false;
  /** 点按调制的累积误差（步数），按方向分别累计 */
  /** 最近一步的瞄准诊断（测量框架的 trace 采样用） */
  public lastAim = { distance: 0, aimDeg: 0, coneDeg: 0, kind: 'none' as PilotTargetKind | 'none' };
  private yawAccumulator = 0;
  private pitchAccumulator = 0;
  private clock = 0;
  private stats: PilotStats = createPilotStats();
  /** 慢变的瞄准误差（弧度，Ornstein-Uhlenbeck 过程）：普通玩家不会一直完美跟踪 */
  private aimErrorYaw = 0;
  private aimErrorPitch = 0;
  private readonly aimErrorScale: number;
  private readonly random: () => number;

  constructor(
    private readonly kind: PilotKind,
    options: { aimErrorDeg?: number; random?: () => number } = {}
  ) {
    this.random = options.random ?? Math.random;
    this.aimErrorScale = THREE.MathUtils.degToRad(options.aimErrorDeg ?? 1.2);
  }

  public getKind(): PilotKind {
    return this.kind;
  }

  /** 取出并清零统计 */
  public takeStats(): PilotStats {
    const stats = this.stats;
    this.stats = createPilotStats();
    return stats;
  }

  public reset(): void {
    this.extending = false;
    this.yawAccumulator = 0;
    this.pitchAccumulator = 0;
    this.targetObject = null;
    this.retargetTimer = 0;
    this.flareTimer = 0;
    this.specialPressed = false;
    this.chargeHeld = false;
    this.aimErrorYaw = 0;
    this.aimErrorPitch = 0;
  }

  /** 每个模拟步调用一次：写入 input，返回一次性动作 */
  public decide(deltaTime: number, world: PilotWorld, input: InputState): PilotDecision {
    clearInput(input);
    const decision: PilotDecision = { deployFlare: false };
    if (this.kind === 'passive') {
      return decision;
    }

    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 1 / 45;
    this.flareTimer = Math.max(0, this.flareTimer - dt);
    this.updateAimError(dt);

    const position = world.position;
    const forward = tmpForward.set(0, 0, -1).applyQuaternion(world.quaternion);
    const right = tmpRight.set(1, 0, 0).applyQuaternion(world.quaternion);
    const up = tmpUp.set(0, 1, 0).applyQuaternion(world.quaternion);

    const target = this.selectTarget(dt, world);
    const groundHere = world.groundY(position.x, position.z);
    const agl = position.y - (Number.isFinite(groundHere) ? groundHere : -1e6);

    // ── 期望方向：目标提前量 / 巡航 ──
    let distance = Infinity;
    const attackingSurface =
      target !== null && (target.kind === 'unit-ground' || target.kind === 'unit-sea');
    const agileBoss =
      target !== null && target.kind === 'boss' && world.bossSpeed > AGILE_BOSS_SPEED;
    this.stats.targetSeconds[target ? target.kind : 'none'] += dt;
    if (target) {
      computeLeadPoint(position, target.position, target.velocity, BULLET_SPEED, tmpAim);
      tmpDesired.subVectors(tmpAim, position);
      distance = tmpDesired.length();
      if (distance > 1e-3) tmpDesired.multiplyScalar(1 / distance);
      this.applyAimError(tmpDesired);
      if (attackingSurface) {
        this.planSurfaceAttack(position, target.position, agl, forward, tmpDesired);
      } else if (target.kind === 'boss') {
        this.planStandoff(dt, position, target.position, agileBoss, forward, tmpDesired);
      } else {
        this.planDogfight(dt, position, target.position, forward, tmpDesired);
      }
    } else {
      this.extending = false;
      this.cruiseDirection(world, agl, tmpDesired);
    }
    if (world.secondsSinceRespawn < RESPAWN_HOLD_SECONDS) {
      tmpDesired.set(forward.x, 0, forward.z);
      if (tmpDesired.lengthSq() < 1e-6) tmpDesired.set(0, 0, -1);
      tmpDesired.normalize();
      tmpDesired.y = 0.2;
      tmpDesired.normalize();
    }
    if (this.extending) this.stats.extendSeconds += dt;
    this.clock += dt;
    if (
      world.secondsSinceHit < JINK_AFTER_HIT &&
      (distance > JINK_MIN_TARGET_DISTANCE || this.extending)
    ) {
      this.applyJink(tmpDesired);
      this.stats.jinkSeconds += dt;
    }

    // ── 安全修正：俯冲限制、地形前瞻、边界、顶界 ──
    if (tmpDesired.y < -MAX_DIVE_SIN) {
      tmpDesired.y = -MAX_DIVE_SIN;
      tmpDesired.normalize();
    }
    if (agl < ATTACK_FLOOR_AGL + 18 && tmpDesired.y < 0) {
      // 低空：俯冲角随离地高度收窄，贴近下限时改平
      const allowance = Math.max(0, (agl - ATTACK_FLOOR_AGL) / 90);
      tmpDesired.y = Math.max(tmpDesired.y, -allowance);
      tmpDesired.normalize();
    }
    const terrainAlert = this.checkTerrain(world, forward);
    if (terrainAlert > 0) {
      this.stats.terrainSeconds += dt;
      if (this.terrainWall) {
        // 迎面岩壁 / 立柱（爬不过去，或越过它会顶到软顶界）：只转向不猛拉，转弯半径最小
        this.findEscapeHeading(world, forward, tmpDesired);
        tmpDesired.y = 0.2;
        tmpDesired.normalize();
      } else if (terrainAlert >= 2) {
        // 紧急：在扇面里找净空最大的航向并猛拉
        this.findEscapeHeading(world, forward, tmpDesired);
        tmpDesired.y = 2.5;
        tmpDesired.normalize();
      } else {
        // 一般告警：保持朝向目标，只把爬升角抬到越过前方地形所需的最小值（扫射时不至于整段放弃）
        setMinimumClimb(tmpDesired, this.terrainRequiredSlope + 0.04);
      }
    }
    const radial = Math.hypot(position.x, position.z);
    if (radial > BOUNDARY_TURN_RADIUS && terrainAlert === 0) {
      const weight = Math.min(1, (radial - BOUNDARY_TURN_RADIUS) / 250);
      tmpCenter.set(-position.x, 0, -position.z).normalize();
      tmpDesired
        .multiplyScalar(1 - weight)
        .addScaledVector(tmpCenter, weight)
        .normalize();
    }
    if (position.y > CEILING_Y && tmpDesired.y > -0.15) {
      tmpDesired.y = -0.15;
      tmpDesired.normalize();
    }

    this.steer(dt, world.quaternion, right, up, tmpDesired, input);
    // 油门：平时满油门；近距离缠斗（目标不在机头前方）时收油门缩小转弯半径
    input.throttle = !(
      target &&
      (target.kind === 'jet' || target.kind === 'unit-air' || agileBoss) &&
      !this.extending &&
      distance < (agileBoss ? AGILE_BOSS_TURN_RANGE : TURN_FIGHT_RANGE) &&
      angleBetween(forward, tmpToTarget.subVectors(target.position, position)) > 0.6
    );

    // ── 武器 ──
    if (target && terrainAlert < 2) {
      tmpToTarget.subVectors(tmpAim, position);
      const aimAngle = angleBetween(forward, tmpToTarget);
      const rawAngle = angleBetween(forward, tmpToTarget.subVectors(target.position, position));
      const coneDeg = Math.max(
        FIRE_CONE_MIN_DEG,
        THREE.MathUtils.radToDeg(Math.atan2(target.radius, Math.max(1, distance))) +
          FIRE_CONE_SLACK_DEG
      );
      const surfaceSafe = !attackingSurface || agl > ATTACK_FLOOR_AGL - 5;
      const onTarget = aimAngle < THREE.MathUtils.degToRad(coneDeg);
      this.lastAim.distance = distance;
      this.lastAim.aimDeg = THREE.MathUtils.radToDeg(aimAngle);
      this.lastAim.coneDeg = coneDeg;
      this.lastAim.kind = target.kind;
      if (distance < GUN_RANGE) this.stats.inRangeSeconds += dt;
      if (onTarget) this.stats.onTargetSeconds += dt;
      if (surfaceSafe && distance < GUN_RANGE && onTarget) {
        input.fire = true;
        this.stats.fireSeconds += dt;
      }
      const targetDistance = position.distanceTo(target.position);
      if (
        targetDistance < MISSILE_HOLD_RANGE &&
        rawAngle < THREE.MathUtils.degToRad(MISSILE_CONE_DEG)
      ) {
        input.missile = true;
        this.stats.missileSeconds += dt;
      }
      this.useSpecial(world.special, targetDistance, rawAngle, world, input);
      if (input.special && !this.wasSpecial) this.stats.specialPresses++;
    } else {
      this.lastAim.kind = target ? target.kind : 'none';
      this.lastAim.distance = distance;
      this.releaseSpecial(world.special, input);
    }

    this.wasSpecial = input.special;

    // ── 热焰弹 ──
    if (
      world.incomingMissileDistance < FLARE_TRIGGER_DISTANCE &&
      world.flareCharges > 0 &&
      this.flareTimer <= 0
    ) {
      decision.deployFlare = true;
      this.flareTimer = FLARE_INTERVAL;
    }
    return decision;
  }

  // ───────────────────────────── 目标 ─────────────────────────────

  private selectTarget(dt: number, world: PilotWorld): PilotTarget | null {
    const position = world.position;
    // 当前目标仍在列表中则刷新其数据
    let current: PilotTarget | null = null;
    if (this.targetObject) {
      for (const candidate of world.targets) {
        if (candidate.object === this.targetObject) {
          current = candidate;
          break;
        }
      }
    }
    this.retargetTimer -= dt;
    if (current && this.retargetTimer > 0) {
      return current;
    }
    this.retargetTimer = RETARGET_INTERVAL;

    const forward = tmpForward.set(0, 0, -1).applyQuaternion(world.quaternion);
    const score = (candidate: PilotTarget): number => {
      tmpToTarget.subVectors(candidate.position, position);
      const distance = tmpToTarget.length();
      const angle = angleBetween(forward, tmpToTarget);
      return distance * candidate.weight * (1 + (ANGLE_WEIGHT * angle) / Math.PI);
    };
    let best: PilotTarget | null = null;
    let bestScore = Infinity;
    for (const candidate of world.targets) {
      const candidateScore = score(candidate);
      if (candidateScore < bestScore) {
        bestScore = candidateScore;
        best = candidate;
      }
    }
    if (current && best && best !== current) {
      if (bestScore > score(current) * RETARGET_HYSTERESIS) {
        best = current;
      }
    }
    this.targetObject = best?.object ?? null;
    return best;
  }

  /**
   * 对地 / 对海攻击几何：俯角过大（目标在机腹下方）时先水平拉开到能以缓俯冲进入的距离，
   * 同时爬到进入高度，再回头俯冲射击；out 已是指向提前量瞄准点的方向，必要时被改写。
   */
  private planSurfaceAttack(
    position: THREE.Vector3,
    target: THREE.Vector3,
    agl: number,
    forward: THREE.Vector3,
    out: THREE.Vector3
  ): void {
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const horizontal = Math.hypot(dx, dz);
    const height = position.y - target.y;
    const depression = Math.atan2(height, Math.max(1, horizontal));
    const extendTo = Math.max(SURFACE_EXTEND_MIN, height / Math.tan(0.18));
    if (this.extending) {
      if (horizontal > extendTo) {
        this.extending = false;
      }
    } else if (depression > SURFACE_MAX_DEPRESSION && horizontal < extendTo) {
      this.extending = true;
    }
    if (!this.extending) return;
    // 拉开：沿当前水平航向（若正朝目标则背向目标）飞，高度回到进入高度
    out.set(forward.x, 0, forward.z);
    if (out.lengthSq() < 1e-6 || out.x * dx + out.z * dz > 0) {
      out.set(-dx, 0, -dz);
    }
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
    out.y = THREE.MathUtils.clamp((SURFACE_SETUP_AGL - agl) / 120, -0.2, 0.45);
    out.normalize();
  }

  /** Boss 战的进出：近于 BOSS_MIN_RANGE 时背向目标拉开（高度向目标靠拢），远于再进入距离后回头 */
  private planStandoff(
    dt: number,
    position: THREE.Vector3,
    target: THREE.Vector3,
    agile: boolean,
    forward: THREE.Vector3,
    out: THREE.Vector3
  ): void {
    const distance = position.distanceTo(target);
    if (this.extending) {
      this.extendTimer += dt;
      const limit = agile ? AGILE_BOSS_EXTEND_MAX : BOSS_EXTEND_MAX;
      if (distance > BOSS_REENGAGE_RANGE || this.extendTimer > limit) {
        this.extending = false;
      }
    } else if (distance < BOSS_MIN_RANGE) {
      this.extending = true;
      this.extendTimer = 0;
    }
    if (!this.extending) return;
    const awayX = position.x - target.x;
    const awayZ = position.z - target.z;
    out.set(forward.x, 0, forward.z);
    if (out.lengthSq() < 1e-6 || out.x * awayX + out.z * awayZ < 0) {
      out.set(awayX, 0, awayZ);
    }
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
    // 拉开时高度向目标上方 30 米靠拢（海面 / 地面 Boss 不贴水面），回头时自然形成浅俯冲
    out.y = THREE.MathUtils.clamp((target.y + 30 - position.y) / 150, -0.3, 0.3);
    out.normalize();
  }

  /** 对敌机：太近且指不过去时直线拉开（有时间上限，追尾的敌机甩不掉也要回头） */
  private planDogfight(
    dt: number,
    position: THREE.Vector3,
    target: THREE.Vector3,
    forward: THREE.Vector3,
    out: THREE.Vector3
  ): void {
    const distance = position.distanceTo(target);
    if (this.extending) {
      this.extendTimer += dt;
      if (distance > JET_REENGAGE || this.extendTimer > JET_EXTEND_MAX) this.extending = false;
    } else if (
      distance < JET_TOO_CLOSE &&
      angleBetween(forward, tmpToTarget.subVectors(target, position)) > JET_OFF_AXIS
    ) {
      this.extending = true;
      this.extendTimer = 0;
    }
    if (!this.extending) return;
    out.set(forward.x, 0, forward.z);
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
    out.y = THREE.MathUtils.clamp((target.y - position.y) / 200, -0.25, 0.25);
    out.normalize();
  }

  /** 无目标：飞向战场中心，保持巡航高度 */
  private cruiseDirection(world: PilotWorld, agl: number, out: THREE.Vector3): void {
    const position = world.position;
    out.set(-position.x, 0, -position.z);
    if (out.lengthSq() < 200 * 200) {
      // 中心附近：绕中心盘旋（切向）
      out.set(-position.z, 0, position.x);
    }
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
    out.y = THREE.MathUtils.clamp((CRUISE_AGL - agl) / 150, -0.35, 0.5);
    out.normalize();
  }

  // ───────────────────────────── 飞控 ─────────────────────────────

  /**
   * 前瞻地形：沿机头方向在若干时间点比较预测高度与地表。
   * 返回 0 = 安全，1 = 需要提前爬升，2 = 紧急拉起。
   */
  private checkTerrain(world: PilotWorld, forward: THREE.Vector3): number {
    const position = world.position;
    const speed = Math.max(10, world.speed);
    let alert = 0;
    this.terrainRequiredSlope = -1;
    this.terrainWall = false;
    const steps = Math.ceil((speed * TERRAIN_LOOKAHEAD_SECONDS) / TERRAIN_PROBE_SPACING);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * TERRAIN_LOOKAHEAD_SECONDS;
      const x = position.x + forward.x * speed * t;
      const z = position.z + forward.z * speed * t;
      const y = position.y + forward.y * speed * t;
      const ground = world.groundY(x, z);
      if (!Number.isFinite(ground)) continue;
      const margin = TERRAIN_MARGIN + 4 * t;
      if (y < ground + margin) {
        alert = Math.max(alert, t <= 0.8 ? 2 : 1);
        if (t > 0) {
          // 从现在直线飞过去需要的最小爬升（sin）；陡到爬不过去就是“墙”，要转向
          const slope = (ground + margin - position.y) / (speed * t);
          this.terrainRequiredSlope = Math.max(this.terrainRequiredSlope, slope);
          // 爬不过去，或越过它要飞到软顶界之上（会被顶界压回去撞上）都算“墙”
          if ((slope > 0.7 && t <= 1.8) || ground + margin > CEILING_Y) this.terrainWall = true;
        }
      }
    }
    return alert;
  }

  /**
   * 告警时的避让航向（写入 out 的水平分量）：以当前航向为中心的扇面内逐个试探，
   * 取“前方各距离上高度余量的最小值”最大的方向；同分时偏向转角小的方向。
   */
  private findEscapeHeading(world: PilotWorld, forward: THREE.Vector3, out: THREE.Vector3): void {
    const position = world.position;
    const baseHeading = Math.atan2(-forward.x, -forward.z);
    let bestHeading = baseHeading;
    let bestScore = -Infinity;
    for (const offset of ESCAPE_OFFSETS) {
      const heading = baseHeading + offset;
      const dirX = -Math.sin(heading);
      const dirZ = -Math.cos(heading);
      let worst = Infinity;
      for (const distance of ESCAPE_PROBE_DISTANCES) {
        const ground = world.groundY(position.x + dirX * distance, position.z + dirZ * distance);
        if (!Number.isFinite(ground)) continue;
        // 每 100 米可以爬升约 45 米：远处的高地扣除可爬升量
        worst = Math.min(worst, position.y + distance * 0.45 - ground);
      }
      const score = (Number.isFinite(worst) ? worst : 500) - Math.abs(offset) * 6;
      if (score > bestScore) {
        bestScore = score;
        bestHeading = heading;
      }
    }
    out.set(-Math.sin(bestHeading), 0, -Math.cos(bestHeading));
  }

  /** 机体坐标系下的 bang-bang 控制：偏航 / 俯仰追向期望方向，滚转保持机翼水平 */
  private steer(
    dt: number,
    quaternion: THREE.Quaternion,
    right: THREE.Vector3,
    up: THREE.Vector3,
    desired: THREE.Vector3,
    input: InputState
  ): void {
    tmpInverse.copy(quaternion).invert();
    tmpLocal.copy(desired).applyQuaternion(tmpInverse);
    // 机头为本地 -Z：偏航左 (+Y 旋转) 把机头转向本地 -X；俯仰上 (+X 旋转) 把机头抬向本地 +Y
    const yawError = Math.atan2(-tmpLocal.x, -tmpLocal.z);
    const pitchError = Math.atan2(tmpLocal.y, Math.hypot(tmpLocal.x, tmpLocal.z));
    const yaw = this.modulate(yawError / (YAW_RATE * dt), 'yaw');
    input.yawLeft = yaw > 0;
    input.yawRight = yaw < 0;
    const pitch = this.modulate(pitchError / (PITCH_RATE * dt), 'pitch');
    input.pitchUp = pitch > 0;
    input.pitchDown = pitch < 0;

    // 机翼改平：bank = atan2(右翼的世界 Y, 机背的世界 Y)；>0 按 E（右滚）回正
    const bank = Math.atan2(right.y, up.y);
    if (bank > ROLL_DEADBAND) input.rollRight = true;
    else if (bank < -ROLL_DEADBAND) input.rollLeft = true;
  }

  /**
   * 点按调制（sigma-delta）：误差超过一步可转角度时持续按住；
   * 更小的误差累积到一步再点按一次，避免整步来回抖动。返回 -1 / 0 / 1。
   */
  private modulate(stepsNeeded: number, axis: 'yaw' | 'pitch'): number {
    if (Math.abs(stepsNeeded) >= 1) {
      if (axis === 'yaw') this.yawAccumulator = 0;
      else this.pitchAccumulator = 0;
      return Math.sign(stepsNeeded);
    }
    let accumulator = axis === 'yaw' ? this.yawAccumulator : this.pitchAccumulator;
    if (accumulator !== 0 && Math.sign(accumulator) !== Math.sign(stepsNeeded)) accumulator = 0;
    accumulator += stepsNeeded;
    let output = 0;
    if (accumulator >= 1) {
      output = 1;
      accumulator -= 1;
    } else if (accumulator <= -1) {
      output = -1;
      accumulator += 1;
    }
    if (axis === 'yaw') this.yawAccumulator = accumulator;
    else this.pitchAccumulator = accumulator;
    return output;
  }

  /** 受击规避：在期望方向上叠加正弦偏航 / 俯仰（玩家被打时的本能蛇行） */
  private applyJink(direction: THREE.Vector3): void {
    const phase = (this.clock * Math.PI * 2) / JINK_PERIOD;
    const yaw = JINK_AMPLITUDE * Math.sin(phase);
    const pitch = 0.5 * JINK_AMPLITUDE * Math.sin(phase * 1.7);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const x = direction.x * cos + direction.z * sin;
    const z = -direction.x * sin + direction.z * cos;
    direction.set(x, direction.y + pitch, z).normalize();
  }

  private updateAimError(dt: number): void {
    if (this.aimErrorScale <= 0) return;
    // OU：时间常数约 1.2 秒
    const decay = Math.exp(-dt / 1.2);
    const noise = this.aimErrorScale * Math.sqrt(1 - decay * decay);
    this.aimErrorYaw = this.aimErrorYaw * decay + noise * this.gaussian();
    this.aimErrorPitch = this.aimErrorPitch * decay + noise * this.gaussian();
  }

  private applyAimError(direction: THREE.Vector3): void {
    if (this.aimErrorScale <= 0) return;
    const yaw = this.aimErrorYaw;
    const pitch = this.aimErrorPitch;
    // 绕世界 Y 偏转 yaw，再整体抬 / 压 pitch（小角度近似）
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const x = direction.x * cos + direction.z * sin;
    const z = -direction.x * sin + direction.z * cos;
    direction.set(x, direction.y + pitch, z).normalize();
  }

  private gaussian(): number {
    const u = Math.max(1e-9, this.random());
    const v = this.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ───────────────────────────── 特殊武器 ─────────────────────────────

  private useSpecial(
    special: PilotSpecialState,
    distance: number,
    angle: number,
    world: PilotWorld,
    input: InputState
  ): void {
    const mode = special.mode;
    if (!mode) return;
    const degrees = THREE.MathUtils.radToDeg(angle);
    switch (mode) {
      case 'salvo': {
        // 火箭 / 蜂群：按下沿发射；松开一步再按下一发
        const inCone = degrees < 9 && distance < special.range * 0.85;
        if (this.specialPressed) {
          this.specialPressed = false;
        } else if (special.ready && inCone) {
          input.special = true;
          this.specialPressed = true;
        }
        return;
      }
      case 'beam': {
        input.special = !special.overheated && degrees < 4 && distance < special.range;
        return;
      }
      case 'charge': {
        const onTarget = degrees < 3 && distance < special.range;
        if (this.chargeHeld) {
          if (special.charge >= 0.92 && onTarget) {
            // 松开发射
            this.chargeHeld = false;
            return;
          }
          if (degrees > 12 && special.charge >= 0.3) {
            this.chargeHeld = false;
            return;
          }
          input.special = true;
          return;
        }
        if (special.ready && degrees < 8 && distance < special.range) {
          this.chargeHeld = true;
          input.special = true;
        }
        return;
      }
      case 'pulse': {
        let close = 0;
        for (const target of world.targets) {
          if (target.position.distanceTo(world.position) < special.range * 0.8) close++;
        }
        const missileClose = world.incomingMissileDistance < special.range * 0.8;
        if (this.specialPressed) {
          this.specialPressed = false;
        } else if (special.ready && (close >= 2 || missileClose)) {
          input.special = true;
          this.specialPressed = true;
        }
        return;
      }
    }
  }

  private releaseSpecial(special: PilotSpecialState, input: InputState): void {
    // 蓄力中失去目标：够 30% 就打出去，否则松开取消
    if (special.mode === 'charge' && this.chargeHeld) {
      this.chargeHeld = false;
    }
    this.specialPressed = false;
    input.special = false;
  }
}
