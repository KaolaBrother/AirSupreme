import {
  CAMPAIGN_CREDITS,
  CAMPAIGN_EPILOGUE,
  CAMPAIGN_PROLOGUE,
  CAMPAIGN_TITLE,
  TOTAL_LEVELS,
  type CampaignChapter,
} from '@/features/campaign/CampaignData';
import { tr, type LocalizedText } from '@/i18n';
import { GLYPH_PIN } from '@/ui/theme/hudGlyphs';
import { prefersReducedMotion, readHudLayoutDensity } from '@/ui/theme/hudPalette';
import { injectStoryStyles } from '@/ui/theme/storyStyles';

export interface DebriefData {
  chapter: CampaignChapter;
  scoreGained: number;
  totalScore: number;
  kills: number;
  civiliansLost: number;
  alliesLost: number;
  bonusPoints: Array<{ label: string; points: number }>;
}

export type StoryCardKind = 'chapter' | 'debrief' | 'ending';

export interface ChapterIntroOptions {
  /** 第一章前先播放序章 */
  includePrologue?: boolean;
  /** 本章新武器的解锁台词；缺省 / null 不显示 */
  unlockLine?: string | null;
}

/** 单张卡片：序章、章节、结算、尾声、片尾字幕 */
type StoryCard = 'prologue' | 'chapter' | 'debrief' | 'epilogue' | 'credits';

interface StorySession {
  kind: StoryCardKind;
  cards: StoryCard[];
  cardIndex: number;
  onDone: () => void;
  chapter: CampaignChapter | null;
  unlockLine: string | null;
  debrief: DebriefData | null;
  finalScore: number;
}

interface TypedParagraph {
  element: HTMLParagraphElement;
  typed: Text;
  full: string;
  shown: number;
}

/** 打字机节奏（毫秒）：约 29 字/秒，标点处停顿 */
const TYPE_START_DELAY_MS = 650;
const TYPE_CHAR_MS = 34;
const TYPE_PAUSE_COMMA_MS = 120;
const TYPE_PAUSE_STOP_MS = 280;
const TYPE_PARAGRAPH_GAP_MS = 380;
/**
 * 句末标点（。！？… 以及英文 . ! ?）长停顿，句中标点（，、；： 以及 , ; :）短停顿。
 * 用 Unicode 属性同时覆盖中英文标点。
 */
const STOP_MARK = /[\p{Sentence_Terminal}…]/u;
const PAUSE_MARK = /\p{Terminal_Punctuation}/u;

/** 全文出现后的自动翻页停留：按字数估算阅读时间 */
const HOLD_MS_PER_CHAR = 42;
const HOLD_MIN_MS = 3800;
const HOLD_MAX_MS = 9000;

/** 结算行依次浮现 */
const DEBRIEF_ROW_STAGGER_MS = 110;
const DEBRIEF_ROW_BASE_MS = 300;
const DEBRIEF_ROW_ANIM_MS = 380;

/** 片尾字幕 */
const CREDITS_MS_PER_ROW = 2300;
const CREDITS_MIN_MS = 14000;
const CREDITS_STATIC_MS = 6000;
const FINALE_HOLD_MS = 4200;

const LEAVE_MS = 300;
/** 减少动态效果时没有打字阶段，短暂屏蔽输入，防止刚出现就被连按跳过 */
const REDUCED_MOTION_INPUT_GUARD_MS = 400;

const ROUTE_LABEL: LocalizedText = { en: 'WAYPOINT', zh: '航路点' };
const FINAL_SCORE_LABEL: LocalizedText = { en: 'FINAL SCORE', zh: '最终得分' };
const CREDIT_SEPARATOR = '——';
/** 演出期间写在 <html> 上，样式据此收起战斗 HUD 与指示层 */
const ACTIVE_ATTRIBUTE = 'data-story-overlay';

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** 千分位整数，负数用真正的减号 */
export function formatStoryNumber(value: number, signed = false): string {
  const rounded = Math.round(safeNumber(value));
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (rounded < 0) {
    return `−${digits}`;
  }
  return signed ? `+${digits}` : digits;
}

function splitCampaignTitle(): { latin: string; title: string } {
  const parts = tr(CAMPAIGN_TITLE)
    .split('·')
    .map((part) => part.trim());
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { latin: parts[0], title: parts.slice(1).join(' · ') };
  }
  return { latin: '', title: tr(CAMPAIGN_TITLE) };
}

