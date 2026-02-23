import * as THREE from 'three';
import { BossConfig, TELEPORT_CONFIG, EYE_CONFIG } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { LaserSweepSystem } from './LaserSweepSystem';
import { EyeSystem } from './EyeSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

export class OctopusWarshipAI {
  readonly name = 'OctopusWarshipAI';

  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private particleSystem: ParticleSystem;

  private laserSystem: LaserSweepSystem;
  private eyeSystem: EyeSystem;

  private teleportCooldown: number = 0;
  private isTeleporting: boolean = false;
  private teleportDisabled: boolean = false;

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private velocity: THREE.Vector3 = new THREE.Vector3();

  private playerMesh: THREE.Object3D | null = null;

  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onTeleport?: (from: THREE.Vector3, to: THREE.Vector3) => void;
  public onLaserHit?: () => void;
  public onLaserWarning?: () => void;
  public onLaserSweep?: () => void;

  private parts: THREE.Mesh[] = [];
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(mesh: THREE.Group, config: BossConfig, particleSystem: ParticleSystem) {
    this.mesh = mesh;
    this.config = config;
    this.particleSystem = particleSystem;
    this.health = new HealthSystem(config.health);

    this.laserSystem = new LaserSweepSystem(this.getScene());
    this.eyeSystem = new EyeSystem(this.getScene());

    // 从 mesh 中提取 body parts（由 createOctopusWarshipMesh 设置）
    this.parts = (mesh as any).bossParts || [];

    this.setupCallbacks();

    this.health.onDeath = () => {
      this.onDestroy?.(this.mesh.position.clone(), this.config);
    };
  }

  private getScene(): THREE.Scene {
    let parent: THREE.Object3D | null = this.mesh;
    while (parent && !(parent instanceof THREE.Scene)) {
      parent = parent.parent;
    }
    return parent as THREE.Scene;
  }

  private setupCallbacks(): void {
    this.laserSystem.onHitPlayer = () => {
      this.onLaserHit?.();
    };

    this.laserSystem.onWarningStart = () => {
      this.onLaserWarning?.();
    };

    this.laserSystem.onSweepStart = () => {
      this.onLaserSweep?.();
    };

    this.eyeSystem.onEyeDestroyed = (_index: number, position: THREE.Vector3) => {
      this.particleSystem.createExplosion(position, 2);
    };

    this.eyeSystem.onEyeDamaged = (damage: number) => {
      this.health.takeDamage(damage);
    };
  }

  public init(): void {
    this.eyeSystem.createEyes(this.mesh);
  }

  public update(
    deltaTime: number,
    playerMesh: THREE.Object3D | null,
    friendlyMeshes: THREE.Object3D[]
  ): void {
    if (!this.isAlive()) return;

    this.playerMesh = playerMesh;

    if (this.teleportCooldown > 0) {
      this.teleportCooldown -= deltaTime;
    }

    if (!this.isTeleporting) {
      this.updateMovement(deltaTime);
      this.updateLaser(deltaTime);
      this.updateEyes(deltaTime, friendlyMeshes);
    }
  }

  private updateMovement(deltaTime: number): void {
    if (!this.playerMesh) return;

    const playerPos = this.playerMesh.position;
    this.targetPosition.copy(playerPos);

    const direction = new THREE.Vector3()
      .subVectors(this.targetPosition, this.mesh.position)
      .normalize();

    const targetVelocity = direction.multiplyScalar(this.config.speed);

    this.velocity.lerp(targetVelocity, 0.02);

    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    const minBound = -TELEPORT_CONFIG.BOUNDS.X;
    const maxBound = TELEPORT_CONFIG.BOUNDS.X;
    const minY = TELEPORT_CONFIG.BOUNDS.Y_MIN;
    const maxY = TELEPORT_CONFIG.BOUNDS.Y_MAX;
    const minZ = -TELEPORT_CONFIG.BOUNDS.Z;
    const maxZ = TELEPORT_CONFIG.BOUNDS.Z;

    this.mesh.position.x = Math.max(minBound, Math.min(maxBound, this.mesh.position.x));
    this.mesh.position.y = Math.max(minY, Math.min(maxY, this.mesh.position.y));
    this.mesh.position.z = Math.max(minZ, Math.min(maxZ, this.mesh.position.z));
  }

  private updateLaser(deltaTime: number): void {
    this.laserSystem.update(deltaTime, this.mesh.position);
  }

  private updateEyes(deltaTime: number, friendlyMeshes: THREE.Object3D[]): void {
    const playerPosition = this.playerMesh ? this.playerMesh.position : null;
    const friendlyPositions = friendlyMeshes.map((f) => f.position.clone());
    this.eyeSystem.update(deltaTime, this.mesh.position, playerPosition, friendlyPositions);
  }

  public checkLaserCollision(playerPosition: THREE.Vector3): boolean {
    return this.laserSystem.checkPlayerCollision(playerPosition, this.mesh.position);
  }

  public takeDamage(damage: number): void {
    this.health.takeDamage(damage);

    if (!this.isTeleporting && this.teleportCooldown <= 0 && !this.teleportDisabled) {
      if (Math.random() < TELEPORT_CONFIG.CHANCE_ON_HIT) {
        this.performTeleport();
      }
    }
  }

  public takeEyeDamage(eyeIndex: number, damage: number): void {
    this.eyeSystem.damageEye(eyeIndex, damage);
  }

