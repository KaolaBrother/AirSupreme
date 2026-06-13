import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { TrailRenderer } from '@/features/effects/TrailRenderer';
import { LEVELS } from '@/features/terrain/LevelConfig';
import { TerrainGenerator } from '@/features/terrain/TerrainGenerator';
import { CloudField } from '@/features/terrain/worldscape/clouds';
import { buildWorldscapeWater } from '@/features/terrain/worldscape/water';

type TransparentObject = THREE.Object3D & {
  material?: THREE.Material | THREE.Material[];
};

type TestWeatherProfile = {
  type: 'clear';
  intensity: number;
  fogDensity: number;
  cloudCount: number;
  cloudOpacity: number;
  cloudTint: THREE.ColorRepresentation;
  cloudSpeed: number;
  cloudHeightMin: number;
  cloudHeightMax: number;
  cloudCoverage: number;
  cloudTone: number;
  windStrength: number;
  windAngle: number;
  particleCount: number;
  particleSize: number;
  particleSpeed: number;
  particleDrift: number;
  particleColor: THREE.ColorRepresentation;
  waterWaveScale: number;
  skyGlow: THREE.ColorRepresentation;
};

type TerrainGeneratorTestApi = {
  createCirrusLayer(profile: TestWeatherProfile): void;
  createWeatherEffect(profile: TestWeatherProfile): void;
  createPerimeterHaze(): void;
  createDesertOasis(): void;
  createCentralPark(config: (typeof LEVELS)[number]): void;
};

const assertTransparentDepthPolicy = (object: TransparentObject): void => {
  const materials = Array.isArray(object.material)
    ? object.material
    : object.material
      ? [object.material]
      : [];

  expect(object.renderOrder).toBe(0);
  expect(materials.length).toBeGreaterThan(0);
  for (const material of materials) {
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
  }
};

const findByName = <T extends TransparentObject>(scene: THREE.Scene, name: string): T => {
  const object = scene.getObjectByName(name) as T | undefined;
  expect(object, `Expected scene object named ${name}`).toBeDefined();
  return object as T;
};

const makeWeatherProfile = (): TestWeatherProfile => ({
  type: 'clear',
  intensity: 0.4,
  fogDensity: 0.0002,
  cloudCount: 0,
  cloudOpacity: 0.7,
  cloudTint: 0xffffff,
  cloudSpeed: 1,
  cloudHeightMin: 200,
  cloudHeightMax: 260,
  cloudCoverage: 0.5,
  cloudTone: 1,
  windStrength: 0.2,
  windAngle: 0,
  particleCount: 4,
  particleSize: 3,
  particleSpeed: 2,
  particleDrift: 1,
  particleColor: 0xffffff,
  waterWaveScale: 1,
  skyGlow: 0xffffff,
});

describe('Transparent layer depth policy', () => {
  it('keeps worldscape water and cloud layers in normal transparent depth sorting', () => {
    const water = buildWorldscapeWater({
      size: 10,
      grid: 1,
      depthAt: () => 2,
    });
    const clouds = new CloudField({
      seed: 1,
      variants: 1,
      perVariant: 1,
      altitudeMin: 10,
      altitudeMax: 20,
    });

    assertTransparentDepthPolicy(water.mesh);
    expect(clouds.group.renderOrder).toBe(0);
    const cloudMesh = clouds.group.children[0] as TransparentObject;
    assertTransparentDepthPolicy(cloudMesh);

    water.dispose();
    clouds.dispose();
  });

  it('keeps TerrainGenerator weather, haze, cirrus, and scoped water layers depth sorted', () => {
    const scene = new THREE.Scene();
    const terrain = new TerrainGenerator(scene) as unknown as TerrainGeneratorTestApi;
    const profile = makeWeatherProfile();

    terrain.createCirrusLayer(profile);
    terrain.createWeatherEffect(profile);
    terrain.createPerimeterHaze();
    terrain.createDesertOasis();
    terrain.createCentralPark(LEVELS[4]);

    assertTransparentDepthPolicy(findByName(scene, 'worldscapeCirrus'));
    assertTransparentDepthPolicy(findByName(scene, 'weatherParticles'));
    assertTransparentDepthPolicy(findByName(scene, 'perimeterHaze'));
    assertTransparentDepthPolicy(findByName(scene, 'desertOasisWater'));
    assertTransparentDepthPolicy(findByName(scene, 'cityParkPondWater'));
  });

  it('keeps gameplay particles and trails depth-tested without elevated render order', () => {
    vi.spyOn(GameConfig, 'getParticleCount').mockReturnValue(4);
    const scene = new THREE.Scene();
    const particleSystem = new ParticleSystem(scene);
    const trail = new TrailRenderer(scene, new THREE.Object3D());

    const shockwave = scene.getObjectByName('particles')?.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh
    );
    expect(shockwave).toBeDefined();
    assertTransparentDepthPolicy(shockwave as TransparentObject);

    particleSystem.createExplosion(new THREE.Vector3(), 1);
    const particleGroup = scene.getObjectByName('particles');
    expect(particleGroup).toBeDefined();
    for (const child of particleGroup?.children ?? []) {
      assertTransparentDepthPolicy(child as TransparentObject);
    }

    const trailLines = scene.children.filter((child): child is THREE.Line => child instanceof THREE.Line);
    expect(trailLines).toHaveLength(2);
    for (const line of trailLines) {
      assertTransparentDepthPolicy(line as TransparentObject);
    }

    trail.dispose();
    particleSystem.dispose();
    vi.restoreAllMocks();
  });
});
