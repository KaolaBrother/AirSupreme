import { expect, vi } from 'vitest';
import {
  CAMPAIGN_SAVE_KEY,
  saveCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import { START_MENU_STORAGE_KEY, type StartFlowSettings } from '@/core/SessionSettings';

/**
 * 主菜单（StartMenu 及 src/ui/menu/**）测试共用的工具。
 *
 * 原则：从玩家够得着的地方操作——点击、按键、存储——并且只做玩家做得到的事：
 * userClick 不会点中隐藏的、inert 的或禁用的控件（jsdom 的 element.click() 不管这些）。
 * 断言只看行为与无障碍语义（role / aria-* / hidden / 焦点 / 文案），不看颜色、尺寸与装饰用类名。
 */

export type CheckpointInput = Omit<CampaignSaveData, 'version' | 'savedAt'>;

/** 第 6 关、下一波是第 3 波的检查点：“Ch. 6 · Heart of the Forge · Wave 3” */
export const CHECKPOINT: CheckpointInput = {
  checkpoint: 'wave',
  level: 6,
  wave: 2,
  difficulty: 4,
  score: 15_200,
  lives: 2,
  missiles: 4,
  upgrades: {},
  weapons: { unlocked: ['rockets', 'laser', 'swarm'], selected: 'swarm', ammo: { rockets: 2 } },
  flares: 2,
  cameraMode: 'first-person',
  stats: { kills: 50, civiliansLost: 0, deaths: 1, playTimeSeconds: 900 },
};

export const CHECKPOINT_TEXT = {
  en: 'Ch. 6 · Heart of the Forge · Wave 3',
  zh: '第6关 · 熔炉之心 · 第3波',
} as const;

/** 写入一份有效检查点，返回存储里的原始字符串（用来做“逐字节不变”的断言） */
export function seedCheckpoint(overrides: Partial<CheckpointInput> = {}): string {
  expect(saveCampaignCheckpoint({ ...CHECKPOINT, ...overrides })).toBe(true);
  const raw = window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
  expect(raw, 'the checkpoint was written').not.toBeNull();
  return raw as string;
}

export function rawSave(): string | null {
  return window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
}

export function storedSettings(): Partial<StartFlowSettings> {
  const raw = window.localStorage.getItem(START_MENU_STORAGE_KEY);
  return raw === null ? {} : (JSON.parse(raw) as Partial<StartFlowSettings>);
}

// ───────────────────────────── 环境补丁 ─────────────────────────────

/**
 * jsdom 没有实现 inert：element.inert = true 只是挂了个普通属性，不反映到 HTML 属性上，
 * 菜单里用 closest('[inert]') 跳过 inert 子树的逻辑就失效了。这里补成与浏览器一致的反射属性。
 * 每个测试文件各有自己的 jsdom，补一次即可。
 */
export function installInertPolyfill(): void {
  if ('inert' in HTMLElement.prototype) {
    return;
  }
  Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    enumerable: true,
    get(this: HTMLElement): boolean {
      return this.hasAttribute('inert');
    },
    set(this: HTMLElement, value: boolean) {
      this.toggleAttribute('inert', Boolean(value));
    },
  });
}

export interface MediaOptions {
  /** prefers-reduced-motion: reduce */
  reducedMotion?: boolean;
  /** (hover: hover) and (pointer: fine)，即鼠标 */
  finePointer?: boolean;
}

/** 装一个按查询字符串应答的 matchMedia（jsdom 默认没有）；vi.unstubAllGlobals() 还原 */
export function stubMatchMedia(options: MediaOptions = {}): void {
  const matchMedia = (query: string): MediaQueryList =>
    ({
      matches:
        (query.includes('prefers-reduced-motion') && options.reducedMotion === true) ||
        (query.includes('pointer: fine') && options.finePointer === true),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  vi.stubGlobal('matchMedia', matchMedia);
}

/** jsdom 的 canvas 没有 2D / WebGL 上下文，每次 getContext 都往 stderr 打一行；这里静音 */
export function silenceCanvasContext(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
}

/**
 * 菜单测试的公共准备：清空文档与存储、不让模型预览模块在空闲时预加载、补 inert、canvas 静音。
 * 配套的收尾见 resetMenuEnvironment。
 */
export function prepareMenuEnvironment(): void {
  document.body.innerHTML = '';
  window.localStorage.clear();
  installInertPolyfill();
  silenceCanvasContext();
  vi.stubGlobal('requestIdleCallback', () => 1);
}

export function resetMenuEnvironment(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.body.innerHTML = '';
}

// ───────────────────────────── 查询 ─────────────────────────────

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  expect(element, `expected #${id} in the document`).not.toBeNull();
  return element as T;
}

/** 元素自身或祖先被 display:none / hidden 藏起来了吗（jsdom 不做布局，只看这两种显式的隐藏） */
export function isHidden(element: Element | null): boolean {
  for (let node = element; node; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node.hidden || node.style.display === 'none') {
      return true;
    }
  }
  return element === null || !element.isConnected;
}

