import * as THREE from 'three';
import { BOSS_CONFIGS, BossType, type BossConfig } from './BossTypes';
import { BossMissileSystem } from './BossMissileSystem';
import type { BossHazardHit, BossMinionKind, BossSubTarget, IAdvancedBoss } from './BossContracts';
import { HealthSystem } from '@/features/combat/HealthSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import {
  ArcShellPool,
  HazardColumnPool,
  HazardFx,
  HazardRingPool,
  WATER_COLUMN_PALETTE,
  createHazardProbe,
  disposeObjectTree,
  isFiniteVector,
  resetHazardProbe,
  resolveMissileParticles,
  type ArcShellPalette,
  type ArcShellSpec,
} from './MagmaColossusHazards';
import { MagmaColossusStompMarker as SurfaceWarningMarker } from './MagmaColossusBeam';
import {
  AbyssalLeviathanLaneMarker,
  AbyssalLeviathanMineField,
  AbyssalLeviathanShards,
  AbyssalLeviathanWake,
  type LeviathanMineSpec,
} from './AbyssalLeviathanFx';
import {
  createAbyssalLeviathanMesh,
  type AbyssalLeviathanGroup,
  type AbyssalLeviathanRig,
  type LeviathanHatchRig,
  type LeviathanTankRig,
} from './AbyssalLeviathanMesh';

export { createAbyssalLeviathanMesh } from './AbyssalLeviathanMesh';

/**
 * 第七关 Boss「深渊利维坦」ABYSSAL LEVIATHAN —— 极夜冰海下的巨型破冰潜艇。
 *
 * 机制：
 * - 潜航循环：潜航时无敌（isInvulnerable() 为 true，只露出尾流与声呐脉冲环），
 *   在玩家航迹前方择点；上浮前 2.2 秒水面出现红色预警圈并播报，随后破冰跃出水面
 *   （冲击环伤害低空目标、冰块四溅），上浮窗口内指挥塔 / 压载舱 / 导弹舱暴露。
 * - 潜航时：水下发射的“鱼雷弹”——水面先翻起白色水泡预警，再经 onFire 射出。
 * - 上浮时：前后双联炮塔 onFire；垂直发射舱开盖（弱点 ×2.4）后齐射 BossMissileSystem 导弹。
 * - 阶段 2（≤ 66%）：开始布雷（抛射布雷弹带落点准星，落水后成为可击毁的漂浮水雷）、
 *   潜航时间缩短、无人机从发射舱起飞（onSpawnMinion）。
 * - 阶段 3（≤ 33%）：压载舱破裂，永久上浮、艇体倾斜起火，周期性冲撞（水面红色航道预警）。
 * - 子目标：指挥塔（毁后声呐停转、炮塔变慢）、4 个压载舱（每毁一个潜航更短，全毁无法下潜）。
 * - 死亡：默认归零同步 onDestroy 并追加蒸汽爆发；setDeathSequenceEnabled(true)
 *   后先播放约 4.5 秒的“艇体断成两截下沉”，再触发 onDestroy。
 */

export type AbyssalLeviathanCue =
  | 'sonar'
  | 'breach'
  | 'dive'
  | 'hatch-open'
  | 'missile-launch'
  | 'mine-drop'
  | 'mine-armed'
  | 'mine-detonate'
  | 'torpedo'
  | 'horn'
  | 'ram'
  | 'tank-destroyed'
  | 'sail-destroyed'
  | 'bay-destroyed'
  | 'phase'
  | 'hull-break';

type DiveState = 'surfaced' | 'diving' | 'submerged' | 'breaching';
type SalvoState = 'idle' | 'opening' | 'firing' | 'holding' | 'closing';
type RamState = 'idle' | 'telegraph' | 'charge' | 'recover';
type PartRole = 'hull' | 'sail' | 'tank' | 'hatch' | 'turret';

interface LeviathanPhaseTuning {
  surfacedTime: number;
  submergedTime: number;
  speedFactor: number;
  turretFactor: number;
  missileCount: number;
  salvoTimes: readonly number[];
  salvoInterval: number;
  mineCount: number;
  mineTime: number;
  mineInterval: number;
  minions: readonly BossMinionKind[];
  minionTime: number;
  minionInterval: number;
  torpedoInterval: number;
  torpedoCount: number;
  ramInterval: number;
}

const PHASE_TUNING: readonly LeviathanPhaseTuning[] = [
  {
    surfacedTime: 14,
    submergedTime: 9,
    speedFactor: 1,
    turretFactor: 1,
    missileCount: 3,
    salvoTimes: [2.6],
    salvoInterval: 0,
    mineCount: 0,
    mineTime: 0,
    mineInterval: 0,
    minions: [],
    minionTime: 0,
    minionInterval: 0,
    torpedoInterval: 2.3,
    torpedoCount: 2,
    ramInterval: 0,
  },
  {
    surfacedTime: 11.5,
    submergedTime: 7,
    speedFactor: 1.2,
    turretFactor: 0.85,
    missileCount: 4,
    salvoTimes: [2.2, 8],
    salvoInterval: 0,
    mineCount: 6,
    mineTime: 4.6,
    mineInterval: 0,
    minions: ['drone', 'drone'],
    minionTime: 6.5,
    minionInterval: 0,
    torpedoInterval: 1.8,
    torpedoCount: 3,
    ramInterval: 0,
  },
  {
    surfacedTime: Infinity,
    submergedTime: 0,
    speedFactor: 1.35,
    turretFactor: 0.7,
    missileCount: 6,
    salvoTimes: [],
    salvoInterval: 10,
    mineCount: 8,
    mineTime: 0,
    mineInterval: 14,
    minions: ['drone', 'drone', 'fighter'],
    minionTime: 0,
    minionInterval: 26,
    torpedoInterval: 0,
    torpedoCount: 0,
    ramInterval: 12,
  },
];

const PHASE_COUNT = 3;
const PHASE2_RATIO = 0.66;
const PHASE3_RATIO = 0.33;
const SAIL_HEALTH_RATIO = 0.08;
const TANK_HEALTH_RATIO = 0.05;
const BAY_HEALTH_RATIO = 0.07;
const DIVE_TIME = 2.6;
const BREACH_TIME = 3.2;
const BREACH_TELEGRAPH = 2.2;
const LEASH_RADIUS = 700;
const TURRET_RANGE = 480;
const HATCH_OPEN_TIME = 1.1;
const HATCH_HOLD_TIME = 2.6;
const HATCH_CLOSE_TIME = 0.8;
const RAM_TELEGRAPH = 1.7;
const RAM_CHARGE = 4.2;
const RAM_RECOVER = 1.5;
const DEATH_SEQUENCE_DURATION = 4.5;
const MAX_STEP_DT = 0.1;
const MAX_PENDING_TORPEDOES = 8;

const MINE_SHELL_PALETTE: ArcShellPalette = {
  shell: 0x46525c,
  glow: 0xff4a30,
  streak: 0x9fd8ff,
  reticleFar: 0xffa040,
  reticleNear: 0xff3030,
};

const UP = new THREE.Vector3(0, 1, 0);
const STRIP_CALM = new THREE.Color(0x38e8ff);
const STRIP_ALARM = new THREE.Color(0xff3a3a);

function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function safeRatio(value: number, base: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0 || value <= 0) return 1;
  return value / base;
}

function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

interface StructureTarget {
  kind: 'sail' | 'tank' | 'bay';
  index: number;
  /** 子目标锚点（血条定位）；指挥塔 / 压载舱即其网格本身 */
  mesh: THREE.Object3D;
  hp: number;
  max: number;
  alive: boolean;
  subTarget: BossSubTarget;
  tank: LeviathanTankRig | null;
}

interface HatchState {
  rig: LeviathanHatchRig;
  open: number;
}

interface PendingTorpedo {
  active: boolean;
  timer: number;
  position: THREE.Vector3;
}

export class AbyssalLeviathanAI implements IAdvancedBoss {
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onPhaseChange?: (phase: number, label: string) => void;
  public onSpawnMinion?: (position: THREE.Vector3, kind: BossMinionKind) => void;
  public onHazardWarning?: (label: string) => void;
  /** 扩展钩子：音效 / 镜头震动提示（position 为复用向量，需要保存请 clone） */
  public onEffectCue?: (
    cue: AbyssalLeviathanCue,
    position: THREE.Vector3,
    intensity: number
  ) => void;

