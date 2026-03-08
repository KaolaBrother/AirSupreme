import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPresentationRuntime,
  type PresentationRuntime,
} from '@/core/PresentationRuntimeLoader';

describe('PresentationRuntimeLoader', () => {
  const runtimes: PresentationRuntime[] = [];

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    runtimes.splice(0).forEach((runtime) => runtime.presentationController.dispose());
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('creates presentation runtime without start menu when disabled', async () => {
    const runtime = await createPresentationRuntime(false);
    runtimes.push(runtime);

    expect(runtime.startMenu).toBeNull();
    expect(runtime.hud).toBeDefined();
    expect(runtime.enemyHealthBars).toBeDefined();
    expect(runtime.lockOnIndicator).toBeDefined();
    expect(runtime.bossIndicator).toBeDefined();
    expect(document.getElementById('start-menu')).toBeNull();
  });

  it('creates presentation runtime with start menu when enabled', async () => {
    const runtime = await createPresentationRuntime(true);
    runtimes.push(runtime);

    expect(runtime.startMenu).not.toBeNull();
    expect(document.getElementById('start-menu')).not.toBeNull();
  });
});
