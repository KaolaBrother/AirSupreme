import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { CloakFade } from '@/features/enemy/effects/CloakFade';
import {
  DEG,
  FleetRig,
  HullWatch,
  SIM_TEST_TIMEOUT,
  pointAround,
  renderablesOf,
  type Renderable,
} from './enemyFleetRig';

vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 隐形机淡出 / 淡入的材质处理（规格 §3 WRAITH：隐形时约 12–18% 不透明度、现形预警带红色眼灯；
 * 批次 E-A 的交接：敌机材质跨机体共享，隐形渐隐不能改共享材质），批次 E-X 里程碑 2。
 *
 * - 共享材质（按机型缓存的机身材质、模块级的信号灯 / 尾焰 / 目镜）从不被改动、从不被释放；
 * - 一架隐形机淡出时只改它自己的克隆，另一架同型机、别的机型完全不受影响；
 * - 完全可见时换回原来那一份材质（同一个对象）；克隆建一次、反复使用；
 * - 销毁时换回原材质并释放自己的克隆和眼灯，共享材质一个都不释放。
 *
 * 前半部分直接用 CloakFade（给一架真机体做淡出）；后半部分让真的 EnemyAI + 隐形机条令自己
 * 飞完隐形周期，从外面看材质。
 */

const CLOAK_LEVEL = 0.15;

function materialsOf(object: Renderable): THREE.Material[] {
  return Array.isArray(object.material) ? [...object.material] : [object.material];
}

/** 机体下（不含 exclude）所有可渲染对象现在用的材质（去重） */
function materialsIn(root: THREE.Object3D, exclude?: THREE.Object3D): THREE.Material[] {
  const found = new Set<THREE.Material>();
  for (const object of renderablesOf(root)) {
    if (object === exclude) continue;
    for (const material of materialsOf(object)) found.add(material);
  }
  return [...found];
}

/** 一份材质里会被淡出改到的那些属性，连同版本号（needsUpdate 会让它加一） */
function materialState(material: THREE.Material): string {
  const record = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
  };
  return JSON.stringify({
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    visible: material.visible,
    side: material.side,
    blending: material.blending,
    version: material.version,
    color: record.color ? record.color.getHex() : null,
    emissive: record.emissive ? record.emissive.getHex() : null,
    emissiveIntensity: record.emissiveIntensity ?? null,
  });
}

/** 盯着一组材质：记下现在的状态，并数每一份收到几次 dispose */
class MaterialLedger {
  private readonly states = new Map<THREE.Material, string>();
  private readonly disposals = new Map<THREE.Material, number>();
  private readonly listeners: Array<() => void> = [];

  constructor(materials: readonly THREE.Material[]) {
    for (const material of materials) {
      this.states.set(material, materialState(material));
      this.disposals.set(material, 0);
      const listener = (): void => {
        this.disposals.set(material, (this.disposals.get(material) ?? 0) + 1);
      };
      material.addEventListener('dispose', listener);
      this.listeners.push(() => material.removeEventListener('dispose', listener));
    }
  }

  /** 状态变了的材质（描述） */
  public changed(): string[] {
    const out: string[] = [];
    for (const [material, before] of this.states) {
      const now = materialState(material);
      if (now !== before) out.push(`${material.type} ${before} -> ${now}`);
    }
    return out;
  }

  public disposedCount(material: THREE.Material): number {
    return this.disposals.get(material) ?? 0;
  }

  public disposed(): THREE.Material[] {
    return [...this.disposals].filter(([, count]) => count > 0).map(([material]) => material);
  }

  public release(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }
}

const ledgers: MaterialLedger[] = [];
const fades: CloakFade[] = [];

function ledger(materials: readonly THREE.Material[]): MaterialLedger {
  const made = new MaterialLedger(materials);
  ledgers.push(made);
  return made;
}

function fadeOf(root: THREE.Object3D): CloakFade {
  const fade = new CloakFade(root);
  fades.push(fade);
  return fade;
}

function wraithMesh(): THREE.Group {
  return createEnemyMesh({ ...ENEMY_CONFIGS[EnemyType.WRAITH] });
}

