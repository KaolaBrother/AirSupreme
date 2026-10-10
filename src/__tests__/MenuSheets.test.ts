import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadStartFlowSettings } from '@/core/SessionSettings';
import { setLocale } from '@/i18n';
import { StartMenu } from '@/ui/StartMenu';
import { LOCALES, resetLocale } from './i18nTestUtils';
import {
  CONFIRM_SHEET,
  HOWTO_SHEET,
  SETTINGS_SHEET,
  byId,
  click,
  finishSheetTransitions,
  isDialogShowing,
  isInert,
  isOperable,
  isShown,
  pendingTimers,
  prepareMenuEnvironment,
  press,
  rawSave,
  readableText,
  resetMenuEnvironment,
  seedCheckpoint,
  showingDialogs,
  stubMatchMedia,
  useMenuFakeTimers,
  userClick,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 7：面板的共同行为（MenuSheet：设置、操作说明、新战役确认框）。
 *
 * 同一时刻只开一张；打开时是对话框语义（role=dialog、aria-modal、由标题命名）；
 * 焦点移进面板并被圈住（Tab / Shift+Tab 首尾相接）；Esc 与关闭按钮都能关；
 * 关闭后焦点回到打开它的那个控件；面板开着时标题画面的动作是 inert 的。
 */

interface SheetSpec {
  name: string;
  id: string;
  opener: string;
  needsSave: boolean;
  heading: { en: string; zh: string };
}

const SHEETS: readonly SheetSpec[] = [
  {
    name: 'Settings',
    id: SETTINGS_SHEET,
    opener: 'settings-btn',
    needsSave: false,
    heading: { en: 'Settings', zh: '设置' },
  },
  {
    name: 'How to Play',
    id: HOWTO_SHEET,
    opener: 'howto-btn',
    needsSave: false,
    heading: { en: 'How to Play', zh: '操作说明' },
  },
  {
    name: 'New Campaign confirmation',
    id: CONFIRM_SHEET,
    opener: 'start-btn',
    needsSave: true,
    heading: { en: 'Replace your saved campaign?', zh: '覆盖当前的战役存档？' },
  },
];

const TITLE_ACTIONS = ['continue-btn', 'start-btn', 'preview-btn', 'settings-btn', 'howto-btn'];

/** 面板里此刻能用 Tab 走到的控件，按文档顺序（独立于实现的算法：能操作 + tabindex 不为负） */
function tabStops(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')
  ).filter(
    (node) =>
      node.tabIndex >= 0 &&
      isShown(node) &&
      !isInert(node) &&
      (node as HTMLButtonElement).disabled !== true
  );
}

/** 面板右上角的关闭按钮：不属于面板正文动作的那一个，名字是“关闭…”或“取消” */
function closeButton(dialog: HTMLElement): HTMLButtonElement {
  const button = Array.from(dialog.querySelectorAll('button')).find((candidate) =>
    /^(Close|Cancel|关闭|取消)/.test(candidate.getAttribute('aria-label') ?? '')
  );
  expect(button, `a close button in #${dialog.id}`).toBeDefined();
  return button as HTMLButtonElement;
}

