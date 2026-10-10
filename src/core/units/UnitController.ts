import * as THREE from 'three';
import { GameConfig } from '@/config';
import type { CombatTarget, IDecoyProvider } from '@/core/CombatContracts';
import { getLevelScaling, type DifficultyProfile, type LevelScaling } from '@/core/Difficulty';
import { Faction } from '@/core/Faction';
import type {
  ICampaignPresentation,
  UnitPresentationEvent,
} from '@/core/campaign/CampaignPresentation';
import type { GenericRadioKey } from '@/features/campaign/CampaignData';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { ProjectilePool } from '@/features/combat/ProjectilePool';
import type { MissileSystem } from '@/features/combat/MissileSystem';
import type {
  HostileUnitVisitor,
  PlayerLockState,
  UnitInstance,
  UnitRouteProvider,
  UnitSystem,
  UnitUpdateContext,
} from '@/features/units/UnitSystem';
import type { UnitDomain, UnitRadarKind, UnitType } from '@/features/units/UnitTypes';
import { tr, type LocalizedText } from '@/i18n';
import { RadioBudget, type RadioBudgetConfig } from '@/core/campaign/RadioBudget';

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
  /** 单位爆炸：镜头震动（粒子由单位系统自己绘制；爆炸声经表现层播放，单位被毁时换成专属音效） */
  onExplosion(
    position: THREE.Vector3,
    scale: number,
    kind: 'ground' | 'sea' | 'air' | 'missile'
  ): void;
  /** 护送结果（成功给奖励分） */
  onEscortResult(success: boolean): void;
}

/**
 * 敌机全部清空后，残留单位最多拖住波次的时长（秒，游戏时间），防止卡关。
 * 玩家每次打中敌方单位都会重新计时：正在进攻的玩家不会被打断，够不着目标的玩家一分钟后放行。
 */
const WAVE_STALL_LIMIT_SECONDS = 60;
/** Boss 召唤的无人机同时存在上限 */
const MAX_BOSS_DRONES = 8;
/**
 * 导弹来袭的配音：每波（每场 Boss 战）最多两次，第二次至少隔 20 秒（之后的冷却逐次加长）；
 * HUD 闪烁告警与告警音每次发射都有。
 */
const MISSILE_WARNING_RADIO: RadioBudgetConfig = { maxPerWave: 2, cooldownSeconds: [20, 45] };
/** 误伤平民的配音：同样每波最多两次（HUD 告警与音效每次都有） */
const CIVILIAN_HIT_RADIO: RadioBudgetConfig = { maxPerWave: 2, cooldownSeconds: [15, 30] };
const MISSILE_INBOUND_WARNING: LocalizedText = {
  en: 'Missile inbound · Press G for flares',
  zh: '导弹来袭 · 按 G 投放热焰弹',
};
/** 触控设备没有 G 键：指向屏幕上的热焰键（键面文字见 main.ts 的 localizeShell） */
const MISSILE_INBOUND_WARNING_TOUCH: LocalizedText = {
  en: 'Missile inbound · Tap FLARE',
  zh: '导弹来袭 · 点「热焰」键',
};
const CEASE_FIRE_WARNING: LocalizedText = {
  en: 'Cease fire! Those are civilians!',
  zh: '停火！那是平民目标！',
};
const TARGETS_LEFT_AREA_WARNING: LocalizedText = {
  en: 'Remaining targets have left the area',
  zh: '残余目标脱离战区',
};

/** HUD 目标标记的访问函数：网格、当前 / 最大血量（只给可被命中的敌方单位） */
export type HostileMarkerVisitor = (
  mesh: THREE.Object3D,
  health: number,
  maxHealth: number
) => void;

/**
 * 敌机清空后仍有敌方单位拖住波次时的提示（每波一次）：按剩余单位的作战域选词，
 * [单数, 复数] 各一条；mixed 为多个作战域混合。
 */
type ObjectiveHintKind = UnitDomain | 'mixed';
const OBJECTIVE_HINTS: Readonly<
  Record<ObjectiveHintKind, readonly [LocalizedText, LocalizedText]>
