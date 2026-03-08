import { LevelWaveEventType } from '@/features/terrain/LevelConfig';

export type OnboardingPhase = 'first-wave' | 'event-start' | 'event-complete';

export interface OnboardingMessageProfile {
  phase: OnboardingPhase;
  icon: string;
  title: string;
  text: string;
  durationMs: number;
}

export interface OnboardingWaveTextProfile {
  firstWaveStart: OnboardingMessageProfile;
  firstWaveComplete: OnboardingMessageProfile;
  eventStart: Record<LevelWaveEventType, OnboardingMessageProfile>;
  eventComplete: Record<LevelWaveEventType, OnboardingMessageProfile>;
}

export interface OnboardingWaveBeatProfile {
  isFirstWave: boolean;
  firstWaveLeadInMs: number;
  firstWaveHintDurationMs: number;

  eventPromptDelayMs: number;
  eventPromptHoldMs: number;
  eventCompletionDelayMs: number;
  eventCompletionHoldMs: number;
  eventCompletionObjectiveHoldMs: number;

  eventTypeLabel: string;
  eventBannerLabel: string;
}

const FIRST_WAVE_TEXT: Omit<OnboardingMessageProfile, 'phase'> = {
  icon: '⚔️',
  title: '第一波已到',
  text: '第一波到来，先稳机动再开火',
  durationMs: 1800,
};

const DEFAULT_EVENT_TEXT: Record<LevelWaveEventType, OnboardingMessageProfile> = {
  [LevelWaveEventType.ELITE_HUNT]: {
    phase: 'event-start',
    icon: '💠',
    title: '精英歼灭波次',
    text: '优先处理高威胁目标，打穿重装与王牌护甲',
    durationMs: 1800,
  },
  [LevelWaveEventType.INTERCEPT]: {
    phase: 'event-start',
    icon: '⚠️',
    title: '限时拦截波次',
    text: '压缩窗口优先拦截，清空突防前锋',
    durationMs: 1800,
  },
  [LevelWaveEventType.ESCORT_DEFENSE]: {
    phase: 'event-start',
    icon: '🛡️',
    title: '护送防守波次',
    text: '友军优先级提升，围拢后沿线递进压制',
    durationMs: 1800,
  },
};

const DEFAULT_EVENT_COMPLETE_TEXT: Record<LevelWaveEventType, OnboardingMessageProfile> = {
  [LevelWaveEventType.ELITE_HUNT]: {
    phase: 'event-complete',
    icon: '✅',
    title: '精英歼灭完成',
    text: '高威胁清空，空域压力明显下降',
    durationMs: 1600,
  },
  [LevelWaveEventType.INTERCEPT]: {
    phase: 'event-complete',
    icon: '✅',
    title: '拦截完成',
    text: '突防被压制，前线压力已回收',
    durationMs: 1600,
  },
  [LevelWaveEventType.ESCORT_DEFENSE]: {
    phase: 'event-complete',
    icon: '✅',
    title: '护送结束',
    text: '友军节点已稳，进入下一段节奏',
    durationMs: 1600,
  },
};

const FIRST_WAVE_BEAT: OnboardingWaveBeatProfile = {
  isFirstWave: true,
  firstWaveLeadInMs: 1200,
  firstWaveHintDurationMs: 1800,

  eventPromptDelayMs: 0,
  eventPromptHoldMs: 1800,
  eventCompletionDelayMs: 1500,
  eventCompletionHoldMs: 1600,
  eventCompletionObjectiveHoldMs: 2400,

  eventTypeLabel: '普通波次',
  eventBannerLabel: '第一波 · 入场引导',
};

const EVENT_BEATS: Record<LevelWaveEventType, OnboardingWaveBeatProfile> = {
  [LevelWaveEventType.ELITE_HUNT]: {
    isFirstWave: false,
    firstWaveLeadInMs: 0,
    firstWaveHintDurationMs: 0,
    eventPromptDelayMs: 300,
    eventPromptHoldMs: 1900,
    eventCompletionDelayMs: 900,
    eventCompletionHoldMs: 1700,
    eventCompletionObjectiveHoldMs: 2600,
    eventTypeLabel: '精英歼灭',
    eventBannerLabel: '精英歼灭 · 第 N 波',
  },
  [LevelWaveEventType.INTERCEPT]: {
    isFirstWave: false,
    firstWaveLeadInMs: 0,
    firstWaveHintDurationMs: 0,
    eventPromptDelayMs: 450,
    eventPromptHoldMs: 1850,
    eventCompletionDelayMs: 950,
    eventCompletionHoldMs: 1680,
    eventCompletionObjectiveHoldMs: 2600,
    eventTypeLabel: '限时拦截',
    eventBannerLabel: '限时拦截 · 第 N 波',
  },
  [LevelWaveEventType.ESCORT_DEFENSE]: {
    isFirstWave: false,
    firstWaveLeadInMs: 0,
    firstWaveHintDurationMs: 0,
    eventPromptDelayMs: 420,
    eventPromptHoldMs: 1850,
    eventCompletionDelayMs: 900,
    eventCompletionHoldMs: 1700,
    eventCompletionObjectiveHoldMs: 2600,
    eventTypeLabel: '护送防守',
    eventBannerLabel: '护送防守 · 第 N 波',
  },
};

export const ONBOARDING_TEXT_LIBRARY: OnboardingWaveTextProfile = {
  firstWaveStart: {
    phase: 'first-wave',
    ...FIRST_WAVE_TEXT,
  },
  firstWaveComplete: {
    phase: 'event-complete',
    icon: '✅',
    title: '第一波完成',
    text: '入门节奏收束，切换为常规巡航压制',
    durationMs: 1700,
  },
  eventStart: DEFAULT_EVENT_TEXT,
  eventComplete: DEFAULT_EVENT_COMPLETE_TEXT,
};

export const DEFAULT_ONBOARDING_BEAT_PROFILE = FIRST_WAVE_BEAT;

export function getWaveOnboardingBeat(
  waveIndex: number,
  eventType: LevelWaveEventType | null
): OnboardingWaveBeatProfile {
  if (waveIndex === 0 && eventType === null) {
    return { ...DEFAULT_ONBOARDING_BEAT_PROFILE };
  }

  if (!eventType) {
    return {
      ...DEFAULT_ONBOARDING_BEAT_PROFILE,
      isFirstWave: false,
      eventTypeLabel: '普通波次',
      eventBannerLabel: '常规波次 · 继续压制',
      eventPromptDelayMs: 700,
      eventPromptHoldMs: 1700,
      eventCompletionDelayMs: 1000,
      eventCompletionHoldMs: 1500,
      eventCompletionObjectiveHoldMs: 2200,
    };
  }

  return { ...EVENT_BEATS[eventType] };
}

export function getWaveOnboardingText(
  eventType: LevelWaveEventType | null,
  isComplete: boolean
): OnboardingMessageProfile {
  if (eventType === null) {
    if (isComplete) {
      return ONBOARDING_TEXT_LIBRARY.firstWaveComplete;
    }

    return {
      phase: 'first-wave',
      ...FIRST_WAVE_TEXT,
    };
  }

  return isComplete
    ? ONBOARDING_TEXT_LIBRARY.eventComplete[eventType]
    : ONBOARDING_TEXT_LIBRARY.eventStart[eventType];
}