  private readonly mesh: THREE.Group;
  private readonly config: BossConfig;
  private readonly fx: HazardFx;
  private readonly health: HealthSystem;
  private readonly missileSystem: BossMissileSystem;
  private readonly rig: AbyssalLeviathanRig;
  private readonly hazardRoot: THREE.Group;
  private readonly rings: HazardRingPool;
  private readonly spouts: HazardColumnPool;
  private readonly shells: ArcShellPool;
  private readonly mines: AbyssalLeviathanMineField;
  private readonly shards: AbyssalLeviathanShards;
  private readonly wake: AbyssalLeviathanWake;
  private readonly lane: AbyssalLeviathanLaneMarker;
  private readonly breachMarker: SurfaceWarningMarker;
  private readonly structures: StructureTarget[] = [];
  private readonly structureByPart = new Map<THREE.Object3D, StructureTarget>();
  private readonly subTargets: BossSubTarget[] = [];
  private readonly hatches: HatchState[] = [];
  private readonly hatchByPart = new Map<THREE.Object3D, HatchState>();
  private readonly partRoles = new Map<THREE.Object3D, PartRole>();
  private readonly collisionParts: THREE.Object3D[] = [];
  private readonly pendingTorpedoes: PendingTorpedo[] = [];
  private readonly triggerPositions: THREE.Vector3[] = [];
  private readonly probe = createHazardProbe();
  private readonly seaY: number;
  private readonly anchor = new THREE.Vector3();
  private readonly cadence: number;
  private readonly sizeFactor: number;
  private readonly mineSpec: LeviathanMineSpec;

  private phase = 1;
  private disposed = false;
  private deathHandled = false;
  private dying = false;
  private deathSequenceEnabled = false;
  private deathTimer = 0;
  private deathBurstTimer = 0;
  private time = 0;
  private yaw = 0;
  private speed = 0;
  private snappedToPlayer = false;
  private stunTimer = 0;

  // 出场即破冰上浮：从上浮曲线的中段开始（此时已可被攻击）
  private diveState: DiveState = 'breaching';
  private stateTimer = 0.55;
  private submergeLevel = 0.42;
  private breachImpactDone = false;
  private telegraphShown = false;
  private readonly breachTarget = new THREE.Vector3();
  private hasBreachTarget = false;
  private windowTime = 0;
  private salvoIndex = 0;
  private minesLaunched = false;
  private minionsLaunched = false;
  private hullPitch = 0;
  private hullRoll = 0;

  private salvoState: SalvoState = 'idle';
  private salvoTimer = 0;
  private salvoQueue = 0;
  private salvoFired = 0;
  private salvoRepeatTimer = 6;
  private mineRepeatTimer = 5;
  private minionRepeatTimer = 10;
  private torpedoTimer = 2;
  private sonarTimer = 0.5;
  private sonarFlash = 0;
  private turretTimer = 0.8;
  private turretIndex = 0;
  private ramState: RamState = 'idle';
  private ramTimer = 0;
  private ramCooldown = 6;
  private ramWakeTimer = 0;
  private fireTimer = 0;
  private lastMineCue = -1;
  private hitFlash = 0;
  private alarm = 0;
  private statusLabel: string | null = null;
  private statusKey = -1;

  private readonly playerPos = new THREE.Vector3();
  private readonly playerVel = new THREE.Vector3();
  private readonly lastPlayerPos = new THREE.Vector3();
  private hasPlayer = false;
  private hasLastPlayer = false;
  private playerMesh: THREE.Object3D | null = null;
  private friendlyMeshes: THREE.Object3D[] = [];

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpD = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly cuePosition = new THREE.Vector3();
  private readonly breakPoint = new THREE.Vector3();
  private readonly shellSpec: ArcShellSpec = {
    flightTime: 2,
    apexHeight: 50,
    burstRadius: 10,
    damage: 0,
    profile: 'flak-hit',
    payload: 1,
    groundY: null,
  };

  constructor(
    mesh: THREE.Group,
    config: BossConfig,
    scene: THREE.Scene,
    particleSystem: ParticleSystem
  ) {
    this.mesh = mesh;
    this.config = config;
    this.fx = new HazardFx(particleSystem);
    const maxHealth = Number.isFinite(config.health) && config.health > 0 ? config.health : 1;
    this.health = new HealthSystem(maxHealth);
    this.health.onDeath = () => this.handleHealthDepleted();
    this.missileSystem = new BossMissileSystem(scene, resolveMissileParticles(particleSystem));
    this.rig = this.ensureRig(mesh, config);
    this.sizeFactor = this.rig.scale / 5.5;
    const base = BOSS_CONFIGS[BossType.ABYSSAL_LEVIATHAN];
    this.cadence = THREE.MathUtils.clamp(
      safeRatio(config.cannonFireInterval, base.cannonFireInterval),
      0.5,
      2
    );

    if (!isFiniteVector(mesh.position)) mesh.position.set(0, -48, 0);
    this.seaY = mesh.position.y;
    this.anchor.copy(mesh.position);
    this.tmpEuler.setFromQuaternion(mesh.quaternion, 'YXZ');
    this.yaw = Number.isFinite(this.tmpEuler.y) ? this.tmpEuler.y : 0;

    const sf = this.sizeFactor;
    this.mineSpec = {
      blastRadius: 30 * sf,
      triggerRadius: 18 * sf,
      damage: config.damage * 1.5,
      lifetime: 45,
      armTime: 0.6,
      health: 30,
    };

    this.hazardRoot = new THREE.Group();
    this.hazardRoot.name = 'leviathan_hazards';
    scene.add(this.hazardRoot);
    this.rings = new HazardRingPool(this.hazardRoot, 8, 'leviathan_ring');
    this.spouts = new HazardColumnPool(
      this.hazardRoot,
      16,
      'leviathan_spout',
      WATER_COLUMN_PALETTE
    );
    this.shells = new ArcShellPool(
      this.hazardRoot,
      12,
      'leviathan_mine_lob',
      2.6 * sf,
      MINE_SHELL_PALETTE
    );
    this.shells.onArrive = (position, payload, spec) =>
      this.handleShellArrive(position, payload, spec);
    this.mines = new AbyssalLeviathanMineField(this.hazardRoot, 24, 2.4 * sf);
    this.mines.onDetonate = (position, harmless, radius) =>
      this.handleMineDetonate(position, harmless, radius);
    this.mines.onArm = (position) => this.emitCue('mine-armed', position, 0.6);
    this.shards = new AbyssalLeviathanShards(this.hazardRoot, 36, 2.2 * sf);
    this.wake = new AbyssalLeviathanWake(this.hazardRoot, 150 * sf, 90 * sf);
    this.lane = new AbyssalLeviathanLaneMarker(this.hazardRoot);
    this.breachMarker = new SurfaceWarningMarker(this.hazardRoot);
    for (let i = 0; i < MAX_PENDING_TORPEDOES; i++) {
      this.pendingTorpedoes.push({ active: false, timer: 0, position: new THREE.Vector3() });
    }

    // 子目标：指挥塔 + 4 个压载舱
    const sailMax = Math.max(1, Math.round(maxHealth * SAIL_HEALTH_RATIO));
    this.addStructure('sail', 0, this.rig.sail, [this.rig.sail], sailMax, null);
    const tankMax = Math.max(1, Math.round(maxHealth * TANK_HEALTH_RATIO));
    for (const tank of this.rig.tanks) {
      this.addStructure('tank', tank.index, tank.mesh, [tank.mesh], tankMax, tank);
    }
    const silos: THREE.Object3D[] = [];
    for (const hatch of this.rig.hatches) {
      const state: HatchState = { rig: hatch, open: 0 };
      this.hatches.push(state);
      this.hatchByPart.set(hatch.silo, state);
      silos.push(hatch.silo);
    }
    // 8 个发射井共用一个“导弹舱”血池：打爆后不再齐射导弹
    const bayMax = Math.max(1, Math.round(maxHealth * BAY_HEALTH_RATIO));
    this.addStructure('bay', 0, this.rig.missileBay, silos, bayMax, null);
    for (const silo of silos) this.partRoles.set(silo, 'hatch');
    for (const turret of this.rig.turrets) this.partRoles.set(turret.housing, 'turret');

    this.speed = Number.isFinite(config.speed) ? Math.max(0, config.speed) * 0.6 : 0;
    this.applyHullPose();
    this.mesh.quaternion.setFromAxisAngle(UP, this.yaw);
    this.mesh.updateMatrixWorld(true);
    this.rebuildCollisionParts();
  }

  // ===========================================================================================
  // IBossCore / IAdvancedBoss
  // ===========================================================================================

  public update(
    deltaTime: number,
    playerMesh: THREE.Object3D | null,
    friendlyMeshes: THREE.Object3D[]
  ): void {
    if (this.disposed) return;
    const dt = Number.isFinite(deltaTime) ? THREE.MathUtils.clamp(deltaTime, 0, MAX_STEP_DT) : 0;
    if (dt <= 0) return;
    this.time += dt;
    this.playerMesh = playerMesh;
    this.friendlyMeshes = Array.isArray(friendlyMeshes) ? friendlyMeshes : [];
    this.trackPlayer(dt);

    if (this.dying) {
      this.updateDeathSequence(dt);
      if (this.disposed) return;
      this.updateHazards(dt);
      this.missileSystem.update(dt);
      return;
    }
    if (!this.isAlive()) return;

    const tuning = this.tuning();
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.updateDiveCycle(dt, tuning);
    this.updateMovement(dt, tuning);
    this.applyHullPose();
    this.mesh.updateMatrixWorld(true);
    this.updateCombat(dt, tuning);
    if (this.disposed) return;
    this.updateHazards(dt);
    this.missileSystem.update(dt);
    this.updateVisuals(dt);
    this.rebuildCollisionParts();
  }

