import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 触控测试工具：
 * - 把 index.html 里随包发布的 #mobile-controls 放进测试文档（元素 id 与真实页面一致）；
 * - TouchScreen 按 Touch Events 规范模拟一块触摸屏：每根手指有自己的 identifier，
 *   move / end / cancel 事件派发到手指最初落下的元素并冒泡到 document，
 *   touches 列出屏幕上仍按着的全部手指，changedTouches 只有本次变化的那一根。
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');

export function readShippedIndexHtml(): string {
  return readFileSync(INDEX_HTML_PATH, 'utf8');
}

export function parseShippedDocument(): Document {
  return new DOMParser().parseFromString(readShippedIndexHtml(), 'text/html');
}

/** 用发布版 index.html 的 #mobile-controls 替换测试文档的 body */
export function seedShippedMobileControls(): HTMLElement {
  const shipped = parseShippedDocument().getElementById('mobile-controls');
  if (!shipped) {
    throw new Error('index.html has no #mobile-controls');
  }
  document.body.innerHTML = shipped.outerHTML;
  const controls = document.getElementById('mobile-controls');
  if (!controls) {
    throw new Error('#mobile-controls was not seeded into the test document');
  }
  return controls;
}

export function elementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`#${id} is missing from the test document`);
  }
  return element;
}

export function pressKey(code: string, repeat = false): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, repeat, bubbles: true }));
}

export function releaseKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
}

interface Finger {
  identifier: number;
  target: EventTarget;
  clientX: number;
  clientY: number;
}

type TouchEventType = 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel';

function snapshot(finger: Finger): Touch {
  return {
    identifier: finger.identifier,
    target: finger.target,
    clientX: finger.clientX,
    clientY: finger.clientY,
    pageX: finger.clientX,
    pageY: finger.clientY,
    screenX: finger.clientX,
    screenY: finger.clientY,
    radiusX: 12,
    radiusY: 12,
    rotationAngle: 0,
    force: 1,
  };
}

export class TouchScreen {
  private readonly fingers = new Map<number, Finger>();

  /** 手指按下 */
  public down(identifier: number, target: EventTarget, clientX: number, clientY: number): void {
    if (this.fingers.has(identifier)) {
      throw new Error(`finger ${identifier} is already down`);
    }
    const finger: Finger = { identifier, target, clientX, clientY };
    this.fingers.set(identifier, finger);
    this.dispatch('touchstart', finger);
  }

  /** 手指移动（事件仍派发到它最初落下的元素，坐标可以在任何地方） */
  public move(identifier: number, clientX: number, clientY: number): void {
    const finger = this.fingerOf(identifier);
    finger.clientX = clientX;
    finger.clientY = clientY;
    this.dispatch('touchmove', finger);
  }

  /** 手指抬起 */
  public up(identifier: number): void {
    const finger = this.fingerOf(identifier);
    this.fingers.delete(identifier);
    this.dispatch('touchend', finger);
  }

  /** 系统取消这根手指（来电、手势接管等） */
  public cancel(identifier: number): void {
    const finger = this.fingerOf(identifier);
    this.fingers.delete(identifier);
    this.dispatch('touchcancel', finger);
  }

  /** 轻点：按下后立即抬起 */
  public tap(identifier: number, target: EventTarget, clientX: number, clientY: number): void {
    this.down(identifier, target, clientX, clientY);
    this.up(identifier);
  }

  public isDown(identifier: number): boolean {
    return this.fingers.has(identifier);
  }

  private fingerOf(identifier: number): Finger {
    const finger = this.fingers.get(identifier);
    if (!finger) {
      throw new Error(`finger ${identifier} is not down`);
    }
    return finger;
  }

  private dispatch(type: TouchEventType, changed: Finger): void {
    const active = [...this.fingers.values()];
    const event = new TouchEvent(type, {
      bubbles: true,
      cancelable: type !== 'touchcancel',
      composed: true,
      touches: active.map(snapshot),
      targetTouches: active.filter((finger) => finger.target === changed.target).map(snapshot),
      changedTouches: [snapshot(changed)],
    });
    changed.target.dispatchEvent(event);
  }
}
