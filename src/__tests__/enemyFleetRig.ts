import * as THREE from 'three';
import { getDifficultyProfile } from '@/core/Difficulty';
import { EventBus, GameEventType, type GameEventPayloads } from '@/core/EventBus';
import { GameSessionState } from '@/core/GameSessionState';
import { EnemySystem } from '@/core/systems/EnemySystem';
import { createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { ProjectilePool } from '@/features/combat/ProjectilePool';
import { AttackDirector } from '@/features/enemy/AttackDirector';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType, type EnemyConfig } from '@/features/enemy/EnemyTypes';
import type { EnemyWeaponKind } from '@/features/enemy/EnemyWeapons';
import type { IJetThreatProvider } from '@/features/enemy/JetThreat';
import {
  getJetMissileCap,
  grantJetMissiles,
  type IJetMissileLauncher,
} from '@/features/enemy/MissileDirector';
import { createJetDoctrine } from '@/features/enemy/doctrine/createJetDoctrine';

/**
 * 敌机机队测试台（批次 E-X）：真实的 EnemyAI + 机型条令 + 攻击令牌导演，脱离渲染器按固定步长推进。
 *
 * 每一步的顺序与 EnemySystem.updateWithPlayer 相同：玩家先动 → 把战场态势写给每架敌机 →
 * 导演发放 / 收回令牌（攻击令牌与全队导弹令牌）→ 每架敌机 update。随机数全部来自按种子生成的
 * 序列，时间由步长累加，不读系统时钟，所以同一个种子每次跑出同一场交战。
 *
 * 敌机导弹的发射通道（游戏里是单位导弹池）由 RigMissileChannel 代替：它只记账，不模拟导弹
 * 的飞行与命中。
 *
 * 这里的几何工具（方位角、夹角）是测试自己的实现，不借用被测代码里的同名函数。
 */

/** 固定模拟步长（秒）：60 Hz */
export const DT = 1 / 60;
export const DEG = Math.PI / 180;

/** 规格 §2 里写死的规则数值（不是可调的起始值） */
export const SPEC = {
  /** 拴绳距离（米） */
  LEASH: 900,
  /** 同时进攻的敌机，进入方位两两至少相隔（弧度） */
  MIN_BEARING_GAP: 60 * DEG,
  /** 招牌攻击的最短预警（秒） */
  MIN_TELL: 0.7,
  /** 油门范围：机型基础速度的倍数 */
  MIN_THROTTLE: 0.6,
  MAX_THROTTLE: 1.3,
  /** 命中半径 = 这个系数 × 机体缩放 */
  HIT_RADIUS_PER_SCALE: 2.5,
} as const;

