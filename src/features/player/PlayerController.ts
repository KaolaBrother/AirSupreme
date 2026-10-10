import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Material,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { Group, Scene } from 'three';
import type { InputState } from '@/core/Input/InputHandler';
import { GAME_CONSTANTS } from '@/config';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';

const WORLD_UP = new Vector3(0, 1, 0);

/**
 * 俯仰 / 偏航的模拟量（-1..1）。优先用 InputState 里的模拟量；缺省、非有限或为 0 时退回布尔方向
 * （±1）——脚本飞行员和旧调用方只写布尔方向。
 */
function resolveAxis(axis: number | undefined, positive: boolean, negative: boolean): number {
  if (axis !== undefined && Number.isFinite(axis) && axis !== 0) {
    return Math.max(-1, Math.min(1, axis));
  }
  return (positive ? 1 : 0) - (negative ? 1 : 0);
}

/**
 * 玩家控制器
 * 使用四元数控制飞机旋转（避免万向节锁）
 */
export class PlayerController {
  private aircraft: Group;
  private currentSpeed: number;
  private playerStats: PlayerStats;

  // 缓存向量（避免每帧创建）
  private forward: Vector3;

  // 辅助飞行用的缓存（避免每帧创建）
  private readonly assistLevelRight = new Vector3();
  private readonly assistLevelUp = new Vector3();
  private readonly assistStep = new Quaternion();
  private readonly assistBackup = new Quaternion();

  // 自动回中速度（弧度/秒）
  private readonly autoLevelSpeed: number = 2.0;

  // 发动机火焰效果（使用Sprite）：主尾焰由 AircraftMeshFactory 的加力尾焰负责，
  // 这里只保留一层柔和的喷口辉光（第一人称时随机体外观层一起隐藏）
  private flameSprite: Sprite;
  private readonly normalFlameSize: number = 1.4; // 巡航辉光大小
  private readonly boostFlameSize: number = 2.3; // 加力辉光大小
  private currentFlameSize: number = 1.4;
  private readonly rightVector = new Vector3();
  private readonly normalFlameColor = new Color(0xff8844);  // 正常火焰颜色（橙黄）
  private readonly boostFlameColor = new Color(0xffaa00);    // 加速火焰颜色（金黄）
  private readonly flameColor = new Color();

