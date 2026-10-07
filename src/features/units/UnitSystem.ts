import * as THREE from 'three';
import type {
  CombatTarget,
  DamageSource,
  DecoyPoint,
  IDecoyProvider,
} from '@/core/CombatContracts';
import { getLevelScaling, type LevelScaling } from '@/core/Difficulty';
import { Faction } from '@/core/Faction';
import type { IGameSystem } from '@/core/interfaces/IGameSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { updateUnitBehavior } from './UnitBehaviors';
import { getWaveDeployment } from './UnitDeployments';
import { UnitEntity, isPlayerDamageSource, type UnitHost, type UnitInstance } from './UnitEntity';
import { createUnitMesh } from './UnitMeshFactory';
import { setUnitBeaconPhase } from './UnitMeshKit';
import { UnitMissilePool, isFiniteVector, type UnitMissileEnv } from './UnitMissiles';
import {
  UNIT_GUN_PROJECTILE_SPEED,
  UNIT_WATER_Y,
  applyAttitude,
  predictIntercept,
  refreshSurface,
  type UnitWorld,
} from './UnitMotion';
import {
  UNIT_BATTLEFIELD_LIMIT,
  buildRoute,
  clampToBattlefield,
  pickClusterCenter,
  pickUnitPosition,
  pointAlongRoute,
  routeLength,
  type PlacementContext,
  type SurfaceSample,
} from './UnitPlacement';
import { UnitShotPool, type UnitShotEnv } from './UnitProjectiles';
import {
  UNIT_CONFIGS,
  UnitType,
  isUnitType,
  type UnitConfig,
  type UnitDomain,
  type UnitRadarKind,
} from './UnitTypes';

export type { UnitInstance } from './UnitEntity';

/**
 * 地面 / 海上 / 空中作战单位系统（api-spec §3）
 *
 * 职责：按波次部署单位、驱动各类单位的独立行为、管理单位导弹 / 内部弹道 / 炸弹、
 * 结算伤害与死亡演出，并通过回调把开火、告警、爆炸、得分 / 扣分事件交给协调器。
 *
 * - 不访问 document / window；particleSystem 为 null 时只跑逻辑；
 * - 每帧复用预分配向量；所有单位位置做 NaN / Infinity 防护；
 * - clear() / dispose() 移除并释放全部场景对象（共享模板几何与材质除外）。
 */

export interface UnitUpdateContext {
  playerMesh: THREE.Object3D;
  playerPosition: THREE.Vector3;
  /** 现有敌方喷气机（友军单位会向其开火） */
  enemyAirMeshes: THREE.Object3D[];
  /** 现有友军喷气机（敌方单位可能以其为目标） */
  friendlyAirMeshes: THREE.Object3D[];
}

export type UnitSurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

export type PlayerLockState = 'none' | 'locking' | 'incoming';

/**
 * 可选特效覆盖：VFX 批次落地后，协调器可把受损冒烟 / 水花 / 枪口焰换成更强的专用特效
 * （例如 particleSystem.createDamageSmoke / createSplash / createMuzzleFlash），
 * 未设置时使用现有 ParticleSystem 方法组合出的默认效果。
 */
export interface UnitEffectOverrides {
  damageSmoke?: (position: THREE.Vector3, intensity: number) => void;
  splash?: (position: THREE.Vector3, scale: number) => void;
  muzzleFlash?: (position: THREE.Vector3, intensity: number) => void;
}

/** 同时存在的单位上限（超出时 spawnUnit 返回 null） */
export const MAX_UNITS = 80;

const EMPTY_DECOYS: readonly DecoyPoint[] = [];
const EMPTY_OBJECTS: readonly THREE.Object3D[] = [];
const SMOKE_COLOR = new THREE.Color(0.16, 0.16, 0.17);
const DOWN = new THREE.Vector3(0, -1, 0);
const PLAYER_FORWARD = new THREE.Vector3(0, 0, -1);

interface JetTrack {
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  frame: number;
}

export class UnitSystem implements IGameSystem {
  readonly name = 'UnitSystem';

  // ── 规范回调 ──
  onUnitFire?: (
    position: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    faction: Faction,
    owner: THREE.Object3D
  ) => void;
  onUnitDestroyed?: (unit: UnitInstance, position: THREE.Vector3, byPlayer: boolean) => void;
  onCivilianHit?: (unit: UnitInstance) => void;
  onEscortResult?: (success: boolean, unit: UnitInstance) => void;
  onLockWarning?: (unit: UnitInstance, phase: 'locking' | 'launched') => void;
  onPlayerDamaged?: (
    damage: number,
    cause: 'sam' | 'kamikaze' | 'bomb',
    position: THREE.Vector3
  ) => void;
  onFirstContact?: (type: UnitType) => void;
  onExplosion?: (
    position: THREE.Vector3,
    scale: number,
    kind: 'ground' | 'sea' | 'air' | 'missile'
  ) => void;

  // ── 扩展回调（规范之外，可选） ──
  /** 导弹被热焰弹诱骗（可用于“诱饵生效”提示） */
  onMissileDecoyed?: (position: THREE.Vector3) => void;
  /** 单位受伤（命中反馈 / 音效） */
  onUnitDamaged?: (unit: UnitInstance, amount: number, byPlayer: boolean) => void;
  /** 护送目标抵达 / 平民驶出战场后离场 */
  onUnitDeparted?: (unit: UnitInstance, reason: 'arrived' | 'exited') => void;

