import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getLevelConfig } from '@/features/terrain/LevelConfig';
import { seededGameRandom } from './enemyFleetRig';
import { WaveRig, bearingDeg, bearingGapDeg, horizontalDistance, type WaveRecord } from './waveRig';

/**
 * 夹击（规格 §4a：arrival P = “从玩家看相隔 90–150° 的两路”）在玩家看到敌机现身时的角度，
 * 3c91868 之后的补充：
 * - 全速（45 米/秒）直飞，4 个航向；
 * - 玩家一直在转弯（0.1 / 0.3 rad/s，左右两个方向；巡航与全速）；
 * - 同一个随机状态、同一波、同一条航迹：两路的位置每次都一样（可复现）；
 * - 不同的夹击波次从同一个随机状态开始，两路的夹角不全相同（修复前每一波都是 90.2°）。
 *
 * 量法与 EnemyWaveLineups.test.ts 里巡航直飞的那条相同：每一架现身时，从玩家当时的位置看它
 * 那一路的群中心；一路的方位 = 这一路各架现身时的方位的圆周平均；两路方位之差在 90–150° 之间。
 * 只看玩家看到的结果，不读规划用的内部数值（预测时刻、抽样区间、每波的偏移）。
 */

// 每个用例要把全部 37 个夹击波次各打一遍
vi.setConfig({ testTimeout: 300_000 });

// 地形生成很重，这里用不到：换成一片平坦的海面
vi.mock('@/features/terrain/TerrainGenerator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/terrain/TerrainGenerator')>()),
  TerrainGenerator: vi.fn().mockImplementation(() => ({
    generateTerrain: vi.fn(),
    update: vi.fn(),
    updateLOD: vi.fn(),
    getCrashSurfaceY: vi.fn(() => 0),
    sampleSurface: vi.fn(() => ({ y: 0, kind: 'water' })),
    getSurfaceKind: vi.fn(() => 'water'),
    getEnvironment: vi.fn(() => null),
    dispose: vi.fn(),
  })),
}));

const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** 巡航速度（米/秒）：不推油门时稳定在最大速度的一半；基础最大速度 45 */
const CRUISE_SPEED = 22.5;
const FULL_SPEED = 45;
/** 开波前先飞的秒数（与协调器开场的 START_DELAY 一样，LevelManager 看得到航迹） */
const PREROLL_SECONDS = 2;

/** 全部夹击波次（关卡、波次 0 起） */
const PINCERS: ReadonlyArray<readonly [number, number]> = ALL_LEVELS.flatMap((level) =>
  (getLevelConfig(level)?.waves ?? [])
    .map((wave, index) => [level, index, wave.arrival] as const)
    .filter(([, , arrival]) => arrival === 'pincer')
    .map(([lvl, index]) => [lvl, index] as const)
);

function where(level: number, wave: number): string {
  return `level ${level} wave ${wave + 1}`;
}

let randomSpy: { mockRestore(): void } | null = null;
let canvasSpy: { mockRestore(): void } | null = null;

