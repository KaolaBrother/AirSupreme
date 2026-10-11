import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ALPINE_FIELD,
  CITY_POND,
  DESERT_OASIS,
  DRY_HEIGHT,
  LAKE_FIELD,
  NAVIGABLE_HEIGHT,
  disposeTerrains,
  isDryLandTruth,
  isStaticIce,
  terrainFor,
  volcanoTruth,
} from './groundPlacementRig';

/**
 * TerrainGenerator.sampleSurface 的 land 标志（契约 §1）：
 * - water 仍表示「船只可航行」（湖区 heightAt < -2），不变；
 * - land 只在地面肉眼可见地高出水面且不是熔岩时为 true：湖区 / 雪山 heightAt >= 0.5；
 *   第 6 关既非水也非熔岩；第 7 关静态冰体；海洋关岛屿；沙漠 / 城市除绿洲 / 公园池塘外。
 * 真值来自独立的 Heightfield / VolcanoEnvironment / ArcticField 实例，不读被测的 land。
 * 采样：战场 ±1300 米、步长 50 米的网格（2809 点）；池塘周围 5 米细网格。
 */

const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** 读取 land（基线上字段不存在 → undefined，断言自然失败；不依赖类型声明） */
function landAt(level: number, x: number, z: number): unknown {
  const sample: object = terrainFor(level).sampleSurface(x, z);
  return (sample as { land?: unknown }).land;
}

function waterAt(level: number, x: number, z: number): boolean {
  return terrainFor(level).sampleSurface(x, z).water;
}

function battlefieldGrid(step = 50): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let x = -1300; x <= 1300; x += step) {
    for (let z = -1300; z <= 1300; z += step) {
      points.push([x, z]);
    }
  }
  return points;
}

function localGrid(cx: number, cz: number, half: number, step: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      points.push([cx + x, cz + z]);
    }
  }
  return points;
}

/** 网格上 land 与期望不符的点（最多列出 8 个，另附总数） */
function landMismatches(
  level: number,
  points: ReadonlyArray<[number, number]>,
  expected: (x: number, z: number) => boolean
): string[] {
  const mismatches: string[] = [];
  let total = 0;
  for (const [x, z] of points) {
    const land = landAt(level, x, z);
    if (land !== expected(x, z)) {
      total++;
      if (mismatches.length < 8) mismatches.push(`(${x}, ${z}) land=${String(land)}`);
    }
  }
  if (total > mismatches.length) mismatches.push(`... ${total} mismatches in total`);
  return mismatches;
}

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
});

afterAll(() => {
  disposeTerrains();
  vi.restoreAllMocks();
});

describe('sampleSurface land flag on known points', () => {
  it('level 1: the lake centre is navigable water and not land', () => {
    expect(LAKE_FIELD.heightAt(0, 0)).toBeLessThan(NAVIGABLE_HEIGHT);
    expect(waterAt(1, 0, 0)).toBe(true);
    expect(landAt(1, 0, 0)).toBe(false);
  });

  it('level 1: shallows (-2 <= heightAt < 0.5) are neither land nor navigable water', () => {
    const shallows = battlefieldGrid().filter(([x, z]) => {
      const height = LAKE_FIELD.heightAt(x, z);
      return height >= NAVIGABLE_HEIGHT && height < DRY_HEIGHT;
    });
    expect(shallows.length).toBeGreaterThan(10);
    const wrong = shallows
      .filter(([x, z]) => landAt(1, x, z) !== false || waterAt(1, x, z) !== false)
      .map(([x, z]) => `(${x}, ${z}) land=${String(landAt(1, x, z))} water=${waterAt(1, x, z)}`);
    expect(wrong.slice(0, 8), `${wrong.length} of ${shallows.length} shallow points`).toEqual([]);
  });

  it('level 1: dry valley ground well above the water line is land', () => {
    const dry = battlefieldGrid().find(([x, z]) => LAKE_FIELD.heightAt(x, z) > 10);
    expect(dry).toBeDefined();
    const [x, z] = dry ?? [0, 0];
    expect(landAt(1, x, z)).toBe(true);
    expect(waterAt(1, x, z)).toBe(false);
  });

  it('level 3: the alpine lake is not land, although ships cannot sail it', () => {
    expect(ALPINE_FIELD.heightAt(330, -300)).toBeLessThan(DRY_HEIGHT);
    expect(landAt(3, 330, -300)).toBe(false);
    expect(waterAt(3, 330, -300)).toBe(false);
  });

  it('level 6: a lava lake is neither land nor water; the sea is water, not land', () => {
    expect(volcanoTruth().surfaceKindAt(470, -330)).toBe('lava');
    expect(landAt(6, 470, -330)).toBe(false);
    expect(waterAt(6, 470, -330)).toBe(false);
    expect(waterAt(6, 1300, 1300)).toBe(true);
    expect(landAt(6, 1300, 1300)).toBe(false);
  });

  it('level 7: open sea is not land; a tabular iceberg is land', () => {
    expect(isStaticIce(0, 0)).toBe(false);
    expect(waterAt(7, 0, 0)).toBe(true);
    expect(landAt(7, 0, 0)).toBe(false);
    expect(isStaticIce(-640, -430)).toBe(true);
    expect(waterAt(7, -640, -430)).toBe(false);
    expect(landAt(7, -640, -430)).toBe(true);
  });

  it('level 4: open ocean is not land; island ground is land', () => {
    expect(waterAt(4, 0, 0)).toBe(true);
    expect(landAt(4, 0, 0)).toBe(false);
    const island = battlefieldGrid(20).find(([x, z]) => !waterAt(4, x, z));
    expect(island, 'an island inside the battlefield').toBeDefined();
    const [x, z] = island ?? [0, 0];
    expect(landAt(4, x, z)).toBe(true);
  });

  it('level 2: the oasis pond is not land, the open desert is land, nothing is navigable', () => {
    expect(landAt(2, DESERT_OASIS.x, DESERT_OASIS.z)).toBe(false);
    expect(waterAt(2, DESERT_OASIS.x, DESERT_OASIS.z)).toBe(false);
    expect(landAt(2, -600, 600)).toBe(true);
    expect(waterAt(2, -600, 600)).toBe(false);
  });

  it('level 5: the park pond is not land, the city ground is land, nothing is navigable', () => {
    expect(landAt(5, CITY_POND.x, CITY_POND.z)).toBe(false);
    expect(waterAt(5, CITY_POND.x, CITY_POND.z)).toBe(false);
    expect(landAt(5, 600, 600)).toBe(true);
    expect(waterAt(5, 600, 600)).toBe(false);
  });
});

