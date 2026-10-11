import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANDROID_TABLET, restoreDevice, stubDevice, stubViewport } from './deviceTestUtils';
import { installCanvasRecording, type CanvasRecording } from './canvasRecorder';
import { readShippedIndexHtml } from './touchTestUtils';

/**
 * 平板级判定只管运行档（Android 平板性能批次，规格 1 的范围）：触控布局在任何视口下都不变。
 * index.html、radioStyles.ts、hudExtrasStyles.ts 里 700px 的媒体查询和 RadarMinimap 的雷达尺寸
 * 规则与改动前一样，仍然按视口。
 *
 * 这里扮演一台平板级设备（Android 平板，1280×800 屏幕），视口只有 1280×650（浏览器工具栏）：
 * 运行档是平板级（见 TabletTier.test.ts），布局却是手机的——手机尺寸的摇杆与按键簇、84px 的雷达。
 * 模块在扮演设备之后重新加载；注入的样式表（无线电、HUD 附加）也在这台设备上注入后读原文。
 * jsdom 不算媒体查询：这里用一个只认 min/max-width、min/max-height、orientation 与
 * prefers-reduced-motion 的小求值器。
 */

interface Viewport {
  width: number;
  height: number;
}

interface CssRule {
  media: string | null;
  selectors: string[];
  declarations: Map<string, string>;
}

/** 平板级设备、视口被工具栏压到 1280×650 */
const SHORT_TABLET_VIEWPORT: Viewport = { width: 1280, height: 650 };
/** 现有布局测试里的手机横握视口之一（短边 < 700） */
const PHONE_LANDSCAPE_VIEWPORT: Viewport = { width: 1000, height: 699 };

const TABLET_MEDIA = '(min-width: 700px) and (min-height: 700px)';

const PHONE_RADAR_PX = 84;
const TABLET_RADAR_PX = 132;

/** index.html 顶层 :root 上的触控尺寸（手机横握） */
const PHONE_TOUCH_VARIABLES: Record<string, string> = {
  '--touch-stick-size': '108px',
  '--touch-knob-size': '44px',
  '--touch-deck-w': '248px',
  '--touch-deck-h': '228px',
  '--touch-deck-scale': '1',
};

