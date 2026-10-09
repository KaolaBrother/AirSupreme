import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSharedAudioContextForTests } from '@/core/Audio/AudioContextHost';
import { voiceDuckBridge } from '@/core/Audio/VoiceDucking';
import {
  VoiceSystem,
  getVoicePackLanguage,
  measureVoiceGainDb,
  type VoiceFetch,
  type VoiceFetchResponse,
  type VoiceKind,
  type VoiceLineInfo,
  type VoicePlayOptions,
  type VoiceSilentReason,
} from '@/core/Audio/VoiceSystem';
import { setLocale } from '@/i18n';
import { resetLocale } from './i18nTestUtils';

/**
 * VoiceSystem（src/core/Audio/VoiceSystem.ts）用假的 AudioContext 与 fetch 测试，不出真实声音：
 * - 按界面语言选包：en → /voice/en/，zh-CN → /voice/zh/；清单 /voice/manifest.json；
 * - 只请求清单里有的 id（缺失 → onSilent，不发请求）；音量 0 → 纯文字；
 * - 同一时刻一句（新的顶掉旧的）；stop / stopAll / pause / resume（从断点续播）；
 * - 看门狗：收不到 ended 时在“时长 + 2.5 秒”后按说完处理；
 * - 闪避：无线电 0.45、旁白 0.5，说完 1.2 秒后用 0.8 秒恢复；
 * - 预取去重；没有 AudioContext 时从不抛错；响度归一化到 −20 dBFS（夹在 −10…+14 dB）。
 */

const SAMPLE_RATE = 8000;
const MiB = 1024 * 1024;

function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

// ─────────────────────────────── 假 Web Audio ───────────────────────────────