  private readonly scene: THREE.Scene;
  private readonly particleSystem: ParticleSystem | null;
  private readonly units: UnitEntity[] = [];
  private readonly unitsById = new Map<string, UnitEntity>();
  private readonly missiles: UnitMissilePool;
  private readonly shots: UnitShotPool;
  private sampler: UnitSurfaceSampler | null = null;
  private effects: UnitEffectOverrides = {};
  private decoyProvider: IDecoyProvider | null = null;
  private scaling: LevelScaling = getLevelScaling(1);
  private readonly seenTypes = new Set<UnitType>();
  private time = 0;
  private frame = 0;
  private disposed = false;
  private swarmCounter = 0;

  // ── 每帧状态 ──
  private readonly playerPosition = new THREE.Vector3();
  private readonly playerVelocity = new THREE.Vector3();
  private readonly lastPlayerPosition = new THREE.Vector3();
  private readonly measuredVelocity = new THREE.Vector3();
  private hasLastPlayer = false;
  private playerActive = false;
  private forwardX = 0;
  private forwardZ = -1;
  private enemyAirMeshes: readonly THREE.Object3D[] = EMPTY_OBJECTS;
  private friendlyAirMeshes: readonly THREE.Object3D[] = EMPTY_OBJECTS;
  private readonly allies: UnitEntity[] = [];
  private readonly hostiles: UnitEntity[] = [];
  private decoys: readonly DecoyPoint[] = EMPTY_DECOYS;
  private accuracyBonus = 0;
  private readonly jetTracks = new Map<THREE.Object3D, JetTrack>();
  private readonly surfaceResult: SurfaceSample = { y: 0, water: false };

  // ── 预分配 ──
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly radarBlipPool: Array<{ position: THREE.Vector3; kind: UnitRadarKind }> = [];

  private readonly host: UnitHost;
  private readonly world: UnitWorld;
  private readonly missileEnv: UnitMissileEnv;
  private readonly shotEnv: UnitShotEnv;

  constructor(scene: THREE.Scene, particleSystem: ParticleSystem | null) {
    this.scene = scene;
    this.particleSystem = particleSystem;
    this.missiles = new UnitMissilePool(scene);
    this.shots = new UnitShotPool(scene);
    this.host = {
      onEntityDamaged: (unit, amount, byPlayer, hitPoint) =>
        this.handleDamaged(unit, amount, byPlayer, hitPoint),
      onEntityKilled: (unit, byPlayer) => this.handleKilled(unit, byPlayer),
    };
    this.world = this.createWorld();
    this.missileEnv = this.createMissileEnv();
    this.shotEnv = this.createShotEnv();
  }

  init(): void {
    // 资源在构造时已就绪；保留以满足 IGameSystem
  }

  /** 规范要求的空包装：单位更新需要玩家上下文，请调用 updateWithContext */
  update(_deltaTime: number): void {}

  // ───────────────────────────── 配置 ─────────────────────────────

  setSurfaceSampler(sampler: UnitSurfaceSampler | null): void {
    this.sampler = typeof sampler === 'function' ? sampler : null;
    for (const unit of this.units) {
      unit.surfaceSampleX = Number.NaN;
    }
  }

  /** 扩展：替换默认特效（见 UnitEffectOverrides） */
  setEffectOverrides(overrides: UnitEffectOverrides | null): void {
    this.effects = overrides ?? {};
  }

  setDecoyProvider(provider: IDecoyProvider | null): void {
    this.decoyProvider = provider;
  }

  setLevelScaling(scaling: LevelScaling): void {
    if (!scaling) return;
    this.scaling = scaling;
    for (const unit of this.units) {
      if (unit.isAlive()) unit.rescaleHealth(this.healthMultiplierFor(unit.config));
    }
  }

  getLevelScaling(): LevelScaling {
    return this.scaling;
  }

  // ───────────────────────────── 生成 ─────────────────────────────

  spawnForWave(level: number, waveIndex: number, playerPosition: THREE.Vector3): UnitInstance[] {
    if (this.disposed || !playerPosition || !isFiniteVector(playerPosition)) return [];
    const specs = getWaveDeployment(level, waveIndex);
    if (specs.length === 0) return [];
    const ctx = this.createPlacementContext(playerPosition);
    const spawned: UnitInstance[] = [];
    for (const spec of specs) {
      const config = UNIT_CONFIGS[spec.type];
      const domain = config.domain;
      const count = Math.max(0, Math.min(24, Math.floor(spec.count)));
      if (count === 0) continue;
      if (spec.placement === 'route') {
        this.spawnRouteGroup(ctx, spec.type, domain, count, spawned);
        continue;
      }
      const center =
        spec.placement === 'around' ? null : pickClusterCenter(ctx, spec.placement, domain);
      if (!center && spec.placement !== 'around' && domain === 'sea' && this.sampler) continue;
      const swarmId = spec.type === UnitType.DRONE ? ++this.swarmCounter : -1;
      for (let i = 0; i < count; i++) {
        const position = pickUnitPosition(ctx, spec.type, domain, spec.placement, center);
        if (!position) continue;
        const unit = this.spawnUnit(spec.type, position);
        if (!unit) continue;
        const entity = unit as UnitEntity;
        entity.swarmId = swarmId;
        entity.heading = Math.atan2(playerPosition.x - position.x, playerPosition.z - position.z);
        applyAttitude(entity);
        spawned.push(unit);
      }
    }
    return spawned;
  }

