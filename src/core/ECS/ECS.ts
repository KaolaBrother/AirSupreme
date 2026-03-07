import type { Entity } from './Entity';
import type { Component, ComponentClass } from './Component';
import type { System } from './System';
import { ComponentContainer } from './ComponentContainer';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('ECS');

export class ECS {
  private entities = new Map<Entity, ComponentContainer>();
  private systems = new Map<System, Set<Entity>>();
  private nextEntityID: Entity = 0;
  private entitiesToDestroy: Entity[] = [];

  // ========== 实体 API ==========

  /**
   * 创建新实体
   */
  public addEntity(): Entity {
    const entity = this.nextEntityID++;
    this.entities.set(entity, new ComponentContainer());
    return entity;
  }

  /**
   * 标记实体为待销毁
   */
  public removeEntity(entity: Entity): void {
    this.entitiesToDestroy.push(entity);
  }

  // ========== 组件 API ==========

  /**
   * 添加组件到实体
   */
  public addComponent(entity: Entity, component: Component): void {
    const container = this.entities.get(entity);
    if (!container) return;

    container.add(component);
    this.checkEntity(entity);
  }

  /**
   * 获取实体的组件容器
   */
  public getComponents(entity: Entity): ComponentContainer | undefined {
    return this.entities.get(entity);
  }

  /**
   * 从实体移除组件
   */
  public removeComponent(entity: Entity, componentClass: ComponentClass<Component>): void {
    const container = this.entities.get(entity);
    if (!container) return;

    container.delete(componentClass);
    this.checkEntity(entity);
  }

  // ========== 系统 API ==========

  /**
   * 添加系统
   */
  public addSystem(system: System): void {
    if (system.componentsRequired.size === 0) {
      log.warn('System not added: empty components list');
      return;
    }

    system.ecs = this;
    this.systems.set(system, new Set());

    // 检查现有实体是否符合系统要求
    for (const entity of this.entities.keys()) {
      this.checkEntitySystem(entity, system);
    }
  }

  /**
   * 移除系统
   */
  public removeSystem(system: System): void {
    this.systems.delete(system);
  }

  // ========== 更新 API ==========

  /**
   * 更新所有系统
   */
  public update(deltaTime: number): void {
    // 更新系统
    for (const [system, entities] of this.systems.entries()) {
      system.update(entities, deltaTime);
    }

    // 销毁标记的实体
    while (this.entitiesToDestroy.length > 0) {
      const entity = this.entitiesToDestroy.pop();
      if (entity !== undefined) {
        this.destroyEntity(entity);
      }
    }
  }

  // ========== 私有方法 ==========

  /**
   * 销毁实体
   */
  private destroyEntity(entity: Entity): void {
    this.entities.delete(entity);
    for (const entities of this.systems.values()) {
      entities.delete(entity);
    }
  }

  /**
   * 检查实体是否符合所有系统
   */
  private checkEntity(entity: Entity): void {
    for (const system of this.systems.keys()) {
      this.checkEntitySystem(entity, system);
    }
  }

  /**
   * 检查实体是否符合特定系统
   */
  private checkEntitySystem(entity: Entity, system: System): void {
    const container = this.entities.get(entity);
    if (!container) return;

    const entities = this.systems.get(system);
    if (!entities) return;

    if (container.hasAll(system.componentsRequired)) {
      entities.add(entity);
    } else {
      entities.delete(entity);
    }
  }
}
