import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import {
  createEnemyMesh,
  createFriendlyMesh,
  createPlayerMesh,
} from '@/features/aircraft/AircraftMeshFactory';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { disposeModelTree } from '@/ui/menu/modelDisposal';
import { SIM_TEST_TIMEOUT, SystemRig, pointAround, seededGameRandom } from './enemyFleetRig';

vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 销毁一架飞机不能释放别的飞机还在用的几何体 / 材质（99523ee）：同型号的其它敌机、机库预览、
 * 僚机、玩家机共用按机型缓存的材质和模块级材质（喷口、座舱框、加力火焰、进气道、精英灯条）。
 * 释放了它们，同型号的其它飞机下一帧就拿着已释放的材质渲染（WebGL 上重新上传或变黑）。
 * 同时，本机自己的几何体 / 材质仍要随机体释放，否则每击落一架就漏一份。
 *
 * 判定只看“谁在用”：在销毁之前遍历每架飞机的网格树，收集它用到的几何体与材质；被销毁的那架
 * 用到、而别的飞机都没用到的，算它自己的。不读 userData.sharedResource 之类的实现标记。
 */

const ALL_TYPES = Object.values(EnemyType);

interface Resources {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
}

/** 一棵网格树用到的全部几何体与材质 */
function resourcesOf(root: THREE.Object3D): Resources {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (renderable.geometry instanceof THREE.BufferGeometry) {
      geometries.add(renderable.geometry);
    }
    const material = renderable.material;
    for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
      if (entry instanceof THREE.Material) materials.add(entry);
    }
  });
  return { geometries, materials };
}

function union(all: readonly Resources[]): Resources {
  const out: Resources = { geometries: new Set(), materials: new Set() };
  for (const one of all) {
    one.geometries.forEach((geometry) => out.geometries.add(geometry));
    one.materials.forEach((material) => out.materials.add(material));
  }
  return out;
}

/** 记下被 dispose 的几何体与材质（原方法照常执行） */
function watchDisposals() {
  const disposed = new Set<object>();
  const geometryDispose = THREE.BufferGeometry.prototype.dispose;
  const materialDispose = THREE.Material.prototype.dispose;
  const geometrySpy = vi
    .spyOn(THREE.BufferGeometry.prototype, 'dispose')
    .mockImplementation(function (this: THREE.BufferGeometry) {
      disposed.add(this);
      geometryDispose.call(this);
    });
  const materialSpy = vi.spyOn(THREE.Material.prototype, 'dispose').mockImplementation(function (
    this: THREE.Material
  ) {
    disposed.add(this);
    materialDispose.call(this);
  });
  return {
    disposed,
    restore() {
      geometrySpy.mockRestore();
      materialSpy.mockRestore();
    },
  };
}

/** 名字：几何体 / 材质的类型与名字，失败信息用 */
function label(resource: THREE.BufferGeometry | THREE.Material): string {
  return `${resource.type}${resource.name ? ` "${resource.name}"` : ''}`;
}

/**
 * 判定：others 用到的一个都没被释放；victim 用到、others 都没用到的（它自己的）全部被释放。
 * 返回问题列表（空 = 通过）和它自己的资源件数。
 */
function judge(
  name: string,
  victim: Resources,
  others: Resources,
  disposed: ReadonlySet<object>
): { problems: string[]; own: number } {
  const problems: string[] = [];
  const sharedHit = [...others.geometries, ...others.materials].filter((r) => disposed.has(r));
  if (sharedHit.length > 0) {
    problems.push(
      `${name}: released ${sharedHit.length} resource(s) other aircraft still use: ${sharedHit
        .map(label)
        .join(', ')}`
    );
  }
  const own = [
    ...[...victim.geometries].filter((g) => !others.geometries.has(g)),
    ...[...victim.materials].filter((m) => !others.materials.has(m)),
  ];
  const kept = own.filter((r) => !disposed.has(r));
  if (kept.length > 0) {
    problems.push(
      `${name}: kept ${kept.length} of its own ${own.length} resource(s): ${kept
        .map(label)
        .join(', ')}`
    );
  }
  return { problems, own: own.length };
}

let rig: SystemRig | null = null;
let randomSpy: { mockRestore(): void } | null = null;
let watch: ReturnType<typeof watchDisposals> | null = null;

afterEach(() => {
  watch?.restore();
  watch = null;
  rig?.dispose();
  rig = null;
  randomSpy?.mockRestore();
  randomSpy = null;
  EventBus.clear();
});

