import * as THREE from 'three';
import { BOSS_CONFIGS, BossType, type BossConfig } from './BossTypes';
import { BossMissileSystem } from './BossMissileSystem';
import type { BossHazardHit, BossMinionKind, BossSubTarget, IAdvancedBoss } from './BossContracts';
import { HealthSystem } from '@/features/combat/HealthSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import {
  createHazardProbe,
  disposeObjectTree,
  isFiniteVector,
  resetHazardProbe,
  resolveMissileParticles,
} from './MagmaColossusHazards';
import {
  OracleArcStrike,
  OracleDischarge,
  OracleFx,
  OracleLance,
  OracleOrbitalStrikePool,
  OraclePinwheel,
  OracleShockwavePool,
  type OracleLanceSpec,
  type OracleRingKind,
  type OracleRingSpec,
} from './OraclePrimeHazards';
import {
  ORACLE_PALETTE,
  composeOraclePetalMatrix,
  createOraclePrimeMesh,
  type OracleEmitterRig,
  type OraclePrimeGroup,
  type OraclePrimeRig,
  type OraclePylonRig,
} from './OraclePrimeMesh';
import { ORACLE_SHIELD_MAX_HITS } from './OraclePrimeShaders';

export { createOraclePrimeMesh } from './OraclePrimeMesh';

/**
 * 第十关（最终关）Boss「神谕主宰」ORACLE PRIME —— 敌方战争智能的心脏。
 *
 * 阶段 1「护盾矩阵」：核心被护盾包裹（isInvulnerable() 为 true，核心与护盾不受伤害），
 *   4 座水晶护盾塔绕核心公转并以系索为护盾供能。塔是独立目标（各自血量，伤害不计入 Boss 血量，
 *   与利维坦的水雷同理：核心无敌期间仍可受伤），每座塔有专属攻击：
 *   棱镜塔（金）扇形等离子弹 · 电弧塔（蓝）锁定点电球 → 落雷 · 追猎塔（紫）追踪导弹 / 无人机 ·
 *   光矛塔（白青）追踪 → 锁定变白 → 狙击光矛。塔在蓄力 / 被 EMP 瘫痪时受伤 ×1.5。
 *   核心透过护盾开口以瞳孔点射；每毁一座塔核心报复性齐射导弹、其余塔公转加速。
 * 过渡「护盾崩溃」（约 3 秒，无敌）：护盾闪白、溶解碎裂，十二面体花瓣绽开，核心暴露。
 * 阶段 2「审判光阵」：核心可受伤；赤道光环的 4 个发射器（子目标，伤害同时计入 Boss 血量）
 *   旋转扫掠（琥珀色虚线预警并缓慢转动指示方向）；瞳孔“审判之矛”追踪 → 锁定 → 发射，
 *   之后瞳孔过热收缩（弱点 ×2.2）；导弹齐射、无人机群、点射。血量在 40% 处设底，保证进入阶段 3。
 * 过渡「核心过载」（约 2.4 秒，无敌）：花瓣炸开成环绕碎片，核心转为紫白色。
 * 阶段 3「过载」：门环冲击波（带绿色安全航道指示的缺口，可穿越或远离）与双环冲击波
 *   （上下两道，与核心同高处安全）交替；天罚光柱追着玩家航迹落下；倾斜风车光阵与三连审判之矛。
 *   核心整体弱化 ×1.35。血量 ≤ 15% 时一次性释放「终焉之光」（蓄力后三连冲击环），之后核心衰竭
 *   （弱点 ×2.4，5 秒）。
 * 死亡：默认归零同步 onDestroy；setDeathSequenceEnabled(true) 后先播放约 6.4 秒的崩解演出
 *   （凝滞 → 内爆坍缩 → 白光新星），结束时才触发 onDestroy。
 *
 * EMP（applyStun）：阶段 1 让全部护盾塔停摆；阶段 2/3 打断光阵 / 审判之矛 / 预警中的冲击环并让
 *   瞳孔过热；之后 10 秒抗性。
 */

export type OraclePrimeCue =
  | 'awaken'
  | 'pylon-charge'
  | 'prism-fire'
  | 'arc-telegraph'
  | 'arc-strike'
  | 'lance-lock'
  | 'lance-fire'
  | 'seeker-launch'
  | 'pylon-destroyed'
  | 'shield-hit'
  | 'shield-collapse'
  | 'core-exposed'
  | 'pinwheel-charge'
  | 'pinwheel-fire'
  | 'judgement-charge'
  | 'judgement-lock'
  | 'judgement-fire'
  | 'aperture-open'
  | 'missile-launch'
  | 'drone-launch'
  | 'emitter-destroyed'
  | 'overload'
  | 'shockwave-charge'
  | 'shockwave'
  | 'orbital-telegraph'
  | 'orbital-strike'
  | 'last-light'
  | 'critical'
  | 'stun'
  | 'death-freeze'
  | 'death-implode'
  | 'death-flash';

/** 战斗阶段细分（getPhase：intro/aegis → 1，collapse/arrays → 2，overload-rise/overload → 3） */
export type OraclePrimeStage =
  | 'intro'
  | 'aegis'
  | 'collapse'
  | 'arrays'
  | 'overload-rise'
  | 'overload';

type PylonAttack = 'idle' | 'charge' | 'active' | 'recover';
type MajorAttack =
  | 'pinwheel'
  | 'judgement'
  | 'judgement3'
  | 'crown'
  | 'twin'
  | 'orbital'
  | 'last-light';
type PartRole = 'core' | 'emitter' | 'armor' | 'shield' | 'pylon';
type PetalMode = 'closed' | 'opening' | 'open' | 'debris';

interface PylonState {
  rig: OraclePylonRig;
  hp: number;
  max: number;
  alive: boolean;
  subTarget: BossSubTarget;
  attack: PylonAttack;
  attackTimer: number;
  actionTimer: number;
  activations: number;
  angle: number;
  flash: number;
  /** 被毁后的坠落演出 */
  fallTimer: number;
  fallVelocity: number;
  spin: number;
}

interface EmitterState {
  rig: OracleEmitterRig;
  hp: number;
  max: number;
  alive: boolean;
  subTarget: BossSubTarget;
  vent: number;
  charge: number;
  flash: number;
}

interface PhaseTuning {
  cannonInterval: number;
  cannonCount: number;
  missileFactor: number;
  missileCount: number;
  minionInterval: number;
  minions: readonly BossMinionKind[];
  beatGap: number;
  hoverAmplitude: number;
}

const PHASE_TUNING: readonly PhaseTuning[] = [
  {
    cannonInterval: 3.4,
    cannonCount: 3,
    missileFactor: 1.4,
    missileCount: 2,
    minionInterval: 0,
    minions: [],
    beatGap: 0,
    hoverAmplitude: 40,
  },
  {
    cannonInterval: 2.8,
    cannonCount: 4,
    missileFactor: 1.5,
    missileCount: 3,
    minionInterval: 30,
    minions: ['drone', 'drone', 'drone'],
    beatGap: 2.6,
    hoverAmplitude: 55,
  },
  {
    cannonInterval: 2.3,
    cannonCount: 5,
    missileFactor: 1.4,
    missileCount: 3,
    minionInterval: 28,
    minions: ['drone', 'drone', 'fighter'],
    beatGap: 1.7,
    hoverAmplitude: 70,
  },
];

const ARRAY_BEATS: readonly MajorAttack[] = [
  'pinwheel',
  'judgement',
  'judgement',
  'pinwheel',
  'judgement',
];
const OVERLOAD_BEATS: readonly MajorAttack[] = [
  'crown',
  'orbital',
  'twin',
  'pinwheel',
  'crown',
  'judgement3',
  'twin',
  'orbital',
];

const PHASE_COUNT = 3;
const OVERLOAD_RATIO = 0.4;
const CRITICAL_RATIO = 0.15;
const LOW_HEALTH_RATIO = 0.25;
const PYLON_HEALTH_RATIO = 0.07;
const EMITTER_HEALTH_RATIO = 0.045;
const INTRO_DURATION = 3.2;
const COLLAPSE_DURATION = 3.0;
const OVERLOAD_RISE_DURATION = 2.4;
const DEATH_SEQUENCE_DURATION = 6.4;
const DEATH_FREEZE_END = 1.6;
const DEATH_IMPLODE_END = 4.6;
const MAX_STEP_DT = 0.1;
const MAX_CONCURRENT_PYLON_ATTACKS = 2;
const STUN_MAX = 3;
const STUN_IMMUNITY = 10;
const APERTURE_TIME = 3.5;
const VENT_TIME = 3.2;
const EXHAUST_TIME = 5;
const CANNON_RANGE = 520;
const PYLON_RANGE = 900;
const LEASH_RADIUS = 420;
const FOLLOW_DISTANCE = 700;

const PYLON_INTERVALS: Readonly<Record<OraclePylonRig['role'], number>> = {
  prism: 5.2,
  arc: 6.2,
  seeker: 8.5,
  lance: 6.8,
};
const PYLON_CHARGE: Readonly<Record<OraclePylonRig['role'], number>> = {
  prism: 0.9,
  arc: 0.5,
  seeker: 0.8,
  lance: 0.4,
};
const PYLON_FIRST_ATTACK: readonly number[] = [2.2, 3.6, 5.2, 2.9];

