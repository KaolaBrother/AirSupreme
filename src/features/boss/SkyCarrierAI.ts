import * as THREE from 'three';
import { BossConfig } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import { BossMissileSystem } from './BossMissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { EnemyType } from '@/features/enemy/EnemyTypes';

type BossGroup = THREE.Group & {
  bossParts?: THREE.Mesh[];
  weakpointMeshes?: THREE.Mesh[];
  muzzleMeshes?: THREE.Mesh[];
  launcherGlowMeshes?: THREE.Mesh[];
  engineGlowMeshes?: THREE.Mesh[];
};

/**
 * 第五关 Boss - 空中航空母舰
 * - 缓慢追踪玩家（空中飞行）
 * - 两门重炮（左右翼）
 * - 两个导弹发射井
 * - 每 60 秒从仓库口飞出 3 架敌机（除 Scout 以外）
 */
export class SkyCarrierAI {
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private trail: ParticleTrailRenderer;
  private missileSystem: BossMissileSystem;
  private readonly weakpointMeshes: THREE.Mesh[];
  private readonly muzzleMeshes: THREE.Mesh[];
  private readonly launcherGlowMeshes: THREE.Mesh[];
  private readonly engineGlowMeshes: THREE.Mesh[];
  private readonly weakpointBaseColor = new THREE.Color(0xff6f3d);
  private readonly weakpointCriticalColor = new THREE.Color(0xffb97e);
  private readonly weaponBaseColor = new THREE.Color(0xff9552);
  private readonly weaponCriticalColor = new THREE.Color(0xffd99e);
  private readonly energyBaseColor = new THREE.Color(0x57d5ff);
  private readonly energyCriticalColor = new THREE.Color(0x9ceeff);
  private readonly terminalColor = new THREE.Color(0xff331a);
  private visualPulseTime: number = 0;
  private damageFlashTimer: number = 0;

  // 运动系统
  public velocity: THREE.Vector3;

  // 武器系统
  private cannonCooldown: number = 0;
  private currentCannon: number = 0; // 0 = 左翼, 1 = 右翼
  private missileCooldown: number = 0;
  private currentMissileLauncher: number = 0;

  // 敌机起飞
  private fighterSpawnTimer: number = 0;

  private cannonOffsets: THREE.Vector3[] = [
    new THREE.Vector3(-8.5, 4, 0),
    new THREE.Vector3(8.5, 4, 0),
  ];

  private missileLauncherOffsets: THREE.Vector3[] = [
    new THREE.Vector3(-3, 4, 3),
    new THREE.Vector3(3, 4, 3),
  ];

  // 目标引用
  private playerMesh: THREE.Object3D | null = null;
  private friendlyMeshes: THREE.Object3D[] = [];

  // 回调
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onEnemySpawn?: (position: THREE.Vector3, enemyType: EnemyType) => void;

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
    this.launcherGlowMeshes = bossGroup.launcherGlowMeshes ?? [];
    this.engineGlowMeshes = bossGroup.engineGlowMeshes ?? [];

    this.velocity = new THREE.Vector3(0, 0, -config.speed);

    // 初始化导弹冷却时间，避免立即发射
    this.missileCooldown = config.missileFireInterval;

    // 创建尾迹（从两个引擎）
    this.trail = new ParticleTrailRenderer(scene, mesh, 0x4488ff);

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

    // 缓慢追踪玩家
    this.updateMovement(deltaTime, playerMesh);

    // 更新武器冷却
    this.cannonCooldown -= deltaTime;
    this.missileCooldown -= deltaTime;

    // 两门重炮轮流发射
    if (this.cannonCooldown <= 0) {
      this.fireCannon();
      this.cannonCooldown = this.config.cannonFireInterval;
      this.currentCannon = (this.currentCannon + 1) % this.cannonOffsets.length;
    }

    // 导弹发射
    if (this.missileCooldown <= 0) {
      this.fireMissile();
      this.missileCooldown = this.config.missileFireInterval;
    }

    // 敌机起飞
    this.fighterSpawnTimer += deltaTime;
    if (this.fighterSpawnTimer >= 60) {
      this.spawnEnemies();
      this.fighterSpawnTimer = 0;
    }

