/**
 * 神谕核心陨石坑解析场（纯数学，无渲染依赖）。
 *
 * 复杂陨石坑：平坦的坑底 → 三级滑塌台阶的内壁 → 锯齿状坑缘 → 放射状溅射毯外坡。
 * 网格为“坑缘归一化的极坐标网格”：每一圈顶点位于固定的归一化半径 ρ = r / 坑缘半径(θ)，
 * 圈层放在台阶断点上，因此崖壁与台阶沿着起伏的坑缘形成锐利的同心环。
 * sampleGround() 在同一张三角网上做重心插值，保证采样 = 可见地表。
 *
 * 坑底：四条对角方向的熔火裂谷（熔岩带，视作可落脚的表面）与四条正方向的能量导管走廊
 * （地面压平，供导管带与路缘铺设）；中心为黑曜城堡（由 citadelFortress 构建，不在此场中）。
 * 高度为相对水位的局部高度（世界 Y = 水位 + 局部高度）。
 */
import { Noise2D, smoothstep } from '../worldscape/noise';

/** 城堡 / 陨石坑中心（世界 XZ）：位于出生点正前方 */
export const CITADEL_CENTER = { x: 0, z: -700 } as const;
/** 平均坑缘半径（米） */
export const CRATER_RIM_RADIUS = 1460;
/** 坑底局部高度 */
export const CRATER_FLOOR = 8;
/** 熔岩裂谷熔岩面局部高度 */
export const RIFT_LAVA_LEVEL = 6.6;

/** 圈层剖面：[归一化半径 ρ, 局部高度, 类别] */
type RingKind = 'floor' | 'talus' | 'cliff' | 'terrace' | 'crest' | 'outer';
const WALL_PROFILE: ReadonlyArray<readonly [number, number, RingKind]> = [
  [0.745, 12.5, 'talus'],
  [0.76, 24, 'talus'],
  [0.772, 62, 'cliff'],
  [0.8, 68, 'terrace'],
  [0.825, 72, 'terrace'],
  [0.838, 112, 'cliff'],
  [0.865, 117, 'terrace'],
  [0.885, 121, 'terrace'],
  [0.897, 158, 'cliff'],
  [0.93, 172, 'crest'],
  [0.965, 186, 'crest'],
  [1.0, 196, 'crest'],
  [1.03, 191, 'outer'],
  [1.08, 172, 'outer'],
  [1.15, 148, 'outer'],
  [1.25, 120, 'outer'],
  [1.4, 96, 'outer'],
  [1.65, 72, 'outer'],
  [2.0, 58, 'outer'],
  [2.6, 48, 'outer'],
];
const FLOOR_EDGE_RHO = 0.74;
/**
 * 第一圈坑底环：ρ < 0.22 的区域（r ≤ 0.22 × 最大坑缘半径 ≈ 335 米）完全位于城堡台基之下
 * （台基八边形内切半径 ≈ 370 米），不可见，只用一圈近中心环覆盖。
 */
const FLOOR_START_RHO = 0.22;

export interface CitadelFieldOptions {
  /** 方位扇区数（默认 360） */
  sectors?: number;
  /** 坑底圈层间距（归一化半径，默认 0.012 ≈ 17.5 米） */
  floorStep?: number;
}

export const CitadelRingKind = {
  FLOOR: 0,
  TALUS: 1,
  CLIFF: 2,
  TERRACE: 3,
  CREST: 4,
  OUTER: 5,
} as const;

const KIND_CODE: Record<RingKind, number> = {
  floor: CitadelRingKind.FLOOR,
  talus: CitadelRingKind.TALUS,
  cliff: CitadelRingKind.CLIFF,
  terrace: CitadelRingKind.TERRACE,
  crest: CitadelRingKind.CREST,
  outer: CitadelRingKind.OUTER,
};

export interface RiftDef {
  /** 折线点（世界 XZ），自城堡向坑壁 */
  points: Array<[number, number]>;
  /** 起点 / 末端半宽 */
  startHalf: number;
  endHalf: number;
}

