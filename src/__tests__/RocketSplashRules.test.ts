import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { CombatTarget, CombatTargetKind, DamageSource } from '@/core/CombatContracts';
import { Faction } from '@/core/Faction';
import { WeaponSystem, type WeaponMuzzle } from '@/features/weapons/WeaponSystem';
import { TargetSnapshotBuffer, applySplashDamage } from '@/features/weapons/WeaponTargeting';
import * as WeaponTypes from '@/features/weapons/WeaponTypes';
import { getSpecialWeaponStats } from '@/features/weapons/WeaponTypes';
import {
  CONTRACT_ROCKET_FACTOR_AIR,
  CONTRACT_ROCKET_FACTOR_BOSS,
  contractFactor,
  makeFakeTarget,
  splashFalloff,
  totalOf,
  type FakeTarget,
} from './rocketBalanceRig';

/**
 * 火箭平衡修正（单元级）：applySplashDamage 对手工目标的结算规则。
 * - Boss 去重：一次爆炸里所有 'boss-part' 目标只结算“本应受伤最多”的一个；
 * - 火箭系数：'air' × 0.5、'boss-part' × 0.6、其余 × 1.0（直接命中与溅射都乘）；
 * - 蜂群：有 Boss 去重、没有系数；
 * - 守卫：火箭数值表不变、对地 / 对海伤害不变、轨道炮贯穿不受影响。
 */

/** 唯一一处对导出常量名的猜测（契约：与火箭数值放在 WeaponTypes.ts，独立于 SpecialWeaponStats） */
const FACTORS_EXPORT_NAME = 'ROCKET_TARGET_DAMAGE_FACTORS';

const CENTER = new THREE.Vector3(0, 0, 0);
const DAMAGE = 30;
const SPLASH = 10;

function snapshotOf(targets: readonly CombatTarget[]): TargetSnapshotBuffer {
  const snapshot = new TargetSnapshotBuffer();
  snapshot.capture(targets);
  return snapshot;
}

/** 按现有溅射规则算出某个目标本应受到的伤害（未乘系数、未去重） */
function rawSplash(target: FakeTarget, center: THREE.Vector3, splash: number): number {
  const surface = Math.max(0, target.mesh.position.distanceTo(center) - target.hitRadius);
  return surface > splash ? 0 : DAMAGE * splashFalloff(surface, splash);
}

function burst(
  targets: readonly FakeTarget[],
  source: DamageSource,
  direct: FakeTarget | null,
  center: THREE.Vector3 = CENTER,
  damage = DAMAGE,
  splash = SPLASH
): void {
  applySplashDamage(snapshotOf(targets), center, splash, damage, source, direct);
}

