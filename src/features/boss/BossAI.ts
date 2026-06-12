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
  signalBeaconMeshes?: THREE.Mesh[];
  rotorMeshes?: THREE.Mesh[];
};

/**
 * Boss AI - 第一关重型轰炸机
 * - 绕大圈飞行
 * - 四门重炮轮流发射
 * - 导弹发射器定期发射追踪导弹
 */
export class BossAI {
  private static readonly CRITICAL_HEALTH_THRESHOLD = 0.24;
  private static readonly TERMINAL_HEALTH_THRESHOLD = 0.16;
  private static readonly HIT_FLASH_DURATION = 0.2;
  private static readonly WEAKPOINT_PULSE_SPEED = 3.2;
  private static readonly WEAPON_PULSE_SPEED = 9.6;
  private static readonly ENERGY_PULSE_SPEED = 7.8;
  private static readonly CRITICAL_PULSE_SPEED = 13.2;
  private static readonly TERMINAL_PULSE_SPEED = 20.5;
  private static readonly BEACON_PULSE_SPEED = 2.4;
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private trail: ParticleTrailRenderer;
  private missileSystem: BossMissileSystem;
  private readonly weakpointMeshes: THREE.Mesh[];
  private readonly muzzleMeshes: THREE.Mesh[];
  private readonly engineMeshes: THREE.Mesh[];
  private readonly engineRingMeshes: THREE.Mesh[];
  private readonly signalBeaconMeshes: THREE.Mesh[];
  private readonly rotorMeshes: THREE.Mesh[];
  private readonly weakpointBaseColor = new THREE.Color(0xff6a3a);
  private readonly weakpointCriticalColor = new THREE.Color(0xffb67a);
  private readonly weaponBaseColor = new THREE.Color(0xff924f);
  private readonly weaponCriticalColor = new THREE.Color(0xffd896);
  private readonly energyBaseColor = new THREE.Color(0x54d4ff);
  private readonly energyCriticalColor = new THREE.Color(0x93ecff);
  private readonly terminalColor = new THREE.Color(0xff321a);
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
    this.signalBeaconMeshes = bossGroup.signalBeaconMeshes ?? [];
    this.rotorMeshes = bossGroup.rotorMeshes ?? [];

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

