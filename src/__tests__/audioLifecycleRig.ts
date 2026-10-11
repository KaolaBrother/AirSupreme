/**
 * 音频生命周期测试台架：一个“迟到”的 AudioContext 替身，加上页面前后台事件与用户手势。
 *
 * 现有替身（AudioUnlock / CampaignAudio / VoiceSystem）的 resume() 当场把状态改成
 * 'running'，于是“回到前台后声音没回来”的问题在测试里看不见。真实浏览器里 resume() 返回的
 * Promise 稍后才兑现：状态在之后的微任务里才变、并派发 statechange；系统没放行时
 * （Android Chrome 锁屏回来、没有用户激活）状态根本不变，Promise 可能一直挂着，也可能被拒绝。
 * 这里的替身按 resumeOutcome 模拟这几种结局，并支持 Safari / Chrome 的 'interrupted' 状态。
 */

/** 标准库的 AudioContextState 不一定包含 'interrupted' */
export type FakeContextState = 'suspended' | 'running' | 'closed' | 'interrupted';

/** resume() 的结局；没有一种会同步改状态 */
export type ResumeOutcome =
  /** 之后的微任务里转为 running（派发 statechange），然后兑现 */
  | 'run'
  /** 之后的微任务里兑现，状态不变（系统没放行） */
  | 'stay'
  /** 之后的微任务里以 InvalidStateError 拒绝，状态不变 */
  | 'reject'
  /** 永不兑现、状态不变（Chrome 在没有用户激活时的样子） */
  | 'pending';

interface RigState {
  initialState: FakeContextState;
  resumeOutcome: ResumeOutcome;
  resumeCalls: number;
  readonly contexts: FakeLifecycleAudioContext[];
  readonly oscillators: FakeOscillator[];
}

class FakeParam {
  constructor(public value: number) {}
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  setTargetAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  connect<T>(destination: T): T {
    return destination;
  }
  disconnect(): void {
    // 替身不记连线
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

class FakeBiquad extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  readonly gain = new FakeParam(0);
  readonly detune = new FakeParam(0);
}

/** 振荡器：记下 start / stop，用来判断引擎嗡鸣（持续音，start 后不排 stop）在不在响 */
export class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
  onended: (() => void) | null = null;
  started = false;
  stopCalled = false;

  constructor(private readonly rig: RigState) {
    super();
  }

  start(): void {
    this.started = true;
    this.rig.oscillators.push(this);
  }

  stop(): void {
    this.stopCalled = true;
  }
}

class FakeBufferSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);
  readonly detune = new FakeParam(0);
  onended: (() => void) | null = null;
  start(): void {
    // 一次性噪声源，不参与判断
  }
  stop(): void {
    // 同上
  }
}

class FakeBuffer {
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
    return this.channels[channel] ?? new Float32Array(this.length);
  }
}

/** 在之后的微任务里执行（resume / suspend 的结局都不同步发生） */
function later(effect: () => void): Promise<void> {
  return Promise.resolve().then(effect);
}

/**
 * AudioContext 替身。resume() 的结局由台架的 resumeOutcome 决定；
 * force() 模拟系统一侧的状态变化（来电 / 锁屏打断、系统挂起、上下文被关闭）。
 */
export class FakeLifecycleAudioContext extends EventTarget {
  readonly sampleRate = 44100;
  readonly currentTime = 0;
  readonly destination = new FakeNode();
  onstatechange: ((event: Event) => void) | null = null;
  /** 本上下文上 resume() 的调用次数 */
  resumeCalls = 0;
  /** 派发过多少次 statechange */
  stateChanges = 0;
  private current: FakeContextState;

  constructor(private readonly rig: RigState) {
    super();
    this.current = rig.initialState;
    rig.contexts.push(this);
  }

  get state(): FakeContextState {
    return this.current;
  }

  /** 系统一侧改状态（不经过 resume / suspend / close），并派发 statechange */
  force(next: FakeContextState): void {
    if (this.current === next) {
      return;
    }
    this.current = next;
    this.stateChanges += 1;
    const event = new Event('statechange');
    this.dispatchEvent(event);
    this.onstatechange?.(event);
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.rig.resumeCalls += 1;
    if (this.current === 'closed') {
      return later(() => {
        throw new DOMException('the AudioContext is closed', 'InvalidStateError');
      });
    }
    switch (this.rig.resumeOutcome) {
      case 'run':
        return later(() => {
          if (this.current !== 'closed') {
            this.force('running');
          }
        });
      case 'stay':
        return later(() => undefined);
      case 'reject':
        return later(() => {
          throw new DOMException('resume() was not allowed', 'InvalidStateError');
        });
      case 'pending':
        return new Promise<void>(() => undefined);
    }
  }

  suspend(): Promise<void> {
    return later(() => {
      if (this.current !== 'closed') {
        this.force('suspended');
      }
    });
  }

  close(): Promise<void> {
    this.force('closed');
    return Promise.resolve();
  }

  createGain(): FakeGain {
    return new FakeGain();
  }

  createOscillator(): FakeOscillator {
    return new FakeOscillator(this.rig);
  }

  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad();
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(channels, Math.max(1, Math.floor(length)), sampleRate);
  }

  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource();
  }
}

