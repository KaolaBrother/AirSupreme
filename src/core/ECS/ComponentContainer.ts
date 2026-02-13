import type { Component, ComponentClass } from './Component';

/**
 * 组件容器
 * 管理单个实体的所有组件
 */
export class ComponentContainer {
  private map = new Map<Function, Component>();

  /**
   * 添加组件
   */
  public add(component: Component): void {
    this.map.set(component.constructor, component);
  }

  /**
   * 获取组件
   */
  public get<T extends Component>(componentClass: ComponentClass<T>): T {
    return this.map.get(componentClass) as T;
  }

  /**
   * 检查是否有组件
   */
  public has(componentClass: Function): boolean {
    return this.map.has(componentClass);
  }

  /**
   * 检查是否有所有指定组件
   */
  public hasAll(componentClasses: Iterable<Function>): boolean {
    for (const cls of componentClasses) {
      if (!this.map.has(cls)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 删除组件
   */
  public delete(componentClass: Function): void {
    this.map.delete(componentClass);
  }
}
