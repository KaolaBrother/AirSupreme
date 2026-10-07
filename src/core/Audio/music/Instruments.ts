/**
 * 程序化乐器：每次调用为一个音符搭建一条短命的节点链，并在声源结束后自动断开。
 *
 * 所有乐器只用 Oscillator / Gain / BiquadFilter / BufferSource（缓存噪声），
 * StereoPanner 可选，因此可以在任意 BaseAudioContext（包括 OfflineAudioContext）上运行。
 * 静态失谐直接换算成频率（不依赖 detune 参数，测试替身也安全）。
 */
import {
  MIN_GAIN,
  applyPercussiveEnvelope,
  centsToRatio,
  clamp01,
  createNoiseSource,
  createPanner,
  disconnectNodes,
  safeFrequency,
} from '../AudioKit';
import type { InstrumentKind, InstrumentParams } from './MusicTypes';
import { midiToFrequency } from './Theory';

export interface VoiceHost {
  ctx: BaseAudioContext;
  output: AudioNode;
  random: () => number;
  /** 仍在发声 / 等待发声的声源，会话停止时统一 stop */
  live: Set<AudioScheduledSourceNode>;
}

export interface VoiceNote {
  time: number;
  /** 门限时长（秒） */
  duration: number;
  midi: readonly number[];
  velocity: number;
  /** 滤波截止频率倍数（由强度决定，1 为设计值） */
  brightness: number;
  /** 鼓的变体（开镲 / 长军鼓） */
  open: boolean;
}

export interface VoiceResult {
  sources: number;
  end: number;
}

const SILENT_RESULT: VoiceResult = { sources: 0, end: 0 };

/** 各乐器的缺省参数；轨道 params 会覆盖这些值 */
export const INSTRUMENT_DEFAULTS: Readonly<Record<InstrumentKind, InstrumentParams>> = {
  kick: { pitchStart: 150, pitchEnd: 44, decay: 0.42, level: 1 },
  snare: { tone: 190, decay: 0.17, cutoff: 1500, level: 0.8 },
  clap: { cutoff: 1150, decay: 0.16, level: 0.85 },
  hat: { cutoff: 7600, decay: 0.045, level: 0.55 },
  cymbal: { cutoff: 5200, decay: 1.5, level: 0.45 },
  boom: { pitchStart: 64, pitchEnd: 27, decay: 1.5, cutoff: 1100, level: 1 },
  riser: { cutoff: 300, resonance: 3, level: 0.5 },
  tom: { pitchStart: 170, pitchEnd: 92, decay: 0.34, level: 0.9 },
  bass: {
    wave: 'sawtooth',
    cutoff: 520,
    resonance: 2,
    filterEnv: 2.2,
    attack: 0.005,
    decay: 0.18,
    sustain: 0.72,
    release: 0.06,
    sub: 0.45,
    level: 0.9,
  },
  lead: {
    wave: 'sawtooth',
    wave2: 'square',
    detuneCents: 9,
    cutoff: 2400,
    resonance: 3,
    filterEnv: 1.2,
    attack: 0.012,
    decay: 0.25,
    sustain: 0.7,
    release: 0.14,
    vibratoHz: 5.4,
    vibratoCents: 14,
    level: 0.75,
  },
  pluck: {
    wave: 'sawtooth',
    cutoff: 2200,
    resonance: 2,
    filterEnv: 2.5,
    decay: 0.32,
    release: 0.06,
    level: 0.7,
  },
  bell: { decay: 1.5, filterEnv: 3.5, detuneCents: 2, index: 1, level: 0.55 },
  pad: {
    wave: 'sawtooth',
    voices: 2,
    detuneCents: 12,
    cutoff: 1500,
    resonance: 1.2,
    attack: 0.6,
    decay: 0.6,
    sustain: 0.85,
    release: 1.1,
    center: 60,
    width: 0.6,
    level: 0.6,
  },
  brass: {
    wave: 'sawtooth',
    detuneCents: 8,
    cutoff: 1500,
    resonance: 1.5,
    filterEnv: 1.6,
    attack: 0.03,
    decay: 0.28,
    sustain: 0.72,
    release: 0.18,
    center: 52,
    width: 0.35,
    level: 0.7,
  },
  choir: {
    wave: 'sawtooth',
    wave2: 'triangle',
    detuneCents: 9,
    attack: 0.4,
    decay: 0.4,
    sustain: 0.9,
    release: 0.9,
    vibratoHz: 4.6,
    vibratoCents: 16,
    center: 62,
    width: 0.5,
    level: 0.75,
  },
};

