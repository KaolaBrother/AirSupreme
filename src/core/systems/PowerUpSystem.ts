import type { Scene, Vector3 } from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import {
  PowerUpManager,
  PowerUpType,
  POWER_UP_CONFIGS,
  PowerUpConfig,
} from '@/features/powerups/PowerUpSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

export class PowerUpSystem implements IGameSystem {
  readonly name = 'PowerUpSystem';

  private manager: PowerUpManager;

  constructor(scene: Scene, particleSystem: ParticleSystem) {
    this.manager = new PowerUpManager(scene, particleSystem);
  }

  init(): void {
    this.manager.onPowerUpCollected = (type, config) => {
      EventBus.emit(GameEventType.POWERUP_COLLECTED, { type, config });
    };

    this.manager.onPowerUpExpired = (type) => {
      EventBus.emit(GameEventType.POWERUP_EXPIRED, { type });
    };

    this.manager.onBombUsed = () => {
      // Bomb power-up now spawns friendly AI
    };
  }

  update(deltaTime: number): void {
    this.manager.update(deltaTime);
  }

  dispose(): void {
    this.manager.clear();
  }

  clear(): void {
    this.manager.clear();
  }

  getManager(): PowerUpManager {
    return this.manager;
  }

  spawn(
    position: Vector3,
    type?: import('@/features/powerups/PowerUpSystem').PowerUpType,
    icon?: string
  ): void {
    this.manager.spawn(position, type, icon);
  }

  hasEffect(type: PowerUpType): boolean {
    return this.manager.hasEffect(type);
  }

  checkProjectileCollisions(
    projectilePositions: Vector3[],
    onBalloonDestroyed: (balloon: unknown, type: PowerUpType) => void
  ): void {
    this.manager.checkProjectileCollisions(projectilePositions, onBalloonDestroyed);
  }

  checkPlayerCollisions(
    playerPosition: Vector3,
    onCollect: (type: PowerUpType, config: PowerUpConfig) => void
  ): void {
    this.manager.checkPlayerCollisions(playerPosition, onCollect);
  }

  addActivePowerUp(type: PowerUpType, config: PowerUpConfig): void {
    this.manager.addActivePowerUp(type, config);
  }

  getConfig(type: PowerUpType): PowerUpConfig {
    return POWER_UP_CONFIGS[type];
  }
}
