/**
 * 设备替身：在 jsdom 里扮演一台具体的设备——UA、屏幕（screen.width / height，CSS px）、视口
 * （innerWidth / innerHeight）、触控（'ontouchstart' in window 与 navigator.maxTouchPoints）和
 * 设备像素比。restoreDevice() 把动过的每个属性还原成原来的样子（原来没有的就删掉）。
 *
 * src/config.ts 在模块求值时判定设备：先 stubDevice()，再 vi.resetModules() 后动态 import，
 * 读到的就是这台设备的判定结果。
 */

export interface DeviceSpec {
  userAgent: string;
  /** 设备屏幕（CSS px），与视口无关：工具栏、旋转、全屏都不改变它 */
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  touch: boolean;
  devicePixelRatio: number;
}

export const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';
export const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Mobile Safari/537.36';
/** Chrome “桌面版网站”模式在 Android 上报的就是这种 Linux 桌面 UA */
export const LINUX_DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';
/** iPadOS Safari 默认报桌面 Mac 的 UA */
export const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
  'Version/17.5 Safari/605.1.15';
export const WINDOWS_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

/** 一台 1280×800 屏幕的 Android 平板，横握、视口占满屏幕 */
export const ANDROID_TABLET: DeviceSpec = {
  userAgent: ANDROID_TABLET_UA,
  screen: { width: 1280, height: 800 },
  viewport: { width: 1280, height: 800 },
  touch: true,
  devicePixelRatio: 2,
};

/** 一台 412×915 屏幕的 Android 手机，横握 */
export const ANDROID_PHONE: DeviceSpec = {
  userAgent: ANDROID_PHONE_UA,
  screen: { width: 412, height: 915 },
  viewport: { width: 915, height: 412 },
  touch: true,
  devicePixelRatio: 2.625,
};

/** 没有触控的桌面 */
export const DESKTOP: DeviceSpec = {
  userAgent: WINDOWS_DESKTOP_UA,
  screen: { width: 1920, height: 1080 },
  viewport: { width: 1920, height: 1080 },
  touch: false,
  devicePixelRatio: 1,
};

interface SavedProperty {
  target: object;
  name: string;
  descriptor: PropertyDescriptor | undefined;
}

const saved: SavedProperty[] = [];

function remember(target: object, name: string): void {
  if (saved.some((entry) => entry.target === target && entry.name === name)) {
    return;
  }
  saved.push({ target, name, descriptor: Object.getOwnPropertyDescriptor(target, name) });
}

function define(target: object, name: string, value: unknown): void {
  remember(target, name);
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

function remove(target: object, name: string): void {
  remember(target, name);
  Reflect.deleteProperty(target, name);
}

/** 把 jsdom 变成 spec 描述的设备（可以连续调用：例如只换视口） */
export function stubDevice(spec: DeviceSpec): void {
  define(navigator, 'userAgent', spec.userAgent);
  define(navigator, 'maxTouchPoints', spec.touch ? 5 : 0);
  if (spec.touch) {
    if (!('ontouchstart' in window)) {
      define(window, 'ontouchstart', null);
    }
  } else {
    remove(window, 'ontouchstart');
  }
  define(screen, 'width', spec.screen.width);
  define(screen, 'height', spec.screen.height);
  define(screen, 'availWidth', spec.screen.width);
  define(screen, 'availHeight', spec.screen.height);
  stubViewport(spec.viewport.width, spec.viewport.height);
  define(window, 'devicePixelRatio', spec.devicePixelRatio);
}

/** 只改视口（工具栏收起、旋转、全屏）：屏幕不变 */
export function stubViewport(width: number, height: number): void {
  define(window, 'innerWidth', width);
  define(window, 'innerHeight', height);
}

export function restoreDevice(): void {
  for (const { target, name, descriptor } of saved.reverse()) {
    if (descriptor) {
      Object.defineProperty(target, name, descriptor);
    } else {
      Reflect.deleteProperty(target, name);
    }
  }
  saved.length = 0;
}
