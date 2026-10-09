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
  START_MENU_STORAGE_KEY,
  createSessionSettingsSnapshot,
  loadStartFlowSettings,
  normalizeStartFlowSettings,
  saveStartFlowSettings,
} from '@/core/SessionSettings';
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

  describe('#camera-row', () => {
    it('toggles the camera mode, persists it and hands it to onStart', () => {
      const startMenu = createMenu();
      expect(document.getElementById('camera-row')).not.toBeNull();
      const thirdPersonText = rowText('camera-row');

      rowButton('camera-row', '+').click();
      const firstPersonText = rowText('camera-row');
      expect(firstPersonText).not.toBe(thirdPersonText);
      expect(loadStartFlowSettings().cameraMode).toBe('first-person');

      let started: GameSettings | null = null;
      startMenu.setOnStart((settings) => {
        started = settings;
      });
      (document.getElementById('start-btn') as HTMLButtonElement).click();
      expect((started as GameSettings | null)?.cameraMode).toBe('first-person');

      rowButton('camera-row', '-').click();
      expect(rowText('camera-row')).toBe(thirdPersonText);
      expect(loadStartFlowSettings().cameraMode).toBe('third-person');
    });

    it('opens with the persisted camera mode', () => {
      createMenu();
      const thirdPersonText = rowText('camera-row');
      menu?.dispose();
      document.body.innerHTML = '';

      saveStartFlowSettings({ cameraMode: 'first-person' });
      createMenu();
      expect(rowText('camera-row')).not.toBe(thirdPersonText);
    });
  });

  describe('#language-row', () => {
    function startButtonText(): string {
      return document.getElementById('start-btn')?.textContent ?? '';
    }

    it('starts in English and switches the whole menu to Chinese, persisting the choice', () => {
      createMenu();
      expect(rowText('language-row')).toContain('Language');
      expect(rowText('language-row')).toContain('English');
      expect(startButtonText()).toBe('Start Game');
      expect(rowText('level-row')).toContain('Start level');

      rowButton('language-row', '+').click();

      expect(getLocale()).toBe('zh-CN');
      expect(document.documentElement.lang).toBe('zh-CN');
      expect(loadStartFlowSettings().language).toBe('zh-CN');
      expect(rowText('language-row')).toContain('语言');
      expect(rowText('language-row')).toContain('中文');
      expect(startButtonText()).toBe('开始游戏');
      expect(rowText('level-row')).toContain('起始关卡');

      rowButton('language-row', '-').click();
      expect(getLocale()).toBe('en');
      expect(loadStartFlowSettings().language).toBe('en');
      expect(rowText('language-row')).toContain('English');
      expect(startButtonText()).toBe('Start Game');
    });

    it('hands the chosen language to onStart', () => {
      const startMenu = createMenu();
      rowButton('language-row', '+').click();
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
      expect(rowText('language-row')).toContain('中文');
      expect(startButtonText()).toBe('开始游戏');
      setLocale('en');
      expect(rowText('language-row')).toContain('English');
      expect(startButtonText()).toBe('Start Game');
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
