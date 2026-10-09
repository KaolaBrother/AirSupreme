import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BossBattleController } from '@/core/BossBattleController';
import { BOSS_DECOY_ANCHOR_NAME } from '@/core/boss/AdvancedBossSupport';
import type { DecoyPoint } from '@/core/CombatContracts';
import type { BossMissile, BossMissileSystem } from '@/features/boss/BossMissileSystem';
import { BOSS_CONFIGS, BossType, getBossForLevel } from '@/features/boss/BossTypes';

/**
 * 热焰弹诱骗第 1-5 关 Boss 导弹（终验修复第 2 波 G2）：BossBattleController 对旧版 Boss 也运行共用的
 * BossFlareDecoyRedirector——新投放的热焰弹把玩家附近、正追踪玩家的 Boss 导弹引向诱饵锚点
 * （节点名 BOSS_DECOY_ANCHOR_NAME），与第 6-10 关 Boss 相同。
 * 控制器的协作者用替身；Math.random 换成固定种子的伪随机（诱骗按概率判定）。
 */

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

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 第 1-5 关里发射导弹的 Boss（第 3 关八爪鱼战舰没有导弹） */
const LEGACY_MISSILE_LEVELS = [1, 2, 3, 4, 5].filter(
  (level) => BOSS_CONFIGS[getBossForLevel(level) as BossType].missileDamage > 0
);

describe('flares vs the level 1-5 bosses', () => {
  let scene: THREE.Scene;
  let playerAircraft: THREE.Group;
  let decoys: DecoyPoint[];
  let controller: BossBattleController;
  let randomSpy: { mockRestore(): void } | null = null;
  let canvasSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seeded(9001));
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    scene = new THREE.Scene();
    playerAircraft = new THREE.Group();
    playerAircraft.position.set(0, 150, 0);
    scene.add(playerAircraft);
    decoys = [];
  });

  afterEach(() => {
    controller?.clear();
    randomSpy?.mockRestore();
    canvasSpy?.mockRestore();
    randomSpy = null;
    canvasSpy = null;
  });

  async function startBoss(level: number): Promise<BossMissileSystem> {
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
    // 玩家弹药 / Boss 炮弹池：没有在飞的弹药、不发生碰撞
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
    controller = new BossBattleController({
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
      getSurfaceSample: () => ({ y: -48, water: true }),
      getTerrainEnvironment: () => null,
      whenTerrainReady: () => Promise.resolve(),
      getDecoys: () => decoys,
      onSpawnMinion: vi.fn(),
      onCameraShake: vi.fn(),
      onExplosionShake: vi.fn(),
      onScreenFlash: vi.fn(),
    } as unknown as ConstructorParameters<typeof BossBattleController>[0]);

    expect(controller.start(level, false)).toBe(true);
    // Boss 模块按需动态加载
    await vi.waitFor(() => expect(controller.getCurrentBoss()).not.toBeNull(), {
      timeout: 10_000,
      interval: 10,
    });
    const boss = controller.getCurrentBoss();
    expect(boss, `level ${level} boss loaded`).not.toBeNull();
    const missiles = boss?.getMissileSystem() ?? null;
    expect(missiles, `level ${level} boss has missiles`).not.toBeNull();
    return missiles as BossMissileSystem;
  }

  /** 发射一枚追踪玩家的 Boss 导弹（位于玩家前方 distance 米） */
  function fireAtPlayer(missiles: BossMissileSystem, distance: number): BossMissile {
    const before = new Set(missiles.getMissiles());
    missiles.fire(new THREE.Vector3(0, 150, -distance), playerAircraft, [], playerAircraft, true);
    const fired = missiles.getMissiles().find((missile) => !before.has(missile));
    expect(fired).toBeDefined();
    return fired as BossMissile;
  }

  function step(frames = 1): void {
    for (let i = 0; i < frames; i++) controller.update(1 / 60);
  }

  /** 逐次多投一枚热焰弹（每次都是“新投放”），直到 predicate 成立或投完 */
  function deployFlares(until: () => boolean, count = 6): void {
    for (let i = 0; i < count && !until(); i++) {
      decoys = [
        ...decoys,
        {
          position: playerAircraft.position.clone().add(new THREE.Vector3(i * 4 - 10, -6, 18)),
          strength: 1,
        },
      ];
      step();
    }
  }

  it('the decoy anchor name is exported', () => {
    expect(typeof BOSS_DECOY_ANCHOR_NAME).toBe('string');
    expect(BOSS_DECOY_ANCHOR_NAME.length).toBeGreaterThan(0);
  });

  it('covers the missile-firing bosses of levels 1-5', () => {
    expect(LEGACY_MISSILE_LEVELS).toEqual([1, 2, 4, 5]);
  });

  it.each(LEGACY_MISSILE_LEVELS)(
    'level %i: freshly deployed flares pull a nearby missile that is chasing the player',
    async (level) => {
      const missiles = await startBoss(level);
      const missile = fireAtPlayer(missiles, 220);
      step(3);
      expect(missile.target, 'still chasing the player without flares').toBe(playerAircraft);
      expect(missile.isTargetingPlayer).toBe(true);

      deployFlares(() => missile.target !== playerAircraft);

      expect(missile.target?.name).toBe(BOSS_DECOY_ANCHOR_NAME);
      expect(missile.isTargetingPlayer).toBe(false);
    }
  );

  it('flares that were already burning do not redirect a missile fired afterwards', async () => {
    const missiles = await startBoss(1);
    decoys = [
      { position: playerAircraft.position.clone().add(new THREE.Vector3(0, -6, 18)), strength: 1 },
    ];
    step(2);
    const missile = fireAtPlayer(missiles, 220);
    step(5);
    expect(missile.target).toBe(playerAircraft);

    deployFlares(() => missile.target !== playerAircraft);
    expect(missile.target?.name).toBe(BOSS_DECOY_ANCHOR_NAME);
  });

  it('a missile far from the player is not pulled', async () => {
    const missiles = await startBoss(4);
    const far = fireAtPlayer(missiles, 1500);
    step(2);
    deployFlares(() => false);
    expect(far.target).toBe(playerAircraft);
    expect(far.isTargetingPlayer).toBe(true);
  });
});
