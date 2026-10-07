import { beforeEach, describe, expect, it } from 'vitest';
import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';
import {
  TOTAL_LEVELS,
  getUnlockedWeaponsThrough,
  getWeaponUnlockLevel,
} from '@/features/campaign/CampaignData';
import {
  PlayerStats,
  PlayerUpgrades,
  UPGRADE_CONFIGS,
  UpgradeType,
  WEAPON_UPGRADE_TYPES,
  getStartingUpgradePoints,
  getUpgradeCapForLevel,
} from '@/features/upgrade/UpgradeSystem';

const CORE_TRACKS: readonly UpgradeType[] = [
  UpgradeType.MAX_HEALTH,
  UpgradeType.DAMAGE,
  UpgradeType.FIRE_RATE,
  UpgradeType.SPEED,
  UpgradeType.MISSILE_LOCK_TIME,
  UpgradeType.MISSILE_LOCK_RADIUS,
  UpgradeType.MISSILE_RELOAD_TIME,
];
const DEFENSE_TRACKS: readonly UpgradeType[] = [UpgradeType.ARMOR, UpgradeType.FLARES];
const EXPECTED_WEAPON_TRACKS: Readonly<Record<SpecialWeaponId, UpgradeType>> = {
  rockets: UpgradeType.WEAPON_ROCKETS,
  laser: UpgradeType.WEAPON_LASER,
  swarm: UpgradeType.WEAPON_SWARM,
  railgun: UpgradeType.WEAPON_RAILGUN,
  emp: UpgradeType.WEAPON_EMP,
};
const ALL_LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1);
const PLENTY_OF_SCORE = 400_000;

/** api-spec §8 的层级上限公式 */
function specCap(type: UpgradeType, level: number): number {
  if (CORE_TRACKS.includes(type)) {
    return Math.min(10, level + 1);
  }
  if (DEFENSE_TRACKS.includes(type)) {
    return Math.min(UPGRADE_CONFIGS[type].maxLevel, Math.ceil(level / 2) + 1);
  }
  const weapon = SPECIAL_WEAPON_IDS.find((id) => EXPECTED_WEAPON_TRACKS[id] === type);
  const unlockLevel = weapon ? getWeaponUnlockLevel(weapon) : null;
  if (unlockLevel === null || level < unlockLevel) {
    return 0;
  }
  return Math.min(5, level - unlockLevel + 2);
}

function upgradeRepeatedly(upgrades: PlayerUpgrades, type: UpgradeType, times: number): number {
  let bought = 0;
  for (let i = 0; i < times; i++) {
    if (upgrades.upgrade(type)) {
      bought++;
    }
  }
  return bought;
}

/** 按“正常推进到第 level 关”的方式配置上限与解锁 */
function enterLevel(upgrades: PlayerUpgrades, level: number): void {
  upgrades.setCampaignLevel(level);
  upgrades.setUnlockedWeapons(getUnlockedWeaponsThrough(level));
}

describe('WEAPON_UPGRADE_TYPES', () => {
  it('maps every special weapon to its own upgrade track', () => {
    expect(WEAPON_UPGRADE_TYPES).toEqual(EXPECTED_WEAPON_TRACKS);
    expect(Object.keys(WEAPON_UPGRADE_TYPES).sort()).toEqual([...SPECIAL_WEAPON_IDS].sort());
    expect(new Set(Object.values(WEAPON_UPGRADE_TYPES)).size).toBe(SPECIAL_WEAPON_IDS.length);
  });
});

