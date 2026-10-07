/**
 * 音效合成小工具：分层的一次性声部（带滑音 / 滤波扫频 / 颤音 / 震音的振荡器、滤波噪声、FM 金属音）。
 * 每个声部在最后一个声源结束时自动断开；所有可选节点（StereoPanner 等）都做特性检测。
 * 只依赖 BaseAudioContext，可离线渲染验证。
 */
import {
  MIN_GAIN,
  createNoiseSource,
  createPanner,
  disconnectNodes,
  safeFrequency,
  type NoiseColor,
} from '../AudioKit';

export interface SfxTarget {
  ctx: BaseAudioContext;
  /** 本次音效的输出总线 */
  out: AudioNode;
  /** 起始时间（上下文时钟） */
  t: number;
  /** 整体电平（音效音量） */
  level: number;
  random: () => number;
}

export interface EnvelopeShape {
  /** 相对 t 的偏移（秒） */
  at?: number;
  attack?: number;
  hold?: number;
  decay: number;
  peak: number;
  /** 衰减曲线，缺省指数 */
  curve?: 'exp' | 'lin';
}

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  /** 扫频终点（缺省不扫） */
  freqEnd?: number;
  /** 扫频时长（缺省整段包络） */
  sweep?: number;
  q?: number;
}

export interface Modulation {
  /** LFO 频率（Hz） */
  rate: number;
  /** 震音：0..1 振幅深度；颤音：频率偏移（Hz） */
  depth: number;
  /** LFO 频率的终点（例如多普勒下降的旋翼节奏） */
  rateEnd?: number;
  shape?: OscillatorType;
}

export interface ToneSpec extends EnvelopeShape {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  /** 滑音时长（缺省整段包络） */
  glide?: number;
  glideCurve?: 'exp' | 'lin';
  filter?: FilterSpec;
  vibrato?: Modulation;
  tremolo?: Modulation;
  pan?: number;
}

export interface NoiseSpec extends EnvelopeShape {
  color?: NoiseColor;
  filter?: FilterSpec;
  tremolo?: Modulation;
  pan?: number;
  /** 播放速率（<1 更低沉） */
  rate?: number;
}

export interface FmSpec extends EnvelopeShape {
  freq: number;
  /** 调制器 / 载波频率比 */
  ratio: number;
  /** 调制指数（相对载波频率） */
  index: number;
  indexEnd?: number;
  pan?: number;
}

interface VoiceParts {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

function applyEnvelope(
  param: AudioParam,
  start: number,
  shape: EnvelopeShape,
  level: number
): number {
  const attack = Math.max(0.001, shape.attack ?? 0.004);
  const hold = Math.max(0, shape.hold ?? 0);
  const decay = Math.max(0.008, shape.decay);
  const peak = Math.max(MIN_GAIN, shape.peak * level);
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + attack);
  if (hold > 0) {
    param.setValueAtTime(peak, start + attack + hold);
  }
  const end = start + attack + hold + decay;
  if (shape.curve === 'lin') {
    param.linearRampToValueAtTime(0, end);
  } else {
    param.exponentialRampToValueAtTime(MIN_GAIN, end);
  }
  return end;
}

function rampFrequency(
  param: AudioParam,
  from: number,
  to: number | undefined,
  start: number,
  end: number,
  curve: 'exp' | 'lin' = 'exp'
): void {
  param.setValueAtTime(safeFrequency(from), start);
  if (to === undefined) {
    return;
  }
  const target = safeFrequency(to);
  const when = Math.max(start + 0.001, end);
  if (curve === 'lin') {
    param.linearRampToValueAtTime(target, when);
  } else {
    param.exponentialRampToValueAtTime(target, when);
  }
}

function createFilter(
  ctx: BaseAudioContext,
  spec: FilterSpec,
  start: number,
  end: number
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = spec.type;
  filter.Q.setValueAtTime(Math.max(0.0001, spec.q ?? 0.9), start);
  rampFrequency(
    filter.frequency,
    spec.freq,
    spec.freqEnd,
    start,
    start + (spec.sweep ?? end - start)
  );
  return filter;
}

