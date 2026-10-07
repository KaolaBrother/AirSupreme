import type * as THREE from 'three';
import type { ContrailHandle, ContrailSystem } from '@/features/effects/ContrailSystem';

/** 拖尾挂载同步间隔（秒）：敌机 / 僚机的出生与坠毁不需要逐帧对账 */
const SYNC_INTERVAL = 0.3;

/**
 * 翼尖凝结尾迹的挂载管理：玩家机常驻，敌机与友军僚机按存活列表定期对账（新出现的挂载，
 * 消失 / 坠毁的解除，拖尾自然淡出后回收）。ContrailSystem 按需加载。
 */
export class ContrailController {
  private system: ContrailSystem | null = null;
  private loadPromise: Promise<void> | null = null;
  private disposed = false;
  private playerHandle: ContrailHandle = -1;
  private playerTarget: THREE.Object3D | null = null;
  private readonly handles = new Map<THREE.Object3D, ContrailHandle>();
  private readonly alive = new Set<THREE.Object3D>();
  private readonly stale: THREE.Object3D[] = [];
  private syncTimer = 0;

  public ensureLoaded(scene: THREE.Scene, maxTrails: number): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = import('@/features/effects/ContrailSystem').then(({ ContrailSystem }) => {
        if (this.disposed) return;
        this.system = new ContrailSystem(scene, { maxTrails, pointsPerTrail: 40 });
        if (this.playerTarget) {
          this.attachPlayer(this.playerTarget);
        }
      });
    }
    return this.loadPromise;
  }

  /** 玩家机拖尾（加力时由 setPlayerBoost 增强） */
  public attachPlayer(target: THREE.Object3D): void {
    this.playerTarget = target;
    const system = this.system;
    if (!system || this.playerHandle >= 0) return;
    this.playerHandle = system.attach(target, { width: 0.5, lifetime: 2.4 });
  }

  public setPlayerBoost(boost: number): void {
    if (this.system && this.playerHandle >= 0) {
      this.system.setBoost(this.playerHandle, boost);
    }
  }

  /**
   * 对账：meshes 为当前存活的敌机与僚机网格（可传入复用数组）。
   * force = true 时立即对账（换关清场后）。
   */
  public sync(meshes: readonly THREE.Object3D[], deltaTime: number, force: boolean = false): void {
    const system = this.system;
    if (!system) return;
    this.syncTimer -= deltaTime;
    if (!force && this.syncTimer > 0) return;
    this.syncTimer = SYNC_INTERVAL;

    this.alive.clear();
    for (const mesh of meshes) {
      if (!mesh.visible) continue;
      this.alive.add(mesh);
      if (!this.handles.has(mesh)) {
        const handle = system.attach(mesh, { width: 0.42, lifetime: 1.6 });
        if (handle >= 0) {
          this.handles.set(mesh, handle);
        }
      }
    }
    this.stale.length = 0;
    for (const mesh of this.handles.keys()) {
      if (!this.alive.has(mesh)) this.stale.push(mesh);
    }
    for (const mesh of this.stale) {
      const handle = this.handles.get(mesh);
      if (handle !== undefined) system.detach(handle);
      this.handles.delete(mesh);
    }
  }

  public update(deltaTime: number): void {
    this.system?.update(deltaTime);
  }

  /** 瞬移（换关 / 读档）后立即清空所有拖尾，保留挂载关系（避免从旧位置拉出长线） */
  public clearTrails(): void {
    this.system?.clear();
  }

  /** 换关：解除所有非玩家拖尾 */
  public detachAll(): void {
    const system = this.system;
    if (system) {
      for (const handle of this.handles.values()) system.detach(handle);
    }
    this.handles.clear();
  }

  public dispose(): void {
    this.disposed = true;
    this.handles.clear();
    this.system?.dispose();
    this.system = null;
    this.playerHandle = -1;
  }
}
