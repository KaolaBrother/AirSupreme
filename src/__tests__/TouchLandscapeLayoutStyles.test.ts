import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CAMPAIGN_SPEAKERS } from '@/features/campaign/CampaignCast';
import type { CampaignSpeakerId, RadioLine } from '@/features/campaign/CampaignTypes';
import { HUD } from '@/ui/HUD';
import { RadarMinimap } from '@/ui/RadarMinimap';
import { RadioComms } from '@/ui/RadioComms';
import { HUD_TONE_COLORS } from '@/ui/theme/hudPalette';
import { installCanvasRecording, type CanvasRecording } from './canvasRecorder';
import { FOLLOW_PHONES, FOLLOW_TEXT } from './radioFollowTestUtils';
import { parseShippedDocument } from './touchTestUtils';

/**
 * 触屏横握时两处位置规则（C5）：
 * - 自动存档提示：留在驾驶舱信息栏下方那一行，让到雷达右侧（手机雷达 84px、平板档 132px），
 *   不再钉在左下角摇杆的位置上；
 * - 无线电面板：左右缘跟着平板档的摇杆 / 按键簇（两侧收进 28px + 安全区、尺寸放大）一起让开。
 *
 * 以及告警通道两行时的无线电面板（b602778）：
 * - 导弹告警与闪烁告警同时显示时 HUD 在 <html> 上记 data-hud-warning-rows="2"，少于两行或 HUD
 *   拆下时去掉；
 * - 有这个标记时手机横握的无线电面板收小，不盖住下面那一行告警；平板档不变。
 *
 * 手机竖屏追尾视角的无线电面板（P5，取代上一条在竖屏手机上的做法）：
 * - 一个紧凑的面板，在按键簇左侧、静止摇杆上方 14px；告警通道显示零行、一行还是两行，面板都在
 *   同一处、用同一套尺寸；
 * - 正文行数上限按视口高度分档（1–8 行），六行起多一行呼号（说话方的强调色）；
 * - 面板到了上限，离两行告警的下沿仍至少 12px（五行及以上的档带 34px 底部安全区也成立）。
 *
 * jsdom 不做布局，也不解析 calc() / env() / var()：这里读样式表原文（HUD 与无线电面板自己注入的
 * 样式，加上 index.html 里触控控件的样式），按媒体查询、选择器优先级和书写顺序自己层叠，
 * 再把长度表达式算成像素。元素用真实的 HUD / RadioComms 创建，选择器是否命中由 element.matches 判定。
 */

interface Viewport {
  width: number;
  height: number;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Declaration {
  property: string;
  value: string;
  important: boolean;
}

interface ParsedRule {
  selectors: string[];
  declarations: Declaration[];
  /** 外层的 @media 条件（可能嵌套多层）；顶层规则为空数组 */
  conditions: string[];
  order: number;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** 手机横握（短边 < 700） */
const PHONES: Viewport[] = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 1000, height: 699 },
];
/** 平板档横握（宽、高都 ≥ 700） */
const TABLETS: Viewport[] = [
  { width: 720, height: 700 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1366, height: 1024 },
];

const PHONE_RADAR = 84;
const TABLET_RADAR = 132;

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX_HTML = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
const INDEX_CSS = Array.from(INDEX_HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
  .map((match) => match[1])
  .join('\n');

// ---------------------------------------------------------------------------
// 样式表解析与层叠
// ---------------------------------------------------------------------------

/** 按分隔符切开，括号 / 方括号 / 引号里的不切 */
function splitTopLevel(text: string, isSeparator: (char: string) => boolean): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth === 0 && isSeparator(char)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseDeclarations(body: string): Declaration[] {
  return splitTopLevel(body, (char) => char === ';').flatMap((declaration) => {
    const colon = declaration.indexOf(':');
    if (colon < 0) return [];
    const rawValue = declaration.slice(colon + 1).trim();
    return [
      {
        property: declaration.slice(0, colon).trim().toLowerCase(),
        value: rawValue.replace(/!\s*important\s*$/i, '').trim(),
        important: /!\s*important\s*$/i.test(rawValue),
      },
    ];
  });
}

function parseCss(css: string, firstOrder = 0): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const walk = (block: string, conditions: string[]): void => {
    let cursor = 0;
    while (cursor < block.length) {
      const open = block.indexOf('{', cursor);
      if (open < 0) return;
      let depth = 1;
      let close = open + 1;
      while (close < block.length && depth > 0) {
        if (block[close] === '{') depth += 1;
        if (block[close] === '}') depth -= 1;
        close += 1;
      }
      const prelude = block.slice(cursor, open).trim();
      const body = block.slice(open + 1, close - 1);
      if (/^@media\b/i.test(prelude)) {
        walk(body, [...conditions, prelude.replace(/^@media\s*/i, '')]);
      } else if (/^@(supports|container|layer)\b/i.test(prelude)) {
        walk(body, conditions);
      } else if (!prelude.startsWith('@')) {
        rules.push({
          selectors: splitTopLevel(prelude, (char) => char === ','),
          declarations: parseDeclarations(body),
          conditions,
          order: firstOrder + rules.length,
        });
      }
      cursor = close;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), []);
  return rules;
}

/** 选择器优先级（id、类 / 属性 / 伪类；这里的规则不靠标签名区分） */
function specificity(selector: string): number {
  const unwrapped = selector.replace(/:(not|is|where|has)\(/g, ' ').replace(/\)/g, ' ');
  const attributes = unwrapped.match(/\[[^\]]*\]/g) ?? [];
  const bare = unwrapped.replace(/\[[^\]]*\]/g, ' ');
  const ids = bare.match(/#[\w-]+/g) ?? [];
  const classes = bare.match(/\.[\w-]+/g) ?? [];
  const pseudoClasses = bare.match(/(?<!:):(?!:)[\w-]+/g) ?? [];
  return ids.length * 10_000 + (attributes.length + classes.length + pseudoClasses.length) * 100;
}

function matches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    // 伪元素等 jsdom 不认识的选择器：不作用在元素本身
    return false;
  }
}

/** 一条媒体特性（括号里的内容）在给定触屏视口下是否成立 */
function featureHolds(feature: string, viewport: Viewport): boolean {
  const [rawName, rawValue = ''] = feature.split(':').map((part) => part.trim().toLowerCase());
  const px = (): number => {
    const match = rawValue.match(/^(-?[\d.]+)px$/);
    expect(match, `media feature (${feature}) should be a px length`).toBeTruthy();
    return Number((match as RegExpMatchArray)[1]);
  };
  switch (rawName) {
    case 'min-width':
      return viewport.width >= px();
    case 'max-width':
      return viewport.width <= px();
    case 'min-height':
      return viewport.height >= px();
    case 'max-height':
      return viewport.height <= px();
    case 'orientation':
      return rawValue === (viewport.width > viewport.height ? 'landscape' : 'portrait');
    case 'prefers-reduced-motion':
      return rawValue === 'no-preference';
    case 'pointer':
    case 'any-pointer':
      return rawValue === 'coarse';
    case 'hover':
    case 'any-hover':
      return rawValue === 'none';
    default:
      throw new Error(`media feature not understood by this test: (${feature})`);
  }
}

/** 一条 @media 条件（逗号 = 或，and = 与）在给定触屏视口下是否成立 */
function mediaHolds(condition: string, viewport: Viewport): boolean {
  return splitTopLevel(condition, (char) => char === ',').some((query) => {
    let text = query.trim().toLowerCase();
    let negate = false;
    if (text.startsWith('not ')) {
      negate = true;
      text = text.slice(4);
    }
    const holds = text
      .split(/\s+and\s+/)
      .map((part) => part.trim())
      .every((part) => {
        if (part === 'screen' || part === 'all' || part === 'only screen') return true;
        if (part === 'print') return false;
        const feature = part.match(/^\((.*)\)$/);
        expect(feature, `media query part "${part}"`).toBeTruthy();
        return featureHolds((feature as RegExpMatchArray)[1], viewport);
      });
    return negate ? !holds : holds;
  });
}

/**
 * 层叠：作用于 element、媒体条件在 viewport 下成立的规则里，按 !important、优先级、书写顺序
 * 取 property 的值。shorthand 给出时，同名简写（如 padding）按四个方向展开后一并参与。
 */
function cascaded(
  rules: readonly ParsedRule[],
  element: Element,
  property: string,
  viewport: Viewport,
  shorthand?: { property: string; side: 'top' | 'right' | 'bottom' | 'left' }
): string | undefined {
  let winner: { value: string; rank: number[] } | undefined;
  for (const rule of rules) {
    // 只是先筛一遍：没有声明这个属性的规则不必去比选择器（结果不变，一条用例里要查很多个视口）
    const declares = rule.declarations.some(
      (declaration) =>
        declaration.property === property || declaration.property === shorthand?.property
    );
    if (!declares) continue;
    const matching = rule.selectors.filter((selector) => matches(element, selector));
    if (matching.length === 0) continue;
    if (!rule.conditions.every((condition) => mediaHolds(condition, viewport))) continue;
    for (let index = 0; index < rule.declarations.length; index += 1) {
      const declaration = rule.declarations[index];
      let value: string | undefined;
      if (declaration.property === property) {
        value = declaration.value;
      } else if (shorthand && declaration.property === shorthand.property) {
        const parts = splitTopLevel(declaration.value, (char) => /\s/.test(char));
        const sideIndex = { top: 0, right: 1, bottom: 2, left: 3 }[shorthand.side];
        value = [
          parts[0],
          parts[1] ?? parts[0],
          parts[2] ?? parts[0],
          parts[3] ?? parts[1] ?? parts[0],
        ][sideIndex];
      }
      if (value === undefined) continue;
      const rank = [
        declaration.important ? 1 : 0,
        Math.max(...matching.map(specificity)),
        rule.order,
        index,
      ];
      if (!winner || outranks(rank, winner.rank)) winner = { value, rank };
    }
  }
  return winner?.value;
}

/** 按 !important、优先级、规则顺序、规则内的书写顺序依次比较：rank 是否压过 other */
function outranks(rank: readonly number[], other: readonly number[]): boolean {
  for (let i = 0; i < rank.length; i += 1) {
    if (rank[i] !== other[i]) return rank[i] > other[i];
  }
  return false;
}

/**
 * 作用于 element 的全部声明各自层叠后的取值（按书写的属性名，不展开简写）。
 * 两次结果相等，说明样式表给这个元素的样式完全一样。
 */
function cascadedAll(
  rules: readonly ParsedRule[],
  element: Element,
  viewport: Viewport
): Record<string, string> {
  const winners = new Map<string, { value: string; rank: number[] }>();
  for (const rule of rules) {
    const matching = rule.selectors.filter((selector) => matches(element, selector));
    if (matching.length === 0) continue;
    if (!rule.conditions.every((condition) => mediaHolds(condition, viewport))) continue;
    const top = Math.max(...matching.map(specificity));
    rule.declarations.forEach((declaration, index) => {
      const rank = [declaration.important ? 1 : 0, top, rule.order, index];
      const current = winners.get(declaration.property);
      if (!current || outranks(rank, current.rank)) {
        winners.set(declaration.property, { value: declaration.value, rank });
      }
    });
  }
  return Object.fromEntries(Array.from(winners, ([property, winner]) => [property, winner.value]));
}

// ---------------------------------------------------------------------------
// 长度表达式求值：px / vh / vw / vmin / vmax / %，calc() / max() / min() / clamp() / env() / var()
// ---------------------------------------------------------------------------

interface LengthContext {
  viewport: Viewport;
  insets: Insets;
  /** 自定义属性的取值（层叠后的原文）；没有定义返回 undefined */
  customProperty: (name: string) => string | undefined;
  /** 百分比的基准（像素）；用不到百分比时不给 */
  percentBase?: number;
}

