import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeclaredHitRadius, type DamageSource } from '@/core/CombatContracts';
import { getLevelScaling } from '@/core/Difficulty';
import { Faction } from '@/core/Faction';
import { UNIT_FIRST_CONTACT_RADIO } from '@/features/campaign/CampaignData';
import { LEVELS, TerrainType } from '@/features/terrain/LevelConfig';
import { getWaveDeployment, type UnitPlacement } from '@/features/units/UnitDeployments';
import { createUnitMesh } from '@/features/units/UnitMeshFactory';
import { UnitSystem, type UnitInstance, type UnitUpdateContext } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UnitType, type UnitRadarKind } from '@/features/units/UnitTypes';

const ALL_TYPES = Object.values(UnitType);
const HOSTILE_TYPES: readonly UnitType[] = [
  UnitType.TANK,
  UnitType.SAM_LAUNCHER,
  UnitType.AA_GUN,
  UnitType.RADAR_STATION,
  UnitType.GUNBOAT,
  UnitType.FRIGATE,
  UnitType.SUBMARINE,
  UnitType.ATTACK_HELICOPTER,
  UnitType.BOMBER,
  UnitType.DRONE,
];
const ALLY_TYPES: readonly UnitType[] = [
  UnitType.ALLY_CONVOY,
  UnitType.ALLY_FRIGATE,
  UnitType.ALLY_AWACS,
  UnitType.ALLY_TRANSPORT,
];
const CIVILIAN_TYPES: readonly UnitType[] = [
  UnitType.CIVILIAN_AIRLINER,
  UnitType.CIVILIAN_SHIP,
  UnitType.CIVILIAN_TRUCK,
];
const PLAYER_SOURCES: readonly DamageSource[] = [
  'cannon',
  'missile',
  'rocket',
  'laser',
  'swarm',
  'railgun',
  'emp',
];
const OTHER_SOURCES: readonly DamageSource[] = ['enemy-fire', 'unit-fire', 'boss', 'collision'];
const PLACEMENTS: readonly UnitPlacement[] = [
  'ahead',
  'flank',
  'around',
  'water',
  'route',
  'high-altitude',
];
/** api-spec §1：这些地形没有可航行水域 */
const DRY_TERRAINS: readonly TerrainType[] = [
  TerrainType.DESERT,
  TerrainType.MOUNTAINS,
  TerrainType.CITY,
  TerrainType.CANYON,
  TerrainType.STRATOSPHERE,
  TerrainType.CITADEL,
];
const LEVEL_IDS = LEVELS.map((level) => level.id);
const KILL = 1e6;

function makeContext(position: THREE.Vector3): UnitUpdateContext {
  const playerMesh = new THREE.Object3D();
  playerMesh.position.copy(position);
  return { playerMesh, playerPosition: position, enemyAirMeshes: [], friendlyAirMeshes: [] };
}

function simulate(units: UnitSystem, ctx: UnitUpdateContext, seconds: number, dt = 0.1): void {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    units.updateWithContext(dt, ctx);
  }
}

function spawn(units: UnitSystem, type: UnitType, x: number, y: number, z: number): UnitInstance {
  const unit = units.spawnUnit(type, new THREE.Vector3(x, y, z));
  expect(unit, `spawnUnit(${type})`).not.toBeNull();
  return unit as UnitInstance;
}

