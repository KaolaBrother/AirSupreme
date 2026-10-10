import type { WaveArrival } from '@/features/terrain/LevelConfig';

/**
 * 波次到场编排（纯函数，随机数由调用方传入）：
 * 按到场方式算出本波各路敌机群的中心——一群同来 / 鱼贯而入是一个中心，
 * 两路夹击是两个中心，从玩家看相隔 90–150°。
 */

/** 群中心距玩家的距离（米）：600–800 */
export const WAVE_GROUP_MIN_DISTANCE = 600;
export const WAVE_GROUP_DISTANCE_RANGE = 200;
/** 夹击两路从玩家看的夹角范围（度） */
export const PINCER_MIN_ANGLE_DEG = 90;
export const PINCER_MAX_ANGLE_DEG = 150;
/** 鱼贯而入：相邻两架的出场间隔（秒）——敌机一架接一架到场，而不是一起出现 */
export const TRAIL_SPAWN_INTERVAL = 2.5;

const GROUP_CENTER_ATTEMPTS = 12;
const PINCER_ATTEMPTS = 16;
/** 随机尝试都落到界外时，按这个步长（度）扫一圈方位 */
const SCAN_STEP_DEG = 5;
const SCAN_STEPS = 360 / SCAN_STEP_DEG;
const DEG_TO_RAD = Math.PI / 180;

export interface IWaveGroupCenter {
  x: number;
  z: number;
}

/** 扫描方位时的暂存（模块级复用，不在波次开场时分配） */
const scanInBounds = new Uint8Array(SCAN_STEPS);

