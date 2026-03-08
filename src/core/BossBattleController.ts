import { Vector3 } from 'three';
import type { Camera, Object3D, Scene } from 'three';
import { AudioManager } from '@/core/Audio/AudioManager';
import { MusicSystem } from '@/core/Audio/MusicSystem';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { EnemySystem } from '@/core/systems/EnemySystem';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { HUD } from '@/ui/HUD';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { Faction } from '@/core/Faction';
import { GAME_CONSTANTS } from '@/config';
import type { BossAI } from '@/features/boss/BossAI';
import type { DesertFortressAI } from '@/features/boss/DesertFortressAI';
import type { MissileDestroyerAI } from '@/features/boss/MissileDestroyerAI';
import type { OctopusWarshipAI } from '@/features/boss/OctopusWarshipAI';
import type { SkyCarrierAI } from '@/features/boss/SkyCarrierAI';
import {
  BOSS_MISSILE_CONFIG,
  BossConfig,
  BossType,
  FLAK_CANNON_CONFIG,
  getBossForLevel,
} from '@/features/boss/BossTypes';

export type ActiveBoss =
  | BossAI
  | DesertFortressAI
  | OctopusWarshipAI
  | MissileDestroyerAI
  | SkyCarrierAI;

interface BossBattleControllerDeps {
  scene: Scene;
  camera: Camera;
  particleSystem: ParticleSystem;
  combatSystem: CombatSystem;
  enemySystem: EnemySystem;
  playerSystem: PlayerSystem;
  playerAircraft: Object3D;
  audioManager: AudioManager;
  musicSystem: MusicSystem;
  hud: HUD;
  bossIndicator: BossMissileIndicator;
  resolveBossConfig: (bossType: BossType) => BossConfig;
  onBossDestroyed: (position: Vector3, config: BossConfig, isBossMode: boolean) => void;
  onSpawnFriendly: () => void;
  onSpawnEnemyFromBoss: (position: Vector3, enemyType: EnemyType) => void;
  scheduleTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
}

interface BossMissileIndicatorSnapshot {
  id: string;
  worldPos: Vector3;
  distance: number;
  inView: boolean;
}

/**
 * Boss 战控制器
 * 负责 Boss 生命周期、更新、碰撞与第三关特殊机制。
 */
export class BossBattleController {
  private static readonly BOSS_INDICATOR_UPDATE_INTERVAL = 1 / 24;

  private currentBoss: ActiveBoss | null = null;
  private currentBossType: BossType | null = null;
  private bossFriendlySpawnTimer: number = 0;
  private laserDamageCooldown: number = 0;
  private loadSequence: number = 0;
  private bossIndicatorUpdateTimer: number = 0;
  private bossIndicatorHasRenderedData: boolean = false;
  private readonly bossIndicatorSnapshots: BossMissileIndicatorSnapshot[] = [];
  private readonly indicatorProjection = new Vector3();

  constructor(private readonly deps: BossBattleControllerDeps) {}

  public getCurrentBoss(): ActiveBoss | null {
    return this.currentBoss;
  }

  public hasActiveBoss(): boolean {
    return this.currentBoss !== null;
  }

  public start(level: number, isBossMode: boolean): boolean {
    const bossType = getBossForLevel(level);
    if (!bossType) {
      return false;
    }

    this.deps.musicSystem.playBossMusic(level);
    this.deps.enemySystem.loadLevel(level);
    this.clear();
    this.bossFriendlySpawnTimer = 0;
    this.laserDamageCooldown = 0;
    const loadSequence = ++this.loadSequence;

    this.deps.scheduleTimeout(() => {
      this.deps.onSpawnFriendly();
      this.deps.hud.showPowerUpBig('✈️', '召唤友军');
    }, 1000);

    void this.loadBoss(loadSequence, bossType, isBossMode);

    return true;
  }