  public takeDamage(amount: number): void {
    if (this.disposed || !this.isAlive() || this.isInvulnerable()) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.hitFlash = Math.min(1, this.hitFlash + 0.35);
    this.health.takeDamage(amount);
    if (!this.disposed && this.isAlive()) this.evaluatePhase();
  }

  public takeDamageAt(part: THREE.Object3D, amount: number): void {
    if (this.disposed || this.deathHandled) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    // 水雷是独立目标：潜航期间也可以清雷，且不影响 Boss 血量
    if (this.mines.isMine(part)) {
      this.mines.damage(part, amount);
      return;
    }
    if (this.isInvulnerable()) return;
    const multiplier = this.getDamageMultiplier(part);
    const dealt = amount * multiplier;
    if (!(dealt > 0)) return;
    const structure = this.structureByPart.get(part);
    if (structure && structure.alive) {
      structure.hp = Math.max(0, structure.hp - dealt);
      structure.subTarget.current = structure.hp;
      if (structure.hp <= 0) this.destroyStructure(structure);
    }
    this.hitFlash = Math.min(1, this.hitFlash + (multiplier > 1 ? 0.5 : 0.25));
    this.health.takeDamage(dealt);
    if (!this.disposed && this.isAlive()) this.evaluatePhase();
  }

  public getHealth(): { current: number; max: number } {
    return { current: this.health.getCurrentHealth(), max: this.health.getMaxHealth() };
  }

