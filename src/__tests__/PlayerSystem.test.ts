import * as THREE from 'three';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { WORLDSCAPE_WATER_Y } from '@/features/terrain/TerrainGenerator';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';

vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: vi.fn().mockImplementation((aircraft: THREE.Group) => ({
    getPosition: () => aircraft.position.clone(),
    getQuaternion: () => aircraft.quaternion.clone(),
    getSpeed: () => 0,
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('PlayerSystem', () => {
  let scene: THREE.Scene;
  let deathHandler: ReturnType<typeof vi.fn>;
  let hitHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    deathHandler = vi.fn();
    hitHandler = vi.fn();
    EventBus.on(GameEventType.PLAYER_DEATH, deathHandler);
    EventBus.on(GameEventType.PLAYER_HIT, hitHandler);
  });

  const createPlayerSystem = (initialY: number): {
    system: PlayerSystem;
    mesh: THREE.Group;
  } => {
    const mesh = new THREE.Group();
    mesh.position.set(0, initialY, 0);
    const stats = new PlayerStats();
    const system = new PlayerSystem(scene, mesh, stats);

    system.init();
    return { system, mesh };
  };

  it('should respawn at a safe altitude above ground after crash', () => {
    const { system, mesh } = createPlayerSystem(-80);
    const respawnHandler = vi.fn();

    EventBus.on(GameEventType.PLAYER_RESPAWN, respawnHandler);

    mesh.position.y = -50;
    system.update(0.016);

    expect(system.isPlayerRespawning()).toBe(true);
    expect(mesh.visible).toBe(false);
    expect(deathHandler).toHaveBeenCalledTimes(1);
    expect(respawnHandler).toHaveBeenCalledTimes(0);

    // 经过复活延迟后触发复活
    system.update(2.1);

    expect(system.isPlayerRespawning()).toBe(false);
    expect(mesh.visible).toBe(true);
    expect(respawnHandler).toHaveBeenCalledTimes(1);
    expect(mesh.position.y).toBeGreaterThan(WORLDSCAPE_WATER_Y);
  });

  it('should not emit PLAYER_DEATH again on first update after respawn', () => {
    const { system, mesh } = createPlayerSystem(-80);
    const respawnHandler = vi.fn();

    EventBus.on(GameEventType.PLAYER_RESPAWN, respawnHandler);

    mesh.position.y = -50;
    system.update(0.016);
    expect(deathHandler).toHaveBeenCalledTimes(1);

    system.update(2.1);
    expect(respawnHandler).toHaveBeenCalledTimes(1);
    expect(deathHandler).toHaveBeenCalledTimes(1);
    expect(system.isPlayerRespawning()).toBe(false);

    // 复活后的下一次常规更新不应再触发连锁死亡
    system.update(0.016);

    expect(deathHandler).toHaveBeenCalledTimes(1);
    expect(respawnHandler).toHaveBeenCalledTimes(1);
  });

  it('should propagate optional player-hit feedback suppression metadata', () => {
    const { system } = createPlayerSystem(20);

    system.takeCombatDamage(12, { suppressDefaultFeedback: true });
    expect(hitHandler).toHaveBeenCalledTimes(1);
    expect(hitHandler.mock.calls[0][0].payload.feedback?.suppressDefaultFeedback).toBe(true);

    system.takeCombatDamage(8);
    expect(hitHandler).toHaveBeenCalledTimes(2);
    expect(hitHandler.mock.calls[1][0].payload.feedback).toBeUndefined();
  });

  describe('crash kill height', () => {
    const SURFACE_EPSILON = 0.01;
    const ELEVATED_CRASH_SURFACE_Y = 10;

    it('should emit PLAYER_DEATH when world Y is at the live water kill height', () => {
      const { system, mesh } = createPlayerSystem(20);

      mesh.position.y = WORLDSCAPE_WATER_Y;
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(system.isPlayerRespawning()).toBe(true);
    });

    it('should emit PLAYER_DEATH when world Y is below the live water kill height', () => {
      const { system, mesh } = createPlayerSystem(20);

      mesh.position.y = WORLDSCAPE_WATER_Y - SURFACE_EPSILON;
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(system.isPlayerRespawning()).toBe(true);
    });

    it('should not emit PLAYER_DEATH from collision when world Y is still above the live water surface', () => {
      const { system, mesh } = createPlayerSystem(20);

      // 仍在活水面之上，即使低于过时的 GROUND_COLLISION_Y = -45
      mesh.position.y = WORLDSCAPE_WATER_Y + SURFACE_EPSILON;
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(0);
      expect(system.isPlayerRespawning()).toBe(false);
    });

    it('should emit PLAYER_DEATH when world Y is at a provided crash surface above the old kill plane', () => {
      const { system, mesh } = createPlayerSystem(20);

      system.setCrashSurfaceSampler(() => ELEVATED_CRASH_SURFACE_Y);
      mesh.position.y = ELEVATED_CRASH_SURFACE_Y;
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(system.isPlayerRespawning()).toBe(true);
    });

    it('should emit PLAYER_DEATH when world Y is just below a provided crash surface of 10', () => {
      const { system, mesh } = createPlayerSystem(20);

      system.setCrashSurfaceSampler(() => ELEVATED_CRASH_SURFACE_Y);
      mesh.position.y = ELEVATED_CRASH_SURFACE_Y - SURFACE_EPSILON;
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(system.isPlayerRespawning()).toBe(true);
    });

    it('should not emit PLAYER_DEATH from collision when world Y is just above a provided crash surface of 10', () => {
      const { system, mesh } = createPlayerSystem(20);

      system.setCrashSurfaceSampler(() => ELEVATED_CRASH_SURFACE_Y);
      mesh.position.y = ELEVATED_CRASH_SURFACE_Y + SURFACE_EPSILON;
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(0);
      expect(system.isPlayerRespawning()).toBe(false);
    });

    it('should sample crash surface at the player XZ rather than a single world plane', () => {
      const { system, mesh } = createPlayerSystem(20);

      // x>=50 处地面为 10；其余处回落到活水面
      system.setCrashSurfaceSampler((x) =>
        x >= 50 ? ELEVATED_CRASH_SURFACE_Y : WORLDSCAPE_WATER_Y,
      );

      mesh.position.set(80, ELEVATED_CRASH_SURFACE_Y - SURFACE_EPSILON, 12);
      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(system.isPlayerRespawning()).toBe(true);
    });

    it('should respawn above a provided crash surface and not emit a second PLAYER_DEATH', () => {
      const { system, mesh } = createPlayerSystem(-80);
      const respawnHandler = vi.fn();

      EventBus.on(GameEventType.PLAYER_RESPAWN, respawnHandler);
      system.setCrashSurfaceSampler(() => ELEVATED_CRASH_SURFACE_Y);

      mesh.position.y = ELEVATED_CRASH_SURFACE_Y - SURFACE_EPSILON;
      system.update(0.016);
      expect(deathHandler).toHaveBeenCalledTimes(1);

      system.update(2.1);
      expect(respawnHandler).toHaveBeenCalledTimes(1);
      expect(mesh.position.y).toBeGreaterThan(ELEVATED_CRASH_SURFACE_Y);
      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(system.isPlayerRespawning()).toBe(false);

      system.update(0.016);

      expect(deathHandler).toHaveBeenCalledTimes(1);
      expect(respawnHandler).toHaveBeenCalledTimes(1);
    });
  });
});