  public update(deltaTime: number): void {
    if (!this.currentBoss || !this.currentBossType) {
      return;
    }

    const friendlyMeshes = this.deps.enemySystem.getFriendlyAIs().map((friendly) => friendly.getMesh());
    const bossMissileSystem = this.currentBoss.getMissileSystem();
    const bossParts = this.currentBoss.getCollisionParts();
    const missileMeshes = bossMissileSystem ? bossMissileSystem.getMissileMeshes() : [];
    const bossTargets = [...bossParts, ...missileMeshes];

    this.deps.enemySystem.updateWithPlayer(
      deltaTime,
      this.deps.playerSystem.getPosition(),
      [this.currentBoss.getMesh(), ...bossTargets]
    );

    this.currentBoss.update(deltaTime, this.deps.playerSystem.getMesh(), friendlyMeshes);
    this.updateBossMissileCollisions(bossMissileSystem, friendlyMeshes);
    this.updatePlayerWeaponBossCollisions(bossParts, missileMeshes, bossMissileSystem);

    if (this.currentBossType === BossType.OCTOPUS_WARSHIP && this.isOctopusWarshipBoss(this.currentBoss)) {
      this.updateOctopusSpecials(deltaTime, this.currentBoss);
    }

    this.bossFriendlySpawnTimer += deltaTime;
    if (this.bossFriendlySpawnTimer >= 30) {
      this.bossFriendlySpawnTimer = 0;
      this.deps.onSpawnFriendly();
      this.deps.hud.showPowerUpBig('✈️', '友军支援');
    }

    this.bossIndicatorUpdateTimer += deltaTime;
    if (
      this.bossIndicatorUpdateTimer >= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL
    ) {
      this.bossIndicatorUpdateTimer %= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL;
      this.updateBossIndicators();
    }
  }

  public clear(): void {
    this.loadSequence++;
    this.resetBossIndicatorState();

    if (!this.currentBoss) {
      this.currentBossType = null;
      return;
    }

    const missileSystem = this.currentBoss.getMissileSystem();
    missileSystem?.dispose();
    this.disposeBossSpecificSystems(this.currentBoss, this.currentBossType);
    this.currentBoss.dispose();
    this.currentBoss = null;
    this.currentBossType = null;
    this.bossFriendlySpawnTimer = 0;
    this.laserDamageCooldown = 0;
  }

  private async loadBoss(
    loadSequence: number,
    bossType: BossType,
    isBossMode: boolean
  ): Promise<void> {
    const config = this.deps.resolveBossConfig(bossType);
    let boss: ActiveBoss;

    try {
      boss = await this.createBoss(bossType, config, isBossMode);
    } catch (error) {
      if (loadSequence !== this.loadSequence) {
        return;
      }

      console.error(`Failed to load boss module for ${bossType}`, error);
      this.currentBoss = null;
      this.currentBossType = null;
      this.resetBossIndicatorState();
      return;
    }

    if (loadSequence !== this.loadSequence) {
      this.disposeBossSpecificSystems(boss, bossType);
      boss.dispose();
      return;
    }

    this.currentBoss = boss;
    this.currentBossType = bossType;
  }

  private async createBoss(
    bossType: BossType,
    config: BossConfig,
    isBossMode: boolean
  ): Promise<ActiveBoss> {
    switch (bossType) {
      case BossType.DESERT_FORTRESS:
        return this.createDesertFortressBoss(config, isBossMode);
      case BossType.OCTOPUS_WARSHIP:
        return this.createOctopusWarshipBoss(config, isBossMode);
      case BossType.MISSILE_DESTROYER:
        return this.createMissileDestroyerBoss(config, isBossMode);
      case BossType.SKY_CARRIER:
        return this.createSkyCarrierBoss(config, isBossMode);
      case BossType.HEAVY_BOMBER:
      default:
        return this.createHeavyBomberBoss(config, isBossMode);
    }
  }

