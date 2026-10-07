import * as THREE from 'three';
import type { CombatTarget, IDecoyProvider } from '@/core/CombatContracts';
import { getLevelScaling, type DifficultyProfile, type LevelScaling } from '@/core/Difficulty';
import { Faction } from '@/core/Faction';
import type {
  ICampaignPresentation,
  UnitPresentationEvent,
} from '@/core/campaign/CampaignPresentation';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { ProjectilePool } from '@/features/combat/ProjectilePool';
import type { MissileSystem } from '@/features/combat/MissileSystem';
import type {
  PlayerLockState,
  UnitInstance,
  UnitRouteProvider,
  UnitSystem,
  UnitUpdateContext,
} from '@/features/units/UnitSystem';
import type { UnitRadarKind, UnitType } from '@/features/units/UnitTypes';

type UnitMeshModule = typeof import('@/features/units/UnitMeshFactory');
type UnitBridgeModule = typeof import('@/features/units/UnitEventBridge');
type UnitDeploymentModule = typeof import('@/features/units/UnitDeployments');
type UnitTypesModule = typeof import('@/features/units/UnitTypes');

export type UnitSurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

export interface UnitControllerDeps {
  scene: THREE.Scene;
  presentation: ICampaignPresentation;
  /** 敌方单位被玩家击毁：基础分（协调器乘关卡倍率后入账） */
  awardKill(scoreValue: number, position: THREE.Vector3): void;
  /** 玩家误伤平民 / 友军单位导致其被毁：扣分 */
  applyPenalty(points: number, unitName: string, civilian: boolean): void;
  /** 平民 / 友军单位损失（任何原因），用于结算统计 */
  onAssetLost(civilian: boolean): void;
  /** 单位对玩家造成的伤害（SAM / 自杀无人机 / 炸弹） */
  damagePlayer(damage: number, position: THREE.Vector3): void;
  /** 单位爆炸：镜头震动与爆炸音效（粒子由单位系统自己绘制，避免重复） */
  onExplosion(
    position: THREE.Vector3,
    scale: number,
    kind: 'ground' | 'sea' | 'air' | 'missile'
  ): void;
  /** 护送结果（成功给奖励分） */
  onEscortResult(success: boolean): void;
}

/** 敌机全部清空后，残留单位最多拖住波次的时长（秒，游戏时间），防止卡关 */
const WAVE_STALL_LIMIT_SECONDS = 150;
/** Boss 召唤的无人机同时存在上限 */
const MAX_BOSS_DRONES = 8;
/** 锁定告警无线电的最短间隔（秒） */
const MISSILE_WARNING_RADIO_COOLDOWN = 9;

/**
 * 地面 / 海上 / 空中单位的运行时接线（api-spec §3 + integration-notes「Units」）：
 * 采样器、热焰弹诱饵、关卡强度、模型预热、单位开火桥接、逐帧上下文、按波部署、
 * 波次门控、得分 / 扣分、玩家子弹与导弹的半径命中、EMP、雷达点位。
 *
 * UnitSystem 体积较大，按需加载；加载完成前所有查询返回空结果。
 */
export class UnitController {
  private system: UnitSystem | null = null;
  private meshModule: UnitMeshModule | null = null;
  private deploymentModule: UnitDeploymentModule | null = null;
  private typesModule: UnitTypesModule | null = null;
  private loadPromise: Promise<UnitSystem> | null = null;
  private unbridgeFire: (() => void) | null = null;
  private disposed = false;

  private surfaceSampler: UnitSurfaceSampler | null = null;
  private decoyProvider: IDecoyProvider | null = null;
  private routeProvider: UnitRouteProvider | null = null;
  private scaling: LevelScaling = getLevelScaling(1);
  private level = 1;
  private prewarmedLevel = -1;

  // 波次门控
  private waveStallTimer = 0;
  private waveReleased = false;

  // 告警
  private lastLockState: PlayerLockState = 'none';
  private missileWarningCooldown = 0;

