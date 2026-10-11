import * as THREE from 'three';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { CombatTarget } from '@/core/CombatContracts';
import { getDifficultyProfile, getLevelScaling } from '@/core/Difficulty';
import { BOSS_CONFIGS, BossType, getBossForLevel } from '@/features/boss/BossTypes';
import { UnitSystem } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UnitType } from '@/features/units/UnitTypes';
import { WeaponSystem, type WeaponMuzzle } from '@/features/weapons/WeaponSystem';
import {
  TargetSnapshotBuffer,
  applySplashDamage,
  resolveTargetHitRadius,
} from '@/features/weapons/WeaponTargeting';
import { getSpecialWeaponStats } from '@/features/weapons/WeaponTypes';
import {
  CONTRACT_ROCKET_FACTOR_AIR,
  CONTRACT_ROCKET_FACTOR_BOSS,
  SEA_SURFACE,
  seededRandom,
  splashFalloff,
  startBossRig,
  type BossRig,
} from './rocketBalanceRig';

/**
 * 火箭平衡修正（集成级）：真实 Boss（BossBattleController 包装的部件目标）、真实单位
 * （UnitSystem 的轰炸机 / 坦克 / 护卫舰）与真实 WeaponSystem 齐射。
 * 验收：第 2 关沙漠堡垒（普通 2800 血）一个 R2 弹匣满中最多掉 720 血；一枚火箭在多个部件间
 * 爆炸只改变一次 Boss 血量；高级 Boss 弱点倍率照常生效；轰炸机在第 5 / 10 关扛得住一轮 R5 齐射；
 * 坦克 / 护卫舰吃到的火箭伤害不变。
 * 跟进：自带血池、不扣 Boss 主血池的子目标（利维坦水雷、神谕护盾塔）是独立目标——各自结算、
 * 火箭 × 1.0；八爪鱼战舰的眼睛被特殊武器命中时扣的是主血池，所以仍算 Boss 部件。
 */

const DT = 1 / 30;
const R2 = getSpecialWeaponStats('rockets', 2);
const R5 = getSpecialWeaponStats('rockets', 5);
/** 普通难度（默认档）：血量倍率 1 */
const NORMAL = getDifficultyProfile(3);

interface PartInRange {
  target: CombatTarget;
  amount: number;
}

function snapshotOf(targets: readonly CombatTarget[]): TargetSnapshotBuffer {
  const snapshot = new TargetSnapshotBuffer();
  snapshot.capture(targets);
  return snapshot;
}

function worldPosition(target: CombatTarget): THREE.Vector3 {
  return target.mesh.getWorldPosition(new THREE.Vector3());
}

/** 现有溅射规则下每个部件本应受到的伤害（未乘系数、未去重）；direct 吃满 */
function partsInRange(
  parts: readonly CombatTarget[],
  center: THREE.Vector3,
  damage: number,
  splash: number,
  direct: CombatTarget | null
): PartInRange[] {
  const out: PartInRange[] = [];
  for (const target of parts) {
    if (target === direct) {
      out.push({ target, amount: damage });
      continue;
    }
    const surface = Math.max(
      0,
      worldPosition(target).distanceTo(center) - resolveTargetHitRadius(target)
    );
    if (surface <= splash) out.push({ target, amount: damage * splashFalloff(surface, splash) });
  }
  return out;
}

function bossHealth(rig: BossRig): number {
  return rig.boss.getHealth().current;
}

/** 让武器系统的 -Z 机头对准 target */
function aimedMuzzle(from: THREE.Vector3, target: THREE.Vector3): WeaponMuzzle {
  const rotation = new THREE.Matrix4().lookAt(from, target, new THREE.Vector3(0, 1, 0));
  return {
    position: from.clone(),
    quaternion: new THREE.Quaternion().setFromRotationMatrix(rotation),
  };
}

function run(weapons: WeaponSystem, seconds: number, muzzle: WeaponMuzzle): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) weapons.update(DT, muzzle);
}

function tap(weapons: WeaponSystem, muzzle: WeaponMuzzle): void {
  weapons.setTriggerHeld(true);
  weapons.update(DT, muzzle);
  weapons.setTriggerHeld(false);
  weapons.update(DT, muzzle);
}

