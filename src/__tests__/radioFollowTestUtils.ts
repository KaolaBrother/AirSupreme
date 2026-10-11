import {
  CAMPAIGN_CHAPTERS,
  GENERIC_RADIO,
  UNIT_FIRST_CONTACT_RADIO,
  type RadioLine,
} from '@/features/campaign/CampaignData';
import { radioFollowOffset } from '@/ui/RadioComms';

/**
 * 无线电“跟读”（手机竖屏追尾视角的窄面板里，长台词逐行上移）的测试工具：
 * 游戏里全部的无线电台词、台词的显示时间、按字宽估算的折行，以及经由 radioFollowOffset
 * 算出的“每一行完整可见了多久”。jsdom 不排版，折行只能估算——模型见 wrapRadioText。
 */

/** 手机竖屏窄面板的正文：13px 字号、1.3 倍行高（radioStyles 的手机竖屏规则） */
export const FOLLOW_TEXT = { fontPx: 13, lineHeightPx: 16.9 } as const;

export interface FollowPhone {
  width: number;
  height: number;
  /** 面板里同时可见的正文行数（样式的行数上限） */
  lines: number;
  /** 正文一行的可用宽度（像素）：面板宽减去面板的左右内边距和边框 */
  column: number;
}

/**
 * 量“每行可见多久”用的五个手机竖屏尺寸。lines / column 由 TouchLandscapeLayoutStyles.test.ts
 * 的样式表估算器核对（那里从真实样式表量出同样的数），这里只是把结果列出来。
 */
export const FOLLOW_PHONES: readonly FollowPhone[] = [
  { width: 360, height: 640, lines: 3, column: 90 },
  { width: 375, height: 667, lines: 4, column: 105 },
  { width: 360, height: 740, lines: 5, column: 90 },
  { width: 360, height: 800, lines: 6, column: 90 },
  { width: 375, height: 812, lines: 6, column: 105 },
];

/** 游戏里会播出的全部无线电台词：各章台词、首次遭遇、通用台词（按 id 去重） */
export function shippedRadioLines(): RadioLine[] {
  const byId = new Map<string, RadioLine>();
  const all = [
    ...CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.radio),
    ...Object.values(UNIT_FIRST_CONTACT_RADIO),
    ...Object.values(GENERIC_RADIO),
  ];
  for (const line of all) {
    if (!byId.has(line.id)) byId.set(line.id, line);
  }
  return Array.from(byId.values());
}

/**
 * 一句台词的显示时间（没有配音时）：逐字显示 42 字/秒，之后停留 1.5 秒 + 每字 0.085 秒
 * （不少于 2.6 秒、不超过 6.5 秒）。减少动态效果时没有逐字阶段。
 * RadioFollow.test.ts 用真实的 RadioComms 核对这几个数。
 */
export function radioDisplayTimes(
  text: string,
  reducedMotion = false
): { chars: number; reveal: number; hold: number; total: number } {
  const chars = Array.from(text).length;
  const reveal = reducedMotion ? 0 : chars / 42;
  const hold = Math.min(6.5, Math.max(2.6, 1.5 + chars * 0.085));
  return { chars, reveal, hold, total: reveal + hold };
}

// ---------------------------------------------------------------------------
// 折行估算
// ---------------------------------------------------------------------------

/** Arial 的字宽（与 Helvetica 的 AFM 度量相同），单位是千分之一字号；ASCII 32–126 */
// prettier-ignore
const ARIAL_ADVANCES: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // 空格 ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0–9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A–O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P–Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a–o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p–z { | } ~
];
/** Arial 里有字形的几个非 ASCII 标点（中文里也先用 Arial 的窄字形） */
const ARIAL_PUNCTUATION: Readonly<Record<string, number>> = {
  '‘': 222,
  '’': 222,
  '“': 333,
  '”': 333,
  '–': 556,
  '—': 1000,
  '…': 1000,
  '·': 278,
};
/** 不能出现在行首的（前面不断行）与不能出现在行尾的（后面不断行） */
const NO_BREAK_BEFORE = new Set(Array.from('，。！？、；：）》」』】〉”’…,.!?;:)]}%'));
const NO_BREAK_AFTER = new Set(Array.from('（《「『【〈“‘([{'));

/** 汉字、假名、全角标点：一个字占一个字号宽，字与字之间可以断行 */
function isWide(char: string): boolean {
  return (char.codePointAt(0) as number) >= 0x2e80;
}

export interface WrapModel {
  /** 拉丁字形比 Arial 宽多少倍（手机上 Arial 被换成别的无衬线字体时）。默认 1 */
  latinScale?: number;
  /** 字号（像素）。默认 13 */
  fontPx?: number;
}

/** 一个字符的宽度（像素） */
export function glyphWidth(char: string, model: WrapModel = {}): number {
  const fontPx = model.fontPx ?? FOLLOW_TEXT.fontPx;
  if (isWide(char)) return fontPx;
  const code = char.codePointAt(0) as number;
  const advance =
    code >= 32 && code <= 126 ? ARIAL_ADVANCES[code - 32] : (ARIAL_PUNCTUATION[char] ?? 556);
  return (advance / 1000) * fontPx * (model.latinScale ?? 1);
}

