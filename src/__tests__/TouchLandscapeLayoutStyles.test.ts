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

// ---------------------------------------------------------------------------
// 长度表达式求值：px / vh / vw / %，calc() / max() / min() / env() / var()
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
  const tokens = expression.match(/--[\w-]+|[\d.]+(?:px|vh|vw|%)?|[a-z][\w-]*|[(),+\-*/]/gi) ?? [];
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
    const number = token.match(/^([\d.]+)(px|vh|vw|%)?$/i);
    if (number) {
      const amount = Number(number[1]);
      const unit = (number[2] ?? '').toLowerCase();
      if (unit === 'vh') return (amount / 100) * context.viewport.height;
      if (unit === 'vw') return (amount / 100) * context.viewport.width;
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

describe('touch-landscape layout styles', () => {
  let hud: HUD;
  let radio: RadioComms | null;
  let controls: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-hud-camera');
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
    document.documentElement.removeAttribute('data-hud-camera');
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