describe('rockets vs the level 2 Desert Fortress (Normal, 2800 HP)', () => {
  let rig: BossRig | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
  });

  async function startFortress(): Promise<BossRig> {
    expect(getBossForLevel(2)).toBe(BossType.DESERT_FORTRESS);
    rig = await startBossRig(2);
    expect(rig.boss.getHealth()).toEqual({
      current: BOSS_CONFIGS[BossType.DESERT_FORTRESS].health,
      max: 2800,
    });
    expect(rig.parts().length).toBeGreaterThan(3);
    return rig;
  }

  it('an R2 rocket bursting on any fortress part takes 0.6 × its damage off the boss, once', async () => {
    const fortress = await startFortress();
    const expected = R2.damage * CONTRACT_ROCKET_FACTOR_BOSS;
    for (const part of fortress.parts()) {
      const center = worldPosition(part);
      const before = bossHealth(fortress);
      applySplashDamage(
        snapshotOf(fortress.targets()),
        center,
        R2.splashRadius,
        R2.damage,
        'rocket',
        part
      );
      expect(before - bossHealth(fortress), `rocket on ${part.mesh.name}`).toBeCloseTo(expected, 6);
    }
    expect(fortress.boss.isAlive()).toBe(true);
  });

  it('one rocket among several fortress parts changes the boss HP exactly once', async () => {
    const fortress = await startFortress();
    const parts = fortress.parts();
    const citadel = parts.find((part) => part.mesh.name === 'fortress_citadel') ?? parts[0];
    const center = worldPosition(citadel);
    // 前提：这一爆点的溅射范围里有多个部件（基线版本会逐个扣同一份 Boss 血量）
    expect(partsInRange(parts, center, R2.damage, R2.splashRadius, citadel).length).toBeGreaterThan(
      2
    );

    const takeDamage = vi.spyOn(fortress.boss, 'takeDamage');
    const before = bossHealth(fortress);
    applySplashDamage(
      snapshotOf(fortress.targets()),
      center,
      R2.splashRadius,
      R2.damage,
      'rocket',
      citadel
    );
    expect(takeDamage).toHaveBeenCalledTimes(1);
    expect(before - bossHealth(fortress)).toBeCloseTo(R2.damage * CONTRACT_ROCKET_FACTOR_BOSS, 6);
  });

  it('a rocket bursting between parts (no direct hit) takes only the best part at × 0.6', async () => {
    const fortress = await startFortress();
    const parts = fortress.parts();
    const citadel = parts.find((part) => part.mesh.name === 'fortress_citadel') ?? parts[0];
    // 城楼上方：落在命中球外，靠衰减命中
    const center = worldPosition(citadel).add(
      new THREE.Vector3(0, resolveTargetHitRadius(citadel) + 4, 0)
    );
    const inRange = partsInRange(parts, center, R2.damage, R2.splashRadius, null);
    expect(inRange.length, 'parts in splash range').toBeGreaterThan(1);
    const best = Math.max(...inRange.map((entry) => entry.amount));

    const takeDamage = vi.spyOn(fortress.boss, 'takeDamage');
    const before = bossHealth(fortress);
    applySplashDamage(
      snapshotOf(fortress.targets()),
      center,
      R2.splashRadius,
      R2.damage,
      'rocket',
      null
    );
    expect(takeDamage).toHaveBeenCalledTimes(1);
    expect(before - bossHealth(fortress)).toBeCloseTo(best * CONTRACT_ROCKET_FACTOR_BOSS, 6);
  });

  it('a swarm missile bursting on a fortress part takes exactly its own damage (no factor)', async () => {
    const fortress = await startFortress();
    const swarm = getSpecialWeaponStats('swarm', 2);
    const parts = fortress.parts();
    const citadel = parts.find((part) => part.mesh.name === 'fortress_citadel') ?? parts[0];
    const center = worldPosition(citadel);
    expect(
      partsInRange(parts, center, swarm.damage, swarm.splashRadius, citadel).length
    ).toBeGreaterThan(1);

    const before = bossHealth(fortress);
    applySplashDamage(
      snapshotOf(fortress.targets()),
      center,
      swarm.splashRadius,
      swarm.damage,
      'swarm',
      citadel
    );
    expect(before - bossHealth(fortress)).toBeCloseTo(swarm.damage, 6);
  });

  it('one R2 magazine of salvos on target takes at most 5 × 8 × 30 × 0.6 = 720 HP', async () => {
    const fortress = await startFortress();
    const body =
      fortress.parts().find((part) => part.mesh.name === 'fortress_body') ?? fortress.parts()[0];
    const aimPoint = worldPosition(body);
    const muzzle = aimedMuzzle(aimPoint.clone().add(new THREE.Vector3(0, 80, 160)), aimPoint);
    const ceiling = R2.maxAmmo * R2.projectileCount * R2.damage * CONTRACT_ROCKET_FACTOR_BOSS;
    expect(ceiling).toBeCloseTo(720, 9);

    const weapons = new WeaponSystem(null, null);
    try {
      weapons.setUpgradeLevel('rockets', 2);
      weapons.setUnlocked(['rockets']);
      weapons.setTargetProvider(() => fortress.targets());
      const onFired = vi.fn();
      const impacts: THREE.Vector3[] = [];
      weapons.onFired = onFired;
      weapons.onImpact = (_id, position) => impacts.push(position.clone());

      const before = bossHealth(fortress);
      for (let salvo = 0; salvo < R2.maxAmmo; salvo++) {
        tap(weapons, muzzle);
        run(weapons, R2.cooldown + 0.05, muzzle);
      }
      run(weapons, 3, muzzle);

      expect(onFired).toHaveBeenCalledTimes(R2.maxAmmo);
      // 每一枚火箭都在 Boss 身上引爆（离瞄准点不远），没有飞空
      expect(impacts).toHaveLength(R2.maxAmmo * R2.projectileCount);
      for (const point of impacts) expect(point.distanceTo(aimPoint)).toBeLessThan(60);

      const dealt = before - bossHealth(fortress);
      expect(dealt, 'magazine damage').toBeLessThanOrEqual(ceiling + 1e-6);
      // 每枚火箭至少吃到溅射边缘的 40%：确认真的命中了
      expect(dealt).toBeGreaterThanOrEqual(ceiling * 0.4);
      expect(fortress.boss.isAlive()).toBe(true);
      expect(bossHealth(fortress)).toBeGreaterThanOrEqual(2800 - ceiling - 1e-6);
    } finally {
      weapons.dispose();
    }
  });
});

