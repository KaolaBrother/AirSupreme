/**
 * 雷鸣峡谷解析场（纯数学，无渲染依赖）。
 *
 * 地貌：沿 Z 向蜿蜒的三条峡谷——主峡谷（谷底有泥流河与车队土路，中段展宽成摆满孤丘的盆地）、
 * 西侧悬谷、东侧狭缝峡谷；峡谷之间是平顶台地（鳍状山脊），战场东西两侧是更高一级的断崖。
 * 崖壁为阶梯状层理剖面：崖脚碎石坡 → 第一道崖 → 台阶 → 第二道崖 → 窄台阶 → 盖岩崖 → 崖缘。
 *
 * 网格：“特征对齐的曲线网格”——每一行固定 z，列放在剖面断点上（崖顶 / 崖底 / 台阶边缘 /
 * 河岸 / 水线 / 土路边缘），因此崖壁、台阶、河道都与网格线对齐（锐利、无锯齿）。
 * sampleGround() 在同一张三角网上做精确的重心插值：采样高度 = 可见表面高度。
 *
 * 高度均为相对水位的局部高度（世界 Y = 水位 + 局部高度）；河面即水位（局部 0）。
 */
import { Noise2D, smoothstep } from '../worldscape/noise';

/** 顶点类别（着色与布景选址用） */
export const CanyonVertexKind = {
  FLOOR: 0,
  BANK: 1,
  RIVERBED: 2,
  ROAD: 3,
  TALUS: 4,
  CLIFF: 5,
  BENCH: 6,
  RIM: 7,
  PLATEAU: 8,
  ESCARPMENT: 9,
  HIGH_PLATEAU: 10,
} as const;
export type CanyonVertexKindValue = (typeof CanyonVertexKind)[keyof typeof CanyonVertexKind];

/** 台地（峡谷之间与外侧）局部高度 */
export const CANYON_PLATEAU = 150;
/** 外侧高断崖之上的高台地局部高度 */
export const CANYON_HIGH_PLATEAU = 238;
/** 主峡谷谷底局部高度（河面 = 0） */
export const CANYON_MAIN_FLOOR = 7;
const WEST_FLOOR = 24;
const EAST_FLOOR = 15;
/** 网格范围（米）：远超战场，地平线处由雾吞没 */
export const CANYON_GRID_HALF = 3600;
/** 河道：水线处局部高度略低于水面，河床更深 */
const WATER_EDGE_H = -0.25;
const RIVER_BED_H = -3.6;
/** 判定可航行水面的最小水深（米） */
const SAILABLE_DEPTH = 0.5;

/** 一侧崖壁剖面断点数（含谷底边缘与崖缘外沿） */
const WALL_POINTS = 10;

export interface CanyonTroughState {
  /** 谷底中心 x */
  center: number;
  /** 谷底半宽 */
  floorHalf: number;
  /** 谷底局部高度 */
  floor: number;
  /** 西 / 东两侧崖缘外沿 x */
  lipWest: number;
  lipEast: number;
}

export interface CanyonRowState {
  z: number;
  west: CanyonTroughState;
  main: CanyonTroughState;
  east: CanyonTroughState;
  /** 河道中心 x 与水面半宽 */
  riverCenter: number;
  riverHalf: number;
  /** 土路中心 x 与半宽 */
  roadCenter: number;
  roadHalf: number;
  /** 外侧高断崖崖脚 x（西 / 东） */
  escarpmentWest: number;
  escarpmentEast: number;
}

interface WallPoint {
  d: number;
  h: number;
  kind: CanyonVertexKindValue;
}

export class CanyonField {
  /** 行 z 坐标（递增） */
  readonly rowsZ: Float64Array;
  /** 每行列数（所有行相同） */
  readonly columns: number;
  /** 顶点 x / 局部高度 / 类别（行主序） */
  readonly xs: Float32Array;
  readonly hs: Float32Array;
  readonly kinds: Uint8Array;
  /** 主峡谷河道（水线 → 水线）列号与土路列号 */
  readonly riverColumns: readonly [number, number];
  readonly roadColumns: readonly [number, number];
  /** 主峡谷西 / 东崖壁列号范围（谷底边缘 → 崖缘外沿，含两端） */
  readonly mainWallWest: readonly [number, number];
  readonly mainWallEast: readonly [number, number];

  private readonly noise = new Noise2D(20260808);
  private readonly detail = new Noise2D(20260809);

