import * as THREE from 'three';
import type { InputState } from '@/core/Input/InputHandler';
import { GAME_CONSTANTS } from '@/config';
import { EventBus, GameEventType } from '@/core/EventBus';
import { Faction } from '@/core/Faction';
import {
  SPECIAL_WEAPON_IDS,
  getDeclaredHitRadius,
  type SpecialWeaponId,
} from '@/core/CombatContracts';
import { BOSS_DECOY_ANCHOR_NAME } from '@/core/boss/AdvancedBossSupport';
import { isAdvancedBoss } from '@/features/boss/BossContracts';
import { BOSS_MISSILE_CONFIG, BossType } from '@/features/boss/BossTypes';
import {
  ENEMY_WEAPON_SPECS,
  isEnemyWeaponKind,
  type EnemyWeaponKind,
} from '@/features/enemy/EnemyWeapons';
import {
  UPGRADE_CONFIGS,
  UpgradeType,
  getStartingUpgradePoints,
  getUpgradeCapForLevel,
  type PlayerUpgrades,
} from '@/features/upgrade/UpgradeSystem';
import { getSpecialWeaponStats } from '@/features/weapons/WeaponTypes';
import type { WeaponSystem } from '@/features/weapons/WeaponSystem';
import type { DevHookAccess } from './DevHooks';
import {
  ScriptedPilot,
  createPilotStats,
  type PilotKind,
  type PilotStats,
  type PilotSpecialState,
  type PilotTarget,
  type PilotWorld,
} from './ScriptedPilot';

/**
 * 开发构建专用：难度 / 成长曲线测量框架（window.__AIR_SUPREME_DEV__.balance）。
 *
 * - 接管飞行输入（脚本飞行员或“放手”飞行员），自动跳过剧情卡片、在机库按贪心策略购买升级；
 * - 记录每关每波的清场时间、受到的伤害、阵亡、Boss 击杀用时、得分与升级点；
 * - 用 GameLoop 的开发时间倍率加速（配合 Playwright 初始化脚本把 setTimeout 等比缩放、
 *   跳过 WebGL 绘制），在软件渲染的沙箱里也能跑完整十关。
 *
 * 由 DevHooks 安装；生产构建不包含本模块（见 GameCoordinator.installDevHooks）。
 */

export interface BalanceRunOptions {
  /** 'scripted'（默认）或 'passive'（不做任何输入） */
  pilot?: PilotKind;
  /** 模拟时间倍率 1..16（默认 6） */
  timeScale?: number;
  /** 打完这一关的 Boss 后结束（默认 10） */
  stopAfterLevel?: number;
  /** passive：首次阵亡或战斗开始后这么多秒结束（默认 150） */
  passiveMaxSeconds?: number;
  /** 机库购买策略（默认 greedy：最便宜优先，同价按生存 / 火力优先级） */
  purchases?: 'greedy' | 'none';
  /** 每次阵亡后把生命补到至少这么多（0 = 不补；默认 3），避免一关打崩就结束整轮测量 */
  keepLives?: number;
  /** 单波超过这么多秒强制清场并标记（默认 360） */
  waveTimeoutSeconds?: number;
  /** Boss 超过这么多秒强制击破并标记（默认 600） */
  bossTimeoutSeconds?: number;
  /** 飞行员慢变瞄准误差（度，默认 1.2） */
  aimErrorDeg?: number;
  /** 每隔这么多秒（游戏时间）记录一条飞行轨迹采样（0 = 不记录） */
  traceInterval?: number;
  /**
   * 机库升级点预算：'campaign' 在每次机库前把累计点数补到 getStartingUpgradePoints(关卡)
   * （跳关开局的官方预算 ≈ 正常推进的玩家进入该关时的存量），Boss 模式连战时机体与战役同步；
   * 'none'（默认）只用实际得分。
   */
  pointsBudget?: 'campaign' | 'none';
  /**
   * 坠地后下次复活把玩家抬到安全高度（默认 true，避免“复活即坠毁”把平衡数据搅乱）；
   * false 时照实复活，用于检查复活点本身是否安全（respawnCrashes / crashLog）。
   */
  rescueCrashes?: boolean;
}

interface WaveRecord {
  wave: number;
  start: number;
  end: number | null;
  /** 本波敌机全灭的时刻（之后只剩地面 / 海上单位） */
  jetsClearedAt: number | null;
  shots: number;
  pilot: PilotStats;
  damage: number;
  hits: number;
  deaths: number;
  crashes: number;
  forced: boolean;
  /** 伤害来源（按敌方子弹匹配：jet:TYPE / unit:TYPE；其余为 other） */
  sources: Record<string, number>;
  /** 复活后 4 秒内又坠毁的次数（复活点 / 航向不安全的信号） */
  respawnCrashes: number;
}

interface BossRecord {
  type: string;
  start: number;
  end: number | null;
  shots: number;
  pilot: PilotStats;
  maxHealth: number;
  damage: number;
  hits: number;
  deaths: number;
  crashes: number;
  forced: boolean;
  sources: Record<string, number>;
  respawnCrashes: number;
  /** Boss 登场时玩家的最大生命与护甲减伤（Boss 模式的机库购买在关卡档案建档之后） */
  playerMaxHealth: number;
  playerArmor: number;
  /**
   * Boss 导弹：发射数 / 被热焰弹诱骗数 / 诱骗后又重新追踪玩家的数目（诱饵燃尽前没飞到）/
   * 命中玩家次数；本场投放热焰弹次数
   */
  missiles: number;
  decoyed: number;
  reacquired: number;
  missileHits: number;
  flares: number;
  endReason?: string;
  healthAtEnd?: number;
}

interface HangarRecord {
  /** 即将进行的关卡 */
  level: number;
  pointsBefore: number;
  /** 本章所有升级线买到上限还需的点数 */
  capCost: number;
  /** pointsBudget = 'campaign' 时补发的点数 */
  bonus: number;
  spent: number;
  pointsAfter: number;
  purchases: Record<string, number>;
}

interface LevelRecord {
  level: number;
  start: number;
  wavesEnd: number | null;
  end: number | null;
  scoreStart: number;
  scoreAtBoss: number | null;
  scoreEnd: number | null;
  pointsStart: number;
  maxHealth: number;
  armor: number;
  upgrades: Record<string, number>;
  waves: WaveRecord[];
  boss: BossRecord | null;
  kills: number;
  firstDeathAt: number | null;
}

interface RunState {
  options: Required<BalanceRunOptions>;
  startedAt: number;
  done: boolean;
  reason: string;
  levels: LevelRecord[];
  hangars: HangarRecord[];
  totalDamage: number;
  totalDeaths: number;
  passiveSurvival: number | null;
  /** 连续坠毁后被测量框架抬升到安全高度的次数（只为让测量继续，单独报告） */
  rescues: number;
}

