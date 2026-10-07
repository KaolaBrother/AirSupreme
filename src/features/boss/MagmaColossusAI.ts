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
  LAVA_COLUMN_PALETTE,
  MAGMA_SHELL_PALETTE,
  createHazardProbe,
  disposeObjectTree,
  isFiniteVector,
  resetHazardProbe,
  resolveMissileParticles,
  type ArcShellSpec,
} from './MagmaColossusHazards';
import { MagmaColossusBeam, MagmaColossusStompMarker } from './MagmaColossusBeam';
import {
  createMagmaColossusMesh,
  getColossusLegPole,
  solveColossusLeg,
  type ColossusLegRig,
  type ColossusVentRig,
  type MagmaColossusGroup,
  type MagmaColossusRig,
} from './MagmaColossusMesh';

export { createMagmaColossusMesh } from './MagmaColossusMesh';

/**
 * 第六关 Boss「熔岩巨像」MAGMA COLOSSUS —— 踏着熔岩河前进的四足攻城机甲。
 *
 * 机制：
 * - 步行：四足 IK 步态在地面追踪 / 侧翼包抄玩家（setGroundSampler 提供地表高度，缺省回退到出生高度）。
 * - 热能炮：头部双管经 onFire 发射（控制器接 BossProjectilePool）。
 * - 迫击炮齐射：双肩 6 管抛射，落点准星（空中收拢圈 + 近地地面圈）预警，落点空爆判定。
 * - 熔岩导弹：自带 BossMissileSystem 垂直发射。
 * - 每次齐射后散热口开启发光（弱点 ×2.6），被打爆会剥离装甲（护甲倍率上升）。
 * - 践踏：抬腿蓄力 + 地面红圈 → 扩散冲击环（低空目标受伤）。
 * - 阶段 2（血量 ≤ 66% 或散热口全毁）：熔炉闸门打开（核心弱点 ×2.2）、步速提升、
 *   熔岩柱（地面预警后喷发）与胸口熔岩光束横扫（扇形预警）。
 * - 阶段 3（≤ 33%）：熔毁暴走，裂缝更亮、散热口常开、熔岩柱连成一排、更快的节奏；
 *   血量 < 25% 时腿部关节过载，周期性踉跄。
 * - 死亡：默认在血量归零时同步触发 onDestroy 并追加熔岩爆发；
 *   setDeathSequenceEnabled(true) 后先播放约 3.6 秒的坍塌，再触发 onDestroy。
 */

export type MagmaColossusCue =
  | 'footfall'
  | 'stomp'
  | 'mortar-launch'
  | 'mortar-impact'
  | 'missile-launch'
  | 'geyser'
  | 'beam-charge'
  | 'beam-fire'
  | 'vent-open'
  | 'vent-destroyed'
  | 'phase'
  | 'stumble'
  | 'collapse';

type PartRole = 'armor' | 'visor' | 'core' | 'vent';
type BodyAction = 'walk' | 'stomp' | 'beam' | 'stumble' | 'roar';

interface LegState {
  rig: ColossusLegRig;
  /** 世界坐标落足点 */
  planted: THREE.Vector3;
  /** 本帧足端世界坐标 */
  current: THREE.Vector3;
  stepFrom: THREE.Vector3;
  stepTo: THREE.Vector3;
  stepping: boolean;
  stepT: number;
  stepDuration: number;
  lift: number;
}

interface VentState {
  rig: ColossusVentRig;
  hp: number;
  max: number;
  alive: boolean;
  open: number;
  sparkTimer: number;
  subTarget: BossSubTarget;
}

interface ColossusPhaseTuning {
  speedFactor: number;
  turnFactor: number;
  stepDuration: number;
  stepLift: number;
  maxConcurrentSteps: number;
  cannonFactor: number;
  mortarInterval: number;
  mortarFlight: number;
  missileFactor: number;
  missileCount: number;
  stompInterval: number;
  stompWindup: number;
  geyserInterval: number;
  geyserWarn: number;
  geyserCount: number;
  geyserLine: boolean;
  beamInterval: number;
  beamCharge: number;
  beamFire: number;
  minionInterval: number;
  heatDump: number;
}

const PHASE_TUNING: readonly ColossusPhaseTuning[] = [
  {
    speedFactor: 1,
    turnFactor: 1,
    stepDuration: 0.95,
    stepLift: 2.7,
    maxConcurrentSteps: 1,
    cannonFactor: 1,
    mortarInterval: 9.5,
    mortarFlight: 2.6,
    missileFactor: 1,
    missileCount: 2,
    stompInterval: 10,
    stompWindup: 1.25,
    geyserInterval: 0,
    geyserWarn: 1.8,
    geyserCount: 0,
    geyserLine: false,
    beamInterval: 0,
    beamCharge: 1.6,
    beamFire: 2.5,
    minionInterval: 0,
    heatDump: 5.5,
  },
  {
    speedFactor: 1.35,
    turnFactor: 1.3,
    stepDuration: 0.78,
    stepLift: 2.5,
    maxConcurrentSteps: 2,
    cannonFactor: 0.85,
    mortarInterval: 8,
    mortarFlight: 2.35,
    missileFactor: 0.85,
    missileCount: 3,
    stompInterval: 8.5,
    stompWindup: 1.05,
    geyserInterval: 6.5,
    geyserWarn: 1.7,
    geyserCount: 2,
    geyserLine: false,
    beamInterval: 15,
    beamCharge: 1.6,
    beamFire: 2.5,
    minionInterval: 40,
    heatDump: 5,
  },
  {
    speedFactor: 1.7,
    turnFactor: 1.6,
    stepDuration: 0.62,
    stepLift: 2.2,
    maxConcurrentSteps: 2,
    cannonFactor: 0.7,
    mortarInterval: 6.5,
    mortarFlight: 2.1,
    missileFactor: 0.7,
    missileCount: 4,
    stompInterval: 7,
    stompWindup: 0.9,
    geyserInterval: 4.4,
    geyserWarn: 1.4,
    geyserCount: 4,
    geyserLine: true,
    beamInterval: 11.5,
    beamCharge: 1.3,
    beamFire: 2.2,
    minionInterval: 32,
    heatDump: 4.5,
  },
];

const PHASE_COUNT = 3;
const PHASE2_RATIO = 0.66;
const PHASE3_RATIO = 0.33;
const LOW_HEALTH_RATIO = 0.25;
const VENT_HEALTH_RATIO = 0.06;
const LEASH_RADIUS = 460;
const PREFERRED_RANGE = 230;
const DEATH_SEQUENCE_DURATION = 3.6;
const MAX_STEP_DT = 0.1;
const CANNON_RANGE = 480;
const STOMP_RECOVER = 0.55;
const STOMP_SLAM = 0.16;
const MORTAR_CHARGE = 0.85;
const MISSILE_CHARGE = 0.9;
const ROAR_DURATION = 1.6;
const STUMBLE_DURATION = 1.7;
const LEG_ORDER: readonly number[] = [0, 3, 1, 2]; // FL → BR → FR → BL（对角交替）

const UP = new THREE.Vector3(0, 1, 0);

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

export class MagmaColossusAI implements IAdvancedBoss {
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onPhaseChange?: (phase: number, label: string) => void;
  public onSpawnMinion?: (position: THREE.Vector3, kind: BossMinionKind) => void;
  public onHazardWarning?: (label: string) => void;
  /** 扩展钩子：音效 / 镜头震动提示（position 为复用向量，需要保存请 clone） */
  public onEffectCue?: (cue: MagmaColossusCue, position: THREE.Vector3, intensity: number) => void;

  private readonly mesh: THREE.Group;
  private readonly config: BossConfig;
  private readonly fx: HazardFx;
  private readonly health: HealthSystem;
  private readonly missileSystem: BossMissileSystem;
  private readonly rig: MagmaColossusRig;
  private readonly hazardRoot: THREE.Group;
  private readonly rings: HazardRingPool;
  private readonly geysers: HazardColumnPool;
  private readonly shells: ArcShellPool;
  private readonly beam: MagmaColossusBeam;
  private readonly stompMarker: MagmaColossusStompMarker;
  private readonly legs: LegState[] = [];
  private readonly vents: VentState[] = [];
  private readonly subTargets: BossSubTarget[] = [];
  private readonly partRoles = new Map<THREE.Object3D, PartRole>();
  private readonly ventByPart = new Map<THREE.Object3D, VentState>();
  private collisionParts: THREE.Object3D[] = [];
  private readonly probe = createHazardProbe();
  private groundSampler: ((x: number, z: number) => number) | null = null;
  private readonly fallbackGroundY: number;
  private readonly anchor = new THREE.Vector3();
  /** 难度节奏：config.cannonFireInterval 相对基准的倍率（< 1 更快） */
  private readonly cadence: number;
  /** 尺寸系数：config.scale / 5 */
  private readonly sizeFactor: number;

