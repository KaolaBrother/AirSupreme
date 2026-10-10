import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import {
  angleDelta,
  boxOf,
  clearanceOf,
  gapBetween,
  partsOf,
  readChevron,
  px,
  type DrawnChevron,
  type Point,
  type Rect,
} from './chevronDom';
import { describeListeners, trackListeners } from './listenerTracker';
import { seedShippedMobileControls } from './touchTestUtils';

/**
 * 屏幕外箭头避开触控控件（规格 P1）：
 * - 触控布局、#mobile-controls 显示时，箭头（40px 的箭头盒与它的距离标签）不画在 #joystick、任何
 *   可见的 .touch-btn 或 #radar-minimap 周围 8px 之内，并且整个留在视口内；本来会落在遮挡上的
 *   箭头朝屏幕中心移开，指向不变。
 * - #mobile-controls 不显示或是空的：只避开雷达。
 * - 遮挡的位置不逐帧量：第一次更新量一次，之后大约每秒一次；触摸按下 / 抬起、窗口变化之后很快
 *   补量一次（浮动摇杆会移位）。
 * - dispose() 移除它加在 window 上的监听。
 *
 * jsdom 不做布局：遮挡的矩形由这里的 getBoundingClientRect 替身给出（display:none 的元素及其
 * 后代返回空矩形，与浏览器一致）；箭头画在哪里按它的内联样式还原（见 chevronDom.ts：盒子以
 * left / top 为中心，标签是一行 11px 粗体 Arial，宽度按 Arial Bold 的字宽算）。
 */

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const TABLET_LANDSCAPE: Viewport = { name: 'tablet, landscape', width: 1180, height: 820 };
const TABLET_PORTRAIT: Viewport = { name: 'tablet, portrait', width: 820, height: 1180 };
const PHONE_LANDSCAPE: Viewport = { name: 'phone, landscape', width: 844, height: 390 };
const PHONE_PORTRAIT: Viewport = { name: 'phone, portrait', width: 390, height: 844 };
const DESKTOP: Viewport = { name: 'desktop', width: 1280, height: 800 };
const TOUCH_VIEWPORTS = [TABLET_LANDSCAPE, TABLET_PORTRAIT, PHONE_LANDSCAPE, PHONE_PORTRAIT];

/** 规格里的留白 */
const CLEARANCE_PX = 8;
/** 箭头按整像素落位：允许半个像素的取整误差 */
const ROUNDING_PX = 0.5;

/**
 * 右手按键簇，取自发布版 index.html 的样式：每个按键的中心到簇右下角的距离 (--x, --y) 与直径 (--s)，
 * 顺序与页面里的按键一致（开火、导弹、特武、热焰、加速、切换、视角、暂停）。
 * 平板沿用横屏的那一套并整体 ×1.35；手机竖屏另有一套。
 */
type ButtonArc = ReadonlyArray<readonly [x: number, y: number, size: number]>;
const LANDSCAPE_ARC: ButtonArc = [
  [44, 44, 72],
  [132, 36, 58],
  [116, 112, 60],
  [40, 130, 54],
  [216, 34, 54],
  [196, 108, 44],
  [120, 186, 44],
  [40, 204, 44],
];
const PHONE_PORTRAIT_ARC: ButtonArc = [
  [40, 44, 66],
  [124, 34, 56],
  [112, 112, 58],
  [36, 132, 52],
  [40, 212, 52],
  [182, 100, 44],
  [120, 192, 44],
  [186, 176, 44],
];
/** 横屏那一套里最靠左的按键（加速）：隐藏它会让按键簇的左边界右移 */
const LEFTMOST_BUTTON_INDEX = 4;

interface TouchLayout {
  controls: Rect;
  stickZone: Rect;
  stick: Rect;
  buttons: Rect[];
  radar: Rect;
}

/** 与发布版样式同一量级的触控布局：摇杆左下、按键簇右下、雷达在左上状态栏下面 */
function touchLayoutFor(viewport: Viewport, buttonCount: number): TouchLayout {
  const { width, height } = viewport;
  const tablet = Math.min(width, height) >= 700;
  const portrait = height > width;
  const scale = tablet ? 1.35 : 1;
  const inset = tablet ? 28 : 20;
  const lift = tablet ? Math.round(height * 0.1) : 20;
  const stickSize = tablet ? 150 : portrait ? 96 : 108;
  const arc = portrait && !tablet ? PHONE_PORTRAIT_ARC : LANDSCAPE_ARC;
  const cornerX = width - inset;
  const cornerY = height - lift;
  const radarSize = tablet ? 132 : 84;
  const stickZoneTop = Math.round(height * 0.38);
  return {
    controls: { left: 0, top: height * 0.65, width, height: height * 0.35 },
    stickZone: { left: 0, top: stickZoneTop, width: width * 0.42, height: height - stickZoneTop },
    stick: { left: inset, top: height - lift - stickSize, width: stickSize, height: stickSize },
    buttons: Array.from({ length: buttonCount }, (_unused, index) => {
      const [x, y, size] = arc[index % arc.length];
      const scaled = size * scale;
      return {
        left: cornerX - x * scale - scaled / 2,
        top: cornerY - y * scale - scaled / 2,
        width: scaled,
        height: scaled,
      };
    }),
    radar: {
      left: 12,
      top: portrait ? Math.max(110, stickZoneTop - 8 - radarSize) : 110,
      width: radarSize,
      height: radarSize,
    },
  };
}