  private async createHeavyBomberBoss(config: BossConfig, isBossMode: boolean): Promise<BossAI> {
    const { BossAI, createBossMesh } = await import('@/features/boss/BossAI');
    const mesh = createBossMesh(config);
    const playerPos = this.deps.playerSystem.getPosition();
    const spawnOffset = new Vector3(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    mesh.position.copy(playerPos).add(spawnOffset);
    this.deps.scene.add(mesh);

    const boss = new BossAI(mesh, config, this.deps.scene, this.deps.particleSystem);
    boss.onFire = (position, direction, damage) => {
      this.deps.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, boss.getMesh(), Faction.ENEMY);
      this.deps.audioManager.playShoot('boss');
    };
    boss.onMissileFired = () => {
      this.deps.audioManager.playMissileLaunch('boss');
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
    return boss;
  }

  private async createDesertFortressBoss(
    config: BossConfig,
    isBossMode: boolean
  ): Promise<DesertFortressAI> {
    const { DesertFortressAI, createDesertFortressMesh } = await import(
      '@/features/boss/DesertFortressAI'
    );
    const mesh = createDesertFortressMesh(config);
    const playerPos = this.deps.playerSystem.getPosition();
    mesh.position.set(playerPos.x, -50, playerPos.z + 200);
    this.deps.scene.add(mesh);

    const boss = new DesertFortressAI(mesh, config, this.deps.scene, this.deps.particleSystem);
    boss.onFlakFire = () => {
      this.deps.audioManager.playFlakCannonFire();
    };
    boss.onFlakExplode = (position) => {
      this.deps.particleSystem.createFlakExplosion(position, FLAK_CANNON_CONFIG.AOE_RADIUS);
      this.deps.audioManager.playFlakCannonExplosion();

      const targets = [
        this.deps.playerAircraft,
        ...this.deps.enemySystem.getFriendlyAIs().map((friendly) => friendly.getMesh()),
      ];
      boss.getFlakCannonSystem().checkAoeCollisions(targets, (target, damage) => {
        this.createDamageFeedback(target.position, Math.max(1.1, damage / 14));
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.getHealth().takeDamage(damage);
          }
          return;
        }

        const friendly = this.deps.enemySystem.getFriendlyAIs().find((candidate) => candidate.getMesh() === target);
        friendly?.takeDamage(damage);
      });
    };
    boss.onMissileFired = () => {
      this.deps.audioManager.playMissileLaunch('boss');
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
    return boss;
  }

