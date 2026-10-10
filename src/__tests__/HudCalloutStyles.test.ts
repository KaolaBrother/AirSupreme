import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HUD } from '@/ui/HUD';
import { HUD_EXTRAS_STYLE_ID, injectHudExtrasStyles } from '@/ui/theme/hudExtrasStyles';

/**
 * 中央播报横幅 #hud-callout 的定位规则（武器批次 W11）。
 * 固定定位的容器若 top 与 bottom 同时被钉住，就会被拉成一整块高的深色底。这里读样式表原文：
 * - 每条针对 #hud-callout 的规则，写了 top / bottom 其一就把另一个写成 auto；
 * - 三种布局密度 × 两种视角下，层叠后的结果只钉住一端；
 * - 容器不把卡片拉高（弹性容器的 align-items 不是 stretch），卡片高度随内容。
 * jsdom 不做布局，也不解析 calc() / env()，所以不用 getComputedStyle，按选择器与优先级自己层叠。
 */

type Density = 'desktop' | 'touch-landscape' | 'touch-portrait';
type Camera = 'third-person' | 'first-person';

interface ParsedRule {
  selectors: string[];
  declarations: Array<{ property: string; value: string; important: boolean }>;
  /** 外层的 @media / @supports 条件；顶层规则为 null */
  condition: string | null;
  order: number;
}

const DENSITIES: readonly Density[] = ['desktop', 'touch-landscape', 'touch-portrait'];
const CAMERAS: readonly Camera[] = ['third-person', 'first-person'];
const VIEWS = DENSITIES.flatMap((density) => CAMERAS.map((camera) => ({ density, camera })));
const FREE_VALUES = new Set(['auto', 'initial', 'unset', 'revert', 'revert-layer']);
/** 弹性 / 网格容器里会把子元素拉满交叉轴的取值 */
const STRETCHING_ALIGNMENTS = new Set(['stretch', 'normal']);

// ---------------------------------------------------------------------------
// 样式表解析
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

function parseDeclarations(body: string): ParsedRule['declarations'] {
  return splitTopLevel(body, (char) => char === ';').flatMap((declaration) => {
    const colon = declaration.indexOf(':');
    if (colon < 0) return [];
    const rawValue = declaration.slice(colon + 1).trim();
    const important = /!\s*important\s*$/i.test(rawValue);
    return [
      {
        property: declaration.slice(0, colon).trim().toLowerCase(),
        value: rawValue
          .replace(/!\s*important\s*$/i, '')
          .trim()
          .toLowerCase(),
        important,
      },
    ];
  });
}

function parseCss(css: string): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const walk = (block: string, condition: string | null): void => {
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
      if (/^@(media|supports|container|layer)\b/i.test(prelude)) {
        walk(body, condition ? `${condition} ${prelude}` : prelude);
      } else if (!prelude.startsWith('@')) {
        rules.push({
          selectors: splitTopLevel(prelude, (char) => char === ','),
          declarations: parseDeclarations(body),
          condition,
          order: rules.length,
        });
      }
      cursor = close;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), null);
  return rules;
}

/** 选择器最右边的复合选择器（规则实际作用的元素） */
function subjectOf(selector: string): string {
  const compounds = splitTopLevel(selector, (char) => /[\s>+~]/.test(char));
  return compounds[compounds.length - 1] ?? '';
}

function targets(selector: string, id: string): boolean {
  return new RegExp(`#${id}(?![\\w-])`).test(subjectOf(selector));
}

function targetsClass(selector: string, className: string): boolean {
  return new RegExp(`\\.${className}(?![\\w-])`).test(subjectOf(selector));
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

/** 规则对纵向两端的声明（inset 简写展开成 top / bottom），后写的覆盖先写的 */
function verticalEdges(rule: ParsedRule): { top?: string; bottom?: string } {
  const edges: { top?: string; bottom?: string } = {};
  for (const { property, value } of rule.declarations) {
    const values = splitTopLevel(value, (char) => /\s/.test(char));
    if (property === 'top' || property === 'inset-block-start') edges.top = value;
    if (property === 'bottom' || property === 'inset-block-end') edges.bottom = value;
    if (property === 'inset') {
      edges.top = values[0];
      edges.bottom = values[2] ?? values[0];
    }
    if (property === 'inset-block') {
      edges.top = values[0];
      edges.bottom = values[1] ?? values[0];
    }
  }
  return edges;
}

function isFree(value: string | undefined): boolean {
  return value === undefined || FREE_VALUES.has(value.trim());
}

function matches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    // 伪元素等 jsdom 不认识的选择器：不作用在元素本身
    return false;
  }
}

/**
 * 层叠：在作用于 element 的规则里，按 !important、优先级、书写顺序取 pick() 给出的值。
 * withConditional 为 true 时把 @media 里的规则也算进来（当作条件成立）。
 */