describe('getUpgradeCapForLevel', () => {
  it.each(ALL_LEVELS)('core tracks cap at min(10, level + 1) on level %i', (level) => {
    for (const type of CORE_TRACKS) {
      expect(getUpgradeCapForLevel(type, level), type).toBe(Math.min(10, level + 1));
    }
  });

  it.each(ALL_LEVELS)(
    'ARMOR / FLARES cap at min(maxLevel, ceil(level / 2) + 1) on level %i',
    (level) => {
      for (const type of DEFENSE_TRACKS) {
        expect(getUpgradeCapForLevel(type, level), type).toBe(
          Math.min(UPGRADE_CONFIGS[type].maxLevel, Math.ceil(level / 2) + 1)
        );
      }
    }
  );

  it.each(SPECIAL_WEAPON_IDS.map((id) => [id, getWeaponUnlockLevel(id) ?? 0] as const))(
    '%s track is closed before level %i, then min(5, level - unlock + 2)',
    (weapon, unlockLevel) => {
      const type = EXPECTED_WEAPON_TRACKS[weapon];
      for (const level of ALL_LEVELS) {
        const expected = level < unlockLevel ? 0 : Math.min(5, level - unlockLevel + 2);
        expect(getUpgradeCapForLevel(type, level), `${type} @ level ${level}`).toBe(expected);
      }
      // 解锁当关开放 2 级
      expect(getUpgradeCapForLevel(type, unlockLevel)).toBe(2);
    }
  );

  it('spot-checks the spec formula at representative levels', () => {
    expect(getUpgradeCapForLevel(UpgradeType.MAX_HEALTH, 1)).toBe(2);
    expect(getUpgradeCapForLevel(UpgradeType.MAX_HEALTH, 5)).toBe(6);
    expect(getUpgradeCapForLevel(UpgradeType.MAX_HEALTH, 9)).toBe(10);
    expect(getUpgradeCapForLevel(UpgradeType.ARMOR, 1)).toBe(2);
    expect(getUpgradeCapForLevel(UpgradeType.ARMOR, 4)).toBe(3);
    expect(getUpgradeCapForLevel(UpgradeType.FLARES, 3)).toBe(3);
    expect(getUpgradeCapForLevel(UpgradeType.WEAPON_ROCKETS, 1)).toBe(0);
    expect(getUpgradeCapForLevel(UpgradeType.WEAPON_ROCKETS, 2)).toBe(2);
    expect(getUpgradeCapForLevel(UpgradeType.WEAPON_ROCKETS, 5)).toBe(5);
    expect(getUpgradeCapForLevel(UpgradeType.WEAPON_RAILGUN, 8)).toBe(3);
    expect(getUpgradeCapForLevel(UpgradeType.WEAPON_EMP, 10)).toBe(3);
  });

  it('treats levels outside the campaign as its first / last level', () => {
    for (const type of Object.values(UpgradeType)) {
      expect(getUpgradeCapForLevel(type, 0), type).toBe(getUpgradeCapForLevel(type, 1));
      expect(getUpgradeCapForLevel(type, -5), type).toBe(getUpgradeCapForLevel(type, 1));
      expect(getUpgradeCapForLevel(type, 25), type).toBe(getUpgradeCapForLevel(type, TOTAL_LEVELS));
    }
  });

  it('never exceeds a track maxLevel and never shrinks as the campaign advances', () => {
    for (const type of Object.values(UpgradeType)) {
      let previous = 0;
      for (const level of ALL_LEVELS) {
        const cap = getUpgradeCapForLevel(type, level);
        expect(cap, `${type} @ ${level}`).toBe(specCap(type, level));
        expect(cap, `${type} @ ${level}`).toBeLessThanOrEqual(UPGRADE_CONFIGS[type].maxLevel);
        expect(cap, `${type} @ ${level}`).toBeGreaterThanOrEqual(previous);
        previous = cap;
      }
    }
  });
});

