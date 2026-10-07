/**
 * 创伤式相机震动（trauma shake）
 *
 * - trauma ∈ [0, 1]：add() 累加并封顶，随时间线性衰减（满创伤约 0.9 s 归零）
 * - 实际幅度 = trauma²（小创伤几乎无感，大创伤剧烈）+ 可选的持续“隆隆”振动（加力抖动）
 * - 六个通道（平移 xyz + 俯仰/偏航/滚转）各自采样确定性平滑值噪声：
 *   不使用 Math.random，也没有每帧分配，便于测试与复现
 */

/** 单帧震动偏移：平移为相机局部坐标（米），旋转为弧度 */
export interface ShakeOffsets {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/** 幅度为 1 时各通道的最大偏移：平移（米）与旋转（弧度） */
export interface ShakeProfile {
  translation: number;
  depth: number;
  pitch: number;
  yaw: number;
  roll: number;
}

/** 每秒衰减的创伤量 */
export const SHAKE_DECAY_PER_SECOND = 1.1;

/** 两个八度的噪声频率（Hz）与权重：低频给“晃”，高频给“抖” */
const LOW_FREQUENCY = 9;
const HIGH_FREQUENCY = 23;
const LOW_WEIGHT = 0.65;
const HIGH_WEIGHT = 0.35;
/** 每个通道独立的噪声种子 */
const CHANNEL_SEEDS = [11, 29, 47, 61, 83, 97] as const;
/** 噪声时钟回绕点：避免长时间运行后整数格点溢出 */
const CLOCK_WRAP_SECONDS = 1_000_000;

/** 整数哈希 → [-1, 1]（Math.imul 保证 32 位整数语义，跨平台确定） */
function hashToSigned(index: number, seed: number): number {
  let h = Math.imul((index | 0) ^ Math.imul(seed, 0x27d4eb2d), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** 一维平滑值噪声：格点哈希 + smoothstep 插值，输出 [-1, 1] */
function valueNoise(t: number, seed: number): number {
  const cell = Math.floor(t);
  const f = t - cell;
  const u = f * f * (3 - 2 * f);
  const a = hashToSigned(cell, seed);
  const b = hashToSigned(cell + 1, seed);
  return a + (b - a) * u;
}

function channelNoise(time: number, seed: number): number {
  return (
    LOW_WEIGHT * valueNoise(time * LOW_FREQUENCY, seed) +
    HIGH_WEIGHT * valueNoise(time * HIGH_FREQUENCY, seed + 7919)
  );
}

export class CameraShake {
  private trauma = 0;
  private rumble = 0;
  private time = 0;

  /** 累加创伤（0..1，封顶 1）；非有限值或非正值忽略 */
  public add(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity <= 0) {
      return;
    }
    this.trauma = Math.min(1, this.trauma + intensity);
  }

  /** 持续振动幅度（0..1），每帧设置；不衰减 */
  public setRumble(amount: number): void {
    this.rumble = Number.isFinite(amount) ? Math.min(1, Math.max(0, amount)) : 0;
  }

  /** 推进噪声时钟并衰减创伤 */
  public update(deltaTime: number): void {
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
    this.time += dt;
    if (this.time > CLOCK_WRAP_SECONDS) {
      this.time = 0;
    }
    this.trauma = Math.max(0, this.trauma - SHAKE_DECAY_PER_SECOND * dt);
  }

  public getTrauma(): number {
    return this.trauma;
  }

  /** 当前震动幅度：trauma² + rumble，封顶 1 */
  public getAmplitude(): number {
    return Math.min(1, this.trauma * this.trauma + this.rumble);
  }

  /** 按 profile 采样本帧偏移写入 out（幅度为 0 时全部归零） */
  public sample(profile: ShakeProfile, out: ShakeOffsets): ShakeOffsets {
    const amplitude = this.getAmplitude();
    if (amplitude <= 0) {
      out.x = 0;
      out.y = 0;
      out.z = 0;
      out.pitch = 0;
      out.yaw = 0;
      out.roll = 0;
      return out;
    }
    const t = this.time;
    out.x = channelNoise(t, CHANNEL_SEEDS[0]) * profile.translation * amplitude;
    out.y = channelNoise(t, CHANNEL_SEEDS[1]) * profile.translation * amplitude;
    out.z = channelNoise(t, CHANNEL_SEEDS[2]) * profile.depth * amplitude;
    out.pitch = channelNoise(t, CHANNEL_SEEDS[3]) * profile.pitch * amplitude;
    out.yaw = channelNoise(t, CHANNEL_SEEDS[4]) * profile.yaw * amplitude;
    out.roll = channelNoise(t, CHANNEL_SEEDS[5]) * profile.roll * amplitude;
    return out;
  }

  public reset(): void {
    this.trauma = 0;
    this.rumble = 0;
  }
}
