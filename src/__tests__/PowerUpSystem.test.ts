import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SpawnBalloon } from '@/features/effects/SpawnBalloon';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { BalloonPowerUp } from '@/features/powerups/BalloonPowerUp';
import { PowerUpManager, PowerUpType } from '@/features/powerups/PowerUpSystem';

function createCanvasContext(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('PowerUpSystem', () => {
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;
  let restoreSpies: Array<{ mockRestore: () => void }>;

  beforeEach(() => {
    restoreSpies = [];
    scene = new THREE.Scene();
    particleSystem = {
      createExplosion: vi.fn(),
    } as unknown as ParticleSystem;
    const canvasContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => createCanvasContext());
    restoreSpies.push(canvasContextSpy);
  });

  afterEach(() => {
    for (const spy of restoreSpies) {
      spy.mockRestore();
    }
  });

  it('keeps the balloon icon as a camera-facing sprite while the balloon rotates', () => {
    const balloon = new BalloonPowerUp(new THREE.Vector3(0, 10, 0), PowerUpType.HEALTH, 'H');
    const root = balloon.getMesh();
    const icon = root.children.find((child): child is THREE.Sprite => child instanceof THREE.Sprite);

    expect(icon).toBeDefined();

    balloon.update(1);

    expect(root.rotation.y).toBe(0);
    expect(icon?.parent).toBe(root);
  });

  it('disposes each completed spawn animation once when simultaneous spawns finish', () => {
    const manager = new PowerUpManager(scene, particleSystem);
    const disposeSpy = vi.spyOn(SpawnBalloon.prototype, 'dispose');
    restoreSpies.push(disposeSpy);

    manager.spawn(new THREE.Vector3(0, 10, 0), PowerUpType.HEALTH, '?');
    manager.spawn(new THREE.Vector3(20, 10, 20), PowerUpType.SHIELD, '?');
    manager.update(2.1);

    expect(manager.getBalloons()).toHaveLength(2);
    expect(disposeSpy).toHaveBeenCalledTimes(2);
  });

  it('clamps spawn animation fade values on a large completion frame', () => {
    const effect = new SpawnBalloon(new THREE.Vector3(0, 0, 0), vi.fn());

    effect.update(5);

    const fadedMaterials = effect
      .getMesh()
      .children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh)
      .map((child) => child.material as THREE.MeshBasicMaterial);

    for (const material of fadedMaterials) {
      expect(material.opacity).toBeGreaterThanOrEqual(0);
      expect(material.opacity).toBeLessThanOrEqual(1);
    }
    expect(effect.isFinished()).toBe(true);

    effect.dispose();
  });
});
