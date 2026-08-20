import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import { HUD } from '@/ui/HUD';

type SettlementActions = {
  onRetry: () => void;
  onExitToMenu: () => void;
};

type HUDSettlement = HUD & {
  setSettlementActions: (actions: SettlementActions) => void;
};

function settlementHud(hud: HUD): HUDSettlement {
  return hud as HUDSettlement;
}

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

function findLabeledButton(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((button) =>
    (button.textContent ?? '').includes(label)
  );
  expect(match, `expected a <button> labeled "${label}"`).toBeTruthy();
  return match as HTMLButtonElement;
}

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function assertClickableTouchButton(button: HTMLButtonElement): void {
  const computedPointer = getComputedStyle(button).pointerEvents;
  const pointerEvents = computedPointer || button.style.pointerEvents;
  expect(pointerEvents, `${button.textContent} pointer-events`).not.toBe('none');
  expect(button.disabled).toBe(false);

  const computedMin = parsePx(getComputedStyle(button).minHeight);
  const computedHeight = parsePx(getComputedStyle(button).height);
  const inlineMin = parsePx(button.style.minHeight);
  const inlineHeight = parsePx(button.style.height);
  const sized = [computedMin, computedHeight, inlineMin, inlineHeight].find(
    (value): value is number => value != null && value >= 48
  );
  if (sized != null) {
    expect(sized).toBeGreaterThanOrEqual(48);
    return;
  }

  const css = collectRelatedCss(button);
  const declared = [...css.matchAll(/min-height\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((match) =>
    Number(match[1])
  );
  expect(
    declared.some((value) => value >= 48),
    `settlement button "${button.textContent}" height should be at least 48px`
  ).toBe(true);
}

function hasEquivalentPanelWidth(css: string): boolean {
  const normalized = css.replace(/\s+/g, ' ');
  if (/min\(\s*360px\s*,/.test(normalized) && /100%\s*-\s*32px/.test(normalized)) {
    return true;
  }
  return (
    /max-width\s*:\s*360px/.test(normalized) && /calc\(\s*100%\s*-\s*32px\s*\)/.test(normalized)
  );
}

describe('HUD', () => {
  let hud: HUD;

  beforeEach(() => {
    document.body.innerHTML = '';
    hud = new HUD();
  });

  afterEach(() => {
    hud.dispose();
    document.body.innerHTML = '';
  });

  it('caps lives to 5 hearts when lives exceed the limit', () => {
    hud.updateLives(7);

    const livesDisplay = Array.from(document.querySelectorAll('#hud div')).find((element) =>
      element.textContent?.startsWith('生命:')
    );

    expect(livesDisplay?.textContent).toBe(`生命: ${'❤️'.repeat(5)}`);
  });

  it('renders missile icons without exceeding GAME_CONSTANTS.MISSILE.MAX_MISSILES', () => {
    hud.updateMissiles(GAME_CONSTANTS.MISSILE.MAX_MISSILES + 3);

    const missilesDisplay = Array.from(document.querySelectorAll('#hud div')).find((element) =>
      element.textContent?.startsWith('导弹:')
    );

    const expectedMissiles = '🚀'.repeat(GAME_CONSTANTS.MISSILE.MAX_MISSILES);
    const expectedEmpty = '⬜'.repeat(0);

    expect(missilesDisplay?.textContent).toBe(`导弹: ${expectedMissiles}${expectedEmpty}`);
    expect((missilesDisplay?.textContent?.match(/🚀/g) || []).length).toBe(
      GAME_CONSTANTS.MISSILE.MAX_MISSILES
    );
  });

  it('shows mission completion without reusing the game over title', () => {
    hud.showMissionComplete(20000);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION COMPLETE');
    expect(document.getElementById('final-score')?.textContent).toBe('最终得分: 20000');

    hud.hideGameOver();
    hud.showGameOver(0);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION FAILED');
  });

  it('keeps GAME OVER out of the primary failure title', () => {
    hud.showGameOver(900);

    const title = document.getElementById('game-over-title')?.textContent ?? '';
    expect(title).toBe('MISSION FAILED');
    expect(title).not.toContain('GAME OVER');
    expect(document.getElementById('final-score')?.textContent).toBe('最终得分: 900');
  });

  it('wires 再来一局 and 返回菜单 to HUD settlement callbacks', () => {
    const onRetry = vi.fn();
    const onExitToMenu = vi.fn();
    expect(typeof settlementHud(hud).setSettlementActions).toBe('function');
    settlementHud(hud).setSettlementActions({ onRetry, onExitToMenu });

    hud.showGameOver(12);
    const retry = findLabeledButton('再来一局');
    const exitToMenu = findLabeledButton('返回菜单');
    assertClickableTouchButton(retry);
    assertClickableTouchButton(exitToMenu);

    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).not.toHaveBeenCalled();

    exitToMenu.click();
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the same settlement actions after mission complete', () => {
    const onRetry = vi.fn();
    const onExitToMenu = vi.fn();
    settlementHud(hud).setSettlementActions({ onRetry, onExitToMenu });

    hud.showMissionComplete(20000);

    expect(document.getElementById('game-over-title')?.textContent).toBe('MISSION COMPLETE');
    findLabeledButton('再来一局').click();
    findLabeledButton('返回菜单').click();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
  });

  it('sizes settlement actions for touch and keeps a narrow panel width', () => {
    settlementHud(hud).setSettlementActions({
      onRetry: vi.fn(),
      onExitToMenu: vi.fn(),
    });
    hud.showGameOver(0);

    const retry = findLabeledButton('再来一局');
    const exitToMenu = findLabeledButton('返回菜单');
    assertClickableTouchButton(retry);
    assertClickableTouchButton(exitToMenu);

    const overlay = document.getElementById('game-over-title')?.parentElement;
    expect(overlay).toBeTruthy();
    const css = `${collectRelatedCss(overlay as HTMLElement)}\n${collectRelatedCss(retry)}`;
    expect(hasEquivalentPanelWidth(css)).toBe(true);
    expect(css).toMatch(/env\(\s*safe-area-inset-/);
  });
});
