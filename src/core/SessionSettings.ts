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
    testScore: clampInt(
      source.testScore,
      0,
      5000,
      DEFAULT_START_FLOW_SETTINGS.testScore
    ),
  };
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
