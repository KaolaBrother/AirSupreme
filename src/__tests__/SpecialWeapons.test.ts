import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SPECIAL_WEAPON_IDS,
  type CombatTarget,
  type CombatTargetKind,
  type DamageSource,
  type SpecialWeaponId,
} from '@/core/CombatContracts';
import { Faction } from '@/core/Faction';
import { CountermeasureSystem } from '@/features/weapons/CountermeasureSystem';
import {
  WeaponSystem,
  type WeaponHudState,
  type WeaponMuzzle,
} from '@/features/weapons/WeaponSystem';
import { SPECIAL_WEAPON_CONFIGS, getSpecialWeaponStats } from '@/features/weapons/WeaponTypes';
import { setLocale } from '@/i18n';
import { expectBilingual, resetLocale } from './i18nTestUtils';

const DT = 1 / 30;
/** 枪口位于 (0, 100, 0)，机头朝 -Z */
const MUZZLE: WeaponMuzzle = {
  position: new THREE.Vector3(0, 100, 0),
  quaternion: new THREE.Quaternion(),
};

interface FakeTarget extends CombatTarget {
  alive: boolean;
  readonly hits: Array<{ amount: number; source: DamageSource }>;
  readonly stuns: number[];
}

let targetSequence = 0;

function makeTarget(
  faction: Faction,
  position: [number, number, number],
  options: { hitRadius?: number; kind?: CombatTargetKind; userData?: Record<string, unknown> } = {}
): FakeTarget {
  const mesh = new THREE.Object3D();
  mesh.position.set(position[0], position[1], position[2]);
  Object.assign(mesh.userData, options.userData ?? {});
  const hits: Array<{ amount: number; source: DamageSource }> = [];
  const stuns: number[] = [];
  const target: FakeTarget = {
    id: `target-${++targetSequence}`,
    mesh,
    faction,
    kind: options.kind ?? 'air',
    hitRadius: options.hitRadius ?? 5,
    alive: true,
    hits,
    stuns,
    isAlive: () => target.alive,
    applyDamage: (amount: number, source: DamageSource) => {
      hits.push({ amount, source });
    },
    applyStun: (seconds: number) => {
      stuns.push(seconds);
    },
  };
  return target;
}

function totalDamage(target: FakeTarget): number {
  return target.hits.reduce((sum, hit) => sum + hit.amount, 0);
}

function run(weapons: WeaponSystem, seconds: number, muzzle: WeaponMuzzle = MUZZLE): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    weapons.update(DT, muzzle);
  }
}

/** 按下 → 一帧 → 松开 → 一帧 */
function tap(weapons: WeaponSystem): void {
  weapons.setTriggerHeld(true);
  weapons.update(DT, MUZZLE);
  weapons.setTriggerHeld(false);
  weapons.update(DT, MUZZLE);
}

function expectHudInRange(hud: WeaponHudState): void {
  for (const key of ['reloadProgress', 'heat', 'charge', 'cooldown'] as const) {
    expect(Number.isFinite(hud[key]), `${key}=${hud[key]}`).toBe(true);
    expect(hud[key], key).toBeGreaterThanOrEqual(0);
    expect(hud[key], key).toBeLessThanOrEqual(1);
  }
  expect(Number.isNaN(hud.ammo)).toBe(false);
  expect(hud.ammo).toBeGreaterThanOrEqual(0);
  expect(hud.ammo).toBeLessThanOrEqual(hud.maxAmmo);
  expect(hud.slots.filter((slot) => slot.selected).length).toBe(hud.selected ? 1 : 0);
}

