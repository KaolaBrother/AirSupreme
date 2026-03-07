import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EventBus, GameEventType } from '@/core/EventBus';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';

describe('EventBus', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('should emit and receive events', () => {
    const handler = vi.fn();
    EventBus.on(GameEventType.SCORE_CHANGED, handler);

    EventBus.emit(GameEventType.SCORE_CHANGED, { score: 100, delta: 10 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: GameEventType.SCORE_CHANGED,
        payload: { score: 100, delta: 10 },
      })
    );
  });

  it('should support multiple handlers for same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    EventBus.on(GameEventType.WAVE_START, handler1);
    EventBus.on(GameEventType.WAVE_START, handler2);

    EventBus.emit(GameEventType.WAVE_START, { wave: 1, level: 1 });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe with returned function', () => {
    const handler = vi.fn();

    const unsubscribe = EventBus.on(GameEventType.PLAYER_DEATH, handler);
    unsubscribe();

    EventBus.emit(GameEventType.PLAYER_DEATH, { position: new THREE.Vector3(0, 0, 0), lives: 0 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle once subscription', () => {
    const handler = vi.fn();

    EventBus.once(GameEventType.LEVEL_COMPLETE, handler);

    EventBus.emit(GameEventType.LEVEL_COMPLETE, { level: 1 });
    EventBus.emit(GameEventType.LEVEL_COMPLETE, { level: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should include timestamp in events', () => {
    const handler = vi.fn();
    EventBus.on(GameEventType.SHIELD_ACTIVATED, handler);

    const before = Date.now();
    EventBus.emit(GameEventType.SHIELD_ACTIVATED, { duration: 10 });
    const after = Date.now();

    const call = handler.mock.calls[0][0];
    expect(call.timestamp).toBeGreaterThanOrEqual(before);
    expect(call.timestamp).toBeLessThanOrEqual(after);
  });

  it('should clear all listeners', () => {
    const handler = vi.fn();

    EventBus.on(GameEventType.ENEMY_DEATH, handler);
    EventBus.clear();

    EventBus.emit(GameEventType.ENEMY_DEATH, {
      enemyId: 'test',
      position: new THREE.Vector3(0, 0, 0),
      config: ENEMY_CONFIGS[EnemyType.FIGHTER],
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
