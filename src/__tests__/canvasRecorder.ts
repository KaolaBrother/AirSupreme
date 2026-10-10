import { vi } from 'vitest';

/**
 * 测试用的“记录型” 2D 画布上下文：jsdom 没有真正的 canvas，这里把每一次绘制调用连同当时的
 * 画笔状态记下来，再还原成“画了哪些形状、在哪里、实心还是空心”，供雷达 / 关卡地图的用例断言。
 * 断言只看位置与形状的种类，不看调用顺序。
 */

export interface Point {
  x: number;
  y: number;
}

export interface Arc extends Point {
  r: number;
}

/** 一段子路径：moveTo 起头的一串顶点，或者一个圆弧 */
export interface SubPath {
  points: Point[];
  arcs: Arc[];
}

export type PaintKind = 'fill' | 'stroke' | 'text';

/** 一次 fill() / stroke() / fillText() 画出来的东西 */
export interface PaintedShape {
  paint: PaintKind;
  subpaths: SubPath[];
  style: string;
  alpha: number;
  lineWidth: number;
  text?: string;
  /** 文字：画它时的字体、对齐方式，以及 fillText 的 maxWidth（没给时为 undefined） */
  font?: string;
  textAlign?: string;
  textBaseline?: string;
  maxWidth?: number;
}

interface RawOp {
  op: string;
  args: unknown[];
}

interface DrawState {
  fillStyle: unknown;
  strokeStyle: unknown;
  globalAlpha: number;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export interface CanvasRecorder {
  readonly canvas: HTMLCanvasElement;
  /** 原始调用（方法名 + 参数） */
  readonly ops: RawOp[];
  /** 按 fill / stroke / fillText 还原出的形状 */
  readonly shapes: PaintedShape[];
  /** putImageData 收到的图像 */
  readonly images: Array<{ data: Uint8ClampedArray; width: number; height: number }>;
  /** drawImage 的来源（另一张画布） */
  readonly blits: unknown[];
  clear(): void;
}

export interface CanvasRecording {
  readonly recorders: CanvasRecorder[];
  /** 某张画布的记录（还没取过 2D 上下文时为 undefined） */
  of(canvas: HTMLCanvasElement | null | undefined): CanvasRecorder | undefined;
  clearAll(): void;
  restore(): void;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

function createRecorder(canvas: HTMLCanvasElement): {
  recorder: CanvasRecorder;
  context: CanvasRenderingContext2D;
} {
  const ops: RawOp[] = [];
  const shapes: PaintedShape[] = [];
  const images: Array<{ data: Uint8ClampedArray; width: number; height: number }> = [];
  const blits: unknown[] = [];
  let state: DrawState = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };
  const stack: DrawState[] = [];
  let path: SubPath[] = [];

  const openSubPath = (): SubPath => {
    const sub: SubPath = { points: [], arcs: [] };
    path.push(sub);
    return sub;
  };
  const currentSubPath = (): SubPath => path[path.length - 1] ?? openSubPath();
  const snapshotPath = (): SubPath[] =>
    path
      .filter((sub) => sub.points.length > 0 || sub.arcs.length > 0)
      .map((sub) => ({
        points: sub.points.map((p) => ({ ...p })),
        arcs: sub.arcs.map((a) => ({ ...a })),
      }));

