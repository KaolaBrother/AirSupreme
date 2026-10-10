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

  /** 键盘页的一行：按键帽（dt 里的 kbd）与它的说明（dd）。按语义结构找，不靠样式类名 */
  interface KeyRow {
    caps: string[];
    action: string;
    /** 按键帽与说明连在一起读到的文字 */
    text: string;
  }

  function keyRows(): KeyRow[] {
    return Array.from(panelOf('keyboard').querySelectorAll('dd')).map((action) => {
      const term = action.previousElementSibling;
      expect(term?.tagName, 'each description follows its keys').toBe('DT');
      const caps = Array.from(term?.querySelectorAll('kbd') ?? []).map((cap) =>
        (cap.textContent ?? '').trim()
      );
      const actionText = readableText(action).trim();
      return { caps, action: actionText, text: `${readableText(term).trim()} ${actionText}` };
    });
  }

  /** 说明里提到某件事的那些行（至少一行） */
  function rowsAbout(topic: Readonly<Record<Locale, RegExp>>, locale: Locale): KeyRow[] {
    const rows = keyRows().filter((row) => topic[locale].test(row.action));
    expect(rows.length, `a row about ${String(topic.en)}`).toBeGreaterThan(0);
    return rows;
  }

  function textOf(rows: readonly KeyRow[]): string {
    return rows.map((row) => row.text).join(' ');
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
      for (const key of ['W', 'S', 'A', 'D', 'Q', 'E', 'M', 'F', 'G', 'V', 'Tab', 'Esc']) {
        expect(keys, key).toContain(key);
      }
      expect(keys).toContain(locale === 'en' ? 'Space' : '空格');
      // 分左右的修饰键：键帽上写明是哪一边，两种语言同一写法
      for (const key of ['L Shift', 'L Ctrl', 'R Shift']) {
        expect(keys, key).toContain(key);
      }
      expect(
        keys.filter((key) => /shift|ctrl/i.test(key)),
        'no Shift or Ctrl cap is left without its side'
      ).toEqual(['L Shift', 'L Ctrl', 'R Shift']);
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

  /**
   * 文字与实际按键一致（src/core/Input/InputHandler.ts、src/ui/RadarMinimap.ts）：
   * 加速 = 左 Shift / 左 Ctrl；导弹 = M / 右 Shift；暂停 = Esc / P；升级 = U；关卡地图 = N。
   * 加速与导弹两行的键帽已定稿（"L Shift" / "L Ctrl"、"M" / "R Shift"，两种语言相同），按原样钉住；
   * 其余只查说了什么，不查措辞与排版。
   */
  describe('the keys it names are the keys the game listens to', () => {
    const LEFT_SHIFT: Readonly<Record<Locale, RegExp>> = {
      en: /\b(?:left|l)[\s.-]*shift\b/i,
      'zh-CN': /左(?:侧|边)?\s*shift|\bl[\s.-]*shift\b/i,
    };
    const RIGHT_SHIFT: Readonly<Record<Locale, RegExp>> = {
      en: /\b(?:right|r)[\s.-]*shift\b/i,
      'zh-CN': /右(?:侧|边)?\s*shift|\br[\s.-]*shift\b/i,
    };
    const BOOST: Readonly<Record<Locale, RegExp>> = { en: /boost/i, 'zh-CN': /加速/ };
    const MISSILE: Readonly<Record<Locale, RegExp>> = { en: /missile/i, 'zh-CN': /导弹/ };
    const PAUSE: Readonly<Record<Locale, RegExp>> = { en: /pause menu/i, 'zh-CN': /暂停菜单/ };
    const UPGRADES: Readonly<Record<Locale, RegExp>> = { en: /^upgrades?\b/i, 'zh-CN': /^升级/ };
    const LEVEL_MAP: Readonly<Record<Locale, RegExp>> = { en: /\bmap\b/i, 'zh-CN': /地图/ };
    const AIM_ASSIST: Readonly<Record<Locale, RegExp>> = { en: /aim assist/i, 'zh-CN': /辅助瞄准/ };

    function openKeyboardPage(locale: Locale): void {
      setLocale(locale);
      createMenu('desktop');
      openHowTo();
      expectShowing('keyboard');
    }

    it.each(LOCALES)('boost: the key caps read "L Shift" and "L Ctrl" (%s)', (locale) => {
      openKeyboardPage(locale);

      const boost = rowsAbout(BOOST, locale);

      expect(boost).toHaveLength(1);
      // 只写 "Shift" 不够：右 Shift 发射导弹，玩家得知道是哪一个
      expect(boost[0].caps).toEqual(['L Shift', 'L Ctrl']);
      expect(textOf(boost)).not.toMatch(RIGHT_SHIFT[locale]);
    });

    it.each(LOCALES)(
      'boost: the description spells the side out in words as well (%s)',
      (locale) => {
        openKeyboardPage(locale);

        const [boost] = rowsAbout(BOOST, locale);

        // 键帽上只有一个 “L”：说明里把“左”写出来，并且 Shift 与 Ctrl 都提到
        expect(boost.action).toMatch(locale === 'en' ? /\bleft\s+shift\b/i : /左\s*shift/i);
        expect(boost.action).toMatch(/\b(?:ctrl|control)\b/i);
        expect(boost.action).not.toMatch(locale === 'en' ? /\bright\b/i : /右/);
      }
    );

    it.each(LOCALES)('missile: the key caps read "M" and "R Shift" (%s)', (locale) => {
      openKeyboardPage(locale);

      const missile = rowsAbout(MISSILE, locale);

      expect(missile).toHaveLength(1);
      expect(missile[0].caps).toEqual(['M', 'R Shift']);
      expect(textOf(missile)).not.toMatch(LEFT_SHIFT[locale]);
    });

    it.each(LOCALES)(
      'missile: the description spells the side out in words as well (%s)',
      (locale) => {
        openKeyboardPage(locale);

        const [missile] = rowsAbout(MISSILE, locale);

        expect(missile.action).toMatch(locale === 'en' ? /\bright\s+shift\b/i : /右\s*shift/i);
        expect(missile.action).not.toMatch(locale === 'en' ? /\bleft\b/i : /左/);
      }
    );

    it.each(LOCALES)('no other row hands a Shift key a second job (%s)', (locale) => {
      openKeyboardPage(locale);

      const shiftRows = keyRows().filter((row) => /shift/i.test(row.text));

      expect(shiftRows.length).toBeGreaterThan(0);
      for (const row of shiftRows) {
        expect(BOOST[locale].test(row.action) || MISSILE[locale].test(row.action), row.text).toBe(
          true
        );
      }
    });

    it.each(LOCALES)('pause: Esc and P both open the pause menu (%s)', (locale) => {
      openKeyboardPage(locale);

      const pause = rowsAbout(PAUSE, locale);

      expect(pause.some((row) => row.caps.includes('Esc') && row.caps.includes('P'))).toBe(true);
    });

    it.each(LOCALES)('upgrades are on U, the level map on N (%s)', (locale) => {
      openKeyboardPage(locale);

      expect(rowsAbout(UPGRADES, locale).some((row) => row.caps.includes('U'))).toBe(true);
      const map = rowsAbout(LEVEL_MAP, locale);
      expect(map.some((row) => row.caps.includes('N'))).toBe(true);
      // 关卡地图不在升级那一行，升级也不在地图那一行
      expect(map.some((row) => row.caps.includes('U'))).toBe(false);
    });

    it.each(LOCALES)('no key cap is listed for two different actions (%s)', (locale) => {
      openKeyboardPage(locale);

      const seen = new Map<string, string>();
      for (const row of keyRows()) {
        for (const cap of row.caps) {
          expect(seen.get(cap), `"${cap}" is listed for "${row.action}" as well`).toBeUndefined();
          seen.set(cap, row.action);
        }
      }
      expect(seen.size).toBeGreaterThan(0);
    });

    it.each(LOCALES)('every row has at least one key and says what it does (%s)', (locale) => {
      openKeyboardPage(locale);

      const rows = keyRows();

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.caps.length, row.text).toBeGreaterThan(0);
        expect(row.caps.every((cap) => cap.length > 0)).toBe(true);
        expect(row.action).not.toBe('');
      }
    });

    it.each(LOCALES)('aim assist is explained on the touch page only (%s)', (locale) => {
      // 机炮辅助瞄准只在触控设备上启用（GameCoordinator 用 GameConfig.isMobile 开关）
      setLocale(locale);
      createMenu('touch');
      openHowTo();
      expectShowing('touch');

      expect(readableText(panelOf('touch'))).toMatch(AIM_ASSIST[locale]);

      // 键盘页不许诺它：桌面端没有这个辅助
      click(tab('keyboard'));
      expectShowing('keyboard');
      expect(readableText(panelOf('keyboard'))).toMatch(BOOST[locale]);
      expect(readableText(panelOf('keyboard'))).not.toMatch(AIM_ASSIST[locale]);
    });

    it.each(LOCALES)('the touch page says the radar opens the level map (%s)', (locale) => {
      setLocale(locale);
      createMenu('touch');
      openHowTo();

      // 用文字说，不只画在示意图里：示意图（role="img"）里面的字读屏读不到
      const sentences = Array.from(panelOf('touch').querySelectorAll<HTMLElement>('*'))
        .filter((node) => node.children.length === 0 && node.closest('svg, [role="img"]') === null)
        .map((node) => (node.textContent ?? '').trim())
        .filter((text) => (locale === 'en' ? /radar/i : /雷达/).test(text));

      expect(sentences.some((text) => LEVEL_MAP[locale].test(text))).toBe(true);
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
