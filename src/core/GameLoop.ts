/**
 * 专业游戏循环
 * 使用固定时间步长 + 可变渲染
 */
export class GameLoop {
  private lastRequestId?: number;
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;
  private accumulator: number = 0;

  private readonly DEFAULT_FPS = 60;
  private readonly MIN_FPS = 20;
  private targetFps: number = this.DEFAULT_FPS;

  private get targetFrameTime(): number {
    return 1000 / this.targetFps;
  }

  private get maxDeltaTime(): number {
    return 1000 / this.MIN_FPS;
  }

  /**
   * 设置目标帧率
   */
  public setTargetFPS(fps: number): void {
    this.targetFps = Math.min(Math.max(fps, this.MIN_FPS), 144);
  }

  /**
   * 启动游戏循环
   */
  public start(
    update: (deltaTime: number) => void,
    render: () => void
  ): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;

      // 尽早请求下一帧（提高性能）
      this.lastRequestId = requestAnimationFrame(loop);

      // 计算时间增量
      let deltaTime = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      // 防止"死亡螺旋"（切换标签页后的大延迟）
      deltaTime = Math.min(deltaTime, this.maxDeltaTime);

      // 固定时间步长更新
      this.accumulator += deltaTime;
      while (this.accumulator >= this.targetFrameTime) {
        update(this.targetFrameTime / 1000); // 转换为秒
        this.accumulator -= this.targetFrameTime;
      }

      // 平滑渲染
      render();
    };

    requestAnimationFrame(loop);
  }

  /**
   * 停止游戏循环
   */
  public stop(): void {
    this.isRunning = false;
    if (this.lastRequestId) {
      cancelAnimationFrame(this.lastRequestId);
      this.lastRequestId = undefined;
    }
  }

  /**
   * 检查是否正在运行
   */
  public isActive(): boolean {
    return this.isRunning;
  }
}
