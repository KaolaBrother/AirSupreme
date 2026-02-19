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

  private isMobile: boolean;

  constructor() {
    this.isMobile = GameConfig.isMobile;
    this.setupListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.pausePressed = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.pausePressed = false;
      }
    });

    if (this.isMobile) {
      this.setupTouchControls();
    }
  }

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

    // 触摸开始 - 检查是否在摇杆范围内
    joystick.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
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
      },
      { passive: false }
    );

    // 触摸移动 - 在文档级别监听，防止触摸移出元素后丢失
    const handleTouchMove = (e: TouchEvent) => {
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

    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // 触摸结束 - 在文档级别监听
    const handleTouchEnd = (e: TouchEvent) => {
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

    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    // 开火按钮
    if (fireButton) {
      fireButton.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          this.firePressed = true;
        },
        { passive: false }
      );

      fireButton.addEventListener('touchend', () => {
        this.firePressed = false;
      });
    }

    // 加速按钮
    if (throttleButton) {
      throttleButton.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          this.throttlePressed = true;
        },
        { passive: false }
      );

      throttleButton.addEventListener('touchend', () => {
        this.throttlePressed = false;
      });
    }

    // 导弹按钮
    if (missileButton) {
      missileButton.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          this.missilePressed = true;
        },
        { passive: false }
      );

      missileButton.addEventListener('touchend', () => {
        this.missilePressed = false;
      });
    }

    if (upgradeButton) {
      upgradeButton.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          this.upgradePressed = true;
        },
        { passive: false }
      );

      upgradeButton.addEventListener('touchend', () => {
        this.upgradePressed = false;
      });
    }

    // 防止页面滚动
    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.target instanceof Element && e.target.closest('.mobile-controls')) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
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

  private previousUpgradeState: boolean = false;

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