/** 可复现的 0..1 随机数（mulberry32）；测试自己的实现 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 方位角（弧度，绕世界 Y）：从 from 看 to；0 = +Z，π/2 = +X */
export function bearingOf(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** 两个方位角之间的夹角（0..π） */
export function bearingGap(a: number, b: number): number {
  let diff = (a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

/** 两个向量的夹角（弧度，0..π） */
export function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  const lengths = a.length() * b.length();
  if (!(lengths > 1e-12)) return Math.PI;
  return Math.acos(Math.min(1, Math.max(-1, a.dot(b) / lengths)));
}

/** 水平单位向量：方位角 → (sin, 0, cos) */
export function directionOf(bearing: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(bearing), 0, Math.cos(bearing));
}

export function isFiniteVector(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

/** 让出事件循环：长时间的同步模拟之间调用，避免工作线程超过 RPC 超时 */
export function breathe(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export interface RigPlayer {
  position: THREE.Vector3;
  /** 机头方向（单位向量） */
  forward: THREE.Vector3;
  /** 速率（米/秒） */
  speed: number;
  /** 本步的速度（forward × speed，由测试台写入） */
  velocity: THREE.Vector3;
}

/** 玩家绕世界 Y 轴转向（弧度；正值从 +Z 转向 +X，即向左） */
export function turnForward(player: RigPlayer, angle: number): void {
  const { forward } = player;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = forward.x * cos + forward.z * sin;
  const z = forward.z * cos - forward.x * sin;
  forward.x = x;
  forward.z = z;
  forward.normalize();
}

export interface RigShot {
  time: number;
  step: number;
  jet: EnemyAI;
  type: EnemyType;
  /** 条令开火才有；旧的三状态开火为 null */
  weapon: EnemyWeaponKind | null;
  speed: number | null;
  quiet: boolean;
  damage: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  /** 本步导演发完令牌之后，这架敌机手里有没有令牌 */
  hadToken: boolean;
  /** 开火瞬间的玩家状态与距离 */
  playerPosition: THREE.Vector3;
  playerForward: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  distance: number;
  /** 开火瞬间敌机自己的飞行方向 */
  jetForward: THREE.Vector3;
}

export interface RigTell {
  time: number;
  jet: EnemyAI;
  kind: string;
  duration: number;
}

export interface RigMissile {
  time: number;
  /** 发射者标签：'jet:<机型>' */
  source: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

/**
 * 敌机导弹发射通道的替身（游戏里由 GameCoordinator 用单位导弹池实现）：记录每次发射，
 * 每枚导弹“在飞” flightSeconds 秒后自行消失；不模拟追踪、命中、热焰弹。
 */
export class RigMissileChannel implements IJetMissileLauncher {
  /** 通道可用（游戏里 = 单位系统已加载） */
  public available = true;
  /** 每枚导弹在飞多久（秒） */
  public flightSeconds = 6;
  public readonly launches: RigMissile[] = [];
  /** 敌机系统最近一次写入的“锁定中”预警状态 */
  public lockWarning = false;
  private readonly landings: number[] = [];

  constructor(private readonly clock: () => number) {}

  public isAvailable(): boolean {
    return this.available;
  }

  public launch(position: THREE.Vector3, direction: THREE.Vector3, source: string): boolean {
    const time = this.clock();
    this.launches.push({
      time,
      source,
      position: position.clone(),
      direction: direction.clone(),
    });
    this.landings.push(time + this.flightSeconds);
    return true;
  }

  public countInFlight(): number {
    const now = this.clock();
    let count = 0;
    for (const landing of this.landings) {
      if (landing > now) count++;
    }
    return count;
  }

  public setLockWarning(active: boolean): void {
    this.lockWarning = active;
  }
}

export interface AddJetOptions {
  /** 初始飞行方向（缺省朝向玩家） */
  heading?: THREE.Vector3;
  /** 覆盖机型配置里的个别字段（命中精度、提前量、开火节奏……） */
  config?: Partial<EnemyConfig>;
  /** 这架敌机条令的随机种子（缺省按加入顺序派生） */
  seed?: number;
}

export interface FleetRigOptions {
  /** 令牌数（缺省 2） */
  capacity?: number;
  /** 当前关卡（缺省 1） */
  level?: number;
  bossFight?: boolean;
  seed?: number;
  playerPosition?: THREE.Vector3;
  playerForward?: THREE.Vector3;
  /** 玩家速率（米/秒，缺省 45） */
  playerSpeed?: number;
}

export class FleetRig {
  public readonly scene = new THREE.Scene();
  public readonly director = new AttackDirector();
  public readonly jets: EnemyAI[] = [];
  public readonly player: RigPlayer;
  public readonly shots: RigShot[] = [];
  public readonly tells: RigTell[] = [];
  /** 敌机导弹的发射通道（缺省可用，和游戏里一样） */
  public readonly missiles = new RigMissileChannel(() => this.time);

  public capacity: number;
  public level: number;
  public bossFight: boolean;
  /** 玩家可以被攻击（false = 复活中：导演收回全部令牌） */
  public playerTargetable = true;
  /** 玩家导引头已锁定的敌机 */
  public lockedJet: EnemyAI | null = null;
  /** 有玩家导弹正飞向的敌机 */
  public readonly missileTargets = new Set<EnemyAI>();
  /** 每步在玩家移动之前调用：改 player.forward / player.speed 就是在“飞”玩家 */
  public pilot: ((rig: FleetRig) => void) | null = null;

  public time = 0;
  public stepIndex = 0;

  private readonly seed: number;
  private added = 0;
  private readonly holdersThisStep = new Set<EnemyAI>();

  constructor(options: FleetRigOptions = {}) {
    this.capacity = options.capacity ?? 2;
    this.level = options.level ?? 1;
    this.bossFight = options.bossFight ?? false;
    this.seed = options.seed ?? 1;
    const forward = (options.playerForward ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
    const speed = options.playerSpeed ?? 45;
    this.player = {
      position: (options.playerPosition ?? new THREE.Vector3(0, 300, 0)).clone(),
      forward,
      speed,
      velocity: forward.clone().multiplyScalar(speed),
    };
  }

  /** 加一架带机型条令的敌机；config 缺省为机型表里的基础数值 */
  public addJet(type: EnemyType, position: THREE.Vector3, options: AddJetOptions = {}): EnemyAI {
    const config: EnemyConfig = { ...ENEMY_CONFIGS[type], ...options.config };
    const mesh = createEnemyMesh(config);
    mesh.position.copy(position);
    this.scene.add(mesh);
    const seed = options.seed ?? this.seed * 7919 + this.added * 104729 + 13;
    this.added++;
    const jet = new EnemyAI(mesh, config, this.scene, {
      doctrine: createJetDoctrine(type),
      rng: seededRandom(seed),
    });
    const heading = (options.heading ?? this.player.position.clone().sub(position).setY(0)).clone();
    if (heading.lengthSq() < 1e-9) heading.set(0, 0, 1);
    jet.velocity.copy(heading.normalize().multiplyScalar(config.speed));
    mesh.lookAt(position.clone().add(heading));

    jet.onFire = (origin, direction, damage, shot) => {
      this.shots.push({
        time: this.time,
        step: this.stepIndex,
        jet,
        type,
        weapon: shot ? shot.weapon : null,
        speed: shot ? shot.speed : null,
        quiet: shot ? shot.quiet : false,
        damage,
        origin: origin.clone(),
        direction: direction.clone(),
        hadToken: this.holdersThisStep.has(jet),
        playerPosition: this.player.position.clone(),
        playerForward: this.player.forward.clone(),
        playerVelocity: this.player.velocity.clone(),
        distance: origin.distanceTo(this.player.position),
        jetForward: jet.velocity.clone().normalize(),
      });
    };
    jet.onTell = (cue, _position, duration) => {
      this.tells.push({ time: this.time, jet, kind: cue, duration });
    };
    jet.onMissileLaunch = (origin, direction) => {
      this.missiles.launch(origin, direction, `jet:${type}`);
    };
    this.jets.push(jet);
    return jet;
  }

  /** 本步持有令牌的敌机（导演发完之后的状态） */
  public holders(): EnemyAI[] {
    return this.jets.filter((jet) => jet.hasAttackToken());
  }

  public distanceTo(jet: EnemyAI): number {
    return jet.getMesh().position.distanceTo(this.player.position);
  }

  /** 从玩家看这架敌机的方位角 */
  public bearingTo(jet: EnemyAI): number {
    return bearingOf(this.player.position, jet.getMesh().position);
  }

  /** 玩家绕世界 Y 轴转向（弧度；正值从 +Z 转向 +X） */
  public turnPlayer(angle: number): void {
    turnForward(this.player, angle);
  }

  /** 推进一步 */
  public step(): void {
    this.pilot?.(this);
    const { player } = this;
    player.velocity.copy(player.forward).multiplyScalar(player.speed);
    player.position.addScaledVector(player.velocity, DT);

    for (const jet of this.jets) {
      jet.setCombatSituation(
        player.forward,
        this.lockedJet === jet,
        this.missileTargets.has(jet),
        this.level,
        this.bossFight
      );
    }
    this.director.update(
      DT,
      this.jets,
      this.playerTargetable ? player.position : null,
      this.playerTargetable ? this.capacity : 0
    );
    this.holdersThisStep.clear();
    for (const jet of this.jets) {
      if (jet.hasAttackToken()) this.holdersThisStep.add(jet);
    }
    // 全队导弹令牌：和 EnemySystem 一样，在敌机更新之前发放
    const launcherReady = this.missiles.isAvailable();
    grantJetMissiles(
      this.jets,
      this.playerTargetable && launcherReady ? getJetMissileCap(this.level, this.bossFight) : 0,
      launcherReady ? this.missiles.countInFlight() : 0
    );

    for (const jet of this.jets) {
      jet.setTargetVelocity(player.velocity);
      jet.update(DT, player.position, undefined, player.position);
    }
    this.missiles.setLockWarning(this.jets.some((jet) => jet.isMissileLocking()));
    this.time += DT;
    this.stepIndex++;
  }

  /**
   * 推进 seconds 秒；each 在每步之后调用，返回 true 提前结束。返回实际走过的秒数。
   */
  public run(seconds: number, each?: (rig: FleetRig) => boolean | void): number {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      this.step();
      if (each?.(this) === true) return (i + 1) * DT;
    }
    return steps * DT;
  }

  /** 推进到条件成立；超过 maxSeconds 仍不成立时返回 false */
  public runUntil(predicate: (rig: FleetRig) => boolean, maxSeconds: number): boolean {
    if (predicate(this)) return true;
    let met = false;
    this.run(maxSeconds, () => {
      met = predicate(this);
      return met;
    });
    return met;
  }

  public dispose(): void {
    for (const jet of this.jets) jet.dispose();
    this.jets.length = 0;
    this.director.reset();
  }
}

// ---------------------------------------------------------------------------------------------
// 交战记录的整理工具与脚本飞行员
// ---------------------------------------------------------------------------------------------

/** 水平分量（拷贝） */
export function horizontal(vector: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(vector.x, 0, vector.z);
}

/** 俯仰角（弧度，向上为正） */
export function pitchOf(velocity: THREE.Vector3): number {
  const length = velocity.length();
  return length > 1e-9 ? Math.asin(Math.min(1, Math.max(-1, velocity.y / length))) : 0;
}

/**
 * 把一串射击分组：同一架敌机、相邻两发间隔小于 gap 秒的算同一次点射 / 齐射。
 * shots 需按时间排序（测试台记录的顺序就是）。
 */
export function groupBursts<T extends { time: number; jet: unknown }>(
  shots: readonly T[],
  gap = 0.5
): T[][] {
  const groups: T[][] = [];
  const open = new Map<unknown, T[]>();
  for (const shot of shots) {
    const current = open.get(shot.jet);
    if (current && shot.time - current[current.length - 1].time < gap) {
      current.push(shot);
    } else {
      const next = [shot];
      open.set(shot.jet, next);
      groups.push(next);
    }
  }
  return groups;
}

/** 一段朝同一侧的转向 */
export interface TurnLeg {
  /** 1 = 航向角增大（从 +Z 转向 +X），-1 = 反向 */
  sign: number;
  /** 这一段转过的角度（弧度） */
  angle: number;
  start: number;
  end: number;
}

/**
 * 按水平航向记录“转向段”：连续朝同一侧转算一段，换边或直飞超过 straightGap 秒就结束这一段。
 * 用来数蛇形机动 / 剪刀机动里的换向次数，不依赖条令内部的阶段名。
 */
export class TurnTracker {
  public readonly legs: TurnLeg[] = [];
  /** 累计转过的角度（弧度） */
  public total = 0;

  private heading = Number.NaN;
  private current: TurnLeg | null = null;
  private straight = 0;

  constructor(private readonly straightGap = 0.25) {}

  public feed(time: number, velocity: THREE.Vector3): void {
    if (velocity.x * velocity.x + velocity.z * velocity.z < 1e-9) return;
    const heading = Math.atan2(velocity.x, velocity.z);
    if (Number.isNaN(this.heading)) {
      this.heading = heading;
      return;
    }
    let delta = heading - this.heading;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.heading = heading;
    this.total += Math.abs(delta);
    const sign = Math.abs(delta) < 1e-5 ? 0 : Math.sign(delta);
    if (sign === 0) {
      this.straight += DT;
      if (this.current && this.straight > this.straightGap) this.close();
      return;
    }
    this.straight = 0;
    if (this.current && this.current.sign !== sign) this.close();
    if (!this.current) this.current = { sign, angle: 0, start: time, end: time };
    this.current.angle += Math.abs(delta);
    this.current.end = time;
  }

  /** 结束当前这一段（统计之前调用） */
  public close(): void {
    if (this.current) this.legs.push(this.current);
    this.current = null;
  }

  /** 至少转过 minAngle 的转向段里，相邻两段方向相反的次数 */
  public reversals(minAngle: number): number {
    this.close();
    const big = this.legs.filter((leg) => leg.angle >= minAngle);
    let count = 0;
    for (let i = 1; i < big.length; i++) {
      if (big[i].sign !== big[i - 1].sign) count++;
    }
    return count;
  }

  /**
   * “急转之后紧接着反向急转”的次数：前后两段都至少转过 minAngle，中间直飞不超过 maxPause 秒。
   */
  public hardReversals(minAngle: number, maxPause = 0.3): number {
    this.close();
    let count = 0;
    for (let i = 1; i < this.legs.length; i++) {
      const before = this.legs[i - 1];
      const after = this.legs[i];
      if (
        before.sign !== after.sign &&
        before.angle >= minAngle &&
        after.angle >= minAngle &&
        after.start - before.end <= maxPause
      ) {
        count++;
      }
    }
    return count;
  }
}

/** 脚本飞行员：以有限角速度（弧度/秒）把机头水平转向某架敌机——“追着它打” */
export function chasePilot(jet: EnemyAI, turnRate: number): (rig: FleetRig) => void {
  return (rig) => {
    const { player } = rig;
    const want = bearingOf(player.position, jet.getMesh().position);
    const have = Math.atan2(player.forward.x, player.forward.z);
    let delta = want - have;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const limit = turnRate * DT;
    rig.turnPlayer(Math.max(-limit, Math.min(limit, delta)));
  };
}

/**
 * 脚本飞行员：每一步都待在敌机的固定相对位置上，速度与它相同。
 * back = 在它身后多少米（沿它的水平航向，负值 = 在它前方），right = 在它右侧多少米，
 * up = 高出多少米。facing：'at-jet' 机头指向敌机（缺省），'with-jet' 与敌机同向飞行。
 */
export function shadowPilot(
  jet: EnemyAI,
  back: number,
  right: number,
  up: number,
  facing: 'at-jet' | 'with-jet' = 'at-jet'
): (rig: { player: RigPlayer }) => void {
  return (rig) => {
    const { player } = rig;
    const forward = horizontal(jet.velocity);
    if (forward.lengthSq() < 1e-9) forward.set(0, 0, 1);
    forward.normalize();
    // 前向 (x, z) 的右侧是 (-z, x)
    const jetPosition = jet.getMesh().position;
    player.position.set(
      jetPosition.x - forward.x * back - forward.z * right,
      jetPosition.y + up,
      jetPosition.z - forward.z * back + forward.x * right
    );
    if (facing === 'with-jet') player.forward.copy(forward);
    else player.forward.copy(jetPosition).sub(player.position).normalize();
    player.speed = jet.velocity.length();
    // 测试台随后会按速度把玩家往前挪一步：先退回去，这一步结束时正好在预定位置
    player.position.addScaledVector(player.forward, -player.speed * DT);
  };
}

/**
 * 把测试台里敌机的开火接到真实的敌方子弹池，对一个代表玩家的网格做命中判定
 * （命中半径 5 米：未声明 userData.hitRadius 时战斗代码的缺省值）。
 */
export class LiveFire {
  public readonly pool: ProjectilePool;
  public readonly playerMesh = new THREE.Group();
  public readonly hits: Array<{ time: number; damage: number }> = [];

  constructor(private readonly rig: FleetRig) {
    this.pool = new ProjectilePool(rig.scene);
    rig.scene.add(this.playerMesh);
    for (const jet of rig.jets) this.attach(jet);
  }

  /** 接上一架敌机（构造之后才加入测试台的敌机要单独接） */
  public attach(jet: EnemyAI): void {
    const record = jet.onFire;
    jet.onFire = (origin, direction, damage, shot) => {
      record?.(origin, direction, damage, shot);
      this.pool.fire(origin, direction, damage, jet.getMesh(), 'ENEMY', shot?.weapon);
    };
  }

  /** 每个模拟步之后调用：子弹前进一步并判定是否打中玩家 */
  public step(): void {
    this.playerMesh.position.copy(this.rig.player.position);
    this.playerMesh.updateMatrixWorld(true);
    this.pool.update(DT);
    this.pool.checkCollisions([this.playerMesh], (_target, _projectile, damage) => {
      this.hits.push({ time: this.rig.time, damage });
    });
  }

  public dispose(): void {
    this.pool.dispose();
  }
}

/** 玩家前方 distance 米、方位偏 bearingOffset（弧度，正 = 右侧）处的一点，高度差 height */
export function pointAround(
  player: RigPlayer,
  distance: number,
  bearingOffset: number,
  height = 0
): THREE.Vector3 {
  const heading = Math.atan2(player.forward.x, player.forward.z);
  // 约定与开发钩子一致：0 = 正前方，+90° = 右侧（前向 (x, z) 的右侧是 (-z, x)）
  const bearing = heading - bearingOffset;
  return new THREE.Vector3(
    player.position.x + Math.sin(bearing) * distance,
    player.position.y + height,
    player.position.z + Math.cos(bearing) * distance
  );
}

// ---------------------------------------------------------------------------------------------
// 整个敌机系统（EnemySystem + LevelManager + 导演）的测试台
// ---------------------------------------------------------------------------------------------

export type EnemyFiredPayload = GameEventPayloads[GameEventType.ENEMY_FIRED];
export type EnemyTellPayload = GameEventPayloads[GameEventType.ENEMY_TELL];

export interface SystemShot {
  time: number;
  payload: EnemyFiredPayload;
  /** 开火的敌机（按 payload.owner 找到；找不到为 null） */
  jet: EnemyAI | null;
  /** 开火瞬间它手里有没有令牌，或上一步结束时有没有 */
  hadToken: boolean;
  distance: number;
}

export interface SystemRigOptions {
  level?: number;
  /** 难度档 1..5（3 = 普通） */
  difficulty?: number;
  bossFight?: boolean;
  playerPosition?: THREE.Vector3;
  playerForward?: THREE.Vector3;
  playerSpeed?: number;
}

/**
 * 真实的 EnemySystem：敌机走 Boss 召唤小兵的那条生成路径（spawnEnemyAt），每步调用
 * updateWithPlayer；玩家威胁通过 setThreatProvider 喂进去，开火 / 预警从 EventBus 上收，
 * 敌机导弹交给 RigMissileChannel（setMissileLauncher）。
 * 敌机条令用的是 Math.random——需要可复现时由测试自己替换 Math.random。
 */
export class SystemRig {
  public readonly scene = new THREE.Scene();
  public readonly session = new GameSessionState();
  public readonly system: EnemySystem;
  public readonly player: RigPlayer;
  public readonly shots: SystemShot[] = [];
  public readonly tells: Array<{ time: number; payload: EnemyTellPayload }> = [];
  /** 敌机导弹的发射通道（缺省可用，和游戏里一样） */
  public readonly missiles = new RigMissileChannel(() => this.time);
  public playerTargetable = true;
  public lockedMesh: THREE.Object3D | null = null;
  public readonly missileTargets = new Set<THREE.Object3D>();
  public pilot: ((rig: SystemRig) => void) | null = null;
  public time = 0;

  private readonly unsubscribe: Array<() => void> = [];
  private readonly holdersLastStep = new Set<EnemyAI>();

  constructor(options: SystemRigOptions = {}) {
    this.session.setLevel(options.level ?? 1);
    this.session.setInBossBattle(options.bossFight ?? false);
    this.system = new EnemySystem(this.scene, this.session);
    this.system.init();
    this.system.setDifficultyProfile(getDifficultyProfile(options.difficulty ?? 3));
    const forward = (options.playerForward ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
    const speed = options.playerSpeed ?? 45;
    this.player = {
      position: (options.playerPosition ?? new THREE.Vector3(0, 300, 0)).clone(),
      forward,
      speed,
      velocity: forward.clone().multiplyScalar(speed),
    };
    const provider: IJetThreatProvider = {
      getLockedTarget: () => this.lockedMesh,
      isMissileInbound: (target) => this.missileTargets.has(target),
      getPlayerForward: (out) => {
        out.copy(this.player.forward);
        return true;
      },
      isPlayerTargetable: () => this.playerTargetable,
    };
    this.system.setThreatProvider(provider);
    this.system.setMissileLauncher(this.missiles);

    this.unsubscribe.push(
      EventBus.on(GameEventType.ENEMY_FIRED, ({ payload }) => {
        const jet = this.system.getEnemies().find((enemy) => enemy.getMesh() === payload.owner);
        this.shots.push({
          time: this.time,
          payload: {
            ...payload,
            position: payload.position.clone(),
            direction: payload.direction.clone(),
          },
          jet: jet ?? null,
          hadToken: jet ? jet.hasAttackToken() || this.holdersLastStep.has(jet) : false,
          distance: payload.position.distanceTo(this.player.position),
        });
      }),
      EventBus.on(GameEventType.ENEMY_TELL, ({ payload }) => {
        this.tells.push({ time: this.time, payload });
      })
    );
  }

  public get jets(): EnemyAI[] {
    return this.system.getEnemies();
  }

  public spawn(type: EnemyType, position: THREE.Vector3): EnemyAI {
    this.system.spawnEnemyAt(type, position);
    const jets = this.system.getEnemies();
    return jets[jets.length - 1];
  }

  public holders(): EnemyAI[] {
    return this.jets.filter((jet) => jet.isAlive() && jet.hasAttackToken());
  }

  public turnPlayer(angle: number): void {
    turnForward(this.player, angle);
  }

  public step(): void {
    this.pilot?.(this);
    const { player } = this;
    player.velocity.copy(player.forward).multiplyScalar(player.speed);
    player.position.addScaledVector(player.velocity, DT);
    this.system.updateWithPlayer(DT, player.position);
    this.holdersLastStep.clear();
    for (const jet of this.jets) {
      if (jet.hasAttackToken()) this.holdersLastStep.add(jet);
    }
    this.time += DT;
  }

  public run(seconds: number, each?: (rig: SystemRig) => boolean | void): void {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) {
      this.step();
      if (each?.(this) === true) return;
    }
  }

  public dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.system.dispose();
  }
}
