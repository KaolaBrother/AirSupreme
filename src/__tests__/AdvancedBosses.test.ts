import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDeclaredHitRadius } from '@/core/CombatContracts';
import { AbyssalLeviathanAI, createAbyssalLeviathanMesh } from '@/features/boss/AbyssalLeviathanAI';
import {
  isAdvancedBoss,
  type BossMinionKind,
  type IAdvancedBoss,
} from '@/features/boss/BossContracts';
import { BossMissileSystem } from '@/features/boss/BossMissileSystem';
import {
  BOSS_CONFIGS,
  BossType,
  getBossForLevel,
  type BossConfig,
} from '@/features/boss/BossTypes';
import { MagmaColossusAI, createMagmaColossusMesh } from '@/features/boss/MagmaColossusAI';
import { OraclePrimeAI, createOraclePrimeMesh } from '@/features/boss/OraclePrimeAI';
import { PhantomWingAI, createPhantomWingMesh } from '@/features/boss/PhantomWingAI';
import { TempestZeppelinAI, createTempestZeppelinMesh } from '@/features/boss/TempestZeppelinAI';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';

/** integration-notes 记录的扩展：死亡演出开关（第 6-10 关 Boss 全部提供） */
interface SequencedBoss extends IAdvancedBoss {
  setDeathSequenceEnabled(enabled: boolean): void;
  isDying(): boolean;
}

type BossCtor = new (
  mesh: THREE.Group,
  config: BossConfig,
  scene: THREE.Scene,
  particleSystem: ParticleSystem
) => SequencedBoss;

interface BossCase {
  level: number;
  type: BossType;
  createMesh: (config: BossConfig) => THREE.Group;
  Ai: BossCtor;
  /** api-spec §2 出生约定，玩家位于 (0, 150, 0) */
  spawn: readonly [number, number, number];
  /** 存活时会进入无敌窗口：潜航 / 隐形 / 护盾 */
  liveInvulnerability: boolean;
}

const PLAYER_START = new THREE.Vector3(0, 150, 0);
const MINION_KINDS: readonly BossMinionKind[] = ['scout', 'fighter', 'heavy', 'ace', 'drone'];
const DT = 1 / 30;

const CASES: readonly BossCase[] = [
  {
    level: 6,
    type: BossType.MAGMA_COLOSSUS,
    createMesh: createMagmaColossusMesh,
    Ai: MagmaColossusAI,
    spawn: [0, 0, 260],
    liveInvulnerability: false,
  },
  {
    level: 7,
    type: BossType.ABYSSAL_LEVIATHAN,
    createMesh: createAbyssalLeviathanMesh,
    Ai: AbyssalLeviathanAI,
    spawn: [0, -48, 260],
    liveInvulnerability: true,
  },
  {
    level: 8,
    type: BossType.TEMPEST_ZEPPELIN,
    createMesh: createTempestZeppelinMesh,
    Ai: TempestZeppelinAI,
    spawn: [0, 170, 300],
    liveInvulnerability: false,
  },
  {
    level: 9,
    type: BossType.PHANTOM_WING,
    createMesh: createPhantomWingMesh,
    Ai: PhantomWingAI,
    spawn: [120, 190, 320],
    liveInvulnerability: true,
  },
  {
    level: 10,
    type: BossType.ORACLE_PRIME,
    createMesh: createOraclePrimeMesh,
    Ai: OraclePrimeAI,
    spawn: [0, 160, 280],
    liveInvulnerability: true,
  },
];

interface BossRig {
  scene: THREE.Scene;
  mesh: THREE.Group;
  boss: SequencedBoss;
  config: BossConfig;
  player: THREE.Object3D;
}

