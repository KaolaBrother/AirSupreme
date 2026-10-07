import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCampaignChapter } from '@/features/campaign/CampaignData';
import {
  DEFAULT_LEVEL_SCENE_CONFIG,
  LEVELS,
  TerrainType,
  getLevelConfig,
  type LevelPostFxConfig,
} from '@/features/terrain/LevelConfig';
import { TerrainGenerator, WORLDSCAPE_WATER_Y } from '@/features/terrain/TerrainGenerator';
import {
  createTerrainEnvironment,
  hasTerrainEnvironment,
  sampleEnvironmentSurface,
  type TerrainEnvironment,
} from '@/features/terrain/environments';

/** api-spec §1 的关卡表 */
const LEVEL_TABLE: ReadonlyArray<[number, string, TerrainType, number]> = [
  [1, '湖畔晨曦', TerrainType.LAKE, 5],
  [2, '沙漠风暴', TerrainType.DESERT, 5],
  [3, '雪山之巅', TerrainType.MOUNTAINS, 6],
  [4, '深海决战', TerrainType.OCEAN, 6],
  [5, '城市废墟', TerrainType.CITY, 7],
  [6, '熔炉之心', TerrainType.VOLCANO, 7],
  [7, '极光冰海', TerrainType.ARCTIC, 7],
  [8, '雷霆峡谷', TerrainType.CANYON, 7],
  [9, '天梯之巅', TerrainType.STRATOSPHERE, 7],
  [10, '神谕核心', TerrainType.CITADEL, 8],
];
const NEW_TERRAINS: readonly TerrainType[] = [
  TerrainType.VOLCANO,
  TerrainType.ARCTIC,
  TerrainType.CANYON,
  TerrainType.STRATOSPHERE,
  TerrainType.CITADEL,
];
const POST_FX_KEYS: ReadonlyArray<keyof LevelPostFxConfig> = [
  'exposure',
  'contrast',
  'saturation',
  'bloomStrength',
  'vignetteStrength',
];

/** 覆盖整个战场的采样网格（±1400 米，步长 100 米） */
function battlefieldGrid(): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let x = -1400; x <= 1400; x += 100) {
    for (let z = -1400; z <= 1400; z += 100) {
      points.push([x, z]);
    }
  }
  return points;
}

function environmentFor(terrain: TerrainType): TerrainEnvironment {
  const environment = createTerrainEnvironment(terrain);
  expect(environment, `environment for ${terrain}`).not.toBeNull();
  return environment as TerrainEnvironment;
}

describe('LEVELS (api-spec §1)', () => {
  it('lists levels 1..10 in order with the spec names, terrains and wave counts', () => {
    expect(LEVELS.map((level) => [level.id, level.name, level.terrain, level.totalWaves])).toEqual(
      LEVEL_TABLE
    );
  });

  it.each(LEVEL_TABLE)('level %i name equals the campaign chapter title', (id, name) => {
    expect(getCampaignChapter(id).title).toBe(name);
    expect(getLevelConfig(id)?.name).toBe(name);
  });

  it('has one positive enemy count per wave', () => {
    for (const level of LEVELS) {
      expect(level.enemiesPerWave, `level ${level.id}`).toHaveLength(level.totalWaves);
      for (const count of level.enemiesPerWave) {
        expect(Number.isInteger(count) && count > 0, `level ${level.id}: ${count}`).toBe(true);
      }
    }
  });

  it('sets the legacy difficulty field to 10 on levels 6-10', () => {
    for (const level of LEVELS.filter((config) => config.id >= 6)) {
      expect(level.difficulty, `level ${level.id}`).toBe(10);
    }
  });

  it('gives every level finite, tuned post-processing values', () => {
    for (const level of LEVELS) {
      for (const key of POST_FX_KEYS) {
        const value = level.postFx[key];
        expect(Number.isFinite(value), `level ${level.id} ${key}`).toBe(true);
        expect(value, `level ${level.id} ${key}`).toBeGreaterThanOrEqual(0);
      }
      expect(level.postFx.exposure).toBeGreaterThan(0);
      expect(level.postFx.contrast).toBeGreaterThan(0);
      expect(level.postFx.saturation).toBeGreaterThan(0);
      // 每关都要有自己的调色，不能停留在默认的恒等值
      expect(level.postFx, `level ${level.id}`).not.toEqual(DEFAULT_LEVEL_SCENE_CONFIG.postFx);
    }
  });

  it('uses the storm preset (rain + lightning) on the canyon level', () => {
    expect(getLevelConfig(8)?.weather.preset).toBe('storm');
  });

  it('adds the five new terrain types in the same upper-case style', () => {
    for (const terrain of NEW_TERRAINS) {
      expect(TerrainType[terrain as keyof typeof TerrainType]).toBe(terrain);
    }
    expect(Object.values(TerrainType)).toHaveLength(10);
    expect(getLevelConfig(11)).toBeUndefined();
  });
});