> = {
  ground: [
    { en: 'Ground target remaining · follow the marker', zh: '地面目标尚未清除 · 跟随标记前往' },
    { en: 'Ground targets remaining · follow the markers', zh: '地面目标尚未清除 · 跟随标记前往' },
  ],
  sea: [
    { en: 'Enemy ship remaining · follow the marker', zh: '敌舰尚未清除 · 跟随标记前往' },
    { en: 'Enemy ships remaining · follow the markers', zh: '敌舰尚未清除 · 跟随标记前往' },
  ],
  air: [
    { en: 'Air target remaining · follow the marker', zh: '空中目标尚未清除 · 跟随标记前往' },
    { en: 'Air targets remaining · follow the markers', zh: '空中目标尚未清除 · 跟随标记前往' },
  ],
  mixed: [
    { en: 'Targets remaining · follow the markers', zh: '仍有目标尚未清除 · 跟随标记前往' },
    { en: 'Targets remaining · follow the markers', zh: '仍有目标尚未清除 · 跟随标记前往' },
  ],
};
/** 剩下的全是潜航中的潜艇：没有屏幕标记可跟，只能看雷达等它上浮 */
const OBJECTIVE_SUBMERGED_HINT: LocalizedText = {
  en: 'Submarine submerged · watch the radar until it surfaces',
  zh: '潜艇潜航中 · 留意雷达，等它上浮',
};
/**
 * 友军单位被毁时的专属无线电（键为 UnitType 字符串值，如 ALLY_AWACS / ALLY_FRIGATE，
 * 值为 GENERIC_RADIO 的键）；未登记的类型播通用的 'ally-unit-destroyed'。
 * 首次遭遇台词不经过这里：UnitSystem.onFirstContact → presentation.unitFirstContact
 * （UNIT_FIRST_CONTACT_RADIO，友军预警机 / 护卫舰同样走这条路径）。
 */
