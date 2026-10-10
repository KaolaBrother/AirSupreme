import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';
import { EnemyConfig, EnemyAIState, ENEMY_TRAIL_COLOR } from './EnemyTypes';
import { ENEMY_WEAPON_SPECS, JET_MISSILE_SPEC, type EnemyWeaponKind } from './EnemyWeapons';
import {
  DOCTRINE_RULES,
  createAttackOrders,
  releaseAttackOrders,
  type AttackOrders,
  type AttackRequest,
  type DoctrineCommand,
  type DoctrineContext,
  type DoctrineCue,
  type IEnemyDoctrine,
} from './doctrine/DoctrineTypes';
import { createDoctrineCommand, resetDoctrineCommand } from './doctrine/JetDoctrine';
import { CloakFade } from './effects/CloakFade';
import { LanceBeam } from './effects/LanceBeam';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('EnemyAI');

/** 地形高度采样（世界 Y）：用于敌机避让峡谷岩壁、火山、天梯立柱、城堡等高耸地形 */
export type EnemyTerrainSampler = (x: number, z: number) => number;

/** 前瞻采样时间点（秒）：沿当前速度方向检查前方地形 */
const TERRAIN_LOOKAHEAD_SECONDS: readonly number[] = [0.5, 1.2, 2.2];
/** 前瞻期望离地高度（米） */
const TERRAIN_CLEARANCE = 32;
/** 机下实时最低离地高度（米）：低于此值立即强制爬升 */
const TERRAIN_MIN_CLEARANCE = 12;
/** 绝对兜底：穿入地形时直接抬到地表以上（米） */
const TERRAIN_HARD_FLOOR = 5;

/**
 * 开火距离上限（米）：超出则不开火。子弹射程 500 米，但远距离点射只在玩家直线飞行时
 * 才会命中，只会制造无从躲避的消耗；把交火拉进可见、可规避的距离。
 */
const FIRE_RANGE = 420;
/**
 * 瞄准散布（弧度）：总散布角 = (1 - accuracy) × AIM_SPREAD，偏航与俯仰各自独立均匀分布。
 * accuracy 由 EnemyTypes 基础值 + 关卡曲线的命中加成（Difficulty.getLevelScaling）给出。
 */
const AIM_SPREAD = 0.4;
/** 敌机子弹弹速（米/秒，敌方子弹池固定弹速，不继承载机速度），用于计算提前量 */
const BULLET_SPEED = GAME_CONSTANTS.PROJECTILE.SPEED;
/** 提前量的最长预测时间（秒）：超出射程的远距离不再外推 */
const MAX_LEAD_SECONDS = 4;
/** 目标速度估计的合理上限（米/秒）：更大视为瞬移（复活 / 传送），不做提前 */
const MAX_TARGET_SPEED = 250;

/** 条令飞行：俯仰上限（正弦，约 44°）——机头不会竖直上下 */
const DOCTRINE_MAX_PITCH_SIN = 0.7;
/** 条令飞行：速率每秒最多变化“基础速度 × 这个比例” */
const DOCTRINE_ACCELERATION = 0.9;
/** 条令给出的转向倍数的允许范围 */
const DOCTRINE_MIN_TURN_SCALE = 0.2;
const DOCTRINE_MAX_TURN_SCALE = 2;
/** 隐形（不透明度低于一半）时粒子尾迹每这么多步才采一个点：只留一条稀疏的淡尾迹 */
const CLOAK_TRAIL_STRIDE = 4;

/** 一发子弹的弹种信息（条令开火时随 onFire 传出；旧的三状态开火不带） */
export interface EnemyShotInfo {
  weapon: EnemyWeaponKind;
  /** 弹速（米/秒） */
  speed: number;
  /** 同一次齐射里的后续弹：不单独播放开火音与枪口焰 */
  quiet: boolean;
}

export interface EnemyAIOptions {
  /**
   * 机型条令：给了就由它决定往哪飞、飞多快、何时开火；不给则沿用旧的三状态
   * （追逐 / 固定方向 / 盘旋）行为——僚机（FriendlyAI）走的就是这条路。
   */
  doctrine?: IEnemyDoctrine | null;
  /** 尾迹颜色（缺省为敌方红橙） */
  trailColor?: number;
  /** 条令用的 0..1 随机数来源（缺省 Math.random；测试 / 回放时注入种子） */
  rng?: () => number;
}

// 每帧复用的临时对象（所有敌机实例共享，update 内同步使用）
const tmpDirection = new THREE.Vector3();
const tmpForward = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const lookHelper = new THREE.Object3D();
const tmpDesired = new THREE.Vector3();
/** onFire 的弹种信息：同步回调内读取，不要保存引用 */
const sharedShotInfo: EnemyShotInfo = { weapon: 'bullet', speed: BULLET_SPEED, quiet: false };

