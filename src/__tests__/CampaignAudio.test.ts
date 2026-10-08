import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '@/core/Audio/AudioManager';
import { resetSharedAudioContextForTests } from '@/core/Audio/AudioContextHost';
import {
  LevelMusic,
  MUSIC_STINGERS,
  MusicSystem,
  getBossMusicForLevel,
  getLevelMusicForLevel,
  type MusicStinger,
} from '@/core/Audio/MusicSystem';

/**
 * api-spec §6（音频）+ integration-notes「Audio」：曲目枚举 / 关卡与 Boss 曲映射 / 刺激音 /
 * MusicSystem 新方法 / AudioManager 新音效。
 *
 * jsdom 没有 Web Audio：这里用一个“严格”的替身 AudioContext，按 Web Audio 规范校验参数
 * （非有限值 → TypeError，负时间 / 指数斜坡到 0 → RangeError，重复 start → InvalidStateError），
 * 并把每次违规记下来。代码里大量 try/catch 会把这些异常吞掉（真实浏览器里表现为“静默无声”），
 * 所以除了“不抛错”之外还断言“没有任何违规调用”。
 * 'minimal' 只提供 createGain / createOscillator / createBiquadFilter / createBuffer /
 * createBufferSource（与现有 AudioUnlock 测试替身同级）；'full' 额外提供可选节点。
 */

// ---------------------------------------------------------------------------
// 规范类型（编译期校验：签名漂移会让 tsc 失败）
// ---------------------------------------------------------------------------

type SpecStinger =
  | 'chapter-start'
  | 'boss-defeated'
  | 'level-complete'
  | 'game-over'
  | 'campaign-complete'
  | 'checkpoint'
  | 'phase-change';

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const STINGER_UNION_MATCHES_SPEC: IsExact<MusicStinger, SpecStinger> = true;

type GroundSurface = 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud';
type UnitDomain = 'ground' | 'sea' | 'air';

/** §6 新增的 AudioManager 方法（属性写法 → 参数按逆变检查，收窄参数会编译失败） */
interface SpecAudioManagerAdditions {
  playRocketSalvo: () => void;
  playLaserStart: () => void;
  playLaserStop: () => void;
  playLaserOverheat: () => void;
  playRailgunCharge: () => void;
  playRailgunChargeCancel: () => void;
  playRailgunFire: () => void;
  playSwarmLaunch: () => void;
  playEmpPulse: () => void;
  playFlareDeploy: () => void;
  playSamLockWarning: () => void;
  playSamLaunch: () => void;
  playBombDrop: () => void;
  playTankCannon: () => void;
  playHelicopterPass: (intensity?: number) => void;
  playShipHorn: () => void;
  playSonarPing: () => void;
  playCameraSwitch: () => void;
  playAutosave: () => void;
  playRadioOpen: () => void;
  playTypewriterTick: () => void;
  playWeaponSwitch: () => void;
  playWeaponUnlock: () => void;
  playCivilianWarning: () => void;
  playChapterImpact: () => void;
  playLightningStrike: () => void;
  playLavaEruption: () => void;
  playShieldHit: () => void;
  playBossPhaseAlarm: () => void;
  playDebriefTally: () => void;
  playUnitDestroyed: (domain: UnitDomain) => void;
  playGroundImpact: (surface: GroundSurface, intensity?: number) => void;
}

/** §6 新增的 MusicSystem 方法 */
interface SpecMusicSystemAdditions {
  playStinger: (kind: MusicStinger) => void;
  playMenuMusic: () => void;
  playStoryMusic: () => void;
  playVictoryMusic: () => void;
  setIntensity: (intensity: number) => void;
}

type NoArgSpecSound = Exclude<
  keyof SpecAudioManagerAdditions,
  'playUnitDestroyed' | 'playGroundImpact' | 'playLaserStop'
>;

/** 一次性音效（单独调用就该出声） */
const ONE_SHOT_SOUNDS: readonly NoArgSpecSound[] = [
  'playRocketSalvo',
  'playLaserStart',
  'playLaserOverheat',
  'playRailgunCharge',
  'playRailgunChargeCancel',
  'playRailgunFire',
  'playSwarmLaunch',
  'playEmpPulse',
  'playFlareDeploy',
  'playSamLockWarning',
  'playSamLaunch',
  'playBombDrop',
  'playTankCannon',
  'playHelicopterPass',
  'playShipHorn',
  'playSonarPing',
  'playCameraSwitch',
  'playAutosave',
  'playRadioOpen',
  'playTypewriterTick',
  'playWeaponSwitch',
  'playWeaponUnlock',
  'playCivilianWarning',
  'playChapterImpact',
  'playLightningStrike',
  'playLavaEruption',
  'playShieldHit',
  'playBossPhaseAlarm',
  'playDebriefTally',
];

