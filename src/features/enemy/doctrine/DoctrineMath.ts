import { Quaternion, Vector3 } from 'three';

/**
 * 条令共用的纯数学工具：方位角、拦截点、散布。全部不分配（结果写入调用方给的对象），
 * 模块级临时量只在单次调用内使用。
 */

const TWO_PI = Math.PI * 2;
const WORLD_UP = new Vector3(0, 1, 0);
const tmpAxis = new Vector3();
const tmpQuaternion = new Quaternion();

/** 把角度折回 [-π, π) */
export function wrapAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let wrapped = (angle + Math.PI) % TWO_PI;
  if (wrapped < 0) wrapped += TWO_PI;
  return wrapped - Math.PI;
}

/** 两个方位角之间的夹角（0..π） */
export function angularDistance(a: number, b: number): number {
  return Math.abs(wrapAngle(a - b));
}

/** 方位角（弧度，绕世界 Y 轴）：从 (fromX, fromZ) 看向 (toX, toZ)；0 = +Z，π/2 = +X */
export function bearingBetween(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

/** 水平单位向量：方位角 → (sin, 0, cos) */
export function directionFromBearing(bearing: number, out: Vector3): Vector3 {
  return out.set(Math.sin(bearing), 0, Math.cos(bearing));
}

/** 两个向量的夹角（弧度，0..π）；任一为零向量时返回 π（视为“完全没对上”） */
export function angleBetween(a: Vector3, b: Vector3): number {
  const lengths = Math.sqrt(a.lengthSq() * b.lengthSq());
  if (!(lengths > 1e-9)) return Math.PI;
  const cos = a.dot(b) / lengths;
  return Math.acos(cos > 1 ? 1 : cos < -1 ? -1 : cos);
}

/** 绕世界 Y 轴旋转（原地修改）：正角度从 +Z 转向 +X */
export function rotateAroundUp(vector: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = vector.x * cos + vector.z * sin;
  const z = vector.z * cos - vector.x * sin;
  vector.x = x;
  vector.z = z;
  return vector;
}

/**
 * 水平侧向单位向量（指向 direction 的右侧：(x, z) → (-z, x)）；direction 接近竖直时
 * 返回 +X。
 */
export function horizontalRight(direction: Vector3, out: Vector3): Vector3 {
  const length = Math.hypot(direction.x, direction.z);
  if (!(length > 1e-6)) return out.set(1, 0, 0);
  return out.set(-direction.z / length, 0, direction.x / length);
}

/**
 * 弹丸以 speed 匀速直线飞行、目标以 (vx, vy, vz) 匀速运动时的拦截时间（秒）：
 * |D + V·t| = speed·t 的最小正根；追不上时返回 NaN。D 为目标相对发射点的位置。
 */
export function interceptTime(
  dx: number,
  dy: number,
  dz: number,
  vx: number,
  vy: number,
  vz: number,
  speed: number
): number {
  const a = vx * vx + vy * vy + vz * vz - speed * speed;
  const b = 2 * (dx * vx + dy * vy + dz * vz);
  const c = dx * dx + dy * dy + dz * dz;
  if (!(speed > 0) || !Number.isFinite(a + b + c)) return Number.NaN;
  if (Math.abs(a) < 1e-6) {
    // 目标速率与弹速相同：一次方程
    return b < -1e-9 ? -c / b : Number.NaN;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Number.NaN;
  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  const low = Math.min(t1, t2);
  const high = Math.max(t1, t2);
  if (low > 0) return low;
  if (high > 0) return high;
  return Number.NaN;
}

/**
 * 瞄准点：目标位置 + 速度 ×（延迟 + 拦截时间）× 提前量系数，写入 out。
 * - delay：开火前还要等的时间（蓄力剩余时间），期间目标继续按当前速度运动
 * - lead：0 = 瞄准当前位置，1 = 完整提前
 * - maxSeconds：预测时间上限（追不上或太远时不再外推）
 */
export function leadPoint(
  origin: Vector3,
  targetPosition: Vector3,
  targetVelocity: Vector3,
  projectileSpeed: number,
  lead: number,
  maxSeconds: number,
  delay: number,
  out: Vector3
): Vector3 {
  out.copy(targetPosition);
  const factor = lead > 1 ? 1 : lead;
  if (!(factor > 0)) return out;
  const wait = delay > 0 ? delay : 0;
  // 蓄力结束时目标所在的位置，再从那里解拦截时间
  const dx = targetPosition.x + targetVelocity.x * wait - origin.x;
  const dy = targetPosition.y + targetVelocity.y * wait - origin.y;
  const dz = targetPosition.z + targetVelocity.z * wait - origin.z;
  let time = interceptTime(
    dx,
    dy,
    dz,
    targetVelocity.x,
    targetVelocity.y,
    targetVelocity.z,
    projectileSpeed
  );
  if (!Number.isFinite(time)) {
    time = projectileSpeed > 0 ? Math.sqrt(dx * dx + dy * dy + dz * dz) / projectileSpeed : 0;
  }
  const total = Math.min(maxSeconds, wait + time) * factor;
  out.addScaledVector(targetVelocity, total);
  if (!Number.isFinite(out.x) || !Number.isFinite(out.y) || !Number.isFinite(out.z)) {
    out.copy(targetPosition);
  }
  return out;
}

/**
 * 瞄准散布（原地修改 direction，保持单位长度）：偏航（绕世界 Y）与俯仰（绕水平侧轴）
 * 各自在 ±spread/2 内均匀分布。
 */
export function scatterDirection(direction: Vector3, spread: number, rng: () => number): Vector3 {
  if (!(spread > 0)) return direction;
  tmpQuaternion.setFromAxisAngle(WORLD_UP, (rng() - 0.5) * spread);
  direction.applyQuaternion(tmpQuaternion);
  tmpAxis.crossVectors(direction, WORLD_UP);
  if (tmpAxis.lengthSq() > 1e-8) {
    tmpQuaternion.setFromAxisAngle(tmpAxis.normalize(), (rng() - 0.5) * spread);
    direction.applyQuaternion(tmpQuaternion);
  }
  return direction.normalize();
}

/** 可复现的随机数来源（mulberry32）：测试 / 回放时注入，替代 Math.random */
export function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
