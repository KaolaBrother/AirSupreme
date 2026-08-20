/**
 * 屏幕外指向箭头：尖端朝上的 SVG，距离标签反向旋转保持水平。
 * 导弹威胁会随距离放大（1.0→1.35）并加快脉冲（1.2Hz→3Hz）。
 */

export type OffscreenChevronKind = 'enemy' | 'missile';

export interface OffscreenChevronOptions {
  color: string;
}

export interface OffscreenChevronUpdate {
  rotationDeg: number;
  distance: number;
  kind?: OffscreenChevronKind;
}

const CHEVRON_STYLE_ID = 'offscreen-chevron-style';
const CHEVRON_PULSE_NAME = 'offscreen-chevron-pulse';

const MISSILE_FAR_DISTANCE = 900;
const MISSILE_NEAR_DISTANCE = 12;
const MISSILE_FAR_SCALE = 1;
const MISSILE_NEAR_SCALE = 1.35;
const MISSILE_FAR_HZ = 1.2;
const MISSILE_NEAR_HZ = 3;

function missileProximity(distance: number): number {
  if (distance <= MISSILE_NEAR_DISTANCE) {
    return 1;
  }
  if (distance >= MISSILE_FAR_DISTANCE) {
    return 0;
  }
  return (
    1 -
    (distance - MISSILE_NEAR_DISTANCE) / (MISSILE_FAR_DISTANCE - MISSILE_NEAR_DISTANCE)
  );
}

function ensureChevronStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(CHEVRON_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = CHEVRON_STYLE_ID;
  style.textContent = `
@keyframes ${CHEVRON_PULSE_NAME} {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
`;
  document.head.appendChild(style);
}

export class OffscreenChevron {
  public readonly element: HTMLDivElement;
  public readonly root: HTMLDivElement;

  private readonly svg: SVGSVGElement;
  private readonly label: HTMLSpanElement;

  constructor(options: OffscreenChevronOptions) {
    ensureChevronStyle();
    const color = options.color;

    this.element = document.createElement('div');
    this.element.className = 'offscreen-chevron';
    this.element.style.cssText = `
      position: absolute;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transform-origin: 50% 50%;
      contain: layout style paint;
      will-change: transform, left, top, opacity;
    `;
    this.root = this.element;

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '28');
    this.svg.setAttribute('height', '28');
    this.svg.setAttribute('viewBox', '0 0 24 24');
    this.svg.setAttribute('fill', color);
    this.svg.style.cssText = `
      display: block;
      overflow: visible;
      transform-origin: 50% 50%;
    `;

    // 尖端朝上（最小 y 为顶点，且水平居中）
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2 L20 20 L12 15 L4 20 Z');
    path.setAttribute('fill', color);
    this.svg.appendChild(path);

    this.label = document.createElement('span');
    this.label.className = 'offscreen-chevron-distance';
    this.label.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      color: ${color};
      font-size: 11px;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95);
      white-space: nowrap;
      pointer-events: none;
      transform-origin: 50% 0;
    `;

    this.element.appendChild(this.svg);
    this.element.appendChild(this.label);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(state: OffscreenChevronUpdate): void {
    const rotationDeg = state.rotationDeg;
    this.element.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`;
    this.label.style.transform = `translateX(-50%) rotate(${-rotationDeg}deg)`;
    this.label.textContent = `${Math.round(state.distance)}m`;

    const isMissile = state.kind === 'missile';
    if (!isMissile) {
      this.svg.style.transform = 'scale(1)';
      this.element.style.animation = 'none';
      this.element.style.animationDuration = '';
      return;
    }

    const proximity = missileProximity(state.distance);
    const scale = MISSILE_FAR_SCALE + proximity * (MISSILE_NEAR_SCALE - MISSILE_FAR_SCALE);
    const hz = MISSILE_FAR_HZ + proximity * (MISSILE_NEAR_HZ - MISSILE_FAR_HZ);
    const periodMs = 1000 / hz;

    this.svg.style.transform = `scale(${scale})`;
    this.element.style.animation = `${CHEVRON_PULSE_NAME} ${periodMs}ms ease-in-out infinite`;
    this.element.style.animationDuration = `${periodMs}ms`;
  }

  public dispose(): void {
    this.element.remove();
  }
}
