import { describe, expect, it } from 'vitest';
import { RadioBudget } from '@/core/campaign/RadioBudget';

/**
 * 紧急告警配音的配额（RadioBudget，终验修复 F2）：每波最多 maxPerWave 次；每次开口后的冷却
 * 逐次加长（cooldownSeconds[0]、[1]……，超出数组沿用最后一项）；新的一波 / Boss 战 reset()。
 * 只决定“要不要配音”，HUD 告警由调用方每次照发（见 UnitController.test.ts）。
 */

function advance(budget: RadioBudget, seconds: number, dt = 0.1): void {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    budget.update(dt);
  }
}

describe('RadioBudget', () => {
  it('voices at most twice per wave, 20 s apart (missile-warning budget)', () => {
    const budget = new RadioBudget({ maxPerWave: 2, cooldownSeconds: [20, 45] });
    expect(budget.isReady()).toBe(true);

    budget.consume();
    expect(budget.getUsed()).toBe(1);
    expect(budget.isReady()).toBe(false);
    advance(budget, 19.8);
    expect(budget.isReady(), 'still cooling down at 19.8 s').toBe(false);
    advance(budget, 0.3);
    expect(budget.isReady(), 'ready after 20 s').toBe(true);

    budget.consume();
    expect(budget.getUsed()).toBe(2);
    advance(budget, 600);
    expect(budget.isReady(), 'two per wave at most').toBe(false);
  });

  it('lengthens the cooldown after each voiced warning (20 s, then 45 s, then the last again)', () => {
    const budget = new RadioBudget({ maxPerWave: 4, cooldownSeconds: [20, 45] });
    budget.consume();
    advance(budget, 20.1);
    expect(budget.isReady()).toBe(true);

    budget.consume();
    advance(budget, 44.8);
    expect(budget.isReady(), 'second cooldown is 45 s').toBe(false);
    advance(budget, 0.3);
    expect(budget.isReady()).toBe(true);

    budget.consume();
    advance(budget, 44.8);
    expect(budget.isReady(), 'later cooldowns reuse the last entry').toBe(false);
    advance(budget, 0.3);
    expect(budget.isReady()).toBe(true);
  });

  it('reset() at the start of a wave or boss fight clears the count and the cooldown', () => {
    const budget = new RadioBudget({ maxPerWave: 2, cooldownSeconds: [20, 45] });
    budget.consume();
    budget.consume();
    expect(budget.isReady()).toBe(false);

    budget.reset();
    expect(budget.getUsed()).toBe(0);
    expect(budget.isReady()).toBe(true);
  });

  it('ignores non-finite or negative time steps', () => {
    const budget = new RadioBudget({ maxPerWave: 2, cooldownSeconds: [20, 45] });
    budget.consume();
    budget.update(Number.NaN);
    budget.update(-50);
    budget.update(Infinity);
    expect(budget.isReady()).toBe(false);
    advance(budget, 20.1);
    expect(budget.isReady()).toBe(true);
  });
});