function evaluateLength(expression: string, context: LengthContext): number {
  const tokens =
    expression.match(/--[\w-]+|[\d.]+(?:px|vh|vw|vmin|vmax|%)?|[a-z][\w-]*|[(),+\-*/]/gi) ?? [];
  let cursor = 0;
  const peek = (): string | undefined => tokens[cursor];
  const take = (expected?: string): string => {
    const token = tokens[cursor];
    expect(token, `unexpected end of "${expression}"`).toBeDefined();
    if (expected !== undefined) {
      expect(token, `in "${expression}"`).toBe(expected);
    }
    cursor += 1;
    return token;
  };

  const sum = (): number => {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const operator = take();
      const right = product();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const product = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      const operator = take();
      const right = factor();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const list = (): number[] => {
    const values = [sum()];
    while (peek() === ',') {
      take(',');
      values.push(sum());
    }
    return values;
  };
  const factor = (): number => {
    const token = take();
    if (token === '-') return -factor();
    if (token === '(') {
      const value = sum();
      take(')');
      return value;
    }
    const number = token.match(/^([\d.]+)(px|vh|vw|vmin|vmax|%)?$/i);
    if (number) {
      const amount = Number(number[1]);
      const unit = (number[2] ?? '').toLowerCase();
      const { width, height } = context.viewport;
      if (unit === 'vh') return (amount / 100) * height;
      if (unit === 'vw') return (amount / 100) * width;
      if (unit === 'vmin') return (amount / 100) * Math.min(width, height);
      if (unit === 'vmax') return (amount / 100) * Math.max(width, height);
      if (unit === '%') {
        expect(context.percentBase, `a percentage in "${expression}"`).toBeDefined();
        return (amount / 100) * (context.percentBase as number);
      }
      return amount;
    }
    const name = token.toLowerCase();
    take('(');
    if (name === 'calc') {
      const value = sum();
      take(')');
      return value;
    }
    if (name === 'max' || name === 'min') {
      const values = list();
      take(')');
      return name === 'max' ? Math.max(...values) : Math.min(...values);
    }
    if (name === 'clamp') {
      const values = list();
      take(')');
      expect(values, `clamp() in "${expression}" takes three values`).toHaveLength(3);
      return Math.max(values[0], Math.min(values[1], values[2]));
    }
    if (name === 'env') {
      const inset = take().toLowerCase();
      const side = inset.match(/^safe-area-inset-(top|right|bottom|left)$/);
      expect(side, `env(${inset}) in "${expression}"`).toBeTruthy();
      if (peek() === ',') {
        // 环境变量有值，回退值用不上，但要跳过它
        take(',');
        sum();
      }
      take(')');
      return context.insets[(side as RegExpMatchArray)[1] as keyof Insets];
    }
    if (name === 'var') {
      const property = take();
      let fallback: number | undefined;
      if (peek() === ',') {
        take(',');
        fallback = sum();
      }
      take(')');
      const defined = context.customProperty(property);
      if (defined !== undefined) return evaluateLength(defined, context);
      expect(fallback, `var(${property}) has no value and no fallback`).toBeDefined();
      return fallback as number;
    }
    throw new Error(`function ${name}() not understood by this test, in "${expression}"`);
  };

  const value = sum();
  expect(cursor, `trailing tokens in "${expression}"`).toBe(tokens.length);
  expect(Number.isFinite(value), `"${expression}" should be a finite length`).toBe(true);
  return value;
}

// ---------------------------------------------------------------------------
// 被测页面
// ---------------------------------------------------------------------------

function radioLine(speaker: CampaignSpeakerId = 'hq'): RadioLine {
  const text = { en: 'Viper, bandits inbound.', zh: '蝰蛇，敌机来袭。' };
  return { id: 'layout-test-line', trigger: 'wave-start', speaker, text };
}

/** HUD 记在 <html> 上的页面级标记：每条用例前后清掉，互不影响 */
const ROOT_MARKERS = ['data-hud-camera', 'data-hud-boss', 'data-hud-warning-rows'];

let hud: HUD;
let radio: RadioComms | null;
let controls: HTMLElement;

function clearRootMarkers(): void {
  for (const name of ROOT_MARKERS) document.documentElement.removeAttribute(name);
}

beforeEach(() => {
  document.body.innerHTML = '';
  clearRootMarkers();
  hud = new HUD();
  radio = null;
  // index.html 里的触控控件容器（样式规则靠这个类名命中）
  controls = document.createElement('div');
  controls.className = 'mobile-controls is-visible';
  document.body.appendChild(controls);
});

afterEach(() => {
  radio?.dispose();
  hud.dispose();
  clearRootMarkers();
  document.body.innerHTML = '';
});

function mountHud(density: 'desktop' | 'touch-landscape' | 'touch-portrait'): void {
  hud.setLayoutDensity(density);
  hud.init();
  hud.setLayoutDensity(density);
}

/** 文档里注入的全部样式，排在 index.html 的样式之后（与真实页面的加载顺序一致） */
function pageRules(): ParsedRule[] {
  const indexRules = parseCss(INDEX_CSS);
  const injected = Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
  return [...indexRules, ...parseCss(injected, indexRules.length)];
}

function lengthContext(viewport: Viewport, insets: Insets, percentBase?: number): LengthContext {
  const rules = pageRules();
  return {
    viewport,
    insets,
    percentBase,
    customProperty: (name) => cascaded(rules, document.documentElement, name, viewport),
  };
}

describe('touch-landscape layout styles', () => {
  describe('the stylesheet reader', () => {
    // 防止下面的断言空转：解析、媒体查询与求值各自有一条已知答案
    it('evaluates the length expressions these rules use', () => {
      const context: LengthContext = {
        viewport: { width: 1000, height: 500 },
        insets: { top: 0, right: 0, bottom: 21, left: 44 },
        customProperty: (name) => (name === '--known' ? 'calc(100px + 8px)' : undefined),
        percentBase: 90,
      };

      expect(evaluateLength('334.8px', context)).toBeCloseTo(334.8, 9);
      expect(evaluateLength('calc(84px + 8px)', context)).toBe(92);
      expect(evaluateLength('max(20px, env(safe-area-inset-left))', context)).toBe(44);
      expect(evaluateLength('max(20px, env(safe-area-inset-right))', context)).toBe(20);
      expect(evaluateLength('calc(28px + env(safe-area-inset-left, 0px))', context)).toBe(72);
      expect(evaluateLength('var(--known, 1px)', context)).toBe(108);
      expect(evaluateLength('var(--unknown, 150px)', context)).toBe(150);
      expect(evaluateLength('calc(100% + 8px)', context)).toBe(98);
      expect(evaluateLength('max(10vh, calc(env(safe-area-inset-bottom) + 20px))', context)).toBe(
        50
      );
      // 1000×500：1vmin = 5px，1vmax = 10px
      expect(evaluateLength('9vmin', context)).toBe(45);
      expect(evaluateLength('2vmax', context)).toBe(20);
      expect(evaluateLength('clamp(36px, 7vmin, 54px)', context)).toBe(36);
      expect(evaluateLength('clamp(36px, 10vmin, 54px)', context)).toBe(50);
      expect(evaluateLength('clamp(36px, 12vmin, 54px)', context)).toBe(54);
      expect(
        evaluateLength('calc(50% + min(var(--unknown, 13vmin), 16vmin) + 12px)', context)
      ).toBe(45 + 65 + 12);
    });

    it('applies the tablet media query only when both sides reach 700 px', () => {
      const tablet = '(min-width: 700px) and (min-height: 700px)';

      for (const viewport of TABLETS) expect(mediaHolds(tablet, viewport)).toBe(true);
      for (const viewport of PHONES) expect(mediaHolds(tablet, viewport)).toBe(false);
    });

    it('reads the touch control sizes of both tiers from index.html', () => {
      const phone = lengthContext(PHONES[1], NO_INSETS);
      const tablet = lengthContext(TABLETS[2], NO_INSETS);

      const stick = (context: LengthContext): number =>
        evaluateLength('var(--touch-stick-size)', context);
      const deck = (context: LengthContext): number =>
        evaluateLength('var(--touch-deck-w)', context);
      expect(stick(phone)).toBeGreaterThan(60);
      expect(deck(phone)).toBeGreaterThan(150);
      // 平板档的摇杆和按键簇更大
      expect(stick(tablet)).toBeGreaterThan(stick(phone) + 20);
      expect(deck(tablet)).toBeGreaterThan(deck(phone) + 40);
    });
  });

  describe('autosave toast', () => {
    function toast(density: 'desktop' | 'touch-landscape' | 'touch-portrait'): HTMLElement {
      mountHud(density);
      hud.showAutosave();
      const element = document.getElementById('hud-autosave');
      expect(element, 'expected the autosave toast in the document').not.toBeNull();
      return element as HTMLElement;
    }

    function toastStyle(element: HTMLElement, viewport: Viewport, property: string) {
      return cascaded(pageRules(), element, property, viewport);
    }

    function toastLeft(element: HTMLElement, viewport: Viewport): number {
      const left = toastStyle(element, viewport, 'left');
      expect(left, 'the toast should have a left offset').toBeDefined();
      return evaluateLength(left as string, lengthContext(viewport, NO_INSETS));
    }

    it('hangs under the cockpit info bar in touch landscape, inside the HUD', () => {
      const element = toast('touch-landscape');

      const hudRoot = document.getElementById('hud');
      expect(hudRoot?.getAttribute('data-layout-density')).toBe('touch-landscape');
      expect(hudRoot?.contains(element)).toBe(true);
      expect(element.closest('#hud-top-stack')).toBeNull();
      expect(element.classList.contains('hx-autosave')).toBe(true);
    });

    it.each(PHONES)(
      'sits to the right of the 84 px radar on a $width×$height phone',
      (viewport) => {
        const left = toastLeft(toast('touch-landscape'), viewport);

        expect(left).toBeGreaterThan(PHONE_RADAR);
        expect(left).toBeLessThanOrEqual(PHONE_RADAR + 16);
      }
    );

    it.each(TABLETS)(
      'sits to the right of the 132 px radar on a $width×$height tablet',
      (viewport) => {
        const left = toastLeft(toast('touch-landscape'), viewport);

        expect(left).toBeGreaterThan(TABLET_RADAR);
        expect(left).toBeLessThanOrEqual(TABLET_RADAR + 16);
      }
    );

    it('keeps the same gap from the radar on both tiers', () => {
      const element = toast('touch-landscape');

      const phoneGap = toastLeft(element, PHONES[1]) - PHONE_RADAR;
      const tabletGap = toastLeft(element, TABLETS[2]) - TABLET_RADAR;

      expect(tabletGap).toBeCloseTo(phoneGap, 6);
    });

    it.each([...PHONES, ...TABLETS])(
      'stays on the info bar’s row, not pinned over the stick ($width×$height)',
      (viewport) => {
        const element = toast('touch-landscape');

        // 跟着信息栏走（绝对定位在它下面），不是钉在视口上
        expect(toastStyle(element, viewport, 'position')).toBe('absolute');
        const bottom = toastStyle(element, viewport, 'bottom');
        expect(bottom === undefined || bottom === 'auto', `bottom: ${bottom}`).toBe(true);
        const top = toastStyle(element, viewport, 'top');
        expect(top, 'the toast should hang below the bar').toBeDefined();
        const barHeight = 96;
        const offset = evaluateLength(top as string, lengthContext(viewport, NO_INSETS, barHeight));
        expect(offset).toBeGreaterThan(barHeight);
        expect(offset).toBeLessThan(barHeight + 24);
      }
    );

    it('has no touch-landscape rule left that pins it to the bottom of the screen', () => {
      const element = toast('touch-landscape');
      const pinning = pageRules().filter(
        (rule) =>
          rule.selectors.some((selector) => matches(element, selector)) &&
          rule.declarations.some(
            (declaration) =>
              (declaration.property === 'position' && declaration.value === 'fixed') ||
              (declaration.property === 'bottom' && declaration.value !== 'auto')
          )
      );

      expect(pinning.map((rule) => rule.selectors.join(', '))).toEqual([]);
    });

    it.each([PHONES[1], TABLETS[2]])(
      'is not moved on a desktop layout ($width×$height)',
      (viewport) => {
        const left = toastLeft(toast('desktop'), viewport);

        expect(left).toBe(0);
      }
    );

    it('goes into the top message stack in portrait, as before', () => {
      const element = toast('touch-portrait');

      expect(element.closest('#hud-top-stack')).not.toBeNull();
      expect(toastStyle(element, { width: 390, height: 844 }, 'position')).toBe('static');
    });
  });

  describe('radio panel', () => {
    const GAP_AT_LEAST = 12;

    function panel(): HTMLElement {
      mountHud('touch-landscape');
      radio = new RadioComms();
      radio.enqueue(radioLine());
      radio.update(0.1);
      const element = document.getElementById('radio-comms');
      expect(element, 'expected the radio panel in the document').not.toBeNull();
      return element as HTMLElement;
    }

    /** 面板与触控控件在给定视口下的左右边距（像素） */
    function layout(element: HTMLElement, viewport: Viewport, insets: Insets) {
      const rules = pageRules();
      const context = lengthContext(viewport, insets);
      const length = (target: Element, property: string, side?: 'left' | 'right'): number => {
        const value = cascaded(
          rules,
          target,
          property,
          viewport,
          side ? { property: 'padding', side } : undefined
        );
        expect(value, `${property} should be set`).toBeDefined();
        return evaluateLength(value as string, context);
      };
      const stick = evaluateLength('var(--touch-stick-size)', context);
      const deck = evaluateLength('var(--touch-deck-w)', context);
      const panelLeft = length(element, 'left');
      const panelRight = length(element, 'right');
      const controlsLeft = length(controls, 'padding-left', 'left');
      const controlsRight = length(controls, 'padding-right', 'right');
      return {
        panelLeft,
        panelRight,
        stick,
        deck,
        controlsLeft,
        controlsRight,
        /** 面板左缘到摇杆右缘 / 面板右缘到按键簇左缘的空隙 */
        gapToStick: panelLeft - (controlsLeft + stick),
        gapToDeck: panelRight - (controlsRight + deck),
        width: viewport.width - panelLeft - panelRight,
      };
    }

    const INSET_CASES: Array<[string, Insets]> = [
      ['no safe-area insets', NO_INSETS],
      ['a notch on the left', { top: 0, right: 0, bottom: 21, left: 47 }],
      ['a notch on the right', { top: 0, right: 47, bottom: 21, left: 0 }],
      ['rounded corners all round', { top: 24, right: 24, bottom: 20, left: 24 }],
    ];

    it('is marked touch-landscape by the real panel', () => {
      const element = panel();

      expect(element.getAttribute('data-density')).toBe('touch-landscape');
    });

    describe.each(INSET_CASES)('with %s', (_name, insets) => {
      it.each(PHONES)(
        'keeps clear of the stick and the buttons on a $width×$height phone',
        (viewport) => {
          const measured = layout(panel(), viewport, insets);

          expect(measured.gapToStick).toBeGreaterThanOrEqual(GAP_AT_LEAST);
          expect(measured.gapToDeck).toBeGreaterThanOrEqual(GAP_AT_LEAST);
        }
      );

      it.each(TABLETS)(
        'keeps just as clear of the larger, inset tablet controls on a $width×$height tablet',
        (viewport) => {
          const element = panel();
          const tablet = layout(element, viewport, insets);
          const phone = layout(element, PHONES[1], insets);

          expect(tablet.gapToStick).toBeGreaterThanOrEqual(GAP_AT_LEAST);
          expect(tablet.gapToDeck).toBeGreaterThanOrEqual(GAP_AT_LEAST);
          // 平板档的空隙不比手机档小
          expect(tablet.gapToStick).toBeGreaterThanOrEqual(phone.gapToStick - 1e-6);
          expect(tablet.gapToDeck).toBeGreaterThanOrEqual(phone.gapToDeck - 1e-6);
        }
      );

      it.each([...PHONES, ...TABLETS])(
        'does not give up more room than it needs on $width×$height',
        (viewport) => {
          const measured = layout(panel(), viewport, insets);

          expect(measured.gapToStick).toBeLessThanOrEqual(24);
          expect(measured.gapToDeck).toBeLessThanOrEqual(24);
        }
      );
    });

    it('moves in with the tablet controls: wider insets than on a phone', () => {
      const element = panel();
      const phone = layout(element, PHONES[1], NO_INSETS);
      const tablet = layout(element, TABLETS[2], NO_INSETS);

      // 平板档的控件从两侧收进更多、尺寸也更大：面板左右缘都跟着往里
      expect(tablet.controlsLeft).toBeGreaterThan(phone.controlsLeft);
      expect(tablet.controlsRight).toBeGreaterThan(phone.controlsRight);
      expect(tablet.panelLeft - phone.panelLeft).toBeCloseTo(
        tablet.controlsLeft + tablet.stick - (phone.controlsLeft + phone.stick),
        6
      );
      expect(tablet.panelRight - phone.panelRight).toBeCloseTo(
        tablet.controlsRight + tablet.deck - (phone.controlsRight + phone.deck),
        6
      );
    });

    it.each([...PHONES, ...TABLETS])(
      'still has room for the panel between the two on $width×$height',
      (viewport) => {
        const measured = layout(panel(), viewport, NO_INSETS);

        expect(measured.width).toBeGreaterThan(100);
      }
    );

    it('follows the safe-area inset on the side that has one', () => {
      const element = panel();
      for (const viewport of [PHONES[1], TABLETS[2]]) {
        const plain = layout(element, viewport, NO_INSETS);
        const notched = layout(element, viewport, { top: 0, right: 0, bottom: 0, left: 60 });

        expect(notched.panelLeft).toBeGreaterThan(plain.panelLeft + 20);
        expect(notched.panelRight).toBeCloseTo(plain.panelRight, 6);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 告警通道两行时的无线电面板
// ---------------------------------------------------------------------------

type TouchDensity = 'touch-landscape' | 'touch-portrait';
type CameraMode = 'third-person' | 'first-person';
type WarningTone = 'threat' | 'sys' | 'ally';

const MISSILE_LEVELS = ['locking', 'incoming'] as const;
const WARNING_TONES: readonly WarningTone[] = ['threat', 'sys', 'ally'];

function rowsMarker(): string | null {
  return document.documentElement.getAttribute('data-hud-warning-rows');
}

/** 告警通道里现在显示着几行 */
function rowsShowing(): number {
  return ['hud-missile-warning', 'hud-flash-warning'].filter((id) => {
    const row = document.getElementById(id);
    return (
      row !== null && row.closest('#hud-warning-lane') !== null && row.style.display !== 'none'
    );
  }).length;
}

function showBothRows(tone: WarningTone = 'threat'): void {
  hud.setMissileWarning('incoming');
  hud.flashWarning('Boss attack incoming', tone);
  expect(rowsShowing()).toBe(2);
}

describe('two-row marker of the warning lane', () => {
  /** 按 0.1 秒一步走过 seconds 秒 */
  function advance(seconds: number): void {
    const steps = Math.round(seconds / 0.1);
    for (let i = 0; i < steps; i += 1) hud.update(0.1);
  }

  beforeEach(() => {
    hud.init();
  });

  it('is absent before any warning shows', () => {
    expect(rowsShowing()).toBe(0);
    expect(rowsMarker()).toBeNull();
  });

  it.each(MISSILE_LEVELS)('is absent with only the missile warning up (%s)', (level) => {
    hud.setMissileWarning(level);

    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it.each(WARNING_TONES)('is absent with only a flash warning up (%s)', (tone) => {
    hud.flashWarning('Boss attack incoming', tone);

    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it.each(
    MISSILE_LEVELS.flatMap((level) =>
      WARNING_TONES.map((tone): [(typeof MISSILE_LEVELS)[number], WarningTone] => [level, tone])
    )
  )('is "2" while both rows show (missile %s, flash %s), whichever came first', (level, tone) => {
    hud.setMissileWarning(level);
    hud.flashWarning('Boss attack incoming', tone);
    expect(rowsShowing()).toBe(2);
    expect(rowsMarker()).toBe('2');

    hud.setMissileWarning('none');
    advance(3);
    expect(rowsShowing()).toBe(0);
    expect(rowsMarker()).toBeNull();

    hud.flashWarning('Boss attack incoming', tone);
    hud.setMissileWarning(level);
    expect(rowsShowing()).toBe(2);
    expect(rowsMarker()).toBe('2');
  });

  it('goes when the missile warning ends', () => {
    showBothRows();
    expect(rowsMarker()).toBe('2');

    hud.setMissileWarning('none');

    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it('goes when the flash warning runs out, and not before', () => {
    showBothRows();

    advance(1.5);
    expect(rowsShowing()).toBe(2);
    expect(rowsMarker()).toBe('2');

    advance(1.5);
    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it('stays while the missile warning changes level and the flash warning is repeated or replaced', () => {
    hud.setMissileWarning('locking');
    hud.flashWarning('Boss attack incoming');
    hud.setMissileWarning('incoming');
    expect(rowsMarker()).toBe('2');

    // 同一句话再来一次：续时
    advance(1.5);
    hud.flashWarning('Boss attack incoming');
    advance(1.5);
    expect(rowsShowing()).toBe(2);
    expect(rowsMarker()).toBe('2');

    // 换一句话、换一种色调
    hud.flashWarning('Wingman down', 'ally');
    advance(1.5);
    hud.setMissileWarning('locking');
    expect(rowsShowing()).toBe(2);
    expect(rowsMarker()).toBe('2');

    advance(1.5);
    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it('comes back when the second row returns', () => {
    showBothRows();
    hud.setMissileWarning('none');
    expect(rowsMarker()).toBeNull();

    hud.setMissileWarning('locking');
    expect(rowsMarker()).toBe('2');

    advance(3);
    expect(rowsMarker()).toBeNull();

    hud.flashWarning('Weapon overheated', 'sys');
    expect(rowsMarker()).toBe('2');
  });

  it.each(['', '   '])('does not count a flash warning with nothing to say (%j)', (text) => {
    hud.setMissileWarning('incoming');
    hud.flashWarning(text);

    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it.each([
    ['game over', (): void => hud.showGameOver(0)],
    ['mission complete', (): void => hud.showMissionComplete(0)],
  ])('is cleared when the %s screen comes up', (_name, endRun) => {
    showBothRows();
    expect(rowsMarker()).toBe('2');

    endRun();

    expect(rowsShowing()).toBe(0);
    expect(rowsMarker()).toBeNull();
    // 结算之后一行告警不会把它带回来
    hud.hideGameOver();
    hud.flashWarning('Boss attack incoming');
    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();
  });

  it('is removed when the HUD is torn down', () => {
    showBothRows();
    expect(rowsMarker()).toBe('2');

    hud.dispose();

    expect(rowsShowing()).toBe(0);
    expect(rowsMarker()).toBeNull();
  });

  it.each([
    ['a flash warning', (): void => hud.flashWarning('Boss attack incoming')],
    ['a missile warning', (): void => hud.setMissileWarning('incoming')],
  ])('is not brought back by %s alone in the next run on the same HUD', (_name, warn) => {
    showBothRows();
    hud.dispose();

    hud.init();
    expect(rowsMarker()).toBeNull();
    // 上一局的另一行告警没有带过来
    warn();
    expect(rowsShowing()).toBe(1);
    expect(rowsMarker()).toBeNull();

    // 新的一局里照常工作
    showBothRows();
    expect(rowsMarker()).toBe('2');
  });

  it('starts absent for the next run’s HUD and works there too', () => {
    showBothRows();
    hud.dispose();

    const next = new HUD();
    try {
      next.init();
      expect(rowsMarker()).toBeNull();
      next.setMissileWarning('incoming');
      expect(rowsMarker()).toBeNull();
      next.flashWarning('Boss attack incoming');
      expect(rowsShowing()).toBe(2);
      expect(rowsMarker()).toBe('2');
    } finally {
      next.dispose();
    }
    expect(rowsMarker()).toBeNull();
  });

  it('matches the rows on screen at every step of a busy stretch', () => {
    const steps: Array<[string, () => void]> = [
      ['missile locking', () => hud.setMissileWarning('locking')],
      ['flash', () => hud.flashWarning('Boss attack incoming')],
      ['missile incoming', () => hud.setMissileWarning('incoming')],
      ['1 s', () => advance(1)],
      ['same flash again', () => hud.flashWarning('Boss attack incoming')],
      ['2 s', () => advance(2)],
      ['0.5 s more', () => advance(0.5)],
      ['missile none', () => hud.setMissileWarning('none')],
      ['flash, ally', () => hud.flashWarning('Wingman down', 'ally')],
      ['missile incoming', () => hud.setMissileWarning('incoming')],
      ['empty flash', () => hud.flashWarning('')],
      ['missile locking', () => hud.setMissileWarning('locking')],
      ['missile none', () => hud.setMissileWarning('none')],
      ['missile incoming', () => hud.setMissileWarning('incoming')],
      ['3 s', () => advance(3)],
      ['flash, sys', () => hud.flashWarning('Weapon overheated', 'sys')],
      ['game over', () => hud.showGameOver(1200)],
      ['back from game over', () => hud.hideGameOver()],
      ['missile incoming', () => hud.setMissileWarning('incoming')],
      ['flash', () => hud.flashWarning('Boss attack incoming')],
      ['mission complete', () => hud.showMissionComplete(4800)],
      ['flash', () => hud.flashWarning('Boss attack incoming')],
      ['missile locking', () => hud.setMissileWarning('locking')],
      ['torn down', () => hud.dispose()],
      ['mounted again', () => hud.init()],
      ['flash', () => hud.flashWarning('Boss attack incoming')],
      ['missile incoming', () => hud.setMissileWarning('incoming')],
      ['torn down again', () => hud.dispose()],
    ];
    const seen = { set: 0, absent: 0 };

    steps.forEach(([label, act], index) => {
      act();
      const where = `after step ${index} (${label})`;
      expect(rowsMarker(), where).toBe(rowsShowing() === 2 ? '2' : null);
      seen[rowsMarker() === '2' ? 'set' : 'absent'] += 1;
    });

    // 这一段里两种状态都出现过多次
    expect(seen.set).toBeGreaterThanOrEqual(6);
    expect(seen.absent).toBeGreaterThanOrEqual(6);
  });
});

describe('radio box under a two-row warning lane', () => {
  interface Scene {
    width: number;
    height: number;
    density: TouchDensity;
    camera: CameraMode;
    /** 底部安全区（iPhone 的主屏幕指示条：竖屏 34px、横握 21px） */
    bottomInset: number;
  }

  /**
   * line-height: normal 的行高由字体决定，这里没有字体可量：拉丁字体约 1.15 倍字号，中文字体可到
   * 1.4–1.5 倍。断言“让开了”用上界（告警行尽量高），断言“会盖住”用下界（各处都尽量矮）。
   */
  const NORMAL_LINE_HEIGHT = { low: 1, high: 1.5 };
  /** 一条长消息：正文有几行显示几行，由样式里的行数上限截断 */
  const LONG_MESSAGE = 9;
  /**
   * 第一人称下告警通道排在导引头捕获环下方，环的半径由 LockOnIndicator 运行时写在 <html> 上；
   * 这里取到样式允许的最大值（通道最靠下、离面板最近）。
   */
  const LARGEST_AIM_RING = { '--hud-aim-r': '100vmin' };

  const phone = (
    width: number,
    height: number,
    camera: CameraMode = 'third-person',
    bottomInset = 0
  ): Scene => ({
    width,
    height,
    density: width > height ? 'touch-landscape' : 'touch-portrait',
    camera,
    bottomInset,
  });

  /** 规格点名的两个尺寸 */
  const REFERENCE_PHONES: Scene[] = [phone(390, 844), phone(844, 390)];
  /** 横握的那一个：两行告警时面板收小的规则只剩横握手机在用 */
  const LANDSCAPE_REFERENCE: Scene = REFERENCE_PHONES[1];
  /** 手机横握：面板夹在摇杆和按键簇之间、贴着底边，两行告警时收小 */
  const LANDSCAPE_PHONE_SCENES: Scene[] = [
    LANDSCAPE_REFERENCE,
    phone(852, 393),
    phone(915, 412),
    phone(932, 430),
    phone(844, 390, 'first-person'),
    phone(932, 430, 'first-person'),
    // 矮一些的手机（曾经盖住第二行约 6px，7723114 已修）
    phone(800, 360),
    phone(800, 360, 'first-person'),
  ];
  /** 手机竖屏追尾视角：面板在按键簇左侧、摇杆上方，不随告警行数变（P5） */
  const PORTRAIT_PHONE_SCENES: Scene[] = [
    REFERENCE_PHONES[0],
    phone(393, 852),
    phone(412, 915),
    phone(430, 932),
    phone(360, 800),
  ];
  /** 有主屏幕指示条的 iPhone：面板的底边跟着安全区抬高，告警通道不动 */
  const INSET_PHONES: Scene[] = [
    phone(844, 390, 'third-person', 21),
    phone(390, 844, 'third-person', 34),
    // iPhone X / 11 Pro / 12 mini 一类：上一轮在这里盖住第二行约 1–6px，P5 修掉
    phone(375, 812, 'third-person', 34),
  ];
  const TABLET_SCENES: Scene[] = [
    phone(1024, 768),
    phone(1180, 820),
    phone(1024, 768, 'first-person'),
    phone(1180, 820, 'first-person'),
    phone(768, 1024),
    phone(820, 1180),
    phone(768, 1024, 'first-person'),
    phone(820, 1180, 'first-person'),
  ];

  function stage(scene: Scene, speaker: CampaignSpeakerId = 'hq'): HTMLElement {
    mountHud(scene.density);
    hud.setCameraMode(scene.camera);
    radio = new RadioComms();
    radio.enqueue(radioLine(speaker));
    radio.update(0.1);
    const element = document.getElementById('radio-comms');
    expect(element, 'expected the radio panel in the document').not.toBeNull();
    expect((element as HTMLElement).getAttribute('data-density')).toBe(scene.density);
    return element as HTMLElement;
  }

  function need<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    expect(element, `expected ${selector}`).not.toBeNull();
    return element as T;
  }

  /**
   * 按样式表估算面板与告警通道在视口里的上下位置（像素，原点在视口左上角）。
   * 盒模型：高度 = 上下内边距 + 上下边框 + 内容；一行文字的内容高度 = 字号 × 行高；
   * 图标取样式给的高度；告警行都是单行（white-space: nowrap）。
   * 一条用例里要量很多个视口时，把解析好的样式表（pageRules()）传进来，不必每次重读。
   */
  function measure(
    scene: Scene,
    overrides: Readonly<Record<string, string>> = {},
    rules: readonly ParsedRule[] = pageRules()
  ) {
    const viewport: Viewport = { width: scene.width, height: scene.height };
    const context = (percentBase?: number): LengthContext => ({
      viewport,
      insets: { ...NO_INSETS, bottom: scene.bottomInset },
      percentBase,
      customProperty: (name) =>
        overrides[name] ?? cascaded(rules, document.documentElement, name, viewport),
    });

    /** 元素自己的声明：行内样式优先，其次样式表 */
    const own = (element: Element, property: string): string | undefined => {
      const inline = (element as HTMLElement).style?.getPropertyValue(property);
      return inline ? inline : cascaded(rules, element, property, viewport);
    };
    /** 可继承的属性：自己没有声明就往上找 */
    const inherited = (element: Element, property: string): string | undefined => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const value = own(node, property);
        if (value !== undefined && value !== 'inherit') return value;
      }
      return undefined;
    };
    const length = (element: Element, property: string, percentBase?: number): number => {
      const value = own(element, property);
      expect(value, `${property} should be set`).toBeDefined();
      return evaluateLength(value as string, context(percentBase));
    };
    const padding = (element: Element, side: 'top' | 'bottom'): number => {
      const value = cascaded(rules, element, `padding-${side}`, viewport, {
        property: 'padding',
        side,
      });
      return value === undefined ? 0 : evaluateLength(value, context());
    };
    /** 这几个元素的上下边框只由 border / border-top / border-bottom 给出 */
    const border = (element: Element, side: 'top' | 'bottom'): number => {
      const value = own(element, `border-${side}`) ?? own(element, 'border');
      const width = value?.match(/(?:^|\s)([\d.]+)px/);
      return width ? Number(width[1]) : 0;
    };
    const frame = (element: Element): number =>
      padding(element, 'top') +
      padding(element, 'bottom') +
      border(element, 'top') +
      border(element, 'bottom');
    const shown = (element: Element): boolean => own(element, 'display') !== 'none';
    const lineBox = (element: Element, normal: number): number => {
      const fontSize = inherited(element, 'font-size');
      expect(fontSize, 'font-size should be set').toBeDefined();
      const lineHeight = inherited(element, 'line-height');
      const factor =
        lineHeight === undefined || lineHeight === 'normal' ? normal : Number(lineHeight);
      expect(Number.isFinite(factor), `line-height: ${lineHeight}`).toBe(true);
      return evaluateLength(fontSize as string, context()) * factor;
    };
    const icon = (row: Element): number => {
      const svg = row.querySelector('svg');
      return svg && shown(svg) ? length(svg, 'height') : 0;
    };
    /** 无线电面板的高度与显示的正文行数（不管它锚在哪一边） */
    const radioSize = (messageLines: number, normal: number) => {
      const root = need<HTMLElement>(document, '#radio-comms');
      const panel = need(root, '.rc-panel');
      const portrait = need(root, '.rc-portrait');
      const head = need(root, '.rc-head');
      const text = need(root, '.rc-text');
      const clamp = Number(own(text, '-webkit-line-clamp'));
      expect(Number.isInteger(clamp) && clamp >= 1, `line clamp: ${clamp}`).toBe(true);
      const lines = Math.min(messageLines, clamp);
      const textHeight = shown(text) ? lines * lineBox(text, normal) : 0;
      const headHeight = shown(head)
        ? lineBox(need(head, '.rc-callsign'), normal) + length(head, 'margin-bottom')
        : 0;
      const portraitHeight = shown(portrait) ? length(portrait, 'height') : 0;
      return {
        height: frame(panel) + Math.max(portraitHeight, headHeight + textHeight),
        lines,
        visible: shown(root) && shown(panel) && shown(text),
      };
    };

    return {
      /** 告警通道：两行都显示时各条边的位置 */
      lane(normal: number) {
        const lane = need<HTMLElement>(document, '#hud-warning-lane');
        const missile = need<HTMLElement>(lane, '#hud-missile-warning');
        const flash = need<HTMLElement>(lane, '#hud-flash-warning');
        const top = length(lane, 'top', viewport.height);
        const upperRow =
          frame(missile) +
          Math.max(
            icon(missile),
            lineBox(need(missile, '.hx-mw-main'), normal),
            lineBox(need(missile, '.hx-mw-hint'), normal)
          );
        const lowerRowTop = top + upperRow + length(lane, 'gap');
        const lowerRow =
          frame(flash) + Math.max(icon(flash), lineBox(need(flash, '.hx-flash-text'), normal));
        return { top, lowerRowTop, bottom: lowerRowTop + lowerRow };
      },

      /** 无线电面板：消息正文有 messageLines 行时的位置（面板贴着 bottom 向上长） */
      radioBox(messageLines: number, normal: number) {
        const root = need<HTMLElement>(document, '#radio-comms');
        const { height, lines, visible } = radioSize(messageLines, normal);

        const bottomOffset = own(root, 'bottom');
        expect(
          bottomOffset !== undefined && bottomOffset !== 'auto',
          `the box should be anchored to the bottom (bottom: ${bottomOffset})`
        ).toBe(true);
        const bottom =
          viewport.height - evaluateLength(bottomOffset as string, context(viewport.height));
        const left = length(root, 'left', viewport.width);
        const room = viewport.width - length(root, 'right', viewport.width) - left;
        const maxWidth = own(root, 'max-width');
        const width =
          maxWidth === undefined || maxWidth === 'none'
            ? room
            : Math.min(room, evaluateLength(maxWidth, context(viewport.width)));
        return {
          top: bottom - height,
          bottom,
          height,
          left,
          right: left + width,
          lines,
          visible,
        };
      },

      radioSize,

      /** 样式表给面板各个元素的全部声明 */
      radioStyles(): Array<Record<string, string>> {
        const root = need<HTMLElement>(document, '#radio-comms');
        return [root, ...Array.from(root.querySelectorAll('*'))].map((part) =>
          cascadedAll(rules, part, viewport)
        );
      },
    };
  }

  it('reads the sizes this estimate rests on from the real stylesheets', () => {
    stage(REFERENCE_PHONES[1]);
    showBothRows();
    const page = measure(REFERENCE_PHONES[1]);

    // 844×390 横握：通道第一行在屏幕中线下方 80px，两行加间隔 60 多像素；面板贴底边 12px
    const lane = page.lane(NORMAL_LINE_HEIGHT.low);
    expect(lane.top).toBeCloseTo(390 / 2 + 80, 6);
    expect(lane.bottom - lane.top).toBeGreaterThan(50);
    expect(lane.bottom - lane.top).toBeLessThan(80);
    expect(lane.lowerRowTop).toBeGreaterThan(lane.top + 20);
    expect(lane.lowerRowTop).toBeLessThan(lane.bottom - 20);
    const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
    expect(box.bottom).toBeCloseTo(390 - 12, 6);
    expect(box.height).toBeGreaterThan(12);
    expect(box.height).toBeLessThan(120);
  });

  it.each(LANDSCAPE_PHONE_SCENES)(
    'leaves the lower warning row clear on a $width×$height phone ($camera)',
    (scene) => {
      stage(scene);
      showBothRows();
      expect(rowsMarker()).toBe('2');
      const page = measure(scene, LARGEST_AIM_RING);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);
      const lane = page.lane(NORMAL_LINE_HEIGHT.high);

      // 面板与通道左右是重叠的（都压着屏幕中线），只能靠上下错开
      expect(box.left).toBeLessThan(scene.width / 2);
      expect(box.right).toBeGreaterThan(scene.width / 2);
      expect(box.top - lane.bottom).toBeGreaterThanOrEqual(0);
      // 面板还在，仍然显示正文
      expect(box.visible).toBe(true);
      expect(box.lines).toBeGreaterThanOrEqual(1);
    }
  );

  // 竖屏手机（P5）：面板不再横在屏幕中间，而是在按键簇左侧那一栏；告警通道居中、宽度由文字决定
  // （这里量不出来），所以仍然按上下错开来要求。位置、行数与 12px 的余量见下面
  // “on a portrait phone in the chase camera” 一组。
  it.each(PORTRAIT_PHONE_SCENES)(
    'leaves the lower warning row clear on a $width×$height phone ($camera)',
    (scene) => {
      stage(scene);
      showBothRows();
      expect(rowsMarker()).toBe('2');
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);
      const lane = page.lane(NORMAL_LINE_HEIGHT.high);

      // 不是整行的面板：不到半个屏宽
      expect(box.right - box.left).toBeGreaterThan(0);
      expect(box.right - box.left).toBeLessThan(scene.width / 2);
      expect(box.top - lane.bottom).toBeGreaterThanOrEqual(0);
      // 面板还在，仍然显示正文
      expect(box.visible).toBe(true);
      expect(box.lines).toBeGreaterThanOrEqual(1);
    }
  );

  it.each(WARNING_TONES.flatMap((tone) => REFERENCE_PHONES.map((scene) => ({ ...scene, tone }))))(
    'does so whatever the tone of the flash warning ($tone, $width×$height)',
    (scene) => {
      stage(scene);
      showBothRows(scene.tone);
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);

      expect(box.top - page.lane(NORMAL_LINE_HEIGHT.high).bottom).toBeGreaterThanOrEqual(0);
    }
  );

  // 以下两条只对横握成立：竖屏手机上面板不随告警行数变（见下面竖屏那一组）
  it.each([LANDSCAPE_REFERENCE])(
    'is what makes room on $width×$height: at full size even a one-line message reaches into the lower row',
    (scene) => {
      stage(scene);
      // 只有一行告警：面板是完整大小
      hud.setMissileWarning('incoming');
      expect(rowsMarker()).toBeNull();
      const full = measure(scene).radioBox(1, NORMAL_LINE_HEIGHT.low);

      showBothRows();
      const page = measure(scene);
      const lane = page.lane(NORMAL_LINE_HEIGHT.low);
      const compact = page.radioBox(1, NORMAL_LINE_HEIGHT.low);

      // 完整大小的面板（按最矮估计）上沿在第二行告警的下沿之上：盖住了
      expect(full.top).toBeLessThan(lane.bottom);
      expect(full.bottom).toBeGreaterThan(lane.lowerRowTop);
      // 收小之后让开
      expect(compact.height).toBeLessThan(full.height);
      expect(compact.top).toBeGreaterThanOrEqual(lane.bottom);
    }
  );

  it.each([LANDSCAPE_REFERENCE])(
    'goes back to full size on $width×$height as soon as one of the rows goes',
    (scene) => {
      stage(scene);
      hud.setMissileWarning('incoming');
      const before = measure(scene).radioStyles();

      showBothRows();
      expect(measure(scene).radioStyles()).not.toEqual(before);

      hud.setMissileWarning('none');
      expect(measure(scene).radioStyles()).toEqual(before);
    }
  );

  it.each(TABLET_SCENES)(
    'applies the same rules to the box with and without the marker on a $width×$height tablet ($camera)',
    (scene) => {
      stage(scene);
      hud.setMissileWarning('incoming');
      expect(rowsMarker()).toBeNull();
      const without = measure(scene).radioStyles();

      showBothRows();
      expect(rowsMarker()).toBe('2');

      expect(measure(scene).radioStyles()).toEqual(without);
    }
  );

  it.each([phone(1024, 768), phone(1180, 820)])(
    'needs no change on a $width×$height tablet: the full-size box is already clear of the lane',
    (scene) => {
      stage(scene);
      showBothRows();
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);

      expect(box.top - page.lane(NORMAL_LINE_HEIGHT.high).bottom).toBeGreaterThanOrEqual(0);
    }
  );

  it.each(INSET_PHONES)(
    'leaves the lower warning row clear on a $width×$height phone with a $bottomInset px bottom inset',
    (scene) => {
      stage(scene);
      showBothRows();
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);

      // 面板确实跟着安全区抬高了
      expect(scene.height - box.bottom).toBeGreaterThanOrEqual(scene.bottomInset);
      expect(box.top - page.lane(NORMAL_LINE_HEIGHT.high).bottom).toBeGreaterThanOrEqual(0);
    }
  );

  // 紧：812×375 横握 + 21px 安全区。按最矮的告警行（拉丁文字、带图标的威胁告警）算，面板上沿
  // 离第二行下沿 2.6px；中文字体的行框更高时这个余量可能用完（按 1.5 倍行高算是 -2.4px），
  // 所以这里只断言前一种，后一种见报告。
  it('is still clear, narrowly, on a 812×375 phone with a 21 px bottom inset', () => {
    const scene = phone(812, 375, 'third-person', 21);
    stage(scene);
    showBothRows();
    const page = measure(scene);

    const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);

    // 没有为了让开告警而压进主屏幕指示条的安全区
    expect(scene.height - box.bottom).toBeGreaterThanOrEqual(scene.bottomInset);
    expect(box.top - page.lane(NORMAL_LINE_HEIGHT.low).bottom).toBeGreaterThanOrEqual(0);
  });

  // 上一轮记下的发现（更矮的竖屏手机上，收小后的面板仍压在告警上）由 P5 修掉：面板挪到按键簇
  // 左侧、行数按视口高度分档，这两个尺寸现在都让得开（告警行按最高估计）。
  it.each([phone(360, 740), phone(375, 667)])(
    'leaves the warning lane clear on a shorter $width×$height portrait phone',
    (scene) => {
      stage(scene);
      showBothRows();
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);

      expect(box.visible).toBe(true);
      expect(box.top - page.lane(NORMAL_LINE_HEIGHT.high).bottom).toBeGreaterThanOrEqual(0);
    }
  );

  // -------------------------------------------------------------------------
  // 手机竖屏追尾视角的面板（P5），以及它不该波及的地方
  // -------------------------------------------------------------------------

  interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }

  /** 规格的分档：视口高度（两端都含）→ 正文行数上限 */
  const BANDS = [
    { range: 'under 599 px', from: 0, to: 598, lines: 1 },
    { range: '599–632 px', from: 599, to: 632, lines: 2 },
    { range: '633–665 px', from: 633, to: 665, lines: 3 },
    { range: '666–727 px', from: 666, to: 727, lines: 4 },
    { range: '728–798 px', from: 728, to: 798, lines: 5 },
    { range: '799–832 px', from: 799, to: 832, lines: 6 },
    { range: '833–866 px', from: 833, to: 866, lines: 7 },
    { range: '867 px and up', from: 867, to: Infinity, lines: 8 },
  ];
  /** 这里取的最矮与最高的竖屏视口（小屏手机带着浏览器工具栏；长屏手机） */
  const SHORTEST = 460;
  const TALLEST = 1100;
  /** 每个分档边界的两侧，加上最矮和最高 */
  const BAND_EDGES = [
    SHORTEST,
    ...BANDS.slice(1).flatMap((band) => [band.from - 1, band.from]),
    TALLEST,
  ];
  /** 从六行的档起显示呼号行 */
  const CALLSIGN_FROM = 799;
  /** 规格覆盖的屏宽：到 430px 为止 */
  const WIDTHS = [320, 360, 375, 390, 414, 430];
  /** 每档一个真实的尺寸 */
  const ONE_PER_BAND: Scene[] = [
    phone(320, 568), // 1 行：iPhone SE 一代
    phone(360, 616), // 2 行：360×640 的手机带着浏览器工具栏
    phone(360, 640), // 3 行
    phone(375, 667), // 4 行：iPhone SE 二 / 三代
    phone(360, 740), // 5 行：Galaxy S8 / S9
    phone(375, 812), // 6 行：iPhone X / 11 Pro
    phone(390, 844), // 7 行：iPhone 12–15
    phone(430, 932), // 8 行：iPhone Pro Max
  ];
  /** 有主屏幕指示条的 iPhone 竖屏的底部安全区 */
  const HOME_INDICATOR = 34;

  const bandOf = (height: number) =>
    BANDS.find((band) => height >= band.from && height <= band.to) as (typeof BANDS)[number];

  /** it.each 的表：行数、高度范围（标题用）、这一档 */
  const BAND_ROWS = BANDS.map((band) => [band.lines, band.range, band] as const);
  /** it.each 的表：尺寸（标题用，底部安全区不为零时带上）、场景 */
  const sceneRows = (scenes: readonly Scene[]) =>
    scenes.map((scene) => {
      const inset = scene.bottomInset > 0 ? ` with a ${scene.bottomInset} px bottom inset` : '';
      return [`${scene.width}×${scene.height}${inset}`, scene] as const;
    });

  /** 样式给正文的行数上限（-webkit-line-clamp 层叠后的值） */
  function lineLimit(scene: Scene, rules: readonly ParsedRule[]): number {
    const text = need<HTMLElement>(document, '#radio-comms .rc-text');
    const viewport: Viewport = { width: scene.width, height: scene.height };
    return Number(cascaded(rules, text, '-webkit-line-clamp', viewport));
  }

  /** 面板里的一个部件在给定视口下是否显示（自己和祖先都没有 display: none） */
  function partShown(selector: string, scene: Scene, rules: readonly ParsedRule[]): boolean {
    const viewport: Viewport = { width: scene.width, height: scene.height };
    const root = need<HTMLElement>(document, '#radio-comms');
    for (let node: Element | null = need(root, selector); node; node = node.parentElement) {
      if (cascaded(rules, node, 'display', viewport) === 'none') return false;
      if (node === root) break;
    }
    return true;
  }

  /** 可继承属性层叠后的取值：自己没有声明就往上找；值是 var(--x) 时再解一层 */
  function inheritedValue(
    element: Element,
    property: string,
    scene: Scene,
    rules: readonly ParsedRule[]
  ): string | undefined {
    const viewport: Viewport = { width: scene.width, height: scene.height };
    const lookup = (name: string): string | undefined => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const value = cascaded(rules, node, name, viewport);
        if (value !== undefined && value !== 'inherit') return value;
      }
      return undefined;
    };
    const value = lookup(property);
    const reference = value?.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
    return reference ? (lookup(reference[1]) ?? reference[2]) : value;
  }

  /** 把发布版 index.html 的触控控件换进文档：摇杆、按键簇和各个按键的样式规则靠真实的 id 命中 */
  function shipControls(): void {
    const shipped = parseShippedDocument().getElementById('mobile-controls');
    expect(shipped, 'index.html should have #mobile-controls').not.toBeNull();
    const node = document.importNode(shipped as HTMLElement, true);
    node.classList.add('is-visible');
    controls.replaceWith(node);
    controls = node;
  }

  /**
   * 触控控件在视口里的位置（像素）。#mobile-controls 贴着视口底边，是两端对齐、交叉轴靠下的弹性
   * 容器：摇杆贴左下内边距，按键簇贴右下内边距并以右下角为基点整体缩放（平板 ×1.35），各按键在
   * 簇里按 right / bottom 绝对定位。按住时摇杆底座会跟着手指走，这里量的是静止位置。
   */
  function controlBoxes(scene: Scene, rules: readonly ParsedRule[] = pageRules()) {
    const viewport: Viewport = { width: scene.width, height: scene.height };
    const declared = (element: Element, property: string): string | undefined =>
      cascaded(rules, element, property, viewport);
    const evaluate = (element: Element, expression: string): number =>
      evaluateLength(expression, {
        viewport,
        insets: { ...NO_INSETS, bottom: scene.bottomInset },
        // 按键的 --x / --y / --s 写在按键自己身上，簇和摇杆的尺寸写在 <html> 上：自己没有就往上找
        customProperty: (name) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const own = cascaded(rules, node, name, viewport);
            if (own !== undefined) return own;
          }
          return undefined;
        },
      });
    const length = (element: Element, property: string): number => {
      const value = declared(element, property);
      expect(value, `${property} should be set`).toBeDefined();
      return evaluate(element, value as string);
    };
    const padding = (side: 'left' | 'right' | 'bottom'): number => {
      const value = cascaded(rules, controls, `padding-${side}`, viewport, {
        property: 'padding',
        side,
      });
      expect(value, `padding-${side} should be set`).toBeDefined();
      return evaluate(controls, value as string);
    };

    const stick = need<HTMLElement>(controls, '#joystick');
    const deck = need<HTMLElement>(controls, '.button-container');

    // 这个估算依赖的布局方式
    expect(declared(controls, 'position')).toBe('fixed');
    expect(declared(controls, 'bottom')).toBe('0');
    expect(declared(controls, 'display')).toBe('flex');
    expect(declared(controls, 'justify-content')).toBe('space-between');
    expect(declared(controls, 'align-items')).toBe('flex-end');
    expect(declared(deck, 'transform-origin')).toBe('100% 100%');
    const scaled = declared(deck, 'transform')?.match(/^scale\((.+)\)$/);
    expect(scaled, 'the deck should be scaled as a whole').toBeTruthy();
    const scale = evaluate(deck, (scaled as RegExpMatchArray)[1]);

    const floor = viewport.height - padding('bottom');
    const stickLeft = padding('left');
    const deckRight = viewport.width - padding('right');
    const stickBox: Box = {
      left: stickLeft,
      right: stickLeft + length(stick, 'width'),
      top: floor - length(stick, 'height'),
      bottom: floor,
    };
    const deckBox: Box = {
      left: deckRight - length(deck, 'width') * scale,
      right: deckRight,
      top: floor - length(deck, 'height') * scale,
      bottom: floor,
    };
    const buttons = Array.from(deck.querySelectorAll<HTMLElement>('.touch-btn')).map((button) => {
      const right = deckRight - length(button, 'right') * scale;
      const bottom = floor - length(button, 'bottom') * scale;
      return {
        id: button.id,
        left: right - length(button, 'width') * scale,
        right,
        top: bottom - length(button, 'height') * scale,
        bottom,
      };
    });
    return { stick: stickBox, deck: deckBox, buttons };
  }

  it('reads where the shipped stick, deck and buttons rest from index.html', () => {
    stage(phone(390, 844));
    shipControls();
    const rules = pageRules();

    // 手机竖屏：摇杆 96px、按键簇 210×240，离屏幕边 20px
    const onPhone = controlBoxes(phone(390, 844), rules);
    expect(onPhone.stick).toEqual({ left: 20, right: 116, top: 728, bottom: 824 });
    expect(onPhone.deck).toEqual({ left: 160, right: 370, top: 584, bottom: 824 });
    expect(onPhone.buttons.map((button) => button.id).sort()).toEqual([
      'camera-button',
      'cycle-button',
      'fire-button',
      'flare-button',
      'missile-button',
      'special-button',
      'throttle-button',
      'upgrade-button',
    ]);
    for (const button of onPhone.buttons) {
      expect(button.right - button.left, button.id).toBeGreaterThanOrEqual(44);
      expect(button.left, button.id).toBeGreaterThanOrEqual(onPhone.deck.left);
      expect(button.right, button.id).toBeLessThanOrEqual(onPhone.deck.right);
      expect(button.top, button.id).toBeGreaterThanOrEqual(onPhone.deck.top);
      expect(button.bottom, button.id).toBeLessThanOrEqual(onPhone.deck.bottom);
    }
    // 开火键最大（66px），圆心离簇的右下角 (40, 44)
    const fire = onPhone.buttons.find((button) => button.id === 'fire-button') as Box;
    expect(fire).toMatchObject({ left: 297, right: 363, top: 747, bottom: 813 });

    // 底部安全区把摇杆和按键簇一起抬高
    const withInset = controlBoxes(phone(390, 844, 'third-person', HOME_INDICATOR), rules);
    expect(withInset.stick.bottom).toBe(844 - HOME_INDICATOR);
    expect(withInset.deck.bottom).toBe(844 - HOME_INDICATOR);

    // 平板竖屏：摇杆 150px、按键簇放大 1.35 倍（334.8×307.8），两侧收进 28px，整体抬高 10% 屏高
    const onTablet = controlBoxes(phone(768, 1024), rules);
    expect(onTablet.stick.left).toBe(28);
    expect(onTablet.stick.right - onTablet.stick.left).toBe(150);
    expect(onTablet.stick.bottom).toBeCloseTo(1024 * 0.9, 6);
    expect(onTablet.deck.right).toBe(768 - 28);
    expect(onTablet.deck.right - onTablet.deck.left).toBeCloseTo(334.8, 6);
    expect(onTablet.deck.bottom - onTablet.deck.top).toBeCloseTo(307.8, 6);
  });

  describe('on a portrait phone in the chase camera', () => {
    /** 规格给的两行告警的高度（中文字体）。这里没有字体、量不出来，照规格取 */
    const TWO_ROW_LANE = 67;
    const CLEARANCE = 12;
    /** 档的下端恰好等于 12px 时留给浮点误差的余地 */
    const EPSILON = 1e-6;
    /** 不到约 556px 高时一行也进了 12px（规格接受）：一行这一档从最矮的真实手机视口起量 */
    const ONE_LINE_FROM = 568;

    let radar: RadarMinimap | null = null;
    let canvases: CanvasRecording | null = null;
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      radar = null;
      canvases = null;
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
    });

    afterEach(() => {
      radar?.dispose();
      canvases?.restore();
      setWindowSize(originalInnerWidth, originalInnerHeight);
    });

    function setWindowSize(width: number, height: number): void {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    }

    /**
     * 面板到了行数上限时，上沿离两行告警下沿多远。告警通道的上沿从样式表量，两行的高度按规格的
     * 67px；面板的高度全由样式表决定（见 “has a height the stylesheet alone decides”）。
     */
    function clearance(scene: Scene, rules: readonly ParsedRule[]): number {
      const page = measure(scene, {}, rules);
      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
      expect(box.lines, `lines on ${scene.width}×${scene.height}`).toBe(bandOf(scene.height).lines);
      return box.top - (page.lane(NORMAL_LINE_HEIGHT.low).top + TWO_ROW_LANE);
    }

    describe('number of text lines', () => {
      it.each(BAND_ROWS)('is at most %i on a viewport %s high', (lines, _range, band) => {
        stage(phone(390, 844));
        const rules = pageRules();
        const low = Math.max(band.from, SHORTEST);
        const high = Math.min(band.to, TALLEST);

        for (const height of [low, Math.round((low + high) / 2), high]) {
          for (const width of WIDTHS) {
            const scene = phone(width, height);
            const box = measure(scene, {}, rules).radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
            expect(box.lines, `${width}×${height}`).toBe(lines);
            expect(box.visible, `${width}×${height}`).toBe(true);
          }
        }
      });

      it('steps up one line at each band edge and nowhere else', () => {
        stage(phone(390, 844));
        const rules = pageRules();

        const steps: Array<[number, number]> = [];
        let previous = lineLimit(phone(390, SHORTEST), rules);
        expect(previous).toBe(1);
        for (let height = SHORTEST + 1; height <= TALLEST; height += 1) {
          const limit = lineLimit(phone(390, height), rules);
          if (limit !== previous) steps.push([height, limit]);
          previous = limit;
        }

        expect(steps).toEqual(BANDS.slice(1).map((band) => [band.from, band.lines]));
      });

      it('goes by the height alone, up to the widest portrait phone (699 px)', () => {
        stage(phone(390, 844));
        const rules = pageRules();

        for (const height of BAND_EDGES.filter((edge) => edge >= 700)) {
          for (const width of [480, 600, 699]) {
            expect(lineLimit(phone(width, height), rules), `${width}×${height}`).toBe(
              bandOf(height).lines
            );
          }
        }
      });

      it('does not depend on the bottom inset', () => {
        stage(phone(390, 844));
        const rules = pageRules();

        for (const height of BAND_EDGES) {
          const scene = phone(390, height, 'third-person', HOME_INDICATOR);
          const box = measure(scene, {}, rules).radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
          expect(box.lines, `390×${height}`).toBe(bandOf(height).lines);
        }
      });
    });

    describe('callsign line', () => {
      it('is the first line from six lines of text up (799 px)', () => {
        stage(phone(390, 844));
        const rules = pageRules();
        const callsign = need<HTMLElement>(document, '#radio-comms .rc-callsign');
        const head = need<HTMLElement>(document, '#radio-comms .rc-head');
        const body = need<HTMLElement>(document, '#radio-comms .rc-body');

        // 呼号行在正文之前
        expect(callsign.closest('.rc-head')).toBe(head);
        expect(Array.from(body.children).map((child) => child.className)).toEqual([
          'rc-head',
          'rc-text',
        ]);
        for (const height of BAND_EDGES.filter((edge) => edge >= CALLSIGN_FROM)) {
          for (const width of WIDTHS) {
            const scene = phone(width, height);
            expect(lineLimit(scene, rules), `${width}×${height}`).toBeGreaterThanOrEqual(6);
            expect(partShown('.rc-callsign', scene, rules), `${width}×${height}`).toBe(true);
          }
        }
      });

      it('is left out below six lines (under 799 px)', () => {
        stage(phone(390, 844));
        const rules = pageRules();

        for (const height of BAND_EDGES.filter((edge) => edge < CALLSIGN_FROM)) {
          for (const width of WIDTHS) {
            const scene = phone(width, height);
            expect(lineLimit(scene, rules), `${width}×${height}`).toBeLessThanOrEqual(5);
            expect(partShown('.rc-callsign', scene, rules), `${width}×${height}`).toBe(false);
            expect(partShown('.rc-text', scene, rules), `${width}×${height}`).toBe(true);
          }
        }
      });

      it('adds exactly one short line to the box', () => {
        stage(phone(390, 844));
        const rules = pageRules();
        const height = (lines: number, viewportHeight: number): number =>
          measure(phone(390, viewportHeight), {}, rules).radioBox(lines, NORMAL_LINE_HEIGHT.low)
            .height;

        // 同样五行正文：798px 高没有呼号行，799px 高有
        const added = height(5, CALLSIGN_FROM) - height(5, CALLSIGN_FROM - 1);
        const textLine = height(5, CALLSIGN_FROM) - height(4, CALLSIGN_FROM);

        expect(textLine).toBeGreaterThan(10);
        expect(added).toBeGreaterThan(10);
        // 一行呼号加它与正文之间的间隔，不到两行正文
        expect(added).toBeLessThan(textLine * 2);
        // 呼号不换行：否则面板比这里估的高一行
        const callsign = need<HTMLElement>(document, '#radio-comms .rc-callsign');
        expect(inheritedValue(callsign, 'white-space', phone(390, 844), rules)).toBe('nowrap');
      });

      it.each(BAND_ROWS)(
        'comes without the portrait, the role line and the signal bars (limit %i, %s)',
        (_lines, _range, band) => {
          stage(phone(390, 844));
          const rules = pageRules();

          for (const height of [Math.max(band.from, SHORTEST), Math.min(band.to, TALLEST)]) {
            for (const width of [320, 390, 430]) {
              const scene = phone(width, height);
              const where = `${width}×${height}`;
              expect(partShown('.rc-portrait', scene, rules), where).toBe(false);
              expect(partShown('.rc-name', scene, rules), where).toBe(false);
              expect(partShown('.rc-signal', scene, rules), where).toBe(false);
              expect(partShown('.rc-text', scene, rules), where).toBe(true);
            }
          }
        }
      );

      // 每种强调色一位说话方
      const SPEAKERS: CampaignSpeakerId[] = ['hq', 'wingman', 'scientist', 'oracle', 'airliner'];

      it('uses a different accent colour for each kind of speaker tried here', () => {
        const colours = SPEAKERS.map((speaker) => HUD_TONE_COLORS[CAMPAIGN_SPEAKERS[speaker].tone]);

        expect(new Set(colours.map((colour) => colour.toLowerCase())).size).toBe(SPEAKERS.length);
      });

      it.each(SPEAKERS)('names the speaker in their own accent colour (%s)', (speaker) => {
        const scene = phone(390, 844);
        const root = stage(scene, speaker);
        const rules = pageRules();
        const callsign = need<HTMLElement>(root, '.rc-callsign');
        const accent = HUD_TONE_COLORS[CAMPAIGN_SPEAKERS[speaker].tone];

        expect(partShown('.rc-callsign', scene, rules)).toBe(true);
        expect(Object.values(CAMPAIGN_SPEAKERS[speaker].callsign)).toContain(callsign.textContent);
        for (const height of [CALLSIGN_FROM, 844, 932]) {
          const colour = inheritedValue(callsign, 'color', phone(390, height), rules);
          expect(colour?.toLowerCase(), `390×${height}`).toBe(accent.toLowerCase());
        }
        // 正文不是这个颜色：强调色只给呼号
        const text = need<HTMLElement>(root, '.rc-text');
        expect(inheritedValue(text, 'color', scene, rules)?.toLowerCase()).not.toBe(
          accent.toLowerCase()
        );
      });
    });

    describe('warning rows', () => {
      it.each(sceneRows([...ONE_PER_BAND, phone(390, 844, 'third-person', HOME_INDICATOR)]))(
        'leave the box as it is, with none, one or two showing (%s)',
        (_size, scene) => {
          stage(scene);
          const snapshot = () => {
            const page = measure(scene);
            return {
              styles: page.radioStyles(),
              box: page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low),
            };
          };
          const quiet = snapshot();
          expect(rowsShowing()).toBe(0);
          expect(quiet.box.visible).toBe(true);

          // 一行：导弹告警
          for (const level of MISSILE_LEVELS) {
            hud.setMissileWarning(level);
            expect(rowsShowing()).toBe(1);
            expect(snapshot(), `missile warning (${level})`).toEqual(quiet);
          }
          // 两行：每种色调的闪烁告警
          for (const tone of WARNING_TONES) {
            hud.flashWarning('Boss attack incoming', tone);
            expect(rowsShowing()).toBe(2);
            expect(rowsMarker()).toBe('2');
            expect(snapshot(), `both rows (${tone})`).toEqual(quiet);
          }
          // 一行：只剩闪烁告警
          hud.setMissileWarning('none');
          expect(rowsShowing()).toBe(1);
          expect(rowsMarker()).toBeNull();
          expect(snapshot(), 'flash warning only').toEqual(quiet);
        }
      );
    });

    describe('place', () => {
      it.each(
        sceneRows([
          ...ONE_PER_BAND,
          phone(375, 812, 'third-person', HOME_INDICATOR),
          phone(430, 932, 'third-person', HOME_INDICATOR),
        ])
      )('is left of the button deck, 14 px above the resting stick (%s)', (_size, scene) => {
        stage(scene);
        shipControls();
        const rules = pageRules();

        const box = measure(scene, {}, rules).radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
        const { stick, deck, buttons } = controlBoxes(scene, rules);

        expect(stick.top - box.bottom).toBeCloseTo(14, 6);
        // 与横握时面板到按键簇的空隙同一个范围
        expect(deck.left - box.right).toBeGreaterThanOrEqual(12);
        expect(deck.left - box.right).toBeLessThanOrEqual(24);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeGreaterThan(box.left);
        // 每个按键都在面板右边，隔着同样的空隙
        expect(buttons).toHaveLength(8);
        for (const button of buttons) {
          expect(button.left - box.right, button.id).toBeGreaterThanOrEqual(12);
        }
        // 底部安全区：摇杆跟着抬高，面板跟着摇杆，整个在安全区之上
        expect(stick.bottom).toBeLessThanOrEqual(scene.height - scene.bottomInset);
        expect(box.bottom).toBeLessThan(stick.top);
      });

      // 雷达的位置由 RadarMinimap 自己写在行内样式上。jsdom 里量不到状态栏和顶部消息栈的大小，
      // 雷达按它的默认尺寸回退——这里量的是消息栈没有把雷达往下推时的位置。
      it.each(sceneRows(ONE_PER_BAND))(
        'stays below the radar in its default place on %s',
        (_size, scene) => {
          stage(scene);
          setWindowSize(scene.width, scene.height);
          // jsdom 没有 2D 画布：给雷达一个记录型的上下文，它照常创建
          canvases = installCanvasRecording();
          radar = new RadarMinimap();
          radar.setLayoutDensity(scene.density);
          const node = need<HTMLElement>(document, '#radar-minimap');
          const radarBox = {
            left: parseFloat(node.style.left),
            top: parseFloat(node.style.top),
            size: parseFloat(node.style.height),
          };
          expect(Object.values(radarBox).every(Number.isFinite), JSON.stringify(radarBox)).toBe(
            true
          );
          expect(radarBox.size).toBe(PHONE_RADAR);

          const box = measure(scene).radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);

          // 两者都靠左（左右是重叠的）：雷达整个在面板上方
          expect(radarBox.left).toBeLessThan(box.right);
          expect(box.top - (radarBox.top + radarBox.size)).toBeGreaterThanOrEqual(CLEARANCE);
        }
      );
    });

    // RadioFollow.test.ts 按这几个尺寸算长台词逐行上移时“每一行看得到多久”：面板里同时可见的行数、
    // 正文一栏的宽度、字号、行高和字体都从这里的样式表核对，那边只是把数列出来。
    describe('the text column the radio follow tests rest on', () => {
      it.each(FOLLOW_PHONES.map((size) => [`${size.width}×${size.height}`, size] as const))(
        'is as wide and as many lines high on %s as FOLLOW_PHONES says',
        (_size, expected) => {
          const scene = phone(expected.width, expected.height);
          stage(scene);
          const rules = pageRules();
          const viewport: Viewport = { width: scene.width, height: scene.height };
          const panel = need<HTMLElement>(document, '#radio-comms .rc-panel');
          const text = need<HTMLElement>(document, '#radio-comms .rc-text');
          const pixels = (value: string | undefined): number => {
            const width = value?.match(/(?:^|\s)([\d.]+)px/);
            return width ? Number(width[1]) : 0;
          };
          /** 左右的内边距 / 外边距：简写（如 padding: 0）按四个方向展开后一并参与层叠 */
          const spacing = (
            element: Element,
            property: 'padding' | 'margin',
            side: 'left' | 'right'
          ): number =>
            parseFloat(
              cascaded(rules, element, `${property}-${side}`, viewport, { property, side }) ?? '0'
            );
          const padding = (side: 'left' | 'right'): number => spacing(panel, 'padding', side);
          /** 面板的左右边框只由 border / border-left / border-right 给出 */
          const border = (side: 'left' | 'right'): number =>
            pixels(
              cascaded(rules, panel, `border-${side}`, viewport) ??
                cascaded(rules, panel, 'border', viewport)
            );

          expect(lineLimit(scene, rules)).toBe(expected.lines);

          // 头像不显示，正文自己没有左右留白：一栏的宽度 = 面板宽 − 面板的左右内边距和边框
          expect(partShown('.rc-portrait', scene, rules)).toBe(false);
          for (const side of ['left', 'right'] as const) {
            expect(spacing(text, 'padding', side), `text padding-${side}`).toBe(0);
            expect(spacing(text, 'margin', side), `text margin-${side}`).toBe(0);
          }
          const box = measure(scene, {}, rules).radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
          const column =
            box.right -
            box.left -
            padding('left') -
            padding('right') -
            border('left') -
            border('right');
          expect(column).toBeCloseTo(expected.column, 6);

          // 折行估算用的字：13px 的 Arial、1.3 倍行高，不加字距，长词可以在词内断开
          const fontSize = inheritedValue(text, 'font-size', scene, rules);
          expect(fontSize).toBe(`${FOLLOW_TEXT.fontPx}px`);
          const lineHeight = Number(inheritedValue(text, 'line-height', scene, rules));
          expect(FOLLOW_TEXT.fontPx * lineHeight).toBeCloseTo(FOLLOW_TEXT.lineHeightPx, 9);
          expect(inheritedValue(text, 'font-family', scene, rules)).toMatch(/^'Arial'/);
          expect(inheritedValue(text, 'letter-spacing', scene, rules) ?? 'normal').toBe('normal');
          expect(cascaded(rules, text, 'word-break', viewport)).toBe('break-word');
        }
      );
    });

    describe('room above the box when the lane shows two rows', () => {
      it('has a height the stylesheet alone decides, whatever the font', () => {
        stage(phone(390, 844));
        const rules = pageRules();

        for (const scene of ONE_PER_BAND) {
          const page = measure(scene, {}, rules);
          const shortest = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
          const tallest = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.high);
          expect(tallest.height, `${scene.width}×${scene.height}`).toBe(shortest.height);
        }
      });

      it('takes the 67 px of the specification for the two rows, within what the stylesheet allows', () => {
        const scene = phone(390, 844);
        stage(scene);
        showBothRows();
        const page = measure(scene);
        const shortest = page.lane(NORMAL_LINE_HEIGHT.low);
        const tallest = page.lane(NORMAL_LINE_HEIGHT.high);

        expect(shortest.bottom - shortest.top).toBeLessThanOrEqual(TWO_ROW_LANE);
        expect(tallest.bottom - tallest.top).toBeGreaterThanOrEqual(TWO_ROW_LANE);
        expect(tallest.bottom - tallest.top - TWO_ROW_LANE).toBeLessThan(4);
      });

      // 实现方在浏览器里量到的数：面板上沿、下沿，两行告警时的余量（英文 / 中文字体）。
      // 用来核对这里的估算与真实排版一致；设计有意改动时按新的实测值更新。
      it.each([
        [375, 667, 461, 537, 19.9, 16.9],
        [360, 740, 518, 610, 40.8, 37.8],
        [360, 800, 542, 670, 35.3, 32.3],
        [375, 812, 554, 682, 40.1, 37.1],
        [390, 844, 569, 714, 38.0, 35.0],
        [430, 932, 640, 802, 61.9, 58.9],
      ])(
        'agrees with the browser on %i×%i: box at %i–%i, clear by %f px (en) and %f px (zh)',
        (width, height, top, bottom, clearLatin, clearChinese) => {
          const scene = phone(width, height);
          stage(scene);
          showBothRows();
          const rules = pageRules();
          const page = measure(scene, {}, rules);

          const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);

          // 上下沿报的是整数像素
          expect(Math.abs(box.top - top)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(box.bottom - bottom)).toBeLessThanOrEqual(0.5);
          // 英文：两行告警的高度由图标决定，样式表里量得出
          const latinLane = page.lane(NORMAL_LINE_HEIGHT.low);
          expect(Math.abs(box.top - latinLane.bottom - clearLatin)).toBeLessThanOrEqual(0.25);
          expect(Math.abs(clearance(scene, rules) - clearChinese)).toBeLessThanOrEqual(0.25);
        }
      );

      // 档内余量随高度增加、随屏宽减小：量每档的两端和规格覆盖的各个屏宽
      it.each(BAND_ROWS)(
        'is at least 12 px at the %i-line limit (%s, no bottom inset)',
        (_lines, _range, band) => {
          stage(phone(390, 844));
          showBothRows();
          const rules = pageRules();

          for (const height of [Math.max(band.from, ONE_LINE_FROM), Math.min(band.to, TALLEST)]) {
            for (const width of WIDTHS) {
              expect(
                clearance(phone(width, height), rules),
                `${width}×${height}`
              ).toBeGreaterThanOrEqual(CLEARANCE - EPSILON);
            }
          }
        }
      );

      it.each(BAND_ROWS.filter(([lines]) => lines >= 5))(
        'is at least 12 px at the %i-line limit even with a 34 px bottom inset (%s)',
        (_lines, _range, band) => {
          stage(phone(390, 844));
          showBothRows();
          const rules = pageRules();

          for (const height of [band.from, Math.min(band.to, TALLEST)]) {
            for (const width of WIDTHS) {
              const scene = phone(width, height, 'third-person', HOME_INDICATOR);
              expect(clearance(scene, rules), `${width}×${height}`).toBeGreaterThanOrEqual(
                CLEARANCE - EPSILON
              );
            }
          }
        }
      );

      it.each(
        sceneRows([
          phone(320, 568),
          phone(360, 640),
          phone(375, 667),
          phone(414, 736),
          phone(360, 740),
          phone(360, 780),
          phone(360, 800),
          phone(412, 915),
          // 有主屏幕指示条的 iPhone
          phone(375, 812, 'third-person', HOME_INDICATOR),
          phone(390, 844, 'third-person', HOME_INDICATOR),
          phone(393, 852, 'third-person', HOME_INDICATOR),
          phone(414, 896, 'third-person', HOME_INDICATOR),
          phone(428, 926, 'third-person', HOME_INDICATOR),
          phone(430, 932, 'third-person', HOME_INDICATOR),
          // 五行的档带着安全区也成立
          phone(360, 740, 'third-person', HOME_INDICATOR),
        ])
      )('is at least 12 px on a phone of %s', (_size, scene) => {
        stage(scene);
        showBothRows();

        expect(clearance(scene, pageRules())).toBeGreaterThanOrEqual(CLEARANCE);
      });

      // 规格接受的例外：四行及以下的档只保证没有安全区时的 12px。375×667 强加 34px 安全区后余量
      // 约 3–6px——不到 12px，但没有盖住。
      it('is smaller but still there on 375×667 with a forced 34 px bottom inset', () => {
        const scene = phone(375, 667, 'third-person', HOME_INDICATOR);
        stage(scene);
        showBothRows();
        const page = measure(scene);

        const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);

        expect(box.lines).toBe(4);
        expect(clearance(scene, pageRules())).toBeGreaterThanOrEqual(0);
        // 按最高的告警行估计也没有盖住
        expect(box.top - page.lane(NORMAL_LINE_HEIGHT.high).bottom).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('away from the portrait-phone chase camera, where the new rule does not apply', () => {
    const FULL_PANEL_PARTS = [
      '.rc-portrait',
      '.rc-head',
      '.rc-callsign',
      '.rc-name',
      '.rc-signal',
      '.rc-text',
    ];

    /**
     * 完整面板放满三行正文时的高度，各处一样：内边距 7 + 8、边框 1 + 1、呼号行 12 + 3（行高按字号
     * 算）、正文 3 × 13 × 1.45。竖屏手机面板收紧的行高和内边距不该出现在别处。
     */
    const FULL_PANEL_HEIGHT = 7 + 8 + 1 + 1 + 12 + 3 + 3 * 13 * 1.45;

    /** 完整的面板：三行正文，头像、呼号、军衔姓名、信号格都在，尺寸没有收紧 */
    function expectFullPanel(scene: Scene, rules: readonly ParsedRule[]): void {
      const where = `${scene.width}×${scene.height}`;
      expect(lineLimit(scene, rules), where).toBe(3);
      for (const part of FULL_PANEL_PARTS) {
        expect(partShown(part, scene, rules), `${part} on ${where}`).toBe(true);
      }
      const size = measure(scene, {}, rules).radioSize(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
      expect(size.height, `panel height on ${where}`).toBeCloseTo(FULL_PANEL_HEIGHT, 6);
    }

    it('keeps the full-width panel under the top stack on a portrait phone in the first-person camera', () => {
      const reference = phone(390, 844, 'first-person');
      const root = stage(reference);
      const rules = pageRules();
      const expected = measure(reference, {}, rules).radioStyles();

      // 不按高度分档
      for (const height of BAND_EDGES) {
        for (const width of [320, 430]) {
          const scene = phone(width, height, 'first-person');
          expect(measure(scene, {}, rules).radioStyles(), `${width}×${height}`).toEqual(expected);
          expectFullPanel(scene, rules);
        }
      }
      // 整行，挂在顶部，不贴底
      const viewport: Viewport = { width: 390, height: 844 };
      const context = lengthContext(viewport, NO_INSETS);
      const offset = (property: string): number =>
        evaluateLength(cascaded(rules, root, property, viewport) as string, context);
      expect(cascaded(rules, root, 'bottom', viewport)).toBe('auto');
      expect(offset('left')).toBeLessThanOrEqual(20);
      expect(offset('right')).toBe(offset('left'));
      expect(offset('top')).toBeGreaterThan(100);
      expect(offset('top')).toBeLessThan(844 / 3);

      // 两行告警也不改它
      showBothRows();
      expect(rowsMarker()).toBe('2');
      expect(measure(reference).radioStyles()).toEqual(expected);
    });

    it('does not band the lines by height on a phone held in landscape', () => {
      stage(LANDSCAPE_REFERENCE);
      const rules = pageRules();
      const expected = measure(LANDSCAPE_REFERENCE, {}, rules).radioStyles();
      // 真实的横握手机都不到 599px 高（竖屏规则里是一行的档）；再加上各档边界两侧的高度
      const viewports = [
        [667, 375],
        [800, 360],
        [932, 430],
        ...BAND_EDGES.filter((edge) => edge < 700).map((edge) => [1000, edge]),
        [1000, 699],
      ];

      for (const [width, height] of viewports) {
        const scene = phone(width, height);
        expect(scene.density).toBe('touch-landscape');
        expect(measure(scene, {}, rules).radioStyles(), `${width}×${height}`).toEqual(expected);
        expectFullPanel(scene, rules);
      }
      // 贴着底边、压着屏幕中线，和以前一样
      const box = measure(LANDSCAPE_REFERENCE, {}, rules).radioBox(
        LONG_MESSAGE,
        NORMAL_LINE_HEIGHT.low
      );
      expect(box.lines).toBe(3);
      expect(box.bottom).toBeCloseTo(390 - 12, 6);
      expect(box.left).toBeLessThan(844 / 2);
      expect(box.right).toBeGreaterThan(844 / 2);
    });

    it.each(TABLET_SCENES)(
      'keeps three lines, the portrait and the whole callsign row on a $width×$height tablet ($camera)',
      (scene) => {
        stage(scene);

        expectFullPanel(scene, pageRules());
      }
    );

    it.each([
      ['portrait tablet in the chase camera', 700, 'third-person'],
      ['portrait tablet in the first-person camera', 700, 'first-person'],
      ['landscape tablet in the chase camera', 1200, 'third-person'],
      ['landscape tablet in the first-person camera', 1200, 'first-person'],
    ] as Array<[string, number, CameraMode]>)(
      'does not band the lines by height on a %s',
      (_name, width, camera) => {
        const reference = phone(width, 700, camera);
        stage(reference);
        const rules = pageRules();
        const expected = measure(reference, {}, rules).radioStyles();

        // 平板档从 700px 高起：竖屏手机五行到八行的各档边界都在这个范围里
        for (const height of BAND_EDGES.filter((edge) => edge >= 700)) {
          const scene = phone(width, height, camera);
          expect(scene.density).toBe(reference.density);
          expect(measure(scene, {}, rules).radioStyles(), `${width}×${height}`).toEqual(expected);
          expectFullPanel(scene, rules);
        }
      }
    );

    it.each([phone(768, 1024), phone(820, 1180), phone(1024, 1366)])(
      'still puts the box left of the larger deck, 14 px above the larger stick, on a $width×$height tablet',
      (scene) => {
        stage(scene);
        shipControls();
        const rules = pageRules();

        const box = measure(scene, {}, rules).radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);
        const { stick, deck } = controlBoxes(scene, rules);

        expect(stick.top - box.bottom).toBeCloseTo(14, 6);
        expect(deck.left - box.right).toBeGreaterThanOrEqual(12);
        expect(deck.left - box.right).toBeLessThanOrEqual(24);
        // 左缘与摇杆对齐
        expect(box.left).toBeCloseTo(stick.left, 6);
        expect(box.lines).toBe(3);
      }
    );
  });
});
