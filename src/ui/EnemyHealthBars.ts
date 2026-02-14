import * as THREE from 'three';

/**
 * 敌人血条管理器
 * 为每个敌人显示血条
 */
export class EnemyHealthBars {
  private container: HTMLDivElement;
  private healthBars: Map<string, {
    bar: HTMLDivElement;
    background: HTMLDivElement;
    targetName: HTMLSpanElement;
    arrow: HTMLDivElement | null;
    screenPos: { x: number; y: number } | null;  // 缓存屏幕位置
  }> = new Map();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'enemy-health-bars';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 35;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * 更新敌人血条
   * @param enemies 敌人列表，包含位置、血量等信息
   * @param camera 相机
   * @param playerPosition 玩家位置
   */
  public update(
    enemies: Array<{
      mesh: THREE.Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    camera: THREE.Camera,
    playerPosition: THREE.Vector3
  ): void {
    const activeIds = new Set(enemies.map(e => e.mesh.uuid));

    // 移除不存在的血条
    for (const [id] of this.healthBars) {
      if (!activeIds.has(id)) {
        this.removeHealthBar(id);
      }
    }

    // 更新或创建血条
    for (const enemy of enemies) {
      this.updateOrCreateHealthBar(enemy, camera, playerPosition);
    }
  }

  /**
   * 更新或创建血条
   */
  private updateOrCreateHealthBar(
    enemy: {
      mesh: THREE.Object3D;
      currentHealth: number;
      maxHealth: number;
    },
    camera: THREE.Camera,
    playerPosition: THREE.Vector3
  ): void {
    const id = enemy.mesh.uuid;
    let barData = this.healthBars.get(id);

    // 计算屏幕位置
    const screenPos = this.worldToScreen(enemy.mesh.position.clone(), camera);

    // 缓存屏幕位置（给锁定系统使用）
    if (barData) {
      barData.screenPos = { x: screenPos.x, y: screenPos.y };
    }

    // 检查是否在视野内
    const inView = screenPos.x >= 0 && screenPos.x <= 1 &&
                   screenPos.y >= 0 && screenPos.y <= 1 &&
                   screenPos.z < 1;

    if (!barData) {
      // 创建新血条、箭头
      const bar = this.createHealthBar();
      const background = this.createBackgroundBar(60);
      const targetName = this.createTargetName();
      const arrow = this.createArrowIndicator();

      bar.appendChild(background);
      bar.appendChild(targetName);
      this.container.appendChild(bar);
      this.container.appendChild(arrow);

      barData = { bar, background, targetName, arrow, screenPos: null };
      this.healthBars.set(id, barData);
    }

    // 更新血条颜色
    const healthPercent = enemy.currentHealth / enemy.maxHealth;
    const color = this.getHealthColor(healthPercent);

    if (inView) {
      // 敌人在视野内 - 显示血条
      const barWidth = 60;
      const barHeight = 6;

      barData.bar.style.display = 'block';
      if (barData.arrow) {
        barData.arrow.style.display = 'none';
      }

      // 更新血条位置和内容
      const { x, y } = this.calculateBarPosition(enemy.mesh, camera, barWidth, barHeight);
      barData.bar.style.left = `${x}px`;
      barData.bar.style.top = `${y}px`;

      barData.background.style.background = color;
      barData.background.style.width = `${barWidth * healthPercent}px`;

      const enemyName = this.getEnemyName(enemy.mesh);
      barData.targetName.textContent = enemyName;
      // 动态计算文字居中位置
      const textWidth = barData.targetName.offsetWidth;
      const centeredLeft = (barWidth - textWidth) / 2;
      barData.targetName.style.left = `${centeredLeft}px`;
    } else {
      // 敌人在视野外 - 显示箭头指示器
      barData.bar.style.display = 'none';
      if (barData.arrow) {
        barData.arrow.style.display = 'block';
        // 计算敌人到玩家的距离（不是到原点的距离）
        const distance = playerPosition.distanceTo(enemy.mesh.position);
        // 计算敌人在玩家视角中的左右位置（使用3D空间，避免camera旋转导致跳跃）
        const toEnemy = enemy.mesh.position.clone().sub(playerPosition);
        const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const isOnRight = playerRight.dot(toEnemy) > 0; // 正值表示在右边
        this.updateArrowIndicator(barData.arrow, screenPos, distance, isOnRight);
      }
    }
  }

  /**
   * 创建血条容器
   */
  private createHealthBar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'enemy-health-bar';
    bar.style.cssText = `
      position: absolute;
      display: none;
      pointer-events: none;
    `;
    return bar;
  }

