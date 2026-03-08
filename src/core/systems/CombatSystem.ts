import { Vector3 } from 'three';
import type { Group, Object3D, Scene } from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { ProjectilePool } from '@/features/combat/ProjectilePool';
import { BossProjectilePool } from '@/features/combat/BossProjectilePool';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { Faction, areHostile } from '@/core/Faction';

interface TargetInfo {
  mesh: Object3D;
  faction: Faction;
  ai?: unknown;
}

type EnvironmentProjectileSource = 'player' | 'enemy' | 'boss';
export type ProjectileHitSource =
  | 'player-bullet'
  | 'friendly-bullet'
  | 'enemy-bullet'
  | 'boss-projectile'
  | 'missile';

export class CombatSystem implements IGameSystem {
  readonly name = 'CombatSystem';

  private playerProjectilePool: ProjectilePool;
  private enemyProjectilePool: ProjectilePool;
  private bossProjectilePool: BossProjectilePool;
  private missileSystem: MissileSystem;

  private playerMesh: Group;
  private playerPosition: Vector3;
  private environmentImpactHeight: number | null = null;
  private onEnvironmentImpact?: (position: Vector3, source: EnvironmentProjectileSource) => void;

  private damageMultiplier: number = 1;
  private eventUnsubscribers: (() => void)[] = [];

  constructor(scene: Scene, particleSystem: ParticleSystem, playerMesh: Group) {
    this.playerProjectilePool = new ProjectilePool(scene);
    this.enemyProjectilePool = new ProjectilePool(scene);
    this.bossProjectilePool = new BossProjectilePool(scene);
    this.missileSystem = new MissileSystem(scene, particleSystem);
    this.playerMesh = playerMesh;
    this.playerPosition = new Vector3();
  }

  init(): void {
    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.PLAYER_FIRED, ({ payload }) => {
        this.playerProjectilePool.fire(payload.position, payload.direction, payload.damage);
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.ENEMY_FIRED, ({ payload }) => {
        this.enemyProjectilePool.fire(
          payload.position,
          payload.direction,
          payload.damage,
          payload.owner,
          payload.faction
        );
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.FRIENDLY_FIRED, ({ payload }) => {
        this.enemyProjectilePool.fire(
          payload.position,
          payload.direction,
          payload.damage,
          payload.owner,
          payload.faction
        );
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.MISSILE_FIRED, ({ payload }) => {
        this.missileSystem.fire(payload.position, new Vector3(0, 0, -1), payload.target);
      })
    );
  }

  update(deltaTime: number): void {
    this.playerPosition.copy(this.playerMesh.position);
    this.playerProjectilePool.update(deltaTime, this.environmentImpactHeight ?? undefined, (position) => {
      this.onEnvironmentImpact?.(position, 'player');
    });
    this.enemyProjectilePool.update(deltaTime, this.environmentImpactHeight ?? undefined, (position) => {
      this.onEnvironmentImpact?.(position, 'enemy');
    });
    this.bossProjectilePool.update(deltaTime, this.environmentImpactHeight ?? undefined, (position) => {
      this.onEnvironmentImpact?.(position, 'boss');
    });
    this.missileSystem.update(deltaTime);
  }

  dispose(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];

    this.playerProjectilePool.dispose();
    this.enemyProjectilePool.dispose();
    this.bossProjectilePool.dispose();
    this.missileSystem.dispose();
  }

  setDamageMultiplier(multiplier: number): void {
    this.damageMultiplier = multiplier;
  }

  getDamageMultiplier(): number {
    return this.damageMultiplier;
  }

  setEnvironmentImpactHandler(
    impactHeight: number | null,
    onEnvironmentImpact?: (position: Vector3, source: EnvironmentProjectileSource) => void
  ): void {
    this.environmentImpactHeight = impactHeight;
    this.onEnvironmentImpact = onEnvironmentImpact;
  }

  checkProjectileCollisions(
    enemyMeshes: Object3D[],
    friendlyMeshes: Object3D[],
    onEnemyHit: (target: Object3D, damage: number, source: ProjectileHitSource) => void,
    onPlayerHit: (damage: number, source: ProjectileHitSource) => void,
    onFriendlyHit: (target: Object3D, damage: number, source: ProjectileHitSource) => void
  ): void {
    const targets: TargetInfo[] = [
      { mesh: this.playerMesh, faction: Faction.NEUTRAL },
      ...enemyMeshes.map((m) => ({ mesh: m, faction: Faction.ENEMY })),
      ...friendlyMeshes.map((m) => ({ mesh: m, faction: Faction.FRIENDLY })),
    ];

    this.playerProjectilePool.checkCollisions(enemyMeshes, (target, _projectileMesh, damage) => {
      onEnemyHit(target, damage, 'player-bullet');
    });

    this.missileSystem.checkCollisions(enemyMeshes, (target, impactPosition) => {
      onEnemyHit(target, 50 * this.damageMultiplier, 'missile');
      EventBus.emit(GameEventType.MISSILE_HIT, {
        position: impactPosition,
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
          const source: ProjectileHitSource =
            projectileFaction === Faction.FRIENDLY ? 'friendly-bullet' : 'enemy-bullet';
          if (target.faction === Faction.NEUTRAL) {
            onPlayerHit(damage, source);
          } else if (target.faction === Faction.ENEMY) {
            onEnemyHit(target.mesh, damage, source);
          } else if (target.faction === Faction.FRIENDLY) {
            onFriendlyHit(target.mesh, damage, source);
          }
        }
      }
    );

    this.bossProjectilePool.checkCollisions(
      targets.map((t) => t.mesh),
      (hitObject, projectileMesh, damage) => {
        const projectileFaction = projectileMesh.userData.faction as Faction | undefined;

        if (!projectileFaction) return;

        const target = targets.find((t) => t.mesh === hitObject);
        if (!target) return;

        if (areHostile(projectileFaction, target.faction)) {
          const source: ProjectileHitSource = 'boss-projectile';
          if (target.faction === Faction.NEUTRAL) {
            onPlayerHit(damage, source);
          } else if (target.faction === Faction.ENEMY) {
            onEnemyHit(target.mesh, damage, source);
          } else if (target.faction === Faction.FRIENDLY) {
            onFriendlyHit(target.mesh, damage, source);
          }
        }
      }
    );
  }

  updateEnemyMeshes(enemyMeshes: Object3D[]): void {
    this.missileSystem.updateEnemies(enemyMeshes);
  }

  getPlayerProjectilePool(): ProjectilePool {
    return this.playerProjectilePool;
  }

  getEnemyProjectilePool(): ProjectilePool {
    return this.enemyProjectilePool;
  }

  getBossProjectilePool(): BossProjectilePool {
    return this.bossProjectilePool;
  }

  getMissileSystem(): MissileSystem {
    return this.missileSystem;
  }
}
