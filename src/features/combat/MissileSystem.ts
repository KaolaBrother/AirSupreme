import * as THREE from 'three';
import { ParticleSystem, getVfxTextures } from '@/features/effects/ParticleSystem';
import { GAME_CONSTANTS } from '@/config';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MissileSystem');
// 稍微加密尾迹步进，让烟线更连续
const MISSILE_TRAIL_INTERVAL = 0.035;

/**
 * 导弹模型共享几何体（全部预旋转为 +Z 朝前）
 */
interface MissileGeometries {
  body: THREE.CylinderGeometry;
  nose: THREE.ConeGeometry;
  fin: THREE.BoxGeometry;
  canard: THREE.BoxGeometry;
  nozzle: THREE.TorusGeometry;
  accentBand: THREE.CylinderGeometry;
  flameOuter: THREE.ConeGeometry;
  flameInner: THREE.ConeGeometry;
}

let sharedMissileGeometries: MissileGeometries | null = null;

function getMissileGeometries(): MissileGeometries {
  if (!sharedMissileGeometries) {
    // 弹体：细长圆柱，前端略收（含弹头总长径比 ~8:1，更接近真实空空弹）
    const body = new THREE.CylinderGeometry(0.15, 0.165, 1.9, 12);
    body.rotateX(Math.PI / 2);
    // 卵形弹头
    const nose = new THREE.ConeGeometry(0.15, 0.8, 12);
    nose.rotateX(Math.PI / 2);
    // 十字尾翼 / 弹体中段小鸭翼
    const fin = new THREE.BoxGeometry(0.045, 0.4, 0.52);
    const canard = new THREE.BoxGeometry(0.035, 0.22, 0.3);
    // 喷口环
    const nozzle = new THREE.TorusGeometry(0.12, 0.04, 8, 16);
    // 弹体警示色带
    const accentBand = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12);
    accentBand.rotateX(Math.PI / 2);
    // 双层尾焰（开口锥，尖端朝后）
    const flameOuter = new THREE.ConeGeometry(0.17, 1.5, 10, 1, true);
    flameOuter.rotateX(-Math.PI / 2);
    const flameInner = new THREE.ConeGeometry(0.09, 1.0, 8, 1, true);
    flameInner.rotateX(-Math.PI / 2);
    sharedMissileGeometries = {
      body,
      nose,
      fin,
      canard,
      nozzle,
      accentBand,
      flameOuter,
      flameInner,
    };
  }
  return sharedMissileGeometries;
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
  private particleSystem: ParticleSystem;
  private startPosition: THREE.Vector3; // 记录发射位置
  private maxFlightDistance: number = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE; // 最大飞行距离
  private enemies: THREE.Object3D[] = []; // 敌人列表，用于重新锁定目标
  private readonly ownedMaterials: THREE.Material[] = [];
  private accentMaterial!: THREE.MeshStandardMaterial;
  private nozzleMaterial!: THREE.MeshStandardMaterial;
  private flameOuterMaterial!: THREE.MeshBasicMaterial;
  private flameInnerMaterial!: THREE.MeshBasicMaterial;
  private engineGlowMaterial!: THREE.SpriteMaterial;
  private flameOuter!: THREE.Mesh;
  private flameInner!: THREE.Mesh;
  private engineGlow!: THREE.Sprite;
  private trailTimer: number = MISSILE_TRAIL_INTERVAL;
  private visualPulseTime: number = 0;
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

    // 导弹模型 - 使用父容器来正确控制朝向（+Z 朝前）
    this.mesh = new THREE.Group();
    this.buildMissileModel();

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
   * 构建导弹模型：
   * 细长金属弹体 + 卵形弹头 + 十字尾翼 + 鸭翼 + 喷口环 + 双层闪烁尾焰 + 引擎光晕
   */
  private buildMissileModel(): void {
    const geometries = getMissileGeometries();
    const textures = getVfxTextures();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xccd3da,
      metalness: 0.85,
      roughness: 0.32,
      emissive: 0x1a2630,
      emissiveIntensity: 0.35,
    });
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0x39404a,
      metalness: 0.9,
      roughness: 0.25,
    });
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa4ae,
      metalness: 0.75,
      roughness: 0.4,
    });
    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3a26,
      emissive: 0xff2200,
      emissiveIntensity: 0.85,
      metalness: 0.4,
      roughness: 0.4,
    });
    this.nozzleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c2f34,
      metalness: 0.95,
      roughness: 0.3,
      emissive: 0xff5a22,
      emissiveIntensity: 0.4,
    });
    this.flameOuterMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7c1e,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.flameInnerMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff4cf,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.engineGlowMaterial = new THREE.SpriteMaterial({
      map: textures.glow,
      color: 0xffb763,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ownedMaterials.push(
      bodyMaterial,
      noseMaterial,
      finMaterial,
      this.accentMaterial,
      this.nozzleMaterial,
      this.flameOuterMaterial,
      this.flameInnerMaterial,
      this.engineGlowMaterial
    );

    const body = new THREE.Mesh(geometries.body, bodyMaterial);
    this.mesh.add(body);

    const nose = new THREE.Mesh(geometries.nose, noseMaterial);
    nose.position.z = 1.35;
    this.mesh.add(nose);

    const accentBand = new THREE.Mesh(geometries.accentBand, this.accentMaterial);
    accentBand.position.z = 0.5;
    this.mesh.add(accentBand);

    // 十字尾翼 + 中段鸭翼
    const bodyRadius = 0.165;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;

      const fin = new THREE.Mesh(geometries.fin, finMaterial);
      fin.position.x = Math.cos(angle) * (bodyRadius + 0.18);
      fin.position.y = Math.sin(angle) * (bodyRadius + 0.18);
      fin.position.z = -0.7;
      fin.rotation.z = angle + Math.PI / 2;
      this.mesh.add(fin);

      const canard = new THREE.Mesh(geometries.canard, finMaterial);
      canard.position.x = Math.cos(angle) * (bodyRadius + 0.1);
      canard.position.y = Math.sin(angle) * (bodyRadius + 0.1);
      canard.position.z = 0.8;
      canard.rotation.z = angle + Math.PI / 2;
      this.mesh.add(canard);
    }

    const nozzle = new THREE.Mesh(geometries.nozzle, this.nozzleMaterial);
    nozzle.position.z = -0.96;
    this.mesh.add(nozzle);

    // 双层尾焰：内层白热 + 外层橙焰，高频闪烁
    this.flameOuter = new THREE.Mesh(geometries.flameOuter, this.flameOuterMaterial);
    this.flameOuter.position.z = -1.71;
    this.mesh.add(this.flameOuter);

    this.flameInner = new THREE.Mesh(geometries.flameInner, this.flameInnerMaterial);
    this.flameInner.position.z = -1.46;
    this.mesh.add(this.flameInner);

    this.engineGlow = new THREE.Sprite(this.engineGlowMaterial);
    this.engineGlow.scale.set(1.1, 1.1, 1);
    this.engineGlow.position.z = -1.1;
    this.mesh.add(this.engineGlow);
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
    this.visualPulseTime += deltaTime;
    this.updateVisuals();

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
    this.particleSystem.createMissileTrail(this.trailPosition, this.velocity, this.trailColor, 1);
  }

  private updateVisuals(): void {
    const t = this.visualPulseTime;
    // 双频叠加的高频火焰闪烁（0..1 左右波动）
    const flicker = 0.5 + 0.28 * Math.sin(t * 52) + 0.22 * Math.sin(t * 87 + 1.7);
    const flickerB = 0.5 + 0.5 * Math.sin(t * 64 + 0.9);
    const speedPulse = THREE.MathUtils.clamp(this.velocity.length() / this.speed, 0.8, 1.15);

    this.accentMaterial.emissiveIntensity = 0.55 + flicker * 0.5;
    this.nozzleMaterial.emissiveIntensity = 0.3 + flicker * 0.45;

    this.flameOuterMaterial.opacity = 0.55 + flicker * 0.35;
    const outerScale = (0.82 + flicker * 0.3) * speedPulse;
    this.flameOuter.scale.set(outerScale, outerScale, 0.85 + flicker * 0.45);

    this.flameInnerMaterial.opacity = 0.7 + flickerB * 0.3;
    const innerScale = (0.85 + flickerB * 0.32) * speedPulse;
    this.flameInner.scale.set(innerScale, innerScale, 0.8 + flickerB * 0.5);

    this.engineGlowMaterial.opacity = 0.5 + flicker * 0.4;
    const glowScale = 0.9 + flicker * 0.5;
    this.engineGlow.scale.set(glowScale, glowScale, 1);
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
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedMaterials.length = 0;
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
    onHit: (target: THREE.Object3D, impactPosition: THREE.Vector3) => void
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
          const impactPosition = missile.mesh.position.clone().lerp(targetWorldPos, 0.35);
          this.particleSystem.createMissileImpact(impactPosition, 1.55);
          onHit(targetMesh, impactPosition);
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
