import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { BossAI, createBossMesh } from '@/features/boss/BossAI';
import { DesertFortressAI, createDesertFortressMesh } from '@/features/boss/DesertFortressAI';
import { OctopusWarshipAI, createOctopusWarshipMesh } from '@/features/boss/OctopusWarshipAI';
import { MissileDestroyerAI, createMissileDestroyerMesh } from '@/features/boss/MissileDestroyerAI';
import { SkyCarrierAI, createSkyCarrierMesh } from '@/features/boss/SkyCarrierAI';
import { BOSS_CONFIGS, BossType } from '@/features/boss/BossTypes';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

type AnyGroup = THREE.Group & Record<string, THREE.Mesh[] | undefined>;

function mockParticles(): ParticleSystem {
  return {
    createExplosion: vi.fn(),
    createTrail: vi.fn(),
    createFlakExplosion: vi.fn(),
    createBossMissileTrail: vi.fn(),
    createBossMissileExplosion: vi.fn(),
    createHit: vi.fn(),
    createTeleportOut: vi.fn(),
    createTeleportIn: vi.fn(),
  } as unknown as ParticleSystem;
}

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`missing required node: ${label}`);
  }
  return value;
}

function player(): THREE.Object3D {
  const p = new THREE.Object3D();
  p.position.set(120, 140, 80);
  return p;
}