const DEFAULT_OPTIONS: Required<BalanceRunOptions> = {
  pilot: 'scripted',
  timeScale: 6,
  stopAfterLevel: 10,
  passiveMaxSeconds: 150,
  purchases: 'greedy',
  keepLives: 3,
  waveTimeoutSeconds: 360,
  bossTimeoutSeconds: 600,
  aimErrorDeg: 1.2,
  traceInterval: 0,
  pointsBudget: 'none',
  rescueCrashes: true,
};

/** 同价时的购买优先级（越靠前越先买）：生存 → 火力 → 导弹 → 机动 */
const PURCHASE_PRIORITY: readonly UpgradeType[] = [
  UpgradeType.MAX_HEALTH,
  UpgradeType.ARMOR,
  UpgradeType.DAMAGE,
  UpgradeType.FIRE_RATE,
  UpgradeType.WEAPON_SWARM,
  UpgradeType.WEAPON_RAILGUN,
  UpgradeType.WEAPON_LASER,
  UpgradeType.WEAPON_ROCKETS,
  UpgradeType.FLARES,
  UpgradeType.MISSILE_RELOAD_TIME,
  UpgradeType.MISSILE_LOCK_TIME,
  UpgradeType.SPEED,
  UpgradeType.MISSILE_LOCK_RADIUS,
  UpgradeType.WEAPON_EMP,
];

/** 飞行员偏好的特殊武器：最新解锁的伤害型武器（EMP 是辅助武器，不作为主武器） */
const PREFERRED_WEAPONS: readonly SpecialWeaponId[] = ['railgun', 'swarm', 'laser', 'rockets'];

interface TrackedPosition {
  x: number;
  y: number;
  z: number;
  t: number;
  vx: number;
  vy: number;
  vz: number;
}

/** 敌方子弹记录（ENEMY_FIRED），用于把玩家受到的伤害归因到开火者类型 */
interface ShotRecord {
  t: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  /** 弹速（米/秒）与最长存活时间（秒）：高炮弹 / 长枪弹与普通子弹不同 */
  speed: number;
  maxAge: number;
  label: string;
  used: boolean;
}

const SHOT_BUFFER_SIZE = 800;
const SHOT_MAX_AGE = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE / GAME_CONSTANTS.PROJECTILE.SPEED + 0.5;
/** 死因归因窗口（秒）与 deathLog 条数上限 */
const DEATH_WINDOW = 10;
const DEATH_LOG_LIMIT = 120;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function snapshotUpgrades(upgrades: PlayerUpgrades): Record<string, number> {
  const result: Record<string, number> = {};
  for (const type of Object.values(UpgradeType)) {
    const level = upgrades.getLevel(type);
    if (level > 0) result[type] = level;
  }
  return result;
}

/** 当前章节所有升级线（含已解锁武器）买到上限还需的点数 */
function costToCaps(upgrades: PlayerUpgrades): number {
  let total = 0;
  const campaignLevel = upgrades.getCampaignLevel();
  for (const type of Object.values(UpgradeType)) {
    if (upgrades.isLocked(type)) continue;
    const config = UPGRADE_CONFIGS[type];
    const cap = Math.min(config.maxLevel, getUpgradeCapForLevel(type, campaignLevel));
    for (let tier = upgrades.getLevel(type); tier < cap; tier++) {
      total += config.costs[tier];
    }
  }
  return total;
}

function dispatchKey(code: string, type: 'keydown' | 'keyup'): void {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}

function tapKey(code: string): void {
  dispatchKey(code, 'keydown');
  dispatchKey(code, 'keyup');
}

export interface BalanceHarnessApi {
  start(options?: BalanceRunOptions): boolean;
  stop(reason?: string): void;
  report(): Record<string, unknown>;
  isDone(): boolean;
}