describe('rockets vs an advanced boss (level 6 Magma Colossus)', () => {
  let rig: BossRig | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
  });

  type WithMultiplier = { getDamageMultiplier(part: THREE.Object3D): number };

  async function startColossus(): Promise<{ colossus: BossRig; multiplier: WithMultiplier }> {
    expect(getBossForLevel(6)).toBe(BossType.MAGMA_COLOSSUS);
    rig = await startBossRig(6);
    const multiplier = rig.boss as unknown as WithMultiplier;
    expect(typeof multiplier.getDamageMultiplier).toBe('function');
    return { colossus: rig, multiplier };
  }

  it('a rocket on the weak spot still multiplies: drop = damage × 0.6 × weak-spot multiplier', async () => {
    const { colossus, multiplier } = await startColossus();
    const parts = colossus.parts();
    const weakSpot = parts.find((part) => multiplier.getDamageMultiplier(part.mesh) > 1.05);
    expect(weakSpot, 'a weak spot is exposed at the start of the fight').toBeDefined();
    const weak = weakSpot as CombatTarget;
    const weakMultiplier = multiplier.getDamageMultiplier(weak.mesh);

    // 爆点放在弱点命中球内、远离其他部件的一侧，保证弱点（直接命中）严格吃最多
    const weakCenter = worldPosition(weak);
    const away = new THREE.Vector3();
    for (const part of parts) {
      if (part === weak) continue;
      const offset = weakCenter.clone().sub(worldPosition(part));
      const length = offset.length();
      if (length > 1e-6) away.addScaledVector(offset, 1 / (length * length));
    }
    if (away.lengthSq() < 1e-12) away.set(0, 0, 1);
    const center = weakCenter
      .clone()
      .addScaledVector(away.normalize(), resolveTargetHitRadius(weak) * 0.9);
    const inRange = partsInRange(parts, center, R2.damage, R2.splashRadius, weak);
    const others = inRange.filter((entry) => entry.target !== weak);
    for (const other of others) {
      expect(other.amount, `${other.target.mesh.name} below the weak spot`).toBeLessThan(R2.damage);
    }

    const before = bossHealth(colossus);
    applySplashDamage(
      snapshotOf(colossus.targets()),
      center,
      R2.splashRadius,
      R2.damage,
      'rocket',
      weak
    );
    expect(before - bossHealth(colossus)).toBeCloseTo(
      R2.damage * CONTRACT_ROCKET_FACTOR_BOSS * weakMultiplier,
      6
    );
  });

  it('a rocket on an isolated armour part still uses that part multiplier', async () => {
    const { colossus, multiplier } = await startColossus();
    const parts = colossus.parts();
    // 只有自己在范围内的装甲部件（腿部关节）：去重与否结果相同，只看系数 × 部件倍率
    const isolated = parts.find((part) => {
      const inRange = partsInRange(parts, worldPosition(part), R2.damage, R2.splashRadius, part);
      const value = multiplier.getDamageMultiplier(part.mesh);
      return inRange.length === 1 && value > 0 && value < 1;
    });
    expect(isolated, 'an isolated armour part').toBeDefined();
    const armour = isolated as CombatTarget;

    const before = bossHealth(colossus);
    applySplashDamage(
      snapshotOf(colossus.targets()),
      worldPosition(armour),
      R2.splashRadius,
      R2.damage,
      'rocket',
      armour
    );
    expect(before - bossHealth(colossus)).toBeCloseTo(
      R2.damage * CONTRACT_ROCKET_FACTOR_BOSS * multiplier.getDamageMultiplier(armour.mesh),
      6
    );
  });
});

