import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SAVE_KEY,
  clearCampaignCheckpoint,
  loadCampaignCheckpoint,
} from '@/core/save/SaveSystem';
import { saveStartFlowSettings } from '@/core/SessionSettings';
import { setLocale } from '@/i18n';
import { StartMenu, type GameSettings } from '@/ui/StartMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';
import {
  CHECKPOINT_TEXT,
  CONFIRM_SHEET,
  byId,
  click,
  finishSheetTransitions,
  isDialogShowing,
  isInert,
  isShown,
  prepareMenuEnvironment,
  press,
  radioIn,
  rawSave,
  readableText,
  resetMenuEnvironment,
  seedCheckpoint,
  showingDialogs,
  stubMatchMedia,
  useMenuFakeTimers,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 2：“新战役”确认框。
 *
 * 当且仅当 存在检查点 且 选的是正常模式 时才出现（Boss 模式从不存档，直接开始，存档原样留着）。
 * 初始焦点在“保留存档”上。取消 / Esc / 关闭：存档逐字节不变，什么也不启动。
 * 确认：用当前设置开始一局。框里写明会丢掉的是哪一份存档（章节 / 波次）。
 */

const COPY = {
  cancel: { en: 'Keep my save', zh: '保留存档' },
  confirm: { en: 'Start new campaign', zh: '开始新战役' },
} as const;

describe('New Campaign confirmation (batch X5, spec 2)', () => {
  let menu: StartMenu | null = null;
  let onStart: ReturnType<typeof vi.fn<(settings: GameSettings) => void>>;
  let onContinue: ReturnType<typeof vi.fn>;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    menu.setOnStart(onStart);
    menu.setOnContinue(onContinue);
    return menu;
  }

  function confirmShowing(): boolean {
    return isDialogShowing(CONFIRM_SHEET);
  }

  /** 设置 → 高级 → 游戏模式，再用 Esc 关掉设置面板 */
  function chooseGameMode(mode: 'normal' | 'boss'): void {
    click('settings-btn');
    click('advanced-toggle');
    click(radioIn('mode-row', mode === 'boss' ? /Boss/ : /^(Normal|普通模式)$/));
    press('Escape');
    finishSheetTransitions();
    expect(showingDialogs(), 'settings closed again').toEqual([]);
  }

  beforeEach(() => {
    prepareMenuEnvironment();
    useMenuFakeTimers();
    onStart = vi.fn<(settings: GameSettings) => void>();
    onContinue = vi.fn();
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    resetLocale();
    resetMenuEnvironment();
  });

  describe('when it appears: a checkpoint exists AND the mode is normal', () => {
    it('checkpoint + normal mode: asks first and starts nothing', () => {
      const raw = seedCheckpoint();
      createMenu();

      click('start-btn');

      expect(confirmShowing()).toBe(true);
      expect(onStart).not.toHaveBeenCalled();
      expect(onContinue).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
      expect(isShown(byId('start-menu')), 'the menu is still up').toBe(true);
    });

    it('no checkpoint + normal mode: starts directly', () => {
      createMenu();
      click('start-btn');
      expect(confirmShowing()).toBe(false);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('checkpoint + boss mode: starts directly and leaves the save byte-for-byte alone', () => {
      const raw = seedCheckpoint();
      saveStartFlowSettings({ gameMode: 'boss' });
      createMenu();

      click('start-btn');

      expect(confirmShowing()).toBe(false);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart.mock.calls[0][0].gameMode).toBe('boss');
      expect(rawSave()).toBe(raw);
      vi.advanceTimersByTime(2000);
      expect(rawSave(), 'still there after the launch transition').toBe(raw);
    });

    it('no checkpoint + boss mode: starts directly', () => {
      saveStartFlowSettings({ gameMode: 'boss' });
      createMenu();
      click('start-btn');
      expect(confirmShowing()).toBe(false);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('switching to boss mode with a save present skips the question and keeps the save', () => {
      const raw = seedCheckpoint();
      createMenu();
      chooseGameMode('boss');

      click('start-btn');

      expect(confirmShowing()).toBe(false);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart.mock.calls[0][0].gameMode).toBe('boss');
      expect(rawSave()).toBe(raw);
    });

    it('switching back to normal mode brings the question back', () => {
      const raw = seedCheckpoint();
      saveStartFlowSettings({ gameMode: 'boss' });
      createMenu();
      chooseGameMode('normal');

      click('start-btn');

      expect(confirmShowing()).toBe(true);
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it('a checkpoint written after the menu rendered (another tab) is still protected', () => {
      createMenu();
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);
      const raw = seedCheckpoint({ level: 4, wave: 1 });

      click('start-btn');

      expect(confirmShowing()).toBe(true);
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
      expect(readableText(byId(CONFIRM_SHEET))).toContain('Ch. 4');
    });

    it('a checkpoint that vanished after the menu rendered needs no question', () => {
      seedCheckpoint();
      createMenu();
      clearCampaignCheckpoint();

      click('start-btn');

      expect(confirmShowing()).toBe(false);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('a checkpoint that turned corrupt needs no question: there is nothing left to lose', () => {
      seedCheckpoint();
      createMenu();
      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, '{"version":1,');

      click('start-btn');

      expect(confirmShowing()).toBe(false);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('level select and test score do not bypass the question', () => {
      const raw = seedCheckpoint();
      saveStartFlowSettings({ startLevel: 7, testScore: 20000 });
      createMenu();

      click('start-btn');

      expect(confirmShowing()).toBe(true);
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });
  });

  describe('what it says', () => {
    it.each(LOCALES)('offers "Keep my save" and "Start new campaign" (%s)', (locale) => {
      seedCheckpoint();
      setLocale(locale);
      createMenu();
      click('start-btn');

      expect(readableText(byId('new-campaign-cancel'))).toBe(textIn(COPY.cancel, locale));
      expect(readableText(byId('new-campaign-confirm-btn'))).toBe(textIn(COPY.confirm, locale));
    });

    it.each(LOCALES)('shows the saved chapter and wave that would be lost (%s)', (locale) => {
      seedCheckpoint();
      setLocale(locale);
      createMenu();
      click('start-btn');

      expect(readableText(byId(CONFIRM_SHEET))).toContain(textIn(CHECKPOINT_TEXT, locale));
    });

    it('shows the position stored right now, not the one from when the menu rendered', () => {
      seedCheckpoint({ level: 2, wave: 0 });
      createMenu();
      seedCheckpoint({ level: 9, wave: 4, checkpoint: 'boss' });

      click('start-btn');

      const text = readableText(byId(CONFIRM_SHEET));
      expect(text).toContain('Ch. 9');
      expect(text).toContain('Boss');
      expect(text).not.toContain('Ch. 2');
    });

    it('is a modal dialog labelled by its heading and described by its warning', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');

      const dialog = byId(CONFIRM_SHEET);
      expect(dialog.getAttribute('role')).toMatch(/^(alert)?dialog$/);
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const heading = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
      expect(readableText(heading).length).toBeGreaterThan(0);
      const description = document.getElementById(dialog.getAttribute('aria-describedby') ?? '');
      expect(dialog.contains(description)).toBe(true);
      expect(readableText(description).length).toBeGreaterThan(0);
    });

    it('relabels in place when the language changes, staying open with focus where it was', () => {
      const raw = seedCheckpoint();
      createMenu();
      click('start-btn');
      expect(document.activeElement?.id).toBe('new-campaign-cancel');

      setLocale('zh-CN');

      expect(confirmShowing()).toBe(true);
      expect(readableText(byId('new-campaign-cancel'))).toBe(COPY.cancel.zh);
      expect(readableText(byId('new-campaign-confirm-btn'))).toBe(COPY.confirm.zh);
      expect(readableText(byId(CONFIRM_SHEET))).toContain(CHECKPOINT_TEXT.zh);
      expect(document.activeElement?.id).toBe('new-campaign-cancel');
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it('keeps focus on Start new campaign across a language change, without firing it', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      byId('new-campaign-confirm-btn').focus();

      setLocale('zh-CN');

      expect(document.activeElement?.id).toBe('new-campaign-confirm-btn');
      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe('initial focus', () => {
    it('is on Keep my save, so a stray Enter or Space cannot erase the campaign', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      expect(document.activeElement).toBe(byId('new-campaign-cancel'));
    });

    it('is on Keep my save every time it opens', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      byId('new-campaign-confirm-btn').focus();
      press('Escape');
      finishSheetTransitions();

      click('start-btn');

      expect(document.activeElement).toBe(byId('new-campaign-cancel'));
    });

    it('makes the title actions inert while it is open', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      for (const id of ['continue-btn', 'start-btn', 'preview-btn', 'settings-btn', 'howto-btn']) {
        expect(isInert(byId(id)), `#${id}`).toBe(true);
      }
    });
  });

  describe('backing out leaves the save byte-for-byte untouched and starts nothing', () => {
    const WAYS: ReadonlyArray<readonly [string, () => void]> = [
      ['Keep my save', () => click('new-campaign-cancel')],
      ['Escape', () => press('Escape')],
      ['Escape with focus on the confirm button', () => press('Escape')],
      [
        'the close button',
        () => {
          const close = Array.from(byId(CONFIRM_SHEET).querySelectorAll('button')).find(
            (button) =>
              button.id !== 'new-campaign-cancel' && button.id !== 'new-campaign-confirm-btn'
          );
          click(close ?? null);
        },
      ],
    ];

    it.each(WAYS)('%s', (name, backOut) => {
      const raw = seedCheckpoint();
      createMenu();
      click('start-btn');
      if (name.includes('confirm button')) {
        byId('new-campaign-confirm-btn').focus();
      }

      backOut();
      finishSheetTransitions();

      expect(confirmShowing()).toBe(false);
      expect(onStart).not.toHaveBeenCalled();
      expect(onContinue).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
      expect(isShown(byId('start-menu'))).toBe(true);
      expect(isInert(byId('start-btn')), 'the title is usable again').toBe(false);
      expect(document.activeElement, 'focus returns to New Campaign').toBe(byId('start-btn'));

      // 过场时长之后也没有任何东西启动
      vi.advanceTimersByTime(2000);
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
      expect(loadCampaignCheckpoint()).toMatchObject({ level: 6, wave: 2 });
    });

    it('clicking anywhere outside the dialog never starts a run or touches the save', () => {
      const raw = seedCheckpoint();
      createMenu();
      click('start-btn');
      const dialog = byId(CONFIRM_SHEET);

      // 对话框所在的层里、对话框之外的一切（遮罩）
      const outside = Array.from(dialog.parentElement?.children ?? []).filter(
        (node) => node !== dialog
      );
      for (const node of outside) {
        (node as HTMLElement).click();
      }
      vi.advanceTimersByTime(2000);

      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it('Continue still works after backing out', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      click('new-campaign-cancel');
      finishSheetTransitions();

      click('continue-btn');

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onContinue.mock.calls[0][0]).toMatchObject({ level: 6, wave: 2 });
      expect(onStart).not.toHaveBeenCalled();
    });

    it('asking, backing out and asking again any number of times never starts anything', () => {
      const raw = seedCheckpoint();
      createMenu();
      for (let round = 0; round < 5; round++) {
        click('start-btn');
        expect(confirmShowing()).toBe(true);
        press('Escape');
        // 有的轮次不等收起过渡走完就再点
        if (round % 2 === 0) {
          finishSheetTransitions();
        }
      }
      vi.advanceTimersByTime(2000);
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });
  });

  describe('keys that must not confirm', () => {
    it('Enter with the dialog open and focus lost does not start or continue anything', () => {
      const raw = seedCheckpoint();
      createMenu();
      click('start-btn');
      (document.activeElement as HTMLElement).blur();

      press('Enter', {}, document.body);

      expect(onStart).not.toHaveBeenCalled();
      expect(onContinue, 'the title primary action is behind the dialog').not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it.each(['Enter', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Tab', 'y', 'n'])(
      'the "%s" key on Keep my save does not start a run',
      (key) => {
        const raw = seedCheckpoint();
        createMenu();
        click('start-btn');

        press(key);

        expect(onStart).not.toHaveBeenCalled();
        expect(rawSave()).toBe(raw);
      }
    );

    it('Tab and Shift+Tab stay inside the dialog', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      const dialog = byId(CONFIRM_SHEET);

      for (const shiftKey of [false, true]) {
        for (let i = 0; i < 6; i++) {
          const before = document.activeElement;
          const event = press('Tab', { shiftKey });
          expect(dialog.contains(document.activeElement)).toBe(true);
          if (!event.defaultPrevented) {
            // 没有被接管的 Tab 由浏览器自己移到对话框里的下一个控件；jsdom 不会移动焦点
            expect(document.activeElement).toBe(before);
            break;
          }
        }
      }
    });
  });

  describe('confirming', () => {
    it('starts one run with the current settings and closes the dialog', () => {
      seedCheckpoint();
      saveStartFlowSettings({
        difficulty: 5,
        playerLives: 7,
        startLevel: 3,
        testScore: 5000,
        cameraMode: 'first-person',
        qualityPreset: 'balanced',
        tutorialEnabled: false,
        sfxVolume: 0.3,
        musicVolume: 0.1,
        voiceVolume: 0,
      });
      createMenu();
      click('start-btn');

      click('new-campaign-confirm-btn');

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart.mock.calls[0][0]).toEqual({
        difficulty: 5,
        playerLives: 7,
        startLevel: 3,
        testScore: 5000,
        cameraMode: 'first-person',
        qualityPreset: 'balanced',
        tutorialEnabled: false,
        sfxVolume: 0.3,
        musicVolume: 0.1,
        voiceVolume: 0,
        gameMode: 'normal',
        language: 'en',
      });
      expect(onContinue).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(confirmShowing()).toBe(false);
      expect(isShown(byId('start-menu')), 'the menu left the screen').toBe(false);
    });

    it('starts with a setting changed in this session', () => {
      seedCheckpoint();
      createMenu();
      click('settings-btn');
      click(radioIn('camera-row', 'First-person'));
      press('Escape');
      finishSheetTransitions();

      click('start-btn');
      click('new-campaign-confirm-btn');

      expect(onStart.mock.calls[0][0].cameraMode).toBe('first-person');
    });

    it('a double tap on Start new campaign starts one run', () => {
      seedCheckpoint();
      createMenu();
      click('start-btn');
      const confirm = byId('new-campaign-confirm-btn');

      confirm.click();
      confirm.click();
      vi.advanceTimersByTime(100);
      confirm.click();

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('does not delete the checkpoint itself: only the run that actually begins replaces it', () => {
      const raw = seedCheckpoint();
      createMenu();
      click('start-btn');
      click('new-campaign-confirm-btn');
      vi.advanceTimersByTime(2000);

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(rawSave(), 'a boot that fails after this point has lost nothing').toBe(raw);
    });

    it('under reduced motion: one run, menu gone at once', () => {
      stubMatchMedia({ reducedMotion: true });
      seedCheckpoint();
      createMenu();
      click('start-btn');
      expect(confirmShowing()).toBe(true);

      click('new-campaign-confirm-btn');

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(isShown(byId('start-menu'))).toBe(false);
      expect(confirmShowing()).toBe(false);
    });
  });

  describe('the dialog and the rest of the menu lifecycle', () => {
    it('hide() while it is open closes it without starting; show() comes back clean', () => {
      const raw = seedCheckpoint();
      const startMenu = createMenu();
      click('start-btn');

      startMenu.hide();
      vi.advanceTimersByTime(1000);
      startMenu.show();

      expect(confirmShowing()).toBe(false);
      expect(isInert(byId('start-btn'))).toBe(false);
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it('dispose() while it is open starts nothing and leaves the save alone', () => {
      const raw = seedCheckpoint();
      const startMenu = createMenu();
      click('start-btn');

      startMenu.dispose();
      menu = null;
      vi.advanceTimersByTime(2000);

      expect(document.getElementById(CONFIRM_SHEET)).toBeNull();
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it('Escape on the bare title screen does nothing at all', () => {
      const raw = seedCheckpoint();
      createMenu();

      const event = press('Escape', {}, document.body);
      vi.advanceTimersByTime(2000);

      expect(event.defaultPrevented).toBe(false);
      expect(showingDialogs()).toEqual([]);
      expect(isShown(byId('start-menu'))).toBe(true);
      expect(onStart).not.toHaveBeenCalled();
      expect(onContinue).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });
  });
});
