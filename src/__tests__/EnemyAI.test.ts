import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import * as THREE from 'three';
import { createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';

describe('EnemyAI', () => {
  let enemy: EnemyAI;
  let mesh: THREE.Group;
  let config: (typeof ENEMY_CONFIGS)[EnemyType.FIGHTER];
  let scene: THREE.Scene;

  beforeEach(() => {
    config = ENEMY_CONFIGS[EnemyType.FIGHTER];
    mesh = createEnemyMesh(config);
    scene = new THREE.Scene();
    scene.add(mesh);

    enemy = new EnemyAI(mesh, config, scene);
  });

  describe('constructor', () => {
    it('should create an EnemyAI instance', () => {
      expect(enemy).toBeDefined();
    });

    it('should have correct initial health', () => {
      const health = enemy.getHealth();
      expect(health.current).toBe(config.health);
      expect(health.max).toBe(config.health);
    });

    it('should be alive initially', () => {
      expect(enemy.isAlive()).toBe(true);
    });

    it('should have initial velocity pointing forward', () => {
      const velocity = enemy.getVelocity();
      expect(velocity.z).toBe(-config.speed);
      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
    });
  });

  describe('takeDamage', () => {
    it('should reduce health when taking damage', () => {
      const initialHealth = enemy.getHealth().current;
      enemy.takeDamage(50);
      expect(enemy.getHealth().current).toBe(initialHealth - 50);
    });

    it('should call onDestroy when health reaches 0', () => {
      const onDestroy = vi.fn();
      enemy.onDestroy = onDestroy;

      enemy.takeDamage(config.health + 100);

      expect(onDestroy).toHaveBeenCalled();
    });

    it('should be dead when health reaches 0', () => {
      enemy.takeDamage(config.health);
      expect(enemy.isAlive()).toBe(false);
    });
  });

  describe('update', () => {
    it('should update without errors when player position is null', () => {
      expect(() => enemy.update(0.016, null)).not.toThrow();
    });

    it('should update without errors when player position is provided', () => {
      const playerPos = new THREE.Vector3(100, 50, 100);
      expect(() => enemy.update(0.016, playerPos)).not.toThrow();
    });

    it('should reset position when NaN detected', () => {
      mesh.position.set(NaN, 50, 100);
      enemy.update(0.016, new THREE.Vector3(0, 0, 0));
      expect(mesh.position.x).toBe(0);
      expect(mesh.position.y).toBe(0);
      expect(mesh.position.z).toBe(0);
    });
  });

  describe('getMesh', () => {
    it('should return the mesh', () => {
      expect(enemy.getMesh()).toBe(mesh);
    });
  });

  describe('getConfig', () => {
    it('should return the config', () => {
      expect(enemy.getConfig()).toBe(config);
    });
  });

  describe('getPosition', () => {
    it('should return mesh position', () => {
      mesh.position.set(100, 50, 200);
      const pos = enemy.getPosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(50);
      expect(pos.z).toBe(200);
    });
  });

  describe('reset', () => {
    it('should reset position', () => {
      const newPos = new THREE.Vector3(50, 100, 150);
      enemy.reset(newPos);
      expect(enemy.getPosition()).toEqual(newPos);
    });

    it('should reset health', () => {
      enemy.takeDamage(50);
      enemy.reset(new THREE.Vector3(0, 0, 0));
      expect(enemy.getHealth().current).toBe(config.health);
    });
  });

  describe('dispose', () => {
    it('should hide mesh', () => {
      enemy.dispose();
      expect(mesh.visible).toBe(false);
    });

    it('should remove mesh from parent', () => {
      enemy.dispose();
      expect(mesh.parent).toBeNull();
    });
  });

  describe('onFire callback', () => {
    it('should be callable', () => {
      const onFire = vi.fn();
      enemy.onFire = onFire;
      expect(enemy.onFire).toBeDefined();
    });
  });
});
