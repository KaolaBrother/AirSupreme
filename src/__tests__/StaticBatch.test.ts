import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StaticBatcher } from '@/features/terrain/worldscape/staticBatch';

/**
 * 静态合批（worldscape/staticBatch，终验修复 F4a）：按材质把普通网格合成一个网格（世界坐标烘焙进
 * 顶点，外观不变），无法合批的子节点（实例化 / 多材质网格、点、线、精灵、灯光）连同其子树原样交还
 * 调用方；源几何不被修改。
 */

function box(material: THREE.Material, x: number, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function vertexCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count;
}

function bounds(mesh: THREE.Mesh): THREE.Box3 {
  mesh.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(mesh);
}

describe('StaticBatcher', () => {
  it('merges the meshes into one mesh per material, baked at their world positions', () => {
    const brick = new THREE.MeshStandardMaterial({ color: 0xaa5533 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x88ccff });
    const root = new THREE.Group();
    root.position.set(100, 0, 0);
    const a = box(brick, -10);
    const b = box(brick, 10, 5);
    const c = box(glass, 0, 0, 30);
    const nested = new THREE.Group();
    nested.position.set(0, 20, 0);
    const d = box(glass, 0);
    nested.add(d);
    root.add(a, b, c, nested);
    const sourceVertices = vertexCount(a.geometry);
    const sourcePositions = Array.from(a.geometry.getAttribute('position').array);

    const batcher = new StaticBatcher();
    const skipped = batcher.addObject(root);
    const parent = new THREE.Group();
    const merged = batcher.flush(parent, 'city-batch');

    expect(skipped).toEqual([]);
    expect(merged).toHaveLength(2);
    expect(parent.children).toEqual(merged);
    const byMaterial = new Map(merged.map((mesh) => [mesh.material, mesh]));
    expect(new Set(byMaterial.keys())).toEqual(new Set([brick, glass]));
    for (const mesh of merged) {
      expect(vertexCount(mesh.geometry)).toBe(sourceVertices * 2);
      expect(mesh.name).toBe('city-batch');
    }

    // 世界坐标：砖块在 x = 90 与 110（y 0 与 5），玻璃在 (100, 0, 30) 与 (100, 20, 0)
    const brickBounds = bounds(byMaterial.get(brick) as THREE.Mesh);
    expect(brickBounds.min.x).toBeCloseTo(89);
    expect(brickBounds.max.x).toBeCloseTo(111);
    expect(brickBounds.max.y).toBeCloseTo(6);
    const glassBounds = bounds(byMaterial.get(glass) as THREE.Mesh);
    expect(glassBounds.max.y).toBeCloseTo(21);
    expect(glassBounds.max.z).toBeCloseTo(31);

    // 源几何不被改动（可继续复用）
    expect(Array.from(a.geometry.getAttribute('position').array)).toEqual(sourcePositions);
  });

  it('hands back the subtrees it cannot merge, untouched, and merges the rest', () => {
    const stone = new THREE.MeshStandardMaterial({ color: 0x777777 });
    const root = new THREE.Group();
    const plain = box(stone, 0);

    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, 4);
    const multi = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), [
      stone,
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    ]);
    // 多材质网格下挂的普通子网格：随父节点整棵交还，不能被拆进合批
    const childOfMulti = box(stone, 5);
    multi.add(childOfMulti);
    const points = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()])
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)])
    );
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    const light = new THREE.PointLight(0xffffff, 1);
    const holder = new THREE.Group();
    holder.add(instanced, multi);
    root.add(plain, holder, points, line, sprite, light);

    const batcher = new StaticBatcher();
    const skipped = batcher.addObject(root);
    const merged = batcher.flush(new THREE.Group());

    expect(new Set(skipped)).toEqual(new Set([instanced, multi, points, line, sprite, light]));
    expect(skipped).toHaveLength(6);
    expect(multi.children, 'the subtree is handed back whole').toEqual([childOfMulti]);
    expect(merged).toHaveLength(1);
    expect(vertexCount(merged[0].geometry), 'only the plain mesh was merged').toBe(
      vertexCount(plain.geometry)
    );
  });

  it('keeps meshes with different render orders apart', () => {
    const decal = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const root = new THREE.Group();
    const road = box(decal, 0);
    const marking = box(decal, 4);
    marking.renderOrder = 2;
    root.add(road, marking);

    const batcher = new StaticBatcher();
    batcher.addObject(root);
    const merged = batcher.flush(new THREE.Group());
    expect(merged.map((mesh) => mesh.renderOrder).sort()).toEqual([0, 2]);
  });
});
