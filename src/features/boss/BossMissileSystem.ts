import * as THREE from 'three';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BOSS_MISSILE_CONFIG } from './BossTypes';

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
      this.particleSystem.createExplosion(this.mesh.position.clone(), 1.5);
    };

    this.mesh = new THREE.Group();
    const scale = BOSS_MISSILE_CONFIG.SCALE;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
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
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
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
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.z = -bodyLength * 0.1;
    this.mesh.add(ring);

    const thrustGeometry = new THREE.ConeGeometry(bodyRadius * 0.6, bodyLength * 0.8, 8);
    const thrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
    });
    const thrust = new THREE.Mesh(thrustGeometry, thrustMaterial);
    thrust.rotation.x = Math.PI / 2;
    thrust.position.z = -bodyLength * 0.7;
    this.mesh.add(thrust);

    const innerThrustGeometry = new THREE.ConeGeometry(bodyRadius * 0.3, bodyLength * 0.5, 8);
    const innerThrustMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    });
    const innerThrust = new THREE.Mesh(innerThrustGeometry, innerThrustMaterial);
    innerThrust.rotation.x = Math.PI / 2;
    innerThrust.position.z = -bodyLength * 0.5;
    this.mesh.add(innerThrust);

    this.mesh.position.copy(position);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3(0, this.speed, 0);

    this.mesh.lookAt(this.mesh.position.clone().add(this.velocity));
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
      this.particleSystem.createExplosion(this.mesh.position.clone(), 1.5);
      return;
    }

    if (!this.target || (!this.isTargetingPlayer && !this.target.parent)) {
      this.findNewTarget();
    }

    if (this.isTargetingPlayer || (this.target && this.target.parent)) {
      this.huntTarget(deltaTime);
    }

    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    if (this.velocity.length() > 0) {
      const targetPos = this.mesh.position.clone().add(this.velocity);
      const dummy = new THREE.Object3D();
      dummy.position.copy(this.mesh.position);
      dummy.lookAt(targetPos);
      this.mesh.quaternion.slerp(dummy.quaternion, 0.3);
    }

    const trailPosition = this.mesh.position.clone();
    const backwardDirection = this.velocity
      .clone()
      .normalize()
      .multiplyScalar(-1.5 * BOSS_MISSILE_CONFIG.SCALE);
    trailPosition.add(backwardDirection);
    const trailColor = new THREE.Color().setHSL(0.05 + Math.random() * 0.03, 1, 0.6);
    this.particleSystem.createTrail(trailPosition, trailColor);
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
    let targetPosition: THREE.Vector3;

    if (this.isTargetingPlayer && this.playerMesh) {
      targetPosition = this.playerMesh.position.clone();
    } else if (this.target) {
      targetPosition = this.target.position.clone();
    } else {
      return;
    }

    const targetDirection = new THREE.Vector3()
      .subVectors(targetPosition, this.mesh.position)
      .normalize();

    const currentDirection = this.velocity.clone().normalize();
    const turnAngle = this.turnSpeed * deltaTime;

    const newDirection = currentDirection.clone();
    newDirection.lerp(targetDirection, turnAngle * 2);
    newDirection.normalize();

    this.velocity.copy(newDirection).multiplyScalar(this.speed);
  }

  public takeDamage(damage: number): void {
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
