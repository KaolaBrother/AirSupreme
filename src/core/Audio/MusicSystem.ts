/**
 * 程序化背景音乐系统。
 *
 * - 23 首曲目（10 关卡曲、10 Boss 曲、菜单 / 剧情 / 胜利）与 7 个刺激音全部由 Web Audio 实时合成，
 *   不加载任何音频文件。
 * - 前瞻式音序器按 AudioContext 时钟提前调度音符；JS 定时器只负责“补货”，抖动不会累积成漂移，
 *   主线程卡顿时自动放大前瞻窗口。
 * - setIntensity(0..1)：图层增减、速度微升、会话低通逐渐打开，Boss 阶段推进时音乐随之升级。
 * - 刺激音对齐到当前曲目的下一拍并移调到当前调性，播放时闪避主音乐。
 * - 曲目切换使用交叉淡化；stopMusic / pauseMusic / dispose 会停止全部声源与定时器。
 * - 角色配音说话时（voiceDuckBridge）整条音乐总线（含刺激音与混响）平滑压低，说完恢复。
 */
import {
  acquireSharedAudioContext,
  getSharedOutputNode,
  releaseSharedAudioContext,
  resumeSharedAudioContext,
} from '@/core/Audio/AudioContextHost';
import { voiceDuckBridge } from '@/core/Audio/VoiceDucking';
import {
  MIN_GAIN,
  clamp01,
  createReverbBus,
  dbToGain,
  disconnectNodes,
} from '@/core/Audio/AudioKit';
import type { Composition, StingerDef } from '@/core/Audio/music/MusicTypes';
import { Sequencer } from '@/core/Audio/music/Sequencer';
import {
  BOSS_TRACK,
  DESERT_BOSS_TRACK,
  LEVIATHAN_BOSS_TRACK,
  MAGMA_BOSS_TRACK,
  OCEAN_BOSS_TRACK,
  OCTOPUS_BOSS_TRACK,
  ORACLE_BOSS_TRACK,
  PHANTOM_BOSS_TRACK,
  SKY_CARRIER_BOSS_TRACK,
  TEMPEST_BOSS_TRACK,
} from '@/core/Audio/music/tracks/BossTracks';
import {
  ARCTIC_TRACK,
  CANYON_TRACK,
  CITADEL_TRACK,
  CITY_TRACK,
  DESERT_TRACK,
  LAKE_TRACK,
  OCEAN_TRACK,
  SNOW_TRACK,
  STRATOSPHERE_TRACK,
  VOLCANO_TRACK,
} from '@/core/Audio/music/tracks/LevelTracks';
import {
  BOSS_DEFEATED_STINGER,
  CAMPAIGN_COMPLETE_STINGER,
  CHAPTER_START_STINGER,
  CHECKPOINT_STINGER,
  GAME_OVER_STINGER,
  LEVEL_COMPLETE_STINGER,
  PHASE_CHANGE_STINGER,
} from '@/core/Audio/music/tracks/Stingers';
import { MENU_TRACK, STORY_TRACK, VICTORY_TRACK } from '@/core/Audio/music/tracks/ThemeTracks';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MusicSystem');

type MusicDuckListener = (amount: number, durationMs: number) => void;

const duckListeners = new Set<MusicDuckListener>();

export const musicDuckingBridge = {
  subscribe(listener: MusicDuckListener): () => void {
    duckListeners.add(listener);
    return () => {
      duckListeners.delete(listener);
    };
  },
  request(amount: number, durationMs: number): void {
    const normalizedAmount = clamp01(amount);
    const safeDurationMs = Math.max(0, durationMs);
    duckListeners.forEach((listener) => {
      listener(normalizedAmount, safeDurationMs);
    });
  },
};

export enum LevelMusic {
  LAKE = 'LAKE',
  DESERT = 'DESERT',
  SNOW = 'SNOW',
  OCEAN = 'OCEAN',
  CITY = 'CITY',
  BOSS = 'BOSS',
  DESERT_BOSS = 'DESERT_BOSS',
  OCTOPUS_BOSS = 'OCTOPUS_BOSS',
  OCEAN_BOSS = 'OCEAN_BOSS',
  SKY_CARRIER_BOSS = 'SKY_CARRIER_BOSS',
  VOLCANO = 'VOLCANO',
  ARCTIC = 'ARCTIC',
  CANYON = 'CANYON',
  STRATOSPHERE = 'STRATOSPHERE',
  CITADEL = 'CITADEL',
  MAGMA_BOSS = 'MAGMA_BOSS',
  LEVIATHAN_BOSS = 'LEVIATHAN_BOSS',
  TEMPEST_BOSS = 'TEMPEST_BOSS',
  PHANTOM_BOSS = 'PHANTOM_BOSS',
  ORACLE_BOSS = 'ORACLE_BOSS',
  MENU = 'MENU',
  STORY = 'STORY',
  VICTORY = 'VICTORY',
}

