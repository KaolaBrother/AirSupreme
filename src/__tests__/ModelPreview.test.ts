import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOSS_CONFIGS,
  BossType,
  getBossForLevel,
  type BossConfig,
} from '@/features/boss/BossTypes';
import { setLocale } from '@/i18n';
import { ModelPreview } from '@/ui/ModelPreview';
import { resetLocale } from './i18nTestUtils';

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

/**
 * 打磨批次 Q：取景用名称标签的布局框——模型（及其包围球：任何模型绕竖轴转动都不出球）投影后
 * 整个落在标签上方的画布区域里，不与标签重叠、不出画布；标签变高（换行）时模型随之上移缩小，
 * 语言切换改变标签高度、窗口尺寸变化时重新取景。
 * jsdom 不做布局：画布容器尺寸与标签布局框（相对画布容器）用实例属性模拟。
 */
describe('ModelPreview frames the model above the name label (polish batch Q)', () => {
  interface Layout {
    width: number;
    height: number;
    labelTop: number;
    labelHeight: number;
  }
  interface Extent {
    top: number;
    bottom: number;
    left: number;
    right: number;
  }

  const ONE_LINE: Layout = { width: 1024, height: 600, labelTop: 534, labelHeight: 46 };
  const WRAPPED: Layout = { width: 1024, height: 600, labelTop: 456, labelHeight: 124 };
  const TURN_STEPS = 48;
  /** 球面均匀采样方向（斐波那契球） */
  const SPHERE_DIRECTIONS: THREE.Vector3[] = Array.from({ length: 1500 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 1500;
    const ring = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    return new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring);
  });

  let preview: ModelPreview;
  let layout: Layout;

  function layoutProperty(element: HTMLElement, key: string, read: () => number): void {
    Object.defineProperty(element, key, { configurable: true, get: read });
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    factoryCalls.length = 0;
    createdModels.length = 0;
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    preview = new ModelPreview();
    layout = { ...ONE_LINE };
    const container = document.getElementById('canvas-container') as HTMLElement;
    const label = document.getElementById('aircraft-name') as HTMLElement;
    layoutProperty(container, 'clientWidth', () => layout.width);
    layoutProperty(container, 'clientHeight', () => layout.height);
    layoutProperty(label, 'offsetTop', () => layout.labelTop);
    layoutProperty(label, 'offsetHeight', () => layout.labelHeight);
  });

  afterEach(() => {
    preview.dispose();
    vi.unstubAllGlobals();
    resetLocale();
    document.body.innerHTML = '';
  });

  /** 打开预览并等模型载入；首帧 rAF 里的 resizeRenderer 由 resize 事件代替 */
  async function open(): Promise<void> {
    preview.show();
    await settle();
    expect(createdModels.length).toBeGreaterThan(0);
    window.dispatchEvent(new Event('resize'));
  }

  function currentModel(): { model: THREE.Group; turntable: THREE.Object3D } {
    const model = createdModels[createdModels.length - 1] as THREE.Group;
    let turntable: THREE.Object3D = model;
    while (turntable.parent && !(turntable.parent instanceof THREE.Scene)) {
      turntable = turntable.parent;
    }
    expect(turntable.parent, 'the model is in the preview scene').toBeInstanceOf(THREE.Scene);
    return { model, turntable };
  }

  /** 模型绕竖轴转一整圈（与渲染循环一样转外层组），投影到画布的像素范围 */
  function projectedExtent(of: 'vertices' | 'bounding sphere'): Extent {
    // 渲染器每帧更新相机矩阵；这里手动做一次
    const camera = (preview as unknown as { camera: THREE.PerspectiveCamera }).camera;
    camera.updateMatrixWorld();
    const { model, turntable } = currentModel();
    const extent: Extent = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
    const point = new THREE.Vector3();
    const sphere = new THREE.Sphere();
    const add = (world: THREE.Vector3): void => {
      point.copy(world).project(camera);
      const x = ((point.x + 1) / 2) * layout.width;
      const y = ((1 - point.y) / 2) * layout.height;
      extent.left = Math.min(extent.left, x);
      extent.right = Math.max(extent.right, x);
      extent.top = Math.min(extent.top, y);
      extent.bottom = Math.max(extent.bottom, y);
    };
    const yaw = turntable.rotation.y;
    for (let step = 0; step < TURN_STEPS; step++) {
      turntable.rotation.y = (step / TURN_STEPS) * Math.PI * 2;
      turntable.updateMatrixWorld(true);
      model.traverse((object) => {
        const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
        const position = geometry?.getAttribute('position');
        if (!geometry || !position) return;
        if (of === 'vertices') {
          for (let i = 0; i < position.count; i++) {
            add(
              new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld)
            );
          }
          return;
        }
        geometry.computeBoundingSphere();
        sphere.copy(geometry.boundingSphere as THREE.Sphere).applyMatrix4(object.matrixWorld);
        for (const direction of SPHERE_DIRECTIONS) {
          add(direction.clone().multiplyScalar(sphere.radius).add(sphere.center));
        }
      });
    }
    turntable.rotation.y = yaw;
    turntable.updateMatrixWorld(true);
    return extent;
  }

  function expectAboveTheLabel(where: string): void {
    for (const of of ['vertices', 'bounding sphere'] as const) {
      const extent = projectedExtent(of);
      expect(extent.bottom, `${where} (${of}): clear of the label`).toBeLessThan(layout.labelTop);
      expect(extent.top, `${where} (${of}): inside the canvas top`).toBeGreaterThan(0);
      expect(extent.left, `${where} (${of}): inside the canvas left`).toBeGreaterThan(0);
      expect(extent.right, `${where} (${of}): inside the canvas right`).toBeLessThan(layout.width);
    }
  }

  it.each<[string, Layout]>([
    ['desktop, one-line label', ONE_LINE],
    ['desktop, label wrapped to three lines', WRAPPED],
    ['portrait phone, two-line label', { width: 312, height: 470, labelTop: 394, labelHeight: 64 }],
    ['short landscape viewport', { width: 520, height: 280, labelTop: 230, labelHeight: 40 }],
  ])('%s: the model stays above the label over a full turn', async (where, size) => {
    layout = { ...size };
    await open();
    expectAboveTheLabel(where);
  });

  it('reserves the label height: a taller label lifts and shrinks the framing', async () => {
    await open();
    const oneLine = projectedExtent('bounding sphere');

    layout = { ...WRAPPED };
    window.dispatchEvent(new Event('resize'));
    const wrapped = projectedExtent('bounding sphere');
    expect(wrapped.bottom).toBeLessThan(oneLine.bottom);
    expect(wrapped.bottom - wrapped.top).toBeLessThan(oneLine.bottom - oneLine.top);
    expect(
      oneLine.bottom,
      'the one-line framing would reach into the wrapped label'
    ).toBeGreaterThan(WRAPPED.labelTop);
    expectAboveTheLabel('wrapped label');
  });

  it('re-frames after a language switch changes the label height', async () => {
    // 标签按当前文字布局：中文名在这里换成三行
    const label = document.getElementById('aircraft-name') as HTMLElement;
    const wrapsNow = (): boolean => /[一-鿿]/.test(label.textContent ?? '');
    layoutProperty(label, 'offsetTop', () => (wrapsNow() ? WRAPPED : ONE_LINE).labelTop);
    layoutProperty(label, 'offsetHeight', () => (wrapsNow() ? WRAPPED : ONE_LINE).labelHeight);

    await open();
    expect(label.textContent).toBe('Player jet');
    expectAboveTheLabel('English name');

    setLocale('zh-CN');
    expect(label.textContent).toBe('玩家飞机');
    layout = { ...WRAPPED };
    expectAboveTheLabel('Chinese name');
  });

  it('re-frames on a window resize (desktop to portrait phone)', async () => {
    await open();
    layout = { width: 312, height: 470, labelTop: 394, labelHeight: 64 };
    window.dispatchEvent(new Event('resize'));
    expectAboveTheLabel('portrait phone after resize');
  });
});