  /**
   * 创建血条背景
   */
  private createBackgroundBar(width: number): HTMLDivElement {
    const background = document.createElement('div');
    background.className = 'health-bar-background';
    background.style.cssText = `
      width: ${width}px;
      height: 6px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 3px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      position: absolute;
      bottom: 0;
      left: 0;
      transition: width 0.2s, background 0.2s;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.8), inset 0 0 4px rgba(0, 0, 0, 0.5);
    `;
    return background;
  }

  /**
   * 创建敌人名称标签
   */
  private createTargetName(): HTMLSpanElement {
    const name = document.createElement('span');
    name.className = 'enemy-name';
    name.style.cssText = `
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
      position: absolute;
      bottom: 100%; /* 在血条上方 */
      left: 0; /* 将由 JavaScript 动态计算居中 */
      margin-bottom: 4px; /* 距离血条4px */
      color: #ffffff; /* 白色字体 */
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), /* 更强的阴影 */
                   -1px -1px 2px rgba(0, 0, 0, 0.8);
    `;
    return name;
  }

  /**
   * 创建箭头指示器
   */
  private createArrowIndicator(): HTMLDivElement {
    const arrow = document.createElement('div');
    arrow.className = 'enemy-arrow-indicator';
    arrow.style.cssText = `
      position: absolute;
      width: 30px;
      height: 30px;
      display: none;
      pointer-events: none;
      justify-content: center;
      align-items: center;
    `;

    // 创建三角形箭头 - 使用更显眼的亮黄色
    const arrowShape = document.createElement('div');
    arrowShape.style.cssText = `
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 16px solid #ffff00;
      filter: drop-shadow(0 0 6px rgba(255, 255, 0, 0.9));
    `;
    arrow.appendChild(arrowShape);

    // 创建距离标签
    const distanceLabel = document.createElement('span');
    distanceLabel.className = 'arrow-distance-label';
    distanceLabel.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      color: #ffff00;
      font-size: 11px;
      font-weight: bold;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px black;
      white-space: nowrap;
      margin-top: 4px;
    `;
    distanceLabel.textContent = '';
    arrow.appendChild(distanceLabel);

    return arrow;
  }

  /**
   * 更新箭头指示器位置和方向
   */
  private updateArrowIndicator(
    arrow: HTMLDivElement,
    screenPos: { x: number; y: number; z: number },
    distance: number,
    isOnRight: boolean // 敌人在玩家视角的右边
  ): void {
    // 计算屏幕中心
    const centerX = 0.5;
    const centerY = 0.5;

    // 计算从中心到敌人的方向（用于确定箭头Y位置）
    const dx = screenPos.x - centerX;
    const dy = screenPos.y - centerY;

    const edgePadding = 0.08;
    let arrowX: number;
    let arrowY: number;

    // 使用3D空间中的相对位置判断箭头在左边还是右边（避免camera旋转导致跳跃）
    if (isOnRight) {
      // 敌人在玩家视角右边 → 箭头在右边缘
      arrowX = 1 - edgePadding;
      // Y 根据敌人位置，但限制在屏幕范围内
      arrowY = Math.max(edgePadding, Math.min(1 - edgePadding, centerY + dy));
    } else {
      // 敌人在玩家视角左边 → 箭头在左边缘
      arrowX = edgePadding;
      // Y 根据敌人位置，但限制在屏幕范围内
      arrowY = Math.max(edgePadding, Math.min(1 - edgePadding, centerY + dy));
    }

    // 计算从屏幕中心到箭头的方向（用于旋转角度）
    const toArrowX = arrowX - centerX;
    const toArrowY = arrowY - centerY;
    const angleDeg = Math.atan2(toArrowY, toArrowX) * (180 / Math.PI);

    // 设置箭头位置和旋转
    arrow.style.left = `${arrowX * 100}%`;
    arrow.style.top = `${arrowY * 100}%`;
    // 箭头默认向下（border-bottom），需要调整角度指向箭头位置
    // atan2(toArrowY, toArrowX) 返回的角度是以X轴正向为0度，逆时针为正
    // 箭头默认向下（-90度），所以需要 +90度修正
    arrow.style.transform = `translate(-50%, -50%) rotate(${angleDeg + 90}deg)`;

    // 更新箭头颜色（亮黄色）
    const arrowShape = arrow.querySelector('div');
    if (arrowShape) {
      arrowShape.style.borderBottomColor = '#ffff00';
    }

    // 更新距离标签
    const distanceLabel = arrow.querySelector('.arrow-distance-label') as HTMLSpanElement;
    if (distanceLabel) {
      distanceLabel.textContent = `${Math.round(distance)}m`;
      // 确保标签不随箭头旋转
      distanceLabel.style.transform = 'none';
    }
  }

  /**
   * 世界坐标转屏幕坐标
   */
  private worldToScreen(
    position: THREE.Vector3,
    camera: THREE.Camera
  ): { x: number; y: number; z: number } {
    const vector = position.clone();
    vector.project(camera);

    // NDC: x, y 范围是 -1 到 1
    // 屏幕: x 范围 0 到 width, y 范围 0 到 height (Y 向下为正)
    return {
      x: (vector.x + 1) / 2,
      y: 1 - (vector.y + 1) / 2, // 反转 Y 轴，因为屏幕 Y 向下为正
      z: vector.z
    };
  }

  /**
   * 根据血量百分比获取颜色 - 优化版
   */
  private getHealthColor(percent: number): string {
    if (percent > 0.6) {
      // 高血量：绿色渐变
      return 'linear-gradient(90deg, #00ff66, #00ff33, #00cc00)';
    } else if (percent > 0.3) {
      // 中高血量：黄绿色渐变
      return 'linear-gradient(90deg, #ffcc00, #ffdd00, #88aa00)';
    } else if (percent > 0.15) {
      // 低血量：橙色渐变
      return 'linear-gradient(90deg, #ff9900, #ffcc00, #ffaa00)';
    } else {
      // 危低血量：红色渐变
      return 'linear-gradient(90deg, #ff3300, #cc0000, #ff0000)';
    }
  }

  /**
   * 获取敌人名称
   */
  private getEnemyName(mesh: THREE.Object3D): string {
    const name = mesh.name || '';
    if (name.includes('Scout')) return 'SCOUT';
    if (name.includes('Fighter')) return 'FIGHTER';
    if (name.includes('Heavy')) return 'HEAVY';
    if (name.includes('Sniper')) return 'SNIPER';
    if (name.includes('Ace')) return 'ACE';
    return 'ENEMY';
  }

  /**
   * 计算血条位置（在敌人上方）
   */
  private calculateBarPosition(
    enemyMesh: THREE.Object3D,
    camera: THREE.Camera,
    barWidth: number,
    barHeight: number
  ): { x: number; y: number } {
    // 计算敌人顶部的屏幕位置
    const enemyTop = enemyMesh.position.clone();
    enemyTop.y += 2; // 在敌人模型顶部上方

    const screenPos = this.worldToScreen(enemyTop, camera);

    const offsetX = barWidth / 2;
    const offsetY = barHeight + 15;

    return {
      x: (screenPos.x * window.innerWidth) - offsetX,
      y: (screenPos.y * window.innerHeight) - offsetY
    };
  }

  /**
   * 移除血条
   */
  private removeHealthBar(id: string): void {
    const barData = this.healthBars.get(id);
    if (barData) {
      barData.bar.remove();
      if (barData.arrow) {
        barData.arrow.remove();
      }
      this.healthBars.delete(id);
    }
  }

  /**
   * 清除所有血条
   */
  public clear(): void {
    for (const barData of this.healthBars.values()) {
      barData.bar.remove();
    }
    this.healthBars.clear();
    this.container.remove();
  }

  /**
   * 获取第一个敌人的屏幕位置（用于锁定系统）
   * @returns 第一个可见敌人的屏幕位置，如果没有敌人则返回 null
   */
  public getFirstEnemyScreenPos(): { x: number; y: number } | null {
    for (const barData of this.healthBars.values()) {
      if (barData.screenPos && barData.bar.style.display !== 'none') {
        return barData.screenPos;
      }
    }
    return null;
  }
}
