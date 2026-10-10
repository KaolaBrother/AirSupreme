import { Vector3 } from 'three';
import type { Object3D, Scene } from 'three';
import {
  LevelConfig,
  LevelWaveEventType,
  getLevelConfig,
  type LevelWaveConfig,
} from '@/features/terrain/LevelConfig';
import {
  EnemyConfig,
  EnemyType,
  ENEMY_CONFIGS,
  isEliteEnemyType,
} from '@/features/enemy/EnemyTypes';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { createJetDoctrine } from '@/features/enemy/doctrine/createJetDoctrine';
import { WORLDSCAPE_WATER_Y, type TerrainGenerator } from '@/features/terrain/TerrainGenerator';
import type {
  TerrainEnvironment,
  TerrainSurfaceKind,
  TerrainSurfaceSample,
} from '@/features/terrain/environments/TerrainEnvironment';
import type { SpawnPortal } from '@/features/effects/SpawnPortal';
import { createEnemyMesh, updateAircraftSignals } from '@/features/aircraft/AircraftMeshFactory';
import { getLogger } from '@/core/utils/Logger';
import { getLevelScaling, type DifficultyProfile } from '@/core/Difficulty';
import { GameConfig, GAME_CONSTANTS } from '@/config';
import {
  DEFAULT_ONBOARDING_BEAT_PROFILE,
  getWaveOnboardingBeat,
  type OnboardingWaveBeatProfile,
} from '@/ui/OnboardingManager';
import {
  TRAIL_SPAWN_INTERVAL,
  WAVE_GROUP_DISTANCE_RANGE,
  WAVE_GROUP_MIN_DISTANCE,
  planWaveGroupCenters,
  type IWaveGroupCenter,
} from './WaveArrival';

const log = getLogger('LevelManager');

/** 敌机出生点相对地表的最小高度（米），避免在峡谷岩壁 / 火山 / 天梯立柱内部生成 */
const SPAWN_TERRAIN_CLEARANCE = 45;
/** 群内散布半径（米，与 getSpawnPosition 一致）：群中心离边界至少这么远 */
const WAVE_GROUP_SPREAD = 60;
/** 玩家位置单步变化折算速度超过该值（米/秒）视为瞬移，不用于提前量 */
const PLAYER_TELEPORT_SPEED = 250;
/** 条令开火节奏倍率（难度档 × 关卡曲线的冷却倍率）的允许范围 */
const MIN_CADENCE_SCALE = 0.5;
const MAX_CADENCE_SCALE = 2.5;

export enum LevelState {
  IDLE = 'IDLE',
  WAVE_ACTIVE = 'WAVE_ACTIVE',
  WAVE_COMPLETE = 'WAVE_COMPLETE',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
}

export interface WaveProgressSnapshot {
  wave: number;
  maxEnemies: number;
  spawnedInWave: number;
  aliveInWave: number;
  remainingInWave: number;
  eventType: LevelWaveEventType | null;
  state: LevelState;
  nextWaveDelaySeconds: number;
  onboardingBeat: OnboardingWaveBeatProfile;
}

/**
 * 关卡管理器
 */
export class LevelManager {
  private scene: Scene;
  private terrainGenerator: TerrainGenerator | null = null;
  private terrainGeneratorPromise: Promise<TerrainGenerator> | null = null;
  private spawnPortalModulePromise: Promise<
    typeof import('@/features/effects/SpawnPortal')
  > | null = null;
  private terrainLoadSequence: number = 0;
  private terrainReadyPromise: Promise<void> = Promise.resolve();

  // 战斗区域边界
  private combatBounds: {
    maxHeight: number;
    minHeight: number;
    horizontalDistance: number;
  } = {
    maxHeight: 150, // 最大高度（敌人不能超过）
    minHeight: -20, // 最小高度（敌人不能低于）
    horizontalDistance: GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT, // 水平边界（离战场中心的距离）
  };

  // 战场边界常量（随全局战场尺寸缩放）
  private readonly BATTLEFIELD_MAX = GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT;
  private readonly BATTLEFIELD_MIN = -GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT;

  private currentLevel: LevelConfig | null = null;
  private currentWave: number = 0;
  private state: LevelState = LevelState.IDLE;

  // 敌人管理
  private enemies: EnemyAI[] = [];
  private enemyPool: EnemyAI[] = [];
  private enemiesSpawnedThisWave: number = 0;
  private totalEnemiesSpawned: number = 0; // 总共已生成的敌人数量

  // 传送门管理
  private activePortals: SpawnPortal[] = [];

  // 计时器
  private spawnTimer: number = 0;
  private spawnInterval: number = 0.5; // 敌人生成间隔（秒）
  private waveDelayTimer: number = 0; // 波次延迟计时器
  /** 当前波次各路敌机群的中心（一群 / 鱼贯是一个，夹击是两个）；waveGroupCount = 0 表示还没算过 */
  private readonly waveGroupCenters: IWaveGroupCenter[] = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
  private waveGroupCount: number = 0;
  /** 已经点名出场、还在传送门里没有现身的“精英歼灭”名单敌机数 */
  private pendingEliteDeploys: number = 0;
  private currentWaveEvent: LevelWaveEventType | null = null;
  private difficultyProfile: DifficultyProfile | null = null;
  private currentWaveBeatProfile: OnboardingWaveBeatProfile = DEFAULT_ONBOARDING_BEAT_PROFILE;

