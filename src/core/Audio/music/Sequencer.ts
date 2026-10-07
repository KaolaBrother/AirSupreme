/**
 * 前瞻式音序器（lookahead scheduler）。
 *
 * - 时间以 AudioContext 时钟为准：外部定时器每 ~25ms 调用一次 tick(now)，
 *   音序器把 now + LOOKAHEAD 之前的所有 16 分音符事件提前调度到音频线程。
 * - 段落（section）以整小节为单位推进；每条轨道在段内按自身样式长度循环，
 *   所以各图层天然对齐、不会出现旧实现中“贝斯先结束”的空档。
 * - 只依赖 BaseAudioContext：既能实时播放，也能直接 scheduleUntil() 后离线渲染。
 * - 复音上限按时间线记账（不依赖 onended），离线渲染时同样有效。
 */
import { clamp01, createRandom, supportsDelay } from '../AudioKit';
import {
  INSTRUMENT_DEFAULTS,
  estimateVoiceCost,
  playInstrumentVoice,
  type VoiceHost,
} from './Instruments';
import type {
  ArpSettings,
  Composition,
  InstrumentKind,
  InstrumentParams,
  PatternInput,
  SectionDef,
  TrackDef,
} from './MusicTypes';
import {
  STEPS_PER_BAR,
  arpeggiate,
  compilePattern,
  parsePatternRef,
  type CompiledPattern,
  type PatternEvent,
} from './Theory';

/** 定时器间隔（毫秒）与前瞻窗口（秒） */
export const SEQUENCER_TICK_MS = 25;
export const SEQUENCER_LOOKAHEAD_SECONDS = 0.12;

/** 时间线上同时存在的声源上限（软上限丢弃低优先级图层，硬上限丢弃一切） */
const DEFAULT_MAX_VOICES = 72;
const HARD_VOICE_MARGIN = 18;
/** 落后超过该时长（后台标签页节流）就跳过错过的步，而不是集中补发 */
const RESYNC_THRESHOLD_SECONDS = 0.05;
const LAYER_FADE_SECONDS = 0.45;

const DRUM_KINDS: ReadonlySet<InstrumentKind> = new Set<InstrumentKind>([
  'kick',
  'snare',
  'clap',
  'hat',
  'cymbal',
  'boom',
  'riser',
  'tom',
]);

const PRIORITY_KINDS: ReadonlySet<InstrumentKind> = new Set<InstrumentKind>([
  'kick',
  'snare',
  'clap',
  'bass',
  'lead',
  'brass',
  'boom',
  'cymbal',
]);

const GATE: Readonly<Record<InstrumentKind, number>> = {
  kick: 1,
  snare: 1,
  clap: 1,
  hat: 1,
  cymbal: 1,
  boom: 1,
  riser: 1,
  tom: 1,
  bass: 0.85,
  lead: 0.92,
  pluck: 1,
  bell: 1,
  pad: 1,
  brass: 0.9,
  choir: 1,
};

export interface SequencerOptions {
  /** false 时播放完全部段落即结束（刺激音） */
  loop?: boolean;
  intensity?: number;
  seed?: number;
  maxVoices?: number;
}

export interface SequencerPosition {
  section: string;
  sectionIndex: number;
  bar: number;
  beat: number;
}

interface TrackState {
  id: string;
  def: TrackDef;
  params: InstrumentParams;
  input: PatternInput;
  bus: GainNode;
  send: GainNode | null;
  host: VoiceHost;
  priority: boolean;
  isDrum: boolean;
}

interface VoiceLedgerEntry {
  end: number;
  cost: number;
}

function defaultInput(kind: InstrumentKind, arp: ArpSettings | undefined): PatternInput {
  if (arp) {
    return 'chords';
  }
  if (DRUM_KINDS.has(kind)) {
    return 'grid';
  }
  if (kind === 'pad' || kind === 'choir') {
    return 'chords';
  }
  return 'notes';
}

function layerFactor(def: TrackDef, intensity: number): number {
  const min = def.minIntensity ?? 0;
  const max = def.maxIntensity ?? 1;
  return intensity + 1e-6 >= min && intensity <= max + 1e-6 ? 1 : 0;
}

function concatPatterns(parts: readonly CompiledPattern[]): CompiledPattern {
  if (parts.length === 1) {
    return parts[0];
  }
  const byStep: Array<readonly PatternEvent[] | undefined> = [];
  const activeChord: Array<readonly number[] | null> = [];
  let offset = 0;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      byStep[offset + i] = part.byStep[i];
      activeChord[offset + i] = part.activeChord[i] ?? null;
    }
    offset += part.length;
  }
  return { length: Math.max(1, offset), byStep, activeChord };
}

