import * as THREE from 'three';
import { BOSS_CONFIGS, BossType, type BossConfig } from './BossTypes';
import { BossMissileSystem } from './BossMissileSystem';
import type { BossHazardHit, BossMinionKind, BossSubTarget, IAdvancedBoss } from './BossContracts';
import { HealthSystem } from '@/features/combat/HealthSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { getLocale, tr, type Locale } from '@/i18n';
import {
  HazardRingPool,
  createGlowSprite,
  createHazardProbe,
  disposeObjectTree,
  isFiniteVector,
  resetHazardProbe,
  resolveMissileParticles,
} from './MagmaColossusHazards';
import {
  BossParticleFx,
  LightningBoltPool,
  StormStrikePool,
  ThunderheadShroud,
} from './TempestZeppelinFx';
import {
  createTempestZeppelinMesh,
  type TempestZeppelinGroup,
  type TempestZeppelinRig,
  type ZeppelinCellRig,
  type ZeppelinCoilRig,
} from './TempestZeppelinMesh';

export { createTempestZeppelinMesh } from './TempestZeppelinMesh';

/**
 * 第八关 Boss「雷霆飞艇」TEMPEST ZEPPELIN —— 停泊在雷鸣峡谷上空、用特斯拉线圈收集闪电的装甲飞艇。
 *
 * 机制：
 * - 航行：缓慢保持约 320 米的距离并把侧舷对准玩家（线圈与炮塔都能射击），不离开出生点太远。
 * - 炮塔：下颚两座 + 背部前后两座，经 onFire 发射；背脊导弹井齐射 BossMissileSystem 导弹。
 * - 气囊（6 个子目标，×2.2）：每击破一个，浮力下降（高度降低）并向受损一侧横倾 / 纵倾，
 *   船体装甲随之削弱；破口持续喷火冒烟。
 * - 特斯拉鞭笞：某座线圈先嗡鸣（环光渐亮），再充能（放电球发蓝光 + 射程光环 + 先导电流伸向目标），
 *   放电时击中射程内最近的目标并在目标之间连锁跳跃。拉开距离即可躲开；
 *   充能时放电球是弱点（×1.5），短时间内打出足够伤害会让线圈短路、放电取消。
 * - 雷暴云层：周期性在船身周围翻涌乌云遮蔽船体，云层内的目标会被持续电击（远离即可）。
 * - 阶段 2（血量 ≤ 66% 或击破 3 个气囊）：尾部无人机舱开启放出无人机（开舱时舱内 ×2.6，
 *   可摧毁的子目标）；召雷——在玩家航迹上预警后从云底劈下贯穿全高度的落雷。
 * - 阶段 3（≤ 33% 或击破 5 个气囊）：龙骨装甲炸飞、风暴核心暴露（×2.4）；浮力失控继续下沉；
 *   雷暴齐射（全部线圈同时充能放电并在船体周围织成电网）；召雷连成一线。血量 < 25% 时开始下坠。
 * - 死亡：默认归零同步 onDestroy 并追加爆炸；setDeathSequenceEnabled(true) 后
 *   先播放约 5 秒“折断脊梁坠落”，再触发 onDestroy。
 */

export type TempestZeppelinCue =
  | 'coil-charge'
  | 'lightning'
  | 'coil-short'
  | 'storm-call'
  | 'storm-strike'
  | 'shroud'
  | 'cell-burst'
  | 'hangar-open'
  | 'hangar-destroyed'
  | 'drone-launch'
  | 'missile-launch'
  | 'barrage-charge'
  | 'phase'
  | 'listing'
  | 'crash';

type CoilPhase = 'idle' | 'hum' | 'charge' | 'cooldown' | 'shorted';
type HangarPhase = 'closed' | 'opening' | 'launching' | 'holding' | 'closing';
type PartRole = 'hull' | 'cell' | 'hangar' | 'core' | 'coil' | 'gondola' | 'engine';

interface ZeppelinPhaseTuning {
  speedFactor: number;
  turnFactor: number;
  cannonFactor: number;
  missileFactor: number;
  missileCount: number;
  lashInterval: number;
  lashHum: number;
  lashCharge: number;
  lashRange: number;
  lashChains: number;
  shroudInterval: number;
  shroudDuration: number;
  shroudZap: number;
  stormInterval: number;
  stormWarn: number;
  stormCount: number;
  stormLine: boolean;
  hangarInterval: number;
  droneCount: number;
  barrageInterval: number;
}

const PHASE_TUNING: readonly ZeppelinPhaseTuning[] = [
  {
    speedFactor: 1,
    turnFactor: 1,
    cannonFactor: 1,
    missileFactor: 1,
    missileCount: 2,
    lashInterval: 7.5,
    lashHum: 1.0,
    lashCharge: 1.6,
    lashRange: 220,
    lashChains: 0,
    shroudInterval: 24,
    shroudDuration: 6,
    shroudZap: 0.75,
    stormInterval: 0,
    stormWarn: 1.6,
    stormCount: 0,
    stormLine: false,
    hangarInterval: 0,
    droneCount: 0,
    barrageInterval: 0,
  },
  {
    speedFactor: 1.2,
    turnFactor: 1.25,
    cannonFactor: 0.85,
    missileFactor: 0.9,
    missileCount: 3,
    lashInterval: 6,
    lashHum: 0.9,
    lashCharge: 1.4,
    lashRange: 245,
    lashChains: 1,
    shroudInterval: 21,
    shroudDuration: 6.5,
    shroudZap: 0.7,
    stormInterval: 9.5,
    stormWarn: 1.5,
    stormCount: 3,
    stormLine: false,
    hangarInterval: 26,
    droneCount: 3,
    barrageInterval: 0,
  },
  {
    speedFactor: 1.35,
    turnFactor: 1.5,
    cannonFactor: 0.72,
    missileFactor: 0.8,
    missileCount: 4,
    lashInterval: 4.8,
    lashHum: 0.75,
    lashCharge: 1.25,
    lashRange: 270,
    lashChains: 2,
    shroudInterval: 17,
    shroudDuration: 7,
    shroudZap: 0.55,
    stormInterval: 7,
    stormWarn: 1.35,
    stormCount: 5,
    stormLine: true,
    hangarInterval: 20,
    droneCount: 4,
    barrageInterval: 14,
  },
];

const PHASE_COUNT = 3;
const PHASE2_RATIO = 0.66;
const PHASE3_RATIO = 0.33;
const LOW_HEALTH_RATIO = 0.25;
const PHASE2_CELLS_LOST = 3;
const PHASE3_CELLS_LOST = 5;
const CELL_HEALTH_RATIO = 0.055;
const HANGAR_HEALTH_RATIO = 0.07;
const COIL_SHORT_RATIO = 0.022;
const STATION_RANGE = 320;
const LEASH_RADIUS = 700;
const CANNON_RANGE = 560;
const MISSILE_CHARGE = 0.9;
const CHAIN_RANGE = 125;
const COIL_COOLDOWN = 0.6;
const COIL_SHORT_TIME = 7;
const HANGAR_OPEN_TIME = 1.2;
const HANGAR_HOLD_TIME = 3.2;
const HANGAR_CLOSE_TIME = 1.0;
const DRONE_STAGGER = 0.45;
const BUOYANCY_PER_CELL = 9;
const PHASE3_SINK = 12;
const FALL_RATE = 2.4;
const FREE_FALL_LIMIT = 70;
const DEATH_SEQUENCE_DURATION = 5;
const MAX_STEP_DT = 0.1;
const WARNING_THROTTLE = 4;
const BOLT_COLOR = 0x8fd8ff;
const HALO_COLOR = 0x3c9cff;

const NO_TARGETS: readonly THREE.Object3D[] = [];
const X_AXIS = new THREE.Vector3(1, 0, 0);

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

interface CellState {
  rig: ZeppelinCellRig;
  hp: number;
  max: number;
  alive: boolean;
  /** 破裂后的泄气动画进度 0..1 */
  deflate: number;
  smokeTimer: number;
  subTarget: BossSubTarget;
}

interface CoilState {
  rig: ZeppelinCoilRig;
  phase: CoilPhase;
  timer: number;
  hum: number;
  chargeTime: number;
  range: number;
  chains: number;
  barrage: boolean;
  target: THREE.Object3D | null;
  shortDamage: number;
  crackleTimer: number;
  leaderTimer: number;
  flash: number;
  /** 射程光环（朝向镜头的圆环，直径 = 2 × 射程） */
  halo: THREE.Sprite;
  /** 充能波前：从放电球向外扩张，抵达外环时放电 */
  front: THREE.Sprite;
}

export class TempestZeppelinAI implements IAdvancedBoss {
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onPhaseChange?: (phase: number, label: string) => void;
  public onSpawnMinion?: (position: THREE.Vector3, kind: BossMinionKind) => void;
  public onHazardWarning?: (label: string) => void;
  /** 扩展钩子：音效 / 镜头震动提示（position 为复用向量，需要保存请 clone） */
  public onEffectCue?: (
    cue: TempestZeppelinCue,
    position: THREE.Vector3,
    intensity: number
  ) => void;

  private readonly mesh: THREE.Group;
  private readonly config: BossConfig;
  private readonly fx: BossParticleFx;
  private readonly health: HealthSystem;
  private readonly missileSystem: BossMissileSystem;
  private readonly rig: TempestZeppelinRig;
  private readonly hazardRoot: THREE.Group;
  private readonly bolts: LightningBoltPool;
  private readonly strikes: StormStrikePool;
  private readonly rings: HazardRingPool;
  private readonly shroud: ThunderheadShroud;
  private readonly cells: CellState[] = [];
  private readonly coils: CoilState[] = [];
  private readonly subTargets: BossSubTarget[] = [];
  private readonly cellByPart = new Map<THREE.Object3D, CellState>();
  private readonly coilByPart = new Map<THREE.Object3D, CoilState>();
  private readonly partRoles = new Map<THREE.Object3D, PartRole>();
  private readonly collisionParts: THREE.Object3D[] = [];
  private readonly targets: THREE.Object3D[] = [];
  private readonly struck: THREE.Object3D[] = [];
  private readonly warningTimes = new Map<string, number>();
  private readonly probe = createHazardProbe();
  private readonly hangarSubTarget: BossSubTarget;
  private readonly anchor = new THREE.Vector3();
  private readonly baseAltitude: number;
  private readonly cadence: number;
  private readonly sizeFactor: number;
  private groundSampler: ((x: number, z: number) => number) | null = null;

