import * as THREE from 'three';
import { BOSS_CONFIGS, BossType, type BossConfig } from './BossTypes';
import { BossMissileSystem, type BossMissileFlightProfile } from './BossMissileSystem';
import type { BossHazardHit, BossMinionKind, BossSubTarget, IAdvancedBoss } from './BossContracts';
import { HealthSystem } from '@/features/combat/HealthSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import { getLocale, tr, type Locale, type LocalizedText } from '@/i18n';
import {
  createHazardProbe,
  disposeObjectTree,
  isFiniteVector,
  resetHazardProbe,
  resolveMissileParticles,
} from './MagmaColossusHazards';
import { BossParticleFx } from './TempestZeppelinFx';
import { HoloTracerPool, PhantomLance, type LanceSpec } from './PhantomWingFx';
import { WingFlight } from './PhantomWingFlight';
import {
  createPhantomDecoyMaterials,
  createPhantomDecoyMesh,
  createPhantomWingMesh,
  type PhantomDecoyMaterials,
  type PhantomDecoyRig,
  type PhantomEmitterRig,
  type PhantomWingGroup,
  type PhantomWingRig,
} from './PhantomWingMesh';

export { createPhantomWingMesh } from './PhantomWingMesh';

/**
 * 第九关 Boss「幻影之翼」PHANTOM WING —— 守卫天梯的隐形飞翼王牌。
 *
 * 机制：
 * - 空战：以约 260 米半径绕玩家盘旋，周期性做机炮对头 / 侧后攻击（onFire 短连射），
 *   腹部导弹舱开舱（×2.0）发射 BossMissileSystem 导弹。
 * - 隐形循环：可见一段时间后，六边形相位网格从机头扫到机尾，机体淡出（隐形时无敌、
 *   不可锁定、只保留极淡的轮廓光与红色尾焰闪烁）；隐形期间绕玩家侧移 40°～75° 潜行，
 *   进入约 380 米后现形（现形前 1.1 秒网格反向扫过并播报），随后发动伏击。
 *   EMP（applyStun / applyEmpPulse）强制现形并打散诱饵。
 * - 激光长矛（一击脱离）：先顺航向拉开到约 400 米、大过载回转对准玩家，画出红色危险航道
 *   （管道 + 边线 + 滚动箭头），预警结束后沿航道高速俯冲并持续发射光束；离开航道即可躲开。
 *   接近到 130 米内提前收束拉起。充能 / 开火时机头棱镜为弱点（×2.2）。
 * - 防撞：按相对速度预测最近距离，小于 70 米时急转错开（不会贴脸穿模）。
 * - 翼尖两枚相位发射器（子目标 ×1.8）：每毁一枚隐形更淡、诱饵上限更低；两枚全毁后无法完全隐形。
 * - 阶段 2（≤ 66%）：投射全息诱饵（与真身外形一致，尾焰为青色，射出无害的全息曳光，一击即散）；
 *   现形伏击在长矛突击与机炮对头之间交替。
 * - 阶段 3（≤ 33%）：超频——更快更灵活、长矛连续两次、3 个诱饵、隐形时间缩短；
 *   血量 < 25% 时隐形涂层剥落，隐形失败（不再无敌）。
 * - 死亡：默认归零同步 onDestroy；setDeathSequenceEnabled(true) 后先螺旋坠落约 4 秒。
 */

export type PhantomWingCue =
  | 'cloak'
  | 'decloak'
  | 'cannon'
  | 'lance-charge'
  | 'lance-fire'
  | 'missile-launch'
  | 'decoys'
  | 'decoy-pop'
  | 'emitter-destroyed'
  | 'cloak-fail'
  | 'overdrive'
  | 'phase'
  | 'crash';

type Maneuver =
  | 'orbit'
  | 'gun-pass'
  | 'extend'
  | 'lance-setup'
  | 'lance-telegraph'
  | 'lance-fire'
  | 'lance-recover'
  | 'stalk'
  | 'stunned';
type CloakPhase = 'visible' | 'cloaking' | 'cloaked' | 'decloaking';
type PartRole = 'body' | 'prism' | 'emitter' | 'bay' | 'nozzle' | 'decoy';
type DecoyMode = 'orbit' | 'pass' | 'extend';

interface PhantomPhaseTuning {
  cruise: number;
  strafe: number;
  turn: number;
  visibleTime: number;
  cloakTime: number;
  lanceInterval: number;
  lanceTelegraph: number;
  lanceFire: number;
  lanceChain: number;
  burstShots: number;
  burstGap: number;
  missileFactor: number;
  missileCount: number;
  decoyCount: number;
  decoyInterval: number;
}

const PHASE_TUNING: readonly PhantomPhaseTuning[] = [
  {
    cruise: 2.15,
    strafe: 3.0,
    turn: 1.6,
    visibleTime: 12,
    cloakTime: 4,
    lanceInterval: 11,
    lanceTelegraph: 1.5,
    lanceFire: 1.9,
    lanceChain: 1,
    burstShots: 5,
    burstGap: 2.2,
    missileFactor: 1,
    missileCount: 2,
    decoyCount: 0,
    decoyInterval: 0,
  },
  {
    cruise: 2.35,
    strafe: 3.2,
    turn: 1.8,
    visibleTime: 10,
    cloakTime: 4.5,
    lanceInterval: 10.5,
    lanceTelegraph: 1.35,
    lanceFire: 2.0,
    lanceChain: 1,
    burstShots: 6,
    burstGap: 1.9,
    missileFactor: 0.9,
    missileCount: 2,
    decoyCount: 2,
    decoyInterval: 17,
  },
  {
    cruise: 2.6,
    strafe: 3.5,
    turn: 2.2,
    visibleTime: 9,
    cloakTime: 3,
    lanceInterval: 8,
    lanceTelegraph: 1.2,
    lanceFire: 2.2,
    lanceChain: 2,
    burstShots: 7,
    burstGap: 1.5,
    missileFactor: 0.8,
    missileCount: 3,
    decoyCount: 3,
    decoyInterval: 14,
  },
];

const PHASE_COUNT = 3;
const PHASE2_RATIO = 0.66;
const PHASE3_RATIO = 0.33;
const LOW_HEALTH_RATIO = 0.25;
const EMITTER_HEALTH_RATIO = 0.06;
const CLOAK_IN_TIME = 1.1;
const CLOAK_OUT_TIME = 1.1;
const SPAWN_REVEAL_DELAY = 0.5;
const BURST_SPACING = 0.13;
const CANNON_RANGE = 460;
const CANNON_CONE = Math.cos(THREE.MathUtils.degToRad(17));
const LANCE_LENGTH = 460;
const LANCE_RADIUS = 7;
const LANE_RADIUS = 9.5;
const LANCE_MIN_RANGE = 280;
const LANCE_MAX_RANGE = 480;
const LANCE_SETUP_TIMEOUT = 8;
const LANCE_RECOVER_TIME = 1.2;
/** 突击中距玩家小于该值（且仍在接近）时提前收束光束、拉起脱离，避免穿过玩家 */
const LANCE_BREAK_RANGE = 130;
/** 光束至少持续的时间（秒），之后才允许提前拉起 */
const LANCE_MIN_BEAM_TIME = 0.35;
/** 长矛充能（预警）期间的速度系数（相对巡航） */
const LANCE_CHARGE_SPEED = 0.6;
/** 潜行结束时距玩家小于该值才现形 */
const AMBUSH_RANGE = 380;
const AMBUSH_GRACE = 2;
const EXTEND_TIME = 2.2;
const MAX_DECOYS = 3;
const DECOY_LIFE = 15;
const DECOY_DISSOLVE = 0.35;
const BAY_OPEN_TIME = 0.6;
const BAY_HOLD_TIME = 1.4;
const LEASH_DISTANCE = 1100;
/** 与玩家的最小安全掠过距离（米，按 sizeFactor 缩放） */
const SAFE_PASS_DISTANCE = 70;
const MIN_ALTITUDE = 30;
const MAX_ALTITUDE = 480;
const DEATH_SEQUENCE_DURATION = 4.2;
/**
 * 弹舱导弹：比玩家快、按提前量追踪，转向有限（大过载急转可甩掉），热焰弹可诱骗；8 秒燃尽。
 * 旧版 50 米/秒的慢速导弹追不上任何机动中的玩家，幻影几乎没有威胁。
 */
const BAY_MISSILE: Readonly<BossMissileFlightProfile> = {
  speed: 88,
  turnRate: 1.3,
  lead: 0.5,
  lifetime: 8,
};
/** 机炮对玩家的提前量（拦截点比例） */
const CANNON_LEAD = 0.9;
const MAX_STEP_DT = 0.1;
const WARNING_THROTTLE = 4;

function safeRatio(value: number, base: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0 || value <= 0) return 1;
  return value / base;
}

function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

interface EmitterState {
  rig: PhantomEmitterRig;
  hp: number;
  max: number;
  alive: boolean;
  sparkTimer: number;
  subTarget: BossSubTarget;
}

interface DecoyState {
  rig: PhantomDecoyRig;
  flight: WingFlight;
  active: boolean;
  dissolving: number;
  life: number;
  mode: DecoyMode;
  modeTimer: number;
  orbitSign: 1 | -1;
  altOffset: number;
  shotTimer: number;
  burstLeft: number;
  glitchTimer: number;
  glitchHold: number;
  seed: number;
}

export class PhantomWingAI implements IAdvancedBoss {
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onPhaseChange?: IAdvancedBoss['onPhaseChange'];
  /** 幻影不召唤小兵（全息诱饵由 Boss 自己管理）；保留以满足契约 */
  public onSpawnMinion?: (position: THREE.Vector3, kind: BossMinionKind) => void;
  public onHazardWarning?: IAdvancedBoss['onHazardWarning'];
  /** 扩展钩子：音效 / 镜头震动提示（position 为复用向量，需要保存请 clone） */
  public onEffectCue?: (cue: PhantomWingCue, position: THREE.Vector3, intensity: number) => void;

