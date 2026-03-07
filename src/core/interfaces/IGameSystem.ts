import type { Mesh, Object3D, Vector3 } from 'three';
import { GameEventType, GameEventPayloads } from '@/core/EventBus';

export interface IGameSystem {
  readonly name: string;
  init(): void;
  update(deltaTime: number): void;
  dispose(): void;
}

export interface IEventEmitter {
  emit<K extends GameEventType>(eventType: K, payload: GameEventPayloads[K]): void;
}

export interface IHealth {
  current: number;
  max: number;
  percent: number;
  isDead: boolean;
  takeDamage(amount: number): void;
  heal(amount: number): void;
  reset(): void;
}

export interface IWeapon {
  damage: number;
  fireRate: number;
  accuracy: number;
  canFire: boolean;
  fire(position: Vector3, direction: Vector3): void;
  updateCooldown(deltaTime: number): void;
}

export interface ITargetable {
  mesh: Object3D;
  position: Vector3;
  isAlive: boolean;
  faction: 'player' | 'enemy' | 'friendly';
}

export interface IProjectile {
  mesh: Mesh;
  active: boolean;
  damage: number;
  owner?: Object3D;
  faction?: string;
}

export interface IAIController {
  target?: Object3D;
  state: 'CHASE' | 'FIXED_DIRECTION' | 'CIRCLE';
  update(deltaTime: number, targets: Object3D[]): void;
  setTarget(target: Object3D | undefined): void;
}
