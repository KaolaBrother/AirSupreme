import { expect } from 'vitest';

/**
 * 从内联样式还原一枚屏幕外箭头（OffscreenChevron）画在哪里。
 *
 * jsdom 不做布局，所以这里照 CSS 的规则自己算：外层盒子以 left / top 为基准、按自身的
 * translate 平移；距离标签是一行文字，宽度按 Arial Bold 的字宽算（页面字体是
 * `'Arial', sans-serif`，标签是粗体），高度是字号 × 行高；箭头图形是 SVG 里的多边形，
 * 按 viewBox 缩放到 SVG 的宽高，再绕中心做 rotate / scale。
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Arial Bold 的字宽（em）：距离标签是数字加单位 */
const ARIAL_BOLD_ADVANCE: Readonly<Record<string, number>> = {
  m: 0.889,
  k: 0.556,
  '.': 0.278,
  ' ': 0.278,
};
const ARIAL_BOLD_DIGIT = 0.556;

export const boxOf = (rect: Rect): Box => ({
  left: rect.left,
  top: rect.top,
  right: rect.left + rect.width,
  bottom: rect.top + rect.height,
});

/** 两个矩形之间的空隙（重叠时为负）：把一个矩形向四周外扩多少才碰到另一个 */
export function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(b.left - a.right, a.left - b.right);
  const dy = Math.max(b.top - a.bottom, a.top - b.bottom);
  return Math.max(dx, dy);
}

export function px(value: string, what: string): number {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  expect(match, `${what}: "${value}" is a pixel length`).toBeTruthy();
  return Number((match as RegExpMatchArray)[1]);
}

/** CSS 长度：px，或相对 basis 的百分比 */
export function lengthOf(value: string, basis: number, what: string): number {
  const text = value.trim();
  if (text.endsWith('%')) return (Number.parseFloat(text) / 100) * basis;
  if (text === '0') return 0;
  return px(text, what);
}

/** transform 里各个 translate() 的总位移（百分比相对元素自身的宽高） */
export function translationOf(transform: string, width: number, height: number): Point {
  const total = { x: 0, y: 0 };
  for (const match of transform.matchAll(/translate\(\s*([^,)]+)(?:,\s*([^)]+))?\)/g)) {
    total.x += lengthOf(match[1], width, 'translate x');
    total.y += lengthOf(match[2] ?? '0', height, 'translate y');
  }
  return total;
}

/** transform 里各个 rotate() 的总和（度） */
export function rotationOf(transform: string): number {
  let total = 0;
  for (const match of transform.matchAll(/rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/g)) {
    total += Number(match[1]);
  }
  return total;
}