  private readonly mesh: THREE.Group;
  private readonly config: BossConfig;
  private readonly fx: BossParticleFx;
  private readonly health: HealthSystem;
  private readonly missileSystem: BossMissileSystem;
  private readonly rig: PhantomWingRig;
  private readonly flight: WingFlight;
  private readonly hazardRoot: THREE.Group;
  private readonly lance: PhantomLance;
  private readonly tracers: HoloTracerPool;
  private readonly decoyMaterials: PhantomDecoyMaterials;
  private readonly decoys: DecoyState[] = [];
  private readonly decoyByPart = new Map<THREE.Object3D, DecoyState>();
  private readonly emitters: EmitterState[] = [];
  private readonly emitterByPart = new Map<THREE.Object3D, EmitterState>();
  private readonly partRoles = new Map<THREE.Object3D, PartRole>();
  private readonly subTargets: BossSubTarget[] = [];
  private readonly collisionParts: THREE.Object3D[] = [];
  private readonly activeDecoyMeshes: THREE.Object3D[] = [];
  private readonly warningTimes = new Map<string, number>();
  private readonly probe = createHazardProbe();
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
  private deathSpin = 0;
  private time = 0;
  private snappedToPlayer = false;
  private stunTimer = 0;
  private cloakBlockTimer = 0;
  private lowHealthReached = false;
  private overdriveAnnounced = false;
  /** 出场：以隐形状态生成，短暂停顿后现形亮相 */
  private introPending = true;

  private maneuver: Maneuver = 'orbit';
  private maneuverTimer = 0;
  private orbitSign: 1 | -1 = 1;
  private altOffset = 40;
  private passSide: 1 | -1 = 1;
  private cloakPhase: CloakPhase = 'cloaked';
  private cloakTimer = 0;
  private cloakLevel = 1;
  private visibleTimer = 0;
  private sweep = 0;
  private sweepGain = 0;
  private lanceTimer = 6;
  private lanceChainLeft = 0;
  /** 阶段 2 起现形伏击在“长矛突击”与“机炮对头”之间交替 */
  private ambushCount = 0;
  private lanceTimeLeft = 0;
  private burstLeft = 0;
  private burstTimer = 1.5;
  private shotTimer = 0;
  private muzzleIndex = 0;
  private missileTimer = 8;
  private missileQueue = 0;
  private missileStagger = 0;
  private missileFired = 0;
  private bayPhase: 'closed' | 'opening' | 'firing' | 'holding' = 'closed';
  private bayTimer = 0;
  private bayOpen = 0;
  private decoyTimer = 4;
  private hitFlash = 0;
  private smokeTimer = 0;
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

  private readonly desired = new THREE.Vector3();
  private readonly approachPoint = new THREE.Vector3();
  /** 进场点相对玩家的水平偏移（世界坐标，只随玩家平移、不随玩家转向旋转，便于追上） */
  private readonly approachOffset = new THREE.Vector3(0, 0, -300);
  private lanceAiming = false;
  private approachHeight = 40;
  private readonly lanceDir = new THREE.Vector3(0, 0, 1);
  private readonly lanceSpec: LanceSpec = {
    length: LANCE_LENGTH,
    radius: LANCE_RADIUS,
    damage: 0,
    laneLength: LANCE_LENGTH,
    laneRadius: LANE_RADIUS,
  };
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpD = new THREE.Vector3();
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
    this.missileSystem = new BossMissileSystem(
      scene,
      resolveMissileParticles(particleSystem),
      config.missileDamage
    );
    this.rig = this.ensureRig(mesh, config);
    this.sizeFactor = this.rig.scale / 5;
    const base = BOSS_CONFIGS[BossType.PHANTOM_WING];
    this.cadence = THREE.MathUtils.clamp(
      safeRatio(config.cannonFireInterval, base.cannonFireInterval),
      0.5,
      2
    );
    if (!mesh.name) mesh.name = `BOSS_${config.type}`;
    if (!isFiniteVector(mesh.position)) mesh.position.set(0, 160, 0);

    this.flight = new WingFlight(mesh.position);
    this.tmpA.set(0, 0, 1).applyQuaternion(mesh.quaternion);
    this.flight.setForward(this.tmpA);
    this.flight.speed = Math.max(0, config.speed) * PHASE_TUNING[0].cruise;

    this.hazardRoot = new THREE.Group();
    this.hazardRoot.name = 'phantom_hazards';
    scene.add(this.hazardRoot);
    this.lance = new PhantomLance(this.hazardRoot, 0xff2a44, 'phantom_lance');
    this.tracers = new HoloTracerPool(this.hazardRoot, 36, 0x6ae8ff, 16 * this.sizeFactor);
    this.decoyMaterials = createPhantomDecoyMaterials();
    for (let i = 0; i < MAX_DECOYS; i++) {
      const decoyRig = createPhantomDecoyMesh(this.rig, this.decoyMaterials, i);
      this.hazardRoot.add(decoyRig.root);
      const state: DecoyState = {
        rig: decoyRig,
        flight: new WingFlight(decoyRig.root.position),
        active: false,
        dissolving: 0,
        life: 0,
        mode: 'orbit',
        modeTimer: 0,
        orbitSign: 1,
        altOffset: 0,
        shotTimer: 0,
        burstLeft: 0,
        glitchTimer: 1,
        glitchHold: 0,
        seed: i * 2.37,
      };
      this.decoys.push(state);
      this.decoyByPart.set(decoyRig.root, state);
      this.partRoles.set(decoyRig.root, 'decoy');
    }

    const emitterMax = Math.max(1, Math.round(maxHealth * EMITTER_HEALTH_RATIO));
    for (const emitterRig of this.rig.emitters) {
      const subTarget: BossSubTarget = {
        mesh: emitterRig.pod,
        current: emitterMax,
        max: emitterMax,
      };
      const state: EmitterState = {
        rig: emitterRig,
        hp: emitterMax,
        max: emitterMax,
        alive: true,
        sparkTimer: 0,
        subTarget,
      };
      this.emitters.push(state);
      this.emitterByPart.set(emitterRig.pod, state);
      this.partRoles.set(emitterRig.pod, 'emitter');
      this.subTargets.push(subTarget);
    }
    this.partRoles.set(this.rig.prism, 'prism');
    this.partRoles.set(this.rig.bayInterior, 'bay');
    for (const engine of this.rig.engines) this.partRoles.set(engine.nozzle, 'nozzle');