    // 更新导弹系统
    this.missileSystem.update(deltaTime);
    this.updateVisualPulse(deltaTime);

    // 更新尾迹
    const engineLocalPos = new THREE.Vector3(0, 0, 8);
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
    const engineRatio = Math.max(
      0.25,
      Math.min(1.15, this.velocity.length() / Math.max(this.config.speed, 0.001))
    );
    const healthRatio = this.getHealth().current / this.getHealth().max;
    const criticalState = THREE.MathUtils.clamp((0.24 - healthRatio) / 0.24, 0, 1);
    const terminalState = THREE.MathUtils.clamp((0.16 - healthRatio) / 0.16, 0, 1);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - deltaTime);
    const damageFlash = this.damageFlashTimer > 0 ? this.damageFlashTimer / 0.24 : 0;
    const deckWave = Math.sin(this.visualPulseTime * 2.2) * 0.5 + 0.5;
    const engineWave = Math.sin(this.visualPulseTime * 8.5) * 0.5 + 0.5;
    const criticalPulse = (Math.sin(this.visualPulseTime * 12.5) * 0.5 + 0.5) * criticalState;
    const terminalPulse = (Math.sin(this.visualPulseTime * 21) * 0.5 + 0.5) * terminalState;

    for (const mesh of this.weakpointMeshes) {
      this.setEmissiveState(
        mesh,
        0.85 +
          deckWave * 0.95 +
          missileCharge * 0.45 +
          criticalPulse * 0.8 +
          terminalPulse * 1.15 +
          damageFlash * 1.45,
        this.weakpointBaseColor
          .clone()
          .lerp(this.weakpointCriticalColor, criticalState + criticalPulse * 0.35)
          .lerp(this.terminalColor, terminalState * 0.65 + terminalPulse * 0.35)
      );
      if (mesh.name === 'carrier_deck_core_glow') {
        mesh.scale.z = 1 + deckWave * 0.12 + terminalPulse * 0.08 + damageFlash * 0.08;
      }
    }

    for (let i = 0; i < this.muzzleMeshes.length; i++) {
      const activeBoost = i === this.currentCannon ? 0.75 + cannonCharge * 1.4 : 0.2 + cannonCharge * 0.25;
      this.setEmissiveState(
        this.muzzleMeshes[i],
        0.45 +
          activeBoost +
          (Math.sin(this.visualPulseTime * 12 + i) * 0.5 + 0.5) * 0.18 +
          criticalPulse * 0.75 +
          terminalPulse * 0.95 +
          damageFlash * 0.95,
        this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + criticalPulse * 0.25)
          .lerp(this.terminalColor, terminalState * 0.55 + terminalPulse * 0.3)
      );
    }

    for (const mesh of this.launcherGlowMeshes) {
      this.setEmissiveState(
        mesh,
        0.7 +
          missileCharge * 1.1 +
          deckWave * 0.35 +
          criticalPulse * 0.7 +
          terminalPulse * 0.9 +
          damageFlash * 0.95,
        this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + missileCharge * 0.2)
          .lerp(this.terminalColor, terminalState * 0.5 + terminalPulse * 0.3)
      );
      const flashScale = 1 + terminalPulse * 0.05 + damageFlash * 0.07;
      mesh.scale.setScalar(flashScale);
    }

    for (const mesh of this.engineGlowMeshes) {
      this.setEmissiveState(
        mesh,
        0.95 +
          engineWave * 1.1 * engineRatio +
          criticalPulse * 0.6 +
          terminalPulse * 0.8 +
          damageFlash * 0.8,
        this.energyBaseColor
          .clone()
          .lerp(this.energyCriticalColor, criticalState + criticalPulse * 0.2)
          .lerp(this.terminalColor, terminalState * 0.3 + terminalPulse * 0.2)
      );
      mesh.scale.x = 1 + engineWave * 0.08 + terminalPulse * 0.04 + damageFlash * 0.04;
      mesh.scale.z = 1 + engineWave * 0.08 + terminalPulse * 0.04 + damageFlash * 0.04;
    }
  }

  private setEmissiveState(mesh: THREE.Mesh, intensity: number, color?: THREE.Color): void {
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissiveIntensity = intensity;
      if (color) {
        mesh.material.emissive.copy(color);
        mesh.material.color.copy(color);
      }
    }
  }

  private updateMovement(deltaTime: number, playerMesh: THREE.Object3D | null): void {
    if (!playerMesh) return;

    // 追踪玩家的 XZ 位置，保持一定高度
    const targetX = playerMesh.position.x;
    const targetY = 200; // 保持在高空
    const targetZ = playerMesh.position.z + 100; // 在玩家前方一定距离

    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);

    // 计算方向并转向
    const targetDirection = new THREE.Vector3()
      .subVectors(targetPos, this.mesh.position)
      .normalize();

    const currentDirection = this.velocity.clone().normalize();
    const turnAngle = this.config.turnSpeed * deltaTime;

    // 使用四元数进行平滑转向
    const targetRotation = Math.atan2(targetDirection.x, targetDirection.z);
    const currentRotation = Math.atan2(currentDirection.x, currentDirection.z);

    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    rotationDiff = Math.max(-turnAngle, Math.min(turnAngle, rotationDiff));

    const newRotation = currentRotation + rotationDiff;
    this.velocity.set(
      Math.sin(newRotation) * this.config.speed,
      (targetY - this.mesh.position.y) * 0.05, // 缓慢调整高度
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
    cannonOffset.multiplyScalar(this.config.scale);
    cannonOffset.applyQuaternion(this.mesh.quaternion);
    const firePosition = this.mesh.position.clone().add(cannonOffset);

    const targetPosition = this.findNearestThreat();

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

    const launcherOffset = this.missileLauncherOffsets[this.currentMissileLauncher].clone();
    launcherOffset.multiplyScalar(this.config.scale);
    launcherOffset.applyQuaternion(this.mesh.quaternion);
    const missilePosition = this.mesh.position.clone().add(launcherOffset);

    this.currentMissileLauncher =
      (this.currentMissileLauncher + 1) % this.missileLauncherOffsets.length;

    this.missileSystem.fire(
      missilePosition,
      target,
      this.friendlyMeshes,
      this.playerMesh,
      targetingPlayer
    );
    this.onMissileFired?.();
  }

  private spawnEnemies(): void {
    const availableTypes = [EnemyType.FIGHTER, EnemyType.HEAVY, EnemyType.ACE];

    const hangarOffset = new THREE.Vector3(0, 0, 7);
    hangarOffset.multiplyScalar(this.config.scale);
    hangarOffset.applyQuaternion(this.mesh.quaternion);
    const hangarPosition = this.mesh.position.clone().add(hangarOffset);

    for (let i = 0; i < 3; i++) {
      const enemyType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

      const spawnOffset = new THREE.Vector3((i - 1) * 5, -2, i * 3);
      const spawnPosition = hangarPosition.clone().add(spawnOffset);

      this.onEnemySpawn?.(spawnPosition, enemyType);
    }
  }

  public getMissileSystem(): BossMissileSystem {
    return this.missileSystem;
  }

  public takeDamage(damage: number): void {
    this.health.takeDamage(damage);
    this.damageFlashTimer = 0.24;
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

  public getCollisionParts(): THREE.Object3D[] {
    const parts = (this.mesh as BossGroup).bossParts;
    if (!parts) return [this.mesh];
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
 * 创建空中航空母舰模型
 * 大型飞行航母，有机库、跑道、控制塔
 * 飞机前进方向: -Z，上方向: +Y
 */
export function createSkyCarrierMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];
  const weakpointMeshes: THREE.Mesh[] = [];
  const muzzleMeshes: THREE.Mesh[] = [];
  const launcherGlowMeshes: THREE.Mesh[] = [];
  const engineGlowMeshes: THREE.Mesh[] = [];

  // 材质定义
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x70839a,
    metalness: 0.66,
    roughness: 0.18,
    emissive: 0x2c4f6e,
    emissiveIntensity: 0.25,
  });

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x90a3b8,
    metalness: 0.46,
    roughness: 0.22,
    emissive: 0x325574,
    emissiveIntensity: 0.22,
  });

  const superstructureMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8c7d5,
    metalness: 0.54,
    roughness: 0.18,
    emissive: 0x3b5c78,
    emissiveIntensity: 0.24,
  });

  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x76899d,
    metalness: 0.84,
    roughness: 0.14,
    emissive: 0x35526e,
    emissiveIntensity: 0.22,
  });

  const missileLauncherMaterial = new THREE.MeshStandardMaterial({
    color: 0x8298af,
    metalness: 0.7,
    roughness: 0.12,
    emissive: 0x3b5d7b,
    emissiveIntensity: 0.23,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.1,
  });

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x66c8ff,
    emissive: 0x22aaff,
    emissiveIntensity: 1.2,
    metalness: 0.45,
    roughness: 0.15,
  });

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    metalness: 0.74,
    roughness: 0.12,
    emissive: 0x4a6784,
    emissiveIntensity: 0.22,
  });

  // 主船体 - 扁平的长方体
  const hullLength = 30;
  const hullWidth = 10;
  const hullHeight = 3;

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale, hullHeight * scale, hullWidth * scale),
    hullMaterial
  );
  hull.position.set(0, 0, 0);
  hull.name = 'carrier_hull';
  hull.castShadow = true;
  group.add(hull);
  parts.push(hull);

  const hullSpine = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.78, 0.35 * scale, 1.4 * scale),
    trimMaterial
  );
  hullSpine.position.set(0, 0.4 * scale, 0);
  hullSpine.name = 'carrier_hull_spine';
  hullSpine.castShadow = true;
  group.add(hullSpine);

  const keel = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.66, 1.8 * scale, hullWidth * scale * 0.4),
    hullMaterial
  );
  keel.position.set(0, -1.9 * scale, 0);
  keel.name = 'carrier_keel';
  keel.castShadow = true;
  group.add(keel);
  parts.push(keel);

  const keelCore = new THREE.Mesh(
    new THREE.BoxGeometry(8 * scale, 0.45 * scale, 1.8 * scale),
    glowMaterial
  );
  keelCore.position.set(0, -2.95 * scale, 0);
  keelCore.name = 'carrier_keel_core';
  group.add(keelCore);
  weakpointMeshes.push(keelCore);

  // 下层船体分层与侧向装甲，强化终局 Boss 轮廓
  const undersideHull = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.54, 1.1 * scale, hullWidth * scale * 0.52),
    hullMaterial
  );
  undersideHull.position.set(0, -2.65 * scale, 0);
  undersideHull.name = 'carrier_underside_hull';
  undersideHull.castShadow = true;
  group.add(undersideHull);
  parts.push(undersideHull);

  for (const side of [-1, 1] as const) {
    const chine = new THREE.Mesh(
      new THREE.BoxGeometry(hullLength * scale * 0.72, 0.28 * scale, 0.38 * scale),
      trimMaterial
    );
    chine.position.set(0, -1.45 * scale, side * 4.55 * scale);
    chine.name = `carrier_chine_${side < 0 ? 'left' : 'right'}`;
    chine.castShadow = true;
    group.add(chine);
  }

  const sideSponsonOffsets = [-1, 1] as const;
  sideSponsonOffsets.forEach((direction) => {
    const sideSponson = new THREE.Mesh(
      new THREE.BoxGeometry(11.5 * scale, 1.6 * scale, 2.2 * scale),
      superstructureMaterial
    );
    sideSponson.position.set(1.5 * scale, -0.5 * scale, direction * 6.2 * scale);
    sideSponson.name = `carrier_side_sponson_${direction < 0 ? 'left' : 'right'}`;
    sideSponson.castShadow = true;
    group.add(sideSponson);
    parts.push(sideSponson);

    const sideArmor = new THREE.Mesh(
      new THREE.BoxGeometry(9.5 * scale, 0.35 * scale, 2.5 * scale),
      trimMaterial
    );
    sideArmor.position.set(1.5 * scale, 0.55 * scale, direction * 6.35 * scale);
    sideArmor.name = `carrier_side_armor_${direction < 0 ? 'left' : 'right'}`;
    sideArmor.castShadow = true;
    group.add(sideArmor);

    const sideBay = new THREE.Mesh(
      new THREE.BoxGeometry(4.2 * scale, 1.2 * scale, 0.32 * scale),
      accentMaterial
    );
    sideBay.position.set(-1.8 * scale, -0.55 * scale, direction * 7.38 * scale);
    sideBay.name = `carrier_hangar_bay_${direction < 0 ? 'left' : 'right'}`;
    group.add(sideBay);
    weakpointMeshes.push(sideBay);

    const weaponPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85 * scale, 0.85 * scale, 2.8 * scale, 10),
      missileLauncherMaterial
    );
    weaponPod.rotation.x = Math.PI / 2;
    weaponPod.position.set(4.8 * scale, -0.8 * scale, direction * 7.25 * scale);
    weaponPod.name = `carrier_weapon_pod_${direction < 0 ? 'left' : 'right'}`;
    weaponPod.castShadow = true;
    group.add(weaponPod);
    parts.push(weaponPod);
  });

  // 舰首 - 圆锥形
  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(hullWidth * scale * 0.5, 5 * scale, 4),
    hullMaterial
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(-(hullLength * 0.5 + 2) * scale, 0, 0);
  bow.name = 'carrier_bow';
  bow.castShadow = true;
  group.add(bow);
  parts.push(bow);

  // 飞行甲板
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.9, 0.5 * scale, hullWidth * scale * 0.9),
    deckMaterial
  );
  deck.position.set(0, (hullHeight * 0.5 + 0.25) * scale, 0);
  deck.name = 'carrier_deck';
  deck.castShadow = true;
  group.add(deck);
  parts.push(deck);

  const deckCore = new THREE.Mesh(
    new THREE.BoxGeometry(10 * scale, 0.18 * scale, 1.4 * scale),
    glowMaterial
  );
  deckCore.position.set(0, (hullHeight * 0.5 + 0.62) * scale, 0);
  deckCore.name = 'carrier_deck_core_glow';
  group.add(deckCore);
  weakpointMeshes.push(deckCore);

  for (let i = 0; i < 4; i++) {
    const module = new THREE.Mesh(
      new THREE.BoxGeometry(3.2 * scale, 0.45 * scale, 1.5 * scale),
      missileLauncherMaterial
    );
    module.position.set((-8.5 + i * 5.6) * scale, (hullHeight * 0.5 + 0.62) * scale, 3.15 * scale);
    module.name = `carrier_deck_module_${i}`;
    module.castShadow = true;
    group.add(module);
    parts.push(module);

    const moduleCap = new THREE.Mesh(
      new THREE.BoxGeometry(1.45 * scale, 0.28 * scale, 0.9 * scale),
      trimMaterial
    );
    moduleCap.position.set(
      (-8.5 + i * 5.6) * scale,
      (hullHeight * 0.5 + 0.95) * scale,
      3.2 * scale
    );
    moduleCap.name = `carrier_deck_module_cap_${i}`;
    group.add(moduleCap);
  }

  for (let i = 0; i < 4; i++) {
    const catapult = new THREE.Mesh(
      new THREE.BoxGeometry(2.4 * scale, 0.18 * scale, 0.42 * scale),
      trimMaterial
    );
    catapult.position.set((-9 + i * 6) * scale, (hullHeight * 0.5 + 0.72) * scale, -2.4 * scale);
    catapult.name = `carrier_catapult_rail_${i}`;
    group.add(catapult);
  }

  // 甲板中轴附加模块，增强从远景可辨识度
  for (let i = 0; i < 3; i++) {
    const spineModule = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 * scale, 0.42 * scale, 1.2 * scale),
      superstructureMaterial
    );
    spineModule.position.set((-4 + i * 4) * scale, (hullHeight * 0.5 + 0.92) * scale, -0.15 * scale);
    spineModule.name = `carrier_spine_module_${i}`;
    spineModule.castShadow = true;
    group.add(spineModule);
  }

  // 跑道标线
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(2 * scale, 0.1 * scale, 0.3 * scale),
      new THREE.MeshBasicMaterial({ color: 0xeaf4ff })
    );
    line.position.set((-10 + i * 5) * scale, (hullHeight * 0.5 + 0.55) * scale, 0);
    line.name = `carrier_runway_line_${i}`;
    group.add(line);
  }

  // 岛式上层建筑（控制塔）
  const island = new THREE.Mesh(
    new THREE.BoxGeometry(4 * scale, 6 * scale, 4 * scale),
    superstructureMaterial
  );
  island.position.set(8 * scale, (hullHeight * 0.5 + 3) * scale, -2 * scale);
  island.name = 'carrier_island';
  island.castShadow = true;
  group.add(island);
  parts.push(island);

  const islandBase = new THREE.Mesh(
    new THREE.BoxGeometry(5.6 * scale, 1.2 * scale, 4.8 * scale),
    hullMaterial
  );
  islandBase.position.set(8 * scale, (hullHeight * 0.5 + 0.9) * scale, -2 * scale);
  islandBase.name = 'carrier_island_base';
  islandBase.castShadow = true;
  group.add(islandBase);
  parts.push(islandBase);

  const islandShoulder = new THREE.Mesh(
    new THREE.BoxGeometry(3.2 * scale, 1.1 * scale, 6 * scale),
    trimMaterial
  );
  islandShoulder.position.set(8.2 * scale, (hullHeight * 0.5 + 5.1) * scale, -2 * scale);
  islandShoulder.name = 'carrier_island_shoulder';
  islandShoulder.castShadow = true;
  group.add(islandShoulder);

  // 控制塔窗户
  const islandWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 2 * scale, 3 * scale),
    accentMaterial
  );
  islandWindow.position.set(8 * scale - 2.1 * scale, (hullHeight * 0.5 + 3) * scale, -2 * scale);
  islandWindow.name = 'carrier_island_window';
  group.add(islandWindow);
  parts.push(islandWindow);

  const islandBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.5 * scale, 10, 10),
    glowMaterial
  );
  islandBeacon.position.set(8 * scale, (hullHeight * 0.5 + 6.4) * scale, -2 * scale);
  islandBeacon.name = 'carrier_island_beacon';
  group.add(islandBeacon);
  weakpointMeshes.push(islandBeacon);

  // 雷达天线
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 4 * scale, 8),
    superstructureMaterial
  );
  mast.position.set(8 * scale, (hullHeight * 0.5 + 8) * scale, -2 * scale);
  mast.name = 'carrier_mast';
  mast.castShadow = true;
  group.add(mast);
  parts.push(mast);

  const radar = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 2 * scale, 3 * scale),
    new THREE.MeshStandardMaterial({
      color: 0xa8b8c8,
      metalness: 0.8,
      roughness: 0.22,
      emissive: 0x324a60,
      emissiveIntensity: 0.14,
    })
  );
  radar.position.set(8 * scale, (hullHeight * 0.5 + 9.5) * scale, -2 * scale);
  radar.name = 'carrier_radar';
  group.add(radar);
  parts.push(radar);

  // 两门重炮（左右翼）
  const cannonPositions = [
    { name: 'left', pos: new THREE.Vector3(-6 * scale, hullHeight * 0.5 * scale + 0.5 * scale, 0) },
    { name: 'right', pos: new THREE.Vector3(6 * scale, hullHeight * 0.5 * scale + 0.5 * scale, 0) },
  ];

  for (const cannonPos of cannonPositions) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 0.5 * scale, 8),
      turretMaterial
    );
    base.position.copy(cannonPos.pos);
    base.name = `carrier_cannon_base_${cannonPos.name}`;
    base.castShadow = true;
    group.add(base);
    parts.push(base);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 3 * scale, 8),
      turretMaterial
    );
    barrel.position.copy(cannonPos.pos);
    barrel.position.x += cannonPos.name === 'left' ? -1.2 * scale : 1.2 * scale;
    barrel.position.y += 1.2 * scale;
    barrel.rotation.z = cannonPos.name === 'left' ? Math.PI / 3 : -Math.PI / 3;
    barrel.name = `carrier_cannon_barrel_${cannonPos.name}`;
    barrel.castShadow = true;
    group.add(barrel);
    parts.push(barrel);

    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff9248,
        emissive: 0xff6200,
        emissiveIntensity: 1.05,
        metalness: 0.35,
        roughness: 0.2,
      })
    );
    muzzle.position.copy(barrel.position);
    muzzle.position.x += cannonPos.name === 'left' ? -0.9 * scale : 0.9 * scale;
    muzzle.position.y += 0.55 * scale;
    muzzle.name = `carrier_cannon_muzzle_${cannonPos.name}`;
    group.add(muzzle);
    muzzleMeshes.push(muzzle);

    const sideBattery = new THREE.Mesh(
      new THREE.BoxGeometry(2.3 * scale, 0.5 * scale, 1.4 * scale),
      missileLauncherMaterial
    );
    sideBattery.position.copy(cannonPos.pos);
    sideBattery.position.y += 0.55 * scale;
    sideBattery.position.z += cannonPos.name === 'left' ? -4.2 * scale : 4.2 * scale;
    sideBattery.name = `carrier_side_battery_${cannonPos.name}`;
    sideBattery.castShadow = true;
    group.add(sideBattery);
    parts.push(sideBattery);
  }

  // 两个导弹发射井（后部左右）
  const missileLauncherPositions = [
    {
      name: 'left',
      pos: new THREE.Vector3(-3 * scale, hullHeight * 0.5 * scale + 1 * scale, 3 * scale),
    },
    {
      name: 'right',
      pos: new THREE.Vector3(3 * scale, hullHeight * 0.5 * scale + 1 * scale, 3 * scale),
    },
  ];

  for (const launcherPos of missileLauncherPositions) {
    const launcher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8 * scale, 0.8 * scale, 2.5 * scale, 8),
      missileLauncherMaterial
    );
    launcher.position.copy(launcherPos.pos);
    launcher.name = `carrier_missile_launcher_${launcherPos.name}`;
    launcher.castShadow = true;
    group.add(launcher);
    parts.push(launcher);

    const launcherGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56 * scale, 0.56 * scale, 0.22 * scale, 8),
      glowMaterial
    );
    launcherGlow.position.copy(launcherPos.pos);
    launcherGlow.position.y += 1.35 * scale;
    launcherGlow.name = `carrier_missile_glow_${launcherPos.name}`;
    group.add(launcherGlow);
    launcherGlowMeshes.push(launcherGlow);

    // 导弹发射口
    const cellCount = 3;
    for (let i = 0; i < cellCount; i++) {
      const cell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.5 * scale, 6),
        new THREE.MeshStandardMaterial({
          color: 0x556377,
          metalness: 0.9,
          roughness: 0.14,
          emissive: 0x26384d,
          emissiveIntensity: 0.1,
        })
      );
      const angle = (i / cellCount) * Math.PI * 2;
      cell.position.copy(launcherPos.pos);
      cell.position.x += Math.cos(angle) * 0.35 * scale;
      cell.position.z += Math.sin(angle) * 0.35 * scale;
      cell.position.y += 1.25 * scale;
      cell.name = `carrier_missile_cell_${launcherPos.name}_${i}`;
      group.add(cell);
      parts.push(cell);
    }
  }

  // 机库（在甲板下方后方）
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(8 * scale, 2 * scale, 6 * scale),
    hullMaterial
  );
  hangar.position.set(0, -1 * scale, 4 * scale);
  hangar.name = 'carrier_hangar';
  hangar.castShadow = true;
  group.add(hangar);
  parts.push(hangar);

  // 机库门
  const hangarDoor = new THREE.Mesh(
    new THREE.BoxGeometry(6 * scale, 1.5 * scale, 0.2 * scale),
    new THREE.MeshStandardMaterial({
      color: 0x7a8ea5,
      metalness: 0.6,
      roughness: 0.26,
      emissive: 0x2f455c,
      emissiveIntensity: 0.14,
    })
  );
  hangarDoor.position.set(0, -0.5 * scale, 7.1 * scale);
  hangarDoor.name = 'carrier_hangar_door';
  group.add(hangarDoor);
  parts.push(hangarDoor);

  const hangarFrame = new THREE.Mesh(
    new THREE.BoxGeometry(6.8 * scale, 1.9 * scale, 0.18 * scale),
    trimMaterial
  );
  hangarFrame.position.set(0, -0.5 * scale, 7.25 * scale);
  hangarFrame.name = 'carrier_hangar_frame';
  group.add(hangarFrame);

  for (let i = 0; i < 4; i++) {
    const hangarRib = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * scale, 1.7 * scale, 0.16 * scale),
      trimMaterial
    );
    hangarRib.position.set((-2.4 + i * 1.6) * scale, -0.5 * scale, 7.33 * scale);
    hangarRib.name = `carrier_hangar_rib_${i}`;
    group.add(hangarRib);
  }

  const hangarRoof = new THREE.Mesh(
    new THREE.BoxGeometry(7.6 * scale, 0.45 * scale, 4.4 * scale),
    deckMaterial
  );
  hangarRoof.position.set(0, 0.45 * scale, 5.2 * scale);
  hangarRoof.name = 'carrier_hangar_roof';
  hangarRoof.castShadow = true;
  group.add(hangarRoof);
  parts.push(hangarRoof);

  // 四个反重力引擎（使航母悬浮）
  const enginePositions = [
    new THREE.Vector3(-10 * scale, -1 * scale, 4 * scale),
    new THREE.Vector3(10 * scale, -1 * scale, 4 * scale),
    new THREE.Vector3(-10 * scale, -1 * scale, -4 * scale),
    new THREE.Vector3(10 * scale, -1 * scale, -4 * scale),
  ];

  const engineMaterial = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.9,
  });

  enginePositions.forEach((pos, i) => {
    const enginePylon = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * scale, 1.1 * scale, 1.4 * scale),
      superstructureMaterial
    );
    enginePylon.position.set(pos.x, pos.y + 0.55 * scale, pos.z);
    enginePylon.name = `carrier_engine_pylon_${i}`;
    enginePylon.castShadow = true;
    group.add(enginePylon);
    parts.push(enginePylon);

    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5 * scale, 1.2 * scale, 1.5 * scale, 12),
      engineMaterial
    );
    engine.position.copy(pos);
    engine.name = `carrier_engine_${i}`;
    group.add(engine);
    parts.push(engine);

    const engineCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95 * scale, 0.85 * scale, 0.4 * scale, 12),
      glowMaterial
    );
    engineCore.position.copy(pos);
    engineCore.position.y -= 0.9 * scale;
    engineCore.name = `carrier_engine_core_${i}`;
    group.add(engineCore);
    engineGlowMeshes.push(engineCore);

    const engineRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1 * scale, 0.12 * scale, 8, 18),
      trimMaterial
    );
    engineRing.position.copy(pos);
    engineRing.rotation.x = Math.PI / 2;
    engineRing.name = `carrier_engine_ring_${i}`;
    group.add(engineRing);
  });

  // 尾翼（两个垂直稳定翼）
  const tailFinPositions = [
    { x: -4 * scale, z: 4 * scale },
    { x: 4 * scale, z: 4 * scale },
  ];

  tailFinPositions.forEach((pos, i) => {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 * scale, 3 * scale, 2 * scale),
      superstructureMaterial
    );
    fin.position.set(pos.x, (hullHeight * 0.5 + 1.5) * scale, pos.z);
    fin.name = `carrier_tail_fin_${i}`;
    fin.castShadow = true;
    group.add(fin);
    parts.push(fin);
  });

  const sternArch = new THREE.Mesh(
    new THREE.BoxGeometry(8 * scale, 1 * scale, 0.7 * scale),
    trimMaterial
  );
  sternArch.position.set(0, 1.9 * scale, 4.8 * scale);
  sternArch.name = 'carrier_stern_arch';
  sternArch.castShadow = true;
  group.add(sternArch);

  for (const side of [-1, 1] as const) {
    const sternWing = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 * scale, 0.25 * scale, 1.2 * scale),
      trimMaterial
    );
    sternWing.position.set(side * 3.8 * scale, 1.6 * scale, 5.8 * scale);
    sternWing.name = `carrier_stern_wing_${side < 0 ? 'left' : 'right'}`;
    sternWing.castShadow = true;
    group.add(sternWing);
  }

  group.name = `BOSS_${config.type}`;
  const bossGroup = group as BossGroup;
  bossGroup.bossParts = parts;
  bossGroup.weakpointMeshes = weakpointMeshes;
  bossGroup.muzzleMeshes = muzzleMeshes;
  bossGroup.launcherGlowMeshes = launcherGlowMeshes;
  bossGroup.engineGlowMeshes = engineGlowMeshes;
  return group;
}
