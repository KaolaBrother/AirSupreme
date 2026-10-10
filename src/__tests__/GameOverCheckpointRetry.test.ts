import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { GameConfig } from '@/config';
import { GameCoordinator } from '@/core/GameCoordinator';
import {
  CAMPAIGN_SAVE_KEY,
  CAMPAIGN_SAVE_VERSION,
  describeCheckpoint,
  describeCheckpointText,
  loadCampaignCheckpoint,
  type CampaignSaveData,
} from '@/core/save/SaveSystem';
import { setLocale, type Locale, type LocalizedText } from '@/i18n';
import { HUD, type SettlementCheckpointRetry } from '@/ui/HUD';
import type { GameSettings } from '@/ui/StartMenu';
import {
  actionButtons,
  actionTexts,
  CHECKPOINT_WORDING,
  createCoordinatorRig,
  flush,
  isSettlementUp,
  keyDown,
  keyUp,
  LABELS,
  pressActivationKey,
  pressTab,
  rawSave,
  readText,
  resetKeyboardModel,
  runSettings,
  seedSave,
  settlementPanel,
  settlementTitle,
  START_OVER_WORDING,
  storageSnapshot,
  tabTo,
  visibleButtons,
  WAVE_CHECKPOINT,
  type CheckpointInput,
  type CoordinatorRig,
  type HostOptions,
} from './gameOverRig';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * 任务失败的结算面板不再删检查点（批次 P3a）。
 *
 * 规格：
 * 1. 存档的战役局（正常模式）阵亡、存在检查点、宿主提供了 onContinueFromCheckpoint：面板第一个、
 *    也是拿到焦点的动作是“从检查点重试”，并写明回到哪里（与 describeCheckpoint(save) 一致）；
 *    第二个是“返回菜单”；没有“再来一局”，也没有别的从头开始的动作。按下主动作（点击 / Enter /
 *    Space）把那份存档交给 onContinueFromCheckpoint。显示面板、重试、返回菜单都不动存储里的检查点。
 * 2. 没有检查点、Boss 模式、或宿主没给 onContinueFromCheckpoint：面板照旧是“再来一局 / 返回菜单”，
 *    “再来一局”调用 onRetry。Boss 模式下存储里躺着的战役存档不受影响。
 * 3. 任务完成：照旧“再来一局 / 返回菜单”；战役通关时检查点已清除，没有可重试的东西。
 * 4. 旧的浮动按钮 #checkpoint-resume-btn 在任何状态下都不存在；重试动作只有一个，在面板的动作行里。
 * 5. 文案跟随当前语言。
 * 6. 结算界面没有任何一条路会不声不响地毁掉或改写检查点。
 * 7. 只用键盘的玩家在每种状态下都够得着并能触发面板上的每个动作。
 *
 * 两层：先直接驱动 HUD（面板本身），再经协调器台架（见 gameOverRig.ts）从阵亡事件走到面板——
 * 面板上是什么、按下去交给宿主什么，都由生产代码决定。经 main.ts 重新开局的部分在
 * GameOverRetryBoot.test.ts。
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** WAVE_CHECKPOINT（第 2 关、下一波是第 4 波）的位置 */
const WAVE_PLACE: LocalizedText = {
  en: 'Ch. 2 · Sandstorm · Wave 4',
  zh: '第2关 · 沙漠风暴 · 第4波',
};

/** 四种检查点各自回到哪里 */
const PLACES: Array<{ name: string; save: Partial<CheckpointInput>; place: LocalizedText }> = [
  {
    name: 'a wave checkpoint',
    save: { checkpoint: 'wave', level: 2, wave: 3 },
    place: WAVE_PLACE,
  },
  {
    name: 'the start of a level',
    save: { checkpoint: 'level-start', level: 1, wave: 0 },
    place: { en: 'Ch. 1 · Dawn at the Lake · Wave 1', zh: '第1关 · 湖畔晨曦 · 第1波' },
  },
  {
    name: 'the checkpoint before a boss',
    save: { checkpoint: 'boss', level: 6, wave: 7 },
    place: { en: 'Ch. 6 · Heart of the Forge · Boss', zh: '第6关 · 熔炉之心 · Boss 战' },
  },
  {
    name: 'a hangar stop',
    save: { checkpoint: 'hangar', level: 10, wave: 0 },
    place: { en: 'Ch. 10 · The Oracle Core · Hangar', zh: '第10关 · 神谕核心 · 机库整备' },
  },
];

function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'zh-CN' : 'en';
}

/** 存储里那份检查点（经校验后的样子） */
function storedSave(): CampaignSaveData {
  const save = loadCampaignCheckpoint();
  expect(save, 'a valid checkpoint is stored').not.toBeNull();
  return save as CampaignSaveData;
}

/** 文档里玩家看得见的“从检查点重试 / 继续”按钮 */
function retryActions(): HTMLButtonElement[] {
  return visibleButtons().filter((button) => CHECKPOINT_WORDING.test(readText(button)));
}

/** 对检查点那个键的写入 / 删除次数（内容相同的重写也算） */
function watchCheckpointWrites(): () => number {
  const set = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const clear = vi.spyOn(Storage.prototype, 'clear');
  return () =>
    set.mock.calls.filter(([key]) => key === CAMPAIGN_SAVE_KEY).length +
    remove.mock.calls.filter(([key]) => key === CAMPAIGN_SAVE_KEY).length +
    clear.mock.calls.length;
}

/** HUD 用 performance.now() 给面板计时：这里把它换成手拨的钟 */
let now = 0;

function installClock(): void {
  now = 50_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
}

/** 面板出现之后过了一会儿（玩家看清了面板再按键） */
function letThePanelSettle(): void {
  now += 1_000;
}

let originalIsMobile: boolean;

