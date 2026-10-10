import * as THREE from 'three';
import { vi } from 'vitest';
import { getDifficultyProfile } from '@/core/Difficulty';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import type { EnemyType } from '@/features/enemy/EnemyTypes';
import { LevelManager, LevelState } from '@/features/levels/LevelManager';
import { LEVELS, LevelWaveEventType, type WaveArrival } from '@/features/terrain/LevelConfig';

/**
 * 波次测试台（敌机舰队 M3）：真实的 LevelManager 按固定步长推进——开波、按出场间隔开传送门、
 * 传送门结束时敌机现身（onEnemySpawned）、清场、两波之间的间隔、下一波。记录每一波现身的每一架
 * 敌机（机型、出生点、时刻）和开波时玩家的位置，供规格 §4a 的规则逐波检查。
 *
 * 地形在各测试文件里用 vi.mock 换成平坦海面（地表 y = 0）；随机数由测试用 seededGameRandom
 * 替换 Math.random。时间只来自步长累加，不读系统时钟。
 */

/** 一架现身的敌机 */
export interface WaveArrivalRecord {
  /** 本波第几架现身（0 起） */
  index: number;
  type: EnemyType;
  /** 现身位置（传送门位置） */
  position: THREE.Vector3;
  /** 现身时刻（测试台时钟，秒） */
  time: number;
  /** 现身时玩家的位置 */
  playerAt: THREE.Vector3;
  jet: EnemyAI;
}

/** 一波的记录 */
export interface WaveRecord {
  level: number;
  /** 波次（0 起） */
  wave: number;
  event: LevelWaveEventType | null;
  /** 开波时刻（测试台时钟，秒） */
  startedAt: number;
  /** 开波时玩家的位置 */
  playerAtStart: THREE.Vector3;
  /** 开波时 LevelManager 报告的各路群中心 */
  centers: Array<{ x: number; z: number }>;
  arrivals: WaveArrivalRecord[];
  /** 本波期间同时存活敌机数的最大值 */
  maxAlive: number;
  /** 本波期间 LevelManager 报告的同时在场上限的最小值 */
  concurrencyLimit: number;
  /** 本波结束（WAVE_COMPLETE）的时刻；没结束为 NaN */
  completedAt: number;
}

/**
 * 击毁策略：
 * - 'on-arrival'：每一步把现身的敌机全部击毁（波次只受出场节奏限制）；
 * - 'when-all-in'：本波编成全部现身、没有传送门之后才一起击毁（同时存活数最大）；
 * - 'none'：台架不击毁，由测试自己决定。
 */
export type KillPolicy = 'on-arrival' | 'when-all-in' | 'none';

export interface WaveRigOptions {
  /** 难度档 1..5（缺省 3 = 普通） */
  difficulty?: number;
  playerPosition?: THREE.Vector3;
  /** 玩家的速度（米/秒，水平直飞；缺省不动）：每一步先移动玩家，再推进 LevelManager */
  playerVelocity?: THREE.Vector3;
  /** 步长（秒，缺省 0.1） */
  dt?: number;
}

