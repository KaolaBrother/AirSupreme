import * as THREE from 'three';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BOSS_MISSILE_CONFIG } from './BossTypes';

const BOSS_MISSILE_TRAIL_INTERVAL = 0.04;

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
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly ringMaterial: THREE.MeshStandardMaterial;
  private readonly thrustMaterial: THREE.MeshBasicMaterial;
  private readonly innerThrustMaterial: THREE.MeshBasicMaterial;

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
    const scale = BOSS_MISSILE_CONFIG.SCALE;

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      emissive: 0x3c0303,
      emissiveIntensity: 0.18,
      metalness: 0.7,
      roughness: 0.3,
    });

    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.2,
    });

    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.8,
      roughness: 0.3,
    });

    const bodyLength = 2.0 * scale;
    const bodyRadius = 0.35 * scale;

    const bodyGeometry = new THREE.CylinderGeometry(bodyRadius * 0.8, bodyRadius, bodyLength, 12);
    const body = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
    body.rotation.x = Math.PI / 2;
    body.position.z = bodyLength * 0.1;
    this.mesh.add(body);

    const noseGeometry = new THREE.ConeGeometry(bodyRadius * 0.8, bodyLength * 0.6, 12);
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = bodyLength * 0.7;
    this.mesh.add(nose);

    const finCount = 4;
    const finLength = bodyLength * 0.4;
    const finHeight = bodyRadius * 1.0;

    for (let i = 0; i < finCount; i++) {
      const angle = (i / finCount) * Math.PI * 2;

      const finGeometry = new THREE.BoxGeometry(0.1 * scale, finHeight, finLength);
      const fin = new THREE.Mesh(finGeometry, finMaterial);

      fin.position.x = Math.cos(angle) * (bodyRadius + finHeight * 0.5);
      fin.position.y = Math.sin(angle) * (bodyRadius + finHeight * 0.5);
      fin.position.z = -bodyLength * 0.3;

      fin.rotation.z = angle;

      this.mesh.add(fin);
    }

    const ringGeometry = new THREE.TorusGeometry(bodyRadius * 1.1, 0.05 * scale, 8, 16);
    this.ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.72,
    });
    const ring = new THREE.Mesh(ringGeometry, this.ringMaterial);
    ring.position.z = -bodyLength * 0.1;
    this.mesh.add(ring);

    const thrustGeometry = new THREE.ConeGeometry(bodyRadius * 0.6, bodyLength * 0.8, 8);
    this.thrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
    });
    const thrust = new THREE.Mesh(thrustGeometry, this.thrustMaterial);
    thrust.rotation.x = Math.PI / 2;
    thrust.position.z = -bodyLength * 0.7;
    this.mesh.add(thrust);

    const innerThrustGeometry = new THREE.ConeGeometry(bodyRadius * 0.3, bodyLength * 0.5, 8);
    this.innerThrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    });
    const innerThrust = new THREE.Mesh(innerThrustGeometry, this.innerThrustMaterial);
    innerThrust.rotation.x = Math.PI / 2;
    innerThrust.position.z = -bodyLength * 0.5;
    this.mesh.add(innerThrust);

    this.mesh.position.copy(position);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3(0, this.speed, 0);

    this.lookTarget.copy(this.mesh.position).add(this.velocity);
    this.mesh.lookAt(this.lookTarget);
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
    const pulse = 0.7 + Math.sin(this.visualPulseTime * 18) * 0.2;
    this.bodyMaterial.emissiveIntensity = 0.12 + pulse * 0.16;
    this.ringMaterial.emissiveIntensity = 0.56 + pulse * 0.42;
    this.thrustMaterial.opacity = 0.68 + pulse * 0.22;
    this.innerThrustMaterial.opacity = 0.78 + pulse * 0.2;
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
