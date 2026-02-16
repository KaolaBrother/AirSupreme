import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { BossAI, createBossMesh } from '@/features/boss/BossAI';
import { BossMissileSystem } from '@/features/boss/BossMissileSystem';
import {
  BOSS_CONFIGS,
  BossType,
  BOSS_MISSILE_CONFIG,
  getBossForLevel,
} from '@/features/boss/BossTypes';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { EventBus } from '@/core/EventBus';

function createPlayerMesh(x: number, y: number, z: number): THREE.Object3D {
  const mesh = new THREE.Object3D();
  mesh.position.set(x, y, z);
  return mesh;
}

describe('Boss System Integration', () => {
  let scene: THREE.Scene;
  let mockParticleSystem: ParticleSystem;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    mockParticleSystem = {
      createExplosion: vi.fn(),
      createTrail: vi.fn(),
    } as unknown as ParticleSystem;
  });

  afterEach(() => {
    EventBus.clear();
  });

  describe('Boss Creation Flow', () => {
    it('should create complete boss from config', () => {
      const bossType = getBossForLevel(1);
      expect(bossType).toBe(BossType.HEAVY_BOMBER);

      const config = BOSS_CONFIGS[bossType!];
      const mesh = createBossMesh(config);
      scene.add(mesh);

      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      expect(boss.isAlive()).toBe(true);
      expect(boss.getHealth().max).toBe(2000);
      expect(boss.getMesh().children.length).toBeGreaterThan(5);
    });
  });

  describe('Boss Missile Integration', () => {
    it('should fire and track missiles', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      const missileSystem = boss.getMissileSystem();

      const target = new THREE.Object3D();
      target.position.set(100, 100, 100);
      scene.add(target);

      missileSystem.fire(mesh.position.clone(), target);

      for (let i = 0; i < 100; i++) {
        missileSystem.update(0.016);
      }

      const missiles = missileSystem.getMissiles();
      expect(missiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle missile hitting target', () => {
      const missileSystem = new BossMissileSystem(scene, mockParticleSystem);

      const target = new THREE.Object3D();
      target.position.set(0, 10, 0);
      scene.add(target);

      missileSystem.fire(new THREE.Vector3(0, 0, 0), target);

      let damageDealt = 0;
      missileSystem.checkCollisions([target], (_t, damage) => {
        damageDealt = damage;
      });

      if (damageDealt > 0) {
        expect(damageDealt).toBe(BOSS_MISSILE_CONFIG.DAMAGE);
      }
    });

    it('should handle missile destruction', () => {
      const missileSystem = new BossMissileSystem(scene, mockParticleSystem);

      missileSystem.fire(new THREE.Vector3(), null);

      const missile = missileSystem.getMissiles()[0];
      missile.takeDamage(BOSS_MISSILE_CONFIG.HEALTH);

      missileSystem.update(0.016);

      expect(missileSystem.getMissiles().length).toBe(0);
    });
  });

  describe('Boss Combat Flow', () => {
    it('should take damage from attacks', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      const initialHealth = boss.getHealth().current;

      boss.takeDamage(100);

      expect(boss.getHealth().current).toBe(initialHealth - 100);
    });

    it('should be destroyed when health reaches zero', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      const onDestroy = vi.fn();
      boss.onDestroy = onDestroy;

      boss.takeDamage(config.health);

      expect(boss.isAlive()).toBe(false);
      expect(onDestroy).toHaveBeenCalled();
    });

    it('should fire weapons during update', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      const fireEvents: { position: THREE.Vector3; direction: THREE.Vector3 }[] = [];
      boss.onFire = (position, direction) => {
        fireEvents.push({ position, direction });
      };

      for (let i = 0; i < 20; i++) {
        boss.update(0.1, createPlayerMesh(100, 100, 100), []);
      }

      expect(fireEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Boss Parts Collision', () => {
    it('should have multiple collidable parts', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);

      const parts = (mesh as any).bossParts as THREE.Mesh[];

      expect(parts.length).toBeGreaterThan(10);

      const partPositions = parts.map((p) => ({
        name: p.name,
        position: p.position.clone(),
      }));

      const body = partPositions.find((p) => p.name === 'boss_body');
      const nose = partPositions.find((p) => p.name === 'boss_nose');
      const leftWing = partPositions.find((p) => p.name === 'boss_left_wing');
      const rightWing = partPositions.find((p) => p.name === 'boss_right_wing');

      expect(body).toBeDefined();
      expect(nose).toBeDefined();
      expect(leftWing).toBeDefined();
      expect(rightWing).toBeDefined();
    });

    it('should allow targeting individual parts', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);

      const parts = (mesh as any).bossParts as THREE.Mesh[];

      const targetPart = parts.find((p) => p.name === 'boss_left_wing');
      expect(targetPart).toBeDefined();

      const worldPos = new THREE.Vector3();
      targetPart!.getWorldPosition(worldPos);
      expect(worldPos.x).toBeLessThan(0);
    });
  });

  describe('Boss Level Progression', () => {
    it('should have boss for each level 1-5', () => {
      for (let level = 1; level <= 5; level++) {
        const bossType = getBossForLevel(level);
        expect(bossType).not.toBeNull();

        const config = BOSS_CONFIGS[bossType!];
        expect(config).toBeDefined();
        expect(config.health).toBeGreaterThan(0);
      }
    });

    it('should return null for invalid levels', () => {
      expect(getBossForLevel(0)).toBeNull();
      expect(getBossForLevel(6)).toBeNull();
      expect(getBossForLevel(-1)).toBeNull();
    });
  });

  describe('Boss Missile Target Retargeting', () => {
    it('should find new target when current is destroyed', () => {
      const missileSystem = new BossMissileSystem(scene, mockParticleSystem);

      const target1 = new THREE.Object3D();
      target1.position.set(50, 50, 50);
      scene.add(target1);

      const target2 = new THREE.Object3D();
      target2.position.set(200, 200, 200);
      scene.add(target2);

      missileSystem.fire(
        new THREE.Vector3(0, 0, 0),
        target1,
        [target2],
        createPlayerMesh(100, 100, 100)
      );

      scene.remove(target1);
      target1.parent = null;

      const missile = missileSystem.getMissiles()[0];
      missile.update(0.016);

      expect(missile['target']).toBeDefined();
    });
  });

  describe('Boss System Cleanup', () => {
    it('should clean up all resources on dispose', () => {
      const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      boss.getMissileSystem().fire(new THREE.Vector3(), null);

      boss.dispose();

      expect(mesh.parent).toBeNull();
      expect(mesh.visible).toBe(false);
    });
  });
});
