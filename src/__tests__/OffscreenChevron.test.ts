import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OffscreenChevron } from '@/ui/OffscreenChevron';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';
import {
  angleDelta,
  arrowInkOf,
  gapToPolygon,
  readChevron,
  rotationOf,
  type Box,
  type DrawnChevron,
  type Point,
} from './chevronDom';

type ChevronKind = 'enemy' | 'missile';

type ChevronUpdate = {
  rotationDeg: number;
  distance: number;
  kind?: ChevronKind;
};

type ChevronApi = {
  element?: HTMLElement;
  root?: HTMLElement;
  el?: HTMLElement;
  container?: HTMLElement;
  update?: (state: ChevronUpdate) => void;
  dispose?: () => void;
  getElement?: () => HTMLElement;
};

function asApi(chevron: OffscreenChevron): ChevronApi {
  return chevron as unknown as ChevronApi;
}

function hostOf(chevron: OffscreenChevron): HTMLElement {
  const api = asApi(chevron);
  const node = api.element ?? api.root ?? api.el ?? api.container ?? api.getElement?.();
  if (node) {
    if (!node.isConnected) {
      document.body.appendChild(node);
    }
    return node;
  }

  const svg = document.querySelector('svg');
  expect(svg, 'OffscreenChevron should expose element/root or mount an SVG').toBeTruthy();
  return (svg?.parentElement ?? svg) as HTMLElement;
}

function parseRotateDeg(transform: string): number {
  let total = 0;
  const matches = transform.matchAll(/rotate\(\s*(-?\d+(?:\.\d+)?)(deg)?\s*\)/gi);
  for (const match of matches) {
    total += Number(match[1]);
  }
  return total;
}

function parseScale(transform: string): number | null {
  const scale3d = transform.match(/scale3d\(\s*(-?\d+(?:\.\d+)?)/i);
  if (scale3d) {
    return Number(scale3d[1]);
  }
  const scale = transform.match(/scale\(\s*(-?\d+(?:\.\d+)?)/i);
  return scale ? Number(scale[1]) : null;
}

function elementTransform(element: Element): string {
  const styled = element as HTMLElement;
  return `${styled.style?.transform ?? ''} ${element.getAttribute('transform') ?? ''}`;
}

function wrapDegDelta(actual: number, expected: number): number {
  return ((((actual - expected) % 360) + 540) % 360) - 180;
}

function netRotateDeg(element: Element, until: Element): number {
  let total = 0;
  let current: Element | null = element;
  while (current) {
    total += parseRotateDeg(elementTransform(current));
    if (current === until) {
      break;
    }
    current = current.parentElement;
  }
  return total;
}

function parseSvgPoints(svg: SVGElement): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (const path of svg.querySelectorAll('path')) {
    const numbers = [...(path.getAttribute('d') ?? '').matchAll(/-?\d*\.?\d+/g)].map((match) =>
      Number(match[0])
    );
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      points.push({ x: numbers[i], y: numbers[i + 1] });
    }
  }
  for (const shape of svg.querySelectorAll('polygon, polyline')) {
    const numbers = [...(shape.getAttribute('points') ?? '').matchAll(/-?\d*\.?\d+/g)].map(
      (match) => Number(match[0])
    );
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      points.push({ x: numbers[i], y: numbers[i + 1] });
    }
  }
  return points;
}

function assertTipUp(svg: SVGElement): void {
  const points = parseSvgPoints(svg);
  expect(
    points.length,
    'expected SVG path/polygon points for a tip-up chevron'
  ).toBeGreaterThanOrEqual(3);
  const minY = Math.min(...points.map((point) => point.y));
  const xs = points.map((point) => point.x);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const tip = points.find((point) => point.y === minY);
  expect(tip, 'expected a vertex at the minimum SVG y (tip up)').toBeTruthy();
  const span = Math.max(...xs) - Math.min(...xs) || 1;
  expect(Math.abs((tip as { x: number }).x - midX)).toBeLessThan(span * 0.3);
}