/** 眼灯：CloakFade 挂到机体上的那个新对象 */
function flareOf(root: THREE.Object3D, known: ReadonlySet<THREE.Object3D>): Renderable {
  const added = renderablesOf(root).filter((object) => !known.has(object));
  expect(added.length, 'exactly one object added to the airframe (the eye flare)').toBe(1);
  return added[0];
}

afterEach(() => {
  for (const fade of fades) fade.dispose();
  fades.length = 0;
  for (const made of ledgers) made.release();
  ledgers.length = 0;
});

describe('CloakFade on a real Wraith airframe', () => {
  it('the airframes really do share their materials (the premise of everything below)', () => {
    const first = materialsIn(wraithMesh());
    const second = new Set(materialsIn(wraithMesh()));
    const fighter = new Set(materialsIn(createEnemyMesh({ ...ENEMY_CONFIGS[EnemyType.FIGHTER] })));
    expect(first.length).toBeGreaterThan(0);
    expect(
      first.every((material) => second.has(material)),
      'two Wraiths, same materials'
    ).toBe(true);
    expect(
      first.some((material) => fighter.has(material)),
      'some materials are shared with other types too'
    ).toBe(true);
  });

  it('fading one Wraith never touches the shared materials: another Wraith and a Fighter look exactly as before', () => {
    const fading = wraithMesh();
    const other = wraithMesh();
    const fighter = createEnemyMesh({ ...ENEMY_CONFIGS[EnemyType.FIGHTER] });
    const otherWatch = new HullWatch(other);
    const fighterWatch = new HullWatch(fighter);
    const shared = ledger([...new Set([...materialsIn(fading), ...materialsIn(fighter)])]);
    const fade = fadeOf(fading);

    for (const [opacity, flare] of [
      [0.9, 0],
      [0.5, 0],
      [CLOAK_LEVEL, 0],
      [CLOAK_LEVEL, 1],
      [0.6, 0.7],
      [1, 0.4],
      [1, 0],
    ]) {
      fade.apply(opacity, flare);
      expect(shared.changed(), `after apply(${opacity}, ${flare})`).toEqual([]);
      expect(otherWatch.usesOriginalMaterials(), 'the other Wraith').toBe(true);
      expect(otherWatch.opacityRange()).toEqual({ min: 1, max: 1 });
      expect(fighterWatch.usesOriginalMaterials(), 'the Fighter').toBe(true);
    }
    expect(shared.disposed()).toEqual([]);
  });

  it('while faded, every part of the airframe wears its own clone at base opacity times the fade', () => {
    const root = wraithMesh();
    const watch = new HullWatch(root);
    const known = new Set<THREE.Object3D>(watch.parts.map((part) => part.object));
    const originals = new Set(watch.originals());
    const fade = fadeOf(root);

    for (const factor of [0.8, 0.4, CLOAK_LEVEL]) {
      fade.apply(factor, 0);
      for (const part of watch.parts) {
        const now = materialsOf(part.object);
        expect(Array.isArray(part.object.material), 'array-ness kept').toBe(part.wasArray);
        expect(now.length).toBe(part.materials.length);
        now.forEach((material, index) => {
          expect(
            originals.has(material),
            `${part.object.name || part.object.type} wears a clone`
          ).toBe(false);
          expect(material.type, 'a clone of the same kind of material').toBe(
            part.materials[index].type
          );
          expect(material.opacity).toBeCloseTo(part.opacities[index] * factor, 9);
          expect(material.transparent, 'drawn as transparent').toBe(true);
          expect(material.depthWrite, 'does not hide what is behind it').toBe(false);
        });
      }
      const range = watch.opacityRange();
      expect(range.min).toBeCloseTo(factor, 9);
      expect(range.max).toBeCloseTo(factor, 9);
    }
    // 机体上只多了一个眼灯，没有别的东西
    flareOf(root, known);
    // 机体本身一直是可见的：碰撞、存活判定都读 visible
    expect(root.visible).toBe(true);
  });

  it('two Wraiths fading at once each get clones of their own', () => {
    const first = wraithMesh();
    const second = wraithMesh();
    const firstWatch = new HullWatch(first);
    const secondWatch = new HullWatch(second);
    fadeOf(first).apply(0.3, 0);
    fadeOf(second).apply(0.7, 0);
    const firstClones = new Set(firstWatch.foreignMaterials());
    const secondClones = secondWatch.foreignMaterials();
    expect(firstClones.size).toBeGreaterThan(0);
    expect(secondClones.some((material) => firstClones.has(material))).toBe(false);
    expect(firstWatch.opacityRange().max).toBeCloseTo(0.3, 9);
    expect(secondWatch.opacityRange().min).toBeCloseTo(0.7, 9);
  });

  it('fully visible again means the very same shared material objects as before, in the same slots', () => {
    const root = wraithMesh();
    const watch = new HullWatch(root);
    const fade = fadeOf(root);
    expect(fade.isFading()).toBe(false);

    fade.apply(CLOAK_LEVEL, 0);
    expect(fade.isFading()).toBe(true);
    expect(watch.usesOriginalMaterials()).toBe(false);

    fade.apply(1, 0);
    expect(fade.isFading()).toBe(false);
    expect(watch.usesOriginalMaterials()).toBe(true);
    expect(watch.foreignMaterials()).toEqual([]);
  });

  it('the clones are made once and reused, cycle after cycle and frame after frame', () => {
    const root = wraithMesh();
    const watch = new HullWatch(root);
    const fade = fadeOf(root);
    fade.apply(0.5, 0);
    const clones = new Set(watch.foreignMaterials());
    expect(clones.size).toBeGreaterThan(0);
    const cloneSpy = vi.spyOn(THREE.Material.prototype, 'clone');
    try {
      for (let cycle = 0; cycle < 4; cycle++) {
        for (let frame = 0; frame <= 30; frame++) fade.apply(1 - (frame / 30) * 0.85, 0);
        expect(new Set(watch.foreignMaterials())).toEqual(clones);
        fade.apply(1, 0);
      }
      expect(cloneSpy, 'no material cloned after the first fade').not.toHaveBeenCalled();
    } finally {
      cloneSpy.mockRestore();
    }
  });

  it('the red eye flare shows only while asked for, red, and grows with its strength', () => {
    const root = wraithMesh();
    const known = new Set<THREE.Object3D>(renderablesOf(root));
    const fade = fadeOf(root);
    fade.apply(CLOAK_LEVEL, 0);
    const flare = flareOf(root, known);
    expect(flare.visible, 'no flare at strength 0').toBe(false);

    fade.apply(0.4, 0.3);
    expect(flare.visible).toBe(true);
    const color = (flare.material as THREE.MeshBasicMaterial).color;
    expect(color.r, 'red').toBeGreaterThan(0.8);
    expect(color.g).toBeLessThan(0.35);
    expect(color.b).toBeLessThan(0.35);
    const weak = new THREE.Vector3();
    flare.getWorldScale(weak);

    fade.apply(0.4, 1);
    const strong = new THREE.Vector3();
    flare.getWorldScale(strong);
    expect(strong.x).toBeGreaterThan(weak.x);

    fade.apply(1, 0);
    expect(flare.visible, 'gone once the tell is over').toBe(false);
  });

  it('the flare is the Wraith’s own: it never wears a shared material', () => {
    const root = wraithMesh();
    const known = new Set<THREE.Object3D>(renderablesOf(root));
    const shared = new Set(materialsIn(root));
    const fade = fadeOf(root);
    fade.apply(0.5, 1);
    const flare = flareOf(root, known);
    for (const material of materialsOf(flare)) expect(shared.has(material)).toBe(false);
  });

  it.each([
    ['NaN', Number.NaN, Number.NaN],
    ['Infinity', Infinity, Infinity],
    ['-Infinity', -Infinity, -Infinity],
    ['below zero', -2, -1],
    ['above one', 7, 9],
  ])(
    'broken inputs (%s) never leave a non-finite or out-of-range opacity anywhere',
    (_name, opacity, flare) => {
      const root = wraithMesh();
      const fade = fadeOf(root);
      fade.apply(0.5, 0.5);
      fade.apply(opacity, flare);
      for (const object of renderablesOf(root)) {
        for (const material of materialsOf(object)) {
          expect(Number.isFinite(material.opacity), `${object.name || object.type}`).toBe(true);
          expect(material.opacity).toBeGreaterThanOrEqual(0);
          expect(material.opacity).toBeLessThanOrEqual(1);
        }
        expect(Number.isFinite(object.scale.x)).toBe(true);
      }
    }
  );
});

