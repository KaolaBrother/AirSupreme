/**
 * 屏幕效果状态（纯逻辑，无 DOM/GL 依赖）。
 * - 脉冲量（damagePulse / flash / empFlash）：取 max 后自动衰减，单次调用即可产生一次闪烁
 * - 持续量（lowHealth / speed）：设定目标值，平滑趋近
 */
export interface ScreenEffectsInput {
  damagePulse?: number;
  lowHealth?: number;
  flash?: number;
  speed?: number;
  empFlash?: number;
}

export interface ScreenEffectsValues {
  damagePulse: number;
  lowHealth: number;
  flash: number;
  speed: number;
  empFlash: number;
  /** 0..1 心跳包络（低血量暗角脉动） */
  heartbeat: number;
  /** 累计时间（秒），驱动噪声/故障条纹 */
  time: number;
}

/** 各脉冲完全衰减所需时间（秒） */
const DAMAGE_DECAY_SECONDS = 0.55;
const FLASH_DECAY_SECONDS = 0.32;
const EMP_DECAY_SECONDS = 0.75;
/** 持续量平滑时间常数（秒） */
const LEVEL_SMOOTHING_SECONDS = 0.18;
/** 心跳周期（秒）：约 80 bpm 的“咚-咚” */
const HEARTBEAT_PERIOD = 0.78;

function clamp01(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export class ScreenEffectsState {
  readonly values: ScreenEffectsValues = {
    damagePulse: 0,
    lowHealth: 0,
    flash: 0,
    speed: 0,
    empFlash: 0,
    heartbeat: 0,
    time: 0,
  };

  private lowHealthTarget = 0;
  private speedTarget = 0;
  private heartbeatPhase = 0;

  set(effects: ScreenEffectsInput): void {
    const damage = clamp01(effects.damagePulse);
    const flash = clamp01(effects.flash);
    const emp = clamp01(effects.empFlash);
    const lowHealth = clamp01(effects.lowHealth);
    const speed = clamp01(effects.speed);
    if (damage !== undefined) this.values.damagePulse = Math.max(this.values.damagePulse, damage);
    if (flash !== undefined) this.values.flash = Math.max(this.values.flash, flash);
    if (emp !== undefined) this.values.empFlash = Math.max(this.values.empFlash, emp);
    if (lowHealth !== undefined) this.lowHealthTarget = lowHealth;
    if (speed !== undefined) this.speedTarget = speed;
  }

  reset(): void {
    this.values.damagePulse = 0;
    this.values.flash = 0;
    this.values.empFlash = 0;
    this.values.lowHealth = 0;
    this.values.speed = 0;
    this.values.heartbeat = 0;
    this.lowHealthTarget = 0;
    this.speedTarget = 0;
  }

  update(deltaTime: number): ScreenEffectsValues {
    const dt = Number.isFinite(deltaTime) ? Math.min(Math.max(deltaTime, 0), 0.1) : 0;
    const v = this.values;
    v.time = (v.time + dt) % 1000;
    v.damagePulse = Math.max(0, v.damagePulse - dt / DAMAGE_DECAY_SECONDS);
    v.flash = Math.max(0, v.flash - dt / FLASH_DECAY_SECONDS);
    v.empFlash = Math.max(0, v.empFlash - dt / EMP_DECAY_SECONDS);

    const blend = 1 - Math.exp(-dt / LEVEL_SMOOTHING_SECONDS);
    v.lowHealth += (this.lowHealthTarget - v.lowHealth) * blend;
    v.speed += (this.speedTarget - v.speed) * blend;
    if (v.lowHealth < 1e-4) v.lowHealth = 0;
    if (v.speed < 1e-4) v.speed = 0;

    // 心跳：双峰包络（咚—咚—停），低血量越重越快
    if (v.lowHealth > 0) {
      this.heartbeatPhase += dt / (HEARTBEAT_PERIOD * (1.15 - 0.3 * v.lowHealth));
      this.heartbeatPhase %= 1;
      const p = this.heartbeatPhase;
      const beatA = Math.exp(-Math.pow((p - 0.08) / 0.06, 2));
      const beatB = 0.65 * Math.exp(-Math.pow((p - 0.3) / 0.07, 2));
      v.heartbeat = Math.min(1, beatA + beatB);
    } else {
      this.heartbeatPhase = 0;
      v.heartbeat = 0;
    }
    return v;
  }

  /** 是否有任何效果需要绘制 */
  isActive(): boolean {
    const v = this.values;
    return (
      v.damagePulse > 0.002 ||
      v.flash > 0.002 ||
      v.empFlash > 0.002 ||
      v.lowHealth > 0.002 ||
      v.speed > 0.002
    );
  }
}
