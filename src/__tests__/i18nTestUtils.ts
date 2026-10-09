import { expect } from 'vitest';
import { setLocale, type Locale, type LocalizedText } from '@/i18n';

/**
 * 测试用的语言工具：界面默认英文，简体中文可切换。
 * 涉及文案的用例在两种语言下各断言一次（先 setLocale，再在 afterEach 里回到英文），
 * 而不是只写死其中一种语言。
 */

export const LOCALES: readonly Locale[] = ['en', 'zh-CN'];

/** 双语文案在指定语言下的文本 */
export function textIn(text: LocalizedText, locale: Locale): string {
  return locale === 'zh-CN' ? text.zh : text.en;
}

/** 在指定语言下执行 fn，结束后总是回到默认英文 */
export function inLocale<T>(locale: Locale, fn: () => T): T {
  setLocale(locale);
  try {
    return fn();
  } finally {
    setLocale('en');
  }
}

/** 回到默认英文（afterEach 用） */
export function resetLocale(): void {
  setLocale('en');
}

/** 断言是完整的双语文案：en / zh 都是非空字符串 */
export function expectBilingual(text: LocalizedText | null | undefined, where: string): void {
  expect(text, where).toBeTruthy();
  expect(typeof text?.en, `${where} (en)`).toBe('string');
  expect(typeof text?.zh, `${where} (zh)`).toBe('string');
  expect(text?.en.trim().length ?? 0, `${where} (en)`).toBeGreaterThan(0);
  expect(text?.zh.trim().length ?? 0, `${where} (zh)`).toBeGreaterThan(0);
}