describe('CloakFade clean-up', () => {
  it('dispose hands the shared materials back, releases every clone once, and never a shared material', () => {
    const root = wraithMesh();
    const watch = new HullWatch(root);
    const known = new Set<THREE.Object3D>(watch.parts.map((part) => part.object));
    const shared = ledger(watch.originals());
    const fade = new CloakFade(root);
    fade.apply(CLOAK_LEVEL, 0.8);
    const clones = watch.foreignMaterials();
    const flare = flareOf(root, known);
    const flareMaterials = materialsOf(flare);
    const cloneLedger = ledger([...clones, ...flareMaterials]);
    const flareGeometry = (flare as unknown as THREE.Mesh).geometry;
    let geometryDisposed = 0;
    flareGeometry.addEventListener('dispose', () => geometryDisposed++);

    fade.dispose();

    expect(watch.usesOriginalMaterials(), 'shared materials back in place').toBe(true);
    expect(shared.disposed(), 'shared materials released').toEqual([]);
    expect(shared.changed()).toEqual([]);
    for (const clone of [...clones, ...flareMaterials]) {
      expect(cloneLedger.disposedCount(clone), `${clone.type} released once`).toBe(1);
    }
    expect(geometryDisposed, 'flare geometry released').toBe(1);
    expect(flare.parent, 'flare taken off the airframe').toBeNull();
    expect(renderablesOf(root).length).toBe(watch.parts.length);
  });

  it('after dispose it does nothing at all: no new clones, no flare, nothing released twice', () => {
    const root = wraithMesh();
    const watch = new HullWatch(root);
    const fade = new CloakFade(root);
    fade.apply(CLOAK_LEVEL, 1);
    const clones = watch.foreignMaterials();
    const cloneLedger = ledger(clones);
    fade.dispose();
    fade.apply(CLOAK_LEVEL, 1);
    fade.apply(0.5, 0.5);
    fade.dispose();
    expect(watch.usesOriginalMaterials()).toBe(true);
    expect(renderablesOf(root).length).toBe(watch.parts.length);
    for (const clone of clones) expect(cloneLedger.disposedCount(clone)).toBe(1);
  });

  it('a Wraith that never faded is cleaned up without cloning anything or releasing a shared material', () => {
    const root = wraithMesh();
    const watch = new HullWatch(root);
    const shared = ledger(watch.originals());
    const cloneSpy = vi.spyOn(THREE.Material.prototype, 'clone');
    try {
      const fade = new CloakFade(root);
      fade.apply(1, 0);
      fade.dispose();
      expect(cloneSpy).not.toHaveBeenCalled();
    } finally {
      cloneSpy.mockRestore();
    }
    expect(watch.usesOriginalMaterials()).toBe(true);
    expect(shared.disposed()).toEqual([]);
    expect(renderablesOf(root).length).toBe(watch.parts.length);
  });

  it('dispose while faded leaves the other Wraith untouched', () => {
    const fading = wraithMesh();
    const other = wraithMesh();
    const otherWatch = new HullWatch(other);
    const shared = ledger(otherWatch.originals());
    const fade = new CloakFade(fading);
    fade.apply(CLOAK_LEVEL, 1);
    fade.dispose();
    expect(otherWatch.usesOriginalMaterials()).toBe(true);
    expect(otherWatch.opacityRange()).toEqual({ min: 1, max: 1 });
    expect(shared.changed()).toEqual([]);
    expect(shared.disposed()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// 真的隐形机自己飞完隐形周期
// ---------------------------------------------------------------------------------------------

describe('a real Wraith flying its cloak cycle (EnemyAI + doctrine)', () => {
  let rig: FleetRig | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
  });

  function cloakCycleRig(): { current: FleetRig; wraith: ReturnType<FleetRig['addJet']> } {
    const current = new FleetRig({ level: 8, capacity: 2, seed: 3 });
    rig = current;
    const wraith = current.addJet(EnemyType.WRAITH, pointAround(current.player, 300, 120 * DEG));
    return { current, wraith };
  }

  it('through whole cycles the shared materials are never changed and another Wraith and a Fighter keep theirs', () => {
    const { current, wraith } = cloakCycleRig();
    // 另一架同型机和一架战斗机：不在测试台里飞（测试台不驱动共享信号灯，材质应当一点不变）
    const other = wraithMesh();
    const fighter = createEnemyMesh({ ...ENEMY_CONFIGS[EnemyType.FIGHTER] });
    const otherWatch = new HullWatch(other);
    const fighterWatch = new HullWatch(fighter);
    const watch = new HullWatch(wraith.getMesh());
    const shared = ledger([
      ...new Set([...watch.originals(), ...otherWatch.originals(), ...fighterWatch.originals()]),
    ]);
    let cloakedSteps = 0;
    let lowest = 1;
    current.run(30, () => {
      if (wraith.isCloaked()) cloakedSteps++;
      lowest = Math.min(lowest, watch.opacityRange().min);
    });
    expect(cloakedSteps, 'it did cloak').toBeGreaterThan(60);
    expect(lowest).toBeLessThan(0.2);
    expect(shared.changed()).toEqual([]);
    expect(shared.disposed()).toEqual([]);
    expect(otherWatch.usesOriginalMaterials()).toBe(true);
    expect(fighterWatch.usesOriginalMaterials()).toBe(true);
  });

  it('whenever it is fully visible it wears the shared materials themselves; the clones only while fading or cloaked', () => {
    const { current, wraith } = cloakCycleRig();
    const watch = new HullWatch(wraith.getMesh());
    let visibleSteps = 0;
    let fadedSteps = 0;
    const clonesSeen = new Set<THREE.Material>();
    current.run(30, () => {
      const range = watch.opacityRange();
      if (range.min >= 1 - 1e-9) {
        visibleSteps++;
        expect(watch.usesOriginalMaterials(), `t=${current.time.toFixed(2)}`).toBe(true);
      } else {
        fadedSteps++;
        expect(watch.usesOriginalMaterials(), `t=${current.time.toFixed(2)}`).toBe(false);
        for (const material of watch.foreignMaterials()) clonesSeen.add(material);
      }
    });
    expect(visibleSteps).toBeGreaterThan(300);
    expect(fadedSteps).toBeGreaterThan(120);
    // 每个部件一套克隆，反复用：总数不随周期增加
    const perCycle = watch.parts.reduce((sum, part) => sum + part.materials.length, 0);
    expect(clonesSeen.size).toBeLessThanOrEqual(perCycle);
  });

  it('a Wraith shot down while cloaked releases all of its clones and none of the shared materials beyond what any Wraith releases', () => {
    // 对照：一架从没隐形过的隐形机被销毁时释放了哪些原材质（这部分与隐形无关）
    const plain = new FleetRig({ level: 8, capacity: 2, seed: 3 });
    const plainWraith = plain.addJet(EnemyType.WRAITH, pointAround(plain.player, 300, 120 * DEG));
    const plainLedger = ledger(new HullWatch(plainWraith.getMesh()).originals());
    plain.run(0.5);
    expect(plainWraith.isCloaked()).toBe(false);
    plain.dispose();
    const releasedByAnyWraith = new Set(plainLedger.disposed());

    const { current, wraith } = cloakCycleRig();
    const watch = new HullWatch(wraith.getMesh());
    const shared = ledger(watch.originals());
    expect(
      current.runUntil(() => wraith.isCloaked(), 20),
      'it cloaked'
    ).toBe(true);
    current.run(0.2);
    const clones = watch.foreignMaterials();
    expect(clones.length).toBeGreaterThan(0);
    const cloneLedger = ledger(clones);
    const parts = watch.parts.map((part) => part.object);

    wraith.takeDamage(1e6);
    expect(wraith.isAlive()).toBe(false);
    current.dispose();
    rig = null;

    for (const clone of clones) expect(cloneLedger.disposedCount(clone)).toBe(1);
    const extra = shared.disposed().filter((material) => !releasedByAnyWraith.has(material));
    expect(extra, 'shared materials released because of the cloak').toEqual([]);
    expect(shared.changed()).toEqual([]);
    // 没有哪个部件还挂着克隆
    for (const part of parts) {
      for (const material of materialsOf(part)) expect(clones.includes(material)).toBe(false);
    }
  });
});