const ALL_SPEC_SOUND_METHODS: readonly (keyof SpecAudioManagerAdditions)[] = [
  ...ONE_SHOT_SOUNDS,
  'playLaserStop',
  'playUnitDestroyed',
  'playGroundImpact',
];

const UNIT_DOMAINS: readonly UnitDomain[] = ['ground', 'sea', 'air'];
const NEW_SURFACES: readonly GroundSurface[] = ['lava', 'ice', 'rock', 'cloud'];
const ALL_SURFACES: readonly GroundSurface[] = [
  'ground',
  'desert',
  'snow',
  'city',
  ...NEW_SURFACES,
];

const EXISTING_LEVEL_MUSIC: Readonly<Record<string, string>> = {
  LAKE: 'LAKE',
  DESERT: 'DESERT',
  SNOW: 'SNOW',
  OCEAN: 'OCEAN',
  CITY: 'CITY',
  BOSS: 'BOSS',
  DESERT_BOSS: 'DESERT_BOSS',
  OCTOPUS_BOSS: 'OCTOPUS_BOSS',
  OCEAN_BOSS: 'OCEAN_BOSS',
  SKY_CARRIER_BOSS: 'SKY_CARRIER_BOSS',
};

const NEW_LEVEL_MUSIC_KEYS = [
  'VOLCANO',
  'ARCTIC',
  'CANYON',
  'STRATOSPHERE',
  'CITADEL',
  'MAGMA_BOSS',
  'LEVIATHAN_BOSS',
  'TEMPEST_BOSS',
  'PHANTOM_BOSS',
  'ORACLE_BOSS',
  'MENU',
  'STORY',
  'VICTORY',
] as const;

/** 规范 §1/§2 的顺序：关卡 6..10 的地形与 Boss */
const CAMPAIGN_LEVEL_TRACKS: readonly LevelMusic[] = [
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

const CAMPAIGN_BOSS_TRACKS: readonly LevelMusic[] = [
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

/** integration-notes：这几个刺激音自己结束当前音乐 */
const MUSIC_ENDING_STINGERS: readonly MusicStinger[] = [
  'boss-defeated',
  'level-complete',
  'game-over',
  'campaign-complete',
];
const OVERLAY_STINGERS: readonly MusicStinger[] = ['chapter-start', 'checkpoint', 'phase-change'];

// ---------------------------------------------------------------------------
// 严格的 Web Audio 替身
// ---------------------------------------------------------------------------

type FakeFlavor = 'minimal' | 'full';
type ViolationKind = 'TypeError' | 'RangeError' | 'InvalidStateError' | 'NotSupportedError';

interface AudioProbe {
  flavor: FakeFlavor;
  contexts: FakeAudioContext[];
  started: FakeSourceNode[];
  violations: string[];
}

let probe: AudioProbe = { flavor: 'minimal', contexts: [], started: [], violations: [] };

function violate(kind: ViolationKind, message: string): never {
  probe.violations.push(`${kind}: ${message}`);
  if (kind === 'TypeError') {
    throw new TypeError(message);
  }
  if (kind === 'RangeError') {
    throw new RangeError(message);
  }
  throw new DOMException(message, kind);
}

function requireFinite(method: string, ...values: number[]): void {
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      violate('TypeError', `${method}(${values.join(', ')}) non-finite argument`);
    }
  }
}

function requireTime(method: string, time: number): void {
  if (time < 0) {
    violate('RangeError', `${method} negative time ${time}`);
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];

  constructor(
    readonly kind: string,
    readonly context: FakeAudioContext
  ) {}

  connect(destination: FakeNode | FakeParam): FakeNode | undefined {
    if (destination instanceof FakeParam) {
      this.outputs.push(destination.owner);
      return undefined;
    }
    if (!(destination instanceof FakeNode)) {
      violate('InvalidStateError', `${this.kind}.connect(non-node)`);
    }
    this.outputs.push(destination);
    return destination;
  }

  disconnect(): void {
    this.outputs.length = 0;
  }
}

class FakeParam {
  private current: number;

  constructor(
    readonly owner: FakeNode,
    initial: number
  ) {
    this.current = initial;
  }

  get value(): number {
    return this.current;
  }

  set value(next: number) {
    requireFinite(`${this.owner.kind}.param.value=`, next);
    this.current = next;
  }

  setValueAtTime(value: number, startTime: number): this {
    requireFinite('setValueAtTime', value, startTime);
    requireTime('setValueAtTime', startTime);
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): this {
    requireFinite('linearRampToValueAtTime', value, endTime);
    requireTime('linearRampToValueAtTime', endTime);
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): this {
    requireFinite('exponentialRampToValueAtTime', value, endTime);
    if (value === 0) {
      violate('RangeError', 'exponentialRampToValueAtTime(0)');
    }
    requireTime('exponentialRampToValueAtTime', endTime);
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): this {
    requireFinite('setTargetAtTime', target, startTime, timeConstant);
    requireTime('setTargetAtTime', startTime);
    if (timeConstant < 0) {
      violate('RangeError', `setTargetAtTime negative timeConstant ${timeConstant}`);
    }
    return this;
  }