    // 更新尾迹（机尾位于 -Z，机体沿 +Z 方向飞行）
    const engineLocalPos = new THREE.Vector3(0, 0.2 * this.config.scale, -7.0 * this.config.scale);
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
    const criticalState = THREE.MathUtils.clamp(
      (BossAI.CRITICAL_HEALTH_THRESHOLD - healthRatio) / BossAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (BossAI.TERMINAL_HEALTH_THRESHOLD - healthRatio) / BossAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const speedRatio = Math.max(
      0.25,
      Math.min(1.2, this.velocity.length() / Math.max(this.config.speed, 0.001))
    );
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - deltaTime);
    const damageFlash =
      this.damageFlashTimer > 0 ? this.damageFlashTimer / BossAI.HIT_FLASH_DURATION : 0;
    const weakpointWave = Math.sin(this.visualPulseTime * BossAI.WEAKPOINT_PULSE_SPEED) * 0.5 + 0.5;
    const engineWave = Math.sin(this.visualPulseTime * BossAI.ENERGY_PULSE_SPEED) * 0.5 + 0.5;
    const terminalPulseBias = terminalState * terminalState;
    const terminalWarningBias = Math.sqrt(terminalPulseBias);
    const criticalBias = criticalState * criticalState;
    const phaseSeparationBias = 1 + terminalState * 0.85 + criticalState * 0.35;
    const hitPhaseMix = damageFlash * 0.9 + terminalWarningBias * 0.45;
    const criticalPulse =
      (Math.sin(this.visualPulseTime * BossAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5) * criticalState;
    const terminalPulse =
      (Math.sin(this.visualPulseTime * BossAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5) * terminalState;

    for (const mesh of this.weakpointMeshes) {
      this.setGlowState(
        mesh,
        1.15 +
          weakpointWave * 0.95 +
          missileCharge * 0.35 +
          criticalPulse * 1.1 +
          terminalPulse * 1.4 +
          hitPhaseMix * 1.3,
        this.weakpointBaseColor
          .clone()
          .lerp(
            this.weakpointCriticalColor,
            criticalState + criticalPulse * 0.35 + criticalBias * 0.2
          )
          .lerp(
            this.terminalColor,
            terminalState * 0.8 + terminalPulse * 0.3 + terminalPulseBias * 0.2
          )
      );
      const pulseScale =
        1 +
        weakpointWave * 0.08 * phaseSeparationBias +
        criticalPulse * 0.09 +
        terminalPulse * 0.11 +
        damageFlash * 0.09 +
        terminalWarningBias * 0.07;
      mesh.scale.setScalar(pulseScale);
    }

    const activeMuzzleIndex = this.getCurrentMuzzleIndex();
    for (let i = 0; i < this.muzzleMeshes.length; i++) {
      const activeBoost =
        i === activeMuzzleIndex ? 0.75 + cannonCharge * 1.4 : 0.25 + cannonCharge * 0.35;
      this.setGlowState(
        this.muzzleMeshes[i],
        0.45 +
          activeBoost +
          (Math.sin(this.visualPulseTime * BossAI.WEAPON_PULSE_SPEED + i) * 0.5 + 0.5) * 0.2 +
          criticalPulse * 0.75 +
          terminalPulse * 1.05 +
          hitPhaseMix * 0.35,
        this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + criticalBias * 0.2 + criticalPulse * 0.25)
          .lerp(
            this.terminalColor,
            terminalState * 0.7 + terminalPulse * 0.3 + terminalPulseBias * 0.2
          )
      );
    }

    for (const mesh of this.engineMeshes) {
      this.setMaterialOpacity(
        mesh,
        0.5 +
          engineWave * 0.28 * speedRatio +
          cannonCharge * 0.08 +
          terminalPulse * 0.16 +
          hitPhaseMix * 0.05 +
          terminalWarningBias * 0.04
      );
    }

    for (const ring of this.engineRingMeshes) {
      this.setGlowState(
        ring,
        0.8 +
          engineWave * 0.9 * speedRatio +
          missileCharge * 0.3 +
          criticalPulse * 0.8 +
          terminalPulse * 1.2 +
          hitPhaseMix * 0.55,
        this.energyBaseColor
          .clone()
          .lerp(
            this.energyCriticalColor,
            criticalState + criticalPulse * 0.45 + criticalBias * 0.25
          )
          .lerp(
            this.terminalColor,
            terminalState * 0.52 + terminalPulse * 0.38 + terminalPulseBias * 0.18
          )
      );
      const ringScale =
        1 +
        criticalPulse * 0.08 +
        terminalPulse * 0.09 +
        damageFlash * 0.07 +
        terminalWarningBias * 0.06;
      ring.scale.setScalar(ringScale);
    }

    // 信号灯（警示信标）缓慢脉冲
    const beaconWave = Math.sin(this.visualPulseTime * BossAI.BEACON_PULSE_SPEED) * 0.5 + 0.5;
    for (const beacon of this.signalBeaconMeshes) {
      this.setMaterialOpacity(beacon, 0.3 + beaconWave * 0.7);
    }

    // 发动机进气风扇旋转（速度随飞行速度变化）
    const rotorSpeed = 14 + speedRatio * 10;
    for (const rotor of this.rotorMeshes) {
      rotor.rotation.z += deltaTime * rotorSpeed;
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
    this.damageFlashTimer = BossAI.HIT_FLASH_DURATION;
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
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => m.dispose());
          } else if (node.material instanceof THREE.Material) {
            node.material.dispose();
          }
        }
      });
    }
  }
}