function countTypes(types: readonly UnitType[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const type of types) {
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

describe('UnitTypes', () => {
  it('configures all 17 unit types', () => {
    expect(ALL_TYPES).toHaveLength(17);
    for (const type of ALL_TYPES) {
      const config = UNIT_CONFIGS[type];
      expect(config.type, type).toBe(type);
      expect(config.name.length, type).toBeGreaterThan(0);
      expect(config.health, type).toBeGreaterThan(0);
      expect(config.hitRadius, type).toBeGreaterThan(0);
      expect(config.speed, type).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts hostiles in ENEMY, allies in FRIENDLY and civilians in CIVILIAN', () => {
    for (const type of HOSTILE_TYPES) expect(UNIT_CONFIGS[type].faction, type).toBe(Faction.ENEMY);
    for (const type of ALLY_TYPES) expect(UNIT_CONFIGS[type].faction, type).toBe(Faction.FRIENDLY);
    for (const type of CIVILIAN_TYPES)
      expect(UNIT_CONFIGS[type].faction, type).toBe(Faction.CIVILIAN);
    expect(HOSTILE_TYPES.length + ALLY_TYPES.length + CIVILIAN_TYPES.length).toBe(ALL_TYPES.length);
  });

  it('scores only hostile kills and penalises only lost allies and civilians', () => {
    for (const type of HOSTILE_TYPES) {
      expect(UNIT_CONFIGS[type].scoreValue, type).toBeGreaterThan(0);
      expect(UNIT_CONFIGS[type].penalty, type).toBe(0);
    }
    for (const type of [...ALLY_TYPES, ...CIVILIAN_TYPES]) {
      expect(UNIT_CONFIGS[type].scoreValue, type).toBe(0);
      expect(UNIT_CONFIGS[type].penalty, type).toBeGreaterThan(0);
    }
  });

  it('marks exactly the convoy and the transport as escorts', () => {
    const escorts = ALL_TYPES.filter((type) => UNIT_CONFIGS[type].isEscort);
    expect(escorts.sort()).toEqual([UnitType.ALLY_CONVOY, UnitType.ALLY_TRANSPORT].sort());
  });

  it('derives the radar kind from faction and domain', () => {
    const expected = (type: UnitType): UnitRadarKind => {
      const { faction, domain } = UNIT_CONFIGS[type];
      if (faction === Faction.FRIENDLY) return 'ally';
      if (faction === Faction.CIVILIAN) return 'neutral';
      return domain === 'ground' ? 'enemy-ground' : domain === 'sea' ? 'enemy-sea' : 'enemy-air';
    };
    for (const type of ALL_TYPES) {
      expect(UNIT_CONFIGS[type].radarKind, type).toBe(expected(type));
    }
  });

  it('first-contact radio lines are keyed by real unit types', () => {
    for (const key of Object.keys(UNIT_FIRST_CONTACT_RADIO)) {
      expect(ALL_TYPES as string[], key).toContain(key);
    }
  });
});

describe('createUnitMesh', () => {
  it.each(ALL_TYPES)('%s declares its unit type and hit radius', (type) => {
    const mesh = createUnitMesh(type);
    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.userData.unitType).toBe(type);
    expect(mesh.userData.hitRadius).toBe(UNIT_CONFIGS[type].hitRadius);
    expect(getDeclaredHitRadius(mesh, -1)).toBe(UNIT_CONFIGS[type].hitRadius);
  });
});

describe('getWaveDeployment', () => {
  it.each(LEVEL_IDS)('level %i deploys units on every wave and none past the last', (id) => {
    const totalWaves = LEVELS.find((level) => level.id === id)?.totalWaves ?? 0;
    for (let wave = 0; wave < totalWaves; wave++) {
      const specs = getWaveDeployment(id, wave);
      expect(specs.length, `level ${id} wave ${wave}`).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(ALL_TYPES, `level ${id} wave ${wave}`).toContain(spec.type);
        expect(Number.isInteger(spec.count) && spec.count > 0).toBe(true);
        expect(PLACEMENTS).toContain(spec.placement);
      }
    }
    expect(getWaveDeployment(id, totalWaves)).toEqual([]);
  });

  it('returns [] for invalid levels and waves', () => {
    expect(getWaveDeployment(0, 0)).toEqual([]);
    expect(getWaveDeployment(11, 0)).toEqual([]);
    expect(getWaveDeployment(1, -1)).toEqual([]);
    expect(getWaveDeployment(Number.NaN, 0)).toEqual([]);
    expect(getWaveDeployment(1, 0.5)).toEqual([]);
  });

  it('returns fresh copies the caller may modify', () => {
    const first = getWaveDeployment(1, 0);
    const original = first.map((spec) => ({ ...spec }));
    first[0].count = 99;
    first.length = 0;
    expect(getWaveDeployment(1, 0)).toEqual(original);
  });

  it('deploys no sea units on levels without navigable water', () => {
    for (const level of LEVELS.filter((config) => DRY_TERRAINS.includes(config.terrain))) {
      for (let wave = 0; wave < level.totalWaves; wave++) {
        for (const spec of getWaveDeployment(level.id, wave)) {
          expect(UNIT_CONFIGS[spec.type].domain, `level ${level.id} ${spec.type}`).not.toBe('sea');
        }
      }
    }
  });
});

describe('UnitSystem.spawnForWave (no surface sampler)', () => {
  const scene = new THREE.Scene();
  const player = new THREE.Vector3(0, 120, 0);
  let units: UnitSystem;

  beforeAll(() => {
    units = new UnitSystem(scene, null);
  });

  afterAll(() => {
    units.dispose();
  });

  it.each(LEVEL_IDS)('level %i spawns exactly each wave deployment', (id) => {
    const totalWaves = LEVELS.find((level) => level.id === id)?.totalWaves ?? 0;
    for (let wave = 0; wave < totalWaves; wave++) {
      const specs = getWaveDeployment(id, wave);
      const expected: UnitType[] = specs.flatMap((spec) =>
        Array.from({ length: spec.count }, () => spec.type)
      );

      const spawned = units.spawnForWave(id, wave, player);
      const where = `level ${id} wave ${wave}`;
      expect(countTypes(spawned.map((unit) => unit.type)), where).toEqual(countTypes(expected));
      for (const unit of spawned) {
        expect(unit.faction, where).toBe(UNIT_CONFIGS[unit.type].faction);
        expect(unit.domain, where).toBe(UNIT_CONFIGS[unit.type].domain);
        expect(unit.config).toBe(UNIT_CONFIGS[unit.type]);
        expect(unit.isAlive(), where).toBe(true);
        expect(unit.mesh.parent, where).toBe(scene);
        const position = unit.getPosition();
        expect(Number.isFinite(position.x + position.y + position.z), where).toBe(true);
      }
      expect(units.getAliveHostileCount(), where).toBe(
        expected.filter((type) => UNIT_CONFIGS[type].faction === Faction.ENEMY).length
      );

      units.clear();
      expect(units.getUnits(), where).toEqual([]);
      expect(scene.children, where).toEqual([]);
    }
  });

  it('returns [] for a level or wave without a deployment', () => {
    expect(units.spawnForWave(11, 0, player)).toEqual([]);
    expect(units.spawnForWave(1, 99, player)).toEqual([]);
    expect(scene.children).toEqual([]);
  });
});

describe('UnitSystem behaviour', () => {
  let scene: THREE.Scene;
  let units: UnitSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    units = new UnitSystem(scene, null);
  });

  afterEach(() => {
    units.dispose();
  });

  it('a submerged submarine is alive but not targetable until it surfaces', () => {
    const player = new THREE.Vector3(0, 150, 0);
    const sub = spawn(units, UnitType.SUBMARINE, 300, -48, 0);

    expect(sub.isAlive()).toBe(true);
    expect(sub.isTargetable()).toBe(false);
    expect(units.getCombatTargets()).not.toContain(sub);
    expect(units.getHostileMeshes()).not.toContain(sub.mesh);
    expect(units.getAliveHostileCount()).toBe(1);
    expect(units.applyAreaDamage(sub.getPosition(), 50, 100, 'rocket')).toBe(0);
    expect(sub.getHealth().current).toBe(sub.getHealth().max);

    // 潜航 3-8 秒后在玩家附近上浮
    const ctx = makeContext(player);
    for (let i = 0; i < 150 && !sub.isTargetable(); i++) {
      units.updateWithContext(0.1, ctx);
    }
    expect(sub.isTargetable()).toBe(true);
    expect(units.getCombatTargets()).toContain(sub);
    expect(units.getHostileMeshes()).toContain(sub.mesh);
  });

  it('getCombatTargets lists alive, targetable units of every faction', () => {
    const tank = spawn(units, UnitType.TANK, 100, 0, 0);
    const convoy = spawn(units, UnitType.ALLY_CONVOY, -100, 0, 0);
    const truck = spawn(units, UnitType.CIVILIAN_TRUCK, 0, 0, 100);

    const targets = units.getCombatTargets();
    expect(targets).toEqual(expect.arrayContaining([tank, convoy, truck]));
    expect(targets).toHaveLength(3);
    for (const target of targets) {
      expect(target.hitRadius).toBeGreaterThan(0);
    }

    expect(units.getHostileMeshes()).toEqual([tank.mesh]);
    expect(units.getFriendlyMeshes()).toEqual([convoy.mesh]);
    expect(units.getCivilianMeshes()).toEqual([truck.mesh]);

    tank.applyDamage(KILL, 'cannon');
    expect(units.getCombatTargets()).not.toContain(tank);
    expect(units.getHostileMeshes()).toEqual([]);
  });

  it('findByMesh matches the root or any descendant', () => {
    const tank = spawn(units, UnitType.TANK, 0, 0, 0);
    let descendant: THREE.Object3D | null = null;
    tank.mesh.traverse((child) => {
      if (child !== tank.mesh && !descendant) descendant = child;
    });

    expect(units.findByMesh(tank.mesh)).toBe(tank);
    expect(descendant).not.toBeNull();
    expect(units.findByMesh(descendant as unknown as THREE.Object3D)).toBe(tank);
    expect(units.findByMesh(new THREE.Object3D())).toBeNull();
  });

  describe('damage attribution', () => {
    it.each(PLAYER_SOURCES)('a kill by %s counts as byPlayer', (source) => {
      const onUnitDestroyed = vi.fn();
      units.onUnitDestroyed = onUnitDestroyed;
      const tank = spawn(units, UnitType.TANK, 0, 0, 0);

      tank.applyDamage(KILL, source);
      expect(tank.isAlive()).toBe(false);
      expect(onUnitDestroyed).toHaveBeenCalledTimes(1);
      const [unit, position, byPlayer] = onUnitDestroyed.mock.calls[0] as [
        UnitInstance,
        THREE.Vector3,
        boolean,
      ];
      expect(unit).toBe(tank);
      expect(position).toBeInstanceOf(THREE.Vector3);
      expect(byPlayer).toBe(true);

      tank.applyDamage(KILL, source);
      expect(onUnitDestroyed).toHaveBeenCalledTimes(1);
    });

    it.each(OTHER_SOURCES)('a kill by %s does not count as byPlayer', (source) => {
      const onUnitDestroyed = vi.fn();
      units.onUnitDestroyed = onUnitDestroyed;
      const convoy = spawn(units, UnitType.ALLY_CONVOY, 0, 0, 0);

      convoy.applyDamage(KILL, source);
      expect(onUnitDestroyed).toHaveBeenCalledTimes(1);
      expect(onUnitDestroyed.mock.calls[0][2]).toBe(false);
    });

    it('a player kill on an ally is attributed to the player (for the penalty)', () => {
      const onUnitDestroyed = vi.fn();
      units.onUnitDestroyed = onUnitDestroyed;
      const convoy = spawn(units, UnitType.ALLY_CONVOY, 0, 0, 0);
      convoy.applyDamage(KILL, 'missile');
      expect(onUnitDestroyed.mock.calls[0][2]).toBe(true);
    });

    it('reports a destroyed escort as a failed escort', () => {
      const onEscortResult = vi.fn();
      units.onEscortResult = onEscortResult;
      const convoy = spawn(units, UnitType.ALLY_CONVOY, 0, 0, 0);
      convoy.applyDamage(KILL, 'enemy-fire');
      expect(onEscortResult).toHaveBeenCalledWith(false, convoy);
    });

    it('onCivilianHit fires on the first player hit, throttled per unit', () => {
      const onCivilianHit = vi.fn();
      units.onCivilianHit = onCivilianHit;
      const ship = spawn(units, UnitType.CIVILIAN_SHIP, 0, -48, 300);
      const truck = spawn(units, UnitType.CIVILIAN_TRUCK, 200, 0, 0);

      ship.applyDamage(5, 'unit-fire');
      expect(onCivilianHit).not.toHaveBeenCalled();

      ship.applyDamage(5, 'cannon');
      ship.applyDamage(5, 'cannon');
      expect(onCivilianHit).toHaveBeenCalledTimes(1);
      expect(onCivilianHit).toHaveBeenCalledWith(ship);

      truck.applyDamage(5, 'laser');
      expect(onCivilianHit).toHaveBeenCalledTimes(2);
      expect(onCivilianHit).toHaveBeenLastCalledWith(truck);
    });

    it('onFirstContact fires once per type and survives clear()', () => {
      const onFirstContact = vi.fn();
      units.onFirstContact = onFirstContact;
      spawn(units, UnitType.TANK, 0, 0, 0);
      spawn(units, UnitType.TANK, 50, 0, 0);
      spawn(units, UnitType.DRONE, 0, 150, 0);
      expect(onFirstContact.mock.calls.map((call) => call[0])).toEqual([
        UnitType.TANK,
        UnitType.DRONE,
      ]);

      units.clear();
      spawn(units, UnitType.TANK, 0, 0, 0);
      expect(onFirstContact).toHaveBeenCalledTimes(2);
    });
  });

  describe('area effects', () => {
    it('player-sourced area damage spares friendlies but hits enemies and civilians', () => {
      const tank = spawn(units, UnitType.TANK, 10, 0, 0);
      const convoy = spawn(units, UnitType.ALLY_CONVOY, -10, 0, 0);
      const truck = spawn(units, UnitType.CIVILIAN_TRUCK, 0, 0, 10);
      const far = spawn(units, UnitType.TANK, 900, 0, 0);

      const hit = units.applyAreaDamage(new THREE.Vector3(0, 0, 0), 40, 20, 'rocket');
      expect(hit).toBe(2);
      expect(tank.getHealth().current).toBeLessThan(tank.getHealth().max);
      expect(truck.getHealth().current).toBeLessThan(truck.getHealth().max);
      expect(convoy.getHealth().current).toBe(convoy.getHealth().max);
      expect(far.getHealth().current).toBe(far.getHealth().max);
    });

    it.each(['enemy-fire', 'boss'] as const)(
      '%s area damage spares enemy units but hits allies and civilians',
      (source) => {
        const tank = spawn(units, UnitType.TANK, 10, 0, 0);
        const convoy = spawn(units, UnitType.ALLY_CONVOY, -10, 0, 0);
        const truck = spawn(units, UnitType.CIVILIAN_TRUCK, 0, 0, 10);

        expect(units.applyAreaDamage(new THREE.Vector3(0, 0, 0), 40, 20, source)).toBe(2);
        expect(tank.getHealth().current).toBe(tank.getHealth().max);
        expect(convoy.getHealth().current).toBeLessThan(convoy.getHealth().max);
        expect(truck.getHealth().current).toBeLessThan(truck.getHealth().max);
      }
    );

    it('applyAreaStun stuns only enemy units in range and returns the count', () => {
      const near = spawn(units, UnitType.TANK, 20, 0, 0);
      const drone = spawn(units, UnitType.DRONE, 0, 60, 30);
      const far = spawn(units, UnitType.TANK, 800, 0, 0);
      const convoy = spawn(units, UnitType.ALLY_CONVOY, -20, 0, 0);
      const truck = spawn(units, UnitType.CIVILIAN_TRUCK, 0, 0, -20);

      expect(units.applyAreaStun(new THREE.Vector3(0, 0, 0), 100, 4)).toBe(2);
      expect(near.isStunned()).toBe(true);
      expect(drone.isStunned()).toBe(true);
      expect(far.isStunned()).toBe(false);
      expect(convoy.isStunned()).toBe(false);
      expect(truck.isStunned()).toBe(false);
    });

    it('rejects invalid area-effect arguments with 0', () => {
      spawn(units, UnitType.TANK, 0, 0, 0);
      const origin = new THREE.Vector3();
      const nan = new THREE.Vector3(Number.NaN, 0, 0);
      expect(units.applyAreaDamage(nan, 50, 10, 'rocket')).toBe(0);
      expect(units.applyAreaDamage(origin, 0, 10, 'rocket')).toBe(0);
      expect(units.applyAreaDamage(origin, 50, 0, 'rocket')).toBe(0);
      expect(units.applyAreaStun(nan, 50, 3)).toBe(0);
      expect(units.applyAreaStun(origin, 50, 0)).toBe(0);
      expect(units.destroyMissilesInRadius(nan, 50)).toBe(0);
      expect(units.destroyMissilesInRadius(origin, 0)).toBe(0);
    });

    it('a SAM locks, launches at the player, and EMP clears its missile', () => {
      const player = new THREE.Vector3(300, 150, 0);
      const ctx = makeContext(player);
      const phases: string[] = [];
      units.onLockWarning = (_unit, phase) => phases.push(phase);
      spawn(units, UnitType.SAM_LAUNCHER, 0, 0, 0);

      for (let i = 0; i < 150 && units.getIncomingMissiles().length === 0; i++) {
        units.updateWithContext(0.1, ctx);
      }
      const incoming = units.getIncomingMissiles();
      expect(incoming.length).toBeGreaterThan(0);
      expect(incoming.some((missile) => missile.targetIsPlayer)).toBe(true);
      expect(phases.slice(0, 2)).toEqual(['locking', 'launched']);

      expect(units.destroyMissilesInRadius(new THREE.Vector3(5000, 0, 5000), 10)).toBe(0);
      const missilePosition = incoming[0].position.clone();
      expect(units.destroyMissilesInRadius(missilePosition, 50)).toBeGreaterThanOrEqual(1);
      expect(
        units
          .getIncomingMissiles()
          .some((missile) => missile.position.distanceTo(missilePosition) < 1)
      ).toBe(false);
    });
  });

  it('getAliveHostileCount gates the wave on enemy units only', () => {
    const first = spawn(units, UnitType.TANK, 0, 0, 0);
    const second = spawn(units, UnitType.AA_GUN, 100, 0, 0);
    spawn(units, UnitType.ALLY_CONVOY, -100, 0, 0);
    spawn(units, UnitType.CIVILIAN_TRUCK, 0, 0, 100);
    expect(units.getAliveHostileCount()).toBe(2);

    first.applyDamage(KILL, 'cannon');
    expect(units.getAliveHostileCount()).toBe(1);
    second.applyDamage(KILL, 'rocket');
    expect(units.getAliveHostileCount()).toBe(0);
  });

  it('radar station and AWACS change the radar figures only while alive', () => {
    expect(units.getHostileRadarBonus()).toBe(0);
    expect(units.getRadarRangeMultiplier()).toBe(1);

    const radar = spawn(units, UnitType.RADAR_STATION, 0, 0, 0);
    const awacs = spawn(units, UnitType.ALLY_AWACS, 0, 300, 0);
    expect(units.getHostileRadarBonus()).toBeGreaterThan(0);
    expect(units.getRadarRangeMultiplier()).toBeGreaterThan(1);

    radar.applyDamage(KILL, 'cannon');
    awacs.applyDamage(KILL, 'enemy-fire');
    expect(units.getHostileRadarBonus()).toBe(0);
    expect(units.getRadarRangeMultiplier()).toBe(1);
  });

  it('getRadarBlips reports each alive unit with its radar kind', () => {
    spawn(units, UnitType.TANK, 0, 0, 0);
    spawn(units, UnitType.GUNBOAT, 0, -48, 300);
    spawn(units, UnitType.ALLY_AWACS, 0, 300, 0);
    spawn(units, UnitType.CIVILIAN_AIRLINER, 100, 250, 0);
    const dead = spawn(units, UnitType.DRONE, 50, 150, 0);
    dead.applyDamage(KILL, 'cannon');

    const kinds = units
      .getRadarBlips()
      .map((blip) => blip.kind)
      .sort();
    expect(kinds).toEqual(['ally', 'enemy-ground', 'enemy-sea', 'neutral'].sort());
  });

  it('setLevelScaling scales enemy unit health', () => {
    const scaling = getLevelScaling(10);
    units.setLevelScaling(scaling);
    const tank = spawn(units, UnitType.TANK, 0, 0, 0);
    expect(tank.getHealth().max).toBeCloseTo(
      UNIT_CONFIGS[UnitType.TANK].health * scaling.unitHealthMultiplier,
      6
    );
    expect(tank.getHealth().current).toBe(tank.getHealth().max);
  });

  it('update(dt) alone is a no-op; updateWithContext drives the units', () => {
    const tank = spawn(units, UnitType.TANK, 400, 0, 0);
    const start = tank.getPosition();
    units.update(5);
    expect(tank.getPosition().equals(start)).toBe(true);

    simulate(units, makeContext(new THREE.Vector3(0, 120, 0)), 3);
    expect(tank.getPosition().distanceTo(start)).toBeGreaterThan(0);
  });

  it('keeps unit positions finite when the player position is NaN', () => {
    units.spawnForWave(10, 7, new THREE.Vector3(0, 120, 0));
    const ctx = makeContext(new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN));
    expect(() => simulate(units, ctx, 2)).not.toThrow();
    for (const unit of units.getUnits()) {
      const p = unit.getPosition();
      expect(Number.isFinite(p.x + p.y + p.z), unit.type).toBe(true);
    }
  });

  it('clear() after a busy fight leaves the scene empty', () => {
    const player = new THREE.Vector3(0, 120, 0);
    units.spawnForWave(10, 7, player);
    simulate(units, makeContext(player), 3);

    units.clear();
    expect(scene.children).toEqual([]);
    expect(units.getUnits()).toEqual([]);
    expect(units.getCombatTargets()).toEqual([]);
    expect(units.getAliveHostileCount()).toBe(0);
    expect(units.getIncomingMissiles()).toEqual([]);
  });

  it('dispose() empties the scene and is safe to repeat', () => {
    units.spawnForWave(5, 4, new THREE.Vector3(0, 120, 0));
    expect(scene.children.length).toBeGreaterThan(0);
    units.dispose();
    expect(scene.children).toEqual([]);
    expect(() => units.dispose()).not.toThrow();
  });
});
