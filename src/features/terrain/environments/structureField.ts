/**
 * 结构足迹场（structure footprints）：为环境中的“柱状”实体（建筑、塔、石柱、台地、坡道）提供
 * 与可见几何一致的精确顶面高度采样，供 sampleHeight / getCrashSurfaceY / 地面单位落脚使用。
 *
 * 约定：每个图元描述一个自地面向上实心的柱体（没有悬空部分）；sample(x, z) 返回覆盖该点的
 * 所有图元顶面高度的最大值，不在任何足迹内时返回 -Infinity。图元按均匀网格登记，采样只检查
 * 所在网格单元中的少量图元。纯数学，无渲染依赖，可在无 DOM 环境测试。
 */
import type { PolarShape } from './envKit';

/** 正多边形（sides ≥ 3）或圆（sides = 0）的锥台：底面外接半径 r0（高 y0）→ 顶面 r1（高 y1） */
export interface FrustumFootprint {
  kind: 'frustum';
  x: number;
  z: number;
  /** 0 = 圆；≥ 3 = 正多边形（外接半径） */
  sides: number;
  /** 多边形朝向（弧度，绕 Y） */
  yaw: number;
  r0: number;
  r1: number;
  y0: number;
  y1: number;
  /** 顶面之上的尖顶（金字塔 / 圆锥）高度，0 = 平顶 */
  apex: number;
}

/** 有向矩形柱：顶面可带四坡屋脊（roofRise > 0） */
export interface BoxFootprint {
  kind: 'box';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  yaw: number;
  top: number;
  roofRise: number;
}

/** 坡道：沿局部 +Z 从 yStart 线性升到 yEnd（地面单位上台地用） */
export interface RampFootprint {
  kind: 'ramp';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  yaw: number;
  yStart: number;
  yEnd: number;
}

/** 星形轮廓挤出体（台地分层），可带外缘线性坡裙（apronScale > 1） */
export interface PolarFootprint {
  kind: 'polar';
  shape: PolarShape;
  top: number;
  /** 坡裙外缘的归一化半径（1 = 无坡裙） */
  apronScale: number;
  apronBottom: number;
}

/** 椭球穹顶：中心高 base + height，边缘回落到 base */
export interface DomeFootprint {
  kind: 'dome';
  x: number;
  z: number;
  radius: number;
  base: number;
  height: number;
}

export type StructureFootprint =
  | FrustumFootprint
  | BoxFootprint
  | RampFootprint
  | PolarFootprint
  | DomeFootprint;

const CELL = 48;
const KEY_OFFSET = 4096;

function cellKey(ix: number, iz: number): number {
  return (ix + KEY_OFFSET) * 8192 + (iz + KEY_OFFSET);
}

/**
 * 正多边形“半径范数”：点在外接半径为 R 的正多边形边界上时返回 R（sides < 3 时为欧氏距离）。
 * 顶点方位与 THREE.CylinderGeometry 一致：首个顶点位于局部 +Z（x = r·sinθ, z = r·cosθ），
 * 即 atan2 方位 90° + k·扇区角。
 */
export function polygonNorm(lx: number, lz: number, sides: number): number {
  const r = Math.hypot(lx, lz);
  if (sides < 3 || r < 1e-9) {
    return r;
  }
  const sector = (Math.PI * 2) / sides;
  const angle = Math.atan2(lz, lx) - Math.PI / 2;
  // 折算到当前扇区内的角度 [0, sector)，该扇区对应的边法线位于扇区中线
  const t = angle - Math.floor(angle / sector) * sector;
  return (r * Math.cos(t - sector * 0.5)) / Math.cos(sector * 0.5);
}

/** 世界偏移 → 物体局部坐标（与 three 的 rotation.y = yaw 约定一致） */
function toLocal(dx: number, dz: number, yaw: number, out: { x: number; z: number }): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.x = dx * c - dz * s;
  out.z = dx * s + dz * c;
}

const _local = { x: 0, z: 0 };

export class StructureField {
  private readonly items: StructureFootprint[] = [];
  private readonly cells = new Map<number, number[]>();
  /** 全部足迹的最高顶面（粗筛用） */
  private maxTop = -Infinity;

  get count(): number {
    return this.items.length;
  }

  get highestTop(): number {
    return this.maxTop;
  }

  /** 锥台 / 棱柱（r1 = r0）/ 圆柱（sides = 0） */
  addFrustum(options: {
    x: number;
    z: number;
    r0: number;
    r1?: number;
    y0: number;
    y1: number;
    sides?: number;
    yaw?: number;
    apex?: number;
  }): void {
    const r0 = Math.max(0.1, options.r0);
    const r1 = Math.min(r0, Math.max(0, options.r1 ?? r0));
    this.register(
      {
        kind: 'frustum',
        x: options.x,
        z: options.z,
        sides: options.sides ?? 0,
        yaw: options.yaw ?? 0,
        r0,
        r1,
        y0: options.y0,
        y1: options.y1,
        apex: Math.max(0, options.apex ?? 0),
      },
      options.x,
      options.z,
      r0,
      options.y1 + Math.max(0, options.apex ?? 0)
    );
  }

