import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '@/config';
import { InputHandler } from '@/core/Input/InputHandler';

/**
 * 暂停键（InputHandler，终验修复 F1）：
 * - 移动端「暂停」舱门（#upgrade-button）的轻触被锁存：touchstart + touchend 都发生在游戏轮询之前，
 *   isPauseToggled() 也恰好返回一次 true；resetPauseState() 清除未消费的轻触；
 * - 桌面 Esc / P 不变：按下沿触发一次，按住不重复，松开再按再触发。
 */

function touch(type: 'touchstart' | 'touchend', target: EventTarget): void {
  const init = { bubbles: true, cancelable: true };
  const event =
    typeof TouchEvent === 'function' ? new TouchEvent(type, init) : new Event(type, init);
  target.dispatchEvent(event);
}

function key(type: 'keydown' | 'keyup', code: string, repeat = false): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, repeat, bubbles: true }));
}

/** 连续轮询 n 次，返回为 true 的次数（游戏每个模拟步轮询一次） */
function pollToggles(handler: InputHandler, polls: number): number {
  let toggles = 0;
  for (let i = 0; i < polls; i++) {
    if (handler.isPauseToggled()) toggles++;
  }
  return toggles;
}

describe('InputHandler pause', () => {
  let originalIsMobile: boolean;
  let handler: InputHandler | null = null;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    document.body.innerHTML = `
      <div id="mobile-controls" class="mobile-controls">
        <div id="joystick"><div id="joystick-knob"></div></div>
        <button id="fire-button"></button>
        <button id="upgrade-button"></button>
      </div>`;
  });

  afterEach(() => {
    handler?.dispose();
    handler = null;
    GameConfig.isMobile = originalIsMobile;
    document.body.innerHTML = '';
  });

  describe('mobile pause button', () => {
    function mobileHandler(): { handler: InputHandler; button: HTMLElement } {
      GameConfig.isMobile = true;
      const created = new InputHandler();
      handler = created;
      const button = document.getElementById('upgrade-button');
      expect(button).not.toBeNull();
      return { handler: created, button: button as HTMLElement };
    }

    it('latches a quick tap (start + end before the game polls): toggles exactly once', () => {
      const { handler: input, button } = mobileHandler();
      expect(input.isPauseToggled()).toBe(false);

      touch('touchstart', button);
      touch('touchend', button);

      expect(input.isPauseToggled()).toBe(true);
      expect(pollToggles(input, 10)).toBe(0);
    });

    it('toggles once for a held press, and again for the next tap', () => {
      const { handler: input, button } = mobileHandler();
      touch('touchstart', button);
      expect(pollToggles(input, 5)).toBe(1);
      touch('touchend', button);
      expect(pollToggles(input, 5)).toBe(0);

      touch('touchstart', button);
      touch('touchend', button);
      expect(pollToggles(input, 5)).toBe(1);
    });

    it('resetPauseState() drops a tap the game has not consumed yet', () => {
      const { handler: input, button } = mobileHandler();
      touch('touchstart', button);
      touch('touchend', button);

      input.resetPauseState();
      expect(pollToggles(input, 5)).toBe(0);
    });
  });

  describe('desktop Escape / P (unchanged)', () => {
    beforeEach(() => {
      GameConfig.isMobile = false;
      handler = new InputHandler();
    });

    it.each(['Escape', 'KeyP'])('%s toggles once per press, not while held', (code) => {
      const input = handler as InputHandler;
      key('keydown', code);
      expect(pollToggles(input, 5)).toBe(1);
      key('keydown', code, true);
      expect(pollToggles(input, 5), 'auto-repeat while held').toBe(0);
      key('keyup', code);
      expect(pollToggles(input, 5)).toBe(0);

      key('keydown', code);
      expect(pollToggles(input, 5)).toBe(1);
      key('keyup', code);
    });

    it('resetPauseState() clears a held key so the next press toggles again', () => {
      const input = handler as InputHandler;
      key('keydown', 'Escape');
      expect(input.isPauseToggled()).toBe(true);
      input.resetPauseState();
      expect(pollToggles(input, 3)).toBe(0);
      key('keyup', 'Escape');
      key('keydown', 'Escape');
      expect(pollToggles(input, 3)).toBe(1);
    });
  });
});
