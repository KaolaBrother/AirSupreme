import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { GameEventType, EventBus } from '@/core/EventBus';
import { PowerUpType } from '@/features/powerups/PowerUpSystem';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';

describe('Game Events Integration', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  describe('Player Events', () => {
    it('should emit PLAYER_FIRED with position, direction and damage', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.PLAYER_FIRED, handler);

      const position = new THREE.Vector3(0, 100, 0);
      const direction = new THREE.Vector3(0, 0, -1);
      const damage = 18;

      EventBus.emit(GameEventType.PLAYER_FIRED, {
        position,
        direction,
        damage,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: GameEventType.PLAYER_FIRED,
          payload: { position, direction, damage },
        })
      );
    });

    it('should emit PLAYER_DEATH with position and lives', () => {
      const handler = vi.fn();
      EventBus.on(GameEventType.PLAYER_DEATH, handler);

      EventBus.emit(GameEventType.PLAYER_DEATH, {
        position: new THREE.Vector3(0, 50, 100),
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
        position: new THREE.Vector3(100, 80, -50),
        config: ENEMY_CONFIGS[EnemyType.FIGHTER],
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
        config: {
          type: PowerUpType.HEALTH,
          name: '生命恢复',
          description: '恢复生命值',
          icon: '❤️',
          color: 0xff0000,
          duration: 0,
          value: 0,
        },
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
        position: new THREE.Vector3(0, 0, 0),
        target: undefined,
      });

      expect(handler).toHaveBeenCalled();
    });
  });
});
