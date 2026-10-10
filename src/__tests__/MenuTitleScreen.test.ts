import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SAVE_KEY,
  clearCampaignCheckpoint,
  describeCheckpoint,
  loadCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import { START_MENU_STORAGE_KEY, saveStartFlowSettings } from '@/core/SessionSettings';
import { setLocale } from '@/i18n';
import { StartMenu, type GameSettings } from '@/ui/StartMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';
import {
  CHECKPOINT_TEXT,
  byId,
  click,
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
  useMenuFakeTimers,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 1 与 4：标题画面。
 *
 * 根节点 #start-menu；动作只有 继续战役（有有效检查点时才有，是主按钮，写明章节 / 波次、得分、难度、生命）、
 * 新战役（没有存档时它是主按钮）、机库、设置、操作说明。标题画面上没有任何设置控件。
 * 损坏 / 无效的存档等同没有存档。reloadFromStorage() 重新读取存档与设置。
 */

const LABELS = {
  continue: { en: 'Continue Campaign', zh: '继续战役' },
  newCampaign: { en: 'New Campaign', zh: '新战役' },
  hangar: { en: 'Hangar', zh: '机库' },
  settings: { en: 'Settings', zh: '设置' },
  howTo: { en: 'How to Play', zh: '操作说明' },
} as const;

const ACTION_IDS = ['continue-btn', 'start-btn', 'preview-btn', 'settings-btn', 'howto-btn'];

/** 标题画面上玩家看得见、点得到的动作，按文档顺序 */
function offeredActions(): string[] {
  return ACTION_IDS.map((id) => document.getElementById(id))
    .filter((button): button is HTMLElement => button !== null && isOperable(button))
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((button) => button.id);
}

describe('title screen (batch X5, spec 1 and 4)', () => {
  let menu: StartMenu | null = null;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  beforeEach(() => {
    prepareMenuEnvironment();
    useMenuFakeTimers();
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    resetLocale();
    resetMenuEnvironment();
  });

  describe('with no checkpoint', () => {
    it('mounts #start-menu, visible, with New Campaign first and no Continue', () => {
      createMenu();
      expect(isShown(byId('start-menu'))).toBe(true);
      expect(offeredActions()).toEqual(['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']);
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);
    });

    it.each(LOCALES)('labels the four actions in the interface language (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      expect(readableText(byId('start-btn'))).toContain(textIn(LABELS.newCampaign, locale));
      expect(readableText(byId('preview-btn'))).toBe(textIn(LABELS.hangar, locale));
      expect(readableText(byId('settings-btn'))).toBe(textIn(LABELS.settings, locale));
      expect(readableText(byId('howto-btn'))).toBe(textIn(LABELS.howTo, locale));
    });

    it('Enter with nothing focused activates New Campaign, the primary action', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      const event = press('Enter', {}, document.body);

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('ignores a held Enter (auto-repeat) that was not pressed on the menu', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      press('Enter', { repeat: true }, document.body);

      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe('with a valid checkpoint', () => {
    it('offers Continue Campaign first, then New Campaign and the rest', () => {
      seedCheckpoint();
      createMenu();
      expect(offeredActions()).toEqual([
        'continue-btn',
        'start-btn',
        'preview-btn',
        'settings-btn',
        'howto-btn',
      ]);
    });

    it.each(LOCALES)(
      'Continue names the chapter and wave, the score, the difficulty and the lives (%s)',
      (locale) => {
        seedCheckpoint({ score: 15_200, difficulty: 4, lives: 2 });
        setLocale(locale);
        createMenu();
        const save = loadCampaignCheckpoint() as CampaignSaveData;

        const text = readableText(byId('continue-btn'));
        expect(text).toContain(textIn(LABELS.continue, locale));
        expect(text).toContain(textIn(CHECKPOINT_TEXT, locale));
        expect(text).toContain(describeCheckpoint(save, locale));
        expect(text).toContain('15200');
        expect(text).toContain(locale === 'en' ? 'Hard' : '困难');
        expect(text).toMatch(locale === 'en' ? /Lives\s*2/ : /生命\s*2/);
      }
    );

    it.each([
      ['boss', { checkpoint: 'boss' as const, wave: 7 }, /Boss/, /Boss 战/],
      ['hangar', { checkpoint: 'hangar' as const, level: 7, wave: 0 }, /Hangar/, /机库整备/],
      ['level start', { checkpoint: 'level-start' as const, level: 2, wave: 0 }, /Wave 1/, /第1波/],
    ])('Continue describes a %s checkpoint', (_name, overrides, english, chinese) => {
      seedCheckpoint(overrides);
      createMenu();
      expect(readableText(byId('continue-btn'))).toMatch(english);
      setLocale('zh-CN');
      expect(readableText(byId('continue-btn'))).toMatch(chinese);
    });

    it('Enter with nothing focused continues the campaign rather than starting a new one', () => {
      seedCheckpoint();
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);

      press('Enter', {}, document.body);

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onStart).not.toHaveBeenCalled();
      expect(showingDialogs()).toEqual([]);
    });
  });

  describe('a save that cannot be used behaves as no save', () => {
    const BROKEN: ReadonlyArray<readonly [string, string]> = [
      ['truncated JSON', '{"version":1,"level":6'],
      ['not JSON at all', 'hello'],
      ['an empty string', ''],
      ['a JSON array', '[1,2,3]'],
      ['JSON null', 'null'],
      ['a JSON string', '"level 6"'],
      ['a number', '42'],
      ['an object without a level', JSON.stringify({ version: 1, wave: 2, score: 10 })],
      ['a level that is not a number', JSON.stringify({ version: 1, level: 'six', wave: 2 })],
      ['a null level', JSON.stringify({ version: 1, level: null })],
      ['a save from another version', JSON.stringify({ version: 99, level: 6, wave: 2 })],
      ['a save with no version', JSON.stringify({ level: 6, wave: 2 })],
    ];

    it.each(BROKEN)('%s: New Campaign is primary and Continue is not offered', (_name, raw) => {
      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);

      expect(offeredActions()[0]).toBe('start-btn');
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);

      // 没有存档可丢：开新局不需要确认，直接开始
      click('start-btn');
      expect(showingDialogs()).toEqual([]);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onContinue).not.toHaveBeenCalled();
    });

    it('a save that is valid but out of range is still offered, clamped into range', () => {
      window.localStorage.setItem(
        CAMPAIGN_SAVE_KEY,
        JSON.stringify({ version: 1, level: 99, wave: -4, difficulty: 12, lives: 0, score: -5 })
      );
      createMenu();
      const text = readableText(byId('continue-btn'));
      expect(isOperable(byId('continue-btn'))).toBe(true);
      expect(text).toContain('Ch. 10');
      expect(text).toContain('Wave 1');
      expect(text).toContain('Expert');
    });

    it('a checkpoint that turned corrupt after the menu rendered is not continued', () => {
      seedCheckpoint();
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);
      expect(offeredActions()[0]).toBe('continue-btn');

      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, '{broken');
      click('continue-btn');

      expect(onContinue).not.toHaveBeenCalled();
      expect(isShown(byId('start-menu')), 'the menu stays up').toBe(true);
      expect(offeredActions()[0], 'New Campaign takes over as primary').toBe('start-btn');
    });

    it('a checkpoint cleared in another tab is not continued', () => {
      seedCheckpoint();
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);

      clearCampaignCheckpoint();
      click('continue-btn');

      expect(onContinue).not.toHaveBeenCalled();
      expect(offeredActions()[0]).toBe('start-btn');
    });
  });

  describe('storage that is unavailable or throws', () => {
    it('renders with defaults and starts a run when every storage read throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      const startMenu = createMenu();
      const started: GameSettings[] = [];
      startMenu.setOnStart((settings) => started.push({ ...settings }));

      expect(offeredActions()[0]).toBe('start-btn');
      click('start-btn');

      expect(started).toHaveLength(1);
      expect(started[0].difficulty).toBe(3);
      expect(started[0].gameMode).toBe('normal');
      expect(started[0].startLevel).toBe(1);
    });

    it('renders and starts a run when every storage write throws (quota / private mode)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      expect(() => startMenu.reloadFromStorage()).not.toThrow();
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('renders and starts a run when localStorage itself is inaccessible', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
      try {
        const startMenu = new StartMenu();
        const onStart = vi.fn();
        startMenu.setOnStart(onStart);
        expect(offeredActions()[0]).toBe('start-btn');
        click('start-btn');
        expect(onStart).toHaveBeenCalledTimes(1);
        startMenu.dispose();
      } finally {
        if (original) {
          Object.defineProperty(window, 'localStorage', original);
        }
      }
    });

    it('settings that are not valid JSON fall back to the defaults', () => {
      window.localStorage.setItem(START_MENU_STORAGE_KEY, '{not json');
      const startMenu = createMenu();
      const started: GameSettings[] = [];
      startMenu.setOnStart((settings) => started.push({ ...settings }));
      click('start-btn');
      expect(started[0]).toMatchObject({ difficulty: 3, playerLives: 3, gameMode: 'normal' });
    });
  });

  describe('the title screen itself carries no settings', () => {
    it('shows no setting control until Settings is opened', () => {
      seedCheckpoint();
      createMenu();
      const controls = Array.from(
        byId('start-menu').querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [role="radio"], [role="switch"], [role="slider"]'
        )
      ).filter((control) => isOperable(control));

      expect(controls.map((control) => control.id).sort()).toEqual([...ACTION_IDS].sort());
      for (const row of [
        'difficulty',
        'lives',
        'camera',
        'tutorial',
        'sfx',
        'music',
        'voice',
        'quality',
        'language',
        'level',
        'mode',
        'testscore',
      ]) {
        expect(isShown(document.getElementById(`${row}-row`)), `#${row}-row`).toBe(false);
      }
    });

    it('opening Settings makes the title actions inert, not the other way round', () => {
      createMenu();
      expect(isInert(byId('start-btn'))).toBe(false);
      click('settings-btn');
      expect(isInert(byId('start-btn'))).toBe(true);
      expect(isShown(byId('difficulty-row'))).toBe(true);
    });
  });

  describe('what New Campaign will start', () => {
    it.each(LOCALES)('names the starting chapter on the primary button (%s)', (locale) => {
      saveStartFlowSettings({ startLevel: 4 });
      setLocale(locale);
      createMenu();
      // 第 4 关：Jungle / 丛林（章节标题取自 CampaignData，这里只认关卡名里稳定的那一段）
      const text = readableText(byId('start-btn'));
      expect(text).toContain(textIn(LABELS.newCampaign, locale));
      expect(text).toMatch(locale === 'en' ? /Chapter 4/ : /第四章/);
    });

    it('says so when a test score is set', () => {
      saveStartFlowSettings({ testScore: 10000 });
      createMenu();
      expect(readableText(byId('start-btn'))).toContain('10000');
    });

    it('is labelled as the boss challenge, not a campaign, in boss mode', () => {
      saveStartFlowSettings({ gameMode: 'boss' });
      createMenu();
      const text = readableText(byId('start-btn'));
      expect(text).toMatch(/Boss/);
      expect(text).not.toContain('New Campaign');
      setLocale('zh-CN');
      expect(readableText(byId('start-btn'))).not.toContain('新战役');
    });
  });

  describe('reloadFromStorage()', () => {
    it('shows Continue with the new position after Save & Exit wrote a checkpoint', () => {
      const startMenu = createMenu();
      expect(offeredActions()[0]).toBe('start-btn');

      seedCheckpoint({ checkpoint: 'boss', level: 3, wave: 5 });
      startMenu.reloadFromStorage();

      expect(offeredActions()[0]).toBe('continue-btn');
      expect(readableText(byId('continue-btn'))).toContain('Ch. 3 · Snowbound Summit · Boss');
    });

    it('follows the checkpoint when it moves to a later position', () => {
      seedCheckpoint({ level: 2, wave: 1, score: 900, lives: 3 });
      const startMenu = createMenu();
      expect(readableText(byId('continue-btn'))).toContain('Ch. 2');

      seedCheckpoint({ level: 8, wave: 3, score: 64_000, lives: 1 });
      startMenu.reloadFromStorage();

      const text = readableText(byId('continue-btn'));
      expect(text).toContain('Ch. 8');
      expect(text).toContain('Wave 4');
      expect(text).toContain('64000');
      expect(text).toMatch(/Lives\s*1/);
      expect(text).not.toContain('Ch. 2');
    });

    it('makes New Campaign primary again once the save is gone', () => {
      seedCheckpoint();
      const startMenu = createMenu();
      expect(offeredActions()[0]).toBe('continue-btn');

      clearCampaignCheckpoint();
      startMenu.reloadFromStorage();

      expect(offeredActions()).toEqual(['start-btn', 'preview-btn', 'settings-btn', 'howto-btn']);
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);
    });

    it('hands the re-read checkpoint to onContinue', () => {
      seedCheckpoint({ level: 2, wave: 1 });
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);

      seedCheckpoint({ level: 9, wave: 0, checkpoint: 'hangar' });
      startMenu.reloadFromStorage();
      click('continue-btn');

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onContinue.mock.calls[0][0]).toMatchObject({ level: 9, checkpoint: 'hangar' });
    });

    it('re-reads settings changed elsewhere (pause menu) and starts with them', () => {
      const startMenu = createMenu();
      const started: GameSettings[] = [];
      startMenu.setOnStart((settings) => started.push({ ...settings }));

      saveStartFlowSettings({ sfxVolume: 0.2, musicVolume: 0, voiceVolume: 0.4, difficulty: 5 });
      startMenu.reloadFromStorage();
      click('start-btn');

      expect(started[0]).toMatchObject({ sfxVolume: 0.2, musicVolume: 0, voiceVolume: 0.4 });
      expect(started[0].difficulty).toBe(5);
    });

    it('does not touch the checkpoint bytes', () => {
      const raw = seedCheckpoint();
      const startMenu = createMenu();
      startMenu.reloadFromStorage();
      startMenu.reloadFromStorage();
      expect(rawSave()).toBe(raw);
    });

    it('show() re-reads too: back from a run, the title reflects the new checkpoint', () => {
      const startMenu = createMenu();
      startMenu.hide();
      expect(isShown(byId('start-menu'))).toBe(false);

      seedCheckpoint({ level: 5, wave: 1 });
      startMenu.show();

      expect(isShown(byId('start-menu'))).toBe(true);
      expect(offeredActions()[0]).toBe('continue-btn');
      expect(readableText(byId('continue-btn'))).toContain('Ch. 5');
    });
  });

  describe('keyboard on the action list', () => {
    it('arrow keys move focus through the actions the player can see, wrapping at the ends', () => {
      seedCheckpoint();
      createMenu();

      press('ArrowDown', {}, document.body);
      expect(document.activeElement?.id).toBe('continue-btn');

      const visited = ['continue-btn'];
      for (let i = 0; i < 4; i++) {
        press('ArrowDown');
        visited.push(document.activeElement?.id ?? '');
      }
      expect(visited).toEqual([
        'continue-btn',
        'start-btn',
        'preview-btn',
        'settings-btn',
        'howto-btn',
      ]);

      press('ArrowDown');
      expect(document.activeElement?.id, 'wraps to the first').toBe('continue-btn');
      press('ArrowUp');
      expect(document.activeElement?.id, 'wraps to the last').toBe('howto-btn');
    });

    it('never lands on the Continue button when there is no save', () => {
      createMenu();
      press('ArrowDown', {}, document.body);
      const visited = new Set<string>();
      for (let i = 0; i < 8; i++) {
        visited.add(document.activeElement?.id ?? '');
        press('ArrowDown');
      }
      expect([...visited].sort()).toEqual(
        ['start-btn', 'preview-btn', 'settings-btn', 'howto-btn'].sort()
      );
    });

    it('keeps focus on the same action when the language changes', () => {
      createMenu();
      byId('settings-btn').focus();
      setLocale('zh-CN');
      expect(document.activeElement).toBe(byId('settings-btn'));
      expect(readableText(byId('settings-btn'))).toBe('设置');
    });

    it('leaves Enter alone while typing in a text field elsewhere on the page', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      const input = document.createElement('input');
      document.body.append(input);
      input.focus();

      press('Enter');

      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe('show / hide / dispose', () => {
    it('hide() hides the root and stops answering Enter', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      startMenu.hide();
      press('Enter', {}, document.body);

      expect(isShown(byId('start-menu'))).toBe(false);
      expect(onStart).not.toHaveBeenCalled();
    });

    it('dispose() removes the root and every trace of the menu', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      startMenu.dispose();
      menu = null;

      expect(document.getElementById('start-menu')).toBeNull();
      expect(() => press('Enter', {}, document.body)).not.toThrow();
      expect(() => setLocale('zh-CN')).not.toThrow();
      expect(onStart).not.toHaveBeenCalled();
      expect(pendingTimers(), 'no timer left behind').toBe(0);
    });

    it('dispose() twice is harmless', () => {
      const startMenu = createMenu();
      startMenu.dispose();
      expect(() => startMenu.dispose()).not.toThrow();
      menu = null;
    });
  });
});
