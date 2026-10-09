import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GameConfig, type QualityPreset } from '@/config';
import { getLevelConfig, type LevelConfig } from '@/features/terrain/LevelConfig';
import { TerrainGenerator } from '@/features/terrain/TerrainGenerator';

/**
 * 地形细节与清理（TerrainGenerator / worldscape，终验修复 F4a）：
 * - 植被密度随画质档：'performance'（以及移动端）低于 'quality'；
 * - 清空关卡 / 重新生成关卡时，上一关创建的几何体与材质全部释放（three 内置的精灵平面几何体
 *   与标记 userData.sharedResource 的共享资源除外），地形组清空。
 * 注意：jsdom 里 GameConfig.isMobile 默认为 true，桌面用例需显式设为 false。
 */

function level(id: number): LevelConfig {
  const config = getLevelConfig(id);
  expect(config, `level ${id}`).toBeTruthy();
  return config as LevelConfig;
}

/** 植被分块（LOD）近景层的实例总数（每块只算全细节的那一级） */
function nearVegetationInstances(scene: THREE.Scene): number {
  let total = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.LOD) || object.name !== 'vegetationTile') return;
    object.levels[0]?.object.traverse((child) => {
      if (child instanceof THREE.InstancedMesh) total += child.count;
    });
  });
  return total;
}

interface Tracked {
  label: string;
  disposed: boolean;
}

/** 给场景里（地形创建的）每个几何体 / 材质的 dispose 挂上记录 */
function trackDisposables(scene: THREE.Scene): Map<object, Tracked> {
  const tracked = new Map<object, Tracked>();
  const track = (resource: { dispose(): void }, label: string): void => {
    if (tracked.has(resource)) return;
    const entry: Tracked = { label, disposed: false };
    tracked.set(resource, entry);
    const original = resource.dispose.bind(resource);
    resource.dispose = () => {
      entry.disposed = true;
      original();
    };
  };
  scene.traverse((object) => {
    if (object.userData.sharedResource === true) return;
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    const where = `${object.type} "${object.name || object.parent?.name || ''}"`;
    // 精灵共用 three 内置的平面几何体（不属于地形，不应释放）
    if (renderable.geometry && !(object instanceof THREE.Sprite)) {
      if (renderable.geometry.userData.sharedResource !== true) {
        track(renderable.geometry, `geometry of ${where}`);
      }
    }
    const materials = renderable.material
      ? Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material]
      : [];
    for (const material of materials) {
      if (material.userData.sharedResource !== true) {
        track(material, `${material.type} of ${where}`);
      }
    }
  });
  return tracked;
}

function undisposed(tracked: Map<object, Tracked>): string[] {
  const counts = new Map<string, number>();
  for (const entry of tracked.values()) {
    if (!entry.disposed) counts.set(entry.label, (counts.get(entry.label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => `${label} ×${count}`);
}

function terrainGroup(scene: THREE.Scene): THREE.Object3D | undefined {
  return scene.children.find((child) => child.name === 'terrain');
}

describe('terrain detail and cleanup', () => {
  let originalIsMobile: boolean;
  let originalPreset: QualityPreset;

  beforeAll(() => {
    originalIsMobile = GameConfig.isMobile;
    originalPreset = GameConfig.getQualityPreset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    GameConfig.isMobile = originalIsMobile;
    GameConfig.setQualityPreset(originalPreset);
  });

  function build(levelId: number, mobile: boolean, preset: QualityPreset) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    GameConfig.isMobile = mobile;
    GameConfig.setQualityPreset(preset);
    GameConfig.clearRuntimeQualityOverride();
    const scene = new THREE.Scene();
    const generator = new TerrainGenerator(scene);
    generator.generateTerrain(level(levelId));
    return { scene, generator };
  }

  describe('vegetation density follows the quality preset (level 1, the forested lake)', () => {
    const density: Partial<Record<'quality' | 'performance' | 'mobile', number>> = {};

    beforeAll(() => {
      for (const [key, mobile, preset] of [
        ['quality', false, 'quality'],
        ['performance', false, 'performance'],
        ['mobile', true, 'quality'],
      ] as const) {
        const { scene, generator } = build(1, mobile, preset);
        density[key] = nearVegetationInstances(scene);
        generator.clearTerrain();
        vi.restoreAllMocks();
      }
    });

    it('builds vegetation at every preset', () => {
      expect(density.quality).toBeGreaterThan(0);
      expect(density.performance).toBeGreaterThan(0);
      expect(density.mobile).toBeGreaterThan(0);
    });

    it("'performance' is sparser than 'quality'", () => {
      expect(density.performance as number).toBeLessThan(density.quality as number);
    });

    it("mobile is sparser than 'quality', whatever preset is chosen", () => {
      expect(density.mobile as number).toBeLessThan(density.quality as number);
    });
  });

  describe('clearing a level disposes what it created', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('level %i', (levelId) => {
      const { scene, generator } = build(levelId, false, 'balanced');
      const tracked = trackDisposables(scene);
      expect(tracked.size).toBeGreaterThan(0);

      generator.clearTerrain();

      expect(undisposed(tracked)).toEqual([]);
      expect(terrainGroup(scene)?.children ?? []).toEqual([]);
    });
  });

  it('regenerating disposes the previous level (city → lake)', () => {
    const { scene, generator } = build(5, false, 'balanced');
    const tracked = trackDisposables(scene);

    generator.generateTerrain(level(1));

    expect(undisposed(tracked)).toEqual([]);
    expect(nearVegetationInstances(scene)).toBeGreaterThan(0);
    generator.clearTerrain();
  });
});