/** 导管走廊（四个正方向）：起止半径（自坑心） */
export const CONDUIT_INNER_RADIUS = 520;
export const CONDUIT_OUTER_RADIUS = 1050;
export const CONDUIT_HALF_WIDTH = 7;
/** 正方向角（atan2(z, x) 意义：东、南、西、北） */
export const CONDUIT_ANGLES: readonly number[] = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export class CitadelField {
  readonly sectors: number;
  readonly rhos: Float64Array;
  readonly ringKinds: Uint8Array;
  readonly xs: Float32Array;
  readonly zs: Float32Array;
  readonly hs: Float32Array;
  /** 每个顶点的裂谷热度 0..1（地面着色的发光裂纹） */
  readonly heat: Float32Array;
  readonly rifts: RiftDef[];
  private readonly noise = new Noise2D(20261010);
  private readonly detail = new Noise2D(20261011);
  private readonly ringHeights: Float64Array;

  constructor(options: CitadelFieldOptions = {}) {
    this.sectors = Math.max(48, Math.round(options.sectors ?? 360));
    const floorStep = Math.min(0.04, Math.max(0.006, options.floorStep ?? 0.012));
    this.rifts = buildRifts();
    const rings: Array<readonly [number, number, RingKind]> = [];
    rings.push([0.004, CRATER_FLOOR, 'floor']);
    const floorRings = Math.max(4, Math.round((FLOOR_EDGE_RHO - FLOOR_START_RHO) / floorStep));
    for (let k = 0; k < floorRings; k++) {
      rings.push([
        FLOOR_START_RHO + ((FLOOR_EDGE_RHO - FLOOR_START_RHO) * k) / floorRings,
        CRATER_FLOOR,
        'floor',
      ]);
    }
    rings.push([FLOOR_EDGE_RHO, CRATER_FLOOR + 1.5, 'floor']);
    rings.push(...WALL_PROFILE);
    this.rhos = Float64Array.from(rings.map((r) => r[0]));
    this.ringHeights = Float64Array.from(rings.map((r) => r[1]));
    this.ringKinds = Uint8Array.from(rings.map((r) => KIND_CODE[r[2]]));

    const count = rings.length * this.sectors;
    this.xs = new Float32Array(count);
    this.zs = new Float32Array(count);
    this.hs = new Float32Array(count);
    this.heat = new Float32Array(count);
    for (let k = 0; k < rings.length; k++) {
      for (let s = 0; s < this.sectors; s++) {
        const theta = (s / this.sectors) * Math.PI * 2;
        const r = this.rhos[k] * this.rimRadius(theta);
        const x = CITADEL_CENTER.x + Math.cos(theta) * r;
        const z = CITADEL_CENTER.z + Math.sin(theta) * r;
        const index = k * this.sectors + s;
        this.xs[index] = x;
        this.zs[index] = z;
        this.hs[index] = this.vertexHeight(k, x, z, theta);
        this.heat[index] = this.heatAt(x, z);
      }
    }
  }

  /** 坑缘半径（随方位起伏） */
  rimRadius(theta: number): number {
    return (
      CRATER_RIM_RADIUS *
      (1 +
        0.025 * Math.sin(3 * theta + 0.7) +
        0.012 * Math.sin(7 * theta + 2.1) +
        0.006 * Math.sin(13 * theta + 4))
    );
  }

  /** 到导管走廊中线的距离（米），走廊外返回 Infinity */
  conduitDistance(x: number, z: number): number {
    const dx = x - CITADEL_CENTER.x;
    const dz = z - CITADEL_CENTER.z;
    const r = Math.hypot(dx, dz);
    if (r < CONDUIT_INNER_RADIUS - 60 || r > CONDUIT_OUTER_RADIUS + 80) return Infinity;
    let best = Infinity;
    for (const angle of CONDUIT_ANGLES) {
      const ux = Math.cos(angle);
      const uz = Math.sin(angle);
      const along = dx * ux + dz * uz;
      if (along < 0) continue;
      best = Math.min(best, Math.abs(-dx * uz + dz * ux));
    }
    return best;
  }

  /** 到最近熔岩裂谷边缘的有符号距离（米，负 = 裂谷内） */
  riftEdgeDistance(x: number, z: number): number {
    let best = Infinity;
    for (const rift of this.rifts) {
      const n = rift.points.length - 1;
      for (let i = 0; i < n; i++) {
        const [ax, az] = rift.points[i];
        const [bx, bz] = rift.points[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const lengthSq = Math.max(1e-6, dx * dx + dz * dz);
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / lengthSq));
        const px = ax + dx * t;
        const pz = az + dz * t;
        const half = rift.startHalf + (rift.endHalf - rift.startHalf) * ((i + t) / n);
        best = Math.min(best, Math.hypot(x - px, z - pz) - half);
      }
    }
    return best;
  }

  private heatAt(x: number, z: number): number {
    const edge = this.riftEdgeDistance(x, z);
    let heat = Math.pow(smoothstep(60, -2, edge), 1.6);
    // 坑底零星的冷却熔流：成片的发光细裂纹
    const r = Math.hypot(x - CITADEL_CENTER.x, z - CITADEL_CENTER.z);
    const flows = smoothstep(0.3, 0.62, this.detail.fbm(x * 0.0026 - 7, z * 0.0026 + 3, 3));
    heat = Math.max(heat, flows * 0.38 * (r < CRATER_RIM_RADIUS * 0.72 ? 1 : 0));
    return heat;
  }

  private vertexHeight(ring: number, x: number, z: number, theta: number): number {
    const kind = this.ringKinds[ring];
    let h = this.ringHeights[ring];
    if (kind === CitadelRingKind.FLOOR) {
      const r = Math.hypot(x - CITADEL_CENTER.x, z - CITADEL_CENTER.z);
      // 坑底：缓起伏 + 冷却熔流的低矮压力脊（几十米宽，让平铺的坑底有起伏的切面）+ 冲积扇
      h += this.noise.fbm(x * 0.004, z * 0.004, 3) * 2.4;
      h += (this.detail.ridged(x * 0.0105 + 5, z * 0.0105 - 3, 2) - 0.4) * 4.5;
      h += 4 * smoothstep(0.62, FLOOR_EDGE_RHO, r / this.rimRadius(theta));
      // 导管走廊压平
      const conduit = this.conduitDistance(x, z);
      h += (CRATER_FLOOR + 0.2 - h) * smoothstep(30, 14, conduit);
      // 熔岩裂谷下切成沟：沟底低于熔岩面，熔岩带完整露出，两岸缓坡
      const edge = this.riftEdgeDistance(x, z);
      h -= 5.6 * smoothstep(18, -2, edge);
    } else if (kind === CitadelRingKind.TERRACE || kind === CitadelRingKind.TALUS) {
      h += this.detail.noise(x * 0.02, z * 0.02) * 3.4;
    } else if (kind === CitadelRingKind.CLIFF) {
      // 崖顶参差：几十米尺度的崩落缺口
      h += this.detail.noise(x * 0.026 + 9, z * 0.026 - 4) * 5.5;
    } else if (kind === CitadelRingKind.CREST) {
      h += this.noise.ridged(x * 0.006, z * 0.006, 3) * 16 - 6;
    } else if (kind === CitadelRingKind.OUTER) {
      // 放射状溅射纹：沿方位的脊
      h += (this.noise.ridged(theta * 18, this.rhos[ring] * 3, 2) - 0.4) * 14;
    }
    if (kind !== CitadelRingKind.FLOOR) {
      // 坑壁整体滑塌起伏：沿方位缓慢变化，越高的圈层起伏越大（避免“体育场”般整齐的同心环）
      const slump = this.noise.fbm(Math.cos(theta) * 1.7 + 11, Math.sin(theta) * 1.7 - 5, 3);
      h += slump * 0.11 * (h - CRATER_FLOOR);
    }
    return h;
  }

  /**
   * (x, z) 处地表局部高度：在渲染三角网上做重心插值；熔岩裂谷内取熔岩面（视作可落脚的表面）。
   * 圈层 / 扇区四边形沿 (k, s+1) — (k+1, s) 对角线剖分，与 CitadelEnvironment 的网格一致。
   */
  sampleGround(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return CRATER_FLOOR;
    }
    const dx = worldX - CITADEL_CENTER.x;
    const dz = worldZ - CITADEL_CENTER.z;
    let theta = Math.atan2(dz, dx);
    if (theta < 0) theta += Math.PI * 2;
    const rho = Math.hypot(dx, dz) / this.rimRadius(theta);
    const rhos = this.rhos;
    const sectors = this.sectors;
    const hs = this.hs;
    const sectorF = (theta / (Math.PI * 2)) * sectors;
    const s0 = Math.min(sectors - 1, Math.floor(sectorF));
    const s1 = (s0 + 1) % sectors;
    const lastRing = rhos.length - 1;
    if (rho <= rhos[0]) {
      return hs[s0];
    }
    if (rho >= rhos[lastRing]) {
      // 网格之外：取最外圈两扇区之间的线性插值
      const f = sectorF - s0;
      return hs[lastRing * sectors + s0] * (1 - f) + hs[lastRing * sectors + s1] * f;
    }
    let lo = 0;
    let hi = lastRing;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (rhos[mid] <= rho) lo = mid;
      else hi = mid;
    }
    const k = lo;
    const a = k * sectors + s0;
    const b = k * sectors + s1;
    const c = (k + 1) * sectors + s0;
    const d = (k + 1) * sectors + s1;
    const xs = this.xs;
    const zs = this.zs;
    // 对角线 b — c：点与 a 在同侧 → 三角形 (a, b, c)，否则 (b, d, c)
    const side = (xs[c] - xs[b]) * (worldZ - zs[b]) - (zs[c] - zs[b]) * (worldX - xs[b]);
    const sideA = (xs[c] - xs[b]) * (zs[a] - zs[b]) - (zs[c] - zs[b]) * (xs[a] - xs[b]);
    let ground =
      side * sideA >= 0
        ? barycentric(worldX, worldZ, xs[a], zs[a], hs[a], xs[b], zs[b], hs[b], xs[c], zs[c], hs[c])
        : barycentric(
            worldX,
            worldZ,
            xs[b],
            zs[b],
            hs[b],
            xs[d],
            zs[d],
            hs[d],
            xs[c],
            zs[c],
            hs[c]
          );
    // 熔岩裂谷：熔岩面视作可落脚的表面（与 VOLCANO 一致）
    if (rho > 0.25 && rho < 0.78 && this.nearDiagonal(theta) && this.isRiftLava(worldX, worldZ)) {
      ground = Math.max(ground, RIFT_LAVA_LEVEL);
    }
    return ground;
  }

  /** 方位是否靠近对角线（裂谷所在方位 ± 0.22 弧度）：裂谷距离计算的粗筛 */
  private nearDiagonal(theta: number): boolean {
    const quarter = Math.PI / 2;
    const offset = (((theta - Math.PI / 4) % quarter) + quarter) % quarter;
    return offset < 0.22 || offset > quarter - 0.22;
  }

  /** 是否位于熔岩裂谷熔岩面上 */
  isRiftLava(worldX: number, worldZ: number): boolean {
    return this.riftEdgeDistance(worldX, worldZ) < 0;
  }
}

