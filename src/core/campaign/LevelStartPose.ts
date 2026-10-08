import * as THREE from 'three';

/**
 * 关卡出生姿态：原点上空，机头沿各关挑选的航向，高度保证沿航向 1.5 公里的航道（左右各 60 米）
 * 都至少有 40 米净空——开局不操作也不会在 30 秒内撞上山脊 / 火山 / 峡谷壁 / 塔柱。
 *
 * 航向按地形采样挑选（第 2 轮集成测得，见各关注释）；运行时仍逐一校验首选航向，
 * 若地形改动导致首选航向不再安全，就在一圈候选航向里选所需高度最低的一个。
 *
 * 航向约定：0° = 机头朝 -Z（北），90° = 朝 +X（东），顺时针为正。
 */

export interface LevelStartPoseOut {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface LevelStartSpec {
  /** 首选航向（度），依次校验 */
  readonly headings: readonly number[];
}

/** 航道采样：前方距离与左右偏移（米） */
const CORRIDOR_LENGTH = 1500;
const CORRIDOR_STEP = 25;
const CORRIDOR_HALF_WIDTH = 60;
const CORRIDOR_LATERAL_STEP = 20;
/** 航道最高点之上的净空 / 出生点离地高度（米） */
const CORRIDOR_CLEARANCE = 40;
const GROUND_CLEARANCE = 45;
/** 出生高度下限（与旧规则一致：至少在水面以上 48 米） */
const MIN_START_Y = 0;
/** 首选航向可接受的最大离地高度（米）：再高就看不清地面，换航向 */
const MAX_START_AGL = 150;
const FALLBACK_STEP_DEGREES = 15;
const WATER_Y = -48;

/**
 * 各关首选航向（地形采样结果：航道最高点 @ 距离）：
 * 1 湖区：正北越湖，-40@1075 · 2 沙漠：平缓沙丘 · 4 海洋 / 5 城市：开阔（城市沿中央大道）
 * 3 山地：正北 900 米山脊 42 → 偏 10°（-2@1500）
 * 6 火山：火山锥在正北约 900 米（318）→ 50°（32@575），火山留在左前方
 * 7 冰海：正北 1000 米冰山 → 20°（全程开阔水面）
 * 8 峡谷：河道向南笔直（4@650），向北 850 米河道转弯撞崖
 * 9 天梯：正北 600 米塔柱、正南 225 米支柱 → 30°（-19），天梯主干在左前方
 * 10 神谕城：正北是要塞城墙（104@400）→ 320°（-28@1500），核心决战区在右前方
 */
const LEVEL_START_SPECS: Readonly<Record<number, LevelStartSpec>> = {
  1: { headings: [0] },
  2: { headings: [0] },
  3: { headings: [10, 30, 310] },
  4: { headings: [0] },
  5: { headings: [0] },
  6: { headings: [50, 60, 80] },
  7: { headings: [20, 0] },
  8: { headings: [180] },
  9: { headings: [30, 40, 320] },
  10: { headings: [320, 40] },
};

const DEFAULT_SPEC: LevelStartSpec = { headings: [0] };
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function safeHeight(sample: (x: number, z: number) => number, x: number, z: number): number {
  const y = sample(x, z);
  return Number.isFinite(y) ? y : WATER_Y;
}

/** 沿航向的航道最高地表 */
function corridorMax(sample: (x: number, z: number) => number, headingDeg: number): number {
  const rad = THREE.MathUtils.degToRad(headingDeg);
  const fx = Math.sin(rad);
  const fz = -Math.cos(rad);
  const rx = -fz;
  const rz = fx;
  let max = -Infinity;
  for (let d = 0; d <= CORRIDOR_LENGTH; d += CORRIDOR_STEP) {
    for (let l = -CORRIDOR_HALF_WIDTH; l <= CORRIDOR_HALF_WIDTH; l += CORRIDOR_LATERAL_STEP) {
      const y = safeHeight(sample, fx * d + rx * l, fz * d + rz * l);
      if (y > max) max = y;
    }
  }
  return max;
}

/** 某航向的安全出生高度 */
function requiredStartY(
  sample: (x: number, z: number) => number,
  headingDeg: number,
  ground: number
): number {
  return Math.max(
    MIN_START_Y,
    ground + GROUND_CLEARANCE,
    corridorMax(sample, headingDeg) + CORRIDOR_CLEARANCE
  );
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
  const maxY = ground + MAX_START_AGL;
  const preferred = getPreferredStartHeadings(level);

  let heading = preferred[0] ?? 0;
  let startY = Number.POSITIVE_INFINITY;
  let accepted = false;
  for (const candidate of preferred) {
    const y = requiredStartY(sample, candidate, ground);
    if (y < startY) {
      startY = y;
      heading = candidate;
    }
    if (y <= maxY) {
      startY = y;
      heading = candidate;
      accepted = true;
      break;
    }
  }

  if (!accepted) {
    // 首选航向都不安全（地形改动？）：一圈候选里取所需高度最低的航向
    for (let candidate = 0; candidate < 360; candidate += FALLBACK_STEP_DEGREES) {
      const y = requiredStartY(sample, candidate, ground);
      if (y < startY) {
        startY = y;
        heading = candidate;
      }
    }
  }

  if (!Number.isFinite(startY)) {
    startY = Math.max(MIN_START_Y, ground + GROUND_CLEARANCE);
  }
  out.position.set(0, startY, 0);
  // 绕 Y 轴旋转 -heading：机头（局部 -Z）指向 (sin h, 0, -cos h)
  out.quaternion.setFromAxisAngle(Y_AXIS, -THREE.MathUtils.degToRad(heading));
  return heading;
}