  // 每帧复用
  private readonly updateContext: UnitUpdateContext = {
    playerMesh: new THREE.Object3D(),
    playerPosition: new THREE.Vector3(),
    enemyAirMeshes: [],
    friendlyAirMeshes: [],
  };
  private readonly missileTargets: THREE.Object3D[] = [];
  private readonly muzzleDirection = new THREE.Vector3();
  private readonly playerPosition = new THREE.Vector3();
  private readonly hitPoint = new THREE.Vector3();
  private bossDroneCount = 0;

  constructor(private readonly deps: UnitControllerDeps) {}

  /** 加载并创建 UnitSystem（particleSystem 用于单位自带的爆炸 / 冒烟 / 水花） */
  public ensureLoaded(particleSystem: ParticleSystem): Promise<UnitSystem> {
    if (this.system) return Promise.resolve(this.system);
    if (!this.loadPromise) {
      this.loadPromise = Promise.all([
        import('@/features/units/UnitSystem'),
        import('@/features/units/UnitMeshFactory'),
        import('@/features/units/UnitEventBridge'),
        import('@/features/units/UnitDeployments'),
        import('@/features/units/UnitTypes'),
      ]).then(([unitsModule, meshModule, bridgeModule, deploymentModule, typesModule]) => {
        this.meshModule = meshModule;
        this.deploymentModule = deploymentModule;
        this.typesModule = typesModule;
        const system = new unitsModule.UnitSystem(this.deps.scene, particleSystem);
        system.init();
        this.attach(system, bridgeModule, particleSystem);
        this.system = system;
        if (this.disposed) {
          system.dispose();
        }
        return system;
      });
    }
    return this.loadPromise;
  }

  public isReady(): boolean {
    return this.system !== null;
  }

  public getSystem(): UnitSystem | null {
    return this.system;
  }

  private attach(
    system: UnitSystem,
    bridgeModule: UnitBridgeModule,
    particleSystem: ParticleSystem
  ): void {
    if (this.surfaceSampler) system.setSurfaceSampler(this.surfaceSampler);
    system.setDecoyProvider(this.decoyProvider);
    system.setRouteProvider(this.routeProvider);
    system.setLevelScaling(this.scaling);
    this.unbridgeFire = bridgeModule.bridgeUnitFireToEventBus(system);

    // VFX 已就绪：受损冒烟 / 舰船水花 / 炮口焰换成专用特效
    system.setEffectOverrides({
      damageSmoke: (position, intensity) => particleSystem.createDamageSmoke(position, intensity),
      splash: (position, scale) => particleSystem.createSplash(position, scale),
      muzzleFlash: (position, intensity) => {
        // 单位炮口焰没有方向：朝向玩家（多数开火目标），否则朝上
        this.muzzleDirection.subVectors(this.playerPosition, position);
        if (this.muzzleDirection.lengthSq() < 1e-6) this.muzzleDirection.set(0, 1, 0);
        this.muzzleDirection.normalize();
        particleSystem.createMuzzleFlash(position, this.muzzleDirection, Math.min(1.6, intensity));
      },
    });

    system.onUnitDestroyed = (unit, position, byPlayer) =>
      this.handleUnitDestroyed(unit, position, byPlayer);
    system.onCivilianHit = () => {
      this.deps.presentation.genericRadio('civilian-hit');
      this.deps.presentation.flashWarning('停火！那是平民目标！', 'threat');
    };
    system.onEscortResult = (success) => {
      this.deps.presentation.genericRadio(success ? 'escort-success' : 'escort-failed');
      this.deps.onEscortResult(success);
    };
    system.onLockWarning = (_unit, phase) => {
      this.deps.presentation.onUnitEvent(
        phase === 'locking' ? 'sam-locking' : 'sam-launched',
        null
      );
      if (phase === 'launched' && this.missileWarningCooldown <= 0) {
        this.missileWarningCooldown = MISSILE_WARNING_RADIO_COOLDOWN;
        this.deps.presentation.genericRadio('missile-warning');
        this.deps.presentation.flashWarning('导弹来袭 · 按 G 投放热焰弹', 'threat');
      }
    };
    system.onPlayerDamaged = (damage, _cause, position) => this.deps.damagePlayer(damage, position);
    system.onFirstContact = (type) => this.deps.presentation.unitFirstContact(type);
    system.onExplosion = (position, scale, kind) => this.deps.onExplosion(position, scale, kind);
    system.onUnitEvent = (_unit, kind, position) =>
      this.deps.presentation.onUnitEvent(kind as UnitPresentationEvent, position);
  }

