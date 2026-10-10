import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RadioLine } from '@/features/campaign/CampaignTypes';
import { HUD } from '@/ui/HUD';
import { RadioComms } from '@/ui/RadioComms';

/**
 * 触屏横握时两处位置规则（C5）：
 * - 自动存档提示：留在驾驶舱信息栏下方那一行，让到雷达右侧（手机雷达 84px、平板档 132px），
 *   不再钉在左下角摇杆的位置上；
 * - 无线电面板：左右缘跟着平板档的摇杆 / 按键簇（两侧收进 28px + 安全区、尺寸放大）一起让开。
 *
 * 以及告警通道两行时的无线电面板（b602778，横握与竖屏）：
 * - 导弹告警与闪烁告警同时显示时 HUD 在 <html> 上记 data-hud-warning-rows="2"，少于两行或 HUD
 *   拆下时去掉；
 * - 有这个标记时手机上的无线电面板收小，不盖住下面那一行告警；平板档不变。
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

function radioLine(): RadioLine {
  const text = { en: 'Viper, bandits inbound.', zh: '蝰蛇，敌机来袭。' };
  return { id: 'layout-test-line', trigger: 'wave-start', speaker: 'hq', text };
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
  const PHONE_SCENES: Scene[] = [
    ...REFERENCE_PHONES,
    phone(393, 852),
    phone(412, 915),
    phone(430, 932),
    phone(852, 393),
    phone(915, 412),
    phone(932, 430),
    phone(844, 390, 'first-person'),
    phone(932, 430, 'first-person'),
    // 矮一些的手机（曾经盖住第二行约 6px，7723114 已修）
    phone(800, 360),
    phone(360, 800),
    phone(800, 360, 'first-person'),
  ];
  /** 有主屏幕指示条的 iPhone：面板的底边跟着安全区抬高，告警通道不动 */
  const INSET_PHONES: Scene[] = [
    phone(844, 390, 'third-person', 21),
    phone(390, 844, 'third-person', 34),
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

  function stage(scene: Scene): HTMLElement {
    mountHud(scene.density);
    hud.setCameraMode(scene.camera);
    radio = new RadioComms();
    radio.enqueue(radioLine());
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
   */
  function measure(scene: Scene, overrides: Readonly<Record<string, string>> = {}) {
    const viewport: Viewport = { width: scene.width, height: scene.height };
    const rules = pageRules();
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
        const height = frame(panel) + Math.max(portraitHeight, headHeight + textHeight);

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
          visible: shown(root) && shown(panel) && shown(text),
        };
      },

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

  it.each(PHONE_SCENES)(
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

  it.each(REFERENCE_PHONES)(
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

  it.each(REFERENCE_PHONES)(
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

  // FINDING：375×812 竖屏 + 34px 安全区（iPhone X / 11 Pro / 12 mini 一类），收小后的面板仍然
  // 盖住第二行告警。按样式表算、取对实现最有利的估计（告警行按最矮算）：通道下沿在 514px，
  // 面板底边在 534px（安全区 34 + 按键簇 240 + 4）、高 20.9px，上沿在 513.1px——盖住约 0.9px；
  // 中文字体的行框更高时更多（按 1.5 倍行高算约 5.9px）。
  // 期望：不盖住。同一档没有安全区时（375×812）余量约 13px。
  it.fails(
    'leaves the lower warning row clear on a 375×812 phone with a 34 px bottom inset',
    () => {
      const scene = phone(375, 812, 'third-person', 34);
      stage(scene);
      showBothRows();
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);

      expect(box.top - page.lane(NORMAL_LINE_HEIGHT.low).bottom).toBeGreaterThanOrEqual(0);
    }
  );

  // FINDING：更矮的竖屏手机上，收小后的面板仍然压在告警上。告警通道在屏幕中线下方、按键簇占着
  // 底部 260px，视口高度不到约 785px 时两者之间放不下 20.9px 的面板（取对实现最有利的估计）：
  // - 360×740（Galaxy S8 / S9 一类）：面板 455.1–476px，第二行告警 448.8–476.8px，几乎整行被盖住；
  // - 375×667（iPhone SE）：面板 382.1–403px，落在第一行告警（377.5–407.5px）上，第二行已经伸进
  //   按键簇的范围。
  // 手机浏览器带着地址栏时视口比屏幕矮，360×800 的手机也会落到这个范围里。
  // 期望：手机档都不盖住告警。这不是收小规则本身能解决的（没有地方可放）；如果这些尺寸
  // 另行处理，删掉这条即可。
  it.fails.each([phone(360, 740), phone(375, 667)])(
    'leaves the warning lane clear on a shorter $width×$height portrait phone',
    (scene) => {
      stage(scene);
      showBothRows();
      const page = measure(scene);

      const box = page.radioBox(LONG_MESSAGE, NORMAL_LINE_HEIGHT.low);

      expect(box.top - page.lane(NORMAL_LINE_HEIGHT.low).bottom).toBeGreaterThanOrEqual(0);
    }
  );
});
