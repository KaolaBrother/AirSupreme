import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { BossMissile, BossMissileSystem } from '@/features/boss/BossMissileSystem';
import { BOSS_MISSILE_CONFIG } from '@/features/boss/BossTypes';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

function createPlayerMesh(x: number, y: number, z: number): THREE.Object3D {
  const mesh = new THREE.Object3D();
  mesh.position.set(x, y, z);
  return mesh;
}

describe('BossMissileSystem', () => {
  let scene: THREE.Scene;
  let mockParticleSystem: ParticleSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    mockParticleSystem = {
      createExplosion: vi.fn(),
      createTrail: vi.fn(),
    } as unknown as ParticleSystem;
  });

  describe('BossMissile', () => {
    it('should create missile with correct initial position', () => {
      const position = new THREE.Vector3(10, 20, 30);
      const missile = new BossMissile(scene, position, null, mockParticleSystem);

      expect(missile.mesh.position.x).toBe(10);
      expect(missile.mesh.position.y).toBe(20);
      expect(missile.mesh.position.z).toBe(30);
    });

    it('should start with upward velocity', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const missile = new BossMissile(scene, position, null, mockParticleSystem);

      expect(missile.velocity.x).toBe(0);
      expect(missile.velocity.y).toBe(50); // 更新为新的导弹速度 (+25%)
      expect(missile.velocity.z).toBe(0);
    });

    it('should be active on creation', () => {
      const missile = new BossMissile(scene, new THREE.Vector3(), null, mockParticleSystem);
      expect(missile.active).toBe(true);
    });

    it('should deactivate after max range', () => {
      const missile = new BossMissile(scene, new THREE.Vector3(), null, mockParticleSystem);

      for (let i = 0; i < 2000; i++) {
        missile.update(0.1);
        if (!missile.active) break;
      }

      expect(missile.active).toBe(false);
    });

    it('should track target when provided', () => {
      const target = new THREE.Object3D();
      target.position.set(100, 100, 100);
      scene.add(target);

      const missile = new BossMissile(
        scene,
        new THREE.Vector3(0, 0, 0),
        target,
        mockParticleSystem
      );

      missile.update(0.016);

      expect(missile.velocity.y).toBeGreaterThan(0);
    });

    it('should find new target when current target is destroyed', () => {
      const friendlyMesh = new THREE.Object3D();
      friendlyMesh.position.set(50, 50, 50);
      scene.add(friendlyMesh);

      const playerMesh = createPlayerMesh(100, 100, 100);
      const missile = new BossMissile(
        scene,
        new THREE.Vector3(0, 0, 0),
        null,
        mockParticleSystem,
        [friendlyMesh],
        playerMesh
      );

      missile.update(0.016);

      const hasTarget = missile.target !== null || missile.isTargetingPlayer;
      expect(hasTarget).toBe(true);
    });

    it('should take damage and deactivate when health reaches zero', () => {
      const missile = new BossMissile(scene, new THREE.Vector3(), null, mockParticleSystem);

      expect(missile.active).toBe(true);
      missile.takeDamage(BOSS_MISSILE_CONFIG.HEALTH);
      expect(missile.active).toBe(false);
      expect(mockParticleSystem.createExplosion).toHaveBeenCalled();
    });

    it('should survive partial damage', () => {
      const missile = new BossMissile(scene, new THREE.Vector3(), null, mockParticleSystem);

      missile.takeDamage(10);
      expect(missile.active).toBe(true);
    });

    it('should create trail particles during update', () => {
      const missile = new BossMissile(scene, new THREE.Vector3(), null, mockParticleSystem);

      missile.update(0.016);

      expect(mockParticleSystem.createTrail).toHaveBeenCalled();
    });
  });

  describe('BossMissileSystem', () => {
    it('should fire missiles', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);

      system.fire(new THREE.Vector3(), null);

      expect(system.getMissiles().length).toBe(1);
    });

    it('should track active missiles', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);

      system.fire(new THREE.Vector3(), null);
      system.fire(new THREE.Vector3(), null);
      system.fire(new THREE.Vector3(), null);

      expect(system.getMissiles().length).toBe(3);
    });

    it('should return missile meshes', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      system.fire(new THREE.Vector3(), null);

      const meshes = system.getMissileMeshes();

      expect(meshes.length).toBe(1);
      expect(meshes[0]).toBeInstanceOf(THREE.Group);
    });

    it('should update all missiles', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      system.fire(new THREE.Vector3(), null);
      system.fire(new THREE.Vector3(), null);

      const initialY = system.getMissiles()[0].mesh.position.y;

      system.update(0.016);

      expect(system.getMissiles()[0].mesh.position.y).toBeGreaterThan(initialY);
    });

    it('should remove inactive missiles', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      system.fire(new THREE.Vector3(), null);

      const missile = system.getMissiles()[0];
      missile.active = false;

      system.update(0.016);

      expect(system.getMissiles().length).toBe(0);
    });

    it('should detect collisions with targets', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      system.fire(new THREE.Vector3(), null);

      const target = new THREE.Object3D();
      target.position.set(0, 5, 0);
      scene.add(target);

      const onHit = vi.fn();

      system.checkCollisions([target], onHit);

      expect(onHit).toHaveBeenCalled();
    });

    it('should apply correct damage on collision', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      system.fire(new THREE.Vector3(), null);

      const target = new THREE.Object3D();
      target.position.set(0, 5, 0);
      scene.add(target);

      let receivedDamage = 0;
      system.checkCollisions([target], (_t, damage) => {
        receivedDamage = damage;
      });

      expect(receivedDamage).toBe(BOSS_MISSILE_CONFIG.DAMAGE);
    });

    it('should clear all missiles on dispose', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      system.fire(new THREE.Vector3(), null);
      system.fire(new THREE.Vector3(), null);

      system.dispose();

      expect(system.getMissiles().length).toBe(0);
    });

    it('should pass potential targets to missiles', () => {
      const system = new BossMissileSystem(scene, mockParticleSystem as any);
      const friendly = new THREE.Object3D();
      friendly.position.set(50, 50, 50);
      scene.add(friendly);

      system.fire(new THREE.Vector3(), null, [friendly], createPlayerMesh(100, 100, 100));

      const missile = system.getMissiles()[0];
      missile.update(0.016);

      expect(missile['potentialTargets']).toContain(friendly);
    });
  });
});
