import * as THREE from 'three';
import type { UnitPlacement } from './UnitDeployments';
import { UnitType, type UnitDomain } from './UnitTypes';

/**
 * 单位放置与航线生成（纯函数，可在无 DOM 环境测试）。
 *
 * 坐标约定：玩家前方为 forward（XZ 单位向量，缺省 (0,-1)），右侧 right = (-fz, fx)。
 * 所有点钳制在战场范围内。有采样器时：地面单位必须落在干地（land）、海上单位必须落在可航行水面
 * （water）；地面航线的每个航点、以及相邻航点之间的直线（20 米粗查 + 2.5 米细查）都必须是干地。
 * 无采样器时（测试、启动早期）任何位置都视为合法，行为与引入 land 之前一致。
 */

export interface SurfaceSample {
  y: number;
  /** 船只可航行的水面（海上单位放置 / 航行） */
  water: boolean;
  /** 干地：地面明显高出水面且不是熔岩（地面单位放置 / 行驶）；浅滩与熔岩两者都不是 */
  land: boolean;
}

/** 地面 / 水面采样：返回值只读，调用方不得保存引用 */
export type SurfaceQuery = (x: number, z: number, domain: UnitDomain) => SurfaceSample;

/** 战场放置范围（与 GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS 对齐，略向内收） */
export const UNIT_BATTLEFIELD_LIMIT = 1300;

/**
 * 地面航线：相邻航点之间沿直线检查干地的间距（米）。先按 20 米粗查快速排除，
 * 通过后再按 2.5 米细查——岸线鼓包与窄于 20 米的浅水沟会从 20 米采样点之间漏过。
 */
export const GROUND_ROUTE_CHECK_STEP = 20;
const GROUND_ROUTE_FINE_STEP = 2.5;

/** 外扩扫描（地面单位兜底）：起始半径、圈距、弧长间距（米）与每圈最少方位数（每 5° 一个） */
const SCAN_MIN_RADIUS = 300;
const SCAN_RADIUS_STEP = 40;
const SCAN_ARC_SPACING = 50;
const SCAN_MIN_BEARINGS = 72;

/** 随机地面航线的最短可接受长度（米），更短就改用确定性搜索 */
const GROUND_ROUTE_MIN_LENGTH = 300;
/** 确定性航线搜索：中心扫描的起始半径 / 圈距 / 弧长间距（米）与每圈最少方位数 */
const ROUTE_SEARCH_MIN_RADIUS = 160;
const ROUTE_SEARCH_RADIUS_STEP = 80;
const ROUTE_SEARCH_ARC_SPACING = 120;
const ROUTE_SEARCH_MIN_BEARINGS = 24;
/** 确定性航线搜索：每个中心尝试的直线数（每 15° 一条，覆盖 180°） */
const ROUTE_SEARCH_LINES = 12;
/** 找到这么长的全程干地直线就立即采用（米） */
const ROUTE_SEARCH_TARGET_LENGTH = 600;
/** 最多尝试的干地中心数，之后采用已找到的最长直线 */
const ROUTE_SEARCH_MAX_CENTRES = 24;
/** 比这更短的直线不算航线（米） */
const ROUTE_SEARCH_MIN_LENGTH = 60;
/** 确定性航线的航点间距上限（米），与随机航线约 155 米的间距相近 */
const ROUTE_WAYPOINT_SPACING = 160;

export interface PlacementContext {
  readonly playerPosition: THREE.Vector3;
  /** 玩家水平前向（单位向量） */
  readonly forwardX: number;
  readonly forwardZ: number;
  /** 是否有真实地形采样器（无采样器时任何位置都视为合法） */
  readonly hasSampler: boolean;
  readonly surface: SurfaceQuery;
  readonly random: () => number;
}

export interface PlacementResult {
  position: THREE.Vector3;
  heading: number;
  route: THREE.Vector3[] | null;
}

export function clampToBattlefield(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-UNIT_BATTLEFIELD_LIMIT, Math.min(UNIT_BATTLEFIELD_LIMIT, value));
}

/** 航向角（绕 Y）：前方 = (sin h, 0, cos h) */
export function headingFromDirection(dx: number, dz: number): number {
  if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return 0;
  return Math.atan2(dx, dz);
}

