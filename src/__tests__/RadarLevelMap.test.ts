import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { setLocale } from '@/i18n';
import {
  RadarMinimap,
  type RadarBlip,
  type RadarBlipKind,
  type RadarTerrainSampler,
} from '@/ui/RadarMinimap';
import {
  addedShapes,
  boundsOf,
  centreOf,
  copyShapes,
  installCanvasRecording,
  isLineSegment,
  type CanvasRecorder,
  type CanvasRecording,
  type PaintedShape,
  type Point,
} from './canvasRecorder';
import { recordDeclaredStyles, type DeclaredStyles } from './declaredStyle';
import { resetLocale } from './i18nTestUtils';
import { describeListeners, trackListeners } from './listenerTracker';

/**
 * 展开的关卡地图（规格 M7）：点击 / 轻触雷达或按 N 展开一张更大的、北朝上的地图（#radar-map），
 * 再点地图、按 N 或 Esc 收起。地图开着时 Esc 只收起地图，不再传给暂停；雷达与地图上的指针 /
 * 触摸 / 点击不冒泡到 document。换关、雷达停刷超过约 1.5 秒后收起。地图上有带航向的玩家、
 * 全部目标、1350 米边界和当前语言的图例；地形底图来自 setTerrainSource 的采样器，没有采样器时
 * 只画网格。dispose() 移除元素与它加过的全部监听。
 *
 * 时间用可控的 performance.now；画布用记录型上下文。
 *
 * 看得清、不出界（规格 P4）：面板底色基本不透明（alpha 不低于 0.9）；玩家在地图范围（±1500 米）
 * 之外时，玩家符号整个画在面板里，换成一眼能分辨的样子（空心，带一截朝外的短线）；范围之外的
 * 目标画成贴边的符号，留在面板里，不被边裁掉。范围之内的画法不变。
 */

const BOUNDARY_RADIUS_M = 1350;
/** 地图显示的范围：关卡中心四周各这么远（正方形） */
const MAP_EXTENT_M = 1500;
const ALL_KINDS: readonly RadarBlipKind[] = [
  'enemy',
  'spawning',
  'boss',
  'enemy-ground',
  'enemy-sea',
  'ally',
  'ally-unit',
  'neutral',
  'pickup',
];
/** 雷达刷新间隔（20 Hz）略放宽，保证每次都重绘地图 */
const FRAME_MS = 60;
const PLAYER = new THREE.Vector3(-300, 180, 420);
const NORTH = new THREE.Quaternion();

interface Viewport {
  width: number;
  height: number;
  touch: boolean;
}

const DESKTOP: Viewport = { width: 1280, height: 800, touch: false };
const PHONE_LANDSCAPE: Viewport = { width: 844, height: 390, touch: true };
const PHONE_PORTRAIT: Viewport = { width: 390, height: 844, touch: true };

const POINTER_EVENTS = ['pointerdown', 'pointerup'] as const;
const TOUCH_EVENTS = ['touchstart', 'touchend'] as const;
const MOUSE_EVENTS = ['mousedown', 'mouseup', 'click'] as const;
const GAME_INPUT_EVENTS = [...POINTER_EVENTS, ...TOUCH_EVENTS, ...MOUSE_EVENTS] as const;
type GameInputEvent = (typeof GAME_INPUT_EVENTS)[number];

function heading(deg: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    -THREE.MathUtils.degToRad(deg)
  );
}

function stubViewport({ width, height, touch }: Viewport): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  GameConfig.isMobile = touch;
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touch ? 5 : 0 });
  window.ontouchstart = touch ? () => undefined : null;
}

function inputEvent(type: GameInputEvent): Event {
  const init = { bubbles: true, cancelable: true, clientX: 30, clientY: 30, button: 0 };
  if (type === 'pointerdown' || type === 'pointerup') {
    return new PointerEvent(type, { ...init, pointerId: 3, pointerType: 'touch' });
  }
  if (type === 'touchstart' || type === 'touchend') {
    return typeof TouchEvent === 'function'
      ? new TouchEvent(type, { bubbles: true, cancelable: true })
      : new Event(type, { bubbles: true, cancelable: true });
  }
  return new MouseEvent(type, init);
}

