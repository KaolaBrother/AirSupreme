import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { getLevelScaling } from '@/core/Difficulty';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { LevelWaveEventType, getLevelConfig } from '@/features/terrain/LevelConfig';
import { seededGameRandom } from './enemyFleetRig';
import {
  WaveRig,
  bearingDeg,
  bearingGapDeg,
  countTypes,
  describeTypes,
  horizontalDistance,
  type WaveRecord,
} from './waveRig';

/**
 * 敌机舰队 M3：逐波写定的编成（规格 §4a）。
 *
 * 两层检查：
 * - 配置表（LEVELS）本身满足 §4a 的 8 条固定规则里能从表上看出来的部分；
 * - 真实的生成路径（LevelManager：开波 → 按出场间隔开传送门 → 敌机现身 → 清场 → 下一波）每一波
 *   带来的正是这一份编成，按写定的方式到场（一群 / 两路夹击 / 鱼贯而入）。整场战役从第 1 关
 *   第 1 波打到第 10 关最后一波（两波之间的间隔照常走完），另用不同的随机种子从读档入口逐波
 *   再打一遍。
 *
 * 首次遭遇提示（规则 8）见 EnemyFirstContactHints.test.ts，精英歼灭的目标计数（规则 5 的另一半）
 * 见 EnemyEliteHunt.test.ts。
 */

// 整场战役要推进上万步；机器上同时跑着别的测试时会慢很多
vi.setConfig({ testTimeout: 300_000, hookTimeout: 600_000 });

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

const { SCOUT, FIGHTER, HEAVY, SNIPER, ACE, STRIKER, JAMMER, WRAITH } = EnemyType;
const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** 规格 §4a 的缩写 */
const ABBREVIATIONS: Record<string, EnemyType> = {
  Sc: SCOUT,
  Fi: FIGHTER,
  He: HEAVY,
  Sn: SNIPER,
  Ac: ACE,
  St: STRIKER,
  Ja: JAMMER,
  Wr: WRAITH,
};

type ArrivalLetter = 'G' | 'P' | 'T';
type EventLetter = 'I' | 'E' | 'D' | null;

interface SpecWave {
  jets: Map<EnemyType, number>;
  arrival: ArrivalLetter;
  event: EventLetter;
  text: string;
}

/** '2 Sc + 1 Fi' → { SCOUT: 2, FIGHTER: 1 } */
function w(text: string, arrival: ArrivalLetter, event: EventLetter = null): SpecWave {
  const jets = new Map<EnemyType, number>();
  for (const part of text.split('+')) {
    const match = /^\s*(\d+)\s+(\w\w)\s*$/.exec(part);
    if (!match) throw new Error(`bad line-up "${text}"`);
    const type = ABBREVIATIONS[match[2]];
    if (!type) throw new Error(`bad abbreviation "${match[2]}"`);
    jets.set(type, (jets.get(type) ?? 0) + Number(match[1]));
  }
  return { jets, arrival, event, text };
}

/**
 * 规格 §4a “Starting line-ups”（实现者报告与起始编成没有出入）。标了 *(start)*：平衡调整时
 * 可以换机型 / 改到场方式（须报告）——那时改这张表，下面按规则写的检查不用动。
 */