  cancelScheduledValues(cancelTime: number): this {
    requireFinite('cancelScheduledValues', cancelTime);
    requireTime('cancelScheduledValues', cancelTime);
    return this;
  }
}

/** 'full' 才有 cancelAndHoldAtTime（Chrome 有，Firefox 没有） */
class HoldableParam extends FakeParam {
  cancelAndHoldAtTime(cancelTime: number): this {
    requireFinite('cancelAndHoldAtTime', cancelTime);
    requireTime('cancelAndHoldAtTime', cancelTime);
    return this;
  }
}

function makeParam(owner: FakeNode, initial: number): FakeParam {
  return probe.flavor === 'full'
    ? new HoldableParam(owner, initial)
    : new FakeParam(owner, initial);
}

class FakeGainNode extends FakeNode {
  readonly gain: FakeParam;

  constructor(context: FakeAudioContext) {
    super('gain', context);
    this.gain = makeParam(this, 1);
  }
}

class FakeBiquadNode extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency: FakeParam;
  readonly Q: FakeParam;
  readonly gain: FakeParam;
  readonly detune: FakeParam;

  constructor(context: FakeAudioContext) {
    super('biquad', context);
    this.frequency = makeParam(this, 350);
    this.Q = makeParam(this, 1);
    this.gain = makeParam(this, 0);
    this.detune = makeParam(this, 0);
  }
}

class FakeSourceNode extends FakeNode {
  onended: (() => void) | null = null;
  private startedAt: number | null = null;

  start(when = 0, offset?: number, duration?: number): void {
    requireFinite(`${this.kind}.start`, when, ...(offset === undefined ? [] : [offset]));
    if (when < 0 || (offset !== undefined && offset < 0)) {
      violate('RangeError', `${this.kind}.start negative argument`);
    }
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
      violate('RangeError', `${this.kind}.start bad duration ${duration}`);
    }
    if (this.startedAt !== null) {
      violate('InvalidStateError', `${this.kind}.start called twice`);
    }
    this.startedAt = when;
    probe.started.push(this);
  }

  stop(when = 0): void {
    if (this.startedAt === null) {
      violate('InvalidStateError', `${this.kind}.stop before start`);
    }
    requireFinite(`${this.kind}.stop`, when);
    if (when < 0) {
      violate('RangeError', `${this.kind}.stop negative time`);
    }
  }
}

class FakeOscillatorNode extends FakeSourceNode {
  type: OscillatorType = 'sine';
  readonly frequency: FakeParam;
  readonly detune: FakeParam;

  constructor(context: FakeAudioContext) {
    super('oscillator', context);
    this.frequency = makeParam(this, 440);
    this.detune = makeParam(this, 0);
  }
}

class FakeBufferSourceNode extends FakeSourceNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;

  constructor(context: FakeAudioContext) {
    super('buffer-source', context);
    if (probe.flavor === 'full') {
      Object.assign(this, {
        playbackRate: makeParam(this, 1),
        detune: makeParam(this, 0),
      });
    }
  }
}

class FakeAudioBuffer {
  readonly duration: number;
  private readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel];
    if (!data) {
      violate('NotSupportedError', `getChannelData(${channel})`);
    }
    return data;
  }
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  readonly sampleRate = 44100;
  readonly destination: FakeNode;
  private readonly createdAtMs: number;

  constructor() {
    this.destination = new FakeNode('destination', this);
    this.createdAtMs = performance.now();
    probe.contexts.push(this);
  }

  /** 音频时钟跟随（可被 fake timers 接管的）performance.now() */
  get currentTime(): number {
    return Math.max(0, (performance.now() - this.createdAtMs) / 1000);
  }

  resume(): Promise<void> {
    if (this.state !== 'closed') {
      this.state = 'running';
    }
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    if (this.state !== 'closed') {
      this.state = 'suspended';
    }
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  createGain(): FakeGainNode {
    return new FakeGainNode(this);
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode(this);
  }

  createBiquadFilter(): FakeBiquadNode {
    return new FakeBiquadNode(this);
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    if (
      !Number.isInteger(channels) ||
      channels < 1 ||
      channels > 32 ||
      !Number.isFinite(length) ||
      length < 1 ||
      sampleRate < 3000 ||
      sampleRate > 768000
    ) {
      violate('NotSupportedError', `createBuffer(${channels}, ${length}, ${sampleRate})`);
    }
    return new FakeAudioBuffer(channels, Math.floor(length), sampleRate);
  }

  createBufferSource(): FakeBufferSourceNode {
    return new FakeBufferSourceNode(this);
  }
}

