/**
 * 角色配音（VoiceSystem）
 *
 * 语音包：public/voice/<en|zh>/<台词 id>.mp3（运行时 /voice/...）+ /voice/manifest.json
 * （{ version, format, languages: { en: { [id]: { duration, bytes } }, zh: {...} } }）。
 *
 * - 清单懒加载；只请求清单里有的台词，缺失的 id 直接走纯文字（不会产生 404）。
 * - 按当前界面语言选包（en → en/，zh-CN → zh/）；切换语言时停下正在说的台词，并按新语言重新预取。
 * - 经共享 AudioContext 获取 + 解码；编码数据与解码后的缓冲区各有一个小 LRU；入关时预取本章台词。
 * - 无线电台词走电台链：逐句按说话人带通（约 300 Hz–3.4 kHz）+ 底噪 → 共用的二级带通、存在感峰值、
 *   轻度饱和、压缩，结尾一声静噪尾音；剧情旁白走干净链路（高通 + 轻压缩）。
 *   每句按门限 RMS 归一化响度（语音包里不同角色的电平相差可达 16 dB）。
 * - 说话时经 voiceDuckBridge 压低音乐总线，说完延迟片刻再平滑恢复（连续几句之间不忽大忽小）。
 * - 同一时刻只有一句配音：新的 play 顶掉旧的（旧请求收到 onSilent('superseded')）。
 * - stop / stopAll：打断、跳过、关卡结束、失败、切换语言；pause / resume 跟随游戏暂停（从断点续播）。
 * - 永不抛错：没有 AudioContext、文件缺失、解码失败、加载超时都只是静默（界面照常显示文字）。
 *   回调一律异步（微任务）派发，调用方可以在回调里安全地再调用本系统。
 */
import {
  acquireSharedAudioContext,
  getSharedOutputNode,
  releaseSharedAudioContext,
  resumeSharedAudioContext,
} from '@/core/Audio/AudioContextHost';
import {
  MIN_GAIN,
  clamp01,
  createCompressor,
  createNoiseSource,
  dbToGain,
  disconnectNodes,
  estimateCompressorMakeupDb,
  type CompressorSettings,
} from '@/core/Audio/AudioKit';
import { noise, tone, type SfxTarget } from '@/core/Audio/sfx/SfxKit';
import { voiceDuckBridge } from '@/core/Audio/VoiceDucking';
import { getLogger } from '@/core/utils/Logger';
import { getLocale, onLocaleChange, type Locale } from '@/i18n';

const log = getLogger('VoiceSystem');

export type VoiceKind = 'radio' | 'narration';
export type VoicePackLanguage = 'en' | 'zh';

/** play() 没有出声 / 没有说完的原因 */
export type VoiceSilentReason =
  /** 语音包里没有这句，或没有可用的 AudioContext / 解码能力 */
  | 'unavailable'
  /** 语音音量为 0（纯文字） */
  | 'muted'
  /** 加载超过 maxStartDelayMs，这一句改为纯文字（缓冲区仍会缓存，下次直接播） */
  | 'timeout'
  /** 获取或解码失败 */
  | 'error'
  /** 被 stop / stopAll 打断（跳过、关卡结束、失败、切换语言） */
  | 'stopped'
  /** 被下一句配音顶掉 */
  | 'superseded'
  | 'disposed';

export interface VoiceManifestEntry {
  readonly duration: number;
  readonly bytes?: number;
}

export interface VoiceManifest {
  readonly version: number;
  readonly format: string;
  readonly languages: Partial<
    Record<VoicePackLanguage, Readonly<Record<string, VoiceManifestEntry>>>
  >;
}

/** 一句配音开始 / 说完时回调的信息 */
export interface VoiceLineInfo {
  readonly lineId: string;
  readonly kind: VoiceKind;
  readonly speaker: string | null;
  readonly locale: Locale;
  readonly language: VoicePackLanguage;
  /** 配音时长（秒，解码后的缓冲区） */
  readonly duration: number;
  /** 响度归一化增益（dB） */
  readonly gainDb: number;
}

export interface VoicePlayOptions {
  kind: VoiceKind;
  /** CampaignSpeakerId：决定电台音色（带宽 / 底噪）；旁白忽略 */
  speaker?: string | null;
  /** 配音真正开始播放（缓冲区已就绪） */
  onStart?: (info: VoiceLineInfo) => void;
  /** 自然说完（不含被打断 / 暂停） */
  onEnd?: (info: VoiceLineInfo) => void;
  /** 没有出声，或开始后被打断（每个请求至多一次；与 onEnd 互斥） */
  onSilent?: (reason: VoiceSilentReason) => void;
  /** 等待加载的最长时间（毫秒）；缺省无线电 1500、旁白 2500 */
  maxStartDelayMs?: number;
}