function findDistanceLabel(host: HTMLElement, distance: number): HTMLElement {
  const expected = String(Math.round(distance));
  const candidates = Array.from(host.querySelectorAll<HTMLElement>('*')).filter((element) =>
    (element.textContent ?? '').includes(expected)
  );
  expect(candidates.length, `expected a distance label containing ${expected}`).toBeGreaterThan(0);
  const leaf = candidates.find((element) =>
    Array.from(element.children).every((child) => !(child.textContent ?? '').includes(expected))
  );
  return leaf ?? candidates[candidates.length - 1];
}

function subtreeStyle(host: HTMLElement): string {
  const chunks = [host.getAttribute('style') ?? '', host.innerHTML];
  for (const element of host.querySelectorAll<HTMLElement>('*')) {
    chunks.push(element.getAttribute('style') ?? '');
    chunks.push(element.getAttribute('transform') ?? '');
  }
  for (const style of document.querySelectorAll('style')) {
    chunks.push(style.textContent ?? '');
  }
  return chunks.join('\n');
}

function readMaxScale(host: HTMLElement): number {
  const scales: number[] = [];
  const visit = (element: Element): void => {
    const transform =
      (element as HTMLElement).style?.transform || element.getAttribute('transform') || '';
    const fromTransform = parseScale(transform);
    if (fromTransform != null) {
      scales.push(fromTransform);
    }
    const styleScale = (element as HTMLElement).style?.scale;
    if (styleScale) {
      const value = Number(String(styleScale).split(' ')[0]);
      if (Number.isFinite(value)) {
        scales.push(value);
      }
    }
  };
  visit(host);
  host.querySelectorAll('*').forEach(visit);
  return scales.length > 0 ? Math.max(...scales) : 1;
}

function durationToMs(raw: string): number | null {
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)(ms|s)$/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return match[2].toLowerCase() === 'ms' ? value : value * 1000;
}

function readPulsePeriodsMs(host: HTMLElement): number[] {
  const css = subtreeStyle(host);
  const fromCss = [...css.matchAll(/(\d+(?:\.\d+)?)(ms|s)/gi)].map((match) => {
    const value = Number(match[1]);
    return match[2].toLowerCase() === 'ms' ? value : value * 1000;
  });
  const fromHz = [...css.matchAll(/(\d+(?:\.\d+)?)\s*hz/gi)].map(
    (match) => 1000 / Number(match[1])
  );
  const inline = [
    host.style.animationDuration,
    ...Array.from(host.querySelectorAll<HTMLElement>('*')).map(
      (element) => element.style.animationDuration
    ),
  ]
    .map((value) => (value ? durationToMs(value) : null))
    .filter((value): value is number => value != null);

  return [
    ...new Set([...fromCss, ...fromHz, ...inline].filter((value) => value >= 80 && value <= 2000)),
  ];
}

function closestPeriod(periods: number[], targetMs: number): number | null {
  if (periods.length === 0) {
    return null;
  }
  return periods.reduce((best, value) =>
    Math.abs(value - targetMs) < Math.abs(best - targetMs) ? value : best
  );
}