function requireFinite(method: string, ...values: number[]): void {
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${method}: non-finite argument ${String(value)}`);
    }
  }
}

function requireTime(method: string, time: number): void {
  if (time < 0) {
    throw new RangeError(`${method}: negative time ${time}`);
  }
}

class FakeParam {
  private current: number;

  constructor(initial: number) {
    this.current = initial;
  }

  get value(): number {
    return this.current;
  }

  set value(next: number) {
    requireFinite('param.value', next);
    this.current = next;
  }

  setValueAtTime(value: number, time: number): this {
    requireFinite('setValueAtTime', value, time);
    requireTime('setValueAtTime', time);
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    requireFinite('linearRampToValueAtTime', value, time);
    requireTime('linearRampToValueAtTime', time);
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    requireFinite('exponentialRampToValueAtTime', value, time);
    if (value === 0) {
      throw new RangeError('exponentialRampToValueAtTime(0)');
    }
    requireTime('exponentialRampToValueAtTime', time);
    return this;
  }

  setTargetAtTime(target: number, time: number, constant: number): this {
    requireFinite('setTargetAtTime', target, time, constant);
    requireTime('setTargetAtTime', time);
    return this;
  }

  cancelScheduledValues(time: number): this {
    requireFinite('cancelScheduledValues', time);
    requireTime('cancelScheduledValues', time);
    return this;
  }
}

class FakeNode {
  readonly connections: unknown[] = [];

  constructor(readonly kind: string) {}

  connect<T>(destination: T): T {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.connections.length = 0;
  }
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeParam(1);

  constructor() {
    super('gain');
  }
}

class FakeBiquadNode extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  readonly gain = new FakeParam(0);
  readonly detune = new FakeParam(0);

  constructor() {
    super('biquad');
  }
}

class FakeCompressorNode extends FakeNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
  readonly reduction = 0;

  constructor() {
    super('compressor');
  }
}

class FakeWaveShaperNode extends FakeNode {
  curve: Float32Array | null = null;
  oversample = 'none';

  constructor() {
    super('waveshaper');
  }
}

class FakeAudioBuffer {
  readonly duration: number;
  private readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
    /** 解码出来的配音：语言/台词 id；噪声等其他缓冲区为 null */
    readonly lineKey: string | null = null
  ) {
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel];
    if (!data) {
      throw new RangeError(`getChannelData(${channel})`);
    }
    return data;
  }
}

class FakeScheduledSource extends FakeNode {
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  startOffset = 0;
  stoppedAt: number | null = null;
  ended = false;

  start(when = 0, offset = 0): void {
    requireFinite(`${this.kind}.start`, when, offset);
    if (when < 0 || offset < 0) {
      throw new RangeError(`${this.kind}.start negative argument`);
    }
    if (this.startedAt !== null) {
      throw new DOMException(`${this.kind}.start called twice`, 'InvalidStateError');
    }
    this.startedAt = when;
    this.startOffset = offset;
  }

  stop(when = 0): void {
    if (this.startedAt === null) {
      throw new DOMException(`${this.kind}.stop before start`, 'InvalidStateError');
    }
    requireFinite(`${this.kind}.stop`, when);
    this.stoppedAt = when;
  }

  /** 测试：声源自然播完（浏览器派发 ended） */
  finishPlaying(): void {
    this.ended = true;
    this.onended?.();
  }
}

class FakeBufferSourceNode extends FakeScheduledSource {
  buffer: FakeAudioBuffer | null = null;
  loop = false;

  constructor() {
    super('buffer-source');
  }
}

class FakeOscillatorNode extends FakeScheduledSource {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);

  constructor() {
    super('oscillator');
  }
}

interface EncodedLine {
  key: string;
  duration: number;
  amplitude: number;
}

/** 假的 mp3：时长、振幅与 “语言/id” 写在字节里，解码时还原 */
function encodeLine(line: EncodedLine, bytes: number): ArrayBuffer {
  const size = Math.max(bytes, 18 + line.key.length * 2);
  const data = new ArrayBuffer(size);
  const view = new DataView(data);
  view.setFloat64(0, line.duration);
  view.setFloat32(8, line.amplitude);
  view.setUint16(12, line.key.length);
  for (let i = 0; i < line.key.length; i++) {
    view.setUint16(18 + i * 2, line.key.charCodeAt(i));
  }
  return data;
}

function decodeLine(data: ArrayBuffer): EncodedLine | null {
  if (data.byteLength < 18) {
    return null;
  }
  const view = new DataView(data);
  const length = view.getUint16(12);
  let key = '';
  for (let i = 0; i < length; i++) {
    key += String.fromCharCode(view.getUint16(18 + i * 2));
  }
  return { key, duration: view.getFloat64(0), amplitude: view.getFloat32(8) };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: AudioContextState = 'running';
  readonly sampleRate = SAMPLE_RATE;
  readonly destination = new FakeNode('destination');
  readonly bufferSources: FakeBufferSourceNode[] = [];
  decodeCalls = 0;
  private readonly createdAtMs = performance.now();

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  /** 音频时钟跟随（被假定时器接管的）performance.now() */
  get currentTime(): number {
    return Math.max(0, (performance.now() - this.createdAtMs) / 1000);
  }

  resume(): Promise<void> {
    if (this.state !== 'closed') {
      this.state = 'running';
    }
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createBiquadFilter(): FakeBiquadNode {
    return new FakeBiquadNode();
  }

  createDynamicsCompressor(): FakeCompressorNode {
    return new FakeCompressorNode();
  }

  createWaveShaper(): FakeWaveShaperNode {
    return new FakeWaveShaperNode();
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode();
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    if (!Number.isInteger(channels) || channels < 1 || !(length >= 1) || sampleRate < 3000) {
      throw new DOMException(
        `createBuffer(${channels}, ${length}, ${sampleRate})`,
        'NotSupportedError'
      );
    }
    return new FakeAudioBuffer(channels, Math.floor(length), sampleRate);
  }

  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.bufferSources.push(source);
    return source;
  }

  decodeAudioData(
    data: ArrayBuffer,
    success?: (buffer: FakeAudioBuffer) => void,
    failure?: (error: DOMException) => void
  ): Promise<FakeAudioBuffer> {
    this.decodeCalls += 1;
    const line = decodeLine(data);
    if (!line || !(line.duration > 0)) {
      const error = new DOMException('Unable to decode audio data', 'EncodingError');
      failure?.(error);
      return Promise.reject(error);
    }
    const buffer = new FakeAudioBuffer(
      1,
      Math.round(line.duration * SAMPLE_RATE),
      SAMPLE_RATE,
      line.key
    );
    buffer.getChannelData(0).fill(line.amplitude);
    success?.(buffer);
    return Promise.resolve(buffer);
  }
}

function audioContext(): FakeAudioContext {
  const context = last(FakeAudioContext.instances);
  expect(context, 'expected an AudioContext').toBeDefined();
  return context as FakeAudioContext;
}

/** 配音声源（缓冲区是解码出来的台词；底噪与静噪尾音不算） */
function voiceSources(): FakeBufferSourceNode[] {
  return FakeAudioContext.instances.flatMap((context) =>
    context.bufferSources.filter((source) => source.buffer?.lineKey)
  );
}

function soundingVoices(): FakeBufferSourceNode[] {
  return voiceSources().filter(
    (source) => source.startedAt !== null && source.stoppedAt === null && !source.ended
  );
}

function lastVoiceSource(): FakeBufferSourceNode {
  const source = last(voiceSources());
  expect(source, 'expected a voice source').toBeDefined();
  return source as FakeBufferSourceNode;
}

// ─────────────────────────────── 假语音包服务器 ───────────────────────────────

interface LineFixture {
  duration: number;
  amplitude?: number;
  bytes?: number;
  /** 下载成功但无法解码 */
  corrupt?: boolean;
}

type PackFixture = Partial<Record<'en' | 'zh', Record<string, LineFixture>>>;

class FakeVoiceServer {
  readonly urls: string[] = [];
  manifestAvailable = true;
  /** 台词文件的响应挂起，直到 release() */
  holdLines = false;
  private readonly held: Array<() => void> = [];

  constructor(private readonly pack: PackFixture) {}

  readonly fetch: VoiceFetch = (url: string): Promise<VoiceFetchResponse> => {
    this.urls.push(url);
    if (url.endsWith('manifest.json')) {
      return Promise.resolve(this.manifestResponse());
    }
    const response = this.lineResponse(url);
    if (this.holdLines) {
      return new Promise((resolve) => this.held.push(() => resolve(response)));
    }
    return Promise.resolve(response);
  };

  release(): void {
    for (const resolve of this.held.splice(0)) {
      resolve();
    }
  }

  lineUrls(): string[] {
    return this.urls.filter((url) => !url.endsWith('manifest.json'));
  }

  manifest(): unknown {
    const languages: Record<string, Record<string, { duration: number; bytes: number }>> = {};
    for (const [language, lines] of Object.entries(this.pack)) {
      languages[language] = {};
      for (const [id, line] of Object.entries(lines ?? {})) {
        languages[language][id] = { duration: line.duration, bytes: line.bytes ?? 64 };
      }
    }
    return { version: 1, format: 'mp3', languages };
  }

  private manifestResponse(): VoiceFetchResponse {
    const ok = this.manifestAvailable;
    return {
      ok,
      json: () => (ok ? Promise.resolve(this.manifest()) : Promise.reject(new Error('404'))),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    };
  }

  private lineResponse(url: string): VoiceFetchResponse {
    const match = /\/(en|zh)\/([^/]+)\.mp3$/.exec(url);
    const language = match?.[1] as 'en' | 'zh' | undefined;
    const id = match ? decodeURIComponent(match[2]) : '';
    const line = language ? this.pack[language]?.[id] : undefined;
    if (!language || !line) {
      return {
        ok: false,
        json: () => Promise.reject(new Error('404')),
        arrayBuffer: () => Promise.reject(new Error('404')),
      };
    }
    const data = encodeLine(
      {
        key: `${language}/${id}`,
        duration: line.corrupt ? -1 : line.duration,
        amplitude: line.amplitude ?? 0.1,
      },
      line.bytes ?? 64
    );
    return {
      ok: true,
      json: () => Promise.reject(new Error('not json')),
      arrayBuffer: () => Promise.resolve(data),
    };
  }
}

// ─────────────────────────────── 通用 ───────────────────────────────

const PACK: PackFixture = {
  en: {
    'c01-test-hq': { duration: 2 },
    'c01-test-wingman': { duration: 3 },
    'prologue-1': { duration: 4 },
    'en-only': { duration: 2 },
  },
  zh: {
    'c01-test-hq': { duration: 2.5 },
    'c01-test-wingman': { duration: 3.5 },
    'prologue-1': { duration: 4.5 },
  },
};

interface PlayLog {
  starts: VoiceLineInfo[];
  ends: VoiceLineInfo[];
  silent: VoiceSilentReason[];
}

function track(
  kind: VoiceKind = 'radio',
  extra: Partial<VoicePlayOptions> = {}
): { log: PlayLog; options: VoicePlayOptions } {
  const log: PlayLog = { starts: [], ends: [], silent: [] };
  return {
    log,
    options: {
      kind,
      ...extra,
      onStart: (info) => log.starts.push(info),
      onEnd: (info) => log.ends.push(info),
      onSilent: (reason) => log.silent.push(reason),
    },
  };
}

/** 让 fetch / 解码 / 回调的微任务链跑完（不推进时间） */
async function settle(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    await Promise.resolve();
  }
}

/** 推进（假）时间，并让到期回调的微任务跑完 */
async function elapse(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await settle();
}

describe('VoiceSystem', () => {
  let server: FakeVoiceServer;
  let voice: VoiceSystem | null;
  let duckCalls: Array<[level: number, ramp: number, delay: number]>;

  function createVoice(options: { baseUrl?: string } = {}): VoiceSystem {
    voice = new VoiceSystem({ fetch: server.fetch, ...options });
    return voice;
  }

  /** 播放一句并等它开口 */
  async function startLine(
    id: string,
    kind: VoiceKind = 'radio'
  ): Promise<{ log: PlayLog; source: FakeBufferSourceNode }> {
    const system = voice ?? createVoice();
    const { log, options } = track(kind);
    system.play(id, options);
    await settle();
    expect(log.starts, `${id} should start`).toHaveLength(1);
    return { log, source: lastVoiceSource() };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudioContext.instances = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
    voiceDuckBridge.resetForTests();
    duckCalls = [];
    voiceDuckBridge.subscribe((level, ramp, delay) => {
      duckCalls.push([level, ramp, delay]);
    });
    server = new FakeVoiceServer(PACK);
    voice = null;
  });

  afterEach(() => {
    voice?.dispose();
    voice = null;
    resetSharedAudioContextForTests();
    voiceDuckBridge.resetForTests();
    resetLocale();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('voice pack by interface language', () => {
    it('maps the interface language to a pack', () => {
      expect(getVoicePackLanguage('en')).toBe('en');
      expect(getVoicePackLanguage('zh-CN')).toBe('zh');
    });

    it('loads /voice/manifest.json and plays English lines from /voice/en/', async () => {
      const { log } = await startLine('c01-test-hq');
      expect(server.urls).toEqual(['/voice/manifest.json', '/voice/en/c01-test-hq.mp3']);
      expect(log.starts[0]).toMatchObject({
        lineId: 'c01-test-hq',
        kind: 'radio',
        locale: 'en',
        language: 'en',
      });
      expect(log.starts[0].duration).toBeCloseTo(2, 3);
    });

    it('plays the Mandarin pack from /voice/zh/ when the interface is Chinese', async () => {
      setLocale('zh-CN');
      const { log } = await startLine('c01-test-hq');
      expect(server.lineUrls()).toEqual(['/voice/zh/c01-test-hq.mp3']);
      expect(log.starts[0]).toMatchObject({ locale: 'zh-CN', language: 'zh' });
      expect(log.starts[0].duration).toBeCloseTo(2.5, 3);
    });

    it('uses an injected base URL for the manifest and the lines', async () => {
      createVoice({ baseUrl: '/assets/voice/' });
      await startLine('c01-test-wingman');
      expect(server.urls).toEqual([
        '/assets/voice/manifest.json',
        '/assets/voice/en/c01-test-wingman.mp3',
      ]);
    });

    it('exposes the manifest per language through loadManifest and hasLine', async () => {
      const system = createVoice();
      expect(system.hasLine('c01-test-hq')).toBe(false);

      const manifest = await system.loadManifest();
      expect(manifest?.languages.en?.['c01-test-hq']?.duration).toBe(2);
      expect(manifest?.languages.zh?.['c01-test-hq']?.duration).toBe(2.5);
      expect(system.hasLine('c01-test-hq')).toBe(true);
      expect(system.hasLine('en-only', 'en')).toBe(true);
      expect(system.hasLine('en-only', 'zh-CN')).toBe(false);
      expect(system.hasLine('not-in-pack')).toBe(false);
      expect(server.lineUrls()).toEqual([]);
    });
  });

  describe('manifest gating', () => {
    it('never requests a line that is not in the manifest', async () => {
      const system = createVoice();
      const first = track();
      system.play('not-in-pack', first.options);
      await settle();
      expect(first.log.silent).toEqual(['unavailable']);
      expect(first.log.starts).toEqual([]);

      // 清单已加载：同样纯文字、不发请求
      const second = track();
      system.play('also-missing', second.options);
      await settle();
      expect(second.log.silent).toEqual(['unavailable']);
      expect(server.lineUrls()).toEqual([]);
    });

    it('gates by the pack of the current language', async () => {
      const system = createVoice();
      setLocale('zh-CN');
      const zh = track();
      system.play('en-only', zh.options);
      await settle();
      expect(zh.log.silent).toEqual(['unavailable']);
      expect(server.lineUrls()).toEqual([]);

      setLocale('en');
      const en = track();
      system.play('en-only', en.options);
      await settle();
      expect(en.log.starts).toHaveLength(1);
      expect(server.lineUrls()).toEqual(['/voice/en/en-only.mp3']);
    });

    it('plays text-only when the manifest cannot be loaded', async () => {
      server.manifestAvailable = false;
      const system = createVoice();
      const { log, options } = track();
      system.play('c01-test-hq', options);
      await settle();
      expect(log.silent).toEqual(['unavailable']);
      expect(server.lineUrls()).toEqual([]);
      await expect(system.loadManifest()).resolves.toBeNull();
      expect(system.getDebugState().manifest).toBe('failed');
    });
  });

  describe('text-only and failure cases', () => {
    it('is text-only at volume 0: no request, onSilent("muted")', async () => {
      const system = createVoice();
      system.setVolume(0);
      const { log, options } = track();
      system.play('c01-test-hq', options);
      system.prefetch(['c01-test-hq', 'c01-test-wingman']);
      await settle();
      expect(log.silent).toEqual(['muted']);
      expect(log.starts).toEqual([]);
      expect(server.lineUrls()).toEqual([]);
    });

    it('stops the line at once when the volume is turned down to 0', async () => {
      const { log, source } = await startLine('c01-test-hq');
      voice?.setVolume(0);
      await settle();
      expect(log.silent).toEqual(['muted']);
      expect(source.stoppedAt).not.toBeNull();
      expect(soundingVoices()).toEqual([]);
    });

    it('clamps the volume to 0..1 and ignores non-finite values', () => {
      const system = createVoice();
      system.setVolume(0.4);
      expect(system.getVolume()).toBe(0.4);
      system.setVolume(Number.NaN);
      expect(system.getVolume()).toBe(0.4);
      system.setVolume(3);
      expect(system.getVolume()).toBe(1);
      system.setVolume(-1);
      expect(system.getVolume()).toBe(0);
    });

    it('never throws without an AudioContext and stays silent', async () => {
      vi.stubGlobal('AudioContext', undefined);
      const system = createVoice();
      const { log, options } = track();
      expect(() => system.play('c01-test-hq', options)).not.toThrow();
      await settle();
      expect(log.silent).toEqual(['unavailable']);
      expect(log.starts).toEqual([]);

      expect(() => {
        system.prefetch(['c01-test-hq', 'c01-test-wingman']);
        system.pause();
        system.resume();
        system.stop('radio');
        system.stopAll();
        system.setVolume(0.5);
        system.getDebugState();
        system.createOutputAnalyser();
      }).not.toThrow();
      await settle();
      expect(server.lineUrls()).toEqual([]);
      expect(() => system.dispose()).not.toThrow();
    });

    it('never throws without fetch or with garbage arguments', async () => {
      vi.stubGlobal('fetch', undefined);
      voice = new VoiceSystem();
      const { log, options } = track();
      expect(() => voice?.play('c01-test-hq', options)).not.toThrow();
      await settle();
      expect(log.silent).toEqual(['unavailable']);

      expect(() => {
        voice?.play(undefined as unknown as string, undefined as unknown as VoicePlayOptions);
        voice?.play('c01-test-hq', { kind: 'radio' });
        voice?.prefetch(undefined as unknown as string[]);
        voice?.setVolume(Number.POSITIVE_INFINITY);
      }).not.toThrow();
      await settle();
    });

    it('reports every outcome asynchronously, never inside play()', async () => {
      const system = createVoice();
      const { log, options } = track();
      system.play('not-in-pack', options);
      expect(log.silent).toEqual([]);
      await settle();
      expect(log.silent).toEqual(['unavailable']);
    });

    it('falls back to text when a radio line takes longer than 1.5 s to load', async () => {
      server.holdLines = true;
      const system = createVoice();
      const { log, options } = track('radio');
      system.play('c01-test-hq', options);
      await elapse(1490);
      expect(log.silent).toEqual([]);
      await elapse(20);
      expect(log.silent).toEqual(['timeout']);

      server.release();
      await settle();
      expect(log.starts).toEqual([]);
      expect(soundingVoices()).toEqual([]);
    });

    it('gives narration 2.5 s to load, or maxStartDelayMs when given', async () => {
      server.holdLines = true;
      const system = createVoice();
      const narration = track('narration');
      system.play('prologue-1', narration.options);
      await elapse(2490);
      expect(narration.log.silent).toEqual([]);
      await elapse(20);
      expect(narration.log.silent).toEqual(['timeout']);

      const quick = track('radio', { maxStartDelayMs: 300 });
      system.play('c01-test-wingman', quick.options);
      await elapse(290);
      expect(quick.log.silent).toEqual([]);
      await elapse(20);
      expect(quick.log.silent).toEqual(['timeout']);
    });

    it('is silent ("error") when a line cannot be decoded', async () => {
      server = new FakeVoiceServer({ en: { broken: { duration: 2, corrupt: true } } });
      const system = createVoice();
      const { log, options } = track();
      system.play('broken', options);
      await settle();
      expect(log.silent).toEqual(['error']);
      expect(log.starts).toEqual([]);
    });
  });

  describe('one voice at a time', () => {
    it('a new line replaces the one speaking', async () => {
      const first = await startLine('c01-test-hq');
      const second = track();
      voice?.play('c01-test-wingman', second.options);
      await settle();

      expect(first.log.silent).toEqual(['superseded']);
      expect(first.source.stoppedAt).not.toBeNull();
      expect(second.log.starts).toHaveLength(1);
      expect(soundingVoices()).toEqual([lastVoiceSource()]);
      expect(lastVoiceSource().buffer?.lineKey).toBe('en/c01-test-wingman');

      lastVoiceSource().finishPlaying();
      await settle();
      expect(second.log.ends).toHaveLength(1);
      expect(first.log.ends).toEqual([]);
    });

    it('a new line replaces one that is still loading', async () => {
      server.holdLines = true;
      const system = createVoice();
      const first = track();
      const second = track();
      system.play('c01-test-hq', first.options);
      await settle();
      system.play('c01-test-wingman', second.options);
      await settle();
      expect(first.log.silent).toEqual(['superseded']);

      server.release();
      await settle();
      expect(first.log.starts).toEqual([]);
      expect(second.log.starts).toHaveLength(1);
      expect(soundingVoices().map((source) => source.buffer?.lineKey)).toEqual([
        'en/c01-test-wingman',
      ]);
    });

    it('reports a natural end once with the line info', async () => {
      const { log, source } = await startLine('c01-test-hq');
      expect(voice?.isSpeaking()).toBe(true);
      expect(voice?.isSpeaking('radio')).toBe(true);
      expect(voice?.isSpeaking('narration')).toBe(false);

      source.finishPlaying();
      await settle();
      expect(log.ends).toHaveLength(1);
      expect(log.ends[0]).toMatchObject({ lineId: 'c01-test-hq', kind: 'radio' });
      expect(log.silent).toEqual([]);
      expect(voice?.isSpeaking()).toBe(false);
    });
  });

  describe('stop, pause and resume', () => {
    it('stop(kind) stops only that kind; stop() stops any', async () => {
      const narration = await startLine('prologue-1', 'narration');
      voice?.stop('radio');
      await settle();
      expect(narration.log.silent).toEqual([]);
      expect(soundingVoices()).toHaveLength(1);

      voice?.stop('narration');
      await settle();
      expect(narration.log.silent).toEqual(['stopped']);
      expect(soundingVoices()).toEqual([]);

      const radio = await startLine('c01-test-hq', 'radio');
      voice?.stop();
      await settle();
      expect(radio.log.silent).toEqual(['stopped']);
      expect(radio.log.ends).toEqual([]);
    });

    it('stopAll stops the line and releases the music at once', async () => {
      const { log } = await startLine('c01-test-hq');
      duckCalls.length = 0;
      voice?.stopAll();
      await settle();
      expect(log.silent).toEqual(['stopped']);
      expect(soundingVoices()).toEqual([]);
      expect(last(duckCalls)?.[0]).toBe(1);
      expect(last(duckCalls)?.[2]).toBe(0);
    });

    it('a stopped line that was still loading never starts', async () => {
      server.holdLines = true;
      const system = createVoice();
      const { log, options } = track();
      system.play('c01-test-hq', options);
      await settle();
      system.stop();
      server.release();
      await settle();
      expect(log.silent).toEqual(['stopped']);
      expect(log.starts).toEqual([]);
      expect(soundingVoices()).toEqual([]);
    });

    it('pause holds the line where it is and resume continues from the same point', async () => {
      const { log, source } = await startLine('c01-test-wingman');
      await elapse(1500);
      const context = audioContext();
      const played = context.currentTime - (source.startedAt ?? 0);
      expect(played).toBeGreaterThan(1);

      voice?.pause();
      await settle();
      expect(source.stoppedAt).not.toBeNull();
      expect(soundingVoices()).toEqual([]);
      expect(voice?.isPaused()).toBe(true);
      expect(voice?.getDebugState().current).toMatchObject({ phase: 'paused' });
      expect(voice?.getDebugState().current?.offset).toBeCloseTo(played, 3);
      expect(log.ends).toEqual([]);
      expect(log.silent).toEqual([]);

      await elapse(5000);
      voice?.resume();
      await settle();
      const resumed = lastVoiceSource();
      expect(resumed).not.toBe(source);
      expect(resumed.buffer).toBe(source.buffer);
      expect(resumed.startOffset).toBeCloseTo(played, 3);
      expect(log.starts, 'onStart is not repeated on resume').toHaveLength(1);

      resumed.finishPlaying();
      await settle();
      expect(log.ends).toHaveLength(1);
      expect(log.silent).toEqual([]);
    });

    it('a line that loads during a pause waits for resume and starts from the top', async () => {
      server.holdLines = true;
      const system = createVoice();
      const { log, options } = track();
      system.play('c01-test-hq', options);
      await settle();
      system.pause();
      server.release();
      await settle();
      expect(log.starts).toEqual([]);
      expect(soundingVoices()).toEqual([]);

      system.resume();
      await settle();
      expect(log.starts).toHaveLength(1);
      expect(lastVoiceSource().startOffset).toBe(0);
    });

    it('resuming after the line had run out counts as its end', async () => {
      const { log } = await startLine('c01-test-hq');
      await elapse(2300);
      voice?.pause();
      voice?.resume();
      await settle();
      expect(log.ends).toHaveLength(1);
      expect(log.silent).toEqual([]);
    });

    it('pause releases the music and resume ducks it again', async () => {
      await startLine('c01-test-wingman');
      await elapse(500);
      duckCalls.length = 0;
      voice?.pause();
      expect(last(duckCalls)?.[0]).toBe(1);

      voice?.resume();
      await settle();
      expect(last(duckCalls)?.[0]).toBe(0.45);
    });
  });

  describe('watchdog', () => {
    it('finishes a line whose ended event never comes, 2.5 s after its length', async () => {
      const { log, source } = await startLine('c01-test-hq');
      await elapse(4400);
      expect(log.ends).toEqual([]);
      await elapse(300);
      expect(log.ends).toHaveLength(1);
      expect(log.silent).toEqual([]);
      expect(source.stoppedAt).not.toBeNull();
      expect(voice?.isSpeaking()).toBe(false);
    });

    it('a real ended event wins and the watchdog stays quiet', async () => {
      const { log, source } = await startLine('c01-test-hq');
      await elapse(2200);
      source.finishPlaying();
      await settle();
      await elapse(10_000);
      expect(log.ends).toHaveLength(1);
    });
  });

  describe('music ducking (voiceDuckBridge)', () => {
    it('ducks the music to 0.45 for radio and restores it 1.2 s after the line over 0.8 s', async () => {
      const { source } = await startLine('c01-test-hq', 'radio');
      const duck = last(duckCalls);
      expect(duck?.[0]).toBe(0.45);
      expect(duck?.[1]).toBeGreaterThan(0);
      expect(duck?.[1]).toBeLessThanOrEqual(0.5);
      expect(duck?.[2]).toBe(0);
      expect(voice?.getDebugState().duckTarget).toBe(0.45);

      source.finishPlaying();
      await settle();
      expect(last(duckCalls)).toEqual([1, 0.8, 1.2]);
      expect(voice?.getDebugState().duckTarget).toBe(1);
    });

    it('ducks the music to 0.5 for narration', async () => {
      await startLine('prologue-1', 'narration');
      expect(last(duckCalls)?.[0]).toBe(0.5);
      expect(last(duckCalls)?.[2]).toBe(0);
    });

    it('keeps the music down between back-to-back lines (delayed restore, then duck)', async () => {
      await startLine('c01-test-hq');
      duckCalls.length = 0;
      const next = track();
      voice?.play('c01-test-wingman', next.options);
      await settle();
      expect(duckCalls).toEqual([
        [1, 0.8, 1.2],
        [0.45, expect.any(Number), 0],
      ]);
    });

    it('restores the music at once when a line is stopped', async () => {
      await startLine('c01-test-hq');
      duckCalls.length = 0;
      voice?.stop();
      expect(duckCalls).toEqual([[1, 0.8, 0]]);
    });

    it('does not duck for a line that never sounds', async () => {
      const system = createVoice();
      const { options } = track();
      system.play('not-in-pack', options);
      await settle();
      expect(duckCalls).toEqual([]);
    });
  });

  describe('prefetch', () => {
    it('fetches each line once, skipping duplicates and lines missing from the pack', async () => {
      const system = createVoice();
      system.prefetch(['c01-test-hq', 'c01-test-hq', 'c01-test-wingman', 'not-in-pack', '']);
      await settle();
      expect(server.lineUrls().sort()).toEqual([
        '/voice/en/c01-test-hq.mp3',
        '/voice/en/c01-test-wingman.mp3',
      ]);
    });

    it('a prefetched line plays without a second request', async () => {
      const system = createVoice();
      system.prefetch(['c01-test-hq']);
      await settle();
      await startLine('c01-test-hq');
      expect(server.lineUrls()).toEqual(['/voice/en/c01-test-hq.mp3']);
    });

    it('a prefetch and a play of the same line share one request', async () => {
      server.holdLines = true;
      const system = createVoice();
      system.prefetch(['c01-test-hq']);
      await settle();
      const { log, options } = track();
      system.play('c01-test-hq', options);
      await settle();
      server.release();
      await settle();
      expect(log.starts).toHaveLength(1);
      expect(server.lineUrls()).toEqual(['/voice/en/c01-test-hq.mp3']);
    });

    it('a language switch stops the line and fetches the batch again from the other pack', async () => {
      const system = createVoice();
      system.prefetch(['c01-test-hq', 'c01-test-wingman']);
      await settle();
      const { log } = await startLine('c01-test-hq');

      setLocale('zh-CN');
      await settle();
      expect(log.silent).toEqual(['stopped']);
      expect(soundingVoices()).toEqual([]);
      expect(
        server
          .lineUrls()
          .filter((url) => url.startsWith('/voice/zh/'))
          .sort()
      ).toEqual(['/voice/zh/c01-test-hq.mp3', '/voice/zh/c01-test-wingman.mp3']);
    });
  });

  describe('loudness normalisation', () => {
    function constantBuffer(amplitude: number, seconds = 1): AudioBuffer {
      const buffer = new FakeAudioBuffer(1, Math.round(seconds * SAMPLE_RATE), SAMPLE_RATE);
      buffer.getChannelData(0).fill(amplitude);
      return buffer as unknown as AudioBuffer;
    }

    it('brings a line to −20 dBFS (RMS)', () => {
      expect(measureVoiceGainDb(constantBuffer(0.1))).toBeCloseTo(0, 2);
      // −26 dBFS → +6 dB；−14 dBFS → −6 dB
      expect(measureVoiceGainDb(constantBuffer(0.1 / 2))).toBeCloseTo(6.02, 1);
      expect(measureVoiceGainDb(constantBuffer(0.2))).toBeCloseTo(-6.02, 1);
    });

    it('clamps the gain to −10…+14 dB', () => {
      expect(measureVoiceGainDb(constantBuffer(0.01))).toBe(14);
      expect(measureVoiceGainDb(constantBuffer(0.9))).toBe(-10);
    });

    it('ignores silence when measuring, and leaves silence alone', () => {
      const padded = new FakeAudioBuffer(1, SAMPLE_RATE * 2, SAMPLE_RATE);
      padded.getChannelData(0).fill(0.1, 0, SAMPLE_RATE);
      expect(measureVoiceGainDb(padded as unknown as AudioBuffer)).toBeCloseTo(0, 2);
      expect(measureVoiceGainDb(constantBuffer(0))).toBe(0);
    });

    it('reports the gain applied to each decoded line', async () => {
      server = new FakeVoiceServer({ en: { quiet: { duration: 2, amplitude: 0.05 } } });
      const { log } = await startLine('quiet');
      expect(log.starts[0].gainDb).toBeCloseTo(6.02, 1);
    });
  });

  describe('caches', () => {
    it('keeps at most 16 decoded lines and 120 s of decoded audio', async () => {
      const lines: Record<string, LineFixture> = {};
      for (let i = 0; i < 20; i++) {
        lines[`short-${i}`] = { duration: 1 };
      }
      for (let i = 0; i < 4; i++) {
        lines[`long-${i}`] = { duration: 50 };
      }
      server = new FakeVoiceServer({ en: lines });
      const system = createVoice();

      for (let i = 0; i < 20; i++) {
        await startLine(`short-${i}`);
      }
      expect(system.getDebugState().cache.decoded).toBe(16);

      for (let i = 0; i < 4; i++) {
        await startLine(`long-${i}`);
      }
      expect(system.getDebugState().cache.decodedSeconds).toBeLessThanOrEqual(120);
    });

    it('keeps at most 6 MB of downloaded audio', async () => {
      const lines: Record<string, LineFixture> = {};
      for (let i = 0; i < 10; i++) {
        lines[`big-${i}`] = { duration: 2, bytes: 1.5 * MiB };
      }
      server = new FakeVoiceServer({ en: lines });
      const system = createVoice();
      system.prefetch(Object.keys(lines));
      await settle();
      await settle();
      expect(server.lineUrls()).toHaveLength(10);
      const { encoded, encodedBytes } = system.getDebugState().cache;
      expect(encoded).toBeGreaterThan(0);
      expect(encodedBytes).toBeLessThanOrEqual(6 * MiB);
    });
  });

  describe('dispose', () => {
    it('silences the current line and every later request', async () => {
      const { log } = await startLine('c01-test-hq');
      voice?.dispose();
      await settle();
      expect(log.silent).toEqual(['disposed']);
      expect(soundingVoices()).toEqual([]);

      const later = track();
      const before = server.urls.length;
      expect(() => voice?.play('c01-test-wingman', later.options)).not.toThrow();
      await settle();
      expect(later.log.silent).toEqual(['disposed']);
      expect(server.urls).toHaveLength(before);
    });
  });
});
