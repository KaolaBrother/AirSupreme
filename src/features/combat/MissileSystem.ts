import * as THREE from 'three';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { GAME_CONSTANTS } from '@/config';

/**
 * 导弹类
 */
export class Missile {
  public mesh: THREE.Mesh;
  public velocity: THREE.Vector3;
  public target: THREE.Object3D | null;
  public active: boolean = true;
  public lifetime: number = 0;
  public maxLifetime: number = 10; // 10秒后自毁

  private turnSpeed: number = GAME_CONSTANTS.MISSILE.TURN_SPEED; // 转向速度（弧度/秒）
  private speed: number = 80; // 导弹速度
  private trail: THREE.Mesh | null = null;
  private particleSystem: ParticleSystem;
  private startPosition: THREE.Vector3; // 记录发射位置
  private maxFlightDistance: number = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE; // 最大飞行距离
  private enemies: THREE.Object3D[] = []; // 敌人列表，用于重新锁定目标
  private hasRetargeted: boolean = false; // 是否已经重新锁定过（避免频繁切换）

  constructor(scene: THREE.Scene, position: THREE.Vector3, target: THREE.Object3D | null, particleSystem: ParticleSystem, enemies: THREE.Object3D[] = []) {
    this.particleSystem = particleSystem;
    this.target = target;
    this.enemies = enemies;

    // 记录发射位置
    this.startPosition = position.clone();

    // 导弹模型（增大尺寸）
    const geometry = new THREE.ConeGeometry(0.4, 2.5, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = Math.PI / 2; // 指向前方
    this.mesh.castShadow = true;
    this.mesh.position.copy(position);

    // 增强尾焰效果（更大更明显）
    const trailGeometry = new THREE.ConeGeometry(0.25, 2, 16);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 1,
    });
    this.trail = new THREE.Mesh(trailGeometry, trailMaterial);
    this.trail.rotation.x = -Math.PI / 2;
    this.trail.position.z = 1.5;
    this.mesh.add(this.trail);

    scene.add(this.mesh);
    this.velocity = new THREE.Vector3();
    this.active = true;

