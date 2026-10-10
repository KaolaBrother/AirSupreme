import { runInNewContext } from 'vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RadioLine } from '@/features/campaign/CampaignData';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD } from '@/ui/HUD';
import { RadioComms, radioFollowOffset } from '@/ui/RadioComms';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';
import {
  FOLLOW_PHONES,
  FOLLOW_TEXT,
  firstTimeAtOrAbove,
  followTimeline,
  glyphWidth,
  radioDisplayTimes,
  shippedRadioLines,
  wrapRadioText,
  type FollowTimeline,
  type WrapModel,
} from './radioFollowTestUtils';

/**
 * 无线电“跟读”（P5 follow-up 4）：手机竖屏（宽 < 700）追尾视角的窄面板里，放不下的台词不再截断，
 * 正文按阅读的速度逐行上移，在这句的显示时间里全部给出。约定：
 * - 逐字显示期间不动；先停 0.8 秒（显示时间不到 3.2 秒时取四分之一），其余时间在各行之间平分，
 *   读者按这个速度读完一行，这一行就移出去；最后几行留到这句消失；
 * - 只走整行：停下来时位置是行高的整数倍；一句显示期间位置只增不减，最后正好停在
 *   （正文行数 − 面板行数）× 行高；
 * - 放得下的台词和以前完全一样：不动、不写行内样式；
 * - 减少动态效果时整行跳，不滑动；
 * - 手机横握、平板、第一人称竖屏面板都不跟读；
 * - 中途切视角、切语言、改变视口大小，面板不能留在过时的状态；这句结束时跟读加的东西全部拿掉。
 * 位置由纯函数 radioFollowOffset 给出，RadioComms 负责测量和写样式；.rc-text 里那层 <span>
 * 用 transform: translateY() 上移。jsdom 不排版（scrollHeight 是 0），面板一节的测量值是打桩的。
 */

const LH = FOLLOW_TEXT.lineHeightPx;
/** 逐行上移的滑动时间上限（秒） */
const SLIDE = 0.25;
/** 开头的停顿上限（秒） */
const START_HOLD = 0.8;

/** 位置（像素）：正文 textLines 行、面板 boxLines 行，这句已显示 seconds 秒 */
function offsetOf(
  textLines: number,
  boxLines: number,
  seconds: number,
  total: number,
  reveal = 0,
  stepOnly = false
): number {
  return radioFollowOffset(textLines * LH, boxLines * LH, LH, seconds, total, reveal, stepOnly);
}

/** 约定的时间表：第 k 行在“开头停顿 + k 份时间”时移出，但不早于逐字显示结束 */
function plan(textLines: number, boxLines: number, total: number, reveal = 0) {
  const startHold = Math.min(START_HOLD, total / 4);
  const perLine = (total - startHold) / textLines;
  const steps = Math.max(0, textLines - boxLines);
  return {
    startHold,
    perLine,
    steps,
    /** 一次滑动最长多久：0.25 秒，且不超过一行所占时间的一半 */
    slide: Math.min(SLIDE, perLine / 2),
    stepAt: (k: number): number => Math.max(startHold + k * perLine, reveal),
    final: steps * LH,
  };
}

function isWholeLines(offset: number): boolean {
  const lines = offset / LH;
  return Math.abs(lines - Math.round(lines)) < 1e-9;
}

/** 从 from 到 to 均匀取 count + 1 个时刻 */
function times(from: number, to: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count);
}

/**
 * 在看门狗下调用 radioFollowOffset：算不完（死循环）时抛出超时错误，而不是把整个测试进程挂住。
 * 传入非有限值的用例都走这里。
 */
function guarded(args: readonly (number | boolean)[]): number {
  const context = { follow: radioFollowOffset, args };
  return runInNewContext('follow(...args)', context, { timeout: 250 }) as number;
}

// ---------------------------------------------------------------------------
// 纯函数
// ---------------------------------------------------------------------------