const SPEC_LINEUPS: Record<number, SpecWave[]> = {
  1: [
    w('2 Sc', 'G'),
    w('3 Sc', 'P', 'I'),
    w('2 Sc + 1 Fi', 'G', 'I'),
    w('2 Sc + 2 Fi', 'P', 'I'),
    w('2 Fi + 2 Sc', 'T', 'I'),
  ],
  2: [
    w('2 Sc + 1 Fi', 'G'),
    w('2 Fi + 1 Sc + 1 Sn', 'G', 'I'),
    w('2 Sn + 2 Fi + 1 Sc', 'P', 'E'),
    w('1 He + 2 Fi + 2 Sc', 'G', 'D'),
    w('1 He + 1 Sn + 2 Fi + 1 Sc', 'P', 'I'),
  ],
  3: [
    w('2 Fi + 1 Sc', 'G'),
    w('1 He + 1 Sn + 2 Fi', 'G', 'E'),
    w('4 Sc', 'P', 'I'),
    w('1 Ac + 2 Fi + 1 Sc', 'G', 'D'),
    w('1 Ac + 1 He + 1 Sn + 2 Fi', 'P', 'E'),
    w('1 Ac + 2 Fi + 2 Sc', 'P', 'I'),
  ],
  4: [
    w('2 Fi + 2 Sc', 'P'),
    w('1 St + 2 Fi + 1 Sc', 'G', 'I'),
    w('1 St + 1 He + 1 Sn + 2 Fi', 'G', 'E'),
    w('2 He + 2 Fi + 1 Sc', 'T', 'D'),
    w('2 St + 2 Sc + 1 Fi', 'P', 'I'),
    w('1 Ac + 1 St + 1 Sn + 2 Fi', 'P', 'E'),
  ],
  5: [
    w('2 Fi + 2 Sc', 'G'),
    w('1 Ja + 1 He + 2 Fi', 'G', 'E'),
    w('3 Sc + 1 Sn', 'P', 'I'),
    w('1 Ja + 1 St + 2 Fi + 1 Sc', 'G', 'D'),
    w('1 Ac + 1 Ja + 1 Sn + 2 Fi', 'P', 'E'),
    w('2 St + 1 Ja + 2 Sc', 'P', 'I'),
    w('1 Ac + 1 He + 1 Ja + 2 Fi', 'T', 'D'),
  ],
  6: [
    w('3 Fi + 2 Sc', 'P'),
    w('2 Sn + 2 Fi + 1 Sc', 'G', 'I'),
    w('1 Ja + 2 St + 2 Fi', 'G', 'E'),
    w('2 Sn + 3 Sc', 'P', 'I'),
    w('2 He + 1 Ja + 2 Fi + 1 Sc', 'T', 'D'),
    w('1 Ac + 2 Sn + 2 Fi + 1 Sc', 'P', 'I'),
    w('1 Ac + 1 Ja + 2 St + 1 He + 1 Fi', 'P', 'E'),
  ],
  7: [
    w('2 Fi + 2 Sc', 'G'),
    w('1 Wr + 2 Fi + 1 Sc', 'G', 'D'),
    w('1 Wr + 2 Sc + 1 Sn + 1 Fi', 'P', 'I'),
    w('1 Wr + 1 Ac + 1 He + 2 Fi', 'G', 'E'),
    w('1 Ja + 1 St + 1 Wr + 2 Fi', 'P', 'D'),
    w('2 Sn + 1 Wr + 2 Sc', 'P', 'I'),
    w('1 Ac + 1 Wr + 1 St + 1 Ja + 2 Fi', 'P', 'E'),
  ],
  8: [
    w('2 Wr + 2 Fi', 'G'),
    w('2 Ac + 2 Fi + 1 Sc', 'P', 'D'),
    w('2 Wr + 1 He + 1 Sn + 1 Ja', 'G', 'E'),
    w('2 St + 1 Ja + 2 Fi', 'P', 'D'),
    w('2 Ac + 3 Sc', 'P', 'I'),
    w('2 Wr + 2 Sn + 2 Fi', 'P', 'D'),
    w('2 Ac + 2 Wr + 1 St + 1 Ja', 'P', 'E'),
  ],
  9: [
    w('2 Ac + 2 Fi', 'P'),
    w('2 Sn + 1 Wr + 2 Sc', 'P', 'I'),
    w('2 St + 1 Ja + 1 He + 1 Fi', 'G', 'D'),
    w('2 Ac + 2 Wr + 1 Ja', 'P', 'E'),
    w('3 Sc + 2 Sn + 1 Wr', 'P', 'I'),
    w('2 He + 2 St + 1 Ja + 1 Ac', 'T', 'D'),
    w('2 Ac + 2 Wr + 1 St + 1 Sn', 'P', 'E'),
  ],
  10: [
    w('2 Ac + 2 Fi', 'P'),
    w('2 Wr + 1 Ja + 1 He + 1 Sn', 'G', 'E'),
    w('3 Sc + 2 Sn', 'P', 'I'),
    w('2 St + 1 Ja + 2 Fi', 'P', 'D'),
    w('2 Ac + 2 Wr + 1 He + 1 Ja', 'P', 'E'),
    w('2 He + 2 St + 1 Sn + 1 Ja', 'T', 'E'),
    w('2 Sn + 2 Wr + 2 Sc', 'P', 'I'),
    w('2 Ac + 2 Wr + 1 St + 1 Ja', 'P', 'D'),
  ],
};

/** 规则 1：第 1-9 关的 enemiesPerWave 不变（这一轮开始前的值，规格 §4a 各关标题里的数组） */
const UNCHANGED_ENEMIES_PER_WAVE: Record<number, number[]> = {
  1: [2, 3, 3, 4, 4],
  2: [3, 4, 5, 5, 5],
  3: [3, 4, 4, 4, 5, 5],
  4: [4, 4, 5, 5, 5, 5],
  5: [4, 4, 4, 5, 5, 5, 5],
  6: [5, 5, 5, 5, 6, 6, 6],
  7: [4, 4, 5, 5, 5, 5, 6],
  8: [4, 5, 5, 5, 5, 6, 6],
  9: [4, 5, 5, 5, 6, 6, 6],
};
/** 规则 1：totalWaves 不变（与无线电台词、单位部署、检查点绑定） */
const UNCHANGED_TOTAL_WAVES: Record<number, number> = {
  1: 5,
  2: 5,
  3: 6,
  4: 6,
  5: 7,
  6: 7,
  7: 7,
  8: 7,
  9: 7,
  10: 8,
};

/** 规则 3：各机型的引入关卡 */
const INTRODUCED_AT: Record<EnemyType, number> = {
  [SCOUT]: 1,
  [FIGHTER]: 1,
  [SNIPER]: 2,
  [HEAVY]: 2,
  [ACE]: 3,
  [STRIKER]: 4,
  [JAMMER]: 5,
  [WRAITH]: 7,
};

/** 规则 4：每波上限 */
const PER_WAVE_CAP: Partial<Record<EnemyType, number>> = {
  [JAMMER]: 1,
  [STRIKER]: 2,
  [WRAITH]: 2,
  [HEAVY]: 2,
  [SNIPER]: 2,
  [ACE]: 2,
};

/** 规则 5：精英名单 */
const ELITE_TYPES: readonly EnemyType[] = [HEAVY, ACE, SNIPER, STRIKER, JAMMER, WRAITH];

