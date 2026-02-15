import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEventType, EventBus } from '@/core/EventBus';
import { PowerUpType } from '@/features/powerups/PowerUpSystem';

describe('Game Events Integration', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  describe('Player Events', () => {
    it('should emit PLAYER_FIRED with position and direction', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.PLAYER_FIRED, handler);

      const position = { x: 0, y: 100, z: 0 };
      const direction = { x: 0, y: 0, z: -1 };

      EventBus.emit(GameEventType.PLAYER_FIRED, {
        position: position as any,
        direction: direction as any,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: GameEventType.PLAYER_FIRED,
          payload: { position, direction },
        })
      );
    });

    it('should emit PLAYER_DEATH with position and lives', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.PLAYER_DEATH, handler);

      EventBus.emit(GameEventType.PLAYER_DEATH, {
        position: { x: 0, y: 50, z: 100 } as any,
        lives: 2,
      });

      expect(handler).toHaveBeenCalled();
      const call = handler.mock.calls[0][0];
      expect(call.payload.lives).toBe(2);
    });
  });

  describe('Enemy Events', () => {
    it('should emit ENEMY_DEATH with config', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.ENEMY_DEATH, handler);

      EventBus.emit(GameEventType.ENEMY_DEATH, {
        enemyId: 'enemy-001',
        position: { x: 100, y: 80, z: -50 } as any,
        config: { type: 'FIGHTER', scoreValue: 100 } as any,
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit WAVE_START with wave and level', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.WAVE_START, handler);

      EventBus.emit(GameEventType.WAVE_START, { wave: 3, level: 2 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { wave: 3, level: 2 },
        })
      );
    });
  });

  describe('PowerUp Events', () => {
    it('should emit POWERUP_COLLECTED', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.POWERUP_COLLECTED, handler);

      EventBus.emit(GameEventType.POWERUP_COLLECTED, {
        type: PowerUpType.HEALTH,
        config: { name: '生命恢复', duration: 0 } as any,
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit SHIELD_ACTIVATED', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.SHIELD_ACTIVATED, handler);

      EventBus.emit(GameEventType.SHIELD_ACTIVATED, { duration: 10 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: GameEventType.SHIELD_ACTIVATED,
          payload: { duration: 10 },
        })
      );
    });
  });

  describe('Combat Events', () => {
    it('should emit MISSILE_FIRED', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.MISSILE_FIRED, handler);

      EventBus.emit(GameEventType.MISSILE_FIRED, {
        position: { x: 0, y: 0, z: 0 } as any,
        target: undefined,
      });

      expect(handler).toHaveBeenCalled();
    });
  });
});
