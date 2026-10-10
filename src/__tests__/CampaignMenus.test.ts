import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SAVE_KEY,
  describeCheckpoint,
  loadCampaignCheckpoint,
  saveCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import {
  DEFAULT_START_FLOW_SETTINGS,
  DEFAULT_VOICE_VOLUME,
  START_MENU_STORAGE_KEY,
  createSessionSettingsSnapshot,
  loadStartFlowSettings,
  normalizeStartFlowSettings,
  saveStartFlowSettings,
} from '@/core/SessionSettings';
import { getDifficultyProfile } from '@/core/Difficulty';
import { TOTAL_LEVELS, getCampaignChapter } from '@/features/campaign/CampaignData';
import { PlayerUpgrades, UPGRADE_CONFIGS, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { getLocale, setLocale } from '@/i18n';
import { StartMenu, type GameSettings } from '@/ui/StartMenu';
import { UpgradeMenu } from '@/ui/UpgradeMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

type CheckpointInput = Omit<CampaignSaveData, 'version' | 'savedAt'>;

const CHECKPOINT: CheckpointInput = {
  checkpoint: 'wave',
  level: 6,
  wave: 2,
  difficulty: 4,
  score: 15_200,
  lives: 2,
  missiles: 4,
  upgrades: {},
  weapons: { unlocked: ['rockets', 'laser', 'swarm'], selected: 'swarm', ammo: { rockets: 2 } },
  flares: 2,
  cameraMode: 'first-person',
  stats: { kills: 50, civiliansLost: 0, deaths: 1, playTimeSeconds: 900 },
};

const WEAPON_TRACKS: readonly UpgradeType[] = [
  UpgradeType.WEAPON_ROCKETS,
  UpgradeType.WEAPON_LASER,
  UpgradeType.WEAPON_SWARM,
  UpgradeType.WEAPON_RAILGUN,
  UpgradeType.WEAPON_EMP,
];

function isShown(element: HTMLElement | null): boolean {
  return element !== null && element.style.display !== 'none' && !element.hidden;
}

function rowButton(rowId: string, label: '+' | '-'): HTMLButtonElement {
  const row = document.getElementById(rowId);
  expect(row, `expected #${rowId}`).not.toBeNull();
  const button = Array.from(row?.querySelectorAll('button') ?? []).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(button, `expected a ${label} button in #${rowId}`).toBeDefined();
  return button as HTMLButtonElement;
}

function rowText(rowId: string): string {
  return document.getElementById(rowId)?.textContent ?? '';
}

/** 分段单选的设置行（视角 / 语言）里的全部选项 */
function rowOptions(rowId: string): HTMLElement[] {
  const row = document.getElementById(rowId);
  expect(row, `expected #${rowId}`).not.toBeNull();
  return Array.from(row?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);
}

/** 当前选中的那个选项的文字 */
function selectedOption(rowId: string): string {
  const selected = rowOptions(rowId).filter(
    (option) => option.getAttribute('aria-checked') === 'true'
  );
  expect(selected, `exactly one option is selected in #${rowId}`).toHaveLength(1);
  return selected[0]?.textContent?.trim() ?? '';
}

function rowOption(rowId: string, label: string): HTMLElement {
  const option = rowOptions(rowId).find((candidate) => candidate.textContent?.trim() === label);
  expect(option, `expected a "${label}" option in #${rowId}`).toBeDefined();
  return option as HTMLElement;
}

/** 两个选项的行里没选中的那个 */
function otherOption(rowId: string): HTMLElement {
  const others = rowOptions(rowId).filter(
    (option) => option.getAttribute('aria-checked') !== 'true'
  );
  expect(others, `#${rowId} offers exactly one alternative`).toHaveLength(1);
  return others[0];
}

describe('SessionSettings campaign fields', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('clamps startLevel to 1..TOTAL_LEVELS', () => {
    expect(normalizeStartFlowSettings({ startLevel: 7 }).startLevel).toBe(7);
    expect(normalizeStartFlowSettings({ startLevel: TOTAL_LEVELS }).startLevel).toBe(10);
    expect(normalizeStartFlowSettings({ startLevel: 11 }).startLevel).toBe(TOTAL_LEVELS);
    expect(normalizeStartFlowSettings({ startLevel: 0 }).startLevel).toBe(1);
    expect(normalizeStartFlowSettings({ startLevel: -3 }).startLevel).toBe(1);
    expect(
      createSessionSettingsSnapshot({ ...DEFAULT_START_FLOW_SETTINGS, startLevel: 12 }).level
    ).toBe(TOTAL_LEVELS);
  });

  it('persists a start level beyond the old five-level range', () => {
    saveStartFlowSettings({ startLevel: 9 });
    expect(loadStartFlowSettings().startLevel).toBe(9);
  });

  it('defaults cameraMode to third-person and rejects unknown modes', () => {
    expect(DEFAULT_START_FLOW_SETTINGS.cameraMode).toBe('third-person');
    expect(normalizeStartFlowSettings({}).cameraMode).toBe('third-person');
    expect(normalizeStartFlowSettings().cameraMode).toBe('third-person');
    expect(normalizeStartFlowSettings({ cameraMode: 'first-person' }).cameraMode).toBe(
      'first-person'
    );
    const unknown = { cameraMode: 'cinematic' } as unknown as Parameters<
      typeof normalizeStartFlowSettings
    >[0];
    expect(normalizeStartFlowSettings(unknown).cameraMode).toBe('third-person');
  });

  it('persists cameraMode, and later partial saves keep it', () => {
    saveStartFlowSettings({ cameraMode: 'first-person' });
    const stored = JSON.parse(window.localStorage.getItem(START_MENU_STORAGE_KEY) ?? '{}') as {
      cameraMode?: unknown;
    };
    expect(stored.cameraMode).toBe('first-person');
    expect(loadStartFlowSettings().cameraMode).toBe('first-person');

    saveStartFlowSettings({ sfxVolume: 0.1 });
    expect(loadStartFlowSettings().cameraMode).toBe('first-person');
  });

  it('still loads settings saved before the camera option existed', () => {
    window.localStorage.setItem(
      START_MENU_STORAGE_KEY,
      JSON.stringify({
        difficulty: 4,
        sfxVolume: 0.5,
        musicVolume: 0.3,
        qualityPreset: 'balanced',
        tutorialEnabled: false,
        playerLives: 5,
        startLevel: 3,
        gameMode: 'boss',
        testScore: 5000,
      })
    );

    const loaded = loadStartFlowSettings();
    expect(loaded.cameraMode).toBe('third-person');
    expect(loaded.difficulty).toBe(4);
    expect(loaded.sfxVolume).toBe(0.5);
    expect(loaded.qualityPreset).toBe('balanced');
    expect(loaded.tutorialEnabled).toBe(false);
    expect(loaded.playerLives).toBe(5);
    expect(loaded.startLevel).toBe(3);
    expect(loaded.gameMode).toBe('boss');
    expect(loaded.testScore).toBe(5000);
  });
});