  private async createOctopusWarshipBoss(
    config: BossConfig,
    isBossMode: boolean
  ): Promise<OctopusWarshipAI> {
    const { OctopusWarshipAI, createOctopusWarshipMesh } = await import(
      '@/features/boss/OctopusWarshipAI'
    );
    const mesh = createOctopusWarshipMesh(config);
    const playerPos = this.deps.playerSystem.getPosition();
    mesh.position.set(playerPos.x + (Math.random() - 0.5) * 100, 150, playerPos.z + 200);
    this.deps.scene.add(mesh);

    const boss = new OctopusWarshipAI(mesh, config, this.deps.particleSystem);
    boss.init();
    boss.onTeleport = (from, to) => {
      this.deps.particleSystem.createTeleportOut(from);
      this.deps.particleSystem.createTeleportIn(to);
      this.deps.audioManager.playTeleport();
    };
    boss.onLaserWarning = () => {
      this.deps.hud.showPowerUpBig('⚠️', '激光预警！', 1, true);
      this.deps.audioManager.playLaserWarning();
    };
    boss.onLaserSweep = () => {
      this.deps.hud.showPowerUpBig('💣', '激光扫射！', 1, true);
      this.deps.audioManager.playLaserSweep();
    };
    boss.onLaserHit = () => {
      if (!this.deps.playerSystem.isShieldActive()) {
        this.deps.playerSystem.getHealth().takeDamage(config.damage);
        this.createDamageFeedback(this.deps.playerAircraft.position, Math.max(1.1, config.damage / 18));
      }
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
    return boss;
  }

  private async createMissileDestroyerBoss(
    config: BossConfig,
    isBossMode: boolean
  ): Promise<MissileDestroyerAI> {
    const { MissileDestroyerAI, createMissileDestroyerMesh } = await import(
      '@/features/boss/MissileDestroyerAI'
    );
    const mesh = createMissileDestroyerMesh(config);
    const playerPos = this.deps.playerSystem.getPosition();
    mesh.position.set(playerPos.x, -50, playerPos.z + 200);
    this.deps.scene.add(mesh);

    const boss = new MissileDestroyerAI(mesh, config, this.deps.scene, this.deps.particleSystem);
    boss.onFlakFire = () => {
      this.deps.audioManager.playFlakCannonFire();
    };
    boss.onFlakExplode = (position) => {
      this.deps.particleSystem.createFlakExplosion(position, FLAK_CANNON_CONFIG.AOE_RADIUS);
      this.deps.audioManager.playFlakCannonExplosion();

      const targets = [
        this.deps.playerAircraft,
        ...this.deps.enemySystem.getFriendlyAIs().map((friendly) => friendly.getMesh()),
      ];
      boss.getFlakCannonSystem().checkAoeCollisions(targets, (target, damage) => {
        this.createDamageFeedback(target.position, Math.max(1.1, damage / 14));
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.getHealth().takeDamage(damage);
          }
          return;
        }

        const friendly = this.deps.enemySystem.getFriendlyAIs().find((candidate) => candidate.getMesh() === target);
        friendly?.takeDamage(damage);
      });
    };
    boss.onMissileFired = () => {
      this.deps.audioManager.playMissileLaunch('boss');
    };
    boss.onFighterSpawn = (position) => {
      this.deps.onSpawnEnemyFromBoss(position, EnemyType.FIGHTER);
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
    return boss;
  }

  private async createSkyCarrierBoss(
    config: BossConfig,
    isBossMode: boolean
  ): Promise<SkyCarrierAI> {
    const { SkyCarrierAI, createSkyCarrierMesh } = await import('@/features/boss/SkyCarrierAI');
    const mesh = createSkyCarrierMesh(config);
    const playerPos = this.deps.playerSystem.getPosition();
    mesh.position.set(playerPos.x, 200, playerPos.z + 200);
    this.deps.scene.add(mesh);

    const boss = new SkyCarrierAI(mesh, config, this.deps.scene, this.deps.particleSystem);
    boss.onFire = (position, direction, damage) => {
      this.deps.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, boss.getMesh(), Faction.ENEMY);
      this.deps.audioManager.playShoot('boss');
    };
    boss.onMissileFired = () => {
      this.deps.audioManager.playMissileLaunch('boss');
    };
    boss.onEnemySpawn = (position, enemyType) => {
      this.deps.onSpawnEnemyFromBoss(position, enemyType);
      this.deps.hud.showPowerUpBig('⚠️', '敌机起飞！');
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
    return boss;
  }