    this.missileTimer = Math.max(5, config.missileFireInterval * 0.7);
    this.flight.orient(this.mesh.quaternion);
    this.applyCloakVisuals();
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
      this.lance.update(dt);
      this.tracers.update(dt);
      this.updateDecoys(dt);
      this.missileSystem.update(dt);
      return;
    }
    if (!this.isAlive()) return;

    const tuning = this.tuning();
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.cloakBlockTimer = Math.max(0, this.cloakBlockTimer - dt);
    this.updateCloak(dt, tuning);
    this.updateManeuver(dt, tuning);
    this.mesh.updateMatrixWorld(true);
    this.updateWeapons(dt, tuning);
    if (this.disposed) return;
    this.lance.update(dt);
    this.tracers.update(dt);
    this.updateDecoys(dt);
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
    if (this.disposed || this.deathHandled || !part) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    // 诱饵：一击即散，不影响 Boss 血量（隐形期间也可以打散）
    const decoy = this.decoyByPart.get(part);
    if (decoy) {
      if (decoy.active && decoy.dissolving <= 0) this.popDecoy(decoy, true);
      return;
    }
    if (this.isInvulnerable()) return;
    const multiplier = this.getDamageMultiplier(part);
    const dealt = amount * multiplier;
    if (!(dealt > 0)) return;
    const emitter = this.emitterByPart.get(part);
    if (emitter && emitter.alive) {
      emitter.hp = Math.max(0, emitter.hp - dealt);
      emitter.subTarget.current = emitter.hp;
      if (emitter.hp <= 0) this.destroyEmitter(emitter);
    }
    this.hitFlash = Math.min(1, this.hitFlash + (multiplier > 1 ? 0.55 : 0.3));
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

  /** 隐形（相位场 ≥ 50%）时无敌；EMP 瘫痪期间强制现形 */
  public isInvulnerable(): boolean {
    if (this.dying || this.deathHandled) return true;
    return this.cloakLevel >= 0.5 && this.stunTimer <= 0;
  }

  public getDamageMultiplier(part: THREE.Object3D): number {
    const role = this.partRoles.get(part) ?? 'body';
    if (role === 'decoy') return 1;
    if (this.isInvulnerable()) return 0;
    switch (role) {
      case 'prism':
        return this.isLanceActive() ? 2.2 : 0.8;
      case 'emitter': {
        const emitter = this.emitterByPart.get(part);
        return emitter && emitter.alive ? 1.8 : this.getArmorMultiplier();
      }
      case 'bay':
        return this.bayOpen >= 0.5 ? 2.0 : 0.5;
      case 'nozzle':
        return this.isAfterburning() ? 1.6 : 1.0;
      default:
        return this.getArmorMultiplier();
    }
  }

  public checkHazard(targetPosition: THREE.Vector3, targetRadius: number): BossHazardHit | null {
    if (this.disposed || !targetPosition || !isFiniteVector(targetPosition)) return null;
    if (this.deathHandled) return null;
    const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 0;
    resetHazardProbe(this.probe);
    this.lance.probe(targetPosition, radius, this.probe);
    if (this.probe.damage <= 0) return null;
    return {
      damage: this.probe.damage,
      profile: this.probe.profile,
      position: this.probe.position.clone(),
    };
  }

  public getStatusLabel(): string | null {
    const decoys = this.getActiveDecoyCount();
    let code = 0;
    if (this.dying || this.deathHandled) code = 9;
    else if (this.stunTimer > 0) code = 8;
    else if (this.maneuver === 'lance-telegraph' || this.maneuver === 'lance-fire') code = 7;
    else if (this.cloakLevel >= 0.5) code = 6;
    else if (this.cloakPhase === 'decloaking') code = 5;
    else if (this.cloakPhase === 'cloaking' && this.getCloakCap() < 0.5) code = 4;
    else if (decoys > 0) code = 3;
    const key = code * 1000 + this.phase * 100 + (this.lowHealthReached ? 10 : 0) + decoys;
    const locale = getLocale();
    if (key === this.statusKey && locale === this.statusLocale) return this.statusLabel;
    this.statusKey = key;
    this.statusLocale = locale;
    switch (code) {
      case 9:
        this.statusLabel = tr({ en: 'Phantom going down', zh: '幻影坠落' });
        break;
      case 8:
        this.statusLabel = tr({ en: 'EMP stunned · Forced visible', zh: '电磁瘫痪 · 强制现形' });
        break;
      case 7:
        this.statusLabel = tr({
          en: 'Laser lance · Avoid the red lane',
          zh: '激光长矛 · 避开红色航道',
        });
        break;
      case 6:
        this.statusLabel = tr({ en: 'Cloaked · Cannot lock', zh: '隐形中 · 无法锁定' });
        break;
      case 5:
        this.statusLabel = tr({ en: 'Phantom decloaking', zh: '幻影现形' });
        break;
      case 4:
        this.statusLabel = tr({
          en: 'Cloak failing · Coating stripped',
          zh: '隐形失败 · 涂层剥落',
        });
        break;
      case 3:
        this.statusLabel = tr(
          {
            en: 'Holo decoys ×{count} · The real one burns red',
            zh: '全息诱饵 ×{count} · 真身尾焰为红色',
          },
          { count: decoys }
        );
        break;
      default:
        if (this.phase >= 3) {
          this.statusLabel = this.lowHealthReached
            ? tr({ en: 'Cloak coating stripped · Overclocked', zh: '隐形涂层剥落 · 超频' })
            : tr({ en: 'Overclock mode', zh: '超频模式' });
        } else {
          this.statusLabel =
            this.phase === 2
              ? tr({ en: 'Phantom Wing · Decoys deployed', zh: '幻影之翼 · 诱饵投射' })
              : tr({ en: 'Phantom Wing', zh: '幻影之翼' });
        }
    }
    return this.statusLabel;
  }

  public getSubTargets(): BossSubTarget[] {
    return this.subTargets;
  }

  /** EMP：强制现形、打断长矛、打散全部诱饵，数秒内无法再次隐形 */
  public applyStun(seconds: number): void {
    if (!this.isAlive() || this.disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    const stun = Math.min(4, seconds);
    this.stunTimer = Math.max(this.stunTimer, stun);
    this.cloakBlockTimer = Math.max(this.cloakBlockTimer, stun + 4);
    if (this.cloakPhase !== 'visible') {
      this.cloakPhase = 'visible';
      this.cloakTimer = 0;
      this.visibleTimer = 0;
      this.sweepGain = 1;
    }
    this.cloakLevel = Math.min(this.cloakLevel, 0.2);
    if (this.isLanceActive()) this.lance.stop();
    this.setManeuver('stunned');
    for (const decoy of this.decoys) {
      if (decoy.active && decoy.dissolving <= 0) this.popDecoy(decoy, false);
    }
    this.bayPhase = 'closed';
    this.missileQueue = 0;
    this.burstLeft = 0;
    this.fx.emit('createHit', this.mesh.position, 2.4, 'boss');
    this.statusKey = -1;
  }

  /**
   * 扩展：EMP 脉冲的便捷判定——中心在半径内（含机体半径）则 applyStun 并返回 true；
   * 半径内的诱饵无论真身是否被命中都会被打散。适合隐形时没有碰撞部件的情况。
   */
  public applyEmpPulse(center: THREE.Vector3, radius: number, seconds: number): boolean {
    if (!this.isAlive() || !isFiniteVector(center) || !(radius > 0)) return false;
    for (const decoy of this.decoys) {
      if (!decoy.active || decoy.dissolving > 0) continue;
      if (decoy.rig.root.position.distanceTo(center) <= radius + 18 * this.sizeFactor) {
        this.popDecoy(decoy, false);
      }
    }
    const reach = radius + (this.mesh.userData.hitRadius ?? 18);
    if (this.mesh.position.distanceTo(center) > reach) return false;
    this.applyStun(seconds);
    return true;
  }

  /** 扩展：地表高度采样（用于避让云海 / 天梯主干），未设置时只限制最低绝对高度 */
  public setGroundSampler(sampler: (x: number, z: number) => number): void {
    this.groundSampler = typeof sampler === 'function' ? sampler : null;
  }

  /**
   * 扩展：开启后血量归零先播放约 4 秒螺旋坠落（期间 isAlive() 为 false、无敌、无碰撞部件），
   * 结束时才触发 onDestroy。默认关闭（契约：归零时同步触发）。
   */
  public setDeathSequenceEnabled(enabled: boolean): void {
    this.deathSequenceEnabled = enabled;
  }

  public isDying(): boolean {
    return this.dying;
  }

  /** 扩展：是否处于隐形（雷达 / 锁定应隐藏真身） */
  public isCloaked(): boolean {
    return this.cloakLevel >= 0.5;
  }

  /** 扩展：隐形程度 0..1 */
  public getCloakLevel(): number {
    return this.cloakLevel;
  }

  /** 扩展：存活的全息诱饵网格（雷达可显示为“真假难辨”的回波）；返回的数组每次调用复用，勿长期持有 */
  public getDecoyMeshes(): readonly THREE.Object3D[] {
    this.activeDecoyMeshes.length = 0;
    for (const decoy of this.decoys) {
      if (decoy.active && decoy.dissolving <= 0) this.activeDecoyMeshes.push(decoy.rig.root);
    }
    return this.activeDecoyMeshes;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dying = false;
    this.missileSystem.dispose();
    this.lance.dispose();
    this.tracers.dispose();
    for (const decoy of this.decoys) {
      decoy.rig.root.parent?.remove(decoy.rig.root);
      // 诱饵几何体与真身共享（随真身释放）；光晕精灵材质为诱饵独有
      for (const glow of decoy.rig.glows) glow.material.dispose();
    }
    this.decoyMaterials.body.dispose();
    this.decoyMaterials.seam.dispose();
    this.decoyMaterials.nozzle.dispose();
    this.decoyMaterials.flame.dispose();
    this.hazardRoot.parent?.remove(this.hazardRoot);
    this.mesh.visible = false;
    this.mesh.parent?.remove(this.mesh);
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      disposeObjectTree(child);
    }
    this.collisionParts.length = 0;
    this.activeDecoyMeshes.length = 0;
    this.decoyByPart.clear();
    this.emitterByPart.clear();
    this.partRoles.clear();
  }

  // ===========================================================================================
  // 构造辅助 / 状态查询
  // ===========================================================================================

  private ensureRig(mesh: THREE.Group, config: BossConfig): PhantomWingRig {
    const existing = (mesh as PhantomWingGroup).phantomRig;
    if (existing) return existing;
    const built = createPhantomWingMesh(config) as PhantomWingGroup & {
      bossParts?: THREE.Object3D[];
    };
    while (built.children.length > 0) mesh.add(built.children[0]);
    const rig = built.phantomRig;
    if (!rig) throw new Error('PhantomWingAI: mesh factory produced no rig');
    (mesh as PhantomWingGroup & { bossParts?: THREE.Object3D[] }).bossParts = built.bossParts;
    (mesh as PhantomWingGroup).phantomRig = rig;
    if (mesh.userData.hitRadius === undefined) mesh.userData.hitRadius = built.userData.hitRadius;
    if (!mesh.name) mesh.name = built.name;
    return rig;
  }

  private tuning(): PhantomPhaseTuning {
    return PHASE_TUNING[Math.min(PHASE_TUNING.length, Math.max(1, this.phase)) - 1];
  }

  private getArmorMultiplier(): number {
    let value = this.phase >= 3 ? 0.78 : 0.65;
    if (this.lowHealthReached) value += 0.15;
    if (this.stunTimer > 0) value += 0.2;
    return Math.min(0.95, value);
  }

  private getAliveEmitterCount(): number {
    let count = 0;
    for (const emitter of this.emitters) if (emitter.alive) count++;
    return count;
  }

  /** 隐形上限：每毁一枚发射器降低一档；涂层剥落后无法进入无敌隐形 */
  private getCloakCap(): number {
    const lost = this.emitters.length - this.getAliveEmitterCount();
    let cap = lost <= 0 ? 1 : lost === 1 ? 0.74 : 0.42;
    if (this.lowHealthReached) cap = Math.min(cap, 0.42);
    return cap;
  }

  private getActiveDecoyCount(): number {
    let count = 0;
    for (const decoy of this.decoys) if (decoy.active && decoy.dissolving <= 0) count++;
    return count;
  }

  private getDecoyCapacity(tuning: PhantomPhaseTuning): number {
    const emittersAlive = this.getAliveEmitterCount();
    if (emittersAlive <= 0) return 0;
    return Math.min(tuning.decoyCount, emittersAlive === 1 ? 1 : MAX_DECOYS);
  }

  private isLanceActive(): boolean {
    return this.maneuver === 'lance-telegraph' || this.maneuver === 'lance-fire';
  }

  private isAfterburning(): boolean {
    return this.maneuver === 'lance-fire' || this.phase >= 3;
  }

  private rebuildCollisionParts(): void {
    const parts = this.collisionParts;
    parts.length = 0;
    if (this.deathHandled || this.disposed) return;
    if (!this.isInvulnerable()) {
      if (this.isLanceActive()) parts.push(this.rig.prism);
      for (const emitter of this.emitters) if (emitter.alive) parts.push(emitter.rig.pod);
      if (this.bayOpen >= 0.5) parts.push(this.rig.bayInterior);
      for (const engine of this.rig.engines) parts.push(engine.nozzle);
      parts.push(this.rig.body, ...this.rig.wingAnchors);
      if (!this.isLanceActive()) parts.push(this.rig.prism);
    }
    for (const decoy of this.decoys) {
      if (decoy.active && decoy.dissolving <= 0) parts.push(decoy.rig.root);
    }
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

  /** 预警（同一句按英文原文节流）；传双语原文，HUD 按当前语言显示、切换语言时重绘 */
  private warn(label: LocalizedText): void {
    const last = this.warningTimes.get(label.en);
    if (last !== undefined && this.time - last < WARNING_THROTTLE) return;
    this.warningTimes.set(label.en, this.time);
    this.onHazardWarning?.(label);
  }

  private emitCue(cue: PhantomWingCue, position: THREE.Vector3, intensity: number): void {
    if (!this.onEffectCue) return;
    this.cuePosition.copy(position);
    this.onEffectCue(cue, this.cuePosition, intensity);
  }

  // ===========================================================================================
  // 隐形循环
  // ===========================================================================================

  private updateCloak(dt: number, tuning: PhantomPhaseTuning): void {
    this.cloakTimer += dt;
    const cap = this.getCloakCap();
    switch (this.cloakPhase) {
      case 'visible':
        this.visibleTimer += dt;
        this.cloakLevel = Math.max(0, this.cloakLevel - dt * 2);
        this.sweepGain = Math.max(0, this.sweepGain - dt * 1.5);
        break;
      case 'cloaking': {
        const p = Math.min(1, this.cloakTimer / CLOAK_IN_TIME);
        // 相位网格从机头扫到机尾，机体随之淡出
        this.sweep = THREE.MathUtils.lerp(this.rig.length * 0.7, -this.rig.length * 0.7, p);
        this.sweepGain = 1;
        this.cloakLevel = smoothstep(p) * cap;
        if (cap < 0.5 && p > 0.6) {
          // 涂层剥落 / 发射器全毁：隐形失败，闪烁着回到可见
          this.cloakPhase = 'visible';
          this.cloakTimer = 0;
          this.visibleTimer = tuning.visibleTime * 0.5;
          this.fx.emit('createHit', this.mesh.position, 1.8, 'boss');
          this.emitCue('cloak-fail', this.mesh.position, 0.8);
          this.statusKey = -1;
          // 隐形失败也照样发动攻击
          this.onAmbush();
          break;
        }
        if (p >= 1) {
          this.cloakPhase = 'cloaked';
          this.cloakTimer = 0;
          this.statusKey = -1;
        }
        break;
      }
      case 'cloaked': {
        this.cloakLevel = this.introPending ? 1 : cap;
        this.sweepGain = Math.max(0, this.sweepGain - dt * 2);
        const hold = this.introPending ? SPAWN_REVEAL_DELAY : tuning.cloakTime;
        // 到达伏击距离再现形（最多多潜行 3 秒），避免在远处现形后长时间追赶
        const inRange =
          this.introPending ||
          !this.hasPlayer ||
          this.mesh.position.distanceTo(this.playerPos) < AMBUSH_RANGE * this.sizeFactor;
        if (this.cloakTimer >= hold && (inRange || this.cloakTimer >= hold + AMBUSH_GRACE)) {
          this.introPending = false;
          this.startDecloak();
        }
        break;
      }
      case 'decloaking': {
        const p = Math.min(1, this.cloakTimer / CLOAK_OUT_TIME);
        // 网格从机尾扫回机头：现形预警
        this.sweep = THREE.MathUtils.lerp(-this.rig.length * 0.7, this.rig.length * 0.7, p);
        this.sweepGain = 1;
        this.cloakLevel = (1 - smoothstep(p)) * Math.max(cap, 0.01);
        if (p >= 1) {
          this.cloakPhase = 'visible';
          this.cloakTimer = 0;
          this.visibleTimer = 0;
          this.cloakLevel = 0;
          this.onAmbush();
        }
        break;
      }
    }
  }

  private canStartCloak(tuning: PhantomPhaseTuning): boolean {
    if (this.cloakPhase !== 'visible' || this.stunTimer > 0 || this.cloakBlockTimer > 0) {
      return false;
    }
    if (this.visibleTimer < tuning.visibleTime) return false;
    return this.maneuver === 'orbit' || this.maneuver === 'extend';
  }

  private startCloak(): void {
    this.cloakPhase = 'cloaking';
    this.cloakTimer = 0;
    this.burstLeft = 0;
    this.setManeuver('stalk');
    this.chooseAmbushPoint();
    this.emitCue('cloak', this.mesh.position, 0.7);
    this.statusKey = -1;
  }

  private startDecloak(): void {
    this.cloakPhase = 'decloaking';
    this.cloakTimer = 0;
    this.warn({ en: 'Phantom decloaking', zh: '幻影现形' });
    this.emitCue('decloak', this.mesh.position, 0.9);
    this.statusKey = -1;
  }

  /** 现形完成：发动伏击（阶段 1 机炮对头；阶段 2+ 先投射诱饵，长矛突击与机炮对头交替） */
  private onAmbush(): void {
    this.statusKey = -1;
    if (!this.hasPlayer) {
      this.setManeuver('orbit');
      return;
    }
    if (this.phase >= 2) {
      this.projectDecoys(this.tuning());
      const lance = this.ambushCount % 2 === 0;
      this.ambushCount++;
      if (lance) {
        this.lanceTimer = this.tuning().lanceInterval * this.cadence;
        this.beginLanceSetup(true);
        return;
      }
    }
    this.setManeuver('gun-pass');
    this.passSide = Math.random() < 0.5 ? -1 : 1;
  }

  // ===========================================================================================
  // 机动
  // ===========================================================================================

  private setManeuver(maneuver: Maneuver): void {
    this.maneuver = maneuver;
    this.maneuverTimer = 0;
    this.statusKey = -1;
  }

  /** 伏击点：从当前方位绕玩家侧移 40°～75°、约 320 米（随玩家平移），在意想不到的角度现形 */
  private chooseAmbushPoint(): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.setApproachOffset(
      this.getBossBearing() + side * (0.7 + Math.random() * 0.6),
      (300 + Math.random() * 40) * this.sizeFactor
    );
    this.approachHeight = (30 + Math.random() * 50) * this.sizeFactor;
    this.updateApproachPoint();
  }

  /** resetChain：新一轮突击（重置连击次数）；false 表示连击 / 重新进场 */
  private beginLanceSetup(resetChain: boolean): void {
    this.setManeuver('lance-setup');
    this.lanceAiming = false;
    if (resetChain) this.lanceChainLeft = this.tuning().lanceChain - 1;
    // 已在射程内且大致对准玩家：直接进入瞄准
    this.tmpA.subVectors(this.playerPos, this.mesh.position);
    const distance = this.tmpA.length();
    if (
      distance > LANCE_MIN_RANGE * this.sizeFactor &&
      distance < LANCE_MAX_RANGE * this.sizeFactor &&
      this.tmpA.dot(this.flight.forward) > distance * 0.5
    ) {
      this.lanceAiming = true;
    }
    // 一击脱离：顺着当前航向（不先掉头）拉开到距玩家约 370 米、略高处，再大过载回转俯冲
    const forward = this.flight.forward;
    const horizontal = Math.hypot(forward.x, forward.z);
    this.approachOffset.copy(this.mesh.position).sub(this.playerPos);
    if (horizontal > 1e-3) {
      this.approachOffset.x += (forward.x / horizontal) * 320 * this.sizeFactor;
      this.approachOffset.z += (forward.z / horizontal) * 320 * this.sizeFactor;
    }
    this.approachOffset.y = 0;
    if (this.approachOffset.lengthSq() < 1e-4)
      this.approachOffset.set(forward.x, 0, forward.z + 1e-3);
    this.approachOffset
      .normalize()
      .multiplyScalar((LANCE_MIN_RANGE + 100 + Math.random() * 40) * this.sizeFactor);
    this.approachHeight = (45 + Math.random() * 45) * this.sizeFactor;
    this.updateApproachPoint();
  }

  /** Boss 相对玩家水平航向的方位角（绕 Y 轴正向，弧度） */
  private getBossBearing(): number {
    this.playerHeading(this.tmpA);
    this.tmpB.subVectors(this.mesh.position, this.playerPos).setY(0);
    if (this.tmpB.lengthSq() < 1e-4) this.tmpB.set(-this.tmpA.z, 0, this.tmpA.x);
    this.tmpB.normalize();
    const cross = this.tmpA.z * this.tmpB.x - this.tmpA.x * this.tmpB.z;
    return Math.atan2(cross, this.tmpA.dot(this.tmpB));
  }

  /** 玩家水平航向（单位向量）；玩家几乎静止时用 Boss → 玩家方向 */
  private playerHeading(out: THREE.Vector3): THREE.Vector3 {
    out.set(this.playerVel.x, 0, this.playerVel.z);
    if (out.lengthSq() < 4) out.subVectors(this.playerPos, this.mesh.position).setY(0);
    if (out.lengthSq() < 1e-4) out.set(0, 0, 1);
    return out.normalize();
  }

  /** 以“相对玩家当前航向的方位角”与距离确定进场偏移（绕 Y 轴正向旋转），之后只随玩家平移 */
  private setApproachOffset(bearing: number, range: number): void {
    this.playerHeading(this.tmpD);
    const c = Math.cos(bearing);
    const s = Math.sin(bearing);
    this.approachOffset.set(
      (this.tmpD.x * c + this.tmpD.z * s) * range,
      0,
      (-this.tmpD.x * s + this.tmpD.z * c) * range
    );
  }

  private updateApproachPoint(): void {
    this.approachPoint.copy(this.playerPos).add(this.approachOffset);
    this.approachPoint.y += this.approachHeight;
  }

  private updateManeuver(dt: number, tuning: PhantomPhaseTuning): void {
    const position = this.mesh.position;
    const sf = this.sizeFactor;
    const baseSpeed = Math.max(1, this.config.speed);
    const cruise = baseSpeed * tuning.cruise;
    let targetSpeed = cruise;
    let turnRate = Math.max(0.05, this.config.turnSpeed) * tuning.turn;
    let maxPitch = 0.62;
    this.maneuverTimer += dt;

    if (this.hasPlayer && !this.snappedToPlayer) {
      // 出场：沿玩家切线方向飞行，展示侧影
      this.snappedToPlayer = true;
      this.tmpA.subVectors(this.playerPos, position).setY(0);
      if (this.tmpA.lengthSq() > 1e-4) {
        this.tmpA.normalize();
        this.tmpB.set(-this.tmpA.z, 0, this.tmpA.x);
        this.flight.setForward(this.tmpB);
      }
      // 与切线出场方向一致的盘旋方向
      this.orbitSign = -1;
    }

    const visibleManeuver =
      this.maneuver === 'orbit' || this.maneuver === 'gun-pass' || this.maneuver === 'extend';
    if (this.hasPlayer && visibleManeuver && this.cloakPhase === 'visible') {
      // 长矛计时在所有可见机动中推进；就绪时优先于隐形
      this.lanceTimer -= dt;
      if (this.lanceTimer <= 0 && this.maneuver !== 'gun-pass') {
        this.lanceTimer = tuning.lanceInterval * this.cadence;
        this.beginLanceSetup(true);
      } else if (this.canStartCloak(tuning)) {
        this.startCloak();
      }
    }

    const distance = this.hasPlayer ? position.distanceTo(this.playerPos) : 0;
    // 掉队时加速归队
    const rejoin = distance > 480 * sf ? 1.35 : 1;
    if (!this.hasPlayer) {
      this.desired.copy(this.flight.forward);
      this.desired.y = 0;
    } else {
      switch (this.maneuver) {
        case 'orbit':
          this.steerOrbit(this.config.circleRadius * sf);
          targetSpeed = cruise * rejoin;
          if (this.maneuverTimer > 3.5 + (Math.sin(this.time * 0.7) + 1) * 1.5) {
            this.setManeuver('gun-pass');
            this.passSide = Math.random() < 0.5 ? -1 : 1;
          }
          break;
        case 'gun-pass': {
          // 交叉 / 对头攻击：瞄准玩家的拦截点并保持侧向错开，避免正面相撞
          const intercept = THREE.MathUtils.clamp(distance / (cruise * 1.6), 0.4, 3);
          this.predictPlayer(intercept, this.tmpC);
          this.tmpA.subVectors(this.tmpC, position);
          this.tmpB.set(-this.tmpA.z, 0, this.tmpA.x);
          if (this.tmpB.lengthSq() > 1e-4) this.tmpB.normalize();
          this.desired.copy(this.tmpA).addScaledVector(this.tmpB, this.passSide * 55 * sf);
          targetSpeed = cruise * 1.15 * rejoin;
          this.tmpA.subVectors(this.playerPos, position);
          const passed = this.tmpA.dot(this.flight.forward) < 0 && this.maneuverTimer > 1;
          if (distance < 160 * sf || passed || this.maneuverTimer > 5) this.setManeuver('extend');
          break;
        }
        case 'extend':
          this.desired.copy(this.flight.forward);
          this.desired.y = 0.22 * (position.y < this.playerPos.y + 30 * sf ? 1 : -0.5);
          // 玩家仍在前方近处：侧滑让开
          this.tmpA.subVectors(position, this.playerPos).setY(0);
          if (
            distance < 200 * sf &&
            this.tmpA.dot(this.flight.forward) < 0 &&
            this.tmpA.lengthSq() > 1e-4
          ) {
            this.desired.addScaledVector(this.tmpA.normalize(), 0.8);
          }
          targetSpeed = cruise * 1.2;
          if (this.maneuverTimer > EXTEND_TIME) this.enterOrbit();
          break;
        case 'stalk': {
          if (this.cloakPhase === 'decloaking') {
            // 现形过程中转向玩家，准备伏击
            this.desired.subVectors(this.playerPos, position);
          } else {
            this.updateApproachPoint();
            this.desired.subVectors(this.approachPoint, position);
          }
          targetSpeed = cruise * 1.3 * rejoin;
          break;
        }
        case 'lance-setup': {
          this.updateApproachPoint();
          this.tmpA.subVectors(this.approachPoint, position);
          const toApproach = this.tmpA.length();
          // 先拉开（到达进场点或已足够远），再回头瞄准
          if (toApproach < 120 * sf || distance > LANCE_MIN_RANGE * 1.25 * sf) {
            this.lanceAiming = true;
          }
          if (this.lanceAiming) {
            this.predictPlayer(1.4, this.tmpC);
            this.desired.subVectors(this.tmpC, position);
            const aligned = this.flight.forward.angleTo(this.desired) < 0.26;
            // 久攻不下时放宽最小距离，避免反复拉开
            const minRange = this.maneuverTimer > 5 ? LANCE_MIN_RANGE * 0.75 : LANCE_MIN_RANGE;
            const inRange = distance > minRange * sf && distance < LANCE_MAX_RANGE * sf;
            const late =
              this.maneuverTimer > LANCE_SETUP_TIMEOUT &&
              distance > 230 * sf &&
              distance < LANCE_MAX_RANGE * sf * 1.1;
            if ((aligned && inRange) || late) {
              this.startLanceTelegraph(tuning);
              break;
            }
            if (distance < LANCE_MIN_RANGE * sf * 0.7) this.lanceAiming = false;
          } else {
            this.desired.copy(this.tmpA);
          }
          targetSpeed = cruise * (this.lanceAiming ? 1.15 : 1.4) * rejoin;
          // 回头切入时大过载转弯
          if (this.lanceAiming) turnRate *= 1.8;
          if (this.maneuverTimer > LANCE_SETUP_TIMEOUT * 1.6) this.enterOrbit();
          break;
        }
        case 'lance-telegraph':
          this.desired.copy(this.lanceDir);
          targetSpeed = cruise * LANCE_CHARGE_SPEED;
          turnRate *= 3;
          maxPitch = 0.8;
          if (this.maneuverTimer >= tuning.lanceTelegraph) this.startLanceFire(tuning);
          break;
        case 'lance-fire': {
          this.desired.copy(this.lanceDir);
          targetSpeed = baseSpeed * tuning.strafe;
          turnRate = 0;
          maxPitch = 0.8;
          this.rig.noseTip.getWorldPosition(this.tmpA);
          this.lance.setOrigin(this.tmpA);
          this.lanceTimeLeft -= dt;
          this.tmpB.subVectors(this.playerPos, position);
          const breakOff =
            this.maneuverTimer > LANCE_MIN_BEAM_TIME &&
            distance < LANCE_BREAK_RANGE * sf &&
            this.tmpB.dot(this.flight.forward) > 0;
          if (this.lanceTimeLeft <= 0 || breakOff) {
            this.lance.stop();
            if (this.lanceChainLeft > 0) {
              this.lanceChainLeft--;
              this.beginLanceSetup(false);
            } else {
              this.setManeuver('lance-recover');
            }
          }
          break;
        }
        case 'lance-recover':
          // 拉起并从玩家身侧滑开
          this.desired.copy(this.flight.forward);
          this.desired.y += 0.3;
          if (distance < 200 * sf) {
            this.tmpA.subVectors(position, this.playerPos).setY(0);
            if (this.tmpA.lengthSq() > 1e-4)
              this.desired.addScaledVector(this.tmpA.normalize(), 0.9);
          }
          targetSpeed = cruise * 1.1;
          turnRate *= 1.8;
          maxPitch = 0.75;
          if (this.maneuverTimer >= LANCE_RECOVER_TIME) this.setManeuver('extend');
          break;
        case 'stunned':
          this.desired.copy(this.flight.forward);
          this.desired.y = -0.05;
          targetSpeed = cruise * 0.6;
          turnRate *= 0.2;
          if (this.stunTimer <= 0) this.enterOrbit();
          break;
      }
    }

    // 预测将与玩家擦身而过时急转脱离（大过载）
    if (this.applyAvoidance(sf)) turnRate *= 2.2;
    this.flight.steer(dt, this.desired, turnRate, maxPitch);
    this.flight.throttle(dt, targetSpeed, this.maneuver === 'lance-fire' ? 2.5 : 1.1);
    this.flight.integrate(dt);
    if (!isFiniteVector(position)) {
      position.set(this.playerPos.x + 200, this.playerPos.y + 60, this.playerPos.z + 200);
      this.flight.speed = cruise;
    }
    this.flight.orient(this.mesh.quaternion);
  }

  /** 进入盘旋：顺着当前航向选择盘旋方向（避免掉头 180° 越飞越远），随机盘旋高度 */
  private enterOrbit(): void {
    this.setManeuver('orbit');
    this.predictPlayer(1.5, this.tmpC);
    this.tmpA.subVectors(this.mesh.position, this.tmpC).setY(0);
    const forward = this.flight.forward;
    this.orbitSign = -this.tmpA.z * forward.x + this.tmpA.x * forward.z >= 0 ? 1 : -1;
    this.altOffset = (20 + Math.random() * 60) * this.sizeFactor;
  }

  /** 绕玩家的预测位置盘旋（领先 1.5 秒），这样即使玩家直线飞行也能留在视野附近 */
  private steerOrbit(radius: number): void {
    const position = this.mesh.position;
    this.predictPlayer(1.5, this.tmpC);
    this.tmpA.subVectors(position, this.tmpC).setY(0);
    let distance = this.tmpA.length();
    if (distance < 1e-3) {
      this.tmpA.set(1, 0, 0);
      distance = 1;
    }
    this.tmpA.divideScalar(distance);
    // 切线 + 径向修正 + 高度修正
    this.desired.set(-this.tmpA.z * this.orbitSign, 0, this.tmpA.x * this.orbitSign);
    const radial = THREE.MathUtils.clamp((distance - radius) / Math.max(1, radius), -1, 1);
    this.desired.addScaledVector(this.tmpA, -radial * 1.6);
    const altitudeError = this.playerPos.y + this.altOffset - position.y;
    this.desired.y = THREE.MathUtils.clamp(altitudeError / 70, -0.6, 0.6);
  }

  /** 玩家在 seconds 秒后的预测位置 */
  private predictPlayer(seconds: number, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.playerPos).addScaledVector(this.playerVel, seconds);
  }

  /** 最低安全高度：绝对下限与地表采样（+50 米）取大 */
  private getFloor(x: number, z: number): number {
    let floor = MIN_ALTITUDE;
    if (this.groundSampler) {
      const ground = this.groundSampler(x, z);
      if (Number.isFinite(ground) && ground < this.mesh.position.y + 200) {
        floor = Math.max(floor, ground + 50 * this.sizeFactor);
      }
    }
    return floor;
  }

  /**
   * 高度上下限、地表 / 天梯避让、离玩家过远时回航、与玩家的防撞。
   * 返回 true 表示需要急转脱离（预测最近距离过小）。
   */
  private applyAvoidance(sf: number): boolean {
    const position = this.mesh.position;
    if (this.desired.lengthSq() < 1e-8) this.desired.copy(this.flight.forward);
    this.desired.normalize();
    if (this.maneuver === 'lance-fire' || this.maneuver === 'lance-telegraph') return false;
    let breaking = false;
    let floor = MIN_ALTITUDE;
    if (this.groundSampler) {
      // 前方 2 秒处采样：地表高出当前高度很多（天梯主干）时侧向避让，否则作为下限
      this.tmpA.copy(position).addScaledVector(this.flight.forward, this.flight.speed * 2);
      const ahead = this.groundSampler(this.tmpA.x, this.tmpA.z);
      const below = this.groundSampler(position.x, position.z);
      if (Number.isFinite(ahead) && ahead > position.y - 20 * sf) {
        this.tmpB.set(-this.flight.forward.z, 0, this.flight.forward.x);
        this.desired.addScaledVector(this.tmpB, 1.5).normalize();
      }
      if (Number.isFinite(below) && below < position.y) floor = Math.max(floor, below + 50 * sf);
    }
    if (position.y < floor + 40 * sf) {
      this.desired.y += THREE.MathUtils.clamp((floor + 40 * sf - position.y) / (40 * sf), 0, 1.2);
    } else if (position.y > MAX_ALTITUDE) {
      this.desired.y -= THREE.MathUtils.clamp((position.y - MAX_ALTITUDE) / 60, 0, 1);
    }
    if (this.hasPlayer) {
      this.tmpA.subVectors(this.playerPos, position);
      const distance = this.tmpA.length();
      if (distance > LEASH_DISTANCE * sf) {
        this.desired.lerp(this.tmpA.normalize(), 0.7);
      } else if (distance < 260 * sf) {
        breaking = this.avoidPlayer(sf);
      }
    }
    if (this.desired.lengthSq() < 1e-8) this.desired.copy(this.flight.forward);
    this.desired.normalize();
    return breaking;
  }

  /**
   * 防撞：按相对速度预测 2.5 秒内的最近距离；小于翼展安全距离时朝“错开方向”急转。
   * （机翼半展约 37 米，玩家贴脸穿模会很难看，也不公平）
   */
  private avoidPlayer(sf: number): boolean {
    const position = this.mesh.position;
    // r：玩家 → Boss；v：Boss 相对玩家的速度
    this.tmpA.subVectors(position, this.playerPos);
    this.tmpB.copy(this.flight.forward).multiplyScalar(this.flight.speed).sub(this.playerVel);
    const speedSq = this.tmpB.lengthSq();
    let tClosest = 0;
    if (speedSq > 1) tClosest = THREE.MathUtils.clamp(-this.tmpA.dot(this.tmpB) / speedSq, 0, 2.5);
    // 最近点处的相对位置（错开方向）
    this.tmpC.copy(this.tmpA).addScaledVector(this.tmpB, tClosest);
    const miss = this.tmpC.length();
    const safe = SAFE_PASS_DISTANCE * sf;
    if (miss >= safe) return false;
    if (miss < 1) {
      // 正对相撞航线：按盘旋方向侧闪并拉高
      this.tmpC.set(
        -this.flight.forward.z * this.orbitSign,
        0.5,
        this.flight.forward.x * this.orbitSign
      );
    }
    // 只取垂直于相对速度的分量，作为侧闪方向
    if (speedSq > 1) this.tmpC.addScaledVector(this.tmpB, -this.tmpC.dot(this.tmpB) / speedSq);
    if (this.tmpC.lengthSq() < 1e-6) this.tmpC.set(0, 1, 0);
    this.tmpC.normalize();
    const urgency = 1 - miss / safe;
    this.desired.addScaledVector(this.tmpC, 1.2 + 2.4 * urgency).normalize();
    return true;
  }

  // ===========================================================================================
  // 武器
  // ===========================================================================================

  private startLanceTelegraph(tuning: PhantomPhaseTuning): void {
    const sf = this.sizeFactor;
    this.setManeuver('lance-telegraph');
    this.rig.noseTip.getWorldPosition(this.tmpA);
    // 瞄准开火中段时玩家的预测位置
    this.predictPlayer(tuning.lanceTelegraph + tuning.lanceFire * 0.4, this.tmpB);
    this.lanceDir.subVectors(this.tmpB, this.tmpA);
    if (this.lanceDir.lengthSq() < 1e-4) this.lanceDir.copy(this.flight.forward);
    this.lanceDir.normalize();
    const cruise = Math.max(1, this.config.speed) * tuning.cruise;
    const strafe = Math.max(1, this.config.speed) * tuning.strafe;
    // 俯冲角限制：整段突击结束时仍高于地表 / 云海至少 40 米
    const run = cruise * LANCE_CHARGE_SPEED * tuning.lanceTelegraph + strafe * tuning.lanceFire;
    const floor = this.getFloor(this.mesh.position.x, this.mesh.position.z);
    const maxDrop = Math.max(0, this.mesh.position.y - (floor + 40 * sf));
    const minY = Math.max(-0.7, -maxDrop / Math.max(1, run));
    if (this.lanceDir.y < minY) {
      const horizontal = Math.hypot(this.lanceDir.x, this.lanceDir.z) || 1;
      const scale = Math.sqrt(Math.max(0, 1 - minY * minY)) / horizontal;
      this.lanceDir.set(this.lanceDir.x * scale, minY, this.lanceDir.z * scale);
    }
    this.lanceSpec.length = LANCE_LENGTH * sf;
    this.lanceSpec.radius = LANCE_RADIUS * sf;
    this.lanceSpec.damage = this.config.damage;
    this.lanceSpec.laneRadius = LANE_RADIUS * sf;
    this.lanceSpec.laneLength =
      LANCE_LENGTH * sf +
      cruise * LANCE_CHARGE_SPEED * tuning.lanceTelegraph +
      strafe * tuning.lanceFire;
    this.lance.telegraph(this.tmpA, this.lanceDir, this.lanceSpec, tuning.lanceTelegraph);
    this.burstLeft = 0;
    this.warn({ en: 'Laser lance warning', zh: '激光长矛预警' });
    this.emitCue('lance-charge', this.tmpA, 0.9);
  }

  private startLanceFire(tuning: PhantomPhaseTuning): void {
    this.setManeuver('lance-fire');
    this.lanceTimeLeft = tuning.lanceFire;
    this.rig.noseTip.getWorldPosition(this.tmpA);
    this.lance.setOrigin(this.tmpA);
    this.lance.fire();
    this.fx.emit('createHit', this.tmpA, 2.4, 'enemy');
    this.emitCue('lance-fire', this.tmpA, 1);
  }

  private updateWeapons(dt: number, tuning: PhantomPhaseTuning): void {
    this.updateBay(dt);
    if (!this.hasPlayer || this.stunTimer > 0) return;
    const visible = this.cloakPhase === 'visible' && this.cloakLevel < 0.3;
    this.updateCannon(dt, tuning, visible);
    this.updateMissiles(dt, tuning, visible);
    this.updateDecoyProjection(dt, tuning, visible);
  }

  private updateCannon(dt: number, tuning: PhantomPhaseTuning, visible: boolean): void {
    if (this.burstLeft > 0) {
      this.shotTimer -= dt;
      if (this.shotTimer <= 0) {
        this.shotTimer = BURST_SPACING;
        this.burstLeft--;
        this.fireCannonShot();
      }
      return;
    }
    this.burstTimer -= dt;
    if (this.burstTimer > 0 || !visible) return;
    if (this.maneuver === 'stalk' || this.isLanceActive() || this.maneuver === 'stunned') return;
    this.tmpA.subVectors(this.playerPos, this.mesh.position);
    const distance = this.tmpA.length();
    if (distance > CANNON_RANGE * this.sizeFactor || distance < 1) return;
    if (this.tmpA.divideScalar(distance).dot(this.flight.forward) < CANNON_CONE) return;
    this.burstLeft = tuning.burstShots;
    this.shotTimer = 0;
    this.burstTimer = tuning.burstGap * this.cadence;
    this.emitCue('cannon', this.mesh.position, 0.6);
  }

  private fireCannonShot(): void {
    const muzzle = this.rig.muzzles[this.muzzleIndex % this.rig.muzzles.length];
    this.muzzleIndex++;
    if (!muzzle) return;
    muzzle.getWorldPosition(this.tmpA);
    const distance = this.tmpA.distanceTo(this.playerPos);
    this.tmpB
      .copy(this.playerPos)
      .addScaledVector(this.playerVel, (distance / 100) * CANNON_LEAD)
      .sub(this.tmpA);
    if (this.tmpB.lengthSq() < 1e-6) return;
    this.tmpB.normalize();
    // 轻微散布
    this.tmpB.x += (Math.random() - 0.5) * 0.03;
    this.tmpB.y += (Math.random() - 0.5) * 0.03;
    this.tmpB.z += (Math.random() - 0.5) * 0.03;
    this.tmpB.normalize();
    if (!isFiniteVector(this.tmpB)) return;
    this.fx.emit('createMuzzleFlash', this.tmpA, this.tmpB, 1.1);
    this.onFire?.(this.tmpA.clone(), this.tmpB.clone(), this.config.damage * 0.6);
  }

  private updateMissiles(dt: number, tuning: PhantomPhaseTuning, visible: boolean): void {
    if (this.bayPhase === 'firing') {
      this.missileStagger -= dt;
      if (this.missileQueue > 0 && this.missileStagger <= 0) {
        this.missileStagger = 0.3;
        this.launchMissile();
        this.missileQueue--;
      }
      if (this.missileQueue <= 0) {
        this.bayPhase = 'holding';
        this.bayTimer = 0;
      }
      return;
    }
    if (this.bayPhase !== 'closed') return;
    this.missileTimer -= dt;
    if (this.missileTimer > 0 || !visible || this.isLanceActive()) return;
    this.missileTimer = Math.max(4, this.config.missileFireInterval * tuning.missileFactor);
    this.bayPhase = 'opening';
    this.bayTimer = 0;
    this.missileQueue = tuning.missileCount;
    this.missileFired = 0;
  }

  private updateBay(dt: number): void {
    this.bayTimer += dt;
    let target = 0;
    switch (this.bayPhase) {
      case 'opening':
        target = 1;
        if (this.bayTimer >= BAY_OPEN_TIME) {
          this.bayPhase = 'firing';
          this.bayTimer = 0;
          this.missileStagger = 0;
        }
        break;
      case 'firing':
        target = 1;
        break;
      case 'holding':
        target = 1;
        if (this.bayTimer >= BAY_HOLD_TIME) {
          this.bayPhase = 'closed';
          this.bayTimer = 0;
        }
        break;
      default:
        break;
    }
    const rate = dt / (target > this.bayOpen ? BAY_OPEN_TIME * 0.8 : 0.5);
    this.bayOpen += THREE.MathUtils.clamp(target - this.bayOpen, -rate, rate);
    for (let i = 0; i < this.rig.bayDoors.length; i++) {
      const side = i === 0 ? 1 : -1;
      this.rig.bayDoors[i].rotation.z = side * this.bayOpen * 1.6;
    }
  }

  private launchMissile(): void {
    this.rig.bayLaunch.getWorldPosition(this.tmpA);
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
    // 从弹舱向前下方弹出，再转向目标
    this.tmpB.copy(this.flight.forward).addScaledVector(this.flight.up, -0.4);
    this.missileSystem.fire(
      this.tmpA.clone(),
      target,
      this.friendlyMeshes,
      this.playerMesh,
      target === null,
      { ...BAY_MISSILE, launchDirection: this.tmpB }
    );
    this.missileFired++;
    this.fx.emit('createHit', this.tmpA, 1.4, 'enemy');
    this.onMissileFired?.();
    this.emitCue('missile-launch', this.tmpA, 0.6);
  }

  // ===========================================================================================
  // 全息诱饵
  // ===========================================================================================

  private updateDecoyProjection(dt: number, tuning: PhantomPhaseTuning, visible: boolean): void {
    if (tuning.decoyCount <= 0) return;
    this.decoyTimer -= dt;
    if (this.decoyTimer > 0 || !visible || this.isLanceActive()) return;
    this.decoyTimer = tuning.decoyInterval * this.cadence;
    this.projectDecoys(tuning);
  }

  private projectDecoys(tuning: PhantomPhaseTuning): void {
    const capacity = this.getDecoyCapacity(tuning);
    let needed = capacity - this.getActiveDecoyCount();
    if (needed <= 0) return;
    const sf = this.sizeFactor;
    this.tmpC.crossVectors(this.flight.up, this.flight.forward).normalize();
    let spawned = 0;
    let lateral = 1;
    for (const decoy of this.decoys) {
      if (needed <= 0) break;
      if (decoy.active) continue;
      // 从翼尖相位发射器“投射”到真身两侧
      const offset = (55 + spawned * 22) * sf * lateral;
      decoy.rig.root.position
        .copy(this.mesh.position)
        .addScaledVector(this.tmpC, offset)
        .addScaledVector(this.flight.up, (Math.random() - 0.5) * 20 * sf);
      this.tmpD
        .copy(this.flight.forward)
        .addScaledVector(this.tmpC, lateral * 0.18)
        .normalize();
      decoy.flight.setForward(this.tmpD);
      decoy.flight.speed = this.flight.speed;
      decoy.active = true;
      decoy.dissolving = 0;
      decoy.life = DECOY_LIFE + Math.random() * 3;
      decoy.mode = 'orbit';
      decoy.modeTimer = Math.random() * 2;
      decoy.orbitSign = Math.random() < 0.5 ? -1 : 1;
      decoy.altOffset = (10 + Math.random() * 70) * sf;
      decoy.shotTimer = 1 + Math.random() * 1.5;
      decoy.burstLeft = 0;
      decoy.glitchTimer = 0.6 + Math.random() * 1.6;
      decoy.glitchHold = 0;
      decoy.rig.root.scale.setScalar(1);
      decoy.rig.root.visible = true;
      decoy.flight.orient(decoy.rig.root.quaternion);
      this.fx.emit('createTeleportIn', decoy.rig.root.position);
      lateral = -lateral;
      spawned++;
      needed--;
    }
    if (spawned > 0) {
      for (const emitter of this.emitters) if (emitter.alive) emitter.sparkTimer = -0.6;
      this.warn({ en: 'Holo decoys', zh: '全息诱饵' });
      this.emitCue('decoys', this.mesh.position, 0.8);
      this.statusKey = -1;
    }
  }

  private popDecoy(decoy: DecoyState, byPlayer: boolean): void {
    decoy.dissolving = DECOY_DISSOLVE;
    this.fx.emit('createTeleportOut', decoy.rig.root.position);
    this.fx.emit('createHit', decoy.rig.root.position, 1.6, 'enemy');
    this.emitCue('decoy-pop', decoy.rig.root.position, byPlayer ? 0.8 : 0.5);
    this.statusKey = -1;
  }

  private updateDecoys(dt: number): void {
    const sf = this.sizeFactor;
    for (const decoy of this.decoys) {
      if (!decoy.active) continue;
      const root = decoy.rig.root;
      if (decoy.dissolving > 0) {
        // 消散：故障闪烁 + 横向拉伸后收缩
        decoy.dissolving -= dt;
        const p = 1 - Math.max(0, decoy.dissolving) / DECOY_DISSOLVE;
        root.visible = Math.random() > p * 0.6;
        root.scale.set(1 + p * 0.8, Math.max(0.05, 1 - p), Math.max(0.05, 1 - p * 0.9));
        decoy.flight.integrate(dt);
        if (decoy.dissolving <= 0) {
          decoy.active = false;
          root.visible = false;
          root.scale.setScalar(1);
        }
        continue;
      }
      decoy.life -= dt;
      if (decoy.life <= 0 || this.deathHandled) {
        this.popDecoy(decoy, false);
        continue;
      }
      this.steerDecoy(decoy, dt, sf);
      // 全息故障：偶尔瞬间消失并抖动
      decoy.glitchTimer -= dt;
      if (decoy.glitchHold > 0) {
        decoy.glitchHold -= dt;
        root.visible = decoy.glitchHold <= 0;
      } else if (decoy.glitchTimer <= 0) {
        decoy.glitchTimer = 1 + Math.random() * 2.2;
        decoy.glitchHold = 0.05 + Math.random() * 0.05;
        root.visible = false;
        root.position.addScaledVector(decoy.flight.up, (Math.random() - 0.5) * 3 * sf);
      }
      const flicker = 0.8 + 0.2 * Math.sin(this.time * 31 + decoy.seed);
      for (const flame of decoy.rig.flames)
        flame.scale.set(1.3 * flicker, 0.45, 0.9 + 0.3 * flicker);
      for (const glow of decoy.rig.glows) glow.material.opacity = 0.6 * flicker;
    }
  }

  private steerDecoy(decoy: DecoyState, dt: number, sf: number): void {
    const flight = decoy.flight;
    const position = decoy.rig.root.position;
    const tuning = this.tuning();
    const cruise = Math.max(1, this.config.speed) * tuning.cruise;
    decoy.modeTimer += dt;
    if (!this.hasPlayer) {
      this.desired.copy(flight.forward);
    } else if (decoy.mode === 'orbit') {
      this.tmpA.subVectors(position, this.playerPos).setY(0);
      let distance = this.tmpA.length();
      if (distance < 1e-3) {
        this.tmpA.set(1, 0, 0);
        distance = 1;
      }
      this.tmpA.divideScalar(distance);
      this.desired.set(-this.tmpA.z * decoy.orbitSign, 0, this.tmpA.x * decoy.orbitSign);
      const radius = (this.config.circleRadius * 0.85 + decoy.seed * 20) * sf;
      const radial = THREE.MathUtils.clamp((distance - radius) / Math.max(1, radius), -1, 1);
      this.desired.addScaledVector(this.tmpA, -radial * 1.4);
      this.desired.y = THREE.MathUtils.clamp(
        (this.playerPos.y + decoy.altOffset - position.y) / 70,
        -0.6,
        0.6
      );
      if (decoy.modeTimer > 3.5 + decoy.seed) {
        decoy.mode = 'pass';
        decoy.modeTimer = 0;
      }
    } else if (decoy.mode === 'pass') {
      this.desired.copy(this.playerPos).addScaledVector(this.playerVel, 1).sub(position);
      const distance = this.desired.length();
      // 与真身一样侧向错开的对头掠过
      this.tmpA.set(-this.desired.z, 0, this.desired.x);
      if (this.tmpA.lengthSq() > 1e-4) {
        this.desired.addScaledVector(this.tmpA.normalize(), decoy.orbitSign * 60 * sf);
      }
      if (distance < 130 * sf || decoy.modeTimer > 7) {
        decoy.mode = 'extend';
        decoy.modeTimer = 0;
      }
      this.updateDecoyGuns(decoy, dt, distance);
    } else {
      this.desired.copy(flight.forward);
      this.desired.y = 0.2;
      this.tmpA.subVectors(position, this.playerPos).setY(0);
      const distance = this.tmpA.length();
      if (distance < 200 * sf && distance > 1e-3 && this.tmpA.dot(flight.forward) < 0) {
        this.desired.addScaledVector(this.tmpA.divideScalar(distance), 0.9);
      }
      if (decoy.modeTimer > 2) {
        decoy.mode = 'orbit';
        decoy.modeTimer = 0;
        decoy.orbitSign = decoy.orbitSign > 0 ? -1 : 1;
      }
    }
    if (position.y < MIN_ALTITUDE + 40 * sf) this.desired.y += 0.8;
    if (this.desired.lengthSq() < 1e-8) this.desired.copy(flight.forward);
    flight.steer(dt, this.desired, Math.max(0.05, this.config.turnSpeed) * tuning.turn, 0.62);
    flight.throttle(dt, cruise * (decoy.mode === 'pass' ? 1.15 : 1), 1.1);
    flight.integrate(dt);
    if (!isFiniteVector(position)) {
      position.copy(this.mesh.position);
      flight.speed = cruise;
    }
    flight.orient(decoy.rig.root.quaternion);
  }

  /** 诱饵的“射击”：只有全息曳光，没有伤害 */
  private updateDecoyGuns(decoy: DecoyState, dt: number, distance: number): void {
    decoy.shotTimer -= dt;
    if (decoy.shotTimer > 0) return;
    if (distance > CANNON_RANGE * this.sizeFactor) return;
    this.tmpB.subVectors(this.playerPos, decoy.rig.root.position).normalize();
    if (this.tmpB.dot(decoy.flight.forward) < CANNON_CONE) return;
    if (decoy.burstLeft <= 0) decoy.burstLeft = 4;
    decoy.burstLeft--;
    decoy.shotTimer = decoy.burstLeft > 0 ? BURST_SPACING : 1.8 + Math.random();
    this.tmpA
      .copy(decoy.rig.root.position)
      .addScaledVector(decoy.flight.forward, 12 * this.sizeFactor);
    this.tmpB.x += (Math.random() - 0.5) * 0.05;
    this.tmpB.y += (Math.random() - 0.5) * 0.05;
    this.tracers.fire(this.tmpA, this.tmpB, 260, 1.6);
  }

  // ===========================================================================================
  // 子目标 / 阶段 / 死亡
  // ===========================================================================================

  private destroyEmitter(emitter: EmitterState): void {
    if (!emitter.alive) return;
    emitter.alive = false;
    emitter.hp = 0;
    emitter.subTarget.current = 0;
    emitter.rig.pod.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 1.8, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 1.6, 'boss-armor');
    emitter.rig.lensMaterial.emissive.set(0xff5a2a);
    // 可同时维持的诱饵变少：多余的诱饵立即消散
    const capacity = this.getDecoyCapacity(this.tuning());
    let active = this.getActiveDecoyCount();
    for (const decoy of this.decoys) {
      if (active <= capacity) break;
      if (decoy.active && decoy.dissolving <= 0) {
        this.popDecoy(decoy, false);
        active--;
      }
    }
    // 隐形中被打掉（只可能在现形窗口内发生）：相位场立即减弱
    if (this.cloakLevel > this.getCloakCap()) this.cloakLevel = this.getCloakCap();
    this.emitCue('emitter-destroyed', this.tmpA, 1);
    this.statusKey = -1;
  }

  private evaluatePhase(): void {
    if (!this.isAlive()) return;
    const ratio = this.health.getCurrentHealth() / Math.max(1, this.health.getMaxHealth());
    let target = 1;
    if (ratio <= PHASE3_RATIO) target = 3;
    else if (ratio <= PHASE2_RATIO) target = 2;
    while (this.phase < target && !this.disposed) this.enterPhase(this.phase + 1);
    if (!this.lowHealthReached && ratio <= LOW_HEALTH_RATIO) {
      this.lowHealthReached = true;
      this.statusKey = -1;
      this.emitCue('cloak-fail', this.mesh.position, 1);
    }
  }

  private enterPhase(phase: number): void {
    this.phase = Math.min(PHASE_COUNT, phase);
    const label =
      this.phase === 2
        ? { en: 'Holo decoys · Find the real one', zh: '全息诱饵 · 真假难辨' }
        : { en: 'Overclock · Lance barrage', zh: '超频 · 长矛连击' };
    const tuning = this.tuning();
    this.decoyTimer = Math.min(this.decoyTimer, 1.5);
    this.lanceTimer = Math.min(this.lanceTimer, 4);
    if (this.phase >= 3 && !this.overdriveAnnounced) {
      this.overdriveAnnounced = true;
      this.emitCue('overdrive', this.mesh.position, 1);
    }
    this.fx.emit('createShockwave', this.mesh.position, 90 * this.sizeFactor, 0.8, 0xb48aff, 0.8);
    this.fx.emit('createEmpBurst', this.mesh.position, 40 * this.sizeFactor);
    // 阶段切换时立刻投射一轮诱饵（第 2 阶段的标志）
    if (this.cloakPhase === 'visible') this.projectDecoys(tuning);
    this.statusKey = -1;
    this.emitCue('phase', this.mesh.position, 1);
    this.onPhaseChange?.(this.phase, label);
  }

  private handleHealthDepleted(): void {
    if (this.deathHandled) return;
    this.deathHandled = true;
    this.lance.clear();
    for (const missile of this.missileSystem.getMissiles()) missile.takeDamage(1e6);
    for (const decoy of this.decoys) {
      if (decoy.active && decoy.dissolving <= 0) this.popDecoy(decoy, false);
    }
    this.collisionParts.length = 0;
    this.cloakLevel = 0;
    this.statusKey = -1;
    if (this.deathSequenceEnabled && !this.disposed) {
      this.dying = true;
      this.deathTimer = 0;
      this.deathBurstTimer = 0;
      this.deathSpin = 0;
      this.emitCue('crash', this.mesh.position, 1);
      return;
    }
    this.finishDeath();
  }

  private updateDeathSequence(dt: number): void {
    this.deathTimer += dt;
    const p = Math.min(1, this.deathTimer / DEATH_SEQUENCE_DURATION);
    const sf = this.sizeFactor;
    // 失控螺旋下坠：机头逐渐压低、绕机头轴加速滚转
    this.desired.copy(this.flight.forward);
    this.desired.y -= 0.6 + p;
    this.flight.steer(dt, this.desired, 0.9, 1.2);
    this.flight.throttle(dt, Math.max(1, this.config.speed) * 2.6, 0.8);
    this.flight.integrate(dt);
    this.deathSpin += dt * (1.5 + 4 * p);
    this.flight.orient(this.mesh.quaternion, this.deathSpin);
    this.mesh.updateMatrixWorld(true);
    this.sweepGain = 0.6 + 0.4 * Math.sin(this.time * 23);
    this.sweep = (Math.random() - 0.5) * this.rig.length;
    this.cloakLevel = 0.15 * Math.random();
    this.applyCloakVisuals();
    this.deathBurstTimer -= dt;
    if (this.deathBurstTimer <= 0) {
      this.deathBurstTimer = 0.18;
      for (const engine of this.rig.engines) {
        engine.nozzle.getWorldPosition(this.tmpA);
        this.fx.emit('createDamageSmoke', this.tmpA, 1);
      }
      if (Math.random() < 0.45) {
        this.tmpA.set(
          (Math.random() - 0.5) * this.rig.halfSpan * 1.6,
          0,
          (Math.random() - 0.5) * this.rig.length
        );
        this.mesh.localToWorld(this.tmpA);
        this.fx.emit('createExplosion', this.tmpA, 1.2 + p, 'enemy');
      }
    }
    const floor = MIN_ALTITUDE - 20 * sf;
    if (p >= 1 || this.mesh.position.y < floor) this.finishDeath();
  }

  private finishDeath(): void {
    this.dying = false;
    this.mesh.updateMatrixWorld(true);
    this.tmpA.copy(this.mesh.position);
    if (!isFiniteVector(this.tmpA)) this.tmpA.set(0, 100, 0);
    const position = this.tmpA.clone();
    this.onDestroy?.(position, this.config);
    const sf = this.sizeFactor;
    this.fx.emit('createBossDeathExplosion', position, 1.8);
    this.fx.emit('createShockwave', position, 160 * sf, 1.2, 0xb48aff, 0.85);
    this.fx.emit('createShockwave', position, 100 * sf, 0.9, 0xff4a5a, 0.85);
    this.fx.emit('createEmpBurst', position, 60 * sf);
    this.emitCue('crash', position, 1);
  }

  // ===========================================================================================
  // 视觉
  // ===========================================================================================

  /** 隐形淡出：机体材质透明度、深度写入与光晕强度随相位场变化 */
  private applyCloakVisuals(): void {
    const visibility = 1 - this.cloakLevel * 0.96;
    const writeDepth = visibility > 0.55;
    for (const entry of this.rig.fadeMaterials) {
      entry.material.opacity = entry.base * visibility;
      entry.material.depthWrite = writeDepth;
    }
    const shimmer = this.rig.materials.shimmer;
    const uniforms = shimmer.uniforms;
    uniforms.uTime.value = this.time;
    uniforms.uSweep.value = this.sweep;
    uniforms.uSweepGain.value = this.sweepGain;
    uniforms.uRim.value = this.cloakLevel;
    uniforms.uFlash.value = this.hitFlash;
    uniforms.uPeel.value = this.lowHealthReached ? 0.9 : this.phase >= 3 ? 0.25 : 0;
    this.rig.shimmer.visible =
      this.sweepGain > 0.01 ||
      this.cloakLevel > 0.02 ||
      this.hitFlash > 0.02 ||
      uniforms.uPeel.value > 0;
  }

  private updateVisuals(dt: number): void {
    const t = this.time;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.applyCloakVisuals();
    const visibility = 1 - this.cloakLevel * 0.96;
    const materials = this.rig.materials;
    const overdrive = this.phase >= 3 ? 1 : 0;
    const strafing = this.maneuver === 'lance-fire' ? 1 : 0;

    // 接缝 / 传感器 / 棱镜
    materials.seam.emissiveIntensity =
      (1.6 + 0.3 * Math.sin(t * 2.3) + overdrive * 0.8) * (this.stunTimer > 0 ? 0.3 : 1);
    materials.eye.emissiveIntensity = 2.4 + 0.6 * Math.sin(t * 5) + overdrive;
    this.rig.eyeGlow.material.opacity = 0.55 * visibility;
    let prism = 1.2 + 0.3 * Math.sin(t * 4);
    let prismGlow = 0.3;
    let prismSize = 2.4;
    if (this.maneuver === 'lance-telegraph') {
      const c = Math.min(1, this.maneuverTimer / Math.max(0.1, this.tuning().lanceTelegraph));
      prism = 2 + 6 * c + 1.5 * Math.sin(t * (20 + 30 * c));
      prismGlow = 0.5 + 0.35 * c;
      prismSize = 3 + 4 * c;
    } else if (this.maneuver === 'lance-fire') {
      prism = 8 + 2 * Math.sin(t * 40);
      prismGlow = 0.7;
      prismSize = 4.5;
    }
    materials.prism.emissiveIntensity = prism;
    const prismScale = prismSize * this.rig.scale;
    this.rig.prismGlow.scale.set(prismScale, prismScale, 1);
    this.rig.prismGlow.material.opacity = prismGlow * visibility;

    // 尾焰：真身为红色；隐形时仍残留一丝红色闪烁（细心的玩家能追踪）
    const thrust = 0.75 + 0.25 * Math.sin(t * 29) + strafing * 0.6 + overdrive * 0.4;
    materials.nozzle.emissiveIntensity = 1.8 + thrust;
    materials.flame.opacity = Math.max(0.08, visibility) * 0.75;
    for (const engine of this.rig.engines) {
      engine.flame.scale.set(1.3 * thrust, 0.45, 0.8 + 0.6 * thrust);
      const size = (3.6 + 1.6 * thrust) * this.rig.scale;
      engine.glow.scale.set(size, size, 1);
      // 隐形时尾焰只剩一丝随机闪烁
      const residual = 0.04 + 0.06 * Math.max(0, Math.sin(t * 17 + engine.flame.id));
      engine.glow.material.opacity = Math.max(residual, visibility) * (0.55 + 0.2 * thrust);
    }

    // 相位发射器：投射诱饵时闪光；被毁后冒火花
    for (const emitter of this.emitters) {
      emitter.sparkTimer += dt;
      if (emitter.alive) {
        const flare = emitter.sparkTimer < 0 ? 1 : 0;
        emitter.rig.lensMaterial.emissiveIntensity =
          2 + 0.6 * Math.sin(t * 6 + emitter.rig.index) + flare * 5 + this.cloakLevel * 1.5;
        const size = (3.2 + flare * 4) * this.rig.scale;
        emitter.rig.glow.scale.set(size, size, 1);
        emitter.rig.glow.material.opacity = (0.55 + flare * 0.4) * Math.max(0.08, visibility);
      } else {
        emitter.rig.lensMaterial.emissiveIntensity = 0.6 + 0.5 * Math.abs(Math.sin(t * 13));
        emitter.rig.glow.material.opacity = 0.25 * visibility;
        if (emitter.sparkTimer > 0.4) {
          emitter.sparkTimer = Math.random() * 0.2;
          emitter.rig.pod.getWorldPosition(this.tmpA);
          this.fx.emit('createHit', this.tmpA, 1.1, 'enemy');
        }
      }
    }

    // 导弹舱
    materials.bayInterior.emissiveIntensity = 0.2 + this.bayOpen * (2.6 + 0.5 * Math.sin(t * 12));

    // 低血量：涂层剥落冒烟
    if (this.lowHealthReached || this.phase >= 3) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = this.lowHealthReached ? 0.12 : 0.3;
        const engine = this.rig.engines[Math.floor(Math.random() * this.rig.engines.length)];
        if (engine) {
          engine.nozzle.getWorldPosition(this.tmpA);
          this.fx.emit('createDamageSmoke', this.tmpA, this.lowHealthReached ? 0.9 : 0.4);
        }
      }
    }
  }
}
