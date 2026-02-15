import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { ProjectilePool } from '@/features/combat/ProjectilePool';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { Faction, areHostile } from '@/core/Faction';

interface TargetInfo {
  mesh: THREE.Object3D;
  faction: Faction;
  ai?: unknown;
}

export class CombatSystem implements IGameSystem {
  readonly name = 'CombatSystem';

  private playerProjectilePool: ProjectilePool;
  private enemyProjectilePool: ProjectilePool;
  private missileSystem: MissileSystem;

  private playerMesh: THREE.Group;
  private playerPosition: THREE.Vector3;

  private damageMultiplier: number = 1;

  constructor(
    scene: THREE.Scene,
    particleSystem: ParticleSystem,
    playerMesh: THREE.Group
  ) {
    this.playerProjectilePool = new ProjectilePool(scene);
    this.enemyProjectilePool = new ProjectilePool(scene);
    this.missileSystem = new MissileSystem(scene, particleSystem);
    this.playerMesh = playerMesh;
    this.playerPosition = new THREE.Vector3();
  }

  init(): void {
    EventBus.on(GameEventType.PLAYER_FIRED, ({ payload }) => {
      this.playerProjectilePool.fire(
        payload.position,
        payload.direction,
        this.getPlayerDamage()
      );
    });

    EventBus.on(GameEventType.ENEMY_FIRED, ({ payload }) => {
      this.enemyProjectilePool.fire(
        payload.position,
        payload.direction,
        payload.damage,
        payload.owner,
        payload.faction
      );
    });

    EventBus.on(GameEventType.FRIENDLY_FIRED, ({ payload }) => {
      this.enemyProjectilePool.fire(
        payload.position,
        payload.direction,
        payload.damage,
        payload.owner,
        payload.faction
      );
    });

    EventBus.on(GameEventType.MISSILE_FIRED, ({ payload }) => {
      this.missileSystem.fire(payload.position, new THREE.Vector3(0, 0, -1), payload.target);
    });
  }

  update(deltaTime: number): void {
    this.playerPosition.copy(this.playerMesh.position);
    this.playerProjectilePool.update(deltaTime);
    this.enemyProjectilePool.update(deltaTime);
    this.missileSystem.update(deltaTime);
  }

  dispose(): void {
    // ProjectilePool 没有 dispose 方法，清理由 scene 处理
  }

  setDamageMultiplier(multiplier: number): void {
    this.damageMultiplier = multiplier;
  }

  private getPlayerDamage(): number {
    const baseDamage = 12.5;
    return baseDamage * this.damageMultiplier;
  }

  checkProjectileCollisions(
    enemyMeshes: THREE.Object3D[],
    friendlyMeshes: THREE.Object3D[],
    onEnemyHit: (target: THREE.Object3D, damage: number) => void,
    onPlayerHit: (damage: number) => void,
    onFriendlyHit: (target: THREE.Object3D, damage: number) => void
  ): void {
    const targets: TargetInfo[] = [
      { mesh: this.playerMesh, faction: Faction.NEUTRAL },
      ...enemyMeshes.map((m) => ({ mesh: m, faction: Faction.ENEMY })),
      ...friendlyMeshes.map((m) => ({ mesh: m, faction: Faction.FRIENDLY })),
    ];

    this.playerProjectilePool.checkCollisions(enemyMeshes, (target) => {
      onEnemyHit(target, this.getPlayerDamage());
    });

    this.missileSystem.checkCollisions(enemyMeshes, (target) => {
      onEnemyHit(target, 50 * this.damageMultiplier);
      EventBus.emit(GameEventType.MISSILE_HIT, {
        position: target.position.clone(),
        target,
      });
    });

    this.enemyProjectilePool.checkCollisions(
      targets.map((t) => t.mesh),
      (hitObject, projectileMesh, damage) => {
        const projectileFaction = projectileMesh.userData.faction as Faction | undefined;

        if (!projectileFaction) return;

        const target = targets.find((t) => t.mesh === hitObject);
        if (!target) return;

        if (areHostile(projectileFaction, target.faction)) {
          if (target.faction === Faction.NEUTRAL) {
            onPlayerHit(damage);
          } else if (target.faction === Faction.ENEMY) {
            onEnemyHit(target.mesh, damage);
          } else if (target.faction === Faction.FRIENDLY) {
            onFriendlyHit(target.mesh, damage);
          }
        }
      }
    );
  }

  updateEnemyMeshes(enemyMeshes: THREE.Object3D[]): void {
    this.missileSystem.updateEnemies(enemyMeshes);
  }

  getPlayerProjectilePool(): ProjectilePool {
    return this.playerProjectilePool;
  }

  getEnemyProjectilePool(): ProjectilePool {
    return this.enemyProjectilePool;
  }

  getMissileSystem(): MissileSystem {
    return this.missileSystem;
  }
}