/** 估算一个音符会占用的声源数量，供音序器做复音上限控制 */
export function estimateVoiceCost(
  kind: InstrumentKind,
  params: InstrumentParams,
  notes: number
): number {
  const count = Math.max(1, notes);
  switch (kind) {
    case 'pad':
      return count * Math.max(1, params.voices ?? 2);
    case 'brass':
      return count * 2;
    case 'choir':
      return count * 2 + 1;
    case 'lead':
      return 3;
    case 'kick':
    case 'snare':
    case 'boom':
    case 'bell':
    case 'bass':
      return 2;
    case 'pluck':
      return params.tremoloDepth ? 2 : 1;
    default:
      return 1;
  }
}

function finishVoice(
  host: VoiceHost,
  sources: ReadonlyArray<readonly [AudioScheduledSourceNode, number]>,
  nodes: readonly AudioNode[]
): VoiceResult {
  let last: AudioScheduledSourceNode | null = null;
  let end = 0;
  for (const [source, stopAt] of sources) {
    source.stop(stopAt);
    host.live.add(source);
    if (stopAt >= end) {
      end = stopAt;
      last = source;
    }
  }
  if (last) {
    const lastSource = last;
    lastSource.onended = () => {
      lastSource.onended = null;
      for (const [source] of sources) {
        host.live.delete(source);
      }
      disconnectNodes(nodes);
    };
  }
  return { sources: sources.length, end };
}

/** 线性起音 / 线性衰减到持续电平 / 门限结束后指数释放；正确处理比起音还短的门限 */
export function applyAdsr(
  param: AudioParam,
  start: number,
  gate: number,
  peak: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number
): number {
  const safePeak = Math.max(MIN_GAIN, peak);
  const safeAttack = Math.max(0.002, attack);
  const safeDecay = Math.max(0.005, decay);
  const sustainLevel = Math.max(MIN_GAIN, safePeak * clamp01(sustain));
  const safeGate = Math.max(0.005, gate);
  // 起点不在帧边界时声源可能先于包络一帧发声：固有值先清零
  param.value = 0;
  param.setValueAtTime(0, start);
  if (safeGate <= safeAttack) {
    param.linearRampToValueAtTime(
      Math.max(MIN_GAIN, safePeak * (safeGate / safeAttack)),
      start + safeGate
    );
  } else {
    param.linearRampToValueAtTime(safePeak, start + safeAttack);
    if (safeGate <= safeAttack + safeDecay) {
      const progress = (safeGate - safeAttack) / safeDecay;
      param.linearRampToValueAtTime(
        Math.max(MIN_GAIN, safePeak + (sustainLevel - safePeak) * progress),
        start + safeGate
      );
    } else {
      param.linearRampToValueAtTime(sustainLevel, start + safeAttack + safeDecay);
      param.setValueAtTime(sustainLevel, start + safeGate);
    }
  }
  const end = start + safeGate + Math.max(0.01, release);
  param.exponentialRampToValueAtTime(MIN_GAIN, end);
  return end;
}

function createFilter(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  frequency: number,
  q: number,
  time: number
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(safeFrequency(frequency), time);
  filter.Q.setValueAtTime(Math.max(0.0001, q), time);
  return filter;
}

/** 静态失谐换算为频率倍数，不使用 detune 参数 */
function createOsc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  frequency: number,
  time: number,
  detuneCents = 0
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(safeFrequency(frequency * centsToRatio(detuneCents)), time);
  return osc;
}

/** 颤音 LFO：起音后渐入，连接到若干振荡器的 detune（参数缺失时跳过） */
function attachVibrato(
  host: VoiceHost,
  targets: readonly OscillatorNode[],
  rate: number,
  depthCents: number,
  start: number,
  nodes: AudioNode[]
): OscillatorNode | null {
  if (rate <= 0 || depthCents <= 0 || targets.length === 0 || !targets[0].detune) {
    return null;
  }
  const lfo = createOsc(host.ctx, 'sine', rate, start);
  const depth = host.ctx.createGain();
  depth.gain.setValueAtTime(0, start);
  depth.gain.linearRampToValueAtTime(0, start + 0.12);
  depth.gain.linearRampToValueAtTime(depthCents, start + 0.45);
  lfo.connect(depth);
  for (const target of targets) {
    if (target.detune) {
      depth.connect(target.detune);
    }
  }
  lfo.start(start);
  nodes.push(lfo, depth);
  return lfo;
}

function kickVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  const t = n.time;
  const level = (p.level ?? 1) * n.velocity;
  const decay = p.decay ?? 0.42;
  const body = createOsc(ctx, 'sine', p.pitchStart ?? 150, t);
  body.frequency.exponentialRampToValueAtTime(safeFrequency(p.pitchEnd ?? 44), t + 0.11);
  const bodyGain = ctx.createGain();
  applyPercussiveEnvelope(bodyGain.gain, t, level, 0.002, decay);
  body.connect(bodyGain);
  bodyGain.connect(host.output);
  const click = createOsc(ctx, 'triangle', 1700, t);
  click.frequency.exponentialRampToValueAtTime(240, t + 0.02);
  const clickGain = ctx.createGain();
  applyPercussiveEnvelope(clickGain.gain, t, level * 0.32, 0.001, 0.022);
  click.connect(clickGain);
  clickGain.connect(host.output);
  body.start(t);
  click.start(t);
  return finishVoice(
    host,
    [
      [click, t + 0.04],
      [body, t + decay + 0.04],
    ],
    [body, bodyGain, click, clickGain]
  );
}

function noiseBurst(
  host: VoiceHost,
  t: number,
  peak: number,
  attack: number,
  decay: number,
  filterType: BiquadFilterType,
  frequency: number,
  q: number,
  color: 'white' | 'pink' | 'brown' = 'white'
): { source: AudioBufferSourceNode; nodes: AudioNode[]; end: number } {
  const { ctx } = host;
  const noise = createNoiseSource(ctx, color, host.random);
  const filter = createFilter(ctx, filterType, frequency, q, t);
  const gain = ctx.createGain();
  const end = applyPercussiveEnvelope(gain.gain, t, peak, attack, decay);
  noise.source.connect(filter);
  filter.connect(gain);
  gain.connect(host.output);
  noise.source.start(t, noise.offset);
  return { source: noise.source, nodes: [noise.source, filter, gain], end };
}

function snareVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  const t = n.time;
  const level = (p.level ?? 0.8) * n.velocity;
  const decay = (p.decay ?? 0.17) * (n.open ? 1.8 : 1);
  const burst = noiseBurst(host, t, level * 0.9, 0.001, decay, 'highpass', p.cutoff ?? 1500, 0.7);
  const tone = createOsc(ctx, 'triangle', p.tone ?? 190, t);
  tone.frequency.exponentialRampToValueAtTime(safeFrequency((p.tone ?? 190) * 0.74), t + 0.06);
  const toneGain = ctx.createGain();
  applyPercussiveEnvelope(toneGain.gain, t, level * 0.6, 0.001, 0.085);
  tone.connect(toneGain);
  toneGain.connect(host.output);
  tone.start(t);
  return finishVoice(
    host,
    [
      [tone, t + 0.12],
      [burst.source, burst.end + 0.02],
    ],
    [...burst.nodes, tone, toneGain]
  );
}

function clapVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  const t = n.time;
  const level = (p.level ?? 0.85) * n.velocity;
  const noise = createNoiseSource(ctx, 'white', host.random);
  const filter = createFilter(ctx, 'bandpass', p.cutoff ?? 1150, 1.3, t);
  const gain = ctx.createGain();
  const g = gain.gain;
  g.value = 0;
  g.setValueAtTime(0, t);
  for (let i = 0; i < 3; i++) {
    const burst = t + i * 0.011;
    g.setValueAtTime(level, burst);
    g.exponentialRampToValueAtTime(level * 0.12, burst + 0.009);
  }
  g.setValueAtTime(level * 0.8, t + 0.034);
  const end = t + 0.034 + (p.decay ?? 0.16);
  g.exponentialRampToValueAtTime(MIN_GAIN, end);
  noise.source.connect(filter);
  filter.connect(gain);
  gain.connect(host.output);
  noise.source.start(t, noise.offset);
  return finishVoice(host, [[noise.source, end + 0.02]], [noise.source, filter, gain]);
}

function hatVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const level = (p.level ?? 0.55) * n.velocity;
  const decay = n.open ? (p.decay ?? 0.045) * 6 : (p.decay ?? 0.045);
  const burst = noiseBurst(host, n.time, level, 0.001, decay, 'highpass', p.cutoff ?? 7600, 0.9);
  return finishVoice(host, [[burst.source, burst.end + 0.01]], burst.nodes);
}

function cymbalVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const level = (p.level ?? 0.45) * n.velocity;
  const decay = n.open ? (p.decay ?? 1.5) * 0.4 : (p.decay ?? 1.5);
  const cutoff = n.open ? (p.cutoff ?? 5200) * 1.4 : (p.cutoff ?? 5200);
  const burst = noiseBurst(host, n.time, level, 0.002, decay, 'highpass', cutoff, 0.6);
  return finishVoice(host, [[burst.source, burst.end + 0.02]], burst.nodes);
}

function boomVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  const t = n.time;
  const level = (p.level ?? 1) * n.velocity;
  const decay = p.decay ?? 1.5;
  const body = createOsc(ctx, 'sine', p.pitchStart ?? 64, t);
  body.frequency.exponentialRampToValueAtTime(safeFrequency(p.pitchEnd ?? 27), t + decay * 0.7);
  const bodyGain = ctx.createGain();
  applyPercussiveEnvelope(bodyGain.gain, t, level, 0.004, decay);
  body.connect(bodyGain);
  bodyGain.connect(host.output);
  body.start(t);
  const noise = createNoiseSource(ctx, 'brown', host.random);
  const filter = createFilter(ctx, 'lowpass', p.cutoff ?? 1100, 0.8, t);
  filter.frequency.exponentialRampToValueAtTime(
    safeFrequency((p.cutoff ?? 1100) * 0.12),
    t + decay * 0.6
  );
  const noiseGain = ctx.createGain();
  const noiseEnd = applyPercussiveEnvelope(noiseGain.gain, t, level * 0.7, 0.006, decay * 0.65);
  noise.source.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(host.output);
  noise.source.start(t, noise.offset);
  return finishVoice(
    host,
    [
      [noise.source, noiseEnd + 0.02],
      [body, t + decay + 0.04],
    ],
    [body, bodyGain, noise.source, filter, noiseGain]
  );
}

function riserVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  const t = n.time;
  const length = Math.max(0.2, n.duration);
  const level = (p.level ?? 0.5) * n.velocity;
  const noise = createNoiseSource(ctx, 'white', host.random);
  const filter = createFilter(ctx, 'bandpass', p.cutoff ?? 300, p.resonance ?? 3, t);
  filter.frequency.exponentialRampToValueAtTime(safeFrequency((p.cutoff ?? 300) * 20), t + length);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level * 0.25, t + length * 0.6);
  gain.gain.linearRampToValueAtTime(level, t + length);
  const end = t + length + 0.06;
  gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
  noise.source.connect(filter);
  filter.connect(gain);
  gain.connect(host.output);
  noise.source.start(t, noise.offset);
  return finishVoice(host, [[noise.source, end + 0.01]], [noise.source, filter, gain]);
}

function tomVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  const t = n.time;
  const level = (p.level ?? 0.9) * n.velocity;
  const decay = p.decay ?? 0.34;
  const startHz = n.midi.length > 0 ? midiToFrequency(n.midi[0]) : (p.pitchStart ?? 170);
  const endHz = n.midi.length > 0 ? startHz * 0.6 : (p.pitchEnd ?? 92);
  const osc = createOsc(ctx, 'sine', startHz, t);
  osc.frequency.exponentialRampToValueAtTime(safeFrequency(endHz), t + Math.min(0.2, decay));
  const gain = ctx.createGain();
  applyPercussiveEnvelope(gain.gain, t, level, 0.002, decay);
  osc.connect(gain);
  gain.connect(host.output);
  osc.start(t);
  return finishVoice(host, [[osc, t + decay + 0.03]], [osc, gain]);
}

function bassVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  if (n.midi.length === 0) {
    return SILENT_RESULT;
  }
  const t = n.time;
  const frequency = midiToFrequency(n.midi[0]);
  const level = (p.level ?? 0.9) * n.velocity;
  const cutoff = (p.cutoff ?? 520) * n.brightness;
  const filter = createFilter(
    ctx,
    'lowpass',
    cutoff * (1 + (p.filterEnv ?? 2.2)),
    p.resonance ?? 2,
    t
  );
  filter.frequency.exponentialRampToValueAtTime(
    safeFrequency(cutoff),
    t + (p.decay ?? 0.18) + 0.04
  );
  const amp = ctx.createGain();
  const end = applyAdsr(
    amp.gain,
    t,
    n.duration,
    level,
    p.attack ?? 0.005,
    p.decay ?? 0.18,
    p.sustain ?? 0.72,
    p.release ?? 0.06
  );
  const main = createOsc(ctx, p.wave ?? 'sawtooth', frequency, t);
  main.connect(filter);
  main.start(t);
  const sources: Array<readonly [AudioScheduledSourceNode, number]> = [[main, end + 0.01]];
  const nodes: AudioNode[] = [main, filter, amp];
  if (p.wave2) {
    const second = createOsc(ctx, p.wave2, frequency, t, p.detuneCents ?? 6);
    second.connect(filter);
    second.start(t);
    sources.push([second, end + 0.01]);
    nodes.push(second);
  }
  filter.connect(amp);
  amp.connect(host.output);
  const subLevel = p.sub ?? 0;
  if (subLevel > 0) {
    const sub = createOsc(ctx, 'sine', frequency * 0.5, t);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(subLevel, t);
    sub.connect(subGain);
    subGain.connect(amp);
    sub.start(t);
    sources.push([sub, end + 0.01]);
    nodes.push(sub, subGain);
  }
  return finishVoice(host, sources, nodes);
}

function leadVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  if (n.midi.length === 0) {
    return SILENT_RESULT;
  }
  const t = n.time;
  const frequency = midiToFrequency(n.midi[0]);
  const level = (p.level ?? 0.75) * n.velocity;
  const cutoff = (p.cutoff ?? 2400) * n.brightness;
  const filter = createFilter(
    ctx,
    'lowpass',
    cutoff * (1 + (p.filterEnv ?? 1.2)),
    p.resonance ?? 3,
    t
  );
  filter.frequency.exponentialRampToValueAtTime(
    safeFrequency(cutoff),
    t + (p.decay ?? 0.25) + 0.05
  );
  const amp = ctx.createGain();
  const end = applyAdsr(
    amp.gain,
    t,
    n.duration,
    level,
    p.attack ?? 0.012,
    p.decay ?? 0.25,
    p.sustain ?? 0.7,
    p.release ?? 0.14
  );
  const spread = (p.detuneCents ?? 9) * 0.5;
  const oscA = createOsc(ctx, p.wave ?? 'sawtooth', frequency, t, spread);
  const oscB = createOsc(ctx, p.wave2 ?? 'square', frequency, t, -spread);
  const blend = ctx.createGain();
  blend.gain.setValueAtTime(0.6, t);
  oscA.connect(filter);
  oscB.connect(blend);
  blend.connect(filter);
  filter.connect(amp);
  amp.connect(host.output);
  oscA.start(t);
  oscB.start(t);
  const nodes: AudioNode[] = [oscA, oscB, blend, filter, amp];
  const sources: Array<readonly [AudioScheduledSourceNode, number]> = [
    [oscA, end + 0.01],
    [oscB, end + 0.01],
  ];
  if (n.duration > 0.3) {
    const lfo = attachVibrato(
      host,
      [oscA, oscB],
      p.vibratoHz ?? 5.4,
      p.vibratoCents ?? 14,
      t,
      nodes
    );
    if (lfo) {
      sources.push([lfo, end + 0.01]);
    }
  }
  return finishVoice(host, sources, nodes);
}

function pluckVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  if (n.midi.length === 0) {
    return SILENT_RESULT;
  }
  const t = n.time;
  const frequency = midiToFrequency(n.midi[0]);
  const level = (p.level ?? 0.7) * n.velocity;
  const decay = p.decay ?? 0.32;
  const cutoff = (p.cutoff ?? 2200) * n.brightness;
  const filter = createFilter(
    ctx,
    'lowpass',
    cutoff * (1 + (p.filterEnv ?? 2.5)),
    p.resonance ?? 2,
    t
  );
  filter.frequency.exponentialRampToValueAtTime(safeFrequency(cutoff * 0.35), t + decay);
  const amp = ctx.createGain();
  const holdEnd = t + Math.max(0.02, Math.min(decay, n.duration));
  amp.gain.value = 0;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(Math.max(MIN_GAIN, level), t + 0.003);
  amp.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, level * 0.08), t + decay);
  const end = Math.max(holdEnd, t + decay) + (p.release ?? 0.06);
  amp.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
  const osc = createOsc(ctx, p.wave ?? 'sawtooth', frequency, t);
  osc.connect(filter);
  filter.connect(amp);
  const nodes: AudioNode[] = [osc, filter, amp];
  const sources: Array<readonly [AudioScheduledSourceNode, number]> = [[osc, end + 0.01]];
  const depth = clamp01(p.tremoloDepth ?? 0);
  if (depth > 0) {
    // 震音：振幅 LFO 作用在包络之后的独立增益上
    const trem = ctx.createGain();
    trem.gain.setValueAtTime(1 - depth * 0.5, t);
    const lfo = createOsc(ctx, 'sine', p.tremoloHz ?? 9, t);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(depth * 0.5, t);
    lfo.connect(lfoDepth);
    lfoDepth.connect(trem.gain);
    amp.connect(trem);
    trem.connect(host.output);
    lfo.start(t);
    sources.push([lfo, end + 0.01]);
    nodes.push(trem, lfo, lfoDepth);
  } else {
    amp.connect(host.output);
  }
  osc.start(t);
  return finishVoice(host, sources, nodes);
}

