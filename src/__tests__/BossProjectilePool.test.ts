import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BossProjectilePool } from '@/features/combat/BossProjectilePool';

describe('BossProjectilePool', () => {
  let pool: BossProjectilePool;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    pool = new BossProjectilePool(scene);
  });

  it('should apply a heavier shell profile than ordinary projectiles', () => {
    pool.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), 18);

    const projectile = pool.getActiveProjectiles()[0] as THREE.Mesh;
    const material = projectile.material as THREE.MeshBasicMaterial;

    expect(projectile.geometry.type).toBe('BoxGeometry');
    expect(material.color.getHex()).toBe(0xe04c2d);
    expect(projectile.scale.x).toBeGreaterThan(1);
    expect(projectile.scale.z).toBeGreaterThan(3);
  });

  it('should grow its in-flight shell silhouette over travel', () => {
    pool.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), 18);

    const projectile = pool.getActiveProjectiles()[0] as THREE.Mesh;
    const beforeScale = projectile.scale.clone();

    pool.update(0.4);

    expect(projectile.scale.x).toBeGreaterThan(beforeScale.x);
    expect(projectile.scale.z).toBeGreaterThan(3);
    expect(projectile.scale.z).not.toBeCloseTo(beforeScale.z);
  });
});
