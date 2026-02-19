import * as THREE from 'three';
import { GameLoop } from '@/core/GameLoop';
import { GameScene } from '@/scenes/GameScene';
import { GameState, GameStatus } from '@/core/GameState';
import { EventBus, GameEventType } from '@/core/EventBus';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { EnemySystem } from '@/core/systems/EnemySystem';
import { PowerUpSystem } from '@/core/systems/PowerUpSystem';
import { InputHandler } from '@/core/Input/InputHandler';
import { AudioManager } from '@/core/Audio/AudioManager';
import { MusicSystem, LevelMusic } from '@/core/Audio/MusicSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { PlayerStats, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { UpgradeMenu } from '@/ui/UpgradeMenu';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { PowerUpType, POWER_UP_CONFIGS } from '@/features/powerups/PowerUpSystem';
import { HUD } from '@/ui/HUD';
import { StartMenu, GameSettings } from '@/ui/StartMenu';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { ThirdPersonCamera } from '@/features/camera/ThirdPersonCamera';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { GAME_CONSTANTS } from '@/config';
import { BossAI, createBossMesh } from '@/features/boss/BossAI';
import { DesertFortressAI, createDesertFortressMesh } from '@/features/boss/DesertFortressAI';
import { OctopusWarshipAI, createOctopusWarshipMesh } from '@/features/boss/OctopusWarshipAI';
import { MissileDestroyerAI, createMissileDestroyerMesh } from '@/features/boss/MissileDestroyerAI';
import { SkyCarrierAI, createSkyCarrierMesh } from '@/features/boss/SkyCarrierAI';
import {
  BOSS_CONFIGS,
  BOSS_MISSILE_CONFIG,
  FLAK_CANNON_CONFIG,
  getBossForLevel,
  BossType,
  BossConfig,
} from '@/features/boss/BossTypes';
import { Faction } from '@/core/Faction';
import { createPlayerMesh, createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';

export class GameCoordinator {
  private gameLoop: GameLoop;
  private gameScene: GameScene;
  private gameState: GameState;
  private inputHandler: InputHandler;
  private audioManager: AudioManager;
  private musicSystem: MusicSystem;
  private particleSystem: ParticleSystem;
  private thirdPersonCamera: ThirdPersonCamera;

  private playerSystem: PlayerSystem;
  private combatSystem: CombatSystem;
  private enemySystem: EnemySystem;
  private powerUpSystem: PowerUpSystem;

  private hud: HUD;
  private startMenu: StartMenu;
  private lockOnIndicator: LockOnIndicator;
  private enemyHealthBars: EnemyHealthBars;

  private playerStats: PlayerStats;
  private playerAircraft: THREE.Group;

  private missileCount: number = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
  private missileRespawnTimer: number = 0;
  private missileFiringScheduled: boolean = false;
  private multiShotActive: boolean = false;

  private currentLevelId: number = 1;
  private audioInitialized: boolean = false;

  // Boss 战相关
  private bossMode: boolean = false; // Boss 模式：直接 Boss 战，跳过波次
  private inLevelBossBattle: boolean = false; // 普通模式：波次完成后的 Boss 战
  private currentBoss:
    | BossAI
    | DesertFortressAI
    | OctopusWarshipAI
    | MissileDestroyerAI
    | SkyCarrierAI
    | null = null;
  private bossFriendlySpawnTimer: number = 0;
  private bossIndicator: BossMissileIndicator;
  private laserDamageCooldown: number = 0;

  private isPaused: boolean = false;
  private upgradeMenu: UpgradeMenu | null = null;

  // 资源清理追踪
  private eventUnsubscribers: (() => void)[] = [];
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor() {
    this.gameLoop = new GameLoop();
    this.gameScene = new GameScene();
    this.inputHandler = new InputHandler();
    this.gameState = new GameState();
    this.audioManager = new AudioManager();
    this.musicSystem = new MusicSystem();
    this.particleSystem = new ParticleSystem(this.gameScene.scene);
    this.playerStats = new PlayerStats();

    this.playerAircraft = createPlayerMesh();
    this.gameScene.scene.add(this.playerAircraft);

    this.thirdPersonCamera = new ThirdPersonCamera(this.gameScene.camera, this.playerAircraft);

    this.playerSystem = new PlayerSystem(
      this.gameScene.scene,
      this.playerAircraft,
      this.playerStats
    );

    this.combatSystem = new CombatSystem(
      this.gameScene.scene,
      this.particleSystem,
      this.playerAircraft
    );

    this.enemySystem = new EnemySystem(this.gameScene.scene);

    this.powerUpSystem = new PowerUpSystem(this.gameScene.scene, this.particleSystem);

    this.hud = new HUD();
    this.lockOnIndicator = new LockOnIndicator();
    this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
    this.enemyHealthBars = new EnemyHealthBars();
    this.startMenu = new StartMenu();
    this.bossIndicator = new BossMissileIndicator();

    this.upgradeMenu = new UpgradeMenu(
      this.playerStats.getUpgrades(),
      (type: UpgradeType) => this.handleUpgrade(type),
      () => this.resumeGame()
    );

    this.initSystems();
    this.setupEventListeners();
    this.setupStartMenu();
  }

  private initSystems(): void {
    this.playerSystem.init();
    this.combatSystem.init();
    this.enemySystem.init();
    this.powerUpSystem.init();
  }

  private setupEventListeners(): void {
    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.PLAYER_HIT, ({ payload }) => {
        if (!this.playerSystem.isShieldActive()) {
          this.audioManager.playHit();
          this.particleSystem.createHit(payload.position);
        }
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.PLAYER_DEATH, ({ payload }) => {
        this.audioManager.stopEngine();
        this.audioManager.playExplosion();
        this.particleSystem.createExplosion(payload.position, 2);
        this.lockOnIndicator.cancelLockOn();
        this.playerAircraft.visible = false;

        if (this.playerSystem.getLives() <= 0) {
          this.gameState.setStatus(GameStatus.GAME_OVER);
          this.audioManager.playGameOver();
          this.musicSystem.stopMusic();
          this.hud.showGameOver(this.gameState.getScore());
        }
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.PLAYER_RESPAWN, ({ payload }) => {
        this.particleSystem.createExplosion(payload.position, 1.5);
        this.playerAircraft.visible = true;
        this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
        this.hud.updateMissiles(this.missileCount);
        this.audioManager.startEngine();

        this.playerSystem.activateShield(this.gameScene.scene);
        this.powerUpSystem.addActivePowerUp(
          PowerUpType.SHIELD,
          POWER_UP_CONFIGS[PowerUpType.SHIELD]
        );
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.ENEMY_FIRED, () => {
        this.audioManager.playShoot();
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.FRIENDLY_FIRED, () => {
        this.audioManager.playShoot();
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.PLAYER_FIRED, () => {
        this.audioManager.playShoot();
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
        this.gameState.addScore(payload.config.scoreValue);
        this.playerStats.addScore(payload.config.scoreValue);
        this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
        this.audioManager.playExplosion();
        this.particleSystem.createExplosion(payload.position, payload.config.scale);

        if (Math.random() < GAME_CONSTANTS.POWERUP.SPAWN_CHANCE) {
          this.powerUpSystem.spawn(payload.position);
        }
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.WAVE_START, () => {
        this.audioManager.playWaveStart();
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.LEVEL_COMPLETE, () => {
        this.audioManager.playLevelUp();

        this.combatSystem.getPlayerProjectilePool().clear();
        this.combatSystem.getEnemyProjectilePool().clear();
        this.particleSystem.clear();
        this.powerUpSystem.clear();

        this.musicSystem.stopMusic();

        this.startLevelBossBattle();
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.POWERUP_COLLECTED, ({ payload }) => {
        this.audioManager.playPowerUp();
        this.hud.showPowerUp(payload.config.name, payload.config.icon, payload.config.duration);

        this.handlePowerUpEffect(payload.type, payload.config);
      })
    );

    this.eventUnsubscribers.push(
      EventBus.on(GameEventType.POWERUP_EXPIRED, ({ payload }) => {
        this.handlePowerUpExpired(payload.type);
      })
    );
  }

  private handlePowerUpEffect(
    type: PowerUpType,
    config: (typeof POWER_UP_CONFIGS)[PowerUpType]
  ): void {
    switch (type) {
      case PowerUpType.HEALTH:
        this.playerSystem.setLives(this.playerSystem.getLives() + 1);
        this.playerSystem.syncMaxHealth();
        this.playerSystem.getHealth().healToMax();
        this.hud.updateLives(this.playerSystem.getLives());
        break;
      case PowerUpType.SHIELD:
        this.playerSystem.activateShield(this.gameScene.scene);
        break;
      case PowerUpType.SPEED:
        this.playerStats.setSpeedMultiplier(config.value);
        break;
      case PowerUpType.DAMAGE:
        this.playerStats.setDamageMultiplier(config.value);
        this.combatSystem.setDamageMultiplier(config.value);
        break;
      case PowerUpType.MULTISHOT:
        this.playerStats.setRapidFire(3, 30);
        this.multiShotActive = true;
        break;
      case PowerUpType.BOMB:
        this.spawnFriendlyAI();
        break;
    }
  }

  private handlePowerUpExpired(type: PowerUpType): void {
    switch (type) {
      case PowerUpType.SHIELD:
        this.playerSystem.deactivateShield();
        break;
      case PowerUpType.SPEED:
        this.playerStats.resetSpeedMultiplier();
        break;
      case PowerUpType.DAMAGE:
        this.playerStats.resetDamageMultiplier();
        this.combatSystem.setDamageMultiplier(1);
        break;
      case PowerUpType.MULTISHOT:
        this.playerStats.resetRapidFire();
        this.multiShotActive = false;
        break;
    }
  }

  private setupStartMenu(): void {
    this.startMenu.setOnStart((settings: GameSettings) => {
      this.playerSystem.setLives(settings.playerLives);
      this.audioManager.setSFXVolume(settings.soundVolume);
      this.currentLevelId = settings.startLevel;
      this.bossMode = settings.gameMode === 'boss';

      if (settings.testScore > 0) {
        this.playerStats.addScore(settings.testScore);
        this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
      }

      this.gameState.start();
      this.start();
    });
  }

  private spawnFriendlyAI(): void {
    const enemyTypes = Object.values(EnemyType);
    const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const config = ENEMY_CONFIGS[randomType];

    const mesh = createEnemyMesh(config);
    const friendly = new FriendlyAI(mesh, config, this.gameScene.scene);

    const playerPos = this.playerSystem.getPosition();
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 100
    );
    mesh.position.copy(playerPos).add(offset);

    this.gameScene.scene.add(mesh);
    this.enemySystem.spawnFriendly(friendly);
  }

  private spawnFighterFromBoss(position: THREE.Vector3): void {
    const MAX_ENEMIES = 8;
    if (this.enemySystem.getAliveEnemyCount() >= MAX_ENEMIES) {
      return;
    }
    this.enemySystem.spawnEnemyAt(EnemyType.FIGHTER, position);
    this.hud.showPowerUpBig('⚠️', '敌机起飞！');
  }

  private update(deltaTime: number): void {
    if (this.gameState.getStatus() !== GameStatus.PLAYING) {
      return;
    }

    if (this.inputHandler.isPauseToggled() || this.inputHandler.isUpgradeToggled()) {
      if (this.isPaused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
      return;
    }

    if (this.isPaused) {
      return;
    }

    const input = this.inputHandler.getState();

    if (!this.playerSystem.isPlayerRespawning()) {
      this.playerSystem.getController().update(deltaTime, input);

      if (input.fire && this.playerSystem.canFire()) {
        this.playerSystem.fire();
      }

      this.handleMissileInput(input);
    }

    this.playerSystem.update(deltaTime);
    this.combatSystem.update(deltaTime);

    if ((this.bossMode || this.inLevelBossBattle) && this.currentBoss) {
      this.updateBossBattle(deltaTime);
    } else {
      this.enemySystem.updateWithPlayer(deltaTime, this.playerSystem.getPosition());
    }

    this.powerUpSystem.update(deltaTime);

    const enemyMeshes = this.enemySystem.getEnemyMeshes();
    const friendlyMeshes = this.enemySystem.getFriendlyAIs().map((f) => f.getMesh());

    this.combatSystem.updateEnemyMeshes(enemyMeshes);

    this.combatSystem.checkProjectileCollisions(
      enemyMeshes,
      friendlyMeshes,
      (target, damage) => {
        const enemy = this.enemySystem.getEnemies().find((e) => e.getMesh() === target);
        enemy?.takeDamage(damage);
      },
      (damage) => {
        if (!this.playerSystem.isShieldActive()) {
          this.playerSystem.getHealth().takeDamage(damage);
        }
      },
      (target, damage) => {
        const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
        friendly?.takeDamage(damage);
      }
    );

    this.handleBalloonCollisions();

    this.particleSystem.update(deltaTime);
    this.audioManager.updateEngine(this.playerSystem.getSpeed());

    const engineGlow = this.playerAircraft.getObjectByName('engineGlow');
    if (engineGlow) {
      const scale = 0.5 + (this.playerSystem.getSpeed() / 100) * 1;
      engineGlow.scale.setScalar(scale);
    }

    this.updateUI();
    this.updateMissileRespawn(deltaTime);
  }

  private updateBossBattle(deltaTime: number): void {
    if (!this.currentBoss) return;

    const friendlyMeshes = this.enemySystem.getFriendlyAIs().map((f) => f.getMesh());

    const bossMissileSystem = this.currentBoss.getMissileSystem();
    const bossAllParts = this.currentBoss.getCollisionParts();
    const missileMeshes = bossMissileSystem ? bossMissileSystem.getMissileMeshes() : [];
    const bossAndMissiles = [...bossAllParts, ...missileMeshes];
    this.enemySystem.updateWithPlayer(deltaTime, this.playerSystem.getPosition(), bossAndMissiles);

    this.currentBoss.update(deltaTime, this.playerSystem.getMesh(), friendlyMeshes);

    if (bossMissileSystem) {
      bossMissileSystem.checkCollisions(
        [this.playerAircraft, ...friendlyMeshes],
        (target: THREE.Object3D, _damage: number) => {
          this.particleSystem.createExplosion(target.position.clone(), 1);
          if (target === this.playerAircraft) {
            if (!this.playerSystem.isShieldActive()) {
              this.playerSystem.getHealth().takeDamage(BOSS_MISSILE_CONFIG.DAMAGE);
            }
          } else {
            const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
            friendly?.takeDamage(BOSS_MISSILE_CONFIG.DAMAGE);
          }
        }
      );
    }

    // 对于 OctopusWarship，眼睛碰撞检查必须先于 Boss 本体检查
    // 因为导弹在碰撞后会被停用，所以需要先检查眼睛再检查本体
    if (this.currentBoss instanceof OctopusWarshipAI) {
      const octopusBoss = this.currentBoss;
      const eyeParts = octopusBoss.getEyeCollisionParts();
      const eyeMeshes = eyeParts.map((p) => p.mesh);

      this.combatSystem.getMissileSystem().checkCollisions(eyeMeshes, (target) => {
        const part = eyeParts.find((p) => p.mesh === target);
        if (part) {
          octopusBoss.takeEyeDamage(part.index, GAME_CONSTANTS.MISSILE.DAMAGE);
          const hitWorldPos = new THREE.Vector3();
          target.getWorldPosition(hitWorldPos);
          this.particleSystem.createExplosion(hitWorldPos, 1);
          this.audioManager.playExplosion();
        }
      });

      this.combatSystem.getPlayerProjectilePool().checkCollisions(eyeMeshes, (target) => {
        const part = eyeParts.find((p) => p.mesh === target);
        if (part) {
          octopusBoss.takeEyeDamage(part.index, this.combatSystem['damageMultiplier'] * 12.5);
          const hitWorldPos = new THREE.Vector3();
          target.getWorldPosition(hitWorldPos);
          this.particleSystem.createHit(hitWorldPos);
        }
      });
    }

    // Boss 本体和 Boss 导弹的碰撞检查
    const missileTargets = [this.currentBoss.getMesh(), ...bossAllParts, ...missileMeshes];
    this.combatSystem.getMissileSystem().checkCollisions(missileTargets, (target) => {
      const hitWorldPos = new THREE.Vector3();
      target.getWorldPosition(hitWorldPos);

      const isBossPart = bossAllParts.some((p) => p === target);
      if (target === this.currentBoss?.getMesh() || isBossPart) {
        this.currentBoss?.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
        this.particleSystem.createExplosion(hitWorldPos, 1.5);
        this.audioManager.playExplosion();
      } else if (bossMissileSystem) {
        const missile = bossMissileSystem.getMissiles().find((m) => m.getMesh() === target);
        if (missile) {
          missile.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
          this.particleSystem.createExplosion(hitWorldPos, 0.8);
        }
      }
    });

    const bossTargets = [...bossAllParts, ...missileMeshes];

    this.combatSystem.getPlayerProjectilePool().checkCollisions(bossTargets, (target) => {
      const isBossPart = bossAllParts.some((p) => p === target);
      if (isBossPart || target === this.currentBoss?.getMesh()) {
        this.currentBoss?.takeDamage(this.combatSystem['damageMultiplier'] * 12.5);
        const hitWorldPos = new THREE.Vector3();
        target.getWorldPosition(hitWorldPos);
        this.particleSystem.createHit(hitWorldPos);
      } else if (bossMissileSystem) {
        const missile = bossMissileSystem.getMissiles().find((m) => m.getMesh() === target);
        if (missile) {
          missile.takeDamage(this.combatSystem['damageMultiplier'] * 12.5);
        }
      }
    });

    this.combatSystem
      .getEnemyProjectilePool()
      .checkCollisions(bossTargets, (target: THREE.Object3D, _projectile, damage: number) => {
        const isBossPart = bossAllParts.some((p) => p === target);
        if (isBossPart || target === this.currentBoss?.getMesh()) {
          this.currentBoss?.takeDamage(damage);
          const hitWorldPos = new THREE.Vector3();
          target.getWorldPosition(hitWorldPos);
          this.particleSystem.createHit(hitWorldPos);
        } else if (bossMissileSystem) {
          const missile = bossMissileSystem.getMissiles().find((m) => m.getMesh() === target);
          if (missile) {
            missile.takeDamage(damage);
            this.particleSystem.createExplosion(target.position.clone(), 0.5);
          }
        }
      });

    if (this.currentBoss instanceof OctopusWarshipAI) {
      this.updateOctopusWarshipBattle(deltaTime);
    }

    this.bossFriendlySpawnTimer += deltaTime;
    if (this.bossFriendlySpawnTimer >= 30) {
      this.bossFriendlySpawnTimer = 0;
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '友军支援');
    }

    this.updateBossMissileIndicators();
  }

  private updateOctopusWarshipBattle(deltaTime: number): void {
    if (!(this.currentBoss instanceof OctopusWarshipAI)) return;

    const octopusBoss = this.currentBoss;
    const playerPos = this.playerAircraft.position;

    if (this.laserDamageCooldown > 0) {
      this.laserDamageCooldown -= deltaTime;
    }

    if (octopusBoss.checkLaserCollision(playerPos)) {
      if (!this.playerSystem.isShieldActive() && this.laserDamageCooldown <= 0) {
        this.playerSystem.getHealth().takeDamage(octopusBoss.getConfig().damage);
        this.particleSystem.createHit(playerPos);
        this.laserDamageCooldown = 1.0;
      }
    }

    const eyeParts = octopusBoss.getEyeCollisionParts();
    const eyeMeshes = eyeParts.map((p) => p.mesh);
    const eyeBulletMeshes = octopusBoss.getEyeBulletMeshes();

    // 友军子弹对眼睛的碰撞检查（玩家导弹和机枪已在 updateBossBattle 中处理）
    const allEyeTargets = [...eyeMeshes, ...eyeBulletMeshes];
    this.combatSystem
      .getEnemyProjectilePool()
      .checkCollisions(allEyeTargets, (target: THREE.Object3D, _projectile, _damage: number) => {
        const part = eyeParts.find((p) => p.mesh === target);
        if (part) {
          octopusBoss.takeEyeDamage(part.index, this.combatSystem['damageMultiplier'] * 12.5);
          const hitWorldPos = new THREE.Vector3();
          target.getWorldPosition(hitWorldPos);
          this.particleSystem.createHit(hitWorldPos);
        }
      });

    const eyeBulletCollideRadius = 5;
    for (const bulletMesh of eyeBulletMeshes) {
      const bulletPos = bulletMesh.position;

      const playerPos = this.playerSystem.getPosition();
      if (bulletPos.distanceTo(playerPos) < eyeBulletCollideRadius) {
        if (!this.playerSystem.isShieldActive()) {
          this.playerSystem.getHealth().takeDamage(octopusBoss.getEyeDamage());
          this.particleSystem.createHit(playerPos);
          this.audioManager.playHit();
        }
        octopusBoss.getEyeSystem().removeBullet(bulletMesh);
        break;
      }

      const friendlies = this.enemySystem.getFriendlyAIs();
      for (const friendly of friendlies) {
        if (!friendly.isAlive()) continue;
        const friendlyPos = friendly.getMesh().position;
        if (bulletPos.distanceTo(friendlyPos) < eyeBulletCollideRadius) {
          friendly.takeDamage(octopusBoss.getEyeDamage());
          this.particleSystem.createHit(friendlyPos);
          octopusBoss.getEyeSystem().removeBullet(bulletMesh);
          break;
        }
      }
    }
  }

  private updateBossMissileIndicators(): void {
    if (!this.currentBoss) {
      this.bossIndicator.clear();
      return;
    }

    const bossMissileSystem = this.currentBoss.getMissileSystem();
    if (!bossMissileSystem) {
      this.bossIndicator.clear();
      return;
    }

    const missiles = bossMissileSystem.getMissiles();
    const playerPosition = this.playerSystem.getPosition();
    const camera = this.gameScene.camera;

    // 只显示锁定玩家的导弹指示器
    const indicatorData = missiles
      .filter((missile) => missile.isTargetingPlayer)
      .filter((missile) => {
        // 验证导弹位置有效性，过滤掉位置无效的导弹
        const pos = missile.getMesh().position;
        return isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z);
      })
      .map((missile, index) => {
        const worldPos = missile.getMesh().position.clone();
        const distance = playerPosition.distanceTo(worldPos);
        const inView = this.isPositionInView(worldPos);

        return {
          id: `boss-missile-${index}`,
          worldPos,
          distance,
          inView,
        };
      });

    this.bossIndicator.update(indicatorData, camera);
  }

  private isPositionInView(worldPos: THREE.Vector3): boolean {
    const camera = this.gameScene.camera;
    const vector = worldPos.clone();
    vector.project(camera);

    return vector.x >= -1 && vector.x <= 1 && vector.y >= -1 && vector.y <= 1 && vector.z <= 1;
  }

  private handleMissileInput(input: ReturnType<InputHandler['getState']>): void {
    let targetMeshes: THREE.Object3D[] = this.enemySystem.getEnemyMeshes();

    if ((this.bossMode || this.inLevelBossBattle) && this.currentBoss) {
      const bossPartMeshes = this.currentBoss.getCollisionParts();
      targetMeshes = [...bossPartMeshes, ...targetMeshes];
      const bossMissileSystem = this.currentBoss.getMissileSystem();
      if (bossMissileSystem) {
        const bossMissiles = bossMissileSystem.getMissileMeshes();
        targetMeshes = [...targetMeshes, ...bossMissiles];
      }
    }

    const enemyScreenPos = this.enemyHealthBars.getFirstEnemyScreenPos();

    if (this.missileCount <= 0) {
      if (input.missile) {
        this.lockOnIndicator.setNoMissiles(true);
      } else {
        this.lockOnIndicator.setNoMissiles(false);
      }
      return;
    }

    this.lockOnIndicator.setNoMissiles(false);

    if (this.lockOnIndicator.isLocking()) {
      const lockComplete = this.lockOnIndicator.update(
        this.playerSystem.getPosition(),
        targetMeshes,
        this.gameScene.camera,
        0.016,
        enemyScreenPos
      );

      if (lockComplete) {
        const lockedTarget = this.lockOnIndicator.getCurrentTarget();
        if (lockedTarget && this.missileCount > 0 && !this.missileFiringScheduled) {
          this.missileFiringScheduled = true;

          this.scheduleTimeout(() => {
            this.fireMissile(lockedTarget);
            this.lockOnIndicator.onMissileFired();
            this.missileFiringScheduled = false;
          }, 200);
        }
      }
    } else if (input.missile) {
      this.audioManager.playMissileLock();
      this.lockOnIndicator.startLockOn();
    } else {
      this.lockOnIndicator.cancelLockOn();
    }
  }

  private fireMissile(target?: THREE.Object3D): void {
    if (this.missileCount <= 0) return;

    const missileCount = this.multiShotActive ? Math.min(3, this.missileCount) : 1;

    for (let i = 0; i < missileCount; i++) {
      this.scheduleTimeout(() => {
        if (this.missileCount <= 0) return;

        const position = this.playerSystem.getPosition().clone();
        const quaternion = this.playerSystem.getQuaternion();

        const cockpitOffset = new THREE.Vector3(0, 0.3, -0.5);
        cockpitOffset.applyQuaternion(quaternion);
        position.add(cockpitOffset);

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(quaternion);

        this.combatSystem.getMissileSystem().fire(position, forward, target);
        this.audioManager.playMissileLaunch();

        this.missileCount--;
        this.hud.updateMissiles(this.missileCount);
        this.lockOnIndicator.onMissileFired();
      }, i * 100);
    }
  }

  private handleBalloonCollisions(): void {
    if (this.playerSystem.isPlayerRespawning()) return;

    const projectiles = this.combatSystem.getPlayerProjectilePool().getActiveProjectiles();
    const projectilePositions = projectiles.map((p) => p.position);

    this.powerUpSystem.checkProjectileCollisions(projectilePositions, (_balloon, type) => {
      const config = POWER_UP_CONFIGS[type];
      this.audioManager.playBalloonPop();
      this.hud.showPowerUpBig(config.icon, config.name, 1);

      if (config.duration > 0) {
        this.hud.showPowerUp(config.name, config.icon, config.duration);
      }

      this.powerUpSystem.addActivePowerUp(type, config);
    });

    this.powerUpSystem.checkPlayerCollisions(this.playerSystem.getPosition(), (_type, config) => {
      this.audioManager.playPowerUp();
      this.hud.showPowerUp(config.name, config.icon, 0);
    });
  }

  private updateUI(): void {
    this.hud.updateHealth(this.playerSystem.getHealth().getHealthPercent());
    this.hud.updateSpeed(this.playerSystem.getSpeed());
    this.hud.updateScore(this.gameState.getScore());
    this.hud.updateEnemies(this.enemySystem.getAliveEnemyCount());

    const totalEnemies = this.enemySystem.getTotalEnemyCount();
    const spawnedEnemies = this.enemySystem.getSpawnedEnemyCount();
    const aliveEnemies = this.enemySystem.getAliveEnemyCount();
    const killedEnemies = spawnedEnemies - aliveEnemies;
    const remaining = totalEnemies - killedEnemies;
    this.hud.updateRemainingEnemies(remaining);
    this.hud.updateLives(this.playerSystem.getLives());
    this.hud.update(this.gameState.getStatus() === GameStatus.PLAYING ? 0.016 : 0);

    this.updateEnemyHealthBars();
  }

  private updateEnemyHealthBars(): void {
    const enemies = this.enemySystem.getEnemies();
    const friendlies = this.enemySystem.getFriendlyAIs();

    const enemyData = enemies
      .filter((e) => e.isAlive())
      .map((e) => ({
        mesh: e.getMesh(),
        currentHealth: e.getHealth().current,
        maxHealth: e.getConfig().health,
      }));

    const friendlyData = friendlies
      .filter((f) => f.isAlive())
      .map((f) => ({
        mesh: f.getMesh(),
        currentHealth: f.getHealth().current,
        maxHealth: f.getHealth().max,
      }));

    // Boss 血条数据
    const bossData: Array<{ mesh: THREE.Object3D; currentHealth: number; maxHealth: number }> = [];
    if (
      (this.bossMode || this.inLevelBossBattle) &&
      this.currentBoss &&
      this.currentBoss.isAlive()
    ) {
      bossData.push({
        mesh: this.currentBoss.getMesh(),
        currentHealth: this.currentBoss.getHealth().current,
        maxHealth: this.currentBoss.getHealth().max,
      });
    }

    // Boss 眼睛血条数据（第三关 Boss）
    const eyeData: Array<{ mesh: THREE.Object3D; currentHealth: number; maxHealth: number }> = [];
    if (
      (this.bossMode || this.inLevelBossBattle) &&
      this.currentBoss instanceof OctopusWarshipAI &&
      this.currentBoss.isAlive()
    ) {
      const eyeSystem = this.currentBoss.getEyeSystem();
      const eyeParts = eyeSystem.getCollisionParts();
      for (const part of eyeParts) {
        const health = eyeSystem.getEyeHealth(part.index);
        if (health) {
          eyeData.push({
            mesh: part.mesh,
            currentHealth: health.current,
            maxHealth: health.max,
          });
        }
      }
    }

    this.enemyHealthBars.update(
      [...enemyData, ...bossData, ...eyeData],
      friendlyData,
      this.gameScene.camera,
      this.playerSystem.getPosition()
    );
  }

  private updateMissileRespawn(deltaTime: number): void {
    if (this.missileCount < GAME_CONSTANTS.MISSILE.MAX_RESPAWN_MISSILES) {
      this.missileRespawnTimer += deltaTime;
      if (this.missileRespawnTimer >= GAME_CONSTANTS.MISSILE.MISSILE_RESPAWN_TIME) {
        this.missileCount++;
        this.hud.updateMissiles(this.missileCount);
        this.missileRespawnTimer = 0;
      }
    }

    this.hud.updateMissileProgress(
      this.missileRespawnTimer / GAME_CONSTANTS.MISSILE.MISSILE_RESPAWN_TIME
    );
  }

  private render(): void {
    this.thirdPersonCamera.update();
    this.gameScene.render();
  }

  public start(): void {
    this.gameState.setStatus(GameStatus.PLAYING);
    this.playerSystem.getHealth().reset();

    if (!this.audioInitialized) {
      this.audioManager.resume();
      this.musicSystem.resume();
      this.audioInitialized = true;
    }

    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.hud.updateMissiles(this.missileCount);

    this.gameLoop.start(
      (dt) => this.update(dt),
      () => this.render()
    );
    this.audioManager.startEngine();

    if (this.bossMode) {
      this.startBossBattle();
    } else {
      this.enemySystem.loadLevel(this.currentLevelId);

      this.scheduleTimeout(() => {
        this.enemySystem.startWave(this.playerSystem.getPosition());
      }, GAME_CONSTANTS.LEVEL.START_DELAY * 1000);

      this.musicSystem.playLevelMusic(this.getLevelMusic(this.currentLevelId));

      this.scheduleTimeout(() => {
        this.spawnFriendlyAI();
        this.hud.showPowerUpBig('✈️', '召唤友军');
      }, 1000);
    }
  }

  private startBossBattle(): void {
    this.musicSystem.playBossMusic(this.currentLevelId);

    this.enemySystem.loadLevel(this.currentLevelId);

    const bossType = getBossForLevel(this.currentLevelId);
    if (!bossType) return;

    const config = BOSS_CONFIGS[bossType];

    if (bossType === BossType.DESERT_FORTRESS) {
      this.createDesertFortressBoss(config);
    } else if (bossType === BossType.OCTOPUS_WARSHIP) {
      this.createOctopusWarshipBoss(config);
    } else if (bossType === BossType.MISSILE_DESTROYER) {
      this.createMissileDestroyerBoss(config);
    } else if (bossType === BossType.SKY_CARRIER) {
      this.createSkyCarrierBoss(config);
    } else {
      this.createHeavyBomberBoss(config);
    }

    this.bossFriendlySpawnTimer = 0;

    this.scheduleTimeout(() => {
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '召唤友军');
    }, 1000);
  }

  private createHeavyBomberBoss(config: BossConfig): void {
    const mesh = createBossMesh(config);

    const playerPos = this.playerSystem.getPosition();
    const spawnOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    mesh.position.copy(playerPos).add(spawnOffset);

    this.gameScene.scene.add(mesh);

    this.currentBoss = new BossAI(mesh, config, this.gameScene.scene, this.particleSystem);

    this.currentBoss.onFire = (position, direction, damage) => {
      this.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, this.currentBoss?.getMesh(), Faction.ENEMY);
      this.audioManager.playShoot();
    };

    this.currentBoss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, true);
    };

    this.currentBoss.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };
  }

  private createDesertFortressBoss(config: BossConfig): void {
    const mesh = createDesertFortressMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x, -50, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const desertFortress = new DesertFortressAI(
      mesh,
      config,
      this.gameScene.scene,
      this.particleSystem
    );
    this.currentBoss = desertFortress;

    desertFortress.onFlakFire = (_position) => {
      this.audioManager.playFlakCannonFire();
    };

    desertFortress.onFlakExplode = (position, _radius, _damage) => {
      this.particleSystem.createFlakExplosion(position, FLAK_CANNON_CONFIG.AOE_RADIUS);
      this.audioManager.playFlakCannonExplosion();

      const targets = [
        this.playerAircraft,
        ...this.enemySystem.getFriendlyAIs().map((f) => f.getMesh()),
      ];
      desertFortress.getFlakCannonSystem().checkAoeCollisions(targets, (target, damage) => {
        this.particleSystem.createHit(target.position);
        if (target === this.playerAircraft) {
          if (!this.playerSystem.isShieldActive()) {
            this.playerSystem.getHealth().takeDamage(damage);
          }
        } else {
          const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
          friendly?.takeDamage(damage);
        }
      });
    };

    desertFortress.onDestroy = (position, bossConfig) => {
      if (this.currentBoss) {
        const missileSystem = this.currentBoss.getMissileSystem();
        if (missileSystem) {
          missileSystem.dispose();
        }
        (this.currentBoss as DesertFortressAI).getFlakCannonSystem().dispose();
      }
      this.handleBossDestroy(position, bossConfig, true);
    };

    desertFortress.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };
  }

  private createOctopusWarshipBoss(config: BossConfig): void {
    const mesh = createOctopusWarshipMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x + (Math.random() - 0.5) * 100, 150, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const octopusWarship = new OctopusWarshipAI(mesh, config, this.particleSystem);
    this.currentBoss = octopusWarship;

    octopusWarship.init();

    octopusWarship.onTeleport = (from, to) => {
      this.particleSystem.createTeleportOut(from);
      this.particleSystem.createTeleportIn(to);
    };

    octopusWarship.onLaserWarning = () => {
      this.hud.showPowerUpBig('⚠️', '激光预警！', 1, true);
    };

    octopusWarship.onLaserSweep = () => {
      this.hud.showPowerUpBig('💣', '激光扫射！', 1, true);
    };

    octopusWarship.onLaserHit = () => {
      if (!this.playerSystem.isShieldActive()) {
        this.playerSystem.getHealth().takeDamage(config.damage);
        this.particleSystem.createHit(this.playerAircraft.position);
      }
    };

    octopusWarship.onDestroy = (position, bossConfig) => {
      octopusWarship.getLaserSystem().dispose();
      octopusWarship.getEyeSystem().dispose();
      this.handleBossDestroy(position, bossConfig, true);
    };
  }

  private createMissileDestroyerBoss(config: BossConfig): void {
    const mesh = createMissileDestroyerMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x, -50, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const missileDestroyer = new MissileDestroyerAI(
      mesh,
      config,
      this.gameScene.scene,
      this.particleSystem
    );
    this.currentBoss = missileDestroyer;

    missileDestroyer.onFlakFire = (_position) => {
      this.audioManager.playFlakCannonFire();
    };

    missileDestroyer.onFlakExplode = (position, _radius, _damage) => {
      this.particleSystem.createFlakExplosion(position, FLAK_CANNON_CONFIG.AOE_RADIUS);
      this.audioManager.playFlakCannonExplosion();

      const targets = [
        this.playerAircraft,
        ...this.enemySystem.getFriendlyAIs().map((f) => f.getMesh()),
      ];
      missileDestroyer.getFlakCannonSystem().checkAoeCollisions(targets, (target, damage) => {
        this.particleSystem.createHit(target.position);
        if (target === this.playerAircraft) {
          if (!this.playerSystem.isShieldActive()) {
            this.playerSystem.getHealth().takeDamage(damage);
          }
        } else {
          const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
          friendly?.takeDamage(damage);
        }
      });
    };

    missileDestroyer.onDestroy = (position, bossConfig) => {
      if (this.currentBoss) {
        const missileSystem = this.currentBoss.getMissileSystem();
        if (missileSystem) {
          missileSystem.dispose();
        }
        (this.currentBoss as MissileDestroyerAI).getFlakCannonSystem().dispose();
      }
      this.handleBossDestroy(position, bossConfig, true);
    };

    missileDestroyer.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };

    missileDestroyer.onFighterSpawn = (position) => {
      this.spawnFighterFromBoss(position);
    };
  }

  private createSkyCarrierBoss(config: BossConfig): void {
    const mesh = createSkyCarrierMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x, 200, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const skyCarrier = new SkyCarrierAI(mesh, config, this.gameScene.scene, this.particleSystem);
    this.currentBoss = skyCarrier;

    skyCarrier.onFire = (position, direction, damage) => {
      this.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, this.currentBoss?.getMesh(), Faction.ENEMY);
      this.audioManager.playShoot();
    };

    skyCarrier.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, true);
    };

    skyCarrier.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };

    skyCarrier.onEnemySpawn = (position, enemyType) => {
      const MAX_ENEMIES = 8;
      if (this.enemySystem.getAliveEnemyCount() >= MAX_ENEMIES) {
        return;
      }
      this.enemySystem.spawnEnemyAt(enemyType, position);
      this.hud.showPowerUpBig('⚠️', '敌机起飞！');
    };
  }

  private handleBossDestroy(
    position: THREE.Vector3,
    bossConfig: BossConfig,
    isBossMode: boolean
  ): void {
    this.audioManager.playExplosion();
    this.particleSystem.createExplosion(position, bossConfig.scale);
    this.gameState.addScore(bossConfig.scoreValue);
    this.playerStats.addScore(bossConfig.scoreValue);

    this.bossIndicator.clear();

    if (this.currentBoss) {
      const missileSystem = this.currentBoss.getMissileSystem();
      if (missileSystem) {
        missileSystem.dispose();
      }
    }

    for (const friendly of this.enemySystem.getFriendlyAIs()) {
      friendly.dispose();
    }
    this.enemySystem['friendlyAIs'] = [];

    this.combatSystem.getPlayerProjectilePool().clear();
    this.combatSystem.getEnemyProjectilePool().clear();
    this.particleSystem.clear();

    this.hud.showPowerUpBig('🏆', 'Boss 已击败！');
    this.currentBoss?.dispose();
    this.currentBoss = null;

    this.scheduleTimeout(() => {
      this.currentLevelId++;
      if (this.currentLevelId <= 5) {
        this.hud.showPowerUpBig('⏭️', `进入第 ${this.currentLevelId} 关`);
        this.scheduleTimeout(() => {
          if (isBossMode) {
            this.startBossBattle();
          } else {
            this.enemySystem.loadLevel(this.currentLevelId);
            this.hud.updateRemainingEnemies(this.enemySystem.getTotalEnemyCount());
            this.musicSystem.playLevelMusic(this.getLevelMusic(this.currentLevelId));
            this.enemySystem.startWave(this.playerSystem.getPosition());
          }
        }, 2000);
      } else {
        this.gameState.setStatus(GameStatus.GAME_OVER);
        this.musicSystem.stopMusic();
        this.hud.showGameOver(this.gameState.getScore());
      }
    }, 1000);
  }

  private startLevelBossBattle(): void {
    this.inLevelBossBattle = true;
    this.musicSystem.playBossMusic(this.currentLevelId);

    const bossType = getBossForLevel(this.currentLevelId);
    if (!bossType) return;

    const config = BOSS_CONFIGS[bossType];

    if (bossType === BossType.DESERT_FORTRESS) {
      this.createDesertFortressBossForLevel(config);
    } else if (bossType === BossType.OCTOPUS_WARSHIP) {
      this.createOctopusWarshipBossForLevel(config);
    } else if (bossType === BossType.MISSILE_DESTROYER) {
      this.createMissileDestroyerBossForLevel(config);
    } else if (bossType === BossType.SKY_CARRIER) {
      this.createSkyCarrierBossForLevel(config);
    } else {
      this.createHeavyBomberBossForLevel(config);
    }

    this.bossFriendlySpawnTimer = 0;

    this.scheduleTimeout(() => {
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '召唤友军');
    }, 1000);
  }

  private createHeavyBomberBossForLevel(config: BossConfig): void {
    const mesh = createBossMesh(config);

    const playerPos = this.playerSystem.getPosition();
    const spawnOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    mesh.position.copy(playerPos).add(spawnOffset);

    this.gameScene.scene.add(mesh);

    this.currentBoss = new BossAI(mesh, config, this.gameScene.scene, this.particleSystem);

    this.currentBoss.onFire = (position, direction, damage) => {
      this.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, this.currentBoss?.getMesh(), Faction.ENEMY);
      this.audioManager.playShoot();
    };

    this.currentBoss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, false);
      this.inLevelBossBattle = false;
    };

    this.currentBoss.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };
  }

  private createDesertFortressBossForLevel(config: BossConfig): void {
    const mesh = createDesertFortressMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x, -50, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const desertFortress = new DesertFortressAI(
      mesh,
      config,
      this.gameScene.scene,
      this.particleSystem
    );
    this.currentBoss = desertFortress;

    desertFortress.onFlakFire = (_position) => {
      this.audioManager.playFlakCannonFire();
    };

    desertFortress.onFlakExplode = (position, _radius, _damage) => {
      this.particleSystem.createFlakExplosion(position, FLAK_CANNON_CONFIG.AOE_RADIUS);
      this.audioManager.playFlakCannonExplosion();

      const targets = [
        this.playerAircraft,
        ...this.enemySystem.getFriendlyAIs().map((f) => f.getMesh()),
      ];
      desertFortress.getFlakCannonSystem().checkAoeCollisions(targets, (target, damage) => {
        this.particleSystem.createHit(target.position);
        if (target === this.playerAircraft) {
          if (!this.playerSystem.isShieldActive()) {
            this.playerSystem.getHealth().takeDamage(damage);
          }
        } else {
          const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
          friendly?.takeDamage(damage);
        }
      });
    };

    desertFortress.onDestroy = (position, bossConfig) => {
      if (this.currentBoss) {
        const missileSystem = this.currentBoss.getMissileSystem();
        if (missileSystem) {
          missileSystem.dispose();
        }
        (this.currentBoss as DesertFortressAI).getFlakCannonSystem().dispose();
      }
      this.handleBossDestroy(position, bossConfig, false);
      this.inLevelBossBattle = false;
    };

    desertFortress.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };
  }

  private createOctopusWarshipBossForLevel(config: BossConfig): void {
    const mesh = createOctopusWarshipMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x + (Math.random() - 0.5) * 100, 150, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const octopusWarship = new OctopusWarshipAI(mesh, config, this.particleSystem);
    this.currentBoss = octopusWarship;

    octopusWarship.init();

    octopusWarship.onTeleport = (from, to) => {
      this.particleSystem.createTeleportOut(from);
      this.particleSystem.createTeleportIn(to);
    };

    octopusWarship.onLaserWarning = () => {
      this.hud.showPowerUpBig('⚠️', '激光预警！', 1, true);
    };

    octopusWarship.onLaserSweep = () => {
      this.hud.showPowerUpBig('💣', '激光扫射！', 1, true);
    };

    octopusWarship.onLaserHit = () => {
      if (!this.playerSystem.isShieldActive()) {
        this.playerSystem.getHealth().takeDamage(config.damage);
        this.particleSystem.createHit(this.playerAircraft.position);
      }
    };

    octopusWarship.onDestroy = (position, bossConfig) => {
      octopusWarship.getLaserSystem().dispose();
      octopusWarship.getEyeSystem().dispose();
      this.handleBossDestroy(position, bossConfig, false);
      this.inLevelBossBattle = false;
    };
  }

  private createMissileDestroyerBossForLevel(config: BossConfig): void {
    const mesh = createMissileDestroyerMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x, -50, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const missileDestroyer = new MissileDestroyerAI(
      mesh,
      config,
      this.gameScene.scene,
      this.particleSystem
    );
    this.currentBoss = missileDestroyer;

    missileDestroyer.onFlakFire = (_position) => {
      this.audioManager.playFlakCannonFire();
    };

    missileDestroyer.onFlakExplode = (position, _radius, _damage) => {
      this.particleSystem.createFlakExplosion(position, FLAK_CANNON_CONFIG.AOE_RADIUS);
      this.audioManager.playFlakCannonExplosion();

      const targets = [
        this.playerAircraft,
        ...this.enemySystem.getFriendlyAIs().map((f) => f.getMesh()),
      ];
      missileDestroyer.getFlakCannonSystem().checkAoeCollisions(targets, (target, damage) => {
        this.particleSystem.createHit(target.position);
        if (target === this.playerAircraft) {
          if (!this.playerSystem.isShieldActive()) {
            this.playerSystem.getHealth().takeDamage(damage);
          }
        } else {
          const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
          friendly?.takeDamage(damage);
        }
      });
    };

    missileDestroyer.onDestroy = (position, bossConfig) => {
      if (this.currentBoss) {
        const missileSystem = this.currentBoss.getMissileSystem();
        if (missileSystem) {
          missileSystem.dispose();
        }
        (this.currentBoss as MissileDestroyerAI).getFlakCannonSystem().dispose();
      }
      this.handleBossDestroy(position, bossConfig, false);
      this.inLevelBossBattle = false;
    };

    missileDestroyer.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };

    missileDestroyer.onFighterSpawn = (position) => {
      this.spawnFighterFromBoss(position);
    };
  }

  private createSkyCarrierBossForLevel(config: BossConfig): void {
    const mesh = createSkyCarrierMesh(config);

    const playerPos = this.playerSystem.getPosition();
    mesh.position.set(playerPos.x, 200, playerPos.z + 200);

    this.gameScene.scene.add(mesh);

    const skyCarrier = new SkyCarrierAI(mesh, config, this.gameScene.scene, this.particleSystem);
    this.currentBoss = skyCarrier;

    skyCarrier.onFire = (position, direction, damage) => {
      this.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, this.currentBoss?.getMesh(), Faction.ENEMY);
      this.audioManager.playShoot();
    };

    skyCarrier.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, false);
      this.inLevelBossBattle = false;
    };

    skyCarrier.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };

    skyCarrier.onEnemySpawn = (position, enemyType) => {
      const MAX_ENEMIES = 8;
      if (this.enemySystem.getAliveEnemyCount() >= MAX_ENEMIES) {
        return;
      }
      this.enemySystem.spawnEnemyAt(enemyType, position);
      this.hud.showPowerUpBig('⚠️', '敌机起飞！');
    };
  }

  public stop(): void {
    this.gameLoop.stop();
    this.audioManager.stopEngine();
    this.musicSystem.stopMusic();
  }

  private getLevelMusic(levelId: number): LevelMusic {
    const levelMusicMap: Record<number, LevelMusic> = {
      1: LevelMusic.LAKE,
      2: LevelMusic.DESERT,
      3: LevelMusic.SNOW,
      4: LevelMusic.OCEAN,
      5: LevelMusic.CITY,
    };
    return levelMusicMap[levelId] || LevelMusic.LAKE;
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.upgradeMenu?.show();
    this.inputHandler.resetPauseState();
    this.inputHandler.resetUpgradeState();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.upgradeMenu?.hide();
    this.inputHandler.resetPauseState();
    this.inputHandler.resetUpgradeState();
  }

  private handleUpgrade(type: UpgradeType): void {
    if (this.playerStats.getUpgrades().upgrade(type)) {
      if (type === UpgradeType.MAX_HEALTH) {
        this.playerSystem.syncMaxHealth();
      }
      if (type === UpgradeType.MISSILE_LOCK_TIME) {
        this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
      }
      this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    }
  }

  private scheduleTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timeoutId = setTimeout(() => {
      this.pendingTimeouts.delete(timeoutId);
      callback();
    }, delay);
    this.pendingTimeouts.add(timeoutId);
    return timeoutId;
  }

  public dispose(): void {
    for (const timeoutId of this.pendingTimeouts) {
      clearTimeout(timeoutId);
    }
    this.pendingTimeouts.clear();

    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];

    this.stop();
    this.enemySystem.dispose();
    this.particleSystem.clear();
    this.powerUpSystem.dispose();
    this.gameScene.dispose();
    this.musicSystem.dispose();
  }
}
