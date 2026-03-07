import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { DesertFortressAI, createDesertFortressMesh } from '@/features/boss/DesertFortressAI';
import { BOSS_CONFIGS, BossType, FlakCannonPosition } from '@/features/boss/BossTypes';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

type BossPartsGroup = THREE.Group & { bossParts?: THREE.Mesh[] };

function createPlayerMesh(x: number, y: number, z: number): THREE.Object3D {
  const mesh = new THREE.Object3D();
  mesh.position.set(x, y, z);
  return mesh;
}

describe('DesertFortressAI', () => {
  let scene: THREE.Scene;
  let mockParticleSystem: ParticleSystem;
  let config: (typeof BOSS_CONFIGS)[BossType.DESERT_FORTRESS];

  beforeEach(() => {
    scene = new THREE.Scene();
    mockParticleSystem = {
      createExplosion: vi.fn(),
      createTrail: vi.fn(),
      createFlakExplosion: vi.fn(),
    } as unknown as ParticleSystem;
    config = BOSS_CONFIGS[BossType.DESERT_FORTRESS];
  });

  describe('createDesertFortressMesh', () => {
    it('should create a THREE.Group', () => {
      const mesh = createDesertFortressMesh(config);
      expect(mesh).toBeInstanceOf(THREE.Group);
    });

    it('should have correct name format', () => {
      const mesh = createDesertFortressMesh(config);
      expect(mesh.name).toBe(`BOSS_${config.type}`);
    });

    it('should have multiple child meshes (body parts)', () => {
      const mesh = createDesertFortressMesh(config);
      expect(mesh.children.length).toBeGreaterThan(5);
    });

    it('should store bossParts reference', () => {
      const mesh = createDesertFortressMesh(config);
      const bossParts = (mesh as BossPartsGroup).bossParts ?? [];
      expect(bossParts.length).toBeGreaterThan(0);
    });

    it('should have named body parts', () => {
      const mesh = createDesertFortressMesh(config);
      const partNames = ((mesh as BossPartsGroup).bossParts ?? []).map((p) => p.name);

      expect(partNames).toContain('fortress_body');
      expect(partNames).toContain('fortress_left_track');
      expect(partNames).toContain('fortress_right_track');
      expect(partNames).toContain('fortress_tower');
    });

    it('should have four flak cannon bases', () => {
      const mesh = createDesertFortressMesh(config);
      const partNames = ((mesh as BossPartsGroup).bossParts ?? []).map((p) => p.name);

      expect(partNames).toContain('fortress_flak_base_front_left');
      expect(partNames).toContain('fortress_flak_base_front_right');
      expect(partNames).toContain('fortress_flak_base_back_left');
      expect(partNames).toContain('fortress_flak_base_back_right');
    });

    it('should have two missile launchers', () => {
      const mesh = createDesertFortressMesh(config);
      const partNames = ((mesh as BossPartsGroup).bossParts ?? []).map((p) => p.name);

      expect(partNames).toContain('fortress_missile_left');
      expect(partNames).toContain('fortress_missile_right');
    });
  });

  describe('DesertFortressAI class', () => {
    let boss: DesertFortressAI;
    let mesh: THREE.Group;

    beforeEach(() => {
      mesh = createDesertFortressMesh(config);
      scene.add(mesh);
      boss = new DesertFortressAI(mesh, config, scene, mockParticleSystem);
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
    });

    it('should return flak cannon system', () => {
      const flakSystem = boss.getFlakCannonSystem();
      expect(flakSystem).toBeDefined();
    });

    it('should update without errors', () => {
      const playerMesh = createPlayerMesh(0, 100, 0);
      const friendlies: THREE.Object3D[] = [];

      expect(() => boss.update(0.016, playerMesh, friendlies)).not.toThrow();
    });

    it('should safely update visual state at critical health even when cached visual refs are missing', () => {
      boss.takeDamage(config.health - 1);
      (boss as unknown as { coreGlow: THREE.Mesh | null }).coreGlow = null;
      (boss as unknown as { flakMuzzles: THREE.Mesh[] }).flakMuzzles = [];
      (boss as unknown as { missileGlowCaps: THREE.Mesh[] }).missileGlowCaps = [];

      expect(() => boss.update(0.016, createPlayerMesh(0, 100, 0), [])).not.toThrow();
    });

    it('should not move during update (ground unit)', () => {
      const initialPos = mesh.position.clone();

      boss.update(0.016, createPlayerMesh(100, 100, 100), []);

      expect(mesh.position.x).toBe(initialPos.x);
      expect(mesh.position.y).toBe(initialPos.y);
      expect(mesh.position.z).toBe(initialPos.z);
    });

    it('should fire flak cannon after cooldown', () => {
      const onFlakFireCallback = vi.fn();
      boss.onFlakFire = onFlakFireCallback;

      for (let i = 0; i < 10; i++) {
        boss.update(0.1, createPlayerMesh(100, 100, 100), []);
      }

      expect(onFlakFireCallback).toHaveBeenCalled();
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

    it('should return collision parts', () => {
      const parts = boss.getCollisionParts();
      expect(parts.length).toBeGreaterThan(0);
    });

    it('should return collision part meshes', () => {
      const meshes = boss.getCollisionPartMeshes();
      expect(meshes.length).toBeGreaterThan(0);
    });
  });

  describe('Flak cannon target selection', () => {
    it('should accept player mesh for targeting', () => {
      const mesh = createDesertFortressMesh(config);
      scene.add(mesh);
      const boss = new DesertFortressAI(mesh, config, scene, mockParticleSystem);

      const onFlakFire = vi.fn();
      boss.onFlakFire = onFlakFire;

      boss.update(0.5, createPlayerMesh(100, 100, 100), []);

      expect(onFlakFire).toHaveBeenCalled();
    });

    it('should accept friendly meshes for targeting', () => {
      const mesh = createDesertFortressMesh(config);
      scene.add(mesh);
      const boss = new DesertFortressAI(mesh, config, scene, mockParticleSystem);

      const friendly = new THREE.Object3D();
      friendly.position.set(50, 50, 50);

      expect(() => boss.update(0.016, createPlayerMesh(0, 0, 0), [friendly])).not.toThrow();
    });
  });

  describe('visual cache robustness', () => {
    it('should update safely when visual-node names are absent from mesh', () => {
      const mesh = createDesertFortressMesh(config);
      const removable = mesh.children.filter(
        (child) =>
          child.name === 'fortress_core_glow'
          || child.name.startsWith('fortress_flak_muzzle_')
          || (child.name.startsWith('fortress_missile_') && child.name.endsWith('_glow'))
      );
      for (const node of removable) {
        mesh.remove(node);
      }

      scene.add(mesh);
      const fortress = new DesertFortressAI(mesh, config, scene, mockParticleSystem);
      fortress.takeDamage(config.health - 1);

      expect(() => fortress.update(0.016, createPlayerMesh(120, 80, -20), [])).not.toThrow();
    });
  });

  describe('Flak cannon offsets', () => {
    it('should have flak cannon position offsets', () => {
      const mesh = createDesertFortressMesh(config);
      scene.add(mesh);
      const boss = new DesertFortressAI(mesh, config, scene, mockParticleSystem);

      expect(boss['flakCannonOffsets']).toBeDefined();
      expect(boss['flakCannonOffsets'][FlakCannonPosition.FRONT_LEFT]).toBeDefined();
      expect(boss['flakCannonOffsets'][FlakCannonPosition.FRONT_RIGHT]).toBeDefined();
      expect(boss['flakCannonOffsets'][FlakCannonPosition.BACK_LEFT]).toBeDefined();
      expect(boss['flakCannonOffsets'][FlakCannonPosition.BACK_RIGHT]).toBeDefined();
    });
  });
});
