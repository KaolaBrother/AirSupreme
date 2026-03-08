import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import { HUD } from '@/ui/HUD';

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
});
