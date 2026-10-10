import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { RadarMinimap } from '@/ui/RadarMinimap';
import { detectHudLayoutDensity, type HudLayoutDensity } from '@/ui/theme/hudTokens';
import { installCanvasRecording, type CanvasRecording } from './canvasRecorder';

/**
 * 雷达小地图的尺寸与位置（规格 M8）：
 * - 桌面不变：120px，左下角。
 * - 触控布局：在左上角状态栏（#hud .hud-cabin）下方；竖屏还要让开 #hud-top-stack；HUD 还没挂上时
 *   用固定的回退位置。不再压在摇杆上方。手机 84px；视口短边不小于 700px 时 132px。接受指针输入。
 */

type LayoutDensity = HudLayoutDensity;

type RadarLayoutApi = RadarMinimap & {
  setLayoutDensity?: (density: LayoutDensity) => void;
  getLayoutDensity?: () => LayoutDensity;
};

interface Viewport {
  width: number;
  height: number;
  touch: boolean;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DESKTOP: Viewport = { width: 1280, height: 800, touch: false };
const PHONE_LANDSCAPE: Viewport = { width: 844, height: 390, touch: true };
const PHONE_PORTRAIT: Viewport = { width: 390, height: 844, touch: true };
const TABLET_LANDSCAPE: Viewport = { width: 1180, height: 820, touch: true };
const TABLET_PORTRAIT: Viewport = { width: 820, height: 1180, touch: true };

const DESKTOP_SIZE_PX = 120;
const PHONE_SIZE_PX = 84;
const TABLET_SIZE_PX = 132;
const TABLET_MIN_SHORT_SIDE_PX = 700;

const STICK_INSET_PX = 20;
const STICK_SIZE_PX = 108;

/** 触控 HUD 左上角的状态栏（积分 / 速度 / 升级点）与竖屏的顶部消息栈 */
const CABIN: Rect = { left: 12, top: 10, width: 168, height: 92 };
const PORTRAIT_STACK: Rect = { left: 12, top: 110, width: 366, height: 64 };

function stubViewport({ width, height, touch }: Viewport): void {
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
    'number'
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

/** 雷达在视口里的矩形（从内联的 left / top / bottom 与尺寸还原；jsdom 不做布局） */
function radarRect(element: HTMLElement, viewport: Viewport): Rect {
  const size = readSizePx(element);
  const left = readOffsetLeft(element);
  expect(left, 'the radar declares a left offset in px').not.toBeNull();
  const inlineTop = parsePx(element.style.top);
  let top = inlineTop;
  if (top == null) {
    const bottom = readOffsetBottom(element, viewport.height);
    expect(bottom, 'the radar declares a top or bottom offset in px').not.toBeNull();
    top = viewport.height - (bottom as number) - size;
  }
  return { left: left as number, top, width: size, height: size };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
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

/** jsdom 不做布局：给夹具元素一个固定的 getBoundingClientRect */
function placeAt(element: HTMLElement, rect: Rect): void {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON() {
        return this;
      },
    }) as DOMRect;
}

function stickRect(viewport: Viewport, size: number = STICK_SIZE_PX): Rect {
  return {
    left: STICK_INSET_PX,
    top: viewport.height - STICK_INSET_PX - size,
    width: size,
    height: size,
  };
}

function mountJoystick(viewport: Viewport, size: number = STICK_SIZE_PX): HTMLDivElement {
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
  placeAt(stick, stickRect(viewport, size));

  const knob = document.createElement('div');
  knob.id = 'joystick-knob';
  stick.appendChild(knob);
  controls.appendChild(stick);
  document.body.appendChild(controls);
  return stick;
}

interface HudFixture {
  cabin: HTMLDivElement;
  stack: HTMLDivElement;
}

/** 触控 HUD 的锚点：#hud 里的 .hud-cabin 与 #hud-top-stack */
function mountHud(cabinRect: Rect = CABIN, stackRect: Rect | null = null): HudFixture {
  const hud = document.createElement('div');
  hud.id = 'hud';
  const cabin = document.createElement('div');
  cabin.className = 'hud-cabin';
  placeAt(cabin, cabinRect);
  const stack = document.createElement('div');
  stack.id = 'hud-top-stack';
  placeAt(stack, stackRect ?? { left: 0, top: 0, width: 0, height: 0 });
  hud.appendChild(cabin);
  hud.appendChild(stack);
  document.body.appendChild(hud);
  return { cabin, stack };
}

function expectedDensity(viewport: Viewport): LayoutDensity {
  if (!viewport.touch) return 'desktop';
  return viewport.width > viewport.height ? 'touch-landscape' : 'touch-portrait';
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
  let recording: CanvasRecording;
  let radar: RadarMinimap | null;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMaxTouchPoints = navigator.maxTouchPoints;
    document.body.innerHTML = '';
    radar = null;
    recording = installCanvasRecording();
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
    recording.restore();
    vi.restoreAllMocks();
  });

  /** 按视口创建雷达（夹具要在这之前挂好） */
  function mountRadar(viewport: Viewport): RadarMinimap {
    stubViewport(viewport);
    const density = expectedDensity(viewport);
    expect(detectHudLayoutDensity()).toBe(density);
    const created = new RadarMinimap();
    (created as RadarLayoutApi).setLayoutDensity?.(density);
    return created;
  }

  /** 夹具变了之后让雷达重新量一次：窗口尺寸变化是它一定会响应的时机 */
  function relayout(): void {
    window.dispatchEvent(new Event('resize'));
  }

  it('creates a 120px lower-left #radar-minimap on desktop', () => {
    radar = mountRadar(DESKTOP);
    const node = radarNode();

    assertVisible(node);
    expect(readSizePx(node)).toBe(DESKTOP_SIZE_PX);
    expect(isCircular(node, DESKTOP_SIZE_PX)).toBe(true);

    const left = readOffsetLeft(node);
    const bottom = readOffsetBottom(node, DESKTOP.height);
    expect(left, 'desktop radar should sit on the left').not.toBeNull();
    expect(bottom, 'desktop radar should sit on the bottom').not.toBeNull();
    expect(left as number).toBeLessThanOrEqual(32);
    expect(bottom as number).toBeLessThanOrEqual(32);

    const css = collectCss(node).toLowerCase();
    expect(
      css,
      'desktop radar should use HUD glass/sys chrome, not the old neon green square'
    ).toMatch(/--hud-glass|--hud-sys|--hud-edge|#8fe4ff|rgba\(\s*8\s*,\s*14\s*,\s*24/i);
    expect(css).not.toMatch(/rgba\(\s*0\s*,\s*255\s*,\s*100/);
  });

  it('keeps the desktop radar where it was even when a touch HUD and a stick exist', () => {
    mountHud(CABIN, PORTRAIT_STACK);
    mountJoystick(DESKTOP);
    radar = mountRadar(DESKTOP);
    const node = radarNode();

    expect(readSizePx(node)).toBe(DESKTOP_SIZE_PX);
    const rect = radarRect(node, DESKTOP);
    expect(rect.left).toBeLessThanOrEqual(32);
    expect(DESKTOP.height - (rect.top + rect.height), 'bottom offset').toBeLessThanOrEqual(32);
  });

  describe('touch size', () => {
    it.each([
      ['phone, landscape', PHONE_LANDSCAPE, PHONE_SIZE_PX],
      ['phone, portrait', PHONE_PORTRAIT, PHONE_SIZE_PX],
      ['tablet, landscape', TABLET_LANDSCAPE, TABLET_SIZE_PX],
      ['tablet, portrait', TABLET_PORTRAIT, TABLET_SIZE_PX],
    ] as const)('is a visible, round radar on a %s', (_name, viewport, size) => {
      mountHud();
      mountJoystick(viewport);
      radar = mountRadar(viewport);
      const node = radarNode();

      assertVisible(node);
      expect(GameConfig.isMobile).toBe(true);
      expect(readSizePx(node)).toBe(size);
      expect(isCircular(node, size)).toBe(true);
    });

    it.each([
      [TABLET_MIN_SHORT_SIDE_PX - 1, PHONE_SIZE_PX],
      [TABLET_MIN_SHORT_SIDE_PX, TABLET_SIZE_PX],
      [TABLET_MIN_SHORT_SIDE_PX + 68, TABLET_SIZE_PX],
    ] as const)(
      'with a short side of %d px the radar is %d px, in either orientation',
      (shortSide, size) => {
        radar = mountRadar({ width: 1100, height: shortSide, touch: true });
        expect(readSizePx(radarNode())).toBe(size);
        radar.dispose();
        document.body.innerHTML = '';

        radar = mountRadar({ width: shortSide, height: 1100, touch: true });
        expect(readSizePx(radarNode())).toBe(size);
      }
    );

    it('resizes when the viewport crosses the 700 px short side', () => {
      radar = mountRadar(PHONE_LANDSCAPE);
      expect(readSizePx(radarNode())).toBe(PHONE_SIZE_PX);

      stubViewport(TABLET_LANDSCAPE);
      relayout();
      expect(readSizePx(radarNode())).toBe(TABLET_SIZE_PX);

      stubViewport(PHONE_PORTRAIT);
      relayout();
      expect(readSizePx(radarNode())).toBe(PHONE_SIZE_PX);
    });

    it('uses the layout tiers desktop | phone | tablet: 120 / 84 / 132 px', () => {
      const sizes = [DESKTOP, PHONE_LANDSCAPE, PHONE_PORTRAIT, TABLET_LANDSCAPE].map((viewport) => {
        radar?.dispose();
        document.body.innerHTML = '';
        radar = mountRadar(viewport);
        const node = radarNode();
        assertVisible(node);
        return readSizePx(node);
      });

      expect(sizes).toEqual([DESKTOP_SIZE_PX, PHONE_SIZE_PX, PHONE_SIZE_PX, TABLET_SIZE_PX]);
    });
  });

  describe('touch placement', () => {
    it('sits top-left under the status chips in landscape', () => {
      mountHud(CABIN);
      mountJoystick(PHONE_LANDSCAPE);
      radar = mountRadar(PHONE_LANDSCAPE);
      const node = radarNode();
      const rect = radarRect(node, PHONE_LANDSCAPE);

      expect(parsePx(node.style.top), 'anchored from the top').not.toBeNull();
      expect(parsePx(node.style.bottom), 'not anchored from the bottom').toBeNull();

      const cabinBottom = CABIN.top + CABIN.height;
      expect(rect.top, 'below the status chips').toBeGreaterThanOrEqual(cabinBottom);
      expect(rect.top - cabinBottom, 'right under them').toBeLessThanOrEqual(24);
      // 与状态栏同一列：水平方向与它重叠，贴着屏幕左侧
      expect(rect.left).toBeLessThan(CABIN.left + CABIN.width);
      expect(rect.left + rect.width).toBeGreaterThan(CABIN.left);
      expect(rect.left).toBeLessThanOrEqual(32);
      expect(overlaps(rect, CABIN)).toBe(false);
    });

    it('follows the status chips when they grow or move', () => {
      const { cabin } = mountHud(CABIN);
      radar = mountRadar(PHONE_LANDSCAPE);
      const before = radarRect(radarNode(), PHONE_LANDSCAPE);

      const taller: Rect = { left: 30, top: 10, width: 168, height: 130 };
      placeAt(cabin, taller);
      relayout();
      const after = radarRect(radarNode(), PHONE_LANDSCAPE);

      expect(after.top).toBeGreaterThanOrEqual(taller.top + taller.height);
      expect(after.top - before.top).toBeCloseTo(taller.height - CABIN.height, 0);
      expect(after.left).toBeLessThan(taller.left + taller.width);
      expect(after.left + after.width).toBeGreaterThan(taller.left);
      expect(overlaps(after, taller)).toBe(false);
    });

    it('does not read #hud-top-stack in landscape (the stack is centred there)', () => {
      const { stack } = mountHud(CABIN, { left: 300, top: 8, width: 240, height: 40 });
      radar = mountRadar(PHONE_LANDSCAPE);
      const before = radarRect(radarNode(), PHONE_LANDSCAPE);

      placeAt(stack, { left: 0, top: 8, width: 844, height: 220 });
      relayout();
      expect(radarRect(radarNode(), PHONE_LANDSCAPE)).toEqual(before);
    });

    it('sits top-left under the status chips and the top stack in portrait', () => {
      mountHud(CABIN, PORTRAIT_STACK);
      mountJoystick(PHONE_PORTRAIT);
      radar = mountRadar(PHONE_PORTRAIT);
      const node = radarNode();
      const rect = radarRect(node, PHONE_PORTRAIT);

      expect(parsePx(node.style.top), 'anchored from the top').not.toBeNull();
      expect(parsePx(node.style.bottom), 'not anchored from the bottom').toBeNull();
      expect(rect.top).toBeGreaterThanOrEqual(CABIN.top + CABIN.height);
      expect(rect.top).toBeGreaterThanOrEqual(PORTRAIT_STACK.top + PORTRAIT_STACK.height);
      expect(overlaps(rect, CABIN)).toBe(false);
      expect(overlaps(rect, PORTRAIT_STACK)).toBe(false);
      expect(rect.left).toBeLessThanOrEqual(32);
      expect(rect.top + rect.height, 'in the upper half of the screen').toBeLessThanOrEqual(
        PHONE_PORTRAIT.height / 2
      );
    });

    it('moves below #hud-top-stack in portrait when the stack grows', () => {
      const { stack } = mountHud(CABIN, PORTRAIT_STACK);
      radar = mountRadar(PHONE_PORTRAIT);

      for (const height of [150, 190, 230]) {
        const grown: Rect = { ...PORTRAIT_STACK, height };
        placeAt(stack, grown);
        relayout();
        const rect = radarRect(radarNode(), PHONE_PORTRAIT);
        expect(rect.top, `stack ${height}px tall`).toBeGreaterThanOrEqual(grown.top + height);
        expect(overlaps(rect, grown), `stack ${height}px tall`).toBe(false);
      }
    });

    it.each([
      ['landscape', PHONE_LANDSCAPE],
      ['portrait', PHONE_PORTRAIT],
      ['tablet landscape', TABLET_LANDSCAPE],
    ] as const)('is not above the joystick in %s', (_name, viewport) => {
      mountHud(CABIN, viewport.width > viewport.height ? null : PORTRAIT_STACK);
      const stick = mountJoystick(viewport);
      radar = mountRadar(viewport);
      const rect = radarRect(radarNode(), viewport);
      const stickBox = stickRect(viewport);

      expect(overlaps(rect, stickBox)).toBe(false);
      // 以前贴在摇杆上方 8px；现在离它很远，在屏幕上半部
      expect(stickBox.top - (rect.top + rect.height)).toBeGreaterThan(40);
      expect(rect.top + rect.height / 2).toBeLessThan(viewport.height / 2);

      // 位置与摇杆无关：摇杆换了大小 / 位置，雷达不动
      placeAt(stick, { left: 60, top: viewport.height - 260, width: 140, height: 140 });
      relayout();
      expect(radarRect(radarNode(), viewport)).toEqual(rect);
    });

    it.each([
      ['landscape', PHONE_LANDSCAPE],
      ['portrait', PHONE_PORTRAIT],
    ] as const)(
      'falls back to a fixed top-left position with no HUD mounted (%s)',
      (_n, viewport) => {
        radar = mountRadar(viewport);
        const node = radarNode();
        const rect = radarRect(node, viewport);

        expect(parsePx(node.style.top), 'anchored from the top').not.toBeNull();
        expect(Number.isFinite(rect.left) && Number.isFinite(rect.top)).toBe(true);
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.left).toBeLessThanOrEqual(32);
        expect(rect.top).toBeGreaterThan(0);
        expect(rect.top + rect.height / 2, 'in the upper half').toBeLessThan(viewport.height / 2);

        // 固定值：再建一个也在同一处
        radar.dispose();
        radar = mountRadar(viewport);
        expect(radarRect(radarNode(), viewport)).toEqual(rect);
      }
    );

    it('measures the status chips once the HUD is mounted after the radar', () => {
      radar = mountRadar(PHONE_LANDSCAPE);
      const fallback = radarRect(radarNode(), PHONE_LANDSCAPE);

      const late: Rect = { left: 24, top: 16, width: 180, height: 150 };
      mountHud(late);
      // HUD 出现之后：雷达开始刷新（进入战斗）或窗口尺寸变化时改用量到的位置
      radar.updateBlips(new THREE.Vector3(), [], new THREE.Quaternion());
      relayout();
      const measured = radarRect(radarNode(), PHONE_LANDSCAPE);

      expect(measured).not.toEqual(fallback);
      expect(measured.top).toBeGreaterThanOrEqual(late.top + late.height);
      expect(measured.top - (late.top + late.height)).toBeLessThanOrEqual(24);
      expect(measured.left).toBeLessThan(late.left + late.width);
      expect(measured.left + measured.width).toBeGreaterThan(late.left);
    });
  });

  describe('touch input', () => {
    it.each([
      ['landscape', PHONE_LANDSCAPE],
      ['portrait', PHONE_PORTRAIT],
      ['tablet', TABLET_LANDSCAPE],
    ] as const)('accepts pointer input in %s', (_name, viewport) => {
      mountHud();
      mountJoystick(viewport);
      radar = mountRadar(viewport);
      expect(pointerEventsOf(radarNode())).not.toBe('none');
    });

    it('opens the level map when the radar is tapped', () => {
      mountHud();
      mountJoystick(PHONE_LANDSCAPE);
      radar = mountRadar(PHONE_LANDSCAPE);
      const node = radarNode();
      // 游戏进行中：雷达刚刷新过
      radar.updateBlips(new THREE.Vector3(), [], new THREE.Quaternion());

      const tap = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch' };
      node.dispatchEvent(new PointerEvent('pointerdown', { ...tap, clientX: 40, clientY: 150 }));
      node.dispatchEvent(new PointerEvent('pointerup', { ...tap, clientX: 41, clientY: 151 }));

      const map = document.getElementById('radar-map');
      expect(map, 'tapping the radar opens #radar-map').toBeTruthy();
      expect((map as HTMLElement).style.display).not.toBe('none');
    });
  });
});