export type MusicStinger =
  | 'chapter-start'
  | 'boss-defeated'
  | 'level-complete'
  | 'game-over'
  | 'campaign-complete'
  | 'checkpoint'
  | 'phase-change';

/** 全部刺激音类型（便于遍历 / 测试） */
export const MUSIC_STINGERS: readonly MusicStinger[] = [
  'chapter-start',
  'boss-defeated',
  'level-complete',
  'game-over',
  'campaign-complete',
  'checkpoint',
  'phase-change',
];

const LEVEL_MUSIC_BY_LEVEL: readonly LevelMusic[] = [
  LevelMusic.LAKE,
  LevelMusic.DESERT,
  LevelMusic.SNOW,
  LevelMusic.OCEAN,
  LevelMusic.CITY,
  LevelMusic.VOLCANO,
  LevelMusic.ARCTIC,
  LevelMusic.CANYON,
  LevelMusic.STRATOSPHERE,
  LevelMusic.CITADEL,
];

const BOSS_MUSIC_BY_LEVEL: readonly LevelMusic[] = [
  LevelMusic.BOSS,
  LevelMusic.DESERT_BOSS,
  LevelMusic.OCTOPUS_BOSS,
  LevelMusic.OCEAN_BOSS,
  LevelMusic.SKY_CARRIER_BOSS,
  LevelMusic.MAGMA_BOSS,
  LevelMusic.LEVIATHAN_BOSS,
  LevelMusic.TEMPEST_BOSS,
  LevelMusic.PHANTOM_BOSS,
  LevelMusic.ORACLE_BOSS,
];

const BOSS_MUSIC = new Set<LevelMusic>(BOSS_MUSIC_BY_LEVEL);

/** 关卡号 → 0..9（非法值按 1 处理，越界钳制到 1..10） */
function toLevelIndex(level: number): number {
  const rounded = Number.isFinite(level) ? Math.round(level) : 1;
  return Math.max(1, Math.min(LEVEL_MUSIC_BY_LEVEL.length, rounded)) - 1;
}

/** 关卡 1..10 的关卡曲（十首各不相同） */
export function getLevelMusicForLevel(level: number): LevelMusic {
  return LEVEL_MUSIC_BY_LEVEL[toLevelIndex(level)];
}

/** 关卡 1..10 的 Boss 曲（十首各不相同） */
export function getBossMusicForLevel(level: number): LevelMusic {
  return BOSS_MUSIC_BY_LEVEL[toLevelIndex(level)];
}

const TRACKS: Readonly<Record<LevelMusic, Composition>> = {
  [LevelMusic.LAKE]: LAKE_TRACK,
  [LevelMusic.DESERT]: DESERT_TRACK,
  [LevelMusic.SNOW]: SNOW_TRACK,
  [LevelMusic.OCEAN]: OCEAN_TRACK,
  [LevelMusic.CITY]: CITY_TRACK,
  [LevelMusic.BOSS]: BOSS_TRACK,
  [LevelMusic.DESERT_BOSS]: DESERT_BOSS_TRACK,
  [LevelMusic.OCTOPUS_BOSS]: OCTOPUS_BOSS_TRACK,
  [LevelMusic.OCEAN_BOSS]: OCEAN_BOSS_TRACK,
  [LevelMusic.SKY_CARRIER_BOSS]: SKY_CARRIER_BOSS_TRACK,
  [LevelMusic.VOLCANO]: VOLCANO_TRACK,
  [LevelMusic.ARCTIC]: ARCTIC_TRACK,
  [LevelMusic.CANYON]: CANYON_TRACK,
  [LevelMusic.STRATOSPHERE]: STRATOSPHERE_TRACK,
  [LevelMusic.CITADEL]: CITADEL_TRACK,
  [LevelMusic.MAGMA_BOSS]: MAGMA_BOSS_TRACK,
  [LevelMusic.LEVIATHAN_BOSS]: LEVIATHAN_BOSS_TRACK,
  [LevelMusic.TEMPEST_BOSS]: TEMPEST_BOSS_TRACK,
  [LevelMusic.PHANTOM_BOSS]: PHANTOM_BOSS_TRACK,
  [LevelMusic.ORACLE_BOSS]: ORACLE_BOSS_TRACK,
  [LevelMusic.MENU]: MENU_TRACK,
  [LevelMusic.STORY]: STORY_TRACK,
  [LevelMusic.VICTORY]: VICTORY_TRACK,
};

