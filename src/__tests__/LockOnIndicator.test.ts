import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameConfig } from '@/config';
import { LockOnIndicator } from '@/ui/LockOnIndicator';

type LayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

type LockOnLayoutApi = LockOnIndicator & {
  getLayoutDensity?: () => LayoutDensity;
  setLayoutDensity?: (density: LayoutDensity) => void;
  getLockState?: () => string;
  hide?: () => void;
  show?: () => void;
  setPaused?: (paused: boolean) => void;
};

const MINT_LOCK = /#5cffb0|var\(\s*--hud-lock\s*\)|rgb\(\s*92\s*,\s*255\s*,\s*176\s*\)/i;
const LIME_LOCK = /#00ff00|#00ff00ff|#0f0\b|rgb\(\s*0\s*,\s*255\s*,\s*0\s*\)|rgba\(\s*0\s*,\s*255\s*,\s*0/i;
const YELLOW_SEARCH_FILL =
  /rgba\(\s*255\s*,\s*200\s*,\s*0|rgb\(\s*255\s*,\s*200\s*,\s*0|#ffc800|#ffcc00|#ffc000|yellow/i;
const BREAK_TREATMENT =
  /break|threat|lost|--hud-break|--hud-threat|--hud-danger|#e11d48|#be123c|#ff2d55|#cc2244|#b91c1c|crimson/i;

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

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
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

function layoutApi(indicator: LockOnIndicator): LockOnLayoutApi {
  return indicator as LockOnLayoutApi;
}

function maybeHidePipper(indicator: LockOnIndicator): boolean {
  const api = layoutApi(indicator);
  if (typeof api.hide === 'function') {
    api.hide();
    return true;
  }
  if (typeof api.setPaused === 'function') {
    api.setPaused(true);
    return true;
  }
  return false;
}

function createIndicator(density: LayoutDensity): LockOnIndicator {
  const viewport =
    density === 'desktop'
      ? { width: 1280, height: 800, touch: false }
      : density === 'touch-landscape'
        ? { width: 900, height: 400, touch: true }
        : { width: 400, height: 800, touch: true };
  stubViewport(viewport.width, viewport.height, viewport.touch);
  const created = new LockOnIndicator();
  layoutApi(created).setLayoutDensity?.(density);
  return created;
}

function lockRoot(): HTMLElement {
  const root = document.getElementById('lock-on-indicator');
  expect(root, 'expected #lock-on-indicator in the document').toBeTruthy();
  return root as HTMLElement;
}

function circleElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) => {
    const radius = element.style.borderRadius;
    return radius === '50%' || radius === '50';
  });
}

function isDisplayed(element: HTMLElement): boolean {
  return (
    element.style.display !== 'none' &&
    element.style.visibility !== 'hidden' &&
    element.style.opacity !== '0'
  );
}

function searchRing(root: HTMLElement = lockRoot()): HTMLElement {
  const visible = circleElements(root).filter(isDisplayed);
  expect(visible.length, 'expected a visible search ring').toBeGreaterThanOrEqual(1);
  return visible.slice().sort((a, b) => {
    return (parsePx(b.style.width) ?? 0) - (parsePx(a.style.width) ?? 0);
  })[0];
}

function pipper(root: HTMLElement = lockRoot()): HTMLElement {
  const ring = searchRing(root);
  const others = circleElements(root).filter((element) => element !== ring && isDisplayed(element));
  expect(others.length, 'expected a visible pipper distinct from the search ring').toBeGreaterThan(
    0
  );
  return others.slice().sort((a, b) => {
    return (parsePx(a.style.width) ?? 0) - (parsePx(b.style.width) ?? 0);
  })[0];
}

function fillCss(element: HTMLElement): string {
  return [
    element.style.background,
    element.style.backgroundColor,
    element.getAttribute('style') ?? '',
  ].join(' ');
}

function isHollowFill(css: string): boolean {
  const normalized = css.toLowerCase().replace(/\s+/g, '');
  if (!normalized) {
    return true;
  }
  if (normalized.includes('transparent') || /background(?:-color)?:none/.test(normalized)) {
    return true;
  }
  if (/rgba\([^)]+,0(?:\.0+)?\)/.test(css.toLowerCase())) {
    return true;
  }
  return false;
}

function chromeCss(root: HTMLElement): string {
  const inline = circleElements(root)
    .map((element) => element.getAttribute('style') ?? '')
    .join('\n');
  return `${inline}\n${collectRelatedCss(root)}\n${root.innerHTML}`;
}

function expectedSearchRingSize(density: LayoutDensity, scale = 1): number {
  const minSide = Math.min(window.innerWidth, window.innerHeight);
  if (density === 'desktop') {
    return minSide * 0.22 * scale;
  }
  if (density === 'touch-landscape') {
    return Math.min(minSide * 0.18, 180) * scale;
  }
  return Math.min(minSide * 0.16, 160) * scale;
}