const EVENT_LETTER: Record<LevelWaveEventType, EventLetter> = {
  [LevelWaveEventType.INTERCEPT]: 'I',
  [LevelWaveEventType.ELITE_HUNT]: 'E',
  [LevelWaveEventType.ESCORT_DEFENSE]: 'D',
};

/** 事件的出场间隔（秒，这一轮之前的值：事件“保留它的出场节奏”） */
const EVENT_CADENCE: Record<string, number> = {
  none: 0.5,
  [LevelWaveEventType.INTERCEPT]: 0.35,
  [LevelWaveEventType.ELITE_HUNT]: 0.8,
  [LevelWaveEventType.ESCORT_DEFENSE]: 0.6,
};

/** 一路群内散布半径（米，这一轮之前的“一群”）：同一路的敌机在群中心这么远以内现身 */
const GROUP_SPREAD = 60;
/** 移动端同时在场敌机的设备基础上限（GameConfig，现有值） */
const MOBILE_BASE_LIMIT = 5;

function levelConfig(level: number): NonNullable<ReturnType<typeof getLevelConfig>> {
  const config = getLevelConfig(level);
  if (!config) throw new Error(`level ${level} missing`);
  return config;
}

function where(level: number, wave: number): string {
  return `level ${level} wave ${wave + 1}`;
}

/** 写定的编成（按出场顺序） */
function lineupOf(level: number, wave: number): EnemyType[] {
  return [...levelConfig(level).waves[wave].lineup];
}

function multiset(types: readonly EnemyType[]): Record<string, number> {
  return Object.fromEntries([...countTypes(types)].sort(([a], [b]) => a.localeCompare(b)));
}

function specMultiset(wave: SpecWave): Record<string, number> {
  return Object.fromEntries([...wave.jets].sort(([a], [b]) => a.localeCompare(b)));
}

function isArmed(type: EnemyType): boolean {
  return type !== JAMMER;
}

let randomSpy: ReturnType<typeof vi.spyOn> | null = null;
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

// ─────────────────────────────── 配置表 ───────────────────────────────