  private handleUnitDestroyed(
    unit: UnitInstance,
    position: THREE.Vector3,
    byPlayer: boolean
  ): void {
    const config = unit.config;
    if (unit.faction === Faction.ENEMY) {
      if (byPlayer && config.scoreValue > 0) {
        this.deps.awardKill(config.scoreValue, position);
      }
      if (unit.type === this.typesModule?.UnitType.DRONE && this.bossDroneCount > 0) {
        this.bossDroneCount--;
      }
    } else {
      const civilian = unit.faction === Faction.CIVILIAN;
      this.deps.onAssetLost(civilian);
      this.deps.presentation.genericRadio(civilian ? 'civilian-destroyed' : 'ally-unit-destroyed');
      if (byPlayer && config.penalty > 0) {
        this.deps.applyPenalty(config.penalty, config.name, civilian);
      }
    }
    const event: UnitPresentationEvent =
      unit.domain === 'ground'
        ? 'destroyed-ground'
        : unit.domain === 'sea'
          ? 'destroyed-sea'
          : 'destroyed-air';
    this.deps.presentation.onUnitEvent(event, position);
  }

  // ───────────────────────────── 配置 ─────────────────────────────

  public setSurfaceSampler(sampler: UnitSurfaceSampler): void {
    this.surfaceSampler = sampler;
    this.system?.setSurfaceSampler(sampler);
  }

  public setDecoyProvider(provider: IDecoyProvider | null): void {
    this.decoyProvider = provider;
    this.system?.setDecoyProvider(provider);
  }

  /** 'route' 放置的外部航线（峡谷车队土路 / 城堡突击路线） */
  public setRouteProvider(provider: UnitRouteProvider | null): void {
    this.routeProvider = provider;
    this.system?.setRouteProvider(provider);
  }

  /** 关卡强度（getLevelScaling × 玩家难度档） */
  public setLevel(level: number, profile: DifficultyProfile): void {
    this.level = level;
    const base = getLevelScaling(level);
    this.scaling = {
      ...base,
      enemyHealthMultiplier: base.enemyHealthMultiplier * profile.enemyHealthMultiplier,
      unitHealthMultiplier: base.unitHealthMultiplier * profile.enemyHealthMultiplier,
      enemyDamageMultiplier: base.enemyDamageMultiplier * profile.enemyDamageMultiplier,
      enemyCooldownMultiplier: base.enemyCooldownMultiplier * profile.enemyAttackCooldownMultiplier,
      bossCooldownMultiplier: base.bossCooldownMultiplier * profile.bossCooldownMultiplier,
    };
    this.system?.setLevelScaling(this.scaling);
  }

  /** 预热本关会部署的单位模型（首次烘焙 5-40 ms/种，放到加载 / 波次间隙） */
  public prewarmLevel(level: number): void {
    const meshModule = this.meshModule;
    const deployments = this.deploymentModule;
    if (!meshModule || !deployments || this.prewarmedLevel === level) return;
    this.prewarmedLevel = level;
    const types = new Set<UnitType>();
    const waves = deployments.getDeploymentWaveCount(level);
    for (let wave = 0; wave < waves; wave++) {
      for (const spec of deployments.getWaveDeployment(level, wave)) {
        types.add(spec.type);
      }
    }
    if (types.size > 0) {
      meshModule.prewarmUnitMeshes([...types]);
    }
  }