  /** 开发钩子：暂停常规波次（不生成、不结算、不进入下一波），在场敌机照常飞 */
  private waveSpawningHeld = false;

  /** 额外的“未清场”数量（如存活的敌方地面 / 海上单位）：大于 0 时波次不会完成 */
  private waveHoldProvider: (() => number) | null = null;
  /** 敌机生成时叠加的命中精度加成（如敌方雷达站存活） */
  private accuracyBonusProvider: (() => number) | null = null;
  /** 地形高度采样（传给敌机做避让）；地形未加载时回落到水面 */
  private readonly terrainHeightSampler = (x: number, z: number): number =>
    this.getCrashSurfaceY(x, z);
  /** 地形尚未加载时 getSurfaceSample 的回退值（惰性创建：模块导入期不读取地形常量） */
  private fallbackSurfaceSample: TerrainSurfaceSample | null = null;
  /** 玩家速度估计（逐步差分 + 轻度平滑），供敌机计算射击提前量 */
  private readonly playerVelocity = new Vector3();
  private readonly lastPlayerPosition = new Vector3();
  private readonly playerStep = new Vector3();
  private hasLastPlayerPosition = false;

  // 回调
  public onWaveStart?: (wave: number) => void;
  public onWaveEventStart?: (eventType: LevelWaveEventType, wave: number) => void;
  public onWaveComplete?: (wave: number) => void;
  public onLevelComplete?: (level: number) => void;
  public onEnemySpawned?: (enemy: EnemyAI) => void;
  public onEnemyKilled?: (enemy: EnemyAI) => void;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private ensureTerrainGenerator(): Promise<TerrainGenerator> {
    if (this.terrainGenerator) {
      return Promise.resolve(this.terrainGenerator);
    }

    if (!this.terrainGeneratorPromise) {
      this.terrainGeneratorPromise = import('@/features/terrain/TerrainGenerator').then(
        ({ TerrainGenerator }) => {
          if (!this.terrainGenerator) {
            this.terrainGenerator = new TerrainGenerator(this.scene);
          }

          return this.terrainGenerator;
        }
      );
    }

    return this.terrainGeneratorPromise;
  }

  private initializeTerrain(config: LevelConfig): void {
    const loadSequence = ++this.terrainLoadSequence;
    this.terrainReadyPromise = this.ensureTerrainGenerator()
      .then((terrainGenerator) => {
        if (this.currentLevel?.id !== config.id || loadSequence !== this.terrainLoadSequence) {
          return;
        }

        terrainGenerator.generateTerrain(config);
      })
      .catch((error: unknown) => {
        log.error('Terrain generator load failed', { error, levelId: config.id });
      });
  }

