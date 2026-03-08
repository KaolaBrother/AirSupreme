import * as THREE from 'three';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
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

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    deathHandler = vi.fn();
    EventBus.on(GameEventType.PLAYER_DEATH, deathHandler);
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
    expect(mesh.position.y).toBeGreaterThan(-45);
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
});
