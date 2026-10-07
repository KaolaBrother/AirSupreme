/**
 * 音乐与音效共用的 Web Audio 小工具。
 *
 * 只依赖 BaseAudioContext，因此既能驱动实时 AudioContext，也能渲染到 OfflineAudioContext
 * 做离线验证。核心路径只使用 createGain / createOscillator / createBiquadFilter /
 * createBuffer / createBufferSource；Delay、DynamicsCompressor 等节点一律先做特性检测。
 */

export type NoiseColor = 'white' | 'pink' | 'brown';

/** 指数包络的下限（exponentialRamp 不能到 0） */
export const MIN_GAIN = 0.0001;

const NOISE_SECONDS = 2;
const NOISE_SEAM_SECONDS = 0.05;
const NOISE_SEEDS: Readonly<Record<NoiseColor, number>> = { white: 101, pink: 202, brown: 303 };

const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColor, AudioBuffer>>>();

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** 确定性伪随机数（LCG），让离线渲染结果可复现 */
export function createRandom(seed: number): () => number {
  let state = Math.floor(Math.abs(seed)) % 4294967296 || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** 频率保护：NaN / Infinity / 越界都会被钳制，避免 AudioParam 抛错 */
export function safeFrequency(value: number): number {
  if (!Number.isFinite(value)) {
    return 440;
  }
  return Math.max(1, Math.min(20000, value));
}

export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

function generateNoise(count: number, color: NoiseColor, random: () => number): Float32Array {
  const raw = new Float32Array(count);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let last = 0;
  for (let i = 0; i < count; i++) {
    const white = random() * 2 - 1;
    if (color === 'white') {
      raw[i] = white;
    } else if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      raw[i] = b0 + b1 + b2 + white * 0.1848;
    } else {
      last = (last + 0.02 * white) / 1.02;
      raw[i] = last * 3.5;
    }
  }
  return raw;
}

/**
 * 生成可无缝循环的噪声：多生成 seam 个样本，把头部与溢出的尾部交叉淡化，
 * 这样 data[length-1] → data[0] 是同一随机过程的连续样本（布朗噪声循环点不会咔哒）。
 */
function fillLoopableNoise(data: Float32Array, color: NoiseColor, seam: number): void {
  const length = data.length;
  const safeSeam = Math.max(0, Math.min(seam, Math.floor(length / 4)));
  const raw = generateNoise(length + safeSeam, color, createRandom(NOISE_SEEDS[color]));
  let peak = 0;
  for (let i = 0; i < length; i++) {
    let sample = raw[i];
    if (i < safeSeam) {
      const blend = i / safeSeam;
      sample = raw[i] * blend + raw[length + i] * (1 - blend);
    }
    data[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak > 0) {
    const scale = 0.95 / peak;
    for (let i = 0; i < length; i++) {
      data[i] *= scale;
    }
  }
}

/** 每个上下文、每种颜色只生成一次噪声缓冲区（2 秒，可循环） */
export function getNoiseBuffer(ctx: BaseAudioContext, color: NoiseColor = 'white'): AudioBuffer {
  let entry = noiseCache.get(ctx);
  if (!entry) {
    entry = {};
    noiseCache.set(ctx, entry);
  }
  const cached = entry[color];
  if (cached) {
    return cached;
  }
  const sampleRate = ctx.sampleRate > 0 ? ctx.sampleRate : 44100;
  const length = Math.max(1, Math.floor(sampleRate * NOISE_SECONDS));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  fillLoopableNoise(buffer.getChannelData(0), color, Math.floor(sampleRate * NOISE_SEAM_SECONDS));
  entry[color] = buffer;
  return buffer;
}

export interface NoiseSource {
  source: AudioBufferSourceNode;
  /** 随机起始偏移（秒），传给 source.start(when, offset) */
  offset: number;
}

/** 创建一个循环播放的缓存噪声源；调用方负责 start(when, offset) 与 stop(end) */
export function createNoiseSource(
  ctx: BaseAudioContext,
  color: NoiseColor = 'white',
  random: () => number = Math.random
): NoiseSource {
  const buffer = getNoiseBuffer(ctx, color);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const sampleRate = buffer.sampleRate > 0 ? buffer.sampleRate : 44100;
  const seconds = buffer.length / sampleRate;
  return { source, offset: random() * Math.max(0, seconds - 0.1) };
}

export function disconnectNodes(nodes: readonly AudioNode[]): void {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // 已断开
    }
  }
}

/** 最后结束的声源触发 onended 时断开整条声部链路，及时释放节点 */
export function releaseWhenEnded(source: AudioScheduledSourceNode, nodes: readonly AudioNode[]): void {
  source.onended = () => {
    source.onended = null;
    disconnectNodes(nodes);
  };
}

/** 0 → 峰值线性起音，再指数衰减到静音；返回包络结束时间 */
export function applyPercussiveEnvelope(
  param: AudioParam,
  start: number,
  peak: number,
  attack: number,
  decay: number
): number {
  const safeAttack = Math.max(0.001, attack);
  const safeDecay = Math.max(0.005, decay);
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(Math.max(MIN_GAIN, peak), start + safeAttack);
  param.exponentialRampToValueAtTime(MIN_GAIN, start + safeAttack + safeDecay);
  return start + safeAttack + safeDecay;
}

export function supportsDelay(ctx: BaseAudioContext): boolean {
  return typeof ctx.createDelay === 'function';
}

export function supportsCompressor(ctx: BaseAudioContext): boolean {
  return typeof ctx.createDynamicsCompressor === 'function';
}

export interface CompressorSettings {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
}

/** 仅在上下文支持时创建压缩器（测试替身没有 createDynamicsCompressor） */
export function createCompressor(
  ctx: BaseAudioContext,
  settings: CompressorSettings
): DynamicsCompressorNode | null {
  if (!supportsCompressor(ctx)) {
    return null;
  }
  try {
    const node = ctx.createDynamicsCompressor();
    node.threshold.value = settings.threshold;
    node.knee.value = settings.knee;
    node.ratio.value = settings.ratio;
    node.attack.value = settings.attack;
    node.release.value = settings.release;
    return node;
  } catch {
    return null;
  }
}