function domainMatches(ctx: PlacementContext, domain: UnitDomain, x: number, z: number): boolean {
  if (!ctx.hasSampler || domain === 'air') return true;
  const sample = ctx.surface(x, z, domain);
  return domain === 'sea' ? sample.water : sample.land;
}

/** 空中单位的巡航高度（相对地表与玩家高度） */
export function pickAirAltitude(
  type: UnitType,
  surfaceY: number,
  playerY: number,
  random: () => number
): number {
  const py = Number.isFinite(playerY) ? playerY : 120;
  const sy = Number.isFinite(surfaceY) ? surfaceY : 0;
  switch (type) {
    case UnitType.ATTACK_HELICOPTER:
      return sy + 45 + random() * 30;
    case UnitType.DRONE:
      return Math.max(sy + 40, py - 20 + random() * 50);
    case UnitType.BOMBER:
      return Math.min(480, Math.max(sy + 200, py + 150 + random() * 70));
    case UnitType.ALLY_AWACS:
      return Math.min(500, Math.max(sy + 220, py + 160 + random() * 60));
    case UnitType.ALLY_TRANSPORT:
      return sy + 90 + random() * 40;
    case UnitType.CIVILIAN_AIRLINER:
      return Math.min(470, Math.max(sy + 160, py + 90 + random() * 70));
    default:
      return Math.max(sy + 60, py);
  }
}

/** 在 (cx, cz) 附近寻找符合作战域的点；失败返回 null */
function findNear(
  ctx: PlacementContext,
  domain: UnitDomain,
  cx: number,
  cz: number,
  minRadius: number,
  maxRadius: number,
  attempts: number
): [number, number] | null {
  for (let i = 0; i < attempts; i++) {
    const angle = ctx.random() * Math.PI * 2;
    const radius =
      i === 0 && minRadius === 0 ? 0 : minRadius + ctx.random() * (maxRadius - minRadius);
    const x = clampToBattlefield(cx + Math.cos(angle) * radius);
    const z = clampToBattlefield(cz + Math.sin(angle) * radius);
    if (domainMatches(ctx, domain, x, z)) return [x, z];
  }
  return null;
}

/** 玩家前向在 XZ 平面的方位角（x = cos、z = sin）；前向无效时取缺省 (0,-1) */
function forwardAngle(ctx: PlacementContext): number {
  const fx = ctx.forwardX;
  const fz = ctx.forwardZ;
  if (!Number.isFinite(fx) || !Number.isFinite(fz) || (fx === 0 && fz === 0)) return -Math.PI / 2;
  return Math.atan2(fz, fx);
}

/**
 * 由近到远逐圈访问玩家周围的战场点（不消耗随机数）：每圈从玩家前向方位开始左右交替
 * （0、+1、-1、+2、-2…个方位步），弧长约 arcSpacing 米一个方位、每圈至少 minBearings 个；
 * 战场外的点跳过，半径扫到最远的战场角点为止。accept 返回 true 时停止并返回该点，否则返回 null。
 */
function scanRings(
  ctx: PlacementContext,
  minRadius: number,
  radiusStep: number,
  arcSpacing: number,
  minBearings: number,
  accept: (x: number, z: number) => boolean
): [number, number] | null {
  const limit = UNIT_BATTLEFIELD_LIMIT;
  const px = clampToBattlefield(ctx.playerPosition.x);
  const pz = clampToBattlefield(ctx.playerPosition.z);
  const base = forwardAngle(ctx);
  const maxRadius = Math.hypot(Math.abs(px) + limit, Math.abs(pz) + limit);
  for (let radius = minRadius; radius <= maxRadius; radius += radiusStep) {
    const bearings = Math.max(minBearings, Math.ceil((Math.PI * 2 * radius) / arcSpacing));
    const step = (Math.PI * 2) / bearings;
    for (let k = 0; k < bearings; k++) {
      const offset = (k + 1) >> 1;
      const angle = base + (k % 2 === 1 ? offset : -offset) * step;
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (accept(x, z)) return [x, z];
    }
  }
  return null;
}

/**
 * 确定性外扩扫描（地面单位兜底）：半径从 300 米起每 40 米一圈，直到覆盖整个战场；每圈从玩家前向
 * 方位开始左右交替（弧长约 50 米、至少每 5° 一个方位），返回第一个干地点。
 * 不消耗随机数：同一地形、玩家位置与前向总得到同一点；整个战场都没有干地时返回 null。
 */