function desktopRadar(viewport: Viewport): Rect {
  return { left: 16, top: viewport.height - 16 - 120, width: 120, height: 120 };
}

/** 一个屏幕外的目标：roll 是它在屏幕平面上的方位（0 = 正上方，顺时针），offAxis 是偏离视线的角度 */
interface Target {
  mesh: THREE.Object3D;
  roll: number;
  offAxis: number;
  distance: number;
}

type HealthBarInputs = Parameters<EnemyHealthBars['update']>[0];

const ROLL_STEP_DEG = 7.5;
const OFF_AXIS_RINGS_DEG = [75, 110, 150];
const DISTANCES_M = [320, 480, 1250, 3400, 12800];
/** 每次更新飞过的距离（米）：相机在动，血条层才会重算箭头 */
const FLIGHT_STEP_M = 1.5;

describe('off-screen chevrons and the touch controls', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let viewport: Viewport;
  let bars: EnemyHealthBars | null;
  let camera: THREE.PerspectiveCamera;
  let targets: Target[];
  let inputs: HealthBarInputs;
  /** 夹具元素的布局矩形（没有登记的元素是空矩形） */
  let rects: Map<Element, Rect>;
  /** 布局读取次数（getBoundingClientRect / offset* / client* / getComputedStyle 等） */
  let layoutReads: number;
  let restoreGetters: Array<() => void>;
  const playerPosition = new THREE.Vector3();

  function isRendered(element: Element): boolean {
    if (!element.isConnected) return false;
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (node instanceof HTMLElement && node.style.display === 'none') return false;
    }
    return true;
  }

  function installLayout(): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      layoutReads++;
      const rect = (isRendered(this) ? rects.get(this) : undefined) ?? {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      };
      return {
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
      } as DOMRect;
    });
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(() => {
      layoutReads++;
      return [] as unknown as DOMRectList;
    });
    // 其余会强制布局的读取：只计数，值照旧
    const getters: Array<[object, string[]]> = [
      [HTMLElement.prototype, ['offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop']],
      [Element.prototype, ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight']],
    ];
    for (const [owner, names] of getters) {
      for (const name of names) {
        const descriptor = Object.getOwnPropertyDescriptor(owner, name);
        const original = descriptor?.get;
        if (!descriptor || !original) continue;
        Object.defineProperty(owner, name, {
          ...descriptor,
          get(this: unknown) {
            layoutReads++;
            return Reflect.apply(original, this, []) as unknown;
          },
        });
        restoreGetters.push(() => Object.defineProperty(owner, name, descriptor));
      }
    }
    const originalComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      layoutReads++;
      return originalComputedStyle(element, pseudo);
    });
  }

  function setViewport(next: Viewport): void {
    viewport = next;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: next.width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: next.height });
    if (camera) {
      camera.aspect = next.width / next.height;
      camera.updateProjectionMatrix();
    }
  }

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    document.body.innerHTML = '';
    rects = new Map();
    layoutReads = 0;
    restoreGetters = [];
    bars = null;
    targets = [];
    inputs = [];
    installLayout();
  });

  afterEach(() => {
    bars?.dispose();
    bars = null;
    vi.restoreAllMocks();
    for (const restore of restoreGetters) restore();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  // ───────────────────────────── 夹具：控件与雷达 ─────────────────────────────

  interface Controls {
    root: HTMLElement;
    stick: HTMLElement;
    buttons: HTMLElement[];
    layout: TouchLayout;
  }

  /** 发布版 index.html 的 #mobile-controls（会清空 body），按 touchLayoutFor 摆好 */
  function mountControls(): Controls {
    const root = seedShippedMobileControls();
    root.classList.add('is-visible');
    const stick = root.querySelector<HTMLElement>('#joystick');
    const zone = root.querySelector<HTMLElement>('#touch-stick-zone');
    const buttons = Array.from(root.querySelectorAll<HTMLElement>('.touch-btn'));
    expect(stick, 'index.html ships #joystick inside #mobile-controls').toBeTruthy();
    expect(buttons.length, 'index.html ships .touch-btn buttons').toBeGreaterThan(0);

    const layout = touchLayoutFor(viewport, buttons.length);
    rects.set(root, layout.controls);
    if (zone) rects.set(zone, layout.stickZone);
    rects.set(stick as HTMLElement, layout.stick);
    buttons.forEach((button, index) => rects.set(button, layout.buttons[index]));
    return { root, stick: stick as HTMLElement, buttons, layout };
  }

  function mountRadar(rect: Rect): HTMLElement {
    const radar = document.createElement('div');
    radar.id = 'radar-minimap';
    document.body.appendChild(radar);
    rects.set(radar, rect);
    return radar;
  }

  // ───────────────────────────── 夹具：场景 ─────────────────────────────

  /** 相机朝任意一个方向（不是轴向），四周一圈圈屏幕外的目标 */
  function createScene(rings: readonly number[] = OFF_AXIS_RINGS_DEG): void {
    camera = new THREE.PerspectiveCamera(75, viewport.width / viewport.height, 0.1, 50000);
    camera.position.set(140, 620, -90);
    camera.rotation.set(
      THREE.MathUtils.degToRad(-12),
      THREE.MathUtils.degToRad(33),
      THREE.MathUtils.degToRad(4),
      'YXZ'
    );
    camera.updateMatrixWorld(true);
    playerPosition.copy(camera.position);

    targets = [];
    for (const offAxis of rings) {
      for (let roll = 0; roll < 360; roll += ROLL_STEP_DEG) {
        const distance = DISTANCES_M[targets.length % DISTANCES_M.length];
        const off = THREE.MathUtils.degToRad(offAxis);
        const around = THREE.MathUtils.degToRad(roll);
        // 相机坐标：x 右、y 上、-z 前
        const local = new THREE.Vector3(
          Math.sin(around) * Math.sin(off),
          Math.cos(around) * Math.sin(off),
          -Math.cos(off)
        ).multiplyScalar(distance);
        const mesh = new THREE.Object3D();
        mesh.name = `ENEMY_FIGHTER_${targets.length}`;
        mesh.position.copy(local.applyQuaternion(camera.quaternion)).add(camera.position);
        mesh.updateMatrixWorld(true);
        targets.push({ mesh, roll, offAxis, distance });
      }
    }
    inputs = targets.map((target) => ({ mesh: target.mesh, currentHealth: 40, maxHealth: 50 }));
    bars = new EnemyHealthBars();
  }

  /**
   * 飞过若干次更新：玩家（相机）与目标以同样的速度前进，方位不变。
   * 返回每次更新里的布局读取次数。
   */
  function fly(updates: number = 1): number[] {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const reads: number[] = [];
    for (let i = 0; i < updates; i++) {
      camera.position.addScaledVector(forward, FLIGHT_STEP_M);
      camera.updateMatrixWorld(true);
      playerPosition.copy(camera.position);
      for (const target of targets) {
        target.mesh.position.addScaledVector(forward, FLIGHT_STEP_M);
        target.mesh.updateMatrixWorld(true);
      }
      const before = layoutReads;
      (bars as EnemyHealthBars).update(inputs, [], camera, playerPosition);
      reads.push(layoutReads - before);
    }
    return reads;
  }

  /** 一直飞到又量了一次遮挡为止；返回用了多少次更新 */
  function flyUntilMeasured(limit: number = 400): number {
    for (let count = 1; count <= limit; count++) {
      if (fly(1)[0] > 0) return count;
    }
    throw new Error(`the obstacles were not measured again within ${limit} updates`);
  }

  function chevronElements(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>('#enemy-health-bars .enemy-arrow-indicator')
    );
  }

  /** 当前画着的箭头，按目标的顺序（每个目标一枚） */
  function drawnChevrons(): DrawnChevron[] {
    const elements = chevronElements();
    expect(elements, 'one chevron per off-screen target').toHaveLength(targets.length);
    return elements.map((element, index) => {
      expect(element.style.display, `chevron ${index} is displayed`).not.toBe('none');
      expect(element.style.visibility, `chevron ${index} is visible`).not.toBe('hidden');
      return readChevron(element, viewport);
    });
  }

  const describeTarget = (target: Target): string =>
    `target at bearing ${target.roll}°, ${target.offAxis}° off axis, ${target.distance} m`;

  function expectClearOf(
    chevrons: readonly DrawnChevron[],
    obstacles: ReadonlyArray<[name: string, rect: Rect]>
  ): void {
    const problems: string[] = [];
    chevrons.forEach((chevron, index) => {
      for (const [part, box] of partsOf(chevron)) {
        for (const [name, rect] of obstacles) {
          const gap = gapBetween(box, boxOf(rect));
          if (gap < CLEARANCE_PX - ROUNDING_PX) {
            problems.push(
              `${describeTarget(targets[index])}: ${part} is ${gap.toFixed(1)} px from ${name}`
            );
          }
        }
      }
    });
    expect(problems, 'chevrons within 8 px of an obstacle').toEqual([]);
  }

  function expectInsideViewport(chevrons: readonly DrawnChevron[]): void {
    const problems: string[] = [];
    chevrons.forEach((chevron, index) => {
      for (const [part, box] of partsOf(chevron)) {
        if (
          box.left < -ROUNDING_PX ||
          box.top < -ROUNDING_PX ||
          box.right > viewport.width + ROUNDING_PX ||
          box.bottom > viewport.height + ROUNDING_PX
        ) {
          problems.push(
            `${describeTarget(targets[index])}: ${part} spans x ${box.left.toFixed(1)}..` +
              `${box.right.toFixed(1)}, y ${box.top.toFixed(1)}..${box.bottom.toFixed(1)}`
          );
        }
      }
    });
    expect(problems, `chevrons outside the ${viewport.width}×${viewport.height} viewport`).toEqual(
      []
    );
  }

  function obstaclesOf(controls: Controls | null, radar: Rect | null): Array<[string, Rect]> {
    const list: Array<[string, Rect]> = [];
    if (radar) list.push(['#radar-minimap', radar]);
    if (controls) {
      list.push(['#joystick', rects.get(controls.stick) as Rect]);
      controls.buttons.forEach((button) => {
        if (isRendered(button)) list.push([`#${button.id}`, rects.get(button) as Rect]);
      });
    }
    return list;
  }

  /** 完整的触控场景：控件 + 雷达 + 一圈圈目标，飞过第一次更新 */
  function touchScene(target: Viewport): { controls: Controls; radar: Rect } {
    setViewport(target);
    const controls = mountControls();
    mountRadar(controls.layout.radar);
    createScene();
    fly(1);
    return { controls, radar: controls.layout.radar };
  }

  /** 同一个场景、换一套夹具时箭头画在哪里（用完即弃） */
  function chevronsWith(target: Viewport, mount: () => void): DrawnChevron[] {
    bars?.dispose();
    document.body.innerHTML = '';
    rects.clear();
    setViewport(target);
    mount();
    createScene();
    fly(1);
    const chevrons = drawnChevrons();
    (bars as EnemyHealthBars).dispose();
    bars = null;
    return chevrons;
  }

  /** 没有任何遮挡时箭头画在哪里 */
  function unobstructed(target: Viewport): DrawnChevron[] {
    return chevronsWith(target, () => undefined);
  }

  const centresOf = (chevrons: readonly DrawnChevron[]): Point[] =>
    chevrons.map((chevron) => chevron.centre);

  // ───────────────────────────── 避开控件、留在屏幕内 ─────────────────────────────

  describe.each(TOUCH_VIEWPORTS)('on a $name screen ($width×$height)', (target) => {
    it('draws no chevron or distance label within 8 px of the stick, a button or the radar', () => {
      const { controls, radar } = touchScene(target);
      expectClearOf(drawnChevrons(), obstaclesOf(controls, radar));
    });

    it('keeps every chevron and its distance label fully inside the viewport', () => {
      touchScene(target);
      expectInsideViewport(drawnChevrons());
    });

    it('keeps them clear and on screen while flying on', () => {
      const { controls, radar } = touchScene(target);
      fly(75);
      const chevrons = drawnChevrons();
      expectClearOf(chevrons, obstaclesOf(controls, radar));
      expectInsideViewport(chevrons);
    });

    /** 没有遮挡时会落在控件上（留白之内）的箭头：[序号, 原来的样子, 移开后的样子] */
    function displaced(): Array<[index: number, before: DrawnChevron, after: DrawnChevron]> {
      const free = unobstructed(target);
      const { controls, radar } = touchScene(target);
      const moved = drawnChevrons();
      const obstacles = obstaclesOf(controls, radar).map(([, rect]) => rect);
      const list: Array<[number, DrawnChevron, DrawnChevron]> = [];
      free.forEach((before, index) => {
        if (clearanceOf(before, obstacles) < CLEARANCE_PX - ROUNDING_PX) {
          list.push([index, before, moved[index]]);
        }
      });
      expect(list.length, 'some chevrons would land on the controls').toBeGreaterThan(5);
      return list;
    }

    it('moves a chevron that would land on an obstacle, never further out toward the edge', () => {
      // 离屏幕中心有多“靠外”：0 = 正中，1 = 贴着屏幕边（沿着屏幕边滑动时不变，向内移动时变小）
      const outward = (point: Point): number =>
        Math.max(
          Math.abs(point.x - target.width / 2) / (target.width / 2),
          Math.abs(point.y - target.height / 2) / (target.height / 2)
        );
      const problems: string[] = [];
      for (const [index, before, after] of displaced()) {
        const what = describeTarget(targets[index]);
        if (after.centre.x === before.centre.x && after.centre.y === before.centre.y) {
          problems.push(`${what}: not moved`);
        } else if (outward(after.centre) > outward(before.centre) + 0.002) {
          problems.push(
            `${what}: moved outward, from (${before.centre.x}, ${before.centre.y}) ` +
              `to (${after.centre.x}, ${after.centre.y})`
          );
        }
      }
      expect(problems).toEqual([]);
    });

    /*
     * 发现（手机横屏 844×390）：按键簇从屏幕下沿一直伸到中线以上（暂停键顶端约在 y = 144），
     * 指向正右方的箭头（方位 82.5°–97.5°）本来落在右边缘中段、压在按键簇上；实现让它沿右边缘
     * 向上滑到按键簇上方（约 80px），而不是朝屏幕中心移开，结果离屏幕中心比原来更远（约 10–14px）。
     * 规格写的是“朝屏幕中心移开”。其余三种屏幕上这条成立。
     */
    const towardCentre = target === PHONE_LANDSCAPE ? it.fails : it;
    towardCentre('ends a moved chevron no farther from the screen centre than it was', () => {
      const centre = { x: target.width / 2, y: target.height / 2 };
      const problems: string[] = [];
      for (const [index, before, after] of displaced()) {
        const was = Math.hypot(before.centre.x - centre.x, before.centre.y - centre.y);
        const is = Math.hypot(after.centre.x - centre.x, after.centre.y - centre.y);
        // 本来就骑在中线上的箭头让开时会越过中线几个像素：留 2px
        if (is > was + 2) {
          problems.push(
            `${describeTarget(targets[index])}: was ${was.toFixed(0)} px from the centre, ` +
              `now ${is.toFixed(0)} px`
          );
        }
      }
      expect(problems, 'chevrons moved away from the centre').toEqual([]);
    });

    it('still points every chevron at its target', () => {
      const free = unobstructed(target);
      touchScene(target);
      const problems: string[] = [];
      drawnChevrons().forEach((chevron, index) => {
        const wanted = targets[index].roll;
        if (
          Math.abs(angleDelta(chevron.rotation, wanted)) > 2.5 ||
          chevron.rotation !== free[index].rotation
        ) {
          problems.push(
            `${describeTarget(targets[index])}: arrow rotated ${chevron.rotation}°, ` +
              `${free[index].rotation}° without obstacles`
          );
        }
      });
      expect(problems).toEqual([]);
    });

    it('shows the same distance, and leaves chevrons far from any control where they were', () => {
      const free = unobstructed(target);
      const { controls, radar } = touchScene(target);
      const obstacles = obstaclesOf(controls, radar).map(([, rect]) => rect);
      let untouched = 0;
      drawnChevrons().forEach((chevron, index) => {
        expect(chevron.text, describeTarget(targets[index])).toBe(free[index].text);
        // 离每个遮挡都很远（远过一枚箭头加按键之间的空隙）：不该被挪动
        if (clearanceOf(free[index], obstacles) > 160) {
          untouched++;
          expect(chevron.centre, describeTarget(targets[index])).toEqual(free[index].centre);
        }
      });
      expect(untouched, 'chevrons far from the controls').toBeGreaterThan(5);
    });
  });

  it.each([
    ['at the top of its zone', 0.1, 0.42],
    ['in the middle of its zone', 0.21, 0.62],
    ['at the right edge of its zone', 0.36, 0.8],
    ['low in the corner', 0.08, 0.88],
  ] as const)('avoids the floating stick wherever the thumb put it (%s)', (_name, fx, fy) => {
    setViewport(TABLET_LANDSCAPE);
    const controls = mountControls();
    mountRadar(controls.layout.radar);
    const size = controls.layout.stick.width;
    rects.set(controls.stick, {
      left: TABLET_LANDSCAPE.width * fx - size / 2,
      top: TABLET_LANDSCAPE.height * fy - size / 2,
      width: size,
      height: size,
    });
    createScene();
    fly(1);
    const chevrons = drawnChevrons();
    expectClearOf(chevrons, obstaclesOf(controls, controls.layout.radar));
    expectInsideViewport(chevrons);
  });

  /*
   * 常见的屏幕上，箭头本来就离屏幕边有一段（按屏幕尺寸的比例），标签又在箭头朝屏幕里的一侧，
   * 所以“留在视口内”很少真的起作用。窗口很小的时候这段距离比半个箭头盒 / 半个标签还短，
   * 这时才看得出箭头和标签有没有被收回视口里。
   */
  it.each([
    ['narrow', { name: 'narrow window', width: 200, height: 640 }],
    ['short', { name: 'short window', width: 640, height: 200 }],
    ['tiny', { name: 'tiny window', width: 220, height: 240 }],
  ] as const)('keeps chevrons and labels inside a %s viewport too', (_name, small) => {
    setViewport(small);
    createScene();
    fly(1);
    expectInsideViewport(drawnChevrons());
    fly(40);
    expectInsideViewport(drawnChevrons());
  });

  it('positions the chevron from its centre, in a full-screen layer, with an upright box', () => {
    touchScene(TABLET_LANDSCAPE);
    const layer = document.getElementById('enemy-health-bars') as HTMLElement;
    expect(layer.style.position).toBe('fixed');
    expect(px(layer.style.left || '0px', 'layer left')).toBe(0);
    expect(px(layer.style.top || '0px', 'layer top')).toBe(0);
    for (const element of chevronElements()) {
      expect(element.parentElement).toBe(layer);
      expect(element.style.position).toBe('absolute');
      // 这个文件按“盒子不旋转、不缩放”还原箭头的位置
      expect(element.style.transform).not.toMatch(/rotate|scale|matrix|skew/);
    }
  });

  // ───────────────────────────── 哪些东西算遮挡 ─────────────────────────────

  describe('which elements are avoided', () => {
    /** 只有雷达、没有触控控件时箭头画在哪里 */
    function radarOnly(target: Viewport, radar: Rect): DrawnChevron[] {
      return chevronsWith(target, () => {
        mountRadar(radar);
      });
    }

    it('avoids only the radar while #mobile-controls is hidden', () => {
      const layout = touchLayoutFor(TABLET_LANDSCAPE, LANDSCAPE_ARC.length);
      const expected = radarOnly(TABLET_LANDSCAPE, layout.radar);

      const hidden = chevronsWith(TABLET_LANDSCAPE, () => {
        const controls = mountControls();
        mountRadar(controls.layout.radar);
        controls.root.classList.remove('is-visible');
        controls.root.style.display = 'none';
      });
      expect(centresOf(hidden)).toEqual(centresOf(expected));
      expectClearOf(hidden, [['#radar-minimap', layout.radar]]);
      // 摇杆和按键原来的位置现在可以放箭头
      const stickAndButtons = [layout.stick, ...layout.buttons];
      expect(
        hidden.filter((chevron) => clearanceOf(chevron, stickAndButtons) < 0).length,
        'chevrons drawn where the hidden controls would be'
      ).toBeGreaterThan(3);
    });

    it('avoids only the radar while #mobile-controls is empty', () => {
      const layout = touchLayoutFor(TABLET_LANDSCAPE, LANDSCAPE_ARC.length);
      const expected = radarOnly(TABLET_LANDSCAPE, layout.radar);

      const empty = chevronsWith(TABLET_LANDSCAPE, () => {
        const controls = mountControls();
        mountRadar(controls.layout.radar);
        controls.root.innerHTML = '';
      });
      expect(centresOf(empty)).toEqual(centresOf(expected));
    });

    it('avoids nothing when there is neither a radar nor touch controls', () => {
      const free = unobstructed(PHONE_LANDSCAPE);
      const hiddenControls = chevronsWith(PHONE_LANDSCAPE, () => {
        mountControls().root.style.display = 'none';
      });
      expect(centresOf(hiddenControls)).toEqual(centresOf(free));
      expectInsideViewport(free);
    });

    it('does not avoid a touch button that is not displayed', () => {
      const all = chevronsWith(TABLET_LANDSCAPE, () => {
        const controls = mountControls();
        mountRadar(controls.layout.radar);
      });
      // 少了最左边那个按键的布局
      const without = chevronsWith(TABLET_LANDSCAPE, () => {
        const controls = mountControls();
        mountRadar(controls.layout.radar);
        const button = controls.buttons[LEFTMOST_BUTTON_INDEX];
        rects.delete(button);
        button.remove();
      });
      const hidden = chevronsWith(TABLET_LANDSCAPE, () => {
        const controls = mountControls();
        mountRadar(controls.layout.radar);
        controls.buttons[LEFTMOST_BUTTON_INDEX].style.display = 'none';
      });
      expect(centresOf(hidden)).toEqual(centresOf(without));
      expect(centresOf(hidden), 'the button mattered while it was displayed').not.toEqual(
        centresOf(all)
      );
    });

    it('does not treat the transparent stick zone as an obstacle', () => {
      const { controls } = touchScene(TABLET_LANDSCAPE);
      const zone = boxOf(controls.layout.stickZone);
      const inside = drawnChevrons().filter(
        ({ arrow }) =>
          arrow.left >= zone.left &&
          arrow.right <= zone.right &&
          arrow.top >= zone.top &&
          arrow.bottom <= zone.bottom
      );
      expect(inside.length, 'chevrons drawn inside the stick zone').toBeGreaterThan(0);
    });

    describe('on desktop (no touch controls)', () => {
      it('keeps chevrons and labels 8 px clear of the radar and on screen', () => {
        setViewport(DESKTOP);
        const radar = desktopRadar(DESKTOP);
        mountRadar(radar);
        createScene();
        fly(1);
        const chevrons = drawnChevrons();
        expectClearOf(chevrons, [['#radar-minimap', radar]]);
        expectInsideViewport(chevrons);
      });

      it('slides a chevron that would land on the radar sideways, toward the centre', () => {
        const radar = desktopRadar(DESKTOP);
        const free = unobstructed(DESKTOP);
        const moved = radarOnly(DESKTOP, radar);

        let blocked = 0;
        free.forEach((before, index) => {
          if (clearanceOf(before, [radar]) >= CLEARANCE_PX) {
            return;
          }
          blocked++;
          const after = moved[index];
          const what = describeTarget(targets[index]);
          expect(after.centre.y, `${what}: same height`).toBe(before.centre.y);
          expect(after.centre.x, `${what}: moved right, off the radar`).toBeGreaterThan(
            before.centre.x
          );
          expect(after.centre.x, `${what}: toward the centre`).toBeLessThan(DESKTOP.width / 2);
          expect(after.rotation, `${what}: same direction`).toBe(before.rotation);
        });
        expect(blocked, 'chevrons that would land on the radar').toBeGreaterThan(0);
      });
    });
  });

  // ───────────────────────────── 什么时候量 ─────────────────────────────

  describe('measuring the obstacles', () => {
    /** 把摇杆挪到一枚箭头正下方（那枚箭头就得让开） */
    function moveStickUnder(controls: Controls, chevron: DrawnChevron): Rect {
      const size = controls.layout.stick.width;
      const rect = {
        left: chevron.centre.x - size / 2,
        top: chevron.centre.y - size / 2,
        width: size,
        height: size,
      };
      rects.set(controls.stick, rect);
      return rect;
    }

    /** 左边缘中段的一枚箭头（返回它的序号）：离摇杆、雷达、按键都远 */
    function chevronOnTheLeftEdge(controls: Controls): number {
      const obstacles = obstaclesOf(controls, controls.layout.radar).map(([, rect]) => rect);
      const index = drawnChevrons().findIndex(
        (chevron) =>
          chevron.centre.x < viewport.width * 0.2 &&
          chevron.centre.y > viewport.height * 0.4 &&
          chevron.centre.y < viewport.height * 0.6 &&
          clearanceOf(chevron, obstacles) > 30
      );
      expect(index, 'a chevron on the left edge, away from the controls').toBeGreaterThanOrEqual(0);
      return index;
    }

    function stickZoneOf(controls: Controls): HTMLElement {
      const zone = controls.root.querySelector<HTMLElement>('#touch-stick-zone');
      expect(zone, 'index.html ships #touch-stick-zone').toBeTruthy();
      return zone as HTMLElement;
    }

    function touch(type: 'touchstart' | 'touchend' | 'touchcancel', target: EventTarget): void {
      target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }

    it('measures them on the first update', () => {
      setViewport(TABLET_LANDSCAPE);
      const controls = mountControls();
      mountRadar(controls.layout.radar);
      createScene();
      const [reads] = fly(1);
      expect(reads, 'layout reads on the first update').toBeGreaterThan(0);
      expectClearOf(drawnChevrons(), obstaclesOf(controls, controls.layout.radar));
    });

    it('does not read layout on most updates: only now and then, about once a second', () => {
      touchScene(TABLET_LANDSCAPE);
      const reads = fly(600);
      const measuring = reads
        .map((count, index) => (count > 0 ? index : -1))
        .filter((index) => index >= 0);

      // 600 次更新（60 fps 下 10 秒）：量过几次，但远不是每帧
      expect(measuring.length, 'updates that read layout').toBeGreaterThanOrEqual(5);
      expect(measuring.length, 'updates that read layout').toBeLessThanOrEqual(40);
      const gaps = measuring.slice(1).map((index, i) => index - measuring[i]);
      expect(Math.min(...gaps), 'updates between two measurements').toBeGreaterThanOrEqual(15);
      expect(Math.max(...gaps), 'updates between two measurements').toBeLessThanOrEqual(120);
    });

    it('reads nothing at all between two measurements, however many chevrons there are', () => {
      touchScene(PHONE_PORTRAIT);
      flyUntilMeasured();
      const quiet = fly(10);
      expect(quiet).toEqual(new Array(10).fill(0));
    });

    it('the number of layout reads does not grow with the number of chevrons', () => {
      setViewport(TABLET_LANDSCAPE);
      const controls = mountControls();
      mountRadar(controls.layout.radar);
      createScene([75]);
      const few = fly(1)[0];
      expect(targets.length).toBeLessThan(60);

      bars?.dispose();
      document.body.innerHTML = '';
      rects.clear();
      const again = mountControls();
      mountRadar(again.layout.radar);
      createScene([75, 95, 110, 130, 150]);
      expect(targets.length).toBeGreaterThan(200);
      expect(fly(1)[0]).toBe(few);
    });

    it('picks up an obstacle that moved without any event at the next periodic measurement', () => {
      const { controls } = touchScene(TABLET_LANDSCAPE);
      flyUntilMeasured();
      const victim = chevronOnTheLeftEdge(controls);
      const moved = moveStickUnder(controls, drawnChevrons()[victim]);

      // 还没到下一次量：箭头不知道摇杆挪过来了
      expect(fly(3)).toEqual([0, 0, 0]);
      expect(clearanceOf(drawnChevrons()[victim], [moved]), 'still under the stick').toBeLessThan(
        0
      );
      const waited = flyUntilMeasured(200);
      expect(waited, 'updates until the periodic measurement').toBeGreaterThan(5);
      fly(1);
      expectClearOf(drawnChevrons(), [['#joystick (moved)', moved]]);
    });

    it('measures again right after a touch starts, even when the stick zone stops the event', () => {
      const { controls } = touchScene(TABLET_LANDSCAPE);
      flyUntilMeasured();
      fly(2);
      const zone = stickZoneOf(controls);
      // 真实的摇杆监听会拦住冒泡
      zone.addEventListener('touchstart', (event) => event.stopPropagation());

      // 手指落下：浮动摇杆立刻移到落点
      const moved = moveStickUnder(controls, drawnChevrons()[chevronOnTheLeftEdge(controls)]);
      touch('touchstart', zone);
      const reads = fly(2);
      expect(
        reads.some((count) => count > 0),
        'measured within two updates of the touch'
      ).toBe(true);
      expectClearOf(drawnChevrons(), [['#joystick (under the thumb)', moved]]);
      expectInsideViewport(drawnChevrons());
    });

    it.each(['touchend', 'touchcancel'] as const)(
      'measures again soon after %s, once the stick has eased back',
      (type) => {
        const { controls } = touchScene(TABLET_LANDSCAPE);
        const home = controls.layout.stick;
        flyUntilMeasured();
        fly(2);
        const zone = stickZoneOf(controls);
        zone.addEventListener(type, (event) => event.stopPropagation());

        const held = moveStickUnder(controls, drawnChevrons()[chevronOnTheLeftEdge(controls)]);
        touch('touchstart', zone);
        fly(3);
        expectClearOf(drawnChevrons(), [['#joystick (under the thumb)', held]]);

        // 松手：摇杆用 0.18 秒（60 fps 下 11 帧）缓动回原位
        touch(type, zone);
        const SETTLE_UPDATES = 11;
        for (let step = 1; step <= SETTLE_UPDATES; step++) {
          const t = step / SETTLE_UPDATES;
          rects.set(controls.stick, {
            left: held.left + (home.left - held.left) * t,
            top: held.top + (home.top - held.top) * t,
            width: home.width,
            height: home.height,
          });
          fly(1);
        }
        // 再过不到四分之一秒：箭头已经按摇杆回到的位置摆放
        fly(14);
        const chevrons = drawnChevrons();
        expectClearOf(chevrons, obstaclesOf(controls, controls.layout.radar));
        // 手指按过的地方又可以放箭头了
        expect(
          chevrons.some((chevron) => clearanceOf(chevron, [held]) < 0),
          'a chevron is back where the thumb was'
        ).toBe(true);
      }
    );

    it('measures again right after the window is resized', () => {
      const { controls } = touchScene(TABLET_LANDSCAPE);
      flyUntilMeasured();
      fly(2);

      // 转成竖屏：控件和雷达都换了位置
      setViewport(TABLET_PORTRAIT);
      const layout = touchLayoutFor(TABLET_PORTRAIT, controls.buttons.length);
      rects.set(controls.root, layout.controls);
      rects.set(controls.stick, layout.stick);
      controls.buttons.forEach((button, index) => rects.set(button, layout.buttons[index]));
      const radar = document.getElementById('radar-minimap') as HTMLElement;
      rects.set(radar, layout.radar);
      window.dispatchEvent(new Event('resize'));

      const reads = fly(2);
      expect(
        reads.some((count) => count > 0),
        'measured within two updates of the resize'
      ).toBe(true);
      const chevrons = drawnChevrons();
      expectClearOf(chevrons, obstaclesOf(controls, layout.radar));
      expectInsideViewport(chevrons);
    });
  });

  // ───────────────────────────── 来袭导弹的告警箭头 ─────────────────────────────

  /*
   * Boss 战里来袭导弹的告警箭头（BossMissileIndicator）用的是同一个 OffscreenChevron，同样画在屏幕
   * 边上，但位置由它自己的一段代码算。规格 P1 写的是“屏幕外箭头不画在控件 8px 之内”，没有说只指
   * 目标箭头；这一轮的修复只改了目标箭头（EnemyHealthBars）。
   */
  describe('incoming-missile chevrons (BossMissileIndicator)', () => {
    let indicator: BossMissileIndicator | null = null;

    afterEach(() => {
      indicator?.dispose();
      indicator = null;
    });

    /** 同一圈屏幕外的方位上各来一枚导弹 */
    function missileScene(target: Viewport): { chevrons: DrawnChevron[]; controls: Controls } {
      setViewport(target);
      const controls = mountControls();
      mountRadar(controls.layout.radar);
      createScene();
      indicator = new BossMissileIndicator();
      indicator.update(
        targets.map((entry, index) => ({
          id: `missile-${index}`,
          worldPos: entry.mesh.position,
          distance: entry.distance,
          inView: false,
        })),
        camera
      );
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>('#boss-missile-indicators .offscreen-chevron')
      );
      expect(elements, 'one chevron per incoming missile').toHaveLength(targets.length);
      return { chevrons: elements.map((element) => readChevron(element, viewport)), controls };
    }

    it.each(TOUCH_VIEWPORTS)(
      'keeps every missile chevron and its label inside the viewport ($name)',
      (target) => {
        const { chevrons } = missileScene(target);
        expectInsideViewport(chevrons);
      }
    );

    /*
     * 发现（取决于规格 P1 的范围）：导弹告警箭头没有避让逻辑，固定画在离屏幕边 8% 的地方，
     * 会压在摇杆、右下的按键簇和雷达上（它所在的图层 z-index 46，还在触控控件 100 之下，
     * 被按键挡住）。如果 P1 只指目标箭头，这条用例应当删掉，并在规格里写明。
     */
    it.fails('keeps missile chevrons 8 px clear of the stick, the buttons and the radar', () => {
      for (const target of TOUCH_VIEWPORTS) {
        const { chevrons, controls } = missileScene(target);
        expectClearOf(chevrons, obstaclesOf(controls, controls.layout.radar));
        indicator?.dispose();
        indicator = null;
        bars?.dispose();
        bars = null;
      }
    });

    it('does put missile chevrons on the controls today (the check above can see it)', () => {
      const { chevrons, controls } = missileScene(PHONE_LANDSCAPE);
      const obstacles = obstaclesOf(controls, controls.layout.radar).map(([, rect]) => rect);
      const blocked = chevrons.filter(
        (chevron) => clearanceOf(chevron, obstacles) < CLEARANCE_PX - ROUNDING_PX
      );
      expect(blocked.length).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────── dispose ─────────────────────────────

  describe('dispose()', () => {
    it('removes the window and document listeners it added', () => {
      const tracker = trackListeners();
      try {
        touchScene(TABLET_LANDSCAPE);
        fly(40);
        const global = (): string[] =>
          describeListeners(
            tracker.live.filter((entry) => entry.target === window || entry.target === document)
          );
        expect(global().length, 'listens for touches and resizes while alive').toBeGreaterThan(0);

        (bars as EnemyHealthBars).dispose();
        bars = null;
        expect(global(), 'listeners left behind').toEqual([]);
        expect(document.getElementById('enemy-health-bars')).toBeNull();
      } finally {
        tracker.stop();
      }
    });

    it('ignores touches and resizes afterwards', () => {
      const { controls } = touchScene(TABLET_LANDSCAPE);
      (bars as EnemyHealthBars).dispose();
      bars = null;
      const before = layoutReads;
      expect(() => {
        controls.root.dispatchEvent(new Event('touchstart', { bubbles: true }));
        controls.root.dispatchEvent(new Event('touchend', { bubbles: true }));
        window.dispatchEvent(new Event('resize'));
      }).not.toThrow();
      expect(layoutReads).toBe(before);
    });

    it('can be disposed before its first update', () => {
      const tracker = trackListeners();
      try {
        const unused = new EnemyHealthBars();
        expect(() => unused.dispose()).not.toThrow();
        expect(describeListeners(tracker.live)).toEqual([]);
      } finally {
        tracker.stop();
      }
    });
  });
});