/** 鼠标单击：浏览器实际发出的完整事件序列 */
function mouseClick(element: Element): void {
  const init = { bubbles: true, cancelable: true, clientX: 30, clientY: 30, button: 0 };
  const pointer = { ...init, pointerId: 1, pointerType: 'mouse' };
  element.dispatchEvent(new PointerEvent('pointerdown', pointer));
  element.dispatchEvent(new MouseEvent('mousedown', init));
  element.dispatchEvent(new PointerEvent('pointerup', pointer));
  element.dispatchEvent(new MouseEvent('mouseup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

/** 轻触：touchstart 没被取消时浏览器还会补发兼容的鼠标事件与 click */
function touchTap(element: Element): void {
  const init = { bubbles: true, cancelable: true, clientX: 30, clientY: 30, button: 0 };
  const pointer = { ...init, pointerId: 9, pointerType: 'touch' };
  element.dispatchEvent(new PointerEvent('pointerdown', pointer));
  const allowed = element.dispatchEvent(inputEvent('touchstart'));
  element.dispatchEvent(new PointerEvent('pointerup', pointer));
  element.dispatchEvent(inputEvent('touchend'));
  if (allowed) {
    element.dispatchEvent(new MouseEvent('mousedown', init));
    element.dispatchEvent(new MouseEvent('mouseup', init));
    element.dispatchEvent(new MouseEvent('click', init));
  }
}

/** 键盘事件发给获得焦点的元素（这里是 body），再冒泡到 document / window——与浏览器一致 */
function press(code: string, key: string = code): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
}

describe('RadarMinimap level map', () => {
  let recording: CanvasRecording;
  let radar: RadarMinimap;
  let now: number;
  /** 面板的样式是整段写进 cssText 的，jsdom 会丢：按代码声明的原文读（见 declaredStyle.ts） */
  let styles: DeclaredStyles;
  let originalIsMobile: boolean;
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalMaxTouchPoints: number;

  function create(target: Viewport = DESKTOP): void {
    stubViewport(target);
    radar = new RadarMinimap();
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMaxTouchPoints = navigator.maxTouchPoints;
    document.body.innerHTML = '';
    now = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    recording = installCanvasRecording();
    styles = recordDeclaredStyles();
  });

  afterEach(() => {
    radar?.dispose();
    styles.stop();
    recording.restore();
    vi.restoreAllMocks();
    resetLocale();
    GameConfig.isMobile = originalIsMobile;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
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
  });

  function radarNode(): HTMLElement {
    const node = document.getElementById('radar-minimap');
    expect(node, '#radar-minimap').toBeTruthy();
    return node as HTMLElement;
  }

  function mapNode(): HTMLElement | null {
    return document.getElementById('radar-map');
  }

  function mapShown(): boolean {
    const node = mapNode();
    return node !== null && node.isConnected && node.style.display !== 'none';
  }

  /** 一帧雷达刷新（游戏进行中每 50 ms 一次） */
  function frame(
    blips: readonly RadarBlip[] = [],
    rotation: THREE.Quaternion = NORTH,
    player: THREE.Vector3 = PLAYER,
    ms: number = FRAME_MS
  ): void {
    now += ms;
    radar.updateBlips(player, blips, rotation);
  }

  function openMap(): HTMLElement {
    frame();
    if (!mapShown()) press('KeyN', 'n');
    expect(mapShown(), 'the map opens').toBe(true);
    frame();
    return mapNode() as HTMLElement;
  }

  function px(value: string): number {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
    expect(match, `"${value}" is a pixel size`).toBeTruthy();
    return Number((match as RegExpMatchArray)[1]);
  }

  // ───────────────────────────── 展开 / 收起 ─────────────────────────────

  describe('opening and closing', () => {
    it('starts collapsed', () => {
      create();
      frame();
      expect(mapShown()).toBe(false);
    });

    it('opens when the radar is clicked, and one click toggles once', () => {
      create();
      frame();
      mouseClick(radarNode());
      expect(mapShown(), 'still open after the whole click sequence').toBe(true);
    });

    it('opens when the radar is tapped on a touch layout', () => {
      create(PHONE_LANDSCAPE);
      frame();
      touchTap(radarNode());
      expect(mapShown()).toBe(true);
    });

    it('opens with N and closes with N again', () => {
      create();
      frame();
      press('KeyN', 'n');
      expect(mapShown()).toBe(true);
      frame();
      press('KeyN', 'n');
      expect(mapShown()).toBe(false);
      frame();
      press('KeyN', 'N');
      expect(mapShown(), 'opens again').toBe(true);
    });

    it('closes when the map is clicked', () => {
      create();
      const map = openMap();
      mouseClick(map);
      expect(mapShown()).toBe(false);
    });

    it('closes when the map is tapped on a touch layout', () => {
      create(PHONE_PORTRAIT);
      frame();
      touchTap(radarNode());
      expect(mapShown()).toBe(true);
      frame();
      touchTap(mapNode() as HTMLElement);
      expect(mapShown()).toBe(false);
    });

    it('closes with Escape', () => {
      create();
      openMap();
      press('Escape');
      expect(mapShown()).toBe(false);
    });

    it.each([
      ['desktop', DESKTOP],
      ['phone, landscape', PHONE_LANDSCAPE],
      ['phone, portrait', PHONE_PORTRAIT],
    ] as const)('shows a map larger than the radar that fits the screen (%s)', (_name, target) => {
      create(target);
      const map = openMap();
      const radarSize = px(radarNode().style.width);
      const width = px(map.style.width);
      const height = px(map.style.height);
      expect(width).toBeGreaterThan(radarSize * 1.5);
      expect(height).toBeGreaterThan(radarSize * 1.5);
      expect(width).toBeLessThanOrEqual(target.width);
      expect(height).toBeLessThanOrEqual(target.height);
    });

    it('keeps the radar itself on screen and updating while the map is open', () => {
      create();
      const canvas = radarNode().querySelector('canvas');
      const dial = recording.of(canvas) as CanvasRecorder;
      openMap();
      dial.clear();
      frame([{ position: PLAYER.clone().add(new THREE.Vector3(0, 0, -100)), kind: 'enemy' }]);
      expect(radarNode().style.display).not.toBe('none');
      expect(dial.shapes.length).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────── Esc 与暂停 ─────────────────────────────

  describe('Escape and the pause handler', () => {
    let pauseOnWindow: ReturnType<typeof vi.fn>;
    let pauseOnDocument: ReturnType<typeof vi.fn>;
    let onWindow: (event: Event) => void;
    let onDocument: (event: Event) => void;

    beforeEach(() => {
      // 游戏的暂停键监听：InputHandler 在 window 上监听 keydown（冒泡阶段），先于雷达注册
      pauseOnWindow = vi.fn();
      pauseOnDocument = vi.fn();
      onWindow = (event) => {
        if ((event as KeyboardEvent).code === 'Escape') pauseOnWindow();
      };
      onDocument = (event) => {
        if ((event as KeyboardEvent).code === 'Escape') pauseOnDocument();
      };
      window.addEventListener('keydown', onWindow);
      document.addEventListener('keydown', onDocument);
    });

    afterEach(() => {
      window.removeEventListener('keydown', onWindow);
      document.removeEventListener('keydown', onDocument);
    });

    it('with the map open, Escape closes the map and does not reach the pause handler', () => {
      create();
      openMap();
      press('Escape');
      expect(mapShown()).toBe(false);
      expect(pauseOnWindow).not.toHaveBeenCalled();
      expect(pauseOnDocument).not.toHaveBeenCalled();
    });

    it('with the map closed, Escape is not swallowed', () => {
      create();
      frame();
      press('Escape');
      expect(pauseOnWindow).toHaveBeenCalledTimes(1);
      expect(pauseOnDocument).toHaveBeenCalledTimes(1);
      expect(mapShown()).toBe(false);
    });

    it('only the Escape that closes the map is swallowed; the next one pauses', () => {
      create();
      openMap();
      press('Escape');
      expect(pauseOnWindow).not.toHaveBeenCalled();
      frame();
      press('Escape');
      expect(pauseOnWindow).toHaveBeenCalledTimes(1);
    });

    it('Escape still pauses after the map was closed another way', () => {
      create();
      const map = openMap();
      mouseClick(map);
      frame();
      press('Escape');
      expect(pauseOnWindow).toHaveBeenCalledTimes(1);

      frame();
      press('KeyN', 'n');
      frame();
      press('KeyN', 'n');
      expect(mapShown()).toBe(false);
      frame();
      press('Escape');
      expect(pauseOnWindow).toHaveBeenCalledTimes(2);
    });
  });

  // ───────────────────────────── 事件不外泄 ─────────────────────────────

  describe('pointer / touch / click events stay inside', () => {
    let seen: string[];
    let listener: (event: Event) => void;

    beforeEach(() => {
      seen = [];
      listener = (event) => seen.push(event.type);
      for (const type of GAME_INPUT_EVENTS) document.addEventListener(type, listener);
    });

    afterEach(() => {
      for (const type of GAME_INPUT_EVENTS) document.removeEventListener(type, listener);
    });

    it.each(GAME_INPUT_EVENTS)('%s on the radar does not reach document', (type) => {
      create(PHONE_LANDSCAPE);
      frame();
      const node = radarNode();
      node.dispatchEvent(inputEvent(type));
      (node.querySelector('canvas') as HTMLCanvasElement).dispatchEvent(inputEvent(type));
      expect(seen).toEqual([]);
    });

    it.each(GAME_INPUT_EVENTS)('%s on the open map does not reach document', (type) => {
      create(PHONE_LANDSCAPE);
      const map = openMap();
      map.dispatchEvent(inputEvent(type));
      (map.querySelector('canvas') ?? map).dispatchEvent(inputEvent(type));
      expect(seen).toEqual([]);
    });

    it('a whole tap on the radar and on the map leaks nothing', () => {
      create(PHONE_PORTRAIT);
      frame();
      touchTap(radarNode());
      expect(mapShown()).toBe(true);
      frame();
      touchTap(mapNode() as HTMLElement);
      expect(mapShown()).toBe(false);
      mouseClick(radarNode());
      expect(seen).toEqual([]);
    });

    it('events elsewhere on the page still reach document (the test listener works)', () => {
      create(PHONE_LANDSCAPE);
      frame();
      const elsewhere = document.createElement('div');
      document.body.appendChild(elsewhere);
      for (const type of GAME_INPUT_EVENTS) elsewhere.dispatchEvent(inputEvent(type));
      expect(seen).toEqual([...GAME_INPUT_EVENTS]);
    });
  });

  // ───────────────────────────── 自动收起 ─────────────────────────────

  describe('collapsing by itself', () => {
    const flat: RadarTerrainSampler = () => ({ y: 0, water: false });

    it('collapses when the level changes, not when the same level is set again', () => {
      create();
      radar.setTerrainSource(flat, 1);
      openMap();

      // 每次雷达刷新都会再设一次同一关：不能因此收起
      for (let i = 0; i < 5; i++) {
        radar.setTerrainSource(flat, 1);
        frame();
      }
      expect(mapShown(), 'same level').toBe(true);

      radar.setTerrainSource(flat, 2);
      frame();
      expect(mapShown(), 'next level').toBe(false);
    });

    it('collapses when the level changes even without a terrain sampler', () => {
      create();
      radar.setTerrainSource(null, 3);
      openMap();
      radar.setTerrainSource(null, 3);
      frame();
      expect(mapShown()).toBe(true);
      radar.setTerrainSource(null, 4);
      frame();
      expect(mapShown()).toBe(false);
    });

    it('stays open while the radar keeps updating', () => {
      create();
      openMap();
      for (let i = 0; i < 200; i++) frame();
      expect(mapShown()).toBe(true);
    });

    it('stays open across a short hitch (about a second)', () => {
      create();
      openMap();
      frame([], NORTH, PLAYER, 1100);
      expect(mapShown()).toBe(true);
    });

    it('is collapsed once radar updates stopped for more than about 1.5 s', () => {
      create();
      openMap();
      // 暂停 / 结算 / 重开：雷达停刷，之后恢复
      frame([], NORTH, PLAYER, 2000);
      expect(mapShown()).toBe(false);
      frame();
      expect(mapShown(), 'and stays collapsed').toBe(false);
    });

    it('can be opened again after it collapsed', () => {
      create();
      openMap();
      frame([], NORTH, PLAYER, 5000);
      expect(mapShown()).toBe(false);
      frame();
      press('KeyN', 'n');
      expect(mapShown()).toBe(true);
    });
  });

  // ───────────────────────────── 地图内容 ─────────────────────────────

  describe('contents', () => {
    let map: HTMLElement;
    let surface: CanvasRecorder;
    let centre: Point;

    function open(target: Viewport = DESKTOP): void {
      create(target);
      map = openMap();
      const canvas = map.querySelector('canvas');
      expect(canvas, 'the map draws on a canvas').toBeTruthy();
      surface = recording.of(canvas) as CanvasRecorder;
      expect(surface, 'the map asked for a 2D context').toBeTruthy();
      // 地图是正方形，下面多出一条图例：以宽度为边长
      const side = px(map.style.width);
      centre = { x: side / 2, y: side / 2 };
    }

    /** 地图各图层（屏幕上的画布 + 它贴上去的离屏画布）画过的全部形状 */
    function layerShapes(): PaintedShape[] {
      const dial = radarNode().querySelector('canvas');
      return recording.recorders
        .filter((recorder) => recorder.canvas !== dial)
        .flatMap((recorder) => recorder.shapes);
    }

    function drawn(
      blips: readonly RadarBlip[],
      rotation: THREE.Quaternion = NORTH,
      player: THREE.Vector3 = PLAYER
    ): PaintedShape[] {
      surface.clear();
      frame(blips, rotation, player);
      expect(surface.ops.length, 'the map is redrawn on a radar update').toBeGreaterThan(0);
      return copyShapes(surface.shapes);
    }

    function glyphAt(
      position: THREE.Vector3,
      kind: RadarBlipKind = 'enemy',
      rotation: THREE.Quaternion = NORTH
    ): Point {
      const empty = drawn([], rotation);
      const added = addedShapes(empty, drawn([{ position, kind }], rotation));
      expect(added.length, `a ${kind} contact is drawn on the map`).toBeGreaterThan(0);
      return centreOf(added.filter((shape) => !isLineSegment(shape)));
    }

    /** 地图比例（像素 / 米）：由两个相距 1000 米的目标量出来 */
    function pixelsPerMetre(): number {
      const west = glyphAt(new THREE.Vector3(-500, 0, 0));
      const east = glyphAt(new THREE.Vector3(500, 0, 0));
      const scale = (east.x - west.x) / 1000;
      expect(scale).toBeGreaterThan(0);
      return scale;
    }

    it('is north-up: world -Z is up and +X is right, whatever the heading', () => {
      open();
      for (const deg of [0, 90, 225]) {
        const rotation = heading(deg);
        const north = glyphAt(new THREE.Vector3(0, 50, -600), 'enemy', rotation);
        const south = glyphAt(new THREE.Vector3(0, 50, 600), 'enemy', rotation);
        const east = glyphAt(new THREE.Vector3(600, 50, 0), 'enemy', rotation);
        const west = glyphAt(new THREE.Vector3(-600, 50, 0), 'enemy', rotation);

        expect(north.y, `heading ${deg}: north is up`).toBeLessThan(centre.y - 20);
        expect(south.y, `heading ${deg}: south is down`).toBeGreaterThan(centre.y + 20);
        expect(Math.abs(north.x - centre.x)).toBeLessThan(2);
        expect(east.x, `heading ${deg}: east is right`).toBeGreaterThan(centre.x + 20);
        expect(west.x, `heading ${deg}: west is left`).toBeLessThan(centre.x - 20);
        expect(Math.abs(east.y - centre.y)).toBeLessThan(2);
        // 同一比例
        expect(centre.y - north.y).toBeCloseTo(east.x - centre.x, 0);
      }
    });

    it('does not move contacts when the player moves or turns (the map is fixed to the level)', () => {
      open();
      const target = new THREE.Vector3(350, 0, -250);
      const before = glyphAt(target);
      const elsewhere = new THREE.Vector3(600, 200, -700);
      const empty = drawn([], heading(135), elsewhere);
      const added = addedShapes(
        empty,
        drawn([{ position: target, kind: 'enemy' }], heading(135), elsewhere)
      );
      const after = centreOf(added);
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
    });

    it('draws every contact at its place in the level', () => {
      open();
      const scale = pixelsPerMetre();
      const contacts: Array<[RadarBlipKind, THREE.Vector3]> = [
        ['enemy', new THREE.Vector3(200, 120, -900)],
        ['enemy-ground', new THREE.Vector3(-750, 0, 300)],
        ['enemy-sea', new THREE.Vector3(900, 0, 650)],
        ['ally', new THREE.Vector3(-150, 140, -100)],
        ['ally-unit', new THREE.Vector3(60, 0, 1000)],
        ['neutral', new THREE.Vector3(-1000, 90, -500)],
        ['boss', new THREE.Vector3(0, 300, 0)],
        ['spawning', new THREE.Vector3(450, 200, 450)],
        ['pickup', new THREE.Vector3(-400, 100, 800)],
      ];

      // 逐个加：每个目标都画在自己的位置（符号不一定关于锚点对称，留出一个符号大小的余量）
      for (const [kind, position] of contacts) {
        const at = glyphAt(position, kind);
        expect(Math.abs(at.x - (centre.x + position.x * scale)), `${kind} x`).toBeLessThan(3);
        expect(Math.abs(at.y - (centre.y + position.z * scale)), `${kind} y`).toBeLessThan(3);
      }

      // 一起给：一个都不少
      const empty = drawn([]);
      const all = addedShapes(
        empty,
        drawn(contacts.map(([kind, position]) => ({ kind, position })))
      );
      for (const [kind, position] of contacts) {
        const expected = { x: centre.x + position.x * scale, y: centre.y + position.z * scale };
        const near = all.filter((shape) => {
          const at = centreOf([shape]);
          return Math.hypot(at.x - expected.x, at.y - expected.y) < 3;
        });
        expect(near.length, `${kind} is on the map with the others`).toBeGreaterThan(0);
      }
    });

    it('shows the player at their position with an arrow along their heading', () => {
      open();
      const scale = pixelsPerMetre();
      const expected = { x: centre.x + PLAYER.x * scale, y: centre.y + PLAYER.z * scale };

      const cases: Array<[deg: number, dx: number, dy: number]> = [
        [0, 0, -1],
        [90, 1, 0],
        [180, 0, 1],
        [270, -1, 0],
        [45, Math.SQRT1_2, -Math.SQRT1_2],
      ];
      for (const [deg, dx, dy] of cases) {
        // 换一个航向：重新画出来的多边形就是玩家箭头
        const other = drawn([], heading(deg + 120));
        const arrow = addedShapes(other, drawn([], heading(deg))).filter(
          (shape) => shape.paint === 'fill' && shape.subpaths.some((sub) => sub.points.length >= 3)
        );
        expect(arrow.length, `heading ${deg}: a filled arrow`).toBeGreaterThan(0);

        const vertices = arrow[0].subpaths.flatMap((sub) => sub.points);
        const distinct = vertices.filter(
          (p, index) => vertices.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6) === index
        );
        const mean = {
          x: distinct.reduce((sum, p) => sum + p.x, 0) / distinct.length,
          y: distinct.reduce((sum, p) => sum + p.y, 0) / distinct.length,
        };
        expect(Math.hypot(mean.x - expected.x, mean.y - expected.y), `heading ${deg}`).toBeLessThan(
          8
        );

        // 箭头尖：离中心最远的顶点，指向航向（北朝上：北 = 上，东 = 右）
        const tip = distinct.reduce((best, p) =>
          Math.hypot(p.x - mean.x, p.y - mean.y) > Math.hypot(best.x - mean.x, best.y - mean.y)
            ? p
            : best
        );
        const pointing = new THREE.Vector2(tip.x - mean.x, tip.y - mean.y).normalize();
        expect(pointing.dot(new THREE.Vector2(dx, dy)), `heading ${deg}`).toBeGreaterThan(0.96);
      }
    });

    it('moves the player marker with the player', () => {
      open();
      const scale = pixelsPerMetre();
      const there = new THREE.Vector3(700, 150, -500);
      const here = drawn([], NORTH, PLAYER);
      const moved = addedShapes(here, drawn([], NORTH, there)).filter(
        (shape) => shape.paint === 'fill' && shape.subpaths.some((sub) => sub.points.length >= 3)
      );
      expect(moved.length).toBeGreaterThan(0);
      const at = centreOf([moved[0]]);
      expect(
        Math.hypot(at.x - (centre.x + there.x * scale), at.y - (centre.y + there.z * scale))
      ).toBeLessThan(8);
    });

    it('draws the 1350 m boundary as a circle around the level centre', () => {
      open();
      const scale = pixelsPerMetre();
      const wanted = BOUNDARY_RADIUS_M * scale;
      const circles = layerShapes()
        .filter((shape) => shape.paint === 'stroke')
        .flatMap((shape) => shape.subpaths.flatMap((sub) => sub.arcs))
        .filter((arc) => Math.hypot(arc.x - centre.x, arc.y - centre.y) < 1.5);
      expect(
        circles.some((arc) => Math.abs(arc.r - wanted) < 2),
        `a stroked circle of radius ${wanted.toFixed(1)} px (1350 m) at the map centre; found ${circles
          .map((arc) => arc.r.toFixed(1))
          .join(', ')}`
      ).toBe(true);
      // 边界整个画在地图里
      expect(wanted).toBeLessThanOrEqual(centre.x);
    });

    it('has a legend in the current language', () => {
      open();
      const texts = (): string[] =>
        layerShapes()
          .filter((shape) => shape.paint === 'text')
          .map((shape) => shape.text ?? '');

      const english = texts();
      expect(
        english.some((text) => /enem|hostile/i.test(text)),
        english.join(' | ')
      ).toBe(true);
      expect(
        english.some((text) => /all(y|ied)|friend/i.test(text)),
        english.join(' | ')
      ).toBe(true);
      expect(english.some((text) => /[一-鿿]/.test(text))).toBe(false);

      recording.clearAll();
      setLocale('zh-CN');
      frame();
      frame();
      const chinese = texts();
      expect(
        chinese.some((text) => text.includes('敌')),
        chinese.join(' | ')
      ).toBe(true);
      expect(
        chinese.some((text) => text.includes('友')),
        chinese.join(' | ')
      ).toBe(true);
      expect(chinese.some((text) => /enem|hostile|ally/i.test(text))).toBe(false);

      recording.clearAll();
      setLocale('en');
      frame();
      frame();
      expect(texts().some((text) => /enem|hostile/i.test(text))).toBe(true);
    });

    // ───────────────────────────── 看得清、不出界（P4） ─────────────────────────────

    describe('panel backdrop', () => {
      /** 一个颜色的不透明度；var(--x, 回退值) 取回退值 */
      function alphaOf(color: string): number {
        const value = color.trim();
        const fallback = value.match(/^var\(\s*--[\w-]+\s*,\s*(.+)\)$/);
        if (fallback) return alphaOf(fallback[1]);
        const functional = value.match(/^(?:rgba?|hsla?)\(([^)]*)\)$/i);
        if (functional) {
          const parts = functional[1].split(/[\s,/]+/).filter((part) => part !== '');
          if (parts.length < 4) return 1;
          return parts[3].endsWith('%') ? Number.parseFloat(parts[3]) / 100 : Number(parts[3]);
        }
        const hex = value.match(/^#([0-9a-f]{3,8})$/i);
        if (hex) {
          if (hex[1].length === 4) return Number.parseInt(hex[1][3] + hex[1][3], 16) / 255;
          if (hex[1].length === 8) return Number.parseInt(hex[1].slice(6), 16) / 255;
          return 1;
        }
        return Number.NaN;
      }

      /** 面板声明的底色 */
      function backdropOf(panel: HTMLElement): string {
        return styles.of(panel, 'background-color') || styles.of(panel, 'background') || '(none)';
      }

      it('reads the opacity of the usual colour notations (the helper works)', () => {
        expect(alphaOf('rgba(8, 14, 24, 0.97)')).toBeCloseTo(0.97);
        expect(alphaOf('rgba(8,14,24,0.72)')).toBeCloseTo(0.72);
        expect(alphaOf('rgb(8 14 24 / 50%)')).toBeCloseTo(0.5);
        expect(alphaOf('rgb(8, 14, 24)')).toBe(1);
        expect(alphaOf('#08121c')).toBe(1);
        expect(alphaOf('#08121c80')).toBeCloseTo(0.5, 1);
        expect(alphaOf('var(--hud-glass, rgba(8,14,24,0.72))')).toBeCloseTo(0.72);
        expect(alphaOf('transparent')).toBeNaN();
        expect(alphaOf('(none)')).toBeNaN();
      });

      it.each([
        ['desktop', DESKTOP],
        ['phone landscape', PHONE_LANDSCAPE],
        ['phone portrait', PHONE_PORTRAIT],
      ] as const)('is effectively opaque: alpha at least 0.9 (%s)', (_name, target) => {
        open(target);
        const declared = backdropOf(map);
        const alpha = alphaOf(declared);
        expect(alpha, `#radar-map background "${declared}"`).toBeGreaterThanOrEqual(0.9);
        // 整个面板没有再被调成半透明
        const opacity = styles.of(map, 'opacity');
        expect(
          alpha * (opacity === '' ? 1 : Number(opacity)),
          'with the opacity of the panel'
        ).toBeGreaterThanOrEqual(0.9);
        expect(styles.of(map, 'visibility')).not.toBe('hidden');
      });

      it('stays opaque after the map is closed and opened again, and after a resize', () => {
        open(PHONE_LANDSCAPE);
        press('KeyN', 'n');
        frame();
        press('KeyN', 'n');
        frame();
        window.dispatchEvent(new Event('resize'));
        frame();
        expect(mapShown()).toBe(true);
        const declared = backdropOf(mapNode() as HTMLElement);
        expect(alphaOf(declared), `"${declared}"`).toBeGreaterThanOrEqual(0.9);
      });
    });

    describe.each([
      ['a large panel (desktop)', DESKTOP],
      ['a compact panel (phone)', PHONE_LANDSCAPE],
    ] as const)('beyond the map extent, on %s', (_name, target) => {
      /** 正方形地图的边长（面板去掉图例条）：画布坐标 0..side */
      let side: number;

      beforeEach(() => {
        open(target);
        side = px(map.style.width);
      });

      const polygons = (shapes: readonly PaintedShape[]): PaintedShape[] =>
        shapes.filter(
          (shape) => shape.paint !== 'text' && shape.subpaths.some((sub) => sub.points.length >= 3)
        );

      /** 形状画到的范围：描边再往外半个线宽 */
      function inkBounds(shapes: readonly PaintedShape[]): ReturnType<typeof boundsOf> {
        const box = boundsOf(shapes);
        const spread = Math.max(
          0,
          ...shapes.filter((shape) => shape.paint === 'stroke').map((shape) => shape.lineWidth / 2)
        );
        return {
          minX: box.minX - spread,
          minY: box.minY - spread,
          maxX: box.maxX + spread,
          maxY: box.maxY + spread,
        };
      }

      function expectInsideMap(shapes: readonly PaintedShape[], what: string): void {
        const box = inkBounds(shapes);
        expect(box.minX, `${what}: left edge`).toBeGreaterThanOrEqual(0);
        expect(box.minY, `${what}: top edge`).toBeGreaterThanOrEqual(0);
        expect(box.maxX, `${what}: right edge`).toBeLessThanOrEqual(side);
        expect(box.maxY, `${what}: bottom edge`).toBeLessThanOrEqual(side);
      }

      /** 地图中心指向世界坐标 (x, z) 的方向（北朝上：-Z 为上、+X 为右） */
      const bearingTo = (position: THREE.Vector3): THREE.Vector2 =>
        new THREE.Vector2(position.x, position.z).normalize();

      /** 这些形状是不是画在地图边上、朝着 position 的方向 */
      function expectAtTheEdgeToward(
        shapes: readonly PaintedShape[],
        position: THREE.Vector3,
        what: string
      ): void {
        const at = centreOf(shapes);
        const offset = new THREE.Vector2(at.x - centre.x, at.y - centre.y);
        const reach = Math.max(Math.abs(offset.x), Math.abs(offset.y));
        expect(reach, `${what}: near the edge of the map`).toBeGreaterThan((side / 2) * 0.8);
        expect(
          offset.clone().normalize().dot(bearingTo(position)),
          `${what}: in the direction of the real position`
        ).toBeGreaterThan(0.95);
      }

      /** 一条短线是不是从符号朝外指、指向 position 的方向 */
      function expectOutwardTick(
        tick: PaintedShape,
        body: readonly PaintedShape[],
        position: THREE.Vector3,
        what: string
      ): void {
        const [a, b] = tick.subpaths[0].points;
        const bodyAt = centreOf(body);
        const near = Math.hypot(a.x - bodyAt.x, a.y - bodyAt.y);
        const far = Math.hypot(b.x - bodyAt.x, b.y - bodyAt.y);
        const [inner, outer] = near <= far ? [a, b] : [b, a];
        const along = new THREE.Vector2(outer.x - inner.x, outer.y - inner.y);
        expect(along.length(), `${what}: the tick has a length`).toBeGreaterThan(1.5);
        const outward = bearingTo(position);
        expect(along.normalize().dot(outward), `${what}: the tick points outward`).toBeGreaterThan(
          0.95
        );
        // 短线在符号的外侧（离地图中心更远的一侧）
        const mid = new THREE.Vector2((a.x + b.x) / 2 - bodyAt.x, (a.y + b.y) / 2 - bodyAt.y);
        expect(mid.dot(outward), `${what}: the tick is on the outer side`).toBeGreaterThan(0);
      }

      // ── 玩家 ──

      /** 玩家符号：换一个位置和航向之后新画出来的东西（距离环与它的标注不算符号本身） */
      function playerMarker(
        player: THREE.Vector3,
        rotation: THREE.Quaternion = NORTH
      ): { body: PaintedShape[]; ticks: PaintedShape[] } {
        const elsewhere = drawn([], heading(200), new THREE.Vector3(321, 150, -123));
        const added = addedShapes(elsewhere, drawn([], rotation, player));
        return { body: polygons(added), ticks: added.filter(isLineSegment) };
      }

      /** 范围内的玩家符号用什么颜色填 */
      function playerColour(): string {
        const { body } = playerMarker(new THREE.Vector3(200, 150, -300));
        const filled = body.filter((shape) => shape.paint === 'fill');
        expect(filled.length, 'an in-range player is a filled arrow').toBeGreaterThan(0);
        return filled[0].style;
      }

      const PLAYER_OUTSIDE: ReadonlyArray<[name: string, position: THREE.Vector3]> = [
        ['east', new THREE.Vector3(2500, 200, 0)],
        ['far north', new THREE.Vector3(0, 200, -4000)],
        ['south-west', new THREE.Vector3(-1800, 200, 1700)],
        ['just past the east edge', new THREE.Vector3(1600, 200, 200)],
        ['just past the south edge', new THREE.Vector3(-900, 200, 1520)],
        ['north-east corner', new THREE.Vector3(1900, 200, -1900)],
        ['very far away', new THREE.Vector3(-4.0e7, 200, 1.5e7)],
      ];

      const PLAYER_INSIDE: ReadonlyArray<[name: string, position: THREE.Vector3]> = [
        ['the middle', new THREE.Vector3(0, 200, 0)],
        ['near the east edge', new THREE.Vector3(1400, 200, 0)],
        ['near the south-east corner', new THREE.Vector3(1400, 200, 1400)],
        ['right at the north-west corner', new THREE.Vector3(-1490, 200, -1490)],
        ['on the south edge', new THREE.Vector3(300, 200, 1500)],
      ];

      it.each(PLAYER_OUTSIDE)('draws a player %s fully inside the panel', (_n, position) => {
        for (const deg of [0, 90, 180, 270, 45]) {
          const { body, ticks } = playerMarker(position, heading(deg));
          expect(body.length, `heading ${deg}: a player marker is drawn`).toBeGreaterThan(0);
          expectInsideMap([...body, ...ticks], `heading ${deg}`);
        }
      });

      it.each(PLAYER_OUTSIDE)(
        'draws a player %s at the edge, in that direction',
        (_n, position) => {
          const { body } = playerMarker(position);
          expectAtTheEdgeToward(body, position, 'player marker');
        }
      );

      it.each(PLAYER_OUTSIDE)('draws a player %s hollow, with an outward tick', (_n, position) => {
        const colour = playerColour();
        for (const deg of [0, 135]) {
          const what = `heading ${deg}`;
          const { body, ticks } = playerMarker(position, heading(deg));
          // 空心：轮廓用玩家的颜色描，里面不用它填
          expect(
            body.filter((shape) => shape.paint === 'fill' && shape.style === colour),
            `${what}: not filled in the player colour`
          ).toEqual([]);
          const outline = body.filter(
            (shape) => shape.paint === 'stroke' && shape.style === colour
          );
          expect(outline.length, `${what}: outlined in the player colour`).toBeGreaterThan(0);
          expect(outline[0].alpha, `${what}: a clearly visible outline`).toBeGreaterThanOrEqual(
            0.6
          );
          expect(ticks, `${what}: exactly one tick`).toHaveLength(1);
          expect(ticks[0].style, `${what}: the tick is in the player colour`).toBe(colour);
          expectOutwardTick(ticks[0], body, position, what);
        }
      });

      it.each(PLAYER_OUTSIDE)('still shows the heading of a player %s', (_n, position) => {
        const cases: Array<[deg: number, dx: number, dy: number]> = [
          [0, 0, -1],
          [90, 1, 0],
          [180, 0, 1],
          [270, -1, 0],
        ];
        for (const [deg, dx, dy] of cases) {
          const { body } = playerMarker(position, heading(deg));
          const vertices = body[0].subpaths.flatMap((sub) => sub.points);
          const distinct = vertices.filter(
            (p, index) =>
              vertices.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6) === index
          );
          const mean = {
            x: distinct.reduce((sum, p) => sum + p.x, 0) / distinct.length,
            y: distinct.reduce((sum, p) => sum + p.y, 0) / distinct.length,
          };
          const tip = distinct.reduce((best, p) =>
            Math.hypot(p.x - mean.x, p.y - mean.y) > Math.hypot(best.x - mean.x, best.y - mean.y)
              ? p
              : best
          );
          const pointing = new THREE.Vector2(tip.x - mean.x, tip.y - mean.y).normalize();
          expect(pointing.dot(new THREE.Vector2(dx, dy)), `heading ${deg}`).toBeGreaterThan(0.96);
        }
      });

      it.each(PLAYER_INSIDE)(
        'draws a player in / at %s the usual way: filled, no tick',
        (_n, position) => {
          const colour = playerColour();
          const { body, ticks } = playerMarker(position, heading(60));
          expect(
            body.filter((shape) => shape.paint === 'fill' && shape.style === colour).length,
            'filled in the player colour'
          ).toBeGreaterThan(0);
          expect(ticks, 'no outward tick').toEqual([]);
          expectInsideMap(body, 'player marker');
        }
      );

      it('draws the two styles differently on the same bearing', () => {
        // 同一条方位线上：一个刚好在范围内，一个在范围外
        const inside = playerMarker(new THREE.Vector3(MAP_EXTENT_M - 5, 200, 0), heading(30));
        const outside = playerMarker(new THREE.Vector3(MAP_EXTENT_M + 400, 200, 0), heading(30));
        const paintOf = (shapes: PaintedShape[]): string[] =>
          shapes.map((shape) => `${shape.paint} ${shape.style}`).sort();
        expect(paintOf(outside.body)).not.toEqual(paintOf(inside.body));
        expect(outside.ticks.length).toBeGreaterThan(inside.ticks.length);
      });

      it('goes back to the usual marker when the player returns inside', () => {
        const colour = playerColour();
        const away = playerMarker(new THREE.Vector3(0, 200, 2600));
        expect(away.ticks).toHaveLength(1);
        const back = playerMarker(new THREE.Vector3(0, 200, 900));
        expect(back.ticks).toEqual([]);
        expect(back.body.some((shape) => shape.paint === 'fill' && shape.style === colour)).toBe(
          true
        );
      });

      // ── 目标 ──

      interface Contact {
        body: PaintedShape[];
        ticks: PaintedShape[];
        all: PaintedShape[];
      }

      function contact(position: THREE.Vector3, kind: RadarBlipKind): Contact {
        const empty = drawn([]);
        const all = addedShapes(empty, drawn([{ position, kind }]));
        return {
          all,
          body: all.filter((shape) => !isLineSegment(shape)),
          ticks: all.filter(isLineSegment),
        };
      }

      const CONTACT_OUTSIDE: ReadonlyArray<[name: string, position: THREE.Vector3]> = [
        ['east', new THREE.Vector3(2600, 100, -300)],
        ['north-west', new THREE.Vector3(-1700, 100, -2900)],
        ['far south', new THREE.Vector3(0, 100, 5000)],
        ['just past the west edge', new THREE.Vector3(-1510, 100, 40)],
        ['south-east corner', new THREE.Vector3(2200, 100, 2200)],
      ];

      it.each(ALL_KINDS)('keeps a far %s fully inside the panel, tick included', (kind) => {
        for (const [name, position] of CONTACT_OUTSIDE) {
          const marker = contact(position, kind);
          expect(marker.all.length, `${name}: the contact is drawn`).toBeGreaterThan(0);
          expectInsideMap(marker.all, name);
        }
      });

      it.each(ALL_KINDS)('puts a far %s at the edge, in its direction', (kind) => {
        for (const [name, position] of CONTACT_OUTSIDE) {
          const marker = contact(position, kind);
          expect(marker.body.length, `${name}: a marker body`).toBeGreaterThan(0);
          expectAtTheEdgeToward(marker.body, position, name);
        }
      });

      it.each(ALL_KINDS)('draws a far %s as a hollow rim marker with an outward tick', (kind) => {
        const near = contact(new THREE.Vector3(500, 100, -200), kind);
        expect(near.ticks, 'in range: no tick').toEqual([]);
        const colours = new Set(near.all.map((shape) => shape.style));

        for (const [name, position] of CONTACT_OUTSIDE) {
          const marker = contact(position, kind);
          expect(
            marker.all.filter((shape) => shape.paint === 'fill'),
            `${name}: hollow`
          ).toEqual([]);
          expect(marker.ticks, `${name}: exactly one tick`).toHaveLength(1);
          expectOutwardTick(marker.ticks[0], marker.body, position, name);
          // 还是这一类目标的颜色
          for (const shape of marker.all) {
            expect(colours.has(shape.style), `${name}: ${shape.style} is the ${kind} colour`).toBe(
              true
            );
          }
        }
      });

      it.each(ALL_KINDS)('draws an in-range %s the same anywhere on the map', (kind) => {
        // 范围内的画法不变：靠近边缘的目标与地图中间的目标是同一个符号，只是位置不同
        const middle = contact(new THREE.Vector3(100, 100, -100), kind);
        const edge = contact(new THREE.Vector3(1450, 100, -1450), kind);
        const paintOf = (marker: Contact): string[] =>
          marker.all.map((shape) => `${shape.paint} ${shape.style} ${shape.alpha}`);
        expect(paintOf(edge)).toEqual(paintOf(middle));
        expect(edge.ticks).toEqual([]);
        // 画在它真实的位置上：两个目标相距 1350 米（东西、南北各一份）
        const span = centreOf(edge.body).x - centreOf(middle.body).x;
        expect(centreOf(middle.body).y - centreOf(edge.body).y).toBeCloseTo(span, 0);
        expect(span / 1350).toBeCloseTo(pixelsPerMetre(), 2);
      });

      it('draws far contacts and a far player together, all inside the panel', () => {
        const farPlayer = new THREE.Vector3(-2400, 200, -2400);
        const blips: RadarBlip[] = ALL_KINDS.map((kind, index) => ({
          kind,
          position: new THREE.Vector3(
            Math.cos(index * 0.7) * 3000,
            100,
            Math.sin(index * 0.7) * 3000
          ),
        }));
        const empty = drawn([], NORTH, new THREE.Vector3(0, 200, 0));
        const added = addedShapes(empty, drawn(blips, heading(45), farPlayer));
        const markers = added.filter((shape) => shape.paint !== 'text');
        expect(
          markers.filter(isLineSegment).length,
          'one tick per contact and one for the player'
        ).toBe(ALL_KINDS.length + 1);
        expectInsideMap(markers, 'everything drawn');
      });
    });

    describe('terrain', () => {
      interface Sampled {
        x: number;
        z: number;
      }

      function recordingSampler(
        water: (x: number, z: number) => boolean,
        calls: Sampled[]
      ): RadarTerrainSampler {
        return (x, z) => {
          calls.push({ x, z });
          // 陆地有起伏：从西到东升高
          return { y: water(x, z) ? 0 : 20 + (x + 1500) * 0.05, water: water(x, z) };
        };
      }

      /** 展开并刷新到底图采样完成（实现可以分几帧采） */
      function openWithSampler(sampler: RadarTerrainSampler | null, level = 1): void {
        create();
        radar.setTerrainSource(sampler, level);
        map = openMap();
        surface = recording.of(map.querySelector('canvas')) as CanvasRecorder;
        for (let i = 0; i < 40; i++) {
          radar.setTerrainSource(sampler, level);
          frame();
        }
      }

      function paintedImages(): Array<{ data: Uint8ClampedArray; width: number; height: number }> {
        return recording.recorders.flatMap((recorder) => recorder.images);
      }

      function pixel(
        image: { data: Uint8ClampedArray; width: number; height: number },
        u: number,
        v: number
      ): string {
        const x = Math.min(image.width - 1, Math.floor(u * image.width));
        const y = Math.min(image.height - 1, Math.floor(v * image.height));
        const offset = (y * image.width + x) * 4;
        return Array.from(image.data.slice(offset, offset + 3)).join(',');
      }

      it('samples the whole level through the sampler given to setTerrainSource', () => {
        const calls: Sampled[] = [];
        openWithSampler(recordingSampler((_x, z) => z < 0, calls));

        expect(calls.length).toBeGreaterThan(100);
        const xs = calls.map((call) => call.x);
        const zs = calls.map((call) => call.z);
        expect(Math.min(...xs)).toBeLessThan(-BOUNDARY_RADIUS_M * 0.9);
        expect(Math.max(...xs)).toBeGreaterThan(BOUNDARY_RADIUS_M * 0.9);
        expect(Math.min(...zs)).toBeLessThan(-BOUNDARY_RADIUS_M * 0.9);
        expect(Math.max(...zs)).toBeGreaterThan(BOUNDARY_RADIUS_M * 0.9);
        expect(calls.every((call) => Number.isFinite(call.x) && Number.isFinite(call.z))).toBe(
          true
        );
      });

      it('paints water and land differently, north at the top', () => {
        openWithSampler(recordingSampler((_x, z) => z < 0, []));
        const images = paintedImages();
        expect(images.length, 'a terrain image was painted').toBeGreaterThan(0);
        const image = images[images.length - 1];

        // 北半边（z < 0）是水：上半张图同一个颜色，下半张图是陆地（另一种颜色）
        const water = pixel(image, 0.5, 0.1);
        expect(pixel(image, 0.1, 0.25)).toBe(water);
        expect(pixel(image, 0.9, 0.4)).toBe(water);
        for (const [u, v] of [
          [0.5, 0.9],
          [0.1, 0.6],
          [0.9, 0.75],
        ]) {
          expect(pixel(image, u, v), `land at (${u}, ${v})`).not.toBe(water);
        }
      });

      it('paints west on the left and east on the right', () => {
        openWithSampler(recordingSampler((x) => x < 0, []));
        const images = paintedImages();
        expect(images.length).toBeGreaterThan(0);
        const image = images[images.length - 1];

        const water = pixel(image, 0.1, 0.5);
        expect(pixel(image, 0.4, 0.1)).toBe(water);
        expect(pixel(image, 0.25, 0.9)).toBe(water);
        expect(pixel(image, 0.9, 0.5)).not.toBe(water);
        expect(pixel(image, 0.6, 0.1)).not.toBe(water);
      });

      it('puts the terrain image on the map', () => {
        openWithSampler(recordingSampler((_x, z) => z < 0, []));
        const terrain = recording.recorders.filter((recorder) => recorder.images.length > 0);
        expect(terrain.length).toBeGreaterThan(0);
        const blitted = new Set(recording.recorders.flatMap((recorder) => recorder.blits));
        expect(terrain.some((recorder) => blitted.has(recorder.canvas))).toBe(true);
      });

      function gridLines(): { vertical: number; horizontal: number } {
        let vertical = 0;
        let horizontal = 0;
        const side = px((mapNode() as HTMLElement).style.width);
        for (const shape of layerShapes()) {
          if (shape.paint !== 'stroke') continue;
          for (const sub of shape.subpaths) {
            if (sub.arcs.length > 0 || sub.points.length !== 2) continue;
            const [a, b] = sub.points;
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length < side * 0.5) continue;
            if (Math.abs(a.x - b.x) < 0.01) vertical++;
            if (Math.abs(a.y - b.y) < 0.01) horizontal++;
          }
        }
        return { vertical, horizontal };
      }

      it('falls back to a plain grid without a sampler', () => {
        openWithSampler(null);
        expect(mapShown()).toBe(true);
        expect(paintedImages(), 'no terrain image').toHaveLength(0);
        const lines = gridLines();
        expect(lines.vertical, 'vertical grid lines').toBeGreaterThanOrEqual(3);
        expect(lines.horizontal, 'horizontal grid lines').toBeGreaterThanOrEqual(3);
      });

      it('still draws contacts over the plain grid', () => {
        openWithSampler(null);
        surface.clear();
        frame([]);
        const empty = copyShapes(surface.shapes);
        surface.clear();
        frame([{ position: new THREE.Vector3(300, 0, 300), kind: 'enemy-ground' }]);
        expect(addedShapes(empty, surface.shapes).length).toBeGreaterThan(0);
      });

      it('samples the new level after a level change', () => {
        const first: Sampled[] = [];
        const second: Sampled[] = [];
        const levelOne = recordingSampler((_x, z) => z < 0, first);
        const levelTwo = recordingSampler((x) => x < 0, second);
        openWithSampler(levelOne, 1);
        expect(first.length).toBeGreaterThan(100);

        radar.setTerrainSource(levelTwo, 2);
        frame();
        expect(mapShown(), 'the level change collapses the map').toBe(false);
        const sampledBefore = first.length;
        press('KeyN', 'n');
        expect(mapShown()).toBe(true);
        for (let i = 0; i < 40; i++) {
          radar.setTerrainSource(levelTwo, 2);
          frame();
        }
        expect(second.length).toBeGreaterThan(100);
        expect(first.length, 'the old level is not sampled any more').toBe(sampledBefore);
      });
    });
  });

  // ───────────────────────────── dispose ─────────────────────────────

  describe('dispose()', () => {
    it('the listener tracker sees listeners on window, document and elements', () => {
      const tracker = trackListeners();
      try {
        const element = document.createElement('div');
        const noop = (): void => undefined;
        const targets: EventTarget[] = [window, document, element];
        for (const target of targets) target.addEventListener('keydown', noop, true);
        expect(tracker.live.map((entry) => entry.target)).toEqual(targets);
        for (const target of targets) target.removeEventListener('keydown', noop, true);
        expect(tracker.live).toEqual([]);
      } finally {
        tracker.stop();
      }
    });

    it.each([
      ['desktop', DESKTOP],
      ['touch', PHONE_PORTRAIT],
    ] as const)('removes the elements and every listener it added (%s)', (_name, target) => {
      const tracker = trackListeners();
      try {
        create(target);
        radar.setTerrainSource(() => ({ y: 0, water: false }), 1);
        openMap();
        frame();
        press('KeyN', 'n');
        frame();
        press('KeyN', 'n');
        expect(tracker.live.length, 'the radar listens for input').toBeGreaterThan(0);
        expect(mapNode()).toBeTruthy();

        radar.dispose();

        expect(document.getElementById('radar-minimap')).toBeNull();
        expect(document.getElementById('radar-map')).toBeNull();
        expect(describeListeners(tracker.live), 'listeners left behind').toEqual([]);
      } finally {
        tracker.stop();
      }
    });

    it('does nothing on N or Escape afterwards, and lets Escape through', () => {
      create();
      openMap();
      radar.dispose();

      const pause = vi.fn();
      const onKey = (event: Event): void => {
        if ((event as KeyboardEvent).code === 'Escape') pause();
      };
      window.addEventListener('keydown', onKey);
      try {
        expect(() => press('KeyN', 'n')).not.toThrow();
        expect(document.getElementById('radar-map')).toBeNull();
        press('Escape');
        expect(pause).toHaveBeenCalledTimes(1);
        expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
        expect(document.getElementById('radar-minimap')).toBeNull();
      } finally {
        window.removeEventListener('keydown', onKey);
      }
    });

    it('stops following the language and the HUD anchors', () => {
      const observers: Array<{ disconnected: boolean }> = [];
      class FakeResizeObserver {
        public readonly state = { disconnected: false };
        constructor() {
          observers.push(this.state);
        }
        observe(): void {
          this.state.disconnected = false;
        }
        unobserve(): void {}
        disconnect(): void {
          this.state.disconnected = true;
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      try {
        const hud = document.createElement('div');
        hud.id = 'hud';
        const cabin = document.createElement('div');
        cabin.className = 'hud-cabin';
        hud.appendChild(cabin);
        document.body.appendChild(hud);

        create(PHONE_LANDSCAPE);
        const node = radarNode();
        const label = node.getAttribute('aria-label');
        radar.dispose();

        expect(observers.every((observer) => observer.disconnected)).toBe(true);
        setLocale('zh-CN');
        expect(node.getAttribute('aria-label'), 'a disposed radar is not relabelled').toBe(label);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('can be disposed twice and without ever opening the map', () => {
      create();
      frame();
      expect(() => {
        radar.dispose();
        radar.dispose();
      }).not.toThrow();
      expect(document.getElementById('radar-minimap')).toBeNull();
    });
  });
});
