import { vi } from 'vitest';

/**
 * 一块假显示器：替换 requestAnimationFrame / cancelAnimationFrame 与 performance.now，
 * vsync(t) 把时钟拨到 t 并按请求顺序执行排队的动画帧回调（时间戳就是 t），与浏览器一样
 * 每个回调只执行一次、回调里新请求的帧排到下一次 vsync。
 *
 * 时间线由 steadyFrames / jitteredFrames 生成（毫秒时间戳，不含起点）。
 * 还原：vi.unstubAllGlobals() + vi.restoreAllMocks()。
 */
export class FakeDisplay {
  public now: number;
  private readonly queue = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;

  constructor(start = 10_000) {
    this.now = start;
  }

  public install(): this {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      const handle = this.nextHandle++;
      this.queue.set(handle, callback);
      return handle;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
      this.queue.delete(handle);
    });
    vi.spyOn(performance, 'now').mockImplementation(() => this.now);
    return this;
  }

  public pending(): number {
    return this.queue.size;
  }

  public vsync(timestamp: number): void {
    this.now = timestamp;
    const due = [...this.queue.values()];
    this.queue.clear();
    for (const callback of due) {
      callback(timestamp);
    }
  }
}

/** 刷新率 hz 下 seconds 秒的 vsync 时间戳（从 from 之后的第一帧起，不累积浮点误差） */
export function steadyFrames(hz: number, seconds: number, from: number): number[] {
  const interval = 1000 / hz;
  const count = Math.round(seconds * hz);
  return Array.from({ length: count }, (_, index) => from + (index + 1) * interval);
}

/**
 * 平均刷新率 hz、每帧间隔随机偏 ±jitterMs 的时间戳。偏移成对出现（+d、-d），平均间隔恰好是
 * 1000 / hz；随机数是固定种子的线性同余序列，每次运行都一样。
 */
export function jitteredFrames(
  hz: number,
  seconds: number,
  from: number,
  jitterMs: number,
  seed = 12_345
): number[] {
  const interval = 1000 / hz;
  const count = Math.round(seconds * hz);
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const timestamps: number[] = [];
  let at = from;
  let pending: number | null = null;
  for (let index = 0; index < count; index++) {
    let offset: number;
    if (pending === null) {
      offset = (random() * 2 - 1) * jitterMs;
      pending = -offset;
    } else {
      offset = pending;
      pending = null;
    }
    at += interval + offset;
    timestamps.push(at);
  }
  return timestamps;
}

/** 渲染了的 vsync 序号之间的间隔（例如每隔一帧渲染一次时全是 2） */
export function gapsBetween(indices: readonly number[]): number[] {
  const gaps: number[] = [];
  for (let index = 1; index < indices.length; index++) {
    gaps.push(indices[index] - indices[index - 1]);
  }
  return gaps;
}
