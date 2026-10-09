/**
 * 天梯之巅解析场（纯数学，无渲染依赖）。
 *
 * 云海甲板：平流层脚下翻涌的积云顶——两级“蜂窝穹顶”（每个 Voronoi 胞元一个扁圆云包，取最大值）
 * 叠加微弱起伏；战场之外云包越来越高大，地平线方向按行星曲率缓缓下沉（远方云海低于视平线）。
 * 甲板就是本关的“地面”（坠毁面）：它是看得见的实体云顶，飞进云海即坠毁。
 *
 * 网格为直线非均匀网格：战场内等距，外圈逐渐放宽直到地平线；sampleDeck() 在同一张三角网上做
 * 精确的重心插值，保证采样高度 = 可见云顶。
 *
 * 天梯布局（世界坐标）：主干位于出生点正前方，六根支柱环绕主干撑起高空“光环”平台，
 * 六根锚塔立在战场边缘用斜拉索拉住光环；所有悬空构件（光环、辐条、拉索）都在 y ≥ 640 之上，
 * 软顶界（540）以下只有竖直柱体，因此柱状坠毁判定是精确的。
 */
import { mulberry32 } from '../worldscape/noise';
import { smoothstep } from '../worldscape/noise';

/** 行星曲率半径（米，夸张的小值让远方云海落到视平线以下；需保证 4400 米地板范围内仍高于 -96） */
const CURVATURE_RADIUS = 125000;
/** 云海网格半边长（米） */
export const DECK_HALF = 6400;

/** 天梯主干中心（出生点正前方） */
export const SKY_LADDER_CENTER = { x: 0, z: -880 } as const;
/** 主干半径与顶端高度（世界 Y） */
export const TRUNK_RADIUS = 30;
export const TRUNK_TOP_Y = 4600;
/** 支柱 / 光环 */
export const PYLON_RING_RADIUS = 300;
export const PYLON_COUNT = 6;
export const HALO_Y = 748;
/** 锚塔 */
export const ANCHOR_RING_RADIUS = 1100;
export const ANCHOR_TOP_Y = 652;
/** 所有悬空构件的最低高度（世界 Y） */
export const OVERHANG_FLOOR_Y = 640;

export interface DeckLayout {
  /** 支柱位置（世界 XZ）与方位角 */
  pylons: Array<{ x: number; z: number; angle: number }>;
  anchors: Array<{ x: number; z: number; angle: number }>;
}

export function skyLadderLayout(): DeckLayout {
  const pylons: DeckLayout['pylons'] = [];
  const anchors: DeckLayout['anchors'] = [];
  for (let k = 0; k < PYLON_COUNT; k++) {
    const angle = Math.PI / 2 + (k / PYLON_COUNT) * Math.PI * 2;
    pylons.push({
      x: SKY_LADDER_CENTER.x + Math.cos(angle) * PYLON_RING_RADIUS,
      z: SKY_LADDER_CENTER.z + Math.sin(angle) * PYLON_RING_RADIUS,
      angle,
    });
    anchors.push({
      x: SKY_LADDER_CENTER.x + Math.cos(angle) * ANCHOR_RING_RADIUS,
      z: SKY_LADDER_CENTER.z + Math.sin(angle) * ANCHOR_RING_RADIUS,
      angle,
    });
  }
  return { pylons, anchors };
}

