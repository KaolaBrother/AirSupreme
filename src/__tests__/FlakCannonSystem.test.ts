import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLAK_CANNON_CONFIG } from '@/features/boss/BossTypes';
import { FlakCannonSystem, FlakProjectile } from '@/features/boss/FlakCannonSystem';

describe('FlakCannonSystem', () => {
  let scene: THREE.Scene;
  let onExplode: ReturnType<typeof vi.fn>;

  const advanceProjectile = (
    projectile: FlakProjectile,
    deltaTime: number = 0.016,
    maxSteps: number = 600
  ): void => {
    for (let i = 0; i < maxSteps && projectile.active; i++) {
      projectile.update(deltaTime);
    }
  };

  const advanceSystem = (
    system: FlakCannonSystem,
    deltaTime: number = 0.016,
    maxSteps: number = 600
  ): void => {
    for (let i = 0; i < maxSteps && system.getProjectiles().length > 0; i++) {
      system.update(deltaTime);
    }
  };

  beforeEach(() => {
    scene = new THREE.Scene();
    onExplode = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FlakProjectile', () => {
    it('creates a projectile at the requested fire position', () => {
      const position = new THREE.Vector3(10, 20, 30);
      const targetPosition = new THREE.Vector3(50, 100, 50);

      const projectile = new FlakProjectile(scene, position, targetPosition, {
        explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
        onExplode,
      });

      expect(projectile.mesh.position.toArray()).toEqual([10, 20, 30]);
      expect(projectile.active).toBe(true);
    });

    it('moves farther when updated with a larger deltaTime', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const target = new THREE.Vector3(120, 120, 0);
      const smallStepProjectile = new FlakProjectile(scene, start, target, {
        explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
        onExplode,
      });
      const largeStepProjectile = new FlakProjectile(scene, start, target, {
        explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
        onExplode,
      });

      smallStepProjectile.update(0.016);
      largeStepProjectile.update(0.2);

      const smallDistance = smallStepProjectile.mesh.position.distanceTo(start);
      const largeDistance = largeStepProjectile.mesh.position.distanceTo(start);

      expect(largeDistance).toBeGreaterThan(smallDistance * 5);
    });

    it('does not immediately detonate before the arming window', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 90, 0),
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      projectile.update(0.1);
      expect(projectile.active).toBe(true);
      expect(onExplode).not.toHaveBeenCalled();

      advanceProjectile(projectile);
      expect(projectile.active).toBe(false);
      expect(onExplode).toHaveBeenCalledTimes(1);
    });

    it('keeps fairness window: no detonation even when teleported near target before arming', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 120, 0),
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      const targetPosition = projectile.getTargetPosition();
      projectile.mesh.position.copy(targetPosition.clone().add(new THREE.Vector3(0.2, 0, 0)));
      projectile.update(0.01);

      expect(projectile.active).toBe(true);
      expect(onExplode).not.toHaveBeenCalled();
      expect((projectile as unknown as { warningMesh: THREE.Mesh }).warningMesh.visible).toBe(false);
    });

    it('detonates near the intended target region', () => {
      const targetPosition = new THREE.Vector3(0, 120, 0);
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        targetPosition,
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      advanceProjectile(projectile);

      expect(projectile.active).toBe(false);
      expect(onExplode).toHaveBeenCalledTimes(1);
      const [explodePosition, explodeRadius, explodeDamage] = onExplode.mock.calls[0];
      expect((explodePosition as THREE.Vector3).distanceTo(targetPosition)).toBeLessThanOrEqual(2);
      expect(explodeRadius).toBe(FLAK_CANNON_CONFIG.AOE_RADIUS);
      expect(explodeDamage).toBe(FLAK_CANNON_CONFIG.DAMAGE);
    });

    it('shows warning ring after arming when entering warning zone', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 120, 0),
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      const internals = projectile as unknown as {
        armingTime: number;
        warningDistance: number;
        warningMesh: THREE.Mesh;
        detonationPosition: THREE.Vector3;
        startPosition: THREE.Vector3;
      };
      const travelDirection = internals.detonationPosition
        .clone()
        .sub(internals.startPosition)
        .normalize();
      projectile.mesh.position.copy(
        internals.detonationPosition
          .clone()
          .addScaledVector(travelDirection, -internals.warningDistance * 0.95)
      );
      projectile.lifetime = internals.armingTime + 0.001;
      projectile.update(0.016);

      expect(projectile.active).toBe(true);
      expect(onExplode).not.toHaveBeenCalled();
      expect(internals.warningMesh.visible).toBe(true);
    });

    it('keeps its original trajectory after the target moves elsewhere', () => {
      const target = new THREE.Object3D();
      target.position.set(0, 120, 0);
      scene.add(target);

      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        target.position.clone(),
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      const initialDirection = projectile.velocity.clone().normalize();
      projectile.update(0.016);

      target.position.set(160, 220, 140);
      projectile.update(0.2);

      const currentDirection = projectile.velocity.clone().normalize();
      expect(currentDirection.dot(initialDirection)).toBeGreaterThan(0.999);
    });

    it('force explodes once and becomes inactive', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 600, 0),
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      projectile.forceExplode();
      projectile.forceExplode();

      expect(projectile.active).toBe(false);
      expect(onExplode).toHaveBeenCalledTimes(1);
    });

    it('disposes projectile and warning meshes from the scene', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 100, 100),
        {
          explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
          onExplode,
        }
      );

      expect(scene.children.length).toBe(2);
      projectile.dispose(scene);
      expect(scene.children.length).toBe(0);
    });
  });

  describe('FlakCannonSystem', () => {
    let system: FlakCannonSystem;

    beforeEach(() => {
      system = new FlakCannonSystem(scene, FLAK_CANNON_CONFIG.AOE_RADIUS, onExplode);
    });

    it('fires and exposes active projectile meshes', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-100, 100, -100));

      expect(system.getProjectiles()).toHaveLength(2);
      expect(system.getProjectileMeshes()).toHaveLength(2);
    });

    it('removes projectiles after they detonate', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 90, 0));

      advanceSystem(system);

      expect(system.getProjectiles()).toHaveLength(0);
      expect(onExplode).toHaveBeenCalledTimes(1);
    });

    it('applies AOE hits only after a queued explosion exists and clears them after use', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 90, 0));

      const nearTarget = new THREE.Object3D();
      nearTarget.position.set(0, 90, 0);
      scene.add(nearTarget);

      const farTarget = new THREE.Object3D();
      farTarget.position.set(200, 90, 200);
      scene.add(farTarget);

      let hitCount = 0;
      system.checkAoeCollisions([nearTarget, farTarget], () => {
        hitCount++;
      });
      expect(hitCount).toBe(0);

      advanceSystem(system);

      system.checkAoeCollisions([nearTarget, farTarget], () => {
        hitCount++;
      });
      expect(hitCount).toBe(1);

      system.checkAoeCollisions([nearTarget], () => {
        hitCount++;
      });
      expect(hitCount).toBe(1);
    });

    it('force explodes all active projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1000, 0));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2000, 0));

      system.forceExplodeAll();
      system.update(0.016);

      expect(system.getProjectiles()).toHaveLength(0);
      expect(onExplode).toHaveBeenCalledTimes(2);
    });

    it('disposes all projectiles and clears pending explosions', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 120, 0));
      system.forceExplodeAll();
      system.dispose();

      expect(system.getProjectiles()).toHaveLength(0);
      expect(scene.children.length).toBe(0);
    });
  });
});
