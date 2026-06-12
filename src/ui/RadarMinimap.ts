import { Vector3 } from 'three';
import type { Quaternion } from 'three';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('RadarMinimap');

interface EnemyRadarInfo {
  position: Vector3;
  isSpawning: boolean; // 是否正在生成（传送门动画中）
}

/**
 * 气球状态（用于雷达显示）
 */
interface BalloonRadarInfo {
  position: Vector3;
}

/**
 * 雷达小地图
 * 在左下角显示敌人方位
 * 使用平面坐标（x, z），正北向上
 */
export class RadarMinimap {
  private container: HTMLDivElement;
  private radarCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private size: number = 150; // 雷达大小
  private range: number = 800; // 雷达显示范围（米）

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'radar-minimap';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: ${this.size}px;
      height: ${this.size}px;
      background: rgba(0, 20, 40, 0.85);
      border: 2px solid rgba(0, 255, 100, 0.6);
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      z-index: 50;
      pointer-events: none;
    `;

    // 创建雷达画布
    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.width = this.size;
    this.radarCanvas.height = this.size;
    this.radarCanvas.style.cssText = `
      width: 100%;
      height: 100%;
      border-radius: 6px;
    `;

    this.ctx = this.radarCanvas.getContext('2d');
    if (!this.ctx) {
      log.error('Failed to get 2D context');
      return;
    }

    this.container.appendChild(this.radarCanvas);
    document.body.appendChild(this.container);
  }

  /**
   * 更新雷达
   * @param playerPos 玩家位置
   * @param enemies 敌人信息列表（包含生成状态）
   * @param balloons 气球信息列表
   * @param playerRotation 玩家朝向
   */
  public update(
    playerPos: Vector3,
    enemies: EnemyRadarInfo[],
    balloons: BalloonRadarInfo[],
    playerRotation: Quaternion
  ): void {
    if (!this.ctx) {
      return;
    }

    // 清空画布
    this.ctx.clearRect(0, 0, this.size, this.size);

    // 绘制雷达背景
    this.drawBackground();

    // 绘制玩家位置（中心点）
    this.drawPlayer();

    // 绘制敌人位置
    this.drawEnemies(playerPos, enemies, playerRotation);

    // 绘制气球位置
    this.drawBalloons(playerPos, balloons, playerRotation);
  }

  /**
   * 绘制雷达背景
   */
  private drawBackground(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;

    // 绘制雷达网格
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.2)';
    ctx.lineWidth = 1;

    // 同心圆
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (this.size / 2 - 10) * (i / 3), 0, Math.PI * 2);
      ctx.stroke();
    }

    // 十字线
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, this.size);
    ctx.moveTo(0, centerY);
    ctx.lineTo(this.size, centerY);
    ctx.stroke();

    // 前向标记（↑）
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = 'rgba(0, 255, 100, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('↑', centerX, 15);
  }

  /**
   * 绘制玩家位置
   */
  private drawPlayer(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;

    // 玩家点（绿色）
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.fill();

    // 外圈效果
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * 绘制敌人
   */
  private drawEnemies(
    playerPos: Vector3,
    enemies: EnemyRadarInfo[],
    playerRotation: Quaternion
  ): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const scale = this.size / this.range; // 缩放因子

    // 获取玩家的朝向角度（偏航角 Yaw）
    const playerDirection = new Vector3(0, 0, -1);
    playerDirection.applyQuaternion(playerRotation);
    const playerAngle = Math.atan2(playerDirection.x, playerDirection.z);

    for (const enemy of enemies) {
      // 计算平面坐标相对位置（只使用 x 和 z）
      const relativeX = enemy.position.x - playerPos.x;
      const relativeZ = enemy.position.z - playerPos.z;

      // 根据玩家朝向旋转相对位置（使玩家朝向为正北/向上）
      const rotatedX = relativeX * Math.cos(-playerAngle) - relativeZ * Math.sin(-playerAngle);
      const rotatedZ = relativeX * Math.sin(-playerAngle) + relativeZ * Math.cos(-playerAngle);

      // 转换到雷达坐标系（向上为正，即 Y 轴负方向）
      const dx = rotatedX * scale;
      const dy = -rotatedZ * scale; // 修正：Z轴正方向对应屏幕Y负方向（向上），需要取反

      // 绘制敌人点
      if (enemy.isSpawning) {
        // 生成中：黄色点
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
        ctx.fill();

        // 黄色外圈
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // 已生成：红色点
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
        ctx.fill();

        // 红色外圈
        ctx.beginPath();
        ctx.arc(centerX + dx, centerY + dy, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  /**
   * 绘制气球
   */
  private drawBalloons(
    playerPos: Vector3,
    balloons: BalloonRadarInfo[],
    playerRotation: Quaternion
  ): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const scale = this.size / this.range; // 缩放因子

    // 获取玩家的朝向角度（偏航角 Yaw）
    const playerDirection = new Vector3(0, 0, -1);
    playerDirection.applyQuaternion(playerRotation);
    const playerAngle = Math.atan2(playerDirection.x, playerDirection.z);

    for (const balloon of balloons) {
      // 计算平面坐标相对位置（只使用 x 和 z）
      const relativeX = balloon.position.x - playerPos.x;
      const relativeZ = balloon.position.z - playerPos.z;

      // 根据玩家朝向旋转相对位置（使玩家朝向为正北/向上）
      const rotatedX = relativeX * Math.cos(-playerAngle) - relativeZ * Math.sin(-playerAngle);
      const rotatedZ = relativeX * Math.sin(-playerAngle) + relativeZ * Math.cos(-playerAngle);

      // 转换到雷达坐标系（向上为正，即 Y 轴负方向）
      const dx = rotatedX * scale;
      const dy = -rotatedZ * scale; // 修正：Z轴正方向对应屏幕Y负方向（向上），需要取反

      // 绘制气球点（青色/亮蓝色）
      ctx.beginPath();
      ctx.arc(centerX + dx, centerY + dy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
      ctx.fill();

      // 青色外圈
      ctx.beginPath();
      ctx.arc(centerX + dx, centerY + dy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /**
   * 清除
   */
  public dispose(): void {
    this.container.remove();
  }
}
