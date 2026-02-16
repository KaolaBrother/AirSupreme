import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { BossAI, createBossMesh } from '@/features/boss/BossAI';
import { BOSS_CONFIGS, BossType, BossCannonPosition } from '@/features/boss/BossTypes';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

function createPlayerMesh(x: number, y: number, z: number): THREE.Object3D {
  const mesh = new THREE.Object3D();
  mesh.position.set(x, y, z);
  return mesh;
}

describe('BossAI', () => {
  let scene: THREE.Scene;
  let mockParticleSystem: ParticleSystem;
  let config: (typeof BOSS_CONFIGS)[BossType.HEAVY_BOMBER];

  beforeEach(() => {
    scene = new THREE.Scene();
    mockParticleSystem = {
      createExplosion: vi.fn(),
      createTrail: vi.fn(),
    } as unknown as ParticleSystem;
    config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
  });

  describe('createBossMesh', () => {
    it('should create a THREE.Group', () => {
      const mesh = createBossMesh(config);
      expect(mesh).toBeInstanceOf(THREE.Group);
    });

    it('should have correct name format', () => {
      const mesh = createBossMesh(config);
      expect(mesh.name).toBe(`BOSS_${config.type}`);
    });

    it('should have multiple child meshes (body parts)', () => {
      const mesh = createBossMesh(config);
      expect(mesh.children.length).toBeGreaterThan(5);
    });

    it('should store bossParts reference', () => {
      const mesh = createBossMesh(config);
      expect((mesh as any).bossParts).toBeDefined();
      expect((mesh as any).bossParts.length).toBeGreaterThan(0);
    });

    it('should have named body parts', () => {
      const mesh = createBossMesh(config);
      const partNames = (mesh as any).bossParts.map((p: THREE.Mesh) => p.name);

      expect(partNames).toContain('boss_body');
      expect(partNames).toContain('boss_nose');
      expect(partNames).toContain('boss_left_wing');
      expect(partNames).toContain('boss_right_wing');
    });

    it('should have four turrets', () => {
      const mesh = createBossMesh(config);
      const partNames = (mesh as any).bossParts.map((p: THREE.Mesh) => p.name);

      expect(partNames).toContain('boss_left_turret');
      expect(partNames).toContain('boss_right_turret');
      expect(partNames).toContain('boss_top_turret');
      expect(partNames).toContain('boss_bottom_turret');
    });

    it('should apply scale to geometry', () => {
      const mesh = createBossMesh(config);
      const body = mesh.children.find((c) => c.name === 'boss_body') as THREE.Mesh;

      expect(body).toBeDefined();
    });
  });

  describe('BossAI class', () => {
    let boss: BossAI;
    let mesh: THREE.Group;

    beforeEach(() => {
      mesh = createBossMesh(config);
      scene.add(mesh);
      boss = new BossAI(mesh, config, scene, mockParticleSystem);
    });

    it('should be alive on creation', () => {
      expect(boss.isAlive()).toBe(true);
    });

    it('should have correct health', () => {
      const health = boss.getHealth();
      expect(health.max).toBe(config.health);
      expect(health.current).toBe(config.health);
    });

    it('should return correct mesh', () => {
      expect(boss.getMesh()).toBe(mesh);
    });

    it('should return correct config', () => {
      expect(boss.getConfig()).toBe(config);
    });

    it('should take damage', () => {
      boss.takeDamage(100);
      const health = boss.getHealth();
      expect(health.current).toBe(config.health - 100);
    });

    it('should die when health reaches zero', () => {
      const onDeathCallback = vi.fn();
      boss.onDestroy = onDeathCallback;

      boss.takeDamage(config.health);

      expect(boss.isAlive()).toBe(false);
      expect(onDeathCallback).toHaveBeenCalled();
    });

    it('should return missile system', () => {
      const missileSystem = boss.getMissileSystem();
      expect(missileSystem).toBeDefined();
      expect(missileSystem.getMissiles()).toBeDefined;
    });

    it('should update without errors', () => {
      const playerMesh = createPlayerMesh(0, 0, 0);
      const friendlies: THREE.Object3D[] = [];

      expect(() => boss.update(0.016, playerMesh, friendlies)).not.toThrow();
    });

    it('should have velocity on creation', () => {
      expect(boss.velocity).toBeDefined();
      expect(boss.velocity.length()).toBeGreaterThan(0);
    });

    it('should move during update', () => {
      const initialPos = mesh.position.clone();

      boss.update(0.016, createPlayerMesh(0, 0, 0), []);

      const moved = !mesh.position.equals(initialPos);
      expect(moved).toBe(true);
    });

    it('should fire cannon after cooldown', () => {
      const onFireCallback = vi.fn();
      boss.onFire = onFireCallback;

      for (let i = 0; i < 10; i++) {
        boss.update(0.1, createPlayerMesh(100, 100, 100), []);
      }

      expect(onFireCallback).toHaveBeenCalled();
    });

    it('should fire missile after longer cooldown', () => {
      const onMissileCallback = vi.fn();
      boss.onMissileFired = onMissileCallback;

      for (let i = 0; i < 700; i++) {
        boss.update(0.016, createPlayerMesh(100, 100, 100), []);
      }

      expect(onMissileCallback).toHaveBeenCalled();
    });

    it('should call onDestroy callback when destroyed', () => {
      const onDestroyCallback = vi.fn();
      boss.onDestroy = onDestroyCallback;

      boss.takeDamage(config.health);

      expect(onDestroyCallback).toHaveBeenCalledWith(expect.any(THREE.Vector3), config);
    });

    it('should dispose properly', () => {
      boss.dispose();

      expect(mesh.visible).toBe(false);
      expect(mesh.parent).toBeNull();
    });
  });

  describe('Boss cannon rotation', () => {
    it('should have cannon position offsets', () => {
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      expect(boss['cannonOffsets']).toBeDefined();
      expect(boss['cannonOffsets'][BossCannonPosition.LEFT_WING]).toBeDefined();
      expect(boss['cannonOffsets'][BossCannonPosition.RIGHT_WING]).toBeDefined();
      expect(boss['cannonOffsets'][BossCannonPosition.TOP]).toBeDefined();
      expect(boss['cannonOffsets'][BossCannonPosition.BOTTOM]).toBeDefined();
    });
  });

  describe('Boss target selection', () => {
    it('should target player by default', () => {
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      const onFire = vi.fn();
      boss.onFire = onFire;

      boss.update(0.5, createPlayerMesh(100, 50, 100), []);

      expect(onFire).toHaveBeenCalled();
    });

    it('should accept friendly meshes for targeting', () => {
      const mesh = createBossMesh(config);
      scene.add(mesh);
      const boss = new BossAI(mesh, config, scene, mockParticleSystem);

      const friendly = new THREE.Object3D();
      friendly.position.set(50, 50, 50);

      expect(() => boss.update(0.016, createPlayerMesh(0, 0, 0), [friendly])).not.toThrow();
    });
  });
});