/** 改动前各样式源里含 700px 断点的媒体查询（空白归一后） */
const SHIPPED_700_PX_MEDIA: Record<string, string[]> = {
  'index.html': ['(orientation: portrait) and (max-width: 699.98px)', TABLET_MEDIA],
  radioStyles: [
    '(orientation: portrait) and (max-width: 699.98px)',
    '(orientation: portrait) and (max-width: 699.98px) and (max-height: 665.98px)',
    '(orientation: portrait) and (max-width: 699.98px) and (max-height: 632.98px)',
    '(orientation: portrait) and (max-width: 699.98px) and (max-height: 598.98px)',
    '(orientation: portrait) and (max-width: 699.98px) and (min-height: 728px)',
    '(orientation: portrait) and (max-width: 699.98px) and (min-height: 799px)',
    '(orientation: portrait) and (max-width: 699.98px) and (min-height: 833px)',
    '(orientation: portrait) and (max-width: 699.98px) and (min-height: 867px)',
    '(orientation: landscape) and (max-height: 699.98px)',
    TABLET_MEDIA,
  ],
  hudExtrasStyles: [TABLET_MEDIA],
};

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const name = part.slice(0, colon).trim();
    if (name) {
      declarations.set(name, normalize(part.slice(colon + 1)));
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
    const prelude = normalize(text.slice(index, open));
    let depth = 1;
    let cursor = open + 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === '{') depth++;
      else if (text[cursor] === '}') depth--;
      cursor++;
    }
    const body = text.slice(open + 1, cursor - 1);
    if (prelude.startsWith('@media')) {
      parseCss(body, normalize(prelude.slice('@media'.length)), rules);
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

function pixels(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (!match) {
    throw new Error(`length not understood by this test: ${value}`);
  }
  return Number(match[1]);
}

function featureHolds(feature: string, viewport: Viewport): boolean {
  const match = feature.match(/^\(\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)$/);
  if (!match) {
    throw new Error(`media feature not understood by this test: ${feature}`);
  }
  const [, name, value] = match;
  switch (name) {
    case 'min-width':
      return viewport.width >= pixels(value);
    case 'max-width':
      return viewport.width <= pixels(value);
    case 'min-height':
      return viewport.height >= pixels(value);
    case 'max-height':
      return viewport.height <= pixels(value);
    case 'orientation':
      return value === (viewport.height >= viewport.width ? 'portrait' : 'landscape');
    case 'prefers-reduced-motion':
      return false;
    default:
      throw new Error(`media feature not understood by this test: ${feature}`);
  }
}

function mediaHolds(condition: string, viewport: Viewport): boolean {
  return condition.split(/\s+and\s+/).every((feature) => featureHolds(feature.trim(), viewport));
}

function mediaConditions(rules: readonly CssRule[]): string[] {
  return [...new Set(rules.flatMap((rule) => (rule.media === null ? [] : [rule.media])))];
}

function matchingConditions(rules: readonly CssRule[], viewport: Viewport): string[] {
  return mediaConditions(rules)
    .filter((condition) => mediaHolds(condition, viewport))
    .sort();
}

/** :root 上某个自定义属性在这个视口下的取值：顶层与成立的媒体查询里最后写的那一条 */
function rootVariable(rules: readonly CssRule[], name: string, viewport: Viewport): string | null {
  let value: string | null = null;
  for (const rule of rules) {
    const applies = rule.media === null || mediaHolds(rule.media, viewport);
    if (applies && rule.selectors.includes(':root') && rule.declarations.has(name)) {
      value = rule.declarations.get(name) ?? null;
    }
  }
  return value;
}

function indexHtmlRules(): CssRule[] {
  const html = readShippedIndexHtml();
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  return parseCss(styles.join('\n'));
}

describe('tablet-class is a runtime profile only: the touch layout follows the viewport (Android tablet batch, spec 1)', () => {
  let recording: CanvasRecording;
  const disposers: Array<() => void> = [];

  /** 只有这些样式源里的规则（各自注入后读原文） */
  interface StyleSources {
    'index.html': CssRule[];
    radioStyles: CssRule[];
    hudExtrasStyles: CssRule[];
  }

  /** 扮演平板级设备（视口 1280×650），重新加载布局相关的模块 */
  async function bootShortTablet(): Promise<void> {
    stubDevice({ ...ANDROID_TABLET, viewport: SHORT_TABLET_VIEWPORT });
    vi.resetModules();
    await import('@/config');
  }

  async function injectedStyles(): Promise<StyleSources> {
    const radio = await import('@/ui/theme/radioStyles');
    const extras = await import('@/ui/theme/hudExtrasStyles');
    radio.injectRadioStyles();
    extras.injectHudExtrasStyles();
    const text = (id: string): string => {
      const style = document.getElementById(id);
      expect(style, `#${id} was injected`).not.toBeNull();
      return style?.textContent ?? '';
    };
    return {
      'index.html': indexHtmlRules(),
      radioStyles: parseCss(text(radio.RADIO_STYLE_ID)),
      hudExtrasStyles: parseCss(text(extras.HUD_EXTRAS_STYLE_ID)),
    };
  }

  function radarSize(): number {
    const node = document.getElementById('radar-minimap');
    expect(node, 'a #radar-minimap node').not.toBeNull();
    return pixels((node as HTMLElement).style.width);
  }

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    recording = installCanvasRecording();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
    recording.restore();
    vi.restoreAllMocks();
    restoreDevice();
    vi.resetModules();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  describe('radar', () => {
    it('is phone size (84 px) on a tablet-class device whose viewport is 1280×650', async () => {
      await bootShortTablet();
      const { RadarMinimap } = await import('@/ui/RadarMinimap');
      const radar = new RadarMinimap();
      disposers.push(() => radar.dispose());

      expect(radarSize()).toBe(PHONE_RADAR_PX);
    });

    it('still follows the viewport: 132 px when the same device shows 1280×800, 84 px again at 1280×650', async () => {
      await bootShortTablet();
      const { RadarMinimap } = await import('@/ui/RadarMinimap');
      const radar = new RadarMinimap();
      disposers.push(() => radar.dispose());

      stubViewport(1280, 800);
      window.dispatchEvent(new Event('resize'));
      expect(radarSize()).toBe(TABLET_RADAR_PX);

      stubViewport(SHORT_TABLET_VIEWPORT.width, SHORT_TABLET_VIEWPORT.height);
      window.dispatchEvent(new Event('resize'));
      expect(radarSize()).toBe(PHONE_RADAR_PX);
    });
  });

  describe('HUD', () => {
    it('lays out as touch-landscape, as on any landscape touch viewport', async () => {
      await bootShortTablet();
      const { detectHudLayoutDensity } = await import('@/ui/theme/hudTokens');
      expect(detectHudLayoutDensity()).toBe('touch-landscape');
    });
  });

  describe('touch controls (index.html)', () => {
    it.each(Object.entries(PHONE_TOUCH_VARIABLES))(
      'at 1280×650 %s is the phone value %s',
      async (name, phoneValue) => {
        await bootShortTablet();
        expect(rootVariable(indexHtmlRules(), name, SHORT_TABLET_VIEWPORT)).toBe(phoneValue);
      }
    );

    it('at 1280×650 the stick is smaller than the 150 px tablet stick', async () => {
      await bootShortTablet();
      const rules = indexHtmlRules();
      const stick = rootVariable(rules, '--touch-stick-size', SHORT_TABLET_VIEWPORT);
      expect(stick).not.toBeNull();
      expect(pixels(stick as string)).toBeLessThan(150);
      // 同一个求值器在 1280×800 下给出平板档：它分得清
      expect(rootVariable(rules, '--touch-stick-size', { width: 1280, height: 800 })).toBe('150px');
    });
  });

  describe('the 700 px media queries', () => {
    it('are the ones shipped before, in index.html and both injected stylesheets', async () => {
      await bootShortTablet();
      const sources = await injectedStyles();
      for (const [source, expected] of Object.entries(SHIPPED_700_PX_MEDIA)) {
        const rules = sources[source as keyof StyleSources];
        const found = mediaConditions(rules)
          .filter((condition) => /\b(?:700|699\.98)px\b/.test(condition))
          .sort();
        expect(found, source).toEqual([...expected].sort());
      }
    });

    it('at 1280×650 match exactly what they match on a 1000×699 phone, never the tablet query', async () => {
      await bootShortTablet();
      const sources = await injectedStyles();
      for (const [source, rules] of Object.entries(sources)) {
        const matching = matchingConditions(rules, SHORT_TABLET_VIEWPORT);
        expect(matching, source).not.toContain(TABLET_MEDIA);
        expect(matching, source).toEqual(matchingConditions(rules, PHONE_LANDSCAPE_VIEWPORT));
      }
    });
  });
});
