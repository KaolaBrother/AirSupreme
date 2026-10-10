import { describe, expect, it } from 'vitest';
import { readShippedIndexHtml } from './touchTestUtils';

/**
 * 触控布局约定（index.html，批次 T）——按文本读取发布版 index.html：
 * - #mobile-controls 里有浮动摇杆的触摸区 #touch-stick-zone；
 * - :root 公布 --touch-stick-zone-top / --touch-stick-zone-width；
 * - 平板媒体查询（min-width: 700px 且 min-height: 700px）把 --touch-stick-size 设为 150px；
 * - 手机上每个 .touch-btn 的尺寸都不小于 44px。
 * jsdom 不为 DOMParser 解析出的文档建立样式表，这里用一个只认“选择器 { 声明 }”和 @media 的小解析器。
 * 末尾的 “checks can fail” 一组把改坏的 index.html 喂给同一套检查，确认它们确实会报错。
 */

/** 规格：触控目标的最小边长（px）与平板摇杆直径 */
const MIN_TOUCH_TARGET_PX = 44;
const TABLET_STICK_SIZE = '150px';

interface CssRule {
  /** 所在 @media 的条件；顶层规则为 null */
  media: string | null;
  selectors: string[];
  declarations: Map<string, string>;
}

interface TouchLayout {
  doc: Document;
  rules: CssRule[];
}

interface ButtonSize {
  id: string;
  /** 'default' 或手机媒体查询的条件 */
  context: string;
  /** 屏幕上的直径：--s × --touch-deck-scale（px） */
  size: number;
}

function parseDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const name = part.slice(0, colon).trim();
    const value = part
      .slice(colon + 1)
      .trim()
      .replace(/\s+/g, ' ');
    if (name) {
      declarations.set(name, value);
    }
  }
  return declarations;
}

function parseCss(css: string, media: string | null = null, rules: CssRule[] = []): CssRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('{', index);
    if (open === -1) {
      break;
    }
    const prelude = text.slice(index, open).trim().replace(/\s+/g, ' ');
    let depth = 1;
    let cursor = open + 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === '{') depth++;
      else if (text[cursor] === '}') depth--;
      cursor++;
    }
    const body = text.slice(open + 1, cursor - 1);
    if (prelude.startsWith('@media')) {
      parseCss(body, prelude.slice('@media'.length).trim(), rules);
    } else if (!prelude.startsWith('@')) {
      rules.push({
        media,
        selectors: prelude.split(',').map((selector) => selector.trim()),
        declarations: parseDeclarations(body),
      });
    }
    index = cursor;
  }
  return rules;
}

function readLayout(html: string): TouchLayout {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  return {
    doc: new DOMParser().parseFromString(html, 'text/html'),
    rules: parseCss(styles.join('\n')),
  };
}

/** 平板档：同一条媒体查询里同时要求 min-width: 700px 和 min-height: 700px（即短边 ≥ 700） */
function isTabletMedia(media: string | null): boolean {
  return (
    media !== null &&
    /\(\s*min-width\s*:\s*700px\s*\)/.test(media) &&
    /\(\s*min-height\s*:\s*700px\s*\)/.test(media)
  );
}

function pixels(value: string | undefined): number | null {
  const match = value?.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

/** 后写的规则覆盖先写的：取满足条件的最后一条声明 */
function lastDeclaration(
  rules: CssRule[],
  matches: (rule: CssRule) => boolean,
  property: string
): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (matches(rule) && rule.declarations.has(property)) {
      value = rule.declarations.get(property);
    }
  }
  return value;
}

function hasStickZoneInControls(layout: TouchLayout): boolean {
  return layout.doc.querySelector('#mobile-controls #touch-stick-zone') !== null;
}

/** 顶层 :root 上公布的自定义属性 */
function publishedOnRoot(layout: TouchLayout, name: string): string | undefined {
  return lastDeclaration(
    layout.rules,
    (rule) => rule.media === null && rule.selectors.includes(':root'),
    name
  );
}

/** 平板媒体查询里 :root 上的 --touch-stick-size */
function tabletStickSize(layout: TouchLayout): string | undefined {
  return lastDeclaration(
    layout.rules,
    (rule) => isTabletMedia(rule.media) && rule.selectors.includes(':root'),
    '--touch-stick-size'
  );
}

function touchButtonIds(layout: TouchLayout): string[] {
  return Array.from(layout.doc.querySelectorAll('#mobile-controls .touch-btn')).map(
    (button) => button.id
  );
}