function barycentric(
  x: number,
  z: number,
  x1: number,
  z1: number,
  h1: number,
  x2: number,
  z2: number,
  h2: number,
  x3: number,
  z3: number,
  h3: number
): number {
  const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
  if (Math.abs(det) < 1e-9) {
    return Math.max(h1, h2, h3);
  }
  const w1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det;
  const w2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det;
  return w1 * h1 + w2 * h2 + (1 - w1 - w2) * h3;
}

/** 四条对角方向的熔岩裂谷（自城堡外缘向坑壁），确定性锯齿折线 */
function buildRifts(): RiftDef[] {
  const rifts: RiftDef[] = [];
  const noise = new Noise2D(4242);
  for (let k = 0; k < 4; k++) {
    const base = Math.PI / 4 + (k * Math.PI) / 2;
    const points: Array<[number, number]> = [];
    const steps = 11;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // 自台基边缘之下（r ≈ 372）流出，延伸到坑壁脚下
      const r = 372 + t * 668;
      const wander = noise.noise(k * 3.1, t * 2.4) * 0.09 + noise.noise(k * 7.7, t * 7) * 0.025;
      const angle = base + wander;
      points.push([CITADEL_CENTER.x + Math.cos(angle) * r, CITADEL_CENTER.z + Math.sin(angle) * r]);
    }
    rifts.push({ points, startHalf: 5, endHalf: 15 });
  }
  return rifts;
}
