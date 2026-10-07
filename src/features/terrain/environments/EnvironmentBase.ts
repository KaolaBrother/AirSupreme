/**
 * TerrainEnvironment 的公共基类：root 分组、动画回调注册、统一释放。
 * 子类实现 terrain / hasWater / build / sampleHeight / isWater，
 * 并通过 animate() 注册每帧动画；dispose() 会移除 root 并释放全部资源。
 */
import * as THREE from 'three';
import type { TerrainType } from '../LevelConfig';
import type { TerrainEnvironment, TerrainEnvironmentContext } from './TerrainEnvironment';
import { disposeObjectTree } from './envKit';

export type EnvironmentAnimation = (
  deltaTime: number,
  elapsed: number,
  focus: THREE.Vector3
) => void;

export abstract class EnvironmentBase implements TerrainEnvironment {
  abstract readonly terrain: TerrainType;
  abstract readonly hasWater: boolean;
  readonly root: THREE.Group;
  protected waterY = -48;
  private animations: EnvironmentAnimation[] = [];
  private disposed = false;

  constructor(name: string) {
    this.root = new THREE.Group();
    this.root.name = name;
  }

  abstract build(ctx: TerrainEnvironmentContext): void;
  abstract sampleHeight(worldX: number, worldZ: number): number;
  abstract isWater(worldX: number, worldZ: number): boolean;

  /** 注册每帧动画回调（dispose 时清空） */
  protected animate(callback: EnvironmentAnimation): void {
    this.animations.push(callback);
  }

  update(deltaTime: number, elapsed: number, focus: THREE.Vector3): void {
    if (this.disposed) {
      return;
    }
    const dt = Number.isFinite(deltaTime) ? Math.min(Math.max(deltaTime, 0), 0.25) : 0;
    const time = Number.isFinite(elapsed) ? elapsed : 0;
    for (const animation of this.animations) {
      animation(dt, time, focus);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.animations = [];
    disposeObjectTree(this.root);
  }
}
