import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '@/config';
import {
  InputHandler,
  shapeStickMagnitude,
  TOUCH_STICK_TUNING,
  type InputState,
} from '@/core/Input/InputHandler';
import {
  elementById,
  pressKey,
  releaseKey,
  seedShippedMobileControls,
  TouchScreen,
} from './touchTestUtils';

/**
 * 触控操作（InputHandler，批次 T）：
 * A. 模拟量摇杆：pitchAxis / yawAxis（-1..1，正 = 抬头 / 右转），径向死区 0.12 + 指数曲线 1.7；
 * B. 浮动摇杆：落点即原点，按 identifier 跟踪到 touchend / touchcancel，超出行程限幅，第二根手指不抢；
 * C. 按键按 identifier 松开，touchcancel 松开，失焦 / 切到后台松开全部按住的输入；
 * D. BOOST 是开关（点一下开、再点一下关），Shift 仍是按住加速；
 * E. 触控设备上键盘与触控合并，flightAssist 只在“手指在摇杆上且键盘没有转向”时为 true。
 * DOM 用发布版 index.html 的 #mobile-controls，期望值取自规格里的数字，不读实现的私有字段。
 */

/** 规格：径向死区（占行程的比例）与响应曲线指数 */
const DEAD_ZONE = 0.12;
const EXPO = 1.7;
/** 规格：量不到摇杆底座尺寸时（jsdom 的矩形是 0×0）行程半径为 54px */
const TRAVEL_PX = 54;

/** 规格里的摇杆曲线：死区内为 0，从死区边缘重新起算，再套指数曲线，满偏转为 1 */
function specShape(travel: number): number {
  const magnitude = Math.min(Math.abs(travel), 1);
  if (magnitude <= DEAD_ZONE) {
    return 0;
  }
  return Math.pow((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), EXPO);
}

type Snapshot = Required<InputState>;
type Point = { x: number; y: number };

const STICK_ORIGIN: Point = { x: 180, y: 600 };
const BUTTON_POINT: Point = { x: 930, y: 690 };

const ALL_BUTTON_IDS = [
  'fire-button',
  'missile-button',
  'special-button',
  'flare-button',
  'throttle-button',
  'cycle-button',
  'camera-button',
  'upgrade-button',
] as const;

/** 按住型按键：按键 id → 对应的 InputState 字段 */
const HOLD_BUTTONS: Array<[string, (state: Snapshot) => boolean]> = [
  ['fire-button', (state) => state.fire],
  ['missile-button', (state) => state.missile],
  ['special-button', (state) => state.special],
];

/** 单击型按键：按键 id → 读取并清除它排队的动作 */
const TAP_BUTTONS: Array<[string, (input: InputHandler) => boolean]> = [
  ['camera-button', (input) => input.consumeCameraToggle()],
  ['cycle-button', (input) => input.consumeWeaponCycle()],
  ['flare-button', (input) => input.consumeFlareDeploy()],
  ['upgrade-button', (input) => input.isPauseToggled()],
];

/** 键盘映射（与改动前一致）：按键 code → 置位的布尔字段 */
const KEY_MAP: Array<[string, keyof Snapshot]> = [
  ['KeyW', 'pitchUp'],
  ['ArrowUp', 'pitchUp'],
  ['KeyS', 'pitchDown'],
  ['ArrowDown', 'pitchDown'],
  ['KeyA', 'yawLeft'],
  ['KeyD', 'yawRight'],
  ['KeyQ', 'rollLeft'],
  ['KeyE', 'rollRight'],
  ['Space', 'fire'],
  ['KeyM', 'missile'],
  ['ShiftRight', 'missile'],
  ['ShiftLeft', 'throttle'],
  ['ControlLeft', 'throttle'],
  ['KeyF', 'special'],
];

const BOOLEAN_FIELDS: Array<keyof Snapshot> = [
  'pitchUp',
  'pitchDown',
  'yawLeft',
  'yawRight',
  'rollLeft',
  'rollRight',
  'fire',
  'missile',
  'throttle',
  'special',
];

/** 俯仰 / 偏航 / 滚转键：按住任意一个，转向就算来自键盘 */
const STEERING_KEYS = [
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
] as const;

function hidePage(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
}

function showPage(): void {
  Reflect.deleteProperty(document, 'visibilityState');
  Reflect.deleteProperty(document, 'hidden');
}

/** 失焦 / 切到后台：两种都应松开全部按住的输入 */
const RELEASE_TRIGGERS: Array<[string, () => void]> = [
  ['window blur', () => window.dispatchEvent(new Event('blur'))],
  [
    'visibilitychange to hidden',
    () => {
      hidePage();
      document.dispatchEvent(new Event('visibilitychange'));
    },
  ],
];