describe('Boss mesh redesign smoke', () => {
  it('HEAVY_BOMBER: caches populated, rotors spin, updates & disposes', () => {
    const scene = new THREE.Scene();
    const config = BOSS_CONFIGS[BossType.HEAVY_BOMBER];
    const mesh = createBossMesh(config) as AnyGroup;
    scene.add(mesh);

    expect(must(mesh.bossParts, 'bossParts').length).toBeGreaterThan(10);
    expect(must(mesh.muzzleMeshes, 'muzzleMeshes').length).toBe(4);
    expect(must(mesh.engineMeshes, 'engineMeshes').length).toBe(6);
    expect(must(mesh.engineRingMeshes, 'engineRingMeshes').length).toBe(6);
    expect(must(mesh.weakpointMeshes, 'weakpointMeshes').length).toBeGreaterThanOrEqual(2);
    expect(must(mesh.signalBeaconMeshes, 'signalBeaconMeshes').length).toBeGreaterThanOrEqual(3);
    expect(must(mesh.rotorMeshes, 'rotorMeshes').length).toBe(12);

    // 机头应位于 +Z（航向）一侧
    const nose = must(mesh.getObjectByName('boss_nose'), 'boss_nose');
    expect(nose.position.z).toBeGreaterThan(0);

    const boss = new BossAI(mesh, config, scene, mockParticles());
    const rotorBefore = must(mesh.rotorMeshes, 'rotorMeshes')[0].rotation.z;
    for (let i = 0; i < 60; i++) boss.update(0.016, player(), []);
    expect(must(mesh.rotorMeshes, 'rotorMeshes')[0].rotation.z).not.toBe(rotorBefore);
    boss.dispose();
    expect(mesh.children.length).toBe(0);
  });

  it('DESERT_FORTRESS: caches populated, radar rotates, updates & disposes', () => {
    const scene = new THREE.Scene();
    const config = BOSS_CONFIGS[BossType.DESERT_FORTRESS];
    const mesh = createDesertFortressMesh(config) as AnyGroup;
    scene.add(mesh);

    expect(must(mesh.bossParts, 'bossParts').length).toBeGreaterThan(10);
    expect(mesh.getObjectByName('fortress_core_glow')).toBeTruthy();
    const muzzles = mesh.children.filter((c) => c.name.startsWith('fortress_flak_muzzle_'));
    expect(muzzles.length).toBe(4);
    const glowCaps = mesh.children.filter(
      (c) => c.name.startsWith('fortress_missile_') && c.name.endsWith('_glow')
    );
    expect(glowCaps.length).toBe(2);
    const beacons = mesh.children.filter((c) => c.name.startsWith('fortress_signal_beacon_'));
    expect(beacons.length).toBeGreaterThanOrEqual(3);

    const boss = new DesertFortressAI(mesh, config, scene, mockParticles());
    const radar = must(mesh.getObjectByName('fortress_radar_array'), 'fortress_radar_array');
    const before = radar.rotation.y;
    for (let i = 0; i < 60; i++) boss.update(0.016, player(), []);
    expect(radar.rotation.y).not.toBe(before);
    boss.dispose();
    expect(mesh.children.length).toBe(0);
  });

  it('OCTOPUS_WARSHIP: tentacles articulated and swaying, eye band clear, disposes', () => {
    const scene = new THREE.Scene();
    const config = BOSS_CONFIGS[BossType.OCTOPUS_WARSHIP];
    const mesh = createOctopusWarshipMesh(config) as AnyGroup;
    scene.add(mesh);

    const tentacles = mesh.children.filter((c) => c.name.startsWith('octopus_tentacle_'));
    expect(tentacles.length).toBe(8);
    let pivotCount = 0;
    tentacles[0].traverse((n) => {
      if (n.name.includes('_pivot_')) pivotCount++;
    });
    expect(pivotCount).toBe(6);

    const edges = mesh.children.filter((c) => c.name.startsWith('octopus_plate_edge_'));
    expect(edges.length).toBe(8);
    expect(mesh.getObjectByName('octopus_core_glow')).toBeTruthy();
    expect(mesh.getObjectByName('octopus_top_aperture')).toBeTruthy();
    expect(mesh.getObjectByName('octopus_bottom_aperture')).toBeTruthy();

    const boss = new OctopusWarshipAI(mesh, config, mockParticles());
    boss.init();
    const pivot = must(
      mesh.getObjectByName('octopus_tentacle_0_pivot_3'),
      'octopus_tentacle_0_pivot_3'
    );
    const before = pivot.rotation.x;
    for (let i = 0; i < 30; i++) boss.update(0.016, player(), []);
    expect(pivot.rotation.x).not.toBe(before);
    boss.dispose();
    expect(mesh.children.length).toBe(0);
  });

  it('MISSILE_DESTROYER: caches populated, nav radar spins, bow faces +Z, disposes', () => {
    const scene = new THREE.Scene();
    const config = BOSS_CONFIGS[BossType.MISSILE_DESTROYER];
    const mesh = createMissileDestroyerMesh(config) as AnyGroup;
    scene.add(mesh);

    expect(must(mesh.bossParts, 'bossParts').length).toBeGreaterThan(10);
    expect(mesh.getObjectByName('destroyer_bridge_window')).toBeTruthy();
    const muzzles = mesh.children.filter((c) => c.name.startsWith('destroyer_flak_muzzle_'));
    expect(muzzles.length).toBe(4);
    const caps = mesh.children.filter((c) => c.name.startsWith('destroyer_launcher_cap_'));
    expect(caps.length).toBe(4);
    const exhausts = mesh.children.filter((c) => c.name.startsWith('destroyer_exhaust_glow_'));
    expect(exhausts.length).toBe(2);

    const bow = must(mesh.getObjectByName('destroyer_bow'), 'destroyer_bow');
    expect(bow.position.z).toBeGreaterThan(0);

    const boss = new MissileDestroyerAI(mesh, config, scene, mockParticles());
    const radar = must(mesh.getObjectByName('destroyer_radar_array'), 'destroyer_radar_array');
    const before = radar.rotation.y;
    for (let i = 0; i < 60; i++) boss.update(0.016, player(), []);
    expect(radar.rotation.y).not.toBe(before);
    boss.dispose();
    expect(mesh.children.length).toBe(0);
  });

  it('SKY_CARRIER: required nodes present, radar spins, updates & disposes', () => {
    const scene = new THREE.Scene();
    const config = BOSS_CONFIGS[BossType.SKY_CARRIER];
    const mesh = createSkyCarrierMesh(config) as AnyGroup;
    scene.add(mesh);

    expect(mesh.children.length).toBeGreaterThanOrEqual(45);
    expect(must(mesh.muzzleMeshes, 'muzzleMeshes').length).toBe(2);
    expect(must(mesh.launcherGlowMeshes, 'launcherGlowMeshes').length).toBe(2);
    expect(must(mesh.engineGlowMeshes, 'engineGlowMeshes').length).toBe(4);
    expect(must(mesh.weakpointMeshes, 'weakpointMeshes').length).toBeGreaterThanOrEqual(4);
    expect(must(mesh.radarRotorMeshes, 'radarRotorMeshes').length).toBe(1);

    const parked = mesh.children.filter((c) => c.name.startsWith('carrier_parked_aircraft_'));
    expect(parked.length).toBe(4);

    const boss = new SkyCarrierAI(mesh, config, scene, mockParticles());
    const radar = must(mesh.getObjectByName('carrier_radar'), 'carrier_radar');
    const before = radar.rotation.y;
    for (let i = 0; i < 60; i++) boss.update(0.016, player(), []);
    expect(radar.rotation.y).not.toBe(before);
    boss.dispose();
    expect(mesh.children.length).toBe(0);
  });
});
