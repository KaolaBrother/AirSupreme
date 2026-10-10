import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { format, getLocale, setLocale, type Locale, type LocalizedText } from '@/i18n';
import { HUD } from '@/ui/HUD';
import { HUD_COLORS } from '@/ui/theme/hudTokens';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

type SettlementActions = {
  onRetry: () => void;
  onExitToMenu: () => void;
};

type LayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

type HUDLayoutApi = {
  getLayoutDensity?: () => LayoutDensity;
  setLayoutDensity?: (density: LayoutDensity) => void;
};

type BriefingTone = 'sys' | 'threat';

type BriefingRequest = {
  kicker: string;
  title: string;
  line: string;
  tone: BriefingTone;
  durationMs: number;
};

type HUDCampaignApi = HUD & {
  showBriefing: (briefing: BriefingRequest) => void;
  showRespawnOverlay: (overlay: { lives: number; durationMs: number }) => void;
};

type HUDSettlement = HUD & {
  setSettlementActions: (actions: SettlementActions) => void;
};

const LAYOUT_DENSITIES: LayoutDensity[] = ['desktop', 'touch-landscape', 'touch-portrait'];

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** 页面外壳：触控按键簇（#mobile-controls）写在 index.html 里 */
const INDEX_HTML = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');

const FORBIDDEN_LIFE_GLYPHS = /❤️|🖤|♥|❤/u;
const FORBIDDEN_MISSILE_GLYPHS = /🚀|⬜/u;

const VIEWPORTS: Record<LayoutDensity, { width: number; height: number; touch: boolean }> = {
  desktop: { width: 1280, height: 800, touch: false },
  'touch-landscape': { width: 900, height: 400, touch: true },
  'touch-portrait': { width: 400, height: 800, touch: true },
};

const LEVEL_BRIEFINGS: BriefingRequest[] = [
  {
    kicker: '入关',
    title: '湖畔晨曦',
    line: '在湖面上空完成首波接敌',
    tone: 'sys',
    durationMs: 1600,
  },
  {
    kicker: '入关',
    title: '沙漠风暴',
    line: '在热浪中清场',
    tone: 'sys',
    durationMs: 1600,
  },
  {
    kicker: '入关',
    title: '雪山之巅',
    line: '在冰雾里打穿防线',
    tone: 'sys',
    durationMs: 1600,
  },
  {
    kicker: '入关',
    title: '深海决战',
    line: '在洋面上压制敌群',
    tone: 'sys',
    durationMs: 1600,
  },
  {
    kicker: '入关',
    title: '城市废墟',
    line: '最终空域，清场后迎战航母',
    tone: 'sys',
    durationMs: 1600,
  },
];

const BOSS_BRIEFINGS: BriefingRequest[] = [
  {
    kicker: 'BOSS',
    title: '重型轰炸机',
    line: '优先打弹舱弱点',
    tone: 'threat',
    durationMs: 1800,
  },
  {
    kicker: 'BOSS',
    title: '沙漠堡垒',
    line: '防空炮与主炮分区处理',
    tone: 'threat',
    durationMs: 1800,
  },
  {
    kicker: 'BOSS',
    title: '八爪鱼战舰',
    line: '先破触手再打脑核',
    tone: 'threat',
    durationMs: 1800,
  },
  {
    kicker: 'BOSS',
    title: '导弹驱逐舰',
    line: '注意垂发导弹来袭',
    tone: 'threat',
    durationMs: 1800,
  },
  {
    kicker: 'BOSS',
    title: '空中航空母舰',
    line: '甲板与舷岛分区打击',
    tone: 'threat',
    durationMs: 1800,
  },
];

const LIFE_OVERLAY_COPY = /LIFE\s*×\s*(\d+)/u;
const BRIEFING_MAX_WIDTH = /min\(\s*80vw\s*,\s*420px\s*\)/;

/** HUD 自有文案：英文默认，可切换简体中文 */
const SCORE_LABEL: LocalizedText = { en: 'SCORE', zh: '得分' };
const RETRY_LABEL: LocalizedText = { en: 'Play Again', zh: '再来一局' };
const EXIT_LABEL: LocalizedText = { en: 'Main Menu', zh: '返回菜单' };
const FINAL_SCORE_COPY: LocalizedText = { en: 'Final score: {score}', zh: '最终得分: {score}' };
const FAILED_TITLE: LocalizedText = { en: 'MISSION FAILED', zh: '任务失败' };
const COMPLETE_TITLE: LocalizedText = { en: 'MISSION COMPLETE', zh: '任务完成' };

function finalScoreText(score: number, locale: Locale): string {
  return format(textIn(FINAL_SCORE_COPY, locale), { score });
}

function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'zh-CN' : 'en';
}

function settlementHud(hud: HUD): HUDSettlement {
  return hud as HUDSettlement;
}

function layoutHud(hud: HUD): HUDLayoutApi {
  return hud as unknown as HUDLayoutApi;
}

function campaignHud(hud: HUD): HUDCampaignApi {
  return hud as unknown as HUDCampaignApi;
}

function collectRelatedCss(element: HTMLElement): string {
  const chunks: string[] = [];
  let current: HTMLElement | null = element;
  while (current) {
    chunks.push(current.getAttribute('style') ?? '');
    current = current.parentElement;
  }
  for (const style of document.querySelectorAll('style')) {
    chunks.push(style.textContent ?? '');
  }
  return chunks.join('\n');
}