function bellVoice(host: VoiceHost, p: InstrumentParams, n: VoiceNote): VoiceResult {
  const { ctx } = host;
  if (n.midi.length === 0) {
    return SILENT_RESULT;
  }
  const t = n.time;
  const frequency = midiToFrequency(n.midi[0]);
  const level = (p.level ?? 0.55) * n.velocity;
  const decay = p.decay ?? 1.5;
  const ratio = p.filterEnv ?? 3.5;
  const indexScale = Math.max(0, p.index ?? 1);
  const carrier = createOsc(ctx, 'sine', frequency, t, p.detuneCents ?? 0);
  const modulator = createOsc(ctx, 'sine', frequency * ratio, t);
  const index = ctx.createGain();
  index.gain.setValueAtTime(
    Math.max(MIN_GAIN, frequency * 1.6 * indexScale * Math.min(1.6, n.brightness)),
    t
  );
  index.gain.exponentialRampToValueAtTime(
    Math.max(MIN_GAIN, frequency * 0.08 * indexScale),
    t + decay * 0.6
  );
  modulator.connect(index);
  index.connect(carrier.frequency);
  const amp = ctx.createGain();
  const end = applyPercussiveEnvelope(amp.gain, t, level, 0.002, decay);
  carrier.connect(amp);
  amp.connect(host.output);
  carrier.start(t);
  modulator.start(t);
  return finishVoice(
    host,
    [
      [modulator, end + 0.01],
      [carrier, end + 0.01],
    ],
    [carrier, modulator, index, amp]
  );
}

