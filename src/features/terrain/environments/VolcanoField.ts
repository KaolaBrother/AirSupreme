/**
 * 火山岛解析场（纯数学，无渲染依赖）：岛屿海岸线、主火山口/次火山锥/渣锥、远景火山岛、
 * 熔岩河（带宽度的折线 → 栅格化有符号距离场）、熔岩湖与火山口熔岩湖。
 *
 * 同一套函数驱动：地形网格顶点、熔岩带网格贴地、地表热度（发光裂纹）、
 * sampleHeight / isWater 采样。所有高度为相对水位的局部高度（世界 Y = 水位 + 局部高度）。
 */
import { Noise2D, smoothstep } from '../worldscape/noise';
import { PolarShape } from './envKit';

export interface VolcanoCone {
  x: number;
  z: number;
  /** 锥体名义高度（局部米，未扣除火山口） */
  height: number;
  /** 锥底半径 */
  radius: number;
  craterRadius: number;
  craterDepth: number;
  /** 火山口内是否有熔岩湖 */
  lavaCrater: boolean;
}

export interface LavaRiverDef {
  /** 折线控制点（世界 XZ），沿流向排列 */
  points: ReadonlyArray<readonly [number, number]>;
  /** 源头 / 末端半宽（米） */
  startHalfWidth: number;
  endHalfWidth: number;
  /** 河道下切深度（米） */
  depth: number;
}

export interface LavaLakeDef {
  x: number;
  z: number;
  radius: number;
}

/** 主火山：位于出生点正前方（-Z）约 900 米，峰顶熔岩湖 */
export const VOLCANO_MAIN_CONE: VolcanoCone = {
  x: 140,
  z: -900,
  height: 470,
  radius: 760,
  craterRadius: 125,
  craterDepth: 95,
  lavaCrater: true,
};

export const VOLCANO_CONES: readonly VolcanoCone[] = [
  VOLCANO_MAIN_CONE,
  // 西侧次火山锥（有熔岩湖）
  {
    x: -860,
    z: 260,
    height: 215,
    radius: 420,
    craterRadius: 60,
    craterDepth: 40,
    lavaCrater: true,
  },
  // 东南渣锥（只冒烟）
  { x: 720, z: 560, height: 110, radius: 280, craterRadius: 34, craterDepth: 20, lavaCrater: false },
  // 远景火山岛（战场之外的剪影）
  {
    x: -1850,
    z: -1500,
    height: 270,
    radius: 430,
    craterRadius: 45,
    craterDepth: 26,
    lavaCrater: false,
  },
  {
    x: 1960,
    z: -1150,
    height: 210,
    radius: 380,
    craterRadius: 38,
    craterDepth: 22,
    lavaCrater: false,
  },
  {
    x: 1760,
    z: 1660,
    height: 180,
    radius: 360,
    craterRadius: 34,
    craterDepth: 18,
    lavaCrater: false,
  },
  {
    x: -1960,
    z: 1360,
    height: 235,
    radius: 400,
    craterRadius: 40,
    craterDepth: 24,
    lavaCrater: false,
  },
];

/** 熔岩河：主火山口西侧溢口 → 西海岸；南侧溢口 → 工厂 → 东海岸；次火山锥 → 南海岸 */
export const VOLCANO_LAVA_RIVERS: readonly LavaRiverDef[] = [
  {
    points: [
      [14, -828],
      [-60, -712],
      [-170, -610],
      [-300, -560],
      [-450, -478],
      [-620, -424],
      [-800, -366],
      [-980, -300],
      [-1160, -236],
      [-1290, -196],
    ],
    startHalfWidth: 13,
    endHalfWidth: 30,
    depth: 6,
  },
  {
    points: [
      [190, -764],
      [228, -640],
      [262, -526],
      [306, -430],
      [372, -330],
      [440, -232],
      [528, -112],
      [642, 26],
      [790, 166],
      [960, 286],
      [1120, 380],
      [1270, 448],
    ],
    startHalfWidth: 12,
    endHalfWidth: 28,
    depth: 6,
  },
  {
    points: [
      [-825, 320],
      [-792, 430],
      [-742, 560],
      [-700, 700],
      [-642, 840],
      [-596, 990],
      [-560, 1120],
    ],
    startHalfWidth: 9,
    endHalfWidth: 20,
    depth: 4,
  },
];

