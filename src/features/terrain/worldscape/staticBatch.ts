/**
 * worldscape/staticBatch — 静态装饰几何合批。
 *
 * 关卡里成百上千个互不运动的小网格（楼体、立面、护栏、标线、路面贴花……）若各自成为一个
 * Mesh，每个都要一次 draw call。StaticBatcher 在生成阶段按「材质 + renderOrder」分桶收集
 * 零件：零件几何按其世界矩阵烘焙进桶，flush() 时每桶合并为一个网格（阴影标记取桶内并集）。
 * 外观不变（同一材质、同一世界坐标），draw call 从「每个零件一个」降到「每种材质一个」。
 *
 * 顶点色材质（material.vertexColors = true）的零件可以携带各自的颜色（例如每栋楼略有
 * 差异的墙色），写入 color 属性，于是原本「一栋楼一个材质」也能共用一个材质合批。
 *
 * 只用于静态几何：需要逐帧单独变换或单独调材质参数（闪烁相位不同）的对象不要并入同一桶。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface StaticBatchPartOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  /** 顶点色材质的零件颜色（线性工作空间）；材质未开启 vertexColors 时忽略，缺省为白色 */
  color?: THREE.Color;
}

interface StaticBatchBucket {
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
  parts: THREE.BufferGeometry[];
}

/** 合并时保留的顶点属性（其余属性在零件上删除，保证同桶属性集合一致） */
const KEPT_ATTRIBUTES = ['position', 'normal', 'uv', 'color'] as const;
const WHITE = new THREE.Color(1, 1, 1);

function usesVertexColors(material: THREE.Material): boolean {
  return (material as THREE.Material & { vertexColors?: boolean }).vertexColors === true;
}

export class StaticBatcher {
  private readonly buckets = new Map<string, StaticBatchBucket>();
  private readonly materialIds = new Map<THREE.Material, number>();

  /** 已收集、尚未合并的零件数 */
  public get pendingParts(): number {
    let count = 0;
    for (const bucket of this.buckets.values()) count += bucket.parts.length;
    return count;
  }