export class Sequencer {
  private readonly ctx: BaseAudioContext;
  private readonly composition: Composition;
  private readonly loop: boolean;
  private readonly maxVoices: number;
  private readonly random: () => number;
  private readonly live = new Set<AudioScheduledSourceNode>();
  private readonly tracks: TrackState[] = [];
  private readonly compiled = new Map<string, CompiledPattern | null>();
  private readonly ledger: VoiceLedgerEntry[] = [];
  private readonly ownedNodes: AudioNode[] = [];
  private readonly stepDuration: number;
  private readonly swingOffset: number;
  private intensity: number;
  private startTime = 0;
  private started = false;
  private stopped = false;
  private finished = false;
  private globalStep = 0;
  private sectionIndex = 0;
  private sectionStep = 0;
  private scheduledSources = 0;
  private droppedVoices = 0;
  private lastEventEnd = 0;

  constructor(
    ctx: BaseAudioContext,
    composition: Composition,
    output: AudioNode,
    options: SequencerOptions = {}
  ) {
    this.ctx = ctx;
    this.composition = composition;
    this.loop = options.loop ?? true;
    this.maxVoices = Math.max(8, options.maxVoices ?? DEFAULT_MAX_VOICES);
    this.random = createRandom(options.seed ?? 1);
    this.intensity = clamp01(options.intensity ?? composition.defaultIntensity);
    const bpm = Math.max(20, Math.min(300, composition.bpm));
    this.stepDuration = 60 / bpm / 4;
    this.swingOffset = Math.max(0, Math.min(0.5, composition.swing ?? 0)) * this.stepDuration;
    const delayInput = this.createDelay(output, bpm);
    for (const [id, def] of Object.entries(composition.tracks)) {
      this.tracks.push(this.createTrack(id, def, output, delayInput));
    }
    this.sectionIndex = this.findPlayableSection(0, false);
  }

  private createDelay(output: AudioNode, bpm: number): AudioNode | null {
    const settings = this.composition.delay;
    if (!settings || !supportsDelay(this.ctx)) {
      return null;
    }
    try {
      const input = this.ctx.createGain();
      const delay = this.ctx.createDelay(2);
      const tone = this.ctx.createBiquadFilter();
      const feedback = this.ctx.createGain();
      const wet = this.ctx.createGain();
      delay.delayTime.value = Math.max(0.02, Math.min(1.9, (settings.beats * 60) / bpm));
      tone.type = 'lowpass';
      tone.frequency.value = settings.tone ?? 2600;
      feedback.gain.value = Math.max(0, Math.min(0.7, settings.feedback));
      wet.gain.value = clamp01(settings.wet);
      input.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(wet);
      wet.connect(output);
      this.ownedNodes.push(input, delay, tone, feedback, wet);
      return input;
    } catch {
      return null;
    }
  }

  private createTrack(
    id: string,
    def: TrackDef,
    output: AudioNode,
    delayInput: AudioNode | null
  ): TrackState {
    const bus = this.ctx.createGain();
    bus.gain.value = clamp01(def.gain) * layerFactor(def, this.intensity);
    bus.connect(output);
    this.ownedNodes.push(bus);
    let send: GainNode | null = null;
    if (delayInput && (def.send ?? 0) > 0) {
      send = this.ctx.createGain();
      send.gain.value = clamp01(def.send ?? 0);
      bus.connect(send);
      send.connect(delayInput);
      this.ownedNodes.push(send);
    }
    return {
      id,
      def,
      params: { ...INSTRUMENT_DEFAULTS[def.inst], ...def.params },
      input: def.input ?? defaultInput(def.inst, def.arp),
      bus,
      send,
      host: { ctx: this.ctx, output: bus, random: this.random, live: this.live },
      priority: PRIORITY_KINDS.has(def.inst),
      isDrum: DRUM_KINDS.has(def.inst),
    };
  }

