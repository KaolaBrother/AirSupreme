import * as THREE from 'three';
import { ParticleSystem, getVfxTextures } from '@/features/effects/ParticleSystem';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BOSS_MISSILE_CONFIG } from './BossTypes';

const BOSS_MISSILE_TRAIL_INTERVAL = 0.04;

// 弹体基准尺寸（乘以 BOSS_MISSILE_CONFIG.SCALE）。
// 含弹头总长 ≈ 3.82 × SCALE，直径 0.52 × SCALE → 长径比 ≈ 7.3，重型巡航弹观感
const BOSS_BODY_RADIUS = 0.26;
const BOSS_BODY_LENGTH = 2.9;

/**
 * Boss 重型导弹共享几何体（全部预旋转为 +Z 朝前，烘焙 SCALE）
 */
interface BossMissileGeometries {
  body: THREE.CylinderGeometry;
  noseFrustum: THREE.CylinderGeometry;
  radome: THREE.ConeGeometry;
  stripe: THREE.CylinderGeometry;
  band: THREE.CylinderGeometry;
  strake: THREE.BoxGeometry;
  fin: THREE.BoxGeometry;
  nozzleRing: THREE.TorusGeometry;
  nozzleCup: THREE.CylinderGeometry;
  flameOuter: THREE.ConeGeometry;
  flameInner: THREE.ConeGeometry;
}

let sharedBossMissileGeometries: BossMissileGeometries | null = null;

function getBossMissileGeometries(): BossMissileGeometries {
  if (!sharedBossMissileGeometries) {
    const s = BOSS_MISSILE_CONFIG.SCALE;
    const r = BOSS_BODY_RADIUS * s;
    const len = BOSS_BODY_LENGTH * s;

    // 细长主弹体
    const body = new THREE.CylinderGeometry(r, r, len, 14);
    body.rotateX(Math.PI / 2);
    // 头部过渡锥台（弹体 → 雷达罩）
    const noseFrustum = new THREE.CylinderGeometry(r * 0.5, r, 0.42 * s, 14);
    noseFrustum.rotateX(Math.PI / 2);
    // 钝头雷达罩
    const radome = new THREE.ConeGeometry(r * 0.5, 0.5 * s, 14);
    radome.rotateX(Math.PI / 2);
    // 警示色带 / 检修面板带（略大于弹体半径，避免 z-fighting）
    const stripe = new THREE.CylinderGeometry(r * 1.045, r * 1.045, 0.14 * s, 14);
    stripe.rotateX(Math.PI / 2);
    const band = new THREE.CylinderGeometry(r * 1.025, r * 1.025, 0.5 * s, 14);
    band.rotateX(Math.PI / 2);
    // 中段边条翼 / 大型十字尾翼
    const strake = new THREE.BoxGeometry(0.05 * s, 0.22 * s, 1.3 * s);
    const fin = new THREE.BoxGeometry(0.07 * s, 0.72 * s, 0.85 * s);
    // 喷口环 + 喷管内衬（开口锥台）
    const nozzleRing = new THREE.TorusGeometry(0.22 * s, 0.045 * s, 8, 18);
    const nozzleCup = new THREE.CylinderGeometry(0.17 * s, 0.21 * s, 0.3 * s, 14, 1, true);
    nozzleCup.rotateX(Math.PI / 2);
    // 双层尾焰（开口锥，尖端朝后）
    const flameOuter = new THREE.ConeGeometry(0.24 * s, 1.6 * s, 12, 1, true);
    flameOuter.rotateX(-Math.PI / 2);
    const flameInner = new THREE.ConeGeometry(0.13 * s, 1.0 * s, 10, 1, true);
    flameInner.rotateX(-Math.PI / 2);

    sharedBossMissileGeometries = {
      body,
      noseFrustum,
      radome,
      stripe,
      band,
      strake,
      fin,
      nozzleRing,
      nozzleCup,
      flameOuter,
      flameInner,
    };
  }
  return sharedBossMissileGeometries;
}

