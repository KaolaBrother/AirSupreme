import * as THREE from 'three';
import type { DecoyPoint } from '@/core/CombatContracts';
import { BossType } from '@/features/boss/BossTypes';
import type { BossMissileSystem } from '@/features/boss/BossMissileSystem';

/**
 * 第 6-10 关 Boss 的控制器辅助：出生点选择（地表采样）、特殊武器命中冷却、
 * 热焰弹对 Boss 导弹的诱骗、神谕核心的城堡联动状态。
 * 纯逻辑 + 预分配对象，不依赖 DOM。
 */

export type BossSurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

/**
 * Boss 出生点范围：以战场中心为圆心、半径 1150 米的圆（玩家软边界 1350 米、硬边界 1500 米；
 * 圆而不是方框——方框四角在硬边界之外）。留出的余量给 Boss 的体型与机动。
 */
const SPAWN_RADIUS = 1150;
/** 空中 Boss 的出生高度上限（软顶界 540 米之下） */
const MAX_AIR_SPAWN_Y = 480;
const WATER_Y = -48;
const DEG = Math.PI / 180;

export interface BossSpawnRequest {
  type: BossType;
  playerPosition: THREE.Vector3;
  /** 玩家水平前向（XZ，不必归一化）；Boss 出现在玩家前方 */
  forwardX: number;
  forwardZ: number;
  sample: BossSurfaceSampler;
  /** CITADEL 决战区（神谕主宰锚点）；非第 10 关为 null */
  coreArena: THREE.Vector3 | null;
}

export interface BossSpawnPlacement {
  position: THREE.Vector3;
  /** 朝向玩家的航向（绕 Y，弧度） */
  yaw: number;
}

/** “前方”候选：偏离机头的角度（弧度，右为正）与距离倍数 */
interface AheadCandidate {
  readonly angle: number;
  readonly scale: number;
}

/**
 * 候选按代价排序：每偏离机头 12° 计 1，距离每缩短 15% 计 0.8、每拉远 25% 计 1.2——
 * 先保证 Boss 在视野内（16:9 下水平半视场约 54°），其次尽量保持设计距离。
 */
function buildAheadCandidates(scales: readonly number[]): readonly AheadCandidate[] {
  const angles = [0, 12, -12, 24, -24, 36, -36, 48, -48, 60, -60];
  const list: Array<AheadCandidate & { cost: number }> = [];
  for (const angle of angles) {
    for (const scale of scales) {
      const scaleCost = scale < 1 ? ((1 - scale) / 0.15) * 0.8 : ((scale - 1) / 0.25) * 1.2;
      list.push({ angle: angle * DEG, scale, cost: Math.abs(angle) / 12 + scaleCost });
    }
  }
  list.sort((a, b) => a.cost - b.cost);
  return list.map(({ angle, scale }) => ({ angle, scale }));
}

/** 空中 Boss：可略微拉近 */
const AHEAD_CANDIDATES = buildAheadCandidates([1, 0.85, 0.7]);
/** 需要陆地 / 水面的 Boss：还可以更远，好找到合适的地表 */
const AHEAD_CANDIDATES_SURFACE = buildAheadCandidates([1, 0.85, 0.7, 1.25, 1.5, 1.8]);
/** 前方没有余地时的兜底方向：从 ±72° 逐步偏到正后方，取最靠近机头的 */
const FALLBACK_ANGLES = [72, -72, 96, -96, 120, -120, 144, -144, 180].map((angle) => angle * DEG);

interface SpawnFrame {
  px: number;
  pz: number;
  /** 玩家水平前向（单位向量） */
  fx: number;
  fz: number;
}

/**
 * 玩家位置与水平前向：前向几乎竖直（垂直爬升 / 俯冲）时没有可用的水平朝向，
 * 改用“朝战场中心”（在中心时朝 -Z）。
 */
function makeSpawnFrame(p: THREE.Vector3, forwardX: number, forwardZ: number): SpawnFrame {
  const px = Number.isFinite(p.x) ? p.x : 0;
  const pz = Number.isFinite(p.z) ? p.z : 0;
  const length = Math.hypot(forwardX, forwardZ);
  if (Number.isFinite(length) && length >= 0.2) {
    return { px, pz, fx: forwardX / length, fz: forwardZ / length };
  }
  const toCenter = Math.hypot(px, pz);
  return toCenter > 1
    ? { px, pz, fx: -px / toCenter, fz: -pz / toCenter }
    : { px, pz, fx: 0, fz: -1 };
}

