import * as THREE from 'three';
import { expect, vi } from 'vitest';
import { BossBattleController, type ActiveBoss } from '@/core/BossBattleController';
import type { CombatTarget, CombatTargetKind, DamageSource } from '@/core/CombatContracts';
import { Faction } from '@/core/Faction';
import { BOSS_CONFIGS, type BossType } from '@/features/boss/BossTypes';

/**
 * 火箭平衡测试台（火箭对 Boss / 大型目标过强的修正）。
 *
 * 契约（由测试独立持有，不读生产代码里的常量）：
 * 1. 一次爆炸只命中 Boss 一次：范围内所有 'boss-part' 目标中，只有“本应受伤最多”的那个部件受伤，
 *    按该数值结算；非 Boss 目标照旧各自结算溅射。
 * 2. 火箭（来源 'rocket'）按目标类别乘系数：'air' × 0.5，'boss-part' × 0.6，其余 × 1.0；
 *    直接命中与溅射都乘。蜂群与其他武器系数 1.0。
 */

/** 契约第 2 条：火箭对空中目标（敌机、空中单位、轰炸机）的伤害系数 */
export const CONTRACT_ROCKET_FACTOR_AIR = 0.5;
/** 契约第 2 条：火箭对 Boss 部件的伤害系数 */
export const CONTRACT_ROCKET_FACTOR_BOSS = 0.6;

/** 溅射衰减（现有规则）：表面距离 0 → 满伤害，溅射半径边缘 → 40% */
export function splashFalloff(surface: number, splashRadius: number): number {
  return 1 - 0.6 * (Math.max(0, surface) / splashRadius);
}

/** 契约系数：source = 'rocket' 时按目标类别取系数，其余来源恒为 1 */
export function contractFactor(source: DamageSource, kind: CombatTargetKind): number {
  if (source !== 'rocket') return 1;
  if (kind === 'air') return CONTRACT_ROCKET_FACTOR_AIR;
  if (kind === 'boss-part') return CONTRACT_ROCKET_FACTOR_BOSS;
  return 1;
}

export interface RecordedHit {
  amount: number;
  source: DamageSource;
}

/** 手工目标：记录每一次 applyDamage */
export interface FakeTarget extends CombatTarget {
  alive: boolean;
  readonly hits: RecordedHit[];
}

let fakeSequence = 0;

export function makeFakeTarget(
  kind: CombatTargetKind,
  position: readonly [number, number, number],
  hitRadius: number,
  faction: Faction = Faction.ENEMY
): FakeTarget {
  const mesh = new THREE.Object3D();
  mesh.position.set(position[0], position[1], position[2]);
  const hits: RecordedHit[] = [];
  const target: FakeTarget = {
    id: `rocket-balance-${kind}-${++fakeSequence}`,
    mesh,
    faction,
    kind,
    hitRadius,
    alive: true,
    hits,
    isAlive: () => target.alive,
    applyDamage: (amount: number, source: DamageSource) => {
      hits.push({ amount, source });
    },
  };
  return target;
}

export function totalOf(hits: readonly RecordedHit[]): number {
  return hits.reduce((sum, hit) => sum + hit.amount, 0);
}

// -----------------------------------------------------------------------------
// 真实 BossBattleController（协作者全部替身，做法同 BossFlares.test.ts）
// -----------------------------------------------------------------------------

type Stub = Record<string, unknown>;

/** 任意方法都是 vi.fn() 的替身；overrides 里的字段优先 */
function autoStub(overrides: Stub = {}): Stub {
  const methods = new Map<PropertyKey, unknown>();
  return new Proxy(overrides, {
    get: (target, key) => {
      if (key in target) return target[key as string];
      if (key === 'then') return undefined;
      let method = methods.get(key);
      if (!method) {
        method = vi.fn();
        methods.set(key, method);
      }
      return method;
    },
  });
}

export interface BossRig {
  controller: BossBattleController;
  boss: ActiveBoss;
  /** 当前全部 Boss 战斗目标（部件 + 可拦截导弹） */
  targets(): CombatTarget[];
  /** 当前全部 'boss-part' 目标 */
  parts(): CombatTarget[];
  dispose(): void;
}