/** 静态外观材质（不参与脉动动画，全弹共享，不随单发销毁） */
interface BossMissileStaticMaterials {
  radome: THREE.MeshStandardMaterial;
  fin: THREE.MeshStandardMaterial;
  stripe: THREE.MeshStandardMaterial;
  band: THREE.MeshStandardMaterial;
  nozzleCup: THREE.MeshStandardMaterial;
}

let sharedBossMissileMaterials: BossMissileStaticMaterials | null = null;

function getBossMissileStaticMaterials(): BossMissileStaticMaterials {
  if (!sharedBossMissileMaterials) {
    sharedBossMissileMaterials = {
      // 深色亮面雷达罩
      radome: new THREE.MeshStandardMaterial({
        color: 0x141418,
        metalness: 0.6,
        roughness: 0.18,
      }),
      // 枪铁色翼面
      fin: new THREE.MeshStandardMaterial({
        color: 0x23262b,
        metalness: 0.85,
        roughness: 0.35,
      }),
      // 琥珀色警示带
      stripe: new THREE.MeshStandardMaterial({
        color: 0xffb52e,
        emissive: 0x8a5a00,
        emissiveIntensity: 0.35,
        metalness: 0.3,
        roughness: 0.5,
      }),
      // 检修面板带
      band: new THREE.MeshStandardMaterial({
        color: 0x2a2d33,
        metalness: 0.8,
        roughness: 0.45,
      }),
      // 喷管内衬
      nozzleCup: new THREE.MeshStandardMaterial({
        color: 0x17171b,
        metalness: 0.95,
        roughness: 0.3,
        side: THREE.DoubleSide,
      }),
    };
  }
  return sharedBossMissileMaterials;
}

export class BossMissile {
  public mesh: THREE.Group;
  public velocity: THREE.Vector3;
  public target: THREE.Object3D | null = null;
  public active: boolean = true;
  public lifetime: number = 0;
  public isTargetingPlayer: boolean = false;

