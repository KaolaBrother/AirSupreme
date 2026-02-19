import * as THREE from 'three';
import { BossConfig, BossCannonPosition } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import { BossMissileSystem } from './BossMissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

/**
 * Boss AI - 第一关重型轰炸机
 * - 绕大圈飞行
 * - 四门重炮轮流发射
 * - 导弹发射器定期发射追踪导弹
 */
export class BossAI {
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private trail: ParticleTrailRenderer;
  private missileSystem: BossMissileSystem;

  // 运动系统
  public velocity: THREE.Vector3;
  private circleAngle: number = 0;
  private circleCenter: THREE.Vector3 = new THREE.Vector3(0, 100, 0);

  // 武器系统
  private cannonCooldown: number = 0;
  private currentCannon: BossCannonPosition = BossCannonPosition.LEFT_WING;
  private missileCooldown: number = 0;

  // 四门重炮的位置偏移（相对于 Boss 中心）
  private cannonOffsets: Record<BossCannonPosition, THREE.Vector3> = {
    [BossCannonPosition.LEFT_WING]: new THREE.Vector3(-4, 0, 0),
    [BossCannonPosition.RIGHT_WING]: new THREE.Vector3(4, 0, 0),
    [BossCannonPosition.TOP]: new THREE.Vector3(0, 1.5, 0),
    [BossCannonPosition.BOTTOM]: new THREE.Vector3(0, -1.5, 0),
  };

  // 目标引用
  private playerMesh: THREE.Object3D | null = null;
  private friendlyMeshes: THREE.Object3D[] = [];

  // 回调
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;

  constructor(
    mesh: THREE.Group,
    config: BossConfig,
    scene: THREE.Scene,
    particleSystem: ParticleSystem
  ) {
    this.mesh = mesh;
    this.config = config;
    this.health = new HealthSystem(config.health);

    this.missileSystem = new BossMissileSystem(scene, particleSystem);

    this.velocity = new THREE.Vector3(0, 0, -config.speed);

    // 初始化导弹冷却时间，避免立即发射
    this.missileCooldown = config.missileFireInterval;

    // 创建尾迹
    this.trail = new ParticleTrailRenderer(scene, mesh, 0xff4400);

    // 死亡回调
    this.health.onDeath = () => {
      this.onDestroy?.(this.mesh.position.clone(), this.config);
    };
  }

  public update(
    deltaTime: number,
    playerMesh: THREE.Object3D | null,
    friendlyMeshes: THREE.Object3D[]
  ): void {
    if (!this.isAlive()) return;

    this.playerMesh = playerMesh;
    this.friendlyMeshes = friendlyMeshes;

    // 绕大圈飞行
    this.updateCircleFlight(deltaTime);

    // 更新武器冷却
    this.cannonCooldown -= deltaTime;
    this.missileCooldown -= deltaTime;

    // 四门重炮轮流发射
    if (this.cannonCooldown <= 0) {
      this.fireCannon();
      this.cannonCooldown = this.config.cannonFireInterval;
      this.advanceToNextCannon();
    }

    // 导弹发射
    if (this.missileCooldown <= 0) {
      this.fireMissile();
      this.missileCooldown = this.config.missileFireInterval;
    }

    // 更新导弹系统
    this.missileSystem.update(deltaTime);

    // 更新尾迹
    const engineLocalPos = new THREE.Vector3(0, 0, 3);
    const engineWorldPos = engineLocalPos.applyMatrix4(this.mesh.matrixWorld);
    this.trail.addPoint(engineWorldPos);
    this.trail.update(deltaTime);
  }

  private updateCircleFlight(deltaTime: number): void {
    // 更新圆周运动角度
    const angularSpeed = this.config.speed / this.config.circleRadius;
    this.circleAngle += angularSpeed * deltaTime;

    // 计算目标位置（绕玩家位置的大圈）
    const targetCenter = this.playerMesh?.position || this.circleCenter;
    const targetX = targetCenter.x + Math.cos(this.circleAngle) * this.config.circleRadius;
    const targetZ = targetCenter.z + Math.sin(this.circleAngle) * this.config.circleRadius;
    const targetY = targetCenter.y + 50; // 略高于玩家

    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

    // 计算方向并转向
    const targetDirection = new THREE.Vector3()
      .subVectors(targetPos, this.mesh.position)
      .normalize();

    const currentDirection = this.velocity.clone().normalize();
    const turnAngle = this.config.turnSpeed * deltaTime;
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      targetDirection.y * this.config.speed * 0.3,
      Math.cos(newRotation) * this.config.speed
    );