function prepare(): void {
  originalIsMobile = GameConfig.isMobile;
  // 键盘玩家在桌面上；面板本身不分桌面 / 触屏
  GameConfig.isMobile = false;
  document.body.innerHTML = '';
  window.localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  installClock();
}

function cleanUp(): void {
  resetKeyboardModel();
  GameConfig.isMobile = originalIsMobile;
  resetLocale();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.body.innerHTML = '';
}

// ══════════════════════════════════ 面板本身（HUD） ══════════════════════════════════

interface Bench {
  hud: HUD;
  /** “再来一局” */
  onRetry: Mock<() => void>;
  onExitToMenu: Mock<() => void>;
  /** “从检查点重试” */
  onCheckpointRetry: Mock<() => void>;
  save: CampaignSaveData;
  retry: SettlementCheckpointRetry;
}

function createBench(): Bench {
  seedSave();
  const save = storedSave();
  const onRetry = vi.fn<() => void>();
  const onExitToMenu = vi.fn<() => void>();
  const onCheckpointRetry = vi.fn<() => void>();
  const hud = new HUD();
  hud.setSettlementActions({ onRetry, onExitToMenu });
  return {
    hud,
    onRetry,
    onExitToMenu,
    onCheckpointRetry,
    save,
    retry: { detail: describeCheckpointText(save), onRetry: onCheckpointRetry },
  };
}

describe.each(LOCALES)('result panel on the HUD (%s)', (locale) => {
  let bench: Bench;

  beforeEach(() => {
    prepare();
    setLocale(locale);
    bench = createBench();
  });

  afterEach(() => {
    bench.hud.dispose();
    cleanUp();
  });

  describe('MISSION FAILED with a checkpoint to retry from', () => {
    beforeEach(() => {
      bench.hud.showGameOver(4_200, bench.retry);
    });

    it('is up, titled MISSION FAILED', () => {
      expect(isSettlementUp()).toBe(true);
      expect(settlementTitle()).toBe(textIn(LABELS.failed, locale));
    });

    it('leads with "Retry from checkpoint" and says where that is', () => {
      const [first] = actionButtons();

      expect(readText(first)).toContain(textIn(LABELS.retry, locale));
      expect(readText(first)).toContain(textIn(WAVE_PLACE, locale));
      expect(readText(first), 'the same text describeCheckpoint(save) gives').toContain(
        describeCheckpoint(bench.save)
      );
      expect(readText(first)).not.toContain(textIn(WAVE_PLACE, otherLocale(locale)));
    });

    it('puts the focus on the retry action', () => {
      expect(document.activeElement).toBe(actionButtons()[0]);
    });

    it('has Main Menu as the second and last action', () => {
      expect(actionTexts()).toHaveLength(2);
      expect(actionTexts()[1]).toBe(textIn(LABELS.mainMenu, locale));
    });

    it('offers no Play Again and nothing else that starts over', () => {
      expect(readText(settlementPanel())).not.toMatch(START_OVER_WORDING);
      for (const button of visibleButtons()) {
        expect(readText(button)).not.toMatch(START_OVER_WORDING);
      }
      expect(visibleButtons(), 'the two panel actions are the only buttons').toEqual(
        actionButtons()
      );
    });

    it('pressing the first action runs the checkpoint retry, not Play Again', () => {
      actionButtons()[0].click();

      expect(bench.onCheckpointRetry).toHaveBeenCalledTimes(1);
      expect(bench.onRetry).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });

    it('pressing Main Menu leaves for the menu and retries nothing', () => {
      actionButtons()[1].click();

      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(bench.onCheckpointRetry).not.toHaveBeenCalled();
      expect(bench.onRetry).not.toHaveBeenCalled();
    });

    it('leaves the stored checkpoint alone', () => {
      const raw = rawSave();
      const writes = watchCheckpointWrites();

      bench.hud.showGameOver(4_200, bench.retry);
      actionButtons()[0].click();
      actionButtons()[1].click();

      expect(rawSave()).toBe(raw);
      expect(writes()).toBe(0);
    });
  });

  describe.each([
    ['MISSION FAILED without a checkpoint', LABELS.failed, (hud: HUD) => hud.showGameOver(4_200)],
    [
      'MISSION FAILED with the retry passed as null',
      LABELS.failed,
      (hud: HUD) => hud.showGameOver(4_200, null),
    ],
    ['MISSION COMPLETE', LABELS.complete, (hud: HUD) => hud.showMissionComplete(4_200)],
  ] as const)('%s', (_name, title, show) => {
    beforeEach(() => {
      show(bench.hud);
    });

    it('is Play Again and Main Menu, as before', () => {
      expect(isSettlementUp()).toBe(true);
      expect(settlementTitle()).toBe(textIn(title, locale));
      expect(actionTexts()).toEqual([
        textIn(LABELS.playAgain, locale),
        textIn(LABELS.mainMenu, locale),
      ]);
    });

    it('mentions no checkpoint', () => {
      expect(readText(settlementPanel())).not.toMatch(CHECKPOINT_WORDING);
      expect(retryActions()).toHaveLength(0);
    });

    it('Play Again calls onRetry, Main Menu calls onExitToMenu', () => {
      const [playAgain, mainMenu] = actionButtons();

      playAgain.click();
      expect(bench.onRetry).toHaveBeenCalledTimes(1);
      expect(bench.onExitToMenu).not.toHaveBeenCalled();

      mainMenu.click();
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(bench.onRetry).toHaveBeenCalledTimes(1);
      expect(bench.onCheckpointRetry).not.toHaveBeenCalled();
    });
  });
});

