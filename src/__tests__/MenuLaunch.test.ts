import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCampaignCheckpoint } from '@/core/save/SaveSystem';
import {
  DEFAULT_START_FLOW_SETTINGS,
  loadStartFlowSettings,
  saveStartFlowSettings,
} from '@/core/SessionSettings';
import { StartMenu, type GameSettings } from '@/ui/StartMenu';
import { resetLocale } from './i18nTestUtils';
import {
  byId,
  click,
  isShown,
  pendingTimers,
  prepareMenuEnvironment,
  press,
  rawSave,
  resetMenuEnvironment,
  seedCheckpoint,
  stubMatchMedia,
  useMenuFakeTimers,
  userClick,
} from './menuTestUtils';

/**
 * 批次 X5 · 规格 3：开始 / 继续的回调与 whenLaunched()。
 *
 * setOnStart(cb) 拿到当前的 GameSettings；setOnContinue(cb) 拿到检查点。
 * whenLaunched() 在“进入战场”过场播完后兑现（正常约 340 毫秒；减少动态效果时立即），
 * 并且无论如何都要兑现：过场中途菜单被 hide() / dispose()、或者根本没有过场在播。
 * 连点两下不能开两局。
 */

/** 过场“约 340 毫秒”：这之前一定还没播完 */
const WELL_BEFORE_LAUNCH_ENDS_MS = 120;
/** 这之后一定已经播完 */
const WELL_AFTER_LAUNCH_ENDS_MS = 1500;

interface Tracked {
  settled: () => boolean;
}

/** 记录一个 Promise 是否已经兑现（只靠微任务，不推进时钟） */
function track(promise: Promise<void>): Tracked {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  return { settled: () => done };
}

