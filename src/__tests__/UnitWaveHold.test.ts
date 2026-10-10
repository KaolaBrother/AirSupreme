import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DamageSource } from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { Faction } from '@/core/Faction';
import { UnitController } from '@/core/units/UnitController';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitInstance, UnitSystem } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UNIT_TYPES, UnitType, type UnitDomain } from '@/features/units/UnitTypes';
import type { LocalizedText } from '@/i18n';
import type { HudText, HudWarningTone } from '@/ui/HUD';
import { expectBilingual, resetLocale } from './i18nTestUtils';

/**
 * 敌机清空后由敌方单位拖住波次时的行为（规格 M3 的提示部分 + M4 防卡关）：
 *
 * - 每波恰好一条 sys 提示（flashWarning(text, 'sys')）：还有目标、跟随标记；按地面 / 舰船 / 空中 /
 *   混合与单复数选词，中英双语；剩下的全都打不到（潜艇潜航）时改说潜艇潜航。
 *   不在进行中的波次里（jetsCleared 为 false：Boss 战、两波之间）绝不出现。
 * - 防卡关：只剩单位拖住波次、玩家 60 秒没打中任何敌方单位 → “残余目标脱离战区”告警，
 *   波次门控数归零；玩家每次打中敌方单位都重新计 60 秒（以前是 150 秒且从不重置）。
 * - UnitSystem.forEachAliveHostile：只访问存活的敌方单位，带作战域与“此刻能否被命中”。
 *
 * 单位都放在离玩家很远的地方：打不到玩家，潜艇也不会上浮。
 */

const FAR = 20000;
const STALL_SECONDS = 60;
const PLAYER = new THREE.Vector3(0, 300, 0);
const CJK = /[一-鿿]/;

const HOSTILE_TYPES = UNIT_TYPES.filter((type) => UNIT_CONFIGS[type].faction === Faction.ENEMY);
const NON_HOSTILE_TYPES = UNIT_TYPES.filter((type) => UNIT_CONFIGS[type].faction !== Faction.ENEMY);

/** 单位系统会调用的粒子特效：全部是空实现 */
function particleStub(): ParticleSystem {
  const noop = (): void => undefined;
  return new Proxy(
    {},
    { get: (_target, property) => (property === 'then' ? undefined : noop) }
  ) as unknown as ParticleSystem;
}

interface Rig {
  controller: UnitController;
  system: UnitSystem;
  flashWarning: ReturnType<typeof vi.fn>;
  spawn(type: UnitType): UnitInstance;
  /** 推进游戏时间；jetsCleared 是协调器每帧传进来的“本波敌机已清空” */
  tick(seconds: number, jetsCleared: boolean, dt?: number): void;
  /** 到目前为止的 sys 告警（双语原文） */
  sysWarnings(): LocalizedText[];
  /** “还有目标”提示（sys 告警里除去放行告警） */
  hints(): LocalizedText[];
  /** “残余目标脱离战区”放行告警 */
  releases(): LocalizedText[];
  dispose(): void;
}

function isRelease(text: LocalizedText): boolean {
  return /left the area/i.test(text.en);
}

async function createRig(): Promise<Rig> {
  const flashWarning = vi.fn();
  const presentation = {
    genericRadio: vi.fn(() => true),
    unitFirstContact: vi.fn(),
    onUnitEvent: vi.fn(),
    flashWarning,
    setMissileWarning: vi.fn(),
    setRadarRangeMultiplier: vi.fn(),
  };
  const controller = new UnitController({
    scene: new THREE.Scene(),
    presentation: presentation as unknown as ICampaignPresentation,
    awardKill: vi.fn(),
    applyPenalty: vi.fn(),
    onAssetLost: vi.fn(),
    damagePlayer: vi.fn(),
    onExplosion: vi.fn(),
    onEscortResult: vi.fn(),
  });
  const system = await controller.ensureLoaded(particleStub());
  const playerMesh = new THREE.Object3D();
  playerMesh.position.copy(PLAYER);
  let slot = 0;

  const sysWarnings = (): LocalizedText[] =>
    (flashWarning.mock.calls as Array<[HudText, HudWarningTone]>)
      .filter(([, tone]) => tone === 'sys')
      .map(([text]) => {
        expect(typeof text, 'warnings are handed over bilingual').toBe('object');
        return text as LocalizedText;
      });

  return {
    controller,
    system,
    flashWarning,
    spawn(type) {
      const air = UNIT_CONFIGS[type].domain === 'air';
      const position = new THREE.Vector3(FAR + slot * 600, air ? 400 : 0, FAR);
      slot++;
      const unit = system.spawnUnit(type, position);
      expect(unit, `spawnUnit(${type})`).not.toBeNull();
      return unit as UnitInstance;
    },
    tick(seconds, jetsCleared, dt = 0.5) {
      for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
        controller.update(dt, playerMesh, PLAYER, [], [], jetsCleared);
      }
    },
    sysWarnings,
    hints: () => sysWarnings().filter((text) => !isRelease(text)),
    releases: () => sysWarnings().filter(isRelease),
    dispose: () => controller.dispose(),
  };
}

