import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { ParticleSystem, ParticleType } from '@/features/effects/ParticleSystem';

describe('ParticleSystem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps boss hit flash lifetimes in the short hit-feedback range', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(GameConfig, 'getParticleCount').mockReturnValue(128);
    const scene = new THREE.Scene();
    const particleSystem = new ParticleSystem(scene);
    const spawnParticleSpy = vi.spyOn(
      particleSystem as unknown as {
        spawnParticle: (
          type: ParticleType,
          position: THREE.Vector3,
          options: { life: number }
        ) => unknown;
      },
      'spawnParticle'
    );

    particleSystem.createHit(new THREE.Vector3(0, 0, 0), 1.6, 'boss');

    const flashLives = spawnParticleSpy.mock.calls
      .filter(([type]) => type === ParticleType.EXPLOSION)
      .map(([, , options]) => options.life);

    expect(randomSpy).toHaveBeenCalled();
    expect(flashLives.length).toBeGreaterThan(0);
    expect(Math.max(...flashLives)).toBeLessThan(0.3);

    particleSystem.dispose();
  });
});
