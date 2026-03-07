import type { Component } from './Component';
import type { Entity } from './Entity';
import type { ECS } from './ECS';

type ComponentKey = abstract new (...args: never[]) => Component;

/**
 * 系统基类
 * 系统包含逻辑，操作具有特定组件的实体
 */
export abstract class System {
  /**
   * 系统需要的组件集合
   */
  public abstract readonly componentsRequired: Set<ComponentKey>;

  /**
   * ECS 引用
   */
  public ecs!: ECS;

  /**
   * 每帧更新
   */
  public abstract update(entities: Set<Entity>, deltaTime: number): void;
}