describe('result panel on the HUD: one state after another', () => {
  let bench: Bench;

  beforeEach(() => {
    prepare();
    bench = createBench();
  });

  afterEach(() => {
    bench.hud.dispose();
    cleanUp();
  });

  it('a later failure without a checkpoint does not inherit the earlier retry', () => {
    bench.hud.showGameOver(100, bench.retry);
    bench.hud.hideGameOver();
    bench.hud.showGameOver(200);

    expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
    actionButtons()[0].click();
    expect(bench.onRetry).toHaveBeenCalledTimes(1);
    expect(bench.onCheckpointRetry).not.toHaveBeenCalled();
  });

  it('MISSION COMPLETE after a failed attempt carries no retry over', () => {
    bench.hud.showGameOver(100, bench.retry);
    bench.hud.showMissionComplete(900);

    expect(settlementTitle()).toBe(LABELS.complete.en);
    expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
    expect(readText(settlementPanel())).not.toContain(WAVE_PLACE.en);
    actionButtons()[0].click();
    expect(bench.onRetry).toHaveBeenCalledTimes(1);
    expect(bench.onCheckpointRetry).not.toHaveBeenCalled();
  });

  it('a failure with a checkpoint after one without leads with the retry again', () => {
    bench.hud.showGameOver(100);
    bench.hud.hideGameOver();
    bench.hud.showGameOver(200, bench.retry);

    const [first, second] = actionButtons();
    expect(readText(first)).toContain(LABELS.retry.en);
    expect(readText(first)).toContain(WAVE_PLACE.en);
    expect(readText(second)).toBe(LABELS.mainMenu.en);
    expect(actionTexts().join(' ')).not.toMatch(START_OVER_WORDING);
    expect(document.activeElement).toBe(first);
  });

  it('a second failure describes and retries the newer checkpoint', () => {
    const newer = vi.fn<() => void>();
    bench.hud.showGameOver(100, bench.retry);
    bench.hud.hideGameOver();
    bench.hud.showGameOver(300, {
      detail: { en: 'Ch. 3 · Snowbound Summit · Boss', zh: '第3关 · 雪山之巅 · Boss 战' },
      onRetry: newer,
    });

    expect(readText(actionButtons()[0])).toContain('Ch. 3 · Snowbound Summit · Boss');
    expect(readText(actionButtons()[0])).not.toContain(WAVE_PLACE.en);
    actionButtons()[0].click();
    expect(newer).toHaveBeenCalledTimes(1);
    expect(bench.onCheckpointRetry).not.toHaveBeenCalled();
  });

  it('a dismissed panel shows no actions', () => {
    bench.hud.showGameOver(100, bench.retry);
    bench.hud.hideGameOver();

    expect(isSettlementUp()).toBe(false);
    expect(visibleButtons()).toHaveLength(0);
  });
});

describe('result panel on the HUD: language', () => {
  let bench: Bench;

  beforeEach(() => {
    prepare();
    bench = createBench();
  });

  afterEach(() => {
    bench.hud.dispose();
    cleanUp();
  });

  function expectRetryPanelIn(locale: Locale): void {
    const [first, second] = actionButtons();
    expect(settlementTitle()).toBe(textIn(LABELS.failed, locale));
    expect(readText(first)).toContain(textIn(LABELS.retry, locale));
    expect(readText(first)).toContain(textIn(WAVE_PLACE, locale));
    expect(readText(second)).toBe(textIn(LABELS.mainMenu, locale));
    const other = otherLocale(locale);
    expect(readText(settlementPanel())).not.toContain(textIn(LABELS.retry, other));
    expect(readText(settlementPanel())).not.toContain(textIn(WAVE_PLACE, other));
    expect(readText(settlementPanel())).not.toContain(textIn(LABELS.mainMenu, other));
  }

  it.each(LOCALES)('re-words an open retry panel when the language changes (to %s)', (locale) => {
    setLocale(otherLocale(locale));
    bench.hud.showGameOver(100, bench.retry);
    expectRetryPanelIn(otherLocale(locale));

    setLocale(locale);

    expectRetryPanelIn(locale);
    expect(actionTexts()).toHaveLength(2);
  });

  it.each(LOCALES)('a language changed between two failures shows in the second (%s)', (locale) => {
    setLocale(otherLocale(locale));
    bench.hud.showGameOver(100, bench.retry);
    bench.hud.hideGameOver();

    setLocale(locale);
    bench.hud.showGameOver(200, bench.retry);

    expectRetryPanelIn(locale);
  });

  it.each(LOCALES)('a language picked before the HUD ever drew anything is used (%s)', (locale) => {
    // bench.hud 是在英文下创建的，尚未初始化
    setLocale(locale);
    bench.hud.showGameOver(100, bench.retry);

    expectRetryPanelIn(locale);
  });

  it.each(LOCALES)(
    'the retry survives the language switch: same action, same checkpoint (%s)',
    (locale) => {
      bench.hud.showGameOver(100, bench.retry);
      setLocale(locale);

      actionButtons()[0].click();

      expect(bench.onCheckpointRetry).toHaveBeenCalledTimes(1);
      expect(bench.onRetry).not.toHaveBeenCalled();
    }
  );
});

