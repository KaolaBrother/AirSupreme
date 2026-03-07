import { Quaternion, Vector3 } from 'three';
import type { Camera } from 'three';

export class BossMissileIndicator {
  private container: HTMLDivElement;
  private indicators: Map<
    string,
    {
      root: HTMLDivElement;
      distanceLabel: HTMLSpanElement;
    }
  > = new Map();
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();
  private readonly fromCamera = new Vector3();
  private readonly cameraLocal = new Vector3();
  private readonly invertedCameraQuaternion = new Quaternion();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'boss-missile-indicators';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 46;
    `;
    document.body.appendChild(this.container);
  }

  public update(
    missiles: Array<{
      id: string;
      worldPos: Vector3;
      distance: number;
      inView: boolean;
    }>,
    camera: Camera
  ): void {
    const activeIds = new Set(missiles.map((m) => m.id));

    for (const [id, indicator] of this.indicators) {
      if (!activeIds.has(id)) {
        indicator.root.remove();
        this.indicators.delete(id);
      }
    }

    for (const missile of missiles) {
      if (missile.inView) {
        this.hideIndicator(missile.id);
      } else {
        this.showOrUpdateIndicator(missile, camera);
      }
    }
  }

  private showOrUpdateIndicator(
    missile: {
      id: string;
      worldPos: Vector3;
      distance: number;
    },
    camera: Camera
  ): void {
    let indicator = this.indicators.get(missile.id);

    if (!indicator) {
      indicator = this.createIndicator();
      this.container.appendChild(indicator.root);
      this.indicators.set(missile.id, indicator);
    }

    const { arrowX, arrowY, rotation } = this.calculateIndicatorPosition(missile.worldPos, camera);

    this.setStyleValue(indicator.root, 'left', `${arrowX * 100}%`);
    this.setStyleValue(indicator.root, 'top', `${arrowY * 100}%`);
    this.setStyleValue(
      indicator.root,
      'transform',
      `translate(-50%, -50%) rotate(${rotation}deg)`
    );
    this.setTextContent(indicator.distanceLabel, `${Math.round(missile.distance)}m`);
    this.setStyleValue(indicator.root, 'display', 'block');
    this.setStyleValue(indicator.root, 'opacity', '1');
    this.setStyleValue(indicator.root, 'visibility', 'visible');
  }

  private setTextContent(element: HTMLElement, text: string): void {
    if (this.textContentCache.get(element) === text) {
      return;
    }

    element.textContent = text;
    this.textContentCache.set(element, text);
  }

  private setStyleValue(element: HTMLElement, property: string, value: string): void {
    let cache = this.styleValueCache.get(element);
    if (!cache) {
      cache = new Map<string, string>();
      this.styleValueCache.set(element, cache);
    }

    if (cache.get(property) === value) {
      return;
    }

    const style = element.style as CSSStyleDeclaration & Record<string, string>;
    style[property] = value;
    cache.set(property, value);
  }

  private createIndicator(): { root: HTMLDivElement; distanceLabel: HTMLSpanElement } {
    const root = document.createElement('div');
    root.className = 'boss-missile-indicator';

    const color = '#ff0000';
    const size = '40px';

    root.style.cssText = `
      position: absolute;
      width: ${size};
      height: ${size};
      display: none;
      opacity: 0;
      visibility: hidden;
      transform: translate(-50%, -50%) rotate(0deg);
      contain: layout style paint;
      backface-visibility: hidden;
      will-change: transform, left, top, opacity;
    `;

    const arrow = document.createElement('div');
    // SVG 箭头默认指向上方（尖端在 12 点钟方向）
    arrow.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
        <path d="M12 2 L22 12 L12 8 L2 12 Z" />
      </svg>
    `;

