import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { getVoiceScript } from '@/features/campaign/CampaignData';
import { getLevelConfig } from '@/features/terrain/LevelConfig';
import { setLocale, type Locale, type LocalizedText } from '@/i18n';
import { FIRST_CONTACT_HINTS, getFirstContactHints } from '@/ui/OnboardingManager';
import { CampaignRig, installCampaignGlobals, waveCheckpoint } from './campaignRig';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * 敌机舰队 M3：首次遭遇提示（规格 §4a 规则 8 与 “Hint lines” 表）。
 *
 * - FIGHTER、SNIPER、HEAVY、ACE、STRIKER、JAMMER、WRAITH 在战役里第一次出现的那一波（引入波）
 *   开场时显示一行文字，当前界面语言，没有语音；
 * - 从检查点重打这一波照样显示；别的波次永远不显示；
 * - SCOUT 没有提示（第 1 关第 1 波属于原有的入门引导）。
 *
 * 两层：先看数据（提示原文、哪一波有提示、语音稿里没有它）；再经战役台架（campaignRig.ts，一台
 * 真的 GameCoordinator）从读档续玩 / 正常推进走到开波，看 HUD 大字提示通道上真的出现了什么。
 */

vi.setConfig({ testTimeout: 120_000 });

vi.mock('@/scenes/GameScene', () => ({
  GameScene: class {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(
      GAME_CONSTANTS.CAMERA.FOV,
      1.6,
      GAME_CONSTANTS.CAMERA.NEAR,
      GAME_CONSTANTS.CAMERA.FAR
    );

    setScreenEffects(): void {
      // 没有后处理
    }

    render(): void {
      // 不渲染
    }

    applyQualitySettings(): void {
      // 没有画质可调
    }

    applyLevelEnvironment(): void {
      // 没有环境
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

// 飞控换成只报位姿的替身：座机停在关卡出生点
vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: class {
    private readonly aircraft: THREE.Group;

    constructor(aircraft: THREE.Group) {
      this.aircraft = aircraft;
    }

    getPosition(): THREE.Vector3 {
      return this.aircraft.position.clone();
    }

    getQuaternion(): THREE.Quaternion {
      return this.aircraft.quaternion.clone();
    }

    getSpeed(): number {
      return 0;
    }

    update(): void {
      // 座机不动
    }

    dispose(): void {
      // 没有要清理的
    }
  },
}));

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

/** 规格 §4a “Hint lines” 表，逐字 */
const SPEC_HINTS: ReadonlyArray<readonly [EnemyType, LocalizedText]> = [
  [
    EnemyType.FIGHTER,
    {
      en: 'Fighters go for your tail. Turn into them to shake them off.',
      zh: '战斗机会咬你的尾巴，朝它转过去就能甩开。',
    },
  ],
  [
    EnemyType.SNIPER,
    {
      en: 'Red beam: a sniper is charging. When the beam freezes, change direction. Missiles catch it.',
      zh: '红色光束是狙击机在蓄力，光束定住的瞬间立刻转向。用导弹追它。',
    },
  ],
  [
    EnemyType.HEAVY,
    {
      en: 'Gunships fire slow shell fans. Attack from the side or below, not from behind.',
      zh: '炮艇机打出慢速弹幕，从侧面或下方进攻，别跟在正后方。',
    },
  ],
  [
    EnemyType.ACE,
    {
      en: 'Aces fire seeking missiles. On a missile warning, drop a flare and break.',
      zh: '王牌机会发射追踪导弹，出现导弹警告就放干扰弹并急转。',
    },
  ],
  [
    EnemyType.STRIKER,
    {
      en: 'Strikers launch missile pairs from far out. Close in while they reload.',
      zh: '打击机在远处成对发射导弹，趁它装填时贴上去。',
    },
  ],
  [
    EnemyType.JAMMER,
    {
      en: 'A Jammer slows your missile lock. Shoot it down first — guns still work.',
      zh: '干扰机会拖慢导弹锁定，先把它打掉——机炮不受影响。',
    },
  ],
  [
    EnemyType.WRAITH,
    {
      en: 'Wraiths cloak and strike from behind. Watch for the red flash, then turn.',
      zh: '幽灵机隐身后从背后偷袭，看到红色闪光就立刻转向。',
    },
  ],
];

const HINT_OF = new Map<EnemyType, LocalizedText>(SPEC_HINTS);
const ALL_HINT_TEXTS = SPEC_HINTS.flatMap(([, hint]) => [hint.en, hint.zh]);

interface Introduction {
  type: EnemyType;
  level: number;
  /** 波次（0 起） */
  wave: number;
}

/** 每种机型在战役里第一次出现的那一波（按关卡、波次顺序扫写定的编成） */
function introductions(): Introduction[] {
  const seen = new Set<EnemyType>();
  const result: Introduction[] = [];
  for (const level of ALL_LEVELS) {
    const config = getLevelConfig(level);
    if (!config) throw new Error(`level ${level} missing`);
    config.waves.forEach((wave, index) => {
      for (const type of wave.lineup) {
        if (seen.has(type)) continue;
        seen.add(type);
        result.push({ type, level, wave: index });
      }
    });
  }
  return result;
}

const HINTED_INTRODUCTIONS = introductions().filter(({ type }) => type !== EnemyType.SCOUT);

function isIntroductionWave(level: number, wave: number): boolean {
  return HINTED_INTRODUCTIONS.some((intro) => intro.level === level && intro.wave === wave);
}

function label(level: number, wave: number): string {
  return `level ${level} wave ${wave + 1}`;
}

// ─────────────────────────────── 数据 ───────────────────────────────

describe('the hint lines (spec §4a)', () => {
  it.each(SPEC_HINTS)('%s: the exact line in both languages', (type, text) => {
    expect(FIRST_CONTACT_HINTS[type]).toEqual(text);
  });

  it('SCOUT has no hint, and there is no hint for any type the spec does not list', () => {
    expect(FIRST_CONTACT_HINTS[EnemyType.SCOUT]).toBeUndefined();
    expect(Object.keys(FIRST_CONTACT_HINTS).sort()).toEqual(
      SPEC_HINTS.map(([type]) => type).sort()
    );
  });

  it('each line is one line of text (no line breaks)', () => {
    for (const text of ALL_HINT_TEXTS) expect(text).not.toMatch(/\n/);
  });

  it('no voiced line carries a hint: the hints are text only', () => {
    const voiced = getVoiceScript().flatMap((line) => [line.text.en, line.text.zh]);
    for (const hint of ALL_HINT_TEXTS) {
      for (const line of voiced) expect(line.includes(hint), hint).toBe(false);
    }
  });
});

describe('which waves have a hint (spec §4a rule 8)', () => {
  it('the introduction waves are the ones of the spec’s starting line-ups (test self-check)', () => {
    expect(
      HINTED_INTRODUCTIONS.map(({ type, level, wave }) => `${type} ${label(level, wave)}`)
    ).toEqual([
      'FIGHTER level 1 wave 3',
      'SNIPER level 2 wave 2',
      'HEAVY level 2 wave 4',
      'ACE level 3 wave 4',
      'STRIKER level 4 wave 2',
      'JAMMER level 5 wave 2',
      'WRAITH level 7 wave 2',
    ]);
  });

  it.each(HINTED_INTRODUCTIONS.map((intro) => [intro.type, intro] as const))(
    '%s: its introduction wave has exactly its hint',
    (_type, intro) => {
      expect(getFirstContactHints(intro.level, intro.wave)).toEqual([HINT_OF.get(intro.type)]);
    }
  );

  it('every other wave of every level has none (level 1 wave 1 included)', () => {
    for (const level of ALL_LEVELS) {
      const config = getLevelConfig(level);
      for (let wave = 0; wave < (config?.totalWaves ?? 0); wave++) {
        if (isIntroductionWave(level, wave)) continue;
        expect(getFirstContactHints(level, wave), label(level, wave)).toEqual([]);
      }
    }
  });
});

// ─────────────────────────────── 游戏里 ───────────────────────────────

describe('in the game: the hint on the HUD (spec §4a rule 8)', () => {
  let restoreGlobals: () => void;
  const rigs: CampaignRig[] = [];

  async function boot(): Promise<CampaignRig> {
    const rig = await CampaignRig.boot();
    rigs.push(rig);
    return rig;
  }

  beforeEach(() => {
    restoreGlobals = installCampaignGlobals();
    window.localStorage.clear();
  });

  afterEach(() => {
    while (rigs.length > 0) rigs.pop()?.dispose();
    restoreGlobals();
    resetLocale();
    window.localStorage.clear();
  });

  /** 第 level 关第 wave 波最近一次开波的时刻 */
  function waveStartedAt(rig: CampaignRig, level: number, wave: number): number {
    const starts = rig.waveStarts.filter((start) => start.level === level && start.wave === wave);
    expect(starts.length, `${label(level, wave)} started`).toBeGreaterThan(0);
    return starts[starts.length - 1].at;
  }

  /** 本波第一架敌机现身的时刻（还没有现身时为 Infinity） */
  function firstArrivalAfter(rig: CampaignRig, time: number): number {
    return rig.arrivals.find((arrival) => arrival.at >= time)?.at ?? Infinity;
  }

  /** 读档到第 level 关第 wave 波，一直推进到开波后 seconds 秒（不击毁任何敌机） */
  async function resumeAndWatch(
    rig: CampaignRig,
    level: number,
    wave: number,
    seconds: number
  ): Promise<number> {
    const startsBefore = rig.waveStarts.length;
    await rig.resume(waveCheckpoint(level, wave));
    const started = await rig.runUntil(() => rig.waveStarts.length > startsBefore, 10);
    expect(started, `${label(level, wave)} started`).toBe(true);
    expect(rig.waveStarts[rig.waveStarts.length - 1]).toMatchObject({ level, wave });
    await rig.run(seconds);
    return waveStartedAt(rig, level, wave);
  }

  /** 看到的提示文字（任一语言、任一提示）出现过的各段 */
  function hintShowings(rig: CampaignRig): Array<{ text: string; from: number; to: number }> {
    return rig.callouts.filter((showing) => ALL_HINT_TEXTS.includes(showing.text));
  }

  describe.each(LOCALES)('in %s', (locale: Locale) => {
    it.each(HINTED_INTRODUCTIONS.map((intro) => [intro.type, intro] as const))(
      '%s: shown at the start of its introduction wave, resumed from that wave’s checkpoint',
      async (type, intro) => {
        setLocale(locale);
        const rig = await boot();
        const startedAt = await resumeAndWatch(rig, intro.level, intro.wave, 9);
        const hint = HINT_OF.get(type) as LocalizedText;
        const shown = hintShowings(rig);

        // 只显示了这一条，当前语言
        expect(shown.map((showing) => showing.text)).toEqual([textIn(hint, locale)]);
        // 开波之后、本波第一架敌机现身之前出现，停留的时间够读完（至少 2 秒）
        const [showing] = shown;
        expect(showing.from).toBeGreaterThanOrEqual(startedAt);
        expect(showing.from).toBeLessThan(firstArrivalAfter(rig, startedAt));
        const until = Number.isNaN(showing.to) ? rig.time : showing.to;
        expect(until - showing.from, 'seconds on screen').toBeGreaterThanOrEqual(2);
        // 没有语音：把它交给 HUD 的那个回调里没有任何语音 / 无线电调用，也没有哪次调用带着它
        const runs = rig.timerRuns.filter((run) =>
          run.callouts.some((text) => JSON.stringify(text) === JSON.stringify(hint))
        );
        expect(runs).toHaveLength(1);
        expect(runs[0].voiceCalls).toEqual([]);
        for (const call of rig.voiceCalls) {
          const args = JSON.stringify(call.args);
          expect(args.includes(hint.en) || args.includes(hint.zh), call.channel).toBe(false);
        }
      }
    );
  });

  it.each([
    [EnemyType.FIGHTER, 1, 2],
    [EnemyType.HEAVY, 2, 3],
    [EnemyType.WRAITH, 7, 1],
  ] as const)(
    '%s: playing on from the wave before, the hint comes with the introduction wave and not before or after',
    async (type, level, wave) => {
      const rig = await boot();
      await rig.resume(waveCheckpoint(level, wave - 1));
      // 前一波：敌机一现身就击毁，清波后等下一波开场
      const reached = await rig.runUntil(
        () => rig.waveStarts.some((start) => start.level === level && start.wave === wave),
        120,
        true
      );
      expect(reached, `${label(level, wave)} started`).toBe(true);
      const startedAt = waveStartedAt(rig, level, wave);
      expect(hintShowings(rig), 'nothing before the introduction wave').toEqual([]);
      // 引入波：先看提示，再清波，接着看下一波开场后的 9 秒
      await rig.run(9);
      const hint = HINT_OF.get(type) as LocalizedText;
      expect(hintShowings(rig).map((showing) => showing.text)).toEqual([hint.en]);
      expect(hintShowings(rig)[0].from).toBeGreaterThanOrEqual(startedAt);
      const next = await rig.runUntil(
        () => rig.waveStarts.some((start) => start.level === level && start.wave === wave + 1),
        120,
        true
      );
      expect(next, `${label(level, wave + 1)} started`).toBe(true);
      await rig.run(9);
      expect(
        hintShowings(rig).map((showing) => showing.text),
        'only the one'
      ).toEqual([hint.en]);
    }
  );

  it('shows again when the same wave is replayed from its checkpoint (a new session, after it was seen)', async () => {
    const intro = HINTED_INTRODUCTIONS.find(
      ({ type }) => type === EnemyType.STRIKER
    ) as Introduction;
    const hint = HINT_OF.get(intro.type) as LocalizedText;
    const first = await boot();
    await resumeAndWatch(first, intro.level, intro.wave, 9);
    expect(hintShowings(first).map((showing) => showing.text)).toEqual([hint.en]);
    first.dispose();
    rigs.splice(rigs.indexOf(first), 1);
    // 同一份浏览器存储：再开一局，从同一个检查点重打这一波
    const second = await boot();
    await resumeAndWatch(second, intro.level, intro.wave, 9);
    expect(hintShowings(second).map((showing) => showing.text)).toEqual([hint.en]);
  });

  it('shows again when the same wave is replayed from its checkpoint in the same session', async () => {
    const intro = HINTED_INTRODUCTIONS.find(
      ({ type }) => type === EnemyType.JAMMER
    ) as Introduction;
    const hint = HINT_OF.get(intro.type) as LocalizedText;
    const rig = await boot();
    await resumeAndWatch(rig, intro.level, intro.wave, 9);
    expect(hintShowings(rig)).toHaveLength(1);
    const replayedFrom = rig.time;
    await resumeAndWatch(rig, intro.level, intro.wave, 9);
    const again = hintShowings(rig).filter((showing) => showing.from > replayedFrom);
    expect(again.map((showing) => showing.text)).toEqual([hint.en]);
  });

  it('no hint in the other waves: level 1 wave 1, the waves around each introduction, and all of level 10', async () => {
    const waves = new Map<number, Set<number>>();
    const add = (level: number, wave: number): void => {
      const total = getLevelConfig(level)?.totalWaves ?? 0;
      if (wave < 0 || wave >= total || isIntroductionWave(level, wave)) return;
      if (!waves.has(level)) waves.set(level, new Set());
      waves.get(level)?.add(wave);
    };
    add(1, 0);
    for (const intro of HINTED_INTRODUCTIONS) {
      add(intro.level, intro.wave - 1);
      add(intro.level, intro.wave + 1);
    }
    for (let wave = 0; wave < 8; wave++) add(10, wave);
    let checked = 0;
    for (const [level, set] of waves) {
      const rig = await boot();
      for (const wave of set) {
        await resumeAndWatch(rig, level, wave, 9);
        checked++;
        expect(hintShowings(rig), label(level, wave)).toEqual([]);
      }
      rig.dispose();
      rigs.splice(rigs.indexOf(rig), 1);
    }
    expect(checked).toBeGreaterThanOrEqual(18);
  });
});
