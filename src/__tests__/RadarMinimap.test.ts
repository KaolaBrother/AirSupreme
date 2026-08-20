import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { RadarMinimap } from '@/ui/RadarMinimap';
import { detectHudLayoutDensity, type HudLayoutDensity } from '@/ui/theme/hudTokens';

type LayoutDensity = HudLayoutDensity;

type RadarLayoutApi = RadarMinimap & {
  setLayoutDensity?: (density: LayoutDensity) => void;
  getLayoutDensity?: () => LayoutDensity;
};

const VIEWPORTS: Record<LayoutDensity, { width: number; height: number; touch: boolean }> = {
  desktop: { width: 1280, height: 800, touch: false },
  'touch-landscape': { width: 844, height: 390, touch: true },
  'touch-portrait': { width: 390, height: 844, touch: true },
};

const STICK_SIZE: Record<Exclude<LayoutDensity, 'desktop'>, number> = {
  'touch-landscape': 108,
  'touch-portrait': 96,
};

const RADAR_SIZE: Record<LayoutDensity, number> = {
  desktop: 120,
  'touch-landscape': 72,
  'touch-portrait': 64,
};

const STICK_INSET_PX = 20;
const TOUCH_GAP_PX = 8;

function stubCanvas2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) => {
    if (type !== '2d') {
      return null;
    }
    return {
      canvas: document.createElement('canvas'),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'center',
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
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
}

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function collectCss(element: HTMLElement): string {
  const chunks: string[] = [element.getAttribute('style') ?? ''];
  for (const style of document.querySelectorAll('style')) {
    chunks.push(style.textContent ?? '');
  }
  return chunks.join('\n');
}

function readSizePx(element: HTMLElement): number {
  const candidates = [
    parsePx(element.style.width),
    parsePx(element.style.height),
    parsePx(element.style.minWidth),
    parsePx(element.style.minHeight),
    parsePx(getComputedStyle(element).width),
    parsePx(getComputedStyle(element).height),
  ];
  if (element instanceof HTMLCanvasElement) {
    candidates.push(element.width, element.height);
  }
  const canvas = element.querySelector('canvas');
  if (canvas) {
    candidates.push(canvas.width, canvas.height);
    candidates.push(parsePx(canvas.style.width), parsePx(canvas.style.height));
  }
  const sized = candidates.find((value): value is number => value != null && value > 0);
  expect(sized, `#${element.id || element.tagName} should declare a pixel size`).toBeTypeOf(
    'number',
  );
  return sized as number;
}

function readOffsetBottom(element: HTMLElement, viewportHeight: number): number | null {
  const inlineBottom = parsePx(element.style.bottom);
  if (inlineBottom != null) {
    return inlineBottom;
  }
  const computedBottom = parsePx(getComputedStyle(element).bottom);
  if (computedBottom != null) {
    return computedBottom;
  }
  const height = readSizePx(element);
  const inlineTop = parsePx(element.style.top);
  if (inlineTop != null) {
    return viewportHeight - inlineTop - height;
  }
  const rect = element.getBoundingClientRect();
  if (rect.height > 0 || rect.bottom > 0) {
    return viewportHeight - rect.bottom;
  }
  return null;
}

function readOffsetLeft(element: HTMLElement): number | null {
  const inlineLeft = parsePx(element.style.left);
  if (inlineLeft != null) {
    return inlineLeft;
  }
  const computedLeft = parsePx(getComputedStyle(element).left);
  if (computedLeft != null) {
    return computedLeft;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 || rect.left > 0) {
    return rect.left;
  }
  return null;
}

function isCircular(element: HTMLElement, size: number): boolean {
  const radius = element.style.borderRadius || getComputedStyle(element).borderRadius;
  if (radius.trim() === '50%' || radius.trim() === '50') {
    return true;
  }
  const px = parsePx(radius);
  return px != null && px >= size / 2 - 0.5;
}

function pointerEventsOf(element: HTMLElement): string {
  return (getComputedStyle(element).pointerEvents || element.style.pointerEvents || '').trim();
}

function assertVisible(element: HTMLElement): void {
  expect(element.style.display, `#${element.id} display`).not.toBe('none');
  expect(element.style.visibility, `#${element.id} visibility`).not.toBe('hidden');
  const opacity = element.style.opacity;
  if (opacity) {
    expect(Number(opacity), `#${element.id} opacity`).toBeGreaterThan(0);
  }
}

function mountJoystick(size: number, viewportHeight: number): HTMLDivElement {
  const controls = document.createElement('div');
  controls.id = 'mobile-controls';
  controls.className = 'mobile-controls';
  controls.style.cssText = `
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: ${STICK_INSET_PX}px;
    pointer-events: none;
  `;

  const stick = document.createElement('div');
  stick.id = 'joystick';
  stick.style.cssText = `
    position: fixed;
    bottom: ${STICK_INSET_PX}px;
    left: ${STICK_INSET_PX}px;
    width: ${size}px;
    height: ${size}px;
    pointer-events: auto;
  `;
  const top = viewportHeight - STICK_INSET_PX - size;
  stick.getBoundingClientRect = () =>
    ({
      x: STICK_INSET_PX,
      y: top,
      left: STICK_INSET_PX,
      top,
      right: STICK_INSET_PX + size,
      bottom: top + size,
      width: size,
      height: size,
      toJSON() {
        return this;
      },
    }) as DOMRect;

  const knob = document.createElement('div');
  knob.id = 'joystick-knob';
  stick.appendChild(knob);
  controls.appendChild(stick);
  document.body.appendChild(controls);
  return stick;
}

function mountRadar(density: LayoutDensity): RadarMinimap {
  const viewport = VIEWPORTS[density];
  stubViewport(viewport.width, viewport.height, viewport.touch);
  if (density !== 'desktop') {
    mountJoystick(STICK_SIZE[density], viewport.height);
  }

  expect(detectHudLayoutDensity()).toBe(density);

  const radar = new RadarMinimap();
  (radar as RadarLayoutApi).setLayoutDensity?.(density);
  return radar;
}

function radarNode(): HTMLElement {
  const node = document.getElementById('radar-minimap');
  expect(node, 'expected a #radar-minimap node').toBeTruthy();
  return node as HTMLElement;
}

describe('RadarMinimap', () => {
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalMaxTouchPoints: number;
  let radar: RadarMinimap | null;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMaxTouchPoints = navigator.maxTouchPoints;
    document.body.innerHTML = '';
    radar = null;
    stubCanvas2d();
  });

  afterEach(() => {
    radar?.dispose();
    radar = null;
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
    window.ontouchstart = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('creates a 120px lower-left #radar-minimap on desktop', () => {
    radar = mountRadar('desktop');
    const node = radarNode();

    assertVisible(node);
    expect(readSizePx(node)).toBe(RADAR_SIZE.desktop);
    expect(isCircular(node, RADAR_SIZE.desktop)).toBe(true);

    const left = readOffsetLeft(node);
    const bottom = readOffsetBottom(node, VIEWPORTS.desktop.height);
    expect(left, 'desktop radar should sit on the left').not.toBeNull();
    expect(bottom, 'desktop radar should sit on the bottom').not.toBeNull();
    expect(left as number).toBeLessThanOrEqual(32);
    expect(bottom as number).toBeLessThanOrEqual(32);

    const css = collectCss(node).toLowerCase();
    expect(css, 'desktop radar should use HUD glass/sys chrome, not the old neon green square').toMatch(
      /--hud-glass|--hud-sys|--hud-edge|#8fe4ff|rgba\(\s*8\s*,\s*14\s*,\s*24/i,
    );
    expect(css).not.toMatch(/rgba\(\s*0\s*,\s*255\s*,\s*100/);
  });

  it('creates a visible #radar-minimap on touch-landscape instead of omitting mobile radar', () => {
    radar = mountRadar('touch-landscape');
    const node = radarNode();

    assertVisible(node);
    expect(GameConfig.isMobile).toBe(true);
    expect(readSizePx(node)).toBe(RADAR_SIZE['touch-landscape']);
    expect(pointerEventsOf(node)).toBe('none');
  });

  it('places the 72px landscape radar 8px above the stick without stealing pointer events', () => {
    radar = mountRadar('touch-landscape');
    const node = radarNode();
    const stick = document.getElementById('joystick') as HTMLElement;
    expect(stick, 'expected #joystick fixture').toBeTruthy();

    const size = readSizePx(node);
    expect(size).toBe(72);

    const radarBottom = readOffsetBottom(node, VIEWPORTS['touch-landscape'].height);
    const stickBottom = readOffsetBottom(stick, VIEWPORTS['touch-landscape'].height);
    expect(radarBottom, 'landscape radar bottom offset').not.toBeNull();
    expect(stickBottom, 'stick bottom offset').not.toBeNull();

    const stickTopFromBottom = (stickBottom as number) + STICK_SIZE['touch-landscape'];
    expect((radarBottom as number) - stickTopFromBottom).toBeCloseTo(TOUCH_GAP_PX, 0);

    const radarLeft = readOffsetLeft(node) ?? 0;
    const stickLeft = readOffsetLeft(stick) ?? STICK_INSET_PX;
    expect(radarLeft + size).toBeGreaterThan(stickLeft);
    expect(radarLeft).toBeLessThan(stickLeft + STICK_SIZE['touch-landscape']);
    expect(pointerEventsOf(node)).toBe('none');
  });

  it('creates a 64px #radar-minimap above the stick on touch-portrait', () => {
    radar = mountRadar('touch-portrait');
    const node = radarNode();
    const stick = document.getElementById('joystick') as HTMLElement;
    expect(stick, 'expected #joystick fixture').toBeTruthy();

    assertVisible(node);
    expect(GameConfig.isMobile).toBe(true);
    const size = readSizePx(node);
    expect(size).toBe(64);
    expect(pointerEventsOf(node)).toBe('none');

    const radarBottom = readOffsetBottom(node, VIEWPORTS['touch-portrait'].height);
    const stickBottom = readOffsetBottom(stick, VIEWPORTS['touch-portrait'].height);
    expect(radarBottom, 'portrait radar bottom offset').not.toBeNull();
    expect(stickBottom, 'stick bottom offset').not.toBeNull();

    const stickTopFromBottom = (stickBottom as number) + STICK_SIZE['touch-portrait'];
    expect((radarBottom as number) - stickTopFromBottom).toBeCloseTo(TOUCH_GAP_PX, 0);
  });

  it('uses three layout tiers desktop | touch-landscape | touch-portrait with distinct radar sizes', () => {
    const sizes = (['desktop', 'touch-landscape', 'touch-portrait'] as LayoutDensity[]).map(
      (density) => {
        radar?.dispose();
        document.body.innerHTML = '';
        radar = mountRadar(density);
        const node = radarNode();
        assertVisible(node);
        return readSizePx(node);
      },
    );

    expect(sizes).toEqual([120, 72, 64]);
    expect(new Set(sizes).size).toBe(3);
  });
});