  public isAlive(): boolean {
    return this.health.getCurrentHealth() > 0 && !this.deathHandled;
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public getConfig(): BossConfig {
    return this.config;
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  public getCollisionParts(): THREE.Object3D[] {
    return this.collisionParts;
  }

  public getMissileSystem(): BossMissileSystem {
    return this.missileSystem;
  }

  public getPhase(): number {
    return this.phase;
  }

  public getPhaseCount(): number {
    return PHASE_COUNT;
  }

  public isInvulnerable(): boolean {
    return this.dying || this.deathHandled || this.submergeLevel >= 0.5;
  }

  public getDamageMultiplier(part: THREE.Object3D): number {
    if (this.mines.isMine(part)) return 1;
    if (this.isInvulnerable()) return 0;
    const structure = this.structureByPart.get(part);
    if (structure && structure.kind !== 'bay') {
      if (!structure.alive) return this.getHullMultiplier();
      return structure.kind === 'sail' ? 1.8 : 2.0;
    }
    const role = this.partRoles.get(part) ?? 'hull';
    if (role === 'hatch') {
      if (!structure || !structure.alive) return this.getHullMultiplier();
      const hatch = this.hatchByPart.get(part);
      return hatch && hatch.open >= 0.5 ? 2.4 : 0.5;
    }
    if (role === 'turret') return 0.6;
    return this.getHullMultiplier();
  }

  public checkHazard(targetPosition: THREE.Vector3, targetRadius: number): BossHazardHit | null {
    if (this.disposed || !targetPosition || !isFiniteVector(targetPosition)) return null;
    if (this.deathHandled) return null;
    const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 0;
    resetHazardProbe(this.probe);
    this.rings.probe(targetPosition, radius, this.probe);
    this.mines.probe(targetPosition, radius, this.probe);
    this.probeRam(targetPosition, radius);
    if (this.probe.damage <= 0) return null;
    return {
      damage: this.probe.damage,
      profile: this.probe.profile,
      position: this.probe.position.clone(),
    };
  }

  public getStatusLabel(): string | null {
    const aliveTanks = this.getAliveTankCount();
    const hatchesOpen =
      this.isBayAlive() && this.salvoState !== 'idle' && this.salvoState !== 'closing' ? 1 : 0;
    const stateCode =
      this.dying || this.deathHandled
        ? 9
        : this.stunTimer > 0
          ? 8
          : this.ramState === 'telegraph' || this.ramState === 'charge'
            ? 7
            : this.diveState === 'submerged' && this.telegraphShown
              ? 6
              : this.submergeLevel >= 0.5
                ? 5
                : this.diveState === 'breaching'
                  ? 4
                  : 3;
    const key = stateCode * 10000 + this.phase * 1000 + aliveTanks * 10 + hatchesOpen;
    if (key === this.statusKey) return this.statusLabel;
    this.statusKey = key;
    switch (stateCode) {
      case 9:
        this.statusLabel = '艇体断裂';
        break;
      case 8:
        this.statusLabel = '电磁瘫痪 · 被迫上浮';
        break;
      case 7:
        this.statusLabel = '冲撞突进';
        break;
      case 6:
        this.statusLabel = '即将破冰上浮';
        break;
      case 5:
        this.statusLabel = '潜航中 · 无敌';
        break;
      case 4:
        this.statusLabel = '破冰上浮';
        break;
      default:
        if (this.phase >= 3) {
          this.statusLabel = '压载舱破裂 · 无法下潜';
        } else if (hatchesOpen) {
          this.statusLabel = '导弹舱开启 · 弱点暴露';
        } else if (aliveTanks === 0) {
          this.statusLabel = '压载舱全毁 · 无法下潜';
        } else {
          this.statusLabel = `上浮 · 压载舱 ${aliveTanks}/${this.rig.tanks.length}`;
        }
    }
    return this.statusLabel;
  }

  public getSubTargets(): BossSubTarget[] {
    return this.subTargets;
  }

  /** EMP：瘫痪期间强制上浮且不能下潜 */
  public applyStun(seconds: number): void {
    if (!this.isAlive() || this.disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    this.stunTimer = Math.max(this.stunTimer, Math.min(4, seconds));
    if (this.diveState === 'diving' || this.diveState === 'submerged') this.forceSurface();
    this.rig.sail.getWorldPosition(this.tmpA);
    this.fx.emit('createHit', this.tmpA, 2, 'boss');
  }

  /**
   * 扩展：开启后血量归零先播放约 4.5 秒“断裂下沉”（期间 isAlive() 为 false、无敌、无碰撞部件），
   * 结束时才触发 onDestroy。默认关闭（契约：归零时同步触发）。
   */
  public setDeathSequenceEnabled(enabled: boolean): void {
    this.deathSequenceEnabled = enabled;
  }

  public isDying(): boolean {
    return this.dying;
  }

  /** 扩展：当前潜航程度（0 = 完全上浮，1 = 完全下潜） */
  public getSubmergeLevel(): number {
    return this.submergeLevel;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dying = false;
    this.missileSystem.dispose();
    this.rings.dispose();
    this.spouts.dispose();
    this.shells.dispose();
    this.mines.dispose();
    this.shards.dispose();
    this.wake.dispose();
    this.lane.dispose();
    this.breachMarker.dispose();
    this.hazardRoot.parent?.remove(this.hazardRoot);
    this.mesh.visible = false;
    this.mesh.parent?.remove(this.mesh);
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      disposeObjectTree(child);
    }
    this.collisionParts.length = 0;
    this.structureByPart.clear();
    this.hatchByPart.clear();
    this.partRoles.clear();
  }

  // ===========================================================================================
  // 构造辅助
  // ===========================================================================================

  private ensureRig(mesh: THREE.Group, config: BossConfig): AbyssalLeviathanRig {
    const existing = (mesh as AbyssalLeviathanGroup).leviathanRig;
    if (existing) return existing;
    const built = createAbyssalLeviathanMesh(config) as AbyssalLeviathanGroup & {
      bossParts?: THREE.Mesh[];
    };
    while (built.children.length > 0) mesh.add(built.children[0]);
    const rig = built.leviathanRig;
    if (!rig) throw new Error('AbyssalLeviathanAI: mesh factory produced no rig');
    (mesh as AbyssalLeviathanGroup & { bossParts?: THREE.Mesh[] }).bossParts = built.bossParts;
    (mesh as AbyssalLeviathanGroup).leviathanRig = rig;
    if (!mesh.name) mesh.name = built.name;
    return rig;
  }

  private addStructure(
    kind: 'sail' | 'tank' | 'bay',
    index: number,
    mesh: THREE.Object3D,
    parts: readonly THREE.Object3D[],
    max: number,
    tank: LeviathanTankRig | null
  ): void {
    const subTarget: BossSubTarget = { mesh, current: max, max };
    const structure: StructureTarget = {
      kind,
      index,
      mesh,
      hp: max,
      max,
      alive: true,
      subTarget,
      tank,
    };
    this.structures.push(structure);
    for (const part of parts) this.structureByPart.set(part, structure);
    this.subTargets.push(subTarget);
    if (kind !== 'bay') this.partRoles.set(mesh, kind);
  }

  private rebuildCollisionParts(): void {
    const parts = this.collisionParts;
    parts.length = 0;
    if (this.deathHandled || this.disposed) return;
    this.mines.collectTargets(parts);
    if (this.isInvulnerable()) return;
    const bayAlive = this.isBayAlive();
    if (bayAlive) {
      for (const hatch of this.hatches) if (hatch.open >= 0.5) parts.push(hatch.rig.silo);
    }
    for (const structure of this.structures) {
      if (structure.alive && structure.kind !== 'bay') parts.push(structure.mesh);
    }
    if (bayAlive) {
      for (const hatch of this.hatches) if (hatch.open < 0.5) parts.push(hatch.rig.silo);
    }
    for (const turret of this.rig.turrets) parts.push(turret.housing);
    parts.push(this.rig.hullBow, this.rig.deck, this.rig.hullStern, this.rig.propulsor);
  }

  private tuning(): LeviathanPhaseTuning {
    return PHASE_TUNING[Math.min(PHASE_TUNING.length, Math.max(1, this.phase)) - 1];
  }

  private getAliveTankCount(): number {
    let count = 0;
    for (const structure of this.structures) {
      if (structure.kind === 'tank' && structure.alive) count++;
    }
    return count;
  }

  private isSailAlive(): boolean {
    return this.structures[0]?.alive ?? false;
  }

  private isBayAlive(): boolean {
    for (const structure of this.structures) {
      if (structure.kind === 'bay') return structure.alive;
    }
    return false;
  }

  private getHullMultiplier(): number {
    return this.phase >= 3 ? 0.55 : 0.4;
  }

  private canDive(): boolean {
    return this.phase < 3 && this.getAliveTankCount() > 0 && this.stunTimer <= 0;
  }

  // ===========================================================================================
  // 玩家追踪 / 潜航循环 / 移动
  // ===========================================================================================

  private trackPlayer(dt: number): void {
    const position = this.playerMesh?.position;
    if (!position || !isFiniteVector(position)) {
      this.hasPlayer = false;
      return;
    }
    if (this.hasLastPlayer) {
      this.tmpA.subVectors(position, this.lastPlayerPos).divideScalar(dt);
      if (isFiniteVector(this.tmpA) && this.tmpA.lengthSq() < 400 * 400) {
        this.playerVel.lerp(this.tmpA, Math.min(1, dt * 3));
      }
    }
    this.lastPlayerPos.copy(position);
    this.playerPos.copy(position);
    this.hasPlayer = true;
    this.hasLastPlayer = true;
  }

  private updateDiveCycle(dt: number, tuning: LeviathanPhaseTuning): void {
    this.stateTimer += dt;
    switch (this.diveState) {
      case 'surfaced': {
        this.submergeLevel = Math.max(0, this.submergeLevel - dt * 0.6);
        this.windowTime += dt;
        const busy =
          this.salvoState === 'opening' || this.salvoState === 'firing' || this.ramState !== 'idle';
        if (this.canDive() && this.windowTime >= tuning.surfacedTime && !busy) {
          this.startDive();
        }
        return;
      }
      case 'diving': {
        const p = Math.min(1, this.stateTimer / DIVE_TIME);
        this.submergeLevel = smoothstep(p);
        if (p >= 1) {
          this.diveState = 'submerged';
          this.stateTimer = 0;
          this.telegraphShown = false;
          this.chooseBreachTarget();
        }
        return;
      }
      case 'submerged': {
        this.submergeLevel = 1;
        const duration = this.getSubmergedDuration(tuning);
        if (!this.telegraphShown && this.stateTimer >= duration - BREACH_TELEGRAPH) {
          this.startBreachTelegraph();
        }
        if (this.telegraphShown) {
          const progress = 1 - (duration - this.stateTimer) / BREACH_TELEGRAPH;
          this.breachMarker.update(dt, progress);
        }
        if (this.stateTimer >= duration) {
          this.diveState = 'breaching';
          this.stateTimer = 0;
          this.breachImpactDone = false;
        }
        return;
      }
      case 'breaching': {
        const p = Math.min(1, this.stateTimer / BREACH_TIME);
        // 艇艏先跃出水面再回落：带一点回弹
        const rise = 1 - Math.pow(1 - Math.min(1, p * 1.35), 3);
        const settle = p > 0.74 ? Math.sin(((p - 0.74) / 0.26) * Math.PI) * 0.05 : 0;
        this.submergeLevel = THREE.MathUtils.clamp(1 - rise * 1.07 + settle, -0.07, 1);
        if (!this.breachImpactDone && this.submergeLevel < 0.5) {
          this.breachImpactDone = true;
          this.triggerBreachImpact();
        }
        if (p >= 1) {
          this.diveState = 'surfaced';
          this.stateTimer = 0;
          this.submergeLevel = Math.max(0, this.submergeLevel);
          this.windowTime = 0;
          this.salvoIndex = 0;
          this.minesLaunched = false;
          this.minionsLaunched = false;
        }
        return;
      }
    }
  }

  private getSubmergedDuration(tuning: LeviathanPhaseTuning): number {
    const lostTanks = this.rig.tanks.length - this.getAliveTankCount();
    return Math.max(BREACH_TELEGRAPH + 2.2, tuning.submergedTime - lostTanks * 1.2);
  }

  private startDive(): void {
    this.diveState = 'diving';
    this.stateTimer = 0;
    this.chooseBreachTarget();
    this.closeHatches();
    this.rings.spawn(this.mesh.position, {
      maxRadius: 95 * this.sizeFactor,
      duration: 1.6,
      wallHeight: 5 * this.sizeFactor,
      bandWidth: 8 * this.sizeFactor,
      damage: 0,
      profile: 'boss-armor',
      color: 0xdff6ff,
      opacity: 0.6,
    });
    for (let i = -1; i <= 1; i++) {
      this.alongHull(i * 0.55, this.tmpA);
      this.fx.emit('createWaterImpact', this.tmpA, 1.8);
    }
    this.emitCue('dive', this.mesh.position, 0.8);
  }

  private forceSurface(): void {
    if (this.diveState === 'diving') {
      // 立即反向：从当前深度直接进入上浮预警
      this.diveState = 'submerged';
      this.submergeLevel = Math.max(this.submergeLevel, 0.6);
    }
    if (this.diveState === 'submerged') {
      const duration = this.getSubmergedDuration(this.tuning());
      this.stateTimer = Math.max(this.stateTimer, duration - BREACH_TELEGRAPH);
      if (!this.telegraphShown) this.startBreachTelegraph();
    }
  }

  private chooseBreachTarget(): void {
    const sf = this.sizeFactor;
    if (!this.hasPlayer) {
      this.breachTarget.copy(this.mesh.position);
      this.hasBreachTarget = true;
      return;
    }
    this.tmpA.set(this.playerVel.x, 0, this.playerVel.z);
    if (this.tmpA.lengthSq() < 9) {
      this.tmpA.set(
        this.mesh.position.x - this.playerPos.x,
        0,
        this.mesh.position.z - this.playerPos.z
      );
    }
    if (this.tmpA.lengthSq() < 1e-4) this.tmpA.set(0, 0, 1);
    this.tmpA.normalize();
    const lateral = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 60) * sf;
    this.breachTarget.set(
      this.playerPos.x + this.tmpA.x * 170 * sf - this.tmpA.z * lateral,
      this.seaY,
      this.playerPos.z + this.tmpA.z * 170 * sf + this.tmpA.x * lateral
    );
    this.clampToLeash(this.breachTarget);
    this.hasBreachTarget = true;
  }

  private clampToLeash(point: THREE.Vector3): void {
    const leash = LEASH_RADIUS * this.sizeFactor;
    const dx = point.x - this.anchor.x;
    const dz = point.z - this.anchor.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > leash) {
      point.x = this.anchor.x + (dx / distance) * leash;
      point.z = this.anchor.z + (dz / distance) * leash;
    }
  }

  private startBreachTelegraph(): void {
    this.telegraphShown = true;
    this.tmpA.set(this.mesh.position.x, this.seaY, this.mesh.position.z);
    this.breachMarker.show(this.tmpA, 130 * this.sizeFactor);
    this.onHazardWarning?.('利维坦上浮');
    this.sonarTimer = Math.min(this.sonarTimer, 0.2);
  }