function isInSpawnArea(x: number, z: number): boolean {
  return Math.hypot(x, z) <= SPAWN_RADIUS;
}

/** “前方”：水平方位在机头 ±60° 以内（16:9 下水平半视场约 54°；多留 1° 容纳浮点误差） */
const AHEAD_COS = Math.cos(61 * DEG);
/** 螺旋搜索依次放宽的方向锥：±60° → 前方半球 → 任意方向 */
const SPIRAL_CONES = [AHEAD_COS, 0, -2];

/** 玩家机头水平方向与“指向该点”的方向夹角的余弦 */
function cosToPoint(frame: SpawnFrame, x: number, z: number): number {
  const dx = x - frame.px;
  const dz = z - frame.pz;
  const length = Math.hypot(dx, dz);
  return length > 1e-6 ? (dx * frame.fx + dz * frame.fz) / length : 1;
}

interface SpawnSpot {
  x: number;
  z: number;
  /** 地表高度（已采样） */
  groundY: number;
}

interface SpawnSpec {
  /** 设计距离（米） */
  distance: number;
  /** 右侧偏移（米，负为左） */
  lateral: number;
  /** 地表约束（陆地 / 水面）；空中 Boss 为 null */
  accept: ((surface: { y: number; water: boolean }) => boolean) | null;
}

/** 玩家前方偏 angle（右为正）、距离 distance 处，再向右侧偏 lateral 的点 */
function pointAt(
  frame: SpawnFrame,
  angle: number,
  distance: number,
  lateral: number
): { x: number; z: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // 右侧向量：前方 (dx, dz) 的右侧是 (-dz, dx)（前方为 -Z 时右侧为 +X）
  const dirX = frame.fx * cos - frame.fz * sin;
  const dirZ = frame.fz * cos + frame.fx * sin;
  return {
    x: frame.px + dirX * distance - dirZ * lateral,
    z: frame.pz + dirZ * distance + dirX * lateral,
  };
}

function sampleGround(sample: BossSurfaceSampler, x: number, z: number): number {
  const y = sample(x, z).y;
  return Number.isFinite(y) ? y : WATER_Y;
}

/**
 * 玩家前方（±60° 内）落在出生范围内的第一个候选点（按代价顺序）。
 * sample 为 null 时不看地表；否则还要满足 Boss 的地表约束。
 */
function findAheadSpot(
  frame: SpawnFrame,
  spec: SpawnSpec,
  sample: BossSurfaceSampler | null
): SpawnSpot | null {
  const surfaceBound = spec.accept !== null && sample !== null;
  const candidates = surfaceBound ? AHEAD_CANDIDATES_SURFACE : AHEAD_CANDIDATES;
  for (const candidate of candidates) {
    const point = pointAt(frame, candidate.angle, spec.distance * candidate.scale, spec.lateral);
    if (!isInSpawnArea(point.x, point.z) || cosToPoint(frame, point.x, point.z) < AHEAD_COS) {
      continue;
    }
    if (!sample) return { ...point, groundY: WATER_Y };
    const surface = sample(point.x, point.z);
    if (!surfaceBound || spec.accept?.(surface)) {
      return { ...point, groundY: Number.isFinite(surface.y) ? surface.y : WATER_Y };
    }
  }
  return null;
}

/**
 * 地表约束的兜底：在期望点附近按螺旋搜索出生范围内满足约束的落点，方向锥依次放宽
 * （±60° → 前方半球 → 任意方向）；都没有就返回 null。
 */
function spiralSearch(
  frame: SpawnFrame,
  sample: BossSurfaceSampler,
  originX: number,
  originZ: number,
  accept: (surface: { y: number; water: boolean }) => boolean
): SpawnSpot | null {
  for (const minCos of SPIRAL_CONES) {
    for (let radius = 60; radius <= 1200; radius += 60) {
      const steps = Math.max(8, Math.round((radius * Math.PI * 2) / 90));
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const x = originX + Math.cos(angle) * radius;
        const z = originZ + Math.sin(angle) * radius;
        if (!isInSpawnArea(x, z) || cosToPoint(frame, x, z) < minCos) continue;
        const surface = sample(x, z);
        if (accept(surface)) {
          return { x, z, groundY: surface.y };
        }
      }
    }
  }
  return null;
}