  private phase = 1;
  private disposed = false;
  private dying = false;
  private deathHandled = false;
  private deathSequenceEnabled = false;
  private deathTimer = 0;
  private deathBurstTimer = 0;
  private beamSparkTimer = 0;
  private dripTimer = 0;
  private yaw = 0;
  private speed = 0;
  private snappedToPlayer = false;
  private needsGroundSnap = true;
  private flankSign: 1 | -1 = 1;
  private flankTimer = 14;
  private time = 0;
  private stunTimer = 0;

  private action: BodyAction = 'walk';
  private actionTimer = 0;
  private pendingRoar = false;
  private stompLeg: LegState | null = null;
  private stompImpactDone = false;
  private stompWindup = 1;
  private readonly stompFrom = new THREE.Vector3();
  private readonly stompApex = new THREE.Vector3();
  private readonly stompTo = new THREE.Vector3();
  private stumbleSide = 1;
  private stumbleAmount = 0;
  private collapseAmount = 0;
  private gaitCursor = 0;

  private cannonTimer = 0.9;
  private cannonIndex = 0;
  private cannonFlash = 0;
  private mortarTimer = 4.5;
  private mortarCharge = 0;
  private mortarQueue = 0;
  private mortarStagger = 0;
  private missileTimer = 8;
  private missileCharge = 0;
  private missileQueue = 0;
  private missileStagger = 0;
  private missileFired = 0;
  private stompTimer = 7;
  private geyserTimer = 3;
  private geyserWaves = 0;
  private beamTimer = 7;
  private minionTimer = 8;
  private stumbleTimer = 3;
  private heatDumpTimer = 0;
  private ventOpenCueArmed = true;
  private lastImpactCue = -1;
  private lastGeyserCue = -1;
  private bodyBob = 0;
  private bodyBobVelocity = 0;
  private hitFlash = 0;
  private lowHealthReached = false;
  private shutterOpen = 0;
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
  private readonly tmpHip = new THREE.Vector3();
  private readonly tmpAnchor = new THREE.Vector3();
  private readonly tmpFoot = new THREE.Vector3();
  private readonly tmpPole = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly cuePosition = new THREE.Vector3();
  private readonly shellSpec: ArcShellSpec = {
    flightTime: 2.5,
    apexHeight: 80,
    burstRadius: 21,
    damage: 0,
    profile: 'flak-hit',
    payload: 0,
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
    this.sizeFactor = this.rig.scale / 5;
    const base = BOSS_CONFIGS[BossType.MAGMA_COLOSSUS];
    this.cadence = THREE.MathUtils.clamp(
      safeRatio(config.cannonFireInterval, base.cannonFireInterval),
      0.5,
      2
    );

    if (!isFiniteVector(mesh.position)) mesh.position.set(0, 0, 0);
    this.fallbackGroundY = mesh.position.y;
    this.anchor.copy(mesh.position);
    this.tmpEuler.setFromQuaternion(mesh.quaternion, 'YXZ');
    this.yaw = Number.isFinite(this.tmpEuler.y) ? this.tmpEuler.y : 0;

    this.hazardRoot = new THREE.Group();
    this.hazardRoot.name = 'colossus_hazards';
    scene.add(this.hazardRoot);
    this.rings = new HazardRingPool(this.hazardRoot, 6, 'colossus_shock_ring');
    this.geysers = new HazardColumnPool(
      this.hazardRoot,
      10,
      'colossus_geyser',
      LAVA_COLUMN_PALETTE
    );
    this.geysers.onErupt = (basePos, radius) => this.handleGeyserErupt(basePos, radius);
    this.shells = new ArcShellPool(
      this.hazardRoot,
      18,
      'colossus_mortar',
      3.2 * this.sizeFactor,
      MAGMA_SHELL_PALETTE
    );
    this.shells.onArrive = (position, _payload, spec) => this.handleShellArrive(position, spec);
    this.beam = new MagmaColossusBeam(this.hazardRoot, 0.62);
    this.stompMarker = new MagmaColossusStompMarker(this.hazardRoot);

    for (const legRig of this.rig.legs) {
      this.legs.push({
        rig: legRig,
        planted: new THREE.Vector3(),
        current: new THREE.Vector3(),
        stepFrom: new THREE.Vector3(),
        stepTo: new THREE.Vector3(),
        stepping: false,
        stepT: 0,
        stepDuration: 1,
        lift: 0,
      });
    }

    const ventMax = Math.max(1, Math.round(maxHealth * VENT_HEALTH_RATIO));
    for (const ventRig of this.rig.vents) {
      const subTarget: BossSubTarget = { mesh: ventRig.core, current: ventMax, max: ventMax };
      const state: VentState = {
        rig: ventRig,
        hp: ventMax,
        max: ventMax,
        alive: true,
        open: 0,
        sparkTimer: 0,
        subTarget,
      };
      this.vents.push(state);
      this.subTargets.push(subTarget);
      this.ventByPart.set(ventRig.core, state);
      this.partRoles.set(ventRig.core, 'vent');
    }
    this.partRoles.set(this.rig.visor, 'visor');
    this.partRoles.set(this.rig.coreMesh, 'core');
    this.rebuildCollisionParts();

    this.missileTimer = Math.max(4, config.missileFireInterval * 0.55);
    this.applyRootTransform();
    this.initFeet();
    this.poseLegs();
    this.mesh.updateMatrixWorld(true);
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

    if (this.needsGroundSnap) this.snapToGround();
    this.updateLocomotion(dt);
    this.updateLegs(dt);
    this.updateBodyPose(dt);
    this.poseLegs();
    this.mesh.updateMatrixWorld(true);
    this.updateAttacks(dt);
    if (this.disposed) return;
    this.updateHazards(dt);
    this.missileSystem.update(dt);
    this.updateVisuals(dt);
  }

  public takeDamage(amount: number): void {
    if (this.disposed || !this.isAlive() || this.isInvulnerable()) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.hitFlash = Math.min(1, this.hitFlash + 0.35);
    this.health.takeDamage(amount);
    if (!this.disposed && this.isAlive()) this.evaluatePhase();
  }