/** 选择器是否直接选中按键本身（不含后代、伪元素），且以给定的简单选择器开头 */
function targetsElement(selector: string, base: string): boolean {
  if (/\s|>|\+|~|::/.test(selector)) {
    return false;
  }
  if (!selector.startsWith(base)) {
    return false;
  }
  const rest = selector.slice(base.length);
  return rest === '' || /^[.:[]/.test(rest);
}

function targetsButton(rule: CssRule, id: string): boolean {
  return rule.selectors.some((selector) => targetsElement(selector, `#${id}`));
}

function targetsEveryButton(rule: CssRule): boolean {
  return rule.selectors.some((selector) => targetsElement(selector, '.touch-btn'));
}

/** 手机用到的上下文：顶层规则，加上每一条不是平板档、却改了按键尺寸或按键簇缩放的媒体查询 */
function phoneContexts(layout: TouchLayout): Array<string | null> {
  const ids = touchButtonIds(layout);
  const contexts: Array<string | null> = [null];
  for (const rule of layout.rules) {
    if (rule.media === null || isTabletMedia(rule.media) || contexts.includes(rule.media)) {
      continue;
    }
    const resizesButton =
      (targetsEveryButton(rule) || ids.some((id) => targetsButton(rule, id))) &&
      ['--s', 'width', 'height'].some((property) => rule.declarations.has(property));
    const rescalesDeck =
      rule.selectors.includes(':root') && rule.declarations.has('--touch-deck-scale');
    if (resizesButton || rescalesDeck) {
      contexts.push(rule.media);
    }
  }
  return contexts;
}

/** 每个按键在每个手机上下文里的屏幕直径 */
function phoneButtonSizes(layout: TouchLayout): ButtonSize[] {
  const sizes: ButtonSize[] = [];
  for (const context of phoneContexts(layout)) {
    const applies = (rule: CssRule): boolean => rule.media === null || rule.media === context;
    const scale = Number(
      lastDeclaration(
        layout.rules,
        (rule) => applies(rule) && rule.selectors.includes(':root'),
        '--touch-deck-scale'
      ) ?? '1'
    );
    for (const id of touchButtonIds(layout)) {
      const declared =
        lastDeclaration(layout.rules, (rule) => applies(rule) && targetsButton(rule, id), '--s') ??
        lastDeclaration(layout.rules, (rule) => applies(rule) && targetsEveryButton(rule), '--s');
      sizes.push({
        id,
        context: context ?? 'default',
        size: (pixels(declared) ?? Number.NaN) * scale,
      });
    }
  }
  return sizes;
}

/** 手机上小于 44px 的按键尺寸（声明值和算上缩放后的屏幕直径都查）；合规时为空 */
function phoneButtonViolations(layout: TouchLayout): string[] {
  const ids = touchButtonIds(layout);
  const violations: string[] = [];

  for (const rule of layout.rules) {
    if (isTabletMedia(rule.media)) {
      continue;
    }
    if (!targetsEveryButton(rule) && !ids.some((id) => targetsButton(rule, id))) {
      continue;
    }
    for (const property of ['--s', 'width', 'height', 'min-width', 'min-height']) {
      const declared = pixels(rule.declarations.get(property));
      if (declared !== null && declared < MIN_TOUCH_TARGET_PX) {
        violations.push(
          `${rule.selectors.join(', ')} { ${property}: ${declared}px } in ${rule.media ?? 'default'}`
        );
      }
    }
  }

  for (const { id, context, size } of phoneButtonSizes(layout)) {
    if (!(size >= MIN_TOUCH_TARGET_PX)) {
      violations.push(`#${id} is ${size}px on screen in ${context}`);
    }
  }
  return violations;
}

function hasRuleFor(layout: TouchLayout, selector: string): boolean {
  return layout.rules.some((rule) => rule.selectors.includes(selector));
}

/** 在样式表末尾追加一段 CSS（后写的规则生效） */
function withExtraCss(html: string, css: string): string {
  const mutated = html.replace('</style>', `${css}\n</style>`);
  expect(mutated, 'the stylesheet was extended').not.toBe(html);
  return mutated;
}

function withReplacement(html: string, pattern: RegExp, replacement: string): string {
  const mutated = html.replace(pattern, replacement);
  expect(mutated, `the mutation ${pattern} applied`).not.toBe(html);
  return mutated;
}

describe('touch layout contract (index.html)', () => {
  const html = readShippedIndexHtml();
  const layout = readLayout(html);

  it('parses the shipped stylesheet', () => {
    expect(layout.rules.length).toBeGreaterThan(20);
    expect(hasRuleFor(layout, '.touch-btn')).toBe(true);
    expect(hasRuleFor(layout, '#touch-stick-zone')).toBe(true);
  });

  describe('stick zone', () => {
    it('#touch-stick-zone exists inside #mobile-controls', () => {
      expect(hasStickZoneInControls(layout)).toBe(true);
      expect(layout.doc.querySelectorAll('#touch-stick-zone').length).toBe(1);
    });

    it('the stick and the button cluster are still inside #mobile-controls', () => {
      expect(layout.doc.querySelector('#mobile-controls #joystick #joystick-knob')).not.toBeNull();
      expect(layout.doc.querySelector('#mobile-controls #throttle-button')).not.toBeNull();
    });

    it.each(['--touch-stick-zone-top', '--touch-stick-zone-width'])(
      ':root publishes %s',
      (name) => {
        const value = publishedOnRoot(layout, name);
        expect(value, `${name} on the top-level :root`).toBeTruthy();
        expect(value).toMatch(/\d/);
      }
    );

    it('#touch-stick-zone is laid out from the published variables', () => {
      const zone = (property: string): string | undefined =>
        lastDeclaration(
          layout.rules,
          (rule) => rule.media === null && rule.selectors.includes('#touch-stick-zone'),
          property
        );
      expect(zone('top')).toContain('var(--touch-stick-zone-top)');
      expect(zone('width')).toContain('var(--touch-stick-zone-width)');
    });

    it('#touch-stick-zone takes touches although its container lets them through', () => {
      const containerEvents = lastDeclaration(
        layout.rules,
        (rule) => rule.media === null && rule.selectors.includes('.mobile-controls'),
        'pointer-events'
      );
      const zoneEvents = lastDeclaration(
        layout.rules,
        (rule) => rule.media === null && rule.selectors.includes('#touch-stick-zone'),
        'pointer-events'
      );
      if (containerEvents === 'none') {
        expect(zoneEvents).toBe('auto');
      } else {
        expect(zoneEvents).not.toBe('none');
      }
    });
  });

  describe('tablet tier', () => {
    it('has a media query on both min-width: 700px and min-height: 700px', () => {
      const tabletRules = layout.rules.filter((rule) => isTabletMedia(rule.media));
      expect(tabletRules.length).toBeGreaterThan(0);
    });

    it('the tablet media query sets --touch-stick-size to 150px', () => {
      expect(tabletStickSize(layout)).toBe(TABLET_STICK_SIZE);
    });

    it('phones keep a smaller stick than tablets', () => {
      const phone = pixels(publishedOnRoot(layout, '--touch-stick-size'));
      expect(phone).not.toBeNull();
      expect(phone as number).toBeGreaterThan(0);
      expect(phone as number).toBeLessThan(150);
    });
  });

  describe('button sizes on phones', () => {
    it('finds the eight touch buttons', () => {
      expect(touchButtonIds(layout).sort()).toEqual(
        [
          'camera-button',
          'cycle-button',
          'fire-button',
          'flare-button',
          'missile-button',
          'special-button',
          'throttle-button',
          'upgrade-button',
        ].sort()
      );
    });

    it('.touch-btn takes its width and height from --s', () => {
      const base = (property: string): string | undefined =>
        lastDeclaration(
          layout.rules,
          (rule) => rule.media === null && rule.selectors.includes('.touch-btn'),
          property
        );
      expect(base('width')).toBe('var(--s)');
      expect(base('height')).toBe('var(--s)');
      expect(pixels(base('--s'))).not.toBeNull();
    });

    it('resolves a size for every button in every phone layout', () => {
      const sizes = phoneButtonSizes(layout);
      const contexts = new Set(sizes.map((entry) => entry.context));
      expect(contexts.has('default')).toBe(true);
      expect(sizes.length).toBe(touchButtonIds(layout).length * contexts.size);
      for (const { id, context, size } of sizes) {
        expect(Number.isFinite(size), `#${id} in ${context}`).toBe(true);
      }
    });

    it('covers the phone portrait layout as well as the default one', () => {
      const contexts = new Set(phoneButtonSizes(layout).map((entry) => entry.context));
      expect([...contexts].some((context) => /orientation\s*:\s*portrait/.test(context))).toBe(
        true
      );
    });

    it('every .touch-btn size declared for phones is at least 44px', () => {
      expect(phoneButtonViolations(layout)).toEqual([]);
    });

    it.each(['camera-button', 'upgrade-button', 'cycle-button'])(
      'the smallest buttons are not below 44px: #%s',
      (id) => {
        const sizes = phoneButtonSizes(layout).filter((entry) => entry.id === id);
        expect(sizes.length).toBeGreaterThan(0);
        for (const { context, size } of sizes) {
          expect(size, `#${id} in ${context}`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
        }
      }
    );
  });

  describe('states written by InputHandler', () => {
    it('BOOST ships unlatched and announces its state', () => {
      const boost = layout.doc.getElementById('throttle-button');
      expect(boost?.getAttribute('aria-pressed')).toBe('false');
      expect(boost?.classList.contains('is-active')).toBe(false);
    });

    it('the latched BOOST (.is-active) and a held button (.is-pressed) are styled', () => {
      expect(hasRuleFor(layout, '#throttle-button.is-active')).toBe(true);
      expect(hasRuleFor(layout, '.touch-btn.is-pressed')).toBe(true);
    });
  });

  describe('checks can fail', () => {
    it('a page without #touch-stick-zone is rejected', () => {
      const broken = withReplacement(html, /<div id="touch-stick-zone"[^>]*><\/div>/, '');
      expect(hasStickZoneInControls(readLayout(broken))).toBe(false);
    });

    it('a stick zone outside #mobile-controls is rejected', () => {
      const moved = withReplacement(
        withReplacement(html, /<div id="touch-stick-zone"[^>]*><\/div>/, ''),
        /<div id="loading-screen">/,
        '<div id="touch-stick-zone"></div><div id="loading-screen">'
      );
      const movedLayout = readLayout(moved);
      expect(movedLayout.doc.getElementById('touch-stick-zone')).not.toBeNull();
      expect(hasStickZoneInControls(movedLayout)).toBe(false);
    });

    it.each(['--touch-stick-zone-top', '--touch-stick-zone-width'])(
      'a :root that only sets %s inside a media query does not publish it',
      (name) => {
        const pattern = new RegExp(`${name}\\s*:[^;]*;`);
        const moved = withExtraCss(
          withReplacement(html, pattern, ''),
          `@media (orientation: landscape) { :root { ${name}: 10px; } }`
        );
        expect(publishedOnRoot(readLayout(moved), name)).toBeUndefined();
      }
    );

    it('a tablet query with another stick size is rejected', () => {
      const changed = withReplacement(
        html,
        /(min-height:\s*700px\)\s*\{\s*:root\s*\{\s*--touch-stick-size:\s*)\d+px/,
        '$1140px'
      );
      expect(tabletStickSize(readLayout(changed))).toBe('140px');
    });

    it('a query on min-width alone is not the tablet tier', () => {
      expect(isTabletMedia('(min-width: 700px)')).toBe(false);
      expect(isTabletMedia('(min-height: 700px)')).toBe(false);
      expect(isTabletMedia('(min-width: 768px) and (min-height: 700px)')).toBe(false);
      expect(isTabletMedia('(min-width: 700px) and (min-height: 700px)')).toBe(true);
      expect(isTabletMedia('(min-height:700px) and (min-width:700px)')).toBe(true);
    });

    it('a 40px button in the default layout is reported', () => {
      const shrunk = withReplacement(html, /(#camera-button\s*\{[^}]*?--s:\s*)\d+px/, '$140px');
      const violations = phoneButtonViolations(readLayout(shrunk));
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.join('\n')).toContain('#camera-button');
    });

    it('a 36px button in the phone portrait layout is reported', () => {
      const shrunk = withExtraCss(
        html,
        '@media (orientation: portrait) and (max-width: 699.98px) { #upgrade-button { --s: 36px; } }'
      );
      const violations = phoneButtonViolations(readLayout(shrunk));
      expect(violations.join('\n')).toContain('#upgrade-button');
      expect(violations.join('\n')).toContain('portrait');
    });

    it('a small default size for all buttons is reported', () => {
      const shrunk = withExtraCss(html, '.touch-btn { --s: 30px; }');
      expect(phoneButtonViolations(readLayout(shrunk)).length).toBeGreaterThan(0);
    });

    it('a fixed width under 44px on a button is reported', () => {
      const shrunk = withExtraCss(html, '#flare-button.is-pressed { width: 38px; }');
      expect(phoneButtonViolations(readLayout(shrunk)).join('\n')).toContain('#flare-button');
    });

    it('a deck scale below 1 on phones is reported even though the declared sizes are fine', () => {
      const scaled = withExtraCss(html, ':root { --touch-deck-scale: 0.8; }');
      const violations = phoneButtonViolations(readLayout(scaled));
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.join('\n')).toContain('on screen');
    });

    it('sizes inside the tablet query, a label inside a button and its ::after light are not phone button sizes', () => {
      const tabletOnly = withExtraCss(
        html,
        [
          '@media (min-width: 700px) and (min-height: 700px) { #upgrade-button { --s: 40px; } }',
          '#throttle-button::after { width: 16px; height: 3px; }',
          '#special-button .tc-main { width: 20px; }',
        ].join('\n')
      );
      expect(phoneButtonViolations(readLayout(tabletOnly))).toEqual(phoneButtonViolations(layout));
    });
  });
});