describe('PlayerUpgrades tiers and locks', () => {
  let upgrades: PlayerUpgrades;

  beforeEach(() => {
    upgrades = new PlayerUpgrades();
  });

  it('starts at campaign level 1 with every weapon track locked', () => {
    expect(upgrades.getCampaignLevel()).toBe(1);
    for (const type of Object.values(WEAPON_UPGRADE_TYPES)) {
      expect(upgrades.isLocked(type), type).toBe(true);
    }
    for (const type of [...CORE_TRACKS, ...DEFENSE_TRACKS]) {
      expect(upgrades.isLocked(type), type).toBe(false);
    }
  });

  it('setCampaignLevel clamps to 1..TOTAL_LEVELS', () => {
    upgrades.setCampaignLevel(7);
    expect(upgrades.getCampaignLevel()).toBe(7);
    upgrades.setCampaignLevel(0);
    expect(upgrades.getCampaignLevel()).toBe(1);
    upgrades.setCampaignLevel(40);
    expect(upgrades.getCampaignLevel()).toBe(TOTAL_LEVELS);
  });

  it('unlocks exactly the weapon tracks passed to setUnlockedWeapons', () => {
    upgrades.setUnlockedWeapons(['rockets', 'swarm']);
    expect(upgrades.isLocked(UpgradeType.WEAPON_ROCKETS)).toBe(false);
    expect(upgrades.isLocked(UpgradeType.WEAPON_SWARM)).toBe(false);
    expect(upgrades.isLocked(UpgradeType.WEAPON_LASER)).toBe(true);
    expect(upgrades.isLocked(UpgradeType.WEAPON_RAILGUN)).toBe(true);
    expect(upgrades.isLocked(UpgradeType.WEAPON_EMP)).toBe(true);

    // 整体替换，而不是追加
    upgrades.setUnlockedWeapons(['laser']);
    expect(upgrades.isLocked(UpgradeType.WEAPON_ROCKETS)).toBe(true);
    expect(upgrades.isLocked(UpgradeType.WEAPON_LASER)).toBe(false);
  });

  it('ignores unknown weapon ids', () => {
    upgrades.setUnlockedWeapons(['plasma', 'rockets'] as unknown as SpecialWeaponId[]);
    expect(upgrades.isLocked(UpgradeType.WEAPON_ROCKETS)).toBe(false);
    for (const type of [UpgradeType.WEAPON_LASER, UpgradeType.WEAPON_EMP]) {
      expect(upgrades.isLocked(type)).toBe(true);
    }
  });

  it.each(ALL_LEVELS)('getCap = min(maxLevel, tier cap) on level %i', (level) => {
    enterLevel(upgrades, level);
    for (const type of Object.values(UpgradeType)) {
      expect(upgrades.getCap(type), type).toBe(
        Math.min(UPGRADE_CONFIGS[type].maxLevel, getUpgradeCapForLevel(type, level))
      );
    }
  });

  it('canUpgrade stops at the tier cap even with points to spare', () => {
    upgrades.addScore(PLENTY_OF_SCORE);
    expect(upgradeRepeatedly(upgrades, UpgradeType.MAX_HEALTH, 10)).toBe(2);
    expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(2);
    expect(upgrades.canUpgrade(UpgradeType.MAX_HEALTH)).toBe(false);

    const points = upgrades.getAvailablePoints();
    expect(upgrades.upgrade(UpgradeType.MAX_HEALTH)).toBe(false);
    expect(upgrades.getAvailablePoints()).toBe(points);

    // 进入下一关后上限提升
    upgrades.setCampaignLevel(2);
    expect(upgrades.canUpgrade(UpgradeType.MAX_HEALTH)).toBe(true);
    expect(upgradeRepeatedly(upgrades, UpgradeType.MAX_HEALTH, 10)).toBe(1);
  });

  it('canUpgrade is false for a locked weapon track regardless of points', () => {
    upgrades.addScore(PLENTY_OF_SCORE);
    upgrades.setCampaignLevel(TOTAL_LEVELS);
    for (const type of Object.values(WEAPON_UPGRADE_TYPES)) {
      expect(upgrades.canUpgrade(type), type).toBe(false);
      expect(upgrades.upgrade(type), type).toBe(false);
      expect(upgrades.getLevel(type), type).toBe(0);
    }
  });

  it('opens two tiers of a weapon track on its unlock level', () => {
    upgrades.addScore(PLENTY_OF_SCORE);
    enterLevel(upgrades, 2);
    expect(upgrades.isLocked(UpgradeType.WEAPON_ROCKETS)).toBe(false);
    expect(upgradeRepeatedly(upgrades, UpgradeType.WEAPON_ROCKETS, 5)).toBe(2);
    expect(upgrades.canUpgrade(UpgradeType.WEAPON_ROCKETS)).toBe(false);
    expect(upgrades.isLocked(UpgradeType.WEAPON_LASER)).toBe(true);
  });

  it('canUpgrade is false without enough points even below the cap', () => {
    upgrades.setCampaignLevel(TOTAL_LEVELS);
    expect(upgrades.getAvailablePoints()).toBe(0);
    for (const type of [...CORE_TRACKS, ...DEFENSE_TRACKS]) {
      expect(upgrades.canUpgrade(type), type).toBe(false);
    }
  });

  it('reset() returns to campaign level 1 with every weapon relocked', () => {
    enterLevel(upgrades, 9);
    upgrades.addScore(PLENTY_OF_SCORE);
    upgrades.upgrade(UpgradeType.WEAPON_EMP);

    upgrades.reset();

    expect(upgrades.getCampaignLevel()).toBe(1);
    expect(upgrades.getLevel(UpgradeType.WEAPON_EMP)).toBe(0);
    for (const type of Object.values(WEAPON_UPGRADE_TYPES)) {
      expect(upgrades.isLocked(type), type).toBe(true);
    }
  });

  describe('awardBonusPoints', () => {
    it('adds whole points without touching the score', () => {
      upgrades.addScore(400);
      upgrades.awardBonusPoints(5);
      expect(upgrades.getAvailablePoints()).toBe(6);
      expect(upgrades.getTotalScore()).toBe(400);
    });

    it('ignores zero, negative and non-finite awards', () => {
      upgrades.awardBonusPoints(3);
      for (const bad of [0, -4, Number.NaN, Infinity, -Infinity]) {
        upgrades.awardBonusPoints(bad);
      }
      expect(upgrades.getAvailablePoints()).toBe(3);
    });

    it('rounds fractional awards down to whole points', () => {
      upgrades.awardBonusPoints(2.7);
      expect(upgrades.getAvailablePoints()).toBe(2);
    });

    it('bonus points can be spent like earned points', () => {
      upgrades.awardBonusPoints(1);
      expect(upgrades.upgrade(UpgradeType.SPEED)).toBe(true);
      expect(upgrades.getAvailablePoints()).toBe(0);
    });
  });
});