function pauseAfter(char: string): number {
  if (STOP_MARK.test(char)) {
    return TYPE_PAUSE_STOP_MS;
  }
  if (PAUSE_MARK.test(char)) {
    return TYPE_PAUSE_COMMA_MS;
  }
  return 0;
}

function holdFor(chars: number): number {
  return Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, chars * HOLD_MS_PER_CHAR));
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/**
 * 剧情覆盖层：章节卡（可带序章与武器解锁）、任务结算、结局尾声 + 片尾字幕。
 *
 * - 全部由自身定时器驱动，不依赖游戏循环，也不阻塞它；游戏画面在半透明幕布后继续渲染。
 * - 点击 / 轻触 / 空格 / 回车：打字中先显示全文，再按一次翻页；Esc 或「跳过」直接结束整段。
 * - 回调在覆盖层收起后调用，且每次 show* 至多调用一次；hide()/dispose() 或新的 show* 会静默取消。
 * - DOM 首次使用时才创建；import 时不触碰 document / window。
 */
export class StoryOverlay {
  /** 打字机每显示一个字调用一次（用于打字音效） */
  public onTypeTick?: () => void;
  /** 每张卡片出现时调用：序章与章节卡为 'chapter'，尾声与片尾字幕为 'ending' */
  public onCardShown?: (kind: StoryCardKind) => void;

  private root: HTMLDivElement | null = null;
  private stage: HTMLDivElement | null = null;
  private prompt: HTMLDivElement | null = null;
  private skipButton: HTMLButtonElement | null = null;

  private session: StorySession | null = null;
  private paragraphs: TypedParagraph[] = [];
  private paragraphIndex: number = 0;
  private typing: boolean = false;
  private settled: boolean = false;
  private extras: HTMLElement | null = null;
  private finale: HTMLElement | null = null;
  private finaleShown: boolean = false;
  private reducedMotion: boolean = false;
  private cardShownAt: number = 0;

