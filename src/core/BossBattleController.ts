import { Vector3 } from 'three';
import type { Camera, Group, Object3D, Scene } from 'three';
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
import {
  getDeclaredHitRadius,
  type CombatTarget,
  type DamageSource,
  type DecoyPoint,
} from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import {
  BossFlareDecoyRedirector,
  HazardCooldownTracker,
  mapOracleStageToCoreState,
  resolveAdvancedBossSpawn,
  type BossSurfaceSampler,
  type CitadelCoreVisualState,
} from '@/core/boss/AdvancedBossSupport';
import type { TerrainEnvironment } from '@/features/terrain/environments/TerrainEnvironment';
import type { BossAI } from '@/features/boss/BossAI';
import type { DesertFortressAI } from '@/features/boss/DesertFortressAI';
import type { MissileDestroyerAI } from '@/features/boss/MissileDestroyerAI';
import type { OctopusWarshipAI } from '@/features/boss/OctopusWarshipAI';
import type { SkyCarrierAI } from '@/features/boss/SkyCarrierAI';
import type { BossMinionKind, BossSubTarget, IAdvancedBoss } from '@/features/boss/BossContracts';
import type { BossMissile } from '@/features/boss/BossMissileSystem';
import {
  BOSS_MISSILE_CONFIG,
  BossConfig,
  BossType,
  FLAK_CANNON_CONFIG,
  getBossForLevel,
} from '@/features/boss/BossTypes';

/**
 * 第 6-10 关 Boss（IAdvancedBoss）的公共扩展：死亡演出、地表采样、效果提示，
 * 以及个别 Boss 的专属能力（幻影之翼的隐形 / EMP 现形，神谕主宰的阶段与音乐强度）。
 */
export type AdvancedBossInstance = IAdvancedBoss & {
  setDeathSequenceEnabled(enabled: boolean): void;
  isDying(): boolean;
  setGroundSampler?(sampler: (x: number, z: number) => number): void;
  isCloaked?(): boolean;
  applyEmpPulse?(center: Vector3, radius: number, seconds: number): boolean;
  getStage?(): string;
  getMusicIntensity?(): number;
  getDeathProgress?(): number;
};

export type ActiveBoss =
  | BossAI
  | DesertFortressAI
  | OctopusWarshipAI
  | MissileDestroyerAI
  | SkyCarrierAI
  | AdvancedBossInstance;

/** 高级 Boss 的效果提示回调（各 Boss 的 cue 联合类型都是字符串子集） */
type BossCueHandler = (cue: string, position: Vector3, intensity: number) => void;

/** 第 6-10 关 Boss 类型 */
const ADVANCED_BOSS_TYPES: ReadonlySet<BossType> = new Set([
  BossType.MAGMA_COLOSSUS,
  BossType.ABYSSAL_LEVIATHAN,
  BossType.TEMPEST_ZEPPELIN,
  BossType.PHANTOM_WING,
  BossType.ORACLE_PRIME,
]);

/** 需要镜头震动的重型提示 */
const HEAVY_SHAKE_CUES: ReadonlySet<string> = new Set([
  'stomp',
  'breach',
  'mortar-impact',
  'geyser',
  'storm-strike',
  'arc-strike',
  'orbital-strike',
  'shockwave',
  'mine-detonate',
  'ram',
  'lightning',
  'collapse',
  'crash',
  'hull-break',
  'death-implode',
  'cell-burst',
]);

