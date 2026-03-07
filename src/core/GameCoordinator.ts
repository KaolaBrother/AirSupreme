import * as THREE from 'three';
import { GameLoop } from '@/core/GameLoop';
import { GameScene } from '@/scenes/GameScene';
import { GameState } from '@/core/GameState';
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
import { GameConfig, GAME_CONSTANTS, type QualityPreset } from '@/config';
import { BOSS_CONFIGS, BossType, BossConfig } from '@/features/boss/BossTypes';
import { createPlayerMesh, createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { getDifficultyProfile } from '@/core/Difficulty';
import { getLevelConfig, LevelWaveEventType } from '@/features/terrain/LevelConfig';
import { GameSessionState } from '@/core/GameSessionState';
import { ResourceRegistry } from '@/core/ResourceRegistry';
import { PresentationController } from '@/core/PresentationController';
import { BossBattleController } from '@/core/BossBattleController';

interface EyeBossHealthData {
  current: number;
  max: number;
}

interface EyeBossSystem {
  getCollisionParts(): Array<{ index: number; mesh: THREE.Object3D }>;
  getEyeHealth(index: number): EyeBossHealthData | undefined;
}

interface EyeBoss {
  isAlive(): boolean;
  getEyeSystem(): EyeBossSystem;
}

interface GameCoordinatorOptions {
  showStartMenu?: boolean;
}

interface TutorialCombatState {
  active: boolean;
  startPosition: THREE.Vector3 | null;
  movementHintShown: boolean;
  speedHintShown: boolean;
  fireHintShown: boolean;
  missileHintShown: boolean;
  killHintShown: boolean;
  hitHintShown: boolean;
}

export class GameCoordinator {
  private static readonly TUTORIAL_STAGE_DURATION_MS = 2200;
  private static readonly TUTORIAL_STAGE_GAP_MS = 350;
  private static readonly TUTORIAL_WAVE_READY_BUFFER_MS = 1000;
  private static readonly TUTORIAL_FRIENDLY_SPAWN_DELAY_MS = 5200;
  private static readonly TUTORIAL_FRIENDLY_SPAWN_BUFFER_MS = 1200;
  private static readonly TUTORIAL_MOVE_DISTANCE = 90;
  private static readonly TUTORIAL_SPEED_THRESHOLD_RATIO = 0.72;
  private static readonly UPGRADE_FEEDBACK: Record<UpgradeType, { icon: string; label: string }> = {
    [UpgradeType.MAX_HEALTH]: { icon: '❤️', label: '最大生命值升级' },
    [UpgradeType.SPEED]: { icon: '⚡', label: '飞行速度升级' },
    [UpgradeType.FIRE_RATE]: { icon: '🔫', label: '射速升级' },
    [UpgradeType.DAMAGE]: { icon: '💥', label: '武器伤害升级' },
    [UpgradeType.MISSILE_RELOAD_TIME]: { icon: '🚀', label: '导弹装填升级' },
    [UpgradeType.MISSILE_LOCK_TIME]: { icon: '🎯', label: '导弹锁定升级' },
  };

  private gameLoop: GameLoop;
  private gameScene: GameScene;
  private gameState: GameState;
  private resourceRegistry: ResourceRegistry;
  private sessionState: GameSessionState;
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
  private startMenu: StartMenu | null;
  private lockOnIndicator: LockOnIndicator;
  private enemyHealthBars: EnemyHealthBars;
  private presentationController: PresentationController;

  private playerStats: PlayerStats;
  private playerAircraft: THREE.Group;

  private missileCount: number = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
  private missileRespawnTimer: number = 0;
  private missileFiringScheduled: boolean = false;
  private multiShotActive: boolean = false;

  private audioInitialized: boolean = false;

  private bossIndicator: BossMissileIndicator;
  private bossBattleController: BossBattleController;

  private upgradeMenu: UpgradeMenu | null = null;

  private lastAppliedQualityPreset: Exclude<QualityPreset, 'auto'> =
    GameConfig.getEffectiveQualityPreset();
  private readonly previousCameraTargetPosition = new THREE.Vector3();
  private readonly currentCameraTargetPosition = new THREE.Vector3();
  private readonly interpolatedCameraTargetPosition = new THREE.Vector3();
  private readonly previousCameraTargetQuaternion = new THREE.Quaternion();
  private readonly currentCameraTargetQuaternion = new THREE.Quaternion();
  private readonly interpolatedCameraTargetQuaternion = new THREE.Quaternion();
  private readonly tutorialCombatState: TutorialCombatState = {
    active: false,
    startPosition: null,
    movementHintShown: false,
    speedHintShown: false,
    fireHintShown: false,
    missileHintShown: false,
    killHintShown: false,
    hitHintShown: false,
  };
  private lastRenderTimestamp: number = 0;

  constructor(options: GameCoordinatorOptions = {}) {
    const showStartMenu = options.showStartMenu ?? true;
    this.gameLoop = new GameLoop();
    this.resourceRegistry = new ResourceRegistry();
    this.sessionState = new GameSessionState();
    this.setQualityPreset(GameConfig.getQualityPreset());
    this.gameScene = new GameScene();
    this.applyQualityRuntime();
    this.inputHandler = new InputHandler();
    this.gameState = new GameState();
    this.audioManager = new AudioManager();
    this.musicSystem = new MusicSystem();
    this.particleSystem = new ParticleSystem(this.gameScene.scene);
    this.playerStats = new PlayerStats();

    this.playerAircraft = createPlayerMesh();
    this.gameScene.scene.add(this.playerAircraft);
    this.syncCameraInterpolationState();

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

    this.enemySystem = new EnemySystem(this.gameScene.scene, this.sessionState);

    this.powerUpSystem = new PowerUpSystem(this.gameScene.scene, this.particleSystem);

    this.hud = new HUD();
    this.lockOnIndicator = new LockOnIndicator();
    this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
    this.enemyHealthBars = new EnemyHealthBars();
    this.startMenu = showStartMenu ? new StartMenu() : null;
    this.bossIndicator = new BossMissileIndicator();
    this.presentationController = new PresentationController({
      hud: this.hud,
      startMenu: this.startMenu,
      enemyHealthBars: this.enemyHealthBars,
      bossIndicator: this.bossIndicator,
      lockOnIndicator: this.lockOnIndicator,
    });

    this.upgradeMenu = new UpgradeMenu(
      this.playerStats.getUpgrades(),
      (type: UpgradeType) => this.handleUpgrade(type),
      () => this.resumeGame()
    );
    this.bossBattleController = new BossBattleController({
      scene: this.gameScene.scene,
      camera: this.gameScene.camera,
      particleSystem: this.particleSystem,
      combatSystem: this.combatSystem,
      enemySystem: this.enemySystem,
      playerSystem: this.playerSystem,
      playerAircraft: this.playerAircraft,
      audioManager: this.audioManager,
      musicSystem: this.musicSystem,
      hud: this.hud,
      bossIndicator: this.bossIndicator,
      resolveBossConfig: (bossType: BossType) => this.getAdjustedBossConfig(BOSS_CONFIGS[bossType]),
      onBossDestroyed: (position, config, isBossMode) =>
        this.handleBossDestroy(position, config, isBossMode),
      onSpawnFriendly: () => this.spawnFriendlyAI(),
      onSpawnEnemyFromBoss: (position, enemyType) => this.spawnEnemyFromBoss(position, enemyType),
      scheduleTimeout: (callback, delay) => this.scheduleTimeout(callback, delay),
    });

    this.enemySystem.setDifficultyProfile(getDifficultyProfile(this.sessionState.getDifficulty()));

    this.initSystems();
    this.setupEventListeners();
    if (showStartMenu) {
      this.setupStartMenu();
    }
  }

  private initSystems(): void {
    this.playerSystem.init();
    this.combatSystem.init();
    this.enemySystem.init();
    this.powerUpSystem.init();
  }

  private setupEventListeners(): void {
    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_HIT, ({ payload }) => {
        this.handleTutorialPlayerHit();
        if (!this.playerSystem.isShieldActive()) {
          this.audioManager.playHit();
          this.particleSystem.createHit(payload.position);
        }
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_DEATH, ({ payload }) => {
        this.audioManager.stopEngine();
        this.audioManager.playExplosion();
        this.particleSystem.createExplosion(payload.position, 2);
        this.lockOnIndicator.cancelLockOn();
        this.playerAircraft.visible = false;

        if (this.playerSystem.getLives() <= 0) {
          this.sessionState.setGameOver();
          this.audioManager.playGameOver();
          this.musicSystem.stopMusic();
          this.hud.showGameOver(this.gameState.getScore());
        }
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_RESPAWN, ({ payload }) => {
        this.particleSystem.createExplosion(payload.position, 1.5);
        this.playerAircraft.visible = true;
        this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
        this.presentationController.updateMissileHud(
          0,
          { missileCount: this.missileCount, missileProgress: 0 },
          true
        );
        this.audioManager.startEngine();

        this.playerSystem.activateShield(this.gameScene.scene);
        this.powerUpSystem.addActivePowerUp(
          PowerUpType.SHIELD,
          POWER_UP_CONFIGS[PowerUpType.SHIELD]
        );
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.ENEMY_FIRED, () => {
        this.audioManager.playShoot();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.FRIENDLY_FIRED, () => {
        this.audioManager.playShoot();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_FIRED, () => {
        this.handleTutorialPlayerFired();
        this.audioManager.playShoot();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
        this.gameState.addScore(payload.config.scoreValue);
        const earnedPoints = this.playerStats.addScore(payload.config.scoreValue);
        this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
        this.notifyEarnedUpgradePoints(earnedPoints);
        this.audioManager.playExplosion();
        this.particleSystem.createExplosion(payload.position, payload.config.scale);
        this.handleTutorialEnemyDeath();

        if (this.shouldSpawnPowerUp()) {
          this.spawnPowerUpForCurrentLevel(payload.position);
        }
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.MISSILE_FIRED, () => {
        this.handleTutorialMissileFired();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_START, () => {
        this.audioManager.playWaveStart();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_EVENT_START, ({ payload }) => {
        this.handleWaveEventStart(payload.eventType, payload.wave);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.LEVEL_COMPLETE, () => {
        this.audioManager.playLevelUp();

        this.playerSystem.syncMaxHealth();
        this.playerSystem.getHealth().healToMax();
        this.hud.updateHealth(this.playerSystem.getHealth().getHealthPercent());

        this.combatSystem.getPlayerProjectilePool().clear();
        this.combatSystem.getEnemyProjectilePool().clear();
        this.particleSystem.clear();
        this.powerUpSystem.clear();

        this.musicSystem.stopMusic();

        this.startLevelBossBattle();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.POWERUP_COLLECTED, ({ payload }) => {
        this.audioManager.playPowerUp();
        this.hud.showPowerUp(payload.config.name, payload.config.icon, payload.config.duration);

        this.handlePowerUpEffect(payload.type, payload.config);
      })
    );

    this.resourceRegistry.addUnsubscriber(
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
    this.presentationController.wireStartMenu((settings: GameSettings) => {
      this.applyGameSettings(settings);
      this.start();
    });
  }

  public boot(settings: GameSettings): void {
    this.applyGameSettings(settings);
    this.start();
  }

  private applyGameSettings(settings: GameSettings): void {
    this.sessionState.applySettings({
      difficulty: settings.difficulty,
      audioSettings: {
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
      },
      tutorialEnabled: settings.tutorialEnabled,
      mode: settings.gameMode,
      level: settings.startLevel,
    });
    this.enemySystem.setDifficultyProfile(this.getCurrentDifficultyProfile());
    this.playerSystem.setLives(settings.playerLives);
    this.setQualityPreset(settings.qualityPreset);
    this.audioManager.setSFXVolume(settings.sfxVolume);
    this.audioManager.setMusicVolume(settings.musicVolume);
    this.musicSystem.setVolume(settings.musicVolume);
    this.sessionState.setWave(0);
    this.gameState.reset();
    this.sessionState.setInBossBattle(false);
    this.sessionState.resume();

    if (settings.testScore > 0) {
      this.playerStats.addScore(settings.testScore);
      this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    }
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

  private spawnEnemyFromBoss(position: THREE.Vector3, enemyType: EnemyType = EnemyType.FIGHTER): void {
    const MAX_ENEMIES = 8;
    if (this.enemySystem.getAliveEnemyCount() >= MAX_ENEMIES) {
      return;
    }
    this.enemySystem.spawnEnemyAt(enemyType, position);
    this.hud.showPowerUpBig('⚠️', '敌机起飞！');
  }

  private syncCameraInterpolationState(): void {
    this.previousCameraTargetPosition.copy(this.playerAircraft.position);
    this.currentCameraTargetPosition.copy(this.playerAircraft.position);
    this.previousCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
    this.currentCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
    this.lastRenderTimestamp = 0;
  }

  private update(deltaTime: number): void {
    if (!this.sessionState.isPlaying()) {
      return;
    }

    this.playerSystem.capturePreviousVisualState();
    this.previousCameraTargetPosition.copy(this.currentCameraTargetPosition);
    this.previousCameraTargetQuaternion.copy(this.currentCameraTargetQuaternion);

    this.syncRuntimeQuality();

    if (this.inputHandler.isPauseToggled() || this.inputHandler.isUpgradeToggled()) {
      if (this.sessionState.isPaused()) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
      return;
    }

    if (this.sessionState.isPaused()) {
      return;
    }

    const input = this.inputHandler.getState();

    if (!this.playerSystem.isPlayerRespawning()) {
      this.playerSystem.getController().update(deltaTime, input);

      if (input.fire && this.playerSystem.canFire()) {
        this.playerSystem.fire();
      }

      this.handleMissileInput(input, deltaTime);
    }

    this.playerSystem.update(deltaTime);
    this.combatSystem.update(deltaTime);

    if (
      (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) &&
      this.bossBattleController.hasActiveBoss()
    ) {
      this.bossBattleController.update(deltaTime);
    } else {
      this.enemySystem.updateWithPlayer(deltaTime, this.playerSystem.getPosition());
    }

    this.powerUpSystem.update(deltaTime);
    this.updateTutorialCombatState();

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

    this.updateUI(deltaTime);
    this.updateMissileRespawn(deltaTime);
    this.playerSystem.captureCurrentVisualState();
    this.currentCameraTargetPosition.copy(this.playerAircraft.position);
    this.currentCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
  }

  private handleMissileInput(
    input: ReturnType<InputHandler['getState']>,
    deltaTime: number
  ): void {
    let targetMeshes: THREE.Object3D[] = this.enemySystem.getEnemyMeshes();
    const currentBoss = this.bossBattleController.getCurrentBoss();

    if (
      (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) &&
      currentBoss
    ) {
      const bossPartMeshes = currentBoss.getCollisionParts();
      targetMeshes = [...bossPartMeshes, ...targetMeshes];
      const bossMissileSystem = currentBoss.getMissileSystem();
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
        deltaTime,
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
        this.presentationController.updateMissileHud(
          0,
          { missileCount: this.missileCount, missileProgress: 0 },
          true
        );
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
      this.hud.showPowerUpBig(config.icon, config.name, 1, false, 'powerup');

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

  private updateUI(deltaTime: number): void {
    const totalEnemies = this.enemySystem.getTotalEnemyCount();
    const spawnedEnemies = this.enemySystem.getSpawnedEnemyCount();
    const aliveEnemies = this.enemySystem.getAliveEnemyCount();
    const killedEnemies = spawnedEnemies - aliveEnemies;
    const remaining = totalEnemies - killedEnemies;

    const didUpdateHud = this.presentationController.updateHud(deltaTime, {
      healthPercent: this.playerSystem.getHealth().getHealthPercent(),
      speed: this.playerSystem.getSpeed(),
      score: this.gameState.getScore(),
      aliveEnemies,
      remainingEnemies: remaining,
      lives: this.playerSystem.getLives(),
      isPlaying: this.sessionState.isPlaying(),
    });

    if (!didUpdateHud) {
      return;
    }

    this.updateEnemyHealthBars();
  }

  private updateEnemyHealthBars(): void {
    const enemies = this.enemySystem.getEnemies();
    const friendlies = this.enemySystem.getFriendlyAIs();
    const currentBoss = this.bossBattleController.getCurrentBoss();

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
      (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) &&
      currentBoss &&
      currentBoss.isAlive()
    ) {
      bossData.push({
        mesh: currentBoss.getMesh(),
        currentHealth: currentBoss.getHealth().current,
        maxHealth: currentBoss.getHealth().max,
      });
    }

    // Boss 眼睛血条数据（第三关 Boss）
    const eyeData: Array<{ mesh: THREE.Object3D; currentHealth: number; maxHealth: number }> = [];
    if (
      (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) &&
      this.hasEyeBoss(currentBoss) &&
      currentBoss.isAlive()
    ) {
      const eyeSystem = currentBoss.getEyeSystem();
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

    this.presentationController.updateEnemyHealthBars(
      [...enemyData, ...bossData, ...eyeData],
      friendlyData,
      this.gameScene.camera,
      this.playerSystem.getPosition()
    );
  }

  private hasEyeBoss(boss: unknown): boss is EyeBoss {
    if (!boss || typeof boss !== 'object') {
      return false;
    }

    const candidate = boss as Partial<EyeBoss>;
    return typeof candidate.getEyeSystem === 'function' && typeof candidate.isAlive === 'function';
  }

  private updateMissileRespawn(deltaTime: number): void {
    const missileReloadTime = this.playerStats.getMissileReloadTime();
    if (this.missileCount < GAME_CONSTANTS.MISSILE.MAX_RESPAWN_MISSILES) {
      this.missileRespawnTimer += deltaTime;
      if (this.missileRespawnTimer >= missileReloadTime) {
        this.missileCount++;
        this.missileRespawnTimer = 0;
      }
    }

    this.presentationController.updateMissileHud(deltaTime, {
      missileCount: this.missileCount,
      missileProgress: this.missileRespawnTimer / missileReloadTime,
    });
  }

  private shouldSpawnPowerUp(): boolean {
    const currentLevel =
      this.enemySystem.getCurrentLevelConfig() ||
      getLevelConfig(this.sessionState.getLevel());
    const baseChance = currentLevel?.powerUpFrequency ?? GAME_CONSTANTS.POWERUP.SPAWN_CHANCE;
    const difficultyProfile = this.getCurrentDifficultyProfile();
    const finalChance = Math.max(
      0,
      Math.min(1, baseChance * difficultyProfile.powerUpDropMultiplier)
    );

    return Math.random() < finalChance;
  }

  private spawnPowerUpForCurrentLevel(position: THREE.Vector3): void {
    const currentLevel =
      this.enemySystem.getCurrentLevelConfig() ||
      getLevelConfig(this.sessionState.getLevel());
    const allowedTypes = currentLevel?.powerUpTypes ?? Object.values(PowerUpType);
    const filteredTypes = Object.values(PowerUpType).filter((type) => allowedTypes.includes(type));
    const availableTypes = filteredTypes.length > 0 ? filteredTypes : Object.values(PowerUpType);
    const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    this.powerUpSystem.spawn(position, randomType, POWER_UP_CONFIGS[randomType].icon);
  }

  private getAdjustedBossConfig(config: BossConfig): BossConfig {
    const difficultyProfile = this.getCurrentDifficultyProfile();
    return {
      ...config,
      health: Math.max(1, Math.round(config.health * difficultyProfile.enemyHealthMultiplier)),
      damage: Math.max(1, Math.round(config.damage * difficultyProfile.enemyDamageMultiplier)),
      cannonFireInterval: config.cannonFireInterval * difficultyProfile.bossCooldownMultiplier,
      missileFireInterval: config.missileFireInterval * difficultyProfile.bossCooldownMultiplier,
      missileDamage: Math.max(
        1,
        Math.round(config.missileDamage * difficultyProfile.enemyDamageMultiplier)
      ),
    };
  }

  private getCurrentDifficultyProfile(): ReturnType<typeof getDifficultyProfile> {
    return getDifficultyProfile(this.sessionState.getDifficulty());
  }

  private render(alpha: number): void {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    this.playerSystem.applyInterpolatedVisual(clampedAlpha);
    this.enemySystem.applyInterpolatedVisuals(clampedAlpha);
    this.interpolatedCameraTargetPosition.lerpVectors(
      this.previousCameraTargetPosition,
      this.currentCameraTargetPosition,
      clampedAlpha
    );
    this.interpolatedCameraTargetQuaternion.slerpQuaternions(
      this.previousCameraTargetQuaternion,
      this.currentCameraTargetQuaternion,
      clampedAlpha
    );

    const now = performance.now();
    const renderDeltaTime = this.lastRenderTimestamp > 0
      ? Math.min((now - this.lastRenderTimestamp) / 1000, 0.05)
      : 0;
    this.lastRenderTimestamp = now;

    if (this.sessionState.isPlaying() && !this.sessionState.isPaused()) {
      this.enemySystem.updateVisuals(renderDeltaTime, this.playerSystem.getPosition());
    }

    try {
      this.thirdPersonCamera.update(
        this.interpolatedCameraTargetPosition,
        this.interpolatedCameraTargetQuaternion
      );
      this.gameScene.render();
    } finally {
      this.enemySystem.restoreCurrentVisuals();
      this.playerSystem.restoreCurrentVisual();
    }
  }

  public start(): void {
    this.sessionState.setPlaying();
    this.presentationController.resetHudThrottle();
    this.resetTutorialCombatState();
    this.playerSystem.getHealth().reset();
    this.enemySystem.setDifficultyProfile(this.getCurrentDifficultyProfile());
    this.sessionState.setInBossBattle(this.sessionState.isBossMode());
    this.applyCurrentLevelEnvironment();
    this.syncCameraInterpolationState();

    if (!this.audioInitialized) {
      this.audioManager.resume();
      this.musicSystem.resume();
      this.audioInitialized = true;
    }

    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    this.presentationController.updateMissileHud(
      0,
      { missileCount: this.missileCount, missileProgress: 0 },
      true
    );

    this.gameLoop.start(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha)
    );
    this.audioManager.startEngine();

    if (this.sessionState.isBossMode()) {
      this.startBossBattle();
    } else {
      const level = this.sessionState.getLevel();
      this.enemySystem.loadLevel(level);
      this.applyCurrentLevelEnvironment(level);
      const shouldRunTutorialIntro = this.shouldRunTutorialIntro();
      const tutorialWaveDelayMs = shouldRunTutorialIntro ? this.getTutorialWaveDelayMs() : 0;

      if (shouldRunTutorialIntro) {
        this.startTutorialIntroSequence();
        this.startTutorialCombatSequence(tutorialWaveDelayMs);
      }

      this.scheduleTimeout(() => {
        this.enemySystem.startWave(this.playerSystem.getPosition());
      }, GAME_CONSTANTS.LEVEL.START_DELAY * 1000 + tutorialWaveDelayMs);

      this.musicSystem.playLevelMusic(this.getLevelMusic(level));

      this.scheduleTimeout(() => {
        this.spawnFriendlyAI();
        this.hud.showPowerUpBig(
          '✈️',
          shouldRunTutorialIntro ? '友军编队已入场' : '召唤友军'
        );
      }, shouldRunTutorialIntro ? tutorialWaveDelayMs + GameCoordinator.TUTORIAL_FRIENDLY_SPAWN_DELAY_MS : 1000);
    }
  }

  private shouldRunTutorialIntro(): boolean {
    if (this.sessionState.isBossMode()) {
      return false;
    }

    if (!this.sessionState.isTutorialEnabled()) {
      return false;
    }

    return this.sessionState.getLevel() === 1 && this.sessionState.getWave() === 0;
  }

  private getTutorialIntroDurationMs(): number {
    const stageCount = this.getTutorialStages().length;
    return stageCount * GameCoordinator.TUTORIAL_STAGE_DURATION_MS
      + Math.max(0, stageCount - 1) * GameCoordinator.TUTORIAL_STAGE_GAP_MS;
  }

  private getTutorialWaveDelayMs(): number {
    return this.getTutorialIntroDurationMs() + GameCoordinator.TUTORIAL_WAVE_READY_BUFFER_MS;
  }

  private getTutorialStages(): Array<{ icon: string; text: string; hideSubtext?: boolean }> {
    return [
      { icon: '🎮', text: '试玩关卡已开启', hideSubtext: true },
      { icon: '🕹️', text: '先熟悉机动与转向' },
      { icon: '⚡', text: '用加速拉开距离与高度' },
      { icon: '🔥', text: '按住开火键持续压制' },
      { icon: '🚀', text: '锁定完成后再发射导弹' },
      { icon: '🎯', text: '准备接敌，完成首波进入正式节奏' },
    ];
  }

  private startTutorialIntroSequence(): void {
    const tutorialStages = this.getTutorialStages();

    tutorialStages.forEach((stage, index) => {
      const delay =
        index * (GameCoordinator.TUTORIAL_STAGE_DURATION_MS + GameCoordinator.TUTORIAL_STAGE_GAP_MS);

      this.scheduleTimeout(() => {
        this.hud.showPowerUpBig(
          stage.icon,
          stage.text,
          GameCoordinator.TUTORIAL_STAGE_DURATION_MS / 1000,
          stage.hideSubtext ?? false
        );
      }, delay);
    });
  }

  private startTutorialCombatSequence(tutorialWaveDelayMs: number): void {
    const combatStartDelayMs =
      GAME_CONSTANTS.LEVEL.START_DELAY * 1000 + tutorialWaveDelayMs;
    const waveReadyDelayMs = Math.max(0, combatStartDelayMs - 1200);

    this.scheduleTimeout(() => {
      this.hud.showPowerUpBig('📡', '敌机即将进入空域');
    }, waveReadyDelayMs);

    this.scheduleTimeout(() => {
      this.activateTutorialCombatStage();
      this.hud.showPowerUpBig('⚔️', '第一波接敌，保持移动', 1.8);
    }, combatStartDelayMs);

    this.scheduleTimeout(() => {
      this.hud.showPowerUpBig('🤝', '友军即将加入战斗', 1.8);
    }, combatStartDelayMs + GameCoordinator.TUTORIAL_FRIENDLY_SPAWN_BUFFER_MS);
  }

  private resetTutorialCombatState(): void {
    this.tutorialCombatState.active = false;
    this.tutorialCombatState.startPosition = null;
    this.tutorialCombatState.movementHintShown = false;
    this.tutorialCombatState.speedHintShown = false;
    this.tutorialCombatState.fireHintShown = false;
    this.tutorialCombatState.missileHintShown = false;
    this.tutorialCombatState.killHintShown = false;
    this.tutorialCombatState.hitHintShown = false;
  }

  private activateTutorialCombatStage(): void {
    if (!this.shouldRunTutorialIntro()) {
      return;
    }

    this.tutorialCombatState.active = true;
    this.tutorialCombatState.startPosition = this.playerSystem.getPosition().clone();
  }

  private updateTutorialCombatState(): void {
    if (!this.tutorialCombatState.active) {
      return;
    }

    const { startPosition } = this.tutorialCombatState;
    if (!startPosition) {
      return;
    }

    if (!this.tutorialCombatState.movementHintShown) {
      const movedDistance = this.playerSystem.getPosition().distanceTo(startPosition);
      if (movedDistance >= GameCoordinator.TUTORIAL_MOVE_DISTANCE) {
        this.tutorialCombatState.movementHintShown = true;
        this.hud.showPowerUpBig('🕹️', '机动确认，继续加速拉开距离', 1.8);
      }
    }

    if (
      this.tutorialCombatState.movementHintShown &&
      !this.tutorialCombatState.speedHintShown &&
      this.playerSystem.getSpeed()
        >= this.playerStats.getMaxSpeed() * GameCoordinator.TUTORIAL_SPEED_THRESHOLD_RATIO
    ) {
      this.tutorialCombatState.speedHintShown = true;
      this.hud.showPowerUpBig('⚡', '速度已拉起，按住开火持续压制', 1.8);
    }
  }

  private handleTutorialPlayerFired(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.fireHintShown) {
      return;
    }

    this.tutorialCombatState.fireHintShown = true;
    this.hud.showPowerUpBig('🔥', '火力确认，锁定后再发射导弹', 1.8);
  }

  private handleTutorialMissileFired(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.missileHintShown) {
      return;
    }

    this.tutorialCombatState.missileHintShown = true;
    this.hud.showPowerUpBig('🚀', '导弹离轨，优先清理高威胁目标', 1.8);
  }

  private handleTutorialEnemyDeath(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.killHintShown) {
      return;
    }

    this.tutorialCombatState.killHintShown = true;
    this.hud.showPowerUpBig('🎯', '确认击杀，清空首波进入正式节奏', 1.8);
    this.tutorialCombatState.active = false;
  }

  private handleTutorialPlayerHit(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.hitHintShown) {
      return;
    }

    this.tutorialCombatState.hitHintShown = true;
    this.hud.showPowerUpBig('↪️', '被命中时横滚或加速脱离火线', 1.6);
  }

  private handleWaveEventStart(eventType: LevelWaveEventType, wave: number): void {
    const waveNumber = wave + 1;
    switch (eventType) {
      case LevelWaveEventType.ELITE_HUNT:
        this.hud.showPowerUpBig('💠', `精英歼灭波次 · 第 ${waveNumber} 波`, 1.8, true);
        break;
      case LevelWaveEventType.INTERCEPT:
        this.hud.showPowerUpBig('⚠️', `限时拦截波次 · 第 ${waveNumber} 波`, 1.8, true);
        break;
    }
  }

  public setQualityPreset(preset: QualityPreset): void {
    GameConfig.clearRuntimeQualityOverride();
    GameConfig.setQualityPreset(preset);
    this.sessionState.setQualityPreset(preset);
    this.gameLoop.setQualityPreset(preset);
    this.lastAppliedQualityPreset = GameConfig.getEffectiveQualityPreset();
    this.applyQualityRuntime();
  }

  private applyQualityRuntime(): void {
    if (!this.gameScene) {
      return;
    }

    this.gameScene.applyQualitySettings();
  }

  private syncRuntimeQuality(): void {
    const currentQualityPreset = GameConfig.getEffectiveQualityPreset();
    if (currentQualityPreset === this.lastAppliedQualityPreset) {
      return;
    }

    this.lastAppliedQualityPreset = currentQualityPreset;
    this.applyQualityRuntime();
  }

  private startBossBattle(): void {
    this.sessionState.setInBossBattle(true);
    this.applyCurrentLevelEnvironment();
    const level = this.sessionState.getLevel();
    if (!this.bossBattleController.start(level, true)) {
      this.sessionState.setInBossBattle(false);
      return;
    }
  }

  private handleBossDestroy(
    position: THREE.Vector3,
    bossConfig: BossConfig,
    isBossMode: boolean
  ): void {
    this.audioManager.playExplosion();
    this.particleSystem.createExplosion(position, bossConfig.scale);
    this.gameState.addScore(bossConfig.scoreValue);
    const earnedPoints = this.playerStats.addScore(bossConfig.scoreValue);
    this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    this.notifyEarnedUpgradePoints(earnedPoints);

    this.presentationController.clearBossMissileIndicators();

    this.bossBattleController.clear();
    this.enemySystem.clearFriendlies();

    this.combatSystem.getPlayerProjectilePool().clear();
    this.combatSystem.getEnemyProjectilePool().clear();
    this.particleSystem.clear();

    this.hud.showPowerUpBig('🏆', 'Boss 已击败！');

    this.scheduleTimeout(() => {
      const nextLevel = this.sessionState.getLevel() + 1;
      this.sessionState.setLevel(nextLevel);
      this.sessionState.setInBossBattle(false);

      if (nextLevel <= 5) {
        this.hud.showPowerUpBig('⏭️', `进入第 ${nextLevel} 关`);
        this.scheduleTimeout(() => {
          this.applyCurrentLevelEnvironment(nextLevel);
          if (isBossMode) {
            this.startBossBattle();
          } else {
            this.enemySystem.loadLevel(nextLevel);
            this.applyCurrentLevelEnvironment(nextLevel);
            this.hud.updateRemainingEnemies(this.enemySystem.getTotalEnemyCount());
            this.musicSystem.playLevelMusic(this.getLevelMusic(nextLevel));
            this.enemySystem.startWave(this.playerSystem.getPosition());
          }
        }, 2000);
      } else {
        this.sessionState.setGameOver();
        this.musicSystem.stopMusic();
        this.hud.showGameOver(this.gameState.getScore());
      }
    }, 1000);
  }

  private startLevelBossBattle(): void {
    this.sessionState.setInBossBattle(true);
    this.applyCurrentLevelEnvironment();
    const level = this.sessionState.getLevel();
    if (!this.bossBattleController.start(level, false)) {
      this.sessionState.setInBossBattle(false);
      return;
    }
  }

  private applyCurrentLevelEnvironment(level: number = this.sessionState.getLevel()): void {
    const levelConfig = getLevelConfig(level);
    if (!levelConfig) {
      return;
    }

    this.gameScene.applyLevelEnvironment(levelConfig);
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
    this.sessionState.pause();
    this.upgradeMenu?.updateDisplay();
    this.upgradeMenu?.show();
    this.inputHandler.resetPauseState();
    this.inputHandler.resetUpgradeState();
  }

  private resumeGame(): void {
    this.sessionState.resume();
    this.presentationController.resetHudThrottle();
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
      this.audioManager.playPowerUp();
      const feedback = GameCoordinator.UPGRADE_FEEDBACK[type];
      this.hud.showPowerUpBig(feedback.icon, feedback.label, 1.2, true);
    }
  }

  private notifyEarnedUpgradePoints(earnedPoints: number): void {
    if (earnedPoints <= 0) {
      return;
    }

    const pointLabel = earnedPoints > 1 ? `${earnedPoints} 升级点` : '1 升级点';
    this.hud.showPowerUpBig('⭐', `获得 ${pointLabel}`, 1.1, true);
  }

  private scheduleTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    return this.resourceRegistry.scheduleTimeout(callback, delay);
  }

  public dispose(): void {
    this.stop();
    this.resourceRegistry.dispose();
    this.bossBattleController.clear();
    this.enemySystem.dispose();
    this.particleSystem.clear();
    this.powerUpSystem.dispose();
    this.presentationController.dispose();
    this.upgradeMenu?.dispose();
    this.gameScene.dispose();
    this.audioManager.dispose();
    this.musicSystem.dispose();
  }
}
