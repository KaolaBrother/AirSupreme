/**
 * 敌人方位指示器
 * 当敌人不在视野内时，在屏幕边缘显示箭头指示方向
 */
export class EnemyIndicator {
  private container: HTMLDivElement;
  private indicators: Map<string, HTMLDivElement> = new Map();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'enemy-indicators';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 45;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * 更新敌人指示器
   * @param enemies 敌人屏幕位置列表
   */
  public update(
    enemies: Array<{
      id: string;
      screenPos: { x: number; y: number };
      distance: number;
      inView: boolean;
      isTargeted: boolean;
    }>
  ): void {
    // 获取当前活跃的敌人 ID
    const activeIds = new Set(enemies.map(e => e.id));

    // 移除不存在的指示器
    for (const [id, indicator] of this.indicators) {
      if (!activeIds.has(id)) {
        indicator.remove();
        this.indicators.delete(id);
      }
    }

    // 更新或创建指示器
    for (const enemy of enemies) {
      if (enemy.inView) {
        // 敌人在视野内，隐藏指示器
        this.hideIndicator(enemy.id);
      } else {
        // 敌人在视野外，显示指示器
        this.showOrUpdateIndicator(enemy);
      }
    }
  }

  private showOrUpdateIndicator(
    enemy: {
      id: string;
      screenPos: { x: number; y: number };
      distance: number;
      isTargeted: boolean;
    }
  ): void {
    let indicator = this.indicators.get(enemy.id);

    if (!indicator) {
      indicator = this.createIndicator(enemy.isTargeted);
      this.container.appendChild(indicator);
      this.indicators.set(enemy.id, indicator);
    }

    // 计算指示器位置和旋转（直接指向敌人2D位置）
    const { position, rotation } = this.calculateIndicatorPosition(enemy.screenPos);

    indicator.style.left = `${position.x}px`;
    indicator.style.top = `${position.y}px`;
    indicator.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

    // 显示距离
    const distanceLabel = indicator.querySelector('.distance-label') as HTMLSpanElement;
    if (distanceLabel) {
      distanceLabel.textContent = `${Math.round(enemy.distance)}m`;
    }

    // 隐藏方位标签（箭头本身已经指示方向，不需要文字）
    const directionLabel = indicator.querySelector('.direction-label') as HTMLSpanElement;
    if (directionLabel) {
      directionLabel.style.display = 'none';
    }

    indicator.style.display = 'block';
  }

  private createIndicator(isTargeted: boolean): HTMLDivElement {
    const indicator = document.createElement('div');
    indicator.className = 'enemy-indicator';

    // 增强箭头：更大尺寸、更亮颜色、阴影效果
    const color = isTargeted ? '#ff0000' : '#ff4400';
    const size = isTargeted ? '50px' : '40px';

    indicator.style.cssText = `
      position: absolute;
      width: ${size};
      height: ${size};
      display: none;
      filter: drop-shadow(0 0 8px ${color});
    `;

    // 箭头 SVG
    const arrow = document.createElement('div');
    arrow.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
        <path d="M12 2 L22 12 L12 8 L2 12 Z" />
      </svg>
    `;

    // 距离标签
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

    // 方位标签（告诉玩家敌人方向）
    const directionLabel = document.createElement('span');
    directionLabel.className = 'direction-label';
    directionLabel.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      color: ${color};
      font-size: 11px;
      font-weight: bold;
      text-shadow: 1px 1px 2px black;
      white-space: nowrap;
      margin-top: 2px;
    `;
    directionLabel.textContent = '';

    indicator.appendChild(arrow);
    indicator.appendChild(distanceLabel);
    indicator.appendChild(directionLabel);

    return indicator;
  }

  private calculateIndicatorPosition(
    screenPos: { x: number; y: number }
  ): { position: { x: number; y: number }; rotation: number } {
    const padding = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 计算从屏幕中心到敌人的方向
    const dx = screenPos.x - centerX;
    const dy = screenPos.y - centerY;

    // 计算角度（用于旋转箭头）
    const angle = Math.atan2(dx, dy); // 修正：dx 是 x 轴方向，dy 是 y 轴方向
    const rotation = (angle * 180 / Math.PI) + 90; // +90 因为箭头默认指向上

    // 计算指示器在屏幕边缘的位置
    const maxRadius = Math.min(centerX, centerY) - padding;
    const currentRadius = Math.sqrt(dx * dx + dy * dy);
    const clampedRadius = Math.min(currentRadius, maxRadius);

    // 标准化方向并计算位置
    const normalizedDx = dx / currentRadius;
    const normalizedDy = dy / currentRadius;

    let indicatorX = centerX + normalizedDx * clampedRadius;
    let indicatorY = centerY + normalizedDy * clampedRadius;

    // 确保不超出屏幕边界
    indicatorX = Math.max(padding, Math.min(window.innerWidth - padding, indicatorX));
    indicatorY = Math.max(padding, Math.min(window.innerHeight - padding, indicatorY));

    return {
      position: { x: indicatorX, y: indicatorY },
      rotation
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