const PLAYER_HAZARD_RADIUS = 6;
const FRIENDLY_HAZARD_RADIUS = 5;
const PLAYER_HAZARD_SHAKE = 0.4;
const BOSS_STATUS_INTERVAL = 0.25;

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
  /** 战役表现层（音乐 / 无线电 / Boss 状态 / 警告；第 2 轮挂真实 HUD 与音效） */
  presentation: ICampaignPresentation;
  /** 地表采样（Boss 出生点 / 落脚 / 天罚落点） */
  getSurfaceSample: BossSurfaceSampler;
  /** 当前关卡的环境模块（CITADEL 决战区与核心联动） */
  getTerrainEnvironment: () => TerrainEnvironment | null;
  /** 当前关卡地形生成完毕（出生点采样可信） */
  whenTerrainReady: () => Promise<void>;
  /** 燃烧中的热焰弹（诱骗 Boss 导弹） */
  getDecoys: () => readonly DecoyPoint[];
  /** 高级 Boss 召唤小兵（协调器映射到敌机或无人机单位） */
  onSpawnMinion: (position: Vector3, kind: BossMinionKind) => void;
  /** 镜头震动（0..1） */
  onCameraShake: (intensity: number) => void;
  /** 爆炸震动（按距离衰减） */
  onExplosionShake: (position: Vector3, scale: number) => void;
  /** 全屏闪白（神谕终焉） */
  onScreenFlash: (amount: number) => void;
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

  // ── 第 6-10 关 Boss ──
  private advancedBoss: AdvancedBossInstance | null = null;
  private currentLevel = 1;
  private readonly hazardCooldowns = new HazardCooldownTracker(0.6);
  private decoyRedirector: BossFlareDecoyRedirector | null = null;
  private readonly partTargets = new Map<Object3D, CombatTarget>();
  private readonly missileTargets = new WeakMap<BossMissile, CombatTarget>();
  private readonly currentParts = new Set<Object3D>();
  private readonly friendlyMeshBuffer: Object3D[] = [];
  private readonly friendlyTargetBuffer: Object3D[] = [];
  private readonly weaponTargetBuffer: Object3D[] = [];
  private readonly hitWorldPosition = new Vector3();
  private bossStatusTimer = 0;
  private lowHealthAnnounced = false;
  private defeatAnnounced = false;
  private lastCoreState: CitadelCoreVisualState | null = null;
  private stunFrame = -1;
  private frameCounter = 0;

  constructor(private readonly deps: BossBattleControllerDeps) {}

  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  /** 当前是否为第 6-10 关的高级 Boss */
  public getAdvancedBoss(): AdvancedBossInstance | null {
    return this.advancedBoss;
  }

  /** Boss 正在播放死亡演出（期间仍需逐帧更新） */
  public isBossDying(): boolean {
    return this.advancedBoss?.isDying() ?? false;
  }

  /** 隐形中的 Boss 不出现在雷达 / 锁定中（幻影之翼） */
  public isBossHiddenFromSensors(): boolean {
    return this.advancedBoss?.isCloaked?.() ?? false;
  }

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

    this.currentLevel = level;
    this.deps.presentation.playBossMusic(level);
    // 正常模式下本关地形已加载（波次之后直接迎战）；只有关卡不同才重新加载
    const levelManager = this.deps.enemySystem.getLevelManager();
    if (levelManager.getCurrentLevelConfig()?.id !== level) {
      this.deps.enemySystem.loadLevel(level);
    }
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

    this.frameCounter++;
    if (this.advancedBoss) {
      this.updateAdvancedBoss(deltaTime, this.advancedBoss);
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
    this.resetAdvancedState();

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
      // 出生点需要采样当前关卡地形（换关后地形在下一个微任务才生成）
      await this.deps.whenTerrainReady();
      if (loadSequence !== this.loadSequence) {
        return;
      }
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
    this.advancedBoss = ADVANCED_BOSS_TYPES.has(bossType) ? (boss as AdvancedBossInstance) : null;
    this.lowHealthAnnounced = false;
    this.defeatAnnounced = false;
    this.bossStatusTimer = 0;
    // Boss 登场无线电（Boss 模式下也播放：只有登场台词，没有剧情卡片）
    this.deps.presentation.radio('boss-spawn', this.currentLevel);
  }

  private async createBoss(
    bossType: BossType,
    config: BossConfig,
    isBossMode: boolean
  ): Promise<ActiveBoss> {
    if (ADVANCED_BOSS_TYPES.has(bossType)) {
      return this.createAdvancedBoss(bossType, config, isBossMode);
    }

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
        this.createWeaponHitFeedback(
          target.position,
          Math.max(1.1, damage / 13),
          'flak-hit',
          Math.max(0.82, damage / 30),
          this.getTargetHitProfile(target)
        );
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.takeCombatDamage(damage, { suppressDefaultFeedback: true });
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
        this.deps.playerSystem.takeCombatDamage(config.damage, {
          suppressDefaultFeedback: true,
        });
        this.createWeaponHitFeedback(
          this.deps.playerAircraft.position,
          Math.max(1.08, config.damage / 18),
          'laser',
          Math.max(0.82, config.damage / 30),
          'player'
        );
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
        this.createWeaponHitFeedback(
          target.position,
          Math.max(1.1, damage / 13),
          'flak-hit',
          Math.max(0.82, damage / 30),
          this.getTargetHitProfile(target)
        );
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.takeCombatDamage(damage, {
              suppressDefaultFeedback: true,
            });
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
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
    return boss;
  }

  // ===========================================================================================
  // 第 6-10 关 Boss：创建、逐帧驱动、命中、特殊武器、表现
  // ===========================================================================================

  private async createAdvancedBoss(
    bossType: BossType,
    config: BossConfig,
    isBossMode: boolean
  ): Promise<AdvancedBossInstance> {
    const playerMesh = this.deps.playerAircraft;
    const forward = this.hitWorldPosition.set(0, 0, -1).applyQuaternion(playerMesh.quaternion);
    const placement = resolveAdvancedBossSpawn({
      type: bossType,
      playerPosition: playerMesh.position,
      forwardX: forward.x,
      forwardZ: forward.z,
      sample: this.deps.getSurfaceSample,
      coreArena: bossType === BossType.ORACLE_PRIME ? this.getCitadelArena() : null,
    });

    let mesh: Group;
    let boss: AdvancedBossInstance;
    const scene = this.deps.scene;
    const particles = this.deps.particleSystem;
    const place = (group: Group): void => {
      group.position.copy(placement.position);
      group.rotation.set(0, placement.yaw, 0);
      scene.add(group);
    };

    switch (bossType) {
      case BossType.MAGMA_COLOSSUS: {
        const module = await import('@/features/boss/MagmaColossusAI');
        mesh = module.createMagmaColossusMesh(config);
        place(mesh);
        const colossus = new module.MagmaColossusAI(mesh, config, scene, particles);
        colossus.onEffectCue = this.createCueHandler();
        boss = colossus;
        break;
      }
      case BossType.ABYSSAL_LEVIATHAN: {
        const module = await import('@/features/boss/AbyssalLeviathanAI');
        mesh = module.createAbyssalLeviathanMesh(config);
        place(mesh);
        const leviathan = new module.AbyssalLeviathanAI(mesh, config, scene, particles);
        leviathan.onEffectCue = this.createCueHandler();
        boss = leviathan;
        break;
      }
      case BossType.TEMPEST_ZEPPELIN: {
        const module = await import('@/features/boss/TempestZeppelinAI');
        mesh = module.createTempestZeppelinMesh(config);
        place(mesh);
        const zeppelin = new module.TempestZeppelinAI(mesh, config, scene, particles);
        zeppelin.onEffectCue = this.createCueHandler();
        boss = zeppelin;
        break;
      }
      case BossType.PHANTOM_WING: {
        const module = await import('@/features/boss/PhantomWingAI');
        mesh = module.createPhantomWingMesh(config);
        place(mesh);
        const phantom = new module.PhantomWingAI(mesh, config, scene, particles);
        phantom.onEffectCue = this.createCueHandler();
        boss = phantom;
        break;
      }
      case BossType.ORACLE_PRIME:
      default: {
        const module = await import('@/features/boss/OraclePrimeAI');
        mesh = module.createOraclePrimeMesh(config);
        place(mesh);
        const oracle = new module.OraclePrimeAI(mesh, config, scene, particles);
        oracle.onEffectCue = this.createCueHandler((cue) => {
          if (cue === 'death-freeze' && !this.defeatAnnounced) {
            // 神谕的遗言在冻结瞬间响起
            this.defeatAnnounced = true;
            this.deps.presentation.radio('boss-defeated', this.currentLevel);
          } else if (cue === 'death-flash') {
            this.deps.onScreenFlash(1);
            this.deps.onCameraShake(1);
          }
        });
        boss = oracle;
        break;
      }
    }

    const sample = this.deps.getSurfaceSample;
    boss.setGroundSampler?.((x, z) => sample(x, z).y);
    boss.setDeathSequenceEnabled(true);
    this.wireAdvancedBoss(boss, isBossMode);
    return boss;
  }

  /** CITADEL 决战区（神谕主宰锚点）；不是第 10 关地形时为 null */
  private getCitadelArena(): Vector3 | null {
    const environment = this.deps.getTerrainEnvironment() as
      | (TerrainEnvironment & { getCoreArena?: (target?: Vector3) => Vector3 })
      | null;
    if (!environment || typeof environment.getCoreArena !== 'function') {
      return null;
    }
    return environment.getCoreArena(new Vector3());
  }

  private syncCitadelCore(state: CitadelCoreVisualState): void {
    if (state === this.lastCoreState) return;
    const environment = this.deps.getTerrainEnvironment() as
      | (TerrainEnvironment & { setCoreState?: (state: CitadelCoreVisualState) => void })
      | null;
    if (!environment || typeof environment.setCoreState !== 'function') return;
    this.lastCoreState = state;
    environment.setCoreState(state);
  }

  private createCueHandler(extra?: (cue: string) => void): BossCueHandler {
    return (cue, position, intensity) => {
      this.deps.presentation.onBossCue(cue, position, intensity);
      if (HEAVY_SHAKE_CUES.has(cue)) {
        this.deps.onExplosionShake(position, Math.max(0.6, intensity) * 2.2);
      }
      extra?.(cue);
    };
  }

  private wireAdvancedBoss(boss: AdvancedBossInstance, isBossMode: boolean): void {
    const presentation = this.deps.presentation;
    boss.onFire = (position, direction, damage) => {
      this.deps.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, boss.getMesh(), Faction.ENEMY);
      this.deps.audioManager.playShoot('boss');
    };
    boss.onMissileFired = () => {
      this.deps.audioManager.playMissileLaunch('boss');
    };
    boss.onPhaseChange = (phase, label) => {
      presentation.radio('boss-phase', this.currentLevel, phase);
      presentation.playStinger('phase-change');
      presentation.flashWarning(label, 'threat');
      this.deps.onCameraShake(0.3);
    };
    boss.onHazardWarning = (label) => {
      presentation.flashWarning(label, 'threat');
    };
    boss.onSpawnMinion = (position, kind) => {
      this.deps.onSpawnMinion(position, kind);
    };
    boss.onDestroy = (position, bossConfig) => {
      this.handleBossDestroy(position, bossConfig, isBossMode);
    };
  }

  private resetAdvancedState(): void {
    this.advancedBoss = null;
    this.hazardCooldowns.clear();
    this.decoyRedirector?.clear();
    this.partTargets.clear();
    this.currentParts.clear();
    this.bossStatusTimer = 0;
  }

  private collectFriendlyMeshes(): Object3D[] {
    const buffer = this.friendlyMeshBuffer;
    buffer.length = 0;
    for (const friendly of this.deps.enemySystem.getFriendlyAIs()) {
      if (friendly.isAlive()) buffer.push(friendly.getMesh());
    }
    return buffer;
  }

  private updateAdvancedBoss(deltaTime: number, boss: AdvancedBossInstance): void {
    const playerMesh = this.deps.playerAircraft;
    const friendlyMeshes = this.collectFriendlyMeshes();
    const parts = boss.getCollisionParts();
    this.currentParts.clear();
    for (const part of parts) this.currentParts.add(part);
    const missileSystem = boss.getMissileSystem();

    // 友军僚机以 Boss 本体与部件为目标（隐形 / 死亡演出时不攻击本体）
    const friendlyTargets = this.friendlyTargetBuffer;
    friendlyTargets.length = 0;
    if (boss.isAlive() && !(boss.isCloaked?.() ?? false)) {
      friendlyTargets.push(boss.getMesh());
    }
    for (const part of parts) friendlyTargets.push(part);
    this.deps.enemySystem.updateWithPlayer(
      deltaTime,
      this.deps.playerSystem.getPosition(),
      friendlyTargets
    );

    // 玩家坠毁 / 复活等待时不提供玩家目标（Boss 暂缓召唤与锁定）
    const playerTarget =
      playerMesh.visible && !this.deps.playerSystem.isPlayerRespawning() ? playerMesh : null;
    boss.update(deltaTime, playerTarget, friendlyMeshes);
    if (this.currentBoss !== boss) {
      // 死亡演出结束，onDestroy 已在 update 内触发并清理
      return;
    }

    this.updateBossMissileCollisions(missileSystem, friendlyMeshes);
    this.updateAdvancedWeaponHits(boss, missileSystem);
    if (this.currentBoss !== boss) {
      return;
    }
    this.updateAdvancedHazards(deltaTime, boss);
    this.decoyRedirector ??= new BossFlareDecoyRedirector(this.deps.scene);
    this.decoyRedirector.update(deltaTime, this.deps.getDecoys(), missileSystem, playerMesh.position);
    this.updateAdvancedPresentation(deltaTime, boss);

    this.bossFriendlySpawnTimer += deltaTime;
    if (this.bossFriendlySpawnTimer >= 30 && boss.isAlive()) {
      this.bossFriendlySpawnTimer = 0;
      this.deps.onSpawnFriendly();
      this.deps.hud.showPowerUpBig('✈️', '友军支援');
    }

    this.bossIndicatorUpdateTimer += deltaTime;
    if (this.bossIndicatorUpdateTimer >= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL) {
      this.bossIndicatorUpdateTimer %= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL;
      this.updateBossIndicators();
    }
  }

  /**
   * 玩家机炮 / 导弹与友军子弹对高级 Boss 的命中：一律按部件半径判定，
   * 交给 takeDamageAt(部件, 原始伤害)，由 Boss 自己处理弱点倍率、子目标与无敌。
   */
  private updateAdvancedWeaponHits(
    boss: AdvancedBossInstance,
    missileSystem: ReturnType<AdvancedBossInstance['getMissileSystem']>
  ): void {
    const targets = this.weaponTargetBuffer;
    targets.length = 0;
    for (const part of this.currentParts) targets.push(part);
    const bossMissiles = missileSystem ? missileSystem.getMissiles() : [];
    for (const missile of bossMissiles) targets.push(missile.getMesh());
    if (targets.length === 0) return;

    const combat = this.deps.combatSystem;
    const missileDamage = GAME_CONSTANTS.MISSILE.DAMAGE * combat.getDamageMultiplier();
    combat.getMissileSystem().checkCollisions(targets, (target, impactPosition) => {
      if (this.currentParts.has(target)) {
        this.damageAdvancedPart(boss, target, missileDamage, impactPosition, true);
        this.deps.particleSystem.createMissileImpact(impactPosition, 1.55);
        this.deps.audioManager.playMissileExplosion('enemy');
        return;
      }
      const missile = bossMissiles.find((candidate) => candidate.getMesh() === target);
      if (missile) {
        missile.takeDamage(missileDamage);
        this.createBossMissileDestroyedFeedback(impactPosition, 0.92, 'enemy');
      }
    });

    combat.getPlayerProjectilePool().checkCollisions(targets, (target, projectileMesh, damage) => {
      if (this.currentParts.has(target)) {
        this.damageAdvancedPart(boss, target, damage, projectileMesh.position, false);
        return;
      }
      const missile = bossMissiles.find((candidate) => candidate.getMesh() === target);
      missile?.takeDamage(damage);
    });

    // 友军僚机的子弹（只认 FRIENDLY 阵营，敌机子弹穿过 Boss 不被吞掉）
    const enemyPool = combat.getEnemyProjectilePool();
    if (enemyPool.hasActiveProjectiles()) {
      enemyPool.consumeHits((position, damage, faction) => {
        if (faction !== Faction.FRIENDLY) return false;
        const part = this.findPartNear(position);
        if (!part) return false;
        boss.takeDamageAt(part, damage);
        return true;
      });
    }
  }

  private findPartNear(position: Vector3): Object3D | null {
    for (const part of this.currentParts) {
      part.getWorldPosition(this.hitWorldPosition);
      const radius = Math.max(2, getDeclaredHitRadius(part, 5));
      if (this.hitWorldPosition.distanceToSquared(position) <= radius * radius) {
        return part;
      }
    }
    return null;
  }

  /** 部件伤害 + 分级命中反馈（弱点 / 装甲 / 护盾偏转） */
  private damageAdvancedPart(
    boss: AdvancedBossInstance,
    part: Object3D,
    amount: number,
    at: Vector3,
    heavy: boolean
  ): void {
    const multiplier = boss.getDamageMultiplier(part);
    boss.takeDamageAt(part, amount);
    if (multiplier <= 0 || boss.isInvulnerable()) {
      // 护盾 / 潜航 / 无敌：偏转火花
      this.deps.particleSystem.createHit(at, heavy ? 1.1 : 0.7, 'boss');
      return;
    }
    const weakPoint = multiplier > 1.05;
    const intensity = (heavy ? 1.18 : 0.9) * (weakPoint ? 1.25 : 1);
    this.createArmorHitFeedback(at, intensity, heavy || weakPoint);
  }

  /** Boss 特殊武器（熔岩 / 电弧 / 激光 / 冲击波）：玩家与友军各自 0.6 秒命中冷却 */
  private updateAdvancedHazards(deltaTime: number, boss: AdvancedBossInstance): void {
    this.hazardCooldowns.update(deltaTime);
    const player = this.deps.playerAircraft;
    const playerSystem = this.deps.playerSystem;
    if (
      player.visible &&
      !playerSystem.isPlayerRespawning() &&
      this.hazardCooldowns.isReady(player)
    ) {
      const hit = boss.checkHazard(player.position, PLAYER_HAZARD_RADIUS);
      if (hit) {
        this.hazardCooldowns.trigger(player);
        if (playerSystem.isShieldActive()) {
          playerSystem.notifyShieldHit(hit.position);
        } else {
          playerSystem.takeCombatDamage(hit.damage, { suppressDefaultFeedback: true });
          this.deps.onCameraShake(PLAYER_HAZARD_SHAKE);
        }
        this.createWeaponHitFeedback(
          hit.position,
          Math.max(1.05, hit.damage / 18),
          hit.profile,
          Math.max(0.85, hit.damage / 30),
          'player'
        );
      }
    }

    for (const friendly of this.deps.enemySystem.getFriendlyAIs()) {
      if (!friendly.isAlive()) continue;
      const mesh = friendly.getMesh();
      if (!this.hazardCooldowns.isReady(mesh)) continue;
      const hit = boss.checkHazard(mesh.position, FRIENDLY_HAZARD_RADIUS);
      if (!hit) continue;
      this.hazardCooldowns.trigger(mesh);
      friendly.takeDamage(hit.damage);
      this.createWeaponHitFeedback(hit.position, 0.95, hit.profile, 0.85, 'enemy');
    }
  }

  /** Boss 状态（第 2 轮 HUD.setBossStatus）、低血量台词、音乐强度、城堡核心联动 */
  private updateAdvancedPresentation(deltaTime: number, boss: AdvancedBossInstance): void {
    const stage = boss.getStage?.();
    if (stage !== undefined) {
      this.syncCitadelCore(mapOracleStageToCoreState(stage, boss.isAlive(), boss.isDying()));
    }

    this.bossStatusTimer -= deltaTime;
    if (this.bossStatusTimer > 0) return;
    this.bossStatusTimer = BOSS_STATUS_INTERVAL;
    const presentation = this.deps.presentation;
    presentation.setBossStatus(boss.getStatusLabel(), {
      current: boss.getPhase(),
      total: boss.getPhaseCount(),
    });
    const intensity = boss.getMusicIntensity?.();
    if (intensity !== undefined) {
      presentation.setMusicIntensity(intensity);
    }
    if (!this.lowHealthAnnounced && boss.isAlive()) {
      const health = boss.getHealth();
      if (health.max > 0 && health.current / health.max < 0.25) {
        this.lowHealthAnnounced = true;
        presentation.radio('boss-low-health', this.currentLevel);
      }
    }
  }

  // ===========================================================================================
  // 供协调器使用的查询（特殊武器目标、锁定、血条、EMP）
  // ===========================================================================================

  /** 特殊武器目标：Boss 可命中部件（含第三关眼睛）与可拦截的 Boss 导弹 */
  public appendCombatTargets(out: CombatTarget[]): void {
    const boss = this.currentBoss;
    if (!boss) return;
    if (boss.isAlive()) {
      for (const part of boss.getCollisionParts()) {
        out.push(this.getPartTarget(boss, part));
      }
      if (this.currentBossType === BossType.OCTOPUS_WARSHIP && this.isOctopusWarshipBoss(boss)) {
        for (const eye of boss.getEyeCollisionParts()) {
          out.push(this.getEyeTarget(boss, eye.mesh, eye.index));
        }
      }
    }
    const missileSystem = boss.getMissileSystem();
    if (missileSystem) {
      for (const missile of missileSystem.getMissiles()) {
        out.push(this.getMissileTarget(missile));
      }
    }
  }

  /**
   * 锁定候选：可受伤的部件（跳过护盾偏转体 / 倍率为 0 的部件 / 水雷等危险物），
   * 隐形的幻影之翼不提供；Boss 导弹照常可锁定拦截。
   */
  public appendLockTargets(out: Object3D[]): void {
    const boss = this.currentBoss;
    if (!boss) return;
    const advanced = this.advancedBoss;
    if (boss.isAlive() && !(advanced?.isCloaked?.() ?? false)) {
      for (const part of boss.getCollisionParts()) {
        if (part.userData.bossDeflector === true || part.userData.bossHazardTarget === true) {
          continue;
        }
        if (advanced && advanced.getDamageMultiplier(part) <= 0 && part.userData.bossDecoy !== true) {
          continue;
        }
        out.push(part);
      }
    }
    const missileSystem = boss.getMissileSystem();
    if (missileSystem) {
      for (const mesh of missileSystem.getMissileMeshes()) out.push(mesh);
    }
  }

  /** 子目标血条（护盾塔、气囊、散热口……），已摧毁的不显示 */
  public appendSubTargetBars(
    out: Array<{ mesh: Object3D; currentHealth: number; maxHealth: number }>
  ): void {
    const boss = this.advancedBoss;
    if (!boss || !boss.isAlive() || (boss.isCloaked?.() ?? false)) return;
    const subTargets: BossSubTarget[] = boss.getSubTargets?.() ?? [];
    for (const sub of subTargets) {
      if (sub.current <= 0) continue;
      out.push({ mesh: sub.mesh, currentHealth: sub.current, maxHealth: sub.max });
    }
  }

  /**
   * EMP 脉冲：幻影之翼（隐形时没有可命中部件）走 applyEmpPulse；半径内的 Boss 导弹被摧毁。
   * 其他 Boss 的瘫痪由特殊武器系统对部件目标调用 applyStun 完成。
   */
  public applyEmp(center: Vector3, radius: number, seconds: number): void {
    const boss = this.currentBoss;
    if (!boss) return;
    this.advancedBoss?.applyEmpPulse?.(center, radius, seconds);
    const missileSystem = boss.getMissileSystem();
    if (!missileSystem) return;
    for (const missile of missileSystem.getMissiles()) {
      if (missile.getMesh().position.distanceTo(center) <= radius) {
        missile.takeDamage(BOSS_MISSILE_CONFIG.HEALTH * 5);
      }
    }
  }

  private getPartTarget(boss: ActiveBoss, part: Object3D): CombatTarget {
    const cached = this.partTargets.get(part);
    if (cached) return cached;
    const target: CombatTarget = {
      id: part.uuid,
      mesh: part,
      faction: Faction.ENEMY,
      kind: 'boss-part',
      hitRadius: getDeclaredHitRadius(part, 5),
      isAlive: () =>
        this.currentBoss === boss &&
        boss.isAlive() &&
        part.visible &&
        (this.advancedBoss ? this.currentParts.has(part) : true),
      applyDamage: (amount: number, source: DamageSource, hitPoint?: Vector3) =>
        this.applySpecialWeaponDamage(boss, part, amount, source, hitPoint),
      applyStun: (seconds: number) => this.stunBossOncePerFrame(boss, seconds),
    };
    this.partTargets.set(part, target);
    return target;
  }

  private getEyeTarget(boss: OctopusWarshipAI, mesh: Object3D, index: number): CombatTarget {
    const cached = this.partTargets.get(mesh);
    if (cached) return cached;
    const target: CombatTarget = {
      id: mesh.uuid,
      mesh,
      faction: Faction.ENEMY,
      kind: 'boss-part',
      hitRadius: 5,
      isAlive: () => this.currentBoss === boss && boss.isAlive() && mesh.visible,
      applyDamage: (amount: number) => boss.takeEyeDamage(index, amount),
    };
    this.partTargets.set(mesh, target);
    return target;
  }

  private getMissileTarget(missile: BossMissile): CombatTarget {
    const cached = this.missileTargets.get(missile);
    if (cached) return cached;
    const target: CombatTarget = {
      id: missile.getMesh().uuid,
      mesh: missile.getMesh(),
      faction: Faction.ENEMY,
      kind: 'projectile',
      hitRadius: 2 + BOSS_MISSILE_CONFIG.SCALE * 0.5,
      isAlive: () => missile.active,
      applyDamage: (amount: number) => missile.takeDamage(amount),
    };
    this.missileTargets.set(missile, target);
    return target;
  }

  private applySpecialWeaponDamage(
    boss: ActiveBoss,
    part: Object3D,
    amount: number,
    _source: DamageSource,
    hitPoint?: Vector3
  ): void {
    if (this.currentBoss !== boss || !boss.isAlive()) return;
    if (this.advancedBoss === boss) {
      const at = hitPoint ?? part.getWorldPosition(this.hitWorldPosition);
      this.damageAdvancedPart(this.advancedBoss, part, amount, at, amount >= 40);
      return;
    }
    boss.takeDamage(amount);
  }

  /** 同一帧内多个部件被 EMP 波及时只瘫痪一次 */
  private stunBossOncePerFrame(boss: ActiveBoss, seconds: number): void {
    if (this.stunFrame === this.frameCounter || this.currentBoss !== boss) return;
    this.stunFrame = this.frameCounter;
    const stunnable = boss as Partial<{ applyStun(seconds: number): void }>;
    stunnable.applyStun?.(seconds);
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
        const isPlayerTarget = target === this.deps.playerAircraft;
        const hitProfile: 'player' | 'enemy' | 'boss' = isPlayerTarget ? 'player' : 'enemy';

        this.deps.particleSystem.createBossMissileExplosion(target.position.clone(), 1.15);
        this.deps.audioManager.playMissileExplosion(isPlayerTarget ? 'player' : 'enemy');
        this.createWeaponHitFeedback(
          target.position,
          isPlayerTarget ? 1.22 : 0.98,
          'boss-cannon',
          isPlayerTarget ? 0.96 : 0.82,
          hitProfile
        );
        if (isPlayerTarget) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.takeCombatDamage(BOSS_MISSILE_CONFIG.DAMAGE, {
              suppressDefaultFeedback: true,
            });
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
        this.createArmorHitFeedback(impactPosition, 1.14, true);
        this.deps.particleSystem.createMissileImpact(impactPosition, 1.25);
        this.deps.audioManager.playMissileExplosion('enemy');
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
        this.createArmorHitFeedback(hitWorldPos, 0.98);
      });
    }

    const missileTargets = [this.currentBoss.getMesh(), ...bossParts, ...missileMeshes];
    this.deps.combatSystem.getMissileSystem().checkCollisions(missileTargets, (target, impactPosition) => {
      const hitWorldPos = impactPosition.clone();
      const isBossPart = bossParts.includes(target);

      if (target === this.currentBoss?.getMesh() || isBossPart) {
        this.currentBoss?.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
        this.createArmorHitFeedback(hitWorldPos, 1.18, true);
        this.deps.particleSystem.createMissileImpact(hitWorldPos, 1.55);
        this.deps.audioManager.playMissileExplosion('enemy');
        return;
      }

      const missile = bossMissileSystem?.getMissiles().find((candidate) => candidate.getMesh() === target);
      if (missile) {
        missile.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
        this.createBossMissileDestroyedFeedback(hitWorldPos, 0.92, 'enemy');
      }
    });

    const bossTargets = [...bossParts, ...missileMeshes];
    this.deps.combatSystem.getPlayerProjectilePool().checkCollisions(bossTargets, (target) => {
      const isBossPart = bossParts.includes(target);
      if (isBossPart || target === this.currentBoss?.getMesh()) {
        this.currentBoss?.takeDamage(this.deps.combatSystem.getDamageMultiplier() * 12.5);
        const hitWorldPos = new Vector3();
        target.getWorldPosition(hitWorldPos);
        this.createArmorHitFeedback(hitWorldPos, 0.92);
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
          this.createArmorHitFeedback(hitWorldPos, Math.max(0.88, damage / 16));
          return;
        }

        const missile = bossMissileSystem?.getMissiles().find((candidate) => candidate.getMesh() === target);
        if (missile) {
          missile.takeDamage(damage);
          this.createBossMissileDestroyedFeedback(target.position, 0.72, 'enemy');
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
        this.deps.playerSystem.takeCombatDamage(boss.getConfig().damage, {
          suppressDefaultFeedback: true,
        });
        this.createWeaponHitFeedback(
          playerPosition,
          Math.max(1.08, boss.getConfig().damage / 18),
          'laser',
          Math.max(0.82, boss.getConfig().damage / 30),
          'player'
        );
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
        this.createArmorHitFeedback(hitWorldPos, 0.95);
      });

    const eyeBulletCollideRadius = 5;
    for (const bulletMesh of eyeBulletMeshes) {
      const bulletPosition = bulletMesh.position;
      const currentPlayerPosition = this.deps.playerSystem.getPosition();
      if (bulletPosition.distanceTo(currentPlayerPosition) < eyeBulletCollideRadius) {
        if (!this.deps.playerSystem.isShieldActive()) {
          this.deps.playerSystem.takeCombatDamage(boss.getEyeDamage(), {
            suppressDefaultFeedback: true,
          });
          this.createWeaponHitFeedback(
            currentPlayerPosition,
            Math.max(0.98, boss.getEyeDamage() / 18),
            'boss-cannon',
            Math.max(0.8, boss.getEyeDamage() / 32),
            'player'
          );
        }
        this.createHeavyDamageFeedback(bulletPosition, 0.94, 'boss-cannon');
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
          this.createWeaponHitFeedback(
            friendlyPosition,
            Math.max(0.9, boss.getEyeDamage() / 24),
            'boss-cannon',
            Math.max(0.75, boss.getEyeDamage() / 36),
            'enemy'
          );
          this.createHeavyDamageFeedback(bulletPosition, 0.84, 'boss-cannon');
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

    let closestDistance = Infinity;
    for (let i = 0; i < snapshotCount; i++) {
      const distance = this.bossIndicatorSnapshots[i].distance;
      if (distance < closestDistance) {
        closestDistance = distance;
      }
    }
    if (Number.isFinite(closestDistance)) {
      this.deps.audioManager.playIncomingWarning(closestDistance);
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
    if (!this.defeatAnnounced) {
      this.defeatAnnounced = true;
      this.deps.presentation.radio('boss-defeated', this.currentLevel);
    }
    this.deps.presentation.setBossStatus(null);
    this.syncCitadelCore('offline');
    this.resetAdvancedState();
    if (this.currentBoss) {
      const missileSystem = this.currentBoss.getMissileSystem();
      missileSystem?.dispose();
      this.disposeBossSpecificSystems(this.currentBoss, this.currentBossType);
      this.currentBoss.dispose();
      this.currentBoss = null;
    }
    this.currentBossType = null;
    this.scheduleBossDeathAftershocks(position, config);
    this.deps.onBossDestroyed(position, config, isBossMode);
  }

  private createDamageFeedback(
    position: Vector3,
    intensity: number = 1,
    profile: 'player' | 'enemy' | 'boss' = 'boss',
    hitTone: 'bullet' | 'missile' | 'heavy' | 'flak' | 'environment' = 'bullet'
  ): void {
    this.deps.particleSystem.createHit(position, intensity, profile);
    this.deps.audioManager.playHit(intensity, profile, hitTone);
  }

  private createHeavyDamageFeedback(
    position: Vector3,
    intensity: number = 1,
    profile: 'boss-cannon' | 'laser' | 'flak-hit' | 'boss-armor' = 'boss-cannon'
  ): void {
    const clampedIntensity = Math.max(0.75, Math.min(2.2, intensity));
    this.deps.particleSystem.createHeavyWeaponImpact(position, clampedIntensity, profile);
    this.deps.audioManager.playHeavyWeaponImpact(profile, clampedIntensity);
  }

  private createWeaponHitFeedback(
    position: Vector3,
    heavyIntensity: number,
    weaponProfile: 'boss-cannon' | 'laser' | 'flak-hit' | 'boss-armor',
    hitIntensity: number,
    hitProfile: 'player' | 'enemy' | 'boss'
  ): void {
    this.createHeavyDamageFeedback(position, heavyIntensity, weaponProfile);
    const hitTone = weaponProfile === 'flak-hit' ? 'flak' : weaponProfile === 'laser' ? 'bullet' : 'heavy';
    this.createDamageFeedback(position, hitIntensity, hitProfile, hitTone);
  }

  private createArmorHitFeedback(
    position: Vector3,
    heavyIntensity: number,
    withHitLayer: boolean = false
  ): void {
    this.createHeavyDamageFeedback(position, heavyIntensity, 'boss-armor');
    if (withHitLayer) {
      this.createDamageFeedback(
        position,
        Math.max(0.9, heavyIntensity * 0.86),
        'boss',
        'heavy'
      );
    }
  }

  private getTargetHitProfile(target: Object3D): 'player' | 'enemy' {
    return target === this.deps.playerAircraft ? 'player' : 'enemy';
  }

  private scheduleBossDeathAftershocks(position: Vector3, config: BossConfig): void {
    const firstImpactPos = position.clone();
    const secondImpactPos = position.clone();
    const intensity = Math.max(0.9, Math.min(1.65, config.scale * 0.2));

    this.deps.scheduleTimeout(() => {
      this.createHeavyDamageFeedback(firstImpactPos, intensity, 'boss-armor');
    }, 140);

    this.deps.scheduleTimeout(() => {
      this.createHeavyDamageFeedback(secondImpactPos, intensity * 0.88, 'boss-cannon');
    }, 300);
  }

  private createBossMissileDestroyedFeedback(
    position: Vector3,
    scale: number,
    sourceProfile: 'player' | 'enemy' | 'boss' = 'enemy'
  ): void {
    const worldPos = position.clone();
    this.deps.particleSystem.createBossMissileExplosion(worldPos, scale);
    this.deps.audioManager.playMissileExplosion(sourceProfile);
    this.createHeavyDamageFeedback(worldPos, Math.max(0.78, scale), 'boss-cannon');
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
