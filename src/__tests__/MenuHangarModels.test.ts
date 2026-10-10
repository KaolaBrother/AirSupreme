import * as THREE from 'three';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { Faction } from '@/core/Faction';
import {
  createEnemyMesh,
  createFriendlyMesh,
  createPlayerMesh,
} from '@/features/aircraft/AircraftMeshFactory';
import { BossType } from '@/features/boss/BossTypes';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { WINGMAN_CONFIG } from '@/features/enemy/FriendlyAI';
import { StartMenu } from '@/ui/StartMenu';
import { resetLocale } from './i18nTestUtils';
import {
  byId,
  click,
  installAnimationFrames,
  isShown,
  last,
  prepareMenuEnvironment,
  press,
  resetMenuEnvironment,
  settle,
  settleUntil,
  useMenuFakeTimers,
  watchUnhandledRejections,
  type AnimationFrames,
  type RejectionWatch,
} from './menuTestUtils';

/**
 * 批次 X5 追加 · 机库与标题主机里的真实模型。
 *
 * 模型工厂在这里一个都不替身（与对局同源），只有 three 的 WebGLRenderer / PMREMGenerator 是假的：
 * - 22 个模型（玩家机、友军僚机、8 种敌机、10 个 Boss、2 种导弹）每一个都能载入并显示，转一整圈
 *   也不出展台、不压到名称标签；
 * - 僚机那一页是友军自己的机体，八种敌机各是各的机体（新加的干扰机 / 导弹攻击机 / 幽灵机也是）；
 * - 机库和标题主机里看不到那四个按包围盒摆放的信号灯小球；隐藏的只是这一份模型实例，
 *   对局用同一个工厂造出来的飞机照样带着亮着的信号灯，共享的几何体 / 材质没有被动过。
 */

interface FakeRenderer {
  domElement: HTMLCanvasElement;
  frames: Array<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera }>;
  disposed: number;
  contextLosses: number;
}

const gl = vi.hoisted(() => ({ renderers: [] as unknown[] }));

function liveRenderers(): FakeRenderer[] {
  return (gl.renderers as FakeRenderer[]).filter(
    (renderer) => renderer.disposed === 0 && renderer.contextLosses === 0
  );
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    public readonly domElement = document.createElement('canvas');
    public readonly shadowMap = { enabled: false };
    public toneMapping = 0;
    public toneMappingExposure = 1;
    public readonly frames: Array<{ scene: unknown; camera: unknown }> = [];
    public disposed = 0;
    public contextLosses = 0;

    constructor() {
      gl.renderers.push(this);
    }
    public setClearColor(): void {}
    public setPixelRatio(): void {}
    public setSize(): void {}
    public compile(): void {}
    public render(scene: unknown, camera: unknown): void {
      this.frames.push({ scene, camera });
    }
    public dispose(): void {
      this.disposed++;
    }
    public forceContextLoss(): void {
      this.contextLosses++;
    }
  }
  class FakePMREMGenerator {
    public fromScene(): { texture: unknown; dispose: () => void } {
      return { texture: new actual.Texture(), dispose: () => undefined };
    }
    public dispose(): void {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer, PMREMGenerator: FakePMREMGenerator };
});

/** 机体上按包围盒摆放的四个信号灯（AircraftMeshFactory 给它们起的名字，对局里按这些名字识别） */
const SIGNAL_LIGHTS = ['navLightPort', 'navLightStarboard', 'strobeLight', 'beaconLight'];

function signalLights(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (SIGNAL_LIGHTS.includes(object.name)) {
      found.push(object as THREE.Mesh);
    }
  });
  return found;
}

/** 渲染器真会画的网格：自己和所有祖先都 visible */
function drawnMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverseVisible((object) => {
    if ((object as THREE.Mesh).isMesh) {
      meshes.push(object as THREE.Mesh);
    }
  });
  return meshes;
}

function isDrawn(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) {
      return false;
    }
  }
  return true;
}

const WINGMAN_NAME = 'Allied Wingman';