  private updateBossMissileCollisions(
    bossMissileSystem: ActiveBoss['getMissileSystem'] extends () => infer T ? T : never,
    friendlyMeshes: Object3D[]
  ): void {
    if (!bossMissileSystem) {
      return;
    }

    bossMissileSystem.checkCollisions(
      [this.deps.playerAircraft, ...friendlyMeshes],
      (target: Object3D) => {
        this.deps.particleSystem.createBossMissileExplosion(target.position.clone(), 1.15);
        this.deps.audioManager.playMissileExplosion('boss');
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.getHealth().takeDamage(BOSS_MISSILE_CONFIG.DAMAGE);
          }
          return;
        }

        const friendly = this.deps.enemySystem.getFriendlyAIs().find((candidate) => candidate.getMesh() === target);
        friendly?.takeDamage(BOSS_MISSILE_CONFIG.DAMAGE);
      }
    );
  }

  private updatePlayerWeaponBossCollisions(
    bossParts: Object3D[],
    missileMeshes: Object3D[],
    bossMissileSystem: ActiveBoss['getMissileSystem'] extends () => infer T ? T : never
  ): void {
    if (!this.currentBoss) {
      return;
    }

    if (this.currentBossType === BossType.OCTOPUS_WARSHIP && this.isOctopusWarshipBoss(this.currentBoss)) {
      const octopusBoss = this.currentBoss;
      const eyeParts = octopusBoss.getEyeCollisionParts();
      const eyeMeshes = eyeParts.map((part) => part.mesh);

      this.deps.combatSystem.getMissileSystem().checkCollisions(eyeMeshes, (target, impactPosition) => {
        const part = eyeParts.find((candidate) => candidate.mesh === target);
        if (!part) {
          return;
        }

        octopusBoss.takeEyeDamage(part.index, GAME_CONSTANTS.MISSILE.DAMAGE);
        this.deps.particleSystem.createHit(impactPosition, 1.2, 'boss');
        this.deps.particleSystem.createMissileImpact(impactPosition, 1.25);
        this.deps.audioManager.playMissileExplosion();
      });

      this.deps.combatSystem.getPlayerProjectilePool().checkCollisions(eyeMeshes, (target) => {
        const part = eyeParts.find((candidate) => candidate.mesh === target);
        if (!part) {
          return;
        }

        octopusBoss.takeEyeDamage(
          part.index,
          this.deps.combatSystem.getDamageMultiplier() * 12.5
        );
        const hitWorldPos = new Vector3();
        target.getWorldPosition(hitWorldPos);
        this.createDamageFeedback(hitWorldPos, 1.16);
      });
    }

    const missileTargets = [this.currentBoss.getMesh(), ...bossParts, ...missileMeshes];
    this.deps.combatSystem.getMissileSystem().checkCollisions(missileTargets, (target, impactPosition) => {
      const hitWorldPos = impactPosition.clone();
      const isBossPart = bossParts.includes(target);

      if (target === this.currentBoss?.getMesh() || isBossPart) {
        this.currentBoss?.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
        this.deps.particleSystem.createMissileImpact(hitWorldPos, 1.55);
        this.deps.audioManager.playMissileExplosion();
        return;
      }

      const missile = bossMissileSystem?.getMissiles().find((candidate) => candidate.getMesh() === target);
      if (missile) {
        missile.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
        this.deps.particleSystem.createBossMissileExplosion(hitWorldPos, 0.92);
        this.deps.audioManager.playMissileExplosion('boss');
      }
    });

    const bossTargets = [...bossParts, ...missileMeshes];
    this.deps.combatSystem.getPlayerProjectilePool().checkCollisions(bossTargets, (target) => {
      const isBossPart = bossParts.includes(target);
      if (isBossPart || target === this.currentBoss?.getMesh()) {
        this.currentBoss?.takeDamage(this.deps.combatSystem.getDamageMultiplier() * 12.5);
        const hitWorldPos = new Vector3();
        target.getWorldPosition(hitWorldPos);
        this.createDamageFeedback(hitWorldPos, 1.05);
        return;
      }

      const missile = bossMissileSystem?.getMissiles().find((candidate) => candidate.getMesh() === target);
      missile?.takeDamage(this.deps.combatSystem.getDamageMultiplier() * 12.5);
    });

    this.deps.combatSystem
      .getEnemyProjectilePool()
      .checkCollisions(bossTargets, (target: Object3D, _projectile, damage: number) => {
        const isBossPart = bossParts.includes(target);
        if (isBossPart || target === this.currentBoss?.getMesh()) {
          this.currentBoss?.takeDamage(damage);
          const hitWorldPos = new Vector3();
          target.getWorldPosition(hitWorldPos);
          this.createDamageFeedback(hitWorldPos, Math.max(0.9, damage / 15));
          return;
        }

        const missile = bossMissileSystem?.getMissiles().find((candidate) => candidate.getMesh() === target);
        if (missile) {
          missile.takeDamage(damage);
          this.deps.particleSystem.createBossMissileExplosion(target.position.clone(), 0.72);
          this.deps.audioManager.playMissileExplosion('boss');
        }
      });
  }

  private updateOctopusSpecials(deltaTime: number, boss: OctopusWarshipAI): void {
    const playerPosition = this.deps.playerAircraft.position;

    if (this.laserDamageCooldown > 0) {
      this.laserDamageCooldown -= deltaTime;
    }

    if (boss.checkLaserCollision(playerPosition)) {
      if (!this.deps.playerSystem.isShieldActive() && this.laserDamageCooldown <= 0) {
        this.deps.playerSystem.getHealth().takeDamage(boss.getConfig().damage);
        this.createDamageFeedback(playerPosition, Math.max(1.1, boss.getConfig().damage / 18));
        this.laserDamageCooldown = 1.0;
      }
    }

    const eyeParts = boss.getEyeCollisionParts();
    const eyeMeshes = eyeParts.map((part) => part.mesh);
    const eyeBulletMeshes = boss.getEyeBulletMeshes();
    const allEyeTargets = [...eyeMeshes, ...eyeBulletMeshes];

    this.deps.combatSystem
      .getEnemyProjectilePool()
      .checkCollisions(allEyeTargets, (target: Object3D) => {
        const part = eyeParts.find((candidate) => candidate.mesh === target);
        if (!part) {
          return;
        }

        boss.takeEyeDamage(part.index, this.deps.combatSystem.getDamageMultiplier() * 12.5);
        const hitWorldPos = new Vector3();
        target.getWorldPosition(hitWorldPos);
        this.createDamageFeedback(hitWorldPos, 1.16);
      });

    const eyeBulletCollideRadius = 5;
    for (const bulletMesh of eyeBulletMeshes) {
      const bulletPosition = bulletMesh.position;
      const currentPlayerPosition = this.deps.playerSystem.getPosition();
      if (bulletPosition.distanceTo(currentPlayerPosition) < eyeBulletCollideRadius) {
        if (!this.deps.playerSystem.isShieldActive()) {
          this.deps.playerSystem.getHealth().takeDamage(boss.getEyeDamage());
          this.createDamageFeedback(currentPlayerPosition, Math.max(1.05, boss.getEyeDamage() / 18));
        }
        this.deps.particleSystem.createHit(bulletPosition, 0.92, 'boss');
        boss.getEyeSystem().removeBullet(bulletMesh);
        break;
      }

      for (const friendly of this.deps.enemySystem.getFriendlyAIs()) {
        if (!friendly.isAlive()) {
          continue;
        }

        const friendlyPosition = friendly.getMesh().position;
        if (bulletPosition.distanceTo(friendlyPosition) < eyeBulletCollideRadius) {
          friendly.takeDamage(boss.getEyeDamage());
          this.createDamageFeedback(friendlyPosition, Math.max(0.95, boss.getEyeDamage() / 22));
          this.deps.particleSystem.createHit(bulletPosition, 0.84, 'boss');
          boss.getEyeSystem().removeBullet(bulletMesh);
          break;
        }
      }
    }
  }

  private updateBossIndicators(): void {
    if (!this.currentBoss) {
      this.resetBossIndicatorState();
      return;
    }

    const bossMissileSystem = this.currentBoss.getMissileSystem();
    if (!bossMissileSystem) {
      this.resetBossIndicatorState();
      return;
    }

    const playerPosition = this.deps.playerSystem.getPosition();
    const missiles = bossMissileSystem.getMissiles();
    let snapshotCount = 0;

    for (const missile of missiles) {
      if (!missile.isTargetingPlayer) {
        continue;
      }

      const position = missile.getMesh().position;
      if (!isFinite(position.x) || !isFinite(position.y) || !isFinite(position.z)) {
        continue;
      }

      const snapshot = this.getOrCreateBossIndicatorSnapshot(snapshotCount);
      snapshot.id = `boss-missile-${snapshotCount}`;
      snapshot.worldPos.copy(position);
      snapshot.distance = playerPosition.distanceTo(position);
      snapshot.inView = this.isPositionInView(position);
      snapshotCount++;
    }

    this.bossIndicatorSnapshots.length = snapshotCount;
    if (snapshotCount === 0) {
      this.resetBossIndicatorState();
      return;
    }

    this.deps.bossIndicator.update(this.bossIndicatorSnapshots, this.deps.camera);
    this.bossIndicatorHasRenderedData = true;
  }

  private isPositionInView(worldPos: Vector3): boolean {
    this.indicatorProjection.copy(worldPos).project(this.deps.camera);
    return (
      this.indicatorProjection.x >= -1 &&
      this.indicatorProjection.x <= 1 &&
      this.indicatorProjection.y >= -1 &&
      this.indicatorProjection.y <= 1 &&
      this.indicatorProjection.z <= 1
    );
  }

  private handleBossDestroy(position: Vector3, config: BossConfig, isBossMode: boolean): void {
    this.resetBossIndicatorState();
    if (this.currentBoss) {
      const missileSystem = this.currentBoss.getMissileSystem();
      missileSystem?.dispose();
      this.disposeBossSpecificSystems(this.currentBoss, this.currentBossType);
      this.currentBoss.dispose();
      this.currentBoss = null;
    }
    this.currentBossType = null;
    this.deps.onBossDestroyed(position, config, isBossMode);
  }

  private createDamageFeedback(
    position: Vector3,
    intensity: number = 1,
    profile: 'player' | 'enemy' | 'boss' = 'boss'
  ): void {
    this.deps.particleSystem.createHit(position, intensity, profile);
    this.deps.audioManager.playHit(intensity, profile);
  }

  private disposeBossSpecificSystems(boss: ActiveBoss, bossType: BossType | null): void {
    if (
      (bossType === BossType.DESERT_FORTRESS || bossType === BossType.MISSILE_DESTROYER) &&
      this.hasFlakCannonSystem(boss)
    ) {
      boss.getFlakCannonSystem().dispose();
      return;
    }

    if (bossType === BossType.OCTOPUS_WARSHIP && this.isOctopusWarshipBoss(boss)) {
      boss.getLaserSystem().dispose();
      boss.getEyeSystem().dispose();
    }
  }

  private hasFlakCannonSystem(
    boss: ActiveBoss
  ): boss is DesertFortressAI | MissileDestroyerAI {
    return 'getFlakCannonSystem' in boss;
  }

  private isOctopusWarshipBoss(boss: ActiveBoss): boss is OctopusWarshipAI {
    return (
      'getLaserSystem' in boss &&
      'getEyeSystem' in boss &&
      'getEyeCollisionParts' in boss &&
      'getEyeBulletMeshes' in boss &&
      'checkLaserCollision' in boss
    );
  }

  private getOrCreateBossIndicatorSnapshot(index: number): BossMissileIndicatorSnapshot {
    const existingSnapshot = this.bossIndicatorSnapshots[index];
    if (existingSnapshot) {
      return existingSnapshot;
    }

    const snapshot: BossMissileIndicatorSnapshot = {
      id: '',
      worldPos: new Vector3(),
      distance: 0,
      inView: false,
    };
    this.bossIndicatorSnapshots[index] = snapshot;
    return snapshot;
  }

  private resetBossIndicatorState(): void {
    this.bossIndicatorUpdateTimer = 0;
    this.bossIndicatorSnapshots.length = 0;

    if (!this.bossIndicatorHasRenderedData) {
      return;
    }

    this.deps.bossIndicator.clear();
    this.bossIndicatorHasRenderedData = false;
  }
}
