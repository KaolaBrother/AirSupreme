import * as THREE from 'three';
import { EnemyFSM, AIState } from './EnemyFSM';
import { EnemyConfig, EnemyType } from './EnemyTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';

/**
 * 敌人 AI - 升级版
 */
export class EnemyAI {
  private mesh: THREE.Group;
  private fsm: EnemyFSM;
  private health: HealthSystem;
  private config: EnemyConfig;

  // 移动参数
  private patrolAngle: number;
  private circleAngle: number = 0;

  // 飞机朝向（用于平滑转向）
  private targetYaw: number = 0;
  private targetPitch: number = 0;

  // 攻击参数
  private attackCooldown: number = 0;

  // 尾迹系统
  private trail: ParticleTrailRenderer;

  // 回调
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3) => void;

  constructor(mesh: THREE.Group, config: EnemyConfig, scene: THREE.Scene) {
    this.mesh = mesh;
    this.config = config;
    this.fsm = new EnemyFSM(config);
    this.health = new HealthSystem(config.health);
    this.patrolAngle = Math.random() * Math.PI * 2;

    // 创建尾迹效果（根据敌机类型选择颜色）
    const trailColor = this.getTrailColor(config.type);
    this.trail = new ParticleTrailRenderer(scene, mesh, trailColor);

    // 设置死亡回调
    this.health.onDeath = () => {
      this.onDestroy?.(this.mesh.position.clone());
    };
  }

  /**
   * 获取尾迹颜色（根据敌机类型）
   */
  private getTrailColor(type: EnemyType): number {
    switch (type) {
      case EnemyType.SCOUT:
        return 0x6b7b8e; // 蓝色
      case EnemyType.FIGHTER:
        return 0xd773020; // 橙色
      case EnemyType.HEAVY:
        return 0x8b8787; // 暗灰色
      case EnemyType.SNIPER:
        return 0x9b30ff; // 紫金色
      case EnemyType.ACE:
        return 0xff0000; // 红色
      default:
        return 0xff6600; // 橙红色（默认）
    }
  }

  /**
   * 应用移动：旋转飞机并向前飞
   */
  private applyMovement(
    deltaTime: number,
    speed: number,
    targetYaw?: number,
    targetPitch?: number,
    lookAtTarget?: THREE.Vector3
  ): void {
    // 如果有指定目标点，计算朝向该点的yaw/pitch
    if (lookAtTarget !== undefined) {
      const direction = new THREE.Vector3().subVectors(lookAtTarget, this.mesh.position);
      direction.normalize();

      // 计算目标yaw（绕Y轴）
      this.targetYaw = Math.atan2(direction.x, direction.z);

      // 计算目标pitch（绕X轴，限制在合理范围内）
      const distance = direction.length();
      this.targetPitch = Math.asin(direction.y / distance);
      this.targetPitch = Math.max(-0.4, Math.min(0.4, this.targetPitch)); // 限制pitch
    }

    // 平滑转向目标yaw
    if (targetYaw !== undefined) {
      this.targetYaw = targetYaw;
    }

    // 平滑转向目标pitch
    if (targetPitch !== undefined) {
      this.targetPitch = targetPitch;
    }

    // 获取当前欧拉角
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion);

    // 平滑更新yaw
    let yawDiff = this.targetYaw - euler.y;
    // 标准化角度差到 -PI 到 PI 范围
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    const newYaw = euler.y + yawDiff * 0.1; // 0.1 = 平滑系数

    // 平滑更新pitch（限制范围）
    let pitchDiff = this.targetPitch - euler.x;
    const newPitch = euler.x + Math.max(-0.3, Math.min(0.3, pitchDiff)) * 0.1;

    // 计算roll：根据yaw变化自动倾斜（模拟真实飞机转向）
    // 左转时向左倾斜（负roll），右转时向右倾斜（正roll）
    let targetRollValue = 0;
    if (Math.abs(yawDiff) > 0.01) {
      // yaw改变越大，倾斜越明显
      targetRollValue = Math.max(-0.4, Math.min(0.4, yawDiff * 0.8));
    }

    // 平滑更新roll
    let rollDiff = targetRollValue - euler.z;
    const newRoll = euler.z + rollDiff * 0.15;

    // 应用新的旋转
    this.mesh.rotation.set(newPitch, newYaw, newRoll);

    // 向前移动（沿着飞机当前的朝向）
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);

    this.mesh.position.addScaledVector(forward, speed * deltaTime);

    // 添加尾迹点（从飞机尾部/引擎位置发出）
    const engineOffset = new THREE.Vector3(0, 0, 2);
    engineOffset.applyQuaternion(this.mesh.quaternion);
    this.trail.addPoint(this.mesh.position.clone(), engineOffset);
  }

  /**
   * 更新敌人
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 安全检查：确保位置有效（兼容性更好的方式）
    const pos = this.mesh.position;
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
      console.error('Enemy position is NaN or Infinity, resetting to origin', {
        position: { x: pos.x, y: pos.y, z: pos.z }
      });
      this.mesh.position.set(0, 0, 0);
      return; // 跳过本帧更新
    }

    const distance = this.mesh.position.distanceTo(playerPosition);

    // 更新状态机
    this.fsm.update(
      deltaTime,
      distance,
      this.health.getCurrentHealth(),
      this.health.getMaxHealth()
    );

    // 根据状态执行行为
    switch (this.fsm.getState()) {
      case AIState.PATROL:
        this.updatePatrol(deltaTime);
        break;
      case AIState.PURSUIT:
        this.updateApproach(deltaTime, playerPosition);
        break;
      case AIState.ATTACK:
        this.updateAttack(deltaTime, playerPosition);
        break;
      case AIState.EVADE:
        this.updateEvade(deltaTime, playerPosition);
        break;
      case AIState.CIRCLE:
        this.updateCircle(deltaTime, playerPosition);
        break;
      case AIState.DIVE:
        this.updateDive(deltaTime, playerPosition);
        break;
      case AIState.RETREAT:
        this.updateRetreat(deltaTime, playerPosition);
        break;
    }

    // 更新攻击冷却
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    // 更新尾迹
    this.trail.update(deltaTime);
  }

  /**
   * 巡逻行为：蛇形飞行，低风险
   */
  private updatePatrol(deltaTime: number): void {
    // 每个敌人有不同的巡逻速度
    const patrolSpeed = 0.3 + (this.mesh.id % 5) * 0.1;
    this.patrolAngle += deltaTime * patrolSpeed;

    // 蛇形摆动幅度（更平滑）
    const yawWander = Math.sin(this.patrolAngle) * 0.25; // 左右偏航
    const pitchWander = Math.sin(this.patrolAngle * 2) * 0.1; // 轻微上下

    // 设置目标角度（累积到targetYaw/pitch，而不是直接设置）
    this.targetYaw += yawWander * deltaTime * 30;
    this.targetPitch += pitchWander * deltaTime * 30;

    // 限制 pitch 角度（避免倒着飞）
    this.targetPitch = Math.max(-0.25, Math.min(0.25, this.targetPitch));

    // 巡逻速度较慢
    const patrolSpeedValue = this.config.speed * 0.4;

    // 应用移动（不传targetRoll，避免翻滚）
    this.applyMovement(deltaTime, patrolSpeedValue, this.targetYaw, this.targetPitch);
  }

  /**
   * 接近行为：从远处接近玩家
   */
  private updateApproach(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 计算到玩家的方向
    const speed = this.config.speed * 0.7;

    // 朝向玩家飞行（但不攻击）
    this.applyMovement(deltaTime, speed, undefined, undefined, playerPosition);
  }

  /**
   * 攻击行为：保持攻击距离并射击
   */
  private updateAttack(deltaTime: number, playerPosition: THREE.Vector3): void {
    const distance = this.mesh.position.distanceTo(playerPosition);
    const idealDistance = 80;

    // 决定飞行方向（始终使用正速度）
    let targetPos: THREE.Vector3 | undefined;
    let speed = this.config.speed * 0.6;

    if (distance > idealDistance * 1.2) {
      // 距离太远：朝向玩家接近
      targetPos = playerPosition;
      speed = this.config.speed * 0.7;
    } else if (distance < idealDistance * 0.7) {
      // 距离太近：转向侧面飞，自然拉大距离（不后退）
      const awayDir = new THREE.Vector3().subVectors(this.mesh.position, playerPosition).normalize();
      // 侧向90度
      const sideOffset = (this.mesh.id % 2 === 0) ? 1 : -1;
      const sideDir = new THREE.Vector3(-awayDir.z * sideOffset, 0, awayDir.x * sideOffset).normalize();
      targetPos = playerPosition.clone().add(sideDir.multiplyScalar(idealDistance));
      speed = this.config.speed * 0.7;
    } else {
      // 距离合适：继续朝向玩家（保持攻击态势）
      targetPos = playerPosition;
    }

    // 射击
    if (this.attackCooldown <= 0) {
      this.fire(playerPosition);
      this.attackCooldown = this.config.attackCooldown;
    }

    // 向前飞（不传targetRoll，避免翻滚）
    this.applyMovement(deltaTime, speed, undefined, undefined, targetPos);
  }

  /**
   * 躲避行为：快速机动，难以预测
   */
  private updateEvade(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 远离玩家
    const awayDirection = new THREE.Vector3().subVectors(this.mesh.position, playerPosition).normalize();

    // 添加随机偏移（难以预测）
    const randomOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.8
    );

    // 计算目标方向
    const targetDirection = awayDirection.add(randomOffset).normalize();

    // 计算目标yaw/pitch
    this.targetYaw = Math.atan2(targetDirection.x, targetDirection.z);
    this.targetPitch = Math.asin(targetDirection.y);
    this.targetPitch = Math.max(-0.3, Math.min(0.3, this.targetPitch));

    // 移动速度（快速）
    const speed = this.config.speed * 0.85;

    // 不传targetRoll，避免主动翻滚
    this.applyMovement(deltaTime, speed, this.targetYaw, this.targetPitch);
  }

  /**
   * 环绕行为：高级战术，绕着玩家飞
   */
  private updateCircle(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.circleAngle += deltaTime * 1.2;

    // 计算环绕位置（水平圆周）
    const offset = new THREE.Vector3(
      Math.cos(this.circleAngle) * 70,
      0,
      Math.sin(this.circleAngle) * 70
    );

    const targetPos = playerPosition.clone().add(offset);

    // 移动速度（略慢于攻击速度）
    const speed = this.config.speed * 0.65;

    // 射击（频率略低）
    if (this.attackCooldown <= 0) {
      this.fire(playerPosition);
      this.attackCooldown = this.config.attackCooldown * 1.3;
    }

    // 不传targetRoll，避免翻滚
    this.applyMovement(deltaTime, speed, undefined, undefined, targetPos);
  }

  /**
   * 俯冲行为：快速俯冲攻击
   */
  private updateDive(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 快速接近玩家，轻微俯冲
    const speed = this.config.speed * 1.1;

    // 俯冲时射击（频率略高）
    if (this.attackCooldown <= 0) {
      this.fire(playerPosition);
      this.attackCooldown = this.config.attackCooldown * 0.8;
    }

    // 俯冲pitch = -0.25
    this.applyMovement(deltaTime, speed, undefined, -0.25, playerPosition);
  }

  /**
   * 撤退行为：战术撤退，爬升远离
   */
  private updateRetreat(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 远离玩家并爬升
    const speed = this.config.speed * 0.8;

    // 不传targetRoll，pitch = 0.15 向上爬升
    this.applyMovement(deltaTime, speed, undefined, 0.15, playerPosition);
  }

  /**
   * 射击
   */
  private fire(playerPosition: THREE.Vector3): void {
    // 计算射击方向
    const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
    direction.normalize();

    // 添加随机扰动（让瞄准不准确）
    // 扰动范围根据敌人的 accuracy 调整（精度越低，扰动越大）
    const perturbationStrength = (1 - this.config.accuracy) * 0.4;
    const anglePerturbation = (Math.random() - 0.5) * perturbationStrength;

    // 使用四元数在Y轴上应用随机旋转
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), anglePerturbation);
    direction.applyQuaternion(quaternion);
    direction.normalize();

    // 触发回调
    this.onFire?.(this.mesh.position.clone(), direction, this.config.damage);
  }

  /**
   * 获取当前血量
   */
  public getHealth(): { current: number; max: number } {
    return {
      current: this.health.getCurrentHealth(),
      max: this.health.getMaxHealth()
    };
  }

  /**
   * 获取血量系统（用于外部显示）
   */
  public getHealthSystem(): HealthSystem {
    return this.health;
  }

  /**
   * 获取配置
   */
  public getConfig(): EnemyConfig {
    return this.config;
  }

  /**
   * 获取网格
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }

  /**
   * 是否存活
   */
  public isAlive(): boolean {
    return this.health.getCurrentHealth() > 0;
  }

  /**
   * 受到伤害
   */
  public takeDamage(damage: number): void {
    this.health.takeDamage(damage);
  }

  /**
   * 获取位置
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * 获取速度（当前前进方向）
   */
  public getVelocity(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    return forward;
  }

  /**
   * 重置敌人（用于生成时初始化位置和状态）
   */
  public reset(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.mesh.visible = false;
    this.health.reset();
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 隐藏 mesh
    this.mesh.visible = false;

    // 移除mesh（如果已添加到场景）
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    // 清理尾迹
    this.trail.dispose();

    // 清理 mesh 的所有子对象
    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }
}