  private spawnRouteGroup(
    ctx: PlacementContext,
    type: UnitType,
    domain: UnitDomain,
    count: number,
    out: UnitInstance[]
  ): void {
    const config = UNIT_CONFIGS[type];
    // 平民空中 / 海上单位各走各的航线；车队、卡车与运输机沿同一航线排成纵列
    const separateRoutes = !config.isEscort && domain !== 'ground';
    const spacing = domain === 'ground' ? 26 : domain === 'sea' ? 150 : 140;
    let route: THREE.Vector3[] = [];
    let columnStart = 0;
    for (let i = 0; i < count; i++) {
      if (i === 0 || separateRoutes) {
        route = buildRoute(ctx, type, domain);
        // 纵列：头车在前，后车沿航线依次排开（全部位于已校验的航线上）
        columnStart = separateRoutes
          ? 0
          : Math.min((count - 1) * spacing, routeLength(route) * 0.4);
      }
      if (route.length < 2) continue;
      const along = separateRoutes ? 0 : Math.max(0, columnStart - i * spacing);
      const position = pointAlongRoute(route, along, new THREE.Vector3());
      const remaining = route.filter(
        (_point, index) => index > 0 && routeDistanceTo(route, index) > along
      );
      const unit = this.spawnUnit(type, position, {
        route: (remaining.length > 0 ? remaining : [route[route.length - 1]]).map((p) => p.clone()),
      });
      if (unit) out.push(unit);
    }
  }

  spawnUnit(
    type: UnitType,
    position: THREE.Vector3,
    options?: { route?: THREE.Vector3[] }
  ): UnitInstance | null {
    if (this.disposed || !isUnitType(type) || !position || !isFiniteVector(position)) return null;
    if (this.units.length >= MAX_UNITS) return null;
    const config = UNIT_CONFIGS[type];
    const mesh = createUnitMesh(type);
    const unit = new UnitEntity(type, config, mesh, this.host, this.healthMultiplierFor(config));
    mesh.position.copy(position);
    mesh.position.x = THREE.MathUtils.clamp(
      mesh.position.x,
      -UNIT_BATTLEFIELD_LIMIT - 200,
      UNIT_BATTLEFIELD_LIMIT + 200
    );
    mesh.position.z = THREE.MathUtils.clamp(
      mesh.position.z,
      -UNIT_BATTLEFIELD_LIMIT - 200,
      UNIT_BATTLEFIELD_LIMIT + 200
    );
    refreshSurface(unit, this.world, true);
    if (config.domain === 'air') {
      mesh.position.y = Math.max(position.y, unit.surfaceY + 20);
    } else {
      mesh.position.y = unit.surfaceY;
    }
    unit.anchor.copy(mesh.position);

    const route =
      options?.route?.filter((p) => p && isFiniteVector(p)).map((p) => p.clone()) ?? null;
    if (route && route.length > 0) {
      unit.route = route;
    } else if (config.isEscort || config.faction === Faction.CIVILIAN) {
      unit.route = this.createDefaultRoute(mesh.position, config.domain);
    }
    if (unit.route && unit.route.length > 0) {
      const first = unit.route[0];
      unit.heading = Math.atan2(first.x - mesh.position.x, first.z - mesh.position.z);
    } else if (this.hasLastPlayer) {
      unit.heading = Math.atan2(
        this.playerPosition.x - mesh.position.x,
        this.playerPosition.z - mesh.position.z
      );
    }
    if (config.domain === 'air') unit.speed = config.speed;
    applyAttitude(unit);
    this.scene.add(mesh);
    this.units.push(unit);
    this.unitsById.set(unit.id, unit);
    if (!this.seenTypes.has(type)) {
      this.seenTypes.add(type);
      this.onFirstContact?.(type);
    }
    return unit;
  }

  /** 未指定航线的护送 / 平民单位：朝战场中心方向穿越战场 */
  private createDefaultRoute(from: THREE.Vector3, domain: UnitDomain): THREE.Vector3[] {
    this.tmpDir.set(-from.x, 0, -from.z);
    if (this.tmpDir.lengthSq() < 100) this.tmpDir.set(1, 0, 0);
    this.tmpDir.normalize();
    const route: THREE.Vector3[] = [];
    for (const distance of [600, 1200]) {
      const x = clampToBattlefield(from.x + this.tmpDir.x * distance);
      const z = clampToBattlefield(from.z + this.tmpDir.z * distance);
      const y = domain === 'air' ? from.y : this.surface(x, z, domain).y;
      route.push(new THREE.Vector3(x, y, z));
    }
    return route;
  }

  private createPlacementContext(playerPosition: THREE.Vector3): PlacementContext {
    return {
      playerPosition: playerPosition.clone(),
      forwardX: this.forwardX,
      forwardZ: this.forwardZ,
      hasSampler: this.sampler !== null,
      surface: (x, z, domain) => {
        const sample = this.surface(x, z, domain);
        return { y: sample.y, water: sample.water };
      },
      random: Math.random,
    };
  }

  private healthMultiplierFor(config: UnitConfig): number {
    if (config.faction === Faction.CIVILIAN) return 1;
    const value = this.scaling.unitHealthMultiplier;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  // ───────────────────────────── 每帧更新 ─────────────────────────────

  updateWithContext(deltaTime: number, ctx: UnitUpdateContext): void {
    if (this.disposed || !ctx) return;
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;
    const dt = Math.min(deltaTime, 0.1);
    this.time += dt;
    this.frame++;
    this.capturePlayer(ctx, dt);
    this.enemyAirMeshes = Array.isArray(ctx.enemyAirMeshes) ? ctx.enemyAirMeshes : EMPTY_OBJECTS;
    this.friendlyAirMeshes = Array.isArray(ctx.friendlyAirMeshes)
      ? ctx.friendlyAirMeshes
      : EMPTY_OBJECTS;
    this.trackJets(dt);
    this.decoys = this.readDecoys();
    this.rebuildLists();
    this.accuracyBonus =
      (this.scaling.enemyAccuracyBonus || 0) + (this.getHostileRadarBonus() > 0 ? 0.12 : 0);

    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      if (unit.departed || unit.removable) continue;
      if (unit.alive) {
        if (!isFiniteVector(unit.mesh.position)) {
          unit.mesh.position.copy(unit.anchor);
          unit.velocity.set(0, 0, 0);
          if (!isFiniteVector(unit.mesh.position)) unit.mesh.position.set(0, 0, 0);
        }
        updateUnitBehavior(unit, this.world, dt);
        if (!unit.alive || unit.departed) continue;
        if (!isFiniteVector(unit.mesh.position)) {
          unit.mesh.position.copy(unit.anchor);
        }
        if (unit.civilianHitCooldown > 0) unit.civilianHitCooldown -= dt;
        unit.updateFlash(dt);
        this.updateDamageSmoke(unit, dt);
      } else {
        this.updateDeath(unit, dt);
      }
    }

    this.missiles.update(dt, this.missileEnv);
    this.shots.update(dt, this.shotEnv);
    this.removeFinished();
    setUnitBeaconPhase(this.time);
  }

