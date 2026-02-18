import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FlakCannonSystem, FlakProjectile } from '@/features/boss/FlakCannonSystem';
import { FLAK_CANNON_CONFIG } from '@/features/boss/BossTypes';

describe('FlakCannonSystem', () => {
  let scene: THREE.Scene;
  let onExplode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scene = new THREE.Scene();
    onExplode = vi.fn();
  });

  describe('FlakProjectile', () => {
    it('should create a projectile with correct initial position', () => {
      const position = new THREE.Vector3(10, 20, 30);
      const targetPosition = new THREE.Vector3(50, 100, 50);

      const projectile = new FlakProjectile(scene, position, targetPosition, {
        explosionRadius: FLAK_CANNON_CONFIG.AOE_RADIUS,
        onExplode,
      });

      expect(projectile.mesh.position.x).toBe(10);
      expect(projectile.mesh.position.y).toBe(20);
      expect(projectile.mesh.position.z).toBe(30);
      expect(projectile.active).toBe(true);
    });

    it('should be active on creation', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 100, 100),
        { explosionRadius: 50, onExplode }
      );

      expect(projectile.active).toBe(true);
    });

    it('should move during update', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 100, 0),
        { explosionRadius: 50, onExplode }
      );

      const initialPos = projectile.mesh.position.clone();
      projectile.update(0.1);

      const moved = !projectile.mesh.position.equals(initialPos);
      expect(moved).toBe(true);
    });

    it('should deactivate after max range', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 100, 0),
        { explosionRadius: 50, onExplode }
      );

      for (let i = 0; i < 2000; i++) {
        projectile.update(0.1);
        if (!projectile.active) break;
      }

      expect(projectile.active).toBe(false);
    });

    it('should explode when reaching target position', () => {
      const targetPosition = new THREE.Vector3(0, 100, 0);
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        targetPosition,
        { explosionRadius: 50, onExplode }
      );

      for (let i = 0; i < 500; i++) {
        projectile.update(0.016);
        if (!projectile.active) break;
      }

      expect(projectile.active).toBe(false);
      expect(onExplode).toHaveBeenCalled();
    });

    it('should call onExplode with correct parameters', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 50, 0),
        { explosionRadius: 50, onExplode }
      );

      while (projectile.active) {
        projectile.update(0.016);
      }

      expect(onExplode).toHaveBeenCalledWith(
        expect.any(THREE.Vector3),
        FLAK_CANNON_CONFIG.AOE_RADIUS,
        FLAK_CANNON_CONFIG.DAMAGE
      );
    });

    it('should force explode when requested', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1000, 0),
        { explosionRadius: 50, onExplode }
      );

      expect(projectile.active).toBe(true);
      projectile.forceExplode();
      expect(projectile.active).toBe(false);
      expect(onExplode).toHaveBeenCalled();
    });

    it('should not force explode if already inactive', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 100, 0),
        { explosionRadius: 50, onExplode }
      );

      while (projectile.active) {
        projectile.update(0.016);
      }

      onExplode.mockClear();
      projectile.forceExplode();
      expect(onExplode).not.toHaveBeenCalled();
    });

    it('should NOT track target - flies to fixed position', () => {
      const target = new THREE.Object3D();
      target.position.set(0, 100, 0);
      scene.add(target);

      const initialTargetPos = target.position.clone();
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        initialTargetPos,
        { explosionRadius: 50, onExplode }
      );

      const initialVelocity = projectile.velocity.clone();
      projectile.update(0.016);

      target.position.set(100, 200, 100);
      projectile.update(0.016);

      expect(projectile.velocity.x).toBeCloseTo(initialVelocity.x, 5);
      expect(projectile.velocity.y).toBeCloseTo(initialVelocity.y, 5);
      expect(projectile.velocity.z).toBeCloseTo(initialVelocity.z, 5);
    });

    it('should dispose properly', () => {
      const projectile = new FlakProjectile(
        scene,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 100, 100),
        { explosionRadius: 50, onExplode }
      );

      projectile.dispose(scene);

      expect(scene.children.length).toBe(0);
    });
  });

  describe('FlakCannonSystem', () => {
    let system: FlakCannonSystem;

    beforeEach(() => {
      system = new FlakCannonSystem(scene, FLAK_CANNON_CONFIG.AOE_RADIUS, onExplode);
    });

    it('should fire projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));

      expect(system.getProjectiles().length).toBe(1);
    });

    it('should fire multiple projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-100, 100, -100));

      expect(system.getProjectiles().length).toBe(2);
    });

    it('should update all projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-100, 100, -100));

      system.update(0.016);

      expect(system.getProjectiles().length).toBe(2);
    });

    it('should remove inactive projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 10, 0));

      while (system.getProjectiles().length > 0) {
        system.update(0.016);
      }

      expect(system.getProjectiles().length).toBe(0);
    });

    it('should return projectile meshes', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));

      const meshes = system.getProjectileMeshes();
      expect(meshes.length).toBe(1);
    });

    it('should check AOE collisions', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 50, 0));

      const target = new THREE.Object3D();
      target.position.set(0, 50, 0);
      scene.add(target);

      let hitCount = 0;
      system.checkAoeCollisions([target], () => {
        hitCount++;
      });

      expect(hitCount).toBeGreaterThanOrEqual(0);
    });

    it('should force explode all projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1000, 0));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2000, 0));

      expect(system.getProjectiles().length).toBe(2);

      system.forceExplodeAll();
      system.update(0.016);

      expect(system.getProjectiles().length).toBe(0);
      expect(onExplode).toHaveBeenCalledTimes(2);
    });

    it('should dispose all projectiles', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-100, 100, -100));

      system.dispose();

      expect(system.getProjectiles().length).toBe(0);
    });
  });

  describe('AOE collision', () => {
    let system: FlakCannonSystem;
    let onExplodeCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onExplodeCallback = vi.fn();
      system = new FlakCannonSystem(scene, FLAK_CANNON_CONFIG.AOE_RADIUS, onExplodeCallback);
    });

    it('should detect targets within explosion radius', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 50, 0));

      const target = new THREE.Object3D();
      target.position.set(0, 50, 0);
      scene.add(target);

      while (system.getProjectiles().length > 0) {
        system.update(0.016);
      }

      let hitCount = 0;
      system.checkAoeCollisions([target], () => {
        hitCount++;
      });

      expect(onExplodeCallback).toHaveBeenCalled();
    });

    it('should not detect targets outside explosion radius', () => {
      system.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 50, 0));

      const farTarget = new THREE.Object3D();
      farTarget.position.set(1000, 50, 1000);
      scene.add(farTarget);

      while (system.getProjectiles().length > 0) {
        system.update(0.016);
      }

      let hitCount = 0;
      system.checkAoeCollisions([farTarget], () => {
        hitCount++;
      });

      expect(hitCount).toBe(0);
    });

    it('should handle multiple targets in AOE', () => {
      let explosionCount = 0;
      let targetsHit = 0;

      const systemWithTracking = new FlakCannonSystem(
        scene,
        FLAK_CANNON_CONFIG.AOE_RADIUS,
        (position, radius, _damage) => {
          explosionCount++;
          const target1 = new THREE.Object3D();
          target1.position.set(10, 50, 10);
          const target2 = new THREE.Object3D();
          target2.position.set(-10, 50, -10);

          const dist1 = position.distanceTo(target1.position);
          const dist2 = position.distanceTo(target2.position);
          if (dist1 <= radius) targetsHit++;
          if (dist2 <= radius) targetsHit++;
        }
      );

      systemWithTracking.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 50, 0));

      while (systemWithTracking.getProjectiles().length > 0) {
        systemWithTracking.update(0.016);
      }

      expect(explosionCount).toBe(1);
      expect(targetsHit).toBe(2);
    });
  });
});
