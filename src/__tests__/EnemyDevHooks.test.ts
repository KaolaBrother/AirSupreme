import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { installDevHooks, type DevHookAccess } from '@/core/dev/DevHooks';
import { EventBus, GameEventType } from '@/core/EventBus';
import { createFriendlyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { getAttackTokenCount } from '@/features/enemy/AttackDirector';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { FriendlyAI, WINGMAN_CONFIG } from '@/features/enemy/FriendlyAI';
import { DEG, SystemRig, pointAround, seededRandom, type SystemRigOptions } from './enemyFleetRig';

/**
 * 开发钩子里和敌机有关的四个（规格 §5，window.__AIR_SUPREME_DEV__）：
 * spawnEnemy(type, { distance?, bearingDeg?, count? })、listJets()、clearJets()、holdWaves(on)。
 * 用真实的 EnemySystem；游戏其余部分用一个只暴露这四个钩子需要的东西的替身——钩子碰了别的
 * 就会抛错，测试随之失败。
 */

// 地形生成很重，这里用不到：换成一片平坦的海面（常规波次需要先加载关卡）
vi.mock('@/features/terrain/TerrainGenerator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/terrain/TerrainGenerator')>()),
  TerrainGenerator: vi.fn().mockImplementation(() => ({
    generateTerrain: vi.fn(),
    update: vi.fn(),
    updateLOD: vi.fn(),
    getCrashSurfaceY: vi.fn(() => 0),
    sampleSurface: vi.fn(() => ({ y: 0, kind: 'water' })),
    getSurfaceKind: vi.fn(() => 'water'),
    getEnvironment: vi.fn(() => null),
    dispose: vi.fn(),
  })),
}));

interface JetEntry {
  type: string;
  health: number;
  position: { x: number; y: number; z: number };
  distance: number;
  phase: string;
  hasAttackToken: boolean;
  cloaked: boolean;
}

interface EnemyHooks {
  spawnEnemy(
    type: string,
    opts?: { distance?: number; bearingDeg?: number; count?: number }
  ): unknown;
  listJets(): JetEntry[];
  clearJets(): unknown;
  holdWaves(on: boolean): unknown;
}

const ALL_TYPES = Object.values(EnemyType);
const ENTRY_KEYS = ['cloaked', 'distance', 'hasAttackToken', 'health', 'phase', 'position', 'type'];

let rig: SystemRig | null = null;
let playerObject: THREE.Object3D;
let randomSpy: MockInstance | null = null;
let canvasSpy: MockInstance | null = null;

/** 把测试台里的玩家（位置 + 机头方向）同步到钩子看到的玩家机对象上：玩家机机头是本地 -Z */
function syncPlayer(current: SystemRig): void {
  playerObject.position.copy(current.player.position);
  const { forward } = current.player;
  playerObject.rotation.set(0, Math.atan2(-forward.x, -forward.z), 0);
  playerObject.updateMatrixWorld(true);
}

function install(options: SystemRigOptions = {}): { current: SystemRig; dev: EnemyHooks } {
  rig?.dispose();
  EventBus.clear();
  const current = new SystemRig(options);
  rig = current;
  playerObject = new THREE.Group();
  syncPlayer(current);
  const provided: Record<string, unknown> = {
    getEnemySystem: () => current.system,
    getPlayerAircraft: () => playerObject,
    getSession: () => current.session,
    // 钩子安装时会给玩家血量打一个“无敌模式”补丁：给它一个可以打补丁的对象
    getPlayerSystem: () => ({ getHealth: () => ({ takeDamage: () => undefined }) }),
  };
  const access = new Proxy(provided, {
    get(target, key) {
      if (typeof key === 'string' && key in target) return target[key];
      throw new Error(`the jet hooks should not need access.${String(key)}`);
    },
  }) as unknown as DevHookAccess;
  installDevHooks(access);
  const dev = (window as unknown as { __AIR_SUPREME_DEV__?: EnemyHooks }).__AIR_SUPREME_DEV__;
  if (!dev) throw new Error('window.__AIR_SUPREME_DEV__ was not installed');
  return { current, dev };
}

/** 推进若干秒，每一步都把玩家同步给钩子 */
function run(current: SystemRig, seconds: number, each?: () => boolean | void): void {
  current.run(seconds, () => {
    syncPlayer(current);
    return each?.();
  });
}

beforeEach(() => {
  // 钩子安装时会启动一个永不停止的逐帧回调：测试里不让它跑
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 0)
  );
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(20261013));
  // 敌机进场的传送门会试着画贴图：jsdom 没有 canvas，直接返回 null
  canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  rig?.dispose();
  rig = null;
  randomSpy?.mockRestore();
  canvasSpy?.mockRestore();
  vi.unstubAllGlobals();
  EventBus.clear();
  delete (window as unknown as { __AIR_SUPREME_DEV__?: unknown }).__AIR_SUPREME_DEV__;
});