  // ───────────────────────────── 波次 ─────────────────────────────

  /** 波次开始时部署本波单位（与敌机波次并行） */
  public spawnForWave(level: number, waveIndex: number, playerPosition: THREE.Vector3): number {
    this.waveStallTimer = 0;
    this.waveReleased = false;
    const system = this.system;
    if (!system) return 0;
    return system.spawnForWave(level, waveIndex, playerPosition).length;
  }

  /**
   * 波次门控：存活敌方单位数（含潜航潜艇）。敌机清空后若单位拖住波次超过上限则放行，避免卡关。
   */
  public getWaveHoldCount(): number {
    if (this.waveReleased) return 0;
    return this.system?.getAliveHostileCount() ?? 0;
  }

  public getAliveHostileCount(): number {
    return this.system?.getAliveHostileCount() ?? 0;
  }

  // ───────────────────────────── 每帧 ─────────────────────────────

  /**
   * 逐帧更新：playerMesh / 敌我喷气机列表由协调器提供（数组可复用）。
   * jetsCleared：本波敌机已全部清空（用于防卡关计时）。
   */
  public update(
    deltaTime: number,
    playerMesh: THREE.Object3D,
    playerPosition: THREE.Vector3,
    enemyAirMeshes: THREE.Object3D[],
    friendlyAirMeshes: THREE.Object3D[],
    jetsCleared: boolean
  ): void {
    const system = this.system;
    if (!system) return;
    this.playerPosition.copy(playerPosition);
    const ctx = this.updateContext;
    ctx.playerMesh = playerMesh;
    ctx.playerPosition.copy(playerPosition);
    ctx.enemyAirMeshes = enemyAirMeshes;
    ctx.friendlyAirMeshes = friendlyAirMeshes;
    system.updateWithContext(deltaTime, ctx);

    if (this.missileWarningCooldown > 0) this.missileWarningCooldown -= deltaTime;

    // 防卡关：敌机已清空但单位迟迟未清（例如潜艇长时间潜航）
    if (jetsCleared && !this.waveReleased && system.getAliveHostileCount() > 0) {
      this.waveStallTimer += deltaTime;
      if (this.waveStallTimer >= WAVE_STALL_LIMIT_SECONDS) {
        this.waveReleased = true;
        this.deps.presentation.flashWarning('残余目标脱离战区', 'sys');
      }
    } else if (!jetsCleared) {
      this.waveStallTimer = 0;
    }

    // 锁定告警（第 2 轮：HUD.setMissileWarning）
    const lockState = system.getPlayerLockState();
    if (lockState !== this.lastLockState) {
      this.lastLockState = lockState;
      this.deps.presentation.setMissileWarning(lockState);
    }
    this.deps.presentation.setRadarRangeMultiplier(system.getRadarRangeMultiplier());
  }

  /**
   * 玩家机炮：逐颗子弹做单位半径命中（userData.aimPoint 中心 + hitRadius），
   * 友军单位不受玩家火力影响（子弹穿过），平民会被误伤（扣分由单位系统回调处理）。
   */
  public applyPlayerBulletHits(
    pool: ProjectilePool,
    onHit: (position: THREE.Vector3, hostile: boolean) => void
  ): void {
    const system = this.system;
    if (!system || !pool.hasActiveProjectiles()) return;
    pool.consumeHits((position, damage) => {
      const unit = system.hitTest(position, 1);
      if (!unit || unit.faction === Faction.FRIENDLY) return false;
      this.hitPoint.copy(position);
      unit.applyDamage(damage, 'cannon', this.hitPoint);
      onHit(this.hitPoint, unit.faction === Faction.ENEMY);
      return true;
    });
  }