  public takeEyeDamageAtPosition(hitPosition: THREE.Vector3, damage: number): void {
    this.eyeSystem.damageNearestEye(hitPosition, damage);
  }

  private performTeleport(): void {
    this.isTeleporting = true;
    this.teleportDisabled = true;
    const fromPos = this.mesh.position.clone();

    this.particleSystem.createTeleportOut(fromPos);
    this.mesh.visible = false;

    const toPos = new THREE.Vector3(
      (Math.random() - 0.5) * TELEPORT_CONFIG.BOUNDS.X * 2,
      TELEPORT_CONFIG.BOUNDS.Y_MIN +
        Math.random() * (TELEPORT_CONFIG.BOUNDS.Y_MAX - TELEPORT_CONFIG.BOUNDS.Y_MIN),
      (Math.random() - 0.5) * TELEPORT_CONFIG.BOUNDS.Z * 2
    );

    const timeoutId = setTimeout(() => {
      this.pendingTimeouts.delete(timeoutId);
      this.mesh.position.copy(toPos);
      this.mesh.visible = true;
      this.particleSystem.createTeleportIn(toPos);
      this.isTeleporting = false;
      this.teleportCooldown = TELEPORT_CONFIG.COOLDOWN;
      this.teleportDisabled = false;
      this.onTeleport?.(fromPos, toPos);
    }, TELEPORT_CONFIG.DURATION * 1000);
    this.pendingTimeouts.add(timeoutId);
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public getConfig(): BossConfig {
    return this.config;
  }

  public getHealth(): { current: number; max: number } {
    return {
      current: this.health.getCurrentHealth(),
      max: this.health.getMaxHealth(),
    };
  }

  public isAlive(): boolean {
    return this.health.getCurrentHealth() > 0;
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  public getCollisionParts(): THREE.Object3D[] {
    const allParts: THREE.Object3D[] = [...this.parts];
    allParts.push(...this.eyeSystem.getActiveEyeMeshes());
    return allParts;
  }

  public getCollisionPartMeshes(): THREE.Mesh[] {
    return this.parts;
  }

  public getEyeMeshes(): THREE.Object3D[] {
    return this.eyeSystem.getActiveEyeMeshes();
  }

  public getEyeCollisionParts(): { mesh: THREE.Object3D; index: number }[] {
    return this.eyeSystem.getCollisionParts();
  }

  public getEyeBulletMeshes(): THREE.Object3D[] {
    return this.eyeSystem.getBulletMeshes();
  }

  public getLaserSystem(): LaserSweepSystem {
    return this.laserSystem;
  }

  public getEyeSystem(): EyeSystem {
    return this.eyeSystem;
  }

  public getEyeDamage(): number {
    return EYE_CONFIG.DAMAGE;
  }

  public getMissileSystem(): null {
    return null;
  }

  public dispose(): void {
    for (const timeoutId of this.pendingTimeouts) {
      clearTimeout(timeoutId);
    }
    this.pendingTimeouts.clear();

    this.mesh.visible = false;
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    this.laserSystem.dispose();
    this.eyeSystem.dispose();

    for (const part of this.parts) {
      part.geometry.dispose();
      if (part.material instanceof THREE.Material) {
        part.material.dispose();
      }
    }
    this.parts = [];

    while (this.mesh.children.length > 0) {
      const child = this.mesh.children[0];
      this.mesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  }
}

export function createOctopusWarshipMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4488aa,
    metalness: 0.7,
    roughness: 0.3,
  });

  const armorMaterial = new THREE.MeshStandardMaterial({
    color: 0x336688,
    metalness: 0.8,
    roughness: 0.2,
  });

  const bodyGeometry = new THREE.SphereGeometry(15, 32, 32);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'octopus_body';
  body.castShadow = true;
  group.add(body);
  parts.push(body);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 3), armorMaterial.clone());
    plate.position.set(Math.cos(angle) * 14, 0, Math.sin(angle) * 14);
    plate.rotation.y = -angle;
    plate.name = `octopus_plate_${i}`;
    plate.castShadow = true;
    group.add(plate);
    parts.push(plate);
  }

  const topDomeGeometry = new THREE.SphereGeometry(8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const topDome = new THREE.Mesh(topDomeGeometry, armorMaterial);
  topDome.position.set(0, 10, 0);
  topDome.name = 'octopus_top_dome';
  topDome.castShadow = true;
  group.add(topDome);
  parts.push(topDome);

  const bottomDomeGeometry = new THREE.SphereGeometry(
    8,
    16,
    16,
    0,
    Math.PI * 2,
    Math.PI / 2,
    Math.PI / 2
  );
  const bottomDome = new THREE.Mesh(bottomDomeGeometry, armorMaterial);
  bottomDome.position.set(0, -10, 0);
  bottomDome.name = 'octopus_bottom_dome';
  bottomDome.castShadow = true;
  group.add(bottomDome);
  parts.push(bottomDome);

  const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.3, 10, 8);
  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: 0x5599bb,
    metalness: 0.8,
    roughness: 0.2,
  });

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(Math.cos(angle) * 5, 15, Math.sin(angle) * 5);
    antenna.rotation.x = -0.3;
    antenna.rotation.z = Math.cos(angle) * 0.3;
    antenna.name = `octopus_antenna_${i}`;
    group.add(antenna);
    parts.push(antenna);
  }

  group.name = `BOSS_${config.type}`;
  (group as any).bossParts = parts;

  group.scale.setScalar(scale);
  return group;
}
