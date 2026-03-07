import { Quaternion, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';

const CAMERA_POSITION_THRESHOLD_SQ = 0.01;
const PLAYER_POSITION_THRESHOLD_SQ = 0.01;
const TARGET_POSITION_THRESHOLD_SQ = 0.01;
const CAMERA_ROTATION_THRESHOLD = 0.0025;
const HEALTH_PERCENT_THRESHOLD = 0.001;

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
      arrowShape: HTMLDivElement | null;
      arrowDistanceLabel: HTMLSpanElement | null;
      screenPos: { x: number; y: number; z: number } | null; // 缓存屏幕位置
      lastBarWorldPosition: Vector3;
      lastHealthPercent: number;
      wasInView: boolean;
    }
  > = new Map();
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();
  private readonly worldPosition = new Vector3();
  private readonly barWorldPosition = new Vector3();
  private readonly screenVector = new Vector3();
  private readonly cameraLocal = new Vector3();
  private readonly invertedCameraQuaternion = new Quaternion();
  private readonly lastCameraPosition = new Vector3();
  private readonly lastCameraQuaternion = new Quaternion();
  private readonly lastPlayerPosition = new Vector3();
  private cameraStateInitialized: boolean = false;

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
      mesh: Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    friendlies: Array<{
      mesh: Object3D;
      currentHealth: number;
      maxHealth: number;
    }>,
    camera: Camera,
    playerPosition: Vector3
  ): void {
    const cameraMoved =
      !this.cameraStateInitialized ||
      this.lastCameraPosition.distanceToSquared(camera.position) > CAMERA_POSITION_THRESHOLD_SQ ||
      this.lastCameraQuaternion.angleTo(camera.quaternion) > CAMERA_ROTATION_THRESHOLD;
    const playerMoved =
      !this.cameraStateInitialized ||
      this.lastPlayerPosition.distanceToSquared(playerPosition) > PLAYER_POSITION_THRESHOLD_SQ;

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
      this.updateOrCreateHealthBar(enemy, camera, playerPosition, cameraMoved, playerMoved, false);
    }

    // 更新或创建友军血条
    for (const friendly of friendlies) {
      this.updateOrCreateHealthBar(
        friendly,
        camera,
        playerPosition,
        cameraMoved,
        playerMoved,
        true
      );
    }

    this.lastCameraPosition.copy(camera.position);
    this.lastCameraQuaternion.copy(camera.quaternion);
    this.lastPlayerPosition.copy(playerPosition);
    this.cameraStateInitialized = true;
  }

  /**
   * 获取目标的实际世界坐标
   */
  private getTargetWorldPosition(mesh: Object3D, target: Vector3): Vector3 {
    mesh.getWorldPosition(target);
    return target;
  }

  private setTextContent(element: HTMLElement, text: string): boolean {
    if (this.textContentCache.get(element) === text) {
      return false;
    }

    element.textContent = text;
    this.textContentCache.set(element, text);
    return true;
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

  /**
   * 更新或创建血条
   */
  private updateOrCreateHealthBar(
    enemy: {
      mesh: Object3D;
      currentHealth: number;
      maxHealth: number;
    },
    camera: Camera,
    playerPosition: Vector3,
    cameraMoved: boolean,
    playerMoved: boolean,
    isFriendly: boolean = false
  ): void {
    const id = enemy.mesh.uuid;
    let barData = this.healthBars.get(id);

    const name = enemy.mesh.name || '';
    const isBoss = name.includes('BOSS') || name.includes('boss_eye');
    const barWidth = isBoss ? 120 : 60;

    const worldPos = this.getTargetWorldPosition(enemy.mesh, this.worldPosition);
    this.barWorldPosition.copy(worldPos);
    this.barWorldPosition.y += this.getBarHeightOffset(enemy.mesh);

    if (!barData) {
      const bar = this.createHealthBar();
      const background = this.createBackgroundBar(barWidth, isBoss);
      const targetName = this.createTargetName(isFriendly, isBoss);
      const arrowData = isFriendly ? null : this.createArrowIndicator();

      bar.appendChild(background);
      bar.appendChild(targetName);
      this.container.appendChild(bar);
      if (arrowData) {
        this.container.appendChild(arrowData.root);
      }

      barData = {
        bar,
        background,
        targetName,
        arrow: arrowData?.root ?? null,
        arrowShape: arrowData?.shape ?? null,
        arrowDistanceLabel: arrowData?.distanceLabel ?? null,
        screenPos: null,
        lastBarWorldPosition: this.barWorldPosition.clone(),
        lastHealthPercent: Number.NaN,
        wasInView: false,
      };
      this.healthBars.set(id, barData);
    }

    const healthPercent = enemy.currentHealth / enemy.maxHealth;
    const targetMoved =
      barData.lastBarWorldPosition.distanceToSquared(this.barWorldPosition) >
      TARGET_POSITION_THRESHOLD_SQ;
    const needsHealthUpdate =
      Math.abs(barData.lastHealthPercent - healthPercent) > HEALTH_PERCENT_THRESHOLD;
    const shouldRecalculateScreen = !barData.screenPos || cameraMoved || targetMoved;

    let screenPos = barData.screenPos;
    if (!screenPos || shouldRecalculateScreen) {
      const projected = this.worldToScreen(this.barWorldPosition, camera);
      if (screenPos) {
        screenPos.x = projected.x;
        screenPos.y = projected.y;
        screenPos.z = projected.z;
      } else {
        screenPos = { ...projected };
        barData.screenPos = screenPos;
      }
    }

    const inView =
      screenPos.x >= 0 &&
      screenPos.x <= 1 &&
      screenPos.y >= 0 &&
      screenPos.y <= 1 &&
      screenPos.z < 1;
    const visibilityChanged = inView !== barData.wasInView;
    const needsPositionUpdate = inView && (visibilityChanged || cameraMoved || targetMoved);
    const needsArrowUpdate = !inView && (visibilityChanged || cameraMoved || targetMoved || playerMoved);

    if (!needsHealthUpdate && !needsPositionUpdate && !needsArrowUpdate && !visibilityChanged) {
      return;
    }

    const color = this.getHealthColor(healthPercent);

    if (inView) {
      const barWidth = isBoss ? 120 : 60;
      const barHeight = isBoss ? 10 : 6;

      this.setStyleValue(barData.bar, 'display', 'block');
      if (barData.arrow) {
        this.resetArrowIndicator(barData.arrow, barData.arrowDistanceLabel);
      }

      if (needsPositionUpdate) {
        const { x, y } = this.getBarPositionFromScreen(screenPos, barWidth, barHeight);
        this.setStyleValue(barData.bar, 'left', `${x}px`);
        this.setStyleValue(barData.bar, 'top', `${y}px`);
      }

      if (needsHealthUpdate || visibilityChanged) {
        this.setStyleValue(barData.background, 'background', color);
        this.setStyleValue(barData.background, 'width', `${barWidth * healthPercent}px`);
      }

      const targetName = this.getTargetName(enemy.mesh, isFriendly);
      if (this.setTextContent(barData.targetName, targetName)) {
        const textWidth = barData.targetName.offsetWidth;
        const centeredLeft = (barWidth - textWidth) / 2;
        this.setStyleValue(barData.targetName, 'left', `${centeredLeft}px`);
      }
    } else {
      this.setStyleValue(barData.bar, 'display', 'none');
      if (barData.arrow) {
        this.setStyleValue(barData.arrow, 'display', 'block');
        this.setStyleValue(barData.arrow, 'opacity', '1');
        this.setStyleValue(barData.arrow, 'visibility', 'visible');
        if (needsArrowUpdate) {
          const distance = playerPosition.distanceTo(worldPos);
          // 使用相机位置计算方向向量，而不是玩家位置
          // 因为箭头指示器是相对于相机视野的方向
          this.cameraLocal.copy(worldPos).sub(camera.position);
          this.invertedCameraQuaternion.copy(camera.quaternion).invert();
          this.cameraLocal.applyQuaternion(this.invertedCameraQuaternion);
          this.updateArrowIndicator(
            barData.arrow,
            barData.arrowShape,
            barData.arrowDistanceLabel,
            this.cameraLocal,
            distance
          );
        }
      }
    }

    barData.lastBarWorldPosition.copy(this.barWorldPosition);
    barData.lastHealthPercent = healthPercent;
    barData.wasInView = inView;
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
  private createArrowIndicator(): {
    root: HTMLDivElement;
    shape: HTMLDivElement;
    distanceLabel: HTMLSpanElement;
  } {
    const root = document.createElement('div');
    root.className = 'enemy-arrow-indicator';
    root.style.cssText = `
      position: absolute;
      width: 30px;
      height: 30px;
      display: none;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      justify-content: center;
      align-items: center;
      transform: translate(-50%, -50%) rotate(0deg);
      contain: layout style paint;
      backface-visibility: hidden;
      will-change: transform, left, top, opacity;
    `;

    // 创建三角形箭头 - 使用更显眼的亮黄色
    const shape = document.createElement('div');
    shape.style.cssText = `
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 16px solid #ffff00;
    `;
    root.appendChild(shape);

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
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95);
      white-space: nowrap;
      margin-top: 4px;
    `;
    distanceLabel.textContent = '';
    root.appendChild(distanceLabel);

    return { root, shape, distanceLabel };
  }

  /**
   * 更新箭头指示器位置和方向
   * 使用相机局部坐标系进行角度计算，正确处理敌人在相机后面或下方的情况
   */
  private updateArrowIndicator(
    arrow: HTMLDivElement,
    arrowShape: HTMLDivElement | null,
    distanceLabel: HTMLSpanElement | null,
    cameraLocal: Vector3,
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
    // 注意：屏幕 Y 轴向下为正（Y=0 是顶部，Y=1 是底部）
    if (isBehind) {
      // 敌人在后面：箭头放在对应方向的边缘
      if (Math.abs(cameraLocal.y) > Math.abs(cameraLocal.x)) {
        // 更偏上/下：isAbove=true → 敌人在相机上方 → 箭头放屏幕顶部(edgePadding)
        arrowY = isAbove ? edgePadding : 1 - edgePadding;
        const hRatio = Math.min(1, Math.abs(angleH) / maxAngleH);
        arrowX = centerX + (isOnRight ? hRatio : -hRatio) * (0.5 - edgePadding);
      } else {
        // 更偏左/右
        arrowX = isOnRight ? 1 - edgePadding : edgePadding;
        const vRatio = Math.min(1, Math.abs(angleV) / maxAngleV);
        // isAbove=true → 敌人在上方 → 箭头 Y 值应该更小（靠近顶部）
        arrowY = centerY + (isAbove ? -vRatio : vRatio) * (0.5 - edgePadding);
      }
    } else {
      // 敌人在前面但不在视野内：将角度映射到屏幕位置
      const normalizedH = Math.max(-1, Math.min(1, angleH / maxAngleH));
      const normalizedV = Math.max(-1, Math.min(1, angleV / maxAngleV));

      arrowX = centerX + normalizedH * (0.5 - edgePadding);
      // normalizedV > 0 表示敌人在上方 → arrowY 应该更小（靠近顶部）
      arrowY = centerY - normalizedV * (0.5 - edgePadding);

      // 如果超出视野，钳制到最近的边缘
      if (Math.abs(normalizedH) >= 1 || Math.abs(normalizedV) >= 1) {
        const slope = Math.abs(angleV) / (Math.abs(angleH) + 0.001);
        if (slope > 1) {
          // 上下边缘：isAbove=true → 敌人在上方 → 箭头放屏幕顶部
          arrowY = isAbove ? edgePadding : 1 - edgePadding;
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

    // 箭头默认指向上方（CSS border-bottom 三角形尖端朝上）
    // atan2(x, y) 给出正确的旋转角度：
    // - 上方 (y>0): atan2(0, 1) = 0°
    // - 下方 (y<0): atan2(0, -1) = 180°
    // - 右方 (x>0): atan2(1, 0) = 90°
    // - 左方 (x<0): atan2(-1, 0) = -90°
    const rotationAngle = Math.atan2(cameraLocal.x, cameraLocal.y) * (180 / Math.PI);

    this.setStyleValue(arrow, 'left', `${arrowX * 100}%`);
    this.setStyleValue(arrow, 'top', `${arrowY * 100}%`);
    this.setStyleValue(
      arrow,
      'transform',
      `translate(-50%, -50%) rotate(${rotationAngle}deg)`
    );

    // 更新箭头颜色（亮黄色）
    if (arrowShape) {
      this.setStyleValue(arrowShape, 'borderBottomColor', '#ffff00');
    }

    // 更新距离标签
    if (distanceLabel) {
      this.setTextContent(distanceLabel, `${Math.round(distance)}m`);
      this.setStyleValue(distanceLabel, 'transform', 'translateX(-50%)');
    }
  }

  private resetArrowIndicator(
    arrow: HTMLDivElement,
    distanceLabel: HTMLSpanElement | null
  ): void {
    this.setStyleValue(arrow, 'display', 'none');
    this.setStyleValue(arrow, 'opacity', '0');
    this.setStyleValue(arrow, 'visibility', 'hidden');
    this.setStyleValue(arrow, 'left', '50%');
    this.setStyleValue(arrow, 'top', '50%');
    this.setStyleValue(arrow, 'transform', 'translate(-50%, -50%) rotate(0deg)');

    if (distanceLabel) {
      this.setTextContent(distanceLabel, '');
      this.setStyleValue(distanceLabel, 'transform', 'translateX(-50%)');
    }
  }

  /**
   * 世界坐标转屏幕坐标
   */
  private worldToScreen(
    position: Vector3,
    camera: Camera
  ): { x: number; y: number; z: number } {
    this.screenVector.copy(position).project(camera);

    // NDC: x, y 范围是 -1 到 1
    // 屏幕: x 范围 0 到 width, y 范围 0 到 height (Y 向下为正)
    return {
      x: (this.screenVector.x + 1) / 2,
      y: 1 - (this.screenVector.y + 1) / 2, // 反转 Y 轴，因为屏幕 Y 向下为正
      z: this.screenVector.z,
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
  private getEnemyName(mesh: Object3D): string {
    const name = mesh.name || '';
    if (name.includes('boss_eye')) return 'Eye';
    if (name.includes('HEAVY_BOMBER')) return 'Heavy Bomber';
    if (name.includes('DESERT_FORTRESS')) return 'Desert Fortress';
    if (name.includes('OCTOPUS_WARSHIP')) return 'Octopus Warship';
    if (name.includes('MISSILE_DESTROYER')) return 'Missile Destroyer';
    if (name.includes('SKY_CARRIER')) return 'Sky Carrier';
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
  private getTargetName(mesh: Object3D, isFriendly: boolean): string {
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

  private getBarHeightOffset(enemyMesh: Object3D): number {
    const name = enemyMesh.name || '';
    const isBoss = name.includes('BOSS');
    const isEye = name.includes('boss_eye');
    return isBoss ? 15 : isEye ? 5 : 2;
  }

  private getBarPositionFromScreen(
    screenPos: { x: number; y: number },
    barWidth: number,
    barHeight: number
  ): { x: number; y: number } {
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
      if (barData.arrow) {
        this.resetArrowIndicator(barData.arrow, barData.arrowDistanceLabel);
      }
      barData.bar.remove();
      barData.arrow?.remove();
      this.healthBars.delete(id);
    }
  }

  /**
   * 清除所有血条
   */
  public clear(): void {
    for (const barData of this.healthBars.values()) {
      if (barData.arrow) {
        this.resetArrowIndicator(barData.arrow, barData.arrowDistanceLabel);
      }
      barData.bar.remove();
      barData.arrow?.remove();
    }
    this.healthBars.clear();
  }

  public dispose(): void {
    this.clear();
    this.container.remove();
  }

  /**
   * 获取第一个敌人的屏幕位置（用于锁定系统）
   * @returns 第一个可见敌人的屏幕位置，如果没有敌人则返回 null
   */
  public getFirstEnemyScreenPos(): { x: number; y: number } | null {
    for (const barData of this.healthBars.values()) {
      if (barData.screenPos && barData.bar.style.display !== 'none') {
        return { x: barData.screenPos.x, y: barData.screenPos.y };
      }
    }
    return null;
  }
}