export function isShown(element: Element | null): boolean {
  return !isHidden(element);
}

/** 元素自身或祖先是 inert 的（键盘、指针、读屏都进不去） */
export function isInert(element: Element | null): boolean {
  for (let node = element; node; node = node.parentElement) {
    if (node.hasAttribute('inert') || (node as HTMLElement).inert === true) {
      return true;
    }
  }
  return false;
}

function isDisabled(element: Element): boolean {
  return (
    (element as HTMLButtonElement).disabled === true ||
    element.getAttribute('aria-disabled') === 'true'
  );
}

/** 玩家此刻能不能操作这个控件：看得见、不在 inert 子树里、没被禁用 */
export function isOperable(element: Element | null): boolean {
  return element !== null && isShown(element) && !isInert(element) && !isDisabled(element);
}

/**
 * 读屏 / 玩家能读到的文字：跳过 hidden 与 aria-hidden 的子树。
 * 相邻元素的文字之间补一个空格（块级元素之间 textContent 不带空白，单词会连成一串）。
 */
export function readableText(element: Element | null): string {
  if (!element) {
    return '';
  }
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (!(node instanceof Element)) {
      return;
    }
    if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') {
      return;
    }
    if (node instanceof HTMLElement && (node.hidden || node.style.display === 'none')) {
      return;
    }
    if (node.getAttribute('aria-hidden') === 'true') {
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(element);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ───────────────────────────── 操作 ─────────────────────────────

/**
 * 玩家的一次点击 / 轻触：落在看不见、inert 或禁用的控件上时什么也不发生（返回 false）。
 * 真实浏览器里这些控件收不到指针事件；jsdom 的 click() 不区分，所以在这里把关。
 */
export function userClick(target: Element | string | null): boolean {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element || !isOperable(element)) {
    return false;
  }
  (element as HTMLElement).click();
  return true;
}

/** 必须点得到：点不到就让用例失败 */
export function click(target: Element | string | null): void {
  const label = typeof target === 'string' ? `#${target}` : (target?.id ?? target?.tagName);
  expect(userClick(target), `expected ${label} to be clickable`).toBe(true);
}

/** 在当前焦点（或指定元素）上按下一个键；返回事件，便于检查 defaultPrevented */
export function press(key: string, init: KeyboardEventInit = {}, target?: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  (target ?? document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

/**
 * 测试跑在 Node 里，但项目的 tsconfig 只带 DOM 类型：用到的两样 Node 全局在这里按最小形状声明。
 * 每次现取（不缓存引用）。
 */
interface NodeRuntime {
  setImmediate: (callback: () => void) => unknown;
  process: {
    on: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void;
    off: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void;
  };
}

function nodeRuntime(): NodeRuntime {
  return globalThis as unknown as NodeRuntime;
}

/** 让出一轮事件循环（真实的 setImmediate，假时钟不接管它） */
function nextTask(): Promise<void> {
  return new Promise<void>((resolve) => {
    nodeRuntime().setImmediate(resolve);
  });
}

/** 让出若干轮事件循环：按需加载的模块（import()）与其后的微任务跑完 */
export async function settle(rounds: number = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await nextTask();
  }
}

/**
 * 让出事件循环直到条件成立（或轮数用完）：第一次 import() 一个大模块要多少轮说不准，
 * 等结果比数轮数可靠。条件始终不成立时照常返回，由随后的断言报错。
 */
export async function settleUntil(done: () => boolean, rounds: number = 500): Promise<void> {
  for (let i = 0; i < rounds && !done(); i++) {
    await nextTask();
  }
}

/** 数组的最后一项（项目的 lib 是 ES2020，没有 Array.prototype.at） */
export function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

/** 假时钟：只接管定时器与时间，setImmediate 保持真实（settle 靠它让出事件循环） */
export function useMenuFakeTimers(): void {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
}

/**
 * 菜单自己还挂着的定时器个数（假时钟下）。
 * jsdom 的 focus() 会排一个 0 毫秒的定时器去发 selectionchange，先把这些到期的跑掉再数。
 */
export function pendingTimers(): number {
  vi.advanceTimersByTime(0);
  return vi.getTimerCount();
}

// ───────────────────────────── 泄漏对账 ─────────────────────────────

export interface ListenerLedger {
  /** 此刻还挂在 document / window 上的监听，形如 "document:keydown"，已排序 */
  snapshot: () => string[];
}

/**
 * 记录挂在 document / window 上的监听（按“目标:事件名”计），用来核对显示 / 隐藏之后有没有留下的。
 * 同一监听重复添加只算一次（与浏览器一致）；vi.restoreAllMocks() 还原。
 */
export function trackGlobalListeners(): ListenerLedger {
  const live: Array<{ key: string; listener: unknown; capture: boolean }> = [];
  const captureOf = (options: unknown): boolean =>
    typeof options === 'boolean'
      ? options
      : Boolean((options as AddEventListenerOptions | undefined)?.capture);
  for (const [name, target] of [
    ['document', document],
    ['window', window],
  ] as const) {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      const entry = { key: `${name}:${type}`, listener, capture: captureOf(options) };
      const known = live.some(
        (other) =>
          other.key === entry.key &&
          other.listener === entry.listener &&
          other.capture === entry.capture
      );
      if (!known) {
        live.push(entry);
      }
      add(type, listener, options);
    }) as typeof target.addEventListener);
    vi.spyOn(target, 'removeEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) => {
      const index = live.findIndex(
        (entry) =>
          entry.key === `${name}:${type}` &&
          entry.listener === listener &&
          entry.capture === captureOf(options)
      );
      if (index >= 0) {
        live.splice(index, 1);
      }
      remove(type, listener, options);
    }) as typeof target.removeEventListener);
  }
  return { snapshot: () => live.map((entry) => entry.key).sort() };
}

