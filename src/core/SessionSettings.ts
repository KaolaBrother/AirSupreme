import { type QualityPreset } from '@/config';

export type GameMode = 'normal' | 'boss';

export interface AudioSettings {
  sfxVolume: number;
  musicVolume: number;
}

export interface PresentationSettings {
  qualityPreset: QualityPreset;
  tutorialEnabled: boolean;
}

export interface StartFlowSettings {
  difficulty: number;
  sfxVolume: number;
  musicVolume: number;
  qualityPreset: QualityPreset;
  tutorialEnabled: boolean;
  playerLives: number;
  startLevel: number;
  gameMode: GameMode;
  testScore: number;
}

export interface SessionSettingsSnapshot {
  difficulty: number;
  qualityPreset: QualityPreset;
  audioSettings: AudioSettings;
  tutorialEnabled: boolean;
  mode: GameMode;
  level: number;
}

export const DEFAULT_START_FLOW_SETTINGS: StartFlowSettings = {
  difficulty: 3,
  sfxVolume: 0.7,
  musicVolume: 0.7,
  qualityPreset: 'auto',
  tutorialEnabled: true,
  playerLives: 3,
  startLevel: 1,
  gameMode: 'normal',
  testScore: 0,
};

/** 开始菜单与暂停设置共用的 localStorage 键 */
export const START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings';

export const TEST_SCORE_OPTIONS = [0, 5000, 10000, 15000, 20000] as const;
export type TestScoreOption = (typeof TEST_SCORE_OPTIONS)[number];
export const MAX_TEST_SCORE = TEST_SCORE_OPTIONS[TEST_SCORE_OPTIONS.length - 1];

const QUALITY_PRESETS: QualityPreset[] = ['auto', 'performance', 'balanced', 'quality'];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeQualityPreset(
  value: unknown,
  fallback: QualityPreset = DEFAULT_START_FLOW_SETTINGS.qualityPreset
): QualityPreset {
  if (typeof value === 'string' && QUALITY_PRESETS.includes(value as QualityPreset)) {
    return value as QualityPreset;
  }

  return fallback;
}

function normalizeGameMode(value: unknown, fallback: GameMode = 'normal'): GameMode {
  return value === 'boss' ? 'boss' : fallback;
}

function normalizeTestScore(
  value: unknown,
  fallback: TestScoreOption = 0
): TestScoreOption {
  const clamped = clampInt(value, 0, MAX_TEST_SCORE, fallback);
  let closest: TestScoreOption = TEST_SCORE_OPTIONS[0];
  let closestDistance = Math.abs(clamped - closest);

  for (const option of TEST_SCORE_OPTIONS) {
    const distance = Math.abs(clamped - option);
    if (distance < closestDistance) {
      closest = option;
      closestDistance = distance;
    }
  }

  return closest;
}

export function normalizeStartFlowSettings(raw?: Partial<StartFlowSettings>): StartFlowSettings {
  const source = raw ?? {};

  return {
    difficulty: clampInt(
      source.difficulty,
      1,
      5,
      DEFAULT_START_FLOW_SETTINGS.difficulty
    ),
    sfxVolume: clampUnit(source.sfxVolume, DEFAULT_START_FLOW_SETTINGS.sfxVolume),
    musicVolume: clampUnit(source.musicVolume, DEFAULT_START_FLOW_SETTINGS.musicVolume),
    qualityPreset: normalizeQualityPreset(source.qualityPreset),
    tutorialEnabled:
      typeof source.tutorialEnabled === 'boolean'
        ? source.tutorialEnabled
        : DEFAULT_START_FLOW_SETTINGS.tutorialEnabled,
    playerLives: clampInt(
      source.playerLives,
      1,
      9,
      DEFAULT_START_FLOW_SETTINGS.playerLives
    ),
    startLevel: clampInt(
      source.startLevel,
      1,
      5,
      DEFAULT_START_FLOW_SETTINGS.startLevel
    ),
    gameMode: normalizeGameMode(source.gameMode, DEFAULT_START_FLOW_SETTINGS.gameMode),
    testScore: normalizeTestScore(source.testScore),
  };
}

function getLocalStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    if (
      !storage ||
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function' ||
      typeof storage.removeItem !== 'function'
    ) {
      return null;
    }

    return storage;
  } catch {
    return null;
  }
}

/** 读取并规范化开始流程设置；损坏或不可用时回退默认值。 */
export function loadStartFlowSettings(): StartFlowSettings {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      return normalizeStartFlowSettings();
    }

    const raw = storage.getItem(START_MENU_STORAGE_KEY);
    if (!raw) {
      return normalizeStartFlowSettings();
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StartFlowSettings>;
      return normalizeStartFlowSettings(parsed);
    } catch {
      try {
        storage.removeItem(START_MENU_STORAGE_KEY);
      } catch {
        // 清除失败时仍回退默认值，避免抛出
      }
      return normalizeStartFlowSettings();
    }
  } catch {
    return normalizeStartFlowSettings();
  }
}

/**
 * 与已存储字段合并后再规范化写入。
 * 暂停菜单只写音量时不得重置难度 / 生命 / 关卡 / 模式 / 测试分数。
 */
export function saveStartFlowSettings(settings?: Partial<StartFlowSettings>): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  const previous = loadStartFlowSettings();
  const normalized = normalizeStartFlowSettings({
    ...previous,
    ...settings,
  });

  try {
    storage.setItem(START_MENU_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 配额或隐私模式写入失败时静默忽略
  }
}

export function getAudioSettings(settings: Pick<StartFlowSettings, 'sfxVolume' | 'musicVolume'>): AudioSettings {
  return {
    sfxVolume: clampUnit(settings.sfxVolume, DEFAULT_START_FLOW_SETTINGS.sfxVolume),
    musicVolume: clampUnit(settings.musicVolume, DEFAULT_START_FLOW_SETTINGS.musicVolume),
  };
}

export function getPresentationSettings(
  settings: Pick<StartFlowSettings, 'qualityPreset' | 'tutorialEnabled'>
): PresentationSettings {
  return {
    qualityPreset: normalizeQualityPreset(settings.qualityPreset),
    tutorialEnabled:
      typeof settings.tutorialEnabled === 'boolean'
        ? settings.tutorialEnabled
        : DEFAULT_START_FLOW_SETTINGS.tutorialEnabled,
  };
}

export function createSessionSettingsSnapshot(
  settings: Pick<
    StartFlowSettings,
    'difficulty' | 'qualityPreset' | 'tutorialEnabled' | 'gameMode' | 'startLevel'
  > &
    Pick<StartFlowSettings, 'sfxVolume' | 'musicVolume'>
): SessionSettingsSnapshot {
  const normalized = normalizeStartFlowSettings(settings);

  return {
    difficulty: normalized.difficulty,
    qualityPreset: normalized.qualityPreset,
    audioSettings: getAudioSettings(normalized),
    tutorialEnabled: normalized.tutorialEnabled,
    mode: normalized.gameMode,
    level: normalized.startLevel,
  };
}
