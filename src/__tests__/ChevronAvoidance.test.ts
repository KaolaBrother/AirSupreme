import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { HUD } from '@/ui/HUD';
import {
  angleDelta,
  boxOf,
  clearanceOf,
  gapBetween,
  partsOf,
  readChevron,
  px,
  scaleOf,
  type Box,
  type DrawnChevron,
  type Point,
  type Rect,
} from './chevronDom';
import { recordDeclaredStyles, type DeclaredStyles } from './declaredStyle';
import { describeListeners, trackListeners } from './listenerTracker';
import { seedShippedMobileControls } from './touchTestUtils';

/**
 * 屏幕外箭头避开叠在它上面的东西。两种箭头用同一套规则：敌方目标箭头（EnemyHealthBars）和
 * 来袭导弹的告警箭头（BossMissileIndicator；导弹箭头会随距离放大，标签跟着外移）。
 *
 * 遮挡：
 * - #radar-minimap；
 * - 触控布局、#mobile-controls 显示时的 #joystick 和每个可见的 .touch-btn；
 * - HUD 面板 #hud-score、#hud-speed、#hud-upgrades、#hud-status、#hud-health，以及
 *   #hud-top-stack 的每个子元素（Boss 阶段条、目标卡……）。不显示的、空的不算。
 *
 * 本来会落在遮挡上的箭头：整枚（40px 的箭头盒与它的距离标签）离每个遮挡至少 8px，留在视口内，
 * 指向和距离文字不变，不被推得更靠屏幕边，也不多挪。一个空位都够不着时留在贴边的位置（仍在
 * 视口内）。
 *
 * 遮挡的位置不逐帧量：第一次更新量一次，之后大约每秒一次；触摸按下 / 抬起、窗口变化之后很快
 * 补量一次（浮动摇杆会移位）。dispose() 移除它加在 window 上的监听。
 *
 * jsdom 不做布局：遮挡的矩形由这里的 getBoundingClientRect 替身给出（display:none 的元素及其
 * 后代返回空矩形，与浏览器一致）；箭头画在哪里按它的内联样式还原（见 chevronDom.ts：盒子以
 * left / top 为中心，标签是一行 11px 粗体 Arial，宽度按 Arial Bold 的字宽算）。
 * HUD 面板用真实的 HUD 创建（元素、id、嵌套、显示与否都是产品自己的），位置按发布版样式里的
 * 锚点、间距和最小高度摆；由文字撑出来的宽高是估的（见 hudLayoutFor）。
 */

interface Viewport {
  name: string;
  width: number;
  height: number;
}

type ChevronKind = 'target' | 'missile';
const KINDS: readonly ChevronKind[] = ['target', 'missile'];

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
 * “不多挪”的容差：遮挡的留白向外取到整像素、箭头按整像素落位、实现估的标签宽度比这里按字宽
 * 算的略宽，加起来两三个像素。
 */
const MOVE_SLACK_PX = 3;
/**
 * 判断“更近的地方还有空位”时要求的留白：比规格的 8px 多 2px。实现按估出来的标签大小算留白，
 * 比这里按字宽算的略宽，恰好卡在 8px 线上的位置它会当成不够——这样的位置不算“还有空位”。
 */
const ROOMY_CLEARANCE_PX = CLEARANCE_PX + 2;
/**
 * 最大的一枚箭头（40px 的盒子加五位数的距离标签）大约占多大：标签横在箭头一侧时最宽，
 * 在箭头上 / 下方时最高。
 */
const LARGEST_CHEVRON_PX = { width: 80, height: 50 };

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

type HudDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';

function densityOf(viewport: Viewport): HudDensity {
  if (viewport === DESKTOP) return 'desktop';
  return viewport.width > viewport.height ? 'touch-landscape' : 'touch-portrait';
}

/** HUD 上这几样东西显示与否（它们平时不一定在） */
interface HudContents {
  upgrades: boolean;
  boss: boolean;
  objective: boolean;
}

interface HudLayout {
  score: Rect;
  speed: Rect;
  upgrades: Rect;
  status: Rect;
  health: Rect;
  /** 顶部消息栈这个容器（它自己横跨一整行，不算遮挡；算的是里面显示着的每一块） */
  stack: Rect;
  boss: Rect;
  objective: Rect;
}

/**
 * HUD 面板在屏幕上的位置。锚点、间距、最小高度、固定的宽高取自发布版样式
 * （hudExtrasStyles.ts 里按 data-layout-density 写的规则，和 HUD.ts 里血条的内联样式）：
 * - 左上信息栏（得分、速度竖排，强化点数在下）：桌面 (20, 18)、间距 10、每行至少 60 高；
 *   触控 (10, 10)、间距 8 / 竖屏 6、每行至少 44 / 竖屏 36 高；
 * - 右上状态列：桌面 top 66 right 20；横屏 top 10 right 10；竖屏 top 38 right 10；
 * - 血条：桌面顶部居中 250×25（top 15）；横屏顶部居中 180×20（top 10）；竖屏靠右
 *   min(150, 宽 − 190)×20（top 10, right 10）；
 * - 顶部消息栈：桌面 top 70（有 Boss 阶段条时 80）、宽 min(80vw, 460)、居中；横屏 top 38
 *   （有阶段条时 60）、宽 min(80vw, 420, 宽 − 392)、居中；竖屏 top 128、左右各留 10、整行；
 * - Boss 阶段条：桌面 / 横屏固定在血条下方居中（top 48 高 24 / top 34 高 20），竖屏在栈里占第一行
 *   （高 22）；目标卡在栈里，竖屏与栈同宽。
 * 由文字撑出来的尺寸（信息栏和状态列的宽、状态列和目标卡的高、阶段条的宽）是估的。
 */
function hudLayoutFor(viewport: Viewport, contents: HudContents): HudLayout {
  const { width } = viewport;
  const density = densityOf(viewport);
  const desktop = density === 'desktop';
  const portrait = density === 'touch-portrait';

  const inset = desktop ? 20 : 10;
  const cabinGap = desktop ? 10 : portrait ? 6 : 8;
  const rowHeight = desktop ? 60 : portrait ? 36 : 44;
  const cabinWidth = desktop ? 190 : portrait ? 140 : 150;
  const score: Rect = { left: inset, top: desktop ? 18 : 10, width: cabinWidth, height: rowHeight };
  const speed: Rect = { ...score, top: score.top + rowHeight + cabinGap };
  const upgrades: Rect = {
    ...score,
    top: speed.top + rowHeight + cabinGap,
    height: desktop ? 34 : portrait ? 24 : 28,
  };

  const [statusWidth, statusHeight] = desktop ? [170, 104] : portrait ? [170, 58] : [150, 84];
  const status: Rect = {
    left: width - inset - statusWidth,
    top: desktop ? 66 : portrait ? 38 : 10,
    width: statusWidth,
    height: statusHeight,
  };

  const healthWidth = desktop ? 250 : portrait ? Math.min(150, width - 190) : 180;
  const health: Rect = {
    left: portrait ? width - 10 - healthWidth : (width - healthWidth) / 2,
    top: desktop ? 15 : 10,
    width: healthWidth,
    height: desktop ? 25 : 20,
  };

  const stackWidth = desktop
    ? Math.min(width * 0.8, 460)
    : portrait
      ? width - 20
      : Math.min(width * 0.8, 420, width - 392);
  const stackLeft = (width - stackWidth) / 2;
  const stackTop = portrait ? 128 : desktop ? (contents.boss ? 80 : 70) : contents.boss ? 60 : 38;
  const stackGap = desktop ? 8 : 6;
  const [bossWidth, bossHeight] = desktop ? [300, 24] : portrait ? [stackWidth, 22] : [260, 20];
  const boss: Rect = {
    left: (width - bossWidth) / 2,
    top: portrait ? stackTop : desktop ? 48 : 34,
    width: bossWidth,
    height: bossHeight,
  };
  const [objectiveWidth, objectiveHeight] = desktop
    ? [320, 62]
    : portrait
      ? [stackWidth, 52]
      : [280, 52];
  const objective: Rect = {
    left: (width - objectiveWidth) / 2,
    top: portrait && contents.boss ? stackTop + bossHeight + stackGap : stackTop,
    width: objectiveWidth,
    height: objectiveHeight,
  };
  const stackBottom = contents.objective
    ? objective.top + objective.height
    : portrait && contents.boss
      ? boss.top + boss.height
      : stackTop;
  const stack: Rect = {
    left: stackLeft,
    top: stackTop,
    width: stackWidth,
    height: stackBottom - stackTop,
  };
  return { score, speed, upgrades, status, health, stack, boss, objective };
}

/** 一个屏幕外的目标：roll 是它在屏幕平面上的方位（0 = 正上方，顺时针），offAxis 是偏离视线的角度 */
interface Target {
  mesh: THREE.Object3D;
  roll: number;
  offAxis: number;
  distance: number;
}

