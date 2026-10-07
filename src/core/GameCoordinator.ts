import * as THREE from 'three';
import { GameLoop } from '@/core/GameLoop';
import { GameScene } from '@/scenes/GameScene';
import { GameState } from '@/core/GameState';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { CombatSystem, ProjectileHitSource } from '@/core/systems/CombatSystem';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PowerUpSystem } from '@/core/systems/PowerUpSystem';
import { InputHandler, type InputState } from '@/core/Input/InputHandler';
import { AudioManager } from '@/core/Audio/AudioManager';
import { MusicSystem } from '@/core/Audio/MusicSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { PlayerStats, UpgradeType } from '@/features/upgrade/UpgradeSystem';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { PowerUpType, POWER_UP_CONFIGS } from '@/features/powerups/PowerUpSystem';
import type { UpgradeMenu } from '@/ui/UpgradeMenu';
import type { PauseMenu } from '@/ui/PauseMenu';
import type { HUD } from '@/ui/HUD';
import type { GameSettings } from '@/ui/StartMenu';
import type { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import type { LockOnIndicator } from '@/ui/LockOnIndicator';
import type { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { CheckpointResumeButton } from '@/ui/CheckpointResumeButton';
import { GameConfig, GAME_CONSTANTS, type QualityPreset } from '@/config';
import { BOSS_CONFIGS, BossType, BossConfig } from '@/features/boss/BossTypes';
import type { BossMinionKind } from '@/features/boss/BossContracts';
import { createPlayerMesh, createFriendlyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { getDifficultyProfile, getLevelScaling } from '@/core/Difficulty';
import { Faction } from '@/core/Faction';
import type { CombatTarget, DamageSource, SpecialWeaponId } from '@/core/CombatContracts';
import { getLevelConfig, LevelWaveEventType } from '@/features/terrain/LevelConfig';
import { WORLDSCAPE_WATER_Y } from '@/features/terrain/TerrainGenerator';
import { LevelState } from '@/features/levels/LevelManager';
import { GameSessionState } from '@/core/GameSessionState';
import {
  loadStartFlowSettings,
  saveStartFlowSettings,
  type CameraModeSetting,
} from '@/core/SessionSettings';
import { ResourceRegistry } from '@/core/ResourceRegistry';
import type { PresentationController, RadarBlip } from '@/core/PresentationController';
import type { BossBattleController } from '@/core/BossBattleController';
import type { PresentationRuntime } from '@/core/PresentationRuntimeLoader';
import type { TerrainSurfaceKind } from '@/features/terrain/environments/TerrainEnvironment';
import { PlayerViewController } from '@/core/camera/PlayerViewController';
import { UnitController } from '@/core/units/UnitController';
import { SpecialWeaponsController } from '@/core/combat/SpecialWeaponsController';
import { CombatVfxController } from '@/core/vfx/CombatVfxController';
import { CampaignFlowController } from '@/core/campaign/CampaignFlowController';
import {
  DefaultCampaignPresentation,
  type ICampaignPresentation,
} from '@/core/campaign/CampaignPresentation';
import {
  hasCampaignCheckpoint,
  loadCampaignCheckpoint,
  type CampaignCheckpointInput,
  type CampaignSaveData,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
import { getCampaignChapter, getUnlockedWeaponsThrough } from '@/features/campaign/CampaignData';
import {
  DEFAULT_ONBOARDING_BEAT_PROFILE,
  getWaveOnboardingText,
  type OnboardingWaveBeatProfile,
} from '@/ui/OnboardingManager';

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
  onRetry?: () => void;
  onExitToMenu?: () => void;
  /** 从战役检查点继续（正常模式）：开局时还原进度并回到存档的波次 / Boss 战前 */
  resume?: CampaignSaveData | null;
  /** 结算界面“从检查点继续”：由 main.ts 用存档重新开一局 */
  onContinueFromCheckpoint?: (save: CampaignSaveData) => void;
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
  status?: string;
}

interface TutorialObjectiveDisplay {
  title: string;
  objective: string;
  status: string;
}

interface WaveAnnouncementDisplay {
  icon: string;
  text: string;
  durationSeconds: number;
}

interface CombatRuntimeSystems {
  particleSystem: ParticleSystem;
  combatSystem: CombatSystem;
  powerUpSystem: PowerUpSystem;
}

export class GameCoordinator {
  private static readonly TUTORIAL_STAGE_DURATION_MS = 1800;
  private static readonly TUTORIAL_STAGE_GAP_MS = 240;
  private static readonly TUTORIAL_WAVE_READY_BUFFER_MS = 700;
  private static readonly TUTORIAL_PRE_WAVE_WARNING_LEAD_MS = 900;
  private static readonly TUTORIAL_FRIENDLY_SPAWN_DELAY_MS = 3800;
  private static readonly TUTORIAL_MOVE_DISTANCE = 90;
  private static readonly TUTORIAL_SPEED_THRESHOLD_RATIO = 0.72;
  private static readonly OBJECTIVE_COMPLETE_HOLD_MS = 1200;
  private static readonly ESCORT_WAVE_SCORE_BONUS = 180;
  private static readonly TUTORIAL_HINT_SHORT_MS = 1300;
  private static readonly TUTORIAL_HINT_MED_MS = 1500;
  private static readonly TUTORIAL_HINT_LONG_MS = 1700;
  private static readonly WAVE_EVENT_START_COOLDOWN_MS = 1000;
  private static readonly WAVE_EVENT_COMPLETE_COOLDOWN_MS = 900;
  private static readonly RESPAWN_OVERLAY_MS = 2000;
  private static readonly UPGRADE_FEEDBACK: Record<UpgradeType, { icon: string; label: string }> = {
    [UpgradeType.MAX_HEALTH]: { icon: '❤️', label: '最大生命值升级' },
    [UpgradeType.SPEED]: { icon: '⚡', label: '飞行速度升级' },
    [UpgradeType.FIRE_RATE]: { icon: '🔫', label: '射速升级' },
    [UpgradeType.DAMAGE]: { icon: '💥', label: '武器伤害升级' },
    [UpgradeType.MISSILE_LOCK_RADIUS]: { icon: '📡', label: '锁定范围升级' },
    [UpgradeType.MISSILE_RELOAD_TIME]: { icon: '🚀', label: '导弹装填升级' },
    [UpgradeType.MISSILE_LOCK_TIME]: { icon: '🎯', label: '导弹锁定升级' },
    [UpgradeType.ARMOR]: { icon: '🛡️', label: '复合装甲升级' },
    [UpgradeType.FLARES]: { icon: '🎆', label: '热焰弹挂架升级' },
    [UpgradeType.WEAPON_ROCKETS]: { icon: '🚀', label: '集束火箭升级' },
    [UpgradeType.WEAPON_LASER]: { icon: '🔆', label: '脉冲激光升级' },
    [UpgradeType.WEAPON_SWARM]: { icon: '🐝', label: '蜂群导弹升级' },
    [UpgradeType.WEAPON_RAILGUN]: { icon: '☄️', label: '电磁轨道炮升级' },
    [UpgradeType.WEAPON_EMP]: { icon: '🌀', label: '电磁脉冲升级' },
  };
  private static runtimeWarmupPromise: Promise<void> | null = null;
  /** 第 1 轮默认的 Boss 小兵映射（无人机优先使用单位系统的自杀无人机） */
  private static readonly MINION_ENEMY_TYPES: Record<Exclude<BossMinionKind, 'drone'>, EnemyType> = {
    scout: EnemyType.SCOUT,
    fighter: EnemyType.FIGHTER,
    heavy: EnemyType.HEAVY,
    ace: EnemyType.ACE,
  };
  /** 特殊武器开火的镜头震动（integration-notes 震动表） */
  private static readonly NO_ENEMIES: readonly EnemyAI[] = [];
  private static readonly WEAPON_FIRE_SHAKE: Record<SpecialWeaponId, number> = {
    rockets: 0.1,
    laser: 0,
    swarm: 0.08,
    railgun: 0.35,
    emp: 0,
  };

  private gameLoop: GameLoop;
  private gameScene: GameScene;
  private gameState: GameState;
  private resourceRegistry: ResourceRegistry;
  private sessionState: GameSessionState;
  private inputHandler: InputHandler;
  private audioManager: AudioManager;
  private musicSystem: MusicSystem;
  private particleSystem: ParticleSystem | null = null;
  private readonly view: PlayerViewController;
  private readonly presentation: ICampaignPresentation;
  private readonly units: UnitController;
  private readonly weapons: SpecialWeaponsController;
  private readonly vfx: CombatVfxController;
  private readonly campaign: CampaignFlowController;
  private readonly checkpointResumeButton = new CheckpointResumeButton();
  private readonly options: GameCoordinatorOptions;
  private readonly showStartMenu: boolean;
  private presentationRuntimePromise: Promise<void> | null = null;
  private presentationRuntimeReady: boolean = false;
  private isDisposed: boolean = false;

  private playerSystem: PlayerSystem;
  private combatSystem: CombatSystem | null = null;
  private combatRuntimePromise: Promise<CombatRuntimeSystems> | null = null;
  private enemySystem: EnemySystem | null = null;
  private enemySystemPromise: Promise<EnemySystem> | null = null;
  private powerUpSystem: PowerUpSystem | null = null;

  private hud!: HUD;
  private lockOnIndicator!: LockOnIndicator;
  private enemyHealthBars!: EnemyHealthBars;
  private presentationController!: PresentationController;

  private playerStats: PlayerStats;
  private playerAircraft: THREE.Group;

  private missileCount: number = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
  private missileRespawnTimer: number = 0;
  private missileFiringScheduled: boolean = false;
  private multiShotActive: boolean = false;
  private lastMissileLockState: string | null = null;

  private upgradeMenuPromise: Promise<UpgradeMenu> | null = null;
  private pauseMenuPromise: Promise<PauseMenu> | null = null;

  private bossIndicator!: BossMissileIndicator;
  private bossBattleController: BossBattleController | null = null;
  private bossBattleControllerPromise: Promise<BossBattleController> | null = null;

  private upgradeMenu: UpgradeMenu | null = null;
  private pauseMenu: PauseMenu | null = null;

  private lastAppliedQualityPreset: Exclude<QualityPreset, 'auto'> =
    GameConfig.getEffectiveQualityPreset();
  private readonly previousCameraTargetPosition = new THREE.Vector3();
  private readonly currentCameraTargetPosition = new THREE.Vector3();
  private readonly interpolatedCameraTargetPosition = new THREE.Vector3();
  private readonly previousCameraTargetQuaternion = new THREE.Quaternion();
  private readonly currentCameraTargetQuaternion = new THREE.Quaternion();
  private readonly interpolatedCameraTargetQuaternion = new THREE.Quaternion();
  private readonly hitMarkerNdc = new THREE.Vector3();
  private readonly radarBlips: RadarBlip[] = [];
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
  private waveCompletionObjective: WaveObjectiveDisplay | null = null;
  private lastWaveEventPromptSignature: string = '';
  private lastWaveEventCompleteSignature: string = '';
  private lastWaveEventPromptAt: number = 0;
  private lastWaveEventCompleteAt: number = 0;

  // ── 十关战役集成 ──
  /** 剧情卡片 / 结算 / 机库期间冻结模拟（渲染继续） */
  private storyHold: boolean = false;
  private combatRuntimeConfigured: boolean = false;
  private readonly enemyTargets = new WeakMap<EnemyAI, CombatTarget>();
  private readonly lockTargets: THREE.Object3D[] = [];
  private readonly enemyMeshBuffer: THREE.Object3D[] = [];
  private readonly friendlyMeshBuffer: THREE.Object3D[] = [];
  private readonly friendlyTargetBuffer: THREE.Object3D[] = [];
  private readonly radarUnitBlips: RadarBlip[] = [];
  private readonly levelStartPosition = new THREE.Vector3();
  private readonly levelStartQuaternion = new THREE.Quaternion();
  private readonly hitPosition = new THREE.Vector3();
  private lastImpactSoundAt: number = 0;
  /** 读档后的第一次 prepareLevel 保留存档里的弹药 / 热焰弹（不补满） */
  private keepRestoredAmmo: boolean = false;

  public static warmRuntimeChunks(): Promise<void> {
    if (!this.runtimeWarmupPromise) {
      this.runtimeWarmupPromise = Promise.all([
        import('@/features/effects/ParticleSystem'),
        import('@/core/systems/CombatSystem'),
        import('@/core/systems/PowerUpSystem'),
        import('@/core/systems/EnemySystem'),
        import('@/core/BossBattleController'),
        import('@/ui/UpgradeMenu'),
        import('@/ui/PauseMenu'),
        import('@/features/terrain/TerrainGenerator'),
        import('@/features/camera/CameraRig'),
        import('@/features/units/UnitSystem'),
        import('@/features/weapons/WeaponSystem'),
        import('@/features/weapons/CountermeasureSystem'),
        import('@/features/effects/ContrailSystem'),
        import('@/core/PresentationRuntimeLoader').then(({ warmPresentationRuntimeChunks }) =>
          warmPresentationRuntimeChunks()
        ),
      ]).then(() => undefined);
    }

    return this.runtimeWarmupPromise;
  }

  constructor(options: GameCoordinatorOptions = {}) {
    this.options = options;
    this.showStartMenu = options.showStartMenu ?? true;
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

    // 视角：CameraRig（第一 / 第三人称）随战斗运行时按需加载，起始视角来自设置
    this.view = new PlayerViewController(
      this.gameScene.camera,
      this.playerAircraft,
      loadStartFlowSettings().cameraMode
    );
    this.view.onModeChanged = (mode) => this.handleCameraModeChanged(mode);

    this.playerSystem = new PlayerSystem(this.gameScene.scene, this.playerAircraft, this.playerStats);
    this.playerSystem.setCrashSurfaceSampler(
      (x, z) => this.enemySystem?.getLevelManager().getCrashSurfaceY(x, z) ?? WORLDSCAPE_WATER_Y,
    );

    // 战役表现层（第 2 轮挂剧情卡片 / 无线电 / 新 HUD 面板 / 新音效的唯一入口）
    this.presentation = new DefaultCampaignPresentation({
      getHud: () => (this.presentationRuntimeReady ? this.hud : null),
      audio: this.audioManager,
      music: this.musicSystem,
    });
    this.units = this.createUnitController();
    this.weapons = this.createSpecialWeaponsController();
    this.vfx = new CombatVfxController({
      scene: this.gameScene.scene,
      setScreenEffects: (effects) => this.gameScene.setScreenEffects(effects),
      view: this.view,
      weapons: this.weapons,
      getParticleSystem: () => this.particleSystem,
      playerAircraft: this.playerAircraft,
    });
    this.campaign = this.createCampaignFlow();

    this.initSystems();
    this.setupEventListeners();
    if (this.showStartMenu) {
      void this.ensurePresentationRuntime().then(() => {
        if (!this.isDisposed) {
          this.setupStartMenu();
        }
      });
    }
  }

  private initSystems(): void {
    this.playerSystem.init();
  }

  private async ensurePresentationRuntime(): Promise<void> {
    if (this.presentationRuntimeReady) {
      return;
    }

    if (!this.presentationRuntimePromise) {
      this.presentationRuntimePromise = import('@/core/PresentationRuntimeLoader')
        .then(({ createPresentationRuntime }) => createPresentationRuntime(this.showStartMenu))
        .then((runtime: PresentationRuntime) => {
          if (this.isDisposed) {
            runtime.presentationController.dispose();
            return;
          }

          this.hud = runtime.hud;
          this.lockOnIndicator = runtime.lockOnIndicator;
          this.enemyHealthBars = runtime.enemyHealthBars;
          this.bossIndicator = runtime.bossIndicator;
          this.presentationController = runtime.presentationController;
          this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
          this.lockOnIndicator.setLockCircleScale(
            this.playerStats.getMissileLockRadiusMultiplier()
          );
          this.hud.setSettlementActions({
            onRetry: () => this.options.onRetry?.(),
            onExitToMenu: () => this.options.onExitToMenu?.(),
          });
          this.presentationRuntimeReady = true;
        });
    }

    return this.presentationRuntimePromise;
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
          if (!payload.feedback?.suppressDefaultFeedback) {
            this.audioManager.playHit(hitIntensity);
            this.particleSystem?.createHit(payload.position, hitIntensity);
          }
          this.hud.triggerDamageFlash(hitIntensity);
          // 受击：镜头震动 + 屏幕受损脉冲（震动表：min(0.6, 0.15 + 伤害/120)）
          this.view.addShake(Math.min(0.6, 0.15 + payload.damage / 120));
          this.gameScene.setScreenEffects({
            damagePulse: THREE.MathUtils.clamp(payload.damage / 40, 0.25, 1),
          });
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
        this.view.addShake(1);
        this.gameScene.setScreenEffects({ flash: 0.6, damagePulse: 1 });
        this.campaign.recordDeath();

        if (this.playerSystem.getLives() <= 0) {
          this.sessionState.setGameOver();
          this.audioManager.playGameOver();
          this.musicSystem.stopMusic();
          this.presentation.playStinger('game-over');
          this.pauseMenu?.hide();
          this.upgradeMenu?.hide();
          this.hud.hideRespawnOverlay();
          this.hud.showGameOver(this.gameState.getScore());
          this.offerCheckpointResume();
        } else {
          this.hud.showRespawnOverlay({
            lives: payload.lives,
            durationMs: GameCoordinator.RESPAWN_OVERLAY_MS,
          });
        }
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_RESPAWN, ({ payload }) => {
        this.hud.hideRespawnOverlay();
        this.particleSystem?.createExplosion(payload.position, 1.5);
        this.playerAircraft.visible = true;
        this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
        this.presentationController.updateMissileHud(
          0,
          { missileCount: this.missileCount, missileProgress: 0 },
          true
        );
        this.audioManager.startEngine();
        // 复活补给：特殊武器满弹、热焰弹充满
        this.weapons.refill();
        this.view.snapToTarget();

        this.playerSystem.activateShield(this.gameScene.scene);
        this.powerUpSystem?.addActivePowerUp(
          PowerUpType.SHIELD,
          POWER_UP_CONFIGS[PowerUpType.SHIELD]
        );
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.ENEMY_FIRED, ({ payload }) => {
        this.audioManager.playShoot('enemy');
        this.vfx.muzzleFlashNear(payload.position, payload.direction);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.FRIENDLY_FIRED, ({ payload }) => {
        this.audioManager.playShoot('friendly');
        this.vfx.muzzleFlashNear(payload.position, payload.direction);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.PLAYER_FIRED, ({ payload }) => {
        this.handleTutorialPlayerFired();
        this.audioManager.playShoot('player');
        // 机炮枪口焰：第一人称时缩小，避免闪光糊住座舱视野
        this.particleSystem?.createMuzzleFlash(
          payload.position,
          payload.direction,
          this.view.isFirstPerson() ? 0.3 : 0.55
        );
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
        this.awardScore(payload.config.scoreValue);
        this.campaign.recordKill();
        this.audioManager.playExplosion('enemy', payload.config.scale);
        this.particleSystem?.createExplosion(payload.position, payload.config.scale, 'enemy');
        this.view.addExplosionShake(payload.position, payload.config.scale);
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
        this.view.addExplosionShake(payload.position, 1.15);
        this.hud.showPowerUpBig('⚠️', '友军坠毁', 1, true);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.MISSILE_FIRED, () => {
        this.handleTutorialMissileFired();
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.MISSILE_HIT, ({ payload }) => {
        this.audioManager.playMissileExplosion();
        this.view.addExplosionShake(payload.position, 1.2);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_START, ({ payload }) => {
        this.audioManager.playWaveStart();
        this.handleWaveStartUnits(payload.level, payload.wave);
        this.campaign.handleWaveStart(payload.wave);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_COMPLETE, ({ payload }) => {
        this.handleWaveEventComplete(payload.wave);
        this.campaign.handleWaveComplete(payload.wave);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.WAVE_EVENT_START, ({ payload }) => {
        this.handleWaveEventStart(payload.eventType, payload.wave);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.LEVEL_COMPLETE, ({ payload }) => {
        if (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) {
          return;
        }
        this.campaign.handleLevelComplete(payload.level);
        this.startBossEncounter(this.sessionState.getLevel(), false);
      })
    );

    this.resourceRegistry.addUnsubscriber(
      EventBus.on(GameEventType.POWERUP_COLLECTED, ({ payload }) => {
        this.audioManager.playPowerUp();
        this.hud.showPowerUp(payload.config.name, payload.config.icon, payload.config.duration);
        this.particleSystem?.createPickupBurst(this.playerAircraft.position);

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
    if (!this.presentationRuntimeReady) {
      return;
    }

    this.presentationController.wireStartMenu((settings: GameSettings) => {
      this.applyGameSettings(settings);
      this.start();
    });
  }

  public boot(settings: GameSettings): void {
    void this.bootWhenReady(settings);
  }

  private async bootWhenReady(settings: GameSettings): Promise<void> {
    await this.ensurePresentationRuntime();
    if (this.isDisposed || !this.presentationRuntimeReady) {
      return;
    }

    this.applyGameSettings(settings);
    this.startInternal();
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
    this.view.setMode(settings.cameraMode, true);
    // 新开一局（读档续玩时由 restoreCheckpoint 还原进度）：清空升级、设定关卡上限与武器解锁
    if (!this.options.resume) {
      this.campaign.setupNewRun(this.sessionState.getLevel());
    }
    this.hud.updateScore(this.gameState.getScore());
    this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
    this.lockOnIndicator.setLockCircleScale(
      this.playerStats.getMissileLockRadiusMultiplier()
    );

    if (settings.testScore > 0 && !this.options.resume) {
      this.gameState.addScore(settings.testScore);
      this.playerStats.addScore(settings.testScore);
      this.hud.updateScore(this.gameState.getScore());
      this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    }
  }

  private spawnFriendlyAI(): FriendlyAI {
    const enemyTypes = Object.values(EnemyType);
    const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const config = ENEMY_CONFIGS[randomType];

    // 友军僚机使用盟军涂装（同机体 / 同命中半径）
    const mesh = createFriendlyMesh(config);
    const friendly = new FriendlyAI(mesh, config, this.gameScene.scene);
    friendly.getEnemy().setTerrainSampler(this.terrainHeightSampler);

    const playerPos = this.playerSystem.getPosition();
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 100
    );
    mesh.position.copy(playerPos).add(offset);
    const groundY = this.terrainHeightSampler(mesh.position.x, mesh.position.z);
    if (Number.isFinite(groundY) && mesh.position.y < groundY + 30) {
      mesh.position.y = groundY + 30;
    }

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
    this.hud.showPowerUpBig('', '敌机起飞');
  }

  private syncCameraInterpolationState(): void {
    this.previousCameraTargetPosition.copy(this.playerAircraft.position);
    this.currentCameraTargetPosition.copy(this.playerAircraft.position);
    this.previousCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
    this.currentCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
    this.lastRenderTimestamp = 0;
  }

  private update(deltaTime: number): void {
    if (this.storyHold) {
      // 剧情卡片 / 结算 / 机库：冻结模拟，吞掉暂停 / 升级 / 单次动作按键
      this.inputHandler.resetPauseState();
      this.inputHandler.resetUpgradeState();
      this.inputHandler.resetActionQueue();
      this.presentation.update(deltaTime);
      return;
    }

    if (this.inputHandler.isPauseToggled()) {
      this.handlePauseToggle();
      return;
    }

    if (this.inputHandler.isUpgradeToggled()) {
      this.handleUpgradeToggle();
      return;
    }

    if (!this.sessionState.isPlaying()) {
      return;
    }

    this.playerSystem.capturePreviousVisualState();
    this.previousCameraTargetPosition.copy(this.currentCameraTargetPosition);
    this.previousCameraTargetQuaternion.copy(this.currentCameraTargetQuaternion);

    this.syncRuntimeQuality();

    if (this.sessionState.isPaused()) {
      this.inputHandler.resetActionQueue();
      return;
    }

    const input = this.inputHandler.getState();
    const respawning = this.playerSystem.isPlayerRespawning();

    // V / 视角按钮：随时可切（坠毁等待时 CameraRig 自动保持追尾视角）
    if (this.inputHandler.consumeCameraToggle()) {
      this.view.toggleMode();
    }

    if (!respawning) {
      this.playerSystem.getController().update(deltaTime, input);

      if (input.fire && this.playerSystem.canFire()) {
        this.playerSystem.fire();
      }

      this.handleMissileInput(input, deltaTime);
    }
    this.updateFlightState(input);

    // 特殊武器：F 扳机 / Tab·X 切换 / 1-5 选择 / G 热焰弹
    this.weapons.handleInput(
      input,
      this.inputHandler.consumeWeaponCycle(),
      this.inputHandler.consumeWeaponSlot(),
      this.inputHandler.consumeFlareDeploy(),
      this.playerAircraft,
      !respawning && this.playerAircraft.visible
    );

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

    const enemyMeshes = this.collectEnemyMeshes();
    const friendlyMeshes = this.collectFriendlyMeshes();

    this.combatSystem?.updateEnemyMeshes(enemyMeshes);

    // 地面 / 海上 / 空中单位（在敌机之后更新，友军单位会向敌机开火）
    this.units.update(
      deltaTime,
      this.playerAircraft,
      this.playerAircraft.position,
      enemyMeshes,
      friendlyMeshes,
      this.enemySystem?.getLevelManager().areWaveJetsCleared() ?? false
    );

    // 友军单位也可被敌方子弹命中（findByMesh → 'enemy-fire'）
    const friendlyTargets = this.friendlyTargetBuffer;
    friendlyTargets.length = 0;
    for (const mesh of friendlyMeshes) friendlyTargets.push(mesh);
    this.units.appendFriendlyMeshes(friendlyTargets);

    this.combatSystem?.checkProjectileCollisions(
      enemyMeshes,
      friendlyTargets,
      (target, damage, source) => {
        this.createCombatHitFeedback(target, damage, source);
        const enemy = this.enemySystem?.getEnemies().find((e) => e.getMesh() === target);
        enemy?.takeDamage(damage);
      },
      (damage, source) => {
        if (!this.playerSystem.isShieldActive()) {
          this.createCombatHitFeedback(this.playerAircraft, damage, source);
          this.playerSystem.takeCombatDamage(damage, { suppressDefaultFeedback: true });
        }
      },
      (target, damage, source) => {
        this.createCombatHitFeedback(target, damage, source);
        target.getWorldPosition(this.hitPosition);
        if (this.units.applyHostileFireToUnit(target, damage, this.hitPosition)) {
          return;
        }
        const friendly = this.enemySystem?.getFriendlyAIs().find((f) => f.getMesh() === target);
        friendly?.takeDamage(damage);
      }
    );

    // 玩家机炮 / 导弹对单位的半径命中（大型舰船 / 雷达站）
    if (this.combatSystem) {
      this.units.applyPlayerBulletHits(
        this.combatSystem.getPlayerProjectilePool(),
        (position, hostile) => {
          if (hostile) this.requestPlayerHitMarker(position);
        }
      );
      this.units.applyPlayerMissileHits(
        this.combatSystem.getMissileSystem(),
        GAME_CONSTANTS.MISSILE.DAMAGE * this.combatSystem.getDamageMultiplier(),
        (position) => {
          this.audioManager.playMissileExplosion();
          this.requestPlayerHitMarker(position);
          this.view.addExplosionShake(position, 1.2);
        }
      );
    }

    this.weapons.update(deltaTime, this.playerAircraft);

    this.handleBalloonCollisions();

    this.particleSystem?.update(deltaTime);
    this.audioManager.updateEngine(this.playerSystem.getSpeed());

    this.updateUI(deltaTime);
    this.updateMissileRespawn(deltaTime);
    this.updateLowHealthWarning(deltaTime);
    this.vfx.update(
      deltaTime,
      this.playerSystem.getHealth().getHealthPercent(),
      this.enemySystem?.getEnemies() ?? GameCoordinator.NO_ENEMIES,
      enemyMeshes,
      friendlyMeshes
    );
    this.campaign.tick(deltaTime);
    this.presentation.update(deltaTime);
    this.playerSystem.captureCurrentVisualState();
    this.currentCameraTargetPosition.copy(this.playerAircraft.position);
    this.currentCameraTargetQuaternion.copy(this.playerAircraft.quaternion);
  }

  /** 存活敌机网格（复用数组） */
  private collectEnemyMeshes(): THREE.Object3D[] {
    const buffer = this.enemyMeshBuffer;
    buffer.length = 0;
    for (const enemy of this.enemySystem?.getEnemies() ?? []) {
      if (enemy.isAlive()) buffer.push(enemy.getMesh());
    }
    return buffer;
  }

  /** 存活友军僚机网格（复用数组；之后还会追加友军单位） */
  private collectFriendlyMeshes(): THREE.Object3D[] {
    const buffer = this.friendlyMeshBuffer;
    buffer.length = 0;
    for (const friendly of this.enemySystem?.getFriendlyAIs() ?? []) {
      if (friendly.isAlive()) buffer.push(friendly.getMesh());
    }
    return buffer;
  }

  /** 相机 FOV / 震动 / 加力尾焰共用的飞行状态（速度比：最低 → 最高速度） */
  private updateFlightState(input: InputState): void {
    const maxSpeed = this.playerStats.getMaxSpeed();
    const speed = this.playerSystem.getSpeed();
    const half = maxSpeed * 0.5;
    const speedRatio = half > 0 ? (speed - half) / half : 0;
    const boosting = input.throttle && !this.playerSystem.isPlayerRespawning();
    this.view.setFlightState(speedRatio, boosting);
  }

  private handleMissileInput(
    input: ReturnType<InputHandler['getState']>,
    deltaTime: number
  ): void {
    // 锁定候选：Boss 可受伤部件（隐形 / 护盾偏转体除外）→ 敌机 → 敌方单位瞄准点 → Boss 导弹
    const targetMeshes = this.lockTargets;
    targetMeshes.length = 0;
    const bossController = this.bossBattleController;
    const inBossFight =
      (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) &&
      bossController?.hasActiveBoss() === true;
    if (inBossFight && bossController) {
      bossController.appendLockTargets(targetMeshes);
    }
    for (const enemy of this.enemySystem?.getEnemies() ?? []) {
      if (enemy.isAlive()) targetMeshes.push(enemy.getMesh());
    }
    this.units.collectLockTargets(targetMeshes);

    // 幻影之翼隐形：已锁定的 Boss 部件立即丢失
    if (inBossFight && bossController?.isBossHiddenFromSensors()) {
      const locked = this.lockOnIndicator.getCurrentTarget();
      const bossMesh = bossController.getCurrentBoss()?.getMesh();
      if (locked && bossMesh && this.isDescendantOf(locked, bossMesh)) {
        this.lockOnIndicator.cancelLockOn();
      }
    }

    const enemyScreenPos = this.enemyHealthBars.getFirstEnemyScreenPos();

    if (this.missileCount <= 0) {
      if (input.missile) {
        this.lockOnIndicator.setNoMissiles(true);
        this.audioManager.playMissileDry();
        this.lastMissileLockState = this.lockOnIndicator.getLockState();
      } else {
        this.lockOnIndicator.setNoMissiles(false);
        this.lastMissileLockState = null;
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

      const lockState = this.lockOnIndicator.getLockState();
      if (lockState === 'track') {
        this.audioManager.playMissileLock();
      } else if (lockState === 'break' && this.lastMissileLockState !== 'break') {
        this.audioManager.playMissileLockBreak();
      }
      this.lastMissileLockState = lockState;

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
      this.lastMissileLockState = this.lockOnIndicator.getLockState();
    } else {
      this.lockOnIndicator.cancelLockOn();
      this.lastMissileLockState = this.lockOnIndicator.getLockState();
    }
  }

  private isDescendantOf(object: THREE.Object3D, root: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    let depth = 0;
    while (current && depth < 32) {
      if (current === root) return true;
      current = current.parent;
      depth++;
    }
    return false;
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
        this.view.addShake(0.05);

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

    powerUpSystem.checkProjectileCollisions(projectilePositions, (balloon, type) => {
      const config = POWER_UP_CONFIGS[type];
      this.audioManager.playBalloonPop();
      this.vfx.pickupBurstAt(balloon);
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
    const aliveJets = this.enemySystem?.getAliveEnemyCount() ?? 0;
    const killedEnemies = spawnedEnemies - aliveJets;
    // 存活的敌方地面 / 海上 / 空中单位同样计入“在场 / 剩余”（波次要两者都清空才完成）
    const aliveUnits = this.units.getAliveHostileCount();
    const aliveEnemies = aliveJets + aliveUnits;
    const remaining = Math.max(0, totalEnemies - killedEnemies) + aliveUnits;

    this.updateRadar();

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

    this.updatePlayerFacingObjective();
    this.updateEnemyHealthBars();
  }

  private updatePlayerFacingObjective(): void {
    if (this.waveCompletionObjective) {
      this.presentationController.showCompletedEventObjective(
        this.waveCompletionObjective.title,
        this.waveCompletionObjective.objective,
        this.waveCompletionObjective.status
      );
      return;
    }

    if (this.tutorialCombatState.active && this.shouldRunTutorialIntro()) {
      const objective = this.getTutorialObjectiveDisplay();
      this.presentationController.showEventObjective(
        objective.title,
        objective.objective,
        objective.status
      );
      return;
    }

    if (this.waveEventState.type !== null) {
      const objective = this.getWaveObjectiveProgressDisplay();
      this.presentationController.showEventObjective(
        objective.title,
        objective.objective,
        objective.status
      );
      return;
    }

    const interWaveObjective = this.getInterWaveObjectiveDisplay();
    if (interWaveObjective) {
      this.presentationController.showCompletedEventObjective(
        interWaveObjective.title,
        interWaveObjective.objective,
        interWaveObjective.status
      );
      return;
    }

    this.presentationController.clearEventObjective();
  }

  private getTutorialObjectiveDisplay(): TutorialObjectiveDisplay {
    const lockAndMissileComplete =
      this.tutorialCombatState.lockCompleteHintShown && this.tutorialCombatState.missileHintShown;
    const completedSteps = [
      this.tutorialCombatState.movementHintShown,
      this.tutorialCombatState.speedHintShown,
      this.tutorialCombatState.fireHintShown,
      lockAndMissileComplete,
      this.tutorialCombatState.killHintShown,
    ].filter(Boolean).length;

    if (!this.tutorialCombatState.movementHintShown) {
      return {
        title: '试玩引导 · 机动确认',
        objective: '完成一次转向/横移，确认机动。',
        status: `S1/5 · 已完成 ${completedSteps}/5`,
      };
    }

    if (!this.tutorialCombatState.speedHintShown) {
      return {
        title: '试玩引导 · 提升速度',
        objective: '提速建立距离，准备接敌。',
        status: `S2/5 · 已完成 ${completedSteps}/5`,
      };
    }

    if (!this.tutorialCombatState.fireHintShown) {
      return {
        title: '试玩引导 · 火力压制',
        objective: '持续开火，校准机炮节奏。',
        status: `S3/5 · 已完成 ${completedSteps}/5`,
      };
    }

    if (!this.tutorialCombatState.lockCompleteHintShown && !this.tutorialCombatState.missileHintShown) {
      return {
        title: '试玩引导 · 导弹锁定',
        objective: '目标稳定入准星，锁定圈闭合后发射。',
        status: `S4/5 · 已完成 ${completedSteps}/5 · 锁定中`,
      };
    }

    if (this.tutorialCombatState.lockCompleteHintShown && !this.tutorialCombatState.missileHintShown) {
      return {
        title: '试玩引导 · 导弹发射',
        objective: '锁定达成后立刻发射，观察命中反馈。',
        status: `S4/5 · 已完成 ${completedSteps}/5 · 等待发射`,
      };
    }

    return {
      title: '试玩引导 · 击落首个目标',
      objective: '先击落正前方高威胁，再解护航压力进入常规。',
      status: `S5/5 · 已完成 ${completedSteps}/5`,
    };
  }

  private getWaveObjectiveProgressDisplay(): WaveObjectiveDisplay {
    const waveProgress = this.enemySystem?.getLevelManager().getWaveProgressSnapshot();
    const waveNumber = this.waveEventState.wave + 1;
    const enemies = this.enemySystem?.getEnemies() ?? [];
    const aliveEnemies = enemies.filter((enemy) => enemy.isAlive());
    const spawnedEnemies = waveProgress?.spawnedInWave ?? aliveEnemies.length;
    const totalEnemies = waveProgress?.maxEnemies ?? Math.max(spawnedEnemies, aliveEnemies.length);
    const remainingEnemies = waveProgress?.remainingInWave ?? Math.max(0, totalEnemies - (spawnedEnemies - aliveEnemies.length));
    const aliveInWave = waveProgress?.aliveInWave ?? aliveEnemies.length;

    switch (this.waveEventState.type) {
      case LevelWaveEventType.ELITE_HUNT: {
        const eliteAlive = aliveEnemies.filter((enemy) => {
          const type = enemy.getConfig().type;
          return type === EnemyType.HEAVY || type === EnemyType.ACE || type === EnemyType.SNIPER;
        }).length;

        return {
          title: `第 ${waveNumber} 波 · 精英歼灭`,
          objective:
            eliteAlive > 0
              ? '优先打穿重型/王牌，压缩高威胁窗口。'
              : '高威胁主力已清空，继续清理尾场。',
          status:
            eliteAlive > 0
              ? `精英压制：${eliteAlive} 架 · 已出 ${spawnedEnemies}/${totalEnemies} · 在场 ${aliveInWave} 架`
              : `尾场清空：重点已打穿 · 剩余 ${remainingEnemies} 架`,
        };
      }
      case LevelWaveEventType.INTERCEPT:
        return {
          title: `第 ${waveNumber} 波 · 限时拦截`,
          objective: '拦截突防编队，优先高速目标。',
          status: `拦截中：已出 ${spawnedEnemies}/${totalEnemies} · 剩余 ${remainingEnemies} 架`,
        };
      case LevelWaveEventType.ESCORT_DEFENSE: {
        const escortAlive = (this.enemySystem?.getFriendlyAIs() ?? []).some(
          (friendly) =>
            friendly.isAlive() && friendly.getMesh().uuid === this.escortWaveState.friendlyId
        );

        return {
          title: `第 ${waveNumber} 波 · 护送防守`,
          objective: escortAlive
            ? '先护送友军，再点穿护航高威胁。'
            : '护送失守，清理残余并稳住空域。',
          status: `${escortAlive ? '护送优先' : '失守后清场'} · 剩余 ${remainingEnemies} 架`,
        };
      }
      default:
        return {
          title: `第 ${waveNumber} 波 · 空域压制`,
          objective: '清空本波目标，维持机动与火力。',
          status: `空域压制中：剩余 ${remainingEnemies} 架`,
        };
    }
  }

  private getInterWaveObjectiveDisplay(): WaveObjectiveDisplay | null {
    const waveProgress = this.enemySystem?.getLevelManager().getWaveProgressSnapshot();
    if (!waveProgress || waveProgress.state !== LevelState.WAVE_COMPLETE) {
      return null;
    }

    const nextWaveDelay = Math.max(0, Math.ceil(waveProgress.nextWaveDelaySeconds));
    return {
      title: `第 ${waveProgress.wave + 1} 波 · 阶段完成`,
      objective: '本波已清空，整姿态，准备下一波。',
      status:
        nextWaveDelay > 0
          ? `重整中：${nextWaveDelay}s 后接续`
          : '重整中：准备下一波',
    };
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

    // 第 6-10 关 Boss 的子目标血条（护盾塔 / 气囊 / 散热口 / 发射器……）
    this.bossBattleController?.appendSubTargetBars(eyeData);

    this.presentationController.updateEnemyHealthBars(
      [...enemyData, ...bossData, ...eyeData],
      friendlyData,
      this.gameScene.camera,
      this.playerSystem.getPosition()
    );
  }

  private updateRadar(): void {
    this.radarBlips.length = 0;
    const levelManager = this.enemySystem?.getLevelManager();
    const enemies = this.enemySystem?.getEnemies() ?? [];

    for (const enemy of enemies) {
      if (!enemy.isAlive()) {
        continue;
      }
      const spawning = levelManager?.isEnemySpawning(enemy) ?? false;
      this.radarBlips.push({
        position: enemy.getPosition(),
        kind: spawning ? 'spawning' : 'enemy',
      });
    }

    for (const portalPos of levelManager?.getActivePortalPositions() ?? []) {
      this.radarBlips.push({
        position: portalPos,
        kind: 'spawning',
      });
    }

    for (const friendly of this.enemySystem?.getFriendlyAIs() ?? []) {
      if (!friendly.isAlive()) {
        continue;
      }
      this.radarBlips.push({
        position: friendly.getMesh().position,
        kind: 'ally',
      });
    }

    // 地面 / 海上 / 空中单位（第 2 轮换成 'enemy-ground' / 'enemy-sea' / 'neutral' / 'ally-unit'）
    let unitBlipIndex = 0;
    for (const unitBlip of this.units.getRadarBlips()) {
      const kind: RadarBlip['kind'] | null =
        unitBlip.kind === 'ally' ? 'ally' : unitBlip.kind === 'neutral' ? null : 'enemy';
      if (!kind) continue;
      let blip = this.radarUnitBlips[unitBlipIndex];
      if (!blip) {
        blip = { position: unitBlip.position, kind };
        this.radarUnitBlips.push(blip);
      }
      blip.position = unitBlip.position;
      blip.kind = kind;
      this.radarBlips.push(blip);
      unitBlipIndex++;
    }

    const currentBoss = this.bossBattleController?.getCurrentBoss() ?? null;
    // 隐形中的幻影之翼不出现在雷达上
    if (currentBoss?.isAlive() && !this.bossBattleController?.isBossHiddenFromSensors()) {
      this.radarBlips.push({
        position: currentBoss.getMesh().position,
        kind: 'boss',
      });
    }

    this.presentationController.updateRadar(
      this.playerSystem.getPosition(),
      this.radarBlips,
      this.playerSystem.getQuaternion()
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
    // Boss 血量按 BossTypes 逐关调校；关卡曲线只缩短武器冷却
    const cooldownMultiplier =
      difficultyProfile.bossCooldownMultiplier *
      getLevelScaling(this.sessionState.getLevel()).bossCooldownMultiplier;
    return {
      ...config,
      health: Math.max(1, Math.round(config.health * difficultyProfile.enemyHealthMultiplier)),
      damage: Math.max(1, Math.round(config.damage * difficultyProfile.enemyDamageMultiplier)),
      cannonFireInterval: config.cannonFireInterval * cooldownMultiplier,
      missileFireInterval: config.missileFireInterval * cooldownMultiplier,
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
      // CameraRig：第一 / 第三人称 + 震动 + FOV；同时推进玩家加力尾焰
      this.view.update(
        this.interpolatedCameraTargetPosition,
        this.interpolatedCameraTargetQuaternion,
        renderDeltaTime
      );
      this.vfx.renderUpdate(renderDeltaTime);
      this.playerSystem.setShieldViewFade(1 - 0.7 * this.view.getBlend());
      this.gameScene.render();
    } finally {
      this.enemySystem?.restoreCurrentVisuals();
      this.playerSystem.restoreCurrentVisual();
    }
  }

  public start(): void {
    if (!this.presentationRuntimeReady) {
      void this.startWhenReady();
      return;
    }

    this.startInternal();
  }

  private async startWhenReady(): Promise<void> {
    await this.ensurePresentationRuntime();
    if (this.isDisposed || !this.presentationRuntimeReady) {
      return;
    }

    this.startInternal();
  }

  private startInternal(): void {
    this.sessionState.setPlaying();
    this.presentationController.initializeCombatUi();
    this.presentationController.resetHudThrottle();
    this.presentationController.clearEventObjective();
    this.resetTutorialCombatState();
    this.resetWaveEventPresentation();
    this.playerSystem.getHealth().reset();
    this.sessionState.setInBossBattle(false);
    this.applyCurrentLevelEnvironment();
    this.syncCameraInterpolationState();

    this.audioManager.resume();
    this.musicSystem.resume();

    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.lowHealthWarningTimer = 0;
    this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    this.presentationController.updateMissileHud(
      0,
      { missileCount: this.missileCount, missileProgress: 0 },
      true
    );

    void this.ensureGameplayRuntime()
      .then(({ runtimeSystems, enemySystem }) => {
        if (!this.sessionState.isPlaying() || this.isDisposed) {
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
        this.installDevHooks();

        const resume = this.options.resume;
        if (resume && !this.sessionState.isBossMode()) {
          this.restoreCheckpoint(resume);
          this.campaign.resumeFromCheckpoint(resume);
        } else {
          this.campaign.beginNewRun(this.sessionState.getLevel());
        }
      })
      .catch((error) => {
        console.error('Failed to initialize enemy system', error);
      });
  }

  /**
   * 战斗运行时：粒子 / 战斗 / 道具、敌机与关卡、相机组、单位、特殊武器、尾迹。
   * 单位 / 武器 / 尾迹分块加载失败时只记录错误，游戏照常进行。
   */
  private async ensureGameplayRuntime(): Promise<{
    runtimeSystems: CombatRuntimeSystems;
    enemySystem: EnemySystem;
  }> {
    const [runtimeSystems, enemySystem] = await Promise.all([
      this.ensureCombatRuntimeSystems(),
      this.ensureEnemySystem(),
      this.view.ensureLoaded(),
    ]);
    const optional = (label: string, task: Promise<unknown>): Promise<void> =>
      task.then(
        () => undefined,
        (error: unknown) => {
          console.error(`Failed to load ${label}`, error);
        }
      );
    await Promise.all([
      optional('unit system', this.units.ensureLoaded(runtimeSystems.particleSystem)),
      optional('special weapons', this.weapons.ensureLoaded(runtimeSystems.particleSystem)),
      optional('contrails', this.vfx.ensureLoaded(GameConfig.isMobile ? 16 : 40)),
    ]);
    this.configureCombatRuntime(enemySystem);
    return { runtimeSystems, enemySystem };
  }

  /** 一次性接线：地表采样、诱饵、波次门控、精度加成、特效密度、视角 */
  private configureCombatRuntime(enemySystem: EnemySystem): void {
    if (this.combatRuntimeConfigured) {
      return;
    }
    this.combatRuntimeConfigured = true;
    const levelManager = enemySystem.getLevelManager();
    const sampleSurface = (x: number, z: number): { y: number; water: boolean } =>
      levelManager.getSurfaceSample(x, z);
    this.units.setSurfaceSampler(sampleSurface);
    this.units.setDecoyProvider(this.weapons);
    levelManager.setWaveHoldProvider(() => this.units.getWaveHoldCount());
    levelManager.setAccuracyBonusProvider(() => this.units.getHostileRadarBonus());
    this.weapons.setSurfaceSampler(sampleSurface);
    this.weapons.setViewMode(this.view.getMode());
    this.weapons.setEffectDensity(this.vfx.computeEffectDensity());
  }

  private resetWaveEventPresentation(): void {
    this.lastWaveEventPromptSignature = '';
    this.lastWaveEventCompleteSignature = '';
    this.lastWaveEventPromptAt = 0;
    this.lastWaveEventCompleteAt = 0;
    this.waveCompletionObjective = null;
    this.waveEventState.type = null;
    this.waveEventState.wave = -1;
    this.escortWaveState.active = false;
    this.escortWaveState.friendlyId = null;
    this.escortWaveState.wave = -1;
  }

  // ===========================================================================================
  // 战役流程的具体操作（CampaignFlowController 调用）
  // ===========================================================================================

  private createCampaignFlow(): CampaignFlowController {
    return new CampaignFlowController({
      session: this.sessionState,
      stats: this.playerStats,
      presentation: this.presentation,
      scheduleTimeout: (callback, delayMs) => {
        this.scheduleTimeout(callback, delayMs);
      },
      prepareLevel: (level, startWave) => this.prepareLevel(level, startWave),
      startLevelCombat: (level, startWave, first) => this.startLevelCombat(level, startWave, first),
      startBossEncounter: (level, isBossMode) => this.startBossEncounter(level, isBossMode),
      showHangar: (level, onContinue) => this.showHangar(level, onContinue),
      syncProgression: (level) => this.syncProgression(level),
      setStoryHold: (hold) => this.setStoryHold(hold),
      showMissionComplete: (finalScore) => this.showMissionComplete(finalScore),
      captureCheckpoint: (kind, level, wave) => this.captureCheckpoint(kind, level, wave),
      getScore: () => this.gameState.getScore(),
    });
  }

  /**
   * 换关 / 读档：清场 → 加载关卡（可从第 N 波开始）→ 单位强度 → 等地形生成后把玩家放到出生点、
   * 回满血、同步武器解锁 / 等级并补给。
   */
  private prepareLevel(level: number, startWave: number): Promise<void> {
    const enemySystem = this.enemySystem;
    if (!enemySystem) {
      return Promise.resolve();
    }
    this.sessionState.setLevel(level);
    this.sessionState.setWave(startWave);
    this.sessionState.setInBossBattle(false);
    this.bossBattleController?.clear();
    this.presentationController.clearBossMissileIndicators();
    this.presentation.setBossStatus(null);

    const levelManager = enemySystem.getLevelManager();
    levelManager.despawnAllEnemies();
    enemySystem.clearFriendlies();
    enemySystem.setDifficultyProfile(this.getCurrentDifficultyProfile());
    enemySystem.loadLevel(level, startWave);
    this.applyCurrentLevelEnvironment(level);

    this.units.clear();
    this.units.setLevel(level, this.getCurrentDifficultyProfile());
    this.weapons.clearInFlight();
    this.vfx.detachAllTrails();
    this.combatSystem?.getPlayerProjectilePool().clear();
    this.combatSystem?.getEnemyProjectilePool().clear();
    this.combatSystem?.getBossProjectilePool().clear();
    this.particleSystem?.clear();
    this.powerUpSystem?.clear();
    this.resetWaveEventPresentation();
    this.presentationController.clearEventObjective();
    this.hud.updateRemainingEnemies(enemySystem.getTotalEnemyCount());

    return levelManager.whenTerrainReady().then(() => {
      if (this.isDisposed) return;
      this.units.prewarmLevel(level);
      this.placePlayerAtLevelStart();
      this.playerSystem.syncMaxHealth();
      this.playerSystem.getHealth().healToMax();
      this.hud.updateHealth(this.playerSystem.getHealth().getHealthPercent());
      this.syncProgression(level);
      if (this.keepRestoredAmmo) {
        this.keepRestoredAmmo = false;
      } else {
        this.weapons.refill();
      }
    });
  }

  /** 关卡出生点：原点上空（至少离地 45 米），机头朝 -Z；相机与插值状态同步就位 */
  private placePlayerAtLevelStart(): void {
    const groundY = this.terrainHeightSampler(0, 0);
    const y = Math.max(0, Number.isFinite(groundY) ? groundY + 45 : 0);
    this.levelStartPosition.set(0, y, 0);
    this.levelStartQuaternion.identity();
    this.playerSystem.placeAt(this.levelStartPosition, this.levelStartQuaternion);
    this.syncCameraInterpolationState();
    this.view.snapToTarget();
    // 瞬移：清掉上一关残留的拖尾，否则会从旧位置拉出一条长线
    this.vfx.clearTrails();
  }

  /** 地形高度采样（敌机 / 僚机避让、出生点）；地形未加载时回落到水面 */
  private readonly terrainHeightSampler = (x: number, z: number): number =>
    this.enemySystem?.getLevelManager().getCrashSurfaceY(x, z) ?? WORLDSCAPE_WATER_Y;

  /** 进入波次战斗：简报、教学、首波计时、僚机、关卡音乐 */
  private startLevelCombat(level: number, startWave: number, firstLevelOfSession: boolean): void {
    if (this.isDisposed || !this.sessionState.isPlaying()) {
      return;
    }
    this.sessionState.setLevel(level);
    this.sessionState.setWave(startWave);
    this.presentLevelBriefing(level);
    const shouldRunTutorialIntro = firstLevelOfSession && this.shouldRunTutorialIntro();
    const tutorialWaveDelayMs = shouldRunTutorialIntro ? this.getTutorialWaveDelayMs() : 0;

    if (shouldRunTutorialIntro) {
      this.startTutorialIntroSequence();
      this.startTutorialCombatSequence(tutorialWaveDelayMs);
    }

    this.scheduleTimeout(() => {
      if (this.sessionState.getLevel() !== level || this.sessionState.isInBossBattle()) {
        return;
      }
      this.enemySystem?.startWave(this.playerSystem.getPosition());
    }, GAME_CONSTANTS.LEVEL.START_DELAY * 1000 + tutorialWaveDelayMs);

    this.presentation.playLevelMusic(level);

    this.scheduleTimeout(
      () => {
        if (this.sessionState.getLevel() !== level || !this.sessionState.isPlaying()) {
          return;
        }
        this.spawnFriendlyAI();
        this.hud.showPowerUpBig('✈️', shouldRunTutorialIntro ? '友军编队已入场' : '召唤友军');
      },
      shouldRunTutorialIntro
        ? tutorialWaveDelayMs + GameCoordinator.TUTORIAL_FRIENDLY_SPAWN_DELAY_MS
        : 1000
    );
  }

  /** 波次开始：本波地面 / 海上 / 空中单位入场（只在正常模式的波次中） */
  private handleWaveStartUnits(level: number, wave: number): void {
    if (this.sessionState.isBossMode() || this.sessionState.isInBossBattle()) {
      return;
    }
    this.units.spawnForWave(level, wave, this.playerAircraft.position);
  }

  /** Boss 简报 → Boss 战（回满血、清弹、清场单位） */
  private startBossEncounter(level: number, isBossMode: boolean): void {
    this.playerSystem.syncMaxHealth();
    this.playerSystem.getHealth().healToMax();
    this.hud.updateHealth(this.playerSystem.getHealth().getHealthPercent());

    this.combatSystem?.getPlayerProjectilePool().clear();
    this.combatSystem?.getEnemyProjectilePool().clear();
    this.particleSystem?.clear();
    this.powerUpSystem?.clear();
    this.units.clear();

    this.musicSystem.stopMusic();
    this.sessionState.setInBossBattle(true);

    this.presentBossBriefing(level, () => {
      this.startBossBattleAt(level, isBossMode);
    });
  }

  private startBossBattleAt(level: number, isBossMode: boolean): void {
    if (this.isDisposed || !this.sessionState.isPlaying()) {
      return;
    }
    this.sessionState.setLevel(level);
    this.sessionState.setInBossBattle(true);
    this.applyCurrentLevelEnvironment(level);
    void this.ensureBossBattleController().then((bossBattleController) => {
      if (!bossBattleController.start(level, isBossMode)) {
        this.sessionState.setInBossBattle(false);
      }
    });
  }

  /** 章节之间的机库整备（UpgradeMenu 'hangar'）：冻结模拟，“出击”后继续 */
  private showHangar(level: number, onContinue: () => void): void {
    this.setStoryHold(true);
    void this.ensureUpgradeMenu().then((upgradeMenu) => {
      if (this.isDisposed) {
        return;
      }
      const chapter = getCampaignChapter(level);
      upgradeMenu.updateDisplay();
      upgradeMenu.show({
        mode: 'hangar',
        subtitle: `下一站：${chapter.chapterLabel} · ${chapter.title}`,
        onContinue: () => {
          this.setStoryHold(false);
          this.syncProgression(level);
          this.presentationController.resetHudThrottle();
          onContinue();
        },
      });
    });
  }

  /**
   * 进度同步：升级关卡上限 / 武器解锁 → 武器系统等级与弹药、热焰弹容量、锁定参数、生命上限。
   * 关卡开始、机库购买后、读档时调用。
   */
  private syncProgression(level: number): void {
    const upgrades = this.playerStats.getUpgrades();
    if (upgrades.getCampaignLevel() !== level) {
      upgrades.setCampaignLevel(level);
    }
    const unlocked = upgrades.getUnlockedWeapons();
    const newlyUnlocked = this.weapons.syncProgression(this.playerStats, unlocked);
    if (newlyUnlocked.length > 0 && this.weapons.isReady()) {
      this.presentation.onWeaponEvent('unlock', newlyUnlocked[newlyUnlocked.length - 1]);
    }
    this.weapons.pushHud();
    this.playerSystem.syncMaxHealth();
    this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
    this.lockOnIndicator.setLockCircleScale(this.playerStats.getMissileLockRadiusMultiplier());
    this.hud.updateUpgradePoints(upgrades.getAvailablePoints());
  }

  /** 剧情冻结：模拟暂停（渲染继续），引擎声随之停 / 启 */
  private setStoryHold(hold: boolean): void {
    if (this.storyHold === hold) {
      return;
    }
    this.storyHold = hold;
    this.inputHandler.resetActionQueue();
    if (hold) {
      this.audioManager.stopEngine();
      this.lockOnIndicator.cancelLockOn();
    } else {
      this.presentationController.resetHudThrottle();
      if (this.sessionState.isPlaying() && this.playerSystem.getLives() > 0) {
        this.audioManager.startEngine();
      }
    }
  }

  private showMissionComplete(finalScore: number): void {
    this.sessionState.setGameOver();
    this.audioManager.stopEngine();
    this.musicSystem.stopMusic();
    this.pauseMenu?.hide();
    this.upgradeMenu?.hide();
    this.hud.showMissionComplete(finalScore);
  }

  /** 检查点所需的运行时快照（统计由流程控制器补上） */
  private captureCheckpoint(kind: CheckpointKind, level: number, wave: number): CampaignCheckpointInput {
    return {
      checkpoint: kind,
      level,
      wave,
      difficulty: this.sessionState.getDifficulty(),
      score: this.gameState.getScore(),
      lives: Math.max(1, this.playerSystem.getLives()),
      missiles: this.missileCount,
      upgrades: this.playerStats.getUpgrades().export(),
      weapons: this.weapons.exportState(),
      flares: this.weapons.getFlareCharges(),
      cameraMode: this.view.getMode(),
      stats: this.campaign.getRunStats(),
    };
  }

  /**
   * 读档还原（progression notes 第 4 步）：reset → import(upgrades) → 关卡上限 → 武器解锁 →
   * 武器等级 → importState → 热焰弹 → 分数 / 生命 / 导弹 / 视角。
   */
  private restoreCheckpoint(save: CampaignSaveData): void {
    const upgrades = this.playerStats.getUpgrades();
    upgrades.reset();
    upgrades.import(save.upgrades);
    upgrades.setCampaignLevel(save.level);
    upgrades.setUnlockedWeapons(getUnlockedWeaponsThrough(save.level));
    this.weapons.syncProgression(this.playerStats, upgrades.getUnlockedWeapons());
    this.weapons.importState(save.weapons, save.flares);
    this.keepRestoredAmmo = true;

    this.gameState.reset();
    this.gameState.addScore(save.score);
    this.hud.updateScore(this.gameState.getScore());
    this.playerSystem.setLives(save.lives);
    this.hud.updateLives(save.lives);
    this.missileCount = Math.max(0, Math.min(GAME_CONSTANTS.MISSILE.MAX_MISSILES, save.missiles));
    this.presentationController.updateMissileHud(
      0,
      { missileCount: this.missileCount, missileProgress: 0 },
      true
    );
    this.view.setMode(save.cameraMode, true);
    this.playerSystem.syncMaxHealth();
    this.playerSystem.getHealth().healToMax();
    this.hud.updateUpgradePoints(upgrades.getAvailablePoints());
    this.sessionState.setLevel(save.level);
  }

  /** 结算界面：正常模式且存在检查点时提供“从检查点继续” */
  private offerCheckpointResume(): void {
    const onContinue = this.options.onContinueFromCheckpoint;
    if (!onContinue || this.sessionState.isBossMode() || !hasCampaignCheckpoint()) {
      return;
    }
    const save = loadCampaignCheckpoint();
    if (!save) {
      return;
    }
    this.checkpointResumeButton.show(save, (resumeSave) => onContinue(resumeSave));
  }

  // ===========================================================================================
  // 特殊武器 / 单位 / 视觉反馈
  // ===========================================================================================

  private createSpecialWeaponsController(): SpecialWeaponsController {
    return new SpecialWeaponsController({
      scene: this.gameScene.scene,
      presentation: this.presentation,
      collectTargets: (out) => this.collectWeaponTargets(out),
      onEmpPulse: (center, radius, seconds) => this.handleEmpPulse(center, radius, seconds),
      onFired: (id, position, direction) => {
        this.particleSystem?.createMuzzleFlash(position, direction, id === 'railgun' ? 1.6 : 1);
        this.view.addShake(GameCoordinator.WEAPON_FIRE_SHAKE[id]);
        if (id === 'railgun') {
          this.gameScene.setScreenEffects({ flash: 0.25 });
        }
      },
      onImpact: (_id, position, scale) => {
        this.view.addExplosionShake(position, scale);
        // 齐射一次可能有 12 个落点：命中音效限流到每 120ms 一次
        const now = performance.now();
        if (now - this.lastImpactSoundAt > 120) {
          this.lastImpactSoundAt = now;
          this.audioManager.playMissileExplosion('player');
        }
      },
      notify: (icon, text) => this.hud.showPowerUpBig(icon, text, 0.9, true),
    });
  }

  /** 特殊武器目标：敌机（包装缓存）、全部单位、Boss 部件与可拦截导弹 */
  private collectWeaponTargets(out: CombatTarget[]): void {
    for (const enemy of this.enemySystem?.getEnemies() ?? []) {
      if (enemy.isAlive()) out.push(this.getEnemyTarget(enemy));
    }
    this.units.appendCombatTargets(out);
    this.bossBattleController?.appendCombatTargets(out);
  }

  private getEnemyTarget(enemy: EnemyAI): CombatTarget {
    const cached = this.enemyTargets.get(enemy);
    if (cached) return cached;
    const mesh = enemy.getMesh();
    const target: CombatTarget = {
      id: mesh.uuid,
      mesh,
      faction: Faction.ENEMY,
      kind: 'air',
      hitRadius: 5,
      isAlive: () => enemy.isAlive() && mesh.visible,
      applyDamage: (amount: number, _source: DamageSource, hitPoint?: THREE.Vector3) => {
        if (!enemy.isAlive()) return;
        enemy.takeDamage(amount);
        this.requestPlayerHitMarker(hitPoint ?? mesh.position);
      },
      applyStun: (seconds: number) => enemy.applyStun(seconds),
    };
    this.enemyTargets.set(enemy, target);
    return target;
  }

  /** EMP：单位瘫痪 + 单位导弹销毁、Boss 导弹与幻影之翼、屏幕电磁闪与震动 */
  private handleEmpPulse(center: THREE.Vector3, radius: number, seconds: number): void {
    this.units.applyEmp(center, radius, seconds);
    this.bossBattleController?.applyEmp(center, radius, seconds);
    this.gameScene.setScreenEffects({ empFlash: 1 });
    this.view.addShake(0.25);
  }

  /** 第 6-10 关 Boss 小兵：无人机 → 单位系统自杀无人机（未就绪时退回侦察机），其余映射到敌机 */
  private spawnBossMinion(position: THREE.Vector3, kind: BossMinionKind): void {
    if (kind === 'drone') {
      if (this.units.spawnBossDrone(position)) {
        return;
      }
      this.spawnEnemyFromBoss(position, EnemyType.SCOUT);
      return;
    }
    this.spawnEnemyFromBoss(position, GameCoordinator.MINION_ENEMY_TYPES[kind] ?? EnemyType.FIGHTER);
  }

  private createUnitController(): UnitController {
    return new UnitController({
      scene: this.gameScene.scene,
      presentation: this.presentation,
      awardKill: (scoreValue) => {
        this.awardScore(scoreValue);
        this.campaign.recordKill();
      },
      applyPenalty: (points, unitName, civilian) => this.applyScorePenalty(points, unitName, civilian),
      onAssetLost: (civilian) => this.campaign.recordAssetLost(civilian),
      damagePlayer: (damage, position) => {
        if (this.playerSystem.isPlayerRespawning() || !this.playerAircraft.visible) return;
        if (this.playerSystem.isShieldActive()) {
          this.playerSystem.notifyShieldHit(position);
          return;
        }
        this.playerSystem.takeCombatDamage(damage);
      },
      onExplosion: (position, scale, kind) => {
        this.view.addExplosionShake(position, scale);
        this.audioManager.playExplosion('enemy', kind === 'missile' ? scale * 0.8 : scale);
      },
      onEscortResult: (success) => {
        if (!success) {
          this.hud.showPowerUpBig('⚠️', '护送目标被摧毁', 1.2, true);
          return;
        }
        this.awardScore(GameCoordinator.ESCORT_WAVE_SCORE_BONUS);
        this.hud.showPowerUpBig('✅', '护送目标安全抵达', 1.2, true);
      },
    });
  }

  /** 加分（乘关卡得分倍率）→ 升级点 → HUD */
  private awardScore(baseValue: number): void {
    const multiplier = getLevelScaling(this.sessionState.getLevel()).scoreMultiplier;
    const points = Math.round(baseValue * multiplier);
    if (!(points > 0)) return;
    this.gameState.addScore(points);
    const earnedPoints = this.playerStats.addScore(points);
    this.hud.updateUpgradePoints(this.playerStats.getUpgrades().getAvailablePoints());
    this.notifyEarnedUpgradePoints(earnedPoints);
  }

  /** 误伤平民 / 友军单位：扣分（总分不低于 0）并警告 */
  private applyScorePenalty(points: number, _unitName: string, civilian: boolean): void {
    const deducted = Math.min(Math.max(0, points), this.gameState.getScore());
    if (deducted > 0) {
      this.gameState.addScore(-deducted);
      this.playerStats.addScore(-deducted);
    }
    this.presentation.flashWarning(
      `误伤${civilian ? '平民' : '友军'} · 扣除 ${Math.round(points)} 分`,
      'threat'
    );
  }

  /** 视角切换：武器特效视角、HUD（第 2 轮）、持久化到设置 */
  private handleCameraModeChanged(mode: CameraModeSetting): void {
    this.weapons.setViewMode(mode);
    this.presentation.setCameraMode(mode);
    saveStartFlowSettings({ cameraMode: mode });
  }

  /** 开发构建专用的调试钩子（import.meta.env.DEV 为 false 时整段被裁剪） */
  private installDevHooks(): void {
    if (import.meta.env.DEV) {
      void import('@/core/dev/DevHooks').then(({ installDevHooks }) => {
        if (this.isDisposed) return;
        installDevHooks({
        gameLoop: this.gameLoop,
        getSession: () => this.sessionState,
        getEnemySystem: () => this.enemySystem,
        getBossController: () => this.bossBattleController,
        getUnits: () => this.units,
        getWeapons: () => this.weapons,
        getView: () => this.view,
        getPlayerSystem: () => this.playerSystem,
        getPlayerAircraft: () => this.playerAircraft,
        getScore: () => this.gameState.getScore(),
        getStats: () => this.playerStats,
        isStoryHold: () => this.storyHold,
        getUpgradeMenuVisible: () => this.upgradeMenu?.isVisible() ?? false,
        clickHangarContinue: () => {
          const button = document.querySelector<HTMLButtonElement>('#upgrade-menu button.hangar');
          button?.click();
        },
        });
      });
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
      { icon: '🎮', text: '试玩关开启', hideSubtext: true },
      { icon: '🕹️', text: '确认转向与横移' },
      { icon: '⚡', text: '提速再接敌' },
      { icon: '🔥', text: '机炮压制，导弹点杀' },
      { icon: '🚀', text: '锁定后再发射导弹' },
      { icon: '🎯', text: '击杀首个目标后转常规' },
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
          GameCoordinator.TUTORIAL_HINT_MED_MS / 1000,
          stage.hideSubtext ?? false
        );
      }, delay);
    });
  }

  private startTutorialCombatSequence(tutorialWaveDelayMs: number): void {
    const onboardingBeat = this.getCurrentWaveOnboardingBeat();
    const combatStartDelayMs =
      GAME_CONSTANTS.LEVEL.START_DELAY * 1000 + tutorialWaveDelayMs;
    const waveReadyLeadMs = onboardingBeat.firstWaveLeadInMs > 0
      ? onboardingBeat.firstWaveLeadInMs
      : GameCoordinator.TUTORIAL_PRE_WAVE_WARNING_LEAD_MS;
    const waveReadyDelayMs = Math.max(0, combatStartDelayMs - waveReadyLeadMs);
    const firstWaveAnnouncement = this.getWaveAnnouncementDisplay(null, 1, false, onboardingBeat);

    this.scheduleTimeout(() => {
      this.hud.showPowerUpBig('📡', '前方有敌，准备接敌', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
    }, waveReadyDelayMs);

    this.scheduleTimeout(() => {
      this.activateTutorialCombatStage();
      this.hud.showPowerUpBig(
        firstWaveAnnouncement.icon,
        firstWaveAnnouncement.text,
        firstWaveAnnouncement.durationSeconds
      );
    }, combatStartDelayMs);
  }

  private getCurrentWaveOnboardingBeat(): OnboardingWaveBeatProfile {
    const levelManager = this.enemySystem?.getLevelManager();
    if (!levelManager) {
      return { ...DEFAULT_ONBOARDING_BEAT_PROFILE };
    }

    return levelManager.getCurrentWaveOnboardingBeat();
  }

  private getWaveAnnouncementDisplay(
    eventType: LevelWaveEventType | null,
    waveNumber: number,
    isComplete: boolean,
    onboardingBeat: OnboardingWaveBeatProfile = this.getCurrentWaveOnboardingBeat()
  ): WaveAnnouncementDisplay {
    const textProfile = getWaveOnboardingText(eventType, isComplete);
    const fallbackDurationMs = eventType === null
      ? onboardingBeat.firstWaveHintDurationMs
      : isComplete
        ? onboardingBeat.eventCompletionHoldMs
        : onboardingBeat.eventPromptHoldMs;
    const durationMs = Math.max(
      200,
      fallbackDurationMs > 0 ? fallbackDurationMs : textProfile.durationMs
    );

    if (eventType === null) {
      return {
        icon: textProfile.icon,
        text: textProfile.text,
        durationSeconds: durationMs / 1000,
      };
    }

    return {
      icon: textProfile.icon,
      text: isComplete ? textProfile.title : `${textProfile.title} · 第${waveNumber}波`,
      durationSeconds: durationMs / 1000,
    };
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
    this.updatePlayerFacingObjective();
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
        this.hud.showPowerUpBig('🕹️', '机动确认，继续提速拉距', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
        this.updatePlayerFacingObjective();
      }
    }

    if (
      this.tutorialCombatState.movementHintShown &&
      !this.tutorialCombatState.speedHintShown &&
      this.playerSystem.getSpeed()
        >= this.playerStats.getMaxSpeed() * GameCoordinator.TUTORIAL_SPEED_THRESHOLD_RATIO
    ) {
      this.tutorialCombatState.speedHintShown = true;
      this.hud.showPowerUpBig('⚡', '速度到位，按住开火压制', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
      this.updatePlayerFacingObjective();
    }
  }

  private handleTutorialPlayerFired(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.fireHintShown) {
      return;
    }

    this.tutorialCombatState.fireHintShown = true;
    this.hud.showPowerUpBig('🔥', '火力确认，准备导弹锁定', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
    this.updatePlayerFacingObjective();
  }

  private handleTutorialMissileLockStarted(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.lockHintShown) {
      return;
    }

    this.tutorialCombatState.lockHintShown = true;
    this.hud.showPowerUpBig('🎯', '稳住准星，等待锁定圈闭合', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
    this.updatePlayerFacingObjective();
  }

  private handleTutorialMissileFired(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.missileHintShown) {
      return;
    }

    this.tutorialCombatState.missileHintShown = true;
    this.hud.showPowerUpBig('🚀', '导弹已发射，优先点杀高威胁', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
    this.updatePlayerFacingObjective();
  }

  private handleTutorialMissileLockCompleted(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.lockCompleteHintShown) {
      return;
    }

    this.tutorialCombatState.lockCompleteHintShown = true;
    this.hud.showPowerUpBig('✅', '锁定完成，立刻发射', GameCoordinator.TUTORIAL_HINT_SHORT_MS / 1000);
    this.updatePlayerFacingObjective();
  }

  private handleTutorialEnemyDeath(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.killHintShown) {
      return;
    }

    this.tutorialCombatState.killHintShown = true;
    this.hud.showPowerUpBig('🎯', '首杀确认，继续清空本波后正式', GameCoordinator.TUTORIAL_HINT_LONG_MS / 1000);
    this.tutorialCombatState.active = false;
    this.showTransientObjective(
      {
        title: '试玩引导 · 完成',
        objective: '首轮引导完成，进入常规波次。',
        status: '教学完成 · 常规战斗已解锁',
      },
      GameCoordinator.TUTORIAL_HINT_LONG_MS + 1000
    );
  }

  private handleTutorialPlayerHit(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.hitHintShown) {
      return;
    }

    this.tutorialCombatState.hitHintShown = true;
    this.hud.showPowerUpBig('↪️', '被命中后立刻横移或加速脱离', GameCoordinator.TUTORIAL_HINT_SHORT_MS / 1000);
    this.updatePlayerFacingObjective();
  }

  private handleTutorialFriendlySupport(): void {
    if (!this.tutorialCombatState.active || this.tutorialCombatState.friendlySupportHintShown) {
      return;
    }

    this.tutorialCombatState.friendlySupportHintShown = true;
    this.hud.showPowerUpBig('🤝', '友军到位，先护航再压制', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000);
    this.updatePlayerFacingObjective();
  }

  private handleWaveEventStart(eventType: LevelWaveEventType, wave: number): void {
    this.waveCompletionObjective = null;
    this.escortWaveState.active = false;
    this.escortWaveState.friendlyId = null;
    this.escortWaveState.wave = wave;
    this.waveEventState.type = eventType;
    this.waveEventState.wave = wave;

    const waveNumber = wave + 1;
    const onboardingBeat = this.getCurrentWaveOnboardingBeat();
    const promptAnnouncement = this.getWaveAnnouncementDisplay(
      eventType,
      waveNumber,
      false,
      onboardingBeat
    );
    const now = Date.now();
    const promptSignature = `${wave}|${eventType}`;
    const shouldShowPrompt =
      promptSignature !== this.lastWaveEventPromptSignature
      || now - this.lastWaveEventPromptAt >= GameCoordinator.WAVE_EVENT_START_COOLDOWN_MS;
    const objectiveDisplay = this.getWaveObjectiveDisplay(eventType, waveNumber);
    this.presentationController.showEventObjective(
      objectiveDisplay.title,
      objectiveDisplay.objective,
      objectiveDisplay.status
    );

    if (!shouldShowPrompt) {
      return;
    }

    this.lastWaveEventPromptSignature = promptSignature;
    this.lastWaveEventPromptAt = now;

    if (
      eventType === LevelWaveEventType.ESCORT_DEFENSE &&
      (this.enemySystem?.getFriendlyAIs().length ?? 0) < 4
    ) {
      const escortFriendly = this.spawnFriendlyAI();
      this.escortWaveState.active = true;
      this.escortWaveState.friendlyId = escortFriendly.getMesh().uuid;
    }

    this.scheduleTimeout(() => {
      if (this.waveEventState.type !== eventType || this.waveEventState.wave !== wave) {
        return;
      }

      if (this.lastWaveEventPromptSignature !== promptSignature) {
        return;
      }

      this.hud.showPowerUpBig(
        promptAnnouncement.icon,
        promptAnnouncement.text,
        promptAnnouncement.durationSeconds,
        true
      );
    }, Math.max(0, onboardingBeat.eventPromptDelayMs));
  }

  private handleEscortWaveComplete(wave: number): boolean {
    if (!this.escortWaveState.active || this.escortWaveState.wave !== wave) {
      return false;
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
      this.hud.showPowerUpBig('✅', '护送完成，奖励到位', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000, true);
    } else {
      this.hud.showPowerUpBig('⚠️', '护送失利，继续压制', GameCoordinator.TUTORIAL_HINT_MED_MS / 1000, true);
    }

    this.escortWaveState.active = false;
    this.escortWaveState.friendlyId = null;
    this.escortWaveState.wave = -1;
    return escortFriendlyAlive;
  }

  private handleWaveEventComplete(wave: number): void {
    if (this.waveEventState.wave !== wave || !this.waveEventState.type) {
      this.updatePlayerFacingObjective();
      return;
    }

    const completedEventType = this.waveEventState.type;
    const onboardingBeat = this.getCurrentWaveOnboardingBeat();
    const now = Date.now();
    let completionObjective: WaveObjectiveDisplay | null = null;
    switch (completedEventType) {
      case LevelWaveEventType.ELITE_HUNT:
        completionObjective = {
          title: `第 ${wave + 1} 波 · 精英歼灭完成`,
          objective: '高威胁目标已清空，空域压力下降。',
          status: '结果：高威胁已打穿',
        };
        break;
      case LevelWaveEventType.INTERCEPT:
        completionObjective = {
          title: `第 ${wave + 1} 波 · 拦截完成`,
          objective: '前锋突防已压制，准备接续下一波。',
          status: '结果：拦截完成',
        };
        break;
      case LevelWaveEventType.ESCORT_DEFENSE: {
        const escortSuccess = this.handleEscortWaveComplete(wave);
        completionObjective = escortSuccess
          ? {
              title: `第 ${wave + 1} 波 · 护送完成`,
              objective: '友军守住关键点，护航压力打穿。',
              status: '结果：护送达成',
            }
          : {
              title: `第 ${wave + 1} 波 · 护送结束`,
              objective: '护送线受损，清理残余威胁稳局。',
              status: '结果：护送失利',
            };
        break;
      }
      default:
        break;
    }

    this.waveEventState.type = null;
    this.waveEventState.wave = -1;

    const completionSignature = `${wave}|${completionObjective?.title ?? 'unknown'}`;
    const shouldShowCompletion =
      completionSignature !== this.lastWaveEventCompleteSignature
      || now - this.lastWaveEventCompleteAt >= GameCoordinator.WAVE_EVENT_COMPLETE_COOLDOWN_MS;
    const completionAnnouncement = completionObjective
      ? this.getWaveAnnouncementDisplay(
          completedEventType,
          wave + 1,
          true,
          onboardingBeat
        )
      : null;
    const completionDelayMs = Math.max(0, onboardingBeat.eventCompletionDelayMs);
    const objectiveHoldMs = Math.max(
      GameCoordinator.OBJECTIVE_COMPLETE_HOLD_MS,
      onboardingBeat.eventCompletionObjectiveHoldMs
    );

    if (shouldShowCompletion) {
      this.lastWaveEventCompleteSignature = completionSignature;
      this.lastWaveEventCompleteAt = now;

      if (completionAnnouncement) {
        this.scheduleTimeout(() => {
          if (this.lastWaveEventCompleteSignature !== completionSignature) {
            return;
          }

          this.hud.showPowerUpBig(
            completionAnnouncement.icon,
            completionAnnouncement.text,
            completionAnnouncement.durationSeconds,
            true
          );
        }, completionDelayMs);
      }
    }

    if (completionObjective && shouldShowCompletion) {
      this.updatePlayerFacingObjective();
      this.scheduleTimeout(() => {
        if (this.lastWaveEventCompleteSignature !== completionSignature) {
          return;
        }

        this.showTransientObjective(completionObjective as WaveObjectiveDisplay, objectiveHoldMs);
      }, completionDelayMs);
      return;
    }

    this.updatePlayerFacingObjective();
  }

  private showTransientObjective(
    objective: WaveObjectiveDisplay,
    holdMs: number = GameCoordinator.OBJECTIVE_COMPLETE_HOLD_MS
  ): void {
    this.waveCompletionObjective = objective;
    this.updatePlayerFacingObjective();

    const objectiveRef = objective;
    this.scheduleTimeout(() => {
      if (this.waveCompletionObjective !== objectiveRef) {
        return;
      }
      this.waveCompletionObjective = null;
      this.updatePlayerFacingObjective();
    }, holdMs);
  }

  private getWaveObjectiveDisplay(
    eventType: LevelWaveEventType,
    waveNumber: number
  ): WaveObjectiveDisplay {
    switch (eventType) {
      case LevelWaveEventType.ELITE_HUNT:
        return {
          title: `第 ${waveNumber} 波 · 精英歼灭`,
          objective: '优先打穿重型与王牌，切断高威胁线。',
          status: '优先：重型/王牌',
        };
      case LevelWaveEventType.INTERCEPT:
        return {
          title: `第 ${waveNumber} 波 · 限时拦截`,
          objective: '拦截突防编队，优先高速目标。',
          status: '优先：前锋拦截',
        };
      case LevelWaveEventType.ESCORT_DEFENSE:
        return {
          title: `第 ${waveNumber} 波 · 护送防守`,
          objective: '先护送友军，再点穿护航关键威胁。',
          status: '优先：友军防护',
        };
      default:
        return {
          title: `第 ${waveNumber} 波 · 空域压制`,
          objective: '清空本波目标，维持机动与火力',
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
        if (this.isDisposed) {
          menu.dispose();
          return menu;
        }
        this.upgradeMenu = menu;
        return menu;
      });
    }

    return this.upgradeMenuPromise;
  }

  private async ensurePauseMenu(): Promise<PauseMenu> {
    if (this.pauseMenu) {
      return this.pauseMenu;
    }

    if (!this.pauseMenuPromise) {
      this.pauseMenuPromise = import('@/ui/PauseMenu').then(({ PauseMenu }) => {
        const menu = new PauseMenu({
          onContinue: () => this.resumeGame(),
          onUpgrade: () => {
            void this.ensureUpgradeMenu().then((upgradeMenu) => {
              if (
                this.isDisposed ||
                !this.sessionState.isPaused() ||
                !this.sessionState.isPlaying()
              ) {
                return;
              }
              upgradeMenu.updateDisplay();
              upgradeMenu.show();
            });
          },
          onExitToMenu: () => this.options.onExitToMenu?.(),
          applyAudio: (sfx, music) => {
            this.audioManager.setSFXVolume(sfx);
            this.audioManager.setMusicVolume(music);
            this.musicSystem.setVolume(music);
          },
          applyQuality: (preset) => this.setQualityPreset(preset),
          loadSettings: loadStartFlowSettings,
          saveSettings: saveStartFlowSettings,
        });
        if (this.isDisposed) {
          menu.dispose();
          return menu;
        }
        this.pauseMenu = menu;
        return menu;
      });
    }

    return this.pauseMenuPromise;
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
            presentation: this.presentation,
            getSurfaceSample: (x, z) => enemySystem.getLevelManager().getSurfaceSample(x, z),
            getTerrainEnvironment: () => enemySystem.getLevelManager().getTerrainEnvironment(),
            whenTerrainReady: () => enemySystem.getLevelManager().whenTerrainReady(),
            getDecoys: () => this.weapons.getActiveDecoys(),
            onSpawnMinion: (position, kind) => this.spawnBossMinion(position, kind),
            onCameraShake: (intensity) => this.view.addShake(intensity),
            onExplosionShake: (position, scale) => this.view.addExplosionShake(position, scale),
            onScreenFlash: (amount) => this.gameScene.setScreenEffects({ flash: amount }),
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
    this.gameScene.setScreenEffects({ flash: 0.85 });
    this.view.addShake(0.9);
    this.awardScore(bossConfig.scoreValue);
    this.campaign.recordKill();

    this.presentationController.clearBossMissileIndicators();
    this.presentation.setBossStatus(null);

    const level = this.bossBattleController?.getCurrentLevel() ?? this.sessionState.getLevel();
    this.bossBattleController?.clear();
    this.enemySystem?.clearFriendlies();
    this.weapons.clearInFlight();

    this.hud.showPowerUpBig('', '已击坠');
    this.campaign.handleBossDefeated(level, isBossMode);
  }

  private createCombatHitFeedback(
    target: THREE.Object3D,
    damage: number,
    source: ProjectileHitSource = 'player-bullet'
  ): void {
    const hitPosition = new THREE.Vector3();
    target.getWorldPosition(hitPosition);
    const { profile, hitTone, intensityMultiplier } = this.resolveProjectileHitFeedback(source);
    const hitIntensity = THREE.MathUtils.clamp((damage / 16) * intensityMultiplier, 0.82, 1.95);
    this.audioManager.playHit(hitIntensity, profile, hitTone);
    this.particleSystem?.createHit(hitPosition, hitIntensity, profile);

    if (source === 'player-bullet' || source === 'missile') {
      this.requestPlayerHitMarker(hitPosition);
    }
  }

  private requestPlayerHitMarker(worldPosition: THREE.Vector3): void {
    this.hitMarkerNdc.copy(worldPosition).project(this.gameScene.camera);
    if (this.hitMarkerNdc.z >= 1) {
      return;
    }
    const screenX = (this.hitMarkerNdc.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-this.hitMarkerNdc.y * 0.5 + 0.5) * window.innerHeight;
    this.presentationController.requestHitMarker(screenX, screenY);
  }

  private resolveProjectileHitFeedback(source: ProjectileHitSource): {
    profile: 'player' | 'enemy' | 'boss';
    hitTone: 'bullet' | 'missile' | 'heavy';
    intensityMultiplier: number;
  } {
    switch (source) {
      case 'friendly-bullet':
        return {
          profile: 'player',
          hitTone: 'bullet',
          intensityMultiplier: 0.94,
        };
      case 'enemy-bullet':
        return {
          profile: 'enemy',
          hitTone: 'bullet',
          intensityMultiplier: 0.92,
        };
      case 'boss-projectile':
        return {
          profile: 'boss',
          hitTone: 'heavy',
          intensityMultiplier: 1.08,
        };
      case 'missile':
        return {
          profile: 'player',
          hitTone: 'missile',
          intensityMultiplier: 1.18,
        };
      default:
        return {
          profile: 'player',
          hitTone: 'bullet',
          intensityMultiplier: 1,
        };
    }
  }

  /** 入关简报（CampaignData：章节 + 关卡标题 + 一句话目标） */
  private presentLevelBriefing(level: number): void {
    const chapter = getCampaignChapter(level);
    this.hud.showBriefing({
      kicker: chapter.chapterLabel,
      title: chapter.title,
      line: chapter.levelBriefingLine,
      tone: 'sys',
      durationMs: 1800,
    });
    this.audioManager.playWaveStart();
  }

  /** Boss 简报（CampaignData：Boss 名称 + 打法提示），显示完毕后开始 Boss 战 */
  private presentBossBriefing(level: number, thenStart: () => void): void {
    const boss = getCampaignChapter(level).boss;
    this.hud.showBriefing({
      kicker: 'BOSS',
      title: boss.name,
      line: boss.briefingLine,
      tone: 'threat',
      durationMs: 1800,
    });
    this.audioManager.playLevelUp();
    this.scheduleTimeout(thenStart, 1800);
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

    // 子弹 / 炮弹撞上真实地表（采样高度；水面略抬高避免掠过浪尖），特效与音效按地表材质选型
    this.combatSystem.setEnvironmentImpactHandler(this.impactSurfaceSampler, (position, source) => {
      const surfaceKind = this.getSurfaceKindAt(position.x, position.z);
      if (surfaceKind === 'water') {
        if (source === 'boss') {
          this.particleSystem?.createSplash(position, 0.9);
        } else {
          this.particleSystem?.createWaterImpact(position, 0.9);
        }
        this.audioManager.playWaterImpact(source === 'boss' ? 1.1 : 0.85);
        return;
      }

      const impactIntensity = source === 'boss' ? 1.15 : 0.85;
      this.particleSystem?.createGroundImpact(position, impactIntensity, surfaceKind);
      this.audioManager.playGroundImpact(surfaceKind, source === 'boss' ? 1.05 : 0.8);
    });
  }

  /** 环境命中面：地表采样高度（水面 +0.4 米，避免子弹贴着波面飞行时漏判） */
  private readonly impactSurfaceSampler = (x: number, z: number): number => {
    const levelManager = this.enemySystem?.getLevelManager();
    if (!levelManager) {
      return WORLDSCAPE_WATER_Y;
    }
    const sample = levelManager.getSurfaceSample(x, z);
    return sample.water ? sample.y + 0.4 : sample.y;
  };

  /** 地表材质（第 6-10 关熔岩 / 冰 / 岩石 / 云海）；地形未加载时回落到 'ground' */
  private getSurfaceKindAt(x: number, z: number): TerrainSurfaceKind {
    return this.enemySystem?.getLevelManager().getSurfaceKind(x, z) ?? 'ground';
  }

  public stop(): void {
    this.gameLoop.stop();
    this.audioManager.stopEngine();
    this.musicSystem.stopMusic();
  }

  private handlePauseToggle(): void {
    if (!this.sessionState.isPlaying()) {
      this.pauseGame();
      return;
    }

    if (this.sessionState.isPaused()) {
      if (this.pauseMenu?.handleEscape()) {
        return;
      }
      this.resumeGame();
      return;
    }

    this.pauseGame();
  }

  private handleUpgradeToggle(): void {
    if (!this.sessionState.isPlaying()) {
      this.inputHandler.resetPauseState();
      this.inputHandler.resetUpgradeState();
      return;
    }

    if (!this.sessionState.isPaused()) {
      this.pauseGame();
    }

    void this.ensureUpgradeMenu().then((upgradeMenu) => {
      if (this.isDisposed || !this.sessionState.isPaused() || !this.sessionState.isPlaying()) {
        return;
      }

      upgradeMenu.updateDisplay();
      upgradeMenu.show();
    });
  }

  private pauseGame(): void {
    if (!this.sessionState.isPlaying()) {
      this.inputHandler.resetPauseState();
      this.inputHandler.resetUpgradeState();
      return;
    }

    this.sessionState.pause();
    this.audioManager.stopEngine();
    this.inputHandler.resetPauseState();
    this.inputHandler.resetUpgradeState();
    void this.ensurePauseMenu().then((pauseMenu) => {
      if (this.isDisposed || !this.sessionState.isPaused() || !this.sessionState.isPlaying()) {
        return;
      }

      pauseMenu.show();
    });
  }

  private resumeGame(): void {
    this.sessionState.resume();
    this.pauseMenu?.hide();
    this.upgradeMenu?.hide();
    this.presentationController.resetHudThrottle();
    this.inputHandler.resetPauseState();
    this.inputHandler.resetUpgradeState();
    if (this.sessionState.isPlaying() && this.playerSystem.getLives() > 0) {
      this.audioManager.startEngine();
    }
  }

  private handleUpgrade(type: UpgradeType): void {
    if (this.playerStats.getUpgrades().upgrade(type)) {
      if (type === UpgradeType.MAX_HEALTH) {
        this.playerSystem.syncMaxHealth();
      }
      if (type === UpgradeType.MISSILE_LOCK_TIME) {
        this.lockOnIndicator.setLockTime(this.playerStats.getMissileLockTime());
      }
      if (type === UpgradeType.MISSILE_LOCK_RADIUS) {
        this.lockOnIndicator.setLockCircleScale(
          this.playerStats.getMissileLockRadiusMultiplier()
        );
      }
      // 武器强化 / 热焰弹挂架：立即同步到武器系统（弹药上限、容量）
      this.weapons.syncProgression(
        this.playerStats,
        this.playerStats.getUpgrades().getUnlockedWeapons()
      );
      this.weapons.pushHud();
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
    this.isDisposed = true;
    this.stop();
    this.resourceRegistry.dispose();
    this.campaign.dispose();
    this.bossBattleController?.clear();
    this.units.dispose();
    this.weapons.dispose();
    this.vfx.dispose();
    this.view.dispose();
    this.presentation.dispose();
    this.checkpointResumeButton.dispose();
    this.enemySystem?.dispose();
    this.particleSystem?.clear();
    this.powerUpSystem?.dispose();
    this.combatSystem?.dispose();
    if (this.presentationRuntimeReady) {
      this.presentationController.dispose();
    }
    this.pauseMenu?.dispose();
    this.pauseMenu = null;
    this.pauseMenuPromise = null;
    this.upgradeMenu?.dispose();
    this.upgradeMenu = null;
    this.upgradeMenuPromise = null;
    this.inputHandler.dispose();
    this.bossBattleControllerPromise = null;
    this.gameScene.dispose();
    this.audioManager.dispose();
    this.musicSystem.dispose();
  }
}