describe('WeaponSystem (scene = null, particleSystem = null)', () => {
  let weapons: WeaponSystem;

  beforeEach(() => {
    weapons = new WeaponSystem(null, null);
  });

  afterEach(() => {
    weapons.dispose();
  });

  describe('unlocking and selection', () => {
    it('starts with nothing unlocked or selected', () => {
      expect(weapons.getUnlocked()).toEqual([]);
      expect(weapons.getSelected()).toBeNull();
      expect(weapons.select('rockets')).toBe(false);
      expect(weapons.selectNext()).toBeNull();
      expect(weapons.selectIndex(0)).toBe(false);

      const hud = weapons.getHudState();
      expect(hud.selected).toBeNull();
      expect(hud.mode).toBeNull();
      expect(hud.ready).toBe(false);
      expect(hud.slots).toEqual([]);
    });

    it('setUnlocked lists weapons in unlock (HUD) order and selects the first', () => {
      weapons.setUnlocked(['laser', 'rockets']);
      expect(weapons.getUnlocked()).toEqual(['rockets', 'laser']);
      expect(weapons.getSelected()).toBe('rockets');
    });

    it('setUnlocked keeps the selection while it stays unlocked', () => {
      weapons.setUnlocked(['rockets', 'laser']);
      expect(weapons.select('laser')).toBe(true);
      weapons.setUnlocked(['rockets', 'laser', 'swarm']);
      expect(weapons.getSelected()).toBe('laser');
    });

    it('setUnlocked moves the selection to the first weapon when the selected one goes', () => {
      weapons.setUnlocked(['rockets', 'laser', 'swarm']);
      weapons.select('laser');
      weapons.setUnlocked(['rockets', 'swarm']);
      expect(weapons.getSelected()).toBe('rockets');

      weapons.setUnlocked([]);
      expect(weapons.getSelected()).toBeNull();
    });

    it('select refuses locked weapons and keeps the current choice', () => {
      weapons.setUnlocked(['rockets']);
      expect(weapons.select('emp')).toBe(false);
      expect(weapons.getSelected()).toBe('rockets');
    });

    it('selectNext cycles through the unlocked weapons and wraps', () => {
      weapons.setUnlocked(['rockets', 'laser', 'swarm']);
      expect(weapons.selectNext()).toBe('laser');
      expect(weapons.selectNext()).toBe('swarm');
      expect(weapons.selectNext()).toBe('rockets');
      expect(weapons.getSelected()).toBe('rockets');
    });

    it('selectIndex is 0-based in SPECIAL_WEAPON_IDS order and skips locked slots', () => {
      weapons.setUnlocked(['rockets', 'swarm']);
      expect(weapons.selectIndex(2)).toBe(true);
      expect(weapons.getSelected()).toBe('swarm');
      expect(weapons.selectIndex(1)).toBe(false);
      expect(weapons.getSelected()).toBe('swarm');
      expect(weapons.selectIndex(-1)).toBe(false);
      expect(weapons.selectIndex(SPECIAL_WEAPON_IDS.length)).toBe(false);
      expect(weapons.selectIndex(0)).toBe(true);
      expect(weapons.getSelected()).toBe('rockets');
    });

    it('newly unlocked weapons start with full ammo', () => {
      weapons.setUnlocked(['rockets']);
      weapons.setUnlocked(['rockets', 'swarm']);
      weapons.select('swarm');
      const hud = weapons.getHudState();
      expect(hud.ammo).toBe(getSpecialWeaponStats('swarm', 0).maxAmmo);
      expect(hud.ammo).toBe(hud.maxAmmo);
    });
  });

  describe('trigger semantics', () => {
    it('salvo weapons fire once per press edge, not while held', () => {
      const stats = getSpecialWeaponStats('rockets', 0);
      weapons.setUnlocked(['rockets']);
      const onFired = vi.fn();
      weapons.onFired = onFired;

      weapons.setTriggerHeld(true);
      weapons.update(DT, MUZZLE);
      expect(onFired).toHaveBeenCalledTimes(1);
      expect(onFired.mock.calls[0][0]).toBe('rockets');
      expect(weapons.getHudState().ammo).toBe(stats.maxAmmo - 1);

      run(weapons, stats.cooldown * 3);
      expect(onFired).toHaveBeenCalledTimes(1);

      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);
      weapons.setTriggerHeld(true);
      weapons.update(DT, MUZZLE);
      expect(onFired).toHaveBeenCalledTimes(2);
      expect(weapons.getHudState().ammo).toBe(stats.maxAmmo - 2);
    });

    it('a press with an empty magazine is a dry fire', () => {
      const stats = getSpecialWeaponStats('rockets', 0);
      weapons.setUnlocked(['rockets']);
      const onFired = vi.fn();
      const onDryFire = vi.fn();
      weapons.onFired = onFired;
      weapons.onDryFire = onDryFire;

      for (let shot = 0; shot < stats.maxAmmo; shot++) {
        tap(weapons);
        run(weapons, stats.cooldown + 0.05);
      }
      expect(onFired).toHaveBeenCalledTimes(stats.maxAmmo);
      expect(weapons.getHudState().ammo).toBe(0);

      tap(weapons);
      expect(onFired).toHaveBeenCalledTimes(stats.maxAmmo);
      expect(onDryFire).toHaveBeenCalledWith('rockets');
    });

    it('pulse weapons fire once per press edge and report the pulse', () => {
      const stats = getSpecialWeaponStats('emp', 0);
      weapons.setUnlocked(['emp']);
      const onEmpPulse = vi.fn();
      weapons.onEmpPulse = onEmpPulse;

      weapons.setTriggerHeld(true);
      weapons.update(DT, MUZZLE);
      expect(onEmpPulse).toHaveBeenCalledTimes(1);
      const [center, radius, stunSeconds] = onEmpPulse.mock.calls[0] as [
        THREE.Vector3,
        number,
        number,
      ];
      expect(center.distanceTo(MUZZLE.position)).toBeLessThan(1e-6);
      expect(radius).toBe(stats.radius);
      expect(stunSeconds).toBe(stats.stunSeconds);

      run(weapons, stats.cooldown * 2);
      expect(onEmpPulse).toHaveBeenCalledTimes(1);
    });

    it('beam weapons burn continuously while held and stop on release', () => {
      const stats = getSpecialWeaponStats('laser', 0);
      weapons.setUnlocked(['laser']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -80]);
      weapons.setTargetProvider(() => [enemy]);
      const onFired = vi.fn();
      weapons.onFired = onFired;

      weapons.setTriggerHeld(true);
      run(weapons, 0.5);
      expect(onFired).toHaveBeenCalledTimes(1);
      expect(enemy.hits.every((hit) => hit.source === 'laser')).toBe(true);
      // damage 为每秒伤害
      expect(totalDamage(enemy)).toBeCloseTo(stats.damage * 0.5, 1);
      expect(weapons.getHudState().heat).toBeGreaterThan(0);

      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);
      const afterRelease = totalDamage(enemy);
      const heatAfterRelease = weapons.getHudState().heat;
      run(weapons, 0.5);
      expect(totalDamage(enemy)).toBe(afterRelease);
      expect(weapons.getHudState().heat).toBeLessThan(heatAfterRelease);
    });

    it('beam overheat locks the trigger until fully cooled and a fresh press', () => {
      const stats = getSpecialWeaponStats('laser', 0);
      weapons.setUnlocked(['laser']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -80]);
      weapons.setTargetProvider(() => [enemy]);
      const onOverheat = vi.fn();
      weapons.onOverheat = onOverheat;

      weapons.setTriggerHeld(true);
      const maxFrames = Math.ceil(2 / stats.heatPerSecond / DT);
      for (let i = 0; i < maxFrames && onOverheat.mock.calls.length === 0; i++) {
        weapons.update(DT, MUZZLE);
      }
      expect(onOverheat).toHaveBeenCalledTimes(1);
      let hud = weapons.getHudState();
      expect(hud.overheated).toBe(true);
      expect(hud.ready).toBe(false);

      // 仍按住扳机：冷却到 0 也不会自动恢复照射
      const damageAtOverheat = totalDamage(enemy);
      run(weapons, 1 / stats.coolPerSecond + 1);
      hud = weapons.getHudState();
      expect(hud.overheated).toBe(false);
      expect(hud.heat).toBe(0);
      expect(totalDamage(enemy)).toBe(damageAtOverheat);

      // 松开后重新按下才会再次照射
      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);
      weapons.setTriggerHeld(true);
      run(weapons, 0.3);
      expect(totalDamage(enemy)).toBeGreaterThan(damageAtOverheat);
    });

    it('a release-and-press while still overheated does not fire', () => {
      const stats = getSpecialWeaponStats('laser', 0);
      weapons.setUnlocked(['laser']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -80]);
      weapons.setTargetProvider(() => [enemy]);
      const onOverheat = vi.fn();
      weapons.onOverheat = onOverheat;

      weapons.setTriggerHeld(true);
      run(weapons, 1 / stats.heatPerSecond + 0.2);
      expect(onOverheat).toHaveBeenCalledTimes(1);
      const damageAtOverheat = totalDamage(enemy);

      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);
      weapons.setTriggerHeld(true);
      run(weapons, 0.3);
      expect(weapons.getHudState().overheated).toBe(true);
      expect(totalDamage(enemy)).toBe(damageAtOverheat);
    });

    it('charge weapons charge while held and fire on release, scaling with charge', () => {
      const stats = getSpecialWeaponStats('railgun', 0);
      weapons.setUnlocked(['railgun']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -200]);
      weapons.setTargetProvider(() => [enemy]);
      const onChargeStart = vi.fn();
      const onFired = vi.fn();
      weapons.onChargeStart = onChargeStart;
      weapons.onFired = onFired;

      weapons.setTriggerHeld(true);
      weapons.update(DT, MUZZLE);
      expect(onChargeStart).toHaveBeenCalledTimes(1);
      const early = weapons.getHudState().charge;
      expect(early).toBeGreaterThan(0);

      run(weapons, stats.chargeTime + 0.3);
      expect(weapons.getHudState().charge).toBe(1);
      expect(onFired).not.toHaveBeenCalled();
      expect(totalDamage(enemy)).toBe(0);

      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);
      expect(onFired).toHaveBeenCalledTimes(1);
      expect(onFired.mock.calls[0][0]).toBe('railgun');
      expect(enemy.hits.map((hit) => hit.source)).toEqual(['railgun']);
      expect(totalDamage(enemy)).toBeCloseTo(stats.damage, 6);
      expect(weapons.getHudState().ammo).toBe(stats.maxAmmo - 1);
      expect(weapons.getHudState().charge).toBe(0);
    });

    it('a partial charge fires for damage × charge', () => {
      const stats = getSpecialWeaponStats('railgun', 0);
      weapons.setUnlocked(['railgun']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -200]);
      weapons.setTargetProvider(() => [enemy]);

      weapons.setTriggerHeld(true);
      run(weapons, stats.chargeTime * 0.5);
      const charge = weapons.getHudState().charge;
      expect(charge).toBeGreaterThan(0.25);
      expect(charge).toBeLessThan(1);

      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);
      expect(totalDamage(enemy)).toBeCloseTo(stats.damage * charge, 6);
    });

    it('releasing below the charge threshold cancels as a dry fire without spending ammo', () => {
      const stats = getSpecialWeaponStats('railgun', 0);
      weapons.setUnlocked(['railgun']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -200]);
      weapons.setTargetProvider(() => [enemy]);
      const onFired = vi.fn();
      const onDryFire = vi.fn();
      weapons.onFired = onFired;
      weapons.onDryFire = onDryFire;

      weapons.setTriggerHeld(true);
      weapons.update(DT, MUZZLE);
      expect(weapons.getHudState().charge).toBeLessThan(0.25);
      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);

      expect(onFired).not.toHaveBeenCalled();
      expect(onDryFire).toHaveBeenCalledWith('railgun');
      expect(totalDamage(enemy)).toBe(0);
      expect(weapons.getHudState().ammo).toBe(stats.maxAmmo);
    });

    it('never fires from a NaN muzzle', () => {
      weapons.setUnlocked([...SPECIAL_WEAPON_IDS]);
      const onFired = vi.fn();
      const onEmpPulse = vi.fn();
      weapons.onFired = onFired;
      weapons.onEmpPulse = onEmpPulse;
      const badMuzzle: WeaponMuzzle = {
        position: new THREE.Vector3(Number.NaN, 100, 0),
        quaternion: new THREE.Quaternion(),
      };

      for (const id of SPECIAL_WEAPON_IDS) {
        weapons.select(id);
        expect(() => {
          weapons.setTriggerHeld(true);
          run(weapons, 0.2, badMuzzle);
          weapons.setTriggerHeld(false);
          run(weapons, 0.1, badMuzzle);
        }).not.toThrow();
      }
      expect(onFired).not.toHaveBeenCalled();
      expect(onEmpPulse).not.toHaveBeenCalled();
    });
  });

  describe('HUD state', () => {
    afterEach(() => {
      resetLocale();
    });

    it('describes the selected weapon and one slot per unlocked weapon', () => {
      weapons.setUnlocked([...SPECIAL_WEAPON_IDS]);
      weapons.select('swarm');
      const hud = weapons.getHudState();

      expect(hud.selected).toBe('swarm');
      expect(hud.mode).toBe(SPECIAL_WEAPON_CONFIGS.swarm.mode);
      expect(hud.shortCode).toBe('SWM');
      expect(hud.name).toBe(SPECIAL_WEAPON_CONFIGS.swarm.name.en);
      setLocale('zh-CN');
      expect(weapons.getHudState().name, 'name follows the interface language').toBe(
        SPECIAL_WEAPON_CONFIGS.swarm.name.zh
      );
      expect(weapons.getHudState().shortCode, 'short codes are the same in both').toBe('SWM');
      expect(hud.slots.map((slot) => slot.id)).toEqual([...SPECIAL_WEAPON_IDS]);
      expect(hud.slots.map((slot) => slot.shortCode)).toEqual(['RKT', 'LSR', 'SWM', 'RLG', 'EMP']);
      expect(hud.slots.filter((slot) => slot.selected).map((slot) => slot.id)).toEqual(['swarm']);
      expect(hud.ready).toBe(true);
      expectHudInRange(hud);
    });

    it('names and describes every weapon in both languages', () => {
      for (const id of SPECIAL_WEAPON_IDS) {
        expectBilingual(SPECIAL_WEAPON_CONFIGS[id].name, `${id} name`);
        expectBilingual(SPECIAL_WEAPON_CONFIGS[id].description, `${id} description`);
      }
    });

    it('reports heat weapons with infinite ammo', () => {
      weapons.setUnlocked(['laser']);
      const hud = weapons.getHudState();
      expect(hud.maxAmmo).toBe(Infinity);
      expect(hud.ammo).toBe(Infinity);
      expect(hud.mode).toBe('beam');
    });

    it('cooldown runs from just-fired toward 0 and reload progress from 0 toward full', () => {
      const stats = getSpecialWeaponStats('rockets', 0);
      weapons.setUnlocked(['rockets']);
      expect(weapons.getHudState().reloadProgress).toBe(1);

      tap(weapons);
      let hud = weapons.getHudState();
      expect(hud.cooldown).toBeGreaterThan(0.8);
      expect(hud.ready).toBe(false);
      expect(hud.reloadProgress).toBeLessThan(1);

      run(weapons, stats.cooldown + 0.05);
      hud = weapons.getHudState();
      expect(hud.cooldown).toBe(0);
      expect(hud.ready).toBe(true);
      const progress = hud.reloadProgress;
      run(weapons, 1);
      expect(weapons.getHudState().reloadProgress).toBeGreaterThan(progress);

      run(weapons, stats.reloadTime);
      hud = weapons.getHudState();
      expect(hud.ammo).toBe(stats.maxAmmo);
      expect(hud.reloadProgress).toBe(1);
    });

    it('keeps every gauge within range through a busy firing sequence', () => {
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -120], { hitRadius: 8 });
      weapons.setUnlocked([...SPECIAL_WEAPON_IDS]);
      weapons.setTargetProvider(() => [enemy]);

      for (const id of SPECIAL_WEAPON_IDS) {
        weapons.select(id);
        weapons.setTriggerHeld(true);
        for (let i = 0; i < 45; i++) {
          weapons.update(DT, MUZZLE);
          expectHudInRange(weapons.getHudState());
        }
        weapons.setTriggerHeld(false);
        for (let i = 0; i < 15; i++) {
          weapons.update(DT, MUZZLE);
          expectHudInRange(weapons.getHudState());
        }
      }
    });
  });

  describe('targeting by faction', () => {
    it('the beam passes through FRIENDLY and NEUTRAL targets to burn the enemy behind', () => {
      weapons.setUnlocked(['laser']);
      const friendly = makeTarget(Faction.FRIENDLY, [0, 100, -30]);
      const player = makeTarget(Faction.NEUTRAL, [0, 100, -55]);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -100]);
      weapons.setTargetProvider(() => [friendly, player, enemy]);

      weapons.setTriggerHeld(true);
      run(weapons, 0.5);

      expect(friendly.hits).toEqual([]);
      expect(player.hits).toEqual([]);
      expect(totalDamage(enemy)).toBeGreaterThan(0);
    });

    it('the beam can hit a CIVILIAN by accident', () => {
      weapons.setUnlocked(['laser']);
      const civilian = makeTarget(Faction.CIVILIAN, [0, 100, -60]);
      weapons.setTargetProvider(() => [civilian]);

      weapons.setTriggerHeld(true);
      run(weapons, 0.3);
      expect(totalDamage(civilian)).toBeGreaterThan(0);
    });

    it('the railgun pierces enemies but never hurts friendlies on the line', () => {
      const stats = getSpecialWeaponStats('railgun', 0);
      weapons.setUnlocked(['railgun']);
      const friendly = makeTarget(Faction.FRIENDLY, [0, 100, -60]);
      const first = makeTarget(Faction.ENEMY, [0, 100, -120]);
      const second = makeTarget(Faction.ENEMY, [0, 100, -240]);
      weapons.setTargetProvider(() => [friendly, first, second]);

      weapons.setTriggerHeld(true);
      run(weapons, stats.chargeTime + 0.2);
      weapons.setTriggerHeld(false);
      weapons.update(DT, MUZZLE);

      expect(friendly.hits).toEqual([]);
      expect(totalDamage(first)).toBeGreaterThan(0);
      expect(totalDamage(second)).toBeGreaterThan(0);
    });

    it('rocket splash spares friendlies standing next to the enemy', () => {
      weapons.setUnlocked(['rockets']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -80]);
      const friendly = makeTarget(Faction.FRIENDLY, [3, 100, -82]);
      const player = makeTarget(Faction.NEUTRAL, [-3, 100, -82]);
      weapons.setTargetProvider(() => [enemy, friendly, player]);

      tap(weapons);
      run(weapons, 1.5);

      expect(totalDamage(enemy)).toBeGreaterThan(0);
      expect(enemy.hits.every((hit) => hit.source === 'rocket')).toBe(true);
      expect(friendly.hits).toEqual([]);
      expect(player.hits).toEqual([]);
    });

    it('swarm missiles home on ENEMY targets only', () => {
      weapons.setUnlocked(['swarm']);
      // 敌机在右前方 20°，平民与友军在左前方 30° 附近（都在 42° 锥内）
      const enemy = makeTarget(Faction.ENEMY, [51, 100, -141]);
      const civilian = makeTarget(Faction.CIVILIAN, [-75, 100, -130]);
      const friendly = makeTarget(Faction.FRIENDLY, [-65, 100, -112]);
      weapons.setTargetProvider(() => [enemy, civilian, friendly]);

      tap(weapons);
      run(weapons, 3);

      expect(totalDamage(enemy)).toBeGreaterThan(0);
      expect(enemy.hits.every((hit) => hit.source === 'swarm')).toBe(true);
      expect(civilian.hits).toEqual([]);
      expect(friendly.hits).toEqual([]);
    });

    it('swarm missiles never home on a lone civilian or friendly', () => {
      weapons.setUnlocked(['swarm']);
      const civilian = makeTarget(Faction.CIVILIAN, [-75, 100, -130]);
      const friendly = makeTarget(Faction.FRIENDLY, [75, 100, -130]);
      weapons.setTargetProvider(() => [civilian, friendly]);

      tap(weapons);
      run(weapons, 4);

      expect(civilian.hits).toEqual([]);
      expect(friendly.hits).toEqual([]);
    });

    it('the EMP stuns ENEMY targets in radius and damages only projectiles and drones', () => {
      const stats = getSpecialWeaponStats('emp', 0);
      weapons.setUnlocked(['emp']);
      const enemyNear = makeTarget(Faction.ENEMY, [0, 100, -100]);
      const enemyFar = makeTarget(Faction.ENEMY, [0, 100, -(stats.radius + 200)]);
      // 中心在半径外 10 米，但半径 20 米的表面在范围内
      const enemyEdge = makeTarget(Faction.ENEMY, [stats.radius + 10, 100, 0], { hitRadius: 20 });
      const missile = makeTarget(Faction.ENEMY, [0, 110, -50], {
        kind: 'projectile',
        hitRadius: 1,
      });
      const drone = makeTarget(Faction.ENEMY, [20, 100, -40], {
        kind: 'air',
        userData: { unitType: 'DRONE' },
      });
      const friendly = makeTarget(Faction.FRIENDLY, [30, 100, -30]);
      const civilian = makeTarget(Faction.CIVILIAN, [-30, 100, -30]);
      const player = makeTarget(Faction.NEUTRAL, [0, 100, 10]);
      weapons.setTargetProvider(() => [
        enemyNear,
        enemyFar,
        enemyEdge,
        missile,
        drone,
        friendly,
        civilian,
        player,
      ]);

      tap(weapons);

      expect(enemyNear.stuns).toEqual([stats.stunSeconds]);
      expect(enemyEdge.stuns).toEqual([stats.stunSeconds]);
      expect(enemyFar.stuns).toEqual([]);
      expect(friendly.stuns).toEqual([]);
      expect(civilian.stuns).toEqual([]);
      expect(player.stuns).toEqual([]);

      expect(enemyNear.hits).toEqual([]);
      expect(missile.hits.length).toBeGreaterThan(0);
      expect(missile.hits.every((hit) => hit.source === 'emp')).toBe(true);
      expect(drone.hits.length).toBeGreaterThan(0);
      expect(friendly.hits).toEqual([]);
      expect(civilian.hits).toEqual([]);
      expect(player.hits).toEqual([]);
    });
  });

  describe('save state', () => {
    it('exportState → JSON → importState restores unlocks, selection and ammo', () => {
      weapons.setUnlocked(['rockets', 'laser', 'railgun']);
      tap(weapons);
      weapons.select('railgun');
      const exported = weapons.exportState();
      expect(exported.unlocked).toEqual(['rockets', 'laser', 'railgun']);
      expect(exported.selected).toBe('railgun');

      const restored = new WeaponSystem(null, null);
      restored.importState(JSON.parse(JSON.stringify(exported)) as typeof exported);
      expect(restored.getUnlocked()).toEqual(['rockets', 'laser', 'railgun']);
      expect(restored.getSelected()).toBe('railgun');
      restored.select('rockets');
      expect(restored.getHudState().ammo).toBe(getSpecialWeaponStats('rockets', 0).maxAmmo - 1);
      restored.select('laser');
      expect(restored.getHudState().ammo).toBe(Infinity);
      restored.dispose();
    });

    it('importState clamps ammo to the max of the current upgrade level', () => {
      weapons.setUpgradeLevel('rockets', 0);
      weapons.importState({ unlocked: ['rockets'], selected: 'rockets', ammo: { rockets: 99 } });
      expect(weapons.getHudState().ammo).toBe(getSpecialWeaponStats('rockets', 0).maxAmmo);

      const upgraded = new WeaponSystem(null, null);
      upgraded.setUpgradeLevel('rockets', 5);
      upgraded.importState({ unlocked: ['rockets'], selected: 'rockets', ammo: { rockets: 99 } });
      expect(upgraded.getHudState().ammo).toBe(getSpecialWeaponStats('rockets', 5).maxAmmo);
      expect(upgraded.getHudState().maxAmmo).toBe(getSpecialWeaponStats('rockets', 5).maxAmmo);

      upgraded.importState({ unlocked: ['rockets'], selected: 'rockets', ammo: { rockets: -4 } });
      expect(upgraded.getHudState().ammo).toBe(0);
      upgraded.dispose();
    });

    it('importState fills missing ammo and ignores unknown weapons', () => {
      weapons.importState({
        unlocked: ['swarm', 'plasma' as unknown as SpecialWeaponId],
        selected: 'swarm',
        ammo: {},
      });
      expect(weapons.getUnlocked()).toEqual(['swarm']);
      expect(weapons.getHudState().ammo).toBe(getSpecialWeaponStats('swarm', 0).maxAmmo);
    });

    it('setUpgradeLevel switches to the stats of that level', () => {
      weapons.setUnlocked(['rockets']);
      weapons.setUpgradeLevel('rockets', 5);
      const hud = weapons.getHudState();
      expect(hud.maxAmmo).toBe(getSpecialWeaponStats('rockets', 5).maxAmmo);
      expect(hud.ammo).toBe(hud.maxAmmo);
    });
  });

  describe('lifecycle', () => {
    it('clear() removes rockets already in flight', () => {
      weapons.setUnlocked(['rockets']);
      const enemy = makeTarget(Faction.ENEMY, [0, 100, -250]);
      weapons.setTargetProvider(() => [enemy]);

      tap(weapons);
      run(weapons, 0.3);
      weapons.clear();
      run(weapons, 2);
      expect(enemy.hits).toEqual([]);
    });

    it('dispose() twice is safe', () => {
      weapons.setUnlocked([...SPECIAL_WEAPON_IDS]);
      tap(weapons);
      expect(() => {
        weapons.dispose();
        weapons.dispose();
      }).not.toThrow();
    });

    it('with a real scene, dispose() removes everything it added', () => {
      const scene = new THREE.Scene();
      const baseline = scene.children.length;
      const withScene = new WeaponSystem(scene, null);
      withScene.setUnlocked(['rockets', 'laser']);
      withScene.setTriggerHeld(true);
      run(withScene, 0.2);
      expect(scene.children.length).toBeGreaterThan(baseline);

      withScene.dispose();
      expect(scene.children.length).toBe(baseline);
    });
  });
});

