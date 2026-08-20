import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { HUD } from '@/ui/HUD';

type SettlementActions = {
  onRetry: () => void;
  onExitToMenu: () => void;
};

type LayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

type HUDLayoutApi = {
  getLayoutDensity?: () => LayoutDensity;
  setLayoutDensity?: (density: LayoutDensity) => void;
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

function settlementHud(hud: HUD): HUDSettlement {
  return hud as HUDSettlement;
}

function layoutHud(hud: HUD): HUDLayoutApi {
  return hud as unknown as HUDLayoutApi;
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
});
