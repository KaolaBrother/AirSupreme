import * as THREE from 'three';
import { EnemyConfig, EnemyType, EnemyAIState } from './EnemyTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';

/**
 * 新的敌人AI系统 - 基于导弹设计
 *
 * 核心特性：
 * - 类似导弹的运动方式（velocity + turnSpeed）
 * - 三种行为状态：追逐、固定方向飞行、盘旋
 * - 状态概率分布决定敌机攻击性
 * - 状态持续4-8秒后重新随机选择
 */
export class EnemyAI {
  private mesh: THREE.Group;
  private config: EnemyConfig;
  private health: HealthSystem;
  private trail: ParticleTrailRenderer;

  // 基于导弹的运动系统
  public velocity: THREE.Vector3;
  private targetPosition: THREE.Vector3 | null; // 玩家位置（不是Object3D）

  // 状态机
  private currentState: EnemyAIState = EnemyAIState.CHASE; // 默认状态
  private stateTimer: number = 0; // 当前状态持续时间
  private fixedDirectionTarget: THREE.Vector3; // 固定方向飞行状态的虚拟追踪点
  private circleAngle: number = 0; // 盘旋角度

  // 盘旋随机参数（每次进入盘旋状态时重新生成）
  private currentCircleRadius: number = 0; // 当前盘旋半径（配置值 + 随机20-60米）
  private currentCircleHeight: number = 0; // 当前高度差（随机0-50米）

  // 攻击参数
  private attackCooldown: number = 0;

  // 友军列表（用于盘旋状态判断目标）
  private friendlyMeshes: THREE.Object3D[] = [];