function cascaded(
  rules: readonly ParsedRule[],
  element: Element,
  pick: (rule: ParsedRule) => { value: string; important: boolean } | undefined,
  withConditional: boolean
): string | undefined {
  let winner: { value: string; rank: [number, number, number] } | undefined;
  for (const rule of rules) {
    if (rule.condition && !withConditional) continue;
    const matching = rule.selectors.filter((selector) => matches(element, selector));
    if (matching.length === 0) continue;
    const picked = pick(rule);
    if (!picked) continue;
    const rank: [number, number, number] = [
      picked.important ? 1 : 0,
      Math.max(...matching.map(specificity)),
      rule.order,
    ];
    const beats =
      !winner ||
      rank[0] > winner.rank[0] ||
      (rank[0] === winner.rank[0] && rank[1] > winner.rank[1]) ||
      (rank[0] === winner.rank[0] && rank[1] === winner.rank[1] && rank[2] > winner.rank[2]);
    if (beats) winner = { value: picked.value, rank };
  }
  return winner?.value;
}

function declared(
  rule: ParsedRule,
  property: string
): { value: string; important: boolean } | undefined {
  const found = rule.declarations.filter((declaration) => declaration.property === property);
  const last = found[found.length - 1];
  return last ? { value: last.value, important: last.important } : undefined;
}

function edge(
  rule: ParsedRule,
  side: 'top' | 'bottom'
): { value: string; important: boolean } | undefined {
  const value = verticalEdges(rule)[side];
  if (value === undefined) return undefined;
  const important = rule.declarations.some(
    (declaration) =>
      declaration.important &&
      [side, 'inset', 'inset-block', `inset-block-${side === 'top' ? 'start' : 'end'}`].includes(
        declaration.property
      )
  );
  return { value, important };
}

// ---------------------------------------------------------------------------
// 被测样式表（模块加载时注入一次，供 it.each 列出规则）
// ---------------------------------------------------------------------------

injectHudExtrasStyles();
const EXTRAS_CSS = document.getElementById(HUD_EXTRAS_STYLE_ID)?.textContent ?? '';
const EXTRAS_RULES = parseCss(EXTRAS_CSS);
const CALLOUT_RULES = EXTRAS_RULES.filter((rule) =>
  rule.selectors.some((selector) => targets(selector, 'hud-callout'))
);
const CARD_RULES = EXTRAS_RULES.filter((rule) =>
  rule.selectors.some((selector) => targetsClass(selector, 'hud-callout-card'))
);

function label(rule: ParsedRule): string {
  const selector = rule.selectors.join(', ');
  return rule.condition ? `${rule.condition} { ${selector} }` : selector;
}

