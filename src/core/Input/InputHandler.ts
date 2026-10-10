import { GameConfig } from '@/config';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('InputHandler');

export interface InputState {
  pitchUp: boolean;
  pitchDown: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  fire: boolean;
  missile: boolean; // 导弹发射
  throttle: boolean;
  /** 特殊武器扳机（F 键 / 移动端特殊武器按钮）：按住持续照射 / 蓄力 */
  special: boolean;
  /**
   * 俯仰模拟量 -1..1（正 = 抬头）。键盘为 ±1，触控摇杆为“径向死区 + 指数曲线”后的连续值。
   * InputHandler.getState() 总会写入；类型上可选，是为了只写布尔方向的调用方（脚本飞行员、
   * 测试里的字面量）仍然可用——PlayerController 在缺省或为 0 时退回布尔方向（±1）。
   */
  pitchAxis?: number;
  /** 偏航模拟量 -1..1（正 = 右转），规则同 pitchAxis */
  yawAxis?: number;
  /**
   * 辅助飞行：转向来自触控摇杆（手指按在摇杆上，且键盘没有在转向）时为 true，
   * PlayerController 走“推右就相对地平线右转”的辅助模型；键盘转向（含平板外接键盘）为 false。
   */
  flightAssist?: boolean;
}

/** 触控摇杆手感参数 */
export const TOUCH_STICK_TUNING = {
  /** 径向死区（占行程的比例）：死区内输出 0 */
  DEAD_ZONE: 0.12,
  /** 响应曲线指数：小偏转更细腻，满偏转仍是满速 */
  EXPO: 1.7,
  /** 模拟量绝对值超过它才置位对应的布尔方向（约等于旧版 0.3 行程的阈值） */
  DIGITAL_THRESHOLD: 0.08,
  /** 量不到摇杆尺寸时（未布局 / 测试环境）使用的行程半径（px） */
  FALLBACK_RADIUS_PX: 54,
  /** 浮动底座与屏幕 / 安全区边缘的最小间距（px） */
  EDGE_MARGIN_PX: 6,
} as const;

/**
 * 摇杆响应曲线：输入是偏转幅度（0..1，占行程比例），输出 0..1。
 * 死区内为 0；死区边缘重新从 0 起算，再套指数曲线（满偏转 = 1）。
 */
export function shapeStickMagnitude(magnitude: number): number {
  if (!Number.isFinite(magnitude) || magnitude <= TOUCH_STICK_TUNING.DEAD_ZONE) {
    return 0;
  }
  const rescaled = Math.min(
    1,
    (magnitude - TOUCH_STICK_TUNING.DEAD_ZONE) / (1 - TOUCH_STICK_TUNING.DEAD_ZONE)
  );
  return Math.pow(rescaled, TOUCH_STICK_TUNING.EXPO);
}

/** 数字键 → 特殊武器槽位（0 基，对应 SPECIAL_WEAPON_IDS 顺序） */
const WEAPON_SLOT_KEYS: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
};

const KNOB_REST_TRANSFORM = 'translate(-50%, -50%) translate(0px, 0px)';

/** 事件上的触摸点列表；合成事件（测试）里可能缺失或是普通数组 */
type TouchListLike = ArrayLike<Touch> | null | undefined;

function findTouch(list: TouchListLike, identifier: number): Touch | null {
  if (!list) {
    return null;
  }
  for (let i = 0; i < list.length; i++) {
    if (list[i].identifier === identifier) {
      return list[i];
    }
  }
  return null;
}

function hasTouches(list: TouchListLike): list is ArrayLike<Touch> {
  return list != null && list.length > 0;
}

function touchIdentifier(touch: Touch | null): number | null {
  return touch && typeof touch.identifier === 'number' ? touch.identifier : null;
}

/** 本次事件里落在监听元素上的那个触摸点；合成事件的触摸点没有 target 时取第一个 */
function pickChangedTouch(event: TouchEvent): Touch | null {
  const changed: TouchListLike = event.changedTouches;
  if (!hasTouches(changed)) {
    return null;
  }
  const host = event.currentTarget;
  if (host instanceof Node) {
    for (let i = 0; i < changed.length; i++) {
      const target = changed[i].target;
      if (target instanceof Node && host.contains(target)) {
        return changed[i];
      }
    }
  }
  return changed[0];
}