function isFiniteVector(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

export class EnemyAI {
  private mesh: THREE.Group;
  private config: EnemyConfig;
  private health: HealthSystem;
  private trail: ParticleTrailRenderer;

  // 基于导弹的运动系统
  public velocity: THREE.Vector3;
  private targetPosition: THREE.Vector3 | null; // 玩家位置（不是Object3D）

  // 状态机
  private currentState: EnemyAIState = EnemyAIState.CHASE; // 默认状态
  private stateTimer: number = 0; // 当前状态持续时间
  private fixedDirectionTarget: THREE.Vector3; // 固定方向飞行状态的虚拟追踪点
  private circleAngle: number = 0; // 盘旋角度

  // 盘旋随机参数（每次进入盘旋状态时重新生成）
  private currentCircleRadius: number = 0; // 当前盘旋半径（配置值 + 随机20-60米）
  private currentCircleHeight: number = 0; // 当前高度差（随机0-50米）

  // 攻击参数
  private attackCooldown: number = 0;
  /** 开火目标的速度估计（由 LevelManager 每步写入；未设置时不做提前量） */
  private readonly targetVelocity = new THREE.Vector3();
  private hasTargetVelocity = false;

  // 友军列表（用于盘旋状态判断目标）
  private friendlyMeshes: THREE.Object3D[] = [];

  // 地形避让与 EMP 瘫痪
  private terrainSampler: EnemyTerrainSampler | null = null;
  private stunTimer: number = 0;
  private readonly engineWorldPos = new THREE.Vector3();

  // 条令（可选）与导演的指令
  private readonly scene: THREE.Scene;
  private readonly doctrine: IEnemyDoctrine | null;
  private readonly doctrineContext: DoctrineContext | null;
  private readonly doctrineCommand: DoctrineCommand | null;
  /** 攻击令牌导演写在本机上的指令（没有条令的敌机不参与，始终没有令牌） */
  public readonly orders: AttackOrders = createAttackOrders();
  /** 条令飞行的当前空速（米/秒）：在 0.6×–1.3× 基础速度之间平滑变化 */
  private airspeed: number;
  // 战场态势（EnemySystem 每步写入）
  private readonly playerForward = new THREE.Vector3(0, 0, -1);
  private lockedOn = false;
  private missileInbound = false;
  private level = 1;
  private bossFight = false;
  /** 玩家现在可以被攻击（复活中 / 剧情停顿 / 阵亡时为 false：任何武器都不开火） */
  private playerTargetable = true;
  /** 狙击机的瞄准光束（首次蓄力时创建） */
  private lanceBeam: LanceBeam | null = null;
  /** 全队导弹令牌：本机现在可以发射的导弹数（EnemySystem 的导弹导演读写） */
  private missileGrant = 0;
  /** 上一步条令正在用导弹锁定玩家（HUD“锁定中”预警的来源） */
  private missileLocking = false;
  /** 同伴（非干扰机）的平均位置：干扰机躲在它们身后（EnemySystem 每步写入） */
  private readonly groupCenter = new THREE.Vector3();
  private groupId = 0;
  private hasGroup = false;
  /** 隐形机的淡出 / 眼灯特效（首次隐形时创建）与当前机体不透明度 */
  private cloakFade: CloakFade | null = null;
  private cloakOpacity = 1;
  private trailStep = 0;

  // 回调
  /** shot 只在条令开火时提供（弹种 / 弹速 / 是否静音），且只在回调期间有效 */
  public onFire?: (
    position: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    shot?: Readonly<EnemyShotInfo>
  ) => void;
  /** 条令触发的一次性提示（蓄力音等） */
  public onTell?: (cue: DoctrineCue, position: THREE.Vector3, duration: number) => void;
  /** 条令发射一枚追踪导弹：离架点与方向只在回调期间有效（接收方自己复制） */
  public onMissileLaunch?: (position: THREE.Vector3, direction: THREE.Vector3) => void;
  public onDestroy?: (position: THREE.Vector3) => void;
  private readonly previousVisualPosition = new THREE.Vector3();
  private readonly currentVisualPosition = new THREE.Vector3();
  private readonly interpolatedVisualPosition = new THREE.Vector3();
  private readonly previousVisualQuaternion = new THREE.Quaternion();
  private readonly currentVisualQuaternion = new THREE.Quaternion();
  private readonly interpolatedVisualQuaternion = new THREE.Quaternion();

  constructor(
    mesh: THREE.Group,
    config: EnemyConfig,
    scene: THREE.Scene,
    options: EnemyAIOptions = {}
  ) {
    this.mesh = mesh;
    this.config = config;
    this.scene = scene;
    this.health = new HealthSystem(config.health);
    this.targetPosition = null;

    // 初始化速度（向前）
    this.velocity = new THREE.Vector3(0, 0, -config.speed);
    this.airspeed = config.speed;

    // 初始化固定方向虚拟追踪点（随机）
    this.fixedDirectionTarget = this.generateFixedDirectionTarget();

    // 创建尾迹效果（阵营色：敌方红橙；僚机由 FriendlyAI 传入淡蓝）
    this.trail = new ParticleTrailRenderer(scene, mesh, options.trailColor ?? ENEMY_TRAIL_COLOR);

    // 选择初始状态
    this.selectNewState();
    this.stateTimer = this.randomStateDuration();

    this.doctrine = options.doctrine ?? null;
    if (this.doctrine) {
      this.doctrineContext = {
        dt: 0,
        position: this.mesh.position,
        forward: new THREE.Vector3(0, 0, -1),
        speed: config.speed,
        baseSpeed: config.speed,
        turnRate: config.turnSpeed,
        accuracy: config.accuracy,
        aimLead: config.aimLead ?? 0,
        cadenceScale: config.cadenceScale ?? 1,
        hasPlayer: false,
        playerPosition: new THREE.Vector3(),
        playerVelocity: new THREE.Vector3(),
        playerForward: new THREE.Vector3(0, 0, -1),
        distance: Infinity,
        lockedOn: false,
        missileInbound: false,
        weaponsFree: false,
        hasToken: false,
        attackBearing: Number.NaN,
        missileGrant: 0,
        hasGroup: false,
        groupCenter: new THREE.Vector3(),
        level: 1,
        bossFight: false,
        rng: options.rng ?? Math.random,
      };
      this.doctrineCommand = createDoctrineCommand();
    } else {
      this.doctrineContext = null;
      this.doctrineCommand = null;
    }

    // 设置死亡回调
    this.health.onDeath = () => {
      this.standDown();
      this.onDestroy?.(this.mesh.position.clone());
    };
    this.syncVisualState();
  }

  /**
   * 更新敌人
   */
  public update(
    deltaTime: number,
    playerPosition: THREE.Vector3 | null,
    friendlyMeshes?: THREE.Object3D[],
    fireTarget: THREE.Vector3 | null = null
  ): void {
    // 步长不是有限数（NaN / Infinity）：整步跳过，位置与朝向保持原样
    if (!Number.isFinite(deltaTime)) return;
    this.capturePreviousVisualState();
    if (!this.ensureFinitePosition()) {
      return;
    }

    this.targetPosition = playerPosition;

    if (friendlyMeshes) {
      this.friendlyMeshes = friendlyMeshes;
    }

    const weaponsFree = fireTarget !== null && this.playerTargetable;
    if (this.doctrine) {
      this.updateWithDoctrine(deltaTime, playerPosition, weaponsFree);
      return;
    }

    const stunned = this.stunTimer > 0;
    if (stunned) {
      // EMP 瘫痪：航电失灵，保持惯性滑行、不切换状态、不开火
      this.stunTimer = Math.max(0, this.stunTimer - deltaTime);
    } else {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.selectNewState();
        this.stateTimer = this.randomStateDuration();
      }

      switch (this.currentState) {
        case EnemyAIState.CHASE:
          this.updateChase(deltaTime);
          break;
        case EnemyAIState.FIXED_DIRECTION:
          this.updateFixedDirection(deltaTime);
          break;
        case EnemyAIState.CIRCLE:
          this.updateCircle(deltaTime);
          break;
      }
    }

    this.integrateMotion(deltaTime);

    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    if (!stunned && this.attackCooldown <= 0 && fireTarget && weaponsFree) {
      const toTarget = tmpDirection.subVectors(fireTarget, this.mesh.position).normalize();
      const forward = tmpForward.copy(this.velocity).normalize();
      const dot = toTarget.dot(forward);

      const fireAngle = Math.cos((this.config.fireSpreadAngle * Math.PI) / 180);
      const inRange = this.mesh.position.distanceToSquared(fireTarget) < FIRE_RANGE * FIRE_RANGE;

      if (dot > fireAngle && inRange) {
        this.fire(fireTarget);
        this.attackCooldown = this.config.attackCooldown;
      }
    }

    this.trail.update(deltaTime);
    this.captureCurrentVisualState();
  }

  // ---------------------------------------------------------------------------------------------
  // 条令飞行
  // ---------------------------------------------------------------------------------------------

  /**
   * 条令驱动的一步：填写战场快照 → 条令决策 → 按转向角速度 / 油门 / 加速度限制执行 →
   * 运动积分（地形避让、贴地兜底与旧路径相同）→ 发出本步的射击 → 交还令牌 / 提示 / 预警特效。
   * EMP 瘫痪期间不决策、不转向、不开火（保持惯性滑行）。
   */
  private updateWithDoctrine(
    deltaTime: number,
    playerPosition: THREE.Vector3 | null,
    weaponsFree: boolean
  ): void {
    const doctrine = this.doctrine;
    const context = this.doctrineContext;
    const command = this.doctrineCommand;
    if (!doctrine || !context || !command) return;

    const stunned = this.stunTimer > 0;
    resetDoctrineCommand(command);
    this.missileLocking = false;
    if (stunned) {
      this.stunTimer = Math.max(0, this.stunTimer - deltaTime);
    } else {
      this.fillDoctrineContext(context, deltaTime, playerPosition, weaponsFree);
      doctrine.update(context, command);
      this.steerByCommand(context, command, deltaTime);
    }

    this.integrateMotion(deltaTime, this.config.speed * DOCTRINE_RULES.MAX_THROTTLE);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    if (!stunned) {
      // 没有令牌的敌机不对玩家发动攻击（条令自己也守这条；这里是硬保证）。
      // 防御性射击（重型机尾炮）不需要令牌，但同样要有可攻击的玩家。
      if (context.weaponsFree) this.emitDoctrineShots(command, context.hasToken);
      if (command.missileLaunch > 0) this.launchMissile(context.hasToken);
      this.missileLocking = command.missileLock && context.hasToken;
      if (command.releaseToken && this.orders.hasToken) {
        releaseAttackOrders(this.orders, DOCTRINE_RULES.TOKEN_RELEASE_COOLDOWN);
      }
      if (command.cue) {
        this.onTell?.(command.cue, this.mesh.position, command.cueDuration);
      }
    }
    this.updateTellEffect(stunned ? null : doctrine);
    this.updateCloak(doctrine);

    this.trail.update(deltaTime);
    this.captureCurrentVisualState();
  }

  private fillDoctrineContext(
    context: DoctrineContext,
    deltaTime: number,
    playerPosition: THREE.Vector3 | null,
    weaponsFree: boolean
  ): void {
    const config = this.config;
    const speed = this.velocity.length();
    if (speed > 1e-6 && Number.isFinite(speed)) {
      context.forward.copy(this.velocity).multiplyScalar(1 / speed);
    } else {
      // 没有速度（或被写坏）：取机头方向（本地 +Z）
      context.forward.set(0, 0, 1).applyQuaternion(this.mesh.quaternion);
      if (!isFiniteVector(context.forward) || context.forward.lengthSq() < 1e-8) {
        context.forward.set(0, 0, -1);
      }
      context.forward.normalize();
    }
    context.dt = deltaTime > 0 ? deltaTime : 0;
    context.speed = Number.isFinite(speed) ? speed : 0;
    context.baseSpeed = config.speed;
    context.turnRate = config.turnSpeed;
    context.accuracy = config.accuracy;
    context.aimLead = config.aimLead ?? 0;
    context.cadenceScale = config.cadenceScale ?? 1;

    const hasPlayer = playerPosition !== null && isFiniteVector(playerPosition);
    context.hasPlayer = hasPlayer;
    if (hasPlayer) {
      context.playerPosition.copy(playerPosition);
      context.distance = this.mesh.position.distanceTo(playerPosition);
    } else {
      context.distance = Infinity;
    }
    if (this.hasTargetVelocity) {
      context.playerVelocity.copy(this.targetVelocity);
    } else {
      context.playerVelocity.set(0, 0, 0);
    }
    context.playerForward.copy(this.playerForward);
    context.lockedOn = this.lockedOn;
    context.missileInbound = this.missileInbound;
    // 阵亡后的最后一步也会走到这里：不再开火
    context.weaponsFree = weaponsFree && hasPlayer && this.isAlive();
    const hasToken = this.orders.hasToken && context.weaponsFree;
    context.hasToken = hasToken;
    context.attackBearing = hasToken ? this.orders.bearing : Number.NaN;
    context.missileGrant = hasToken ? this.missileGrant : 0;
    context.hasGroup = this.hasGroup;
    if (this.hasGroup) context.groupCenter.copy(this.groupCenter);
    context.level = this.level;
    context.bossFight = this.bossFight;
  }

  /**
   * 执行条令的飞行指令：机头以“转向角速度 × 倍数”转向期望方向（俯仰受限），
   * 空速以有限的加速度趋向“基础速度 × 油门（0.6–1.3）”。
   */
  private steerByCommand(
    context: DoctrineContext,
    command: DoctrineCommand,
    deltaTime: number
  ): void {
    const forward = context.forward;
    const desired = tmpDesired.copy(command.direction);
    const lengthSq = desired.lengthSq();
    if (lengthSq > 1e-10 && Number.isFinite(lengthSq)) {
      desired.multiplyScalar(1 / Math.sqrt(lengthSq));
    } else {
      desired.copy(forward);
    }

    // 俯仰限制：竖直分量超出上限时压回去，保持水平方向不变
    if (Math.abs(desired.y) > DOCTRINE_MAX_PITCH_SIN) {
      const horizontal = Math.hypot(desired.x, desired.z);
      const horizontalTarget = Math.sqrt(1 - DOCTRINE_MAX_PITCH_SIN * DOCTRINE_MAX_PITCH_SIN);
      if (horizontal > 1e-6) {
        const scale = horizontalTarget / horizontal;
        desired.x *= scale;
        desired.z *= scale;
      } else {
        const forwardHorizontal = Math.hypot(forward.x, forward.z);
        if (forwardHorizontal > 1e-6) {
          desired.x = (forward.x / forwardHorizontal) * horizontalTarget;
          desired.z = (forward.z / forwardHorizontal) * horizontalTarget;
        } else {
          desired.x = 0;
          desired.z = horizontalTarget;
        }
      }
      desired.y = Math.sign(desired.y) * DOCTRINE_MAX_PITCH_SIN;
    }

    const turnScale = Math.min(
      DOCTRINE_MAX_TURN_SCALE,
      Math.max(DOCTRINE_MIN_TURN_SCALE, Number.isFinite(command.turnScale) ? command.turnScale : 1)
    );
    const maxAngle = this.config.turnSpeed * turnScale * deltaTime;
    const cos = Math.min(1, Math.max(-1, forward.dot(desired)));
    const angle = Math.acos(cos);
    if (angle > maxAngle && angle > 1e-5) {
      tmpAxis.crossVectors(forward, desired);
      if (tmpAxis.lengthSq() < 1e-10) {
        // 正好反向：绕竖轴掉头（机头接近竖直时绕 X 轴）
        tmpAxis.copy(WORLD_UP);
        if (Math.abs(forward.y) > 0.99) tmpAxis.set(1, 0, 0);
      }
      tmpQuaternion.setFromAxisAngle(tmpAxis.normalize(), maxAngle);
      desired.copy(forward).applyQuaternion(tmpQuaternion).normalize();
    }

    const baseSpeed = this.config.speed;
    const throttle = Math.min(
      DOCTRINE_RULES.MAX_THROTTLE,
      Math.max(
        DOCTRINE_RULES.MIN_THROTTLE,
        Number.isFinite(command.throttle) ? command.throttle : 1
      )
    );
    const targetSpeed = baseSpeed * throttle;
    const maxDelta = baseSpeed * DOCTRINE_ACCELERATION * deltaTime;
    const delta = targetSpeed - this.airspeed;
    this.airspeed += Math.min(maxDelta, Math.max(-maxDelta, delta));
    // 换了配置（setConfig）或数值异常时回到允许范围
    this.airspeed = Math.min(
      baseSpeed * DOCTRINE_RULES.MAX_THROTTLE,
      Math.max(baseSpeed * DOCTRINE_RULES.MIN_THROTTLE, this.airspeed)
    );
    if (!Number.isFinite(this.airspeed)) this.airspeed = baseSpeed;

    if (isFiniteVector(desired)) {
      this.velocity.copy(desired).multiplyScalar(this.airspeed);
    }
  }

  /** 把条令本步的射击请求交给 onFire（弹种 / 弹速 / 是否静音随 shot 传出） */
  private emitDoctrineShots(command: DoctrineCommand, hasToken: boolean): void {
    if (!this.onFire) return;
    for (let i = 0; i < command.shotCount; i++) {
      const shot = command.shots[i];
      if (!hasToken && !shot.defensive) continue;
      const damage = this.config.damage * shot.damageScale;
      // 无武装机型（伤害为 0）不发射
      if (!(damage > 0)) continue;
      sharedShotInfo.weapon = shot.weapon;
      sharedShotInfo.speed = ENEMY_WEAPON_SPECS[shot.weapon].speed;
      sharedShotInfo.quiet = shot.quiet;
      this.onFire(this.mesh.position.clone(), shot.direction.clone(), damage, sharedShotInfo);
    }
  }

  /**
   * 条令发射一枚导弹：交还一个导弹令牌，沿当前飞行方向从机头前方离架。
   * 没有攻击令牌时不发射（令牌照样交还：这一发作废）。
   */
  private launchMissile(hasToken: boolean): void {
    this.missileGrant = Math.max(0, this.missileGrant - 1);
    if (!hasToken || !this.onMissileLaunch) return;
    const direction = tmpDirection.copy(this.velocity);
    const lengthSq = direction.lengthSq();
    if (!(lengthSq > 1e-8) || !Number.isFinite(lengthSq)) return;
    direction.multiplyScalar(1 / Math.sqrt(lengthSq));
    const origin = tmpTarget
      .copy(this.mesh.position)
      .addScaledVector(direction, JET_MISSILE_SPEC.MUZZLE_OFFSET);
    this.onMissileLaunch(origin, direction);
  }

  /** 隐形机的淡出 / 淡入与现形眼灯：按条令报告的隐形状态更新机体材质（瘫痪时也更新） */
  private updateCloak(doctrine: IEnemyDoctrine): void {
    const cloak = doctrine.getCloak();
    if (!cloak) return;
    this.cloakOpacity = cloak.opacity;
    if (!this.cloakFade && (cloak.opacity < 1 || cloak.flare > 0)) {
      this.cloakFade = new CloakFade(this.mesh);
    }
    this.cloakFade?.apply(cloak.opacity, cloak.flare);
  }

  /** 预警特效（狙击机的瞄准光束）：条令报告有预警就显示 / 更新，否则隐藏 */
  private updateTellEffect(doctrine: IEnemyDoctrine | null): void {
    const tell = doctrine ? doctrine.getTell() : null;
    if (tell && tell.kind === 'lance-beam') {
      this.lanceBeam ??= new LanceBeam(this.scene);
      this.lanceBeam.show(this.mesh.position, tell.aimPoint, tell.progress, tell.frozen);
    } else if (this.lanceBeam) {
      this.lanceBeam.hide();
    }
  }

  /** 中断条令（取消蓄力 / 点射）、交还令牌、收起预警特效：瘫痪、阵亡、重新生成时调用 */
  private standDown(): void {
    this.doctrine?.interrupt();
    releaseAttackOrders(this.orders, 0);
    this.lanceBeam?.hide();
    this.missileLocking = false;
    this.missileGrant = 0;
  }

  /**
   * 战场态势（EnemySystem 每步在 update 之前写入）：玩家机头方向、玩家对本机的威胁、
   * 当前关卡、是否在 Boss 战，以及玩家现在能不能被攻击。
   * playerTargetable 为 false（复活中 / 剧情停顿 / 阵亡）时本机任何武器都不开火——不需要令牌的
   * 防御性射击（重型机尾炮）也一样——也不开始锁定或蓄力；飞行照常。
   */
  public setCombatSituation(
    playerForward: THREE.Vector3 | null,
    lockedOn: boolean,
    missileInbound: boolean,
    level: number,
    bossFight: boolean,
    playerTargetable = true
  ): void {
    if (playerForward && isFiniteVector(playerForward) && playerForward.lengthSq() > 1e-8) {
      this.playerForward.copy(playerForward).normalize();
    }
    this.lockedOn = lockedOn;
    this.missileInbound = missileInbound;
    this.level = Number.isFinite(level) ? level : 1;
    this.bossFight = bossFight;
    this.playerTargetable = playerTargetable;
  }

  /** 本机的条令；旧三状态行为（僚机）为 null */
  public getDoctrine(): IEnemyDoctrine | null {
    return this.doctrine;
  }

  /** 条令当前阶段的简短名字（调试 / 开发钩子）；瘫痪时为 'stunned'，没有条令时为 'legacy' */
  public getDoctrinePhase(): string {
    if (!this.doctrine) return 'legacy';
    return this.stunTimer > 0 ? 'stunned' : this.doctrine.getPhase();
  }

  /** 条令向导演提出的令牌请求；没有条令时为 null（不受导演管） */
  public getAttackRequest(): Readonly<AttackRequest> | null {
    return this.doctrine ? this.doctrine.getAttackRequest() : null;
  }

  public hasAttackToken(): boolean {
    return this.orders.hasToken;
  }

  /** 条令想要的全队导弹令牌数；没有条令时为 0 */
  public getMissileRequest(): number {
    return this.doctrine ? this.doctrine.getMissileRequest() : 0;
  }

  public getMissileGrant(): number {
    return this.missileGrant;
  }

  /** 导弹导演发放 / 收回本机的导弹令牌 */
  public setMissileGrant(count: number): void {
    this.missileGrant = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  /** 正在用导弹锁定玩家（上一步的状态）：HUD“锁定中”预警的来源 */
  public isMissileLocking(): boolean {
    return this.missileLocking && this.isAlive();
  }

  /**
   * 隐形中（对玩家的传感器隐形）：不能被锁定，没有雷达光点、血条、目标标记与机炮前置标记。
   * 仍然会被子弹和导弹打中；淡出途中与现形预警期间不算。
   */
  public isCloaked(): boolean {
    const cloak = this.doctrine ? this.doctrine.getCloak() : null;
    return cloak !== null && cloak.hidden && this.isAlive();
  }

  /**
   * 波次编组号：同一波同一路到场的敌机相同；0 = 不属于任何编组（Boss 召唤 / 开发钩子）。
   * 干扰机据此找“自己那一路”。
   */
  public setGroupId(id: number): void {
    this.groupId = Number.isFinite(id) && id > 0 ? Math.floor(id) : 0;
  }

  public getGroupId(): number {
    return this.groupId;
  }

  /** 同伴（非干扰机）的平均位置；null = 场上没有可以躲在身后的同伴 */
  public setGroupCenter(center: THREE.Vector3 | null): void {
    if (center && isFiniteVector(center)) {
      this.groupCenter.copy(center);
      this.hasGroup = true;
    } else {
      this.hasGroup = false;
    }
  }

  /** 是否有正在显示的招牌攻击预警（狙击机瞄准光束） */
  public isTelegraphing(): boolean {
    return this.lanceBeam !== null && this.lanceBeam.isVisible();
  }

  /**
   * 外部操纵的运动学步进（僚机编队飞行等）：调用方先写好 velocity，本步与 update 一样做
   * 地形避让、位置积分、贴地兜底、按速度方向的四元数朝向、尾迹与渲染插值状态，
   * 但不运行机动状态机、不开火。机动状态与其计时保持冻结（之后的 update 从原状态继续），
   * 攻击冷却与 EMP 瘫痪照常计时。velocity 非有限时改为沿机头方向按配置速度飞行。
   */
  public updateKinematic(deltaTime: number): void {
    if (!Number.isFinite(deltaTime)) return;
    this.capturePreviousVisualState();
    if (!this.ensureFinitePosition()) {
      return;
    }

    const velocity = this.velocity;
    if (!isFiniteVector(velocity)) {
      // 外部写入了非有限速度：沿机头（本地 +Z，朝向即速度方向）按配置速度继续飞
      velocity.set(0, 0, this.config.speed).applyQuaternion(this.mesh.quaternion);
      if (!isFiniteVector(velocity)) velocity.set(0, 0, 0);
    }
    this.stunTimer = Math.max(0, this.stunTimer - deltaTime);
    this.integrateMotion(deltaTime);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
    this.trail.update(deltaTime);
    this.captureCurrentVisualState();
  }

  /** 位置为 NaN / Infinity 时复位到原点并返回 false（本步跳过） */
  private ensureFinitePosition(): boolean {
    const pos = this.mesh.position;
    if (isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)) {
      return true;
    }
    log.error('Enemy position is NaN or Infinity, resetting', {
      position: { x: pos.x, y: pos.y, z: pos.z },
    });
    this.mesh.position.set(0, 0, 0);
    return false;
  }

  /**
   * 地形避让 → 位置积分 → 贴地兜底 → 机头转向速度方向（四元数 slerp）→ 尾迹采样点。
   * speedLimit（条令飞行时给出）：避让抬高竖直速度后，压低水平速度使总速率不超过它。
   */
  private integrateMotion(deltaTime: number, speedLimit: number = Infinity): void {
    this.applyTerrainAvoidance();
    if (speedLimit < Infinity) this.limitSpeed(speedLimit);
    this.mesh.position.addScaledVector(this.velocity, deltaTime);
    this.enforceTerrainFloor();

    if (this.velocity.lengthSq() > 0) {
      tmpTarget.copy(this.mesh.position).add(this.velocity);
      lookHelper.position.copy(this.mesh.position);
      lookHelper.lookAt(tmpTarget);
      this.mesh.quaternion.slerp(lookHelper.quaternion, 0.3);
    }

    // 从引擎 mesh 获取世界位置（名为 'engineGlow'）
    const engine = this.mesh.getObjectByName('engineGlow');
    if (engine) {
      engine.getWorldPosition(this.engineWorldPos);
    } else {
      this.engineWorldPos.copy(this.mesh.position);
    }
    // 隐形时只留一条稀疏的淡尾迹
    if (this.cloakOpacity >= 0.5 || ++this.trailStep % CLOAK_TRAIL_STRIDE === 0) {
      this.trail.addPoint(this.engineWorldPos);
    }
  }

  /** 总速率超过上限时只压水平分量（保留避让地形所需的爬升率） */
  private limitSpeed(limit: number): void {
    const velocity = this.velocity;
    if (!(limit > 0) || !(velocity.lengthSq() > limit * limit)) return;
    const vertical = Math.max(-limit, Math.min(limit, velocity.y));
    const horizontal = Math.hypot(velocity.x, velocity.z);
    const allowed = Math.sqrt(Math.max(0, limit * limit - vertical * vertical));
    const scale = horizontal > 1e-6 ? allowed / horizontal : 0;
    velocity.set(velocity.x * scale, vertical, velocity.z * scale);
  }

  /**
   * 追逐状态更新
   */
  private updateChase(deltaTime: number): void {
    if (!this.targetPosition) return;

    // 计算到目标的方向
    const targetDirection = tmpDirection
      .subVectors(this.targetPosition, this.mesh.position)
      .normalize();

    // 获取当前速度方向
    const currentDirection = tmpForward.copy(this.velocity).normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    // 计算需要旋转的角度（选择最短路径）
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed,
      Math.cos(newRotation) * this.config.speed
    );
  }

  /**
   * 固定方向飞行状态更新
   * 敌机平滑转向固定方向（虚拟追踪点）
   */
  private updateFixedDirection(deltaTime: number): void {
    // 计算到虚拟追踪点的方向
    const targetDirection = tmpDirection
      .subVectors(this.fixedDirectionTarget, this.mesh.position)
      .normalize();

    // 获取当前速度方向
    const currentDirection = tmpForward.copy(this.velocity).normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    // 计算需要旋转的角度（选择最短路径）
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed,
      Math.cos(newRotation) * this.config.speed
    );
  }

  /**
   * 盘旋状态更新
   */
  private updateCircle(deltaTime: number): void {
    if (!this.targetPosition) return;

    // 判断盘旋目标：玩家或友军中更近的
    let circleTarget = this.targetPosition; // 默认玩家
    let minDistance = this.mesh.position.distanceTo(this.targetPosition);

    // 遍历所有友军，找到最近的
    for (const friendlyMesh of this.friendlyMeshes) {
      const distToFriendly = this.mesh.position.distanceTo(friendlyMesh.position);

      if (distToFriendly < minDistance) {
        minDistance = distToFriendly;
        circleTarget = friendlyMesh.position;
      }
    }

    // 更新盘旋角度（使用随机半径）
    const angularSpeed = this.config.speed / this.currentCircleRadius;
    this.circleAngle += angularSpeed * deltaTime;

    // 计算盘旋目标位置（围绕最近的目标，使用随机半径和高度）
    const targetX = circleTarget.x + Math.cos(this.circleAngle) * this.currentCircleRadius;
    const targetZ = circleTarget.z + Math.sin(this.circleAngle) * this.currentCircleRadius;
    const targetY = circleTarget.y + this.currentCircleHeight;

    const targetPos = tmpTarget.set(targetX, targetY, targetZ);

    // 计算到目标位置的方向
    const targetDirection = tmpDirection.subVectors(targetPos, this.mesh.position).normalize();

    // 获取当前速度方向
    const currentDirection = tmpForward.copy(this.velocity).normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    // 计算需要旋转的角度
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed,
      Math.cos(newRotation) * this.config.speed
    );
  }

  /**
   * 选择新状态（基于概率分布）
   */
  private selectNewState(): void {
    const rand = Math.random();
    const probs = this.config.stateProbabilities;

    let cumulative = 0;
    cumulative += probs[EnemyAIState.CHASE];
    if (rand < cumulative) {
      this.currentState = EnemyAIState.CHASE;
      return;
    }

    cumulative += probs[EnemyAIState.FIXED_DIRECTION];
    if (rand < cumulative) {
      this.currentState = EnemyAIState.FIXED_DIRECTION;
      // 重新生成虚拟追踪点
      this.fixedDirectionTarget = this.generateFixedDirectionTarget();
      // 不直接修改velocity，让updateFixedDirection()平滑转向
      return;
    }

    this.currentState = EnemyAIState.CIRCLE;
    // 重置盘旋角度
    this.circleAngle = 0;

    // 生成随机盘旋参数
    // 半径：配置值 + 随机20-60米
    this.currentCircleRadius = this.config.circleRadius + 20 + Math.random() * 40;
    // 高度差：随机0-50米
    this.currentCircleHeight = Math.random() * 50;
  }

  /**
   * 生成固定方向飞行状态的虚拟追踪点
   * 在战场范围内（距离玩家100-300米）随机生成
   */
  private generateFixedDirectionTarget(): THREE.Vector3 {
    // 战场边界（随全局战场尺寸缩放）
    const BATTLEFIELD_MAX = GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT;
    const BATTLEFIELD_MIN = -BATTLEFIELD_MAX;
    const BATTLEFIELD_SIZE = BATTLEFIELD_MAX * 2;

    // 需要玩家位置来生成追踪点
    if (!this.targetPosition) {
      // 如果没有玩家位置，返回默认位置（敌机前方100米）
      return this.mesh.position.clone().add(new THREE.Vector3(0, 0, -100));
    }

    // 尝试次数（避免无限循环）
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 随机距离：100-300米（距离玩家）
      const distance = 100 + Math.random() * 200;

      // 随机方向（水平面上）
      const angle = Math.random() * Math.PI * 2;

      // 计算追踪点位置（以玩家位置为中心）
      const target = new THREE.Vector3(
        this.targetPosition.x + Math.cos(angle) * distance,
        this.targetPosition.y,
        this.targetPosition.z + Math.sin(angle) * distance
      );

      // 检查是否在战场边界内
      if (
        target.x >= BATTLEFIELD_MIN &&
        target.x <= BATTLEFIELD_MAX &&
        target.z >= BATTLEFIELD_MIN &&
        target.z <= BATTLEFIELD_MAX
      ) {
        return target;
      }

      // 如果超出边界，尝试在战场内随机生成
      if (attempt === maxAttempts - 1) {
        // 最后一次尝试：直接在战场内随机位置
        return new THREE.Vector3(
          BATTLEFIELD_MIN + Math.random() * BATTLEFIELD_SIZE,
          this.targetPosition.y,
          BATTLEFIELD_MIN + Math.random() * BATTLEFIELD_SIZE
        );
      }
    }

    // 默认返回：玩家位置前方100米
    return this.targetPosition.clone().add(new THREE.Vector3(0, 0, -100));
  }

  /**
   * 生成随机状态持续时间
   */
  private randomStateDuration(): number {
    const [min, max] = this.config.stateDurationRange;
    return min + Math.random() * (max - min);
  }

  /**
   * 开火目标的速度（世界坐标，米/秒）：设置后按 config.aimLead 计算提前量；
   * 传 null 或非有限 / 过大的速度（瞬移）则只瞄准目标当前位置。
   */
  public setTargetVelocity(velocity: THREE.Vector3 | null): void {
    if (
      velocity &&
      Number.isFinite(velocity.x) &&
      Number.isFinite(velocity.y) &&
      Number.isFinite(velocity.z) &&
      velocity.lengthSq() < MAX_TARGET_SPEED * MAX_TARGET_SPEED
    ) {
      this.targetVelocity.copy(velocity);
      this.hasTargetVelocity = true;
    } else {
      this.hasTargetVelocity = false;
    }
  }

  /**
   * 瞄准点：目标位置 + 速度 × 拦截时间 × 提前量系数（两次迭代的一阶拦截，
   * 与 UnitMotion.predictIntercept 同法；留在本模块内，避免把单位运行时拉进核心分块）。
   */
  private computeAimPoint(targetPosition: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(targetPosition);
    const lead = this.config.aimLead ?? 0;
    if (!(lead > 0) || !this.hasTargetVelocity) return out;
    const origin = this.mesh.position;
    let time = Math.min(MAX_LEAD_SECONDS, origin.distanceTo(targetPosition) / BULLET_SPEED);
    out.copy(targetPosition).addScaledVector(this.targetVelocity, time);
    time = Math.min(MAX_LEAD_SECONDS, origin.distanceTo(out) / BULLET_SPEED);
    out.copy(targetPosition).addScaledVector(this.targetVelocity, time * Math.min(1, lead));
    if (!Number.isFinite(out.x) || !Number.isFinite(out.y) || !Number.isFinite(out.z)) {
      out.copy(targetPosition);
    }
    return out;
  }

  /**
   * 射击
   */
  private fire(targetPosition: THREE.Vector3): void {
    // 计算射击方向（按提前量瞄准拦截点）
    const aimPoint = this.computeAimPoint(targetPosition, tmpTarget);
    const direction = new THREE.Vector3().subVectors(aimPoint, this.mesh.position);
    direction.normalize();

    // 添加随机扰动（让瞄准不准确）：偏航（绕世界 Y）与俯仰（绕水平侧轴）各自独立
    const spread = Math.max(0, 1 - this.config.accuracy) * AIM_SPREAD;
    tmpQuaternion.setFromAxisAngle(WORLD_UP, (Math.random() - 0.5) * spread);
    direction.applyQuaternion(tmpQuaternion);
    tmpAxis.crossVectors(direction, WORLD_UP);
    if (tmpAxis.lengthSq() > 1e-8) {
      tmpQuaternion.setFromAxisAngle(tmpAxis.normalize(), (Math.random() - 0.5) * spread);
      direction.applyQuaternion(tmpQuaternion);
    }
    direction.normalize();

    // 触发回调
    this.onFire?.(this.mesh.position.clone(), direction, this.config.damage);
  }

  /**
   * 获取当前血量
   */
  public getHealth(): { current: number; max: number } {
    return {
      current: this.health.getCurrentHealth(),
      max: this.health.getMaxHealth(),
    };
  }

  /**
   * 获取血量系统（用于外部显示）
   */
  public getHealthSystem(): HealthSystem {
    return this.health;
  }

  /**
   * 获取配置
   */
  public getConfig(): EnemyConfig {
    return this.config;
  }

  public setConfig(config: EnemyConfig): void {
    this.config = config;
    this.health.setMaxHealth(config.health, true);
  }

  /**
   * 获取网格
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }

  /**
   * 是否存活
   */
  public isAlive(): boolean {
    return this.health.getCurrentHealth() > 0;
  }

  /**
   * 受到伤害
   */
  public takeDamage(damage: number): void {
    this.health.takeDamage(damage);
    // 挨打的反应（隐形机：立刻现形并僵直）
    if (damage > 0 && this.isAlive()) this.doctrine?.notifyHit();
  }

  /**
   * 地形采样（世界 Y）：设置后敌机沿速度方向前瞻并爬升避让高耸地形，
   * 且任何时候都不会钻入地表。未设置时保持原有自由飞行。
   */
  public setTerrainSampler(sampler: EnemyTerrainSampler | null): void {
    this.terrainSampler = typeof sampler === 'function' ? sampler : null;
  }

  /**
   * EMP 瘫痪：期间不开火、不切换机动状态（保持惯性）。条令敌机同时交还攻击令牌、
   * 取消蓄力 / 点射并收起预警特效。
   */
  public applyStun(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0 || !this.isAlive()) return;
    this.stunTimer = Math.max(this.stunTimer, Math.min(6, seconds));
    this.standDown();
  }

  public isStunned(): boolean {
    return this.stunTimer > 0;
  }

  /** 读取地形高度（非有限值视为无地形） */
  private sampleTerrain(x: number, z: number): number {
    const sampler = this.terrainSampler;
    if (!sampler || !Number.isFinite(x) || !Number.isFinite(z)) return -Infinity;
    const y = sampler(x, z);
    return Number.isFinite(y) ? y : -Infinity;
  }

  /**
   * 前瞻地形避让：沿当前水平速度在若干时间点采样地表，若预计高度低于“地表 + 安全高度”，
   * 把竖直速度抬升为爬升速度（与亏欠高度成正比，上限为本机速度）。
   */
  private applyTerrainAvoidance(): void {
    if (!this.terrainSampler) return;
    const position = this.mesh.position;
    const velocity = this.velocity;
    let required = this.sampleTerrain(position.x, position.z) + TERRAIN_MIN_CLEARANCE;
    for (const t of TERRAIN_LOOKAHEAD_SECONDS) {
      const ground = this.sampleTerrain(position.x + velocity.x * t, position.z + velocity.z * t);
      if (ground === -Infinity) continue;
      // 预计 t 秒后的高度若低于地表 + 安全高度，则需要提前爬升
      const predictedY = position.y + Math.max(0, velocity.y) * t;
      const deficit = ground + TERRAIN_CLEARANCE - predictedY;
      if (deficit > 0) {
        required = Math.max(required, position.y + deficit);
      }
    }
    if (!Number.isFinite(required) || position.y >= required) return;
    const deficit = required - position.y;
    const climbRate = Math.min(Math.max(this.config.speed, 20), deficit * 2.2 + 8);
    if (velocity.y < climbRate) {
      velocity.y = climbRate;
    }
  }

  /** 硬兜底：位置一旦落到地表以下，直接抬到地表上方（避免穿模 / 卡在岩壁里） */
  private enforceTerrainFloor(): void {
    if (!this.terrainSampler) return;
    const position = this.mesh.position;
    const ground = this.sampleTerrain(position.x, position.z);
    if (ground === -Infinity) return;
    const floor = ground + TERRAIN_HARD_FLOOR;
    if (position.y < floor) {
      position.y = floor;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
  }

  /**
   * 获取位置
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * 获取速度（当前前进方向）
   */
  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  /**
   * 重置敌人（用于生成时初始化位置和状态）
   */
  public reset(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.mesh.visible = false;
    this.health.reset();

    // 重置速度（向前）
    this.velocity = new THREE.Vector3(0, 0, -this.config.speed);
    this.airspeed = this.config.speed;
    this.stunTimer = 0;
    this.standDown();
    this.lockedOn = false;
    this.missileInbound = false;
    this.hasGroup = false;
    this.cloakOpacity = 1;
    this.cloakFade?.apply(1, 0);

    // 重置状态
    this.selectNewState();
    this.stateTimer = this.randomStateDuration();
    this.syncVisualState();
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 隐藏 mesh
    this.mesh.visible = false;

    // 移除mesh（如果已添加到场景）
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    // 清理尾迹
    this.trail.dispose();

    // 交还令牌、清理预警特效
    this.standDown();
    this.lanceBeam?.dispose();
    this.lanceBeam = null;
    // 换回共享材质并释放本机的淡出克隆（要在下面清理子对象之前）
    this.cloakFade?.dispose();
    this.cloakFade = null;

    // 清理 mesh 的所有子对象
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      // 跨机体共享的资源（航空信号灯等）不随单机销毁释放
      if (child.userData.sharedResource === true) {
        continue;
      }
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }

  public applyInterpolatedVisual(alpha: number): void {
    this.interpolatedVisualPosition.lerpVectors(
      this.previousVisualPosition,
      this.currentVisualPosition,
      alpha
    );
    this.interpolatedVisualQuaternion.slerpQuaternions(
      this.previousVisualQuaternion,
      this.currentVisualQuaternion,
      alpha
    );
    this.mesh.position.copy(this.interpolatedVisualPosition);
    this.mesh.quaternion.copy(this.interpolatedVisualQuaternion);
  }

  public restoreCurrentVisual(): void {
    this.mesh.position.copy(this.currentVisualPosition);
    this.mesh.quaternion.copy(this.currentVisualQuaternion);
  }

  private capturePreviousVisualState(): void {
    this.previousVisualPosition.copy(this.currentVisualPosition);
    this.previousVisualQuaternion.copy(this.currentVisualQuaternion);
  }

  private captureCurrentVisualState(): void {
    this.currentVisualPosition.copy(this.mesh.position);
    this.currentVisualQuaternion.copy(this.mesh.quaternion);
  }

  private syncVisualState(): void {
    this.previousVisualPosition.copy(this.mesh.position);
    this.currentVisualPosition.copy(this.mesh.position);
    this.previousVisualQuaternion.copy(this.mesh.quaternion);
    this.currentVisualQuaternion.copy(this.mesh.quaternion);
  }
}
