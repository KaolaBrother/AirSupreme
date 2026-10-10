import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import type { PlayerHitFeedbackMetadata } from '@/core/EventBus';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerController } from '@/features/player/PlayerController';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { WORLDSCAPE_WATER_Y } from '@/features/terrain/TerrainGenerator';
import { HUD_COLORS } from '@/ui/theme/hudTokens';
import { ShieldRipple } from '@/features/effects/ShieldRipple';

/** 复活候选航向（相对首选航向）：原航向优先，再左右交替 ±45° / ±90° / ±135°，最后调头 */
const RESPAWN_HEADING_OFFSETS: readonly number[] = [
  0,
  Math.PI / 4,
  -Math.PI / 4,
  Math.PI / 2,
  -Math.PI / 2,
  (3 * Math.PI) / 4,
  (-3 * Math.PI) / 4,
  Math.PI,
];

export class PlayerSystem implements IGameSystem {
  readonly name = 'PlayerSystem';
  /** 机炮基础散布（度，总张角）：未辅助时 / 触屏辅助强度为 1 时；两者之间按辅助强度线性过渡 */
  private static readonly BASE_SPREAD_DEG = 3;
  private static readonly ASSISTED_BASE_SPREAD_DEG = 1.2;
  /** 航迹样本的最低离地高度（米）：贴地 / 宽限期抬升中的位置不算安全点 */
  private static readonly RESPAWN_ALTITUDE_BUFFER = 10;
  /** 复活点离地高度（米）：峡谷 / 火山等高耸地形上留出改出空间 */
  private static readonly RESPAWN_CLEARANCE = 40;
  /** 复活点取自坠毁前至少这么久（秒）…… */
  private static readonly RESPAWN_BACKTRACK_SECONDS = 3;
  /** ……且离坠毁点水平距离至少这么远（米）的航迹样本 */
  private static readonly RESPAWN_BACKTRACK_DISTANCE = 150;
  /** 航迹采样间隔（秒）与环形缓冲容量：约 16 秒的安全航迹，固定大小、无逐帧分配 */
  private static readonly TRACK_SAMPLE_INTERVAL = 0.25;
  private static readonly TRACK_CAPACITY = 64;
  /**
   * 复活净空探测：沿航向 0..400 米（近处步长更细），机体中线两侧各 24 米内每 3 米一条平行线。
   * 平行线比最细的柱状结构（天梯导轨 8 米宽）更密，航线两侧留出转弯余量——不再擦着刚撞上的
   * 立柱复活、稍一转向又撞上去
   */
  private static readonly RESPAWN_PROBE_RANGE = 400;
  private static readonly RESPAWN_PROBE_HALF_WIDTH = 24;
  private static readonly RESPAWN_PROBE_LANE_SPACING = 3;
  /** 探测线上表面高于“复活高度 - 该余量”即视为挡路（米） */
  private static readonly RESPAWN_PROBE_MARGIN = 20;
  /**
   * 复活后这么多秒（飞行时钟）内又坠毁：下一次复活的首选航向掉头、背离坠毁点。否则航迹太短时
   * 复活点与航向和上一次完全相同，同样的飞法会一次次撞上同一处障碍
   */
  private static readonly QUICK_RECRASH_SECONDS = 8;
  /** 复活后坠毁宽限（秒）：期间触地 / 撞上结构不坠毁，抬到表面之上并拉起机头 */
  private static readonly RESPAWN_CRASH_GRACE = 3;
  /** 宽限期触地时抬到表面之上的高度（米） */
  private static readonly GRACE_LIFT = 3;
  /** 宽限期触地时拉起到的俯仰角（弧度，约 12°） */
  private static readonly GRACE_PITCH = 0.21;
  /**
   * 宽限期触地需要抬升超过这么多米即视为撞上竖直结构（岩壁 / 立柱 / 塔身；一个模拟步里地表
   * 抬高十几米只可能是近乎竖直的面）：改为水平推出并转离墙面
   */
  private static readonly GRACE_WALL_LIFT = 12;
  /** 水平推出：由近到远每 2 米一圈、最远 48 米，每圈 16 个方位，找表面低于机体的位置 */
  private static readonly GRACE_ESCAPE_STEP = 2;
  private static readonly GRACE_ESCAPE_RANGE = 48;
  private static readonly GRACE_ESCAPE_DIRECTIONS = 16;
  /** 推出后的机头：去掉撞向墙面的分量，再加上这么多倍的外法线（贴墙掠过时外偏约 30°） */
  private static readonly GRACE_ESCAPE_OUTWARD = 0.6;

  private controller: PlayerController;
  private health: HealthSystem;
  private stats: PlayerStats;
  private mesh: THREE.Group;

  private lives: number = 3;
  private isRespawning: boolean = false;
  private respawnTimer: number = 0;
  private respawnDelay: number = 2;
  private crashSurfaceSampler: ((x: number, z: number) => number) | null = null;

