import { describe, it, expect } from 'vitest';
import { GameConfig, GAME_CONSTANTS } from '@/config';

describe('GameConfig', () => {
  it('should detect mobile device', () => {
    expect(typeof GameConfig.isMobile).toBe('boolean');
  });

  it('should return valid pixel ratio', () => {
    const ratio = GameConfig.getPixelRatio();
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(2);
  });

  it('should return valid projectile pool size', () => {
    const size = GameConfig.getProjectilePoolSize();
    expect(size).toBeGreaterThan(0);
  });
});

describe('GAME_CONSTANTS', () => {
  it('should have valid player constants', () => {
    expect(GAME_CONSTANTS.PLAYER.BASE_SPEED).toBeGreaterThan(0);
    expect(GAME_CONSTANTS.PLAYER.BASE_HEALTH).toBeGreaterThan(0);
  });

  it('should have valid missile constants', () => {
    expect(GAME_CONSTANTS.MISSILE.SPEED).toBeGreaterThan(0);
    expect(GAME_CONSTANTS.MISSILE.DAMAGE).toBeGreaterThan(0);
    expect(GAME_CONSTANTS.MISSILE.MAX_LOCK_DISTANCE).toBeGreaterThan(0);
  });
});
