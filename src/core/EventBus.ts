import type { Object3D, Vector3 } from 'three';
import { EnemyType, EnemyConfig } from '@/features/enemy/EnemyTypes';
import type { EnemyWeaponKind } from '@/features/enemy/EnemyWeapons';
import { LevelWaveEventType } from '@/features/terrain/LevelConfig';
import { PowerUpType, PowerUpConfig } from '@/features/powerups/PowerUpSystem';
import { Faction } from '@/core/Faction';

export enum GameEventType {
  PLAYER_FIRED = 'PLAYER_FIRED',
  PLAYER_HIT = 'PLAYER_HIT',
  PLAYER_DEATH = 'PLAYER_DEATH',
  PLAYER_RESPAWN = 'PLAYER_RESPAWN',

  ENEMY_SPAWNED = 'ENEMY_SPAWNED',
  ENEMY_FIRED = 'ENEMY_FIRED',
  ENEMY_TELL = 'ENEMY_TELL',
  ENEMY_HIT = 'ENEMY_HIT',
  ENEMY_DEATH = 'ENEMY_DEATH',

  FRIENDLY_SPAWNED = 'FRIENDLY_SPAWNED',
  FRIENDLY_FIRED = 'FRIENDLY_FIRED',
  FRIENDLY_DEATH = 'FRIENDLY_DEATH',

  MISSILE_FIRED = 'MISSILE_FIRED',
  MISSILE_HIT = 'MISSILE_HIT',

  WAVE_START = 'WAVE_START',
  WAVE_EVENT_START = 'WAVE_EVENT_START',
  WAVE_COMPLETE = 'WAVE_COMPLETE',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',

  POWERUP_COLLECTED = 'POWERUP_COLLECTED',
  POWERUP_EXPIRED = 'POWERUP_EXPIRED',
  BALLOON_DESTROYED = 'BALLOON_DESTROYED',

  SHIELD_ACTIVATED = 'SHIELD_ACTIVATED',
  SHIELD_DEACTIVATED = 'SHIELD_DEACTIVATED',

  SCORE_CHANGED = 'SCORE_CHANGED',
}

export interface PlayerHitFeedbackMetadata {
  suppressDefaultFeedback?: boolean;
}

export interface GameEventPayloads {
  [GameEventType.PLAYER_FIRED]: { position: Vector3; direction: Vector3; damage: number };
  [GameEventType.PLAYER_HIT]: {
    damage: number;
    position: Vector3;
    feedback?: PlayerHitFeedbackMetadata;
  };
  [GameEventType.PLAYER_DEATH]: { position: Vector3; lives: number };
  [GameEventType.PLAYER_RESPAWN]: { position: Vector3 };

  [GameEventType.ENEMY_SPAWNED]: {
    enemyId: string;
    enemyType: EnemyType;
    position: Vector3;
  };
  [GameEventType.ENEMY_FIRED]: {
    position: Vector3;
    direction: Vector3;
    damage: number;
    faction: Faction;
    owner?: Object3D;
    /** 弹种（缺省 'bullet'：普通机炮弹，与旧载荷一致） */
    weapon?: EnemyWeaponKind;
    /** 弹速（米/秒；缺省为普通子弹弹速）：供伤害归因等按弹速推算弹道 */
    speed?: number;
    /** 同一次齐射里的后续弹：不单独播放开火音与枪口焰 */
    quiet?: boolean;
  };
  /**
   * 敌机招牌攻击的预警开始（狙击机蓄力 / 隐形机现形）：用于播放提示音；画面上的预警由敌机
   * 自己画
   */
  [GameEventType.ENEMY_TELL]: {
    kind: 'lance-charge' | 'decloak';
    position: Vector3;
    /** 预警时长（秒）：到点才可能开火 */
    duration: number;
    owner?: Object3D;
  };
  [GameEventType.ENEMY_HIT]: {
    enemyId: string;
    damage: number;
    healthRemaining: number;
  };
  [GameEventType.ENEMY_DEATH]: {
    enemyId: string;
    position: Vector3;
    config: EnemyConfig;
  };

  [GameEventType.FRIENDLY_SPAWNED]: { friendlyId: string; position: Vector3 };
  [GameEventType.FRIENDLY_FIRED]: {
    position: Vector3;
    direction: Vector3;
    damage: number;
    faction: Faction;
    owner?: Object3D;
  };
  [GameEventType.FRIENDLY_DEATH]: { friendlyId: string; position: Vector3 };

  [GameEventType.MISSILE_FIRED]: { position: Vector3; target?: Object3D };
  [GameEventType.MISSILE_HIT]: { position: Vector3; target: Object3D };

  [GameEventType.WAVE_START]: { wave: number; level: number };
  [GameEventType.WAVE_EVENT_START]: { wave: number; level: number; eventType: LevelWaveEventType };
  [GameEventType.WAVE_COMPLETE]: { wave: number; enemiesKilled: number };
  [GameEventType.LEVEL_COMPLETE]: { level: number };

  [GameEventType.POWERUP_COLLECTED]: { type: PowerUpType; config: PowerUpConfig };
  [GameEventType.POWERUP_EXPIRED]: { type: PowerUpType };
  [GameEventType.BALLOON_DESTROYED]: { type: PowerUpType; config: PowerUpConfig };

  [GameEventType.SHIELD_ACTIVATED]: { duration: number };
  [GameEventType.SHIELD_DEACTIVATED]: void;

  [GameEventType.SCORE_CHANGED]: { score: number; delta: number };
}

export type GameEvent<K extends GameEventType> = {
  type: K;
  payload: GameEventPayloads[K];
  timestamp: number;
};

type EventHandler<K extends GameEventType> = (event: GameEvent<K>) => void;

class EventBusImpl {
  private listeners: Map<GameEventType, Set<EventHandler<GameEventType>>> = new Map();

  on<K extends GameEventType>(eventType: K, handler: EventHandler<K>): () => void {
    let handlers = this.listeners.get(eventType);
    if (!handlers) {
      handlers = new Set<EventHandler<GameEventType>>();
      this.listeners.set(eventType, handlers);
    }
    handlers.add(handler as EventHandler<GameEventType>);

    return () => this.off(eventType, handler);
  }

  off<K extends GameEventType>(eventType: K, handler: EventHandler<K>): void {
    this.listeners.get(eventType)?.delete(handler as EventHandler<GameEventType>);
  }

  emit<K extends GameEventType>(eventType: K, payload: GameEventPayloads[K]): void {
    const event: GameEvent<K> = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  once<K extends GameEventType>(eventType: K, handler: EventHandler<K>): void {
    const wrapper: EventHandler<K> = (event) => {
      this.off(eventType, wrapper);
      handler(event);
    };
    this.on(eventType, wrapper);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusImpl();