/** 敌机相对玩家的水平方位：沿机头方向的分量与朝右的分量（单位化），以及水平距离 */
function relativeTo(
  current: SystemRig,
  position: THREE.Vector3
): { ahead: number; right: number; distance: number } {
  const { forward } = current.player;
  const length = Math.hypot(forward.x, forward.z);
  const fx = forward.x / length;
  const fz = forward.z / length;
  const dx = position.x - current.player.position.x;
  const dz = position.z - current.player.position.z;
  const distance = Math.hypot(dx, dz);
  // 前向 (x, z) 的右侧是 (-z, x)
  return {
    ahead: (dx * fx + dz * fz) / distance,
    right: (dx * -fz + dz * fx) / distance,
    distance,
  };
}

describe('spawnEnemy(type, opts)', () => {
  it.each(ALL_TYPES)('spawns one %s into the enemy system', (type) => {
    const { current, dev } = install();
    dev.spawnEnemy(type);
    expect(current.jets.length).toBe(1);
    const [jet] = current.jets;
    expect(jet.getConfig().type).toBe(type);
    expect(jet.isAlive()).toBe(true);
    expect(jet.getMesh().name).toBe(type);
    expect(jet.getMesh().parent, 'its mesh is in the scene').toBe(current.scene);
    expect(Number.isFinite(jet.getMesh().position.lengthSq())).toBe(true);
    expect(dev.listJets().map((entry) => entry.type)).toEqual([type]);
  });

  it.each([200, 450, 700])('distance %s: the jet appears that far from the player', (distance) => {
    const { current, dev } = install({ playerPosition: new THREE.Vector3(120, 420, -60) });
    dev.spawnEnemy(EnemyType.FIGHTER, { distance });
    const jet = current.jets[0];
    expect(relativeTo(current, jet.getMesh().position).distance).toBeCloseTo(distance, 0);
    // 在玩家周围，而不是地下或天外
    expect(Math.abs(jet.getMesh().position.y - current.player.position.y)).toBeLessThan(150);
  });

  it.each([
    [new THREE.Vector3(0, 0, 1), 'flying +Z'],
    [new THREE.Vector3(1, 0, 0), 'flying +X'],
    [new THREE.Vector3(-0.6, 0, -0.8), 'flying south-west'],
    [new THREE.Vector3(0.5, 0.5, 0.7), 'climbing'],
  ])(
    'bearingDeg is measured from the nose of a player %s: 0 ahead, 90 right, 180 behind, -90 left',
    (forward, _label) => {
      const { current, dev } = install({ playerForward: forward });
      const expected: Array<[number, number, number]> = [
        [0, 1, 0],
        [90, 0, 1],
        [180, -1, 0],
        [-90, 0, -1],
        [45, Math.SQRT1_2, Math.SQRT1_2],
      ];
      for (const [bearingDeg, ahead, right] of expected) {
        dev.clearJets();
        dev.spawnEnemy(EnemyType.SCOUT, { distance: 400, bearingDeg });
        const where = relativeTo(current, current.jets[0].getMesh().position);
        expect(where.ahead, `bearing ${bearingDeg}: ahead component`).toBeCloseTo(ahead, 2);
        expect(where.right, `bearing ${bearingDeg}: right component`).toBeCloseTo(right, 2);
        expect(where.distance).toBeCloseTo(400, 0);
      }
    }
  );

  it.each([2, 3, 5])(
    'count %s: that many jets, spread around the bearing at the given distance',
    (count) => {
      const { current, dev } = install();
      dev.spawnEnemy(EnemyType.FIGHTER, { distance: 500, bearingDeg: 90, count });
      expect(current.jets.length).toBe(count);
      let aheadSum = 0;
      for (const jet of current.jets) {
        expect(jet.getConfig().type).toBe(EnemyType.FIGHTER);
        const where = relativeTo(current, jet.getMesh().position);
        expect(where.distance).toBeCloseTo(500, 0);
        expect(where.right, 'on the side that was asked for').toBeGreaterThan(0.5);
        aheadSum += where.ahead;
      }
      // 以给定方位为中心左右对称
      expect(Math.abs(aheadSum / count)).toBeLessThan(0.02);
      // 不叠在一起
      for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) {
          expect(
            current.jets[a].getMesh().position.distanceTo(current.jets[b].getMesh().position)
          ).toBeGreaterThan(20);
        }
      }
    }
  );

  it('with no options it spawns a single jet somewhere around the player, not on top of it', () => {
    const { current, dev } = install();
    dev.spawnEnemy(EnemyType.HEAVY);
    expect(current.jets.length).toBe(1);
    const distance = relativeTo(current, current.jets[0].getMesh().position).distance;
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(900);
  });

  it('an unknown type spawns nothing', () => {
    const { current, dev } = install();
    dev.spawnEnemy('ZEPPELIN');
    dev.spawnEnemy('');
    expect(current.jets.length).toBe(0);
    expect(dev.listJets()).toEqual([]);
  });

  it('goes through the normal spawn path: same level scaling as any other spawn, fire and death events wired', () => {
    const { current, dev } = install({ level: 6, difficulty: 4 });
    dev.spawnEnemy(EnemyType.FIGHTER, { distance: 300, bearingDeg: 150 });
    const hooked = current.jets[0];
    const normal = current.spawn(EnemyType.FIGHTER, pointAround(current.player, 300, -150 * DEG));
    expect(hooked.getConfig().health).toBe(normal.getConfig().health);
    expect(hooked.getConfig().damage).toBe(normal.getConfig().damage);
    expect(hooked.getConfig().speed).toBe(normal.getConfig().speed);
    expect(hooked.getHealth().current).toBe(normal.getHealth().current);

    // 它会拿到令牌、开火：开火事件带着它的网格
    run(current, 40, () => current.shots.some((shot) => shot.payload.owner === hooked.getMesh()));
    expect(
      current.shots.some((shot) => shot.payload.owner === hooked.getMesh()),
      'the hook-spawned jet fired through ENEMY_FIRED'
    ).toBe(true);

    // 击落它：照常发 ENEMY_DEATH
    const deaths: string[] = [];
    const off = EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
      deaths.push(payload.config.type);
    });
    hooked.takeDamage(1e9);
    run(current, 0.5);
    off();
    expect(deaths).toEqual([EnemyType.FIGHTER]);
  });
});

