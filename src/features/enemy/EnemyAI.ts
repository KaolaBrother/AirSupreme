import * as THREE from 'three';
import { EnemyFSM, AIState } from './EnemyFSM';
import { EnemyConfig, EnemyType } from './EnemyTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';

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

  // 智能AI参数
  private targetPosition: THREE.Vector3 | null = null; // 预测目标位置
  private lastVelocity: THREE.Vector3 = new THREE.Vector3(); // 记录上一帧速度用于平滑
  private flightTimer: number = 0; // 飞行计时器
  private turnTimer: number = 0; // 转弯计时器

  // 随机游荡偏移
  private wanderOffset: THREE.Vector3 = new THREE.Vector3();
  private wanderTimer: number = 0;
  private wanderChangeInterval: number = 2; // 每2秒改变一次游荡方向

  // 攻击参数
  private attackCooldown: number = 0;

  // 回调
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3) => void;

  constructor(mesh: THREE.Group, config: EnemyConfig) {
    this.mesh = mesh;
    this.config = config;
    this.fsm = new EnemyFSM(config);
    this.health = new HealthSystem(config.health);
    this.patrolAngle = Math.random() * Math.PI * 2;

    // 初始化智能AI参数
    this.targetPosition = null;
    this.lastVelocity = new THREE.Vector3();
    this.flightTimer = 0;
    this.turnTimer = 0;

    // 设置生命值回调
    this.health.onDeath = () => {
      this.onDestroy?.(this.mesh.position.clone());
    };
  }

  /**
   * 更新敌人
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 安全检查：确保位置有效（兼容性更好的方式）
    const pos = this.mesh.position;
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
      console.error('Enemy position is NaN or Infinity, resetting to origin', {
        position: { x: pos.x, y: pos.y, z: pos.z },
        velocity: { x: this.lastVelocity.x, y: this.lastVelocity.y, z: this.lastVelocity.z }
      });
      this.mesh.position.set(0, 0, 0);
      this.lastVelocity.set(0, 0, 0);
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
        this.updatePursuit(deltaTime, playerPosition);
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
  }

  /**
   * 巡逻行为 - 改进版：更聪明、更平滑
   */
  private updatePatrol(deltaTime: number): void {
    // 每个敌人有不同的巡逻速度
    const patrolSpeed = 0.2 + (this.mesh.id % 5) * 0.1;
    this.patrolAngle += deltaTime * patrolSpeed;

    // 计算相对于当前位置的巡逻偏移（重要：使用相对坐标而非绝对坐标）
    const offsetX = Math.cos(this.patrolAngle) * this.config.wanderRadius;
    const offsetZ = Math.sin(this.patrolAngle) * this.config.wanderRadius;

    // 添加垂直游荡 - 允许自然的上下浮动
    const wanderY = Math.sin(this.patrolAngle * 2) * 15; // 上下浮动 ±15

    // 目标位置 = 当前位置 + 巡逻偏移
    const targetPos = new THREE.Vector3(
      this.mesh.position.x + offsetX,
      this.mesh.position.y + wanderY,
      this.mesh.position.z + offsetZ
    );

    // 平滑速度更新（避免突然停止）
    const newDirection = targetPos.clone().sub(this.mesh.position).normalize();
    const smoothFactor = 6.0; // 增加响应速度，避免过度平滑
    // 平滑插值当前速度到目标速度
    const targetVelocity = newDirection.clone().multiplyScalar(this.config.speed);
    this.lastVelocity.lerp(targetVelocity, Math.min(1, smoothFactor * deltaTime));
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 朝向移动方向（平滑转向）
    const lookTarget = new THREE.Vector3(
      this.mesh.position.x + Math.cos(this.patrolAngle + 0.1) * this.config.wanderRadius,
      this.mesh.position.y + wanderY,
      this.mesh.position.z + Math.sin(this.patrolAngle + 0.1) * this.config.wanderRadius
    );
    this.smoothLookAt(lookTarget, deltaTime);
  }

  /**
   * 追击行为 - 改进版：智能预测、更平滑
   */
  private updatePursuit(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 更新游荡偏移
    this.wanderTimer += deltaTime;
    if (this.wanderTimer > this.wanderChangeInterval) {
      this.wanderTimer = 0;
      // 随机生成新的偏移方向
      this.wanderOffset.set(
        (Math.random() - 0.5) * 80, // X方向偏移 ±40
        (Math.random() - 0.5) * 30, // Y方向偏移 ±15
        (Math.random() - 0.5) * 80  // Z方向偏移 ±40
      );
    }

    // 智能预测：根据玩家速度预测未来位置
    this.targetPosition = playerPosition.clone();

    // 添加游荡偏移
    this.targetPosition.add(this.wanderOffset);

    // 计算方向
    const direction = this.targetPosition.clone().sub(this.mesh.position).normalize();

    // 平滑速度更新（让飞行更连贯）
    const smoothFactor = 4.0; // 追击时更灵敏
    // 平滑插值当前速度到目标速度
    const targetVelocity = direction.clone().multiplyScalar(this.config.speed);
    this.lastVelocity.lerp(targetVelocity, Math.min(1, smoothFactor * deltaTime));
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 平滑转向目标
    this.smoothLookAt(this.targetPosition, deltaTime * 0.8);
  }

  /**
   * 攻击行为
   */
  private updateAttack(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 根据敌人类型选择攻击方式
    if (this.config.type === EnemyType.SNIPER) {
      // 狙击手：保持瞄准，但有小幅移动
      this.smoothLookAt(playerPosition, deltaTime * 0.5);
      // 添加小幅随机游荡
      const strafeOffset = Math.sin(this.fsm.getStateTime() * 2) * 10;
      this.mesh.position.x += strafeOffset * deltaTime;
    } else if (this.config.type === EnemyType.ACE) {
      // 王牌：大幅机动同时攻击
      const offset = Math.sin(this.fsm.getStateTime() * 5) * 1.5;
      this.mesh.position.x += offset * deltaTime;
      const verticalMove = Math.cos(this.fsm.getStateTime() * 3) * 0.8;
      this.mesh.position.y += verticalMove * deltaTime;
      this.smoothLookAt(playerPosition, deltaTime);
    } else {
      // 其他：正常攻击，但添加随机游动
      const wanderX = Math.sin(this.fsm.getStateTime() * 1.5 + this.mesh.id) * 8;
      const wanderY = Math.cos(this.fsm.getStateTime() * 2) * 5;
      this.mesh.position.x += wanderX * deltaTime;
      this.mesh.position.y += wanderY * deltaTime;
      this.smoothLookAt(playerPosition, deltaTime);
    }

    // 发射子弹
    if (this.attackCooldown <= 0) {
      const direction = playerPosition.clone().sub(this.mesh.position);

      // 添加精度误差
      const errorAngle = (1 - this.config.accuracy) * Math.PI * 0.2;
      direction.x += (Math.random() - 0.5) * errorAngle;
      direction.y += (Math.random() - 0.5) * errorAngle;
      direction.z += (Math.random() - 0.5) * errorAngle;
      direction.normalize();

      this.onFire?.(this.mesh.position.clone(), direction, this.config.damage);
      this.attackCooldown = this.config.attackCooldown;
    }
  }

  /**
   * 闪避行为
   */
  private updateEvade(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 远离玩家
    const away = this.mesh.position.clone().sub(playerPosition).normalize();

    // 添加随机性
    away.x += (Math.random() - 0.5) * 2;
    away.z += (Math.random() - 0.5) * 2;
    away.normalize();

    this.mesh.position.addScaledVector(away, this.config.speed * 1.5 * deltaTime);
  }

  /**
   * 环绕行为
   */
  private updateCircle(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.circleAngle += deltaTime * 1.5;

    const radius = this.config.attackRange * 0.7;
    const targetX = playerPosition.x + Math.cos(this.circleAngle) * radius;
    const targetZ = playerPosition.z + Math.sin(this.circleAngle) * radius;

    const targetPos = new THREE.Vector3(targetX, this.mesh.position.y, targetZ);
    const direction = targetPos.clone().sub(this.mesh.position).normalize();

    this.mesh.position.addScaledVector(direction, this.config.speed * deltaTime);

    // 狙击手在环绕时也会射击
    if (this.config.type === EnemyType.SNIPER && this.attackCooldown <= 0) {
      const fireDir = playerPosition.clone().sub(this.mesh.position).normalize();
      this.onFire?.(this.mesh.position.clone(), fireDir, this.config.damage);
      this.attackCooldown = this.config.attackCooldown;
    }
  }

  /**
   * 俯冲攻击
   */
  private updateDive(deltaTime: number, playerPosition: THREE.Vector3): void {
    const direction = playerPosition.clone().sub(this.mesh.position).normalize();

    // 快速俯冲
    this.mesh.position.addScaledVector(direction, this.config.speed * 2 * deltaTime);
    this.smoothLookAt(playerPosition, deltaTime * 2);

    // 俯冲时射击
    if (this.attackCooldown <= 0) {
      this.onFire?.(this.mesh.position.clone(), direction, this.config.damage);
      this.attackCooldown = this.config.attackCooldown * 0.5;
    }
  }

  /**
   * 撤退行为
   */
  private updateRetreat(deltaTime: number, playerPosition: THREE.Vector3): void {
    const away = this.mesh.position.clone().sub(playerPosition).normalize();
    this.mesh.position.addScaledVector(away, this.config.speed * 0.8 * deltaTime);
  }

  /**
   * 平滑转向
   */
  private smoothLookAt(target: THREE.Vector3, deltaTime: number): void {
    const direction = target.clone().sub(this.mesh.position);
    if (direction.length() < 0.1) return;

    const targetQuat = new THREE.Quaternion();
    const lookMatrix = new THREE.Matrix4();
    lookMatrix.lookAt(this.mesh.position, target, new THREE.Vector3(0, 1, 0));
    targetQuat.setFromRotationMatrix(lookMatrix);

    this.mesh.quaternion.slerp(targetQuat, Math.min(1, this.config.turnSpeed * deltaTime));
  }

  /**
   * 受到伤害
   */
  public takeDamage(amount: number): void {
    this.health.takeDamage(amount);
  }

  /**
   * 获取位置
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  /**
   * 获取网格对象
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }

  /**
   * 获取配置
   */
  public getConfig(): EnemyConfig {
    return this.config;
  }

  /**
   * 是否存活
   */
  public isAlive(): boolean {
    const alive = !this.health.isEntityDead();

    // 如果死亡，隐藏mesh
    if (!alive && this.mesh.visible) {
      this.mesh.visible = false;
    }

    return alive;
  }

  /**
   * 重置敌人
   */
  public reset(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.health.reset();
    this.attackCooldown = 0;
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.wanderOffset.set(0, 0, 0);
    this.wanderTimer = 0;

    // 重置智能AI参数
    this.targetPosition = null;
    // 初始化速度为当前速度方向，避免从零开始加速
    const initialDir = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize();
    this.lastVelocity = initialDir.multiplyScalar(this.config.speed * 0.5); // 初始速度为正常速度的一半
    this.mesh.visible = true; // 重要：确保敌人可见

    // 确保朝向正确（基于初始速度方向）
    const lookAtPos = position.clone().add(initialDir.multiplyScalar(10));
    this.mesh.lookAt(lookAtPos);
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
}
