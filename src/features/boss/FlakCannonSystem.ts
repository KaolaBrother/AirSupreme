import * as THREE from 'three';
import { FLAK_CANNON_CONFIG } from './BossTypes';

interface FlakProjectileConfig {
  explosionRadius: number;
  onExplode?: (position: THREE.Vector3, radius: number, damage: number) => void;
}

interface FlakExplosionRecord {
  position: THREE.Vector3;
  radius: number;
  damage: number;
}

export class FlakProjectile {
  public mesh: THREE.Mesh;
  public velocity: THREE.Vector3;
  public active: boolean = true;
  public lifetime: number = 0;

  private readonly speed: number = FLAK_CANNON_CONFIG.SPEED;
  private readonly startPosition: THREE.Vector3;
  private readonly config: FlakProjectileConfig;
  private readonly detonationPosition: THREE.Vector3;
  private readonly totalDistance: number;
  private readonly warningDistance: number;
  private readonly minTravelBeforeArming: number;
  private readonly warningMesh: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly warningMaterial: THREE.MeshBasicMaterial;
  private readonly startToDetonation: THREE.Vector3 = new THREE.Vector3();
  private readonly startToCurrent: THREE.Vector3 = new THREE.Vector3();
  private armingTime: number = FLAK_CANNON_CONFIG.ARMING_TIME;
  private hasEnteredWarningZone: boolean = false;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    targetPosition: THREE.Vector3,
    config: FlakProjectileConfig
  ) {
    this.config = config;
    this.startPosition = position.clone();
    this.detonationPosition = this.computeDetonationPosition(position, targetPosition);
    this.totalDistance = Math.max(position.distanceTo(this.detonationPosition), 1);
    this.warningDistance = Math.min(
      Math.max(config.explosionRadius * 2.2, FLAK_CANNON_CONFIG.WARNING_DISTANCE * 0.6),
      Math.max(FLAK_CANNON_CONFIG.WARNING_DISTANCE, this.totalDistance * 0.42)
    );
    this.minTravelBeforeArming = Math.max(config.explosionRadius * 0.55, 16);

    const scale = FLAK_CANNON_CONFIG.SCALE;
    const geometry = new THREE.SphereGeometry(0.2 * scale, 14, 14);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffbf47,
      emissive: 0xff8f1f,
      emissiveIntensity: 0.9,
      metalness: 0.25,
      roughness: 0.16,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.copy(position);
    scene.add(this.mesh);

    const warningGeometry = new THREE.SphereGeometry(config.explosionRadius, 20, 20);
    this.warningMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc46d,
      transparent: true,
      opacity: 0,
      wireframe: true,
      depthWrite: false,
    });
    this.warningMesh = new THREE.Mesh(warningGeometry, this.warningMaterial);
    this.warningMesh.position.copy(this.detonationPosition);
    this.warningMesh.visible = false;
    scene.add(this.warningMesh);

    const direction = new THREE.Vector3()
      .subVectors(this.detonationPosition, position)
      .normalize();
    this.velocity = direction.multiplyScalar(this.speed);
  }

  public update(deltaTime: number): void {
    if (!this.active) return;

    this.lifetime += deltaTime;

    const flightDistance = this.mesh.position.distanceTo(this.startPosition);
    if (flightDistance > FLAK_CANNON_CONFIG.MAX_RANGE) {
      this.explode(this.mesh.position);
      return;
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);

    const distanceToTarget = this.mesh.position.distanceTo(this.detonationPosition);
    const armed = this.lifetime >= this.armingTime;
    const inWarningZone =
      distanceToTarget <= this.warningDistance && flightDistance >= this.minTravelBeforeArming;

    if (armed && inWarningZone) {
      this.hasEnteredWarningZone = true;
      this.updateWarningVisual(distanceToTarget);
    } else if (this.warningMesh.visible) {
      this.warningMesh.visible = false;
      this.warningMaterial.opacity = 0;
    }

    const pulse = Math.sin(this.lifetime * 22) * 0.5 + 0.5;
    this.material.emissiveIntensity = armed ? 1.1 + pulse * 0.55 : 0.7 + pulse * 0.25;
    this.mesh.scale.setScalar(1 + (armed ? pulse * 0.22 : pulse * 0.08));

    if (
      armed
      && (
        distanceToTarget <= FLAK_CANNON_CONFIG.DETONATION_DISTANCE
        || (this.hasEnteredWarningZone
          && (
            distanceToTarget <= this.config.explosionRadius * 0.7
            || this.hasPassedDetonationPoint()
          ))
      )
    ) {
      this.explode(this.detonationPosition);
    }
  }

  public forceExplode(): void {
    if (this.active) {
      this.explode(this.detonationPosition);
    }
  }

  public getTargetPosition(): THREE.Vector3 {
    return this.detonationPosition.clone();
  }

  private computeDetonationPosition(
    firePosition: THREE.Vector3,
    targetPosition: THREE.Vector3
  ): THREE.Vector3 {
    const toTarget = new THREE.Vector3().subVectors(targetPosition, firePosition);
    const distance = Math.max(toTarget.length(), 1);
    const direction = toTarget.clone().normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

    if (perpendicular.lengthSq() < 1e-6) {
      perpendicular.set(1, 0, 0);
    } else {
      perpendicular.normalize();
    }

    const maxLateralOffset = Math.min(this.config.explosionRadius * 0.32, 14);
    const maxVerticalOffset = Math.min(FLAK_CANNON_CONFIG.EXPLOSION_HEIGHT_VARIANCE * 0.45, 9);
    const lateralOffset = (Math.random() * 2 - 1) * maxLateralOffset;
    const verticalOffset = (Math.random() * 2 - 1) * maxVerticalOffset;
    const alongTrackOffset = (Math.random() * 2 - 1) * Math.min(distance * 0.06, 8);

    return targetPosition
      .clone()
      .addScaledVector(perpendicular, lateralOffset)
      .addScaledVector(direction, alongTrackOffset)
      .add(new THREE.Vector3(0, verticalOffset, 0));
  }

  private hasPassedDetonationPoint(): boolean {
    this.startToDetonation.subVectors(this.detonationPosition, this.startPosition);
    this.startToCurrent.subVectors(this.mesh.position, this.startPosition);
    const projection = this.startToCurrent.dot(this.startToDetonation);
    return projection >= this.startToDetonation.lengthSq();
  }

  private updateWarningVisual(distanceToTarget: number): void {
    const warningStrength = THREE.MathUtils.clamp(
      1 - distanceToTarget / Math.max(this.warningDistance, 0.001),
      0,
      1
    );
    this.warningMesh.visible = true;
    this.warningMaterial.opacity = 0.08 + warningStrength * 0.22;
    const ringScale = 0.92 + warningStrength * 0.18;
    this.warningMesh.scale.setScalar(ringScale);
  }

  private explode(explosionPosition: THREE.Vector3): void {
    this.active = false;
    this.mesh.position.copy(explosionPosition);
    this.warningMesh.visible = false;
    this.warningMaterial.opacity = 0;
    this.config.onExplode?.(
      explosionPosition.clone(),
      FLAK_CANNON_CONFIG.AOE_RADIUS,
      FLAK_CANNON_CONFIG.DAMAGE
    );
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.warningMesh);
    this.mesh.geometry.dispose();
    this.warningMesh.geometry.dispose();
    this.material.dispose();
    this.warningMaterial.dispose();
    this.active = false;
  }
}