describe('getStartingUpgradePoints', () => {
  const points = ALL_LEVELS.map((level) => getStartingUpgradePoints(level));

  it('is 0 at level 1 and a non-negative whole number everywhere', () => {
    expect(getStartingUpgradePoints(1)).toBe(0);
    for (const value of points) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('never decreases as the starting level rises, and grants something past level 1', () => {
    for (let i = 1; i < points.length; i++) {
      expect(points[i], `level ${i + 1}`).toBeGreaterThanOrEqual(points[i - 1]);
    }
    expect(points[points.length - 1]).toBeGreaterThan(0);
  });

  it('clamps out-of-range levels', () => {
    expect(getStartingUpgradePoints(0)).toBe(0);
    expect(getStartingUpgradePoints(30)).toBe(getStartingUpgradePoints(TOTAL_LEVELS));
  });
});

describe('PlayerStats progression getters', () => {
  let stats: PlayerStats;
  let upgrades: PlayerUpgrades;

  beforeEach(() => {
    stats = new PlayerStats();
    upgrades = stats.getUpgrades();
    enterLevel(upgrades, TOTAL_LEVELS);
    upgrades.addScore(PLENTY_OF_SCORE);
  });

  it('getArmorReduction climbs from 0 to 0.4 across the ARMOR track', () => {
    expect(stats.getArmorReduction()).toBe(0);
    let previous = 0;
    for (let tier = 1; tier <= UPGRADE_CONFIGS[UpgradeType.ARMOR].maxLevel; tier++) {
      expect(upgrades.upgrade(UpgradeType.ARMOR)).toBe(true);
      const reduction = stats.getArmorReduction();
      expect(reduction).toBeGreaterThan(previous);
      expect(reduction).toBeLessThanOrEqual(0.4);
      previous = reduction;
    }
    expect(stats.getArmorReduction()).toBeCloseTo(0.4, 6);
  });

  it('getFlareCapacity climbs from 2 to 6 whole flares across the FLARES track', () => {
    expect(stats.getFlareCapacity()).toBe(2);
    let previous = 2;
    for (let tier = 1; tier <= UPGRADE_CONFIGS[UpgradeType.FLARES].maxLevel; tier++) {
      expect(upgrades.upgrade(UpgradeType.FLARES)).toBe(true);
      const capacity = stats.getFlareCapacity();
      expect(Number.isInteger(capacity)).toBe(true);
      expect(capacity).toBeGreaterThanOrEqual(previous);
      expect(capacity).toBeLessThanOrEqual(6);
      previous = capacity;
    }
    expect(stats.getFlareCapacity()).toBe(6);
  });

  it('getWeaponUpgradeLevel mirrors the weapon track level within 0..5', () => {
    for (const id of SPECIAL_WEAPON_IDS) {
      expect(stats.getWeaponUpgradeLevel(id), id).toBe(0);
    }
    const bought = upgradeRepeatedly(upgrades, UpgradeType.WEAPON_ROCKETS, 8);
    expect(bought).toBe(5);
    expect(stats.getWeaponUpgradeLevel('rockets')).toBe(5);

    upgradeRepeatedly(upgrades, UpgradeType.WEAPON_EMP, 2);
    expect(stats.getWeaponUpgradeLevel('emp')).toBe(2);
    expect(stats.getWeaponUpgradeLevel('laser')).toBe(0);
  });

  it('getWeaponUpgradeLevel returns 0 for an unknown weapon id', () => {
    expect(stats.getWeaponUpgradeLevel('plasma' as unknown as SpecialWeaponId)).toBe(0);
  });
});

describe('PlayerUpgrades.import()', () => {
  /** 旧版（a72359b）export() 的格式：只有 7 条线，没有关卡 / 武器字段 */
  const LEGACY_EXPORT: Record<string, unknown> = {
    totalScore: 3200,
    availablePoints: 2,
    upgrades: {
      MAX_HEALTH: 3,
      DAMAGE: 1,
      FIRE_RATE: 0,
      SPEED: 2,
      MISSILE_LOCK_TIME: 0,
      MISSILE_LOCK_RADIUS: 5,
      MISSILE_RELOAD_TIME: 4,
    },
  };

  it('accepts the legacy 7-track export format', () => {
    const upgrades = new PlayerUpgrades();
    expect(() => upgrades.import(LEGACY_EXPORT)).not.toThrow();

    expect(upgrades.getTotalScore()).toBe(3200);
    expect(upgrades.getAvailablePoints()).toBe(2);
    expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(3);
    expect(upgrades.getLevel(UpgradeType.DAMAGE)).toBe(1);
    expect(upgrades.getLevel(UpgradeType.SPEED)).toBe(2);
    expect(upgrades.getLevel(UpgradeType.MISSILE_LOCK_RADIUS)).toBe(5);
    expect(upgrades.getLevel(UpgradeType.MISSILE_RELOAD_TIME)).toBe(4);
    for (const type of [...DEFENSE_TRACKS, ...Object.values(WEAPON_UPGRADE_TYPES)]) {
      expect(upgrades.getLevel(type), type).toBe(0);
    }
  });

  it('keeps the current campaign level and unlocks when the legacy data has none', () => {
    const upgrades = new PlayerUpgrades();
    enterLevel(upgrades, 4);
    upgrades.import(LEGACY_EXPORT);
    expect(upgrades.getCampaignLevel()).toBe(4);
    expect(upgrades.isLocked(UpgradeType.WEAPON_ROCKETS)).toBe(false);
    expect(upgrades.isLocked(UpgradeType.WEAPON_LASER)).toBe(false);
  });

  it('replaces previous levels rather than merging them', () => {
    const upgrades = new PlayerUpgrades();
    upgrades.addScore(PLENTY_OF_SCORE);
    upgrades.upgrade(UpgradeType.FIRE_RATE);
    upgrades.import(LEGACY_EXPORT);
    expect(upgrades.getLevel(UpgradeType.FIRE_RATE)).toBe(0);
  });

  it('round-trips the new export format, including level and unlocks', () => {
    const source = new PlayerUpgrades();
    enterLevel(source, 7);
    source.addScore(20_000);
    source.upgrade(UpgradeType.ARMOR);
    source.upgrade(UpgradeType.WEAPON_SWARM);
    source.upgrade(UpgradeType.MAX_HEALTH);

    const restored = new PlayerUpgrades();
    restored.import(source.export());

    expect(restored.export()).toEqual(source.export());
    expect(restored.getCampaignLevel()).toBe(7);
    expect(restored.isLocked(UpgradeType.WEAPON_RAILGUN)).toBe(false);
    expect(restored.isLocked(UpgradeType.WEAPON_EMP)).toBe(true);
    expect(restored.getLevel(UpgradeType.WEAPON_SWARM)).toBe(1);
  });

  it('survives junk: unknown tracks ignored, levels clamped to 0..maxLevel', () => {
    const upgrades = new PlayerUpgrades();
    expect(() =>
      upgrades.import({
        totalScore: 'lots',
        availablePoints: -3,
        upgrades: { MAX_HEALTH: 99, SPEED: -2, LASER_EYES: 4, DAMAGE: 'x' },
      })
    ).not.toThrow();

    expect(upgrades.getLevel(UpgradeType.MAX_HEALTH)).toBe(
      UPGRADE_CONFIGS[UpgradeType.MAX_HEALTH].maxLevel
    );
    expect(upgrades.getLevel(UpgradeType.SPEED)).toBe(0);
    expect(upgrades.getLevel(UpgradeType.DAMAGE)).toBe(0);
    expect(upgrades.getAvailablePoints()).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(upgrades.getTotalScore())).toBe(true);
    expect(Object.keys(upgrades.export().upgrades as object)).not.toContain('LASER_EYES');
  });
});