/** transform 里各个 scale() 的乘积（没有就是 1） */
export function scaleOf(transform: string): number {
  let total = 1;
  for (const match of transform.matchAll(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
    total *= Number(match[1]);
  }
  return total;
}

export function textWidth(text: string, fontPx: number): number {
  let em = 0;
  for (const char of text) {
    em += /\d/.test(char) ? ARIAL_BOLD_DIGIT : (ARIAL_BOLD_ADVANCE[char] ?? 0.889);
  }
  return em * fontPx;
}

/** 两个角度之差，折到 (-180, 180] */
export function angleDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** 一枚箭头画在屏幕上的样子 */
export interface DrawnChevron {
  centre: Point;
  /** 外层盒子 */
  arrow: Box;
  label: Box | null;
  text: string;
  /** 箭头图形的旋转（度，0 = 朝上，顺时针） */
  rotation: number;
}

/** basis：left / top 写成百分比时相对的宽高（箭头所在的全屏图层，即视口） */
export function readChevron(
  element: HTMLElement,
  basis: { width: number; height: number }
): DrawnChevron {
  const width = px(element.style.width, 'chevron width');
  const height = px(element.style.height, 'chevron height');
  const shift = translationOf(element.style.transform, width, height);
  const left = lengthOf(element.style.left, basis.width, 'chevron left') + shift.x;
  const top = lengthOf(element.style.top, basis.height, 'chevron top') + shift.y;
  const arrow: Box = { left, top, right: left + width, bottom: top + height };
  const centre = { x: left + width / 2, y: top + height / 2 };

  const svg = element.querySelector('svg');
  expect(svg, 'the chevron has an arrow graphic').toBeTruthy();
  const rotation = rotationOf((svg as SVGElement).style.transform);

  const labelNode = element.querySelector<HTMLElement>('.offscreen-chevron-distance');
  const text = labelNode?.textContent ?? '';
  let label: Box | null = null;
  if (labelNode && text !== '') {
    const fontPx = px(labelNode.style.fontSize, 'label font size');
    const labelWidth = textWidth(text, fontPx);
    const labelHeight = fontPx * Number(labelNode.style.lineHeight || '1.2');
    const labelShift = translationOf(labelNode.style.transform, labelWidth, labelHeight);
    const labelLeft = left + lengthOf(labelNode.style.left, width, 'label left') + labelShift.x;
    const labelTop = top + lengthOf(labelNode.style.top, height, 'label top') + labelShift.y;
    label = {
      left: labelLeft,
      top: labelTop,
      right: labelLeft + labelWidth,
      bottom: labelTop + labelHeight,
    };
  }
  return { centre, arrow, label, text, rotation };
}

/** 箭头盒与标签各自的矩形 */
export function partsOf(chevron: DrawnChevron): Array<[name: string, box: Box]> {
  const parts: Array<[string, Box]> = [['arrow box', chevron.arrow]];
  if (chevron.label) parts.push(['distance label', chevron.label]);
  return parts;
}

/** 箭头（盒子或标签）离一组遮挡最近的空隙 */
export function clearanceOf(chevron: DrawnChevron, obstacles: readonly Rect[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const [, box] of partsOf(chevron)) {
    for (const obstacle of obstacles) {
      nearest = Math.min(nearest, gapBetween(box, boxOf(obstacle)));
    }
  }
  return nearest;
}

/**
 * 箭头图形实际画出的多边形顶点（屏幕坐标）：SVG 居中放在外层盒子里（盒子是居中的 flex），
 * path 的顶点按 viewBox 缩放，再绕 SVG 中心做它自己的 rotate / scale。
 */
export function arrowInkOf(element: HTMLElement, chevron: DrawnChevron): Point[] {
  const svg = element.querySelector('svg') as SVGSVGElement | null;
  expect(svg, 'the chevron has an arrow graphic').toBeTruthy();
  const graphic = svg as SVGSVGElement;
  const width = Number(graphic.getAttribute('width'));
  const height = Number(graphic.getAttribute('height'));
  const viewBox = (graphic.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  expect(viewBox, 'the arrow graphic has a viewBox').toHaveLength(4);
  const [minX, minY, boxWidth, boxHeight] = viewBox;
  expect(Number.isFinite(width * height * boxWidth * boxHeight), 'arrow graphic size').toBe(true);

  const numbers = [
    ...(graphic.querySelector('path')?.getAttribute('d') ?? '').matchAll(/-?\d*\.?\d+/g),
  ].map((match) => Number(match[0]));
  expect(numbers.length, 'the arrow graphic is a polygon').toBeGreaterThanOrEqual(6);

  const transform = graphic.style.transform;
  const radians = (rotationOf(transform) * Math.PI) / 180;
  const scale = scaleOf(transform);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points: Point[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    // 相对 SVG 中心的像素坐标
    const x = ((numbers[index] - minX) / boxWidth - 0.5) * width * scale;
    const y = ((numbers[index + 1] - minY) / boxHeight - 0.5) * height * scale;
    points.push({
      x: chevron.centre.x + x * cos - y * sin,
      y: chevron.centre.y + x * sin + y * cos,
    });
  }
  return points;
}

/**
 * 一个矩形与一个多边形（取它的凸包）之间的空隙：分离轴上最大的间隔，重叠时为负。
 * 对凸形来说这是真实距离的下界，用来断言“至少隔开这么多”足够了。
 */
export function gapToPolygon(box: Box, polygon: readonly Point[]): number {
  const corners: Point[] = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ];
  const axes: Point[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  // 多边形任意两点连线的法线：凸包的每条边都在其中
  for (let a = 0; a < polygon.length; a++) {
    for (let b = a + 1; b < polygon.length; b++) {
      const dx = polygon[b].x - polygon[a].x;
      const dy = polygon[b].y - polygon[a].y;
      const length = Math.hypot(dx, dy);
      if (length > 1e-9) axes.push({ x: -dy / length, y: dx / length });
    }
  }
  let widest = Number.NEGATIVE_INFINITY;
  for (const axis of axes) {
    const project = (points: readonly Point[]): [number, number] => {
      let low = Number.POSITIVE_INFINITY;
      let high = Number.NEGATIVE_INFINITY;
      for (const point of points) {
        const value = point.x * axis.x + point.y * axis.y;
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
      return [low, high];
    };
    const [boxLow, boxHigh] = project(corners);
    const [polygonLow, polygonHigh] = project(polygon);
    widest = Math.max(widest, boxLow - polygonHigh, polygonLow - boxHigh);
  }
  return widest;
}
