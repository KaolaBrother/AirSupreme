import { afterEach, describe, expect, it } from 'vitest';
import { LevelWaveEventType } from '@/features/terrain/LevelConfig';
import { setLocale, type Locale, type LocalizedText } from '@/i18n';
import {
  DEFAULT_ONBOARDING_BEAT_PROFILE,
  ONBOARDING_TEXT_LIBRARY,
  getWaveOnboardingBeat,
  getWaveOnboardingText,
} from '@/ui/OnboardingManager';
import { LOCALES, expectBilingual, resetLocale, textIn } from './i18nTestUtils';

const STANDARD_WAVE_LABEL: LocalizedText = { en: 'Standard wave', zh: '普通波次' };
const ESCORT_DEFENSE_LABEL: LocalizedText = { en: 'Escort defense', zh: '护送防守' };

/** 精英歼灭的开始 / 完成标题：开始要点名精英，完成要说完成 */
const ELITE_HUNT_TITLES: Record<Locale, { start: RegExp; complete: RegExp }> = {
  en: { start: /\belite\b/i, complete: /\bcomplete\b/i },
  'zh-CN': { start: /精英/, complete: /完成/ },
};

const HAN = /\p{Script=Han}/u;
const EVENT_TYPES = Object.values(LevelWaveEventType);

describe('OnboardingManager', () => {
  afterEach(() => {
    resetLocale();
  });

  it.each(LOCALES)('returns the default beat for the first non-event wave (%s)', (locale) => {
    setLocale(locale);
    const beat = getWaveOnboardingBeat(0, null);

    expect(beat).toEqual(DEFAULT_ONBOARDING_BEAT_PROFILE);
    expect(beat.isFirstWave).toBe(true);
    expect(beat.eventTypeLabel).toBe(textIn(STANDARD_WAVE_LABEL, locale));
  });

  it('reads the default beat labels in the language current at read time', () => {
    const english = { ...DEFAULT_ONBOARDING_BEAT_PROFILE };
    setLocale('zh-CN');
    const chinese = { ...DEFAULT_ONBOARDING_BEAT_PROFILE };

    expect(english.eventTypeLabel).toBe(STANDARD_WAVE_LABEL.en);
    expect(chinese.eventTypeLabel).toBe(STANDARD_WAVE_LABEL.zh);
    expect(english.eventBannerLabel).not.toMatch(HAN);
    expect(chinese.eventBannerLabel).toMatch(HAN);
  });

  it.each(LOCALES)('returns event-specific beat profiles for event waves (%s)', (locale) => {
    setLocale(locale);
    const beat = getWaveOnboardingBeat(2, LevelWaveEventType.ESCORT_DEFENSE);

    expect(beat.isFirstWave).toBe(false);
    expect(beat.eventTypeLabel).toBe(textIn(ESCORT_DEFENSE_LABEL, locale));
    expect(beat.eventPromptDelayMs).toBeGreaterThan(0);
    expect(beat.eventCompletionObjectiveHoldMs).toBeGreaterThan(beat.eventCompletionHoldMs);
  });

  it.each(LOCALES)(
    'returns start and completion copy for event onboarding messages (%s)',
    (locale) => {
      setLocale(locale);
      const startText = getWaveOnboardingText(LevelWaveEventType.ELITE_HUNT, false);
      const completionText = getWaveOnboardingText(LevelWaveEventType.ELITE_HUNT, true);

      expect(startText.phase).toBe('event-start');
      expect(startText.title).toMatch(ELITE_HUNT_TITLES[locale].start);
      expect(completionText.phase).toBe('event-complete');
      expect(completionText.title).toMatch(ELITE_HUNT_TITLES[locale].complete);
    }
  );

  it('keeps every onboarding message bilingual', () => {
    const sources = [
      ONBOARDING_TEXT_LIBRARY.firstWaveStart,
      ONBOARDING_TEXT_LIBRARY.firstWaveComplete,
      ...EVENT_TYPES.map((type) => ONBOARDING_TEXT_LIBRARY.eventStart[type]),
      ...EVENT_TYPES.map((type) => ONBOARDING_TEXT_LIBRARY.eventComplete[type]),
    ];
    for (const source of sources) {
      expectBilingual(source.title, `${source.phase} title`);
      expectBilingual(source.text, `${source.phase} text`);
    }
  });

  it('words every wave message and beat label in the interface language', () => {
    const waveKinds: Array<LevelWaveEventType | null> = [null, ...EVENT_TYPES];
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const eventType of waveKinds) {
        for (const isComplete of [false, true]) {
          const message = getWaveOnboardingText(eventType, isComplete);
          for (const copy of [message.title, message.text]) {
            const where = `${locale} ${eventType ?? 'first-wave'} ${isComplete ? 'complete' : 'start'}`;
            expect(copy.trim(), where).not.toBe('');
            expect(HAN.test(copy), `${where}: "${copy}"`).toBe(locale === 'zh-CN');
          }
        }
        const beat = getWaveOnboardingBeat(eventType === null ? 0 : 3, eventType);
        for (const label of [beat.eventTypeLabel, beat.eventBannerLabel]) {
          expect(HAN.test(label), `${locale} beat label "${label}"`).toBe(locale === 'zh-CN');
        }
      }
    }
  });
});