/** 整数格点哈希 → [0, 1) */
function hash2(i: number, j: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class StratosphereField {
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  /** 顶点局部高度（行主序：row = z 索引） */
  readonly hs: Float32Array;

  constructor(innerStep = 20) {
    this.xs = buildAxis(1700, Math.max(8, innerStep));
    this.zs = buildAxis(1700, Math.max(8, innerStep));
    const cols = this.xs.length;
    const rows = this.zs.length;
    this.hs = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      const z = this.zs[j];
      for (let i = 0; i < cols; i++) {
        this.hs[j * cols + i] = this.deckHeight(this.xs[i], z);
      }
    }
  }

  get columns(): number {
    return this.xs.length;
  }

  get rows(): number {
    return this.zs.length;
  }

  /**
   * 一级蜂窝穹顶：每个胞元一个扁圆云包（半径、高度、位置由胞元哈希决定），取最大值。
   * flatten 为高度 / 半径之比。
   */
  private domes(x: number, z: number, cell: number, flatten: number, seed: number): number {
    const ci = Math.floor(x / cell);
    const cj = Math.floor(z / cell);
    let best = 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const i = ci + di;
        const j = cj + dj;
        const px = (i + 0.15 + 0.7 * hash2(i, j, seed)) * cell;
        const pz = (j + 0.15 + 0.7 * hash2(j, i, seed + 7)) * cell;
        const radius = cell * (0.62 + 0.38 * hash2(i, j, seed + 13));
        const d = Math.hypot(x - px, z - pz);
        if (d >= radius) continue;
        const t = d / radius;
        const h = radius * flatten * (0.65 + 0.35 * hash2(i, j, seed + 21)) * Math.sqrt(1 - t * t);
        if (h > best) best = h;
      }
    }
    return best;
  }

  /** 云海甲板解析高度（局部米，相对水位） */
  deckHeight(x: number, z: number): number {
    const r = Math.hypot(x, z);
    // 战场之外云包逐渐高大，远方是翻滚的积云丘陵
    const outer = smoothstep(1700, 3600, r);
    const big = this.domes(x, z, 240, 0.11 + 0.17 * outer, 11);
    const medium = this.domes(x + 37, z - 53, 95, 0.16 + 0.1 * outer, 29);
    const small = this.domes(x - 11, z + 23, 38, 0.18, 47);
    const swell = Math.sin(x * 0.0021 + 0.7) * Math.cos(z * 0.0017 - 0.4) * 3;
    const drop = (r * r) / (2 * CURVATURE_RADIUS);
    return 3 + big + medium * 0.75 + small * 0.4 + swell - drop;
  }

  /** (x, z) 处云顶局部高度：渲染三角网上的精确插值（网格外钳制到边缘） */
  sampleDeck(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return 0;
    }
    const xs = this.xs;
    const zs = this.zs;
    const x = Math.min(xs[xs.length - 1], Math.max(xs[0], worldX));
    const z = Math.min(zs[zs.length - 1], Math.max(zs[0], worldZ));
    const i = findInterval(xs, x);
    const j = findInterval(zs, z);
    const cols = xs.length;
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const z0 = zs[j];
    const z1 = zs[j + 1];
    const ha = this.hs[j * cols + i];
    const hb = this.hs[j * cols + i + 1];
    const hc = this.hs[(j + 1) * cols + i];
    const hd = this.hs[(j + 1) * cols + i + 1];
    const u = (x - x0) / Math.max(1e-6, x1 - x0);
    const v = (z - z0) / Math.max(1e-6, z1 - z0);
    // 四边形沿 B(x1,z0) — C(x0,z1) 对角线剖分：u + v ≤ 1 → 三角形 ABC，否则 BDC
    if (u + v <= 1) {
      return ha + (hb - ha) * u + (hc - ha) * v;
    }
    return hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
  }
}

/** 二分查找区间索引 i：axis[i] ≤ value ≤ axis[i + 1] */
function findInterval(axis: Float64Array, value: number): number {
  let lo = 0;
  let hi = axis.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (axis[mid] <= value) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** 对称非均匀轴：|v| ≤ inner 等距 step，外圈每格放大 12% 直到 ±DECK_HALF */
function buildAxis(inner: number, step: number): Float64Array {
  const positive: number[] = [];
  let v = 0;
  let size = step;
  while (v < DECK_HALF) {
    positive.push(v);
    if (v >= inner) size *= 1.12;
    v += size;
  }
  positive.push(DECK_HALF);
  const out: number[] = [];
  for (let k = positive.length - 1; k > 0; k--) out.push(-positive[k]);
  out.push(...positive);
  return Float64Array.from(out);
}

/** 关卡内随机但确定的辅助选址（中继天线等） */
export function stratosphereRng(): () => number {
  return mulberry32(20260909);
}