  /** 玩家锁定导弹：对敌方单位的瞄准点做命中判定 */
  public applyPlayerMissileHits(
    missileSystem: MissileSystem,
    damage: number,
    onHit: (position: THREE.Vector3) => void
  ): void {
    const system = this.system;
    if (!system || missileSystem.getActiveCount() === 0) return;
    const targets = this.missileTargets;
    targets.length = 0;
    for (const mesh of system.getHostileMeshes()) {
      targets.push(this.getAimObject(mesh));
    }
    if (targets.length === 0) return;
    missileSystem.checkCollisions(targets, (target, impact) => {
      const unit = system.findByMesh(target);
      if (!unit) return;
      unit.applyDamage(damage, 'missile', impact);
      onHit(impact);
    });
  }

  /** 锁定候选：敌方单位的瞄准点（雷达站优先） */
  public collectLockTargets(out: THREE.Object3D[]): void {
    const system = this.system;
    if (!system) return;
    for (const mesh of system.getHostileMeshes()) {
      out.push(this.getAimObject(mesh));
    }
  }

  private getAimObject(mesh: THREE.Object3D): THREE.Object3D {
    const aim: unknown = mesh.userData.aimPoint;
    return aim instanceof THREE.Object3D ? aim : mesh;
  }

  /** 敌方子弹命中友军单位（'enemy-fire'）；返回是否为单位 */
  public applyHostileFireToUnit(
    target: THREE.Object3D,
    damage: number,
    at: THREE.Vector3
  ): boolean {
    const unit = this.system?.findByMesh(target);
    if (!unit) return false;
    unit.applyDamage(damage, 'enemy-fire', at);
    return true;
  }

  /** 友军单位网格（敌方子弹可命中） */
  public appendFriendlyMeshes(out: THREE.Object3D[]): void {
    const system = this.system;
    if (!system) return;
    for (const mesh of system.getFriendlyMeshes()) out.push(mesh);
  }

  /** 特殊武器目标：全部可命中的单位（敌 / 友 / 平民，由武器系统按阵营过滤） */
  public appendCombatTargets(out: CombatTarget[]): void {
    const system = this.system;
    if (!system) return;
    for (const target of system.getCombatTargets()) out.push(target);
  }

  /** EMP：瘫痪敌方单位 + 摧毁半径内的单位导弹 */
  public applyEmp(center: THREE.Vector3, radius: number, seconds: number): void {
    const system = this.system;
    if (!system) return;
    system.applyAreaStun(center, radius, seconds);
    system.destroyMissilesInRadius(center, radius);
  }

  /** Boss 召唤的自杀无人机（UnitType.DRONE）；单位系统未就绪或已达上限返回 false */
  public spawnBossDrone(position: THREE.Vector3): boolean {
    const system = this.system;
    const types = this.typesModule;
    if (!system || !types || this.bossDroneCount >= MAX_BOSS_DRONES) return false;
    const unit = system.spawnUnit(types.UnitType.DRONE, position);
    if (!unit) return false;
    this.bossDroneCount++;
    return true;
  }

  /** 雷达点位（条目复用，下一次调用前有效） */
  public getRadarBlips(): Array<{ position: THREE.Vector3; kind: UnitRadarKind }> {
    return this.system?.getRadarBlips() ?? [];
  }

  public getHostileRadarBonus(): number {
    return this.system?.getHostileRadarBonus() ?? 0;
  }

  public getCurrentLevel(): number {
    return this.level;
  }

  /** 换关 / 读档 / Boss 战开始：移除全部单位、导弹与弹道 */
  public clear(): void {
    this.system?.clear();
    this.bossDroneCount = 0;
    this.waveStallTimer = 0;
    this.waveReleased = false;
    if (this.lastLockState !== 'none') {
      this.lastLockState = 'none';
      this.deps.presentation.setMissileWarning('none');
    }
  }

  /** 新开一局：首次接触提示重新生效 */
  public resetFirstContacts(): void {
    this.system?.resetFirstContacts();
  }

  public dispose(): void {
    this.disposed = true;
    this.unbridgeFire?.();
    this.unbridgeFire = null;
    this.system?.dispose();
    this.system = null;
  }
}