function findLabeledButton(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((button) =>
    (button.textContent ?? '').includes(label)
  );
  expect(match, `expected a <button> labeled "${label}"`).toBeTruthy();
  return match as HTMLButtonElement;
}

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function assertClickableTouchButton(button: HTMLButtonElement): void {
  const computedPointer = getComputedStyle(button).pointerEvents;
  const pointerEvents = computedPointer || button.style.pointerEvents;
  expect(pointerEvents, `${button.textContent} pointer-events`).not.toBe('none');
  expect(button.disabled).toBe(false);

  const computedMin = parsePx(getComputedStyle(button).minHeight);
  const computedHeight = parsePx(getComputedStyle(button).height);
  const inlineMin = parsePx(button.style.minHeight);
  const inlineHeight = parsePx(button.style.height);
  const sized = [computedMin, computedHeight, inlineMin, inlineHeight].find(
    (value): value is number => value != null && value >= 48
  );
  if (sized != null) {
    expect(sized).toBeGreaterThanOrEqual(48);
    return;
  }

  const css = collectRelatedCss(button);
  const declared = [...css.matchAll(/min-height\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((match) =>
    Number(match[1])
  );
  expect(
    declared.some((value) => value >= 48),
    `settlement button "${button.textContent}" height should be at least 48px`
  ).toBe(true);
}

function hasEquivalentPanelWidth(css: string): boolean {
  const normalized = css.replace(/\s+/g, ' ');
  if (/min\(\s*360px\s*,/.test(normalized) && /100%\s*-\s*32px/.test(normalized)) {
    return true;
  }
  return (
    /max-width\s*:\s*360px/.test(normalized) && /calc\(\s*100%\s*-\s*32px\s*\)/.test(normalized)
  );
}

function stubViewport(width: number, height: number, touch: boolean): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  GameConfig.isMobile = touch;
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: touch ? 5 : 0,
  });
  if (touch) {
    window.ontouchstart = () => undefined;
  } else {
    window.ontouchstart = null;
  }
  window.matchMedia = ((query: string): MediaQueryList => {
    const landscape = width > height;
    const matches =
      (query.includes('pointer: coarse') && touch) ||
      (query.includes('pointer: fine') && !touch) ||
      (query.includes('orientation: landscape') && landscape) ||
      (query.includes('orientation: portrait') && !landscape);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
  window.dispatchEvent(new Event('resize'));
}

function createHudFor(density: LayoutDensity): HUD {
  const viewport = VIEWPORTS[density];
  stubViewport(viewport.width, viewport.height, viewport.touch);
  const instance = new HUD();
  const api = layoutHud(instance);
  api.setLayoutDensity?.(density);
  instance.init();
  api.setLayoutDensity?.(density);
  return instance;
}

function readLayoutDensity(instance: HUD): string | null {
  const hudEl = document.getElementById('hud');
  const fromDom =
    hudEl?.getAttribute('data-layout-density') ??
    hudEl?.getAttribute('data-layout') ??
    hudEl?.querySelector('[data-layout-density]')?.getAttribute('data-layout-density') ??
    hudEl?.dataset.layoutDensity ??
    hudEl?.dataset.layout ??
    null;
  if (fromDom && LAYOUT_DENSITIES.includes(fromDom as LayoutDensity)) {
    return fromDom;
  }

  const api = layoutHud(instance);
  const fromApi = api.getLayoutDensity?.() ?? null;
  if (fromApi && LAYOUT_DENSITIES.includes(fromApi)) {
    return fromApi;
  }

  return fromApi ?? fromDom;
}

function geometricPips(root: ParentNode): HTMLElement[] {
  const marked = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-hud-pip], [data-pip], .hud-pip, .hud-life-pip, .hud-missile-pip'
    )
  );
  if (marked.length > 0) {
    return marked;
  }

  return Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) => {
    if (element.childElementCount !== 0) {
      return false;
    }
    const text = (element.textContent ?? '').replace(/\s+/g, '');
    return text.length === 0;
  });
}

function pipHost(mutate: () => void, namedSelector: string): HTMLElement {
  const hudRoot = document.getElementById('hud');
  expect(hudRoot, 'expected #hud in the document').toBeTruthy();
  const before = new Map(
    Array.from(hudRoot!.children).map((child) => [child, child.innerHTML] as const)
  );
  mutate();

  const named = document.querySelector<HTMLElement>(namedSelector);
  if (named) {
    return named;
  }

  const changed = Array.from(hudRoot!.children).filter(
    (child) => before.get(child) !== child.innerHTML
  );
  expect(changed.length, `expected ${namedSelector} or a HUD child to update`).toBeGreaterThan(0);
  return changed[0] as HTMLElement;
}

function currentPipHost(namedSelector: string, fallback: HTMLElement): HTMLElement {
  return document.querySelector<HTMLElement>(namedSelector) ?? fallback;
}

function findCabinPanel(): HTMLElement {
  const label = textIn(SCORE_LABEL, getLocale());
  const score = Array.from(document.querySelectorAll('#hud div')).find((element) =>
    (element.textContent ?? '').startsWith(label)
  );
  expect(score, 'expected the score cabin readout').toBeTruthy();

  let current: HTMLElement | null = score as HTMLElement;
  while (current) {
    const maxWidth = current.style.maxWidth || '';
    if (maxWidth.includes('vw') || /max-width/i.test(current.getAttribute('style') ?? '')) {
      return current;
    }
    current = current.parentElement;
  }

  return (score as HTMLElement).parentElement ?? (score as HTMLElement);
}

function elapseHudTime(instance: HUD, ms: number): void {
  vi.advanceTimersByTime(ms);
  instance.update(ms / 1000);
}

function isEffectivelyHidden(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    const computed = getComputedStyle(current);
    const display = computed.display || current.style.display;
    const visibility = computed.visibility || current.style.visibility;
    const opacityRaw = computed.opacity || current.style.opacity || '1';
    if (display === 'none' || visibility === 'hidden') {
      return true;
    }
    if (Number.parseFloat(opacityRaw) === 0) {
      return true;
    }
    current = current.parentElement;
  }
  return !element.isConnected;
}

function nodesWithText(text: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) =>
    (element.textContent ?? '').includes(text)
  );
}

function copyIsShowing(text: string): boolean {
  return nodesWithText(text).some((element) => !isEffectivelyHidden(element));
}

function smallestNodeWithText(text: string): HTMLElement {
  const matches = nodesWithText(text).sort(
    (a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0)
  );
  expect(matches.length, `expected copy "${text}" in the document`).toBeGreaterThan(0);
  return matches[0] as HTMLElement;
}

function namedBriefingHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '#hud-briefing, [data-hud="briefing"], [data-briefing]'
  );
}