/** 带全部可选节点的替身 */
class FullFakeAudioContext extends FakeAudioContext {
  createDelay(maxDelayTime = 1): FakeNode {
    if (!(maxDelayTime > 0) || maxDelayTime >= 180) {
      violate('NotSupportedError', `createDelay(${maxDelayTime})`);
    }
    const node = new FakeNode('delay', this);
    return Object.assign(node, { delayTime: makeParam(node, 0) });
  }

  createConvolver(): FakeNode {
    return Object.assign(new FakeNode('convolver', this), { buffer: null, normalize: true });
  }

  createDynamicsCompressor(): FakeNode {
    const node = new FakeNode('compressor', this);
    return Object.assign(node, {
      threshold: makeParam(node, -24),
      knee: makeParam(node, 30),
      ratio: makeParam(node, 12),
      attack: makeParam(node, 0.003),
      release: makeParam(node, 0.25),
      reduction: 0,
    });
  }

  createWaveShaper(): FakeNode {
    return Object.assign(new FakeNode('waveshaper', this), {
      curve: null as Float32Array | null,
      oversample: 'none' as OverSampleType,
    });
  }

  createStereoPanner(): FakeNode {
    const node = new FakeNode('panner', this);
    return Object.assign(node, { pan: makeParam(node, 0) });
  }
}

type AudioWindow = {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
};

const audioWindow = window as unknown as AudioWindow;
const ORIGINAL_AUDIO_CONTEXT = Object.getOwnPropertyDescriptor(window, 'AudioContext');
const ORIGINAL_WEBKIT_AUDIO_CONTEXT = Object.getOwnPropertyDescriptor(window, 'webkitAudioContext');

function installAudio(flavor: FakeFlavor | 'none'): void {
  probe = {
    flavor: flavor === 'full' ? 'full' : 'minimal',
    contexts: [],
    started: [],
    violations: [],
  };
  audioWindow.webkitAudioContext = undefined;
  if (flavor === 'none') {
    audioWindow.AudioContext = undefined;
    return;
  }
  audioWindow.AudioContext = flavor === 'full' ? FullFakeAudioContext : FakeAudioContext;
}

function restoreAudioGlobals(): void {
  for (const [key, descriptor] of [
    ['AudioContext', ORIGINAL_AUDIO_CONTEXT],
    ['webkitAudioContext', ORIGINAL_WEBKIT_AUDIO_CONTEXT],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(window, key, descriptor);
    } else {
      delete audioWindow[key];
    }
  }
}

function sourcesStartedBy(action: () => void): FakeSourceNode[] {
  const before = probe.started.length;
  action();
  return probe.started.slice(before);
}

function reaches(from: FakeNode, target: FakeNode): boolean {
  const seen = new Set<FakeNode>();
  const stack: FakeNode[] = [from];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    if (node === target) {
      return true;
    }
    if (seen.has(node)) {
      continue;
    }
    seen.add(node);
    stack.push(...node.outputs);
  }
  return false;
}

/** 受保护的总线只在子类里可见：用子类读取，不做强制类型转换 */
class ProbeAudioManager extends AudioManager {
  public buses(): { master: FakeGainNode | null; sfx: FakeGainNode | null } {
    return {
      master: this.masterGain as unknown as FakeGainNode | null,
      sfx: this.sfxGain as unknown as FakeGainNode | null,
    };
  }
}

function playSpecSound(audio: AudioManager, method: NoArgSpecSound): void {
  const specView: SpecAudioManagerAdditions = audio;
  specView[method]();
}

/** 间隔足够长，所有节流 / 并发计数都已释放 */
function letPoliciesSettle(): void {
  vi.advanceTimersByTime(5000);
}

// ---------------------------------------------------------------------------
// LevelMusic / 映射 / 刺激音类型
// ---------------------------------------------------------------------------

