import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

describe('MissileSystem', () => {
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    particleSystem = {
      createMissileTrail: vi.fn(),
      createMissileImpact: vi.fn(),
      createTrail: vi.fn(),
      createExplosion: vi.fn(),
    } as unknown as ParticleSystem;
  });

  it('should emit missile trail effects while active missiles update', () => {
    const system = new MissileSystem(scene, particleSystem);

    system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    system.update(0.05);

    expect(particleSystem.createMissileTrail).toHaveBeenCalled();
  });

  it('should emit missile impact effects when colliding with a target', () => {
    const system = new MissileSystem(scene, particleSystem);
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    scene.add(target);

    system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), target);
    const onHit = vi.fn();

    system.checkCollisions([target], onHit);

    expect(onHit).toHaveBeenCalledWith(target);
    expect(particleSystem.createMissileImpact).toHaveBeenCalled();
  });
});
