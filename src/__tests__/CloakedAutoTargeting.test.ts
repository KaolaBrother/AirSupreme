import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import type { CombatTarget, DamageSource } from '@/core/CombatContracts';
import { Faction } from '@/core/Faction';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import type { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { ProjectileController } from '@/features/weapons/ProjectileController';
import { createFireFrame, type WeaponContext } from '@/features/weapons/WeaponContext';
import { WeaponFx } from '@/features/weapons/WeaponFx';
import type { WeaponRuntime } from '@/features/weapons/WeaponSystem';
import {
  TargetSnapshotBuffer,
  acquireConeTargets,
  type TargetSnapshot,
} from '@/features/weapons/WeaponTargeting';
import { getSpecialWeaponStats } from '@/features/weapons/WeaponTypes';
import { CampaignRig, callPrivate, installCampaignGlobals, waveCheckpoint } from './campaignRig';
import { resetLocale } from './i18nTestUtils';

/**
 * 敌机舰队 M3：隐形中的敌机不被自动索敌（规格 §3 WRAITH：“While cloaked it cannot be locked …”；
 * 本轮把它推广到玩家的自动索敌武器和友军的目标选择）：
 * - 蜂群导弹开火时分配目标、丢失目标后重新索敌，都不会选隐形中的敌机；它一现形就又能被选上；
 *   已经分配给它的导弹不因它隐形而改道（已经在飞的弹药照样打得到它）；
 * - 友军单位与僚机的索敌名单里没有隐形中的敌机，现形后又有。
 *
 * 两层：武器层（真的 TargetSnapshotBuffer / acquireConeTargets / ProjectileController，目标是
 * 测试自己的 CombatTarget）；游戏里（战役台架，一台真的 GameCoordinator，真的幽灵机按自己的
 * 条令隐形 / 现形）。
 */

vi.setConfig({ testTimeout: 120_000 });

vi.mock('@/scenes/GameScene', () => ({
  GameScene: class {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(
      GAME_CONSTANTS.CAMERA.FOV,
      1.6,
      GAME_CONSTANTS.CAMERA.NEAR,
      GAME_CONSTANTS.CAMERA.FAR
    );

    setScreenEffects(): void {
      // 没有后处理
    }

    render(): void {
      // 不渲染
    }

    applyQualitySettings(): void {
      // 没有画质可调
    }

    applyLevelEnvironment(): void {
      // 没有环境
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: class {
    private readonly aircraft: THREE.Group;

    constructor(aircraft: THREE.Group) {
      this.aircraft = aircraft;
    }

    getPosition(): THREE.Vector3 {
      return this.aircraft.position.clone();
    }

    getQuaternion(): THREE.Quaternion {
      return this.aircraft.quaternion.clone();
    }

    getSpeed(): number {
      return 0;
    }

    update(): void {
      // 座机不动
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

// 地形生成很重，这里用不到：换成一片平坦的海面
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

// ─────────────────────────────── 武器层 ───────────────────────────────

/** 测试自己的敌机目标：cloaked 为真时 isSeekable() 返回 false（与协调器给敌机的包装一样） */
interface TestJet {
  target: CombatTarget;
  mesh: THREE.Object3D;
  cloaked: boolean;
  hits: number;
  alive: boolean;
}

function testJet(name: string, position: THREE.Vector3, withSeekable = true): TestJet {
  const mesh = new THREE.Object3D();
  mesh.name = name;
  mesh.position.copy(position);
  mesh.updateMatrixWorld(true);
  const jet: TestJet = {
    target: null as unknown as CombatTarget,
    mesh,
    cloaked: false,
    hits: 0,
    alive: true,
  };
  const target: CombatTarget = {
    id: name,
    mesh,
    faction: Faction.ENEMY,
    kind: 'air',
    hitRadius: 5,
    isAlive: () => jet.alive,
    applyDamage: (_amount: number, _source: DamageSource) => {
      jet.hits++;
    },
  };
  if (withSeekable) target.isSeekable = () => !jet.cloaked;
  jet.target = target;
  return jet;
}

const ORIGIN = new THREE.Vector3(0, 500, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

/** 机头前方 distance 米、向右偏 degrees 度的点 */
function ahead(distance: number, degrees = 0): THREE.Vector3 {
  const rad = THREE.MathUtils.degToRad(degrees);
  return new THREE.Vector3(Math.sin(rad) * distance, 500, -Math.cos(rad) * distance);
}

describe('the weapons’ auto-targeting skips a cloaked jet', () => {
  let canvasSpy: { mockRestore(): void };
  let randomSpy: { mockRestore(): void };

  beforeEach(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    canvasSpy.mockRestore();
  });

  describe('target snapshot and cone acquisition', () => {
    it('a cloaked jet is in the snapshot (it can still be hit) but not seekable; visible again, it is', () => {
      const wraith = testJet('wraith', ahead(300));
      const snapshot = new TargetSnapshotBuffer();
      wraith.cloaked = true;
      snapshot.capture([wraith.target]);
      expect(snapshot.size()).toBe(1);
      expect(snapshot.get(0)).toMatchObject({ hostile: true, damageable: true, seekable: false });
      wraith.cloaked = false;
      snapshot.capture([wraith.target]);
      expect(snapshot.get(0).seekable).toBe(true);
    });

    it('a target that says nothing about seeking is seekable', () => {
      const plain = testJet('plain', ahead(300), false);
      const snapshot = new TargetSnapshotBuffer();
      snapshot.capture([plain.target]);
      expect(snapshot.get(0).seekable).toBe(true);
    });

    it('the forward cone picks the visible jet, not the cloaked one on the nose; decloaked, the nose one comes first', () => {
      const wraith = testJet('wraith', ahead(250));
      const fighter = testJet('fighter', ahead(450, 20));
      const snapshot = new TargetSnapshotBuffer();
      const out: TargetSnapshot[] = [];
      const cone = Math.cos(THREE.MathUtils.degToRad(42));

      wraith.cloaked = true;
      snapshot.capture([wraith.target, fighter.target]);
      expect(acquireConeTargets(snapshot, ORIGIN, FORWARD, 1000, cone, 8, out)).toBe(1);
      expect(out[0].target).toBe(fighter.target);

      wraith.cloaked = false;
      snapshot.capture([wraith.target, fighter.target]);
      expect(acquireConeTargets(snapshot, ORIGIN, FORWARD, 1000, cone, 8, out)).toBe(2);
      expect(out.map((entry) => entry.target)).toEqual([wraith.target, fighter.target]);
    });

    it('with only a cloaked jet ahead, nothing is acquired', () => {
      const wraith = testJet('wraith', ahead(250));
      wraith.cloaked = true;
      const snapshot = new TargetSnapshotBuffer();
      snapshot.capture([wraith.target]);
      const out: TargetSnapshot[] = [];
      expect(acquireConeTargets(snapshot, ORIGIN, FORWARD, 1000, 0.5, 8, out)).toBe(0);
    });
  });

  describe('swarm missiles', () => {
    interface SwarmRig {
      controller: ProjectileController;
      /** 每一步之后各枚在飞 / 待发蜂群导弹的目标 */
      targets(): Array<CombatTarget | null>;
      fire(count: number): void;
      run(seconds: number): void;
      dispose(): void;
    }

    function swarmRig(jets: TestJet[]): SwarmRig {
      const scene = new THREE.Scene();
      const fx = new WeaponFx(scene);
      fx.attach();
      const snapshot = new TargetSnapshotBuffer();
      let swarm: ReadonlyArray<{ active: boolean; pending: boolean; target: CombatTarget | null }> =
        [];
      const renderBodies = fx.renderBodies.bind(fx);
      vi.spyOn(fx, 'renderBodies').mockImplementation((kind, projectiles) => {
        if (kind === 'swarm') swarm = projectiles as unknown as typeof swarm;
        renderBodies(kind, projectiles);
      });
      const context: WeaponContext = {
        fx,
        particleSystem: null,
        surfaceSampler: null,
        getSnapshot: () => snapshot,
        emitFired: vi.fn(),
        emitImpact: vi.fn(),
        emitEmpPulse: vi.fn(),
        emitOverheat: vi.fn(),
        emitBeamEnd: vi.fn(),
        emitChargeStart: vi.fn(),
        emitDryFire: vi.fn(),
        attachFx: vi.fn(),
      };
      const controller = new ProjectileController(context);
      const frame = createFireFrame();
      frame.position.copy(ORIGIN);
      frame.forward.copy(FORWARD);
      frame.valid = true;
      const capture = (): void => snapshot.capture(jets.map((jet) => jet.target));
      return {
        controller,
        targets: () =>
          swarm.filter((missile) => missile.active || missile.pending).map((m) => m.target),
        fire(count) {
          capture();
          const stats = getSpecialWeaponStats('swarm', 0);
          stats.projectileCount = count;
          stats.range = 1500;
          const runtime = { id: 'swarm', level: 0, stats } as WeaponRuntime;
          expect(controller.fireSalvo('swarm', runtime, frame)).toBe(count);
          controller.update(0, frame);
        },
        run(seconds) {
          const dt = 1 / 60;
          for (let i = 0; i < Math.round(seconds / dt); i++) {
            capture();
            controller.update(dt, frame);
          }
        },
        dispose() {
          fx.dispose();
        },
      };
    }

    it('a salvo with a cloaked jet on the nose goes to the visible jet beside it', () => {
      const wraith = testJet('wraith', ahead(300));
      const fighter = testJet('fighter', ahead(500, 25));
      wraith.cloaked = true;
      const rig = swarmRig([wraith, fighter]);
      try {
        rig.fire(6);
        const targets = rig.targets();
        expect(targets).toHaveLength(6);
        for (const target of targets) expect(target).toBe(fighter.target);
      } finally {
        rig.dispose();
      }
    });

    it('once it decloaks, the next salvo can go to it', () => {
      const wraith = testJet('wraith', ahead(300));
      const fighter = testJet('fighter', ahead(500, 25));
      const rig = swarmRig([wraith, fighter]);
      try {
        wraith.cloaked = true;
        rig.run(0.2);
        wraith.cloaked = false;
        rig.fire(6);
        expect(rig.targets()).toContain(wraith.target);
      } finally {
        rig.dispose();
      }
    });

    it('a missile that lost its target re-seeks a visible jet, never a cloaked one in its path', () => {
      const decoy = testJet('decoy', ahead(600));
      const wraith = testJet('wraith', ahead(260, 3));
      const fighter = testJet('fighter', ahead(330, 30));
      const rig = swarmRig([decoy, wraith, fighter]);
      try {
        // 先只让诱饵可选：整轮齐射都分给它
        wraith.cloaked = true;
        fighter.alive = false;
        rig.fire(4);
        for (const target of rig.targets()) expect(target).toBe(decoy.target);
        // 诱饵没了：导弹重新索敌，幽灵机仍隐形，战斗机回到场上
        decoy.alive = false;
        fighter.alive = true;
        const seen = new Set<CombatTarget | null>();
        for (let i = 0; i < 30; i++) {
          rig.run(1 / 30);
          for (const target of rig.targets()) seen.add(target);
        }
        expect(seen.has(wraith.target), 'never the cloaked jet').toBe(false);
        expect(seen.has(fighter.target), 'the visible jet was picked').toBe(true);
      } finally {
        rig.dispose();
      }
    });

    it('a missile already on a jet stays on it when the jet cloaks (in-flight munitions still hit)', () => {
      const wraith = testJet('wraith', ahead(500));
      const fighter = testJet('fighter', ahead(520, 30));
      const rig = swarmRig([wraith, fighter]);
      try {
        rig.fire(2);
        const assigned = rig.targets();
        expect(assigned).toContain(wraith.target);
        wraith.cloaked = true;
        rig.run(0.5);
        const onWraith = rig.targets().filter((target) => target === wraith.target).length;
        expect(onWraith).toBe(assigned.filter((target) => target === wraith.target).length);
      } finally {
        rig.dispose();
      }
    });
  });
});

// ─────────────────────────────── 游戏里 ───────────────────────────────

describe('in the game: a real Wraith cloaking and decloaking', () => {
  let restoreGlobals: () => void;
  let rig: CampaignRig;

  interface Sample {
    cloaked: boolean;
    present: boolean;
    control: boolean;
  }

  beforeEach(async () => {
    restoreGlobals = installCampaignGlobals();
    window.localStorage.clear();
    rig = await CampaignRig.boot();
    // 第 7 关：常规波次停住，只看测试摆上去的两架；僚机照常升空
    rig.levelManager.setWaveSpawningHeld(true);
    await rig.resume(waveCheckpoint(7, 0));
    await rig.run(2.5);
    rig.levelManager.despawnAllEnemies();
    // 玩家不会被打下来（复活期间敌机停火，会打乱隐形节奏）
    vi.spyOn(rig.playerSystem.getHealth(), 'takeDamage').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rig.dispose();
    restoreGlobals();
    resetLocale();
    window.localStorage.clear();
  });

  /** 在玩家前方生成一架不会被击落的敌机 */
  function spawnSturdy(type: EnemyType, right: number, ahead: number): EnemyAI {
    const aircraft = rig.coordinator.playerAircraft as THREE.Object3D;
    const position = new THREE.Vector3(right, 0, -ahead)
      .applyQuaternion(aircraft.quaternion)
      .add(aircraft.position);
    const jet = rig.levelManager.spawnEnemyAtPosition(type, position, false);
    expect(jet, type).toBeTruthy();
    vi.spyOn(jet as EnemyAI, 'takeDamage').mockImplementation(() => undefined);
    return jet as EnemyAI;
  }

  /** 推进到 wraith 隐形过、又现形为止，期间每一步交给 record */
  async function throughACloak(wraith: EnemyAI, maxSeconds: number): Promise<void> {
    let wasCloaked = false;
    const done = await rig.runUntil(() => {
      if (wraith.isCloaked()) wasCloaked = true;
      return wasCloaked && !wraith.isCloaked();
    }, maxSeconds);
    expect(done, 'the Wraith cloaked and decloaked again').toBe(true);
    // 现形后再看一会儿
    await rig.run(1);
  }

  function summarize(samples: Sample[]): void {
    const cloaked = samples.filter((sample) => sample.cloaked);
    const visible = samples.filter((sample) => !sample.cloaked);
    expect(cloaked.length, 'steps while cloaked').toBeGreaterThan(10);
    expect(visible.length, 'steps while visible').toBeGreaterThan(10);
    expect(
      cloaked.filter((sample) => sample.present).length,
      'cloaked but still offered as a target'
    ).toBe(0);
    expect(
      visible.filter((sample) => !sample.present).length,
      'visible but not offered as a target'
    ).toBe(0);
    expect(
      samples.every((sample) => sample.control),
      'the Fighter is always offered'
    ).toBe(true);
  }

  it('the target the coordinator gives the special weapons is not seekable while it is cloaked', async () => {
    const wraith = spawnSturdy(EnemyType.WRAITH, 0, 350);
    const fighter = spawnSturdy(EnemyType.FIGHTER, -120, 420);
    const samples: Sample[] = [];
    const sample = (): void => {
      const targets: CombatTarget[] = [];
      callPrivate(rig.coordinator, 'collectWeaponTargets', targets);
      const find = (jet: EnemyAI): CombatTarget | undefined =>
        targets.find((target) => target.mesh === jet.getMesh());
      const wraithTarget = find(wraith);
      const fighterTarget = find(fighter);
      expect(wraithTarget, 'the Wraith can still be hit').toBeDefined();
      samples.push({
        cloaked: wraith.isCloaked(),
        present: wraithTarget?.isSeekable?.() !== false,
        control: fighterTarget !== undefined && fighterTarget.isSeekable?.() !== false,
      });
    };
    let wasCloaked = false;
    const done = await rig.runUntil(() => {
      sample();
      if (wraith.isCloaked()) wasCloaked = true;
      return wasCloaked && !wraith.isCloaked();
    }, 40);
    expect(done, 'the Wraith cloaked and decloaked again').toBe(true);
    for (let i = 0; i < 30; i++) {
      await rig.step();
      sample();
    }
    summarize(samples);
  });

  it('friendly units are not given it to shoot at while it is cloaked', async () => {
    const wraith = spawnSturdy(EnemyType.WRAITH, 0, 350);
    const fighter = spawnSturdy(EnemyType.FIGHTER, -120, 420);
    const samples: Sample[] = [];
    const original = rig.units.update.bind(rig.units);
    vi.spyOn(rig.units, 'update').mockImplementation((...args) => {
      const enemies = args[3];
      samples.push({
        cloaked: wraith.isCloaked(),
        present: enemies.includes(wraith.getMesh()),
        control: enemies.includes(fighter.getMesh()),
      });
      original(...args);
    });
    await throughACloak(wraith, 40);
    summarize(samples);
  });

  it('wingmen are not given it to chase while it is cloaked', async () => {
    const friendlies = rig.enemySystem.getFriendlyAIs() as FriendlyAI[];
    expect(friendlies.length, 'the named flight is up').toBeGreaterThan(0);
    const wraith = spawnSturdy(EnemyType.WRAITH, 0, 350);
    const fighter = spawnSturdy(EnemyType.FIGHTER, -120, 420);
    const samples: Sample[] = [];
    const wingman = friendlies[0];
    const original = wingman.update.bind(wingman);
    vi.spyOn(wingman, 'update').mockImplementation((...args) => {
      const enemies = args[1];
      samples.push({
        cloaked: wraith.isCloaked(),
        present: enemies.includes(wraith.getMesh()),
        control: enemies.includes(fighter.getMesh()),
      });
      original(...args);
    });
    await throughACloak(wraith, 40);
    summarize(samples);
  });
});