describe('terrain environment modules (levels 6-10)', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('are registered for exactly the five new terrains', () => {
    for (const terrain of Object.values(TerrainType)) {
      const expected = NEW_TERRAINS.includes(terrain);
      expect(hasTerrainEnvironment(terrain), terrain).toBe(expected);
      if (!expected) expect(createTerrainEnvironment(terrain), terrain).toBeNull();
    }
    for (const terrain of NEW_TERRAINS) {
      const environment = environmentFor(terrain);
      expect(environment.terrain).toBe(terrain);
      expect(environment.root).toBeInstanceOf(THREE.Group);
      environment.dispose();
    }
  });

  it('only the volcano sea, arctic sea and canyon river carry navigable water', () => {
    const hasWater = NEW_TERRAINS.map((terrain) => [terrain, environmentFor(terrain).hasWater]);
    expect(hasWater).toEqual([
      [TerrainType.VOLCANO, true],
      [TerrainType.ARCTIC, true],
      [TerrainType.CANYON, true],
      [TerrainType.STRATOSPHERE, false],
      [TerrainType.CITADEL, false],
    ]);
  });

  it.each([TerrainType.STRATOSPHERE, TerrainType.CITADEL])(
    '%s is never water anywhere on the battlefield',
    (terrain) => {
      const environment = environmentFor(terrain);
      for (const [x, z] of battlefieldGrid()) {
        expect(environment.isWater(x, z), `${x},${z}`).toBe(false);
        expect(sampleEnvironmentSurface(environment, x, z, WORLDSCAPE_WATER_Y).water).toBe(false);
      }
    }
  );

  // 火山岛的解析场随模块创建、build() 不替换；冰海的静态冰体由固定种子生成（漂移浮冰不参与采样），
  // 因此两者的采样结果不依赖 build()，这里不构建网格以保持测试轻量。
  it('VOLCANO: a sea all around a high island', () => {
    const environment = environmentFor(TerrainType.VOLCANO);
    for (const [x, z] of [
      [1400, 1400],
      [-1400, 1400],
      [1400, -1400],
      [-1400, -1400],
    ] as const) {
      expect(sampleEnvironmentSurface(environment, x, z, WORLDSCAPE_WATER_Y), `${x},${z}`).toEqual({
        y: WORLDSCAPE_WATER_Y,
        water: true,
      });
    }
    const center = sampleEnvironmentSurface(environment, 0, 0, WORLDSCAPE_WATER_Y);
    expect(center.water).toBe(false);
    const summit = Math.max(...battlefieldGrid().map(([x, z]) => environment.sampleHeight(x, z)));
    expect(summit).toBeGreaterThan(WORLDSCAPE_WATER_Y + 200);
  });

  it('ARCTIC: open sea between solid ice', () => {
    const environment = environmentFor(TerrainType.ARCTIC);
    const samples = battlefieldGrid().map(([x, z]) =>
      sampleEnvironmentSurface(environment, x, z, WORLDSCAPE_WATER_Y)
    );
    const sea = samples.filter((sample) => sample.water);
    const ice = samples.filter((sample) => !sample.water);
    expect(sea.length).toBeGreaterThan(ice.length);
    expect(ice.length).toBeGreaterThan(0);
    expect(ice.some((sample) => sample.y > WORLDSCAPE_WATER_Y)).toBe(true);
  });

  it.each(NEW_TERRAINS)(
    '%s samples water at the water level and land at or above it',
    (terrain) => {
      const environment = environmentFor(terrain);
      for (const [x, z] of battlefieldGrid()) {
        const sample = sampleEnvironmentSurface(environment, x, z, WORLDSCAPE_WATER_Y);
        expect(Number.isFinite(sample.y), `${terrain} ${x},${z}`).toBe(true);
        if (sample.water) {
          expect(sample.y).toBe(WORLDSCAPE_WATER_Y);
        } else if (environment.hasWater) {
          expect(sample.y).toBeGreaterThanOrEqual(WORLDSCAPE_WATER_Y);
        }
      }
      expect(sampleEnvironmentSurface(environment, Number.NaN, 0, WORLDSCAPE_WATER_Y)).toEqual({
        y: WORLDSCAPE_WATER_Y,
        water: false,
      });
      expect(Number.isFinite(environment.sampleHeight(Infinity, 0))).toBe(true);
      expect(environment.isWater(Number.NaN, Number.NaN)).toBe(false);
    }
  );
});

