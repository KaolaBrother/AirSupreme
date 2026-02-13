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

  // 智能AI参数
  private lastVelocity: THREE.Vector3 = new THREE.Vector3(); // 记录上一帧速度用于平滑

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

    // 初始化智能AI参数
    this.lastVelocity = new THREE.Vector3();

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

    // 更新尾迹
    this.trail.update(deltaTime);
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
    const direction = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
    direction.normalize();

    const speed = this.config.speed * 0.5; // 巡逻时速度减半
    const velocity = direction.multiplyScalar(speed);

    // 混合新旧速度（30% 旧速度，70% 新速度）
    this.lastVelocity.lerp(velocity, 0.7 * deltaTime * 60);
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 朝向移动方向（平滑转向）
    if (this.lastVelocity.length() > 0.1) {
      const lookTarget = this.mesh.position.clone().add(this.lastVelocity);
      this.mesh.lookAt(lookTarget);
    }

    // 添加尾迹点（从飞机尾部/引擎位置发出）
    const engineOffset = new THREE.Vector3(0, 0, 2);
    engineOffset.applyQuaternion(this.mesh.quaternion);
    this.trail.addPoint(this.mesh.position.clone(), engineOffset);
  }

  /**
   * 追逐行为
   */
  private updatePursuit(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 计算到玩家的方向
    const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
    direction.normalize();

    // 追逐速度比巡逻快
    const speed = this.config.speed * 0.8;
    const velocity = direction.multiplyScalar(speed);

    // 平滑更新
    this.lastVelocity.lerp(velocity, 0.5 * deltaTime * 60);
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 朝向玩家
    const lookTarget = this.mesh.position.clone().add(this.lastVelocity);
    this.mesh.lookAt(lookTarget);
  }

  /**
   * 攻击行为
   */
  private updateAttack(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 保持距离并射击
    const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
    const distance = direction.length();

    // 理想攻击距离
    const idealDistance = 80;
    if (distance > idealDistance) {
      // 靠近
      direction.normalize();
      const velocity = direction.multiplyScalar(this.config.speed * 0.6);
      this.lastVelocity.lerp(velocity, 0.3 * deltaTime * 60);
    } else if (distance < idealDistance * 0.6) {
      // 太近了，后退
      direction.normalize().multiplyScalar(-1);
      const velocity = direction.multiplyScalar(this.config.speed * 0.4);
      this.lastVelocity.lerp(velocity, 0.3 * deltaTime * 60);
    } else {
      // 距离理想，减速
      this.lastVelocity.multiplyScalar(0.95);
    }

    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 射击
    if (this.attackCooldown <= 0) {
      this.fire(playerPosition);
      this.attackCooldown = this.config.attackCooldown;
    }

    // 朝向玩家
    const lookTarget = this.mesh.position.clone().add(this.lastVelocity);
    this.mesh.lookAt(lookTarget);
  }

  /**
   * 躲避行为
   */
  private updateEvade(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 计算远离玩家的方向
    const direction = new THREE.Vector3().subVectors(this.mesh.position, playerPosition);
    direction.normalize();

    // 添加随机偏移（难以预测）
    direction.x += (Math.random() - 0.5) * 0.5;
    direction.y += (Math.random() - 0.5) * 0.3;
    direction.z += (Math.random() - 0.5) * 0.5;
    direction.normalize();

    const speed = this.config.speed * 0.9;
    const velocity = direction.multiplyScalar(speed);

    this.lastVelocity.lerp(velocity, 0.6 * deltaTime * 60);
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 朝向移动方向（但稍微看向玩家）
    const lookTarget = this.mesh.position.clone().add(this.lastVelocity);
    this.mesh.lookAt(lookTarget);
  }

  /**
   * 环绕行为
   */
  private updateCircle(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.circleAngle += deltaTime * 1.5;

    // 计算环绕位置
    const offset = new THREE.Vector3(
      Math.cos(this.circleAngle) * 60,
      0,
      Math.sin(this.circleAngle) * 60
    );

    const targetPos = playerPosition.clone().add(offset);

    // 移动到目标位置
    const direction = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
    direction.normalize();

    const speed = this.config.speed * 0.7;
    const velocity = direction.multiplyScalar(speed);

    this.lastVelocity.lerp(velocity, 0.4 * deltaTime * 60);
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 朝向玩家
    this.mesh.lookAt(playerPosition);
  }

  /**
   * 俯冲行为
   */
  private updateDive(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 快速接近玩家
    const direction = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
    direction.y -= 0.3; // 倾向下
    direction.normalize();

    const speed = this.config.speed * 1.2;
    const velocity = direction.multiplyScalar(speed);

    this.lastVelocity.lerp(velocity, 0.5 * deltaTime * 60);
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 俯冲时射击
    if (this.attackCooldown <= 0) {
      this.fire(playerPosition);
      this.attackCooldown = this.config.attackCooldown * 0.7; // 快速射击
    }

    // 朝向玩家
    this.mesh.lookAt(playerPosition);
  }

  /**
   * 撤退行为
   */
  private updateRetreat(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 远离玩家
    const direction = new THREE.Vector3().subVectors(this.mesh.position, playerPosition);
    direction.normalize();

    // 获得高度
    direction.y = Math.max(direction.y, 0.3);

    const speed = this.config.speed * 0.85;
    const velocity = direction.multiplyScalar(speed);

    this.lastVelocity.lerp(velocity, 0.5 * deltaTime * 60);
    this.mesh.position.addScaledVector(this.lastVelocity, deltaTime);

    // 朝向远离方向
    const lookTarget = this.mesh.position.clone().add(this.lastVelocity);
    this.mesh.lookAt(lookTarget);
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
   * 获取速度
   */
  public getVelocity(): THREE.Vector3 {
    return this.lastVelocity;
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