const STINGERS: Readonly<Record<MusicStinger, StingerDef>> = {
  'chapter-start': CHAPTER_START_STINGER,
  'boss-defeated': BOSS_DEFEATED_STINGER,
  'level-complete': LEVEL_COMPLETE_STINGER,
  'game-over': GAME_OVER_STINGER,
  'campaign-complete': CAMPAIGN_COMPLETE_STINGER,
  checkpoint: CHECKPOINT_STINGER,
  'phase-change': PHASE_CHANGE_STINGER,
};

export interface MusicCrossfadeOptions {
  durationMs?: number;
}

/** 音乐总线电平（会话 mix × 该值 × 用户音量），按离线测得的响度校准 */
const MUSIC_BUS_LEVEL = 0.5;
/** 共享混响回送量 */
const REVERB_RETURN = 0.55;
/** 会话低通在强度 0 时的缺省截止频率（Hz） */
const DEFAULT_FILTER_FLOOR = 4200;
/** 强度 0 相对强度 1 的缺省电平差（dB） */
const DEFAULT_DYNAMIC_RANGE_DB = 4;
/** 低通完全打开所需的强度 */
const FILTER_OPEN_INTENSITY = 0.85;
const SCHEDULER_INTERVAL_MS = 40;
const MIN_LOOKAHEAD_SECONDS = 0.25;
const MAX_LOOKAHEAD_SECONDS = 1.5;
const START_DELAY_SECONDS = 0.06;
const STOP_FADE_MS = 280;
const PAUSE_FADE_MS = 180;
const STINGER_LEAD_SECONDS = 0.05;
const MAX_QUANTIZE_WAIT_SECONDS = 0.6;
const STINGER_REPEAT_MS = 400;
const MAX_STINGERS = 2;
const SESSION_MAX_VOICES = 56;
const STINGER_MAX_VOICES = 40;

interface MusicSession {
  id: number;
  music: LevelMusic;
  composition: Composition;
  sequencer: Sequencer;
  gain: GainNode;
  /** 随强度变化的整体电平 */
  dynamics: GainNode;
  filter: BiquadFilterNode | null;
  /** 淡出完成、可以释放的上下文时间 */
  releaseAt: number | null;
  /** 实时兜底（毫秒）：上下文被挂起时时钟不走，也能按时释放 */
  releaseAtMs: number | null;
}

interface StingerSession {
  kind: MusicStinger;
  sequencer: Sequencer;
  gain: GainNode;
  endAt: number;
  endAtMs: number;
}

interface PausedMusic {
  music: LevelMusic;
  intensity: number;
}

function nowMs(): number {
  const clock = globalThis.performance;
  return clock && typeof clock.now === 'function' ? clock.now() : Date.now();
}

/** 稳定的字符串种子，让同一首曲子的人性化抖动每次一致 */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return hash || 1;
}

/** 半音差折算到 -6..+5，移调走最近的方向 */
function nearestTranspose(semitones: number): number {
  return ((((Math.round(semitones) % 12) + 18) % 12) - 6) | 0;
}

/** 冻结参数的当前值（支持 cancelAndHoldAtTime 时优先使用），之后可以从这里开始新的自动化 */
function holdParam(param: AudioParam, time: number): void {
  const holdable = param as AudioParam & { cancelAndHoldAtTime?: (when: number) => AudioParam };
  if (typeof holdable.cancelAndHoldAtTime === 'function') {
    holdable.cancelAndHoldAtTime(time);
    return;
  }
  const current = param.value;
  param.cancelScheduledValues(time);
  param.setValueAtTime(current, time);
}

/** 强度 → 整体电平：强度 0 比强度 1 低 dynamicRange dB */
function dynamicsGain(composition: Composition, intensity: number): number {
  const range = Math.max(0, composition.dynamicRange ?? DEFAULT_DYNAMIC_RANGE_DB);
  return dbToGain(-range * (1 - clamp01(intensity)));
}

function filterCutoff(floor: number, intensity: number): number {
  const progress = Math.min(1, clamp01(intensity) / FILTER_OPEN_INTENSITY);
  return floor * Math.pow(20000 / floor, progress);
}

