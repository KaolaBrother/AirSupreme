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
  private targetPosition: THREE.Vector3 | null;  // 玩家位置（不是Object3D）

  // 状态机
  private currentState: EnemyAIState = EnemyAIState.CHASE;  // 默认状态
  private stateTimer: number = 0;          // 当前状态持续时间
  private fixedDirection: THREE.Vector3;      // 固定方向
  private circleAngle: number = 0;            // 盘旋角度

  // 攻击参数
  private attackCooldown: number = 0;

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

    // 初始化固定方向（随机）
    this.fixedDirection = this.randomDirection();

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
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 安全检查：确保位置有效
    const pos = this.mesh.position;
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
      console.error('Enemy position is NaN or Infinity, resetting to origin', {
        position: { x: pos.x, y: pos.y, z: pos.z }
      });
      this.mesh.position.set(0, 0, 0);
      return;
    }

    // 更新目标引用
    this.targetPosition = playerPosition;

    // 更新状态计时器
    this.stateTimer -= deltaTime;
    if (this.stateTimer <= 0) {
      this.selectNewState();
      this.stateTimer = this.randomStateDuration();
    }

    // 根据当前状态执行行为
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

    // 移动敌机
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // 更新朝向（使用四元数直接指向速度方向）
    if (this.velocity.length() > 0) {
      const targetPos = this.mesh.position.clone().add(this.velocity);
      const dummy = new THREE.Object3D();
      dummy.position.copy(this.mesh.position);
      dummy.lookAt(targetPos);
      this.mesh.quaternion.slerp(dummy.quaternion, 0.3);
    }

    // 添加尾迹点（引擎位置在local坐标系 (0, 0, 2)）
    const engineLocalPos = new THREE.Vector3(0, 0, 2);
    const engineWorldPos = engineLocalPos.applyMatrix4(this.mesh.matrixWorld);
    this.trail.addPoint(engineWorldPos);

    // 更新攻击冷却
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    // 更新尾迹
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

    // 追逐状态可以射击（只有当机头朝向玩家时）
    if (this.attackCooldown <= 0 && this.targetPosition) {
      // 检查机头是否朝向玩家（圆锥区域检测）
      const toPlayer = new THREE.Vector3().subVectors(this.targetPosition, this.mesh.position).normalize();
      const forward = this.velocity.clone().normalize();
      const dot = toPlayer.dot(forward); // 点积：1.0 = 正对准，0.0 = 垂直

      // 机头朝向圆锥区域：30度角内（cos(30°) ≈ 0.866）
      const fireAngle = Math.cos(30 * Math.PI / 180);

      if (dot > fireAngle) {
        // 机头朝向玩家，可以射击
        this.fire(this.targetPosition);
        this.attackCooldown = this.config.attackCooldown;
      }
    }
  }

  /**
   * 固定方向飞行状态更新
   */
  private updateFixedDirection(_deltaTime: number): void {
    // 固定方向：只需保持当前方向，不进行转向
    // 速度已经朝向固定方向，不需要改变
  }

  /**
   * 盘旋状态更新
   */
  private updateCircle(deltaTime: number): void {
    if (!this.targetPosition) return;

    // 更新盘旋角度
    const angularSpeed = this.config.speed / this.config.circleRadius;
    this.circleAngle += angularSpeed * deltaTime;

    // 计算盘旋目标位置（围绕玩家）
    const playerPos = this.targetPosition;
    const targetX = playerPos.x + Math.cos(this.circleAngle) * this.config.circleRadius;
    const targetZ = playerPos.z + Math.sin(this.circleAngle) * this.config.circleRadius;
    const targetY = playerPos.y + this.config.circleHeight;

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

    // 盘旋时偶尔射击（仅重型轰炸机可以，因为它们有侧向火力）
    if (this.attackCooldown <= 0 && this.config.type === 'HEAVY') {
      this.fire(this.targetPosition);
      this.attackCooldown = this.config.attackCooldown * 1.5; // 重型机盘旋时射击频率更低
    }
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
      // 重新随机固定方向
      this.fixedDirection = this.randomDirection();
      // 更新速度朝向固定方向
      this.velocity.copy(this.fixedDirection).multiplyScalar(this.config.speed);
      return;
    }

    this.currentState = EnemyAIState.CIRCLE;
    // 重置盘旋角度
    this.circleAngle = 0;
  }

  /**
   * 生成随机方向（水平面上）
   */
  private randomDirection(): THREE.Vector3 {
    // 在水平面上随机方向（忽略Y轴）
    const angle = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(
      Math.cos(angle),
      0,
      Math.sin(angle)
    ).normalize();

    return dir;
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