/** 控制器约定：先建网格、摆位、加入场景，再构造 AI；粒子系统只给一个空替身 */
function createBoss(bossCase: BossCase): BossRig {
  const config = BOSS_CONFIGS[bossCase.type];
  const scene = new THREE.Scene();
  const mesh = bossCase.createMesh(config);
  mesh.position.set(bossCase.spawn[0], bossCase.spawn[1], bossCase.spawn[2]);
  scene.add(mesh);
  const boss = new bossCase.Ai(mesh, config, scene, {} as unknown as ParticleSystem);
  const withSampler = boss as SequencedBoss & {
    setGroundSampler?: (sampler: (x: number, z: number) => number) => void;
  };
  withSampler.setGroundSampler?.(() => 0);
  const player = new THREE.Object3D();
  player.position.copy(PLAYER_START);
  return { scene, mesh, boss, config, player };
}

/** 绕 Boss 出生点盘旋的玩家 */
function movePlayer(rig: BossRig, bossCase: BossCase, time: number): void {
  rig.player.position.set(
    bossCase.spawn[0] + Math.sin(time * 0.6) * 240,
    150 + Math.sin(time * 1.3) * 30,
    bossCase.spawn[2] + Math.cos(time * 0.6) * 240
  );
}

function isFiniteVector(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function isUnder(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function countNodes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse(() => {
    count++;
  });
  return count;
}

/** 每帧向所有碰撞部件开火，直到 Boss 死亡；返回耗时（模拟秒） */
function hitUntilDead(rig: BossRig, bossCase: BossCase, limitSeconds: number): number {
  let time = 0;
  while (rig.boss.isAlive() && time < limitSeconds) {
    time += DT;
    movePlayer(rig, bossCase, time);
    rig.boss.update(DT, rig.player, []);
    for (const part of rig.boss.getCollisionParts().slice()) {
      rig.boss.takeDamageAt(part, 400);
    }
  }
  return time;
}

beforeAll(() => {
  // 无 canvas 环境：贴图创建必须回退为无贴图（api-spec 全局规则）
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe.each(CASES)('boss $level · $type', (bossCase) => {
  describe('contract (one instance, in order)', () => {
    let rig: BossRig;

    beforeAll(() => {
      rig = createBoss(bossCase);
    });

    afterAll(() => {
      rig.boss.dispose();
    });

    it('is the boss for its level', () => {
      expect(getBossForLevel(bossCase.level)).toBe(bossCase.type);
    });

    it('names the mesh root BOSS_<type>', () => {
      expect(rig.mesh.name).toBe(`BOSS_${bossCase.type}`);
    });

    // 全局规则：大型网格在根节点的 userData.hitRadius 声明命中半径（米）
    it('declares userData.hitRadius on the mesh root', () => {
      expect(getDeclaredHitRadius(rig.mesh, -1)).toBeGreaterThan(0);
    });

    it('implements IAdvancedBoss and starts at full health in phase 1 of 3', () => {
      const { boss, mesh, config } = rig;
      expect(isAdvancedBoss(boss)).toBe(true);
      expect(boss.getMesh()).toBe(mesh);
      expect(boss.getConfig()).toBe(config);
      expect(boss.getPosition().equals(mesh.position)).toBe(true);
      expect(boss.getPosition()).not.toBe(mesh.position);
      expect(boss.getHealth()).toEqual({ current: config.health, max: config.health });
      expect(boss.isAlive()).toBe(true);
      expect(boss.getPhase()).toBe(1);
      expect(boss.getPhaseCount()).toBe(3);
      const label = boss.getStatusLabel();
      expect(label === null || typeof label === 'string').toBe(true);
    });

    it('exposes collision parts (once visible) with a declared hit radius and sane multiplier', () => {
      // 只有无敌状态（例如幻影之翼出场即隐形）允许暂时没有可命中部件（integration-notes 记录）
      expect(rig.boss.getCollisionParts().length > 0 || rig.boss.isInvulnerable()).toBe(true);
      let time = 0;
      while (rig.boss.getCollisionParts().length === 0 && time < 15) {
        time += DT;
        movePlayer(rig, bossCase, time);
        rig.boss.update(DT, rig.player, []);
      }
      const parts = rig.boss.getCollisionParts();
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(isUnder(part, rig.scene), `${part.name} is in the scene`).toBe(true);
        expect(getDeclaredHitRadius(part, -1), `${part.name} hitRadius`).toBeGreaterThan(0);
        const multiplier = rig.boss.getDamageMultiplier(part);
        expect(Number.isFinite(multiplier) && multiplier >= 0, `${part.name} ×${multiplier}`).toBe(
          true
        );
      }
    });

    it('owns its own BossMissileSystem (or none)', () => {
      const missiles = rig.boss.getMissileSystem();
      expect(missiles === null || missiles instanceof BossMissileSystem).toBe(true);
    });

    it('checkHazard returns null far from the boss and for a NaN position', () => {
      expect(rig.boss.checkHazard(new THREE.Vector3(9000, 9000, 9000), 6)).toBeNull();
      expect(rig.boss.checkHazard(new THREE.Vector3(Number.NaN, 0, 0), 6)).toBeNull();
    });

    it('stays finite for 8 s with a circling, intermittently absent player', () => {
      const fired: Array<[THREE.Vector3, THREE.Vector3, number]> = [];
      const minions: Array<[THREE.Vector3, BossMinionKind]> = [];
      rig.boss.onFire = (position, direction, damage) => {
        fired.push([position.clone(), direction.clone(), damage]);
      };
      rig.boss.onSpawnMinion = (position, kind) => {
        minions.push([position.clone(), kind]);
      };
      const friendly = new THREE.Object3D();
      friendly.position.set(-150, 140, 150);

      const frames = Math.round(8 / DT);
      for (let frame = 0; frame < frames; frame++) {
        movePlayer(rig, bossCase, frame * DT);
        // 玩家短暂缺席（复活 / 过场）时传 null
        const playerMesh = frame % 50 === 10 ? null : rig.player;
        rig.boss.update(DT, playerMesh, [friendly]);
        expect(isFiniteVector(rig.mesh.position), `frame ${frame}`).toBe(true);
      }

      const health = rig.boss.getHealth();
      expect(Number.isFinite(health.current)).toBe(true);
      const world = new THREE.Vector3();
      for (const part of rig.boss.getCollisionParts()) {
        expect(isFiniteVector(part.getWorldPosition(world)), part.name).toBe(true);
      }
      rig.scene.traverse((object) => {
        expect(isFiniteVector(object.position), `${object.name || object.type}`).toBe(true);
      });
      for (const [position, direction, damage] of fired) {
        expect(isFiniteVector(position) && isFiniteVector(direction)).toBe(true);
        expect(damage).toBeGreaterThan(0);
      }
      for (const [position, kind] of minions) {
        expect(isFiniteVector(position)).toBe(true);
        expect(MINION_KINDS).toContain(kind);
      }
      expect(rig.boss.getPhase()).toBeLessThanOrEqual(rig.boss.getPhaseCount());
    });

    it('keeps a NaN player position out of its own mesh, parts and hazards', () => {
      for (let frame = 0; frame < Math.round(4 / DT); frame++) {
        movePlayer(rig, bossCase, 8 + frame * DT);
        if (frame % 20 === 5) rig.player.position.set(Number.NaN, Number.NaN, Number.NaN);
        rig.boss.update(DT, rig.player, []);
        expect(isFiniteVector(rig.mesh.position), `frame ${frame}`).toBe(true);
      }
      // 来袭导弹由既有的 BossMissileSystem 驱动（不属于本批新模块），单独排除
      const missiles = new Set(rig.boss.getMissileSystem()?.getMissileMeshes() ?? []);
      rig.scene.traverse((object) => {
        let owner: THREE.Object3D | null = object;
        while (owner && !missiles.has(owner)) owner = owner.parent;
        if (owner) return;
        expect(isFiniteVector(object.position), `${object.name || object.type}`).toBe(true);
      });
    });

    it('can be destroyed through its collision parts; onDestroy fires exactly once', () => {
      const onDestroy = vi.fn();
      const phases: number[] = [];
      rig.boss.onDestroy = onDestroy;
      rig.boss.onPhaseChange = (phase) => phases.push(phase);

      hitUntilDead(rig, bossCase, 60);

      expect(rig.boss.isAlive()).toBe(false);
      expect(rig.boss.getHealth().current).toBe(0);
      expect(onDestroy).toHaveBeenCalledTimes(1);
      const [position, config] = onDestroy.mock.calls[0] as [THREE.Vector3, BossConfig];
      expect(isFiniteVector(position)).toBe(true);
      expect(config).toBe(rig.config);
      // 阶段只前进，范围 2..阶段数
      expect([...phases].sort((a, b) => a - b)).toEqual(phases);
      for (const phase of phases) {
        expect(phase).toBeGreaterThanOrEqual(2);
        expect(phase).toBeLessThanOrEqual(rig.boss.getPhaseCount());
      }

      for (const part of rig.boss.getCollisionParts().slice()) rig.boss.takeDamageAt(part, 400);
      rig.boss.update(DT, rig.player, []);
      expect(onDestroy).toHaveBeenCalledTimes(1);
    });

    it('dispose() removes the mesh and every helper object it added', () => {
      expect(countNodes(rig.scene)).toBeGreaterThan(1);
      rig.boss.dispose();
      expect(rig.scene.children).toEqual([]);
      expect(countNodes(rig.scene)).toBe(1);
      expect(rig.mesh.parent).toBeNull();
      expect(() => rig.boss.dispose()).not.toThrow();
      expect(() => rig.boss.update(DT, rig.player, [])).not.toThrow();
      expect(rig.scene.children).toEqual([]);
    });
  });

  describe('invulnerability and the death sequence (one instance, in order)', () => {
    let rig: BossRig;

    beforeAll(() => {
      rig = createBoss(bossCase);
    });

    afterAll(() => {
      rig.boss.dispose();
    });

    it.runIf(bossCase.liveInvulnerability)(
      'ignores takeDamageAt on every part while invulnerable but alive',
      () => {
        let time = 0;
        while (!(rig.boss.isInvulnerable() && rig.boss.isAlive()) && time < 40) {
          time += DT;
          movePlayer(rig, bossCase, time);
          rig.boss.update(DT, rig.player, []);
        }
        expect(rig.boss.isInvulnerable()).toBe(true);
        expect(rig.boss.isAlive()).toBe(true);

        const before = rig.boss.getHealth().current;
        for (const part of rig.boss.getCollisionParts().slice()) {
          rig.boss.takeDamageAt(part, 5000);
        }
        rig.boss.takeDamageAt(rig.mesh, 5000);
        expect(rig.boss.getHealth().current).toBe(before);
      }
    );

    it('with the death sequence on: invulnerable without parts while dying, then onDestroy once', () => {
      const onDestroy = vi.fn();
      rig.boss.onDestroy = onDestroy;
      rig.boss.setDeathSequenceEnabled(true);

      hitUntilDead(rig, bossCase, 60);

      expect(rig.boss.isAlive()).toBe(false);
      expect(rig.boss.isDying()).toBe(true);
      expect(rig.boss.isInvulnerable()).toBe(true);
      expect(rig.boss.getCollisionParts()).toHaveLength(0);
      expect(onDestroy).not.toHaveBeenCalled();
      rig.boss.takeDamageAt(rig.mesh, 1000);
      expect(rig.boss.getHealth().current).toBe(0);

      for (let i = 0; i < Math.round(10 / DT) && onDestroy.mock.calls.length === 0; i++) {
        rig.boss.update(DT, rig.player, []);
      }
      expect(onDestroy).toHaveBeenCalledTimes(1);
      expect(rig.boss.isDying()).toBe(false);
      rig.boss.update(DT, rig.player, []);
      expect(onDestroy).toHaveBeenCalledTimes(1);
      rig.boss.dispose();
      expect(rig.scene.children).toEqual([]);
    });
  });
});
