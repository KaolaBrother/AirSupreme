/**
 * 触控设备的渲染节流（GameLoop 与标题画面主机 MenuHeroScene 共用）。
 * 放在 src 顶层、与 config 同级：标题画面主机不导入游戏运行时（core / scenes）。
 *
 * Android 上的 Chrome 按面板刷新率（120 / 144 Hz）回调动画帧，每帧都模拟 + 渲染就是 2-2.4 倍的
 * GPU 负担、发热与降频（iPad Safari 封顶 60 Hz，不受影响）。这里用最近一小段动画帧间隔的中位数
 * 估算刷新率 refreshHz，每 n 个显示帧只处理一帧：n = max(1, floor(refreshHz / 60 + 0.1))。
 * 60 / 90 Hz 每帧都处理；120 Hz 隔一帧（60 fps）；144 Hz 隔一帧（72 fps）；间隔均匀。
 * 估算是滑动窗口、持续更新：面板在 120 / 60 Hz 之间切换时零点几秒内跟上。
 *
 * 被跳过的显示帧什么都不做；调用方在处理的帧上用距上次处理的真实时间推进，
 * 所以模拟时间仍跟随真实时间（不加速、不减速、不丢时间）。
 */
export class FramePacer {
  /** 节流的目标渲染帧率：刷新率是它的几倍就隔几帧处理一次 */
  public static readonly TARGET_FPS = 60;
  /** 估算刷新率用的帧间隔样本数（滑动窗口，奇数便于取中位数） */
  private static readonly WINDOW = 31;
  /** 样本少于它时不节流（每帧都处理） */
  private static readonly MIN_SAMPLES = 8;
  /** 超过它的帧间隔（卡顿 / 切后台）不计入刷新率估算（毫秒） */
  private static readonly MAX_INTERVAL_MS = 100;

  private readonly samples = new Float64Array(FramePacer.WINDOW);
  private readonly sorted = new Float64Array(FramePacer.WINDOW);
  private sampleCount = 0;
  private nextSample = 0;
  private lastTimestamp = Number.NaN;
  private refreshHz = 0;
  private frameInterval = 1;
  private framesSinceProcessed = 0;

  /** 循环（重新）启动时调用：丢掉旧的间隔样本，从每帧都处理开始 */
  public reset(): void {
    this.sampleCount = 0;
    this.nextSample = 0;
    this.lastTimestamp = Number.NaN;
    this.refreshHz = 0;
    this.frameInterval = 1;
    this.framesSinceProcessed = 0;
  }

  /**
   * 每个动画帧调用一次（timestamp 为 requestAnimationFrame 的时间戳）。
   * 返回 true：这一帧要模拟并渲染；false：跳过（不做任何事）。
   * enabled 为 false（非触控设备）时每帧都处理，行为与没有节流时一致。
   */
  public shouldProcess(timestamp: number, enabled: boolean): boolean {
    if (!enabled) {
      this.reset();
      return true;
    }

    this.recordInterval(timestamp);
    this.framesSinceProcessed++;
    if (this.framesSinceProcessed < this.frameInterval) {
      return false;
    }
    this.framesSinceProcessed = 0;
    return true;
  }

  /** 当前每几个显示帧处理一帧（≥ 1） */
  public getFrameInterval(): number {
    return this.frameInterval;
  }

  /** 估算的面板刷新率（Hz）；样本不足时为 0 */
  public getRefreshRate(): number {
    return this.refreshHz;
  }

  private recordInterval(timestamp: number): void {
    if (!Number.isFinite(timestamp)) {
      return;
    }
    const interval = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    // 首帧（没有上一帧）、时间倒退、NaN 与过长的间隔都不计入
    if (!(interval > 0) || interval > FramePacer.MAX_INTERVAL_MS) {
      return;
    }

    this.samples[this.nextSample] = interval;
    this.nextSample = (this.nextSample + 1) % FramePacer.WINDOW;
    this.sampleCount = Math.min(this.sampleCount + 1, FramePacer.WINDOW);
    if (this.sampleCount < FramePacer.MIN_SAMPLES) {
      return;
    }

    const median = this.medianInterval();
    if (!(median > 0)) {
      return;
    }
    this.refreshHz = 1000 / median;
    this.frameInterval = Math.max(1, Math.floor(this.refreshHz / FramePacer.TARGET_FPS + 0.1));
  }

  /** 窗口内帧间隔的中位数（插入排序到预分配数组，不产生垃圾） */
  private medianInterval(): number {
    const count = this.sampleCount;
    const sorted = this.sorted;
    for (let i = 0; i < count; i++) {
      const value = this.samples[i];
      let j = i - 1;
      while (j >= 0 && sorted[j] > value) {
        sorted[j + 1] = sorted[j];
        j--;
      }
      sorted[j + 1] = value;
    }
    return sorted[Math.floor(count / 2)];
  }
}
