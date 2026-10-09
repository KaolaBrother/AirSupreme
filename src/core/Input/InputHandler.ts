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
 * 支持桌面键盘和移动端触摸控制
 */
export class InputHandler {
  private keys: Set<string> = new Set();
  private readonly listenerCleanups: Array<() => void> = [];

  // 触摸控制状态
  private joystickActive: boolean = false;
  private joystickX: number = 0;
  private joystickY: number = 0;
  private joystickTouchId: number | null = null; // 记录摇杆触摸点的标识符
  private firePressed: boolean = false;
  private throttlePressed: boolean = false;
  private missilePressed: boolean = false;
  private upgradePressed: boolean = false;
  /** 桌面 Esc / P 的按住状态（isPauseToggled 取按下沿） */
  private pausePressed: boolean = false;
  private previousPauseState: boolean = false;
  /** 移动端暂停键的单击锁存：touchstart 置位，游戏消费一次后清除（帧率再低也不丢） */
  private pauseTapQueued: boolean = false;
  private previousUpgradeState: boolean = false;
  private specialPressed: boolean = false;

  // 单次触发的按键（按下沿锁存，update 中消费，帧率再低也不会丢）
  private cameraToggleQueued: boolean = false;
  private weaponCycleQueued: boolean = false;
  private weaponSlotQueued: number = -1;
  private flareQueued: boolean = false;
  /** F / 特殊武器按钮的按下沿：低帧率下即使按键短于一帧，下一次模拟步也能看到一次扣扳机 */
  private specialTapQueued: boolean = false;

  /** getState() 复用的结果对象（每个模拟步调用一次，避免逐帧分配） */
  private readonly state: InputState = {
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

    const handleJoystickTouchStart = (e: TouchEvent): void => {
      e.preventDefault();
      e.stopPropagation();

      // 获取刚刚触摸的点（使用 changedTouches）
      if (e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];

      // 检查触摸点是否在摇杆元素范围内
      const rect = joystick.getBoundingClientRect();
      const isInBounds =
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom;

      if (isInBounds) {
        // 在范围内，记录触摸点并激活
        this.joystickTouchId = touch.identifier;
        this.joystickActive = true;
      }
    };

    // 触摸移动 - 在文档级别监听，防止触摸移出元素后丢失
    const handleTouchMove = (e: TouchEvent): void => {
      if (!this.joystickActive || this.joystickTouchId === null) return;

      e.preventDefault();

      // 找到匹配标识符的触摸点
      const touch = Array.from(e.touches).find((t) => t.identifier === this.joystickTouchId);
      if (!touch) return;

      // 检查触摸点是否还在摇杆范围内
      const rect = joystick.getBoundingClientRect();
      const isInBounds =
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom;

      if (!isInBounds) {
        // 触摸点移出范围，停用摇杆
        this.joystickActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        this.joystickTouchId = null;
        joystickKnob.style.transform = 'translate(-50%, -50%) translate(0px, 0px)';
        return;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const joystickRadius = rect.width / 2;

      let deltaX = touch.clientX - centerX;
      let deltaY = touch.clientY - centerY;

      // 限制在圆形范围内
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > joystickRadius) {
        deltaX = (deltaX / distance) * joystickRadius;
        deltaY = (deltaY / distance) * joystickRadius;
      }

      // 更新摇杆位置（保留CSS中的居中偏移）
      joystickKnob.style.transform = `translate(-50%, -50%) translate(${deltaX}px, ${deltaY}px)`;

      // 转换为 -1 到 1 的范围
      this.joystickX = deltaX / joystickRadius;
      this.joystickY = deltaY / joystickRadius;
    };

    // 触摸结束 - 在文档级别监听
    const handleTouchEnd = (e: TouchEvent): void => {
      if (this.joystickTouchId === null) return;

      // 检查我们的触摸点是否在已释放的触摸点中
      const ourTouchEnded = Array.from(e.changedTouches).some(
        (t) => t.identifier === this.joystickTouchId
      );

      if (ourTouchEnded) {
        // 我们的触摸点已释放
        this.joystickActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        this.joystickTouchId = null;
        joystickKnob.style.transform = 'translate(-50%, -50%) translate(0px, 0px)';
      }
    };

    const handlePreventMobileScroll = (e: TouchEvent): void => {
      if (e.target instanceof Element && e.target.closest('.mobile-controls')) {
        e.preventDefault();
      }
    };

    this.addTrackedListener(joystick, 'touchstart', handleJoystickTouchStart, { passive: false });
    this.addTrackedListener(document, 'touchmove', handleTouchMove, { passive: false });
    this.addTrackedListener(document, 'touchend', handleTouchEnd);
    this.addTrackedListener(document, 'touchcancel', handleTouchEnd);

    // 开火按钮
    if (fireButton) {
      const handleFireStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.firePressed = true;
      };
      const handleFireEnd = (): void => {
        this.firePressed = false;
      };
      this.addTrackedListener(fireButton, 'touchstart', handleFireStart, { passive: false });
      this.addTrackedListener(fireButton, 'touchend', handleFireEnd);
    }

