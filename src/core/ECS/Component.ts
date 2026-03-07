/**
 * 组件基类
 * 组件是纯数据容器，不包含逻辑
 */
export abstract class Component {}

/**
 * 组件类类型
 */
export type ComponentClass<T extends Component> = new (...args: never[]) => T;
