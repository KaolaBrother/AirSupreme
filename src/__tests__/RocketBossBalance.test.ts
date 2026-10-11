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

describe('rockets vs Leviathan mines (independent sub-targets of kind boss-part)', () => {
  let rig: BossRig | null = null;
  let randomSpy: MockInstance<() => number> | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  /** 第 7 关利维坦打到第二阶段（≤ 66% 血）后会布雷；推进 AI 直到第一枚水雷成为可命中目标 */
  async function layMine(): Promise<{ leviathan: BossRig; mine: CombatTarget }> {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(7007));
    expect(getBossForLevel(7)).toBe(BossType.ABYSSAL_LEVIATHAN);
    const leviathan = await startBossRig(7, 3, SEA_SURFACE);
    rig = leviathan;
    leviathan.boss.takeDamage(leviathan.boss.getHealth().max * 0.36);
    let mine: CombatTarget | undefined;
    for (let frame = 0; frame < 40 * 30 && !mine; frame++) {
      leviathan.controller.update(1 / 30);
      // 新水雷要再过一帧才归控制器所有（isAlive 为 true）
      mine = leviathan
        .parts()
        .find((part) => part.mesh.name.startsWith('leviathan_mine_body') && part.isAlive());
    }
    expect(mine, 'a phase 2 Leviathan lays a mine within 40 s').toBeDefined();
    return { leviathan, mine: mine as CombatTarget };
  }

  function burstOn(
    leviathan: BossRig,
    mine: CombatTarget,
    damage: number,
    source: 'rocket' | 'swarm'
  ): void {
    applySplashDamage(
      snapshotOf(leviathan.targets()),
      worldPosition(mine),
      R2.splashRadius,
      damage,
      source,
      mine
    );
  }

  it('a mine is a boss-part target with 30 HP of its own (29 swarm damage leaves it, 30 clears it)', async () => {
    const { leviathan, mine } = await layMine();
    expect(mine.kind).toBe('boss-part');
    const bossBefore = bossHealth(leviathan);

    expect(mine.isAlive(), 'fresh mine').toBe(true);
    burstOn(leviathan, mine, 29, 'swarm');
    expect(mine.isAlive(), 'mine survives 29').toBe(true);
    burstOn(leviathan, mine, 1, 'swarm');
    expect(mine.isAlive(), 'mine cleared at 30').toBe(false);
    // 水雷有自己的血量：打水雷不扣 Boss 血
    expect(bossHealth(leviathan)).toBe(bossBefore);
  });

  // FINDING: Leviathan mines are 'boss-part' combat targets with their own 30 HP pool and never drain
  // the boss HP, so the boss-HP rationale behind contract point 2 does not apply to them; yet the
  // kind-based × 0.6 also hits them. An R2-R5 rocket (30-40) then deals 18-24 to a mine, so no rocket
  // at any upgrade clears a mine with one direct hit any more (on the base an R2+ rocket did). The
  // same kind-based rules (× 0.6 and the one-part dedupe) also reach Oracle Prime shield pylons and
  // Octopus Warship eyes, which have their own HP pools too.
  it.fails('an R2 rocket direct hit still clears a Leviathan mine', async () => {
    const { leviathan, mine } = await layMine();
    expect(mine.isAlive(), 'fresh mine').toBe(true);
    burstOn(leviathan, mine, R2.damage, 'rocket');
    expect(mine.isAlive(), 'mine cleared by one R2 rocket').toBe(false);
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
