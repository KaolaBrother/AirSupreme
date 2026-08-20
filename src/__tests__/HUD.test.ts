import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { HUD } from '@/ui/HUD';
import { HUD_COLORS } from '@/ui/theme/hudTokens';

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

const LAYOUT_DENSITIES: LayoutDensity[] = [
  'desktop',
  'touch-landscape',
  'touch-portrait',
];

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
  const score = Array.from(document.querySelectorAll('#hud div')).find((element) =>
    (element.textContent ?? '').startsWith('得分')
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
    inline.toLowerCase().includes(HUD_COLORS.threat.toLowerCase()) ||
    /--hud-threat/.test(inline);
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

  it('shows mission completion without reusing the game over title', () => {
    hud.showMissionComplete(20000);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION COMPLETE');
    expect(document.getElementById('final-score')?.textContent).toBe('最终得分: 20000');

    hud.hideGameOver();
    hud.showGameOver(0);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION FAILED');
  });

  it('keeps GAME OVER out of the primary failure title', () => {
    hud.showGameOver(900);

    const title = document.getElementById('game-over-title')?.textContent ?? '';
    expect(title).toBe('MISSION FAILED');
    expect(title).not.toContain('GAME OVER');
    expect(document.getElementById('final-score')?.textContent).toBe('最终得分: 900');
  });

  it('wires 再来一局 and 返回菜单 to HUD settlement callbacks', () => {
    const onRetry = vi.fn();
    const onExitToMenu = vi.fn();
    expect(typeof settlementHud(hud).setSettlementActions).toBe('function');
    settlementHud(hud).setSettlementActions({ onRetry, onExitToMenu });

    hud.showGameOver(12);
    const retry = findLabeledButton('再来一局');
    const exitToMenu = findLabeledButton('返回菜单');
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
    findLabeledButton('再来一局').click();
    findLabeledButton('返回菜单').click();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
  });

  it('sizes settlement actions for touch and keeps a narrow panel width', () => {
    settlementHud(hud).setSettlementActions({
      onRetry: vi.fn(),
      onExitToMenu: vi.fn(),
    });
    hud.showGameOver(0);

    const retry = findLabeledButton('再来一局');
    const exitToMenu = findLabeledButton('返回菜单');
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
