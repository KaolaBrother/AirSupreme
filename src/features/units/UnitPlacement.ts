import * as THREE from 'three';
import type { UnitPlacement } from './UnitDeployments';
import { UnitType, type UnitDomain } from './UnitTypes';

/**
 * 单位放置与航线生成（纯函数，可在无 DOM 环境测试）。
 *
 * 坐标约定：玩家前方为 forward（XZ 单位向量，缺省 (0,-1)），右侧 right = (-fz, fx)。
 * 所有点钳制在战场范围内；地面单位必须落在陆地、海上单位必须落在水面（有采样器时）。
 */

export interface SurfaceSample {
  y: number;
  water: boolean;
}

/** 地面 / 水面采样：返回值只读，调用方不得保存引用 */
export type SurfaceQuery = (x: number, z: number, domain: UnitDomain) => SurfaceSample;

/** 战场放置范围（与 GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS 对齐，略向内收） */
export const UNIT_BATTLEFIELD_LIMIT = 1300;

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
  return domain === 'sea' ? sample.water : !sample.water;
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
      return findNear(
        ctx,
        domain,
        p.x + fx * d + rx * lateral,
        p.z + fz * d + rz * lateral,
        0,
        220,
        18
      );
    }
    case 'flank': {
      const side = r() < 0.5 ? -1 : 1;
      const d = 380 + r() * 140;
      const fwd = 120 + r() * 160;
      return findNear(
        ctx,
        domain,
        p.x + rx * side * d + fx * fwd,
        p.z + rz * side * d + fz * fwd,
        0,
        220,
        18
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
    // 地面单位兜底：任意陆地；海上单位找不到水面则放弃
    if (domain === 'sea') return null;
    xz = findNear(ctx, domain, p.x, p.z, 300, 800, 24) ?? [
      clampToBattlefield(p.x + ctx.forwardX * 500),
      clampToBattlefield(p.z + ctx.forwardZ * 500),
    ];
  }
  const surface = ctx.surface(xz[0], xz[1], domain);
  const y = domain === 'air' ? pickAirAltitude(type, surface.y, p.y, ctx.random) : surface.y;
  return new THREE.Vector3(xz[0], y, xz[1]);
}

/**
 * 生成穿越战场的航线：从玩家一侧外 ~650 米处出发，在玩家前方掠过，驶向另一侧。
 * 地面航线逐点避水，海上航线逐点找水，空中航线保持巡航高度。
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
    // 兜底：至少两个点，保证护送 / 平民有终点
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
