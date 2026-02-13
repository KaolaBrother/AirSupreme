import type { Entity } from './Entity';
import type { ECS } from './ECS';

/**
 * 系统基类
 * 系统包含逻辑，操作具有特定组件的实体
 */
export abstract class System {
  /**
   * 系统需要的组件集合
   */
  public abstract readonly componentsRequired: Set<Function>;

  /**
   * ECS 引用
   */
  public ecs!: ECS;

  /**
   * 每帧更新
   */
  public abstract update(entities: Set<Entity>, deltaTime: number): void;
}