describe('listJets()', () => {
  it('one entry per alive jet with exactly the documented fields', () => {
    const { current, dev } = install();
    const types = [
      EnemyType.SCOUT,
      EnemyType.FIGHTER,
      EnemyType.HEAVY,
      EnemyType.SNIPER,
      EnemyType.ACE,
    ];
    types.forEach((type, index) => dev.spawnEnemy(type, { distance: 350, bearingDeg: index * 70 }));
    run(current, 3);
    const list = dev.listJets();
    expect(list.length).toBe(types.length);
    expect(list.map((entry) => entry.type).sort()).toEqual([...types].sort());
    for (const entry of list) {
      expect(Object.keys(entry).sort()).toEqual(ENTRY_KEYS);
      expect(typeof entry.type).toBe('string');
      expect(typeof entry.health).toBe('number');
      expect(typeof entry.distance).toBe('number');
      expect(typeof entry.phase).toBe('string');
      expect(typeof entry.hasAttackToken).toBe('boolean');
      expect(typeof entry.cloaked).toBe('boolean');
      expect(Object.keys(entry.position).sort()).toEqual(['x', 'y', 'z']);
      // 给控制台 / 自动化脚本用的纯数据
      expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
    }
  });

  it('the values are the live ones: health, position, distance and token state of each jet', () => {
    const { current, dev } = install();
    for (let i = 0; i < 5; i++) {
      dev.spawnEnemy(EnemyType.FIGHTER, { distance: 320, bearingDeg: i * 72 + 10 });
    }
    current.jets[1].takeDamage(37);
    let sawToken = false;
    run(current, 20, () => {
      const list = dev.listJets();
      const jets = current.jets.filter((jet) => jet.isAlive());
      expect(list.length).toBe(jets.length);
      list.forEach((entry, index) => {
        const jet = jets[index];
        const position = jet.getMesh().position;
        expect(Math.abs(entry.health - jet.getHealth().current)).toBeLessThan(0.11);
        expect(Math.abs(entry.position.x - position.x)).toBeLessThan(0.11);
        expect(Math.abs(entry.position.y - position.y)).toBeLessThan(0.11);
        expect(Math.abs(entry.position.z - position.z)).toBeLessThan(0.11);
        expect(
          Math.abs(entry.distance - position.distanceTo(current.player.position))
        ).toBeLessThan(0.11);
        expect(entry.hasAttackToken).toBe(jet.hasAttackToken());
      });
      const holding = list.filter((entry) => entry.hasAttackToken).length;
      expect(holding).toBeLessThanOrEqual(getAttackTokenCount(1, 3, false));
      if (holding > 0) sawToken = true;
    });
    expect(sawToken, 'some jet held a token at some point').toBe(true);
    const damaged = dev.listJets()[1];
    expect(damaged.health).toBeLessThan(dev.listJets()[0].health);
  });

  it('phase is a short doctrine state name that changes as the jet works through its attack', () => {
    const { current, dev } = install();
    dev.spawnEnemy(EnemyType.SCOUT, { distance: 420, bearingDeg: 30 });
    const phases = new Set<string>();
    run(current, 40, () => {
      const [entry] = dev.listJets();
      expect(entry.phase.trim().length).toBeGreaterThan(0);
      expect(entry.phase.length).toBeLessThanOrEqual(24);
      phases.add(entry.phase);
    });
    expect(phases.size, `phases seen: ${[...phases].join(', ')}`).toBeGreaterThanOrEqual(2);
  });

  it('the five gun / flak / lance types are never reported as cloaked', () => {
    const { current, dev } = install({ level: 8 });
    [EnemyType.SCOUT, EnemyType.FIGHTER, EnemyType.HEAVY, EnemyType.SNIPER, EnemyType.ACE].forEach(
      (type, index) => dev.spawnEnemy(type, { distance: 380, bearingDeg: index * 72 })
    );
    run(current, 20, () => {
      for (const entry of dev.listJets()) expect(entry.cloaked).toBe(false);
    });
  });

  it('a jet that has been shot down is not listed any more; wingmen are never listed', () => {
    const { current, dev } = install();
    dev.spawnEnemy(EnemyType.FIGHTER, { distance: 300, bearingDeg: 0, count: 3 });
    const mesh = createFriendlyMesh({ ...WINGMAN_CONFIG });
    mesh.position.copy(current.player.position).add(new THREE.Vector3(40, 5, 30));
    current.scene.add(mesh);
    const wingman = new FriendlyAI(mesh, { ...WINGMAN_CONFIG }, current.scene);
    current.system.spawnFriendly(wingman);
    expect(dev.listJets().length).toBe(3);
    current.jets[0].takeDamage(1e9);
    expect(dev.listJets().length, 'right after the kill, before the system clears the wreck').toBe(
      2
    );
    run(current, 1);
    expect(dev.listJets().length).toBe(2);
    expect(dev.listJets().every((entry) => entry.type === EnemyType.FIGHTER)).toBe(true);
  });

  it('is empty when there are no enemy jets', () => {
    const { dev } = install();
    expect(dev.listJets()).toEqual([]);
  });
});

