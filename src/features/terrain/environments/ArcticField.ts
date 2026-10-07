/**
 * 极夜冰海解析场（纯数学，无渲染依赖）：
 * - 北侧 / 东侧冰架（星形轮廓、平顶、垂直冰崖）
 * - 平顶冰山（tabular）与尖顶冰山（pinnacle，径向剖面 + 角向噪声）
 * - 漂移浮冰（位置由 ArcticEnvironment 每帧推进）。浮冰薄而小、随时间移动，
 *   船只可破冰穿行，因此不参与 surfaceHeight / isOpenWater（采样结果与时间无关、可复现）；
 *   需要时可用 floeTop() 单独查询。
 *
 * 所有高度为相对水位的局部高度（世界 Y = 水位 + 局部高度）。
 */
import { Noise2D } from '../worldscape/noise';
import { mulberry32, PolarShape } from './envKit';

export type IceFeatureKind = 'shelf' | 'tabular' | 'pinnacle';

export interface IceFeature {
  kind: IceFeatureKind;
  shape: PolarShape;
  /** 顶面局部高度（尖顶冰山为峰高） */
  top: number;
  /** 水下吃水深度（米，网格裙边用） */
  draft: number;
  /** 前哨站等结构的落脚标记 */
  outpost?: boolean;
}

export interface DriftingFloe {
  x: number;
  z: number;
  /** 包围半径（米） */
  radius: number;
  rotation: number;
  spin: number;
  speed: number;
  bobPhase: number;
  variant: number;
}

/** 浮冰顶面高出水面的高度（米） */
export const FLOE_FREEBOARD = 1.3;
/** 远海海床（局部米） */
const SEABED = -70;

export class ArcticField {
  readonly features: IceFeature[] = [];
  readonly floes: DriftingFloe[] = [];
  private readonly noise = new Noise2D(20260707);

  constructor(floeCount: number) {
    const rng = mulberry32(20260707);
    const add = (
      kind: IceFeatureKind,
      x: number,
      z: number,
      radius: number,
      top: number,
      roughness: number,
      outpost = false
    ): void => {
      this.features.push({
        kind,
        shape: PolarShape.random(rng, x, z, radius, roughness),
        top,
        draft: kind === 'shelf' ? 60 : Math.max(12, top * 0.6),
        outpost,
      });
    };

    // 冰架：北岸与东岸（中心在战场外，只露出蜿蜒的冰崖海岸线）
    add('shelf', -200, -2700, 1450, 34, 0.07, true);
    add('shelf', 2620, 520, 1260, 30, 0.08, true);

    // 平顶冰山（部分驻有前哨站）
    add('tabular', -640, -430, 150, 30, 0.14, true);
    add('tabular', 540, -760, 118, 26, 0.16);
    add('tabular', -1000, 400, 178, 34, 0.13, true);
    add('tabular', 760, 540, 108, 24, 0.17);
    add('tabular', -300, 920, 128, 28, 0.15);
    add('tabular', 1080, -170, 92, 22, 0.18);
    add('tabular', -1280, -800, 160, 38, 0.13);

    // 尖顶冰山
    add('pinnacle', -790, -60, 74, 118, 0.2);
    add('pinnacle', 250, 650, 56, 72, 0.22);
    add('pinnacle', 1250, 840, 82, 128, 0.2);
    add('pinnacle', -1460, 180, 92, 150, 0.18);
    add('pinnacle', 950, -1020, 70, 96, 0.2);
    add('pinnacle', -80, -990, 66, 104, 0.2);
    add('pinnacle', 420, -330, 44, 58, 0.24);
    // 远景冰山剪影（战场外）
    add('pinnacle', -1950, -1250, 120, 170, 0.18);
    add('pinnacle', 2000, -1500, 110, 150, 0.18);
    add('pinnacle', 1700, 1850, 130, 160, 0.18);
    add('pinnacle', -1800, 1700, 120, 140, 0.18);
    add('pinnacle', 300, 2050, 110, 130, 0.18);

    // 漂移浮冰：出生点 300 米内保持开阔水面
    for (let i = 0; i < floeCount; i++) {
      let x = 0;
      let z = 0;
      for (let attempt = 0; attempt < 30; attempt++) {
        x = (rng() - 0.5) * 3200;
        z = (rng() - 0.5) * 3000 + 100;
        if (Math.hypot(x, z) > 300 && this.staticIceTop(x, z, 30) === null) break;
      }
      const big = rng() < 0.25;
      this.floes.push({
        x,
        z,
        radius: big ? 24 + rng() * 22 : 7 + rng() * 14,
        rotation: rng() * Math.PI * 2,
        spin: (rng() - 0.5) * 0.02,
        speed: 0.6 + rng() * 0.9,
        bobPhase: rng() * Math.PI * 2,
        variant: Math.floor(rng() * 3),
      });
    }
  }

  /** 尖顶冰山的局部高度（d 为归一化径向距离 0..1） */
  pinnacleHeight(feature: IceFeature, x: number, z: number, normalized: number): number {
    const profile = Math.pow(Math.max(0, 1 - Math.pow(normalized, 1.5)), 0.85);
    const facets = this.noise.ridged(x * 0.035, z * 0.035, 2);
    return feature.top * profile * (0.82 + 0.28 * facets);
  }

  /**
   * 静态冰体（冰架 / 冰山）在 (x,z) 处的顶面局部高度；不在冰上返回 null。
   * margin > 0 时把轮廓外扩 margin 米（选址避让用）。
   */
  staticIceTop(x: number, z: number, margin = 0): number | null {
    let top: number | null = null;
    for (const feature of this.features) {
      if (!feature.shape.mayOverlap(x, z, margin)) continue;
      const edge = feature.shape.edgeDistance(x, z);
      if (edge > margin) continue;
      let h: number;
      if (feature.kind === 'pinnacle') {
        const normalized = feature.shape.normalizedDistance(x, z);
        h = this.pinnacleHeight(feature, x, z, Math.min(1, normalized));
      } else {
        h = feature.top;
      }
      top = top === null ? h : Math.max(top, h);
    }
    return top;
  }

  /** 漂移浮冰在 (x,z) 处的顶面局部高度；不在浮冰上返回 null */
  floeTop(x: number, z: number): number | null {
    for (const floe of this.floes) {
      const dx = x - floe.x;
      const dz = z - floe.z;
      if (dx * dx + dz * dz < floe.radius * floe.radius * 0.72) {
        return FLOE_FREEBOARD;
      }
    }
    return null;
  }

  /** 固体冰面局部高度（冰架 / 冰山）；开阔水域返回海床（SEABED）。浮冰不计入 */
  surfaceHeight(x: number, z: number): number {
    return this.staticIceTop(x, z) ?? SEABED;
  }

  /** 是否为可航行海面（无冰架 / 冰山；漂移浮冰可破冰穿行） */
  isOpenWater(x: number, z: number): boolean {
    return this.staticIceTop(x, z) === null;
  }

  /** 到最近静态冰体边缘的距离（米，负 = 冰内）——水面浅滩/浪沫烘焙用 */
  iceEdgeDistance(x: number, z: number): number {
    let best = Infinity;
    for (const feature of this.features) {
      if (!feature.shape.mayOverlap(x, z, 120)) continue;
      best = Math.min(best, feature.shape.edgeDistance(x, z));
    }
    return best;
  }

  /** 冰架顶面积雪起伏（局部高度增量，仅视觉用；不改变采样顶面） */
  snowDrift(x: number, z: number): number {
    return this.noise.fbm(x * 0.004, z * 0.012, 3);
  }
}
