import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LaserSweepSystem } from '@/features/boss/LaserSweepSystem';
import { LASER_SWEEP_CONFIG } from '@/features/boss/BossTypes';
import * as THREE from 'three';

describe('LaserSweepSystem', () => {
  let system: LaserSweepSystem;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    system = new LaserSweepSystem(scene);
  });

  describe('constructor', () => {
    it('should create a LaserSweepSystem instance', () => {
      expect(system).toBeDefined();
    });

    it('should start in idle state', () => {
      expect(system.isActive()).toBe(false);
      expect(system.isWarning()).toBe(false);
    });

    it('should have correct damage value', () => {
      expect(system.getDamage()).toBe(LASER_SWEEP_CONFIG.DAMAGE);
    });
  });

  describe('update', () => {
    it('should start warning after interval', () => {
      const bossPos = new THREE.Vector3(0, 100, 0);

      for (let i = 0; i < 60; i++) {
        system.update(0.1, bossPos);
      }

      expect(system.isWarning()).toBe(true);
    });

    it('should transition from warning to sweeping', () => {
      const bossPos = new THREE.Vector3(0, 100, 0);

      for (let i = 0; i < 60; i++) {
        system.update(0.1, bossPos);
      }

      expect(system.isWarning()).toBe(true);

      for (let i = 0; i < 35; i++) {
        system.update(0.1, bossPos);
      }

      expect(system.isActive()).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('should call onWarningStart when warning begins', () => {
      const bossPos = new THREE.Vector3(0, 100, 0);
      const onWarningStart = vi.fn();
      system.onWarningStart = onWarningStart;

      for (let i = 0; i < 60; i++) {
        system.update(0.1, bossPos);
      }

      expect(onWarningStart).toHaveBeenCalledTimes(1);
    });

    it('should call onSweepStart when sweep begins', () => {
      const bossPos = new THREE.Vector3(0, 100, 0);
      const onSweepStart = vi.fn();
      system.onSweepStart = onSweepStart;

      for (let i = 0; i < 100; i++) {
        system.update(0.1, bossPos);
      }

      expect(onSweepStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkPlayerCollision', () => {
    it('should return false when not sweeping', () => {
      const playerPos = new THREE.Vector3(0, 100, 50);
      const bossPos = new THREE.Vector3(0, 100, 0);

      expect(system.checkPlayerCollision(playerPos, bossPos)).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      system.dispose();
      expect(system.isActive()).toBe(false);
    });
  });
});