  /** 从 index 开始寻找满足强度条件的段；advance=true 时 index 自身不计 */
  private findPlayableSection(index: number, advance: boolean): number {
    const sections = this.composition.sections;
    const count = sections.length;
    if (count === 0) {
      return 0;
    }
    const loopFrom = Math.max(0, Math.min(count - 1, this.composition.loopFrom ?? 0));
    let candidate = advance ? index + 1 : index;
    for (let guard = 0; guard < count * 2; guard++) {
      if (candidate >= count) {
        if (!this.loop) {
          return count;
        }
        candidate = loopFrom;
      }
      const section = sections[candidate];
      if ((section.minIntensity ?? 0) <= this.intensity + 1e-6) {
        return candidate;
      }
      candidate += 1;
    }
    return advance ? Math.min(count - 1, Math.max(loopFrom, index)) : index;
  }

  private getSection(): SectionDef | null {
    return this.composition.sections[this.sectionIndex] ?? null;
  }

  private getCompiled(track: TrackState, section: SectionDef): CompiledPattern | null {
    const play = section.play[track.id];
    if (play === undefined) {
      return null;
    }
    const refs = typeof play === 'string' ? [play] : play;
    const key = `${track.id}|${refs.join('+')}`;
    if (this.compiled.has(key)) {
      return this.compiled.get(key) ?? null;
    }
    const parts: CompiledPattern[] = [];
    for (const ref of refs) {
      const { id, transpose } = parsePatternRef(ref);
      const source = this.composition.patterns[id];
      if (source === undefined) {
        continue;
      }
      parts.push(compilePattern(source, track.input, transpose, track.params.center ?? 60));
    }
    const result = parts.length > 0 ? concatPatterns(parts) : null;
    this.compiled.set(key, result);
    return result;
  }

  private timeOfStep(step: number): number {
    return this.startTime + step * this.stepDuration + (step % 2 === 1 ? this.swingOffset : 0);
  }

  /** 时间线复音记账；返回 false 表示该音符应被丢弃 */
  private reserveVoices(time: number, end: number, cost: number, priority: boolean): boolean {
    let active = 0;
    for (let i = this.ledger.length - 1; i >= 0; i--) {
      if (this.ledger[i].end <= time) {
        this.ledger.splice(i, 1);
      } else {
        active += this.ledger[i].cost;
      }
    }
    const limit = priority ? this.maxVoices + HARD_VOICE_MARGIN : this.maxVoices;
    if (active + cost > limit) {
      this.droppedVoices += 1;
      return false;
    }
    this.ledger.push({ end, cost });
    return true;
  }

  private brightnessFor(track: TrackState): number {
    const follow = track.def.brightnessFollow ?? (track.isDrum ? 0 : track.def.inst === 'bass' ? 0.5 : 1);
    return Math.max(0.3, 1 + follow * (0.8 * this.intensity - 0.4));
  }

  private scheduleVoice(
    track: TrackState,
    time: number,
    lengthSteps: number,
    midi: readonly number[],
    velocity: number,
    open: boolean,
    gate: number
  ): void {
    const duration = Math.max(0.02, lengthSteps * this.stepDuration * gate);
    const cost = estimateVoiceCost(track.def.inst, track.params, midi.length);
    const tail = track.params.release ?? track.params.decay ?? 0.3;
    if (!this.reserveVoices(time, time + duration + tail, cost, track.priority)) {
      return;
    }
    const humanized = track.isDrum ? velocity : velocity * (0.94 + this.random() * 0.1);
    try {
      const result = playInstrumentVoice(track.def.inst, track.params, track.host, {
        time,
        duration,
        midi,
        velocity: humanized,
        brightness: this.brightnessFor(track),
        open,
      });
      this.scheduledSources += result.sources;
      this.lastEventEnd = Math.max(this.lastEventEnd, result.end);
    } catch {
      // 单个音符失败不影响整首曲子
    }
  }

  private scheduleStep(step: number): void {
    const section = this.getSection();
    if (!section) {
      return;
    }
    const time = this.timeOfStep(step);
    for (const track of this.tracks) {
      if (layerFactor(track.def, this.intensity) === 0) {
        continue;
      }
      const pattern = this.getCompiled(track, section);
      if (!pattern) {
        continue;
      }
      const position = this.sectionStep % pattern.length;
      const arp = track.def.arp;
      if (arp) {
        const rate = Math.max(1, Math.floor(arp.rate));
        const chord = pattern.activeChord[position];
        if (chord && chord.length > 0 && position % rate === 0) {
          const midi = arpeggiate(chord, Math.floor(position / rate), arp.mode, arp.octaves);
          this.scheduleVoice(track, time, rate, [midi], 0.8, false, arp.gate ?? 0.7);
        }
        continue;
      }
      const events = pattern.byStep[position];
      if (!events) {
        continue;
      }
      for (const event of events) {
        this.scheduleVoice(
          track,
          time,
          event.length,
          event.midi,
          event.velocity,
          event.open,
          GATE[track.def.inst]
        );
      }
    }
  }