export class MusicSystem {
  private context: AudioContext | null = null;
  /** 用户音乐音量 */
  private masterGain: GainNode | null = null;
  /** 音效触发的闪避（musicDuckingBridge） */
  private sfxDuckGain: GainNode | null = null;
  /** 刺激音对主音乐的闪避 */
  private stingerDuckGain: GainNode | null = null;
  /** 角色配音的闪避（voiceDuckBridge，作用于整条音乐总线） */
  private voiceDuckGain: GainNode | null = null;
  private unsubscribeVoiceDuck?: () => void;
  /** 所有曲目会话的汇合点 */
  private bedInput: GainNode | null = null;
  private stingerBus: GainNode | null = null;
  private reverbInput: AudioNode | null = null;
  private graphNodes: AudioNode[] = [];
  private isPlaying: boolean = false;
  private isDisposed: boolean = false;
  private sessionId = 0;
  private sessions: MusicSession[] = [];
  private currentSession: MusicSession | null = null;
  private currentMusic: LevelMusic | null = null;
  private stingers: StingerSession[] = [];
  private readonly lastStingerMs = new Map<MusicStinger, number>();
  private musicVolume: number = 1;
  private intensity: number = 0.5;
  private pausedMusic: PausedMusic | null = null;
  private unsubscribeDucking?: () => void;
  private duckingReleaseTime: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickMs = 0;
  private tickGapEstimate = SCHEDULER_INTERVAL_MS / 1000;

  constructor() {
    this.unsubscribeDucking = musicDuckingBridge.subscribe((amount, durationMs) => {
      this.applyMusicDuck(amount, durationMs);
    });
    this.unsubscribeVoiceDuck = voiceDuckBridge.subscribe((level, rampSeconds, delaySeconds) => {
      this.applyVoiceDuck(level, rampSeconds, delaySeconds);
    });
  }

  private initContext(): void {
    if (this.isDisposed) return;
    if (this.context && this.context.state !== 'closed' && this.masterGain) return;

    // 共享上下文被关闭后重建：旧会话的节点全部作废
    this.teardownGraph();
    try {
      const context = acquireSharedAudioContext(this);
      if (!context) {
        log.warn('Web Audio API not supported for music');
        return;
      }
      this.context = context;
      this.buildGraph(context);
    } catch {
      log.warn('Web Audio API not supported for music');
      this.teardownGraph();
    }
  }

  /** 会话 → 刺激音闪避 → 音效闪避 → 音量 → 配音闪避 → 次声高通 → 共享输出（限幅） */
  private buildGraph(context: AudioContext): void {
    const master = context.createGain();
    const sfxDuck = context.createGain();
    const stingerDuck = context.createGain();
    const voiceDuck = context.createGain();
    const bed = context.createGain();
    const stingerBus = context.createGain();
    master.gain.value = this.musicVolume * MUSIC_BUS_LEVEL;
    voiceDuck.gain.value = Math.max(MIN_GAIN, voiceDuckBridge.getLevel());
    bed.connect(stingerDuck);
    stingerDuck.connect(sfxDuck);
    sfxDuck.connect(master);
    stingerBus.connect(master);
    const output = getSharedOutputNode(context);
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 32;
    highpass.Q.value = 0.7;
    master.connect(voiceDuck);
    voiceDuck.connect(highpass);
    highpass.connect(output);
    this.graphNodes = [master, sfxDuck, stingerDuck, voiceDuck, bed, stingerBus, highpass];
    const reverb = createReverbBus(context, master, REVERB_RETURN);
    if (reverb) {
      this.graphNodes.push(...reverb.nodes);
    }
    this.reverbInput = reverb?.input ?? null;
    this.masterGain = master;
    this.sfxDuckGain = sfxDuck;
    this.stingerDuckGain = stingerDuck;
    this.voiceDuckGain = voiceDuck;
    this.bedInput = bed;
    this.stingerBus = stingerBus;
  }

  private teardownGraph(): void {
    for (const session of [...this.sessions]) {
      this.disposeSession(session);
    }
    for (const stinger of [...this.stingers]) {
      this.disposeStinger(stinger);
    }
    disconnectNodes(this.graphNodes);
    this.graphNodes = [];
    this.masterGain = null;
    this.sfxDuckGain = null;
    this.stingerDuckGain = null;
    this.voiceDuckGain = null;
    this.bedInput = null;
    this.stingerBus = null;
    this.reverbInput = null;
    this.context = null;
  }

  private getLiveContext(): AudioContext | null {
    const context = this.context;
    if (this.isDisposed || !context || context.state === 'closed') {
      return null;
    }
    return context;
  }

  public get isClosed(): boolean {
    return this.isDisposed || !this.context || this.context.state === 'closed';
  }

  public resume(): void {
    if (this.isDisposed) return;
    this.initContext();
    resumeSharedAudioContext();
  }

