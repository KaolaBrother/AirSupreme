/**
 * 专业游戏循环
 * 使用固定时间步长 + 可变渲染
 */
import { GameConfig, type QualityPreset } from '@/config';

export class GameLoop {
  private static readonly QUALITY_ORDER = ['performance', 'balanced', 'quality'] as const;

  private lastRequestId?: number;
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;
  private accumulator: number = 0;
  private frameTimeSamples: number[] = [];
  private fpsSamples: number[] = [];
  private frameTimeSampleTotal: number = 0;
  private fpsSampleTotal: number = 0;
  private autoQualityCheckTimer: number = 0;
  private stablePerformanceTimer: number = 0;

  private readonly DEFAULT_FPS = 60;
  private readonly MIN_FPS = 20;
  private readonly MAX_FPS = 144;
  private readonly FRAME_STATS_SAMPLE_LIMIT = 120;
  private readonly AUTO_QUALITY_CHECK_INTERVAL = 1000;
  private readonly LOW_FPS_RATIO = 0.82;
  private readonly RECOVERY_FPS_RATIO = 0.95;
  private readonly RECOVERY_TIME_MS = 4000;

  private targetFps: number = this.DEFAULT_FPS;
  private minFps: number = this.MIN_FPS;

  private get targetFrameTime(): number {
    return 1000 / this.targetFps;
  }

  private get maxDeltaTime(): number {
    return 1000 / this.minFps;
  }

  private get currentEffectivePreset(): Exclude<QualityPreset, 'auto'> {
    return GameConfig.getEffectiveQualityPreset();
  }

  /**
   * 设置目标帧率
   */
  public setTargetFPS(fps: number): void {
    this.targetFps = Math.min(Math.max(fps, this.MIN_FPS), this.MAX_FPS);
    this.minFps = this.MIN_FPS;
  }

  /**
   * 设置画质预设（影响循环流畅度）
   */
  public setQualityPreset(preset: QualityPreset): void {
    if (preset !== GameConfig.getQualityPreset()) {
      GameConfig.setQualityPreset(preset);
    }
    this.autoQualityCheckTimer = 0;
    this.stablePerformanceTimer = 0;
    this.applyQualityProfile(this.currentEffectivePreset);
  }

  /**
   * 启动游戏循环
   */
  public start(
    update: (deltaTime: number) => void,
    render: (alpha: number) => void
  ): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.resetFrameStats();
    this.autoQualityCheckTimer = 0;
    this.stablePerformanceTimer = 0;
    this.applyQualityProfile(this.currentEffectivePreset);

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;

      // 尽早请求下一帧（提高性能）
      this.lastRequestId = requestAnimationFrame(loop);

      // 计算时间增量
      const rawDeltaTime = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      this.recordFrameStats(rawDeltaTime);
      this.evaluateAutoQuality(rawDeltaTime);

      // 防止"死亡螺旋"（切换标签页后的大延迟）
      const deltaTime = Math.min(rawDeltaTime, this.maxDeltaTime);

      // 固定时间步长更新
      this.accumulator += deltaTime;
      while (this.accumulator >= this.targetFrameTime) {
        update(this.targetFrameTime / 1000); // 转换为秒
        this.accumulator -= this.targetFrameTime;
      }

      // 将剩余累积时间作为插值系数传给渲染层，降低固定步长下的视觉跳变
      const alpha = this.targetFrameTime > 0
        ? Math.max(0, Math.min(1, this.accumulator / this.targetFrameTime))
        : 1;
      render(alpha);
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

  public getAverageFPS(): number {
    if (this.fpsSamples.length === 0) {
      return 0;
    }
    return this.fpsSampleTotal / this.fpsSamples.length;
  }

  public getAverageFrameTime(): number {
    if (this.frameTimeSamples.length === 0) {
      return 0;
    }
    return this.frameTimeSampleTotal / this.frameTimeSamples.length;
  }

  private applyQualityProfile(preset: Exclude<QualityPreset, 'auto'>): void {
    const targetFPS = GameConfig.getTargetFPSForPreset(preset);

    this.targetFps = Math.min(Math.max(targetFPS, this.MIN_FPS), this.MAX_FPS);
    this.minFps = preset === 'quality'
      ? Math.max(Math.round(this.targetFps * 0.6), this.MIN_FPS)
      : this.MIN_FPS;
  }

