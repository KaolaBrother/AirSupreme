export class BossMissileIndicator {
  private container: HTMLDivElement;
  private indicators: Map<string, HTMLDivElement> = new Map();

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
      screenPos: { x: number; y: number };
      distance: number;
      inView: boolean;
      isOnRight: boolean;
    }>
  ): void {
    const activeIds = new Set(missiles.map((m) => m.id));

    for (const [id, indicator] of this.indicators) {
      if (!activeIds.has(id)) {
        indicator.remove();
        this.indicators.delete(id);
      }
    }

    for (const missile of missiles) {
      if (missile.inView) {
        this.hideIndicator(missile.id);
      } else {
        this.showOrUpdateIndicator(missile);
      }
    }
  }

  private showOrUpdateIndicator(missile: {
    id: string;
    screenPos: { x: number; y: number };
    distance: number;
    isOnRight: boolean;
  }): void {
    let indicator = this.indicators.get(missile.id);

    if (!indicator) {
      indicator = this.createIndicator();
      this.container.appendChild(indicator);
      this.indicators.set(missile.id, indicator);
    }

    const { position, rotation } = this.calculateIndicatorPosition(
      missile.screenPos,
      missile.isOnRight
    );

    indicator.style.left = `${position.x}px`;
    indicator.style.top = `${position.y}px`;
    indicator.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

    const distanceLabel = indicator.querySelector('.distance-label') as HTMLSpanElement;
    if (distanceLabel) {
      distanceLabel.textContent = `${Math.round(missile.distance)}m`;
    }

    indicator.style.display = 'block';
  }

  private createIndicator(): HTMLDivElement {
    const indicator = document.createElement('div');
    indicator.className = 'boss-missile-indicator';

    const color = '#ff0000';
    const size = '40px';

    indicator.style.cssText = `
      position: absolute;
      width: ${size};
      height: ${size};
      display: none;
      filter: drop-shadow(0 0 8px ${color});
    `;

    const arrow = document.createElement('div');
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
      text-shadow: 1px 1px 2px black;
      white-space: nowrap;
    `;

    indicator.appendChild(arrow);
    indicator.appendChild(distanceLabel);

    return indicator;
  }

  private calculateIndicatorPosition(
    screenPos: { x: number; y: number },
    isOnRight: boolean
  ): {
    position: { x: number; y: number };
    rotation: number;
  } {
    const padding = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 根据3D空间位置确定箭头在左/右边缘
    let indicatorX: number;
    if (isOnRight) {
      indicatorX = window.innerWidth - padding;
    } else {
      indicatorX = padding;
    }

    // Y位置根据屏幕Y坐标
    const dy = screenPos.y - centerY;
    let indicatorY = centerY + dy * 2;
    indicatorY = Math.max(padding, Math.min(window.innerHeight - padding, indicatorY));

    // 旋转从屏幕中心指向箭头位置
    const toArrowX = indicatorX - centerX;
    const toArrowY = indicatorY - centerY;
    const rotation = Math.atan2(toArrowY, toArrowX) * (180 / Math.PI) + 90;

    return {
      position: { x: indicatorX, y: indicatorY },
      rotation,
    };
  }

  private hideIndicator(id: string): void {
    const indicator = this.indicators.get(id);
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  public clear(): void {
    for (const indicator of this.indicators.values()) {
      indicator.remove();
    }
    this.indicators.clear();
  }
}
