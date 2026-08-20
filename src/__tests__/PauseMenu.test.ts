import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityPreset } from '@/config';
import { DEFAULT_START_FLOW_SETTINGS, type StartFlowSettings } from '@/core/SessionSettings';
import { PauseMenu } from '@/ui/PauseMenu';

interface IPauseMenuOptions {
  onContinue: () => void;
  onUpgrade: () => void;
  onExitToMenu: () => void;
  applyAudio: (sfx: number, music: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}

const QUALITY_PRESETS: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];
const FORBIDDEN_PAUSE_SETTINGS = ['难度', '生命', '起始关卡', '游戏模式', '测试分数'];
const EXIT_CONFIRM_COPY = '返回主菜单？当前进度将丢失。';

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

function getPauseRoot(): HTMLElement {
  const byId = document.getElementById('pause-menu');
  if (byId) {
    return byId;
  }

  const continueButton = findLabeledButton('继续');
  const root = continueButton.closest('div');
  expect(root, 'pause overlay root').toBeTruthy();
  return root as HTMLElement;
}

function readZIndex(element: HTMLElement): string {
  return element.style.zIndex || getComputedStyle(element).zIndex;
}

function clickSettingAdjust(label: string, direction: '+' | '-'): void {
  const root = getPauseRoot();
  const rows = Array.from(root.querySelectorAll<HTMLElement>('div, li, section, label, tr'));
  const row = rows
    .filter((element) => {
      const text = element.textContent ?? '';
      return text.includes(label) && element.querySelectorAll('button').length >= 2;
    })
    .sort((a, b) => (a.textContent?.length ?? Infinity) - (b.textContent?.length ?? Infinity))[0];
  expect(row, `settings row for ${label}`).toBeTruthy();

  const buttons = Array.from((row as HTMLElement).querySelectorAll('button'));
  const target = buttons.find((button) => {
    const text = (button.textContent ?? '').trim();
    return direction === '+' ? text === '+' : text === '-' || text === '−';
  });
  expect(target, `${label} ${direction} button`).toBeTruthy();
  (target as HTMLButtonElement).click();
}

describe('PauseMenu', () => {
  let onContinue: ReturnType<typeof vi.fn>;
  let onUpgrade: ReturnType<typeof vi.fn>;
  let onExitToMenu: ReturnType<typeof vi.fn>;
  let applyAudio: ReturnType<typeof vi.fn>;
  let applyQuality: ReturnType<typeof vi.fn>;
  let loadSettings: ReturnType<typeof vi.fn>;
  let saveSettings: ReturnType<typeof vi.fn>;
  let stored: StartFlowSettings;
  let menu: PauseMenu | null;

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
    stored = { ...DEFAULT_START_FLOW_SETTINGS };
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
    document.body.innerHTML = '';
  });

  it('shows continue, upgrade, settings, and exit actions on the default view', () => {
    const pauseMenu = createMenu();
    pauseMenu.show();

    expect(pauseMenu.isVisible()).toBe(true);
    const continueButton = findLabeledButton('继续');
    const upgradeButton = findLabeledButton('升级');
    const settingsButton = findLabeledButton('设置');
    const exitButton = findLabeledButton('返回菜单');

    continueButton.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onUpgrade).not.toHaveBeenCalled();
    expect(onExitToMenu).not.toHaveBeenCalled();

    upgradeButton.click();
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).not.toHaveBeenCalled();

    expect(settingsButton).toBeTruthy();
    expect(exitButton).toBeTruthy();
    expect(document.body.textContent).not.toContain(EXIT_CONFIRM_COPY);
  });

  it('covers mobile controls with z-index 200', () => {
    createMenu().show();

    const root = getPauseRoot();
    const css = collectRelatedCss(root);
    const overlayZ = readZIndex(root);
    const cssHasZ = /z-index\s*:\s*200\b/.test(css);
    expect(overlayZ === '200' || cssHasZ).toBe(true);
  });

  it('limits settings to sfx, music, and quality with StartMenu stepping', () => {
    createMenu().show();
    findLabeledButton('设置').click();

    const root = getPauseRoot();
    const settingsText = root.textContent ?? '';
    expect(settingsText).toMatch(/音效/);
    expect(settingsText).toMatch(/音乐/);
    expect(settingsText).toMatch(/画质/);
    for (const label of FORBIDDEN_PAUSE_SETTINGS) {
      expect(settingsText, `pause settings should not include ${label}`).not.toContain(label);
    }

    clickSettingAdjust('音效', '+');
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

    clickSettingAdjust('画质', '+');
    expect(applyQuality).toHaveBeenCalledWith('performance');
    const savedQuality = saveSettings.mock.calls[
      saveSettings.mock.calls.length - 1
    ]?.[0] as Partial<StartFlowSettings>;
    expect(savedQuality.qualityPreset).toBe('performance');
  });

  it('wraps quality presets and clamps volume like StartMenu', () => {
    stored = {
      ...DEFAULT_START_FLOW_SETTINGS,
      sfxVolume: 1,
      musicVolume: 0,
      qualityPreset: 'auto',
    };
    createMenu().show();
    findLabeledButton('设置').click();

    clickSettingAdjust('音效', '+');
    expect(applyAudio.mock.calls[applyAudio.mock.calls.length - 1]?.[0]).toBeCloseTo(1, 5);
    clickSettingAdjust('音乐', '-');
    expect(applyAudio.mock.calls[applyAudio.mock.calls.length - 1]?.[1]).toBeCloseTo(0, 5);

    clickSettingAdjust('画质', '-');
    expect(applyQuality).toHaveBeenCalledWith(QUALITY_PRESETS[QUALITY_PRESETS.length - 1]);
  });

  it('confirms 返回菜单 before calling onExitToMenu', () => {
    createMenu().show();
    findLabeledButton('返回菜单').click();

    expect(onExitToMenu).not.toHaveBeenCalled();
    expect(getPauseRoot().textContent).toContain(EXIT_CONFIRM_COPY);

    const cancel = findLabeledButton('取消');
    const confirm = findLabeledButton('确定');
    assertClickableTouchButton(cancel);
    assertClickableTouchButton(confirm);

    cancel.click();
    expect(onExitToMenu).not.toHaveBeenCalled();
    expect(getPauseRoot().textContent).not.toContain(EXIT_CONFIRM_COPY);

    findLabeledButton('返回菜单').click();
    findLabeledButton('确定').click();
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
  });

  it('uses a touch-sized panel with safe-area insets', () => {
    createMenu().show();

    const buttons = ['继续', '升级', '设置', '返回菜单'].map((label) => findLabeledButton(label));
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
        (button.textContent ?? '').includes('继续')
      )
    ).toBe(false);
  });
});