/**
 * 创建 Boss 专用模型
 * 重型轰炸机 Boss —— 战略轰炸机重制版
 * 机体朝向: 机头 +Z（AI 通过 lookAt 使 +Z 对准航向），上方向 +Y
 * 结构: 长加压机身 + 高置后掠主翼 + 6 台吊舱发动机（带旋转风扇）+
 *       防御炮塔群（翼根/背部/腹部球塔/尾炮）+ 开放弹舱 + 完整尾翼组
 */
export function createBossMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];
  const weakpointMeshes: THREE.Mesh[] = [];
  const muzzleMeshes: THREE.Mesh[] = [];
  const signalBeaconMeshes: THREE.Mesh[] = [];
  const engineMeshes: THREE.Mesh[] = [];
  const engineRingMeshes: THREE.Mesh[] = [];
  const rotorMeshes: THREE.Mesh[] = [];

  // ===== 几何构造辅助（尺寸单位：未缩放的设计单位）=====
  const box = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w * scale, h * scale, d * scale);
  const cyl = (rTop: number, rBottom: number, h: number, seg = 10) =>
    new THREE.CylinderGeometry(rTop * scale, rBottom * scale, h * scale, seg);
  const cone = (r: number, h: number, seg = 10) =>
    new THREE.ConeGeometry(r * scale, h * scale, seg);
  const ball = (r: number, seg = 10) => new THREE.SphereGeometry(r * scale, seg, seg);
  const ring = (r: number, tube: number, radSeg = 8, tubSeg = 18) =>
    new THREE.TorusGeometry(r * scale, tube * scale, radSeg, tubSeg);

  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    x: number,
    y: number,
    z: number,
    options: { rx?: number; ry?: number; rz?: number; collide?: boolean; shadow?: boolean } = {}
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * scale, y * scale, z * scale);
    if (options.rx !== undefined) mesh.rotation.x = options.rx;
    if (options.ry !== undefined) mesh.rotation.y = options.ry;
    if (options.rz !== undefined) mesh.rotation.z = options.rz;
    mesh.name = name;
    mesh.castShadow = options.shadow !== false;
    group.add(mesh);
    if (options.collide) parts.push(mesh);
    return mesh;
  };

  // ===== 材质（保持冷灰蓝战略轰炸机涂装基调）=====
  const fuselageMaterial = new THREE.MeshStandardMaterial({
    color: 0xaebcca,
    metalness: 0.62,
    roughness: 0.28,
    emissive: 0x2d3946,
    emissiveIntensity: 0.18,
  });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xc4cfd8,
    metalness: 0.56,
    roughness: 0.26,
    emissive: 0x303b49,
    emissiveIntensity: 0.16,
  });
  const bellyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xaebcca).offsetHSL(0, 0.02, -0.12),
    metalness: 0.6,
    roughness: 0.34,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xcd7458,
    metalness: 0.78,
    roughness: 0.22,
    emissive: 0x7a3527,
    emissiveIntensity: 0.4,
  });
  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x758392,
    metalness: 0.84,
    roughness: 0.18,
    emissive: 0x293440,
    emissiveIntensity: 0.24,
  });
  const weaponMaterial = new THREE.MeshStandardMaterial({
    color: 0x49545f,
    metalness: 0.88,
    roughness: 0.18,
    emissive: 0x1c242c,
    emissiveIntensity: 0.22,
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9e2e9,
    metalness: 0.68,
    roughness: 0.2,
    emissive: 0x30414e,
    emissiveIntensity: 0.16,
  });
  const panelBandMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xaebcca).offsetHSL(0, 0.04, -0.16),
    metalness: 0.64,
    roughness: 0.3,
  });
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xc4cfd8).offsetHSL(0, 0.03, -0.14),
    metalness: 0.66,
    roughness: 0.26,
  });
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: 0x82bfeb,
    metalness: 0.6,
    roughness: 0.1,
    emissive: 0x2870a8,
    emissiveIntensity: 0.42,
    transparent: true,
    opacity: 0.78,
  });
  const windowStripMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fd4ef,
    emissive: 0x2e7fb8,
    emissiveIntensity: 0.85,
    metalness: 0.6,
    roughness: 0.1,
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff5533,
    emissive: 0xff3300,
    emissiveIntensity: 1.4,
    metalness: 0.4,
    roughness: 0.2,
  });
  const ringGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x54d4ff,
    emissive: 0x22b8ff,
    emissiveIntensity: 1.0,
    metalness: 0.45,
    roughness: 0.16,
  });
  const exhaustMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.9,
  });
  const rotorBladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a444e,
    metalness: 0.82,
    roughness: 0.3,
  });
  const runningLightRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const runningLightGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x2aff5a });
  const tailLightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4d8 });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb030,
    transparent: true,
    opacity: 0.85,
  });

  // ===== 机身（机头 +Z）=====
  const body = add(cyl(1.15, 1.15, 10, 14), fuselageMaterial, 'boss_body', 0, 0, 0.5, {
    rx: Math.PI / 2,
    collide: true,
  });
  body.castShadow = true;

  // 前段收束 + 防眩光机头锥
  add(cyl(0.88, 1.15, 2.6, 14), fuselageMaterial, 'boss_fore_fuselage', 0, 0, 6.8, {
    rx: Math.PI / 2,
  });
  add(cone(0.88, 1.9, 14), accentMaterial, 'boss_nose', 0, 0, 9.05, {
    rx: Math.PI / 2,
    collide: true,
  });

  // 领航员观察舱玻璃（机头温室式玻璃带）
  const noseGlazing = add(ball(0.84, 12), canopyMaterial, 'boss_nose_glazing', 0, 0.05, 8.15);
  noseGlazing.scale.set(1, 0.9, 1.45);
  for (let i = 0; i < 3; i++) {
    add(box(0.06, 1.0, 1.7), detailMaterial, `boss_nose_frame_${i}`, -0.45 + i * 0.45, 0.25, 8.2, {
      shadow: false,
    });
  }

  // 机头弱点传感球（下颌雷达罩）
  const noseWeakpoint = add(ball(0.48, 12), glowMaterial, 'boss_nose_weakpoint', 0, -0.5, 8.5, {
    shadow: false,
  });
  weakpointMeshes.push(noseWeakpoint);
  add(ball(0.55, 10), turretMaterial, 'boss_chin_radome', 0, -0.92, 7.3);

  // 驾驶舱（抬升的飞行甲板）
  const cockpit = add(ball(0.62, 12), canopyMaterial, 'boss_cockpit', 0, 0.92, 5.5, {
    collide: true,
  });
  cockpit.scale.set(1, 0.62, 1.55);
  const cockpitFrame = add(
    ring(0.66, 0.07, 8, 18),
    panelMaterial,
    'boss_cockpit_frame',
    0,
    0.92,
    5.5,
    { ry: Math.PI / 2 }
  );
  cockpitFrame.scale.set(1.05, 0.68, 1.5);

  // 驾驶舱侧舷窗发光条
  for (let i = 0; i < 2; i++) {
    add(
      box(0.06, 0.18, 1.1),
      windowStripMaterial,
      `boss_bridge_window_strip_${i}`,
      i === 0 ? -0.7 : 0.7,
      0.62,
      5.4,
      { shadow: false }
    );
  }

  // 背脊与背部装甲
  add(box(0.92, 0.34, 8.6), panelMaterial, 'boss_spine', 0, 1.1, 0.4);
  add(box(1.55, 0.24, 5.2), wingMaterial, 'boss_dorsal_armor', 0, 1.28, 0.2);
  for (let i = 0; i < 4; i++) {
    add(box(1.9, 0.1, 0.2), detailMaterial, `boss_spine_rib_${i}`, 0, 1.42, -2.2 + i * 1.6);
  }

  // 机身环形蒙皮接缝带
  const bandGeometry = new THREE.CylinderGeometry(
    1.18 * scale,
    1.18 * scale,
    0.14 * scale,
    14,
    1,
    true
  );
  [-3.2, -0.9, 1.5, 3.6].forEach((z, i) => {
    add(bandGeometry, panelBandMaterial, `boss_panel_band_${i}`, 0, 0, z, {
      rx: Math.PI / 2,
      shadow: false,
    });
  });

  // 腹部整流与龙骨
  add(box(1.62, 0.5, 6.2), bellyMaterial, 'boss_ventral_hull', 0, -1.0, 1.2, { collide: true });
  add(box(0.6, 0.34, 3.0), panelBandMaterial, 'boss_ventral_keel', 0, -1.32, 3.0);

  // 机身侧面突出舱（设备短舱）
  for (let i = 0; i < 2; i++) {
    const sideSign = i === 0 ? -1 : 1;
    add(
      box(0.5, 0.8, 3.0),
      fuselageMaterial,
      `boss_side_sponson_${i}`,
      sideSign * 1.28,
      -0.1,
      2.4,
      {
        collide: true,
      }
    );
    add(
      box(0.14, 0.5, 2.2),
      detailMaterial,
      `boss_side_sponson_trim_${i}`,
      sideSign * 1.56,
      -0.1,
      2.4
    );
  }

  // ===== 开放式弹舱（腹部，含挂载弹药）=====
  add(box(1.5, 0.32, 3.4), weaponMaterial, 'boss_bomb_bay_recess', 0, -1.22, -1.2);
  const bayCore = add(box(1.2, 0.1, 3.0), glowMaterial, 'boss_bomb_bay_core', 0, -1.4, -1.2, {
    shadow: false,
  });
  weakpointMeshes.push(bayCore);
  for (let i = 0; i < 2; i++) {
    const sideSign = i === 0 ? -1 : 1;
    add(
      box(0.1, 0.85, 3.4),
      bellyMaterial,
      `boss_bomb_bay_door_${i}`,
      sideSign * 1.05,
      -1.62,
      -1.2,
      {
        rz: sideSign * 0.72,
      }
    );
  }
  const bombGeometry = cyl(0.15, 0.15, 0.92, 8);
  const bombTipGeometry = cone(0.15, 0.3, 8);
  const bombFinGeometry = box(0.5, 0.06, 0.24);
  const bombSpots = [
    { x: -0.38, z: -2.4 },
    { x: -0.38, z: -1.2 },
    { x: -0.38, z: 0.0 },
    { x: 0.38, z: -2.4 },
    { x: 0.38, z: -1.2 },
    { x: 0.38, z: 0.0 },
  ];
  bombSpots.forEach((spot, i) => {
    add(bombGeometry, weaponMaterial, `boss_bomb_${i}`, spot.x, -1.62, spot.z, {
      rx: Math.PI / 2,
    });
    add(bombTipGeometry, accentMaterial, `boss_bomb_tip_${i}`, spot.x, -1.62, spot.z + 0.6, {
      rx: Math.PI / 2,
    });
    add(bombFinGeometry, detailMaterial, `boss_bomb_fin_${i}`, spot.x, -1.62, spot.z - 0.42, {
      shadow: false,
    });
  });

  // ===== 高置后掠主翼（左右各带 3 台吊舱发动机）=====
  const wingGeometry = box(12.5, 0.3, 3.6);
  const wingSweep = 0.42;

  const leftWing = add(wingGeometry, wingMaterial, 'boss_left_wing', -6.9, 0.85, -0.4, {
    ry: -wingSweep,
    rz: 0.045,
    collide: true,
  });
  const rightWing = add(wingGeometry, wingMaterial, 'boss_right_wing', 6.9, 0.85, -0.4, {
    ry: wingSweep,
    rz: -0.045,
    collide: true,
  });
  leftWing.castShadow = true;
  rightWing.castShadow = true;

  // 翼根整流罩
  const wingRootGeometry = box(2.8, 0.6, 3.6);
  add(wingRootGeometry, fuselageMaterial, 'boss_left_wing_root', -1.95, 0.72, 0.4, {
    ry: -wingSweep * 0.5,
    collide: true,
  });
  add(wingRootGeometry, fuselageMaterial, 'boss_right_wing_root', 1.95, 0.72, 0.4, {
    ry: wingSweep * 0.5,
    collide: true,
  });

  // 沿翼展方向的位置计算（含后掠：外侧越远越靠后）
  const wingPoint = (side: -1 | 1, outboard: number) => ({
    x: side * (6.9 + 0.913 * outboard),
    z: -0.4 - 0.408 * outboard,
  });

  // 翼面检修板带
  const wingPanelGeometry = box(2.0, 0.1, 1.0);
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 3; i++) {
      const p = wingPoint(side, -2.6 + i * 2.2);
      add(
        wingPanelGeometry,
        detailMaterial,
        `boss_wing_panel_${side < 0 ? 'left' : 'right'}_${i}`,
        p.x,
        0.95,
        p.z - 0.7,
        { ry: side * wingSweep, shadow: false }
      );
    }
  }

  // 6 台吊舱发动机（每侧 3 台：短舱 + 挂架 + 进气环 + 旋转风扇 + 尾喷）
  const nacelleGeometry = cyl(0.52, 0.44, 2.3, 10);
  const pylonGeometry = box(0.18, 0.55, 1.5);
  const intakeRingGeometry = ring(0.5, 0.1, 8, 18);
  const fanBladeGeometry = box(0.8, 0.13, 0.05);
  const exhaustGeometry = cyl(0.3, 0.4, 0.55, 10);
  let nacelleIndex = 0;
  for (const side of [-1, 1] as const) {
    for (const outboard of [-3.2, -0.8, 1.6]) {
      const p = wingPoint(side, outboard);
      add(
        nacelleGeometry,
        turretMaterial,
        `boss_engine_nacelle_${nacelleIndex}`,
        p.x,
        0.26,
        p.z + 0.25,
        {
          rx: Math.PI / 2,
          collide: true,
        }
      );
      add(pylonGeometry, wingMaterial, `boss_engine_pylon_${nacelleIndex}`, p.x, 0.6, p.z);

      const intakeRing = add(
        intakeRingGeometry,
        ringGlowMaterial,
        `boss_engine_ring_${nacelleIndex}`,
        p.x,
        0.26,
        p.z + 1.42,
        { shadow: false }
      );
      engineRingMeshes.push(intakeRing);

      for (let blade = 0; blade < 2; blade++) {
        const fan = add(
          fanBladeGeometry,
          rotorBladeMaterial,
          `boss_engine_fan_${nacelleIndex}_${blade}`,
          p.x,
          0.26,
          p.z + 1.3,
          { shadow: false }
        );
        fan.rotation.z = blade * (Math.PI / 2);
        rotorMeshes.push(fan);
      }

      const exhaust = add(
        exhaustGeometry,
        exhaustMaterial,
        `boss_engine_${nacelleIndex}`,
        p.x,
        0.26,
        p.z - 1.1,
        { rx: Math.PI / 2, shadow: false }
      );
      engineMeshes.push(exhaust);
      nacelleIndex++;
    }
  }

  // 翼尖模块与航行灯（左红右绿）
  const tipModuleGeometry = box(1.1, 0.26, 1.1);
  const navLightGeometry = ball(0.16, 8);
  for (const side of [-1, 1] as const) {
    const tip = wingPoint(side, 5.45);
    add(
      tipModuleGeometry,
      weaponMaterial,
      `boss_wingtip_module_${side < 0 ? 'left' : 'right'}`,
      tip.x,
      0.85,
      tip.z,
      {
        ry: side * wingSweep,
      }
    );
    add(
      navLightGeometry,
      side < 0 ? runningLightRedMaterial : runningLightGreenMaterial,
      `boss_running_light_${side < 0 ? 'left' : 'right'}`,
      tip.x + side * 0.35,
      0.95,
      tip.z,
      { shadow: false }
    );
  }

  // ===== 防御炮塔群（保留 4 门重炮锚点：左/右/上/下）=====
  const turretDrumGeometry = cyl(0.36, 0.48, 0.7, 10);
  const turretBarrelGeometry = cyl(0.07, 0.09, 1.5, 8);
  const muzzleGeometry = ball(0.2, 8);

  // 左/右翼下炮塔（吊篮式）
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'left' : 'right';
    const tx = side * 4;
    add(turretDrumGeometry, turretMaterial, `boss_${name}_turret`, tx, 0.4, 0.9, {
      collide: true,
    });
    add(box(0.95, 0.34, 1.0), panelMaterial, `boss_${name}_turret_housing`, tx, 0.66, 0.9);
    for (let b = 0; b < 2; b++) {
      add(
        turretBarrelGeometry,
        weaponMaterial,
        `boss_${name}_turret_barrel_${b}`,
        tx + (b === 0 ? -0.14 : 0.14),
        0.34,
        1.7,
        {
          rx: Math.PI / 2,
        }
      );
    }
    const muzzle = add(
      muzzleGeometry,
      glowMaterial.clone(),
      `boss_${name}_muzzle`,
      tx,
      0.34,
      2.55,
      {
        shadow: false,
      }
    );
    muzzleMeshes.push(muzzle);
  }

  // 背部炮塔（驾驶舱后方）
  add(cyl(0.62, 0.74, 0.26, 12), panelMaterial, 'boss_top_turret_pod', 0, 1.34, 3.2);
  const topTurret = add(ball(0.52, 10), turretMaterial, 'boss_top_turret', 0, 1.5, 3.2, {
    collide: true,
  });
  topTurret.scale.set(1, 0.72, 1);
  for (let b = 0; b < 2; b++) {
    add(
      turretBarrelGeometry,
      weaponMaterial,
      `boss_top_turret_barrel_${b}`,
      b === 0 ? -0.14 : 0.14,
      1.72,
      3.75,
      {
        rx: 1.2,
      }
    );
  }
  const topMuzzle = add(muzzleGeometry, glowMaterial.clone(), 'boss_top_muzzle', 0, 1.92, 4.2, {
    shadow: false,
  });
  muzzleMeshes.push(topMuzzle);

  // 腹部球形炮塔
  add(cyl(0.66, 0.56, 0.26, 12), panelMaterial, 'boss_bottom_turret_pod', 0, -1.3, 1.8);
  add(ball(0.55, 10), turretMaterial, 'boss_bottom_turret', 0, -1.5, 1.8, {
    collide: true,
  });
  for (let b = 0; b < 2; b++) {
    add(
      turretBarrelGeometry,
      weaponMaterial,
      `boss_bottom_turret_barrel_${b}`,
      b === 0 ? -0.14 : 0.14,
      -1.7,
      2.3,
      {
        rx: 1.92,
      }
    );
  }
  const bottomMuzzle = add(
    muzzleGeometry,
    glowMaterial.clone(),
    'boss_bottom_muzzle',
    0,
    -1.92,
    2.7,
    {
      shadow: false,
    }
  );
  muzzleMeshes.push(bottomMuzzle);

  // 尾部防御炮塔（纯视觉）
  add(box(0.85, 0.7, 0.8), turretMaterial, 'boss_tail_turret_housing', 0, 0.05, -7.2);
  const tailGlazing = add(ball(0.4, 10), canopyMaterial, 'boss_tail_gunner_glazing', 0, 0.3, -7.4, {
    shadow: false,
  });
  tailGlazing.scale.set(1, 0.8, 1);
  for (let b = 0; b < 2; b++) {
    add(
      turretBarrelGeometry,
      weaponMaterial,
      `boss_tail_turret_barrel_${b}`,
      b === 0 ? -0.16 : 0.16,
      -0.05,
      -7.9,
      {
        rx: -Math.PI / 2,
      }
    );
  }

  // ===== 尾段与尾翼组 =====
  add(cyl(1.12, 0.4, 2.9, 12), fuselageMaterial, 'boss_tail_cone', 0, 0.12, -5.9, {
    rx: Math.PI / 2,
    collide: true,
  });

  // 水平尾翼（后掠）
  add(box(7.0, 0.18, 1.7), wingMaterial, 'boss_tail', 0, 0.55, -6.2, { collide: true });
  const tailTipGeometry = box(1.5, 0.14, 1.2);
  add(tailTipGeometry, detailMaterial, 'boss_tail_tip_left', -3.9, 0.55, -6.6, { ry: -0.5 });
  add(tailTipGeometry, detailMaterial, 'boss_tail_tip_right', 3.9, 0.55, -6.6, { ry: 0.5 });

  // 垂直尾翼（带前缘斜削与顶帽）
  add(box(0.2, 2.7, 1.9), wingMaterial, 'boss_vtail', 0, 1.75, -6.2, { collide: true });
  add(box(0.18, 1.5, 1.1), panelMaterial, 'boss_vtail_leading_edge', 0, 1.6, -5.3, { rx: 0.5 });
  add(box(0.46, 0.22, 1.4), detailMaterial, 'boss_vtail_cap', 0, 3.05, -6.45);
  add(box(0.1, 1.7, 0.45), accentMaterial, 'boss_rudder_trim', 0, 1.9, -7.15);
  add(navLightGeometry, tailLightMaterial, 'boss_running_light_tail', 0, 3.2, -6.9, {
    shadow: false,
  });

  // ===== 天线与传感器 =====
  const bladeAntennaGeometry = box(0.05, 0.4, 0.5);
  [
    { x: 0.3, z: 4.4 },
    { x: -0.35, z: 2.2 },
    { x: 0.2, z: -1.6 },
  ].forEach((spot, i) => {
    add(bladeAntennaGeometry, detailMaterial, `boss_blade_antenna_${i}`, spot.x, 1.5, spot.z, {
      shadow: false,
    });
  });
  add(cyl(0.03, 0.05, 0.9, 6), detailMaterial, 'boss_wire_mast', 0, 1.85, 4.6, { shadow: false });

  // ===== 警示信标（慢速脉冲）=====
  const beaconGeometry = ball(0.17, 8);
  [
    { x: 0, y: 1.55, z: 0.4 },
    { x: 0, y: -1.42, z: -0.6 },
    { x: 0, y: 3.18, z: -6.0 },
  ].forEach((spot, i) => {
    const beacon = add(
      beaconGeometry,
      beaconMaterial,
      `boss_warning_beacon_${i}`,
      spot.x,
      spot.y,
      spot.z,
      {
        shadow: false,
      }
    );
    signalBeaconMeshes.push(beacon);
  });

  const bossGroup = group as BossGroup;
  bossGroup.bossParts = parts;
  bossGroup.engineMeshes = engineMeshes;
  bossGroup.engineRingMeshes = engineRingMeshes;
  bossGroup.weakpointMeshes = weakpointMeshes;
  bossGroup.muzzleMeshes = muzzleMeshes;
  bossGroup.signalBeaconMeshes = signalBeaconMeshes;
  bossGroup.rotorMeshes = rotorMeshes;
  group.name = `BOSS_${config.type}`;
  return group;
}
