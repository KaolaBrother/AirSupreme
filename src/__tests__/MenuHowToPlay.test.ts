import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameConfig } from '@/config';
import { setLocale, type Locale } from '@/i18n';
import { StartMenu } from '@/ui/StartMenu';
import { LOCALES, resetLocale } from './i18nTestUtils';
import {
  HOWTO_SHEET,
  byId,
  click,
  isDialogShowing,
  isShown,
  prepareMenuEnvironment,
  press,
  readableText,
  resetMenuEnvironment,
  useMenuFakeTimers,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 6：操作说明面板。
 *
 * 页签 #howto-tab-keyboard / #howto-tab-touch：tablist 语义、aria-selected、方向键在页签之间移动、
 * 只有选中的那一页看得见。默认页跟设备走（GameConfig.isMobile → 触屏页）。
 * 导弹那一条写的是“环变绿再发射”，两种语言都是。
 */

type View = 'keyboard' | 'touch';

const VIEWS: readonly View[] = ['keyboard', 'touch'];
const TAB_NAMES: Readonly<Record<View, Readonly<Record<Locale, string>>>> = {
  keyboard: { en: 'Keyboard', 'zh-CN': '键盘' },
  touch: { en: 'Touch', 'zh-CN': '触屏' },
};

describe('How to Play sheet (batch X5, spec 6)', () => {
  let menu: StartMenu | null = null;
  let originalIsMobile: boolean;

  function createMenu(device: 'desktop' | 'touch' = 'desktop'): StartMenu {
    GameConfig.isMobile = device === 'touch';
    menu = new StartMenu();
    return menu;
  }

  function openHowTo(): HTMLElement {
    click('howto-btn');
    expect(isDialogShowing(HOWTO_SHEET)).toBe(true);
    return byId(HOWTO_SHEET);
  }

  function tab(view: View): HTMLElement {
    return byId(`howto-tab-${view}`);
  }

  function panelOf(view: View): HTMLElement {
    return byId(tab(view).getAttribute('aria-controls') ?? '');
  }

  function selectedView(): View {
    const selected = VIEWS.filter((view) => tab(view).getAttribute('aria-selected') === 'true');
    expect(selected, 'exactly one tab is selected').toHaveLength(1);
    return selected[0];
  }

  /** 选中页与看得见的那一页是同一页，另一页藏着 */
  function expectShowing(view: View): void {
    const other: View = view === 'keyboard' ? 'touch' : 'keyboard';
    expect(selectedView()).toBe(view);
    expect(tab(other).getAttribute('aria-selected')).toBe('false');
    expect(isShown(panelOf(view)), `${view} panel visible`).toBe(true);
    expect(isShown(panelOf(other)), `${other} panel hidden`).toBe(false);
  }

  /** 页面里同时提到导弹、锁定环与变绿的那一条说明（一条 = 一个不再含子元素的文字节点） */
  function missileLines(view: View, locale: Locale): string[] {
    const words = locale === 'en' ? [/missile/i, /\bring\b/i, /\bgreen\b/i] : [/导弹/, /环/, /绿/];
    return Array.from(panelOf(view).querySelectorAll<HTMLElement>('*'))
      .filter((node) => node.children.length === 0)
      .map((node) => (node.textContent ?? '').trim())
      .filter((text) => words.every((word) => word.test(text)));
  }

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    prepareMenuEnvironment();
    useMenuFakeTimers();
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    resetMenuEnvironment();
  });

  describe('tabs', () => {
    it('offers Keyboard and Touch as tabs in a named tablist', () => {
      createMenu();
      const sheet = openHowTo();
      const list = sheet.querySelector<HTMLElement>('[role="tablist"]');
      expect(list, 'a tablist').not.toBeNull();
      expect(list?.getAttribute('aria-label') ?? list?.getAttribute('aria-labelledby')).toMatch(
        /\S/
      );

      const tabs = Array.from(sheet.querySelectorAll<HTMLElement>('[role="tab"]'));
      expect(tabs.map((node) => node.id)).toEqual(['howto-tab-keyboard', 'howto-tab-touch']);
      for (const node of tabs) {
        expect(list?.contains(node)).toBe(true);
      }
    });

    it.each(LOCALES)('names the tabs in the interface language (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openHowTo();
      for (const view of VIEWS) {
        expect(readableText(tab(view))).toBe(TAB_NAMES[view][locale]);
      }
    });

    it('ties each tab to its own panel, and each panel back to its tab', () => {
      createMenu();
      const sheet = openHowTo();
      const panels = VIEWS.map((view) => panelOf(view));
      expect(panels[0]).not.toBe(panels[1]);
      VIEWS.forEach((view, index) => {
        const panel = panels[index];
        expect(sheet.contains(panel)).toBe(true);
        expect(panel.getAttribute('role')).toBe('tabpanel');
        expect(panel.getAttribute('aria-labelledby')).toBe(tab(view).id);
      });
      expect(sheet.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    });

    it('shows only the selected panel', () => {
      createMenu();
      const sheet = openHowTo();
      expectShowing('keyboard');
      // 藏着的那一页的内容读不到
      expect(readableText(sheet)).toContain('Pitch');
      expect(readableText(sheet)).not.toContain('Left thumb');

      click(tab('touch'));
      expectShowing('touch');
      expect(readableText(sheet)).toContain('Left thumb');
      expect(readableText(sheet)).not.toContain('Pitch');

      click(tab('keyboard'));
      expectShowing('keyboard');
    });

    it('selecting the tab that is already selected changes nothing', () => {
      createMenu();
      openHowTo();
      click(tab('keyboard'));
      expectShowing('keyboard');
    });

    it('keeps one tab stop: only the selected tab is in the tab order', () => {
      createMenu();
      openHowTo();
      expect(tab('keyboard').tabIndex).toBe(0);
      expect(tab('touch').tabIndex).toBe(-1);
      click(tab('touch'));
      expect(tab('touch').tabIndex).toBe(0);
      expect(tab('keyboard').tabIndex).toBe(-1);
    });
  });

  describe('arrow keys', () => {
    it('ArrowRight and ArrowLeft move between the tabs, taking focus and the panel along', () => {
      createMenu();
      openHowTo();
      tab('keyboard').focus();

      const right = press('ArrowRight');
      expect(right.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(tab('touch'));
      expectShowing('touch');

      const left = press('ArrowLeft');
      expect(left.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(tab('keyboard'));
      expectShowing('keyboard');
    });

    it('wraps around at either end', () => {
      createMenu();
      openHowTo();
      tab('keyboard').focus();

      press('ArrowLeft');
      expect(document.activeElement).toBe(tab('touch'));
      expectShowing('touch');

      press('ArrowRight');
      expect(document.activeElement).toBe(tab('keyboard'));
      expectShowing('keyboard');
    });

    it('never leaves both or neither tab selected, however fast the keys come', () => {
      createMenu();
      openHowTo();
      tab('keyboard').focus();
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft']) {
        press(key);
        expectShowing(selectedView());
        expect(document.activeElement).toBe(tab(selectedView()));
      }
    });

    it('do not close the sheet or leak to the title screen', () => {
      createMenu();
      openHowTo();
      tab('keyboard').focus();
      press('ArrowRight');
      press('ArrowDown');
      press('ArrowUp');
      expect(isDialogShowing(HOWTO_SHEET)).toBe(true);
      expect(byId(HOWTO_SHEET).contains(document.activeElement)).toBe(true);
    });
  });

  describe('default tab follows the device', () => {
    it('opens on Keyboard on a desktop', () => {
      createMenu('desktop');
      openHowTo();
      expectShowing('keyboard');
    });

    it('opens on Touch on a touch device', () => {
      createMenu('touch');
      openHowTo();
      expectShowing('touch');
    });

    it('still lets a touch player read the keyboard page, and the other way round', () => {
      createMenu('touch');
      openHowTo();
      click(tab('keyboard'));
      expectShowing('keyboard');
      click(tab('touch'));
      expectShowing('touch');
    });
  });

  describe('the missile line: fire when the ring is green', () => {
    it.each(LOCALES)('keyboard page (%s)', (locale) => {
      setLocale(locale);
      createMenu('desktop');
      openHowTo();
      expectShowing('keyboard');
      expect(missileLines('keyboard', locale).length).toBeGreaterThan(0);
    });

    it.each(LOCALES)('touch page (%s)', (locale) => {
      setLocale(locale);
      createMenu('touch');
      openHowTo();
      expectShowing('touch');
      expect(missileLines('touch', locale).length).toBeGreaterThan(0);
    });

    it('follows a language switch while the sheet is open', () => {
      createMenu('desktop');
      openHowTo();
      expect(missileLines('keyboard', 'en').length).toBeGreaterThan(0);

      setLocale('zh-CN');

      expect(missileLines('keyboard', 'zh-CN').length).toBeGreaterThan(0);
      expect(missileLines('keyboard', 'en')).toEqual([]);
    });

    it('names the missile control on each page: the M key, the MSL button', () => {
      createMenu('desktop');
      openHowTo();
      const keys = Array.from(panelOf('keyboard').querySelectorAll('kbd')).map((key) =>
        (key.textContent ?? '').trim()
      );
      expect(keys).toContain('M');
      click(tab('touch'));
      expect(readableText(panelOf('touch'))).toMatch(/\bMSL\b/);
    });
  });

  describe('content', () => {
    it.each(LOCALES)('the keyboard page lists the flight and weapon keys (%s)', (locale) => {
      setLocale(locale);
      createMenu('desktop');
      openHowTo();
      const keys = Array.from(panelOf('keyboard').querySelectorAll('kbd')).map((key) =>
        (key.textContent ?? '').trim()
      );
      for (const key of ['W', 'S', 'A', 'D', 'Q', 'E', 'Shift', 'M', 'F', 'G', 'V', 'Tab', 'Esc']) {
        expect(keys, key).toContain(key);
      }
      expect(keys).toContain(locale === 'en' ? 'Space' : '空格');
    });

    it.each(LOCALES)(
      'the touch page describes the layout in words, not only a picture (%s)',
      (locale) => {
        setLocale(locale);
        createMenu('touch');
        openHowTo();
        const panel = panelOf('touch');
        const picture = panel.querySelector('[role="img"], img, svg');
        expect(picture, 'a layout diagram').not.toBeNull();
        const alternative =
          picture?.getAttribute('aria-label') ?? picture?.getAttribute('alt') ?? '';
        expect(alternative).toMatch(locale === 'en' ? /stick/i : /摇杆/);
        expect(readableText(panel)).toMatch(locale === 'en' ? /FIRE/ : /开火/);
        expect(readableText(panel)).toMatch(locale === 'en' ? /BOOST/ : /加速/);
      }
    );

    it('carries no emoji', () => {
      createMenu();
      const sheet = openHowTo();
      click(tab('touch'));
      expect(sheet.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
    });
  });

  describe('language switch while it is open', () => {
    it('stays open on the tab the player chose and relabels everything', () => {
      createMenu('desktop');
      const sheet = openHowTo();
      click(tab('touch'));

      setLocale('zh-CN');

      expect(isDialogShowing(HOWTO_SHEET)).toBe(true);
      expectShowing('touch');
      expect(readableText(tab('touch'))).toBe('触屏');
      expect(readableText(tab('keyboard'))).toBe('键盘');
      const heading = document.getElementById(sheet.getAttribute('aria-labelledby') ?? '');
      expect(readableText(heading)).toBe('操作说明');
      expect(readableText(panelOf('touch'))).toContain('左手拇指');
    });

    it('keeps focus on the selected tab', () => {
      createMenu('desktop');
      openHowTo();
      tab('keyboard').focus();
      press('ArrowRight');
      expect(document.activeElement).toBe(tab('touch'));

      setLocale('zh-CN');

      expect(document.activeElement).toBe(tab('touch'));
      expect((document.activeElement as HTMLElement).isConnected).toBe(true);
      press('ArrowRight');
      expect(document.activeElement, 'the arrow keys still work afterwards').toBe(tab('keyboard'));
      expectShowing('keyboard');
    });

    it('does not duplicate the tabs or the panels', () => {
      createMenu();
      const sheet = openHowTo();
      setLocale('zh-CN');
      setLocale('en');
      setLocale('zh-CN');
      expect(sheet.querySelectorAll('[role="tablist"]')).toHaveLength(1);
      expect(sheet.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(sheet.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
      expect(document.querySelectorAll('#howto-tab-keyboard')).toHaveLength(1);
    });
  });
});