export function installBalanceHarness(access: DevHookAccess): BalanceHarnessApi {
  let run: RunState | null = null;
  let pilot: ScriptedPilot | null = null;
  let gameTime = 0;
  let pollTimer = 0;
  let patched = false;
  let hangarHandled = false;
  let lastLevelSeen = 0;
  let pendingWeaponSelect = false;
  let lastHitDamage = 0;
  let lastHitTime = -1e9;
  let lastRespawnTime = -1e9;
  const recentCrashes: number[] = [];
  /** 最近的坠毁现场（排查地形 / 复活问题） */
  const crashLog: Array<Record<string, unknown>> = [];
  /** 最近的复活位姿 */
  const respawnLog: Array<Record<string, unknown>> = [];
  /** 最近 DEATH_WINDOW 秒内的受击（按来源归因），阵亡时汇总成 deathLog */
  const recentHits: Array<{ t: number; source: string; damage: number }> = [];
  /** 每次阵亡的死因：阵亡前 DEATH_WINDOW 秒内伤害最高的来源 */
  const deathLog: Array<Record<string, unknown>> = [];
  let rescuePending = false;
  let bossActive = false;
  /** 已建档的 Boss 对象（死亡演出期间仍是 currentBoss，避免重复建档） */
  let trackedBoss: unknown = null;
  /** 正在记录的 Boss 所属关卡档案（关卡号可能在死亡演出期间先跳到下一关） */
  let bossRecord: LevelRecord | null = null;
  const trace: Array<Record<string, unknown>> = [];
  let nextTraceAt = 0;
  const shots: ShotRecord[] = [];
  let shotCursor = 0;
  const shotPosition = new THREE.Vector3();

  const positions = new Map<THREE.Object3D, TrackedPosition>();
  const targets: PilotTarget[] = [];
  const targetPool: PilotTarget[] = [];
  const lockBuffer: THREE.Object3D[] = [];
  const missileSet = new Set<THREE.Object3D>();

  const world: PilotWorld = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    speed: 0,
    targets,
    groundY: (x, z) => {
      const levelManager = access.getEnemySystem()?.getLevelManager();
      return levelManager ? levelManager.getCrashSurfaceY(x, z) : -48;
    },
    incomingMissileDistance: Infinity,
    special: { mode: null, ready: false, charge: 0, overheated: false, range: 0 },
    flareCharges: 0,
    secondsSinceHit: Infinity,
    secondsSinceRespawn: Infinity,
    bossSpeed: 0,
  };
  const bossBodyPosition = new THREE.Vector3();
  const bossBodyVelocity = new THREE.Vector3();

  /** 开火者标签：敌机按机型，单位按单位类型 */
  const labelShooter = (owner: THREE.Object3D | undefined): string => {
    if (!owner) return 'other';
    for (const enemy of access.getEnemySystem()?.getEnemies() ?? []) {
      if (enemy.getMesh() === owner) return `jet:${enemy.getConfig().type}`;
    }
    const unit = access.getUnits().getSystem()?.findByMesh(owner) ?? null;
    if (unit) return `unit:${unit.type}`;
    return 'other';
  };

  const recordShot = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    owner: THREE.Object3D | undefined,
    weapon: EnemyWeaponKind | undefined,
    speed: number | undefined
  ): void => {
    let shot = shots[shotCursor];
    if (!shot) {
      shot = {
        t: 0,
        origin: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        damage: 0,
        speed: GAME_CONSTANTS.PROJECTILE.SPEED,
        maxAge: SHOT_MAX_AGE,
        label: '',
        used: false,
      };
      shots[shotCursor] = shot;
    }
    shotCursor = (shotCursor + 1) % SHOT_BUFFER_SIZE;
    shot.t = gameTime;
    shot.origin.copy(origin);
    shot.direction.copy(direction).normalize();
    shot.damage = damage;
    // 弹种自带弹速 / 射程；旧载荷（没有弹种）按普通子弹算
    const spec = isEnemyWeaponKind(weapon) ? ENEMY_WEAPON_SPECS[weapon] : null;
    shot.speed =
      typeof speed === 'number' && speed > 0
        ? speed
        : (spec?.speed ?? GAME_CONSTANTS.PROJECTILE.SPEED);
    shot.maxAge = spec ? spec.maxDistance / shot.speed + 0.5 : SHOT_MAX_AGE;
    shot.label = labelShooter(owner);
    shot.used = false;
  };

  /** 单位的非子弹伤害（SAM / 自杀无人机 / 炸弹）：包一层 onPlayerDamaged 记下原因 */
  let pendingUnitCause: string | null = null;
  let wrappedUnitSystem: unknown = null;
  const wrapUnitDamage = (): void => {
    const system = access.getUnits().getSystem();
    if (!system || system === wrappedUnitSystem) return;
    wrappedUnitSystem = system;
    const original = system.onPlayerDamaged;
    system.onPlayerDamaged = (damage, cause, position) => {
      pendingUnitCause = cause;
      try {
        original?.(damage, cause, position);
      } finally {
        pendingUnitCause = null;
      }
    };
  };

  /**
   * Boss 战里没有对上子弹的伤害：特殊武器（危险区计数上涨）/ Boss 导弹 / 高炮 / 章鱼的激光与
   * 眼睛光弹 / 机炮按伤害值归类。都按当前 Boss 配置（随难度调整）的伤害匹配：导弹 missileDamage，
   * 第 2、4 关高炮与第 3 关激光 damage，第 3 关光弹 eyeDamage；导弹旧版固定值一并识别。
   */
  let lastHazardCount = 0;
  const attributeBossHit = (damage: number, armor: number): string => {
    const controller = access.getBossController();
    const hazards = controller?.getHazardHitCount() ?? 0;
    const hazard = hazards > lastHazardCount;
    lastHazardCount = hazards;
    if (hazard) return 'boss-hazard';
    const matches = (base: number): boolean => Math.abs(base * (1 - armor) - damage) < 0.6;
    const config = controller?.getCurrentBoss()?.getConfig() ?? null;
    const missileDamage = config?.missileDamage ?? 0;
    if ((missileDamage > 0 && matches(missileDamage)) || matches(BOSS_MISSILE_CONFIG.DAMAGE)) {
      return 'boss-missile';
    }
    const type = config?.type ?? null;
    if (type === BossType.DESERT_FORTRESS || type === BossType.MISSILE_DESTROYER) {
      if (config && matches(config.damage)) return 'boss-flak';
    } else if (type === BossType.OCTOPUS_WARSHIP && config) {
      if (config.eyeDamage !== undefined && matches(config.eyeDamage)) return 'boss-eye';
      if (matches(config.damage)) return 'boss-laser';
    }
    return 'boss-gun/other';
  };

  /** 找出最可能命中玩家的那颗子弹（伤害吻合、预测位置最近） */
  const attributeHit = (damage: number): string => {
    if (pendingUnitCause) return `unit-${pendingUnitCause}`;
    const armor = access.getStats().getArmorReduction();
    const player = access.getPlayerAircraft().position;
    let best: ShotRecord | null = null;
    let bestDistance = 18;
    for (const shot of shots) {
      if (!shot || shot.used) continue;
      const age = gameTime - shot.t;
      if (age < 0 || age > shot.maxAge) continue;
      if (Math.abs(shot.damage * (1 - armor) - damage) > 0.6) continue;
      shotPosition.copy(shot.origin).addScaledVector(shot.direction, shot.speed * age);
      const distance = shotPosition.distanceTo(player);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = shot;
      }
    }
    if (!best)
      return access.getSession().isInBossBattle() ? attributeBossHit(damage, armor) : 'other';
    best.used = true;
    return best.label;
  };

  const currentLevelRecord = (): LevelRecord | null => {
    if (!run) return null;
    const level = access.getSession().getLevel();
    for (let i = run.levels.length - 1; i >= 0; i--) {
      if (run.levels[i].level === level) return run.levels[i];
    }
    return null;
  };

  const currentWaveRecord = (): WaveRecord | null => {
    const record = currentLevelRecord();
    if (!record || record.waves.length === 0) return null;
    const wave = record.waves[record.waves.length - 1];
    return wave.end === null ? wave : null;
  };

  const ensureLevelRecord = (level: number): LevelRecord => {
    const state = run as RunState;
    const existing = state.levels.find((entry) => entry.level === level);
    if (existing) return existing;
    const stats = access.getStats();
    const upgrades = stats.getUpgrades();
    const record: LevelRecord = {
      level,
      start: gameTime,
      wavesEnd: null,
      end: null,
      scoreStart: access.getScore(),
      scoreAtBoss: null,
      scoreEnd: null,
      pointsStart: upgrades.getAvailablePoints(),
      maxHealth: stats.getMaxHealth(),
      armor: stats.getArmorReduction(),
      upgrades: snapshotUpgrades(upgrades),
      waves: [],
      boss: null,
      kills: 0,
      firstDeathAt: null,
    };
    state.levels.push(record);
    return record;
  };

  // ───────────────────────────── 事件 ─────────────────────────────

  EventBus.on(GameEventType.WAVE_START, ({ payload }) => {
    if (!run || run.done) return;
    const record = ensureLevelRecord(payload.level);
    if (record.waves.length === 0) {
      // 第一波开始时刷新关卡起点（机库购买之后的机体状态）
      const stats = access.getStats();
      const upgrades = stats.getUpgrades();
      record.start = gameTime;
      record.scoreStart = access.getScore();
      record.pointsStart = upgrades.getAvailablePoints();
      record.maxHealth = stats.getMaxHealth();
      record.armor = stats.getArmorReduction();
      record.upgrades = snapshotUpgrades(upgrades);
    }
    pilot?.takeStats();
    record.waves.push({
      wave: payload.wave,
      start: gameTime,
      end: null,
      jetsClearedAt: null,
      shots: 0,
      pilot: createPilotStats(),
      damage: 0,
      hits: 0,
      deaths: 0,
      crashes: 0,
      forced: false,
      sources: {},
      respawnCrashes: 0,
    });
  });

  EventBus.on(GameEventType.WAVE_COMPLETE, () => {
    const wave = currentWaveRecord();
    if (wave) {
      wave.end = gameTime;
      if (pilot) wave.pilot = pilot.takeStats();
    }
  });

  EventBus.on(GameEventType.PLAYER_FIRED, () => {
    if (!run || run.done) return;
    const record = currentLevelRecord();
    if (record?.boss && record.boss.end === null) {
      record.boss.shots++;
      return;
    }
    const wave = currentWaveRecord();
    if (wave) wave.shots++;
  });

  EventBus.on(GameEventType.LEVEL_COMPLETE, ({ payload }) => {
    if (!run || run.done) return;
    const record = run.levels.find((entry) => entry.level === payload.level);
    if (record) {
      record.wavesEnd = gameTime;
      record.scoreAtBoss = access.getScore();
    }
  });

  EventBus.on(GameEventType.ENEMY_DEATH, () => {
    const record = currentLevelRecord();
    if (record) record.kills++;
  });

  EventBus.on(GameEventType.ENEMY_FIRED, ({ payload }) => {
    if (!run || run.done || payload.faction !== Faction.ENEMY) return;
    recordShot(
      payload.position,
      payload.direction,
      payload.damage,
      payload.owner,
      payload.weapon,
      payload.speed
    );
  });

  EventBus.on(GameEventType.PLAYER_HIT, ({ payload }) => {
    if (!run || run.done) return;
    const damage = Number.isFinite(payload.damage) ? payload.damage : 0;
    lastHitDamage = damage;
    if (damage >= 1000) return; // 坠地：单独按 crash 统计
    lastHitTime = gameTime;
    run.totalDamage += damage;
    const source = attributeHit(damage);
    recentHits.push({ t: gameTime, source, damage });
    while (recentHits.length > 0 && gameTime - recentHits[0].t > DEATH_WINDOW) recentHits.shift();
    const record = currentLevelRecord();
    if (record?.boss && record.boss.end === null) {
      record.boss.damage += damage;
      record.boss.hits++;
      if (source === 'boss-missile') record.boss.missileHits++;
      record.boss.sources[source] = (record.boss.sources[source] ?? 0) + damage;
      return;
    }
    const wave = currentWaveRecord();
    if (wave) {
      wave.damage += damage;
      wave.hits++;
      wave.sources[source] = (wave.sources[source] ?? 0) + damage;
    }
  });

  EventBus.on(GameEventType.PLAYER_RESPAWN, () => {
    lastRespawnTime = gameTime;
    if (rescuePending) {
      rescuePending = false;
      rescuePlayer();
    }
    // 复活位姿（排查“复活即坠毁”循环）：位置、地表、机头方向
    if (run && !run.done && respawnLog.length < 60) {
      const player = access.getPlayerAircraft();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
      respawnLog.push({
        t: round1(gameTime),
        level: access.getSession().getLevel(),
        pos: [
          Math.round(player.position.x),
          Math.round(player.position.y),
          Math.round(player.position.z),
        ],
        ground: Math.round(world.groundY(player.position.x, player.position.z)),
        forward: [round1(forward.x), round1(forward.y), round1(forward.z)],
        rescued: run.rescues,
      });
    }
  });

  EventBus.on(GameEventType.PLAYER_DEATH, () => {
    if (!run || run.done) return;
    run.totalDeaths++;
    // 坠地：1000 点撞地伤害（护盾期间不发 PLAYER_HIT，所以同时看是否已贴到坠毁面）
    const deathPosition = access.getPlayerAircraft().position;
    const crash =
      lastHitDamage >= 1000 ||
      deathPosition.y <= world.groundY(deathPosition.x, deathPosition.z) + 0.5;
    const respawnCrash = crash && gameTime - lastRespawnTime < 4;
    const record = currentLevelRecord();
    if (deathLog.length < DEATH_LOG_LIMIT) {
      const bySource = new Map<string, number>();
      for (const hit of recentHits) {
        if (gameTime - hit.t <= DEATH_WINDOW) {
          bySource.set(hit.source, (bySource.get(hit.source) ?? 0) + hit.damage);
        }
      }
      const top = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      deathLog.push({
        t: round1(gameTime),
        level: access.getSession().getLevel(),
        phase: record?.boss && record.boss.end === null ? 'boss' : `w${record?.waves.length ?? 0}`,
        crash,
        sources: top.map(([source, damage]) => `${source} ${Math.round(damage)}`).join(', '),
      });
    }
    recentHits.length = 0;
    if (record) {
      if (record.firstDeathAt === null) record.firstDeathAt = gameTime - record.start;
      if (record.boss && record.boss.end === null) {
        record.boss.deaths++;
        if (crash) record.boss.crashes++;
        if (respawnCrash) record.boss.respawnCrashes++;
      } else {
        const wave = currentWaveRecord();
        if (wave) {
          wave.deaths++;
          if (crash) wave.crashes++;
          if (respawnCrash) wave.respawnCrashes++;
        }
      }
    }
    if (crash) {
      const player = access.getPlayerAircraft();
      const forwardY = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).y;
      if (crashLog.length < 40) {
        crashLog.push({
          t: round1(gameTime),
          level: access.getSession().getLevel(),
          boss: access.getSession().isInBossBattle(),
          pos: [
            Math.round(player.position.x),
            Math.round(player.position.y),
            Math.round(player.position.z),
          ],
          ground: Math.round(world.groundY(player.position.x, player.position.z)),
          forwardY: Math.round(forwardY * 100) / 100,
          sinceRespawn: round1(gameTime - lastRespawnTime),
          target: pilot?.lastAim.kind ?? null,
          targetDistance: Math.round(pilot?.lastAim.distance ?? 0),
        });
      }
      recentCrashes.push(gameTime);
      while (recentCrashes.length > 0 && gameTime - recentCrashes[0] > 20) recentCrashes.shift();
      // 坠毁后下次复活抬到安全高度：复活点常贴着岩壁 / 立柱（审计 B1，由 PlayerSystem 修复），
      // 不抬的话会“复活即坠毁”连环阵亡，把平衡数据（阵亡 / 伤害）搅乱（rescueCrashes=false 时照实复活）
      if (crash && run.options.rescueCrashes) {
        rescuePending = true;
        recentCrashes.length = 0;
      }
    }
    if (run.options.pilot === 'passive' && record) {
      run.passiveSurvival = round1(gameTime - record.start);
      finish(crash ? 'passive pilot crashed' : 'passive pilot shot down');
      return;
    }
    // 保底生命：阵亡不结束整轮测量（GameCoordinator 已在本事件里判定过 game over）
    const playerSystem = access.getPlayerSystem();
    if (run.options.keepLives > 0 && playerSystem.getLives() < run.options.keepLives) {
      playerSystem.setLives(run.options.keepLives);
    }
  });

  // ───────────────────────────── 每步钩子 ─────────────────────────────

  /** trace 用：Boss 距离 / 血量 / 是否无敌 / 状态提示（无 Boss 时 undefined） */
  const describeBoss = (position: THREE.Vector3): Record<string, unknown> | undefined => {
    const controller = access.getBossController();
    const boss = controller?.getCurrentBoss() ?? null;
    if (!boss || !access.getSession().isInBossBattle()) return undefined;
    const advanced = isAdvancedBoss(boss) ? boss : null;
    return {
      d: Math.round(boss.getMesh().position.distanceTo(position)),
      hp: Math.round(boss.getHealth().current),
      inv: advanced?.isInvulnerable() ?? false,
      hidden: controller?.isBossHiddenFromSensors() ?? false,
      st: advanced?.getStatusLabel() ?? null,
    };
  };

  const installPatches = (): void => {
    if (patched) return;
    patched = true;
    const playerSystem = access.getPlayerSystem();
    const originalUpdate = playerSystem.update.bind(playerSystem);
    playerSystem.update = (deltaTime: number): void => {
      if (run && !run.done) onStep(deltaTime);
      originalUpdate(deltaTime);
    };
    const controller = playerSystem.getController();
    const originalControllerUpdate = controller.update.bind(controller);
    controller.update = (deltaTime: number, input: InputState): void => {
      if (run && !run.done && pilot) {
        collectWorld();
        const decision = pilot.decide(deltaTime, world, input);
        if (decision.deployFlare) {
          tapKey('KeyG');
          const fight = bossRecord?.boss;
          if (bossActive && fight && fight.end === null) fight.flares++;
        }
        if (run.options.traceInterval > 0 && gameTime >= nextTraceAt && trace.length < 4000) {
          nextTraceAt = gameTime + run.options.traceInterval;
          const position = world.position;
          trace.push({
            t: round1(gameTime),
            L: access.getSession().getLevel(),
            boss: access.getSession().isInBossBattle(),
            pos: [Math.round(position.x), Math.round(position.y), Math.round(position.z)],
            agl: Math.round(position.y - world.groundY(position.x, position.z)),
            kind: pilot.lastAim.kind,
            dist: Math.round(pilot.lastAim.distance),
            aim: round1(pilot.lastAim.aimDeg),
            cone: round1(pilot.lastAim.coneDeg),
            fire: input.fire,
            keys: `${input.yawLeft ? 'L' : ''}${input.yawRight ? 'R' : ''}${input.pitchUp ? 'U' : ''}${input.pitchDown ? 'D' : ''}`,
            targets: targets.length,
            hp: Math.round(access.getPlayerSystem().getHealth().getCurrentHealth()),
            bossInfo: describeBoss(position),
          });
        }
      }
      originalControllerUpdate(deltaTime, input);
    };
  };

  /** 本场 Boss 战见过的导弹 / 被热焰弹诱骗过的 / 诱骗后又回头追玩家的（各计一次） */
  let seenMissiles = new WeakSet<object>();
  let decoyedMissiles = new WeakSet<object>();
  let reacquiredMissiles = new WeakSet<object>();
  const trackBossMissiles = (): void => {
    const fight = bossRecord?.boss;
    if (!bossActive || !fight || fight.end !== null) return;
    const missileSystem = access.getBossController()?.getCurrentBoss()?.getMissileSystem() ?? null;
    if (!missileSystem) return;
    for (const missile of missileSystem.getMissiles()) {
      if (!seenMissiles.has(missile)) {
        seenMissiles.add(missile);
        fight.missiles++;
      }
      if (missile.target?.name === BOSS_DECOY_ANCHOR_NAME && !decoyedMissiles.has(missile)) {
        decoyedMissiles.add(missile);
        fight.decoyed++;
      } else if (
        missile.isTargetingPlayer &&
        decoyedMissiles.has(missile) &&
        !reacquiredMissiles.has(missile)
      ) {
        reacquiredMissiles.add(missile);
        fight.reacquired++;
      }
    }
  };

  const onStep = (deltaTime: number): void => {
    const state = run as RunState;
    gameTime += deltaTime;
    wrapUnitDamage();
    const session = access.getSession();
    const level = session.getLevel();
    if (level !== lastLevelSeen) {
      lastLevelSeen = level;
      pendingWeaponSelect = true;
    }
    if (pendingWeaponSelect) selectPreferredWeapon();

    const record = currentLevelRecord();
    trackBoss(record);
    trackBossMissiles();

    // 卡关保护：单波 / Boss 超时强制推进并标记
    const wave = currentWaveRecord();
    if (wave && wave.jetsClearedAt === null) {
      if (access.getEnemySystem()?.getLevelManager().areWaveJetsCleared()) {
        wave.jetsClearedAt = gameTime;
      }
    }
    if (wave && !bossActive && gameTime - wave.start > state.options.waveTimeoutSeconds) {
      wave.forced = true;
      forceClearWave();
    }
    const timedBoss = bossRecord?.boss ?? record?.boss;
    if (timedBoss && timedBoss.end === null) {
      if (gameTime - timedBoss.start > state.options.bossTimeoutSeconds) {
        timedBoss.forced = true;
        forceKillBoss();
      }
    }
    if (state.options.pilot === 'passive' && record && record.waves.length > 0) {
      if (gameTime - record.start > state.options.passiveMaxSeconds) {
        state.passiveSurvival = round1(gameTime - record.start);
        finish('passive pilot survived the cap');
      }
    }
  };

  const trackBoss = (levelRecord: LevelRecord | null): void => {
    const controller = access.getBossController();
    const boss = controller?.getCurrentBoss() ?? null;
    const active = Boolean(boss && access.getSession().isInBossBattle());
    // 只为“新出现且存活”的 Boss 建档：死亡演出期间 Boss 仍挂在控制器上，不能重复建档覆盖
    const fresh =
      active &&
      boss !== null &&
      boss !== trackedBoss &&
      boss.isAlive() &&
      !(controller?.isBossDying() ?? false);
    // Boss 模式没有波次（不触发 WAVE_START）：Boss 登场时补建本关档案
    const record =
      levelRecord ??
      (fresh && run && !bossActive ? ensureLevelRecord(access.getSession().getLevel()) : null);
    if (fresh && boss && record && !bossActive) {
      trackedBoss = boss;
      bossActive = true;
      bossRecord = record;
      lastHazardCount = controller?.getHazardHitCount() ?? 0;
      seenMissiles = new WeakSet<object>();
      decoyedMissiles = new WeakSet<object>();
      reacquiredMissiles = new WeakSet<object>();
      const health = boss.getHealth();
      const stats = access.getStats();
      pilot?.takeStats();
      record.boss = {
        type: boss.getConfig().type,
        start: gameTime,
        end: null,
        shots: 0,
        pilot: createPilotStats(),
        maxHealth: Math.round(health.max),
        damage: 0,
        hits: 0,
        deaths: 0,
        crashes: 0,
        forced: false,
        sources: {},
        respawnCrashes: 0,
        playerMaxHealth: stats.getMaxHealth(),
        playerArmor: stats.getArmorReduction(),
        missiles: 0,
        decoyed: 0,
        reacquired: 0,
        missileHits: 0,
        flares: 0,
      };
    }
    const tracked = bossRecord;
    if (bossActive && tracked?.boss && tracked.boss.end === null) {
      const dying = controller?.isBossDying() ?? false;
      // 已换成下一只 Boss（Boss 模式连战）也算本只结束
      const replaced = boss !== null && boss !== trackedBoss;
      if (!boss || replaced || !boss.isAlive() || dying) {
        tracked.boss.endReason = !boss || replaced ? 'gone' : dying ? 'dying' : 'dead';
        tracked.boss.healthAtEnd = boss && !replaced ? Math.round(boss.getHealth().current) : -1;
        tracked.boss.end = gameTime;
        if (pilot) tracked.boss.pilot = pilot.takeStats();
        tracked.end = gameTime;
        tracked.scoreEnd = access.getScore();
        bossActive = false;
        bossRecord = null;
        if (run && tracked.level >= run.options.stopAfterLevel) {
          finish(`boss of level ${tracked.level} defeated`);
        }
      }
    } else if (bossActive && !boss) {
      bossActive = false;
      bossRecord = null;
    }
  };

  const rescuePlayer = (): void => {
    if (!run) return;
    run.rescues++;
    const player = access.getPlayerAircraft();
    // 在周围 3 圈 × 8 个点里找地表最低（远离立柱 / 岩壁）的位置，抬到其上方 120 米（不超过软顶界）
    const ceiling = GAME_CONSTANTS.WORLD.SOFT_CEILING - 40;
    let bestX = player.position.x;
    let bestZ = player.position.z;
    let bestGround = world.groundY(bestX, bestZ);
    for (let ring = 1; ring <= 3; ring++) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = player.position.x + Math.cos(angle) * ring * 120;
        const z = player.position.z + Math.sin(angle) * ring * 120;
        const ground = world.groundY(x, z);
        if (Number.isFinite(ground) && (!Number.isFinite(bestGround) || ground < bestGround)) {
          bestGround = ground;
          bestX = x;
          bestZ = z;
        }
      }
    }
    const y = Math.min(ceiling, (Number.isFinite(bestGround) ? bestGround : 0) + 120);
    access.getPlayerSystem().placeAt(new THREE.Vector3(bestX, y, bestZ), player.quaternion.clone());
    access.onPlayerTeleported();
  };

  const forceClearWave = (): void => {
    for (const enemy of access.getEnemySystem()?.getEnemies() ?? []) {
      if (enemy.isAlive()) enemy.takeDamage(1e9);
    }
    for (const unit of access.getUnits().getSystem()?.getUnits() ?? []) {
      if (unit.faction === Faction.ENEMY && unit.isAlive()) unit.applyDamage(1e9, 'cannon');
    }
  };

  const forceKillBoss = (): void => {
    const boss = access.getBossController()?.getCurrentBoss() ?? null;
    if (!boss || !boss.isAlive()) return;
    if (isAdvancedBoss(boss)) {
      for (const part of [...boss.getCollisionParts()]) boss.takeDamageAt(part, 1e5);
    } else {
      boss.takeDamage(1e6);
    }
  };

  const selectPreferredWeapon = (): void => {
    const unlocked = access.getWeapons().getUnlocked();
    if (unlocked.length === 0) {
      pendingWeaponSelect = false;
      return;
    }
    const preferred = PREFERRED_WEAPONS.find((id) => unlocked.includes(id)) ?? unlocked[0];
    if (access.getWeapons().getSelected() !== preferred) {
      const slot = SPECIAL_WEAPON_IDS.indexOf(preferred);
      if (slot >= 0) tapKey(`Digit${slot + 1}`);
    }
    pendingWeaponSelect = false;
  };

  // ───────────────────────────── 世界快照（每步） ─────────────────────────────

  const acquireTarget = (): PilotTarget => {
    const index = targets.length;
    let target = targetPool[index];
    if (!target) {
      target = {
        object: new THREE.Object3D(),
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        kind: 'jet',
        radius: 5,
        weight: 1,
      };
      targetPool[index] = target;
    }
    targets.push(target);
    return target;
  };

  /** 以位置差分估计速度（每个对象一条记录） */
  const estimateVelocity = (
    object: THREE.Object3D,
    position: THREE.Vector3,
    out: THREE.Vector3
  ) => {
    const tracked = positions.get(object);
    if (tracked && gameTime - tracked.t > 1e-4 && gameTime - tracked.t < 1) {
      const dt = gameTime - tracked.t;
      tracked.vx = (position.x - tracked.x) / dt;
      tracked.vy = (position.y - tracked.y) / dt;
      tracked.vz = (position.z - tracked.z) / dt;
      tracked.x = position.x;
      tracked.y = position.y;
      tracked.z = position.z;
      tracked.t = gameTime;
      out.set(tracked.vx, tracked.vy, tracked.vz);
      return;
    }
    if (tracked && gameTime - tracked.t <= 1e-4) {
      out.set(tracked.vx, tracked.vy, tracked.vz);
      return;
    }
    positions.set(object, {
      x: position.x,
      y: position.y,
      z: position.z,
      t: gameTime,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    out.set(0, 0, 0);
  };

  const collectWorld = (): void => {
    const player = access.getPlayerAircraft();
    const playerSystem = access.getPlayerSystem();
    world.position.copy(player.position);
    world.quaternion.copy(player.quaternion);
    world.speed = playerSystem.getSpeed();
    world.secondsSinceHit = gameTime - lastHitTime;
    world.secondsSinceRespawn = gameTime - lastRespawnTime;
    targets.length = 0;
    missileSet.clear();
    let nearestMissile = Infinity;

    const bossController = access.getBossController();
    const boss = bossController?.getCurrentBoss() ?? null;
    const inBoss = access.getSession().isInBossBattle() && boss !== null;

    // 敌机（含 Boss 召唤的僚机）
    for (const enemy of access.getEnemySystem()?.getEnemies() ?? []) {
      const mesh = enemy.getMesh();
      if (!enemy.isAlive() || !mesh.visible) continue;
      const target = acquireTarget();
      target.object = mesh;
      target.position.copy(mesh.position);
      target.velocity.copy(enemy.velocity);
      target.kind = 'jet';
      target.radius = getDeclaredHitRadius(mesh, 5);
      target.weight = inBoss ? 1.3 : 1;
    }

    // 地面 / 海上 / 空中单位
    const unitSystem = access.getUnits().getSystem();
    if (unitSystem) {
      for (const unit of unitSystem.getUnits()) {
        if (unit.faction !== Faction.ENEMY || !unit.isAlive() || !unit.isTargetable()) continue;
        const target = acquireTarget();
        target.object = unit.mesh;
        const aimPoint: unknown = unit.mesh.userData.aimPoint;
        if (aimPoint instanceof THREE.Object3D) aimPoint.getWorldPosition(target.position);
        else unit.getPosition(target.position);
        estimateVelocity(unit.mesh, target.position, target.velocity);
        target.kind =
          unit.domain === 'air' ? 'unit-air' : unit.domain === 'sea' ? 'unit-sea' : 'unit-ground';
        target.radius = Math.max(3, unit.config.hitRadius);
        target.weight = unit.domain === 'air' ? 1 : 1.25;
      }
      for (const missile of unitSystem.getIncomingMissiles()) {
        if (!missile.targetIsPlayer) continue;
        nearestMissile = Math.min(nearestMissile, missile.position.distanceTo(world.position));
      }
    }

    // Boss 可受伤部件（跳过护盾偏转体 / 隐形）；Boss 导弹只用于告警
    world.bossSpeed = 0;
    if (inBoss && boss && bossController) {
      boss.getMesh().getWorldPosition(bossBodyPosition);
      estimateVelocity(boss.getMesh(), bossBodyPosition, bossBodyVelocity);
      const bodySpeed = bossBodyVelocity.length();
      // 瞬移（章鱼）只产生单帧尖峰：超过任何飞行器速度的估计视为 0
      world.bossSpeed = Number.isFinite(bodySpeed) && bodySpeed < 250 ? bodySpeed : 0;
      const missileSystem = boss.getMissileSystem();
      if (missileSystem) {
        for (const mesh of missileSystem.getMissileMeshes()) {
          missileSet.add(mesh);
          nearestMissile = Math.min(nearestMissile, mesh.position.distanceTo(world.position));
        }
      }
      lockBuffer.length = 0;
      bossController.appendLockTargets(lockBuffer);
      const advanced = isAdvancedBoss(boss) ? boss : null;
      for (const part of lockBuffer) {
        if (missileSet.has(part) || part.userData.bossDecoy === true) continue;
        const target = acquireTarget();
        target.object = part;
        part.getWorldPosition(target.position);
        estimateVelocity(part, target.position, target.velocity);
        target.kind = 'boss';
        target.radius = Math.max(3, getDeclaredHitRadius(part, 5));
        const multiplier = advanced ? advanced.getDamageMultiplier(part) : 1;
        target.weight = 1 / Math.max(0.35, Math.min(2.5, multiplier));
      }
      if (lockBuffer.length === 0 && boss.isAlive() && !(advanced?.isInvulnerable() ?? false)) {
        // 没有可锁定部件（例如隐形）时按本体位置巡航接近
        const mesh = boss.getMesh();
        if (mesh.visible && !bossController.isBossHiddenFromSensors()) {
          const target = acquireTarget();
          target.object = mesh;
          mesh.getWorldPosition(target.position);
          estimateVelocity(mesh, target.position, target.velocity);
          target.kind = 'boss';
          target.radius = Math.max(5, getDeclaredHitRadius(mesh, 10));
          target.weight = 1;
        }
      }
    }
    world.incomingMissileDistance = nearestMissile;

    // 特殊武器状态
    const weapons = access.getWeapons();
    world.flareCharges = weapons.getFlareCharges();
    const system = (weapons as unknown as { weapons: WeaponSystem | null }).weapons;
    const special: PilotSpecialState = world.special;
    special.mode = null;
    if (system) {
      const hud = system.getHudState();
      if (hud.selected) {
        special.mode = hud.mode;
        special.ready = hud.ready;
        special.charge = hud.charge;
        special.overheated = hud.overheated;
        const stats = getSpecialWeaponStats(hud.selected, system.getUpgradeLevel(hud.selected));
        special.range = hud.mode === 'pulse' ? stats.radius : stats.range;
      }
    }

    // 位置记录过多时清掉过期的（死亡单位）
    if (positions.size > 400) {
      for (const [object, tracked] of positions) {
        if (gameTime - tracked.t > 5) positions.delete(object);
      }
    }
  };

  // ───────────────────────────── 轮询：剧情 / 机库 ─────────────────────────────

  const poll = (): void => {
    if (!run || run.done) return;
    const session = access.getSession();
    if (access.isStoryActive()) {
      tapKey('Escape');
      return;
    }
    if (access.getUpgradeMenuVisible() && access.isStoryHold()) {
      if (!hangarHandled) {
        hangarHandled = true;
        handleHangar();
        // 先让购买结果落定，再点“出击”
        window.setTimeout(() => {
          access.clickHangarContinue();
          hangarHandled = false;
        }, 50);
      }
      return;
    }
    if (!session.isPlaying()) {
      finish(access.getPlayerSystem().getLives() <= 0 ? 'game over' : 'session ended');
    }
  };

  const handleHangar = (): void => {
    const state = run as RunState;
    const upgrades = access.getStats().getUpgrades();
    const level = upgrades.getCampaignLevel();
    if (level > state.options.stopAfterLevel) {
      finish(`reached hangar for level ${level}`);
      return;
    }
    let bonus = 0;
    if (state.options.pointsBudget === 'campaign') {
      // 累计（已花 + 现有）补到该关的官方开局预算
      const spentSoFar = state.hangars.reduce((sum, hangar) => sum + hangar.spent, 0);
      bonus = Math.max(
        0,
        getStartingUpgradePoints(level) - spentSoFar - upgrades.getAvailablePoints()
      );
      if (bonus > 0) upgrades.awardBonusPoints(bonus);
    }
    const record: HangarRecord = {
      level,
      pointsBefore: upgrades.getAvailablePoints(),
      capCost: costToCaps(upgrades),
      bonus,
      spent: 0,
      pointsAfter: 0,
      purchases: {},
    };
    if (state.options.purchases === 'greedy') {
      for (let guard = 0; guard < 200; guard++) {
        let best: UpgradeType | null = null;
        let bestCost = Infinity;
        for (const type of PURCHASE_PRIORITY) {
          if (!upgrades.canUpgrade(type)) continue;
          const cost = upgrades.getUpgradeCost(type);
          if (cost < bestCost) {
            bestCost = cost;
            best = type;
          }
        }
        if (best === null) break;
        if (!upgrades.upgrade(best)) break;
        record.spent += bestCost;
        record.purchases[best] = (record.purchases[best] ?? 0) + 1;
      }
    }
    record.pointsAfter = upgrades.getAvailablePoints();
    state.hangars.push(record);
  };

  const finish = (reason: string): void => {
    if (!run || run.done) return;
    run.done = true;
    run.reason = reason;
    access.gameLoop.setTimeScale(1);
    setTimerScale(1);
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = 0;
    }
  };

  const setTimerScale = (scale: number): void => {
    (window as unknown as { __timerScale?: number }).__timerScale = scale;
  };

  // ───────────────────────────── 报告 ─────────────────────────────

  const roundSources = (sources: Record<string, number>): Record<string, number> =>
    Object.fromEntries(
      Object.entries(sources)
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => [key, Math.round(value)])
    );

  const summarizeLevel = (record: LevelRecord): Record<string, unknown> => {
    const roundStats = (stats: PilotStats): Record<string, unknown> => ({
      target: Object.fromEntries(
        Object.entries(stats.targetSeconds)
          .filter(([, value]) => value > 0.05)
          .map(([key, value]) => [key, round1(value)])
      ),
      fire: round1(stats.fireSeconds),
      missile: round1(stats.missileSeconds),
      special: stats.specialPresses,
      terrain: round1(stats.terrainSeconds),
      extend: round1(stats.extendSeconds),
      inRange: round1(stats.inRangeSeconds),
      onTarget: round1(stats.onTargetSeconds),
      jink: round1(stats.jinkSeconds),
    });
    const waves = record.waves.map((wave) => ({
      wave: wave.wave + 1,
      seconds: wave.end === null ? null : round1(wave.end - wave.start),
      jets: wave.jetsClearedAt === null ? null : round1(wave.jetsClearedAt - wave.start),
      shots: wave.shots,
      pilot: roundStats(wave.pilot),
      damage: Math.round(wave.damage),
      hits: wave.hits,
      deaths: wave.deaths,
      crashes: wave.crashes,
      forced: wave.forced || undefined,
      respawnCrashes: wave.respawnCrashes || undefined,
      sources: roundSources(wave.sources),
    }));
    let waveSeconds = 0;
    let waveDamage = 0;
    let waveDeaths = 0;
    let waveCrashes = 0;
    for (const wave of record.waves) {
      waveSeconds += (wave.end ?? gameTime) - wave.start;
      waveDamage += wave.damage;
      waveDeaths += wave.deaths;
      waveCrashes += wave.crashes;
    }
    const boss = record.boss;
    const bossSeconds = boss ? (boss.end ?? gameTime) - boss.start : 0;
    return {
      level: record.level,
      maxHealth: record.maxHealth,
      armor: record.armor,
      upgrades: record.upgrades,
      pointsStart: record.pointsStart,
      waveCount: record.waves.length,
      wavesSeconds: round1(waveSeconds),
      levelSeconds: record.wavesEnd === null ? null : round1(record.wavesEnd - record.start),
      waveDamage: Math.round(waveDamage),
      waveDamagePerMin: waveSeconds > 0 ? Math.round((waveDamage / waveSeconds) * 60) : 0,
      waveDamagePerMinPct:
        waveSeconds > 0 ? round1(((waveDamage / waveSeconds) * 60 * 100) / record.maxHealth) : 0,
      waveDeaths,
      waveCrashes,
      kills: record.kills,
      firstDeathAt: record.firstDeathAt === null ? null : round1(record.firstDeathAt),
      scoreStart: record.scoreStart,
      scoreAtBoss: record.scoreAtBoss,
      scoreEnd: record.scoreEnd,
      boss: boss
        ? {
            type: boss.type,
            maxHealth: boss.maxHealth,
            playerMaxHealth: boss.playerMaxHealth,
            playerArmor: boss.playerArmor,
            seconds: boss.end === null ? null : round1(bossSeconds),
            damage: Math.round(boss.damage),
            damagePerMin: bossSeconds > 0 ? Math.round((boss.damage / bossSeconds) * 60) : 0,
            deaths: boss.deaths,
            crashes: boss.crashes,
            shots: boss.shots,
            respawnCrashes: boss.respawnCrashes || undefined,
            missiles: boss.missiles,
            decoyed: boss.decoyed,
            reacquired: boss.reacquired,
            missileHits: boss.missileHits,
            flares: boss.flares,
            endReason: boss.endReason,
            healthAtEnd: boss.healthAtEnd,
            pilot: roundStats(boss.pilot),
            sources: roundSources(boss.sources),
            forced: boss.forced || undefined,
          }
        : null,
      waves,
    };
  };

  const report = (): Record<string, unknown> => {
    if (!run) return { running: false };
    const session = access.getSession();
    return {
      running: !run.done,
      done: run.done,
      reason: run.reason,
      options: run.options,
      difficulty: session.getDifficulty(),
      gameTime: round1(gameTime),
      wallSeconds: round1((performance.now() - run.startedAt) / 1000),
      level: session.getLevel(),
      wave: session.getWave(),
      inBoss: session.isInBossBattle(),
      score: access.getScore(),
      lives: access.getPlayerSystem().getLives(),
      totalDamage: Math.round(run.totalDamage),
      totalDeaths: run.totalDeaths,
      rescues: run.rescues,
      crashLog,
      respawnLog,
      deathLog,
      passiveSurvival: run.passiveSurvival,
      hangars: run.hangars,
      levels: run.levels.map(summarizeLevel),
      trace: run.options.traceInterval > 0 ? trace : undefined,
    };
  };

  return {
    start: (options: BalanceRunOptions = {}): boolean => {
      installPatches();
      const merged: Required<BalanceRunOptions> = { ...DEFAULT_OPTIONS, ...options };
      run = {
        options: merged,
        startedAt: performance.now(),
        done: false,
        reason: '',
        levels: [],
        hangars: [],
        totalDamage: 0,
        totalDeaths: 0,
        passiveSurvival: null,
        rescues: 0,
      };
      gameTime = 0;
      lastHitTime = -1e9;
      lastRespawnTime = -1e9;
      trackedBoss = null;
      bossRecord = null;
      recentCrashes.length = 0;
      crashLog.length = 0;
      respawnLog.length = 0;
      recentHits.length = 0;
      deathLog.length = 0;
      rescuePending = false;
      shots.length = 0;
      shotCursor = 0;
      trace.length = 0;
      nextTraceAt = 0;
      bossActive = false;
      lastLevelSeen = 0;
      hangarHandled = false;
      positions.clear();
      pilot = new ScriptedPilot(merged.pilot, { aimErrorDeg: merged.aimErrorDeg });
      const playerSystem = access.getPlayerSystem();
      if (merged.keepLives > 0 && playerSystem.getLives() < merged.keepLives) {
        playerSystem.setLives(merged.keepLives);
      }
      const scale = Math.max(1, Math.min(16, merged.timeScale));
      access.gameLoop.setTimeScale(scale);
      setTimerScale(scale);
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = window.setInterval(poll, 100);
      // 已在进行中的关卡（开局即第 1 关）也要建档
      const level = access.getSession().getLevel();
      if (level > 0) ensureLevelRecord(level);
      return true;
    },
    stop: (reason = 'stopped') => finish(reason),
    report,
    isDone: () => run?.done ?? false,
  };
}
