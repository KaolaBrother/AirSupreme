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
  signalBeaconMeshes?: THREE.Mesh[];
  radarRotorMeshes?: THREE.Mesh[];
};

/**
 * 第五关 Boss - 空中航空母舰
 * - 缓慢追踪玩家（空中飞行）
 * - 两门重炮（左右翼）
 * - 两个导弹发射井
 * - 每 60 秒从仓库口飞出 3 架敌机（除 Scout 以外）
 */
export class SkyCarrierAI {
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
  private readonly launcherGlowMeshes: THREE.Mesh[];
  private readonly engineGlowMeshes: THREE.Mesh[];
  private readonly signalBeaconMeshes: THREE.Mesh[];
  private readonly radarRotorMeshes: THREE.Mesh[];
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
    this.signalBeaconMeshes = bossGroup.signalBeaconMeshes ?? [];
    this.radarRotorMeshes = bossGroup.radarRotorMeshes ?? [];

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

    // 更新尾迹（舰艉位于 -Z，舰体沿 +Z 方向飞行）
    const engineLocalPos = new THREE.Vector3(0, -0.6 * this.config.scale, -14 * this.config.scale);
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
    const criticalState = THREE.MathUtils.clamp(
      (SkyCarrierAI.CRITICAL_HEALTH_THRESHOLD - healthRatio) /
        SkyCarrierAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (SkyCarrierAI.TERMINAL_HEALTH_THRESHOLD - healthRatio) /
        SkyCarrierAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - deltaTime);
    const damageFlash =
      this.damageFlashTimer > 0 ? this.damageFlashTimer / SkyCarrierAI.HIT_FLASH_DURATION : 0;
    const deckWave =
      Math.sin(this.visualPulseTime * SkyCarrierAI.WEAKPOINT_PULSE_SPEED) * 0.5 + 0.5;
    const engineWave = Math.sin(this.visualPulseTime * SkyCarrierAI.ENERGY_PULSE_SPEED) * 0.5 + 0.5;
    const terminalBias = terminalState * terminalState;
    const terminalWarning = Math.sqrt(terminalState);
    const criticalBias = criticalState * criticalState;
    const phaseSeparation = 1 + terminalWarning * 0.8 + criticalState * 0.25;
    const damageBlend = damageFlash * 0.8 + terminalWarning * 0.45;
    const criticalPulse =
      (Math.sin(this.visualPulseTime * SkyCarrierAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5) *
      criticalState;
    const terminalPulse =
      (Math.sin(this.visualPulseTime * SkyCarrierAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5) *
      terminalState;

    for (const mesh of this.weakpointMeshes) {
      this.setEmissiveState(
        mesh,
        0.85 +
          deckWave * 0.95 +
          missileCharge * 0.45 +
          criticalPulse * 0.8 +
          terminalPulse * 1.3 +
          damageBlend * 1.4,
        this.weakpointBaseColor
          .clone()
          .lerp(
            this.weakpointCriticalColor,
            criticalState + criticalPulse * 0.35 + criticalBias * 0.2
          )
          .lerp(
            this.terminalColor,
            terminalState * 0.72 + terminalPulse * 0.35 + terminalBias * 0.2
          )
      );
      if (mesh.name === 'carrier_deck_core_glow') {
        mesh.scale.z =
          1 + deckWave * 0.12 + terminalPulse * 0.08 + damageFlash * 0.08 + terminalWarning * 0.05;
      }
    }

    for (let i = 0; i < this.muzzleMeshes.length; i++) {
      const activeBoost =
        i === this.currentCannon ? 0.75 + cannonCharge * 1.4 : 0.2 + cannonCharge * 0.25;
      this.setEmissiveState(
        this.muzzleMeshes[i],
        0.45 +
          activeBoost +
          (Math.sin(this.visualPulseTime * SkyCarrierAI.WEAPON_PULSE_SPEED + i) * 0.5 + 0.5) *
            0.18 +
          criticalPulse * 0.75 +
          terminalPulse * 1.2 +
          damageBlend * 0.55,
        this.weaponBaseColor
          .clone()
          .lerp(
            this.weaponCriticalColor,
            criticalState + criticalPulse * 0.25 + criticalBias * 0.22
          )
          .lerp(this.terminalColor, terminalState * 0.6 + terminalPulse * 0.36 + terminalBias * 0.2)
      );
    }

    for (const mesh of this.launcherGlowMeshes) {
      this.setEmissiveState(
        mesh,
        0.7 +
          missileCharge * 1.1 +
          deckWave * 0.35 +
          criticalPulse * 0.7 +
          terminalPulse * 1.05 +
          damageBlend * 0.62,
        this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + missileCharge * 0.2 + criticalBias * 0.2)
          .lerp(
            this.terminalColor,
            terminalState * 0.56 + terminalPulse * 0.35 + terminalBias * 0.2
          )
      );
      const flashScale =
        1 +
        terminalPulse * 0.06 +
        damageFlash * 0.07 +
        terminalWarning * 0.05 +
        phaseSeparation * 0.02;
      mesh.scale.setScalar(flashScale);
    }

    for (const mesh of this.engineGlowMeshes) {
      this.setEmissiveState(
        mesh,
        0.95 +
          engineWave * 1.1 * engineRatio +
          criticalPulse * 0.6 +
          terminalPulse * 1.0 +
          damageBlend * 0.7,
        this.energyBaseColor
          .clone()
          .lerp(this.energyCriticalColor, criticalState + criticalPulse * 0.2 + criticalBias * 0.22)
          .lerp(this.terminalColor, terminalState * 0.35 + terminalPulse * 0.3 + terminalBias * 0.2)
      );
      mesh.scale.x =
        1 +
        engineWave * 0.08 * phaseSeparation +
        terminalPulse * 0.06 +
        damageFlash * 0.04 +
        terminalWarning * 0.04;
      mesh.scale.z =
        1 +
        engineWave * 0.08 * phaseSeparation +
        terminalPulse * 0.06 +
        damageFlash * 0.04 +
        terminalWarning * 0.04;
    }

    // 信号灯（警示信标）缓慢脉冲
    const beaconWave = Math.sin(this.visualPulseTime * SkyCarrierAI.BEACON_PULSE_SPEED) * 0.5 + 0.5;
    for (const beacon of this.signalBeaconMeshes) {
      this.setBeaconOpacity(beacon, 0.3 + beaconWave * 0.7);
    }

    // 舰岛导航雷达持续旋转
    for (const rotor of this.radarRotorMeshes) {
      rotor.rotation.y += deltaTime * 1.6;
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

  private setBeaconOpacity(mesh: THREE.Mesh, opacity: number): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.opacity = opacity;
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
    this.damageFlashTimer = SkyCarrierAI.HIT_FLASH_DURATION;
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
 * 创建空中航空母舰模型 —— 终局飞行航母重制版
 * 舰体朝向: 舰艏 +Z（AI 通过 lookAt 使 +Z 对准航向），上方向 +Y
 * 结构: 全通飞行甲板 + 斜角降落跑道（标线/拦阻索/甲板灯）+ 右舷舰岛（旋转雷达）+
 *       舷侧升降机 + 机库开口 + 停放舰载机剪影 + 下腹反重力推进阵列
 */
export function createSkyCarrierMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];
  const weakpointMeshes: THREE.Mesh[] = [];
  const muzzleMeshes: THREE.Mesh[] = [];
  const launcherGlowMeshes: THREE.Mesh[] = [];
  const engineGlowMeshes: THREE.Mesh[] = [];
  const signalBeaconMeshes: THREE.Mesh[] = [];
  const radarRotorMeshes: THREE.Mesh[] = [];

  // ===== 几何构造辅助（尺寸单位：未缩放的设计单位）=====
  const box = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w * scale, h * scale, d * scale);
  const cyl = (rTop: number, rBottom: number, h: number, seg = 10) =>
    new THREE.CylinderGeometry(rTop * scale, rBottom * scale, h * scale, seg);
  const cone = (r: number, h: number, seg = 10) =>
    new THREE.ConeGeometry(r * scale, h * scale, seg);
  const ball = (r: number, seg = 10) => new THREE.SphereGeometry(r * scale, seg, seg);
  const ring = (r: number, tube: number, radSeg = 8, tubSeg = 20) =>
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