describe('the old floating "continue from checkpoint" button is gone', () => {
  let bench: Bench;

  beforeEach(() => {
    prepare();
    bench = createBench();
  });

  afterEach(() => {
    bench.hud.dispose();
    cleanUp();
  });

  const STATES: Array<{ name: string; show: (bench: Bench) => void; retries: number }> = [
    { name: 'during play', show: (b) => b.hud.show(), retries: 0 },
    {
      name: 'MISSION FAILED with a checkpoint',
      show: (b) => b.hud.showGameOver(900, b.retry),
      retries: 1,
    },
    {
      name: 'MISSION FAILED without a checkpoint',
      show: (b) => b.hud.showGameOver(900),
      retries: 0,
    },
    { name: 'MISSION COMPLETE', show: (b) => b.hud.showMissionComplete(900), retries: 0 },
    {
      name: 'after the panel was dismissed',
      show: (b) => {
        b.hud.showGameOver(900, b.retry);
        b.hud.hideGameOver();
      },
      retries: 0,
    },
  ];

  it.each(STATES)('$name: no #checkpoint-resume-btn', ({ show }) => {
    show(bench);
    expect(document.getElementById('checkpoint-resume-btn')).toBeNull();
  });

  it.each(STATES)(
    '$name: $retries retry action(s), inside the panel’s action row',
    ({ show, retries }) => {
      show(bench);

      expect(retryActions()).toHaveLength(retries);
      for (const button of retryActions()) {
        expect(button.closest('#hud-settlement-actions')).not.toBeNull();
        expect(button.closest('#hud-settlement-panel')).not.toBeNull();
      }
    }
  );

  it('the shipped sources no longer contain the class or the element id', () => {
    const collect = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (!statSync(full).isFile()) {
          return name === '__tests__' ? [] : collect(full);
        }
        return /\.(ts|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
      });
    const sources = [
      ...collect(path.join(PROJECT_ROOT, 'src')),
      path.join(PROJECT_ROOT, 'index.html'),
    ];
    expect(sources.length).toBeGreaterThan(50);

    const mentions = sources.filter((file) =>
      /checkpoint-resume-btn|CheckpointResumeButton/.test(readFileSync(file, 'utf8'))
    );

    expect(mentions.map((file) => file.slice(PROJECT_ROOT.length + 1))).toEqual([]);
    expect(existsSync(path.join(PROJECT_ROOT, 'src/ui/CheckpointResumeButton.ts'))).toBe(false);
  });
});

describe('result panel on the HUD: its buttons are ordinary focusable buttons', () => {
  // 对照组：页面上只有 HUD、没有游戏的按键处理时，Tab 能走到每个动作——
  // 下面协调器那一层里走不到，问题就不在面板的按钮上，也不在这里的键盘模型上
  let bench: Bench;

  beforeEach(() => {
    prepare();
    bench = createBench();
  });

  afterEach(() => {
    bench.hud.dispose();
    cleanUp();
  });

  it.each([
    ['MISSION FAILED with a checkpoint', (b: Bench) => b.hud.showGameOver(900, b.retry)],
    ['MISSION FAILED without a checkpoint', (b: Bench) => b.hud.showGameOver(900)],
    ['MISSION COMPLETE', (b: Bench) => b.hud.showMissionComplete(900)],
  ] as const)('%s: Tab reaches both actions', (_name, show) => {
    show(bench);
    const [first, second] = actionButtons();

    expect(tabTo(first)).toBe(true);
    expect(tabTo(second)).toBe(true);
    expect(tabTo(first)).toBe(true);
  });
});

// ══════════════════════════════════ 经协调器 ══════════════════════════════════

interface Host {
  onRetry: Mock<() => void>;
  onExitToMenu: Mock<() => void>;
  onContinueFromCheckpoint: Mock<(save: CampaignSaveData) => void>;
}