  // ==================== 曲目会话 ====================

  private createSession(
    music: LevelMusic,
    composition: Composition,
    startAt: number
  ): MusicSession {
    const context = this.context;
    const bed = this.bedInput;
    if (!context || !bed) {
      throw new Error('Music context not initialized');
    }
    const gain = context.createGain();
    gain.gain.value = 0;
    const dynamics = context.createGain();
    dynamics.gain.value = dynamicsGain(composition, composition.defaultIntensity);
    gain.connect(dynamics);
    const floor = composition.filterFloor ?? DEFAULT_FILTER_FLOOR;
    let filter: BiquadFilterNode | null = null;
    if (floor < 19000) {
      filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterCutoff(floor, composition.defaultIntensity);
      filter.Q.value = 0.5;
      dynamics.connect(filter);
      filter.connect(bed);
    } else {
      dynamics.connect(bed);
    }
    const sequencer = new Sequencer(context, composition, gain, {
      loop: true,
      intensity: composition.defaultIntensity,
      seed: seedFrom(composition.id),
      maxVoices: SESSION_MAX_VOICES,
      reverbInput: this.reverbInput,
    });
    sequencer.start(startAt);
    const session: MusicSession = {
      id: this.sessionId++,
      music,
      composition,
      sequencer,
      gain,
      dynamics,
      filter,
      releaseAt: null,
      releaseAtMs: null,
    };
    this.sessions.push(session);
    return session;
  }

  private disposeSession(session: MusicSession): void {
    try {
      session.sequencer.dispose();
    } catch {
      // 已释放
    }
    disconnectNodes(
      session.filter
        ? [session.gain, session.dynamics, session.filter]
        : [session.gain, session.dynamics]
    );
    this.sessions = this.sessions.filter((entry) => entry !== session);
    if (this.currentSession === session) {
      this.currentSession = null;
      this.currentMusic = null;
      this.isPlaying = false;
    }
  }

  /** 淡出会话；淡出期间继续调度音符，完成后由 tick 释放 */
  private releaseSession(session: MusicSession, fadeMs: number, fromTime?: number): void {
    if (session.releaseAt !== null) {
      return;
    }
    const context = this.getLiveContext();
    if (!context || context.state !== 'running' || fadeMs <= 0) {
      this.disposeSession(session);
      return;
    }
    const now = context.currentTime;
    const start = Math.max(now, fromTime ?? now);
    const fadeSeconds = Math.max(0.03, fadeMs / 1000);
    try {
      const gain = session.gain.gain;
      holdParam(gain, now);
      gain.setTargetAtTime(0, start, fadeSeconds / 4);
    } catch {
      this.disposeSession(session);
      return;
    }
    session.releaseAt = start + fadeSeconds + 0.05;
    session.releaseAtMs = nowMs() + (start - now) * 1000 + fadeMs + 150;
  }

  private getTransitionDuration(fromMusic: LevelMusic | null, toMusic: LevelMusic): number {
    if (!fromMusic) {
      return 900;
    }
    if (BOSS_MUSIC.has(fromMusic) !== BOSS_MUSIC.has(toMusic)) {
      return 1400;
    }
    return 1800;
  }

  public crossfadeTo(level: LevelMusic, options: MusicCrossfadeOptions = {}): void {
    if (this.isDisposed) return;
    this.initContext();
    const context = this.getLiveContext();
    if (!context || !this.bedInput) {
      return;
    }
    resumeSharedAudioContext();
    this.pausedMusic = null;

    const current = this.currentSession;
    if (current && current.releaseAt === null && this.currentMusic === level) {
      this.isPlaying = true;
      return;
    }

    const composition = TRACKS[level] ?? TRACKS[LevelMusic.LAKE];
    const fadeMs = Math.max(
      0,
      options.durationMs ?? this.getTransitionDuration(this.currentMusic, level)
    );
    const now = context.currentTime;
    let session: MusicSession;
    try {
      session = this.createSession(level, composition, now + START_DELAY_SECONDS);
    } catch {
      log.warn('Failed to start music session');
      return;
    }

    const target = Math.max(MIN_GAIN, composition.mix);
    try {
      const gain = session.gain.gain;
      gain.setValueAtTime(MIN_GAIN, now);
      gain.linearRampToValueAtTime(target, now + Math.max(0.03, fadeMs / 1000));
    } catch {
      session.gain.gain.value = target;
    }

    this.currentSession = session;
    this.currentMusic = level;
    this.isPlaying = true;
    this.intensity = composition.defaultIntensity;

    if (current) {
      this.releaseSession(current, fadeMs);
    }
    this.ensureTimer();
    this.tick();
  }