/**
 * 记录的那根手指是否确定已经离开屏幕：事件列出了当前所有触摸点，而它不在其中。
 * （touchend / touchcancel 丢失时的兜底；列表缺失或为空时无法判断，按“仍按着”处理。）
 */
function isTouchGone(event: TouchEvent, identifier: number): boolean {
  const touches: TouchListLike = event.touches;
  return hasTouches(touches) && findTouch(touches, identifier) === null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parsePixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 焦点在表单控件上时不拦截 Tab（菜单仍可用键盘切换焦点） */
function isFormControlFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON';
}

/**
 * 输入处理器
 * 支持桌面键盘和移动端触摸控制（触控设备上两者合并，外接键盘同样可用）
 */
export class InputHandler {
  private keys: Set<string> = new Set();
  private readonly listenerCleanups: Array<() => void> = [];

  // 触摸摇杆：浮动式——手指落在摇杆区任意位置即为原点，之后一直跟踪这根手指直到抬起
  private joystickActive: boolean = false;
  private joystickTouchId: number | null = null; // 记录摇杆触摸点的标识符
  private stickOriginX: number = 0;
  private stickOriginY: number = 0;
  /** 行程半径（px）：底座直径的一半，按下时测量 */
  private stickRadius: number = TOUCH_STICK_TUNING.FALLBACK_RADIUS_PX;
  /** 摇杆输出（死区 + 曲线之后）：正 = 抬头 / 右转 */
  private stickPitchAxis: number = 0;
  private stickYawAxis: number = 0;
  private stickBase: HTMLElement | null = null;
  private stickKnob: HTMLElement | null = null;
  private stickZone: HTMLElement | null = null;

  // 触摸按键
  private firePressed: boolean = false;
  private missilePressed: boolean = false;
  private specialPressed: boolean = false;
  /** 触控加速键是开关：点一下开加力，再点一下关（state.throttle 仍是布尔） */
  private boostLatched: boolean = false;
  private throttleButton: HTMLElement | null = null;
  /** 每个触摸按键的“强制松开”，失焦 / 切到后台 / dispose 时统一调用 */
  private readonly buttonReleasers: Array<() => void> = [];

  private upgradePressed: boolean = false;
  /** 桌面 Esc / P 的按住状态（isPauseToggled 取按下沿） */
  private pausePressed: boolean = false;
  private previousPauseState: boolean = false;
  /** 移动端暂停键的单击锁存：touchstart 置位，游戏消费一次后清除（帧率再低也不丢） */
  private pauseTapQueued: boolean = false;
  private previousUpgradeState: boolean = false;

  // 单次触发的按键（按下沿锁存，update 中消费，帧率再低也不会丢）
  private cameraToggleQueued: boolean = false;
  private weaponCycleQueued: boolean = false;
  private weaponSlotQueued: number = -1;
  private flareQueued: boolean = false;
  /** F / 特殊武器按钮的按下沿：低帧率下即使按键短于一帧，下一次模拟步也能看到一次扣扳机 */
  private specialTapQueued: boolean = false;
  /**
   * 开火 / 导弹的按下沿（Space、M / 右 Shift、触控键）：从按下到松开都落在两个模拟步之间的轻触，
   * 下一步仍读到一次“按住”，再下一步读到松开。getState 每步都把它读掉（按住期间不留到松开之后）。
   */
  private fireTapQueued: boolean = false;
  private missileTapQueued: boolean = false;

  /** getState() 复用的结果对象（每个模拟步调用一次，避免逐帧分配） */
  private readonly state: Required<InputState> = {
    pitchUp: false,
    pitchDown: false,
    yawLeft: false,
    yawRight: false,
    rollLeft: false,
    rollRight: false,
    fire: false,
    missile: false,
    throttle: false,
    special: false,
    pitchAxis: 0,
    yawAxis: 0,
    flightAssist: false,
  };

  private isMobile: boolean;

  constructor() {
    this.isMobile = GameConfig.isMobile;
    this.syncMobileControlsVisibility();
    this.setupListeners();
  }