/**
 * 主血池之外的 Boss 子目标（C4 跟进决定）：只有扣 Boss 主血池的部件算“Boss”（一次爆炸只结算一次、
 * 火箭 × 0.6）；自带血池、不扣主血池的子目标是独立目标——范围内每个都按自己的衰减结算，火箭 × 1.0。
 * 测试只通过真实 Boss（BossBattleController 包装的目标）找这些子目标，不依赖实现怎么标记它们：
 * 子目标靠真实网格名识别，血量靠 Boss 自己的公开接口（主血量、子目标血条、水雷是否还在）观察。
 */
const MINE_MESH_PREFIX = 'leviathan_mine_body';
const PYLON_MESH_PREFIX = 'oracle_pylon_crystal';
const EYE_MESH_PREFIX = 'boss_eye_';
/** 利维坦水雷血量（AbyssalLeviathanAI mineSpec.health） */
const MINE_HEALTH = 30;
/** 预先把水雷打到“本次应受伤害 ± MARGIN”的余血，用是否被清除夹住实际伤害 */
const MARGIN = 0.25;

/** 第 6-10 关 Boss 的公开接口（IAdvancedBoss） */
interface AdvancedBossView {
  getDamageMultiplier(part: THREE.Object3D): number;
  isInvulnerable(): boolean;
}

function isNamed(prefix: string): (target: CombatTarget) => boolean {
  return (target) => target.mesh.name.startsWith(prefix);
}

/** 把真实部件挪到世界坐标 world（只改它自己的局部位置；之后测试不再推进 Boss AI） */
function placeAt(target: CombatTarget, world: THREE.Vector3): void {
  const mesh = target.mesh;
  const parent = mesh.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    mesh.position.copy(parent.worldToLocal(world.clone()));
  } else {
    mesh.position.copy(world);
  }
  mesh.updateMatrixWorld(true);
}

/** 只打直接目标：溅射半径 0 的蜂群命中（系数 1，不波及其他目标） */
function hitOnly(rig: BossRig, target: CombatTarget, amount: number): void {
  applySplashDamage(snapshotOf(rig.targets()), worldPosition(target), 0, amount, 'swarm', target);
}

