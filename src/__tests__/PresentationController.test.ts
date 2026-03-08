import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PresentationController } from '@/core/PresentationController';
import type { HUD } from '@/ui/HUD';
import type { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import type { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import type { LockOnIndicator } from '@/ui/LockOnIndicator';

function createPresentationController() {
  const hud = {
    init: vi.fn(),
    dispose: vi.fn(),
    updateHealth: vi.fn(),
    updateSpeed: vi.fn(),
    updateScore: vi.fn(),
    updateEnemies: vi.fn(),
    updateRemainingEnemies: vi.fn(),
    updateLives: vi.fn(),
    update: vi.fn(),
    updateMissiles: vi.fn(),
    updateMissileProgress: vi.fn(),
    showEventObjective: vi.fn(),
    showCompletedEventObjective: vi.fn(),
    updateEventObjectiveStatus: vi.fn(),
    hideEventObjective: vi.fn(),
  } as unknown as HUD;

  const enemyHealthBars = {
    init: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  } as unknown as EnemyHealthBars;

  const bossIndicator = {
    init: vi.fn(),
    update: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  } as unknown as BossMissileIndicator;

  const lockOnIndicator = {
    init: vi.fn(),
    dispose: vi.fn(),
  } as unknown as LockOnIndicator;

  return {
    controller: new PresentationController({
      hud,
      enemyHealthBars,
      bossIndicator,
      lockOnIndicator,
    }),
    hud,
  };
}

describe('PresentationController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T00:00:00.000Z'));
  });

  it('throttles rapid event objective status churn for the same card', () => {
    const { controller, hud } = createPresentationController();

    controller.showEventObjective('第 3 波 · 限时拦截', '拦截突防编队', '拦截中：3 架');
    controller.showEventObjective('第 3 波 · 限时拦截', '拦截突防编队', '拦截中：2 架');

    expect(hud.showEventObjective).toHaveBeenCalledTimes(1);
    expect(hud.updateEventObjectiveStatus).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-03-08T00:00:00.450Z'));
    controller.showEventObjective('第 3 波 · 限时拦截', '拦截突防编队', '拦截中：1 架');

    expect(hud.updateEventObjectiveStatus).toHaveBeenCalledTimes(1);
    expect(hud.updateEventObjectiveStatus).toHaveBeenCalledWith('拦截中：1 架');
  });

  it('resets event objective cache after clear and allows the same card to re-open', () => {
    const { controller, hud } = createPresentationController();

    controller.showEventObjective('第 2 波 · 精英歼灭', '优先打穿重型目标', '精英压制：2 架');
    controller.clearEventObjective();
    controller.showEventObjective('第 2 波 · 精英歼灭', '优先打穿重型目标', '精英压制：2 架');

    expect(hud.hideEventObjective).toHaveBeenCalledTimes(1);
    expect(hud.showEventObjective).toHaveBeenCalledTimes(2);
  });

  it('treats tone changes as a new card render instead of a status-only update', () => {
    const { controller, hud } = createPresentationController();

    controller.showEventObjective('第 4 波 · 护送防守', '先护送友军', '护送优先 · 剩余 3 架');
    controller.showCompletedEventObjective('第 4 波 · 护送完成', '友军守住关键点', '结果：护送达成');

    expect(hud.showEventObjective).toHaveBeenCalledTimes(1);
    expect(hud.showCompletedEventObjective).toHaveBeenCalledTimes(1);
    expect(hud.updateEventObjectiveStatus).not.toHaveBeenCalled();
  });
});