  private triggerBreachImpact(): void {
    const sf = this.sizeFactor;
    this.breachMarker.hide();
    this.tmpA.set(this.mesh.position.x, this.seaY, this.mesh.position.z);
    this.rings.spawn(this.tmpA, {
      maxRadius: 130 * sf,
      duration: 1.3,
      wallHeight: 34 * sf,
      bandWidth: 16 * sf,
      damage: this.config.damage * 1.2,
      profile: 'boss-armor',
      color: 0xcff6ff,
      opacity: 0.85,
    });
    this.rings.spawn(this.tmpA, {
      maxRadius: 220 * sf,
      duration: 2.1,
      wallHeight: 6 * sf,
      bandWidth: 9 * sf,
      damage: 0,
      profile: 'boss-armor',
      color: 0x7fe8ff,
      opacity: 0.55,
    });
    for (let i = 0; i < 6; i++) {
      const along = -0.75 + i * 0.32;
      this.alongHull(along, this.tmpB);
      const side = i % 2 === 0 ? 1 : -1;
      this.tmpB.x += Math.cos(this.yaw) * side * 22 * sf;
      this.tmpB.z -= Math.sin(this.yaw) * side * 22 * sf;
      this.spouts.spawn(this.tmpB, {
        radius: (11 + Math.random() * 7) * sf,
        height: (42 + Math.random() * 38) * sf,
        warnTime: 0.12 + i * 0.05,
        eruptTime: 1.1 + Math.random() * 0.5,
        damage: 0,
        profile: 'boss-armor',
      });
      this.fx.emit('createWaterImpact', this.tmpB, 2);
    }
    this.shards.burst(this.tmpA, 28, 34 * sf, 38 * sf);
    this.fx.emit('createShockwave', this.tmpA, 170 * sf, 1.2, 0xe8fbff, 0.85);
    this.emitCue('breach', this.tmpA, 1);
  }

  /** 沿艇体轴线的水面点：t = -1（艉）… 1（艏） */
  private alongHull(t: number, out: THREE.Vector3): THREE.Vector3 {
    const distance = t * this.rig.halfLength;
    return out.set(
      this.mesh.position.x + Math.sin(this.yaw) * distance,
      this.seaY,
      this.mesh.position.z + Math.cos(this.yaw) * distance
    );
  }