/** 低频振荡器 → 深度增益 → 目标参数；返回 LFO（需要随声部一起 stop） */
function attachLfo(
  ctx: BaseAudioContext,
  target: AudioParam,
  mod: Modulation,
  depth: number,
  start: number,
  end: number,
  parts: VoiceParts
): void {
  const lfo = ctx.createOscillator();
  lfo.type = mod.shape ?? 'sine';
  rampFrequency(lfo.frequency, mod.rate, mod.rateEnd, start, end, 'lin');
  const amount = ctx.createGain();
  amount.gain.setValueAtTime(depth, start);
  lfo.connect(amount);
  amount.connect(target);
  lfo.start(start);
  parts.sources.push(lfo);
  parts.nodes.push(lfo, amount);
}

/** 把声部尾端接到输出：可选震音（振幅 LFO）与声像 */
function routeOutput(
  s: SfxTarget,
  tail: AudioNode,
  start: number,
  end: number,
  parts: VoiceParts,
  tremolo?: Modulation,
  pan?: number
): void {
  let head = tail;
  if (tremolo && tremolo.depth > 0) {
    const depth = Math.max(0, Math.min(1, tremolo.depth));
    const trem = s.ctx.createGain();
    trem.gain.setValueAtTime(1 - depth / 2, start);
    head.connect(trem);
    attachLfo(s.ctx, trem.gain, tremolo, depth / 2, start, end, parts);
    parts.nodes.push(trem);
    head = trem;
  }
  const panner = createPanner(s.ctx, pan ?? 0);
  if (panner) {
    head.connect(panner);
    parts.nodes.push(panner);
    head = panner;
  }
  head.connect(s.out);
}

/** 启动全部声源并在最后一个结束时断开整条链路 */
function finish(parts: VoiceParts, start: number, end: number): number {
  const stopAt = end + 0.02;
  for (const source of parts.sources) {
    source.stop(stopAt);
  }
  const last = parts.sources[parts.sources.length - 1];
  if (last) {
    last.onended = () => {
      last.onended = null;
      disconnectNodes(parts.nodes);
    };
  }
  return Math.max(start, end);
}

/** 振荡器声部 */
export function tone(s: SfxTarget, spec: ToneSpec): number {
  const { ctx } = s;
  const start = s.t + (spec.at ?? 0);
  const parts: VoiceParts = { sources: [], nodes: [] };
  const osc = ctx.createOscillator();
  osc.type = spec.type ?? 'sine';
  const amp = ctx.createGain();
  const end = applyEnvelope(amp.gain, start, spec, s.level);
  rampFrequency(
    osc.frequency,
    spec.freq,
    spec.freqEnd,
    start,
    start + (spec.glide ?? end - start),
    spec.glideCurve
  );
  parts.sources.push(osc);
  parts.nodes.push(osc, amp);
  if (spec.vibrato && spec.vibrato.depth > 0) {
    attachLfo(ctx, osc.frequency, spec.vibrato, spec.vibrato.depth, start, end, parts);
  }
  if (spec.filter) {
    const filter = createFilter(ctx, spec.filter, start, end);
    osc.connect(filter);
    filter.connect(amp);
    parts.nodes.push(filter);
  } else {
    osc.connect(amp);
  }
  routeOutput(s, amp, start, end, parts, spec.tremolo, spec.pan);
  for (const source of parts.sources) {
    source.start(start);
  }
  return finish(parts, start, end);
}