  private typeTimer: number = 0;
  private stepTimer: number = 0;
  private leaveTimer: number = 0;
  private listening: boolean = false;
  private disposed: boolean = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.session) {
      return;
    }
    const action = StoryOverlay.classifyKey(event);
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) {
      return;
    }
    if (action === 'skip') {
      this.skip();
      return;
    }
    this.handleAdvanceInput();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.session) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest('button')) {
      return;
    }
    this.handleAdvanceInput();
  };

  private readonly handleResize = (): void => {
    // 等 HUD 自己的 resize 处理先更新布局密度
    window.setTimeout(() => {
      this.root?.setAttribute('data-density', readHudLayoutDensity());
    }, 0);
  };

  private readonly handleSkipClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.skip();
  };

  public showChapterIntro(
    chapter: CampaignChapter,
    onComplete: () => void,
    options?: ChapterIntroOptions
  ): void {
    const unlockLine =
      typeof options?.unlockLine === 'string' && options.unlockLine.trim().length > 0
        ? options.unlockLine
        : null;
    this.begin({
      kind: 'chapter',
      cards: options?.includePrologue ? ['prologue', 'chapter'] : ['chapter'],
      cardIndex: 0,
      onDone: onComplete,
      chapter,
      unlockLine,
      debrief: null,
      finalScore: 0,
    });
  }

  public showDebrief(data: DebriefData, onContinue: () => void): void {
    this.begin({
      kind: 'debrief',
      cards: ['debrief'],
      cardIndex: 0,
      onDone: onContinue,
      chapter: data.chapter,
      unlockLine: null,
      debrief: data,
      finalScore: data.totalScore,
    });
  }

  /** 结局：尾声（CAMPAIGN_EPILOGUE）→ 片尾字幕（CAMPAIGN_CREDITS + 最终得分） */
  public showEnding(data: { finalScore: number }, onComplete: () => void): void {
    this.begin({
      kind: 'ending',
      cards: ['epilogue', 'credits'],
      cardIndex: 0,
      onDone: onComplete,
      chapter: null,
      unlockLine: null,
      debrief: null,
      finalScore: safeNumber(data.finalScore),
    });
  }

  public isActive(): boolean {
    return this.session !== null;
  }

  /** 立即结束当前整段演出并调用其回调 */
  public skip(): void {
    if (this.session) {
      this.finish();
    }
  }

  /** 立即隐藏，不调用回调 */
  public hide(): void {
    this.session = null;
    this.clearTimers();
    this.detachListeners();
    this.resetCardState();
    StoryOverlay.clearActiveMarker();
    if (this.leaveTimer) {
      window.clearTimeout(this.leaveTimer);
      this.leaveTimer = 0;
    }
    if (this.root) {
      this.root.classList.remove('is-leaving', 'is-instant');
      this.root.style.display = 'none';
      this.root.removeAttribute('data-card');
    }
    this.stage?.replaceChildren();
  }

  public dispose(): void {
    this.hide();
    this.skipButton?.removeEventListener('click', this.handleSkipClick);
    this.root?.remove();
    this.root = null;
    this.stage = null;
    this.prompt = null;
    this.skipButton = null;
    this.disposed = true;
  }

  // ---------------------------------------------------------------------------
  // 演出流程
  // ---------------------------------------------------------------------------

  private begin(session: StorySession): void {
    if (this.disposed || typeof document === 'undefined') {
      // 没有可用的 DOM：不能卡住流程，直接放行
      StoryOverlay.invoke(session.onDone);
      return;
    }
    this.clearTimers();
    this.resetCardState();
    this.session = session;
    this.reducedMotion = prefersReducedMotion();
    this.mount();
    const root = this.root as HTMLDivElement;
    if (this.leaveTimer) {
      window.clearTimeout(this.leaveTimer);
      this.leaveTimer = 0;
    }
    root.classList.remove('is-leaving', 'is-instant');
    root.setAttribute('data-kind', session.kind);
    root.setAttribute('data-density', readHudLayoutDensity());
    root.style.display = 'block';
    document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, session.kind);
    this.attachListeners();
    this.renderCard();
  }

  private renderCard(): void {
    const session = this.session;
    const stage = this.stage;
    const root = this.root;
    if (!session || !stage || !root) {
      return;
    }
    this.clearTimers();
    this.resetCardState();
    root.classList.remove('is-instant');

    const card = session.cards[session.cardIndex];
    root.setAttribute('data-card', card);
    root.setAttribute('aria-label', this.describeCard(session, card));
    this.cardShownAt = nowMs();

    switch (card) {
      case 'prologue':
        stage.replaceChildren(this.buildPrologueCard());
        break;
      case 'chapter':
        stage.replaceChildren(this.buildChapterCard(session));
        break;
      case 'debrief':
        stage.replaceChildren(this.buildDebriefCard(session));
        break;
      case 'epilogue':
        stage.replaceChildren(this.buildEpilogueCard(session));
        break;
      case 'credits':
        stage.replaceChildren(this.buildCreditsCard(session));
        break;
    }
    stage.scrollTop = 0;
    this.updateChrome(card);

    const kind = session.kind;
    StoryOverlay.invoke(() => this.onCardShown?.(kind));
    if (this.session !== session) {
      return; // 回调里切换了演出
    }

    if (card === 'debrief') {
      this.startDebriefReveal();
    } else if (card === 'credits') {
      this.startCredits();
    } else {
      this.startTyping();
    }
  }

  private advance(): void {
    const session = this.session;
    if (!session) {
      return;
    }
    if (session.cardIndex + 1 < session.cards.length) {
      session.cardIndex += 1;
      this.renderCard();
      return;
    }
    this.finish();
  }

  private finish(): void {
    const session = this.session;
    if (!session) {
      return;
    }
    this.session = null;
    this.clearTimers();
    this.detachListeners();
    this.resetCardState();
    StoryOverlay.clearActiveMarker();
    this.startLeave();
    StoryOverlay.invoke(session.onDone);
  }

  private startLeave(): void {
    const root = this.root;
    if (!root) {
      return;
    }
    if (this.reducedMotion) {
      root.style.display = 'none';
      this.stage?.replaceChildren();
      return;
    }
    root.classList.add('is-leaving');
    if (this.leaveTimer) {
      window.clearTimeout(this.leaveTimer);
    }
    this.leaveTimer = window.setTimeout(() => {
      this.leaveTimer = 0;
      if (this.session || !this.root) {
        return;
      }
      this.root.classList.remove('is-leaving');
      this.root.style.display = 'none';
      this.stage?.replaceChildren();
    }, LEAVE_MS);
  }

  private handleAdvanceInput(): void {
    const session = this.session;
    if (!session) {
      return;
    }
    if (this.reducedMotion && nowMs() - this.cardShownAt < REDUCED_MOTION_INPUT_GUARD_MS) {
      return;
    }
    const card = session.cards[session.cardIndex];
    if (card === 'credits') {
      if (this.finaleShown) {
        this.finish();
      } else {
        this.showFinale();
      }
      return;
    }
    if (!this.settled) {
      this.revealAll();
      return;
    }
    if (card === 'debrief') {
      this.finish();
      return;
    }
    this.advance();
  }

  // ---------------------------------------------------------------------------
  // 打字机
  // ---------------------------------------------------------------------------

  private startTyping(): void {
    if (this.paragraphs.length === 0 || this.reducedMotion) {
      this.revealAll();
      return;
    }
    this.typing = true;
    this.paragraphIndex = 0;
    this.paragraphs[0].element.classList.add('is-typing');
    this.typeTimer = window.setTimeout(() => this.typeNext(), TYPE_START_DELAY_MS);
  }

  private typeNext(): void {
    this.typeTimer = 0;
    if (!this.typing) {
      return;
    }
    const paragraph = this.paragraphs[this.paragraphIndex];
    if (!paragraph) {
      this.onTextSettled();
      return;
    }
    if (paragraph.shown >= paragraph.full.length) {
      paragraph.element.classList.remove('is-typing');
      this.paragraphIndex += 1;
      const next = this.paragraphs[this.paragraphIndex];
      if (!next) {
        this.onTextSettled();
        return;
      }
      next.element.classList.add('is-typing');
      this.typeTimer = window.setTimeout(() => this.typeNext(), TYPE_PARAGRAPH_GAP_MS);
      return;
    }

    const codePoint = paragraph.full.codePointAt(paragraph.shown) ?? 0;
    const char = String.fromCodePoint(codePoint);
    paragraph.shown += char.length;
    StoryOverlay.renderParagraph(paragraph);
    if (char.trim().length > 0) {
      const tick = this.onTypeTick;
      if (tick) {
        StoryOverlay.invoke(tick);
      }
    }
    this.typeTimer = window.setTimeout(() => this.typeNext(), TYPE_CHAR_MS + pauseAfter(char));
  }

  /** 显示当前卡片的全部内容（快进） */
  private revealAll(): void {
    if (this.typeTimer) {
      window.clearTimeout(this.typeTimer);
      this.typeTimer = 0;
    }
    for (const paragraph of this.paragraphs) {
      paragraph.shown = paragraph.full.length;
      paragraph.element.classList.remove('is-typing');
      StoryOverlay.renderParagraph(paragraph);
    }
    this.root?.classList.add('is-instant');
    this.onTextSettled();
  }

  private onTextSettled(): void {
    this.typing = false;
    if (this.settled) {
      return;
    }
    this.settled = true;
    for (const paragraph of this.paragraphs) {
      paragraph.element.classList.remove('is-typing');
    }
    this.extras?.classList.remove('is-pending');

    const session = this.session;
    if (!session) {
      return;
    }
    const card = session.cards[session.cardIndex];
    if (card === 'debrief' || card === 'credits') {
      return;
    }
    // 自动翻页：按全文 + 目标清单字数估算阅读时间
    let chars = 0;
    for (const paragraph of this.paragraphs) {
      chars += paragraph.full.length;
    }
    chars += this.extras?.textContent?.length ?? 0;
    this.scheduleStep(() => this.advance(), holdFor(chars));
  }

  private static renderParagraph(paragraph: TypedParagraph): void {
    const shownText = paragraph.full.slice(0, paragraph.shown);
    if (paragraph.typed.data !== shownText) {
      paragraph.typed.data = shownText;
    }
    paragraph.element.setAttribute('data-rest', paragraph.full.slice(paragraph.shown));
  }

  // ---------------------------------------------------------------------------
  // 结算 / 片尾
  // ---------------------------------------------------------------------------

  private startDebriefReveal(): void {
    if (this.reducedMotion) {
      this.revealAll();
      return;
    }
    const rows = this.stage?.querySelectorAll('.so-row').length ?? 0;
    const duration = DEBRIEF_ROW_BASE_MS + rows * DEBRIEF_ROW_STAGGER_MS + DEBRIEF_ROW_ANIM_MS;
    this.scheduleStep(() => this.onTextSettled(), duration);
  }

  private startCredits(): void {
    const roll = this.stage?.querySelector<HTMLElement>('.so-roll');
    const rows = roll?.childElementCount ?? 0;
    if (!roll || this.reducedMotion) {
      if (roll) {
        roll.style.top = '50%';
        roll.style.transform = 'translateY(-50%)';
      }
      this.scheduleStep(() => this.showFinale(), CREDITS_STATIC_MS);
      return;
    }
    const duration = Math.max(CREDITS_MIN_MS, rows * CREDITS_MS_PER_ROW);
    roll.style.animationDuration = `${duration}ms`;
    this.scheduleStep(() => this.showFinale(), duration);
  }

  private showFinale(): void {
    if (this.finaleShown) {
      return;
    }
    this.finaleShown = true;
    this.settled = true;
    const roll = this.stage?.querySelector<HTMLElement>('.so-roll');
    if (roll) {
      roll.style.display = 'none';
    }
    this.finale?.classList.remove('is-pending');
    this.updateChrome('credits');
    this.scheduleStep(() => this.finish(), FINALE_HOLD_MS);
  }

  // ---------------------------------------------------------------------------
  // 卡片构建
  // ---------------------------------------------------------------------------

  private buildPrologueCard(): HTMLElement {
    const { latin, title } = splitCampaignTitle();
    const card = el('article', 'so-card');
    const ident = this.buildIdent({
      kicker: tr({ en: 'PROLOGUE', zh: '序章' }),
      title,
      operationCn: '',
      operationCode: latin,
      location: null,
      currentLevel: null,
      doneThrough: 0,
    });
    card.append(
      ident,
      StoryOverlay.buildRule(),
      this.buildTypedText(CAMPAIGN_PROLOGUE.map((line) => tr(line)))
    );
    return card;
  }

  private buildChapterCard(session: StorySession): HTMLElement {
    const chapter = session.chapter as CampaignChapter;
    const card = el('article', 'so-card');
    const ident = this.buildIdent({
      kicker: tr(chapter.chapterLabel),
      title: tr(chapter.title),
      operationCn: tr(chapter.operationName),
      operationCode: chapter.codename,
      location: tr(chapter.location),
      currentLevel: chapter.level,
      doneThrough: chapter.level - 1,
    });

    const extras = el('section', 'so-extras is-pending');
    const objectives = chapter.objectives ?? [];
    if (objectives.length > 0) {
      extras.appendChild(el('div', 'so-obj-title', tr({ en: 'OBJECTIVES', zh: '任务目标' })));
      const list = el('ul', 'so-objectives');
      for (const objective of objectives) {
        list.appendChild(el('li', undefined, tr(objective)));
      }
      extras.appendChild(list);
    }
    if (session.unlockLine) {
      const unlock = el('div', 'so-unlock');
      unlock.setAttribute('data-hud-unlock', '');
      unlock.append(
        el('span', 'so-unlock-tag', tr({ en: 'NEW WEAPON', zh: '新武器' })),
        el('span', undefined, session.unlockLine)
      );
      extras.appendChild(unlock);
    }
    this.extras = extras;

    card.append(
      ident,
      StoryOverlay.buildRule(),
      this.buildTypedText((chapter.intro ?? []).map((line) => tr(line))),
      extras
    );
    return card;
  }

  private buildDebriefCard(session: StorySession): HTMLElement {
    const data = session.debrief as DebriefData;
    const chapter = data.chapter;
    const card = el('article', 'so-card is-debrief');
    const ident = this.buildIdent({
      kicker: tr(chapter.chapterLabel),
      status: tr({ en: 'MISSION COMPLETE', zh: '任务完成' }),
      title: tr(chapter.title),
      operationCn: tr(chapter.operationName),
      operationCode: chapter.codename,
      location: null,
      currentLevel: chapter.level,
      doneThrough: chapter.level - 1,
    });
    if (chapter.debriefSummary) {
      ident.appendChild(el('p', 'so-summary', tr(chapter.debriefSummary)));
    }

    const column = el('section', 'so-text so-debrief');
    const tally = el('dl', 'so-tally');
    let index = 0;
    const addRow = (
      label: string,
      value: string,
      options: { tone?: 'threat' | 'ally'; className?: string; key?: string } = {}
    ): void => {
      const row = el('div', options.className ? `so-row ${options.className}` : 'so-row');
      row.style.setProperty('--i', String(index));
      index += 1;
      if (options.tone) {
        row.setAttribute('data-tone', options.tone);
      }
      if (options.key) {
        row.setAttribute('data-stat', options.key);
      }
      row.append(el('dt', undefined, label), el('dd', undefined, value));
      tally.appendChild(row);
    };

    addRow(tr({ en: 'Mission score', zh: '本关得分' }), formatStoryNumber(data.scoreGained, true), {
      key: 'score',
    });
    addRow(tr({ en: 'Kills', zh: '击落 / 摧毁' }), formatStoryNumber(data.kills), { key: 'kills' });
    addRow(tr({ en: 'Civilian losses', zh: '平民损失' }), formatStoryNumber(data.civiliansLost), {
      key: 'civilians',
      tone: safeNumber(data.civiliansLost) > 0 ? 'threat' : undefined,
    });
    addRow(tr({ en: 'Allied losses', zh: '友军损失' }), formatStoryNumber(data.alliesLost), {
      key: 'allies',
      tone: safeNumber(data.alliesLost) > 0 ? 'threat' : undefined,
    });
    for (const bonus of data.bonusPoints ?? []) {
      const points = safeNumber(bonus.points);
      addRow(bonus.label, formatStoryNumber(points, true), {
        className: 'is-bonus',
        key: 'bonus',
        tone: points < 0 ? 'threat' : 'ally',
      });
    }
    addRow(tr({ en: 'Total score', zh: '总分' }), formatStoryNumber(data.totalScore), {
      className: 'is-total',
      key: 'total',
    });

    const actions = el('div', 'so-actions');
    const continueButton = el('button', 'so-continue', tr({ en: 'Continue', zh: '继续' }));
    continueButton.type = 'button';
    continueButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.session === session) {
        this.finish();
      }
    });
    actions.appendChild(continueButton);
    column.append(tally, actions);

    card.append(ident, StoryOverlay.buildRule(), column);
    return card;
  }

  private buildEpilogueCard(session: StorySession): HTMLElement {
    const { latin, title } = splitCampaignTitle();
    const card = el('article', 'so-card');
    const ident = this.buildIdent({
      kicker: tr({ en: 'EPILOGUE', zh: '尾声' }),
      title,
      operationCn: '',
      operationCode: latin,
      location: null,
      currentLevel: null,
      doneThrough: TOTAL_LEVELS,
    });
    const score = el('div', 'so-route-caption so-final');
    score.setAttribute('data-stat', 'final-score');
    score.append(
      el('span', undefined, tr(FINAL_SCORE_LABEL)),
      el('span', undefined, formatStoryNumber(session.finalScore))
    );
    ident.appendChild(score);
    card.append(
      ident,
      StoryOverlay.buildRule(),
      this.buildTypedText(CAMPAIGN_EPILOGUE.map((line) => tr(line)))
    );
    return card;
  }

  private buildCreditsCard(session: StorySession): HTMLElement {
    const wrap = el('div', 'so-credits');
    const roll = el('div', 'so-roll');
    const lines = CAMPAIGN_CREDITS.map((line) => tr(line));
    const last = lines[lines.length - 1];
    const closing = last && !last.includes(CREDIT_SEPARATOR) && lines.length > 1 ? last : null;
    if (closing) {
      lines.pop();
    }

    lines.forEach((line, index) => {
      if (index === 0 && !line.includes(CREDIT_SEPARATOR)) {
        const titleBlock = el('div', 'so-roll-title');
        const { latin, title } =
          line === tr(CAMPAIGN_TITLE) ? splitCampaignTitle() : { latin: '', title: line };
        if (latin) {
          titleBlock.appendChild(el('span', 'so-roll-latin', latin));
        }
        titleBlock.appendChild(el('span', undefined, title));
        roll.appendChild(titleBlock);
        return;
      }
      const separator = line.indexOf(CREDIT_SEPARATOR);
      if (separator < 0) {
        roll.appendChild(el('div', 'so-roll-line', line));
        return;
      }
      const row = el('div', 'so-roll-row');
      const sep = el('span', 'so-roll-sep');
      sep.setAttribute('aria-hidden', 'true');
      row.append(
        el('span', 'so-role', line.slice(0, separator).trim()),
        sep,
        el('span', 'so-name', line.slice(separator + CREDIT_SEPARATOR.length).trim())
      );
      roll.appendChild(row);
    });

    const finale = el('div', 'so-finale is-pending');
    finale.append(
      el('div', 'so-finale-label', tr(FINAL_SCORE_LABEL)),
      el('div', 'so-finale-score', formatStoryNumber(session.finalScore))
    );
    if (closing) {
      finale.appendChild(el('div', 'so-finale-line', closing));
    }
    this.finale = finale;

    wrap.append(roll, finale);
    return wrap;
  }

  private buildIdent(spec: {
    kicker: string;
    status?: string;
    title: string;
    operationCn: string;
    operationCode: string;
    location: string | null;
    currentLevel: number | null;
    doneThrough: number;
  }): HTMLElement {
    const ident = el('header', 'so-ident');
    const kicker = el('div', 'so-kicker');
    kicker.appendChild(el('span', undefined, spec.kicker));
    if (spec.status) {
      kicker.appendChild(el('span', 'so-status', spec.status));
    }
    ident.appendChild(kicker);
    ident.appendChild(el('h1', 'so-title', spec.title));

    if (spec.operationCn || spec.operationCode) {
      const operation = el('div', 'so-operation');
      if (spec.operationCn) {
        operation.appendChild(el('span', 'so-op-cn', spec.operationCn));
      }
      // 英文界面下行动名与英文代号可能相同：只显示一次
      const sameAsName =
        spec.operationCode.trim().toLowerCase() === spec.operationCn.trim().toLowerCase();
      if (spec.operationCode && !sameAsName) {
        operation.appendChild(el('span', 'so-op-code', spec.operationCode));
      }
      ident.appendChild(operation);
    }

    if (spec.location) {
      const location = el('div', 'so-location');
      const pin = el('span');
      pin.innerHTML = GLYPH_PIN;
      location.append(pin, el('span', undefined, spec.location));
      ident.appendChild(location);
    }

    ident.appendChild(StoryOverlay.buildRoute(spec.currentLevel, spec.doneThrough));
    return ident;
  }

  /** 战役航线：十个航路点，已完成实心、当前高亮 */
  private static buildRoute(currentLevel: number | null, doneThrough: number): HTMLElement {
    const route = el('div', 'so-route');
    const track = el('div', 'so-route-track');
    track.setAttribute('aria-hidden', 'true');
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      const point = el('span', 'so-waypoint');
      point.style.setProperty('--i', String(level - 1));
      if (currentLevel === level) {
        point.classList.add('is-current');
      } else if (level <= doneThrough) {
        point.classList.add('is-done');
      }
      track.appendChild(point);
    }
    const reached = currentLevel ?? Math.min(TOTAL_LEVELS, Math.max(0, doneThrough));
    const caption = el('div', 'so-route-caption');
    caption.append(
      el('span', undefined, tr(ROUTE_LABEL)),
      el('span', undefined, `${String(reached).padStart(2, '0')} / ${TOTAL_LEVELS}`)
    );
    route.setAttribute('role', 'img');
    route.setAttribute(
      'aria-label',
      tr(
        { en: 'Campaign progress {reached} of {total}', zh: '战役进度 {reached} / {total}' },
        { reached, total: TOTAL_LEVELS }
      )
    );
    route.append(track, caption);
    return route;
  }

  private static buildRule(): HTMLElement {
    const rule = el('div', 'so-rule');
    rule.setAttribute('aria-hidden', 'true');
    return rule;
  }

  private buildTypedText(lines: readonly string[]): HTMLElement {
    const text = el('section', 'so-text');
    text.setAttribute('aria-label', lines.join(' '));
    this.paragraphs = [];
    for (const line of lines) {
      const paragraph = el('p', 'so-para');
      const typed = document.createTextNode('');
      const caret = el('span', 'so-caret');
      caret.setAttribute('aria-hidden', 'true');
      paragraph.append(typed, caret);
      paragraph.setAttribute('data-rest', line);
      text.appendChild(paragraph);
      this.paragraphs.push({ element: paragraph, typed, full: line, shown: 0 });
    }
    return text;
  }

  private describeCard(session: StorySession, card: StoryCard): string {
    switch (card) {
      case 'prologue':
        return tr(
          { en: 'Prologue: {title}', zh: '序章 {title}' },
          { title: splitCampaignTitle().title }
        );
      case 'chapter':
      case 'debrief':
        return session.chapter
          ? `${tr(session.chapter.chapterLabel)} ${tr(session.chapter.title)}`
          : '';
      case 'epilogue':
        return tr({ en: 'Epilogue', zh: '尾声' });
      case 'credits':
        return tr({ en: 'Credits', zh: '片尾字幕' });
    }
  }

  /** 提示语与跳过按钮随卡片切换（每张卡片都按当前语言重写） */
  private updateChrome(card: StoryCard): void {
    const prompt = this.prompt;
    const skip = this.skipButton;
    if (!prompt || !skip) {
      return;
    }
    const pressSpace: LocalizedText = { en: 'Press Space to continue', zh: '按空格键继续' };
    const tapScreen: LocalizedText = { en: 'Tap to continue', zh: '轻触屏幕继续' };
    let desktopText = tr(pressSpace);
    let touchText = tr(tapScreen);
    if (card === 'debrief') {
      desktopText = tr({ en: 'Press Enter to continue', zh: '按回车键继续' });
      touchText = tr({ en: 'Tap “Continue”', zh: '轻触「继续」' });
    } else if (card === 'credits' && !this.finaleShown) {
      desktopText = tr({ en: 'Press Space to skip the credits', zh: '按空格键跳过字幕' });
      touchText = tr({ en: 'Tap to skip the credits', zh: '轻触跳过字幕' });
    }
    const desktop = prompt.querySelector('.so-desktop-only');
    const touch = prompt.querySelector('.so-touch-only');
    if (desktop && desktop.textContent !== desktopText) {
      desktop.textContent = desktopText;
    }
    if (touch && touch.textContent !== touchText) {
      touch.textContent = touchText;
    }
    const skipLabel = skip.querySelector('.so-skip-label');
    const skipText = tr({ en: 'Skip', zh: '跳过' });
    if (skipLabel && skipLabel.textContent !== skipText) {
      skipLabel.textContent = skipText;
    }
    skip.setAttribute('aria-label', tr({ en: 'Skip story', zh: '跳过剧情' }));
    skip.style.display = card === 'debrief' ? 'none' : 'inline-flex';
  }

  // ---------------------------------------------------------------------------
  // DOM / 监听 / 定时器
  // ---------------------------------------------------------------------------

  private mount(): void {
    if (this.root) {
      if (!this.root.isConnected) {
        document.body.appendChild(this.root);
      }
      return;
    }
    injectStoryStyles();

    const root = el('div');
    root.id = 'story-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.style.display = 'none';

    const backdrop = el('div', 'so-backdrop');
    const barTop = el('div', 'so-bar so-bar-top');
    const barBottom = el('div', 'so-bar so-bar-bottom');
    const stage = el('div', 'so-stage');

    const prompt = el('div', 'so-prompt');
    prompt.setAttribute('aria-hidden', 'true');
    prompt.append(el('span', 'so-desktop-only'), el('span', 'so-touch-only'));
    barBottom.appendChild(prompt);

    // 文字由 updateChrome 按当前语言写入
    const skip = el('button', 'so-skip');
    skip.type = 'button';
    skip.append(el('span', 'so-skip-label'), el('span', 'so-key so-desktop-only', 'Esc'));
    skip.addEventListener('click', this.handleSkipClick);

    barBottom.appendChild(skip);
    root.append(backdrop, barTop, stage, barBottom);
    document.body.appendChild(root);

    this.root = root;
    this.stage = stage;
    this.prompt = prompt;
    this.skipButton = skip;
  }

  private attachListeners(): void {
    if (this.listening || !this.root) {
      return;
    }
    // 捕获阶段拦截空格 / 回车 / Esc，避免同一按键在游戏里触发开火或暂停
    window.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.root.addEventListener('click', this.handleClick);
    this.listening = true;
  }

  private detachListeners(): void {
    if (!this.listening) {
      return;
    }
    window.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.root?.removeEventListener('click', this.handleClick);
    this.listening = false;
  }

  private scheduleStep(callback: () => void, delayMs: number): void {
    if (this.stepTimer) {
      window.clearTimeout(this.stepTimer);
    }
    this.stepTimer = window.setTimeout(() => {
      this.stepTimer = 0;
      callback();
    }, delayMs);
  }

  private clearTimers(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (this.typeTimer) {
      window.clearTimeout(this.typeTimer);
      this.typeTimer = 0;
    }
    if (this.stepTimer) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = 0;
    }
  }

  private resetCardState(): void {
    this.paragraphs = [];
    this.paragraphIndex = 0;
    this.typing = false;
    this.settled = false;
    this.extras = null;
    this.finale = null;
    this.finaleShown = false;
  }

  private static classifyKey(event: KeyboardEvent): 'advance' | 'skip' | null {
    const key = event.key;
    const code = event.code;
    if (key === 'Escape' || key === 'Esc' || code === 'Escape') {
      return 'skip';
    }
    if (
      key === ' ' ||
      key === 'Spacebar' ||
      code === 'Space' ||
      key === 'Enter' ||
      code === 'Enter' ||
      code === 'NumpadEnter'
    ) {
      return 'advance';
    }
    return null;
  }

  private static clearActiveMarker(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE);
    }
  }

  private static invoke(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      console.error('[StoryOverlay] callback failed', error);
    }
  }
}