/** fetch 的最小子集（便于注入测试替身） */
export interface VoiceFetchResponse {
  readonly ok: boolean;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type VoiceFetch = (url: string) => Promise<VoiceFetchResponse>;

export interface VoiceSystemOptions {
  /** 语音包根路径（缺省 `${import.meta.env.BASE_URL}voice/`） */
  baseUrl?: string;
  /** 注入 fetch（缺省使用全局 fetch） */
  fetch?: VoiceFetch;
}

export interface VoiceDebugEvent {
  /** performance.now()（毫秒） */
  t: number;
  event: 'request' | 'start' | 'end' | 'silent' | 'pause' | 'resume' | 'prefetch';
  lineId: string;
  locale: Locale;
  kind?: VoiceKind;
  duration?: number;
  gainDb?: number;
  offset?: number;
  reason?: VoiceSilentReason;
}

export interface VoiceDebugState {
  language: VoicePackLanguage;
  manifest: 'idle' | 'loading' | 'ready' | 'failed';
  manifestLines: Partial<Record<VoicePackLanguage, number>>;
  volume: number;
  paused: boolean;
  current: {
    lineId: string;
    kind: VoiceKind;
    phase: VoiceRequestPhase;
    locale: Locale;
    duration: number | null;
    offset: number;
    gainDb: number;
  } | null;
  duckTarget: number;
  cache: { decoded: number; decodedSeconds: number; encoded: number; encodedBytes: number };
  events: VoiceDebugEvent[];
}

type VoiceRequestPhase = 'loading' | 'playing' | 'paused' | 'ended' | 'cancelled';

interface LoadedLine {
  buffer: AudioBuffer;
  gainDb: number;
}

type LoadResult = LoadedLine | { reason: VoiceSilentReason };

interface VoiceRequest {
  readonly handle: number;
  readonly lineId: string;
  readonly kind: VoiceKind;
  readonly speaker: string | null;
  readonly locale: Locale;
  readonly language: VoicePackLanguage;
  readonly options: VoicePlayOptions;
  readonly requestedAtMs: number;
  phase: VoiceRequestPhase;
  deadline: ReturnType<typeof setTimeout> | null;
  /** 播放看门狗（实时）：收不到 onended 时也按说完处理，台词队列不会卡住 */
  watchdog: ReturnType<typeof setTimeout> | null;
  buffer: AudioBuffer | null;
  gainDb: number;
  /** 已播放的秒数（暂停续播的起点） */
  offset: number;
  /** 当前声源对应缓冲区 offset 处的上下文时间 */
  sourceStartedAt: number;
  source: AudioBufferSourceNode | null;
  lineGain: GainNode | null;
  hissGain: GainNode | null;
  hissSource: AudioBufferSourceNode | null;
  tailGate: GainNode | null;
  nodes: AudioNode[];
  startNotified: boolean;
}

interface VoiceGraph {
  context: AudioContext;
  /** 用户语音音量 × 总线电平 → 共享输出（限幅） */
  output: GainNode;
  radioInput: GainNode;
  narrationInput: GainNode;
  nodes: AudioNode[];
}

interface RadioProfile {
  /** 逐句带通下沿 / 上沿（Hz） */
  low: number;
  high: number;
  /** 底噪电平（相对归一化后的人声） */
  hiss: number;
}

/** 无线电音色：地面站较宽较干净，座舱 / 舰载电台更窄、底噪更重，民用波段最窄最嘈杂 */
const DEFAULT_RADIO_PROFILE: RadioProfile = { low: 300, high: 3400, hiss: 0.01 };
const RADIO_PROFILES: Readonly<Record<string, RadioProfile>> = {
  hq: { low: 280, high: 3600, hiss: 0.007 },
  scientist: { low: 290, high: 3500, hiss: 0.007 },
  awacs: { low: 300, high: 3600, hiss: 0.006 },
  wingman: { low: 330, high: 3200, hiss: 0.012 },
  wingman2: { low: 330, high: 3200, hiss: 0.012 },
  frigate: { low: 280, high: 3100, hiss: 0.013 },
  // 被劫持的频道：更宽，几乎没有底噪
  oracle: { low: 220, high: 4200, hiss: 0.004 },
  airliner: { low: 360, high: 2900, hiss: 0.016 },
  freighter: { low: 360, high: 2900, hiss: 0.018 },
};

/** 总线电平（按浏览器内实测：人声比音乐高约 10 dB，与音效峰值相当） */
const VOICE_BUS_LEVEL = 0.85;
const RADIO_BUS_LEVEL = 1;
const NARRATION_BUS_LEVEL = 0.9;
/** 初始语音音量（与 SessionSettings.DEFAULT_VOICE_VOLUME 一致；游戏开局用设置值覆盖） */
const INITIAL_VOICE_VOLUME = 0.9;

/** 门限 RMS 归一化：50 ms 块、绝对门限 −50 dBFS、相对门限 −15 dB（与 EBU R128 积分响度偏差约 1 dB） */
const TARGET_RMS_DB = -20;
const NORMALIZE_MIN_DB = -10;
const NORMALIZE_MAX_DB = 14;
const RMS_BLOCK_SECONDS = 0.05;
const RMS_ABSOLUTE_GATE_DB = -50;
const RMS_RELATIVE_GATE_DB = -15;

const RADIO_COMPRESSOR: CompressorSettings = {
  threshold: -24,
  knee: 6,
  ratio: 4,
  attack: 0.004,
  release: 0.16,
};
const NARRATION_COMPRESSOR: CompressorSettings = {
  threshold: -22,
  knee: 10,
  ratio: 2.2,
  attack: 0.008,
  release: 0.25,
};
/** 电台软饱和：tanh(k·x) / tanh(k) */
const RADIO_DRIVE = 1.8;
const RADIO_BAND_LOW = 300;
const RADIO_BAND_HIGH = 3400;
const RADIO_PRESENCE_HZ = 1900;
const RADIO_PRESENCE_DB = 3;
const NARRATION_HIGHPASS_HZ = 70;

/** 无线电台词在“开麦”提示音（AudioManager.playRadioOpen）之后开口 */
const RADIO_LEAD_SECONDS = 0.14;
const NARRATION_LEAD_SECONDS = 0.03;
const RESUME_LEAD_SECONDS = 0.02;
const FADE_IN_SECONDS = 0.012;
const STOP_FADE_SECONDS = 0.05;
const PAUSE_FADE_SECONDS = 0.03;
const END_EPSILON_SECONDS = 0.05;
/** 看门狗余量：开口 + 剩余时长 + 余量（实时）后仍未收到 onended 就按说完处理 */
const WATCHDOG_GRACE_SECONDS = 2.5;
/** 静噪尾音长度（含释放） */
const TAIL_SECONDS = 0.26;

const DEFAULT_RADIO_START_DELAY_MS = 1500;
const DEFAULT_NARRATION_START_DELAY_MS = 2500;

/**
 * 闪避：无线电压到 0.45（约 −7 dB），旁白 0.5（约 −6 dB）；说完 1.2 秒后用 0.8 秒恢复
 * （两句无线电之间约 1 秒：尾巴 0.4 + 淡出 0.26 + 间隔 0.18 + 开口 0.14，音乐不在句间回弹）
 */
const RADIO_DUCK_LEVEL = 0.45;
const NARRATION_DUCK_LEVEL = 0.5;
const DUCK_ATTACK_SECONDS = 0.15;
const DUCK_RELEASE_SECONDS = 0.8;
const DUCK_RELEASE_DELAY_SECONDS = 1.2;

/** 缓存：解码后至多 16 句 / 120 秒（48 kHz 单声道约 23 MB）；编码数据至多 6 MB（约三章） */
const DECODED_MAX_ENTRIES = 16;
const DECODED_MAX_SECONDS = 120;
const ENCODED_MAX_BYTES = 6 * 1024 * 1024;
const PREFETCH_CONCURRENCY = 3;
/** 预取时立即解码的前几句（章节简报 + 入关台词），其余只取编码数据 */
const PREFETCH_DECODE_COUNT = 6;
const MANIFEST_RETRY_MS = 20000;
const MAX_DEBUG_EVENTS = 40;

function nowMs(): number {
  const clock = globalThis.performance;
  return clock && typeof clock.now === 'function' ? clock.now() : Date.now();
}

/** 界面语言 → 语音包语言 */
export function getVoicePackLanguage(locale: Locale = getLocale()): VoicePackLanguage {
  return locale === 'zh-CN' ? 'zh' : 'en';
}

function defaultBaseUrl(): string {
  let base = '/';
  try {
    const env = import.meta.env as { BASE_URL?: unknown } | undefined;
    if (env && typeof env.BASE_URL === 'string' && env.BASE_URL) {
      base = env.BASE_URL;
    }
  } catch {
    base = '/';
  }
  return `${base.endsWith('/') ? base : `${base}/`}voice/`;
}

function defaultFetch(): VoiceFetch | null {
  const candidate = (globalThis as { fetch?: unknown }).fetch;
  if (typeof candidate !== 'function') {
    return null;
  }
  return (url: string) => (candidate as (input: string) => Promise<VoiceFetchResponse>)(url);
}

function defer(callback: () => void): void {
  const run = (): void => {
    try {
      callback();
    } catch (error) {
      console.error('[VoiceSystem] callback failed', error);
    }
  };
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(run);
  } else {
    void Promise.resolve().then(run);
  }
}

