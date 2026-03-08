import * as THREE from 'three';
import { GameLoop } from '@/core/GameLoop';
import { GameScene } from '@/scenes/GameScene';
import { GameState } from '@/core/GameState';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { CombatSystem } from '@/core/systems/CombatSystem';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PowerUpSystem } from '@/core/systems/PowerUpSystem';
import { InputHandler } from '@/core/Input/InputHandler';
import { AudioManager } from '@/core/Audio/AudioManager';
import { MusicSystem, LevelMusic } from '@/core/Audio/MusicSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { PlayerStats, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { PowerUpType, POWER_UP_CONFIGS } from '@/features/powerups/PowerUpSystem';
import { HUD } from '@/ui/HUD';
import type { UpgradeMenu } from '@/ui/UpgradeMenu';
import { StartMenu, type GameSettings } from '@/ui/StartMenu';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { ThirdPersonCamera } from '@/features/camera/ThirdPersonCamera';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { GameConfig, GAME_CONSTANTS, type QualityPreset } from '@/config';
import { BOSS_CONFIGS, BossType, BossConfig } from '@/features/boss/BossTypes';
import { createPlayerMesh, createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { getDifficultyProfile } from '@/core/Difficulty';
import { getLevelConfig, LevelWaveEventType, TerrainType } from '@/features/terrain/LevelConfig';
import { GameSessionState } from '@/core/GameSessionState';
import { ResourceRegistry } from '@/core/ResourceRegistry';
import { PresentationController } from '@/core/PresentationController';
import type { BossBattleController } from '@/core/BossBattleController';
import type { SurfaceImpactType } from '@/features/effects/ParticleSystem';

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
  lockHintShown: boolean;
  lockCompleteHintShown: boolean;
  missileHintShown: boolean;
  killHintShown: boolean;
  hitHintShown: boolean;
  friendlySupportHintShown: boolean;
}

interface EscortWaveState {
  active: boolean;
  friendlyId: string | null;
  wave: number;
}

interface WaveEventState {
  type: LevelWaveEventType | null;
  wave: number;
}

interface WaveObjectiveDisplay {
  title: string;
  objective: string;
}

interface CombatRuntimeSystems {
  particleSystem: ParticleSystem;
  combatSystem: CombatSystem;
  powerUpSystem: PowerUpSystem;
}

export class GameCoordinator {
  private static readonly TUTORIAL_STAGE_DURATION_MS = 2200;
  private static readonly TUTORIAL_STAGE_GAP_MS = 350;
  private static readonly TUTORIAL_WAVE_READY_BUFFER_MS = 1000;
  private static readonly TUTORIAL_FRIENDLY_SPAWN_DELAY_MS = 5200;
  private static readonly TUTORIAL_FRIENDLY_SPAWN_BUFFER_MS = 1200;
  private static readonly TUTORIAL_MOVE_DISTANCE = 90;
  private static readonly TUTORIAL_SPEED_THRESHOLD_RATIO = 0.72;
  private static readonly ESCORT_WAVE_SCORE_BONUS = 180;
  private static readonly UPGRADE_FEEDBACK: Record<UpgradeType, { icon: string; label: string }> = {
    [UpgradeType.MAX_HEALTH]: { icon: '❤️', label: '最大生命值升级' },
    [UpgradeType.SPEED]: { icon: '⚡', label: '飞行速度升级' },
    [UpgradeType.FIRE_RATE]: { icon: '🔫', label: '射速升级' },
    [UpgradeType.DAMAGE]: { icon: '💥', label: '武器伤害升级' },
    [UpgradeType.MISSILE_RELOAD_TIME]: { icon: '🚀', label: '导弹装填升级' },
    [UpgradeType.MISSILE_LOCK_TIME]: { icon: '🎯', label: '导弹锁定升级' },
  };
  private static runtimeWarmupPromise: Promise<void> | null = null;

  private gameLoop: GameLoop;
  private gameScene: GameScene;
  private gameState: GameState;
  private resourceRegistry: ResourceRegistry;
  private sessionState: GameSessionState;
  private inputHandler: InputHandler;
  private audioManager: AudioManager;
  private musicSystem: MusicSystem;
  private particleSystem: ParticleSystem | null = null;
  private thirdPersonCamera: ThirdPersonCamera;