  constructor(aircraft: Group, _scene: Scene, playerStats: PlayerStats) {
    this.aircraft = aircraft;
    this.playerStats = playerStats;
    this.currentSpeed = playerStats.getMaxSpeed() * 0.5; // 初始速度为最大速度的一半
    this.forward = new Vector3();

    // 创建火焰Sprite效果
    const flameTexture = this.createFlameTexture();
    const flameMaterial = new SpriteMaterial({
      map: flameTexture,
      color: 0xff8844,              // 橙黄色
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,  // 加性混合实现发光效果
      depthWrite: false,                // 不写入深度缓冲
    });

    this.flameSprite = new Sprite(flameMaterial);

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
  private createFlameTexture(): CanvasTexture {
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

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 软边界：超出软边界半径后，回推力随超出量平方增强；
   * 到达战场硬边界时回推力大于飞行速度，玩家无法飞出。
   * 顶界同理柔和下压，避免生硬的位置钳制。
   */
  private applySoftBoundary(deltaTime: number): void {
    const hardRadius = GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT;
    const softRadius = GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS;
    const position = this.aircraft.position;

    const radial = Math.hypot(position.x, position.z);
    if (radial > softRadius) {
      const overshoot = Math.min((radial - softRadius) / (hardRadius - softRadius), 1.6);
      const pushback = overshoot * overshoot * this.currentSpeed * 1.4 * deltaTime;
      const inverseRadial = 1 / Math.max(radial, 1e-3);
      position.x -= position.x * inverseRadial * pushback;
      position.z -= position.z * inverseRadial * pushback;
    }

    const ceiling = GAME_CONSTANTS.WORLD.SOFT_CEILING;
    if (position.y > ceiling) {
      position.y -= (position.y - ceiling) * 3 * deltaTime;
    }
  }

  /**
   * 手动模型（键盘）：绕机体自身三轴转动，完全没有输入时自动改平机翼。
   * 俯仰 / 偏航角速度按模拟量缩放——键盘为 ±1，即原来的满速。
   */
  private applyManualAttitude(
    deltaTime: number,
    input: InputState,
    pitchAxis: number,
    yawAxis: number
  ): void {
    // 检查是否有输入
    const hasInput = input.pitchUp || input.pitchDown || input.yawLeft || input.yawRight ||
                      input.rollLeft || input.rollRight || pitchAxis !== 0 || yawAxis !== 0;

    // 俯仰（Pitch）- 机头上下（W向上，S向下）
    if (pitchAxis !== 0) {
      this.aircraft.rotateX(GAME_CONSTANTS.PLAYER.PITCH_SPEED * pitchAxis * deltaTime);
    }

    // 偏航（Yaw）- 机头左右（正 = 右转）
    if (yawAxis !== 0) {
      this.aircraft.rotateY(-GAME_CONSTANTS.PLAYER.YAW_SPEED * yawAxis * deltaTime);
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
      const rightVector = this.rightVector.set(1, 0, 0);
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
  }

  /**
   * 辅助模型（触控摇杆）：航向、俯仰、坡度三个通道互不耦合，推右永远是相对地平线右转。
   * - 偏航：绕世界竖直轴，角速度 ∝ yawAxis；
   * - 俯仰：绕“水平右轴”（机翼水平时就是机体右轴），角速度 ∝ pitchAxis；机头相对地平线
   *   超过 ASSIST_PITCH_LIMIT 后不再增大，减小 |俯仰| 的输入始终允许（界外的姿态也能改回来）；
   * - 滚转：坡度平滑逼近 -yawAxis × ASSIST_MAX_BANK（压向转弯一侧，摇杆回中时机翼改平）。
   * 全程四元数运算，结尾归一化；结果出现 NaN / Infinity 时恢复到本步之前的姿态。
   */
  private applyAssistedAttitude(deltaTime: number, pitchAxis: number, yawAxis: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    const tuning = GAME_CONSTANTS.PLAYER;
    const quaternion = this.aircraft.quaternion;
    this.assistBackup.copy(quaternion);

    // 偏航：绕世界竖直轴（左乘 = 世界坐标系下的旋转）
    if (yawAxis !== 0) {
      this.assistStep.setFromAxisAngle(WORLD_UP, -tuning.YAW_SPEED * yawAxis * deltaTime);
      quaternion.premultiply(this.assistStep);
    }

    // 水平右轴：垂直于机头方向、躺在水平面内。机头几乎垂直时没有定义，退回机体右轴
    const forward = this.forward.set(0, 0, -1).applyQuaternion(quaternion);
    const levelRight = this.assistLevelRight.crossVectors(forward, WORLD_UP);
    const horizontal = levelRight.length();
    const hasHorizon = horizontal > 1e-4;
    if (hasHorizon) {
      levelRight.divideScalar(horizontal);
    } else {
      levelRight.set(1, 0, 0).applyQuaternion(quaternion);
    }

    // 俯仰：机头仰角（相对地平线）到达上限后只允许往回推
    const elevation = Math.asin(Math.max(-1, Math.min(1, forward.y)));
    const pitchLimit = tuning.ASSIST_PITCH_LIMIT;
    let pitchStep = tuning.PITCH_SPEED * pitchAxis * deltaTime;
    if (pitchStep > 0) {
      pitchStep = Math.min(pitchStep, Math.max(0, pitchLimit - elevation));
    } else if (pitchStep < 0) {
      pitchStep = Math.max(pitchStep, Math.min(0, -pitchLimit - elevation));
    }
    if (pitchStep !== 0) {
      this.assistStep.setFromAxisAngle(levelRight, pitchStep);
      quaternion.premultiply(this.assistStep);
    }

    // 滚转：当前坡度 = 机体右轴相对水平右轴绕机身轴转过的角度（正 = 右翼抬起）
    if (hasHorizon) {
      forward.set(0, 0, -1).applyQuaternion(quaternion);
      const levelUp = this.assistLevelUp.crossVectors(levelRight, forward);
      const right = this.rightVector.set(1, 0, 0).applyQuaternion(quaternion);
      const bank = Math.atan2(right.dot(levelUp), right.dot(levelRight));

      let bankError = -yawAxis * tuning.ASSIST_MAX_BANK - bank;
      if (bankError > Math.PI) {
        bankError -= Math.PI * 2;
      } else if (bankError < -Math.PI) {
        bankError += Math.PI * 2;
      }

      // 指数逼近 + 角速度上限：进弯、改平都平顺，不会一步到位
      const maxStep = tuning.ASSIST_ROLL_MAX_RATE * deltaTime;
      const eased = bankError * (1 - Math.exp(-tuning.ASSIST_ROLL_RESPONSE * deltaTime));
      const rollStep = Math.max(-maxStep, Math.min(maxStep, eased));
      if (rollStep !== 0) {
        this.aircraft.rotateZ(rollStep);
      }
    }

    quaternion.normalize();
    if (
      !Number.isFinite(quaternion.x) ||
      !Number.isFinite(quaternion.y) ||
      !Number.isFinite(quaternion.z) ||
      !Number.isFinite(quaternion.w)
    ) {
      quaternion.copy(this.assistBackup);
    }
  }

  /**
   * 更新飞机状态
   */
  public update(deltaTime: number, input: InputState): void {
    // 俯仰 / 偏航模拟量：键盘为 ±1（与原来的满速一致），触控摇杆为连续值
    const pitchAxis = resolveAxis(input.pitchAxis, input.pitchUp, input.pitchDown);
    const yawAxis = resolveAxis(input.yawAxis, input.yawRight, input.yawLeft);

    // 速度控制
    const maxSpeed = this.playerStats.getMaxSpeed();
    const minSpeed = maxSpeed * 0.5; // 最小速度为最大速度的一半

    if (input.throttle) {
      this.currentSpeed = Math.min(
        maxSpeed,
        this.currentSpeed + 20 * deltaTime
      );
    } else {
      this.currentSpeed = Math.max(
        minSpeed,
        this.currentSpeed - 10 * deltaTime
      );
    }

    // 姿态：触控摇杆走辅助模型，键盘走原有的手动模型
    if (input.flightAssist === true) {
      this.applyAssistedAttitude(deltaTime, pitchAxis, yawAxis);
    } else {
      this.applyManualAttitude(deltaTime, input, pitchAxis, yawAxis);
    }

    // 前进移动
    this.forward.set(0, 0, -1);
    this.forward.applyQuaternion(this.aircraft.quaternion);
    this.aircraft.position.addScaledVector(this.forward, this.currentSpeed * deltaTime);

    // 软边界：靠近战场边缘/顶界时施加渐强回推力，防止飞出战场
    this.applySoftBoundary(deltaTime);

    // 根据油门状态调整火焰效果
    const targetSize = input.throttle ? this.boostFlameSize : this.normalFlameSize;
    const targetColor = input.throttle ? this.boostFlameColor : this.normalFlameColor;

    // 平滑过渡大小（lerp）
    this.currentFlameSize += (targetSize - this.currentFlameSize) * 8 * deltaTime;

    // 更新火焰颜色（lerp）
    this.flameColor.lerp(targetColor, 5 * deltaTime);

    // 应用大小和颜色
    this.flameSprite.scale.set(this.currentFlameSize, this.currentFlameSize, 1);

    if (this.flameSprite.material instanceof SpriteMaterial) {
      this.flameSprite.material.color.copy(this.flameColor);
    }
  }

  /**
   * 获取飞机位置
   */
  public getPosition(): Vector3 {
    return this.aircraft.position.clone();
  }

  /**
   * 获取飞机四元数
   */
  public getQuaternion(): Quaternion {
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
  public getAircraft(): Group {
    return this.aircraft;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除火焰Sprite
    if (this.flameSprite) {
      this.aircraft.remove(this.flameSprite);
      if (this.flameSprite.material instanceof Material) {
        this.flameSprite.material.dispose();
      }
    }
  }
}