export interface DelayedAudioRig {
  /** 之后新建的上下文从这个状态开始（缺省 'suspended'，与浏览器的自动播放策略一致） */
  initialState: FakeContextState;
  /** 之后每次 resume() 的结局（缺省 'run'） */
  resumeOutcome: ResumeOutcome;
  /** 页面上建过的全部上下文，按先后 */
  readonly contexts: readonly FakeLifecycleAudioContext[];
  /** 最近建的上下文；一个都没有时抛错 */
  latest(): FakeLifecycleAudioContext;
  /** 所有上下文上 resume() 的调用总数 */
  resumeCalls(): number;
  /**
   * 已 start、还没调用过 stop 的振荡器个数。一次性音效 start 之后立刻排好 stop，
   * 引擎嗡鸣是持续音（stopEngine 才 stop），所以这个数 > 0 就是引擎在响。
   */
  liveOscillators(): number;
  /** 还原 window.AudioContext / webkitAudioContext */
  restore(): void;
}

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

/** 用迟到的替身换掉 window.AudioContext（含 webkit 前缀）；用完必须 restore() */
export function installDelayedAudioContext(): DelayedAudioRig {
  const state: RigState = {
    initialState: 'suspended',
    resumeOutcome: 'run',
    resumeCalls: 0,
    contexts: [],
    oscillators: [],
  };

  class PageAudioContext extends FakeLifecycleAudioContext {
    constructor() {
      super(state);
    }
  }

  const audioWindow = window as AudioWindow;
  const hadOwnAudioContext = Object.prototype.hasOwnProperty.call(audioWindow, 'AudioContext');
  const hadOwnWebkit = Object.prototype.hasOwnProperty.call(audioWindow, 'webkitAudioContext');
  const originalAudioContext = audioWindow.AudioContext;
  const originalWebkit = audioWindow.webkitAudioContext;
  audioWindow.AudioContext = PageAudioContext as unknown as typeof AudioContext;
  audioWindow.webkitAudioContext = PageAudioContext as unknown as typeof AudioContext;

  return {
    get initialState(): FakeContextState {
      return state.initialState;
    },
    set initialState(next: FakeContextState) {
      state.initialState = next;
    },
    get resumeOutcome(): ResumeOutcome {
      return state.resumeOutcome;
    },
    set resumeOutcome(next: ResumeOutcome) {
      state.resumeOutcome = next;
    },
    contexts: state.contexts,
    latest(): FakeLifecycleAudioContext {
      const context = state.contexts[state.contexts.length - 1];
      if (!context) {
        throw new Error('no AudioContext has been constructed');
      }
      return context;
    },
    resumeCalls: () => state.resumeCalls,
    liveOscillators: () =>
      state.oscillators.filter((oscillator) => oscillator.started && !oscillator.stopCalled).length,
    restore(): void {
      if (hadOwnAudioContext) {
        audioWindow.AudioContext = originalAudioContext;
      } else {
        Reflect.deleteProperty(audioWindow, 'AudioContext');
      }
      if (hadOwnWebkit) {
        audioWindow.webkitAudioContext = originalWebkit;
      } else {
        Reflect.deleteProperty(audioWindow, 'webkitAudioContext');
      }
    },
  };
}

// ───────────────────────────── 页面前后台 ─────────────────────────────

/**
 * 页面转入后台 / 回到前台时浏览器发的事件。jsdom 的 visibilityState 恒为 'visible'，
 * 这里换成可拨的（document.hidden 跟着变）；事件照浏览器的样子发在 document / window 上。
 */
export interface PageReturnEvents {
  /** visibilityState → hidden，document 上发 visibilitychange（冒泡，与浏览器一致） */
  hide(): void;
  /** visibilityState → visible，document 上发 visibilitychange */
  show(): void;
  /** window 的 pageshow（从往返缓存恢复：persisted = true） */
  pageShow(): void;
  /** window 获得焦点 */
  focus(): void;
  /** 还原 visibilityState / hidden */
  restore(): void;
}

export function installPageReturnEvents(): PageReturnEvents {
  let visibility: DocumentVisibilityState = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => visibility === 'hidden',
  });
  const changeTo = (next: DocumentVisibilityState): void => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  };
  return {
    hide: () => changeTo('hidden'),
    show: () => changeTo('visible'),
    pageShow: () => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    },
    focus: () => {
      window.dispatchEvent(new FocusEvent('focus'));
    },
    restore: () => {
      Reflect.deleteProperty(document, 'visibilityState');
      Reflect.deleteProperty(document, 'hidden');
    },
  };
}

// ───────────────────────────── 用户手势 ─────────────────────────────

export type GestureType = 'pointerup' | 'touchend' | 'click' | 'keydown';

/** 合约里会让音频恢复的四种手势 */
export const GESTURE_TYPES: readonly GestureType[] = ['pointerup', 'touchend', 'click', 'keydown'];

/** 造一个可取消、会冒泡的手势事件（与浏览器发出的一样） */
export function createGesture(type: GestureType): Event {
  const init = { bubbles: true, cancelable: true, composed: true };
  switch (type) {
    case 'pointerup':
      return new PointerEvent('pointerup', { ...init, pointerType: 'touch', isPrimary: true });
    case 'touchend':
      return new TouchEvent('touchend', init);
    case 'click':
      return new MouseEvent('click', init);
    case 'keydown':
      return new KeyboardEvent('keydown', { ...init, key: 'w' });
  }
}

// ───────────────────────────── 让出事件循环 ─────────────────────────────

/** 让出若干轮宏任务：resume() 之后的微任务、statechange 都跑完 */
export async function flushTasks(rounds: number = 2): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}