  private capturePlayer(ctx: UnitUpdateContext, dt: number): void {
    const position = ctx.playerPosition ?? ctx.playerMesh?.position;
    const valid = !!position && isFiniteVector(position);
    if (valid && position) {
      if (this.hasLastPlayer && position.distanceTo(this.lastPlayerPosition) < 300) {
        this.measuredVelocity.subVectors(position, this.lastPlayerPosition).multiplyScalar(1 / dt);
        if (isFiniteVector(this.measuredVelocity))
          this.playerVelocity.lerp(this.measuredVelocity, 0.35);
      } else {
        this.playerVelocity.set(0, 0, 0);
      }
      this.lastPlayerPosition.copy(position);
      this.playerPosition.copy(position);
      this.hasLastPlayer = true;
    }
    this.playerActive = valid && !!ctx.playerMesh && ctx.playerMesh.visible !== false;
    const mesh = ctx.playerMesh;
    if (mesh && mesh.quaternion) {
      this.tmpA.copy(PLAYER_FORWARD).applyQuaternion(mesh.quaternion);
      const length = Math.hypot(this.tmpA.x, this.tmpA.z);
      if (length > 0.2 && Number.isFinite(length)) {
        this.forwardX = this.tmpA.x / length;
        this.forwardZ = this.tmpA.z / length;
      }
    }
  }

  /** 估算敌机速度（友军护卫舰射击提前量） */
  private trackJets(dt: number): void {
    for (const mesh of this.enemyAirMeshes) {
      if (!mesh) continue;
      mesh.getWorldPosition(this.tmpA);
      if (!isFiniteVector(this.tmpA)) continue;
      const track = this.jetTracks.get(mesh);
      if (track) {
        this.tmpB.subVectors(this.tmpA, track.position).multiplyScalar(1 / dt);
        if (isFiniteVector(this.tmpB) && this.tmpB.lengthSq() < 200 * 200)
          track.velocity.lerp(this.tmpB, 0.4);
        track.position.copy(this.tmpA);
        track.frame = this.frame;
      } else {
        this.jetTracks.set(mesh, {
          position: this.tmpA.clone(),
          velocity: new THREE.Vector3(),
          frame: this.frame,
        });
      }
    }
    if (this.frame % 60 === 0) {
      for (const [mesh, track] of this.jetTracks) {
        if (track.frame !== this.frame) this.jetTracks.delete(mesh);
      }
    }
  }

  private readDecoys(): readonly DecoyPoint[] {
    if (!this.decoyProvider) return EMPTY_DECOYS;
    try {
      const decoys = this.decoyProvider.getActiveDecoys();
      return Array.isArray(decoys) ? decoys : EMPTY_DECOYS;
    } catch {
      return EMPTY_DECOYS;
    }
  }

  private rebuildLists(): void {
    this.allies.length = 0;
    this.hostiles.length = 0;
    for (const unit of this.units) {
      if (!unit.isTargetable()) continue;
      if (unit.faction === Faction.FRIENDLY) this.allies.push(unit);
      else if (unit.faction === Faction.ENEMY) this.hostiles.push(unit);
    }
  }

  private surface(x: number, z: number, domain: UnitDomain): SurfaceSample {
    const result = this.surfaceResult;
    if (this.sampler && Number.isFinite(x) && Number.isFinite(z)) {
      try {
        const sample = this.sampler(x, z);
        if (sample && Number.isFinite(sample.y)) {
          result.y = sample.y;
          result.water = sample.water === true;
          return result;
        }
      } catch {
        // 采样器异常时退回默认地表
      }
    }
    result.y = domain === 'sea' ? UNIT_WATER_Y : 0;
    result.water = domain === 'sea';
    return result;
  }

  // ───────────────────────────── 伤害 / 死亡 ─────────────────────────────

  private handleDamaged(
    unit: UnitEntity,
    amount: number,
    byPlayer: boolean,
    hitPoint?: THREE.Vector3
  ): void {
    if (this.particleSystem && unit.hitFxCooldown <= 0) {
      unit.hitFxCooldown = 0.06;
      const point =
        hitPoint && isFiniteVector(hitPoint)
          ? hitPoint
          : this.tmpA.copy(unit.mesh.position).setY(unit.mesh.position.y + unit.hitRadius * 0.3);
      this.particleSystem.createHit(point, byPlayer ? 1.1 : 0.8, 'enemy');
    }
    if (unit.faction === Faction.CIVILIAN && byPlayer && unit.civilianHitCooldown <= 0) {
      unit.civilianHitCooldown = 4;
      this.onCivilianHit?.(unit);
    }
    this.onUnitDamaged?.(unit, amount, byPlayer);
  }