function findBriefingCard(title: string): HTMLElement {
  const named = namedBriefingHost();
  if (named && (named.textContent ?? '').includes(title) && !isEffectivelyHidden(named)) {
    return named;
  }

  const leaf = smallestNodeWithText(title);
  let current: HTMLElement | null = leaf;
  while (current && current !== document.body) {
    const css = `${current.style.maxWidth} ${current.style.width} ${
      current.getAttribute('style') ?? ''
    }`;
    if (
      current.id === 'hud-briefing' ||
      current.getAttribute('data-hud') === 'briefing' ||
      current.hasAttribute('data-briefing') ||
      BRIEFING_MAX_WIDTH.test(css)
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return leaf.parentElement ?? leaf;
}

function briefingChrome(host: HTMLElement): string {
  return `${host.getAttribute('style') ?? ''}\n${collectRelatedCss(host)}`;
}

function collectOwnChrome(element: HTMLElement): string {
  const chunks: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    chunks.push(current.getAttribute('style') ?? '');
    chunks.push(current.className);
    chunks.push(current.getAttribute('data-tone') ?? '');
    chunks.push(current.getAttribute('data-hud-tone') ?? '');
    current = current.parentElement;
  }
  return chunks.join('\n');
}

function briefingToneMarker(host: HTMLElement): string {
  const marked = [
    host.getAttribute('data-tone'),
    host.getAttribute('data-hud-tone'),
    ...Array.from(host.querySelectorAll<HTMLElement>('[data-tone], [data-hud-tone]')).map(
      (element) => element.getAttribute('data-tone') ?? element.getAttribute('data-hud-tone')
    ),
  ].filter((value): value is string => Boolean(value));
  if (marked.includes('threat')) {
    return 'threat';
  }
  if (marked.includes('sys')) {
    return 'sys';
  }

  const classBlob = [
    host.className,
    ...Array.from(host.querySelectorAll('*')).map((el) => el.className),
  ].join(' ');
  if (/\bthreat\b/i.test(classBlob)) {
    return 'threat';
  }
  if (/\bsys\b/i.test(classBlob)) {
    return 'sys';
  }

  const inline = collectOwnChrome(host);
  const threatHit =
    inline.toLowerCase().includes(HUD_COLORS.threat.toLowerCase()) || /--hud-threat/.test(inline);
  const sysHit =
    inline.toLowerCase().includes(HUD_COLORS.sys.toLowerCase()) || /--hud-sys/.test(inline);
  if (threatHit && !sysHit) {
    return 'threat';
  }
  if (sysHit && !threatHit) {
    return 'sys';
  }
  return threatHit ? 'threat' : sysHit ? 'sys' : '';
}

function mountStickAndFire(): void {
  const controls = document.createElement('div');
  controls.id = 'mobile-controls';
  controls.className = 'mobile-controls';
  controls.style.cssText =
    'position:fixed;bottom:0;left:0;width:100%;height:35%;z-index:100;pointer-events:none;';

  const joystick = document.createElement('div');
  joystick.id = 'joystick';
  joystick.style.cssText =
    'position:absolute;bottom:20px;left:20px;width:140px;height:140px;pointer-events:auto;';

  const fire = document.createElement('button');
  fire.id = 'fire-button';
  fire.type = 'button';
  fire.textContent = '开火';
  fire.style.cssText =
    'position:absolute;bottom:20px;right:20px;width:80px;height:80px;pointer-events:auto;';

  controls.appendChild(joystick);
  controls.appendChild(fire);
  document.body.appendChild(controls);
}

function overlayPlacementHost(lifeHost: HTMLElement): HTMLElement {
  let current: HTMLElement | null = lifeHost;
  while (current && current !== document.body) {
    if (current.id === 'hud') {
      return lifeHost;
    }
    const position = current.style.position || getComputedStyle(current).position;
    if (position === 'fixed' || position === 'absolute') {
      return current;
    }
    current = current.parentElement;
  }
  return lifeHost;
}

function effectivePointerEvents(element: HTMLElement): string {
  let current: HTMLElement | null = element;
  while (current && current !== document.documentElement) {
    const value = current.style.pointerEvents || getComputedStyle(current).pointerEvents;
    if (value === 'none' || value === 'auto') {
      return value;
    }
    current = current.parentElement;
  }
  return 'auto';
}

function nearControlEdge(value: string | undefined): boolean {
  return !!value && /^(0|0px|4px|8px|10px|12px|16px|20px|24px|32px)$/i.test(value.trim());
}

function avoidsStickAndFire(host: HTMLElement): boolean {
  const style = `${host.getAttribute('style') ?? ''}\n${collectOwnChrome(host)}`.replace(
    /\s+/g,
    ' '
  );
  const fullBleed =
    (/width\s*:\s*100%/.test(style) && /height\s*:\s*100%/.test(style)) ||
    /inset\s*:\s*0/.test(style);
  if (fullBleed && effectivePointerEvents(host) === 'auto') {
    return false;
  }

  const bottom = style.match(/bottom\s*:\s*([^;]+)/i)?.[1];
  const left = style.match(/left\s*:\s*([^;]+)/i)?.[1];
  const right = style.match(/right\s*:\s*([^;]+)/i)?.[1];
  const top = style.match(/top\s*:\s*([^;]+)/i)?.[1];
  if (nearControlEdge(bottom) && (nearControlEdge(left) || nearControlEdge(right))) {
    return false;
  }
  if (nearControlEdge(bottom) && !top) {
    return false;
  }
  return true;
}

function isLifeCopy(element: HTMLElement): boolean {
  return LIFE_OVERLAY_COPY.test((element.textContent ?? '').replace(/\s+/g, ' '));
}

function visibleLifeNodes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
    (element) => isLifeCopy(element) && !isEffectivelyHidden(element)
  );
}

