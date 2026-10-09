import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_START_FLOW_SETTINGS,
  LANGUAGE_ENDONYMS,
  START_MENU_STORAGE_KEY,
  loadStartFlowSettings,
  normalizeStartFlowSettings,
  saveStartFlowSettings,
  stepLanguage,
} from '@/core/SessionSettings';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  format,
  getLocale,
  isChinese,
  localize,
  normalizeLocale,
  onLocaleChange,
  setLocale,
  tr,
  type Locale,
} from '@/i18n';
import { resetLocale } from './i18nTestUtils';

/**
 * 本地化核心（src/i18n）与界面语言设置（StartFlowSettings.language）：
 * 英文是默认语言，简体中文可在菜单里切换并持久化；<html lang> 跟随设置。
 */

const WAVE: { en: string; zh: string } = { en: 'Wave {n}', zh: '第{n}波' };

describe('i18n core', () => {
  afterEach(() => {
    resetLocale();
    vi.restoreAllMocks();
  });

  it('defaults to English and supports exactly English and Simplified Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'zh-CN']);
    expect(getLocale()).toBe('en');
    expect(isChinese()).toBe(false);
  });

  describe('normalizeLocale', () => {
    it.each([
      ['en', 'en'],
      ['EN', 'en'],
      [' en ', 'en'],
      ['en-US', 'en'],
      ['en-GB', 'en'],
      ['zh', 'zh-CN'],
      ['zh-CN', 'zh-CN'],
      ['ZH-cn', 'zh-CN'],
      ['zh-Hans', 'zh-CN'],
      ['zh-Hans-CN', 'zh-CN'],
    ] as const)('maps %j to %s', (input, expected) => {
      expect(normalizeLocale(input)).toBe(expected);
    });

    it.each([['fr'], ['ja-JP'], [''], ['   '], [null], [undefined], [42], [{}], [['zh']]])(
      'falls back to English for %j',
      (input) => {
        expect(normalizeLocale(input)).toBe('en');
      }
    );
  });

  describe('format', () => {
    it('fills {name} placeholders from the params', () => {
      expect(format('Wave {wave} of {total}', { wave: 3, total: 7 })).toBe('Wave 3 of 7');
      expect(format('{name} is down', { name: 'Raven' })).toBe('Raven is down');
    });

    it('fills every occurrence and keeps falsy values', () => {
      expect(format('{n} + {n} = {sum}', { n: 0, sum: 0 })).toBe('0 + 0 = 0');
      expect(format('[{label}]', { label: '' })).toBe('[]');
    });

    it('leaves unknown placeholders and placeholder-free text untouched', () => {
      expect(format('Wave {wave} · {boss}', { wave: 2 })).toBe('Wave 2 · {boss}');
      expect(format('No placeholders', { wave: 2 })).toBe('No placeholders');
      expect(format('Wave {wave}')).toBe('Wave {wave}');
    });
  });

  describe('localize / tr', () => {
    it('picks the text for the current locale', () => {
      expect(localize(WAVE)).toBe('Wave {n}');
      expect(tr(WAVE, { n: 3 })).toBe('Wave 3');
      setLocale('zh-CN');
      expect(isChinese()).toBe(true);
      expect(localize(WAVE)).toBe('第{n}波');
      expect(tr(WAVE, { n: 3 })).toBe('第3波');
    });

    it('passes plain strings through in either locale', () => {
      expect(tr('ORACLE')).toBe('ORACLE');
      expect(tr('Wave {n}', { n: 1 })).toBe('Wave 1');
      setLocale('zh-CN');
      expect(localize('ORACLE')).toBe('ORACLE');
    });
  });

  describe('setLocale / onLocaleChange', () => {
    it('notifies each listener once per change with the new locale', () => {
      const seen: Locale[] = [];
      const unsubscribe = onLocaleChange((locale) => seen.push(locale));
      setLocale('zh-CN');
      setLocale('en');
      expect(seen).toEqual(['zh-CN', 'en']);
      unsubscribe();
    });

    it('does not notify when the locale does not change', () => {
      const listener = vi.fn();
      const unsubscribe = onLocaleChange(listener);
      setLocale('en');
      expect(listener).not.toHaveBeenCalled();
      setLocale('zh-CN');
      setLocale('zh-CN');
      setLocale('zh' as Locale);
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('normalizes what it is given', () => {
      setLocale('zh' as Locale);
      expect(getLocale()).toBe('zh-CN');
      setLocale('klingon' as Locale);
      expect(getLocale()).toBe('en');
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = onLocaleChange(listener);
      unsubscribe();
      setLocale('zh-CN');
      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps <html lang> in step with the locale', () => {
      setLocale('zh-CN');
      expect(document.documentElement.lang).toBe('zh-CN');
      setLocale('en');
      expect(document.documentElement.lang).toBe('en');
    });

    it('isolates a failing listener from the others', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const before = vi.fn();
      const after = vi.fn();
      const unsubscribers = [
        onLocaleChange(before),
        onLocaleChange(() => {
          throw new Error('listener failed');
        }),
        onLocaleChange(after),
      ];
      expect(() => setLocale('zh-CN')).not.toThrow();
      expect(before).toHaveBeenCalledWith('zh-CN');
      expect(after).toHaveBeenCalledWith('zh-CN');
      expect(getLocale()).toBe('zh-CN');
      expect(warn).toHaveBeenCalled();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    });

    it('lets a listener unsubscribe itself without skipping the next one', () => {
      const after = vi.fn();
      const unsubscribeSelf: { current: () => void } = { current: () => undefined };
      unsubscribeSelf.current = onLocaleChange(() => unsubscribeSelf.current());
      const unsubscribeAfter = onLocaleChange(after);
      setLocale('zh-CN');
      expect(after).toHaveBeenCalledTimes(1);
      unsubscribeAfter();
    });
  });
});