  private phase = 1;
  private disposed = false;
  private dying = false;
  private deathHandled = false;
  private deathSequenceEnabled = false;
  private deathTimer = 0;
  private deathBurstTimer = 0;
  private deathFallSpeed = 0;
  private time = 0;
  private yaw = 0;
  private pitch = 0;
  private roll = 0;
  private speed = 0;
  private sink = 0;
  private snappedToPlayer = false;
  private orbitSign: 1 | -1 = 1;
  private orbitTimer = 18;
  private stunTimer = 0;
  private lowHealthReached = false;
  private groundTimer = 0;
  private groundFloor = -Infinity;

  private cannonTimer = 1.2;
  private turretIndex = 0;
  private missileTimer = 6;
  private missileCharge = 0;
  private missileQueue = 0;
  private missileStagger = 0;
  private missileFired = 0;
  private lashTimer = 4;
  private barrageTimer = 6;
  private shroudTimer = 12;
  private shroudZapTimer = 0;
  private stormTimer = 4;
  private stormWaves = 0;
  private hangarPhase: HangarPhase = 'closed';
  private hangarTimer = 0;
  private hangarCycleTimer = 6;
  private hangarOpen = 0;
  private hangarHp: number;
  private hangarMax: number;
  private hangarAlive = true;
  private dronesQueued = 0;
  private droneStagger = 0;
  private coreExposed = false;
  private shortedLabelTimer = 0;
  private hitFlash = 0;
  private strobeTimer = 0;
  private fireTimer = 0;
  private statusLabel: string | null = null;
  private statusKey = -1;
  /** 状态提示按生成时的语言缓存；切换语言后重新生成 */
  private statusLocale: Locale | null = null;

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
  private readonly breakPoint = new THREE.Vector3();
  private readonly cuePosition = new THREE.Vector3();

  constructor(
    mesh: THREE.Group,
    config: BossConfig,
    scene: THREE.Scene,
    particleSystem: ParticleSystem
  ) {
    this.mesh = mesh;
    this.config = config;
    this.fx = new BossParticleFx(particleSystem);
    const maxHealth = Number.isFinite(config.health) && config.health > 0 ? config.health : 1;
    this.health = new HealthSystem(maxHealth);
    this.health.onDeath = () => this.handleHealthDepleted();
    this.missileSystem = new BossMissileSystem(scene, resolveMissileParticles(particleSystem));
    this.rig = this.ensureRig(mesh, config);
    this.sizeFactor = this.rig.scale / 6;
    const base = BOSS_CONFIGS[BossType.TEMPEST_ZEPPELIN];
    this.cadence = THREE.MathUtils.clamp(
      safeRatio(config.cannonFireInterval, base.cannonFireInterval),
      0.5,
      2
    );
    if (!mesh.name) mesh.name = `BOSS_${config.type}`;

    if (!isFiniteVector(mesh.position)) mesh.position.set(0, 170, 0);
    this.anchor.copy(mesh.position);
    this.baseAltitude = mesh.position.y;
    this.tmpEuler.setFromQuaternion(mesh.quaternion, 'YXZ');
    this.yaw = Number.isFinite(this.tmpEuler.y) ? this.tmpEuler.y : 0;

    this.hazardRoot = new THREE.Group();
    this.hazardRoot.name = 'zeppelin_hazards';
    scene.add(this.hazardRoot);
    this.bolts = new LightningBoltPool(this.hazardRoot, 30, 'zeppelin_bolt');
    this.strikes = new StormStrikePool(this.hazardRoot, 8, this.bolts, 0x9fd8ff, 'zeppelin_strike');
    this.strikes.onStrike = (top, bottom, marker) => this.handleStormStrike(top, bottom, marker);
    this.rings = new HazardRingPool(this.hazardRoot, 4, 'zeppelin_surge_ring');
    this.shroud = new ThunderheadShroud(this.mesh, this.rig.halfLength, this.rig.hullRadius);

    const cellMax = Math.max(1, Math.round(maxHealth * CELL_HEALTH_RATIO));
    for (const cellRig of this.rig.cells) {
      const subTarget: BossSubTarget = { mesh: cellRig.mesh, current: cellMax, max: cellMax };
      const state: CellState = {
        rig: cellRig,
        hp: cellMax,
        max: cellMax,
        alive: true,
        deflate: 0,
        smokeTimer: 0,
        subTarget,
      };
      this.cells.push(state);
      this.subTargets.push(subTarget);
      this.cellByPart.set(cellRig.mesh, state);
      this.partRoles.set(cellRig.mesh, 'cell');
    }
    this.hangarMax = Math.max(1, Math.round(maxHealth * HANGAR_HEALTH_RATIO));
    this.hangarHp = this.hangarMax;
    this.hangarSubTarget = {
      mesh: this.rig.hangar.interior,
      current: this.hangarMax,
      max: this.hangarMax,
    };
    this.subTargets.push(this.hangarSubTarget);
    this.partRoles.set(this.rig.hangar.interior, 'hangar');
    this.partRoles.set(this.rig.core, 'core');
    this.partRoles.set(this.rig.gondola, 'gondola');
    for (const engine of this.rig.engines) this.partRoles.set(engine.nacelle, 'engine');
    for (const coilRig of this.rig.coils) {
      const halo = createGlowSprite(HALO_COLOR, 1, 0, 'ring', false);
      halo.name = `zeppelin_coil_${coilRig.index}_range`;
      halo.visible = false;
      const front = createGlowSprite(0xd8f0ff, 1, 0, 'ring', false);
      front.name = `zeppelin_coil_${coilRig.index}_front`;
      front.visible = false;
      this.hazardRoot.add(halo, front);
      const state: CoilState = {
        rig: coilRig,
        phase: 'idle',
        timer: 0,
        hum: 1,
        chargeTime: 1,
        range: 1,
        chains: 0,
        barrage: false,
        target: null,
        shortDamage: 0,
        crackleTimer: 0,
        leaderTimer: 0,
        flash: 0,
        halo,
        front,
      };
      this.coils.push(state);
      this.coilByPart.set(coilRig.cap, state);
      this.partRoles.set(coilRig.cap, 'coil');
    }

    this.missileTimer = Math.max(4, config.missileFireInterval * 0.55);
    this.applyTransform();
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
    this.updateFlight(dt, tuning);
    this.applyTransform();
    this.mesh.updateMatrixWorld(true);
    this.collectTargets();
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
    this.hitFlash = Math.min(1, this.hitFlash + 0.3);
    this.health.takeDamage(amount);
    if (!this.disposed && this.isAlive()) this.evaluatePhase();
  }

  public takeDamageAt(part: THREE.Object3D, amount: number): void {
    if (this.disposed || !this.isAlive() || this.isInvulnerable()) return;
    if (!part || !Number.isFinite(amount) || amount <= 0) return;
    const multiplier = this.getDamageMultiplier(part);
    const dealt = amount * multiplier;
    if (!(dealt > 0)) return;

    const cell = this.cellByPart.get(part);
    if (cell && cell.alive) {
      cell.hp = Math.max(0, cell.hp - dealt);
      cell.subTarget.current = cell.hp;
      if (cell.hp <= 0) this.burstCell(cell);
    }
    if (part === this.rig.hangar.interior && this.hangarAlive) {
      this.hangarHp = Math.max(0, this.hangarHp - dealt);
      this.hangarSubTarget.current = this.hangarHp;
      if (this.hangarHp <= 0) this.destroyHangar();
    }
    const coil = this.coilByPart.get(part);
    if (coil && (coil.phase === 'hum' || coil.phase === 'charge')) {
      coil.shortDamage += dealt;
      if (coil.shortDamage >= this.health.getMaxHealth() * COIL_SHORT_RATIO) this.shortCoil(coil);
    }
    this.hitFlash = Math.min(1, this.hitFlash + (multiplier > 1 ? 0.5 : 0.2));
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
    const role = this.partRoles.get(part) ?? 'hull';
    switch (role) {
      case 'cell': {
        const cell = this.cellByPart.get(part);
        return cell && cell.alive ? 2.2 : this.getArmorMultiplier();
      }
      case 'hangar':
        if (!this.hangarAlive) return this.getArmorMultiplier();
        return this.hangarOpen >= 0.5 ? 2.6 : 0.5;
      case 'core':
        return this.coreExposed ? 2.4 : 0.4;
      case 'coil': {
        const coil = this.coilByPart.get(part);
        return coil && (coil.phase === 'hum' || coil.phase === 'charge') ? 1.5 : 0.6;
      }
      case 'gondola':
      case 'engine':
        return 0.6;
      default:
        return this.getArmorMultiplier();
    }
  }

  public checkHazard(targetPosition: THREE.Vector3, targetRadius: number): BossHazardHit | null {
    if (this.disposed || !targetPosition || !isFiniteVector(targetPosition)) return null;
    if (this.deathHandled) return null;
    const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 0;
    resetHazardProbe(this.probe);
    this.bolts.probe(targetPosition, radius, this.probe);
    this.rings.probe(targetPosition, radius, this.probe);
    if (this.probe.damage <= 0) return null;
    return {
      damage: this.probe.damage,
      profile: this.probe.profile,
      position: this.probe.position.clone(),
    };
  }

