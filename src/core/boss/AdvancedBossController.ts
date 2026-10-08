import { Vector3 } from 'three';
import type { Group, Object3D, Scene } from 'three';
import type { AudioManager } from '@/core/Audio/AudioManager';
import type { CombatSystem } from '@/core/systems/CombatSystem';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { Faction } from '@/core/Faction';
import { GAME_CONSTANTS } from '@/config';
import { getDeclaredHitRadius, type DecoyPoint } from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import type { TerrainEnvironment } from '@/features/terrain/environments/TerrainEnvironment';
import type { BossMinionKind, BossSubTarget, IAdvancedBoss } from '@/features/boss/BossContracts';
import { BossConfig, BossType } from '@/features/boss/BossTypes';
import {
  BossFlareDecoyRedirector,
  HazardCooldownTracker,
  mapOracleStageToCoreState,
  resolveAdvancedBossSpawn,
  type BossSurfaceSampler,
  type CitadelCoreVisualState,
} from './AdvancedBossSupport';
import type { BossHitFeedback } from './BossHitFeedback';

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

/** 高级 Boss 的效果提示回调（各 Boss 的 cue 联合类型都是字符串子集） */
type BossCueHandler = (cue: string, position: Vector3, intensity: number) => void;

/** 第 6-10 关 Boss 类型 */
export const ADVANCED_BOSS_TYPES: ReadonlySet<BossType> = new Set([
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

export interface AdvancedBossControllerDeps {
  scene: Scene;
  particleSystem: ParticleSystem;
  combatSystem: CombatSystem;
  enemySystem: EnemySystem;
  playerSystem: PlayerSystem;
  playerAircraft: Object3D;
  audioManager: AudioManager;
  presentation: ICampaignPresentation;
  feedback: BossHitFeedback;
  getSurfaceSample: BossSurfaceSampler;
  getTerrainEnvironment: () => TerrainEnvironment | null;
  getDecoys: () => readonly DecoyPoint[];
  onSpawnMinion: (position: Vector3, kind: BossMinionKind) => void;
  onCameraShake: (intensity: number) => void;
  onExplosionShake: (position: Vector3, scale: number) => void;
  onScreenFlash: (amount: number) => void;
  /** 当前 Boss 战所在关卡（无线电台词 / 音乐） */
  getLevel: () => number;
  /** 神谕的遗言（死亡冻结瞬间只播神谕的台词；其余收尾台词在击破后由 Boss 战控制器播放） */
  announceLastWords: () => void;
  /** Boss 的 onDestroy（死亡演出结束后）→ Boss 战控制器统一收尾 */
  onBossDestroyed: (position: Vector3, config: BossConfig, isBossMode: boolean) => void;
}

/**
 * 第 6-10 关 Boss 控制器：创建与出生点、逐帧驱动、按部件半径的命中、特殊武器（熔岩 / 电弧 /
 * 激光 / 冲击波）判定冷却、热焰弹诱骗 Boss 导弹、Boss 状态与音乐强度、神谕核心的城堡联动。
 *
 * Boss 生命周期（加载序号、清场、击破收尾、导弹指示器、友军支援）仍由 BossBattleController 负责。
 */
export class AdvancedBossController {
  private boss: AdvancedBossInstance | null = null;
  private readonly hazardCooldowns = new HazardCooldownTracker(0.6);
  private decoyRedirector: BossFlareDecoyRedirector | null = null;
  private readonly currentParts = new Set<Object3D>();
  private readonly friendlyMeshBuffer: Object3D[] = [];
  private readonly friendlyTargetBuffer: Object3D[] = [];
  private readonly weaponTargetBuffer: Object3D[] = [];
  private readonly hitWorldPosition = new Vector3();
  private bossStatusTimer = 0;
  private lowHealthAnnounced = false;
  private lastCoreState: CitadelCoreVisualState | null = null;
  /** Boss 特殊武器命中玩家 / 友军的累计次数（调试与验证用） */
  private hazardHitCount = 0;

  constructor(private readonly deps: AdvancedBossControllerDeps) {}

  // ───────────────────────────── 查询 ─────────────────────────────

  public getBoss(): AdvancedBossInstance | null {
    return this.boss;
  }

  /** Boss 正在播放死亡演出（期间仍需逐帧更新） */
  public isDying(): boolean {
    return this.boss?.isDying() ?? false;
  }

  /** 隐形中的 Boss 不出现在雷达 / 锁定中（幻影之翼） */
  public isHiddenFromSensors(): boolean {
    return this.boss?.isCloaked?.() ?? false;
  }

  public getHazardHitCount(): number {
    return this.hazardHitCount;
  }

  /** 本帧的可命中部件（隐形 / 潜航时为空） */
  public ownsPart(part: Object3D): boolean {
    return this.currentParts.has(part);
  }

  // ───────────────────────────── 创建 ─────────────────────────────

  public async create(
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
          if (cue === 'death-freeze') {
            // 神谕的遗言在冻结瞬间响起
            this.deps.announceLastWords();
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
    this.wire(boss, isBossMode);
    return boss;
  }

  /** 加载完成并被采用的 Boss（null = 第 1-5 关 Boss 或清场） */
  public activate(boss: AdvancedBossInstance | null): void {
    this.boss = boss;
    this.lowHealthAnnounced = false;
    this.bossStatusTimer = 0;
  }

  /** CITADEL 决战区（神谕主宰锚点）；不是第 10 关地形时为 null */
  public getCitadelArena(): Vector3 | null {
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

  private wire(boss: AdvancedBossInstance, isBossMode: boolean): void {
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
      // 阶段台词 + 警报 + phase-change 刺激音 + 音乐强度 + HUD 闪烁告警
      presentation.onBossPhaseChange(this.deps.getLevel(), phase, label);
      this.deps.onCameraShake(0.3);
    };
    boss.onHazardWarning = (label) => {
      presentation.flashWarning(label, 'threat');
    };
    boss.onSpawnMinion = (position, kind) => {
      this.deps.onSpawnMinion(position, kind);
    };
    boss.onDestroy = (position, bossConfig) => {
      this.deps.onBossDestroyed(position, bossConfig, isBossMode);
    };
  }

  // ───────────────────────────── 清场 / 击破 ─────────────────────────────

  public reset(): void {
    this.boss = null;
    this.hazardCooldowns.clear();
    this.decoyRedirector?.clear();
    this.currentParts.clear();
    this.bossStatusTimer = 0;
  }

  /** Boss 被击破：城堡核心熄灭 */
  public handleBossDestroyed(): void {
    this.syncCitadelCore('offline');
  }

  // ───────────────────────────── 逐帧 ─────────────────────────────

  private collectFriendlyMeshes(): Object3D[] {
    const buffer = this.friendlyMeshBuffer;
    buffer.length = 0;
    for (const friendly of this.deps.enemySystem.getFriendlyAIs()) {
      if (friendly.isAlive()) buffer.push(friendly.getMesh());
    }
    return buffer;
  }

  /**
   * 逐帧驱动当前 Boss；返回 false 表示 Boss 在本帧被击破（onDestroy 已触发并清理）。
   */
  public update(deltaTime: number): boolean {
    const boss = this.boss;
    if (!boss) return false;
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
    if (this.boss !== boss) {
      // 死亡演出结束，onDestroy 已在 update 内触发并清理
      return false;
    }

    this.deps.feedback.checkBossMissileHits(missileSystem, friendlyMeshes);
    this.updateWeaponHits(boss, missileSystem);
    if (this.boss !== boss) {
      return false;
    }
    this.updateHazards(deltaTime, boss);
    this.decoyRedirector ??= new BossFlareDecoyRedirector(this.deps.scene);
    this.decoyRedirector.update(
      deltaTime,
      this.deps.getDecoys(),
      missileSystem,
      playerMesh.position
    );
    this.updatePresentation(deltaTime, boss);
    return true;
  }

  /**
   * 玩家机炮 / 导弹与友军子弹对高级 Boss 的命中：一律按部件半径判定，
   * 交给 takeDamageAt(部件, 原始伤害)，由 Boss 自己处理弱点倍率、子目标与无敌。
   */
  private updateWeaponHits(
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
        this.damagePart(boss, target, missileDamage, impactPosition, true);
        this.deps.particleSystem.createMissileImpact(impactPosition, 1.55);
        this.deps.audioManager.playMissileExplosion('enemy');
        return;
      }
      const missile = bossMissiles.find((candidate) => candidate.getMesh() === target);
      if (missile) {
        missile.takeDamage(missileDamage);
        this.deps.feedback.createBossMissileDestroyedFeedback(impactPosition, 0.92, 'enemy');
      }
    });

    combat.getPlayerProjectilePool().checkCollisions(targets, (target, projectileMesh, damage) => {
      if (this.currentParts.has(target)) {
        this.damagePart(boss, target, damage, projectileMesh.position, false);
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

  /** 特殊武器命中某个部件（hitPoint 缺省时取部件世界坐标） */
  public damagePartWithWeapon(part: Object3D, amount: number, hitPoint?: Vector3): void {
    const boss = this.boss;
    if (!boss) return;
    const at = hitPoint ?? part.getWorldPosition(this.hitWorldPosition);
    this.damagePart(boss, part, amount, at, amount >= 40);
  }

  /** 部件伤害 + 分级命中反馈（弱点 / 装甲 / 护盾偏转） */
  private damagePart(
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
    this.deps.feedback.createArmorHitFeedback(at, intensity, heavy || weakPoint);
  }

  /** Boss 特殊武器（熔岩 / 电弧 / 激光 / 冲击波）：玩家与友军各自 0.6 秒命中冷却 */
  private updateHazards(deltaTime: number, boss: AdvancedBossInstance): void {
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
        this.hazardHitCount++;
        if (playerSystem.isShieldActive()) {
          playerSystem.notifyShieldHit(hit.position);
        } else {
          playerSystem.takeCombatDamage(hit.damage, { suppressDefaultFeedback: true });
          this.deps.onCameraShake(PLAYER_HAZARD_SHAKE);
        }
        this.deps.feedback.createWeaponHitFeedback(
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
      this.hazardHitCount++;
      friendly.takeDamage(hit.damage);
      this.deps.feedback.createWeaponHitFeedback(hit.position, 0.95, hit.profile, 0.85, 'enemy');
    }
  }

  /** Boss 状态、低血量台词、音乐强度、城堡核心联动 */
  private updatePresentation(deltaTime: number, boss: AdvancedBossInstance): void {
    const presentation = this.deps.presentation;
    const stage = boss.getStage?.();
    if (stage !== undefined) {
      this.syncCitadelCore(mapOracleStageToCoreState(stage, boss.isAlive(), boss.isDying()));
    }

    // 神谕主宰：音乐强度逐帧跟随 Boss（MusicSystem 对相同强度不重写自动化）；
    // 死亡演出期间随进度收束，为击破刺激音让出空间
    const intensity = boss.getMusicIntensity?.();
    if (intensity !== undefined) {
      const fade = boss.isDying() ? 1 - 0.7 * (boss.getDeathProgress?.() ?? 0) : 1;
      presentation.setMusicIntensity(intensity * fade);
    }

    this.bossStatusTimer -= deltaTime;
    if (this.bossStatusTimer > 0) return;
    this.bossStatusTimer = BOSS_STATUS_INTERVAL;
    presentation.setBossStatus(boss.getStatusLabel(), {
      current: boss.getPhase(),
      total: boss.getPhaseCount(),
    });
    if (!this.lowHealthAnnounced && boss.isAlive()) {
      const health = boss.getHealth();
      if (health.max > 0 && health.current / health.max < 0.25) {
        this.lowHealthAnnounced = true;
        // 低于 25%：台词；没有自带音乐强度的 Boss 把强度拉满
        presentation.onBossLowHealth(this.deps.getLevel(), intensity === undefined);
      }
    }
  }

  // ───────────────────────────── 协调器查询 ─────────────────────────────

  /** 子目标血条（护盾塔、气囊、散热口……），已摧毁的不显示；visit 逐个回调（不分配） */
  public forEachSubTargetBar(
    visit: (mesh: Object3D, currentHealth: number, maxHealth: number) => void
  ): void {
    const boss = this.boss;
    if (!boss || !boss.isAlive() || (boss.isCloaked?.() ?? false)) return;
    const subTargets: BossSubTarget[] | undefined = boss.getSubTargets?.();
    if (!subTargets) return;
    for (const sub of subTargets) {
      if (sub.current <= 0) continue;
      visit(sub.mesh, sub.current, sub.max);
    }
  }

  /** EMP：幻影之翼（隐形时没有可命中部件）走 applyEmpPulse 强制现形 */
  public applyEmpPulse(center: Vector3, radius: number, seconds: number): void {
    this.boss?.applyEmpPulse?.(center, radius, seconds);
  }
}