describe('applySplashDamage: one detonation hits a boss once', () => {
  it('a direct hit on one boss part damages only that part, for full damage (swarm)', () => {
    const struck = makeFakeTarget('boss-part', [0, 0, 0], 5);
    const turret = makeFakeTarget('boss-part', [8, 0, 0], 3);
    const tower = makeFakeTarget('boss-part', [0, 9, 0], 4);
    // 前提：另外两个部件都在溅射范围内
    expect(rawSplash(turret, CENTER, SPLASH)).toBeGreaterThan(0);
    expect(rawSplash(tower, CENTER, SPLASH)).toBeGreaterThan(0);

    burst([turret, struck, tower], 'swarm', struck);

    expect(struck.hits).toEqual([{ amount: DAMAGE, source: 'swarm' }]);
    expect(turret.hits).toEqual([]);
    expect(tower.hits).toEqual([]);
  });

  const nearest = (): FakeTarget => makeFakeTarget('boss-part', [6, 0, 0], 3);
  const middle = (): FakeTarget => makeFakeTarget('boss-part', [0, 10, 0], 3);
  const farthest = (): FakeTarget => makeFakeTarget('boss-part', [0, 0, -12], 4);

  it.each([
    ['listed last', [1, 2, 0]],
    ['listed first', [0, 1, 2]],
    ['listed in the middle', [1, 0, 2]],
  ] as const)(
    'without a direct hit only the boss part with the highest splash amount is damaged (%s)',
    (_label, order) => {
      const parts = [nearest(), middle(), farthest()];
      const listed = order.map((index) => parts[index]);
      const amounts = parts.map((part) => rawSplash(part, CENTER, SPLASH));
      // 前提：三个部件都在范围内，且最近的那个严格最大
      expect(amounts.every((amount) => amount > 0)).toBe(true);
      expect(amounts[0]).toBeGreaterThan(Math.max(amounts[1], amounts[2]));

      burst(listed, 'swarm', null);

      expect(parts[0].hits).toHaveLength(1);
      expect(parts[0].hits[0].amount).toBeCloseTo(amounts[0], 9);
      expect(parts[1].hits).toEqual([]);
      expect(parts[2].hits).toEqual([]);
    }
  );

  it('when two boss parts tie for the highest amount, exactly one of them takes it', () => {
    // 爆点同时在两个部件的命中球内：表面距离都是 0，都应受满伤害
    const hull = makeFakeTarget('boss-part', [2, 0, 0], 6);
    const deck = makeFakeTarget('boss-part', [-2, 0, 0], 6);

    burst([hull, deck], 'swarm', null);

    const all = [...hull.hits, ...deck.hits];
    expect(all).toHaveLength(1);
    expect(all[0].amount).toBeCloseTo(DAMAGE, 9);
  });

  it('boss parts are deduped while every non-boss target still takes its own splash', () => {
    const struck = makeFakeTarget('boss-part', [0, 0, 0], 5);
    const nextPart = makeFakeTarget('boss-part', [7, 0, 0], 3);
    const tank = makeFakeTarget('ground', [0, 0, 8], 4);
    const tankBehind = makeFakeTarget('ground', [0, -9, 0], 2);
    const gunboat = makeFakeTarget('sea', [-9, 0, 0], 3);
    const jet = makeFakeTarget('air', [0, 6, 0], 2);
    const missile = makeFakeTarget('projectile', [0, 0, -5], 1);
    const farTank = makeFakeTarget('ground', [30, 0, 0], 3);
    const units = [tank, tankBehind, gunboat, jet, missile];
    expect(rawSplash(nextPart, CENTER, SPLASH)).toBeGreaterThan(0);
    for (const unit of units) expect(rawSplash(unit, CENTER, SPLASH)).toBeGreaterThan(0);
    expect(rawSplash(farTank, CENTER, SPLASH)).toBe(0);

    burst([nextPart, tank, struck, tankBehind, gunboat, jet, missile, farTank], 'swarm', struck);

    expect(totalOf(struck.hits)).toBeCloseTo(DAMAGE, 9);
    expect(struck.hits).toHaveLength(1);
    expect(nextPart.hits).toEqual([]);
    for (const unit of units) {
      expect(unit.hits, unit.id).toHaveLength(1);
      expect(unit.hits[0].amount, unit.id).toBeCloseTo(rawSplash(unit, CENTER, SPLASH), 9);
    }
    expect(farTank.hits).toEqual([]);
  });

  it('a rocket among boss parts and units: one boss part at × 0.6, units at their own factor', () => {
    const struck = makeFakeTarget('boss-part', [0, 0, 0], 5);
    const nextPart = makeFakeTarget('boss-part', [7, 0, 0], 3);
    const tank = makeFakeTarget('ground', [0, 0, 8], 4);
    const gunboat = makeFakeTarget('sea', [-9, 0, 0], 3);
    const jet = makeFakeTarget('air', [0, 6, 0], 2);
    const units = [tank, gunboat, jet];

    burst([nextPart, struck, tank, gunboat, jet], 'rocket', struck);

    expect(struck.hits).toHaveLength(1);
    expect(struck.hits[0].amount).toBeCloseTo(DAMAGE * CONTRACT_ROCKET_FACTOR_BOSS, 9);
    expect(struck.hits[0].source).toBe('rocket');
    expect(nextPart.hits).toEqual([]);
    for (const unit of units) {
      const expected = rawSplash(unit, CENTER, SPLASH) * contractFactor('rocket', unit.kind);
      expect(unit.hits, unit.id).toHaveLength(1);
      expect(unit.hits[0].amount, unit.id).toBeCloseTo(expected, 9);
    }
  });

  it('a rocket with no direct hit damages only the best boss part, at its falloff × 0.6', () => {
    const parts = [
      makeFakeTarget('boss-part', [0, 10, 0], 3),
      makeFakeTarget('boss-part', [0, 0, -12], 4),
      makeFakeTarget('boss-part', [6, 0, 0], 3),
    ];
    const best = parts[2];

    burst(parts, 'rocket', null);

    expect(best.hits).toHaveLength(1);
    expect(best.hits[0].amount).toBeCloseTo(
      rawSplash(best, CENTER, SPLASH) * CONTRACT_ROCKET_FACTOR_BOSS,
      9
    );
    expect(parts[0].hits).toEqual([]);
    expect(parts[1].hits).toEqual([]);
  });

  it('a lone boss part in splash range takes its falloff amount (swarm, no factor)', () => {
    const part = makeFakeTarget('boss-part', [0, 0, -9], 4);
    burst([part], 'swarm', null);
    expect(totalOf(part.hits)).toBeCloseTo(rawSplash(part, CENTER, SPLASH), 9);
  });
});