/**
 * 机库里八种敌机该有的先后与英文名称（原有五种在前，这一轮新加的三种跟在后面）：
 * 写在这里，不从机库自己的数组里抄。
 */
const ENEMY_PAGES: ReadonlyArray<{ name: string; type: EnemyType }> = [
  { name: 'Scout', type: EnemyType.SCOUT },
  { name: 'Fighter', type: EnemyType.FIGHTER },
  { name: 'Heavy Bomber', type: EnemyType.HEAVY },
  { name: 'Sniper', type: EnemyType.SNIPER },
  { name: 'Ace', type: EnemyType.ACE },
  { name: 'Jammer', type: EnemyType.JAMMER },
  { name: 'Striker', type: EnemyType.STRIKER },
  { name: 'Wraith', type: EnemyType.WRAITH },
];

/** 对局里造飞机的方式：直接调工厂（僚机用对局里那一份僚机配置）。按机库里显示的英文名称索引 */
const GAME_AIRCRAFT: ReadonlyArray<{ name: string; build: () => THREE.Group }> = [
  { name: 'Player jet', build: () => createPlayerMesh() },
  { name: WINGMAN_NAME, build: () => createFriendlyMesh(WINGMAN_CONFIG) },
  ...ENEMY_PAGES.map(({ name, type }) => ({
    name,
    build: () => createEnemyMesh(ENEMY_CONFIGS[type]),
  })),
];

/** 玩家机、友军僚机、敌机、Boss、两种导弹 */
const MODEL_COUNT = 1 + 1 + ENEMY_PAGES.length + Object.values(BossType).length + 2;

/** 一个模型的“身形”：多少个网格、一共多少个顶点（隐藏的部件也算——机库只是不画信号灯） */
function shapeOf(root: THREE.Object3D): string {
  let meshes = 0;
  let vertices = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      meshes++;
      vertices += mesh.geometry.getAttribute('position')?.count ?? 0;
    }
  });
  return `${meshes} meshes / ${vertices} vertices`;
}

/** 模型树里声明了阵营的那个节点（机体工厂写在自己造的根节点上） */
function airframeOf(root: THREE.Object3D): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (!found && object.userData.faction !== undefined) {
      found = object;
    }
  });
  return found;
}

/**
 * 这里的模型模块都是真的：第一次翻到某一页，要经 vite-node 把那个模型的模块取回、转换，花的是
 * 真实时间（Boss 那几个不小），机器一忙就更久。等待按时间兜底，用例与钩子的超时也相应放宽——
 * 默认的 5 秒是给不做真实 I/O 的用例定的。
 */
const LOAD_BUDGET_MS = 20_000;
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

