import { Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import { GAME_CONSTANTS } from '@/config';

/**
 * 导弹锁定指示器
 * 黄色圈：锁定范围，始终显示在屏幕中心
 * 橙色圈：锁定进度，从黄色圈大小开始缩小到敌人位置
 */
export class LockOnIndicator {
  private static readonly CANDIDATE_REFRESH_INTERVAL = 0.12;

  private container: HTMLDivElement;
  private lockCircle: HTMLDivElement; // 黄色圈（锁定范围）
  private lockProgress: HTMLDivElement; // 橙色圈（锁定进度）
  private noMissileLabel: HTMLDivElement;

  // 锁定状态
  private isLockingOn: boolean = false;
  private currentTarget: Object3D | null = null;
  private lockProgressValue: number = 0; // 0-1，1 表示锁定完成
  private lockTime: number = 3.0; // 锁定时间（默认 3 秒，可通过 setLockTime 动态调整）
  private lockedTarget: Object3D | null = null; // 锁定的目标（一旦锁定就保持不变）

  // 屏幕中心
  private centerX: number = window.innerWidth / 2;
  private centerY: number = window.innerHeight / 2;
  private lockCircleSize: number = 0; // 黄色圈大小
  private resizeHandler!: () => void;
  private viewportWidth: number = window.innerWidth;
  private viewportHeight: number = window.innerHeight;
  private candidateRefreshTimer: number = 0;
  private readonly screenPosition = { x: 0, y: 0 };
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();
  private readonly worldPosition = new Vector3();
  private readonly projectedVector = new Vector3();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'lock-on-indicator';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 40;
      display: none;
      contain: layout style paint;
    `;

    // 黄色圈（锁定范围）- 固定在屏幕中心
    this.lockCircle = document.createElement('div');
    this.lockCircle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 4px solid rgba(255, 200, 0, 0.8);
      background: rgba(255, 200, 0, 0.1);
      opacity: 1;
      visibility: visible;
      will-change: transform, opacity;
    `;

    // 橙色圈（锁定进度）- 会移动和缩小
    this.lockProgress = document.createElement('div');
    this.lockProgress.style.cssText = `
      position: absolute;
      border-radius: 50%;
      border: 3px solid rgba(255, 150, 0, 0.9);
      background: rgba(255, 150, 0, 0.2);
      transform: translate(-50%, -50%);
      opacity: 0;
      visibility: hidden;
      display: none;
      will-change: transform, left, top, width, height, opacity;
    `;

    // "NO MISSILE" 标签
    this.noMissileLabel = document.createElement('div');
    this.noMissileLabel.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
      visibility: hidden;
      color: #ff6600;
      font-size: 20px;
      font-weight: bold;
      font-family: 'Arial Black', monospace;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      display: none;
    `;
    this.setTextContent(this.noMissileLabel, 'NO MISSILE');

    this.container.appendChild(this.noMissileLabel);
    this.container.appendChild(this.lockProgress);
    this.container.appendChild(this.lockCircle);
    document.body.appendChild(this.container);

    // 设置黄色圈大小
    this.updateLockCircleSize();

    // 监听窗口大小变化
    this.resizeHandler = () => {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
      this.centerX = this.viewportWidth / 2;
      this.centerY = this.viewportHeight / 2;
      this.updateLockCircleSize();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * 更新黄色圈大小
   */
  private updateLockCircleSize(): void {
    this.lockCircleSize = Math.min(window.innerWidth, window.innerHeight) * 0.3; // 屏幕最小边的 30%
    this.setStyleValue(this.lockCircle, 'width', `${this.lockCircleSize}px`);
    this.setStyleValue(this.lockCircle, 'height', `${this.lockCircleSize}px`);
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

  /**
   * 开始锁定
   */
  public startLockOn(): void {
    this.isLockingOn = true;
    this.lockProgressValue = 0;
    this.currentTarget = null;
    this.lockedTarget = null; // 重置锁定的目标
    this.candidateRefreshTimer = 0;
    this.setStyleValue(this.container, 'display', 'block');
    this.resetNoMissileLabel();
    this.setStyleValue(this.lockCircle, 'display', 'block');
    this.setStyleValue(this.lockCircle, 'opacity', '1');
    this.setStyleValue(this.lockCircle, 'visibility', 'visible');
    this.setStyleValue(this.lockCircle, 'borderColor', 'rgba(255, 200, 0, 0.8)');
    this.setStyleValue(this.lockCircle, 'backgroundColor', 'rgba(255, 200, 0, 0.1)');
    this.resetLockProgressVisuals();
  }

  /**
   * 取消锁定
   */
  public cancelLockOn(): void {
    this.isLockingOn = false;
    this.currentTarget = null;
    this.lockedTarget = null;
    this.lockProgressValue = 0;
    this.candidateRefreshTimer = 0;
    this.resetLockProgressVisuals();
    this.resetNoMissileLabel();
    this.setStyleValue(this.container, 'display', 'none');
  }

  /**
   * 导弹数量为0时显示提示
   */
  public setNoMissiles(show: boolean): void {
    if (show) {
      this.setStyleValue(this.container, 'display', 'block');
      this.setStyleValue(this.lockCircle, 'display', 'none');
      this.resetLockProgressVisuals();
      this.setStyleValue(this.noMissileLabel, 'display', 'block');
      this.setStyleValue(this.noMissileLabel, 'opacity', '1');
      this.setStyleValue(this.noMissileLabel, 'visibility', 'visible');
      this.isLockingOn = false;
    } else {
      this.resetNoMissileLabel();
      if (this.isLockingOn) {
        this.setStyleValue(this.lockCircle, 'display', 'block');
        this.setStyleValue(this.lockCircle, 'opacity', '1');
        this.setStyleValue(this.lockCircle, 'visibility', 'visible');
      }
    }
  }

  /**
   * 发射导弹（锁定完成后调用）
   */
  public onMissileFired(): void {
    this.cancelLockOn();
  }

  public update(
    playerPos: Vector3,
    enemies: Object3D[],
    camera: Camera,
    deltaTime: number,
    _enemyScreenPos: { x: number; y: number } | null
  ): boolean {
    if (!this.isLockingOn) {
      return false;
    }

    const lockCircleRadius = this.lockCircleSize / 2;
    const lockDistance = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE / 2;
    const lockCircleRadiusSquared = lockCircleRadius * lockCircleRadius;

    if (this.lockedTarget) {
      this.lockedTarget.getWorldPosition(this.worldPosition);

      if (
        !isFinite(this.worldPosition.x) ||
        !isFinite(this.worldPosition.y) ||
        !isFinite(this.worldPosition.z)
      ) {
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null, null);
        return false;
      }

      if (!this.worldToScreenPixels(this.worldPosition, camera)) {
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null, null);
        return false;
      }

      const worldDistance = playerPos.distanceTo(this.worldPosition);
      if (worldDistance > lockDistance) {
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null, null);
        return false;
      }

      const dx = this.screenPosition.x - this.centerX;
      const dy = this.screenPosition.y - this.centerY;
      const screenDistanceSquared = dx * dx + dy * dy;

      if (screenDistanceSquared > lockCircleRadiusSquared) {
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null, null);
        return false;
      }

      this.lockProgressValue += deltaTime / this.lockTime;

      this.updateLockProgress(this.screenPosition.x, this.screenPosition.y);

      if (this.lockProgressValue >= 1) {
        this.lockProgressValue = 1;
        this.onLockComplete();
        return true;
      }

      return false;
    }

    this.candidateRefreshTimer -= deltaTime;
    if (this.candidateRefreshTimer <= 0) {
      this.candidateRefreshTimer = LockOnIndicator.CANDIDATE_REFRESH_INTERVAL;
      this.selectBestTarget(enemies, playerPos, camera, lockDistance, lockCircleRadiusSquared);
    }

    this.updateLockProgress(null, null);

    return false;
  }

  /**
   * 世界坐标转屏幕坐标（像素）
   */
  private worldToScreenPixels(
    position: Vector3,
    camera: Camera
  ): boolean {
    this.projectedVector.copy(position).project(camera);

    // 检查是否在相机前面
    if (this.projectedVector.z > 1) {
      return false;
    }

    this.screenPosition.x = ((this.projectedVector.x + 1) / 2) * this.viewportWidth;
    this.screenPosition.y = (-(this.projectedVector.y - 1) / 2) * this.viewportHeight;
    return true;
  }

  /**
   * 更新橙色圈位置和大小
   * @param targetScreenPos 目标屏幕位置 (0-1)
   */
  private updateLockProgress(targetScreenX: number | null, targetScreenY: number | null): void {
    if (this.lockProgressValue >= 1 && targetScreenX !== null && targetScreenY !== null) {
      // 锁定完成：橙色圈变成绿色，移动到敌人位置
      this.setStyleValue(this.lockProgress, 'display', 'block');
      this.setStyleValue(this.lockProgress, 'opacity', '1');
      this.setStyleValue(this.lockProgress, 'visibility', 'visible');
      this.setStyleValue(this.lockProgress, 'left', `${targetScreenX}px`);
      this.setStyleValue(this.lockProgress, 'top', `${targetScreenY}px`);
      this.setStyleValue(this.lockProgress, 'width', '40px');
      this.setStyleValue(this.lockProgress, 'height', '40px');
      this.setStyleValue(this.lockProgress, 'border', '3px solid #00ff00');
      this.setStyleValue(this.lockProgress, 'backgroundColor', 'rgba(0, 255, 0, 0.3)');
      this.setStyleValue(this.lockProgress, 'boxShadow', '0 0 10px rgba(0, 255, 0, 0.45)');

      // 黄色圈变成绿色
      this.setStyleValue(this.lockCircle, 'borderColor', '#00ff00');
      this.setStyleValue(this.lockCircle, 'backgroundColor', 'rgba(0, 255, 0, 0.1)');
      this.setStyleValue(this.lockCircle, 'boxShadow', '0 0 12px rgba(0, 255, 0, 0.28)');
    } else if (this.lockProgressValue > 0 && targetScreenX !== null && targetScreenY !== null) {
      // 锁定中：橙色圈从黄色圈大小开始，缩小到敌人位置
      const progress = this.lockProgressValue;

      // 从黄色圈大小逐渐缩小到 40px
      const startSize = this.lockCircleSize;
      const endSize = 40;
      const currentSize = startSize - (startSize - endSize) * progress;

      // 从屏幕中心移动到敌人位置
      const currentX = this.centerX + (targetScreenX - this.centerX) * progress;
      const currentY = this.centerY + (targetScreenY - this.centerY) * progress;

      this.setStyleValue(this.lockProgress, 'display', 'block');
      this.setStyleValue(this.lockProgress, 'opacity', '1');
      this.setStyleValue(this.lockProgress, 'visibility', 'visible');
      this.setStyleValue(this.lockProgress, 'left', `${currentX}px`);
      this.setStyleValue(this.lockProgress, 'top', `${currentY}px`);
      this.setStyleValue(this.lockProgress, 'width', `${currentSize}px`);
      this.setStyleValue(this.lockProgress, 'height', `${currentSize}px`);
      this.setStyleValue(this.lockProgress, 'border', '3px solid rgba(255, 150, 0, 0.9)');
      this.setStyleValue(this.lockProgress, 'backgroundColor', 'rgba(255, 150, 0, 0.2)');
      this.setStyleValue(this.lockProgress, 'boxShadow', 'none');

      // 黄色圈保持黄色
      this.setStyleValue(this.lockCircle, 'borderColor', 'rgba(255, 200, 0, 0.8)');
      this.setStyleValue(this.lockCircle, 'backgroundColor', 'rgba(255, 200, 0, 0.1)');
      this.setStyleValue(this.lockCircle, 'boxShadow', 'none');
    } else {
      // 没有目标或进度为0：隐藏橙色圈
      this.resetLockProgressVisuals();

      // 黄色圈保持黄色
      this.setStyleValue(this.lockCircle, 'borderColor', 'rgba(255, 200, 0, 0.8)');
      this.setStyleValue(this.lockCircle, 'backgroundColor', 'rgba(255, 200, 0, 0.1)');
      this.setStyleValue(this.lockCircle, 'boxShadow', 'none');
    }
  }

  /**
   * 锁定完成
   */
  private onLockComplete(): void {
    // 锁定完成，大黄色圈变绿色，进度圈变绿色并移到敌人位置
    // 已在 updateLockProgress() 中处理
  }

  /**
   * 获取当前锁定的目标
   */
  public getCurrentTarget(): Object3D | null {
    return this.lockProgressValue >= 1 ? this.currentTarget : null;
  }

  /**
   * 获取锁定进度 (0-1)
   */
  public getLockProgress(): number {
    return this.lockProgressValue;
  }

  /**
   * 是否正在锁定
   */
  public isLocking(): boolean {
    return this.isLockingOn;
  }

  /**
   * 设置锁定时间
   * @param time 锁定时间（秒），最小 0.5 秒
   */
  public setLockTime(time: number): void {
    this.lockTime = Math.max(0.5, time);
  }

  private selectBestTarget(
    enemies: Object3D[],
    playerPos: Vector3,
    camera: Camera,
    lockDistance: number,
    lockCircleRadiusSquared: number
  ): void {
    let bestTarget: Object3D | null = null;
    let bestDistance = Infinity;

    for (const enemy of enemies) {
      enemy.getWorldPosition(this.worldPosition);

      const worldDistance = playerPos.distanceTo(this.worldPosition);
      if (worldDistance > lockDistance) {
        continue;
      }

      if (!this.worldToScreenPixels(this.worldPosition, camera)) {
        continue;
      }

      const dx = this.screenPosition.x - this.centerX;
      const dy = this.screenPosition.y - this.centerY;
      const screenDistanceSquared = dx * dx + dy * dy;

      if (screenDistanceSquared > lockCircleRadiusSquared) {
        continue;
      }

      if (worldDistance < bestDistance) {
        bestDistance = worldDistance;
        bestTarget = enemy;
      }
    }

    if (!bestTarget) {
      this.currentTarget = null;
      this.lockedTarget = null;
      this.lockProgressValue = Math.max(0, this.lockProgressValue - LockOnIndicator.CANDIDATE_REFRESH_INTERVAL * 3);
      return;
    }

    if (bestTarget !== this.currentTarget) {
      this.lockProgressValue = 0;
    }

    this.currentTarget = bestTarget;
    this.lockedTarget = bestTarget;
  }

  private resetLockProgressVisuals(): void {
    this.setStyleValue(this.lockProgress, 'display', 'none');
    this.setStyleValue(this.lockProgress, 'opacity', '0');
    this.setStyleValue(this.lockProgress, 'visibility', 'hidden');
    this.setStyleValue(this.lockProgress, 'left', `${this.centerX}px`);
    this.setStyleValue(this.lockProgress, 'top', `${this.centerY}px`);
    this.setStyleValue(this.lockProgress, 'width', '0px');
    this.setStyleValue(this.lockProgress, 'height', '0px');
    this.setStyleValue(this.lockProgress, 'transform', 'translate(-50%, -50%)');
    this.setStyleValue(this.lockProgress, 'boxShadow', 'none');
  }

  private resetNoMissileLabel(): void {
    this.setStyleValue(this.noMissileLabel, 'display', 'none');
    this.setStyleValue(this.noMissileLabel, 'opacity', '0');
    this.setStyleValue(this.noMissileLabel, 'visibility', 'hidden');
    this.setStyleValue(this.noMissileLabel, 'transform', 'translate(-50%, -50%)');
  }

  /**
   * 清除
   */
  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.container.parentElement) {
      this.container.remove();
    }
  }
}
