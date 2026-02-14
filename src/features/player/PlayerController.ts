import * as THREE from 'three';
import type { InputState } from '@/core/Input/InputHandler';
import { GAME_CONSTANTS } from '@/config';

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

  // 发动机火焰效果（使用Sprite）
  private flameSprite: THREE.Sprite;
  private readonly normalFlameSize: number = 3.0;  // 正常火焰大小
  private readonly boostFlameSize: number = 5.0;    // 加速火焰大小
  private currentFlameSize: number = 3.0;
  private readonly normalFlameColor = new THREE.Color(0xff8844);  // 正常火焰颜色（橙黄）
  private readonly boostFlameColor = new THREE.Color(0xffaa00);    // 加速火焰颜色（金黄）
  private readonly flameColor = new THREE.Color();

  constructor(aircraft: THREE.Group, _scene: THREE.Scene) {
    this.aircraft = aircraft;
    this.currentSpeed = GAME_CONSTANTS.PLAYER.BASE_SPEED;
    this.forward = new THREE.Vector3();

    // 创建火焰Sprite效果
    const flameTexture = this.createFlameTexture();
    const flameMaterial = new THREE.SpriteMaterial({
      map: flameTexture,
      color: 0xff8844,              // 橙黄色
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,  // 加性混合实现发光效果
      depthWrite: false,                // 不写入深度缓冲
    });

    this.flameSprite = new THREE.Sprite(flameMaterial);

    // 设置初始大小
    this.flameSprite.scale.set(this.normalFlameSize, this.normalFlameSize, 1);

    // 放置在引擎位置（飞机尾部后方）
    this.flameSprite.position.set(0, -0.2, 2.8);

    // 添加到飞机对象
    this.aircraft.add(this.flameSprite);
  }

  /**
   * 创建火焰纹理（径向渐变）
   */
  private createFlameTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get 2D context for flame texture');
    }

    // 创建径向渐变（中心亮白，边缘透明）
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2;

    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);

    // 中心白色（高亮）
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    // 内圈橙黄色
    gradient.addColorStop(0.15, 'rgba(255, 200, 100, 0.9)');
    // 中圈橙色
    gradient.addColorStop(0.4, 'rgba(255, 120, 0, 0.6)');
    // 外圈深橙色
    gradient.addColorStop(0.7, 'rgba(200, 50, 0, 0.3)');
    // 边缘透明
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
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

    // 根据油门状态调整火焰效果
    const targetSize = input.throttle ? this.boostFlameSize : this.normalFlameSize;
    const targetColor = input.throttle ? this.boostFlameColor : this.normalFlameColor;

    // 平滑过渡大小（lerp）
    this.currentFlameSize += (targetSize - this.currentFlameSize) * 8 * deltaTime;

    // 更新火焰颜色（lerp）
    this.flameColor.lerp(targetColor, 5 * deltaTime);

    // 应用大小和颜色
    this.flameSprite.scale.set(this.currentFlameSize, this.currentFlameSize, 1);

    if (this.flameSprite.material instanceof THREE.SpriteMaterial) {
      this.flameSprite.material.color.copy(this.flameColor);
    }
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
    // 移除火焰Sprite
    if (this.flameSprite) {
      this.aircraft.remove(this.flameSprite);
      if (this.flameSprite.material instanceof THREE.Material) {
        this.flameSprite.material.dispose();
      }
    }
  }
}