    const distanceLabel = document.createElement('span');
    distanceLabel.className = 'distance-label';
    distanceLabel.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      color: ${color};
      font-size: 12px;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95);
      white-space: nowrap;
    `;

    root.appendChild(arrow);
    root.appendChild(distanceLabel);

    return { root, distanceLabel };
  }

  private calculateIndicatorPosition(
    worldPos: Vector3,
    camera: Camera
  ): { arrowX: number; arrowY: number; rotation: number } {
    const centerX = 0.5;
    const centerY = 0.5;
    const edgePadding = 0.08;

    // 使用相机位置计算方向向量
    this.fromCamera.copy(worldPos).sub(camera.position);
    this.invertedCameraQuaternion.copy(camera.quaternion).invert();
    this.cameraLocal.copy(this.fromCamera).applyQuaternion(this.invertedCameraQuaternion);

    const isOnRight = this.cameraLocal.x > 0;
    const isAbove = this.cameraLocal.y > 0;
    const isBehind = this.cameraLocal.z < 0;

    const absZ = Math.max(Math.abs(this.cameraLocal.z), 0.001);
    const angleH = Math.atan2(this.cameraLocal.x, absZ);
    const angleV = Math.atan2(this.cameraLocal.y, absZ);

    const maxAngleH = Math.PI / 4;
    const maxAngleV = Math.PI / 5;

    let arrowX: number;
    let arrowY: number;

    // 屏幕Y轴向下为正（Y=0是顶部，Y=1是底部）
    if (isBehind) {
      if (Math.abs(this.cameraLocal.y) > Math.abs(this.cameraLocal.x)) {
        arrowY = isAbove ? edgePadding : 1 - edgePadding;
        const hRatio = Math.min(1, Math.abs(angleH) / maxAngleH);
        arrowX = centerX + (isOnRight ? hRatio : -hRatio) * (0.5 - edgePadding);
      } else {
        arrowX = isOnRight ? 1 - edgePadding : edgePadding;
        const vRatio = Math.min(1, Math.abs(angleV) / maxAngleV);
        arrowY = centerY + (isAbove ? -vRatio : vRatio) * (0.5 - edgePadding);
      }
    } else {
      const normalizedH = Math.max(-1, Math.min(1, angleH / maxAngleH));
      const normalizedV = Math.max(-1, Math.min(1, angleV / maxAngleV));

      arrowX = centerX + normalizedH * (0.5 - edgePadding);
      arrowY = centerY - normalizedV * (0.5 - edgePadding);

      if (Math.abs(normalizedH) >= 1 || Math.abs(normalizedV) >= 1) {
        const slope = Math.abs(angleV) / (Math.abs(angleH) + 0.001);
        if (slope > 1) {
          arrowY = isAbove ? edgePadding : 1 - edgePadding;
          const hPos = centerX + (isOnRight ? 1 : -1) * (1 / slope) * (0.5 - edgePadding);
          arrowX = Math.max(edgePadding, Math.min(1 - edgePadding, hPos));
        } else {
          arrowX = isOnRight ? 1 - edgePadding : edgePadding;
          const vPos = centerY + (isAbove ? -1 : 1) * slope * (0.5 - edgePadding);
          arrowY = Math.max(edgePadding, Math.min(1 - edgePadding, vPos));
        }
      }
    }

    // SVG 箭头默认指向上方（0度）
    // atan2(x, y) 给出正确的旋转角度
    const rotation = Math.atan2(this.cameraLocal.x, this.cameraLocal.y) * (180 / Math.PI);

    return { arrowX, arrowY, rotation };
  }

  private hideIndicator(id: string): void {
    const indicator = this.indicators.get(id);
    if (indicator) {
      this.setTextContent(indicator.distanceLabel, '');
      this.setStyleValue(indicator.root, 'display', 'none');
      this.setStyleValue(indicator.root, 'opacity', '0');
      this.setStyleValue(indicator.root, 'visibility', 'hidden');
      this.setStyleValue(indicator.root, 'left', '50%');
      this.setStyleValue(indicator.root, 'top', '50%');
      this.setStyleValue(indicator.root, 'transform', 'translate(-50%, -50%) rotate(0deg)');
    }
  }

  public clear(): void {
    for (const indicator of this.indicators.values()) {
      indicator.root.remove();
    }
    this.indicators.clear();
  }

  public dispose(): void {
    this.clear();
    this.container.remove();
  }
}
