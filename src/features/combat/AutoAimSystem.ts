import * as THREE from 'three';

/**
 * 自动瞄准系统
 * 当敌人在屏幕中心区域时自动锁定
 */
export class AutoAimSystem {
  // 自动瞄准参数
  private aimAssistRadius: number = 0.15; // 屏幕中心区域的半径比例
  private maxAimDistance: number = 200;    // 最大瞄准距离
  private targetSwitchDelay: number = 0.5; // 切换目标的延迟
  private lastTargetSwitch: number = 0;

  // 当前锁定的目标
  private currentTarget: THREE.Object3D | null = null;

  /**
   * 更新自动瞄准系统
   * @param playerPosition 玩家位置
   * @param playerDirection 玩家朝向
   * @param camera 相机
   * @param enemies 敌人列表
   * @param currentTime 当前时间
   * @returns 锁定的目标，如果没有则返回 null
   */
  public update(
    playerPosition: THREE.Vector3,
    playerDirection: THREE.Vector3,
    camera: THREE.Camera,
    enemies: THREE.Object3D[],
    currentTime: number
  ): THREE.Object3D | null {
    let bestTarget: THREE.Object3D | null = null;
    let bestScore = Infinity;

    for (const enemy of enemies) {
      if (!enemy.visible) continue;

      const enemyPos = enemy.position.clone();
      const distance = playerPosition.distanceTo(enemyPos);

      // 检查距离
      if (distance > this.maxAimDistance) continue;

      // 检查是否在视野内
      const screenPos = this.worldToScreen(enemyPos, camera);
      if (!this.isInAimAssistZone(screenPos)) continue;

      // 检查是否在玩家前方（而不是后方）
      const toEnemy = enemyPos.clone().sub(playerPosition).normalize();
      const dot = playerDirection.dot(toEnemy);
      if (dot < 0) continue; // 在玩家后方

      // 计算分数（越靠近中心，距离越近，分数越高）
      const centerDist = Math.sqrt(
        Math.pow(screenPos.x - 0.5, 2) +
        Math.pow(screenPos.y - 0.5, 2)
      );

      const score = centerDist * distance;

      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    // 切换目标时有延迟
    if (bestTarget !== this.currentTarget) {
      if (currentTime - this.lastTargetSwitch > this.targetSwitchDelay) {
        this.currentTarget = bestTarget;
        this.lastTargetSwitch = currentTime;
      }
    }

    return this.currentTarget;
  }

  /**
   * 检查屏幕位置是否在自动瞄准区域内
   */
  private isInAimAssistZone(screenPos: { x: number; y: number }): boolean {
    const centerX = 0.5;
    const centerY = 0.5;

    const distance = Math.sqrt(
      Math.pow(screenPos.x - centerX, 2) +
      Math.pow(screenPos.y - centerY, 2)
    );

    return distance <= this.aimAssistRadius;
  }

  /**
   * 世界坐标转屏幕坐标
   */
  private worldToScreen(
    position: THREE.Vector3,
    camera: THREE.Camera
  ): { x: number; y: number } {
    const vector = position.clone();
    vector.project(camera);

    return {
      x: (vector.x + 1) / 2,
      y: (vector.y + 1) / 2
    };
  }

  /**
   * 获取当前锁定的目标
   */
  public getCurrentTarget(): THREE.Object3D | null {
    return this.currentTarget;
  }

  /**
   * 计算带自动修正的射击方向
   * @param origin 发射位置
   * @param baseDirection 基础方向（玩家朝向）
   * @param target 目标（如果有）
   * @param homingStrength 追踪强度 (0-1)
   */
  public getHomingDirection(
    origin: THREE.Vector3,
    baseDirection: THREE.Vector3,
    target: THREE.Object3D | null,
    homingStrength: number = 0.3
  ): THREE.Vector3 {
    if (!target) {
      return baseDirection.clone().normalize();
    }

    // 计算到目标的方向
    const toTarget = target.position.clone().sub(origin).normalize();

    // 插值：部分追踪
    const homingDirection = new THREE.Vector3().lerpVectors(
      baseDirection,
      toTarget,
      homingStrength
    );

    return homingDirection.normalize();
  }

  /**
   * 计算完全自动瞄准的方向（用于自动瞄准模式）
   */
  public getAutoAimDirection(
    origin: THREE.Vector3,
    target: THREE.Object3D
  ): THREE.Vector3 {
    return target.position.clone().sub(origin).normalize();
  }

  /**
   * 设置瞄准辅助半径
   */
  public setAimAssistRadius(radius: number): void {
    this.aimAssistRadius = Math.max(0, Math.min(1, radius));
  }
}
