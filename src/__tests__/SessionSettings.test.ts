import { describe, expect, it } from 'vitest';
import { normalizeStartFlowSettings, TEST_SCORE_OPTIONS } from '@/core/SessionSettings';

describe('SessionSettings', () => {
  it('uses the configured test score tiers up to 20000', () => {
    expect(TEST_SCORE_OPTIONS).toEqual([0, 5000, 10000, 15000, 20000]);
    expect(normalizeStartFlowSettings({ testScore: 20000 }).testScore).toBe(20000);
  });

  it('clamps oversized test score values to the highest tier', () => {
    expect(normalizeStartFlowSettings({ testScore: 25000 }).testScore).toBe(20000);
  });
});
