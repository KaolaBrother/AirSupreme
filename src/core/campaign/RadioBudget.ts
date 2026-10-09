/**
 * 紧急告警台词的配额（每波 / 每场 Boss 战重新计数）：最多开口 maxPerWave 次，
 * 每次开口之后的冷却逐次加长（cooldownSeconds[0]、[1]……，超出数组长度沿用最后一项）。
 *
 * 只决定“这次要不要配音”；HUD 闪烁告警与告警音由调用方每次照发。
 * 用法：isReady() 为真时尝试播报，真的进了无线电再 consume()；update(dt) 推进冷却，
 * 新的一波 / Boss 战开始时 reset()。
 */
export interface RadioBudgetConfig {
  /** 每波最多开口几次 */
  readonly maxPerWave: number;
  /** 第 n 次开口之后的冷却（秒，逐次加长） */
  readonly cooldownSeconds: readonly number[];
}

export class RadioBudget {
  private used = 0;
  private cooldown = 0;

  constructor(private readonly config: RadioBudgetConfig) {}

  /** 本波还有配额且不在冷却中 */
  public isReady(): boolean {
    return this.used < this.config.maxPerWave && this.cooldown <= 0;
  }

  /** 记一次开口，进入下一档冷却 */
  public consume(): void {
    const steps = this.config.cooldownSeconds;
    const step = steps.length > 0 ? steps[Math.min(this.used, steps.length - 1)] : 0;
    this.cooldown = Number.isFinite(step) && step > 0 ? step : 0;
    this.used++;
  }

  /** 推进冷却（游戏时间，秒） */
  public update(deltaTime: number): void {
    if (this.cooldown > 0 && Number.isFinite(deltaTime) && deltaTime > 0) {
      this.cooldown = Math.max(0, this.cooldown - deltaTime);
    }
  }

  /** 新的一波 / Boss 战：配额与冷却清零 */
  public reset(): void {
    this.used = 0;
    this.cooldown = 0;
  }

  /** 本波已开口的次数 */
  public getUsed(): number {
    return this.used;
  }
}
