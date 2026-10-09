import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityPreset } from '@/config';
import {
  DEFAULT_START_FLOW_SETTINGS,
  LANGUAGE_ENDONYMS,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { getLocale, setLocale, type Locale, type LocalizedText } from '@/i18n';
import { PauseMenu } from '@/ui/PauseMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

interface IPauseMenuOptions {
  onContinue: () => void;
  onUpgrade: () => void;
  onExitToMenu: () => void;
  applyAudio: (sfx: number, music: number) => void;
  applyVoice?: (voice: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}

const QUALITY_PRESETS: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];

/** 暂停菜单的文案（英文默认，中文可切换） */
const LABELS = {
  resume: { en: 'Resume', zh: '继续' },
  upgrades: { en: 'Upgrades', zh: '升级' },
  settings: { en: 'Settings', zh: '设置' },
  mainMenu: { en: 'Main Menu', zh: '返回菜单' },
  cancel: { en: 'Cancel', zh: '取消' },
  confirm: { en: 'Confirm', zh: '确定' },
  sfx: { en: 'Sound effects', zh: '音效' },
  music: { en: 'Music', zh: '音乐' },
  graphics: { en: 'Graphics', zh: '画质' },
  language: { en: 'Language', zh: '语言' },
  voice: { en: 'Voice', zh: '语音' },
} satisfies Record<string, LocalizedText>;

/** 只属于开始菜单的设置，不得出现在暂停菜单里 */
const FORBIDDEN_PAUSE_SETTINGS: readonly LocalizedText[] = [
  { en: 'Difficulty', zh: '难度' },
  { en: 'Lives', zh: '生命' },
  { en: 'Start level', zh: '起始关卡' },
  { en: 'Game mode', zh: '游戏模式' },
  { en: 'Test score', zh: '测试分数' },
];

const EXIT_CONFIRM_COPY: LocalizedText = {
  en: 'Return to the main menu? Your current progress will be lost.',
  zh: '返回主菜单？当前进度将丢失。',
};

function collectRelatedCss(element: HTMLElement): string {
  const chunks: string[] = [];
  let current: HTMLElement | null = element;
  while (current) {
    chunks.push(current.getAttribute('style') ?? '');
    current = current.parentElement;
  }
  for (const style of document.querySelectorAll('style')) {
    chunks.push(style.textContent ?? '');
  }
  return chunks.join('\n');
}

function findLabeledButton(label: string, root: ParentNode = document): HTMLButtonElement {
  const match = Array.from(root.querySelectorAll('button')).find((button) =>
    (button.textContent ?? '').includes(label)
  );
  expect(match, `expected a <button> labeled "${label}"`).toBeTruthy();
  return match as HTMLButtonElement;
}

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function assertClickableTouchButton(button: HTMLButtonElement): void {
  const pointerEvents = getComputedStyle(button).pointerEvents || button.style.pointerEvents;
  expect(pointerEvents, `${button.textContent} pointer-events`).not.toBe('none');
  expect(button.disabled).toBe(false);

  const computedMin = parsePx(getComputedStyle(button).minHeight);
  const computedHeight = parsePx(getComputedStyle(button).height);
  const inlineMin = parsePx(button.style.minHeight);
  const inlineHeight = parsePx(button.style.height);
  const sized = [computedMin, computedHeight, inlineMin, inlineHeight].find(
    (value): value is number => value != null && value >= 48
  );
  if (sized != null) {
    expect(sized).toBeGreaterThanOrEqual(48);
    return;
  }

  const css = collectRelatedCss(button);
  const declared = [...css.matchAll(/min-height\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((match) =>
    Number(match[1])
  );
  expect(
    declared.some((value) => value >= 48),
    `pause button "${button.textContent}" height should be at least 48px`
  ).toBe(true);
}

function hasEquivalentPanelWidth(css: string): boolean {
  const normalized = css.replace(/\s+/g, ' ');
  if (/min\(\s*360px\s*,/.test(normalized) && /100%\s*-\s*32px/.test(normalized)) {
    return true;
  }
  return (
    /max-width\s*:\s*360px/.test(normalized) && /calc\(\s*100%\s*-\s*32px\s*\)/.test(normalized)
  );
}

function readZIndex(element: HTMLElement): string {
  return element.style.zIndex || getComputedStyle(element).zIndex;
}

describe.each(LOCALES)('PauseMenu (%s)', (locale: Locale) => {
  let onContinue: ReturnType<typeof vi.fn>;
  let onUpgrade: ReturnType<typeof vi.fn>;
  let onExitToMenu: ReturnType<typeof vi.fn>;
  let applyAudio: ReturnType<typeof vi.fn>;
  let applyQuality: ReturnType<typeof vi.fn>;
  let loadSettings: ReturnType<typeof vi.fn>;
  let saveSettings: ReturnType<typeof vi.fn>;
  let stored: StartFlowSettings;
  let menu: PauseMenu | null;

  const label = (key: keyof typeof LABELS): string => textIn(LABELS[key], locale);

  function getPauseRoot(): HTMLElement {
    const byId = document.getElementById('pause-menu');
    if (byId) {
      return byId;
    }

    const continueButton = findLabeledButton(label('resume'));
    const root = continueButton.closest('div');
    expect(root, 'pause overlay root').toBeTruthy();
    return root as HTMLElement;
  }

  /** 含该标签且有 -/+ 两个按钮的最小元素 */
  function findSettingRow(rowLabel: string): HTMLElement {
    const root = getPauseRoot();
    const rows = Array.from(root.querySelectorAll<HTMLElement>('div, li, section, label, tr'));
    const row = rows
      .filter((element) => {
        const text = element.textContent ?? '';
        return text.includes(rowLabel) && element.querySelectorAll('button').length >= 2;
      })
      .sort((a, b) => (a.textContent?.length ?? Infinity) - (b.textContent?.length ?? Infinity))[0];
    expect(row, `settings row for ${rowLabel}`).toBeTruthy();
    return row as HTMLElement;
  }

  function clickSettingAdjust(rowLabel: string, direction: '+' | '-'): void {
    const row = findSettingRow(rowLabel);
    const buttons = Array.from(row.querySelectorAll('button'));
    const target = buttons.find((button) => {
      const text = (button.textContent ?? '').trim();
      return direction === '+' ? text === '+' : text === '-' || text === '−';
    });
    expect(target, `${rowLabel} ${direction} button`).toBeTruthy();
    (target as HTMLButtonElement).click();
  }

  function createMenu(options: Partial<IPauseMenuOptions> = {}): PauseMenu {
    menu = new PauseMenu({
      onContinue,
      onUpgrade,
      onExitToMenu,
      applyAudio,
      applyQuality,
      loadSettings,
      saveSettings,
      ...options,
    });
    return menu;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    setLocale(locale);
    // 应用里存储的语言总是与当前界面语言一致（启动时按存储的语言 setLocale）
    stored = { ...DEFAULT_START_FLOW_SETTINGS, language: locale };
    onContinue = vi.fn();
    onUpgrade = vi.fn();
    onExitToMenu = vi.fn();
    applyAudio = vi.fn();
    applyQuality = vi.fn();
    loadSettings = vi.fn(() => ({ ...stored }));
    saveSettings = vi.fn((partial: Partial<StartFlowSettings>) => {
      stored = { ...stored, ...partial };
    });
    menu = null;
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    resetLocale();
    document.body.innerHTML = '';
  });

  it('shows continue, upgrade, settings, and exit actions on the default view', () => {
    const pauseMenu = createMenu();
    pauseMenu.show();

    expect(pauseMenu.isVisible()).toBe(true);
    const continueButton = findLabeledButton(label('resume'));
    const upgradeButton = findLabeledButton(label('upgrades'));
    const settingsButton = findLabeledButton(label('settings'));
    const exitButton = findLabeledButton(label('mainMenu'));

    continueButton.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onUpgrade).not.toHaveBeenCalled();
    expect(onExitToMenu).not.toHaveBeenCalled();

    upgradeButton.click();
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).not.toHaveBeenCalled();

    expect(settingsButton).toBeTruthy();
    expect(exitButton).toBeTruthy();
    expect(document.body.textContent).not.toContain(textIn(EXIT_CONFIRM_COPY, locale));
  });

  it('covers mobile controls with z-index 200', () => {
    createMenu().show();

    const root = getPauseRoot();
    const css = collectRelatedCss(root);
    const overlayZ = readZIndex(root);
    const cssHasZ = /z-index\s*:\s*200\b/.test(css);
    expect(overlayZ === '200' || cssHasZ).toBe(true);
  });

  it('limits settings to sfx, music, quality and language with StartMenu stepping', () => {
    createMenu().show();
    findLabeledButton(label('settings')).click();

    const root = getPauseRoot();
    const settingsText = root.textContent ?? '';
    const rows = (['sfx', 'music', 'graphics', 'language'] as const).map((key) =>
      findSettingRow(label(key))
    );
    expect(new Set(rows).size, 'four separate settings rows').toBe(4);
    for (const forbidden of FORBIDDEN_PAUSE_SETTINGS) {
      const text = textIn(forbidden, locale);
      expect(settingsText, `pause settings should not include ${text}`).not.toContain(text);
    }

    clickSettingAdjust(label('sfx'), '+');
    expect(applyAudio).toHaveBeenCalled();
    const [sfx, music] = applyAudio.mock.calls[applyAudio.mock.calls.length - 1] as [
      number,
      number,
    ];
    expect(sfx).toBeCloseTo(0.8, 5);
    expect(music).toBeCloseTo(DEFAULT_START_FLOW_SETTINGS.musicVolume, 5);
    expect(saveSettings).toHaveBeenCalled();
    const savedAudio = saveSettings.mock.calls[
      saveSettings.mock.calls.length - 1
    ]?.[0] as Partial<StartFlowSettings>;
    expect(savedAudio.sfxVolume).toBeCloseTo(0.8, 5);

    clickSettingAdjust(label('graphics'), '+');
    expect(applyQuality).toHaveBeenCalledWith('performance');
    const savedQuality = saveSettings.mock.calls[
      saveSettings.mock.calls.length - 1
    ]?.[0] as Partial<StartFlowSettings>;
    expect(savedQuality.qualityPreset).toBe('performance');
  });

  describe('Voice row', () => {
    function voiceRow(): HTMLElement | null {
      return getPauseRoot().querySelector<HTMLElement>('[data-setting="voice"]');
    }

    function lastSaved(): Partial<StartFlowSettings> {
      return saveSettings.mock.calls[
        saveSettings.mock.calls.length - 1
      ]?.[0] as Partial<StartFlowSettings>;
    }

    it('adds a Voice row when the game wires the voice volume', () => {
      createMenu({ applyVoice: vi.fn() }).show();
      findLabeledButton(label('settings')).click();

      const rows = (['sfx', 'music', 'voice', 'graphics', 'language'] as const).map((key) =>
        findSettingRow(label(key))
      );
      expect(new Set(rows).size, 'five separate settings rows').toBe(5);
      expect(voiceRow()).toBe(findSettingRow(label('voice')));
      expect(voiceRow()?.textContent).toContain(label('voice'));
      expect(voiceRow()?.textContent).toContain('90%');
    });

    it('applies and saves each 10% step, between 0% (text only) and 100%', () => {
      const applyVoice = vi.fn();
      createMenu({ applyVoice }).show();
      findLabeledButton(label('settings')).click();

      clickSettingAdjust(label('voice'), '-');
      expect(applyVoice).toHaveBeenLastCalledWith(expect.closeTo(0.8, 5));
      expect(lastSaved().voiceVolume).toBeCloseTo(0.8, 5);
      expect(voiceRow()?.textContent).toContain('80%');
      expect(applyAudio, 'the voice row leaves sfx and music alone').not.toHaveBeenCalled();

      clickSettingAdjust(label('voice'), '+');
      clickSettingAdjust(label('voice'), '+');
      clickSettingAdjust(label('voice'), '+');
      expect(applyVoice).toHaveBeenLastCalledWith(1);
      expect(voiceRow()?.textContent).toContain('100%');

      for (let step = 0; step < 12; step++) {
        clickSettingAdjust(label('voice'), '-');
      }
      expect(applyVoice).toHaveBeenLastCalledWith(0);
      expect(lastSaved().voiceVolume).toBe(0);
      expect(voiceRow()?.textContent).toContain('0%');
    });

    it('opens with the stored voice volume', () => {
      stored = { ...stored, voiceVolume: 0.3 };
      createMenu({ applyVoice: vi.fn() }).show();
      findLabeledButton(label('settings')).click();
      expect(voiceRow()?.textContent).toContain('30%');
    });

    it('has no Voice row when nothing applies the voice volume', () => {
      createMenu().show();
      findLabeledButton(label('settings')).click();
      expect(voiceRow()).toBeNull();
      expect(getPauseRoot().textContent).not.toContain(label('voice'));
    });
  });

  it('wraps quality presets and clamps volume like StartMenu', () => {
    stored = {
      ...DEFAULT_START_FLOW_SETTINGS,
      language: locale,
      sfxVolume: 1,
      musicVolume: 0,
      qualityPreset: 'auto',
    };
    createMenu().show();
    findLabeledButton(label('settings')).click();

    clickSettingAdjust(label('sfx'), '+');
    expect(applyAudio.mock.calls[applyAudio.mock.calls.length - 1]?.[0]).toBeCloseTo(1, 5);
    clickSettingAdjust(label('music'), '-');
    expect(applyAudio.mock.calls[applyAudio.mock.calls.length - 1]?.[1]).toBeCloseTo(0, 5);

    clickSettingAdjust(label('graphics'), '-');
    expect(applyQuality).toHaveBeenCalledWith(QUALITY_PRESETS[QUALITY_PRESETS.length - 1]);
  });

  it('switches the interface language from its Language row, re-rendering in place', () => {
    const other: Locale = locale === 'en' ? 'zh-CN' : 'en';
    createMenu().show();
    findLabeledButton(label('settings')).click();
    expect(getPauseRoot().textContent).toContain(LANGUAGE_ENDONYMS[locale]);

    clickSettingAdjust(label('language'), '+');

    expect(getLocale()).toBe(other);
    expect(saveSettings).toHaveBeenLastCalledWith({ language: other });
    expect(stored.language).toBe(other);
    const root = getPauseRoot();
    expect(root.textContent, 'still on the settings view').toContain(
      textIn(LABELS.graphics, other)
    );
    expect(root.textContent).toContain(textIn(LABELS.language, other));
    expect(root.textContent).toContain(LANGUAGE_ENDONYMS[other]);
    expect(root.textContent).not.toContain(textIn(LABELS.graphics, locale));

    clickSettingAdjust(textIn(LABELS.language, other), '+');
    expect(getLocale()).toBe(locale);
    expect(getPauseRoot().textContent).toContain(label('graphics'));
  });

  it(`confirms ${textIn(LABELS.mainMenu, locale)} before calling onExitToMenu`, () => {
    createMenu().show();
    findLabeledButton(label('mainMenu')).click();

    expect(onExitToMenu).not.toHaveBeenCalled();
    expect(getPauseRoot().textContent).toContain(textIn(EXIT_CONFIRM_COPY, locale));

    const cancel = findLabeledButton(label('cancel'));
    const confirm = findLabeledButton(label('confirm'));
    assertClickableTouchButton(cancel);
    assertClickableTouchButton(confirm);

    cancel.click();
    expect(onExitToMenu).not.toHaveBeenCalled();
    expect(getPauseRoot().textContent).not.toContain(textIn(EXIT_CONFIRM_COPY, locale));

    findLabeledButton(label('mainMenu')).click();
    findLabeledButton(label('confirm')).click();
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
  });

  it('uses a touch-sized panel with safe-area insets', () => {
    createMenu().show();

    const buttons = (['resume', 'upgrades', 'settings', 'mainMenu'] as const).map((key) =>
      findLabeledButton(label(key))
    );
    for (const button of buttons) {
      assertClickableTouchButton(button);
    }

    const root = getPauseRoot();
    const css = collectRelatedCss(root);
    expect(hasEquivalentPanelWidth(css)).toBe(true);
    expect(css).toMatch(/env\(\s*safe-area-inset-top/);
    expect(css).toMatch(/env\(\s*safe-area-inset-right/);
    expect(css).toMatch(/env\(\s*safe-area-inset-bottom/);
    expect(css).toMatch(/env\(\s*safe-area-inset-left/);
  });

  it('hides and disposes the overlay', () => {
    const pauseMenu = createMenu();
    pauseMenu.show();
    expect(pauseMenu.isVisible()).toBe(true);

    pauseMenu.hide();
    expect(pauseMenu.isVisible()).toBe(false);
    const overlayAfterHide = document.getElementById('pause-menu');
    if (overlayAfterHide?.isConnected) {
      const display = overlayAfterHide.style.display || getComputedStyle(overlayAfterHide).display;
      const hidden =
        display === 'none' ||
        overlayAfterHide.style.visibility === 'hidden' ||
        overlayAfterHide.getAttribute('aria-hidden') === 'true';
      expect(hidden).toBe(true);
    }

    pauseMenu.dispose();
    menu = null;
    expect(document.getElementById('pause-menu')).toBeNull();
    expect(
      Array.from(document.querySelectorAll('button')).some((button) =>
        (button.textContent ?? '').includes(label('resume'))
      )
    ).toBe(false);
  });
});