describe('applySplashDamage: rocket damage factors by target kind', () => {
  const KINDS: ReadonlyArray<[CombatTargetKind, number]> = [
    ['air', CONTRACT_ROCKET_FACTOR_AIR],
    ['boss-part', CONTRACT_ROCKET_FACTOR_BOSS],
    ['ground', 1],
    ['sea', 1],
    ['projectile', 1],
  ];

  it.each(KINDS)('a direct rocket hit on a %s target deals damage × %s', (kind, factor) => {
    const target = makeFakeTarget(kind, [0, 0, 0], 5);
    burst([target], 'rocket', target);
    expect(target.hits).toHaveLength(1);
    expect(target.hits[0].amount).toBeCloseTo(DAMAGE * factor, 9);
    expect(target.hits[0].source).toBe('rocket');
  });

  it.each(KINDS)('rocket splash on a %s target deals falloff × %s', (kind, factor) => {
    // 表面距离 5 米，溅射半径 10 米 → 衰减到 70%
    const target = makeFakeTarget(kind, [9, 0, 0], 4);
    burst([target], 'rocket', null);
    expect(target.hits).toHaveLength(1);
    expect(target.hits[0].amount).toBeCloseTo(DAMAGE * splashFalloff(5, SPLASH) * factor, 9);
  });

  it('the factor follows the R5 rocket stats too (direct hit on a jet at upgrade 5)', () => {
    const stats = getSpecialWeaponStats('rockets', 5);
    const jet = makeFakeTarget('air', [0, 0, 0], 8);
    burst([jet], 'rocket', jet, CENTER, stats.damage, stats.splashRadius);
    expect(totalOf(jet.hits)).toBeCloseTo(stats.damage * CONTRACT_ROCKET_FACTOR_AIR, 9);
  });

  it('every air target in one rocket blast takes its own halved splash', () => {
    const jets = [
      makeFakeTarget('air', [0, 0, 0], 5),
      makeFakeTarget('air', [8, 0, 0], 4),
      makeFakeTarget('air', [0, 0, -11], 5),
    ];
    burst(jets, 'rocket', jets[0]);
    expect(totalOf(jets[0].hits)).toBeCloseTo(DAMAGE * CONTRACT_ROCKET_FACTOR_AIR, 9);
    for (const jet of jets.slice(1)) {
      expect(jet.hits, jet.id).toHaveLength(1);
      expect(jet.hits[0].amount, jet.id).toBeCloseTo(
        rawSplash(jet, CENTER, SPLASH) * CONTRACT_ROCKET_FACTOR_AIR,
        9
      );
    }
  });

  it('a civilian air target caught in rocket splash is halved like any air target', () => {
    const airliner = makeFakeTarget('air', [0, 0, 0], 12, Faction.CIVILIAN);
    burst([airliner], 'rocket', airliner);
    expect(totalOf(airliner.hits)).toBeCloseTo(DAMAGE * CONTRACT_ROCKET_FACTOR_AIR, 9);
  });

  it('swarm missiles keep full damage against air and boss targets', () => {
    const jet = makeFakeTarget('air', [0, 0, 0], 5);
    burst([jet], 'swarm', jet);
    expect(totalOf(jet.hits)).toBeCloseTo(DAMAGE, 9);

    const part = makeFakeTarget('boss-part', [0, 0, 0], 5);
    burst([part], 'swarm', part);
    expect(totalOf(part.hits)).toBeCloseTo(DAMAGE, 9);

    const splashJet = makeFakeTarget('air', [9, 0, 0], 4);
    burst([splashJet], 'swarm', null);
    expect(totalOf(splashJet.hits)).toBeCloseTo(DAMAGE * splashFalloff(5, SPLASH), 9);
  });

  it('exports the factors next to the rocket stats as 0.5 (air) and 0.6 (boss)', () => {
    const exported = (WeaponTypes as Record<string, unknown>)[FACTORS_EXPORT_NAME];
    expect(exported, `WeaponTypes.${FACTORS_EXPORT_NAME}`).toBeTypeOf('object');
    const values = Object.values(exported as Record<string, unknown>);
    expect(values).toContain(CONTRACT_ROCKET_FACTOR_AIR);
    expect(values).toContain(CONTRACT_ROCKET_FACTOR_BOSS);
    for (const value of values) {
      expect(typeof value === 'number' && value > 0 && value <= 1, String(value)).toBe(true);
    }
  });
});