interface ParsedManifest {
  version: number;
  format: string;
  languages: Map<VoicePackLanguage, Map<string, VoiceManifestEntry>>;
}

function parseManifest(raw: unknown): ParsedManifest | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as { format?: unknown; languages?: unknown };
  if (typeof record.languages !== 'object' || record.languages === null) {
    return null;
  }
  const format =
    typeof record.format === 'string' && /^[a-z0-9]+$/i.test(record.format) ? record.format : 'mp3';
  const version =
    typeof (raw as { version?: unknown }).version === 'number' &&
    Number.isFinite((raw as { version: number }).version)
      ? (raw as { version: number }).version
      : 1;
  const languages = new Map<VoicePackLanguage, Map<string, VoiceManifestEntry>>();
  for (const language of ['en', 'zh'] as const) {
    const lines = (record.languages as Record<string, unknown>)[language];
    if (typeof lines !== 'object' || lines === null) {
      continue;
    }
    const entries = new Map<string, VoiceManifestEntry>();
    for (const [id, value] of Object.entries(lines as Record<string, unknown>)) {
      const duration = (value as { duration?: unknown } | null)?.duration;
      if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
        entries.set(id, { duration });
      }
    }
    languages.set(language, entries);
  }
  return { version, format, languages };
}

/** decodeAudioData：兼容只支持回调写法的旧 Safari */
function decodeAudio(context: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    try {
      const result = context.decodeAudioData(data, resolve, reject) as
        | Promise<AudioBuffer>
        | undefined;
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 门限 RMS → 归一化增益（dB）。语音的门限 RMS 与 EBU R128 积分响度的偏差约 +1 dB（标准差 0.4 dB，
 * 用语音包实测），足够把不同角色 / 语言拉到同一响度。
 */
export function measureVoiceGainDb(buffer: AudioBuffer): number {
  try {
    const channels = Math.max(1, Math.min(2, buffer.numberOfChannels || 1));
    const length = buffer.length;
    const rate = buffer.sampleRate > 0 ? buffer.sampleRate : 44100;
    const block = Math.max(1, Math.round(rate * RMS_BLOCK_SECONDS));
    if (length < block) {
      return 0;
    }
    const data: Float32Array[] = [];
    for (let channel = 0; channel < channels; channel++) {
      data.push(buffer.getChannelData(channel));
    }
    const absoluteGate = Math.pow(10, RMS_ABSOLUTE_GATE_DB / 10);
    const powers: number[] = [];
    for (let start = 0; start + block <= length; start += block) {
      let sum = 0;
      for (const samples of data) {
        for (let i = start; i < start + block; i++) {
          const sample = samples[i];
          sum += sample * sample;
        }
      }
      const power = sum / (block * data.length);
      if (power > absoluteGate) {
        powers.push(power);
      }
    }
    if (powers.length === 0) {
      return 0;
    }
    let mean = 0;
    for (const power of powers) mean += power;
    mean /= powers.length;
    const relativeGate = mean * Math.pow(10, RMS_RELATIVE_GATE_DB / 10);
    let loud = 0;
    let count = 0;
    for (const power of powers) {
      if (power > relativeGate) {
        loud += power;
        count++;
      }
    }
    const rmsDb = 10 * Math.log10(count > 0 ? loud / count : mean);
    if (!Number.isFinite(rmsDb)) {
      return 0;
    }
    return Math.max(NORMALIZE_MIN_DB, Math.min(NORMALIZE_MAX_DB, TARGET_RMS_DB - rmsDb));
  } catch {
    return 0;
  }
}

function createDriveCurve(drive: number, size = 1025) {
  // 显式 ArrayBuffer 让类型满足 WaveShaperNode.curve（不接受 SharedArrayBuffer 视图）
  const curve = new Float32Array(new ArrayBuffer(size * Float32Array.BYTES_PER_ELEMENT));
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

function createBiquad(
  context: BaseAudioContext,
  type: BiquadFilterType,
  frequency: number,
  q: number,
  gainDb = 0
): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  if (gainDb !== 0) {
    filter.gain.value = gainDb;
  }
  return filter;
}

/** 插入顺序即最近使用顺序的小 LRU（Map 迭代顺序 = 插入顺序） */
class LruCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(
    private readonly weigh: (value: T) => number,
    private readonly maxEntries: number,
    private readonly maxWeight: number
  ) {}

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    let weight = this.totalWeight();
    for (const [oldest, entry] of this.entries) {
      if (this.entries.size <= this.maxEntries && weight <= this.maxWeight) {
        break;
      }
      if (oldest === key) {
        continue;
      }
      this.entries.delete(oldest);
      weight -= this.weigh(entry);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  totalWeight(): number {
    let weight = 0;
    for (const value of this.entries.values()) {
      weight += this.weigh(value);
    }
    return weight;
  }

  clear(): void {
    this.entries.clear();
  }
}

export class VoiceSystem {
  private readonly baseUrl: string;
  private readonly fetchImpl: VoiceFetch | null;
  private graph: VoiceGraph | null = null;
  private volume = INITIAL_VOICE_VOLUME;
  private paused = false;
  private disposed = false;
  private ducked = false;
  private handleSeq = 0;
  private current: VoiceRequest | null = null;

  private manifest: ParsedManifest | null = null;
  private manifestPromise: Promise<ParsedManifest | null> | null = null;
  private manifestState: VoiceDebugState['manifest'] = 'idle';
  private manifestFailedAt = Number.NEGATIVE_INFINITY;

  private readonly decoded = new LruCache<LoadedLine>(
    (line) => line.buffer.duration,
    DECODED_MAX_ENTRIES,
    DECODED_MAX_SECONDS
  );
  private readonly encoded = new LruCache<ArrayBuffer>(
    (data) => data.byteLength,
    Number.POSITIVE_INFINITY,
    ENCODED_MAX_BYTES
  );
  private readonly pendingDecodes = new Map<string, Promise<LoadResult>>();
  private readonly pendingFetches = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly events: VoiceDebugEvent[] = [];
  private lastPrefetch: string[] = [];
  private prefetchGeneration = 0;
  private readonly unsubscribeLocale: () => void;

  constructor(options: VoiceSystemOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultBaseUrl();
    this.fetchImpl = options.fetch ?? defaultFetch();
    // 切换语言：停下正在说的台词（字幕已换语言），下一句按新语言的语音包播放
    this.unsubscribeLocale = onLocaleChange(() => this.handleLocaleChange());
  }

  // ───────────────────────────── 清单 ─────────────────────────────

  /** 加载语音包清单（只请求一次；失败后 20 秒内不重试）；不可用时为 null */
  public loadManifest(): Promise<VoiceManifest | null> {
    return this.ensureManifest().then((manifest) =>
      manifest ? this.toPublicManifest(manifest) : null
    );
  }

  private ensureManifest(): Promise<ParsedManifest | null> {
    if (this.manifest) {
      return Promise.resolve(this.manifest);
    }
    if (this.manifestPromise) {
      return this.manifestPromise;
    }
    if (this.disposed || !this.fetchImpl || nowMs() - this.manifestFailedAt < MANIFEST_RETRY_MS) {
      return Promise.resolve(null);
    }
    const fetchImpl = this.fetchImpl;
    this.manifestState = 'loading';
    const promise = (async (): Promise<ParsedManifest | null> => {
      try {
        const response = await fetchImpl(`${this.baseUrl}manifest.json`);
        const parsed = response.ok ? parseManifest(await response.json()) : null;
        if (parsed) {
          this.manifest = parsed;
          this.manifestState = 'ready';
          return parsed;
        }
      } catch {
        // 离线 / 没有语音包：纯文字
      }
      this.manifestState = 'failed';
      this.manifestFailedAt = nowMs();
      log.warn('Voice manifest unavailable; radio and story play text-only');
      return null;
    })();
    this.manifestPromise = promise;
    void promise.then((result) => {
      if (!result && this.manifestPromise === promise) {
        this.manifestPromise = null;
      }
    });
    return promise;
  }

  private toPublicManifest(manifest: ParsedManifest): VoiceManifest {
    const languages: Partial<Record<VoicePackLanguage, Record<string, VoiceManifestEntry>>> = {};
    for (const [language, entries] of manifest.languages) {
      languages[language] = Object.fromEntries(entries);
    }
    return { version: manifest.version, format: manifest.format, languages };
  }

  /** 当前（或指定）语言的语音包里有这句（清单未加载时为 false） */
  public hasLine(lineId: string, locale: Locale = getLocale()): boolean {
    return this.manifest?.languages.get(getVoicePackLanguage(locale))?.has(lineId) ?? false;
  }

  /** 清单记录的配音时长（秒）；没有这句 / 清单未加载时为 null */
  public getLineDuration(lineId: string, locale: Locale = getLocale()): number | null {
    return (
      this.manifest?.languages.get(getVoicePackLanguage(locale))?.get(lineId)?.duration ?? null
    );
  }

  // ───────────────────────────── 播放 ─────────────────────────────

  /**
   * 播放一句配音（顶掉正在说 / 正在加载的那句）。立即返回请求编号，从不抛错；
   * 结果经 onStart → onEnd | onSilent('stopped' …)，或直接 onSilent(原因) 异步回调。
   */
  public play(lineId: string, options: VoicePlayOptions): number {
    const handle = ++this.handleSeq;
    const safeOptions: VoicePlayOptions = options ?? { kind: 'radio' };
    const kind: VoiceKind = safeOptions.kind === 'narration' ? 'narration' : 'radio';
    const locale = getLocale();
    const request: VoiceRequest = {
      handle,
      lineId: typeof lineId === 'string' ? lineId : '',
      kind,
      speaker: typeof safeOptions.speaker === 'string' ? safeOptions.speaker : null,
      locale,
      language: getVoicePackLanguage(locale),
      options: safeOptions,
      requestedAtMs: nowMs(),
      phase: 'loading',
      deadline: null,
      watchdog: null,
      buffer: null,
      gainDb: 0,
      offset: 0,
      sourceStartedAt: 0,
      source: null,
      lineGain: null,
      hissGain: null,
      hissSource: null,
      tailGate: null,
      nodes: [],
      startNotified: false,
    };
    try {
      if (this.current) {
        this.cancel(this.current, 'superseded');
      }
      this.trace('request', request);
      if (this.disposed) {
        this.decline(request, 'disposed');
        return handle;
      }
      if (!request.lineId || (this.manifest && !this.hasLine(request.lineId, locale))) {
        this.decline(request, 'unavailable');
        return handle;
      }
      if (this.volume <= 0) {
        this.decline(request, 'muted');
        return handle;
      }
      this.current = request;
      const fallbackDelay =
        kind === 'radio' ? DEFAULT_RADIO_START_DELAY_MS : DEFAULT_NARRATION_START_DELAY_MS;
      const maxDelay =
        typeof safeOptions.maxStartDelayMs === 'number' &&
        Number.isFinite(safeOptions.maxStartDelayMs)
          ? Math.max(0, safeOptions.maxStartDelayMs)
          : fallbackDelay;
      request.deadline = setTimeout(() => {
        request.deadline = null;
        if (this.current === request && request.phase === 'loading') {
          this.cancel(request, 'timeout');
        }
      }, maxDelay);
      void this.loadLine(request.language, request.lineId).then(
        (result) => this.handleLoaded(request, result),
        () => this.handleLoaded(request, { reason: 'error' })
      );
    } catch {
      this.decline(request, 'error');
    }
    return handle;
  }

  /** 停下当前配音（可只停某一类）；正在加载的那句也作废 */
  public stop(kind?: VoiceKind): void {
    const request = this.current;
    if (!request || (kind && request.kind !== kind)) {
      return;
    }
    this.cancel(request, 'stopped');
  }

  /** 停下一切配音（关卡结束、失败、退出、切换语言） */
  public stopAll(): void {
    const request = this.current;
    if (request) {
      this.cancel(request, 'stopped');
    }
    this.releaseDuck(0);
  }

  /** 有配音正在说（或暂停中 / 加载中）；可只看某一类 */
  public isSpeaking(kind?: VoiceKind): boolean {
    const request = this.current;
    return !!request && (!kind || request.kind === kind) && request.phase !== 'loading';
  }

  /** 跟随游戏暂停：当前配音淡出并记住断点 */
  public pause(): void {
    if (this.paused || this.disposed) {
      return;
    }
    this.paused = true;
    const request = this.current;
    if (request && request.phase === 'playing') {
      const context = this.graph?.context;
      const remaining = request.buffer ? request.buffer.duration - request.offset : 0;
      const played = context
        ? Math.max(0, Math.min(remaining, context.currentTime - request.sourceStartedAt))
        : 0;
      request.offset = Math.min(request.buffer?.duration ?? 0, request.offset + played);
      this.silence(request, PAUSE_FADE_SECONDS);
      request.phase = 'paused';
      this.trace('pause', request, { offset: request.offset });
    }
    this.releaseDuck(0);
  }

  /** 游戏继续：从断点续播（断点已到结尾则视为说完） */
  public resume(): void {
    if (!this.paused || this.disposed) {
      return;
    }
    this.paused = false;
    const request = this.current;
    if (!request || request.phase !== 'paused') {
      return;
    }
    const duration = request.buffer?.duration ?? 0;
    this.trace('resume', request, { offset: request.offset });
    if (!request.buffer || request.offset >= duration - END_EPSILON_SECONDS) {
      this.finish(request);
      return;
    }
    this.startPlayback(request, request.offset);
  }

  public isPaused(): boolean {
    return this.paused;
  }

  /** 语音音量 0..1（非有限值忽略）；调到 0 时立即停下当前配音，之后的台词纯文字显示 */
  public setVolume(volume: number): void {
    if (!Number.isFinite(volume)) {
      return;
    }
    this.volume = clamp01(volume);
    const graph = this.graph;
    if (graph) {
      const target = this.volume * VOICE_BUS_LEVEL;
      try {
        const now = graph.context.currentTime;
        graph.output.gain.cancelScheduledValues(now);
        graph.output.gain.setTargetAtTime(target, now, 0.03);
      } catch {
        graph.output.gain.value = target;
      }
    }
    if (this.volume <= 0 && this.current) {
      this.cancel(this.current, 'muted');
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  // ───────────────────────────── 预取 ─────────────────────────────

  /**
   * 预取一批台词（当前语言）：前几句立即获取并解码，其余只取编码数据；清单里没有的 id 跳过。
   * 切换语言后按新语言重新预取最近一批。
   */
  public prefetch(lineIds: readonly string[]): void {
    if (this.disposed || !Array.isArray(lineIds)) {
      return;
    }
    const unique = Array.from(new Set(lineIds.filter((id) => typeof id === 'string' && id)));
    this.lastPrefetch = unique;
    this.runPrefetch(unique, getVoicePackLanguage());
  }

  private runPrefetch(lineIds: readonly string[], language: VoicePackLanguage): void {
    const generation = ++this.prefetchGeneration;
    if (lineIds.length === 0 || this.volume <= 0) {
      return;
    }
    void this.ensureManifest().then((manifest) => {
      if (!manifest || this.disposed || generation !== this.prefetchGeneration) {
        return;
      }
      const available = manifest.languages.get(language);
      const queue = lineIds.filter((id) => available?.has(id));
      this.record({
        t: nowMs(),
        event: 'prefetch',
        lineId: `${queue.length}/${lineIds.length}`,
        locale: getLocale(),
      });
      let index = 0;
      const worker = async (): Promise<void> => {
        while (index < queue.length && generation === this.prefetchGeneration && !this.disposed) {
          const position = index++;
          const id = queue[position];
          if (position < PREFETCH_DECODE_COUNT) {
            await this.loadLine(language, id);
          } else {
            await this.fetchEncoded(language, id, manifest.format);
          }
        }
      };
      for (let i = 0; i < PREFETCH_CONCURRENCY; i++) {
        void worker().catch(() => undefined);
      }
    });
  }

  // ───────────────────────────── 加载 / 缓存 ─────────────────────────────

  private loadLine(language: VoicePackLanguage, lineId: string): Promise<LoadResult> {
    const key = `${language}/${lineId}`;
    const cached = this.decoded.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    const pending = this.pendingDecodes.get(key);
    if (pending) {
      return pending;
    }
    const promise = (async (): Promise<LoadResult> => {
      const manifest = await this.ensureManifest();
      if (!manifest || !manifest.languages.get(language)?.has(lineId)) {
        return { reason: 'unavailable' };
      }
      const context = this.ensureContext();
      if (!context || typeof context.decodeAudioData !== 'function') {
        return { reason: 'unavailable' };
      }
      const data = await this.fetchEncoded(language, lineId, manifest.format);
      if (!data || this.disposed) {
        return { reason: 'error' };
      }
      try {
        // decodeAudioData 会转移（detach）传入的 ArrayBuffer：解码副本，编码缓存保持完整
        const buffer = await decodeAudio(context, data.slice(0));
        if (!buffer || !(buffer.duration > 0)) {
          return { reason: 'error' };
        }
        const line: LoadedLine = { buffer, gainDb: measureVoiceGainDb(buffer) };
        this.decoded.set(key, line);
        return line;
      } catch {
        return { reason: 'error' };
      }
    })();
    this.pendingDecodes.set(key, promise);
    void promise.then(
      () => this.pendingDecodes.delete(key),
      () => this.pendingDecodes.delete(key)
    );
    return promise;
  }

  private fetchEncoded(
    language: VoicePackLanguage,
    lineId: string,
    format: string
  ): Promise<ArrayBuffer | null> {
    const key = `${language}/${lineId}`;
    const cached = this.encoded.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    const pending = this.pendingFetches.get(key);
    if (pending) {
      return pending;
    }
    const fetchImpl = this.fetchImpl;
    if (!fetchImpl) {
      return Promise.resolve(null);
    }
    const url = `${this.baseUrl}${language}/${encodeURIComponent(lineId)}.${format}`;
    const promise = (async (): Promise<ArrayBuffer | null> => {
      try {
        const response = await fetchImpl(url);
        if (!response.ok) {
          return null;
        }
        const data = await response.arrayBuffer();
        if (!data || data.byteLength === 0) {
          return null;
        }
        this.encoded.set(key, data);
        return data;
      } catch {
        return null;
      }
    })();
    this.pendingFetches.set(key, promise);
    void promise.then(
      () => this.pendingFetches.delete(key),
      () => this.pendingFetches.delete(key)
    );
    return promise;
  }

  // ───────────────────────────── 音频图 ─────────────────────────────

  private ensureContext(): AudioContext | null {
    if (this.disposed) {
      return null;
    }
    const existing = this.graph?.context;
    if (existing && existing.state !== 'closed') {
      return existing;
    }
    try {
      return acquireSharedAudioContext(this);
    } catch {
      return null;
    }
  }

  /**
   * 人声总线：
   * - 旁白：输入 → 高通 70 Hz → 轻压缩 → 电平 → 输出
   * - 无线电：输入 → 高通 300 / 低通 3400（与逐句带通叠成 24 dB/倍频程）→ 存在感峰值 → 软饱和 → 压缩 → 电平 → 输出
   * - 输出：用户语音音量 → 共享输出（限幅 + 软削波）
   * 压缩器、软饱和都做特性检测，缺失时跳过。
   */
  private ensureGraph(): VoiceGraph | null {
    const context = this.ensureContext();
    if (!context) {
      return null;
    }
    if (this.graph && this.graph.context === context) {
      return this.graph;
    }
    this.teardownGraph();
    const nodes: AudioNode[] = [];
    try {
      const output = context.createGain();
      output.gain.value = this.volume * VOICE_BUS_LEVEL;
      output.connect(getSharedOutputNode(context));
      nodes.push(output);

      const narrationInput = context.createGain();
      const narrationHighpass = createBiquad(context, 'highpass', NARRATION_HIGHPASS_HZ, 0.7);
      narrationInput.connect(narrationHighpass);
      nodes.push(narrationInput, narrationHighpass);
      const narrationTail = this.appendCompressor(
        context,
        narrationHighpass,
        NARRATION_COMPRESSOR,
        nodes
      );
      const narrationLevel = context.createGain();
      narrationLevel.gain.value = NARRATION_BUS_LEVEL;
      narrationTail.connect(narrationLevel);
      narrationLevel.connect(output);
      nodes.push(narrationLevel);

      const radioInput = context.createGain();
      const bandLow = createBiquad(context, 'highpass', RADIO_BAND_LOW, 0.707);
      const bandHigh = createBiquad(context, 'lowpass', RADIO_BAND_HIGH, 0.707);
      const presence = createBiquad(context, 'peaking', RADIO_PRESENCE_HZ, 0.9, RADIO_PRESENCE_DB);
      radioInput.connect(bandLow);
      bandLow.connect(bandHigh);
      bandHigh.connect(presence);
      nodes.push(radioInput, bandLow, bandHigh, presence);
      let radioTail: AudioNode = presence;
      if (typeof context.createWaveShaper === 'function') {
        try {
          const shaper = context.createWaveShaper();
          shaper.curve = createDriveCurve(RADIO_DRIVE);
          shaper.oversample = '2x';
          radioTail.connect(shaper);
          radioTail = shaper;
          nodes.push(shaper);
        } catch {
          // 没有软饱和也能用
        }
      }
      radioTail = this.appendCompressor(context, radioTail, RADIO_COMPRESSOR, nodes);
      const radioLevel = context.createGain();
      radioLevel.gain.value = RADIO_BUS_LEVEL;
      radioTail.connect(radioLevel);
      radioLevel.connect(output);
      nodes.push(radioLevel);

      this.graph = { context, output, radioInput, narrationInput, nodes };
      return this.graph;
    } catch {
      disconnectNodes(nodes);
      this.graph = null;
      return null;
    }
  }

  /** 补偿增益 → 压缩器（抵消浏览器的自动补偿，阈值以下保持单位增益）；不支持时原样返回 */
  private appendCompressor(
    context: AudioContext,
    tail: AudioNode,
    settings: CompressorSettings,
    nodes: AudioNode[]
  ): AudioNode {
    const compressor = createCompressor(context, settings);
    if (!compressor) {
      return tail;
    }
    const trim = context.createGain();
    trim.gain.value = dbToGain(-estimateCompressorMakeupDb(settings));
    tail.connect(trim);
    trim.connect(compressor);
    nodes.push(trim, compressor);
    return compressor;
  }

  private teardownGraph(): void {
    if (this.graph) {
      disconnectNodes(this.graph.nodes);
      this.graph = null;
    }
  }

  /**
   * 诊断：在人声总线出口（语音音量之后）挂一个 AnalyserNode 测电平；不支持时返回 null。
   * 调用方负责 disconnect。
   */
  public createOutputAnalyser(): AnalyserNode | null {
    const graph = this.ensureGraph();
    if (!graph || typeof graph.context.createAnalyser !== 'function') {
      return null;
    }
    try {
      const analyser = graph.context.createAnalyser();
      analyser.fftSize = 2048;
      graph.output.connect(analyser);
      return analyser;
    } catch {
      return null;
    }
  }

  // ───────────────────────────── 单句播放 ─────────────────────────────

  private handleLoaded(request: VoiceRequest, result: LoadResult): void {
    if (this.current !== request || request.phase !== 'loading') {
      return; // 已被顶掉 / 停下 / 超时（都已回调过）
    }
    this.clearDeadline(request);
    if ('reason' in result) {
      this.cancel(request, result.reason);
      return;
    }
    request.buffer = result.buffer;
    request.gainDb = result.gainDb;
    if (this.paused) {
      request.phase = 'paused';
      request.offset = 0;
      return;
    }
    this.startPlayback(request, 0);
  }

  private startPlayback(request: VoiceRequest, offset: number): void {
    const graph = this.ensureGraph();
    const buffer = request.buffer;
    if (!graph || !buffer || graph.context.state === 'closed') {
      this.cancel(request, 'unavailable');
      return;
    }
    const context = graph.context;
    if (context.state !== 'running') {
      resumeSharedAudioContext();
    }
    try {
      const now = context.currentTime;
      const safeOffset = Math.max(0, Math.min(buffer.duration - END_EPSILON_SECONDS, offset));
      let lead = RESUME_LEAD_SECONDS;
      if (safeOffset <= 0) {
        lead =
          request.kind === 'radio'
            ? Math.max(
                RESUME_LEAD_SECONDS,
                RADIO_LEAD_SECONDS - (nowMs() - request.requestedAtMs) / 1000
              )
            : NARRATION_LEAD_SECONDS;
      }
      const startAt = now + lead;
      const endAt = startAt + (buffer.duration - safeOffset);
      const nodes: AudioNode[] = [];

      const source = context.createBufferSource();
      source.buffer = buffer;
      const lineGain = context.createGain();
      const level = Math.max(MIN_GAIN, dbToGain(request.gainDb));
      lineGain.gain.value = 0;
      lineGain.gain.setValueAtTime(0, startAt);
      lineGain.gain.linearRampToValueAtTime(level, startAt + FADE_IN_SECONDS);
      source.connect(lineGain);
      nodes.push(source, lineGain);

      let hissSource: AudioBufferSourceNode | null = null;
      let hissGain: GainNode | null = null;
      let tailGate: GainNode | null = null;
      if (request.kind === 'radio') {
        const profile =
          (request.speaker && RADIO_PROFILES[request.speaker]) || DEFAULT_RADIO_PROFILE;
        const lineLow = createBiquad(context, 'highpass', profile.low, 0.75);
        const lineHigh = createBiquad(context, 'lowpass', profile.high, 0.75);
        lineGain.connect(lineLow);
        lineLow.connect(lineHigh);
        lineHigh.connect(graph.radioInput);
        nodes.push(lineLow, lineHigh);

        // 底噪：随台词淡入淡出，同样经过逐句带通与电台链
        try {
          const noiseSource = createNoiseSource(context, 'white');
          hissGain = context.createGain();
          hissGain.gain.value = 0;
          hissGain.gain.setValueAtTime(0, startAt);
          hissGain.gain.linearRampToValueAtTime(profile.hiss, startAt + 0.03);
          hissGain.gain.setValueAtTime(profile.hiss, endAt);
          hissGain.gain.linearRampToValueAtTime(0, endAt + 0.04);
          noiseSource.source.connect(hissGain);
          hissGain.connect(lineLow);
          noiseSource.source.start(startAt, noiseSource.offset);
          noiseSource.source.stop(endAt + 0.06);
          hissSource = noiseSource.source;
          nodes.push(noiseSource.source, hissGain);
        } catch {
          hissSource = null;
          hissGain = null;
        }

        // 静噪尾音（自然说完时）：经可单独静音的门，打断 / 暂停时不出声
        tailGate = context.createGain();
        tailGate.connect(lineLow);
        nodes.push(tailGate);
        this.renderSquelchTail(context, tailGate, endAt);
      } else {
        lineGain.connect(graph.narrationInput);
      }

      source.onended = () => this.handleSourceEnded(request, source);
      source.start(startAt, safeOffset);
      this.clearWatchdog(request);
      request.watchdog = setTimeout(
        () => {
          request.watchdog = null;
          if (request.source === source && request.phase === 'playing') {
            // 没收到 onended（上下文被挂起 / 事件丢失）：按说完处理
            this.silence(request, STOP_FADE_SECONDS);
            this.finish(request);
          }
        },
        (lead + buffer.duration - safeOffset + WATCHDOG_GRACE_SECONDS) * 1000
      );

      request.source = source;
      request.lineGain = lineGain;
      request.hissSource = hissSource;
      request.hissGain = hissGain;
      request.tailGate = tailGate;
      request.nodes = nodes;
      request.offset = safeOffset;
      request.sourceStartedAt = startAt;
      request.phase = 'playing';
      this.duck(request.kind);

      if (!request.startNotified) {
        request.startNotified = true;
        const info = this.describe(request);
        this.trace('start', request, {
          duration: info.duration,
          gainDb: Math.round(info.gainDb * 10) / 10,
        });
        const onStart = request.options.onStart;
        if (onStart) {
          defer(() => onStart(info));
        }
      }
    } catch {
      this.cancel(request, 'error');
    }
  }

  /** 静噪尾音：一小段带通噪声 + 一声短促的“咔” */
  private renderSquelchTail(context: AudioContext, out: AudioNode, at: number): void {
    const target: SfxTarget = { ctx: context, out, t: at, level: 1, random: Math.random };
    noise(target, {
      color: 'white',
      filter: { type: 'bandpass', freq: 2300, freqEnd: 1500, q: 0.9 },
      attack: 0.004,
      hold: 0.08,
      decay: 0.14,
      peak: 0.11,
    });
    tone(target, { type: 'square', freq: 1150, attack: 0.001, decay: 0.018, peak: 0.035 });
  }

  private handleSourceEnded(request: VoiceRequest, source: AudioBufferSourceNode): void {
    if (request.source !== source) {
      return; // 暂停 / 打断时主动停下的声源
    }
    request.source = null;
    this.finish(request);
  }

  /** 自然说完：尾音放完后回收节点，延迟恢复音乐，回调 onEnd */
  private finish(request: VoiceRequest): void {
    if (request.phase === 'ended' || request.phase === 'cancelled') {
      return;
    }
    request.phase = 'ended';
    if (this.current === request) {
      this.current = null;
    }
    this.clearDeadline(request);
    this.clearWatchdog(request);
    this.scheduleCleanup(request.nodes, (TAIL_SECONDS + 0.15) * 1000);
    request.nodes = [];
    this.releaseDuck(DUCK_RELEASE_DELAY_SECONDS);
    const info = this.describe(request);
    this.trace('end', request, { duration: info.duration });
    const onEnd = request.options.onEnd;
    if (onEnd) {
      defer(() => onEnd(info));
    }
  }

  /** 作废一个请求：停下声音并回调 onSilent(reason) */
  private cancel(request: VoiceRequest, reason: VoiceSilentReason): void {
    if (request.phase === 'ended' || request.phase === 'cancelled') {
      return;
    }
    request.phase = 'cancelled';
    if (this.current === request) {
      this.current = null;
    }
    this.clearDeadline(request);
    this.silence(request, STOP_FADE_SECONDS);
    // 被下一句顶掉时延迟恢复（下一句通常马上开口）；其余立即平滑恢复
    this.releaseDuck(reason === 'superseded' ? DUCK_RELEASE_DELAY_SECONDS : 0);
    this.notifySilent(request, reason);
  }

  /** 请求从未开始：直接回调 onSilent */
  private decline(request: VoiceRequest, reason: VoiceSilentReason): void {
    request.phase = 'cancelled';
    if (this.current === request) {
      this.current = null;
    }
    this.notifySilent(request, reason);
  }

  private notifySilent(request: VoiceRequest, reason: VoiceSilentReason): void {
    this.trace('silent', request, { reason });
    if (reason === 'error') {
      log.debug(`Voice line ${request.language}/${request.lineId} failed to load`);
    }
    const onSilent = request.options.onSilent;
    if (onSilent) {
      defer(() => onSilent(reason));
    }
  }

  /** 淡出并停下当前声源 / 底噪，尾音门静音；节点稍后回收 */
  private silence(request: VoiceRequest, fadeSeconds: number): void {
    const source = request.source;
    request.source = null;
    this.clearWatchdog(request);
    const context = this.graph?.context;
    if (context && context.state !== 'closed') {
      const now = context.currentTime;
      const fadeParam = (node: GainNode | null): void => {
        if (!node) return;
        try {
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(node.gain.value, now);
          node.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        } catch {
          node.gain.value = 0;
        }
      };
      fadeParam(request.lineGain);
      fadeParam(request.hissGain);
      if (request.tailGate) {
        try {
          request.tailGate.gain.cancelScheduledValues(now);
          request.tailGate.gain.setValueAtTime(0, now);
        } catch {
          request.tailGate.gain.value = 0;
        }
      }
      const stopAt = now + fadeSeconds + 0.01;
      for (const node of [source, request.hissSource]) {
        if (!node) continue;
        try {
          node.onended = null;
          node.stop(stopAt);
        } catch {
          // 已经停下
        }
      }
    }
    request.hissSource = null;
    request.hissGain = null;
    request.lineGain = null;
    request.tailGate = null;
    this.scheduleCleanup(request.nodes, (fadeSeconds + 0.1) * 1000);
    request.nodes = [];
  }

  private scheduleCleanup(nodes: AudioNode[], delayMs: number): void {
    if (nodes.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(timer);
      disconnectNodes(nodes);
    }, delayMs);
    this.cleanupTimers.add(timer);
  }

  private clearDeadline(request: VoiceRequest): void {
    if (request.deadline !== null) {
      clearTimeout(request.deadline);
      request.deadline = null;
    }
  }

  private clearWatchdog(request: VoiceRequest): void {
    if (request.watchdog !== null) {
      clearTimeout(request.watchdog);
      request.watchdog = null;
    }
  }

  private describe(request: VoiceRequest): VoiceLineInfo {
    return {
      lineId: request.lineId,
      kind: request.kind,
      speaker: request.speaker,
      locale: request.locale,
      language: request.language,
      duration: request.buffer?.duration ?? 0,
      gainDb: request.gainDb,
    };
  }

  // ───────────────────────────── 闪避 ─────────────────────────────

  private duck(kind: VoiceKind): void {
    this.ducked = true;
    voiceDuckBridge.set(
      kind === 'radio' ? RADIO_DUCK_LEVEL : NARRATION_DUCK_LEVEL,
      DUCK_ATTACK_SECONDS,
      0
    );
  }

  private releaseDuck(delaySeconds: number): void {
    if (!this.ducked) {
      return;
    }
    this.ducked = false;
    voiceDuckBridge.set(1, DUCK_RELEASE_SECONDS, delaySeconds);
  }

  // ───────────────────────────── 语言 / 诊断 / 释放 ─────────────────────────────

  private handleLocaleChange(): void {
    if (this.disposed) {
      return;
    }
    this.stopAll();
    if (this.lastPrefetch.length > 0) {
      this.runPrefetch(this.lastPrefetch, getVoicePackLanguage());
    }
  }

  private trace(
    event: VoiceDebugEvent['event'],
    request: VoiceRequest,
    extra: Partial<VoiceDebugEvent> = {}
  ): void {
    this.record({
      t: nowMs(),
      event,
      lineId: request.lineId,
      locale: request.locale,
      kind: request.kind,
      ...extra,
    });
  }

  private record(event: VoiceDebugEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_DEBUG_EVENTS) {
      this.events.shift();
    }
  }

  /** 诊断快照：当前台词、缓存、闪避目标与最近的事件 */
  public getDebugState(): VoiceDebugState {
    const request = this.current;
    const manifestLines: Partial<Record<VoicePackLanguage, number>> = {};
    for (const [language, entries] of this.manifest?.languages ?? []) {
      manifestLines[language] = entries.size;
    }
    return {
      language: getVoicePackLanguage(),
      manifest: this.manifestState,
      manifestLines,
      volume: this.volume,
      paused: this.paused,
      current: request
        ? {
            lineId: request.lineId,
            kind: request.kind,
            phase: request.phase,
            locale: request.locale,
            duration: request.buffer?.duration ?? null,
            offset: request.offset,
            gainDb: request.gainDb,
          }
        : null,
      duckTarget: voiceDuckBridge.getLevel(),
      cache: {
        decoded: this.decoded.size,
        decodedSeconds: Math.round(this.decoded.totalWeight() * 10) / 10,
        encoded: this.encoded.size,
        encodedBytes: this.encoded.totalWeight(),
      },
      events: this.events.map((event) => ({ ...event })),
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    const request = this.current;
    if (request) {
      this.cancel(request, 'disposed');
    }
    this.releaseDuck(0);
    this.disposed = true;
    this.prefetchGeneration++;
    this.unsubscribeLocale();
    for (const timer of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
    this.teardownGraph();
    releaseSharedAudioContext(this);
    this.decoded.clear();
    this.encoded.clear();
    this.pendingDecodes.clear();
    this.pendingFetches.clear();
    this.lastPrefetch = [];
  }
}