  private turnSpeed: number = 0.25;
  private speed: number = 50;
  private particleSystem: ParticleSystem;
  private health: HealthSystem;
  private startPosition: THREE.Vector3;
  private potentialTargets: THREE.Object3D[] = [];
  private playerMesh: THREE.Object3D | null = null;
  private trailTimer: number = BOSS_MISSILE_TRAIL_INTERVAL;
  private visualPulseTime: number = 0;
  private readonly lookTarget = new THREE.Vector3();
  private readonly orientationHelper = new THREE.Object3D();
  private readonly trailPosition = new THREE.Vector3();
  private readonly backwardDirection = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();
  private readonly targetPosition = new THREE.Vector3();
  private readonly targetDirection = new THREE.Vector3();
  private readonly currentDirection = new THREE.Vector3();
  private readonly ownedMaterials: THREE.Material[] = [];
  private bodyMaterial!: THREE.MeshStandardMaterial;
  private ringMaterial!: THREE.MeshStandardMaterial;
  private thrustMaterial!: THREE.MeshBasicMaterial;
  private innerThrustMaterial!: THREE.MeshBasicMaterial;
  private engineGlowMaterial!: THREE.SpriteMaterial;
  private engineGlow!: THREE.Sprite;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    target: THREE.Object3D | null,
    particleSystem: ParticleSystem,
    potentialTargets: THREE.Object3D[] = [],
    playerMesh: THREE.Object3D | null = null
  ) {
    this.particleSystem = particleSystem;
    this.target = target;
    this.potentialTargets = potentialTargets;
    this.playerMesh = playerMesh;
    this.startPosition = position.clone();
    this.health = new HealthSystem(BOSS_MISSILE_CONFIG.HEALTH);

    // 判断初始目标是否是玩家
    if (!target && playerMesh) {
      this.isTargetingPlayer = true;
    }

    this.health.onDeath = () => {
      this.active = false;
      this.particleSystem.createBossMissileExplosion(this.mesh.position.clone(), 1.6);
    };

    this.mesh = new THREE.Group();
    this.buildMissileModel();

    this.mesh.position.copy(position);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3(0, this.speed, 0);

    this.lookTarget.copy(this.mesh.position).add(this.velocity);
    this.mesh.lookAt(this.lookTarget);
  }

  /**
   * 构建重型反舰/巡航弹模型（仅视觉，+Z 朝前）：
   * 细长深红枪铁色弹体 + 钝头雷达罩 + 大型十字尾翼（X 布局）+ 中段边条翼
   * + 琥珀警示带 / 检修面板带 + 喷口环喷管 + 既有的双层加色尾焰与引擎光晕。
   * 体量明显大于玩家导弹（总长 ≈ 3.8 × SCALE ≈ 15 单位）。
   */
  private buildMissileModel(): void {
    const s = BOSS_MISSILE_CONFIG.SCALE;
    const geometries = getBossMissileGeometries();
    const staticMaterials = getBossMissileStaticMaterials();

    // 弹体材质随威胁脉动，逐发持有
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x5e1b1f,
      emissive: 0x3c0303,
      emissiveIntensity: 0.18,
      metalness: 0.75,
      roughness: 0.35,
    });
    this.ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.72,
    });
    this.thrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.innerThrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff0b0,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.engineGlowMaterial = new THREE.SpriteMaterial({
      map: getVfxTextures().glow,
      color: 0xff6a33,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ownedMaterials.push(
      this.bodyMaterial,
      this.ringMaterial,
      this.thrustMaterial,
      this.innerThrustMaterial,
      this.engineGlowMaterial
    );

    // 主弹体（中心 z=0，前后各 1.45s）
    const body = new THREE.Mesh(geometries.body, this.bodyMaterial);
    this.mesh.add(body);

    // 头部过渡锥台 + 钝头雷达罩
    const noseFrustum = new THREE.Mesh(geometries.noseFrustum, this.bodyMaterial);
    noseFrustum.position.z = 1.66 * s;
    this.mesh.add(noseFrustum);

    const radome = new THREE.Mesh(geometries.radome, staticMaterials.radome);
    radome.position.z = 2.12 * s;
    this.mesh.add(radome);

    // 警示带（头/尾各一道）+ 中段检修面板带
    const stripeFront = new THREE.Mesh(geometries.stripe, staticMaterials.stripe);
    stripeFront.position.z = 1.2 * s;
    this.mesh.add(stripeFront);

    const stripeRear = new THREE.Mesh(geometries.stripe, staticMaterials.stripe);
    stripeRear.position.z = -1.0 * s;
    this.mesh.add(stripeRear);

    const panelBand = new THREE.Mesh(geometries.band, staticMaterials.band);
    panelBand.position.z = 0.35 * s;
    this.mesh.add(panelBand);

    // 中段边条翼（十字直列）+ 大型尾翼（X 布局，更具压迫感）
    const strakeOffset = (BOSS_BODY_RADIUS + 0.11) * s;
    const finOffset = (BOSS_BODY_RADIUS + 0.36) * s;
    for (let i = 0; i < 4; i++) {
      const strakeAngle = (i / 4) * Math.PI * 2;
      const strake = new THREE.Mesh(geometries.strake, staticMaterials.fin);
      strake.position.x = Math.cos(strakeAngle) * strakeOffset;
      strake.position.y = Math.sin(strakeAngle) * strakeOffset;
      strake.position.z = 0.1 * s;
      strake.rotation.z = strakeAngle + Math.PI / 2;
      this.mesh.add(strake);

      const finAngle = strakeAngle + Math.PI / 4;
      const fin = new THREE.Mesh(geometries.fin, staticMaterials.fin);
      fin.position.x = Math.cos(finAngle) * finOffset;
      fin.position.y = Math.sin(finAngle) * finOffset;
      fin.position.z = -1.15 * s;
      fin.rotation.z = finAngle + Math.PI / 2;
      this.mesh.add(fin);
    }

    // 喷口环 + 喷管内衬，衔接双层尾焰
    const nozzleRing = new THREE.Mesh(geometries.nozzleRing, this.ringMaterial);
    nozzleRing.position.z = -1.47 * s;
    this.mesh.add(nozzleRing);

    const nozzleCup = new THREE.Mesh(geometries.nozzleCup, staticMaterials.nozzleCup);
    nozzleCup.position.z = -1.5 * s;
    this.mesh.add(nozzleCup);

    // 外层橙红尾焰 + 内层白热焰芯（加色混合，高频闪烁见 updateVisuals）
    const thrust = new THREE.Mesh(geometries.flameOuter, this.thrustMaterial);
    thrust.position.z = -2.27 * s;
    this.mesh.add(thrust);

    const innerThrust = new THREE.Mesh(geometries.flameInner, this.innerThrustMaterial);
    innerThrust.position.z = -1.97 * s;
    this.mesh.add(innerThrust);

    // 引擎光晕 sprite：让 Boss 导弹在远距离也读得到威胁
    this.engineGlow = new THREE.Sprite(this.engineGlowMaterial);
    const glowSize = BOSS_BODY_RADIUS * s * 4.2;
    this.engineGlow.scale.set(glowSize, glowSize, 1);
    this.engineGlow.position.z = -1.75 * s;
    this.mesh.add(this.engineGlow);
  }

  public update(deltaTime: number): void {
    if (!this.active) return;

    this.lifetime += deltaTime;

    const flightDistance = this.mesh.position.distanceTo(this.startPosition);
    if (flightDistance > BOSS_MISSILE_CONFIG.MAX_RANGE) {
      this.active = false;
      return;
    }

    if (this.mesh.position.y <= -50) {
      this.active = false;
      this.particleSystem.createBossMissileExplosion(this.mesh.position.clone(), 1.5);
      return;
    }

    if (!this.target || (!this.isTargetingPlayer && !this.target.parent)) {
      this.findNewTarget();
    }

    if (this.isTargetingPlayer || (this.target && this.target.parent)) {
      this.huntTarget(deltaTime);
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);
    this.visualPulseTime += deltaTime;
    this.updateVisuals();

    if (this.velocity.length() > 0) {
      this.lookTarget.copy(this.mesh.position).add(this.velocity);
      this.orientationHelper.position.copy(this.mesh.position);
      this.orientationHelper.lookAt(this.lookTarget);
      this.mesh.quaternion.slerp(this.orientationHelper.quaternion, 0.3);
    }

    this.trailTimer += deltaTime;
    while (this.trailTimer >= BOSS_MISSILE_TRAIL_INTERVAL) {
      this.trailTimer -= BOSS_MISSILE_TRAIL_INTERVAL;
      this.emitTrail();
    }
  }

  private findNewTarget(): void {
    if (this.isTargetingPlayer && this.playerMesh) {
      return;
    }

    this.isTargetingPlayer = false;
    let nearestTarget: THREE.Object3D | null = null;
    let minDistance = Infinity;

    for (const potentialTarget of this.potentialTargets) {
      if (potentialTarget.parent) {
        const dist = this.mesh.position.distanceTo(potentialTarget.position);
        if (dist < minDistance) {
          minDistance = dist;
          nearestTarget = potentialTarget;
        }
      }
    }

    if (nearestTarget) {
      this.target = nearestTarget;
      return;
    }

    if (this.playerMesh) {
      this.isTargetingPlayer = true;
    }
  }

  private huntTarget(deltaTime: number): void {
    if (this.isTargetingPlayer && this.playerMesh) {
      this.targetPosition.copy(this.playerMesh.position);
    } else if (this.target) {
      this.targetPosition.copy(this.target.position);
    } else {
      return;
    }

    this.targetDirection.subVectors(this.targetPosition, this.mesh.position).normalize();
    this.currentDirection.copy(this.velocity).normalize();
    const turnAngle = this.turnSpeed * deltaTime;

    this.currentDirection.lerp(this.targetDirection, turnAngle * 2);
    this.currentDirection.normalize();
    this.velocity.copy(this.currentDirection).multiplyScalar(this.speed);
  }

  private emitTrail(): void {
    this.trailPosition.copy(this.mesh.position);
    this.backwardDirection
      .copy(this.velocity)
      .normalize()
      .multiplyScalar(-1.5 * BOSS_MISSILE_CONFIG.SCALE);
    this.trailPosition.add(this.backwardDirection);
    this.trailColor.setHSL(0.045 + Math.random() * 0.02, 1, 0.58);
    this.particleSystem.createBossMissileTrail(this.trailPosition, this.velocity);
  }

  private updateVisuals(): void {
    const t = this.visualPulseTime;
    // 高频双频闪烁的尾焰 + 较慢的弹体威胁脉动
    const pulse = 0.7 + Math.sin(t * 18) * 0.2;
    const flicker = 0.5 + 0.3 * Math.sin(t * 46) + 0.2 * Math.sin(t * 73 + 1.3);
    this.bodyMaterial.emissiveIntensity = 0.12 + pulse * 0.16;
    this.ringMaterial.emissiveIntensity = 0.56 + pulse * 0.42;
    this.thrustMaterial.opacity = 0.55 + flicker * 0.35;
    this.innerThrustMaterial.opacity = 0.7 + flicker * 0.3;
    this.engineGlowMaterial.opacity = 0.5 + flicker * 0.4;
    const glowPulse = 1 + flicker * 0.45;
    const glowBase = BOSS_BODY_RADIUS * BOSS_MISSILE_CONFIG.SCALE * 4.2;
    this.engineGlow.scale.set(glowBase * glowPulse, glowBase * glowPulse, 1);
  }

  public takeDamage(damage: number): void {
    this.particleSystem.createHit(this.mesh.position, 1.2);
    this.health.takeDamage(damage);
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedMaterials.length = 0;
    this.active = false;
  }
}