describe('guards: what the rocket fix leaves alone', () => {
  it('getSpecialWeaponStats("rockets", n) is the unchanged stat table at every level', () => {
    const table = {
      damage: [24, 27, 30, 33, 36, 40],
      range: [520, 550, 580, 610, 640, 680],
      cooldown: [0.85, 0.8, 0.75, 0.7, 0.65, 0.6],
      maxAmmo: [4, 4, 5, 5, 6, 6],
      reloadTime: [6, 5.6, 5.2, 4.8, 4.4, 4],
      projectileCount: [6, 7, 8, 9, 10, 12],
      splashRadius: [9, 9.5, 10, 11, 12, 13],
    };
    for (let level = 0; level <= 5; level++) {
      expect(getSpecialWeaponStats('rockets', level), `rockets R${level}`).toStrictEqual({
        damage: table.damage[level],
        range: table.range[level],
        cooldown: table.cooldown[level],
        maxAmmo: table.maxAmmo[level],
        reloadTime: table.reloadTime[level],
        projectileCount: table.projectileCount[level],
        splashRadius: table.splashRadius[level],
        chargeTime: 0,
        heatPerSecond: 0,
        coolPerSecond: 0,
        stunSeconds: 0,
        radius: 0,
      });
    }
  });

  it('rocket damage to ground and sea targets is the table value direct, falloff in splash', () => {
    for (let level = 0; level <= 5; level++) {
      const stats = getSpecialWeaponStats('rockets', level);
      for (const kind of ['ground', 'sea'] as const) {
        const struck = makeFakeTarget(kind, [0, 0, 0], 6);
        const near = makeFakeTarget(kind, [0, 0, 12.5], 4);
        burst([struck, near], 'rocket', struck, CENTER, stats.damage, stats.splashRadius);
        expect(totalOf(struck.hits), `${kind} direct R${level}`).toBeCloseTo(stats.damage, 9);
        // near 的表面距离 = 12.5 - 4 = 8.5 米（R0 溅射半径 9 米以内）
        expect(totalOf(near.hits), `${kind} splash R${level}`).toBeCloseTo(
          stats.damage * splashFalloff(8.5, stats.splashRadius),
          9
        );
      }
    }
  });

  describe('railgun pierce (out of scope, unchanged)', () => {
    const DT = 1 / 30;
    const MUZZLE: WeaponMuzzle = {
      position: new THREE.Vector3(0, 100, 0),
      quaternion: new THREE.Quaternion(),
    };
    let weapons: WeaponSystem | null = null;

    afterEach(() => {
      weapons?.dispose();
      weapons = null;
    });

    it('a full-charge slug still deals full damage to every boss part and jet on its line', () => {
      const stats = getSpecialWeaponStats('railgun', 0);
      const system = new WeaponSystem(null, null);
      weapons = system;
      system.setUnlocked(['railgun']);
      const front = makeFakeTarget('boss-part', [0, 100, -120], 5);
      const back = makeFakeTarget('boss-part', [0, 100, -135], 5);
      const jet = makeFakeTarget('air', [0, 100, -240], 5);
      system.setTargetProvider(() => [front, back, jet]);

      system.setTriggerHeld(true);
      for (let i = 0; i < Math.round((stats.chargeTime + 0.3) / DT); i++) {
        system.update(DT, MUZZLE);
      }
      system.setTriggerHeld(false);
      system.update(DT, MUZZLE);

      for (const target of [front, back, jet]) {
        expect(
          target.hits.map((hit) => hit.source),
          target.id
        ).toEqual(['railgun']);
        expect(totalOf(target.hits), target.id).toBeCloseTo(stats.damage, 6);
      }
    });
  });
});
