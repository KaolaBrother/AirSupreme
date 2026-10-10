import { InstancedMesh, Sprite } from 'three';
import type { BufferGeometry, Material, Object3D, WebGLRenderer } from 'three';

/**
 * 菜单里两处实时 3D（机库模型预览、标题画面的主机）共用的释放逻辑。
 * 本模块导入 three，只能被按需加载的模块引用，不能进入入口包。
 */

type Renderable = Object3D & {
  geometry?: BufferGeometry;
  material?: Material | Material[];
};

/**
 * 释放一棵模型树：几何体、材质与 InstancedMesh 的实例缓冲（同一资源只释放一次）。
 * 跳过 userData.sharedResource 标记的共享资源；Sprite 共用 three 内置平面几何体，不释放；
 * 纹理都是跨模型共享的（光晕 / 导弹涂装），不在这里释放。
 */
export function disposeModelTree(root: Object3D): void {
  const seen = new Set<object>();
  root.traverse((object) => {
    if (object.userData.sharedResource === true) {
      return;
    }
    if (object instanceof InstancedMesh) {
      object.dispose();
    }
    const renderable = object as Renderable;
    const geometry = renderable.geometry;
    if (geometry && !(object instanceof Sprite) && !seen.has(geometry)) {
      seen.add(geometry);
      if (geometry.userData.sharedResource !== true) {
        geometry.dispose();
      }
    }
    const material = renderable.material;
    const materials = material === undefined ? [] : Array.isArray(material) ? material : [material];
    for (const entry of materials) {
      if (seen.has(entry) || entry.userData.sharedResource === true) {
        continue;
      }
      seen.add(entry);
      entry.dispose();
    }
  });
}

/**
 * 彻底交还一个 WebGL 上下文：先 dispose（同时摘掉 three 自己的 contextlost 监听，
 * 之后主动丢弃上下文不会再打日志），再强制丢失上下文并把画布移出文档。
 * iOS 对同时存活的上下文数量有限制，菜单与对局各自的渲染器不能叠在一起。
 */
export function releaseRenderer(renderer: WebGLRenderer): void {
  try {
    renderer.dispose();
  } catch {
    // 上下文已经丢失时 dispose 可能抛出；继续走下面的清理
  }
  try {
    renderer.forceContextLoss();
  } catch {
    // 上下文已丢失 / 测试替身没有这个方法
  }
  renderer.domElement.remove();
}