describe('a destroyed jet keeps what other aircraft share and releases its own (99523ee)', () => {
  it('shot down in a fight (the real kill path): one jet of every type, while a second jet of each type, a hangar copy of each type, a wingman and the player fly on', () => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(5));
    rig = new SystemRig({ level: 10, difficulty: 3 });
    const active = rig;
    const victims = ALL_TYPES.map((type, index) =>
      active.spawn(type, pointAround(active.player, 400, (index * 40 * Math.PI) / 180))
    );
    const survivors = ALL_TYPES.map((type, index) =>
      active.spawn(type, pointAround(active.player, 600, ((index * 40 + 20) * Math.PI) / 180))
    );
    active.run(1);

    const bystanders = [
      ...survivors.map((jet) => jet.getMesh()),
      ...ALL_TYPES.map((type) => createEnemyMesh(ENEMY_CONFIGS[type])),
      createFriendlyMesh(ENEMY_CONFIGS[EnemyType.FIGHTER]),
      createPlayerMesh(),
    ];
    const victimResources = victims.map((jet) => resourcesOf(jet.getMesh()));
    const others = union(bystanders.map(resourcesOf));

    const killWatch = watchDisposals();
    watch = killWatch;
    for (const jet of victims) jet.takeDamage(1e9);
    active.run(0.5);
    killWatch.restore();

    // 击落的那几架确实被清理了（不在敌机列表里，网格树已拆空）
    for (const jet of victims) {
      expect(active.jets.includes(jet), `${jet.getConfig().type} cleaned up`).toBe(false);
      expect(jet.getMesh().children.length, `${jet.getConfig().type} children`).toBe(0);
    }
    expect(survivors.every((jet) => jet.isAlive())).toBe(true);

    const problems: string[] = [];
    victims.forEach((jet, index) => {
      const verdict = judge(
        jet.getConfig().type,
        victimResources[index],
        others,
        killWatch.disposed
      );
      problems.push(...verdict.problems);
      // 不是空判定：每个机型都有它自己的资源（机体几何体）
      expect(verdict.own, `${jet.getConfig().type}: own resources`).toBeGreaterThan(0);
    });
    expect(problems).toEqual([]);
  });

  it.each(ALL_TYPES)(
    '%s: disposing one jet directly keeps everything a second jet of its type, the other types, a wingman and the player use',
    (type) => {
      EventBus.clear();
      randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(9));
      rig = new SystemRig({ level: 10, difficulty: 3 });
      const active = rig;
      const victim = active.spawn(type, pointAround(active.player, 400, 0));
      const twin = active.spawn(type, pointAround(active.player, 400, Math.PI / 2));
      active.step();

      const bystanders = [
        twin.getMesh(),
        ...ALL_TYPES.filter((other) => other !== type).map((other) =>
          createEnemyMesh(ENEMY_CONFIGS[other])
        ),
        createFriendlyMesh(ENEMY_CONFIGS[EnemyType.FIGHTER]),
        createPlayerMesh(),
      ];
      const mine = resourcesOf(victim.getMesh());
      const others = union(bystanders.map(resourcesOf));

      watch = watchDisposals();
      victim.dispose();
      watch.restore();

      const verdict = judge(type, mine, others, watch.disposed);
      expect(verdict.problems).toEqual([]);
      expect(verdict.own, 'own resources').toBeGreaterThan(0);
    }
  );

  it('a wingman shot down keeps what the other wingman, the enemy jets and the player use', () => {
    const scene = new THREE.Scene();
    const config = ENEMY_CONFIGS[EnemyType.FIGHTER];
    const lost = new FriendlyAI(createFriendlyMesh(config), config, scene);
    const kept = new FriendlyAI(createFriendlyMesh(config), config, scene);
    const bystanders = [
      kept.getMesh(),
      ...ALL_TYPES.map((type) => createEnemyMesh(ENEMY_CONFIGS[type])),
      createPlayerMesh(),
    ];
    const mine = resourcesOf(lost.getMesh());
    const others = union(bystanders.map(resourcesOf));

    watch = watchDisposals();
    lost.dispose();
    watch.restore();

    const verdict = judge('wingman', mine, others, watch.disposed);
    expect(verdict.problems).toEqual([]);
    expect(verdict.own, 'own resources').toBeGreaterThan(0);
    kept.dispose();
  });

  it.each(ALL_TYPES)(
    '%s: closing a hangar / menu preview of it keeps what a jet of that type in the field uses',
    (type) => {
      const preview = createEnemyMesh(ENEMY_CONFIGS[type]);
      const field = createEnemyMesh(ENEMY_CONFIGS[type]);
      const mine = resourcesOf(preview);
      const others = union([
        resourcesOf(field),
        resourcesOf(createFriendlyMesh(ENEMY_CONFIGS[EnemyType.FIGHTER])),
      ]);

      watch = watchDisposals();
      disposeModelTree(preview);
      watch.restore();

      const verdict = judge(`${type} preview`, mine, others, watch.disposed);
      expect(verdict.problems).toEqual([]);
    }
  );
});