describe('OffscreenChevron', () => {
  const chevrons: OffscreenChevron[] = [];

  beforeEach(() => {
    document.body.innerHTML = '';
    injectHudTokens();
    chevrons.length = 0;
  });

  afterEach(() => {
    for (const chevron of chevrons) {
      asApi(chevron).dispose?.();
    }
    chevrons.length = 0;
    document.body.innerHTML = '';
  });

  it('renders a tip-up SVG whose fill uses the color param', () => {
    const color = '#ab34cd';
    const chevron = new OffscreenChevron({ color });
    chevrons.push(chevron);
    const api = asApi(chevron);
    const early = api.element ?? api.root ?? api.el ?? api.container;
    if (early && !early.isConnected) {
      document.body.appendChild(early);
    }
    api.update?.({
      rotationDeg: 0,
      distance: 240,
      kind: 'enemy',
    });
    const host = hostOf(chevron);

    const svg = host.querySelector('svg');
    expect(svg, 'expected a tip-up SVG chevron, not a CSS border triangle').toBeTruthy();
    assertTipUp(svg as SVGElement);

    const painted = `${svg?.outerHTML ?? ''}\n${host.getAttribute('style') ?? ''}\n${
      host.style.color
    }`;
    expect(painted.toLowerCase()).toContain(color);
  });

  it('counter-rotates the distance label so the text stays horizontal', () => {
    const chevron = new OffscreenChevron({ color: HUD_COLORS.weapon });
    chevrons.push(chevron);
    const api = asApi(chevron);
    const early = api.element ?? api.root ?? api.el ?? api.container;
    if (early && !early.isConnected) {
      document.body.appendChild(early);
    }
    const rotationDeg = 135;

    expect(api.update, 'OffscreenChevron.update should exist').toEqual(expect.any(Function));
    api.update?.({
      rotationDeg,
      distance: 418,
      kind: 'enemy',
    });
    const host = hostOf(chevron);

    const svg = host.querySelector('svg');
    expect(svg).toBeTruthy();
    const label = findDistanceLabel(host, 418);

    const svgNet = netRotateDeg(svg as SVGElement, host);
    expect(Math.abs(wrapDegDelta(svgNet, rotationDeg))).toBeLessThan(1);

    const labelNet = netRotateDeg(label, host);
    expect(
      Math.abs(wrapDegDelta(labelNet, 0)),
      'distance label must counter-rotate to stay horizontal'
    ).toBeLessThan(1);
  });

  it('scales a near missile from 1.0 to 1.35 and pulses faster than a far missile', () => {
    const chevron = new OffscreenChevron({ color: HUD_COLORS.threat });
    chevrons.push(chevron);
    const api = asApi(chevron);
    const early = api.element ?? api.root ?? api.el ?? api.container;
    if (early && !early.isConnected) {
      document.body.appendChild(early);
    }
    expect(api.update, 'OffscreenChevron.update should exist').toEqual(expect.any(Function));

    api.update?.({
      rotationDeg: 40,
      distance: 900,
      kind: 'missile',
    });
    const host = hostOf(chevron);
    const farScale = readMaxScale(host);
    const farPeriod = closestPeriod(readPulsePeriodsMs(host), 1000 / 1.2);

    api.update?.({
      rotationDeg: 40,
      distance: 12,
      kind: 'missile',
    });
    const nearScale = readMaxScale(host);
    const nearPeriod = closestPeriod(readPulsePeriodsMs(host), 1000 / 3);

    expect(farScale).toBeCloseTo(1.0, 1);
    expect(nearScale).toBeCloseTo(1.35, 1);
    expect(nearScale).toBeGreaterThan(farScale);

    expect(farPeriod, 'far missile should pulse (1.2Hz ≈ 833ms)').not.toBeNull();
    expect(nearPeriod, 'near missile should pulse faster (3Hz ≈ 333ms)').not.toBeNull();
    expect(farPeriod as number).toBeGreaterThan(650);
    expect(farPeriod as number).toBeLessThan(1000);
    expect(nearPeriod as number).toBeGreaterThan(250);
    expect(nearPeriod as number).toBeLessThan(450);
    expect(nearPeriod as number).toBeLessThan(farPeriod as number);
  });
});

/*
 * 距离标签在每条屏幕边上都读得全（规格 P2）：
 * - 箭头指向任何方向，标签都是正的、完整的。以前外层盒子跟着箭头旋转并带 paint 隔离，标签落在
 *   盒子外面，于是在左、右、上三条边上被裁掉。现在：外层元素不旋转，contain 里没有 paint；
 *   只有箭头图形旋转；标签在箭头的尾侧，不压着箭头。
 * - 距离不是有限数：不显示标签（不是 “NaNm”）；旋转角不是有限数：按 0 处理。
 *
 * jsdom 不做布局，标签与箭头图形画在哪里按内联样式还原（见 chevronDom.ts）。
 */
