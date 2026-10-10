import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi, type Mock } from 'vitest';
import type { CampaignExitSave } from '@/core/campaign/CampaignFlowController';
import {
  describeCheckpoint,
  loadCampaignCheckpoint,
  saveCampaignCheckpoint,
  type CampaignSaveData,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
import { DEFAULT_START_FLOW_SETTINGS, type StartFlowSettings } from '@/core/SessionSettings';
import { setLocale, type Locale, type LocalizedText } from '@/i18n';
import { PauseMenu, type IPauseMenuOptions } from '@/ui/PauseMenu';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * 暂停菜单的“保存并退出”，按规格 S5-S9：
 * - S5 getSaveStatus / onSaveAndExit 成对提供才启用存档；
 * - S6 默认页的退出按钮只在“真的会存”时叫“保存并退出”；
 * - S7 确认页如实说明：存到哪里、“继续战役”会怎样，或者为什么不存；
 * - S8 存档失败不自行退出：失败页（返回 / 仍然退出）；
 * - S9 键盘与焦点：回车 / 空格只走按钮原生行为，左右方向键在两个按钮间移动焦点，ESC 回默认页，
 *   按钮不低于 44px，切换语言原地重绘并保持焦点，dispose 后不留任何东西。
 * 文案只匹配关键短语（两种语言），整句微调不必改测试；规格没有给出中文措辞的按钮按位置找。
 * 游戏侧的两个回调用替身；控制器的真实存档见 CampaignExitSave.test.ts。
 */

type UnsavedKind = 'no-save-mode' | 'not-started' | 'complete';

const STAGES: readonly CheckpointKind[] = ['level-start', 'wave', 'boss', 'hangar'];
const UNSAVED_KINDS: readonly UnsavedKind[] = ['no-save-mode', 'not-started', 'complete'];

/** 各类检查点的存档点描述（describeCheckpoint 的样子） */
const POSITIONS: Readonly<Record<CheckpointKind, LocalizedText>> = {
  'level-start': { en: 'Ch. 2 · Sandstorm · Wave 1', zh: '第2关 · 沙漠风暴 · 第1波' },
  wave: { en: 'Ch. 3 · Snowbound Summit · Wave 4', zh: '第3关 · 雪山之巅 · 第4波' },
  boss: { en: 'Ch. 6 · Heart of the Forge · Boss', zh: '第6关 · 熔炉之心 · Boss 战' },
  hangar: { en: 'Ch. 7 · Aurora Sea · Hangar', zh: '第7关 · 极光冰海 · 机库整备' },
};

function saved(stage: CheckpointKind = 'wave'): CampaignExitSave {
  return { kind: 'saved', stage, position: POSITIONS[stage] };
}

/** 规格给出的按钮文案；“取消 / 继续”沿用 PauseMenu.test.ts 里已有的中文 */
const LABELS = {
  resume: { en: 'Resume', zh: '继续' },
  settings: { en: 'Settings', zh: '设置' },
  saveAndExit: { en: 'Save & Exit', zh: '保存并退出' },
  mainMenu: { en: 'Main Menu', zh: '返回菜单' },
  cancel: { en: 'Cancel', zh: '取消' },
} satisfies Record<string, LocalizedText>;

/** 规格只给了英文的按钮：中文下按位置找，只要求不是英文、也不是旧的“确定” */
const EXIT_EN = 'Exit';
const BACK_EN = 'Back';
const EXIT_ANYWAY_EN = 'Exit Anyway';
const SAVE_FAILED_TITLE_EN = 'Save Failed';

interface Phrases {
  en: readonly RegExp[];
  zh: readonly RegExp[];
}

/** “继续战役”会怎样（去掉存档点描述之后匹配，免得被描述里的 Boss / Hangar 蒙混过去） */
const CONTINUE_PHRASES: Readonly<Record<CheckpointKind, Phrases>> = {
  'level-start': { en: [/wave/i, /from the beginning/i], zh: [/波/] },
  wave: { en: [/wave/i, /from the beginning/i], zh: [/波/] },
  boss: { en: [/boss fight/i], zh: [/Boss/] },
  hangar: { en: [/hangar/i], zh: [/机库/] },
};
/** 另外两类“继续”说法里才有的词，不该出现在这一类里（规格只给了英文措辞，中文不做反向限制） */
const CONTINUE_FOREIGN: Readonly<Record<CheckpointKind, Phrases>> = {
  'level-start': { en: [/boss fight/i, /hangar/i], zh: [] },
  wave: { en: [/boss fight/i, /hangar/i], zh: [] },
  boss: { en: [/hangar/i, /that wave/i], zh: [] },
  hangar: { en: [/boss fight/i, /that wave/i], zh: [] },
};
const KEPT_PHRASES: Phrases = {
  en: [/Continue/, /score/i, /lives/i, /upgrades/i],
  zh: [/继续/, /分数/, /生命/, /升级/],
};
/** 规格给出的英文句式 “Saves at <position>.”；中文只要求说出存档点本身 */
const SAVES_AT_EN = /Saves at/;

const UNSAVED_PHRASES: Readonly<Record<UnsavedKind, Phrases>> = {
  'no-save-mode': {
    en: [/this mode does not save/i, /main menu/i],
    zh: [/模式/, /不.{0,2}保存/],
  },
  'not-started': { en: [/nothing to save/i], zh: [/保存/, /尚未|还没|暂无|没有/] },
  complete: { en: [/campaign is complete/i, /no checkpoint/i], zh: [/通关|完成/, /检查点/] },
};
const NOT_WIRED_PHRASES: Phrases = { en: [/does not save/i], zh: [/不.{0,2}保存/] };
const STORED_LINE: Phrases = {
  en: [/Continue Campaign/, /resumes from the last checkpoint/i],
  zh: [/继续战役/, /检查点/],
};
const NO_STORED_LINE: Phrases = {
  en: [/no campaign checkpoint is stored/i],
  zh: [/没有.{0,8}检查点/],
};
const SAVE_FAILED_PHRASES: Phrases = {
  en: [/Save Failed/, /could not/i],
  zh: [/保存失败/],
};

/** 旧文案：进度将丢失 + “确定”按钮 */
const OLD_COPY: readonly RegExp[] = [/progress will be lost/i, /进度将丢失/];
const OLD_BUTTONS: readonly string[] = ['Confirm', '确定'];

const STORED_CHECKPOINT: Omit<CampaignSaveData, 'version' | 'savedAt'> = {
  checkpoint: 'wave',
  level: 6,
  wave: 2,
  difficulty: 3,
  score: 15_200,
  lives: 2,
  missiles: 4,
  upgrades: {},
  weapons: { unlocked: [], selected: null, ammo: {} },
  flares: 2,
  cameraMode: 'third-person',
  stats: { kills: 50, civiliansLost: 0, deaths: 1, playTimeSeconds: 900 },
};

// ───────────────────────────── DOM ─────────────────────────────

function panel(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#pause-menu .pause-panel');
  expect(element, 'the pause panel').not.toBeNull();
  return element as HTMLElement;
}

function buttons(): HTMLButtonElement[] {
  return Array.from(panel().querySelectorAll<HTMLButtonElement>('button'));
}

function labelOf(button: Element | null): string {
  return (button?.textContent ?? '').trim();
}

function labels(): string[] {
  return buttons().map(labelOf);
}

function button(label: string): HTMLButtonElement {
  const match = buttons().find((candidate) => labelOf(candidate) === label);
  expect(match, `a "${label}" button among: ${labels().join(' / ')}`).toBeTruthy();
  return match as HTMLButtonElement;
}

/** 确认页 / 失败页的一排两个按钮：[左，右] */
function pair(): [HTMLButtonElement, HTMLButtonElement] {
  const all = buttons();
  expect(labels(), 'a two-button view').toHaveLength(2);
  // 位置：左边的在文档里排在前面，两个按钮在同一排
  expect(all[0].parentElement).toBe(all[1].parentElement);
  expect(
    all[0].compareDocumentPosition(all[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    'left button precedes the right one'
  ).toBeTruthy();
  return [all[0], all[1]];
}

/** 面板上除按钮之外的文字（标题 + 说明） */
function copy(): string {
  const clone = panel().cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button').forEach((element) => element.remove());
  return clone.textContent ?? '';
}

function expectPhrases(text: string, phrases: Phrases, locale: Locale, where: string): void {
  for (const phrase of locale === 'zh-CN' ? phrases.zh : phrases.en) {
    expect(text, `${where} (${locale})`).toMatch(phrase);
  }
}

function expectNoPhrases(text: string, phrases: Phrases, locale: Locale, where: string): void {
  for (const phrase of locale === 'zh-CN' ? phrases.zh : phrases.en) {
    expect(text, `${where} (${locale})`).not.toMatch(phrase);
  }
}

function expectNoOldCopy(where: string): void {
  const text = panel().textContent ?? '';
  for (const old of OLD_COPY) {
    expect(text, where).not.toMatch(old);
  }
  for (const old of OLD_BUTTONS) {
    expect(labels(), where).not.toContain(old);
  }
}

/** 中文界面下的按钮：有汉字、没有残留的英文单词 */
function expectChineseLabel(label: string, where: string): void {
  expect(label, where).toMatch(/[一-鿿]/);
  expect(label, where).not.toMatch(/[A-Za-z]{3,}/);
}

function isDefaultView(): boolean {
  const current = labels();
  return (
    current.length === 4 &&
    (current.includes(LABELS.resume.en) || current.includes(LABELS.resume.zh))
  );
}

function expectDefaultView(where = 'back on the default view'): void {
  expect(isDefaultView(), `${where}; buttons: ${labels().join(' / ')}`).toBe(true);
}

/** 默认页上的退出按钮（“保存并退出”或“返回菜单”，恰好一个） */
function exitButton(): HTMLButtonElement {
  expectDefaultView('the exit button lives on the default view');
  const candidates = buttons().filter((candidate) =>
    [LABELS.saveAndExit.en, LABELS.saveAndExit.zh, LABELS.mainMenu.en, LABELS.mainMenu.zh].includes(
      labelOf(candidate)
    )
  );
  expect(candidates, 'exactly one exit button').toHaveLength(1);
  return candidates[0];
}

function press(
  target: EventTarget,
  key: string,
  type: 'keydown' | 'keyup' = 'keydown'
): KeyboardEvent {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function parsePx(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : 0;
}

/** 组件给按钮设定的高度下限（jsdom 没有布局，只能看样式） */
function declaredHeight(element: HTMLButtonElement): number {
  const computed = getComputedStyle(element);
  return Math.max(
    parsePx(element.style.minHeight),
    parsePx(element.style.height),
    parsePx(computed.minHeight),
    parsePx(computed.height)
  );
}

function storageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key !== null) {
      snapshot[key] = window.localStorage.getItem(key) ?? '';
    }
  }
  return snapshot;
}

// ───────────────────────────── 菜单 ─────────────────────────────

interface Bench {
  onContinue: Mock<() => void>;
  onUpgrade: Mock<() => void>;
  onExitToMenu: Mock<() => void>;
  getSaveStatus: Mock<() => CampaignExitSave>;
  onSaveAndExit: Mock<() => CampaignExitSave>;
  applyAudio: Mock<(sfx: number, music: number) => void>;
  /** getSaveStatus 此刻的回答（可随时改） */
  status: CampaignExitSave;
  /** onSaveAndExit 此刻的回答（可随时改） */
  result: CampaignExitSave;
  menu: PauseMenu | null;
  /** 没接“保存并退出”的菜单（可只接其中一个回调） */
  create(extra?: Partial<IPauseMenuOptions>): PauseMenu;
  /** 两个回调都接上的菜单 */
  createWired(status: CampaignExitSave, result?: CampaignExitSave): PauseMenu;
  /** 接好、显示并打开确认页 */
  openConfirm(status: CampaignExitSave, result?: CampaignExitSave): PauseMenu;
  /** 接好、显示、确认页点“保存并退出”，存档失败 */
  openSaveFailed(): PauseMenu;
  dispose(): void;
}

function createBench(language: Locale = 'en'): Bench {
  let stored: StartFlowSettings = {
    ...DEFAULT_START_FLOW_SETTINGS,
    language,
  };
  const bench: Bench = {
    onContinue: vi.fn<() => void>(),
    onUpgrade: vi.fn<() => void>(),
    onExitToMenu: vi.fn<() => void>(),
    getSaveStatus: vi.fn<() => CampaignExitSave>(() => bench.status),
    onSaveAndExit: vi.fn<() => CampaignExitSave>(() => bench.result),
    applyAudio: vi.fn<(sfx: number, music: number) => void>(),
    status: { kind: 'not-started' },
    result: { kind: 'not-started' },
    menu: null,
    create: (extra = {}) => {
      bench.menu = new PauseMenu({
        onContinue: bench.onContinue,
        onUpgrade: bench.onUpgrade,
        onExitToMenu: bench.onExitToMenu,
        applyAudio: bench.applyAudio,
        applyQuality: () => undefined,
        loadSettings: () => ({ ...stored }),
        saveSettings: (partial) => {
          stored = { ...stored, ...partial };
        },
        ...extra,
      });
      return bench.menu;
    },
    createWired: (status, result = status) => {
      bench.status = status;
      bench.result = result;
      return bench.create({
        getSaveStatus: bench.getSaveStatus,
        onSaveAndExit: bench.onSaveAndExit,
      });
    },
    openConfirm: (status, result = status) => {
      const menu = bench.createWired(status, result);
      menu.show();
      exitButton().click();
      return menu;
    },
    openSaveFailed: () => {
      const menu = bench.openConfirm(saved(), { kind: 'failed' });
      pair()[1].click();
      return menu;
    },
    dispose: () => {
      bench.menu?.dispose();
      bench.menu = null;
    },
  };
  return bench;
}

// ───────────────────────────── 文案（两种语言） ─────────────────────────────

describe.each(LOCALES)('PauseMenu Save & Exit copy (%s)', (locale: Locale) => {
  const other: Locale = locale === 'en' ? 'zh-CN' : 'en';
  let bench: Bench;

  const label = (key: keyof typeof LABELS, language: Locale = locale): string =>
    textIn(LABELS[key], language);

  /** 规格只给英文的按钮：英文下要求原文，中文下要求是中文 */
  function expectLabel(element: HTMLButtonElement, english: string, language: Locale): void {
    if (language === 'en') {
      expect(labelOf(element)).toBe(english);
    } else {
      expectChineseLabel(labelOf(element), `the "${english}" button in Chinese`);
      expect(OLD_BUTTONS).not.toContain(labelOf(element));
    }
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    setLocale(locale);
    bench = createBench(locale);
  });

  afterEach(() => {
    bench.dispose();
    vi.restoreAllMocks();
    resetLocale();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('S6: the exit button on the default view', () => {
    it.each(STAGES)('reads "Save & Exit" when leaving saves a %s checkpoint', (stage) => {
      bench.createWired(saved(stage)).show();

      expect(labelOf(exitButton())).toBe(label('saveAndExit'));
      expect(labels()).not.toContain(label('mainMenu'));
    });

    it.each<CampaignExitSave['kind']>([...UNSAVED_KINDS, 'failed'])(
      'reads "Main Menu" and shows no save label when the status is %s',
      (kind) => {
        bench.createWired({ kind } as CampaignExitSave).show();

        expect(labelOf(exitButton())).toBe(label('mainMenu'));
        expect(panel().textContent).not.toContain(label('saveAndExit'));
      }
    );

    it('reads "Main Menu" when saving is not wired', () => {
      bench.create().show();

      expect(labelOf(exitButton())).toBe(label('mainMenu'));
      expect(panel().textContent).not.toContain(label('saveAndExit'));
    });

    it('is relabelled in place when the language changes', () => {
      bench.createWired(saved()).show();
      setLocale(other);
      expect(labelOf(exitButton())).toBe(label('saveAndExit', other));

      bench.status = { kind: 'no-save-mode' };
      setLocale(locale);
      expect(labelOf(exitButton())).toBe(label('mainMenu'));
    });
  });

  describe('S7: the confirm view tells the truth', () => {
    it.each(STAGES)(
      'a %s save: names the save point and says what Continue Campaign does',
      (stage) => {
        bench.openConfirm(saved(stage));
        const position = textIn(POSITIONS[stage], locale);
        const text = copy();

        expect(text).toContain(position);
        if (locale === 'en') {
          expect(text).toContain(`Saves at ${position}`);
        }
        const rest = text.replace(position, '');
        expectPhrases(rest, CONTINUE_PHRASES[stage], locale, `what Continue does for ${stage}`);
        expectNoPhrases(rest, CONTINUE_FOREIGN[stage], locale, `only the ${stage} outcome`);
        expectPhrases(rest, KEPT_PHRASES, locale, 'what is kept');
        expect(text, 'in one language only').not.toContain(textIn(POSITIONS[stage], other));

        const [cancel, primary] = pair();
        expect(labelOf(cancel)).toBe(label('cancel'));
        expect(labelOf(primary)).toBe(label('saveAndExit'));
        expectNoOldCopy(`confirm view for a ${stage} save`);
      }
    );

    it.each(UNSAVED_KINDS)('%s: says why nothing is saved and offers Cancel / Exit', (kind) => {
      bench.openConfirm({ kind });
      const text = copy();

      expectPhrases(text, UNSAVED_PHRASES[kind], locale, `the ${kind} explanation`);
      expect(text, 'promises no save').not.toMatch(SAVES_AT_EN);
      expect(panel().textContent, 'no save label').not.toContain(label('saveAndExit'));

      const [cancel, exit] = pair();
      expect(labelOf(cancel)).toBe(label('cancel'));
      expectLabel(exit, EXIT_EN, locale);
      expectNoOldCopy(`confirm view for ${kind}`);
    });

    it('gives each no-save reason its own explanation', () => {
      const texts = UNSAVED_KINDS.map((kind) => {
        bench.dispose();
        document.body.innerHTML = '';
        bench = createBench(locale);
        bench.openConfirm({ kind });
        return copy();
      });

      expect(new Set(texts).size, 'three different explanations').toBe(UNSAVED_KINDS.length);
      if (locale === 'en') {
        // 英文的专属短语互不串用（中文各句共用“保存”等词，由上面的互不相同保证）
        UNSAVED_KINDS.forEach((kind, index) => {
          for (const otherKind of UNSAVED_KINDS.filter((candidate) => candidate !== kind)) {
            expect(texts[index], `${kind} copy vs ${otherKind}`).not.toMatch(
              UNSAVED_PHRASES[otherKind].en[0]
            );
          }
        });
      }
    });

    it('not wired, with a stored checkpoint: says exiting does not save and where Continue resumes', () => {
      saveCampaignCheckpoint(STORED_CHECKPOINT);
      const stored = loadCampaignCheckpoint() as CampaignSaveData;
      bench.create().show();
      exitButton().click();
      const text = copy();

      expectPhrases(text, NOT_WIRED_PHRASES, locale, 'exiting does not save');
      expectPhrases(text, STORED_LINE, locale, 'the stored-checkpoint line');
      expect(text).toContain(describeCheckpoint(stored, locale));
      expect(text).not.toContain(describeCheckpoint(stored, other));
      expectNoPhrases(text, NO_STORED_LINE, locale, 'a checkpoint is stored');
      expect(panel().textContent, 'no save label').not.toContain(label('saveAndExit'));

      const [cancel, exit] = pair();
      expect(labelOf(cancel)).toBe(label('cancel'));
      expectLabel(exit, EXIT_EN, locale);
      expectNoOldCopy('confirm view, not wired');
    });

    it('not wired, with nothing stored: says no campaign checkpoint is stored', () => {
      bench.create().show();
      exitButton().click();
      const text = copy();

      expectPhrases(text, NOT_WIRED_PHRASES, locale, 'exiting does not save');
      expectPhrases(text, NO_STORED_LINE, locale, 'no checkpoint line');
      if (locale === 'en') {
        expect(text).not.toMatch(/resumes from the last checkpoint/i);
      }
      expectNoOldCopy('confirm view, not wired, nothing stored');
    });

    it('the old "progress will be lost" copy and Confirm button are gone from the default view too', () => {
      bench.create().show();
      expectNoOldCopy('default view');
    });
  });

  describe('S8: the Save Failed view', () => {
    it('says the save was not written, shows the stored checkpoint, offers Back / Exit Anyway', () => {
      saveCampaignCheckpoint(STORED_CHECKPOINT);
      const stored = loadCampaignCheckpoint() as CampaignSaveData;
      bench.openSaveFailed();
      const text = copy();

      expectPhrases(text, SAVE_FAILED_PHRASES, locale, 'the failure');
      expectPhrases(text, STORED_LINE, locale, 'the stored-checkpoint line');
      expect(text).toContain(describeCheckpoint(stored, locale));
      expect(text, 'no "saves at" promise on the failure view').not.toMatch(SAVES_AT_EN);

      const [back, exitAnyway] = pair();
      expectLabel(back, BACK_EN, locale);
      expectLabel(exitAnyway, EXIT_ANYWAY_EN, locale);
      expect(labelOf(back)).not.toBe(labelOf(exitAnyway));
      expectNoOldCopy('save failed view');
    });

    it('says no campaign checkpoint is stored when there is none', () => {
      bench.openSaveFailed();
      const text = copy();

      expectPhrases(text, SAVE_FAILED_PHRASES, locale, 'the failure');
      expectPhrases(text, NO_STORED_LINE, locale, 'no checkpoint line');
    });

    it('a failed preview shows the same view', () => {
      bench.createWired({ kind: 'failed' }).show();
      exitButton().click();

      expectPhrases(copy(), SAVE_FAILED_PHRASES, locale, 'the failure');
      const [back, exitAnyway] = pair();
      expectLabel(back, BACK_EN, locale);
      expectLabel(exitAnyway, EXIT_ANYWAY_EN, locale);
    });
  });

  describe('S9: switching language while a view is open', () => {
    it('redraws the saved confirm view in the new language and keeps focus on Save & Exit', () => {
      bench.openConfirm(saved('boss'));
      expect(document.activeElement).toBe(pair()[1]);
      const savesBefore = bench.onSaveAndExit.mock.calls.length;

      setLocale(other);

      const [cancel, primary] = pair();
      expect(labelOf(cancel)).toBe(label('cancel', other));
      expect(labelOf(primary)).toBe(label('saveAndExit', other));
      const text = copy();
      expect(text).toContain(textIn(POSITIONS.boss, other));
      expect(text).not.toContain(textIn(POSITIONS.boss, locale));
      expectPhrases(
        text.replace(textIn(POSITIONS.boss, other), ''),
        CONTINUE_PHRASES.boss,
        other,
        'continue copy'
      );
      expect(document.activeElement, 'focus stays on Save & Exit').toBe(primary);
      expect(bench.onSaveAndExit.mock.calls.length, 'redrawing saves nothing').toBe(savesBefore);
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });

    it.each(UNSAVED_KINDS)('redraws the %s confirm view and keeps focus on Cancel', (kind) => {
      bench.openConfirm({ kind });
      expect(document.activeElement).toBe(pair()[0]);

      setLocale(other);

      const [cancel, exit] = pair();
      expect(labelOf(cancel)).toBe(label('cancel', other));
      expectLabel(exit, EXIT_EN, other);
      expectPhrases(copy(), UNSAVED_PHRASES[kind], other, `the ${kind} explanation`);
      expect(document.activeElement, 'focus stays on Cancel').toBe(cancel);
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });

    it('redraws the not-wired confirm view and keeps focus on Cancel', () => {
      saveCampaignCheckpoint(STORED_CHECKPOINT);
      const stored = loadCampaignCheckpoint() as CampaignSaveData;
      bench.create().show();
      exitButton().click();

      setLocale(other);

      const [cancel] = pair();
      expect(labelOf(cancel)).toBe(label('cancel', other));
      expect(copy()).toContain(describeCheckpoint(stored, other));
      expectPhrases(copy(), NOT_WIRED_PHRASES, other, 'exiting does not save');
      expect(document.activeElement).toBe(cancel);
    });

    it('redraws the Save Failed view in the new language, keeps focus on Back and saves nothing again', () => {
      bench.openSaveFailed();
      expect(document.activeElement).toBe(pair()[0]);
      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);

      setLocale(other);

      const [back, exitAnyway] = pair();
      expectLabel(back, BACK_EN, other);
      expectLabel(exitAnyway, EXIT_ANYWAY_EN, other);
      expectPhrases(copy(), SAVE_FAILED_PHRASES, other, 'still the failure view');
      expect(document.activeElement, 'focus stays on Back').toBe(back);
      expect(bench.onSaveAndExit, 'no second save attempt').toHaveBeenCalledTimes(1);
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });
  });
});

// ───────────────────────────── 行为（与语言无关，英文界面） ─────────────────────────────

describe('PauseMenu Save & Exit behaviour', () => {
  let bench: Bench;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    resetLocale();
    bench = createBench();
  });

  afterEach(() => {
    bench.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetLocale();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('S5: saving needs both callbacks', () => {
    it('both callbacks are optional and return the exit-save result', () => {
      // 类型层面的约定，由 tsc --noEmit 检查
      expectTypeOf<IPauseMenuOptions['getSaveStatus']>().toEqualTypeOf<
        (() => CampaignExitSave) | undefined
      >();
      expectTypeOf<IPauseMenuOptions['onSaveAndExit']>().toEqualTypeOf<
        (() => CampaignExitSave) | undefined
      >();
      expectTypeOf<IPauseMenuOptions['onExitToMenu']>().toEqualTypeOf<() => void>();
      expectTypeOf<IPauseMenuOptions['onContinue']>().toEqualTypeOf<() => void>();
      expectTypeOf<IPauseMenuOptions['onUpgrade']>().toEqualTypeOf<() => void>();
      const kinds: CampaignExitSave['kind'][] = [
        'saved',
        'no-save-mode',
        'not-started',
        'complete',
        'failed',
      ];
      expectTypeOf<CampaignExitSave['kind']>().toEqualTypeOf<(typeof kinds)[number]>();
      expect(kinds).toHaveLength(5);
    });

    it('with both, the menu saves on the way out', () => {
      bench.openConfirm(saved());
      button('Save & Exit').click();

      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
    });

    it('with neither, it is a plain exit that says it does not save', () => {
      bench.create().show();
      expect(labelOf(exitButton())).toBe('Main Menu');
      exitButton().click();

      expect(copy()).toMatch(/does not save/i);
      expect(labels()).toEqual(['Cancel', 'Exit']);
      button('Exit').click();
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
    });

    it('with only getSaveStatus, a "saved" status still does not enable saving', () => {
      bench.status = saved();
      bench.create({ getSaveStatus: bench.getSaveStatus }).show();

      expect(labelOf(exitButton())).toBe('Main Menu');
      exitButton().click();
      expect(copy()).toMatch(/does not save/i);
      expect(copy()).not.toContain('Saves at');
      expect(labels()).toEqual(['Cancel', 'Exit']);
      expect(document.activeElement).toBe(button('Cancel'));
      button('Exit').click();
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
    });

    it('with only onSaveAndExit, nothing is saved and it is never called', () => {
      bench.result = saved();
      bench.create({ onSaveAndExit: bench.onSaveAndExit }).show();

      expect(labelOf(exitButton())).toBe('Main Menu');
      exitButton().click();
      expect(copy()).toMatch(/does not save/i);
      expect(labels()).toEqual(['Cancel', 'Exit']);
      button('Exit').click();

      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
    });
  });

  describe('S6: the exit label follows the status of the moment', () => {
    it('is read again each time the default view is drawn', () => {
      const menu = bench.createWired({ kind: 'not-started' });
      menu.show();
      expect(labelOf(exitButton())).toBe('Main Menu');

      // 下一次暂停时已经到了检查点
      menu.hide();
      bench.status = saved();
      menu.show();
      expect(labelOf(exitButton())).toBe('Save & Exit');

      // 确认页开着的时候状态变了：取消回来按最新的写
      exitButton().click();
      bench.status = { kind: 'complete' };
      button('Cancel').click();
      expect(labelOf(exitButton())).toBe('Main Menu');
    });

    it('showing the menu never saves', () => {
      const menu = bench.createWired(saved());
      menu.show();
      menu.hide();
      menu.show();

      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });
  });

  describe('S7: confirming', () => {
    it('opening the confirm view asks for the status and saves nothing', () => {
      const menu = bench.createWired(saved());
      menu.show();
      const asked = bench.getSaveStatus.mock.calls.length;

      exitButton().click();

      expect(bench.getSaveStatus.mock.calls.length).toBeGreaterThan(asked);
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(labels()).toEqual(['Cancel', 'Save & Exit']);
    });

    it('describes the status of the moment the view is opened', () => {
      const menu = bench.createWired(saved('wave'));
      menu.show();
      // 默认页画出来之后进度推进到了 Boss 战前
      bench.status = saved('boss');

      exitButton().click();

      expect(copy()).toContain(POSITIONS.boss.en);
      expect(copy()).not.toContain(POSITIONS.wave.en);
    });

    it('Save & Exit saves exactly once and then exits exactly once', () => {
      bench.openConfirm(saved());

      button('Save & Exit').click();

      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(bench.onSaveAndExit.mock.invocationCallOrder[0]).toBeLessThan(
        bench.onExitToMenu.mock.invocationCallOrder[0]
      );
    });

    it('Cancel goes back to the default view without saving or exiting', () => {
      bench.openConfirm(saved());

      button('Cancel').click();

      expectDefaultView();
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });

    it.each(UNSAVED_KINDS)('%s: Exit leaves exactly once', (kind) => {
      bench.openConfirm({ kind });

      button('Exit').click();

      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
    });

    // 发现 F1（规格 S7：不存档的三种状态下，“退出”只调用一次 onExitToMenu，绝不调用 onSaveAndExit）：
    // 实现里只要两个回调都接了，确认页的主按钮一律先调用 onSaveAndExit，再按它的结果决定是否退出——
    // 屏幕上写着“不保存 / 没有可保存的进度”，按下去却仍然发起了一次存档。
    // 实现修正后这些用例会转为通过，届时去掉 .fails。
    it.fails.each(UNSAVED_KINDS)('%s: Exit never calls onSaveAndExit', (kind) => {
      bench.openConfirm({ kind });

      button('Exit').click();

      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
    });

    // F1 的后果：那次不该有的存档调用若返回 failed，本来就不存档的对局停在“保存失败”页，而不是退出。
    it.fails(
      'no-save-mode: Exit leaves even if a save attempt would fail, because none is made',
      () => {
        bench.openConfirm({ kind: 'no-save-mode' }, { kind: 'failed' });

        button('Exit').click();

        expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
        expect(copy()).not.toContain(SAVE_FAILED_TITLE_EN);
      }
    );

    it.each(UNSAVED_KINDS)('%s: Cancel goes back without exiting', (kind) => {
      bench.openConfirm({ kind });

      button('Cancel').click();

      expectDefaultView();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
    });

    it('not wired: opening, cancelling and exiting write nothing to storage', () => {
      saveCampaignCheckpoint(STORED_CHECKPOINT);
      const before = storageSnapshot();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
      const menu = bench.create();

      menu.show();
      exitButton().click();
      button('Cancel').click();
      exitButton().click();
      button('Exit').click();

      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(storageSnapshot()).toEqual(before);
    });

    it('wired: the menu itself writes nothing; saving is the callback’s job', () => {
      saveCampaignCheckpoint(STORED_CHECKPOINT);
      const before = storageSnapshot();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

      bench.openConfirm(saved());
      button('Save & Exit').click();

      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(storageSnapshot()).toEqual(before);
    });
  });

  describe('S8: a failed save', () => {
    it('does not exit and opens the Save Failed view', () => {
      bench.openConfirm(saved(), { kind: 'failed' });

      button('Save & Exit').click();

      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(copy()).toContain(SAVE_FAILED_TITLE_EN);
      expect(labels()).toEqual([BACK_EN, EXIT_ANYWAY_EN]);
    });

    it('Back returns to the default view without exiting or saving again', () => {
      bench.openSaveFailed();

      button(BACK_EN).click();

      expectDefaultView();
      expect(labelOf(exitButton())).toBe('Save & Exit');
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
    });

    it('Exit Anyway leaves exactly once without trying to save again', () => {
      bench.openSaveFailed();

      button(EXIT_ANYWAY_EN).click();

      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
    });

    it('never exits by itself, however long the view stays open', () => {
      vi.useFakeTimers();
      bench.openSaveFailed();

      vi.advanceTimersByTime(10 * 60 * 1000);
      vi.runAllTimers();

      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
      expect(labels()).toEqual([BACK_EN, EXIT_ANYWAY_EN]);
    });

    it('a failed preview goes straight to Save Failed without attempting a save', () => {
      bench.createWired({ kind: 'failed' }, saved()).show();

      exitButton().click();

      expect(copy()).toContain(SAVE_FAILED_TITLE_EN);
      expect(labels()).toEqual([BACK_EN, EXIT_ANYWAY_EN]);
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();

      button(EXIT_ANYWAY_EN).click();
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
    });

    it('after Back the player can try again, and a save that now works exits', () => {
      bench.openSaveFailed();
      button(BACK_EN).click();
      bench.result = saved();

      exitButton().click();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      button('Save & Exit').click();

      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(2);
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
    });

    it.each(UNSAVED_KINDS)(
      'promised a save but the result is %s: stays, and redraws the confirm view from a fresh status',
      (kind) => {
        bench.openConfirm(saved());
        // 点下去的那一刻情况变了：这一局不存档
        bench.result = { kind };
        bench.status = { kind };
        const asked = bench.getSaveStatus.mock.calls.length;

        button('Save & Exit').click();

        expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
        expect(bench.onExitToMenu, 'does not exit').not.toHaveBeenCalled();
        expect(bench.getSaveStatus.mock.calls.length, 'asks again').toBeGreaterThan(asked);
        for (const phrase of UNSAVED_PHRASES[kind].en) {
          expect(copy()).toMatch(phrase);
        }
        expect(copy()).not.toContain('Saves at');
        expect(labels()).toEqual(['Cancel', 'Exit']);
        expect(document.activeElement, 'nothing is saved now: focus on Cancel').toBe(
          button('Cancel')
        );

        button('Exit').click();
        expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
      }
    );

    it('promised a save, got none, and the fresh status still promises one: stays on the confirm view', () => {
      bench.openConfirm(saved('wave'), { kind: 'not-started' });
      bench.status = saved('boss');

      button('Save & Exit').click();

      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(labels()).toEqual(['Cancel', 'Save & Exit']);
      expect(copy()).toContain(POSITIONS.boss.en);
      expect(copy()).not.toContain(SAVE_FAILED_TITLE_EN);
    });
  });

  describe('S9: focus', () => {
    it.each(STAGES)('a %s save: the confirm view opens with focus on Save & Exit', (stage) => {
      bench.openConfirm(saved(stage));

      expect(document.activeElement).toBe(button('Save & Exit'));
    });

    it.each(UNSAVED_KINDS)('%s: the confirm view opens with focus on Cancel', (kind) => {
      bench.openConfirm({ kind });

      expect(document.activeElement).toBe(button('Cancel'));
    });

    it('not wired: the confirm view opens with focus on Cancel', () => {
      bench.create().show();
      exitButton().click();

      expect(document.activeElement).toBe(button('Cancel'));
    });

    it('the Save Failed view opens with focus on Back, after a failed save or a failed preview', () => {
      bench.openSaveFailed();
      expect(document.activeElement).toBe(button(BACK_EN));

      bench.dispose();
      bench = createBench();
      bench.createWired({ kind: 'failed' }).show();
      exitButton().click();
      expect(document.activeElement).toBe(button(BACK_EN));
    });
  });

  describe('S9: Enter and Space are left to the buttons', () => {
    const KEY_EVENT_TYPES = ['keydown', 'keypress', 'keyup'];

    function spyOnGlobalListeners(): Mock[] {
      return [document, window, document.body, document.documentElement].map(
        (target) => vi.spyOn(target, 'addEventListener') as unknown as Mock
      );
    }

    function keyListenerTypes(spies: Mock[]): string[] {
      return spies
        .flatMap((spy) => spy.mock.calls.map(([type]) => String(type)))
        .filter((type) => KEY_EVENT_TYPES.includes(type));
    }

    it('registers no document-level key handler in any view', () => {
      const spies = spyOnGlobalListeners();

      const menu = bench.createWired(saved(), { kind: 'failed' });
      menu.show();
      exitButton().click();
      button('Cancel').click();
      button(LABELS.settings.en).click();
      menu.handleEscape();
      exitButton().click();
      button('Save & Exit').click();
      expect(labels()).toEqual([BACK_EN, EXIT_ANYWAY_EN]);
      button(BACK_EN).click();
      bench.status = { kind: 'no-save-mode' };
      exitButton().click();
      menu.hide();
      menu.show();

      expect(keyListenerTypes(spies)).toEqual([]);
    });

    interface OpenView {
      name: string;
      open(): void;
    }

    const VIEWS: readonly OpenView[] = [
      { name: 'the default view', open: () => bench.createWired(saved()).show() },
      { name: 'the confirm view of a saving run', open: () => bench.openConfirm(saved()) },
      {
        name: 'the confirm view of a run that does not save',
        open: () => bench.openConfirm({ kind: 'no-save-mode' }),
      },
      {
        name: 'the confirm view of a menu that is not wired',
        open: () => {
          bench.create().show();
          exitButton().click();
        },
      },
      { name: 'the Save Failed view', open: () => bench.openSaveFailed() },
    ];

    it.each(VIEWS)(
      'Enter / Space key events on $name are not consumed and do nothing by themselves',
      ({ open }) => {
        open();
        const nodes = buttons();
        const html = panel().innerHTML;
        const focused = document.activeElement;
        const saves = bench.onSaveAndExit.mock.calls.length;
        const targets: EventTarget[] = [document, document.body, ...nodes];

        for (const key of ['Enter', ' ']) {
          for (const type of ['keydown', 'keyup'] as const) {
            for (const target of targets) {
              const event = press(target, key, type);
              expect(event.defaultPrevented, `${type} "${key}" is left alone`).toBe(false);
            }
          }
        }

        expect(bench.onSaveAndExit.mock.calls.length, 'no save').toBe(saves);
        expect(bench.onExitToMenu, 'no exit').not.toHaveBeenCalled();
        expect(bench.onContinue).not.toHaveBeenCalled();
        expect(bench.onUpgrade).not.toHaveBeenCalled();
        expect(panel().innerHTML, 'the view did not change').toBe(html);
        const after = buttons();
        expect(after.length, 'the buttons were not redrawn').toBe(nodes.length);
        after.forEach((node, index) => expect(node).toBe(nodes[index]));
        expect(document.activeElement, 'focus did not move').toBe(focused);
      }
    );

    it('activation is the click of the focused button and nothing else', () => {
      bench.openConfirm(saved());
      const focused = document.activeElement as HTMLButtonElement;
      expect(labelOf(focused)).toBe('Save & Exit');

      // 键盘事件本身不触发（jsdom 不会由按键合成 click）；浏览器对有焦点的按钮合成的就是这次 click
      press(focused, 'Enter');
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      focused.click();

      expect(bench.onSaveAndExit).toHaveBeenCalledTimes(1);
      expect(bench.onExitToMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe('S9: Left / Right move focus between the two buttons', () => {
    interface TwoButtonView {
      name: string;
      open(): void;
      /** 打开时焦点所在的位置：0 = 左，1 = 右 */
      initial: 0 | 1;
    }

    const TWO_BUTTON_VIEWS: readonly TwoButtonView[] = [
      {
        name: 'the confirm view of a saving run',
        open: () => bench.openConfirm(saved()),
        initial: 1,
      },
      {
        name: 'the confirm view of a run that does not save',
        open: () => bench.openConfirm({ kind: 'complete' }),
        initial: 0,
      },
      {
        name: 'the confirm view of a menu that is not wired',
        open: () => {
          bench.create().show();
          exitButton().click();
        },
        initial: 0,
      },
      { name: 'the Save Failed view', open: () => bench.openSaveFailed(), initial: 0 },
    ];

    it.each(TWO_BUTTON_VIEWS)(
      '$name: positional, no wrapping, default prevented',
      ({ open, initial }) => {
        open();
        const [left, right] = pair();
        const saves = bench.onSaveAndExit.mock.calls.length;
        expect(document.activeElement).toBe(initial === 0 ? left : right);

        const step = (key: 'ArrowLeft' | 'ArrowRight', expected: HTMLButtonElement): void => {
          const event = press(document.activeElement as HTMLElement, key);
          expect(event.defaultPrevented, `${key} is consumed`).toBe(true);
          expect(document.activeElement, `${key} lands on "${labelOf(expected)}"`).toBe(expected);
        };

        step('ArrowLeft', left);
        step('ArrowLeft', left);
        step('ArrowRight', right);
        step('ArrowRight', right);
        step('ArrowLeft', left);

        // 只是移动焦点：视图没重绘，什么也没触发
        const [leftAfter, rightAfter] = pair();
        expect(leftAfter).toBe(left);
        expect(rightAfter).toBe(right);
        expect(bench.onSaveAndExit.mock.calls.length).toBe(saves);
        expect(bench.onExitToMenu).not.toHaveBeenCalled();
      }
    );

    it('the default view has no arrow handling', () => {
      bench.createWired(saved()).show();
      const all = buttons();
      all[1].focus();

      for (const key of ['ArrowLeft', 'ArrowRight']) {
        for (const target of all) {
          expect(press(target, key).defaultPrevented, `${key} on the default view`).toBe(false);
        }
        expect(press(document, key).defaultPrevented).toBe(false);
      }

      expect(document.activeElement).toBe(all[1]);
      expectDefaultView('still the default view');
      expect(bench.onContinue).not.toHaveBeenCalled();
    });

    it('the settings view has no arrow handling', () => {
      bench.createWired(saved()).show();
      button(LABELS.settings.en).click();
      const all = buttons();
      expect(all.length).toBeGreaterThan(4);
      const html = panel().innerHTML;
      all[0].focus();

      for (const key of ['ArrowLeft', 'ArrowRight']) {
        for (const target of all) {
          expect(press(target, key).defaultPrevented, `${key} on the settings view`).toBe(false);
        }
      }

      expect(document.activeElement).toBe(all[0]);
      expect(panel().innerHTML, 'no setting changed').toBe(html);
      expect(bench.applyAudio).not.toHaveBeenCalled();
    });
  });

  describe('S9: a language switch keeps focus on the button the player had moved to', () => {
    // 发现 F2（规格 S9：切换语言原地重绘，并把焦点保持在同一个逻辑按钮上）：
    // 重绘时实现按“初始焦点规则”重新落焦（会存档 → 主按钮；不存档 → 取消；失败页 → 返回），
    // 玩家用方向键 / Tab 移到另一个按钮之后切换语言，焦点被拉回初始按钮。
    // 焦点仍在初始按钮上的情形是对的（见上面两种语言的用例）。实现修正后这些用例会转为通过，届时去掉 .fails。
    it.fails('saved confirm view: Cancel stays focused', () => {
      bench.openConfirm(saved('wave'));
      press(pair()[1], 'ArrowLeft');
      expect(document.activeElement, 'moved to Cancel').toBe(pair()[0]);

      setLocale('zh-CN');

      const [cancel, primary] = pair();
      expect(labelOf(primary)).toBe(LABELS.saveAndExit.zh);
      expect(document.activeElement, 'focus stays on Cancel').toBe(cancel);
    });

    it.fails('no-save confirm view: Exit stays focused', () => {
      bench.openConfirm({ kind: 'no-save-mode' });
      press(pair()[0], 'ArrowRight');
      expect(document.activeElement, 'moved to Exit').toBe(pair()[1]);

      setLocale('zh-CN');

      const [cancel, exit] = pair();
      expect(labelOf(cancel)).toBe(LABELS.cancel.zh);
      expect(document.activeElement, 'focus stays on Exit').toBe(exit);
    });

    it.fails('Save Failed view: Exit Anyway stays focused', () => {
      bench.openSaveFailed();
      press(pair()[0], 'ArrowRight');
      expect(document.activeElement, 'moved to Exit Anyway').toBe(pair()[1]);

      setLocale('zh-CN');

      const [, exitAnyway] = pair();
      expect(copy()).toMatch(SAVE_FAILED_PHRASES.zh[0]);
      expect(document.activeElement, 'focus stays on Exit Anyway').toBe(exitAnyway);
    });

    it('moving focus and switching language neither saves nor exits', () => {
      bench.openConfirm(saved('wave'));
      press(pair()[1], 'ArrowLeft');

      setLocale('zh-CN');
      setLocale('en');

      expect(labels()).toEqual(['Cancel', 'Save & Exit']);
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });
  });

  describe('S9: Escape', () => {
    it('is not handled while hidden or on the default view', () => {
      const menu = bench.createWired(saved());
      expect(menu.handleEscape(), 'never shown').toBe(false);

      menu.show();
      expect(menu.handleEscape(), 'default view').toBe(false);
      expectDefaultView('Escape on the default view changes nothing');

      menu.hide();
      expect(menu.handleEscape(), 'hidden again').toBe(false);
    });

    it.each<[string, () => void]>([
      ['the confirm view of a saving run', () => bench.openConfirm(saved())],
      [
        'the confirm view of a run that does not save',
        () => bench.openConfirm({ kind: 'not-started' }),
      ],
      [
        'the confirm view of a menu that is not wired',
        () => {
          bench.create().show();
          exitButton().click();
        },
      ],
      ['the Save Failed view', () => bench.openSaveFailed()],
      [
        'the settings view',
        () => {
          bench.createWired(saved()).show();
          button(LABELS.settings.en).click();
        },
      ],
    ])('goes back to the default view from %s', (_name, open) => {
      open();
      const menu = bench.menu as PauseMenu;
      const saves = bench.onSaveAndExit.mock.calls.length;
      expect(isDefaultView()).toBe(false);

      expect(menu.handleEscape()).toBe(true);

      expectDefaultView();
      expect(menu.isVisible()).toBe(true);
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
      expect(bench.onSaveAndExit.mock.calls.length).toBe(saves);
      // 已经在默认页：再按一次交还给协调器
      expect(menu.handleEscape()).toBe(false);
    });

    it('is not handled when the menu was hidden with the confirm view open, and reopens on the default view', () => {
      const menu = bench.openConfirm(saved());
      menu.hide();

      expect(menu.handleEscape()).toBe(false);

      menu.show();
      expectDefaultView('show() starts on the default view');
      expect(menu.handleEscape()).toBe(false);
    });
  });

  describe('S9: touch size', () => {
    it('every button of every view is at least 44px tall', () => {
      const measured: string[] = [];
      const check = (view: string): void => {
        const all = buttons();
        expect(all.length, `${view} has buttons`).toBeGreaterThan(0);
        for (const element of all) {
          expect(
            declaredHeight(element),
            `"${labelOf(element)}" on ${view}`
          ).toBeGreaterThanOrEqual(44);
        }
        measured.push(view);
      };

      const menu = bench.createWired(saved(), { kind: 'failed' });
      menu.show();
      check('the default view');
      button(LABELS.settings.en).click();
      check('the settings view');
      menu.handleEscape();
      exitButton().click();
      check('the confirm view (saving)');
      button('Save & Exit').click();
      check('the Save Failed view');
      button(BACK_EN).click();
      bench.status = { kind: 'no-save-mode' };
      exitButton().click();
      check('the confirm view (not saving)');

      bench.dispose();
      bench = createBench();
      bench.create().show();
      exitButton().click();
      check('the confirm view (not wired)');

      expect(measured).toHaveLength(6);
    });
  });

  describe('S9: dispose', () => {
    function expectNothingLeft(): void {
      expect(document.getElementById('pause-menu')).toBeNull();
      expect(document.querySelector('.pause-panel')).toBeNull();
      expect(document.querySelectorAll('button')).toHaveLength(0);
      expect(document.body.childElementCount).toBe(0);
      expect(document.body.textContent?.trim()).toBe('');
      for (const style of document.querySelectorAll('style')) {
        expect(style.textContent ?? '').not.toContain('pause');
      }
    }

    it.each<[string, () => void]>([
      ['the default view', () => bench.createWired(saved()).show()],
      ['the confirm view', () => bench.openConfirm(saved())],
      ['the Save Failed view', () => bench.openSaveFailed()],
    ])('leaves nothing of the menu in the document when disposed on %s', (_name, open) => {
      open();
      const menu = bench.menu as PauseMenu;

      menu.dispose();

      expect(menu.isVisible()).toBe(false);
      expectNothingLeft();
    });

    it('a language switch after dispose brings nothing back and asks the game nothing', () => {
      bench.openConfirm(saved());
      (bench.menu as PauseMenu).dispose();
      const asked = bench.getSaveStatus.mock.calls.length;

      setLocale('zh-CN');
      setLocale('en');

      expectNothingLeft();
      expect(bench.getSaveStatus.mock.calls.length).toBe(asked);
      expect(bench.onSaveAndExit).not.toHaveBeenCalled();
      expect(bench.onExitToMenu).not.toHaveBeenCalled();
    });
  });
});
