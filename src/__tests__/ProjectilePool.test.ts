import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ProjectilePool } from '@/features/combat/ProjectilePool';

describe('ProjectilePool', () => {
  let pool: ProjectilePool;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    pool = new ProjectilePool(scene);
  });

  describe('fire', () => {
    it('should activate a projectile when fired', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);

      pool.fire(position, direction, 10);

      const active = pool.getActiveProjectiles();
      expect(active.length).toBe(1);
    });

    it('should set projectile position and direction', () => {
      const position = new THREE.Vector3(10, 20, 30);
      const direction = new THREE.Vector3(1, 0, 0);

      pool.fire(position, direction, 10);

      const active = pool.getActiveProjectiles();
      expect(active[0].position.x).toBe(10);
      expect(active[0].position.y).toBe(20);
      expect(active[0].position.z).toBe(30);
    });

    it('should store owner reference', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);
      const owner = new THREE.Object3D();

      pool.fire(position, direction, 10, owner, 'enemy');

      const active = pool.getActiveProjectiles();
      expect(active.length).toBe(1);
    });

    it('should apply distinct visual profiles for player, enemy, and friendly rounds', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);
      const snapshotVisual = (mesh: THREE.Mesh) => ({
        geometryType: mesh.geometry.type,
        color: (mesh.material as THREE.MeshBasicMaterial).color.getHex(),
        scale: mesh.scale.clone(),
      });

      pool.fire(position, direction, 10);
      const playerVisual = snapshotVisual(pool.getActiveProjectiles()[0] as THREE.Mesh);

      pool.clear();
      pool.fire(position, direction, 10, undefined, 'ENEMY');
      const enemyVisual = snapshotVisual(pool.getActiveProjectiles()[0] as THREE.Mesh);

      pool.clear();
      pool.fire(position, direction, 10, undefined, 'FRIENDLY');
      const friendlyVisual = snapshotVisual(pool.getActiveProjectiles()[0] as THREE.Mesh);

      expect(playerVisual.geometryType).toBe('BoxGeometry');
      expect(enemyVisual.geometryType).toBe('OctahedronGeometry');
      expect(friendlyVisual.geometryType).toBe('BoxGeometry');

      expect(playerVisual.color).not.toBe(enemyVisual.color);
      expect(playerVisual.color).not.toBe(friendlyVisual.color);
      expect(enemyVisual.color).not.toBe(friendlyVisual.color);

      expect(playerVisual.scale.z).toBeGreaterThan(enemyVisual.scale.z);
      expect(playerVisual.scale.x).toBeLessThan(enemyVisual.scale.x);
      expect(friendlyVisual.scale.z).toBeGreaterThan(enemyVisual.scale.z);
      expect(friendlyVisual.scale.x).toBeLessThan(enemyVisual.scale.x);
    });
  });

  describe('checkCollisions', () => {
    it('should skip collision with owner', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);
      const owner = new THREE.Object3D();
      owner.position.set(0, 0, 0);

      pool.fire(position, direction, 10, owner, 'enemy');

      const onHit = vi.fn();
      pool.checkCollisions([owner], onHit);

      expect(onHit).not.toHaveBeenCalled();
    });

    it('should detect collision with non-owner targets', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);
      const owner = new THREE.Object3D();
      owner.position.set(100, 100, 100);

      const target = new THREE.Object3D();
      target.position.set(0, 0, -2);

      pool.fire(position, direction, 10, owner, 'enemy');

      const onHit = vi.fn();
      pool.checkCollisions([target], onHit);

      expect(onHit).toHaveBeenCalled();
    });

    it('should not collide with invisible targets', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);

      const target = new THREE.Object3D();
      target.position.set(0, 0, -2);
      target.visible = false;

      pool.fire(position, direction, 10);

      const onHit = vi.fn();
      pool.checkCollisions([target], onHit);

      expect(onHit).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should deactivate all projectiles', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);

      pool.fire(position, direction, 10);
      pool.fire(position, direction, 10);
      pool.fire(position, direction, 10);

      expect(pool.getActiveProjectiles().length).toBe(3);

      pool.clear();

      expect(pool.getActiveProjectiles().length).toBe(0);
    });
  });

  describe('update', () => {
    it('should move projectiles', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);

      pool.fire(position, direction, 10);

      const before = pool.getActiveProjectiles()[0].position.clone();
      pool.update(1);
      const after = pool.getActiveProjectiles()[0].position;

      expect(after.z).toBeLessThan(before.z);
    });

    it('should deactivate projectiles beyond max distance', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(0, 0, -1);

      pool.fire(position, direction, 10);

      for (let i = 0; i < 100; i++) {
        pool.update(1);
      }

      expect(pool.getActiveProjectiles().length).toBe(0);
    });
  });
});
