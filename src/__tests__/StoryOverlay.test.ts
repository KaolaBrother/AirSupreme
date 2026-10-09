import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_CREDITS,
  CAMPAIGN_EPILOGUE,
  CAMPAIGN_PROLOGUE,
  getCampaignChapter,
  type CampaignChapter,
} from '@/features/campaign/CampaignData';
import { setLocale, type Locale } from '@/i18n';
import { StoryOverlay, type DebriefData } from '@/ui/StoryOverlay';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * api-spec §9 StoryOverlay + integration-notes「Story UI + HUD」：
 * 序章只在 includePrologue 时出现；解锁台词只在传入 unlockLine 时出现；打字机 onTypeTick；
 * skip()/Esc/跳过 结束整段并只回调一次；hide() 与新的 show* 静默取消；结算只在「继续」后回调；
 * 结局 = 尾声 + 片尾字幕（文本来自 CampaignData）；dispose 清理 DOM / 监听 / 定时器。
 * 卡片按显示时的界面语言渲染（英文默认，中文可切换）。
 * 全程使用 fake timers（覆盖层由自身定时器驱动）；只断言 DOM 文本与状态，不看像素。
 */

type CardKind = 'chapter' | 'debrief' | 'ending';

const SKIP_LABEL = { en: 'Skip', zh: '跳过' };
const CONTINUE_LABEL = { en: 'Continue', zh: '继续' };

const CHAPTER_ONE = getCampaignChapter(1);
const CHAPTER_TWO = getCampaignChapter(2);
const CHAPTER_THREE = getCampaignChapter(3);

function overlayRoot(): HTMLElement | null {
  return document.getElementById('story-overlay');
}

function isOverlayShown(): boolean {
  const root = overlayRoot();
  return root !== null && root.isConnected && root.style.display !== 'none';
}

function overlayText(): string {
  return overlayRoot()?.textContent ?? '';
}

/** 去掉空白、分隔点与破折号，便于比较拆成多个 span 的文本 */
function normalize(text: string): string {
  return text.replace(/[\s·—]/g, '');
}

/** 数字可能带千分位分隔符：去掉分隔符后按完整数字匹配 */
function containsNumber(text: string, value: number): boolean {
  return new RegExp(`(^|\\D)${value}(\\D|$)`).test(text.replace(/[,，\s]/g, ''));
}

function press(key: string, code: string = key): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
}

const pressSpace = (): KeyboardEvent => press(' ', 'Space');
const pressEscape = (): KeyboardEvent => press('Escape', 'Escape');

function findButton(label: string): HTMLButtonElement | null {
  const buttons = Array.from(overlayRoot()?.querySelectorAll('button') ?? []);
  return buttons.find((button) => (button.textContent ?? '').includes(label)) ?? null;
}

function makeDebrief(chapter: CampaignChapter, overrides: Partial<DebriefData> = {}): DebriefData {
  return {
    chapter,
    scoreGained: 4321,
    totalScore: 98765,
    kills: 137,
    civiliansLost: 26,
    alliesLost: 19,
    bonusPoints: [{ label: '全歼奖励', points: 650 }],
    ...overrides,
  };
}

