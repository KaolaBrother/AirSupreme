import { EnemyType } from '@/features/enemy/EnemyTypes';
import { LevelWaveEventType, getIntroducedEnemyTypes } from '@/features/terrain/LevelConfig';
import { tr, type LocalizedText } from '@/i18n';

export type OnboardingPhase = 'first-wave' | 'event-start' | 'event-complete';

/** 返回给调用方的文案（已按当前界面语言取值） */
export interface OnboardingMessageProfile {
  phase: OnboardingPhase;
  icon: string;
  title: string;
  text: string;
  durationMs: number;
}

/** 文案库里的条目：标题与正文为双语对象，取用时再按语言选择 */
export interface OnboardingMessageSource {
  phase: OnboardingPhase;
  icon: string;
  title: LocalizedText;
  text: LocalizedText;
  durationMs: number;
}

export interface OnboardingWaveTextProfile {
  firstWaveStart: OnboardingMessageSource;
  firstWaveComplete: OnboardingMessageSource;
  eventStart: Record<LevelWaveEventType, OnboardingMessageSource>;
  eventComplete: Record<LevelWaveEventType, OnboardingMessageSource>;
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

type BeatTiming = Omit<OnboardingWaveBeatProfile, 'eventTypeLabel' | 'eventBannerLabel'>;

interface BeatSource {
  timing: BeatTiming;
  typeLabel: LocalizedText;
  bannerLabel: LocalizedText;
}

const FIRST_WAVE_TEXT: Omit<OnboardingMessageSource, 'phase'> = {
  icon: '⚔️',
  title: { en: 'First wave inbound', zh: '第一波已到' },
  text: {
    en: 'First wave inbound: steady your flying, then open fire',
    zh: '第一波到来，先稳机动再开火',
  },
  durationMs: 1800,
};

const DEFAULT_EVENT_TEXT: Record<LevelWaveEventType, OnboardingMessageSource> = {
  [LevelWaveEventType.ELITE_HUNT]: {
    phase: 'event-start',
    icon: '💠',
    title: { en: 'Elite hunt wave', zh: '精英歼灭波次' },
    text: {
      en: 'Take out the high-threat targets first: hunt down every elite jet',
      zh: '优先处理高威胁目标，把精英敌机逐个打掉',
    },
    durationMs: 1800,
  },
  [LevelWaveEventType.INTERCEPT]: {
    phase: 'event-start',
    icon: '⚠️',
    title: { en: 'Intercept wave', zh: '限时拦截波次' },
    text: {
      en: 'The window is short: intercept first and wipe out the breakthrough spearhead',
      zh: '压缩窗口优先拦截，清空突防前锋',
    },
    durationMs: 1800,
  },
  [LevelWaveEventType.ESCORT_DEFENSE]: {
    phase: 'event-start',
    icon: '🛡️',
    title: { en: 'Escort defense wave', zh: '护送防守波次' },
    text: {
      en: 'Friendlies come first: close in, then push forward along their route',
      zh: '友军优先级提升，围拢后沿线递进压制',
    },
    durationMs: 1800,
  },
};

const DEFAULT_EVENT_COMPLETE_TEXT: Record<LevelWaveEventType, OnboardingMessageSource> = {
  [LevelWaveEventType.ELITE_HUNT]: {
    phase: 'event-complete',
    icon: '✅',
    title: { en: 'Elite hunt complete', zh: '精英歼灭完成' },
    text: {
      en: 'High-threat targets down; the airspace is easing',
      zh: '高威胁清空，空域压力明显下降',
    },
    durationMs: 1600,
  },
  [LevelWaveEventType.INTERCEPT]: {
    phase: 'event-complete',
    icon: '✅',
    title: { en: 'Intercept complete', zh: '拦截完成' },
    text: { en: 'Breakthrough stopped; the front line holds', zh: '突防被压制，前线压力已回收' },
    durationMs: 1600,
  },
  [LevelWaveEventType.ESCORT_DEFENSE]: {
    phase: 'event-complete',
    icon: '✅',
    title: { en: 'Escort complete', zh: '护送结束' },
    text: {
      en: 'Friendly position secured; on to the next phase',
      zh: '友军节点已稳，进入下一段节奏',
    },
    durationMs: 1600,
  },
};

const FIRST_WAVE_BEAT: BeatSource = {
  timing: {
    isFirstWave: true,
    firstWaveLeadInMs: 1200,
    firstWaveHintDurationMs: 1800,

    eventPromptDelayMs: 0,
    eventPromptHoldMs: 1800,
    eventCompletionDelayMs: 1500,
    eventCompletionHoldMs: 1600,
    eventCompletionObjectiveHoldMs: 2400,
  },
  typeLabel: { en: 'Standard wave', zh: '普通波次' },
  bannerLabel: { en: 'Wave 1 · Warm-up', zh: '第一波 · 入场引导' },
};

const STANDARD_WAVE_BEAT: BeatSource = {
  timing: {
    ...FIRST_WAVE_BEAT.timing,
    isFirstWave: false,
    eventPromptDelayMs: 700,
    eventPromptHoldMs: 1700,
    eventCompletionDelayMs: 1000,
    eventCompletionHoldMs: 1500,
    eventCompletionObjectiveHoldMs: 2200,
  },
  typeLabel: { en: 'Standard wave', zh: '普通波次' },
  bannerLabel: { en: 'Standard wave · Keep up the pressure', zh: '常规波次 · 继续压制' },
};

const EVENT_BEATS: Record<LevelWaveEventType, BeatSource> = {
  [LevelWaveEventType.ELITE_HUNT]: {
    timing: {
      isFirstWave: false,
      firstWaveLeadInMs: 0,
      firstWaveHintDurationMs: 0,
      eventPromptDelayMs: 300,
      eventPromptHoldMs: 1900,
      eventCompletionDelayMs: 900,
      eventCompletionHoldMs: 1700,
      eventCompletionObjectiveHoldMs: 2600,
    },
    typeLabel: { en: 'Elite hunt', zh: '精英歼灭' },
    bannerLabel: { en: 'Elite hunt · Wave N', zh: '精英歼灭 · 第 N 波' },
  },
  [LevelWaveEventType.INTERCEPT]: {
    timing: {
      isFirstWave: false,
      firstWaveLeadInMs: 0,
      firstWaveHintDurationMs: 0,
      eventPromptDelayMs: 450,
      eventPromptHoldMs: 1850,
      eventCompletionDelayMs: 950,
      eventCompletionHoldMs: 1680,
      eventCompletionObjectiveHoldMs: 2600,
    },
    typeLabel: { en: 'Intercept', zh: '限时拦截' },
    bannerLabel: { en: 'Intercept · Wave N', zh: '限时拦截 · 第 N 波' },
  },
  [LevelWaveEventType.ESCORT_DEFENSE]: {
    timing: {
      isFirstWave: false,
      firstWaveLeadInMs: 0,
      firstWaveHintDurationMs: 0,
      eventPromptDelayMs: 420,
      eventPromptHoldMs: 1850,
      eventCompletionDelayMs: 900,
      eventCompletionHoldMs: 1700,
      eventCompletionObjectiveHoldMs: 2600,
    },
    typeLabel: { en: 'Escort defense', zh: '护送防守' },
    bannerLabel: { en: 'Escort defense · Wave N', zh: '护送防守 · 第 N 波' },
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
    title: { en: 'First wave cleared', zh: '第一波完成' },
    text: {
      en: 'Warm-up over; switching to regular patrol pressure',
      zh: '入门节奏收束，切换为常规巡航压制',
    },
    durationMs: 1700,
  },
  eventStart: DEFAULT_EVENT_TEXT,
  eventComplete: DEFAULT_EVENT_COMPLETE_TEXT,
};

/**
 * 首次遭遇提示：某机型在战役里第一次出现的那一波开场时显示的一行文字（当前界面语言，无语音）。
 * 侦察机没有提示——第 1 关第 1 波属于原有的入门引导。
 */
export const FIRST_CONTACT_HINTS: Readonly<Partial<Record<EnemyType, LocalizedText>>> = {
  [EnemyType.FIGHTER]: {
    en: 'Fighters go for your tail. Turn into them to shake them off.',
    zh: '战斗机会咬你的尾巴，朝它转过去就能甩开。',
  },
  [EnemyType.SNIPER]: {
    en: 'Red beam: a sniper is charging. When the beam freezes, change direction.',
    zh: '红色光束是狙击机在蓄力，光束定住的瞬间立刻转向。',
  },
  [EnemyType.HEAVY]: {
    en: 'Gunships fire slow shell fans. Attack from the side or below, not from behind.',
    zh: '炮艇机打出慢速弹幕，从侧面或下方进攻，别跟在正后方。',
  },
  [EnemyType.ACE]: {
    en: 'Aces fire seeking missiles. On a missile warning, drop a flare and break.',
    zh: '王牌机会发射追踪导弹，出现导弹警告就放干扰弹并急转。',
  },
  [EnemyType.STRIKER]: {
    en: 'Strikers launch missile pairs from far out. Close in while they reload.',
    zh: '打击机在远处成对发射导弹，趁它装填时贴上去。',
  },
  [EnemyType.JAMMER]: {
    en: 'A Jammer slows your missile lock. Shoot it down first — guns still work.',
    zh: '干扰机会拖慢导弹锁定，先把它打掉——机炮不受影响。',
  },
  [EnemyType.WRAITH]: {
    en: 'Wraiths cloak and strike from behind. Watch for the red flash, then turn.',
    zh: '幽灵机隐身后从背后偷袭，看到红色闪光就立刻转向。',
  },
};

/** 一条首次遭遇提示在屏幕上停留的时间（毫秒）：一整句话，比波次提示久 */
export const FIRST_CONTACT_HINT_HOLD_MS = 5000;

/**
 * 这一波（波次从 0 起）开场要显示的首次遭遇提示。
 * 只跟关卡和波次有关：读档重打这一波照样显示，别的波次永远没有。
 */
export function getFirstContactHints(level: number, waveIndex: number): LocalizedText[] {
  const hints: LocalizedText[] = [];
  for (const type of getIntroducedEnemyTypes(level, waveIndex)) {
    const hint = FIRST_CONTACT_HINTS[type];
    if (hint) hints.push(hint);
  }
  return hints;
}

/** 按当前界面语言展开节拍配置（每次返回新对象） */
function resolveBeat(source: BeatSource): OnboardingWaveBeatProfile {
  return {
    ...source.timing,
    eventTypeLabel: tr(source.typeLabel),
    eventBannerLabel: tr(source.bannerLabel),
  };
}

function resolveMessage(source: OnboardingMessageSource): OnboardingMessageProfile {
  return {
    phase: source.phase,
    icon: source.icon,
    title: tr(source.title),
    text: tr(source.text),
    durationMs: source.durationMs,
  };
}

/**
 * 默认（第一波）节拍。标签用 getter 按读取时的界面语言取值，
 * 展开（{ ...DEFAULT_ONBOARDING_BEAT_PROFILE }）时得到当前语言的字符串。
 */
export const DEFAULT_ONBOARDING_BEAT_PROFILE: OnboardingWaveBeatProfile = {
  ...FIRST_WAVE_BEAT.timing,
  get eventTypeLabel(): string {
    return tr(FIRST_WAVE_BEAT.typeLabel);
  },
  get eventBannerLabel(): string {
    return tr(FIRST_WAVE_BEAT.bannerLabel);
  },
};

export function getWaveOnboardingBeat(
  waveIndex: number,
  eventType: LevelWaveEventType | null
): OnboardingWaveBeatProfile {
  if (waveIndex === 0 && eventType === null) {
    return resolveBeat(FIRST_WAVE_BEAT);
  }

  if (!eventType) {
    return resolveBeat(STANDARD_WAVE_BEAT);
  }

  return resolveBeat(EVENT_BEATS[eventType]);
}

export function getWaveOnboardingText(
  eventType: LevelWaveEventType | null,
  isComplete: boolean
): OnboardingMessageProfile {
  if (eventType === null) {
    return resolveMessage(
      isComplete
        ? ONBOARDING_TEXT_LIBRARY.firstWaveComplete
        : ONBOARDING_TEXT_LIBRARY.firstWaveStart
    );
  }

  return resolveMessage(
    isComplete
      ? ONBOARDING_TEXT_LIBRARY.eventComplete[eventType]
      : ONBOARDING_TEXT_LIBRARY.eventStart[eventType]
  );
}