  private resetFrameStats(): void {
    this.frameTimeSamples = [];
    this.fpsSamples = [];
    this.frameTimeSampleTotal = 0;
    this.fpsSampleTotal = 0;
  }

  private recordFrameStats(frameTimeMs: number): void {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0 || frameTimeMs > 1000) {
      return;
    }

    this.pushBoundedSample(this.frameTimeSamples, frameTimeMs, 'frameTimeSampleTotal');
    this.pushBoundedSample(this.fpsSamples, 1000 / frameTimeMs, 'fpsSampleTotal');
  }

  private pushBoundedSample(
    target: number[],
    value: number,
    totalKey: 'frameTimeSampleTotal' | 'fpsSampleTotal'
  ): void {
    target.push(value);
    this[totalKey] += value;

    if (target.length > this.FRAME_STATS_SAMPLE_LIMIT) {
      const removed = target.shift();
      if (removed !== undefined) {
        this[totalKey] -= removed;
      }
    }
  }

  private evaluateAutoQuality(frameTimeMs: number): void {
    if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0 || frameTimeMs > 1000) {
      return;
    }

    this.autoQualityCheckTimer += frameTimeMs;
    if (
      this.frameTimeSamples.length < Math.min(30, this.FRAME_STATS_SAMPLE_LIMIT)
      || this.autoQualityCheckTimer < this.AUTO_QUALITY_CHECK_INTERVAL
    ) {
      return;
    }

    this.autoQualityCheckTimer = 0;

    const averageFPS = this.getAverageFPS();
    const currentPreset = this.currentEffectivePreset;
    const downgradePreset = this.getAdjacentPreset(currentPreset, -1);

    if (averageFPS < this.targetFps * this.LOW_FPS_RATIO && downgradePreset) {
      GameConfig.setRuntimeQualityOverride(downgradePreset);
      this.applyQualityProfile(GameConfig.getEffectiveQualityPreset());
      this.stablePerformanceTimer = 0;
      return;
    }

    const desiredPreset = GameConfig.getResolvedQualityPreset();
    if (GameConfig.getRuntimeQualityOverride() === undefined || currentPreset === desiredPreset) {
      this.stablePerformanceTimer = 0;
      return;
    }

    const upgradePreset = this.getUpgradeCandidate(currentPreset, desiredPreset);
    if (!upgradePreset) {
      this.stablePerformanceTimer = 0;
      return;
    }

    const upgradeTargetFPS = this.getTargetFPSForPreset(upgradePreset);
    if (averageFPS >= upgradeTargetFPS * this.RECOVERY_FPS_RATIO) {
      this.stablePerformanceTimer += this.AUTO_QUALITY_CHECK_INTERVAL;
      if (this.stablePerformanceTimer >= this.RECOVERY_TIME_MS) {
        if (upgradePreset === desiredPreset) {
          GameConfig.clearRuntimeQualityOverride();
        } else {
          GameConfig.setRuntimeQualityOverride(upgradePreset);
        }
        this.applyQualityProfile(GameConfig.getEffectiveQualityPreset());
        this.stablePerformanceTimer = 0;
      }
      return;
    }

    this.stablePerformanceTimer = 0;
  }

  private getTargetFPSForPreset(preset: Exclude<QualityPreset, 'auto'>): number {
    return Math.min(
      Math.max(GameConfig.getTargetFPSForPreset(preset), this.MIN_FPS),
      this.MAX_FPS
    );
  }

  private getAdjacentPreset(
    preset: Exclude<QualityPreset, 'auto'>,
    direction: -1 | 1
  ): Exclude<QualityPreset, 'auto'> | undefined {
    const index = GameLoop.QUALITY_ORDER.indexOf(preset);
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= GameLoop.QUALITY_ORDER.length) {
      return undefined;
    }

    return GameLoop.QUALITY_ORDER[nextIndex];
  }

  private getUpgradeCandidate(
    currentPreset: Exclude<QualityPreset, 'auto'>,
    desiredPreset: Exclude<QualityPreset, 'auto'>
  ): Exclude<QualityPreset, 'auto'> | undefined {
    const currentIndex = GameLoop.QUALITY_ORDER.indexOf(currentPreset);
    const desiredIndex = GameLoop.QUALITY_ORDER.indexOf(desiredPreset);

    if (currentIndex >= desiredIndex) {
      return undefined;
    }

    return GameLoop.QUALITY_ORDER[Math.min(currentIndex + 1, desiredIndex)];
  }
}
