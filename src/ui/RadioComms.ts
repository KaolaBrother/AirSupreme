import {
  CAMPAIGN_SPEAKERS,
  type CampaignSpeaker,
  type CampaignSpeakerId,
  type RadioLine,
} from '@/features/campaign/CampaignData';
import { tr } from '@/i18n';
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

interface QueuedLine {
  line: RadioLine;
  priority: RadioPriority;
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

/**
 * 无线电通讯：说话人（呼号 / 头像 / 色调来自 CAMPAIGN_SPEAKERS）+ 逐字台词的紧凑面板。
 *
 * - enqueue 时若空闲（isBusy() 为 false）立即显示（同步回调 onLineShown），否则排队；
 *   一句播完后的短暂间隔（GAP_SECONDS）也算忙碌，保证两句之间总有停顿、面板不会闪一下就换句；
 *   'high' 优先级立即打断普通台词（被打断且尚未说完的台词回到队首重播），
 *   高优先级之间按先后排队并排在所有普通台词前面。重复文本（正在播或已排队）会被忽略。
 * - 显示时间完全由 update(dt) 驱动：暂停游戏 = 台词停住。
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

  private readonly handleResize = (): void => {
    // 等 HUD 自己的 resize 处理先更新布局密度
    window.setTimeout(() => this.applyDensity(), 0);
  };

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

  public clear(): void {
    this.queue.length = 0;
    this.current = null;
    this.gap = 0;
    this.hidePanel();
  }

  public dispose(): void {
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

  /** 普通台词被高优先级打断：没说完的放回普通台词的最前面 */
  private interruptCurrent(): void {
    const current = this.current;
    if (!current) {
      return;
    }
    this.current = null;
    const delivered =
      current.phase === 'out' ||
      (current.phase === 'hold' &&
        current.phaseTime >= current.holdSeconds * INTERRUPT_DELIVERED_RATIO);
    if (!delivered && current.priority === 'normal') {
      const firstNormal = this.queue.findIndex((queued) => queued.priority === 'normal');
      const item: QueuedLine = { line: current.line, priority: current.priority };
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
    const holdSeconds = Math.min(
      HOLD_MAX_SECONDS,
      Math.max(HOLD_MIN_SECONDS, HOLD_BASE_SECONDS + chars * HOLD_PER_CHAR_SECONDS)
    );
    const active: ActiveLine = {
      ...item,
      speaker: resolveSpeaker(item.line.speaker),
      phase: revealSeconds > 0 ? 'reveal' : 'hold',
      phaseTime: 0,
      revealSeconds,
      holdSeconds,
      chars,
      shown: revealSeconds > 0 ? 0 : chars,
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
        return line.holdSeconds;
      case 'out':
        return OUT_SECONDS;
    }
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
      this.srText.textContent = `${callsign}：${tr(line.line.text)}`;
    }
    this.renderReveal(line);
    if (root.style.display !== 'block') {
      root.style.display = 'block';
    }
  }

  private renderReveal(line: ActiveLine): void {
    if (line.phase === 'reveal') {
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