  private updateMovement(dt: number, tuning: LeviathanPhaseTuning): void {
    const position = this.mesh.position;
    if (this.hasPlayer && !this.snappedToPlayer) {
      this.snappedToPlayer = true;
      // 出场时侧舷对准玩家，方便展示全貌
      const bearing = Math.atan2(this.playerPos.x - position.x, this.playerPos.z - position.z);
      this.yaw = wrapAngle(bearing + Math.PI / 2);
    }

    let desiredYaw = this.yaw;
    let targetSpeed = 0;
    let turnRate = Math.max(0.05, this.config.turnSpeed);
    let response = 0.8;
    const speed = this.config.speed;

    if (this.stunTimer > 0) {
      targetSpeed = 0;
      turnRate = 0;
    } else if (this.diveState === 'surfaced') {
      if (this.ramState === 'telegraph' && this.hasPlayer) {
        desiredYaw = Math.atan2(this.playerPos.x - position.x, this.playerPos.z - position.z);
        turnRate *= 6;
        targetSpeed = speed * 0.2;
      } else if (this.ramState === 'charge') {
        targetSpeed = speed * 3.6;
        turnRate = 0;
        response = 2;
      } else if (this.ramState === 'recover') {
        targetSpeed = speed * 0.3;
      } else if (this.hasPlayer) {
        const dx = this.playerPos.x - position.x;
        const dz = this.playerPos.z - position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const bearing = Math.atan2(dx, dz);
        if (distance > 520 * this.sizeFactor) {
          desiredYaw = bearing;
          targetSpeed = speed;
        } else {
          // 侧舷对敌：两门炮塔都能射击
          const a = wrapAngle(bearing + Math.PI / 2);
          const b = wrapAngle(bearing - Math.PI / 2);
          desiredYaw =
            Math.abs(wrapAngle(a - this.yaw)) < Math.abs(wrapAngle(b - this.yaw)) ? a : b;
          targetSpeed = speed * 0.55 * tuning.speedFactor;
        }
      }
    } else if (this.diveState === 'breaching') {
      // 带着航速冲出水面：上浮过程中继续向前滑行
      targetSpeed = speed * 0.5 * tuning.speedFactor;
      response = 0.5;
    } else if (this.diveState === 'diving' || this.diveState === 'submerged') {
      const holding = this.diveState === 'submerged' && this.telegraphShown;
      if (this.hasBreachTarget && !holding) {
        const dx = this.breachTarget.x - position.x;
        const dz = this.breachTarget.z - position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        desiredYaw = Math.atan2(dx, dz);
        turnRate *= 3;
        targetSpeed =
          distance < 25 * this.sizeFactor
            ? 0
            : speed * (this.diveState === 'diving' ? 1.4 : 2.4) * tuning.speedFactor;
      }
    }

    const diff = wrapAngle(desiredYaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + THREE.MathUtils.clamp(diff, -turnRate * dt, turnRate * dt));
    if (!Number.isFinite(targetSpeed)) targetSpeed = 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * response);
    position.x += Math.sin(this.yaw) * this.speed * dt;
    position.z += Math.cos(this.yaw) * this.speed * dt;
    this.clampToLeash(position);
    position.y = this.seaY;
    if (!isFiniteVector(position)) {
      position.copy(this.anchor);
      this.speed = 0;
    }
    this.mesh.quaternion.setFromAxisAngle(UP, this.yaw);
  }

  private applyHullPose(): void {
    const hull = this.rig.hullRig;
    const level = this.submergeLevel;
    let pitch = 0;
    if (this.diveState === 'diving') {
      pitch = 0.17 * Math.sin(Math.min(1, this.stateTimer / DIVE_TIME) * Math.PI);
    } else if (this.diveState === 'breaching') {
      const p = Math.min(1, this.stateTimer / BREACH_TIME);
      pitch = -0.42 * Math.sin(Math.min(1, p * 1.25) * Math.PI) * (1 - p * 0.5);
    }
    let roll = 0.02 * Math.sin(this.time * 0.6);
    if (this.phase >= 3) roll += 0.1;
    if (this.ramState === 'charge') pitch -= 0.04;
    this.hullPitch += (pitch - this.hullPitch) * 0.25;
    this.hullRoll += (roll - this.hullRoll) * 0.08;
    const bob = level < 0.2 ? Math.sin(this.time * 0.9) * 0.35 * this.rig.scale * 0.2 : 0;
    hull.position.set(0, -level * this.rig.diveDepth + bob, 0);
    this.tmpEuler.set(this.hullPitch, 0, this.hullRoll, 'YXZ');
    hull.quaternion.setFromEuler(this.tmpEuler);
  }

  // ===========================================================================================
  // 战斗
  // ===========================================================================================

  private updateCombat(dt: number, tuning: LeviathanPhaseTuning): void {
    this.updateSalvo(dt, tuning);
    this.updatePendingTorpedoes(dt);
    this.updateRam(dt, tuning);
    if (this.stunTimer > 0 || !this.hasPlayer) return;

    if (this.diveState === 'submerged' || this.diveState === 'diving') {
      this.updateSonar(dt);
      if (this.diveState === 'submerged' && !this.telegraphShown) this.updateTorpedoes(dt, tuning);
      return;
    }
    if (this.diveState === 'breaching') {
      // 跃出水面的后半段炮塔已经露出水面，可以开火
      this.updateTurrets(dt, tuning);
      return;
    }

    this.updateTurrets(dt, tuning);
    if (this.phase >= 3) {
      this.salvoRepeatTimer -= dt;
      if (this.salvoRepeatTimer <= 0 && this.salvoState === 'idle') {
        this.salvoRepeatTimer = tuning.salvoInterval * this.cadence;
        this.startSalvo();
      }
      this.mineRepeatTimer -= dt;
      if (this.mineRepeatTimer <= 0) {
        this.mineRepeatTimer = tuning.mineInterval * this.cadence;
        this.launchMines(tuning.mineCount);
      }
      this.minionRepeatTimer -= dt;
      if (this.minionRepeatTimer <= 0) {
        this.minionRepeatTimer = tuning.minionInterval;
        this.spawnMinions(tuning.minions);
      }
      return;
    }

    // 上浮窗口内的固定节目单
    const due = tuning.salvoTimes[this.salvoIndex];
    if (due !== undefined && this.windowTime >= due * this.cadence && this.salvoState === 'idle') {
      this.salvoIndex++;
      this.startSalvo();
    }
    if (tuning.mineCount > 0 && !this.minesLaunched && this.windowTime >= tuning.mineTime) {
      this.minesLaunched = true;
      this.launchMines(tuning.mineCount);
    }
    if (
      tuning.minions.length > 0 &&
      !this.minionsLaunched &&
      this.windowTime >= tuning.minionTime
    ) {
      this.minionsLaunched = true;
      this.spawnMinions(tuning.minions);
    }
  }

  private updateTurrets(dt: number, tuning: LeviathanPhaseTuning): void {
    for (const turret of this.rig.turrets) {
      turret.yaw.getWorldPosition(this.tmpA);
      this.tmpB.subVectors(this.playerPos, this.tmpA);
      const c = Math.cos(this.yaw);
      const s = Math.sin(this.yaw);
      const localX = c * this.tmpB.x - s * this.tmpB.z;
      const localZ = s * this.tmpB.x + c * this.tmpB.z;
      const target = Math.atan2(localX, localZ);
      turret.yaw.rotation.y += wrapAngle(target - turret.yaw.rotation.y) * Math.min(1, dt * 2.5);
    }
    this.turretTimer -= dt;
    if (this.turretTimer > 0) return;
    const slowdown = this.isSailAlive() ? 1 : 1.4;
    this.turretTimer = Math.max(
      0.25,
      this.config.cannonFireInterval * tuning.turretFactor * slowdown
    );
    if (this.submergeLevel > 0.3) return;
    const turret = this.rig.turrets[this.turretIndex % this.rig.turrets.length];
    const muzzleIndex = Math.floor(this.turretIndex / 2);
    this.turretIndex++;
    if (!turret || turret.muzzles.length === 0) return;
    const muzzle = turret.muzzles[muzzleIndex % turret.muzzles.length];
    muzzle.getWorldPosition(this.tmpA);
    const distance = this.tmpA.distanceTo(this.playerPos);
    if (distance > TURRET_RANGE || distance < 1) return;
    this.tmpB
      .copy(this.playerPos)
      .addScaledVector(this.playerVel, (distance / 100) * 0.7)
      .sub(this.tmpA)
      .normalize();
    if (!isFiniteVector(this.tmpB)) return;
    this.fx.emit('createHit', this.tmpA, 1.2, 'enemy');
    this.onFire?.(this.tmpA.clone(), this.tmpB.clone(), this.config.damage);
  }

  private startSalvo(): void {
    if (this.salvoState !== 'idle' || !this.isBayAlive()) return;
    this.salvoState = 'opening';
    this.salvoTimer = 0;
    this.onHazardWarning?.('垂发导弹齐射');
    this.rig.deck.getWorldPosition(this.tmpA);
    this.emitCue('hatch-open', this.tmpA, 0.7);
  }

  private closeHatches(): void {
    if (this.salvoState !== 'idle') {
      this.salvoState = 'closing';
      this.salvoTimer = 0;
      this.salvoQueue = 0;
    }
  }

  private updateSalvo(dt: number, tuning: LeviathanPhaseTuning): void {
    this.salvoTimer += dt;
    let target = 0;
    switch (this.salvoState) {
      case 'opening':
        target = 1;
        if (this.salvoTimer >= HATCH_OPEN_TIME) {
          this.salvoState = 'firing';
          this.salvoTimer = 0;
          this.salvoQueue = tuning.missileCount;
          this.salvoFired = 0;
        }
        break;
      case 'firing':
        target = 1;
        if (this.salvoQueue > 0 && this.salvoTimer >= 0.28) {
          this.salvoTimer = 0;
          this.launchSalvoMissile();
          this.salvoQueue--;
        }
        if (this.salvoQueue <= 0) {
          this.salvoState = 'holding';
          this.salvoTimer = 0;
        }
        break;
      case 'holding':
        target = 1;
        if (this.salvoTimer >= HATCH_HOLD_TIME) {
          this.salvoState = 'closing';
          this.salvoTimer = 0;
        }
        break;
      case 'closing':
        if (this.salvoTimer >= HATCH_CLOSE_TIME) {
          this.salvoState = 'idle';
          this.salvoTimer = 0;
        }
        break;
      default:
        break;
    }
    const bayAlive = this.isBayAlive();
    // 导弹舱被毁：舱门被炸开卡死，发射井持续燃烧
    if (!bayAlive) target = 1;
    for (const hatch of this.hatches) {
      const rate = target > hatch.open ? dt / (HATCH_OPEN_TIME * 0.8) : dt / HATCH_CLOSE_TIME;
      hatch.open += THREE.MathUtils.clamp(target - hatch.open, -rate, rate);
      hatch.rig.pivot.rotation.z = -hatch.rig.side * hatch.open * (bayAlive ? 1.95 : 2.4);
      hatch.rig.siloMaterial.emissiveIntensity = bayAlive
        ? 0.25 + hatch.open * (2.6 + 0.8 * Math.sin(this.time * 12 + hatch.rig.index))
        : 1.6 + 1.4 * Math.abs(Math.sin(this.time * 9 + hatch.rig.index * 1.7));
    }
  }

  private launchSalvoMissile(): void {
    if (!this.hasPlayer) return;
    const hatch = this.hatches[(this.salvoFired * 3) % this.hatches.length];
    if (!hatch) return;
    hatch.rig.launchPoint.getWorldPosition(this.tmpA);
    let target: THREE.Object3D | null = null;
    if (this.salvoFired === 1) {
      let best = Infinity;
      for (const friendly of this.friendlyMeshes) {
        if (!friendly.parent) continue;
        const d = friendly.position.distanceToSquared(this.tmpA);
        if (d < best) {
          best = d;
          target = friendly;
        }
      }
    }
    this.missileSystem.fire(
      this.tmpA.clone(),
      target,
      this.friendlyMeshes,
      this.playerMesh,
      target === null
    );
    this.salvoFired++;
    this.fx.emit('createExplosion', this.tmpA, 0.9, 'enemy');
    this.fx.emit('createWaterImpact', this.tmpA, 1.1);
    this.onMissileFired?.();
    this.emitCue('missile-launch', this.tmpA, 0.7);
  }

  private launchMines(count: number): void {
    if (count <= 0 || !this.hasPlayer) return;
    const sf = this.sizeFactor;
    // 布雷区：玩家航迹前方的水面
    this.tmpC.copy(this.playerPos).addScaledVector(this.playerVel, 2.2);
    this.tmpC.y = this.seaY;
    for (let i = 0; i < count; i++) {
      const tube = this.rig.mineTubes[i % this.rig.mineTubes.length];
      if (!tube) return;
      tube.getWorldPosition(this.tmpA);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = (35 + Math.random() * 85) * sf;
      this.tmpB.set(
        this.tmpC.x + Math.cos(angle) * radius,
        this.seaY + 1.2 * sf,
        this.tmpC.z + Math.sin(angle) * radius
      );
      this.clampToLeash(this.tmpB);
      const spec = this.shellSpec;
      spec.flightTime = 1.9 + i * 0.09;
      spec.apexHeight = (45 + Math.random() * 25) * sf;
      spec.burstRadius = 12 * sf;
      spec.damage = 0;
      spec.profile = 'flak-hit';
      spec.payload = 1;
      spec.groundY = this.seaY;
      this.shells.launch(this.tmpA, this.tmpB, spec);
    }
    this.rig.mineTubes[0]?.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 0.7, 'enemy');
  }

  private handleShellArrive(position: THREE.Vector3, payload: number, _spec: ArcShellSpec): void {
    if (payload !== 1) return;
    this.tmpD.set(position.x, this.seaY + 1.2 * this.sizeFactor, position.z);
    this.mines.spawn(this.tmpD, this.mineSpec);
    this.fx.emit('createWaterImpact', this.tmpD, 1.3);
    if (this.time - this.lastMineCue > 0.4) {
      this.lastMineCue = this.time;
      this.emitCue('mine-drop', this.tmpD, 0.5);
    }
  }

  private handleMineDetonate(position: THREE.Vector3, harmless: boolean, radius: number): void {
    this.fx.emit('createExplosion', position, harmless ? 1.2 : 1.8, 'enemy');
    this.fx.emit('createWaterImpact', position, 2);
    this.fx.emit('createShockwave', position, radius * (harmless ? 0.6 : 1.1), 0.5, 0xff6644, 0.8);
    this.emitCue('mine-detonate', position, harmless ? 0.5 : 0.9);
  }

  private spawnMinions(kinds: readonly BossMinionKind[]): void {
    if (kinds.length === 0) return;
    kinds.forEach((kind, i) => {
      const hatch = this.hatches[(i * 3 + 1) % this.hatches.length];
      if (!hatch) return;
      hatch.rig.launchPoint.getWorldPosition(this.tmpA);
      const position = new THREE.Vector3(
        this.tmpA.x,
        this.tmpA.y + 14 * this.sizeFactor,
        this.tmpA.z
      );
      this.onSpawnMinion?.(position, kind);
    });
  }

  private updateSonar(dt: number): void {
    this.sonarTimer -= dt;
    if (this.sonarTimer > 0) return;
    this.sonarTimer = this.telegraphShown ? 0.9 : 2.4;
    this.tmpA.set(this.mesh.position.x, this.seaY + 0.5, this.mesh.position.z);
    this.rings.spawn(this.tmpA, {
      maxRadius: 170 * this.sizeFactor,
      duration: 1.9,
      wallHeight: 2.5 * this.sizeFactor,
      bandWidth: 4 * this.sizeFactor,
      damage: 0,
      profile: 'boss-armor',
      color: this.telegraphShown ? 0xff6a5a : 0x5ff0ff,
      opacity: 0.75,
    });
    this.sonarFlash = 1;
    this.emitCue('sonar', this.tmpA, this.telegraphShown ? 0.9 : 0.5);
  }

  private updateTorpedoes(dt: number, tuning: LeviathanPhaseTuning): void {
    if (tuning.torpedoInterval <= 0) return;
    this.torpedoTimer -= dt;
    if (this.torpedoTimer > 0) return;
    this.torpedoTimer = tuning.torpedoInterval * this.cadence;
    const sf = this.sizeFactor;
    for (let k = 0; k < tuning.torpedoCount; k++) {
      const slot = this.pendingTorpedoes.find((entry) => !entry.active);
      if (!slot) return;
      const angle = Math.random() * Math.PI * 2;
      const radius = (10 + Math.random() * 30) * sf;
      slot.position.set(
        this.mesh.position.x + Math.cos(angle) * radius,
        this.seaY,
        this.mesh.position.z + Math.sin(angle) * radius
      );
      if (slot.position.distanceTo(this.playerPos) > TURRET_RANGE) continue;
      slot.active = true;
      slot.timer = 0.75 + k * 0.12;
      this.spouts.spawn(slot.position, {
        radius: 6 * sf,
        height: 30 * sf,
        warnTime: slot.timer,
        eruptTime: 0.7,
        damage: 0,
        profile: 'boss-cannon',
      });
    }
  }

  private updatePendingTorpedoes(dt: number): void {
    for (const slot of this.pendingTorpedoes) {
      if (!slot.active) continue;
      slot.timer -= dt;
      if (slot.timer > 0) continue;
      slot.active = false;
      if (!this.hasPlayer || this.deathHandled) continue;
      this.tmpA.copy(slot.position);
      this.tmpA.y += 3 * this.sizeFactor;
      const distance = this.tmpA.distanceTo(this.playerPos);
      this.tmpB
        .copy(this.playerPos)
        .addScaledVector(this.playerVel, (distance / 100) * 0.6)
        .sub(this.tmpA)
        .normalize();
      if (!isFiniteVector(this.tmpB)) continue;
      this.fx.emit('createWaterImpact', this.tmpA, 1.6);
      this.onFire?.(this.tmpA.clone(), this.tmpB.clone(), this.config.damage);
      this.emitCue('torpedo', this.tmpA, 0.6);
    }
  }

  private updateRam(dt: number, tuning: LeviathanPhaseTuning): void {
    if (tuning.ramInterval <= 0 || this.diveState !== 'surfaced') {
      if (this.ramState !== 'idle') {
        this.ramState = 'idle';
        this.lane.hide();
      }
      return;
    }
    this.ramTimer += dt;
    this.rig.bowTip.getWorldPosition(this.tmpA);
    this.tmpA.y = this.seaY;
    switch (this.ramState) {
      case 'idle':
        this.ramCooldown -= dt;
        if (this.ramCooldown <= 0 && this.hasPlayer && this.stunTimer <= 0) {
          this.ramState = 'telegraph';
          this.ramTimer = 0;
          this.lane.show(this.tmpA, this.yaw, 380 * this.sizeFactor, 48 * this.sizeFactor);
          this.onHazardWarning?.('冲撞预警');
          this.emitCue('horn', this.tmpA, 1);
        }
        return;
      case 'telegraph':
        this.lane.follow(this.tmpA, this.yaw);
        this.lane.update(dt, Math.min(1, this.ramTimer / RAM_TELEGRAPH));
        if (this.ramTimer >= RAM_TELEGRAPH) {
          this.ramState = 'charge';
          this.ramTimer = 0;
          this.emitCue('ram', this.tmpA, 1);
        }
        return;
      case 'charge':
        this.lane.update(dt, 1);
        this.ramWakeTimer -= dt;
        if (this.ramWakeTimer <= 0) {
          this.ramWakeTimer = 0.14;
          this.fx.emit('createWaterImpact', this.tmpA, 2);
        }
        if (this.ramTimer >= RAM_CHARGE) {
          this.ramState = 'recover';
          this.ramTimer = 0;
          this.lane.hide();
        }
        return;
      case 'recover':
        if (this.ramTimer >= RAM_RECOVER) {
          this.ramState = 'idle';
          this.ramTimer = 0;
          this.ramCooldown = tuning.ramInterval * this.cadence;
        }
        return;
    }
  }

  private probeRam(target: THREE.Vector3, radius: number): void {
    if (this.ramState !== 'charge' || this.speed < this.config.speed * 1.5) return;
    const sf = this.sizeFactor;
    if (target.y > this.seaY + 36 * sf) return;
    this.rig.bowTip.getWorldPosition(this.tmpC);
    this.tmpD.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // 艏部胶囊体：艏尖向后 60 米
    this.tmpB.subVectors(target, this.tmpC);
    const along = THREE.MathUtils.clamp(this.tmpB.dot(this.tmpD), -60 * sf, 0);
    this.tmpB.copy(this.tmpC).addScaledVector(this.tmpD, along);
    const reach = 26 * sf + radius;
    if (this.tmpB.distanceToSquared(target) > reach * reach) return;
    const damage = this.config.damage * 1.6;
    if (damage > this.probe.damage) {
      this.probe.damage = damage;
      this.probe.profile = 'boss-armor';
      this.probe.position.copy(this.tmpB);
    }
  }

  // ===========================================================================================
  // 子目标 / 阶段 / 死亡
  // ===========================================================================================

  private destroyStructure(structure: StructureTarget): void {
    if (!structure.alive) return;
    structure.alive = false;
    structure.hp = 0;
    structure.subTarget.current = 0;
    structure.mesh.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 2.2, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 2.2, 'boss-armor');
    if (structure.kind === 'sail') {
      this.rig.materials.bridge.emissiveIntensity = 0.08;
      this.emitCue('sail-destroyed', this.tmpA, 1);
    } else if (structure.kind === 'bay') {
      for (const hatch of this.hatches) hatch.rig.siloMaterial.emissive.set(0xff6a20);
      if (this.salvoState === 'opening' || this.salvoState === 'firing') {
        this.salvoState = 'holding';
        this.salvoTimer = 0;
        this.salvoQueue = 0;
      }
      this.emitCue('bay-destroyed', this.tmpA, 1);
    } else {
      this.fx.emit('createWaterImpact', this.tmpA, 2);
      if (structure.tank) structure.tank.valveMaterial.emissive.set(0xff3020);
      this.emitCue('tank-destroyed', this.tmpA, 0.9);
    }
    this.statusKey = -1;
  }

  private evaluatePhase(): void {
    if (!this.isAlive()) return;
    const ratio = this.health.getCurrentHealth() / Math.max(1, this.health.getMaxHealth());
    let target = 1;
    if (ratio <= PHASE3_RATIO) target = 3;
    else if (ratio <= PHASE2_RATIO) target = 2;
    while (this.phase < target && !this.disposed) this.enterPhase(this.phase + 1);
  }

  private enterPhase(phase: number): void {
    this.phase = Math.min(PHASE_COUNT, phase);
    const label = this.phase === 2 ? '布雷开始 · 潜航缩短' : '压载舱破裂 · 冲撞模式';
    this.rig.sail.getWorldPosition(this.tmpA);
    if (this.phase >= 3) {
      // 剩余压载舱全部破裂：永久上浮
      for (const structure of this.structures) {
        if (structure.kind === 'tank' && structure.alive) this.destroyStructure(structure);
      }
      this.salvoRepeatTimer = 5;
      this.mineRepeatTimer = 3;
      this.minionRepeatTimer = 8;
      this.ramCooldown = 4;
      this.forceSurface();
    }
    this.statusKey = -1;
    this.emitCue('phase', this.tmpA, 1);
    this.onPhaseChange?.(this.phase, label);
  }

  private handleHealthDepleted(): void {
    if (this.deathHandled) return;
    this.deathHandled = true;
    this.clearHazards();
    for (const missile of this.missileSystem.getMissiles()) missile.takeDamage(1e6);
    this.collisionParts.length = 0;
    this.statusKey = -1;
    if (this.deathSequenceEnabled && !this.disposed) {
      this.dying = true;
      this.deathTimer = 0;
      this.deathBurstTimer = 0;
      this.breakPoint.set(0, -0.6 * this.rig.scale, -1 * this.rig.scale);
      this.rig.deck.getWorldPosition(this.tmpA);
      this.emitCue('hull-break', this.tmpA, 1);
      return;
    }
    this.finishDeath();
  }

  private clearHazards(): void {
    this.rings.clear();
    this.spouts.clear();
    this.shells.clear();
    this.mines.clear();
    this.lane.hide();
    this.breachMarker.hide();
    this.ramState = 'idle';
    this.salvoState = 'idle';
    this.salvoQueue = 0;
    for (const slot of this.pendingTorpedoes) slot.active = false;
  }

  private updateDeathSequence(dt: number): void {
    this.deathTimer += dt;
    const p = Math.min(1, this.deathTimer / DEATH_SEQUENCE_DURATION);
    const sf = this.sizeFactor;
    // 艇体在断点处折成两截：艏段低头、艉段翘起，整体下沉
    const bend = smoothstep(Math.min(1, p * 1.6));
    this.bendSection(this.rig.bow, 0.38 * bend);
    this.bendSection(this.rig.stern, -0.3 * bend);
    this.submergeLevel = Math.min(1.4, p * p * 1.4);
    this.hullRoll += (0.22 * bend - this.hullRoll) * Math.min(1, dt * 2);
    const hull = this.rig.hullRig;
    hull.position.set(0, -this.submergeLevel * this.rig.diveDepth, 0);
    this.tmpEuler.set(0, 0, this.hullRoll, 'YXZ');
    hull.quaternion.setFromEuler(this.tmpEuler);
    this.mesh.updateMatrixWorld(true);

    const materials = this.rig.materials;
    const flicker = Math.max(0, 1 - p) * (0.5 + 0.5 * Math.sin(this.time * 33));
    materials.glowStrip.emissiveIntensity = 2.5 * flicker;
    materials.bridge.emissiveIntensity = 1.5 * flicker;
    materials.propulsor.emissiveIntensity = 1.8 * (1 - p);

    this.deathBurstTimer -= dt;
    if (this.deathBurstTimer <= 0) {
      this.deathBurstTimer = 0.28;
      this.tmpA.copy(this.breakPoint).applyMatrix4(this.rig.hullRig.matrixWorld);
      this.tmpA.x += (Math.random() - 0.5) * 12 * sf;
      this.tmpA.z += (Math.random() - 0.5) * 12 * sf;
      this.fx.emit('createExplosion', this.tmpA, 1.5 + p, 'enemy');
      this.tmpB.set(this.tmpA.x, this.seaY, this.tmpA.z);
      this.fx.emit('createWaterImpact', this.tmpB, 2);
      if (Math.random() < 0.5) {
        this.spouts.spawn(this.tmpB, {
          radius: (10 + Math.random() * 8) * sf,
          height: (60 + Math.random() * 60) * sf,
          warnTime: 0.15,
          eruptTime: 1.4,
          damage: 0,
          profile: 'boss-armor',
        });
      }
    }
    if (p >= 1) this.finishDeath();
  }

  /** 绕断点旋转某一段艇体（断点保持不动） */
  private bendSection(section: THREE.Group, angle: number): void {
    this.tmpQuat.setFromAxisAngle(this.tmpC.set(1, 0, 0), angle);
    section.quaternion.copy(this.tmpQuat);
    this.tmpD.copy(this.breakPoint).applyQuaternion(this.tmpQuat);
    section.position.copy(this.breakPoint).sub(this.tmpD);
  }

  private finishDeath(): void {
    this.dying = false;
    this.mesh.updateMatrixWorld(true);
    this.rig.deck.getWorldPosition(this.tmpA);
    if (!isFiniteVector(this.tmpA)) this.tmpA.copy(this.mesh.position);
    if (this.tmpA.y < this.seaY + 4) this.tmpA.y = this.seaY + 4;
    const position = this.tmpA.clone();
    this.onDestroy?.(position, this.config);
    // 蒸汽爆发：在控制器清理粒子之后追加
    const sf = this.sizeFactor;
    this.tmpB.set(position.x, this.seaY, position.z);
    this.fx.emit('createShockwave', this.tmpB, 190 * sf, 1.6, 0xe8fbff, 0.9);
    this.fx.emit('createShockwave', this.tmpB, 110 * sf, 1.0, 0xffb070, 0.8);
    for (let i = -1; i <= 1; i++) {
      this.tmpC.set(
        this.tmpB.x + Math.sin(this.yaw) * i * 60 * sf,
        this.seaY,
        this.tmpB.z + Math.cos(this.yaw) * i * 60 * sf
      );
      this.fx.emit('createWaterImpact', this.tmpC, 2);
    }
    this.fx.emit('createExplosion', position, 2.2, 'enemy');
    this.emitCue('hull-break', this.tmpB, 1);
  }

  // ===========================================================================================
  // 视觉
  // ===========================================================================================

  private updateHazards(dt: number): void {
    this.rings.update(dt);
    this.spouts.update(dt);
    this.shells.update(dt);
    this.triggerPositions.length = 0;
    if (this.hasPlayer) this.triggerPositions.push(this.playerPos);
    for (const friendly of this.friendlyMeshes) {
      if (friendly.parent) this.triggerPositions.push(friendly.position);
    }
    this.mines.update(dt, this.triggerPositions);
    this.shards.update(dt, this.seaY);
  }

  private updateVisuals(dt: number): void {
    const t = this.time;
    const materials = this.rig.materials;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.sonarFlash = Math.max(0, this.sonarFlash - dt * 2.5);

    // 告警色：阶段 3 / 冲撞时生物光带转红
    const alarmTarget = this.phase >= 3 || this.ramState !== 'idle' ? 1 : 0;
    this.alarm += (alarmTarget - this.alarm) * Math.min(1, dt * 2);
    materials.glowStrip.emissive.copy(STRIP_CALM).lerp(STRIP_ALARM, this.alarm);
    const stripPulse = this.phase >= 2 ? 0.5 * Math.sin(t * 4.5) : 0.25 * Math.sin(t * 2);
    materials.glowStrip.emissiveIntensity = 1.5 + stripPulse + this.hitFlash * 1.5;
    materials.hull.emissiveIntensity = 0.55 + this.hitFlash * 0.8;
    materials.sonar.emissiveIntensity = 0.9 + this.sonarFlash * 4;
    materials.propulsor.emissiveIntensity = 1.2 + Math.min(1.5, Math.abs(this.speed) / 12);
    const blink = Math.pow(Math.max(0, Math.sin(t * (this.phase >= 2 ? 6 : 3.2))), 4);
    materials.danger.emissiveIntensity = 0.6 + blink * 3;
    for (const glow of this.rig.dangerGlows) glow.material.opacity = 0.2 + blink * 0.75;
    if (this.isSailAlive()) {
      this.rig.sonarArray.rotation.y += dt * (1.4 + this.sonarFlash * 2);
      materials.bridge.emissiveIntensity = 1.7 + 0.3 * Math.sin(t * 1.3);
    }
    this.rig.propulsorRotor.rotation.z += dt * (1 + Math.abs(this.speed) * 0.35);

    for (const structure of this.structures) {
      const tank = structure.tank;
      if (!tank) continue;
      if (structure.alive) {
        tank.valveMaterial.emissiveIntensity = 1 + 0.5 * Math.sin(t * 3 + tank.index);
        tank.glow.material.opacity = 0.45 + 0.25 * Math.sin(t * 3 + tank.index);
      } else {
        tank.valveMaterial.emissiveIntensity = 1.8 + 1.2 * Math.abs(Math.sin(t * 9 + tank.index));
        tank.glow.material.opacity = 0.6;
      }
    }

    // 尾流：艏部投影到水面
    this.rig.bowTip.getWorldPosition(this.tmpA);
    this.tmpA.y = this.seaY;
    const wakeIntensity =
      THREE.MathUtils.clamp(Math.abs(this.speed) / (this.config.speed * 1.6 + 1e-3), 0, 1) *
      (this.submergeLevel > 0.9 ? 0.75 : 1);
    this.wake.update(this.tmpA, this.yaw, wakeIntensity);

    // 阶段 3 / 导弹舱被毁：甲板起火冒烟
    if (this.phase >= 3 || !this.isBayAlive()) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 0.45 + Math.random() * 0.3;
        const hatch = this.hatches[Math.floor(Math.random() * this.hatches.length)];
        if (hatch) {
          hatch.rig.launchPoint.getWorldPosition(this.tmpB);
          this.fx.emit('createExplosion', this.tmpB, 0.75, 'enemy');
        }
      }
    }
  }

  private emitCue(cue: AbyssalLeviathanCue, position: THREE.Vector3, intensity: number): void {
    if (!this.onEffectCue) return;
    this.cuePosition.copy(position);
    this.onEffectCue(cue, this.cuePosition, intensity);
  }
}