describe('radioFollowOffset', () => {
  /** 实现方给的例子：95 字的英文台词在 360×640 上，正文 8 行、面板 3 行，逐字 2.26 秒，共 8.76 秒 */
  const EXAMPLE = { textLines: 8, boxLines: 3, total: 8.76, reveal: 2.26 };
  const exampleAt = (seconds: number, stepOnly = false): number =>
    offsetOf(EXAMPLE.textLines, EXAMPLE.boxLines, seconds, EXAMPLE.total, EXAMPLE.reveal, stepOnly);

  /** 各种大小与时间的组合：正文行数、面板行数、显示时间、逐字时间占显示时间的比例 */
  const GRID = [2, 4, 8, 13].flatMap((textLines) =>
    [1, 3, 6]
      .filter((boxLines) => boxLines < textLines)
      .flatMap((boxLines) =>
        [0.2, 2.6, 3.2, 8.76].flatMap((total) =>
          [0, 0.26, 0.6].map((revealShare) => ({
            textLines,
            boxLines,
            total,
            reveal: total * revealShare,
          }))
        )
      )
  );

  const describeCase = (c: (typeof GRID)[number]): string =>
    `${c.textLines} text lines in a ${c.boxLines}-line box, shown ${c.total} s, typed ${c.reveal} s`;

  describe('a line that fits', () => {
    it.each([
      [1, 1],
      [1, 3],
      [3, 3],
      [5, 6],
      [8, 8],
    ])('never moves (%i text lines in a %i-line box)', (textLines, boxLines) => {
      for (const seconds of [0, 0.5, 2.26, 5, 8.76, 60]) {
        expect(offsetOf(textLines, boxLines, seconds, 8.76, 2.26)).toBe(0);
        expect(offsetOf(textLines, boxLines, seconds, 8.76, 2.26, true)).toBe(0);
      }
    });
  });

  describe("the implementer's worked example (8 text lines, 3-line box, 8.76 s, typed for 2.26 s)", () => {
    // 约定：先停 0.8 秒，其余 7.96 秒 8 行平分，每行 0.995 秒；第 k 行在 0.8 + 0.995k 秒移出：
    // 1.795、2.79、3.785、4.78、5.775 秒。第一行那一次还在逐字显示里，等到 2.26 秒
    it.each([
      [1, 2.26],
      [2, 2.79],
      [3, 3.785],
      [4, 4.78],
      [5, 5.775],
    ])('moves text line %i out at %s s', (line, at) => {
      expect(exampleAt(at - 0.001)).toBeCloseTo((line - 1) * LH, 9);
      expect(exampleAt(at + SLIDE)).toBeCloseTo(line * LH, 9);
      const midway = exampleAt(at + SLIDE / 2);
      expect(midway).toBeGreaterThan((line - 1) * LH);
      expect(midway).toBeLessThan(line * LH);
    });

    it('ends 84.5 px up: five whole lines, the last three text lines in the box', () => {
      expect(exampleAt(5.775 + SLIDE)).toBeCloseTo(84.5, 9);
      expect(exampleAt(EXAMPLE.total)).toBeCloseTo(84.5, 9);
      expect(exampleAt(EXAMPLE.total + 30)).toBeCloseTo(84.5, 9);
    });

    it('leaves the last three text lines up for three shares of the time', () => {
      // 最后一次上移在 5.775 秒开始，之后到 8.76 秒是 3 × 0.995 秒
      expect(EXAMPLE.total - 5.775).toBeCloseTo(3 * 0.995, 9);
      for (const seconds of times(5.775 + SLIDE, EXAMPLE.total, 200)) {
        expect(exampleAt(seconds)).toBeCloseTo(84.5, 9);
      }
    });
  });

  describe('over the time a line is shown', () => {
    it('never moves back and never passes the final position', () => {
      const problems: string[] = [];
      for (const { textLines, boxLines, total, reveal } of GRID) {
        const final = (textLines - boxLines) * LH;
        for (const stepOnly of [false, true]) {
          let previous = 0;
          for (const seconds of times(-0.1, total + 1, 1500)) {
            const offset = offsetOf(textLines, boxLines, seconds, total, reveal, stepOnly);
            if (!(offset >= previous) || !(offset <= final + 1e-9)) {
              problems.push(
                `${describeCase({ textLines, boxLines, total, reveal })} at ${seconds} s: ` +
                  `${offset} after ${previous} (final ${final})`
              );
            }
            previous = offset;
          }
        }
      }
      expect(problems.slice(0, 5)).toEqual([]);
    });

    it('rests on whole lines: between slides the position is a whole multiple of the line height', () => {
      const problems: string[] = [];
      let atRest = 0;
      for (const { textLines, boxLines, total, reveal } of GRID) {
        const schedule = plan(textLines, boxLines, total, reveal);
        for (const seconds of times(0, total + 0.5, 1500)) {
          let done = 0;
          let sliding = false;
          for (let k = 1; k <= schedule.steps; k += 1) {
            const at = schedule.stepAt(k);
            if (seconds >= at + schedule.slide + 1e-9) done += 1;
            else if (seconds > at - 1e-9) sliding = true;
          }
          if (sliding) continue;
          atRest += 1;
          const offset = offsetOf(textLines, boxLines, seconds, total, reveal);
          if (!isWholeLines(offset) || Math.abs(offset - done * LH) > 1e-9) {
            problems.push(
              `${describeCase({ textLines, boxLines, total, reveal })} at ${seconds} s: ` +
                `${offset}, expected ${done} lines`
            );
          }
        }
      }
      expect(problems.slice(0, 5)).toEqual([]);
      // 大部分时间是停着的
      expect(atRest).toBeGreaterThan(GRID.length * 1000);
    });

    it('ends exactly at (text lines − box lines) × line height when the display time is over', () => {
      for (const { textLines, boxLines, total, reveal } of GRID) {
        const final = (textLines - boxLines) * LH;
        for (const stepOnly of [false, true]) {
          for (const seconds of [total, total + 0.001, total + 100]) {
            expect(
              offsetOf(textLines, boxLines, seconds, total, reveal, stepOnly),
              `${textLines}/${boxLines} lines, ${total} s, typed ${reveal} s, at ${seconds} s`
            ).toBeCloseTo(final, 9);
          }
        }
      }
    });

    it('is 0 when the line appears and for the whole start hold', () => {
      for (const { textLines, boxLines, total, reveal } of GRID) {
        const { startHold } = plan(textLines, boxLines, total, reveal);
        for (const seconds of [0, startHold / 2, startHold]) {
          expect(offsetOf(textLines, boxLines, seconds, total, reveal)).toBe(0);
          expect(offsetOf(textLines, boxLines, seconds, total, reveal, true)).toBe(0);
        }
      }
    });
  });

  describe('typing', () => {
    it('does not move while the text is still being typed out', () => {
      for (const reveal of [0.5, 2.26, 4, 7, 8.7]) {
        for (const seconds of times(0, reveal, 400).slice(0, -1)) {
          expect(offsetOf(8, 3, seconds, 8.76, reveal), `typed ${reveal} s, at ${seconds} s`).toBe(
            0
          );
          expect(offsetOf(8, 3, seconds, 8.76, reveal, true)).toBe(0);
        }
      }
    });

    it('catches up as soon as the typing is over: every line whose time has come moves out together', () => {
      // 8 行、8.76 秒：第 1–4 行本该在 1.795、2.79、3.785、4.78 秒移出；逐字显示到 4 秒才结束
      const reveal = 4;
      expect(offsetOf(8, 3, reveal - 0.001, 8.76, reveal)).toBe(0);
      // 三行一起滑出去，不是先跳两行再滑一行
      expect(offsetOf(8, 3, reveal + 0.001, 8.76, reveal)).toBeLessThan(0.1 * LH);
      let previous = 0;
      for (const seconds of times(reveal, reveal + SLIDE, 250)) {
        const offset = offsetOf(8, 3, seconds, 8.76, reveal);
        expect(offset - previous, `at ${seconds} s`).toBeLessThan(0.5);
        previous = offset;
      }
      expect(offsetOf(8, 3, reveal + SLIDE, 8.76, reveal)).toBeCloseTo(3 * LH, 9);
      expect(offsetOf(8, 3, reveal, 8.76, reveal, true)).toBeCloseTo(3 * LH, 9);
      // 之后照原来的时间表
      expect(offsetOf(8, 3, 4.78 - 0.001, 8.76, reveal)).toBeCloseTo(3 * LH, 9);
      expect(offsetOf(8, 3, 4.78 + SLIDE, 8.76, reveal)).toBeCloseTo(4 * LH, 9);
    });

    it('is not delayed by a typing phase that ends before the first line is due', () => {
      // 第一行在 1.795 秒移出；逐字显示 1.5 秒就结束了
      for (const seconds of times(0, 9, 900)) {
        expect(offsetOf(8, 3, seconds, 8.76, 1.5)).toBe(offsetOf(8, 3, seconds, 8.76, 0));
      }
    });
  });

  describe('sharing the time between the text lines', () => {
    /** 整行跳的时候，第 k 次上移发生的时刻 */
    const jumpAt = (textLines: number, boxLines: number, total: number, k: number): number =>
      firstTimeAtOrAbove(
        (seconds) => offsetOf(textLines, boxLines, seconds, total, 0, true),
        k * LH - 1e-6,
        total
      );

    it.each([
      [8, 3, 8.76],
      [5, 3, 5.2],
      [12, 1, 8.76],
      [9, 6, 8.76],
      [4, 3, 3.6],
      [6, 4, 2.0],
    ])(
      'gives every text line the same share (%i text lines, %i-line box, %s s)',
      (textLines, boxLines, total) => {
        const steps = textLines - boxLines;
        const startHold = Math.min(START_HOLD, total / 4);
        const share = (total - startHold) / textLines;
        const moves = Array.from({ length: steps }, (_, index) =>
          jumpAt(textLines, boxLines, total, index + 1)
        );
        moves.forEach((at, index) => {
          // 读者按这个速度读完第 k 行（开头停顿 + k 份时间），第 k 行移出
          expect(at, `move ${index + 1}`).toBeCloseTo(startHold + (index + 1) * share, 6);
        });
        // 留在面板里的最后几行，每行还有一份时间
        expect(total - moves[moves.length - 1]).toBeCloseTo(boxLines * share, 6);
      }
    );

    it('starts each slide at the moment a jump would happen with reduced motion', () => {
      for (let k = 1; k <= 5; k += 1) {
        const at = jumpAt(8, 3, 8.76, k);
        expect(offsetOf(8, 3, at - 0.001, 8.76)).toBeCloseTo((k - 1) * LH, 9);
        expect(offsetOf(8, 3, at + 0.01, 8.76)).toBeGreaterThan((k - 1) * LH);
      }
    });
  });

  describe('start hold', () => {
    /** 从前两次整行跳的时刻反推开头的停顿：第一次在“停顿 + 一份”，两次之间隔一份 */
    const measuredStartHold = (total: number): number => {
      const at = (k: number): number =>
        firstTimeAtOrAbove(
          (seconds) => offsetOf(8, 3, seconds, total, 0, true),
          k * LH - 1e-6,
          total
        );
      return at(1) - (at(2) - at(1));
    };

    it.each([3.2, 4, 5.2, 8.76, 20])('is 0.8 s when the line is shown for %s s', (total) => {
      expect(measuredStartHold(total)).toBeCloseTo(0.8, 6);
    });

    it.each([0.4, 1, 2, 2.6, 3.1])(
      'is a quarter of the display time when the line is shown for only %s s',
      (total) => {
        expect(measuredStartHold(total)).toBeCloseTo(total / 4, 6);
      }
    );
  });

  describe('slide', () => {
    it('takes 0.25 s when a text line has half a second or more', () => {
      // 12 行、8.76 秒：每行 0.663 秒
      for (const [textLines, total] of [
        [8, 8.76],
        [12, 8.76],
        [5, 3.4],
      ]) {
        const schedule = plan(textLines, 3, total);
        expect(schedule.perLine).toBeGreaterThanOrEqual(0.5);
        for (let k = 1; k <= schedule.steps; k += 1) {
          const at = schedule.stepAt(k);
          expect(offsetOf(textLines, 3, at, total)).toBeCloseTo((k - 1) * LH, 9);
          expect(offsetOf(textLines, 3, at + 0.24, total)).toBeLessThan(k * LH - 1e-6);
          expect(offsetOf(textLines, 3, at + 0.25, total)).toBeCloseTo(k * LH, 9);
        }
      }
    });

    it('is over within half of a text line’s share when the lines go by faster than that', () => {
      for (const [textLines, total] of [
        [8, 2.6],
        [13, 3.2],
        [8, 0.2],
      ]) {
        const schedule = plan(textLines, 3, total);
        expect(schedule.perLine).toBeLessThan(0.5);
        for (let k = 1; k <= schedule.steps; k += 1) {
          const at = schedule.stepAt(k);
          expect(offsetOf(textLines, 3, at, total)).toBeCloseTo((k - 1) * LH, 9);
          const midway = offsetOf(textLines, 3, at + schedule.perLine / 4, total);
          expect(midway).toBeGreaterThan((k - 1) * LH);
          expect(midway).toBeLessThan(k * LH);
          // 滑完之后停在整行上，直到下一行移出
          for (const share of [0.5, 0.75, 0.999]) {
            expect(offsetOf(textLines, 3, at + schedule.perLine * share, total)).toBeCloseTo(
              k * LH,
              9
            );
          }
        }
      }
    });

    it('moves smoothly: no jump from one millisecond to the next', () => {
      let previous = 0;
      for (const seconds of times(0, EXAMPLE.total, 8760)) {
        const offset = exampleAt(seconds);
        expect(offset - previous, `at ${seconds} s`).toBeLessThan(0.5);
        previous = offset;
      }
    });
  });

  describe('stepOnly (reduced motion)', () => {
    it('jumps a whole line at a time: the position is never between two lines', () => {
      const problems: string[] = [];
      for (const { textLines, boxLines, total, reveal } of GRID) {
        for (const seconds of times(0, total + 0.5, 1500)) {
          const offset = offsetOf(textLines, boxLines, seconds, total, reveal, true);
          if (!isWholeLines(offset)) {
            problems.push(
              `${describeCase({ textLines, boxLines, total, reveal })} at ${seconds} s: ${offset}`
            );
          }
        }
      }
      expect(problems.slice(0, 5)).toEqual([]);
    });

    it('jumps at the moment the slide would start', () => {
      for (const { textLines, boxLines, total, reveal } of GRID) {
        const schedule = plan(textLines, boxLines, total, reveal);
        for (let k = 1; k <= schedule.steps; k += 1) {
          const at = schedule.stepAt(k);
          const before = offsetOf(textLines, boxLines, at - 1e-6, total, reveal, true);
          const after = offsetOf(textLines, boxLines, at + 1e-6, total, reveal, true);
          expect(before).toBeLessThan(k * LH - 1e-9);
          expect(after).toBeGreaterThanOrEqual(k * LH - 1e-9);
        }
      }
    });

    it('is where the slide ends up, at every moment the slide is at rest', () => {
      // 取样避开整百分之一秒：2.79 秒那样的时刻正好是一次上移的起点
      for (const seconds of times(0.0037, 9.0037, 900)) {
        const sliding = exampleAt(seconds);
        if (isWholeLines(sliding)) expect(exampleAt(seconds, true)).toBeCloseTo(sliding, 9);
        else expect(exampleAt(seconds, true)).toBeGreaterThan(sliding);
      }
    });
  });

  describe('very short display times', () => {
    it.each([0.05, 0.2, 1, 1e-6])('shows all of an 8-line text in %s s', (total) => {
      const schedule = plan(8, 3, total);
      // 开头的停顿是显示时间的四分之一
      expect(offsetOf(8, 3, total / 4, total)).toBe(0);
      expect(offsetOf(8, 3, total / 4 + schedule.perLine * 1.5, total)).toBeCloseTo(LH, 9);
      // 最后一次上移在显示时间结束之前滑完，最后三行各有一份时间
      const lastMove = schedule.stepAt(5);
      expect(offsetOf(8, 3, lastMove + schedule.perLine / 2, total)).toBeCloseTo(5 * LH, 9);
      expect(total - lastMove).toBeCloseTo(3 * schedule.perLine, 9);
      expect(offsetOf(8, 3, total, total)).toBeCloseTo(5 * LH, 9);
    });
  });

  describe('a one-line box', () => {
    it('shows twelve text lines one at a time, each for one share of the time', () => {
      const total = 8.76;
      const schedule = plan(12, 1, total);
      expect(schedule.steps).toBe(11);
      for (let k = 1; k <= 11; k += 1) {
        const at = schedule.stepAt(k);
        // 第 k 行自己在面板里：从上一行滑完到它开始移出
        expect(offsetOf(12, 1, at - 0.001, total)).toBeCloseTo((k - 1) * LH, 9);
        expect(offsetOf(12, 1, at + SLIDE, total)).toBeCloseTo(k * LH, 9);
      }
      expect(offsetOf(12, 1, total, total)).toBeCloseTo(11 * LH, 9);
      // 最后一行留一份时间
      expect(total - schedule.stepAt(11)).toBeCloseTo(schedule.perLine, 9);
    });
  });

  describe('sizes that are not whole lines', () => {
    it('reads a content height rounded to whole pixels (as scrollHeight gives it) as whole lines', () => {
      for (let textLines = 4; textLines <= 30; textLines += 1) {
        const measured = Math.round(textLines * LH);
        for (const stepOnly of [false, true]) {
          expect(
            radioFollowOffset(measured, 3 * LH, LH, 1000, 8.76, 0, stepOnly),
            `${textLines} lines measured as ${measured} px`
          ).toBeCloseTo((textLines - 3) * LH, 9);
        }
      }
    });

    it.each([0.05, 0.3, 0.49])(
      'does not move for content only %s of a line taller than the box',
      (extra) => {
        for (const seconds of [0, 2, 8.76, 100]) {
          expect(radioFollowOffset((3 + extra) * LH, 3 * LH, LH, seconds, 8.76)).toBe(0);
        }
      }
    );

    it.each([0.51, 0.7, 0.95])(
      'moves one whole line, never a part of one, for content %s of a line taller than the box',
      (extra) => {
        expect(radioFollowOffset((3 + extra) * LH, 3 * LH, LH, 100, 8.76)).toBeCloseTo(LH, 9);
        for (const seconds of times(0, 9, 900)) {
          const offset = radioFollowOffset((3 + extra) * LH, 3 * LH, LH, seconds, 8.76, 0, true);
          expect(offset === 0 || Math.abs(offset - LH) < 1e-9, `at ${seconds} s: ${offset}`).toBe(
            true
          );
        }
      }
    );

    // 偏差（RadioComms 现在走不到这里：它传进来的面板高总是“行数上限 × 行高”）。约定是“正文
    // 逐行上移，在这句的显示时间里全部给出”；面板高不是整行数时按四舍五入算行数，2.5–2.99 行的
    // 面板当成 3 行，最后停下的位置少了一行，最后一行文字有一部分一直在面板下沿之外。
    it.fails.each([2.5, 2.75, 2.9])(
      'shows the last text line in full at the end in a box %s lines high',
      (boxLines) => {
        const contentHeight = 8 * LH;
        const boxHeight = boxLines * LH;
        const final = radioFollowOffset(contentHeight, boxHeight, LH, 100, 8.76);
        expect(contentHeight - final).toBeLessThanOrEqual(boxHeight + 0.5);
      }
    );

    it.each([0.05, 0.3, 0.49, 1])(
      'never moves the last text line above the top of a box %s lines high',
      (boxLines) => {
        // 再小的面板也当成一行：最多上移（正文行数 − 1）行，最后一行还在面板上沿之下
        for (const seconds of [1, 5, 8.76, 100]) {
          for (const stepOnly of [false, true]) {
            expect(
              radioFollowOffset(8 * LH, boxLines * LH, LH, seconds, 8.76, 0, stepOnly)
            ).toBeLessThanOrEqual(7 * LH + 1e-9);
          }
        }
        expect(radioFollowOffset(8 * LH, boxLines * LH, LH, 100, 8.76)).toBeCloseTo(7 * LH, 9);
      }
    );

    it('shows the last text line in full at the end in a box a little over a whole number of lines', () => {
      for (const boxLines of [1.2, 2.4, 3.05, 3.49]) {
        const final = radioFollowOffset(8 * LH, boxLines * LH, LH, 100, 8.76);
        expect(8 * LH - final).toBeLessThanOrEqual(boxLines * LH + 0.5);
        expect(isWholeLines(final)).toBe(true);
      }
    });
  });

  describe('sizes and times that make no sense', () => {
    /** 一组正常的参数：8 行、面板 3 行，这句已显示 5.4 秒，此时已上移 4 行 */
    const GOOD = [8 * LH, 3 * LH, LH, 5.4, 8.76, 2.26] as const;
    const withArgument = (index: number, value: number): number[] => {
      const args: number[] = [...GOOD];
      args[index] = value;
      return args;
    };
    const NAMES = ['content height', 'box height', 'line height', 'elapsed', 'display time'];

    it('moves four lines for the sound arguments these cases start from', () => {
      expect(guarded(GOOD)).toBeCloseTo(4 * LH, 9);
    });

    it.each(
      [0, 1, 2, 3, 4].flatMap((index) =>
        [0, -GOOD[index], NaN, -Infinity].map((value) => [NAMES[index], value, index] as const)
      )
    )('is 0 when the %s is %s', (_name, value, index) => {
      expect(guarded(withArgument(index, value))).toBe(0);
      expect(guarded([...withArgument(index, value), true])).toBe(0);
    });

    it.each([
      ['box height', 1],
      ['line height', 2],
      ['display time', 4],
    ] as const)('is 0 when the %s is infinite', (_name, index) => {
      expect(guarded(withArgument(index, Infinity))).toBe(0);
      expect(guarded([...withArgument(index, Infinity), true])).toBe(0);
    });

    it('is 0 for as long as the typing never ends (infinite typing time)', () => {
      for (const seconds of [0.5, 5, 8.76, 1e9]) {
        expect(guarded([8 * LH, 3 * LH, LH, seconds, 8.76, Infinity])).toBe(0);
      }
    });

    it.each([NaN, -1, -Infinity])(
      'treats a typing time of %s as no typing phase at all',
      (reveal) => {
        for (const seconds of times(0, 9, 90)) {
          expect(guarded([8 * LH, 3 * LH, LH, seconds, 8.76, reveal])).toBe(
            guarded([8 * LH, 3 * LH, LH, seconds, 8.76, 0])
          );
        }
      }
    );

    it('is the final position, no further, when the elapsed time is infinite', () => {
      expect(guarded(withArgument(3, Infinity))).toBeCloseTo(5 * LH, 9);
      expect(guarded([...withArgument(3, Infinity), true])).toBeCloseTo(5 * LH, 9);
    });

    it('is 0 for an infinite content height before the start hold is over', () => {
      expect(guarded([Infinity, 3 * LH, LH, 0.5, 8.76, 0])).toBe(0);
    });

    // 偏差（RadioComms 传不进这样的值：scrollHeight 总是有限的）。封面要求是“非正、非有限的
    // 大小和时间 ⇒ 0（NaN 和 Infinity 也算）”，项目约定是“位置要防 NaN / Infinity”。
    // 内容高是 Infinity、开头的停顿一过：循环永远走不完，函数不返回（这里靠看门狗才停得下来）。
    it.fails('returns 0 for an infinite content height once the start hold is over', () => {
      expect(guarded([Infinity, 3 * LH, LH, 5, 8.76, 2.26])).toBe(0);
    });

    // 偏差（同上，RadioComms 传不进这样的值）：下面三种组合返回 NaN，而不是 0 或某个有限的位置。
    it.fails.each([
      ['content height and line height', [Infinity, 3 * LH, Infinity, 5, 8.76, 2.26]],
      ['elapsed time and display time', [8 * LH, 3 * LH, LH, Infinity, Infinity, 2.26]],
      ['elapsed time and typing time', [8 * LH, 3 * LH, LH, Infinity, 8.76, Infinity]],
    ] as const)('returns a finite position when %s are both infinite', (_name, args) => {
      expect(Number.isFinite(guarded(args))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 面板（测量值打桩）
// ---------------------------------------------------------------------------

type Density = 'desktop' | 'touch-landscape' | 'touch-portrait';
type Camera = 'third-person' | 'first-person';

describe('RadioComms follows long lines in the compact portrait-phone box', () => {
  /** 95 字，桩里每行 12 字 → 8 行；中文 9 字 → 1 行 */
  const LONG: LocalizedText = {
    en: 'The data core is on the seabed. But ORACLE slipped part of itself into the Thunder Canyon grid.',
    zh: '数据核心沉入海底。',
  };
  /** 两种语言都放不下：英文 8 行，中文 50 字 → 5 行 */
  const BOTH_LONG: LocalizedText = {
    en: LONG.en,
    zh: '数据核心已经沉入海底，但神谕把自己的一部分藏进了雷霆峡谷的电网，我们还得再去一趟，把它彻底清除干净。',
  };
  /** 放得下：2 行 */
  const SHORT: LocalizedText = { en: 'Copy that, Falcon.', zh: '收到，猎鹰。' };
  /** 另一句放不下的：76 字 → 7 行 */
  const OTHER_LONG: LocalizedText = {
    en: 'Falcon, new contacts bearing zero nine zero, low and fast. Break right, now!',
    zh: '猎鹰，新目标。',
  };

  let hud: HUD;
  let radio: RadioComms;
  /** 桩：样式给的行数上限和行高、正文一行放几个字、是否减少动态效果 */
  let boxLines: number;
  let lineHeightPx: number;
  let charsPerLine: number;
  let reduceMotion: boolean;
  /** 当前这句已经显示的时间（由 advance 累加） */
  let elapsed: number;
  let lineCount = 0;
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  const stubTextLines = (text: string): number =>
    text === '' ? 0 : Math.ceil(Array.from(text).length / charsPerLine);
  /** 浏览器量出来的正文高度：整行数 × 行高（16.9px），取整到像素 */
  const stubContentHeight = (text: string): number =>
    Math.round(stubTextLines(text) * lineHeightPx);

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-hud-camera');
    boxLines = 3;
    lineHeightPx = LH;
    charsPerLine = 12;
    reduceMotion = false;
    elapsed = 0;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMatchMedia = window.matchMedia;

    // jsdom 不排版：正文的高度按它当时的文字算（每行 charsPerLine 个字）；
    // 面板还藏着（display: none）的时候和浏览器里一样量不出高度
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement): number {
        if (!this.classList.contains('rc-text')) return 0;
        const root = this.closest<HTMLElement>('#radio-comms');
        return root === null || root.style.display === 'none'
          ? 0
          : stubContentHeight(this.textContent ?? '');
      },
    });
    // jsdom 的 getComputedStyle 不算媒体查询、不换算行高：正文的行高和行数上限由桩给
    const realGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      if (!(element instanceof HTMLElement) || !element.classList.contains('rc-text')) {
        return realGetComputedStyle(element, pseudo);
      }
      const values: Record<string, string> = {
        'line-height': `${lineHeightPx}px`,
        '-webkit-line-clamp': String(boxLines),
      };
      return {
        lineHeight: values['line-height'],
        webkitLineClamp: values['-webkit-line-clamp'],
        getPropertyValue: (name: string): string => values[name] ?? '',
      } as unknown as CSSStyleDeclaration;
    });
    window.matchMedia = ((query: string): MediaQueryList =>
      ({
        matches: reduceMotion && query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia;

    hud = new HUD();
    radio = new RadioComms();
  });

  afterEach(() => {
    radio.dispose();
    hud.dispose();
    resetLocale();
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    window.matchMedia = originalMatchMedia;
    setWindowSize(originalInnerWidth, originalInnerHeight);
    document.documentElement.removeAttribute('data-hud-camera');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function setWindowSize(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  }

  /** 页面：布局密度与视角由真实的 HUD 标记（#hud[data-layout-density]、<html data-hud-camera>） */
  function scene(
    density: Density = 'touch-portrait',
    camera: Camera | null = 'third-person',
    width = 360,
    height = 640
  ): void {
    setWindowSize(width, height);
    hud.setLayoutDensity(density);
    hud.init();
    hud.setLayoutDensity(density);
    if (camera) hud.setCameraMode(camera);
  }

  function radioLine(text: LocalizedText): RadioLine {
    lineCount += 1;
    return { id: `follow-test-${lineCount}`, trigger: 'wave-start', speaker: 'hq', text };
  }

  /** 排进一句并开始计时 */
  function show(text: LocalizedText, priority: 'normal' | 'high' = 'normal'): RadioLine {
    const line = radioLine(text);
    radio.enqueue(line, { priority });
    elapsed = 0;
    return line;
  }

  function advance(seconds: number, dt = 0.01): void {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i += 1) {
      radio.update(dt);
      elapsed += dt;
    }
  }

  function panel(): HTMLElement {
    const root = document.getElementById('radio-comms');
    expect(root, 'expected the radio panel in the document').not.toBeNull();
    return root as HTMLElement;
  }
  const phase = (): string | null => panel().getAttribute('data-phase');
  const panelShown = (): boolean => panel().style.display !== 'none';
  function textBox(): HTMLElement {
    const box = panel().querySelector<HTMLElement>('.rc-text');
    expect(box, 'expected .rc-text').not.toBeNull();
    return box as HTMLElement;
  }
  /** .rc-text 里放文字的那一层 */
  function textLayer(): HTMLElement {
    const layer = textBox().firstElementChild;
    expect(layer, 'expected the text layer inside .rc-text').not.toBeNull();
    return layer as HTMLElement;
  }
  const inlineStyle = (element: HTMLElement): string =>
    (element.getAttribute('style') ?? '').trim();

  /** 文字层上移了多少像素（没有 transform = 0） */
  function movedUp(): number {
    const transform = textLayer().style.transform;
    if (transform === '') return 0;
    const match = transform.match(/^translateY\((-?\d+(?:\.\d+)?)px\)$/);
    expect(match, `transform: ${transform}`).not.toBeNull();
    return -Number((match as RegExpMatchArray)[1]);
  }

  /** 没有跟读：两层都没有行内样式 */
  function expectUntouched(where = ''): void {
    expect(inlineStyle(textBox()), `.rc-text ${where}`).toBe('');
    expect(inlineStyle(textLayer()), `text layer ${where}`).toBe('');
  }

  /** 正在跟读：裁切框与行数上限同高、省略号关掉，文字层不是行内盒（行内盒不吃 transform） */
  function expectFollowing(lines: number = boxLines): void {
    const box = textBox();
    expect(parseFloat(box.style.maxHeight)).toBeCloseTo(lines * LH, 2);
    expect(box.style.maxHeight.endsWith('px')).toBe(true);
    const clampOff =
      ['block', 'flow-root'].includes(box.style.display) ||
      ['none', 'unset', 'initial'].includes(box.style.getPropertyValue('-webkit-line-clamp'));
    expect(clampOff, `the line clamp should be off: "${inlineStyle(box)}"`).toBe(true);
    expect(['block', 'inline-block', 'flow-root']).toContain(textLayer().style.display);
  }

  /** radioFollowOffset 对这句此刻给的位置：RadioComms 传的是量到的高度、逐字 + 停留的时间 */
  function expectedOffset(
    text: string,
    seconds: number,
    times = radioDisplayTimes(text, reduceMotion)
  ): number {
    return radioFollowOffset(
      stubContentHeight(text),
      boxLines * LH,
      LH,
      seconds,
      times.total,
      times.reveal,
      reduceMotion
    );
  }

  /**
   * 面板上的位置与 radioFollowOffset 此刻给的一致（写样式时取两位小数；跳变的时刻两边都算对）。
   * slack：这里记的时间与面板自己的时间最多差多少秒（一句在某次 update 的中途开始时差不到一步）。
   */
  function expectAt(
    text: string,
    times = radioDisplayTimes(text, reduceMotion),
    slack = 1e-6
  ): void {
    const low = expectedOffset(text, elapsed - slack, times);
    const high = expectedOffset(text, elapsed + slack, times);
    const actual = movedUp();
    expect(actual, `at ${elapsed.toFixed(3)} s`).toBeGreaterThanOrEqual(low - 0.011);
    expect(actual, `at ${elapsed.toFixed(3)} s`).toBeLessThanOrEqual(high + 0.011);
  }

  /** 等 window 的 resize 处理跑完（RadioComms 把重新测量推迟到 HUD 更新布局密度之后） */
  async function resizeTo(width: number, height: number, event = 'resize'): Promise<void> {
    setWindowSize(width, height);
    window.dispatchEvent(new Event(event));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('the stubbed measurements say what the cases below assume', () => {
    expect(stubTextLines(LONG.en)).toBe(8);
    expect(stubContentHeight(LONG.en)).toBe(135);
    expect(stubTextLines(LONG.zh)).toBe(1);
    expect(stubTextLines(BOTH_LONG.zh)).toBe(5);
    expect(stubTextLines(SHORT.en)).toBe(2);
    expect(stubTextLines(OTHER_LONG.en)).toBe(7);
    const { reveal, total } = radioDisplayTimes(LONG.en);
    expect(reveal).toBeCloseTo(2.26, 2);
    expect(total).toBeCloseTo(8.76, 2);
  });

  describe('on a portrait phone in the chase camera', () => {
    beforeEach(() => {
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it('moves a line that does not fit exactly as radioFollowOffset says, until the line has gone', () => {
      show(LONG);
      const seen = new Set<number>();
      let previous = 0;
      while (panelShown() && elapsed < 30) {
        advance(1 / 120, 1 / 120);
        if (!panelShown()) break;
        expectFollowing();
        expectAt(LONG.en);
        const offset = movedUp();
        // 只增不减
        expect(offset, `at ${elapsed.toFixed(3)} s`).toBeGreaterThanOrEqual(previous);
        previous = offset;
        seen.add(Math.round(offset * 100) / 100);
      }
      // 真的动了：经过了五个整行的位置，中间有滑动的位置
      for (let lines = 1; lines <= 5; lines += 1) {
        expect(seen).toContain(Math.round(lines * LH * 100) / 100);
      }
      expect(seen.size).toBeGreaterThan(20);
      expect(previous).toBeCloseTo(84.5, 2);
    });

    it('does not move while the text is being typed out', () => {
      show(LONG);
      expect(phase()).toBe('reveal');
      expect(movedUp()).toBe(0);
      while (phase() === 'reveal') {
        advance(0.01);
        if (phase() === 'reveal') expect(movedUp(), `at ${elapsed.toFixed(2)} s`).toBe(0);
      }
      expect(elapsed).toBeCloseTo(2.27, 1);
    });

    it('does not disturb the text being typed out when it measures the whole body', () => {
      show(LONG);
      // 刚出现：只打出了第一个字，量整段正文不能把全文留在面板上
      expect(textLayer().textContent).toBe('T');
      expect(textBox().textContent).toBe('T');
      advance(0.5);
      const typed = textLayer().textContent ?? '';
      expect(typed.length).toBeGreaterThan(1);
      expect(typed.length).toBeLessThan(LONG.en.length);
      expect(LONG.en.startsWith(typed)).toBe(true);
      advance(2);
      expect(textLayer().textContent).toBe(LONG.en);
    });

    it('rests on whole lines and ends (text lines − box lines) × line height up', () => {
      show(LONG);
      const { stepAt } = plan(
        8,
        3,
        radioDisplayTimes(LONG.en).total,
        radioDisplayTimes(LONG.en).reveal
      );
      for (let k = 1; k <= 5; k += 1) {
        // 第 k 次上移滑完之后
        advance(stepAt(k) + SLIDE + 0.05 - elapsed);
        expect(movedUp()).toBeCloseTo(k * LH, 2);
        expect(textLayer().style.transform).toBe(
          `translateY(-${Math.round(k * LH * 100) / 100}px)`
        );
      }
      advance(8.7 - elapsed);
      expect(phase()).toBe('hold');
      expect(movedUp()).toBeCloseTo((8 - 3) * LH, 2);
    });

    it('holds the last lines through the fade-out, until the line has gone', () => {
      show(LONG);
      advance(8.6);
      expect(phase()).toBe('hold');
      while (phase() !== 'out') advance(0.01);
      // 淡出的 0.26 秒里位置不变、裁切框还在
      for (let i = 0; i < 20 && phase() === 'out'; i += 1) {
        expectFollowing();
        expect(movedUp()).toBeCloseTo(84.5, 2);
        advance(0.01);
      }
    });

    it('uses the line limit the stylesheet gives the box', () => {
      boxLines = 5;
      show(LONG);
      expectFollowing(5);
      advance(8.7);
      expect(movedUp()).toBeCloseTo((8 - 5) * LH, 2);
      expectAt(LONG.en);
    });

    it('uses the line height the stylesheet gives the text', () => {
      lineHeightPx = 20;
      show(LONG);
      expect(parseFloat(textBox().style.maxHeight)).toBeCloseTo(3 * 20, 2);
      advance(8.7);
      expect(movedUp()).toBeCloseTo((8 - 3) * 20, 2);
    });

    it('follows a body just one line longer than the box', () => {
      // 37 个字 → 4 行，面板 3 行
      const text = 'Hold the line until the tankers clear';
      expect(stubTextLines(text)).toBe(4);
      show({ en: text, zh: text });
      expectFollowing();
      advance(radioDisplayTimes(text).total - 0.05);
      expect(movedUp()).toBeCloseTo(LH, 2);
    });
  });

  describe('gates', () => {
    it('follows when the page carries no camera marker yet (the compact box is the default)', () => {
      scene('touch-portrait', null, 360, 640);
      expect(document.documentElement.hasAttribute('data-hud-camera')).toBe(false);
      show(LONG);
      expectFollowing();
      advance(8.7);
      expect(movedUp()).toBeCloseTo(84.5, 2);
    });

    it.each([320, 360, 430, 699])('follows on a portrait phone %i px wide', (width) => {
      scene('touch-portrait', 'third-person', width, 800);
      show(LONG);
      expectFollowing();
      advance(8.7);
      expect(movedUp()).toBeCloseTo(84.5, 2);
    });

    it.each([
      ['a portrait viewport 700 px wide', 'touch-portrait', 'third-person', 700, 1000],
      ['a tablet held upright', 'touch-portrait', 'third-person', 768, 1024],
      ['a tablet held upright, first person', 'touch-portrait', 'first-person', 820, 1180],
      ['a tablet in landscape', 'touch-landscape', 'third-person', 1024, 768],
      ['a phone in landscape', 'touch-landscape', 'third-person', 800, 360],
      [
        'a small phone in landscape (under 700 px wide)',
        'touch-landscape',
        'third-person',
        640,
        360,
      ],
      ['a phone in landscape, first person', 'touch-landscape', 'first-person', 844, 390],
      ['the first-person panel on a portrait phone', 'touch-portrait', 'first-person', 360, 640],
      [
        'the first-person panel on a tall portrait phone',
        'touch-portrait',
        'first-person',
        430,
        932,
      ],
      ['a desktop window', 'desktop', 'third-person', 1280, 720],
      ['a narrow desktop window', 'desktop', 'third-person', 500, 800],
    ] as const)('never follows on %s', (_name, density, camera, width, height) => {
      scene(density, camera, width, height);
      show(LONG);
      expectUntouched('when the line appears');
      while (panelShown() && elapsed < 30) {
        advance(0.02, 0.02);
        if (panelShown()) expectUntouched(`at ${elapsed.toFixed(2)} s`);
      }
      // 这句照常播完了
      expect(elapsed).toBeGreaterThan(8.7);
      expect(elapsed).toBeLessThan(9.3);
    });
  });

  describe('a line that fits', () => {
    it.each([
      ['a two-line body', 'Copy that, Falcon.'],
      ['a body of exactly as many lines as the box', 'Hold the line until the tankers go.'],
    ])('gets no inline style at any time (%s)', (_name, text) => {
      scene('touch-portrait', 'third-person', 360, 640);
      expect(stubTextLines(text)).toBeLessThanOrEqual(3);
      show({ en: text, zh: text });
      expectUntouched('when the line appears');
      expect(textLayer().textContent).toBe(text.slice(0, 1));
      while (panelShown() && elapsed < 30) {
        advance(0.01);
        if (panelShown()) expectUntouched(`at ${elapsed.toFixed(2)} s`);
      }
      expectUntouched('after the line');
    });
  });

  describe('when the line ends', () => {
    beforeEach(() => {
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it('removes everything the follow added', () => {
      show(LONG);
      advance(8.7);
      expectFollowing();
      expect(movedUp()).toBeCloseTo(84.5, 2);
      while (radio.isBusy()) advance(0.01);
      expect(panelShown()).toBe(false);
      expectUntouched('after the line');
    });

    it('removes everything on clear(), wherever the text was', () => {
      show(LONG);
      advance(4);
      expect(movedUp()).toBeGreaterThan(0);
      radio.clear();
      expectUntouched('after clear()');
      // 之后一句放得下的台词从头显示，没有残留
      show(SHORT);
      advance(1.5);
      expectUntouched('on the next line');
      expect(textLayer().textContent).toBe(SHORT.en);
    });

    it('can be disposed in the middle of a followed line', () => {
      show(LONG);
      advance(4);
      expect(() => radio.dispose()).not.toThrow();
      expect(document.getElementById('radio-comms')).toBeNull();
      expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    });
  });

  describe('a new line replacing a followed line', () => {
    beforeEach(() => {
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it('shows an urgent line that fits from the top, with nothing left over', () => {
      show(LONG);
      advance(5.4);
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
      show(SHORT, 'high');
      expectUntouched('on the urgent line');
      advance(1.5);
      expectUntouched('on the urgent line');
      expect(textLayer().textContent).toBe(SHORT.en);
    });

    it('starts an urgent long line from the top, on its own timing', () => {
      show(LONG);
      advance(5.4);
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
      show(OTHER_LONG, 'high');
      expectFollowing();
      expect(movedUp()).toBe(0);
      const own = radioDisplayTimes(OTHER_LONG.en);
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.01);
        if (phase() !== 'out') expectAt(OTHER_LONG.en, own);
      }
      expect(movedUp()).toBeCloseTo((7 - 3) * LH, 2);
    });

    it('replays the interrupted line from the top', () => {
      const first = show(LONG);
      const shown: RadioLine[] = [];
      radio.onLineShown = (line) => {
        shown.push(line);
        elapsed = 0;
      };
      advance(3.5);
      expect(movedUp()).toBeCloseTo(2 * LH, 2);
      show(SHORT, 'high');
      // 急报播完，被打断的那句重播
      while (shown[shown.length - 1] !== first && radio.isBusy()) advance(0.01);
      expect(shown[shown.length - 1]).toBe(first);
      expectFollowing();
      expect(movedUp()).toBe(0);
      expect(textLayer().textContent?.length ?? 0).toBeLessThan(5);
      while (phase() !== 'out' && radio.isBusy()) {
        advance(0.01);
        if (phase() !== 'out') expectAt(LONG.en, radioDisplayTimes(LONG.en), 0.011);
      }
      expect(movedUp()).toBeCloseTo(84.5, 2);
    });

    it('starts the next queued line from the top', () => {
      show(LONG);
      const second = radioLine(OTHER_LONG);
      radio.enqueue(second);
      let started = false;
      radio.onLineShown = (line) => {
        if (line === second) {
          started = true;
          elapsed = 0;
        }
      };
      while (!started && radio.isBusy()) advance(0.01);
      expect(started).toBe(true);
      expectFollowing();
      expect(movedUp()).toBe(0);
      advance(radioDisplayTimes(OTHER_LONG.en).total - 0.05 - elapsed);
      expect(movedUp()).toBeCloseTo((7 - 3) * LH, 2);
    });

    it('leaves nothing behind when a line that fits follows a followed line', () => {
      show(LONG);
      const second = radioLine(SHORT);
      radio.enqueue(second);
      let started = false;
      radio.onLineShown = (line) => {
        started = started || line === second;
      };
      while (!started && radio.isBusy()) advance(0.01);
      expect(started).toBe(true);
      expectUntouched('on the next line');
      advance(1.5);
      expectUntouched('on the next line');
    });
  });

  describe('camera toggle in the middle of a line', () => {
    it('drops the follow on the next update when the camera goes to first person', () => {
      scene('touch-portrait', 'third-person', 360, 640);
      show(LONG);
      advance(3.5);
      expect(movedUp()).toBeCloseTo(2 * LH, 2);
      hud.setCameraMode('first-person');
      radio.update(0);
      expectUntouched('in first person');
      expect(textLayer().textContent).toBe(LONG.en);
      while (panelShown() && elapsed < 30) {
        advance(0.02, 0.02);
        if (panelShown()) expectUntouched(`in first person at ${elapsed.toFixed(2)} s`);
      }
    });

    it('drops the follow even when the camera changes during the fade-out', () => {
      scene('touch-portrait', 'third-person', 360, 640);
      show(LONG);
      advance(8.6);
      while (phase() !== 'out') advance(0.01);
      expect(movedUp()).toBeCloseTo(84.5, 2);
      hud.setCameraMode('first-person');
      radio.update(0);
      expect(phase()).toBe('out');
      expectUntouched('in first person');
    });

    it('picks the follow up where the line has got to when the camera comes back', () => {
      scene('touch-portrait', 'third-person', 360, 640);
      show(LONG);
      advance(3.5);
      hud.setCameraMode('first-person');
      advance(1.9);
      expectUntouched('in first person');
      hud.setCameraMode('third-person');
      radio.update(0);
      expectFollowing();
      // 5.4 秒：已经该上移四行（不是切走之前的两行，也不是从头开始）
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
      expectAt(LONG.en);
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.01);
        if (phase() !== 'out') expectAt(LONG.en);
      }
      expect(movedUp()).toBeCloseTo(84.5, 2);
      while (radio.isBusy()) advance(0.01);
      expectUntouched('after the line');
    });

    it('starts following when the camera leaves first person in the middle of a line', () => {
      scene('touch-portrait', 'first-person', 360, 640);
      show(LONG);
      advance(1);
      expectUntouched('in first person');
      const typed = textLayer().textContent;
      hud.setCameraMode('third-person');
      radio.update(0);
      expectFollowing();
      // 还在逐字显示：不动，已经打出的字不变
      expect(movedUp()).toBe(0);
      expect(textLayer().textContent).toBe(typed);
      advance(3.4);
      expectAt(LONG.en);
      expect(movedUp()).toBeCloseTo(3 * LH, 2);
    });
  });

  describe('language switch in the middle of a line', () => {
    beforeEach(() => {
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it('drops the follow at once when the line fits in the new language', () => {
      show(LONG);
      advance(5.4);
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
      setLocale('zh-CN');
      expectUntouched('after the switch');
      expect(textLayer().textContent).toBe(LONG.zh);
      while (panelShown() && elapsed < 30) {
        advance(0.02, 0.02);
        if (panelShown()) expectUntouched(`at ${elapsed.toFixed(2)} s`);
      }
    });

    it('starts following when the line no longer fits in the new language', () => {
      setLocale('zh-CN');
      show(LONG);
      advance(1);
      expect(phase()).toBe('hold');
      expectUntouched('in Chinese');
      setLocale('en');
      expectFollowing();
      expect(textLayer().textContent).toBe(LONG.en);
      let previous = movedUp();
      expect(previous).toBeLessThanOrEqual(5 * LH + 0.011);
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.01);
        if (phase() === 'out') break;
        expect(movedUp()).toBeGreaterThanOrEqual(previous);
        previous = movedUp();
      }
      // 这句消失之前全部给出
      expect(previous).toBeCloseTo(84.5, 2);
      while (radio.isBusy()) advance(0.01);
      expectUntouched('after the line');
    });

    it('takes the position from the new text, not the one the old text had reached', () => {
      show(BOTH_LONG);
      advance(3.5);
      // 英文 8 行：3.5 秒时已上移两行
      expect(movedUp()).toBeCloseTo(2 * LH, 2);
      setLocale('zh-CN');
      expectFollowing();
      expect(textLayer().textContent).toBe(BOTH_LONG.zh);
      // 中文 5 行：显示时间不变（逐字已经结束，停留取两种语言里较长的），3.5 秒时只该上移一行
      const times = { ...radioDisplayTimes(BOTH_LONG.en) };
      expect(expectedOffset(BOTH_LONG.zh, elapsed, times)).toBeCloseTo(LH, 9);
      expect(movedUp()).toBeCloseTo(LH, 2);
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.01);
        if (phase() === 'out') break;
        expectAt(BOTH_LONG.zh, times);
        // 最后一行不会被推到面板上沿之外
        expect(movedUp()).toBeLessThanOrEqual((5 - 3) * LH + 0.011);
      }
      expect(movedUp()).toBeCloseTo((5 - 3) * LH, 2);
    });

    it('keeps the text where it is typed out when the language changes during the typing', () => {
      show(BOTH_LONG);
      advance(0.5);
      setLocale('zh-CN');
      expectFollowing();
      expect(movedUp()).toBe(0);
      const typed = textLayer().textContent ?? '';
      expect(typed.length).toBeGreaterThan(0);
      expect(typed.length).toBeLessThan(Array.from(BOTH_LONG.zh).length);
      expect(BOTH_LONG.zh.startsWith(typed)).toBe(true);
      while (phase() === 'reveal') {
        advance(0.01);
        if (phase() === 'reveal') expect(movedUp()).toBe(0);
      }
      while (phase() !== 'out' && elapsed < 30) advance(0.01);
      expect(movedUp()).toBeCloseTo((5 - 3) * LH, 2);
    });
  });

  describe('resize in the middle of a line', () => {
    beforeEach(() => {
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it.each(['resize', 'orientationchange'])(
      'drops the follow when the phone is turned to landscape (%s event)',
      async (event) => {
        show(LONG);
        advance(5.4);
        expect(movedUp()).toBeCloseTo(4 * LH, 2);
        hud.setLayoutDensity('touch-landscape');
        await resizeTo(640, 360, event);
        expectUntouched('in landscape');
        expect(panel().getAttribute('data-density')).toBe('touch-landscape');
        expect(textLayer().textContent).toBe(LONG.en);
        advance(1);
        expectUntouched('in landscape');
      }
    );

    it('drops the follow when the viewport becomes 700 px wide or more', async () => {
      show(LONG);
      advance(5);
      await resizeTo(720, 1000);
      expectUntouched('at 720 px wide');
      advance(1);
      expectUntouched('at 720 px wide');
    });

    it('re-measures for a taller box: new height, and the position that box calls for', async () => {
      show(LONG);
      advance(5.4);
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
      // 视口变高：行数上限 3 → 6
      boxLines = 6;
      await resizeTo(360, 800);
      expectFollowing(6);
      // 8 行在 6 行的面板里只上移两行
      expect(movedUp()).toBeCloseTo(2 * LH, 2);
      expectAt(LONG.en);
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.01);
        if (phase() !== 'out') expect(movedUp()).toBeLessThanOrEqual(2 * LH + 0.011);
      }
    });

    it('re-measures for a shorter box', async () => {
      show(LONG);
      advance(3.5);
      expect(movedUp()).toBeCloseTo(2 * LH, 2);
      boxLines = 1;
      await resizeTo(360, 580);
      expectFollowing(1);
      expectAt(LONG.en);
      advance(8.7 - elapsed);
      expect(movedUp()).toBeCloseTo((8 - 1) * LH, 2);
    });

    it('drops the follow when the body fits the new box', async () => {
      show(LONG);
      advance(5);
      boxLines = 8;
      await resizeTo(430, 932);
      expectUntouched('in an 8-line box');
      advance(1);
      expectUntouched('in an 8-line box');
    });

    it('re-measures the body when the box gets wider and the text takes fewer lines', async () => {
      show(LONG);
      advance(5.4);
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
      // 一行放 24 个字：95 字 → 4 行
      charsPerLine = 24;
      await resizeTo(430, 640);
      expectFollowing();
      expect(stubTextLines(LONG.en)).toBe(4);
      expect(movedUp()).toBeCloseTo(LH, 2);
      expectAt(LONG.en);
      advance(8.7 - elapsed);
      expect(movedUp()).toBeCloseTo(LH, 2);
    });

    it('keeps the text typed so far when it re-measures during the typing', async () => {
      show(LONG);
      advance(1);
      const typed = textLayer().textContent;
      expect(typed?.length).toBeLessThan(LONG.en.length);
      boxLines = 5;
      await resizeTo(360, 740);
      expectFollowing(5);
      expect(textLayer().textContent).toBe(typed);
      expect(movedUp()).toBe(0);
    });

    it('does nothing when no line is showing', async () => {
      show(SHORT);
      while (radio.isBusy()) advance(0.01);
      await resizeTo(360, 800);
      expectUntouched('with the panel hidden');
      expect(panelShown()).toBe(false);
    });
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      reduceMotion = true;
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it('jumps whole lines instead of sliding', () => {
      show(LONG);
      // 减少动态效果时没有逐字阶段：全文立即显示，显示时间只有停留的 6.5 秒
      expect(phase()).toBe('hold');
      expect(textLayer().textContent).toBe(LONG.en);
      const seen = new Set<number>();
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.007, 0.007);
        if (phase() === 'out') break;
        expectFollowing();
        const offset = movedUp();
        expect(isWholeLines(offset), `at ${elapsed.toFixed(3)} s: ${offset}`).toBe(true);
        expectAt(LONG.en);
        seen.add(Math.round(offset / LH));
      }
      expect(Array.from(seen).sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(elapsed).toBeCloseTo(6.5, 1);
    });

    it('jumps the first line out after the start hold and one share of the 6.5 s', () => {
      show(LONG);
      const first = 0.8 + (6.5 - 0.8) / 8;
      advance(first - 0.02);
      expect(movedUp()).toBe(0);
      advance(0.04);
      expect(movedUp()).toBeCloseTo(LH, 2);
    });
  });

  describe('without reduced motion', () => {
    it('slides: the text is seen between two lines on the way', () => {
      scene('touch-portrait', 'third-person', 360, 640);
      show(LONG);
      let between = 0;
      while (phase() !== 'out' && elapsed < 30) {
        advance(0.007, 0.007);
        if (!isWholeLines(movedUp())) between += 1;
      }
      // 五次滑动，每次 0.25 秒
      expect(between * 0.007).toBeGreaterThan(5 * SLIDE * 0.8);
      expect(between * 0.007).toBeLessThan(5 * SLIDE * 1.1);
    });
  });

  describe('a voice that lengthens the display time', () => {
    beforeEach(() => {
      scene('touch-portrait', 'third-person', 360, 640);
    });

    it('never moves the text back, and still shows all of it before the line goes', () => {
      const line = show(LONG);
      advance(4.4);
      // 3.79 秒那次上移已经滑完：停在三行上
      expect(movedUp()).toBeCloseTo(3 * LH, 2);
      // 配音这时才开口，还要说 9 秒：显示时间拉长到 13.8 秒，照新的时间表第三行要到 5.7 秒才移出
      radio.holdForVoice(line, 9);
      let previous = movedUp();
      let lastHeld = 0;
      while (panelShown() && elapsed < 40) {
        advance(0.01);
        if (!panelShown()) break;
        expect(movedUp(), `at ${elapsed.toFixed(2)} s`).toBeGreaterThanOrEqual(previous);
        previous = movedUp();
        if (phase() === 'hold') lastHeld = elapsed;
        if (elapsed > 13.4 && phase() === 'hold') radio.releaseVoice(line);
      }
      expect(previous).toBeCloseTo(84.5, 2);
      expect(lastHeld).toBeGreaterThan(13.7);
    });

    it('stays on whole lines when the voice starts while the text is at rest', () => {
      const line = show(LONG);
      advance(4.4);
      expect(movedUp()).toBeCloseTo(3 * LH, 2);
      const { stepAt } = plan(8, 3, elapsed + 9 + 0.4, radioDisplayTimes(LONG.en).reveal);
      radio.holdForVoice(line, 9);
      // 新的时间表里第四行在 7.3 秒移出：在那之前一直停在三行上
      expect(stepAt(4)).toBeCloseTo(7.3, 1);
      for (const seconds of times(4.45, stepAt(4) - 0.05, 40)) {
        advance(seconds - elapsed, 0.005);
        expect(movedUp(), `at ${elapsed.toFixed(2)} s`).toBeCloseTo(3 * LH, 2);
      }
      advance(stepAt(4) + SLIDE + 0.05 - elapsed, 0.005);
      expect(movedUp()).toBeCloseTo(4 * LH, 2);
    });

    // 偏差。约定：“只走整行：停下来时位置是行高的整数倍”。配音开口（holdForVoice）把显示时间
    // 拉长，时间表整体后移；面板的位置只增不减，所以停在开口那一刻的位置上——开口正好落在一次
    // 0.25 秒的滑动中间时，文字就停在两行之间（最上面一行被裁掉一截），直到新的时间表追上来
    // （这个例子里约 0.9 秒）。配音在第一次上移之前开口时没有这个问题。
    // 眼下游戏里很难碰到：表现层只在台词出现后 1.5 秒内让配音开口（RADIO_VOICE_MAX_DELAY_MS），
    // 而第一次上移早于 1.5 秒的只有 360px 宽手机上的十几句中文（最早 1.43 秒），那时最多滑出
    // 3.4px。这里按 RadioComms 自己的接口写，不依赖那个上限。
    it.fails('rests on a whole line when the voice starts in the middle of a slide', () => {
      const line = show(LONG);
      // 第二行在 2.79 秒开始移出，滑 0.25 秒；配音在滑到一半时开口
      advance(2.9);
      const midway = movedUp();
      expect(midway).toBeGreaterThan(LH + 0.5);
      expect(midway).toBeLessThan(2 * LH - 0.5);
      radio.holdForVoice(line, 9);
      // 再过半秒，原来那次滑动早该结束了：文字应当停在整行上，而不是停在两行之间
      advance(0.5);
      expect(movedUp()).toBeGreaterThanOrEqual(midway);
      expect(isWholeLines(movedUp()), `resting at ${movedUp()} px`).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 游戏里的台词：每一行看得到多久
// ---------------------------------------------------------------------------

describe('how long each text line of the shipped radio lines can be read', () => {
  const LINES = shippedRadioLines();
  type Language = 'en' | 'zh';
  const LANGUAGES: readonly Language[] = ['en', 'zh'];

  /**
   * 字幕的阅读速度上限（Netflix Timed Text Style Guide；空格和标点都算字数）：
   * 英文成人节目 20 字/秒、儿童节目 17 字/秒；简体中文成人节目 9 字/秒、儿童节目 7 字/秒。
   */
  const SUBTITLE_RATE = {
    strict: { en: 17, zh: 7 },
    adult: { en: 20, zh: 9 },
  } as const;
  /** 一行字幕再短也要留这么久（秒） */
  const SHORTEST_DWELL = 1;
  /** 读者抬眼看到面板的时间（秒）：字幕出现到第一次注视约 0.3 秒，飞行中的玩家多留一些 */
  const GLANCE = 0.5;

  /**
   * 折行估算的两种取法：
   * - nominal：Arial 的字宽、样式表给的栏宽；
   * - wide：拉丁字形宽一成（手机上用别的无衬线字体顶替 Arial）、栏宽少 2px（边框取整）——行数只多不少，
   *   每行分到的时间只少不多。
   */
  const MODELS: ReadonlyArray<{ name: string; model: WrapModel; shrink: number }> = [
    { name: 'nominal', model: {}, shrink: 0 },
    { name: 'wide glyphs', model: { latinScale: 1.1 }, shrink: 2 },
  ];

  const sizeRows = FOLLOW_PHONES.map((phone) => [`${phone.width}×${phone.height}`, phone] as const);
  /** 减少动态效果时，中文在这两个尺寸上有几行来不及读完（见下面 it.fails 的说明） */
  const KNOWN_LATE_WITH_REDUCED_MOTION = ['360×640', '360×740'];

  function timelines(
    language: Language,
    column: number,
    boxLines: number,
    model: WrapModel,
    reducedMotion = false
  ): Array<{ id: string; timeline: FollowTimeline }> {
    return LINES.map((line) => ({
      id: line.id,
      timeline: followTimeline(
        wrapRadioText(line.text[language], column, model),
        boxLines,
        reducedMotion
      ),
    }));
  }

  it('covers every radio line the game ships, in both languages', () => {
    expect(LINES.length).toBeGreaterThan(100);
    for (const line of LINES) {
      expect(line.text.en.trim(), line.id).not.toBe('');
      expect(line.text.zh.trim(), line.id).not.toBe('');
    }
  });

  describe('the display times the estimate uses', () => {
    let radio: RadioComms;

    beforeEach(() => {
      document.body.innerHTML = '';
      radio = new RadioComms();
    });

    afterEach(() => {
      radio.dispose();
      resetLocale();
      document.body.innerHTML = '';
    });

    /** 最短、居中、最长的三句 */
    const SAMPLES = (language: Language): RadioLine[] => {
      const sorted = [...LINES].sort(
        (a, b) => Array.from(a.text[language]).length - Array.from(b.text[language]).length
      );
      return [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
    };

    it.each(LOCALES)('are the ones RadioComms keeps a line up for (%s)', (locale) => {
      setLocale(locale);
      for (const line of SAMPLES(locale === 'en' ? 'en' : 'zh')) {
        const expected = radioDisplayTimes(textIn(line.text, locale));
        radio.enqueue(line);
        const phase = (): string | null =>
          (document.getElementById('radio-comms') as HTMLElement).getAttribute('data-phase');
        let seconds = 0;
        const dt = 0.005;
        while (phase() === 'reveal') {
          radio.update(dt);
          seconds += dt;
        }
        expect(Math.abs(seconds - expected.reveal), `${line.id} typing`).toBeLessThanOrEqual(0.011);
        while (phase() === 'hold') {
          radio.update(dt);
          seconds += dt;
        }
        expect(Math.abs(seconds - expected.total), `${line.id} display time`).toBeLessThanOrEqual(
          0.011
        );
        radio.clear();
      }
    });
  });

  describe('the line-wrapping estimate', () => {
    it('keeps every character and never overfills a line', () => {
      for (const { column } of FOLLOW_PHONES) {
        for (const { model, shrink } of MODELS) {
          for (const line of LINES) {
            for (const language of LANGUAGES) {
              const text = line.text[language];
              const wrapped = wrapRadioText(text, column - shrink, model);
              expect(wrapped.join(''), line.id).toBe(text);
              for (const row of wrapped) {
                const width = Array.from(row.trimEnd()).reduce(
                  (sum, char) => sum + glyphWidth(char, model),
                  0
                );
                expect(width, `${line.id}: "${row}"`).toBeLessThanOrEqual(column - shrink + 0.01);
                expect(row.trim(), line.id).not.toBe('');
              }
            }
          }
        }
      }
    });

    it('breaks English at spaces and fills a line as far as the words allow', () => {
      // 按 Arial 的字宽：“Falcon, bandits” 88.9px 放得下，再加 “ inbound” 就超出 90px；
      // “inbound from” 75.9px，再加 “ the” 是 97.6px
      const wrapped = wrapRadioText('Falcon, bandits inbound from the north.', 90);
      expect(wrapped).toEqual(['Falcon, bandits ', 'inbound from ', 'the north.']);
    });

    it('puts six Chinese characters on a 90 px line and eight on a 105 px line', () => {
      const text = '数据核心已经沉入海底但神谕把自己藏进了电网';
      expect(wrapRadioText(text, 90).map((row) => row.length)).toEqual([6, 6, 6, 3]);
      expect(wrapRadioText(text, 105).map((row) => row.length)).toEqual([8, 8, 5]);
    });

    it('does not start a line with a closing punctuation mark', () => {
      for (const line of LINES) {
        for (const row of wrapRadioText(line.text.zh, 90).slice(1)) {
          expect('，。！？、；：”’）'.includes(Array.from(row)[0]), `${line.id}: "${row}"`).toBe(
            false
          );
        }
      }
    });

    it("agrees with the browser on the implementer's example: the 95-character line takes 8 lines at 360×640", () => {
      // 实现方在浏览器里量到这句正文高 135.2px = 8 行（16.9px 一行）
      const text =
        'The data core is on the seabed. But ORACLE slipped part of itself into the Thunder Canyon grid.';
      expect(wrapRadioText(text, 90)).toHaveLength(8);
      expect(8 * LH).toBeCloseTo(135.2, 9);
    });
  });

  describe.each(MODELS)('line wrapping: $name', ({ model, shrink }) => {
    describe.each(LANGUAGES)('%s', (language) => {
      it.each(sizeRows)(
        'a line that fits the box of a %s phone never moves',
        (_size, { column, lines }) => {
          for (const { id, timeline } of timelines(language, column - shrink, lines, model)) {
            if (timeline.followed) continue;
            for (const seconds of [0, timeline.reveal, timeline.total / 2, timeline.total, 60]) {
              expect(
                radioFollowOffset(
                  timeline.textLines * LH,
                  lines * LH,
                  LH,
                  seconds,
                  timeline.total,
                  timeline.reveal
                ),
                id
              ).toBe(0);
            }
          }
        }
      );

      it.each(sizeRows)(
        'on a %s phone every text line is in full view, fully typed, for at least its reading time',
        (_size, { column, lines }) => {
          const rate = SUBTITLE_RATE.strict[language];
          const tooShort: string[] = [];
          for (const reducedMotion of [false, true]) {
            for (const { id, timeline } of timelines(
              language,
              column - shrink,
              lines,
              model,
              reducedMotion
            )) {
              if (!timeline.followed) continue;
              for (const row of timeline.lines) {
                const chars = Array.from(row.text.trimEnd()).length;
                const need = Math.max(SHORTEST_DWELL, chars / rate);
                if (row.dwell < need) {
                  tooShort.push(
                    `${id} line ${row.line}/${timeline.textLines} "${row.text}": ` +
                      `${row.dwell.toFixed(2)} s, needs ${need.toFixed(2)} s` +
                      (reducedMotion ? ' (reduced motion)' : '')
                  );
                }
              }
            }
          }
          expect(tooShort).toEqual([]);
        }
      );

      /**
       * 读者在这句出现 0.5 秒后开始，从上往下按成人字幕的速度读；一行要整行进了面板、打完了字才
       * 读得完。返回没来得及的：某一行在读完之前就开始移出（最后几行：这句消失之前没读完）。
       */
      const lateLines = (
        phone: (typeof FOLLOW_PHONES)[number],
        reducedMotion: boolean
      ): string[] => {
        const rate = SUBTITLE_RATE.adult[language];
        const late: string[] = [];
        for (const { id, timeline } of timelines(
          language,
          phone.column - shrink,
          phone.lines,
          model,
          reducedMotion
        )) {
          if (!timeline.followed) continue;
          let reading = GLANCE;
          for (const row of timeline.lines) {
            const chars = Array.from(row.text.trimEnd()).length;
            reading = Math.max(Math.max(reading, row.from) + chars / rate, row.typedAt);
            if (reading > row.until + 1e-9) {
              late.push(
                `${id} line ${row.line}/${timeline.textLines} "${row.text}": read by ` +
                  `${reading.toFixed(2)} s, moves out at ${row.until.toFixed(2)} s`
              );
              break;
            }
          }
        }
        return late;
      };

      it.each(sizeRows)(
        'on a %s phone a reader at subtitle pace finishes every text line before it moves out',
        (_size, phone) => {
          expect(lateLines(phone, false)).toEqual([]);
        }
      );

      for (const [size, phone] of sizeRows) {
        // 偏差（幅度很小，0.01–0.06 秒）：减少动态效果时没有逐字阶段，显示时间只有停留的那一段，
        // 每行分到的时间更短。360px 宽的手机上，中文有四句（c05-level-start-hq、
        // c09-wave-start-2-airliner、c10-wave-start-6-wingman2、generic-raven-down-hq）的第二或
        // 第三行在按 9 字/秒读的读者读完之前就开始移出。
        const known = language === 'zh' && KNOWN_LATE_WITH_REDUCED_MOTION.includes(size);
        (known ? it.fails : it)(
          `with reduced motion, on a ${size} phone a reader at subtitle pace finishes every text line before it moves out`,
          () => {
            expect(lateLines(phone, true)).toEqual([]);
          }
        );
      }
    });
  });

  it('is not an empty check: English lines need following on each of the five phones', () => {
    for (const { column, lines, width, height } of FOLLOW_PHONES) {
      const followed = timelines('en', column, lines, {}).filter(
        ({ timeline }) => timeline.followed
      );
      expect(followed.length, `${width}×${height}`).toBeGreaterThan(0);
    }
    // 最小的手机上，大多数英文台词和一半左右的中文台词都放不下
    const small = FOLLOW_PHONES[0];
    const count = (language: Language): number =>
      timelines(language, small.column, small.lines, {}).filter(({ timeline }) => timeline.followed)
        .length;
    expect(count('en')).toBeGreaterThan(LINES.length / 2);
    expect(count('zh')).toBeGreaterThan(LINES.length / 4);
  });

  it('shows every text line of every followed line in the box at some time', () => {
    for (const { column, lines } of FOLLOW_PHONES) {
      for (const language of LANGUAGES) {
        for (const { id, timeline } of timelines(language, column, lines, {})) {
          for (const row of timeline.lines) {
            expect(row.from, `${id} line ${row.line}`).toBeLessThan(timeline.total);
            expect(row.until, `${id} line ${row.line}`).toBeGreaterThan(row.from);
          }
        }
      }
    }
  });
});