export function scanForLand(ctx: PlacementContext): [number, number] | null {
  return scanRings(
    ctx,
    SCAN_MIN_RADIUS,
    SCAN_RADIUS_STEP,
    SCAN_ARC_SPACING,
    SCAN_MIN_BEARINGS,
    (x, z) => domainMatches(ctx, 'ground', x, z)
  );
}

/** 地面集群中心兜底：随机尝试失败后取外扩扫描的第一个干地点（同组单位围绕它散开） */
function groundClusterFallback(ctx: PlacementContext, domain: UnitDomain): [number, number] | null {
  return domain === 'ground' && ctx.hasSampler ? scanForLand(ctx) : null;
}

/** 集群中心：ahead / flank / high-altitude / water 每个部署条目计算一次 */
export function pickClusterCenter(
  ctx: PlacementContext,
  placement: UnitPlacement,
  domain: UnitDomain
): [number, number] | null {
  const { playerPosition: p, forwardX: fx, forwardZ: fz } = ctx;
  const rx = -fz;
  const rz = fx;
  const r = ctx.random;
  switch (placement) {
    case 'ahead': {
      const d = 480 + r() * 170;
      const lateral = (r() - 0.5) * 240;
      return (
        findNear(
          ctx,
          domain,
          p.x + fx * d + rx * lateral,
          p.z + fz * d + rz * lateral,
          0,
          220,
          18
        ) ?? groundClusterFallback(ctx, domain)
      );
    }
    case 'flank': {
      const side = r() < 0.5 ? -1 : 1;
      const d = 380 + r() * 140;
      const fwd = 120 + r() * 160;
      return (
        findNear(
          ctx,
          domain,
          p.x + rx * side * d + fx * fwd,
          p.z + rz * side * d + fz * fwd,
          0,
          220,
          18
        ) ?? groundClusterFallback(ctx, domain)
      );
    }
    case 'high-altitude': {
      const d = 650 + r() * 250;
      const lateral = (r() - 0.5) * 500;
      return [
        clampToBattlefield(p.x + fx * d + rx * lateral),
        clampToBattlefield(p.z + fz * d + rz * lateral),
      ];
    }
    case 'water': {
      // 先在前方半球搜索，失败再全向搜索
      for (let i = 0; i < 48; i++) {
        const forwardBias = i < 24;
        const base = Math.atan2(fz, fx);
        const angle = forwardBias ? base + (r() - 0.5) * Math.PI : r() * Math.PI * 2;
        const d = 300 + r() * (i < 24 ? 450 : 750);
        const x = clampToBattlefield(p.x + Math.cos(angle) * d);
        const z = clampToBattlefield(p.z + Math.sin(angle) * d);
        if (domainMatches(ctx, domain === 'air' ? 'sea' : domain, x, z)) return [x, z];
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * 计算一个单位的出生点（route 放置由 buildRoute 处理）。
 * clusterCenter 为同一部署条目共享的集群中心（around 放置可为 null）。
 */
export function pickUnitPosition(
  ctx: PlacementContext,
  type: UnitType,
  domain: UnitDomain,
  placement: UnitPlacement,
  clusterCenter: [number, number] | null
): THREE.Vector3 | null {
  const p = ctx.playerPosition;
  let xz: [number, number] | null = null;
  if (placement === 'around') {
    for (let i = 0; i < 24 && !xz; i++) {
      const angle = ctx.random() * Math.PI * 2;
      const d = 380 + ctx.random() * 320;
      const x = clampToBattlefield(p.x + Math.cos(angle) * d);
      const z = clampToBattlefield(p.z + Math.sin(angle) * d);
      if (domainMatches(ctx, domain, x, z)) xz = [x, z];
    }
  } else if (clusterCenter) {
    const spread = domain === 'sea' ? 150 : domain === 'air' ? 120 : 110;
    xz = findNear(ctx, domain, clusterCenter[0], clusterCenter[1], 25, spread, 14);
    if (!xz && domainMatches(ctx, domain, clusterCenter[0], clusterCenter[1])) {
      xz = [clusterCenter[0], clusterCenter[1]];
    }
  }
  if (!xz) {
    // 海上单位找不到水面则放弃
    if (domain === 'sea') return null;
    xz = findNear(ctx, domain, p.x, p.z, 300, 800, 24);
    if (!xz && domain === 'ground') {
      // 地面单位：随机尝试失败后做确定性外扩扫描，在扫描点附近散开（散不开就用扫描点本身）；
      // 整个战场都没有干地时放弃
      const anchor = scanForLand(ctx);
      if (!anchor) return null;
      xz = findNear(ctx, domain, anchor[0], anchor[1], 25, 110, 14) ?? anchor;
    }
    // 无采样器或空中单位时 findNear 首次尝试必定成功
    if (!xz) return null;
  }
  const surface = ctx.surface(xz[0], xz[1], domain);
  const y = domain === 'air' ? pickAirAltitude(type, surface.y, p.y, ctx.random) : surface.y;
  return new THREE.Vector3(xz[0], y, xz[1]);
}

/** 线段等分采样（含两端，间距 ≤ step 米）是否全是干地 */
function segmentSamplesOnLand(
  ctx: PlacementContext,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  length: number,
  step: number
): boolean {
  const n = Math.max(1, Math.ceil(length / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!domainMatches(ctx, 'ground', ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/** 线段 (ax,az)→(bx,bz) 是否全程干地：先按 20 米粗查（快速排除），再按 2.5 米细查 */
function segmentOnLand(
  ctx: PlacementContext,
  ax: number,
  az: number,
  bx: number,
  bz: number
): boolean {
  const length = Math.hypot(bx - ax, bz - az);
  if (!Number.isFinite(length)) return false;
  return (
    segmentSamplesOnLand(ctx, ax, az, bx, bz, length, GROUND_ROUTE_CHECK_STEP) &&
    segmentSamplesOnLand(ctx, ax, az, bx, bz, length, GROUND_ROUTE_FINE_STEP)
  );
}

/** 绕行点：在航段中点 40-320 米内随机找一个干地点，使两段都全程干地；失败返回 null */
function findGroundDetour(
  ctx: PlacementContext,
  ax: number,
  az: number,
  bx: number,
  bz: number
): [number, number] | null {
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  for (let i = 0; i < 16; i++) {
    const angle = ctx.random() * Math.PI * 2;
    const radius = 40 + ctx.random() * 280;
    const x = clampToBattlefield(mx + Math.cos(angle) * radius);
    const z = clampToBattlefield(mz + Math.sin(angle) * radius);
    if (
      domainMatches(ctx, 'ground', x, z) &&
      segmentOnLand(ctx, ax, az, x, z) &&
      segmentOnLand(ctx, x, z, bx, bz)
    ) {
      return [x, z];
    }
  }
  return null;
}

/**
 * 从 (cx,cz) 沿 (ux,uz) 每 step 米检查干地：连续干地的延伸距离
 * （step 的整数倍，不超过 maxDistance，出界即止）。
 */
function landReach(
  ctx: PlacementContext,
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  maxDistance: number,
  step: number
): number {
  let reach = 0;
  for (let i = 1; i * step <= maxDistance; i++) {
    const d = i * step;
    const x = cx + ux * d;
    const z = cz + uz * d;
    if (Math.abs(x) > UNIT_BATTLEFIELD_LIMIT || Math.abs(z) > UNIT_BATTLEFIELD_LIMIT) break;
    if (!domainMatches(ctx, 'ground', x, z)) break;
    reach = d;
  }
  return reach;
}

/**
 * 确定性地面航线搜索（不消耗随机数）：从玩家周围由近到远的干地点出发，每个中心按固定方位
 * （先沿随机航线方向 dir，再每 15° 左右交替偏转，共 12 条直线）向两端检查干地、各最多延伸
 * halfLength 米（先 20 米粗查，可能胜出的直线再按 2.5 米细查截短），取全程干地的最长直线：
 * 找到 ≥ 600 米的立即采用，否则最多尝试 24 个中心后取最长者；短于 60 米视为失败（返回 null）。
 * 航点都取在细查过的采样点上。
 */
function searchGroundRoute(
  ctx: PlacementContext,
  dirX: number,
  dirZ: number,
  halfLength: number
): Array<[number, number]> | null {
  const baseAngle = Math.atan2(dirZ, dirX);
  const best = { length: 0, cx: 0, cz: 0, ux: 0, uz: 0, back: 0 };
  let centres = 0;
  scanRings(
    ctx,
    ROUTE_SEARCH_MIN_RADIUS,
    ROUTE_SEARCH_RADIUS_STEP,
    ROUTE_SEARCH_ARC_SPACING,
    ROUTE_SEARCH_MIN_BEARINGS,
    (cx, cz) => {
      if (!domainMatches(ctx, 'ground', cx, cz)) return false;
      centres++;
      for (let k = 0; k < ROUTE_SEARCH_LINES; k++) {
        const offset = (k + 1) >> 1;
        const angle = baseAngle + (k % 2 === 1 ? offset : -offset) * (Math.PI / ROUTE_SEARCH_LINES);
        const ux = Math.cos(angle);
        const uz = Math.sin(angle);
        const coarseAhead = landReach(ctx, cx, cz, ux, uz, halfLength, GROUND_ROUTE_CHECK_STEP);
        const coarseBack = landReach(ctx, cx, cz, -ux, -uz, halfLength, GROUND_ROUTE_CHECK_STEP);
        if (coarseAhead + coarseBack <= best.length) continue;
        const ahead = landReach(ctx, cx, cz, ux, uz, coarseAhead, GROUND_ROUTE_FINE_STEP);
        const back = landReach(ctx, cx, cz, -ux, -uz, coarseBack, GROUND_ROUTE_FINE_STEP);
        if (ahead + back > best.length) {
          best.length = ahead + back;
          best.cx = cx;
          best.cz = cz;
          best.ux = ux;
          best.uz = uz;
          best.back = back;
        }
      }
      return best.length >= ROUTE_SEARCH_TARGET_LENGTH || centres >= ROUTE_SEARCH_MAX_CENTRES;
    }
  );
  if (best.length < ROUTE_SEARCH_MIN_LENGTH) return null;
  const samples = Math.round(best.length / GROUND_ROUTE_FINE_STEP);
  const segments = Math.max(1, Math.ceil(best.length / ROUTE_WAYPOINT_SPACING));
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const d = -best.back + Math.round((i * samples) / segments) * GROUND_ROUTE_FINE_STEP;
    points.push([best.cx + best.ux * d, best.cz + best.uz * d]);
  }
  return points;
}

function pathLength(points: ReadonlyArray<readonly [number, number]>): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  }
  return total;
}

/**
 * 地面航线（有采样器）：
 * 1. 随机航线：沿用穿越玩家前方的候选点，逐点修正到干地；与上一航点之间按 segmentOnLand 检查
 *    （20 米粗查 + 2.5 米细查），穿过水面 / 浅滩 / 熔岩的航段先找绕行点，找不到就跳过该候选点；
 * 2. 随机航线不足两点或短于 300 米：确定性搜索（searchGroundRoute）；
 * 3. 整个战场找不到可用的干地直线：返回 []（调用方跳过生成）。
 */
function buildGroundRoute(
  ctx: PlacementContext,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
  halfLength: number,
  steps: number
): THREE.Vector3[] {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps;
    let x = clampToBattlefield(cx + dx * halfLength * t);
    let z = clampToBattlefield(cz + dz * halfLength * t);
    if (!domainMatches(ctx, 'ground', x, z)) {
      const fixed = findNear(ctx, 'ground', x, z, 30, 260, 16);
      if (!fixed) continue;
      x = fixed[0];
      z = fixed[1];
    }
    if (points.length === 0) {
      points.push([x, z]);
      continue;
    }
    const last = points[points.length - 1];
    if (segmentOnLand(ctx, last[0], last[1], x, z)) {
      points.push([x, z]);
      continue;
    }
    const detour = findGroundDetour(ctx, last[0], last[1], x, z);
    if (detour) points.push(detour, [x, z]);
  }
  const chosen =
    points.length >= 2 && pathLength(points) >= GROUND_ROUTE_MIN_LENGTH
      ? points
      : searchGroundRoute(ctx, dx, dz, halfLength);
  if (!chosen) return [];
  return chosen.map(([x, z]) => new THREE.Vector3(x, ctx.surface(x, z, 'ground').y, z));
}

/**
 * 生成穿越战场的航线：从玩家一侧外 ~650 米处出发，在玩家前方掠过，驶向另一侧。
 * 地面航线全程走干地（有采样器时见 buildGroundRoute），海上航线逐点找水，空中航线保持巡航高度。
 */
export function buildRoute(
  ctx: PlacementContext,
  type: UnitType,
  domain: UnitDomain
): THREE.Vector3[] {
  const p = ctx.playerPosition;
  const r = ctx.random;
  const side = r() < 0.5 ? -1 : 1;
  // 航线方向：大致垂直于玩家前向，带 ±25° 随机
  const skew = (r() - 0.5) * 0.9;
  const fx = ctx.forwardX;
  const fz = ctx.forwardZ;
  const baseRx = -fz * side;
  const baseRz = fx * side;
  const cos = Math.cos(skew);
  const sin = Math.sin(skew);
  const dx = baseRx * cos - baseRz * sin;
  const dz = baseRx * sin + baseRz * cos;
  const offset = domain === 'air' ? 220 + r() * 200 : 160 + r() * 200;
  const halfLength = domain === 'air' ? 1150 : domain === 'sea' ? 760 : 700;
  const cx = p.x + fx * offset;
  const cz = p.z + fz * offset;
  const steps = domain === 'air' ? 4 : 9;
  if (domain === 'ground' && ctx.hasSampler) {
    return buildGroundRoute(ctx, cx, cz, dx, dz, halfLength, steps);
  }
  const altitudeSample = ctx.surface(cx, cz, domain);
  const cruise = domain === 'air' ? pickAirAltitude(type, altitudeSample.y, p.y, r) : 0;
  const route: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps;
    let x = clampToBattlefield(cx + dx * halfLength * t);
    let z = clampToBattlefield(cz + dz * halfLength * t);
    if (domain !== 'air' && ctx.hasSampler && !domainMatches(ctx, domain, x, z)) {
      const fixed = findNear(ctx, domain, x, z, 30, 260, 16);
      if (!fixed) continue;
      x = fixed[0];
      z = fixed[1];
    }
    const surface = ctx.surface(x, z, domain);
    const y = domain === 'air' ? Math.max(cruise, surface.y + 60) : surface.y;
    route.push(new THREE.Vector3(x, y, z));
  }
  if (domain !== 'air' && ctx.hasSampler && route.length >= 2) {
    // 航段中点落在错误地形（例如穿湖）时插入绕行点
    for (let i = route.length - 2; i >= 0; i--) {
      const a = route[i];
      const b = route[i + 1];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      if (domainMatches(ctx, domain, mx, mz)) continue;
      const detour = findNear(ctx, domain, mx, mz, 40, 320, 20);
      if (detour) {
        route.splice(
          i + 1,
          0,
          new THREE.Vector3(detour[0], ctx.surface(detour[0], detour[1], domain).y, detour[1])
        );
      }
    }
  }
  if (route.length < 2) {
    // 海上航线找不到足够的水面点：放弃（调用方跳过生成）
    if (domain === 'sea' && ctx.hasSampler) return [];
    // 兜底：至少两个点，保证护送 / 平民有终点（有采样器的地面航线不走这里，见 buildGroundRoute）
    const a = new THREE.Vector3(
      clampToBattlefield(cx - dx * 300),
      0,
      clampToBattlefield(cz - dz * 300)
    );
    const b = new THREE.Vector3(
      clampToBattlefield(cx + dx * 300),
      0,
      clampToBattlefield(cz + dz * 300)
    );
    a.y = domain === 'air' ? cruise : ctx.surface(a.x, a.z, domain).y;
    b.y = domain === 'air' ? cruise : ctx.surface(b.x, b.z, domain).y;
    return [a, b];
  }
  return route;
}

/**
 * 沿航线折线从起点前进 distance 米处的点（超出终点则取终点）。
 */
export function pointAlongRoute(
  route: readonly THREE.Vector3[],
  distance: number,
  out: THREE.Vector3
): THREE.Vector3 {
  if (route.length === 0) return out.set(0, 0, 0);
  let remaining = Math.max(0, distance);
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const length = a.distanceTo(b);
    if (remaining <= length && length > 1e-6) {
      return out.copy(a).lerp(b, remaining / length);
    }
    remaining -= length;
  }
  return out.copy(route[route.length - 1]);
}

/** 航线总长（米） */
export function routeLength(route: readonly THREE.Vector3[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) total += route[i].distanceTo(route[i + 1]);
  return total;
}