  const handlers: Record<string, (...args: unknown[]) => unknown> = {
    save: () => {
      stack.push({ ...state });
    },
    restore: () => {
      const previous = stack.pop();
      if (previous) state = previous;
    },
    beginPath: () => {
      path = [];
    },
    moveTo: (x, y) => {
      openSubPath().points.push({ x: num(x), y: num(y) });
    },
    lineTo: (x, y) => {
      currentSubPath().points.push({ x: num(x), y: num(y) });
    },
    closePath: () => {
      const sub = path[path.length - 1];
      if (sub && sub.points.length > 0) sub.points.push({ ...sub.points[0] });
    },
    arc: (x, y, r) => {
      openSubPath().arcs.push({ x: num(x), y: num(y), r: num(r) });
    },
    rect: (x, y, w, h) => {
      const left = num(x);
      const top = num(y);
      openSubPath().points.push(
        { x: left, y: top },
        { x: left + num(w), y: top },
        { x: left + num(w), y: top + num(h) },
        { x: left, y: top + num(h) },
        { x: left, y: top }
      );
    },
    fill: () => {
      shapes.push({
        paint: 'fill',
        subpaths: snapshotPath(),
        style: String(state.fillStyle),
        alpha: state.globalAlpha,
        lineWidth: state.lineWidth,
      });
    },
    stroke: () => {
      shapes.push({
        paint: 'stroke',
        subpaths: snapshotPath(),
        style: String(state.strokeStyle),
        alpha: state.globalAlpha,
        lineWidth: state.lineWidth,
      });
    },
    fillText: (text, x, y, maxWidth) => {
      shapes.push({
        paint: 'text',
        subpaths: [{ points: [{ x: num(x), y: num(y) }], arcs: [] }],
        style: String(state.fillStyle),
        alpha: state.globalAlpha,
        lineWidth: state.lineWidth,
        text: String(text),
        font: state.font,
        textAlign: state.textAlign,
        textBaseline: state.textBaseline,
        maxWidth: typeof maxWidth === 'number' ? maxWidth : undefined,
      });
    },
    createImageData: (width, height) => ({
      width: num(width),
      height: num(height),
      data: new Uint8ClampedArray(num(width) * num(height) * 4),
    }),
    putImageData: (image) => {
      const source = image as { data: Uint8ClampedArray; width: number; height: number };
      images.push({
        data: new Uint8ClampedArray(source.data),
        width: source.width,
        height: source.height,
      });
    },
    drawImage: (source) => {
      blits.push(source);
    },
    measureText: (text) => ({ width: String(text).length * 6 }),
    getLineDash: () => [],
  };

  const target: Record<string, unknown> = { canvas };
  const context = new Proxy(target, {
    get(_target, property) {
      if (typeof property !== 'string') return undefined;
      if (property === 'canvas') return canvas;
      if (property in state) return state[property as keyof DrawState];
      if (property in target && typeof target[property] !== 'function') return target[property];
      return (...args: unknown[]): unknown => {
        ops.push({ op: property, args });
        return handlers[property]?.(...args);
      };
    },
    set(_target, property, value) {
      if (typeof property !== 'string') return true;
      if (property in state) {
        (state as unknown as Record<string, unknown>)[property] = value;
      } else {
        target[property] = value;
      }
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  const recorder: CanvasRecorder = {
    canvas,
    ops,
    shapes,
    images,
    blits,
    clear() {
      ops.length = 0;
      shapes.length = 0;
      images.length = 0;
      blits.length = 0;
    },
  };
  return { recorder, context };
}

/**
 * 让之后创建的每张 canvas 的 getContext('2d') 返回记录型上下文（同一张画布总是同一个）。
 * 用完调用 restore()。
 */
export function installCanvasRecording(): CanvasRecording {
  const recorders: CanvasRecorder[] = [];
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  const byCanvas = new WeakMap<HTMLCanvasElement, CanvasRecorder>();
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    type: string
  ) {
    if (type !== '2d') return null;
    let context = contexts.get(this);
    if (!context) {
      const created = createRecorder(this);
      context = created.context;
      contexts.set(this, context);
      byCanvas.set(this, created.recorder);
      recorders.push(created.recorder);
    }
    return context;
  } as typeof HTMLCanvasElement.prototype.getContext);

  return {
    recorders,
    of: (canvas) => (canvas ? byCanvas.get(canvas) : undefined),
    clearAll: () => recorders.forEach((recorder) => recorder.clear()),
    restore: () => spy.mockRestore(),
  };
}

// ───────────────────────────── 形状分析 ─────────────────────────────

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(shapes: readonly PaintedShape[]): Box {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x: number, y: number): void => {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  };
  for (const shape of shapes) {
    for (const sub of shape.subpaths) {
      for (const p of sub.points) include(p.x, p.y);
      for (const a of sub.arcs) {
        include(a.x - a.r, a.y - a.r);
        include(a.x + a.r, a.y + a.r);
      }
    }
  }
  return box;
}

export function centreOf(shapes: readonly PaintedShape[]): Point {
  const box = boundsOf(shapes);
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

/** 外接框较长的一边 */
export function extentOf(shapes: readonly PaintedShape[]): number {
  const box = boundsOf(shapes);
  return Math.max(box.maxX - box.minX, box.maxY - box.minY);
}

/** 一个字符的宽度（em），按 Arial Bold 取、略偏宽：估出来的文字框宁大勿小 */
function glyphWidthEm(char: string): number {
  if (char >= '0' && char <= '9') return 0.556;
  if (char === ' ') return 0.278;
  if (char === 'm' || char === 'M' || char === 'W') return 0.944;
  if (char > '⹿') return 1;
  if (char >= 'A' && char <= 'Z') return 0.722;
  return 0.611;
}

/**
 * 一段 fillText 文字占的框：宽度按字宽估（不超过 maxWidth），高度取一个字号（em 框），
 * 按画它时的 textAlign / textBaseline 摆在锚点周围。
 */
export function textBoxOf(shape: PaintedShape): Box {
  const anchor = shape.subpaths[0]?.points[0];
  if (shape.paint !== 'text' || !anchor) {
    throw new Error('textBoxOf needs a fillText shape');
  }
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(shape.font ?? '')?.[1] ?? Number.NaN);
  if (!Number.isFinite(size)) {
    throw new Error(`cannot read a pixel size from the font "${shape.font}"`);
  }
  let width = 0;
  for (const char of shape.text ?? '') width += glyphWidthEm(char) * size;
  if (shape.maxWidth !== undefined) width = Math.min(width, shape.maxWidth);

  const align = shape.textAlign ?? 'start';
  const minX =
    align === 'center'
      ? anchor.x - width / 2
      : align === 'right' || align === 'end'
        ? anchor.x - width
        : anchor.x;
  const baseline = shape.textBaseline ?? 'alphabetic';
  const minY =
    baseline === 'top' || baseline === 'hanging'
      ? anchor.y
      : baseline === 'middle'
        ? anchor.y - size / 2
        : baseline === 'bottom' || baseline === 'ideographic'
          ? anchor.y - size
          : anchor.y - size * 0.8;
  return { minX, minY, maxX: minX + width, maxY: minY + size };
}

/** 两个框之间的空隙（px）；相交或相接时 ≤ 0 */
export function gapBetweenBoxes(a: Box, b: Box): number {
  return Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minY - b.maxY, b.minY - a.maxY);
}