  constructor(rowSpacing = 9) {
    const rows = buildRowPositions(Math.max(4, rowSpacing));
    this.rowsZ = rows;
    // 先构建一行确定列数与关键列号
    const probe: Array<{ x: number; h: number; kind: CanyonVertexKindValue }> = [];
    const marks = this.buildRow(0, probe);
    this.columns = probe.length;
    this.riverColumns = [marks.waterWest, marks.waterEast];
    this.roadColumns = [marks.roadWest, marks.roadEast];
    this.mainWallWest = [marks.mainWallWestLip, marks.mainWallWestFloor];
    this.mainWallEast = [marks.mainWallEastFloor, marks.mainWallEastLip];

    const total = rows.length * this.columns;
    this.xs = new Float32Array(total);
    this.hs = new Float32Array(total);
    this.kinds = new Uint8Array(total);
    const row: Array<{ x: number; h: number; kind: CanyonVertexKindValue }> = [];
    for (let j = 0; j < rows.length; j++) {
      row.length = 0;
      this.buildRow(rows[j], row);
      let previousX = -Infinity;
      for (let i = 0; i < this.columns; i++) {
        const point = row[i];
        // 防御：保证每行 x 严格递增（极端参数下的退化列）
        const x = Math.max(point.x, previousX + 0.05);
        previousX = x;
        const index = j * this.columns + i;
        this.xs[index] = x;
        this.hs[index] = point.h;
        this.kinds[index] = point.kind;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 峡谷布局（沿 z 的一维函数）                                          */
  /* ------------------------------------------------------------------ */

  /** 主峡谷谷底中心线：经过原点（玩家出生点位于谷中） */
  mainCenter(z: number): number {
    return (
      210 * (Math.sin(z * 0.00135 + 0.6) - Math.sin(0.6)) +
      75 * (Math.sin(z * 0.0036 + 2.3) - Math.sin(2.3))
    );
  }

  /** 主峡谷谷底半宽：出生点处为峡谷，前方（-Z）展宽为孤丘盆地，后方另有一处开阔段 */
  mainFloorHalf(z: number): number {
    const basin = 1 - smoothstep(380, 680, Math.abs(z + 900));
    const rear = 1 - smoothstep(260, 480, Math.abs(z - 1250));
    return 92 + 18 * Math.sin(z * 0.0043 + 1.0) + 230 * basin + 110 * rear;
  }

  private sideFloorHalf(z: number, east: boolean): number {
    return east
      ? 38 + 16 * Math.sin(z * 0.0051 + 0.4) + 8 * this.n(z, 0.011, 71)
      : 58 + 22 * Math.sin(z * 0.0029 + 2.6) + 10 * this.n(z, 0.009, 72);
  }

  /** 河道中心相对谷底中心的偏移（谷底宽度的分数，避开东侧土路） */
  private riverFraction(z: number): number {
    return -0.3 + 0.48 * Math.sin(z * 0.0029 + 0.8) + 0.08 * this.n(z, 0.006, 81);
  }

  private riverHalfWidth(z: number): number {
    return 19 + 5 * Math.sin(z * 0.0047 + 1.7) + 2 * this.n(z, 0.02, 82);
  }

  /** 平滑一维噪声 [-1, 1] */
  private n(z: number, frequency: number, seed: number): number {
    return this.noise.noise(z * frequency, seed * 7.31);
  }

  /** 一侧崖壁剖面：自谷底边缘（d = 0）向外到崖缘外沿 */
  private wallProfile(z: number, seed: number, floor: number, out: WallPoint[]): number {
    out.length = 0;
    const talusW = 15 + 5 * this.n(z, 0.004, seed);
    const talusH = 11 + 3 * this.n(z, 0.006, seed + 1);
    const c1W = 5.5 + 1.5 * this.n(z, 0.01, seed + 2);
    const c1H = 34 + 6 * this.n(z, 0.003, seed + 3);
    const b1W = 30 + 22 * this.n(z, 0.0025, seed + 4);
    const c2H = 32 + 5 * this.n(z, 0.0035, seed + 5);
    const b2W = 21 + 13 * this.n(z, 0.003, seed + 6);
    // 每道崖整体前后进退（凹壁 / 扶壁节奏），而非只改变坡度
    const jitter = (k: number): number =>
      4.6 * this.n(z, 0.026, seed + 10 + k) + 1.3 * this.n(z, 0.041, seed + 20 + k);
    const j1 = jitter(1);
    const j2 = jitter(2);
    const j3 = jitter(3);
    const used = talusH + c1H + 4 + c2H + 3;
    const rim = CANYON_PLATEAU;
    const c3H = Math.max(18, rim - floor - used);

    const cliff1Base = Math.max(3, talusW + j1);
    const cliff1Top = cliff1Base + c1W;
    const bench1 = Math.max(4, b1W + j2 - j1);
    const cliff2Base = cliff1Top + bench1;
    const cliff2Top = cliff2Base + 5.5;
    const bench2 = Math.max(4, b2W + j3 - j2);
    const cliff3Base = cliff2Top + bench2;
    const cliff3Top = cliff3Base + 4.5;

    const h1 = floor + talusH;
    const h2 = h1 + c1H;
    const h3 = h2 + 4 + c2H;
    out.push({ d: 0, h: floor + 0.4, kind: CanyonVertexKind.FLOOR });
    out.push({ d: cliff1Base * 0.5, h: floor + talusH * 0.38, kind: CanyonVertexKind.TALUS });
    out.push({ d: cliff1Base, h: h1, kind: CanyonVertexKind.TALUS });
    out.push({ d: cliff1Top, h: h2, kind: CanyonVertexKind.CLIFF });
    out.push({ d: cliff1Top + bench1 * 0.5, h: h2 + 2, kind: CanyonVertexKind.BENCH });
    out.push({ d: cliff2Base, h: h2 + 4, kind: CanyonVertexKind.BENCH });
    out.push({ d: cliff2Top, h: h3, kind: CanyonVertexKind.CLIFF });
    out.push({ d: cliff3Base, h: h3 + 3, kind: CanyonVertexKind.BENCH });
    out.push({ d: cliff3Top, h: floor + used + c3H - 0.8, kind: CanyonVertexKind.RIM });
    const lip = cliff3Top + 12;
    out.push({ d: lip, h: rim, kind: CanyonVertexKind.RIM });
    return lip;
  }

  /** 某一行的峡谷几何状态（布景选址用） */
  rowState(z: number): CanyonRowState {
    const scratch: WallPoint[] = [];
    const mainC = this.mainCenter(z);
    const mainF = this.mainFloorHalf(z);
    const mainWW = this.wallProfile(z, 11, CANYON_MAIN_FLOOR, scratch);
    const mainWE = this.wallProfile(z, 23, CANYON_MAIN_FLOOR, scratch);
    const mainLipW = mainC - mainF - mainWW;
    const mainLipE = mainC + mainF + mainWE;

    const finWest = 175 + 150 * (0.5 + 0.5 * this.n(z, 0.0021, 31));
    const finEast = 165 + 170 * (0.5 + 0.5 * this.n(z, 0.0024, 32));

    const eastF = this.sideFloorHalf(z, true);
    const eastWW = this.wallProfile(z, 41, EAST_FLOOR, scratch);
    const eastWE = this.wallProfile(z, 47, EAST_FLOOR, scratch);
    const eastC = mainLipE + finEast + eastWW + eastF;

    const westF = this.sideFloorHalf(z, false);
    const westWW = this.wallProfile(z, 53, WEST_FLOOR, scratch);
    const westWE = this.wallProfile(z, 59, WEST_FLOOR, scratch);
    const westC = mainLipW - finWest - westWE - westF;

    const riverHalf = this.riverHalfWidth(z);
    const usable = Math.max(0, mainF - riverHalf - 18);
    let riverCenter = mainC + this.riverFraction(z) * usable;
    // 河道东岸之外至少留出土路与路肩
    const roadHalf = 4.5;
    const maxRiver = mainC + mainF - 7 - riverHalf - 2 * roadHalf - 22;
    riverCenter = Math.min(riverCenter, maxRiver);
    riverCenter = Math.max(riverCenter, mainC - mainF + riverHalf + 14);
    const bankEast = riverCenter + riverHalf + 7;
    const floorEdgeEast = mainC + mainF;
    const roadCenter = Math.min(
      floorEdgeEast - 10 - roadHalf,
      bankEast + 8 + roadHalf + Math.max(0, (floorEdgeEast - bankEast - 30) * 0.35)
    );

    const plateauWest = 260 + 220 * (0.5 + 0.5 * this.n(z, 0.0017, 91));
    const plateauEast = 240 + 240 * (0.5 + 0.5 * this.n(z, 0.0019, 92));

    return {
      z,
      west: {
        center: westC,
        floorHalf: westF,
        floor: WEST_FLOOR,
        lipWest: westC - westF - westWW,
        lipEast: westC + westF + westWE,
      },
      main: {
        center: mainC,
        floorHalf: mainF,
        floor: CANYON_MAIN_FLOOR,
        lipWest: mainLipW,
        lipEast: mainLipE,
      },
      east: {
        center: eastC,
        floorHalf: eastF,
        floor: EAST_FLOOR,
        lipWest: eastC - eastF - eastWW,
        lipEast: eastC + eastF + eastWE,
      },
      riverCenter,
      riverHalf,
      roadCenter,
      roadHalf,
      escarpmentWest: westC - westF - westWW - plateauWest,
      escarpmentEast: eastC + eastF + eastWE + plateauEast,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 一行顶点                                                            */
  /* ------------------------------------------------------------------ */

  private plateauHeight(x: number, z: number, base: number): number {
    const swell = this.noise.fbm(x * 0.0021 + 13, z * 0.0021 - 5, 3) * 4.5;
    const grain = this.detail.noise(x * 0.012, z * 0.012) * 1.2;
    return base + swell + grain;
  }

  private floorHeight(x: number, z: number, base: number): number {
    return base + this.detail.fbm(x * 0.008 + 3, z * 0.008 - 9, 2) * 1.1;
  }

  private buildRow(
    z: number,
    out: Array<{ x: number; h: number; kind: CanyonVertexKindValue }>
  ): {
    waterWest: number;
    waterEast: number;
    roadWest: number;
    roadEast: number;
    mainWallWestLip: number;
    mainWallWestFloor: number;
    mainWallEastFloor: number;
    mainWallEastLip: number;
  } {
    const state = this.rowState(z);
    const wall: WallPoint[] = [];
    const push = (x: number, h: number, kind: CanyonVertexKindValue): void => {
      out.push({ x, h, kind });
    };
    const pushWall = (center: number, half: number, floor: number, seed: number, west: boolean) => {
      this.wallProfile(z, seed, floor, wall);
      if (west) {
        for (let k = WALL_POINTS - 1; k >= 0; k--) {
          const p = wall[k];
          const x = center - half - p.d;
          push(x, p.kind === CanyonVertexKind.BENCH ? p.h + this.benchNoise(x, z) : p.h, p.kind);
        }
      } else {
        for (let k = 0; k < WALL_POINTS; k++) {
          const p = wall[k];
          const x = center + half + p.d;
          push(x, p.kind === CanyonVertexKind.BENCH ? p.h + this.benchNoise(x, z) : p.h, p.kind);
        }
      }
    };
    const pushPlateau = (
      x0: number,
      x1: number,
      count: number,
      base: number,
      kind: CanyonVertexKindValue
    ) => {
      for (let k = 1; k <= count; k++) {
        const x = x0 + ((x1 - x0) * k) / (count + 1);
        push(x, this.plateauHeight(x, z, base), kind);
      }
    };

    const { west, main, east } = state;
    const half = CANYON_GRID_HALF;

    // ---- 西侧外缘：高台地 → 高断崖 → 台地 ----
    push(-half, this.plateauHeight(-half, z, CANYON_HIGH_PLATEAU), CanyonVertexKind.HIGH_PLATEAU);
    const escW = state.escarpmentWest;
    const benchW = this.escarpmentBench(z, true);
    pushPlateau(-half, escW - (50 + benchW), 2, CANYON_HIGH_PLATEAU, CanyonVertexKind.HIGH_PLATEAU);
    this.pushEscarpment(escW, benchW, true, push);
    pushPlateau(escW, west.lipWest, 2, CANYON_PLATEAU, CanyonVertexKind.PLATEAU);

    // ---- 西侧悬谷 ----
    pushWall(west.center, west.floorHalf, west.floor, 53, true);
    for (let k = 1; k <= 3; k++) {
      const x = west.center - west.floorHalf + (2 * west.floorHalf * k) / 4;
      const gully = k === 2 ? -1.6 : 0;
      push(x, this.floorHeight(x, z, west.floor) + gully, CanyonVertexKind.FLOOR);
    }
    pushWall(west.center, west.floorHalf, west.floor, 59, false);

    // ---- 西鳍台地 ----
    pushPlateau(west.lipEast, main.lipWest, 4, CANYON_PLATEAU, CanyonVertexKind.PLATEAU);

    // ---- 主峡谷 ----
    const mainWallWestLip = out.length;
    pushWall(main.center, main.floorHalf, main.floor, 11, true);
    const mainWallWestFloor = out.length - 1;
    const floorWest = main.center - main.floorHalf;
    const floorEast = main.center + main.floorHalf;
    const rc = state.riverCenter;
    const rw = state.riverHalf;
    const bankW = rc - rw - 7;
    const bankE = rc + rw + 7;
    const midW = (floorWest + bankW) * 0.5;
    push(midW, this.floorHeight(midW, z, main.floor) + 0.6, CanyonVertexKind.FLOOR);
    push(bankW, main.floor - 0.6, CanyonVertexKind.BANK);
    const waterWest = out.length;
    push(rc - rw, WATER_EDGE_H, CanyonVertexKind.BANK);
    push(rc - rw * 0.5, RIVER_BED_H, CanyonVertexKind.RIVERBED);
    push(rc + rw * 0.5, RIVER_BED_H + 0.4, CanyonVertexKind.RIVERBED);
    const waterEast = out.length;
    push(rc + rw, WATER_EDGE_H, CanyonVertexKind.BANK);
    push(bankE, main.floor - 0.6, CanyonVertexKind.BANK);
    const roadWest = out.length;
    const roadY = main.floor + 0.2;
    push(state.roadCenter - state.roadHalf, roadY, CanyonVertexKind.ROAD);
    const roadEast = out.length;
    push(state.roadCenter + state.roadHalf, roadY, CanyonVertexKind.ROAD);
    const midE = (state.roadCenter + state.roadHalf + floorEast) * 0.5;
    push(midE, this.floorHeight(midE, z, main.floor) + 0.8, CanyonVertexKind.FLOOR);
    const mainWallEastFloor = out.length;
    pushWall(main.center, main.floorHalf, main.floor, 23, false);
    const mainWallEastLip = out.length - 1;

    // ---- 东鳍台地 ----
    pushPlateau(main.lipEast, east.lipWest, 4, CANYON_PLATEAU, CanyonVertexKind.PLATEAU);

    // ---- 东侧狭缝峡谷 ----
    pushWall(east.center, east.floorHalf, east.floor, 41, true);
    for (let k = 1; k <= 3; k++) {
      const x = east.center - east.floorHalf + (2 * east.floorHalf * k) / 4;
      push(x, this.floorHeight(x, z, east.floor) + (k === 2 ? -1.2 : 0), CanyonVertexKind.FLOOR);
    }
    pushWall(east.center, east.floorHalf, east.floor, 47, false);

    // ---- 东侧外缘 ----
    const escE = state.escarpmentEast;
    const benchE = this.escarpmentBench(z, false);
    pushPlateau(east.lipEast, escE, 2, CANYON_PLATEAU, CanyonVertexKind.PLATEAU);
    this.pushEscarpment(escE, benchE, false, push);
    pushPlateau(escE + 50 + benchE, half, 2, CANYON_HIGH_PLATEAU, CanyonVertexKind.HIGH_PLATEAU);
    push(half, this.plateauHeight(half, z, CANYON_HIGH_PLATEAU), CanyonVertexKind.HIGH_PLATEAU);

    return {
      waterWest,
      waterEast,
      roadWest,
      roadEast,
      mainWallWestLip,
      mainWallWestFloor,
      mainWallEastFloor,
      mainWallEastLip,
    };
  }

  private benchNoise(x: number, z: number): number {
    return this.detail.noise(x * 0.03 + 5, z * 0.03) * 1.4;
  }

  private escarpmentBench(z: number, west: boolean): number {
    return 16 + 12 * this.n(z, 0.003, west ? 111 : 112);
  }

  /** 外侧高断崖（台地 → 高台地）：碎石坡 + 两道崖 + 台阶，6 个断点，总宽 50 + bench */
  private pushEscarpment(
    toe: number,
    bench: number,
    west: boolean,
    push: (x: number, h: number, kind: CanyonVertexKindValue) => void
  ): void {
    const steps: Array<[number, number, CanyonVertexKindValue]> = [
      [0, CANYON_PLATEAU + 1, CanyonVertexKind.ESCARPMENT],
      [12, CANYON_PLATEAU + 9, CanyonVertexKind.ESCARPMENT],
      [18, CANYON_PLATEAU + 47, CanyonVertexKind.CLIFF],
      [18 + bench, CANYON_PLATEAU + 51, CanyonVertexKind.BENCH],
      [24 + bench, CANYON_HIGH_PLATEAU - 1, CanyonVertexKind.CLIFF],
      [50 + bench, CANYON_HIGH_PLATEAU, CanyonVertexKind.RIM],
    ];
    if (west) {
      for (let k = steps.length - 1; k >= 0; k--) {
        push(toe - steps[k][0], steps[k][1], steps[k][2]);
      }
    } else {
      for (const [d, h, kind] of steps) {
        push(toe + d, h, kind);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 精确采样（与渲染三角网一致）                                         */
  /* ------------------------------------------------------------------ */

  /** 行区间：返回 j，使 rowsZ[j] ≤ z ≤ rowsZ[j + 1]（钳制到网格内） */
  private findRow(z: number): number {
    const rows = this.rowsZ;
    if (z <= rows[0]) return 0;
    if (z >= rows[rows.length - 1]) return rows.length - 2;
    let lo = 0;
    let hi = rows.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (rows[mid] <= z) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /**
   * (x, z) 处地表局部高度：在渲染用三角网上做重心插值（网格外钳制到边缘）。
   * 四边形 (j,i)-(j,i+1)-(j+1,i)-(j+1,i+1) 沿 (j,i+1)-(j+1,i) 对角线剖分，与 buildGeometry 一致。
   */
  sampleGround(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return CANYON_PLATEAU;
    }
    const cols = this.columns;
    const rows = this.rowsZ;
    const z = Math.min(rows[rows.length - 1], Math.max(rows[0], worldZ));
    const j = this.findRow(z);
    const z0 = rows[j];
    const z1 = rows[j + 1];
    const t = (z - z0) / Math.max(1e-6, z1 - z0);
    const a0 = j * cols;
    const b0 = (j + 1) * cols;
    const xs = this.xs;
    const lerpX = (i: number): number => xs[a0 + i] + (xs[b0 + i] - xs[a0 + i]) * t;
    let x = worldX;
    const xMin = lerpX(0);
    const xMax = lerpX(cols - 1);
    x = Math.min(xMax, Math.max(xMin, x));
    // 列区间二分（插值后的列 x 在每行内单调递增）
    let lo = 0;
    let hi = cols - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lerpX(mid) <= x) lo = mid;
      else hi = mid;
    }
    const i = lo;
    // 三角形顶点
    const ax = xs[a0 + i];
    const ah = this.hs[a0 + i];
    const bx = xs[a0 + i + 1];
    const bh = this.hs[a0 + i + 1];
    const cx = xs[b0 + i];
    const ch = this.hs[b0 + i];
    const dx = xs[b0 + i + 1];
    const dh = this.hs[b0 + i + 1];
    // 对角线 B(z0) → C(z1)：判断点在三角形 ABC 还是 BDC
    const side = (cx - bx) * (z - z0) - (z1 - z0) * (x - bx);
    if (side >= 0) {
      return barycentric(x, z, ax, z0, ah, bx, z0, bh, cx, z1, ch);
    }
    return barycentric(x, z, bx, z0, bh, dx, z1, dh, cx, z1, ch);
  }

  /** 主峡谷河道内且水深足够（可航行 / 落水） */
  isRiver(worldX: number, worldZ: number): boolean {
    return this.sampleGround(worldX, worldZ) < -SAILABLE_DEPTH;
  }

  /** 顶点索引 */
  index(row: number, column: number): number {
    return row * this.columns + column;
  }
}

/** 平面三角形 (P1, P2, P3) 上 (x, z) 处的插值高度（点在三角形外时线性外推） */
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
  const w3 = 1 - w1 - w2;
  return w1 * h1 + w2 * h2 + w3 * h3;
}

/** 行 z 坐标：战场内等距（rowSpacing），外圈逐渐放宽直到 ±CANYON_GRID_HALF */
function buildRowPositions(rowSpacing: number): Float64Array {
  const inner = 1750;
  const positive: number[] = [];
  let z = 0;
  while (z < CANYON_GRID_HALF) {
    positive.push(z);
    const grow = Math.max(0, z - inner) / 400;
    z += rowSpacing * (1 + grow);
  }
  positive.push(CANYON_GRID_HALF);
  const rows: number[] = [];
  for (let k = positive.length - 1; k > 0; k--) rows.push(-positive[k]);
  rows.push(...positive);
  return Float64Array.from(rows);
}