  addBox(options: {
    x: number;
    z: number;
    halfX: number;
    halfZ: number;
    top: number;
    yaw?: number;
    roofRise?: number;
  }): void {
    this.register(
      {
        kind: 'box',
        x: options.x,
        z: options.z,
        halfX: Math.max(0.1, options.halfX),
        halfZ: Math.max(0.1, options.halfZ),
        yaw: options.yaw ?? 0,
        top: options.top,
        roofRise: Math.max(0, options.roofRise ?? 0),
      },
      options.x,
      options.z,
      Math.hypot(options.halfX, options.halfZ),
      options.top + Math.max(0, options.roofRise ?? 0)
    );
  }

  addRamp(options: {
    x: number;
    z: number;
    halfX: number;
    halfZ: number;
    yaw: number;
    yStart: number;
    yEnd: number;
  }): void {
    this.register(
      { kind: 'ramp', ...options },
      options.x,
      options.z,
      Math.hypot(options.halfX, options.halfZ),
      Math.max(options.yStart, options.yEnd)
    );
  }

  addPolar(options: {
    shape: PolarShape;
    top: number;
    apronScale?: number;
    apronBottom?: number;
  }): void {
    const apronScale = Math.max(1, options.apronScale ?? 1);
    let amplitude = 0;
    for (let i = 0; i < 64; i++) {
      amplitude = Math.max(amplitude, options.shape.radiusAt((i / 64) * Math.PI * 2));
    }
    this.register(
      {
        kind: 'polar',
        shape: options.shape,
        top: options.top,
        apronScale,
        apronBottom: options.apronBottom ?? options.top,
      },
      options.shape.centerX,
      options.shape.centerZ,
      amplitude * apronScale * 1.02,
      options.top
    );
  }

  addDome(options: { x: number; z: number; radius: number; base: number; height: number }): void {
    this.register(
      { kind: 'dome', ...options },
      options.x,
      options.z,
      options.radius,
      options.base + options.height
    );
  }

  /** (x, z) 处结构顶面高度；无覆盖返回 -Infinity */
  sample(worldX: number, worldZ: number): number {
    if (this.items.length === 0 || !Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return -Infinity;
    }
    const list = this.cells.get(cellKey(Math.floor(worldX / CELL), Math.floor(worldZ / CELL)));
    if (!list) {
      return -Infinity;
    }
    let best = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const top = this.sampleItem(this.items[list[i]], worldX, worldZ);
      if (top > best) best = top;
    }
    return best;
  }

  private register(
    item: StructureFootprint,
    x: number,
    z: number,
    radius: number,
    top: number
  ): void {
    const index = this.items.length;
    this.items.push(item);
    this.maxTop = Math.max(this.maxTop, top);
    const i0 = Math.floor((x - radius) / CELL);
    const i1 = Math.floor((x + radius) / CELL);
    const j0 = Math.floor((z - radius) / CELL);
    const j1 = Math.floor((z + radius) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const key = cellKey(i, j);
        let list = this.cells.get(key);
        if (!list) {
          list = [];
          this.cells.set(key, list);
        }
        list.push(index);
      }
    }
  }

  private sampleItem(item: StructureFootprint, x: number, z: number): number {
    switch (item.kind) {
      case 'frustum': {
        toLocal(x - item.x, z - item.z, item.yaw, _local);
        const d = polygonNorm(_local.x, _local.z, item.sides);
        if (d > item.r0) return -Infinity;
        if (d <= item.r1) {
          return item.apex > 0 && item.r1 > 0 ? item.y1 + item.apex * (1 - d / item.r1) : item.y1;
        }
        return item.y0 + ((item.y1 - item.y0) * (item.r0 - d)) / Math.max(1e-6, item.r0 - item.r1);
      }
      case 'box': {
        toLocal(x - item.x, z - item.z, item.yaw, _local);
        const ax = Math.abs(_local.x);
        const az = Math.abs(_local.z);
        if (ax > item.halfX || az > item.halfZ) return -Infinity;
        if (item.roofRise <= 0) return item.top;
        const t = Math.max(ax / item.halfX, az / item.halfZ);
        return item.top + item.roofRise * (1 - t);
      }
      case 'ramp': {
        toLocal(x - item.x, z - item.z, item.yaw, _local);
        if (Math.abs(_local.x) > item.halfX || Math.abs(_local.z) > item.halfZ) return -Infinity;
        const t = (_local.z + item.halfZ) / (2 * item.halfZ);
        return item.yStart + (item.yEnd - item.yStart) * t;
      }
      case 'polar': {
        const n = item.shape.normalizedDistance(x, z);
        if (n <= 1) return item.top;
        if (n >= item.apronScale) return -Infinity;
        return (
          item.apronBottom +
          ((item.top - item.apronBottom) * (item.apronScale - n)) / (item.apronScale - 1)
        );
      }
      case 'dome': {
        const d = Math.hypot(x - item.x, z - item.z) / item.radius;
        if (d >= 1) return -Infinity;
        return item.base + item.height * Math.sqrt(1 - d * d);
      }
    }
  }
}