const ALLY_LOSS_RADIO: Readonly<Partial<Record<string, GenericRadioKey>>> = {
  ALLY_AWACS: 'awacs-lost',
  ALLY_FRIGATE: 'frigate-lost',
};

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
  /** 敌机已清空、敌方单位仍拖住波次：HUD 把它们的标记换成“目标”样式 */
  private objectiveActive = false;
  /** 本波的“剩余目标”提示已经给过（每波一次） */
  private objectiveHintShown = false;
  // 提示选词时的计数（forEachAliveHostile 回调复用）
  private remainingGround = 0;
  private remainingSea = 0;
  private remainingAir = 0;
  private remainingTargetable = 0;
  private markerVisitor: HostileMarkerVisitor | null = null;

  // 告警（配音配额每波 / 每场 Boss 战重新计数：spawnForWave / clear）
  private lastLockState: PlayerLockState = 'none';
  private readonly missileWarningRadio = new RadioBudget(MISSILE_WARNING_RADIO);
  private readonly civilianHitRadio = new RadioBudget(CIVILIAN_HIT_RADIO);

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
  private bulletHitCallback: ((position: THREE.Vector3, hostile: boolean) => void) | null = null;
  private missileHitCallback: ((position: THREE.Vector3) => void) | null = null;
  private missileHitDamage = 0;
  private bossDroneCount = 0;
  /**
   * 待播放的爆炸声：单位被毁时 UnitSystem 先报 onExplosion 再报 onUnitDestroyed，
   * 被毁的那一次换成 playUnitDestroyed(domain)（专属音效，避免两声爆炸叠在一起）；
   * 其余爆炸（导弹引爆、炸弹落地、残骸坠地）在下一个结算点补播。
   */
  private explosionSoundPending = false;
  private readonly explosionSoundPosition = new THREE.Vector3();
  private explosionSoundScale = 1;

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
    system.onUnitDamaged = (unit, _amount, byPlayer) => {
      // 玩家还在打敌方单位：防卡关计时重新开始，不会打到一半被放行
      if (byPlayer && unit.faction === Faction.ENEMY) this.waveStallTimer = 0;
    };
    system.onCivilianHit = () => {
      // HUD 告警与音效每次都有；配音按配额（进了无线电才计数）
      if (this.civilianHitRadio.isReady() && this.deps.presentation.genericRadio('civilian-hit')) {
        this.civilianHitRadio.consume();
      }
      // 双语原文交给 HUD：告警显示期间切换语言随之重绘
      this.deps.presentation.flashWarning(CEASE_FIRE_WARNING, 'threat');
      this.deps.presentation.onUnitEvent('civilian-hit', null);
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
      if (phase !== 'launched') return;
      // 每次发射：HUD 闪烁告警（告警音见上）；配音按配额，进了无线电才计数
      this.deps.presentation.flashWarning(
        GameConfig.isMobile ? MISSILE_INBOUND_WARNING_TOUCH : MISSILE_INBOUND_WARNING,
        'threat'
      );
      if (
        this.missileWarningRadio.isReady() &&
        this.deps.presentation.genericRadio('missile-warning')
      ) {
        this.missileWarningRadio.consume();
      }
    };
    system.onPlayerDamaged = (damage, _cause, position) => this.deps.damagePlayer(damage, position);
    system.onFirstContact = (type) => this.deps.presentation.unitFirstContact(type);
    system.onExplosion = (position, scale, kind) => {
      this.flushExplosionSound();
      this.explosionSoundPending = true;
      this.explosionSoundPosition.copy(position);
      this.explosionSoundScale = kind === 'missile' ? scale * 0.8 : scale;
      this.deps.onExplosion(position, scale, kind);
    };
    system.onUnitEvent = (_unit, kind, position) =>
      this.deps.presentation.onUnitEvent(kind as UnitPresentationEvent, position);
  }

  /** 补播上一声普通爆炸（未被“单位被毁”取代） */
  private flushExplosionSound(): void {
    if (!this.explosionSoundPending) return;
    this.explosionSoundPending = false;
    this.deps.presentation.onUnitEvent(
      'explosion',
      this.explosionSoundPosition,
      this.explosionSoundScale
    );
  }

  private handleUnitDestroyed(
    unit: UnitInstance,
    position: THREE.Vector3,
    byPlayer: boolean
  ): void {
    // 被毁的爆炸声由 playUnitDestroyed(domain) 取代
    this.explosionSoundPending = false;
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
      this.deps.presentation.genericRadio(
        civilian ? 'civilian-destroyed' : (ALLY_LOSS_RADIO[unit.type] ?? 'ally-unit-destroyed')
      );
      if (byPlayer && config.penalty > 0) {
        this.deps.applyPenalty(config.penalty, tr(config.name), civilian);
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

  /** 当前的地表采样器（展开的关卡地图用它画陆地 / 水域底图）；未设置时为 null */
  public getSurfaceSampler(): UnitSurfaceSampler | null {
    return this.surfaceSampler;
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

  /** 波次开始时部署本波单位（与敌机波次并行）；告警配音配额重新计数 */
  public spawnForWave(level: number, waveIndex: number, playerPosition: THREE.Vector3): number {
    this.waveStallTimer = 0;
    this.waveReleased = false;
    this.objectiveActive = false;
    this.objectiveHintShown = false;
    this.resetRadioBudgets();
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

  /**
   * 敌机已清空、敌方单位仍拖住波次（尚未放行）：这些单位就是玩家此刻的目标，
   * HUD 把它们的标记换成“目标”样式。
   */
  public isObjectiveActive(): boolean {
    return this.objectiveActive;
  }

  /**
   * HUD 目标标记：逐个访问此刻可被命中的敌方单位（潜航中的潜艇不在内），不分配。
   * 网格是单位根节点（UNIT_*，userData.displayName 为双语显示名）。
   */
  public forEachHostileMarker(visit: HostileMarkerVisitor): void {
    const system = this.system;
    if (!system) return;
    this.markerVisitor = visit;
    system.forEachAliveHostile(this.visitMarker);
    this.markerVisitor = null;
  }

  private readonly visitMarker: HostileUnitVisitor = (
    mesh,
    health,
    maxHealth,
    _domain,
    targetable
  ) => {
    if (targetable) this.markerVisitor?.(mesh, health, maxHealth);
  };

  private readonly countRemaining: HostileUnitVisitor = (
    _mesh,
    _health,
    _maxHealth,
    domain,
    targetable
  ) => {
    if (domain === 'ground') this.remainingGround++;
    else if (domain === 'sea') this.remainingSea++;
    else this.remainingAir++;
    if (targetable) this.remainingTargetable++;
  };

  /** “剩余目标”提示：按剩下的单位是地面 / 海上 / 空中 / 混合选词 */
  private showObjectiveHint(system: UnitSystem): void {
    this.remainingGround = 0;
    this.remainingSea = 0;
    this.remainingAir = 0;
    this.remainingTargetable = 0;
    system.forEachAliveHostile(this.countRemaining);
    const total = this.remainingGround + this.remainingSea + this.remainingAir;
    if (total === 0) return;
    let text: LocalizedText;
    if (this.remainingTargetable === 0) {
      text = OBJECTIVE_SUBMERGED_HINT;
    } else {
      const kind: ObjectiveHintKind =
        this.remainingGround === total
          ? 'ground'
          : this.remainingSea === total
            ? 'sea'
            : this.remainingAir === total
              ? 'air'
              : 'mixed';
      text = OBJECTIVE_HINTS[kind][total > 1 ? 1 : 0];
    }
    // 双语原文交给 HUD：提示显示期间切换语言随之重绘
    this.deps.presentation.flashWarning(text, 'sys');
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
    this.flushExplosionSound();
    this.playerPosition.copy(playerPosition);
    const ctx = this.updateContext;
    ctx.playerMesh = playerMesh;
    ctx.playerPosition.copy(playerPosition);
    ctx.enemyAirMeshes = enemyAirMeshes;
    ctx.friendlyAirMeshes = friendlyAirMeshes;
    system.updateWithContext(deltaTime, ctx);
    this.flushExplosionSound();

    this.missileWarningRadio.update(deltaTime);
    this.civilianHitRadio.update(deltaTime);

    // 敌机已清空但单位还在：它们就是玩家此刻的目标（标记换样式，每波提示一次）；
    // 防卡关：迟迟未清（够不着 / 潜艇长时间潜航）则放行，玩家每次命中敌方单位都重新计时
    const holding = jetsCleared && !this.waveReleased && system.getAliveHostileCount() > 0;
    if (holding) {
      if (!this.objectiveHintShown) {
        this.objectiveHintShown = true;
        this.showObjectiveHint(system);
      }
      this.waveStallTimer += deltaTime;
      if (this.waveStallTimer >= WAVE_STALL_LIMIT_SECONDS) {
        this.waveReleased = true;
        this.deps.presentation.flashWarning(TARGETS_LEFT_AREA_WARNING, 'sys');
      }
    } else if (!jetsCleared) {
      this.waveStallTimer = 0;
    }
    this.objectiveActive = holding && !this.waveReleased;

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
    if (!this.system || !pool.hasActiveProjectiles()) return;
    this.bulletHitCallback = onHit;
    pool.consumeHits(this.bulletHitTest);
    this.bulletHitCallback = null;
  }

  /** consumeHits 的判定函数（预先绑定，避免每帧创建闭包） */
  private readonly bulletHitTest = (position: THREE.Vector3, damage: number): boolean => {
    const unit = this.system?.hitTest(position, 1);
    if (!unit || unit.faction === Faction.FRIENDLY) return false;
    this.hitPoint.copy(position);
    unit.applyDamage(damage, 'cannon', this.hitPoint);
    this.bulletHitCallback?.(this.hitPoint, unit.faction === Faction.ENEMY);
    return true;
  };

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
    this.missileHitDamage = damage;
    this.missileHitCallback = onHit;
    missileSystem.checkCollisions(targets, this.missileHitHandler);
    this.missileHitCallback = null;
  }

  private readonly missileHitHandler = (target: THREE.Object3D, impact: THREE.Vector3): void => {
    const unit = this.system?.findByMesh(target);
    if (!unit) return;
    unit.applyDamage(this.missileHitDamage, 'missile', impact);
    this.missileHitCallback?.(impact);
  };

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

  /** 换关 / 读档 / Boss 战开始：移除全部单位、导弹与弹道；告警配音配额重新计数 */
  public clear(): void {
    this.system?.clear();
    this.explosionSoundPending = false;
    this.bossDroneCount = 0;
    this.waveStallTimer = 0;
    this.waveReleased = false;
    this.objectiveActive = false;
    this.objectiveHintShown = false;
    this.resetRadioBudgets();
    if (this.lastLockState !== 'none') {
      this.lastLockState = 'none';
      this.deps.presentation.setMissileWarning('none');
    }
  }

  private resetRadioBudgets(): void {
    this.missileWarningRadio.reset();
    this.civilianHitRadio.reset();
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