/**
 * 选择出生落点：
 * 1. 玩家前方 ±60°、设计距离 0.7~1 倍（有地表约束时可到 1.8 倍）内代价最小、落在出生范围内
 *    且满足地表约束的点；
 * 2. 前方有余地但地表不合适：从前方点螺旋搜索（方向锥逐步放宽）；
 * 3. 前方没有余地（玩家在出生范围外、正朝外飞）：取出生范围内最靠近机头的方向，
 *    仍不行就朝战场中心——调用方应先用 hasBossSpawnRoomAhead 等玩家掉头。
 */
function findSpawnSpot(frame: SpawnFrame, spec: SpawnSpec, sample: BossSurfaceSampler): SpawnSpot {
  const spot = findAheadSpot(frame, spec, sample);
  if (spot) return spot;

  const roomAhead = findAheadSpot(frame, spec, null);
  if (roomAhead && spec.accept) {
    const found = spiralSearch(frame, sample, roomAhead.x, roomAhead.z, spec.accept);
    if (found) return found;
    // 整个出生范围都没有合适地表：留在前方，地表高度照实采样
    return { ...roomAhead, groundY: sampleGround(sample, roomAhead.x, roomAhead.z) };
  }

  for (const angle of FALLBACK_ANGLES) {
    for (const scale of [1, 0.7]) {
      const point = pointAt(frame, angle, spec.distance * scale, spec.lateral);
      if (!isInSpawnArea(point.x, point.z)) continue;
      if (spec.accept) {
        const found = spiralSearch(frame, sample, point.x, point.z, spec.accept);
        if (found) return found;
      }
      return { ...point, groundY: sampleGround(sample, point.x, point.z) };
    }
  }

  // 理论上走不到：玩家远在出生范围外。朝战场中心、落在出生范围边缘以内
  const toCenter = Math.hypot(frame.px, frame.pz);
  const dirX = toCenter > 1 ? -frame.px / toCenter : frame.fx;
  const dirZ = toCenter > 1 ? -frame.pz / toCenter : frame.fz;
  const reach = Math.max(0, toCenter - SPAWN_RADIUS + spec.distance);
  const x = frame.px + dirX * reach;
  const z = frame.pz + dirZ * reach;
  return { x, z, groundY: sampleGround(sample, x, z) };
}

/**
 * 天空母舰：SkyCarrierAI 的巡航高度是 200 米（每秒收敛 5% 的高度差）。玩家此时一般在 20~150 米，
 * 若在前方 200 米、200 米高出生，母舰在机头上方 35~42°，而第三人称视野上沿只有约 +19°
 * （垂直视场 75°、追尾相机俯视约 18°），一出场就在画面外。改为前方 500 米、比玩家高约 100 米
 * （160~200 米；160 米时舰底仍高于第五关最高楼顶 135 米）出生：一出场就在画面上部，随后自行爬升到巡航高度。
 */
const SKY_CARRIER_SPAWN_DISTANCE = 500;
const SKY_CARRIER_ABOVE_PLAYER = 100;
const SKY_CARRIER_MIN_SPAWN_Y = 160;
const SKY_CARRIER_CRUISE_Y = 200;

/** 各 Boss 的设计距离 / 侧偏 / 地表约束（api-spec §2 与第 1-5 关的原设计值） */
function getSpawnSpec(type: BossType, random: () => number): SpawnSpec {
  switch (type) {
    case BossType.HEAVY_BOMBER:
      return { distance: 200, lateral: (random() - 0.5) * 120, accept: null };
    case BossType.DESERT_FORTRESS:
      return { distance: 200, lateral: 0, accept: null };
    case BossType.OCTOPUS_WARSHIP:
      return { distance: 200, lateral: (random() - 0.5) * 100, accept: null };
    case BossType.MISSILE_DESTROYER:
      return { distance: 200, lateral: 0, accept: (surface) => surface.water };
    case BossType.SKY_CARRIER:
      return { distance: SKY_CARRIER_SPAWN_DISTANCE, lateral: 0, accept: null };
    case BossType.MAGMA_COLOSSUS:
      // 陆地，且不在火山锥上
      return {
        distance: 260,
        lateral: 0,
        accept: (surface) => !surface.water && surface.y < WATER_Y + 160,
      };
    case BossType.ABYSSAL_LEVIATHAN:
      return { distance: 260, lateral: 0, accept: (surface) => surface.water };
    case BossType.TEMPEST_ZEPPELIN:
      return { distance: 300, lateral: 0, accept: null };
    case BossType.PHANTOM_WING:
      return { distance: 320, lateral: 120, accept: null };
    case BossType.ORACLE_PRIME:
    default:
      return { distance: 280, lateral: 0, accept: null };
  }
}

