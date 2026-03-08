import { describe, expect, it } from 'vitest';
import { LevelWaveEventType } from '@/features/terrain/LevelConfig';
import {
  DEFAULT_ONBOARDING_BEAT_PROFILE,
  getWaveOnboardingBeat,
  getWaveOnboardingText,
} from '@/ui/OnboardingManager';

describe('OnboardingManager', () => {
  it('returns the default beat for the first non-event wave', () => {
    const beat = getWaveOnboardingBeat(0, null);

    expect(beat).toEqual(DEFAULT_ONBOARDING_BEAT_PROFILE);
    expect(beat.isFirstWave).toBe(true);
    expect(beat.eventTypeLabel).toBe('普通波次');
  });

  it('returns event-specific beat profiles for event waves', () => {
    const beat = getWaveOnboardingBeat(2, LevelWaveEventType.ESCORT_DEFENSE);

    expect(beat.isFirstWave).toBe(false);
    expect(beat.eventTypeLabel).toBe('护送防守');
    expect(beat.eventPromptDelayMs).toBeGreaterThan(0);
    expect(beat.eventCompletionObjectiveHoldMs).toBeGreaterThan(beat.eventCompletionHoldMs);
  });

  it('returns start and completion copy for event onboarding messages', () => {
    const startText = getWaveOnboardingText(LevelWaveEventType.ELITE_HUNT, false);
    const completionText = getWaveOnboardingText(LevelWaveEventType.ELITE_HUNT, true);

    expect(startText.phase).toBe('event-start');
    expect(startText.title).toContain('精英');
    expect(completionText.phase).toBe('event-complete');
    expect(completionText.title).toContain('完成');
  });
});