  /**
   * 收集一个零件：拷贝 geometry 并按 matrix 烘焙到父空间（原几何不被修改，可继续复用）。
   */
  public add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrix: THREE.Matrix4,
    options: StaticBatchPartOptions = {}
  ): void {
    const position = geometry.getAttribute('position');
    if (!position || position.count === 0) return;

    const part = new THREE.BufferGeometry();
    for (const name of KEPT_ATTRIBUTES) {
      const attribute = geometry.getAttribute(name);
      if (attribute) part.setAttribute(name, attribute.clone());
    }
    if (geometry.index) part.setIndex(geometry.index.clone());
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    part.applyMatrix4(matrix);
    // 镜像变换会翻转三角形环绕方向：交换每个三角形的两个顶点恢复正面朝向
    if (matrix.determinant() < 0) flipWinding(part);

    if (!usesVertexColors(material)) {
      if (part.getAttribute('color')) part.deleteAttribute('color');
    } else if (options.color || !part.getAttribute('color')) {
      // 顶点色材质：写入零件色；源几何自带顶点色（如草甸渐变）且未指定零件色时原样保留
      fillColor(part, options.color ?? WHITE);
    }

    const renderOrder = options.renderOrder ?? 0;
    const key = `${this.materialId(material)}|${renderOrder}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        material,
        castShadow: false,
        receiveShadow: false,
        renderOrder,
        parts: [],
      };
      this.buckets.set(key, bucket);
    }
    bucket.castShadow = bucket.castShadow || options.castShadow === true;
    bucket.receiveShadow = bucket.receiveShadow || options.receiveShadow === true;
    bucket.parts.push(part);
  }

  /**
   * 把一个按 Group 拼装好的对象整体并入（root 的变换即摆放位置，root 不应已挂在场景里）。
   * 普通单材质网格按其相对 root 父空间的矩阵烘焙；无法合批的可渲染对象（InstancedMesh、
   * 多材质网格、点 / 线 / 精灵、灯光）原样跳过并返回，调用方应把它们另行挂回场景。
   */
  public addObject(
    root: THREE.Object3D,
    colorOf?: (mesh: THREE.Mesh) => THREE.Color | undefined
  ): THREE.Object3D[] {
    const skipped: THREE.Object3D[] = [];
    root.updateMatrixWorld(true);
    root.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh)) {
        if (!Array.isArray(child.material)) {
          this.add(child.geometry, child.material, child.matrixWorld, {
            castShadow: child.castShadow,
            receiveShadow: child.receiveShadow,
            renderOrder: child.renderOrder,
            color: colorOf?.(child),
          });
          return;
        }
      }
      const renderable = child as THREE.Object3D & {
        isMesh?: boolean;
        isPoints?: boolean;
        isLine?: boolean;
        isSprite?: boolean;
        isLight?: boolean;
      };
      if (
        renderable.isMesh ||
        renderable.isPoints ||
        renderable.isLine ||
        renderable.isSprite ||
        renderable.isLight
      ) {
        skipped.push(child);
      }
    });
    return skipped;
  }

  /** 合并所有桶：每桶一个 Mesh 挂到 parent 下，返回生成的网格；之后批处理器可继续复用 */
  public flush(parent: THREE.Object3D, name?: string): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const bucket of this.buckets.values()) {
      const merged = mergeParts(bucket.parts);
      for (const part of bucket.parts) part.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, bucket.material);
      if (name) mesh.name = name;
      mesh.castShadow = bucket.castShadow;
      mesh.receiveShadow = bucket.receiveShadow;
      mesh.renderOrder = bucket.renderOrder;
      // 零件已烘焙到父空间：网格自身保持单位变换，不必每帧重算矩阵
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    this.materialIds.clear();
    return meshes;
  }

  private materialId(material: THREE.Material): number {
    let id = this.materialIds.get(material);
    if (id === undefined) {
      id = this.materialIds.size;
      this.materialIds.set(material, id);
    }
    return id;
  }
}

function fillColor(geometry: THREE.BufferGeometry, color: THREE.Color): void {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** 交换每个三角形的后两个顶点（非索引几何先补一个顺序索引） */
function flipWinding(geometry: THREE.BufferGeometry): void {
  if (!geometry.index) {
    const count = geometry.getAttribute('position').count;
    const indices: number[] = [];
    for (let i = 0; i < count; i++) indices.push(i);
    geometry.setIndex(indices);
  }
  const index = geometry.index;
  if (!index) return;
  for (let i = 0; i + 2 < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
}

/** 统一同桶零件的索引形态与属性集合后合并（mergeGeometries 要求两者一致） */
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const allIndexed = parts.every((part) => part.index !== null);
  const normalized = parts.map((part) => (allIndexed || !part.index ? part : part.toNonIndexed()));
  const hasUv = normalized.every((part) => part.getAttribute('uv') !== undefined);
  for (const part of normalized) {
    if (!hasUv && part.getAttribute('uv')) part.deleteAttribute('uv');
  }
  const merged = mergeGeometries(normalized, false);
  for (const part of normalized) {
    if (!parts.includes(part)) part.dispose();
  }
  return merged;
}

/**
 * 多材质几何的分组整理：把使用同一材质的几何分组在索引里排到一起，每种材质只剩一个分组。
 * 例如 BoxGeometry 的六个面分组（四面幕墙 + 顶底）→ 两组，InstancedMesh 的 draw call 6 → 2。
 * 原地改写 geometry 的 index/groups，返回去重后的材质数组（与新分组的 materialIndex 对应）。
 */
export function consolidateMaterialGroups(
  geometry: THREE.BufferGeometry,
  materials: THREE.Material[]
): THREE.Material[] {
  const index = geometry.index;
  if (!index || geometry.groups.length === 0) return materials;
  const unique: THREE.Material[] = [];
  const indicesByMaterial = new Map<THREE.Material, number[]>();
  for (const group of geometry.groups) {
    const material = materials[group.materialIndex ?? 0];
    if (!material) continue;
    let list = indicesByMaterial.get(material);
    if (!list) {
      list = [];
      indicesByMaterial.set(material, list);
      unique.push(material);
    }
    const end = Math.min(index.count, group.start + group.count);
    for (let i = group.start; i < end; i++) list.push(index.getX(i));
  }
  const merged: number[] = [];
  geometry.clearGroups();
  unique.forEach((material, materialIndex) => {
    const list = indicesByMaterial.get(material) ?? [];
    geometry.addGroup(merged.length, list.length, materialIndex);
    for (const value of list) merged.push(value);
  });
  geometry.setIndex(merged);
  return unique;
}
