/**
 * 屏幕外指向箭头：尖端朝上的 SVG 按方位旋转；距离标签不跟着转，始终水平，放在箭头的尾侧
 * （指向的反方向）并与箭头留出间隙——四条屏幕边和四个角上都读得全，也不压在箭头上。
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

/** 箭头加距离标签相对箭头中心的占位（px，屏幕坐标：x 向右、y 向下） */
export interface ChevronFootprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const CHEVRON_STYLE_ID = 'offscreen-chevron-style';
const CHEVRON_PULSE_NAME = 'offscreen-chevron-pulse';

const MISSILE_FAR_DISTANCE = 900;
const MISSILE_NEAR_DISTANCE = 12;
const MISSILE_FAR_SCALE = 1;
const MISSILE_NEAR_SCALE = 1.35;
const MISSILE_FAR_HZ = 1.2;
const MISSILE_NEAR_HZ = 3;

/** 外层盒子的边长与半边长（px）：占位按整个盒子算，旋转后的 SVG 外接框也在其中 */
const BOX_SIZE_PX = 40;
const ARROW_HALF_PX = BOX_SIZE_PX / 2;
/** 箭头图形离中心最远的墨迹（两翼尖，未放大） */
const ARROW_INK_RADIUS_PX = 13.5;
/** 标签与箭头之间的间隙 */
const LABEL_GAP_PX = 3;
const LABEL_FONT_PX = 11;
/** 标签半高：行高等于字号 */
const LABEL_HALF_HEIGHT_PX = 6;
/** 11px 粗体数字 / 单位 “m” 的宽度估算（按 Arial 取值并略放宽）：不读布局就能算出标签半宽 */
const LABEL_DIGIT_WIDTH_PX = 6.4;
const LABEL_UNIT_WIDTH_PX = 10.4;
const LABEL_MAX_DIGITS = 5;
const DEG_TO_RAD = Math.PI / 180;

/**
 * 一枚箭头（含距离标签）最大的宽与高：标签横在箭头一侧时最宽、竖在箭头上 / 下方时最高。
 * 避让逻辑用它判断两块遮挡之间的空隙放不放得下一枚箭头。
 */
export const CHEVRON_MAX_WIDTH_PX =
  ARROW_HALF_PX +
  ARROW_INK_RADIUS_PX +
  LABEL_GAP_PX +
  LABEL_MAX_DIGITS * LABEL_DIGIT_WIDTH_PX +
  LABEL_UNIT_WIDTH_PX;
export const CHEVRON_MAX_HEIGHT_PX =
  ARROW_HALF_PX + ARROW_INK_RADIUS_PX + LABEL_GAP_PX + LABEL_HALF_HEIGHT_PX * 2;

function missileProximity(distance: number): number {
  if (!Number.isFinite(distance) || distance >= MISSILE_FAR_DISTANCE) {
    return 0;
  }
  if (distance <= MISSILE_NEAR_DISTANCE) {
    return 1;
  }
  return 1 - (distance - MISSILE_NEAR_DISTANCE) / (MISSILE_FAR_DISTANCE - MISSILE_NEAR_DISTANCE);
}

/** 箭头图形的放大倍数：敌方目标恒为 1，导弹随距离从 1.0 放大到 1.35 */
function chevronScale(kind: OffscreenChevronKind | undefined, distance: number): number {
  return kind === 'missile'
    ? MISSILE_FAR_SCALE + missileProximity(distance) * (MISSILE_NEAR_SCALE - MISSILE_FAR_SCALE)
    : 1;
}

/** 距离标签的半宽估算（px）：位数 × 数字宽 + 单位宽 */
function labelHalfWidth(roundedDistance: number): number {
  let digits = 1;
  for (let limit = 10; digits < LABEL_MAX_DIGITS && roundedDistance >= limit; limit *= 10) {
    digits += 1;
  }
  return (digits * LABEL_DIGIT_WIDTH_PX + LABEL_UNIT_WIDTH_PX) / 2;
}

/**
 * 标签中心离箭头中心的距离：沿尾侧方向（单位向量 tailX, tailY）推到整个标签盒都落在
 * 箭头墨迹的外接圆之外。方向连续变化时标签绕着箭头平滑移动，不会在某个角度跳边。
 */
function labelReach(tailX: number, tailY: number, halfWidth: number, scale: number): number {
  return (
    ARROW_INK_RADIUS_PX * scale +
    LABEL_GAP_PX +
    halfWidth * Math.abs(tailX) +
    LABEL_HALF_HEIGHT_PX * Math.abs(tailY)
  );
}

/**
 * 箭头加距离标签相对箭头中心的占位，写入 out（不分配）。kind 缺省按敌方目标箭头（不放大）；
 * 导弹箭头随距离放大，标签跟着外移，图形本身放到最大也仍在 40px 的盒子里。
 * 调用方据此让整枚箭头避开遮挡并留在屏幕内；与 OffscreenChevron.update 的摆放一致
 * （标签偏移同样取整），四个值都是整像素并向外取整。
 */