    // 加速按钮
    if (throttleButton) {
      const handleThrottleStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.throttlePressed = true;
      };
      const handleThrottleEnd = (): void => {
        this.throttlePressed = false;
      };
      this.addTrackedListener(throttleButton, 'touchstart', handleThrottleStart, {
        passive: false,
      });
      this.addTrackedListener(throttleButton, 'touchend', handleThrottleEnd);
    }

    // 导弹按钮
    if (missileButton) {
      const handleMissileStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.missilePressed = true;
      };
      const handleMissileEnd = (): void => {
        this.missilePressed = false;
      };
      this.addTrackedListener(missileButton, 'touchstart', handleMissileStart, { passive: false });
      this.addTrackedListener(missileButton, 'touchend', handleMissileEnd);
    }

    // 移动端「升级」舱门打开暂停菜单，而非直接进入商店；单击锁存，短于一帧的轻触也不丢
    this.bindTapButton(upgradeButton, () => {
      this.pauseTapQueued = true;
    });

    // 新增按钮（index.html 中存在时才绑定）：视角切换 / 特殊武器（按住）/ 切换武器 / 热焰弹
    const cameraButton = document.getElementById('camera-button');
    const specialButton = document.getElementById('special-button');
    const cycleButton = document.getElementById('cycle-button');
    const flareButton = document.getElementById('flare-button');
    this.bindTapButton(cameraButton, () => {
      this.cameraToggleQueued = true;
    });
    this.bindTapButton(cycleButton, () => {
      this.weaponCycleQueued = true;
    });
    this.bindTapButton(flareButton, () => {
      this.flareQueued = true;
    });
    if (specialButton) {
      const handleSpecialStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.specialPressed = true;
        this.specialTapQueued = true;
      };
      const handleSpecialEnd = (): void => {
        this.specialPressed = false;
      };
      this.addTrackedListener(specialButton, 'touchstart', handleSpecialStart, { passive: false });
      this.addTrackedListener(specialButton, 'touchend', handleSpecialEnd);
      this.addTrackedListener(specialButton, 'touchcancel', handleSpecialEnd);
    }

    // 防止页面滚动
    this.addTrackedListener(document, 'touchmove', handlePreventMobileScroll, { passive: false });
  }

  /** 单击按钮：touchstart 锁存一次动作 */
  private bindTapButton(button: HTMLElement | null, onTap: () => void): void {
    if (!button) {
      return;
    }
    const handleTap = (e: TouchEvent): void => {
      e.preventDefault();
      onTap();
    };
    this.addTrackedListener(button, 'touchstart', handleTap, { passive: false });
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
    this.keys.clear();
    this.joystickActive = false;
    this.joystickX = 0;
    this.joystickY = 0;
    this.joystickTouchId = null;
    this.firePressed = false;
    this.throttlePressed = false;
    this.missilePressed = false;
    this.specialPressed = false;
    this.resetActionQueue();
    this.resetPauseState();
    this.resetUpgradeState();
  }

  /**
   * 获取当前输入状态。
   * 返回的是复用对象：每次调用都会覆盖上一次的结果，调用方只在当帧读取；需要跨帧保留请自行复制。
   */
  public getState(): InputState {
    if (this.isMobile) {
      return this.getMobileState();
    }
    return this.getDesktopState();
  }

  /**
   * 获取移动端输入状态
   */
  private getMobileState(): InputState {
    const threshold = 0.3;
    const state = this.state;
    state.pitchUp = this.joystickY < -threshold;
    state.pitchDown = this.joystickY > threshold;
    state.yawLeft = this.joystickX < -threshold;
    state.yawRight = this.joystickX > threshold;
    state.rollLeft = false;
    state.rollRight = false;
    state.fire = this.firePressed;
    state.missile = this.missilePressed;
    state.throttle = this.throttlePressed;
    state.special = this.specialPressed || this.takeSpecialTap();
    return state;
  }

  /**
   * 获取桌面端输入状态
   */
  private getDesktopState(): InputState {
    const keys = this.keys;
    const state = this.state;
    state.pitchUp = keys.has('KeyW') || keys.has('ArrowUp');
    state.pitchDown = keys.has('KeyS') || keys.has('ArrowDown');
    state.yawLeft = keys.has('KeyA');
    state.yawRight = keys.has('KeyD');
    state.rollLeft = keys.has('KeyQ');
    state.rollRight = keys.has('KeyE');
    state.fire = keys.has('Space');
    state.missile = keys.has('KeyM') || keys.has('ShiftRight'); // M键或右Shift发射导弹
    state.throttle = keys.has('ShiftLeft') || keys.has('ControlLeft');
    state.special = keys.has('KeyF') || this.takeSpecialTap();
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

  /** 清空所有单次动作（暂停 / 剧情卡片 / 换关时调用，避免恢复后误触发） */
  public resetActionQueue(): void {
    this.cameraToggleQueued = false;
    this.weaponCycleQueued = false;
    this.weaponSlotQueued = -1;
    this.flareQueued = false;
    this.specialTapQueued = false;
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
