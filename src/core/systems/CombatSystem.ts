import { Vector3 } from 'three';
import type { Group, Mesh, Object3D, Scene } from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { ProjectilePool, type ProjectileImpactSurface } from '@/features/combat/ProjectilePool';
import { BossProjectilePool } from '@/features/combat/BossProjectilePool';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { Faction, areHostile } from '@/core/Faction';
import { GAME_CONSTANTS } from '@/config';

type EnvironmentProjectileSource = 'player' | 'enemy' | 'boss';
export type ProjectileHitSource =
  | 'player-bullet'
  | 'friendly-bullet'
  | 'enemy-bullet'
  | 'boss-projectile'
  | 'missile';

type TargetHitHandler = (target: Object3D, damage: number, source: ProjectileHitSource) => void;
type PlayerHitHandler = (damage: number, source: ProjectileHitSource) => void;

export class CombatSystem implements IGameSystem {
  readonly name = 'CombatSystem';

  private playerProjectilePool: ProjectilePool;
  private enemyProjectilePool: ProjectilePool;
  private bossProjectilePool: BossProjectilePool;
  private missileSystem: MissileSystem;

  private playerMesh: Group;
  private playerPosition: Vector3;
  private environmentImpactHeight: ProjectileImpactSurface | null = null;
  private onEnvironmentImpact?: (position: Vector3, source: EnvironmentProjectileSource) => void;

  private damageMultiplier: number = 1;
  private eventUnsubscribers: (() => void)[] = [];

  // 逐帧复用的碰撞目标表 [玩家, ...敌机, ...友军]：阵营按下标区间判定，不再每帧新建目标对象
  private readonly collisionTargets: Object3D[] = [];
  private collisionEnemyCount = 0;
  // 当前 checkProjectileCollisions 的回调：命中回调只在该调用期间同步触发（不可重入）
  private activeEnemyHit: TargetHitHandler | null = null;
  private activePlayerHit: PlayerHitHandler | null = null;
  private activeFriendlyHit: TargetHitHandler | null = null;

  // 只创建一次的回调（原先每帧新建闭包）
  private readonly handlePlayerEnvironmentImpact = (position: Vector3): void => {
    this.onEnvironmentImpact?.(position, 'player');
  };
  private readonly handleEnemyEnvironmentImpact = (position: Vector3): void => {
    this.onEnvironmentImpact?.(position, 'enemy');
  };
  private readonly handleBossEnvironmentImpact = (position: Vector3): void => {
    this.onEnvironmentImpact?.(position, 'boss');
  };
  private readonly handlePlayerBulletHit = (
    target: Object3D,
    _mesh: Mesh,
    damage: number
  ): void => {
    this.activeEnemyHit?.(target, damage, 'player-bullet');
  };
  private readonly handleMissileHit = (target: Object3D, impactPosition: Vector3): void => {
    this.activeEnemyHit?.(target, GAME_CONSTANTS.MISSILE.DAMAGE * this.damageMultiplier, 'missile');
    EventBus.emit(GameEventType.MISSILE_HIT, {
      position: impactPosition,
      target,
    });
  };
  private readonly handleEnemyProjectileHit = (
    hitObject: Object3D,
    projectileMesh: Mesh,
    damage: number
  ): void => {
    const projectileFaction = projectileMesh.userData.faction as Faction | undefined;
    if (!projectileFaction) return;
    const source: ProjectileHitSource =
      projectileFaction === Faction.FRIENDLY ? 'friendly-bullet' : 'enemy-bullet';
    this.dispatchFactionHit(hitObject, damage, projectileFaction, source);
  };
  private readonly handleBossProjectileHit = (
    hitObject: Object3D,
    projectileMesh: Mesh,
    damage: number
  ): void => {
    const projectileFaction = projectileMesh.userData.faction as Faction | undefined;
    if (!projectileFaction) return;
    this.dispatchFactionHit(hitObject, damage, projectileFaction, 'boss-projectile');
  };

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
    this.playerProjectilePool.update(
      deltaTime,
      this.environmentImpactHeight ?? undefined,
      this.handlePlayerEnvironmentImpact
    );
    this.enemyProjectilePool.update(
      deltaTime,
      this.environmentImpactHeight ?? undefined,
      this.handleEnemyEnvironmentImpact
    );
    this.bossProjectilePool.update(
      deltaTime,
      this.environmentImpactHeight ?? undefined,
      this.handleBossEnvironmentImpact
    );
    this.missileSystem.update(deltaTime);
  }

  dispose(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    this.collisionTargets.length = 0;

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

  /**
   * 环境命中：impactHeight 为固定高度或 (x, z) → 地表高度的采样函数（子弹低于地表即命中地形）
   */
  setEnvironmentImpactHandler(
    impactHeight: ProjectileImpactSurface | null,
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
    // 调用开始时快照目标表（与原先一致），按下标写入复用数组
    const targets = this.collisionTargets;
    let count = 0;
    targets[count++] = this.playerMesh;
    for (let i = 0; i < enemyMeshes.length; i++) targets[count++] = enemyMeshes[i];
    for (let i = 0; i < friendlyMeshes.length; i++) targets[count++] = friendlyMeshes[i];
    targets.length = count;
    this.collisionEnemyCount = enemyMeshes.length;
    this.activeEnemyHit = onEnemyHit;
    this.activePlayerHit = onPlayerHit;
    this.activeFriendlyHit = onFriendlyHit;

    this.playerProjectilePool.checkCollisions(enemyMeshes, this.handlePlayerBulletHit);
    this.missileSystem.checkCollisions(enemyMeshes, this.handleMissileHit);
    this.enemyProjectilePool.checkCollisions(targets, this.handleEnemyProjectileHit);
    this.bossProjectilePool.checkCollisions(targets, this.handleBossProjectileHit);

    // 调用结束后不再持有调用方的回调
    this.activeEnemyHit = null;
    this.activePlayerHit = null;
    this.activeFriendlyHit = null;
  }

  /** 按碰撞目标表的下标区间取阵营：0 玩家，随后敌机，最后友军（首个匹配与原先 find 一致） */
  private dispatchFactionHit(
    hitObject: Object3D,
    damage: number,
    projectileFaction: Faction,
    source: ProjectileHitSource
  ): void {
    const index = this.collisionTargets.indexOf(hitObject);
    if (index < 0) return;
    const targetFaction =
      index === 0
        ? Faction.NEUTRAL
        : index <= this.collisionEnemyCount
          ? Faction.ENEMY
          : Faction.FRIENDLY;
    if (!areHostile(projectileFaction, targetFaction)) return;
    if (targetFaction === Faction.NEUTRAL) {
      this.activePlayerHit?.(damage, source);
    } else if (targetFaction === Faction.ENEMY) {
      this.activeEnemyHit?.(hitObject, damage, source);
    } else {
      this.activeFriendlyHit?.(hitObject, damage, source);
    }
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