  // 回调
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3) => void;

  constructor(mesh: THREE.Group, config: EnemyConfig, scene: THREE.Scene) {
    this.mesh = mesh;
    this.config = config;
    this.health = new HealthSystem(config.health);
    this.targetPosition = null;

    // 初始化速度（向前）
    this.velocity = new THREE.Vector3(0, 0, -config.speed);

    // 初始化固定方向虚拟追踪点（随机）
    this.fixedDirectionTarget = this.generateFixedDirectionTarget();

    // 创建尾迹效果（根据敌机类型选择颜色）
    const trailColor = this.getTrailColor(config.type);
    this.trail = new ParticleTrailRenderer(scene, mesh, trailColor);

    // 选择初始状态
    this.selectNewState();
    this.stateTimer = this.randomStateDuration();

    // 设置死亡回调
    this.health.onDeath = () => {
      this.onDestroy?.(this.mesh.position.clone());
    };
  }

  /**
   * 获取尾迹颜色（统一白色，符合真实）
   */
  private getTrailColor(_type: EnemyType): number {
    return 0xffffff; // 白色（符合真实飞机尾迹）
  }

  /**
   * 更新敌人
   */
  public update(
    deltaTime: number,
    playerPosition: THREE.Vector3 | null,
    friendlyMeshes?: THREE.Object3D[],
    fireTarget: THREE.Vector3 | null = null
  ): void {
    const pos = this.mesh.position;
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
      console.error('Enemy position is NaN or Infinity, resetting to origin', {
        position: { x: pos.x, y: pos.y, z: pos.z },
      });
      this.mesh.position.set(0, 0, 0);
      return;
    }

    this.targetPosition = playerPosition;

    if (friendlyMeshes) {
      this.friendlyMeshes = friendlyMeshes;
    }

    this.stateTimer -= deltaTime;
    if (this.stateTimer <= 0) {
      this.selectNewState();
      this.stateTimer = this.randomStateDuration();
    }

    switch (this.currentState) {
      case EnemyAIState.CHASE:
        this.updateChase(deltaTime);
        break;
      case EnemyAIState.FIXED_DIRECTION:
        this.updateFixedDirection(deltaTime);
        break;
      case EnemyAIState.CIRCLE:
        this.updateCircle(deltaTime);
        break;
    }

    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    if (this.velocity.length() > 0) {
      const targetPos = this.mesh.position.clone().add(this.velocity);
      const dummy = new THREE.Object3D();
      dummy.position.copy(this.mesh.position);
      dummy.lookAt(targetPos);
      this.mesh.quaternion.slerp(dummy.quaternion, 0.3);
    }

    // 从引擎 mesh 获取世界位置（名为 'engineGlow'）
    const engine = this.mesh.getObjectByName('engineGlow');
    const engineWorldPos = new THREE.Vector3();
    if (engine) {
      engine.getWorldPosition(engineWorldPos);
    } else {
      engineWorldPos.copy(this.mesh.position);
    }
    this.trail.addPoint(engineWorldPos);

    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    if (this.attackCooldown <= 0 && fireTarget) {
      const toTarget = new THREE.Vector3().subVectors(fireTarget, this.mesh.position).normalize();
      const forward = this.velocity.clone().normalize();
      const dot = toTarget.dot(forward);

      const fireAngle = Math.cos((this.config.fireSpreadAngle * Math.PI) / 180);

      if (dot > fireAngle) {
        this.fire(fireTarget);
        this.attackCooldown = this.config.attackCooldown;
      }
    }

    this.trail.update(deltaTime);
  }

  /**
   * 追逐状态更新
   */
  private updateChase(deltaTime: number): void {
    if (!this.targetPosition) return;

    // 计算到目标的方向
    const targetDirection = new THREE.Vector3()
      .subVectors(this.targetPosition, this.mesh.position)
      .normalize();

    // 获取当前速度方向
    const currentDirection = this.velocity.clone().normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    // 计算需要旋转的角度（选择最短路径）
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed,
      Math.cos(newRotation) * this.config.speed
    );
  }

  /**
   * 固定方向飞行状态更新
   * 敌机平滑转向固定方向（虚拟追踪点）
   */
  private updateFixedDirection(deltaTime: number): void {
    // 计算到虚拟追踪点的方向
    const targetDirection = new THREE.Vector3()
      .subVectors(this.fixedDirectionTarget, this.mesh.position)
      .normalize();

    // 获取当前速度方向
    const currentDirection = this.velocity.clone().normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    // 计算需要旋转的角度（选择最短路径）
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed,
      Math.cos(newRotation) * this.config.speed
    );
  }

  /**
   * 盘旋状态更新
   */
  private updateCircle(deltaTime: number): void {
    if (!this.targetPosition) return;

    // 判断盘旋目标：玩家或友军中更近的
    let circleTarget = this.targetPosition; // 默认玩家
    let minDistance = this.mesh.position.distanceTo(this.targetPosition);

    // 遍历所有友军，找到最近的
    for (const friendlyMesh of this.friendlyMeshes) {
      const distToFriendly = this.mesh.position.distanceTo(friendlyMesh.position);

      if (distToFriendly < minDistance) {
        minDistance = distToFriendly;
        circleTarget = friendlyMesh.position;
      }
    }

    // 更新盘旋角度（使用随机半径）
    const angularSpeed = this.config.speed / this.currentCircleRadius;
    this.circleAngle += angularSpeed * deltaTime;

    // 计算盘旋目标位置（围绕最近的目标，使用随机半径和高度）
    const targetX = circleTarget.x + Math.cos(this.circleAngle) * this.currentCircleRadius;
    const targetZ = circleTarget.z + Math.sin(this.circleAngle) * this.currentCircleRadius;
    const targetY = circleTarget.y + this.currentCircleHeight;

    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

    // 计算到目标位置的方向
    const targetDirection = new THREE.Vector3()
      .subVectors(targetPos, this.mesh.position)
      .normalize();

    // 获取当前速度方向
    const currentDirection = this.velocity.clone().normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    // 计算需要旋转的角度
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // 限制转向速度
    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    // 应用新的旋转
    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed,
      Math.cos(newRotation) * this.config.speed
    );
  }

  /**
   * 选择新状态（基于概率分布）
   */
  private selectNewState(): void {
    const rand = Math.random();
    const probs = this.config.stateProbabilities;

    let cumulative = 0;
    cumulative += probs[EnemyAIState.CHASE];
    if (rand < cumulative) {
      this.currentState = EnemyAIState.CHASE;
      return;
    }

    cumulative += probs[EnemyAIState.FIXED_DIRECTION];
    if (rand < cumulative) {
      this.currentState = EnemyAIState.FIXED_DIRECTION;
      // 重新生成虚拟追踪点
      this.fixedDirectionTarget = this.generateFixedDirectionTarget();
      // 不直接修改velocity，让updateFixedDirection()平滑转向
      return;
    }

    this.currentState = EnemyAIState.CIRCLE;
    // 重置盘旋角度
    this.circleAngle = 0;

    // 生成随机盘旋参数
    // 半径：配置值 + 随机20-60米
    this.currentCircleRadius = this.config.circleRadius + 20 + Math.random() * 40;
    // 高度差：随机0-50米
    this.currentCircleHeight = Math.random() * 50;
  }

  /**
   * 生成固定方向飞行状态的虚拟追踪点
   * 在战场范围内（距离玩家100-300米）随机生成
   */
  private generateFixedDirectionTarget(): THREE.Vector3 {
    // 战场边界
    const BATTLEFIELD_MIN = -750;
    const BATTLEFIELD_MAX = 750;
    const BATTLEFIELD_SIZE = 1500;

    // 需要玩家位置来生成追踪点
    if (!this.targetPosition) {
      // 如果没有玩家位置，返回默认位置（敌机前方100米）
      return this.mesh.position.clone().add(new THREE.Vector3(0, 0, -100));
    }

    // 尝试次数（避免无限循环）
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 随机距离：100-300米（距离玩家）
      const distance = 100 + Math.random() * 200;

      // 随机方向（水平面上）
      const angle = Math.random() * Math.PI * 2;

      // 计算追踪点位置（以玩家位置为中心）
      const target = new THREE.Vector3(
        this.targetPosition.x + Math.cos(angle) * distance,
        this.targetPosition.y,
        this.targetPosition.z + Math.sin(angle) * distance
      );

      // 检查是否在战场边界内
      if (
        target.x >= BATTLEFIELD_MIN &&
        target.x <= BATTLEFIELD_MAX &&
        target.z >= BATTLEFIELD_MIN &&
        target.z <= BATTLEFIELD_MAX
      ) {
        return target;
      }

      // 如果超出边界，尝试在战场内随机生成
      if (attempt === maxAttempts - 1) {
        // 最后一次尝试：直接在战场内随机位置
        return new THREE.Vector3(
          BATTLEFIELD_MIN + Math.random() * BATTLEFIELD_SIZE,
          this.targetPosition.y,
          BATTLEFIELD_MIN + Math.random() * BATTLEFIELD_SIZE
        );
      }
    }

    // 默认返回：玩家位置前方100米
    return this.targetPosition.clone().add(new THREE.Vector3(0, 0, -100));
  }

  /**
   * 生成随机状态持续时间
   */
  private randomStateDuration(): number {
    const [min, max] = this.config.stateDurationRange;
    return min + Math.random() * (max - min);
  }

  /**
   * 射击
   */
  private fire(targetPosition: THREE.Vector3): void {
    // 计算射击方向
    const direction = new THREE.Vector3().subVectors(targetPosition, this.mesh.position);
    direction.normalize();

    // 添加随机扰动（让瞄准不准确）
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
      max: this.health.getMaxHealth(),
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
    return this.velocity.clone();
  }

  /**
   * 重置敌人（用于生成时初始化位置和状态）
   */
  public reset(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.mesh.visible = false;
    this.health.reset();

    // 重置速度（向前）
    this.velocity = new THREE.Vector3(0, 0, -this.config.speed);

    // 重置状态
    this.selectNewState();
    this.stateTimer = this.randomStateDuration();
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