describe('CountermeasureSystem (scene = null)', () => {
  const ORIGIN = new THREE.Vector3(0, 120, 0);
  const FACING = new THREE.Quaternion();
  let flares: CountermeasureSystem;

  beforeEach(() => {
    flares = new CountermeasureSystem(null, null);
  });

  afterEach(() => {
    flares.dispose();
  });

  function step(seconds: number): void {
    const frames = Math.round(seconds / DT);
    for (let i = 0; i < frames; i++) {
      flares.update(DT);
    }
  }

  it('starts full with the default two charges', () => {
    expect(flares.getMaxCharges()).toBe(2);
    expect(flares.getCharges()).toBe(2);
    expect(flares.getRechargeProgress()).toBe(1);
    expect(flares.getActiveDecoys()).toEqual([]);
  });

  it('deploy spends a charge, and refuses at zero charges', () => {
    const onDeployed = vi.fn();
    flares.onDeployed = onDeployed;

    expect(flares.deploy(ORIGIN, FACING)).toBe(true);
    expect(flares.getCharges()).toBe(1);
    expect(flares.deploy(ORIGIN, FACING)).toBe(true);
    expect(flares.getCharges()).toBe(0);
    expect(onDeployed).toHaveBeenCalledTimes(2);

    expect(flares.deploy(ORIGIN, FACING)).toBe(false);
    expect(flares.getCharges()).toBe(0);
    expect(onDeployed).toHaveBeenCalledTimes(2);
  });

  it('refuses a NaN origin without spending a charge', () => {
    expect(flares.deploy(new THREE.Vector3(Number.NaN, 0, 0), FACING)).toBe(false);
    expect(flares.getCharges()).toBe(2);
  });

  it('recharges one charge every 12 s by default, with 0..1 progress', () => {
    flares.deploy(ORIGIN, FACING);
    flares.deploy(ORIGIN, FACING);
    expect(flares.getRechargeProgress()).toBe(0);

    step(6);
    expect(flares.getCharges()).toBe(0);
    expect(flares.getRechargeProgress()).toBeCloseTo(0.5, 1);

    step(6.1);
    expect(flares.getCharges()).toBe(1);
    step(12.1);
    expect(flares.getCharges()).toBe(2);
    expect(flares.getRechargeProgress()).toBe(1);
  });

  it('setRechargeTime changes the recharge interval', () => {
    flares.setRechargeTime(5);
    flares.deploy(ORIGIN, FACING);
    step(5.1);
    expect(flares.getCharges()).toBe(2);
  });

  it('setCapacity raises the cap (a full rack stays full) and clamps when lowered', () => {
    flares.setCapacity(4);
    expect(flares.getMaxCharges()).toBe(4);
    expect(flares.getCharges()).toBe(4);

    flares.deploy(ORIGIN, FACING);
    flares.setCapacity(1);
    expect(flares.getMaxCharges()).toBe(1);
    expect(flares.getCharges()).toBe(1);
  });

  it('exposes burning flares as decoys that fade and burn out', () => {
    expect(flares.deploy(ORIGIN, FACING)).toBe(true);
    flares.update(DT);
    const early = flares.getActiveDecoys();
    expect(early.length).toBeGreaterThan(0);
    for (const decoy of early) {
      expect(Number.isFinite(decoy.position.x + decoy.position.y + decoy.position.z)).toBe(true);
      expect(decoy.strength).toBeGreaterThan(0);
      expect(decoy.strength).toBeLessThanOrEqual(1);
    }

    step(0.5);
    const strongest = Math.max(...flares.getActiveDecoys().map((decoy) => decoy.strength));
    step(2.5);
    const late = flares.getActiveDecoys();
    const lateStrongest = late.length > 0 ? Math.max(...late.map((decoy) => decoy.strength)) : 0;
    expect(lateStrongest).toBeLessThan(strongest);

    step(2);
    expect(flares.getActiveDecoys()).toEqual([]);
  });

  it('exportState / importState round-trip the charges, clamped to the cap', () => {
    flares.setCapacity(4);
    flares.deploy(ORIGIN, FACING);
    expect(flares.exportState()).toEqual({ charges: 3 });

    const restored = new CountermeasureSystem(null, null);
    restored.setCapacity(4);
    restored.importState({ charges: 3 });
    expect(restored.getCharges()).toBe(3);
    restored.importState({ charges: 99 });
    expect(restored.getCharges()).toBe(4);
    restored.importState({ charges: -2 });
    expect(restored.getCharges()).toBe(0);
    restored.dispose();
  });

  it('clear() extinguishes every decoy', () => {
    flares.deploy(ORIGIN, FACING);
    flares.update(DT);
    flares.clear();
    expect(flares.getActiveDecoys()).toEqual([]);
  });

  it('with a real scene, clear() and dispose() remove what deploy() added', () => {
    const scene = new THREE.Scene();
    const baseline = scene.children.length;
    const withScene = new CountermeasureSystem(scene, null);

    withScene.deploy(ORIGIN, FACING);
    withScene.update(DT);
    expect(scene.children.length).toBeGreaterThan(baseline);
    withScene.clear();
    expect(scene.children.length).toBe(baseline);

    withScene.deploy(ORIGIN, FACING);
    withScene.dispose();
    expect(scene.children.length).toBe(baseline);
  });
});