describe('OffscreenChevron distance label', () => {
  /** 箭头所在的全屏图层，以及使用方写在 left / top 上的箭头中心 */
  const LAYER = { width: 800, height: 600 };
  const CENTRE: Point = { x: 400, y: 300 };
  /** 每 15° 一个方向：含四条边（0 / 90 / 180 / 270）与四个角（45 / 135 / 225 / 315） */
  const DIRECTIONS = Array.from({ length: 24 }, (_unused, index) => index * 15);
  /** 一到五位数的距离 */
  const DISTANCES = [7, 85, 420, 3400, 12800];
  const NON_FINITE: ReadonlyArray<[name: string, value: number]> = [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ];
  /** “不压着箭头”：标签与箭头图形之间至少留这么多 */
  const MIN_LABEL_GAP_PX = 1;
  /** “在箭头旁边”：再远就读不出它是这枚箭头的距离了（我的判断，不是规格里的数） */
  const MAX_LABEL_GAP_PX = 20;
  /** “尾侧”：标签中心的方向与箭头的反方向相差不超过这么多 */
  const TAIL_SIDE_TOLERANCE_DEG = 45;

  const mounted: OffscreenChevron[] = [];

  beforeEach(() => {
    document.body.innerHTML = '';
    injectHudTokens();
  });

  afterEach(() => {
    for (const chevron of mounted) chevron.dispose();
    mounted.length = 0;
    document.body.innerHTML = '';
  });

  /** 一枚挂在图层里、中心在 CENTRE 的箭头 */
  function mount(): OffscreenChevron {
    const chevron = new OffscreenChevron({ color: HUD_COLORS.weapon });
    mounted.push(chevron);
    chevron.element.style.left = `${CENTRE.x}px`;
    chevron.element.style.top = `${CENTRE.y}px`;
    document.body.appendChild(chevron.element);
    return chevron;
  }

  function show(state: ChevronUpdate): OffscreenChevron {
    const chevron = mount();
    chevron.update(state);
    return chevron;
  }

  const drawn = (chevron: OffscreenChevron): DrawnChevron => readChevron(chevron.element, LAYER);

  function graphicOf(chevron: OffscreenChevron): SVGSVGElement {
    const svg = chevron.element.querySelector('svg');
    expect(svg, 'the chevron has an arrow graphic').toBeTruthy();
    return svg as SVGSVGElement;
  }

  /** 箭头图形之外、带文字的那个元素 */
  function labelOf(chevron: OffscreenChevron): HTMLElement {
    const label = chevron.element.querySelector<HTMLElement>('.offscreen-chevron-distance');
    expect(label, 'the chevron has a distance label element').toBeTruthy();
    return label as HTMLElement;
  }

  /** 从一个元素往上到箭头的外层元素（含两端） */
  function upToRoot(chevron: OffscreenChevron, from: Element): HTMLElement[] {
    const chain: HTMLElement[] = [];
    for (let node: Element | null = from; node; node = node.parentElement) {
      chain.push(node as HTMLElement);
      if (node === chevron.element) return chain;
    }
    throw new Error('the element is not inside the chevron');
  }

  /** 一个元素会不会转动它的内容：transform 里的旋转 / 矩阵 / 斜切，或单独的 rotate 属性 */
  function turns(element: HTMLElement | SVGElement): boolean {
    const rotate = element.style.getPropertyValue('rotate');
    return (
      /rotate|matrix|skew/i.test(element.style.transform) ||
      element.hasAttribute('transform') ||
      (rotate !== '' && rotate !== 'none')
    );
  }

  /** 一个元素会不会把画在它盒子外面的内容裁掉 */
  function clipping(element: HTMLElement): string[] {
    const found: string[] = [];
    const contain = element.style.getPropertyValue('contain');
    if (/\b(?:paint|strict|content)\b/.test(contain)) found.push(`contain: ${contain}`);
    for (const property of ['overflow', 'overflow-x', 'overflow-y']) {
      const value = element.style.getPropertyValue(property);
      if (value !== '' && value !== 'visible') found.push(`${property}: ${value}`);
    }
    for (const property of ['clip-path', 'clip', 'mask', 'mask-image', 'content-visibility']) {
      const value = element.style.getPropertyValue(property);
      if (value !== '' && value !== 'none' && value !== 'auto' && value !== 'visible') {
        found.push(`${property}: ${value}`);
      }
    }
    return found;
  }

  const pointingOf = (direction: number): Point => ({
    x: Math.sin((direction * Math.PI) / 180),
    y: -Math.cos((direction * Math.PI) / 180),
  });

  const centreOf = (box: Box): Point => ({
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
  });

  /** 画面上看得出的全部状态：两枚箭头的这份东西一样，它们画出来就一样 */
  function appearance(chevron: OffscreenChevron): Record<string, string> {
    const label = labelOf(chevron);
    return {
      root: chevron.element.style.transform,
      graphic: graphicOf(chevron).style.transform,
      label: label.style.transform,
      text: chevron.element.textContent ?? '',
    };
  }

  /** 每个方向 × 每种位数的距离 */
  function eachCase(visit: (direction: number, distance: number, what: string) => void): void {
    for (const direction of DIRECTIONS) {
      for (const distance of DISTANCES) {
        visit(direction, distance, `pointing ${direction}°, ${distance} m`);
      }
    }
  }

  it('never rotates the root element, whatever the direction', () => {
    for (const direction of DIRECTIONS) {
      for (const kind of ['enemy', 'missile'] as const) {
        const chevron = show({ rotationDeg: direction, distance: 420, kind });
        expect(turns(chevron.element), `${kind} pointing ${direction}°`).toBe(false);
        expect(chevron.element.style.transform, `${kind} pointing ${direction}°`).not.toMatch(
          /scale/i
        );
      }
    }
  });

  it('has no paint containment or clipping on the root element', () => {
    const fresh = mount();
    expect(clipping(fresh.element), 'before the first update').toEqual([]);
    for (const direction of [0, 90, 180, 270, 45, 225]) {
      for (const kind of ['enemy', 'missile'] as const) {
        const chevron = show({ rotationDeg: direction, distance: 12, kind });
        for (const element of upToRoot(chevron, labelOf(chevron))) {
          expect(clipping(element), `${kind} pointing ${direction}°`).toEqual([]);
        }
      }
    }
  });

  it('rotates only the arrow graphic, to the direction asked for', () => {
    const upright = show({ rotationDeg: 0, distance: 420, kind: 'enemy' });
    const uprightInk = arrowInkOf(upright.element, drawn(upright));
    // 不转的时候尖端朝上：纵坐标最小的那个顶点
    const tipIndex = uprightInk.reduce(
      (best, point, index) => (point.y < uprightInk[best].y ? index : best),
      0
    );
    expect(uprightInk[tipIndex].x).toBeCloseTo(CENTRE.x, 1);

    for (const direction of DIRECTIONS) {
      for (const kind of ['enemy', 'missile'] as const) {
        const what = `${kind} pointing ${direction}°`;
        const chevron = show({ rotationDeg: direction, distance: 30, kind });
        const graphic = graphicOf(chevron);
        expect(angleDelta(rotationOf(graphic.style.transform), direction), what).toBeCloseTo(0, 5);

        const tip = arrowInkOf(chevron.element, drawn(chevron))[tipIndex];
        const bearing = (Math.atan2(tip.x - CENTRE.x, -(tip.y - CENTRE.y)) * 180) / Math.PI;
        expect(Math.abs(angleDelta(bearing, direction)), `${what}: where the tip is`).toBeLessThan(
          1
        );
        // 标签和它上面的每一层都不转
        for (const element of upToRoot(chevron, labelOf(chevron))) {
          expect(turns(element), `${what}: <${element.tagName.toLowerCase()}>`).toBe(false);
        }
      }
    }
  });

  it('rounds a fractional direction to a whole degree instead of dropping it', () => {
    const chevron = show({ rotationDeg: 44.6, distance: 420, kind: 'enemy' });
    const rotation = rotationOf(graphicOf(chevron).style.transform);
    expect(Math.abs(angleDelta(rotation, 44.6))).toBeLessThanOrEqual(0.5);
  });

  it('shows the label upright, on one line and not hidden', () => {
    eachCase((direction, distance, what) => {
      const chevron = show({ rotationDeg: direction, distance, kind: 'enemy' });
      const label = labelOf(chevron);
      expect(label.textContent, what).toMatch(new RegExp(`^${distance}\\s?m$`));
      expect(turns(label), what).toBe(false);
      expect(label.style.transform, what).not.toMatch(/scale/i);
      expect(label.style.getPropertyValue('writing-mode'), what).toMatch(/^(?:horizontal-tb)?$/);
      // 一行：这里按一行文字的宽度还原它的位置
      expect(label.style.whiteSpace, what).toBe('nowrap');
      expect(label.style.display, what).not.toBe('none');
      expect(label.style.visibility, what).not.toBe('hidden');
      expect(label.style.opacity, what).not.toBe('0');
      expect(Number.parseFloat(label.style.fontSize), what).toBeGreaterThanOrEqual(10);
    });
  });

  it('puts the label on the tail side of the arrow', () => {
    eachCase((direction, distance, what) => {
      const chevron = show({ rotationDeg: direction, distance, kind: 'enemy' });
      const { label, centre } = drawn(chevron);
      expect(label, what).not.toBeNull();
      const labelCentre = centreOf(label as Box);
      const offset = { x: labelCentre.x - centre.x, y: labelCentre.y - centre.y };
      const pointing = pointingOf(direction);
      const along = offset.x * pointing.x + offset.y * pointing.y;
      expect(along, `${what}: behind the arrow, not in front of it`).toBeLessThan(0);

      const tailBearing = (Math.atan2(-pointing.x, pointing.y) * 180) / Math.PI;
      const labelBearing = (Math.atan2(offset.x, -offset.y) * 180) / Math.PI;
      expect(
        Math.abs(angleDelta(labelBearing, tailBearing)),
        `${what}: degrees off the tail axis`
      ).toBeLessThanOrEqual(TAIL_SIDE_TOLERANCE_DEG);
    });
  });

  it('keeps the label clear of the arrow graphic, and next to it', () => {
    eachCase((direction, distance, what) => {
      const chevron = show({ rotationDeg: direction, distance, kind: 'enemy' });
      const picture = drawn(chevron);
      const gap = gapToPolygon(picture.label as Box, arrowInkOf(chevron.element, picture));
      expect(gap, `${what}: gap between label and arrow`).toBeGreaterThanOrEqual(MIN_LABEL_GAP_PX);
      expect(gap, `${what}: gap between label and arrow`).toBeLessThanOrEqual(MAX_LABEL_GAP_PX);
    });
  });

  it('keeps the label clear of a missile arrow as it grows', () => {
    for (const direction of DIRECTIONS) {
      for (const distance of [12, 60, 250, 640, 900, 2400]) {
        const what = `missile pointing ${direction}°, ${distance} m`;
        const chevron = show({ rotationDeg: direction, distance, kind: 'missile' });
        const picture = drawn(chevron);
        expect(picture.label, what).not.toBeNull();
        const gap = gapToPolygon(picture.label as Box, arrowInkOf(chevron.element, picture));
        expect(gap, `${what}: gap between label and arrow`).toBeGreaterThanOrEqual(
          MIN_LABEL_GAP_PX
        );
        expect(gap, `${what}: gap between label and arrow`).toBeLessThanOrEqual(MAX_LABEL_GAP_PX);
      }
    }
  });

  it('draws the same thing whatever the chevron showed before', () => {
    const reused = mount();
    const steps: ChevronUpdate[] = [
      { rotationDeg: 0, distance: 100, kind: 'enemy' },
      { rotationDeg: 90, distance: 100, kind: 'enemy' },
      { rotationDeg: 90, distance: 12000, kind: 'enemy' },
      { rotationDeg: 90, distance: 5, kind: 'enemy' },
      { rotationDeg: 270, distance: 5, kind: 'enemy' },
      { rotationDeg: 270, distance: 40, kind: 'missile' },
      { rotationDeg: 270, distance: 40, kind: 'enemy' },
      { rotationDeg: 270, distance: Number.NaN, kind: 'enemy' },
      { rotationDeg: 270, distance: 300, kind: 'enemy' },
      { rotationDeg: Number.NaN, distance: 300, kind: 'enemy' },
      { rotationDeg: 45, distance: 300, kind: 'enemy' },
      { rotationDeg: 0, distance: 100, kind: 'enemy' },
    ];
    steps.forEach((step, index) => {
      reused.update(step);
      const what = `step ${index}: ${step.kind} at ${step.rotationDeg}°, ${step.distance} m`;
      expect(appearance(reused), what).toEqual(appearance(show(step)));
    });
  });

  describe('a distance that is not a finite number', () => {
    it.each(NON_FINITE)('shows no label for %s', (_name, distance) => {
      for (const direction of [0, 90, 180, 270]) {
        for (const kind of ['enemy', 'missile'] as const) {
          const chevron = show({ rotationDeg: direction, distance, kind });
          expect(chevron.element.textContent, `${kind} pointing ${direction}°`).toBe('');
          expect(drawn(chevron).label).toBeNull();
          // 箭头照常指向，样式里也不混进 NaN
          expect(rotationOf(graphicOf(chevron).style.transform)).toBe(direction);
          expect(chevron.element.outerHTML).not.toMatch(/NaN|Infinity/);
        }
      }
    });

    it.each(NON_FINITE)('clears a label already shown when the distance becomes %s', (_n, bad) => {
      const chevron = show({ rotationDeg: 90, distance: 640, kind: 'enemy' });
      expect(chevron.element.textContent).toMatch(/^640\s?m$/);
      chevron.update({ rotationDeg: 90, distance: bad, kind: 'enemy' });
      expect(chevron.element.textContent).toBe('');
      chevron.update({ rotationDeg: 90, distance: 655, kind: 'enemy' });
      expect(chevron.element.textContent).toMatch(/^655\s?m$/);
    });

    it('shows a distance of zero', () => {
      const chevron = show({ rotationDeg: 0, distance: 0, kind: 'enemy' });
      expect(chevron.element.textContent).toMatch(/^0\s?m$/);
    });
  });

  describe('a rotation that is not a finite number', () => {
    it.each(NON_FINITE)('draws %s exactly like a rotation of 0', (_name, rotation) => {
      for (const distance of DISTANCES) {
        const expected = appearance(show({ rotationDeg: 0, distance, kind: 'enemy' }));
        const fresh = show({ rotationDeg: rotation, distance, kind: 'enemy' });
        expect(appearance(fresh), `${distance} m`).toEqual(expected);
        expect(fresh.element.outerHTML, `${distance} m`).not.toMatch(/NaN|Infinity/);
      }
    });

    it.each(NON_FINITE)('goes back to 0 when a turned chevron is given %s', (_name, rotation) => {
      const expected = appearance(show({ rotationDeg: 0, distance: 420, kind: 'enemy' }));
      const chevron = show({ rotationDeg: 135, distance: 420, kind: 'enemy' });
      expect(appearance(chevron)).not.toEqual(expected);
      chevron.update({ rotationDeg: rotation, distance: 420, kind: 'enemy' });
      expect(appearance(chevron)).toEqual(expected);
      expect(rotationOf(graphicOf(chevron).style.transform)).toBe(0);
    });

    it.each(NON_FINITE)('still shows the missile growth and label for %s', (_name, rotation) => {
      const expected = appearance(show({ rotationDeg: 0, distance: 60, kind: 'missile' }));
      const chevron = show({ rotationDeg: rotation, distance: 60, kind: 'missile' });
      expect(appearance(chevron)).toEqual(expected);
      expect(chevron.element.textContent).toMatch(/^60\s?m$/);
    });
  });
});