describe('SessionSettings voice volume', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to 0.9', () => {
    expect(DEFAULT_VOICE_VOLUME).toBe(0.9);
    expect(DEFAULT_START_FLOW_SETTINGS.voiceVolume).toBe(0.9);
    expect(normalizeStartFlowSettings().voiceVolume).toBe(0.9);
    expect(normalizeStartFlowSettings({}).voiceVolume).toBe(0.9);
    expect(loadStartFlowSettings().voiceVolume).toBe(0.9);
  });

  it('clamps to 0..1 and falls back to the default for junk', () => {
    expect(normalizeStartFlowSettings({ voiceVolume: 0 }).voiceVolume).toBe(0);
    expect(normalizeStartFlowSettings({ voiceVolume: 0.35 }).voiceVolume).toBe(0.35);
    expect(normalizeStartFlowSettings({ voiceVolume: 1.6 }).voiceVolume).toBe(1);
    expect(normalizeStartFlowSettings({ voiceVolume: -0.2 }).voiceVolume).toBe(0);
    expect(normalizeStartFlowSettings({ voiceVolume: Number.NaN }).voiceVolume).toBe(0.9);
    const junk = { voiceVolume: 'loud' } as unknown as Parameters<
      typeof normalizeStartFlowSettings
    >[0];
    expect(normalizeStartFlowSettings(junk).voiceVolume).toBe(0.9);
  });

  it('persists, and later partial saves keep it', () => {
    saveStartFlowSettings({ voiceVolume: 0.3 });
    const stored = JSON.parse(window.localStorage.getItem(START_MENU_STORAGE_KEY) ?? '{}') as {
      voiceVolume?: unknown;
    };
    expect(stored.voiceVolume).toBe(0.3);
    expect(loadStartFlowSettings().voiceVolume).toBe(0.3);

    saveStartFlowSettings({ musicVolume: 0.2, language: 'zh-CN' });
    expect(loadStartFlowSettings().voiceVolume).toBe(0.3);
    saveStartFlowSettings({ voiceVolume: 0 });
    expect(loadStartFlowSettings().voiceVolume).toBe(0);
  });

  it('loads settings saved before the voice option existed with the default', () => {
    window.localStorage.setItem(
      START_MENU_STORAGE_KEY,
      JSON.stringify({
        difficulty: 2,
        sfxVolume: 0.4,
        musicVolume: 0.6,
        qualityPreset: 'quality',
        tutorialEnabled: true,
        playerLives: 4,
        startLevel: 5,
        gameMode: 'normal',
        testScore: 0,
        cameraMode: 'first-person',
        language: 'zh-CN',
      })
    );

    const loaded = loadStartFlowSettings();
    expect(loaded.voiceVolume).toBe(0.9);
    expect(loaded.sfxVolume).toBe(0.4);
    expect(loaded.musicVolume).toBe(0.6);
    expect(loaded.cameraMode).toBe('first-person');
    expect(loaded.language).toBe('zh-CN');
    expect(loaded.startLevel).toBe(5);
  });
});