describe('clearJets()', () => {
  it('removes every enemy jet without scoring: no death events, meshes gone, tokens handed back', () => {
    const { current, dev } = install();
    [EnemyType.SCOUT, EnemyType.FIGHTER, EnemyType.HEAVY, EnemyType.SNIPER, EnemyType.ACE].forEach(
      (type, index) => dev.spawnEnemy(type, { distance: 330, bearingDeg: index * 72 })
    );
    run(current, 6);
    expect(current.holders().length, 'jets were attacking before the clear').toBeGreaterThan(0);
    const meshes = current.jets.map((jet) => jet.getMesh());
    const deaths: unknown[] = [];
    const hits: unknown[] = [];
    const offDeath = EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => deaths.push(payload));
    const offHit = EventBus.on(GameEventType.ENEMY_HIT, ({ payload }) => hits.push(payload));

    dev.clearJets();

    expect(current.jets.length).toBe(0);
    expect(dev.listJets()).toEqual([]);
    for (const mesh of meshes) expect(mesh.parent, 'mesh left the scene').toBeNull();
    expect(current.system.getAttackDirector().getHolderCount()).toBe(0);
    const shotsAtClear = current.shots.length;
    run(current, 5);
    offDeath();
    offHit();
    expect(deaths, 'ENEMY_DEATH events').toEqual([]);
    expect(hits, 'ENEMY_HIT events').toEqual([]);
    expect(current.shots.length, 'nothing fires after the clear').toBe(shotsAtClear);
  });

  it('leaves wingmen alone, and jets spawned afterwards fight normally', () => {
    const { current, dev } = install();
    const mesh = createFriendlyMesh({ ...WINGMAN_CONFIG });
    mesh.position.copy(current.player.position).add(new THREE.Vector3(-40, 5, 30));
    current.scene.add(mesh);
    const wingman = new FriendlyAI(mesh, { ...WINGMAN_CONFIG }, current.scene);
    current.system.spawnFriendly(wingman);
    dev.spawnEnemy(EnemyType.FIGHTER, { count: 4, distance: 300 });
    run(current, 3);
    dev.clearJets();
    expect(current.system.getFriendlyAIs()).toEqual([wingman]);
    expect(wingman.isAlive()).toBe(true);
    expect(mesh.parent).toBe(current.scene);

    dev.spawnEnemy(EnemyType.FIGHTER, { count: 3, distance: 280, bearingDeg: 180 });
    expect(dev.listJets().length).toBe(3);
    let most = 0;
    run(current, 15, () => {
      most = Math.max(most, dev.listJets().filter((entry) => entry.hasAttackToken).length);
    });
    expect(most, 'the new jets get attack tokens').toBeGreaterThan(0);
  });

  it('on an empty sky it does nothing and does not throw', () => {
    const { current, dev } = install();
    expect(() => dev.clearJets()).not.toThrow();
    expect(current.jets.length).toBe(0);
  });
});

