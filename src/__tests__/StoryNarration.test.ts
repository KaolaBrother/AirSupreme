import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_EPILOGUE,
  CAMPAIGN_PROLOGUE,
  getCampaignChapter,
} from '@/features/campaign/CampaignData';
import { setLocale } from '@/i18n';
import { StoryOverlay, type StoryNarration, type StoryNarrationEvents } from '@/ui/StoryOverlay';
import { LOCALES, resetLocale } from './i18nTestUtils';

/**
 * 剧情卡片旁白（StoryOverlay.narration，表现层用 VoiceSystem 实现）：
 * 序章 / 章节简报 / 尾声每段开始打字时按 VoicedText.id 请求旁白；段首最多等 1.6 秒开口，
 * 超时改为纯文字；开口后按配音时长调整打字节奏，文字比配音早约 0.35 秒打完；段尾等配音说完
 * （兜底：时长 + 1.5 秒）；跳过 / 快进 / Esc 停下旁白；没有旁白挂钩或没有配音时卡片照常打字。
 */

const CHAPTER_ONE = getCampaignChapter(1);
const CHAPTER_FOUR = getCampaignChapter(4);

interface NarrationRequest {
  id: string;
  events: StoryNarrationEvents;
}

class FakeNarration implements StoryNarration {
  readonly requests: NarrationRequest[] = [];
  stopCount = 0;

  /** silent：每个请求都回报“没有配音”（异步，像 VoiceSystem 一样） */
  constructor(private readonly silent = false) {}

  play(voiceId: string, events: StoryNarrationEvents): void {
    this.requests.push({ id: voiceId, events });
    if (this.silent) {
      queueMicrotask(() => events.onSilent());
    }
  }

  stop(): void {
    this.stopCount += 1;
  }

  last(): NarrationRequest {
    const request = this.requests[this.requests.length - 1];
    expect(request, 'expected a narration request').toBeDefined();
    return request;
  }
}

function paragraphs(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#story-overlay .so-para'));
}

/** 第 index 段已打出的文字 */
function typed(index: number): string {
  return paragraphs()[index]?.firstChild?.textContent ?? '';
}

/** 第 index 段还没打出的文字（data-rest） */
function rest(index: number): string {
  return paragraphs()[index]?.getAttribute('data-rest') ?? '';
}

/** 第 index 段已全部打出 */
function done(index: number): boolean {
  return typed(index).length > 0 && rest(index) === '';
}

function pressKey(key: string, code: string): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
}

