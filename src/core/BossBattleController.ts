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
import {
  getDeclaredHitRadius,
  type CombatTarget,
  type DamageSource,
  type DecoyPoint,
} from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import {
  hasBossSpawnRoomAhead,
  resolveLegacyBossSpawn,
  type BossSurfaceSampler,
} from '@/core/boss/AdvancedBossSupport';
import { LegacyBossHitVolumes } from '@/core/boss/LegacyBossHitVolumes';
import {
  ADVANCED_BOSS_TYPES,
  AdvancedBossController,
  type AdvancedBossInstance,
} from '@/core/boss/AdvancedBossController';
import { BossHitFeedback } from '@/core/boss/BossHitFeedback';
import type { TerrainEnvironment } from '@/features/terrain/environments/TerrainEnvironment';
import type { BossAI } from '@/features/boss/BossAI';
import type { DesertFortressAI } from '@/features/boss/DesertFortressAI';
import type { MissileDestroyerAI } from '@/features/boss/MissileDestroyerAI';
import type { OctopusWarshipAI } from '@/features/boss/OctopusWarshipAI';
import type { SkyCarrierAI } from '@/features/boss/SkyCarrierAI';
import type { BossMinionKind } from '@/features/boss/BossContracts';
import type { BossMissile } from '@/features/boss/BossMissileSystem';
import { getCampaignChapter } from '@/features/campaign/CampaignData';
import { tr, type LocalizedText } from '@/i18n';
import {
  BOSS_MISSILE_CONFIG,
  BossConfig,
  BossType,
  FLAK_CANNON_CONFIG,
  getBossForLevel,
} from '@/features/boss/BossTypes';

export type { AdvancedBossInstance } from '@/core/boss/AdvancedBossController';

/** 没有 Boss 导弹时的空列表（只读使用，从不写入） */
const NO_OBJECTS: Object3D[] = [];

const DEG = Math.PI / 180;

/** 玩家在战场边缘朝外飞、Boss 前方放不下时的提示（显示时按当前语言取值） */
const RETURN_TO_ARENA_PROMPT: LocalizedText = {
  en: 'Return to the combat zone · Boss incoming',
  zh: '返回作战区域 · Boss 即将现身',
};

/**
 * 方位用语（当前语言）：bearing 为水平方位（度，机头为 0、右为正），elevation 为仰角（度）。
 * 例：正前方 / 右前方 / 左侧 / 右后方 / 正后方，仰俯角大时加“偏上 / 偏下”。
 */
function describeDirection(bearing: number, elevation: number): string {
  const right = bearing >= 0;
  const off = Math.abs(bearing);
  let direction: string;
  if (off <= 15) {
    direction = tr({ en: 'dead ahead', zh: '正前方' });
  } else if (off <= 60) {
    direction = right
      ? tr({ en: 'front right', zh: '右前方' })
      : tr({ en: 'front left', zh: '左前方' });
  } else if (off <= 120) {
    direction = right ? tr({ en: 'right', zh: '右侧' }) : tr({ en: 'left', zh: '左侧' });
  } else if (off <= 165) {
    direction = right
      ? tr({ en: 'rear right', zh: '右后方' })
      : tr({ en: 'rear left', zh: '左后方' });
  } else {
    direction = tr({ en: 'directly behind', zh: '正后方' });
  }
  if (elevation > 30) {
    return tr({ en: '{direction}, above', zh: '{direction}偏上' }, { direction });
  }
  if (elevation < -30) {
    return tr({ en: '{direction}, below', zh: '{direction}偏下' }, { direction });
  }
  return direction;
}

