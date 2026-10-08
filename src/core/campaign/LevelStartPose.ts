import * as THREE from 'three';

/**
 * 关卡出生姿态：原点上空，机头沿各关挑选的航向，高度保证沿航向直到战场硬边界（1.5 公里）、
 * 左右各 150 米的航道都有舒适的净空——开局 600 米内至少 70 米、其后至少 60 米（航道边缘只要求
 * 一半），出生点离地至少 60 米。开局不操作、或开局就小幅转向，都不会撞上山脊 / 火山 / 峡谷壁 /
 * 塔柱 / 冰山。
 *
 * 航道按 10 米网格精细采样（细塔柱与尖塔也采得到）；先用 30 米粗网格（精细网格的子集，所以
 * 粗算高度是精算高度的下界）给一圈候选航向排序，再只精算可能胜出的几个航向。
 * 选择：全部候选航向（首选航向 + 每 10° 一个）里所需高度最低者为基准；各关的首选航向只要比
 * 基准高不超过 30 米就优先采用（保留关卡设计的开场视野），否则用基准航向——
 * 不会为了某个航向把玩家放得过高。
 *
 * 航向约定：0° = 机头朝 -Z（北），90° = 朝 +X（东），顺时针为正。
 */

export interface LevelStartPoseOut {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface LevelStartSpec {
  /** 首选航向（度），按顺序优先 */
  readonly headings: readonly number[];
}

/** 航道：长度（到战场硬边界，玩家飞不出去）、半宽与采样步长（米）；粗步长是细步长的整数倍 */
const CORRIDOR_LENGTH = 1500;
const CORRIDOR_HALF_WIDTH = 150;
const FINE_STEP = 10;
const COARSE_STEP = 30;
/** 净空（米）：开局这段距离内用 NEAR，其后用 FAR；航道边缘只要求 EDGE_RATIO 倍 */
const NEAR_DISTANCE = 600;
const NEAR_CLEARANCE = 70;
const FAR_CLEARANCE = 60;
const EDGE_CLEARANCE_RATIO = 0.5;
/** 分支定界的容差（米）：已找到的航向与理论最优相差不到这么多就停止精算 */
const SEARCH_EPSILON = 5;
/** 出生点离地高度（米） */
const GROUND_CLEARANCE = 60;
/** 出生高度下限（至少在水面以上 48 米） */
const MIN_START_Y = 0;
/** 出生高度上限：软顶界 540 米之下留出余量（只有地形异常时才会碰到） */
const MAX_START_Y = 480;
/** 首选航向最多比最低所需高度高这么多（米）仍然采用 */
const PREFERENCE_TOLERANCE = 30;
const FALLBACK_STEP_DEGREES = 10;
const WATER_Y = -48;

/**
 * 各关首选航向（按顺序优先，见文件头的选择规则）。括号内为实测所需出生高度 y（米）：
 * 1 湖区：正北越湖（16）· 2 沙漠：平缓沙丘（32）· 4 海洋 / 5 城市：开阔，城市沿中央大道（22）
 * 3 山地：正北 1000 米山脊（145）→ 偏 10°（53）
 * 6 火山：火山锥在正北约 900 米；50° / 60° 的航道擦过火山东坡（115 / 61）→ 70°（36），
 *   火山留在左侧
 * 7 冰海：正北 1000 米冰山（104）→ 20°（22，全程开阔水面）
 * 8 峡谷：沿河道向南（141）；峡谷窄于 300 米，任何航向都要越过两侧崖壁
 * 9 天梯：30° 在 700 米处擦过 760 米高的天梯主干 → 40°（51），天梯主干在左前方
 * 10 神谕城：正北是要塞尖塔（237）、320° 擦过城墙塔楼（143）→ 50°（99）/ 310°（116），
 *   核心决战区在左前 / 右前方约 50°
 */
const LEVEL_START_SPECS: Readonly<Record<number, LevelStartSpec>> = {
  1: { headings: [0] },
  2: { headings: [0] },
  3: { headings: [10, 310, 30] },
  4: { headings: [0] },
  5: { headings: [0] },
  6: { headings: [70, 80] },
  7: { headings: [20, 0] },
  8: { headings: [180] },
  9: { headings: [40, 320] },
  10: { headings: [50, 310] },
};

const DEFAULT_SPEC: LevelStartSpec = { headings: [0] };
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function safeHeight(sample: (x: number, z: number) => number, x: number, z: number): number {
  const y = sample(x, z);
  return Number.isFinite(y) ? y : WATER_Y;
}

function normalizeHeading(headingDeg: number): number {
  const wrapped = headingDeg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * 沿航向的航道所需出生高度：max(地表 + 净空)。step 为采样步长（粗 / 细）；
 * 粗网格是细网格的子集，所以粗算结果不高于细算结果。
 * 一旦超过 cutoff 就提前返回（返回值 > cutoff，但不一定是航道的真实最大值）。
 */
function corridorRequirement(
  sample: (x: number, z: number) => number,
  headingDeg: number,
  step: number,
  cutoff: number = Number.POSITIVE_INFINITY
): number {
  const rad = THREE.MathUtils.degToRad(headingDeg);
  const fx = Math.sin(rad);
  const fz = -Math.cos(rad);
  const rx = -fz;
  const rz = fx;
  let required = -Infinity;
  for (let d = 0; d <= CORRIDOR_LENGTH; d += step) {
    const clearance = d <= NEAR_DISTANCE ? NEAR_CLEARANCE : FAR_CLEARANCE;
    for (let l = -CORRIDOR_HALF_WIDTH; l <= CORRIDOR_HALF_WIDTH; l += step) {
      const edge = Math.abs(l) / CORRIDOR_HALF_WIDTH;
      const need =
        safeHeight(sample, fx * d + rx * l, fz * d + rz * l) +
        clearance * (1 - (1 - EDGE_CLEARANCE_RATIO) * edge);
      if (need > required) {
        required = need;
        if (required > cutoff) return required;
      }
    }
  }
  return required;
}

export function getPreferredStartHeadings(level: number): readonly number[] {
  return (LEVEL_START_SPECS[level] ?? DEFAULT_SPEC).headings;
}

/**
 * 计算关卡出生姿态（写入 out），返回所选航向（度）。sample 为坠毁判定用的地表高度。
 */
export function resolveLevelStartPose(
  level: number,
  sample: (x: number, z: number) => number,
  out: LevelStartPoseOut
): number {
  const ground = safeHeight(sample, 0, 0);
  const baseY = Math.max(MIN_START_Y, ground + GROUND_CLEARANCE);
  const preferred = getPreferredStartHeadings(level).map(normalizeHeading);

  const candidates: number[] = [...preferred];
  for (let heading = 0; heading < 360; heading += FALLBACK_STEP_DEGREES) {
    if (!candidates.includes(heading)) candidates.push(heading);
  }

  // 粗算（下界）给候选排序；精算按需计算，只缓存精确值（未被 cutoff 截断的结果）
  const coarse = new Map<number, number>();
  for (const heading of candidates) {
    coarse.set(heading, Math.max(baseY, corridorRequirement(sample, heading, COARSE_STEP)));
  }
  const lowerBound = (heading: number): number => coarse.get(heading) ?? Infinity;
  const exact = new Map<number, number>();
  /** 精算所需高度；超过 cutoff 时返回某个 > cutoff 的值 */
  const fineRequirement = (heading: number, cutoff: number): number => {
    const known = exact.get(heading);
    if (known !== undefined) return known;
    const y = Math.max(baseY, corridorRequirement(sample, heading, FINE_STEP, cutoff));
    if (y <= cutoff) exact.set(heading, y);
    return y;
  };

  // 分支定界：按下界从低到高精算，剩余下界都不比当前最优低 SEARCH_EPSILON 以上时停止
  const ordered = [...candidates].sort((a, b) => lowerBound(a) - lowerBound(b));
  let bestHeading = ordered[0] ?? 0;
  let bestY = Number.POSITIVE_INFINITY;
  for (const heading of ordered) {
    const cutoff = bestY - SEARCH_EPSILON;
    if (lowerBound(heading) >= cutoff) break;
    const y = fineRequirement(heading, cutoff);
    if (y < cutoff) {
      bestY = y;
      bestHeading = heading;
    }
  }

  // 首选航向：所需高度不超过最低值 + PREFERENCE_TOLERANCE 就优先采用
  let heading = bestHeading;
  let startY = bestY;
  const limit = bestY + PREFERENCE_TOLERANCE;
  for (const candidate of preferred) {
    if (lowerBound(candidate) > limit) continue;
    const y = fineRequirement(candidate, limit);
    if (y <= limit) {
      heading = candidate;
      startY = y;
      break;
    }
  }

  if (!Number.isFinite(startY)) {
    startY = baseY;
  }
  startY = Math.min(MAX_START_Y, startY);
  out.position.set(0, startY, 0);
  // 绕 Y 轴旋转 -heading：机头（局部 -Z）指向 (sin h, 0, -cos h)
  out.quaternion.setFromAxisAngle(Y_AXIS, -THREE.MathUtils.degToRad(heading));
  return heading;
}
