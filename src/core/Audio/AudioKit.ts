/**
 * 音乐与音效共用的 Web Audio 小工具。
 *
 * 只依赖 BaseAudioContext，因此既能驱动实时 AudioContext，也能渲染到 OfflineAudioContext
 * 做离线验证。核心路径只使用 createGain / createOscillator / createBiquadFilter /
 * createBuffer / createBufferSource；Delay、DynamicsCompressor、WaveShaper、StereoPanner、
 * Convolver 等节点一律先做特性检测（测试替身通常没有它们），缺失时静默降级。
 */

export type NoiseColor = 'white' | 'pink' | 'brown';

/** 指数包络的下限（exponentialRamp 不能到 0） */
export const MIN_GAIN = 0.0001;

const NOISE_SECONDS = 2;
const NOISE_SEAM_SECONDS = 0.05;
const NOISE_SEEDS: Readonly<Record<NoiseColor, number>> = { white: 101, pink: 202, brown: 303 };

const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColor, AudioBuffer>>>();
const reverbCache = new WeakMap<BaseAudioContext, AudioBuffer | null>();

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

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
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
export function releaseWhenEnded(
  source: AudioScheduledSourceNode,
  nodes: readonly AudioNode[]
): void {
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

/**
 * DynamicsCompressorNode 会按规范自动补偿增益（makeup = (1 / 0dBFS 处的压缩增益)^0.6）。
 * 这里按浏览器的静态曲线（指数软拐点 + 拐点之后的固定压缩比）计算该补偿，
 * 前级用其倒数抵消，使阈值以下的信号保持单位增益（离线实测误差 < 0.1 dB）。
 */
export function estimateCompressorMakeupDb(settings: CompressorSettings): number {
  const thresholdDb = Math.min(0, settings.threshold);
  const slope = 1 / Math.max(1, settings.ratio);
  const kneeEndDb = Math.min(0, thresholdDb + Math.max(0, settings.knee));
  let kneeOutDb = thresholdDb;
  if (kneeEndDb > thresholdDb) {
    const threshold = dbToGain(thresholdDb);
    const kneeEnd = dbToGain(kneeEndDb);
    const curve = (k: number): number => threshold + (1 - Math.exp(-k * (kneeEnd - threshold))) / k;
    const slopeAt = (k: number): number =>
      (Math.exp(-k * (kneeEnd - threshold)) * kneeEnd) / curve(k);
    // 拐点曲线在拐点终点的 dB 斜率随 k 单调下降：几何二分求 k
    let low = 0.1;
    let high = 10000;
    for (let i = 0; i < 60; i++) {
      const mid = Math.sqrt(low * high);
      if (slopeAt(mid) > slope) {
        low = mid;
      } else {
        high = mid;
      }
    }
    kneeOutDb = 20 * Math.log10(curve(Math.sqrt(low * high)));
  }
  const fullScaleOutDb = kneeOutDb + slope * (0 - kneeEndDb);
  return -fullScaleOutDb * 0.6;
}

/** 立体声声像；不支持 StereoPanner 的上下文返回 null */
export function createPanner(ctx: BaseAudioContext, pan: number): StereoPannerNode | null {
  if (typeof ctx.createStereoPanner !== 'function' || !Number.isFinite(pan) || pan === 0) {
    return null;
  }
  try {
    const node = ctx.createStereoPanner();
    node.pan.value = Math.max(-1, Math.min(1, pan));
    return node;
  } catch {
    return null;
  }
}

/**
 * 软削波曲线：|x| ≤ knee 时线性，之上 knee + s·tanh((|x|-knee)/s)（拐点处斜率连续）。
 * WaveShaper 会把 [-1, 1] 之外的输入钳到端点，所以输出峰值永远 ≤ 0.956（约 -0.4 dBFS）。
 */
export function createSoftClipCurve(knee = 0.85, softness = 0.13, size = 2049) {
  // 显式 ArrayBuffer 让类型满足 WaveShaperNode.curve（不接受 SharedArrayBuffer 视图）
  const curve = new Float32Array(new ArrayBuffer(size * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const magnitude = Math.abs(x);
    const y =
      magnitude <= knee ? magnitude : knee + softness * Math.tanh((magnitude - knee) / softness);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** 输出限幅器：快速起音、高压缩比，配合末级软削波保证总线永不硬削波 */
export const OUTPUT_LIMITER: CompressorSettings = {
  threshold: -3,
  knee: 0,
  ratio: 20,
  attack: 0.002,
  release: 0.12,
};

export interface OutputChain {
  /** 链路入口（不支持任何处理节点时就是 destination 本身） */
  input: AudioNode;
  nodes: AudioNode[];
}

/**
 * 总线输出链：补偿增益 → 限幅器 → 软削波 → destination。
 * 任一节点缺失都会跳过，最差情况直接连到 destination。
 */
export function createOutputChain(ctx: BaseAudioContext, destination: AudioNode): OutputChain {
  const nodes: AudioNode[] = [];
  try {
    const trim = ctx.createGain();
    trim.gain.value = dbToGain(-estimateCompressorMakeupDb(OUTPUT_LIMITER));
    nodes.push(trim);
    let tail: AudioNode = trim;
    const limiter = createCompressor(ctx, OUTPUT_LIMITER);
    if (limiter) {
      tail.connect(limiter);
      tail = limiter;
      nodes.push(limiter);
    } else {
      trim.gain.value = 1;
    }
    if (typeof ctx.createWaveShaper === 'function') {
      const clip = ctx.createWaveShaper();
      clip.curve = createSoftClipCurve();
      clip.oversample = 'none';
      tail.connect(clip);
      tail = clip;
      nodes.push(clip);
    }
    tail.connect(destination);
    return { input: trim, nodes };
  } catch {
    disconnectNodes(nodes);
    return { input: destination, nodes: [] };
  }
}

export function supportsConvolver(ctx: BaseAudioContext): boolean {
  return typeof ctx.createConvolver === 'function';
}

/**
 * 程序化混响脉冲响应：立体声去相关噪声 + 指数衰减 + 随时间变暗的一阶低通，
 * 前 60ms 叠加几个离散早期反射。每个上下文只生成一次。
 */
export function getReverbImpulse(ctx: BaseAudioContext, seconds = 2.4): AudioBuffer | null {
  if (reverbCache.has(ctx)) {
    return reverbCache.get(ctx) ?? null;
  }
  let buffer: AudioBuffer | null = null;
  try {
    const sampleRate = ctx.sampleRate > 0 ? ctx.sampleRate : 44100;
    const length = Math.max(1, Math.floor(sampleRate * seconds));
    buffer = ctx.createBuffer(2, length, sampleRate);
    const preDelay = Math.floor(sampleRate * 0.012);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const random = createRandom(4242 + channel * 977);
      let low = 0;
      for (let i = preDelay; i < length; i++) {
        const t = (i - preDelay) / sampleRate;
        const progress = t / seconds;
        const envelope = Math.pow(1 - progress, 2.2) * Math.exp(-t * 2.1);
        // 越往后越暗：低通系数从 0.85 降到 0.12
        const coefficient = 0.85 - 0.73 * Math.min(1, progress * 1.6);
        low += coefficient * (random() * 2 - 1 - low);
        data[i] = low * envelope;
      }
      const taps = [0.019, 0.027, 0.041, 0.053];
      taps.forEach((tap, index) => {
        const position = preDelay + Math.floor(sampleRate * (tap + channel * 0.0031));
        if (position < length) {
          data[position] += (index % 2 === 0 ? 0.55 : -0.42) * (1 - index * 0.15);
        }
      });
    }
  } catch {
    buffer = null;
  }
  reverbCache.set(ctx, buffer);
  return buffer;
}

export interface ReverbBus {
  input: GainNode;
  nodes: AudioNode[];
}

/** 共享混响：发送总线 → 卷积 → 回送增益 → output；不支持卷积时返回 null */
export function createReverbBus(
  ctx: BaseAudioContext,
  output: AudioNode,
  returnGain: number
): ReverbBus | null {
  if (!supportsConvolver(ctx)) {
    return null;
  }
  const impulse = getReverbImpulse(ctx);
  if (!impulse) {
    return null;
  }
  try {
    const input = ctx.createGain();
    const convolver = ctx.createConvolver();
    const wet = ctx.createGain();
    // 送入卷积前先滤掉低频，避免混响发闷
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 180;
    convolver.buffer = impulse;
    wet.gain.value = Math.max(0, returnGain);
    input.connect(highpass);
    highpass.connect(convolver);
    convolver.connect(wet);
    wet.connect(output);
    return { input, nodes: [input, highpass, convolver, wet] };
  } catch {
    return null;
  }
}