/** 缓存噪声声部（白 / 粉 / 布朗），随机起点，每次听感不同 */
export function noise(s: SfxTarget, spec: NoiseSpec): number {
  const { ctx } = s;
  const start = s.t + (spec.at ?? 0);
  const parts: VoiceParts = { sources: [], nodes: [] };
  const { source, offset } = createNoiseSource(ctx, spec.color ?? 'white', s.random);
  if (spec.rate !== undefined && source.playbackRate) {
    source.playbackRate.setValueAtTime(Math.max(0.05, spec.rate), start);
  }
  const amp = ctx.createGain();
  const end = applyEnvelope(amp.gain, start, spec, s.level);
  parts.nodes.push(source, amp);
  if (spec.filter) {
    const filter = createFilter(ctx, spec.filter, start, end);
    source.connect(filter);
    filter.connect(amp);
    parts.nodes.push(filter);
  } else {
    source.connect(amp);
  }
  routeOutput(s, amp, start, end, parts, spec.tremolo, spec.pan);
  // 噪声源最后 stop，作为整条链路的释放时机
  parts.sources.push(source);
  for (const lfo of parts.sources) {
    if (lfo !== source) {
      lfo.start(start);
    }
  }
  source.start(start, offset);
  return finish(parts, start, end);
}

/** 两算子 FM：金属 / 钟 / 能量护盾类音色 */
export function fm(s: SfxTarget, spec: FmSpec): number {
  const { ctx } = s;
  const start = s.t + (spec.at ?? 0);
  const parts: VoiceParts = { sources: [], nodes: [] };
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  carrier.frequency.setValueAtTime(safeFrequency(spec.freq), start);
  modulator.frequency.setValueAtTime(safeFrequency(spec.freq * spec.ratio), start);
  const amp = ctx.createGain();
  const end = applyEnvelope(amp.gain, start, spec, s.level);
  const index = ctx.createGain();
  index.gain.setValueAtTime(Math.max(MIN_GAIN, spec.freq * spec.index), start);
  index.gain.exponentialRampToValueAtTime(
    Math.max(MIN_GAIN, spec.freq * (spec.indexEnd ?? spec.index * 0.1)),
    end
  );
  modulator.connect(index);
  index.connect(carrier.frequency);
  carrier.connect(amp);
  parts.sources.push(modulator, carrier);
  parts.nodes.push(carrier, modulator, index, amp);
  routeOutput(s, amp, start, end, parts, undefined, spec.pan);
  for (const source of parts.sources) {
    source.start(start);
  }
  return finish(parts, start, end);
}

/** 持续声部的控制柄（激光束 / 电磁炮蓄力） */
export interface SustainedSfx {
  /** 以给定淡出时长停止；重复调用安全 */
  stop(fadeSeconds?: number): void;
}

export interface SustainedBuilder {
  ctx: BaseAudioContext;
  /** 整个持续声部的总包络 */
  bus: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

/** 为持续声部创建总线（淡入到 level），调用方往 bus 里接声源 */
export function beginSustained(s: SfxTarget, fadeIn: number, level: number): SustainedBuilder {
  const bus = s.ctx.createGain();
  bus.gain.setValueAtTime(0, s.t);
  bus.gain.linearRampToValueAtTime(
    Math.max(MIN_GAIN, level * s.level),
    s.t + Math.max(0.005, fadeIn)
  );
  bus.connect(s.out);
  return { ctx: s.ctx, bus, sources: [], nodes: [bus] };
}

/** 启动持续声部的全部声源，返回停止控制柄 */
export function commitSustained(
  builder: SustainedBuilder,
  start: number,
  onStop?: (now: number, fade: number) => void
): SustainedSfx {
  for (const source of builder.sources) {
    source.start(start);
  }
  let stopped = false;
  return {
    stop(fadeSeconds = 0.2): void {
      if (stopped) {
        return;
      }
      stopped = true;
      const now = builder.ctx.currentTime;
      const fade = Math.max(0.01, fadeSeconds);
      try {
        const gain = builder.bus.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.setTargetAtTime(0, now, fade / 4);
        onStop?.(now, fade);
        for (const source of builder.sources) {
          source.stop(now + fade + 0.05);
        }
      } catch {
        // 上下文已关闭
      }
      const last = builder.sources[builder.sources.length - 1];
      if (last) {
        last.onended = () => {
          last.onended = null;
          disconnectNodes(builder.nodes);
        };
      } else {
        disconnectNodes(builder.nodes);
      }
    },
  };
}