  public takeDamageAt(part: THREE.Object3D, amount: number): void {
    if (this.disposed || !this.isAlive() || this.isInvulnerable()) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    const multiplier = this.getDamageMultiplier(part);
    const dealt = amount * multiplier;
    if (!(dealt > 0)) return;

    const vent = this.ventByPart.get(part);
    if (vent && vent.alive) {
      vent.hp = Math.max(0, vent.hp - dealt);
      vent.subTarget.current = vent.hp;
      if (vent.hp <= 0) this.destroyVent(vent);
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
    return this.dying || this.deathHandled;
  }

  public getDamageMultiplier(part: THREE.Object3D): number {
    if (this.isInvulnerable()) return 0;
    const role = this.partRoles.get(part) ?? 'armor';
    switch (role) {
      case 'visor':
        return 1.4;
      case 'core':
        if (this.phase >= 3) return 2.4;
        return this.phase >= 2 || this.shutterOpen > 0.6 ? 2.2 : 0.35;
      case 'vent': {
        const vent = this.ventByPart.get(part);
        if (!vent || !vent.alive) return this.getArmorMultiplier();
        return vent.open >= 0.5 ? 2.6 : 0.6;
      }
      default:
        return this.getArmorMultiplier();
    }
  }

  public checkHazard(targetPosition: THREE.Vector3, targetRadius: number): BossHazardHit | null {
    if (this.disposed || !targetPosition || !isFiniteVector(targetPosition)) return null;
    if (this.deathHandled) return null;
    const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 0;
    resetHazardProbe(this.probe);
    this.rings.probe(targetPosition, radius, this.probe);
    this.geysers.probe(targetPosition, radius, this.probe);
    this.shells.probe(targetPosition, radius, this.probe);
    this.beam.probe(targetPosition, radius, this.probe);
    if (this.probe.damage <= 0) return null;
    return {
      damage: this.probe.damage,
      profile: this.probe.profile,
      position: this.probe.position.clone(),
    };
  }

  public getStatusLabel(): string | null {
    const aliveVents = this.getAliveVentCount();
    const ventsOpen = this.areVentsExposed() ? 1 : 0;
    const key =
      (this.dying || this.deathHandled ? 100000 : 0) +
      (this.stunTimer > 0 ? 10000 : 0) +
      (this.action === 'stumble' || this.lowHealthReached ? 1000 : 0) +
      this.phase * 100 +
      aliveVents * 10 +
      ventsOpen;
    if (key === this.statusKey) return this.statusLabel;
    this.statusKey = key;
    if (this.dying || this.deathHandled) {
      this.statusLabel = '结构崩塌';
    } else if (this.stunTimer > 0) {
      this.statusLabel = '电磁瘫痪 · 散热口强制开启';
    } else if (this.phase >= 3) {
      this.statusLabel = this.lowHealthReached ? '熔毁暴走 · 关节过载' : '熔毁暴走 · 全身弱化';
    } else if (this.phase === 2) {
      this.statusLabel = `熔核暴露 · 散热口 ${aliveVents}/${this.vents.length}`;
    } else if (ventsOpen) {
      this.statusLabel = `散热口过热开启 · ${aliveVents}/${this.vents.length}`;
    } else {
      this.statusLabel = `玄武岩装甲 · 散热口 ${aliveVents}/${this.vents.length}`;
    }
    return this.statusLabel;
  }

  public getSubTargets(): BossSubTarget[] {
    return this.subTargets;
  }

  public applyStun(seconds: number): void {
    if (!this.isAlive() || this.disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    this.stunTimer = Math.max(this.stunTimer, Math.min(3, seconds));
    if (this.action === 'beam') {
      this.beam.clear();
      this.action = 'walk';
      this.beamTimer = 4;
    }
    this.rig.body.getWorldPosition(this.tmpA);
    this.fx.emit('createHit', this.tmpA, 2, 'boss');
  }

  /** 扩展：地面高度采样（地形批次提供）；未设置时回退到出生高度 */
  public setGroundSampler(sampler: (x: number, z: number) => number): void {
    this.groundSampler = typeof sampler === 'function' ? sampler : null;
    this.needsGroundSnap = true;
  }

  /**
   * 扩展：开启后血量归零先播放约 3.6 秒坍塌（期间 isAlive() 为 false、无敌、无碰撞部件），
   * 结束时才触发 onDestroy。默认关闭（契约：归零时同步触发）。
   */
  public setDeathSequenceEnabled(enabled: boolean): void {
    this.deathSequenceEnabled = enabled;
  }

  /** 扩展：是否正在播放坍塌死亡演出 */
  public isDying(): boolean {
    return this.dying;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dying = false;
    this.missileSystem.dispose();
    this.rings.dispose();
    this.geysers.dispose();
    this.shells.dispose();
    this.beam.dispose();
    this.stompMarker.dispose();
    this.hazardRoot.parent?.remove(this.hazardRoot);
    this.mesh.visible = false;
    this.mesh.parent?.remove(this.mesh);
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      disposeObjectTree(child);
    }
    this.collisionParts = [];
    this.partRoles.clear();
    this.ventByPart.clear();
  }

  // ===========================================================================================
  // 构造辅助
  // ===========================================================================================

  private ensureRig(mesh: THREE.Group, config: BossConfig): MagmaColossusRig {
    const existing = (mesh as MagmaColossusGroup).colossusRig;
    if (existing) return existing;
    // 宿主传入的不是工厂网格：现场构建并把部件移入宿主 Group
    const built = createMagmaColossusMesh(config) as MagmaColossusGroup & {
      bossParts?: THREE.Mesh[];
    };
    while (built.children.length > 0) mesh.add(built.children[0]);
    const rig = built.colossusRig;
    if (!rig) throw new Error('MagmaColossusAI: mesh factory produced no rig');
    (mesh as MagmaColossusGroup & { bossParts?: THREE.Mesh[] }).bossParts = built.bossParts;
    (mesh as MagmaColossusGroup).colossusRig = rig;
    if (!mesh.name) mesh.name = built.name;
    return rig;
  }

  private rebuildCollisionParts(): void {
    if (this.deathHandled) {
      this.collisionParts = [];
      return;
    }
    const parts: THREE.Object3D[] = [this.rig.visor, this.rig.coreMesh];
    for (const vent of this.vents) if (vent.alive) parts.push(vent.rig.core);
    parts.push(this.rig.headShell, ...this.rig.mortarHousings);
    parts.push(this.rig.carapace[0], this.rig.carapace[2], this.rig.hull);
    for (const leg of this.rig.legs) parts.push(leg.thighCore, leg.shinCore);
    this.collisionParts = parts.filter((part) => part !== undefined);
  }

  // ===========================================================================================
  // 移动与步态
  // ===========================================================================================

  private sampleGround(x: number, z: number): number {
    if (this.groundSampler) {
      const y = this.groundSampler(x, z);
      if (Number.isFinite(y)) return y;
    }
    return this.fallbackGroundY;
  }

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

  private tuning(): ColossusPhaseTuning {
    return PHASE_TUNING[Math.min(PHASE_TUNING.length, Math.max(1, this.phase)) - 1];
  }

  private snapToGround(): void {
    this.needsGroundSnap = false;
    this.mesh.position.y = this.sampleGround(this.mesh.position.x, this.mesh.position.z);
    this.applyRootTransform();
    this.initFeet();
  }

  private applyRootTransform(): void {
    this.mesh.quaternion.setFromAxisAngle(UP, this.yaw);
  }

  private rootToWorld(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const x = c * local.x + s * local.z;
    const z = -s * local.x + c * local.z;
    return out.set(
      x + this.mesh.position.x,
      local.y + this.mesh.position.y,
      z + this.mesh.position.z
    );
  }

  private worldToRoot(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const dx = world.x - this.mesh.position.x;
    const dz = world.z - this.mesh.position.z;
    return out.set(c * dx - s * dz, world.y - this.mesh.position.y, s * dx + c * dz);
  }

  private initFeet(): void {
    for (const leg of this.legs) {
      this.rootToWorld(leg.rig.homeOffset, leg.planted);
      leg.planted.y = this.sampleGround(leg.planted.x, leg.planted.z);
      leg.current.copy(leg.planted);
      leg.stepping = false;
      leg.stepT = 0;
    }
  }

  private updateLocomotion(dt: number): void {
    const tuning = this.tuning();
    const root = this.mesh.position;

    if (this.hasPlayer && !this.snappedToPlayer) {
      // 首次看见玩家：直接转身面向（出生点在玩家正前方）
      this.snappedToPlayer = true;
      this.yaw = Math.atan2(this.playerPos.x - root.x, this.playerPos.z - root.z);
      this.applyRootTransform();
      this.initFeet();
    }

    const canWalk = this.action === 'walk' && this.stunTimer <= 0;
    let desiredYaw = this.yaw;
    let targetSpeed = 0;
    if (this.hasPlayer) {
      this.flankTimer -= dt;
      if (this.flankTimer <= 0) {
        this.flankSign = this.flankSign > 0 ? -1 : 1;
        this.flankTimer = 15 + Math.random() * 8;
      }
      const bearing =
        Math.atan2(root.x - this.playerPos.x, root.z - this.playerPos.z) + this.flankSign * 0.45;
      const range = PREFERRED_RANGE * this.sizeFactor;
      this.tmpA.set(
        this.playerPos.x + Math.sin(bearing) * range,
        0,
        this.playerPos.z + Math.cos(bearing) * range
      );
      // 栓绳：不离开出生点太远（留在火山岛上）
      this.tmpB.set(this.tmpA.x - this.anchor.x, 0, this.tmpA.z - this.anchor.z);
      const leash = LEASH_RADIUS * this.sizeFactor;
      if (this.tmpB.lengthSq() > leash * leash) {
        this.tmpB.setLength(leash);
        this.tmpA.set(this.anchor.x + this.tmpB.x, 0, this.anchor.z + this.tmpB.z);
      }
      const toX = this.tmpA.x - root.x;
      const toZ = this.tmpA.z - root.z;
      const distance = Math.sqrt(toX * toX + toZ * toZ);
      const yawToPlayer = Math.atan2(this.playerPos.x - root.x, this.playerPos.z - root.z);
      if (distance > 30 * this.sizeFactor) {
        desiredYaw = Math.atan2(toX, toZ);
        // 走到附近时逐渐把正面转向玩家（头部与热能炮朝向玩家）
        const blend = THREE.MathUtils.clamp(1 - (distance - 30) / 140, 0, 0.7);
        desiredYaw =
          this.yaw +
          wrapAngle(desiredYaw - this.yaw) * (1 - blend) +
          wrapAngle(yawToPlayer - this.yaw) * blend;
        targetSpeed = this.config.speed * tuning.speedFactor;
      } else {
        desiredYaw = yawToPlayer;
      }
    }

    let maxTurn = Math.max(0.05, this.config.turnSpeed) * tuning.turnFactor * dt;
    if (this.action !== 'walk' && this.action !== 'roar') maxTurn = 0;
    if (this.stunTimer > 0) maxTurn = 0;
    const diff = wrapAngle(desiredYaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + THREE.MathUtils.clamp(diff, -maxTurn, maxTurn));
    if (!canWalk) targetSpeed = 0;
    if (Math.abs(diff) > 0.7) targetSpeed *= 0.35;
    if (!Number.isFinite(targetSpeed)) targetSpeed = 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.5);

    root.x += Math.sin(this.yaw) * this.speed * dt;
    root.z += Math.cos(this.yaw) * this.speed * dt;
    const ground = this.sampleGround(root.x, root.z);
    root.y += (ground - root.y) * Math.min(1, dt * 4);
    if (!isFiniteVector(root)) {
      root.copy(this.anchor);
      this.speed = 0;
    }
    this.applyRootTransform();
  }

