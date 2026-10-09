import {
  CAMPAIGN_SPEAKERS,
  type CampaignSpeaker,
  type CampaignSpeakerId,
  type RadioLine,
} from '@/features/campaign/CampaignData';
import { onLocaleChange, tr, type LocalizedText } from '@/i18n';
import { getSpeakerGlyph } from '@/ui/theme/hudGlyphs';
import {
  prefersReducedMotion,
  readHudLayoutDensity,
  type HudLayoutDensity,
} from '@/ui/theme/hudPalette';
import { injectRadioStyles } from '@/ui/theme/radioStyles';

export type RadioPriority = 'normal' | 'high';

export interface RadioEnqueueOptions {
  priority?: RadioPriority;
}

type RadioPhase = 'reveal' | 'hold' | 'out';

/** 当前台词的配音状态：none 没有配音（或尚未开口）、playing 正在说、done 已说完 / 被停下 */
type RadioVoiceState = 'none' | 'playing' | 'done';

interface QueuedLine {
  line: RadioLine;
  priority: RadioPriority;
  /** 被打断后重播的这一次（再被打断就不再重播） */
  replay?: boolean;
}

interface ActiveLine extends QueuedLine {
  speaker: CampaignSpeaker;
  phase: RadioPhase;
  /** 当前阶段已经过的时间（秒） */
  phaseTime: number;
  revealSeconds: number;
  holdSeconds: number;
  chars: number;
  shown: number;
  voice: RadioVoiceState;
  /** 配音说话期间停留阶段的上限（秒，兜底：收不到“说完”时也会继续） */
  voiceHoldCap: number;
}

/** 逐字显示速度（字/秒）与停留时间 */
const REVEAL_CHARS_PER_SECOND = 42;
const HOLD_BASE_SECONDS = 1.5;
const HOLD_PER_CHAR_SECONDS = 0.085;
const HOLD_MIN_SECONDS = 2.6;
const HOLD_MAX_SECONDS = 6.5;
const OUT_SECONDS = 0.26;
const GAP_SECONDS = 0.18;
/** 队列上限：超出时丢弃最旧的普通台词 */
const MAX_QUEUE = 6;
/** 被打断的台词若已显示了这么多停留时间，就视为已经传达，不再重播 */
const INTERRUPT_DELIVERED_RATIO = 0.6;
const MAX_STEPS_PER_UPDATE = 64;
/** 配音说完后台词至少再停留的时间（秒） */
const VOICE_TAIL_SECONDS = 0.4;
/** 配音说话期间的兜底余量（秒）：超过“开口时刻 + 时长 + 尾巴 + 余量”仍未收到说完也继续 */
const VOICE_SAFETY_SECONDS = 2.5;
/** 积压估计：配音从台词出现到开口的余量（秒，加载 / 解码；预取过的台词通常立即开口） */
const VOICE_START_ALLOWANCE_SECONDS = 0.6;
/** 读屏文本里“呼号：台词”的分隔符 */
const SPEAKER_SEPARATOR: LocalizedText = { en: ': ', zh: '：' };

function resolveSpeaker(id: CampaignSpeakerId | string): CampaignSpeaker {
  const known = (CAMPAIGN_SPEAKERS as Readonly<Record<string, CampaignSpeaker>>)[id];
  if (known) {
    return known;
  }
  return {
    id: 'hq',
    callsign: { en: String(id || 'Unknown channel'), zh: String(id || '未知频道') },
    name: { en: '', zh: '' },
    tone: 'sys',
    gender: 'neutral',
    voiceDirection: { en: '', zh: '' },
  };
}

function countChars(text: string): number {
  return Array.from(text).length;
}

/** 阅读停留时间：基础 + 每字，夹在上下限之间 */
function readingHoldSeconds(chars: number): number {
  return Math.min(
    HOLD_MAX_SECONDS,
    Math.max(HOLD_MIN_SECONDS, HOLD_BASE_SECONDS + chars * HOLD_PER_CHAR_SECONDS)
  );
}

