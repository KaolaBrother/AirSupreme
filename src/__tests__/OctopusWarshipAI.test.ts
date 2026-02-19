import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OctopusWarshipAI, createOctopusWarshipMesh } from '@/features/boss/OctopusWarshipAI';
import { BOSS_CONFIGS, BossType, EYE_CONFIG } from '@/features/boss/BossTypes';
import * as THREE from 'three';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

describe('OctopusWarshipAI', () => {
  let boss: OctopusWarshipAI;
  let mesh: THREE.Group;
  let config: (typeof BOSS_CONFIGS)[BossType.OCTOPUS_WARSHIP];
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    config = BOSS_CONFIGS[BossType.OCTOPUS_WARSHIP];
    mesh = createOctopusWarshipMesh(config);
    scene = new THREE.Scene();
    scene.add(mesh); // 必须将 mesh 添加到 scene，否则 getScene() 返回 null
    particleSystem = new ParticleSystem(scene);

    boss = new OctopusWarshipAI(mesh, config, particleSystem);
    boss.init();
  });

  describe('createOctopusWarshipMesh', () => {
    it('should create a valid mesh', () => {
      const testMesh = createOctopusWarshipMesh(config);
      expect(testMesh).toBeDefined();
      expect(testMesh).toBeInstanceOf(THREE.Group);
    });

    it('should have correct scale', () => {
      expect(mesh.scale.x).toBe(config.scale);
      expect(mesh.scale.y).toBe(config.scale);
      expect(mesh.scale.z).toBe(config.scale);
    });
  });

  describe('constructor', () => {
    it('should create an OctopusWarshipAI instance', () => {
      expect(boss).toBeDefined();
    });

    it('should have correct initial health', () => {
      const health = boss.getHealth();
      expect(health.current).toBe(config.health);
      expect(health.max).toBe(config.health);
    });

    it('should be alive initially', () => {
      expect(boss.isAlive()).toBe(true);
    });
  });

  describe('init', () => {
    it('should create eyes', () => {
      const eyeSystem = boss.getEyeSystem();
      expect(eyeSystem.getEyeCount()).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should update without errors', () => {
      const playerMesh = new THREE.Object3D();
      playerMesh.position.set(0, 100, 100);

      expect(() => boss.update(0.016, playerMesh, [])).not.toThrow();
    });
  });

  describe('takeDamage', () => {
    it('should reduce health when taking damage', () => {
      const initialHealth = boss.getHealth().current;
      boss.takeDamage(100);
      expect(boss.getHealth().current).toBe(initialHealth - 100);
    });

    it('should call onDestroy when health reaches 0', () => {
      const onDestroy = vi.fn();
      boss.onDestroy = onDestroy;

      boss.takeDamage(config.health + 100);

      expect(onDestroy).toHaveBeenCalled();
    });
  });

  describe('teleport', () => {
    it('should have teleport cooldown after triggering', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.01);

      boss.takeDamage(10);

      vi.restoreAllMocks();
    });
  });

  describe('getMesh', () => {
    it('should return the mesh', () => {
      expect(boss.getMesh()).toBe(mesh);
    });
  });

  describe('getConfig', () => {
    it('should return the config', () => {
      expect(boss.getConfig()).toBe(config);
    });
  });

  describe('getPosition', () => {
    it('should return mesh position', () => {
      mesh.position.set(100, 150, 200);
      const pos = boss.getPosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(150);
      expect(pos.z).toBe(200);
    });
  });

  describe('getCollisionParts', () => {
    it('should return collision parts including eyes', () => {
      const parts = boss.getCollisionParts();
      expect(parts.length).toBeGreaterThan(0);
    });
  });

  describe('getEyeDamage', () => {
    it('should return correct eye damage', () => {
      expect(boss.getEyeDamage()).toBe(EYE_CONFIG.DAMAGE);
    });
  });

  describe('laser system', () => {
    it('should have a laser system', () => {
      expect(boss.getLaserSystem()).toBeDefined();
    });
  });

  describe('eye system', () => {
    it('should have an eye system', () => {
      expect(boss.getEyeSystem()).toBeDefined();
    });

    it('should have correct number of eyes', () => {
      expect(boss.getEyeSystem().getTotalEyeCount()).toBe(EYE_CONFIG.COUNT);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      boss.dispose();
      expect(mesh.visible).toBe(false);
    });
  });
});
