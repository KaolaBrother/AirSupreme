export type CleanupCallback = () => void;

/**
 * 统一管理运行时资源，避免 GameCoordinator 手动散落清理逻辑。
 */
export class ResourceRegistry {
  private cleanupCallbacks: Set<CleanupCallback> = new Set();
  private timeoutIds: Set<ReturnType<typeof setTimeout>> = new Set();

  /**
   * 注册通用清理回调。
   */
  public addCleanup(callback: CleanupCallback): CleanupCallback {
    this.cleanupCallbacks.add(callback);
    return callback;
  }

  /**
   * 注册事件解绑函数，语义上等同于 addCleanup。
   */
  public addUnsubscriber(unsubscribe: CleanupCallback): CleanupCallback {
    return this.addCleanup(unsubscribe);
  }

  /**
   * 注册一个已经存在的 timeout id。
   */
  public trackTimeout(timeoutId: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
    this.timeoutIds.add(timeoutId);
    return timeoutId;
  }

  /**
   * 创建并追踪 timeout，在执行后自动移除。
   */
  public scheduleTimeout(
    callback: () => void,
    delay: number
  ): ReturnType<typeof setTimeout> {
    const timeoutId = setTimeout(() => {
      this.timeoutIds.delete(timeoutId);
      callback();
    }, delay);

    this.timeoutIds.add(timeoutId);
    return timeoutId;
  }

  /**
   * 取消单个 timeout。
   */
  public cancelTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    if (!this.timeoutIds.has(timeoutId)) {
      return;
    }

    clearTimeout(timeoutId);
    this.timeoutIds.delete(timeoutId);
  }

  /**
   * 取消所有 timeout。
   */
  public clearTimeouts(): void {
    for (const timeoutId of this.timeoutIds) {
      clearTimeout(timeoutId);
    }
    this.timeoutIds.clear();
  }

  /**
   * 执行并清空所有清理回调。
   */
  public runCleanups(): void {
    for (const cleanup of this.cleanupCallbacks) {
      try {
        cleanup();
      } catch (error) {
        console.error('Resource cleanup failed', error);
      }
    }
    this.cleanupCallbacks.clear();
  }

  /**
   * 全量释放注册资源。
   */
  public dispose(): void {
    this.clearTimeouts();
    this.runCleanups();
  }
}