  private handleKilled(unit: UnitEntity, byPlayer: boolean): void {
    unit.alive = false;
    unit.health = 0;
    unit.targetable = false;
    unit.lockPhase = 'idle';
    unit.restoreMaterials();
    const position = unit.mesh.position.clone();
    const scale = THREE.MathUtils.clamp(unit.hitRadius / 8, 0.8, 2.4);
    unit.deathKind = unit.domain === 'ground' ? 'wreck' : unit.domain === 'sea' ? 'sink' : 'fall';
    unit.deathTimer = unit.deathKind === 'fall' ? 9 : 7;
    unit.deathVelocity.copy(unit.velocity);
    unit.deathSpin = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 1.6);
    unit.smokeTimer = 0;
    if (unit.deathKind !== 'fall') unit.setCharred();

    const particles = this.particleSystem;
    if (particles) {
      const profile = unit.faction === Faction.FRIENDLY ? 'friendly' : 'enemy';
      particles.createExplosion(position, scale, profile);
      if (unit.hitRadius >= 15) {
        particles.createShockwave(position, unit.hitRadius * 2.2, 0.7, 0xffb066, 0.7);
      }
      if (unit.domain === 'sea') {
        particles.createWaterImpact(position, 2);
      } else if (unit.domain === 'ground') {
        particles.createGroundImpact(position, 1.6, 'ground');
      }
    }
    this.missiles.forgetUnit(unit);
    this.shots.forgetUnit(unit);
    this.onExplosion?.(position, scale, unit.domain);
    this.onUnitDestroyed?.(unit, position, byPlayer);
    if (unit.config.isEscort) this.onEscortResult?.(false, unit);
  }

  /** 非伤害途径的死亡（自杀撞击 / 坠地） */
  private killDirect(unit: UnitEntity, byPlayer: boolean): void {
    if (!unit.alive || unit.departed) return;
    unit.lastHitByPlayer = byPlayer;
    this.handleKilled(unit, byPlayer);
  }

  private updateDeath(unit: UnitEntity, dt: number): void {
    unit.deathTimer -= dt;
    const p = unit.mesh.position;
    const particles = this.particleSystem;
    unit.smokeTimer -= dt;
    switch (unit.deathKind) {
      case 'wreck': {
        // 最后 1.6 秒沉入地面（高大建筑下沉更快，避免移除时“跳变”）
        if (unit.deathTimer < 1.6) p.y -= dt * (2 + unit.hitRadius * 0.6);
        if (particles && unit.smokeTimer <= 0 && unit.deathTimer > 1.5) {
          unit.smokeTimer = 0.16;
          this.tmpA.copy(p).setY(p.y + unit.hitRadius * 0.35);
          particles.createMissileTrail(this.tmpA, DOWN, SMOKE_COLOR, 1.4);
        }
        break;
      }
      case 'sink': {
        p.y -= dt * (1.5 + unit.hitRadius * 0.06);
        unit.pitch = Math.min(0.3, unit.pitch + dt * 0.04);
        unit.roll += unit.deathSpin * dt * 0.05;
        applyAttitude(unit);
        if (particles && unit.smokeTimer <= 0 && unit.deathTimer > 2) {
          unit.smokeTimer = 0.2;
          this.tmpA.copy(p).setY(Math.max(p.y + unit.hitRadius * 0.3, UNIT_WATER_Y + 1));
          particles.createMissileTrail(this.tmpA, DOWN, SMOKE_COLOR, 1.5);
        }
        break;
      }
      default: {
        unit.deathVelocity.y -= 9.8 * dt;
        unit.deathVelocity.x *= 1 - Math.min(1, dt * 0.3);
        unit.deathVelocity.z *= 1 - Math.min(1, dt * 0.3);
        p.addScaledVector(unit.deathVelocity, dt);
        unit.roll += unit.deathSpin * dt;
        unit.pitch = Math.max(-1.1, unit.pitch - dt * 0.35);
        applyAttitude(unit);
        if (particles && unit.smokeTimer <= 0) {
          unit.smokeTimer = 0.06;
          this.tmpDir.copy(unit.deathVelocity);
          if (this.tmpDir.lengthSq() < 1e-6) this.tmpDir.copy(DOWN);
          particles.createMissileTrail(p, this.tmpDir.normalize(), SMOKE_COLOR, 1.6);
        }
        refreshSurface(unit, this.world, true);
        if (!isFiniteVector(p) || p.y <= unit.surfaceY + 0.5 || unit.deathTimer <= 0) {
          if (isFiniteVector(p)) {
            p.y = Math.max(p.y, unit.surfaceY);
            const scale = THREE.MathUtils.clamp(unit.hitRadius / 10, 0.7, 2);
            if (particles) {
              particles.createExplosion(p, scale, 'enemy');
              if (unit.surfaceWater) particles.createWaterImpact(p, 1.8);
              else particles.createGroundImpact(p, 1.4, 'ground');
            }
            this.onExplosion?.(p.clone(), scale * 0.8, unit.surfaceWater ? 'sea' : 'ground');
          }
          unit.removable = true;
        }
        return;
      }
    }
    if (unit.deathTimer <= 0) unit.removable = true;
  }

  private updateDamageSmoke(unit: UnitEntity, dt: number): void {
    if (unit.type === UnitType.DRONE) return;
    const override = this.effects.damageSmoke;
    if (!this.particleSystem && !override) return;
    const ratio = unit.getHealthRatio();
    if (ratio >= 0.5 || !unit.targetable) return;
    unit.smokeTimer -= dt;
    if (unit.smokeTimer > 0) return;
    const p = unit.mesh.position;
    if (override) {
      // 专用冒烟特效按 ~8 Hz 调用
      unit.smokeTimer = 0.125;
      this.tmpA.copy(p);
      if (unit.domain !== 'air') this.tmpA.y += unit.hitRadius * 0.35;
      override(this.tmpA, ratio < 0.25 ? 1 : 0.55);
      return;
    }
    if (!this.particleSystem) return;
    unit.smokeTimer = ratio < 0.25 ? 0.09 : 0.16;
    if (unit.domain === 'air') {
      this.tmpDir.copy(unit.velocity);
      if (this.tmpDir.lengthSq() < 1e-4) this.tmpDir.copy(DOWN);
      this.particleSystem.createMissileTrail(
        p,
        this.tmpDir.normalize(),
        SMOKE_COLOR,
        ratio < 0.25 ? 1.6 : 1.2
      );
    } else {
      this.tmpA.set(
        p.x + (Math.random() - 0.5) * unit.hitRadius * 0.5,
        p.y + unit.hitRadius * 0.35,
        p.z + (Math.random() - 0.5) * unit.hitRadius * 0.5
      );
      this.particleSystem.createMissileTrail(
        this.tmpA,
        DOWN,
        SMOKE_COLOR,
        ratio < 0.25 ? 1.6 : 1.2
      );
    }
  }

  private removeFinished(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];
      if (!unit.removable && !unit.departed) continue;
      this.removeUnitAt(i);
    }
  }

  private removeUnitAt(index: number): void {
    const unit = this.units[index];
    this.units.splice(index, 1);
    this.unitsById.delete(unit.id);
    unit.restoreMaterials();
    this.missiles.forgetUnit(unit);
    this.shots.forgetUnit(unit);
    for (const other of this.units) {
      if (other.targetUnit === unit) other.targetUnit = null;
      if (other.lockTarget === unit) {
        other.lockTarget = null;
        if (other.lockPhase === 'locking') other.lockPhase = 'idle';
      }
    }
    disposeUnitObject(unit.mesh);
    this.scene.remove(unit.mesh);
  }

  // ───────────────────────────── 查询 ─────────────────────────────

  getUnits(): readonly UnitInstance[] {
    return this.units.filter((unit) => unit.isAlive());
  }

  getCombatTargets(): CombatTarget[] {
    const targets: CombatTarget[] = [];
    // 优先目标（雷达站）排在前面
    for (const unit of this.units) {
      if (unit.isTargetable() && unit.mesh.userData.priorityTarget === true) targets.push(unit);
    }
    for (const unit of this.units) {
      if (unit.isTargetable() && unit.mesh.userData.priorityTarget !== true) targets.push(unit);
    }
    return targets;
  }

  getHostileMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const unit of this.units) {
      if (
        unit.faction === Faction.ENEMY &&
        unit.isTargetable() &&
        unit.mesh.userData.priorityTarget === true
      ) {
        meshes.push(unit.mesh);
      }
    }
    for (const unit of this.units) {
      if (
        unit.faction === Faction.ENEMY &&
        unit.isTargetable() &&
        unit.mesh.userData.priorityTarget !== true
      ) {
        meshes.push(unit.mesh);
      }
    }
    return meshes;
  }

  getFriendlyMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const unit of this.units) {
      if (unit.faction === Faction.FRIENDLY && unit.isTargetable()) meshes.push(unit.mesh);
    }
    return meshes;
  }

  getCivilianMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const unit of this.units) {
      if (unit.faction === Faction.CIVILIAN && unit.isTargetable()) meshes.push(unit.mesh);
    }
    return meshes;
  }

  /** 由网格（根节点或任意子节点）反查单位 */
  findByMesh(object: THREE.Object3D): UnitInstance | null {
    let current: THREE.Object3D | null = object ?? null;
    let depth = 0;
    while (current && depth < 32) {
      const id: unknown = current.userData?.unitId;
      if (typeof id === 'string') {
        const unit = this.unitsById.get(id);
        if (unit && unit.mesh === current) return unit;
      }
      current = current.parent;
      depth++;
    }
    return null;
  }

  /**
   * 扩展：点命中测试——返回瞄准中心（userData.aimPoint）半径 hitRadius + padding 内最近的可命中单位。
   * 供协调器对玩家子弹 / 导弹做半径感知的碰撞（ProjectilePool 固定 5 米阈值对大型舰船不适用）。
   */
  hitTest(point: THREE.Vector3, padding = 0): UnitInstance | null {
    if (!point || !isFiniteVector(point)) return null;
    let best: UnitEntity | null = null;
    let bestSq = Infinity;
    for (const unit of this.units) {
      if (!unit.isTargetable()) continue;
      unit.getAimCenter(this.tmpB);
      const radius = unit.hitRadius + Math.max(0, padding);
      const distanceSq = this.tmpB.distanceToSquared(point);
      if (distanceSq <= radius * radius && distanceSq < bestSq) {
        bestSq = distanceSq;
        best = unit;
      }
    }
    return best;
  }

  /** 存活的敌方单位数（含潜航潜艇）——波次清场判定 */
  getAliveHostileCount(): number {
    let count = 0;
    for (const unit of this.units) {
      if (unit.faction === Faction.ENEMY && unit.isAlive()) count++;
    }
    return count;
  }

  /** 敌方雷达站存活时提供的精度加成：一座 0.15，每多一座 +0.05，上限 0.25 */
  getHostileRadarBonus(): number {
    let stations = 0;
    for (const unit of this.units) {
      if (unit.type === UnitType.RADAR_STATION && unit.faction === Faction.ENEMY && unit.isAlive())
        stations++;
    }
    if (stations === 0) return 0;
    return Math.min(0.25, 0.15 + 0.05 * (stations - 1));
  }

  /** 友军预警机存活时雷达范围倍率 1.6，否则 1 */
  getRadarRangeMultiplier(): number {
    for (const unit of this.units) {
      if (unit.type === UnitType.ALLY_AWACS && unit.isAlive()) return 1.6;
    }
    return 1;
  }

  /** 雷达点位（含潜航中的潜艇——声呐接触）；条目对象复用，结果在下一次调用前有效 */
  getRadarBlips(): Array<{ position: THREE.Vector3; kind: UnitRadarKind }> {
    const blips: Array<{ position: THREE.Vector3; kind: UnitRadarKind }> = [];
    let index = 0;
    for (const unit of this.units) {
      if (!unit.isAlive()) continue;
      let entry = this.radarBlipPool[index];
      if (!entry) {
        entry = { position: new THREE.Vector3(), kind: unit.config.radarKind };
        this.radarBlipPool.push(entry);
      }
      entry.position.copy(unit.mesh.position);
      entry.kind = unit.config.radarKind;
      blips.push(entry);
      index++;
    }
    return blips;
  }

  getIncomingMissiles(): ReadonlyArray<{ position: THREE.Vector3; targetIsPlayer: boolean }> {
    return this.missiles.getIncoming();
  }

  /** 扩展：玩家告警状态，可直接映射到 HUD.setMissileWarning */
  getPlayerLockState(): PlayerLockState {
    if (this.missiles.hasMissileTargetingPlayer()) return 'incoming';
    for (const unit of this.units) {
      if (unit.isAlive() && unit.lockPhase === 'locking' && unit.lockOnPlayer) return 'locking';
    }
    return 'none';
  }

  destroyMissilesInRadius(center: THREE.Vector3, radius: number): number {
    if (!center || !isFiniteVector(center) || !(radius > 0)) return 0;
    return this.missiles.destroyInRadius(center, radius, this.missileEnv);
  }

  /**
   * 范围伤害（满额，不做衰减）。阵营规则：
   * 玩家武器来源只伤及敌方与平民；'enemy-fire' / 'boss' 只伤及友军与平民；其他来源伤及全部。
   */
  applyAreaDamage(
    center: THREE.Vector3,
    radius: number,
    damage: number,
    source: DamageSource
  ): number {
    if (!center || !isFiniteVector(center) || !(radius > 0) || !(damage > 0)) return 0;
    const playerSource = isPlayerDamageSource(source);
    const hostileSource = source === 'enemy-fire' || source === 'boss';
    let count = 0;
    for (const unit of this.units.slice()) {
      if (!unit.isTargetable()) continue;
      if (playerSource && unit.faction === Faction.FRIENDLY) continue;
      if (hostileSource && unit.faction === Faction.ENEMY) continue;
      if (unit.mesh.position.distanceTo(center) - unit.hitRadius > radius) continue;
      unit.applyDamage(damage, source, center);
      count++;
    }
    return count;
  }

  /** 范围瘫痪（EMP）：只作用于敌方单位 */
  applyAreaStun(center: THREE.Vector3, radius: number, seconds: number): number {
    if (!center || !isFiniteVector(center) || !(radius > 0) || !(seconds > 0)) return 0;
    let count = 0;
    for (const unit of this.units) {
      if (unit.faction !== Faction.ENEMY || !unit.isAlive()) continue;
      if (unit.mesh.position.distanceTo(center) - unit.hitRadius > radius) continue;
      unit.applyStun(seconds);
      count++;
    }
    return count;
  }

  // ───────────────────────────── 清理 ─────────────────────────────

  /** 移除全部单位 / 导弹 / 弹道（不触发回调）；首次接触记录保留（整局会话内有效） */
  clear(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      this.removeUnitAt(i);
    }
    this.units.length = 0;
    this.unitsById.clear();
    this.allies.length = 0;
    this.hostiles.length = 0;
    this.missiles.clear();
    this.shots.clear();
    this.jetTracks.clear();
  }

  /** 清空首次接触记录（新开一局时调用） */
  resetFirstContacts(): void {
    this.seenTypes.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.missiles.dispose();
    this.shots.dispose();
    this.seenTypes.clear();
    this.disposed = true;
  }

  // ───────────────────────────── 行为接口实现 ─────────────────────────────

  private createWorld(): UnitWorld {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const system = this;
    const muzzleCopy = new THREE.Vector3();
    const aim = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const spreadVec = new THREE.Vector3();
    const applySpread = (direction: THREE.Vector3, spread: number, accuracyBonus: number): void => {
      const amount = Math.max(0, spread) * Math.max(0.35, 1 - accuracyBonus * 2);
      spreadVec
        .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .multiplyScalar(2 * amount);
      direction.add(spreadVec).normalize();
    };
    return {
      get time() {
        return system.time;
      },
      get playerPosition() {
        return system.playerPosition;
      },
      get playerVelocity() {
        return system.playerVelocity;
      },
      get playerActive() {
        return system.playerActive;
      },
      get enemyAirMeshes() {
        return system.enemyAirMeshes;
      },
      get friendlyAirMeshes() {
        return system.friendlyAirMeshes;
      },
      get allies() {
        return system.allies;
      },
      get hostiles() {
        return system.hostiles;
      },
      get damageMultiplier() {
        const value = system.scaling.enemyDamageMultiplier;
        return Number.isFinite(value) && value > 0 ? value : 1;
      },
      get cooldownMultiplier() {
        const value = system.scaling.enemyCooldownMultiplier;
        return Number.isFinite(value) && value > 0 ? value : 1;
      },
      get accuracyBonus() {
        return system.accuracyBonus;
      },
      surface: (x, z, domain) => system.surface(x, z, domain),
      fireAtPlayer: (unit, muzzle, damage, spread) => {
        if (!system.playerActive || !isFiniteVector(muzzle)) return;
        predictIntercept(
          muzzle,
          system.playerPosition,
          system.playerVelocity,
          UNIT_GUN_PROJECTILE_SPEED,
          aim
        );
        dir.subVectors(aim, muzzle);
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        applySpread(dir, spread, system.accuracyBonus);
        muzzleCopy.copy(muzzle);
        system.onUnitFire?.(muzzleCopy.clone(), dir.clone(), damage, Faction.ENEMY, unit.mesh);
      },
      fireAtObject: (unit, muzzle, target, damage, spread) => {
        if (!isFiniteVector(muzzle)) return;
        target.getWorldPosition(aim);
        const track = system.jetTracks.get(target);
        if (track)
          predictIntercept(muzzle, aim.clone(), track.velocity, UNIT_GUN_PROJECTILE_SPEED, aim);
        dir.subVectors(aim, muzzle);
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        applySpread(dir, spread, 0);
        system.onUnitFire?.(muzzle.clone(), dir.clone(), damage, unit.faction, unit.mesh);
      },
      fireAtUnit: (unit, kind, muzzle, target, damage, accuracy, speed) => {
        system.shots.fireAtUnit(kind, muzzle, target, damage, accuracy, speed);
        void unit;
      },
      launchMissile: (unit, from, direction, target, damage, options) => {
        void unit;
        return system.missiles.launch(from, direction, target, damage, options);
      },
      dropBomb: (unit, from, velocity, damage, radius) => {
        void unit;
        system.shots.dropBomb(from, velocity, damage, radius);
      },
      lockWarning: (unit, phase) => {
        system.onLockWarning?.(unit, phase);
      },
      kamikazePlayer: (unit, damage) => {
        system.onPlayerDamaged?.(damage, 'kamikaze', unit.mesh.position.clone());
        system.killDirect(unit, false);
      },
      kamikazeUnit: (unit, target, damage) => {
        target.applyDamage(damage, 'unit-fire', unit.mesh.position);
        system.killDirect(unit, false);
      },
      flakPuff: (position, scale) => system.shots.spawnPuff(position, scale),
      muzzleFlash: (position, intensity) => {
        if (system.effects.muzzleFlash) system.effects.muzzleFlash(position, intensity);
        else system.particleSystem?.createHit(position, intensity, 'enemy');
      },
      splash: (position, intensity) => {
        if (system.effects.splash) system.effects.splash(position, intensity);
        else system.particleSystem?.createWaterImpact(position, intensity);
      },
      visualTracer: (from, to) => {
        system.shots.fireVisual('tracer', from, to, 220);
      },
      interceptMissiles: (center, radius, chance) =>
        system.missiles.destroyInRadius(center, radius, system.missileEnv, chance),
      findNearestMissile: (center, radius, out) => system.missiles.findNearest(center, radius, out),
      crash: (unit, byPlayer) => {
        system.killDirect(unit, byPlayer);
        if (!unit.alive) {
          unit.deathKind = 'fall';
          unit.deathVelocity.set(0, -5, 0);
          unit.deathTimer = 0;
        }
      },
      depart: (unit, reason) => {
        if (unit.departed || !unit.alive) return;
        unit.departed = true;
        unit.targetable = false;
        if (reason === 'arrived' && unit.config.isEscort) system.onEscortResult?.(true, unit);
        system.onUnitDeparted?.(unit, reason);
      },
    };
  }

  private createMissileEnv(): UnitMissileEnv {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const system = this;
    return {
      get playerPosition() {
        return system.playerPosition;
      },
      get playerVelocity() {
        return system.playerVelocity;
      },
      get decoys() {
        return system.decoys;
      },
      get particleSystem() {
        return system.particleSystem;
      },
      sampleSurfaceY: (x, z) => system.surface(x, z, 'air').y,
      onPlayerHit: (damage, position) => {
        if (system.playerActive) system.onPlayerDamaged?.(damage, 'sam', position.clone());
      },
      onUnitHit: (target, damage, position) => {
        target.applyDamage(damage, 'unit-fire', position);
      },
      onDetonate: (position, scale) => {
        system.onExplosion?.(position.clone(), scale, 'missile');
      },
      onDecoyed: (position) => {
        system.onMissileDecoyed?.(position.clone());
      },
    };
  }

  private createShotEnv(): UnitShotEnv {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const system = this;
    return {
      get playerPosition() {
        return system.playerPosition;
      },
      get particleSystem() {
        return system.particleSystem;
      },
      sampleSurface: (x, z) => {
        const sample = system.surface(x, z, 'ground');
        return sample;
      },
      onShotImpact: (target, damage, position) => {
        target.applyDamage(damage, 'unit-fire', position);
      },
      onBombImpact: (position, damage, radius, water) => {
        for (const unit of system.units.slice()) {
          if (!unit.isTargetable() || unit.faction === Faction.ENEMY || unit.domain === 'air')
            continue;
          if (unit.mesh.position.distanceTo(position) - unit.hitRadius > radius) continue;
          unit.applyDamage(damage, 'unit-fire', position);
        }
        if (system.playerActive && system.playerPosition.distanceTo(position) < radius * 0.6) {
          system.onPlayerDamaged?.(damage * 0.6, 'bomb', position.clone());
        }
        system.onExplosion?.(position.clone(), 1.3, water ? 'sea' : 'ground');
      },
      onBombHitsPlayer: (damage, position) => {
        if (system.playerActive) system.onPlayerDamaged?.(damage, 'bomb', position.clone());
        system.onExplosion?.(position.clone(), 1.1, 'air');
      },
    };
  }
}

/** 从航线起点到第 index 个航点的折线距离 */
function routeDistanceTo(route: readonly THREE.Vector3[], index: number): number {
  let total = 0;
  for (let i = 0; i < index && i < route.length - 1; i++)
    total += route[i].distanceTo(route[i + 1]);
  return total;
}

/** 释放单位对象树中非共享的几何 / 材质（模板共享资源跳过） */
function disposeUnitObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object.userData?.sharedResource === true) return;
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geometry && geometry.userData?.sharedResource !== true) geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material && material.userData?.sharedResource !== true) material.dispose();
    }
  });
}