/**
 * 无线电通讯：说话人（呼号 / 头像 / 色调来自 CAMPAIGN_SPEAKERS）+ 逐字台词的紧凑面板。
 *
 * - enqueue 时若空闲（isBusy() 为 false）立即显示（同步回调 onLineShown），否则排队；
 *   一句播完后的短暂间隔（GAP_SECONDS）也算忙碌，保证两句之间总有停顿、面板不会闪一下就换句；
 *   'high' 优先级立即打断普通台词（被打断且尚未说完的台词回到队首重播，每句最多重播一次：
 *   重播时再被打断就不再回队），高优先级之间按先后排队并排在所有普通台词前面。
 *   重复文本（正在播或已排队）会被忽略。是否允许打断正在配音的台词由调用方决定（isVoicing）。
 * - 显示时间完全由 update(dt) 驱动：暂停游戏 = 台词停住。
 * - 配音（表现层在 onLineShown 里播放）：开口时 holdForVoice(line, 时长)，台词至少停留到
 *   配音结束后 VOICE_TAIL_SECONDS；说话期间下一句等待，直到 releaseVoice(line)（或兜底上限）。
 *   被打断时若配音还没说完，这句一定重播（重播时表现层重新播放配音）。没有配音时时序不变。
 * - 切换语言：当前台词（呼号、正文、读屏文本）立即按新语言重写。
 * - 面板 pointer-events: none，不遮挡准星与雷达；DOM 首次显示时才创建，没有 document 时只跑逻辑。
 */
export class RadioComms {
  public onLineShown?: (line: RadioLine) => void;

  private readonly queue: QueuedLine[] = [];
  private current: ActiveLine | null = null;
  private gap: number = 0;
  private seq: 'a' | 'b' = 'a';
  private disposed: boolean = false;
  private reducedMotion: boolean = false;

  private root: HTMLDivElement | null = null;
  private portrait: HTMLDivElement | null = null;
  private callsign: HTMLSpanElement | null = null;
  private name: HTMLSpanElement | null = null;
  private text: HTMLDivElement | null = null;
  private srText: HTMLDivElement | null = null;
  private density: HudLayoutDensity = 'desktop';
  private lastGlyphSpeaker: string = '';
  private readonly unsubscribeLocale: () => void;

  private readonly handleResize = (): void => {
    // 等 HUD 自己的 resize 处理先更新布局密度
    window.setTimeout(() => this.applyDensity(), 0);
  };

  constructor() {
    this.unsubscribeLocale = onLocaleChange(() => this.relocalize());
  }