beforeAll(() => {
  // 敌机进场的传送门会试着画贴图：jsdom 没有 canvas，直接返回 null
  canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterAll(() => {
  canvasSpy?.mockRestore();
});

afterEach(() => {
  randomSpy?.mockRestore();
  randomSpy = null;
});

function useSeed(seed: number): void {
  randomSpy?.mockRestore();
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(seed));
}

function circularMeanDeg(bearings: readonly number[]): number {
  let x = 0;
  let z = 0;
  for (const bearing of bearings) {
    x += Math.sin(THREE.MathUtils.degToRad(bearing));
    z += Math.cos(THREE.MathUtils.degToRad(bearing));
  }
  return (THREE.MathUtils.radToDeg(Math.atan2(x, z)) + 360) % 360;
}

/** 夹击波次的两路在现身时（从玩家当时的位置看）的夹角（度） */
function arrivalGapDeg(record: WaveRecord): number {
  expect(record.centers.length, where(record.level, record.wave)).toBe(2);
  const bearings: number[][] = [[], []];
  for (const arrival of record.arrivals) {
    // 这一架属于离它最近的群中心（群内散布 60 米，两路相距远大于此）
    const side =
      horizontalDistance(arrival.position, record.centers[0]) <=
      horizontalDistance(arrival.position, record.centers[1])
        ? 0
        : 1;
    bearings[side].push(bearingDeg(arrival.playerAt, record.centers[side]));
  }
  expect(bearings[0].length * bearings[1].length, 'both groups arrived').toBeGreaterThan(0);
  return bearingGapDeg(circularMeanDeg(bearings[0]), circularMeanDeg(bearings[1]));
}

/** 玩家的飞法：起始航向（度）、速度（米/秒）、转弯角速度（rad/s，正 = 向左，0 = 直飞） */
interface Flight {
  headingDeg: number;
  speed: number;
  yawRate: number;
}

/**
 * 打一个夹击波次：玩家回到原点上空，按 flight 飞（开波前先飞 PREROLL_SECONDS），每架现身即击毁，
 * 打到本波结束为止
 */
async function playPincer(
  rig: WaveRig,
  level: number,
  wave: number,
  flight: Flight
): Promise<WaveRecord> {
  const heading = THREE.MathUtils.degToRad(flight.headingDeg);
  rig.player.set(0, 300, 0);
  rig.playerVelocity.set(Math.sin(heading) * flight.speed, 0, Math.cos(heading) * flight.speed);
  const up = new THREE.Vector3(0, 1, 0);
  const turn = flight.yawRate * rig.dt;
  rig.load(level, wave);
  const prerollSteps = Math.round(PREROLL_SECONDS / rig.dt);
  for (let i = 0; i < prerollSteps; i++) {
    rig.playerVelocity.applyAxisAngle(up, turn);
    await rig.step('on-arrival');
  }
  rig.start();
  const record = rig.records[rig.records.length - 1];
  expect([record.level, record.wave]).toEqual([level, wave]);
  const steps = Math.round(60 / rig.dt);
  for (let i = 0; i < steps && Number.isNaN(record.completedAt); i++) {
    rig.playerVelocity.applyAxisAngle(up, turn);
    await rig.step('on-arrival');
  }
  expect(record.arrivals.length, where(level, wave)).toBe(
    getLevelConfig(level)?.waves[wave].lineup.length
  );
  return record;
}

interface Sweep {
  failures: string[];
  checked: number;
  narrowest: number;
  widest: number;
}

/** 每一个夹击波次，按每一种飞法各打一遍，量现身时的夹角 */
async function sweep(flights: readonly Flight[]): Promise<Sweep> {
  const result: Sweep = { failures: [], checked: 0, narrowest: 180, widest: 0 };
  for (const flight of flights) {
    const rig = new WaveRig();
    try {
      for (const [level, wave] of PINCERS) {
        const gap = arrivalGapDeg(await playPincer(rig, level, wave, flight));
        result.checked++;
        result.narrowest = Math.min(result.narrowest, gap);
        result.widest = Math.max(result.widest, gap);
        if (gap < 90 - 1e-6 || gap > 150 + 1e-6) {
          result.failures.push(
            `${where(level, wave)}, heading ${flight.headingDeg}°, ${flight.speed} m/s, turn ${flight.yawRate} rad/s: ${gap.toFixed(1)}°`
          );
        }
      }
    } finally {
      rig.dispose();
    }
  }
  return result;
}

function summary(result: Sweep): string {
  return `${result.failures.length} of ${result.checked} pincers out of range; seen ${result.narrowest.toFixed(1)}–${result.widest.toFixed(1)}°`;
}

describe('a pincer as the player sees it when the jets arrive (spec §4a), beyond cruise-speed straight flight', () => {
  it('the table has pincer waves to check (test self-check)', () => {
    expect(PINCERS.length).toBeGreaterThan(30);
  });

  it('every pincer of every level arrives 90–150° apart, whichever way the player is flying at full speed', async () => {
    useSeed(4501);
    const result = await sweep(
      [0, 90, 180, 270].map((headingDeg) => ({ headingDeg, speed: FULL_SPEED, yawRate: 0 }))
    );
    expect(result.checked).toBe(PINCERS.length * 4);
    expect(result.failures, summary(result)).toEqual([]);
  });

  it.each([
    ['gently (0.1 rad/s)', 0.1],
    ['hard (0.3 rad/s)', 0.3],
  ] as const)(
    'every pincer of every level arrives 90–150° apart while the player keeps turning %s, left or right, at cruise or full speed',
    async (_name, rate) => {
      useSeed(4502);
      const flights: Flight[] = [];
      for (const speed of [CRUISE_SPEED, FULL_SPEED]) {
        for (const yawRate of [rate, -rate]) flights.push({ headingDeg: 0, speed, yawRate });
      }
      const result = await sweep(flights);
      expect(result.checked).toBe(PINCERS.length * flights.length);
      expect(result.failures, summary(result)).toEqual([]);
    }
  );
});

describe('pincer planning is reproducible, and differs from wave to wave', () => {
  /** 一个波次在开波时规划的两路群中心与每架的现身位置（文本，便于整体比较） */
  function fingerprint(record: WaveRecord): string[] {
    return [
      ...record.centers.map((center) => `center ${center.x.toFixed(6)} ${center.z.toFixed(6)}`),
      ...record.arrivals.map(
        (arrival) =>
          `${arrival.type} at ${arrival.position.x.toFixed(6)} ${arrival.position.z.toFixed(6)} t ${arrival.time.toFixed(2)}`
      ),
    ];
  }

  it('the same random state, the same wave and the same flight give the same two groups and the same arrivals, for every pincer', async () => {
    const flight: Flight = { headingDeg: 30, speed: CRUISE_SPEED, yawRate: 0.1 };
    const runs: string[][][] = [];
    for (let run = 0; run < 2; run++) {
      const rig = new WaveRig();
      const prints: string[][] = [];
      try {
        for (const [level, wave] of PINCERS) {
          useSeed(1000 + level * 10 + wave);
          prints.push(fingerprint(await playPincer(rig, level, wave, flight)));
        }
      } finally {
        rig.dispose();
      }
      runs.push(prints);
    }
    expect(runs[0].length).toBe(PINCERS.length);
    runs[0].forEach((print, index) => {
      const [level, wave] = PINCERS[index];
      expect(print.length, where(level, wave)).toBeGreaterThan(2);
      expect(runs[1][index], where(level, wave)).toEqual(print);
    });
  });

  it('different pincer waves started from the same random state are not all planned at one angle', async () => {
    const rig = new WaveRig();
    const gaps: Array<{ wave: string; gap: number }> = [];
    try {
      for (const [level, wave] of PINCERS) {
        rig.player.set(0, 300, 0);
        rig.playerVelocity.set(0, 0, 0);
        rig.load(level, wave);
        // 每一波都从同一个随机状态开始
        useSeed(777);
        rig.start();
        const record = rig.records[rig.records.length - 1];
        expect([record.level, record.wave]).toEqual([level, wave]);
        expect(record.centers.length, where(level, wave)).toBe(2);
        gaps.push({
          wave: where(level, wave),
          gap: bearingGapDeg(
            bearingDeg(record.playerAtStart, record.centers[0]),
            bearingDeg(record.playerAtStart, record.centers[1])
          ),
        });
      }
    } finally {
      rig.dispose();
    }
    const values = gaps.map((entry) => entry.gap);
    const distinct = new Set(values.map((gap) => gap.toFixed(1)));
    const spread = Math.max(...values) - Math.min(...values);
    const listing = gaps.map((entry) => `${entry.wave}: ${entry.gap.toFixed(1)}°`).join(', ');
    // 仍在 90–150° 之内（玩家不动，开波时的规划就是玩家看到的角度）
    for (const entry of gaps) {
      expect(entry.gap, entry.wave).toBeGreaterThanOrEqual(90 - 1e-6);
      expect(entry.gap, entry.wave).toBeLessThanOrEqual(150 + 1e-6);
    }
    expect(distinct.size, listing).toBeGreaterThan(PINCERS.length / 2);
    expect(spread, listing).toBeGreaterThanOrEqual(10);
  });
});