  private playerSystem: PlayerSystem;
  private combatSystem: CombatSystem | null = null;
  private combatRuntimePromise: Promise<CombatRuntimeSystems> | null = null;
  private enemySystem: EnemySystem | null = null;
  private enemySystemPromise: Promise<EnemySystem> | null = null;
  private powerUpSystem: PowerUpSystem | null = null;

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
  private upgradeMenuPromise: Promise<UpgradeMenu> | null = null;

  private bossIndicator: BossMissileIndicator;
  private bossBattleController: BossBattleController | null = null;
  private bossBattleControllerPromise: Promise<BossBattleController> | null = null;

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
    lockHintShown: false,
    lockCompleteHintShown: false,
    missileHintShown: false,
    killHintShown: false,
    hitHintShown: false,
    friendlySupportHintShown: false,
  };
  private readonly escortWaveState: EscortWaveState = {
    active: false,
    friendlyId: null,
    wave: -1,
  };
  private readonly waveEventState: WaveEventState = {
    type: null,
    wave: -1,
  };
  private lowHealthWarningTimer: number = 0;
  private lastRenderTimestamp: number = 0;
  private upgradeMenuHintShown: boolean = false;

  public static warmRuntimeChunks(): Promise<void> {
    if (!this.runtimeWarmupPromise) {
      this.runtimeWarmupPromise = Promise.all([
        import('@/features/effects/ParticleSystem'),
        import('@/core/systems/CombatSystem'),
        import('@/core/systems/PowerUpSystem'),
        import('@/core/systems/EnemySystem'),
        import('@/core/BossBattleController'),
        import('@/ui/UpgradeMenu'),
        import('@/features/terrain/TerrainGenerator'),
      ]).then(() => undefined);
    }

    return this.runtimeWarmupPromise;
  }

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

    this.initSystems();
    this.setupEventListeners();
    if (showStartMenu) {
      this.setupStartMenu();
    }
  }

  private initSystems(): void {
    this.playerSystem.init();
  }

  private async ensureCombatRuntimeSystems(): Promise<CombatRuntimeSystems> {
    if (this.particleSystem && this.combatSystem && this.powerUpSystem) {
      return {
        particleSystem: this.particleSystem,
        combatSystem: this.combatSystem,
        powerUpSystem: this.powerUpSystem,
      };
    }

    if (!this.combatRuntimePromise) {
      this.combatRuntimePromise = Promise.all([
        import('@/features/effects/ParticleSystem'),
        import('@/core/systems/CombatSystem'),
        import('@/core/systems/PowerUpSystem'),
      ]).then(([{ ParticleSystem }, { CombatSystem }, { PowerUpSystem }]) => {
        const particleSystem = new ParticleSystem(this.gameScene.scene);
        const combatSystem = new CombatSystem(
          this.gameScene.scene,
          particleSystem,
          this.playerAircraft
        );
        const powerUpSystem = new PowerUpSystem(this.gameScene.scene, particleSystem);

        combatSystem.init();
        powerUpSystem.init();

        this.particleSystem = particleSystem;
        this.combatSystem = combatSystem;
        this.powerUpSystem = powerUpSystem;

        return { particleSystem, combatSystem, powerUpSystem };
      });
    }

    return this.combatRuntimePromise;
  }

  private async ensureEnemySystem(): Promise<EnemySystem> {
    if (this.enemySystem) {
      return this.enemySystem;
    }

    if (!this.enemySystemPromise) {
      this.enemySystemPromise = import('@/core/systems/EnemySystem').then(({ EnemySystem }) => {
        const enemySystem = new EnemySystem(this.gameScene.scene, this.sessionState);
        enemySystem.init();
        enemySystem.setDifficultyProfile(getDifficultyProfile(this.sessionState.getDifficulty()));
        this.enemySystem = enemySystem;
        return enemySystem;
      });
    }

    return this.enemySystemPromise;
  }

  private setupEventListeners(): void {
    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_HIT, ({ payload }) => {
        this.handleTutorialPlayerHit();
        if (!this.playerSystem.isShieldActive()) {
          const hitIntensity = THREE.MathUtils.clamp(payload.damage / 18, 0.8, 2.1);
          this.audioManager.playHit(hitIntensity);
          this.particleSystem?.createHit(payload.position, hitIntensity);
          this.hud.triggerDamageFlash(hitIntensity);
        }
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_DEATH, ({ payload }) => {
        this.audioManager.stopEngine();
        this.audioManager.playExplosion('player', 2);
        this.particleSystem?.createExplosion(payload.position, 2, 'player');
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
        this.particleSystem?.createExplosion(payload.position, 1.5);
        this.playerAircraft.visible = true;
        this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
        this.presentationController.updateMissileHud(
          0,
          { missileCount: this.missileCount, missileProgress: 0 },
          true
        );
        this.audioManager.startEngine();

        this.playerSystem.activateShield(this.gameScene.scene);
        this.powerUpSystem?.addActivePowerUp(
          PowerUpType.SHIELD,
          POWER_UP_CONFIGS[PowerUpType.SHIELD]
        );
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.ENEMY_FIRED, () => {
        this.audioManager.playShoot('enemy');
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.FRIENDLY_FIRED, () => {
        this.audioManager.playShoot('friendly');
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_FIRED, () => {
        this.handleTutorialPlayerFired();
        this.audioManager.playShoot('player');
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
        this.gameState.addScore(payload.config.scoreValue);
        const earnedPoints = this.playerStats.addScore(payload.config.scoreValue);
        this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
        this.notifyEarnedUpgradePoints(earnedPoints);
        this.audioManager.playExplosion('enemy', payload.config.scale);
        this.particleSystem?.createExplosion(payload.position, payload.config.scale, 'enemy');
        this.handleTutorialEnemyDeath();

        if (this.shouldSpawnPowerUp()) {
          this.spawnPowerUpForCurrentLevel(payload.position);
        }
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.FRIENDLY_DEATH, ({ payload }) => {
        this.audioManager.playExplosion('friendly', 1.15);
        this.particleSystem?.createExplosion(payload.position, 1.15, 'friendly');
        this.hud.showPowerUpBig('⚠️', '友军坠毁', 1, true);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.MISSILE_FIRED, () => {
        this.handleTutorialMissileFired();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.MISSILE_HIT, () => {
        this.audioManager.playMissileExplosion();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_START, () => {
        this.audioManager.playWaveStart();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_COMPLETE, ({ payload }) => {
        this.handleWaveEventComplete(payload.wave);
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

        this.combatSystem?.getPlayerProjectilePool().clear();
        this.combatSystem?.getEnemyProjectilePool().clear();
        this.particleSystem?.clear();
        this.powerUpSystem?.clear();

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
        this.combatSystem?.setDamageMultiplier(config.value);
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
        this.combatSystem?.setDamageMultiplier(1);
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
    this.enemySystem?.setDifficultyProfile(this.getCurrentDifficultyProfile());
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

  private spawnFriendlyAI(): FriendlyAI {
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
    this.enemySystem?.spawnFriendly(friendly);
    this.handleTutorialFriendlySupport();
    return friendly;
  }

  private spawnEnemyFromBoss(position: THREE.Vector3, enemyType: EnemyType = EnemyType.FIGHTER): void {
    const MAX_ENEMIES = 8;
    if (!this.enemySystem) {
      return;
    }

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
    this.combatSystem?.update(deltaTime);

    if (
      (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) &&
      this.bossBattleController?.hasActiveBoss()
    ) {
      this.bossBattleController.update(deltaTime);
    } else {
      this.enemySystem?.updateWithPlayer(deltaTime, this.playerSystem.getPosition());
    }

    this.powerUpSystem?.update(deltaTime);
    this.updateTutorialCombatState();

    const enemyMeshes = this.enemySystem?.getEnemyMeshes() ?? [];
    const friendlyMeshes = this.enemySystem?.getFriendlyAIs().map((f) => f.getMesh()) ?? [];

    this.combatSystem?.updateEnemyMeshes(enemyMeshes);

    this.combatSystem?.checkProjectileCollisions(
      enemyMeshes,
      friendlyMeshes,
      (target, damage) => {
        this.createCombatHitFeedback(target, damage, 'player', 1);
        const enemy = this.enemySystem?.getEnemies().find((e) => e.getMesh() === target);
        enemy?.takeDamage(damage);
      },
      (damage) => {
        if (!this.playerSystem.isShieldActive()) {
          this.playerSystem.getHealth().takeDamage(damage);
        }
      },
      (target, damage) => {
        this.createCombatHitFeedback(target, damage, 'enemy', 0.92);
        const friendly = this.enemySystem?.getFriendlyAIs().find((f) => f.getMesh() === target);
        friendly?.takeDamage(damage);
      }
    );

    this.handleBalloonCollisions();

    this.particleSystem?.update(deltaTime);
    this.audioManager.updateEngine(this.playerSystem.getSpeed());

    const engineGlow = this.playerAircraft.getObjectByName('engineGlow');
    if (engineGlow) {
      const scale = 0.5 + (this.playerSystem.getSpeed() / 100) * 1;
      engineGlow.scale.setScalar(scale);
    }

    this.updateUI(deltaTime);
    this.updateMissileRespawn(deltaTime);
    this.updateLowHealthWarning(deltaTime);
    this.playerSystem.captureCurrentVisualState();
    this.currentCameraTargetPosition.copy(this.playerAircraft.position);
    this.currentCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
  }

  private handleMissileInput(
    input: ReturnType<InputHandler['getState']>,
    deltaTime: number
  ): void {
    let targetMeshes: THREE.Object3D[] = this.enemySystem?.getEnemyMeshes() ?? [];
    const currentBoss = this.bossBattleController?.getCurrentBoss() ?? null;

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
        this.handleTutorialMissileLockCompleted();
        const lockedTarget = this.lockOnIndicator.getCurrentTarget();
        if (lockedTarget && this.missileCount > 0 && !this.missileFiringScheduled) {
          this.missileFiringScheduled = true;
          this.audioManager.playMissileLockConfirm();

          this.scheduleTimeout(() => {
            this.fireMissile(lockedTarget);
            this.lockOnIndicator.onMissileFired();
            this.missileFiringScheduled = false;
          }, 200);
        }
      }
    } else if (input.missile) {
      this.handleTutorialMissileLockStarted();
      this.audioManager.playMissileLock();
      this.lockOnIndicator.startLockOn();
    } else {
      this.lockOnIndicator.cancelLockOn();
    }
  }

  private fireMissile(target?: THREE.Object3D): void {
    if (this.missileCount <= 0 || !this.combatSystem) return;

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

        this.combatSystem?.getMissileSystem().fire(position, forward, target);
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
    if (this.playerSystem.isPlayerRespawning() || !this.combatSystem || !this.powerUpSystem) {
      return;
    }

    const powerUpSystem = this.powerUpSystem;
    const projectiles = this.combatSystem.getPlayerProjectilePool().getActiveProjectiles();
    const projectilePositions = projectiles.map((p) => p.position);

    powerUpSystem.checkProjectileCollisions(projectilePositions, (_balloon, type) => {
      const config = POWER_UP_CONFIGS[type];
      this.audioManager.playBalloonPop();
      this.hud.showPowerUpBig(config.icon, config.name, 1, false, 'powerup');

      if (config.duration > 0) {
        this.hud.showPowerUp(config.name, config.icon, config.duration);
      }

      powerUpSystem.addActivePowerUp(type, config);
    });

    powerUpSystem.checkPlayerCollisions(this.playerSystem.getPosition(), (_type, config) => {
      this.audioManager.playPowerUp();
      this.hud.showPowerUp(config.name, config.icon, 0);
    });
  }

  private updateUI(deltaTime: number): void {
    const totalEnemies = this.enemySystem?.getTotalEnemyCount() ?? 0;
    const spawnedEnemies = this.enemySystem?.getSpawnedEnemyCount() ?? 0;
    const aliveEnemies = this.enemySystem?.getAliveEnemyCount() ?? 0;
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
    const enemies = this.enemySystem?.getEnemies() ?? [];
    const friendlies = this.enemySystem?.getFriendlyAIs() ?? [];
    const currentBoss = this.bossBattleController?.getCurrentBoss() ?? null;

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
      this.enemySystem?.getCurrentLevelConfig() ||
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
      this.enemySystem?.getCurrentLevelConfig() ||
      getLevelConfig(this.sessionState.getLevel());
    const allowedTypes = currentLevel?.powerUpTypes ?? Object.values(PowerUpType);
    const filteredTypes = Object.values(PowerUpType).filter((type) => allowedTypes.includes(type));
    const availableTypes = filteredTypes.length > 0 ? filteredTypes : Object.values(PowerUpType);
    const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    this.powerUpSystem?.spawn(position, randomType, POWER_UP_CONFIGS[randomType].icon);
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

  private updateLowHealthWarning(deltaTime: number): void {
    const healthPercent = this.playerSystem.getHealth().getHealthPercent();
    if (healthPercent > 0.25 || !this.sessionState.isPlaying() || this.sessionState.isPaused()) {
      this.lowHealthWarningTimer = 0;
      return;
    }

    this.lowHealthWarningTimer += deltaTime;
    if (this.lowHealthWarningTimer >= 1.35) {
      this.lowHealthWarningTimer = 0;
      this.audioManager.playLowHealthWarning();
    }
  }

  private render(alpha: number): void {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    this.playerSystem.applyInterpolatedVisual(clampedAlpha);
    this.enemySystem?.applyInterpolatedVisuals(clampedAlpha);
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
      this.enemySystem?.updateVisuals(renderDeltaTime, this.playerSystem.getPosition());
    }

    try {
      this.thirdPersonCamera.update(
        this.interpolatedCameraTargetPosition,
        this.interpolatedCameraTargetQuaternion
      );
      this.gameScene.render();
    } finally {
      this.enemySystem?.restoreCurrentVisuals();
      this.playerSystem.restoreCurrentVisual();
    }
  }

  public start(): void {
    this.sessionState.setPlaying();
    this.presentationController.initializeCombatUi();
    this.presentationController.resetHudThrottle();
    this.presentationController.clearEventObjective();
    this.resetTutorialCombatState();
    this.playerSystem.getHealth().reset();
    this.sessionState.setInBossBattle(this.sessionState.isBossMode());
    this.applyCurrentLevelEnvironment();
    this.syncCameraInterpolationState();

    if (!this.audioInitialized) {
      this.audioManager.resume();
      this.musicSystem.resume();
      this.audioInitialized = true;
    }

    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.lowHealthWarningTimer = 0;
    this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    this.presentationController.updateMissileHud(
      0,
      { missileCount: this.missileCount, missileProgress: 0 },
      true
    );

    void Promise.all([this.ensureCombatRuntimeSystems(), this.ensureEnemySystem()])
      .then(([runtimeSystems, enemySystem]) => {
        if (!this.sessionState.isPlaying()) {
          return;
        }

        this.applyCurrentLevelEnvironment();
        enemySystem.setDifficultyProfile(this.getCurrentDifficultyProfile());
        runtimeSystems.combatSystem.setDamageMultiplier(1);

        this.gameLoop.start(
          (dt) => this.update(dt),
          (alpha) => this.render(alpha)
        );
        this.audioManager.startEngine();

        if (this.sessionState.isBossMode()) {
          this.startBossBattle();
        } else {
          const level = this.sessionState.getLevel();
          enemySystem.loadLevel(level);
          this.applyCurrentLevelEnvironment(level);
          const shouldRunTutorialIntro = this.shouldRunTutorialIntro();
          const tutorialWaveDelayMs = shouldRunTutorialIntro ? this.getTutorialWaveDelayMs() : 0;

          if (shouldRunTutorialIntro) {
            this.startTutorialIntroSequence();
            this.startTutorialCombatSequence(tutorialWaveDelayMs);
          }

          this.scheduleTimeout(() => {
            this.enemySystem?.startWave(this.playerSystem.getPosition());
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
      })
      .catch((error) => {
        console.error('Failed to initialize enemy system', error);
      });
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
      this.hud.showPowerUpBig('🤝', '友军正在接近，准备协同压制', 1.8);
    }, combatStartDelayMs + GameCoordinator.TUTORIAL_FRIENDLY_SPAWN_BUFFER_MS);
  }

  private resetTutorialCombatState(): void {
    this.tutorialCombatState.active = false;
    this.tutorialCombatState.startPosition = null;
    this.tutorialCombatState.movementHintShown = false;
    this.tutorialCombatState.speedHintShown = false;
    this.tutorialCombatState.fireHintShown = false;
    this.tutorialCombatState.lockHintShown = false;
    this.tutorialCombatState.lockCompleteHintShown = false;
    this.tutorialCombatState.missileHintShown = false;
    this.tutorialCombatState.killHintShown = false;
    this.tutorialCombatState.hitHintShown = false;
    this.tutorialCombatState.friendlySupportHintShown = false;
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

  private handleTutorialMissileLockStarted(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.lockHintShown) {
      return;
    }

    this.tutorialCombatState.lockHintShown = true;
    this.hud.showPowerUpBig('🎯', '保持目标在准星内，等待锁定完成', 1.8);
  }

  private handleTutorialMissileFired(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.missileHintShown) {
      return;
    }

    this.tutorialCombatState.missileHintShown = true;
    this.hud.showPowerUpBig('🚀', '导弹离轨，优先清理高威胁目标', 1.8);
  }

  private handleTutorialMissileLockCompleted(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.lockCompleteHintShown) {
      return;
    }

    this.tutorialCombatState.lockCompleteHintShown = true;
    this.hud.showPowerUpBig('✅', '锁定完成，抓住窗口立刻发射', 1.6);
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

  private handleTutorialFriendlySupport(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.friendlySupportHintShown) {
      return;
    }

    this.tutorialCombatState.friendlySupportHintShown = true;
    this.hud.showPowerUpBig('🤝', '友军已入场，优先配合清理高威胁目标', 1.8);
  }

  private handleWaveEventStart(eventType: LevelWaveEventType, wave: number): void {
    this.escortWaveState.active = false;
    this.escortWaveState.friendlyId = null;
    this.escortWaveState.wave = wave;
    this.waveEventState.type = eventType;
    this.waveEventState.wave = wave;

    const waveNumber = wave + 1;
    const objectiveDisplay = this.getWaveObjectiveDisplay(eventType, waveNumber);
    this.presentationController.showEventObjective(
      objectiveDisplay.title,
      objectiveDisplay.objective
    );

    switch (eventType) {
      case LevelWaveEventType.ELITE_HUNT:
        this.hud.showPowerUpBig('💠', `精英歼灭波次 · 第 ${waveNumber} 波`, 1.8, true);
        break;
      case LevelWaveEventType.INTERCEPT:
        this.hud.showPowerUpBig('⚠️', `限时拦截波次 · 第 ${waveNumber} 波`, 1.8, true);
        break;
      case LevelWaveEventType.ESCORT_DEFENSE:
        if ((this.enemySystem?.getFriendlyAIs().length ?? 0) < 4) {
          const escortFriendly = this.spawnFriendlyAI();
          this.escortWaveState.active = true;
          this.escortWaveState.friendlyId = escortFriendly.getMesh().uuid;
        }
        this.hud.showPowerUpBig('🛡️', `护送防守波次 · 第 ${waveNumber} 波`, 1.8, true);
        break;
    }
  }

  private handleEscortWaveComplete(wave: number): void {
    if (!this.escortWaveState.active || this.escortWaveState.wave !== wave) {
      return;
    }

    const escortFriendlyAlive = (this.enemySystem?.getFriendlyAIs() ?? [])
      .some(
        (friendly) =>
          friendly.isAlive() && friendly.getMesh().uuid === this.escortWaveState.friendlyId
      );

    if (escortFriendlyAlive) {
      this.gameState.addScore(GameCoordinator.ESCORT_WAVE_SCORE_BONUS);
      const earnedPoints = this.playerStats.addScore(GameCoordinator.ESCORT_WAVE_SCORE_BONUS);
      this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
      this.notifyEarnedUpgradePoints(earnedPoints);
      this.hud.showPowerUpBig('✅', '护送完成，获得额外奖励', 1.6, true);
    } else {
      this.hud.showPowerUpBig('⚠️', '护送失利，继续保持空域压制', 1.6, true);
    }

    this.escortWaveState.active = false;
    this.escortWaveState.friendlyId = null;
    this.escortWaveState.wave = -1;
  }

  private handleWaveEventComplete(wave: number): void {
    if (this.waveEventState.wave !== wave || !this.waveEventState.type) {
      this.presentationController.clearEventObjective();
      return;
    }

    switch (this.waveEventState.type) {
      case LevelWaveEventType.ELITE_HUNT:
        this.hud.showPowerUpBig('✅', '精英歼灭完成，空域威胁已压制', 1.6, true);
        break;
      case LevelWaveEventType.INTERCEPT:
        this.hud.showPowerUpBig('✅', '拦截成功，敌方前锋已被击退', 1.6, true);
        break;
      case LevelWaveEventType.ESCORT_DEFENSE:
        this.handleEscortWaveComplete(wave);
        break;
      default:
        break;
    }

    this.waveEventState.type = null;
    this.waveEventState.wave = -1;
    this.presentationController.clearEventObjective();
  }

  private getWaveObjectiveDisplay(
    eventType: LevelWaveEventType,
    waveNumber: number
  ): WaveObjectiveDisplay {
    switch (eventType) {
      case LevelWaveEventType.ELITE_HUNT:
        return {
          title: `第 ${waveNumber} 波 · 精英歼灭`,
          objective: '优先清理重型与王牌目标，快速压制空域',
        };
      case LevelWaveEventType.INTERCEPT:
        return {
          title: `第 ${waveNumber} 波 · 限时拦截`,
          objective: '高速目标正在突防，优先击落前锋编队',
        };
      case LevelWaveEventType.ESCORT_DEFENSE:
        return {
          title: `第 ${waveNumber} 波 · 护送防守`,
          objective: '掩护友军生存至波次结束，可获得额外奖励',
        };
      default:
        return {
          title: `第 ${waveNumber} 波 · 空域压制`,
          objective: '清空当前波次目标，保持机动与火力节奏',
        };
    }
  }

  private async ensureUpgradeMenu(): Promise<UpgradeMenu> {
    if (this.upgradeMenu) {
      return this.upgradeMenu;
    }

    if (!this.upgradeMenuPromise) {
      this.upgradeMenuPromise = import('@/ui/UpgradeMenu').then(({ UpgradeMenu }) => {
        const menu = new UpgradeMenu(
          this.playerStats.getUpgrades(),
          (type: UpgradeType) => this.handleUpgrade(type),
          () => this.resumeGame()
        );
        this.upgradeMenu = menu;
        return menu;
      });
    }

    return this.upgradeMenuPromise;
  }

  private async ensureBossBattleController(): Promise<BossBattleController> {
    if (this.bossBattleController) {
      return this.bossBattleController;
    }

    if (!this.bossBattleControllerPromise) {
      this.bossBattleControllerPromise = Promise.all([
        this.ensureCombatRuntimeSystems(),
        this.ensureEnemySystem(),
      ]).then(([runtimeSystems, enemySystem]) =>
        import('@/core/BossBattleController').then(({ BossBattleController }) => {
          const controller = new BossBattleController({
            scene: this.gameScene.scene,
            camera: this.gameScene.camera,
            particleSystem: runtimeSystems.particleSystem,
            combatSystem: runtimeSystems.combatSystem,
            enemySystem,
            playerSystem: this.playerSystem,
            playerAircraft: this.playerAircraft,
            audioManager: this.audioManager,
            musicSystem: this.musicSystem,
            hud: this.hud,
            bossIndicator: this.bossIndicator,
            resolveBossConfig: (bossType: BossType) =>
              this.getAdjustedBossConfig(BOSS_CONFIGS[bossType]),
            onBossDestroyed: (position, config, isBossMode) =>
              this.handleBossDestroy(position, config, isBossMode),
            onSpawnFriendly: () => this.spawnFriendlyAI(),
            onSpawnEnemyFromBoss: (position, enemyType) =>
              this.spawnEnemyFromBoss(position, enemyType),
            scheduleTimeout: (callback, delay) => this.scheduleTimeout(callback, delay),
          });
          this.bossBattleController = controller;
          return controller;
        })
      );
    }

    return this.bossBattleControllerPromise;
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
    void this.ensureBossBattleController().then((bossBattleController) => {
      if (!bossBattleController.start(level, true)) {
        this.sessionState.setInBossBattle(false);
      }
    });
  }

  private handleBossDestroy(
    position: THREE.Vector3,
    bossConfig: BossConfig,
    isBossMode: boolean
  ): void {
    this.combatSystem?.getPlayerProjectilePool().clear();
    this.combatSystem?.getEnemyProjectilePool().clear();
    this.particleSystem?.clear();

    this.audioManager.playBossExplosion(bossConfig.scale);
    this.particleSystem?.createBossDeathExplosion(position, bossConfig.scale);
    this.gameState.addScore(bossConfig.scoreValue);
    const earnedPoints = this.playerStats.addScore(bossConfig.scoreValue);
    this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    this.notifyEarnedUpgradePoints(earnedPoints);

    this.presentationController.clearBossMissileIndicators();

    this.bossBattleController?.clear();
    this.enemySystem?.clearFriendlies();

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
            this.enemySystem?.loadLevel(nextLevel);
            this.applyCurrentLevelEnvironment(nextLevel);
            this.hud.updateRemainingEnemies(this.enemySystem?.getTotalEnemyCount() ?? 0);
            this.musicSystem.playLevelMusic(this.getLevelMusic(nextLevel));
            this.enemySystem?.startWave(this.playerSystem.getPosition());
          }
        }, 2000);
      } else {
        this.sessionState.setGameOver();
        this.musicSystem.stopMusic();
        this.hud.showGameOver(this.gameState.getScore());
      }
    }, 1000);
  }

  private createCombatHitFeedback(
    target: THREE.Object3D,
    damage: number,
    profile: 'player' | 'enemy' | 'boss' = 'player',
    intensityMultiplier: number = 1
  ): void {
    const hitPosition = new THREE.Vector3();
    target.getWorldPosition(hitPosition);
    const hitIntensity = THREE.MathUtils.clamp((damage / 16) * intensityMultiplier, 0.82, 1.9);
    this.audioManager.playHit(hitIntensity, profile);
    this.particleSystem?.createHit(hitPosition, hitIntensity, profile);
  }

  private startLevelBossBattle(): void {
    this.sessionState.setInBossBattle(true);
    this.applyCurrentLevelEnvironment();
    const level = this.sessionState.getLevel();
    void this.ensureBossBattleController().then((bossBattleController) => {
      if (!bossBattleController.start(level, false)) {
        this.sessionState.setInBossBattle(false);
      }
    });
  }

  private applyCurrentLevelEnvironment(level: number = this.sessionState.getLevel()): void {
    const levelConfig = getLevelConfig(level);
    if (!levelConfig) {
      return;
    }

    this.gameScene.applyLevelEnvironment(levelConfig);
    this.configureEnvironmentImpactFeedback(levelConfig);
  }

  private configureEnvironmentImpactFeedback(levelConfig: ReturnType<typeof getLevelConfig>): void {
    if (!this.combatSystem) {
      return;
    }

    if (!levelConfig) {
      this.combatSystem.setEnvironmentImpactHandler(null);
      return;
    }

    const impactHeight = levelConfig.terrain === TerrainType.OCEAN ? -47.8 : -48.6;
    this.combatSystem.setEnvironmentImpactHandler(impactHeight, (position, source) => {
      const isWaterImpact = this.isWaterImpact(levelConfig.terrain, position);
      if (isWaterImpact) {
        this.particleSystem?.createWaterImpact(position, source === 'boss' ? 1.2 : 0.9);
        this.audioManager.playWaterImpact(source === 'boss' ? 1.1 : 0.85);
        return;
      }

      const surfaceType = this.getSurfaceImpactType(levelConfig.terrain);
      const impactIntensity = source === 'boss' ? 1.15 : 0.85;
      this.particleSystem?.createGroundImpact(position, impactIntensity, surfaceType);
      this.audioManager.playGroundImpact(surfaceType, source === 'boss' ? 1.05 : 0.8);
    });
  }

  private getSurfaceImpactType(terrain: TerrainType): SurfaceImpactType {
    switch (terrain) {
      case TerrainType.DESERT:
        return 'desert';
      case TerrainType.MOUNTAINS:
        return 'snow';
      case TerrainType.CITY:
        return 'city';
      default:
        return 'ground';
    }
  }

  private isWaterImpact(terrain: TerrainType, position: THREE.Vector3): boolean {
    if (terrain === TerrainType.OCEAN) {
      return true;
    }

    if (terrain !== TerrainType.LAKE) {
      return false;
    }

    const lakeRadius = 210;
    return position.x * position.x + position.z * position.z <= lakeRadius * lakeRadius;
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
    this.inputHandler.resetPauseState();
    this.inputHandler.resetUpgradeState();
    void this.ensureUpgradeMenu().then((upgradeMenu) => {
      if (!this.sessionState.isPaused()) {
        return;
      }

      upgradeMenu.updateDisplay();
      upgradeMenu.show();
    });
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

    if (!this.upgradeMenuHintShown) {
      this.upgradeMenuHintShown = true;
      const isMobile = GameConfig.isMobile;
      const hint = isMobile
        ? '暂停后打开升级菜单，立即强化机体'
        : '按 U 或暂停后打开升级菜单，立即强化机体';
      this.scheduleTimeout(() => {
        this.hud.showPowerUpBig('🧩', hint, 1.8, true);
      }, 1200);
    }
  }

  private scheduleTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    return this.resourceRegistry.scheduleTimeout(callback, delay);
  }

  public dispose(): void {
    this.stop();
    this.resourceRegistry.dispose();
    this.bossBattleController?.clear();
    this.enemySystem?.dispose();
    this.particleSystem?.clear();
    this.powerUpSystem?.dispose();
    this.combatSystem?.dispose();
    this.presentationController.dispose();
    this.upgradeMenu?.dispose();
    this.upgradeMenuPromise = null;
    this.bossBattleControllerPromise = null;
    this.gameScene.dispose();
    this.audioManager.dispose();
    this.musicSystem.dispose();
  }
}
