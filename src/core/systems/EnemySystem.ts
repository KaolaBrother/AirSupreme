import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { LevelManager } from '@/features/levels/LevelManager';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { Faction } from '@/core/Faction';
import type { DifficultyProfile } from '@/core/Difficulty';
import { GameSessionState } from '@/core/GameSessionState';

export class EnemySystem implements IGameSystem {
  readonly name = 'EnemySystem';

  private levelManager: LevelManager;
  private sessionState: GameSessionState;
  private friendlyAIs: FriendlyAI[] = [];

  constructor(scene: THREE.Scene, sessionState?: GameSessionState) {
    this.levelManager = new LevelManager(scene);
    this.sessionState = sessionState ?? new GameSessionState();
  }

  init(): void {
    this.levelManager.onEnemySpawned = (enemy) => {
      enemy.onFire = (position, direction, damage) => {
        EventBus.emit(GameEventType.ENEMY_FIRED, {
          position,
          direction,
          damage,
          faction: Faction.ENEMY,
          owner: enemy.getMesh(),
        });
      };

      enemy.onDestroy = () => {
        const config = enemy.getConfig();
        EventBus.emit(GameEventType.ENEMY_DEATH, {
          enemyId: enemy.getMesh().uuid,
          position: enemy.getPosition().clone(),
          config,
        });
      };
    };

    this.levelManager.onWaveStart = (wave) => {
      this.sessionState.setWave(wave);
      EventBus.emit(GameEventType.WAVE_START, {
        wave,
        level: this.sessionState.getLevel(),
      });
    };

    this.levelManager.onWaveEventStart = (eventType, wave) => {
      EventBus.emit(GameEventType.WAVE_EVENT_START, {
        wave,
        level: this.sessionState.getLevel(),
        eventType,
      });
    };

    this.levelManager.onWaveComplete = (wave) => {
      this.sessionState.setWave(wave);
      EventBus.emit(GameEventType.WAVE_COMPLETE, {
        wave,
        enemiesKilled: 0,
      });
    };

    this.levelManager.onLevelComplete = (level) => {
      EventBus.emit(GameEventType.LEVEL_COMPLETE, { level });
    };
  }

  update(_deltaTime: number): void {}

  updateWithPlayer(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    additionalTargets?: THREE.Object3D[]
  ): void {
    const friendlyMeshes = this.friendlyAIs.map((f) => f.getMesh());
    this.levelManager.update(deltaTime, playerPosition, friendlyMeshes);

    for (let i = this.friendlyAIs.length - 1; i >= 0; i--) {
      const friendly = this.friendlyAIs[i];

      if (friendly.isAlive()) {
        const enemyMeshes = this.getEnemyMeshes();
        const allTargets = additionalTargets ? [...enemyMeshes, ...additionalTargets] : enemyMeshes;
        friendly.update(deltaTime, allTargets, playerPosition);
      } else {
        friendly.dispose();
        this.friendlyAIs.splice(i, 1);
      }
    }
  }

  updateVisuals(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.levelManager.updateVisuals(deltaTime, playerPosition);
  }

  applyInterpolatedVisuals(alpha: number): void {
    for (const enemy of this.levelManager.getEnemies()) {
      if (enemy.isAlive()) {
        enemy.applyInterpolatedVisual(alpha);
      }
    }

    for (const friendly of this.friendlyAIs) {
      if (friendly.isAlive()) {
        friendly.getEnemy().applyInterpolatedVisual(alpha);
      }
    }
  }

  restoreCurrentVisuals(): void {
    for (const enemy of this.levelManager.getEnemies()) {
      if (enemy.isAlive()) {
        enemy.restoreCurrentVisual();
      }
    }

    for (const friendly of this.friendlyAIs) {
      if (friendly.isAlive()) {
        friendly.getEnemy().restoreCurrentVisual();
      }
    }
  }

  dispose(): void {
    this.levelManager.clear();
    this.friendlyAIs = [];
  }

  getLevelManager(): LevelManager {
    return this.levelManager;
  }

  getEnemies(): ReturnType<LevelManager['getEnemies']> {
    return this.levelManager.getEnemies();
  }

  getEnemyMeshes(): THREE.Object3D[] {
    return this.levelManager
      .getEnemies()
      .filter((e) => e.isAlive())
      .map((e) => e.getMesh());
  }

  getAliveEnemyCount(): number {
    return this.levelManager.getAliveEnemyCount();
  }

  getTotalEnemyCount(): number {
    return this.levelManager.getTotalEnemyCount();
  }

  getSpawnedEnemyCount(): number {
    return this.levelManager.getSpawnedEnemyCount();
  }

  loadLevel(levelId: number): void {
    this.levelManager.loadLevel(levelId);
  }

  setDifficultyProfile(profile: DifficultyProfile): void {
    this.levelManager.setDifficultyProfile(profile);
  }

  getCurrentLevelConfig(): import('@/features/terrain/LevelConfig').LevelConfig | null {
    return this.levelManager.getCurrentLevelConfig();
  }

  startWave(playerPosition: THREE.Vector3): void {
    this.levelManager.startWave(playerPosition);
  }

  getFriendlyAIs(): FriendlyAI[] {
    return this.friendlyAIs;
  }

  spawnFriendly(friendly: FriendlyAI): void {
    this.friendlyAIs.push(friendly);

    const enemy = friendly.getEnemy();
    enemy.onFire = (position, direction, damage) => {
      EventBus.emit(GameEventType.FRIENDLY_FIRED, {
        position,
        direction,
        damage,
        faction: Faction.FRIENDLY,
        owner: friendly.getMesh(),
      });
    };

    EventBus.emit(GameEventType.FRIENDLY_SPAWNED, {
      friendlyId: friendly.getMesh().uuid,
      position: friendly.getMesh().position.clone(),
    });
  }

  removeFriendly(friendly: FriendlyAI): void {
    const index = this.friendlyAIs.indexOf(friendly);
    if (index !== -1) {
      this.friendlyAIs.splice(index, 1);
    }
  }

  clearFriendlies(): void {
    for (const friendly of this.friendlyAIs) {
      friendly.dispose();
    }
    this.friendlyAIs = [];
  }

  spawnEnemyAt(
    type: import('@/features/enemy/EnemyTypes').EnemyType,
    position: THREE.Vector3
  ): void {
    this.levelManager.spawnEnemyAtPosition(type, position);
  }
}
