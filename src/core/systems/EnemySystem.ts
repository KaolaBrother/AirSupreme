import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { LevelManager } from '@/features/levels/LevelManager';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { Faction } from '@/core/Faction';

export class EnemySystem implements IGameSystem {
  readonly name = 'EnemySystem';

  private levelManager: LevelManager;
  private friendlyAIs: FriendlyAI[] = [];
  private currentLevel: number = 1;

  constructor(scene: THREE.Scene) {
    this.levelManager = new LevelManager(scene);
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
      EventBus.emit(GameEventType.WAVE_START, {
        wave,
        level: this.currentLevel,
      });
    };

    this.levelManager.onWaveComplete = (wave) => {
      EventBus.emit(GameEventType.WAVE_COMPLETE, {
        wave,
        enemiesKilled: 0,
      });
    };

    this.levelManager.onLevelComplete = (level) => {
      this.currentLevel++;
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

  startWave(playerPosition: THREE.Vector3): void {
    this.levelManager.startWave(playerPosition);
  }

  getFriendlyAIs(): FriendlyAI[] {
    return this.friendlyAIs;
  }

  spawnFriendly(friendly: FriendlyAI): void {
    this.friendlyAIs.push(friendly);

    const enemy = friendly['enemy'];
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
}