describe('rockets vs Leviathan mines (own 30 HP pool, independent of the boss)', () => {
  let rig: BossRig | null = null;
  let randomSpy: MockInstance<() => number> | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  /**
   * 第 7 关利维坦打到第二阶段（≤ 66% 血）后会一次布 6 枚雷；推进 AI 直到至少 count 枚水雷可命中、
   * 且利维坦浮在水面（不在潜航无敌中，主血池部件可命中）。
   */
  async function layMines(count: number): Promise<{ leviathan: BossRig; mines: CombatTarget[] }> {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(7007));
    expect(getBossForLevel(7)).toBe(BossType.ABYSSAL_LEVIATHAN);
    const leviathan = await startBossRig(7, 3, SEA_SURFACE);
    rig = leviathan;
    const view = leviathan.boss as unknown as AdvancedBossView;
    leviathan.boss.takeDamage(leviathan.boss.getHealth().max * 0.36);
    let mines: CombatTarget[] = [];
    for (let frame = 0; frame < 60 * 30; frame++) {
      leviathan.controller.update(1 / 30);
      // 新水雷要再过一帧才归控制器所有（isAlive 为 true）
      mines = leviathan.parts().filter((part) => isNamed(MINE_MESH_PREFIX)(part) && part.isAlive());
      if (mines.length >= count && !view.isInvulnerable()) break;
    }
    expect(mines.length, `a phase 2 Leviathan lays ${count} mines`).toBeGreaterThanOrEqual(count);
    expect(view.isInvulnerable(), 'the Leviathan is surfaced').toBe(false);
    return { leviathan, mines };
  }

  /** 把水雷放在爆点 center 外 surface 米（表面距离），并预先打到余血 remaining */
  function setMine(
    leviathan: BossRig,
    mine: CombatTarget,
    center: THREE.Vector3,
    direction: THREE.Vector3,
    surface: number,
    remaining: number
  ): void {
    const distance = resolveTargetHitRadius(mine) + surface;
    placeAt(mine, center.clone().addScaledVector(direction.clone().normalize(), distance));
    hitOnly(leviathan, mine, MINE_HEALTH - remaining);
    expect(mine.isAlive(), `${mine.mesh.name} alive at ${remaining.toFixed(2)} HP`).toBe(true);
  }

  it('a mine has 30 HP of its own and never drains the boss HP (29 leaves it, 30 clears it)', async () => {
    const { leviathan, mines } = await layMines(1);
    const mine = mines[0];
    const bossBefore = bossHealth(leviathan);

    hitOnly(leviathan, mine, MINE_HEALTH - 1);
    expect(mine.isAlive(), 'mine survives 29').toBe(true);
    hitOnly(leviathan, mine, 1);
    expect(mine.isAlive(), 'mine cleared at 30').toBe(false);
    expect(bossHealth(leviathan)).toBe(bossBefore);
  });

  it('one R2 rocket direct hit clears a 30 HP mine', async () => {
    const { leviathan, mines } = await layMines(1);
    const mine = mines[0];
    applySplashDamage(
      snapshotOf(leviathan.targets()),
      worldPosition(mine),
      R2.splashRadius,
      R2.damage,
      'rocket',
      mine
    );
    expect(mine.isAlive(), 'mine cleared by one R2 rocket').toBe(false);
  });

  it('one rocket blast among four mines damages each mine by its own falloff, at × 1.0', async () => {
    const { leviathan, mines } = await layMines(4);
    const bossBefore = bossHealth(leviathan);
    // 爆点在第一枚水雷上空 60 米：远离利维坦本体，范围内只有水雷
    const center = worldPosition(mines[0]).add(new THREE.Vector3(0, 60, 0));
    const amountAt = (surface: number): number =>
      R2.damage * splashFalloff(surface, R2.splashRadius);
    // 前三枚预先打到“比本次应受伤害少一点”（应被清除），第四枚打到“多一点”（应幸存）
    const layout: Array<[THREE.Vector3, number, number]> = [
      [new THREE.Vector3(1, 0, 0), 2, amountAt(2) - MARGIN],
      [new THREE.Vector3(0, 0, 1), 5, amountAt(5) - MARGIN],
      [new THREE.Vector3(-1, 0, 0), 8, amountAt(8) - MARGIN],
      [new THREE.Vector3(0, 0, -1), 5, amountAt(5) + MARGIN],
    ];
    layout.forEach(([direction, surface, remaining], index) =>
      setMine(leviathan, mines[index], center, direction, surface, remaining)
    );
    const placed = mines.slice(0, 4);
    const others = leviathan.parts().filter((part) => !placed.includes(part));
    expect(
      partsInRange(others, center, R2.damage, R2.splashRadius, null),
      'only the four mines are in range'
    ).toEqual([]);

    applySplashDamage(
      snapshotOf(leviathan.targets()),
      center,
      R2.splashRadius,
      R2.damage,
      'rocket',
      null
    );

    expect(mines[0].isAlive(), 'mine at 2 m took its full falloff').toBe(false);
    expect(mines[1].isAlive(), 'mine at 5 m took its full falloff').toBe(false);
    expect(mines[2].isAlive(), 'mine at 8 m took its full falloff').toBe(false);
    expect(mines[3].isAlive(), 'mine at 5 m took no more than its falloff').toBe(true);
    expect(bossHealth(leviathan)).toBe(bossBefore);
  });

  it('a blast on a hull part beside two mines drains the boss once at × 0.6 and each mine at × 1.0', async () => {
    const { leviathan, mines } = await layMines(2);
    const view = leviathan.boss as unknown as AdvancedBossView;
    const mainParts = leviathan.parts().filter((part) => !isNamed(MINE_MESH_PREFIX)(part));
    const hull = mainParts.find((part) => part.mesh.name === 'leviathan_propulsor') ?? mainParts[0];
    const center = worldPosition(hull);
    // 前提：本体部件里不止一个在范围内，且直接命中的部件严格吃最多
    const inRange = partsInRange(mainParts, center, R2.damage, R2.splashRadius, hull);
    expect(inRange.length, 'main-pool parts in range').toBeGreaterThan(1);
    for (const entry of inRange) {
      if (entry.target === hull) continue;
      expect(entry.amount, entry.target.mesh.name).toBeLessThan(R2.damage);
    }
    const multiplier = view.getDamageMultiplier(hull.mesh);
    expect(multiplier).toBeGreaterThan(0);

    const surface = 4;
    const amount = R2.damage * splashFalloff(surface, R2.splashRadius);
    setMine(leviathan, mines[0], center, new THREE.Vector3(0, 1, 0), surface, amount - MARGIN);
    setMine(leviathan, mines[1], center, new THREE.Vector3(0, 1, 1), surface, amount + MARGIN);
    const bossBefore = bossHealth(leviathan);

    applySplashDamage(
      snapshotOf(leviathan.targets()),
      center,
      R2.splashRadius,
      R2.damage,
      'rocket',
      hull
    );

    expect(bossBefore - bossHealth(leviathan), 'main pool once at × 0.6').toBeCloseTo(
      R2.damage * CONTRACT_ROCKET_FACTOR_BOSS * multiplier,
      6
    );
    expect(mines[0].isAlive(), 'mine took its full falloff').toBe(false);
    expect(mines[1].isAlive(), 'mine took no more than its falloff').toBe(true);
  });
});