  public playLevelMusic(level: LevelMusic): void {
    this.crossfadeTo(level);
  }

  /** 关卡 1..10 的 Boss 曲；缺省为第一关 Boss 曲 */
  public playBossMusic(level?: number): void {
    this.crossfadeTo(level === undefined ? LevelMusic.BOSS : getBossMusicForLevel(level));
  }

  public playMenuMusic(): void {
    this.crossfadeTo(LevelMusic.MENU, { durationMs: 1200 });
  }

  public playStoryMusic(): void {
    this.crossfadeTo(LevelMusic.STORY, { durationMs: 1500 });
  }

  public playVictoryMusic(): void {
    this.crossfadeTo(LevelMusic.VICTORY, { durationMs: 900 });
  }

  // ==================== 强度 ====================

  private applySessionFilter(session: MusicSession, intensity: number, now: number): void {
    try {
      session.dynamics.gain.cancelScheduledValues(now);
      session.dynamics.gain.setTargetAtTime(dynamicsGain(session.composition, intensity), now, 0.5);
    } catch {
      session.dynamics.gain.value = dynamicsGain(session.composition, intensity);
    }
    if (!session.filter) {
      return;
    }
    const floor = session.composition.filterFloor ?? DEFAULT_FILTER_FLOOR;
    try {
      session.filter.frequency.cancelScheduledValues(now);
      session.filter.frequency.setTargetAtTime(filterCutoff(floor, intensity), now, 0.35);
    } catch {
      session.filter.frequency.value = filterCutoff(floor, intensity);
    }
  }

  /**
   * 0..1：图层、速度与滤波随之变化（Boss 阶段推进时调高）。
   * 作用于当前曲目；切换曲目时恢复为新曲目的缺省强度。
   */
  public setIntensity(intensity: number): void {
    const next = clamp01(Number.isFinite(intensity) ? intensity : 0);
    this.intensity = next;
    if (this.pausedMusic) {
      this.pausedMusic.intensity = next;
    }
    const context = this.getLiveContext();
    const session = this.currentSession;
    if (!context || !session || session.releaseAt !== null) {
      return;
    }
    if (Math.abs(session.sequencer.getIntensity() - next) < 0.001) {
      // 每帧重复设定同一强度时不重写自动化
      return;
    }
    const now = context.currentTime;
    try {
      session.sequencer.setIntensity(next, now);
    } catch {
      // 图层切换失败不影响播放
    }
    this.applySessionFilter(session, next, now);
  }

  public getIntensity(): number {
    return this.intensity;
  }

  // ==================== 刺激音 ====================

  private disposeStinger(stinger: StingerSession): void {
    try {
      stinger.sequencer.dispose();
    } catch {
      // 已释放
    }
    disconnectNodes([stinger.gain]);
    this.stingers = this.stingers.filter((entry) => entry !== stinger);
  }

  /** 刺激音期间压低主音乐，乐句结束后在 tail 内恢复 */
  private duckBedForStinger(def: StingerDef, start: number, phraseEnd: number): void {
    const context = this.getLiveContext();
    const duck = this.stingerDuckGain;
    if (!context || !duck) {
      return;
    }
    const now = context.currentTime;
    const level = Math.max(MIN_GAIN, clamp01(def.duckTo));
    try {
      const param = duck.gain;
      holdParam(param, now);
      param.linearRampToValueAtTime(param.value, Math.max(now, start - 0.06));
      param.linearRampToValueAtTime(level, Math.max(now + 0.01, start));
      param.setValueAtTime(level, Math.max(start, phraseEnd - 0.1));
      param.linearRampToValueAtTime(1, Math.max(start, phraseEnd - 0.1) + Math.max(0.4, def.tail));
    } catch {
      // 闪避失败时保持原音量
    }
  }