describe('LevelMusic tracks (§6)', () => {
  it('keeps the ten existing members with their string values', () => {
    const values = LevelMusic as unknown as Record<string, string>;
    for (const [key, value] of Object.entries(EXISTING_LEVEL_MUSIC)) {
      expect(values[key], `LevelMusic.${key}`).toBe(value);
    }
  });

  it('adds the 13 campaign members as distinct string values', () => {
    const values = LevelMusic as unknown as Record<string, unknown>;
    for (const key of NEW_LEVEL_MUSIC_KEYS) {
      expect(typeof values[key], `LevelMusic.${key}`).toBe('string');
    }
    const all = Object.values(LevelMusic);
    expect(all).toHaveLength(23);
    expect(new Set(all).size).toBe(23);
  });

  it('maps levels 1..10 to ten distinct level tracks in campaign order', () => {
    const tracks = Array.from({ length: 10 }, (_, index) => getLevelMusicForLevel(index + 1));
    expect(new Set(tracks).size).toBe(10);
    expect(tracks).toEqual(CAMPAIGN_LEVEL_TRACKS);
  });

  it('maps levels 1..10 to ten distinct boss tracks, none of them a level track', () => {
    const bossTracks = Array.from({ length: 10 }, (_, index) => getBossMusicForLevel(index + 1));
    expect(new Set(bossTracks).size).toBe(10);
    expect(bossTracks).toEqual(CAMPAIGN_BOSS_TRACKS);
    const levelTracks = new Set(CAMPAIGN_LEVEL_TRACKS);
    for (const track of bossTracks) {
      expect(levelTracks.has(track), `${track} is also a level track`).toBe(false);
    }
  });

  it('clamps out-of-range levels to 1..10 and treats non-finite levels as level 1', () => {
    for (const lookup of [getLevelMusicForLevel, getBossMusicForLevel]) {
      expect(lookup(0)).toBe(lookup(1));
      expect(lookup(-4)).toBe(lookup(1));
      expect(lookup(11)).toBe(lookup(10));
      expect(lookup(999)).toBe(lookup(10));
      expect(lookup(Number.NaN)).toBe(lookup(1));
      expect(lookup(Number.POSITIVE_INFINITY)).toBe(lookup(1));
      expect(lookup(3.2)).toBe(lookup(3));
    }
  });

  it('declares exactly the seven spec stinger kinds', () => {
    expect(STINGER_UNION_MATCHES_SPEC).toBe(true);
    const specKinds: SpecStinger[] = [
      'chapter-start',
      'boss-defeated',
      'level-complete',
      'game-over',
      'campaign-complete',
      'checkpoint',
      'phase-change',
    ];
    expect([...MUSIC_STINGERS].sort()).toEqual([...specKinds].sort());
  });
});

// ---------------------------------------------------------------------------
// MusicSystem
// ---------------------------------------------------------------------------

describe('MusicSystem without an AudioContext', () => {
  let music: MusicSystem | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installAudio('none');
    resetSharedAudioContextForTests();
  });

  afterEach(() => {
    music?.dispose();
    music = null;
    resetSharedAudioContextForTests();
    restoreAudioGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('never throws from any new method', () => {
    music = new MusicSystem();
    const system = music;
    const specView: SpecMusicSystemAdditions = system;
    expect(() => {
      specView.playMenuMusic();
      specView.playStoryMusic();
      specView.playVictoryMusic();
      for (const kind of MUSIC_STINGERS) {
        specView.playStinger(kind);
      }
      specView.setIntensity(0.7);
      system.playLevelMusic(getLevelMusicForLevel(6));
      system.playBossMusic(10);
      system.playBossMusic();
      system.pauseMusic();
      system.resumeMusic();
      system.stopMusic();
      system.setVolume(0.4);
      vi.advanceTimersByTime(2000);
      system.dispose();
      system.playStinger('game-over');
      system.resumeMusic();
    }).not.toThrow();
  });

  it('still clamps setIntensity to 0..1', () => {
    music = new MusicSystem();
    music.setIntensity(4);
    expect(music.getIntensity()).toBe(1);
    music.setIntensity(-3);
    expect(music.getIntensity()).toBe(0);
  });
});