  public enqueue(line: RadioLine, options?: RadioEnqueueOptions): void {
    const text = line && line.text ? tr(line.text) : '';
    if (this.disposed || typeof text !== 'string' || text.trim() === '') {
      return;
    }
    if (this.isDuplicate(text)) {
      return;
    }
    const priority: RadioPriority = options?.priority === 'high' ? 'high' : 'normal';
    const item: QueuedLine = { line, priority };

    if (priority === 'high') {
      if (!this.current || this.current.priority === 'normal') {
        this.interruptCurrent();
        this.startLine(item);
        return;
      }
      const firstNormal = this.queue.findIndex((queued) => queued.priority === 'normal');
      if (firstNormal < 0) {
        this.queue.push(item);
      } else {
        this.queue.splice(firstNormal, 0, item);
      }
    } else {
      this.queue.push(item);
    }
    this.trimQueue();

    if (!this.current && this.gap <= 0) {
      this.showNext();
    }
  }

  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }
    let dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;

    for (let step = 0; step < MAX_STEPS_PER_UPDATE; step += 1) {
      const current = this.current;
      if (!current) {
        if (this.gap > 0) {
          const used = Math.min(this.gap, dt);
          this.gap -= used;
          dt -= used;
          if (this.gap > 0) {
            return;
          }
        }
        if (this.queue.length === 0) {
          return;
        }
        this.showNext();
        continue;
      }

      const remaining = this.phaseDuration(current) - current.phaseTime;
      if (dt < remaining) {
        current.phaseTime += dt;
        if (current.phase === 'reveal') {
          this.renderReveal(current);
        }
        return;
      }
      dt -= Math.max(0, remaining);
      this.advancePhase(current);
    }
  }

  /** 正在播放、有排队台词，或处于两句之间的间隔中（与 enqueue 的立即显示条件一致） */
  public isBusy(): boolean {
    return this.current !== null || this.queue.length > 0 || this.gap > 0;
  }

  /** 当前台词的配音正在说（holdForVoice 之后、releaseVoice 之前） */
  public isVoicing(): boolean {
    return (
      this.current !== null && this.current.voice === 'playing' && this.current.phase !== 'out'
    );
  }

  /**
   * 估计无线电全部说完（当前台词 + 排队台词 + 间隔）还要多少秒（update 驱动的时间）。
   * voiceSeconds 给出某句的配音时长（没有配音时返回 null）：有配音的台词至少停留到配音说完，
   * 尚未开口的台词另加一点开口余量。只用于等待上限（Boss 收尾），不影响播放时序。
   */
  public estimateRemainingSeconds(voiceSeconds?: (line: RadioLine) => number | null): number {
    if (this.disposed) {
      return 0;
    }
    let total = Math.max(0, this.gap);
    const current = this.current;
    if (current) {
      let remaining = OUT_SECONDS - current.phaseTime;
      if (current.phase === 'reveal') {
        remaining = current.revealSeconds - current.phaseTime + current.holdSeconds + OUT_SECONDS;
      } else if (current.phase === 'hold') {
        remaining = this.phaseDuration(current) - current.phaseTime + OUT_SECONDS;
      }
      if (current.voice === 'none' && current.phase !== 'out') {
        // 配音还没开口（加载中）：从现在起至少还要整句配音的时长
        const voice = this.voiceSecondsOf(current.line, voiceSeconds);
        if (voice !== null) {
          remaining = Math.max(
            remaining,
            voice + VOICE_START_ALLOWANCE_SECONDS + VOICE_TAIL_SECONDS + OUT_SECONDS
          );
        }
      }
      total += Math.max(0, remaining) + GAP_SECONDS;
    }
    for (const queued of this.queue) {
      const chars = countChars(tr(queued.line.text));
      const reveal = this.reducedMotion ? 0 : chars / REVEAL_CHARS_PER_SECOND;
      const voice = this.voiceSecondsOf(queued.line, voiceSeconds);
      // 逐字阶段与配音同时开始：整句停留 = max(逐字 + 阅读停留, 开口余量 + 配音 + 尾巴)
      const shown =
        voice === null
          ? reveal + readingHoldSeconds(chars)
          : Math.max(
              reveal + readingHoldSeconds(chars),
              VOICE_START_ALLOWANCE_SECONDS + voice + VOICE_TAIL_SECONDS
            );
      total += shown + OUT_SECONDS + GAP_SECONDS;
    }
    return total;
  }

  private voiceSecondsOf(
    line: RadioLine,
    voiceSeconds: ((line: RadioLine) => number | null) | undefined
  ): number | null {
    const seconds = voiceSeconds?.(line);
    return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  /**
   * 当前台词的配音开口了：台词至少停留到“此刻 + 配音时长 + VOICE_TAIL_SECONDS”，
   * 并在 releaseVoice 之前不进入淡出（兜底：再多等 VOICE_SAFETY_SECONDS）。
   * line 不是当前台词（已换句 / 已清空）时忽略。
   */
  public holdForVoice(line: RadioLine, durationSeconds: number): void {
    const current = this.current;
    if (this.disposed || !current || current.line !== line || current.phase === 'out') {
      return;
    }
    const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
    const required = this.elapsedOf(current) + duration + VOICE_TAIL_SECONDS;
    current.holdSeconds = Math.max(current.holdSeconds, required - current.revealSeconds);
    current.voice = 'playing';
    current.voiceHoldCap = required + VOICE_SAFETY_SECONDS - current.revealSeconds;
  }

  /**
   * 当前台词的配音说完 / 被停下 / 不可用：解除等待；说过话的台词再停留 VOICE_TAIL_SECONDS。
   * line 不是当前台词时忽略。
   */
  public releaseVoice(line: RadioLine): void {
    const current = this.current;
    if (this.disposed || !current || current.line !== line || current.phase === 'out') {
      return;
    }
    if (current.voice === 'playing') {
      current.holdSeconds = Math.max(
        current.holdSeconds,
        this.elapsedOf(current) + VOICE_TAIL_SECONDS - current.revealSeconds
      );
      current.voice = 'done';
    }
  }

  public clear(): void {
    this.queue.length = 0;
    this.current = null;
    this.gap = 0;
    this.hidePanel();
  }

  public dispose(): void {
    this.unsubscribeLocale();
    this.clear();
    if (this.root && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('orientationchange', this.handleResize);
    }
    this.root?.remove();
    this.root = null;
    this.portrait = null;
    this.callsign = null;
    this.name = null;
    this.text = null;
    this.srText = null;
    this.disposed = true;
  }

  // ---------------------------------------------------------------------------
  // 队列与时序
  // ---------------------------------------------------------------------------

  private isDuplicate(text: string): boolean {
    if (this.current && tr(this.current.line.text) === text) {
      return true;
    }
    return this.queue.some((queued) => tr(queued.line.text) === text);
  }

  private trimQueue(): void {
    while (this.queue.length > MAX_QUEUE) {
      const oldestNormal = this.queue.findIndex((queued) => queued.priority === 'normal');
      this.queue.splice(oldestNormal >= 0 ? oldestNormal : this.queue.length - 1, 1);
    }
  }

  /**
   * 普通台词被高优先级打断：没说完的放回普通台词的最前面重播——每句最多重播一次
   * （重播时又被打断就放弃，避免同一句被反复从头念起）。
   */
  private interruptCurrent(): void {
    const current = this.current;
    if (!current) {
      return;
    }
    this.current = null;
    // 配音还在说：没传达完，重播；配音已说完：已传达；没有配音：按停留时间判断
    const delivered =
      current.phase === 'out' ||
      current.voice === 'done' ||
      (current.voice === 'none' &&
        current.phase === 'hold' &&
        current.phaseTime >= current.holdSeconds * INTERRUPT_DELIVERED_RATIO);
    if (!delivered && current.priority === 'normal' && !current.replay) {
      const firstNormal = this.queue.findIndex((queued) => queued.priority === 'normal');
      const item: QueuedLine = { line: current.line, priority: current.priority, replay: true };
      if (firstNormal < 0) {
        this.queue.push(item);
      } else {
        this.queue.splice(firstNormal, 0, item);
      }
      this.trimQueue();
    }
  }

  private showNext(): void {
    const next = this.queue.shift();
    if (next) {
      this.startLine(next);
    }
  }

  private startLine(item: QueuedLine): void {
    const chars = countChars(tr(item.line.text));
    this.reducedMotion = prefersReducedMotion();
    const revealSeconds = this.reducedMotion ? 0 : chars / REVEAL_CHARS_PER_SECOND;
    const holdSeconds = readingHoldSeconds(chars);
    const active: ActiveLine = {
      ...item,
      speaker: resolveSpeaker(item.line.speaker),
      phase: revealSeconds > 0 ? 'reveal' : 'hold',
      phaseTime: 0,
      revealSeconds,
      holdSeconds,
      chars,
      shown: revealSeconds > 0 ? 0 : chars,
      voice: 'none',
      voiceHoldCap: holdSeconds,
    };
    this.current = active;
    this.gap = 0;
    this.renderLine(active);

    const callback = this.onLineShown;
    if (callback) {
      try {
        callback(item.line);
      } catch (error) {
        console.error('[RadioComms] onLineShown failed', error);
      }
    }
  }

  private phaseDuration(line: ActiveLine): number {
    switch (line.phase) {
      case 'reveal':
        return line.revealSeconds;
      case 'hold':
        // 配音说话期间等它说完（releaseVoice），兜底上限 voiceHoldCap
        return line.voice === 'playing'
          ? Math.max(line.holdSeconds, line.voiceHoldCap)
          : line.holdSeconds;
      case 'out':
        return OUT_SECONDS;
    }
  }

  /** 这句已显示了多久（逐字 + 停留阶段，秒） */
  private elapsedOf(line: ActiveLine): number {
    switch (line.phase) {
      case 'reveal':
        return line.phaseTime;
      case 'hold':
        return line.revealSeconds + line.phaseTime;
      case 'out':
        return line.revealSeconds + line.holdSeconds + line.phaseTime;
    }
  }

  /**
   * 界面语言切换：当前台词按新语言重写（呼号、正文、读屏文本），不重播入场动画；
   * 逐字阶段按新文本的字数继续，阅读停留至少满足新文本的长度。
   */
  private relocalize(): void {
    const current = this.current;
    if (this.disposed || !current) {
      return;
    }
    const chars = countChars(tr(current.line.text));
    current.chars = chars;
    if (current.phase === 'reveal') {
      current.revealSeconds = chars / REVEAL_CHARS_PER_SECOND;
      current.shown = Math.min(chars, Math.floor(current.phaseTime * REVEAL_CHARS_PER_SECOND) + 1);
    } else {
      current.shown = chars;
    }
    current.holdSeconds = Math.max(current.holdSeconds, readingHoldSeconds(chars));
    this.renderSpeaker(current);
    this.renderReveal(current, true);
  }

  private advancePhase(line: ActiveLine): void {
    line.phaseTime = 0;
    if (line.phase === 'reveal') {
      line.phase = 'hold';
      line.shown = line.chars;
      this.renderReveal(line);
      this.root?.setAttribute('data-phase', 'hold');
      return;
    }
    if (line.phase === 'hold') {
      line.phase = 'out';
      this.root?.classList.add('is-out');
      this.root?.setAttribute('data-phase', 'out');
      return;
    }
    this.current = null;
    this.gap = GAP_SECONDS;
    this.hidePanel();
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private ensureDom(): boolean {
    if (this.root) {
      if (!this.root.isConnected && typeof document !== 'undefined') {
        document.body.appendChild(this.root);
      }
      return true;
    }
    if (typeof document === 'undefined' || !document.body) {
      return false;
    }
    injectRadioStyles();

    const root = document.createElement('div');
    root.id = 'radio-comms';
    root.setAttribute('data-hud', 'radio');
    root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'rc-panel';

    const portrait = document.createElement('div');
    portrait.className = 'rc-portrait';
    portrait.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'rc-body';
    const head = document.createElement('div');
    head.className = 'rc-head';
    const callsign = document.createElement('span');
    callsign.className = 'rc-callsign';
    const name = document.createElement('span');
    name.className = 'rc-name';
    const signal = document.createElement('span');
    signal.className = 'rc-signal';
    signal.setAttribute('aria-hidden', 'true');
    signal.append(
      document.createElement('i'),
      document.createElement('i'),
      document.createElement('i')
    );
    head.append(callsign, name, signal);

    const text = document.createElement('div');
    text.className = 'rc-text';
    text.setAttribute('aria-hidden', 'true');
    body.append(head, text);

    const srText = document.createElement('div');
    srText.className = 'rc-sr';
    srText.setAttribute('aria-live', 'polite');

    panel.append(portrait, body);
    root.append(panel, srText);
    document.body.appendChild(root);

    this.root = root;
    this.portrait = portrait;
    this.callsign = callsign;
    this.name = name;
    this.text = text;
    this.srText = srText;

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.applyDensity();
    return true;
  }

  private applyDensity(): void {
    if (!this.root) {
      return;
    }
    this.density = readHudLayoutDensity();
    if (this.root.getAttribute('data-density') !== this.density) {
      this.root.setAttribute('data-density', this.density);
    }
  }

  private renderLine(line: ActiveLine): void {
    if (!this.ensureDom() || !this.root) {
      return;
    }
    const root = this.root;
    const speaker = line.speaker;
    this.applyDensity();
    root.setAttribute('data-speaker', String(line.line.speaker));
    root.setAttribute('data-tone', speaker.tone);
    root.setAttribute('data-priority', line.priority);
    root.setAttribute('data-phase', line.phase);
    root.classList.remove('is-out');
    // 交替动画名以便连续两句也能重播入场动画
    this.seq = this.seq === 'a' ? 'b' : 'a';
    root.setAttribute('data-seq', this.seq);

    const glyphKey = String(line.line.speaker);
    if (this.portrait && this.lastGlyphSpeaker !== glyphKey) {
      this.portrait.innerHTML = getSpeakerGlyph(glyphKey);
      this.lastGlyphSpeaker = glyphKey;
    }
    this.renderSpeaker(line);
    this.renderReveal(line);
    if (root.style.display !== 'block') {
      root.style.display = 'block';
    }
  }

  /** 呼号、角色名与读屏文本（按当前语言） */
  private renderSpeaker(line: ActiveLine): void {
    const speaker = line.speaker;
    const callsign = tr(speaker.callsign);
    if (this.callsign) {
      this.callsign.textContent = callsign;
    }
    if (this.name) {
      const name = tr(speaker.name);
      const extra = name.startsWith(callsign) ? name.slice(callsign.length).trim() : name;
      this.name.textContent = extra;
    }
    if (this.srText) {
      this.srText.textContent = `${callsign}${tr(SPEAKER_SEPARATOR)}${tr(line.line.text)}`;
    }
  }

  private renderReveal(line: ActiveLine, force: boolean = false): void {
    if (line.phase === 'reveal' && !force) {
      const shown = Math.min(line.chars, Math.floor(line.phaseTime * REVEAL_CHARS_PER_SECOND) + 1);
      if (shown === line.shown && this.text?.textContent) {
        return;
      }
      line.shown = shown;
    }
    if (!this.text) {
      return;
    }
    const text = tr(line.line.text);
    const visible =
      line.shown >= line.chars ? text : Array.from(text).slice(0, line.shown).join('');
    if (this.text.textContent !== visible) {
      this.text.textContent = visible;
    }
  }

  private hidePanel(): void {
    if (!this.root) {
      return;
    }
    this.root.style.display = 'none';
    this.root.classList.remove('is-out');
    this.root.setAttribute('data-phase', 'idle');
    if (this.srText) {
      this.srText.textContent = '';
    }
  }
}