export interface RejectionWatch {
  /** 监听期间冒出来的未处理的 Promise 拒绝（用例可以 splice 掉自己预期的那些） */
  seen: unknown[];
  stop: () => void;
}

/**
 * 接住未处理的 Promise 拒绝。注意：装上之后 Vitest 自己不再把它们报成错误，
 * 所以用它的文件必须在每个用例结束时断言 seen 为空。
 */
export function watchUnhandledRejections(): RejectionWatch {
  const seen: unknown[] = [];
  const listener = (reason: unknown): void => {
    seen.push(reason);
  };
  nodeRuntime().process.on('unhandledRejection', listener);
  return { seen, stop: () => nodeRuntime().process.off('unhandledRejection', listener) };
}

export interface AnimationFrames {
  /** 已请求、还没执行也没取消的帧数 */
  pending: () => number;
  /** 累计请求过多少帧 */
  requested: () => number;
  /** 执行此刻排着的所有帧（回调里新排的帧留到下一次） */
  run: (now?: number) => void;
}

/** 可手动推进的 requestAnimationFrame / cancelAnimationFrame；vi.unstubAllGlobals() 还原 */
export function installAnimationFrames(): AnimationFrames {
  const queue = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  let requested = 0;
  let clock = 1_000;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    requested++;
    queue.set(nextHandle, callback);
    return nextHandle++;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    queue.delete(handle);
  });
  return {
    pending: () => queue.size,
    requested: () => requested,
    run: (now?: number) => {
      clock = now ?? clock + 16;
      const due = [...queue.values()];
      queue.clear();
      for (const callback of due) {
        callback(clock);
      }
    },
  };
}

// ───────────────────────────── 面板 ─────────────────────────────

export const SETTINGS_SHEET = 'settings-sheet';
export const HOWTO_SHEET = 'howto-sheet';
export const CONFIRM_SHEET = 'new-campaign-confirm';

/**
 * 面板关闭时有一小段收起过渡，期间它还在文档里（没有 hidden）。
 * 用假时钟的用例在关闭之后调一次，让过渡走完，再断言“看不见了”。
 */
export function finishSheetTransitions(): void {
  vi.advanceTimersByTime(300);
}

/** 看得见的面板 / 对话框（role=dialog 或 alertdialog）；关闭过渡走完之后才不算 */
export function showingDialogs(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '#start-menu [role="dialog"], #start-menu [role="alertdialog"]'
    )
  ).filter((dialog) => isShown(dialog));
}

export function isDialogShowing(id: string): boolean {
  const element = document.getElementById(id);
  return element !== null && isShown(element);
}

/** 设置面板里某一行的单选组中、标着给定文字的那个选项 */
export function radioIn(rowId: string, label: string | RegExp): HTMLElement {
  const radios = Array.from(byId(rowId).querySelectorAll<HTMLElement>('[role="radio"]'));
  const match = radios.find((radio) => {
    const text = (radio.textContent ?? '').trim();
    return typeof label === 'string' ? text === label : label.test(text);
  });
  expect(
    match,
    `expected a "${String(label)}" option in #${rowId} (found: ${radios
      .map((radio) => radio.textContent?.trim())
      .join(' | ')})`
  ).toBeDefined();
  return match as HTMLElement;
}

export function checkedRadio(rowId: string): HTMLElement | null {
  const checked = Array.from(
    byId(rowId).querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"]')
  );
  expect(checked.length, `exactly one option is selected in #${rowId}`).toBe(1);
  return checked[0] ?? null;
}

/** 步进器 / 音量条两侧的减、加按钮（文字是 - / +，或由 aria-label 说明） */
export function stepButton(rowId: string, direction: '+' | '-'): HTMLButtonElement {
  const buttons = Array.from(byId(rowId).querySelectorAll('button'));
  const button = buttons.find((candidate) => candidate.textContent?.trim() === direction);
  expect(button, `expected a ${direction} button in #${rowId}`).toBeDefined();
  return button as HTMLButtonElement;
}
