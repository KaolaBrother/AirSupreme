import * as THREE from 'three';
import { FLAK_CANNON_CONFIG } from './BossTypes';

interface FlakProjectileConfig {
  explosionRadius: number;
  onExplode?: (position: THREE.Vector3, radius: number, damage: number) => void;
}

export class FlakProjectile {
  public mesh: THREE.Mesh;
  public velocity: THREE.Vector3;
  public active: boolean = true;
  public lifetime: number = 0;

  private speed: number = FLAK_CANNON_CONFIG.SPEED;
  private startPosition: THREE.Vector3;
  private config: FlakProjectileConfig;
  private targetPosition: THREE.Vector3;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    targetPosition: THREE.Vector3,
    config: FlakProjectileConfig
  ) {
    this.config = config;
    this.startPosition = position.clone();
    this.targetPosition = targetPosition.clone();

    const scale = FLAK_CANNON_CONFIG.SCALE;
    const geometry = new THREE.SphereGeometry(0.15 * scale, 12, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    scene.add(this.mesh);

    const direction = new THREE.Vector3().subVectors(targetPosition, position).normalize();
    this.velocity = direction.multiplyScalar(this.speed);
  }

  public update(_deltaTime: number): void {
    if (!this.active) return;

    this.lifetime += 1;

    const flightDistance = this.mesh.position.distanceTo(this.startPosition);
    if (flightDistance > FLAK_CANNON_CONFIG.MAX_RANGE) {
      this.active = false;
      return;
    }

    const distanceToTarget = this.mesh.position.distanceTo(this.targetPosition);
    if (distanceToTarget <= 10) {
      this.explode();
      return;
    }

    this.mesh.position.add(this.velocity.clone().multiplyScalar(1 / 60));
  }

  public forceExplode(): void {
    if (this.active) {
      this.explode();
    }
  }

  private explode(): void {
    this.active = false;
    this.config.onExplode?.(
      this.mesh.position.clone(),
      this.config.explosionRadius,
      FLAK_CANNON_CONFIG.DAMAGE
    );
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
    this.active = false;
  }
}

export class FlakCannonSystem {
  private scene: THREE.Scene;
  private projectiles: FlakProjectile[] = [];
  private explosionRadius: number;
  private onExplode?: (position: THREE.Vector3, radius: number, damage: number) => void;

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
      onExplode: this.onExplode,
    });
    this.projectiles.push(projectile);
  }

  public update(deltaTime: number): void {
    for (const projectile of this.projectiles) {
      if (projectile.active) {
        projectile.update(deltaTime);
      }
    }

    this.projectiles = this.projectiles.filter((p) => {
      if (!p.active) {
        p.dispose(this.scene);
        return false;
      }
      return true;
    });
  }

  public getProjectiles(): FlakProjectile[] {
    return this.projectiles.filter((p) => p.active);
  }

  public getProjectileMeshes(): THREE.Object3D[] {
    return this.projectiles.filter((p) => p.active).map((p) => p.mesh);
  }

  public checkAoeCollisions(
    targets: THREE.Object3D[],
    onHit: (target: THREE.Object3D, damage: number) => void
  ): void {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;

      const explosionCenter = projectile.mesh.position.clone();
      const explosionRadius = this.explosionRadius;

      for (const target of targets) {
        if (!target.parent) continue;

        const distance = explosionCenter.distanceTo(target.position);
        if (distance <= explosionRadius) {
          onHit(target, FLAK_CANNON_CONFIG.DAMAGE);
        }
      }
    }
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
  }
}
