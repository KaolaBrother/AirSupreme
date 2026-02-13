import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';

/**
 * 导弹锁定指示器
 * 黄色圈：锁定范围，始终显示在屏幕中心
 * 橙色圈：锁定进度，从黄色圈大小开始缩小到敌人位置
 */
export class LockOnIndicator {
  private container: HTMLDivElement;
  private lockCircle: HTMLDivElement;  // 黄色圈（锁定范围）
  private lockProgress: HTMLDivElement;  // 橙色圈（锁定进度）
  private noMissileLabel: HTMLDivElement;

  // 锁定状态
  private isLockingOn: boolean = false;
  private currentTarget: THREE.Object3D | null = null;
  private lockProgressValue: number = 0; // 0-1，1 表示锁定完成
  private lockTime: number = 0.8; // 锁定时间 0.8 秒
  private lockedTarget: THREE.Object3D | null = null; // 锁定的目标（一旦锁定就保持不变）

  // 屏幕中心
  private centerX: number = window.innerWidth / 2;
  private centerY: number = window.innerHeight / 2;
  private lockCircleSize: number = 0; // 黄色圈大小

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
    `;

    // 橙色圈（锁定进度）- 会移动和缩小
    this.lockProgress = document.createElement('div');
    this.lockProgress.style.cssText = `
      position: absolute;
      border-radius: 50%;
      border: 3px solid rgba(255, 150, 0, 0.9);
      background: rgba(255, 150, 0, 0.2);
      transform: translate(-50%, -50%);
    `;

    // "NO MISSILE" 标签
    this.noMissileLabel = document.createElement('div');
    this.noMissileLabel.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ff6600;
      font-size: 20px;
      font-weight: bold;
      font-family: 'Arial Black', monospace;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
    `;
    this.noMissileLabel.textContent = 'NO MISSILE';

    this.container.appendChild(this.noMissileLabel);
    this.container.appendChild(this.lockProgress);
    this.container.appendChild(this.lockCircle);
    document.body.appendChild(this.container);