function isInBounds(x: number, z: number, limit: number): boolean {
  return Math.abs(x) <= limit && Math.abs(z) <= limit;
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function randomDistance(rng: () => number): number {
  return WAVE_GROUP_MIN_DISTANCE + rng() * WAVE_GROUP_DISTANCE_RANGE;
}

/**
 * 单个群中心：距玩家 600–800 米，且落在 ±limit 以内。
 * 玩家靠近战场边缘时朝外的方向会落到界外——只在界内的方向里选，
 * 都不行时改为从玩家朝战场中心方向（玩家在中心附近时任选方向）。
 */
function placeSingleCenter(
  px: number,
  pz: number,
  limit: number,
  rng: () => number,
  out: IWaveGroupCenter
): void {
  for (let attempt = 0; attempt < GROUP_CENTER_ATTEMPTS; attempt++) {
    const angle = rng() * Math.PI * 2;
    const distance = randomDistance(rng);
    const x = px + Math.cos(angle) * distance;
    const z = pz + Math.sin(angle) * distance;
    if (isInBounds(x, z, limit)) {
      out.x = x;
      out.z = z;
      return;
    }
  }

  const toCenter = Math.hypot(px, pz);
  const dirX = toCenter > 1 ? -px / toCenter : 1;
  const dirZ = toCenter > 1 ? -pz / toCenter : 0;
  const distance = WAVE_GROUP_MIN_DISTANCE + WAVE_GROUP_DISTANCE_RANGE / 2;
  out.x = clamp(px + dirX * distance, limit);
  out.z = clamp(pz + dirZ * distance, limit);
}

/**
 * 夹击的两个群中心：两路从玩家看相隔 90–150°，都在界内。
 * 先随机取；玩家贴着边 / 角、随机取不到时扫一圈方位，取夹角最接近 120° 的一对
 * （角落里界内的扇面不足 90° 时退而取能做到的最大夹角）。
 */
function placePincerCenters(
  px: number,
  pz: number,
  limit: number,
  rng: () => number,
  first: IWaveGroupCenter,
  second: IWaveGroupCenter
): void {
  const spread = PINCER_MAX_ANGLE_DEG - PINCER_MIN_ANGLE_DEG;
  for (let attempt = 0; attempt < PINCER_ATTEMPTS; attempt++) {
    const bearing = rng() * Math.PI * 2;
    const separation = (PINCER_MIN_ANGLE_DEG + rng() * spread) * DEG_TO_RAD;
    const otherBearing = bearing + (rng() < 0.5 ? separation : -separation);
    const firstDistance = randomDistance(rng);
    const secondDistance = randomDistance(rng);
    const x1 = px + Math.cos(bearing) * firstDistance;
    const z1 = pz + Math.sin(bearing) * firstDistance;
    const x2 = px + Math.cos(otherBearing) * secondDistance;
    const z2 = pz + Math.sin(otherBearing) * secondDistance;
    if (isInBounds(x1, z1, limit) && isInBounds(x2, z2, limit)) {
      first.x = x1;
      first.z = z1;
      second.x = x2;
      second.z = z2;
      return;
    }
  }

  // 兜底：用最近的距离扫一圈（离玩家越近越容易落在界内）
  const distance = WAVE_GROUP_MIN_DISTANCE;
  let inBoundsCount = 0;
  for (let step = 0; step < SCAN_STEPS; step++) {
    const angle = step * SCAN_STEP_DEG * DEG_TO_RAD;
    const ok = isInBounds(px + Math.cos(angle) * distance, pz + Math.sin(angle) * distance, limit);
    scanInBounds[step] = ok ? 1 : 0;
    if (ok) inBoundsCount++;
  }
  if (inBoundsCount === 0) {
    // 玩家自己就在界外：两路都从战场中心方向来（退化成一群）
    placeSingleCenter(px, pz, limit, rng, first);
    second.x = first.x;
    second.z = first.z;
    return;
  }

  const target = (PINCER_MIN_ANGLE_DEG + PINCER_MAX_ANGLE_DEG) / 2;
  let bestFirst = -1;
  let bestSecond = -1;
  let bestScore = -Infinity;
  for (let a = 0; a < SCAN_STEPS; a++) {
    if (scanInBounds[a] === 0) continue;
    for (let b = a; b < SCAN_STEPS; b++) {
      if (scanInBounds[b] === 0) continue;
      const raw = (b - a) * SCAN_STEP_DEG;
      const separation = raw > 180 ? 360 - raw : raw;
      const outside = Math.max(
        0,
        PINCER_MIN_ANGLE_DEG - separation,
        separation - PINCER_MAX_ANGLE_DEG
      );
      const score = -outside * 1000 - Math.abs(separation - target);
      if (score > bestScore) {
        bestScore = score;
        bestFirst = a;
        bestSecond = b;
      }
    }
  }
  // 哪一路在哪一侧不固定
  if (rng() < 0.5) {
    const swap = bestFirst;
    bestFirst = bestSecond;
    bestSecond = swap;
  }
  const firstAngle = bestFirst * SCAN_STEP_DEG * DEG_TO_RAD;
  const secondAngle = bestSecond * SCAN_STEP_DEG * DEG_TO_RAD;
  first.x = px + Math.cos(firstAngle) * distance;
  first.z = pz + Math.sin(firstAngle) * distance;
  second.x = px + Math.cos(secondAngle) * distance;
  second.z = pz + Math.sin(secondAngle) * distance;
}

/**
 * 算出本波各路的群中心，写入 out（至少两个元素），返回路数：夹击 2，其余 1。
 * @param limit 群中心坐标绝对值的上限（战场半边长减去群内散布半径）
 * @param rng 返回 [0, 1) 的随机数
 */
export function planWaveGroupCenters(
  arrival: WaveArrival,
  playerX: number,
  playerZ: number,
  limit: number,
  rng: () => number,
  out: IWaveGroupCenter[]
): number {
  const px = Number.isFinite(playerX) ? playerX : 0;
  const pz = Number.isFinite(playerZ) ? playerZ : 0;
  if (arrival === 'pincer') {
    placePincerCenters(px, pz, limit, rng, out[0], out[1]);
    return 2;
  }
  placeSingleCenter(px, pz, limit, rng, out[0]);
  return 1;
}

/** 从玩家看两个群中心的夹角（度，0–180） */
export function getGroupSeparationDeg(
  playerX: number,
  playerZ: number,
  first: IWaveGroupCenter,
  second: IWaveGroupCenter
): number {
  const a = Math.atan2(first.z - playerZ, first.x - playerX);
  const b = Math.atan2(second.z - playerZ, second.x - playerX);
  let diff = Math.abs(a - b) / DEG_TO_RAD;
  if (diff > 180) diff = 360 - diff;
  return diff;
}