describe('#hud-callout placement styles', () => {
  let hud: HUD;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-hud-camera');
    hud = new HUD();
  });

  afterEach(() => {
    hud.dispose();
    document.documentElement.removeAttribute('data-hud-camera');
    document.body.innerHTML = '';
  });

  /** 真实 HUD 的播报容器，处在给定布局密度与视角下 */
  function calloutIn(density: Density, camera: Camera): HTMLElement {
    hud.setLayoutDensity(density);
    hud.init();
    hud.setLayoutDensity(density);
    hud.setCameraMode(camera);
    hud.showPowerUpBig('⚠️', 'Ally down', 2, true);
    const callout = document.getElementById('hud-callout');
    expect(callout, 'expected #hud-callout in the document').not.toBeNull();
    return callout as HTMLElement;
  }

  /** 文档里全部样式表（HUD 自己注入的都算），防止别处的规则再把横幅钉住 */
  function documentRules(): ParsedRule[] {
    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n');
    return parseCss(css);
  }

  describe('the parsed stylesheet', () => {
    // 防止下面的逐条检查空转：样式表里确实有给横幅定位的规则
    it('contains rules that position #hud-callout', () => {
      expect(EXTRAS_CSS.length).toBeGreaterThan(0);
      const positioning = CALLOUT_RULES.filter((rule) => {
        const edges = verticalEdges(rule);
        return edges.top !== undefined || edges.bottom !== undefined;
      });

      expect(positioning.length).toBeGreaterThan(0);
    });

    // 规则靠 data-layout-density（横幅上）与 data-hud-camera（<html> 上）区分情形：
    // 这些标记必须真由 HUD 写上，否则下面按真实元素做的层叠检查看不到对应规则。
    it('has no callout rule that the real callout never matches', () => {
      const seen = new Set<ParsedRule>();
      for (const { density, camera } of VIEWS) {
        const callout = calloutIn(density, camera);
        for (const rule of CALLOUT_RULES) {
          if (rule.selectors.some((selector) => matches(callout, selector))) seen.add(rule);
        }
      }

      const never = CALLOUT_RULES.filter((rule) => !seen.has(rule)).map(label);
      expect(never).toEqual([]);
    });
  });

  describe('each rule on its own', () => {
    it.each(CALLOUT_RULES.map((rule) => [label(rule), rule] as const))(
      '%s: sets neither edge, or pins one and frees the other with auto',
      (_name, rule) => {
        const { top, bottom } = verticalEdges(rule);
        if (top === undefined && bottom === undefined) return;

        expect(top, 'a rule that sets bottom must set top as well').toBeDefined();
        expect(bottom, 'a rule that sets top must set bottom as well').toBeDefined();
        const pinned = [top, bottom].filter((value) => !isFree(value));
        expect(pinned, `top: ${top}; bottom: ${bottom}`).toHaveLength(1);
        expect([top, bottom]).toContain('auto');
      }
    );

    it.each(CALLOUT_RULES.map((rule) => [label(rule), rule] as const))(
      '%s: does not give the container a viewport-sized height',
      (_name, rule) => {
        for (const property of ['height', 'min-height', 'block-size', 'min-block-size']) {
          const value = declared(rule, property)?.value;
          if (value === undefined) continue;
          expect(value, property).not.toMatch(/\d(%|d?vh|svh|lvh|vmin|vmax)\b/);
        }
      }
    );
  });

  describe('after the cascade', () => {
    it.each(VIEWS)(
      'pins exactly one of top / bottom on $density in $camera view',
      ({ density, camera }) => {
        const callout = calloutIn(density, camera);

        for (const withConditional of [false, true]) {
          const rules = documentRules();
          const top = cascaded(rules, callout, (rule) => edge(rule, 'top'), withConditional);
          const bottom = cascaded(rules, callout, (rule) => edge(rule, 'bottom'), withConditional);
          const pinned = [top, bottom].filter((value) => !isFree(value));

          expect(pinned, `top: ${top}; bottom: ${bottom}`).toHaveLength(1);
        }
      }
    );

    it.each(VIEWS)(
      'is not pinned from the element’s own inline style on $density in $camera view',
      ({ density, camera }) => {
        const callout = calloutIn(density, camera);

        expect(callout.style.position).toBe('fixed');
        expect(callout.style.top).toBe('');
        expect(callout.style.bottom).toBe('');
        expect(callout.style.getPropertyValue('inset')).toBe('');
        expect(callout.style.height).toBe('');
      }
    );

    it.each(DENSITIES)(
      'stays pinned at one end when the view is switched back on %s',
      (density) => {
        calloutIn(density, 'first-person');
        const callout = calloutIn(density, 'third-person');
        const rules = documentRules();

        const top = cascaded(rules, callout, (rule) => edge(rule, 'top'), false);
        const bottom = cascaded(rules, callout, (rule) => edge(rule, 'bottom'), false);

        expect(
          [top, bottom].filter((value) => !isFree(value)),
          `top: ${top}; bottom: ${bottom}`
        ).toHaveLength(1);
      }
    );
  });

  describe('the card keeps its content height', () => {
    it.each(VIEWS)(
      'does not stretch the card across the container on $density in $camera view',
      ({ density, camera }) => {
        const callout = calloutIn(density, camera);
        const rules = documentRules();
        const value = (property: string): string | undefined =>
          cascaded(rules, callout, (rule) => declared(rule, property), true) ??
          (callout.style.getPropertyValue(property) || undefined);

        const display = value('display') ?? 'block';
        if (!/flex|grid/.test(display)) return;
        const direction = value('flex-direction') ?? 'row';
        if (/^column/.test(direction)) return;

        const alignItems = value('align-items') ?? 'normal';
        expect(
          STRETCHING_ALIGNMENTS.has(alignItems),
          `align-items: ${alignItems} would stretch the card to the container height`
        ).toBe(false);
      }
    );

    it('does not make the card stretch or grow by its own rules', () => {
      expect(CARD_RULES.length).toBeGreaterThan(0);

      for (const rule of CARD_RULES) {
        const name = label(rule);
        expect(declared(rule, 'align-self')?.value ?? 'auto', name).not.toBe('stretch');
        expect(declared(rule, 'flex-grow')?.value ?? '0', name).toBe('0');
        expect(declared(rule, 'flex')?.value ?? 'none', name).toMatch(/^(none|initial|0\b.*)$/);
        for (const property of ['height', 'min-height']) {
          const value = declared(rule, property)?.value;
          if (value === undefined) continue;
          expect(value, `${name} ${property}`).not.toMatch(/\d(%|d?vh|svh|lvh|vmin|vmax)\b/);
        }
      }
    });

    it('shows the message inside a card element, not directly in the container', () => {
      const callout = calloutIn('desktop', 'third-person');

      expect(callout.textContent).toContain('Ally down');
      const ownText = Array.from(callout.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join('')
        .trim();
      expect(ownText).toBe('');
      expect(callout.childElementCount).toBeGreaterThan(0);
    });
  });
});