/** pad / brass / choir 共用：一组失谐振荡器 →（左右声像）→ 共享滤波 → 共享振幅包络 */
function stackVoice(
  host: VoiceHost,
  kind: 'pad' | 'brass' | 'choir',
  p: InstrumentParams,
  n: VoiceNote
): VoiceResult {
  const { ctx } = host;
  if (n.midi.length === 0) {
    return SILENT_RESULT;
  }
  const t = n.time;
  const voicesPerNote = kind === 'pad' ? Math.max(1, Math.floor(p.voices ?? 2)) : 2;
  const totalVoices = n.midi.length * voicesPerNote;
  const level = ((p.level ?? 0.6) * n.velocity) / Math.sqrt(totalVoices);
  const amp = ctx.createGain();
  const end = applyAdsr(
    amp.gain,
    t,
    n.duration,
    level,
    p.attack ?? 0.6,
    p.decay ?? 0.6,
    p.sustain ?? 0.85,
    p.release ?? 1.1
  );
  const nodes: AudioNode[] = [amp];
  const oscillators: OscillatorNode[] = [];
  let input: AudioNode;
  if (kind === 'choir') {
    // “啊”元音的两个共振峰 + 少量直达声
    const formantA = createFilter(ctx, 'bandpass', 700, 4.5, t);
    const formantB = createFilter(ctx, 'bandpass', 1150, 5.5, t);
    const air = createFilter(ctx, 'lowpass', 2600 * n.brightness, 0.7, t);
    const mixA = ctx.createGain();
    const mixB = ctx.createGain();
    const mixAir = ctx.createGain();
    mixA.gain.setValueAtTime(1.6, t);
    mixB.gain.setValueAtTime(1.1, t);
    mixAir.gain.setValueAtTime(0.22, t);
    const split = ctx.createGain();
    split.connect(formantA);
    split.connect(formantB);
    split.connect(air);
    formantA.connect(mixA);
    formantB.connect(mixB);
    air.connect(mixAir);
    mixA.connect(amp);
    mixB.connect(amp);
    mixAir.connect(amp);
    nodes.push(formantA, formantB, air, mixA, mixB, mixAir, split);
    input = split;
  } else {
    const cutoff = (p.cutoff ?? 1500) * n.brightness;
    const filter = createFilter(ctx, 'lowpass', cutoff, p.resonance ?? 1.2, t);
    if (kind === 'pad') {
      // 缓慢的滤波扫频
      filter.frequency.setValueAtTime(safeFrequency(cutoff * 0.55), t);
      filter.frequency.linearRampToValueAtTime(
        safeFrequency(cutoff * 1.25),
        t + Math.max(0.2, n.duration)
      );
    } else {
      filter.frequency.setValueAtTime(safeFrequency(cutoff * 0.25), t);
      filter.frequency.exponentialRampToValueAtTime(
        safeFrequency(cutoff * (1 + (p.filterEnv ?? 1.6))),
        t + Math.max(0.02, (p.attack ?? 0.03) * 1.6)
      );
      filter.frequency.exponentialRampToValueAtTime(
        safeFrequency(cutoff),
        t + (p.attack ?? 0.03) * 1.6 + (p.decay ?? 0.28)
      );
    }
    filter.connect(amp);
    nodes.push(filter);
    input = filter;
  }
  amp.connect(host.output);
  // 立体声展开：奇偶声部各走一个声像器
  const width = clamp01(p.width ?? 0);
  const left = width > 0 && totalVoices > 1 ? createPanner(ctx, -width) : null;
  const right = left ? createPanner(ctx, width) : null;
  if (left && right) {
    left.connect(input);
    right.connect(input);
    nodes.push(left, right);
  }
  const spread = p.detuneCents ?? 10;
  let voiceIndex = 0;
  for (const midi of n.midi) {
    const frequency = midiToFrequency(midi);
    for (let v = 0; v < voicesPerNote; v++) {
      const offset =
        voicesPerNote === 1
          ? 0
          : (v / (voicesPerNote - 1) - 0.5) * 2 * spread + (host.random() - 0.5) * 3;
      const wave =
        kind === 'choir' && v % 2 === 1 ? (p.wave2 ?? 'triangle') : (p.wave ?? 'sawtooth');
      const osc = createOsc(ctx, wave, frequency, t, offset);
      const target = left && right ? (voiceIndex % 2 === 0 ? left : right) : input;
      osc.connect(target);
      osc.start(t);
      oscillators.push(osc);
      nodes.push(osc);
      voiceIndex += 1;
    }
  }
  const sources: Array<readonly [AudioScheduledSourceNode, number]> = oscillators.map(
    (osc) => [osc, end + 0.01] as const
  );
  if (kind === 'choir') {
    const lfo = attachVibrato(
      host,
      oscillators,
      p.vibratoHz ?? 4.6,
      p.vibratoCents ?? 16,
      t,
      nodes
    );
    if (lfo) {
      sources.push([lfo, end + 0.01]);
    }
  }
  return finishVoice(host, sources, nodes);
}

/** 为一个音符（或和弦）搭建并调度一条声部链路 */
export function playInstrumentVoice(
  kind: InstrumentKind,
  params: InstrumentParams,
  host: VoiceHost,
  note: VoiceNote
): VoiceResult {
  if (!Number.isFinite(note.time) || note.velocity <= 0) {
    return SILENT_RESULT;
  }
  switch (kind) {
    case 'kick':
      return kickVoice(host, params, note);
    case 'snare':
      return snareVoice(host, params, note);
    case 'clap':
      return clapVoice(host, params, note);
    case 'hat':
      return hatVoice(host, params, note);
    case 'cymbal':
      return cymbalVoice(host, params, note);
    case 'boom':
      return boomVoice(host, params, note);
    case 'riser':
      return riserVoice(host, params, note);
    case 'tom':
      return tomVoice(host, params, note);
    case 'bass':
      return bassVoice(host, params, note);
    case 'lead':
      return leadVoice(host, params, note);
    case 'pluck':
      return pluckVoice(host, params, note);
    case 'bell':
      return bellVoice(host, params, note);
    case 'pad':
    case 'brass':
    case 'choir':
      return stackVoice(host, kind, params, note);
  }
  return SILENT_RESULT;
}