function findLifeReadout(): HTMLElement {
  const named = document.querySelector<HTMLElement>(
    '#hud-respawn-overlay, [data-hud="respawn"], [data-respawn]'
  );
  const haystack = named ?? document.body;
  const matches = Array.from(haystack.querySelectorAll<HTMLElement>('*')).filter(isLifeCopy);
  const fromNamed = named && isLifeCopy(named) ? named : null;
  const pool = [...matches, ...(fromNamed ? [fromNamed] : [])];
  const visible = pool.filter((element) => !isEffectivelyHidden(element));
  const ranked = (visible.length > 0 ? visible : pool).sort(
    (a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0)
  );
  const readout = ranked[0];
  expect(readout, 'expected a LIFE × N readout').toBeTruthy();
  return readout as HTMLElement;
}

describe('HUD', () => {
  let hud: HUD;
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalMatchMedia: typeof window.matchMedia;
  let originalMaxTouchPoints: number;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMatchMedia = window.matchMedia;
    originalMaxTouchPoints = navigator.maxTouchPoints;
    document.body.innerHTML = '';
    hud = new HUD();
  });

  afterEach(() => {
    vi.useRealTimers();
    hud.dispose();
    resetLocale();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: originalMaxTouchPoints,
    });
    window.matchMedia = originalMatchMedia;
    window.ontouchstart = null;
    document.body.innerHTML = '';
  });

  it('renders lives as geometric pips, not heart emoji, and caps at 5', () => {
    const selector = '#hud-lives, [data-hud="lives"]';
    hud.init();
    const livesHost = pipHost(() => hud.updateLives(7), selector);

    expect(livesHost.textContent ?? '').not.toMatch(FORBIDDEN_LIFE_GLYPHS);
    expect(geometricPips(livesHost).length).toBe(5);

    const atCap = livesHost.innerHTML;
    hud.updateLives(5);
    expect(currentPipHost(selector, livesHost).innerHTML).toBe(atCap);

    hud.updateLives(3);
    const threeHost = currentPipHost(selector, livesHost);
    expect(threeHost.innerHTML).not.toBe(atCap);
    expect(threeHost.textContent ?? '').not.toMatch(FORBIDDEN_LIFE_GLYPHS);
    expect(geometricPips(threeHost).length).toBe(5);

    const atThree = threeHost.innerHTML;
    hud.updateLives(0);
    const zeroHost = currentPipHost(selector, livesHost);
    expect(zeroHost.innerHTML).not.toBe(atThree);
  });

  it('renders missiles as geometric pips, not rocket/empty-square emoji, and caps at MAX_MISSILES', () => {
    const selector = '#hud-missiles, [data-hud="missiles"]';
    const maxMissiles = GAME_CONSTANTS.MISSILE.MAX_MISSILES;
    hud.init();
    const missilesHost = pipHost(() => hud.updateMissiles(maxMissiles + 3), selector);

    expect(missilesHost.textContent ?? '').not.toMatch(FORBIDDEN_MISSILE_GLYPHS);
    expect(geometricPips(missilesHost).length).toBe(maxMissiles);

    const atCap = missilesHost.innerHTML;
    hud.updateMissiles(maxMissiles);
    expect(currentPipHost(selector, missilesHost).innerHTML).toBe(atCap);

    hud.updateMissiles(2);
    const twoHost = currentPipHost(selector, missilesHost);
    expect(twoHost.innerHTML).not.toBe(atCap);
    expect(twoHost.textContent ?? '').not.toMatch(FORBIDDEN_MISSILE_GLYPHS);
    expect(geometricPips(twoHost).length).toBe(maxMissiles);
  });

  // 武器批次 W10：状态列里的生命 / 导弹读数带标签；导弹读数还有余量 n/max 与补给进度条；
  // 触控导弹键显示余量与补给进度。
  describe('labelled lives and missile readouts', () => {
    const MAX_MISSILES = GAME_CONSTANTS.MISSILE.MAX_MISSILES;
    const LIVES_LABEL_EN = 'LIVES';
    const MISSILES_LABEL_EN = 'MSL';
    const HAN = /\p{Script=Han}/u;

    function readout(kind: 'lives' | 'missile'): HTMLElement {
      const element = document.querySelector<HTMLElement>(`#hud [data-hud="${kind}-readout"]`);
      expect(element, `expected a ${kind} readout in the HUD`).not.toBeNull();
      return element as HTMLElement;
    }

    /** 读数里的文字片段（不含 pip），按文档顺序 */
    function textsIn(root: HTMLElement): string[] {
      return Array.from(root.querySelectorAll<HTMLElement>('*'))
        .filter((element) => element.childElementCount === 0)
        .map((element) => (element.textContent ?? '').trim())
        .filter((text) => text.length > 0);
    }

    function litPips(host: HTMLElement): number {
      return geometricPips(host).filter((pip) => pip.getAttribute('data-hud-pip') === 'on').length;
    }

    function reloadBar(): { bar: HTMLElement; fill: HTMLElement } {
      const bar = readout('missile').querySelector<HTMLElement>('[data-hud="missile-reload"]');
      expect(bar, 'expected a reload bar inside the missile readout').not.toBeNull();
      const fill = (bar as HTMLElement).firstElementChild as HTMLElement | null;
      expect(fill, 'expected the reload bar to have a fill').not.toBeNull();
      return { bar: bar as HTMLElement, fill: fill as HTMLElement };
    }

    it('shows lives as LIVES plus the pips', () => {
      hud.init();
      hud.updateLives(3);

      const lives = readout('lives');
      expect(textsIn(lives)).toEqual([LIVES_LABEL_EN]);
      const host = lives.querySelector<HTMLElement>('#hud-lives');
      expect(host, '#hud-lives inside the lives readout').not.toBeNull();
      expect(geometricPips(host as HTMLElement)).toHaveLength(5);
      expect(litPips(host as HTMLElement)).toBe(3);
    });

    it('shows missiles as MSL plus the pips, an n/max count and a reload bar', () => {
      hud.init();
      hud.updateMissiles(2);
      hud.updateMissileProgress(0.4);

      const missiles = readout('missile');
      expect(textsIn(missiles)).toEqual([MISSILES_LABEL_EN, `2/${MAX_MISSILES}`]);
      const host = missiles.querySelector<HTMLElement>('#hud-missiles');
      expect(host, '#hud-missiles inside the missile readout').not.toBeNull();
      expect(geometricPips(host as HTMLElement)).toHaveLength(MAX_MISSILES);
      expect(litPips(host as HTMLElement)).toBe(2);
      expect(reloadBar().fill.style.width).toBe('40%');
    });

    it('puts both readouts in the status column', () => {
      hud.init();

      expect(readout('lives').closest('#hud-status')).not.toBeNull();
      expect(readout('missile').closest('#hud-status')).not.toBeNull();
      expect(readout('lives').contains(readout('missile'))).toBe(false);
    });

    it('keeps #hud-lives and #hud-missiles as the pip hosts, one of each, holding only pips', () => {
      hud.init();
      hud.updateLives(2);
      hud.updateMissiles(4);

      for (const [id, total] of [
        ['hud-lives', 5],
        ['hud-missiles', MAX_MISSILES],
      ] as const) {
        const hosts = document.querySelectorAll<HTMLElement>(`#${id}`);
        expect(hosts, id).toHaveLength(1);
        const pips = geometricPips(hosts[0]);
        expect(pips, id).toHaveLength(total);
        expect(hosts[0].children, id).toHaveLength(total);
        expect((hosts[0].textContent ?? '').trim(), id).toBe('');
      }
      expect(litPips(document.getElementById('hud-lives') as HTMLElement)).toBe(2);
      expect(litPips(document.getElementById('hud-missiles') as HTMLElement)).toBe(4);
    });

    it.each([
      [0, 0],
      [1, 1],
      [3, 3],
      [MAX_MISSILES, MAX_MISSILES],
      [MAX_MISSILES + 4, MAX_MISSILES],
      [-2, 0],
    ])('with %i missiles the count reads %i/max and as many pips are lit', (count, shown) => {
      hud.init();
      hud.updateMissiles(count);

      const missiles = readout('missile');
      expect(textsIn(missiles)).toEqual([MISSILES_LABEL_EN, `${shown}/${MAX_MISSILES}`]);
      expect(litPips(missiles.querySelector<HTMLElement>('#hud-missiles') as HTMLElement)).toBe(
        shown
      );
    });

    it('starts with a count that matches the pips before any update', () => {
      hud.init();

      const missiles = readout('missile');
      const lit = litPips(missiles.querySelector<HTMLElement>('#hud-missiles') as HTMLElement);
      const count = textsIn(missiles)[1] ?? '';
      // 首次 update 之前计数可以留空；有内容时必须和 pip 一致
      if (count !== '') {
        expect(count).toBe(`${lit}/${MAX_MISSILES}`);
      }
    });

    it.each([
      [0, '0%'],
      [0.25, '25%'],
      [0.5, '50%'],
      [1, '100%'],
      [1.7, '100%'],
      [-0.3, '0%'],
    ])('reload progress %s fills the bar to %s', (progress, width) => {
      hud.init();
      hud.updateMissiles(1);
      hud.updateMissileProgress(progress);

      expect(reloadBar().fill.style.width).toBe(width);
    });

    function expectLabelsIn(locale: Locale): void {
      const [livesLabel] = textsIn(readout('lives'));
      const [missilesLabel] = textsIn(readout('missile'));
      if (locale === 'en') {
        expect(livesLabel).toBe(LIVES_LABEL_EN);
        expect(missilesLabel).toBe(MISSILES_LABEL_EN);
      } else {
        expect(livesLabel).toMatch(HAN);
        expect(missilesLabel).toMatch(HAN);
        expect(livesLabel).not.toBe(missilesLabel);
      }
    }

    it.each(LOCALES)('labels both readouts in the interface language (%s)', (locale) => {
      setLocale(locale);
      const instance = new HUD();
      instance.init();
      instance.updateMissiles(3);

      expectLabelsIn(locale);
      expect(textsIn(readout('missile'))[1]).toBe(`3/${MAX_MISSILES}`);
      instance.dispose();
    });

    // FINDING（缺陷）：HUD 在开始菜单阶段就已创建（PresentationRuntimeLoader），进入战斗时才
    // init()。标签只在构造函数里和“init 之后的语言切换”时写入：玩家在开始菜单里切换语言再开局，
    // 生命 / 导弹读数的标签停在创建时的语言（例：界面已是中文，状态列仍显示 LIVES / MSL），
    // 直到下一次切换语言。HUD.init() 已经为结算文案补写过一次（renderSettlementLabels），
    // 状态列标签漏了。修复后去掉 .fails。
    it.fails('uses the language picked in the start menu before the HUD first comes up', () => {
      // hud 在 beforeEach 里以英文创建，尚未 init
      setLocale('zh-CN');
      hud.init();

      expectLabelsIn('zh-CN');
    });

    it('comes up in English again when the language is switched back before the first mission', () => {
      setLocale('zh-CN');
      setLocale('en');
      hud.init();

      expectLabelsIn('en');
    });

    it('re-labels both readouts when the language changes, leaving the numbers alone', () => {
      hud.init();
      hud.updateLives(2);
      hud.updateMissiles(4);
      hud.updateMissileProgress(0.5);
      const livesHtml = (document.getElementById('hud-lives') as HTMLElement).innerHTML;
      const missilesHtml = (document.getElementById('hud-missiles') as HTMLElement).innerHTML;

      setLocale('zh-CN');
      const zhLives = textsIn(readout('lives'));
      const zhMissiles = textsIn(readout('missile'));
      expect(zhLives[0]).toMatch(HAN);
      expect(zhMissiles[0]).toMatch(HAN);
      expect(zhMissiles[1]).toBe(`4/${MAX_MISSILES}`);

      setLocale('en');
      expect(textsIn(readout('lives'))).toEqual([LIVES_LABEL_EN]);
      expect(textsIn(readout('missile'))).toEqual([MISSILES_LABEL_EN, `4/${MAX_MISSILES}`]);
      expect((document.getElementById('hud-lives') as HTMLElement).innerHTML).toBe(livesHtml);
      expect((document.getElementById('hud-missiles') as HTMLElement).innerHTML).toBe(missilesHtml);
      expect(reloadBar().fill.style.width).toBe('50%');
    });

    it.each(LAYOUT_DENSITIES)('keeps the labels, count and reload bar on %s', (density) => {
      const instance = createHudFor(density);
      instance.updateLives(1);
      instance.updateMissiles(5);
      instance.updateMissileProgress(0.75);

      expect(textsIn(readout('lives'))).toEqual([LIVES_LABEL_EN]);
      expect(textsIn(readout('missile'))).toEqual([MISSILES_LABEL_EN, `5/${MAX_MISSILES}`]);
      expect(reloadBar().fill.style.width).toBe('75%');
      instance.dispose();
    });

    describe('touch missile button', () => {
      /** 页面里真实的触控按键簇（index.html），HUD 初始化之前就在文档里 */
      function mountShippedMobileControls(): void {
        const shipped = new DOMParser().parseFromString(INDEX_HTML, 'text/html');
        const controls = shipped.getElementById('mobile-controls');
        expect(controls, '#mobile-controls in index.html').not.toBeNull();
        document.body.appendChild(document.importNode(controls as HTMLElement, true));
      }

      function missileButton(): HTMLElement {
        const button = document.getElementById('missile-button');
        expect(button, '#missile-button in index.html').not.toBeNull();
        return button as HTMLElement;
      }

      function meter(): number {
        const raw = missileButton().style.getPropertyValue('--tc-meter').trim();
        expect(raw, 'expected --tc-meter on #missile-button').not.toBe('');
        return Number(raw);
      }

      function createTouchHud(density: LayoutDensity): HUD {
        mountShippedMobileControls();
        return createHudFor(density);
      }

      it.each(['touch-landscape', 'touch-portrait'] as const)(
        'shows the missile count on the button (%s)',
        (density) => {
          const instance = createTouchHud(density);

          for (const count of [3, 2, 0, MAX_MISSILES]) {
            instance.updateMissiles(count);
            expect(missileButton().getAttribute('data-count')).toBe(String(count));
          }
          instance.updateMissiles(MAX_MISSILES + 2);
          expect(missileButton().getAttribute('data-count')).toBe(String(MAX_MISSILES));
          instance.dispose();
        }
      );

      it('shows the reload progress on the button while a missile is on its way', () => {
        const instance = createTouchHud('touch-landscape');
        instance.updateMissiles(2);

        instance.updateMissileProgress(0);
        expect(meter()).toBe(0);
        instance.updateMissileProgress(0.5);
        expect(meter()).toBeCloseTo(0.5, 2);
        instance.updateMissileProgress(0.9);
        expect(meter()).toBeCloseTo(0.9, 2);
        instance.updateMissileProgress(3);
        expect(meter()).toBeCloseTo(1, 2);
        instance.dispose();
      });

      it('shows the current stock and progress as soon as the HUD comes up', () => {
        const instance = createTouchHud('touch-landscape');
        instance.updateMissiles(1);
        instance.updateMissileProgress(0.3);

        // 换一种触控布局：按键上的读数还在
        layoutHud(instance).setLayoutDensity?.('touch-portrait');

        expect(missileButton().getAttribute('data-count')).toBe('1');
        expect(meter()).toBeCloseTo(0.3, 2);
        instance.dispose();
      });

      it('leaves the button’s own label in place', () => {
        const instance = createTouchHud('touch-landscape');
        const label = (missileButton().textContent ?? '').trim();
        expect(label).not.toBe('');

        instance.updateMissiles(4);
        instance.updateMissileProgress(0.6);

        expect((missileButton().textContent ?? '').trim()).toBe(label);
        instance.dispose();
      });

      it('has styles that draw the count badge and the reload ring from those values', () => {
        const instance = createTouchHud('touch-landscape');
        const css = Array.from(document.querySelectorAll('style'))
          .map((style) => style.textContent ?? '')
          .join('\n');
        const missileRules = [...css.matchAll(/([^{}]*#missile-button[^{}]*)\{([^}]*)\}/g)].map(
          (match) => ({ selector: match[1].trim(), body: match[2] })
        );

        expect(
          missileRules.some(
            (rule) =>
              rule.selector.includes('[data-count]') &&
              /content:\s*attr\(data-count\)/.test(rule.body)
          ),
          'a #missile-button rule that prints data-count'
        ).toBe(true);
        expect(
          missileRules.some((rule) => rule.body.includes('var(--tc-meter')),
          'a #missile-button rule that draws --tc-meter'
        ).toBe(true);
        instance.dispose();
      });
    });
  });

  it('uses layout density desktop | touch-landscape | touch-portrait, not an isMobile-only chrome switch', () => {
    const seen = LAYOUT_DENSITIES.map((density) => {
      const instance = createHudFor(density);
      const value = readLayoutDensity(instance);
      instance.dispose();
      return value;
    });

    expect(seen).toEqual(LAYOUT_DENSITIES);
    expect(new Set(seen).size).toBe(3);
  });

  it('caps the cabin max-width at min(38vw, 180px) in touch-landscape', () => {
    const instance = createHudFor('touch-landscape');
    const cabin = findCabinPanel();
    const css = `${cabin.style.maxWidth}\n${collectRelatedCss(cabin)}`;

    expect(css.replace(/\s+/g, ' ')).toMatch(/min\(\s*38vw\s*,\s*180px\s*\)/);
    instance.dispose();
  });

  it('labels the score readout in the interface language and re-words it live', () => {
    hud.updateScore(1234);
    const readout = (): string => {
      const leaf = Array.from(document.querySelectorAll<HTMLElement>('#hud *')).find(
        (element) =>
          element.childElementCount === 0 && (element.textContent ?? '').endsWith('001234')
      );
      expect(leaf, 'expected the score readout').toBeTruthy();
      return leaf?.textContent ?? '';
    };

    expect(readout()).toBe('SCORE 001234');
    setLocale('zh-CN');
    expect(readout()).toBe('得分 001234');
    setLocale('en');
    expect(readout()).toBe('SCORE 001234');
  });

  it('shows mission completion without reusing the game over title', () => {
    hud.showMissionComplete(20000);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION COMPLETE');
    expect(document.getElementById('final-score')?.textContent).toBe('Final score: 20000');

    hud.hideGameOver();
    hud.showGameOver(0);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION FAILED');
  });

  it('keeps GAME OVER out of the primary failure title', () => {
    hud.showGameOver(900);

    const title = document.getElementById('game-over-title')?.textContent ?? '';
    expect(title).toBe('MISSION FAILED');
    expect(title).not.toContain('GAME OVER');
    expect(document.getElementById('final-score')?.textContent).toBe('Final score: 900');
  });

  function expectSettlementIn(locale: Locale, score: number, title: LocalizedText): void {
    expect(document.getElementById('game-over-title')?.textContent).toBe(textIn(title, locale));
    expect(document.getElementById('final-score')?.textContent).toBe(finalScoreText(score, locale));
    findLabeledButton(textIn(RETRY_LABEL, locale));
    findLabeledButton(textIn(EXIT_LABEL, locale));

    const other = otherLocale(locale);
    const labels = Array.from(document.querySelectorAll('button')).map(
      (button) => button.textContent ?? ''
    );
    expect(labels).not.toContain(textIn(RETRY_LABEL, other));
    expect(labels).not.toContain(textIn(EXIT_LABEL, other));
  }

  it.each(LOCALES)('words the settlement panel in the interface language (%s)', (locale) => {
    // 启动时先应用已保存的语言，再创建 HUD
    setLocale(locale);
    hud.dispose();
    hud = new HUD();
    settlementHud(hud).setSettlementActions({ onRetry: vi.fn(), onExitToMenu: vi.fn() });
    hud.showGameOver(900);
    expectSettlementIn(locale, 900, FAILED_TITLE);

    hud.hideGameOver();
    hud.showMissionComplete(20000);
    expectSettlementIn(locale, 20000, COMPLETE_TITLE);
  });

  /**
   * 运行时顺序：开始菜单显示时 HUD 已创建（PresentationRuntimeLoader），init() 要等点了
   * 开始游戏（GameCoordinator.startInternal → initializeCombatUi）。玩家在开始菜单里切换
   * 语言后，结算面板（标题、得分、按钮）应当使用新语言。
   */
  it('keeps the settlement panel in a language picked before the HUD is initialised', () => {
    setLocale('zh-CN');
    settlementHud(hud).setSettlementActions({ onRetry: vi.fn(), onExitToMenu: vi.fn() });
    hud.showGameOver(900);

    expectSettlementIn('zh-CN', 900, FAILED_TITLE);
  });

  it('re-words an open settlement panel when the language changes', () => {
    const onRetry = vi.fn();
    const onExitToMenu = vi.fn();
    settlementHud(hud).setSettlementActions({ onRetry, onExitToMenu });
    hud.showMissionComplete(20000);
    expectSettlementIn('en', 20000, COMPLETE_TITLE);

    setLocale('zh-CN');
    expectSettlementIn('zh-CN', 20000, COMPLETE_TITLE);
    findLabeledButton(RETRY_LABEL.zh).click();
    findLabeledButton(EXIT_LABEL.zh).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).toHaveBeenCalledTimes(1);

    setLocale('en');
    expectSettlementIn('en', 20000, COMPLETE_TITLE);
  });

  it('re-titles an open failure panel when the language changes', () => {
    hud.showGameOver(440);
    expectSettlementIn('en', 440, FAILED_TITLE);
    setLocale('zh-CN');
    expectSettlementIn('zh-CN', 440, FAILED_TITLE);
    setLocale('en');
    expectSettlementIn('en', 440, FAILED_TITLE);
  });

  it('wires Play Again and Main Menu to HUD settlement callbacks', () => {
    const onRetry = vi.fn();
    const onExitToMenu = vi.fn();
    expect(typeof settlementHud(hud).setSettlementActions).toBe('function');
    settlementHud(hud).setSettlementActions({ onRetry, onExitToMenu });

    hud.showGameOver(12);
    const retry = findLabeledButton(RETRY_LABEL.en);
    const exitToMenu = findLabeledButton(EXIT_LABEL.en);
    assertClickableTouchButton(retry);
    assertClickableTouchButton(exitToMenu);

    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).not.toHaveBeenCalled();

    exitToMenu.click();
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the same settlement actions after mission complete', () => {
    const onRetry = vi.fn();
    const onExitToMenu = vi.fn();
    settlementHud(hud).setSettlementActions({ onRetry, onExitToMenu });

    hud.showMissionComplete(20000);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION COMPLETE');
    findLabeledButton(RETRY_LABEL.en).click();
    findLabeledButton(EXIT_LABEL.en).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
  });

  it('sizes settlement actions for touch and keeps a narrow panel width', () => {
    settlementHud(hud).setSettlementActions({
      onRetry: vi.fn(),
      onExitToMenu: vi.fn(),
    });
    hud.showGameOver(0);

    const retry = findLabeledButton(RETRY_LABEL.en);
    const exitToMenu = findLabeledButton(EXIT_LABEL.en);
    assertClickableTouchButton(retry);
    assertClickableTouchButton(exitToMenu);

    const overlay = document.getElementById('game-over-title')?.parentElement;
    expect(overlay).toBeTruthy();
    const css = `${collectRelatedCss(overlay as HTMLElement)}\n${collectRelatedCss(retry)}`;
    expect(hasEquivalentPanelWidth(css)).toBe(true);
    expect(css).toMatch(/env\(\s*safe-area-inset-/);
  });

  it('shows each level briefing title and line from the issue copy', () => {
    hud.init();

    for (const briefing of LEVEL_BRIEFINGS) {
      campaignHud(hud).showBriefing(briefing);
      const card = findBriefingCard(briefing.title);
      const text = card.textContent ?? '';
      expect(text, `level briefing should include ${briefing.title}`).toContain(briefing.title);
      expect(text, `level briefing should include line for ${briefing.title}`).toContain(
        briefing.line
      );
      expect(copyIsShowing(briefing.title)).toBe(true);
    }
  });

  it('shows each boss briefing title and line from the issue copy', () => {
    hud.init();

    for (const briefing of BOSS_BRIEFINGS) {
      campaignHud(hud).showBriefing(briefing);
      const card = findBriefingCard(briefing.title);
      const text = card.textContent ?? '';
      expect(text, `boss briefing should include ${briefing.title}`).toContain(briefing.title);
      expect(text, `boss briefing should include line for ${briefing.title}`).toContain(
        briefing.line
      );
      expect(text, `boss title should not use BOSS_CONFIGS " Boss" suffix`).not.toMatch(
        new RegExp(`${briefing.title}\\s*Boss`)
      );
      expect(copyIsShowing(briefing.title)).toBe(true);
    }
  });

  it('caps briefing max-width at min(80vw, 420px) and paints sys vs threat tone', () => {
    hud.init();
    const sysBriefing = LEVEL_BRIEFINGS[0];
    campaignHud(hud).showBriefing(sysBriefing);

    const sysCard = findBriefingCard(sysBriefing.title);
    const sysCss = briefingChrome(sysCard).replace(/\s+/g, ' ');
    const sysTone = briefingToneMarker(sysCard);
    expect(sysCss).toMatch(BRIEFING_MAX_WIDTH);
    expect(sysTone).toBe('sys');

    const threatBriefing = BOSS_BRIEFINGS[0];
    campaignHud(hud).showBriefing(threatBriefing);
    const threatCard = findBriefingCard(threatBriefing.title);
    const threatCss = briefingChrome(threatCard).replace(/\s+/g, ' ');
    const threatTone = briefingToneMarker(threatCard);
    expect(threatCss).toMatch(BRIEFING_MAX_WIDTH);
    expect(threatTone).toBe('threat');
    expect(threatTone).not.toBe(sysTone);
  });

  it('replaces the previous briefing instead of stacking cards', () => {
    hud.init();
    campaignHud(hud).showBriefing(LEVEL_BRIEFINGS[0]);
    expect(copyIsShowing('湖畔晨曦')).toBe(true);

    campaignHud(hud).showBriefing(LEVEL_BRIEFINGS[1]);
    expect(copyIsShowing('沙漠风暴')).toBe(true);
    expect(copyIsShowing('湖畔晨曦')).toBe(false);
    expect(copyIsShowing('在湖面上空完成首波接敌')).toBe(false);
    expect(copyIsShowing('在热浪中清场')).toBe(true);
  });

  it('auto-hides a briefing when durationMs elapses', () => {
    vi.useFakeTimers();
    hud.init();
    const briefing = LEVEL_BRIEFINGS[0];
    campaignHud(hud).showBriefing(briefing);

    expect(copyIsShowing(briefing.title)).toBe(true);
    elapseHudTime(hud, 1000);
    expect(copyIsShowing(briefing.title)).toBe(true);

    elapseHudTime(hud, 700);
    expect(copyIsShowing(briefing.title)).toBe(false);
    expect(copyIsShowing(briefing.line)).toBe(false);
  });

  it('shows LIFE × N on a non-game-over respawn overlay away from stick and fire', () => {
    hud.init();
    mountStickAndFire();
    campaignHud(hud).showRespawnOverlay({ lives: 3, durationMs: 2000 });

    const three = findLifeReadout();
    expect((three.textContent ?? '').replace(/\s+/g, ' ')).toMatch(/LIFE\s*×\s*3/);
    expect(three.closest('#hud-settlement-overlay')).toBeNull();
    expect(three.closest('#hud-lives, [data-hud="lives"]')).toBeNull();
    expect(document.getElementById('game-over-title')?.textContent ?? '').not.toContain('LIFE');

    const placement = overlayPlacementHost(three);
    expect(
      avoidsStickAndFire(placement),
      'LIFE × N overlay should not cover or steal the stick/fire deck'
    ).toBe(true);

    const joystick = document.getElementById('joystick');
    const fire = document.getElementById('fire-button');
    expect(joystick, 'joystick should remain mounted').toBeTruthy();
    expect(fire, 'fire button should remain mounted').toBeTruthy();
    const joystickEl = joystick as HTMLElement;
    const fireEl = fire as HTMLElement;
    expect(placement.contains(joystickEl)).toBe(false);
    expect(placement.contains(fireEl)).toBe(false);
    expect(getComputedStyle(joystickEl).display).not.toBe('none');
    expect(getComputedStyle(fireEl).display).not.toBe('none');

    campaignHud(hud).showRespawnOverlay({ lives: 1, durationMs: 2000 });
    const one = findLifeReadout();
    expect((one.textContent ?? '').replace(/\s+/g, ' ')).toMatch(/LIFE\s*×\s*1/);
    expect((one.textContent ?? '').replace(/\s+/g, ' ')).not.toMatch(/LIFE\s*×\s*3/);
  });

  it('auto-hides the LIFE overlay when durationMs elapses', () => {
    vi.useFakeTimers();
    hud.init();
    campaignHud(hud).showRespawnOverlay({ lives: 2, durationMs: 2000 });

    expect(visibleLifeNodes().length, 'LIFE overlay should be visible after show').toBeGreaterThan(
      0
    );
    elapseHudTime(hud, 1500);
    expect(
      visibleLifeNodes().length,
      'LIFE overlay should still be up before durationMs'
    ).toBeGreaterThan(0);

    elapseHudTime(hud, 600);
    expect(visibleLifeNodes().length, 'LIFE overlay should auto-hide after durationMs').toBe(0);
  });

  it('does not show the LIFE overlay on showGameOver', () => {
    hud.init();
    campaignHud(hud).showRespawnOverlay({ lives: 2, durationMs: 2000 });
    expect(visibleLifeNodes().length).toBeGreaterThan(0);

    hud.showGameOver(440);
    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION FAILED');
    expect(visibleLifeNodes().length, 'game over must not keep the LIFE × N overlay').toBe(0);
  });
});