/** 平原熔岩湖：西河道中途 / 兵工厂旁 */
export const VOLCANO_LAVA_LAKES: readonly LavaLakeDef[] = [
  { x: -300, z: -560, radius: 72 },
  { x: 470, z: -330, radius: 56 },
];

/** 兵工厂中心（结构布置用） */
export const VOLCANO_FOUNDRY_CENTER = { x: 640, z: -470 } as const;

interface RiverSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  wa: number;
  wb: number;
  depth: number;
}

/** 有符号距离场栅格：到最近熔岩河岸边的距离（负 = 河道内） */
const SDF_HALF = 2200;
const SDF_CELL = 12;
const SDF_RES = Math.ceil((SDF_HALF * 2) / SDF_CELL) + 1;
const SDF_FAR = 400;

export class VolcanoField {
  readonly coast: PolarShape;
  private readonly noise = new Noise2D(20260606);
  private readonly detail = new Noise2D(20260607);
  private readonly segments: RiverSegment[] = [];
  /** 河岸有符号距离 + 该处河道深度（双栅格） */
  private readonly riverEdge: Float32Array;
  private readonly riverDepth: Float32Array;
  private readonly lakeLevels: number[];
  private readonly craterLavaLevels: Array<number | null>;

  constructor() {
    this.coast = new PolarShape({
      centerX: 0,
      centerZ: -250,
      radius: 1180,
      harmonics: [
        { k: 2, amplitude: 0.06, phase: 0.8 },
        { k: 3, amplitude: 0.07, phase: 2.1 },
        { k: 5, amplitude: 0.04, phase: 4.4 },
        { k: 8, amplitude: 0.025, phase: 1.3 },
        { k: 13, amplitude: 0.012, phase: 5.2 },
      ],
    });

    for (const river of VOLCANO_LAVA_RIVERS) {
      const total = river.points.length - 1;
      for (let i = 0; i < total; i++) {
        const [ax, az] = river.points[i];
        const [bx, bz] = river.points[i + 1];
        const ta = i / total;
        const tb = (i + 1) / total;
        this.segments.push({
          ax,
          az,
          bx,
          bz,
          wa: river.startHalfWidth + (river.endHalfWidth - river.startHalfWidth) * ta,
          wb: river.startHalfWidth + (river.endHalfWidth - river.startHalfWidth) * tb,
          depth: river.depth,
        });
      }
    }

    this.riverEdge = new Float32Array(SDF_RES * SDF_RES).fill(SDF_FAR);
    this.riverDepth = new Float32Array(SDF_RES * SDF_RES);
    this.rasterizeRivers();

    this.lakeLevels = VOLCANO_LAVA_LAKES.map((lake) => this.baseHeight(lake.x, lake.z) - 2.5);
    this.craterLavaLevels = VOLCANO_CONES.map((cone) =>
      cone.lavaCrater ? this.coneRimHeight(cone) + 4 - cone.craterDepth * 0.8 : null
    );
  }

  /** 逐段栅格化：只在每段包围盒（外扩 SDF_FAR）内计算精确距离 */
  private rasterizeRivers(): void {
    for (const segment of this.segments) {
      const pad = SDF_FAR;
      const minX = Math.min(segment.ax, segment.bx) - pad;
      const maxX = Math.max(segment.ax, segment.bx) + pad;
      const minZ = Math.min(segment.az, segment.bz) - pad;
      const maxZ = Math.max(segment.az, segment.bz) + pad;
      const i0 = Math.max(0, Math.floor((minX + SDF_HALF) / SDF_CELL));
      const i1 = Math.min(SDF_RES - 1, Math.ceil((maxX + SDF_HALF) / SDF_CELL));
      const j0 = Math.max(0, Math.floor((minZ + SDF_HALF) / SDF_CELL));
      const j1 = Math.min(SDF_RES - 1, Math.ceil((maxZ + SDF_HALF) / SDF_CELL));
      const dx = segment.bx - segment.ax;
      const dz = segment.bz - segment.az;
      const lengthSq = Math.max(1e-6, dx * dx + dz * dz);
      for (let j = j0; j <= j1; j++) {
        const z = j * SDF_CELL - SDF_HALF;
        for (let i = i0; i <= i1; i++) {
          const x = i * SDF_CELL - SDF_HALF;
          const t = Math.min(1, Math.max(0, ((x - segment.ax) * dx + (z - segment.az) * dz) / lengthSq));
          const px = segment.ax + dx * t;
          const pz = segment.az + dz * t;
          const halfWidth = segment.wa + (segment.wb - segment.wa) * t;
          const edge = Math.hypot(x - px, z - pz) - halfWidth;
          const index = j * SDF_RES + i;
          if (edge < this.riverEdge[index]) {
            this.riverEdge[index] = edge;
            this.riverDepth[index] = segment.depth;
          }
        }
      }
    }
  }

