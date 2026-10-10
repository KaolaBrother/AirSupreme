import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import { getDifficultyProfile } from '@/core/Difficulty';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { LevelManager } from '@/features/levels/LevelManager';

/**
 * 敌机舰队 M3：关卡曲线（规格 §4 “Level curve” 与 §4a 之后的 “Level curve” 验收条目）。
 *
 * 规格的度量是平衡测试台（BalanceHarness）的“压力”：脚本飞行员每分钟受到的伤害——它靠真实时间
 * 驱动、单次波动约 ±40%，不适合做单元测试（这里不测，见报告）。这里测的是它的输入在真实生成路径
 * 上的样子：每一关用 LevelManager 载入、经 spawnEnemyAtPosition 生成的敌机实际拿到的数值。
 *
 * - 敌方火力（单发伤害 ÷ 两次射击之间的间隔倍率）逐关不降，第 10 关最高（不与第 9 关打平）——
 *   在“非常简单”“普通”“专家”三档上都是如此；
 * - 敌机血量逐关不降；
 * - 玩家导弹伤害仍是 80；基础难度（普通）下侦察机在每一关都一枚导弹击落（601def1 时已经成立，
 *   所以必须保持）。更难的档位上哪几关做不到，只报告、不当作失败（规格：只报告，不改玩家武器）。
 *
 * 不钉调校出来的具体数值，也不钉“非常简单”档的数值。
 */

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

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TIERS: ReadonlyArray<readonly [string, number]> = [
  ['Very Easy', 1],
  ['Normal', 3],
  ['Expert', 5],
];
/** 有武装的机型（干扰机不开火） */
const ARMED: readonly EnemyType[] = Object.values(EnemyType).filter(
  (type) => type !== EnemyType.JAMMER
);

let canvasSpy: { mockRestore(): void };
let scene: THREE.Scene;
let levels: LevelManager;

beforeAll(() => {
  canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  scene = new THREE.Scene();
  levels = new LevelManager(scene);
});

afterAll(() => {
  levels.clear();
  levels.dispose(scene);
  canvasSpy.mockRestore();
});

/**
 * 在第 level 关、难度档 tier 下经真实生成路径生成一架 type（与换关 / 读档同一个入口
 * loadLevel；用完清场）
 */
function withJet<T>(level: number, tier: number, type: EnemyType, look: (jet: EnemyAI) => T): T {
  levels.setDifficultyProfile(getDifficultyProfile(tier));
  levels.loadLevel(level, 0);
  const jet = levels.spawnEnemyAtPosition(type, new THREE.Vector3(0, 300, -600), false);
  expect(jet, `${type} on level ${level}`).toBeTruthy();
  try {
    return look(jet as EnemyAI);
  } finally {
    levels.despawnAllEnemies();
  }
}

interface Applied {
  health: number;
  damage: number;
  cadenceScale: number;
  firepower: number;
}

function applied(level: number, tier: number, type: EnemyType): Applied {
  return withJet(level, tier, type, (jet) => {
    const config = jet.getConfig();
    const cadenceScale = config.cadenceScale ?? 1;
    return {
      health: jet.getHealth().max,
      damage: config.damage,
      cadenceScale,
      firepower: config.damage / cadenceScale,
    };
  });
}

describe.each(TIERS)('the level curve on %s, as the jets get it (spec §4)', (_tier, tier) => {
  it.each(ARMED)(
    '%s: firepower never falls from one level to the next, and level 10 has the most',
    (type) => {
      const curve = LEVELS.map((level) => applied(level, tier, type));
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].firepower, `level ${i + 1} vs level ${i}`).toBeGreaterThanOrEqual(
          curve[i - 1].firepower
        );
      }
      const top = curve[9].firepower;
      for (let i = 0; i < 9; i++) {
        expect(top, `level 10 vs level ${i + 1}`).toBeGreaterThan(curve[i].firepower);
      }
    }
  );

  it.each(ARMED)('%s: health never falls from one level to the next', (type) => {
    const curve = LEVELS.map((level) => applied(level, tier, type));
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].health, `level ${i + 1} vs level ${i}`).toBeGreaterThanOrEqual(
        curve[i - 1].health
      );
    }
  });
});

// “非常简单”比“简单”更温和（5cc1100 重新调校之后仍然如此）：逐关、逐机型比较实际拿到的火力。
// 逐关不降、第 10 关最高已由上面的 Very Easy 档覆盖。不钉具体倍率。
describe('Very Easy against Easy, as the jets get it (spec §4 level curve)', () => {
  it.each(ARMED)('%s: Very Easy firepower is below Easy firepower on every level', (type) => {
    for (const level of LEVELS) {
      expect(applied(level, 1, type).firepower, `level ${level}`).toBeLessThan(
        applied(level, 2, type).firepower
      );
    }
  });
});

describe('the player’s missile (spec §4 level curve)', () => {
  it('still does 80 damage', () => {
    expect(GAME_CONSTANTS.MISSILE.DAMAGE).toBe(80);
  });

  it.each(LEVELS)('level %i: a Scout on Normal goes down to one missile', (level) => {
    withJet(level, 3, EnemyType.SCOUT, (jet) => {
      expect(jet.isAlive()).toBe(true);
      jet.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
      expect(jet.isAlive()).toBe(false);
    });
  });

  it.each([
    ['Very Easy', 1],
    ['Easy', 2],
  ] as const)('a Scout on %s goes down to one missile on every level', (_name, tier) => {
    for (const level of LEVELS) {
      expect(applied(level, tier, EnemyType.SCOUT).health, `level ${level}`).toBeLessThanOrEqual(
        GAME_CONSTANTS.MISSILE.DAMAGE
      );
    }
  });
});
