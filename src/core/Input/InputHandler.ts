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
  private pausePressed: boolean = false;
  private previousPauseState: boolean = false;
  private previousUpgradeState: boolean = false;

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
    this.keys.add(keyboardEvent.code);
    if (keyboardEvent.code === 'Escape' || keyboardEvent.code === 'KeyP') {
      this.pausePressed = true;
    }
    if (keyboardEvent.code === 'KeyU') {
      this.upgradePressed = true;
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

    // 移动端「升级」舱门打开暂停菜单，而非直接进入商店
    if (upgradeButton) {
      const handlePauseCabinStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.pausePressed = true;
      };
      const handlePauseCabinEnd = (): void => {
        this.pausePressed = false;
      };
      this.addTrackedListener(upgradeButton, 'touchstart', handlePauseCabinStart, {
        passive: false,
      });
      this.addTrackedListener(upgradeButton, 'touchend', handlePauseCabinEnd);
    }

    // 防止页面滚动
    this.addTrackedListener(document, 'touchmove', handlePreventMobileScroll, { passive: false });
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
    this.resetPauseState();
    this.resetUpgradeState();
  }

  /**
   * 获取当前输入状态
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
    return {
      pitchUp: this.joystickY < -threshold,
      pitchDown: this.joystickY > threshold,
      yawLeft: this.joystickX < -threshold,
      yawRight: this.joystickX > threshold,
      rollLeft: false,
      rollRight: false,
      fire: this.firePressed,
      missile: this.missilePressed,
      throttle: this.throttlePressed,
    };
  }

  /**
   * 获取桌面端输入状态
   */
  private getDesktopState(): InputState {
    return {
      pitchUp: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      pitchDown: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      yawLeft: this.keys.has('KeyA'),
      yawRight: this.keys.has('KeyD'),
      rollLeft: this.keys.has('KeyQ'),
      rollRight: this.keys.has('KeyE'),
      fire: this.keys.has('Space'),
      missile: this.keys.has('KeyM') || this.keys.has('ShiftRight'), // M键或右Shift发射导弹
      throttle: this.keys.has('ShiftLeft') || this.keys.has('ControlLeft'),
    };
  }

  public isPauseToggled(): boolean {
    const toggled = this.pausePressed && !this.previousPauseState;
    this.previousPauseState = this.pausePressed;
    return toggled;
  }

  public resetPauseState(): void {
    this.pausePressed = false;
    this.previousPauseState = false;
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
