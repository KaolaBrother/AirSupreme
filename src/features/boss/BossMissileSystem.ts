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

  private turnSpeed: number = 1.0;
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

    const coneGeometry = new THREE.ConeGeometry(0.4 * scale, 2.5 * scale, 16);
    const coneMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.rotation.x = Math.PI / 2;
    this.mesh.add(cone);

    const trailGeometry = new THREE.ConeGeometry(0.25 * scale, 2 * scale, 16);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 1,
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.rotation.x = Math.PI / 2;
    trail.position.z = -1.5 * scale;
    this.mesh.add(trail);

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