    // 设置初始速度朝向目标
    if (this.target) {
      const direction = new THREE.Vector3()
        .subVectors(this.target.position, position)
        .normalize();
      this.velocity.copy(direction).multiplyScalar(this.speed);
    } else {
      // 没有目标时，向前发射
      this.velocity.set(0, 0, -this.speed);
    }
  }

  /**
   * 更新导弹
   */
  public update(deltaTime: number): void {
    this.lifetime += deltaTime;

    // 检查飞行距离（超过最大飞行距离则自毁）
    const flightDistance = this.mesh.position.distanceTo(this.startPosition);
    if (flightDistance > this.maxFlightDistance) {
      // 超过最大飞行距离，导弹自毁
      this.active = false;
      return;
    }

    // 超过最大寿命则销毁
    if (this.lifetime > this.maxLifetime) {
      // 导弹即将消失，创建明显的尾气效果
      if (this.target && this.target.parent) {
        // 生成导弹尾气（使用橙红色）
        const trailColor = new THREE.Color(0xff6600);
        this.particleSystem.createTrail(this.mesh.position.clone(), trailColor);
      }

      this.active = false;
      return;
    }

    // 如果目标被摧毁，尝试寻找新目标
    if (!this.target || !this.target.parent) {
      if (!this.hasRetargeted) {
        // 尝试重新锁定目标
        const newTarget = this.findNearestEnemy();
        if (newTarget) {
          this.target = newTarget;
          this.hasRetargeted = true;
          console.log('导弹重新锁定目标');
        }
      }
    }

    // 如果有目标，追踪目标
    if (this.target && this.target.parent) {
      this.huntTarget(deltaTime);
    }

    // 移动导弹
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // 更新朝向
    if (this.velocity.length() > 0.1) {
      const lookTarget = this.mesh.position.clone().add(this.velocity);
      this.mesh.lookAt(lookTarget);
    }

    // 创建尾焰粒子效果（每帧生成）
    if (this.active) {
      const trailPosition = this.mesh.position.clone();
      // 计算导弹尾部位置
      const backwardDirection = this.velocity.clone().normalize().multiplyScalar(-1.5);
      trailPosition.add(backwardDirection);

      // 使用橙黄色创建尾焰
      const trailColor = new THREE.Color().setHSL(0.08 + Math.random() * 0.03, 1, 0.6);
      this.particleSystem.createTrail(trailPosition, trailColor);
    }
  }

  /**
   * 追踪目标
   */
  private huntTarget(deltaTime: number): void {
    if (!this.target) return;

    // 计算到目标的方向
    const targetDirection = new THREE.Vector3()
      .subVectors(this.target.position, this.mesh.position)
      .normalize();

    // 获取当前速度方向
    const currentDirection = this.velocity.clone().normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.turnSpeed * deltaTime;
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
      Math.sin(newRotation) * this.speed,
      targetDirection.y * this.speed, // 保留部分垂直方向
      Math.cos(newRotation) * this.speed
    );
  }

  /**
   * 寻找最近的敌人
   */
  private findNearestEnemy(): THREE.Object3D | null {
    let nearestEnemy: THREE.Object3D | null = null;
    let nearestDistance = Infinity;

    for (const enemy of this.enemies) {
      // 检查敌人是否存活（有父对象）
      if (!enemy.parent) continue;

      const distance = this.mesh.position.distanceTo(enemy.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  /**
   * 设置目标
   */
  public setTarget(target: THREE.Object3D): void {
    this.target = target;
  }

  /**
   * 更新敌人列表（用于导弹自动锁定）
   */
  public updateEnemies(enemies: THREE.Object3D[]): void {
    this.enemies = enemies;
  }

  /**
   * 清除导弹
   */
  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.active = false;
  }
}

/**
 * 导弹系统管理器
 */
export class MissileSystem {
  private scene: THREE.Scene;
  private particleSystem: ParticleSystem;
  private missiles: Missile[] = [];
  private enemies: THREE.Object3D[] = []; // 存储敌人列表，用于重新锁定

  constructor(scene: THREE.Scene, particleSystem?: ParticleSystem) {
    this.scene = scene;
    // 如果没有传入 particleSystem，创建一个临时的
    this.particleSystem = particleSystem || new ParticleSystem(scene);
  }

  /**
   * 更新敌人列表（用于导弹自动锁定）
   */
  public updateEnemies(enemies: THREE.Object3D[]): void {
    this.enemies = enemies;
    // 更新所有现有导弹的敌人列表
    for (const missile of this.missiles) {
      missile.updateEnemies(enemies);
    }
  }

  /**
   * 发射导弹
   */
  public fire(position: THREE.Vector3, _direction: THREE.Vector3, target?: THREE.Object3D): void {
    const missile = new Missile(this.scene, position, target || null, this.particleSystem, this.enemies);
    this.missiles.push(missile);
  }

  /**
   * 更新所有导弹
   */
  public update(deltaTime: number): void {
    // 更新所有导弹
    for (const missile of this.missiles) {
      if (missile.active) {
        missile.update(deltaTime);
      }
    }

    // 移除不活跃的导弹
    this.missiles = this.missiles.filter(m => {
      if (!m.active) {
        m.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  /**
   * 检查导弹碰撞
   */
  public checkCollisions(
    targetMeshes: THREE.Object3D[],
    onHit: (target: THREE.Object3D) => void
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      for (const targetMesh of targetMeshes) {
        if (!targetMesh.parent) continue;

        // 计算距离
        const distance = missile.mesh.position.distanceTo(targetMesh.position);
        const hitDistance = 2; // 命中距离阈值

        if (distance < hitDistance) {
          // 命中目标
          missile.active = false;
          onHit(targetMesh);
          break;
        }
      }
    }
  }

  /**
   * 获取活跃导弹数量
   */
  public getActiveCount(): number {
    return this.missiles.filter(m => m.active).length;
  }

  /**
   * 清除所有导弹
   */
  public dispose(): void {
    for (const missile of this.missiles) {
      missile.dispose(this.scene);
    }
    this.missiles = [];
  }
}