  /** 安全航迹环形缓冲（世界坐标 + 飞行时钟时间戳）；出生 / 读档 / 复活时从该点重新开始 */
  private readonly trackX = new Float64Array(PlayerSystem.TRACK_CAPACITY);
  private readonly trackY = new Float64Array(PlayerSystem.TRACK_CAPACITY);
  private readonly trackZ = new Float64Array(PlayerSystem.TRACK_CAPACITY);
  private readonly trackTime = new Float64Array(PlayerSystem.TRACK_CAPACITY);
  private trackHead: number = 0;
  private trackCount: number = 0;
  private trackSampleTimer: number = 0;
  /** 航迹起点（出生 / 读档 / 复活点）的航向，坠毁信息缺失时复活用 */
  private trackAnchorHeading: number = 0;
  /** 飞行时钟（秒）：只在存活飞行时推进，给航迹样本与坠毁打时间戳 */
  private flightClock: number = 0;
  private crashGraceTimer: number = 0;
  private readonly crashPosition = new THREE.Vector3();
  private crashTime: number = 0;
  private crashHeading: number = 0;
  private hasCrashPosition: boolean = false;
  /** 最近一次阵亡是撞上地表 / 结构（而不是被击落） */
  private crashWasSurface: boolean = false;
  /** 坠毁判定正在结算撞地伤害（handleDeath 据此区分撞地与被击落） */
  private surfaceImpactPending: boolean = false;
  /** 最近一次复活的飞行时钟时间（出生 / 读档 / placeAt 后为 -Infinity） */
  private lastRespawnClock: number = -Infinity;
  private readonly respawnPosition = new THREE.Vector3();
  /** 净空探测结果（复用字段，避免分配） */
  private probeFirstBlocked: number = Infinity;
  private probeHighestTop: number = -Infinity;

  private shieldActive: boolean = false;
  private shieldGroup?: THREE.Group;
  private readonly shieldMaterials: THREE.MeshBasicMaterial[] = [];
  private shieldRipple?: ShieldRipple;
  private readonly shieldHitDirection = new THREE.Vector3();
  private readonly scratchForward = new THREE.Vector3();
  private readonly scratchUp = new THREE.Vector3();
  private readonly attitudeYaw = new THREE.Quaternion();
  private readonly attitudePitch = new THREE.Quaternion();
  private static readonly UP_AXIS = new THREE.Vector3(0, 1, 0);
  private static readonly PITCH_AXIS = new THREE.Vector3(1, 0, 0);
  private shieldTime: number = 0;
  private shieldFade: number = 0;
  private shieldFadingOut: boolean = false;
  /** 视角淡化系数：第一人称时护盾半透明，不挡住座舱视野（1 = 正常） */
  private shieldViewFade: number = 1;
  private static readonly SHIELD_FADE_MS = 200;
  private static readonly SHIELD_INNER_OPACITY = 0.16;
  private static readonly SHIELD_OUTER_OPACITY = 0.08;
  private static readonly SHIELD_BREATHE_MIN = 1.0;
  private static readonly SHIELD_BREATHE_MAX = 1.03;
  private pendingDamageOptions: PlayerHitFeedbackMetadata | null = null;

  private fireCooldown: number = 0;
  /** 触屏机炮辅助方向（世界坐标单位向量，与机炮十字显示的是同一个）；null 时子弹沿机头方向发射 */
  private gunAimAssistDirection: THREE.Vector3 | null = null;
  /** 辅助强度 0..1：基础散布随它从 BASE_SPREAD_DEG 收窄到 ASSISTED_BASE_SPREAD_DEG */
  private gunAimAssistWeight: number = 0;
  private readonly previousVisualPosition = new THREE.Vector3();
  private readonly currentVisualPosition = new THREE.Vector3();
  private readonly interpolatedVisualPosition = new THREE.Vector3();
  private readonly previousVisualQuaternion = new THREE.Quaternion();
  private readonly currentVisualQuaternion = new THREE.Quaternion();
  private readonly interpolatedVisualQuaternion = new THREE.Quaternion();

  constructor(scene: THREE.Scene, mesh: THREE.Group, stats: PlayerStats) {
    this.mesh = mesh;
    this.stats = stats;
    this.controller = new PlayerController(mesh, scene, stats);
    this.health = new HealthSystem(stats.getMaxHealth());
    this.resetTrack(mesh.position);
    this.syncVisualState();
  }

  init(): void {
    this.health.onDamage = (amount) => {
      if (!this.shieldActive && !this.isRespawning) {
        EventBus.emit(GameEventType.PLAYER_HIT, {
          damage: amount,
          position: this.mesh.position.clone(),
          feedback: this.pendingDamageOptions ?? undefined,
        });
      }
    };

    this.health.onDeath = () => {
      this.handleDeath();
    };
  }

  update(deltaTime: number): void {
    if (this.isRespawning) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
    this.flightClock += dt;
    this.crashGraceTimer = Math.max(0, this.crashGraceTimer - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);
    this.updateShield(deltaTime);
    const surfaceY = this.checkGroundCollision();
    if (!this.isRespawning) {
      this.recordTrackSample(dt, surfaceY);
    }
  }

