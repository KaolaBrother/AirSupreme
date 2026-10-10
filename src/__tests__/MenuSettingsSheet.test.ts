import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_START_FLOW_SETTINGS,
  START_MENU_STORAGE_KEY,
  TEST_SCORE_OPTIONS,
  loadStartFlowSettings,
  saveStartFlowSettings,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { TOTAL_LEVELS, getCampaignChapter } from '@/features/campaign/CampaignData';
import { getLocale, setLocale, type Locale, type LocalizedText } from '@/i18n';
import { StartMenu, type GameSettings } from '@/ui/StartMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';
import {
  SETTINGS_SHEET,
  byId,
  checkedRadio,
  click,
  finishSheetTransitions,
  isDialogShowing,
  isInert,
  isOperable,
  prepareMenuEnvironment,
  press,
  radioIn,
  readableText,
  resetMenuEnvironment,
  seedCheckpoint,
  stepButton,
  storedSettings,
  useMenuFakeTimers,
  userClick,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 5：设置面板。
 *
 * 分组：游戏（难度、生命、视角、教程）、音频（音效 / 音乐 / 语音音量）、显示（画质、语言）、
 * 高级（起始关卡、游戏模式、测试分数；默认收起，#advanced-toggle）。
 * 旧菜单的每一项设置都还在，改的是同一个存储字段（键、取值范围、两端的钳制都不变），
 * 并且体现在交给 onStart 的 GameSettings 里。
 * 控件：步进器（到头禁用 / 钳制）、分段选择（单选组语义、方向键）、开关（aria-checked）、音量条。
 * 高级里有任何一项不是默认值时，收起的标题上有“已修改”标记。
 * 切换语言立即重写整个菜单，不关面板、不丢焦点。
 */

type SettingKey = keyof StartFlowSettings;

interface RowSpec {
  row: string;
  group: LocalizedText;
  label: { en: RegExp; zh: RegExp };
}

const GROUPS = {
  game: { en: 'Game', zh: '游戏' },
  audio: { en: 'Audio', zh: '音频' },
  display: { en: 'Display', zh: '显示' },
  advanced: { en: 'Advanced', zh: '高级' },
} satisfies Record<string, LocalizedText>;

const ROWS: readonly RowSpec[] = [
  { row: 'difficulty-row', group: GROUPS.game, label: { en: /Difficulty/i, zh: /难度/ } },
  { row: 'lives-row', group: GROUPS.game, label: { en: /Lives/i, zh: /生命/ } },
  { row: 'camera-row', group: GROUPS.game, label: { en: /Camera/i, zh: /视角/ } },
  { row: 'tutorial-row', group: GROUPS.game, label: { en: /Tutorial/i, zh: /教程/ } },
  { row: 'sfx-row', group: GROUPS.audio, label: { en: /SFX/i, zh: /音效/ } },
  { row: 'music-row', group: GROUPS.audio, label: { en: /Music/i, zh: /音乐/ } },
  { row: 'voice-row', group: GROUPS.audio, label: { en: /Voice/i, zh: /语音/ } },
  { row: 'quality-row', group: GROUPS.display, label: { en: /Graphics/i, zh: /画质/ } },
  { row: 'language-row', group: GROUPS.display, label: { en: /Language/i, zh: /语言/ } },
  { row: 'level-row', group: GROUPS.advanced, label: { en: /Start level/i, zh: /起始关卡/ } },
  { row: 'mode-row', group: GROUPS.advanced, label: { en: /Game mode/i, zh: /游戏模式/ } },
  { row: 'testscore-row', group: GROUPS.advanced, label: { en: /Test score/i, zh: /测试分数/ } },
];

const ADVANCED_ROWS = ['level-row', 'mode-row', 'testscore-row'];
const MODIFIED = /Modified|已修改/;

describe('Settings sheet (batch X5, spec 5)', () => {
  let menu: StartMenu | null = null;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  function openSettings(): HTMLElement {
    click('settings-btn');
    expect(isDialogShowing(SETTINGS_SHEET)).toBe(true);
    return byId(SETTINGS_SHEET);
  }

  function openAdvanced(): void {
    if (byId('advanced-toggle').getAttribute('aria-expanded') !== 'true') {
      click('advanced-toggle');
    }
    expect(byId('advanced-toggle').getAttribute('aria-expanded')).toBe('true');
  }

  function closeSettings(): void {
    press('Escape');
    finishSheetTransitions();
    expect(isDialogShowing(SETTINGS_SHEET)).toBe(false);
  }

  /** 用当前设置开一局（没有存档，不会弹确认框），返回交给 onStart 的设置的快照 */
  function startRun(startMenu: StartMenu): GameSettings {
    const started: GameSettings[] = [];
    startMenu.setOnStart((settings) => started.push({ ...settings }));
    if (isDialogShowing(SETTINGS_SHEET)) {
      closeSettings();
    }
    click('start-btn');
    expect(started).toHaveLength(1);
    return started[0];
  }

  function valueText(key: string): string {
    return readableText(byId(`${key}-value`));
  }

  /** 行所在分组的标题：文档顺序里排在这一行前面的最后一个分组标题（高级组的标题就是它的开关） */
  function groupHeadingOf(rowId: string): string {
    const row = byId(rowId);
    const marks = Array.from(
      byId(SETTINGS_SHEET).querySelectorAll<HTMLElement>('h3, [role="heading"], #advanced-toggle')
    );
    let heading: HTMLElement | null = null;
    for (const mark of marks) {
      if (mark.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) {
        heading = mark;
      }
    }
    return readableText(heading);
  }

  function advancedRegion(): HTMLElement {
    return byId(byId('advanced-toggle').getAttribute('aria-controls') ?? '');
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

  // ───────────────────────────── 结构 ─────────────────────────────

  describe('layout of the sheet', () => {
    it.each(LOCALES)('files every setting under its group, labelled (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openSettings();

      for (const spec of ROWS) {
        const row = byId(spec.row);
        expect(readableText(row), spec.row).toMatch(
          locale === 'en' ? spec.label.en : spec.label.zh
        );
        expect(groupHeadingOf(spec.row), `${spec.row} group`).toContain(textIn(spec.group, locale));
      }
    });

    it('lists the four groups in order: Game, Audio, Display, Advanced', () => {
      createMenu();
      const sheet = openSettings();
      const text = readableText(sheet);
      const positions = ['Game', 'Audio', 'Display', 'Advanced'].map((name) =>
        text.search(new RegExp(`\\b${name}\\b`))
      );
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it('has exactly the twelve settings of the old menu, no more and no fewer', () => {
      createMenu();
      const sheet = openSettings();
      const rows = Array.from(sheet.querySelectorAll<HTMLElement>('[id$="-row"]')).map(
        (row) => row.id
      );
      expect(rows.sort()).toEqual(ROWS.map((spec) => spec.row).sort());
    });
  });

  // ───────────────────────────── 高级 ─────────────────────────────

  describe('Advanced', () => {
    it('is collapsed when the sheet opens: its controls cannot be reached', () => {
      createMenu();
      openSettings();
      const toggle = byId('advanced-toggle');

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(advancedRegion().contains(byId('level-row'))).toBe(true);
      for (const row of ADVANCED_ROWS) {
        expect(advancedRegion().contains(byId(row)), row).toBe(true);
        for (const control of Array.from(byId(row).querySelectorAll('button, input'))) {
          expect(isOperable(control), `${row} control`).toBe(false);
        }
      }
      // 其它组的控件照常可用
      expect(isOperable(stepButton('difficulty-row', '+'))).toBe(true);
    });

    it('a tap on a collapsed advanced control changes nothing', () => {
      createMenu();
      openSettings();
      expect(userClick(stepButton('level-row', '+'))).toBe(false);
      expect(userClick(radioIn('mode-row', /Boss/))).toBe(false);
      expect(loadStartFlowSettings()).toMatchObject({ startLevel: 1, gameMode: 'normal' });
    });

    it('expands and collapses from #advanced-toggle', () => {
      createMenu();
      openSettings();
      const toggle = byId('advanced-toggle');

      click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(isOperable(stepButton('level-row', '+'))).toBe(true);
      expect(isOperable(radioIn('mode-row', /Boss/))).toBe(true);
      expect(isOperable(stepButton('testscore-row', '+'))).toBe(true);

      click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(isOperable(stepButton('level-row', '+'))).toBe(false);
    });

    it('is collapsed again the next time the sheet opens', () => {
      createMenu();
      openSettings();
      openAdvanced();
      closeSettings();

      openSettings();

      expect(byId('advanced-toggle').getAttribute('aria-expanded')).toBe('false');
      expect(isOperable(stepButton('level-row', '+'))).toBe(false);
    });

    it('shows no "modified" mark while every advanced value is the default', () => {
      saveStartFlowSettings({
        difficulty: 5,
        playerLives: 9,
        sfxVolume: 0,
        qualityPreset: 'quality',
        cameraMode: 'first-person',
        tutorialEnabled: false,
      });
      createMenu();
      openSettings();
      expect(readableText(byId('advanced-toggle'))).not.toMatch(MODIFIED);
    });

    it.each<[string, Partial<StartFlowSettings>]>([
      ['a start level', { startLevel: 2 }],
      ['boss mode', { gameMode: 'boss' }],
      ['a test score', { testScore: 5000 }],
      ['all three', { startLevel: 10, gameMode: 'boss', testScore: 20000 }],
    ])('marks the collapsed header "modified" for stored %s', (_name, stored) => {
      saveStartFlowSettings(stored);
      createMenu();
      openSettings();
      const toggle = byId('advanced-toggle');

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(readableText(toggle)).toMatch(/Modified/);
      setLocale('zh-CN');
      expect(readableText(byId('advanced-toggle'))).toMatch(/已修改/);
    });

    it('adds the mark the moment a value leaves its default and drops it on the way back', () => {
      createMenu();
      openSettings();
      openAdvanced();
      const marked = (): boolean => MODIFIED.test(readableText(byId('advanced-toggle')));
      expect(marked()).toBe(false);

      click(stepButton('level-row', '+'));
      expect(marked(), 'start level 2').toBe(true);
      click(stepButton('level-row', '-'));
      expect(marked(), 'start level back to 1').toBe(false);

      click(radioIn('mode-row', /Boss/));
      expect(marked(), 'boss mode').toBe(true);
      click(radioIn('mode-row', 'Normal'));
      expect(marked(), 'normal mode again').toBe(false);

      click(stepButton('testscore-row', '+'));
      expect(marked(), 'test score 5000').toBe(true);
      click(stepButton('testscore-row', '-'));
      expect(marked(), 'test score off again').toBe(false);
    });

    it('keeps the mark while any one advanced value is still off its default', () => {
      saveStartFlowSettings({ startLevel: 3, testScore: 5000 });
      createMenu();
      openSettings();
      openAdvanced();

      click(stepButton('testscore-row', '-'));

      expect(readableText(byId('advanced-toggle'))).toMatch(MODIFIED);
    });

    it('settings outside Advanced never raise the mark', () => {
      createMenu();
      openSettings();
      click(stepButton('difficulty-row', '+'));
      click(stepButton('lives-row', '-'));
      click(radioIn('camera-row', 'First-person'));
      click(radioIn('quality-row', 'High'));
      click(stepButton('music-row', '-'));
      expect(readableText(byId('advanced-toggle'))).not.toMatch(MODIFIED);
    });
  });

  // ───────────────────────────── 步进器 ─────────────────────────────

  interface StepperSpec {
    name: string;
    row: string;
    key: SettingKey;
    values: readonly number[];
    advanced: boolean;
  }

  const range = (min: number, max: number): number[] =>
    Array.from({ length: max - min + 1 }, (_, index) => min + index);

  const STEPPERS: readonly StepperSpec[] = [
    {
      name: 'difficulty',
      row: 'difficulty-row',
      key: 'difficulty',
      values: range(1, 5),
      advanced: false,
    },
    { name: 'lives', row: 'lives-row', key: 'playerLives', values: range(1, 9), advanced: false },
    {
      name: 'start level',
      row: 'level-row',
      key: 'startLevel',
      values: range(1, TOTAL_LEVELS),
      advanced: true,
    },
    {
      name: 'test score',
      row: 'testscore-row',
      key: 'testScore',
      values: TEST_SCORE_OPTIONS,
      advanced: true,
    },
  ];

  describe.each(STEPPERS)('stepper: $name', ({ row, key, values, advanced }) => {
    const min = values[0];
    const max = values[values.length - 1];

    function open(): StartMenu {
      const startMenu = createMenu();
      openSettings();
      if (advanced) {
        openAdvanced();
      }
      return startMenu;
    }

    it('walks every value from the bottom to the top, storing each step', () => {
      open();
      for (let i = 0; i < values.length + 2; i++) {
        stepButton(row, '-').click();
      }
      expect(loadStartFlowSettings()[key]).toBe(min);

      const seen: unknown[] = [loadStartFlowSettings()[key]];
      for (let i = 1; i < values.length; i++) {
        click(stepButton(row, '+'));
        seen.push(loadStartFlowSettings()[key]);
        expect(storedSettings()[key], 'written to storage at once').toBe(values[i]);
      }
      expect(seen).toEqual([...values]);
    });

    it('clamps at the top: + is disabled there and further presses change nothing', () => {
      open();
      for (let i = 0; i < values.length + 3; i++) {
        stepButton(row, '+').click();
      }

      expect(loadStartFlowSettings()[key]).toBe(max);
      expect(isOperable(stepButton(row, '+')), '+ at the top').toBe(false);
      expect(isOperable(stepButton(row, '-')), '- at the top').toBe(true);
      const shown = readableText(byId(row));
      stepButton(row, '+').click();
      expect(loadStartFlowSettings()[key]).toBe(max);
      expect(readableText(byId(row))).toBe(shown);
    });

    it('clamps at the bottom: - is disabled there and further presses change nothing', () => {
      open();
      for (let i = 0; i < values.length + 3; i++) {
        stepButton(row, '-').click();
      }

      expect(loadStartFlowSettings()[key]).toBe(min);
      expect(isOperable(stepButton(row, '-')), '- at the bottom').toBe(false);
      expect(isOperable(stepButton(row, '+')), '+ at the bottom').toBe(true);
      stepButton(row, '-').click();
      expect(loadStartFlowSettings()[key]).toBe(min);
    });

    it('re-enables the far button after stepping back from a limit', () => {
      open();
      for (let i = 0; i < values.length + 1; i++) {
        stepButton(row, '+').click();
      }
      click(stepButton(row, '-'));
      expect(isOperable(stepButton(row, '+'))).toBe(true);
      expect(loadStartFlowSettings()[key]).toBe(values[values.length - 2]);
    });

    it('the arrow keys step it: Right is +, Left is -', () => {
      open();
      const before = loadStartFlowSettings()[key] as number;
      const index = values.indexOf(before);
      const plus = stepButton(row, '+');
      plus.focus();

      const right = press('ArrowRight');
      expect(loadStartFlowSettings()[key]).toBe(values[index + 1]);
      expect(right.defaultPrevented).toBe(true);

      press('ArrowLeft');
      expect(loadStartFlowSettings()[key]).toBe(before);
    });

    it('each button says what it does to a screen reader', () => {
      open();
      for (const direction of ['+', '-'] as const) {
        const button = stepButton(row, direction);
        expect(button.getAttribute('aria-label') ?? '', direction).toMatch(/\S/);
      }
      expect(stepButton(row, '+').getAttribute('aria-label')).not.toBe(
        stepButton(row, '-').getAttribute('aria-label')
      );
    });

    it('hands the top and bottom values to onStart', () => {
      const startMenu = open();
      for (let i = 0; i < values.length + 1; i++) {
        stepButton(row, '+').click();
      }
      expect(startRun(startMenu)[key]).toBe(max);
    });

    it('opens on the stored value, and on the clamped value when storage is out of range', () => {
      const middle = values[Math.floor(values.length / 2)];
      saveStartFlowSettings({ [key]: middle });
      const first = createMenu();
      expect(startRun(first)[key]).toBe(middle);
      first.dispose();

      window.localStorage.setItem(START_MENU_STORAGE_KEY, JSON.stringify({ [key]: 1e9 }));
      const high = createMenu();
      openSettings();
      if (advanced) {
        openAdvanced();
      }
      expect(isOperable(stepButton(row, '+'))).toBe(false);
      expect(startRun(high)[key]).toBe(max);
      high.dispose();

      window.localStorage.setItem(START_MENU_STORAGE_KEY, JSON.stringify({ [key]: -1e9 }));
      const low = createMenu();
      openSettings();
      if (advanced) {
        openAdvanced();
      }
      expect(isOperable(stepButton(row, '-'))).toBe(false);
      expect(startRun(low)[key]).toBe(min);
    });
  });

  describe('what the steppers show', () => {
    it.each(LOCALES)('difficulty shows the tier name (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openSettings();
      const names =
        locale === 'en'
          ? ['Very Easy', 'Easy', 'Normal', 'Hard', 'Expert']
          : ['非常简单', '简单', '普通', '困难', '专家'];
      for (let i = 0; i < 6; i++) stepButton('difficulty-row', '-').click();
      for (let tier = 1; tier <= 5; tier++) {
        expect(valueText('difficulty'), `tier ${tier}`).toBe(names[tier - 1]);
        stepButton('difficulty-row', '+').click();
      }
    });

    it('lives shows the count', () => {
      saveStartFlowSettings({ playerLives: 7 });
      createMenu();
      openSettings();
      expect(valueText('lives')).toBe('7');
    });

    it.each(LOCALES)('start level names the chapter it starts in (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openSettings();
      openAdvanced();
      for (let level = 1; level <= TOTAL_LEVELS; level++) {
        const text = readableText(byId('level-row'));
        expect(text, `level ${level}`).toContain(
          locale === 'en' ? `Level ${level}` : `第${level}关`
        );
        expect(text, `level ${level}`).toContain(textIn(getCampaignChapter(level).title, locale));
        stepButton('level-row', '+').click();
      }
    });

    it.each(LOCALES)('test score reads Off at zero and the number otherwise (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openSettings();
      openAdvanced();
      expect(valueText('testscore')).toBe(locale === 'en' ? 'Off' : '关闭');
      const shown: string[] = [];
      for (let i = 1; i < TEST_SCORE_OPTIONS.length; i++) {
        click(stepButton('testscore-row', '+'));
        shown.push(valueText('testscore'));
      }
      expect(shown).toEqual(['5000', '10000', '15000', '20000']);
    });

    it('a stored test score between two options snaps to the nearest one', () => {
      window.localStorage.setItem(START_MENU_STORAGE_KEY, JSON.stringify({ testScore: 11_900 }));
      const startMenu = createMenu();
      openSettings();
      openAdvanced();
      expect(valueText('testscore')).toBe('10000');
      click(stepButton('testscore-row', '+'));
      expect(startRun(startMenu).testScore).toBe(15000);
    });
  });

  // ───────────────────────────── 分段选择 ─────────────────────────────

  interface SegmentSpec {
    name: string;
    row: string;
    key: SettingKey;
    advanced: boolean;
    /** [存储值, 英文标签, 中文标签]，按显示顺序；第一个是默认值 */
    options: ReadonlyArray<readonly [string, string, string]>;
  }

  const SEGMENTS: readonly SegmentSpec[] = [
    {
      name: 'camera',
      row: 'camera-row',
      key: 'cameraMode',
      advanced: false,
      options: [
        ['third-person', 'Third-person', '第三人称'],
        ['first-person', 'First-person', '第一人称'],
      ],
    },
    {
      name: 'graphics preset',
      row: 'quality-row',
      key: 'qualityPreset',
      advanced: false,
      options: [
        ['auto', 'Auto', '自动'],
        ['performance', 'Performance', '性能'],
        ['balanced', 'Balanced', '平衡'],
        ['quality', 'High', '高质量'],
      ],
    },
    {
      name: 'game mode',
      row: 'mode-row',
      key: 'gameMode',
      advanced: true,
      options: [
        ['normal', 'Normal', '普通模式'],
        ['boss', 'Boss mode', 'Boss 模式'],
      ],
    },
  ];

  describe.each(SEGMENTS)('segmented control: $name', ({ row, key, advanced, options }) => {
    function open(): StartMenu {
      const startMenu = createMenu();
      openSettings();
      if (advanced) {
        openAdvanced();
      }
      return startMenu;
    }

    function radios(): HTMLElement[] {
      return Array.from(byId(row).querySelectorAll<HTMLElement>('[role="radio"]'));
    }

    it('is a radio group named by the row label, one option per value', () => {
      open();
      const group = byId(row).querySelector<HTMLElement>('[role="radiogroup"]');
      expect(group, 'a radiogroup').not.toBeNull();
      const label = document.getElementById(group?.getAttribute('aria-labelledby') ?? '');
      expect(byId(row).contains(label)).toBe(true);
      expect(readableText(label).length).toBeGreaterThan(0);

      expect(radios().map((radio) => readableText(radio))).toEqual(options.map(([, en]) => en));
      for (const radio of radios()) {
        expect(group?.contains(radio)).toBe(true);
        expect(['true', 'false']).toContain(radio.getAttribute('aria-checked'));
      }
    });

    it('labels the options in Chinese too', () => {
      setLocale('zh-CN');
      open();
      expect(radios().map((radio) => readableText(radio))).toEqual(options.map(([, , zh]) => zh));
    });

    it('starts on the default with exactly one option checked', () => {
      open();
      expect(readableText(checkedRadio(row))).toBe(options[0][1]);
      expect(loadStartFlowSettings()[key]).toBe(options[0][0]);
    });

    it('selecting an option checks it alone, stores it and hands it to onStart', () => {
      for (const [value, label] of [...options].reverse()) {
        menu?.dispose();
        window.localStorage.clear();
        const startMenu = open();

        click(radioIn(row, label));

        expect(readableText(checkedRadio(row)), label).toBe(label);
        expect(storedSettings()[key], label).toBe(value);
        expect(startRun(startMenu)[key], label).toBe(value);
      }
    });

    it('selecting the option that is already selected changes nothing', () => {
      open();
      click(radioIn(row, options[0][1]));
      expect(readableText(checkedRadio(row))).toBe(options[0][1]);
      expect(loadStartFlowSettings()[key]).toBe(options[0][0]);
    });

    it('keeps one tab stop: only the checked option is in the tab order', () => {
      open();
      click(radioIn(row, options[1][1]));
      const tabbable = radios().filter((radio) => radio.tabIndex === 0);
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0].getAttribute('aria-checked')).toBe('true');
    });

    it('ArrowRight / ArrowLeft move the selection and the focus, wrapping at the ends', () => {
      open();
      (checkedRadio(row) as HTMLElement).focus();

      const forward: unknown[] = [];
      for (let i = 0; i < options.length; i++) {
        const event = press('ArrowRight');
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement, 'focus follows the selection').toBe(checkedRadio(row));
        forward.push(loadStartFlowSettings()[key]);
      }
      // 走一整圈回到起点
      expect(forward).toEqual([...options.slice(1).map(([value]) => value), options[0][0]]);

      press('ArrowLeft');
      expect(loadStartFlowSettings()[key], 'wraps backwards to the last').toBe(
        options[options.length - 1][0]
      );
      expect(document.activeElement).toBe(checkedRadio(row));
    });

    it('opens on the stored value and falls back to the default for junk', () => {
      const last = options[options.length - 1];
      saveStartFlowSettings({ [key]: last[0] });
      createMenu();
      openSettings();
      expect(readableText(checkedRadio(row))).toBe(last[1]);
      menu?.dispose();

      window.localStorage.setItem(START_MENU_STORAGE_KEY, JSON.stringify({ [key]: 'nonsense' }));
      const startMenu = createMenu();
      openSettings();
      expect(readableText(checkedRadio(row))).toBe(options[0][1]);
      expect(startRun(startMenu)[key]).toBe(options[0][0]);
    });
  });

  // ───────────────────────────── 开关 ─────────────────────────────

  describe('switch: tutorial', () => {
    function tutorialSwitch(): HTMLElement {
      const control = byId('tutorial-row').querySelector<HTMLElement>('[role="switch"]');
      expect(control, 'a switch in #tutorial-row').not.toBeNull();
      return control as HTMLElement;
    }

    it('is a switch named by the row label, on by default', () => {
      createMenu();
      openSettings();
      const control = tutorialSwitch();
      expect(control.getAttribute('aria-checked')).toBe('true');
      const label = document.getElementById(control.getAttribute('aria-labelledby') ?? '');
      expect(readableText(label)).toMatch(/Tutorial/);
    });

    it.each(LOCALES)('toggles, saying On / Off in the interface language (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openSettings();
      const words = locale === 'en' ? ['On', 'Off'] : ['开启', '关闭'];
      expect(readableText(tutorialSwitch())).toBe(words[0]);

      click(tutorialSwitch());
      expect(tutorialSwitch().getAttribute('aria-checked')).toBe('false');
      expect(readableText(tutorialSwitch())).toBe(words[1]);
      expect(storedSettings().tutorialEnabled).toBe(false);

      click(tutorialSwitch());
      expect(tutorialSwitch().getAttribute('aria-checked')).toBe('true');
      expect(storedSettings().tutorialEnabled).toBe(true);
    });

    it('hands the choice to onStart', () => {
      const startMenu = createMenu();
      openSettings();
      click(tutorialSwitch());
      expect(startRun(startMenu).tutorialEnabled).toBe(false);
    });

    it('opens on the stored value', () => {
      saveStartFlowSettings({ tutorialEnabled: false });
      const startMenu = createMenu();
      openSettings();
      expect(tutorialSwitch().getAttribute('aria-checked')).toBe('false');
      expect(startRun(startMenu).tutorialEnabled).toBe(false);
    });

    it('ArrowLeft turns it off, ArrowRight turns it on, and neither toggles past the end', () => {
      createMenu();
      openSettings();
      tutorialSwitch().focus();

      press('ArrowRight');
      expect(storedSettings().tutorialEnabled ?? true, 'already on').toBe(true);
      press('ArrowLeft');
      expect(storedSettings().tutorialEnabled).toBe(false);
      press('ArrowLeft');
      expect(storedSettings().tutorialEnabled, 'already off').toBe(false);
      press('ArrowRight');
      expect(storedSettings().tutorialEnabled).toBe(true);
    });
  });

  // ───────────────────────────── 音量 ─────────────────────────────

  interface VolumeSpec {
    name: string;
    row: string;
    value: string;
    key: 'sfxVolume' | 'musicVolume' | 'voiceVolume';
    label: LocalizedText;
  }

  const VOLUMES: readonly VolumeSpec[] = [
    {
      name: 'SFX',
      row: 'sfx-row',
      value: 'sfx',
      key: 'sfxVolume',
      label: { en: 'SFX volume', zh: '音效音量' },
    },
    {
      name: 'music',
      row: 'music-row',
      value: 'music',
      key: 'musicVolume',
      label: { en: 'Music volume', zh: '音乐音量' },
    },
    {
      name: 'voice',
      row: 'voice-row',
      value: 'voice',
      key: 'voiceVolume',
      label: { en: 'Voice volume', zh: '语音音量' },
    },
  ];

  describe.each(VOLUMES)('volume meter: $name', ({ row, value, key, label }) => {
    const defaultPercent = Math.round(DEFAULT_START_FLOW_SETTINGS[key] * 100);

    function slider(): HTMLInputElement {
      const input = byId(row).querySelector<HTMLInputElement>(
        'input[type="range"], [role="slider"]'
      );
      expect(input, `a slider in #${row}`).not.toBeNull();
      return input as HTMLInputElement;
    }

    it('opens on the default, shown as a percentage', () => {
      createMenu();
      openSettings();
      expect(valueText(value)).toBe(`${defaultPercent}%`);
    });

    it('steps by 10% from 0% to 100%, storing every step and clamping at both ends', () => {
      createMenu();
      openSettings();
      for (let i = 0; i < 12; i++) {
        stepButton(row, '-').click();
      }
      expect(valueText(value)).toBe('0%');
      expect(loadStartFlowSettings()[key]).toBe(0);
      expect(isOperable(stepButton(row, '-')), '- at 0%').toBe(false);

      for (let step = 1; step <= 10; step++) {
        click(stepButton(row, '+'));
        expect(valueText(value)).toBe(`${step * 10}%`);
        expect(storedSettings()[key]).toBeCloseTo(step / 10, 9);
      }
      expect(loadStartFlowSettings()[key]).toBe(1);
      expect(isOperable(stepButton(row, '+')), '+ at 100%').toBe(false);

      stepButton(row, '+').click();
      expect(valueText(value)).toBe('100%');
      expect(loadStartFlowSettings()[key]).toBe(1);
    });

    it('stores clean tenths, not accumulated floating-point drift', () => {
      createMenu();
      openSettings();
      for (let i = 0; i < 12; i++) stepButton(row, '-').click();
      const stored: number[] = [];
      for (let step = 1; step <= 10; step++) {
        stepButton(row, '+').click();
        stored.push(storedSettings()[key] as number);
      }
      expect(stored).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    });

    it.each(LOCALES)('exposes a slider named for the setting (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      openSettings();
      const input = slider();
      const labelledBy = document.getElementById(input.getAttribute('aria-labelledby') ?? '');
      const name = input.getAttribute('aria-label') ?? readableText(labelledBy);
      expect(name).toBe(textIn(label, locale));
      expect(Number(input.value)).toBe(defaultPercent);
      expect(Number(input.min)).toBe(0);
      expect(Number(input.max)).toBe(100);
    });

    it('follows the slider (keyboard / assistive tech) and stores what it lands on', () => {
      const startMenu = createMenu();
      openSettings();
      const input = slider();

      input.value = '30';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(valueText(value)).toBe('30%');
      expect(storedSettings()[key]).toBeCloseTo(0.3, 9);
      expect(Number(slider().value)).toBe(30);
      expect(startRun(startMenu)[key]).toBeCloseTo(0.3, 9);
    });

    it('keeps the slider, the readout and the - / + buttons in step', () => {
      createMenu();
      openSettings();
      for (let i = 0; i < 3; i++) click(stepButton(row, '-'));
      const expected = defaultPercent - 30;
      expect(valueText(value)).toBe(`${expected}%`);
      expect(Number(slider().value)).toBe(expected);
    });

    it('hands the chosen volume to onStart, including silence', () => {
      const startMenu = createMenu();
      openSettings();
      for (let i = 0; i < 12; i++) stepButton(row, '-').click();
      expect(startRun(startMenu)[key]).toBe(0);
    });

    it('opens on the stored volume', () => {
      saveStartFlowSettings({ [key]: 0.4 });
      createMenu();
      openSettings();
      expect(valueText(value)).toBe('40%');
      expect(Number(slider().value)).toBe(40);
    });

    it('clamps a stored volume that is out of range', () => {
      window.localStorage.setItem(START_MENU_STORAGE_KEY, JSON.stringify({ [key]: 7 }));
      const startMenu = createMenu();
      openSettings();
      expect(valueText(value)).toBe('100%');
      expect(isOperable(stepButton(row, '+'))).toBe(false);
      expect(startRun(startMenu)[key]).toBe(1);
    });
  });

  it('changing one volume leaves the other two alone', () => {
    saveStartFlowSettings({ sfxVolume: 0.5, musicVolume: 0.2, voiceVolume: 0.8 });
    createMenu();
    openSettings();
    click(stepButton('music-row', '+'));
    expect(loadStartFlowSettings()).toMatchObject({ sfxVolume: 0.5, voiceVolume: 0.8 });
    expect(loadStartFlowSettings().musicVolume).toBeCloseTo(0.3, 9);
  });

  // ───────────────────────────── 存储 ─────────────────────────────

  describe('persistence', () => {
    const FULL: GameSettings = {
      difficulty: 1,
      playerLives: 9,
      cameraMode: 'first-person',
      tutorialEnabled: false,
      sfxVolume: 0,
      musicVolume: 1,
      voiceVolume: 0.5,
      qualityPreset: 'quality',
      language: 'zh-CN',
      startLevel: TOTAL_LEVELS,
      gameMode: 'boss',
      testScore: 20000,
    };

    /** 把每一项都从默认值改掉 */
    function changeEverything(): void {
      openSettings();
      openAdvanced();
      for (let i = 0; i < 4; i++) stepButton('difficulty-row', '-').click();
      for (let i = 0; i < 8; i++) stepButton('lives-row', '+').click();
      click(radioIn('camera-row', 'First-person'));
      click(byId('tutorial-row').querySelector('[role="switch"]'));
      for (let i = 0; i < 10; i++) stepButton('sfx-row', '-').click();
      for (let i = 0; i < 10; i++) stepButton('music-row', '+').click();
      for (let i = 0; i < 4; i++) stepButton('voice-row', '-').click();
      click(radioIn('quality-row', 'High'));
      for (let i = 0; i < TOTAL_LEVELS; i++) stepButton('level-row', '+').click();
      click(radioIn('mode-row', /Boss/));
      for (let i = 0; i < 5; i++) stepButton('testscore-row', '+').click();
      click(radioIn('language-row', '中文'));
    }

    it('writes all twelve settings under the same storage key and field names as before', () => {
      createMenu();
      changeEverything();

      expect(START_MENU_STORAGE_KEY).toBe('air-supreme:start-menu-settings');
      const stored = storedSettings();
      expect(Object.keys(stored).sort()).toEqual(Object.keys(FULL).sort());
      expect(stored).toEqual(FULL);
    });

    it('hands the same twelve values to onStart', () => {
      const startMenu = createMenu();
      changeEverything();
      expect(startRun(startMenu)).toEqual(FULL);
    });

    it('a new menu (next visit) opens on everything that was chosen', () => {
      createMenu();
      changeEverything();
      menu?.dispose();
      resetLocale();

      const next = createMenu();
      openSettings();
      openAdvanced();

      expect(valueText('difficulty')).toBe('Very Easy');
      expect(valueText('lives')).toBe('9');
      expect(readableText(checkedRadio('camera-row'))).toBe('First-person');
      expect(
        byId('tutorial-row').querySelector('[role="switch"]')?.getAttribute('aria-checked')
      ).toBe('false');
      expect(valueText('sfx')).toBe('0%');
      expect(valueText('music')).toBe('100%');
      expect(valueText('voice')).toBe('50%');
      expect(readableText(checkedRadio('quality-row'))).toBe('High');
      expect(readableText(checkedRadio('mode-row'))).toBe('Boss mode');
      expect(valueText('testscore')).toBe('20000');
      expect(readableText(byId('level-row'))).toContain(`Level ${TOTAL_LEVELS}`);
      expect(startRun(next)).toEqual(FULL);
    });

    it('changing one setting does not disturb the other eleven', () => {
      saveStartFlowSettings(FULL);
      setLocale('zh-CN');
      createMenu();
      openSettings();

      click(stepButton('difficulty-row', '+'));

      expect(loadStartFlowSettings()).toEqual({ ...FULL, difficulty: 2 });
    });

    it('still applies a change for this session when the write fails (quota / private mode)', () => {
      const startMenu = createMenu();
      openSettings();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });

      expect(() => click(stepButton('difficulty-row', '+'))).not.toThrow();
      expect(() => click(radioIn('camera-row', 'First-person'))).not.toThrow();

      expect(valueText('difficulty')).toBe('Hard');
      const started = startRun(startMenu);
      expect(started.difficulty).toBe(4);
      expect(started.cameraMode).toBe('first-person');
    });

    it('reloadFromStorage() refreshes an open sheet with values changed elsewhere', () => {
      const startMenu = createMenu();
      openSettings();
      saveStartFlowSettings({ difficulty: 5, sfxVolume: 0.2, cameraMode: 'first-person' });

      startMenu.reloadFromStorage();

      expect(valueText('difficulty')).toBe('Expert');
      expect(valueText('sfx')).toBe('20%');
      expect(readableText(checkedRadio('camera-row'))).toBe('First-person');
      expect(isDialogShowing(SETTINGS_SHEET), 'the sheet stays open').toBe(true);
    });

    it('a change in the sheet shows on the title screen at once', () => {
      createMenu();
      openSettings();
      openAdvanced();
      for (let i = 0; i < 4; i++) click(stepButton('level-row', '+'));

      expect(readableText(byId('start-btn'))).toContain(getCampaignChapter(5).title.en);

      click(radioIn('mode-row', /Boss/));
      expect(readableText(byId('start-btn'))).not.toContain('New Campaign');
    });

    it('switching game mode never touches a stored checkpoint', () => {
      const raw = seedCheckpoint();
      createMenu();
      openSettings();
      openAdvanced();

      click(radioIn('mode-row', /Boss/));
      click(radioIn('mode-row', 'Normal'));
      click(stepButton('level-row', '+'));
      click(stepButton('testscore-row', '+'));

      expect(window.localStorage.getItem('air-supreme:campaign-save')).toBe(raw);
    });
  });

  // ───────────────────────────── 语言 ─────────────────────────────

  describe('language', () => {
    function languageRadio(locale: Locale): HTMLElement {
      return radioIn('language-row', locale === 'en' ? 'English' : '中文');
    }

    it('offers each language under its own name, whatever the interface language', () => {
      createMenu();
      openSettings();
      const names = (): string[] =>
        Array.from(byId('language-row').querySelectorAll('[role="radio"]')).map((radio) =>
          readableText(radio)
        );
      expect(names()).toEqual(['English', '中文']);
      click(languageRadio('zh-CN'));
      expect(names()).toEqual(['English', '中文']);
    });

    it('is a radio group named by the row label with English checked by default', () => {
      createMenu();
      openSettings();
      const group = byId('language-row').querySelector('[role="radiogroup"]');
      expect(
        readableText(document.getElementById(group?.getAttribute('aria-labelledby') ?? ''))
      ).toBe('Language');
      expect(readableText(checkedRadio('language-row'))).toBe('English');
    });

    it('relabels the whole menu at once: title actions, the open sheet, the other sheets', () => {
      seedCheckpoint();
      createMenu();
      const sheet = openSettings();
      openAdvanced();

      click(languageRadio('zh-CN'));

      expect(getLocale()).toBe('zh-CN');
      expect(document.documentElement.lang).toBe('zh-CN');
      expect(storedSettings().language).toBe('zh-CN');
      // 标题画面
      expect(readableText(byId('continue-btn'))).toContain('继续战役');
      expect(readableText(byId('start-btn'))).toContain('新战役');
      expect(readableText(byId('preview-btn'))).toBe('机库');
      expect(readableText(byId('settings-btn'))).toBe('设置');
      expect(readableText(byId('howto-btn'))).toBe('操作说明');
      // 打开着的设置面板
      const text = readableText(sheet);
      for (const spec of ROWS) {
        expect(readableText(byId(spec.row)), spec.row).toMatch(spec.label.zh);
      }
      for (const group of Object.values(GROUPS)) {
        expect(text).toContain(group.zh);
      }
      expect(text).not.toMatch(/Difficulty|Lives|Camera|Tutorial|Graphics|Start level|Game mode/);
      expect(readableText(checkedRadio('camera-row'))).toBe('第三人称');
      expect(readableText(checkedRadio('quality-row'))).toBe('自动');
      // 其它面板
      expect(byId('howto-sheet').textContent).toContain('俯仰');
      expect(byId('new-campaign-confirm').textContent).toContain('保留存档');
    });

    it('does not close the sheet, and keeps it titled in the new language', () => {
      createMenu();
      const sheet = openSettings();

      click(languageRadio('zh-CN'));
      finishSheetTransitions();

      expect(isDialogShowing(SETTINGS_SHEET)).toBe(true);
      expect(isInert(byId('start-btn')), 'the title is still behind the sheet').toBe(true);
      const heading = document.getElementById(sheet.getAttribute('aria-labelledby') ?? '');
      expect(readableText(heading)).toBe('设置');
    });

    it('keeps focus on the language option that was chosen', () => {
      createMenu();
      const sheet = openSettings();
      const target = languageRadio('zh-CN');
      target.focus();

      click(target);

      const focused = document.activeElement as HTMLElement;
      expect(sheet.contains(focused), 'focus is still inside the sheet').toBe(true);
      expect(focused.isConnected).toBe(true);
      expect(byId('language-row').contains(focused)).toBe(true);
      expect(readableText(focused)).toBe('中文');
      expect(focused.getAttribute('aria-checked')).toBe('true');
    });

    it('the arrow keys change the language and focus stays on a language option', () => {
      createMenu();
      const sheet = openSettings();
      (checkedRadio('language-row') as HTMLElement).focus();

      press('ArrowRight');

      expect(getLocale()).toBe('zh-CN');
      expect(readableText(checkedRadio('language-row'))).toBe('中文');
      const focused = document.activeElement as HTMLElement;
      expect(focused.isConnected).toBe(true);
      expect(sheet.contains(focused)).toBe(true);
      expect(byId('language-row').contains(focused)).toBe(true);

      press('ArrowRight');
      expect(getLocale(), 'wraps back to English').toBe('en');
      expect(readableText(checkedRadio('language-row'))).toBe('English');
      expect(byId('language-row').contains(document.activeElement)).toBe(true);
    });

    // 单选组：方向键换语言时，选中项与键盘焦点一起走（其余三个分段控件也是这样）。
    // （最初是 FINDING：语言切换会重建面板，焦点被按旧控件的 data-focus-key 放回刚取消选中的
    // 那一项。已在 src/ui/menu/settingsControls.ts:157-161 修复：先移焦点再选中。）
    it('arrow keys on the language options move focus with the selection', () => {
      createMenu();
      openSettings();
      (checkedRadio('language-row') as HTMLElement).focus();

      press('ArrowRight');

      expect(getLocale()).toBe('zh-CN');
      expect(document.activeElement).toBe(checkedRadio('language-row'));
    });

    it.each([
      ['ArrowRight', ['zh-CN', 'en', 'zh-CN']],
      ['ArrowLeft', ['zh-CN', 'en', 'zh-CN']],
    ] as const)('%s keeps moving focus with the language, wrap included', (key, expected) => {
      createMenu();
      const sheet = openSettings();
      (checkedRadio('language-row') as HTMLElement).focus();

      for (const locale of expected) {
        press(key);

        expect(getLocale()).toBe(locale);
        const checked = checkedRadio('language-row') as HTMLElement;
        expect(readableText(checked)).toBe(locale === 'en' ? 'English' : '中文');
        expect(document.activeElement, `focus after switching to ${locale}`).toBe(checked);
        expect(checked.tabIndex, 'the focused option is the one Tab comes back to').toBe(0);
        expect(sheet.contains(checked)).toBe(true);
      }
    });

    it('keeps focus on another control when the language changes underneath it', () => {
      createMenu();
      const sheet = openSettings();
      stepButton('lives-row', '+').focus();

      setLocale('zh-CN');

      const focused = document.activeElement as HTMLElement;
      expect(sheet.contains(focused)).toBe(true);
      expect(focused).toBe(stepButton('lives-row', '+'));
    });

    it('keeps Advanced expanded and the values as they were', () => {
      saveStartFlowSettings({ startLevel: 4, difficulty: 2 });
      createMenu();
      openSettings();
      openAdvanced();

      click(languageRadio('zh-CN'));

      expect(byId('advanced-toggle').getAttribute('aria-expanded')).toBe('true');
      expect(isOperable(stepButton('level-row', '+'))).toBe(true);
      expect(readableText(byId('level-row'))).toContain('第4关');
      expect(valueText('difficulty')).toBe('简单');
      expect(loadStartFlowSettings()).toMatchObject({ startLevel: 4, difficulty: 2 });
    });

    it('returns focus to the Settings action, in the new language, when the sheet closes', () => {
      createMenu();
      openSettings();
      click(languageRadio('zh-CN'));

      press('Escape');
      finishSheetTransitions();

      const settingsButton = byId('settings-btn');
      expect(document.activeElement).toBe(settingsButton);
      expect(settingsButton.isConnected).toBe(true);
      expect(readableText(settingsButton)).toBe('设置');
    });

    it('switches back to English the same way', () => {
      saveStartFlowSettings({ language: 'zh-CN' });
      setLocale('zh-CN');
      createMenu();
      openSettings();
      expect(readableText(checkedRadio('language-row'))).toBe('中文');

      click(languageRadio('en'));

      expect(getLocale()).toBe('en');
      expect(storedSettings().language).toBe('en');
      expect(readableText(byId('start-btn'))).toContain('New Campaign');
      expect(readableText(byId('difficulty-row'))).toMatch(/Difficulty/);
      expect(isDialogShowing(SETTINGS_SHEET)).toBe(true);
    });

    it('hands the chosen language to onStart', () => {
      const startMenu = createMenu();
      openSettings();
      click(languageRadio('zh-CN'));
      expect(startRun(startMenu).language).toBe('zh-CN');
    });

    it('follows a language change made elsewhere (pause menu) and does not write the old one back', () => {
      const startMenu = createMenu();
      openSettings();

      // 暂停菜单的做法：保存语言，再切换界面语言
      saveStartFlowSettings({ language: 'zh-CN' });
      setLocale('zh-CN');
      expect(readableText(checkedRadio('language-row'))).toBe('中文');

      click(stepButton('difficulty-row', '+'));

      expect(storedSettings().language).toBe('zh-CN');
      expect(startRun(startMenu).language).toBe('zh-CN');
    });
  });
});
