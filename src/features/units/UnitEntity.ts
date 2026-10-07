import * as THREE from 'three';
import type { CombatTarget, CombatTargetKind, DamageSource } from '@/core/CombatContracts';
import type { Faction } from '@/core/Faction';
import { getUnitCharredMaterial, getUnitFlashMaterial } from './UnitMeshKit';
import type { UnitConfig, UnitDomain, UnitType } from './UnitTypes';

/**
 * 单位实例：UnitSystem 驱动的单个地面 / 海上 / 空中单位。
 * 同时满足 UnitInstance（规范接口）与 CombatTarget（特殊武器命中判定）。
 */

/** 规范接口（api-spec §3） */
export interface UnitInstance {
  readonly id: string;
  readonly type: UnitType;
  readonly config: UnitConfig;
  readonly mesh: THREE.Group;
  readonly faction: Faction;
  readonly domain: UnitDomain;
  isAlive(): boolean;
  /** 潜航中的潜艇返回 false */
  isTargetable(): boolean;
  getHealth(): { current: number; max: number };
  applyDamage(amount: number, source: DamageSource, hitPoint?: THREE.Vector3): void;
  applyStun(seconds: number): void;
  isStunned(): boolean;
  getPosition(out?: THREE.Vector3): THREE.Vector3;
}

/** 玩家武器来源：命中计为 byPlayer */
const PLAYER_SOURCES: ReadonlySet<DamageSource> = new Set<DamageSource>([
  'cannon',
  'missile',
  'rocket',
  'laser',
  'swarm',
  'railgun',
  'emp',
]);

export function isPlayerDamageSource(source: DamageSource): boolean {
  return PLAYER_SOURCES.has(source);
}

/** 单位宿主：伤害结算、死亡与平民误伤回调由 UnitSystem 实现 */
export interface UnitHost {
  onEntityDamaged(
    unit: UnitEntity,
    amount: number,
    byPlayer: boolean,
    hitPoint?: THREE.Vector3
  ): void;
  onEntityKilled(unit: UnitEntity, byPlayer: boolean): void;
}

export type UnitDeathKind = 'wreck' | 'sink' | 'fall';

export type UnitLockPhase = 'idle' | 'locking' | 'cooldown';

let nextUnitSerial = 1;

export class UnitEntity implements UnitInstance, CombatTarget {
  readonly id: string;
  readonly type: UnitType;
  readonly config: UnitConfig;
  readonly mesh: THREE.Group;
  readonly faction: Faction;
  readonly domain: UnitDomain;
  readonly kind: CombatTargetKind;
  readonly hitRadius: number;

  // ── 生命 ──
  baseMaxHealth: number;
  maxHealth: number;
  health: number;
  alive = true;
  /** 已离场（护送抵达 / 平民驶出），不再参与任何逻辑 */
  departed = false;
  /** 死亡演出结束后待移除 */
  removable = false;
  deathKind: UnitDeathKind = 'wreck';
  deathTimer = 0;
  readonly deathVelocity = new THREE.Vector3();
  deathSpin = 0;

  // ── 状态 ──
  stunTimer = 0;
  flashTimer = 0;
  smokeTimer = 0;
  civilianHitCooldown = 0;
  lastHitByPlayer = false;
  /** 潜艇：false 时不可被命中（潜航） */
  targetable = true;

  // ── 运动 ──
  heading = 0;
  speed = 0;
  pitch = 0;
  roll = 0;
  readonly velocity = new THREE.Vector3();
  readonly anchor = new THREE.Vector3();
  readonly scratch = new THREE.Vector3();
  route: THREE.Vector3[] | null = null;
  routeIndex = 0;
  altitude = 0;
  surfaceY = 0;
  surfaceWater = false;
  surfaceSampleX = Number.NaN;
  surfaceSampleZ = Number.NaN;
  /** 平滑后的基准高度（浮动起伏叠加在其上，避免累积漂移） */
  baseY = Number.NaN;
  /** 命中火花节流 */
  hitFxCooldown = 0;
  orbitAngle = 0;
  orbitDirection = 1;
  orbitRadius = 0;
  /** 0..1 随机种子：错开各单位的节奏 */
  readonly seed: number;
  swarmId = -1;

  // ── 行为 / 武器 ──
  phase = 'init';
  phaseTimer = 0;
  fireTimer = 0;
  burstLeft = 0;
  burstTimer = 0;
  secondaryTimer = 0;
  lockPhase: UnitLockPhase = 'idle';
  lockTimer = 0;
  lockOnPlayer = false;
  lockTarget: UnitEntity | null = null;
  missilesLoaded = 0;
  reloadTimer = 0;
  targetUnit: UnitEntity | null = null;
  retargetTimer = 0;
  recoil = 0;
  muzzleIndex = 0;