  public getStatusLabel(): string | null {
    const aliveCells = this.getAliveCellCount();
    let code = 0;
    if (this.dying || this.deathHandled) code = 9;
    else if (this.stunTimer > 0) code = 8;
    else if (this.isBarrageCharging()) code = 7;
    else if (this.shortedLabelTimer > 0) code = 6;
    else if (this.isAnyCoilCharging()) code = 5;
    else if (this.shroud.isCharged()) code = 4;
    else if (this.hangarAlive && this.hangarOpen >= 0.5) code = 3;
    const key =
      code * 10000 + this.phase * 1000 + (this.lowHealthReached ? 100 : 0) + aliveCells * 10;
    const locale = getLocale();
    if (key === this.statusKey && locale === this.statusLocale) return this.statusLabel;
    this.statusKey = key;
    this.statusLocale = locale;
    switch (code) {
      case 9:
        this.statusLabel = tr({ en: 'Airship going down', zh: '飞艇坠毁' });
        break;
      case 8:
        this.statusLabel = tr({ en: 'EMP stunned · Coils offline', zh: '电磁瘫痪 · 线圈失效' });
        break;
      case 7:
        this.statusLabel = tr({
          en: 'Storm volley charging · Get clear of the hull',
          zh: '雷暴齐射充能 · 远离船体',
        });
        break;
      case 6:
        this.statusLabel = tr({ en: 'Coils shorted', zh: '线圈短路' });
        break;
      case 5:
        this.statusLabel = tr({
          en: 'Coils charging · Open the distance',
          zh: '线圈充能 · 拉开距离',
        });
        break;
      case 4:
        this.statusLabel = tr({ en: 'Storm cloud · Lightning inside', zh: '雷暴云层 · 云内放电' });
        break;
      case 3:
        this.statusLabel = tr({
          en: 'Drone bay open · Weak point exposed',
          zh: '无人机舱开启 · 弱点暴露',
        });
        break;
      default:
        if (this.phase >= 3) {
          this.statusLabel = this.lowHealthReached
            ? tr({ en: 'Losing lift · Going down', zh: '浮力不足 · 正在下坠' })
            : tr(
                {
                  en: 'Lift failing · Storm core exposed · Cells {alive}/{total}',
                  zh: '浮力失控 · 风暴核心暴露 · 气囊 {alive}/{total}',
                },
                { alive: aliveCells, total: this.cells.length }
              );
        } else {
          this.statusLabel = tr(
            {
              en: 'Armored airship · Cells {alive}/{total}',
              zh: '装甲飞艇 · 气囊 {alive}/{total}',
            },
            { alive: aliveCells, total: this.cells.length }
          );
        }
    }
    return this.statusLabel;
  }

  public getSubTargets(): BossSubTarget[] {
    return this.subTargets;
  }

  /** EMP：线圈全部失效、雷暴云消散、停火若干秒（期间装甲稍弱） */
  public applyStun(seconds: number): void {
    if (!this.isAlive() || this.disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    this.stunTimer = Math.max(this.stunTimer, Math.min(4, seconds));
    for (const coil of this.coils) {
      if (coil.phase === 'hum' || coil.phase === 'charge') this.cancelCoil(coil, 2.5);
    }
    this.shroud.stop();
    this.missileCharge = 0;
    this.missileQueue = 0;
    if (this.hangarPhase === 'opening' || this.hangarPhase === 'launching') {
      this.dronesQueued = 0;
      this.hangarPhase = 'holding';
      this.hangarTimer = 0;
    }
    this.rig.gondola.getWorldPosition(this.tmpA);
    this.fx.emit('createHit', this.tmpA, 2.2, 'boss');
    this.statusKey = -1;
  }

  /** 扩展：地表高度采样（地形批次提供），用于限制下沉高度与落雷终点 */
  public setGroundSampler(sampler: (x: number, z: number) => number): void {
    this.groundSampler = typeof sampler === 'function' ? sampler : null;
    this.groundTimer = 0;
  }

  /**
   * 扩展：开启后血量归零先播放约 5 秒“折断脊梁坠落”（期间 isAlive() 为 false、无敌、无碰撞部件），
   * 结束时才触发 onDestroy。默认关闭（契约：归零时同步触发）。
   */
  public setDeathSequenceEnabled(enabled: boolean): void {
    this.deathSequenceEnabled = enabled;
  }

  public isDying(): boolean {
    return this.dying;
  }

  /** 扩展：浮力损失导致的下沉量（米） */
  public getSinkAmount(): number {
    return this.sink;
  }

  /** 扩展：雷暴云层覆盖度 0..1（可用于降低雷达 / 锁定可见度） */
  public getCloudCover(): number {
    return this.shroud.getCoverage();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dying = false;
    this.missileSystem.dispose();
    this.bolts.dispose();
    this.strikes.dispose();
    this.rings.dispose();
    this.shroud.dispose();
    for (const coil of this.coils) {
      coil.halo.parent?.remove(coil.halo);
      coil.halo.material.dispose();
      coil.front.parent?.remove(coil.front);
      coil.front.material.dispose();
    }
    this.hazardRoot.parent?.remove(this.hazardRoot);
    this.mesh.visible = false;
    this.mesh.parent?.remove(this.mesh);
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      disposeObjectTree(child);
    }
    this.collisionParts.length = 0;
    this.cellByPart.clear();
    this.coilByPart.clear();
    this.partRoles.clear();
    this.targets.length = 0;
    this.struck.length = 0;
  }

  // ===========================================================================================
  // 构造辅助 / 状态查询
  // ===========================================================================================

  private ensureRig(mesh: THREE.Group, config: BossConfig): TempestZeppelinRig {
    const existing = (mesh as TempestZeppelinGroup).zeppelinRig;
    if (existing) return existing;
    // 宿主传入的不是工厂网格：现场构建并把部件移入宿主 Group
    const built = createTempestZeppelinMesh(config) as TempestZeppelinGroup & {
      bossParts?: THREE.Object3D[];
    };
    while (built.children.length > 0) mesh.add(built.children[0]);
    const rig = built.zeppelinRig;
    if (!rig) throw new Error('TempestZeppelinAI: mesh factory produced no rig');
    (mesh as TempestZeppelinGroup & { bossParts?: THREE.Object3D[] }).bossParts = built.bossParts;
    (mesh as TempestZeppelinGroup).zeppelinRig = rig;
    if (mesh.userData.hitRadius === undefined) mesh.userData.hitRadius = built.userData.hitRadius;
    if (!mesh.name) mesh.name = built.name;
    return rig;
  }

  private tuning(): ZeppelinPhaseTuning {
    return PHASE_TUNING[Math.min(PHASE_TUNING.length, Math.max(1, this.phase)) - 1];
  }

  private getAliveCellCount(): number {
    let count = 0;
    for (const cell of this.cells) if (cell.alive) count++;
    return count;
  }

  private getArmorMultiplier(): number {
    const lost = this.cells.length - this.getAliveCellCount();
    let value = 0.35 + 0.06 * lost;
    if (this.phase >= 3) value += 0.1;
    if (this.stunTimer > 0) value += 0.15;
    return Math.min(0.85, value);
  }

  private isAnyCoilCharging(): boolean {
    for (const coil of this.coils) {
      if (coil.phase === 'hum' || coil.phase === 'charge') return true;
    }
    return false;
  }

  private isBarrageCharging(): boolean {
    for (const coil of this.coils) {
      if (coil.barrage && (coil.phase === 'hum' || coil.phase === 'charge')) return true;
    }
    return false;
  }