  // ===== 材质（夜港钢蓝涂装 + 城市夜景灯光）=====
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x70839a,
    metalness: 0.66,
    roughness: 0.24,
    emissive: 0x2c4f6e,
    emissiveIntensity: 0.2,
  });
  const hullDarkMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x70839a).offsetHSL(0, 0.03, -0.12),
    metalness: 0.7,
    roughness: 0.3,
  });
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x55616e,
    metalness: 0.4,
    roughness: 0.42,
    emissive: 0x232f3a,
    emissiveIntensity: 0.2,
  });
  const superstructureMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8c7d5,
    metalness: 0.54,
    roughness: 0.22,
    emissive: 0x3b5c78,
    emissiveIntensity: 0.2,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    metalness: 0.72,
    roughness: 0.14,
    emissive: 0x4a6784,
    emissiveIntensity: 0.18,
  });
  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x76899d,
    metalness: 0.84,
    roughness: 0.16,
    emissive: 0x35526e,
    emissiveIntensity: 0.18,
  });
  const launcherMaterial = new THREE.MeshStandardMaterial({
    color: 0x8298af,
    metalness: 0.7,
    roughness: 0.14,
    emissive: 0x3b5d7b,
    emissiveIntensity: 0.18,
  });
  const markingMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8eef4,
    metalness: 0.3,
    roughness: 0.5,
    emissive: 0x5a6b7a,
    emissiveIntensity: 0.3,
  });
  const wireMaterial = new THREE.MeshStandardMaterial({
    color: 0x252c33,
    metalness: 0.8,
    roughness: 0.4,
  });
  const aircraftMaterial = new THREE.MeshStandardMaterial({
    color: 0x39465a,
    metalness: 0.6,
    roughness: 0.4,
    emissive: 0x16202e,
    emissiveIntensity: 0.3,
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
  const muzzleGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff9248,
    emissive: 0xff6200,
    emissiveIntensity: 1.05,
    metalness: 0.35,
    roughness: 0.2,
  });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x8fd2f5,
    emissive: 0x1f88c8,
    emissiveIntensity: 0.85,
    metalness: 0.6,
    roughness: 0.1,
  });
  const engineHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.9,
  });
  const deckLightMaterial = new THREE.MeshBasicMaterial({ color: 0xcfe8ff });
  const elevatorMarkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const runningLightRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const runningLightGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x2aff5a });
  const sternLightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4d8 });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb02e,
    transparent: true,
    opacity: 0.85,
  });
  const thrusterGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x35c4ff,
    transparent: true,
    opacity: 0.85,
  });

  // ===== 主舰体（舰艏 +Z）=====
  add(box(10, 3, 30), hullMaterial, 'carrier_hull', 0, 0, 0, { collide: true });
  const bow = add(cone(4.2, 5, 4), hullMaterial, 'carrier_bow', 0, 0, 17.4, {
    rx: Math.PI / 2,
    collide: true,
  });
  bow.scale.y = 0.42 * bow.scale.y;
  add(box(8, 2.6, 3), hullDarkMaterial, 'carrier_stern_block', 0, -0.2, -16.2, { collide: true });

  // 舰艏弹射出击口（机库出击辉光槽）
  add(box(3.2, 0.55, 0.4), accentMaterial, 'carrier_launch_port', 0, 0.55, 17.9, {
    shadow: false,
  });

  // 舷侧船体镶板
  const hullPanelGeometry = box(0.14, 1.0, 3.4);
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 5; i++) {
      add(
        hullPanelGeometry,
        hullDarkMaterial,
        `carrier_hull_panel_${side < 0 ? 'port' : 'starboard'}_${i}`,
        side * 5.06,
        0.3,
        -10 + i * 5,
        { shadow: false }
      );
    }
  }

  // ===== 飞行甲板（含斜角降落区）=====
  add(box(11, 0.5, 28), deckMaterial, 'carrier_deck', 0, 1.95, 0.5, { collide: true });
  add(box(4.6, 0.42, 13), deckMaterial, 'carrier_angled_deck', -1.9, 2.02, -6.5, {
    ry: -0.2,
    collide: true,
  });

  // 弹射器轨道（艏部两条）
  for (const side of [-1, 1] as const) {
    add(
      box(0.42, 0.1, 7.5),
      markingMaterial,
      `carrier_catapult_rail_${side < 0 ? 0 : 1}`,
      side * 1.7,
      2.26,
      10.0,
      { shadow: false }
    );
  }

  // 斜角跑道中线虚线 + 末端着舰横线
  const angledDir = { x: -Math.sin(0.2), z: Math.cos(0.2) };
  const angledPerp = { x: Math.cos(0.2), z: Math.sin(0.2) };
  const dashGeometry = box(0.26, 0.08, 1.15);
  for (let i = 0; i < 6; i++) {
    const t = -5 + i * 2;
    add(
      dashGeometry,
      markingMaterial,
      `carrier_runway_line_${i}`,
      -1.9 + angledDir.x * t,
      2.3,
      -6.5 + angledDir.z * t,
      { ry: -0.2, shadow: false }
    );
  }
  const thresholdGeometry = box(1.1, 0.08, 0.2);
  for (let i = 0; i < 4; i++) {
    const s = -1.2 + i * 0.8;
    add(
      thresholdGeometry,
      markingMaterial,
      `carrier_threshold_stripe_${i}`,
      -1.9 + angledDir.x * -5.6 + angledPerp.x * s,
      2.3,
      -6.5 + angledDir.z * -5.6 + angledPerp.z * s,
      { ry: -0.2, shadow: false }
    );
  }

  // 甲板边线
  for (const side of [-1, 1] as const) {
    add(
      box(0.2, 0.06, 24),
      markingMaterial,
      `carrier_deck_edge_line_${side < 0 ? 'port' : 'starboard'}`,
      side * 5.2,
      2.26,
      0.5,
      { shadow: false }
    );
  }

  // 拦阻索（斜角跑道上的三道横索）
  const wireGeometry = box(4.3, 0.05, 0.09);
  for (let i = 0; i < 3; i++) {
    const t = -2.6 + i * 1.2;
    add(
      wireGeometry,
      wireMaterial,
      `carrier_arresting_wire_${i}`,
      -1.9 + angledDir.x * t,
      2.28,
      -6.5 + angledDir.z * t,
      { ry: -0.2, shadow: false }
    );
  }

  // 甲板边缘跑道灯阵列
  const deckLightGeometry = ball(0.1, 6);
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 6; i++) {
      add(
        deckLightGeometry,
        deckLightMaterial,
        `carrier_runway_light_${side < 0 ? 'port' : 'starboard'}_${i}`,
        side * 4.7,
        2.3,
        -10 + i * 4.4,
        { shadow: false }
      );
    }
  }

  // 甲板中央核心辉光带（弱点，运行时沿 Z 方向脉冲伸缩）
  const deckCore = add(
    box(1.3, 0.16, 9),
    glowMaterial.clone(),
    'carrier_deck_core_glow',
    0,
    2.3,
    2.5,
    { shadow: false }
  );
  weakpointMeshes.push(deckCore);

  // ===== 右舷舰岛（层叠塔楼 + 旋转雷达桅）=====
  add(box(2.8, 1.0, 5.4), hullMaterial, 'carrier_island_base', 3.9, 2.7, 3, { collide: true });
  add(box(2.2, 3.4, 4.2), superstructureMaterial, 'carrier_island', 3.9, 4.9, 3, {
    collide: true,
  });
  add(box(2.5, 1.0, 2.5), superstructureMaterial, 'carrier_island_bridge', 3.9, 7.0, 3.7, {
    collide: true,
  });
  add(box(1.9, 0.8, 1.7), trimMaterial, 'carrier_island_flag_bridge', 3.9, 7.85, 3.1);
  add(box(2.0, 0.5, 0.14), accentMaterial, 'carrier_island_window', 3.9, 7.05, 4.98, {
    collide: true,
    shadow: false,
  });

  // 舰岛侧舷窗发光条
  const islandWindowGeometry = box(0.12, 0.36, 1.5);
  const islandWindowSpots = [
    { x: 2.78, y: 4.6, z: 3 },
    { x: 5.02, y: 4.6, z: 3 },
    { x: 2.78, y: 5.7, z: 3 },
    { x: 5.02, y: 5.7, z: 3 },
  ];
  islandWindowSpots.forEach((spot, i) => {
    add(
      islandWindowGeometry,
      windowMaterial,
      `carrier_island_window_strip_${i}`,
      spot.x,
      spot.y,
      spot.z,
      { shadow: false }
    );
  });

  // 舰岛桅杆与旋转导航雷达
  add(cyl(0.1, 0.2, 2.8, 8), superstructureMaterial, 'carrier_mast', 3.9, 9.7, 2.6, {
    collide: true,
  });
  add(box(1.9, 0.07, 0.07), wireMaterial, 'carrier_yardarm', 3.9, 10.3, 2.6);
  const navRadar = add(box(0.16, 0.18, 1.9), wireMaterial, 'carrier_radar', 3.9, 11.15, 2.6);
  parts.push(navRadar);
  radarRotorMeshes.push(navRadar);
  add(cyl(0.09, 0.12, 0.4, 8), wireMaterial, 'carrier_radar_hub', 3.9, 10.9, 2.6);

  // 对空搜索雷达盘（固定倾角）
  add(cyl(0.08, 0.1, 0.55, 6), wireMaterial, 'carrier_radar_dish_post', 4.6, 8.5, 1.6);
  add(cyl(0.55, 0.7, 0.15, 12), hullDarkMaterial, 'carrier_radar_dish', 4.6, 8.9, 1.6, {
    rz: 0.45,
  });
  add(ring(0.54, 0.05, 6, 16), wireMaterial, 'carrier_radar_dish_lattice', 4.6, 8.9, 1.6, {
    rx: Math.PI / 2,
    rz: 0.45,
  });

  // 舰岛天线阵列
  const antennaRodGeometry = cyl(0.04, 0.06, 1.7, 6);
  [
    { x: 3.2, z: 1.4 },
    { x: 4.6, z: 4.4 },
    { x: 3.3, z: 4.6 },
  ].forEach((spot, i) => {
    add(antennaRodGeometry, wireMaterial, `carrier_antenna_rod_${i}`, spot.x, 9.0, spot.z, {
      shadow: false,
    });
  });

  // 舰岛顶部信标（弱点辉光）
  const islandBeacon = add(
    ball(0.45, 10),
    glowMaterial.clone(),
    'carrier_island_beacon',
    3.9,
    11.9,
    2.6,
    { shadow: false }
  );
  weakpointMeshes.push(islandBeacon);

  // ===== 舷侧升降机（甲板边缘平台）=====
  const elevatorGeometry = box(2.6, 0.3, 3.4);
  const elevatorStrutGeometry = box(0.22, 1.1, 0.22);
  const elevatorSpots = [
    { name: 'starboard', x: 6.1, z: 8.5 },
    { name: 'port', x: -6.1, z: -2.5 },
  ];
  for (const spot of elevatorSpots) {
    add(elevatorGeometry, deckMaterial, `carrier_elevator_${spot.name}`, spot.x, 1.75, spot.z, {
      collide: true,
    });
    add(
      box(2.4, 0.06, 0.16),
      elevatorMarkMaterial,
      `carrier_elevator_mark_${spot.name}`,
      spot.x,
      1.94,
      spot.z + 1.55,
      { shadow: false }
    );
    for (const strutSide of [-1, 1] as const) {
      add(
        elevatorStrutGeometry,
        hullDarkMaterial,
        `carrier_elevator_strut_${spot.name}_${strutSide < 0 ? 0 : 1}`,
        spot.x * 0.86,
        0.95,
        spot.z + strutSide * 1.2
      );
    }
  }

  // ===== 舷侧舱体与机库开口 =====
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'left' : 'right';
    add(
      box(2.2, 1.7, 12.5),
      superstructureMaterial,
      `carrier_side_sponson_${name}`,
      side * 5.5,
      -0.65,
      -1.5,
      { collide: true }
    );
    const hangarBay = add(
      box(0.32, 1.15, 4.4),
      accentMaterial.clone(),
      `carrier_hangar_bay_${name}`,
      side * 6.68,
      -0.6,
      -2.5,
      { shadow: false }
    );
    weakpointMeshes.push(hangarBay);
    add(
      box(0.2, 1.5, 5.0),
      trimMaterial,
      `carrier_hangar_bay_frame_${name}`,
      side * 6.62,
      -0.6,
      -2.5
    );
    const weaponPod = add(
      cyl(0.8, 0.8, 2.9, 10),
      launcherMaterial,
      `carrier_weapon_pod_${name}`,
      side * 6.1,
      -1.5,
      4.4,
      { rx: Math.PI / 2, collide: true }
    );
    weaponPod.castShadow = true;
  }

  // 艉部机库与出入口
  add(box(8, 2.0, 5), hullMaterial, 'carrier_hangar', 0, -0.9, -12.5, { collide: true });
  add(box(5.2, 1.5, 0.2), hullDarkMaterial, 'carrier_hangar_door', 0, -0.8, -15.1, {
    collide: true,
    shadow: false,
  });
  for (let i = 0; i < 4; i++) {
    add(
      box(0.2, 1.4, 0.16),
      trimMaterial,
      `carrier_hangar_rib_${i}`,
      -1.95 + i * 1.3,
      -0.8,
      -15.2,
      { shadow: false }
    );
  }

  // ===== 龙骨与下层船体 =====
  add(box(4, 1.8, 20), hullDarkMaterial, 'carrier_keel', 0, -2.3, 0.5, { collide: true });
  const keelCore = add(box(1.8, 0.4, 8), glowMaterial.clone(), 'carrier_keel_core', 0, -3.3, 0.5, {
    shadow: false,
  });
  weakpointMeshes.push(keelCore);
  add(box(0.32, 2.0, 3.6), hullDarkMaterial, 'carrier_keel_fin', 0, -2.7, -9.5);

  // 龙骨推进辉光带
  for (const side of [-1, 1] as const) {
    add(
      box(3.4, 0.14, 0.55),
      thrusterGlowMaterial,
      `carrier_thruster_strip_${side < 0 ? 0 : 1}`,
      side * 1.6,
      -3.55,
      0.5,
      { shadow: false }
    );
  }

  // ===== 反重力引擎舱（四角吊舱：挂架 + 外壳 + 辉光核心 + 装饰环）=====
  const enginePositions = [
    { x: -8.2, z: 9 },
    { x: 8.2, z: 9 },
    { x: -8.2, z: -9 },
    { x: 8.2, z: -9 },
  ];
  enginePositions.forEach((pos, i) => {
    add(
      box(1.5, 1.1, 1.7),
      superstructureMaterial,
      `carrier_engine_pylon_${i}`,
      pos.x * 0.82,
      -0.3,
      pos.z,
      { collide: true }
    );
    add(cyl(1.5, 1.15, 1.6, 12), engineHaloMaterial, `carrier_engine_${i}`, pos.x, -1.2, pos.z, {
      collide: true,
      shadow: false,
    });
    const engineCore = add(
      cyl(0.95, 0.82, 0.45, 12),
      glowMaterial.clone(),
      `carrier_engine_core_${i}`,
      pos.x,
      -2.15,
      pos.z,
      { shadow: false }
    );
    engineGlowMeshes.push(engineCore);
    add(ring(1.18, 0.12, 8, 18), trimMaterial, `carrier_engine_ring_${i}`, pos.x, -1.2, pos.z, {
      rx: Math.PI / 2,
    });
  });

  // ===== 两门重炮（左右舷，保留炮口辉光锚点顺序：左→右）=====
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'left' : 'right';
    add(
      cyl(0.5, 0.62, 0.55, 10),
      turretMaterial,
      `carrier_cannon_base_${name}`,
      side * 4.9,
      2.45,
      0.2,
      { collide: true }
    );
    add(
      box(1.1, 0.55, 1.25),
      turretMaterial,
      `carrier_cannon_housing_${name}`,
      side * 4.9,
      2.95,
      0.2
    );
    const barrelGeometry = cyl(0.13, 0.16, 2.8, 8);
    for (const b of [-1, 1] as const) {
      add(
        barrelGeometry,
        hullDarkMaterial,
        `carrier_cannon_barrel_${name}_${b < 0 ? 0 : 1}`,
        side * 5.9,
        3.45,
        0.2 + b * 0.24,
        { rz: side * -(Math.PI / 3), collide: b < 0 }
      );
    }
    const muzzle = add(
      ball(0.2, 8),
      muzzleGlowMaterial.clone(),
      `carrier_cannon_muzzle_${name}`,
      side * 7.05,
      4.1,
      0.2,
      { shadow: false }
    );
    muzzleMeshes.push(muzzle);
  }

  // ===== 甲板嵌入式导弹发射井（保留 ±3 / +3 锚点，左→右顺序）=====
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'left' : 'right';
    add(
      cyl(0.95, 0.95, 0.22, 12),
      launcherMaterial,
      `carrier_missile_silo_collar_${name}`,
      side * 3,
      2.28,
      3.6,
      { collide: true }
    );
    const missileGlow = add(
      cyl(0.6, 0.6, 0.18, 10),
      glowMaterial.clone(),
      `carrier_missile_glow_${name}`,
      side * 3,
      2.42,
      3.6,
      { shadow: false }
    );
    launcherGlowMeshes.push(missileGlow);
    for (let cell = 0; cell < 3; cell++) {
      const angle = (cell / 3) * Math.PI * 2;
      add(
        cyl(0.18, 0.18, 0.14, 6),
        turretMaterial,
        `carrier_missile_cell_${name}_${cell}`,
        side * 3 + Math.cos(angle) * 0.42,
        2.52,
        3.6 + Math.sin(angle) * 0.42,
        { shadow: false }
      );
    }
  }

  // ===== 停放的舰载机剪影（甲板停机区）=====
  const parkedFuselageGeometry = box(0.36, 0.22, 1.5);
  const parkedWingGeometry = box(1.5, 0.06, 0.45);
  const parkedTailGeometry = box(0.6, 0.05, 0.26);
  const parkedFinGeometry = box(0.06, 0.32, 0.32);
  const parkedSpots = [
    { x: 2.4, z: -8.6, ry: 0.45 },
    { x: 3.5, z: -11.0, ry: 0.2 },
    { x: 2.8, z: -5.6, ry: -0.3 },
    { x: -3.5, z: 6.4, ry: 0.12 },
  ];
  parkedSpots.forEach((spot, i) => {
    const plane = new THREE.Group();
    plane.name = `carrier_parked_aircraft_${i}`;
    plane.position.set(spot.x * scale, 2.35 * scale, spot.z * scale);
    plane.rotation.y = spot.ry;
    group.add(plane);

    const fuselage = new THREE.Mesh(parkedFuselageGeometry, aircraftMaterial);
    fuselage.name = `carrier_parked_aircraft_${i}_fuselage`;
    fuselage.castShadow = true;
    plane.add(fuselage);
    const wing = new THREE.Mesh(parkedWingGeometry, aircraftMaterial);
    wing.name = `carrier_parked_aircraft_${i}_wing`;
    wing.position.set(0, 0.02 * scale, -0.08 * scale);
    plane.add(wing);
    const tail = new THREE.Mesh(parkedTailGeometry, aircraftMaterial);
    tail.name = `carrier_parked_aircraft_${i}_tail`;
    tail.position.set(0, 0.04 * scale, -0.62 * scale);
    plane.add(tail);
    const fin = new THREE.Mesh(parkedFinGeometry, aircraftMaterial);
    fin.name = `carrier_parked_aircraft_${i}_fin`;
    fin.position.set(0, 0.2 * scale, -0.6 * scale);
    plane.add(fin);
  });

  // ===== 艉部稳定尾翼 =====
  for (const side of [-1, 1] as const) {
    add(
      box(0.3, 2.8, 2.2),
      superstructureMaterial,
      `carrier_tail_fin_${side < 0 ? 0 : 1}`,
      side * 3.6,
      3.2,
      -14.6,
      { collide: true }
    );
    add(
      box(0.12, 1.6, 0.5),
      accentMaterial,
      `carrier_tail_fin_trim_${side < 0 ? 0 : 1}`,
      side * 3.6,
      3.3,
      -15.7,
      { shadow: false }
    );
  }
  add(box(7.4, 0.9, 0.6), trimMaterial, 'carrier_stern_arch', 0, 2.4, -15.0);

  // ===== 航行灯（左红右绿 / 艉白）与城市夜景信标 =====
  add(ball(0.16, 8), runningLightRedMaterial, 'carrier_running_light_port', -5.3, 2.3, 13.0, {
    shadow: false,
  });
  add(ball(0.16, 8), runningLightGreenMaterial, 'carrier_running_light_starboard', 5.3, 2.3, 13.0, {
    shadow: false,
  });
  add(ball(0.16, 8), sternLightMaterial, 'carrier_running_light_stern', 0, 2.3, -16.4, {
    shadow: false,
  });

  const beaconGeometry = ball(0.18, 8);
  [
    { x: 3.9, y: 12.4, z: 2.6 },
    { x: 0, y: 2.6, z: 18.6 },
    { x: 0, y: 2.6, z: -15.9 },
    { x: -6.1, y: 2.35, z: -2.5 },
  ].forEach((spot, i) => {
    const beacon = add(
      beaconGeometry,
      beaconMaterial,
      `carrier_signal_beacon_${i}`,
      spot.x,
      spot.y,
      spot.z,
      { shadow: false }
    );
    signalBeaconMeshes.push(beacon);
  });

  group.name = `BOSS_${config.type}`;
  const bossGroup = group as BossGroup;
  bossGroup.bossParts = parts;
  bossGroup.weakpointMeshes = weakpointMeshes;
  bossGroup.muzzleMeshes = muzzleMeshes;
  bossGroup.launcherGlowMeshes = launcherGlowMeshes;
  bossGroup.engineGlowMeshes = engineGlowMeshes;
  bossGroup.signalBeaconMeshes = signalBeaconMeshes;
  bossGroup.radarRotorMeshes = radarRotorMeshes;
  return group;
}