function airSpawnY(y: number): number {
  return Math.min(MAX_AIR_SPAWN_Y, y);
}

export interface BossSpawnRoomRequest {
  type: BossType;
  playerPosition: THREE.Vector3;
  forwardX: number;
  forwardZ: number;
  /** 地表采样：提供时还要求前方有符合 Boss 地表约束（陆地 / 水面）的落点 */
  sample?: BossSurfaceSampler;
  /** 神谕主宰的城堡核心锚点（有锚点时不需要前方余地） */
  coreArena?: THREE.Vector3 | null;
}

/**
 * Boss 能否出现在玩家前方（±60°、出生范围内、地表合适）：玩家在出生范围外正朝战场外飞、
 * 或前方只有不合适的地表（例如熔岩巨像前方全是海）时为 false——这时应提示玩家返回作战区域，
 * 等机头转回来再让 Boss 出现。神谕主宰有城堡锚点时总为 true。
 */
export function hasBossSpawnRoomAhead(request: BossSpawnRoomRequest): boolean {
  if (request.type === BossType.ORACLE_PRIME && request.coreArena) return true;
  const frame = makeSpawnFrame(request.playerPosition, request.forwardX, request.forwardZ);
  const spec = getSpawnSpec(request.type, () => 0.5);
  return findAheadSpot(frame, spec, request.sample ?? null) !== null;
}

/**
 * 选择第 6-10 关 Boss 出生点（api-spec §2 的偏移，按玩家朝向旋转到“前方”、落在出生范围内并贴合地形）：
 * - 熔岩巨像：前方 260 米的陆地（不在火山锥上），y = 地表
 * - 深渊利维坦：前方 260 米的开阔水面（前方是冰架就沿前方找更远 / 更偏的水面），y = -48
 * - 雷霆飞艇：前方 300 米、高度 ≥ 170 且高于地表 120 米
 * - 幻影之翼：前方 320 米、右侧 120 米、玩家高度 +40，且高于地表 60 米
 * - 神谕主宰：城堡核心决战区（getCoreArena），否则前方 280 米、高度 160
 * 前方放不下时（见 hasBossSpawnRoomAhead）取最靠近机头的方向。
 */
export function resolveAdvancedBossSpawn(request: BossSpawnRequest): BossSpawnPlacement {
  const { playerPosition: p, sample } = request;
  const position = new THREE.Vector3();

  if (request.type === BossType.ORACLE_PRIME && request.coreArena) {
    position.copy(request.coreArena);
  } else {
    const frame = makeSpawnFrame(p, request.forwardX, request.forwardZ);
    const spot = findSpawnSpot(frame, getSpawnSpec(request.type, Math.random), sample);
    switch (request.type) {
      case BossType.MAGMA_COLOSSUS:
        position.set(spot.x, spot.groundY, spot.z);
        break;
      case BossType.ABYSSAL_LEVIATHAN:
        position.set(spot.x, WATER_Y, spot.z);
        break;
      case BossType.TEMPEST_ZEPPELIN:
        position.set(spot.x, airSpawnY(Math.max(170, spot.groundY + 120)), spot.z);
        break;
      case BossType.PHANTOM_WING: {
        const desired = Number.isFinite(p.y) ? p.y + 40 : 120;
        position.set(spot.x, airSpawnY(Math.max(desired, spot.groundY + 60, 40)), spot.z);
        break;
      }
      case BossType.ORACLE_PRIME:
      default:
        position.set(spot.x, airSpawnY(Math.max(160, spot.groundY + 120)), spot.z);
        break;
    }
  }

  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    position.set(0, 160, -280);
  }
  const yaw = Math.atan2(p.x - position.x, p.z - position.z);
  return { position, yaw: Number.isFinite(yaw) ? yaw : 0 };
}