type HealthBarInputs = Parameters<EnemyHealthBars['update']>[0];
type MissileInputs = Parameters<BossMissileIndicator['update']>[0];

const ROLL_STEP_DEG = 7.5;
const OFF_AXIS_RINGS_DEG = [75, 110, 150];
const DISTANCES_M = [320, 480, 1250, 3400, 12800];
/** 贴近的导弹：箭头放到最大（约 12 米以内）或接近最大 */
const NEAR_MISSILE_DISTANCES_M = [8, 30, 90, 180, 320, 600];
/** 每次更新飞过的距离（米）：相机在动，血条层才会重算箭头 */
const FLIGHT_STEP_M = 1.5;

interface SceneOptions {
  rings?: readonly number[];
  distances?: readonly number[];
  rollStep?: number;
}

/** 没有遮挡时的箭头位置：按“箭头种类 | 视口 | 目标布置”记下，见 unobstructed() */
const UNOBSTRUCTED = new Map<string, DrawnChevron[]>();

describe('off-screen chevrons and the touch controls', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let viewport: Viewport;
  /** 这个用例摆的是哪一种箭头（默认敌方目标箭头） */
  let kind: ChevronKind;
  let bars: EnemyHealthBars | null;
  let indicator: BossMissileIndicator | null;
  let huds: HUD[];
  let camera: THREE.PerspectiveCamera;
  let targets: Target[];
  let inputs: HealthBarInputs;
  let missiles: MissileInputs;
  /** 夹具元素的布局矩形（没有登记的元素是空矩形） */
  let rects: Map<Element, Rect>;
  /** 布局读取次数（getBoundingClientRect / offset* / client* / getComputedStyle 等） */
  let layoutReads: number;
  let restoreGetters: Array<() => void>;
  /** HUD 有些元素的 display 是整段写进 cssText 的，jsdom 会丢：按代码声明的原文读（见 declaredStyle.ts） */
  let styles: DeclaredStyles;
  const playerPosition = new THREE.Vector3();

  function isRendered(element: Element): boolean {
    if (!element.isConnected) return false;
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (node instanceof HTMLElement && styles.of(node, 'display') === 'none') return false;
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
    kind = 'target';
    bars = null;
    indicator = null;
    huds = [];
    targets = [];
    inputs = [];
    missiles = [];
    styles = recordDeclaredStyles();
    installLayout();
  });

  /** 拆掉当前的箭头层和 HUD（监听一并移除） */
  function disposeScene(): void {
    bars?.dispose();
    bars = null;
    indicator?.dispose();
    indicator = null;
    for (const hud of huds) hud.dispose();
    huds = [];
  }

  afterEach(async () => {
    disposeScene();
    styles.stop();
    vi.restoreAllMocks();
    for (const restore of restoreGetters) restore();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    // 这个文件的用例全是同步的，一条接一条不会让出事件循环；整套测试并行跑、机器忙的时候它会
    // 跑过一分钟，vitest 的工作线程就收不到主线程对进度上报的回执（Timeout calling
    // "onTaskUpdate"，60 秒）。每条用例之后让出一次。
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
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

  interface Hud {
    instance: HUD;
    layout: HudLayout;
    score: HTMLElement;
    speed: HTMLElement;
    upgrades: HTMLElement;
    status: HTMLElement;
    health: HTMLElement;
    stack: HTMLElement;
    objective: HTMLElement;
    /** Boss 阶段条：第一次显示时才创建 */
    boss: HTMLElement | null;
  }

  function hudElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    expect(element, `the HUD creates #${id}`).toBeTruthy();
    return element as HTMLElement;
  }

  /**
   * 真实的 HUD，面板按 hudLayoutFor 摆好。显示与否走 HUD 自己的接口；每个面板都登记了矩形，
   * 不显示的那些由布局替身返回空矩形（与浏览器一致）。要在 mountControls 之后调用（它会清空 body）。
   */
  function mountHud(contents: Partial<HudContents> = {}): Hud {
    const wanted: HudContents = { upgrades: false, boss: true, objective: true, ...contents };
    const instance = new HUD();
    huds.push(instance);
    instance.setLayoutDensity(densityOf(viewport));
    instance.init();
    instance.show();
    instance.updateUpgradePoints(wanted.upgrades ? 3 : 0);
    if (wanted.objective) {
      instance.showEventObjective('OBJECTIVE', 'Destroy the radar sites', '1 / 3');
    }
    if (wanted.boss) {
      instance.setBossStatus('Desert Fortress', { current: 2, total: 3 });
    }

    const layout = hudLayoutFor(viewport, wanted);
    const hud: Hud = {
      instance,
      layout,
      score: hudElement('hud-score'),
      speed: hudElement('hud-speed'),
      upgrades: hudElement('hud-upgrades'),
      status: hudElement('hud-status'),
      health: hudElement('hud-health'),
      stack: hudElement('hud-top-stack'),
      objective: hudElement('hud-objective'),
      boss: document.getElementById('hud-boss-status'),
    };
    rects.set(hud.score, layout.score);
    rects.set(hud.speed, layout.speed);
    rects.set(hud.upgrades, layout.upgrades);
    rects.set(hud.status, layout.status);
    rects.set(hud.health, layout.health);
    rects.set(hud.stack, layout.stack);
    rects.set(hud.objective, layout.objective);
    if (hud.boss) rects.set(hud.boss, layout.boss);
    return hud;
  }

  /** HUD 上当前算遮挡的东西：五块面板里显示着的，加上消息栈里显示着的每一块 */
  function hudObstacles(hud: Hud): Array<[string, Rect]> {
    const list: Array<[string, Rect]> = [];
    const candidates = [
      hud.score,
      hud.speed,
      hud.upgrades,
      hud.status,
      hud.health,
      ...Array.from(hud.stack.children),
    ];
    for (const element of candidates) {
      const rect = rects.get(element);
      if (rect && rect.width > 0 && rect.height > 0 && isRendered(element)) {
        list.push([element.id ? `#${element.id}` : `<${element.tagName.toLowerCase()}>`, rect]);
      }
    }
    return list;
  }

  /** 只有一个 id 的空面板（不建整个 HUD）：摆几何关系特意安排的场景用 */
  function mountPanel(id: string, rect: Rect, parent: HTMLElement = document.body): HTMLElement {
    const panel = document.createElement('div');
    panel.id = id;
    parent.appendChild(panel);
    rects.set(panel, rect);
    return panel;
  }

  // ───────────────────────────── 夹具：场景 ─────────────────────────────

  /**
   * 相机朝任意一个方向（不是轴向），四周一圈圈屏幕外的目标；按 kind 建目标箭头层或导弹箭头层
   * （导弹就在这些目标的位置上）。
   */
  function createScene(options: SceneOptions = {}): void {
    const rings = options.rings ?? OFF_AXIS_RINGS_DEG;
    const distances = options.distances ?? DISTANCES_M;
    const rollStep = options.rollStep ?? ROLL_STEP_DEG;
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
      for (let roll = 0; roll < 360; roll += rollStep) {
        const distance = distances[targets.length % distances.length];
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
    if (kind === 'missile') {
      // worldPos 就是目标的位置向量：fly() 挪动目标时导弹跟着走
      missiles = targets.map((target, index) => ({
        id: `missile-${index}`,
        worldPos: target.mesh.position,
        distance: target.distance,
        inView: false,
      }));
      indicator = new BossMissileIndicator();
    } else {
      inputs = targets.map((target) => ({ mesh: target.mesh, currentHealth: 40, maxHealth: 50 }));
      bars = new EnemyHealthBars();
    }
  }

  /** 让当前的箭头层更新一次 */
  function updateChevrons(): void {
    if (kind === 'missile') {
      (indicator as BossMissileIndicator).update(missiles, camera);
    } else {
      (bars as EnemyHealthBars).update(inputs, [], camera, playerPosition);
    }
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
      updateChevrons();
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
      document.querySelectorAll<HTMLElement>(
        kind === 'missile'
          ? '#boss-missile-indicators .offscreen-chevron'
          : '#enemy-health-bars .enemy-arrow-indicator'
      )
    );
  }

  /** 当前画着的箭头，按目标的顺序（每个目标一枚） */
  function drawnChevrons(): DrawnChevron[] {
    const elements = chevronElements();
    expect(elements, `one ${kind} chevron per off-screen target`).toHaveLength(targets.length);
    return elements.map((element, index) => {
      expect(element.style.display, `chevron ${index} is displayed`).not.toBe('none');
      expect(element.style.visibility, `chevron ${index} is visible`).not.toBe('hidden');
      return readChevron(element, viewport);
    });
  }

  const describeTarget = (target: Target): string =>
    `${kind} at bearing ${target.roll}°, ${target.offAxis}° off axis, ${target.distance} m`;

  /** 每枚箭头对应的目标的说明（留着给之后的断言用：场景拆掉以后 targets 就没了） */
  const labelsOfTargets = (): string[] => targets.map(describeTarget);

  /** 这些箭头里离遮挡不足 8px 的（盒子或标签） */
  function tooClose(
    chevrons: readonly DrawnChevron[],
    obstacles: ReadonlyArray<[name: string, rect: Rect]>,
    labels: readonly string[]
  ): string[] {
    const problems: string[] = [];
    chevrons.forEach((chevron, index) => {
      for (const [part, box] of partsOf(chevron)) {
        for (const [name, rect] of obstacles) {
          const gap = gapBetween(box, boxOf(rect));
          if (gap < CLEARANCE_PX - ROUNDING_PX) {
            problems.push(`${labels[index]}: ${part} is ${gap.toFixed(1)} px from ${name}`);
          }
        }
      }
    });
    return problems;
  }

  function expectClearOf(
    chevrons: readonly DrawnChevron[],
    obstacles: ReadonlyArray<[name: string, rect: Rect]>,
    labels: readonly string[] = labelsOfTargets()
  ): void {
    expect(tooClose(chevrons, obstacles, labels), 'chevrons within 8 px of an obstacle').toEqual(
      []
    );
  }

  function expectInsideViewport(
    chevrons: readonly DrawnChevron[],
    labels: readonly string[] = labelsOfTargets(),
    view: Viewport = viewport
  ): void {
    const problems: string[] = [];
    chevrons.forEach((chevron, index) => {
      for (const [part, box] of partsOf(chevron)) {
        if (
          box.left < -ROUNDING_PX ||
          box.top < -ROUNDING_PX ||
          box.right > view.width + ROUNDING_PX ||
          box.bottom > view.height + ROUNDING_PX
        ) {
          problems.push(
            `${labels[index]}: ${part} spans x ${box.left.toFixed(1)}..` +
              `${box.right.toFixed(1)}, y ${box.top.toFixed(1)}..${box.bottom.toFixed(1)}`
          );
        }
      }
    });
    expect(problems, `chevrons outside the ${view.width}×${view.height} viewport`).toEqual([]);
  }

  function obstaclesOf(
    controls: Controls | null,
    radar: Rect | null,
    hud: Hud | null = null
  ): Array<[string, Rect]> {
    const list: Array<[string, Rect]> = [];
    if (radar) list.push(['#radar-minimap', radar]);
    if (controls) {
      list.push(['#joystick', rects.get(controls.stick) as Rect]);
      controls.buttons.forEach((button) => {
        if (isRendered(button)) list.push([`#${button.id}`, rects.get(button) as Rect]);
      });
    }
    if (hud) list.push(...hudObstacles(hud));
    return list;
  }

  /** 同样的遮挡，但按键簇算成一整块（各个可见按键的外接矩形） */
  function blocksOf(
    controls: Controls | null,
    radar: Rect | null,
    hud: Hud | null = null
  ): Array<[string, Rect]> {
    const list: Array<[string, Rect]> = [];
    if (radar) list.push(['#radar-minimap', radar]);
    if (controls) {
      list.push(['#joystick', rects.get(controls.stick) as Rect]);
      const shown = controls.buttons
        .filter((button) => isRendered(button))
        .map((button) => boxOf(rects.get(button) as Rect));
      if (shown.length > 0) {
        const left = Math.min(...shown.map((box) => box.left));
        const top = Math.min(...shown.map((box) => box.top));
        list.push([
          'the button cluster',
          {
            left,
            top,
            width: Math.max(...shown.map((box) => box.right)) - left,
            height: Math.max(...shown.map((box) => box.bottom)) - top,
          },
        ]);
      }
    }
    if (hud) list.push(...hudObstacles(hud));
    return list;
  }

  /** 完整的触控场景：控件 + 雷达 + 一圈圈目标，飞过第一次更新 */
  function touchScene(
    target: Viewport,
    options: SceneOptions = {}
  ): { controls: Controls; radar: Rect } {
    setViewport(target);
    const controls = mountControls();
    mountRadar(controls.layout.radar);
    createScene(options);
    fly(1);
    return { controls, radar: controls.layout.radar };
  }

  /** 飞行中完整的一屏：触控控件 + 雷达 + HUD（阶段条和目标卡都显示着） */
  function flightScene(
    target: Viewport,
    options: SceneOptions = {}
  ): { controls: Controls; radar: Rect; hud: Hud } {
    setViewport(target);
    const controls = mountControls();
    mountRadar(controls.layout.radar);
    const hud = mountHud();
    createScene(options);
    fly(1);
    return { controls, radar: controls.layout.radar, hud };
  }

  /** 同一个场景、换一套夹具时箭头画在哪里（用完即弃） */
  function chevronsWith(
    target: Viewport,
    mount: () => void,
    options: SceneOptions = {}
  ): DrawnChevron[] {
    disposeScene();
    document.body.innerHTML = '';
    rects.clear();
    setViewport(target);
    mount();
    createScene(options);
    fly(1);
    const chevrons = drawnChevrons();
    disposeScene();
    return chevrons;
  }

  /**
   * 没有任何遮挡时箭头画在哪里。同一种箭头、同一个视口、同一组目标的结果只算一次（很多用例拿它
   * 作对照）；再问时照样把场景清空、把目标重新摆好，只是不再画一遍。
   */
  function unobstructed(target: Viewport, options: SceneOptions = {}): DrawnChevron[] {
    const key = `${kind}|${target.width}x${target.height}|${JSON.stringify(options)}`;
    const known = UNOBSTRUCTED.get(key);
    if (!known) {
      const chevrons = chevronsWith(target, () => undefined, options);
      UNOBSTRUCTED.set(key, chevrons);
      return structuredClone(chevrons);
    }
    disposeScene();
    document.body.innerHTML = '';
    rects.clear();
    setViewport(target);
    createScene(options);
    disposeScene();
    return structuredClone(known);
  }

  const centresOf = (chevrons: readonly DrawnChevron[]): Point[] =>
    chevrons.map((chevron) => chevron.centre);

  /** 离屏幕中心有多“靠外”：0 = 正中，1 = 贴着屏幕边（沿着屏幕边滑动时不变，向内移动时变小） */
  const outwardOf = (point: Point, view: Viewport): number =>
    Math.max(
      Math.abs(point.x - view.width / 2) / (view.width / 2),
      Math.abs(point.y - view.height / 2) / (view.height / 2)
    );

  const moveOf = (before: DrawnChevron, after: DrawnChevron): number =>
    Math.abs(after.centre.x - before.centre.x) + Math.abs(after.centre.y - before.centre.y);

  /** 整枚箭头（盒子加标签）的外接矩形 */
  function wholeOf(chevron: DrawnChevron): Box {
    const boxes = partsOf(chevron).map(([, box]) => box);
    return {
      left: Math.min(...boxes.map((box) => box.left)),
      top: Math.min(...boxes.map((box) => box.top)),
      right: Math.max(...boxes.map((box) => box.right)),
      bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
  }

  /**
   * 这个位置是不是夹在两块遮挡之间、窄得放不下一枚箭头的缝：把它扩到最大的一枚箭头那么大
   * （朝哪边扩都行），总会碰到某块遮挡的留白。这样的缝不算空位——挨得这么近的遮挡当作连成一片。
   */
  function isNarrowSlot(spot: Box, boxes: readonly Box[]): boolean {
    const spareX = Math.max(0, LARGEST_CHEVRON_PX.width - (spot.right - spot.left));
    const spareY = Math.max(0, LARGEST_CHEVRON_PX.height - (spot.bottom - spot.top));
    const shares = [0, 0.25, 0.5, 0.75, 1];
    for (const shareX of shares) {
      for (const shareY of shares) {
        const roomy: Box = {
          left: spot.left - spareX * shareX,
          right: spot.right + spareX * (1 - shareX),
          top: spot.top - spareY * shareY,
          bottom: spot.bottom + spareY * (1 - shareY),
        };
        if (boxes.every((box) => gapBetween(roomy, box) >= CLEARANCE_PX)) return false;
      }
    }
    return true;
  }

  /**
   * 这枚箭头至少要挪多远（|dx| + |dy|，整像素）才有空位：整枚箭头（按外接矩形算，偏保守）离
   * 每个遮挡至少 8px、在视口内，横、纵两个方向都不比原来离屏幕中心更远，并且不是一条窄缝
   * （见 isNarrowSlot）。逐个像素地找，与实现怎么找无关。limit 以内找不到时返回 limit。
   */
  function leastMove(
    before: DrawnChevron,
    obstacles: readonly Rect[],
    view: Viewport,
    limit: number
  ): number {
    const whole = wholeOf(before);
    const boxes = obstacles.map(boxOf);
    const towardX = before.centre.x <= view.width / 2 ? 1 : -1;
    const towardY = before.centre.y <= view.height / 2 ? 1 : -1;
    const maxDx = 2 * Math.abs(view.width / 2 - before.centre.x);
    const maxDy = 2 * Math.abs(view.height / 2 - before.centre.y);
    for (let total = 0; total < limit; total++) {
      for (let dx = 0; dx <= total; dx++) {
        const dy = total - dx;
        if (dx > maxDx || dy > maxDy) continue;
        const shifted: Box = {
          left: whole.left + towardX * dx,
          right: whole.right + towardX * dx,
          top: whole.top + towardY * dy,
          bottom: whole.bottom + towardY * dy,
        };
        if (
          shifted.left < 0 ||
          shifted.top < 0 ||
          shifted.right > view.width ||
          shifted.bottom > view.height
        ) {
          continue;
        }
        if (
          boxes.every((box) => gapBetween(shifted, box) >= ROOMY_CLEARANCE_PX) &&
          !isNarrowSlot(shifted, boxes)
        ) {
          return total;
        }
      }
    }
    return limit;
  }

  /** 挪得比需要的多的箭头（compared 给出哪些箭头参加比较，缺省全部） */
  function overMoved(
    free: readonly DrawnChevron[],
    placed: readonly DrawnChevron[],
    obstacles: readonly Rect[],
    view: Viewport,
    labels: readonly string[],
    compared: (index: number) => boolean = () => true
  ): string[] {
    const problems: string[] = [];
    free.forEach((before, index) => {
      const moved = moveOf(before, placed[index]);
      if (moved <= MOVE_SLACK_PX || !compared(index)) return;
      const needed = leastMove(before, obstacles, view, Math.ceil(moved));
      if (moved > needed + MOVE_SLACK_PX) {
        problems.push(
          `${labels[index]}: moved ${moved.toFixed(0)} px, from (${before.centre.x}, ` +
            `${before.centre.y}) to (${placed[index].centre.x}, ${placed[index].centre.y}); ` +
            `${needed} px would do`
        );
      }
    });
    return problems;
  }

  /*
   * FINDING（手机竖屏 390×844）：摇杆和按键簇之间只有约 46px，实现把两者并成一个外接矩形
   * （x 12–371，y 578–832）。摇杆的上沿在 y = 728，它上方、按键簇左边那块约 142×142px 的空地
   * 也被算成了遮挡：贴左边、y 在 581–776 之间的箭头全部被推到 y = 558——压在摇杆上的挪了
   * 218px（挪 78px 就有空位），本来就离每个遮挡 8px 以上的也被挪走 23–120px。
   * 规格说并成外接矩形会吞掉一块空角时不再合并；实现里这条只对含 HUD 面板的合并生效，
   * 摇杆 + 按键簇不在其内。
   */
  const FREE_CORNER_ABOVE_THE_STICK =
    'chevrons moved further than they needed to (phone portrait: the stick and the button ' +
    'cluster are treated as one box, which swallows the free corner above the stick)';

  /** 哪些箭头本来落在“摇杆和按键簇合起来的外接矩形”附近（8px 之内） */
  function byStickAndButtons(
    free: readonly DrawnChevron[],
    blocks: ReadonlyArray<[name: string, rect: Rect]>
  ): (index: number) => boolean {
    const boxes = blocks
      .filter(([name]) => name === '#joystick' || name === 'the button cluster')
      .map(([, rect]) => boxOf(rect));
    expect(boxes, 'the stick and the button cluster').toHaveLength(2);
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const union: Rect = {
      left,
      top,
      width: Math.max(...boxes.map((box) => box.right)) - left,
      height: Math.max(...boxes.map((box) => box.bottom)) - top,
    };
    return (index) => clearanceOf(free[index], [union]) < CLEARANCE_PX - ROUNDING_PX;
  }

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
      const problems: string[] = [];
      for (const [index, before, after] of displaced()) {
        const what = describeTarget(targets[index]);
        if (after.centre.x === before.centre.x && after.centre.y === before.centre.y) {
          problems.push(`${what}: not moved`);
        } else if (outwardOf(after.centre, target) > outwardOf(before.centre, target) + 0.002) {
          problems.push(
            `${what}: moved outward, from (${before.centre.x}, ${before.centre.y}) ` +
              `to (${after.centre.x}, ${after.centre.y})`
          );
        }
      }
      expect(problems).toEqual([]);
    });

    /*
     * “不多挪”：挪过的箭头，不会在更近的地方还有一个空位——离每个遮挡 8px 以上、在视口内、
     * 横纵两个方向都不比原来离屏幕中心更远（见 leastMove，逐像素找）。沿屏幕边滑到空位、
     * 比朝屏幕中心移开更近的，就沿边滑（手机横屏上指向正右方的箭头沿右边缘滑到按键簇上方）。
     * 雷达盘是单独的一块，箭头只横着滑到它朝屏幕中心的一侧（另有用例），本来会落在雷达上的
     * 不在这里比。
     *
     * 手机竖屏上这条不成立（FINDING，见 FREE_CORNER_ABOVE_THE_STICK）：这个场景里被挪动的
     * 箭头都在摇杆和按键簇附近。
     */
    const noFurtherThanNeeded = target === PHONE_PORTRAIT ? it.fails : it;
    noFurtherThanNeeded('moves a chevron no further than it needs to', () => {
      const free = unobstructed(target);
      const { controls, radar } = touchScene(target);
      const placed = drawnChevrons();
      const labels = labelsOfTargets();
      const obstacles = blocksOf(controls, radar).map(([, rect]) => rect);
      const offTheRadar = free.map(
        (chevron) => clearanceOf(chevron, [radar]) >= CLEARANCE_PX - ROUNDING_PX
      );
      const compared = free.filter(
        (chevron, index) => offTheRadar[index] && moveOf(chevron, placed[index]) > 0
      );
      expect(compared.length, 'moved chevrons that are compared').toBeGreaterThan(5);
      expect(
        overMoved(free, placed, obstacles, target, labels, (index) => offTheRadar[index]),
        FREE_CORNER_ABOVE_THE_STICK
      ).toEqual([]);
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
      createScene({ rings: [75] });
      const few = fly(1)[0];
      expect(targets.length).toBeLessThan(60);

      disposeScene();
      document.body.innerHTML = '';
      rects.clear();
      const again = mountControls();
      mountRadar(again.layout.radar);
      createScene({ rings: [75, 95, 110, 130, 150] });
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

  // ───────────────────────────── 飞行中完整的一屏：两种箭头 ─────────────────────────────

  /** 同一屏（触控控件 + 雷达 + HUD）上箭头摆在哪里；每种箭头、每种屏幕只摆一次，几条用例共用 */
  interface Survey {
    view: Viewport;
    labels: string[];
    /** 没有任何遮挡时 */
    free: DrawnChevron[];
    /** 第一次更新之后 */
    placed: DrawnChevron[];
    /** 又飞过 45 次更新之后 */
    later: DrawnChevron[];
    obstacles: Array<[string, Rect]>;
    /** 同样的遮挡，按键簇算成一整块 */
    blocks: Array<[string, Rect]>;
    radar: Rect;
  }
  const surveys = new Map<string, Survey>();

  function flightSurvey(wanted: ChevronKind, target: Viewport): Survey {
    const key = `${wanted} / ${target.name}`;
    let survey = surveys.get(key);
    if (!survey) {
      kind = wanted;
      const free = unobstructed(target);
      const { controls, radar, hud } = flightScene(target);
      const placed = drawnChevrons();
      const labels = labelsOfTargets();
      const obstacles = obstaclesOf(controls, radar, hud);
      const blocks = blocksOf(controls, radar, hud);
      fly(45);
      survey = {
        view: target,
        labels,
        free,
        placed,
        later: drawnChevrons(),
        obstacles,
        blocks,
        radar,
      };
      surveys.set(key, survey);
    }
    return survey;
  }

  describe.each(KINDS)('%s chevrons and the whole flight HUD', (wanted) => {
    describe.each(TOUCH_VIEWPORTS)('on a $name screen ($width×$height)', (target) => {
      it('ends every chevron 8 px clear of the stick, the buttons, the radar and each HUD panel', () => {
        const { placed, obstacles, labels } = flightSurvey(wanted, target);
        // 这一屏上该有的遮挡都在
        expect(obstacles.map(([name]) => name)).toEqual(
          expect.arrayContaining([
            '#radar-minimap',
            '#joystick',
            '#hud-score',
            '#hud-speed',
            '#hud-status',
            '#hud-health',
            '#hud-boss-status',
            '#hud-objective',
          ])
        );
        // 雷达、摇杆、六块 HUD 之外，剩下的是各个触控按键
        expect(obstacles.length, 'the touch buttons are on the list too').toBeGreaterThan(12);
        expectClearOf(placed, obstacles, labels);
      });

      it('keeps every chevron and its distance label fully inside the viewport', () => {
        const { placed, labels } = flightSurvey(wanted, target);
        expectInsideViewport(placed, labels, target);
      });

      it('keeps them clear and on screen while flying on', () => {
        const { later, obstacles, labels } = flightSurvey(wanted, target);
        expectClearOf(later, obstacles, labels);
        expectInsideViewport(later, labels, target);
      });

      it('keeps the direction and the distance text of every chevron', () => {
        const { free, placed, later, labels } = flightSurvey(wanted, target);
        placed.forEach((chevron, index) => {
          expect(chevron.text, labels[index]).toMatch(/^\d+m$/);
          expect(chevron.text, labels[index]).toBe(free[index].text);
          expect(chevron.rotation, labels[index]).toBe(free[index].rotation);
          expect(later[index].text, labels[index]).toBe(free[index].text);
          // 飞了一段之后方位差出来的舍入：1° 以内
          expect(
            Math.abs(angleDelta(later[index].rotation, free[index].rotation)),
            labels[index]
          ).toBeLessThanOrEqual(1);
        });
      });

      it('never moves a chevron further out toward the screen edge', () => {
        const { free, placed, labels } = flightSurvey(wanted, target);
        const problems: string[] = [];
        free.forEach((before, index) => {
          const after = placed[index];
          if (outwardOf(after.centre, target) > outwardOf(before.centre, target) + 0.002) {
            problems.push(
              `${labels[index]}: from (${before.centre.x}, ${before.centre.y}) ` +
                `to (${after.centre.x}, ${after.centre.y})`
            );
          }
        });
        expect(problems, 'chevrons moved outward').toEqual([]);
      });

      it('moves every chevron that was heading for a HUD panel, and ends it clear of that panel', () => {
        const { free, placed, obstacles, labels } = flightSurvey(wanted, target);
        const groups: Array<[name: string, ids: string[]]> = [
          ['the score and speed panels', ['#hud-score', '#hud-speed']],
          ['the status column', ['#hud-status']],
          ['the cards in the top stack', ['#hud-boss-status', '#hud-objective']],
        ];
        // 手机横屏的血条够得着贴上边的箭头；其余三种屏幕上贴边的位置在它下面
        if (target === PHONE_LANDSCAPE) groups.push(['the health bar', ['#hud-health']]);
        for (const [name, ids] of groups) {
          const panels = obstacles.filter(([id]) => ids.includes(id)).map(([, rect]) => rect);
          expect(panels, name).toHaveLength(ids.length);
          let heading = 0;
          free.forEach((before, index) => {
            if (clearanceOf(before, panels) >= CLEARANCE_PX - ROUNDING_PX) return;
            heading++;
            expect(placed[index].centre, `${labels[index]}: moved off ${name}`).not.toEqual(
              before.centre
            );
            expect(
              clearanceOf(placed[index], panels),
              `${labels[index]}: clear of ${name}`
            ).toBeGreaterThanOrEqual(CLEARANCE_PX - ROUNDING_PX);
          });
          expect(heading, `chevrons heading for ${name}`).toBeGreaterThan(0);
        }
      });

      it('leaves a chevron that is nowhere near an obstacle where it was', () => {
        const { free, placed, obstacles, labels } = flightSurvey(wanted, target);
        const all = obstacles.map(([, rect]) => rect);
        let untouched = 0;
        free.forEach((before, index) => {
          if (clearanceOf(before, all) > 160) {
            untouched++;
            expect(placed[index].centre, labels[index]).toEqual(before.centre);
          }
        });
        // 手机竖屏上一圈下来每个位置离某个遮挡都不到 160px：没有这样的箭头可比
        expect(untouched > 0, `${untouched} chevrons far from everything`).toBe(
          target !== PHONE_PORTRAIT
        );
      });

      /*
       * “不多挪”（见 leastMove）。按键簇按一整块算；本来会落在雷达上的不比（雷达盘是单独的一块，
       * 箭头只横着滑开）。手机竖屏上，摇杆和按键簇合起来的外接矩形附近的箭头另见下一条。
       */
      it('moves a chevron no further than it needs to', () => {
        const { free, placed, blocks, radar, labels } = flightSurvey(wanted, target);
        const aroundTheControls = byStickAndButtons(free, blocks);
        const compared = (index: number): boolean =>
          clearanceOf(free[index], [radar]) >= CLEARANCE_PX - ROUNDING_PX &&
          !(target === PHONE_PORTRAIT && aroundTheControls(index));
        expect(
          free.filter(
            (before, index) => compared(index) && moveOf(before, placed[index]) > MOVE_SLACK_PX
          ).length,
          'moved chevrons that are compared'
        ).toBeGreaterThan(5);
        expect(
          overMoved(
            free,
            placed,
            blocks.map(([, rect]) => rect),
            target,
            labels,
            compared
          ),
          'chevrons moved further than they needed to'
        ).toEqual([]);
      });

      if (target === PHONE_PORTRAIT) {
        // FINDING：见 FREE_CORNER_ABOVE_THE_STICK
        it.fails('leaves the free corner above the stick to the chevrons', () => {
          const { free, placed, blocks, labels } = flightSurvey(wanted, target);
          const aroundTheControls = byStickAndButtons(free, blocks);
          expect(
            overMoved(
              free,
              placed,
              blocks.map(([, rect]) => rect),
              target,
              labels,
              aroundTheControls
            ),
            FREE_CORNER_ABOVE_THE_STICK
          ).toEqual([]);
        });
      }
    });

    it('on desktop, without touch controls, still avoids the radar and the HUD panels', () => {
      kind = wanted;
      const free = unobstructed(DESKTOP);
      setViewport(DESKTOP);
      const radar = desktopRadar(DESKTOP);
      mountRadar(radar);
      const hud = mountHud({ upgrades: true });
      createScene();
      fly(1);
      const placed = drawnChevrons();
      const obstacles = obstaclesOf(null, radar, hud);
      expect(obstacles.map(([name]) => name)).toEqual(
        expect.arrayContaining([
          '#hud-score',
          '#hud-speed',
          '#hud-upgrades',
          '#hud-status',
          '#hud-health',
          '#hud-boss-status',
          '#hud-objective',
        ])
      );
      expectClearOf(placed, obstacles);
      expectInsideViewport(placed);

      // 面板确实挡着一些箭头：它们被挪开了，指向和距离不变
      const panels = hudObstacles(hud).map(([, rect]) => rect);
      let heading = 0;
      free.forEach((before, index) => {
        expect(placed[index].rotation).toBe(before.rotation);
        expect(placed[index].text).toBe(before.text);
        if (clearanceOf(before, panels) >= CLEARANCE_PX - ROUNDING_PX) return;
        heading++;
        expect(placed[index].centre, describeTarget(targets[index])).not.toEqual(before.centre);
      });
      expect(heading, 'chevrons heading for a HUD panel').toBeGreaterThan(5);
      expect(
        overMoved(
          free,
          placed,
          obstacles.map(([, rect]) => rect),
          DESKTOP,
          labelsOfTargets(),
          (index) => clearanceOf(free[index], [radar]) >= CLEARANCE_PX - ROUNDING_PX
        ),
        'chevrons moved further than they needed to'
      ).toEqual([]);
    });

    // ───────────────────────────── 哪些 HUD 元素算遮挡 ─────────────────────────────

    describe('which HUD elements count', () => {
      /** HUD 上登记了矩形的元素里只留下这几个（其余的当作不在） */
      function keepOnly(hud: Hud, kept: ReadonlyArray<HTMLElement | null>): void {
        const all = [
          hud.score,
          hud.speed,
          hud.upgrades,
          hud.status,
          hud.health,
          hud.stack,
          hud.objective,
          hud.boss,
        ];
        for (const element of all) {
          if (element && !kept.includes(element)) rects.delete(element);
        }
      }

      type Part = [name: string, pick: (hud: Hud) => HTMLElement | null, hide: (hud: Hud) => void];
      const PARTS: Part[] = [
        [
          'the upgrade points panel',
          (hud) => hud.upgrades,
          (hud) => hud.instance.updateUpgradePoints(0),
        ],
        ['the boss bar', (hud) => hud.boss, (hud) => hud.instance.setBossStatus(null)],
        ['the objective card', (hud) => hud.objective, (hud) => hud.instance.hideEventObjective()],
        [
          'the score panel (the whole HUD hidden)',
          (hud) => hud.score,
          (hud) => hud.instance.hide(),
        ],
        [
          'the health bar (the whole HUD hidden)',
          (hud) => hud.health,
          (hud) => hud.instance.hide(),
        ],
        [
          'the status column (the whole HUD hidden)',
          (hud) => hud.status,
          (hud) => hud.instance.hide(),
        ],
      ];

      it.each(PARTS)(
        'avoids %s while it is shown and not while it is hidden',
        (_name, pick, hide) => {
          kind = wanted;
          const free = unobstructed(PHONE_LANDSCAPE);
          let panel: Rect | undefined;
          const shown = chevronsWith(PHONE_LANDSCAPE, () => {
            const hud = mountHud({ upgrades: true });
            const element = pick(hud);
            expect(element, 'the HUD created the element').toBeTruthy();
            keepOnly(hud, [element]);
            panel = rects.get(element as HTMLElement);
          });
          const hidden = chevronsWith(PHONE_LANDSCAPE, () => {
            const hud = mountHud({ upgrades: true });
            keepOnly(hud, [pick(hud)]);
            hide(hud);
          });
          expect(panel).toBeTruthy();
          const blocked = free.filter(
            (chevron) => clearanceOf(chevron, [panel as Rect]) < CLEARANCE_PX - ROUNDING_PX
          );
          expect(blocked.length, 'chevrons heading for it').toBeGreaterThan(0);
          expect(
            shown.every(
              (chevron) => clearanceOf(chevron, [panel as Rect]) >= CLEARANCE_PX - ROUNDING_PX
            ),
            'clear of it while it is shown'
          ).toBe(true);
          expect(centresOf(hidden), 'hidden: as if it were not there').toEqual(centresOf(free));
        }
      );

      /*
       * 空的元素不算：显示着、有位置，但没有高度（空的强化点数栏）或没有宽度的，不占地方。
       * 摆在贴边箭头经过的地方：箭头该在哪里还在哪里。给它们 1px 的高 / 宽就成了遮挡。
       */
      it('does not count an element that takes up no room (no height or no width)', () => {
        kind = wanted;
        const free = unobstructed(PHONE_LANDSCAPE);
        const flat: Rect = { left: 10, top: 190, width: 150, height: 0 };
        const thin: Rect = { left: 770, top: 120, width: 0, height: 150 };
        const card: Rect = { left: 300, top: 36, width: 240, height: 0 };
        const withPanels = (grow: number): DrawnChevron[] =>
          chevronsWith(PHONE_LANDSCAPE, () => {
            mountPanel('hud-upgrades', { ...flat, height: grow });
            mountPanel('hud-status', { ...thin, width: grow });
            mountPanel(
              'hud-objective',
              { ...card, height: grow },
              mountPanel('hud-top-stack', { ...card, height: 40 })
            );
          });
        expect(centresOf(withPanels(0)), 'empty: as if they were not there').toEqual(
          centresOf(free)
        );

        const sized = withPanels(1);
        for (const [name, rect] of [
          ['the flat panel', flat],
          ['the thin panel', thin],
          ['the flat card', card],
        ] as const) {
          const grown: Rect = {
            ...rect,
            width: Math.max(rect.width, 1),
            height: Math.max(rect.height, 1),
          };
          const blocked = free.filter(
            (chevron) => clearanceOf(chevron, [grown]) < CLEARANCE_PX - ROUNDING_PX
          );
          expect(blocked.length, `chevrons passing over ${name}`).toBeGreaterThan(0);
          expect(
            sized.every((chevron) => clearanceOf(chevron, [grown]) >= CLEARANCE_PX - ROUNDING_PX),
            `1 px of ${name} is avoided`
          ).toBe(true);
        }
      });

      /*
       * 手机竖屏：消息栈横跨整行（左右各留 10px），里面的卡片一块压一块——Boss 阶段条、简报卡、
       * 目标卡，都是真实 HUD 自己放进栈里的。贴左右两边的箭头会一块块地经过它们。
       * 栈这个容器比里面的卡片高出一截（下面留着 90px 空白）：那一截不算遮挡。
       */
      it('counts every card shown in #hud-top-stack, but not the stack row itself', () => {
        kind = wanted;
        const options = { rollStep: 1.5 };
        const free = unobstructed(PHONE_PORTRAIT, options);
        const cards: Array<[name: string, rect: Rect]> = [];
        let row: Rect | undefined;
        const placed = chevronsWith(
          PHONE_PORTRAIT,
          () => {
            const hud = mountHud();
            hud.instance.showBriefing({
              kicker: 'BRIEFING',
              title: 'Desert Fortress',
              line: 'Destroy the radar sites',
              tone: 'sys',
              durationMs: 8000,
            });
            keepOnly(hud, []);
            // 显示着的卡片按它们在栈里的顺序从上往下排，整行宽，间距 6
            let top = hud.layout.stack.top;
            for (const child of Array.from(hud.stack.children)) {
              if (!isRendered(child)) continue;
              const height = child === hud.boss ? hud.layout.boss.height : 52;
              const rect: Rect = { ...hud.layout.stack, top, height };
              rects.set(child, rect);
              cards.push([`#${child.id}`, rect]);
              top += height + 6;
            }
            row = { ...hud.layout.stack, height: top - hud.layout.stack.top + 90 };
            rects.set(hud.stack, row);
          },
          options
        );
        expect(cards.map(([name]) => name)).toEqual(
          expect.arrayContaining(['#hud-boss-status', '#hud-briefing', '#hud-objective'])
        );
        const all = cards.map(([, rect]) => rect);
        for (const [name, card] of cards) {
          expect(
            free.filter((chevron) => clearanceOf(chevron, [card]) < CLEARANCE_PX - ROUNDING_PX)
              .length,
            `chevrons heading for ${name}`
          ).toBeGreaterThan(0);
        }
        expect(tooClose(placed, cards, labelsOfTargets()), 'clear of every card').toEqual([]);

        // 压在这一行上、但离每块卡片都有余地的箭头：不动
        let overTheRowOnly = 0;
        free.forEach((before, index) => {
          if (
            clearanceOf(before, [row as Rect]) < 0 &&
            clearanceOf(before, all) >= ROOMY_CLEARANCE_PX
          ) {
            overTheRowOnly++;
            expect(placed[index].centre).toEqual(before.centre);
          }
        });
        expect(
          overTheRowOnly,
          'chevrons over the stack row but clear of its cards'
        ).toBeGreaterThan(1);
      });

      it('looks for the panels and cards the real HUD creates', () => {
        setViewport(DESKTOP);
        const hud = mountHud({ upgrades: true });
        const root = document.getElementById('hud') as HTMLElement;
        expect(root, 'the HUD root').toBeTruthy();
        for (const panel of [hud.score, hud.speed, hud.upgrades, hud.status, hud.health]) {
          expect(root.contains(panel), `#${panel.id} is part of the HUD`).toBe(true);
          expect(isRendered(panel), `#${panel.id} is displayed`).toBe(true);
        }
        expect(hud.boss, 'the boss bar exists once shown').toBeTruthy();
        expect((hud.boss as HTMLElement).parentElement, 'the boss bar is a card in the stack').toBe(
          hud.stack
        );
        expect(hud.objective.parentElement, 'the objective card is a card in the stack').toBe(
          hud.stack
        );
        expect(isRendered(hud.boss as HTMLElement)).toBe(true);
        expect(isRendered(hud.objective)).toBe(true);
      });
    });

    // ───────────────────────────── 遮挡之间的空地 ─────────────────────────────

    describe('free space between obstacles', () => {
      const FINE = { rings: [75, 110], rollStep: 2.5 };

      it('uses a gap between two panels that is wide enough for a chevron', () => {
        kind = wanted;
        const free = unobstructed(PHONE_LANDSCAPE, FINE);
        // 左上一块、顶部中间一块，之间留 170px
        const left: Rect = { left: 10, top: 10, width: 150, height: 96 };
        const card: Rect = { left: 330, top: 10, width: 300, height: 70 };
        const placed = chevronsWith(
          PHONE_LANDSCAPE,
          () => {
            mountPanel('hud-score', left);
            mountPanel('', card, mountPanel('hud-top-stack', { ...card, left: 200, width: 440 }));
          },
          FINE
        );
        expect(placed.every((chevron) => clearanceOf(chevron, [left, card]) >= 7.5)).toBe(true);

        let inTheGap = 0;
        free.forEach((before, index) => {
          const whole = wholeOf(before);
          if (
            whole.left > left.left + left.width &&
            whole.right < card.left &&
            whole.top < card.top + card.height &&
            clearanceOf(before, [left, card]) >= ROOMY_CLEARANCE_PX
          ) {
            inTheGap++;
            expect(placed[index].centre, 'a chevron in the gap stays there').toEqual(before.centre);
          }
        });
        expect(inTheGap, 'chevrons standing in the gap').toBeGreaterThan(1);
        expect(overMoved(free, placed, [left, card], PHONE_LANDSCAPE, labelsOfTargets())).toEqual(
          []
        );
      });

      it('does not treat the empty corner beside a column of panels and under a card as blocked', () => {
        kind = wanted;
        const free = unobstructed(PHONE_LANDSCAPE, FINE);
        // 左边一列一直到 y = 190；顶部一块宽卡片紧挨着它（只隔 30px，放不下箭头），到 y = 98。
        // 卡片下面、这一列右边是空的。
        const column: Rect = { left: 10, top: 10, width: 150, height: 180 };
        const card: Rect = { left: 190, top: 38, width: 420, height: 60 };
        const placed = chevronsWith(
          PHONE_LANDSCAPE,
          () => {
            mountPanel('hud-score', column);
            mountPanel('', card, mountPanel('hud-top-stack', card));
          },
          FINE
        );
        const labels = labelsOfTargets();
        expect(placed.every((chevron) => clearanceOf(chevron, [column, card]) >= 7.5)).toBe(true);

        // 本来压在卡片上（不碰那一列）的箭头：挪到卡片正下方，而不是挪到那一列的下沿之下
        let underTheCard = 0;
        free.forEach((before, index) => {
          if (
            clearanceOf(before, [card]) < CLEARANCE_PX - ROUNDING_PX &&
            clearanceOf(before, [column]) >= ROOMY_CLEARANCE_PX + 40
          ) {
            underTheCard++;
            expect(
              wholeOf(placed[index]).top,
              `${labels[index]}: just below the card`
            ).toBeLessThan(card.top + card.height + CLEARANCE_PX + 12);
          }
        });
        expect(underTheCard, 'chevrons heading for the card').toBeGreaterThan(3);
        expect(overMoved(free, placed, [column, card], PHONE_LANDSCAPE, labels)).toEqual([]);
      });

      /*
       * 雷达盘自成一块：紧挨着它的 HUD 面板不和它并成一片。手机横屏上左上的信息栏就压在雷达
       * 正上方（两者之间放不下箭头，合起来的外接矩形也没有空角）。落在雷达上的箭头照旧横着滑到
       * 雷达朝屏幕中心的一侧（高度不变）；要是并成了一片，往下出去更近，箭头就会被推到雷达下面。
       */
      it('keeps the radar a block of its own next to a HUD panel', () => {
        kind = wanted;
        const radar: Rect = { left: 4, top: 102, width: 100, height: 100 };
        const panel: Rect = { left: 10, top: 10, width: 150, height: 96 };
        const free = unobstructed(PHONE_LANDSCAPE, FINE);
        const placed = chevronsWith(
          PHONE_LANDSCAPE,
          () => {
            mountRadar(radar);
            mountPanel('hud-score', panel);
          },
          FINE
        );
        const labels = labelsOfTargets();
        expect(
          tooClose(
            placed,
            [
              ['#radar-minimap', radar],
              ['#hud-score', panel],
            ],
            labels
          )
        ).toEqual([]);
        let onTheRadar = 0;
        free.forEach((before, index) => {
          if (
            clearanceOf(before, [radar]) >= CLEARANCE_PX - ROUNDING_PX ||
            clearanceOf(before, [panel]) < ROOMY_CLEARANCE_PX
          ) {
            return;
          }
          onTheRadar++;
          const after = placed[index];
          expect(after.centre.y, `${labels[index]}: same height`).toBe(before.centre.y);
          expect(after.centre.x, `${labels[index]}: moved right, off the radar`).toBeGreaterThan(
            before.centre.x
          );
          expect(
            wholeOf(after).left,
            `${labels[index]}: just right of the radar, not past the panel`
          ).toBeLessThan(radar.left + radar.width + CLEARANCE_PX + MOVE_SLACK_PX);
        });
        expect(onTheRadar, 'chevrons that would land on the radar only').toBeGreaterThan(4);
      });
    });

    // ───────────────────────────── 够得着的空位、够不着的时候 ─────────────────────────────

    describe('reaching a free spot', () => {
      /*
       * 三块错开的高面板，一块挨一块（中间放不下箭头），又各自留着空角：从第一块出来落在第二块上，
       * 从第二块出来落在第三块上，再出来才是空地；上下两头都出不去。贴左边的箭头要连挪三步。
       * 几块都在屏幕左半边：每一步都是朝屏幕中心（向右）出去。
       */
      const STAIRS: ReadonlyArray<[id: string, rect: Rect]> = [
        ['hud-score', { left: 0, top: 0, width: 140, height: 720 }],
        ['hud-speed', { left: 145, top: 80, width: 140, height: 720 }],
        ['hud-status', { left: 290, top: 0, width: 140, height: 720 }],
      ];
      const STAIRS_RIGHT_PX = 430;
      /** 再接一块（仍在左半边）：要连挪四步才有空位 */
      const FOURTH_STEP: [id: string, rect: Rect] = [
        'hud-health',
        { left: 435, top: 80, width: 140, height: 720 },
      ];

      it('gets past three blocks in a row', () => {
        kind = wanted;
        const free = unobstructed(DESKTOP);
        const placed = chevronsWith(DESKTOP, () => {
          for (const [id, rect] of STAIRS) mountPanel(id, rect);
        });
        const labels = labelsOfTargets();
        expectClearOf(
          placed,
          STAIRS.map(([id, rect]) => [`#${id}`, rect]),
          labels
        );
        expectInsideViewport(placed, labels, DESKTOP);
        // 贴左边的那些确实越过了三块
        const acrossAll = free.filter(
          (before, index) =>
            before.centre.x < 140 &&
            wholeOf(placed[index]).left >= STAIRS_RIGHT_PX + CLEARANCE_PX - 1
        );
        expect(acrossAll.length, 'chevrons moved past all three blocks').toBeGreaterThan(5);
        placed.forEach((chevron, index) => {
          expect(chevron.rotation).toBe(free[index].rotation);
          expect(chevron.text).toBe(free[index].text);
        });
      });

      it.each([
        ['a panel that covers the whole screen', DESKTOP],
        ['a panel that covers a whole phone screen', PHONE_LANDSCAPE],
        ['a panel that covers a tiny window', { name: 'tiny window', width: 220, height: 240 }],
      ] as const)(
        'stays at the edge, on screen, when there is no free spot (%s)',
        (_name, view) => {
          kind = wanted;
          const free = unobstructed(view);
          const placed = chevronsWith(view, () => {
            mountPanel('hud-status', { left: 0, top: 0, width: view.width, height: view.height });
          });
          const labels = labelsOfTargets();
          expect(centresOf(placed), 'where they would be without the panel').toEqual(
            centresOf(free)
          );
          expectInsideViewport(placed, labels, view);
          placed.forEach((chevron, index) => {
            expect(chevron.rotation).toBe(free[index].rotation);
            expect(chevron.text).toBe(free[index].text);
          });
        }
      );

      /*
       * 找空位最多连走三步。第四块之后明明有空地，但贴左边的箭头要越过四块才到——够不着，留在
       * 贴边的位置；够得着的（本来就在第二块之后的）照常挪开。没有停在半路、压着某一块的。
       */
      it('either clears everything or stays at the edge: never stops half-way on an obstacle', () => {
        kind = wanted;
        const free = unobstructed(DESKTOP);
        const blocks: Array<[string, Rect]> = [...STAIRS, FOURTH_STEP];
        const placed = chevronsWith(DESKTOP, () => {
          for (const [id, rect] of blocks) mountPanel(id, rect);
        });
        const labels = labelsOfTargets();
        const all = blocks.map(([, rect]) => rect);
        expectInsideViewport(placed, labels, DESKTOP);
        let stayed = 0;
        let moved = 0;
        placed.forEach((chevron, index) => {
          if (clearanceOf(chevron, all) < CLEARANCE_PX - ROUNDING_PX) {
            stayed++;
            expect(chevron.centre, `${labels[index]}: still at the edge`).toEqual(
              free[index].centre
            );
          } else if (moveOf(free[index], chevron) > 0) {
            moved++;
          }
        });
        expect(stayed, 'chevrons four blocks away from a free spot').toBeGreaterThan(5);
        expect(moved, 'chevrons within three blocks of a free spot').toBeGreaterThan(5);
      });
    });
  });

  // ───────────────────────────── 导弹箭头与触控控件 ─────────────────────────────

  describe('incoming-missile chevrons (BossMissileIndicator) and the touch controls', () => {
    beforeEach(() => {
      kind = 'missile';
    });

    it.each(TOUCH_VIEWPORTS)(
      'keeps missile chevrons 8 px clear of the stick, the buttons and the radar ($name)',
      (target) => {
        const { controls, radar } = touchScene(target);
        const chevrons = drawnChevrons();
        expectClearOf(chevrons, obstaclesOf(controls, radar));
        expectInsideViewport(chevrons);
        fly(75);
        expectClearOf(drawnChevrons(), obstaclesOf(controls, radar));
        expectInsideViewport(drawnChevrons());
      }
    );

    it.each(TOUCH_VIEWPORTS)(
      'moves the missile chevrons that would land on the controls, pointing the same way ($name)',
      (target) => {
        const free = unobstructed(target);
        const { controls, radar } = touchScene(target);
        const placed = drawnChevrons();
        const obstacles = obstaclesOf(controls, radar).map(([, rect]) => rect);
        let blocked = 0;
        free.forEach((before, index) => {
          const what = describeTarget(targets[index]);
          expect(placed[index].rotation, what).toBe(before.rotation);
          expect(placed[index].text, what).toBe(before.text);
          if (clearanceOf(before, obstacles) >= CLEARANCE_PX - ROUNDING_PX) return;
          blocked++;
          expect(placed[index].centre, `${what}: moved off the controls`).not.toEqual(
            before.centre
          );
          expect(
            outwardOf(placed[index].centre, target),
            `${what}: not pushed toward the edge`
          ).toBeLessThanOrEqual(outwardOf(before.centre, target) + 0.002);
        });
        expect(blocked, 'missile chevrons that would land on the controls').toBeGreaterThan(5);
      }
    );

    it('draws them in a full-screen layer of their own, positioned from the centre', () => {
      touchScene(TABLET_LANDSCAPE);
      const layer = document.getElementById('boss-missile-indicators') as HTMLElement;
      expect(layer, 'the missile chevron layer').toBeTruthy();
      expect(layer.style.position).toBe('fixed');
      expect(px(layer.style.left || '0px', 'layer left')).toBe(0);
      expect(px(layer.style.top || '0px', 'layer top')).toBe(0);
      for (const element of chevronElements()) {
        expect(element.style.position).toBe('absolute');
        // 这个文件按“盒子不旋转、不缩放”还原箭头的位置（放大的是里面的图形）
        expect(element.style.transform).not.toMatch(/rotate|scale|matrix|skew/);
      }
    });
  });

  // ───────────────────────────── 放大的导弹箭头 ─────────────────────────────

  describe('missile chevrons that grow as the missile closes in', () => {
    beforeEach(() => {
      kind = 'missile';
    });

    function graphicScales(): number[] {
      return chevronElements().map((element) =>
        scaleOf((element.querySelector('svg') as SVGElement).style.transform)
      );
    }

    it.each(TOUCH_VIEWPORTS)(
      'keeps the enlarged chevron and its label clear and on screen ($name)',
      (target) => {
        const { controls, radar, hud } = flightScene(target, {
          distances: NEAR_MISSILE_DISTANCES_M,
        });
        const scales = graphicScales();
        expect(Math.max(...scales), 'the nearest missiles are drawn larger').toBeGreaterThan(1.3);
        expect(Math.min(...scales), 'the farthest are not').toBeLessThan(1.15);
        const chevrons = drawnChevrons();
        expectClearOf(chevrons, obstaclesOf(controls, radar, hud));
        expectInsideViewport(chevrons);
        fly(45);
        expectClearOf(drawnChevrons(), obstaclesOf(controls, radar, hud));
        expectInsideViewport(drawnChevrons());
      }
    );

    /*
     * 放大的箭头把标签顶得更远：占位要按放大后的样子算。挨着标签外侧 6px 放一块面板——按没放大的
     * 样子算，面板离标签有 8px 以上；实际只有 6px，箭头得让开。
     */
    it('counts the label where the enlarged chevron really puts it', () => {
      const options = { rings: [110], distances: [8], rollStep: 15 };
      // 同样方位、同样距离的目标箭头不放大：拿它的标签位置作对照
      kind = 'target';
      const plain = unobstructed(PHONE_LANDSCAPE, options);
      kind = 'missile';
      const free = unobstructed(PHONE_LANDSCAPE, options);
      expect(free).toHaveLength(24);

      let pushedOut = 0;
      free.forEach((before, index) => {
        const label = before.label as Box;
        expect(label, 'a near missile shows its distance').toBeTruthy();
        expect(before.text).toBe(plain[index].text);
        // 标签在箭头的哪一侧（取偏得多的那个方向），面板就放在标签的那一侧之外
        const dx = (label.left + label.right) / 2 - before.centre.x;
        const dy = (label.top + label.bottom) / 2 - before.centre.y;
        const sideways = Math.abs(dx) >= Math.abs(dy);
        const size = 60;
        const panel: Rect = sideways
          ? {
              left: dx > 0 ? label.right + 6 : label.left - 6 - size,
              top: (label.top + label.bottom) / 2 - size / 2,
              width: size,
              height: size,
            }
          : {
              left: (label.left + label.right) / 2 - size / 2,
              top: dy > 0 ? label.bottom + 6 : label.top - 6 - size,
              width: size,
              height: size,
            };
        // 标签朝面板那一侧的外沿离箭头中心多远：放大的导弹箭头比不放大的远
        const reachOf = (chevron: DrawnChevron): number => {
          const box = chevron.label as Box;
          if (sideways) {
            return dx > 0 ? box.right - chevron.centre.x : chevron.centre.x - box.left;
          }
          return dy > 0 ? box.bottom - chevron.centre.y : chevron.centre.y - box.top;
        };
        if (reachOf(before) - reachOf(plain[index]) >= 3) pushedOut++;

        const placed = chevronsWith(
          PHONE_LANDSCAPE,
          () => mountPanel('hud-status', panel),
          options
        );
        expect(
          clearanceOf(placed[index], [panel]),
          `missile at bearing ${index * 15}°: clear of the panel next to its label`
        ).toBeGreaterThanOrEqual(CLEARANCE_PX - ROUNDING_PX);
      });
      expect(
        pushedOut,
        'directions in which growing moves the label at least 3 px outward'
      ).toBeGreaterThan(8);
    });
  });

  // ───────────────────────────── 导弹箭头：什么时候量 ─────────────────────────────

  describe('measuring the obstacles for missile chevrons', () => {
    beforeEach(() => {
      kind = 'missile';
    });

    function setInView(inView: boolean): void {
      for (const missile of missiles) missile.inView = inView;
    }

    it('measures when a missile first goes off screen, then only now and then', () => {
      const { controls, radar } = touchScene(TABLET_LANDSCAPE);
      // touchScene 已经飞过第一次更新
      expectClearOf(drawnChevrons(), obstaclesOf(controls, radar));
      const reads = fly(600);
      const measuring = reads
        .map((count, index) => (count > 0 ? index : -1))
        .filter((index) => index >= 0);
      expect(measuring.length, 'updates that read layout').toBeGreaterThanOrEqual(5);
      expect(measuring.length, 'updates that read layout').toBeLessThanOrEqual(40);
      const gaps = measuring.slice(1).map((index, i) => index - measuring[i]);
      expect(Math.min(...gaps), 'updates between two measurements').toBeGreaterThanOrEqual(15);
      expect(Math.max(...gaps), 'updates between two measurements').toBeLessThanOrEqual(120);
    });

    it('reads layout on the first update with an off-screen missile, and nothing in between', () => {
      setViewport(PHONE_PORTRAIT);
      const controls = mountControls();
      mountRadar(controls.layout.radar);
      mountHud();
      createScene();
      expect(fly(1)[0], 'layout reads on the first update').toBeGreaterThan(0);
      flyUntilMeasured();
      expect(fly(10)).toEqual(new Array(10).fill(0));
    });

    it('reads no layout while every missile is in view', () => {
      setViewport(TABLET_LANDSCAPE);
      const controls = mountControls();
      mountRadar(controls.layout.radar);
      createScene();
      setInView(true);
      expect(fly(120)).toEqual(new Array(120).fill(0));
      expect(
        chevronElements().filter((element) => element.style.display !== 'none'),
        'no chevron for a missile in view'
      ).toHaveLength(0);
    });

    it('measures at once when a missile goes off screen after a quiet spell', () => {
      const { controls, radar } = touchScene(TABLET_LANDSCAPE);
      flyUntilMeasured();
      setInView(true);
      // 这段时间里摇杆挪了地方，没有人量
      expect(fly(200)).toEqual(new Array(200).fill(0));
      const size = controls.layout.stick.width;
      const moved: Rect = {
        left: 60,
        top: TABLET_LANDSCAPE.height * 0.5,
        width: size,
        height: size,
      };
      rects.set(controls.stick, moved);

      setInView(false);
      expect(fly(1)[0], 'layout reads on the update that shows the chevrons again').toBeGreaterThan(
        0
      );
      const chevrons = drawnChevrons();
      expectClearOf(chevrons, [
        ['#joystick (moved)', moved],
        ['#radar-minimap', radar],
      ]);
    });

    it('measures again right after a touch starts or the window is resized', () => {
      const { controls } = touchScene(TABLET_LANDSCAPE);
      flyUntilMeasured();
      fly(2);
      controls.root.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
      expect(
        fly(2).some((count) => count > 0),
        'measured within two updates of the touch'
      ).toBe(true);

      fly(3);
      window.dispatchEvent(new Event('resize'));
      expect(
        fly(2).some((count) => count > 0),
        'measured within two updates of the resize'
      ).toBe(true);
    });

    it('dispose() removes the window listeners it added and its layer', () => {
      const tracker = trackListeners();
      try {
        touchScene(TABLET_LANDSCAPE);
        fly(40);
        const global = (): string[] =>
          describeListeners(
            tracker.live.filter((entry) => entry.target === window || entry.target === document)
          );
        expect(global().length, 'listens for touches and resizes while alive').toBeGreaterThan(0);

        (indicator as BossMissileIndicator).dispose();
        indicator = null;
        expect(global(), 'listeners left behind').toEqual([]);
        expect(document.getElementById('boss-missile-indicators')).toBeNull();

        const before = layoutReads;
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('touchstart'));
        expect(layoutReads).toBe(before);
      } finally {
        tracker.stop();
      }
    });

    it('can be disposed before its first update', () => {
      const tracker = trackListeners();
      try {
        const unused = new BossMissileIndicator();
        expect(() => unused.dispose()).not.toThrow();
        expect(describeListeners(tracker.live)).toEqual([]);
      } finally {
        tracker.stop();
      }
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