function createLockRig(offsetX = 0): {
  camera: THREE.PerspectiveCamera;
  enemy: THREE.Object3D;
  playerPos: THREE.Vector3;
} {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / Math.max(window.innerHeight, 1),
    0.1,
    5000
  );
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const enemy = new THREE.Object3D();
  enemy.position.set(offsetX, 0, -40);
  enemy.updateMatrixWorld(true);

  return {
    camera,
    enemy,
    playerPos: new THREE.Vector3(0, 0, 0),
  };
}

function acquireTarget(
  indicator: LockOnIndicator,
  rig: ReturnType<typeof createLockRig>,
  lockTime = 0.5
): void {
  indicator.setLockTime(lockTime);
  indicator.startLockOn();
  for (let i = 0; i < 6 && indicator.getLockProgress() <= 0; i += 1) {
    track(indicator, rig, 0.2);
  }
}

function track(
  indicator: LockOnIndicator,
  rig: ReturnType<typeof createLockRig>,
  deltaTime: number
): boolean {
  rig.enemy.updateMatrixWorld(true);
  rig.camera.updateMatrixWorld(true);
  return indicator.update(rig.playerPos, [rig.enemy], rig.camera, deltaTime, null);
}

function driveLockComplete(
  indicator: LockOnIndicator,
  rig: ReturnType<typeof createLockRig>
): boolean {
  acquireTarget(indicator, rig, 0.5);
  let completed = indicator.getLockProgress() >= 1;
  for (let i = 0; i < 10 && !completed; i += 1) {
    completed = track(indicator, rig, 0.2);
  }
  return completed;
}

function readLockState(indicator: LockOnIndicator, root: HTMLElement): string | null {
  const fromDom =
    root.getAttribute('data-lock-state') ??
    root.getAttribute('data-state') ??
    root.dataset.lockState ??
    root.dataset.state ??
    root.querySelector('[data-lock-state]')?.getAttribute('data-lock-state') ??
    null;
  return layoutApi(indicator).getLockState?.() ?? fromDom;
}

function hasBreakTreatment(indicator: LockOnIndicator, root: HTMLElement): boolean {
  const state = readLockState(indicator, root) ?? '';
  if (BREAK_TREATMENT.test(state)) {
    return true;
  }
  if ([...root.classList].some((className) => BREAK_TREATMENT.test(className))) {
    return true;
  }
  return BREAK_TREATMENT.test(chromeCss(root));
}

function noMissileLabel(root: HTMLElement): HTMLElement {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  const match = nodes
    .filter((element) => {
      const text = (element.textContent ?? '').trim();
      return text === 'NO MSL' || text === 'NO MISSILE' || /\bNO MSL\b/.test(text);
    })
    .sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)[0];
  expect(match, 'expected a NO MSL / NO MISSILE label node').toBeTruthy();
  return match as HTMLElement;
}

function avoidsControlDeck(element: HTMLElement): boolean {
  const deckTop = window.innerHeight * 0.65;
  const top = element.style.top;
  const bottom = element.style.bottom;

  if (bottom.endsWith('%')) {
    return parseFloat(bottom) >= 35;
  }
  const bottomPx = parsePx(bottom);
  if (bottomPx != null) {
    return bottomPx >= window.innerHeight * 0.35 - 1;
  }
  if (top.endsWith('%')) {
    return parseFloat(top) <= 65;
  }
  const topPx = parsePx(top);
  if (topPx != null) {
    return topPx <= deckTop;
  }
  return !/bottom\s*:\s*0/.test(element.getAttribute('style') ?? '');
}

