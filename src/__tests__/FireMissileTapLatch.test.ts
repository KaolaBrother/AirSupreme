import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '@/config';
import { InputHandler, type InputState } from '@/core/Input/InputHandler';
import {
  elementById,
  pressKey,
  releaseKey,
  RELEASE_TRIGGERS,
  seedShippedMobileControls,
  showPage,
  TouchScreen,
} from './touchTestUtils';

/**
 * 开火 / 导弹的轻触锁存（InputHandler，L1）：
 * 模拟每步只读一次输入，按下和松开都落在两次读取之间的轻触以前会丢。现在开火 / 导弹的每一次按下
 * 至少让一次 getState() 读到 true（哪怕松开先于读取）；按住期间每次读取都是 true；看到松开之后的
 * 下一次读取就是 false（轻触恰好一次 true，没有多出来的第二次）；读取之前就被 touchcancel 的触摸
 * 不算按过；resetActionQueue() 与失焦 / 切到后台会清掉还没读到的那一下；两次读取之间的两下算一下。
 *
 * 控件与按键映射（读自 InputHandler）：开火 = #fire-button、Space；导弹 = #missile-button、KeyM、
 * ShiftRight。左 Shift / 左 Ctrl 是加速（按住），不走这个锁存。
 * “一次读取”就是一次 getState()，对应一个模拟步。
 */

type Field = 'fire' | 'missile';
type Snapshot = Required<InputState>;

interface Control {
  /** 测试名里显示的名字 */
  label: string;
  /** 它驱动的 InputState 字段 */
  field: Field;
  device: 'touch' | 'desktop';
  kind: 'button' | 'key';
  /** 触控键的元素 id，或键盘按键的 code */
  id: string;
}

const BUTTON_CONTROLS: Control[] = [
  { label: '#fire-button', field: 'fire', device: 'touch', kind: 'button', id: 'fire-button' },
  {
    label: '#missile-button',
    field: 'missile',
    device: 'touch',
    kind: 'button',
    id: 'missile-button',
  },
];

const KEYS: Array<[string, string, Field]> = [
  ['Space', 'Space', 'fire'],
  ['M', 'KeyM', 'missile'],
  ['right Shift', 'ShiftRight', 'missile'],
];

const KEY_CONTROLS: Control[] = (['desktop', 'touch'] as const).flatMap((device) =>
  KEYS.map(([name, code, field]): Control => {
    const where = device === 'desktop' ? 'on desktop' : 'on a touch device';
    return { label: `${name} ${where}`, field, device, kind: 'key', id: code };
  })
);

const CONTROLS: Control[] = [...BUTTON_CONTROLS, ...KEY_CONTROLS];

const OTHER_FIELD: Record<Field, Field> = { fire: 'missile', missile: 'fire' };
const OTHER_BUTTON: Record<Field, string> = { fire: 'missile-button', missile: 'fire-button' };
/** 触控设备上同一件武器的按键与触控键 */
const KEY_AND_BUTTON: Array<[string, string, Field]> = [
  ['Space', 'fire-button', 'fire'],
  ['KeyM', 'missile-button', 'missile'],
  ['ShiftRight', 'missile-button', 'missile'],
];

/** InputHandler 认识、但与开火 / 导弹无关的按键 */
const UNRELATED_KEYS = [
  'ShiftLeft',
  'ControlLeft',
  'KeyF',
  'KeyG',
  'KeyV',
  'KeyX',
  'Tab',
  'Digit1',
  'Digit5',
  'Numpad3',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'Escape',
  'KeyP',
  'KeyU',
] as const;

const STEERING_AND_OTHER_FIELDS: Array<keyof Snapshot> = [
  'pitchUp',
  'pitchDown',
  'yawLeft',
  'yawRight',
  'rollLeft',
  'rollRight',
  'throttle',
  'special',
];

const BUTTON_POINT = { x: 930, y: 690 };
const STICK_ORIGIN = { x: 180, y: 600 };