describe('game over through the coordinator', () => {
  let host: Host;
  let rig: CoordinatorRig | null;

  beforeEach(() => {
    prepare();
    rig = null;
    host = {
      onRetry: vi.fn<() => void>(),
      onExitToMenu: vi.fn<() => void>(),
      onContinueFromCheckpoint: vi.fn<(save: CampaignSaveData) => void>(),
    };
  });

  afterEach(async () => {
    if (rig && !rig.isDisposed()) {
      rig.dispose();
    }
    await flush(2);
    cleanUp();
  });

  /** 开一局并等它开始；默认是存档的战役局（正常模式），宿主三个回调都给 */
  async function startRun(
    settings: Partial<GameSettings> = {},
    options: HostOptions = host
  ): Promise<CoordinatorRig> {
    const created = createCoordinatorRig(GameCoordinator, { showStartMenu: false, ...options });
    rig = created;
    created.boot(runSettings(settings));
    await created.playing();
    return created;
  }

  /** 战役局打到了某个检查点（这一局自己写下的存档），随后阵亡 */
  async function dieAtCheckpoint(
    save: Partial<CheckpointInput> = {}
  ): Promise<{ run: CoordinatorRig; raw: string }> {
    const run = await startRun();
    const raw = seedSave(save);
    run.die();
    return { run, raw };
  }

  describe('a saving campaign run with a checkpoint (spec 1)', () => {
    it('shows MISSION FAILED with the retry first and focused, Main Menu second', async () => {
      await dieAtCheckpoint();

      expect(isSettlementUp()).toBe(true);
      expect(settlementTitle()).toBe(LABELS.failed.en);
      const [first, second] = actionButtons();
      expect(actionButtons()).toHaveLength(2);
      expect(readText(first)).toContain(LABELS.retry.en);
      expect(readText(first)).toContain(WAVE_PLACE.en);
      expect(readText(second)).toBe(LABELS.mainMenu.en);
      expect(document.activeElement).toBe(first);
    });

    it('has no Play Again and no other action that starts over', async () => {
      await dieAtCheckpoint();

      expect(readText(settlementPanel())).not.toMatch(START_OVER_WORDING);
      for (const button of visibleButtons()) {
        expect(readText(button)).not.toMatch(START_OVER_WORDING);
      }
      expect(visibleButtons()).toEqual(actionButtons());
    });

    describe.each(LOCALES)('says where the retry goes back to (%s)', (locale) => {
      it.each(PLACES)('$name', async ({ save, place }) => {
        setLocale(locale);
        await dieAtCheckpoint(save);

        const [first, second] = actionButtons();
        expect(readText(first)).toContain(textIn(LABELS.retry, locale));
        expect(readText(first)).toContain(textIn(place, locale));
        expect(readText(first)).toContain(describeCheckpoint(storedSave()));
        expect(readText(second)).toBe(textIn(LABELS.mainMenu, locale));
        expect(settlementTitle()).toBe(textIn(LABELS.failed, locale));
      });
    });

    it('describes the checkpoint the run itself wrote when a wave was cleared', async () => {
      const run = await startRun({ startLevel: 3 });
      run.completeWave(1);
      expect(rawSave(), 'the run wrote its wave checkpoint').not.toBeNull();

      run.die();

      expect(readText(actionButtons()[0])).toContain('Ch. 3 · Snowbound Summit · Wave 3');
      expect(readText(actionButtons()[0])).toContain(describeCheckpoint(storedSave()));
    });

    it.each([
      ['a click', () => actionButtons()[0].click()],
      ['Enter', () => pressActivationKey('Enter')],
      ['Space', () => pressActivationKey(' ')],
    ] as const)('%s on the retry hands exactly that save to the host', async (_name, activate) => {
      const { raw } = await dieAtCheckpoint();
      letThePanelSettle();

      activate();

      expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
      const [handed] = host.onContinueFromCheckpoint.mock.calls[0];
      expect(handed).toEqual(JSON.parse(raw));
      expect(handed).toEqual(storedSave());
      expect(host.onRetry).not.toHaveBeenCalled();
      expect(host.onExitToMenu).not.toHaveBeenCalled();
    });

    // FINDING（低）：规格第 1 条写“不管按多少下，只把存档交给 onContinueFromCheckpoint 一次”。
    // 面板和协调器都不拦：按 N 下就调用宿主 N 次（src/ui/HUD.ts:850-857，
    // src/core/GameCoordinator.ts:2412）。成品里只开出一局，靠的是 main.ts：第一次调用同步销毁
    // 旧游戏（面板随之移除），bootGame 的防重入再挡掉其余几次（见 GameOverRetryBoot.test.ts）。
    it.fails('hands the save over once however many times the retry is pressed', async () => {
      await dieAtCheckpoint();
      letThePanelSettle();
      const retry = actionButtons()[0];

      retry.click();
      retry.click();
      pressActivationKey('Enter');

      expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['Space (the fire key)', ' '],
      ['Enter', 'Enter'],
    ] as const)(
      '%s held down as the panel appears, and let go later, does not retry',
      async (_name, key) => {
        const run = await startRun();
        seedSave();
        // 阵亡那一刻键还按着；面板出现后系统的按键重复落在刚拿到焦点的重试键上
        keyDown(key);
        run.die();

        for (let i = 0; i < 12; i++) {
          keyDown(key, { repeat: true });
          now += 33;
        }
        letThePanelSettle();
        for (let i = 0; i < 12; i++) {
          keyDown(key, { repeat: true });
          now += 33;
        }
        keyUp(key);

        expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
        expect(host.onRetry).not.toHaveBeenCalled();
        expect(host.onExitToMenu).not.toHaveBeenCalled();
      }
    );

    it('…and a fresh press after letting go does retry', async () => {
      const run = await startRun();
      seedSave();
      keyDown(' ');
      run.die();
      keyDown(' ', { repeat: true });
      letThePanelSettle();
      keyUp(' ');

      pressActivationKey(' ');

      expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
    });

    // 规格没有写这一条：阵亡那一瞬间还在连点开火键（空格）的玩家，不该被这一下直接带进重试、
    // 连结算面板都没看清。实现给面板留了一小段不应期；它有多长是实现者定的，这里不钉毫秒数，
    // 只钉“面板刚出现的那一下不算，看清之后再按才算”。
    it.each([
      ['Space (the fire key)', ' '],
      ['Enter', 'Enter'],
    ] as const)(
      '%s tapped in the very instant the panel appears does not retry; a tap once it settled does',
      async (_name, key) => {
        await dieAtCheckpoint();

        pressActivationKey(key);

        expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
        expect(host.onRetry).not.toHaveBeenCalled();
        expect(host.onExitToMenu).not.toHaveBeenCalled();
        expect(isSettlementUp(), 'the panel is still there to read').toBe(true);

        letThePanelSettle();
        pressActivationKey(key);

        expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
      }
    );

    it('Main Menu calls onExitToMenu and hands no save anywhere', async () => {
      await dieAtCheckpoint();

      actionButtons()[1].click();

      expect(host.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
      expect(host.onRetry).not.toHaveBeenCalled();
    });

    it('showing the panel, retrying and Main Menu all leave the stored checkpoint byte-for-byte', async () => {
      const run = await startRun();
      const raw = seedSave();
      const everything = storageSnapshot();
      const writes = watchCheckpointWrites();

      run.die();
      expect(rawSave(), 'after the panel came up').toBe(raw);

      letThePanelSettle();
      actionButtons()[0].click();
      pressActivationKey('Enter');
      expect(rawSave(), 'after retrying').toBe(raw);

      actionButtons()[1].click();
      expect(rawSave(), 'after Main Menu').toBe(raw);

      expect(writes(), 'not even rewritten with the same bytes').toBe(0);
      expect(storageSnapshot()).toEqual(everything);
    });

    it('a campaign run that is in its boss fight still gets the retry', async () => {
      const run = await startRun({ startLevel: 6 });
      run.session.setInBossBattle(true);
      seedSave({ checkpoint: 'boss', level: 6, wave: 7 });

      run.die();

      expect(readText(actionButtons()[0])).toContain(LABELS.retry.en);
      expect(readText(actionButtons()[0])).toContain('Ch. 6 · Heart of the Forge · Boss');
      expect(actionTexts().join(' ')).not.toMatch(START_OVER_WORDING);
    });

    it('a death with lives left brings up no result panel at all', async () => {
      const run = await startRun();
      seedSave();

      run.die(2);

      expect(isSettlementUp()).toBe(false);
      expect(visibleButtons()).toHaveLength(0);
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
    });
  });

  describe('no checkpoint, boss mode, or no continue callback (spec 2)', () => {
    function expectPlayAgainPanel(): void {
      expect(isSettlementUp()).toBe(true);
      expect(settlementTitle()).toBe(LABELS.failed.en);
      expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
      expect(readText(settlementPanel())).not.toMatch(CHECKPOINT_WORDING);
      expect(retryActions()).toHaveLength(0);
    }

    function expectPlayAgainCallsOnRetry(): void {
      letThePanelSettle();
      actionButtons()[0].click();
      expect(host.onRetry).toHaveBeenCalledTimes(1);
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
      expect(host.onExitToMenu).not.toHaveBeenCalled();

      actionButtons()[1].click();
      expect(host.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(host.onRetry).toHaveBeenCalledTimes(1);
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
    }

    it('a campaign run that died before its first checkpoint gets Play Again + Main Menu', async () => {
      const run = await startRun();
      expect(rawSave(), 'nothing saved yet').toBeNull();

      run.die();

      expectPlayAgainPanel();
      expectPlayAgainCallsOnRetry();
      expect(rawSave(), 'and the panel saved nothing').toBeNull();
    });

    it('boss mode gets Play Again + Main Menu even with a campaign save in storage', async () => {
      const raw = seedSave();
      const run = await startRun({ gameMode: 'boss', startLevel: 4 });
      expect(rawSave(), 'starting a boss-mode run left the campaign save alone').toBe(raw);

      run.die();

      expectPlayAgainPanel();
      expectPlayAgainCallsOnRetry();
    });

    it('boss mode: neither the panel nor Play Again touches the campaign save', async () => {
      const raw = seedSave();
      const run = await startRun({ gameMode: 'boss', startLevel: 4 });
      const everything = storageSnapshot();
      const writes = watchCheckpointWrites();

      run.die();
      letThePanelSettle();
      actionButtons()[0].click();
      actionButtons()[1].click();

      expect(rawSave()).toBe(raw);
      expect(writes()).toBe(0);
      expect(storageSnapshot()).toEqual(everything);
    });

    it('boss mode inside its boss fight is still boss mode', async () => {
      seedSave({ checkpoint: 'boss', level: 4, wave: 6 });
      const run = await startRun({ gameMode: 'boss', startLevel: 4 });
      run.session.setInBossBattle(true);

      run.die();

      expectPlayAgainPanel();
    });

    it('a host without onContinueFromCheckpoint gets Play Again + Main Menu', async () => {
      const run = await startRun(
        {},
        { onRetry: host.onRetry, onExitToMenu: host.onExitToMenu, resume: null }
      );
      const raw = seedSave();

      run.die();

      expectPlayAgainPanel();
      expect(rawSave(), 'the panel itself did not touch the save').toBe(raw);
      expectPlayAgainCallsOnRetry();
    });

    it('a host with no callbacks at all still shows the panel and survives the presses', async () => {
      const run = await startRun({}, {});
      seedSave();

      run.die();

      expectPlayAgainPanel();
      expect(() => {
        actionButtons()[0].click();
        actionButtons()[1].click();
      }).not.toThrow();
    });
  });

  describe('mission complete (spec 3)', () => {
    it.each(LOCALES)(
      'campaign complete: Play Again + Main Menu, nothing to retry (%s)',
      async (locale) => {
        setLocale(locale);
        const run = await startRun({ startLevel: 10 });
        seedSave({ checkpoint: 'boss', level: 10, wave: 8 });

        run.destroyBoss(10);

        expect(isSettlementUp()).toBe(true);
        expect(settlementTitle()).toBe(textIn(LABELS.complete, locale));
        expect(actionTexts()).toEqual([
          textIn(LABELS.playAgain, locale),
          textIn(LABELS.mainMenu, locale),
        ]);
        expect(readText(settlementPanel())).not.toMatch(CHECKPOINT_WORDING);
        expect(retryActions()).toHaveLength(0);
        expect(rawSave(), 'the campaign cleared its checkpoint on completion').toBeNull();
      }
    );

    it('campaign complete: Play Again calls onRetry, Main Menu calls onExitToMenu', async () => {
      const run = await startRun({ startLevel: 10 });
      seedSave({ checkpoint: 'boss', level: 10, wave: 8 });
      run.destroyBoss(10);

      actionButtons()[0].click();
      actionButtons()[1].click();

      expect(host.onRetry).toHaveBeenCalledTimes(1);
      expect(host.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
    });

    it('boss mode complete with a campaign save in storage: no retry, save untouched', async () => {
      const raw = seedSave();
      const run = await startRun({ gameMode: 'boss', startLevel: 10 });
      const writes = watchCheckpointWrites();

      run.destroyBoss(10);

      expect(settlementTitle()).toBe(LABELS.complete.en);
      expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
      expect(retryActions()).toHaveLength(0);
      actionButtons()[0].click();
      expect(host.onRetry).toHaveBeenCalledTimes(1);
      expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
      expect(writes()).toBe(0);
    });
  });

  describe('the floating button is gone (spec 4)', () => {
    it.each([
      ['MISSION FAILED with a checkpoint', async () => (await dieAtCheckpoint()).run, 1],
      ['MISSION FAILED without a checkpoint', async () => (await startRun()).die(), 0],
      ['MISSION COMPLETE', async () => (await startRun({ startLevel: 10 })).destroyBoss(10), 0],
      ['during play', async () => startRun(), 0],
    ] as const)('%s', async (_name, reach, retries) => {
      await reach();

      expect(document.getElementById('checkpoint-resume-btn')).toBeNull();
      expect(retryActions()).toHaveLength(retries);
      for (const button of retryActions()) {
        expect(button.closest('#hud-settlement-panel #hud-settlement-actions')).not.toBeNull();
      }
      // 面板之外没有别的按钮冒出来
      const strays = visibleButtons().filter(
        (button) => button.closest('#hud-settlement-panel') === null
      );
      expect(strays.map((button) => readText(button))).toEqual([]);
    });
  });

  describe('language (spec 5)', () => {
    it.each(LOCALES)('the open panel follows a switch to %s, place included', async (locale) => {
      setLocale(otherLocale(locale));
      await dieAtCheckpoint({ checkpoint: 'boss', level: 6, wave: 7 });
      const place = PLACES[2].place;
      expect(readText(actionButtons()[0])).toContain(textIn(place, otherLocale(locale)));

      setLocale(locale);

      const [first, second] = actionButtons();
      expect(readText(first)).toContain(textIn(LABELS.retry, locale));
      expect(readText(first)).toContain(textIn(place, locale));
      expect(readText(first)).not.toContain(textIn(place, otherLocale(locale)));
      expect(readText(second)).toBe(textIn(LABELS.mainMenu, locale));
      expect(settlementTitle()).toBe(textIn(LABELS.failed, locale));
    });

    it('the save handed over is the same whichever language the panel is in', async () => {
      const { raw } = await dieAtCheckpoint();
      setLocale('zh-CN');
      letThePanelSettle();

      actionButtons()[0].click();

      expect(host.onContinueFromCheckpoint.mock.calls[0][0]).toEqual(JSON.parse(raw));
    });
  });

  describe('nothing on this screen destroys or rewrites a checkpoint unannounced (spec 6)', () => {
    const VALID = {
      ...WAVE_CHECKPOINT,
      version: CAMPAIGN_SAVE_VERSION,
      savedAt: 1_760_000_000_000,
    };

    it.each([
      ['text that is not JSON', '{"version":1,"level":'],
      ['an empty string', ''],
      ['a JSON array', '[1,2,3]'],
      ['a record from a newer save format', JSON.stringify({ ...VALID, version: 99 })],
      ['a record from an older save format', JSON.stringify({ ...VALID, version: 0 })],
      ['a record with no level', JSON.stringify({ version: CAMPAIGN_SAVE_VERSION, wave: 2 })],
    ])(
      '%s in storage: Play Again + Main Menu, and no retry of something unreadable',
      async (_n, raw) => {
        const run = await startRun();
        window.localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);

        expect(() => run.die()).not.toThrow();

        expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
        expect(retryActions()).toHaveLength(0);
        actionButtons()[0].click();
        expect(host.onRetry).toHaveBeenCalledTimes(1);
        expect(host.onContinueFromCheckpoint).not.toHaveBeenCalled();
      }
    );

    it('a stored save with out-of-range fields is offered as what it loads as, and not rewritten', async () => {
      const run = await startRun();
      const raw = JSON.stringify({
        ...VALID,
        level: 42,
        wave: -3,
        lives: 0,
        difficulty: 11,
        score: -50,
      });
      window.localStorage.setItem(CAMPAIGN_SAVE_KEY, raw);
      const loaded = storedSave();
      const writes = watchCheckpointWrites();

      run.die();
      letThePanelSettle();
      actionButtons()[0].click();

      expect(readText(actionButtons()[0])).toContain(describeCheckpoint(loaded));
      expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
      expect(host.onContinueFromCheckpoint.mock.calls[0][0]).toEqual(loaded);
      expect(rawSave()).toBe(raw);
      expect(writes()).toBe(0);
    });

    it('a save whose level and difficulty differ from the current run is described and handed over as stored', async () => {
      const run = await startRun({ difficulty: 1, startLevel: 5, playerLives: 9 });
      const raw = seedSave({ level: 2, wave: 3, difficulty: 4, lives: 2 });

      run.die();
      letThePanelSettle();
      actionButtons()[0].click();

      expect(readText(actionButtons()[0])).toContain(WAVE_PLACE.en);
      const [handed] = host.onContinueFromCheckpoint.mock.calls[0];
      expect(handed).toMatchObject({ level: 2, wave: 3, difficulty: 4, lives: 2 });
      expect(rawSave()).toBe(raw);
    });

    it('storage that cannot be read: Play Again + Main Menu, nothing thrown, save still there afterwards', async () => {
      const run = await startRun();
      const raw = seedSave();
      const broken = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });

      expect(() => run.die()).not.toThrow();
      expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
      expect(retryActions()).toHaveLength(0);

      broken.mockRestore();
      expect(rawSave()).toBe(raw);
    });

    it('no storage at all (the accessor throws): Play Again + Main Menu, nothing thrown', async () => {
      const run = await startRun();
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
      try {
        expect(() => run.die()).not.toThrow();
        expect(actionTexts()).toEqual([LABELS.playAgain.en, LABELS.mainMenu.en]);
        actionButtons()[0].click();
        expect(host.onRetry).toHaveBeenCalledTimes(1);
      } finally {
        if (original) {
          Object.defineProperty(window, 'localStorage', original);
        } else {
          Reflect.deleteProperty(window, 'localStorage');
        }
      }
    });

    it('storage that is full: the retry is still offered and nothing tries to write', async () => {
      const run = await startRun();
      const raw = seedSave();
      const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      });

      run.die();
      letThePanelSettle();
      actionButtons()[0].click();

      expect(readText(actionButtons()[0])).toContain(LABELS.retry.en);
      expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
      expect(set).not.toHaveBeenCalled();
      expect(rawSave()).toBe(raw);
    });

    it('Esc or P on the result screen opens no pause menu (no Save & Exit to write a dead run)', async () => {
      const { run, raw } = await dieAtCheckpoint();

      run.togglePause();
      await flush();

      expect(run.session.isPaused()).toBe(false);
      expect(document.getElementById('pause-menu')).toBeNull();
      expect(visibleButtons()).toEqual(actionButtons());
      expect(rawSave()).toBe(raw);
    });

    it('…whereas during play the same key does pause (the check above is not vacuous)', async () => {
      const run = await startRun();

      run.togglePause();

      expect(run.session.isPaused()).toBe(true);
    });

    // FINDING（低）：面板一旦亮出“从检查点重试 · 第 N 波”，存储里的检查点还会被同一个模拟步里
    // 稍后到来的进度事件改写，面板不更新、也不提示。update() 在玩家阵亡之后照常把这一步剩下的
    // 系统跑完（src/core/GameCoordinator.ts:1183-1193，阵亡事件是同步发出的），所以“同归于尽”
    // ——最后一架敌机 / Boss 与玩家在同一步里被击毁——会在任务失败之后触发：
    //   · WAVE_COMPLETE → 写下一波的检查点（GameCoordinator.ts:854-857）；
    //   · LEVEL_COMPLETE → 写 Boss 战前检查点（GameCoordinator.ts:867-873）；
    //   · handleBossDestroy → 写下一关机库检查点；第 10 关则清掉检查点并记为通关
    //     （GameCoordinator.ts:3452，CampaignFlowController.ts:311-318 / 341）。
    // 写进去的快照生命数是 max(1, 0) = 1。“重试”仍回到面板上写的那一处（用的是阵亡时读到的那份），
    // “返回菜单 → 继续战役”却去了另一处。这几条用例直接往事件总线上发事件：如果修法是阵亡后
    // 不再跑这一步剩下的系统，而不是让这些处理器在结束后不写档，用例要相应改成驱动 update()。
    it.fails.each([
      ['the wave is cleared', (run: CoordinatorRig) => run.completeWave(3)],
      ['the level is cleared', (run: CoordinatorRig) => run.completeLevel(2)],
      ['the boss goes down', (run: CoordinatorRig) => run.destroyBoss(2)],
      ['the final boss goes down', (run: CoordinatorRig) => run.destroyBoss(10)],
    ] as const)(
      'once the panel is up, the stored checkpoint stays as described even if %s in that same step',
      async (_name, progress) => {
        const run = await startRun({ startLevel: 2 });
        seedSave({ checkpoint: 'wave', level: 2, wave: 3 });
        run.die();
        expect(readText(actionButtons()[0])).toContain(WAVE_PLACE.en);
        const everything = storageSnapshot();

        progress(run);

        expect(storageSnapshot()).toEqual(everything);
      }
    );
  });

  describe('keyboard only, with the game’s own key handling listening (spec 7)', () => {
    it('with a checkpoint: Tab moves between Retry and Main Menu, Enter and Space activate', async () => {
      await dieAtCheckpoint();
      const [retry, mainMenu] = actionButtons();
      letThePanelSettle();
      expect(document.activeElement).toBe(retry);

      expect(pressTab()).toBe(true);
      expect(document.activeElement).toBe(mainMenu);
      pressActivationKey('Enter');
      expect(host.onExitToMenu).toHaveBeenCalledTimes(1);
      pressActivationKey(' ');
      expect(host.onExitToMenu).toHaveBeenCalledTimes(2);

      expect(pressTab({ shiftKey: true })).toBe(true);
      expect(document.activeElement).toBe(retry);
      pressActivationKey(' ');
      expect(host.onContinueFromCheckpoint).toHaveBeenCalledTimes(1);
    });

    it('with a checkpoint: every action can be reached from every other', async () => {
      await dieAtCheckpoint();
      const [retry, mainMenu] = actionButtons();

      expect(tabTo(mainMenu)).toBe(true);
      expect(tabTo(retry)).toBe(true);
      expect(tabTo(mainMenu)).toBe(true);
    });

    // FINDING（中）：没有检查点的任务失败面板和任务完成面板上，只用键盘的玩家哪个动作都够不着。
    // 面板出现时没有任何东西拿到焦点（只有带检查点时才 focus：src/ui/HUD.ts:3199-3203；
    // showMissionComplete 从不 focus：src/ui/HUD.ts:3209-3232），而焦点不在表单控件上时
    // InputHandler 会吃掉 Tab（src/core/Input/InputHandler.ts:271-274，Tab 是切换特殊武器的键），
    // 于是焦点永远进不了面板，Enter / Space 也就无从触发。
    it.fails(
      'without a checkpoint: Tab reaches Play Again and Main Menu, Enter activates them',
      async () => {
        const run = await startRun();
        run.die();
        const [playAgain, mainMenu] = actionButtons();
        letThePanelSettle();

        expect(tabTo(playAgain), 'Tab reaches Play Again').toBe(true);
        pressActivationKey('Enter');
        expect(host.onRetry).toHaveBeenCalledTimes(1);

        expect(tabTo(mainMenu), 'Tab reaches Main Menu').toBe(true);
        pressActivationKey('Enter');
        expect(host.onExitToMenu).toHaveBeenCalledTimes(1);
      }
    );

    it.fails(
      'mission complete: Tab reaches Play Again and Main Menu, Enter activates them',
      async () => {
        const run = await startRun({ startLevel: 10 });
        run.destroyBoss(10);
        const [playAgain, mainMenu] = actionButtons();
        letThePanelSettle();

        expect(tabTo(playAgain), 'Tab reaches Play Again').toBe(true);
        pressActivationKey('Enter');
        expect(host.onRetry).toHaveBeenCalledTimes(1);

        expect(tabTo(mainMenu), 'Tab reaches Main Menu').toBe(true);
        pressActivationKey('Enter');
        expect(host.onExitToMenu).toHaveBeenCalledTimes(1);
      }
    );
  });
});