describe('LockOnIndicator', () => {
  let indicator: LockOnIndicator;
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
    stubViewport(1280, 800, false);
    indicator = new LockOnIndicator();
  });

  afterEach(() => {
    indicator.dispose();
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

  it('startLockOn draws a hollow search ring, not a filled yellow disk', () => {
    indicator.startLockOn();

    const root = lockRoot();
    const ring = searchRing(root);
    const fill = fillCss(ring);
    const size = parsePx(ring.style.width);

    const borderMatch = ring.style.border.trim().match(/^(\d+(?:\.\d+)?)px/i);
    const borderWidth = parsePx(ring.style.borderWidth) ?? (borderMatch ? Number(borderMatch[1]) : 0);

    expect(size).toBeGreaterThan(0);
    expect(ring.style.height).toBe(ring.style.width);
    expect(YELLOW_SEARCH_FILL.test(fill)).toBe(false);
    expect(isHollowFill(fill)).toBe(true);
    expect(borderWidth).toBeGreaterThan(0);
  });

  it('lock-complete color uses mint --hud-lock / #5CFFB0 instead of #00ff00', () => {
    const rig = createLockRig();
    const completed = driveLockComplete(indicator, rig);

    expect(completed).toBe(true);
    expect(indicator.getLockProgress()).toBeGreaterThanOrEqual(1);

    const css = chromeCss(lockRoot());
    expect(css).toMatch(MINT_LOCK);
    expect(css).not.toMatch(LIME_LOCK);

    const sight = pipper();
    if (maybeHidePipper(indicator)) {
      expect(isDisplayed(sight)).toBe(false);
    }
  });

  it('setNoMissiles shows NO MSL, not NO MISSILE, and keeps the label off the control deck', () => {
    indicator.dispose();
    indicator = createIndicator('touch-landscape');
    const deck = document.createElement('div');
    deck.id = 'mobile-controls';
    deck.className = 'mobile-controls';
    deck.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:35%;';
    document.body.appendChild(deck);

    indicator.setNoMissiles(true);

    const root = lockRoot();
    const text = root.textContent ?? '';
    expect(text).toContain('NO MSL');
    expect(text).not.toContain('NO MISSILE');

    const label = noMissileLabel(root);
    expect(isDisplayed(label) || label.style.opacity === '1' || label.style.display === 'block').toBe(
      true
    );
    expect(avoidsControlDeck(label)).toBe(true);
  });

  it('BREAK is reachable after a tracked target leaves the search circle', () => {
    const rig = createLockRig();
    acquireTarget(indicator, rig, 0.5);
    track(indicator, rig, 0.2);
    expect(indicator.getLockProgress()).toBeGreaterThan(0);

    const progressWhileTracking = indicator.getLockProgress();
    rig.enemy.position.set(400, 0, -40);
    rig.enemy.updateMatrixWorld(true);
    track(indicator, rig, 0.05);

    expect(indicator.getLockProgress()).toBeLessThan(progressWhileTracking);
    expect(hasBreakTreatment(indicator, lockRoot())).toBe(true);
  });

  it('setLockCircleScale enlarges the search ring, not the pipper', () => {
    const rig = createLockRig();
    expect(driveLockComplete(indicator, rig)).toBe(true);

    const root = lockRoot();
    const ring = searchRing(root);
    const sight = pipper(root);
    const ringBefore = parsePx(ring.style.width);
    const pipperBefore = parsePx(sight.style.width);
    expect(ringBefore).toBeGreaterThan(0);
    expect(pipperBefore).toBeGreaterThan(0);

    indicator.setLockCircleScale(2);
    window.dispatchEvent(new Event('resize'));

    const ringAfter = parsePx(searchRing(root).style.width);
    const pipperAfter = parsePx(pipper(root).style.width);
    expect(ringAfter).toBeGreaterThan(ringBefore ?? 0);
    expect(pipperAfter).toBe(pipperBefore);
  });

  it('sizes the search ring by desktop | touch-landscape | touch-portrait density', () => {
    const cases: Array<{
      density: LayoutDensity;
      width: number;
      height: number;
    }> = [
      { density: 'desktop', width: 1280, height: 800 },
      { density: 'touch-landscape', width: 900, height: 400 },
      { density: 'touch-landscape', width: 1600, height: 1100 },
      { density: 'touch-portrait', width: 400, height: 800 },
      { density: 'touch-portrait', width: 1100, height: 1600 },
    ];

    for (const setup of cases) {
      indicator.dispose();
      stubViewport(setup.width, setup.height, setup.density !== 'desktop');
      indicator = new LockOnIndicator();
      layoutApi(indicator).setLayoutDensity?.(setup.density);
      indicator.startLockOn();

      const size = parsePx(searchRing().style.width);
      const expected = expectedSearchRingSize(setup.density, 1);
      expect(size, `${setup.density} ${setup.width}x${setup.height}`).toBeCloseTo(expected, 0);
    }
  });

  it('clamps the search ring out of the control deck on touch', () => {
    indicator.dispose();
    stubViewport(900, 300, true);
    indicator = new LockOnIndicator();
    layoutApi(indicator).setLayoutDensity?.('touch-landscape');
    indicator.setLockCircleScale(2);
    indicator.startLockOn();

    const size = parsePx(searchRing().style.width) ?? 0;
    const bottom = window.innerHeight / 2 + size / 2;
    expect(bottom).toBeLessThanOrEqual(window.innerHeight * 0.65);
  });

  it('uses an 18px pipper on touch after lock completes', () => {
    indicator.dispose();
    indicator = createIndicator('touch-portrait');
    const rig = createLockRig();
    expect(driveLockComplete(indicator, rig)).toBe(true);

    const size = parsePx(pipper().style.width);
    expect(size).toBe(18);
    expect(parsePx(pipper().style.height)).toBe(18);
  });
});