describe('sampleSurface land flag across the battlefield', () => {
  it('level 1: land is exactly heightAt >= 0.5 and water is still exactly heightAt < -2', () => {
    const grid = battlefieldGrid();
    expect(landMismatches(1, grid, (x, z) => LAKE_FIELD.heightAt(x, z) >= DRY_HEIGHT)).toEqual([]);
    const waterWrong = grid.filter(
      ([x, z]) => waterAt(1, x, z) !== LAKE_FIELD.heightAt(x, z) < NAVIGABLE_HEIGHT
    );
    expect(waterWrong.length).toBe(0);
  });

  it('level 3: land is exactly heightAt >= 0.5 and nothing is navigable', () => {
    const grid = battlefieldGrid();
    expect(landMismatches(3, grid, (x, z) => ALPINE_FIELD.heightAt(x, z) >= DRY_HEIGHT)).toEqual(
      []
    );
    expect(grid.filter(([x, z]) => waterAt(3, x, z))).toEqual([]);
    expect(grid.some(([x, z]) => ALPINE_FIELD.heightAt(x, z) < DRY_HEIGHT)).toBe(true);
  });

  it('level 6: land is exactly where surfaceKindAt is neither water nor lava', () => {
    const volcano = volcanoTruth();
    const grid = battlefieldGrid();
    expect(
      landMismatches(6, grid, (x, z) => {
        const kind = volcano.surfaceKindAt(x, z);
        return kind !== 'water' && kind !== 'lava';
      })
    ).toEqual([]);
    expect(grid.some(([x, z]) => volcano.surfaceKindAt(x, z) === 'lava')).toBe(true);
    // water 仍是可航行海面（岛外水深 >= 2 米），与 isWater 一致
    expect(grid.filter(([x, z]) => waterAt(6, x, z) !== volcano.isWater(x, z))).toEqual([]);
  });

  it('level 7: land is exactly the static ice, and water is still the open sea', () => {
    const grid = battlefieldGrid();
    expect(landMismatches(7, grid, (x, z) => isStaticIce(x, z))).toEqual([]);
    expect(grid.filter(([x, z]) => waterAt(7, x, z) === isStaticIce(x, z))).toEqual([]);
  });

  it('level 4: land is exactly the island ground (not navigable water)', () => {
    expect(landMismatches(4, battlefieldGrid(25), (x, z) => !waterAt(4, x, z))).toEqual([]);
  });

  it('levels 2 and 5: land is false on the visible pond and true away from it', () => {
    for (const [level, pond, clear] of [
      [2, DESERT_OASIS, 60],
      [5, CITY_POND, 90],
    ] as const) {
      const generator = terrainFor(level);
      // 池塘水面（不规则岸线以内）一律不是陆地
      const pondGrid = localGrid(pond.x, pond.z, 80, 5).filter(
        ([x, z]) => !isDryLandTruth(level, generator, x, z)
      );
      expect(pondGrid.length, `level ${level} pond samples`).toBeGreaterThan(20);
      expect(
        landMismatches(level, pondGrid, () => false),
        `level ${level} pond`
      ).toEqual([]);
      // 离池塘中心 clear 米以外的战场全是陆地
      const away = battlefieldGrid().filter(([x, z]) => Math.hypot(x - pond.x, z - pond.z) > clear);
      expect(
        landMismatches(level, away, () => true),
        `level ${level} away`
      ).toEqual([]);
    }
  });

  it.each(ALL_LEVELS)(
    'level %i: land is a boolean everywhere and never overlaps navigable water',
    (level) => {
      const problems: string[] = [];
      for (const [x, z] of battlefieldGrid(100)) {
        const sample: object = terrainFor(level).sampleSurface(x, z);
        const { land, water } = sample as { land?: unknown; water: boolean };
        if (typeof land !== 'boolean' || (land && water)) {
          problems.push(`(${x}, ${z}) land=${String(land)} water=${water}`);
        }
      }
      expect(problems.slice(0, 8), `${problems.length} bad samples`).toEqual([]);
      expect(Number.isFinite(terrainFor(level).sampleSurface(0, 0).y)).toBe(true);
    }
  );
});