describe('StartFlowSettings.language', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    resetLocale();
  });

  it('defaults to English', () => {
    expect(DEFAULT_START_FLOW_SETTINGS.language).toBe('en');
    expect(normalizeStartFlowSettings().language).toBe('en');
    expect(loadStartFlowSettings().language).toBe('en');
  });

  it('normalizes the stored value', () => {
    expect(normalizeStartFlowSettings({ language: 'zh-CN' }).language).toBe('zh-CN');
    expect(normalizeStartFlowSettings({ language: 'zh' as Locale }).language).toBe('zh-CN');
    expect(normalizeStartFlowSettings({ language: 'fr' as Locale }).language).toBe('en');
    expect(normalizeStartFlowSettings({ language: undefined }).language).toBe('en');
  });

  it('persists a language choice without touching the other settings', () => {
    saveStartFlowSettings({ difficulty: 5, startLevel: 7 });
    saveStartFlowSettings({ language: 'zh-CN' });
    const loaded = loadStartFlowSettings();
    expect(loaded.language).toBe('zh-CN');
    expect(loaded.difficulty).toBe(5);
    expect(loaded.startLevel).toBe(7);
    const stored = JSON.parse(window.localStorage.getItem(START_MENU_STORAGE_KEY) ?? '{}');
    expect(stored.language).toBe('zh-CN');

    saveStartFlowSettings({ sfxVolume: 0.2 });
    expect(loadStartFlowSettings().language, 'unrelated saves keep the language').toBe('zh-CN');
  });

  it('reads settings saved before the language field existed as English', () => {
    window.localStorage.setItem(
      START_MENU_STORAGE_KEY,
      JSON.stringify({
        difficulty: 4,
        sfxVolume: 0.4,
        musicVolume: 0.5,
        cameraMode: 'first-person',
      })
    );
    const loaded = loadStartFlowSettings();
    expect(loaded.language).toBe('en');
    expect(loaded.difficulty).toBe(4);
    expect(loaded.cameraMode).toBe('first-person');
  });

  it('steps through the supported languages in both directions', () => {
    expect(stepLanguage('en', 1)).toBe('zh-CN');
    expect(stepLanguage('zh-CN', 1)).toBe('en');
    expect(stepLanguage('en', -1)).toBe('zh-CN');
    expect(stepLanguage('zh-CN', -1)).toBe('en');
    expect(stepLanguage('fr' as Locale, 1)).toBe('zh-CN');
  });

  it('names each language in its own script, whatever the interface language', () => {
    expect(LANGUAGE_ENDONYMS).toEqual({ en: 'English', 'zh-CN': '中文' });
  });
});
