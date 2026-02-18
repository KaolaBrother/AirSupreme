import * as THREE from 'three';
import { LASER_SWEEP_CONFIG } from './BossTypes';

type LaserState = 'idle' | 'warning' | 'sweeping';

export class LaserSweepSystem {
  private scene: THREE.Scene;
  private config: typeof LASER_SWEEP_CONFIG;

  private state: LaserState = 'idle';
  private timer: number = 0;
  private cooldownTimer: number = 0;
  private currentAngle: number = 0;
  private planeNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private planeBasis1: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private planeBasis2: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private startAngle: number = 0;

  private warningPlane: THREE.Mesh | null = null;
  private laserLine: THREE.Line | null = null;
  private laserCylinder: THREE.Mesh | null = null;

  public onHitPlayer?: () => void;
  public onWarningStart?: () => void;
  public onSweepStart?: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.config = LASER_SWEEP_CONFIG;
    this.cooldownTimer = this.config.INTERVAL;
  }

  public update(deltaTime: number, bossPosition: THREE.Vector3): void {
    switch (this.state) {
      case 'idle':
        this.updateIdle(deltaTime);
        break;
      case 'warning':
        this.updateWarning(deltaTime, bossPosition);
        break;
      case 'sweeping':
        this.updateSweeping(deltaTime, bossPosition);
        break;
    }
  }

  private updateIdle(deltaTime: number): void {
    this.cooldownTimer -= deltaTime;
    if (this.cooldownTimer <= 0) {
      this.startWarning();
    }
  }

  private startWarning(): void {
    this.state = 'warning';
    this.timer = this.config.WARNING_DURATION;
    this.generateRandomPlane();
    this.createWarningVisual();
    this.onWarningStart?.();
  }

  private updateWarning(deltaTime: number, bossPosition: THREE.Vector3): void {
    this.timer -= deltaTime;
    if (this.warningPlane) {
      this.warningPlane.position.copy(bossPosition);
      const pulse = 0.5 + 0.5 * Math.sin(this.timer * 10);
      (this.warningPlane.material as THREE.MeshBasicMaterial).opacity = pulse * 0.5;
    }

    if (this.timer <= 0) {
      this.clearWarning();
      this.startSweep();
    }
  }

  private startSweep(): void {
    this.state = 'sweeping';
    this.timer = this.config.SWEEP_DURATION;
    this.currentAngle = this.startAngle;
    this.createLaserVisual();
    this.onSweepStart?.();
  }

  private updateSweeping(deltaTime: number, bossPosition: THREE.Vector3): void {
    this.timer -= deltaTime;

    const progress = 1 - this.timer / this.config.SWEEP_DURATION;
    this.currentAngle = this.startAngle + progress * Math.PI * 2;

    this.updateLaserVisual(bossPosition);

    if (this.timer <= 0) {
      this.clearLaser();
      this.state = 'idle';
      this.cooldownTimer = this.config.INTERVAL;
    }
  }

  private generateRandomPlane(): void {
    const planeType = Math.floor(Math.random() * 3);

    switch (planeType) {
      case 0:
        this.planeNormal = new THREE.Vector3(0, 1, 0);
        break;
      case 1: {
        const angle = Math.random() * Math.PI * 2;
        this.planeNormal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        break;
      }
      case 2: {
        const tiltAngle = Math.random() * Math.PI * 2;
        this.planeNormal = new THREE.Vector3(
          Math.cos(tiltAngle) * 0.707,
          0.707,
          Math.sin(tiltAngle) * 0.707
        );
        break;
      }
    }

    this.planeNormal.normalize();

    this.computePlaneBasis();

    this.startAngle = Math.random() * Math.PI * 2;
  }

  private computePlaneBasis(): void {
    let temp = new THREE.Vector3(1, 0, 0);
    if (Math.abs(this.planeNormal.dot(temp)) > 0.9) {
      temp = new THREE.Vector3(0, 1, 0);
    }

    this.planeBasis1 = new THREE.Vector3().crossVectors(temp, this.planeNormal).normalize();
    this.planeBasis2 = new THREE.Vector3()
      .crossVectors(this.planeNormal, this.planeBasis1)
      .normalize();
  }

  private getLaserDirection(): THREE.Vector3 {
    return new THREE.Vector3()
      .addScaledVector(this.planeBasis1, Math.cos(this.currentAngle))
      .addScaledVector(this.planeBasis2, Math.sin(this.currentAngle))
      .normalize();
  }

  private createWarningVisual(): void {
    const geometry = new THREE.PlaneGeometry(this.config.RANGE * 2, this.config.RANGE * 2);
    const material = new THREE.MeshBasicMaterial({
      color: this.config.COLOR,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    this.warningPlane = new THREE.Mesh(geometry, material);
    this.scene.add(this.warningPlane);

    // PlaneGeometry 默认法线是 +Z 轴，不是 +Y
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(defaultNormal, this.planeNormal);
    this.warningPlane.quaternion.copy(quaternion);
  }

  private createLaserVisual(): void {
    const geometry = new THREE.BoxGeometry(this.config.RANGE * 2, this.config.PLANE_THICKNESS, 2);
    const material = new THREE.MeshBasicMaterial({
      color: this.config.COLOR,
      transparent: true,
      opacity: 0.8,
    });

    this.laserCylinder = new THREE.Mesh(geometry, material);
    this.scene.add(this.laserCylinder);
  }

  private updateLaserVisual(bossPosition: THREE.Vector3): void {
    if (!this.laserCylinder) return;

    const laserDirection = this.getLaserDirection();

    const rotationMatrix = new THREE.Matrix4();
    const basisX = laserDirection;
    const basisY = this.planeNormal.clone();
    const basisZ = new THREE.Vector3().crossVectors(basisX, basisY).normalize();

    rotationMatrix.makeBasis(basisX, basisY, basisZ);

    this.laserCylinder.position.copy(bossPosition);
    this.laserCylinder.quaternion.setFromRotationMatrix(rotationMatrix);
  }

  private clearWarning(): void {
    if (this.warningPlane) {
      this.scene.remove(this.warningPlane);
      this.warningPlane.geometry.dispose();
      (this.warningPlane.material as THREE.Material).dispose();
      this.warningPlane = null;
    }
  }

  private clearLaser(): void {
    if (this.laserCylinder) {
      this.scene.remove(this.laserCylinder);
      this.laserCylinder.geometry.dispose();
      (this.laserCylinder.material as THREE.Material).dispose();
      this.laserCylinder = null;
    }
    if (this.laserLine) {
      this.scene.remove(this.laserLine);
      this.laserLine.geometry.dispose();
      (this.laserLine.material as THREE.Material).dispose();
      this.laserLine = null;
    }
  }

  public checkPlayerCollision(playerPosition: THREE.Vector3, bossPosition: THREE.Vector3): boolean {
    if (this.state !== 'sweeping') return false;

    const toPlayer = playerPosition.clone().sub(bossPosition);
    const distance = Math.abs(toPlayer.dot(this.planeNormal));

    if (distance > this.config.PLANE_THICKNESS) return false;

    const playerProj = new THREE.Vector3()
      .addScaledVector(this.planeBasis1, toPlayer.dot(this.planeBasis1))
      .addScaledVector(this.planeBasis2, toPlayer.dot(this.planeBasis2));

    const playerAngle = Math.atan2(
      playerProj.dot(this.planeBasis2),
      playerProj.dot(this.planeBasis1)
    );

    let angleDiff = this.currentAngle - playerAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const angularTolerance = 0.15;

    return Math.abs(angleDiff) < angularTolerance;
  }

  public isActive(): boolean {
    return this.state === 'sweeping';
  }

  public isWarning(): boolean {
    return this.state === 'warning';
  }

  public getDamage(): number {
    return this.config.DAMAGE;
  }

  public getPlaneNormal(): THREE.Vector3 {
    return this.planeNormal.clone();
  }

  public getCurrentAngle(): number {
    return this.currentAngle;
  }

  public dispose(): void {
    this.clearWarning();
    this.clearLaser();
  }
}
