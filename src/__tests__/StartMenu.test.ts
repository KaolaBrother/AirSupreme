import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartMenu } from '@/ui/StartMenu';

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

function hasSettingsPanelWidth(css: string): boolean {
  const normalized = css.replace(/\s+/g, ' ');
  if (
    /width\s*:\s*min\(\s*420px\s*,\s*100%\s*\)/.test(normalized) ||
    /width\s*:\s*min\(\s*100%\s*,\s*420px\s*\)/.test(normalized) ||
    /width\s*:\s*min\(\s*420px\s*,\s*100vw\s*\)/.test(normalized) ||
    /width\s*:\s*min\(\s*100vw\s*,\s*420px\s*\)/.test(normalized)
  ) {
    return true;
  }
  return /max-width\s*:\s*420px/.test(normalized) && /width\s*:\s*100%/.test(normalized);
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

  it('sizes the settings panel with width min(420px, 100%) and does not use min-width: 400px', () => {
    const panel = startRoot().querySelector('.settings-panel');
    expect(panel, 'expected .settings-panel').toBeTruthy();

    const related = collectRelatedCss(panel as HTMLElement);
    const panelCss = `${(panel as HTMLElement).getAttribute('style') ?? ''}\n${cssBlocksFor(related, 'settings-panel')}`;

    expect(
      hasSettingsPanelWidth(panelCss),
      `settings-panel width should be min(420px, 100%) or equivalent, got: ${panelCss}`
    ).toBe(true);
    expect(related, 'StartMenu CSS must not contain min-width: 400px').not.toMatch(
      /min-width\s*:\s*400px/i
    );
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
    const title = root.querySelector('.menu-title');
    const startBtn = document.getElementById('start-btn');
    const previewBtn = document.getElementById('preview-btn');

    expect(title, 'expected .menu-title').toBeTruthy();
    expect(startBtn, 'expected #start-btn').toBeTruthy();
    expect(previewBtn, 'expected #preview-btn').toBeTruthy();

    expect(title?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(startBtn?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(previewBtn?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(startBtn?.innerHTML ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(previewBtn?.innerHTML ?? '').not.toMatch(DECORATIVE_GLYPHS);

    const modeRow = document.getElementById('mode-row') as HTMLElement | null;
    expect(modeRow, 'expected #mode-row so the start label can switch modes').toBeTruthy();
    const toggle = Array.from((modeRow as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '+'
    );
    expect(toggle, 'expected a + control on the game mode row').toBeTruthy();
    (toggle as HTMLButtonElement).click();

    expect(document.getElementById('start-btn')?.textContent ?? '').not.toMatch(DECORATIVE_GLYPHS);
    expect(document.getElementById('start-btn')?.innerHTML ?? '').not.toMatch(DECORATIVE_GLYPHS);
  });
});