  /**
   * 当前关卡地形生成完毕（地形分块按需加载，换关后在下一个微任务才生成）。
   * 期间又切换了关卡时继续等待最新一次加载，保证返回时采样对应当前关卡。
   */
  public async whenTerrainReady(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.terrainReadyPromise;
      await pending;
    } while (pending !== this.terrainReadyPromise);
  }

  private ensureSpawnPortalModule(): Promise<typeof import('@/features/effects/SpawnPortal')> {
    if (!this.spawnPortalModulePromise) {
      this.spawnPortalModulePromise = import('@/features/effects/SpawnPortal');
    }

    return this.spawnPortalModulePromise;
  }

  /**
   * 加载关卡
   */
  public loadLevel(levelId: number, startWave: number = 0): void {
    const config = getLevelConfig(levelId);
    if (!config) {
      log.error('Level not found', { levelId });
      return;
    }

    this.currentLevel = config;
    // 读档续玩：从指定波次开始；之前波次的敌机计入“已生成”，保证 HUD 剩余数正确
    const resumeWave = Number.isFinite(startWave)
      ? Math.max(0, Math.min(config.totalWaves - 1, Math.floor(startWave)))
      : 0;
    this.currentWave = resumeWave;
    this.state = LevelState.IDLE;
    this.waveDelayTimer = 0;
    this.totalEnemiesSpawned = config.enemiesPerWave
      .slice(0, resumeWave)
      .reduce((sum, count) => sum + count, 0);
    this.enemiesSpawnedThisWave = 0;
    this.spawnInterval = 0.5;
    this.currentWaveEvent = null;
    this.currentWaveBeatProfile = DEFAULT_ONBOARDING_BEAT_PROFILE;
    this.resetPlayerVelocity();

    log.info('Loading level', { levelId, name: config.name, terrain: config.terrain });

    this.initializeTerrain(config);
    void this.ensureSpawnPortalModule();

    log.info('Level loaded', { levelId, name: config.name });
  }

  public setDifficultyProfile(profile: DifficultyProfile): void {
    this.difficultyProfile = profile;
  }

  public getCurrentLevelConfig(): LevelConfig | null {
    return this.currentLevel;
  }

  /**
   * 限制坐标在战场范围内
   */
  private clampToBattlefield(value: number): number {
    return Math.max(this.BATTLEFIELD_MIN, Math.min(this.BATTLEFIELD_MAX, value));
  }

  /**
   * 按本波的到场方式算出各路群中心（WaveArrival）：距玩家 600-800 米，
   * 整群（含 60 米散布）落在战场范围内；夹击的两路从玩家看相隔 90-150°。
   */
  private planWaveGroups(playerPosition: Vector3): void {
    const arrival = this.getCurrentWaveConfig()?.arrival ?? 'group';
    this.waveGroupCount = planWaveGroupCenters(
      arrival,
      playerPosition.x,
      playerPosition.z,
      this.BATTLEFIELD_MAX - WAVE_GROUP_SPREAD,
      Math.random,
      this.waveGroupCenters
    );
  }

  /** 当前波次的编成（谁来、怎么来）；关卡未加载或波次越界时为 null */
  public getCurrentWaveConfig(): LevelWaveConfig | null {
    return this.currentLevel?.waves[this.currentWave] ?? null;
  }

  /** 当前波次各路群中心的副本（开发钩子 / 验收用；尚未开场时为空） */
  public getWaveGroupCenters(): IWaveGroupCenter[] {
    const centers: IWaveGroupCenter[] = [];
    for (let i = 0; i < this.waveGroupCount; i++) {
      centers.push({ x: this.waveGroupCenters[i].x, z: this.waveGroupCenters[i].z });
    }
    return centers;
  }

  /**
   * 开始当前波次
   * @param playerPosition 玩家位置（第一次调用时必需，用于计算群中心）
   * @param isNextWave 是否是下一波（波次完成后的开始）
   */
  public startWave(playerPosition?: Vector3, isNextWave: boolean = false): void {
    if (!this.currentLevel) return;

    // 第一次调用：设置第一波（读档时可能从第 N 波开始）
    if (this.state === LevelState.IDLE && playerPosition && !isNextWave) {
      // 计算并保存第一波各路的敌人群中心（确保在战场内）
      this.planWaveGroups(playerPosition);

      this.state = LevelState.WAVE_ACTIVE;
      this.enemiesSpawnedThisWave = 0;
      this.currentWaveEvent = this.resolveWaveEvent();
      this.currentWaveBeatProfile = getWaveOnboardingBeat(this.currentWave, this.currentWaveEvent);
      this.spawnInterval = this.getWaveSpawnInterval();
      this.spawnTimer = this.getInitialSpawnTimer();
      this.onWaveStart?.(this.currentWave);
      if (this.currentWaveEvent) {
        this.onWaveEventStart?.(this.currentWaveEvent, this.currentWave);
      }

      // 清理已死亡的敌人（调用 dispose 清理尾迹和资源）
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (!enemy.isAlive()) {
          enemy.dispose();
          this.enemies.splice(i, 1);
        }
      }
      return;
    }

    // 后续调用：由波次完成后的 startNextWave 触发
    // 允许从 IDLE 或 WAVE_COMPLETE 状态转换到 WAVE_ACTIVE
    if (this.state !== LevelState.IDLE && this.state !== LevelState.WAVE_COMPLETE) return;

    this.state = LevelState.WAVE_ACTIVE;
    this.enemiesSpawnedThisWave = 0;
    this.currentWaveEvent = this.resolveWaveEvent();
    this.currentWaveBeatProfile = getWaveOnboardingBeat(this.currentWave, this.currentWaveEvent);
    this.spawnInterval = this.getWaveSpawnInterval();
    this.spawnTimer = this.getInitialSpawnTimer();
    this.onWaveStart?.(this.currentWave);
    if (this.currentWaveEvent) {
      this.onWaveEventStart?.(this.currentWaveEvent, this.currentWave);
    }

    // 清理已死亡的敌人（调用 dispose 清理尾迹和资源）
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isAlive()) {
        enemy.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * 生成敌人（保留传送门，但完成后立即出现）：
   * 机型取本波编成里的下一架（不随机选型），出生在它那一路的群中心附近。
   */
  private spawnEnemy(playerPosition: Vector3): void {
    if (!this.currentLevel) return;

    const slot = this.enemiesSpawnedThisWave;
    // 立即递增生成计数（防止重复生成）
    this.enemiesSpawnedThisWave++;
    this.totalEnemiesSpawned++; // 总已生成敌人计数

    const waveConfig = this.getCurrentWaveConfig();
    // 编成里没有这一架（配置缺失）时退回侦察机
    const enemyType = waveConfig?.lineup[slot] ?? EnemyType.SCOUT;
    const side = waveConfig?.arrival === 'pincer' ? (waveConfig.sides?.[slot] ?? 0) : 0;
    // 同一路的敌机共用一个编组号（干扰机据此找“自己那一路”）
    const groupId = this.currentWave * 2 + side + 1;

    // 获取生成位置
    const spawnPosition = this.getSpawnPosition(playerPosition, side);

    const elite = isEliteEnemyType(enemyType);
    if (elite) this.pendingEliteDeploys++;

    const deploy = (): void => {
      if (elite) this.pendingEliteDeploys = Math.max(0, this.pendingEliteDeploys - 1);
      const enemy = this.getOrCreateEnemy(enemyType);
      enemy.reset(spawnPosition);
      enemy.setGroupId(groupId);
      enemy.getMesh().visible = true;
      this.onEnemySpawned?.(enemy);
    };

    void this.ensureSpawnPortalModule()
      .then(({ SpawnPortal }) => {
        const portal = new SpawnPortal(spawnPosition, deploy);

        this.scene.add(portal.getMesh());
        this.activePortals.push(portal);
      })
      .catch((error: unknown) => {
        log.error('Spawn portal module load failed', { error });
        deploy();
      });
  }

  /**
   * 更新关卡管理器
   */
  public update(deltaTime: number, playerPosition: Vector3, friendlyMeshes?: Object3D[]): void {
    // 更新传送门动画（开发钩子暂停波次时一并冻结：已经打开的传送门不再放出敌机）
    const portalCount = this.waveSpawningHeld ? 0 : this.activePortals.length;
    for (let i = portalCount - 1; i >= 0; i--) {
      const portal = this.activePortals[i];
      portal.update(deltaTime);

      // 移除已完成的传送门
      if (portal.isFinished()) {
        portal.dispose();
        this.activePortals.splice(i, 1);
      }
    }

    // 更新波次延迟
    if (!this.waveSpawningHeld && this.waveDelayTimer > 0 && this.currentLevel) {
      this.waveDelayTimer -= deltaTime;
      if (this.waveDelayTimer <= 0) {
        // 检查是否还有下一波（当前波次索引 + 1 >= 总波次数）
        if (this.currentWave + 1 >= this.currentLevel.totalWaves) {
          this.state = LevelState.LEVEL_COMPLETE;
          log.info('Level complete', { levelId: this.currentLevel.id });
          this.onLevelComplete?.(this.currentLevel.id);
        } else {
          // 开始下一波
          this.startNextWave(playerPosition);
        }
      }
    }

    this.trackPlayerVelocity(deltaTime, playerPosition);

    // 生成敌人
    if (!this.waveSpawningHeld && this.state === LevelState.WAVE_ACTIVE && this.currentLevel) {
      const maxEnemies = this.currentLevel.enemiesPerWave[this.currentWave] || 0;
      const aliveEnemies = this.enemies.filter((e) => e.isAlive()).length;
      const maxConcurrentEnemies = this.getMaxConcurrentEnemies();

      // 只要还没达到最大生成数量，就继续生成
      if (this.enemiesSpawnedThisWave < maxEnemies && aliveEnemies < maxConcurrentEnemies) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnEnemy(playerPosition);
        }
      } else if (
        this.activePortals.length === 0 &&
        aliveEnemies === 0 &&
        this.enemiesSpawnedThisWave >= maxEnemies &&
        this.getWaveHoldCount() === 0
      ) {
        log.debug('Wave complete', { wave: this.currentWave });
        this.state = LevelState.WAVE_COMPLETE;
        this.enemiesSpawnedThisWave = 0;
        this.waveDelayTimer = this.currentLevel.waveInterval;
        this.onWaveComplete?.(this.currentWave);
      }
    }

    // 更新敌人
    const leadVelocity = this.hasLastPlayerPosition ? this.playerVelocity : null;
    for (const enemy of this.enemies) {
      enemy.setTargetVelocity(leadVelocity);
      enemy.update(deltaTime, playerPosition, friendlyMeshes, playerPosition);
    }

    // 清理已死亡的敌人（从场景中移除，清理尾迹）
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isAlive()) {
        enemy.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * 玩家速度估计：位置逐步差分，按约 0.1 秒时间常数平滑；
   * 瞬移（复活 / 读档 / 开发工具摆位）或非有限值时清零重来。
   */
  private trackPlayerVelocity(deltaTime: number, playerPosition: Vector3): void {
    if (
      !(deltaTime > 0) ||
      !Number.isFinite(playerPosition.x) ||
      !Number.isFinite(playerPosition.y) ||
      !Number.isFinite(playerPosition.z)
    ) {
      return;
    }
    if (this.hasLastPlayerPosition) {
      this.playerStep.subVectors(playerPosition, this.lastPlayerPosition).divideScalar(deltaTime);
      if (this.playerStep.lengthSq() < PLAYER_TELEPORT_SPEED * PLAYER_TELEPORT_SPEED) {
        this.playerVelocity.lerp(this.playerStep, Math.min(1, deltaTime * 10));
      } else {
        this.playerVelocity.set(0, 0, 0);
      }
    }
    this.lastPlayerPosition.copy(playerPosition);
    this.hasLastPlayerPosition = true;
  }

  private resetPlayerVelocity(): void {
    this.playerVelocity.set(0, 0, 0);
    this.hasLastPlayerPosition = false;
  }

  /** 同时在场的敌机上限：设备基础值（GameConfig）+ 关卡曲线加成（后期同时来袭更多） */
  public getMaxConcurrentEnemies(): number {
    const bonus = getLevelScaling(this.currentLevel?.id ?? 1).concurrentEnemyBonus;
    return Math.max(1, GameConfig.getMaxEnemies() + (Number.isFinite(bonus) ? bonus : 0));
  }

  /**
   * 更新纯视觉环境动画，跟随渲染帧而不是固定玩法步长。
   */
  public updateVisuals(deltaTime: number, playerPosition: Vector3): void {
    // 飞机信号灯（航行灯/频闪灯/引擎尾焰）使用共享材质，每帧推进一次即可作用于所有机体
    updateAircraftSignals(deltaTime);

    const terrainGenerator = this.terrainGenerator;
    if (!terrainGenerator) {
      return;
    }

    terrainGenerator.update(deltaTime);
    terrainGenerator.updateLOD(playerPosition);
  }

  /**
   * 获取敌人列表
   */
  public getEnemies(): EnemyAI[] {
    return this.enemies;
  }

  /** 传送门世界坐标，供雷达绘制生成中光点 */
  public getActivePortalPositions(): Vector3[] {
    return this.activePortals.map((portal) => portal.getMesh().position);
  }

  /**
   * 检查敌人是否正在生成（传送门动画中）
   */
  public isEnemySpawning(enemy: EnemyAI): boolean {
    // 检查是否有活跃传送门在敌人位置附近
    const enemyPos = enemy.getPosition();
    const hasPortalNearby = this.activePortals.some((portal) => {
      const portalPos = portal.getMesh().position;
      return portalPos.distanceTo(enemyPos) < 1; // 1单位内认为是同一个位置
    });

    // 如果没有传送门附近，检查敌人网格是否不可见（刚创建还未显示）
    const mesh = enemy.getMesh();
    const isInvisible = mesh && !mesh.visible;

    return hasPortalNearby || isInvisible;
  }

  /**
   * 玩家坠毁判定用的活地形/水面世界 Y。地形未加载时回落到水面高度。
   */
  public getCrashSurfaceY(worldX: number, worldZ: number): number {
    if (this.terrainGenerator) {
      return this.terrainGenerator.getCrashSurfaceY(worldX, worldZ);
    }
    return WORLDSCAPE_WATER_Y;
  }

  /**
   * 地表采样（地面单位 / 舰船 / Boss 落脚 / 命中特效）：委托 TerrainGenerator.sampleSurface；
   * 地形分块尚未加载时回落到 { y: WORLDSCAPE_WATER_Y, water: false }。
   */
  public getSurfaceSample(worldX: number, worldZ: number): TerrainSurfaceSample {
    if (this.terrainGenerator) {
      return this.terrainGenerator.sampleSurface(worldX, worldZ);
    }
    this.fallbackSurfaceSample ??= { y: WORLDSCAPE_WATER_Y, water: false };
    this.fallbackSurfaceSample.y = WORLDSCAPE_WATER_Y;
    this.fallbackSurfaceSample.water = false;
    return this.fallbackSurfaceSample;
  }

  /** 地表材质（命中特效 / 音效选型）；地形未加载时回落到 'ground' */
  public getSurfaceKind(worldX: number, worldZ: number): TerrainSurfaceKind {
    if (this.terrainGenerator) {
      return this.terrainGenerator.getSurfaceKind(worldX, worldZ);
    }
    return 'ground';
  }

  /** 第 6-10 关的环境模块（CANYON 航线、CITADEL 决战区等扩展）；其余关卡或未加载时为 null */
  public getTerrainEnvironment(): TerrainEnvironment | null {
    return this.terrainGenerator?.getEnvironment() ?? null;
  }

  /** 地形是否已为当前关卡生成（采样结果可信） */
  public isTerrainReady(): boolean {
    return this.terrainGenerator !== null;
  }

  /** 设置额外的未清场计数（如存活敌方单位）；为 null 时只看敌机 */
  public setWaveHoldProvider(provider: (() => number) | null): void {
    this.waveHoldProvider = typeof provider === 'function' ? provider : null;
  }

  /** 设置敌机命中精度加成来源（生成时读取） */
  public setAccuracyBonusProvider(provider: (() => number) | null): void {
    this.accuracyBonusProvider = typeof provider === 'function' ? provider : null;
  }

  private getWaveHoldCount(): number {
    if (!this.waveHoldProvider) return 0;
    const count = this.waveHoldProvider();
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  /** 当前波次的敌机是否全部清空（不含额外的未清场单位） */
  public areWaveJetsCleared(): boolean {
    if (!this.currentLevel || this.state !== LevelState.WAVE_ACTIVE) return false;
    const maxEnemies = this.currentLevel.enemiesPerWave[this.currentWave] || 0;
    return (
      this.activePortals.length === 0 &&
      this.enemiesSpawnedThisWave >= maxEnemies &&
      this.getAliveEnemyCount() === 0
    );
  }

  /** 当前波次序号（0 基） */
  public getCurrentWaveIndex(): number {
    return this.currentWave;
  }

  public getState(): LevelState {
    return this.state;
  }

  /**
   * 获取活着的敌人数量
   */
  public getAliveEnemyCount(): number {
    return this.enemies.filter((e) => e.isAlive()).length;
  }

  /**
   * 获取总共已生成的敌人数量
   */
  public getSpawnedEnemyCount(): number {
    return this.totalEnemiesSpawned;
  }

  /**
   * 获取当前关卡总敌人数量
   */
  public getTotalEnemyCount(): number {
    if (!this.currentLevel) return 0;
    return this.currentLevel.enemiesPerWave.reduce((sum, count) => sum + count, 0);
  }

  public getCurrentWaveEvent(): LevelWaveEventType | null {
    return this.currentWaveEvent;
  }

  public getWaveProgressSnapshot(): WaveProgressSnapshot | null {
    if (!this.currentLevel) {
      return null;
    }

    const maxEnemies = this.currentLevel.enemiesPerWave[this.currentWave] ?? 0;
    const aliveInWave = this.enemies.filter((enemy) => enemy.isAlive()).length;
    const remainingSpawn = Math.max(0, maxEnemies - this.enemiesSpawnedThisWave);

    const nextWaveDelaySeconds = Number(this.waveDelayTimer.toFixed(1));
    return {
      wave: this.currentWave,
      maxEnemies,
      spawnedInWave: this.enemiesSpawnedThisWave,
      aliveInWave,
      remainingInWave: aliveInWave + remainingSpawn,
      eventType: this.currentWaveEvent,
      state: this.state,
      nextWaveDelaySeconds: Math.max(0, nextWaveDelaySeconds),
      onboardingBeat: { ...this.currentWaveBeatProfile },
    };
  }

  /**
   * 本波还没现身的敌机里有多少架属于“精英歼灭”名单：编成里尚未点名的 + 还在传送门里的。
   * 目标面板用它加上在场的精英数，开场第一秒就显示本波要打掉的精英总数。
   */
  public countEliteJetsToCome(): number {
    const lineup = this.getCurrentWaveConfig()?.lineup;
    let count = this.pendingEliteDeploys;
    if (lineup && this.state === LevelState.WAVE_ACTIVE) {
      for (let slot = this.enemiesSpawnedThisWave; slot < lineup.length; slot++) {
        if (isEliteEnemyType(lineup[slot])) count++;
      }
    }
    return count;
  }

  public getCurrentWaveOnboardingBeat(): OnboardingWaveBeatProfile {
    return { ...this.currentWaveBeatProfile };
  }

  /**
   * 换关 / 读档：销毁所有在场敌机（含 Boss 召唤的残余）与传送门，重置本波计数。
   * 与 clear() 不同，这里会把网格移出场景并释放尾迹。
   */
  public despawnAllEnemies(): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
    for (const portal of this.activePortals) {
      portal.dispose();
    }
    this.activePortals = [];
    this.pendingEliteDeploys = 0;
    this.enemiesSpawnedThisWave = 0;
    this.resetPlayerVelocity();
  }

  /**
   * 开发钩子（clearJets）：移除所有在场敌机与传送门，不计分、不触发击杀事件，
   * 也不改动波次计数（配合 setWaveSpawningHeld 单独研究某个机型）。返回移除的架数。
   */
  public removeAllEnemies(): number {
    const removed = this.enemies.length;
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
    for (const portal of this.activePortals) {
      portal.dispose();
    }
    this.activePortals = [];
    this.pendingEliteDeploys = 0;
    return removed;
  }

  /** 开发钩子（holdWaves）：暂停 / 恢复常规波次的生成与结算 */
  public setWaveSpawningHeld(held: boolean): void {
    this.waveSpawningHeld = held === true;
  }

  public isWaveSpawningHeld(): boolean {
    return this.waveSpawningHeld;
  }

  /**
   * 清除所有敌人
   */
  public clear(): void {
    // 清除敌人池
    for (const enemy of this.enemyPool) {
      enemy.getMesh().removeFromParent();
    }

    // 清除场景中的敌人
    this.enemies = [];
    this.enemyPool = [];

    // 清除传送门
    for (const portal of this.activePortals) {
      portal.dispose();
    }
    this.activePortals = [];
    this.pendingEliteDeploys = 0;

    // 重置波次
    this.enemiesSpawnedThisWave = 0;
    this.currentWaveEvent = null;
    this.currentWaveBeatProfile = DEFAULT_ONBOARDING_BEAT_PROFILE;
  }

  /**
   * 开始下一波（波次完成后的调用）
   */
  private startNextWave(playerPosition: Vector3): void {
    if (!this.currentLevel) return;

    // 增加波次
    this.currentWave++;

    // 计算并保存新波次各路的敌人群中心（确保在战场内）
    this.planWaveGroups(playerPosition);

    // 调用 startWave 完成状态设置和事件触发
    this.startWave(undefined, true); // isNextWave = true
  }

  /**
   * 获取生成位置，确保敌人批量生成在群内
   * 使用当前波次这一路的固定群中心（waveGroupCenters[side]），敌机在群中心60m半径内分布
   */
  private getSpawnPosition(playerPosition: Vector3, side: number = 0): Vector3 {
    const minGroupDistanceFromPlayer = WAVE_GROUP_MIN_DISTANCE; // 群中心最小距离
    const maxGroupDistanceFromPlayer = WAVE_GROUP_MIN_DISTANCE + WAVE_GROUP_DISTANCE_RANGE; // 群中心最大距离
    const distributionRadius = WAVE_GROUP_SPREAD; // 敌人在群内分布半径
    const minDistanceFromOtherEnemies = 40;

    // 战斗区域边界限制
    const maxHeight = this.combatBounds.maxHeight;
    const minHeight = this.combatBounds.minHeight;
    const horizontalDistance = this.combatBounds.horizontalDistance;

    let bestPosition: Vector3 | null = null;
    let bestMinDistance = 0;

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 使用保存的群中心（在startNextWave中计算）
      if (this.waveGroupCount === 0) {
        log.warn('No group center set, using fallback position');
        // 降级：如果没有群中心，使用玩家位置作为参考
        const fallbackDistance =
          minGroupDistanceFromPlayer +
          Math.random() * (maxGroupDistanceFromPlayer - minGroupDistanceFromPlayer);
        const fallbackAngle = Math.random() * Math.PI * 2;
        let groupCenterX = playerPosition.x + Math.cos(fallbackAngle) * fallbackDistance;
        let groupCenterZ = playerPosition.z + Math.sin(fallbackAngle) * fallbackDistance;

        // 限制在战场范围内
        groupCenterX = this.clampToBattlefield(groupCenterX);
        groupCenterZ = this.clampToBattlefield(groupCenterZ);

        let finalCenterX = groupCenterX;
        let finalCenterZ = groupCenterZ;

        const distFromCenterToPlayer = Math.sqrt(
          Math.pow(groupCenterX - playerPosition.x, 2) +
            Math.pow(groupCenterZ - playerPosition.z, 2)
        );

        if (distFromCenterToPlayer > horizontalDistance - distributionRadius) {
          const ratio = (horizontalDistance - distributionRadius) / distFromCenterToPlayer;
          finalCenterX = playerPosition.x + (groupCenterX - playerPosition.x) * ratio;
          finalCenterZ = playerPosition.z + (groupCenterZ - playerPosition.z) * ratio;
        }

        const distAngle = Math.random() * Math.PI * 2;
        const distFromCenter = Math.random() * distributionRadius;
        let x = finalCenterX + Math.cos(distAngle) * distFromCenter;
        let z = finalCenterZ + Math.sin(distAngle) * distFromCenter;

        // 限制在战场范围内
        x = this.clampToBattlefield(x);
        z = this.clampToBattlefield(z);

        const spawnY = Math.max(
          minHeight,
          Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30)
        );
        bestPosition = new Vector3(x, this.liftAboveTerrain(x, spawnY, z), z);
        break;
      }

      // 使用这一路的群中心
      const groupCenter = this.waveGroupCenters[Math.min(side, this.waveGroupCount - 1)];
      const distAngle = Math.random() * Math.PI * 2;
      const distFromCenter = Math.random() * distributionRadius;

      // 计算原始位置
      let x = groupCenter.x + Math.cos(distAngle) * distFromCenter;
      let z = groupCenter.z + Math.sin(distAngle) * distFromCenter;

      // 限制在战场范围内
      x = this.clampToBattlefield(x);
      z = this.clampToBattlefield(z);

      // 计算位置（检查高度）
      const spawnY = Math.max(
        minHeight,
        Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30)
      );

      const position = new Vector3(x, this.liftAboveTerrain(x, spawnY, z), z);

      // 计算与其他敌人的最小距离
      let minDistToOthers = Infinity;
      for (const existingEnemy of this.enemies) {
        if (existingEnemy.isAlive()) {
          const dist = position.distanceTo(existingEnemy.getPosition());
          minDistToOthers = Math.min(minDistToOthers, dist);
        }
      }

      // 如果是第一个敌人或者找到更好的位置
      if (minDistToOthers === Infinity || minDistToOthers > bestMinDistance) {
        bestMinDistance = minDistToOthers;
        bestPosition = position;
      }

      // 如果距离足够好，直接使用
      if (minDistToOthers >= minDistanceFromOtherEnemies) {
        break;
      }
    }

    // 如果找不到完美位置，使用默认位置
    if (!bestPosition) {
      const defaultY = Math.max(minHeight, Math.min(maxHeight, playerPosition.y));
      let x = playerPosition.x + (Math.random() - 0.5) * 200;
      let z = playerPosition.z + (Math.random() - 0.5) * 200;

      // 限制在战场范围内
      x = this.clampToBattlefield(x);
      z = this.clampToBattlefield(z);

      bestPosition = new Vector3(x, this.liftAboveTerrain(x, defaultY, z), z);
    }

    return bestPosition;
  }

  /** 出生高度至少高出地表 SPAWN_TERRAIN_CLEARANCE（高耸地形上不在岩体内生成） */
  private liftAboveTerrain(x: number, y: number, z: number): number {
    const ground = this.getCrashSurfaceY(x, z);
    if (!Number.isFinite(ground)) return y;
    return Math.max(y, ground + SPAWN_TERRAIN_CLEARANCE);
  }

  /**
   * 获取或创建敌人
   */
  private getOrCreateEnemy(type: EnemyType): EnemyAI {
    // 尝试从池中获取相同类型的敌人
    const pooledIndex = this.enemyPool.findIndex((e) => e.getConfig().type === type);

    if (pooledIndex !== -1) {
      const enemy = this.enemyPool.splice(pooledIndex, 1)[0];
      enemy.setConfig(this.getAdjustedEnemyConfig(type));
      enemy.setTerrainSampler(this.terrainHeightSampler);
      // 重要：从池中取出的敌人也要添加回 enemies 数组
      this.enemies.push(enemy);
      return enemy;
    }

    // 创建新敌人 - 使用统一的工厂函数；每架敌机带一份自己机型的条令
    const config = this.getAdjustedEnemyConfig(type);
    const mesh = createEnemyMesh(config);
    this.scene.add(mesh);

    const enemy = new EnemyAI(mesh, config, this.scene, { doctrine: createJetDoctrine(type) });
    enemy.setTerrainSampler(this.terrainHeightSampler);
    this.enemies.push(enemy);

    return enemy;
  }

  /**
   * 在指定位置生成敌人（用于 Boss 召唤）。
   * counted = false（开发钩子）：不计入“已生成”总数，HUD 的剩余敌机数不受影响。
   */
  public spawnEnemyAtPosition(
    type: EnemyType,
    position: Vector3,
    counted: boolean = true
  ): EnemyAI | null {
    const enemy = this.getOrCreateEnemy(type);
    enemy.reset(position);
    // Boss 召唤 / 开发钩子生成的敌机不属于任何波次编组
    enemy.setGroupId(0);
    enemy.getMesh().visible = true;
    if (counted) this.totalEnemiesSpawned++;

    this.onEnemySpawned?.(enemy);
    return enemy;
  }

  /**
   * 清理敌人资源
   */
  public dispose(_scene: Scene): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
  }

  private resolveWaveEvent(): LevelWaveEventType | null {
    const eventTemplates = this.currentLevel?.eventTemplates;
    if (!eventTemplates || eventTemplates.length === 0) {
      return null;
    }

    if (this.currentWave === 0) {
      return null;
    }

    return eventTemplates[(this.currentWave - 1) % eventTemplates.length] ?? null;
  }

  /** 波次事件决定的出场间隔（秒） */
  private getEventSpawnInterval(): number {
    switch (this.currentWaveEvent) {
      case LevelWaveEventType.ELITE_HUNT:
        return 0.8;
      case LevelWaveEventType.INTERCEPT:
        return 0.35;
      case LevelWaveEventType.ESCORT_DEFENSE:
        return 0.6;
      default:
        return 0.5;
    }
  }

  /** 本波的出场间隔：鱼贯而入的波次拉开到 TRAIL_SPAWN_INTERVAL，其余用事件的间隔 */
  private getWaveSpawnInterval(): number {
    const eventInterval = this.getEventSpawnInterval();
    return this.getCurrentWaveConfig()?.arrival === 'trail'
      ? Math.max(eventInterval, TRAIL_SPAWN_INTERVAL)
      : eventInterval;
  }

  /** 开场计时器的起点：第一架总是按事件的间隔出场（鱼贯而入只拉开后面各架） */
  private getInitialSpawnTimer(): number {
    return Math.max(0, this.spawnInterval - this.getEventSpawnInterval());
  }

  /**
   * 敌机强度 = 玩家所选难度档 × 战役关卡曲线（getLevelScaling：第 1 关 1.0 → 第 10 关上限）。
   * LevelConfig.difficulty 为旧字段，不再参与计算。
   */
  private getAdjustedEnemyConfig(type: EnemyType): EnemyConfig {
    const baseConfig = ENEMY_CONFIGS[type];
    const scaling = getLevelScaling(this.currentLevel?.id ?? 1);
    const profile = this.difficultyProfile;
    const healthMultiplier = (profile?.enemyHealthMultiplier ?? 1) * scaling.enemyHealthMultiplier;
    const damageMultiplier = (profile?.enemyDamageMultiplier ?? 1) * scaling.enemyDamageMultiplier;
    const cooldownMultiplier =
      (profile?.enemyAttackCooldownMultiplier ?? 1) * scaling.enemyCooldownMultiplier;
    const providedBonus = this.accuracyBonusProvider?.() ?? 0;
    const accuracyBonus =
      scaling.enemyAccuracyBonus +
      (Number.isFinite(providedBonus) ? Math.max(0, providedBonus) : 0);

    return {
      ...baseConfig,
      health: Math.max(1, Math.round(baseConfig.health * healthMultiplier)),
      // 无武装机型（基础伤害 0）保持 0，其余至少 1
      damage:
        baseConfig.damage > 0
          ? Math.max(1, Math.round(baseConfig.damage * damageMultiplier * 10) / 10)
          : 0,
      attackCooldown: Math.max(0.1, baseConfig.attackCooldown * cooldownMultiplier),
      accuracy: Math.min(0.95, baseConfig.accuracy + accuracyBonus),
      aimLead: Math.max(0, Math.min(1, scaling.enemyAimLead)),
      // 条令里两次点射 / 齐射 / 蓄力之间的间隔按同一个冷却倍率缩放（预警时长不变）
      cadenceScale: Math.max(
        MIN_CADENCE_SCALE,
        Math.min(MAX_CADENCE_SCALE, Number.isFinite(cooldownMultiplier) ? cooldownMultiplier : 1)
      ),
    };
  }
}
