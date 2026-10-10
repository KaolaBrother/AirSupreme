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
  centreOf,
  copyShapes,
  installCanvasRecording,
  isLineSegment,
  type CanvasRecorder,
  type CanvasRecording,
  type PaintedShape,
  type Point,
} from './canvasRecorder';
import { resetLocale } from './i18nTestUtils';

/**
 * 展开的关卡地图（规格 M7）：点击 / 轻触雷达或按 N 展开一张更大的、北朝上的地图（#radar-map），
 * 再点地图、按 N 或 Esc 收起。地图开着时 Esc 只收起地图，不再传给暂停；雷达与地图上的指针 /
 * 触摸 / 点击不冒泡到 document。换关、雷达停刷超过约 1.5 秒后收起。地图上有带航向的玩家、
 * 全部目标、1350 米边界和当前语言的图例；地形底图来自 setTerrainSource 的采样器，没有采样器时
 * 只画网格。dispose() 移除元素与它加过的全部监听。
 *
 * 时间用可控的 performance.now；画布用记录型上下文。
 */

const BOUNDARY_RADIUS_M = 1350;
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
  });

  afterEach(() => {
    radar?.dispose();
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
    interface Registration {
      target: EventTarget;
      type: string;
      listener: unknown;
      capture: boolean;
    }

    function captureOf(options: unknown): boolean {
      if (typeof options === 'boolean') return options;
      return typeof options === 'object' && options !== null
        ? (options as AddEventListenerOptions).capture === true
        : false;
    }

    type ListenerOwner = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

    /**
     * 记录雷达存活期间加上、还没移除的监听。
     * 测试环境里 window 的 addEventListener 是它自己的（绑定过的）方法，不走
     * EventTarget.prototype，所以两处都要接管：原型管元素与 document，window 单独管。
     */
    function trackListeners(): { live: Registration[]; stop(): void } {
      const live: Registration[] = [];
      const restores: Array<() => void> = [];

      const watch = (owner: ListenerOwner, fixedTarget: EventTarget | null): void => {
        const originalAdd = owner.addEventListener;
        const originalRemove = owner.removeEventListener;
        const add = vi.spyOn(owner, 'addEventListener').mockImplementation(function (
          this: EventTarget,
          type,
          listener,
          options
        ) {
          const target = fixedTarget ?? this;
          live.push({ target, type, listener, capture: captureOf(options) });
          return Reflect.apply(originalAdd, target, [type, listener, options]);
        });
        const remove = vi.spyOn(owner, 'removeEventListener').mockImplementation(function (
          this: EventTarget,
          type,
          listener,
          options
        ) {
          const target = fixedTarget ?? this;
          const capture = captureOf(options);
          const index = live.findIndex(
            (entry) =>
              entry.target === target &&
              entry.type === type &&
              entry.listener === listener &&
              entry.capture === capture
          );
          if (index >= 0) live.splice(index, 1);
          return Reflect.apply(originalRemove, target, [type, listener, options]);
        });
        restores.push(() => {
          add.mockRestore();
          remove.mockRestore();
        });
      };

      watch(EventTarget.prototype, null);
      if (window.addEventListener !== EventTarget.prototype.addEventListener) {
        watch(window, window);
      }
      return {
        live,
        stop() {
          for (const restore of restores.reverse()) restore();
        },
      };
    }

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

    function describeTarget(target: EventTarget): string {
      if (target === window) return 'window';
      if (target === document) return 'document';
      if (target instanceof HTMLElement) return `<${target.tagName.toLowerCase()}#${target.id}>`;
      return String(target);
    }

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
        expect(
          tracker.live.map((entry) => `${entry.type} on ${describeTarget(entry.target)}`),
          'listeners left behind'
        ).toEqual([]);
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
