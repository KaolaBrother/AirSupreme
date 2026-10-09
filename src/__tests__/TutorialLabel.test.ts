import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCoordinator } from '@/core/GameCoordinator';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD } from '@/ui/HUD';
import { StartMenu } from '@/ui/StartMenu';
import { resetLocale } from './i18nTestUtils';

/**
 * 打磨批次 Q：教学关在中文界面里叫“教程”——开始菜单的开关与游戏内的教学文案（目标面板标题、
 * 开场提示、完成标题）都用这个词；界面文案里不再有“试玩关卡”（及“试玩引导 / 试玩关”）。
 * 英文文案不变。
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** 旧称：试玩关卡 / 试玩引导 / 试玩关开启 */
const OLD_NAME = /试玩/;

describe('the tutorial is called 教程 in Chinese', () => {
  afterEach(() => {
    resetLocale();
  });

  describe('Start menu toggle', () => {
    let menu: StartMenu;

    beforeEach(() => {
      document.body.innerHTML = '';
      window.localStorage.clear();
      vi.stubGlobal('requestIdleCallback', () => 1);
      menu = new StartMenu();
    });

    afterEach(() => {
      menu.dispose();
      vi.unstubAllGlobals();
      window.localStorage.clear();
      document.body.innerHTML = '';
    });

    const label = (): string =>
      document.querySelector('#tutorial-row .setting-label')?.textContent ?? '';

    it('reads 教程 in Chinese and Tutorial in English', () => {
      expect(label()).toBe('Tutorial');
      setLocale('zh-CN');
      expect(label()).toBe('教程');
      setLocale('en');
      expect(label()).toBe('Tutorial');
    });

    it('no setting row in the Chinese menu says 试玩', () => {
      setLocale('zh-CN');
      const panel = document.querySelector('#start-menu .settings-panel');
      expect(panel?.textContent ?? '').toContain('教程');
      expect(panel?.textContent ?? '').not.toMatch(OLD_NAME);
    });
  });

  describe('in-game tutorial wording', () => {
    type TutorialState = Record<string, unknown>;
    const STEPS = [
      'movementHintShown',
      'speedHintShown',
      'fireHintShown',
      'lockCompleteHintShown',
      'missileHintShown',
    ] as const;

    function coordinatorAt(done: number): Record<string, unknown> {
      const coordinator = Object.create(GameCoordinator.prototype) as Record<string, unknown>;
      const state: TutorialState = { active: true, startPosition: null };
      for (const [index, step] of STEPS.entries()) state[step] = index < done;
      coordinator.tutorialCombatState = state;
      return coordinator;
    }

    function method<T>(name: string): (this: unknown, ...args: unknown[]) => T {
      return (GameCoordinator.prototype as unknown as Record<string, unknown>)[name] as (
        this: unknown,
        ...args: unknown[]
      ) => T;
    }

    it('every objective-panel title is 教程 · … in Chinese, Training · … in English', () => {
      const getDisplay = method<{ title: string }>('getTutorialObjectiveDisplay');
      const titles = { en: [] as string[], zh: [] as string[] };
      for (let done = 0; done <= STEPS.length; done++) {
        const coordinator = coordinatorAt(done);
        setLocale('zh-CN');
        titles.zh.push(getDisplay.call(coordinator).title);
        setLocale('en');
        titles.en.push(getDisplay.call(coordinator).title);
      }
      expect(new Set(titles.zh).size, 'one title per step').toBe(6);
      for (const title of titles.zh) {
        expect(title.startsWith('教程 · '), title).toBe(true);
        expect(title).not.toMatch(OLD_NAME);
      }
      for (const title of titles.en) expect(title.startsWith('Training · '), title).toBe(true);
    });

    it('the opening callout says 教程开始 and relabels while it is up', () => {
      document.body.innerHTML = '';
      const hud = new HUD();
      hud.init();
      try {
        const scheduled: Array<{ run: () => void; delay: number }> = [];
        const coordinator = coordinatorAt(0);
        coordinator.hud = hud;
        coordinator.scheduleTimeout = (run: () => void, delay: number) =>
          scheduled.push({ run, delay });
        method<void>('startTutorialIntroSequence').call(coordinator);
        expect(scheduled.length).toBeGreaterThan(1);

        scheduled.sort((a, b) => a.delay - b.delay)[0].run();
        const callout = (): string => document.getElementById('hud-callout')?.textContent ?? '';
        expect(callout()).toContain('Training flight begins');
        setLocale('zh-CN');
        expect(callout()).toContain('教程开始');

        // 其余开场提示也不再用旧称
        for (const { run } of scheduled) {
          run();
          expect(callout()).not.toMatch(OLD_NAME);
        }
      } finally {
        hud.dispose();
        document.body.innerHTML = '';
      }
    });

    it('the completion title is 教程 · 完成', () => {
      const coordinator = coordinatorAt(STEPS.length);
      const shown: Array<{ title: { text: LocalizedText } }> = [];
      coordinator.hud = { showPowerUpBig: vi.fn() };
      coordinator.showTransientObjective = (objective: { title: { text: LocalizedText } }) =>
        shown.push(objective);
      method<void>('handleTutorialEnemyDeath').call(coordinator);
      expect(shown).toHaveLength(1);
      expect(shown[0].title.text).toEqual({ en: 'Training · Complete', zh: '教程 · 完成' });
    });
  });

  it('no shipped UI string still says 试玩 (试玩关卡 / 试玩引导 / 试玩关)', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (!statSync(full).isFile()) {
          if (name !== '__tests__') walk(full);
        } else if (/\.(ts|json|html)$/.test(name) && !/\.test\.ts$/.test(name)) {
          files.push(full);
        }
      }
    };
    walk(path.join(PROJECT_ROOT, 'src'));
    walk(path.join(PROJECT_ROOT, 'public'));
    files.push(path.join(PROJECT_ROOT, 'index.html'));
    expect(files.some((file) => file.endsWith(`${path.sep}StartMenu.ts`))).toBe(true);

    const offenders = files
      .filter((file) => OLD_NAME.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(PROJECT_ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});