  /** 播放一个刺激音：对齐到当前曲目的下一拍，移调到当前调性，并闪避或结束主音乐 */
  public playStinger(kind: MusicStinger): void {
    if (this.isDisposed) return;
    const def = STINGERS[kind];
    if (!def) {
      return;
    }
    this.initContext();
    const context = this.getLiveContext();
    const bus = this.stingerBus;
    if (!context || !bus) {
      return;
    }
    resumeSharedAudioContext();

    const stamp = nowMs();
    if (stamp - (this.lastStingerMs.get(kind) ?? Number.NEGATIVE_INFINITY) < STINGER_REPEAT_MS) {
      return;
    }
    this.lastStingerMs.set(kind, stamp);
    while (this.stingers.length >= MAX_STINGERS) {
      this.disposeStinger(this.stingers[0]);
    }

    const now = context.currentTime;
    const current =
      this.currentSession && this.currentSession.releaseAt === null ? this.currentSession : null;
    let start = now + STINGER_LEAD_SECONDS;
    if (current && def.quantize !== 'none') {
      const grid = current.sequencer.getNextGridTime(start, def.quantize === 'bar' ? 16 : 4);
      if (grid - now <= MAX_QUANTIZE_WAIT_SECONDS) {
        start = grid;
      }
    }
    const transpose =
      def.followKey && current
        ? nearestTranspose(current.composition.key - def.composition.key)
        : 0;

    let stinger: StingerSession;
    try {
      const gain = context.createGain();
      gain.gain.value = Math.max(MIN_GAIN, def.composition.mix);
      gain.connect(bus);
      const sequencer = new Sequencer(context, def.composition, gain, {
        loop: false,
        intensity: 1,
        seed: seedFrom(kind),
        maxVoices: STINGER_MAX_VOICES,
        transpose,
        reverbInput: this.reverbInput,
      });
      sequencer.start(start);
      const phrase = sequencer.getArrangementDuration();
      sequencer.scheduleUntil(start + phrase + 0.001);
      const endAt = Math.max(start + phrase, sequencer.getEndTime()) + def.tail;
      stinger = {
        kind,
        sequencer,
        gain,
        endAt,
        endAtMs: stamp + (endAt - now) * 1000 + 250,
      };
      this.stingers.push(stinger);

      if (def.endsMusic) {
        this.endMusicForStinger(start);
      } else if (current) {
        this.duckBedForStinger(def, start, start + phrase);
      }
    } catch {
      log.warn(`Failed to play music stinger ${kind}`);
      return;
    }
    this.ensureTimer();
  }

  /** 胜利 / 失败类刺激音接管：当前曲目从刺激音起点开始淡出并结束 */
  private endMusicForStinger(start: number): void {
    const sessions = [...this.sessions];
    this.currentSession = null;
    this.currentMusic = null;
    this.isPlaying = false;
    this.pausedMusic = null;
    for (const session of sessions) {
      this.releaseSession(session, 1100, start - 0.05);
    }
  }

  // ==================== 调度器 ====================

  private ensureTimer(): void {
    if (this.timer !== null || this.isDisposed) {
      return;
    }
    this.lastTickMs = 0;
    const handle = globalThis.setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS);
    const maybeNodeTimer = handle as unknown as { unref?: () => void };
    maybeNodeTimer.unref?.();
    this.timer = handle;
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      globalThis.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 补货：按实际定时器间隔自适应前瞻窗口，并回收淡出完成的会话与刺激音 */
  private tick(): void {
    const context = this.getLiveContext();
    if (!context) {
      this.stopTimer();
      return;
    }
    const stamp = nowMs();
    const gap =
      this.lastTickMs > 0 ? (stamp - this.lastTickMs) / 1000 : SCHEDULER_INTERVAL_MS / 1000;
    this.lastTickMs = stamp;
    this.tickGapEstimate = Math.max(gap, this.tickGapEstimate * 0.92);
    const lookahead = Math.min(
      MAX_LOOKAHEAD_SECONDS,
      Math.max(MIN_LOOKAHEAD_SECONDS, this.tickGapEstimate * 1.5 + 0.05)
    );
    const now = context.currentTime;

    for (const session of [...this.sessions]) {
      if (session.releaseAt !== null) {
        if (now >= session.releaseAt || stamp >= (session.releaseAtMs ?? Infinity)) {
          this.disposeSession(session);
          continue;
        }
        if (now + lookahead >= session.releaseAt) {
          session.sequencer.stop();
        }
      }
      try {
        session.sequencer.tick(now, lookahead);
      } catch {
        this.disposeSession(session);
      }
    }
    for (const stinger of [...this.stingers]) {
      if (now >= stinger.endAt || stamp >= stinger.endAtMs) {
        this.disposeStinger(stinger);
      }
    }
    if (this.sessions.length === 0 && this.stingers.length === 0) {
      this.stopTimer();
    }
  }

  // ==================== 停止 / 暂停 / 音量 ====================

  public stopMusic(): void {
    this.isPlaying = false;
    this.currentMusic = null;
    this.currentSession = null;
    this.pausedMusic = null;
    for (const session of [...this.sessions]) {
      this.releaseSession(session, STOP_FADE_MS);
    }
    if (this.sessions.length === 0 && this.stingers.length === 0) {
      this.stopTimer();
    }
  }

