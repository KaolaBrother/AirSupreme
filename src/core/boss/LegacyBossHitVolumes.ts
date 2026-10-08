import * as THREE from 'three';
import { HIT_RADIUS_USERDATA_KEY, getDeclaredHitRadius } from '@/core/CombatContracts';

/**
 * 第 1-5 关 Boss（旧模型，部件没有声明命中半径）的半径命中体：
 * - 每个可碰撞部件按几何包围盒声明 userData.hitRadius（中等半轴，扁平部件按厚度收紧），
 *   导弹 / 特殊武器的现有半径判定（getDeclaredHitRadius）因此对大部件生效；
 * - 细长部件（机翼、舰体、履带）沿长轴再布若干命中球，玩家 / 友军子弹逐颗与这些球比较。
 *
 * 命中球的局部坐标在出生时计算一次；逐帧只把局部坐标变换到世界坐标（无分配）。
 */

/** 命中球半径范围（米） */
const MIN_RADIUS = 3;
const MAX_RADIUS = 90;
/** 扁平部件（甲板、机翼）：半径不超过 厚度 × 2.5 + 6 米，避免上下方大片误判 */
const FLAT_THICKNESS_FACTOR = 2.5;
const FLAT_MARGIN = 6;
/** 长轴超过半径的这个倍数时沿长轴布多个命中球 */
const ELONGATION_THRESHOLD = 1.4;
const MAX_SPHERES_PER_PART = 8;

export interface LegacyHitVolume {
  readonly part: THREE.Object3D;
  readonly radius: number;
  /** 部件局部坐标（几何空间） */
  readonly local: THREE.Vector3;
  /** 本帧世界坐标（refresh 后有效） */
  readonly world: THREE.Vector3;
}

interface MutableHitVolume {
  part: THREE.Object3D;
  radius: number;
  local: THREE.Vector3;
  world: THREE.Vector3;
}

const tmpBox = new THREE.Box3();
const tmpSize = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

function geometryOf(object: THREE.Object3D): THREE.BufferGeometry | null {
  const mesh = object as THREE.Mesh;
  return mesh.isMesh && mesh.geometry instanceof THREE.BufferGeometry ? mesh.geometry : null;
}

export class LegacyBossHitVolumes {
  private readonly volumes: MutableHitVolume[] = [];
  private root: THREE.Object3D | null = null;
  /** 粗筛：Boss 根节点为中心的包围球半径（米） */
  private broadRadius = 0;
  private readonly broadCenter = new THREE.Vector3();

  /** 出生时：为部件声明命中半径并布置命中球（已声明半径的部件保持原样，只用一个球） */
  public build(root: THREE.Object3D, parts: readonly THREE.Object3D[]): void {
    this.clear();
    this.root = root;
    root.updateMatrixWorld(true);
    let farthest = 0;
    const rootPosition = root.getWorldPosition(new THREE.Vector3());
    for (const part of parts) {
      const geometry = geometryOf(part);
      part.getWorldScale(tmpScale);
      const scale = Math.max(Math.abs(tmpScale.x), Math.abs(tmpScale.y), Math.abs(tmpScale.z));
      if (!geometry || !(scale > 0)) {
        this.addVolume(part, getDeclaredHitRadius(part, 5), new THREE.Vector3());
        continue;
      }
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox ?? tmpBox.makeEmpty();
      if (box.isEmpty()) {
        this.addVolume(part, getDeclaredHitRadius(part, 5), new THREE.Vector3());
        continue;
      }
      box.getSize(tmpSize).multiplyScalar(0.5);
      box.getCenter(tmpCenter);
      // 世界尺度下的半轴，按大小排序：a ≤ b ≤ c
      const halves = [tmpSize.x * scale, tmpSize.y * scale, tmpSize.z * scale];
      const order = [0, 1, 2].sort((i, j) => halves[i] - halves[j]);
      const a = halves[order[0]];
      const b = halves[order[1]];
      const c = halves[order[2]];
      const radius = THREE.MathUtils.clamp(
        Math.min(b, a * FLAT_THICKNESS_FACTOR + FLAT_MARGIN),
        MIN_RADIUS,
        MAX_RADIUS
      );
      if (getDeclaredHitRadius(part, 0) <= 0) {
        part.userData[HIT_RADIUS_USERDATA_KEY] = radius;
      }

      const axis = order[2];
      if (c > radius * ELONGATION_THRESHOLD) {
        const count = Math.min(MAX_SPHERES_PER_PART, Math.ceil(c / radius));
        const localHalf = c / scale;
        for (let i = 0; i < count; i++) {
          const offset = -localHalf + (localHalf * (2 * i + 1)) / count;
          const local = tmpCenter.clone();
          local.setComponent(axis, local.getComponent(axis) + offset);
          this.addVolume(part, radius, local);
        }
      } else {
        this.addVolume(part, radius, tmpCenter.clone());
      }
      part.getWorldPosition(tmpCenter);
      farthest = Math.max(farthest, tmpCenter.distanceTo(rootPosition) + Math.max(c, radius));
    }
    // 动画会让部件（触手、炮塔）稍微外伸：粗筛半径留 25% 余量
    this.broadRadius = farthest * 1.25 + 10;
  }

  private addVolume(part: THREE.Object3D, radius: number, local: THREE.Vector3): void {
    this.volumes.push({ part, radius, local, world: new THREE.Vector3() });
  }

  public getVolumes(): readonly LegacyHitVolume[] {
    return this.volumes;
  }

  public isEmpty(): boolean {
    return this.volumes.length === 0;
  }

  /**
   * 逐帧：把命中球变换到世界坐标。部件矩阵取自最近一次渲染（scene.updateMatrixWorld），
   * 最多滞后一帧（Boss 移动 < 1 米），省掉每帧整棵 Boss 子树的矩阵重算。
   */
  public refresh(): void {
    const root = this.root;
    if (!root) return;
    this.broadCenter.setFromMatrixPosition(root.matrixWorld);
    for (const volume of this.volumes) {
      volume.world.copy(volume.local).applyMatrix4(volume.part.matrixWorld);
    }
  }

  /** 与某点相交的命中球（不可见部件跳过）；没有返回 null */
  public findHit(position: THREE.Vector3): LegacyHitVolume | null {
    if (this.volumes.length === 0) return null;
    const broad = this.broadRadius;
    if (position.distanceToSquared(this.broadCenter) > broad * broad) return null;
    for (const volume of this.volumes) {
      if (!volume.part.visible) continue;
      const r = volume.radius;
      if (volume.world.distanceToSquared(position) <= r * r) {
        return volume;
      }
    }
    return null;
  }

  public clear(): void {
    this.volumes.length = 0;
    this.root = null;
    this.broadRadius = 0;
  }
}