  private computeHome(leg: LegState, out: THREE.Vector3): THREE.Vector3 {
    this.rootToWorld(leg.rig.homeOffset, out);
    const lead = this.speed * (leg.stepDuration * 0.9 + 0.35);
    out.x += Math.sin(this.yaw) * lead;
    out.z += Math.cos(this.yaw) * lead;
    out.y = this.sampleGround(out.x, out.z);
    return out;
  }

  private updateLegs(dt: number): void {
    const tuning = this.tuning();
    let stepping = 0;
    for (const leg of this.legs) {
      if (leg === this.stompLeg) continue;
      if (!leg.stepping) continue;
      leg.stepT += dt / leg.stepDuration;
      const t = Math.min(1, leg.stepT);
      const eased = t * t * (3 - 2 * t);
      leg.current.lerpVectors(leg.stepFrom, leg.stepTo, eased);
      leg.current.y += leg.lift * Math.sin(Math.PI * t);
      if (t >= 1) {
        leg.stepping = false;
        leg.planted.copy(leg.stepTo);
        leg.current.copy(leg.stepTo);
        this.handleFootfall(leg);
      } else {
        stepping++;
      }
    }

    if (this.collapseAmount > 0) return;
    if (stepping >= tuning.maxConcurrentSteps) return;
    const threshold = 1.9 * this.rig.scale;
    for (let k = 0; k < LEG_ORDER.length; k++) {
      const index = LEG_ORDER[(this.gaitCursor + k) % LEG_ORDER.length];
      const leg = this.legs[index];
      if (!leg || leg.stepping || leg === this.stompLeg) continue;
      leg.stepDuration = tuning.stepDuration;
      this.computeHome(leg, this.tmpA);
      const dx = this.tmpA.x - leg.planted.x;
      const dz = this.tmpA.z - leg.planted.z;
      if (dx * dx + dz * dz < threshold * threshold) continue;
      leg.stepping = true;
      leg.stepT = 0;
      leg.lift = tuning.stepLift * this.rig.scale;
      leg.stepFrom.copy(leg.planted);
      leg.stepTo.copy(this.tmpA);
      this.gaitCursor = (this.gaitCursor + k + 1) % LEG_ORDER.length;
      break;
    }
  }

  private handleFootfall(leg: LegState): void {
    this.fx.emit('createGroundImpact', leg.current, 1.5, 'ground');
    this.bodyBobVelocity -= 5.5 * this.sizeFactor;
    this.emitCue('footfall', leg.current, 0.55);
  }

  private updateBodyPose(dt: number): void {
    const body = this.rig.body;
    const s = this.rig.scale;
    const root = this.mesh.position;
    let front = 0;
    let back = 0;
    let left = 0;
    let right = 0;
    let roll = 0;
    for (const leg of this.legs) {
      const h = leg.planted.y - root.y;
      if (leg.rig.front) front += h;
      else back += h;
      if (leg.rig.side > 0) left += h;
      else right += h;
      if (leg.stepping) roll += leg.rig.side * 0.022;
    }
    const average = (front + back) / 4;

    // 弹簧：落足时下沉，随后回弹
    const accel = -38 * this.bodyBob - 8.5 * this.bodyBobVelocity;
    this.bodyBobVelocity += accel * dt;
    this.bodyBob += this.bodyBobVelocity * dt;
    if (!Number.isFinite(this.bodyBob)) {
      this.bodyBob = 0;
      this.bodyBobVelocity = 0;
    }

    // 踉跄 / 坍塌 / 践踏蓄力 的姿态叠加
    const stumbleTarget = this.action === 'stumble' ? 1 : 0;
    this.stumbleAmount += (stumbleTarget - this.stumbleAmount) * Math.min(1, dt * 5);
    let rear = 0;
    if (this.action === 'stomp' && !this.stompImpactDone) {
      rear = Math.min(1, this.actionTimer / Math.max(0.1, this.stompWindup));
    }
    let roar = 0;
    if (this.action === 'roar') {
      roar = Math.sin(Math.min(1, this.actionTimer / ROAR_DURATION) * Math.PI);
    }

    const heightFactor =
      1 - 0.12 * this.stumbleAmount - 0.5 * this.collapseAmount + 0.05 * rear + 0.04 * roar;
    const breathing = Math.sin(this.time * 1.3) * 0.12 * s;
    body.position.set(
      0,
      average + this.rig.bodyHeight * heightFactor + this.bodyBob + breathing,
      0
    );

    const pitch =
      -Math.atan2(front / 2 - back / 2, 2 * this.rig.legs[0].homeOffset.z) * 0.8 -
      0.08 * rear -
      0.12 * roar +
      0.1 * this.stumbleAmount +
      0.26 * this.collapseAmount;
    const rollTarget =
      Math.atan2(left / 2 - right / 2, 2 * Math.abs(this.rig.legs[0].homeOffset.x)) +
      roll +
      -this.stumbleSide * 0.12 * this.stumbleAmount +
      0.14 * this.collapseAmount;
    this.tmpEuler.set(pitch, 0, rollTarget, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);
    body.quaternion.slerp(this.tmpQuat, Math.min(1, dt * 4));
  }

  private poseLegs(): void {
    const body = this.rig.body;
    body.updateMatrix();
    for (const leg of this.legs) {
      this.tmpHip.copy(leg.rig.hipOffset).applyMatrix4(body.matrix);
      this.tmpAnchor.copy(leg.rig.pistonAnchor).applyMatrix4(body.matrix);
      this.worldToRoot(leg.current, this.tmpFoot);
      leg.rig.foot.position.copy(this.tmpFoot);
      solveColossusLeg(
        leg.rig,
        this.tmpHip,
        this.tmpFoot,
        getColossusLegPole(leg.rig, this.tmpPole),
        this.tmpAnchor,
        this.tmpD
      );
    }
  }

  // ===========================================================================================
  // 攻击
  // ===========================================================================================

  private updateAttacks(dt: number): void {
    const tuning = this.tuning();
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    }
    this.heatDumpTimer = Math.max(0, this.heatDumpTimer - dt);
    const stunned = this.stunTimer > 0;