/** 跑完已经排队的微任务，不推进假时钟 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('start / continue callbacks and whenLaunched() (batch X5, spec 3)', () => {
  let menu: StartMenu | null = null;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  beforeEach(() => {
    prepareMenuEnvironment();
    useMenuFakeTimers();
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    resetLocale();
    resetMenuEnvironment();
  });

  describe('setOnStart', () => {
    it('receives the default GameSettings on a first visit', () => {
      const startMenu = createMenu();
      const started: GameSettings[] = [];
      startMenu.setOnStart((settings) => started.push({ ...settings }));

      click('start-btn');

      expect(started).toEqual([{ ...DEFAULT_START_FLOW_SETTINGS }]);
    });

    it('receives every stored setting', () => {
      const stored: GameSettings = {
        difficulty: 2,
        sfxVolume: 0.4,
        musicVolume: 0.9,
        voiceVolume: 0.1,
        qualityPreset: 'performance',
        tutorialEnabled: false,
        playerLives: 9,
        startLevel: 10,
        gameMode: 'boss',
        testScore: 15000,
        cameraMode: 'first-person',
        language: 'zh-CN',
      };
      saveStartFlowSettings(stored);
      const startMenu = createMenu();
      const started: GameSettings[] = [];
      startMenu.setOnStart((settings) => started.push({ ...settings }));

      click('start-btn');

      expect(started).toEqual([stored]);
    });

    it('is called synchronously inside the click, while the user gesture is still active', () => {
      const startMenu = createMenu();
      const order: string[] = [];
      startMenu.setOnStart(() => order.push('onStart'));

      click('start-btn');
      order.push('after click');

      expect(order).toEqual(['onStart', 'after click']);
    });

    it('uses the callback registered last', () => {
      const startMenu = createMenu();
      const first = vi.fn();
      const second = vi.fn();
      startMenu.setOnStart(first);
      startMenu.setOnStart(second);

      click('start-btn');

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('starting with no callback registered does not throw', () => {
      createMenu();
      expect(() => click('start-btn')).not.toThrow();
      expect(() => vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS)).not.toThrow();
    });

    it('does not rewrite the stored settings as a side effect of starting', () => {
      saveStartFlowSettings({ difficulty: 4, startLevel: 6 });
      const before = loadStartFlowSettings();
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);

      click('start-btn');
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(loadStartFlowSettings()).toEqual(before);
    });
  });

  describe('setOnContinue', () => {
    it('receives the validated checkpoint, and onStart is not called', () => {
      const raw = seedCheckpoint();
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);

      click('continue-btn');

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onContinue).toHaveBeenCalledWith(loadCampaignCheckpoint());
      expect(onContinue.mock.calls[0][0]).toMatchObject({
        version: 1,
        checkpoint: 'wave',
        level: 6,
        wave: 2,
        difficulty: 4,
        score: 15_200,
        lives: 2,
        cameraMode: 'first-person',
      });
      expect(onStart).not.toHaveBeenCalled();
      expect(rawSave(), 'continuing reads the save, it does not rewrite it').toBe(raw);
    });

    it('receives the checkpoint as stored at the moment of the click', () => {
      seedCheckpoint({ level: 2, wave: 0 });
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);

      seedCheckpoint({ level: 7, wave: 3 });
      click('continue-btn');

      expect(onContinue.mock.calls[0][0]).toMatchObject({ level: 7, wave: 3 });
    });

    it('hands over a clamped checkpoint when the stored one is out of range', () => {
      window.localStorage.setItem(
        'air-supreme:campaign-save',
        JSON.stringify({ version: 1, level: 400, wave: 99, difficulty: 0, lives: 1000 })
      );
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);

      click('continue-btn');

      const save = onContinue.mock.calls[0][0] as { level: number; difficulty: number };
      expect(save.level).toBe(10);
      expect(save.difficulty).toBe(1);
    });

    it('continues in boss mode too: the checkpoint is a campaign save either way', () => {
      seedCheckpoint();
      saveStartFlowSettings({ gameMode: 'boss' });
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);

      click('continue-btn');

      expect(onContinue).toHaveBeenCalledTimes(1);
    });
  });

  describe('whenLaunched()', () => {
    it('resolves when called with no launch in progress', async () => {
      const startMenu = createMenu();
      const launched = track(startMenu.whenLaunched());
      await flushMicrotasks();
      expect(launched.settled()).toBe(true);
    });

    it('stays pending through the transition and resolves once it has finished', async () => {
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnStart(() => {
        launched = track(startMenu.whenLaunched());
      });

      click('start-btn');
      await flushMicrotasks();
      expect((launched as Tracked | null)?.settled(), 'right after the click').toBe(false);
      expect(isShown(byId('start-menu')), 'the menu plays its exit').toBe(true);

      await vi.advanceTimersByTimeAsync(WELL_BEFORE_LAUNCH_ENDS_MS);
      expect((launched as Tracked | null)?.settled(), 'part-way through').toBe(false);

      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
      expect((launched as Tracked | null)?.settled(), 'after the transition').toBe(true);
    });

    it('has hidden the menu by the time it resolves', async () => {
      const startMenu = createMenu();
      let visibleAtResolve: boolean | null = null;
      startMenu.setOnStart(() => {
        void startMenu.whenLaunched().then(() => {
          visibleAtResolve = isShown(byId('start-menu'));
        });
      });

      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(visibleAtResolve).toBe(false);
    });

    it('is pending for a caller that asks just after the click, not only inside the callback', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);

      click('start-btn');
      const launched = track(startMenu.whenLaunched());
      await flushMicrotasks();
      expect(launched.settled()).toBe(false);

      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
      expect(launched.settled()).toBe(true);
    });

    it('resolves for Continue Campaign the same way', async () => {
      seedCheckpoint();
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnContinue(() => {
        launched = track(startMenu.whenLaunched());
      });

      click('continue-btn');
      await flushMicrotasks();
      expect((launched as Tracked | null)?.settled()).toBe(false);

      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
      expect((launched as Tracked | null)?.settled()).toBe(true);
      expect(isShown(byId('start-menu'))).toBe(false);
    });

    it('resolves for a run started from the confirmation dialog', async () => {
      seedCheckpoint();
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnStart(() => {
        launched = track(startMenu.whenLaunched());
      });

      click('start-btn');
      click('new-campaign-confirm-btn');
      await flushMicrotasks();
      expect((launched as Tracked | null)?.settled()).toBe(false);

      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
      expect((launched as Tracked | null)?.settled()).toBe(true);
    });

    it('resolves promptly, with no timer, under prefers-reduced-motion', async () => {
      stubMatchMedia({ reducedMotion: true });
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      let visibleInCallback: boolean | null = null;
      startMenu.setOnStart(() => {
        visibleInCallback = isShown(byId('start-menu'));
        launched = track(startMenu.whenLaunched());
      });

      click('start-btn');
      await flushMicrotasks();

      expect((launched as Tracked | null)?.settled()).toBe(true);
      expect(visibleInCallback, 'no exit animation: already hidden').toBe(false);
      expect(isShown(byId('start-menu'))).toBe(false);
    });

    it('resolves when the menu is hidden mid-transition', async () => {
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnStart(() => {
        launched = track(startMenu.whenLaunched());
      });
      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_BEFORE_LAUNCH_ENDS_MS);
      expect((launched as Tracked | null)?.settled()).toBe(false);

      startMenu.hide();
      await flushMicrotasks();

      expect((launched as Tracked | null)?.settled()).toBe(true);
      expect(isShown(byId('start-menu'))).toBe(false);
    });

    it('resolves when the menu is disposed mid-transition', async () => {
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnStart(() => {
        launched = track(startMenu.whenLaunched());
      });
      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_BEFORE_LAUNCH_ENDS_MS);

      startMenu.dispose();
      menu = null;
      await flushMicrotasks();

      expect((launched as Tracked | null)?.settled()).toBe(true);
      expect(document.getElementById('start-menu')).toBeNull();
      expect(pendingTimers(), 'the transition timer is gone').toBe(0);
    });

    it('resolves when the menu is shown again mid-transition', async () => {
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnStart(() => {
        launched = track(startMenu.whenLaunched());
      });
      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_BEFORE_LAUNCH_ENDS_MS);

      startMenu.show();
      await flushMicrotasks();

      expect((launched as Tracked | null)?.settled()).toBe(true);
    });

    it('resolves when hidden in the very same tick as the click', async () => {
      const startMenu = createMenu();
      let launched: Tracked | null = null;
      startMenu.setOnStart(() => {
        launched = track(startMenu.whenLaunched());
        startMenu.hide();
      });

      click('start-btn');
      await flushMicrotasks();

      expect((launched as Tracked | null)?.settled()).toBe(true);
      expect(isShown(byId('start-menu'))).toBe(false);
    });

    it('resolves again on later calls once the launch is over, and after dispose', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);
      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);

      const afterLaunch = track(startMenu.whenLaunched());
      await flushMicrotasks();
      expect(afterLaunch.settled()).toBe(true);

      startMenu.dispose();
      menu = null;
      const afterDispose = track(startMenu.whenLaunched());
      await flushMicrotasks();
      expect(afterDispose.settled()).toBe(true);
    });

    it('never rejects, whatever interrupts the transition', async () => {
      const startMenu = createMenu();
      const failures: unknown[] = [];
      startMenu.setOnStart(() => {
        startMenu.whenLaunched().catch((error: unknown) => failures.push(error));
      });

      click('start-btn');
      startMenu.hide();
      startMenu.show();
      click('start-btn');
      startMenu.dispose();
      menu = null;
      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(failures).toEqual([]);
    });
  });

  describe('a double tap must not start two runs', () => {
    it('two clicks on New Campaign in the same tick start one run', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      const button = byId('start-btn');

      button.click();
      button.click();

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('taps all through the transition start one run', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      click('start-btn');
      for (let elapsed = 0; elapsed < 300; elapsed += 20) {
        vi.advanceTimersByTime(20);
        document.getElementById('start-btn')?.click();
      }

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('two clicks on Continue Campaign start one run', () => {
      seedCheckpoint();
      const startMenu = createMenu();
      const onContinue = vi.fn();
      startMenu.setOnContinue(onContinue);
      const button = byId('continue-btn');

      button.click();
      button.click();

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('Continue then New Campaign in quick succession runs only the first', () => {
      seedCheckpoint();
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);

      byId('continue-btn').click();
      byId('start-btn').click();
      document.getElementById('new-campaign-confirm-btn')?.click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onStart).not.toHaveBeenCalled();
    });

    it('a click followed by Enter starts one run', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      click('start-btn');
      press('Enter', {}, document.body);
      vi.advanceTimersByTime(WELL_BEFORE_LAUNCH_ENDS_MS);
      press('Enter', {}, document.body);

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('opening Settings, How to Play or the Hangar is ignored once a launch has begun', () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);

      click('start-btn');
      byId('settings-btn').click();
      byId('howto-btn').click();
      byId('preview-btn').click();
      vi.advanceTimersByTime(WELL_BEFORE_LAUNCH_ENDS_MS);

      expect(isShown(document.getElementById('settings-sheet'))).toBe(false);
      expect(isShown(document.getElementById('howto-sheet'))).toBe(false);
      expect(document.getElementById('model-preview')).toBeNull();
    });

    it('under reduced motion the menu is gone after the first tap, so a second cannot land', () => {
      stubMatchMedia({ reducedMotion: true });
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      click('start-btn');
      // 第二下落在已经隐藏的菜单上：玩家点不到
      expect(userClick('start-btn')).toBe(false);

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    // 菜单离开屏幕之后，按钮上还可能来激活事件（display:none 之后仍留着焦点的按钮上的 Enter 连发、
    // 脚本、自动化工具）：隐藏的菜单一律不理，不会在第一局上面再开一局。
    // （最初是 FINDING：handleAction 只看 launching / isDisposed；减少动态效果时 launching 从不置位，
    // 紧接着的第二下就开了第二局。已在 src/ui/StartMenu.ts:294 修复。）
    it('a hidden menu does not start another run (reduced motion)', () => {
      stubMatchMedia({ reducedMotion: true });
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      const button = byId('start-btn');

      button.click();
      button.click();

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('a hidden menu does not start another run (after the transition)', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);
      const button = byId('start-btn');

      button.click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);
      expect(isShown(byId('start-menu'))).toBe(false);
      button.click();

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['reduced motion', true],
      ['after the transition', false],
    ])('a hidden menu does not continue the campaign a second time (%s)', (_name, reduced) => {
      stubMatchMedia({ reducedMotion: reduced });
      seedCheckpoint();
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);
      const button = byId('continue-btn');

      button.click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);
      expect(isShown(byId('start-menu'))).toBe(false);
      button.click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onStart).not.toHaveBeenCalled();
    });

    // 确认框里的“开始新战役”按钮同理（src/ui/StartMenu.ts:495）：确认开局之后它还在文档里
    it.each([
      ['reduced motion', true],
      ['after the transition', false],
    ])('after a confirmed start, the confirm button starts nothing more (%s)', (_name, reduced) => {
      stubMatchMedia({ reducedMotion: reduced });
      seedCheckpoint();
      const startMenu = createMenu();
      const onStart = vi.fn();
      const onContinue = vi.fn();
      startMenu.setOnStart(onStart);
      startMenu.setOnContinue(onContinue);

      click('start-btn');
      const confirm = byId('new-campaign-confirm-btn');
      confirm.click();
      expect(onStart).toHaveBeenCalledTimes(1);
      // 紧接着的第二下、过场中途的、过场播完菜单隐藏之后的
      confirm.click();
      vi.advanceTimersByTime(WELL_BEFORE_LAUNCH_ENDS_MS);
      confirm.click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);
      expect(isShown(byId('start-menu'))).toBe(false);
      confirm.click();
      document.getElementById('new-campaign-confirm-btn')?.click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onContinue).not.toHaveBeenCalled();
    });

    it('activations that reach a hidden menu leave nothing open when it comes back', () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      click('start-btn');
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);
      expect(isShown(byId('start-menu'))).toBe(false);
      byId('settings-btn').click();
      byId('howto-btn').click();
      byId('preview-btn').click();
      vi.advanceTimersByTime(WELL_AFTER_LAUNCH_ENDS_MS);

      startMenu.show();

      expect(isShown(document.getElementById('settings-sheet'))).toBe(false);
      expect(isShown(document.getElementById('howto-sheet'))).toBe(false);
      expect(document.getElementById('model-preview')).toBeNull();
      // 标题上的动作照常可用：再开一局
      click('start-btn');
      expect(onStart).toHaveBeenCalledTimes(2);
    });
  });

  describe('starting again after coming back to the menu', () => {
    it('show() after a finished launch offers a fresh start with a fresh whenLaunched()', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn();
      startMenu.setOnStart(onStart);

      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
      startMenu.show();
      expect(isShown(byId('start-menu'))).toBe(true);

      click('start-btn');
      const second = track(startMenu.whenLaunched());
      await flushMicrotasks();
      expect(onStart).toHaveBeenCalledTimes(2);
      expect(second.settled()).toBe(false);

      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
      expect(second.settled()).toBe(true);
      expect(isShown(byId('start-menu'))).toBe(false);
    });

    it('show() during a launch cancels the hide: the menu stays on screen', async () => {
      const startMenu = createMenu();
      startMenu.setOnStart(() => undefined);

      click('start-btn');
      await vi.advanceTimersByTimeAsync(WELL_BEFORE_LAUNCH_ENDS_MS);
      startMenu.show();
      await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);

      expect(isShown(byId('start-menu'))).toBe(true);
    });

    it('a callback that throws does not leave the menu stuck mid-launch', async () => {
      const startMenu = createMenu();
      const onStart = vi.fn().mockImplementationOnce(() => {
        throw new Error('boot failed');
      });
      startMenu.setOnStart(onStart);
      // 点击处理函数里抛出的异常由 jsdom 报给 window 的 error 事件
      const reported = vi.fn((event: ErrorEvent) => event.preventDefault());
      window.addEventListener('error', reported);

      try {
        byId('start-btn').click();
        const launched = track(startMenu.whenLaunched());
        await vi.advanceTimersByTimeAsync(WELL_AFTER_LAUNCH_ENDS_MS);
        expect(launched.settled()).toBe(true);

        startMenu.show();
        click('start-btn');
        expect(onStart).toHaveBeenCalledTimes(2);
      } finally {
        window.removeEventListener('error', reported);
      }
    });
  });
});
