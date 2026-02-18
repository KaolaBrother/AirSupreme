import * as THREE from 'three';
import { EYE_CONFIG } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';

interface Eye {
  mesh: THREE.Mesh;
  health: HealthSystem;
  index: number;
  baseAngle: number;
  destroyed: boolean;
  fireCooldown: number;
}

interface LaserBullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  active: boolean;
  startPosition: THREE.Vector3;
  lifetime: number;
}

export class EyeSystem {
  private eyes: Eye[] = [];
  private bullets: LaserBullet[] = [];
  private scene: THREE.Scene;
  private config: typeof EYE_CONFIG;

  public onEyeDestroyed?: (index: number, position: THREE.Vector3) => void;
  public onEyeDamaged?: (damage: number) => void;
  public onFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.config = EYE_CONFIG;
  }

  public createEyes(bossMesh: THREE.Group): void {
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.3,
    });

    for (let i = 0; i < this.config.COUNT; i++) {
      const baseAngle = (i / this.config.COUNT) * Math.PI * 2;
      const eye = this.createEye(i, baseAngle, eyeMaterial);
      this.eyes.push(eye);
      bossMesh.add(eye.mesh);
    }
  }

  private createEye(index: number, baseAngle: number, material: THREE.MeshStandardMaterial): Eye {
    const eyeGeometry = new THREE.SphereGeometry(3, 16, 16);
    const eye = new THREE.Mesh(eyeGeometry, material.clone());
    eye.name = `boss_eye_${index}`;
    eye.castShadow = true;

    const radius = 15;
    eye.position.set(Math.cos(baseAngle) * radius, 0, Math.sin(baseAngle) * radius);

    const health = new HealthSystem(this.config.HEALTH);
    health.onDeath = () => {
      this.destroyEye(index);
    };

    return {
      mesh: eye,
      health,
      index,
      baseAngle,
      destroyed: false,
      fireCooldown: Math.random() * this.config.FIRE_INTERVAL,
    };
  }

  public update(
    deltaTime: number,
    bossPosition: THREE.Vector3,
    playerPosition: THREE.Vector3 | null,
    friendlyPositions: THREE.Vector3[] = []
  ): void {
    this.updateEyes(deltaTime, bossPosition, playerPosition, friendlyPositions);
    this.updateBullets(deltaTime);
  }

  private updateEyes(
    deltaTime: number,
    _bossPosition: THREE.Vector3,
    playerPosition: THREE.Vector3 | null,
    friendlyPositions: THREE.Vector3[]
  ): void {
    for (const eye of this.eyes) {
      if (eye.destroyed) continue;

      eye.fireCooldown -= deltaTime;

      if (eye.fireCooldown <= 0) {
        const eyeWorldPos = new THREE.Vector3();
        eye.mesh.getWorldPosition(eyeWorldPos);

        const nearestTarget = this.findNearestTarget(
          eyeWorldPos,
          playerPosition,
          friendlyPositions
        );
        if (nearestTarget) {
          this.fireEyeBullet(eye, nearestTarget);
          eye.fireCooldown = this.config.FIRE_INTERVAL;
        }
      }
    }
  }

  private findNearestTarget(
    eyePos: THREE.Vector3,
    playerPosition: THREE.Vector3 | null,
    friendlyPositions: THREE.Vector3[]
  ): THREE.Vector3 | null {
    let nearestTarget: THREE.Vector3 | null = null;
    let minDistance = Infinity;

    if (playerPosition) {
      const playerDist = eyePos.distanceTo(playerPosition);
      if (playerDist < minDistance) {
        minDistance = playerDist;
        nearestTarget = playerPosition;
      }
    }

    for (const friendlyPos of friendlyPositions) {
      const friendlyDist = eyePos.distanceTo(friendlyPos);
      if (friendlyDist < minDistance) {
        minDistance = friendlyDist;
        nearestTarget = friendlyPos;
      }
    }

    return nearestTarget;
  }

  private fireEyeBullet(eye: Eye, targetPosition: THREE.Vector3): void {
    const eyeWorldPos = new THREE.Vector3();
    eye.mesh.getWorldPosition(eyeWorldPos);

    const direction = new THREE.Vector3().subVectors(targetPosition, eyeWorldPos).normalize();

    const bulletGeometry = new THREE.CylinderGeometry(
      this.config.BULLET_RADIUS,
      this.config.BULLET_RADIUS,
      this.config.BULLET_LENGTH,
      8
    );
    const bulletMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.9,
    });

    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(eyeWorldPos);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    bullet.quaternion.copy(quaternion);

    this.scene.add(bullet);

    this.bullets.push({
      mesh: bullet,
      velocity: direction.clone().multiplyScalar(this.config.BULLET_SPEED),
      active: true,
      startPosition: eyeWorldPos.clone(),
      lifetime: 0,
    });

    this.onFire?.(eyeWorldPos, direction, this.config.DAMAGE);
  }

  private updateBullets(deltaTime: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (!bullet.active) continue;

      bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(deltaTime));
      bullet.lifetime += deltaTime;

      const distance = bullet.mesh.position.distanceTo(bullet.startPosition);
      if (distance > 1000 || bullet.lifetime > 10) {
        this.disposeBullet(bullet, i);
      }
    }
  }

  private disposeBullet(bullet: LaserBullet, index: number): void {
    bullet.active = false;
    this.scene.remove(bullet.mesh);
    bullet.mesh.geometry.dispose();
    if (bullet.mesh.material instanceof THREE.Material) {
      bullet.mesh.material.dispose();
    }
    this.bullets.splice(index, 1);
  }

  private destroyEye(index: number): void {
    const eye = this.eyes.find((e) => e.index === index);
    if (!eye || eye.destroyed) return;

    eye.destroyed = true;
    eye.mesh.visible = false;

    const worldPos = new THREE.Vector3();
    eye.mesh.getWorldPosition(worldPos);

    this.onEyeDestroyed?.(index, worldPos);
  }

  public damageEye(eyeIndex: number, damage: number): void {
    const eye = this.eyes.find((e) => e.index === eyeIndex);
    if (!eye || eye.destroyed) return;

    eye.health.takeDamage(damage);
    this.onEyeDamaged?.(damage);
  }

  public damageNearestEye(hitPosition: THREE.Vector3, damage: number): void {
    let nearestEye: Eye | null = null;
    let minDistance = Infinity;

    for (const eye of this.eyes) {
      if (eye.destroyed) continue;

      const eyeWorldPos = new THREE.Vector3();
      eye.mesh.getWorldPosition(eyeWorldPos);

      const distance = eyeWorldPos.distanceTo(hitPosition);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEye = eye;
      }
    }

    if (nearestEye) {
      nearestEye.health.takeDamage(damage);
      this.onEyeDamaged?.(damage);
    }
  }

  public getActiveEyeMeshes(): THREE.Object3D[] {
    return this.eyes.filter((e) => !e.destroyed).map((e) => e.mesh);
  }

  public getCollisionParts(): { mesh: THREE.Object3D; index: number }[] {
    return this.eyes.filter((e) => !e.destroyed).map((e) => ({ mesh: e.mesh, index: e.index }));
  }

  public getBulletMeshes(): THREE.Object3D[] {
    return this.bullets.filter((b) => b.active).map((b) => b.mesh);
  }

  public removeBullet(bulletMesh: THREE.Object3D): void {
    const index = this.bullets.findIndex((b) => b.mesh === bulletMesh && b.active);
    if (index >= 0) {
      this.disposeBullet(this.bullets[index], index);
    }
  }

  public getDamage(): number {
    return this.config.DAMAGE;
  }

  public getEyeCount(): number {
    return this.eyes.filter((e) => !e.destroyed).length;
  }

  public getTotalEyeCount(): number {
    return this.config.COUNT;
  }

  public getEyeHealth(index: number): { current: number; max: number } | null {
    const eye = this.eyes.find((e) => e.index === index);
    if (!eye || eye.destroyed) return null;

    return {
      current: eye.health.getCurrentHealth(),
      max: eye.health.getMaxHealth(),
    };
  }

  public clearBullets(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.disposeBullet(this.bullets[i], i);
    }
  }

  public dispose(): void {
    this.clearBullets();

    for (const eye of this.eyes) {
      if (eye.mesh.parent) {
        eye.mesh.parent.remove(eye.mesh);
      }
      eye.mesh.geometry.dispose();
      if (eye.mesh.material instanceof THREE.Material) {
        eye.mesh.material.dispose();
      }
    }

    this.eyes = [];
  }
}