  private advanceStep(): void {
    this.globalStep += 1;
    this.sectionStep += 1;
    const section = this.getSection();
    const sectionSteps = Math.max(1, Math.round((section?.bars ?? 1) * STEPS_PER_BAR));
    if (this.sectionStep >= sectionSteps) {
      this.sectionStep = 0;
      const next = this.findPlayableSection(this.sectionIndex, true);
      if (next >= this.composition.sections.length) {
        this.finished = true;
        return;
      }
      this.sectionIndex = next;
    }
  }

  /** 设定第 0 步的时间（上下文时钟） */
  public start(when: number): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startTime = Math.max(0, when);
  }

  /** 调度所有起始时间早于 until 的步 */
  public scheduleUntil(until: number): void {
    if (!this.started || this.stopped) {
      return;
    }
    let guard = 0;
    while (!this.finished && this.timeOfStep(this.globalStep) < until && guard < 4096) {
      this.scheduleStep(this.globalStep);
      this.advanceStep();
      guard += 1;
    }
  }

  /**
   * 定时器回调：若落后（定时器被长时间挂起）则跳过错过的步，再调度前瞻窗口。
   * lookahead 可由调用方按实际定时器间隔放大，避免后台节流时出现空档。
   */
  public tick(now: number, lookahead: number = SEQUENCER_LOOKAHEAD_SECONDS): void {
    if (!this.started || this.stopped || this.finished) {
      return;
    }
    const behind = now - this.timeOfStep(this.globalStep);
    if (behind > RESYNC_THRESHOLD_SECONDS) {
      const missed = Math.min(1 << 20, Math.ceil(behind / this.stepDuration));
      for (let i = 0; i < missed && !this.finished; i++) {
        this.advanceStep();
      }
    }
    this.scheduleUntil(now + Math.max(0.02, lookahead));
  }

  public setIntensity(value: number, when: number = this.ctx.currentTime): void {
    const next = clamp01(value);
    this.intensity = next;
    for (const track of this.tracks) {
      const target = clamp01(track.def.gain) * layerFactor(track.def, next);
      try {
        track.bus.gain.cancelScheduledValues(when);
        track.bus.gain.setTargetAtTime(target, when, LAYER_FADE_SECONDS / 3);
      } catch {
        track.bus.gain.value = target;
      }
    }
  }

  public getIntensity(): number {
    return this.intensity;
  }

  /** 不再调度新事件；已调度的音符会自然播完 */
  public stop(): void {
    this.stopped = true;
  }

  /** 立即停止所有声源并断开全部节点 */
  public dispose(when: number = this.ctx.currentTime): void {
    this.stopped = true;
    for (const source of this.live) {
      try {
        source.stop(when);
      } catch {
        // 尚未 start 或已停止
      }
    }
    this.live.clear();
    for (const node of this.ownedNodes) {
      try {
        node.disconnect();
      } catch {
        // 已断开
      }
    }
    this.ledger.length = 0;
  }

  public isFinished(): boolean {
    return this.finished;
  }

  public isStopped(): boolean {
    return this.stopped;
  }

  /** 一次性播放时的结束时间（最后一个音符的释放结束） */
  public getEndTime(): number {
    return this.lastEventEnd;
  }

  /** 全部段落（不含循环）的时长（秒） */
  public getArrangementDuration(): number {
    let steps = 0;
    for (const section of this.composition.sections) {
      steps += Math.round(section.bars * STEPS_PER_BAR);
    }
    return steps * this.stepDuration;
  }

  public getPosition(): SequencerPosition {
    const section = this.getSection();
    return {
      section: section?.name ?? '',
      sectionIndex: this.sectionIndex,
      bar: Math.floor(this.sectionStep / STEPS_PER_BAR),
      beat: Math.floor((this.sectionStep % STEPS_PER_BAR) / 4),
    };
  }

  public getStats(): { scheduledSources: number; droppedVoices: number; liveSources: number } {
    return {
      scheduledSources: this.scheduledSources,
      droppedVoices: this.droppedVoices,
      liveSources: this.live.size,
    };
  }

  public getComposition(): Composition {
    return this.composition;
  }
}