describe('StartMenu campaign additions', () => {
  let menu: StartMenu | null = null;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.stubGlobal('requestIdleCallback', () => 1);
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    resetLocale();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('#continue-btn', () => {
    it('is not offered when there is no checkpoint', () => {
      createMenu();
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);
    });

    it('shows Continue Campaign with the describeCheckpoint text, in either language', () => {
      expect(saveCampaignCheckpoint(CHECKPOINT)).toBe(true);
      const save = loadCampaignCheckpoint() as CampaignSaveData;
      createMenu();

      const button = document.getElementById('continue-btn');
      expect(isShown(button)).toBe(true);
      expect(button?.textContent).toContain('Continue Campaign');
      expect(button?.textContent).toContain(describeCheckpoint(save));
      expect(button?.textContent).toContain('Ch. 6 · Heart of the Forge · Wave 3');

      setLocale('zh-CN');
      const localized = document.getElementById('continue-btn');
      expect(isShown(localized)).toBe(true);
      expect(localized?.textContent).toContain('继续战役');
      expect(localized?.textContent).toContain(describeCheckpoint(save));
      expect(localized?.textContent).toContain('第6关 · 熔炉之心 · 第3波');
    });

    it('stays hidden for a corrupt checkpoint, which is discarded', () => {
      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, '{broken');
      createMenu();
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);
      expect(window.localStorage.getItem(CAMPAIGN_SAVE_KEY)).toBeNull();
    });

    it('appears when the menu is shown again after a checkpoint was written', () => {
      const startMenu = createMenu();
      expect(isShown(document.getElementById('continue-btn'))).toBe(false);

      saveCampaignCheckpoint({ ...CHECKPOINT, checkpoint: 'boss', wave: 7 });
      startMenu.show();

      const button = document.getElementById('continue-btn');
      expect(isShown(button)).toBe(true);
      expect(button?.textContent).toContain('Ch. 6 · Heart of the Forge · Boss');
      setLocale('zh-CN');
      expect(document.getElementById('continue-btn')?.textContent).toContain(
        '第6关 · 熔炉之心 · Boss 战'
      );
    });

    it('fires setOnContinue with the validated save, not onStart', () => {
      saveCampaignCheckpoint(CHECKPOINT);
      const startMenu = createMenu();
      const onContinue = vi.fn();
      const onStart = vi.fn();
      startMenu.setOnContinue(onContinue);
      startMenu.setOnStart(onStart);

      (document.getElementById('continue-btn') as HTMLButtonElement).click();

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onContinue).toHaveBeenCalledWith(loadCampaignCheckpoint());
      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe('#level-row', () => {
    const LEVEL_LABEL = { en: 'Level {level}', zh: '第{level}关' };

    it.each(LOCALES)(
      'walks through all ten chapters with their titles and stops at the last (%s)',
      (locale) => {
        setLocale(locale);
        createMenu();
        const plus = rowButton('level-row', '+');
        const label = (level: number): string =>
          textIn(LEVEL_LABEL, locale).replace('{level}', String(level));

        for (let level = 1; level <= TOTAL_LEVELS; level++) {
          const text = rowText('level-row');
          expect(text, `level ${level}`).toContain(label(level));
          expect(text, `level ${level}`).toContain(textIn(getCampaignChapter(level).title, locale));
          plus.click();
        }

        // 已是最后一关，继续 + 不再前进
        expect(rowText('level-row')).toContain(label(TOTAL_LEVELS));
        expect(rowText('level-row')).toContain(
          textIn(getCampaignChapter(TOTAL_LEVELS).title, locale)
        );
        expect(loadStartFlowSettings().startLevel).toBe(TOTAL_LEVELS);
      }
    );

    it('starts the game at a level above five', () => {
      saveStartFlowSettings({ startLevel: 8 });
      const startMenu = createMenu();
      expect(rowText('level-row')).toContain(getCampaignChapter(8).title.en);

      let started: GameSettings | null = null;
      startMenu.setOnStart((settings) => {
        started = settings;
      });
      (document.getElementById('start-btn') as HTMLButtonElement).click();

      expect((started as GameSettings | null)?.startLevel).toBe(8);
    });
  });

  describe('#difficulty-row (wave 2: names from Difficulty.ts)', () => {
    const TIERS = [1, 2, 3, 4, 5] as const;
    const NAMES = {
      en: ['Very Easy', 'Easy', 'Normal', 'Hard', 'Expert'],
      zh: ['非常简单', '简单', '普通', '困难', '专家'],
    } as const;

    it('the tier names are the Difficulty.ts labels', () => {
      expect(TIERS.map((tier) => getDifficultyProfile(tier).label.en)).toEqual(NAMES.en);
      expect(TIERS.map((tier) => getDifficultyProfile(tier).label.zh)).toEqual(NAMES.zh);
    });

    it.each(LOCALES)('steps Very Easy → Expert with the Difficulty.ts names (%s)', (locale) => {
      setLocale(locale);
      createMenu();
      const names = locale === 'zh-CN' ? NAMES.zh : NAMES.en;
      const valueText = (): string =>
        document.getElementById('difficulty-value')?.textContent ?? '';
      const minus = rowButton('difficulty-row', '-');
      const plus = rowButton('difficulty-row', '+');

      for (let i = 0; i < 6; i++) minus.click();
      expect(valueText().trim()).toBe(names[0]);
      for (let tier = 2; tier <= 5; tier++) {
        plus.click();
        expect(valueText().trim(), `tier ${tier}`).toBe(names[tier - 1]);
        expect(valueText().trim()).toBe(textIn(getDifficultyProfile(tier).label, locale));
      }
      plus.click();
      expect(valueText().trim(), 'stops at Expert').toBe(names[4]);
    });

    it('relabels the row when the language changes', () => {
      createMenu();
      rowButton('difficulty-row', '+').click();
      const value = (): string => document.getElementById('difficulty-value')?.textContent ?? '';
      expect(value().trim()).toBe('Hard');
      setLocale('zh-CN');
      expect(value().trim()).toBe('困难');
    });

    it.each(TIERS)('hands the chosen difficulty %i to onStart', (tier) => {
      const startMenu = createMenu();
      const minus = rowButton('difficulty-row', '-');
      for (let i = 0; i < 6; i++) minus.click();
      for (let i = 1; i < tier; i++) rowButton('difficulty-row', '+').click();

      let started: GameSettings | null = null;
      startMenu.setOnStart((settings) => {
        started = settings;
      });
      (document.getElementById('start-btn') as HTMLButtonElement).click();
      expect((started as GameSettings | null)?.difficulty).toBe(tier);
    });

    it('names the saved difficulty on the Continue button', () => {
      saveCampaignCheckpoint({ ...CHECKPOINT, difficulty: 2 });
      createMenu();
      expect(document.getElementById('continue-btn')?.textContent).toContain('Easy');
      expect(document.getElementById('continue-btn')?.textContent).not.toContain('Very Easy');
      setLocale('zh-CN');
      const text = document.getElementById('continue-btn')?.textContent ?? '';
      expect(text).toContain('简单');
      expect(text).not.toContain('非常简单');
    });
  });

  // 批次 X5：视角与语言从“+ / -”步进行改成了分段单选（Settings 面板里），开新局的按钮叫“新战役”。
  describe('#camera-row', () => {
    it('toggles the camera mode, persists it and hands it to onStart', () => {
      const startMenu = createMenu();
      expect(document.getElementById('camera-row')).not.toBeNull();
      expect(rowOptions('camera-row')).toHaveLength(2);
      const thirdPersonText = selectedOption('camera-row');
      expect(loadStartFlowSettings().cameraMode).toBe('third-person');

      otherOption('camera-row').click();
      const firstPersonText = selectedOption('camera-row');
      expect(firstPersonText).not.toBe(thirdPersonText);
      expect(loadStartFlowSettings().cameraMode).toBe('first-person');

      otherOption('camera-row').click();
      expect(selectedOption('camera-row')).toBe(thirdPersonText);
      expect(loadStartFlowSettings().cameraMode).toBe('third-person');

      rowOption('camera-row', firstPersonText).click();
      let started: GameSettings | null = null;
      startMenu.setOnStart((settings) => {
        started = settings;
      });
      (document.getElementById('start-btn') as HTMLButtonElement).click();
      expect((started as GameSettings | null)?.cameraMode).toBe('first-person');
    });

    it('opens with the persisted camera mode', () => {
      createMenu();
      const thirdPersonText = selectedOption('camera-row');
      menu?.dispose();
      document.body.innerHTML = '';

      saveStartFlowSettings({ cameraMode: 'first-person' });
      createMenu();
      expect(selectedOption('camera-row')).not.toBe(thirdPersonText);
      expect(rowOption('camera-row', thirdPersonText).getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('#language-row', () => {
    function startButtonText(): string {
      return document.getElementById('start-btn')?.textContent ?? '';
    }

    it('starts in English and switches the whole menu to Chinese, persisting the choice', () => {
      createMenu();
      expect(rowText('language-row')).toContain('Language');
      expect(selectedOption('language-row')).toBe('English');
      expect(startButtonText()).toContain('New Campaign');
      expect(rowText('level-row')).toContain('Start level');

      rowOption('language-row', '中文').click();

      expect(getLocale()).toBe('zh-CN');
      expect(document.documentElement.lang).toBe('zh-CN');
      expect(loadStartFlowSettings().language).toBe('zh-CN');
      expect(rowText('language-row')).toContain('语言');
      expect(selectedOption('language-row')).toBe('中文');
      expect(startButtonText()).toContain('新战役');
      expect(startButtonText()).not.toContain('New Campaign');
      expect(rowText('level-row')).toContain('起始关卡');

      rowOption('language-row', 'English').click();
      expect(getLocale()).toBe('en');
      expect(loadStartFlowSettings().language).toBe('en');
      expect(selectedOption('language-row')).toBe('English');
      expect(startButtonText()).toContain('New Campaign');
    });

    it('hands the chosen language to onStart', () => {
      const startMenu = createMenu();
      rowOption('language-row', '中文').click();
      let started: GameSettings | null = null;
      startMenu.setOnStart((settings) => {
        started = settings;
      });
      (document.getElementById('start-btn') as HTMLButtonElement).click();
      expect((started as GameSettings | null)?.language).toBe('zh-CN');
    });

    it('follows a language change made elsewhere (e.g. the pause menu)', () => {
      createMenu();
      setLocale('zh-CN');
      expect(selectedOption('language-row')).toBe('中文');
      expect(startButtonText()).toContain('新战役');
      setLocale('en');
      expect(selectedOption('language-row')).toBe('English');
      expect(startButtonText()).toContain('New Campaign');
    });
  });

  describe('#voice-row', () => {
    const VOICE_LABEL = { en: 'Voice volume', zh: '语音音量' };

    function voiceValue(): string {
      return document.getElementById('voice-value')?.textContent ?? '';
    }

    it.each(LOCALES)(
      'shows the voice volume, 90% by default, in the interface language (%s)',
      (locale) => {
        setLocale(locale);
        createMenu();
        expect(rowText('voice-row')).toContain(textIn(VOICE_LABEL, locale));
        expect(voiceValue()).toBe('90%');

        const other = locale === 'en' ? 'zh-CN' : 'en';
        setLocale(other);
        expect(rowText('voice-row')).toContain(textIn(VOICE_LABEL, other));
        expect(voiceValue()).toBe('90%');
      }
    );

    it('steps by 10% between 0% (text only) and 100%, persisting each step', () => {
      createMenu();
      rowButton('voice-row', '+').click();
      expect(voiceValue()).toBe('100%');
      rowButton('voice-row', '+').click();
      expect(voiceValue()).toBe('100%');
      expect(loadStartFlowSettings().voiceVolume).toBe(1);

      for (let step = 0; step < 12; step++) {
        rowButton('voice-row', '-').click();
      }
      expect(voiceValue()).toBe('0%');
      expect(loadStartFlowSettings().voiceVolume).toBe(0);

      rowButton('voice-row', '+').click();
      expect(voiceValue()).toBe('10%');
      expect(loadStartFlowSettings().voiceVolume).toBeCloseTo(0.1, 5);
    });

    it('hands the voice volume to onStart', () => {
      const startMenu = createMenu();
      rowButton('voice-row', '-').click();
      rowButton('voice-row', '-').click();
      let started: GameSettings | null = null;
      startMenu.setOnStart((settings) => {
        started = settings;
      });
      (document.getElementById('start-btn') as HTMLButtonElement).click();
      expect((started as GameSettings | null)?.voiceVolume).toBeCloseTo(0.7, 5);
    });

    it('opens with the persisted voice volume', () => {
      saveStartFlowSettings({ voiceVolume: 0.3 });
      createMenu();
      expect(voiceValue()).toBe('30%');
    });
  });

  it('lists V, F, G, Tab and 1-5 in the controls legend', () => {
    createMenu();
    const legend = document.querySelector('#start-menu .controls-info');
    expect(legend, 'expected the controls legend').not.toBeNull();
    const text = legend?.textContent ?? '';

    expect(text).toMatch(/\bV\b/);
    expect(text).toMatch(/\bF\b/);
    expect(text).toMatch(/\bG\b/);
    expect(text).toMatch(/\bTab\b/);
    expect(text).toMatch(/\b1\b\s*[–-]\s*\b5\b/);
  });
});

describe('UpgradeMenu campaign additions', () => {
  let upgrades: PlayerUpgrades;
  let onResume: ReturnType<typeof vi.fn>;
  let onUpgrade: ReturnType<typeof vi.fn>;
  let menu: UpgradeMenu;

  function resumeButton(): HTMLButtonElement {
    const button = document.querySelector('#upgrade-menu .resume-btn');
    expect(button, 'expected the footer button').not.toBeNull();
    return button as HTMLButtonElement;
  }

  function upgradeButton(type: UpgradeType): HTMLButtonElement {
    const button = document.getElementById(`btn-${type}`);
    expect(button, `expected #btn-${type}`).not.toBeNull();
    return button as HTMLButtonElement;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    upgrades = new PlayerUpgrades();
    onResume = vi.fn();
    onUpgrade = vi.fn((type: UpgradeType) => {
      upgrades.upgrade(type);
    });
    menu = new UpgradeMenu(upgrades, onUpgrade, onResume);
  });

  afterEach(() => {
    menu.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  it('show() with no options keeps the pause behaviour', () => {
    menu.show();

    expect(document.querySelector('#upgrade-menu .upgrade-title')?.textContent).toBe('⚙️ Upgrades');
    expect(resumeButton().textContent).toBe('▶ Back to battle');
    setLocale('zh-CN');
    expect(menu.isVisible(), 'stays open across a language change').toBe(true);
    expect(document.querySelector('#upgrade-menu .upgrade-title')?.textContent).toBe('⚙️ 升级');
    expect(resumeButton().textContent).toBe('▶ 返回战斗');

    resumeButton().click();
    expect(onResume).toHaveBeenCalledTimes(1);
    // 暂停模式由调用方决定何时隐藏
    expect(menu.isVisible()).toBe(true);
  });

  it('hangar mode hides itself before calling onContinue instead of onResume', () => {
    let visibleDuringCallback: boolean | null = null;
    const onContinue = vi.fn(() => {
      visibleDuringCallback = menu.isVisible();
    });

    menu.show({ mode: 'hangar', onContinue });
    expect(menu.isVisible()).toBe(true);
    resumeButton().click();

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(visibleDuringCallback).toBe(false);
    expect(onResume).not.toHaveBeenCalled();
    expect(menu.isVisible()).toBe(false);
    expect((document.getElementById('upgrade-menu') as HTMLElement).style.display).toBe('none');
  });

  it.each(LOCALES)('titles the pause and hangar menus in the interface language (%s)', (locale) => {
    setLocale(locale);
    menu.show();
    expect(document.querySelector('#upgrade-menu .upgrade-title')?.textContent).toBe(
      textIn({ en: '⚙️ Upgrades', zh: '⚙️ 升级' }, locale)
    );
    menu.hide();
    menu.show({ mode: 'hangar' });
    expect(document.querySelector('#upgrade-menu .upgrade-title')?.textContent).toBe(
      textIn({ en: 'Refit & Rearm', zh: '机库整备' }, locale)
    );
  });

  it('hangar mode shows the given title and subtitle', () => {
    menu.show({ mode: 'hangar', title: '整备完毕', subtitle: '下一站：极光冰海' });
    const text = document.getElementById('upgrade-menu')?.textContent ?? '';
    expect(text).toContain('整备完毕');
    expect(text).toContain('下一站：极光冰海');
  });

  it('a later show() without options is the pause menu again', () => {
    const onContinue = vi.fn();
    menu.show({ mode: 'hangar', title: '机库', onContinue });
    menu.hide();

    menu.show();
    expect(document.querySelector('#upgrade-menu .upgrade-title')?.textContent).toBe('⚙️ Upgrades');
    resumeButton().click();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('renders a card and a button for all 14 tracks', () => {
    menu.show();
    for (const type of Object.values(UpgradeType)) {
      expect(document.getElementById(`upgrade-card-${type}`), type).not.toBeNull();
      expect(document.getElementById(`btn-${type}`), type).not.toBeNull();
    }
  });

  it('keeps weapon tracks unbuyable until the weapon is unlocked', () => {
    upgrades.addScore(100_000);
    upgrades.setCampaignLevel(TOTAL_LEVELS);
    menu.show();

    for (const type of WEAPON_TRACKS) {
      const button = upgradeButton(type);
      expect(button.classList.contains('available'), type).toBe(false);
      expect(button.classList.contains('locked'), type).toBe(true);
      button.click();
    }
    expect(onUpgrade).not.toHaveBeenCalled();

    upgrades.setUnlockedWeapons(['rockets']);
    menu.updateDisplay();
    const rockets = upgradeButton(UpgradeType.WEAPON_ROCKETS);
    expect(rockets.classList.contains('available')).toBe(true);
    rockets.click();
    expect(onUpgrade).toHaveBeenCalledWith(UpgradeType.WEAPON_ROCKETS);
    expect(upgrades.getLevel(UpgradeType.WEAPON_ROCKETS)).toBe(1);
    expect(upgradeButton(UpgradeType.WEAPON_LASER).classList.contains('available')).toBe(false);
  });

  it('stops offering a core track at its tier cap and shows the cap', () => {
    upgrades.addScore(100_000);
    upgrades.upgrade(UpgradeType.MAX_HEALTH);
    upgrades.upgrade(UpgradeType.MAX_HEALTH);
    menu.show();

    const button = upgradeButton(UpgradeType.MAX_HEALTH);
    expect(button.classList.contains('available')).toBe(false);
    button.click();
    expect(onUpgrade).not.toHaveBeenCalled();

    upgrades.setCampaignLevel(3);
    menu.updateDisplay();
    expect(upgradeButton(UpgradeType.MAX_HEALTH).classList.contains('available')).toBe(true);
    const speedCard = document.getElementById(`upgrade-card-${UpgradeType.SPEED}`);
    // 第 3 关核心属性上限 4/10
    expect(speedCard?.textContent).toContain(`4/${UPGRADE_CONFIGS[UpgradeType.SPEED].maxLevel}`);
  });
});