  dispose(): void {
    if (this.shieldGroup) {
      this.shieldRipple?.dispose();
      this.shieldRipple = undefined;
      this.shieldGroup.removeFromParent();
      this.shieldGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
      this.shieldMaterials.forEach((material) => material.dispose());
      this.shieldMaterials.length = 0;
      this.shieldGroup = undefined;
    }
  }

  /**
   * 护盾受击涟漪：以命中点方向在六边形护盾上播放闪光 + 扩散环（护盾不可见时忽略）
   */
  notifyShieldHit(worldPosition: THREE.Vector3): void {
    if (!this.shieldGroup || !this.shieldGroup.visible || !this.shieldRipple) {
      return;
    }
    const { x, y, z } = worldPosition;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }
    this.shieldHitDirection.copy(worldPosition).sub(this.shieldGroup.position);
    if (this.shieldHitDirection.lengthSq() < 1e-6) {
      // 命中点与护盾中心重合时取机头前方
      this.shieldHitDirection.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    }
    this.shieldRipple.notifyHit(this.shieldHitDirection);
  }

  private handleDeath(): void {
    this.lives--;
    this.recordCrash();

    EventBus.emit(GameEventType.PLAYER_DEATH, {
      position: this.mesh.position.clone(),
      lives: this.lives,
    });

    this.mesh.visible = false;
    this.syncVisualState();

    if (this.lives <= 0) {
      // Game over handled by Game.ts
    } else {
      this.isRespawning = true;
      this.respawnTimer = this.respawnDelay;
    }
  }

  private respawn(): void {
    this.health.reset();
    const heading = this.resolveRespawnPose(this.respawnPosition);

    this.mesh.position.copy(this.respawnPosition);
    // 改平姿态（只保留航向）：坠毁时多为俯冲，原姿态复活会立刻再次撞地
    this.setAttitude(heading, 0);

    this.mesh.visible = true;
    this.syncVisualState();

    // 新航迹从复活点开始：坠毁前的样本通向障碍物，不再作为下一次复活的候选
    this.resetTrack(this.respawnPosition);
    this.hasCrashPosition = false;
    this.lastRespawnClock = this.flightClock;
    this.crashGraceTimer = PlayerSystem.RESPAWN_CRASH_GRACE;
    this.isRespawning = false;
    EventBus.emit(GameEventType.PLAYER_RESPAWN, {
      position: this.mesh.position.clone(),
    });
  }

  /** 记下坠毁 / 被击落的位置、时刻与航向，复活时据此沿航迹回退 */
  private recordCrash(): void {
    const { x, y, z } = this.mesh.position;
    this.hasCrashPosition = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
    if (this.hasCrashPosition) {
      this.crashPosition.set(x, y, z);
    }
    this.crashTime = this.flightClock;
    this.crashHeading = this.headingOf(this.mesh.quaternion, this.trackAnchorHeading);
    this.crashWasSurface = this.surfaceImpactPending;
  }

  /**
   * 复活位姿：沿航迹回退到坠毁前 ≥ 3 秒且离坠毁点 ≥ 150 米的安全样本（航迹太短时由最远样本
   * 外推到 150 米），再由 0..400 米净空探测定航向与高度。复活后不久又坠毁时首选航向掉头
   * （背离坠毁点）。写入 out，返回航向（绕 Y，机头 -Z 为 0）。
   */
  private resolveRespawnPose(out: THREE.Vector3): number {
    let preferredHeading = this.trackAnchorHeading;
    if (this.trackCount === 0) {
      out.set(0, 0, 0);
    } else if (!this.hasCrashPosition) {
      // 坠毁点缺失（等待复活时被 placeAt 重置）：从航迹最新样本（出生 / 读档点）复活
      this.readTrackSample(0, out);
    } else {
      preferredHeading = this.crashHeading;
      const k = this.findBacktrackSample();
      if (k >= 0) {
        this.readTrackSample(k, out);
        preferredHeading = this.trackHeadingAt(k, preferredHeading);
      } else {
        preferredHeading = this.extrapolateRespawnPoint(out);
      }
      if (
        this.crashWasSurface &&
        this.crashTime - this.lastRespawnClock < PlayerSystem.QUICK_RECRASH_SECONDS
      ) {
        // 复活后不久又撞上（多半是同一处障碍）：这次背离它复活，不再沿同一条航线飞回去
        preferredHeading += Math.PI;
      }
    }
    if (!Number.isFinite(out.x) || !Number.isFinite(out.z)) {
      out.set(0, out.y, 0);
    }
    this.clampToBattlefield(out);
    return this.chooseRespawnHeading(out, preferredHeading);
  }

  /** 由新到旧找第一个“坠毁前 ≥ 3 秒且水平距离 ≥ 150 米”的航迹样本，返回其序号 k（无则 -1） */
  private findBacktrackSample(): number {
    const minDistanceSq =
      PlayerSystem.RESPAWN_BACKTRACK_DISTANCE * PlayerSystem.RESPAWN_BACKTRACK_DISTANCE;
    for (let k = 0; k < this.trackCount; k++) {
      const i = this.trackIndex(k);
      if (this.crashTime - this.trackTime[i] < PlayerSystem.RESPAWN_BACKTRACK_SECONDS) {
        continue;
      }
      const dx = this.trackX[i] - this.crashPosition.x;
      const dz = this.trackZ[i] - this.crashPosition.z;
      if (dx * dx + dz * dz >= minDistanceSq) {
        return k;
      }
    }
    return -1;
  }

  /**
   * 航迹太短（刚出生 / 刚读档 / 复活后不久又坠毁）：取离坠毁点最远的样本，沿“坠毁点 → 该样本”
   * 的水平方向外推到 150 米；样本与坠毁点重合时沿坠毁航向反向后退。返回原飞行方向的航向
   * （由复活点指向坠毁点），是否改向交给净空探测。
   */
  private extrapolateRespawnPoint(out: THREE.Vector3): number {
    const crash = this.crashPosition;
    let farthest = -1;
    let farthestSq = -1;
    for (let k = 0; k < this.trackCount; k++) {
      const i = this.trackIndex(k);
      const dx = this.trackX[i] - crash.x;
      const dz = this.trackZ[i] - crash.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > farthestSq) {
        farthestSq = distanceSq;
        farthest = i;
      }
    }
    let dirX: number;
    let dirZ: number;
    let baseY = crash.y;
    if (farthest >= 0 && farthestSq >= 1) {
      const length = Math.sqrt(farthestSq);
      dirX = (this.trackX[farthest] - crash.x) / length;
      dirZ = (this.trackZ[farthest] - crash.z) / length;
      baseY = this.trackY[farthest];
    } else {
      // 机头前向为 (-sinθ, -cosθ)，反向即 (sinθ, cosθ)
      dirX = Math.sin(this.crashHeading);
      dirZ = Math.cos(this.crashHeading);
      if (farthest >= 0) {
        baseY = Math.max(baseY, this.trackY[farthest]);
      }
    }
    const distance = PlayerSystem.RESPAWN_BACKTRACK_DISTANCE;
    out.set(crash.x + dirX * distance, baseY, crash.z + dirZ * distance);
    return Math.atan2(dirX, dirZ);
  }

  /** 复活点不放到软边界之外（否则一出现就被回推） */
  private clampToBattlefield(position: THREE.Vector3): void {
    const limit = GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS;
    const radial = Math.hypot(position.x, position.z);
    if (radial > limit) {
      const scale = limit / radial;
      position.x *= scale;
      position.z *= scale;
    }
  }

  /**
   * 复活高度与航向：先保证离地 RESPAWN_CLEARANCE；8 个候选航向（首选航向优先、左右交替扩展）里
   * 取第一个 0..400 米内无遮挡的。全部受阻时爬升到障碍顶最低那条航线之上（软顶界以下），
   * 爬不过去则取首个障碍最远的航向。写入 position.y，返回航向。
   */
  private chooseRespawnHeading(position: THREE.Vector3, preferredHeading: number): number {
    const surfaceY = this.sampleCrashSurfaceY(position.x, position.z);
    const minY = surfaceY + PlayerSystem.RESPAWN_CLEARANCE;
    if (!Number.isFinite(position.y) || position.y < minY) {
      position.y = minY;
    }
    // 软顶界之上无法保持高度（PlayerController 会把飞机压回），按顶界之下的高度探测
    const ceiling = GAME_CONSTANTS.WORLD.SOFT_CEILING - PlayerSystem.RESPAWN_ALTITUDE_BUFFER;
    const probeY = Math.min(position.y, ceiling);
    const base = Number.isFinite(preferredHeading) ? preferredHeading : 0;
    let lowestTop = Infinity;
    let lowestTopHeading = base;
    let farthestBlock = -1;
    let farthestBlockHeading = base;
    for (const offset of RESPAWN_HEADING_OFFSETS) {
      const heading = base + offset;
      this.probeHeading(position.x, position.z, probeY, heading);
      if (this.probeFirstBlocked === Infinity) {
        return heading;
      }
      if (this.probeHighestTop < lowestTop) {
        lowestTop = this.probeHighestTop;
        lowestTopHeading = heading;
      }
      if (this.probeFirstBlocked > farthestBlock) {
        farthestBlock = this.probeFirstBlocked;
        farthestBlockHeading = heading;
      }
    }
    const climbTo =
      lowestTop + PlayerSystem.RESPAWN_PROBE_MARGIN + PlayerSystem.RESPAWN_ALTITUDE_BUFFER;
    if (climbTo <= ceiling) {
      position.y = Math.max(position.y, climbTo);
      return lowestTopHeading;
    }
    return farthestBlockHeading;
  }

  /**
   * 沿航向探测 0..400 米（40 米内 2 米步长，之后 3 米）、中线两侧各 24 米内每 3 米一条平行线，
   * 写入 probeFirstBlocked（首个表面高于 y - 余量的距离，无则 Infinity）与 probeHighestTop。
   */
  private probeHeading(x: number, z: number, y: number, heading: number): void {
    const forwardX = -Math.sin(heading);
    const forwardZ = -Math.cos(heading);
    // 右侧向量：前向 (fx, fz) → (-fz, fx)
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const halfWidth = PlayerSystem.RESPAWN_PROBE_HALF_WIDTH;
    const spacing = PlayerSystem.RESPAWN_PROBE_LANE_SPACING;
    const blockedAbove = y - PlayerSystem.RESPAWN_PROBE_MARGIN;
    let firstBlocked = Infinity;
    let highestTop = -Infinity;
    for (let distance = 0; distance <= PlayerSystem.RESPAWN_PROBE_RANGE; ) {
      const centerX = x + forwardX * distance;
      const centerZ = z + forwardZ * distance;
      for (let lane = -halfWidth; lane <= halfWidth; lane += spacing) {
        const top = this.sampleCrashSurfaceY(centerX + rightX * lane, centerZ + rightZ * lane);
        if (top > highestTop) {
          highestTop = top;
        }
        if (top > blockedAbove && distance < firstBlocked) {
          firstBlocked = distance;
        }
      }
      distance += distance < 40 ? 2 : 3;
    }
    this.probeFirstBlocked = firstBlocked;
    this.probeHighestTop = highestTop;
  }

  /** 第 k 新的航迹样本（k = 0 为最新）在环形缓冲中的下标 */
  private trackIndex(k: number): number {
    const capacity = PlayerSystem.TRACK_CAPACITY;
    return (((this.trackHead - 1 - k) % capacity) + capacity) % capacity;
  }

  private readTrackSample(k: number, out: THREE.Vector3): void {
    const i = this.trackIndex(k);
    out.set(this.trackX[i], this.trackY[i], this.trackZ[i]);
  }

  /** 第 k 个样本处的飞行方向（指向下一个更新的样本）；样本过近时返回 fallback */
  private trackHeadingAt(k: number, fallback: number): number {
    const newer = k > 0 ? k - 1 : k;
    const older = k > 0 ? k : k + 1;
    if (older >= this.trackCount) {
      return fallback;
    }
    const from = this.trackIndex(older);
    const to = this.trackIndex(newer);
    const dx = this.trackX[to] - this.trackX[from];
    const dz = this.trackZ[to] - this.trackZ[from];
    if (dx * dx + dz * dz < 1) {
      return fallback;
    }
    return Math.atan2(-dx, -dz);
  }

  private pushTrackSample(x: number, y: number, z: number): void {
    const i = this.trackHead;
    this.trackX[i] = x;
    this.trackY[i] = y;
    this.trackZ[i] = z;
    this.trackTime[i] = this.flightClock;
    this.trackHead = (i + 1) % PlayerSystem.TRACK_CAPACITY;
    this.trackCount = Math.min(this.trackCount + 1, PlayerSystem.TRACK_CAPACITY);
  }

  /** 航迹从给定点（出生 / 读档 / 复活点，均为已知安全点）重新开始 */
  private resetTrack(position: THREE.Vector3): void {
    this.trackHead = 0;
    this.trackCount = 0;
    this.trackSampleTimer = 0;
    this.trackAnchorHeading = this.headingOf(this.mesh.quaternion, 0);
    const { x, y, z } = position;
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      this.pushTrackSample(x, y, z);
    }
  }

  /** 每 0.25 秒把离地 > 10 米的位置记入航迹（与坠毁判定共用同一次表面采样） */
  private recordTrackSample(deltaTime: number, surfaceY: number): void {
    this.trackSampleTimer += deltaTime;
    if (this.trackSampleTimer < PlayerSystem.TRACK_SAMPLE_INTERVAL) {
      return;
    }
    this.trackSampleTimer = 0;
    const { x, y, z } = this.mesh.position;
    if (
      !Number.isFinite(surfaceY) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      y <= surfaceY + PlayerSystem.RESPAWN_ALTITUDE_BUFFER
    ) {
      return;
    }
    this.pushTrackSample(x, y, z);
  }

  /** 航向角（绕 Y，机头 -Z 为 0）；机头接近竖直时用机背方向推断（俯冲时机背指向原航向） */
  private headingOf(quaternion: THREE.Quaternion, fallback: number): number {
    const forward = this.scratchForward.set(0, 0, -1).applyQuaternion(quaternion);
    let x = forward.x;
    let z = forward.z;
    if (x * x + z * z < 0.04) {
      const up = this.scratchUp.set(0, 1, 0).applyQuaternion(quaternion);
      const sign = forward.y < 0 ? 1 : -1;
      x = up.x * sign;
      z = up.z * sign;
    }
    if (!(x * x + z * z > 1e-8)) {
      return fallback;
    }
    const heading = Math.atan2(-x, -z);
    return Number.isFinite(heading) ? heading : fallback;
  }

  /** 机翼水平、只含航向与俯仰的姿态：q = yaw(heading) · pitch(pitch)（俯仰为正时机头向上） */
  private setAttitude(heading: number, pitch: number): void {
    this.attitudeYaw.setFromAxisAngle(PlayerSystem.UP_AXIS, heading);
    this.attitudePitch.setFromAxisAngle(PlayerSystem.PITCH_AXIS, pitch);
    this.mesh.quaternion.multiplyQuaternions(this.attitudeYaw, this.attitudePitch);
  }

  /**
   * 复活宽限期内触地：地面 / 缓坡抬到表面之上，机头低于约 12° 时改平机翼并拉起（航向不变）。
   * 撞上竖直结构（要抬 GRACE_WALL_LIFT 米以上）时改为水平推出并转离墙面：只往上抬会让飞机贴着
   * 立柱 / 岩壁一路爬升（天梯导轨顶在 7000 米），宽限一结束仍在柱体里坠毁。
   */
  private recoverFromGraceContact(surfaceY: number): void {
    const position = this.mesh.position;
    if (
      surfaceY + PlayerSystem.GRACE_LIFT - position.y > PlayerSystem.GRACE_WALL_LIFT &&
      this.escapeWall(position)
    ) {
      return;
    }
    position.y = surfaceY + PlayerSystem.GRACE_LIFT;
    const forward = this.scratchForward.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    if (forward.y < Math.sin(PlayerSystem.GRACE_PITCH)) {
      const heading = this.headingOf(this.mesh.quaternion, this.trackAnchorHeading);
      this.setAttitude(heading, PlayerSystem.GRACE_PITCH);
    }
  }

  /**
   * 宽限期撞墙：由近到远逐圈（每 2 米，最远 48 米，每圈 16 个方位）找表面低于机体（留 GRACE_LIFT
   * 余量）的位置，取最近一圈开阔方位的平均方向作为墙面外法线，把机体水平推到那里；机头去掉撞向
   * 墙面的分量再偏向外法线，机翼与俯仰改平。找不到开阔处（埋在大块地形里）返回 false。
   */
  private escapeWall(position: THREE.Vector3): boolean {
    const clearBelow = position.y - PlayerSystem.GRACE_LIFT;
    const directions = PlayerSystem.GRACE_ESCAPE_DIRECTIONS;
    const sector = (Math.PI * 2) / directions;
    for (
      let radius = PlayerSystem.GRACE_ESCAPE_STEP;
      radius <= PlayerSystem.GRACE_ESCAPE_RANGE;
      radius += PlayerSystem.GRACE_ESCAPE_STEP
    ) {
      let sumX = 0;
      let sumZ = 0;
      let firstX = 0;
      let firstZ = 0;
      let open = 0;
      for (let i = 0; i < directions; i++) {
        const dirX = Math.cos(i * sector);
        const dirZ = Math.sin(i * sector);
        if (
          this.sampleCrashSurfaceY(position.x + dirX * radius, position.z + dirZ * radius) <
          clearBelow
        ) {
          if (open === 0) {
            firstX = dirX;
            firstZ = dirZ;
          }
          sumX += dirX;
          sumZ += dirZ;
          open++;
        }
      }
      if (open === 0) {
        continue;
      }
      // 开阔方位的平均方向（左右对称抵消时退回第一个开阔方位），落点仍须开阔
      const length = Math.hypot(sumX, sumZ);
      let normalX = length > 1e-3 ? sumX / length : firstX;
      let normalZ = length > 1e-3 ? sumZ / length : firstZ;
      if (
        !(
          this.sampleCrashSurfaceY(position.x + normalX * radius, position.z + normalZ * radius) <
          clearBelow
        )
      ) {
        normalX = firstX;
        normalZ = firstZ;
      }
      position.x += normalX * radius;
      position.z += normalZ * radius;

      const forward = this.scratchForward.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
      let headingX = forward.x;
      let headingZ = forward.z;
      const horizontal = Math.hypot(headingX, headingZ);
      if (horizontal > 1e-3) {
        headingX /= horizontal;
        headingZ /= horizontal;
        const into = headingX * normalX + headingZ * normalZ;
        if (into < 0) {
          headingX -= into * normalX;
          headingZ -= into * normalZ;
        }
      } else {
        headingX = 0;
        headingZ = 0;
      }
      headingX += normalX * PlayerSystem.GRACE_ESCAPE_OUTWARD;
      headingZ += normalZ * PlayerSystem.GRACE_ESCAPE_OUTWARD;
      // 前向 (-sin h, -cos h) → h = atan2(-x, -z)
      this.setAttitude(Math.atan2(-headingX, -headingZ), 0);
      return true;
    }
    return false;
  }

  private updateShield(deltaTime: number): void {
    if (!this.shieldGroup) {
      return;
    }

    if (!this.shieldActive && !this.shieldFadingOut) {
      return;
    }

    this.shieldGroup.position.copy(this.mesh.position);
    this.shieldTime += deltaTime;
    const wave = 0.5 + 0.5 * Math.sin(this.shieldTime * Math.PI * 2);
    const breathe =
      PlayerSystem.SHIELD_BREATHE_MIN +
      (PlayerSystem.SHIELD_BREATHE_MAX - PlayerSystem.SHIELD_BREATHE_MIN) * wave;
    this.shieldGroup.scale.setScalar(breathe);
    this.shieldRipple?.update(deltaTime);

    if (this.shieldFadingOut) {
      const fadeSeconds = PlayerSystem.SHIELD_FADE_MS / 1000;
      this.shieldFade = Math.max(0, this.shieldFade - deltaTime / fadeSeconds);
      this.applyShieldOpacity(this.shieldFade);
      if (this.shieldFade <= 0) {
        this.shieldFadingOut = false;
        this.shieldGroup.visible = false;
      }
    }
  }

  private applyShieldOpacity(fade: number): void {
    const visibleFade = fade * this.shieldViewFade;
    this.shieldRipple?.setFade(visibleFade);
    if (this.shieldMaterials[0]) {
      this.shieldMaterials[0].opacity = PlayerSystem.SHIELD_INNER_OPACITY * visibleFade;
    }
    if (this.shieldMaterials[1]) {
      this.shieldMaterials[1].opacity = PlayerSystem.SHIELD_OUTER_OPACITY * visibleFade;
    }
  }

  /**
   * 护盾在视角中的淡化（CameraRig 混合值驱动：1 - 0.7 × blend），第一人称时护盾球
   * 包住座舱，降低不透明度避免遮挡视野。
   */
  setShieldViewFade(fade: number): void {
    const next = Number.isFinite(fade) ? Math.max(0, Math.min(1, fade)) : 1;
    if (Math.abs(next - this.shieldViewFade) < 0.005) {
      return;
    }
    this.shieldViewFade = next;
    if (this.shieldGroup && this.shieldGroup.visible) {
      this.applyShieldOpacity(this.shieldFadingOut ? this.shieldFade : 1);
    }
  }

  private createShieldVisual(scene: THREE.Scene): void {
    const group = new THREE.Group();
    group.name = 'player-shield';
    const sysColor = new THREE.Color(HUD_COLORS.sys);

    const makeSphere = (radius: number, opacity: number): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(radius, 24, 24);
      const material = new THREE.MeshBasicMaterial({
        color: sysColor,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      this.shieldMaterials.push(material);
      return new THREE.Mesh(geometry, material);
    };

    const inner = makeSphere(2.85, PlayerSystem.SHIELD_INNER_OPACITY);
    const outer = makeSphere(3.1, PlayerSystem.SHIELD_OUTER_OPACITY);
    group.add(inner);
    group.add(outer);
    // 六边形能量网格 + 受击涟漪层
    this.shieldRipple = new ShieldRipple(3.0, sysColor);
    group.add(this.shieldRipple.mesh);
    scene.add(group);

    this.shieldGroup = group;
  }

  private sampleCrashSurfaceY(worldX: number, worldZ: number): number {
    if (this.crashSurfaceSampler) {
      const sampled = this.crashSurfaceSampler(worldX, worldZ);
      if (Number.isFinite(sampled)) {
        return sampled;
      }
    }
    return WORLDSCAPE_WATER_Y;
  }

  /**
   * 坠毁判定：世界 Y ≤ 表面即坠毁（护盾道具不防撞地）；复活宽限期内改为抬升 + 拉起
   * （撞上竖直结构时水平推出并转离墙面，见 recoverFromGraceContact）。
   * 返回本帧采样的表面高度（位置非法时为 NaN），供航迹记录复用。
   */
  private checkGroundCollision(): number {
    const { x, y, z } = this.mesh.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return NaN;
    }

    const surfaceY = this.sampleCrashSurfaceY(x, z);
    if (y > surfaceY) {
      return surfaceY;
    }
    if (this.crashGraceTimer > 0) {
      this.recoverFromGraceContact(surfaceY);
      return surfaceY;
    }
    this.surfaceImpactPending = true;
    try {
      this.health.takeDamage(1000);
    } finally {
      this.surfaceImpactPending = false;
    }
    return surfaceY;
  }

  /** 注入活地形/水面高度采样；未设置时坠毁判定回落到 WORLDSCAPE_WATER_Y */
  setCrashSurfaceSampler(sampler: (x: number, z: number) => number): void {
    this.crashSurfaceSampler = sampler;
  }

  /**
   * 换关 / 读档：把玩家放到新位置与朝向（四元数），同步插值状态；航迹从该点重新开始，
   * 之前的坠毁记录与复活宽限作废。
   */
  placeAt(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    const { x, y, z } = position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }
    this.mesh.position.copy(position);
    this.mesh.quaternion.copy(quaternion);
    this.resetTrack(position);
    this.hasCrashPosition = false;
    this.lastRespawnClock = -Infinity;
    this.crashGraceTimer = 0;
    this.syncVisualState();
    if (this.shieldGroup) {
      this.shieldGroup.position.copy(position);
    }
  }

  getController(): PlayerController {
    return this.controller;
  }

  getHealth(): HealthSystem {
    return this.health;
  }

  /** 战斗伤害：先按复合装甲升级减伤（0..40%），再结算血量 */
  takeCombatDamage(amount: number, feedback?: PlayerHitFeedbackMetadata): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const reduction = this.stats.getArmorReduction();
    const dealt = amount * (1 - (Number.isFinite(reduction) ? reduction : 0));
    this.pendingDamageOptions = feedback ?? null;
    try {
      this.health.takeDamage(dealt);
    } finally {
      this.pendingDamageOptions = null;
    }
  }

  getStats(): PlayerStats {
    return this.stats;
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  getPosition(): THREE.Vector3 {
    return this.controller.getPosition();
  }

  getQuaternion(): THREE.Quaternion {
    return this.controller.getQuaternion();
  }

  getSpeed(): number {
    return this.controller.getSpeed();
  }

  canFire(): boolean {
    return this.fireCooldown <= 0 && !this.isRespawning;
  }

  fire(): void {
    if (!this.canFire()) return;

    const position = this.getPosition().clone();
    const quaternion = this.getQuaternion();
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);
    position.add(forward.clone().multiplyScalar(2));

    const baseFireRate = this.stats.getFireRate();
    this.fireCooldown = baseFireRate / this.stats.getRapidFireMultiplier();

    // 触屏辅助：子弹沿辅助方向发射（机炮十字画的就是这个方向），基础散布随辅助强度收窄
    const assistDirection = this.gunAimAssistDirection;
    let assistWeight = 0;
    if (assistDirection) {
      const length = assistDirection.length();
      if (Number.isFinite(length) && length > 0.5) {
        forward.copy(assistDirection).divideScalar(length);
        assistWeight = this.gunAimAssistWeight;
      }
    }

    const baseSpread =
      PlayerSystem.BASE_SPREAD_DEG +
      (PlayerSystem.ASSISTED_BASE_SPREAD_DEG - PlayerSystem.BASE_SPREAD_DEG) * assistWeight;
    const spreadAngle = this.stats.getSpreadAngle() + baseSpread;
    const spreadRad = ((spreadAngle / 2) * Math.PI) / 180;
    const randomAngle = (Math.random() - 0.5) * 2 * spreadRad;
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);

    EventBus.emit(GameEventType.PLAYER_FIRED, {
      position,
      direction: forward,
      damage: this.stats.getDamage(),
    });
  }

  /**
   * 触屏机炮辅助瞄准：给出辅助方向（世界坐标单位向量）后，下一次开火沿它发射；传 null 关闭。
   * 方向与强度由 GunLeadSolver 解算（偏移不超过 GAME_CONSTANTS.GUN_ASSIST.FULL_ANGLE），
   * 机炮十字画的是同一个方向；桌面端始终传 null。传入的向量按引用保存，调用方每步刷新。
   * @param weight 辅助强度 0..1：1 时基础散布收到最窄，0 时与未辅助相同
   */
  setGunAimAssist(direction: THREE.Vector3 | null, weight: number = 1): void {
    this.gunAimAssistDirection = direction;
    this.gunAimAssistWeight =
      direction && Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 0;
  }

  activateShield(scene: THREE.Scene): void {
    this.shieldActive = true;
    this.shieldFadingOut = false;
    this.shieldFade = 1;

    if (!this.shieldGroup) {
      this.createShieldVisual(scene);
    }

    if (this.shieldGroup) {
      this.shieldGroup.visible = true;
      this.shieldGroup.scale.setScalar(PlayerSystem.SHIELD_BREATHE_MIN);
      this.applyShieldOpacity(1);
    }
    EventBus.emit(GameEventType.SHIELD_ACTIVATED, { duration: 10 });
  }

  deactivateShield(): void {
    this.shieldActive = false;
    if (this.shieldGroup && this.shieldGroup.visible) {
      this.shieldFadingOut = true;
      this.shieldFade = Math.max(this.shieldFade, 0.0001);
    }
    EventBus.emit(GameEventType.SHIELD_DEACTIVATED, undefined as never);
  }

  isShieldActive(): boolean {
    return this.shieldActive;
  }

  isPlayerRespawning(): boolean {
    return this.isRespawning;
  }

  getLives(): number {
    return this.lives;
  }

  setLives(lives: number): void {
    this.lives = lives;
  }

  syncMaxHealth(): void {
    const oldPercent = this.health.getHealthPercent();
    const newMax = this.stats.getMaxHealth();
    this.health.setMaxHealth(newMax);
    if (oldPercent > 0.9) {
      this.health.healToMax();
    } else {
      const newCurrent = Math.ceil(newMax * oldPercent);
      this.health.heal(newCurrent - this.health.getCurrentHealth());
    }
  }

  getFireCooldown(): number {
    return this.fireCooldown;
  }

  public capturePreviousVisualState(): void {
    this.previousVisualPosition.copy(this.currentVisualPosition);
    this.previousVisualQuaternion.copy(this.currentVisualQuaternion);
  }

  public captureCurrentVisualState(): void {
    this.currentVisualPosition.copy(this.mesh.position);
    this.currentVisualQuaternion.copy(this.mesh.quaternion);
  }

  public syncVisualState(): void {
    this.previousVisualPosition.copy(this.mesh.position);
    this.currentVisualPosition.copy(this.mesh.position);
    this.previousVisualQuaternion.copy(this.mesh.quaternion);
    this.currentVisualQuaternion.copy(this.mesh.quaternion);
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
}