  private readonly host: UnitHost;
  private readonly flashMeshes: THREE.Mesh[] = [];
  private readonly flashOriginals: THREE.Material[] = [];
  private flashing = false;
  private charred = false;

  constructor(
    type: UnitType,
    config: UnitConfig,
    mesh: THREE.Group,
    host: UnitHost,
    healthMultiplier: number
  ) {
    this.id = `unit-${type.toLowerCase()}-${nextUnitSerial++}`;
    this.type = type;
    this.config = config;
    this.mesh = mesh;
    this.faction = config.faction;
    this.domain = config.domain;
    this.kind = config.domain;
    this.hitRadius = config.hitRadius;
    this.host = host;
    this.baseMaxHealth = config.health;
    const multiplier =
      Number.isFinite(healthMultiplier) && healthMultiplier > 0 ? healthMultiplier : 1;
    this.maxHealth = config.health * multiplier;
    this.health = this.maxHealth;
    this.seed = Math.random();
    mesh.userData.unitId = this.id;
    mesh.traverse((object) => {
      const candidate = object as THREE.Mesh;
      if (!candidate.isMesh || candidate.userData.noFlash) return;
      this.flashMeshes.push(candidate);
      this.flashOriginals.push(candidate.material as THREE.Material);
    });
  }

  isAlive(): boolean {
    return this.alive && !this.departed;
  }

  isTargetable(): boolean {
    return this.isAlive() && this.targetable;
  }

  getHealth(): { current: number; max: number } {
    return { current: Math.max(0, this.health), max: this.maxHealth };
  }

  getPosition(out?: THREE.Vector3): THREE.Vector3 {
    const target = out ?? new THREE.Vector3();
    return target.copy(this.mesh.position);
  }

  /** 生命比例 0..1 */
  getHealthRatio(): number {
    return this.maxHealth > 0 ? Math.max(0, this.health) / this.maxHealth : 0;
  }

  applyDamage(amount: number, source: DamageSource, hitPoint?: THREE.Vector3): void {
    if (!this.isAlive() || !this.targetable) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    const byPlayer = isPlayerDamageSource(source);
    this.health -= amount;
    this.lastHitByPlayer = byPlayer;
    this.flashTimer = 0.07;
    this.host.onEntityDamaged(this, amount, byPlayer, hitPoint);
    if (this.health <= 0 && this.alive) {
      this.health = 0;
      this.alive = false;
      this.host.onEntityKilled(this, byPlayer);
    }
  }

  applyStun(seconds: number): void {
    if (!this.isAlive() || !Number.isFinite(seconds) || seconds <= 0) return;
    this.stunTimer = Math.max(this.stunTimer, Math.min(seconds, 30));
  }

  isStunned(): boolean {
    return this.isAlive() && this.stunTimer > 0;
  }

  /** 按新的血量倍率重设上限，保持当前血量比例 */
  rescaleHealth(multiplier: number): void {
    const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    const ratio = this.getHealthRatio();
    this.maxHealth = this.baseMaxHealth * safe;
    if (this.alive) this.health = Math.max(1, ratio * this.maxHealth);
  }

  /** 受击闪白：只交换材质引用，不克隆材质 */
  updateFlash(deltaTime: number): void {
    if (this.hitFxCooldown > 0) this.hitFxCooldown -= deltaTime;
    if (this.flashTimer > 0) {
      this.flashTimer -= deltaTime;
      if (!this.flashing && !this.charred) this.setFlash(true);
    } else if (this.flashing) {
      this.setFlash(false);
    }
  }

  private setFlash(on: boolean): void {
    this.flashing = on;
    const flash = getUnitFlashMaterial();
    for (let i = 0; i < this.flashMeshes.length; i++) {
      this.flashMeshes[i].material = on ? flash : this.flashOriginals[i];
    }
  }

  /** 残骸：整体换成焦黑材质 */
  setCharred(): void {
    if (this.charred) return;
    this.charred = true;
    this.flashing = false;
    const charred = getUnitCharredMaterial();
    for (const mesh of this.flashMeshes) mesh.material = charred;
  }

  /** 移除前恢复原始材质引用（共享材质不释放） */
  restoreMaterials(): void {
    for (let i = 0; i < this.flashMeshes.length; i++) {
      this.flashMeshes[i].material = this.flashOriginals[i];
    }
    this.flashing = false;
    this.charred = false;
  }
}