const UP = new THREE.Vector3(0, 1, 0);
const OVERLOAD_COLOR = new THREE.Color(ORACLE_PALETTE.overload);
const OVERLOAD_HOT = new THREE.Color(ORACLE_PALETTE.overloadHot);
const CORE_COLOR = new THREE.Color(ORACLE_PALETTE.core);
const CYAN_COLOR = new THREE.Color(ORACLE_PALETTE.cyan);
const LATTICE_COLOR = new THREE.Color(0x6ff4ff);
const GOLD_COLOR = new THREE.Color(ORACLE_PALETTE.gold);

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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export class OraclePrimeAI implements IAdvancedBoss {
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onPhaseChange?: (phase: number, label: string) => void;
  public onSpawnMinion?: (position: THREE.Vector3, kind: BossMinionKind) => void;
  public onHazardWarning?: (label: string) => void;
  /** 扩展钩子：音效 / 镜头震动 / 屏幕闪光提示（position 为复用向量，需要保存请 clone） */
  public onEffectCue?: (cue: OraclePrimeCue, position: THREE.Vector3, intensity: number) => void;

  private readonly mesh: THREE.Group;
  private readonly config: BossConfig;
  private readonly fx: OracleFx;
  private readonly health: HealthSystem;
  private readonly missileSystem: BossMissileSystem;
  private readonly rig: OraclePrimeRig;
  private readonly hazardRoot: THREE.Group;
  private readonly pinwheel: OraclePinwheel;
  private readonly judgement: OracleLance;
  private readonly pylonLance: OracleLance;
  private readonly arcStrike: OracleArcStrike;
  private readonly shockwaves: OracleShockwavePool;
  private readonly orbitals: OracleOrbitalStrikePool;
  private readonly discharges: OracleDischarge;
  private readonly pylons: PylonState[] = [];
  private readonly emitters: EmitterState[] = [];
  private readonly pylonSubTargets: BossSubTarget[] = [];
  private readonly emitterSubTargets: BossSubTarget[] = [];
  private readonly subTargets: BossSubTarget[] = [];
  private readonly collisionParts: THREE.Object3D[] = [];
  private readonly partRoles = new Map<THREE.Object3D, PartRole>();
  private readonly pylonByPart = new Map<THREE.Object3D, PylonState>();
  private readonly emitterByPart = new Map<THREE.Object3D, EmitterState>();
  private readonly probe = createHazardProbe();
  private readonly cadence: number;
  private readonly sizeFactor: number;
  private readonly spawnAnchor = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  private readonly hoverTarget = new THREE.Vector3();
  private readonly fallbackGroundY: number;
  private groundSampler: ((x: number, z: number) => number) | null = null;

  private stage: OraclePrimeStage = 'intro';
  private stageTimer = 0;
  private phase = 1;
  private time = 0;
  private disposed = false;
  private dying = false;
  private deathHandled = false;
  private deathSequenceEnabled = false;
  private deathTimer = 0;
  private deathBurstTimer = 0;
  private deathStageCue = 0;
  private partsDirty = true;
  private statusLabel: string | null = null;
  private statusKey = -1;

  // 护盾
  private shieldFade = 0;
  private shieldFlash = 0;
  private shieldScale = 1;
  private nextShieldHit = 0;
  private lastShieldRipple = -1;
  private lastShieldCue = -1;
  private pylonOrbitSpeed = 0.16;
  private pylonOrbitRadiusFactor = 0.3;
  private retaliationTimer = 0;
  private retaliationCount = 0;
  private prismEchoTimer = -1;

  // 花瓣
  private petalMode: PetalMode = 'closed';
  private petalOpen = 0;
  private debrisBlend = 0;
  private implode = 0;

  // 指挥器（阶段 2/3 的大招节拍）
  private beatIndex = 0;
  private beatGap = 1.5;
  private major: MajorAttack | null = null;
  private majorTimer = 0;
  private majorStep = 0;
  private haloSpin = 0;
  private haloSpeed = 0.06;
  private pinwheelDirection: 1 | -1 = 1;
  private pinwheelOmega = 0.3;
  private pinwheelTilt = 0;
  private apertureTimer = 0;
  private exhaustTimer = 0;
  private lastLightDone = false;
  private lastLightRise = 0;
  private lowHealthReached = false;
  private criticalReached = false;

  // 常规火力
  private cannonTimer = 2.5;
  private cannonQueue = 0;
  private cannonStagger = 0;
  private cannonCursor = 0;
  private missileTimer = 6;
  private missileQueue = 0;
  private missileStagger = 0;
  private missileFired = 0;
  private minionTimer = 12;
  private dischargeTimer = 1;

  // EMP
  private stunTimer = 0;
  private stunImmunity = 0;

  // 视觉
  private hitFlash = 0;
  private coreCharge = 0;
  private coreFlare = 0;
  private overloadMix = 0;
  private pupilOpen = 1;
  private yaw = 0;

  private readonly playerPos = new THREE.Vector3();
  private readonly playerVel = new THREE.Vector3();
  private readonly lastPlayerPos = new THREE.Vector3();
  private hasPlayer = false;
  private hasLastPlayer = false;
  private playerMesh: THREE.Object3D | null = null;
  private friendlyMeshes: THREE.Object3D[] = [];

  private readonly coreWorld = new THREE.Vector3();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly tmpD = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpQuatB = new THREE.Quaternion();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpMatrixB = new THREE.Matrix4();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpColor = new THREE.Color();
  private readonly cuePosition = new THREE.Vector3();
  private readonly lanceSpec: OracleLanceSpec = {
    trackTime: 1.5,
    lockTime: 0.5,
    fireTime: 1.1,
    radius: 6,
    length: 900,
    damage: 0,
    trackRate: 2.2,
  };
  private readonly ringSpec: OracleRingSpec = {
    kind: 'crown',
    telegraphTime: 1.8,
    startRadius: 50,
    duration: 8.5,
    height: 110,
    slotHalfHeight: 0,
    gaps: [],
    gapHalfAngle: 0.2,
    damage: 0,
    v0: 120,
    tau: 3.2,
    vMin: 18,
    bandWidth: 9,
  };
  private readonly gapAngles: number[] = [0, 0, 0];
  private readonly spokeMask: boolean[] = [false, false, false, false];

  constructor(
    mesh: THREE.Group,
    config: BossConfig,
    scene: THREE.Scene,
    particleSystem: ParticleSystem
  ) {
    this.mesh = mesh;
    this.config = config;
    this.fx = new OracleFx(particleSystem);
    const maxHealth = Number.isFinite(config.health) && config.health > 0 ? config.health : 1;
    this.health = new HealthSystem(maxHealth);
    this.health.onDeath = () => this.handleHealthDepleted();
    this.missileSystem = new BossMissileSystem(scene, resolveMissileParticles(particleSystem));
    this.rig = this.ensureRig(mesh, config);
    this.sizeFactor = this.rig.scale / 6;
    const base = BOSS_CONFIGS[BossType.ORACLE_PRIME];
    this.cadence = THREE.MathUtils.clamp(
      safeRatio(config.cannonFireInterval, base.cannonFireInterval),
      0.5,
      2
    );

    if (!isFiniteVector(mesh.position)) mesh.position.set(0, 160, 0);
    mesh.quaternion.identity();
    this.spawnAnchor.copy(mesh.position);
    this.anchor.copy(mesh.position);
    this.hoverTarget.copy(mesh.position);
    this.fallbackGroundY = mesh.position.y - 200 * this.sizeFactor;

    const sf = this.sizeFactor;
    this.hazardRoot = new THREE.Group();
    this.hazardRoot.name = 'oracle_hazards';
    scene.add(this.hazardRoot);
    this.pinwheel = new OraclePinwheel(this.hazardRoot, this.rig.emitters.length, 0x6ff0ff);
    this.judgement = new OracleLance(this.hazardRoot, 'oracle_judgement', 0xffd27a, 0xffffff);
    this.pylonLance = new OracleLance(this.hazardRoot, 'oracle_pylon_lance', 0xa8fff6, 0xffffff);
    this.arcStrike = new OracleArcStrike(this.hazardRoot, 'oracle_arc', 0x6fb4ff);
    this.shockwaves = new OracleShockwavePool(this.hazardRoot, 6, sf, {
      color: ORACLE_PALETTE.overload,
      hot: ORACLE_PALETTE.overloadHot,
      gate: 0xfff1d0,
    });
    this.shockwaves.onEmit = (center, kind) => this.handleRingEmit(center, kind);
    this.orbitals = new OracleOrbitalStrikePool(this.hazardRoot, 8, 0xd070ff);
    this.orbitals.onStrike = (ground, radius) => this.handleOrbitalStrike(ground, radius);
    this.discharges = new OracleDischarge(this.hazardRoot, 3, 0xc890ff);

    // 子目标：护盾塔（独立血池）与光阵发射器（伤害同时计入 Boss 血量）
    const pylonMax = Math.max(1, Math.round(maxHealth * PYLON_HEALTH_RATIO));
    this.rig.pylons.forEach((pylonRig, index) => {
      const subTarget: BossSubTarget = { mesh: pylonRig.crystal, current: pylonMax, max: pylonMax };
      const state: PylonState = {
        rig: pylonRig,
        hp: pylonMax,
        max: pylonMax,
        alive: true,
        subTarget,
        attack: 'idle',
        attackTimer: INTRO_DURATION + (PYLON_FIRST_ATTACK[index] ?? 3),
        actionTimer: 0,
        activations: 0,
        angle: pylonRig.baseAngle,
        flash: 0,
        fallTimer: 0,
        fallVelocity: 0,
        spin: 0,
      };
      this.pylons.push(state);
      this.pylonSubTargets.push(subTarget);
      this.pylonByPart.set(pylonRig.crystal, state);
      this.partRoles.set(pylonRig.crystal, 'pylon');
    });
    const emitterMax = Math.max(1, Math.round(maxHealth * EMITTER_HEALTH_RATIO));
    for (const emitterRig of this.rig.emitters) {
      const subTarget: BossSubTarget = {
        mesh: emitterRig.lens,
        current: emitterMax,
        max: emitterMax,
      };
      const state: EmitterState = {
        rig: emitterRig,
        hp: emitterMax,
        max: emitterMax,
        alive: true,
        subTarget,
        vent: 0,
        charge: 0,
        flash: 0,
      };
      this.emitters.push(state);
      this.emitterSubTargets.push(subTarget);
      this.emitterByPart.set(emitterRig.lens, state);
      this.partRoles.set(emitterRig.lens, 'emitter');
    }
    this.subTargets.push(...this.pylonSubTargets);
    this.partRoles.set(this.rig.core, 'core');
    this.partRoles.set(this.rig.shieldProxy, 'shield');
    for (const proxy of this.rig.petalProxies) this.partRoles.set(proxy, 'armor');
    for (const proxy of this.rig.haloProxies) this.partRoles.set(proxy, 'armor');

    this.missileTimer = INTRO_DURATION + Math.max(4, config.missileFireInterval * 0.9);
    this.cannonTimer = INTRO_DURATION + 2;
    this.rig.shieldMaterial.uniforms.uFade.value = 0;
    this.layoutPylons(0);
    this.poseTethers();
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

    this.updateStage(dt);
    this.updateMovement(dt);
    this.animateRig(dt);
    this.mesh.updateMatrixWorld(true);
    this.rig.core.getWorldPosition(this.coreWorld);
    this.updateCombat(dt);
    if (this.disposed) return;
    this.updateHazards(dt);
    this.missileSystem.update(dt);
    this.updateVisuals(dt);
    if (this.partsDirty) this.rebuildCollisionParts();
  }

  public takeDamage(amount: number): void {
    if (this.disposed || !this.isAlive() || this.isInvulnerable()) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.hitFlash = Math.min(1, this.hitFlash + 0.3);
    this.applyCoreDamage(amount);
  }

  public takeDamageAt(part: THREE.Object3D, amount: number): void {
    if (this.disposed || !this.isAlive()) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    // 护盾塔是独立目标：核心无敌期间照常受伤，且不计入 Boss 血量
    const pylon = this.pylonByPart.get(part);
    if (pylon) {
      if (!pylon.alive || !this.isShieldStage()) return;
      const dealt = amount * this.getPylonMultiplier(pylon);
      pylon.hp = Math.max(0, pylon.hp - dealt);
      pylon.subTarget.current = pylon.hp;
      pylon.flash = Math.min(1, pylon.flash + 0.45);
      if (pylon.hp <= 0) this.destroyPylon(pylon);
      return;
    }
    if (part === this.rig.shieldProxy || this.isInvulnerable()) {
      this.registerShieldHit();
      return;
    }

    const multiplier = this.getDamageMultiplier(part);
    const dealt = amount * multiplier;
    if (!(dealt > 0)) return;
    const emitter = this.emitterByPart.get(part);
    if (emitter && emitter.alive) {
      emitter.hp = Math.max(0, emitter.hp - dealt);
      emitter.subTarget.current = emitter.hp;
      emitter.flash = Math.min(1, emitter.flash + 0.5);
      if (emitter.hp <= 0) this.destroyEmitter(emitter);
    }
    this.hitFlash = Math.min(1, this.hitFlash + (multiplier > 1 ? 0.45 : 0.22));
    this.applyCoreDamage(dealt);
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

  /** 护盾未破（含苏醒）、阶段过渡、死亡演出期间核心无敌；护盾塔不受此限 */
  public isInvulnerable(): boolean {
    if (this.dying || this.deathHandled) return true;
    return this.stage !== 'arrays' && this.stage !== 'overload';
  }

  public getDamageMultiplier(part: THREE.Object3D): number {
    if (this.dying || this.deathHandled) return 0;
    const pylon = this.pylonByPart.get(part);
    if (pylon) return pylon.alive && this.isShieldStage() ? this.getPylonMultiplier(pylon) : 0;
    if (this.isInvulnerable()) return 0;
    const role = this.partRoles.get(part) ?? 'armor';
    switch (role) {
      case 'core':
        if (this.exhaustTimer > 0) return 2.4;
        if (this.apertureTimer > 0 || this.stunTimer > 0) return this.phase >= 3 ? 2.4 : 2.2;
        return this.phase >= 3 ? 1.35 : 1;
      case 'emitter': {
        const emitter = this.emitterByPart.get(part);
        if (!emitter || !emitter.alive) return this.getArmorMultiplier();
        return emitter.vent > 0 || this.stunTimer > 0 ? 2 : 1.2;
      }
      case 'shield':
        return 0;
      default:
        return this.getArmorMultiplier();
    }
  }

  public checkHazard(targetPosition: THREE.Vector3, targetRadius: number): BossHazardHit | null {
    if (this.disposed || !targetPosition || !isFiniteVector(targetPosition)) return null;
    if (this.deathHandled) return null;
    const radius = Number.isFinite(targetRadius) && targetRadius > 0 ? targetRadius : 0;
    resetHazardProbe(this.probe);
    this.pinwheel.probe(targetPosition, radius, this.probe);
    this.judgement.probe(targetPosition, radius, this.probe);
    this.pylonLance.probe(targetPosition, radius, this.probe);
    this.arcStrike.probe(targetPosition, radius, this.probe);
    this.shockwaves.probe(targetPosition, radius, this.probe);
    this.orbitals.probe(targetPosition, radius, this.probe);
    this.probeShieldContact(targetPosition, radius);
    if (this.probe.damage <= 0) return null;
    return {
      damage: this.probe.damage,
      profile: this.probe.profile,
      position: this.probe.position.clone(),
    };
  }

  public getStatusLabel(): string | null {
    const code = this.getStatusCode();
    const alivePylons = this.getAlivePylonCount();
    const aliveEmitters = this.getAliveEmitterCount();
    const key = code * 100 + alivePylons * 10 + aliveEmitters;
    if (key === this.statusKey) return this.statusLabel;
    this.statusKey = key;
    switch (code) {
      case 1:
        this.statusLabel = '神谕崩解';
        break;
      case 2:
        this.statusLabel = '电磁干扰 · 护盾塔停摆';
        break;
      case 3:
        this.statusLabel = '电磁瘫痪 · 核心暴露';
        break;
      case 4:
        this.statusLabel = '神谕苏醒 · 护盾充能';
        break;
      case 5:
        this.statusLabel = `护盾塔 ${alivePylons}/${this.pylons.length} · 核心无敌`;
        break;
      case 6:
        this.statusLabel = '护盾崩溃';
        break;
      case 7:
        this.statusLabel = '核心过载';
        break;
      case 8:
        this.statusLabel = '终焉之光';
        break;
      case 9:
        this.statusLabel = '核心衰竭 · 弱点暴露';
        break;
      case 10:
        this.statusLabel = '瞳孔过热 · 弱点暴露';
        break;
      case 11:
        this.statusLabel = '光阵过热 · 发射器暴露';
        break;
      case 12:
        this.statusLabel = '光轮扫掠';
        break;
      case 13:
        this.statusLabel = '审判之矛 · 锁定中';
        break;
      case 14:
        this.statusLabel = '过载冲击环';
        break;
      case 15:
        this.statusLabel = '核心临界';
        break;
      case 16:
        this.statusLabel = '核心过载 · 失稳';
        break;
      default:
        this.statusLabel = `核心暴露 · 光阵 ${aliveEmitters}/${this.emitters.length}`;
    }
    return this.statusLabel;
  }

  /** 阶段 1：4 座护盾塔；护盾崩溃起：4 个光阵发射器（同一个数组对象，内容随阶段替换） */
  public getSubTargets(): BossSubTarget[] {
    return this.subTargets;
  }

  public applyStun(seconds: number): void {
    if (!this.isAlive() || this.disposed || !Number.isFinite(seconds) || seconds <= 0) return;
    if (this.stage === 'intro' || this.stage === 'collapse' || this.stage === 'overload-rise')
      return;
    if (this.stunImmunity > 0) return;
    const duration = Math.min(STUN_MAX, seconds);
    this.stunTimer = duration;
    this.stunImmunity = duration + STUN_IMMUNITY;
    if (this.isShieldStage()) {
      this.pylonLance.clear();
      this.arcStrike.clear();
      for (const pylon of this.pylons) {
        if (!pylon.alive) continue;
        if (pylon.attack !== 'idle') {
          pylon.attack = 'idle';
          pylon.attackTimer = Math.max(pylon.attackTimer, duration + 1.2);
        } else {
          pylon.attackTimer += duration;
        }
        pylon.rig.tip.getWorldPosition(this.tmpA);
        this.fx.emit('createHit', this.tmpA, 1.6, 'boss');
      }
    } else {
      // 「终焉之光」不可打断：EMP 只让瞳孔过热
      if (this.major !== 'last-light') {
        this.interruptMajor(duration + 1);
        this.shockwaves.cancelTelegraphs();
      }
      this.apertureTimer = Math.max(this.apertureTimer, duration);
    }
    this.fx.emit('createHit', this.coreWorld, 2.4, 'boss');
    this.statusKey = -1;
    this.emitCue('stun', this.coreWorld, 0.8);
  }

  /** 扩展：采样地表高度（天罚光柱落点）；未设置时回退到出生高度下方 200 米 */
  public setGroundSampler(sampler: (x: number, z: number) => number): void {
    this.groundSampler = typeof sampler === 'function' ? sampler : null;
  }

  /**
   * 扩展：开启后血量归零先播放约 6.4 秒崩解演出（期间 isAlive() 为 false、无敌、无碰撞部件、
   * 无危险判定），结束时才触发 onDestroy。默认关闭（契约：归零时同步触发）。
   */
  public setDeathSequenceEnabled(enabled: boolean): void {
    this.deathSequenceEnabled = enabled;
  }

  public isDying(): boolean {
    return this.dying;
  }

  /** 扩展：崩解演出进度 0..1（未在演出时为 0），可驱动结局镜头 / 音乐淡出 */
  public getDeathProgress(): number {
    return this.dying ? Math.min(1, this.deathTimer / DEATH_SEQUENCE_DURATION) : 0;
  }

  /** 扩展：阶段细分（HUD 提示 / 调试） */
  public getStage(): OraclePrimeStage {
    return this.stage;
  }

  /** 扩展：建议的音乐强度 0..1（MusicSystem.setIntensity） */
  public getMusicIntensity(): number {
    if (this.dying || this.criticalReached) return 1;
    if (this.phase >= 3) return 0.92;
    if (this.phase === 2) return 0.78;
    return 0.6;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dying = false;
    this.missileSystem.dispose();
    this.pinwheel.dispose();
    this.judgement.dispose();
    this.pylonLance.dispose();
    this.arcStrike.dispose();
    this.shockwaves.dispose();
    this.orbitals.dispose();
    this.discharges.dispose();
    this.hazardRoot.parent?.remove(this.hazardRoot);
    this.mesh.visible = false;
    this.mesh.parent?.remove(this.mesh);
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      disposeObjectTree(child);
    }
    this.collisionParts.length = 0;
    this.partRoles.clear();
    this.pylonByPart.clear();
    this.emitterByPart.clear();
  }

  // ===========================================================================================
  // 构造辅助 / 部件
  // ===========================================================================================

  private ensureRig(mesh: THREE.Group, config: BossConfig): OraclePrimeRig {
    const existing = (mesh as OraclePrimeGroup).oracleRig;
    if (existing) return existing;
    // 宿主传入的不是工厂网格：现场构建并把部件移入宿主 Group
    const built = createOraclePrimeMesh(config) as OraclePrimeGroup;
    while (built.children.length > 0) mesh.add(built.children[0]);
    const rig = built.oracleRig;
    if (!rig) throw new Error('OraclePrimeAI: mesh factory produced no rig');
    (mesh as OraclePrimeGroup).oracleRig = rig;
    (mesh as OraclePrimeGroup).bossParts = built.bossParts;
    if (mesh.userData.hitRadius === undefined) mesh.userData.hitRadius = built.userData.hitRadius;
    if (!mesh.name) mesh.name = built.name;
    return rig;
  }

  private rebuildCollisionParts(): void {
    this.partsDirty = false;
    const parts = this.collisionParts;
    parts.length = 0;
    if (this.deathHandled || this.disposed) return;
    if (this.isShieldStage()) {
      for (const pylon of this.pylons) if (pylon.alive) parts.push(pylon.rig.crystal);
      parts.push(this.rig.shieldProxy);
      return;
    }
    parts.push(this.rig.core);
    if (this.stage === 'collapse' || this.stage === 'overload-rise') return;
    for (const emitter of this.emitters) if (emitter.alive) parts.push(emitter.rig.lens);
    if (this.phase === 2) parts.push(...this.rig.petalProxies);
    parts.push(...this.rig.haloProxies);
  }

  private isShieldStage(): boolean {
    return this.stage === 'intro' || this.stage === 'aegis';
  }

  private getAlivePylonCount(): number {
    let count = 0;
    for (const pylon of this.pylons) if (pylon.alive) count++;
    return count;
  }

  private isAnyEmitterVenting(): boolean {
    for (const emitter of this.emitters) if (emitter.alive && emitter.vent > 0) return true;
    return false;
  }

  private getAliveEmitterCount(): number {
    let count = 0;
    for (const emitter of this.emitters) if (emitter.alive) count++;
    return count;
  }

  private getPylonMultiplier(pylon: PylonState): number {
    return pylon.attack === 'charge' || this.stunTimer > 0 ? 1.5 : 1;
  }

  private getArmorMultiplier(): number {
    return this.phase >= 3 ? 0.4 : 0.3;
  }

  private tuning(): PhaseTuning {
    return PHASE_TUNING[Math.min(PHASE_TUNING.length, Math.max(1, this.phase)) - 1];
  }

  private sampleGround(x: number, z: number): number {
    if (this.groundSampler) {
      const y = this.groundSampler(x, z);
      if (Number.isFinite(y)) return y;
    }
    return this.fallbackGroundY;
  }

  private getStatusCode(): number {
    if (this.dying || this.deathHandled) return 1;
    if (this.stunTimer > 0) return this.isShieldStage() ? 2 : 3;
    switch (this.stage) {
      case 'intro':
        return 4;
      case 'aegis':
        return 5;
      case 'collapse':
        return 6;
      case 'overload-rise':
        return 7;
      default:
        break;
    }
    if (this.major === 'last-light') return 8;
    if (this.exhaustTimer > 0) return 9;
    if (this.apertureTimer > 0) return 10;
    if (this.isAnyEmitterVenting()) return 11;
    if (this.pinwheel.getState() !== 'idle') return 12;
    if (this.judgement.isBusy()) return 13;
    if (this.shockwaves.isCharging()) return 14;
    if (this.stage === 'overload') return this.criticalReached ? 15 : 16;
    return 17;
  }

  // ===========================================================================================
  // 阶段机
  // ===========================================================================================

  private updateStage(dt: number): void {
    this.stageTimer += dt;
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer <= 0) this.statusKey = -1;
    }
    this.stunImmunity = Math.max(0, this.stunImmunity - dt);
    switch (this.stage) {
      case 'intro':
        this.shieldFade = smoothstep(0, INTRO_DURATION * 0.8, this.stageTimer);
        this.pylonOrbitRadiusFactor = 0.3 + 0.7 * smoothstep(0, INTRO_DURATION, this.stageTimer);
        if (this.stageTimer >= INTRO_DURATION) {
          this.setStage('aegis');
          this.pylonOrbitRadiusFactor = 1;
          this.shieldFade = 1;
        }
        break;
      case 'aegis':
        if (this.getAlivePylonCount() === 0) this.startCollapse();
        break;
      case 'collapse':
        this.updateCollapse();
        break;
      case 'overload-rise':
        this.updateOverloadRise();
        break;
      default:
        break;
    }
  }

  private setStage(stage: OraclePrimeStage): void {
    this.stage = stage;
    this.stageTimer = 0;
    this.statusKey = -1;
    this.partsDirty = true;
  }

  private startCollapse(): void {
    this.setStage('collapse');
    this.phase = 2;
    this.pylonLance.clear();
    this.arcStrike.clear();
    this.cannonQueue = 0;
    this.retaliationTimer = 0;
    this.subTargets.length = 0;
    this.subTargets.push(...this.emitterSubTargets);
    this.petalMode = 'opening';
    this.shieldFlash = 1;
    this.fx.emit(
      'createShockwave',
      this.coreWorld,
      this.rig.shieldRadius * 1.6,
      0.9,
      0x9ff6ff,
      0.95
    );
    this.fx.emit('createEmpBurst', this.coreWorld, this.rig.shieldRadius * 1.3);
    this.emitCue('shield-collapse', this.coreWorld, 1);
    this.onPhaseChange?.(2, '护盾崩溃 · 核心暴露');
  }

  private updateCollapse(): void {
    const t = this.stageTimer;
    // 护盾：闪白收缩 → 溶解碎裂
    this.shieldScale = 1 - 0.08 * smoothstep(0, 0.5, t) + 0.25 * smoothstep(0.5, 1.7, t);
    this.rig.shieldMaterial.uniforms.uCollapse.value = smoothstep(0.45, 1.7, t);
    this.shieldFade = 1 - smoothstep(1.4, 1.9, t);
    if (t >= 0.5 && this.majorStep === 0) {
      this.majorStep = 1;
      for (let i = 0; i < 6; i++) {
        this.tmpA
          .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(this.rig.shieldRadius)
          .add(this.coreWorld);
        this.fx.emit('createExplosion', this.tmpA, 1.2, 'enemy');
      }
      this.fx.emit(
        'createShockwave',
        this.coreWorld,
        this.rig.shieldRadius * 2.4,
        1.2,
        0x6fe8ff,
        0.8
      );
    }
    this.petalOpen = smoothstep(0.8, 2.6, t);
    this.coreFlare = Math.max(this.coreFlare, 1 - smoothstep(0.2, 1.4, Math.abs(t - 1.2)));
    if (t >= 2.6 && this.majorStep === 1) {
      this.majorStep = 2;
      this.emitCue('core-exposed', this.coreWorld, 0.9);
    }
    if (t >= COLLAPSE_DURATION) {
      this.majorStep = 0;
      this.petalMode = 'open';
      this.petalOpen = 1;
      this.shieldFade = 0;
      this.rig.shield.visible = false;
      this.setStage('arrays');
      this.beatIndex = 0;
      this.beatGap = 1.4 * this.cadence;
      this.cannonTimer = 2;
      this.missileTimer = Math.max(3, this.missileTimer);
      this.minionTimer = 10;
    }
  }

  private startOverload(): void {
    if (this.stage !== 'arrays') return;
    this.setStage('overload-rise');
    this.phase = 3;
    this.interruptMajor(0);
    this.apertureTimer = 0;
    this.cannonQueue = 0;
    this.petalMode = 'debris';
    this.debrisBlend = 0;
    this.coreFlare = 1;
    this.fx.emit('createExplosion', this.coreWorld, 2.6, 'enemy');
    this.fx.emit(
      'createShockwave',
      this.coreWorld,
      160 * this.sizeFactor,
      1.1,
      ORACLE_PALETTE.overload,
      0.95
    );
    this.spawnVisualRing(this.coreWorld, 40 * this.sizeFactor, 260, 1.8, 26 * this.sizeFactor, 0.9);
    this.emitCue('overload', this.coreWorld, 1);
    this.onPhaseChange?.(3, '核心过载');
  }

  private updateOverloadRise(): void {
    const t = this.stageTimer;
    this.debrisBlend = smoothstep(0, 1.1, t);
    if (t >= OVERLOAD_RISE_DURATION) {
      this.setStage('overload');
      this.beatIndex = 0;
      this.beatGap = 0.6;
      this.cannonTimer = 2.4;
      this.minionTimer = 8;
    }
  }

  // ===========================================================================================
  // 玩家追踪 / 悬浮移动
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

  private updateMovement(dt: number): void {
    const sf = this.sizeFactor;
    const root = this.mesh.position;
    // 锚点：玩家远离时缓慢跟进，但不离开出生点太远
    if (this.hasPlayer) {
      const dx = this.playerPos.x - this.anchor.x;
      const dz = this.playerPos.z - this.anchor.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > FOLLOW_DISTANCE * sf) {
        const speed = Math.max(4, this.config.speed) * 3 * dt;
        this.anchor.x += (dx / distance) * speed;
        this.anchor.z += (dz / distance) * speed;
        this.tmpA.set(this.anchor.x - this.spawnAnchor.x, 0, this.anchor.z - this.spawnAnchor.z);
        const leash = LEASH_RADIUS * sf;
        if (this.tmpA.lengthSq() > leash * leash) {
          this.tmpA.setLength(leash);
          this.anchor.x = this.spawnAnchor.x + this.tmpA.x;
          this.anchor.z = this.spawnAnchor.z + this.tmpA.z;
        }
      }
    }
    const frozen = this.stunTimer > 0 ? 0.25 : 1;
    const amplitude = this.tuning().hoverAmplitude * sf;
    const t = this.time;
    const jitter = this.phase >= 3 ? Math.sin(t * 2.7) * 6 * sf : 0;
    this.lastLightRise = THREE.MathUtils.clamp(
      this.lastLightRise + (this.major === 'last-light' ? dt * 0.6 : -dt * 0.4),
      0,
      1
    );
    this.hoverTarget.set(
      this.anchor.x + Math.sin(t * 0.11) * amplitude + jitter,
      this.anchor.y +
        Math.sin(t * 0.23 + 0.7) * 10 * sf +
        smoothstep(0, 1, this.lastLightRise) * 40 * sf,
      this.anchor.z + Math.sin(t * 0.07 + 1.1) * amplitude
    );
    root.lerp(this.hoverTarget, Math.min(1, dt * 0.8 * frozen));
    if (!isFiniteVector(root)) root.copy(this.anchor);
    this.mesh.quaternion.identity();

    // 躯干：缓慢转向玩家（冠 / 根保持直立）
    if (this.hasPlayer && this.stunTimer <= 0) {
      const desired = Math.atan2(this.playerPos.x - root.x, this.playerPos.z - root.z);
      const diff = wrapAngle(desired - this.yaw);
      const maxTurn = Math.max(0.05, this.config.turnSpeed) * 2.4 * dt;
      this.yaw = wrapAngle(this.yaw + THREE.MathUtils.clamp(diff, -maxTurn, maxTurn));
    }
    const body = this.rig.body;
    body.rotation.set(0, this.yaw, 0);
    body.position.set(0, Math.sin(t * 0.6) * 4 * sf, 0);
  }

  // ===========================================================================================
  // 骨架动画（攻击之前执行，保证发射点为本帧位置）
  // ===========================================================================================

  private animateRig(dt: number): void {
    const t = this.time;
    const rig = this.rig;
    const overload = this.phase >= 3 ? 1 : 0;
    const charge = this.coreCharge;
    const stunSlow = this.stunTimer > 0 ? 0.2 : 1;

    rig.latticePivot.rotation.y += dt * (0.35 + 1.4 * overload + 2 * charge) * stunSlow;
    rig.latticePivot.rotation.x += dt * (0.12 + 0.5 * overload) * stunSlow;
    rig.gyroPivots[0].rotation.y += dt * (0.25 + 0.5 * overload) * stunSlow;
    rig.gyroPivots[1].rotation.x += dt * (0.18 + 0.45 * overload) * stunSlow;
    rig.gyroPivots[1].rotation.z = Math.sin(t * 0.21) * 0.4;
    rig.crown.rotation.y += dt * 0.12 * stunSlow;
    rig.root.rotation.y -= dt * 0.16 * stunSlow;
    rig.crown.position.y = 6.4 * rig.scale + Math.sin(t * 0.9) * 0.25 * rig.scale;
    rig.root.position.y = -6.4 * rig.scale + Math.sin(t * 0.9 + 1.4) * 0.25 * rig.scale;

    // 光环：平时缓转；风车光阵时由指挥器给定角速度
    this.haloSpin += dt * this.haloSpeed * stunSlow;
    rig.halo.rotation.set(0, this.haloSpin, 0);

    this.aimSeed(dt);
    this.posePetals(dt);
    this.layoutPylons(dt);
    rig.shield.position.copy(rig.body.position);
    rig.shieldProxy.position.copy(rig.body.position);
    rig.shield.scale.setScalar(this.shieldScale);
    this.poseTethers();
  }

  /** seed（核心 + 瞳孔 + 花瓣）平滑转向玩家；审判之矛锁定 / 发射时冻结 */
  private aimSeed(dt: number): void {
    if (!this.hasPlayer) return;
    const lanceState = this.judgement.getState();
    if (lanceState === 'lock' || lanceState === 'fire') return;
    const seed = this.rig.seed;
    seed.getWorldPosition(this.tmpA);
    this.tmpB.copy(this.playerPos);
    if (this.tmpB.distanceToSquared(this.tmpA) < 1) return;
    this.tmpMatrix.lookAt(this.tmpB, this.tmpA, UP);
    this.tmpQuat.setFromRotationMatrix(this.tmpMatrix);
    seed.parent?.getWorldQuaternion(this.tmpQuatB);
    this.tmpQuatB.invert().multiply(this.tmpQuat);
    const rate = this.stunTimer > 0 ? 0.3 : this.judgement.isBusy() ? 2.6 : 1.4;
    seed.quaternion.slerp(this.tmpQuatB, Math.min(1, dt * rate));
  }

  private posePetals(dt: number): void {
    const rig = this.rig;
    const count = rig.petalFrames.length;
    const t = this.time;
    const s = rig.scale;
    if (this.petalMode === 'debris' && this.debrisBlend >= 1 && this.implode >= 1) {
      rig.petals.visible = false;
      rig.petalTrims.visible = false;
      return;
    }
    for (let i = 0; i < count; i++) {
      const frame = rig.petalFrames[i];
      const breathe = 0.04 * Math.sin(t * 1.3 + frame.seed * 6);
      const open = this.petalMode === 'closed' ? breathe * 0.5 : this.petalOpen + breathe;
      const twist = this.petalOpen * (0.35 + 0.1 * Math.sin(t * 0.5 + frame.seed * 4));
      composeOraclePetalMatrix(rig, i, open, twist, this.tmpMatrix);
      if (this.petalMode === 'debris') {
        // 过载：花瓣炸开成环绕核心的碎片带（两条倾斜轨道），死亡内爆时被吸回核心
        const band = i % 2 === 0 ? 1 : -1;
        const radius = (8.4 + 1.8 * frame.seed) * s * (1 - 0.92 * this.implode);
        const angle = frame.seed * Math.PI * 2 + t * (0.32 + 0.22 * frame.seed) * band;
        this.tmpA.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        this.tmpA.applyAxisAngle(this.tmpB.set(1, 0, 0), band * 0.42);
        this.tmpA.applyAxisAngle(UP, frame.seed * 1.7);
        this.tmpQuat.setFromAxisAngle(
          this.tmpB.set(frame.seed - 0.5, 1, 0.5 - frame.seed).normalize(),
          t * (0.9 + frame.seed)
        );
        this.tmpQuat.multiply(frame.basis);
        const scale = 0.72 * (1 - this.implode);
        this.tmpScale.set(scale, scale, scale);
        this.tmpMatrixB.compose(this.tmpA, this.tmpQuat, this.tmpScale);
        const blend = this.debrisBlend;
        if (blend < 1) {
          // 炸开：先沿法线冲出再落入轨道
          this.tmpMatrix.decompose(this.tmpC, this.tmpQuatB, this.tmpScale);
          this.tmpC.multiplyScalar(1 + 1.4 * Math.sin(Math.PI * Math.min(1, blend * 1.2)));
          this.tmpC.lerp(this.tmpA, blend * blend);
          this.tmpQuatB.slerp(this.tmpQuat, blend);
          const blendScale = THREE.MathUtils.lerp(0.86, 0.72, blend);
          this.tmpScale.set(blendScale, blendScale, blendScale);
          this.tmpMatrix.compose(this.tmpC, this.tmpQuatB, this.tmpScale);
        } else {
          this.tmpMatrix.copy(this.tmpMatrixB);
        }
      }
      rig.petals.setMatrixAt(i, this.tmpMatrix);
      rig.petalTrims.setMatrixAt(i, this.tmpMatrix);
    }
    rig.petals.instanceMatrix.needsUpdate = true;
    rig.petalTrims.instanceMatrix.needsUpdate = true;
    // 张开后的花瓣装甲代理跟随面中心
    if (this.phase === 2) {
      for (const proxy of rig.petalProxies) {
        const index = proxy.userData.petalIndex as number;
        const frame = rig.petalFrames[index];
        if (!frame) continue;
        proxy.position
          .copy(frame.normal)
          .multiplyScalar(rig.petalInradius + this.petalOpen * 2.1 * s);
      }
    }
    void dt;
  }

  private layoutPylons(dt: number): void {
    const rig = this.rig;
    const radius = rig.pylonOrbitRadius * this.pylonOrbitRadiusFactor;
    const orbiting = this.stunTimer <= 0 && this.isShieldStage();
    const s = rig.scale;
    for (const pylon of this.pylons) {
      const group = pylon.rig.group;
      if (!pylon.alive) {
        this.updateFallingPylon(pylon, dt);
        continue;
      }
      if (orbiting) pylon.angle += dt * this.pylonOrbitSpeed;
      const bob = Math.sin(this.time * 0.8 + pylon.rig.index * 1.7) * 1.6 * s * 0.25;
      group.position.set(
        Math.cos(pylon.angle) * radius,
        pylon.rig.orbitHeight * this.pylonOrbitRadiusFactor + bob,
        Math.sin(pylon.angle) * radius
      );
      const spin = this.stunTimer > 0 ? 0.1 : 1;
      pylon.rig.spinner.rotation.y += dt * 0.55 * spin;
      pylon.rig.rings.rotation.y += dt * (1.3 + (pylon.attack === 'charge' ? 4 : 0)) * spin;
      pylon.rig.rings.rotation.x = Math.sin(this.time * 0.7 + pylon.rig.index) * 0.3;
    }
  }

  private updateFallingPylon(pylon: PylonState, dt: number): void {
    const group = pylon.rig.group;
    if (!group.visible) return;
    pylon.fallTimer += dt;
    pylon.fallVelocity += 32 * dt;
    group.position.y -= pylon.fallVelocity * dt;
    group.rotation.x += dt * pylon.spin;
    group.rotation.z += dt * pylon.spin * 0.6;
    if (pylon.fallTimer > 2.6) {
      group.visible = false;
      group.getWorldPosition(this.tmpA);
      this.fx.emit('createExplosion', this.tmpA, 1.6, 'enemy');
    }
  }

  /** 系索与能量包（根节点局部坐标；护盾不随根节点旋转） */
  private poseTethers(): void {
    const rig = this.rig;
    const anchors = rig.shieldMaterial.uniforms.uAnchors.value;
    const center = rig.body.position;
    const shieldRadius = rig.shieldRadius * this.shieldScale;
    for (const pylon of this.pylons) {
      const index = pylon.rig.index;
      const anchor = anchors[index];
      const tether = pylon.rig.tether;
      const packet = pylon.rig.packet;
      if (!pylon.alive || !this.isShieldStage()) {
        tether.visible = false;
        packet.visible = false;
        if (anchor) {
          // 已毁：留下闪烁破口；护盾崩溃后清空
          anchor.w = pylon.alive || !this.isShieldStage() ? 0 : -1;
        }
        continue;
      }
      this.tmpA.copy(pylon.rig.group.position).add(pylon.rig.tip.position);
      this.tmpB.subVectors(center, this.tmpA);
      const distance = this.tmpB.length();
      const length = distance - shieldRadius;
      if (!(distance > 1e-3) || length < 1) {
        tether.visible = false;
        packet.visible = false;
        continue;
      }
      this.tmpB.divideScalar(distance);
      tether.visible = this.shieldFade > 0.05;
      tether.position.copy(this.tmpA);
      tether.quaternion.setFromUnitVectors(UP, this.tmpB);
      const width = 0.2 * rig.scale * (pylon.attack === 'charge' ? 1.6 : 1);
      tether.scale.set(width, length, width);
      pylon.rig.tetherMaterial.opacity =
        (0.42 + 0.18 * Math.sin(this.time * 7 + index)) *
        this.shieldFade *
        (this.stunTimer > 0 ? 0.3 : 1);
      const flow = (this.time * 0.55 + index * 0.25) % 1;
      packet.visible = tether.visible;
      packet.position.copy(this.tmpA).addScaledVector(this.tmpB, length * flow);
      packet.material.opacity = 0.9 * Math.sin(Math.PI * flow) * this.shieldFade;
      if (anchor) {
        anchor.set(-this.tmpB.x, -this.tmpB.y, -this.tmpB.z, 0.6 + 0.4 * this.shieldFade);
      }
    }
  }

  // ===========================================================================================
  // 战斗
  // ===========================================================================================

  private updateCombat(dt: number): void {
    this.apertureTimer = Math.max(0, this.apertureTimer - dt);
    this.exhaustTimer = Math.max(0, this.exhaustTimer - dt);
    for (const emitter of this.emitters) emitter.vent = Math.max(0, emitter.vent - dt);
    const stunned = this.stunTimer > 0;

    if (this.stage === 'aegis') {
      if (!stunned) this.updatePylonAttacks(dt);
      this.updateRetaliation(dt);
    }
    if (this.stage === 'arrays' || this.stage === 'overload') {
      this.updateDirector(dt, stunned);
      this.updateMinions(dt, stunned);
    }
    if (this.stage === 'overload') this.updateOverloadDischarges(dt);
    if (this.stage === 'aegis' || this.stage === 'arrays' || this.stage === 'overload') {
      this.updateCannons(dt, stunned);
      this.updateMissiles(dt, stunned);
    }
    // 光矛 / 电弧发射点跟随护盾塔塔尖；棱镜塔补射
    this.updatePylonHazardOrigins(dt);
    this.updatePrismEcho(dt);
  }

  // ----- 护盾塔 -----

  private updatePylonAttacks(dt: number): void {
    if (!this.hasPlayer) return;
    let busy = 0;
    for (const pylon of this.pylons) {
      if (pylon.alive && pylon.attack !== 'idle' && pylon.attack !== 'recover') busy++;
    }
    for (const pylon of this.pylons) {
      if (!pylon.alive) continue;
      pylon.flash = Math.max(0, pylon.flash - dt * 4);
      switch (pylon.attack) {
        case 'idle': {
          pylon.attackTimer -= dt;
          if (pylon.attackTimer > 0) break;
          pylon.rig.tip.getWorldPosition(this.tmpA);
          const inRange = this.tmpA.distanceTo(this.playerPos) <= PYLON_RANGE * this.sizeFactor;
          const blocked =
            busy >= MAX_CONCURRENT_PYLON_ATTACKS ||
            (pylon.rig.role === 'lance' && this.pylonLance.isBusy()) ||
            (pylon.rig.role === 'arc' && this.arcStrike.isBusy());
          if (!inRange || blocked) {
            pylon.attackTimer = 0.6;
            break;
          }
          pylon.attack = 'charge';
          pylon.actionTimer = 0;
          busy++;
          this.emitCue('pylon-charge', this.tmpA, 0.5);
          break;
        }
        case 'charge':
          pylon.actionTimer += dt;
          if (pylon.actionTimer >= PYLON_CHARGE[pylon.rig.role]) this.firePylon(pylon);
          break;
        case 'active':
          pylon.actionTimer += dt;
          if (
            (pylon.rig.role === 'lance' && !this.pylonLance.isBusy()) ||
            (pylon.rig.role === 'arc' && !this.arcStrike.isBusy()) ||
            pylon.actionTimer > 4
          ) {
            this.finishPylonAttack(pylon);
          }
          break;
        case 'recover':
          pylon.actionTimer += dt;
          if (pylon.actionTimer >= 0.45) pylon.attack = 'idle';
          break;
      }
    }
  }

  private firePylon(pylon: PylonState): void {
    pylon.activations++;
    pylon.actionTimer = 0;
    const tip = pylon.rig.tip.getWorldPosition(this.tmpA);
    const sf = this.sizeFactor;
    const damage = this.config.damage;
    switch (pylon.rig.role) {
      case 'prism': {
        // 扇形等离子弹：以提前量方向为中心横向展开 5 发；剩 ≤ 2 塔时 0.35 秒后补射第二轮
        this.firePrismFan(tip);
        if (this.getAlivePylonCount() <= 2) this.prismEchoTimer = 0.35;
        this.finishPylonAttack(pylon);
        this.emitCue('prism-fire', tip, 0.6);
        break;
      }
      case 'arc': {
        const lead = 1.0;
        this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, lead);
        this.tmpC.subVectors(this.tmpB, tip);
        const maxRange = 520 * sf;
        if (this.tmpC.lengthSq() > maxRange * maxRange) this.tmpC.setLength(maxRange);
        this.tmpB.copy(tip).add(this.tmpC);
        const started = this.arcStrike.start(tip, this.tmpB, {
          telegraphTime: 1.15 * Math.max(0.75, this.cadence),
          dischargeTime: 0.32,
          radius: 15 * sf,
          boltRadius: 3 * sf,
          damage: damage * 1.1,
        });
        if (started) {
          pylon.attack = 'active';
          if (pylon.activations % 2 === 1) this.onHazardWarning?.('电弧锁定');
          this.emitCue('arc-telegraph', this.tmpB, 0.7);
        } else {
          this.finishPylonAttack(pylon);
        }
        break;
      }
      case 'seeker': {
        if (pylon.activations % 3 === 0) {
          for (let i = 0; i < 2; i++) {
            const position = new THREE.Vector3(
              tip.x + (i === 0 ? 10 : -10) * sf,
              tip.y + 8 * sf,
              tip.z
            );
            this.onSpawnMinion?.(position, 'drone');
          }
          this.emitCue('drone-launch', tip, 0.6);
        } else {
          this.launchMissile(tip, false);
          this.emitCue('seeker-launch', tip, 0.6);
        }
        this.fx.emit('createExplosion', tip, 0.7, 'enemy');
        this.finishPylonAttack(pylon);
        break;
      }
      case 'lance': {
        this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, 0.45);
        const started = this.pylonLance.start(tip, this.tmpB, {
          trackTime: 1.4 * Math.max(0.8, this.cadence),
          lockTime: 0.45,
          fireTime: 0.45,
          radius: 3.4 * sf,
          length: 700 * sf,
          damage: damage,
          trackRate: 2,
        });
        if (started) pylon.attack = 'active';
        else this.finishPylonAttack(pylon);
        break;
      }
    }
  }

  private firePrismFan(origin: THREE.Vector3): void {
    if (!this.onFire) return;
    const distance = origin.distanceTo(this.playerPos);
    if (distance > 600 * this.sizeFactor || distance < 1) return;
    this.tmpB
      .copy(this.playerPos)
      .addScaledVector(this.playerVel, (distance / 100) * 0.75)
      .sub(origin)
      .normalize();
    if (!isFiniteVector(this.tmpB)) return;
    const spread = 0.12;
    for (let k = -2; k <= 2; k++) {
      this.tmpD
        .copy(this.tmpB)
        .applyAxisAngle(UP, k * spread)
        .normalize();
      this.onFire(origin.clone(), this.tmpD.clone(), this.config.damage * 0.45);
    }
    this.fx.emit('createMuzzleFlash', origin, this.tmpB, 2.2);
  }

  private finishPylonAttack(pylon: PylonState): void {
    pylon.attack = 'recover';
    pylon.actionTimer = 0;
    const base = PYLON_INTERVALS[pylon.rig.role];
    const pressure = 1 - 0.1 * (this.pylons.length - this.getAlivePylonCount());
    pylon.attackTimer = base * this.cadence * pressure * (0.85 + Math.random() * 0.3);
  }

  private updatePylonHazardOrigins(dt: number): void {
    for (const pylon of this.pylons) {
      if (!pylon.alive) continue;
      if (pylon.rig.role === 'lance' && this.pylonLance.isBusy()) {
        pylon.rig.tip.getWorldPosition(this.tmpA);
        this.pylonLance.setOrigin(this.tmpA);
      } else if (pylon.rig.role === 'arc' && this.arcStrike.isBusy()) {
        pylon.rig.tip.getWorldPosition(this.tmpA);
        this.arcStrike.setOrigin(this.tmpA);
      }
    }
    if (this.pylonLance.getState() === 'track' && this.hasPlayer) {
      this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, 0.45);
      this.pylonLance.setTarget(this.tmpB, dt);
    }
  }

  private updatePrismEcho(dt: number): void {
    if (this.prismEchoTimer < 0) return;
    this.prismEchoTimer -= dt;
    if (this.prismEchoTimer > 0) return;
    this.prismEchoTimer = -1;
    if (this.stage !== 'aegis' || this.stunTimer > 0 || !this.hasPlayer) return;
    const prism = this.pylons.find((pylon) => pylon.alive && pylon.rig.role === 'prism');
    if (!prism) return;
    prism.rig.tip.getWorldPosition(this.tmpA);
    this.firePrismFan(this.tmpA);
  }

  private destroyPylon(pylon: PylonState): void {
    if (!pylon.alive) return;
    pylon.alive = false;
    pylon.hp = 0;
    pylon.subTarget.current = 0;
    pylon.attack = 'idle';
    pylon.fallTimer = 0;
    pylon.fallVelocity = 6;
    pylon.spin = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random());
    if (pylon.rig.role === 'lance') this.pylonLance.clear();
    if (pylon.rig.role === 'arc') this.arcStrike.clear();
    pylon.rig.crystal.visible = false;
    pylon.rig.tipGlow.visible = false;
    pylon.rig.tether.visible = false;
    pylon.rig.packet.visible = false;
    pylon.rig.crystal.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 2.4, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 2.2, 'boss-armor');
    this.fx.emit(
      'createShockwave',
      this.tmpA,
      70 * this.sizeFactor,
      0.7,
      pylon.rig.color.getHex(),
      0.9
    );
    this.fx.emit('createPickupBurst', this.tmpA, pylon.rig.color.getHex());
    // 系索断裂：沿系索的火花
    this.tmpB.subVectors(this.coreWorld, this.tmpA);
    for (let i = 1; i <= 3; i++) {
      this.tmpC.copy(this.tmpA).addScaledVector(this.tmpB, i * 0.18);
      this.fx.emit('createHit', this.tmpC, 1.4, 'boss');
    }
    this.shieldFlash = Math.min(1, this.shieldFlash + 0.7);
    // 其余塔加速公转；核心报复齐射
    this.pylonOrbitSpeed += 0.035;
    const destroyed = this.pylons.length - this.getAlivePylonCount();
    if (this.getAlivePylonCount() > 0) {
      this.retaliationTimer = 1.3;
      this.retaliationCount = destroyed >= 3 ? 3 : 2;
      this.onHazardWarning?.(`护盾塔被毁 ${destroyed}/${this.pylons.length} · 神谕反击`);
    }
    this.partsDirty = true;
    this.statusKey = -1;
    this.emitCue('pylon-destroyed', this.tmpA, 1);
  }

  private updateRetaliation(dt: number): void {
    if (this.retaliationTimer <= 0) return;
    this.retaliationTimer -= dt;
    if (this.retaliationTimer > 0 || !this.hasPlayer) return;
    this.missileQueue = Math.max(this.missileQueue, this.retaliationCount);
    this.missileStagger = 0;
    this.missileFired = 0;
    this.onHazardWarning?.('导弹齐射');
  }

  // ----- 常规火力 -----

  private updateCannons(dt: number, stunned: boolean): void {
    if (stunned || !this.hasPlayer || !this.onFire) return;
    if (this.cannonQueue > 0) {
      this.cannonStagger -= dt;
      if (this.cannonStagger > 0) return;
      this.cannonStagger = 0.13;
      this.cannonQueue--;
      this.fireBolt();
      return;
    }
    this.cannonTimer -= dt;
    if (this.cannonTimer > 0) return;
    const tuning = this.tuning();
    this.cannonTimer = Math.max(0.8, tuning.cannonInterval * this.cadence);
    if (
      this.major === 'last-light' ||
      this.coreWorld.distanceTo(this.playerPos) > CANNON_RANGE * 1.4 * this.sizeFactor
    ) {
      return;
    }
    this.cannonQueue = tuning.cannonCount;
    this.cannonStagger = 0;
  }

  private fireBolt(): void {
    // 阶段 1 从瞳孔点射；阶段 2/3 由存活的发射器轮流点射（审判之矛期间瞳孔不点射）
    let origin: THREE.Object3D | null = null;
    if (this.phase >= 2) {
      for (let k = 0; k < this.emitters.length; k++) {
        const emitter = this.emitters[(this.cannonCursor + k) % this.emitters.length];
        if (emitter.alive) {
          origin = emitter.rig.muzzle;
          this.cannonCursor = (this.cannonCursor + k + 1) % this.emitters.length;
          break;
        }
      }
    }
    if (!origin) {
      if (this.judgement.isBusy()) return;
      origin = this.rig.irisMuzzle;
    }
    origin.getWorldPosition(this.tmpA);
    const distance = this.tmpA.distanceTo(this.playerPos);
    if (distance > CANNON_RANGE * this.sizeFactor * 1.15 || distance < 1) return;
    this.tmpB
      .copy(this.playerPos)
      .addScaledVector(this.playerVel, (distance / 100) * 0.72)
      .sub(this.tmpA)
      .normalize();
    if (!isFiniteVector(this.tmpB)) return;
    this.fx.emit('createHit', this.tmpA, 1.2, 'enemy');
    this.onFire?.(this.tmpA.clone(), this.tmpB.clone(), this.config.damage * 0.5);
  }

  private updateMissiles(dt: number, stunned: boolean): void {
    if (this.missileQueue > 0) {
      if (stunned) return;
      this.missileStagger -= dt;
      if (this.missileStagger > 0) return;
      this.missileStagger = 0.3;
      this.missileQueue--;
      const port = this.rig.missilePorts[this.missileFired % this.rig.missilePorts.length];
      if (port) {
        port.getWorldPosition(this.tmpA);
        this.launchMissile(this.tmpA, this.missileFired === 1);
      }
      this.missileFired++;
      return;
    }
    this.missileTimer -= dt;
    if (this.missileTimer > 0 || stunned || !this.hasPlayer) return;
    const tuning = this.tuning();
    this.missileTimer = Math.max(4, this.config.missileFireInterval * tuning.missileFactor);
    if (this.major === 'last-light') return;
    this.missileQueue = tuning.missileCount;
    this.missileStagger = 0.4;
    this.missileFired = 0;
    if (this.phase >= 2) this.onHazardWarning?.('导弹齐射');
  }

  private launchMissile(position: THREE.Vector3, preferFriendly: boolean): void {
    let target: THREE.Object3D | null = null;
    if (preferFriendly) {
      let best = Infinity;
      for (const friendly of this.friendlyMeshes) {
        if (!friendly.parent) continue;
        const d = friendly.position.distanceToSquared(position);
        if (d < best) {
          best = d;
          target = friendly;
        }
      }
    }
    this.missileSystem.fire(
      position.clone(),
      target,
      this.friendlyMeshes,
      this.playerMesh,
      target === null
    );
    this.fx.emit('createExplosion', position, 0.8, 'enemy');
    this.onMissileFired?.();
    this.emitCue('missile-launch', position, 0.6);
  }

  private updateMinions(dt: number, stunned: boolean): void {
    const tuning = this.tuning();
    if (tuning.minionInterval <= 0 || tuning.minions.length === 0 || stunned) return;
    if (!this.hasPlayer) return;
    this.minionTimer -= dt;
    if (this.minionTimer > 0) return;
    this.minionTimer = tuning.minionInterval;
    if (this.major === 'last-light') return;
    const count = tuning.minions.length;
    tuning.minions.forEach((kind, i) => {
      const port = this.rig.missilePorts[(i * 2) % this.rig.missilePorts.length];
      if (!port) return;
      port.getWorldPosition(this.tmpA);
      const angle = (i / count) * Math.PI * 2;
      const position = new THREE.Vector3(
        this.tmpA.x + Math.cos(angle) * 14 * this.sizeFactor,
        this.tmpA.y - 10 * this.sizeFactor,
        this.tmpA.z + Math.sin(angle) * 14 * this.sizeFactor
      );
      this.onSpawnMinion?.(position, kind);
    });
    this.rig.root.getWorldPosition(this.tmpA);
    this.onHazardWarning?.('无人机群出击');
    this.emitCue('drone-launch', this.tmpA, 0.7);
  }

  // ----- 指挥器：阶段 2/3 的大招 -----

  private updateDirector(dt: number, stunned: boolean): void {
    if (this.major) {
      this.updateMajor(dt);
      return;
    }
    if (stunned || !this.hasPlayer) return;
    // 临界：插入一次「终焉之光」
    if (this.stage === 'overload' && this.criticalReached && !this.lastLightDone) {
      this.startMajor('last-light');
      return;
    }
    this.beatGap -= dt;
    if (this.beatGap > 0) return;
    const beats = this.stage === 'overload' ? OVERLOAD_BEATS : ARRAY_BEATS;
    let next = beats[this.beatIndex % beats.length];
    this.beatIndex++;
    if (next === 'pinwheel' && this.getAliveEmitterCount() === 0) {
      next = this.stage === 'overload' ? 'orbital' : 'judgement';
    }
    this.startMajor(next);
  }

  private startMajor(kind: MajorAttack): void {
    this.major = kind;
    this.majorTimer = 0;
    this.majorStep = 0;
    this.statusKey = -1;
    switch (kind) {
      case 'pinwheel':
        this.startPinwheel();
        break;
      case 'judgement':
        this.startJudgement(false);
        break;
      case 'judgement3':
        this.startJudgement(true);
        break;
      case 'crown':
      case 'twin':
        this.spawnOverloadRing(kind, 1.8);
        break;
      case 'orbital':
        this.spawnOrbitalBarrage();
        break;
      case 'last-light':
        this.lastLightDone = true;
        this.coreFlare = 1;
        this.onHazardWarning?.('终焉之光 · 三重冲击环');
        this.emitCue('last-light', this.coreWorld, 1);
        break;
    }
  }

  private finishMajor(gapScale: number = 1): void {
    this.major = null;
    this.majorTimer = 0;
    this.majorStep = 0;
    this.beatGap = this.tuning().beatGap * this.cadence * gapScale;
    this.statusKey = -1;
  }

  /** EMP / 阶段切换：打断当前大招 */
  private interruptMajor(gap: number): void {
    if (this.major === 'pinwheel' || this.pinwheel.getState() !== 'idle') this.pinwheel.clear();
    if (this.judgement.isBusy()) this.judgement.clear();
    this.haloSpeed = 0.06;
    for (const emitter of this.emitters) emitter.charge = 0;
    this.major = null;
    this.majorTimer = 0;
    this.majorStep = 0;
    this.beatGap = Math.max(this.beatGap, gap);
    this.statusKey = -1;
  }

  private updateMajor(dt: number): void {
    this.majorTimer += dt;
    switch (this.major) {
      case 'pinwheel':
        this.updatePinwheelMajor(dt);
        break;
      case 'judgement':
      case 'judgement3':
        this.updateJudgementMajor(dt);
        break;
      case 'crown':
      case 'twin':
        // 冲击环释放后多留一些空档，让玩家先处理这道环
        if (!this.shockwaves.isCharging() && this.majorTimer > 0.5) this.finishMajor(1.8);
        break;
      case 'orbital':
        if (this.majorTimer > 1.6) this.finishMajor();
        break;
      case 'last-light':
        this.updateLastLight();
        break;
      default:
        this.finishMajor();
    }
  }

  private startPinwheel(): void {
    const sf = this.sizeFactor;
    const overload = this.stage === 'overload';
    for (let i = 0; i < this.emitters.length; i++) this.spokeMask[i] = this.emitters[i].alive;
    this.pinwheelDirection = Math.random() < 0.5 ? 1 : -1;
    this.pinwheelOmega = overload ? 0.4 : 0.3;
    this.pinwheelTilt = overload ? 0.17 : 0;
    const started = this.pinwheel.start(this.spokeMask, {
      chargeTime: (overload ? 1.6 : 1.9) * Math.max(0.8, this.cadence),
      fireTime: overload ? 6 : 6.5,
      radius: 4.4 * sf,
      length: 660 * sf,
      damage: this.config.damage,
    });
    if (!started) {
      this.finishMajor(0.3);
      return;
    }
    this.onHazardWarning?.(overload ? '倾斜光轮 · 观察光束高度' : '光轮扫掠 · 避开光环高度');
    this.emitCue('pinwheel-charge', this.coreWorld, 0.8);
  }

  private updatePinwheelMajor(dt: number): void {
    const state = this.pinwheel.getState();
    const omega = this.pinwheelOmega * this.pinwheelDirection;
    if (state === 'charge') {
      // 预警期间以 1/4 角速度转动，直观指示扫掠方向
      this.haloSpeed = omega * 0.25 * smoothstep(0, 0.6, this.pinwheel.getChargeProgress());
    } else if (state === 'fire') {
      this.haloSpeed += (omega - this.haloSpeed) * Math.min(1, dt * 3);
    }
    for (const emitter of this.emitters) {
      emitter.charge =
        emitter.alive && state !== 'idle'
          ? state === 'fire'
            ? 1
            : this.pinwheel.getChargeProgress()
          : 0;
    }
    if (state !== 'idle') this.placeSpokes();
    if (this.pinwheel.update(dt)) {
      this.emitCue('pinwheel-fire', this.coreWorld, 1);
    }
    if (this.pinwheel.getState() === 'idle') {
      this.haloSpeed = 0.06;
      for (const emitter of this.emitters) {
        emitter.charge = 0;
        if (emitter.alive) emitter.vent = VENT_TIME;
      }
      this.finishMajor();
    }
  }

  private placeSpokes(): void {
    this.rig.halo.getWorldPosition(this.tmpC);
    this.emitters.forEach((emitter, i) => {
      if (!emitter.alive) return;
      emitter.rig.muzzle.getWorldPosition(this.tmpA);
      this.tmpB.subVectors(this.tmpA, this.tmpC);
      this.tmpB.y = 0;
      if (this.tmpB.lengthSq() < 1e-6) return;
      this.tmpB.normalize();
      const tilt = this.pinwheelTilt * (i % 2 === 0 ? 1 : -1);
      this.tmpB.multiplyScalar(Math.cos(tilt));
      this.tmpB.y = Math.sin(tilt);
      this.pinwheel.setSpoke(i, this.tmpA, this.tmpB);
    });
  }

  private startJudgement(triple: boolean): void {
    this.majorStep = 0;
    if (!this.beginJudgementShot(triple)) {
      this.finishMajor(0.3);
      return;
    }
    this.onHazardWarning?.(triple ? '三重审判之矛' : '审判之矛 · 锁定后急转');
    this.emitCue('judgement-charge', this.coreWorld, 0.8);
  }

  private beginJudgementShot(triple: boolean): boolean {
    const sf = this.sizeFactor;
    const spec = this.lanceSpec;
    spec.trackTime = (triple ? 0.95 : 1.5) * Math.max(0.8, this.cadence);
    spec.lockTime = triple ? 0.38 : 0.5;
    spec.fireTime = triple ? 0.6 : 1.1;
    spec.radius = (triple ? 5.5 : 6.5) * sf;
    spec.length = 900 * sf;
    spec.damage = this.config.damage * 1.4;
    spec.trackRate = triple ? 3 : 2.2;
    this.rig.irisMuzzle.getWorldPosition(this.tmpA);
    this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, spec.lockTime);
    return this.judgement.start(this.tmpA, this.tmpB, spec);
  }

  private updateJudgementMajor(dt: number): void {
    const triple = this.major === 'judgement3';
    this.rig.irisMuzzle.getWorldPosition(this.tmpA);
    this.judgement.setOrigin(this.tmpA);
    if (this.judgement.getState() === 'track') {
      this.tmpB.copy(this.playerPos).addScaledVector(this.playerVel, this.lanceSpec.lockTime);
      this.judgement.setTarget(this.tmpB, dt);
    }
    const event = this.judgement.update(dt);
    if (event === 'lock') {
      this.emitCue('judgement-lock', this.tmpA, 0.9);
    } else if (event === 'fire') {
      this.fx.emit('createExplosion', this.tmpA, 1.3, 'enemy');
      this.fx.emit(
        'createMuzzleFlash',
        this.tmpA,
        this.tmpB.subVectors(this.judgement.getEnd(), this.tmpA).normalize(),
        3
      );
      this.emitCue('judgement-fire', this.tmpA, 1);
    } else if (event === 'end') {
      this.majorStep++;
      if (triple && this.majorStep < 3 && this.beginJudgementShot(true)) return;
      this.apertureTimer = triple ? APERTURE_TIME + 0.5 : APERTURE_TIME;
      this.statusKey = -1;
      this.emitCue('aperture-open', this.tmpA, 0.8);
      this.finishMajor();
    } else if (!this.judgement.isBusy()) {
      this.finishMajor(0.3);
    }
  }

  // ----- 过载冲击环 -----

  private spawnOverloadRing(kind: 'crown' | 'twin', telegraph: number): boolean {
    const sf = this.sizeFactor;
    const spec = this.ringSpec;
    spec.kind = kind;
    spec.telegraphTime = telegraph;
    spec.startRadius = 9.4 * this.rig.scale;
    spec.duration = 8.5;
    spec.damage = this.config.damage * 1.25;
    spec.v0 = 120 * sf;
    spec.tau = 3.2;
    spec.vMin = 18 * sf;
    spec.bandWidth = 9 * sf;
    spec.opacity = 1;
    spec.endRadius = undefined;
    if (kind === 'crown') {
      spec.height = 110 * sf;
      spec.slotHalfHeight = 0;
      spec.gapHalfAngle = 0.2;
      const offset = Math.random() * Math.PI * 2;
      for (let g = 0; g < 3; g++) {
        this.gapAngles[g] = wrapAngle(offset + (g * Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.5);
      }
      // 至少一个缺口朝向玩家附近，保证可读的穿越路线
      if (this.hasPlayer) {
        const bearing = Math.atan2(
          this.playerPos.z - this.coreWorld.z,
          this.playerPos.x - this.coreWorld.x
        );
        this.gapAngles[0] = wrapAngle(bearing + (Math.random() - 0.5) * 0.9);
      }
      spec.gaps = this.gapAngles;
    } else {
      spec.height = 92 * sf;
      spec.slotHalfHeight = 17 * sf;
      spec.gapHalfAngle = 0;
      spec.gaps = [];
    }
    const spawned = this.shockwaves.spawn(this.coreWorld, spec);
    if (spawned) {
      this.onHazardWarning?.(
        kind === 'crown' ? '过载冲击环 · 穿越缺口或远离' : '双重冲击环 · 与核心同高'
      );
      this.emitCue('shockwave-charge', this.coreWorld, 0.8);
    }
    return spawned;
  }

  private spawnVisualRing(
    center: THREE.Vector3,
    startRadius: number,
    v0: number,
    duration: number,
    height: number,
    opacity: number,
    endRadius?: number
  ): void {
    const spec = this.ringSpec;
    spec.kind = 'visual';
    spec.telegraphTime = 0;
    spec.startRadius = startRadius;
    spec.endRadius = endRadius;
    spec.duration = duration;
    spec.height = height;
    spec.slotHalfHeight = 0;
    spec.gaps = [];
    spec.gapHalfAngle = 0;
    spec.damage = 0;
    spec.v0 = v0 * this.sizeFactor;
    spec.tau = duration * 0.5;
    spec.vMin = 0;
    spec.bandWidth = 4;
    spec.opacity = opacity;
    this.shockwaves.spawn(center, spec);
  }

  private handleRingEmit(center: THREE.Vector3, kind: OracleRingKind): void {
    if (kind === 'visual') return;
    this.coreFlare = Math.max(this.coreFlare, 0.8);
    this.fx.emit('createExplosion', center, 2, 'enemy');
    this.fx.emit(
      'createShockwave',
      center,
      90 * this.sizeFactor,
      0.6,
      ORACLE_PALETTE.overloadHot,
      0.9
    );
    this.emitCue('shockwave', center, 1);
  }

  private updateLastLight(): void {
    const t = this.majorTimer;
    // 蓄力 3 秒（核心上升、急剧增亮），随后三连冲击环（预警依次出现）
    if (this.majorStep === 0) {
      this.coreCharge = Math.max(this.coreCharge, smoothstep(0, 3, t));
      if (t >= 3) {
        this.majorStep = 1;
        this.spawnOverloadRing('crown', 1.2);
      }
      return;
    }
    if (this.majorStep >= 1 && this.majorStep <= 3) {
      if (this.shockwaves.isCharging()) return;
      if (this.majorStep === 1) {
        this.majorStep = 2;
        this.spawnOverloadRing('twin', 1.35);
      } else if (this.majorStep === 2) {
        this.majorStep = 3;
        this.spawnOverloadRing('crown', 1.35);
      } else {
        this.majorStep = 4;
        this.majorTimer = 0;
      }
      return;
    }
    if (this.majorStep === 4 && this.majorTimer > 1.2) {
      this.exhaustTimer = EXHAUST_TIME;
      this.statusKey = -1;
      this.onHazardWarning?.('核心衰竭 · 全力攻击');
      this.emitCue('aperture-open', this.coreWorld, 1);
      this.finishMajor(1.6);
    }
  }

  // ----- 天罚光柱 -----

  private spawnOrbitalBarrage(): void {
    const sf = this.sizeFactor;
    // 玩家航迹前方（约 1.7 秒后）+ 两侧 / 前后各一
    this.tmpA.copy(this.playerPos).addScaledVector(this.playerVel, 1.7);
    this.tmpB.set(this.playerVel.x, 0, this.playerVel.z);
    if (this.tmpB.lengthSq() < 4)
      this.tmpB.set(this.playerPos.x - this.coreWorld.x, 0, this.playerPos.z - this.coreWorld.z);
    if (this.tmpB.lengthSq() < 1e-4) this.tmpB.set(0, 0, 1);
    this.tmpB.normalize();
    this.tmpC.set(-this.tmpB.z, 0, this.tmpB.x);
    const offsets: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [70, 25],
      [-70, 25],
      [0, 115],
      [0, -70],
    ];
    const radius = 16 * sf;
    offsets.forEach(([lateral, along], k) => {
      const x = this.tmpA.x + this.tmpC.x * lateral * sf + this.tmpB.x * along * sf;
      const z = this.tmpA.z + this.tmpC.z * lateral * sf + this.tmpB.z * along * sf;
      const ground = this.sampleGround(x, z);
      this.orbitals.spawn(x, z, {
        telegraphTime: (1.6 + k * 0.22) * Math.max(0.85, this.cadence),
        strikeTime: 0.75,
        radius,
        damage: this.config.damage * 1.3,
        groundY: ground,
        topY: ground + 900 * sf,
      });
    });
    this.onHazardWarning?.('天罚光柱 · 偏离航线');
    this.emitCue('orbital-telegraph', this.tmpA, 0.8);
  }

  private handleOrbitalStrike(ground: THREE.Vector3, radius: number): void {
    this.fx.emit('createGroundImpact', ground, 1.8, 'rock');
    this.fx.emit('createShockwave', ground, radius * 3.2, 0.7, ORACLE_PALETTE.overloadHot, 0.9);
    this.tmpD.copy(ground);
    this.tmpD.y += 6 * this.sizeFactor;
    this.fx.emit('createExplosion', this.tmpD, 1.3, 'enemy');
    this.emitCue('orbital-strike', ground, 0.8);
  }

  // ----- 过载放电（装饰） -----

  private updateOverloadDischarges(dt: number): void {
    this.dischargeTimer -= dt;
    if (this.dischargeTimer > 0) return;
    this.dischargeTimer = 0.7 + Math.random() * 0.9;
    const angle = Math.random() * Math.PI * 2;
    const reach = (90 + Math.random() * 160) * this.sizeFactor;
    const x = this.coreWorld.x + Math.cos(angle) * reach;
    const z = this.coreWorld.z + Math.sin(angle) * reach;
    this.tmpA.set(x, this.sampleGround(x, z), z);
    if (this.discharges.fire(this.coreWorld, this.tmpA, 0.28, 1.1 * this.sizeFactor)) {
      this.fx.emit('createGroundImpact', this.tmpA, 1, 'rock');
    }
  }

  // ===========================================================================================
  // 伤害 / 阶段 / 死亡
  // ===========================================================================================

  private applyCoreDamage(amount: number): void {
    let dealt = amount;
    if (this.stage === 'arrays') {
      // 阶段 2 在 40% 处设底：保证过载阶段一定出现
      const floor = Math.ceil(this.health.getMaxHealth() * OVERLOAD_RATIO);
      dealt = Math.min(dealt, Math.max(0, this.health.getCurrentHealth() - floor));
    }
    if (dealt > 0) this.health.takeDamage(dealt);
    if (this.disposed || !this.isAlive()) return;
    const ratio = this.health.getCurrentHealth() / Math.max(1, this.health.getMaxHealth());
    if (this.stage === 'arrays' && ratio <= OVERLOAD_RATIO + 1e-6) this.startOverload();
    if (!this.lowHealthReached && ratio <= LOW_HEALTH_RATIO) {
      this.lowHealthReached = true;
    }
    if (!this.criticalReached && ratio <= CRITICAL_RATIO && this.phase >= 3) {
      this.criticalReached = true;
      this.statusKey = -1;
      this.emitCue('critical', this.coreWorld, 1);
    }
  }

  private destroyEmitter(emitter: EmitterState): void {
    if (!emitter.alive) return;
    emitter.alive = false;
    emitter.hp = 0;
    emitter.subTarget.current = 0;
    emitter.vent = 0;
    emitter.charge = 0;
    this.pinwheel.disableSpoke(emitter.rig.index);
    emitter.rig.lens.visible = false;
    emitter.rig.glow.visible = false;
    emitter.rig.muzzle.getWorldPosition(this.tmpA);
    this.fx.emit('createExplosion', this.tmpA, 2, 'enemy');
    this.fx.emit('createHeavyWeaponImpact', this.tmpA, 2, 'boss-armor');
    this.fx.emit('createPickupBurst', this.tmpA, 0x9ff8ff);
    this.partsDirty = true;
    this.statusKey = -1;
    this.emitCue('emitter-destroyed', this.tmpA, 0.9);
  }

  private registerShieldHit(): void {
    if (!this.isShieldStage() || this.shieldFade <= 0.05) return;
    if (this.time - this.lastShieldRipple < 0.12) return;
    this.lastShieldRipple = this.time;
    // 子弹来自玩家方向：涟漪画在护盾朝向玩家的一侧
    const hits = this.rig.shieldMaterial.uniforms.uHits.value;
    const slot = hits[this.nextShieldHit];
    this.nextShieldHit = (this.nextShieldHit + 1) % ORACLE_SHIELD_MAX_HITS;
    if (this.hasPlayer) {
      this.tmpA.subVectors(this.playerPos, this.coreWorld);
    } else {
      this.tmpA.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    }
    if (this.tmpA.lengthSq() < 1e-6) this.tmpA.set(0, 0, 1);
    this.tmpA.normalize();
    this.tmpA.x += (Math.random() - 0.5) * 0.25;
    this.tmpA.y += (Math.random() - 0.5) * 0.25;
    this.tmpA.normalize();
    slot.set(this.tmpA.x, this.tmpA.y, this.tmpA.z, this.time);
    this.shieldFlash = Math.min(0.5, this.shieldFlash + 0.05);
    if (this.time - this.lastShieldCue > 0.25) {
      this.lastShieldCue = this.time;
      this.tmpB.copy(this.coreWorld).addScaledVector(this.tmpA, this.rig.shieldRadius);
      this.emitCue('shield-hit', this.tmpB, 0.5);
    }
  }

  private probeShieldContact(target: THREE.Vector3, radius: number): void {
    if (!this.isShieldStage() || this.shieldFade < 0.5) return;
    const shieldRadius = this.rig.shieldRadius * this.shieldScale;
    const reach = shieldRadius + radius;
    const distanceSq = target.distanceToSquared(this.coreWorld);
    if (distanceSq > reach * reach) return;
    const damage = this.config.damage * 0.5;
    if (damage <= this.probe.damage) return;
    this.tmpD.subVectors(target, this.coreWorld);
    if (this.tmpD.lengthSq() < 1e-6) this.tmpD.set(0, 1, 0);
    this.tmpD.setLength(shieldRadius).add(this.coreWorld);
    this.probe.damage = damage;
    this.probe.profile = 'boss-armor';
    this.probe.position.copy(this.tmpD);
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
      this.deathStageCue = 0;
      this.emitCue('death-freeze', this.coreWorld, 1);
      return;
    }
    this.finishDeath();
  }

  private clearHazards(): void {
    this.pinwheel.clear();
    this.judgement.clear();
    this.pylonLance.clear();
    this.arcStrike.clear();
    this.shockwaves.clear();
    this.orbitals.clear();
    this.discharges.clear();
    this.major = null;
    this.cannonQueue = 0;
    this.missileQueue = 0;
    this.haloSpeed = 0.06;
  }

  private updateDeathSequence(dt: number): void {
    this.deathTimer += dt;
    const t = this.deathTimer;
    const rig = this.rig;
    const s = rig.scale;
    const freeze = smoothstep(0, DEATH_FREEZE_END, t);
    const implode = smoothstep(DEATH_FREEZE_END, DEATH_IMPLODE_END, t);
    this.implode = implode;

    // 凝滞：各层运动减速、抖动；内爆：光环 / 浑天仪 / 冠根向核心收缩并加速旋转
    const shake = (1 - implode) * freeze * 0.35 * s;
    rig.body.position.set(
      (Math.random() - 0.5) * shake,
      Math.sin(this.time * 0.6) * 4 * this.sizeFactor * (1 - freeze) +
        (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake
    );
    const spin = (1 - freeze) * 0.3 + implode * implode * 9;
    rig.latticePivot.rotation.y += dt * (0.4 + spin * 2);
    rig.gyroPivots[0].rotation.y += dt * spin;
    rig.gyroPivots[1].rotation.x += dt * spin * 1.2;
    rig.halo.rotation.y += dt * spin * 0.8;
    const contract = 1 - 0.75 * implode;
    rig.halo.scale.setScalar(contract);
    rig.gyroPivots[0].scale.setScalar(1 - 0.8 * implode);
    rig.gyroPivots[1].scale.setScalar(1 - 0.85 * implode);
    rig.latticePivot.scale.setScalar(1 - 0.5 * implode);
    rig.crown.position.y = (6.4 - 5.2 * implode) * s;
    rig.root.position.y = (-6.4 + 5.2 * implode) * s;
    rig.crown.scale.setScalar(1 - 0.7 * implode);
    rig.root.scale.setScalar(1 - 0.7 * implode);
    rig.core.scale.setScalar(1 - 0.45 * implode);
    if (this.petalMode !== 'debris') {
      this.petalMode = 'debris';
      this.debrisBlend = 1;
    }
    this.posePetals(dt);

    // 核心：颜色在青 / 紫 / 白之间剧烈闪烁，内爆时越来越亮
    const flicker = Math.random();
    const materials = rig.materials;
    this.tmpColor.copy(
      flicker > 0.66 ? CORE_COLOR : flicker > 0.33 ? OVERLOAD_HOT : OVERLOAD_COLOR
    );
    materials.core.emissive.copy(this.tmpColor);
    materials.core.emissiveIntensity = 3 + 4 * implode + flicker * 1.5;
    materials.lattice.emissiveIntensity = 2.5 + 3 * implode;
    materials.circuit.emissiveIntensity = 2.3 * (1 - implode) + flicker * 1.2 * (1 - implode);
    const glowSize = (7.2 + 6 * implode + 2 * flicker) * s;
    rig.coreGlow.scale.set(glowSize, glowSize, 1);
    rig.coreGlow.material.opacity = 0.85;

    if (this.deathStageCue === 0 && t >= DEATH_FREEZE_END) {
      this.deathStageCue = 1;
      this.spawnVisualRing(
        this.coreWorld,
        240 * this.sizeFactor,
        0,
        DEATH_IMPLODE_END - DEATH_FREEZE_END,
        18 * this.sizeFactor,
        0.85,
        8 * this.sizeFactor
      );
      this.emitCue('death-implode', this.coreWorld, 1);
    }
    if (this.deathStageCue === 1 && t >= DEATH_IMPLODE_END) {
      this.deathStageCue = 2;
      this.triggerDeathFlash();
    }
    if (this.deathStageCue === 2) {
      // 新星：主体隐去，只剩扩张后淡出的白光
      const nova = smoothstep(DEATH_IMPLODE_END, DEATH_SEQUENCE_DURATION, t);
      rig.coreFlare.visible = true;
      const flareSize = (16 + 40 * nova) * s;
      rig.coreFlare.scale.set(flareSize, flareSize, 1);
      rig.coreFlare.material.opacity = Math.max(0, 1 - nova * 1.1);
    }

    // 连锁爆炸：凝滞期沿光环 / 浑天仪，内爆期向核心聚拢
    this.deathBurstTimer -= dt;
    if (this.deathBurstTimer <= 0 && this.deathStageCue < 2) {
      this.deathBurstTimer = 0.22 + 0.12 * (1 - implode);
      const radius = (7.6 - 6 * implode) * s;
      const angle = Math.random() * Math.PI * 2;
      this.tmpA
        .set(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 6 * s * (1 - implode),
          Math.sin(angle) * radius
        )
        .add(this.coreWorld);
      this.fx.emit('createExplosion', this.tmpA, 1.2 + implode, 'enemy');
      if (Math.random() < 0.5) this.fx.emit('createHit', this.tmpA, 2, 'boss');
      if (Math.random() < 0.35) {
        this.tmpB
          .set(Math.random() - 0.5, -0.4 - Math.random() * 0.4, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(180 * this.sizeFactor)
          .add(this.coreWorld);
        this.tmpB.y = this.sampleGround(this.tmpB.x, this.tmpB.z);
        this.discharges.fire(this.coreWorld, this.tmpB, 0.25, 1.2 * this.sizeFactor);
      }
    }
    this.discharges.update(dt);
    this.mesh.updateMatrixWorld(true);
    this.rig.core.getWorldPosition(this.coreWorld);
    if (t >= DEATH_SEQUENCE_DURATION) this.finishDeath();
  }

  private triggerDeathFlash(): void {
    const rig = this.rig;
    rig.body.visible = false;
    for (const pylon of this.pylons) pylon.rig.group.visible = false;
    rig.shield.visible = false;
    const sf = this.sizeFactor;
    this.fx.emit('createBossDeathExplosion', this.coreWorld, rig.scale * 1.4);
    this.fx.emit('createShockwave', this.coreWorld, 320 * sf, 1.6, 0xffffff, 1);
    this.fx.emit('createShockwave', this.coreWorld, 220 * sf, 1.2, ORACLE_PALETTE.overload, 0.95);
    this.fx.emit('createEmpBurst', this.coreWorld, 260 * sf);
    this.spawnVisualRing(this.coreWorld, 20 * sf, 420, 2.4, 22 * sf, 1);
    this.spawnVisualRing(this.coreWorld, 10 * sf, 260, 2.8, 10 * sf, 0.8);
    this.emitCue('death-flash', this.coreWorld, 1);
  }

  private finishDeath(): void {
    this.dying = false;
    this.mesh.updateMatrixWorld(true);
    this.rig.core.getWorldPosition(this.tmpA);
    if (!isFiniteVector(this.tmpA)) this.tmpA.copy(this.mesh.position);
    const position = this.tmpA.clone();
    this.onDestroy?.(position, this.config);
    // 余波：在控制器清理粒子之后追加
    const sf = this.sizeFactor;
    this.fx.emit('createBossDeathExplosion', position, this.rig.scale);
    this.fx.emit('createShockwave', position, 260 * sf, 1.8, 0xe8fbff, 0.95);
    this.fx.emit('createShockwave', position, 150 * sf, 1.2, ORACLE_PALETTE.overload, 0.9);
    this.fx.emit('createEmpBurst', position, 200 * sf);
  }

  // ===========================================================================================
  // 视觉
  // ===========================================================================================

  private updateHazards(dt: number): void {
    if (this.hasPlayer) this.orbitals.setTrackedAltitude(this.playerPos.y);
    const pylonEvent = this.pylonLance.update(dt);
    if (pylonEvent === 'lock') {
      this.onHazardWarning?.('光矛锁定');
      this.emitCue('lance-lock', this.pylonLance.getOrigin(), 0.7);
    } else if (pylonEvent === 'fire') {
      this.emitCue('lance-fire', this.pylonLance.getOrigin(), 0.8);
    }
    if (this.arcStrike.update(dt)) {
      const point = this.arcStrike.getPoint();
      this.fx.emit('createEmpBurst', point, 24 * this.sizeFactor);
      this.fx.emit('createHit', point, 2.2, 'boss');
      this.emitCue('arc-strike', point, 0.9);
    }
    this.shockwaves.update(dt);
    this.orbitals.update(dt);
    if (!this.dying) this.discharges.update(dt);
  }

  private updateVisuals(dt: number): void {
    const rig = this.rig;
    const materials = rig.materials;
    const t = this.time;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.coreFlare = Math.max(0, this.coreFlare - dt * 0.9);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 1.6);

    // 蓄力程度：审判之矛 / 冲击环预警 / 终焉之光
    let chargeTarget = 0;
    const lanceCharge = this.judgement.getChargeProgress();
    if (lanceCharge > 0) chargeTarget = Math.max(chargeTarget, lanceCharge);
    const ringCharge = this.shockwaves.getTelegraphProgress();
    if (ringCharge >= 0) chargeTarget = Math.max(chargeTarget, ringCharge);
    if (this.major === 'last-light' && this.majorStep === 0)
      chargeTarget = Math.max(chargeTarget, smoothstep(0, 3, this.majorTimer));
    this.coreCharge += (chargeTarget - this.coreCharge) * Math.min(1, dt * 6);

    // 过载配色：青白 → 紫白
    const overloadTarget = this.phase >= 3 ? 1 : 0;
    this.overloadMix += (overloadTarget - this.overloadMix) * Math.min(1, dt * 1.2);
    const mix = this.overloadMix;
    const flicker = this.phase >= 3 ? 0.82 + 0.18 * Math.sin(t * 17) * Math.sin(t * 7.3) : 1;
    const critical = this.lowHealthReached ? 0.75 + 0.25 * Math.abs(Math.sin(t * 9)) : 1;
    materials.core.emissive.copy(CORE_COLOR).lerp(OVERLOAD_HOT, mix);
    materials.core.emissiveIntensity =
      (2.5 +
        0.5 * Math.sin(t * 2.4) +
        this.coreCharge * 3.5 +
        this.coreFlare * 2 +
        this.hitFlash * 1.5) *
      flicker;
    materials.lattice.emissive.copy(LATTICE_COLOR).lerp(OVERLOAD_COLOR, mix);
    materials.lattice.emissiveIntensity = (1.7 + 0.9 * mix + this.coreCharge * 2) * critical;
    materials.circuit.emissive.copy(CYAN_COLOR).lerp(OVERLOAD_COLOR, mix);
    materials.circuit.emissiveIntensity = (1.5 + 0.35 * Math.sin(t * 1.7) + 0.6 * mix) * critical;
    materials.port.emissive.copy(CYAN_COLOR).lerp(OVERLOAD_COLOR, mix);
    materials.gold.emissiveIntensity = 1.4 + 0.4 * Math.sin(t * 1.1) + this.coreCharge;
    materials.obsidian.emissiveIntensity = 0.5 + this.hitFlash * 0.5 + mix * 0.2;
    materials.spine.opacity = 0.45 + 0.2 * Math.sin(t * 3) + this.coreCharge * 0.35;
    materials.spine.color.copy(LATTICE_COLOR).lerp(OVERLOAD_COLOR, mix);

    // 蓄力时核心收缩、释放瞬间外胀（冲击环 / 审判之矛的读招提示）
    const coreScale = 1 - 0.14 * this.coreCharge + 0.12 * this.coreFlare;
    rig.core.scale.setScalar(Math.max(0.6, coreScale));
    const glowSize =
      (7.2 + 2.2 * this.coreCharge + 3 * this.coreFlare + 0.5 * Math.sin(t * 4)) * rig.scale;
    rig.coreGlow.scale.set(glowSize, glowSize, 1);
    rig.coreGlow.material.color.copy(CORE_COLOR).lerp(OVERLOAD_COLOR, mix * 0.7);
    rig.coreGlow.material.opacity = Math.min(1, 0.7 + 0.25 * this.coreCharge);
    const flare = Math.max(this.coreFlare, this.major === 'last-light' ? this.coreCharge : 0);
    rig.coreFlare.visible = flare > 0.02;
    if (rig.coreFlare.visible) {
      const size = (10 + 14 * flare) * rig.scale;
      rig.coreFlare.scale.set(size, size, 1);
      rig.coreFlare.material.opacity = 0.75 * flare;
      rig.coreFlare.material.color.copy(CORE_COLOR).lerp(OVERLOAD_HOT, mix);
    }

    // 瞳孔：瞳孔过热 / 衰竭 / 瘫痪时收缩成针孔（弱点暴露的读招提示）
    const exposed =
      this.apertureTimer > 0 ||
      this.exhaustTimer > 0 ||
      (this.stunTimer > 0 && !this.isShieldStage());
    const pupilTarget = exposed ? 0.28 : this.judgement.isBusy() ? 0.6 : 1;
    this.pupilOpen += (pupilTarget - this.pupilOpen) * Math.min(1, dt * 5);
    rig.pupil.scale.set(this.pupilOpen, this.pupilOpen, 1);
    materials.iris.emissive.copy(GOLD_COLOR).lerp(OVERLOAD_HOT, mix * 0.6);
    materials.iris.emissiveIntensity =
      2.2 + (exposed ? 2.5 * (0.6 + 0.4 * Math.sin(t * 12)) : 0) + lanceCharge * 2.5;
    materials.pupil.emissive.copy(OVERLOAD_COLOR);
    materials.pupil.emissiveIntensity = mix * 0.6 * flicker;
    const pupilGlow = Math.max(lanceCharge, this.judgement.getState() === 'fire' ? 1 : 0);
    rig.pupilGlow.visible = pupilGlow > 0.02;
    if (rig.pupilGlow.visible) {
      const size = (2.6 + 4 * pupilGlow) * rig.scale;
      rig.pupilGlow.scale.set(size, size, 1);
      rig.pupilGlow.material.opacity = 0.9 * pupilGlow;
    }

    // 发射器：蓄力 / 过热排气 / 受击
    for (const emitter of this.emitters) {
      if (!emitter.alive) continue;
      emitter.flash = Math.max(0, emitter.flash - dt * 4);
      const vent = emitter.vent > 0 ? 0.6 + 0.4 * Math.sin(t * 14 + emitter.rig.index) : 0;
      emitter.rig.material.emissive.copy(LATTICE_COLOR).lerp(OVERLOAD_HOT, mix);
      emitter.rig.material.emissiveIntensity =
        1.1 + emitter.charge * 4 + vent * 2.5 + emitter.flash * 2;
      const glow = Math.max(emitter.charge, vent * 0.7);
      emitter.rig.glow.visible = glow > 0.03;
      if (emitter.rig.glow.visible) {
        const size = (2.4 + 3 * glow) * rig.scale;
        emitter.rig.glow.scale.set(size, size, 1);
        emitter.rig.glow.material.opacity = 0.85 * glow;
        emitter.rig.glow.material.color.copy(vent > 0 ? OVERLOAD_HOT : LATTICE_COLOR);
      }
    }

    // 护盾塔：待机 / 蓄力 / 受击
    for (const pylon of this.pylons) {
      if (!pylon.alive) continue;
      const charging =
        pylon.attack === 'charge'
          ? Math.min(1, pylon.actionTimer / PYLON_CHARGE[pylon.rig.role])
          : 0;
      const active = pylon.attack === 'active' ? 0.6 : 0;
      const stun =
        this.stunTimer > 0 ? 0.35 + 0.65 * Math.abs(Math.sin(t * 23 + pylon.rig.index)) : 1;
      pylon.rig.crystalMaterial.emissiveIntensity =
        (1.35 +
          0.25 * Math.sin(t * 2 + pylon.rig.index) +
          charging * 2 +
          active * 1 +
          pylon.flash * 2) *
        stun;
      pylon.rig.ringMaterial.emissiveIntensity = 1.5 + charging * 1.5;
      const tipSize = (2.6 + 1.8 * charging + active * 0.8) * rig.scale;
      pylon.rig.tipGlow.scale.set(tipSize, tipSize, 1);
      pylon.rig.tipGlow.material.opacity = (0.6 + 0.3 * charging) * stun;
    }

    // 护盾着色器
    const shield = rig.shieldMaterial.uniforms;
    shield.uTime.value = t;
    shield.uFade.value = this.shieldFade;
    const alive = this.getAlivePylonCount();
    shield.uIntegrity.value = this.pylons.length > 0 ? alive / this.pylons.length : 0;
    shield.uFlash.value =
      this.shieldFlash +
      (this.stunTimer > 0 && this.isShieldStage() ? 0.25 * Math.abs(Math.sin(t * 19)) : 0);
    if (this.stage !== 'collapse') shield.uCollapse.value = 0;
  }

  private emitCue(cue: OraclePrimeCue, position: THREE.Vector3, intensity: number): void {
    if (!this.onEffectCue) return;
    this.cuePosition.copy(position);
    this.onEffectCue(cue, this.cuePosition, intensity);
  }
}