export class BossMissileSystem {
  private scene: THREE.Scene;
  private particleSystem: ParticleSystem;
  private missiles: BossMissile[] = [];

  constructor(scene: THREE.Scene, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.particleSystem = particleSystem;
  }

  public fire(
    position: THREE.Vector3,
    target: THREE.Object3D | null,
    potentialTargets: THREE.Object3D[] = [],
    playerMesh: THREE.Object3D | null = null,
    targetingPlayer: boolean = false
  ): void {
    const missile = new BossMissile(
      this.scene,
      position,
      target,
      this.particleSystem,
      potentialTargets,
      playerMesh
    );
    missile.isTargetingPlayer = targetingPlayer;
    this.missiles.push(missile);
  }

  public update(deltaTime: number): void {
    for (const missile of this.missiles) {
      if (missile.active) {
        missile.update(deltaTime);
      }
    }

    this.missiles = this.missiles.filter((m) => {
      if (!m.active) {
        m.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  public getMissiles(): BossMissile[] {
    return this.missiles.filter((m) => m.active);
  }

  public getMissileMeshes(): THREE.Object3D[] {
    return this.missiles.filter((m) => m.active).map((m) => m.mesh);
  }

  public checkCollisions(
    targetMeshes: THREE.Object3D[],
    onHit: (target: THREE.Object3D, damage: number) => void
  ): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;

      for (const targetMesh of targetMeshes) {
        if (!targetMesh.parent) continue;

        const distance = missile.mesh.position.distanceTo(targetMesh.position);
        const hitDistance = 5 + BOSS_MISSILE_CONFIG.SCALE;

        if (distance < hitDistance) {
          missile.active = false;
          this.particleSystem.createBossMissileExplosion(missile.mesh.position.clone(), 1.45);
          onHit(targetMesh, BOSS_MISSILE_CONFIG.DAMAGE);
          break;
        }
      }
    }
  }

  public dispose(): void {
    for (const missile of this.missiles) {
      missile.dispose(this.scene);
    }
    this.missiles = [];
  }
}