export function measureChevronFootprint(
  rotationDeg: number,
  distance: number,
  out: ChevronFootprint,
  kind?: OffscreenChevronKind
): ChevronFootprint {
  const radians = (Number.isFinite(rotationDeg) ? Math.round(rotationDeg) : 0) * DEG_TO_RAD;
  // 指向 (sin, -cos)，尾侧取反
  const tailX = -Math.sin(radians);
  const tailY = Math.cos(radians);
  const halfWidth = Number.isFinite(distance) ? labelHalfWidth(Math.round(distance)) : 0;
  const reach = labelReach(tailX, tailY, halfWidth, chevronScale(kind, distance));
  const labelX = Math.round(tailX * reach);
  const labelY = Math.round(tailY * reach);
  out.minX = Math.min(-ARROW_HALF_PX, Math.floor(labelX - halfWidth));
  out.maxX = Math.max(ARROW_HALF_PX, Math.ceil(labelX + halfWidth));
  out.minY = Math.min(-ARROW_HALF_PX, labelY - LABEL_HALF_HEIGHT_PX);
  out.maxY = Math.max(ARROW_HALF_PX, labelY + LABEL_HALF_HEIGHT_PX);
  return out;
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

  // 上一次写入的值：没有变化时不重写样式 / 文字
  private lastRotation: number = Number.NaN;
  private lastScale: number = Number.NaN;
  private lastDistance: number = Number.NaN;
  private lastLabelX: number = Number.NaN;
  private lastLabelY: number = Number.NaN;
  private lastPeriodMs: number = Number.NaN;

  constructor(options: OffscreenChevronOptions) {
    ensureChevronStyle();
    const color = options.color;

    // 外层只负责定位（中心对准 left / top），不旋转：标签的偏移直接按屏幕坐标写。
    // 不加 paint 隔离：标签画在这个 40px 盒子之外，paint 隔离会把它裁掉。
    this.element = document.createElement('div');
    this.element.className = 'offscreen-chevron';
    this.element.style.cssText = `
      position: absolute;
      width: ${BOX_SIZE_PX}px;
      height: ${BOX_SIZE_PX}px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transform: translate(-50%, -50%);
      contain: layout style;
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
      top: 50%;
      left: 50%;
      color: ${color};
      font-size: ${LABEL_FONT_PX}px;
      font-weight: bold;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
      pointer-events: none;
    `;

    this.element.appendChild(this.svg);
    this.element.appendChild(this.label);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public update(state: OffscreenChevronUpdate): void {
    // 取整到 1°：肉眼分不出，静止的箭头不再逐帧改写变换
    const rotation = Number.isFinite(state.rotationDeg) ? Math.round(state.rotationDeg) : 0;
    const isMissile = state.kind === 'missile';
    const proximity = isMissile ? missileProximity(state.distance) : 0;
    const scale = chevronScale(state.kind, state.distance);

    if (rotation !== this.lastRotation || scale !== this.lastScale) {
      this.svg.style.transform = `rotate(${rotation}deg) scale(${scale})`;
    }

    // 距离非有限：不显示 “NaNm”
    const distance = Number.isFinite(state.distance) ? Math.round(state.distance) : Number.NaN;
    if (!Object.is(distance, this.lastDistance)) {
      this.lastDistance = distance;
      this.label.textContent = Number.isFinite(distance) ? `${distance}m` : '';
    }

    // 标签：以自身中心定位在箭头尾侧，保持水平
    const radians = rotation * DEG_TO_RAD;
    const tailX = -Math.sin(radians);
    const tailY = Math.cos(radians);
    const halfWidth = Number.isFinite(distance) ? labelHalfWidth(distance) : 0;
    const reach = labelReach(tailX, tailY, halfWidth, scale);
    const labelX = Math.round(tailX * reach);
    const labelY = Math.round(tailY * reach);
    if (labelX !== this.lastLabelX || labelY !== this.lastLabelY) {
      this.lastLabelX = labelX;
      this.lastLabelY = labelY;
      this.label.style.transform = `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`;
    }
    this.lastRotation = rotation;
    this.lastScale = scale;

    if (!isMissile) {
      if (this.lastPeriodMs !== 0) {
        this.lastPeriodMs = 0;
        this.element.style.animation = 'none';
        this.element.style.animationDuration = '';
      }
      return;
    }

    const hz = MISSILE_FAR_HZ + proximity * (MISSILE_NEAR_HZ - MISSILE_FAR_HZ);
    const periodMs = 1000 / hz;
    if (periodMs !== this.lastPeriodMs) {
      this.lastPeriodMs = periodMs;
      this.element.style.animation = `${CHEVRON_PULSE_NAME} ${periodMs}ms ease-in-out infinite`;
      this.element.style.animationDuration = `${periodMs}ms`;
    }
  }

  public dispose(): void {
    this.element.remove();
  }
}