/** 传送门模块按需加载、敌机在传送门回调里现身：让挂起的加载与回调跑完 */
export async function settle(): Promise<void> {
  await vi.dynamicImportSettled();
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

export class WaveRig {
  public readonly scene = new THREE.Scene();
  public readonly levels: LevelManager;
  public readonly player: THREE.Vector3;
  public readonly playerVelocity: THREE.Vector3;
  public readonly dt: number;
  public readonly records: WaveRecord[] = [];
  public time = 0;
  /** 关卡结束（LEVEL_COMPLETE）的关卡号 */
  public readonly completedLevels: number[] = [];

  private current: WaveRecord | null = null;

  constructor(options: WaveRigOptions = {}) {
    this.levels = new LevelManager(this.scene);
    this.levels.setDifficultyProfile(getDifficultyProfile(options.difficulty ?? 3));
    this.player = (options.playerPosition ?? new THREE.Vector3(0, 300, 0)).clone();
    this.playerVelocity = (options.playerVelocity ?? new THREE.Vector3()).clone();
    this.dt = options.dt ?? 0.1;

    this.levels.onWaveStart = (wave) => {
      const config = this.levels.getCurrentLevelConfig();
      this.current = {
        level: config?.id ?? -1,
        wave,
        event: null,
        startedAt: this.time,
        playerAtStart: this.player.clone(),
        centers: this.levels.getWaveGroupCenters(),
        arrivals: [],
        maxAlive: 0,
        concurrencyLimit: this.levels.getMaxConcurrentEnemies(),
        completedAt: Number.NaN,
      };
      this.records.push(this.current);
    };
    this.levels.onWaveEventStart = (eventType, wave) => {
      if (this.current && this.current.wave === wave) this.current.event = eventType;
    };
    this.levels.onEnemySpawned = (jet) => {
      const record = this.current;
      if (!record) return;
      record.arrivals.push({
        index: record.arrivals.length,
        type: jet.getConfig().type,
        position: jet.getMesh().position.clone(),
        time: this.time,
        playerAt: this.player.clone(),
        jet,
      });
    };
    this.levels.onWaveComplete = (wave) => {
      if (this.current && this.current.wave === wave) this.current.completedAt = this.time;
    };
    this.levels.onLevelComplete = (level) => {
      this.completedLevels.push(level);
    };
  }

  /** 加载关卡，从第 startWave 波（0 起）开始——与读档续玩同一个入口 */
  public load(level: number, startWave = 0): void {
    this.levels.loadLevel(level, startWave);
  }

  /** 开第一波（之后的波次由 LevelManager 自己在间隔后开始） */
  public start(): void {
    this.levels.startWave(this.player);
  }

  /** 同时存活的敌机 */
  public alive(): EnemyAI[] {
    return this.levels.getEnemies().filter((jet) => jet.isAlive());
  }

  /**
   * 开波之前先飞一会儿（LevelManager 照常每步推进，与协调器开场的 START_DELAY 一样）：
   * 玩家在动时，LevelManager 在开波前就已经看到了它的航迹
   */
  public async preroll(seconds: number): Promise<void> {
    const steps = Math.round(seconds / this.dt);
    for (let i = 0; i < steps; i++) await this.step('on-arrival');
  }

  /** 推进一步：移动玩家 → LevelManager.update → 让传送门回调跑完 → 按策略击毁 */
  public async step(kill: KillPolicy): Promise<void> {
    this.player.addScaledVector(this.playerVelocity, this.dt);
    this.levels.update(this.dt, this.player);
    await settle();
    this.time += this.dt;
    const record = this.current;
    const alive = this.alive();
    if (record && this.levels.getState() === LevelState.WAVE_ACTIVE) {
      record.maxAlive = Math.max(record.maxAlive, alive.length);
      record.concurrencyLimit = Math.min(
        record.concurrencyLimit,
        this.levels.getMaxConcurrentEnemies()
      );
    }
    if (kill === 'on-arrival' || (kill === 'when-all-in' && this.allArrived())) {
      for (const jet of alive) jet.takeDamage(1e9);
    }
  }

  /** 本波编成是否已全部现身 */
  public allArrived(): boolean {
    const record = this.current;
    const lineup = this.levels.getCurrentWaveConfig()?.lineup;
    if (!record || !lineup) return false;
    return (
      record.arrivals.length >= lineup.length && this.levels.getActivePortalPositions().length === 0
    );
  }

  /**
   * 打完当前这一波（到 WAVE_COMPLETE 为止），返回它的记录。
   * maxSeconds 内没有结束时也返回（completedAt 为 NaN）。
   */
  public async playWave(kill: KillPolicy, maxSeconds = 240): Promise<WaveRecord> {
    const steps = Math.round(maxSeconds / this.dt);
    for (let i = 0; i < steps; i++) {
      await this.step(kill);
      if (this.current && !Number.isNaN(this.current.completedAt)) break;
    }
    if (!this.current) throw new Error('no wave started');
    return this.current;
  }

  /**
   * 从第 1 波打到关卡结束（两波之间的间隔照常走完），返回本关每一波的记录。
   */
  public async playLevel(
    level: number,
    kill: KillPolicy,
    maxSeconds = 1200
  ): Promise<WaveRecord[]> {
    const before = this.records.length;
    this.load(level, 0);
    this.start();
    const steps = Math.round(maxSeconds / this.dt);
    for (let i = 0; i < steps; i++) {
      await this.step(kill);
      if (this.completedLevels.includes(level)) break;
    }
    return this.records.slice(before);
  }

  public dispose(): void {
    this.levels.clear();
    this.levels.dispose(this.scene);
  }
}

/** 本关全部波次的到场方式（按 LevelConfig 写定的） */
export function arrivalsOf(level: number): WaveArrival[] {
  return (LEVELS.find((config) => config.id === level)?.waves ?? []).map((wave) => wave.arrival);
}

/** 方位角（度，0..360）：从 from 看 to，水平面内 */
export function bearingDeg(from: { x: number; z: number }, to: { x: number; z: number }): number {
  const deg = (Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** 两个方位角（度）之间的夹角（0..180） */
export function bearingGapDeg(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/** 水平距离 */
export function horizontalDistance(
  a: { x: number; z: number },
  b: { x: number; z: number }
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 机型 → 架数 */
export function countTypes(types: readonly EnemyType[]): Map<EnemyType, number> {
  const counts = new Map<EnemyType, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  return counts;
}

/** 把一串机型写成排序后的“机型×架数”文本（失败信息用） */
export function describeTypes(types: readonly EnemyType[]): string {
  return [...countTypes(types)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${count} ${type}`)
    .join(' + ');
}