describe('the authored tables (spec §4a rules)', () => {
  it('the spec table covers every wave of every level (test self-check)', () => {
    for (const level of ALL_LEVELS) {
      expect(SPEC_LINEUPS[level].length, `level ${level}`).toBe(levelConfig(level).totalWaves);
    }
  });

  describe('rule 1: wave counts', () => {
    it.each(ALL_LEVELS)('level %i keeps its number of waves', (level) => {
      const config = levelConfig(level);
      expect(config.totalWaves).toBe(UNCHANGED_TOTAL_WAVES[level]);
      expect(config.enemiesPerWave.length).toBe(UNCHANGED_TOTAL_WAVES[level]);
      expect(config.waves.length).toBe(UNCHANGED_TOTAL_WAVES[level]);
    });

    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('level %i keeps its enemiesPerWave values', (level) => {
      expect(levelConfig(level).enemiesPerWave).toEqual(UNCHANGED_ENEMIES_PER_WAVE[level]);
    });

    it('level 10: each of the first seven waves is no lower than level 9, its last no lower than level 9’s last', () => {
      const nine = levelConfig(9).enemiesPerWave;
      const ten = levelConfig(10).enemiesPerWave;
      for (let i = 0; i < 7; i++) {
        expect(ten[i], `wave ${i + 1}`).toBeGreaterThanOrEqual(nine[i]);
      }
      expect(ten[ten.length - 1]).toBeGreaterThanOrEqual(nine[nine.length - 1]);
    });

    it('level 10 is no longer below level 9 in total jets', () => {
      const total = (level: number): number =>
        levelConfig(level).enemiesPerWave.reduce((sum, count) => sum + count, 0);
      expect(total(10)).toBeGreaterThan(total(9));
    });
  });

  describe('rule 2: each wave has an authored line-up of its size', () => {
    it.each(ALL_LEVELS)('level %i: every line-up has enemiesPerWave[wave] jets', (level) => {
      const config = levelConfig(level);
      for (let wave = 0; wave < config.totalWaves; wave++) {
        expect(config.waves[wave].lineup.length, where(level, wave)).toBe(
          config.enemiesPerWave[wave]
        );
      }
    });

    it.each(ALL_LEVELS)('level %i: every line-up uses only real jet types', (level) => {
      const types = new Set(Object.values(EnemyType));
      for (const wave of levelConfig(level).waves) {
        for (const type of wave.lineup) expect(types.has(type), type).toBe(true);
      }
    });
  });

  describe('rule 3: introductions', () => {
    it('no type appears before its introduction level', () => {
      for (const level of ALL_LEVELS) {
        levelConfig(level).waves.forEach((wave, index) => {
          for (const type of wave.lineup) {
            expect(INTRODUCED_AT[type], `${type} in ${where(level, index)}`).toBeLessThanOrEqual(
              level
            );
          }
        });
      }
    });

    it('every type is in fact introduced on its level', () => {
      for (const type of Object.values(EnemyType)) {
        const level = INTRODUCED_AT[type];
        const present = levelConfig(level).waves.some((wave) => wave.lineup.includes(type));
        expect(present, `${type} on level ${level}`).toBe(true);
      }
    });

    it('level 1 has only Scouts and Fighters, and its first wave is exactly two Scouts', () => {
      const config = levelConfig(1);
      for (const wave of config.waves) {
        for (const type of wave.lineup) expect([SCOUT, FIGHTER]).toContain(type);
      }
      expect([...config.waves[0].lineup]).toEqual([SCOUT, SCOUT]);
    });
  });

  describe('rule 4: per-wave caps', () => {
    it.each(ALL_LEVELS)(
      'level %i: at most 1 Jammer and 2 each of Striker, Wraith, Heavy, Sniper, Ace per wave',
      (level) => {
        levelConfig(level).waves.forEach((wave, index) => {
          const counts = countTypes(wave.lineup);
          for (const [type, cap] of Object.entries(PER_WAVE_CAP)) {
            expect(
              counts.get(type as EnemyType) ?? 0,
              `${type} in ${where(level, index)}`
            ).toBeLessThanOrEqual(cap as number);
          }
        });
      }
    );

    it.each(ALL_LEVELS)(
      'level %i: a Jammer never comes without at least two armed jets in its wave',
      (level) => {
        levelConfig(level).waves.forEach((wave, index) => {
          if (!wave.lineup.includes(JAMMER)) return;
          expect(wave.lineup.filter(isArmed).length, where(level, index)).toBeGreaterThanOrEqual(2);
        });
      }
    );
  });

  describe('rule 5: elite-hunt waves bring elite jets', () => {
    it.each(ALL_LEVELS)('level %i: every elite-hunt wave has at least one elite jet', (level) => {
      const config = levelConfig(level);
      const templates = config.eventTemplates ?? [];
      for (let wave = 1; wave < config.totalWaves; wave++) {
        const event = templates[(wave - 1) % templates.length];
        if (event !== LevelWaveEventType.ELITE_HUNT) continue;
        const elites = config.waves[wave].lineup.filter((type) => ELITE_TYPES.includes(type));
        expect(elites.length, where(level, wave)).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('rule 6: every level from 2 to 8 brings a new type or a new combination', () => {
    it.each([2, 3, 4, 5, 6, 7, 8])(
      'level %i has a wave whose set of types occurs nowhere in the earlier levels',
      (level) => {
        const key = (types: readonly EnemyType[]): string => [...new Set(types)].sort().join(',');
        const earlier = new Set<string>();
        for (let previous = 1; previous < level; previous++) {
          for (const wave of levelConfig(previous).waves) earlier.add(key(wave.lineup));
        }
        const fresh = levelConfig(level).waves.filter((wave) => !earlier.has(key(wave.lineup)));
        expect(fresh.length).toBeGreaterThan(0);
      }
    );
  });

  describe('rule 7: the mobile limit', () => {
    it.each(ALL_LEVELS)(
      'level %i: no line-up is larger than the mobile limit of jets alive at once',
      (level) => {
        const limit = MOBILE_BASE_LIMIT + getLevelScaling(level).concurrentEnemyBonus;
        expect(limit, 'mobile limit stays within spec §2.7 (5–7 jets alive)').toBeLessThanOrEqual(
          7
        );
        levelConfig(level).waves.forEach((wave, index) => {
          expect(wave.lineup.length, where(level, index)).toBeLessThanOrEqual(limit);
        });
      }
    );
  });

  describe('arrival patterns in the table', () => {
    it.each(ALL_LEVELS)(
      'level %i: every pincer splits its jets into two non-empty groups',
      (level) => {
        levelConfig(level).waves.forEach((wave, index) => {
          if (wave.arrival !== 'pincer') return;
          expect(wave.sides?.length, where(level, index)).toBe(wave.lineup.length);
          const sides = new Set(wave.sides);
          expect([...sides].sort(), where(level, index)).toEqual([0, 1]);
        });
      }
    );
  });

  describe('the starting line-ups of spec §4a (no deviations reported)', () => {
    const LETTER: Record<string, ArrivalLetter> = { group: 'G', pincer: 'P', trail: 'T' };

    it.each(ALL_LEVELS)(
      'level %i: each wave brings the spec’s jets, arrival and event',
      (level) => {
        const config = levelConfig(level);
        const templates = config.eventTemplates ?? [];
        SPEC_LINEUPS[level].forEach((spec, wave) => {
          const label = `${where(level, wave)} (${spec.text})`;
          expect(multiset(config.waves[wave].lineup), label).toEqual(specMultiset(spec));
          expect(LETTER[config.waves[wave].arrival], label).toBe(spec.arrival);
          const event = wave === 0 ? null : templates[(wave - 1) % templates.length];
          expect(event ? EVENT_LETTER[event] : null, label).toBe(spec.event);
        });
      }
    );
  });
});

// ─────────────────────────────── 真实的生成路径 ───────────────────────────────

describe('the real spawn path (LevelManager)', () => {
  /** 第一遍：每关从第 1 波打到最后一波，玩家停在原点上空，敌机一现身就击毁 */
  const campaign = new Map<number, WaveRecord[]>();
  /** 第二遍：换一个随机种子，从读档入口逐波单独开打 */
  const resumed = new Map<string, WaveRecord>();

  beforeAll(async () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(20261010));
    try {
      for (const level of ALL_LEVELS) {
        const rig = new WaveRig();
        campaign.set(level, await rig.playLevel(level, 'on-arrival'));
        rig.dispose();
      }
    } finally {
      spy.mockRestore();
    }
    const other = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(77));
    try {
      for (const level of ALL_LEVELS) {
        for (let wave = 0; wave < levelConfig(level).totalWaves; wave++) {
          const rig = new WaveRig({ playerPosition: new THREE.Vector3(-400, 260, 650) });
          rig.load(level, wave);
          rig.start();
          resumed.set(`${level}:${wave}`, await rig.playWave('on-arrival'));
          rig.dispose();
        }
      }
    } finally {
      other.mockRestore();
    }
  });

  function recordsOf(level: number): WaveRecord[] {
    const records = campaign.get(level);
    expect(records, `level ${level} was played`).toBeDefined();
    return records as WaveRecord[];
  }

  it.each(ALL_LEVELS)(
    'level %i is played through: every wave starts, completes, in order',
    (level) => {
      const records = recordsOf(level);
      expect(records.map((record) => record.wave)).toEqual(
        Array.from({ length: levelConfig(level).totalWaves }, (_, index) => index)
      );
      for (const record of records) {
        expect(Number.isNaN(record.completedAt), where(level, record.wave)).toBe(false);
      }
    }
  );

  it.each(ALL_LEVELS)(
    'level %i: every wave brings exactly its line-up, in the authored order (rule 2)',
    (level) => {
      for (const record of recordsOf(level)) {
        const arrived = record.arrivals.map((arrival) => arrival.type);
        expect(arrived, where(level, record.wave)).toEqual(lineupOf(level, record.wave));
        expect(arrived.length).toBe(levelConfig(level).enemiesPerWave[record.wave]);
      }
    }
  );

  it.each(ALL_LEVELS)(
    'level %i: the same wave brings the same jets when played again from a checkpoint with other random numbers (rule 2)',
    (level) => {
      for (const record of recordsOf(level)) {
        const again = resumed.get(`${level}:${record.wave}`);
        expect(again, where(level, record.wave)).toBeDefined();
        expect(
          again?.arrivals.map((arrival) => arrival.type),
          where(level, record.wave)
        ).toEqual(record.arrivals.map((arrival) => arrival.type));
        // 前提：两遍的出生点确实不同（随机数确实换了）
        expect(
          again?.arrivals[0].position.distanceTo(record.arrivals[0].position),
          'the two runs spawned in different places'
        ).toBeGreaterThan(1);
      }
    }
  );

  it.each(ALL_LEVELS)(
    'level %i: the wave event keeps the line-up and its spawn cadence (rule 2)',
    (level) => {
      const templates = levelConfig(level).eventTemplates ?? [];
      for (const record of recordsOf(level)) {
        const expected = record.wave === 0 ? null : templates[(record.wave - 1) % templates.length];
        expect(record.event, where(level, record.wave)).toBe(expected);
        expect(record.arrivals.map((arrival) => arrival.type)).toEqual(
          lineupOf(level, record.wave)
        );
        // 一群 / 夹击：相邻两架的现身间隔就是事件的出场间隔（步长 0.1 秒的分辨率）
        if (levelConfig(level).waves[record.wave].arrival === 'trail') continue;
        const cadence = EVENT_CADENCE[record.event ?? 'none'];
        for (let i = 1; i < record.arrivals.length; i++) {
          const gap = record.arrivals[i].time - record.arrivals[i - 1].time;
          expect(gap, `${where(level, record.wave)}, jet ${i + 1}`).toBeGreaterThanOrEqual(
            cadence - 1e-6
          );
          expect(gap, `${where(level, record.wave)}, jet ${i + 1}`).toBeLessThanOrEqual(
            cadence + 0.1 + 1e-6
          );
        }
      }
    }
  );

  it('no type arrives before its introduction level; level 1 is Scouts and Fighters, wave 1 two Scouts (rule 3)', () => {
    for (const level of ALL_LEVELS) {
      for (const record of recordsOf(level)) {
        for (const arrival of record.arrivals) {
          expect(
            INTRODUCED_AT[arrival.type],
            `${arrival.type} in ${where(level, record.wave)}`
          ).toBeLessThanOrEqual(level);
          if (level === 1) expect([SCOUT, FIGHTER]).toContain(arrival.type);
        }
      }
    }
    expect(recordsOf(1)[0].arrivals.map((arrival) => arrival.type)).toEqual([SCOUT, SCOUT]);
  });

  it('per-wave caps hold, and a Jammer always arrives with at least two armed jets (rule 4)', () => {
    for (const level of ALL_LEVELS) {
      for (const record of recordsOf(level)) {
        const types = record.arrivals.map((arrival) => arrival.type);
        const counts = countTypes(types);
        for (const [type, cap] of Object.entries(PER_WAVE_CAP)) {
          expect(
            counts.get(type as EnemyType) ?? 0,
            `${type}, ${where(level, record.wave)}`
          ).toBeLessThanOrEqual(cap as number);
        }
        if (types.includes(JAMMER)) {
          expect(types.filter(isArmed).length, where(level, record.wave)).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('elite-hunt waves bring elite jets (rule 5)', () => {
    let huntWaves = 0;
    for (const level of ALL_LEVELS) {
      for (const record of recordsOf(level)) {
        if (record.event !== LevelWaveEventType.ELITE_HUNT) continue;
        huntWaves++;
        const elites = record.arrivals.filter((arrival) => ELITE_TYPES.includes(arrival.type));
        expect(elites.length, where(level, record.wave)).toBeGreaterThanOrEqual(1);
      }
    }
    expect(huntWaves, 'elite-hunt waves in the campaign').toBeGreaterThan(5);
  });

  it('every level from 2 to 8 brings a set of types not seen in any earlier level (rule 6)', () => {
    const seen = new Set<string>();
    const key = (record: WaveRecord): string =>
      [...new Set(record.arrivals.map((arrival) => arrival.type))].sort().join(',');
    for (const level of ALL_LEVELS) {
      const sets = recordsOf(level).map(key);
      if (level >= 2 && level <= 8) {
        expect(
          sets.some((set) => !seen.has(set)),
          `level ${level}: ${sets.join(' | ')}`
        ).toBe(true);
      }
      for (const set of sets) seen.add(set);
    }
  });

  it('level 10 uses every jet type: a gauntlet of everything (spec §4)', () => {
    const types = new Set(recordsOf(10).flatMap((record) => record.arrivals.map((a) => a.type)));
    expect([...types].sort()).toEqual(Object.values(EnemyType).sort());
  });

  describe('arrival patterns', () => {
    function arrivalOf(level: number, wave: number): string {
      return levelConfig(level).waves[wave].arrival;
    }

    /** 每一架属于离它最近的那个群中心 */
    function groupsOf(record: WaveRecord): number[][] {
      const groups: number[][] = record.centers.map(() => []);
      record.arrivals.forEach((arrival, index) => {
        let best = 0;
        for (let c = 1; c < record.centers.length; c++) {
          if (
            horizontalDistance(arrival.position, record.centers[c]) <
            horizontalDistance(arrival.position, record.centers[best])
          ) {
            best = c;
          }
        }
        groups[best].push(index);
      });
      return groups;
    }

    function allRecords(): WaveRecord[] {
      return [...ALL_LEVELS.flatMap((level) => recordsOf(level)), ...resumed.values()];
    }

    it('one group (G): all the jets come from one place', () => {
      let checked = 0;
      for (const record of allRecords()) {
        if (arrivalOf(record.level, record.wave) !== 'group') continue;
        checked++;
        expect(record.centers.length, where(record.level, record.wave)).toBe(1);
        for (const arrival of record.arrivals) {
          expect(horizontalDistance(arrival.position, record.centers[0])).toBeLessThanOrEqual(
            GROUP_SPREAD + 1e-6
          );
        }
      }
      expect(checked).toBeGreaterThan(20);
    });

    it('pincer (P): two groups 90–150° apart as seen from the player, both with jets', () => {
      let checked = 0;
      for (const record of allRecords()) {
        if (arrivalOf(record.level, record.wave) !== 'pincer') continue;
        checked++;
        const label = where(record.level, record.wave);
        expect(record.centers.length, label).toBe(2);
        const gap = bearingGapDeg(
          bearingDeg(record.playerAtStart, record.centers[0]),
          bearingDeg(record.playerAtStart, record.centers[1])
        );
        expect(gap, `${label}: angle between the two groups`).toBeGreaterThanOrEqual(90 - 1e-6);
        expect(gap, `${label}: angle between the two groups`).toBeLessThanOrEqual(150 + 1e-6);
        const groups = groupsOf(record);
        expect(groups[0].length, `${label}: first group`).toBeGreaterThan(0);
        expect(groups[1].length, `${label}: second group`).toBeGreaterThan(0);
        for (const arrival of record.arrivals) {
          const nearest = Math.min(
            horizontalDistance(arrival.position, record.centers[0]),
            horizontalDistance(arrival.position, record.centers[1])
          );
          expect(nearest, label).toBeLessThanOrEqual(GROUP_SPREAD + 1e-6);
        }
      }
      expect(checked).toBeGreaterThan(30);
    });

    it('pincer splits named in the spec: level 1 wave 2 is 2 + 1, level 3 wave 3 two pairs, level 4 wave 5 Strikers on one side', () => {
      for (const records of [recordsOf(1), recordsOf(3), recordsOf(4)])
        expect(records.length).toBeGreaterThan(0);
      const sizes = (record: WaveRecord): number[] =>
        groupsOf(record)
          .map((group) => group.length)
          .sort();
      for (const record of [recordsOf(1)[1], resumed.get('1:1') as WaveRecord]) {
        expect(sizes(record)).toEqual([1, 2]);
      }
      for (const record of [recordsOf(3)[2], resumed.get('3:2') as WaveRecord]) {
        expect(sizes(record)).toEqual([2, 2]);
      }
      for (const record of [recordsOf(4)[4], resumed.get('4:4') as WaveRecord]) {
        const groups = groupsOf(record).map((group) =>
          group.map((index) => record.arrivals[index].type)
        );
        const strikerSide = groups.find((group) => group.includes(STRIKER)) ?? [];
        const otherSide = groups.find((group) => group !== strikerSide) ?? [];
        expect(describeTypes(strikerSide)).toBe('2 STRIKER');
        expect(describeTypes(otherSide)).toBe('1 FIGHTER + 2 SCOUT');
      }
    });

    it('orders named in the spec: level 2 wave 2 Sniper last, level 4 wave 2 Striker behind', () => {
      for (const record of [recordsOf(2)[1], resumed.get('2:1') as WaveRecord]) {
        const types = record.arrivals.map((arrival) => arrival.type);
        expect(types[types.length - 1]).toBe(SNIPER);
        expect(types.filter((type) => type === SNIPER)).toHaveLength(1);
      }
      for (const record of [recordsOf(4)[1], resumed.get('4:1') as WaveRecord]) {
        const types = record.arrivals.map((arrival) => arrival.type);
        expect(types[types.length - 1]).toBe(STRIKER);
        expect(types.filter((type) => type === STRIKER)).toHaveLength(1);
      }
    });

    it('trail (T): one bearing, the jets arriving one after another', () => {
      let checked = 0;
      let longestGroupGap = 0;
      for (const record of allRecords()) {
        const arrival = arrivalOf(record.level, record.wave);
        for (let i = 1; i < record.arrivals.length; i++) {
          const gap = record.arrivals[i].time - record.arrivals[i - 1].time;
          if (arrival !== 'trail') longestGroupGap = Math.max(longestGroupGap, gap);
        }
      }
      for (const record of allRecords()) {
        if (arrivalOf(record.level, record.wave) !== 'trail') continue;
        checked++;
        const label = where(record.level, record.wave);
        expect(record.centers.length, label).toBe(1);
        for (const arrival of record.arrivals) {
          expect(
            horizontalDistance(arrival.position, record.centers[0]),
            label
          ).toBeLessThanOrEqual(GROUP_SPREAD + 1e-6);
        }
        for (let i = 1; i < record.arrivals.length; i++) {
          const gap = record.arrivals[i].time - record.arrivals[i - 1].time;
          // 一架接一架：明显比一群同来的出场间隔长，至少 2 秒
          expect(gap, `${label}, jet ${i + 1}`).toBeGreaterThanOrEqual(2);
          expect(gap, `${label}, jet ${i + 1}`).toBeGreaterThan(longestGroupGap);
        }
      }
      expect(checked).toBeGreaterThanOrEqual(10);
    });

    it('the two planned group centres are 90–150° apart wherever in the battlefield the player is when the wave starts', () => {
      randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(5150));
      const positions: THREE.Vector3[] = [new THREE.Vector3(0, 300, 0)];
      // 玩家飞不出半径 1500 米的圆（PlayerController 的硬边界）：圆周上与半径一半处各取一圈
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        for (const radius of [750, 1500]) {
          positions.push(
            new THREE.Vector3(Math.sin(angle) * radius, 300, Math.cos(angle) * radius)
          );
        }
      }
      const failures: string[] = [];
      const rig = new WaveRig();
      try {
        for (const position of positions) {
          for (const [level, wave] of [
            [1, 1],
            [8, 6],
          ] as const) {
            rig.player.copy(position);
            rig.load(level, wave);
            rig.start();
            const record = rig.records[rig.records.length - 1];
            expect([record.level, record.wave]).toEqual([level, wave]);
            const gap = bearingGapDeg(
              bearingDeg(position, record.centers[0]),
              bearingDeg(position, record.centers[1])
            );
            if (record.centers.length !== 2 || gap < 90 - 1e-6 || gap > 150 + 1e-6) {
              failures.push(
                `player at (${position.x.toFixed(0)}, ${position.z.toFixed(0)}): ${gap.toFixed(1)}°`
              );
            }
            for (const center of record.centers) {
              // 群中心（连同 60 米散布）在战场以内
              expect(Math.abs(center.x) + GROUP_SPREAD).toBeLessThanOrEqual(1500 + 1e-6);
              expect(Math.abs(center.z) + GROUP_SPREAD).toBeLessThanOrEqual(1500 + 1e-6);
            }
          }
        }
      } finally {
        rig.dispose();
      }
      expect(failures).toEqual([]);
    });
  });
});

// ─────────────────────────── 夹击：玩家在敌机到场时看到的角度 ───────────────────────────

/**
 * 规格 §4a：夹击是“从玩家看相隔 90–150° 的两路”。玩家感受到的是敌机从传送门里现身的那一刻，
 * 而不是开波时的规划：开波到现身要 5 秒多（传送门）再加上出场间隔，这段时间玩家一直在飞。
 *
 * 这里玩家以巡航速度水平直飞（开波前已经飞了 2 秒，与协调器开场的 START_DELAY 一样，LevelManager
 * 每一步都看得到它的航迹），航向取 4 个方向。每一架现身时，从玩家当时的位置看它那一路的群中心；
 * 一路的方位 = 这一路各架现身时的这个方位的平均；两路方位之差要在 90–150° 之间。用群中心而不是
 * 各架自己的位置：群内 60 米的散布不算进夹角（玩家不动时，量出来的正是开波时规划的夹角）。
 */
describe('a pincer as the player sees it when the jets arrive (spec §4a)', () => {
  /** 巡航速度（米/秒）：不推油门时 PlayerController 稳定在最大速度的一半；基础最大速度 45 */
  const CRUISE_SPEED = 22.5;
  const HEADINGS_DEG = [0, 90, 180, 270];

  function circularMeanDeg(bearings: readonly number[]): number {
    let x = 0;
    let z = 0;
    for (const bearing of bearings) {
      x += Math.sin(THREE.MathUtils.degToRad(bearing));
      z += Math.cos(THREE.MathUtils.degToRad(bearing));
    }
    return (THREE.MathUtils.radToDeg(Math.atan2(x, z)) + 360) % 360;
  }

  /** 夹击波次的两路在现身时的夹角（度） */
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

  interface PincerSweep {
    failures: string[];
    checked: number;
    narrowest: number;
    widest: number;
  }

  /** 每一关的每一个夹击波次：玩家从原点上空以 speed 沿各个航向直飞，量现身时的夹角 */
  async function sweepPincers(speed: number, headings: readonly number[]): Promise<PincerSweep> {
    const sweep: PincerSweep = { failures: [], checked: 0, narrowest: 180, widest: 0 };
    for (const heading of headings) {
      const velocity = new THREE.Vector3(
        Math.sin(THREE.MathUtils.degToRad(heading)) * speed,
        0,
        Math.cos(THREE.MathUtils.degToRad(heading)) * speed
      );
      const rig = new WaveRig({ playerVelocity: velocity });
      try {
        for (const level of ALL_LEVELS) {
          for (let wave = 0; wave < levelConfig(level).totalWaves; wave++) {
            if (levelConfig(level).waves[wave].arrival !== 'pincer') continue;
            rig.player.set(0, 300, 0);
            rig.load(level, wave);
            await rig.preroll(2);
            rig.start();
            const record = await rig.playWave('on-arrival', 60);
            expect([record.level, record.wave]).toEqual([level, wave]);
            expect(record.arrivals.length, where(level, wave)).toBe(lineupOf(level, wave).length);
            const gap = arrivalGapDeg(record);
            sweep.checked++;
            sweep.narrowest = Math.min(sweep.narrowest, gap);
            sweep.widest = Math.max(sweep.widest, gap);
            if (gap < 90 - 1e-6 || gap > 150 + 1e-6) {
              sweep.failures.push(`${where(level, wave)}, heading ${heading}°: ${gap.toFixed(1)}°`);
            }
          }
        }
      } finally {
        rig.dispose();
      }
    }
    return sweep;
  }

  function summary(sweep: PincerSweep): string {
    return `${sweep.failures.length} of ${sweep.checked} pincers out of range; seen ${sweep.narrowest.toFixed(1)}–${sweep.widest.toFixed(1)}°`;
  }

  it('control: a player holding position sees every pincer arrive 90–150° apart', async () => {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(9090));
    const sweep = await sweepPincers(0, [0]);
    expect(sweep.checked).toBeGreaterThan(30);
    expect(sweep.failures, summary(sweep)).toEqual([]);
  });

  // Spec §4a, arrival P = "two groups 90–150° apart as seen from the player": a player flying
  // straight at cruise speed sees the two groups of every pincer 90–150° apart when the jets come
  // out of their portals. Was a known failure at e662fd7 (31 of 148 out of range, seen 76–175°:
  // the centres were planned from where the player was when the wave started); fixed in 3c91868.
  // The assertion lists level, wave, heading and the angle.
  it('every pincer of every level arrives 90–150° apart, whichever way the player is flying at cruise speed', async () => {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(9090));
    const sweep = await sweepPincers(CRUISE_SPEED, HEADINGS_DEG);
    expect(sweep.checked).toBeGreaterThan(100);
    expect(sweep.failures, summary(sweep)).toEqual([]);
  });
});

// ─────────────────────────────── 规则 7：同时在场上限 ───────────────────────────────

describe('rule 7: jets alive at once on a mobile device', () => {
  let wasMobile: boolean;

  beforeEach(() => {
    wasMobile = GameConfig.isMobile;
    GameConfig.isMobile = true;
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(4242));
  });

  afterEach(() => {
    GameConfig.isMobile = wasMobile;
  });

  it('every wave of every level stays within the mobile limit with nobody shot down until all are in', async () => {
    const over: string[] = [];
    for (const level of ALL_LEVELS) {
      for (let wave = 0; wave < levelConfig(level).totalWaves; wave++) {
        const rig = new WaveRig();
        rig.load(level, wave);
        rig.start();
        const record = await rig.playWave('when-all-in');
        rig.dispose();
        expect(record.arrivals.length, where(level, wave)).toBe(lineupOf(level, wave).length);
        // 前提：同时在场的确实是整波（没人被提前击毁）
        expect(record.maxAlive, where(level, wave)).toBe(lineupOf(level, wave).length);
        expect(record.concurrencyLimit).toBeLessThanOrEqual(7);
        if (record.maxAlive > record.concurrencyLimit) {
          over.push(
            `${where(level, wave)}: ${record.maxAlive} alive, limit ${record.concurrencyLimit}`
          );
        }
      }
    }
    expect(over).toEqual([]);
  });

  it('a line-up larger than the limit still arrives in full as jets are shot down (existing behaviour)', async () => {
    const limitSpy = vi.spyOn(GameConfig, 'getMaxEnemies').mockReturnValue(2);
    try {
      const rig = new WaveRig();
      rig.load(6, 6);
      rig.start();
      const limit = rig.levels.getMaxConcurrentEnemies();
      expect(limit, 'the lowered limit').toBeLessThan(lineupOf(6, 6).length);
      let record: WaveRecord | null = null;
      // 只在同时在场达到上限时击毁最早到的一架
      for (let i = 0; i < 3000; i++) {
        await rig.step('when-all-in');
        const alive = rig.alive();
        if (alive.length >= limit) alive[0].takeDamage(1e9);
        record = rig.records[0];
        if (!Number.isNaN(record.completedAt)) break;
      }
      rig.dispose();
      expect(record?.arrivals.map((arrival) => arrival.type)).toEqual(lineupOf(6, 6));
      expect(Number.isNaN(record?.completedAt ?? Number.NaN), 'the wave completed').toBe(false);
    } finally {
      limitSpy.mockRestore();
    }
  });
});