export interface LegacyBossSpawnRequest {
  type: BossType;
  playerPosition: THREE.Vector3;
  /** 玩家水平前向（XZ，不必归一化）；Boss 出现在玩家前方 */
  forwardX: number;
  forwardZ: number;
  sample: BossSurfaceSampler;
  /** 0..1 随机数（测试可注入） */
  random?: () => number;
}

/**
 * 第 1-5 关 Boss 出生点：沿玩家水平朝向前方约 200 米、落在出生范围内（原先固定在 +Z，
 * 玩家朝 -Z 飞时会出现在身后 200 米）。高度沿用各 Boss 的设计值；导弹驱逐舰落在前方的水面，
 * 空中 Boss 高于地表、低于软顶界。
 * - 重型轰炸机：前方 200 米、左右 ±60 米、玩家高度 +50~100
 * - 移动堡垒：前方 200 米，y = -50（沙漠网格基准面）
 * - 章鱼战舰：前方 200 米、左右 ±50 米，y = 150（触手下缘离地至少约 15 米）
 * - 导弹驱逐舰：前方 200 米附近的水面，y = -50
 * - 天空母舰：前方 500 米，比玩家高约 100 米（160~200 米，且高于地表 120 米），随后爬升到 200 米巡航
 * 前方放不下时（见 hasBossSpawnRoomAhead）取最靠近机头的方向。
 */
export function resolveLegacyBossSpawn(request: LegacyBossSpawnRequest): THREE.Vector3 {
  const { playerPosition: p, sample } = request;
  const random = request.random ?? Math.random;
  const frame = makeSpawnFrame(p, request.forwardX, request.forwardZ);
  const spot = findSpawnSpot(frame, getSpawnSpec(request.type, random), sample);
  const playerY = Number.isFinite(p.y) ? p.y : 60;

  const position = new THREE.Vector3();
  switch (request.type) {
    case BossType.DESERT_FORTRESS:
      position.set(spot.x, -50, spot.z);
      break;
    case BossType.OCTOPUS_WARSHIP:
      position.set(spot.x, airSpawnY(Math.max(150, spot.groundY + 110)), spot.z);
      break;
    case BossType.MISSILE_DESTROYER:
      position.set(spot.x, -50, spot.z);
      break;
    case BossType.SKY_CARRIER: {
      const approachY = Math.min(
        SKY_CARRIER_CRUISE_Y,
        Math.max(SKY_CARRIER_MIN_SPAWN_Y, playerY + SKY_CARRIER_ABOVE_PLAYER)
      );
      position.set(spot.x, airSpawnY(Math.max(approachY, spot.groundY + 120)), spot.z);
      break;
    }
    case BossType.HEAVY_BOMBER:
    default: {
      const desired = playerY + 50 + random() * 50;
      position.set(spot.x, airSpawnY(Math.max(desired, spot.groundY + 60)), spot.z);
      break;
    }
  }

  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    position.set(0, 150, -200);
  }
  return position;
}

/**
 * Boss 特殊武器命中冷却（每个目标约 0.6 秒），checkHazard 本身不做冷却。
 */
export class HazardCooldownTracker {
  private readonly cooldowns = new Map<THREE.Object3D, number>();
  private readonly expired: THREE.Object3D[] = [];

  constructor(private readonly cooldownSeconds: number = 0.6) {}

  public update(deltaTime: number): void {
    if (this.cooldowns.size === 0) return;
    this.expired.length = 0;
    for (const [target, remaining] of this.cooldowns) {
      const next = remaining - deltaTime;
      if (next <= 0) this.expired.push(target);
      else this.cooldowns.set(target, next);
    }
    for (const target of this.expired) this.cooldowns.delete(target);
  }

  public isReady(target: THREE.Object3D): boolean {
    return !this.cooldowns.has(target);
  }

  public trigger(target: THREE.Object3D): void {
    this.cooldowns.set(target, this.cooldownSeconds);
  }

  public clear(): void {
    this.cooldowns.clear();
  }
}

/** 单个诱饵锚点：跟随一枚燃烧中的热焰弹（Boss 导弹以它为目标） */
interface DecoyAnchor {
  object: THREE.Object3D;
  /** 剩余存活时间（热焰弹燃尽后保留在最后位置一会儿，让被诱骗的导弹飞过去） */
  linger: number;
  active: boolean;
}