    // 设置黄色圈大小
    this.updateLockCircleSize();

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      this.centerX = window.innerWidth / 2;
      this.centerY = window.innerHeight / 2;
      this.updateLockCircleSize();
    });
  }

  /**
   * 更新黄色圈大小
   */
  private updateLockCircleSize(): void {
    this.lockCircleSize = Math.min(window.innerWidth, window.innerHeight) * 0.3; // 屏幕最小边的 30%
    this.lockCircle.style.width = `${this.lockCircleSize}px`;
    this.lockCircle.style.height = `${this.lockCircleSize}px`;
  }

  /**
   * 开始锁定
   */
  public startLockOn(): void {
    this.isLockingOn = true;
    this.lockProgressValue = 0;
    this.currentTarget = null;
    this.lockedTarget = null; // 重置锁定的目标
    this.container.style.display = 'block';
    this.noMissileLabel.style.display = 'none';
    this.lockCircle.style.display = 'block';
    this.lockCircle.style.borderColor = 'rgba(255, 200, 0, 0.8)';
    this.lockCircle.style.backgroundColor = 'rgba(255, 200, 0, 0.1)';
    this.lockProgress.style.display = 'none';
  }

  /**
   * 取消锁定
   */
  public cancelLockOn(): void {
    this.isLockingOn = false;
    this.currentTarget = null;
    this.lockedTarget = null;
    this.lockProgressValue = 0;
    this.container.style.display = 'none';
  }

  /**
   * 导弹数量为0时显示提示
   */
  public setNoMissiles(show: boolean): void {
    if (show) {
      this.container.style.display = 'block';
      this.lockCircle.style.display = 'none';
      this.lockProgress.style.display = 'none';
      this.noMissileLabel.style.display = 'block';
      this.isLockingOn = false;
    } else {
      this.noMissileLabel.style.display = 'none';
      if (this.isLockingOn) {
        this.lockCircle.style.display = 'block';
      }
    }
  }

  /**
   * 发射导弹（锁定完成后调用）
   */
  public onMissileFired(): void {
    this.cancelLockOn();
  }

  /**
   * 更新锁定状态
   * @param playerPos 玩家位置
   * @param enemies 敌人列表
   * @param camera 相机
   * @param deltaTime 时间增量
   * @param _enemyScreenPos 敌人UI屏幕位置（未使用，保留兼容性）
   * @returns 锁定是否完成
   */
  public update(
    playerPos: THREE.Vector3,
    enemies: THREE.Object3D[],
    camera: THREE.Camera,
    deltaTime: number,
    _enemyScreenPos: { x: number; y: number } | null
  ): boolean {
    if (!this.isLockingOn) {
      return false;
    }

    // 黄色圈半径（像素）
    const lockCircleRadius = this.lockCircleSize / 2;

    // 锁定距离：最大飞行距离的一半
    const lockDistance = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE / 2;

    // 阶段1：验证当前锁定目标是否仍然有效
    if (this.lockedTarget) {
      // 检查目标是否还活着
      if (!this.lockedTarget.parent) {
        // 目标已销毁，清除锁定，下一帧会寻找新目标
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null);
        return false;
      }

      // 计算目标的屏幕位置
      const targetScreenPosPixels = this.worldToScreenPixels(this.lockedTarget.position, camera);
      if (!targetScreenPosPixels) {
        // 目标不在相机视野内，清除锁定
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null);
        return false;
      }

      // 条件1：检查世界距离
      const worldDistance = playerPos.distanceTo(this.lockedTarget.position);
      if (worldDistance > lockDistance) {
        // 距离太远，清除锁定，允许寻找新目标
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null);
        return false;
      }

      // 条件2：检查屏幕位置是否在黄色圈内
      const dx = targetScreenPosPixels.x - this.centerX;
      const dy = targetScreenPosPixels.y - this.centerY;
      const screenDistance = Math.sqrt(dx * dx + dy * dy);

      if (screenDistance > lockCircleRadius) {
        // 在黄色圈外，清除锁定，允许寻找新目标
        this.lockedTarget = null;
        this.currentTarget = null;
        this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
        this.updateLockProgress(null);
        return false;
      }

      // 当前锁定目标仍然有效，增加锁定进度
      this.lockProgressValue += deltaTime / this.lockTime;

      // 转换为 0-1 的屏幕坐标用于更新 UI
      const normalizedScreenPos = {
        x: targetScreenPosPixels.x / window.innerWidth,
        y: targetScreenPosPixels.y / window.innerHeight
      };
      this.updateLockProgress(normalizedScreenPos);

      // 锁定完成
      if (this.lockProgressValue >= 1) {
        this.lockProgressValue = 1;
        this.onLockComplete();
        return true;
      }

      return false;
    }

    // 阶段2：没有锁定目标，寻找新目标
    let bestTarget: THREE.Object3D | null = null;
    let bestDistance = Infinity;

    // 遍历所有敌人，找到同时满足两个条件的目标
    for (const enemy of enemies) {
      // 条件1：世界距离在锁定距离内
      const worldDistance = playerPos.distanceTo(enemy.position);
      if (worldDistance > lockDistance) {
        continue; // 距离太远，跳过
      }

      // 条件2：屏幕位置在黄色圈内
      const screenPos = this.worldToScreenPixels(enemy.position, camera);
      if (!screenPos) {
        continue; // 不在相机视野内，跳过
      }

      const dx = screenPos.x - this.centerX;
      const dy = screenPos.y - this.centerY;
      const screenDistance = Math.sqrt(dx * dx + dy * dy);

      if (screenDistance > lockCircleRadius) {
        continue; // 在黄色圈外，跳过
      }

      // 两个条件都满足，选择最近的目标
      if (worldDistance < bestDistance) {
        bestDistance = worldDistance;
        bestTarget = enemy;
      }
    }

    if (bestTarget) {
      // 找到满足条件的目标，开始锁定
      this.lockedTarget = bestTarget;
      this.currentTarget = bestTarget;
    } else {
      // 没有找到目标，更新 UI 显示空状态
      this.updateLockProgress(null);
    }

    return false;
  }

  /**
   * 世界坐标转屏幕坐标（像素）
   */
  private worldToScreenPixels(position: THREE.Vector3, camera: THREE.Camera): { x: number; y: number } | null {
    const vector = position.clone();
    vector.project(camera);

    // 检查是否在相机前面
    if (vector.z > 1) {
      return null;
    }

    return {
      x: (vector.x + 1) / 2 * window.innerWidth,
      y: -(vector.y - 1) / 2 * window.innerHeight
    };
  }

  /**
   * 更新橙色圈位置和大小
   * @param targetScreenPos 目标屏幕位置 (0-1)
   */
  private updateLockProgress(targetScreenPos: { x: number; y: number } | null): void {
    if (this.lockProgressValue >= 1 && targetScreenPos) {
      // 锁定完成：橙色圈变成绿色，移动到敌人位置
      const targetX = targetScreenPos.x * window.innerWidth;
      const targetY = targetScreenPos.y * window.innerHeight;

      this.lockProgress.style.display = 'block';
      this.lockProgress.style.left = `${targetX}px`;
      this.lockProgress.style.top = `${targetY}px`;
      this.lockProgress.style.width = '40px';
      this.lockProgress.style.height = '40px';
      this.lockProgress.style.border = '3px solid #00ff00';
      this.lockProgress.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
      this.lockProgress.style.boxShadow = '0 0 15px #00ff00';

      // 黄色圈变成绿色
      this.lockCircle.style.borderColor = '#00ff00';
      this.lockCircle.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
      this.lockCircle.style.boxShadow = '0 0 20px #00ff00';
    } else if (this.lockProgressValue > 0 && targetScreenPos) {
      // 锁定中：橙色圈从黄色圈大小开始，缩小到敌人位置
      const progress = this.lockProgressValue;

      // 从黄色圈大小逐渐缩小到 40px
      const startSize = this.lockCircleSize;
      const endSize = 40;
      const currentSize = startSize - (startSize - endSize) * progress;

      // 从屏幕中心移动到敌人位置
      const targetX = targetScreenPos.x * window.innerWidth;
      const targetY = targetScreenPos.y * window.innerHeight;
      const currentX = this.centerX + (targetX - this.centerX) * progress;
      const currentY = this.centerY + (targetY - this.centerY) * progress;

      this.lockProgress.style.display = 'block';
      this.lockProgress.style.left = `${currentX}px`;
      this.lockProgress.style.top = `${currentY}px`;
      this.lockProgress.style.width = `${currentSize}px`;
      this.lockProgress.style.height = `${currentSize}px`;
      this.lockProgress.style.border = '3px solid rgba(255, 150, 0, 0.9)';
      this.lockProgress.style.backgroundColor = 'rgba(255, 150, 0, 0.2)';
      this.lockProgress.style.boxShadow = 'none';

      // 黄色圈保持黄色
      this.lockCircle.style.borderColor = 'rgba(255, 200, 0, 0.8)';
      this.lockCircle.style.backgroundColor = 'rgba(255, 200, 0, 0.1)';
      this.lockCircle.style.boxShadow = 'none';
    } else {
      // 没有目标或进度为0：隐藏橙色圈
      this.lockProgress.style.display = 'none';

      // 黄色圈保持黄色
      this.lockCircle.style.borderColor = 'rgba(255, 200, 0, 0.8)';
      this.lockCircle.style.backgroundColor = 'rgba(255, 200, 0, 0.1)';
      this.lockCircle.style.boxShadow = 'none';
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
  public getCurrentTarget(): THREE.Object3D | null {
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
   * 清除
   */
  public dispose(): void {
    this.container.remove();
  }
}