    // 移动
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // 更新朝向
    if (this.velocity.length() > 0) {
      const lookTarget = this.mesh.position.clone().add(this.velocity);
      const dummy = new THREE.Object3D();
      dummy.position.copy(this.mesh.position);
      dummy.lookAt(lookTarget);
      this.mesh.quaternion.slerp(dummy.quaternion, 0.3);
    }
  }

  private fireCannon(): void {
    if (!this.playerMesh) return;

    const cannonOffset = this.cannonOffsets[this.currentCannon].clone();
    cannonOffset.applyQuaternion(this.mesh.quaternion);
    const firePosition = this.mesh.position.clone().add(cannonOffset);

    let targetPosition: THREE.Vector3;

    // 左右翼炮：优先攻击最近的威胁
    if (
      this.currentCannon === BossCannonPosition.LEFT_WING ||
      this.currentCannon === BossCannonPosition.RIGHT_WING
    ) {
      targetPosition = this.findNearestThreat();
    } else {
      // 上下炮：随机选择目标
      targetPosition = this.selectRandomTarget();
    }

    const direction = new THREE.Vector3().subVectors(targetPosition, firePosition).normalize();

    this.onFire?.(firePosition, direction, this.config.damage);
  }

  private findNearestThreat(): THREE.Vector3 {
    let nearestPos: THREE.Vector3 = this.playerMesh!.position.clone();
    let minDistance = this.mesh.position.distanceTo(this.playerMesh!.position);

    for (const friendly of this.friendlyMeshes) {
      if (!friendly.parent) continue;
      const dist = this.mesh.position.distanceTo(friendly.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPos = friendly.position.clone();
      }
    }

    return nearestPos;
  }

  private selectRandomTarget(): THREE.Vector3 {
    const validTargets: THREE.Object3D[] = [this.playerMesh!];

    for (const friendly of this.friendlyMeshes) {
      if (friendly.parent) {
        validTargets.push(friendly);
      }
    }

    const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    return randomTarget.position.clone();
  }

  private advanceToNextCannon(): void {
    const cannonOrder = [
      BossCannonPosition.LEFT_WING,
      BossCannonPosition.RIGHT_WING,
      BossCannonPosition.TOP,
      BossCannonPosition.BOTTOM,
    ];

    const currentIndex = cannonOrder.indexOf(this.currentCannon);
    const nextIndex = (currentIndex + 1) % cannonOrder.length;
    this.currentCannon = cannonOrder[nextIndex];
  }

  private fireMissile(): void {
    if (!this.playerMesh) return;

    let target: THREE.Object3D | null = null;
    let targetingPlayer = false;

    // 50%概率锁定玩家
    if (Math.random() < 0.5) {
      targetingPlayer = true;
      target = null;
    } else {
      // 找最近的友军
      let minDistance = Infinity;
      for (const friendly of this.friendlyMeshes) {
        if (!friendly.parent) continue;
        const dist = this.mesh.position.distanceTo(friendly.position);
        if (dist < minDistance) {
          minDistance = dist;
          target = friendly;
        }
      }
      // 如果没有友军，锁定玩家
      if (!target) {
        targetingPlayer = true;
      }
    }

    const missilePosition = this.mesh.position.clone();
    this.missileSystem.fire(
      missilePosition,
      target,
      this.friendlyMeshes,
      this.playerMesh,
      targetingPlayer
    );
    this.onMissileFired?.();
  }

  public getMissileSystem(): BossMissileSystem {
    return this.missileSystem;
  }

  public takeDamage(damage: number): void {
    this.health.takeDamage(damage);
  }

  public getHealth(): { current: number; max: number } {
    return {
      current: this.health.getCurrentHealth(),
      max: this.health.getMaxHealth(),
    };
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public getConfig(): BossConfig {
    return this.config;
  }

  public isAlive(): boolean {
    return this.health.getCurrentHealth() > 0;
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * 获取 Boss 的碰撞部件（用于导弹锁定）
   * 直接返回原始 mesh，让调用者使用 getWorldPosition 获取实时世界坐标
   */
  public getCollisionParts(): THREE.Object3D[] {
    const parts = (this.mesh as any).bossParts as THREE.Mesh[] | undefined;
    if (!parts) return [this.mesh];
    // 直接返回原始 mesh，而不是创建临时对象
    return parts;
  }

  public getCollisionPartMeshes(): THREE.Mesh[] {
    const parts = (this.mesh as any).bossParts as THREE.Mesh[] | undefined;
    if (!parts) return [];
    return parts;
  }

  public dispose(): void {
    this.mesh.visible = false;
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.trail.dispose();
    this.missileSystem.dispose();

    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }
}

/**
 * 创建 Boss 专用模型
 * 重型轰炸机 Boss - 复杂的几何结构
 * 飞机前进方向: -Z，上方向: +Y
 */
export function createBossMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    metalness: 0.8,
    roughness: 0.3,
  });

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.7,
    roughness: 0.4,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b0000,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0x440000,
    emissiveIntensity: 0.3,
  });

  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x440000,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0x220000,
    emissiveIntensity: 0.5,
  });

  // 机身 - 沿 Z 轴，机头朝向 -Z
  const bodyGeometry = new THREE.CylinderGeometry(1.2 * scale, 0.8 * scale, 8 * scale, 12);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2;
  body.name = 'boss_body';
  body.castShadow = true;
  group.add(body);
  parts.push(body);

  // 机头 - 尖端朝向 -Z（前方）
  // ConeGeometry 默认尖端朝向 +Y，rotation.x = +PI/2 使尖端朝向 -Z
  const noseGeometry = new THREE.ConeGeometry(0.8 * scale, 3 * scale, 12);
  const nose = new THREE.Mesh(noseGeometry, accentMaterial);
  nose.rotation.x = Math.PI / 2; // 正值使尖端朝向 -Z（前方）
  nose.position.set(0, 0, -5.5 * scale);
  nose.name = 'boss_nose';
  nose.castShadow = true;
  group.add(nose);
  parts.push(nose);

  // 主翼 - 使用 BoxGeometry 更简单可靠
  const wingGeometry = new THREE.BoxGeometry(12 * scale, 0.3 * scale, 3 * scale);

  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(-7.5 * scale, 0, 0);
  leftWing.name = 'boss_left_wing';
  leftWing.castShadow = true;
  group.add(leftWing);
  parts.push(leftWing);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.position.set(7.5 * scale, 0, 0);
  rightWing.name = 'boss_right_wing';
  rightWing.castShadow = true;
  group.add(rightWing);
  parts.push(rightWing);

  // 四门重炮炮塔
  const turretGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 1 * scale, 8);

  const leftTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  leftTurret.position.set(-4 * scale, 0.6 * scale, 0);
  leftTurret.name = 'boss_left_turret';
  leftTurret.castShadow = true;
  group.add(leftTurret);
  parts.push(leftTurret);

  const rightTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  rightTurret.position.set(4 * scale, 0.6 * scale, 0);
  rightTurret.name = 'boss_right_turret';
  rightTurret.castShadow = true;
  group.add(rightTurret);
  parts.push(rightTurret);

  const topTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  topTurret.position.set(0, 1.5 * scale, 0);
  topTurret.name = 'boss_top_turret';
  topTurret.castShadow = true;
  group.add(topTurret);
  parts.push(topTurret);

  const bottomTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  bottomTurret.position.set(0, -1.5 * scale, 0);
  bottomTurret.name = 'boss_bottom_turret';
  bottomTurret.castShadow = true;
  group.add(bottomTurret);
  parts.push(bottomTurret);

  // 尾翼（水平）
  const tailGeometry = new THREE.BoxGeometry(3 * scale, 0.2 * scale, 1.5 * scale);
  const tail = new THREE.Mesh(tailGeometry, wingMaterial);
  tail.position.set(0, 0, 4 * scale);
  tail.name = 'boss_tail';
  tail.castShadow = true;
  group.add(tail);
  parts.push(tail);

  // 垂直尾翼
  const vTailGeometry = new THREE.BoxGeometry(0.2 * scale, 2 * scale, 1 * scale);
  const vTail = new THREE.Mesh(vTailGeometry, wingMaterial);
  vTail.position.set(0, 1 * scale, 4 * scale);
  vTail.name = 'boss_vtail';
  vTail.castShadow = true;
  group.add(vTail);
  parts.push(vTail);

  // 驾驶舱
  const cockpitGeometry = new THREE.SphereGeometry(0.6 * scale, 12, 12);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x111133,
    metalness: 0.95,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8,
  });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.set(0, 0.8 * scale, -2 * scale);
  cockpit.scale.set(1, 0.6, 1.5);
  cockpit.name = 'boss_cockpit';
  cockpit.castShadow = true;
  group.add(cockpit);
  parts.push(cockpit);

  // 四个引擎（尾部）
  const engineGeometry = new THREE.CylinderGeometry(0.4 * scale, 0.3 * scale, 1.5 * scale, 8);
  const engineMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.9,
  });

  const enginePositions = [
    new THREE.Vector3(-3 * scale, 0, 4.5 * scale),
    new THREE.Vector3(3 * scale, 0, 4.5 * scale),
    new THREE.Vector3(-1.5 * scale, 0, 4.5 * scale),
    new THREE.Vector3(1.5 * scale, 0, 4.5 * scale),
  ];

  const engineMeshes: THREE.Mesh[] = [];
  enginePositions.forEach((pos, i) => {
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.position.copy(pos);
    engine.name = `boss_engine_${i}`;
    group.add(engine);
    parts.push(engine);
    engineMeshes.push(engine);
  });

  (group as any).bossParts = parts;
  (group as any).engineMeshes = engineMeshes;
  group.name = `BOSS_${config.type}`;
  return group;
}