describe('Hangar and title hero with the real models (batch X5 follow-up)', () => {
  let menu: StartMenu | null = null;
  let frames: AnimationFrames;
  let originalIsMobile: boolean;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let rejections: RejectionWatch;

  function createMenu(): StartMenu {
    menu = new StartMenu();
    return menu;
  }

  function isHangarOpen(): boolean {
    return isShown(document.getElementById('model-preview'));
  }

  function modelName(): string {
    return (byId('aircraft-name').textContent ?? '').trim();
  }

  function page(): { index: number; total: number } {
    const text = byId('page-indicator').textContent ?? '';
    const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
    expect(match, `page indicator "${text}"`).not.toBeNull();
    return { index: Number(match?.[1]), total: Number(match?.[2]) };
  }

  async function modelLoaded(): Promise<void> {
    await settleUntil(() => !/loading|加载中/i.test(modelName()), 500, LOAD_BUDGET_MS);
    await settle(2);
  }

  async function openHangar(): Promise<void> {
    click('preview-btn');
    await settleUntil(() => isHangarOpen(), 500, LOAD_BUDGET_MS);
    expect(isHangarOpen(), 'the Hangar opened').toBe(true);
    await modelLoaded();
    frames.run();
  }

  async function nextModel(): Promise<void> {
    click('next-btn');
    await modelLoaded();
  }

  function hangarFrame(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    const renderer = last(liveRenderers());
    expect(renderer, 'the Hangar has a renderer').toBeDefined();
    frames.run();
    const frame = renderer ? last(renderer.frames) : undefined;
    expect(frame, 'a frame was drawn').toBeDefined();
    return frame as { scene: THREE.Scene; camera: THREE.PerspectiveCamera };
  }

  /** 展台上的模型（最外层的转台组；灯光不是 Group） */
  function stageModels(): THREE.Object3D[] {
    return hangarFrame().scene.children.filter((child) => child.type === 'Group');
  }

  /** 从第一页起把每个模型看一遍 */
  async function visitEveryModel(
    visit: (model: THREE.Object3D, name: string, index: number) => void
  ): Promise<void> {
    const { total } = page();
    for (let index = 1; index <= total; index++) {
      expect(page().index).toBe(index);
      const models = stageModels();
      expect(models, `page ${index} (${modelName()}): one model on the stage`).toHaveLength(1);
      visit(models[0], modelName(), index);
      if (index < total) {
        await nextModel();
      }
    }
  }

  beforeAll(async () => {
    // 机库与标题主机的模块先各载入一次。各个模型自己的模块（Boss、导弹）仍是哪个用例第一次翻到
    // 那一页就由哪个用例载入：modelLoaded() 按时间等，不靠预热
    await import('@/ui/ModelPreview');
    await import('@/ui/menu/MenuHeroScene');
  });

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    GameConfig.isMobile = false;
    prepareMenuEnvironment();
    frames = installAnimationFrames();
    gl.renderers.length = 0;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    rejections = watchUnhandledRejections();
  });

  afterEach(async () => {
    menu?.dispose();
    menu = null;
    await settle(2);
    rejections.stop();
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    resetMenuEnvironment();
    expect(rejections.seen, 'no unhandled promise rejection').toEqual([]);
  });

  describe('every model loads and is displayed', () => {
    it('offers the player jet, the wingman, every enemy, every boss and both missiles', async () => {
      createMenu();
      await openHangar();

      expect(ENEMY_PAGES.map((enemy) => enemy.type).sort()).toEqual(
        Object.values(EnemyType).sort()
      );
      expect(MODEL_COUNT).toBe(22);
      expect(page()).toEqual({ index: 1, total: MODEL_COUNT });
    });

    it('each of them loads under its own name and puts visible geometry on the stage', async () => {
      createMenu();
      await openHangar();
      const names: string[] = [];
      const bounds = new THREE.Box3();

      await visitEveryModel((model, name, index) => {
        const where = `page ${index} (${name})`;
        expect(name, where).toMatch(/\S/);
        expect(name, where).not.toMatch(/loading|could not load|加载/i);
        names.push(name);

        const meshes = drawnMeshes(model);
        expect(meshes.length, `${where}: visible meshes`).toBeGreaterThan(0);
        const vertices = meshes.reduce(
          (sum, mesh) => sum + (mesh.geometry.getAttribute('position')?.count ?? 0),
          0
        );
        expect(vertices, `${where}: vertices to draw`).toBeGreaterThan(8);

        // 取景后的模型有一个有限、非空的范围（没有 NaN / Infinity 的缩放或位置）
        model.updateMatrixWorld(true);
        bounds.makeEmpty();
        for (const mesh of meshes) {
          mesh.geometry.computeBoundingBox();
          bounds.union(
            (mesh.geometry.boundingBox as THREE.Box3).clone().applyMatrix4(mesh.matrixWorld)
          );
        }
        const size = bounds.getSize(new THREE.Vector3());
        for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
          expect(Number.isFinite(value), `${where}: finite bounds`).toBe(true);
        }
        expect(Math.max(size.x, size.y, size.z), `${where}: has a size`).toBeGreaterThan(0);
      });

      expect(names).toHaveLength(MODEL_COUNT);
      expect(new Set(names).size, `every page shows a different model: ${names.join(', ')}`).toBe(
        MODEL_COUNT
      );
      expect(consoleError, 'no model failed to load').not.toHaveBeenCalled();
    });

    it('wraps round after the last one and still shows the first', async () => {
      createMenu();
      await openHangar();
      const first = modelName();

      click('prev-btn');
      await modelLoaded();
      expect(page().index).toBe(MODEL_COUNT);
      expect(stageModels()).toHaveLength(1);
      await nextModel();

      expect(page().index).toBe(1);
      expect(modelName()).toBe(first);
      expect(drawnMeshes(stageModels()[0]).length).toBeGreaterThan(0);
    });

    describe('the aircraft pages show the airframes the game flies', () => {
      /** 这一轮新加的三种敌机 */
      const NEW_JETS: readonly EnemyType[] = [
        EnemyType.JAMMER,
        EnemyType.STRIKER,
        EnemyType.WRAITH,
      ];

      function kindShown(): string {
        return (byId('aircraft-type').textContent ?? '').trim();
      }

      it('precondition: the game builds ten different airframes', () => {
        const shapes = GAME_AIRCRAFT.map((aircraft) => shapeOf(aircraft.build()));

        expect(GAME_AIRCRAFT).toHaveLength(10);
        expect(new Set(shapes).size, shapes.join(' | ')).toBe(GAME_AIRCRAFT.length);
      });

      it('the wingman has the second page and its own allied airframe, not an enemy jet', async () => {
        createMenu();
        await openHangar();
        await nextModel();

        expect(page().index).toBe(2);
        expect(modelName()).toBe(WINGMAN_NAME);
        expect(kindShown()).toBe('Ally');
        const [model] = stageModels();
        const airframe = airframeOf(model);
        expect(airframe, 'the model declares whose side it is on').toBeDefined();
        expect(airframe?.userData.faction).toBe(Faction.FRIENDLY);
        expect(shapeOf(model), 'the airframe the game gives a wingman').toBe(
          shapeOf(createFriendlyMesh(WINGMAN_CONFIG))
        );
        for (const enemy of ENEMY_PAGES) {
          expect(shapeOf(model), `not the ${enemy.name} airframe`).not.toBe(
            shapeOf(createEnemyMesh(ENEMY_CONFIGS[enemy.type]))
          );
        }
        expect(shapeOf(model), 'not the player jet either').not.toBe(shapeOf(createPlayerMesh()));
        expect(consoleError).not.toHaveBeenCalled();
      });

      it('the eight enemy jets follow, each on its own page with the airframe of its type', async () => {
        createMenu();
        await openHangar();
        await nextModel();

        for (const [offset, enemy] of ENEMY_PAGES.entries()) {
          await nextModel();
          const where = `page ${offset + 3}`;
          expect(page().index).toBe(offset + 3);
          expect(modelName(), where).toBe(enemy.name);
          const [model] = stageModels();
          const airframe = airframeOf(model);
          expect(airframe?.userData.faction, `${where} (${enemy.name}): hostile`).toBe(
            Faction.ENEMY
          );
          expect(airframe?.name, `${where} (${enemy.name}): the airframe of that type`).toBe(
            enemy.type
          );
          expect(shapeOf(model), `${where} (${enemy.name}): as the game builds it`).toBe(
            shapeOf(createEnemyMesh(ENEMY_CONFIGS[enemy.type]))
          );
        }

        // 敌机到此为止：下一页是第一个 Boss
        expect(kindShown()).toBe('Enemy');
        await nextModel();
        expect(kindShown(), `page ${page().index} (${modelName()})`).toBe('Boss');
        expect(consoleError).not.toHaveBeenCalled();
      });

      it.each(
        ENEMY_PAGES.filter((enemy) => NEW_JETS.includes(enemy.type)).map(
          (enemy) => [enemy.name, enemy] as const
        )
      )(
        'the %s is not a stand-in: its airframe is unlike the five older enemy jets',
        async (_name, enemy) => {
          const older = ENEMY_PAGES.filter((other) => !NEW_JETS.includes(other.type));
          expect(older).toHaveLength(5);
          createMenu();
          await openHangar();
          for (let turned = 0; turned < MODEL_COUNT && modelName() !== enemy.name; turned++) {
            await nextModel();
          }

          expect(modelName()).toBe(enemy.name);
          const [model] = stageModels();
          expect(drawnMeshes(model).length).toBeGreaterThan(0);
          for (const other of older) {
            expect(shapeOf(model), `not the ${other.name} airframe`).not.toBe(
              shapeOf(createEnemyMesh(ENEMY_CONFIGS[other.type]))
            );
          }
        }
      );
    });

    describe('stays in view while it turns', () => {
      interface Layout {
        width: number;
        height: number;
        labelTop: number;
        labelHeight: number;
      }
      const TURN_STEPS = 24;
      let layout: Layout;

      function layoutProperty(element: HTMLElement, key: string, read: () => number): void {
        Object.defineProperty(element, key, { configurable: true, get: read });
      }

      /** jsdom 不做布局：展台尺寸与名称标签的布局框（相对展台）用实例属性模拟，再触发一次重新取景 */
      function layOut(next: Layout): void {
        layout = next;
        const stage = byId('canvas-container');
        const label = byId('aircraft-name');
        layoutProperty(stage, 'clientWidth', () => layout.width);
        layoutProperty(stage, 'clientHeight', () => layout.height);
        layoutProperty(label, 'offsetTop', () => layout.labelTop);
        layoutProperty(label, 'offsetHeight', () => layout.labelHeight);
        window.dispatchEvent(new Event('resize'));
      }

      /** 模型的可见顶点（Sprite 光晕不算）在转台坐标系里的位置 */
      function visibleVertices(turntable: THREE.Object3D): Float32Array {
        turntable.updateMatrixWorld(true);
        const toTurntable = new THREE.Matrix4().copy(turntable.matrixWorld).invert();
        const local = new THREE.Matrix4();
        const instance = new THREE.Matrix4();
        const point = new THREE.Vector3();
        const coordinates: number[] = [];
        turntable.traverseVisible((object) => {
          if ((object as THREE.Sprite).isSprite) {
            return;
          }
          const position = (object as THREE.Mesh).geometry?.getAttribute('position');
          if (!position) {
            return;
          }
          const instanced = object as THREE.InstancedMesh;
          const copies = instanced.isInstancedMesh ? instanced.count : 1;
          for (let copy = 0; copy < copies; copy++) {
            local.multiplyMatrices(toTurntable, object.matrixWorld);
            if (instanced.isInstancedMesh) {
              instanced.getMatrixAt(copy, instance);
              local.multiply(instance);
            }
            for (let i = 0; i < position.count; i++) {
              point.fromBufferAttribute(position, i).applyMatrix4(local);
              coordinates.push(point.x, point.y, point.z);
            }
          }
        });
        return Float32Array.from(coordinates);
      }

      /** 转一整圈（与渲染循环一样转最外层的组），所有可见顶点投影到展台上的像素范围 */
      function extentOverATurn(turntable: THREE.Object3D): {
        left: number;
        right: number;
        top: number;
        bottom: number;
      } {
        const { camera } = hangarFrame();
        camera.updateMatrixWorld();
        const vertices = visibleVertices(turntable);
        expect(vertices.length).toBeGreaterThan(0);
        const viewProjection = new THREE.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse
        );
        const toClip = new THREE.Matrix4();
        const point = new THREE.Vector3();
        const extent = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
        const yaw = turntable.rotation.y;
        for (let step = 0; step < TURN_STEPS; step++) {
          turntable.rotation.y = (step / TURN_STEPS) * Math.PI * 2;
          turntable.updateMatrixWorld(true);
          toClip.multiplyMatrices(viewProjection, turntable.matrixWorld);
          for (let i = 0; i < vertices.length; i += 3) {
            point.set(vertices[i], vertices[i + 1], vertices[i + 2]).applyMatrix4(toClip);
            const x = ((point.x + 1) / 2) * layout.width;
            const y = ((1 - point.y) / 2) * layout.height;
            extent.left = Math.min(extent.left, x);
            extent.right = Math.max(extent.right, x);
            extent.top = Math.min(extent.top, y);
            extent.bottom = Math.max(extent.bottom, y);
          }
        }
        turntable.rotation.y = yaw;
        turntable.updateMatrixWorld(true);
        return extent;
      }

      it.each<[string, Layout]>([
        ['a desktop stage', { width: 1024, height: 600, labelTop: 534, labelHeight: 46 }],
        ['a portrait phone', { width: 312, height: 470, labelTop: 394, labelHeight: 64 }],
        ['a short landscape phone', { width: 520, height: 280, labelTop: 230, labelHeight: 40 }],
      ])(
        'on %s no model is cut off by the stage edges or runs under its name label',
        async (_where, size) => {
          createMenu();
          await openHangar();
          layOut(size);

          await visitEveryModel((model, name) => {
            const extent = extentOverATurn(model);
            expect(extent.left, `${name}: left edge`).toBeGreaterThan(0);
            expect(extent.right, `${name}: right edge`).toBeLessThan(layout.width);
            expect(extent.top, `${name}: top edge`).toBeGreaterThan(0);
            expect(extent.bottom, `${name}: clear of the name label`).toBeLessThan(layout.labelTop);
          });
        }
      );
    });
  });

  describe('signal lights', () => {
    it('precondition: a plane built for the game carries the four signal lights, lit', () => {
      for (const aircraft of GAME_AIRCRAFT) {
        const mesh = aircraft.build();
        const lights = signalLights(mesh);
        expect(lights.map((light) => light.name).sort(), aircraft.name).toEqual(
          [...SIGNAL_LIGHTS].sort()
        );
        expect(lights.every(isDrawn), `${aircraft.name}: all four are drawn`).toBe(true);
      }
    });

    it('the Hangar shows the player jet, the wingman and every enemy plane without them', async () => {
      createMenu();
      await openHangar();
      const seen: string[] = [];

      await visitEveryModel((model, name) => {
        if (!GAME_AIRCRAFT.some((aircraft) => aircraft.name === name)) {
          return;
        }
        seen.push(name);
        const lights = signalLights(model);
        expect(lights, `${name}: the lights are still part of the model`).toHaveLength(4);
        expect(lights.filter(isDrawn), `${name}: none of them is drawn`).toEqual([]);
      });

      expect(seen.sort()).toEqual(GAME_AIRCRAFT.map((aircraft) => aircraft.name).sort());
    });

    it('hides those four and nothing else of the plane', async () => {
      createMenu();
      await openHangar();
      let checked = 0;

      await visitEveryModel((model, name) => {
        const aircraft = GAME_AIRCRAFT.find((candidate) => candidate.name === name);
        if (!aircraft) {
          return;
        }
        checked++;
        const inGame = drawnMeshes(aircraft.build());
        const inHangar = drawnMeshes(model);
        expect(inHangar.length, `${name}: everything but the four lights is drawn`).toBe(
          inGame.length - SIGNAL_LIGHTS.length
        );
        expect(inHangar.some((mesh) => SIGNAL_LIGHTS.includes(mesh.name))).toBe(false);
      });

      expect(checked).toBe(GAME_AIRCRAFT.length);
    });

    it('bosses and missiles keep every part the Hangar is given: nothing of them is hidden by name', async () => {
      createMenu();
      await openHangar();

      await visitEveryModel((model, name) => {
        if (GAME_AIRCRAFT.some((aircraft) => aircraft.name === name)) {
          return;
        }
        expect(signalLights(model), `${name} has no such lights`).toEqual([]);
        expect(drawnMeshes(model).length, `${name}: drawn`).toBeGreaterThan(0);
      });
    });

    it('a plane built for the game after a Hangar visit still has its signal lights lit', async () => {
      createMenu();
      await openHangar();
      // 把每架飞机都在机库里看一遍，再关掉机库（关掉时模型被释放）
      for (let step = 0; step < GAME_AIRCRAFT.length; step++) {
        await nextModel();
      }
      press('Escape');
      expect(isHangarOpen()).toBe(false);

      for (const aircraft of GAME_AIRCRAFT) {
        const lights = signalLights(aircraft.build());
        expect(lights, aircraft.name).toHaveLength(4);
        for (const light of lights) {
          expect(isDrawn(light), `${aircraft.name} ${light.name}: drawn`).toBe(true);
          const material = light.material as THREE.Material;
          expect(material.visible, `${aircraft.name} ${light.name}: its material`).toBe(true);
        }
      }
    });

    it('leaves the shared light geometry and materials alone: same objects, never disposed', async () => {
      const before = GAME_AIRCRAFT.map((aircraft) => aircraft.build());
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      for (const light of before.flatMap(signalLights)) {
        geometries.add(light.geometry);
        materials.add(light.material as THREE.Material);
      }
      const disposed = vi.fn();
      geometries.forEach((geometry) => geometry.addEventListener('dispose', disposed));
      materials.forEach((material) => material.addEventListener('dispose', disposed));

      createMenu();
      await openHangar();
      for (let step = 0; step < GAME_AIRCRAFT.length; step++) {
        await nextModel();
      }
      press('Escape');

      try {
        expect(disposed).not.toHaveBeenCalled();
        // 之前就造好的飞机（对局里的那些）没有被机库碰过
        for (const mesh of before) {
          expect(signalLights(mesh).every(isDrawn)).toBe(true);
        }
        // 之后造的飞机用的还是同一套共享资源
        for (const light of GAME_AIRCRAFT.flatMap((aircraft) => signalLights(aircraft.build()))) {
          expect(geometries.has(light.geometry), `${light.name}: shared geometry`).toBe(true);
          expect(
            materials.has(light.material as THREE.Material),
            `${light.name}: shared material`
          ).toBe(true);
        }
      } finally {
        geometries.forEach((geometry) => geometry.removeEventListener('dispose', disposed));
        materials.forEach((material) => material.removeEventListener('dispose', disposed));
      }
    });

    describe('on the title screen', () => {
      async function letHeroArrive(): Promise<void> {
        for (let i = 0; i < 4; i++) {
          await vi.advanceTimersByTimeAsync(500);
          await settle();
        }
      }

      beforeEach(() => {
        useMenuFakeTimers();
        vi.stubGlobal('WebGLRenderingContext', class {});
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720);
      });

      function heroScene(): THREE.Scene {
        const renderer = last(liveRenderers());
        expect(renderer, 'the hero has a renderer').toBeDefined();
        expect(byId('start-menu').contains((renderer as FakeRenderer).domElement)).toBe(true);
        const frame = last((renderer as FakeRenderer).frames);
        expect(frame, 'the hero drew a frame').toBeDefined();
        return (frame as { scene: THREE.Scene }).scene;
      }

      it('the hero jet flies without the signal-light balls', async () => {
        createMenu();
        await letHeroArrive();

        const lights = signalLights(heroScene());
        expect(lights.map((light) => light.name).sort()).toEqual([...SIGNAL_LIGHTS].sort());
        expect(lights.filter(isDrawn)).toEqual([]);
      });

      it('and the rest of the jet is drawn', async () => {
        createMenu();
        await letHeroArrive();

        const jet = signalLights(heroScene())[0].parent as THREE.Object3D;
        expect(isDrawn(jet)).toBe(true);
        expect(drawnMeshes(jet).length).toBeGreaterThan(10);
      });

      it('a plane built for the game while or after the hero flies has its lights lit', async () => {
        const startMenu = createMenu();
        await letHeroArrive();
        expect(signalLights(heroScene()).filter(isDrawn)).toEqual([]);

        const during = createPlayerMesh();
        startMenu.hide();
        const after = createPlayerMesh();

        for (const mesh of [during, after]) {
          const lights = signalLights(mesh);
          expect(lights).toHaveLength(4);
          expect(lights.every(isDrawn)).toBe(true);
          expect(lights.every((light) => (light.material as THREE.Material).visible)).toBe(true);
        }
      });
    });
  });
});