/** 固定种子的伪随机（mulberry32），用来替换 Math.random，让 Boss AI 的随机行为可复现 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 海面 Boss（第 7 关深渊利维坦）需要的水面采样：水面 y = -48 */
export const SEA_SURFACE = { y: -48, water: true } as const;

/**
 * 启动第 level 关的真实 Boss（普通难度：配置血量不缩放），等待按需加载完成，
 * 再推进 warmupFrames 帧（第 6-10 关 Boss 的部件归属在首帧 update 时建立）。
 * 除非测试自己推进 controller.update，Boss 原地不动、不开火，部件位置固定。
 * surface 是所有地点的地表采样（默认 y = 0 的陆地）。
 */
export async function startBossRig(
  level: number,
  warmupFrames = 3,
  surface: { y: number; water: boolean } = { y: 0, water: false }
): Promise<BossRig> {
  const canvasSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => null);
  const scene = new THREE.Scene();
  const playerAircraft = new THREE.Group();
  playerAircraft.position.set(0, 150, 0);
  scene.add(playerAircraft);
  const playerSystem = autoStub({
    getPosition: () => playerAircraft.position,
    getMesh: () => playerAircraft,
    isShieldActive: () => false,
    isPlayerRespawning: () => false,
  });
  const enemySystem = autoStub({
    getLevelManager: () => ({ getCurrentLevelConfig: () => ({ id: level }) }),
    getFriendlyAIs: () => [],
    getEnemies: () => [],
  });
  const pool = autoStub({
    checkCollisions: () => undefined,
    hasActiveProjectiles: () => false,
    getActiveProjectiles: () => [],
  });
  const combatSystem = autoStub({
    getMissileSystem: () => pool,
    getPlayerProjectilePool: () => pool,
    getBossProjectilePool: () => pool,
    getEnemyProjectilePool: () => pool,
    getDamageMultiplier: () => 1,
  });
  const controller = new BossBattleController({
    scene,
    camera: new THREE.PerspectiveCamera(60, 1, 0.1, 5000),
    particleSystem: autoStub(),
    combatSystem,
    enemySystem,
    playerSystem,
    playerAircraft,
    audioManager: autoStub(),
    musicSystem: autoStub(),
    hud: autoStub(),
    bossIndicator: autoStub(),
    resolveBossConfig: (type: BossType) => BOSS_CONFIGS[type],
    onBossDestroyed: vi.fn(),
    onSpawnFriendly: vi.fn(),
    onSpawnEnemyFromBoss: vi.fn(),
    scheduleTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>,
    presentation: autoStub(),
    getSurfaceSample: () => surface,
    getTerrainEnvironment: () => null,
    whenTerrainReady: () => Promise.resolve(),
    getDecoys: () => [],
    onSpawnMinion: vi.fn(),
    onCameraShake: vi.fn(),
    onExplosionShake: vi.fn(),
    onScreenFlash: vi.fn(),
  } as unknown as ConstructorParameters<typeof BossBattleController>[0]);

  expect(controller.start(level, false), `level ${level} boss fight starts`).toBe(true);
  // Boss 模块按需动态加载
  await vi.waitFor(() => expect(controller.getCurrentBoss()).not.toBeNull(), {
    timeout: 10_000,
    interval: 10,
  });
  for (let frame = 0; frame < warmupFrames; frame++) controller.update(1 / 60);
  const boss = controller.getCurrentBoss() as ActiveBoss;
  expect(boss.isAlive(), `level ${level} boss alive after warm-up`).toBe(true);
  const targets = (): CombatTarget[] => {
    const out: CombatTarget[] = [];
    controller.appendCombatTargets(out);
    return out;
  };
  return {
    controller,
    boss,
    targets,
    parts: () => targets().filter((target) => target.kind === 'boss-part'),
    dispose: () => {
      controller.clear();
      canvasSpy.mockRestore();
    },
  };
}