describe('touch controls (InputHandler)', () => {
  let handler: InputHandler | null = null;
  let screen: TouchScreen;
  let originalIsMobile: boolean;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    seedShippedMobileControls();
    screen = new TouchScreen();
  });

  afterEach(() => {
    handler?.dispose();
    handler = null;
    showPage();
    GameConfig.isMobile = originalIsMobile;
    document.body.innerHTML = '';
  });

  function touchInput(): InputHandler {
    GameConfig.isMobile = true;
    const created = new InputHandler();
    handler = created;
    return created;
  }

  function desktopInput(): InputHandler {
    GameConfig.isMobile = false;
    const created = new InputHandler();
    handler = created;
    return created;
  }

  /** getState() 返回的是复用对象：断言前复制一份 */
  function read(input: InputHandler): Snapshot {
    return { ...input.getState() };
  }

  /**
   * SPEC / F 的按下沿在松开后的下一步才被消费（改动前就有的行为，不在本批范围内）：
   * 松开之后先丢弃一次采样，再读“稳定下来”的状态。
   */
  function readSettled(input: InputHandler): Snapshot {
    input.getState();
    return read(input);
  }

  function stickZone(): HTMLElement {
    return elementById('touch-stick-zone');
  }

  /** 手指落在摇杆区（或指定元素）上 */
  function grabStick(
    finger = 1,
    origin: Point = STICK_ORIGIN,
    target: HTMLElement = stickZone()
  ): void {
    screen.down(finger, target, origin.x, origin.y);
  }

  /** 把手指移到相对原点 (right, up) × 行程 的位置；up 为屏幕上方（clientY 减小） */
  function pushStick(
    finger: number,
    right: number,
    up: number,
    origin: Point = STICK_ORIGIN,
    travelPx: number = TRAVEL_PX
  ): void {
    screen.move(finger, origin.x + right * travelPx, origin.y - up * travelPx);
  }

  function pressButton(finger: number, id: string): HTMLElement {
    const button = elementById(id);
    screen.down(finger, button, BUTTON_POINT.x, BUTTON_POINT.y);
    return button;
  }

  function tapButton(finger: number, id: string): HTMLElement {
    const button = elementById(id);
    screen.tap(finger, button, BUTTON_POINT.x, BUTTON_POINT.y);
    return button;
  }

  function expectNeutral(state: Snapshot): void {
    for (const field of BOOLEAN_FIELDS) {
      expect(state[field], field).toBe(false);
    }
    expect(state.pitchAxis).toBe(0);
    expect(state.yawAxis).toBe(0);
    expect(state.flightAssist).toBe(false);
  }

  // ───────────────────────────── A. 模拟量摇杆 ─────────────────────────────

  describe('A. stick response curve', () => {
    it('exports the tuning the specification names', () => {
      expect(TOUCH_STICK_TUNING.DEAD_ZONE).toBe(DEAD_ZONE);
      expect(TOUCH_STICK_TUNING.EXPO).toBe(EXPO);
      expect(TOUCH_STICK_TUNING.FALLBACK_RADIUS_PX).toBe(TRAVEL_PX);
      expect(TOUCH_STICK_TUNING.DIGITAL_THRESHOLD).toBeGreaterThan(0);
      expect(TOUCH_STICK_TUNING.DIGITAL_THRESHOLD, 'a small threshold').toBeLessThanOrEqual(0.2);
      expect(Number.isFinite(TOUCH_STICK_TUNING.EDGE_MARGIN_PX)).toBe(true);
      expect(TOUCH_STICK_TUNING.EDGE_MARGIN_PX).toBeGreaterThanOrEqual(0);
    });

    it.each([0, 0.03, 0.08, 0.1199, 0.12])('is 0 inside the dead zone (%f of travel)', (travel) => {
      expect(shapeStickMagnitude(travel)).toBe(0);
    });

    it('starts from 0 at the dead-zone edge and rises continuously', () => {
      const justOutside = shapeStickMagnitude(DEAD_ZONE + 1e-4);
      expect(justOutside).toBeGreaterThan(0);
      expect(justOutside, 'no jump at the dead-zone edge').toBeLessThan(1e-3);

      let previous = 0;
      for (let travel = DEAD_ZONE + 0.01; travel <= 1 + 1e-9; travel += 0.01) {
        const shaped = shapeStickMagnitude(travel);
        expect(shaped, `monotonic at ${travel.toFixed(2)}`).toBeGreaterThan(previous);
        expect(shaped - previous, `no jump at ${travel.toFixed(2)}`).toBeLessThan(0.03);
        previous = shaped;
      }
    });

    it.each([0.2, 0.34, 0.56, 0.78, 0.9])(
      'follows the rescaled dead zone and the 1.7 expo curve at %f of travel',
      (travel) => {
        expect(shapeStickMagnitude(travel)).toBeCloseTo(specShape(travel), 9);
      }
    );

    it('is below linear for small deflections (expo) and exactly 1 at full deflection', () => {
      // 0.56 的行程重新起算后是一半：0.5^1.7 ≈ 0.3078，低于线性的 0.5
      expect(shapeStickMagnitude(0.56)).toBeCloseTo(0.3078, 3);
      expect(shapeStickMagnitude(1)).toBe(1);
    });

    it.each([1.0001, 1.5, 10])('clamps %f of travel to magnitude 1', (travel) => {
      expect(shapeStickMagnitude(travel)).toBe(1);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.5])(
      'returns a finite value in 0..1 for %f',
      (travel) => {
        const shaped = shapeStickMagnitude(travel);
        expect(Number.isFinite(shaped)).toBe(true);
        expect(shaped).toBeGreaterThanOrEqual(0);
        expect(shaped).toBeLessThanOrEqual(1);
      }
    );
  });

  describe('A. analog axes in InputState', () => {
    it('getState() always fills pitchAxis, yawAxis and flightAssist (desktop, idle)', () => {
      const state = read(desktopInput());
      expect(state.pitchAxis).toBe(0);
      expect(state.yawAxis).toBe(0);
      expect(state.flightAssist).toBe(false);
    });

    it('getState() always fills pitchAxis, yawAxis and flightAssist (touch, idle)', () => {
      const state = read(touchInput());
      expect(state.pitchAxis).toBe(0);
      expect(state.yawAxis).toBe(0);
      expect(state.flightAssist).toBe(false);
    });

    it.each([0.25, 0.4, 0.5, 0.75, 0.9, 1])(
      'a stick pushed right by %f of its travel gives the shaped yawAxis and no pitch',
      (travel) => {
        const input = touchInput();
        grabStick();
        pushStick(1, travel, 0);

        const state = read(input);
        expect(state.yawAxis).toBeCloseTo(specShape(travel), 6);
        expect(state.pitchAxis).toBeCloseTo(0, 9);
      }
    );

    it('pushing right / left gives positive / negative yawAxis', () => {
      const input = touchInput();
      grabStick();

      pushStick(1, 0.8, 0);
      expect(read(input).yawAxis).toBeCloseTo(specShape(0.8), 6);

      pushStick(1, -0.8, 0);
      expect(read(input).yawAxis).toBeCloseTo(-specShape(0.8), 6);
    });

    it('pushing the stick up the screen gives positive pitchAxis (nose up), down gives negative', () => {
      const input = touchInput();
      grabStick();

      pushStick(1, 0, 0.8);
      const up = read(input);
      expect(up.pitchAxis).toBeCloseTo(specShape(0.8), 6);
      expect(up.yawAxis).toBeCloseTo(0, 9);

      pushStick(1, 0, -0.8);
      expect(read(input).pitchAxis).toBeCloseTo(-specShape(0.8), 6);
    });

    it('half deflection is clearly below half output, full deflection is 1', () => {
      const input = touchInput();
      grabStick();

      pushStick(1, 0.5, 0);
      const half = read(input).yawAxis;
      expect(half).toBeGreaterThan(0.15);
      expect(half).toBeLessThan(0.35);

      pushStick(1, 1, 0);
      expect(read(input).yawAxis).toBeCloseTo(1, 9);
    });

    it('the dead zone is radial: both axes are 0 while the deflection is inside it', () => {
      const input = touchInput();
      grabStick();

      // 0.08 / 0.08 的斜向偏转幅度约 0.113，仍在 0.12 的死区内
      for (const [right, up] of [
        [0.1, 0],
        [0, -0.11],
        [0.08, 0.08],
        [-0.08, 0.08],
      ]) {
        pushStick(1, right, up);
        const state = read(input);
        expect(state.yawAxis, `yaw at (${right}, ${up})`).toBe(0);
        expect(state.pitchAxis, `pitch at (${right}, ${up})`).toBe(0);
      }
    });

    it('the dead zone is radial: a diagonal just past it moves both axes although each component is under 0.12', () => {
      const input = touchInput();
      grabStick();

      // 0.1 / 0.1：每个分量都小于 0.12，幅度约 0.141 已经出了死区
      pushStick(1, 0.1, 0.1);
      const state = read(input);
      expect(state.yawAxis).toBeGreaterThan(0);
      expect(state.pitchAxis).toBeGreaterThan(0);
      expect(state.yawAxis).toBeCloseTo(state.pitchAxis, 9);
      expect(Math.hypot(state.yawAxis, state.pitchAxis)).toBeCloseTo(
        specShape(Math.hypot(0.1, 0.1)),
        6
      );
    });

    it('shapes the magnitude and keeps the direction of a diagonal deflection', () => {
      const input = touchInput();
      grabStick();

      // (0.3, 0.4)：幅度 0.5，方向 (0.6, 0.8)
      pushStick(1, 0.3, 0.4);
      const state = read(input);
      expect(state.yawAxis).toBeCloseTo(0.6 * specShape(0.5), 6);
      expect(state.pitchAxis).toBeCloseTo(0.8 * specShape(0.5), 6);
    });

    it('a full diagonal deflection has magnitude 1, not 1 on each axis', () => {
      const input = touchInput();
      grabStick();
      pushStick(1, 3, 3);

      const state = read(input);
      expect(Math.hypot(state.yawAxis, state.pitchAxis)).toBeCloseTo(1, 6);
      expect(state.yawAxis).toBeCloseTo(Math.SQRT1_2, 6);
      expect(state.pitchAxis).toBeCloseTo(Math.SQRT1_2, 6);
    });

    it('axes stay within -1..1 across the whole stick range', () => {
      const input = touchInput();
      grabStick();
      for (let right = -2; right <= 2; right += 0.25) {
        for (let up = -2; up <= 2; up += 0.25) {
          pushStick(1, right, up);
          const state = read(input);
          expect(Math.abs(state.yawAxis)).toBeLessThanOrEqual(1);
          expect(Math.abs(state.pitchAxis)).toBeLessThanOrEqual(1);
        }
      }
    });

    describe.each([
      ['desktop', () => desktopInput()],
      ['touch device with a keyboard', () => touchInput()],
    ])('keyboard steering on a %s', (_device, createInput) => {
      it.each([
        ['KeyW', 'pitchAxis', 1],
        ['ArrowUp', 'pitchAxis', 1],
        ['KeyS', 'pitchAxis', -1],
        ['ArrowDown', 'pitchAxis', -1],
        ['KeyD', 'yawAxis', 1],
        ['KeyA', 'yawAxis', -1],
      ] as const)('%s gives %s exactly %i', (code, axis, expected) => {
        const input = createInput();
        pressKey(code);
        const held = read(input);
        expect(held[axis]).toBe(expected);
        expect(held[axis === 'pitchAxis' ? 'yawAxis' : 'pitchAxis']).toBe(0);

        releaseKey(code);
        expect(read(input)[axis]).toBe(0);
      });
    });

    it('the legacy direction booleans follow the keys on desktop', () => {
      const input = desktopInput();
      pressKey('KeyW');
      pressKey('KeyD');
      let state = read(input);
      expect(state.pitchUp).toBe(true);
      expect(state.yawRight).toBe(true);
      expect(state.pitchDown).toBe(false);
      expect(state.yawLeft).toBe(false);

      releaseKey('KeyW');
      releaseKey('KeyD');
      pressKey('KeyS');
      pressKey('KeyA');
      state = read(input);
      expect(state.pitchDown).toBe(true);
      expect(state.yawLeft).toBe(true);
      expect(state.pitchUp).toBe(false);
      expect(state.yawRight).toBe(false);
    });

    it('on touch the direction booleans follow the stick direction', () => {
      const input = touchInput();
      grabStick();

      pushStick(1, 0.6, 0);
      expect(read(input)).toMatchObject({ yawRight: true, yawLeft: false });
      pushStick(1, -0.6, 0);
      expect(read(input)).toMatchObject({ yawRight: false, yawLeft: true });
      pushStick(1, 0, 0.6);
      expect(read(input)).toMatchObject({ pitchUp: true, pitchDown: false });
      pushStick(1, 0, -0.6);
      expect(read(input)).toMatchObject({ pitchUp: false, pitchDown: true });
    });

    it('on touch a direction boolean is set once its axis is beyond the small threshold, not before', () => {
      const input = touchInput();
      grabStick();
      const threshold = TOUCH_STICK_TUNING.DIGITAL_THRESHOLD;
      let below = 0;
      let above = 0;

      for (let travel = 0; travel <= 1 + 1e-9; travel += 0.02) {
        pushStick(1, travel, -travel);
        const state = read(input);
        expect(state.yawRight, `yawRight at ${travel.toFixed(2)}`).toBe(state.yawAxis > threshold);
        expect(state.pitchDown, `pitchDown at ${travel.toFixed(2)}`).toBe(
          state.pitchAxis < -threshold
        );
        expect(state.yawLeft).toBe(false);
        expect(state.pitchUp).toBe(false);
        if (state.yawRight) above++;
        else below++;
      }

      expect(below, 'some deflections stay under the threshold').toBeGreaterThan(0);
      expect(above, 'some deflections pass the threshold').toBeGreaterThan(0);
    });

    it('on touch the booleans are false inside the dead zone and true at half deflection', () => {
      const input = touchInput();
      grabStick();

      pushStick(1, 0.1, 0);
      expect(read(input).yawRight).toBe(false);

      pushStick(1, 0.5, 0);
      expect(read(input).yawRight).toBe(true);
    });

    it('on touch a key sets its direction boolean without any stick deflection', () => {
      const input = touchInput();
      pressKey('KeyW');
      pressKey('KeyA');
      const state = read(input);
      expect(state.pitchUp).toBe(true);
      expect(state.yawLeft).toBe(true);
    });
  });

  // ───────────────────────────── B. 浮动摇杆 ─────────────────────────────

  describe('B. floating stick', () => {
    it.each([
      { x: 40, y: 320 },
      { x: 180, y: 600 },
      { x: 400, y: 740 },
    ])('a touch at ($x, $y) in the stick zone grabs the stick with zero deflection', (origin) => {
      const input = touchInput();
      grabStick(1, origin);

      const state = read(input);
      expect(state.pitchAxis).toBe(0);
      expect(state.yawAxis).toBe(0);
      expect(state.flightAssist, 'the stick is held').toBe(true);
    });

    it('the origin is wherever the finger landed: the same displacement gives the same output', () => {
      const input = touchInput();
      const outputs: Array<[number, number]> = [];

      for (const [finger, origin] of [
        [1, { x: 40, y: 320 }],
        [2, { x: 300, y: 500 }],
        [3, { x: 410, y: 745 }],
      ] as Array<[number, Point]>) {
        grabStick(finger, origin);
        pushStick(finger, 0.3, 0.4, origin);
        const state = read(input);
        outputs.push([state.yawAxis, state.pitchAxis]);
        screen.up(finger);
      }

      for (const [yaw, pitch] of outputs) {
        expect(yaw).toBeCloseTo(0.6 * specShape(0.5), 6);
        expect(pitch).toBeCloseTo(0.8 * specShape(0.5), 6);
      }
    });

    it.each(['joystick', 'joystick-knob'])(
      'a touch on the visible #%s also grabs the stick, with the origin at the touch point',
      (id) => {
        const input = touchInput();
        const origin = { x: 61, y: 673 };
        grabStick(1, origin, elementById(id));

        const grabbed = read(input);
        expect(grabbed.pitchAxis).toBe(0);
        expect(grabbed.yawAxis).toBe(0);
        expect(grabbed.flightAssist).toBe(true);

        pushStick(1, 0.5, 0, origin);
        expect(read(input).yawAxis).toBeCloseTo(specShape(0.5), 6);
      }
    );

    it('works for a touch whose identifier is 0', () => {
      const input = touchInput();
      grabStick(0);
      pushStick(0, 0, 0.75);
      expect(read(input).pitchAxis).toBeCloseTo(specShape(0.75), 6);

      screen.up(0);
      expect(read(input).pitchAxis).toBe(0);
    });

    it('keeps tracking the finger far outside the base and the zone', () => {
      const input = touchInput();
      grabStick();

      // 手指滑到屏幕另一头（远离摇杆区），再滑回原点附近
      screen.move(1, 1000, 40);
      const far = read(input);
      expect(Math.hypot(far.yawAxis, far.pitchAxis)).toBeCloseTo(1, 6);
      expect(far.yawAxis).toBeGreaterThan(0);
      expect(far.pitchAxis).toBeGreaterThan(0);
      expect(far.flightAssist).toBe(true);

      screen.move(1, -400, 2000);
      const otherSide = read(input);
      expect(otherSide.yawAxis).toBeLessThan(0);
      expect(otherSide.pitchAxis).toBeLessThan(0);
      expect(otherSide.flightAssist).toBe(true);

      pushStick(1, 0.5, 0);
      const back = read(input);
      expect(back.yawAxis).toBeCloseTo(specShape(0.5), 6);
      expect(back.flightAssist).toBe(true);
    });

    it.each([1, 1.01, 2, 10, 100])(
      'deflection of %f times the travel radius clamps to magnitude 1',
      (travel) => {
        const input = touchInput();
        grabStick();

        pushStick(1, travel, 0);
        const right = read(input);
        expect(right.yawAxis).toBeCloseTo(1, 6);
        expect(right.pitchAxis).toBeCloseTo(0, 9);

        pushStick(1, -0.6 * travel, 0.8 * travel);
        const diagonal = read(input);
        expect(Math.hypot(diagonal.yawAxis, diagonal.pitchAxis)).toBeCloseTo(1, 6);
        expect(diagonal.yawAxis).toBeCloseTo(-0.6, 6);
        expect(diagonal.pitchAxis).toBeCloseTo(0.8, 6);
      }
    );

    /** 让 #joystick 量得到尺寸：平板上直径 150px，静止位置在左下角 */
    function layOutTabletStick(): void {
      elementById('joystick').getBoundingClientRect = (): DOMRect => ({
        x: 28,
        y: 560,
        left: 28,
        top: 560,
        width: 150,
        height: 150,
        right: 178,
        bottom: 710,
        toJSON: () => ({}),
      });
    }

    it('the travel radius is half the measured width of #joystick at touchstart', () => {
      const input = touchInput();
      // 直径 150px：行程半径 75px
      layOutTabletStick();

      const origin = { x: 240, y: 520 };
      grabStick(1, origin);
      expect(read(input).yawAxis).toBe(0);

      pushStick(1, 0.5, 0, origin, 75);
      expect(read(input).yawAxis).toBeCloseTo(specShape(0.5), 6);

      pushStick(1, 1, 0, origin, 75);
      expect(read(input).yawAxis).toBeCloseTo(1, 6);
    });

    it.each([
      { x: 3, y: 765 },
      { x: 2, y: 300 },
      { x: 425, y: 766 },
    ])('a touch at the screen edge ($x, $y) still has its origin at the touch point', (origin) => {
      // 底座放不到屏幕外面去，但原点仍是手指落点：落下时零偏转，位移从落点算起
      const input = touchInput();
      layOutTabletStick();

      grabStick(1, origin);
      const grabbed = read(input);
      expect(grabbed.yawAxis).toBe(0);
      expect(grabbed.pitchAxis).toBe(0);
      expect(grabbed.flightAssist).toBe(true);

      pushStick(1, 0.5, 0, origin, 75);
      expect(read(input).yawAxis).toBeCloseTo(specShape(0.5), 6);
      pushStick(1, 0, 1, origin, 75);
      expect(read(input).pitchAxis).toBeCloseTo(1, 6);
    });

    it('a second touch in the zone while the stick is held cannot steal it', () => {
      const input = touchInput();
      grabStick(1);
      pushStick(1, 0.7, 0);
      const before = read(input);
      expect(before.yawAxis).toBeCloseTo(specShape(0.7), 6);

      // 第二根手指落在摇杆区另一处：原点不变、输出不变
      const intruder = { x: 320, y: 420 };
      grabStick(2, intruder);
      expect(read(input)).toEqual(before);

      // 第二根手指怎么移动都不转向
      pushStick(2, -1, 1, intruder);
      expect(read(input)).toEqual(before);

      // 第二根手指抬起也不会松开摇杆
      screen.up(2);
      expect(read(input)).toEqual(before);

      // 第一根手指仍然握着摇杆，原点还是它的落点
      pushStick(1, 0, 0.7);
      const after = read(input);
      expect(after.pitchAxis).toBeCloseTo(specShape(0.7), 6);
      expect(after.yawAxis).toBeCloseTo(0, 9);
      expect(after.flightAssist).toBe(true);
    });

    it('a second touch on the visible base while the stick is held cannot steal it either', () => {
      const input = touchInput();
      grabStick(1);
      pushStick(1, -0.7, 0);
      const before = read(input);

      grabStick(2, { x: 60, y: 690 }, elementById('joystick'));
      screen.move(2, 400, 300);
      expect(read(input)).toEqual(before);

      screen.cancel(2);
      expect(read(input)).toEqual(before);
    });

    it.each(['touchend', 'touchcancel'] as const)('%s returns both axes to 0', (ending) => {
      const input = touchInput();
      grabStick();
      pushStick(1, 0.6, 0.8);
      expect(Math.hypot(read(input).yawAxis, read(input).pitchAxis)).toBeCloseTo(1, 6);

      if (ending === 'touchend') {
        screen.up(1);
      } else {
        screen.cancel(1);
      }
      expectNeutral(read(input));
    });

    it('only the finger holding the stick releases it or steers it', () => {
      const input = touchInput();
      grabStick(1);
      pushStick(1, 0.7, 0);
      const before = read(input);

      // 另一根手指在开火键上按下、滑动、抬起
      pressButton(2, 'fire-button');
      screen.move(2, 600, 300);
      expect(read(input)).toEqual({ ...before, fire: true });
      screen.up(2);
      expect(read(input)).toEqual(before);

      // 另一根手指在导弹键上被系统取消
      pressButton(3, 'missile-button');
      screen.cancel(3);
      expect(read(input)).toEqual(before);
    });

    it('after a release the next touch grabs the stick again at its own origin', () => {
      const input = touchInput();
      grabStick(1);
      pushStick(1, 1, 0);
      screen.up(1);
      expectNeutral(read(input));

      const origin = { x: 90, y: 400 };
      grabStick(2, origin);
      expect(read(input).yawAxis).toBe(0);
      pushStick(2, -0.5, 0, origin);
      expect(read(input).yawAxis).toBeCloseTo(-specShape(0.5), 6);
    });

    it('a touch outside the stick zone and the base does not grab the stick', () => {
      const input = touchInput();
      screen.down(1, document.body, 500, 200);
      screen.move(1, 700, 100);

      expectNeutral(read(input));
    });

    it('touch points without finite coordinates never put a non-finite value on the axes', () => {
      const input = touchInput();

      // 没有坐标的落点定不了原点
      screen.down(1, stickZone(), Number.NaN, Number.NaN);
      screen.move(1, 300, 500);
      let state = read(input);
      expect(Number.isFinite(state.yawAxis)).toBe(true);
      expect(Number.isFinite(state.pitchAxis)).toBe(true);
      screen.up(1);

      // 握住之后收到一次坏坐标：输出仍然有限、仍在 -1..1 内
      grabStick(2);
      pushStick(2, 0.5, 0);
      screen.move(2, Number.NaN, Number.POSITIVE_INFINITY);
      state = read(input);
      expect(Number.isFinite(state.yawAxis)).toBe(true);
      expect(Number.isFinite(state.pitchAxis)).toBe(true);
      expect(Math.abs(state.yawAxis)).toBeLessThanOrEqual(1);
      expect(Math.abs(state.pitchAxis)).toBeLessThanOrEqual(1);

      // 之后的正常移动照常生效
      pushStick(2, 0, 0.5);
      expect(read(input).pitchAxis).toBeCloseTo(specShape(0.5), 6);
    });
  });

  // ───────────────────────────── C. 按键 ─────────────────────────────

  describe('C. buttons', () => {
    it.each(HOLD_BUTTONS)('#%s is held while its finger is down', (id, isHeld) => {
      const input = touchInput();
      expect(isHeld(read(input))).toBe(false);

      pressButton(1, id);
      expect(isHeld(read(input))).toBe(true);
      expect(isHeld(read(input)), 'still held on the next step').toBe(true);

      screen.up(1);
      expect(isHeld(readSettled(input))).toBe(false);
    });

    it.each(HOLD_BUTTONS)('#%s is released only by the finger that pressed it', (id, isHeld) => {
      const input = touchInput();
      const button = pressButton(1, id);

      // 第二根手指也落在这个键上，然后抬起：不是按下它的那根手指
      screen.down(2, button, BUTTON_POINT.x + 6, BUTTON_POINT.y + 4);
      screen.up(2);
      expect(isHeld(readSettled(input)), 'another finger lifting must not release it').toBe(true);

      screen.up(1);
      expect(isHeld(readSettled(input))).toBe(false);
    });

    it.each(HOLD_BUTTONS)('#%s is not released by another finger being cancelled', (id, isHeld) => {
      const input = touchInput();
      const button = pressButton(1, id);

      screen.down(2, button, BUTTON_POINT.x + 6, BUTTON_POINT.y + 4);
      screen.cancel(2);
      expect(isHeld(readSettled(input))).toBe(true);

      screen.up(1);
      expect(isHeld(readSettled(input))).toBe(false);
    });

    it.each(HOLD_BUTTONS)('#%s is released by touchcancel', (id, isHeld) => {
      const input = touchInput();
      pressButton(1, id);
      expect(isHeld(read(input))).toBe(true);

      screen.cancel(1);
      expect(isHeld(readSettled(input))).toBe(false);
    });

    it('buttons held by different fingers are independent', () => {
      const input = touchInput();
      pressButton(1, 'fire-button');
      pressButton(2, 'missile-button');
      expect(read(input)).toMatchObject({ fire: true, missile: true });

      screen.up(2);
      expect(read(input)).toMatchObject({ fire: true, missile: false });

      pressButton(3, 'missile-button');
      screen.up(1);
      expect(read(input)).toMatchObject({ fire: false, missile: true });

      screen.up(3);
      expect(read(input)).toMatchObject({ fire: false, missile: false });
    });

    it.each(ALL_BUTTON_IDS)(
      '#%s shows .is-pressed until the finger that pressed it lifts',
      (id) => {
        touchInput();
        const button = pressButton(1, id);
        expect(button.classList.contains('is-pressed')).toBe(true);

        screen.down(2, button, BUTTON_POINT.x + 6, BUTTON_POINT.y + 4);
        screen.up(2);
        expect(
          button.classList.contains('is-pressed'),
          'another finger lifting must not release it'
        ).toBe(true);

        screen.up(1);
        expect(button.classList.contains('is-pressed')).toBe(false);
      }
    );

    it.each(ALL_BUTTON_IDS)('#%s drops .is-pressed on touchcancel', (id) => {
      touchInput();
      const button = pressButton(1, id);
      expect(button.classList.contains('is-pressed')).toBe(true);

      screen.cancel(1);
      expect(button.classList.contains('is-pressed')).toBe(false);
    });

    it.each(TAP_BUTTONS)(
      '#%s acts once per tap and works again after a cancelled touch',
      (id, consume) => {
        const input = touchInput();
        expect(consume(input)).toBe(false);

        tapButton(1, id);
        expect(consume(input)).toBe(true);
        expect(consume(input), 'one tap is one action').toBe(false);

        // 一次被系统取消的触摸之后，按键不能卡在“按着”的状态
        pressButton(2, id);
        screen.cancel(2);
        consume(input);

        tapButton(3, id);
        expect(consume(input)).toBe(true);
        expect(consume(input)).toBe(false);
      }
    );

    describe.each(RELEASE_TRIGGERS)('%s', (_name, trigger) => {
      it('releases held keys on a touch device', () => {
        const input = touchInput();
        for (const code of ['KeyW', 'KeyD', 'KeyQ', 'Space', 'ShiftLeft', 'KeyM', 'KeyF']) {
          pressKey(code);
        }
        expect(read(input)).toMatchObject({
          pitchUp: true,
          yawRight: true,
          rollLeft: true,
          fire: true,
          throttle: true,
          missile: true,
          special: true,
          pitchAxis: 1,
          yawAxis: 1,
        });

        trigger();
        expectNeutral(readSettled(input));
      });

      it('releases held keys on desktop', () => {
        const input = desktopInput();
        for (const code of ['KeyS', 'KeyA', 'KeyE', 'Space', 'ShiftLeft', 'KeyM']) {
          pressKey(code);
        }
        expect(read(input)).toMatchObject({
          pitchDown: true,
          yawLeft: true,
          rollRight: true,
          fire: true,
          throttle: true,
          missile: true,
          pitchAxis: -1,
          yawAxis: -1,
        });

        trigger();
        expectNeutral(readSettled(input));
      });

      it('releases the stick, and the finger still on the glass no longer steers', () => {
        const input = touchInput();
        grabStick(1);
        pushStick(1, 0.6, 0.8);
        expect(read(input)).toMatchObject({ flightAssist: true, yawRight: true, pitchUp: true });

        trigger();
        expectNeutral(read(input));

        pushStick(1, -1, 0);
        expectNeutral(read(input));
      });

      it('lets a fresh touch grab the stick afterwards', () => {
        const input = touchInput();
        grabStick(1);
        pushStick(1, 1, 0);

        trigger();
        screen.up(1);
        showPage();

        grabStick(2);
        pushStick(2, 0, 1);
        const state = read(input);
        expect(state.pitchAxis).toBeCloseTo(1, 6);
        expect(state.yawAxis).toBeCloseTo(0, 9);
        expect(state.flightAssist).toBe(true);
      });

      it('releases every held button', () => {
        const input = touchInput();
        const fire = pressButton(1, 'fire-button');
        const missile = pressButton(2, 'missile-button');
        const special = pressButton(3, 'special-button');
        expect(read(input)).toMatchObject({ fire: true, missile: true, special: true });

        trigger();
        expect(readSettled(input)).toMatchObject({ fire: false, missile: false, special: false });
        for (const button of [fire, missile, special]) {
          expect(button.classList.contains('is-pressed'), button.id).toBe(false);
        }
      });

      it('clears the boost latch', () => {
        const input = touchInput();
        const boost = tapButton(1, 'throttle-button');
        expect(read(input).throttle).toBe(true);

        trigger();
        expect(read(input).throttle).toBe(false);
        expect(boost.classList.contains('is-active')).toBe(false);
        expect(boost.getAttribute('aria-pressed')).not.toBe('true');
      });

      it('releases keys, stick, buttons and boost together', () => {
        const input = touchInput();
        pressKey('KeyQ');
        pressKey('Space');
        grabStick(1);
        pushStick(1, -1, 0);
        pressButton(2, 'missile-button');
        pressButton(3, 'special-button');
        tapButton(4, 'throttle-button');
        expect(read(input)).toMatchObject({
          rollLeft: true,
          fire: true,
          yawLeft: true,
          missile: true,
          special: true,
          throttle: true,
        });

        trigger();
        expectNeutral(readSettled(input));
      });
    });

    it('a visibilitychange while the page stays visible keeps held input', () => {
      const input = touchInput();
      pressKey('Space');
      grabStick(1);
      pushStick(1, 1, 0);
      pressButton(2, 'missile-button');
      tapButton(3, 'throttle-button');
      const before = read(input);
      expect(before).toMatchObject({ fire: true, missile: true, throttle: true, yawRight: true });

      document.dispatchEvent(new Event('visibilitychange'));
      expect(read(input)).toEqual(before);
    });
  });

  // ───────────────────────────── D. 加速开关 ─────────────────────────────

  describe('D. boost latch', () => {
    function expectLatched(button: HTMLElement, latched: boolean): void {
      expect(button.classList.contains('is-active'), '.is-active').toBe(latched);
      if (latched) {
        expect(button.getAttribute('aria-pressed')).toBe('true');
      } else {
        expect(button.getAttribute('aria-pressed')).not.toBe('true');
      }
    }

    it('starts off', () => {
      const input = touchInput();
      expect(read(input).throttle).toBe(false);
      expectLatched(elementById('throttle-button'), false);
    });

    it('a tap turns boost on and it stays on after the finger lifts', () => {
      const input = touchInput();
      const boost = tapButton(1, 'throttle-button');

      expect(screen.isDown(1)).toBe(false);
      for (let step = 0; step < 30; step++) {
        expect(read(input).throttle, `step ${step}`).toBe(true);
      }
      expectLatched(boost, true);
    });

    it('a second tap turns it off, a third on again', () => {
      const input = touchInput();
      const boost = tapButton(1, 'throttle-button');
      expect(read(input).throttle).toBe(true);

      tapButton(2, 'throttle-button');
      expect(read(input).throttle).toBe(false);
      expectLatched(boost, false);

      tapButton(3, 'throttle-button');
      expect(read(input).throttle).toBe(true);
      expectLatched(boost, true);
    });

    it('toggles once per tap however long the finger rests on the button', () => {
      const input = touchInput();
      const boost = pressButton(1, 'throttle-button');
      for (let step = 0; step < 20; step++) {
        input.getState();
      }
      screen.move(1, BUTTON_POINT.x + 3, BUTTON_POINT.y - 2);
      screen.up(1);

      expect(read(input).throttle).toBe(true);
      expectLatched(boost, true);
    });

    it('is not affected by the stick or the other buttons', () => {
      const input = touchInput();
      const boost = tapButton(1, 'throttle-button');

      grabStick(2);
      pushStick(2, 1, 0);
      pressButton(3, 'fire-button');
      screen.up(3);
      tapButton(4, 'flare-button');
      screen.up(2);

      expect(read(input).throttle).toBe(true);
      expectLatched(boost, true);
    });

    it('resetActionQueue() clears the latch', () => {
      const input = touchInput();
      const boost = tapButton(1, 'throttle-button');
      expect(read(input).throttle).toBe(true);

      input.resetActionQueue();
      expect(read(input).throttle).toBe(false);
      expectLatched(boost, false);

      // 清掉之后下一次轻点重新打开（不是“再点一下才关”）
      tapButton(2, 'throttle-button');
      expect(read(input).throttle).toBe(true);
      expectLatched(boost, true);
    });

    it('dispose() clears the latch', () => {
      const input = touchInput();
      const boost = tapButton(1, 'throttle-button');
      expectLatched(boost, true);

      input.dispose();
      handler = null;
      expectLatched(boost, false);
      expect(read(input).throttle).toBe(false);
    });

    it('a handler created after dispose() starts unlatched and toggles once per tap', () => {
      const first = touchInput();
      tapButton(1, 'throttle-button');
      first.dispose();

      const second = touchInput();
      const boost = elementById('throttle-button');
      expect(read(second).throttle).toBe(false);
      expectLatched(boost, false);

      tapButton(2, 'throttle-button');
      expect(read(second).throttle).toBe(true);
      expect(read(first).throttle, 'the disposed handler no longer listens').toBe(false);
      expectLatched(boost, true);
    });

    describe.each([
      ['desktop', () => desktopInput()],
      ['touch device', () => touchInput()],
    ])('keyboard Shift on a %s', (_device, createInput) => {
      it('boosts only while held', () => {
        const input = createInput();
        expect(read(input).throttle).toBe(false);

        pressKey('ShiftLeft');
        expect(read(input).throttle).toBe(true);
        expect(read(input).throttle).toBe(true);

        releaseKey('ShiftLeft');
        expect(read(input).throttle).toBe(false);
      });

      it('does not latch: pressing it twice leaves boost off', () => {
        const input = createInput();
        pressKey('ShiftLeft');
        releaseKey('ShiftLeft');
        pressKey('ShiftLeft');
        releaseKey('ShiftLeft');
        expect(read(input).throttle).toBe(false);
      });
    });

    it('releasing Shift does not clear a latched boost', () => {
      const input = touchInput();
      tapButton(1, 'throttle-button');
      pressKey('ShiftLeft');
      expect(read(input).throttle).toBe(true);

      releaseKey('ShiftLeft');
      expect(read(input).throttle).toBe(true);
    });
  });

  // ───────────────────────────── E. 键盘 + 触控 ─────────────────────────────

  describe('E. keyboard plus touch', () => {
    describe.each([
      ['desktop', () => desktopInput()],
      ['touch device', () => touchInput()],
    ])('key mapping on a %s', (_device, createInput) => {
      it.each(KEY_MAP)('%s sets %s while held and nothing else', (code, field) => {
        const input = createInput();
        pressKey(code);
        // 连读几步：按住期间一直为 true，而不只是按下沿那一步
        for (let step = 0; step < 3; step++) {
          const held = read(input);
          for (const other of BOOLEAN_FIELDS) {
            expect(held[other], `${other} at step ${step}`).toBe(other === field);
          }
        }

        releaseKey(code);
        expectNeutral(readSettled(input));
      });
    });

    it.each([
      ['fire', 'Space', 'fire-button'],
      ['missile', 'KeyM', 'missile-button'],
      ['special', 'KeyF', 'special-button'],
    ] as const)('%s is the key OR the button', (field, code, buttonId) => {
      const input = touchInput();

      pressKey(code);
      expect(read(input)[field], 'key only').toBe(true);

      pressButton(1, buttonId);
      expect(read(input)[field], 'key and button').toBe(true);

      releaseKey(code);
      expect(readSettled(input)[field], 'button only').toBe(true);

      screen.up(1);
      expect(readSettled(input)[field], 'neither').toBe(false);

      pressButton(2, buttonId);
      pressKey(code);
      screen.up(2);
      expect(readSettled(input)[field], 'key still held after the button').toBe(true);

      releaseKey(code);
      expect(readSettled(input)[field]).toBe(false);
    });

    it('throttle is Shift OR the boost latch', () => {
      const input = touchInput();

      pressKey('ShiftLeft');
      expect(read(input).throttle, 'Shift only').toBe(true);
      releaseKey('ShiftLeft');
      expect(read(input).throttle).toBe(false);

      tapButton(1, 'throttle-button');
      expect(read(input).throttle, 'latch only').toBe(true);
      pressKey('ShiftLeft');
      expect(read(input).throttle, 'both').toBe(true);

      tapButton(2, 'throttle-button');
      expect(read(input).throttle, 'latch off, Shift still held').toBe(true);
      releaseKey('ShiftLeft');
      expect(read(input).throttle).toBe(false);
    });

    it('each axis takes the source with the larger magnitude', () => {
      const input = touchInput();
      grabStick(1);
      pushStick(1, 0.5, 0.5);
      const stickOnly = read(input);
      expect(stickOnly.yawAxis).toBeGreaterThan(0);
      expect(stickOnly.yawAxis).toBeLessThan(1);
      expect(stickOnly.pitchAxis).toBeCloseTo(stickOnly.yawAxis, 9);

      // 键盘同向：键盘的 1 更大
      pressKey('KeyD');
      expect(read(input).yawAxis).toBe(1);
      expect(read(input).pitchAxis, 'the other axis keeps the stick value').toBeCloseTo(
        stickOnly.pitchAxis,
        9
      );
      releaseKey('KeyD');

      // 键盘反向：键盘的 -1 幅度更大，盖过摇杆的小偏转
      pressKey('KeyA');
      expect(read(input).yawAxis).toBe(-1);
      releaseKey('KeyA');

      pressKey('KeyS');
      expect(read(input).pitchAxis).toBe(-1);
      expect(read(input).yawAxis).toBeCloseTo(stickOnly.yawAxis, 9);
      releaseKey('KeyS');

      expect(read(input)).toEqual(stickOnly);
    });

    it('keyboard pitch and stick yaw combine, one source per axis', () => {
      const input = touchInput();
      pressKey('KeyW');
      grabStick(1);
      pushStick(1, -0.7, 0);

      const state = read(input);
      expect(state.pitchAxis).toBe(1);
      expect(state.yawAxis).toBeCloseTo(-specShape(0.7), 6);
      expect(state.pitchUp).toBe(true);
      expect(state.yawLeft).toBe(true);
    });

    it('Q / E roll from a keyboard on a touch device', () => {
      const input = touchInput();
      pressKey('KeyQ');
      expect(read(input)).toMatchObject({ rollLeft: true, rollRight: false });
      releaseKey('KeyQ');
      pressKey('KeyE');
      expect(read(input)).toMatchObject({ rollLeft: false, rollRight: true });
    });

    describe('flightAssist', () => {
      it('is true while a finger holds the stick, deflected or centred', () => {
        const input = touchInput();
        expect(read(input).flightAssist).toBe(false);

        grabStick(1);
        expect(read(input).flightAssist, 'finger down, stick centred').toBe(true);
        pushStick(1, 0.8, -0.3);
        expect(read(input).flightAssist, 'deflected').toBe(true);
        pushStick(1, 0.02, 0.02);
        expect(read(input).flightAssist, 'back inside the dead zone').toBe(true);

        screen.up(1);
        expect(read(input).flightAssist, 'released').toBe(false);
      });

      it.each(STEERING_KEYS)(
        'is false while %s is held, and returns when it is released',
        (code) => {
          const input = touchInput();
          grabStick(1);
          pushStick(1, 0.8, 0);
          expect(read(input).flightAssist).toBe(true);

          pressKey(code);
          expect(read(input).flightAssist).toBe(false);

          releaseKey(code);
          expect(read(input).flightAssist).toBe(true);
        }
      );

      it.each(['Space', 'ShiftLeft', 'KeyF', 'KeyM', 'KeyV', 'KeyG'])(
        'stays true while the non-steering key %s is held',
        (code) => {
          const input = touchInput();
          grabStick(1);
          pushStick(1, 0, 0.8);

          pressKey(code);
          expect(read(input).flightAssist).toBe(true);
        }
      );

      it('is false for keyboard-only steering on a touch device', () => {
        const input = touchInput();
        pressKey('KeyW');
        pressKey('KeyD');
        expect(read(input)).toMatchObject({ flightAssist: false, pitchAxis: 1, yawAxis: 1 });
      });

      it('is not switched on by the buttons', () => {
        const input = touchInput();
        pressButton(1, 'fire-button');
        tapButton(2, 'throttle-button');
        expect(read(input).flightAssist).toBe(false);
      });

      it('is always false on desktop', () => {
        const input = desktopInput();
        expect(read(input).flightAssist).toBe(false);
        for (const code of ['KeyW', 'KeyA', 'KeyQ', 'Space']) {
          pressKey(code);
          expect(read(input).flightAssist, code).toBe(false);
        }
      });
    });

    it('touches do nothing on desktop', () => {
      const input = desktopInput();
      grabStick(1);
      pushStick(1, 1, 1);
      pressButton(2, 'fire-button');
      tapButton(3, 'throttle-button');
      pressButton(4, 'special-button');

      expectNeutral(readSettled(input));
      expect(elementById('throttle-button').classList.contains('is-active')).toBe(false);
    });
  });
});