describe('sheets in general (batch X5, spec 7)', () => {
  let menu: StartMenu | null = null;
  let onStart: ReturnType<typeof vi.fn>;
  let onContinue: ReturnType<typeof vi.fn>;

  function createMenu(spec?: SheetSpec): StartMenu {
    if (spec?.needsSave) {
      seedCheckpoint();
    }
    menu = new StartMenu();
    menu.setOnStart(onStart);
    menu.setOnContinue(onContinue);
    return menu;
  }

  function open(spec: SheetSpec): HTMLElement {
    click(spec.opener);
    expect(isDialogShowing(spec.id), `${spec.name} is showing`).toBe(true);
    return byId(spec.id);
  }

  beforeEach(() => {
    prepareMenuEnvironment();
    useMenuFakeTimers();
    onStart = vi.fn();
    onContinue = vi.fn();
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    resetLocale();
    resetMenuEnvironment();
  });

  it('no sheet is showing on a fresh title screen', () => {
    seedCheckpoint();
    createMenu();
    expect(showingDialogs()).toEqual([]);
    for (const id of TITLE_ACTIONS) {
      expect(isInert(byId(id)), `#${id}`).toBe(false);
    }
  });

  describe.each(SHEETS)('$name', (spec) => {
    describe('dialog semantics', () => {
      it('is a modal dialog while open', () => {
        createMenu(spec);
        const dialog = open(spec);
        expect(dialog.getAttribute('role')).toMatch(/^(alert)?dialog$/);
        expect(dialog.getAttribute('aria-modal')).toBe('true');
      });

      it.each(LOCALES)('is labelled by its own heading (%s)', (locale) => {
        setLocale(locale);
        createMenu(spec);
        const dialog = open(spec);
        const heading = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
        expect(heading, 'aria-labelledby points at an element').not.toBeNull();
        expect(dialog.contains(heading)).toBe(true);
        expect(readableText(heading)).toBe(locale === 'en' ? spec.heading.en : spec.heading.zh);
      });

      it('has a close button with a name in both languages', () => {
        createMenu(spec);
        const dialog = open(spec);
        const english = closeButton(dialog).getAttribute('aria-label');
        expect(english).toMatch(/\S/);
        setLocale('zh-CN');
        const chinese = closeButton(byId(spec.id)).getAttribute('aria-label');
        expect(chinese).toMatch(/[一-鿿]/);
        expect(chinese).not.toBe(english);
      });

      it('is not exposed at all before it is opened', () => {
        createMenu(spec);
        expect(isShown(document.getElementById(spec.id))).toBe(false);
      });
    });

    describe('focus', () => {
      it('moves into the sheet when it opens', () => {
        createMenu(spec);
        byId(spec.opener).focus();
        const dialog = open(spec);
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      it('Tab on the last control wraps to the first', () => {
        createMenu(spec);
        const dialog = open(spec);
        const stops = tabStops(dialog);
        expect(stops.length).toBeGreaterThan(1);
        stops[stops.length - 1].focus();

        const event = press('Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[0]);
      });

      it('Shift+Tab on the first control wraps to the last', () => {
        createMenu(spec);
        const dialog = open(spec);
        const stops = tabStops(dialog);
        stops[0].focus();

        const event = press('Tab', { shiftKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[stops.length - 1]);
      });

      it('leaves Tab between two controls inside the sheet to the browser', () => {
        createMenu(spec);
        const dialog = open(spec);
        const stops = tabStops(dialog);
        stops[0].focus();

        const forward = press('Tab');
        expect(forward.defaultPrevented, 'first → second is a native move').toBe(false);

        stops[stops.length - 1].focus();
        const backward = press('Tab', { shiftKey: true });
        expect(backward.defaultPrevented, 'last → previous is a native move').toBe(false);
      });

      it('pulls focus back in if it ends up outside while the sheet is open', () => {
        createMenu(spec);
        const dialog = open(spec);
        const stops = tabStops(dialog);
        (document.activeElement as HTMLElement).blur();

        const forward = press('Tab', {}, document.body);
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[0]);

        (document.activeElement as HTMLElement).blur();
        const backward = press('Tab', { shiftKey: true }, document.body);
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[stops.length - 1]);
      });

      it('a full lap of Tab never reaches a title action', () => {
        createMenu(spec);
        const dialog = open(spec);
        const stops = tabStops(dialog);
        for (const shiftKey of [false, true]) {
          for (const stop of stops) {
            stop.focus();
            press('Tab', { shiftKey });
            expect(dialog.contains(document.activeElement)).toBe(true);
          }
        }
      });
    });

    describe('closing', () => {
      const WAYS: ReadonlyArray<readonly [string, (dialog: HTMLElement) => void]> = [
        ['Escape', () => void press('Escape')],
        ['the close button', (dialog) => click(closeButton(dialog))],
      ];

      it.each(WAYS)(
        '%s closes it and returns focus to the control that opened it',
        (_way, close) => {
          createMenu(spec);
          const opener = byId(spec.opener);
          opener.focus();
          const dialog = open(spec);

          close(dialog);

          expect(document.activeElement, 'focus is back on the opener').toBe(byId(spec.opener));
          expect(isInert(byId(spec.opener)), 'the title is usable again').toBe(false);
          finishSheetTransitions();
          expect(isDialogShowing(spec.id)).toBe(false);
          expect(showingDialogs()).toEqual([]);
          expect(onStart).not.toHaveBeenCalled();
          expect(onContinue).not.toHaveBeenCalled();
        }
      );

      it('Escape is consumed by the sheet', () => {
        createMenu(spec);
        open(spec);
        expect(press('Escape').defaultPrevented).toBe(true);
      });

      it('Escape works from any control inside the sheet', () => {
        createMenu(spec);
        const dialog = open(spec);
        for (const stop of tabStops(dialog).slice(0, 6)) {
          if (!isDialogShowing(spec.id)) {
            click(spec.opener);
          }
          stop.focus();
          press('Escape');
          finishSheetTransitions();
          expect(isDialogShowing(spec.id)).toBe(false);
        }
        expect(onStart).not.toHaveBeenCalled();
      });

      it('a second Escape after it closed does nothing', () => {
        createMenu(spec);
        open(spec);
        press('Escape');
        finishSheetTransitions();

        const second = press('Escape');

        expect(second.defaultPrevented).toBe(false);
        expect(isShown(byId('start-menu'))).toBe(true);
        expect(showingDialogs()).toEqual([]);
        expect(onStart).not.toHaveBeenCalled();
      });

      it('closes at once, with no transition, under prefers-reduced-motion', () => {
        stubMatchMedia({ reducedMotion: true });
        createMenu(spec);
        open(spec);

        press('Escape');

        expect(isDialogShowing(spec.id)).toBe(false);
        expect(pendingTimers()).toBe(0);
      });

      it('opening and closing changes no setting and no save', () => {
        createMenu(spec);
        const settings = loadStartFlowSettings();
        const save = rawSave();
        const dialog = open(spec);

        click(closeButton(dialog));
        finishSheetTransitions();

        expect(loadStartFlowSettings()).toEqual(settings);
        expect(rawSave()).toBe(save);
      });
    });

    describe('the title screen behind it', () => {
      it('is inert while the sheet is open and comes back when it closes', () => {
        seedCheckpoint();
        createMenu();
        open(spec);
        for (const id of TITLE_ACTIONS) {
          expect(isInert(byId(id)), `#${id} while open`).toBe(true);
          expect(isOperable(byId(id)), `#${id} while open`).toBe(false);
        }

        press('Escape');

        for (const id of TITLE_ACTIONS) {
          expect(isInert(byId(id)), `#${id} after close`).toBe(false);
          expect(isOperable(byId(id)), `#${id} after close`).toBe(true);
        }
      });

      it('one at a time: no other title action can open a second sheet or start a run', () => {
        seedCheckpoint();
        createMenu();
        open(spec);

        for (const id of TITLE_ACTIONS) {
          expect(userClick(id), `#${id} cannot be reached`).toBe(false);
        }
        press('Enter', {}, document.body);

        expect(showingDialogs().map((dialog) => dialog.id)).toEqual([spec.id]);
        expect(onStart).not.toHaveBeenCalled();
        expect(onContinue).not.toHaveBeenCalled();
        expect(document.getElementById('model-preview')).toBeNull();
      });

      it('arrow keys do not move focus onto the title actions', () => {
        createMenu(spec);
        const dialog = open(spec);
        for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
          press(key);
          expect(dialog.contains(document.activeElement), key).toBe(true);
        }
      });
    });

    describe('rapid open and close', () => {
      it('reopening before the closing transition has ended leaves it open', () => {
        createMenu(spec);
        open(spec);
        press('Escape');
        vi.advanceTimersByTime(60);

        click(spec.opener);
        vi.advanceTimersByTime(2000);

        expect(isDialogShowing(spec.id), 'the stale hide must not win').toBe(true);
        expect(isInert(byId(spec.opener))).toBe(true);
        expect(byId(spec.id).contains(document.activeElement)).toBe(true);
      });

      it('ten quick open / close rounds end closed, with the title usable', () => {
        createMenu(spec);
        for (let round = 0; round < 10; round++) {
          click(spec.opener);
          press('Escape');
        }
        vi.advanceTimersByTime(2000);

        expect(isDialogShowing(spec.id)).toBe(false);
        expect(isInert(byId(spec.opener))).toBe(false);
        expect(document.activeElement).toBe(byId(spec.opener));
        expect(pendingTimers(), 'no transition timer left running').toBeLessThanOrEqual(1);
        expect(onStart).not.toHaveBeenCalled();
      });

      it('ten quick rounds that end open leave exactly this sheet open', () => {
        createMenu(spec);
        for (let round = 0; round < 10; round++) {
          click(spec.opener);
          press('Escape');
        }
        click(spec.opener);
        vi.advanceTimersByTime(2000);

        expect(showingDialogs().map((dialog) => dialog.id)).toEqual([spec.id]);
      });

      it('a double tap on the opener opens it once', () => {
        createMenu(spec);
        const opener = byId(spec.opener);
        opener.click();
        // 第二下：面板已经盖住标题画面，点不到
        expect(userClick(opener)).toBe(false);
        expect(showingDialogs().map((dialog) => dialog.id)).toEqual([spec.id]);
      });
    });

    describe('with the menu lifecycle', () => {
      it('hide() closes it; show() comes back with a usable title and no sheet', () => {
        const startMenu = createMenu(spec);
        open(spec);

        startMenu.hide();
        vi.advanceTimersByTime(1000);
        startMenu.show();

        expect(isDialogShowing(spec.id)).toBe(false);
        expect(showingDialogs()).toEqual([]);
        for (const id of TITLE_ACTIONS) {
          expect(isInert(byId(id)), `#${id}`).toBe(false);
        }
        // 再开一次仍然正常
        open(spec);
        expect(byId(spec.id).contains(document.activeElement)).toBe(true);
      });

      it('dispose() while open leaves nothing behind', () => {
        const startMenu = createMenu(spec);
        open(spec);

        startMenu.dispose();
        menu = null;

        expect(document.getElementById(spec.id)).toBeNull();
        expect(() => press('Escape', {}, document.body)).not.toThrow();
        expect(() => press('Tab', {}, document.body)).not.toThrow();
        expect(pendingTimers()).toBe(0);
      });

      it('stays open and keeps focus inside across a language change', () => {
        createMenu(spec);
        const dialog = open(spec);

        setLocale('zh-CN');

        expect(isDialogShowing(spec.id)).toBe(true);
        expect(dialog.contains(document.activeElement)).toBe(true);
        expect((document.activeElement as HTMLElement).isConnected).toBe(true);
        expect(isInert(byId(spec.opener))).toBe(true);

        press('Escape');
        expect(document.activeElement, 'focus returns to the relabelled opener').toBe(
          byId(spec.opener)
        );
      });
    });
  });

  describe('moving between sheets', () => {
    it('Settings then How to Play: each closes before the next opens', () => {
      createMenu();
      click('settings-btn');
      press('Escape');
      click('howto-btn');
      finishSheetTransitions();

      expect(showingDialogs().map((dialog) => dialog.id)).toEqual([HOWTO_SHEET]);
      press('Escape');
      expect(document.activeElement).toBe(byId('howto-btn'));
    });

    it('focus goes back to whichever action opened the sheet this time', () => {
      seedCheckpoint();
      createMenu();
      for (const spec of SHEETS) {
        click(spec.opener);
        press('Escape');
        expect(document.activeElement?.id, spec.name).toBe(spec.opener);
        finishSheetTransitions();
      }
    });

    it('Tab on the bare title screen is left to the browser', () => {
      createMenu();
      byId('start-btn').focus();
      expect(press('Tab').defaultPrevented).toBe(false);
      expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(false);
    });
  });

  describe('Settings: the focus loop follows what is reachable', () => {
    it('skips the collapsed Advanced controls and includes them once expanded', () => {
      createMenu();
      click('settings-btn');
      const dialog = byId(SETTINGS_SHEET);
      const toggle = byId('advanced-toggle');

      // 收起：圈的最后一站是“高级”开关本身
      expect(tabStops(dialog)[tabStops(dialog).length - 1]).toBe(toggle);
      toggle.focus();
      press('Tab');
      expect(document.activeElement).toBe(tabStops(dialog)[0]);

      // 展开：最后一站在高级组里
      click(toggle);
      const expanded = tabStops(dialog);
      const last = expanded[expanded.length - 1];
      expect(byId('testscore-row').contains(last)).toBe(true);
      toggle.focus();
      expect(press('Tab').defaultPrevented, 'the toggle is no longer the last stop').toBe(false);
      last.focus();
      press('Tab');
      expect(document.activeElement).toBe(expanded[0]);

      press('Tab', { shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  });
});