describe('holdWaves(on): regular wave spawning stops and resumes', () => {
  /** 敌机经传送门进场，传送门模块是按需加载的：让挂起的加载与回调跑完 */
  async function settle(): Promise<void> {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 4; i++) await Promise.resolve();
  }

  /** 推进 seconds 秒（每 0.1 秒让按需加载跑完一次）；until 返回 true 时提前结束 */
  async function advance(
    current: SystemRig,
    seconds: number,
    until?: () => boolean
  ): Promise<boolean> {
    const chunks = Math.round(seconds / 0.1);
    for (let i = 0; i < chunks; i++) {
      run(current, 0.1);
      await settle();
      if (until?.()) return true;
    }
    return until ? until() : false;
  }

  function startLevel(current: SystemRig): void {
    current.system.loadLevel(1);
    current.system.startWave(current.player.position);
  }

  it('control: without a hold, the first wave brings jets in', async () => {
    const { current } = install();
    startLevel(current);
    expect(await advance(current, 60, () => current.jets.length > 0)).toBe(true);
  });

  it('held from the start: no jet arrives; released: the wave comes in', async () => {
    const { current, dev } = install();
    current.system.loadLevel(1);
    dev.holdWaves(true);
    current.system.startWave(current.player.position);
    let arrived = 0;
    await advance(current, 60, () => {
      arrived = Math.max(arrived, current.jets.length);
      return false;
    });
    expect(arrived, 'jets that arrived while held').toBe(0);
    expect(dev.listJets()).toEqual([]);

    dev.holdWaves(false);
    expect(
      await advance(current, 60, () => current.jets.length > 0),
      'jets arrive after release'
    ).toBe(true);
  });

  it('held with everything shot down: the next wave does not start until the hold is released', async () => {
    const { current, dev } = install();
    startLevel(current);
    expect(await advance(current, 60, () => current.jets.length > 0)).toBe(true);
    dev.holdWaves(true);
    // 按下暂停时已经打开的传送门还会把那一架送进来：给它几秒走完，进来的照样击落
    await advance(current, 8, () => {
      for (const jet of current.jets) jet.takeDamage(1e9);
      return false;
    });
    await advance(current, 1);
    expect(current.jets.filter((jet) => jet.isAlive()).length).toBe(0);
    let arrived = 0;
    await advance(current, 90, () => {
      arrived = Math.max(arrived, current.jets.filter((jet) => jet.isAlive()).length);
      return false;
    });
    expect(arrived, 'regular jets that arrived during 90 s of hold').toBe(0);

    dev.holdWaves(false);
    expect(
      await advance(current, 120, () => current.jets.some((jet) => jet.isAlive())),
      'regular jets come back after release'
    ).toBe(true);
  });

  it('one type can be studied alone: hold, clear, spawn it, and only that type is there', async () => {
    const { current, dev } = install();
    startLevel(current);
    expect(await advance(current, 60, () => current.jets.length > 0)).toBe(true);
    dev.holdWaves(true);
    dev.clearJets();
    dev.spawnEnemy(EnemyType.SNIPER, { distance: 450, bearingDeg: 40, count: 2 });
    const start = current.jets.map((jet) => jet.getMesh().position.clone());
    let foreign = 0;
    await advance(current, 45, () => {
      for (const entry of dev.listJets()) {
        if (entry.type !== EnemyType.SNIPER) foreign++;
      }
      return false;
    });
    expect(foreign, 'entries of any other type during the hold').toBe(0);
    expect(dev.listJets().length).toBe(2);
    // 被研究的敌机照常飞、照常打
    current.jets.forEach((jet, index) => {
      expect(jet.getMesh().position.distanceTo(start[index])).toBeGreaterThan(50);
    });
    expect(current.tells.length, 'the Snipers charged their lances').toBeGreaterThan(0);
  });
});