describe('rockets vs Oracle Prime shield pylons (own HP pools, independent of the boss)', () => {
  let rig: BossRig | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
  });

  async function startOracle(): Promise<{ oracle: BossRig; pylons: CombatTarget[] }> {
    expect(getBossForLevel(10)).toBe(BossType.ORACLE_PRIME);
    const oracle = await startBossRig(10);
    rig = oracle;
    const pylons = oracle.parts().filter(isNamed(PYLON_MESH_PREFIX));
    expect(pylons.length, 'the fight opens with shield pylons').toBeGreaterThanOrEqual(2);
    return { oracle, pylons };
  }

  /** 子目标血条（护盾塔）：网格 → 当前血量 */
  function pylonHealth(oracle: BossRig): Map<THREE.Object3D, number> {
    const bars = new Map<THREE.Object3D, number>();
    oracle.controller.forEachSubTargetBar((mesh, current) => bars.set(mesh, current));
    return bars;
  }

  function multiplierOf(oracle: BossRig, pylon: CombatTarget): number {
    return (oracle.boss as unknown as AdvancedBossView).getDamageMultiplier(pylon.mesh);
  }

  it('a pylon has its own health bar and never drains the boss HP', async () => {
    const { oracle, pylons } = await startOracle();
    const bars = pylonHealth(oracle);
    for (const pylon of pylons) expect(bars.has(pylon.mesh), pylon.mesh.name).toBe(true);
    const bossBefore = bossHealth(oracle);
    const pylonBefore = bars.get(pylons[0].mesh) ?? 0;

    hitOnly(oracle, pylons[0], 10);

    const pylonAfter = pylonHealth(oracle).get(pylons[0].mesh) ?? 0;
    expect(pylonBefore - pylonAfter).toBeCloseTo(10 * multiplierOf(oracle, pylons[0]), 6);
    expect(bossHealth(oracle)).toBe(bossBefore);
  });

  it('an R2 rocket direct hit on a pylon takes its full damage off that pylon (× 1.0)', async () => {
    const { oracle, pylons } = await startOracle();
    const pylon = pylons[0];
    const multiplier = multiplierOf(oracle, pylon);
    expect(multiplier).toBeGreaterThan(0);
    const before = pylonHealth(oracle);
    const bossBefore = bossHealth(oracle);

    applySplashDamage(
      snapshotOf(oracle.targets()),
      worldPosition(pylon),
      R2.splashRadius,
      R2.damage,
      'rocket',
      pylon
    );

    const after = pylonHealth(oracle);
    expect((before.get(pylon.mesh) ?? 0) - (after.get(pylon.mesh) ?? 0)).toBeCloseTo(
      R2.damage * multiplier,
      6
    );
    for (const other of pylons.slice(1)) {
      expect(after.get(other.mesh), other.mesh.name).toBe(before.get(other.mesh));
    }
    expect(bossHealth(oracle)).toBe(bossBefore);
  });

  it('one R5 rocket blast between two pylons damages each by its own falloff, at × 1.0', async () => {
    const { oracle, pylons } = await startOracle();
    // 取距离最近的一对护盾塔，爆点在两者中点
    let pair: [CombatTarget, CombatTarget] = [pylons[0], pylons[1]];
    let closest = Infinity;
    for (let i = 0; i < pylons.length; i++) {
      for (let j = i + 1; j < pylons.length; j++) {
        const distance = worldPosition(pylons[i]).distanceTo(worldPosition(pylons[j]));
        if (distance < closest) {
          closest = distance;
          pair = [pylons[i], pylons[j]];
        }
      }
    }
    const center = worldPosition(pair[0]).add(worldPosition(pair[1])).multiplyScalar(0.5);
    const expected = pair.map((pylon) => {
      const surface = Math.max(
        0,
        worldPosition(pylon).distanceTo(center) - resolveTargetHitRadius(pylon)
      );
      expect(surface, `${pylon.mesh.name} within R5 splash`).toBeLessThanOrEqual(R5.splashRadius);
      return R5.damage * splashFalloff(surface, R5.splashRadius) * multiplierOf(oracle, pylon);
    });
    const before = pylonHealth(oracle);
    const bossBefore = bossHealth(oracle);

    applySplashDamage(
      snapshotOf(oracle.targets()),
      center,
      R5.splashRadius,
      R5.damage,
      'rocket',
      null
    );

    const after = pylonHealth(oracle);
    pair.forEach((pylon, index) => {
      const dealt = (before.get(pylon.mesh) ?? 0) - (after.get(pylon.mesh) ?? 0);
      expect(dealt, pylon.mesh.name).toBeCloseTo(expected[index], 6);
    });
    expect(bossHealth(oracle)).toBe(bossBefore);
  });
});

