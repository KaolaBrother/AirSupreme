import { vi } from 'vitest';

/**
 * 测试用的监听登记簿：记下被测对象存活期间加上、还没移除的事件监听，
 * dispose() 之后登记簿应当是空的。
 */

export interface ListenerRegistration {
  target: EventTarget;
  type: string;
  listener: unknown;
  capture: boolean;
}

export interface ListenerTracker {
  /** 加上之后还没移除的监听 */
  readonly live: ListenerRegistration[];
  /** 还原 addEventListener / removeEventListener */
  stop(): void;
}

type ListenerOwner = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/** 监听是按 (类型, 回调, 是否捕获) 区分的：移除时 capture 不一致就移不掉 */
function captureOf(options: unknown): boolean {
  if (typeof options === 'boolean') return options;
  return typeof options === 'object' && options !== null
    ? (options as AddEventListenerOptions).capture === true
    : false;
}

/**
 * 开始登记。测试环境里 window 的 addEventListener 是它自己的（绑定过的）方法，不走
 * EventTarget.prototype，所以两处都要接管：原型管元素与 document，window 单独管。
 */
export function trackListeners(): ListenerTracker {
  const live: ListenerRegistration[] = [];
  const restores: Array<() => void> = [];

  const watch = (owner: ListenerOwner, fixedTarget: EventTarget | null): void => {
    const originalAdd = owner.addEventListener;
    const originalRemove = owner.removeEventListener;
    const add = vi.spyOn(owner, 'addEventListener').mockImplementation(function (
      this: EventTarget,
      type,
      listener,
      options
    ) {
      const target = fixedTarget ?? this;
      live.push({ target, type, listener, capture: captureOf(options) });
      return Reflect.apply(originalAdd, target, [type, listener, options]);
    });
    const remove = vi.spyOn(owner, 'removeEventListener').mockImplementation(function (
      this: EventTarget,
      type,
      listener,
      options
    ) {
      const target = fixedTarget ?? this;
      const capture = captureOf(options);
      const index = live.findIndex(
        (entry) =>
          entry.target === target &&
          entry.type === type &&
          entry.listener === listener &&
          entry.capture === capture
      );
      if (index >= 0) live.splice(index, 1);
      return Reflect.apply(originalRemove, target, [type, listener, options]);
    });
    restores.push(() => {
      add.mockRestore();
      remove.mockRestore();
    });
  };

  watch(EventTarget.prototype, null);
  if (window.addEventListener !== EventTarget.prototype.addEventListener) {
    watch(window, window);
  }
  return {
    live,
    stop() {
      for (const restore of restores.reverse()) restore();
    },
  };
}

function describeTarget(target: EventTarget): string {
  if (target === window) return 'window';
  if (target === document) return 'document';
  if (target instanceof HTMLElement) return `<${target.tagName.toLowerCase()}#${target.id}>`;
  return String(target);
}

/** 登记簿里剩下的监听，写成 "keydown on window" 这样的可读列表 */
export function describeListeners(entries: readonly ListenerRegistration[]): string[] {
  return entries.map((entry) => `${entry.type} on ${describeTarget(entry.target)}`);
}