  private sampleGrid(grid: Float32Array, x: number, z: number, outside: number): number {
    const fx = (x + SDF_HALF) / SDF_CELL;
    const fz = (z + SDF_HALF) / SDF_CELL;
    if (fx < 0 || fz < 0 || fx >= SDF_RES - 1 || fz >= SDF_RES - 1) {
      return outside;
    }
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = grid[j * SDF_RES + i];
    const b = grid[j * SDF_RES + i + 1];
    const c = grid[(j + 1) * SDF_RES + i];
    const d = grid[(j + 1) * SDF_RES + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /** 到最近熔岩河岸的有符号距离（米，负 = 河道内） */
  riverEdgeDistance(x: number, z: number): number {
    return this.sampleGrid(this.riverEdge, x, z, SDF_FAR);
  }

  private coneRimHeight(cone: VolcanoCone): number {
    return cone.height * Math.pow(1 - cone.craterRadius / cone.radius, 1.6);
  }

  /** 单个火山锥的附加高度（含火山口碗形与外缘冲沟） */
  private coneHeight(cone: VolcanoCone, x: number, z: number): number {
    const d = Math.hypot(x - cone.x, z - cone.z);
    if (d >= cone.radius) {
      return 0;
    }
    const rim = this.coneRimHeight(cone);
    if (d < cone.craterRadius) {
      const bowl = 1 - (d / cone.craterRadius) ** 2;
      return rim + 4 - cone.craterDepth * Math.pow(bowl, 0.7);
    }
    let h = cone.height * Math.pow(1 - d / cone.radius, 1.6);
    h += 4 * (1 - smoothstep(cone.craterRadius, cone.craterRadius * 1.35, d));
    const gullyMask =
      smoothstep(cone.craterRadius * 1.2, cone.craterRadius * 2.2, d) *
      (1 - smoothstep(cone.radius * 0.55, cone.radius, d));
    if (gullyMask > 0) {
      const ridge = this.noise.ridged(x * 0.011 + cone.x * 0.001, z * 0.011, 3);
      h += (ridge - 0.45) * 30 * gullyMask * (cone.height / 470);
    }
    return h;
  }

  /** 未经熔岩河 / 熔岩湖下切的基础局部高度 */
  baseHeight(x: number, z: number): number {
    const edge = this.coast.edgeDistance(x, z);
    const rolling = this.noise.fbm(x * 0.0016, z * 0.0016, 4);
    const rough = this.detail.fbm(x * 0.006 + 3, z * 0.006 - 7, 3);
    const land = 9 + rolling * 9 + rough * 2.5;
    const cliffiness = smoothstep(0.05, 0.4, this.noise.fbm(x * 0.0012 + 40, z * 0.0012 - 12, 2));
    const coastWidth = 220 + (40 - 220) * cliffiness;
    const landT = smoothstep(coastWidth * 0.25, -coastWidth, edge);
    const seabed = -7 - 41 * smoothstep(0, 650, edge) + rolling * 4;
    let h = seabed + (land - seabed) * landT;
    for (const cone of VOLCANO_CONES) {
      h += this.coneHeight(cone, x, z);
    }
    return h;
  }

  /** 熔岩河在 (x,z) 处的熔岩面局部高度；不在河道内返回 null */
  lavaRiverSurface(x: number, z: number): number | null {
    const edge = this.riverEdgeDistance(x, z);
    if (edge > 1.5) {
      return null;
    }
    const depth = this.sampleGrid(this.riverDepth, x, z, 0);
    return this.baseHeight(x, z) - depth * 0.3;
  }

  /** 最终局部地面高度（含河道与熔岩湖下切；不含熔岩面） */
  groundHeight(x: number, z: number): number {
    let h = this.baseHeight(x, z);
    const edge = this.riverEdgeDistance(x, z);
    if (edge < 14) {
      const depth = this.sampleGrid(this.riverDepth, x, z, 0);
      h -= depth * smoothstep(14, -10, edge);
    }
    for (let i = 0; i < VOLCANO_LAVA_LAKES.length; i++) {
      const lake = VOLCANO_LAVA_LAKES[i];
      const d = Math.hypot(x - lake.x, z - lake.z);
      if (d < lake.radius * 1.35) {
        const basin = this.lakeLevels[i] - 3 * (1 - smoothstep(0, lake.radius, d));
        const blend = smoothstep(lake.radius * 1.35, lake.radius * 0.9, d);
        h = Math.min(h, h + (basin - h) * blend);
      }
    }
    return h;
  }

  /** 平原熔岩湖面局部高度（按 VOLCANO_LAVA_LAKES 顺序） */
  lakeLevel(index: number): number {
    return this.lakeLevels[index] ?? 0;
  }

  /** 火山口熔岩湖面局部高度（按 VOLCANO_CONES 顺序；无熔岩湖为 null） */
  craterLavaLevel(index: number): number | null {
    return this.craterLavaLevels[index] ?? null;
  }

  /** 熔岩（河 / 湖 / 火山口）表面局部高度；不在熔岩上返回 null */
  lavaSurface(x: number, z: number): number | null {
    for (let i = 0; i < VOLCANO_LAVA_LAKES.length; i++) {
      const lake = VOLCANO_LAVA_LAKES[i];
      if (Math.hypot(x - lake.x, z - lake.z) < lake.radius) {
        return this.lakeLevels[i];
      }
    }
    for (let i = 0; i < VOLCANO_CONES.length; i++) {
      const cone = VOLCANO_CONES[i];
      const level = this.craterLavaLevels[i];
      if (level !== null && Math.hypot(x - cone.x, z - cone.z) < cone.craterRadius * 0.6) {
        return level;
      }
    }
    return this.lavaRiverSurface(x, z);
  }

  /** 固体表面局部高度：地面与熔岩面取高者（熔岩视作可落脚、不可航行的表面） */
  surfaceHeight(x: number, z: number): number {
    const ground = this.groundHeight(x, z);
    const lava = this.lavaSurface(x, z);
    return lava === null ? ground : Math.max(ground, lava);
  }

  /**
   * 地表热度 0..1：熔岩河岸、熔岩湖畔、火山口附近与零星的冷却熔岩流。
   * 驱动地形着色器中的发光裂纹与暖色底光。
   */
  heatAt(x: number, z: number): number {
    let heat = smoothstep(95, -2, this.riverEdgeDistance(x, z));
    for (const lake of VOLCANO_LAVA_LAKES) {
      const d = Math.hypot(x - lake.x, z - lake.z);
      heat = Math.max(heat, smoothstep(lake.radius + 90, lake.radius * 0.8, d));
    }
    for (const cone of VOLCANO_CONES) {
      if (!cone.lavaCrater) {
        continue;
      }
      const d = Math.hypot(x - cone.x, z - cone.z);
      heat = Math.max(heat, smoothstep(cone.craterRadius * 1.9, cone.craterRadius * 0.7, d));
    }
    // 尚未冷却的旧熔岩流：零星发光裂纹带
    const flows = smoothstep(0.32, 0.62, this.detail.fbm(x * 0.0022 - 13, z * 0.0022 + 29, 3));
    heat = Math.max(heat, flows * 0.55 * (this.coast.edgeDistance(x, z) < -60 ? 1 : 0));
    return heat;
  }

  /** 岛屿内部（海岸线以内 0 → 1）：沙滩/海床着色、建筑选址用 */
  landFactor(x: number, z: number): number {
    return smoothstep(40, -160, this.coast.edgeDistance(x, z));
  }
}