/**
 * 热焰弹诱骗 Boss 导弹：投放热焰弹后，正在追踪玩家且距离玩家较近的导弹按诱饵强度概率
 * 改为追踪诱饵锚点，飞抵后引爆。导弹类本身不需要改动（锚点是挂在场景里的空节点）。
 */
export class BossFlareDecoyRedirector {
  private static readonly POOL_SIZE = 6;
  private static readonly REDIRECT_RANGE = 420;
  private static readonly DETONATE_DISTANCE = 9;
  private readonly anchors: DecoyAnchor[] = [];
  private readonly redirected = new Set<object>();
  private previousDecoyCount = 0;

  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < BossFlareDecoyRedirector.POOL_SIZE; i++) {
      const object = new THREE.Object3D();
      object.name = 'boss-missile-decoy-anchor';
      this.anchors.push({ object, linger: 0, active: false });
    }
  }

  /**
   * decoys：当前燃烧中的热焰弹；playerPosition：玩家位置（只诱骗靠近玩家的导弹）
   */
  public update(
    deltaTime: number,
    decoys: readonly DecoyPoint[],
    missileSystem: BossMissileSystem | null,
    playerPosition: THREE.Vector3
  ): void {
    // 锚点跟随诱饵；诱饵燃尽后原地停留片刻再回收
    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i];
      const decoy = decoys[i];
      if (decoy) {
        if (!anchor.active) {
          anchor.active = true;
          this.scene.add(anchor.object);
        }
        anchor.object.position.copy(decoy.position);
        anchor.linger = 2.5;
      } else if (anchor.active) {
        anchor.linger -= deltaTime;
        if (anchor.linger <= 0) {
          anchor.active = false;
          anchor.object.removeFromParent();
        }
      }
    }

    const decoyCount = decoys.length;
    const newDeployment = decoyCount > this.previousDecoyCount;
    this.previousDecoyCount = decoyCount;
    if (!missileSystem) return;

    const missiles = missileSystem.getMissiles();
    for (const missile of missiles) {
      const position = missile.getMesh().position;
      // 已被诱骗的导弹：飞抵锚点后引爆
      if (this.redirected.has(missile)) {
        const target = missile.target;
        if (
          target &&
          target.position.distanceTo(position) < BossFlareDecoyRedirector.DETONATE_DISTANCE
        ) {
          missile.takeDamage(1e6);
        }
        continue;
      }
      if (!newDeployment || decoyCount === 0 || !missile.isTargetingPlayer) continue;
      if (position.distanceTo(playerPosition) > BossFlareDecoyRedirector.REDIRECT_RANGE) continue;
      // 按最强诱饵的强度决定是否被骗（新投放的热焰弹强度接近 1）
      let best = -1;
      let bestStrength = 0;
      for (let i = 0; i < decoyCount && i < this.anchors.length; i++) {
        const strength = decoys[i].strength;
        if (strength > bestStrength) {
          bestStrength = strength;
          best = i;
        }
      }
      if (best < 0 || Math.random() > 0.35 + 0.55 * bestStrength) continue;
      missile.isTargetingPlayer = false;
      missile.target = this.anchors[best].object;
      this.redirected.add(missile);
    }

    // 清理已失效导弹的记录
    if (this.redirected.size > 0) {
      for (const missile of this.redirected) {
        if (!missiles.includes(missile as (typeof missiles)[number]))
          this.redirected.delete(missile);
      }
    }
  }

  public clear(): void {
    for (const anchor of this.anchors) {
      anchor.active = false;
      anchor.linger = 0;
      anchor.object.removeFromParent();
    }
    this.redirected.clear();
    this.previousDecoyCount = 0;
  }
}

/** 神谕主宰阶段 → 城堡核心视觉状态（CitadelEnvironment.setCoreState） */
export type CitadelCoreVisualState = 'online' | 'exposed' | 'overload' | 'offline';

export function mapOracleStageToCoreState(
  stage: string,
  alive: boolean,
  dying: boolean
): CitadelCoreVisualState {
  if (!alive && !dying) return 'offline';
  if (dying) return 'offline';
  switch (stage) {
    case 'collapse':
    case 'arrays':
      return 'exposed';
    case 'overload-rise':
    case 'overload':
      return 'overload';
    default:
      return 'online';
  }
}