export class FlakCannonSystem {
  private scene: THREE.Scene;
  private projectiles: FlakProjectile[] = [];
  private explosionRadius: number;
  private onExplode?: (position: THREE.Vector3, radius: number, damage: number) => void;
  private pendingExplosions: FlakExplosionRecord[] = [];

  constructor(
    scene: THREE.Scene,
    explosionRadius: number = FLAK_CANNON_CONFIG.AOE_RADIUS,
    onExplode?: (position: THREE.Vector3, radius: number, damage: number) => void
  ) {
    this.scene = scene;
    this.explosionRadius = explosionRadius;
    this.onExplode = onExplode;
  }

  public fire(position: THREE.Vector3, targetPosition: THREE.Vector3): void {
    const projectile = new FlakProjectile(this.scene, position, targetPosition, {
      explosionRadius: this.explosionRadius,
      onExplode: (explodePosition, radius, damage) => {
        this.pendingExplosions.push({
          position: explodePosition.clone(),
          radius,
          damage,
        });
        this.onExplode?.(explodePosition, radius, damage);
      },
    });
    this.projectiles.push(projectile);
  }

  public update(deltaTime: number): void {
    for (const projectile of this.projectiles) {
      if (projectile.active) {
        projectile.update(deltaTime);
      }
    }

    this.projectiles = this.projectiles.filter((projectile) => {
      if (!projectile.active) {
        projectile.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  public getProjectiles(): FlakProjectile[] {
    return this.projectiles.filter((projectile) => projectile.active);
  }

  public getProjectileMeshes(): THREE.Object3D[] {
    return this.projectiles.filter((projectile) => projectile.active).map((projectile) => projectile.getMesh());
  }

  public checkAoeCollisions(
    targets: THREE.Object3D[],
    onHit: (target: THREE.Object3D, damage: number) => void
  ): void {
    if (this.pendingExplosions.length === 0) {
      return;
    }

    for (const explosion of this.pendingExplosions) {
      for (const target of targets) {
        if (!target.parent) continue;

        const distance = explosion.position.distanceTo(target.position);
        if (distance <= explosion.radius) {
          onHit(target, explosion.damage);
        }
      }
    }

    this.pendingExplosions = [];
  }

  public forceExplodeAll(): void {
    for (const projectile of this.projectiles) {
      if (projectile.active) {
        projectile.forceExplode();
      }
    }
  }

  public dispose(): void {
    for (const projectile of this.projectiles) {
      projectile.dispose(this.scene);
    }
    this.projectiles = [];
    this.pendingExplosions = [];
  }
}