export type ActiveBoss =
  | BossAI
  | DesertFortressAI
  | OctopusWarshipAI
  | MissileDestroyerAI
  | SkyCarrierAI
  | AdvancedBossInstance;

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
  /** 等玩家掉头：轮询间隔、提示重复间隔、最长等待（只计玩家在飞的时间，暂停不计） */
  private static readonly SPAWN_ROOM_POLL_MS = 150;
  private static readonly SPAWN_ROOM_REMIND_MS = 2100;
  private static readonly SPAWN_ROOM_MAX_WAIT_MS = 9000;
  /** Boss 方位提示：远于此距离（米）或偏离机头超过 35° 时提示；最多几次、间隔几秒 */
  private static readonly BEARING_FAR_METERS = 450;
  private static readonly BEARING_OFF_NOSE_COS = Math.cos(35 * DEG);
  private static readonly BEARING_ANNOUNCEMENTS = 4;
  private static readonly BEARING_REPEAT_SECONDS = 3.2;

  private currentBoss: ActiveBoss | null = null;
  private currentBossType: BossType | null = null;
  private bossFriendlySpawnTimer: number = 0;
  private laserDamageCooldown: number = 0;
  private loadSequence: number = 0;
  private bossIndicatorUpdateTimer: number = 0;
  private bossIndicatorHasRenderedData: boolean = false;
  private readonly bossIndicatorSnapshots: BossMissileIndicatorSnapshot[] = [];
  private readonly indicatorProjection = new Vector3();

  // ── 第 6-10 关 Boss（逐帧驱动 / 命中 / 特殊武器判定都在 AdvancedBossController） ──
  private readonly feedback: BossHitFeedback;
  private readonly advanced: AdvancedBossController;
  private currentLevel = 1;
  private readonly partTargets = new Map<Object3D, CombatTarget>();
  private readonly missileTargets = new WeakMap<BossMissile, CombatTarget>();
  /** 击破收尾台词：none → oracle（神谕遗言已播）→ all */
  private defeatLines: 'none' | 'oracle' | 'all' = 'none';
  private stunFrame = -1;
  private frameCounter = 0;

  // ── 第 1-5 关 Boss：前方出生 + 半径命中 ──
  private readonly legacyHits = new LegacyBossHitVolumes();
  /** 按血量划分的阶段（> 66% / > 33% / 其余），驱动 HUD 阶段菱形与音乐强度 */
  private legacyPhase = 0;
  private legacyStatusTimer = 0;
  private legacyLowHealthAnnounced = false;
  /** Boss 导弹正在追踪玩家（HUD 导弹告警） */
  private bossMissileIncoming = false;
  private readonly legacyFriendlyMeshes: Object3D[] = [];
  private readonly legacyBossTargets: Object3D[] = [];
  private readonly spawnForward = new Vector3();
  private readonly legacyHitPosition = new Vector3();

  // ── 出场方位提示（神谕主宰锚定在城堡核心，可能远在侧后方） ──
  private bearingGuideRemaining = 0;
  private bearingGuideTimer = 0;
  private readonly bearingForward = new Vector3();

  constructor(private readonly deps: BossBattleControllerDeps) {
    this.feedback = new BossHitFeedback({
      particleSystem: deps.particleSystem,
      audioManager: deps.audioManager,
      playerSystem: deps.playerSystem,
      playerAircraft: deps.playerAircraft,
      enemySystem: deps.enemySystem,
    });
    this.advanced = new AdvancedBossController({
      scene: deps.scene,
      particleSystem: deps.particleSystem,
      combatSystem: deps.combatSystem,
      enemySystem: deps.enemySystem,
      playerSystem: deps.playerSystem,
      playerAircraft: deps.playerAircraft,
      audioManager: deps.audioManager,
      presentation: deps.presentation,
      feedback: this.feedback,
      getSurfaceSample: deps.getSurfaceSample,
      getTerrainEnvironment: deps.getTerrainEnvironment,
      getDecoys: deps.getDecoys,
      onSpawnMinion: deps.onSpawnMinion,
      onCameraShake: deps.onCameraShake,
      onExplosionShake: deps.onExplosionShake,
      onScreenFlash: deps.onScreenFlash,
      getLevel: () => this.currentLevel,
      announceLastWords: () => this.announceLastWords(),
      onBossDestroyed: (position, config, isBossMode) =>
        this.handleBossDestroy(position, config, isBossMode),
    });
  }

  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  /** 当前是否为第 6-10 关的高级 Boss */
  public getAdvancedBoss(): AdvancedBossInstance | null {
    return this.advanced.getBoss();
  }

  /** Boss 正在播放死亡演出（期间仍需逐帧更新） */
  public isBossDying(): boolean {
    return this.advanced.isDying();
  }

  public getHazardHitCount(): number {
    return this.advanced.getHazardHitCount();
  }

  /** 隐形中的 Boss 不出现在雷达 / 锁定中（幻影之翼） */
  public isBossHiddenFromSensors(): boolean {
    return this.advanced.isHiddenFromSensors();
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
      this.deps.hud.showPowerUpBig('✈️', tr({ en: 'Allied support inbound', zh: '召唤友军' }));
    }, 1000);

    void this.loadBoss(loadSequence, bossType, isBossMode);

    return true;
  }

  public update(deltaTime: number): void {
    if (!this.currentBoss || !this.currentBossType) {
      return;
    }

    this.frameCounter++;
    this.updateBearingGuide(deltaTime);
    const advancedBoss = this.advanced.getBoss();
    if (advancedBoss) {
      if (!this.advanced.update(deltaTime)) {
        // 死亡演出结束，onDestroy 已在 update 内触发并清理
        return;
      }
      this.bossFriendlySpawnTimer += deltaTime;
      if (this.bossFriendlySpawnTimer >= 30 && advancedBoss.isAlive()) {
        this.bossFriendlySpawnTimer = 0;
        this.deps.onSpawnFriendly();
        this.deps.hud.showPowerUpBig('✈️', tr({ en: 'Allied reinforcements', zh: '友军支援' }));
      }

      this.bossIndicatorUpdateTimer += deltaTime;
      if (this.bossIndicatorUpdateTimer >= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL) {
        this.bossIndicatorUpdateTimer %= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL;
        this.updateBossIndicators();
      }
      return;
    }

    // 逐帧复用的目标数组：僚机网格；Boss 本体 + 部件 + Boss 导弹（僚机索敌与导弹命中共用）
    const friendlyMeshes = this.legacyFriendlyMeshes;
    friendlyMeshes.length = 0;
    for (const friendly of this.deps.enemySystem.getFriendlyAIs()) {
      friendlyMeshes.push(friendly.getMesh());
    }
    const bossMissileSystem = this.currentBoss.getMissileSystem();
    const bossParts = this.currentBoss.getCollisionParts();
    const missileMeshes = bossMissileSystem ? bossMissileSystem.getMissileMeshes() : NO_OBJECTS;
    const bossTargets = this.legacyBossTargets;
    bossTargets.length = 0;
    bossTargets.push(this.currentBoss.getMesh());
    for (const part of bossParts) bossTargets.push(part);
    for (const mesh of missileMeshes) bossTargets.push(mesh);

    this.deps.enemySystem.updateWithPlayer(
      deltaTime,
      this.deps.playerSystem.getPosition(),
      bossTargets
    );

    this.currentBoss.update(deltaTime, this.deps.playerSystem.getMesh(), friendlyMeshes);
    this.feedback.checkBossMissileHits(bossMissileSystem, friendlyMeshes);
    this.updatePlayerWeaponBossCollisions(bossParts, missileMeshes, bossMissileSystem);

    if (
      this.currentBossType === BossType.OCTOPUS_WARSHIP &&
      this.isOctopusWarshipBoss(this.currentBoss)
    ) {
      this.updateOctopusSpecials(deltaTime, this.currentBoss);
    }
    if (!this.currentBoss) {
      return;
    }
    this.updateLegacyPresentation(deltaTime, this.currentBoss);

    this.bossFriendlySpawnTimer += deltaTime;
    if (this.bossFriendlySpawnTimer >= 30) {
      this.bossFriendlySpawnTimer = 0;
      this.deps.onSpawnFriendly();
      this.deps.hud.showPowerUpBig('✈️', tr({ en: 'Allied reinforcements', zh: '友军支援' }));
    }

    this.bossIndicatorUpdateTimer += deltaTime;
    if (this.bossIndicatorUpdateTimer >= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL) {
      this.bossIndicatorUpdateTimer %= BossBattleController.BOSS_INDICATOR_UPDATE_INTERVAL;
      this.updateBossIndicators();
    }
  }

  public clear(): void {
    this.loadSequence++;
    this.bearingGuideRemaining = 0;
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
      // Boss 总在玩家前方出现：玩家在战场边缘朝外飞时先提示返回，等机头转回来
      if (!(await this.waitForSpawnRoomAhead(loadSequence, bossType))) {
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
    const advancedBoss = ADVANCED_BOSS_TYPES.has(bossType) ? (boss as AdvancedBossInstance) : null;
    this.advanced.activate(advancedBoss);
    this.legacyPhase = 0;
    this.legacyStatusTimer = 0;
    this.legacyLowHealthAnnounced = false;
    // 第一阶段的音乐强度（阶段推进 0.35 → 0.6 → 0.85，低于 25% 血量 1.0）
    this.deps.presentation.setMusicIntensity(0.35);
    if (advancedBoss) {
      this.legacyHits.clear();
    } else {
      this.legacyHits.build(boss.getMesh(), this.getLegacyBodyParts(boss));
    }
    this.defeatLines = 'none';
    // Boss 登场无线电（Boss 模式下也播放：只有登场台词，没有剧情卡片）
    this.deps.presentation.radio('boss-spawn', this.currentLevel);
    // 远处或不在机头方向（神谕主宰锚定在城堡核心）：报出方位与距离，直到玩家转向它
    this.bearingGuideRemaining = BossBattleController.BEARING_ANNOUNCEMENTS;
    this.bearingGuideTimer = 0;
  }

  /**
   * 前方（±60°、出生范围内、地表合适）是否放得下这只 Boss；神谕主宰有城堡锚点时总是放得下
   */
  private hasSpawnRoomAhead(bossType: BossType): boolean {
    const player = this.deps.playerAircraft;
    const forward = this.spawnForward.set(0, 0, -1).applyQuaternion(player.quaternion);
    return hasBossSpawnRoomAhead({
      type: bossType,
      playerPosition: player.position,
      forwardX: forward.x,
      forwardZ: forward.z,
      sample: this.deps.getSurfaceSample,
      coreArena: bossType === BossType.ORACLE_PRIME ? this.advanced.getCitadelArena() : null,
    });
  }

  /**
   * 玩家在出生范围外、正朝战场外飞时，前方放不下 Boss（否则只能出生在身后）：提示“返回作战区域”，
   * 等机头转回来再出生；玩家在飞的累计时间超过上限仍不掉头，就出生在最靠近机头的方向（随后有方位提示）。
   * 返回 false 表示等待期间 Boss 战被清场 / 重开。
   */
  private waitForSpawnRoomAhead(loadSequence: number, bossType: BossType): Promise<boolean> {
    if (this.hasSpawnRoomAhead(bossType)) {
      return Promise.resolve(true);
    }
    const { presentation, playerAircraft, scheduleTimeout } = this.deps;
    const pollMs = BossBattleController.SPAWN_ROOM_POLL_MS;
    presentation.flashWarning(tr(RETURN_TO_ARENA_PROMPT), 'sys');
    return new Promise<boolean>((resolve) => {
      let flyingMs = 0;
      let sinceReminderMs = 0;
      let lastX = playerAircraft.position.x;
      let lastZ = playerAircraft.position.z;
      const poll = (): void => {
        if (loadSequence !== this.loadSequence) {
          resolve(false);
          return;
        }
        const { x, z } = playerAircraft.position;
        // 暂停 / 剧情卡片时玩家不动，不计入等待
        if (x !== lastX || z !== lastZ) {
          flyingMs += pollMs;
          sinceReminderMs += pollMs;
        }
        lastX = x;
        lastZ = z;
        if (
          this.hasSpawnRoomAhead(bossType) ||
          flyingMs >= BossBattleController.SPAWN_ROOM_MAX_WAIT_MS
        ) {
          resolve(true);
          return;
        }
        if (sinceReminderMs >= BossBattleController.SPAWN_ROOM_REMIND_MS) {
          sinceReminderMs = 0;
          presentation.flashWarning(tr(RETURN_TO_ARENA_PROMPT), 'sys');
        }
        scheduleTimeout(poll, pollMs);
      };
      scheduleTimeout(poll, pollMs);
    });
  }

  /** 出场方位提示：Boss 远或不在机头方向时每隔几秒闪一次“名称：方位 距离”，玩家转向它就停 */
  private updateBearingGuide(deltaTime: number): void {
    if (this.bearingGuideRemaining <= 0) return;
    this.bearingGuideTimer -= deltaTime;
    if (this.bearingGuideTimer > 0) return;
    const text = this.describeBossBearing();
    if (!text) {
      this.bearingGuideRemaining = 0;
      return;
    }
    this.deps.presentation.flashWarning(text, 'threat');
    this.bearingGuideRemaining--;
    this.bearingGuideTimer = BossBattleController.BEARING_REPEAT_SECONDS;
  }

  /** “名称：方位 距离”；Boss 已在机头 35° 内且不远、隐形中、或坐标非有限时为 null */
  private describeBossBearing(): string | null {
    const boss = this.currentBoss;
    if (!boss || !boss.isAlive() || this.isBossHiddenFromSensors()) return null;
    const player = this.deps.playerAircraft;
    const target = boss.getMesh().position;
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    const dz = target.z - player.position.z;
    const distance = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(distance) || distance < 1) return null;
    const forward = this.bearingForward.set(0, 0, -1).applyQuaternion(player.quaternion);
    const facing = (forward.x * dx + forward.y * dy + forward.z * dz) / distance;
    if (
      facing >= BossBattleController.BEARING_OFF_NOSE_COS &&
      distance <= BossBattleController.BEARING_FAR_METERS
    ) {
      return null;
    }
    // 水平方位以机头的水平投影为基准（右为正）；机头竖直时退回 -Z
    const flat = Math.hypot(forward.x, forward.z);
    const fx = flat > 1e-3 ? forward.x / flat : 0;
    const fz = flat > 1e-3 ? forward.z / flat : -1;
    const bearing = Math.atan2(dz * fx - dx * fz, dx * fx + dz * fz) / DEG;
    const elevation = Math.atan2(dy, Math.hypot(dx, dz)) / DEG;
    const chapterBoss = getCampaignChapter(this.currentLevel).boss.name;
    const name =
      this.currentBossType === BossType.ORACLE_PRIME
        ? tr({ en: '{boss} (citadel core)', zh: '{boss}（城堡核心）' }, { boss: chapterBoss })
        : chapterBoss;
    return tr(
      { en: '{name}: {direction} · {distance} m', zh: '{name}：{direction} {distance} 米' },
      {
        name,
        direction: describeDirection(bearing, elevation),
        distance: Math.round(distance / 10) * 10,
      }
    );
  }

  private async createBoss(
    bossType: BossType,
    config: BossConfig,
    isBossMode: boolean
  ): Promise<ActiveBoss> {
    if (ADVANCED_BOSS_TYPES.has(bossType)) {
      return this.advanced.create(bossType, config, isBossMode);
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

  /**
   * 第 1-5 关 Boss 没有阶段接口：按血量划成三个阶段，阶段推进时与第 6-10 关一样
   * 播放警报 + phase-change 刺激音并提高音乐强度；HUD 显示阶段菱形；低于 25% 播低血量台词。
   */
  private updateLegacyPresentation(deltaTime: number, boss: ActiveBoss): void {
    // 4 Hz：getHealth() 每次返回新对象，阶段判定不必逐帧
    this.legacyStatusTimer -= deltaTime;
    if (this.legacyStatusTimer > 0) return;
    this.legacyStatusTimer = 0.25;
    const health = boss.getHealth();
    const fraction = health.max > 0 ? health.current / health.max : 0;
    const phase = fraction > 0.66 ? 1 : fraction > 0.33 ? 2 : 3;
    const presentation = this.deps.presentation;
    if (phase !== this.legacyPhase) {
      const previous = this.legacyPhase;
      this.legacyPhase = phase;
      if (previous > 0 && phase > previous && boss.isAlive()) {
        presentation.onBossPhaseChange(this.currentLevel, phase, null);
      }
    }
    if (!this.legacyLowHealthAnnounced && boss.isAlive() && fraction < 0.25) {
      this.legacyLowHealthAnnounced = true;
      presentation.onBossLowHealth(this.currentLevel, true);
    }
    presentation.setBossStatus('', { current: phase, total: 3 });
  }

  /** Boss 导弹追踪玩家时 HUD 进入“导弹来袭”告警（与 SAM 告警取最高级） */
  private setBossMissileIncoming(incoming: boolean): void {
    if (incoming === this.bossMissileIncoming) return;
    this.bossMissileIncoming = incoming;
    this.deps.presentation.setMissileWarning(incoming ? 'incoming' : 'none', 'boss');
  }

  /** 第 1-5 关 Boss 出生点：玩家水平朝向前方（地表 / 水面采样） */
  private resolveLegacySpawn(type: BossType): Vector3 {
    const player = this.deps.playerAircraft;
    const forward = this.spawnForward.set(0, 0, -1).applyQuaternion(player.quaternion);
    return resolveLegacyBossSpawn({
      type,
      playerPosition: player.position,
      forwardX: forward.x,
      forwardZ: forward.z,
      sample: this.deps.getSurfaceSample,
    });
  }

  /** 机身命中部件（章鱼战舰的眼睛另有判定，不计入机身） */
  private getLegacyBodyParts(boss: ActiveBoss): readonly Object3D[] {
    if (this.isOctopusWarshipBoss(boss)) {
      return boss.getCollisionPartMeshes();
    }
    return boss.getCollisionParts();
  }

  private async createHeavyBomberBoss(config: BossConfig, isBossMode: boolean): Promise<BossAI> {
    const { BossAI, createBossMesh } = await import('@/features/boss/BossAI');
    const mesh = createBossMesh(config);
    mesh.position.copy(this.resolveLegacySpawn(BossType.HEAVY_BOMBER));
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
    const { DesertFortressAI, createDesertFortressMesh } =
      await import('@/features/boss/DesertFortressAI');
    const mesh = createDesertFortressMesh(config);
    mesh.position.copy(this.resolveLegacySpawn(BossType.DESERT_FORTRESS));
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
        this.feedback.createWeaponHitFeedback(
          target.position,
          Math.max(1.1, damage / 13),
          'flak-hit',
          Math.max(0.82, damage / 30),
          this.feedback.getTargetHitProfile(target)
        );
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.takeCombatDamage(damage, { suppressDefaultFeedback: true });
          }
          return;
        }

        const friendly = this.deps.enemySystem
          .getFriendlyAIs()
          .find((candidate) => candidate.getMesh() === target);
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
    const { OctopusWarshipAI, createOctopusWarshipMesh } =
      await import('@/features/boss/OctopusWarshipAI');
    const mesh = createOctopusWarshipMesh(config);
    mesh.position.copy(this.resolveLegacySpawn(BossType.OCTOPUS_WARSHIP));
    this.deps.scene.add(mesh);

    const boss = new OctopusWarshipAI(mesh, config, this.deps.particleSystem);
    boss.init();
    boss.onTeleport = (from, to) => {
      this.deps.particleSystem.createTeleportOut(from);
      this.deps.particleSystem.createTeleportIn(to);
      this.deps.audioManager.playTeleport();
    };
    boss.onLaserWarning = () => {
      this.deps.hud.showPowerUpBig('⚠️', tr({ en: 'Laser warning!', zh: '激光预警！' }), 1, true);
      this.deps.audioManager.playLaserWarning();
    };
    boss.onLaserSweep = () => {
      this.deps.hud.showPowerUpBig('💣', tr({ en: 'Laser sweep!', zh: '激光扫射！' }), 1, true);
      this.deps.audioManager.playLaserSweep();
    };
    boss.onLaserHit = () => {
      if (!this.deps.playerSystem.isShieldActive()) {
        this.deps.playerSystem.takeCombatDamage(config.damage, {
          suppressDefaultFeedback: true,
        });
        this.feedback.createWeaponHitFeedback(
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
    const { MissileDestroyerAI, createMissileDestroyerMesh } =
      await import('@/features/boss/MissileDestroyerAI');
    const mesh = createMissileDestroyerMesh(config);
    mesh.position.copy(this.resolveLegacySpawn(BossType.MISSILE_DESTROYER));
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
        this.feedback.createWeaponHitFeedback(
          target.position,
          Math.max(1.1, damage / 13),
          'flak-hit',
          Math.max(0.82, damage / 30),
          this.feedback.getTargetHitProfile(target)
        );
        if (target === this.deps.playerAircraft) {
          if (!this.deps.playerSystem.isShieldActive()) {
            this.deps.playerSystem.takeCombatDamage(damage, {
              suppressDefaultFeedback: true,
            });
          }
          return;
        }

        const friendly = this.deps.enemySystem
          .getFriendlyAIs()
          .find((candidate) => candidate.getMesh() === target);
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
    mesh.position.copy(this.resolveLegacySpawn(BossType.SKY_CARRIER));
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

  /** 清场 / 击破：部件目标缓存与第 6-10 关 Boss 的逐帧状态 */
  private resetAdvancedState(): void {
    this.advanced.reset();
    this.partTargets.clear();
    this.legacyHits.clear();
  }

  /** 神谕的遗言：死亡冻结瞬间只播神谕自己的收尾台词 */
  private announceLastWords(): void {
    if (this.defeatLines !== 'none') return;
    this.defeatLines = 'oracle';
    this.deps.presentation.radio('boss-defeated', this.currentLevel, undefined, {
      only: 'oracle',
    });
  }

  /** 击破收尾台词：每场 Boss 战只播一次（遗言已播时只补其余人的台词） */
  private announceDefeat(): void {
    if (this.defeatLines === 'all') return;
    const speakers = this.defeatLines === 'oracle' ? { exclude: 'oracle' as const } : undefined;
    this.defeatLines = 'all';
    this.deps.presentation.radio('boss-defeated', this.currentLevel, undefined, speakers);
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
    const advanced = this.advanced.getBoss();
    if (boss.isAlive() && !(advanced?.isCloaked?.() ?? false)) {
      for (const part of boss.getCollisionParts()) {
        if (part.userData.bossDeflector === true || part.userData.bossHazardTarget === true) {
          continue;
        }
        if (
          advanced &&
          advanced.getDamageMultiplier(part) <= 0 &&
          part.userData.bossDecoy !== true
        ) {
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

  /** 子目标血条（护盾塔、气囊、散热口……），已摧毁的不显示；visit 逐个回调（不分配） */
  public forEachSubTargetBar(
    visit: (mesh: Object3D, currentHealth: number, maxHealth: number) => void
  ): void {
    this.advanced.forEachSubTargetBar(visit);
  }

  /**
   * EMP 脉冲：幻影之翼（隐形时没有可命中部件）走 applyEmpPulse；半径内的 Boss 导弹被摧毁。
   * 其他 Boss 的瘫痪由特殊武器系统对部件目标调用 applyStun 完成。
   */
  public applyEmp(center: Vector3, radius: number, seconds: number): void {
    const boss = this.currentBoss;
    if (!boss) return;
    this.advanced.applyEmpPulse(center, radius, seconds);
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
        (this.advanced.getBoss() ? this.advanced.ownsPart(part) : true),
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
    if (this.advanced.getBoss() === boss) {
      this.advanced.damagePartWithWeapon(part, amount, hitPoint);
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

  private updatePlayerWeaponBossCollisions(
    bossParts: Object3D[],
    missileMeshes: Object3D[],
    bossMissileSystem: ActiveBoss['getMissileSystem'] extends () => infer T ? T : never
  ): void {
    if (!this.currentBoss) {
      return;
    }

    if (
      this.currentBossType === BossType.OCTOPUS_WARSHIP &&
      this.isOctopusWarshipBoss(this.currentBoss)
    ) {
      const octopusBoss = this.currentBoss;
      const eyeParts = octopusBoss.getEyeCollisionParts();
      const eyeMeshes = eyeParts.map((part) => part.mesh);

      this.deps.combatSystem
        .getMissileSystem()
        .checkCollisions(eyeMeshes, (target, impactPosition) => {
          const part = eyeParts.find((candidate) => candidate.mesh === target);
          if (!part) {
            return;
          }

          octopusBoss.takeEyeDamage(part.index, GAME_CONSTANTS.MISSILE.DAMAGE);
          this.feedback.createArmorHitFeedback(impactPosition, 1.14, true);
          this.deps.particleSystem.createMissileImpact(impactPosition, 1.25);
          this.deps.audioManager.playMissileExplosion('enemy');
        });

      this.deps.combatSystem.getPlayerProjectilePool().checkCollisions(eyeMeshes, (target) => {
        const part = eyeParts.find((candidate) => candidate.mesh === target);
        if (!part) {
          return;
        }

        octopusBoss.takeEyeDamage(part.index, this.deps.combatSystem.getDamageMultiplier() * 12.5);
        const hitWorldPos = new Vector3();
        target.getWorldPosition(hitWorldPos);
        this.feedback.createArmorHitFeedback(hitWorldPos, 0.98);
      });
    }

    // 导弹目标：Boss 本体 + 部件 + Boss 导弹（update 中已填好的复用数组）
    this.deps.combatSystem
      .getMissileSystem()
      .checkCollisions(this.legacyBossTargets, (target, impactPosition) => {
        const hitWorldPos = impactPosition.clone();
        const isBossPart = bossParts.includes(target);

        if (target === this.currentBoss?.getMesh() || isBossPart) {
          this.currentBoss?.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
          this.feedback.createArmorHitFeedback(hitWorldPos, 1.18, true);
          this.deps.particleSystem.createMissileImpact(hitWorldPos, 1.55);
          this.deps.audioManager.playMissileExplosion('enemy');
          return;
        }

        const missile = bossMissileSystem
          ?.getMissiles()
          .find((candidate) => candidate.getMesh() === target);
        if (missile) {
          missile.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
          this.feedback.createBossMissileDestroyedFeedback(hitWorldPos, 0.92, 'enemy');
        }
      });

    // 机炮 / 友军子弹：按部件命中球判定（与第 6-10 关一致的半径命中），子弹打在哪就在哪出火花
    this.legacyHits.refresh();
    const playerPool = this.deps.combatSystem.getPlayerProjectilePool();
    if (playerPool.hasActiveProjectiles()) {
      playerPool.consumeHits(this.legacyPlayerBulletHit);
      if (missileMeshes.length > 0) {
        playerPool.checkCollisions(missileMeshes, (target) => {
          const missile = bossMissileSystem
            ?.getMissiles()
            .find((candidate) => candidate.getMesh() === target);
          missile?.takeDamage(this.deps.combatSystem.getDamageMultiplier() * 12.5);
        });
      }
    }

    const enemyPool = this.deps.combatSystem.getEnemyProjectilePool();
    if (enemyPool.hasActiveProjectiles()) {
      // 只认友军僚机的子弹（敌机子弹穿过 Boss，不再误伤 Boss）
      enemyPool.consumeHits(this.legacyFriendlyBulletHit);
      if (missileMeshes.length > 0) {
        enemyPool.checkCollisions(
          missileMeshes,
          (target: Object3D, _projectile, damage: number) => {
            const missile = bossMissileSystem
              ?.getMissiles()
              .find((candidate) => candidate.getMesh() === target);
            if (missile) {
              missile.takeDamage(damage);
              this.feedback.createBossMissileDestroyedFeedback(target.position, 0.72, 'enemy');
            }
          }
        );
      }
    }
  }

  /** 玩家机炮命中第 1-5 关 Boss 机身（预先绑定，避免每帧创建闭包） */
  private readonly legacyPlayerBulletHit = (position: Vector3): boolean => {
    const boss = this.currentBoss;
    if (!boss || !boss.isAlive()) return false;
    if (!this.legacyHits.findHit(position)) return false;
    boss.takeDamage(this.deps.combatSystem.getDamageMultiplier() * 12.5);
    this.feedback.createArmorHitFeedback(this.legacyHitPosition.copy(position), 0.92);
    return true;
  };

  /** 友军僚机子弹命中第 1-5 关 Boss 机身 */
  private readonly legacyFriendlyBulletHit = (
    position: Vector3,
    damage: number,
    faction: string | undefined
  ): boolean => {
    if (faction !== Faction.FRIENDLY) return false;
    const boss = this.currentBoss;
    if (!boss || !boss.isAlive()) return false;
    if (!this.legacyHits.findHit(position)) return false;
    boss.takeDamage(damage);
    this.feedback.createArmorHitFeedback(
      this.legacyHitPosition.copy(position),
      Math.max(0.88, damage / 16)
    );
    return true;
  };

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
        this.feedback.createWeaponHitFeedback(
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
        this.feedback.createArmorHitFeedback(hitWorldPos, 0.95);
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
          this.feedback.createWeaponHitFeedback(
            currentPlayerPosition,
            Math.max(0.98, boss.getEyeDamage() / 18),
            'boss-cannon',
            Math.max(0.8, boss.getEyeDamage() / 32),
            'player'
          );
        }
        this.feedback.createHeavyDamageFeedback(bulletPosition, 0.94, 'boss-cannon');
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
          this.feedback.createWeaponHitFeedback(
            friendlyPosition,
            Math.max(0.9, boss.getEyeDamage() / 24),
            'boss-cannon',
            Math.max(0.75, boss.getEyeDamage() / 36),
            'enemy'
          );
          this.feedback.createHeavyDamageFeedback(bulletPosition, 0.84, 'boss-cannon');
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
    this.setBossMissileIncoming(snapshotCount > 0);
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
    this.bearingGuideRemaining = 0;
    this.resetBossIndicatorState();
    this.announceDefeat();
    this.deps.presentation.setBossStatus(null);
    this.advanced.handleBossDestroyed();
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

  private scheduleBossDeathAftershocks(position: Vector3, config: BossConfig): void {
    const firstImpactPos = position.clone();
    const secondImpactPos = position.clone();
    const intensity = Math.max(0.9, Math.min(1.65, config.scale * 0.2));

    this.deps.scheduleTimeout(() => {
      this.feedback.createHeavyDamageFeedback(firstImpactPos, intensity, 'boss-armor');
    }, 140);

    this.deps.scheduleTimeout(() => {
      this.feedback.createHeavyDamageFeedback(secondImpactPos, intensity * 0.88, 'boss-cannon');
    }, 300);
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

  private hasFlakCannonSystem(boss: ActiveBoss): boss is DesertFortressAI | MissileDestroyerAI {
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
    this.setBossMissileIncoming(false);

    if (!this.bossIndicatorHasRenderedData) {
      return;
    }

    this.deps.bossIndicator.clear();
    this.bossIndicatorHasRenderedData = false;
  }
}