function textWidth(text: string, model: WrapModel): number {
  let width = 0;
  for (const char of Array.from(text)) width += glyphWidth(char, model);
  return width;
}

function canBreakBetween(previous: string, next: string): boolean {
  if (previous === ' ') return next !== ' ';
  if (next === ' ') return false;
  if (NO_BREAK_BEFORE.has(next) || NO_BREAK_AFTER.has(previous)) return false;
  if (isWide(previous) || isWide(next)) return true;
  if (previous === '—' || next === '—') return previous !== next;
  if (previous === '-') return /[A-Za-z]/.test(next);
  return false;
}

/**
 * 估算正文在 columnPx 宽的一栏里怎样折行（浏览器的贪心折行）：
 * - 拉丁文字按 Arial 的字宽（面板的字体是 'Arial', sans-serif），在空格、连字符之后、破折号两侧断行；
 *   行尾的空格不占宽度；
 * - 汉字和全角标点每个占一个字号宽，字与字之间都可以断，标点不放在行首；
 * - 比一整行还宽的词在词内断开（word-break: break-word）。
 * 返回每一行的文字（行尾的空格留在这一行里，各行的字数加起来等于全文的字数）。
 */
export function wrapRadioText(text: string, columnPx: number, model: WrapModel = {}): string[] {
  const chars = Array.from(text);
  const units: string[] = [];
  let unit = '';
  chars.forEach((char, index) => {
    if (index > 0 && canBreakBetween(chars[index - 1], char)) {
      units.push(unit);
      unit = '';
    }
    unit += char;
  });
  if (unit !== '') units.push(unit);

  const lines: string[] = [];
  let line = '';
  const fits = (candidate: string): boolean =>
    textWidth(candidate.trimEnd(), model) <= columnPx + 0.01;
  for (const piece of units) {
    if (line !== '' && !fits(line + piece)) {
      lines.push(line);
      line = '';
    }
    if (line === '' && !fits(piece)) {
      for (const char of Array.from(piece)) {
        if (line !== '' && !fits(line + char)) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    } else {
      line += piece;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// 每一行完整可见了多久
// ---------------------------------------------------------------------------

/**
 * 位置随时间只增不减时，offsetAt(t) 第一次到达 target 的时刻（二分）；到 end 为止都没到返回 Infinity。
 */
export function firstTimeAtOrAbove(
  offsetAt: (seconds: number) => number,
  target: number,
  end: number
): number {
  if (!(offsetAt(end) >= target)) return Infinity;
  if (offsetAt(0) >= target) return 0;
  let low = 0;
  let high = end;
  for (let i = 0; i < 60; i += 1) {
    const middle = (low + high) / 2;
    if (offsetAt(middle) >= target) high = middle;
    else low = middle;
  }
  return high;
}

export interface LineDwell {
  /** 第几行（从 1 起） */
  line: number;
  text: string;
  /** 这一行打完字的时刻（逐字显示按字数匀速） */
  typedAt: number;
  /** 这一行整行进入面板的时刻（开头就在面板里的行是 0） */
  from: number;
  /** 这一行开始移出面板的时刻；最后几行留到台词消失（= 显示时间） */
  until: number;
  /** 打完字之后整行可见的时间 */
  dwell: number;
}

export interface FollowTimeline {
  textLines: number;
  boxLines: number;
  reveal: number;
  total: number;
  /** 这句在这个面板里放不下、要跟读 */
  followed: boolean;
  lines: LineDwell[];
}

/**
 * 一句已经折好行的台词在 boxLines 行高的面板里：每一行打完字之后整行可见多久。
 * 位置全部取自 radioFollowOffset（与 RadioComms 调用它的方式相同：内容高、面板高、行高、
 * 已显示时间、逐字 + 停留的总时间、逐字时间、减少动态效果时整行跳）。
 * 第 i 行整行可见 ⇔ (i − 面板行数) × 行高 ≤ 位置 ≤ (i − 1) × 行高。
 */
export function followTimeline(
  wrapped: readonly string[],
  boxLines: number,
  reducedMotion = false,
  lineHeight: number = FOLLOW_TEXT.lineHeightPx
): FollowTimeline {
  const text = wrapped.join('');
  const { chars, reveal, total } = radioDisplayTimes(text, reducedMotion);
  const textLines = wrapped.length;
  const offsetAt = (seconds: number): number =>
    radioFollowOffset(
      textLines * lineHeight,
      boxLines * lineHeight,
      lineHeight,
      seconds,
      total,
      reveal,
      reducedMotion
    );
  const tolerance = lineHeight * 1e-6;
  let typed = 0;
  const lines = wrapped.map((lineText, index): LineDwell => {
    const line = index + 1;
    typed += Array.from(lineText).length;
    const typedAt = chars > 0 ? (reveal * typed) / chars : 0;
    const from =
      line <= boxLines
        ? 0
        : firstTimeAtOrAbove(offsetAt, (line - boxLines) * lineHeight - tolerance, total);
    const leaves = firstTimeAtOrAbove(offsetAt, (line - 1) * lineHeight + tolerance, total);
    const until = Math.min(leaves, total);
    return { line, text: lineText, typedAt, from, until, dwell: until - Math.max(from, typedAt) };
  });
  return { textLines, boxLines, reveal, total, followed: textLines > boxLines, lines };
}