describe('StoryOverlay (§9)', () => {
  let overlay: StoryOverlay;
  let cards: CardKind[];

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-story-overlay');
    overlay = new StoryOverlay();
    cards = [];
    overlay.onCardShown = (kind) => {
      cards.push(kind);
    };
  });

  afterEach(() => {
    overlay.dispose();
    resetLocale();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-story-overlay');
    vi.restoreAllMocks();
  });

  describe('chapter intro', () => {
    it.each(LOCALES)(
      'shows the chapter card once as a "chapter" card and marks the page (%s)',
      (locale: Locale) => {
        setLocale(locale);
        const done = vi.fn();
        expect(overlay.isActive()).toBe(false);

        overlay.showChapterIntro(CHAPTER_THREE, done);

        expect(overlay.isActive()).toBe(true);
        expect(isOverlayShown()).toBe(true);
        expect(document.documentElement.hasAttribute('data-story-overlay')).toBe(true);
        expect(cards).toEqual(['chapter']);
        pressSpace();
        const text = overlayText();
        expect(text).toContain(textIn(CHAPTER_THREE.title, locale));
        expect(text).toContain(textIn(CHAPTER_THREE.chapterLabel, locale));
        expect(text).toContain(textIn(CHAPTER_THREE.intro[0], locale));
        expect(text).toContain(textIn(CHAPTER_THREE.objectives[0], locale));
        expect(text).not.toContain(textIn(CAMPAIGN_PROLOGUE[0], locale));
        const other: Locale = locale === 'en' ? 'zh-CN' : 'en';
        expect(text, 'no text from the other language').not.toContain(
          textIn(CHAPTER_THREE.intro[0], other)
        );
        expect(done).not.toHaveBeenCalled();
      }
    );

    it('never shows the prologue without includePrologue', () => {
      const done = vi.fn();
      const seen: string[] = [];
      overlay.showChapterIntro(CHAPTER_ONE, done, { includePrologue: false });
      for (let i = 0; i < 6 && done.mock.calls.length === 0; i += 1) {
        pressSpace();
        seen.push(overlayText());
      }
      expect(done).toHaveBeenCalledTimes(1);
      expect(cards).toEqual(['chapter']);
      expect(seen.some((text) => text.includes(CAMPAIGN_PROLOGUE[0].en))).toBe(false);
    });

    it.each(LOCALES)(
      'plays the prologue before the chapter card with includePrologue (%s)',
      (locale: Locale) => {
        setLocale(locale);
        const done = vi.fn();
        overlay.showChapterIntro(CHAPTER_ONE, done, { includePrologue: true });

        pressSpace();
        const prologue = overlayText();
        for (const line of CAMPAIGN_PROLOGUE) {
          expect(prologue).toContain(textIn(line, locale));
        }
        expect(cards).toEqual(['chapter']);

        pressSpace();
        expect(cards).toEqual(['chapter', 'chapter']);
        pressSpace();
        expect(overlayText()).toContain(textIn(CHAPTER_ONE.title, locale));
        expect(overlayText()).toContain(textIn(CHAPTER_ONE.intro[0], locale));
        expect(done).not.toHaveBeenCalled();

        pressSpace();
        expect(done).toHaveBeenCalledTimes(1);
        expect(overlay.isActive()).toBe(false);
      }
    );

    it('shows an unlock line only when one is passed', () => {
      const unlock = CHAPTER_TWO.unlockLine;
      expect(unlock, 'chapter 2 carries an unlock line').toBeTruthy();
      const unlockEn = unlock?.en ?? '';

      overlay.showChapterIntro(CHAPTER_TWO, vi.fn());
      pressSpace();
      expect(overlayText()).not.toContain(unlockEn);

      overlay.showChapterIntro(CHAPTER_TWO, vi.fn(), { unlockLine: null });
      pressSpace();
      expect(overlayText()).not.toContain(unlockEn);

      overlay.showChapterIntro(CHAPTER_TWO, vi.fn(), { unlockLine: unlockEn });
      pressSpace();
      expect(overlayText()).toContain(unlockEn);

      setLocale('zh-CN');
      overlay.showChapterIntro(CHAPTER_TWO, vi.fn(), { unlockLine: unlock?.zh ?? '' });
      pressSpace();
      expect(overlayText()).toContain(unlock?.zh ?? '');

      overlay.showChapterIntro(CHAPTER_THREE, vi.fn(), { unlockLine: '测试专用解锁台词' });
      pressSpace();
      expect(overlayText()).toContain('测试专用解锁台词');
    });

    it('types the text out over time, ticking onTypeTick per character', () => {
      const tick = vi.fn();
      overlay.onTypeTick = tick;
      overlay.showChapterIntro(CHAPTER_THREE, vi.fn());

      const firstParagraph = CHAPTER_THREE.intro[0].en;
      expect(overlayText()).not.toContain(firstParagraph);
      expect(tick).not.toHaveBeenCalled();
      const startLength = overlayText().length;

      vi.advanceTimersByTime(1500);
      const ticks = tick.mock.calls.length;
      expect(ticks, 'characters typed in 1.5 s').toBeGreaterThan(10);
      expect(overlayText().length).toBeGreaterThan(startLength);
      expect(overlayText()).toContain(firstParagraph.slice(0, 5));

      pressSpace();
      expect(overlayText()).toContain(firstParagraph);
      const afterReveal = tick.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(tick.mock.calls.length, 'no ticks once the text is revealed').toBe(afterReveal);
    });

    it('advances by itself once the text has been read', () => {
      const done = vi.fn();
      overlay.showChapterIntro(CHAPTER_ONE, done, { includePrologue: true });
      vi.advanceTimersByTime(240_000);
      expect(cards).toEqual(['chapter', 'chapter']);
      expect(done).toHaveBeenCalledTimes(1);
      expect(overlay.isActive()).toBe(false);
    });
  });

  describe('ending a sequence', () => {
    it('skip() ends the whole sequence and calls back exactly once', () => {
      const done = vi.fn();
      overlay.showChapterIntro(CHAPTER_ONE, done, { includePrologue: true });
      overlay.skip();
      expect(done).toHaveBeenCalledTimes(1);
      expect(overlay.isActive()).toBe(false);
      expect(document.documentElement.hasAttribute('data-story-overlay')).toBe(false);

      overlay.skip();
      vi.advanceTimersByTime(240_000);
      expect(done).toHaveBeenCalledTimes(1);
      expect(cards, 'the chapter card after the prologue is never shown').toEqual(['chapter']);
    });

    it('Esc ends the whole sequence and calls back exactly once', () => {
      const done = vi.fn();
      overlay.showChapterIntro(CHAPTER_ONE, done, { includePrologue: true });
      pressEscape();
      pressEscape();
      pressSpace();
      vi.advanceTimersByTime(240_000);
      expect(done).toHaveBeenCalledTimes(1);
      expect(cards).toEqual(['chapter']);
    });

    it.each(LOCALES)(
      'the Skip button ends the sequence and calls back exactly once (%s)',
      (locale: Locale) => {
        setLocale(locale);
        const done = vi.fn();
        overlay.showChapterIntro(CHAPTER_TWO, done);
        const skip = findButton(textIn(SKIP_LABEL, locale));
        expect(skip, `a ${textIn(SKIP_LABEL, locale)} button`).not.toBeNull();
        skip?.click();
        skip?.click();
        vi.advanceTimersByTime(240_000);
        expect(done).toHaveBeenCalledTimes(1);
      }
    );

    it('hide() cancels silently', () => {
      const done = vi.fn();
      overlay.showChapterIntro(CHAPTER_TWO, done);
      vi.advanceTimersByTime(800);
      overlay.hide();
      expect(overlay.isActive()).toBe(false);
      expect(isOverlayShown()).toBe(false);
      expect(document.documentElement.hasAttribute('data-story-overlay')).toBe(false);
      pressSpace();
      pressEscape();
      vi.advanceTimersByTime(240_000);
      expect(done).not.toHaveBeenCalled();
    });

    it('a new show* silently cancels the previous sequence', () => {
      const first = vi.fn();
      const second = vi.fn();
      overlay.showChapterIntro(CHAPTER_TWO, first);
      overlay.showDebrief(makeDebrief(CHAPTER_TWO), second);
      expect(cards).toEqual(['chapter', 'debrief']);
      findButton(CONTINUE_LABEL.en)?.click();
      vi.advanceTimersByTime(240_000);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('swallows Space / Enter / Esc only while a card is up', () => {
      const done = vi.fn();
      overlay.showChapterIntro(CHAPTER_THREE, done);
      expect(pressSpace().defaultPrevented).toBe(true);
      expect(pressEscape().defaultPrevented).toBe(true);
      expect(done).toHaveBeenCalledTimes(1);

      expect(pressSpace().defaultPrevented).toBe(false);
      expect(press('Enter').defaultPrevented).toBe(false);
      expect(pressEscape().defaultPrevented).toBe(false);

      overlay.showChapterIntro(CHAPTER_THREE, vi.fn());
      expect(press('Enter').defaultPrevented).toBe(true);
    });
  });

  describe('debrief', () => {
    it.each(LOCALES)('shows the chapter and every number (%s)', (locale: Locale) => {
      setLocale(locale);
      overlay.showDebrief(makeDebrief(CHAPTER_THREE), vi.fn());
      expect(cards).toEqual(['debrief']);
      pressSpace();
      const text = overlayText();
      expect(text).toContain(textIn(CHAPTER_THREE.title, locale));
      expect(text).toContain(textIn(CHAPTER_THREE.debriefSummary, locale));
      expect(text).toContain('全歼奖励');
      for (const value of [4321, 98765, 137, 26, 19, 650]) {
        expect(containsNumber(text, value), `debrief shows ${value}`).toBe(true);
      }
    });

    it('never renders NaN for non-finite numbers', () => {
      overlay.showDebrief(
        makeDebrief(CHAPTER_THREE, {
          scoreGained: Number.NaN,
          totalScore: Number.POSITIVE_INFINITY,
          bonusPoints: [{ label: '异常', points: Number.NaN }],
        }),
        vi.fn()
      );
      pressSpace();
      expect(overlayText()).not.toMatch(/NaN|Infinity/);
    });

    it('waits for Continue: time and an early key press never continue', () => {
      const proceed = vi.fn();
      overlay.showDebrief(makeDebrief(CHAPTER_TWO), proceed);
      pressSpace();
      vi.advanceTimersByTime(240_000);
      expect(proceed).not.toHaveBeenCalled();
      expect(overlay.isActive()).toBe(true);
      expect(isOverlayShown()).toBe(true);
    });

    it.each(LOCALES)('continues exactly once on Continue (%s)', (locale: Locale) => {
      setLocale(locale);
      const proceed = vi.fn();
      overlay.showDebrief(makeDebrief(CHAPTER_TWO), proceed);
      const button = findButton(textIn(CONTINUE_LABEL, locale));
      expect(button, `a ${textIn(CONTINUE_LABEL, locale)} button`).not.toBeNull();
      button?.click();
      button?.click();
      vi.advanceTimersByTime(10_000);
      expect(proceed).toHaveBeenCalledTimes(1);
      expect(overlay.isActive()).toBe(false);
    });
  });

  describe('ending', () => {
    it.each(LOCALES)(
      'shows the epilogue then the credits from CampaignData with the final score (%s)',
      (locale: Locale) => {
        setLocale(locale);
        const done = vi.fn();
        overlay.showEnding({ finalScore: 1_234_567 }, done);
        expect(cards).toEqual(['ending']);

        pressSpace();
        const epilogue = overlayText();
        for (const line of CAMPAIGN_EPILOGUE) {
          expect(epilogue).toContain(textIn(line, locale));
        }

        pressSpace();
        expect(cards).toEqual(['ending', 'ending']);
        const credits = normalize(overlayText());
        for (const line of CAMPAIGN_CREDITS) {
          const text = textIn(line, locale);
          expect(credits, `credits line "${text}"`).toContain(normalize(text));
        }
        expect(containsNumber(overlayText(), 1_234_567)).toBe(true);
        expect(done).not.toHaveBeenCalled();
      }
    );

    it('completes on its own and calls back exactly once', () => {
      const done = vi.fn();
      overlay.showEnding({ finalScore: 5000 }, done);
      vi.advanceTimersByTime(600_000);
      expect(done).toHaveBeenCalledTimes(1);
      expect(cards).toEqual(['ending', 'ending']);
      expect(overlay.isActive()).toBe(false);
    });

    it('Esc ends the whole ending once', () => {
      const done = vi.fn();
      overlay.showEnding({ finalScore: 5000 }, done);
      pressEscape();
      vi.advanceTimersByTime(600_000);
      expect(done).toHaveBeenCalledTimes(1);
      expect(cards).toEqual(['ending']);
    });
  });

  describe('dispose', () => {
    it('removes its DOM, key listeners and timers without calling back', () => {
      const done = vi.fn();
      overlay.onTypeTick = vi.fn();
      overlay.showChapterIntro(CHAPTER_ONE, done, { includePrologue: true });
      vi.advanceTimersByTime(900);

      overlay.dispose();

      expect(overlayRoot()).toBeNull();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.documentElement.hasAttribute('data-story-overlay')).toBe(false);
      expect(overlay.isActive()).toBe(false);
      expect(vi.getTimerCount(), 'pending timers after dispose').toBe(0);
      expect(pressEscape().defaultPrevented).toBe(false);
      expect(pressSpace().defaultPrevented).toBe(false);
      vi.advanceTimersByTime(240_000);
      expect(done).not.toHaveBeenCalled();
    });

    it('does not resurrect its DOM when used after dispose', () => {
      overlay.dispose();
      overlay.showChapterIntro(CHAPTER_TWO, vi.fn());
      overlay.showDebrief(makeDebrief(CHAPTER_TWO), vi.fn());
      overlay.showEnding({ finalScore: 1 }, vi.fn());
      expect(overlayRoot()).toBeNull();
      expect(document.documentElement.hasAttribute('data-story-overlay')).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