  private rebuildCollisionParts(): void {
    const parts = this.collisionParts;
    parts.length = 0;
    if (this.deathHandled || this.disposed) return;
    for (const coil of this.coils) {
      if (coil.phase === 'hum' || coil.phase === 'charge') parts.push(coil.rig.cap);
    }
    const hangarExposed = this.hangarAlive && this.hangarOpen >= 0.5;
    if (hangarExposed) parts.push(this.rig.hangar.interior);
    if (this.coreExposed) parts.push(this.rig.core);
    for (const cell of this.cells) if (cell.alive) parts.push(cell.rig.mesh);
    if (this.hangarAlive && !hangarExposed) parts.push(this.rig.hangar.interior);
    if (!this.coreExposed) parts.push(this.rig.core);
    parts.push(this.rig.gondola);
    for (const coil of this.coils) {
      if (coil.phase !== 'hum' && coil.phase !== 'charge') parts.push(coil.rig.cap);
    }
    for (const engine of this.rig.engines) parts.push(engine.nacelle);
    for (const anchor of this.rig.hullAnchors) parts.push(anchor);
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

  /** 闪电可攻击的目标：玩家 + 仍在场景中的友军 */
  private collectTargets(): void {
    this.targets.length = 0;
    if (this.hasPlayer && this.playerMesh) this.targets.push(this.playerMesh);
    for (const friendly of this.friendlyMeshes) {
      if (friendly && friendly.parent && isFiniteVector(friendly.position)) {
        this.targets.push(friendly);
      }
    }
  }

  private warn(label: string): void {
    const last = this.warningTimes.get(label);
    if (last !== undefined && this.time - last < WARNING_THROTTLE) return;
    this.warningTimes.set(label, this.time);
    this.onHazardWarning?.(label);
  }

  private emitCue(cue: TempestZeppelinCue, position: THREE.Vector3, intensity: number): void {
    if (!this.onEffectCue) return;
    this.cuePosition.copy(position);
    this.onEffectCue(cue, this.cuePosition, intensity);
  }

  // ===========================================================================================
  // 航行 / 姿态
  // ===========================================================================================

  private sampleGround(x: number, z: number): number {
    if (!this.groundSampler) return -Infinity;
    const y = this.groundSampler(x, z);
    return Number.isFinite(y) ? y : -Infinity;
  }

  /** 下沉高度下限：地表最高点 + 吊舱离地余量；无采样器时最多比出生高度低 70 米 */
  private getAltitudeFloor(dt: number): number {
    const fallback = this.baseAltitude - FREE_FALL_LIMIT * this.sizeFactor;
    if (!this.groundSampler) return fallback;
    this.groundTimer -= dt;
    if (this.groundTimer <= 0) {
      this.groundTimer = 0.3;
      const p = this.mesh.position;
      const half = this.rig.halfLength * 0.8;
      const sx = Math.sin(this.yaw) * half;
      const sz = Math.cos(this.yaw) * half;
      let highest = this.sampleGround(p.x, p.z);
      highest = Math.max(highest, this.sampleGround(p.x + sx, p.z + sz));
      highest = Math.max(highest, this.sampleGround(p.x - sx, p.z - sz));
      this.groundFloor = Number.isFinite(highest)
        ? highest + this.rig.bottomOffset + 22 * this.sizeFactor
        : -Infinity;
    }
    return Number.isFinite(this.groundFloor)
      ? Math.max(this.groundFloor, this.baseAltitude - 160 * this.sizeFactor)
      : fallback;
  }

  private updateFlight(dt: number, tuning: ZeppelinPhaseTuning): void {
    const position = this.mesh.position;
    const sf = this.sizeFactor;
    if (this.hasPlayer && !this.snappedToPlayer) {
      // 首次看见玩家：侧舷对准玩家，完整展示船身
      this.snappedToPlayer = true;
      const bearing = Math.atan2(this.playerPos.x - position.x, this.playerPos.z - position.z);
      this.yaw = wrapAngle(bearing + Math.PI / 2);
    }

    let desiredYaw = this.yaw;
    let targetSpeed = 0;
    if (this.hasPlayer && this.stunTimer <= 0) {
      this.orbitTimer -= dt;
      if (this.orbitTimer <= 0) {
        this.orbitSign = this.orbitSign > 0 ? -1 : 1;
        this.orbitTimer = 16 + Math.random() * 10;
      }
      // 驻留点：玩家指向飞艇方向上 STATION_RANGE 处，并缓慢绕玩家漂移
      const bearing =
        Math.atan2(position.x - this.playerPos.x, position.z - this.playerPos.z) +
        this.orbitSign * 0.35;
      const range = STATION_RANGE * sf;
      this.tmpA.set(
        this.playerPos.x + Math.sin(bearing) * range,
        0,
        this.playerPos.z + Math.cos(bearing) * range
      );
      this.tmpB.set(this.tmpA.x - this.anchor.x, 0, this.tmpA.z - this.anchor.z);
      const leash = LEASH_RADIUS * sf;
      if (this.tmpB.lengthSq() > leash * leash) {
        this.tmpB.setLength(leash);
        this.tmpA.set(this.anchor.x + this.tmpB.x, 0, this.anchor.z + this.tmpB.z);
      }
      const dx = this.tmpA.x - position.x;
      const dz = this.tmpA.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const toPlayer = Math.atan2(this.playerPos.x - position.x, this.playerPos.z - position.z);
      const broadsideA = wrapAngle(toPlayer + Math.PI / 2);
      const broadsideB = wrapAngle(toPlayer - Math.PI / 2);
      const broadside =
        Math.abs(wrapAngle(broadsideA - this.yaw)) < Math.abs(wrapAngle(broadsideB - this.yaw))
          ? broadsideA
          : broadsideB;
      if (distance > 140 * sf) {
        // 离驻留点较远：艏向驻留点航行，接近时逐渐转回侧舷
        const travel = Math.atan2(dx, dz);
        const blend = THREE.MathUtils.clamp((distance - 140 * sf) / (180 * sf), 0, 1);
        desiredYaw = this.yaw + wrapAngle(travel - this.yaw) * blend;
        desiredYaw += wrapAngle(broadside - desiredYaw) * (1 - blend);
        targetSpeed = this.config.speed * tuning.speedFactor;
      } else {
        desiredYaw = broadside;
        targetSpeed = this.config.speed * 0.35 * tuning.speedFactor;
      }
    }
    const turnRate = Math.max(0.03, this.config.turnSpeed) * tuning.turnFactor;
    const diff = wrapAngle(desiredYaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + THREE.MathUtils.clamp(diff, -turnRate * dt, turnRate * dt));
    if (!Number.isFinite(targetSpeed)) targetSpeed = 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.6);
    position.x += Math.sin(this.yaw) * this.speed * dt;
    position.z += Math.cos(this.yaw) * this.speed * dt;

    // 浮力：每个破裂气囊下沉，阶段 3 继续下沉，低血量时持续坠落
    let sinkTarget = (this.cells.length - this.getAliveCellCount()) * BUOYANCY_PER_CELL * sf;
    if (this.phase >= 3) sinkTarget += PHASE3_SINK * sf;
    if (this.lowHealthReached) {
      this.sink += FALL_RATE * sf * dt;
      sinkTarget = Math.max(sinkTarget, this.sink);
    }
    this.sink += THREE.MathUtils.clamp(sinkTarget - this.sink, -dt * 2, dt * 3.2);
    const floor = this.getAltitudeFloor(dt);
    const bob = Math.sin(this.time * 0.35) * 2.2 * sf;
    let targetY = this.baseAltitude - this.sink + bob;
    if (targetY < floor) {
      targetY = floor + bob * 0.3;
      this.sink = Math.min(this.sink, this.baseAltitude - floor);
    }
    position.y += THREE.MathUtils.clamp(targetY - position.y, -dt * 6, dt * 4);
    if (!isFiniteVector(position)) {
      position.copy(this.anchor);
      this.speed = 0;
    }

    // 横倾 / 纵倾：破裂气囊所在一侧下沉
    let rollTarget = 0;
    let pitchTarget = Math.sin(this.time * 0.27) * 0.012;
    for (const cell of this.cells) {
      if (cell.alive) continue;
      rollTarget += -cell.rig.side * 0.055;
      pitchTarget += Math.sign(cell.rig.z) * 0.032;
    }
    if (this.phase >= 3) {
      rollTarget += Math.sign(rollTarget || 1) * 0.04;
      pitchTarget += 0.04;
    }
    if (this.lowHealthReached) {
      rollTarget += Math.sin(this.time * 0.7) * 0.035;
      pitchTarget += 0.03 + Math.sin(this.time * 0.45) * 0.015;
    }
    rollTarget +=
      -THREE.MathUtils.clamp(diff, -0.5, 0.5) *
      0.06 *
      (this.speed / Math.max(1, this.config.speed));
    this.roll +=
      (THREE.MathUtils.clamp(rollTarget, -0.32, 0.32) - this.roll) * Math.min(1, dt * 0.8);
    this.pitch +=
      (THREE.MathUtils.clamp(pitchTarget, -0.2, 0.25) - this.pitch) * Math.min(1, dt * 0.8);
  }

  private applyTransform(): void {
    this.tmpEuler.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.mesh.quaternion.setFromEuler(this.tmpEuler);
  }

  // ===========================================================================================
  // 战斗
  // ===========================================================================================

  private updateCombat(dt: number, tuning: ZeppelinPhaseTuning): void {
    this.shortedLabelTimer = Math.max(0, this.shortedLabelTimer - dt);
    this.updateTurretAim(dt);
    this.updateCoils(dt);
    this.updateHangar(dt, tuning);
    this.updateShroudZaps(dt, tuning);
    if (this.stunTimer > 0 || !this.hasPlayer) return;
    this.updateCannons(dt, tuning);
    this.updateMissiles(dt, tuning);
    this.updateLash(dt, tuning);
    this.updateBarrage(dt, tuning);
    this.updateShroud(dt, tuning);
    this.updateStormCall(dt, tuning);
  }

  private updateTurretAim(dt: number): void {
    if (!this.hasPlayer) return;
    for (const turret of this.rig.turrets) {
      const parent = turret.yaw.parent;
      if (!parent) continue;
      this.tmpA.copy(this.playerPos);
      parent.worldToLocal(this.tmpA);
      this.tmpA.sub(turret.yaw.position);
      const target = Math.atan2(this.tmpA.x, this.tmpA.z);
      if (!Number.isFinite(target)) continue;
      turret.yaw.rotation.y += wrapAngle(target - turret.yaw.rotation.y) * Math.min(1, dt * 2);
    }
  }

  private updateCannons(dt: number, tuning: ZeppelinPhaseTuning): void {
    this.cannonTimer -= dt;
    if (this.cannonTimer > 0) return;
    this.cannonTimer = Math.max(0.25, this.config.cannonFireInterval * tuning.cannonFactor);
    const turrets = this.rig.turrets;
    for (let attempt = 0; attempt < turrets.length; attempt++) {
      const turret = turrets[(this.turretIndex + attempt) % turrets.length];
      const muzzle = turret.muzzles[this.turretIndex % turret.muzzles.length];
      if (!muzzle) continue;
      muzzle.getWorldPosition(this.tmpA);
      const distance = this.tmpA.distanceTo(this.playerPos);
      if (distance > CANNON_RANGE * this.sizeFactor || distance < 1) continue;
      this.tmpB
        .copy(this.playerPos)
        .addScaledVector(this.playerVel, (distance / 100) * 0.7)
        .sub(this.tmpA)
        .normalize();
      if (!isFiniteVector(this.tmpB)) continue;
      // 炮塔被船体遮挡（目标在炮塔背面的半球）时换下一座
      this.tmpC.copy(turret.outward).applyQuaternion(this.mesh.quaternion);
      if (this.tmpC.dot(this.tmpB) < -0.25) continue;
      this.turretIndex = (this.turretIndex + attempt + 1) % (turrets.length * 2);
      this.fx.emit('createMuzzleFlash', this.tmpA, this.tmpB, 1.6);
      this.onFire?.(this.tmpA.clone(), this.tmpB.clone(), this.config.damage);
      return;
    }
    this.turretIndex = (this.turretIndex + 1) % (turrets.length * 2);
  }

