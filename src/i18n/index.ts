/**
 * 轻量本地化核心：英文为默认语言，简体中文可在菜单中切换。
 *
 * 用法：文案就地写成双语对象，取值时按当前语言挑选——
 *   tr({ en: 'Wave {n}', zh: '第{n}波' }, { n: 3 })
 * 热路径（每帧调用）请把双语对象提升为模块级常量，避免逐帧分配。
 * 本模块在导入时不访问 document / window。
 */

export type Locale = 'en' | 'zh-CN';

export const DEFAULT_LOCALE: Locale = 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh-CN'];

/** 双语文案：en 为英文，zh 为简体中文 */
export interface LocalizedText {
  readonly en: string;
  readonly zh: string;
}

export type TextParams = Readonly<Record<string, string | number>>;
export type LocaleListener = (locale: Locale) => void;

let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<LocaleListener>();

/** 把任意输入规整为受支持的语言；无法识别时回落到默认英文 */
export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== 'string') {
    return DEFAULT_LOCALE;
  }
  const lower = value.trim().toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower.startsWith('zh-hans')) {
    return 'zh-CN';
  }
  if (lower === 'en' || lower.startsWith('en-')) {
    return 'en';
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function isChinese(): boolean {
  return currentLocale === 'zh-CN';
}

/** 切换语言：同步 <html lang> 并通知订阅者（语言未变化时不通知） */
export function setLocale(locale: Locale): void {
  const next = normalizeLocale(locale);
  if (next === currentLocale) {
    return;
  }
  currentLocale = next;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = next;
  }
  for (const listener of Array.from(listeners)) {
    try {
      listener(next);
    } catch (error) {
      console.warn('[i18n] locale listener failed', error);
    }
  }
}

/** 订阅语言变化，返回取消订阅函数 */
export function onLocaleChange(listener: LocaleListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 按当前语言取文案；传入纯字符串时原样返回（便于渐进迁移） */
export function localize(text: LocalizedText | string): string {
  if (typeof text === 'string') {
    return text;
  }
  return currentLocale === 'zh-CN' ? text.zh : text.en;
}

/** 用 {name} 占位符填充参数；未提供的占位符保持原样 */
export function format(template: string, params?: TextParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

/** localize + format 的组合 */
export function tr(text: LocalizedText | string, params?: TextParams): string {
  return format(localize(text), params);
}
