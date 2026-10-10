import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { RadarMinimap } from '@/ui/RadarMinimap';
import { detectHudLayoutDensity, type HudLayoutDensity } from '@/ui/theme/hudTokens';
import { installCanvasRecording, type CanvasRecording } from './canvasRecorder';
import { recordDeclaredStyles, type DeclaredStyles } from './declaredStyle';
import { describeListeners, trackListeners, type ListenerTracker } from './listenerTracker';
import { parseShippedDocument } from './touchTestUtils';

/**
 * 雷达小地图的尺寸与位置（规格 M8）：
 * - 桌面不变：120px，左下角。
 * - 触控布局：在左上角状态栏（#hud .hud-cabin）下方；竖屏还要让开 #hud-top-stack；HUD 还没挂上时
 *   用固定的回退位置。不再压在摇杆上方。手机 84px；视口短边不小于 700px 时 132px。接受指针输入。
 *
 * 触控端的点击面（规格 P3）：一块透明的 #radar-tap-target 盖住整个折叠的雷达（连同展开徽标），
 * 叠在触控控件之上——落在雷达上的触摸展开地图，不会带动摇杆；桌面不显示；雷达移动 / 变大小时
 * 跟着走；点它和点雷达本身一样；dispose() 时移除。雷达自己的叠放不变。
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

  // ───────────────────────────── 触控端的点击面（P3） ─────────────────────────────

  describe('tap surface (#radar-tap-target)', () => {
    const TOUCH_LAYOUTS = [
      ['phone landscape', PHONE_LANDSCAPE],
      ['phone portrait', PHONE_PORTRAIT],
      ['tablet landscape', TABLET_LANDSCAPE],
      ['tablet portrait', TABLET_PORTRAIT],
    ] as const;
    /** 雷达的展开徽标比点击面上对应的那一块靠里 1px（雷达有 1px 的边框）：按这么多的误差比 */
    const COVER_TOLERANCE_PX = 1.5;
    const TAP_INPUT_EVENTS = [
      'pointerdown',
      'pointerup',
      'touchstart',
      'touchend',
      'mousedown',
      'mouseup',
      'click',
    ] as const;

    let now: number;
    /** 点击面与徽标的样式是整段写进 cssText 的，jsdom 会丢：按代码声明的原文读（见 declaredStyle.ts） */
    let styles: DeclaredStyles;

    beforeEach(() => {
      // “游戏进行中”按最近一次刷新的时间算：时钟由测试拨
      now = 50_000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      styles = recordDeclaredStyles();
    });

    afterEach(() => {
      styles.stop();
    });

    function tapNode(): HTMLElement | null {
      return document.getElementById('radar-tap-target');
    }

    function isDisplayed(node: HTMLElement | null): boolean {
      return (
        node !== null &&
        node.isConnected &&
        node.style.display !== 'none' &&
        node.style.visibility !== 'hidden'
      );
    }

    function shownTapNode(): HTMLElement {
      const node = tapNode();
      expect(node, 'expected a #radar-tap-target node').toBeTruthy();
      expect(isDisplayed(node), '#radar-tap-target is displayed').toBe(true);
      return node as HTMLElement;
    }

    function tapZIndex(tap: HTMLElement): number {
      const declared = styles.of(tap, 'z-index');
      expect(declared, 'the tap surface declares a z-index').toMatch(/^\d+$/);
      return Number(declared);
    }

    function mapShown(): boolean {
      const map = document.getElementById('radar-map');
      return map !== null && map.isConnected && map.style.display !== 'none';
    }

    /** 一帧雷达刷新：游戏进行中 */
    function frame(ms: number = 50): void {
      now += ms;
      (radar as RadarMinimap).updateBlips(new THREE.Vector3(), [], new THREE.Quaternion());
    }

    /** 触控布局：HUD 与摇杆都在，雷达在刷新 */
    function touchRadar(viewport: Viewport): HTMLElement {
      mountHud(CABIN, viewport.width > viewport.height ? null : PORTRAIT_STACK);
      mountJoystick(viewport);
      radar = mountRadar(viewport);
      frame();
      return shownTapNode();
    }

    interface Shape {
      rect: Rect;
      round: boolean;
    }

    function isRound(element: HTMLElement, size: number): boolean {
      const radius = styles.of(element, 'border-radius');
      if (radius === '50%') return true;
      const value = parsePx(radius);
      return value !== null && value >= size / 2 - 0.5;
    }

    function shapeOf(element: HTMLElement, rect: Rect): Shape {
      return { rect, round: isRound(element, Math.min(rect.width, rect.height)) };
    }

    function shapeContains({ rect, round }: Shape, x: number, y: number): boolean {
      if (!round) {
        return (
          x >= rect.left &&
          x <= rect.left + rect.width &&
          y >= rect.top &&
          y <= rect.top + rect.height
        );
      }
      const dx = (x - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = (y - (rect.top + rect.height / 2)) / (rect.height / 2);
      return dx * dx + dy * dy <= 1;
    }

    /** 边框宽度（px）：绝对定位的子元素相对边框以内的那个盒子定位 */
    function borderWidthOf(element: HTMLElement): number {
      const declared = `${styles.of(element, 'border-width')} ${styles.of(element, 'border')}`;
      const match = declared.match(/(\d+(?:\.\d+)?)px/);
      return match ? Number(match[1]) : 0;
    }

    /** 绝对定位的子元素在视口里的矩形（按内联的 left / top / right / bottom 与宽高） */
    function childRect(parent: HTMLElement, parentRect: Rect, child: HTMLElement): Rect {
      expect(styles.of(child, 'position'), 'the child is absolutely positioned').toBe('absolute');
      const border = borderWidthOf(parent);
      const inner: Rect = {
        left: parentRect.left + border,
        top: parentRect.top + border,
        width: parentRect.width - 2 * border,
        height: parentRect.height - 2 * border,
      };
      const width = parsePx(styles.of(child, 'width'));
      const height = parsePx(styles.of(child, 'height'));
      expect(width !== null && height !== null, 'the child declares a pixel size').toBe(true);
      const left = parsePx(styles.of(child, 'left'));
      const right = parsePx(styles.of(child, 'right'));
      const top = parsePx(styles.of(child, 'top'));
      const bottom = parsePx(styles.of(child, 'bottom'));
      expect(left ?? right, 'the child declares left or right').not.toBeNull();
      expect(top ?? bottom, 'the child declares top or bottom').not.toBeNull();
      return {
        left:
          left !== null
            ? inner.left + left
            : inner.left + inner.width - (right as number) - (width as number),
        top:
          top !== null
            ? inner.top + top
            : inner.top + inner.height - (bottom as number) - (height as number),
        width: width as number,
        height: height as number,
      };
    }

    /** 点击面接得住触摸的全部区域：它自己，加上它里面的每一块 */
    function tapShapes(tap: HTMLElement, viewport: Viewport): Shape[] {
      const rect = radarRect(tap, viewport);
      const shapes = [shapeOf(tap, rect)];
      for (const child of Array.from(tap.children) as HTMLElement[]) {
        shapes.push(shapeOf(child, childRect(tap, rect, child)));
      }
      return shapes;
    }

    /** 一个圆（或椭圆）形区域里的取样点：圆心，加上几圈，最外一圈收进 inset */
    function samplePoints(rect: Rect, inset: number): Array<[x: number, y: number]> {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const points: Array<[number, number]> = [[cx, cy]];
      for (const fraction of [0.25, 0.5, 0.75, 1]) {
        const rx = fraction === 1 ? rect.width / 2 - inset : (rect.width / 2) * fraction;
        const ry = fraction === 1 ? rect.height / 2 - inset : (rect.height / 2) * fraction;
        for (let step = 0; step < 36; step++) {
          const angle = (step / 36) * Math.PI * 2;
          points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
        }
      }
      return points;
    }

    /** 没被点击面接住的取样点 */
    function missedBy(shapes: Shape[], points: Array<[number, number]>): string[] {
      return points
        .filter(([x, y]) => !shapes.some((shape) => shapeContains(shape, x, y)))
        .map(([x, y]) => `(${x.toFixed(1)}, ${y.toFixed(1)})`);
    }

    /** 一个元素画得出来的东西：点击面应当什么都不画 */
    function paints(element: HTMLElement): string[] {
      const found: string[] = [];
      const invisible = /^(?:|none|transparent|rgba\(0, 0, 0, 0\)|initial)$/;
      for (const property of [
        'background',
        'background-color',
        'background-image',
        'box-shadow',
        'outline',
        'backdrop-filter',
      ]) {
        const value = styles.of(element, property);
        if (!invisible.test(value)) found.push(`${property}: ${value}`);
      }
      if (borderWidthOf(element) > 0) found.push(`border: ${styles.of(element, 'border')}`);
      if ((element.textContent ?? '').trim() !== '') found.push(`text: ${element.textContent}`);
      if (element.querySelector('canvas, svg, img, video')) found.push('a graphic');
      return found;
    }

    /** 发布版页面样式里某条规则的 z-index */
    function shippedZIndex(selector: string): number {
      const css = Array.from(parseShippedDocument().querySelectorAll('style'))
        .map((style) => style.textContent ?? '')
        .join('\n');
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rules = [...css.matchAll(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
      const declared = rules
        .map((rule) => rule[1].match(/(?:^|[;\s])z-index:\s*(-?\d+)/))
        .find((match) => match !== null);
      expect(declared, `index.html gives ${selector} a z-index`).toBeTruthy();
      return Number((declared as RegExpMatchArray)[1]);
    }

    interface TapOptions {
      pointerId?: number;
      pointerType?: string;
      button?: number;
      /** 按下到抬起移动的距离 */
      drag?: number;
      /** 抬起时用的指针 id（默认与按下相同） */
      releaseId?: number;
      /** 按下之后、抬起之前发生的事 */
      between?: 'pointercancel' | 'pointerleave';
    }

    /** 一次指针按下再抬起 */
    function pointerTap(node: Element, options: TapOptions = {}): void {
      const { pointerId = 7, pointerType = 'touch', button = 0, drag = 1 } = options;
      const init = { bubbles: true, cancelable: true, pointerType, button };
      node.dispatchEvent(
        new PointerEvent('pointerdown', { ...init, pointerId, clientX: 40, clientY: 150 })
      );
      if (options.between) {
        node.dispatchEvent(new PointerEvent(options.between, { ...init, pointerId }));
      }
      node.dispatchEvent(
        new PointerEvent('pointerup', {
          ...init,
          pointerId: options.releaseId ?? pointerId,
          clientX: 40 + drag,
          clientY: 150,
        })
      );
    }

    function inputEvent(type: (typeof TAP_INPUT_EVENTS)[number]): Event {
      const init = { bubbles: true, cancelable: true, clientX: 40, clientY: 150, button: 0 };
      if (type === 'pointerdown' || type === 'pointerup') {
        return new PointerEvent(type, { ...init, pointerId: 7, pointerType: 'touch' });
      }
      if (type === 'touchstart' || type === 'touchend') {
        return new TouchEvent(type, { bubbles: true, cancelable: true });
      }
      return new MouseEvent(type, init);
    }

    /**
     * 手指轻点：浏览器实际发出的事件序列。touchstart 没被取消时还会补发兼容的鼠标事件与 click。
     * 返回 touchstart 有没有被取消。
     */
    function fingerTap(node: Element): boolean {
      const init = { bubbles: true, cancelable: true, clientX: 40, clientY: 150, button: 0 };
      const pointer = { ...init, pointerId: 11, pointerType: 'touch' };
      node.dispatchEvent(new PointerEvent('pointerdown', pointer));
      const allowed = node.dispatchEvent(inputEvent('touchstart'));
      node.dispatchEvent(new PointerEvent('pointerup', pointer));
      node.dispatchEvent(inputEvent('touchend'));
      if (allowed) {
        node.dispatchEvent(new MouseEvent('mousedown', init));
        node.dispatchEvent(new MouseEvent('mouseup', init));
        node.dispatchEvent(new MouseEvent('click', init));
      }
      return !allowed;
    }

    describe.each(TOUCH_LAYOUTS)('on a %s screen', (_name, viewport) => {
      it('is displayed, fixed to the viewport and takes pointer input', () => {
        const tap = touchRadar(viewport);
        expect(document.querySelectorAll('#radar-tap-target')).toHaveLength(1);
        expect(styles.of(tap, 'position')).toBe('fixed');
        expect(styles.of(tap, 'pointer-events')).not.toBe('none');
        // 手指按在上面不滚动 / 缩放页面
        expect(styles.of(tap, 'touch-action')).toBe('none');
      });

      it('is transparent: it draws nothing over the radar', () => {
        const tap = touchRadar(viewport);
        expect(paints(tap)).toEqual([]);
        for (const child of Array.from(tap.querySelectorAll<HTMLElement>('*'))) {
          expect(paints(child)).toEqual([]);
        }
        // 读屏软件只读到雷达本身那一个按钮
        expect(tap.getAttribute('aria-hidden')).toBe('true');
        expect(tap.getAttribute('role')).toBeNull();
      });

      it('sits exactly on the collapsed radar', () => {
        const tap = touchRadar(viewport);
        expect(radarRect(tap, viewport)).toEqual(radarRect(radarNode(), viewport));
      });

      it('covers the whole radar disc', () => {
        const tap = touchRadar(viewport);
        const disc = radarRect(radarNode(), viewport);
        expect(isCircular(radarNode(), disc.width), 'the radar is a disc').toBe(true);
        expect(missedBy(tapShapes(tap, viewport), samplePoints(disc, COVER_TOLERANCE_PX))).toEqual(
          []
        );
      });

      it('covers the expand badge, which sticks out of the disc', () => {
        const tap = touchRadar(viewport);
        const node = radarNode();
        const disc = radarRect(node, viewport);
        const badge = node.querySelector<HTMLElement>('.radar-expand-badge');
        expect(badge, 'the radar has an expand badge').toBeTruthy();
        const badgeRect = childRect(node, disc, badge as HTMLElement);
        const points = samplePoints(badgeRect, COVER_TOLERANCE_PX);

        // 徽标确实有一部分在盘外：只盖住圆盘是不够的
        const discOnly = [shapeOf(node, disc)];
        expect(missedBy(discOnly, points).length, 'badge points outside the disc').toBeGreaterThan(
          0
        );
        expect(missedBy(tapShapes(tap, viewport), points)).toEqual([]);
      });

      it('is stacked above the touch controls, outside them', () => {
        const tap = touchRadar(viewport);
        const controlsZ = shippedZIndex('.mobile-controls');
        expect(tapZIndex(tap)).toBeGreaterThan(controlsZ);
        expect(styles.of(tap, 'position'), 'z-index applies to a positioned box').toBe('fixed');
        // 直接挂在 body 下：z-index 与触控控件在同一个层叠上下文里比较
        expect(tap.parentElement).toBe(document.body);
        expect(tap.closest('#mobile-controls')).toBeNull();
        expect(radarNode().contains(tap), 'not inside the radar, whose z-index is lower').toBe(
          false
        );
      });

      it('opens the map on a finger tap, and closes it on the next', () => {
        const tap = touchRadar(viewport);
        expect(mapShown()).toBe(false);
        fingerTap(tap);
        expect(mapShown(), 'first tap opens the map').toBe(true);
        frame();
        fingerTap(tap);
        expect(mapShown(), 'second tap closes it').toBe(false);
      });
    });

    describe('stacking', () => {
      it('the stick zone is inside #mobile-controls, so one z-index decides (shipped page)', () => {
        const shipped = parseShippedDocument();
        const zone = shipped.getElementById('touch-stick-zone');
        expect(zone, 'index.html has a #touch-stick-zone').toBeTruthy();
        expect((zone as HTMLElement).closest('#mobile-controls')).toBeTruthy();
        expect(shipped.getElementById('joystick')?.closest('#mobile-controls')).toBeTruthy();
      });

      it.each([['desktop', DESKTOP], ...TOUCH_LAYOUTS] as const)(
        'leaves the collapsed radar where it was in the stack (%s)',
        (_name, viewport) => {
          mountHud();
          radar = mountRadar(viewport);
          frame();
          // 雷达自己没有抬高：仍在触控控件之下，原先盖得住它的全屏遮罩照旧盖得住
          expect(radarNode().style.zIndex).toBe('50');
          expect(Number(radarNode().style.zIndex)).toBeLessThan(shippedZIndex('.mobile-controls'));
        }
      );

      it('stays below the expanded radar and its map', () => {
        const tap = touchRadar(PHONE_LANDSCAPE);
        const collapsedZ = Number(radarNode().style.zIndex);
        fingerTap(tap);
        expect(mapShown()).toBe(true);
        const expandedZ = Number(radarNode().style.zIndex);
        expect(expandedZ).toBeGreaterThan(tapZIndex(tap));
        expect(tapZIndex(tap)).toBeGreaterThan(collapsedZ);

        fingerTap(tap);
        expect(mapShown()).toBe(false);
        expect(Number(radarNode().style.zIndex), 'back down once the map closes').toBe(collapsedZ);
      });
    });

    describe('a touch that starts on it', () => {
      let seen: string[];
      let listener: (event: Event) => void;
      let watched: EventTarget[];

      beforeEach(() => {
        seen = [];
        listener = (event) => seen.push(event.type);
        watched = [];
      });

      afterEach(() => {
        for (const target of watched) {
          for (const type of TAP_INPUT_EVENTS) target.removeEventListener(type, listener);
        }
      });

      /** 摇杆与按键靠这些地方的监听起作用：页面上的控件本身，以及 body / document / window */
      function watchThePage(stick: HTMLElement): void {
        watched = [stick, stick.parentElement as HTMLElement, document.body, document, window];
        for (const target of watched) {
          for (const type of TAP_INPUT_EVENTS) target.addEventListener(type, listener);
        }
      }

      function touchRadarWatched(viewport: Viewport): HTMLElement {
        mountHud(CABIN, viewport.width > viewport.height ? null : PORTRAIT_STACK);
        const stick = mountJoystick(viewport);
        radar = mountRadar(viewport);
        frame();
        watchThePage(stick);
        return shownTapNode();
      }

      it.each(TAP_INPUT_EVENTS)('%s does not reach the controls or the page', (type) => {
        const tap = touchRadarWatched(PHONE_LANDSCAPE);
        tap.dispatchEvent(inputEvent(type));
        for (const child of Array.from(tap.children)) child.dispatchEvent(inputEvent(type));
        expect(seen).toEqual([]);
      });

      it('cancels the touchstart, so no mouse events or click follow', () => {
        const tap = touchRadarWatched(PHONE_LANDSCAPE);
        const touchstart = inputEvent('touchstart');
        tap.dispatchEvent(touchstart);
        expect(touchstart.defaultPrevented).toBe(true);
      });

      it('a whole finger tap opens the map once and leaks nothing', () => {
        const tap = touchRadarWatched(PHONE_PORTRAIT);
        expect(fingerTap(tap), 'the touchstart was cancelled').toBe(true);
        expect(mapShown()).toBe(true);
        expect(seen).toEqual([]);
      });

      it('a tap on the part over the expand badge works the same', () => {
        const tap = touchRadarWatched(PHONE_LANDSCAPE);
        expect(tap.children.length, 'the surface has a part over the badge').toBeGreaterThan(0);
        fingerTap(tap.children[0]);
        expect(mapShown()).toBe(true);
        expect(seen).toEqual([]);
      });

      it('events elsewhere on the page are still seen (the test listeners work)', () => {
        touchRadarWatched(PHONE_LANDSCAPE);
        const elsewhere = document.createElement('div');
        document.body.appendChild(elsewhere);
        for (const type of TAP_INPUT_EVENTS) elsewhere.dispatchEvent(inputEvent(type));
        // body、document、window 各看到一次
        expect(seen).toHaveLength(TAP_INPUT_EVENTS.length * 3);
      });
    });

    describe('toggles the map like the radar itself', () => {
      type Surface = 'radar' | 'tap surface';
      const surfaceNode = (which: Surface): HTMLElement =>
        which === 'radar' ? radarNode() : shownTapNode();

      /** 同一套操作分别做在雷达上和点击面上，每一步之后地图开没开 */
      const SCENARIOS: ReadonlyArray<
        [name: string, expected: boolean[], run: (node: () => HTMLElement) => boolean[]]
      > = [
        [
          'tap, tap again',
          [true, false],
          (node) => {
            pointerTap(node());
            const first = mapShown();
            frame();
            pointerTap(node());
            return [first, mapShown()];
          },
        ],
        [
          'tap when the radar has not refreshed for a while (not in play)',
          [false],
          (node) => {
            now += 5_000;
            pointerTap(node());
            return [mapShown()];
          },
        ],
        [
          'press, then lift far from where the finger went down',
          [false],
          (node) => {
            pointerTap(node(), { drag: 80 });
            return [mapShown()];
          },
        ],
        [
          'press, lose the pointer, then lift',
          [false, false],
          (node) => {
            pointerTap(node(), { between: 'pointercancel' });
            const cancelled = mapShown();
            pointerTap(node(), { between: 'pointerleave' });
            return [cancelled, mapShown()];
          },
        ],
        [
          'lift a different finger from the one that pressed',
          [false],
          (node) => {
            pointerTap(node(), { pointerId: 3, releaseId: 4 });
            return [mapShown()];
          },
        ],
        [
          'right mouse button',
          [false],
          (node) => {
            pointerTap(node(), { pointerType: 'mouse', button: 2 });
            return [mapShown()];
          },
        ],
        [
          'tap, then the game stops refreshing the radar and resumes',
          [true, false],
          (node) => {
            pointerTap(node());
            const opened = mapShown();
            frame(5_000);
            return [opened, mapShown()];
          },
        ],
        [
          'tap while the radar is hidden (a story card is up), then shown again',
          [false, true],
          (node) => {
            radarNode().style.visibility = 'hidden';
            pointerTap(node());
            const whileHidden = mapShown();
            radarNode().style.visibility = '';
            pointerTap(node());
            return [whileHidden, mapShown()];
          },
        ],
      ];

      function play(which: Surface, run: (node: () => HTMLElement) => boolean[]): boolean[] {
        touchRadar(PHONE_LANDSCAPE);
        const result = run(() => surfaceNode(which));
        (radar as RadarMinimap).dispose();
        radar = null;
        document.body.innerHTML = '';
        return result;
      }

      it.each(SCENARIOS)('%s', (_name, expected, run) => {
        const onRadar = play('radar', run);
        const onSurface = play('tap surface', run);
        expect(onRadar, 'on the radar').toEqual(expected);
        expect(onSurface, 'on the tap surface').toEqual(onRadar);
      });

      it('a map opened on one is closed by a tap on the other', () => {
        const tap = touchRadar(PHONE_LANDSCAPE);
        pointerTap(tap);
        expect(mapShown()).toBe(true);
        frame();
        pointerTap(radarNode());
        expect(mapShown()).toBe(false);
        frame();
        pointerTap(radarNode());
        expect(mapShown()).toBe(true);
        frame();
        pointerTap(tap);
        expect(mapShown()).toBe(false);
      });

      it('a press on one and a lift on the other still counts as one tap', () => {
        const tap = touchRadar(PHONE_LANDSCAPE);
        const init = { bubbles: true, cancelable: true, pointerId: 5, pointerType: 'touch' };
        tap.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: 40, clientY: 150 }));
        radarNode().dispatchEvent(
          new PointerEvent('pointerup', { ...init, clientX: 41, clientY: 150 })
        );
        expect(mapShown()).toBe(true);
      });
    });

    describe('on desktop', () => {
      it('is not displayed', () => {
        mountHud();
        radar = mountRadar(DESKTOP);
        frame();
        expect(isDisplayed(tapNode())).toBe(false);
        expect(document.querySelectorAll('#radar-tap-target').length).toBeLessThanOrEqual(1);
      });

      it('is hidden when a touch layout becomes desktop, and shown again on the way back', () => {
        const api = (): RadarLayoutApi => radar as RadarLayoutApi;
        touchRadar(PHONE_LANDSCAPE);

        stubViewport(DESKTOP);
        relayout();
        api().setLayoutDensity?.('desktop');
        expect(isDisplayed(tapNode()), 'on desktop').toBe(false);

        stubViewport(TABLET_LANDSCAPE);
        relayout();
        api().setLayoutDensity?.('touch-landscape');
        const tap = shownTapNode();
        expect(radarRect(tap, TABLET_LANDSCAPE)).toEqual(radarRect(radarNode(), TABLET_LANDSCAPE));
      });
    });

    describe('follows the radar', () => {
      function expectOnRadar(viewport: Viewport, what: string): Rect {
        const rect = radarRect(radarNode(), viewport);
        expect(radarRect(shownTapNode(), viewport), what).toEqual(rect);
        expect(document.querySelectorAll('#radar-tap-target'), what).toHaveLength(1);
        return rect;
      }

      it('when the status chips grow or move', () => {
        const { cabin } = mountHud(CABIN);
        radar = mountRadar(PHONE_LANDSCAPE);
        const before = expectOnRadar(PHONE_LANDSCAPE, 'at first');

        placeAt(cabin, { left: 30, top: 10, width: 168, height: 130 });
        relayout();
        const after = expectOnRadar(PHONE_LANDSCAPE, 'after the chips grew');
        expect(after, 'the radar moved').not.toEqual(before);
      });

      it('when the portrait message stack grows', () => {
        const { stack } = mountHud(CABIN, PORTRAIT_STACK);
        radar = mountRadar(PHONE_PORTRAIT);
        const before = expectOnRadar(PHONE_PORTRAIT, 'at first');

        placeAt(stack, { ...PORTRAIT_STACK, height: 260 });
        relayout();
        const after = expectOnRadar(PHONE_PORTRAIT, 'after the stack grew');
        expect(after.top, 'the radar moved down').toBeGreaterThan(before.top);
      });

      it('when the radar changes size', () => {
        mountHud(CABIN);
        radar = mountRadar(PHONE_LANDSCAPE);
        const small = expectOnRadar(PHONE_LANDSCAPE, 'phone');
        expect(small.width).toBe(PHONE_SIZE_PX);

        stubViewport(TABLET_LANDSCAPE);
        relayout();
        const large = expectOnRadar(TABLET_LANDSCAPE, 'tablet');
        expect(large.width).toBe(TABLET_SIZE_PX);

        stubViewport(PHONE_LANDSCAPE);
        relayout();
        expect(expectOnRadar(PHONE_LANDSCAPE, 'phone again').width).toBe(PHONE_SIZE_PX);
      });

      it('when the device is turned', () => {
        mountHud(CABIN, PORTRAIT_STACK);
        radar = mountRadar(PHONE_LANDSCAPE);
        const landscape = expectOnRadar(PHONE_LANDSCAPE, 'landscape');

        stubViewport(PHONE_PORTRAIT);
        window.dispatchEvent(new Event('orientationchange'));
        relayout();
        (radar as RadarLayoutApi).setLayoutDensity?.('touch-portrait');
        const portrait = expectOnRadar(PHONE_PORTRAIT, 'portrait');
        expect(portrait, 'the radar moved').not.toEqual(landscape);
      });

      it('when the HUD is mounted after the radar', () => {
        radar = mountRadar(PHONE_LANDSCAPE);
        const fallback = expectOnRadar(PHONE_LANDSCAPE, 'fallback position');

        mountHud({ left: 24, top: 16, width: 180, height: 150 });
        frame();
        expectOnRadar(PHONE_LANDSCAPE, 'after the first radar refresh');
        relayout();
        const measured = expectOnRadar(PHONE_LANDSCAPE, 'after a resize');
        expect(measured, 'the radar moved').not.toEqual(fallback);
      });

      it('while the map is open and after it closes', () => {
        const tap = touchRadar(PHONE_LANDSCAPE);
        pointerTap(tap);
        expect(mapShown()).toBe(true);
        expectOnRadar(PHONE_LANDSCAPE, 'map open');
        stubViewport(TABLET_LANDSCAPE);
        relayout();
        expectOnRadar(TABLET_LANDSCAPE, 'map open, resized');
        (radar as RadarMinimap).setMapExpanded(false);
        expectOnRadar(TABLET_LANDSCAPE, 'map closed');
      });
    });

    describe('dispose()', () => {
      let tracker: ListenerTracker | null = null;

      afterEach(() => {
        tracker?.stop();
        tracker = null;
      });

      it.each([
        ['phone landscape', PHONE_LANDSCAPE],
        ['tablet portrait', TABLET_PORTRAIT],
        ['desktop', DESKTOP],
      ] as const)('removes the tap surface (%s)', (_name, viewport) => {
        mountHud();
        radar = mountRadar(viewport);
        frame();
        radar.dispose();
        radar = null;
        expect(document.getElementById('radar-tap-target')).toBeNull();
        expect(document.getElementById('radar-minimap')).toBeNull();
      });

      it('removes it when the map was open', () => {
        const tap = touchRadar(PHONE_LANDSCAPE);
        pointerTap(tap);
        expect(mapShown()).toBe(true);
        (radar as RadarMinimap).dispose();
        radar = null;
        expect(document.getElementById('radar-tap-target')).toBeNull();
        expect(mapShown()).toBe(false);
      });

      it('leaves no listener behind, on the surface or anywhere else', () => {
        tracker = trackListeners();
        const tap = touchRadar(PHONE_LANDSCAPE);
        expect(
          tracker.live.some((entry) => entry.target === tap),
          'the surface listens for input'
        ).toBe(true);
        pointerTap(tap);
        frame();
        (radar as RadarMinimap).dispose();
        radar = null;
        expect(describeListeners(tracker.live), 'listeners left behind').toEqual([]);
      });

      it('a tap on the removed surface does nothing', () => {
        const tap = touchRadar(PHONE_LANDSCAPE);
        (radar as RadarMinimap).dispose();
        radar = null;
        expect(() => fingerTap(tap)).not.toThrow();
        expect(mapShown()).toBe(false);
        expect(document.getElementById('radar-map')).toBeNull();
      });

      it('a radar created afterwards has exactly one tap surface of its own', () => {
        const first = touchRadar(PHONE_LANDSCAPE);
        (radar as RadarMinimap).dispose();
        document.body.innerHTML = '';
        const second = touchRadar(PHONE_LANDSCAPE);
        expect(second).not.toBe(first);
        expect(document.querySelectorAll('#radar-tap-target')).toHaveLength(1);
        fingerTap(second);
        expect(mapShown()).toBe(true);
      });
    });
  });
});