describe('rockets vs Octopus Warship eyes (special-weapon hits drain the main pool)', () => {
  let rig: BossRig | null = null;
  let randomSpy: MockInstance<() => number> | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  async function startOctopus(): Promise<{ octopus: BossRig; eye: CombatTarget }> {
    expect(getBossForLevel(3)).toBe(BossType.OCTOPUS_WARSHIP);
    const octopus = await startBossRig(3, 3, SEA_SURFACE);
    rig = octopus;
    // 受击有 5% 概率瞬移（网格隐藏 + 定时器）：固定随机数，不让它瞬移
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const eye = octopus.parts().find(isNamed(EYE_MESH_PREFIX));
    expect(eye, 'the octopus shows its eyes').toBeDefined();
    return { octopus, eye: eye as CombatTarget };
  }

  it('special-weapon damage on an eye comes off the boss main HP (an eye is a main-pool part)', async () => {
    const { octopus, eye } = await startOctopus();
    const before = bossHealth(octopus);
    hitOnly(octopus, eye, 10);
    expect(before - bossHealth(octopus)).toBeCloseTo(10, 6);
  });

  it('a rocket on an eye beside the hull drains the main pool once at × 0.6', async () => {
    const { octopus, eye } = await startOctopus();
    const center = worldPosition(eye);
    const inRange = partsInRange(octopus.parts(), center, R2.damage, R2.splashRadius, eye);
    expect(inRange.length, 'eye and hull parts in range').toBeGreaterThan(1);
    const takeDamage = vi.spyOn(octopus.boss, 'takeDamage');
    const before = bossHealth(octopus);

    applySplashDamage(
      snapshotOf(octopus.targets()),
      center,
      R2.splashRadius,
      R2.damage,
      'rocket',
      eye
    );

    expect(takeDamage).toHaveBeenCalledTimes(1);
    expect(before - bossHealth(octopus)).toBeCloseTo(R2.damage * CONTRACT_ROCKET_FACTOR_BOSS, 6);
  });
});