function signature(shape: PaintedShape): string {
  const round = (value: number): number => Math.round(value * 100) / 100;
  return JSON.stringify([
    shape.paint,
    shape.style,
    round(shape.alpha),
    // 线宽只对描边有意义（填充 / 文字时它只是上一次描边留下的状态）
    shape.paint === 'stroke' ? round(shape.lineWidth) : 0,
    shape.text ?? '',
    shape.subpaths.map((sub) => [
      sub.points.map((p) => [round(p.x), round(p.y)]),
      sub.arcs.map((a) => [round(a.x), round(a.y), round(a.r)]),
    ]),
  ]);
}

/** after 里比 before 多出来的形状（按内容做多重集合差）：单独加一个目标后新画出来的东西 */
export function addedShapes(
  before: readonly PaintedShape[],
  after: readonly PaintedShape[]
): PaintedShape[] {
  const remaining = new Map<string, number>();
  for (const shape of before) {
    const key = signature(shape);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const added: PaintedShape[] = [];
  for (const shape of after) {
    const key = signature(shape);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
    } else {
      added.push(shape);
    }
  }
  return added;
}

/** 一条独立的线段（只有两个顶点的描边路径）：量程外符号的“朝外短线” */
export function isLineSegment(shape: PaintedShape): boolean {
  return (
    shape.paint === 'stroke' &&
    shape.subpaths.length === 1 &&
    shape.subpaths[0].arcs.length === 0 &&
    shape.subpaths[0].points.length === 2
  );
}

export function copyShapes(shapes: readonly PaintedShape[]): PaintedShape[] {
  return shapes.map((shape) => ({
    ...shape,
    subpaths: shape.subpaths.map((sub) => ({
      points: sub.points.map((p) => ({ ...p })),
      arcs: sub.arcs.map((a) => ({ ...a })),
    })),
  }));
}
