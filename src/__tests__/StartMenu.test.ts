import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartMenu } from '@/ui/StartMenu';
import { isShown } from './menuTestUtils';

const DECORATIVE_GLYPHS = /✈️|✈|🎮|👹/u;
const MATERIAL_GREEN =
  /#4caf50|#45a049|rgba?\(\s*76\s*,\s*175\s*,\s*80|rgba?\(\s*69\s*,\s*160\s*,\s*73/i;

function collectRelatedCss(element: HTMLElement): string {
  const chunks: string[] = [];
  let current: HTMLElement | null = element;
  while (current) {
    chunks.push(current.getAttribute('style') ?? '');
    current = current.parentElement;
  }
  for (const style of document.querySelectorAll('style')) {
    chunks.push(style.textContent ?? '');
  }
  return chunks.join('\n');
}

function cssBlocksFor(css: string, selectorClass: string): string {
  const blocks: string[] = [];
  const pattern = new RegExp(`\\.${selectorClass}\\b[^{]*\\{([^}]*)\\}`, 'gi');
  let match: RegExpExecArray | null = pattern.exec(css);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(css);
  }
  return blocks.join('\n');
}

function startRoot(): HTMLElement {
  const root = document.getElementById('start-menu');
  expect(root, 'expected #start-menu after constructing StartMenu').toBeTruthy();
  return root as HTMLElement;
}

describe('StartMenu', () => {
  let menu: StartMenu | null;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.stubGlobal('requestIdleCallback', () => 1);
    menu = new StartMenu();
  });

  afterEach(() => {
    menu?.dispose();
    menu = null;
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  // 批次 X5：标题画面上不再有固定宽度的设置面板（原先断言它的 CSS 宽度）；
  // 设置收进了 #settings-btn 打开的面板里，窄屏上不会再有一块 400px 的面板撑破页面。
  it('keeps the settings in a sheet opened from #settings-btn, not in a panel on the title', () => {
    const root = startRoot();
    const settingsButton = document.getElementById('settings-btn');
    expect(settingsButton, 'expected #settings-btn').toBeTruthy();
    const controls = Array.from(root.querySelectorAll('[id$="-row"]'));
    expect(controls.length, 'the settings rows exist').toBeGreaterThan(0);
    for (const control of controls) {
      expect(
        control.closest('[role="dialog"]'),
        `#${control.id} lives in the settings dialog`
      ).not.toBeNull();
    }

    const sheet = (controls[0] as HTMLElement).closest('[role="dialog"]') as HTMLElement;
    expect(isShown(sheet), 'closed until asked for').toBe(false);
    (settingsButton as HTMLButtonElement).click();
    expect(isShown(sheet)).toBe(true);
    expect(sheet.getAttribute('aria-modal')).toBe('true');
  });

  it('does not paint the primary start button as a #4CAF50 / #45a049 capsule', () => {
    const startBtn = document.getElementById('start-btn');
    expect(startBtn, 'expected #start-btn').toBeTruthy();

    const related = collectRelatedCss(startBtn as HTMLElement);
    const buttonCss = `${(startBtn as HTMLElement).getAttribute('style') ?? ''}\n${cssBlocksFor(related, 'start-btn')}`;

    expect(
      buttonCss,
      `start button CSS should not use #4CAF50 / #45a049 (or rgb equivalents), got: ${buttonCss}`
    ).not.toMatch(MATERIAL_GREEN);
  });

  it('does not decorate the title or main buttons with ✈️🎮👹', () => {
    const root = startRoot();
    const title = root.querySelector('h1');
    const startBtn = document.getElementById('start-btn');
    const previewBtn = document.getElementById('preview-btn');

    expect(title, 'expected the title heading').toBeTruthy();
    expect(startBtn, 'expected #start-btn').toBeTruthy();
    expect(previewBtn, 'expected #preview-btn').toBeTruthy();

    expect(title?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(startBtn?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(previewBtn?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(startBtn?.innerHTML ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(previewBtn?.innerHTML ?? '').not.toMatch(DECORATIVE_GLYPHS);

    // 批次 X5：游戏模式从“+ / -”步进行改成了分段单选；选另一个模式（Boss 挑战），开局按钮随之改名
    const modeRow = document.getElementById('mode-row') as HTMLElement | null;
    expect(modeRow, 'expected #mode-row so the start label can switch modes').toBeTruthy();
    const labelBefore = document.getElementById('start-btn')?.textContent ?? '';
    const otherMode = Array.from(
      (modeRow as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')
    ).find((option) => option.getAttribute('aria-checked') !== 'true');
    expect(otherMode, 'expected a second game mode option on the game mode row').toBeTruthy();
    (otherMode as HTMLElement).click();
    expect(
      document.getElementById('start-btn')?.textContent ?? '',
      'the start label follows the game mode'
    ).not.toBe(labelBefore);
    expect((modeRow as HTMLElement).textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);

    expect(document.getElementById('start-btn')?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(document.getElementById('start-btn')?.innerHTML ?? '').not.toMatch(DECORATIVE_GLYPHS);
  });
});