describe('rockets vs real units', () => {
  let units: UnitSystem | null = null;

  afterEach(() => {
    units?.dispose();
    units = null;
  });

  function unitsAtLevel(level: number): UnitSystem {
    const base = getLevelScaling(level);
    const system = new UnitSystem(new THREE.Scene(), null);
    // 与 UnitController.setLevel 相同：关卡曲线 × 难度档（普通 = 1）
    system.setLevelScaling({
      ...base,
      unitHealthMultiplier: base.unitHealthMultiplier * NORMAL.enemyHealthMultiplier,
    });
    units = system;
    return system;
  }

  function spawnTarget(system: UnitSystem, type: UnitType, position: THREE.Vector3): CombatTarget {
    const unit = system.spawnUnit(type, position);
    expect(unit, `spawnUnit(${type})`).not.toBeNull();
    const target = system.getCombatTargets().find((candidate) => candidate.id === unit?.id);
    expect(target, `${type} is a combat target`).toBeDefined();
    return target as CombatTarget;
  }

  function healthOf(system: UnitSystem, target: CombatTarget): number {
    const unit = system.getUnits().find((candidate) => candidate.id === target.id);
    return unit ? unit.getHealth().current : 0;
  }

  describe.each([5, 10])('a BOMBER at level %i', (level) => {
    const bomberHealth =
      UNIT_CONFIGS[UnitType.BOMBER].health * getLevelScaling(level).unitHealthMultiplier;

    it('has the Normal level health and is an air target', () => {
      const system = unitsAtLevel(level);
      const bomber = spawnTarget(system, UnitType.BOMBER, new THREE.Vector3(0, 300, -150));
      expect(bomber.kind).toBe('air');
      expect(healthOf(system, bomber)).toBeCloseTo(bomberHealth, 6);
      expect(bomberHealth).toBeGreaterThan(450);
    });

    it('survives one R5 salvo of perfect direct hits (12 × 40 × 0.5 = 240)', () => {
      const system = unitsAtLevel(level);
      const bomber = spawnTarget(system, UnitType.BOMBER, new THREE.Vector3(0, 300, -150));
      const before = healthOf(system, bomber);
      for (let rocket = 0; rocket < R5.projectileCount; rocket++) {
        applySplashDamage(
          snapshotOf(system.getCombatTargets()),
          worldPosition(bomber),
          R5.splashRadius,
          R5.damage,
          'rocket',
          bomber
        );
      }
      expect(bomber.isAlive()).toBe(true);
      expect(before - healthOf(system, bomber)).toBeCloseTo(
        R5.projectileCount * R5.damage * CONTRACT_ROCKET_FACTOR_AIR,
        6
      );
    });

    it('survives one real R5 salvo fired straight at it', () => {
      const system = unitsAtLevel(level);
      const bomber = spawnTarget(system, UnitType.BOMBER, new THREE.Vector3(0, 300, -150));
      const aimPoint = worldPosition(bomber);
      const muzzle = aimedMuzzle(aimPoint.clone().add(new THREE.Vector3(0, 0, 150)), aimPoint);
      const weapons = new WeaponSystem(null, null);
      try {
        weapons.setUpgradeLevel('rockets', 5);
        weapons.setUnlocked(['rockets']);
        weapons.setTargetProvider(() => system.getCombatTargets());
        const impacts: THREE.Vector3[] = [];
        weapons.onImpact = (_id, position) => impacts.push(position.clone());
        const before = healthOf(system, bomber);

        tap(weapons, muzzle);
        run(weapons, 2.5, muzzle);

        expect(impacts).toHaveLength(R5.projectileCount);
        const dealt = before - healthOf(system, bomber);
        expect(bomber.isAlive()).toBe(true);
        expect(dealt).toBeGreaterThan(0);
        expect(dealt).toBeLessThanOrEqual(
          R5.projectileCount * R5.damage * CONTRACT_ROCKET_FACTOR_AIR + 1e-6
        );
      } finally {
        weapons.dispose();
      }
    });
  });

  it.each([UnitType.TANK, UnitType.FRIGATE])(
    'rocket damage to a %s is the table value direct and the falloff formula in splash',
    (type) => {
      for (const upgrade of [0, 2, 5]) {
        const stats = getSpecialWeaponStats('rockets', upgrade);
        const system = unitsAtLevel(5);
        const unit = spawnTarget(system, type, new THREE.Vector3(0, 0, 0));
        expect(unit.kind === 'ground' || unit.kind === 'sea', `${type} kind ${unit.kind}`).toBe(
          true
        );
        const center = worldPosition(unit);

        let before = healthOf(system, unit);
        applySplashDamage(
          snapshotOf(system.getCombatTargets()),
          center,
          stats.splashRadius,
          stats.damage,
          'rocket',
          unit
        );
        expect(before - healthOf(system, unit), `${type} direct R${upgrade}`).toBeCloseTo(
          stats.damage,
          6
        );

        // 爆点在命中球外 4 米：表面距离 4 米
        const surface = 4;
        const splashCenter = center
          .clone()
          .add(new THREE.Vector3(resolveTargetHitRadius(unit) + surface, 0, 0));
        before = healthOf(system, unit);
        applySplashDamage(
          snapshotOf(system.getCombatTargets()),
          splashCenter,
          stats.splashRadius,
          stats.damage,
          'rocket',
          null
        );
        expect(before - healthOf(system, unit), `${type} splash R${upgrade}`).toBeCloseTo(
          stats.damage * splashFalloff(surface, stats.splashRadius),
          6
        );
        system.dispose();
        units = null;
      }
    }
  );
});
