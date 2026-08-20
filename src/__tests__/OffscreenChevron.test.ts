import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OffscreenChevron } from '@/ui/OffscreenChevron';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';

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
  return ((actual - expected) % 360 + 540) % 360 - 180;
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
      Number(match[0]),
    );
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      points.push({ x: numbers[i], y: numbers[i + 1] });
    }
  }
  for (const shape of svg.querySelectorAll('polygon, polyline')) {
    const numbers = [...(shape.getAttribute('points') ?? '').matchAll(/-?\d*\.?\d+/g)].map((match) =>
      Number(match[0]),
    );
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      points.push({ x: numbers[i], y: numbers[i + 1] });
    }
  }
  return points;
}

function assertTipUp(svg: SVGElement): void {
  const points = parseSvgPoints(svg);
  expect(points.length, 'expected SVG path/polygon points for a tip-up chevron').toBeGreaterThanOrEqual(
    3,
  );
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
    (element.textContent ?? '').includes(expected),
  );
  expect(candidates.length, `expected a distance label containing ${expected}`).toBeGreaterThan(0);
  const leaf = candidates.find((element) =>
    Array.from(element.children).every(
      (child) => !(child.textContent ?? '').includes(expected),
    ),
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
    (match) => 1000 / Number(match[1]),
  );
  const inline = [
    host.style.animationDuration,
    ...Array.from(host.querySelectorAll<HTMLElement>('*')).map(
      (element) => element.style.animationDuration,
    ),
  ]
    .map((value) => (value ? durationToMs(value) : null))
    .filter((value): value is number => value != null);

  return [...new Set([...fromCss, ...fromHz, ...inline].filter((value) => value >= 80 && value <= 2000))];
}

function closestPeriod(periods: number[], targetMs: number): number | null {
  if (periods.length === 0) {
    return null;
  }
  return periods.reduce((best, value) =>
    Math.abs(value - targetMs) < Math.abs(best - targetMs) ? value : best,
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
      'distance label must counter-rotate to stay horizontal',
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