describe('TerrainGenerator on the canyon level (one build)', () => {
  let scene: THREE.Scene;
  let generator: TerrainGenerator;

  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    scene = new THREE.Scene();
    generator = new TerrainGenerator(scene);
    generator.generateTerrain(getLevelConfig(8) as NonNullable<ReturnType<typeof getLevelConfig>>);
  });

  afterAll(() => {
    if (generator.getEnvironment()) generator.clearTerrain();
    vi.restoreAllMocks();
  });

  it('keeps the world water level at -48', () => {
    expect(WORLDSCAPE_WATER_Y).toBe(-48);
  });

  it('puts the spawn point over the river, which is navigable water', () => {
    expect(generator.sampleSurface(0, 0)).toEqual({ y: WORLDSCAPE_WATER_Y, water: true });
    expect(generator.getSurfaceKind(0, 0)).toBe('water');
  });

  it('is mostly dry canyon ground and rock away from the river', () => {
    const samples = battlefieldGrid().map(([x, z]) => generator.sampleSurface(x, z));
    const dry = samples.filter((sample) => !sample.water);
    expect(dry.length).toBeGreaterThan(samples.length / 2);
    expect(Math.max(...dry.map((sample) => sample.y))).toBeGreaterThan(WORLDSCAPE_WATER_Y + 50);
  });

  it('getCrashSurfaceY matches sampleSurface().y', () => {
    for (const [x, z] of battlefieldGrid()) {
      expect(generator.getCrashSurfaceY(x, z), `${x},${z}`).toBe(generator.sampleSurface(x, z).y);
    }
  });

  it('answers non-finite input with the water level and no water', () => {
    expect(generator.sampleSurface(Number.NaN, 0)).toEqual({ y: WORLDSCAPE_WATER_Y, water: false });
    expect(generator.sampleSurface(0, Infinity)).toEqual({ y: WORLDSCAPE_WATER_Y, water: false });
  });

  it('exposes the canyon environment and its convoy route', () => {
    const environment = generator.getEnvironment();
    expect(environment?.terrain).toBe(TerrainType.CANYON);
    const withRoute = environment as TerrainEnvironment & {
      getConvoyRoute?: () => readonly THREE.Vector3[];
    };
    const route = withRoute.getConvoyRoute?.() ?? [];
    expect(route.length).toBeGreaterThanOrEqual(2);
    for (const point of route) {
      expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
    }
  });

  it('clearTerrain() drops the environment and falls back to the water level (runs last)', () => {
    const environment = generator.getEnvironment();
    expect(environment?.root.parent).not.toBeNull();

    generator.clearTerrain();
    expect(generator.getEnvironment()).toBeNull();
    expect(environment?.root.parent ?? null).toBeNull();
    expect(generator.sampleSurface(0, 0)).toEqual({ y: WORLDSCAPE_WATER_Y, water: false });
    expect(generator.getCrashSurfaceY(0, 0)).toBe(WORLDSCAPE_WATER_Y);
  });
});
