import * as THREE from 'three';

/**
 * 敌人血条管理器
 * 为每个敌人显示血条
 */
export class EnemyHealthBars {
  private container: HTMLDivElement;
  private healthBars: Map<
    string,
    {
      bar: HTMLDivElement;
      background: HTMLDivElement;
      targetName: HTMLSpanElement;
      arrow: HTMLDivElement | null;
      screenPos: { x: number; y: number } | null; // 缓存屏幕位置
    }
  > = new Map();

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
   * @param friendlies 友军列表，包含位置、血量等信息
   * @param camera 相机
   * @param playerPosition 玩家位置
   */
  public update(
    enemies: Array<{
      mesh: THREE.Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    friendlies: Array<{
      mesh: THREE.Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    camera: THREE.Camera,
    playerPosition: THREE.Vector3
  ): void {
    const enemyIds = new Set(enemies.map((e) => e.mesh.uuid));
    const friendlyIds = new Set(friendlies.map((f) => f.mesh.uuid));
    const activeIds = new Set([...enemyIds, ...friendlyIds]);

    // 移除不存在的血条
    for (const [id] of this.healthBars) {
      if (!activeIds.has(id)) {
        this.removeHealthBar(id);
      }
    }

    // 更新或创建敌人血条
    for (const enemy of enemies) {
      this.updateOrCreateHealthBar(enemy, camera, playerPosition, false);
    }

    // 更新或创建友军血条
    for (const friendly of friendlies) {
      this.updateOrCreateHealthBar(friendly, camera, playerPosition, true);
    }
  }

  /**
   * 获取目标的实际世界坐标
   */
  private getTargetWorldPosition(mesh: THREE.Object3D): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    return worldPos;
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
    playerPosition: THREE.Vector3,
    isFriendly: boolean = false
  ): void {
    const id = enemy.mesh.uuid;
    let barData = this.healthBars.get(id);

    const name = enemy.mesh.name || '';
    const isBoss = name.includes('BOSS') || name.includes('boss_eye');
    const barWidth = isBoss ? 120 : 60;

    const worldPos = this.getTargetWorldPosition(enemy.mesh);
    const screenPos = this.worldToScreen(worldPos, camera);

    if (barData) {
      barData.screenPos = { x: screenPos.x, y: screenPos.y };
    }

    const inView =
      screenPos.x >= 0 &&
      screenPos.x <= 1 &&
      screenPos.y >= 0 &&
      screenPos.y <= 1 &&
      screenPos.z < 1;

    if (!barData) {
      const bar = this.createHealthBar();
      const background = this.createBackgroundBar(barWidth, isBoss);
      const targetName = this.createTargetName(isFriendly, isBoss);
      const arrow = isFriendly ? null : this.createArrowIndicator();

      bar.appendChild(background);
      bar.appendChild(targetName);
      this.container.appendChild(bar);
      if (arrow) {
        this.container.appendChild(arrow);
      }

      barData = { bar, background, targetName, arrow, screenPos: null };
      this.healthBars.set(id, barData);
    }

    const healthPercent = enemy.currentHealth / enemy.maxHealth;
    const color = this.getHealthColor(healthPercent);

    if (inView) {
      const barWidth = isBoss ? 120 : 60;
      const barHeight = isBoss ? 10 : 6;

      barData.bar.style.display = 'block';
      if (barData.arrow) {
        barData.arrow.style.display = 'none';
      }

      const { x, y } = this.calculateBarPosition(enemy.mesh, camera, barWidth, barHeight);
      barData.bar.style.left = `${x}px`;
      barData.bar.style.top = `${y}px`;

      barData.background.style.background = color;
      barData.background.style.width = `${barWidth * healthPercent}px`;

      const name = this.getTargetName(enemy.mesh, isFriendly);
      barData.targetName.textContent = name;
      const textWidth = barData.targetName.offsetWidth;
      const centeredLeft = (barWidth - textWidth) / 2;
      barData.targetName.style.left = `${centeredLeft}px`;
    } else {
      barData.bar.style.display = 'none';
      if (barData.arrow) {
        barData.arrow.style.display = 'block';
        const worldPos = this.getTargetWorldPosition(enemy.mesh);
        const distance = playerPosition.distanceTo(worldPos);
        const toEnemy = worldPos.clone().sub(playerPosition);
        const cameraLocal = toEnemy.clone().applyQuaternion(camera.quaternion.clone().invert());
        this.updateArrowIndicator(barData.arrow, cameraLocal, distance);
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
  private createBackgroundBar(width: number, isBoss: boolean = false): HTMLDivElement {
    const background = document.createElement('div');
    background.className = 'health-bar-background';
    const height = isBoss ? 10 : 6;
    background.style.cssText = `
      width: ${width}px;
      height: ${height}px;
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
   * 创建目标名称标签
   */
  private createTargetName(isFriendly: boolean = false, isBoss: boolean = false): HTMLSpanElement {
    const name = document.createElement('span');
    name.className = 'enemy-name';
    const fontSize = isBoss ? 16 : 12;
    const color = isBoss ? '#ff4444' : isFriendly ? '#ffff00' : '#ffffff';
    name.style.cssText = `
      font-size: ${fontSize}px;
      font-weight: bold;
      white-space: nowrap;
      position: absolute;
      bottom: 100%;
      left: 0;
      margin-bottom: 4px;
      color: ${color};
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9),
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
   * 使用相机局部坐标系进行角度计算，正确处理敌人在相机后面或下方的情况
   */
  private updateArrowIndicator(
    arrow: HTMLDivElement,
    cameraLocal: THREE.Vector3,
    distance: number
  ): void {
    const centerX = 0.5;
    const centerY = 0.5;
    const edgePadding = 0.08;

    const isOnRight = cameraLocal.x > 0;
    const isAbove = cameraLocal.y > 0;
    const isBehind = cameraLocal.z < 0;

    // 计算水平角和垂直角（相对于相机前方向）
    // 使用 z 的绝对值来避免 z 为负时角度符号错误
    const absZ = Math.max(Math.abs(cameraLocal.z), 0.001);
    const angleH = Math.atan2(cameraLocal.x, absZ);
    const angleV = Math.atan2(cameraLocal.y, absZ);

    // 相机 FOV 相关的最大角度（假设水平 90°，垂直 60°）
    const maxAngleH = Math.PI / 4; // 45° 水平半角
    const maxAngleV = Math.PI / 5; // 36° 垂直半角

    let arrowX: number;
    let arrowY: number;

    // 计算箭头位置：将角度映射到屏幕边缘
    if (isBehind) {
      // 敌人在后面：箭头放在对应方向的边缘
      if (Math.abs(cameraLocal.y) > Math.abs(cameraLocal.x)) {
        // 更偏上/下
        arrowY = isAbove ? 1 - edgePadding : edgePadding;
        const hRatio = Math.min(1, Math.abs(angleH) / maxAngleH);
        arrowX = centerX + (isOnRight ? hRatio : -hRatio) * (0.5 - edgePadding);
      } else {
        // 更偏左/右
        arrowX = isOnRight ? 1 - edgePadding : edgePadding;
        const vRatio = Math.min(1, Math.abs(angleV) / maxAngleV);
        arrowY = centerY + (isAbove ? -vRatio : vRatio) * (0.5 - edgePadding);
      }
    } else {
      // 敌人在前面但不在视野内：将角度映射到屏幕位置
      const normalizedH = Math.max(-1, Math.min(1, angleH / maxAngleH));
      const normalizedV = Math.max(-1, Math.min(1, angleV / maxAngleV));

      arrowX = centerX + normalizedH * (0.5 - edgePadding);
      arrowY = centerY - normalizedV * (0.5 - edgePadding);

      // 如果超出视野，钳制到最近的边缘
      if (Math.abs(normalizedH) >= 1 || Math.abs(normalizedV) >= 1) {
        const slope = Math.abs(angleV) / (Math.abs(angleH) + 0.001);
        if (slope > 1) {
          // 上下边缘
          arrowY = isAbove ? 1 - edgePadding : edgePadding;
          const hPos = centerX + (isOnRight ? 1 : -1) * (1 / slope) * (0.5 - edgePadding);
          arrowX = Math.max(edgePadding, Math.min(1 - edgePadding, hPos));
        } else {
          // 左右边缘
          arrowX = isOnRight ? 1 - edgePadding : edgePadding;
          const vPos = centerY + (isAbove ? -1 : 1) * slope * (0.5 - edgePadding);
          arrowY = Math.max(edgePadding, Math.min(1 - edgePadding, vPos));
        }
      }
    }

    // 计算旋转角度：箭头指向敌人方向
    // 使用实际角度而非屏幕位置，确保旋转正确
    const rotationAngle = Math.atan2(angleV, angleH) * (180 / Math.PI);
    // 修正：箭头默认指向下方，需要调整
    const adjustedRotation = isBehind ? -rotationAngle : rotationAngle;

    arrow.style.left = `${arrowX * 100}%`;
    arrow.style.top = `${arrowY * 100}%`;
    arrow.style.transform = `translate(-50%, -50%) rotate(${-adjustedRotation + 90}deg)`;

    // 更新箭头颜色（亮黄色）
    const arrowShape = arrow.querySelector('div');
    if (arrowShape) {
      arrowShape.style.borderBottomColor = '#ffff00';
    }

    // 更新距离标签
    const distanceLabel = arrow.querySelector('.arrow-distance-label') as HTMLSpanElement;
    if (distanceLabel) {
      distanceLabel.textContent = `${Math.round(distance)}m`;
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
      z: vector.z,
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
    if (name.includes('boss_eye')) return 'Eye';
    if (name.includes('BOSS') && !name.includes('boss_eye')) return 'Boss';
    if (name === 'SCOUT' || name.includes('Scout')) return 'Scout';
    if (name === 'FIGHTER' || name.includes('Fighter')) return 'Fighter';
    if (name === 'HEAVY' || name.includes('Heavy')) return 'Heavy';
    if (name === 'SNIPER' || name.includes('Sniper')) return 'Sniper';
    if (name === 'ACE' || name.includes('Ace')) return 'Ace';
    return 'Enemy';
  }

  /**
   * 获取目标名称（敌人和友军）
   */
  private getTargetName(mesh: THREE.Object3D, isFriendly: boolean): string {
    if (isFriendly) {
      const name = mesh.name || '';
      if (name === 'SCOUT' || name.includes('Scout')) return 'Scout';
      if (name === 'FIGHTER' || name.includes('Fighter')) return 'Fighter';
      if (name === 'HEAVY' || name.includes('Heavy')) return 'Heavy';
      if (name === 'SNIPER' || name.includes('Sniper')) return 'Sniper';
      if (name === 'ACE' || name.includes('Ace')) return 'Ace';
      return 'Ally';
    }
    return this.getEnemyName(mesh);
  }

  private calculateBarPosition(
    enemyMesh: THREE.Object3D,
    camera: THREE.Camera,
    barWidth: number,
    barHeight: number
  ): { x: number; y: number } {
    const name = enemyMesh.name || '';
    const isBoss = name.includes('BOSS');
    const isEye = name.includes('boss_eye');
    const heightOffset = isBoss ? 15 : isEye ? 5 : 2;

    const worldPos = new THREE.Vector3();
    enemyMesh.getWorldPosition(worldPos);
    worldPos.y += heightOffset;

    const screenPos = this.worldToScreen(worldPos, camera);

    const offsetX = barWidth / 2;
    const offsetY = barHeight + 15;

    return {
      x: screenPos.x * window.innerWidth - offsetX,
      y: screenPos.y * window.innerHeight - offsetY,
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
