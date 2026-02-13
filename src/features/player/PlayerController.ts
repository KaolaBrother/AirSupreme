import * as THREE from 'three';
import type { InputState } from '@/core/Input/InputHandler';
import { GAME_CONSTANTS } from '@/config';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';

/**
 * 玩家控制器
 * 使用四元数控制飞机旋转（避免万向节锁）
 */
export class PlayerController {
  private aircraft: THREE.Group;
  private currentSpeed: number;

  // 缓存向量（避免每帧创建）
  private forward: THREE.Vector3;

  // 自动回中速度（弧度/秒）
  private readonly autoLevelSpeed: number = 2.0;

  // 尾迹系统
  private trail: ParticleTrailRenderer;

  constructor(aircraft: THREE.Group, scene: THREE.Scene) {
    this.aircraft = aircraft;
    this.currentSpeed = GAME_CONSTANTS.PLAYER.BASE_SPEED;
    this.forward = new THREE.Vector3();

    // 创建尾迹效果（青色）
    this.trail = new ParticleTrailRenderer(scene, aircraft, 0x00ffff);
  }

  /**
   * 更新飞机状态
   */
  public update(deltaTime: number, input: InputState): void {
    // 检查是否有输入
    const hasInput = input.pitchUp || input.pitchDown || input.yawLeft || input.yawRight ||
                      input.rollLeft || input.rollRight;

    // 速度控制
    if (input.throttle) {
      this.currentSpeed = Math.min(
        GAME_CONSTANTS.PLAYER.MAX_SPEED,
        this.currentSpeed + 20 * deltaTime
      );
    } else {
      this.currentSpeed = Math.max(
        GAME_CONSTANTS.PLAYER.BASE_SPEED * 0.5,
        this.currentSpeed - 10 * deltaTime
      );
    }

    // 俯仰（Pitch）- 机头上下（W向上，S向下）
    if (input.pitchUp) {
      this.aircraft.rotateX(GAME_CONSTANTS.PLAYER.PITCH_SPEED * deltaTime);
    }
    if (input.pitchDown) {
      this.aircraft.rotateX(-GAME_CONSTANTS.PLAYER.PITCH_SPEED * deltaTime);
    }

    // 偏航（Yaw）- 机头左右
    if (input.yawLeft) {
      this.aircraft.rotateY(GAME_CONSTANTS.PLAYER.YAW_SPEED * deltaTime);
    }
    if (input.yawRight) {
      this.aircraft.rotateY(-GAME_CONSTANTS.PLAYER.YAW_SPEED * deltaTime);
    }

    // 翻滚（Roll）- 机翼倾斜
    if (input.rollLeft) {
      this.aircraft.rotateZ(GAME_CONSTANTS.PLAYER.ROLL_SPEED * deltaTime);
    }
    if (input.rollRight) {
      this.aircraft.rotateZ(-GAME_CONSTANTS.PLAYER.ROLL_SPEED * deltaTime);
    }

    // 自动回中：当无输入时，平滑恢复到水平位置
    // 只修正滚转（Roll），保持机翼水平，不修正俯仰和偏航
    if (!hasInput) {
      // 获取飞机的本地右向量（X轴方向）
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyQuaternion(this.aircraft.quaternion);

      // 右向量的Y分量代表机翼的倾斜程度
      // 如果Y>0，右翼向下倾斜；如果Y<0，左翼向下倾斜
      const tiltAmount = rightVector.y;

      if (Math.abs(tiltAmount) > 0.01) {
        // 计算回正速度（每秒回正多少）
        const recoveryAmount = this.autoLevelSpeed * deltaTime;

        // 限制回正量不超过倾斜量，避免过度修正
        const amountToLevel = Math.sign(tiltAmount) * -Math.min(recoveryAmount, Math.abs(tiltAmount));

        // 应用回正旋转（绕Z轴）
        this.aircraft.rotateZ(amountToLevel);
      }
    }

    // 前进移动
    this.forward.set(0, 0, -1);
    this.forward.applyQuaternion(this.aircraft.quaternion);
    this.aircraft.position.addScaledVector(this.forward, this.currentSpeed * deltaTime);

    // 添加尾迹点（从飞机尾部/引擎位置发出）
    // 引擎在本地坐标系中的位置是 (0, 0, 2)
    const engineOffset = new THREE.Vector3(0, 0, 2);
    engineOffset.applyQuaternion(this.aircraft.quaternion);
    this.trail.addPoint(this.aircraft.position.clone(), engineOffset);
    this.trail.update(deltaTime);
  }

  /**
   * 获取飞机位置
   */
  public getPosition(): THREE.Vector3 {
    return this.aircraft.position.clone();
  }

  /**
   * 获取飞机四元数
   */
  public getQuaternion(): THREE.Quaternion {
    return this.aircraft.quaternion.clone();
  }

  /**
   * 获取当前速度
   */
  public getSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * 获取飞机对象
   */
  public getAircraft(): THREE.Group {
    return this.aircraft;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.trail.dispose();
  }
}