describe('units holding a wave after the jets are gone', () => {
  let rig: Rig;
  const extraRigs: Rig[] = [];

  beforeEach(async () => {
    rig = await createRig();
  });

  afterEach(() => {
    rig.dispose();
    for (const extra of extraRigs.splice(0)) extra.dispose();
    resetLocale();
  });

  /** 一套全新的单位系统里，只剩这些单位时的那条提示 */
  async function hintFor(types: readonly UnitType[]): Promise<LocalizedText> {
    const fresh = await createRig();
    extraRigs.push(fresh);
    for (const type of types) fresh.spawn(type);
    fresh.tick(0.5, false);
    expect(fresh.sysWarnings(), 'nothing while jets are alive').toEqual([]);
    fresh.tick(0.5, true);
    const hints = fresh.hints();
    expect(hints, `one hint for ${types.join(' + ')}`).toHaveLength(1);
    return hints[0];
  }

  // ───────────────────────────── M3：提示 ─────────────────────────────

  describe('objective hint', () => {
    it('says once that a target remains and to follow the marker', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(5, false);
      expect(rig.sysWarnings(), 'jets still alive').toEqual([]);

      // 敌机清空的那一帧就提示
      rig.tick(0.5, true);
      const hints = rig.hints();
      expect(hints).toHaveLength(1);
      expectBilingual(hints[0], 'objective hint');
      expect(hints[0].en).toMatch(/remain/i);
      expect(hints[0].en).toMatch(/marker/i);
      expect(hints[0].zh).toMatch(CJK);
      expect(hints[0].zh).not.toBe(hints[0].en);

      // 之后不再重复
      rig.tick(40, true);
      expect(rig.hints()).toHaveLength(1);
    });

    it('uses the sys tone', () => {
      rig.spawn(UnitType.TANK);
      rig.tick(0.5, true);
      const tones = rig.flashWarning.mock.calls.map(([, tone]) => tone as HudWarningTone);
      expect(tones).toContain('sys');
      expect(rig.hints()).toHaveLength(1);
    });

    it('is not repeated when the jets-cleared flag flickers within one wave', () => {
      rig.spawn(UnitType.RADAR_STATION);
      for (let i = 0; i < 6; i++) {
        rig.tick(2, true);
        rig.tick(2, false);
      }
      expect(rig.hints()).toHaveLength(1);
    });

    it('is shown again in the next wave', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(1, true);
      expect(rig.hints()).toHaveLength(1);

      rig.controller.spawnForWave(1, 1, PLAYER);
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(3, false);
      expect(rig.hints(), 'new wave, jets still alive').toHaveLength(1);
      rig.tick(1, true);
      expect(rig.hints(), 'new wave, jets cleared').toHaveLength(2);
      rig.tick(20, true);
      expect(rig.hints(), 'still once per wave').toHaveLength(2);
    });

    it('is not shown when no hostile unit is left', () => {
      const tank = rig.spawn(UnitType.TANK);
      rig.spawn(UnitType.CIVILIAN_TRUCK);
      rig.spawn(UnitType.ALLY_FRIGATE);
      tank.applyDamage(1e6, 'missile');
      expect(tank.isAlive()).toBe(false);
      rig.tick(30, true);
      expect(rig.sysWarnings()).toEqual([]);
      expect(rig.controller.isObjectiveActive()).toBe(false);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
    });

    interface WordingCase {
      name: string;
      units: readonly UnitType[];
      domain: UnitDomain | 'mixed';
      plural: boolean;
    }

    const WORDING: readonly WordingCase[] = [
      { name: 'one ground unit', units: [UnitType.RADAR_STATION], domain: 'ground', plural: false },
      {
        name: 'two ground units',
        units: [UnitType.RADAR_STATION, UnitType.TANK],
        domain: 'ground',
        plural: true,
      },
      {
        name: 'three ground units',
        units: [UnitType.TANK, UnitType.AA_GUN, UnitType.SAM_LAUNCHER],
        domain: 'ground',
        plural: true,
      },
      { name: 'one ship', units: [UnitType.FRIGATE], domain: 'sea', plural: false },
      {
        name: 'two ships',
        units: [UnitType.FRIGATE, UnitType.GUNBOAT],
        domain: 'sea',
        plural: true,
      },
      { name: 'one air unit', units: [UnitType.BOMBER], domain: 'air', plural: false },
      {
        name: 'two air units',
        units: [UnitType.BOMBER, UnitType.ATTACK_HELICOPTER],
        domain: 'air',
        plural: true,
      },
      {
        name: 'a tank and a ship',
        units: [UnitType.TANK, UnitType.FRIGATE],
        domain: 'mixed',
        plural: true,
      },
      {
        name: 'a radar station and a bomber',
        units: [UnitType.RADAR_STATION, UnitType.BOMBER],
        domain: 'mixed',
        plural: true,
      },
      {
        name: 'ground, sea and air',
        units: [UnitType.GUNBOAT, UnitType.BOMBER, UnitType.TANK],
        domain: 'mixed',
        plural: true,
      },
    ];

    function expectWording(
      text: LocalizedText,
      domain: UnitDomain | 'mixed',
      plural: boolean
    ): void {
      const en = text.en;
      expectBilingual(text, 'hint');
      expect(en).toMatch(/remain/i);
      expect(en).toMatch(/marker/i);
      expect(text.zh).toMatch(CJK);

      const saysGround = /ground/i.test(en);
      const saysShip = /ship|vessel|naval/i.test(en);
      const saysAir = /\bair|aircraft/i.test(en);
      expect(
        { ground: saysGround, sea: saysShip, air: saysAir },
        `"${en}" names the ${domain} domain`
      ).toEqual({
        ground: domain === 'ground',
        sea: domain === 'sea',
        air: domain === 'air',
      });

      const pluralNoun = /\b(targets|ships|vessels|units)\b/i.test(en);
      const singularNoun = /\b(target|ship|vessel|unit)\b/i.test(en);
      if (plural) {
        expect(pluralNoun, `"${en}" is plural`).toBe(true);
        expect(singularNoun, `"${en}" is plural`).toBe(false);
      } else {
        expect(singularNoun, `"${en}" is singular`).toBe(true);
        expect(pluralNoun, `"${en}" is singular`).toBe(false);
      }
    }

    it.each(WORDING)('words the hint for $name', async ({ units, domain, plural }) => {
      expectWording(await hintFor(units), domain, plural);
    });

    it('uses a different wording for each domain and for one / several, in English', async () => {
      const texts = await Promise.all(
        [
          [UnitType.RADAR_STATION],
          [UnitType.RADAR_STATION, UnitType.TANK],
          [UnitType.FRIGATE],
          [UnitType.FRIGATE, UnitType.GUNBOAT],
          [UnitType.BOMBER],
          [UnitType.BOMBER, UnitType.ATTACK_HELICOPTER],
          [UnitType.TANK, UnitType.FRIGATE],
        ].map((units) => hintFor(units))
      );
      const english = texts.map((text) => text.en);
      expect(new Set(english).size, english.join(' | ')).toBe(english.length);
    });

    it('uses a different Chinese wording for ground, ship, air and mixed', async () => {
      const texts = await Promise.all(
        [
          [UnitType.RADAR_STATION],
          [UnitType.FRIGATE],
          [UnitType.BOMBER],
          [UnitType.TANK, UnitType.FRIGATE],
        ].map((units) => hintFor(units))
      );
      const chinese = texts.map((text) => text.zh);
      expect(new Set(chinese).size, chinese.join(' | ')).toBe(chinese.length);
      for (const zh of chinese) expect(zh).toMatch(CJK);
    });

    it('counts only living hostile units', async () => {
      const alone = await hintFor([UnitType.TANK]);

      // 平民 / 友军不算
      expect(
        await hintFor([
          UnitType.TANK,
          UnitType.CIVILIAN_TRUCK,
          UnitType.ALLY_FRIGATE,
          UnitType.ALLY_AWACS,
        ])
      ).toEqual(alone);

      // 已被击毁的不算
      const fresh = await createRig();
      extraRigs.push(fresh);
      fresh.spawn(UnitType.TANK);
      fresh.spawn(UnitType.FRIGATE).applyDamage(1e6, 'missile');
      fresh.spawn(UnitType.BOMBER).applyDamage(1e6, 'cannon');
      fresh.tick(0.5, true);
      expect(fresh.hints()).toEqual([alone]);
    });

    describe('submarine', () => {
      it('says the submarine is submerged when nothing that is left can be hit', async () => {
        const submarine = rig.spawn(UnitType.SUBMARINE);
        rig.tick(2, false);
        expect(submarine.isTargetable(), 'a far-away submarine stays submerged').toBe(false);
        expect(rig.controller.getWaveHoldCount(), 'it still holds the wave').toBe(1);

        rig.tick(0.5, true);
        const hints = rig.hints();
        expect(hints).toHaveLength(1);
        expectBilingual(hints[0], 'submerged hint');
        expect(hints[0].en).toMatch(/submarine/i);
        expect(hints[0].en).toMatch(/submerged/i);
        expect(hints[0].zh).toMatch(/潜/);
        expect(hints[0]).not.toEqual(await hintFor([UnitType.FRIGATE]));

        rig.tick(30, true);
        expect(rig.hints(), 'once per wave').toHaveLength(1);
      });

      it('uses the follow-the-marker hint when something else can still be hit', () => {
        const submarine = rig.spawn(UnitType.SUBMARINE);
        rig.spawn(UnitType.FRIGATE);
        rig.tick(2, false);
        expect(submarine.isTargetable()).toBe(false);

        rig.tick(0.5, true);
        const hints = rig.hints();
        expect(hints).toHaveLength(1);
        expect(hints[0].en).not.toMatch(/submerged/i);
        expect(hints[0].en).toMatch(/marker/i);
        expect(hints[0].en).toMatch(/ship/i);
      });
    });

    describe('outside an active wave (the coordinator passes jetsCleared = false)', () => {
      it('never shows the hint, never marks objectives and never releases the wave', () => {
        rig.spawn(UnitType.RADAR_STATION);
        rig.spawn(UnitType.TANK);
        rig.tick(200, false);
        expect(rig.sysWarnings()).toEqual([]);
        expect(rig.controller.isObjectiveActive()).toBe(false);
        expect(rig.controller.getWaveHoldCount()).toBe(2);
      });

      it('stays quiet in a boss fight, with boss drones in the air', () => {
        rig.spawn(UnitType.RADAR_STATION);
        rig.tick(1, true);
        expect(rig.hints()).toHaveLength(1);
        expect(rig.controller.isObjectiveActive()).toBe(true);

        // Boss 战开始：协调器清场；之后 Boss 召唤无人机
        rig.controller.clear();
        expect(rig.controller.isObjectiveActive()).toBe(false);
        expect(rig.controller.spawnBossDrone(new THREE.Vector3(FAR, 400, FAR))).toBe(true);
        expect(rig.controller.getAliveHostileCount()).toBeGreaterThan(0);

        rig.tick(120, false);
        expect(rig.hints(), 'no new hint during the boss fight').toHaveLength(1);
        expect(rig.releases()).toEqual([]);
        expect(rig.controller.isObjectiveActive()).toBe(false);
      });
    });
  });

  // ───────────────────────────── 目标状态 ─────────────────────────────

  describe('isObjectiveActive()', () => {
    it('is true only while the jets are cleared and a hostile unit still holds the wave', () => {
      const station = rig.spawn(UnitType.RADAR_STATION);
      expect(rig.controller.isObjectiveActive(), 'before any update').toBe(false);
      rig.tick(1, false);
      expect(rig.controller.isObjectiveActive(), 'jets alive').toBe(false);
      rig.tick(1, true);
      expect(rig.controller.isObjectiveActive(), 'jets cleared').toBe(true);
      rig.tick(1, false);
      expect(rig.controller.isObjectiveActive(), 'jets back').toBe(false);
      rig.tick(1, true);
      expect(rig.controller.isObjectiveActive()).toBe(true);

      station.applyDamage(1e6, 'rocket');
      rig.tick(0.5, true);
      expect(rig.controller.isObjectiveActive(), 'last unit destroyed').toBe(false);
    });

    it('ends when a new wave starts and when the field is cleared', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(1, true);
      expect(rig.controller.isObjectiveActive()).toBe(true);
      rig.controller.spawnForWave(1, 1, PLAYER);
      expect(rig.controller.isObjectiveActive(), 'new wave').toBe(false);

      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(1, true);
      expect(rig.controller.isObjectiveActive()).toBe(true);
      rig.controller.clear();
      expect(rig.controller.isObjectiveActive(), 'cleared').toBe(false);
    });

    it('ends when the wave is released by the stall protection', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(STALL_SECONDS - 2, true);
      expect(rig.controller.isObjectiveActive()).toBe(true);
      rig.tick(4, true);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
      expect(rig.controller.isObjectiveActive()).toBe(false);
      rig.tick(20, true);
      expect(rig.controller.isObjectiveActive()).toBe(false);
    });
  });

  // ───────────────────────────── M4：防卡关 ─────────────────────────────

  describe('stall protection', () => {
    it('releases the wave after 60 s without player damage: warning, hold count 0', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(STALL_SECONDS - 1, true);
      expect(rig.controller.getWaveHoldCount(), 'still held at 59 s').toBe(1);
      expect(rig.releases()).toEqual([]);

      rig.tick(2, true);
      expect(rig.controller.getWaveHoldCount(), 'released at 61 s').toBe(0);
      const releases = rig.releases();
      expect(releases).toHaveLength(1);
      expectBilingual(releases[0], 'release warning');
      expect(releases[0].en).toMatch(/remaining targets have left the area/i);
      expect(releases[0].zh).toMatch(CJK);

      // 提示在前，放行告警在后
      expect(rig.sysWarnings()).toEqual([rig.hints()[0], releases[0]]);
      // 单位还活着：只是不再拖住波次
      expect(rig.controller.getAliveHostileCount()).toBe(1);
    });

    it('warns only once and stays released for the rest of the wave', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(STALL_SECONDS + 1, true);
      expect(rig.releases()).toHaveLength(1);
      rig.tick(200, true);
      expect(rig.releases()).toHaveLength(1);
      expect(rig.hints()).toHaveLength(1);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
    });

    it('measures the 60 s in game time, whatever the frame rate', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(STALL_SECONDS - 1, true, 1 / 30);
      expect(rig.controller.getWaveHoldCount()).toBe(1);
      rig.tick(2, true, 1 / 30);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
    });

    const PLAYER_WEAPONS: readonly DamageSource[] = [
      'cannon',
      'missile',
      'rocket',
      'laser',
      'swarm',
      'railgun',
    ];

    it.each(PLAYER_WEAPONS)('a %s hit on a hostile unit restarts the 60 s', (weapon) => {
      const station = rig.spawn(UnitType.RADAR_STATION);
      rig.tick(50, true);
      station.applyDamage(1, weapon);
      expect(station.isAlive()).toBe(true);

      rig.tick(STALL_SECONDS - 1, true);
      expect(rig.controller.getWaveHoldCount(), '59 s after the hit (109 s in)').toBe(1);
      expect(rig.releases()).toEqual([]);

      rig.tick(2, true);
      expect(rig.controller.getWaveHoldCount(), '61 s after the hit').toBe(0);
      expect(rig.releases()).toHaveLength(1);
    });

    it('never releases the wave while the player keeps hitting a hostile unit', () => {
      const station = rig.spawn(UnitType.RADAR_STATION);
      for (let i = 0; i < 12; i++) {
        rig.tick(45, true);
        station.applyDamage(0.5, 'cannon');
      }
      expect(station.isAlive()).toBe(true);
      expect(rig.controller.getWaveHoldCount(), 'after 9 minutes of attacking').toBe(1);
      expect(rig.releases()).toEqual([]);
      expect(rig.controller.isObjectiveActive()).toBe(true);
    });

    it('a hit on any hostile unit counts, not only on the first', () => {
      rig.spawn(UnitType.RADAR_STATION);
      const tank = rig.spawn(UnitType.TANK);
      rig.tick(50, true);
      tank.applyDamage(1, 'missile');
      rig.tick(30, true);
      expect(rig.controller.getWaveHoldCount()).toBe(2);
      expect(rig.releases()).toEqual([]);
    });

    it.each(['enemy-fire', 'unit-fire', 'boss', 'collision'] as const)(
      'damage that is not the player’s (%s) does not restart it',
      (source) => {
        const station = rig.spawn(UnitType.RADAR_STATION);
        rig.tick(50, true);
        station.applyDamage(1, source);
        rig.tick(11, true);
        expect(rig.controller.getWaveHoldCount()).toBe(0);
        expect(rig.releases()).toHaveLength(1);
      }
    );

    it.each([UnitType.CIVILIAN_TRUCK, UnitType.ALLY_CONVOY])(
      'a player hit on %s (not hostile) does not restart it',
      (type) => {
        rig.spawn(UnitType.RADAR_STATION);
        const bystander = rig.spawn(type);
        rig.tick(50, true);
        bystander.applyDamage(1, 'cannon');
        rig.tick(11, true);
        expect(rig.controller.getWaveHoldCount()).toBe(0);
        expect(rig.releases()).toHaveLength(1);
      }
    );

    it('does not count the time while enemy jets are still alive', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(300, false);
      expect(rig.controller.getWaveHoldCount()).toBe(1);

      rig.tick(STALL_SECONDS - 1, true);
      expect(rig.controller.getWaveHoldCount(), '59 s after the jets were cleared').toBe(1);
      expect(rig.releases()).toEqual([]);
      rig.tick(2, true);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
    });

    it('needs no warning when the player destroys the last unit in time', () => {
      const station = rig.spawn(UnitType.RADAR_STATION);
      rig.tick(30, true);
      station.applyDamage(1e6, 'missile');
      expect(rig.controller.getWaveHoldCount()).toBe(0);
      rig.tick(120, true);
      expect(rig.releases()).toEqual([]);
    });

    it('also releases a wave held by a submarine that never surfaces', () => {
      const submarine = rig.spawn(UnitType.SUBMARINE);
      rig.tick(STALL_SECONDS - 1, true);
      expect(submarine.isTargetable()).toBe(false);
      expect(rig.controller.getWaveHoldCount()).toBe(1);
      rig.tick(2, true);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
      expect(rig.releases()).toHaveLength(1);
    });

    it('starts over in the next wave', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(STALL_SECONDS + 1, true);
      expect(rig.controller.getWaveHoldCount()).toBe(0);

      rig.controller.spawnForWave(1, 1, PLAYER);
      const held = rig.controller.getWaveHoldCount();
      expect(held, 'the units hold the new wave again').toBeGreaterThan(0);
      rig.tick(STALL_SECONDS - 1, true);
      expect(rig.controller.getWaveHoldCount(), '59 s into the new wave').toBeGreaterThan(0);
      expect(rig.releases()).toHaveLength(1);
      rig.tick(2, true);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
      expect(rig.releases()).toHaveLength(2);
    });

    it('starts over after a boss fight cleared the field', () => {
      rig.spawn(UnitType.RADAR_STATION);
      rig.tick(STALL_SECONDS + 1, true);
      expect(rig.controller.getWaveHoldCount()).toBe(0);
      rig.controller.clear();
      rig.spawn(UnitType.RADAR_STATION);
      expect(rig.controller.getWaveHoldCount()).toBe(1);
    });
  });

  // ───────────────────────────── forEachAliveHostile ─────────────────────────────

  describe('UnitSystem.forEachAliveHostile', () => {
    interface Visit {
      mesh: THREE.Object3D;
      health: number;
      maxHealth: number;
      domain: UnitDomain;
      targetable: boolean;
    }

    function visits(): Visit[] {
      const seen: Visit[] = [];
      rig.system.forEachAliveHostile((mesh, health, maxHealth, domain, targetable) => {
        seen.push({ mesh, health, maxHealth, domain, targetable });
      });
      return seen;
    }

    it('visits nothing when there are no units', () => {
      expect(visits()).toEqual([]);
    });

    it('visits every living hostile unit once, with its health and domain', () => {
      const units = HOSTILE_TYPES.filter((type) => type !== UnitType.SUBMARINE).map((type) =>
        rig.spawn(type)
      );
      const seen = visits();
      expect(seen.map((visit) => visit.mesh)).toEqual(units.map((unit) => unit.mesh));
      for (const [index, unit] of units.entries()) {
        const health = unit.getHealth();
        expect(seen[index].health, unit.type).toBe(health.current);
        expect(seen[index].maxHealth, unit.type).toBe(health.max);
        expect(seen[index].health).toBeGreaterThan(0);
        expect(seen[index].domain, unit.type).toBe(unit.domain);
        expect(seen[index].targetable, unit.type).toBe(true);
      }
      expect(new Set(seen.map((visit) => visit.domain))).toEqual(new Set(['ground', 'sea', 'air']));
      expect(seen).toHaveLength(rig.system.getAliveHostileCount());
    });

    it('never visits allied or civilian units', () => {
      for (const type of NON_HOSTILE_TYPES) rig.spawn(type);
      expect(NON_HOSTILE_TYPES.length).toBeGreaterThan(0);
      expect(visits()).toEqual([]);

      const tank = rig.spawn(UnitType.TANK);
      expect(visits().map((visit) => visit.mesh)).toEqual([tank.mesh]);
    });

    it('reports the current health of a damaged unit and drops a destroyed one', () => {
      const tank = rig.spawn(UnitType.TANK);
      const frigate = rig.spawn(UnitType.FRIGATE);
      const max = frigate.getHealth().max;
      frigate.applyDamage(max / 4, 'missile');

      const damaged = visits().find((visit) => visit.mesh === frigate.mesh);
      expect(damaged?.health).toBeCloseTo(max * 0.75, 5);
      expect(damaged?.maxHealth).toBe(max);

      tank.applyDamage(1e6, 'cannon');
      expect(visits().map((visit) => visit.mesh)).toEqual([frigate.mesh]);
      frigate.applyDamage(1e6, 'cannon');
      expect(visits()).toEqual([]);
    });

    it('reports a submerged submarine as alive but not targetable', () => {
      const submarine = rig.spawn(UnitType.SUBMARINE);
      const frigate = rig.spawn(UnitType.FRIGATE);
      rig.tick(2, false);
      expect(submarine.isTargetable()).toBe(false);

      const seen = visits();
      expect(seen).toHaveLength(2);
      expect(seen.find((visit) => visit.mesh === submarine.mesh)).toMatchObject({
        domain: 'sea',
        targetable: false,
      });
      expect(seen.find((visit) => visit.mesh === frigate.mesh)?.targetable).toBe(true);
      expect(rig.system.getAliveHostileCount(), 'the submarine still holds the wave').toBe(2);
    });

    it('feeds only the targetable ones to UnitController.forEachHostileMarker', () => {
      const submarine = rig.spawn(UnitType.SUBMARINE);
      const frigate = rig.spawn(UnitType.FRIGATE);
      rig.spawn(UnitType.CIVILIAN_SHIP);
      rig.tick(2, false);
      expect(submarine.isTargetable()).toBe(false);

      const marked: Array<[THREE.Object3D, number, number]> = [];
      rig.controller.forEachHostileMarker((mesh, health, maxHealth) => {
        marked.push([mesh, health, maxHealth]);
      });
      const health = frigate.getHealth();
      expect(marked).toEqual([[frigate.mesh, health.current, health.max]]);
    });
  });
});