describe.each(['minimal', 'full'] as const)('MusicSystem with a %s fake AudioContext', (flavor) => {
  let music: MusicSystem | null = null;

  function createMusic(): MusicSystem {
    music = new MusicSystem();
    return music;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    installAudio(flavor);
    resetSharedAudioContextForTests();
  });

  afterEach(() => {
    music?.dispose();
    music = null;
    resetSharedAudioContextForTests();
    restoreAudioGlobals();
    vi.useRealTimers();
  });

  it('plays all 23 tracks and the boss music for 1..10 without browser-rejected calls', () => {
    const system = createMusic();
    for (const track of Object.values(LevelMusic)) {
      expect(() => system.playLevelMusic(track)).not.toThrow();
      expect(system.getCurrentMusic(), `playLevelMusic(${track})`).toBe(track);
      vi.advanceTimersByTime(120);
    }
    for (let level = 1; level <= 10; level += 1) {
      system.playBossMusic(level);
      expect(system.getCurrentMusic(), `playBossMusic(${level})`).toBe(getBossMusicForLevel(level));
      vi.advanceTimersByTime(120);
    }
    vi.advanceTimersByTime(4000);
    expect(probe.started.length, 'music must schedule audible voices').toBeGreaterThan(0);
    expect(probe.violations).toEqual([]);
  });

  it('keeps playBossMusic() without a level on the original boss track', () => {
    const system = createMusic();
    system.playBossMusic();
    expect(system.getCurrentMusic()).toBe(LevelMusic.BOSS);
  });

  it('routes playMenuMusic / playStoryMusic / playVictoryMusic to their tracks', () => {
    const system = createMusic();
    system.playMenuMusic();
    expect(system.getCurrentMusic()).toBe(LevelMusic.MENU);
    expect(system.getIsPlaying()).toBe(true);
    vi.advanceTimersByTime(500);
    system.playStoryMusic();
    expect(system.getCurrentMusic()).toBe(LevelMusic.STORY);
    vi.advanceTimersByTime(500);
    system.playVictoryMusic();
    expect(system.getCurrentMusic()).toBe(LevelMusic.VICTORY);
    vi.advanceTimersByTime(3000);
    expect(probe.violations).toEqual([]);
  });

  it('clamps setIntensity to 0..1 (also for non-finite input)', () => {
    const system = createMusic();
    system.playBossMusic(6);
    system.setIntensity(0.42);
    expect(system.getIntensity()).toBeCloseTo(0.42, 5);
    system.setIntensity(3);
    expect(system.getIntensity()).toBe(1);
    system.setIntensity(-0.5);
    expect(system.getIntensity()).toBe(0);
    system.setIntensity(Number.NaN);
    expect(Number.isFinite(system.getIntensity())).toBe(true);
    expect(system.getIntensity()).toBeGreaterThanOrEqual(0);
    expect(system.getIntensity()).toBeLessThanOrEqual(1);
    for (const value of [0.35, 0.6, 0.85, 1, 1, 1]) {
      system.setIntensity(value);
      vi.advanceTimersByTime(40);
    }
    vi.advanceTimersByTime(2000);
    expect(probe.violations).toEqual([]);
  });

  it("resets the intensity to the new track's default on a track change", () => {
    const reference = createMusic();
    reference.playBossMusic(3);
    const trackDefault = reference.getIntensity();
    reference.dispose();
    resetSharedAudioContextForTests();

    const system = createMusic();
    system.playLevelMusic(LevelMusic.LAKE);
    system.setIntensity(trackDefault > 0.5 ? 0 : 1);
    system.playBossMusic(3);
    expect(system.getIntensity()).toBeCloseTo(trackDefault, 5);
  });

  it('plays every stinger kind with and without music, without browser-rejected calls', () => {
    const system = createMusic();
    for (const kind of MUSIC_STINGERS) {
      expect(() => system.playStinger(kind)).not.toThrow();
      vi.advanceTimersByTime(600);
    }
    for (const kind of MUSIC_STINGERS) {
      system.playLevelMusic(LevelMusic.CANYON);
      vi.advanceTimersByTime(300);
      let voices: FakeSourceNode[] = [];
      expect(() => {
        voices = sourcesStartedBy(() => system.playStinger(kind));
      }).not.toThrow();
      expect(voices.length, `stinger ${kind} schedules its own voices`).toBeGreaterThan(0);
      vi.advanceTimersByTime(600);
    }
    vi.advanceTimersByTime(8000);
    expect(probe.violations).toEqual([]);
  });

  it.each(MUSIC_ENDING_STINGERS)('lets the %s stinger end the current music itself', (kind) => {
    const system = createMusic();
    system.playBossMusic(7);
    vi.advanceTimersByTime(300);
    system.playStinger(kind);
    expect(system.getIsPlaying()).toBe(false);
    expect(system.getCurrentMusic()).toBeNull();
    vi.advanceTimersByTime(6000);
    expect(probe.violations).toEqual([]);
  });

  it.each(OVERLAY_STINGERS)('keeps the current music under the %s stinger', (kind) => {
    const system = createMusic();
    system.playLevelMusic(LevelMusic.ARCTIC);
    vi.advanceTimersByTime(300);
    system.playStinger(kind);
    expect(system.getIsPlaying()).toBe(true);
    expect(system.getCurrentMusic()).toBe(LevelMusic.ARCTIC);
    vi.advanceTimersByTime(6000);
    expect(system.getCurrentMusic()).toBe(LevelMusic.ARCTIC);
    expect(probe.violations).toEqual([]);
  });

  it('pauseMusic forgets nothing: resumeMusic restores the track and its intensity', () => {
    const system = createMusic();
    system.playLevelMusic(LevelMusic.VOLCANO);
    system.setIntensity(0.8);
    vi.advanceTimersByTime(300);

    system.pauseMusic();
    expect(system.getIsPlaying()).toBe(false);
    expect(system.getCurrentMusic()).toBeNull();
    vi.advanceTimersByTime(1000);

    system.pauseMusic();
    system.resumeMusic();
    expect(system.getIsPlaying()).toBe(true);
    expect(system.getCurrentMusic()).toBe(LevelMusic.VOLCANO);
    expect(system.getIntensity()).toBeCloseTo(0.8, 5);
    vi.advanceTimersByTime(2000);
    expect(probe.violations).toEqual([]);
  });

  it('resumeMusic without a pause starts nothing', () => {
    const system = createMusic();
    expect(() => system.resumeMusic()).not.toThrow();
    expect(system.getIsPlaying()).toBe(false);
    expect(system.getCurrentMusic()).toBeNull();
  });

  it('stopMusic changes state immediately', () => {
    const system = createMusic();
    system.playStoryMusic();
    vi.advanceTimersByTime(200);
    system.stopMusic();
    expect(system.getIsPlaying()).toBe(false);
    expect(system.getCurrentMusic()).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(probe.violations).toEqual([]);
  });

  it('stops its scheduler on dispose and ignores later calls', () => {
    const system = createMusic();
    system.playLevelMusic(LevelMusic.CITADEL);
    system.playStinger('checkpoint');
    vi.advanceTimersByTime(300);
    system.dispose();
    expect(vi.getTimerCount(), 'pending timers after dispose').toBe(0);
    expect(() => {
      system.playMenuMusic();
      system.playStinger('phase-change');
      system.setIntensity(1);
      system.resumeMusic();
    }).not.toThrow();
    expect(system.getIsPlaying()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares the context with AudioManager ducking without browser-rejected calls', () => {
    const system = createMusic();
    const audio = new AudioManager();
    try {
      system.playBossMusic(9);
      vi.advanceTimersByTime(300);
      audio.playChapterImpact();
      audio.playEmpPulse();
      audio.playRailgunFire();
      system.playStinger('phase-change');
      vi.advanceTimersByTime(3000);
      expect(probe.contexts).toHaveLength(1);
      expect(probe.violations).toEqual([]);
    } finally {
      audio.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

describe('AudioManager §6 sounds without an AudioContext', () => {
  let audio: AudioManager | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installAudio('none');
    resetSharedAudioContextForTests();
  });

  afterEach(() => {
    audio?.dispose();
    audio = null;
    resetSharedAudioContextForTests();
    restoreAudioGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('exposes every §6 method', () => {
    audio = new AudioManager();
    const surface = audio as unknown as Record<string, unknown>;
    for (const method of ALL_SPEC_SOUND_METHODS) {
      expect(typeof surface[method], method).toBe('function');
    }
  });

  it('never throws from any §6 method', () => {
    audio = new AudioManager();
    const manager = audio;
    expect(() => {
      manager.resume();
      for (const method of ONE_SHOT_SOUNDS) {
        playSpecSound(manager, method);
      }
      manager.playLaserStop();
      manager.playHelicopterPass(0.3);
      manager.playRailgunCharge(2);
      for (const domain of UNIT_DOMAINS) {
        manager.playUnitDestroyed(domain);
      }
      for (const surface of ALL_SURFACES) {
        manager.playGroundImpact(surface, 1.2);
      }
      manager.stopSustainedSounds();
      vi.advanceTimersByTime(10_000);
    }).not.toThrow();
  });
});

describe.each(['minimal', 'full'] as const)(
  'AudioManager §6 sounds with a %s fake AudioContext',
  (flavor) => {
    let audio: ProbeAudioManager | null = null;

    function createAudio(): ProbeAudioManager {
      audio = new ProbeAudioManager();
      audio.resume();
      return audio;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      installAudio(flavor);
      resetSharedAudioContextForTests();
    });

    afterEach(() => {
      audio?.dispose();
      audio = null;
      resetSharedAudioContextForTests();
      restoreAudioGlobals();
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it.each(ONE_SHOT_SOUNDS)('%s plays through the SFX bus', (method) => {
      const manager = createAudio();
      const sfxBus = manager.buses().sfx;
      expect(sfxBus, 'SFX bus after resume()').not.toBeNull();

      let started: FakeSourceNode[] = [];
      expect(() => {
        started = sourcesStartedBy(() => playSpecSound(manager, method));
      }).not.toThrow();

      expect(started.length, `${method} starts audible sources`).toBeGreaterThan(0);
      for (const source of started) {
        expect(reaches(source, sfxBus as FakeGainNode), `${method}: ${source.kind} → SFX bus`).toBe(
          true
        );
      }
      manager.stopSustainedSounds();
      vi.advanceTimersByTime(10_000);
      expect(probe.violations).toEqual([]);
    });

    it('playLaserStop ends a running beam with an audible tail', () => {
      const manager = createAudio();
      const beam = sourcesStartedBy(() => manager.playLaserStart());
      expect(beam.length).toBeGreaterThan(0);
      vi.advanceTimersByTime(400);
      const tail = sourcesStartedBy(() => manager.playLaserStop());
      expect(tail.length, 'laser stop tail').toBeGreaterThan(0);
      expect(() => manager.playLaserStop()).not.toThrow();
      vi.advanceTimersByTime(10_000);
      expect(probe.violations).toEqual([]);
    });

    it.each(UNIT_DOMAINS)('playUnitDestroyed(%s) plays through the SFX bus', (domain) => {
      const manager = createAudio();
      const sfxBus = manager.buses().sfx as FakeGainNode;
      const started = sourcesStartedBy(() => manager.playUnitDestroyed(domain));
      expect(started.length).toBeGreaterThan(0);
      for (const source of started) {
        expect(reaches(source, sfxBus)).toBe(true);
      }
      vi.advanceTimersByTime(5000);
      expect(probe.violations).toEqual([]);
    });

    it.each(ALL_SURFACES)('playGroundImpact(%s) is audible', (surface) => {
      const manager = createAudio();
      const sfxBus = manager.buses().sfx as FakeGainNode;
      const started = sourcesStartedBy(() => manager.playGroundImpact(surface, 1.1));
      expect(started.length, `${surface} impact`).toBeGreaterThan(0);
      for (const source of started) {
        expect(reaches(source, sfxBus)).toBe(true);
      }
      vi.advanceTimersByTime(5000);
      expect(probe.violations).toEqual([]);
    });

    it('accepts out-of-range intensities for the widened surfaces and the helicopter pass', () => {
      const manager = createAudio();
      expect(() => {
        for (const surface of NEW_SURFACES) {
          manager.playGroundImpact(surface, Number.NaN);
          letPoliciesSettle();
          manager.playGroundImpact(surface, 40);
          letPoliciesSettle();
          manager.playGroundImpact(surface, -2);
          letPoliciesSettle();
        }
        manager.playHelicopterPass(Number.NaN);
        letPoliciesSettle();
        manager.playHelicopterPass(25);
        letPoliciesSettle();
        manager.playRailgunCharge(Number.POSITIVE_INFINITY);
        letPoliciesSettle();
      }).not.toThrow();
      manager.stopSustainedSounds();
      vi.advanceTimersByTime(10_000);
      expect(probe.violations).toEqual([]);
    });

    it.each(ONE_SHOT_SOUNDS)('%s is gated: a same-instant burst does not pile up', (method) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const manager = createAudio();

      let spaced = 0;
      for (let i = 0; i < 3; i += 1) {
        spaced += sourcesStartedBy(() => playSpecSound(manager, method)).length;
        manager.stopSustainedSounds();
        letPoliciesSettle();
      }
      expect(spaced).toBeGreaterThan(0);

      const burst = sourcesStartedBy(() => {
        for (let i = 0; i < 10; i += 1) {
          playSpecSound(manager, method);
        }
      }).length;
      expect(burst, `${method}: 10 calls in one instant`).toBeLessThanOrEqual(spaced);
      manager.stopSustainedSounds();
      vi.advanceTimersByTime(10_000);
      expect(probe.violations).toEqual([]);
    });

    it('respects the volume settings on its buses and mute/unmute', () => {
      const manager = createAudio();
      const { master, sfx } = manager.buses();
      expect(master).not.toBeNull();
      expect(sfx).not.toBeNull();

      manager.setMasterVolume(0.8);
      manager.setSFXVolume(0.25);
      expect(manager.getVolume()).toMatchObject({ master: 0.8, sfx: 0.25 });
      expect(master?.gain.value).toBeCloseTo(0.8, 5);
      expect(sfx?.gain.value).toBeCloseTo(0.25, 5);

      manager.setSFXVolume(3);
      manager.setMasterVolume(-1);
      expect(manager.getVolume()).toMatchObject({ master: 0, sfx: 1 });
      expect(sfx?.gain.value).toBe(1);
      expect(master?.gain.value).toBe(0);

      manager.setMasterVolume(0.6);
      manager.mute();
      expect(master?.gain.value).toBe(0);
      manager.playAutosave();
      expect(master?.gain.value, 'a new sound must not undo mute').toBe(0);
      manager.unmute();
      expect(master?.gain.value).toBeCloseTo(0.6, 5);
      expect(probe.violations).toEqual([]);
    });

    it('applies volumes chosen before the context exists', () => {
      audio = new ProbeAudioManager();
      audio.setMasterVolume(0.3);
      audio.setSFXVolume(0.45);
      audio.resume();
      const { master, sfx } = audio.buses();
      expect(master?.gain.value).toBeCloseTo(0.3, 5);
      expect(sfx?.gain.value).toBeCloseTo(0.45, 5);
    });

    it('is silent and no-throw after dispose', () => {
      const manager = createAudio();
      manager.dispose();
      let started: FakeSourceNode[] = [];
      expect(() => {
        started = sourcesStartedBy(() => {
          for (const method of ONE_SHOT_SOUNDS) {
            playSpecSound(manager, method);
          }
          manager.playUnitDestroyed('sea');
          manager.playGroundImpact('lava');
        });
      }).not.toThrow();
      expect(started).toHaveLength(0);
    });
  }
);