  private updateMissiles(dt: number, tuning: ZeppelinPhaseTuning): void {
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
      this.missileStagger = 0.34;
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
    let target: THREE.Object3D | null = null;
    if (this.missileFired === 1) {
      let best = Infinity;
      for (const friendly of this.friendlyMeshes) {
        if (!friendly || !friendly.parent) continue;
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
    this.fx.emit('createExplosion', this.tmpA, 0.8, 'enemy');
    this.onMissileFired?.();
    this.emitCue('missile-launch', this.tmpA, 0.7);
  }

  // ----- 特斯拉线圈 -----

  private nearestTargetTo(
    point: THREE.Vector3,
    maxRange: number,
    exclude: readonly THREE.Object3D[]
  ): THREE.Object3D | null {
    let best: THREE.Object3D | null = null;
    let bestD = maxRange * maxRange;
    for (const target of this.targets) {
      if (exclude.includes(target)) continue;
      const d = target.position.distanceToSquared(point);
      if (d <= bestD) {
        bestD = d;
        best = target;
      }
    }
    return best;
  }

  private updateLash(dt: number, tuning: ZeppelinPhaseTuning): void {
    this.lashTimer -= dt;
    if (this.lashTimer > 0) return;
    if (this.isBarrageCharging()) {
      this.lashTimer = 1;
      return;
    }
    const range = tuning.lashRange * this.sizeFactor;
    // 选离目标最近的空闲线圈
    let bestCoil: CoilState | null = null;
    let bestTarget: THREE.Object3D | null = null;
    let bestD = Infinity;
    for (const coil of this.coils) {
      if (coil.phase !== 'idle') continue;
      coil.rig.tip.getWorldPosition(this.tmpA);
      const target = this.nearestTargetTo(this.tmpA, range * 1.15, NO_TARGETS);
      if (!target) continue;
      const d = target.position.distanceToSquared(this.tmpA);
      if (d < bestD) {
        bestD = d;
        bestCoil = coil;
        bestTarget = target;
      }
    }
    if (!bestCoil || !bestTarget) {
      this.lashTimer = 0.8;
      return;
    }
    this.lashTimer = tuning.lashInterval * this.cadence;
    this.startCoilCharge(bestCoil, bestTarget, tuning, false);
  }

  private updateBarrage(dt: number, tuning: ZeppelinPhaseTuning): void {
    if (tuning.barrageInterval <= 0) return;
    this.barrageTimer -= dt;
    if (this.barrageTimer > 0) return;
    this.barrageTimer = tuning.barrageInterval * this.cadence;
    let started = 0;
    for (const coil of this.coils) {
      if (coil.phase === 'shorted') continue;
      if (coil.phase === 'hum' || coil.phase === 'charge') this.cancelCoil(coil, 0);
      this.startCoilCharge(coil, this.playerMesh, tuning, true);
      started++;
    }
    if (started > 0) {
      this.lashTimer = Math.max(this.lashTimer, 4);
      this.warn(tr({ en: 'Storm volley', zh: '雷暴齐射' }));
      this.rig.gondola.getWorldPosition(this.tmpA);
      this.emitCue('barrage-charge', this.tmpA, 1);
    }
  }

  private startCoilCharge(
    coil: CoilState,
    target: THREE.Object3D | null,
    tuning: ZeppelinPhaseTuning,
    barrage: boolean
  ): void {
    coil.phase = 'hum';
    coil.timer = 0;
    coil.hum = tuning.lashHum * (barrage ? 0.8 : 1);
    coil.chargeTime = tuning.lashCharge * (barrage ? 1.25 : 1);
    coil.range = tuning.lashRange * this.sizeFactor * (barrage ? 1.25 : 1);
    coil.chains = tuning.lashChains + (barrage ? 1 : 0);
    coil.barrage = barrage;
    coil.target = target;
    coil.shortDamage = 0;
    coil.crackleTimer = 0;
    coil.leaderTimer = 0.3;
    coil.halo.visible = true;
    coil.rig.tip.getWorldPosition(this.tmpA);
    if (!barrage) {
      this.warn(tr({ en: 'Coils charging', zh: '线圈充能' }));
      this.emitCue('coil-charge', this.tmpA, 0.7);
    }
    this.statusKey = -1;
  }

  private cancelCoil(coil: CoilState, cooldown: number): void {
    coil.phase = cooldown > 0 ? 'cooldown' : 'idle';
    coil.timer = cooldown > 0 ? COIL_COOLDOWN - cooldown : 0;
    coil.target = null;
    coil.barrage = false;
    coil.halo.visible = false;
    coil.front.visible = false;
    this.statusKey = -1;
  }

  private updateCoils(dt: number): void {
    for (const coil of this.coils) {
      coil.flash = Math.max(0, coil.flash - dt * 3);
      switch (coil.phase) {
        case 'idle':
          break;
        case 'hum':
          coil.timer += dt;
          if (this.stunTimer > 0) {
            this.cancelCoil(coil, 2);
            break;
          }
          this.updateCrackles(coil, dt, coil.timer / coil.hum, false);
          if (coil.timer >= coil.hum) {
            coil.phase = 'charge';
            coil.timer = 0;
            coil.front.visible = true;
          }
          break;
        case 'charge': {
          coil.timer += dt;
          if (this.stunTimer > 0) {
            this.cancelCoil(coil, 2);
            break;
          }
          const progress = Math.min(1, coil.timer / coil.chargeTime);
          this.updateCrackles(coil, dt, progress, true);
          if (coil.timer >= coil.chargeTime) this.dischargeCoil(coil);
          break;
        }
        case 'cooldown':
          coil.timer += dt;
          if (coil.timer >= COIL_COOLDOWN) {
            coil.phase = 'idle';
            coil.timer = 0;
          }
          break;
        case 'shorted':
          coil.timer += dt;
          // 短路期间零星冒火花
          coil.crackleTimer -= dt;
          if (coil.crackleTimer <= 0) {
            coil.crackleTimer = 0.35 + Math.random() * 0.4;
            coil.rig.cap.getWorldPosition(this.tmpA);
            this.fx.emit('createHit', this.tmpA, 1.2, 'boss');
          }
          if (coil.timer >= COIL_SHORT_TIME) {
            coil.phase = 'idle';
            coil.timer = 0;
          }
          break;
      }
    }
  }

  /** 充能时的环间爬电与伸向目标的先导电流 */
  private updateCrackles(coil: CoilState, dt: number, progress: number, charging: boolean): void {
    const sf = this.sizeFactor;
    coil.crackleTimer -= dt;
    if (coil.crackleTimer <= 0) {
      coil.crackleTimer = charging ? 0.09 + Math.random() * 0.08 : 0.2 + Math.random() * 0.2;
      const ring = coil.rig.rings[Math.floor(Math.random() * coil.rig.rings.length)];
      if (ring) {
        ring.getWorldPosition(this.tmpA);
        coil.rig.cap.getWorldPosition(this.tmpB);
        this.bolts.strike(this.tmpA, this.tmpB, {
          width: (charging ? 1.0 : 0.6) * sf,
          color: BOLT_COLOR,
          life: 0.12,
          jitter: 0.18,
          branches: 0,
          intensity: charging ? 1.3 : 0.8,
        });
      }
    }
    if (!charging) return;
    coil.leaderTimer -= dt;
    if (coil.leaderTimer > 0) return;
    coil.leaderTimer = 0.16 + Math.random() * 0.06;
    coil.rig.tip.getWorldPosition(this.tmpA);
    const target =
      coil.target && (coil.target === this.playerMesh || coil.target.parent)
        ? coil.target
        : this.nearestTargetTo(this.tmpA, coil.range * 1.6, NO_TARGETS);
    if (target) {
      this.tmpB.subVectors(target.position, this.tmpA);
    } else {
      this.tmpB.set(0, coil.rig.dorsal ? 1 : -1, 0).applyQuaternion(this.mesh.quaternion);
    }
    const distance = this.tmpB.length();
    if (distance < 1) return;
    const reach = Math.min(distance, coil.range) * (0.2 + 0.45 * progress);
    this.tmpB.multiplyScalar(reach / distance).add(this.tmpA);
    this.bolts.strike(this.tmpA, this.tmpB, {
      width: 1.7 * sf,
      color: BOLT_COLOR,
      life: 0.16,
      jitter: 0.16,
      branches: 1,
      intensity: 0.9 + 0.6 * progress,
    });
  }

  private dischargeCoil(coil: CoilState): void {
    const sf = this.sizeFactor;
    coil.rig.tip.getWorldPosition(this.tmpA);
    coil.halo.visible = false;
    coil.front.visible = false;
    coil.flash = 1;
    this.struck.length = 0;
    const first = this.nearestTargetTo(this.tmpA, coil.range, this.struck);
    const damage = this.config.damage * (coil.barrage ? 1.1 : 1.25);
    if (first) {
      this.bolts.strike(this.tmpA, first.position, {
        width: 3.4 * sf,
        color: BOLT_COLOR,
        life: 0.38,
        hitWindow: 0.22,
        damage,
        hitRadius: 9 * sf,
        jitter: 0.07,
        branches: 2,
        follow: first,
        intensity: 1.7,
      });
      this.struck.push(first);
      this.fx.emit('createHit', first.position, 2.2, 'enemy');
      // 连锁跳跃：从被击中的目标弹向附近的下一个目标
      let from: THREE.Object3D = first;
      for (let k = 0; k < coil.chains; k++) {
        const next = this.nearestTargetTo(from.position, CHAIN_RANGE * sf, this.struck);
        if (!next) break;
        this.bolts.strike(from.position, next.position, {
          width: 2.6 * sf,
          color: BOLT_COLOR,
          life: 0.34,
          hitWindow: 0.22,
          damage: damage * 0.75,
          hitRadius: 8 * sf,
          jitter: 0.09,
          branches: 1,
          follow: next,
          intensity: 1.5,
        });
        this.struck.push(next);
        from = next;
      }
    } else {
      // 射程内没有目标：劈向空中散掉（纯视觉）
      if (coil.target && isFiniteVector(coil.target.position)) {
        this.tmpB.subVectors(coil.target.position, this.tmpA);
      } else {
        this.tmpB.set(0, coil.rig.dorsal ? 1 : -1, 0).applyQuaternion(this.mesh.quaternion);
      }
      if (this.tmpB.lengthSq() < 1e-4) this.tmpB.set(0, 1, 0);
      this.tmpB.setLength(coil.range * 0.75).add(this.tmpA);
      this.bolts.strike(this.tmpA, this.tmpB, {
        width: 2.8 * sf,
        color: BOLT_COLOR,
        life: 0.32,
        jitter: 0.1,
        branches: 2,
        intensity: 1.4,
      });
    }
    this.fx.emit('createHit', this.tmpA, 2.6, 'enemy');
    this.emitCue('lightning', this.tmpA, coil.barrage ? 1 : 0.85);
    if (coil.barrage) this.weaveArcCage(coil);
    coil.phase = 'cooldown';
    coil.timer = 0;
    coil.barrage = false;
    coil.target = null;
    this.statusKey = -1;
  }

  /** 雷暴齐射：线圈之间沿船体外侧织出带伤害的电网（只在齐射的最后一座线圈放电时触发一次） */
  private weaveArcCage(source: CoilState): void {
    for (const coil of this.coils) {
      if (coil !== source && coil.barrage && coil.phase === 'charge') return;
    }
    const [dorsalFore, dorsalAft, ventralBow, ventralStern] = this.coils;
    if (!dorsalFore || !dorsalAft || !ventralBow || !ventralStern) return;
    // 背部两座之间（船背上方）、腹部两座之间（吊舱下方）各一道
    this.cageArc(dorsalFore.rig.tip, dorsalAft.rig.tip, null);
    this.cageArc(ventralBow.rig.tip, ventralStern.rig.tip, null);
    // 两舷：背部线圈经舷侧外的拐点连到腹部线圈，绕开船体
    const r = this.rig.hullRadius;
    this.tmpC.set(r * 1.75, 0, this.rig.halfLength * 0.45);
    this.cageArc(dorsalFore.rig.tip, ventralBow.rig.tip, this.tmpC);
    this.tmpC.set(-r * 1.75, 0, -this.rig.halfLength * 0.45);
    this.cageArc(dorsalAft.rig.tip, ventralStern.rig.tip, this.tmpC);
    this.mesh.getWorldPosition(this.tmpC);
    this.fx.emit('createShockwave', this.tmpC, this.rig.halfLength * 1.4, 0.8, 0x9fd8ff, 0.8);
  }

  /** 一段电网：a → (可选局部拐点) → b */
  private cageArc(a: THREE.Object3D, b: THREE.Object3D, localWaypoint: THREE.Vector3 | null): void {
    const sf = this.sizeFactor;
    const options = {
      width: 2.6 * sf,
      color: 0xc8e8ff,
      life: 0.9,
      hitWindow: 0.75,
      damage: this.config.damage * 0.9,
      hitRadius: 10 * sf,
      jitter: 0.08,
      branches: 1,
      intensity: 1.5,
    };
    a.getWorldPosition(this.tmpA);
    b.getWorldPosition(this.tmpB);
    if (!localWaypoint) {
      this.bolts.strike(this.tmpA, this.tmpB, options);
      return;
    }
    this.tmpD.copy(localWaypoint);
    this.mesh.localToWorld(this.tmpD);
    this.bolts.strike(this.tmpA, this.tmpD, options);
    this.bolts.strike(this.tmpD, this.tmpB, options);
  }

  private shortCoil(coil: CoilState): void {
    coil.phase = 'shorted';
    coil.timer = 0;
    coil.target = null;
    coil.barrage = false;
    coil.halo.visible = false;
    coil.front.visible = false;
    coil.flash = 1;
    coil.crackleTimer = 0.2;
    this.shortedLabelTimer = 2.5;
    coil.rig.cap.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 1.3, 'enemy');
    this.fx.emit('createEmpBurst', this.tmpA, 26 * this.sizeFactor);
    // 电流倒灌进船体：一道打回艇身的闪电（纯视觉）
    this.mesh.getWorldPosition(this.tmpB);
    this.bolts.strike(this.tmpA, this.tmpB, {
      width: 2.4 * this.sizeFactor,
      color: 0xffffff,
      life: 0.3,
      jitter: 0.12,
      branches: 2,
      intensity: 1.4,
    });
    this.emitCue('coil-short', this.tmpA, 1);
    this.statusKey = -1;
  }

  // ----- 雷暴云层 -----

  private updateShroud(dt: number, tuning: ZeppelinPhaseTuning): void {
    this.shroudTimer -= dt;
    if (this.shroudTimer > 0 || this.shroud.isBusy()) return;
    this.shroudTimer = tuning.shroudInterval * this.cadence + tuning.shroudDuration;
    if (this.shroud.start(tuning.shroudDuration)) {
      this.warn(tr({ en: 'Storm cloud · Keep away from the airship', zh: '雷暴云层 · 远离飞艇' }));
      this.emitCue('shroud', this.mesh.position, 0.8);
    }
  }

  private updateShroudZaps(dt: number, tuning: ZeppelinPhaseTuning): void {
    if (!this.shroud.isCharged() || this.stunTimer > 0) return;
    this.shroudZapTimer -= dt;
    if (this.shroudZapTimer > 0) return;
    this.shroudZapTimer = tuning.shroudZap;
    const sf = this.sizeFactor;
    let zapped = false;
    for (const target of this.targets) {
      this.tmpA.copy(target.position);
      this.mesh.worldToLocal(this.tmpA);
      if (!this.shroud.containsLocal(this.tmpA, 6 * sf)) continue;
      this.shroud.nearestPuffLocal(this.tmpA, this.tmpB);
      this.mesh.localToWorld(this.tmpB);
      this.bolts.strike(this.tmpB, target.position, {
        width: 2.4 * sf,
        color: 0xbfe2ff,
        life: 0.3,
        hitWindow: 0.2,
        damage: this.config.damage * 0.8,
        hitRadius: 8 * sf,
        jitter: 0.1,
        branches: 2,
        follow: target,
        intensity: 1.5,
      });
      zapped = true;
    }
    // 云团之间的装饰闪电
    if (Math.random() < 0.6) {
      this.tmpA.set(
        (Math.random() - 0.5) * this.rig.hullRadius * 3,
        this.rig.hullRadius * (0.6 + Math.random()),
        (Math.random() - 0.5) * this.rig.halfLength * 1.6
      );
      this.shroud.nearestPuffLocal(this.tmpA, this.tmpB);
      this.tmpC.copy(this.tmpA).multiplyScalar(-0.6);
      this.shroud.nearestPuffLocal(this.tmpC, this.tmpD);
      this.mesh.localToWorld(this.tmpB);
      this.mesh.localToWorld(this.tmpD);
      this.bolts.strike(this.tmpB, this.tmpD, {
        width: 1.6 * sf,
        color: 0xbfe2ff,
        life: 0.22,
        jitter: 0.12,
        branches: 1,
        intensity: 1.1,
      });
    }
    if (zapped) this.emitCue('lightning', this.mesh.position, 0.6);
  }

  // ----- 召雷 -----

  private updateStormCall(dt: number, tuning: ZeppelinPhaseTuning): void {
    if (tuning.stormInterval <= 0 || tuning.stormCount <= 0) return;
    this.stormTimer -= dt;
    if (this.stormTimer > 0) return;
    this.stormTimer = tuning.stormInterval * this.cadence;
    this.castStormCall(tuning);
  }

  private castStormCall(tuning: ZeppelinPhaseTuning): void {
    const sf = this.sizeFactor;
    const warn = tuning.stormWarn;
    this.tmpA.copy(this.playerPos).addScaledVector(this.playerVel, warn * 0.85);
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
    const topY = Math.max(this.mesh.position.y + 150 * sf, this.playerPos.y + 170 * sf);
    const radius = 16 * sf;
    let spawned = 0;
    for (let k = 0; k < tuning.stormCount; k++) {
      this.tmpD.copy(this.tmpA);
      if (tuning.stormLine) {
        const along = (k - (tuning.stormCount - 1) / 2) * 46 * sf;
        this.tmpD.addScaledVector(this.tmpB, along);
        this.tmpD.addScaledVector(this.tmpC, (Math.random() - 0.5) * 16 * sf);
      } else if (k > 0) {
        const angle = Math.random() * Math.PI * 2;
        const r = (42 + Math.random() * 46) * sf;
        this.tmpD.x += Math.cos(angle) * r;
        this.tmpD.z += Math.sin(angle) * r;
      }
      const ground = this.sampleGround(this.tmpD.x, this.tmpD.z);
      const bottomY = Number.isFinite(ground) ? ground : Math.max(-48, this.playerPos.y - 260 * sf);
      if (
        this.strikes.spawn(this.tmpD.x, this.tmpD.z, {
          radius,
          warnTime: warn + k * 0.1,
          damage: this.config.damage * 1.3,
          topY,
          bottomY,
          markerY: this.playerPos.y,
        })
      ) {
        spawned++;
      }
    }
    if (spawned > 0) {
      if (this.stormWaves % 2 === 0) {
        this.warn(tr({ en: 'Lightning strike warning', zh: '召雷预警' }));
      }
      this.stormWaves++;
      this.emitCue('storm-call', this.tmpA, 0.8);
    }
  }

  private handleStormStrike(
    _top: THREE.Vector3,
    bottom: THREE.Vector3,
    marker: THREE.Vector3
  ): void {
    this.fx.emit('createHit', marker, 2.4, 'enemy');
    this.fx.emit('createGroundImpact', bottom, 1.6, 'rock');
    this.fx.emit('createShockwave', bottom, 40 * this.sizeFactor, 0.6, 0x9fd8ff, 0.7);
    this.emitCue('storm-strike', marker, 0.9);
  }

  // ----- 无人机舱 -----

  private updateHangar(dt: number, tuning: ZeppelinPhaseTuning): void {
    this.hangarTimer += dt;
    let target = 0;
    switch (this.hangarPhase) {
      case 'closed':
        if (
          this.hangarAlive &&
          tuning.hangarInterval > 0 &&
          this.hasPlayer &&
          this.stunTimer <= 0
        ) {
          this.hangarCycleTimer -= dt;
          if (this.hangarCycleTimer <= 0) this.openHangar(tuning);
        }
        break;
      case 'opening':
        target = 1;
        if (this.hangarTimer >= HANGAR_OPEN_TIME) {
          this.hangarPhase = 'launching';
          this.hangarTimer = 0;
          this.droneStagger = 0;
        }
        break;
      case 'launching':
        target = 1;
        this.droneStagger -= dt;
        if (this.dronesQueued > 0 && this.droneStagger <= 0) {
          this.droneStagger = DRONE_STAGGER;
          this.launchDrone();
          this.dronesQueued--;
        }
        if (this.dronesQueued <= 0) {
          this.hangarPhase = 'holding';
          this.hangarTimer = 0;
        }
        break;
      case 'holding':
        target = 1;
        if (this.hangarTimer >= HANGAR_HOLD_TIME) {
          this.hangarPhase = 'closing';
          this.hangarTimer = 0;
        }
        break;
      case 'closing':
        if (this.hangarTimer >= HANGAR_CLOSE_TIME) {
          this.hangarPhase = 'closed';
          this.hangarTimer = 0;
          this.hangarCycleTimer = tuning.hangarInterval;
        }
        break;
    }
    if (!this.hangarAlive) target = 0;
    const rate = target > this.hangarOpen ? dt / (HANGAR_OPEN_TIME * 0.8) : dt / HANGAR_CLOSE_TIME;
    this.hangarOpen += THREE.MathUtils.clamp(target - this.hangarOpen, -rate, rate);
  }

  private openHangar(tuning: ZeppelinPhaseTuning): void {
    this.hangarPhase = 'opening';
    this.hangarTimer = 0;
    this.dronesQueued = tuning.droneCount;
    this.warn(tr({ en: 'Drone bay open', zh: '无人机舱开启' }));
    this.rig.hangar.launchPoint.getWorldPosition(this.tmpA);
    this.emitCue('hangar-open', this.tmpA, 0.8);
    this.statusKey = -1;
  }

  private launchDrone(): void {
    const launch = this.rig.hangar.launchPoint;
    launch.getWorldPosition(this.tmpA);
    const spread = (Math.random() - 0.5) * 18 * this.sizeFactor;
    const position = new THREE.Vector3(
      this.tmpA.x + Math.cos(this.yaw) * spread,
      this.tmpA.y - 6 * this.sizeFactor,
      this.tmpA.z - Math.sin(this.yaw) * spread
    );
    this.fx.emit('createHit', this.tmpA, 1.4, 'enemy');
    this.onSpawnMinion?.(position, 'drone');
    this.emitCue('drone-launch', this.tmpA, 0.5);
  }

  private destroyHangar(): void {
    if (!this.hangarAlive) return;
    this.hangarAlive = false;
    this.hangarHp = 0;
    this.hangarSubTarget.current = 0;
    this.dronesQueued = 0;
    this.hangarPhase = 'closed';
    this.hangarCycleTimer = Infinity;
    const hangar = this.rig.hangar;
    hangar.interior.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 2.4, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 2.2, 'boss-armor');
    for (const door of hangar.doors) door.visible = false;
    hangar.interiorMaterial.emissive.set(0xff5a1a);
    this.emitCue('hangar-destroyed', this.tmpA, 1);
    this.statusKey = -1;
  }