  /**
   * 移动端控件显隐跟随 GameConfig.isMobile，不走 pointer:coarse CSS。
   */
  private syncMobileControlsVisibility(): void {
    const controls = document.getElementById('mobile-controls');
    if (!controls) {
      return;
    }

    const visible = this.isMobile;
    controls.classList.toggle('is-visible', visible);
    controls.classList.toggle('hidden', !visible);
    controls.style.display = visible ? 'flex' : 'none';
  }

  /**
   * 设置事件监听器
   */
  private setupListeners(): void {
    this.addTrackedListener(window, 'keydown', this.handleKeyDown);
    this.addTrackedListener(window, 'keyup', this.handleKeyUp);
    // 失焦 / 切到后台时收不到 keyup、touchend：松开所有按住的输入，避免卡键
    this.addTrackedListener(window, 'blur', this.handleWindowBlur);
    this.addTrackedListener(document, 'visibilitychange', this.handleVisibilityChange);

    if (this.isMobile) {
      this.setupTouchControls();
    }
  }

  private readonly handleKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const code = keyboardEvent.code;
    this.keys.add(code);
    if (code === 'Escape' || code === 'KeyP') {
      this.pausePressed = true;
    }
    if (code === 'KeyU') {
      this.upgradePressed = true;
    }
    if (code === 'Tab' && !isFormControlFocused()) {
      // Tab 用于切换特殊武器，不让浏览器移动焦点
      keyboardEvent.preventDefault();
    }
    if (keyboardEvent.repeat) {
      return;
    }
    if (code === 'KeyV') {
      this.cameraToggleQueued = true;
    } else if (code === 'Tab' || code === 'KeyX') {
      this.weaponCycleQueued = true;
    } else if (code === 'KeyG') {
      this.flareQueued = true;
    } else if (code in WEAPON_SLOT_KEYS) {
      this.weaponSlotQueued = WEAPON_SLOT_KEYS[code];
    } else if (code === 'KeyF') {
      this.specialTapQueued = true;
    } else if (code === 'Space') {
      this.fireTapQueued = true;
    } else if (code === 'KeyM' || code === 'ShiftRight') {
      this.missileTapQueued = true;
    }
  };

  private readonly handleKeyUp = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    this.keys.delete(keyboardEvent.code);
    if (keyboardEvent.code === 'Escape' || keyboardEvent.code === 'KeyP') {
      this.pausePressed = false;
    }
    if (keyboardEvent.code === 'KeyU') {
      this.upgradePressed = false;
    }
  };

  private readonly handleWindowBlur = (): void => {
    this.releaseHeldInputs();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden' || document.hidden) {
      this.releaseHeldInputs();
    }
  };

  /**
   * 设置移动端触摸控制
   */
  private setupTouchControls(): void {
    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystick-knob');
    const fireButton = document.getElementById('fire-button');
    const throttleButton = document.getElementById('throttle-button');
    const missileButton = document.getElementById('missile-button');
    const upgradeButton = document.getElementById('upgrade-button');

    if (!joystick || !joystickKnob) {
      log.warn('Joystick elements not found');
      return;
    }

    this.stickBase = joystick;
    this.stickKnob = joystickKnob;
    // 摇杆区：左下方的透明元素，手指落在其中任意位置都能抓住摇杆；页面里没有它时只认摇杆本身
    this.stickZone = document.getElementById('touch-stick-zone');

    const handlePreventMobileScroll = (e: TouchEvent): void => {
      if (e.target instanceof Element && e.target.closest('.mobile-controls')) {
        e.preventDefault();
      }
    };

    if (this.stickZone) {
      this.addTrackedListener(this.stickZone, 'touchstart', this.handleStickStart, {
        passive: false,
      });
    }
    this.addTrackedListener(joystick, 'touchstart', this.handleStickStart, { passive: false });
    // 移动 / 结束在文档级别监听：手指移出摇杆区后仍然跟踪
    this.addTrackedListener(document, 'touchmove', this.handleStickMove, { passive: false });
    this.addTrackedListener(document, 'touchend', this.handleStickEnd);
    this.addTrackedListener(document, 'touchcancel', this.handleStickEnd);

    // 开火 / 导弹：按住；按下沿另外锁存，短于一个模拟步的轻触也不丢。
    // 被系统取消（touchcancel / 失焦）的那一下不算按过
    this.bindTouchButton(
      fireButton,
      () => {
        this.firePressed = true;
        this.fireTapQueued = true;
      },
      (cancelled) => {
        this.firePressed = false;
        if (cancelled) {
          this.fireTapQueued = false;
        }
      }
    );
    this.bindTouchButton(
      missileButton,
      () => {
        this.missilePressed = true;
        this.missileTapQueued = true;
      },
      (cancelled) => {
        this.missilePressed = false;
        if (cancelled) {
          this.missileTapQueued = false;
        }
      }
    );

    // 加速：开关（点一下开，再点一下关），不用和开火抢同一根拇指
    this.throttleButton = throttleButton;
    this.setBoostLatched(false);
    this.bindTouchButton(throttleButton, () => {
      this.setBoostLatched(!this.boostLatched);
    });

    // 移动端「升级」舱门打开暂停菜单，而非直接进入商店；单击锁存，短于一帧的轻触也不丢
    this.bindTouchButton(upgradeButton, () => {
      this.pauseTapQueued = true;
    });

    // 新增按钮（index.html 中存在时才绑定）：视角切换 / 特殊武器（按住）/ 切换武器 / 热焰弹
    const cameraButton = document.getElementById('camera-button');
    const specialButton = document.getElementById('special-button');
    const cycleButton = document.getElementById('cycle-button');
    const flareButton = document.getElementById('flare-button');
    this.bindTouchButton(cameraButton, () => {
      this.cameraToggleQueued = true;
    });
    this.bindTouchButton(cycleButton, () => {
      this.weaponCycleQueued = true;
    });
    this.bindTouchButton(flareButton, () => {
      this.flareQueued = true;
    });
    this.bindTouchButton(
      specialButton,
      () => {
        this.specialPressed = true;
        this.specialTapQueued = true;
      },
      () => {
        this.specialPressed = false;
      }
    );

    // 防止页面滚动
    this.addTrackedListener(document, 'touchmove', handlePreventMobileScroll, { passive: false });
  }

  /** 摇杆区 / 摇杆上的 touchstart：以落点为原点抓住摇杆 */
  private readonly handleStickStart = (e: TouchEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (
      this.joystickActive &&
      this.joystickTouchId !== null &&
      !isTouchGone(e, this.joystickTouchId)
    ) {
      // 摇杆已被另一根手指占用：第二根手指不抢
      return;
    }

    const touch = pickChangedTouch(e);
    if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) {
      // 没有落点坐标就定不了原点
      return;
    }
    this.beginStick(touch);
  };

  private beginStick(touch: Touch): void {
    const base = this.stickBase;
    const knob = this.stickKnob;
    if (!base || !knob) {
      return;
    }

    this.joystickTouchId = touchIdentifier(touch) ?? 0;
    this.joystickActive = true;
    this.stickOriginX = touch.clientX;
    this.stickOriginY = touch.clientY;
    this.stickPitchAxis = 0;
    this.stickYawAxis = 0;

    // 先撤掉位移再测量，得到底座的静止位置（.is-active 下没有过渡，立即生效）
    base.classList.add('is-active');
    base.style.transform = 'none';
    const rect = base.getBoundingClientRect();
    const measured = rect.width > 0 && rect.height > 0;
    const radius = measured ? rect.width / 2 : TOUCH_STICK_TUNING.FALLBACK_RADIUS_PX;
    this.stickRadius = radius;

    if (measured) {
      // 底座移到落点，但整个底座留在屏幕和安全区之内（原点仍是手指落点）
      const insets = this.readSafeAreaInsets();
      const margin = TOUCH_STICK_TUNING.EDGE_MARGIN_PX;
      const minX = insets.left + margin + radius;
      const maxX = Math.max(minX, window.innerWidth - insets.right - margin - radius);
      const minY = insets.top + margin + radius;
      const maxY = Math.max(minY, window.innerHeight - insets.bottom - margin - radius);
      const centerX = clamp(touch.clientX, minX, maxX);
      const centerY = clamp(touch.clientY, minY, maxY);
      const offsetX = centerX - (rect.left + rect.width / 2);
      const offsetY = centerY - (rect.top + rect.height / 2);
      base.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
    knob.style.transform = KNOB_REST_TRANSFORM;
  }

  /**
   * 安全区内边距（px）。JS 读不到 env()，index.html 把它写成摇杆区元素的 padding，这里读计算值。
   */
  private readSafeAreaInsets(): { top: number; right: number; bottom: number; left: number } {
    const zone = this.stickZone;
    if (!zone) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    const style = window.getComputedStyle(zone);
    return {
      top: parsePixels(style.paddingTop),
      right: parsePixels(style.paddingRight),
      bottom: parsePixels(style.paddingBottom),
      left: parsePixels(style.paddingLeft),
    };
  }

  private readonly handleStickMove = (e: TouchEvent): void => {
    if (!this.joystickActive || this.joystickTouchId === null) return;

    e.preventDefault();

    // 找到匹配标识符的触摸点；它移到哪里都继续跟踪，超出行程只做限幅
    const touch =
      findTouch(e.changedTouches, this.joystickTouchId) ??
      findTouch(e.touches, this.joystickTouchId);
    if (!touch) return;

    let deltaX = touch.clientX - this.stickOriginX;
    let deltaY = touch.clientY - this.stickOriginY;
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;

    // 限制在圆形行程内
    const radius = this.stickRadius;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > radius) {
      deltaX = (deltaX / distance) * radius;
      deltaY = (deltaY / distance) * radius;
    }

    // 更新摇杆位置（保留CSS中的居中偏移）
    if (this.stickKnob) {
      this.stickKnob.style.transform = `translate(-50%, -50%) translate(${deltaX}px, ${deltaY}px)`;
    }

    this.setStickDeflection(deltaX / radius, deltaY / radius);
  };

  /** 原始偏转（-1..1，屏幕坐标：x 右正、y 下正）→ 径向死区 + 指数曲线后的俯仰 / 偏航模拟量 */
  private setStickDeflection(rawX: number, rawY: number): void {
    const magnitude = Math.min(1, Math.hypot(rawX, rawY));
    const shaped = shapeStickMagnitude(magnitude);
    if (shaped <= 0 || magnitude <= 0) {
      this.stickPitchAxis = 0;
      this.stickYawAxis = 0;
      return;
    }
    const scale = shaped / magnitude;
    this.stickYawAxis = clamp(rawX * scale, -1, 1);
    // 屏幕 y 向下：摇杆上推 = 抬头
    this.stickPitchAxis = clamp(-rawY * scale, -1, 1);
  }

  private readonly handleStickEnd = (e: TouchEvent): void => {
    if (this.joystickTouchId === null) return;

    const changed: TouchListLike = e.changedTouches;
    if (hasTouches(changed)) {
      // 只有抓着摇杆的那根手指抬起 / 被系统取消才松开
      if (findTouch(changed, this.joystickTouchId)) {
        this.endStick();
      }
      return;
    }

    // 没带触摸点的合成事件：发在摇杆 / 摇杆区上才算松开摇杆
    const target = e.target;
    if (
      target instanceof Node &&
      (this.stickBase?.contains(target) || this.stickZone?.contains(target))
    ) {
      this.endStick();
    }
  };

  /** 松开摇杆：输出归零，底座缓动回静止位置（过渡写在 index.html 的 CSS 里） */
  private endStick(): void {
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.stickPitchAxis = 0;
    this.stickYawAxis = 0;
    if (this.stickBase) {
      this.stickBase.classList.remove('is-active');
      this.stickBase.style.transform = '';
    }
    if (this.stickKnob) {
      this.stickKnob.style.transform = KNOB_REST_TRANSFORM;
    }
  }

  /**
   * 触摸按键：记住按下它的那根手指，只有这根手指抬起 / 被系统取消（touchcancel）才松开；
   * 按住期间第二根手指落在同一个键上不算数。单击类按键只传 onPress。
   * onRelease 的参数：这次松开是不是被取消的（touchcancel / 失焦 / 切到后台 / 销毁），而非手指抬起。
   */
  private bindTouchButton(
    button: HTMLElement | null,
    onPress: () => void,
    onRelease?: (cancelled: boolean) => void
  ): void {
    if (!button) {
      return;
    }

    let pressed = false;
    let touchId: number | null = null;

    const release = (cancelled: boolean): void => {
      if (!pressed) return;
      pressed = false;
      touchId = null;
      button.classList.remove('is-pressed');
      onRelease?.(cancelled);
    };

    const handleStart = (e: TouchEvent): void => {
      e.preventDefault();
      if (pressed && touchId !== null && !isTouchGone(e, touchId)) {
        return;
      }
      touchId = touchIdentifier(pickChangedTouch(e));
      pressed = true;
      button.classList.add('is-pressed');
      onPress();
    };

    const handleEnd = (e: TouchEvent): void => {
      if (!pressed) return;
      const changed: TouchListLike = e.changedTouches;
      if (touchId !== null && hasTouches(changed) && !findTouch(changed, touchId)) {
        // 抬起的不是按下它的那根手指
        return;
      }
      release(e.type === 'touchcancel');
    };

    this.addTrackedListener(button, 'touchstart', handleStart, { passive: false });
    this.addTrackedListener(button, 'touchend', handleEnd);
    this.addTrackedListener(button, 'touchcancel', handleEnd);
    this.buttonReleasers.push(() => release(true));
  }

  private setBoostLatched(latched: boolean): void {
    this.boostLatched = latched;
    const button = this.throttleButton;
    if (button) {
      button.classList.toggle('is-active', latched);
      button.setAttribute('aria-pressed', latched ? 'true' : 'false');
    }
  }

  /** 松开所有“按住”的输入：键盘按键、摇杆、触摸按键、加速开关（窗口失焦 / 切到后台 / 销毁） */
  private releaseHeldInputs(): void {
    this.keys.clear();
    this.pausePressed = false;
    this.upgradePressed = false;
    this.endStick();
    for (const release of this.buttonReleasers) {
      release();
    }
    this.firePressed = false;
    this.missilePressed = false;
    this.specialPressed = false;
    this.fireTapQueued = false;
    this.missileTapQueued = false;
    this.setBoostLatched(false);
  }

  private addTrackedListener<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    const wrapped = listener as EventListener;
    target.addEventListener(type, wrapped, options);
    this.listenerCleanups.push(() => {
      target.removeEventListener(type, wrapped, options);
    });
  }

  /**
   * 移除窗口与触摸监听，避免重开一局时叠加 handler
   */
  public dispose(): void {
    for (const cleanup of this.listenerCleanups) {
      cleanup();
    }
    this.listenerCleanups.length = 0;
    // 页面里的摇杆 / 按键元素会被下一局复用：连同样式状态一起复位
    this.releaseHeldInputs();
    this.buttonReleasers.length = 0;
    this.resetActionQueue();
    this.resetPauseState();
    this.resetUpgradeState();
  }

  /**
   * 获取当前输入状态。
   * 返回的是复用对象：每次调用都会覆盖上一次的结果，调用方只在当帧读取；需要跨帧保留请自行复制。
   */
  public getState(): Required<InputState> {
    const keys = this.keys;
    const state = this.state;

    // 键盘：桌面端的全部输入
    const keyPitchUp = keys.has('KeyW') || keys.has('ArrowUp');
    const keyPitchDown = keys.has('KeyS') || keys.has('ArrowDown');
    const keyYawLeft = keys.has('KeyA');
    const keyYawRight = keys.has('KeyD');
    const keyRollLeft = keys.has('KeyQ');
    const keyRollRight = keys.has('KeyE');
    state.pitchUp = keyPitchUp;
    state.pitchDown = keyPitchDown;
    state.yawLeft = keyYawLeft;
    state.yawRight = keyYawRight;
    state.rollLeft = keyRollLeft;
    state.rollRight = keyRollRight;
    // 开火 / 导弹 = 按住，或上一次采样之后有过一次按下（读取即清除）
    const fireTap = this.fireTapQueued;
    const missileTap = this.missileTapQueued;
    this.fireTapQueued = false;
    this.missileTapQueued = false;
    state.fire = keys.has('Space') || fireTap;
    state.missile = keys.has('KeyM') || keys.has('ShiftRight') || missileTap; // M键或右Shift发射导弹
    state.throttle = keys.has('ShiftLeft') || keys.has('ControlLeft');
    state.pitchAxis = (keyPitchUp ? 1 : 0) - (keyPitchDown ? 1 : 0);
    state.yawAxis = (keyYawRight ? 1 : 0) - (keyYawLeft ? 1 : 0);
    state.flightAssist = false;
    let specialHeld = keys.has('KeyF');

    if (this.isMobile) {
      // 触控设备：键盘与触控合并。按键取“或”；摇杆与键盘的模拟量取绝对值较大的一方
      if (Math.abs(this.stickPitchAxis) > Math.abs(state.pitchAxis)) {
        state.pitchAxis = this.stickPitchAxis;
      }
      if (Math.abs(this.stickYawAxis) > Math.abs(state.yawAxis)) {
        state.yawAxis = this.stickYawAxis;
      }
      // 布尔方向由模拟量推导（教程 / 脚本等仍读布尔）
      const threshold = TOUCH_STICK_TUNING.DIGITAL_THRESHOLD;
      state.pitchUp = keyPitchUp || state.pitchAxis > threshold;
      state.pitchDown = keyPitchDown || state.pitchAxis < -threshold;
      state.yawLeft = keyYawLeft || state.yawAxis < -threshold;
      state.yawRight = keyYawRight || state.yawAxis > threshold;
      state.fire = state.fire || this.firePressed;
      state.missile = state.missile || this.missilePressed;
      state.throttle = state.throttle || this.boostLatched;
      specialHeld = specialHeld || this.specialPressed;
      // 手指按在摇杆上、且键盘没有在转向：辅助飞行
      const keyboardSteering =
        keyPitchUp || keyPitchDown || keyYawLeft || keyYawRight || keyRollLeft || keyRollRight;
      state.flightAssist = this.joystickActive && !keyboardSteering;
    }

    state.special = specialHeld || this.takeSpecialTap();
    return state;
  }

  /** V / 视角按钮：本帧是否请求切换第一 / 第三人称（读取即清除） */
  public consumeCameraToggle(): boolean {
    const queued = this.cameraToggleQueued;
    this.cameraToggleQueued = false;
    return queued;
  }

  /** Tab / X / 切换按钮：是否请求切换到下一件特殊武器（读取即清除） */
  public consumeWeaponCycle(): boolean {
    const queued = this.weaponCycleQueued;
    this.weaponCycleQueued = false;
    return queued;
  }

  /** 1-5：请求选择的武器槽位（0 基）；无请求返回 -1（读取即清除） */
  public consumeWeaponSlot(): number {
    const slot = this.weaponSlotQueued;
    this.weaponSlotQueued = -1;
    return slot;
  }

  /** G / 热焰弹按钮：是否请求投放热焰弹（读取即清除） */
  public consumeFlareDeploy(): boolean {
    const queued = this.flareQueued;
    this.flareQueued = false;
    return queued;
  }

  /** 读取并清除 F 的按下沿（getState 每个模拟步调用一次） */
  private takeSpecialTap(): boolean {
    const queued = this.specialTapQueued;
    this.specialTapQueued = false;
    return queued;
  }

  /**
   * 清空所有单次动作（暂停 / 剧情卡片 / 换关时调用，避免恢复后误触发）。
   * 触控加速开关也在这里关掉：这些时刻玩家看不到按键，恢复后不应还悄悄开着加力。
   */
  public resetActionQueue(): void {
    this.cameraToggleQueued = false;
    this.weaponCycleQueued = false;
    this.weaponSlotQueued = -1;
    this.flareQueued = false;
    this.specialTapQueued = false;
    this.fireTapQueued = false;
    this.missileTapQueued = false;
    if (this.boostLatched) {
      this.setBoostLatched(false);
    }
  }

  /** 本步是否切换暂停：Esc / P 的按下沿，或一次排队中的移动端暂停键单击（读取即清除） */
  public isPauseToggled(): boolean {
    const keyEdge = this.pausePressed && !this.previousPauseState;
    this.previousPauseState = this.pausePressed;
    const tapped = this.pauseTapQueued;
    this.pauseTapQueued = false;
    return keyEdge || tapped;
  }

  public resetPauseState(): void {
    this.pausePressed = false;
    this.previousPauseState = false;
    this.pauseTapQueued = false;
  }

  public isUpgradeToggled(): boolean {
    const toggled = this.upgradePressed && !this.previousUpgradeState;
    this.previousUpgradeState = this.upgradePressed;
    return toggled;
  }

  public resetUpgradeState(): void {
    this.upgradePressed = false;
    this.previousUpgradeState = false;
  }
}