/** 以 step 毫秒推进（假）时间直到条件成立，返回用了多少毫秒；超过 limitMs 视为失败 */
async function advanceUntil(condition: () => boolean, limitMs: number, step = 10): Promise<number> {
  let elapsed = 0;
  while (!condition()) {
    if (elapsed >= limitMs) {
      throw new Error(`condition not met within ${limitMs} ms`);
    }
    await vi.advanceTimersByTimeAsync(step);
    elapsed += step;
  }
  return elapsed;
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('StoryOverlay narration', () => {
  let overlay: StoryOverlay;
  let narration: FakeNarration;

  /** 纯文字时第 0 段从第一个字到最后一个字的打字时长（毫秒） */
  async function plainTypingMs(): Promise<number> {
    const plain = new StoryOverlay();
    plain.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => typed(0).length > 0, 5000);
    const ms = await advanceUntil(() => done(0), 120_000);
    plain.dispose();
    return ms;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    narration = new FakeNarration();
    overlay = new StoryOverlay();
  });

  afterEach(() => {
    overlay.dispose();
    resetLocale();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('asks for each prologue paragraph by its voice id, one after another', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });

    await advanceUntil(() => narration.requests.length === 1, 3000);
    expect(narration.requests[0].id).toBe(CAMPAIGN_PROLOGUE[0].id);
    expect(typed(0), 'waits for the voice before typing').toBe('');

    narration.last().events.onStart(8);
    await advanceUntil(() => done(0), 20_000);
    narration.last().events.onEnd();
    await advanceUntil(() => narration.requests.length === 2, 3000);
    expect(narration.requests[1].id).toBe(CAMPAIGN_PROLOGUE[1].id);
  });

  it('narrates a chapter card by its intro ids and the ending by the epilogue ids', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_FOUR, () => undefined);
    await advanceUntil(() => narration.requests.length === 1, 3000);
    expect(narration.requests[0].id).toBe(CHAPTER_FOUR.intro[0].id);

    overlay.showEnding({ finalScore: 1000 }, () => undefined);
    await advanceUntil(() => narration.requests.length === 2, 3000);
    expect(narration.requests[1].id).toBe(CAMPAIGN_EPILOGUE[0].id);
  });

  it('waits up to 1.6 s for the voice to start, then types the paragraph as text', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);

    const waited = await advanceUntil(() => typed(0).length > 0, 5000);
    expect(waited).toBeGreaterThanOrEqual(1590);
    expect(waited).toBeLessThanOrEqual(1650);
    expect(narration.stopCount, 'the late voice is called off').toBe(1);

    // 迟到的开口被忽略：这一段不再等 30 秒的配音
    narration.requests[0].events.onStart(30);
    await advanceUntil(() => narration.requests.length === 2, 15_000);
  });

  it('types at once when a paragraph has no voice (unavailable, muted or failed)', async () => {
    narration = new FakeNarration(true);
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);
    const waited = await advanceUntil(() => typed(0).length > 0, 5000);
    expect(waited).toBeLessThan(200);
  });

  it.each(LOCALES)(
    'paces the text to finish about 0.35 s before the voice ends (%s)',
    async (locale) => {
      setLocale(locale);
      const natural = await plainTypingMs();
      expect(natural).toBeGreaterThan(500);

      overlay.narration = narration;
      overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
      await advanceUntil(() => narration.requests.length === 1, 3000);

      // 配音比自然打字慢一半：文字放慢，在配音结束前 0.35 秒打完
      const voiceMs = Math.round(natural * 1.5) + 350;
      narration.last().events.onStart(voiceMs / 1000);
      const typingMs = await advanceUntil(() => done(0), voiceMs + 5000);
      expect(typingMs).toBeGreaterThanOrEqual(voiceMs - 350 - 80);
      expect(typingMs).toBeLessThanOrEqual(voiceMs - 350 + 80);
      expect(typingMs).toBeLessThan(voiceMs);
    }
  );

  it('waits for the voice to end before the next paragraph, at most 1.5 s past its length', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);
    narration.last().events.onStart(10);

    // 文字在 9.65 秒打完；配音（10 秒）没有回报说完：最多再等 1.5 秒
    await advance(11_400);
    expect(done(0)).toBe(true);
    expect(narration.requests).toHaveLength(1);
    await advanceUntil(() => narration.requests.length === 2, 1000);
  });

  it('Esc skips the cards and stops the narration', async () => {
    const onDone = vi.fn();
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, onDone, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);
    narration.last().events.onStart(8);
    await advance(500);

    pressKey('Escape', 'Escape');
    expect(narration.stopCount).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);

    // 停下后的回调一律忽略
    expect(() => narration.requests[0].events.onEnd()).not.toThrow();
    await advance(5000);
    expect(narration.requests).toHaveLength(1);
  });

  it('the skip button stops the narration too', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);
    narration.last().events.onStart(8);

    overlay.skip();
    expect(narration.stopCount).toBe(1);
  });

  it('fast-forwarding stops the narration and shows the whole card', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);
    narration.last().events.onStart(8);
    await advance(300);

    pressKey(' ', 'Space');
    expect(narration.stopCount).toBe(1);
    paragraphs().forEach((_, index) => {
      expect(done(index), `paragraph ${index}`).toBe(true);
    });
    await advance(3000);
    expect(narration.requests, 'no more narration on this card').toHaveLength(1);
  });

  it('keeps cards silent without a narration hook', async () => {
    overlay.narration = null;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    const waited = await advanceUntil(() => typed(0).length > 0, 5000);
    expect(waited).toBeLessThan(1000);
  });

  it('stops narrating a card after the language changes under it', async () => {
    overlay.narration = narration;
    overlay.showChapterIntro(CHAPTER_ONE, () => undefined, { includePrologue: true });
    await advanceUntil(() => narration.requests.length === 1, 3000);
    narration.last().events.onStart(4);
    setLocale('zh-CN');
    await advanceUntil(() => done(0), 20_000);
    narration.last().events.onEnd();

    // 卡片仍是英文：后面的段落不再配音（配音会是中文）
    await advanceUntil(() => typed(1).length > 0, 5000);
    expect(narration.requests).toHaveLength(1);
  });
});