    this.updateBodyAction(dt, tuning, stunned);
    if (stunned || !this.hasPlayer) return;
    this.updateCannons(dt, tuning);
    this.updateMortars(dt, tuning);
    this.updateMissiles(dt, tuning);
    this.updateGeysers(dt, tuning);
    this.updateMinions(dt, tuning);
  }

  private updateCannons(dt: number, tuning: ColossusPhaseTuning): void {
    this.cannonFlash = Math.max(0, this.cannonFlash - dt * 6);
    this.cannonTimer -= dt;
    if (this.cannonTimer > 0) return;
    this.cannonTimer = Math.max(0.25, this.config.cannonFireInterval * tuning.cannonFactor);
    if (this.action === 'stumble' || this.action === 'roar') return;
    const muzzle = this.rig.cannonMuzzles[this.cannonIndex % this.rig.cannonMuzzles.length];
    if (!muzzle) return;
    muzzle.getWorldPosition(this.tmpA);
    const distance = this.tmpA.distanceTo(this.playerPos);
    if (distance > CANNON_RANGE || distance < 1) return;
    const lead = (distance / 100) * 0.7;
    this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, lead).sub(this.tmpA).normalize();
    // 头部前向锥形范围内才开火
    this.rig.head.getWorldQuaternion(this.tmpQuat);
    this.tmpC.set(0, 0, 1).applyQuaternion(this.tmpQuat);
    if (this.tmpC.dot(this.tmpB) < Math.cos(1.05) || !isFiniteVector(this.tmpB)) return;
    this.cannonIndex++;
    this.cannonFlash = 1;
    this.fx.emit('createHit', this.tmpA, 1.3, 'enemy');
    this.onFire?.(this.tmpA.clone(), this.tmpB.clone(), this.config.damage);
  }

  private updateMortars(dt: number, tuning: ColossusPhaseTuning): void {
    if (this.mortarCharge > 0) {
      this.mortarCharge -= dt;
      if (this.mortarCharge <= 0) {
        this.mortarQueue = this.rig.mortarMuzzles.length;
        this.mortarStagger = 0;
      }
      return;
    }
    if (this.mortarQueue > 0) {
      this.mortarStagger -= dt;
      if (this.mortarStagger > 0) return;
      const index = this.rig.mortarMuzzles.length - this.mortarQueue;
      this.launchMortarShell(index, tuning);
      this.mortarQueue--;
      this.mortarStagger = 0.11;
      if (this.mortarQueue === 0) this.startHeatDump(tuning);
      return;
    }
    this.mortarTimer -= dt;
    if (this.mortarTimer > 0) return;
    this.mortarTimer = tuning.mortarInterval * this.cadence;
    if (this.mesh.position.distanceTo(this.playerPos) > 1100 * this.sizeFactor) return;
    this.mortarCharge = MORTAR_CHARGE;
  }

  private launchMortarShell(index: number, tuning: ColossusPhaseTuning): void {
    const muzzle = this.rig.mortarMuzzles[index];
    if (!muzzle) return;
    muzzle.getWorldPosition(this.tmpA);
    const flight = tuning.mortarFlight + index * 0.05;
    this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, flight * 0.85);
    if (index > 0) {
      const angle = index * 2.4 + Math.random() * 0.8;
      const radius = (10 + Math.random() * 28) * this.sizeFactor;
      this.tmpB.x += Math.cos(angle) * radius;
      this.tmpB.z += Math.sin(angle) * radius;
    }
    const ground = this.sampleGround(this.tmpB.x, this.tmpB.z);
    this.tmpB.y = Math.max(this.tmpB.y, ground + 3);
    const spec = this.shellSpec;
    spec.flightTime = flight;
    spec.apexHeight = (70 + Math.random() * 50) * this.sizeFactor;
    spec.burstRadius = 21 * this.sizeFactor;
    spec.damage = this.config.damage * 1.2;
    spec.profile = 'flak-hit';
    spec.payload = 0;
    spec.groundY = ground;
    if (!this.shells.launch(this.tmpA, this.tmpB, spec)) return;
    this.fx.emit('createHit', this.tmpA, 1.8, 'enemy');
    if (index === 0) {
      this.fx.emit('createExplosion', this.tmpA, 0.9, 'enemy');
      this.emitCue('mortar-launch', this.tmpA, 0.8);
    }
  }

  private handleShellArrive(position: THREE.Vector3, spec: ArcShellSpec): void {
    this.fx.emit('createExplosion', position, 1.5, 'enemy');
    if (spec.groundY !== null && position.y - spec.groundY < 12) {
      this.fx.emit('createGroundImpact', position, 1.4, 'ground');
    }
    // 粒子系统的冲击波环是全局共享的小池子：同一轮齐射只画一圈，音效同样节流
    if (this.time - this.lastImpactCue > 0.3) {
      this.lastImpactCue = this.time;
      this.fx.emit('createShockwave', position, spec.burstRadius * 1.15, 0.45, 0xff8a3a, 0.75);
      this.emitCue('mortar-impact', position, 0.7);
    }
  }

  private updateMissiles(dt: number, tuning: ColossusPhaseTuning): void {
    if (this.missileCharge > 0) {
      this.missileCharge -= dt;
      if (this.missileCharge <= 0) {
        this.missileQueue = tuning.missileCount;
        this.missileStagger = 0;
        this.missileFired = 0;
      }
      return;
    }
    if (this.missileQueue > 0) {
      this.missileStagger -= dt;
      if (this.missileStagger > 0) return;
      this.launchMissile();
      this.missileQueue--;
      this.missileStagger = 0.32;
      if (this.missileQueue === 0) this.startHeatDump(tuning);
      return;
    }
    this.missileTimer -= dt;
    if (this.missileTimer > 0) return;
    this.missileTimer = Math.max(4, this.config.missileFireInterval * tuning.missileFactor);
    this.missileCharge = MISSILE_CHARGE;
  }

  private launchMissile(): void {
    const cell = this.rig.missileCells[this.missileFired % this.rig.missileCells.length];
    if (!cell) return;
    cell.getWorldPosition(this.tmpA);
    this.tmpA.y += 2.5 * this.rig.scale;
    let target: THREE.Object3D | null = null;
    if (this.missileFired === 1) {
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
    this.missileFired++;
    this.fx.emit('createExplosion', this.tmpA, 0.85, 'enemy');
    this.onMissileFired?.();
    this.emitCue('missile-launch', this.tmpA, 0.7);
  }

  private startHeatDump(tuning: ColossusPhaseTuning): void {
    this.heatDumpTimer = Math.max(this.heatDumpTimer, tuning.heatDump);
  }

  private updateBodyAction(dt: number, tuning: ColossusPhaseTuning, stunned: boolean): void {
    switch (this.action) {
      case 'stomp':
        this.updateStomp(dt);
        return;
      case 'beam':
        this.updateBeamAttack(dt);
        return;
      case 'stumble':
        this.actionTimer += dt;
        if (this.actionTimer >= STUMBLE_DURATION) this.finishAction();
        return;
      case 'roar':
        this.actionTimer += dt;
        if (this.actionTimer >= ROAR_DURATION) this.finishAction();
        return;
      default:
        break;
    }

    if (this.pendingRoar) {
      this.pendingRoar = false;
      this.startRoar();
      return;
    }
    if (stunned || !this.hasPlayer) return;

    this.stompTimer -= dt;
    if (tuning.beamInterval > 0) this.beamTimer -= dt;
    if (this.lowHealthReached) this.stumbleTimer -= dt;

    if (this.lowHealthReached && this.stumbleTimer <= 0) {
      this.startStumble();
      return;
    }
    if (tuning.beamInterval > 0 && this.beamTimer <= 0) {
      if (this.startBeam(tuning)) return;
      this.beamTimer = 2;
    }
    if (this.stompTimer <= 0) {
      if (this.startStomp(tuning)) return;
      this.stompTimer = 1.5;
    }
  }

  private finishAction(): void {
    this.action = 'walk';
    this.actionTimer = 0;
  }

  private startStomp(tuning: ColossusPhaseTuning): boolean {
    const root = this.mesh.position;
    const dx = this.playerPos.x - root.x;
    const dz = this.playerPos.z - root.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    const altitude = this.playerPos.y - this.sampleGround(this.playerPos.x, this.playerPos.z);
    if (horizontal > 330 * this.sizeFactor || altitude > 150 * this.sizeFactor) return false;

    this.worldToRoot(this.playerPos, this.tmpA);
    const leg = this.legs[this.tmpA.x >= 0 ? 0 : 1];
    if (!leg || leg.stepping) return false;

    this.action = 'stomp';
    this.actionTimer = 0;
    this.stompLeg = leg;
    this.stompImpactDone = false;
    this.stompWindup = tuning.stompWindup;
    this.stompFrom.copy(leg.planted);
    this.stompTo
      .set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
      .multiplyScalar(1.6 * this.rig.scale);
    this.stompTo.add(leg.planted);
    this.stompTo.y = this.sampleGround(this.stompTo.x, this.stompTo.z);
    this.stompApex.copy(this.stompFrom).lerp(this.stompTo, 0.3);
    this.stompApex.y += 8 * this.rig.scale;
    this.stompMarker.show(this.stompTo, this.getStompRadius());
    this.onHazardWarning?.('践踏冲击波');
    return true;
  }

  private getStompRadius(): number {
    return 175 * this.sizeFactor;
  }

  private updateStomp(dt: number): void {
    const leg = this.stompLeg;
    if (!leg) {
      this.finishAction();
      return;
    }
    this.actionTimer += dt;
    const t = this.actionTimer;
    const windup = this.stompWindup;
    if (t < windup) {
      const p = t / windup;
      const eased = 1 - (1 - p) * (1 - p);
      leg.current.copy(this.stompFrom).lerp(this.stompApex, eased);
      leg.rig.footGlowMaterial.emissiveIntensity = 0.3 + 4.5 * p;
      this.stompMarker.update(dt, p);
      return;
    }
    if (t < windup + STOMP_SLAM) {
      const p = (t - windup) / STOMP_SLAM;
      leg.current.copy(this.stompApex).lerp(this.stompTo, p * p);
      this.stompMarker.update(dt, 1);
      return;
    }
    if (!this.stompImpactDone) {
      this.stompImpactDone = true;
      leg.planted.copy(this.stompTo);
      leg.current.copy(this.stompTo);
      this.stompMarker.hide();
      this.triggerStompImpact(this.stompTo);
      return;
    }
    leg.rig.footGlowMaterial.emissiveIntensity = Math.max(
      0.22,
      leg.rig.footGlowMaterial.emissiveIntensity - dt * 6
    );
    if (t >= windup + STOMP_SLAM + STOMP_RECOVER) {
      this.stompLeg = null;
      this.stompTimer = this.tuning().stompInterval * this.cadence;
      this.finishAction();
    }
  }

  private triggerStompImpact(position: THREE.Vector3): void {
    const sf = this.sizeFactor;
    this.rings.spawn(position, {
      maxRadius: this.getStompRadius(),
      duration: 1.6,
      wallHeight: 32 * sf,
      bandWidth: 16 * sf,
      damage: this.config.damage * 1.15,
      profile: 'boss-armor',
      color: 0xff6a20,
      opacity: 0.85,
    });
    this.rings.spawn(position, {
      maxRadius: 115 * sf,
      duration: 1.1,
      wallHeight: 12 * sf,
      bandWidth: 6 * sf,
      damage: 0,
      profile: 'boss-armor',
      color: 0xffc27a,
      opacity: 0.5,
    });
    this.tmpA.copy(position);
    this.tmpA.y += 4 * sf;
    this.fx.emit('createGroundImpact', position, 1.8, 'ground');
    this.fx.emit('createExplosion', this.tmpA, 2.2, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', position, 2.6, 'boss-armor');
    this.fx.emit('createShockwave', position, 70 * sf, 0.8, 0xffa04a, 0.9);
    this.bodyBobVelocity -= 12 * sf;
    this.emitCue('stomp', position, 1);
  }

  private startBeam(tuning: ColossusPhaseTuning): boolean {
    const range = 650 * this.sizeFactor;
    this.getBeamOrigin(this.tmpA);
    this.tmpB.subVectors(this.playerPos, this.tmpA);
    const distance = this.tmpB.length();
    if (distance > range * 0.92 || distance < 40 * this.sizeFactor) return false;
    this.tmpB.divideScalar(distance);
    const started = this.beam.start(this.tmpA, this.tmpB, {
      chargeTime: tuning.beamCharge,
      fireTime: tuning.beamFire,
      range,
      radius: 8 * this.sizeFactor,
      damage: this.config.damage * 1.35,
      halfAngle: 0.62,
      direction: Math.random() < 0.5 ? 1 : -1,
    });
    if (!started) return false;
    this.action = 'beam';
    this.actionTimer = 0;
    this.onHazardWarning?.('熔岩光束充能');
    this.emitCue('beam-charge', this.tmpA, 0.8);
    return true;
  }

  private getBeamOrigin(out: THREE.Vector3): THREE.Vector3 {
    this.rig.coreMesh.getWorldPosition(out);
    out.x += Math.sin(this.yaw) * 1.6 * this.rig.scale;
    out.z += Math.cos(this.yaw) * 1.6 * this.rig.scale;
    return out;
  }

  private updateBeamAttack(dt: number): void {
    this.actionTimer += dt;
    this.getBeamOrigin(this.tmpA);
    this.beam.setOrigin(this.tmpA);
    if (this.beam.update(dt)) {
      this.fx.emit('createExplosion', this.tmpA, 1.4, 'enemy');
      this.emitCue('beam-fire', this.tmpA, 1);
    }
    if (this.beam.getState() === 'fire') {
      this.beamSparkTimer -= dt;
      if (this.beamSparkTimer <= 0) {
        this.beamSparkTimer = 0.12;
        this.fx.emit('createHit', this.tmpA, 1.8, 'enemy');
        const end = this.beam.getEnd();
        const ground = this.sampleGround(end.x, end.z);
        if (end.y <= ground + 6) {
          this.tmpB.set(end.x, ground, end.z);
          this.fx.emit('createGroundImpact', this.tmpB, 1.6, 'ground');
        }
      }
    }
    if (this.beam.getState() === 'idle') {
      this.beamTimer = this.tuning().beamInterval * this.cadence;
      this.finishAction();
    }
  }

  private startStumble(): void {
    this.action = 'stumble';
    this.actionTimer = 0;
    this.stumbleTimer = 8 + Math.random() * 3.5;
    this.stumbleSide = Math.random() < 0.5 ? 1 : -1;
    const leg = this.legs[this.stumbleSide > 0 ? 0 : 1];
    if (leg) {
      leg.rig.knee.getWorldPosition(this.tmpA);
      this.fx.emit('createHit', this.tmpA, 2.2, 'boss');
      this.fx.emit('createExplosion', this.tmpA, 1.1, 'enemy');
      this.emitCue('stumble', this.tmpA, 0.8);
    }
  }

  private startRoar(): void {
    this.action = 'roar';
    this.actionTimer = 0;
    this.rig.body.getWorldPosition(this.tmpA);
    this.rings.spawn(this.mesh.position, {
      maxRadius: 220 * this.sizeFactor,
      duration: 1.4,
      wallHeight: 20 * this.sizeFactor,
      bandWidth: 10 * this.sizeFactor,
      damage: 0,
      profile: 'boss-armor',
      color: 0xff8a3a,
      opacity: 0.6,
    });
    for (const top of this.rig.chimneyTops) {
      top.getWorldPosition(this.tmpB);
      this.fx.emit('createExplosion', this.tmpB, 1.6, 'enemy');
    }
    this.fx.emit('createShockwave', this.mesh.position, 120 * this.sizeFactor, 1.0, 0xff7a2a, 0.8);
    this.emitCue('phase', this.tmpA, 1);
  }

  private updateGeysers(dt: number, tuning: ColossusPhaseTuning): void {
    if (tuning.geyserInterval <= 0 || tuning.geyserCount <= 0) return;
    this.geyserTimer -= dt;
    if (this.geyserTimer > 0) return;
    this.geyserTimer = tuning.geyserInterval * this.cadence;
    this.spawnGeyserWave(tuning);
  }

  private spawnGeyserWave(tuning: ColossusPhaseTuning): void {
    const sf = this.sizeFactor;
    const warn = tuning.geyserWarn;
    // 玩家地面投影的预测点
    this.tmpA.copy(this.playerPos).addScaledVector(this.playerVel, warn * 0.9);
    this.tmpB.set(this.playerVel.x, 0, this.playerVel.z);
    if (this.tmpB.lengthSq() < 4) {
      this.tmpB.set(
        this.playerPos.x - this.mesh.position.x,
        0,
        this.playerPos.z - this.mesh.position.z
      );
    }
    if (this.tmpB.lengthSq() < 1e-4) this.tmpB.set(0, 0, 1);
    this.tmpB.normalize();
    this.tmpC.set(-this.tmpB.z, 0, this.tmpB.x);
    for (let k = 0; k < tuning.geyserCount; k++) {
      this.tmpD.copy(this.tmpA);
      if (tuning.geyserLine) {
        const along = (k - (tuning.geyserCount - 1) / 2) * 48 * sf;
        this.tmpD.addScaledVector(this.tmpB, along);
        this.tmpD.addScaledVector(this.tmpC, (Math.random() - 0.5) * 18 * sf);
      } else if (k > 0) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (30 + Math.random() * 40) * sf;
        this.tmpD.x += Math.cos(angle) * radius;
        this.tmpD.z += Math.sin(angle) * radius;
      }
      this.tmpD.y = this.sampleGround(this.tmpD.x, this.tmpD.z);
      this.geysers.spawn(this.tmpD, {
        radius: 15 * sf,
        height: 185 * sf,
        warnTime: warn + k * 0.12,
        eruptTime: 1.7,
        damage: this.config.damage * 1.4,
        profile: 'boss-cannon',
      });
    }
    if (this.geyserWaves % 3 === 0) this.onHazardWarning?.('熔岩柱预警');
    this.geyserWaves++;
  }

  private handleGeyserErupt(base: THREE.Vector3, radius: number): void {
    this.tmpC.copy(base);
    this.tmpC.y += 5 * this.sizeFactor;
    this.fx.emit('createExplosion', this.tmpC, 1.8, 'enemy');
    this.fx.emit('createGroundImpact', base, 1.6, 'ground');
    this.fx.emit('createShockwave', base, radius * 2.4, 0.55, 0xff7a2a, 0.8);
    if (this.time - this.lastGeyserCue > 0.25) {
      this.lastGeyserCue = this.time;
      this.emitCue('geyser', base, 0.9);
    }
  }

  private updateMinions(dt: number, tuning: ColossusPhaseTuning): void {
    if (tuning.minionInterval <= 0) return;
    this.minionTimer -= dt;
    if (this.minionTimer > 0) return;
    this.minionTimer = tuning.minionInterval;
    const kinds: BossMinionKind[] =
      this.phase >= 3 ? ['drone', 'drone', 'heavy'] : ['drone', 'drone'];
    this.rig.body.getWorldPosition(this.tmpA);
    kinds.forEach((kind, i) => {
      const offset = (i - (kinds.length - 1) / 2) * 14 * this.sizeFactor;
      const position = new THREE.Vector3(
        this.tmpA.x + Math.cos(this.yaw) * offset,
        this.tmpA.y + 30 * this.sizeFactor,
        this.tmpA.z - Math.sin(this.yaw) * offset
      );
      this.onSpawnMinion?.(position, kind);
    });
  }

  // ===========================================================================================
  // 散热口 / 阶段 / 死亡
  // ===========================================================================================

  private getAliveVentCount(): number {
    let count = 0;
    for (const vent of this.vents) if (vent.alive) count++;
    return count;
  }

  private areVentsExposed(): boolean {
    for (const vent of this.vents) if (vent.alive && vent.open >= 0.5) return true;
    return false;
  }

  private getArmorMultiplier(): number {
    const destroyed = this.vents.length - this.getAliveVentCount();
    const base = this.phase >= 3 ? 0.6 : 0.42;
    return Math.min(0.85, base + 0.06 * destroyed);
  }

  private destroyVent(vent: VentState): void {
    if (!vent.alive) return;
    vent.alive = false;
    vent.hp = 0;
    vent.subTarget.current = 0;
    vent.rig.core.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 2.4, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 2.2, 'boss-armor');
    for (const slat of vent.rig.slats) slat.visible = false;
    this.blowPlate(vent);
    this.emitCue('vent-destroyed', this.tmpA, 1);
    this.rebuildCollisionParts();
  }

  private blowPlate(vent: VentState): void {
    if (!vent.rig.plate.visible) return;
    vent.rig.plate.visible = false;
    vent.rig.magmaPatch.visible = true;
    vent.rig.magmaPatch.getWorldPosition(this.tmpB);
    this.fx.emit('createExplosion', this.tmpB, 1.6, 'enemy');
    this.fx.emit('createHit', this.tmpB, 2, 'boss');
  }

  private evaluatePhase(): void {
    if (!this.isAlive()) return;
    const ratio = this.health.getCurrentHealth() / Math.max(1, this.health.getMaxHealth());
    let target = 1;
    if (ratio <= PHASE3_RATIO) target = 3;
    else if (ratio <= PHASE2_RATIO || this.getAliveVentCount() === 0) target = 2;
    while (this.phase < target && !this.disposed) {
      this.enterPhase(this.phase + 1);
    }
    if (!this.lowHealthReached && ratio <= LOW_HEALTH_RATIO) {
      this.lowHealthReached = true;
      this.stumbleTimer = 2.5;
    }
  }

  private enterPhase(phase: number): void {
    this.phase = Math.min(PHASE_COUNT, phase);
    const label = this.phase === 2 ? '散热口击穿 · 熔核暴露' : '熔毁暴走';
    if (this.phase === 2) {
      for (const vent of this.vents) this.blowPlate(vent);
      this.geyserTimer = 2.5;
      this.beamTimer = 7;
      this.minionTimer = 6;
    } else {
      this.geyserTimer = Math.min(this.geyserTimer, 2);
      this.beamTimer = Math.min(this.beamTimer, 6);
    }
    if (this.action === 'walk') this.startRoar();
    else this.pendingRoar = true;
    this.statusKey = -1;
    this.rebuildCollisionParts();
    this.onPhaseChange?.(this.phase, label);
  }

  private handleHealthDepleted(): void {
    if (this.deathHandled) return;
    this.deathHandled = true;
    this.clearHazards();
    this.detonateMissiles();
    this.collisionParts = [];
    this.stompLeg = null;
    this.action = 'walk';
    this.statusKey = -1;
    // 抬起的腿落回地面，坍塌时四足着地
    for (const leg of this.legs) {
      leg.stepping = false;
      leg.current.copy(leg.planted);
      leg.rig.footGlowMaterial.emissiveIntensity = 0.22;
    }
    if (this.deathSequenceEnabled && !this.disposed) {
      this.dying = true;
      this.deathTimer = 0;
      this.deathBurstTimer = 0;
      this.rig.body.getWorldPosition(this.tmpA);
      this.emitCue('collapse', this.tmpA, 1);
      return;
    }
    this.finishDeath();
  }

  private clearHazards(): void {
    this.rings.clear();
    this.geysers.clear();
    this.shells.clear();
    this.beam.clear();
    this.stompMarker.hide();
    this.mortarQueue = 0;
    this.mortarCharge = 0;
    this.missileQueue = 0;
    this.missileCharge = 0;
  }

  private detonateMissiles(): void {
    for (const missile of this.missileSystem.getMissiles()) {
      missile.takeDamage(1e6);
    }
  }

  private updateDeathSequence(dt: number): void {
    this.deathTimer += dt;
    const p = Math.min(1, this.deathTimer / DEATH_SEQUENCE_DURATION);
    this.collapseAmount = Math.min(1, p * 1.25) ** 2;
    this.updateBodyPose(dt);
    this.poseLegs();
    this.mesh.updateMatrixWorld(true);

    const materials = this.rig.materials;
    materials.crack.emissiveIntensity = 3 + 5 * p + Math.sin(this.time * 31) * 0.8;
    materials.core.emissiveIntensity = 5 + 3 * p;
    materials.belly.emissiveIntensity = 2.5 + 3 * p;
    materials.visor.emissiveIntensity = Math.max(
      0,
      (1 - p) * 3 * (0.5 + 0.5 * Math.sin(this.time * 40))
    );

    this.deathBurstTimer -= dt;
    if (this.deathBurstTimer <= 0) {
      this.deathBurstTimer = 0.3;
      this.rig.body.getWorldPosition(this.tmpA);
      const s = this.rig.scale;
      this.tmpA.x += (Math.random() - 0.5) * 9 * s;
      this.tmpA.y += (Math.random() - 0.3) * 4 * s;
      this.tmpA.z += (Math.random() - 0.5) * 12 * s;
      this.fx.emit('createExplosion', this.tmpA, 1.6 + p, 'enemy');
      if (Math.random() < 0.4) {
        this.tmpB.set(this.tmpA.x, this.sampleGround(this.tmpA.x, this.tmpA.z), this.tmpA.z);
        this.fx.emit('createShockwave', this.tmpB, 60 * this.sizeFactor, 0.7, 0xff6a1a, 0.8);
      }
    }
    if (p >= 1) this.finishDeath();
  }

  private finishDeath(): void {
    this.dying = false;
    this.mesh.updateMatrixWorld(true);
    this.rig.body.getWorldPosition(this.tmpA);
    if (!isFiniteVector(this.tmpA)) this.tmpA.copy(this.mesh.position);
    const position = this.tmpA.clone();
    const ground = this.sampleGround(position.x, position.z);
    this.onDestroy?.(position, this.config);
    // 熔岩爆发：在控制器清理粒子之后追加，作为巨像倒入熔岩的收尾
    this.tmpB.set(position.x, ground, position.z);
    this.fx.emit('createExplosion', position, 2.4, 'enemy');
    this.fx.emit('createShockwave', this.tmpB, 150 * this.sizeFactor, 1.4, 0xff5a14, 0.9);
    this.fx.emit('createShockwave', this.tmpB, 90 * this.sizeFactor, 0.9, 0xffc060, 0.85);
    this.fx.emit('createGroundImpact', this.tmpB, 1.8, 'ground');
    this.emitCue('collapse', this.tmpB, 1);
  }

  // ===========================================================================================
  // 视觉
  // ===========================================================================================

  private updateHazards(dt: number): void {
    this.rings.update(dt);
    this.geysers.update(dt);
    this.shells.update(dt);
  }

  private updateVisuals(dt: number): void {
    const t = this.time;
    const materials = this.rig.materials;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);

    // 散热口：齐射后 / 阶段 3 / 瘫痪时开启
    const forceOpen = this.phase >= 3 || this.stunTimer > 0 || this.heatDumpTimer > 0;
    let anyOpening = false;
    for (const vent of this.vents) {
      const target = vent.alive && forceOpen ? 1 : 0;
      const rate = target > vent.open ? dt * 2.4 : dt * 1.6;
      vent.open += THREE.MathUtils.clamp(target - vent.open, -rate, rate);
      for (const slat of vent.rig.slats) slat.rotation.x = -vent.open * 1.2;
      const heatMaterial = vent.rig.heat.material;
      if (vent.alive) {
        vent.rig.coreMaterial.emissiveIntensity =
          0.35 + vent.open * (3.3 + 0.6 * Math.sin(t * 9 + vent.rig.index)) + this.hitFlash * 0.6;
        heatMaterial.opacity = vent.open * 0.8;
        if (vent.open > 0.5) anyOpening = true;
        if (vent.open > 0.6) {
          vent.sparkTimer -= dt;
          if (vent.sparkTimer <= 0) {
            vent.sparkTimer = 0.4 + Math.random() * 0.3;
            vent.rig.core.getWorldPosition(this.tmpA);
            this.tmpA.y += 2 * this.rig.scale;
            this.fx.emit('createHit', this.tmpA, 1.1, 'enemy');
          }
        }
      } else {
        vent.rig.coreMaterial.emissiveIntensity = 2.4 + 0.8 * Math.sin(t * 5 + vent.rig.index);
        heatMaterial.opacity = 0.5 + 0.15 * Math.sin(t * 7 + vent.rig.index);
      }
      const heatSize =
        (3.6 + 1.2 * vent.open + 0.4 * Math.sin(t * 6 + vent.rig.index)) * this.rig.scale;
      vent.rig.heat.scale.set(heatSize, heatSize, 1);
    }
    if (anyOpening && this.ventOpenCueArmed) {
      this.ventOpenCueArmed = false;
      this.rig.body.getWorldPosition(this.tmpA);
      this.emitCue('vent-open', this.tmpA, 0.6);
    } else if (!anyOpening) {
      this.ventOpenCueArmed = true;
    }

    // 裂缝 / 腹部 / 岩体余温
    const phaseGlow = [1.1, 1.9, 2.9][this.phase - 1] ?? 1.1;
    const flicker = this.lowHealthReached ? 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3) : 1;
    materials.crack.emissiveIntensity =
      (phaseGlow + 0.45 * Math.sin(t * 2.2)) * flicker + this.hitFlash * 2;
    materials.belly.emissiveIntensity = 1.2 + 0.45 * this.phase + 0.3 * Math.sin(t * 1.7);
    materials.basalt.emissiveIntensity = 0.35 + 0.22 * (this.phase - 1) + this.hitFlash * 0.6;
    materials.plate.emissiveIntensity = 0.28 + 0.18 * (this.phase - 1) + this.hitFlash * 0.5;

    // 熔炉核心与闸门
    const beamCharge = this.beam.getChargeProgress();
    const beamFiring = this.beam.getState() === 'fire' ? 1 : 0;
    const shutterTarget = this.phase >= 2 || this.action === 'beam' ? 1 : 0;
    this.shutterOpen += THREE.MathUtils.clamp(
      shutterTarget - this.shutterOpen,
      -dt * 1.2,
      dt * 1.2
    );
    this.rig.coreShutters.forEach((pivot, i) => {
      const side = i === 0 ? 1 : -1;
      pivot.rotation.y = side * this.shutterOpen * 1.35;
    });
    materials.core.emissiveIntensity =
      1.6 + this.shutterOpen * 1.4 + beamCharge * 4 + beamFiring * 3 + 0.3 * Math.sin(t * 4);
    const coreGlow = this.rig.coreGlow;
    coreGlow.material.opacity = Math.min(1, 0.3 + 0.45 * this.shutterOpen + beamCharge * 0.4);
    const coreSize =
      (6.5 + 2 * this.shutterOpen + 5 * beamCharge + 0.6 * Math.sin(t * 5)) * this.rig.scale;
    coreGlow.scale.set(coreSize, coreSize, 1);

    // 目镜 / 炮口 / 导弹井 / 膝关节 / 足掌
    const stunFlicker = this.stunTimer > 0 ? 0.3 + 0.7 * Math.abs(Math.sin(t * 23)) : 1;
    materials.visor.emissiveIntensity = (2.2 + 0.6 * Math.sin(t * 3)) * stunFlicker;
    for (const glow of this.rig.visorGlows) glow.material.opacity = 0.7 * stunFlicker;
    const mortarCharge =
      this.mortarCharge > 0 ? 1 - this.mortarCharge / MORTAR_CHARGE : this.mortarQueue > 0 ? 1 : 0;
    materials.mortarMuzzle.emissiveIntensity = 0.5 + mortarCharge * 4.5;
    const missileCharge =
      this.missileCharge > 0
        ? 1 - this.missileCharge / MISSILE_CHARGE
        : this.missileQueue > 0
          ? 1
          : 0;
    materials.missileCell.emissiveIntensity = 0.6 + missileCharge * 4.5;
    materials.cannonMuzzle.emissiveIntensity = 0.6 + this.cannonFlash * 5;
    materials.kneeGlow.emissiveIntensity =
      1.1 + 0.4 * this.phase + 0.35 * Math.sin(t * 3) + this.stumbleAmount * 3;
    for (const leg of this.legs) {
      if (leg === this.stompLeg) continue;
      const target = 0.22 + (leg.stepping ? 0.3 : 0);
      const material = leg.rig.footGlowMaterial;
      material.emissiveIntensity += (target - material.emissiveIntensity) * Math.min(1, dt * 6);
    }
    for (let i = 0; i < this.rig.chimneyGlows.length; i++) {
      const glow = this.rig.chimneyGlows[i];
      const size = (2.4 + 0.5 * this.phase + 0.5 * Math.sin(t * 11 + i * 2.1)) * this.rig.scale;
      glow.scale.set(size, size * 1.3, 1);
    }

    // 头部追踪玩家
    const head = this.rig.head;
    let targetHeadYaw = 0;
    let targetHeadPitch = 0;
    if (this.hasPlayer) {
      this.worldToRoot(this.playerPos, this.tmpA);
      targetHeadYaw = THREE.MathUtils.clamp(Math.atan2(this.tmpA.x, this.tmpA.z), -0.6, 0.6);
      this.rig.head.getWorldPosition(this.tmpB);
      const horizontal = Math.hypot(this.playerPos.x - this.tmpB.x, this.playerPos.z - this.tmpB.z);
      const elevation = Math.atan2(this.playerPos.y - this.tmpB.y, Math.max(1, horizontal));
      targetHeadPitch = THREE.MathUtils.clamp(-elevation * 0.6, -0.45, 0.3);
    }
    if (this.action === 'roar') targetHeadPitch = -0.5;
    head.rotation.y += (targetHeadYaw - head.rotation.y) * Math.min(1, dt * 2.5);
    head.rotation.x += (targetHeadPitch - head.rotation.x) * Math.min(1, dt * 2.5);

    // 阶段 3：熔融滴落火花
    if (this.phase >= 3) {
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.dripTimer = 0.35 + Math.random() * 0.25;
        this.rig.body.getWorldPosition(this.tmpA);
        const s = this.rig.scale;
        this.tmpA.x += (Math.random() - 0.5) * 8 * s;
        this.tmpA.y -= 2.5 * s;
        this.tmpA.z += (Math.random() - 0.5) * 10 * s;
        this.fx.emit('createHit', this.tmpA, 1.4, 'enemy');
      }
    }
  }

  private emitCue(cue: MagmaColossusCue, position: THREE.Vector3, intensity: number): void {
    if (!this.onEffectCue) return;
    this.cuePosition.copy(position);
    this.onEffectCue(cue, this.cuePosition, intensity);
  }
}
