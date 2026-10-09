import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOSS_CONFIGS,
  BossType,
  getBossForLevel,
  type BossConfig,
} from '@/features/boss/BossTypes';
import { ModelPreview } from '@/ui/ModelPreview';

/**
 * 模型预览（ModelPreview，终验修复 F3）：第 6-10 关的 Boss 用各自的模型工厂（与战斗中同源），
 * 不再退回第 1 关的重型轰炸机；切换模型时释放上一个模型（几何体 / 材质，并从场景移除）。
 * 渲染器换成假的（jsdom 没有 WebGL）；各模型工厂换成带标记的替身，记录被谁调用。
 */

const factoryCalls = vi.hoisted(() => [] as Array<{ factory: string; type: string | null }>);
const createdModels = vi.hoisted(() => [] as unknown[]);

/** 带标记的替身模型：一个盒子网格，几何体 / 材质的 dispose 可被观察 */
function taggedModel(factory: string, type: string | null): THREE.Group {
  factoryCalls.push({ factory, type });
  const group = new THREE.Group();
  createdModels.push(group);
  group.name = `preview:${factory}:${type ?? ''}`;
  group.userData.factory = factory;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshBasicMaterial()));
  return group;
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    readonly domElement = document.createElement('canvas');
    readonly shadowMap = { enabled: false };
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {}
    dispose(): void {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

vi.mock('@/features/aircraft/AircraftMeshFactory', () => ({
  createPlayerMesh: () => taggedModel('createPlayerMesh', null),
  createEnemyMesh: (config: { type: string }) => taggedModel('createEnemyMesh', config.type),
}));
vi.mock('@/features/boss/BossAI', () => ({
  createBossMesh: (config: BossConfig) => taggedModel('createBossMesh', config.type),
}));
vi.mock('@/features/boss/DesertFortressAI', () => ({
  createDesertFortressMesh: (config: BossConfig) =>
    taggedModel('createDesertFortressMesh', config.type),
}));
vi.mock('@/features/boss/OctopusWarshipAI', () => ({
  createOctopusWarshipMesh: (config: BossConfig) =>
    taggedModel('createOctopusWarshipMesh', config.type),
}));
vi.mock('@/features/boss/MissileDestroyerAI', () => ({
  createMissileDestroyerMesh: (config: BossConfig) =>
    taggedModel('createMissileDestroyerMesh', config.type),
}));
vi.mock('@/features/boss/SkyCarrierAI', () => ({
  createSkyCarrierMesh: (config: BossConfig) => taggedModel('createSkyCarrierMesh', config.type),
}));
vi.mock('@/features/boss/MagmaColossusMesh', () => ({
  createMagmaColossusMesh: (config: BossConfig) =>
    taggedModel('createMagmaColossusMesh', config.type),
}));
vi.mock('@/features/boss/AbyssalLeviathanMesh', () => ({
  createAbyssalLeviathanMesh: (config: BossConfig) =>
    taggedModel('createAbyssalLeviathanMesh', config.type),
}));
vi.mock('@/features/boss/TempestZeppelinMesh', () => ({
  createTempestZeppelinMesh: (config: BossConfig) =>
    taggedModel('createTempestZeppelinMesh', config.type),
}));
vi.mock('@/features/boss/PhantomWingMesh', () => ({
  createPhantomWingMesh: (config: BossConfig) => taggedModel('createPhantomWingMesh', config.type),
}));
vi.mock('@/features/boss/OraclePrimeMesh', () => ({
  createOraclePrimeMesh: (config: BossConfig) => taggedModel('createOraclePrimeMesh', config.type),
}));
vi.mock('@/features/combat/MissileSystem', () => ({
  createMissileVisualMesh: () => taggedModel('createMissileVisualMesh', null),
}));
vi.mock('@/features/boss/BossMissileSystem', () => ({
  createBossMissileVisualMesh: () => taggedModel('createBossMissileVisualMesh', null),
}));

/** 第 6-10 关 Boss 与战斗中使用的模型工厂 */
const OWN_FACTORY: Readonly<Partial<Record<BossType, string>>> = {
  [BossType.MAGMA_COLOSSUS]: 'createMagmaColossusMesh',
  [BossType.ABYSSAL_LEVIATHAN]: 'createAbyssalLeviathanMesh',
  [BossType.TEMPEST_ZEPPELIN]: 'createTempestZeppelinMesh',
  [BossType.PHANTOM_WING]: 'createPhantomWingMesh',
  [BossType.ORACLE_PRIME]: 'createOraclePrimeMesh',
};

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

function pageIndicator(): { index: number; total: number } {
  const text = document.getElementById('page-indicator')?.textContent ?? '';
  const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
  expect(match, `page indicator "${text}"`).not.toBeNull();
  return { index: Number(match?.[1]), total: Number(match?.[2]) };
}

function rootOf(object: THREE.Object3D): THREE.Object3D {
  let node = object;
  while (node.parent) node = node.parent;
  return node;
}

describe('ModelPreview', () => {
  let preview: ModelPreview;

  beforeEach(() => {
    document.body.innerHTML = '';
    factoryCalls.length = 0;
    createdModels.length = 0;
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    preview = new ModelPreview();
  });

  afterEach(() => {
    preview.dispose();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  /** 从第一个模型起逐个“下一个”，记录每页显示的模型（工厂替身产物） */
  async function browseAll(): Promise<void> {
    preview.show();
    await settle();
    const { total } = pageIndicator();
    const before = factoryCalls.length;
    expect(before).toBeGreaterThan(0);
    for (let page = 1; page < total; page++) {
      (document.getElementById('next-btn') as HTMLButtonElement).click();
      await settle();
      expect(pageIndicator().index).toBe(page + 1);
    }
  }

  it.each([6, 7, 8, 9, 10])(
    'shows the level %i boss with its own mesh factory, not the bomber fallback',
    async (level) => {
      const type = getBossForLevel(level) as BossType;
      expect(type).not.toBeNull();
      await browseAll();

      const own = OWN_FACTORY[type];
      expect(own, `${type} has a dedicated factory`).toBeDefined();
      const callsForType = factoryCalls.filter((call) => call.type === type);
      expect(callsForType.map((call) => call.factory)).toEqual([own]);
      expect(
        factoryCalls.filter((call) => call.factory === 'createBossMesh').map((call) => call.type),
        'only the level-1 heavy bomber uses createBossMesh'
      ).toEqual([BossType.HEAVY_BOMBER]);
    }
  );

  it('offers a preview of every boss', async () => {
    await browseAll();
    const bossCalls = factoryCalls.filter((call) => call.type && call.type in BOSS_CONFIGS);
    expect(new Set(bossCalls.map((call) => call.type))).toEqual(new Set(Object.values(BossType)));
  });

  it('disposes the previous model when switching to the next one', async () => {
    preview.show();
    await settle();
    expect(createdModels).toHaveLength(1);
    const previous = createdModels[0] as THREE.Group;
    const previousMesh = previous.children[0] as THREE.Mesh;
    const geometryDispose = vi.spyOn(previousMesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(previousMesh.material as THREE.Material, 'dispose');
    expect(rootOf(previous), 'shown in the preview scene').toBeInstanceOf(THREE.Scene);

    (document.getElementById('next-btn') as HTMLButtonElement).click();
    await settle();

    expect(createdModels).toHaveLength(2);
    expect(geometryDispose).toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalled();
    expect(rootOf(previous), 'removed from the preview scene').not.toBeInstanceOf(THREE.Scene);
    expect(rootOf(createdModels[1] as THREE.Group)).toBeInstanceOf(THREE.Scene);
  });
});
