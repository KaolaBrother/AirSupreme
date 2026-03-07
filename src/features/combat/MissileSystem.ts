import * as THREE from 'three';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { GAME_CONSTANTS } from '@/config';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MissileSystem');
const MISSILE_TRAIL_INTERVAL = 0.04;

let sharedConeGeometry: THREE.ConeGeometry | null = null;
let sharedTrailGeometry: THREE.ConeGeometry | null = null;

function getSharedConeGeometry(): THREE.ConeGeometry {
  if (!sharedConeGeometry) {
    sharedConeGeometry = new THREE.ConeGeometry(0.4, 2.5, 16);
  }
  return sharedConeGeometry;
}

function getSharedTrailGeometry(): THREE.ConeGeometry {
  if (!sharedTrailGeometry) {
    sharedTrailGeometry = new THREE.ConeGeometry(0.25, 2, 16);
  }
  return sharedTrailGeometry;
}

/**
 * 导弹类
 */
export class Missile {
  public mesh: THREE.Group;
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
  private coneMaterial: THREE.MeshStandardMaterial;
  private trailMaterial: THREE.MeshBasicMaterial;
  private trailTimer: number = MISSILE_TRAIL_INTERVAL;
  private readonly targetWorldPos = new THREE.Vector3();
  private readonly targetDirection = new THREE.Vector3();
  private readonly currentDirection = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly orientationHelper = new THREE.Object3D();
  private readonly trailPosition = new THREE.Vector3();
  private readonly backwardDirection = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();
  private readonly enemyWorldPos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    target: THREE.Object3D | null,
    particleSystem: ParticleSystem,
    enemies: THREE.Object3D[] = []
  ) {
    this.particleSystem = particleSystem;
    this.target = target;
    this.enemies = enemies;

    // 记录发射位置
    this.startPosition = position.clone();

    // 导弹模型 - 使用父容器来正确控制朝向
    this.mesh = new THREE.Group();

    // 创建锥体（导弹弹头）- 使用共享几何体
    this.coneMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    const cone = new THREE.Mesh(getSharedConeGeometry(), this.coneMaterial);
    cone.rotation.x = -Math.PI / 2; // 旋转锥体让尖头朝 Z+ 方向（向前）
    this.mesh.add(cone);

    // 增强尾焰效果 - 使用共享几何体
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 1,
    });
    this.trail = new THREE.Mesh(getSharedTrailGeometry(), this.trailMaterial);
    this.trail.rotation.x = -Math.PI / 2;
    this.trail.position.z = 1.5;
    this.mesh.add(this.trail);

    // 设置导弹位置为发射位置
    this.mesh.position.copy(position);

    scene.add(this.mesh);
    this.velocity = new THREE.Vector3();
    this.active = true;

    // 设置初始速度朝向目标
    if (this.target) {
      this.target.getWorldPosition(this.targetWorldPos);
      this.targetDirection.subVectors(this.targetWorldPos, position).normalize();
      this.velocity.copy(this.targetDirection).multiplyScalar(this.speed);
    } else {
      this.velocity.set(0, 0, -this.speed);
    }

    // 立即设置导弹朝向（与速度方向一致）
    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.mesh.lookAt(this.lookTarget);
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
        this.trailColor.set(0xff6600);
        this.particleSystem.createTrail(this.mesh.position, this.trailColor);
      }

      this.active = false;
      return;
    }

    // 如果目标被摧毁，尝试寻找新目标
    if (!this.target || (this.target && !this.target.parent)) {
      // 尝试重新锁定目标
      const newTarget = this.findNearestEnemy();
      if (newTarget) {
        this.target = newTarget;
        log.debug('导弹重新锁定目标');
      }
    }

    // 如果有目标，追踪目标
    if (this.target && this.target.parent) {
      this.huntTarget(deltaTime);
    }

    // 移动导弹
    this.mesh.position.addScaledVector(this.velocity, deltaTime);

    // 更新朝向（使用四元数直接指向速度方向）
    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.orientationHelper.position.copy(this.mesh.position);
      this.orientationHelper.lookAt(this.lookTarget);

      // 平滑插值到目标朝向（避免突然转向）
      this.mesh.quaternion.slerp(this.orientationHelper.quaternion, 0.3);
    }

    // 按固定步进发射尾焰，避免每帧都创建粒子
    if (this.active) {
      this.trailTimer += deltaTime;
      while (this.trailTimer >= MISSILE_TRAIL_INTERVAL) {
        this.trailTimer -= MISSILE_TRAIL_INTERVAL;
        this.emitTrail();
      }
    }
  }

  /**
   * 追踪目标
   */
  private huntTarget(deltaTime: number): void {
    if (!this.target) return;

    // 使用 getWorldPosition 获取实时世界坐标（解决 Boss 部件位置不更新的问题）
    this.target.getWorldPosition(this.targetWorldPos);

    // 计算到目标的方向
    this.targetDirection.subVectors(this.targetWorldPos, this.mesh.position).normalize();

    // 获取当前速度方向
    this.currentDirection.copy(this.velocity).normalize();

    // 计算转向角度（限制转向速度）
    const turnAngle = this.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(this.targetDirection.x, this.targetDirection.z);
    const currentRotation = Math.atan2(this.currentDirection.x, this.currentDirection.z);

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
      this.targetDirection.y * this.speed, // 保留部分垂直方向
      Math.cos(newRotation) * this.speed
    );
  }

  private emitTrail(): void {
    this.trailPosition.copy(this.mesh.position);
    this.backwardDirection.copy(this.velocity).normalize().multiplyScalar(-1.5);
    this.trailPosition.add(this.backwardDirection);
    this.trailColor.setHSL(0.08 + Math.random() * 0.03, 1, 0.6);
    this.particleSystem.createTrail(this.trailPosition, this.trailColor);
  }

  /**
   * 寻找最近的敌人
   */
  private findNearestEnemy(): THREE.Object3D | null {
    let nearestEnemy: THREE.Object3D | null = null;
    let nearestDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.parent) continue;

      enemy.getWorldPosition(this.enemyWorldPos);
      const distance = this.mesh.position.distanceTo(this.enemyWorldPos);
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
    this.coneMaterial.dispose();
    this.trailMaterial.dispose();
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
    const missile = new Missile(
      this.scene,
      position,
      target || null,
      this.particleSystem,
      this.enemies
    );
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
    this.missiles = this.missiles.filter((m) => {
      if (!m.active) {
        m.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  public checkCollisions(
    targetMeshes: THREE.Object3D[],
    onHit: (target: THREE.Object3D) => void
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      for (const targetMesh of targetMeshes) {
        const targetWorldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(targetWorldPos);

        if (
          !isFinite(targetWorldPos.x) ||
          !isFinite(targetWorldPos.y) ||
          !isFinite(targetWorldPos.z)
        ) {
          continue;
        }

        const distance = missile.mesh.position.distanceTo(targetWorldPos);
        const hitDistance = 2;

        if (distance < hitDistance) {
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
    return this.missiles.filter((m) => m.active).length;
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