  /** 暂停：快速淡出全部音乐（含刺激音），记住当前曲目与强度供 resumeMusic() 恢复 */
  public pauseMusic(): void {
    const remembered: PausedMusic | null =
      this.currentMusic && this.isPlaying
        ? { music: this.currentMusic, intensity: this.intensity }
        : this.pausedMusic;
    this.isPlaying = false;
    this.currentMusic = null;
    this.currentSession = null;
    for (const session of [...this.sessions]) {
      this.releaseSession(session, PAUSE_FADE_MS);
    }
    for (const stinger of [...this.stingers]) {
      this.disposeStinger(stinger);
    }
    this.pausedMusic = remembered;
    if (this.sessions.length === 0) {
      this.stopTimer();
    }
  }

  /** 从 pauseMusic() 记住的位置恢复（重新进入该曲目并还原强度） */
  public resumeMusic(): void {
    const paused = this.pausedMusic;
    if (!paused || this.isDisposed) {
      return;
    }
    this.crossfadeTo(paused.music, { durationMs: 600 });
    if (this.currentMusic === paused.music) {
      this.setIntensity(paused.intensity);
    }
  }

  public close(): void {
    this.dispose();
  }

  public setVolume(volume: number): void {
    this.musicVolume = clamp01(volume);
    const master = this.masterGain;
    if (!master) {
      return;
    }
    const target = this.musicVolume * MUSIC_BUS_LEVEL;
    const context = this.getLiveContext();
    try {
      if (!context) {
        throw new Error('no context');
      }
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(target, context.currentTime, 0.05);
    } catch {
      master.gain.value = target;
    }
  }

  private applyMusicDuck(amount: number, durationMs: number): void {
    const context = this.getLiveContext();
    const duck = this.sfxDuckGain;
    if (!context || !duck) {
      return;
    }

    const now = context.currentTime;
    const duckGain = Math.max(MIN_GAIN, 1 - amount);
    const safeDurationMs = Math.max(0, durationMs);
    const duckCurveMs = Math.min(Math.max(55, safeDurationMs * 0.18), 280);
    const releaseTime = now + safeDurationMs / 1000;
    const effectiveReleaseTime = Math.max(releaseTime, this.duckingReleaseTime);

    try {
      holdParam(duck.gain, now);
      duck.gain.linearRampToValueAtTime(duckGain, now + duckCurveMs / 1000);
      duck.gain.exponentialRampToValueAtTime(1, effectiveReleaseTime + 0.16);
      this.duckingReleaseTime = effectiveReleaseTime;
    } catch {
      // Ignore
    }
  }

  /** 配音闪避：从当前值出发，delaySeconds 后用 rampSeconds 平滑过渡到 level（覆盖未执行的旧请求） */
  private applyVoiceDuck(level: number, rampSeconds: number, delaySeconds: number): void {
    const context = this.getLiveContext();
    const duck = this.voiceDuckGain;
    if (!context || !duck) {
      return;
    }
    const target = Math.max(MIN_GAIN, Math.min(1, level));
    const now = context.currentTime;
    try {
      holdParam(duck.gain, now);
      // setTargetAtTime 约 3 个时间常数到位
      duck.gain.setTargetAtTime(target, now + delaySeconds, Math.max(0.005, rampSeconds / 3));
    } catch {
      duck.gain.value = target;
    }
  }

  /** 配音闪避的当前增益倍数（1 = 未闪避；没有音频图时为 null） */
  public getVoiceDuckLevel(): number | null {
    return this.voiceDuckGain ? this.voiceDuckGain.gain.value : null;
  }

  /**
   * 诊断：在音乐总线出口（音量与配音闪避之后）挂一个 AnalyserNode，用于测量电平；
   * 不支持时返回 null。调用方负责 disconnect。
   */
  public createOutputAnalyser(): AnalyserNode | null {
    const context = this.getLiveContext();
    const duck = this.voiceDuckGain;
    if (!context || !duck || typeof context.createAnalyser !== 'function') {
      return null;
    }
    try {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      duck.connect(analyser);
      return analyser;
    } catch {
      return null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentMusic(): LevelMusic | null {
    return this.currentMusic;
  }

  public dispose(): void {
    this.stopTimer();
    this.isPlaying = false;
    this.currentMusic = null;
    this.currentSession = null;
    this.pausedMusic = null;
    this.unsubscribeDucking?.();
    this.unsubscribeDucking = undefined;
    this.unsubscribeVoiceDuck?.();
    this.unsubscribeVoiceDuck = undefined;
    this.teardownGraph();
    releaseSharedAudioContext(this);
    this.isDisposed = true;
  }
}