  // ===========================================================================================
  // 气囊 / 阶段 / 死亡
  // ===========================================================================================

  private burstCell(cell: CellState): void {
    if (!cell.alive) return;
    cell.alive = false;
    cell.hp = 0;
    cell.subTarget.current = 0;
    cell.rig.mesh.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 2.6, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 2.0, 'boss-armor');
    this.fx.emit('createShockwave', this.tmpA, 45 * this.sizeFactor, 0.6, 0xffa04a, 0.8);
    cell.rig.fire.visible = true;
    cell.rig.material.emissive.set(0xff5a14);
    this.emitCue('cell-burst', this.tmpA, 1);
    this.statusKey = -1;
  }

  private evaluatePhase(): void {
    if (!this.isAlive()) return;
    const ratio = this.health.getCurrentHealth() / Math.max(1, this.health.getMaxHealth());
    const lost = this.cells.length - this.getAliveCellCount();
    let target = 1;
    if (ratio <= PHASE3_RATIO || lost >= PHASE3_CELLS_LOST) target = 3;
    else if (ratio <= PHASE2_RATIO || lost >= PHASE2_CELLS_LOST) target = 2;
    while (this.phase < target && !this.disposed) this.enterPhase(this.phase + 1);
    if (!this.lowHealthReached && ratio <= LOW_HEALTH_RATIO) {
      this.lowHealthReached = true;
      this.statusKey = -1;
      this.mesh.getWorldPosition(this.tmpA);
      this.emitCue('listing', this.tmpA, 1);
    }
  }

  private enterPhase(phase: number): void {
    this.phase = Math.min(PHASE_COUNT, phase);
    const sf = this.sizeFactor;
    const label =
      this.phase === 2
        ? tr({ en: 'Gas cells ruptured · Drones launching', zh: '气囊破裂 · 无人机升空' })
        : tr({ en: 'Lift failing · Storm core exposed', zh: '浮力失控 · 风暴核心暴露' });
    this.mesh.getWorldPosition(this.tmpA);
    if (this.phase === 2) {
      this.hangarCycleTimer = 1.5;
      this.stormTimer = 5;
    } else {
      this.exposeCore();
      this.barrageTimer = 5;
      this.stormTimer = Math.min(this.stormTimer, 3);
      this.shroudTimer = Math.min(this.shroudTimer, 8);
    }
    // 风暴涌动：所有线圈同时朝天放电 + 扩散电环（纯视觉）
    for (const coil of this.coils) {
      coil.flash = 1;
      coil.rig.tip.getWorldPosition(this.tmpB);
      this.tmpC.set(0, coil.rig.dorsal ? 1 : -1, 0).applyQuaternion(this.mesh.quaternion);
      this.tmpC.multiplyScalar(140 * sf).add(this.tmpB);
      this.tmpC.x += (Math.random() - 0.5) * 60 * sf;
      this.tmpC.z += (Math.random() - 0.5) * 60 * sf;
      this.bolts.strike(this.tmpB, this.tmpC, {
        width: 3.4 * sf,
        color: BOLT_COLOR,
        life: 0.5,
        jitter: 0.08,
        branches: 2,
        intensity: 1.8,
      });
    }
    this.rings.spawn(this.tmpA, {
      maxRadius: 260 * sf,
      duration: 1.6,
      wallHeight: 10 * sf,
      bandWidth: 8 * sf,
      damage: 0,
      profile: 'laser',
      color: 0x8fd8ff,
      opacity: 0.7,
    });
    this.fx.emit('createShockwave', this.tmpA, 200 * sf, 1.1, 0x8fd8ff, 0.85);
    this.statusKey = -1;
    this.rebuildCollisionParts();
    this.emitCue('phase', this.tmpA, 1);
    this.onPhaseChange?.(this.phase, label);
  }

  private exposeCore(): void {
    if (this.coreExposed) return;
    this.coreExposed = true;
    for (const plate of this.rig.keelPlates) {
      if (!plate.visible) continue;
      plate.visible = false;
      plate.getWorldPosition(this.tmpB);
      this.fx.emit('createExplosion', this.tmpB, 1.8, 'enemy');
      this.fx.emit('createHit', this.tmpB, 2, 'boss');
    }
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
      this.deathFallSpeed = 0;
      this.breakPoint.set(0, 0, this.rig.breakZ);
      this.mesh.getWorldPosition(this.tmpA);
      this.emitCue('crash', this.tmpA, 1);
      return;
    }
    this.finishDeath();
  }

  private clearHazards(): void {
    this.bolts.clear();
    this.strikes.clear();
    this.rings.clear();
    this.shroud.stop();
    this.missileCharge = 0;
    this.missileQueue = 0;
    this.dronesQueued = 0;
    for (const coil of this.coils) {
      coil.phase = 'idle';
      coil.halo.visible = false;
      coil.front.visible = false;
      coil.target = null;
    }
  }

  private updateDeathSequence(dt: number): void {
    this.deathTimer += dt;
    const p = Math.min(1, this.deathTimer / DEATH_SEQUENCE_DURATION);
    const sf = this.sizeFactor;
    // 下坠：加速下落，脊梁在断点折断，艏艉各自下垂
    this.deathFallSpeed = Math.min(42 * sf, this.deathFallSpeed + 9.8 * 0.55 * dt);
    const floor = this.getAltitudeFloor(dt) - 40 * sf;
    const position = this.mesh.position;
    position.y = Math.max(floor, position.y - this.deathFallSpeed * dt);
    position.x += Math.sin(this.yaw) * this.speed * 0.5 * dt;
    position.z += Math.cos(this.yaw) * this.speed * 0.5 * dt;
    const bend = Math.min(1, p * 1.5);
    const eased = bend * bend * (3 - 2 * bend);
    this.bendSection(this.rig.bow, 0.32 * eased);
    this.bendSection(this.rig.stern, -0.26 * eased);
    this.pitch += (0.18 - this.pitch) * Math.min(1, dt * 0.8);
    this.roll += (Math.sign(this.roll || 1) * 0.3 - this.roll) * Math.min(1, dt * 0.6);
    this.applyTransform();
    this.mesh.updateMatrixWorld(true);

    // 剩余气囊依次破裂，船体闪烁
    const materials = this.rig.materials;
    const flicker = Math.max(0, 1 - p) * (0.5 + 0.5 * Math.sin(this.time * 31));
    materials.glowStrip.emissiveIntensity = 2.6 * flicker;
    materials.window.emissiveIntensity = 1.8 * flicker;
    for (const engine of this.rig.engines) engine.prop.rotation.z += dt * 6 * (1 - p);
    this.deathBurstTimer -= dt;
    if (this.deathBurstTimer <= 0) {
      this.deathBurstTimer = 0.24;
      const alive = this.cells.find((cell) => cell.alive);
      if (alive && Math.random() < 0.45) {
        this.burstCell(alive);
      } else {
        this.tmpA.set(
          (Math.random() - 0.5) * this.rig.hullRadius * 1.6,
          (Math.random() - 0.3) * this.rig.hullRadius,
          (Math.random() - 0.5) * this.rig.halfLength * 1.6
        );
        this.mesh.localToWorld(this.tmpA);
        this.fx.emit('createExplosion', this.tmpA, 1.6 + p * 1.2, 'enemy');
        if (Math.random() < 0.4) {
          this.tmpB.copy(this.tmpA);
          this.tmpB.y += 20 * sf;
          this.bolts.strike(this.tmpA, this.tmpB, {
            width: 1.8 * sf,
            color: BOLT_COLOR,
            life: 0.2,
            jitter: 0.2,
            branches: 1,
          });
        }
      }
    }
    this.updateCellVisuals(dt);
    if (p >= 1) this.finishDeath();
  }

  /** 绕断点（局部 X 轴）旋转某一段艇体，断点保持不动 */
  private bendSection(section: THREE.Group, angle: number): void {
    this.tmpQuat.setFromAxisAngle(X_AXIS, angle);
    section.quaternion.copy(this.tmpQuat);
    this.tmpD.copy(this.breakPoint).applyQuaternion(this.tmpQuat);
    section.position.copy(this.breakPoint).sub(this.tmpD);
  }

  private finishDeath(): void {
    this.dying = false;
    this.mesh.updateMatrixWorld(true);
    this.mesh.getWorldPosition(this.tmpA);
    if (!isFiniteVector(this.tmpA)) this.tmpA.copy(this.anchor);
    const position = this.tmpA.clone();
    this.onDestroy?.(position, this.config);
    // 收尾爆炸：在控制器清理粒子之后追加
    const sf = this.sizeFactor;
    this.fx.emit('createBossDeathExplosion', position, 2.2);
    this.fx.emit('createShockwave', position, 240 * sf, 1.6, 0x9fd8ff, 0.9);
    this.fx.emit('createShockwave', position, 150 * sf, 1.0, 0xffb060, 0.85);
    for (let i = -1; i <= 1; i++) {
      this.tmpB.set(
        position.x + Math.sin(this.yaw) * i * 60 * sf,
        position.y,
        position.z + Math.cos(this.yaw) * i * 60 * sf
      );
      this.fx.emit('createExplosion', this.tmpB, 2.2, 'enemy');
    }
    this.emitCue('crash', position, 1);
  }

  // ===========================================================================================
  // 视觉
  // ===========================================================================================

  private updateHazards(dt: number): void {
    this.bolts.update(dt);
    this.strikes.update(dt);
    this.rings.update(dt);
    this.shroud.update(dt);
  }

  private updateCellVisuals(dt: number): void {
    const t = this.time;
    for (const cell of this.cells) {
      const rig = cell.rig;
      if (cell.alive) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.1 + rig.index * 1.3);
        rig.material.emissiveIntensity = 1.25 + 0.45 * pulse + this.hitFlash * 1.2;
        rig.glow.material.opacity = 0.32 + 0.18 * pulse;
        continue;
      }
      // 泄气：缩成干瘪的残骸，火焰与浓烟从破口喷出
      cell.deflate = Math.min(1, cell.deflate + dt * 1.2);
      const k = 1 - 0.62 * cell.deflate;
      rig.mesh.scale.set(
        rig.baseScale.x * k,
        rig.baseScale.y * (1 - 0.45 * cell.deflate),
        rig.baseScale.z * (1 - 0.25 * cell.deflate)
      );
      rig.material.emissiveIntensity = 0.5 + 0.35 * Math.abs(Math.sin(t * 9 + rig.index));
      rig.glow.material.opacity = Math.max(0, 0.4 * (1 - cell.deflate));
      const flicker = 0.75 + 0.25 * Math.sin(t * 23 + rig.index * 2.3);
      rig.fire.material.opacity = 0.85 * flicker;
      const size = (4.2 + 1.4 * Math.sin(t * 13 + rig.index)) * this.rig.scale;
      rig.fire.scale.set(size, size * 1.35, 1);
      cell.smokeTimer -= dt;
      if (cell.smokeTimer <= 0) {
        cell.smokeTimer = 0.3 + Math.random() * 0.12;
        rig.fire.getWorldPosition(this.tmpA);
        this.fx.emit('createDamageSmoke', this.tmpA, 0.85);
      }
    }
  }

  /**
   * 射程光环：始终朝向镜头的圆环，直径 = 2 × 射程（即放电球射程球的轮廓）；
   * 充能波前从放电球向外扩张，抵达外环的瞬间放电。
   */
  private placeHalo(coil: CoilState, opacity: number, progress: number): void {
    coil.rig.cap.getWorldPosition(this.tmpA);
    const diameter = coil.range * 2;
    // 齐射时四座线圈的光环叠在一起，单个光环减弱避免泛光糊屏
    const dim = coil.barrage ? 0.4 : 1;
    coil.halo.position.copy(this.tmpA);
    coil.halo.scale.set(diameter, diameter, 1);
    coil.halo.material.opacity = Math.min(1, opacity * dim);
    if (coil.phase !== 'charge') {
      coil.front.visible = false;
      return;
    }
    coil.front.visible = true;
    coil.front.position.copy(this.tmpA);
    const front = Math.max(0.04, progress * progress) * diameter;
    coil.front.scale.set(front, front, 1);
    coil.front.material.opacity = (0.35 + 0.55 * progress) * dim;
  }

  private updateVisuals(dt: number): void {
    const t = this.time;
    const materials = this.rig.materials;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.updateCellVisuals(dt);

    // 线圈：嗡鸣时环光渐亮；充能时放电球发蓝光、射程光环收拢
    let charging = 0;
    for (const coil of this.coils) {
      const rig = coil.rig;
      let ring = 0.55 + 0.15 * Math.sin(t * 3 + rig.index);
      let cap = 0.8 + 0.2 * Math.sin(t * 4.3 + rig.index);
      let glowSize = 3.6;
      let glowOpacity = 0.3;
      if (coil.phase === 'hum') {
        const h = Math.min(1, coil.timer / coil.hum);
        ring = 0.8 + 1.6 * h + 0.3 * Math.sin(t * 22);
        cap = 1 + 1.5 * h;
        glowSize = 4 + 2 * h;
        glowOpacity = 0.35 + 0.2 * h;
        charging = Math.max(charging, 0.3 * h);
        // 嗡鸣阶段先淡淡画出射程光环（预警的预警）
        this.placeHalo(coil, 0.12 + 0.18 * h, 1);
      } else if (coil.phase === 'charge') {
        const c = Math.min(1, coil.timer / coil.chargeTime);
        const fast = 0.5 + 0.5 * Math.sin(t * (18 + 30 * c));
        ring = 2.6 + 2.4 * c + fast;
        cap = 3 + 5 * c + 1.5 * fast;
        glowSize = 6 + 7 * c + fast;
        glowOpacity = 0.55 + 0.4 * c;
        charging = Math.max(charging, 0.4 + 0.6 * c);
        this.placeHalo(coil, (0.35 + 0.5 * c) * (0.8 + 0.2 * fast), c);
      } else if (coil.phase === 'shorted') {
        const sputter = Math.random() < 0.25 ? 1 : 0;
        ring = 0.15 + sputter * 1.5;
        cap = 0.1 + sputter * 2.5;
        glowOpacity = 0.1 + sputter * 0.4;
      }
      if (this.stunTimer > 0) {
        ring *= 0.2;
        cap *= 0.2;
        glowOpacity *= 0.3;
      }
      ring += coil.flash * 4;
      cap += coil.flash * 6;
      rig.ringMaterial.emissiveIntensity = ring;
      rig.capMaterial.emissiveIntensity = cap;
      const size = (glowSize + coil.flash * 6) * this.rig.scale;
      rig.glow.scale.set(size, size, 1);
      rig.glow.material.opacity = Math.min(1, glowOpacity + coil.flash * 0.5);
    }

    // 电光带：线圈充能时电力被抽走而闪烁；阶段 3 不规则闪烁
    const unstable = this.phase >= 3 ? 0.65 + 0.35 * Math.sin(t * 17) * Math.sin(t * 5.3) : 1;
    const drain = 1 - 0.45 * charging * (0.5 + 0.5 * Math.sin(t * 40));
    const stun = this.stunTimer > 0 ? 0.25 + 0.5 * Math.abs(Math.sin(t * 19)) : 1;
    materials.glowStrip.emissiveIntensity =
      (1.8 + 0.3 * Math.sin(t * 1.6)) * unstable * drain * stun;
    materials.window.emissiveIntensity = (1.6 + 0.2 * Math.sin(t * 0.9)) * stun;
    materials.envelope.emissiveIntensity = 0.45 + this.hitFlash * 0.7;
    materials.engineRing.emissiveIntensity = (1.6 + 0.4 * Math.sin(t * 7)) * stun;
    materials.rodTip.emissiveIntensity = 1.8 + 1.2 * charging + 0.4 * Math.sin(t * 5);

    // 导弹井充能
    const missileCharge =
      this.missileCharge > 0
        ? 1 - this.missileCharge / MISSILE_CHARGE
        : this.missileQueue > 0
          ? 1
          : 0;
    materials.missileCell.emissiveIntensity = 0.5 + missileCharge * 4;

    // 风暴核心：阶段 3 暴露后剧烈脉动
    const coreBase = this.coreExposed ? 2.6 + 1.4 * Math.sin(t * 6) : 0.9 + 0.2 * Math.sin(t * 2);
    materials.core.emissiveIntensity = coreBase + charging * 1.5;
    this.rig.coreGlow.material.opacity = this.coreExposed ? 0.55 + 0.25 * Math.sin(t * 6) : 0.12;

    // 引擎：螺旋桨与尾焰
    const thrust = 0.5 + Math.min(1, Math.abs(this.speed) / Math.max(1, this.config.speed));
    for (const engine of this.rig.engines) {
      engine.prop.rotation.z += dt * (5 + 7 * thrust) * (this.stunTimer > 0 ? 0.3 : 1);
      engine.exhaust.material.opacity = (0.28 + 0.12 * Math.sin(t * 11 + engine.index)) * thrust;
    }

    // 无人机舱：舱门、舱内灯光与旋转信标
    const hangar = this.rig.hangar;
    for (let i = 0; i < hangar.doors.length; i++) {
      const side = i === 0 ? 1 : -1;
      hangar.doors[i].rotation.z = side * this.hangarOpen * 1.75;
    }
    const busy = this.hangarPhase !== 'closed';
    if (this.hangarAlive) {
      hangar.interiorMaterial.emissiveIntensity =
        0.25 + this.hangarOpen * (2.4 + 0.6 * Math.sin(t * 10)) + this.hitFlash * 0.5;
      const blink = busy ? (Math.sin(t * 9) > 0 ? 1 : 0.15) : 0.15;
      hangar.beaconMaterial.emissiveIntensity = 0.4 + blink * 3;
      for (const beacon of hangar.beacons) beacon.material.opacity = busy ? 0.75 * blink : 0;
    } else {
      // 被毁：舱内持续燃烧
      hangar.interiorMaterial.emissiveIntensity = 1.6 + 1.2 * Math.abs(Math.sin(t * 8.3));
      hangar.beaconMaterial.emissiveIntensity = 0.2;
      for (const beacon of hangar.beacons) {
        beacon.material.color.set(0xff6a1a);
        beacon.material.opacity = 0.5 + 0.3 * Math.sin(t * 12);
      }
    }

    // 航行灯频闪
    this.strobeTimer += dt;
    this.rig.navLights.visible = this.strobeTimer % 1.4 < 0.9;

    // 阶段 3 / 低血量：船体零星起火冒烟
    if (this.phase >= 3) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.lowHealthReached ? 0.22 : 0.5;
        this.tmpA.set(
          (Math.random() - 0.5) * this.rig.hullRadius * 1.4,
          (Math.random() - 0.5) * this.rig.hullRadius * 1.2,
          (Math.random() - 0.5) * this.rig.halfLength * 1.5
        );
        this.mesh.localToWorld(this.tmpA);
        this.fx.emit('createDamageSmoke', this.tmpA, this.lowHealthReached ? 1 : 0.6);
        if (Math.random() < 0.25) this.fx.emit('createHit', this.tmpA, 1.4, 'enemy');
      }
    }
  }
}