describe('fire and missile tap latch (InputHandler)', () => {
  let handler: InputHandler | null = null;
  let screen: TouchScreen;
  let originalIsMobile: boolean;
  let nextFinger: number;
  /** 触控键 id → 正按着它的那根手指 */
  let fingerOn: Map<string, number>;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    seedShippedMobileControls();
    screen = new TouchScreen();
    nextFinger = 1;
    fingerOn = new Map();
  });

  afterEach(() => {
    handler?.dispose();
    handler = null;
    showPage();
    GameConfig.isMobile = originalIsMobile;
    document.body.innerHTML = '';
  });

  function openDevice(device: Control['device']): InputHandler {
    GameConfig.isMobile = device === 'touch';
    const created = new InputHandler();
    handler = created;
    return created;
  }

  function open(control: Control): InputHandler {
    return openDevice(control.device);
  }

  /** 新的一根手指按住触控键，返回它的 identifier */
  function touchDown(id: string): number {
    const finger = nextFinger++;
    screen.down(finger, elementById(id), BUTTON_POINT.x, BUTTON_POINT.y);
    return finger;
  }

  function tapButton(id: string): void {
    screen.up(touchDown(id));
  }

  function press(control: Control): void {
    if (control.kind === 'key') {
      pressKey(control.id);
      return;
    }
    fingerOn.set(control.id, touchDown(control.id));
  }

  function release(control: Control): void {
    if (control.kind === 'key') {
      releaseKey(control.id);
      return;
    }
    const finger = fingerOn.get(control.id);
    if (finger === undefined) {
      throw new Error(`#${control.id} is not pressed`);
    }
    fingerOn.delete(control.id);
    screen.up(finger);
  }

  /** 系统取消按着这个触控键的手指 */
  function cancel(control: Control): void {
    const finger = fingerOn.get(control.id);
    if (finger === undefined) {
      throw new Error(`#${control.id} is not pressed`);
    }
    fingerOn.delete(control.id);
    screen.cancel(finger);
  }

  function tap(control: Control): void {
    press(control);
    release(control);
  }

  /** 连续 count 次读取（count 个模拟步）里这个字段的值 */
  function reads(input: InputHandler, field: Field, count: number): boolean[] {
    const values: boolean[] = [];
    for (let i = 0; i < count; i++) {
      values.push(input.getState()[field]);
    }
    return values;
  }

  /** getState() 返回的是复用对象：断言前复制一份 */
  function snapshot(input: InputHandler): Snapshot {
    return { ...input.getState() };
  }

  // ───────────────────────────── 短于一步的轻触 ─────────────────────────────

  describe('a press shorter than one step', () => {
    it.each(CONTROLS)(
      '$label: press and release between two reads is seen on exactly one read',
      (control) => {
        const input = open(control);
        expect(reads(input, control.field, 2)).toEqual([false, false]);

        press(control);
        release(control);
        expect(reads(input, control.field, 4)).toEqual([true, false, false, false]);
      }
    );

    it.each(CONTROLS)('$label: every separate tap is seen once', (control) => {
      const input = open(control);
      for (let round = 0; round < 4; round++) {
        tap(control);
        expect(reads(input, control.field, 2), `tap ${round + 1}`).toEqual([true, false]);
      }
    });

    it.each(CONTROLS)('$label: two taps between two reads count as one', (control) => {
      const input = open(control);
      tap(control);
      tap(control);
      expect(reads(input, control.field, 3)).toEqual([true, false, false]);
    });

    it.each(CONTROLS)('$label: five taps between two reads still count as one', (control) => {
      const input = open(control);
      for (let i = 0; i < 5; i++) {
        tap(control);
      }
      expect(reads(input, control.field, 3)).toEqual([true, false, false]);
    });

    it.each(CONTROLS)('$label: a tap sets nothing but its own weapon', (control) => {
      const input = open(control);
      tap(control);

      const state = snapshot(input);
      expect(state[control.field]).toBe(true);
      expect(state[OTHER_FIELD[control.field]], OTHER_FIELD[control.field]).toBe(false);
      for (const field of STEERING_AND_OTHER_FIELDS) {
        expect(state[field], field).toBe(false);
      }
      expect(state.pitchAxis).toBe(0);
      expect(state.yawAxis).toBe(0);
      expect(state.flightAssist).toBe(false);
    });

    it.each(['desktop', 'touch'] as const)(
      'fire and missile tapped in the same gap are both seen once (keys, %s)',
      (device) => {
        const input = openDevice(device);
        pressKey('Space');
        pressKey('KeyM');
        releaseKey('KeyM');
        releaseKey('Space');

        expect(snapshot(input)).toMatchObject({ fire: true, missile: true });
        expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
      }
    );

    it('fire and missile tapped in the same gap are both seen once (buttons)', () => {
      const input = openDevice('touch');
      tapButton('fire-button');
      tapButton('missile-button');

      expect(snapshot(input)).toMatchObject({ fire: true, missile: true });
      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
    });

    it('only getState() uses up a pending tap', () => {
      const input = openDevice('touch');
      tapButton('fire-button');
      pressKey('KeyM');
      releaseKey('KeyM');

      input.consumeCameraToggle();
      input.consumeWeaponCycle();
      input.consumeWeaponSlot();
      input.consumeFlareDeploy();
      input.isPauseToggled();
      input.isUpgradeToggled();

      expect(snapshot(input)).toMatchObject({ fire: true, missile: true });
      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
    });

    it('taps on the other buttons and a finger on the stick leave a pending tap alone', () => {
      const input = openDevice('touch');
      tapButton('fire-button');
      tapButton('missile-button');

      for (const id of ['camera-button', 'cycle-button', 'flare-button', 'upgrade-button']) {
        tapButton(id);
      }
      // BOOST 点两下：开了又关
      tapButton('throttle-button');
      tapButton('throttle-button');
      const stickFinger = nextFinger++;
      screen.down(stickFinger, elementById('touch-stick-zone'), STICK_ORIGIN.x, STICK_ORIGIN.y);
      screen.move(stickFinger, STICK_ORIGIN.x + 40, STICK_ORIGIN.y);
      screen.up(stickFinger);

      expect(snapshot(input)).toMatchObject({ fire: true, missile: true, throttle: false });
      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
    });

    it('touch buttons do nothing on desktop', () => {
      const input = openDevice('desktop');
      tapButton('fire-button');
      tapButton('missile-button');
      const held = touchDown('fire-button');

      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
      screen.up(held);
      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
    });
  });

  // ───────────────────────────── 按住 ─────────────────────────────

  describe('a hold', () => {
    it.each(CONTROLS)(
      '$label: reads true on every read while held and false on the first read after release',
      (control) => {
        const input = open(control);
        for (const heldReads of [1, 2, 7]) {
          press(control);
          expect(reads(input, control.field, heldReads), `held for ${heldReads}`).toEqual(
            new Array<boolean>(heldReads).fill(true)
          );

          release(control);
          expect(reads(input, control.field, 3), `after ${heldReads}`).toEqual([
            false,
            false,
            false,
          ]);
        }
      }
    );

    it.each(CONTROLS)(
      '$label: a release followed by a tap in the same gap is seen as one more press',
      (control) => {
        const input = open(control);
        press(control);
        expect(reads(input, control.field, 2)).toEqual([true, true]);

        release(control);
        tap(control);
        expect(reads(input, control.field, 3)).toEqual([true, false, false]);
      }
    );

    it.each(CONTROLS)(
      '$label: released and pressed again in one gap stays true until the second release',
      (control) => {
        const input = open(control);
        press(control);
        expect(reads(input, control.field, 1)).toEqual([true]);

        release(control);
        press(control);
        expect(reads(input, control.field, 3)).toEqual([true, true, true]);

        release(control);
        expect(reads(input, control.field, 2)).toEqual([false, false]);
      }
    );

    it.each(CONTROLS)('$label: a hold sets nothing but its own weapon', (control) => {
      const input = open(control);
      press(control);
      for (let step = 0; step < 3; step++) {
        const state = snapshot(input);
        expect(state[control.field]).toBe(true);
        expect(state[OTHER_FIELD[control.field]], OTHER_FIELD[control.field]).toBe(false);
        for (const field of STEERING_AND_OTHER_FIELDS) {
          expect(state[field], field).toBe(false);
        }
      }
    });
  });

  // ───────────────────────────── 键盘 ─────────────────────────────

  describe('keys', () => {
    it.each(KEY_CONTROLS)(
      '$label: auto-repeat while held leaves no press behind after release',
      (control) => {
        const input = open(control);
        press(control);
        expect(reads(input, control.field, 1)).toEqual([true]);

        for (let i = 0; i < 3; i++) {
          pressKey(control.id, true);
        }
        expect(reads(input, control.field, 1)).toEqual([true]);

        pressKey(control.id, true);
        release(control);
        expect(reads(input, control.field, 3)).toEqual([false, false, false]);
      }
    );

    it.each(KEY_CONTROLS)(
      '$label: a tap that includes auto-repeat events is still one press',
      (control) => {
        const input = open(control);
        press(control);
        pressKey(control.id, true);
        pressKey(control.id, true);
        release(control);
        expect(reads(input, control.field, 3)).toEqual([true, false, false]);
      }
    );

    it.each(['desktop', 'touch'] as const)(
      'M and right Shift overlap: the missile stays held until both are up (%s)',
      (device) => {
        const input = openDevice(device);
        pressKey('KeyM');
        expect(reads(input, 'missile', 1)).toEqual([true]);

        pressKey('ShiftRight');
        releaseKey('KeyM');
        expect(reads(input, 'missile', 2)).toEqual([true, true]);

        releaseKey('ShiftRight');
        expect(reads(input, 'missile', 2)).toEqual([false, false]);
      }
    );

    it.each(['desktop', 'touch'] as const)(
      'a right Shift tap while M is held leaves nothing behind (%s)',
      (device) => {
        const input = openDevice(device);
        pressKey('KeyM');
        expect(reads(input, 'missile', 1)).toEqual([true]);

        pressKey('ShiftRight');
        releaseKey('ShiftRight');
        expect(reads(input, 'missile', 1)).toEqual([true]);

        releaseKey('KeyM');
        expect(reads(input, 'missile', 2)).toEqual([false, false]);
      }
    );

    describe.each(['desktop', 'touch'] as const)('other keys on %s', (device) => {
      it.each(UNRELATED_KEYS)('a %s tap is neither fire nor missile', (code) => {
        const input = openDevice(device);
        pressKey(code);
        releaseKey(code);
        expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
      });

      it.each(UNRELATED_KEYS)('%s held is neither fire nor missile', (code) => {
        const input = openDevice(device);
        pressKey(code);
        expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
        expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
      });
    });
  });

  // ───────────────────────────── 触控键 ─────────────────────────────

  describe('touch buttons', () => {
    it.each(BUTTON_CONTROLS)(
      '$label: a touch cancelled before any read is not a press',
      (control) => {
        const input = open(control);
        press(control);
        cancel(control);
        expect(reads(input, control.field, 3)).toEqual([false, false, false]);
      }
    );

    it.each(BUTTON_CONTROLS)(
      '$label: a hold that is cancelled reads false on the next read',
      (control) => {
        const input = open(control);
        press(control);
        expect(reads(input, control.field, 2)).toEqual([true, true]);

        cancel(control);
        expect(reads(input, control.field, 3)).toEqual([false, false, false]);
      }
    );

    it.each(BUTTON_CONTROLS)('$label: a tap after a cancelled touch is seen once', (control) => {
      const input = open(control);
      press(control);
      cancel(control);

      tap(control);
      expect(reads(input, control.field, 3)).toEqual([true, false, false]);
    });

    it.each(BUTTON_CONTROLS)(
      '$label: a touch cancelled on the other weapon button leaves this tap pending',
      (control) => {
        const input = open(control);
        tap(control);
        screen.cancel(touchDown(OTHER_BUTTON[control.field]));

        const state = snapshot(input);
        expect(state[control.field]).toBe(true);
        expect(state[OTHER_FIELD[control.field]]).toBe(false);
        expect(reads(input, control.field, 2)).toEqual([false, false]);
      }
    );

    it.each(BUTTON_CONTROLS)(
      '$label: a second finger tapping the held button is not a new press',
      (control) => {
        const input = open(control);
        press(control);
        expect(reads(input, control.field, 1)).toEqual([true]);

        tapButton(control.id);
        release(control);
        expect(reads(input, control.field, 3)).toEqual([false, false, false]);
      }
    );

    it.each(BUTTON_CONTROLS)(
      '$label: a second finger cancelled on the held button does not cancel the press',
      (control) => {
        const input = open(control);
        press(control);
        screen.cancel(touchDown(control.id));
        release(control);
        expect(reads(input, control.field, 3)).toEqual([true, false, false]);
      }
    );

    for (const control of BUTTON_CONTROLS) {
      // FINDING（L1 缺陷，实现未满足规格）：这个键上的 touchcancel 会把整个待读锁存清掉，于是同一步里
      // 更早、已经正常抬起的那一下也跟着丢了（读到 false, false, false）。按规格，那一下是一次完整的
      // 按下，应当让下一次读取为 true；被取消的只是后一次触摸。修好之后把 it.fails 改回 it。
      it.fails(
        `${control.label}: a tap completed before a later cancelled touch still counts`,
        () => {
          const input = open(control);
          tap(control);
          press(control);
          cancel(control);
          expect(reads(input, control.field, 3)).toEqual([true, false, false]);
        }
      );
    }

    for (const [code, buttonId, field] of KEY_AND_BUTTON) {
      // FINDING（同一个缺陷）：触控键上的 touchcancel 也清掉了键盘刚刚按出来、还没读到的那一下
      it.fails(`a ${code} tap followed by a cancelled touch on #${buttonId} still counts`, () => {
        const input = openDevice('touch');
        pressKey(code);
        releaseKey(code);
        screen.cancel(touchDown(buttonId));
        expect(reads(input, field, 3)).toEqual([true, false, false]);
      });
    }
  });

  // ───────────────────────────── 键盘与触控一起用 ─────────────────────────────

  describe.each(KEY_AND_BUTTON)('%s together with #%s', (code, buttonId, field) => {
    it('a button tap while the key is held leaves nothing behind', () => {
      const input = openDevice('touch');
      pressKey(code);
      expect(reads(input, field, 1)).toEqual([true]);

      tapButton(buttonId);
      expect(reads(input, field, 1)).toEqual([true]);

      releaseKey(code);
      expect(reads(input, field, 3)).toEqual([false, false, false]);
    });

    it('a key tap while the button is held leaves nothing behind', () => {
      const input = openDevice('touch');
      const finger = touchDown(buttonId);
      expect(reads(input, field, 1)).toEqual([true]);

      pressKey(code);
      releaseKey(code);
      expect(reads(input, field, 1)).toEqual([true]);

      screen.up(finger);
      expect(reads(input, field, 3)).toEqual([false, false, false]);
    });

    it('a button tap and the key release in the same gap are seen as one more press', () => {
      const input = openDevice('touch');
      pressKey(code);
      expect(reads(input, field, 1)).toEqual([true]);

      tapButton(buttonId);
      releaseKey(code);
      expect(reads(input, field, 3)).toEqual([true, false, false]);
    });

    it('a key tap and a button tap in the same gap count as one', () => {
      const input = openDevice('touch');
      pressKey(code);
      releaseKey(code);
      tapButton(buttonId);
      expect(reads(input, field, 3)).toEqual([true, false, false]);
    });
  });

  // ───────────────────────────── 复位 ─────────────────────────────

  describe('resetActionQueue()', () => {
    it.each(CONTROLS)('$label: drops a pending tap', (control) => {
      const input = open(control);
      tap(control);
      input.resetActionQueue();
      expect(reads(input, control.field, 3)).toEqual([false, false, false]);
    });

    it.each(CONTROLS)('$label: a tap after the reset is seen once', (control) => {
      const input = open(control);
      tap(control);
      input.resetActionQueue();

      tap(control);
      expect(reads(input, control.field, 3)).toEqual([true, false, false]);
    });

    it.each(CONTROLS)('$label: does not release a hold', (control) => {
      const input = open(control);
      press(control);
      input.resetActionQueue();
      expect(reads(input, control.field, 2)).toEqual([true, true]);

      input.resetActionQueue();
      expect(reads(input, control.field, 2)).toEqual([true, true]);

      release(control);
      expect(reads(input, control.field, 2)).toEqual([false, false]);
    });

    it.each(CONTROLS)(
      '$label: an unread press that is reset and then released is not replayed',
      (control) => {
        const input = open(control);
        press(control);
        input.resetActionQueue();
        release(control);
        expect(reads(input, control.field, 3)).toEqual([false, false, false]);
      }
    );

    it('drops both pending taps at once', () => {
      const input = openDevice('touch');
      tapButton('fire-button');
      pressKey('ShiftRight');
      releaseKey('ShiftRight');

      input.resetActionQueue();
      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
    });
  });

  describe.each(RELEASE_TRIGGERS)('%s', (_name, trigger) => {
    it.each(CONTROLS)('$label: drops a pending tap', (control) => {
      const input = open(control);
      tap(control);
      trigger();
      expect(reads(input, control.field, 3)).toEqual([false, false, false]);
    });

    it.each(CONTROLS)(
      '$label: drops an unread press, and its late release is not a press',
      (control) => {
        const input = open(control);
        press(control);
        trigger();
        expect(reads(input, control.field, 1)).toEqual([false]);

        // 松开事件在复位之后才到（按键 / 手指其实一直按着）
        release(control);
        expect(reads(input, control.field, 3)).toEqual([false, false, false]);
      }
    );

    it.each(CONTROLS)('$label: releases a hold, and its late release is not a press', (control) => {
      const input = open(control);
      press(control);
      expect(reads(input, control.field, 2)).toEqual([true, true]);

      trigger();
      release(control);
      expect(reads(input, control.field, 3)).toEqual([false, false, false]);
    });

    it.each(CONTROLS)('$label: a tap after the reset is seen once', (control) => {
      const input = open(control);
      tap(control);
      trigger();
      showPage();

      tap(control);
      expect(reads(input, control.field, 3)).toEqual([true, false, false]);
    });

    it('drops both pending taps at once', () => {
      const input = openDevice('touch');
      tapButton('missile-button');
      pressKey('Space');
      releaseKey('Space');

      trigger();
      expect(snapshot(input)).toMatchObject({ fire: false, missile: false });
    });
  });

  it.each(CONTROLS)(
    '$label: a visibilitychange while the page stays visible keeps a pending tap',
    (control) => {
      const input = open(control);
      tap(control);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(reads(input, control.field, 3)).toEqual([true, false, false]);
    }
  );
});
