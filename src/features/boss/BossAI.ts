import * as THREE from 'three';
import { BossConfig, BossCannonPosition } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import { BossMissileSystem } from './BossMissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

type BossGroup = THREE.Group & {
  bossParts?: THREE.Mesh[];
  engineMeshes?: THREE.Mesh[];
  engineRingMeshes?: THREE.Mesh[];
  weakpointMeshes?: THREE.Mesh[];
  muzzleMeshes?: THREE.Mesh[];
};

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
  private readonly weakpointMeshes: THREE.Mesh[];
  private readonly muzzleMeshes: THREE.Mesh[];
  private readonly engineMeshes: THREE.Mesh[];
  private readonly engineRingMeshes: THREE.Mesh[];
  private readonly weakpointBaseColor = new THREE.Color(0xff5a24);
  private readonly weakpointCriticalColor = new THREE.Color(0xffd27a);
  private readonly muzzleBaseColor = new THREE.Color(0xff6b30);
  private readonly muzzleCriticalColor = new THREE.Color(0xffef9b);
  private readonly engineRingBaseColor = new THREE.Color(0xff8a2e);
  private readonly engineRingCriticalColor = new THREE.Color(0xffd274);
  private visualPulseTime: number = 0;
  private damageFlashTimer: number = 0;

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
    const bossGroup = mesh as BossGroup;
    this.weakpointMeshes = bossGroup.weakpointMeshes ?? [];
    this.muzzleMeshes = bossGroup.muzzleMeshes ?? [];
    this.engineMeshes = bossGroup.engineMeshes ?? [];
    this.engineRingMeshes = bossGroup.engineRingMeshes ?? [];

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
    this.updateVisualPulse(deltaTime);

    // 更新尾迹
    const engineLocalPos = new THREE.Vector3(0, 0, 3);
    const engineWorldPos = engineLocalPos.applyMatrix4(this.mesh.matrixWorld);
    this.trail.addPoint(engineWorldPos);
    this.trail.update(deltaTime);
  }

  private updateVisualPulse(deltaTime: number): void {
    this.visualPulseTime += deltaTime;

    const cannonInterval = Math.max(this.config.cannonFireInterval, 0.001);
    const missileInterval = Math.max(this.config.missileFireInterval, 0.001);
    const cannonCharge = 1 - Math.max(0, Math.min(1, this.cannonCooldown / cannonInterval));
    const missileCharge = 1 - Math.max(0, Math.min(1, this.missileCooldown / missileInterval));
    const healthRatio = this.health.getCurrentHealth() / this.health.getMaxHealth();
    const criticalState = THREE.MathUtils.clamp((0.28 - healthRatio) / 0.28, 0, 1);
    const speedRatio = Math.max(
      0.25,
      Math.min(1.2, this.velocity.length() / Math.max(this.config.speed, 0.001))
    );
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - deltaTime);
    const damageFlash = this.damageFlashTimer > 0 ? this.damageFlashTimer / 0.22 : 0;
    const weakpointWave = Math.sin(this.visualPulseTime * 2.8) * 0.5 + 0.5;
    const engineWave = Math.sin(this.visualPulseTime * 10) * 0.5 + 0.5;
    const criticalPulse = (Math.sin(this.visualPulseTime * 16) * 0.5 + 0.5) * criticalState;

    for (const mesh of this.weakpointMeshes) {
      this.setGlowState(
        mesh,
        1.15 + weakpointWave * 0.95 + missileCharge * 0.35 + criticalPulse * 1.1 + damageFlash * 1.6,
        this.weakpointBaseColor.clone().lerp(this.weakpointCriticalColor, criticalState + criticalPulse * 0.35)
      );
      const pulseScale = 1 + weakpointWave * 0.08 + criticalPulse * 0.08 + damageFlash * 0.1;
      mesh.scale.setScalar(pulseScale);
    }

    const activeMuzzleIndex = this.getCurrentMuzzleIndex();
    for (let i = 0; i < this.muzzleMeshes.length; i++) {
      const activeBoost = i === activeMuzzleIndex ? 0.75 + cannonCharge * 1.4 : 0.25 + cannonCharge * 0.35;
      this.setGlowState(
        this.muzzleMeshes[i],
        0.45 +
          activeBoost +
          (Math.sin(this.visualPulseTime * 14 + i) * 0.5 + 0.5) * 0.2 +
          criticalPulse * 0.75 +
          damageFlash * 1.05,
        this.muzzleBaseColor.clone().lerp(this.muzzleCriticalColor, criticalState + damageFlash * 0.2)
      );
    }

    for (const mesh of this.engineMeshes) {
      this.setMaterialOpacity(
        mesh,
        0.5 + engineWave * 0.28 * speedRatio + cannonCharge * 0.08 + damageFlash * 0.12
      );
    }

    for (const ring of this.engineRingMeshes) {
      this.setGlowState(
        ring,
        0.8 +
          engineWave * 0.9 * speedRatio +
          missileCharge * 0.3 +
          criticalPulse * 0.8 +
          damageFlash * 0.9,
        this.engineRingBaseColor
          .clone()
          .lerp(this.engineRingCriticalColor, criticalState + criticalPulse * 0.4)
      );
      const ringScale = 1 + criticalPulse * 0.07 + damageFlash * 0.08;
      ring.scale.setScalar(ringScale);
    }
  }

  private getCurrentMuzzleIndex(): number {
    switch (this.currentCannon) {
      case BossCannonPosition.LEFT_WING:
        return 0;
      case BossCannonPosition.RIGHT_WING:
        return 1;
      case BossCannonPosition.TOP:
        return 2;
      case BossCannonPosition.BOTTOM:
        return 3;
      default:
        return 0;
    }
  }

  private setGlowState(mesh: THREE.Mesh, intensity: number, color?: THREE.Color): void {
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissiveIntensity = intensity;
      if (color) {
        mesh.material.emissive.copy(color);
        mesh.material.color.copy(color);
      }
    }
  }

  private setMaterialOpacity(mesh: THREE.Mesh, opacity: number): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.opacity = opacity;
    }
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
    if (!this.playerMesh) {
      return this.mesh.position.clone();
    }

    let nearestPos: THREE.Vector3 = this.playerMesh.position.clone();
    let minDistance = this.mesh.position.distanceTo(this.playerMesh.position);

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
    if (!this.playerMesh) {
      return this.mesh.position.clone();
    }

    const validTargets: THREE.Object3D[] = [this.playerMesh];

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
    this.damageFlashTimer = 0.22;
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
    const parts = (this.mesh as BossGroup).bossParts;
    if (!parts) return [this.mesh];
    // 直接返回原始 mesh，而不是创建临时对象
    return parts;
  }

  public getCollisionPartMeshes(): THREE.Mesh[] {
    const parts = (this.mesh as BossGroup).bossParts;
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
  const weakpointMeshes: THREE.Mesh[] = [];
  const muzzleMeshes: THREE.Mesh[] = [];

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xaebcca,
    metalness: 0.62,
    roughness: 0.18,
    emissive: 0x2d3946,
    emissiveIntensity: 0.24,
  });

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xc4cfd8,
    metalness: 0.56,
    roughness: 0.2,
    emissive: 0x303b49,
    emissiveIntensity: 0.2,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xcd7458,
    metalness: 0.9,
    roughness: 0.16,
    emissive: 0x7a3527,
    emissiveIntensity: 0.48,
  });

  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x758392,
    metalness: 0.84,
    roughness: 0.14,
    emissive: 0x293440,
    emissiveIntensity: 0.28,
  });

  const sensorMaterial = new THREE.MeshStandardMaterial({
    color: 0x7fb4d8,
    metalness: 0.78,
    roughness: 0.12,
    emissive: 0x245c8a,
    emissiveIntensity: 0.38,
  });

  const weaponMaterial = new THREE.MeshStandardMaterial({
    color: 0x8c6a5b,
    metalness: 0.88,
    roughness: 0.14,
    emissive: 0x5a2f21,
    emissiveIntensity: 0.3,
  });

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff5533,
    emissive: 0xff3300,
    emissiveIntensity: 1.4,
    metalness: 0.4,
    roughness: 0.2,
  });

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9e2e9,
    metalness: 0.68,
    roughness: 0.16,
    emissive: 0x30414e,
    emissiveIntensity: 0.2,
  });

  // 机身 - 沿 Z 轴，机头朝向 -Z
  const bodyGeometry = new THREE.CylinderGeometry(1.2 * scale, 0.8 * scale, 8 * scale, 12);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2;
  body.name = 'boss_body';
  body.castShadow = true;
  group.add(body);
  parts.push(body);

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(1.1 * scale, 0.35 * scale, 6.2 * scale),
    panelMaterial
  );
  spine.position.set(0, 0.85 * scale, -0.2 * scale);
  spine.name = 'boss_spine';
  spine.castShadow = true;
  group.add(spine);

  const dorsalArmor = new THREE.Mesh(
    new THREE.BoxGeometry(1.6 * scale, 0.28 * scale, 4.2 * scale),
    wingMaterial
  );
  dorsalArmor.position.set(0, 1.15 * scale, -0.4 * scale);
  dorsalArmor.name = 'boss_dorsal_armor';
  dorsalArmor.castShadow = true;
  group.add(dorsalArmor);

  for (let i = 0; i < 3; i++) {
    const dorsalFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * scale, 0.9 * scale, 0.95 * scale),
      panelMaterial
    );
    dorsalFin.position.set(0, 1.38 * scale, (-1.9 + i * 1.9) * scale);
    dorsalFin.name = `boss_dorsal_fin_${i}`;
    dorsalFin.castShadow = true;
    group.add(dorsalFin);
  }

  const ventralHull = new THREE.Mesh(
    new THREE.BoxGeometry(1.5 * scale, 0.55 * scale, 5.5 * scale),
    bodyMaterial
  );
  ventralHull.position.set(0, -0.95 * scale, -0.1 * scale);
  ventralHull.name = 'boss_ventral_hull';
  ventralHull.castShadow = true;
  group.add(ventralHull);
  parts.push(ventralHull);

  const ventralKeel = new THREE.Mesh(
    new THREE.BoxGeometry(0.6 * scale, 0.45 * scale, 3.2 * scale),
    panelMaterial
  );
  ventralKeel.position.set(0, -1.4 * scale, 0.8 * scale);
  ventralKeel.name = 'boss_ventral_keel';
  ventralKeel.castShadow = true;
  group.add(ventralKeel);

  for (let i = 0; i < 2; i++) {
    const intake = new THREE.Mesh(
      new THREE.BoxGeometry(0.55 * scale, 0.24 * scale, 1.15 * scale),
      turretMaterial
    );
    intake.position.set(0, -1.15 * scale, (-1.4 + i * 2.8) * scale);
    intake.name = `boss_ventral_intake_${i}`;
    intake.castShadow = true;
    group.add(intake);
  }

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

  const noseWeakpoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.45 * scale, 12, 12),
    glowMaterial
  );
  noseWeakpoint.position.set(0, 0.1 * scale, -4.7 * scale);
  noseWeakpoint.name = 'boss_nose_weakpoint';
  group.add(noseWeakpoint);
  weakpointMeshes.push(noseWeakpoint);

  for (let i = 0; i < 2; i++) {
    const canard = new THREE.Mesh(
      new THREE.BoxGeometry(1.55 * scale, 0.12 * scale, 1.2 * scale),
      panelMaterial
    );
    canard.position.set((i === 0 ? -1.55 : 1.55) * scale, 0.3 * scale, -3.55 * scale);
    canard.rotation.z = i === 0 ? 0.24 : -0.24;
    canard.name = `boss_canard_${i}`;
    canard.castShadow = true;
    group.add(canard);
  }

  const sensorSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.45 * scale, 0.32 * scale, 1.7 * scale),
    sensorMaterial
  );
  sensorSpine.position.set(0, 1.05 * scale, -3.9 * scale);
  sensorSpine.name = 'boss_sensor_spine';
  sensorSpine.castShadow = true;
  group.add(sensorSpine);

  // 主翼 - 使用 BoxGeometry 更简单可靠
  const wingGeometry = new THREE.BoxGeometry(12 * scale, 0.3 * scale, 3 * scale);

  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(-7.5 * scale, 0, 0);
  leftWing.name = 'boss_left_wing';
  leftWing.castShadow = true;
  group.add(leftWing);
  parts.push(leftWing);

  const leftWingRoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.4 * scale, 0.42 * scale, 2.6 * scale),
    bodyMaterial
  );
  leftWingRoot.position.set(-4.6 * scale, -0.15 * scale, 0.2 * scale);
  leftWingRoot.name = 'boss_left_wing_root';
  leftWingRoot.castShadow = true;
  group.add(leftWingRoot);

  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 * scale, 0.15 * scale, 0.8 * scale),
      panelMaterial
    );
    panel.position.set((-9 + i * 2.4) * scale, 0.22 * scale, -0.95 * scale);
    panel.name = `boss_left_wing_panel_${i}`;
    panel.castShadow = true;
    group.add(panel);
  }

  const leftWingPod = new THREE.Mesh(
    new THREE.BoxGeometry(2.2 * scale, 0.45 * scale, 1.2 * scale),
    panelMaterial
  );
  leftWingPod.position.set(-5.6 * scale, 0.35 * scale, 0.5 * scale);
  leftWingPod.name = 'boss_left_wing_pod';
  leftWingPod.castShadow = true;
  group.add(leftWingPod);

  for (let i = 0; i < 2; i++) {
    const hardpoint = new THREE.Mesh(
      new THREE.BoxGeometry(0.55 * scale, 0.32 * scale, 1.35 * scale),
      weaponMaterial
    );
    hardpoint.position.set((-8.8 + i * 3.4) * scale, -0.18 * scale, 0.3 * scale);
    hardpoint.name = `boss_left_wing_hardpoint_${i}`;
    hardpoint.castShadow = true;
    group.add(hardpoint);
  }

  const leftWingTip = new THREE.Mesh(
    new THREE.BoxGeometry(1.3 * scale, 0.32 * scale, 1.25 * scale),
    weaponMaterial
  );
  leftWingTip.position.set(-13.2 * scale, 0.1 * scale, 0.15 * scale);
  leftWingTip.name = 'boss_left_wingtip_module';
  leftWingTip.castShadow = true;
  group.add(leftWingTip);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.position.set(7.5 * scale, 0, 0);
  rightWing.name = 'boss_right_wing';
  rightWing.castShadow = true;
  group.add(rightWing);
  parts.push(rightWing);

  const rightWingRoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.4 * scale, 0.42 * scale, 2.6 * scale),
    bodyMaterial
  );
  rightWingRoot.position.set(4.6 * scale, -0.15 * scale, 0.2 * scale);
  rightWingRoot.name = 'boss_right_wing_root';
  rightWingRoot.castShadow = true;
  group.add(rightWingRoot);

  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 * scale, 0.15 * scale, 0.8 * scale),
      panelMaterial
    );
    panel.position.set((9 - i * 2.4) * scale, 0.22 * scale, -0.95 * scale);
    panel.name = `boss_right_wing_panel_${i}`;
    panel.castShadow = true;
    group.add(panel);
  }

  const rightWingPod = new THREE.Mesh(
    new THREE.BoxGeometry(2.2 * scale, 0.45 * scale, 1.2 * scale),
    panelMaterial
  );
  rightWingPod.position.set(5.6 * scale, 0.35 * scale, 0.5 * scale);
  rightWingPod.name = 'boss_right_wing_pod';
  rightWingPod.castShadow = true;
  group.add(rightWingPod);

  for (let i = 0; i < 2; i++) {
    const hardpoint = new THREE.Mesh(
      new THREE.BoxGeometry(0.55 * scale, 0.32 * scale, 1.35 * scale),
      weaponMaterial
    );
    hardpoint.position.set((8.8 - i * 3.4) * scale, -0.18 * scale, 0.3 * scale);
    hardpoint.name = `boss_right_wing_hardpoint_${i}`;
    hardpoint.castShadow = true;
    group.add(hardpoint);
  }

  const rightWingTip = new THREE.Mesh(
    new THREE.BoxGeometry(1.3 * scale, 0.32 * scale, 1.25 * scale),
    weaponMaterial
  );
  rightWingTip.position.set(13.2 * scale, 0.1 * scale, 0.15 * scale);
  rightWingTip.name = 'boss_right_wingtip_module';
  rightWingTip.castShadow = true;
  group.add(rightWingTip);

  for (let i = 0; i < 2; i++) {
    const sponson = new THREE.Mesh(
      new THREE.BoxGeometry(1.35 * scale, 0.82 * scale, 2.4 * scale),
      bodyMaterial
    );
    sponson.position.set((i === 0 ? -2.2 : 2.2) * scale, -0.2 * scale, 1.15 * scale);
    sponson.name = `boss_side_sponson_${i}`;
    sponson.castShadow = true;
    group.add(sponson);
    parts.push(sponson);

    const sponsonTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 * scale, 0.5 * scale, 1.7 * scale),
      panelMaterial
    );
    sponsonTrim.position.set((i === 0 ? -2.9 : 2.9) * scale, -0.05 * scale, 1.15 * scale);
    sponsonTrim.name = `boss_side_sponson_trim_${i}`;
    sponsonTrim.castShadow = true;
    group.add(sponsonTrim);
  }

  // 四门重炮炮塔
  const turretGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 1 * scale, 8);

  const leftTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  leftTurret.position.set(-4 * scale, 0.6 * scale, 0);
  leftTurret.name = 'boss_left_turret';
  leftTurret.castShadow = true;
  group.add(leftTurret);
  parts.push(leftTurret);

  const leftTurretHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.45 * scale, 0.45 * scale, 1.2 * scale),
    panelMaterial
  );
  leftTurretHousing.position.set(-4 * scale, 0.42 * scale, 0);
  leftTurretHousing.name = 'boss_left_turret_housing';
  leftTurretHousing.castShadow = true;
  group.add(leftTurretHousing);

  const leftMuzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.2 * scale, 0.35 * scale, 8),
    glowMaterial
  );
  leftMuzzle.rotation.z = Math.PI / 2;
  leftMuzzle.position.set(-4 * scale, 0.6 * scale, -0.65 * scale);
  leftMuzzle.name = 'boss_left_muzzle';
  group.add(leftMuzzle);
  muzzleMeshes.push(leftMuzzle);

  const rightTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  rightTurret.position.set(4 * scale, 0.6 * scale, 0);
  rightTurret.name = 'boss_right_turret';
  rightTurret.castShadow = true;
  group.add(rightTurret);
  parts.push(rightTurret);

  const rightTurretHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.45 * scale, 0.45 * scale, 1.2 * scale),
    panelMaterial
  );
  rightTurretHousing.position.set(4 * scale, 0.42 * scale, 0);
  rightTurretHousing.name = 'boss_right_turret_housing';
  rightTurretHousing.castShadow = true;
  group.add(rightTurretHousing);

  const rightMuzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.2 * scale, 0.35 * scale, 8),
    glowMaterial
  );
  rightMuzzle.rotation.z = Math.PI / 2;
  rightMuzzle.position.set(4 * scale, 0.6 * scale, -0.65 * scale);
  rightMuzzle.name = 'boss_right_muzzle';
  group.add(rightMuzzle);
  muzzleMeshes.push(rightMuzzle);

  const topTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  topTurret.position.set(0, 1.5 * scale, 0);
  topTurret.name = 'boss_top_turret';
  topTurret.castShadow = true;
  group.add(topTurret);
  parts.push(topTurret);

  const topTurretPod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75 * scale, 0.9 * scale, 0.4 * scale, 10),
    panelMaterial
  );
  topTurretPod.position.set(0, 1.24 * scale, 0);
  topTurretPod.name = 'boss_top_turret_pod';
  topTurretPod.castShadow = true;
  group.add(topTurretPod);

  const topMuzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.2 * scale, 0.35 * scale, 8),
    glowMaterial
  );
  topMuzzle.position.set(0, 2.05 * scale, -0.35 * scale);
  topMuzzle.name = 'boss_top_muzzle';
  group.add(topMuzzle);
  muzzleMeshes.push(topMuzzle);

  const bottomTurret = new THREE.Mesh(turretGeometry, turretMaterial);
  bottomTurret.position.set(0, -1.5 * scale, 0);
  bottomTurret.name = 'boss_bottom_turret';
  bottomTurret.castShadow = true;
  group.add(bottomTurret);
  parts.push(bottomTurret);

  const bottomTurretPod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75 * scale, 0.9 * scale, 0.4 * scale, 10),
    panelMaterial
  );
  bottomTurretPod.position.set(0, -1.24 * scale, 0);
  bottomTurretPod.name = 'boss_bottom_turret_pod';
  bottomTurretPod.castShadow = true;
  group.add(bottomTurretPod);

  const bottomMuzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scale, 0.2 * scale, 0.35 * scale, 8),
    glowMaterial
  );
  bottomMuzzle.position.set(0, -2.05 * scale, -0.35 * scale);
  bottomMuzzle.name = 'boss_bottom_muzzle';
  group.add(bottomMuzzle);
  muzzleMeshes.push(bottomMuzzle);

  // 尾翼（水平）
  const tailGeometry = new THREE.BoxGeometry(3 * scale, 0.2 * scale, 1.5 * scale);
  const tail = new THREE.Mesh(tailGeometry, wingMaterial);
  tail.position.set(0, 0, 4 * scale);
  tail.name = 'boss_tail';
  tail.castShadow = true;
  group.add(tail);
  parts.push(tail);

  const tailBridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.2 * scale, 0.35 * scale, 2.2 * scale),
    panelMaterial
  );
  tailBridge.position.set(0, 0.45 * scale, 3.3 * scale);
  tailBridge.name = 'boss_tail_bridge';
  tailBridge.castShadow = true;
  group.add(tailBridge);

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
    color: 0x82bfeb,
    metalness: 0.62,
    roughness: 0.1,
    emissive: 0x2870a8,
    emissiveIntensity: 0.44,
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

  const cockpitFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.72 * scale, 0.08 * scale, 8, 18),
    panelMaterial
  );
  cockpitFrame.rotation.y = Math.PI / 2;
  cockpitFrame.scale.set(1.05, 0.7, 1.45);
  cockpitFrame.position.copy(cockpit.position);
  cockpitFrame.name = 'boss_cockpit_frame';
  cockpitFrame.castShadow = true;
  group.add(cockpitFrame);

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
  const engineRingMeshes: THREE.Mesh[] = [];
  enginePositions.forEach((pos, i) => {
    const enginePylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.8 * scale, 0.55 * scale, 1.05 * scale),
      wingMaterial
    );
    enginePylon.position.set(pos.x, -0.18 * scale, pos.z - 0.15 * scale);
    enginePylon.name = `boss_engine_pylon_${i}`;
    enginePylon.castShadow = true;
    group.add(enginePylon);

    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.position.copy(pos);
    engine.name = `boss_engine_${i}`;
    group.add(engine);
    parts.push(engine);
    engineMeshes.push(engine);

    const engineRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.42 * scale, 0.1 * scale, 8, 16),
      glowMaterial
    );
    engineRing.rotation.y = Math.PI / 2;
    engineRing.position.copy(pos).setZ(pos.z + 0.8 * scale);
    engineRing.name = `boss_engine_ring_${i}`;
    group.add(engineRing);
    engineRingMeshes.push(engineRing);
  });

  for (let i = 0; i < 4; i++) {
    const bellyPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.72 * scale, 0.14 * scale, 1.35 * scale),
      panelMaterial
    );
    bellyPanel.position.set((-1.2 + i * 0.8) * scale, -1.05 * scale, (0.5 + i * 0.55) * scale);
    bellyPanel.name = `boss_belly_panel_${i}`;
    group.add(bellyPanel);
  }

  for (let i = 0; i < 2; i++) {
    const bombBay = new THREE.Mesh(
      new THREE.BoxGeometry(0.88 * scale, 0.42 * scale, 2.05 * scale),
      weaponMaterial
    );
    bombBay.position.set((i === 0 ? -0.82 : 0.82) * scale, -1.32 * scale, 1.65 * scale);
    bombBay.name = `boss_bomb_bay_${i}`;
    bombBay.castShadow = true;
    group.add(bombBay);
  }

  for (let i = 0; i < 2; i++) {
    const tailBoom = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 * scale, 0.42 * scale, 1.8 * scale),
      panelMaterial
    );
    tailBoom.position.set((i === 0 ? -1.1 : 1.1) * scale, 0.2 * scale, 3.55 * scale);
    tailBoom.name = `boss_tail_boom_${i}`;
    tailBoom.castShadow = true;
    group.add(tailBoom);
  }

  for (let i = 0; i < 2; i++) {
    const tailFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * scale, 0.85 * scale, 1.1 * scale),
      wingMaterial
    );
    tailFin.position.set((i === 0 ? -0.78 : 0.78) * scale, 0.3 * scale, 4.35 * scale);
    tailFin.rotation.z = i === 0 ? 0.12 : -0.12;
    tailFin.name = `boss_tail_fin_${i}`;
    tailFin.castShadow = true;
    group.add(tailFin);
  }

  const bossGroup = group as BossGroup;
  bossGroup.bossParts = parts;
  bossGroup.engineMeshes = engineMeshes;
  bossGroup.engineRingMeshes = engineRingMeshes;
  bossGroup.weakpointMeshes = weakpointMeshes;
  bossGroup.muzzleMeshes = muzzleMeshes;
  group.name = `BOSS_${config.type}`;
  return group;
}
