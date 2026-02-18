import * as THREE from 'three';
import { BossConfig } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import { BossMissileSystem } from './BossMissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { EnemyType } from '@/features/enemy/EnemyTypes';

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

    // 更新尾迹
    const engineLocalPos = new THREE.Vector3(0, 0, 8);
    const engineWorldPos = engineLocalPos.applyMatrix4(this.mesh.matrixWorld);
    this.trail.addPoint(engineWorldPos);
    this.trail.update(deltaTime);
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
    const parts = (this.mesh as any).bossParts as THREE.Mesh[] | undefined;
    if (!parts) return [this.mesh];
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
        if (child.material instanceof THREE.Material) {
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

  // 材质定义
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a4a5a,
    metalness: 0.7,
    roughness: 0.3,
  });

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5a6a,
    metalness: 0.5,
    roughness: 0.4,
  });

  const superstructureMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a3a4a,
    metalness: 0.6,
    roughness: 0.3,
  });

  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a0000,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x220000,
    emissiveIntensity: 0.2,
  });

  const missileLauncherMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.9,
    roughness: 0.2,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.1,
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

  // 跑道标线
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(2 * scale, 0.1 * scale, 0.3 * scale),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
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

  // 控制塔窗户
  const islandWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 2 * scale, 3 * scale),
    accentMaterial
  );
  islandWindow.position.set(8 * scale - 2.1 * scale, (hullHeight * 0.5 + 3) * scale, -2 * scale);
  islandWindow.name = 'carrier_island_window';
  group.add(islandWindow);
  parts.push(islandWindow);

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
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2,
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

    // 导弹发射口
    const cellCount = 3;
    for (let i = 0; i < cellCount; i++) {
      const cell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.5 * scale, 6),
        new THREE.MeshStandardMaterial({
          color: 0x333333,
          metalness: 0.9,
          roughness: 0.1,
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
      color: 0x556677,
      metalness: 0.6,
      roughness: 0.3,
    })
  );
  hangarDoor.position.set(0, -0.5 * scale, 7.1 * scale);
  hangarDoor.name = 'carrier_hangar_door';
  group.add(hangarDoor);
  parts.push(hangarDoor);

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
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5 * scale, 1.2 * scale, 1.5 * scale, 12),
      engineMaterial
    );
    engine.position.copy(pos);
    engine.name = `carrier_engine_${i}`;
    group.add(engine);
    parts.push(engine);
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

  group.name = `BOSS_${config.type}`;
  (group as any).bossParts = parts;
  return group;
}
