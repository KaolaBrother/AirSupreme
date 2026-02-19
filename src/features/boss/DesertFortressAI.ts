import * as THREE from 'three';
import { BossConfig, FlakCannonPosition, FLAK_CANNON_CONFIG } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BossMissileSystem } from './BossMissileSystem';
import { FlakCannonSystem } from './FlakCannonSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

export class DesertFortressAI {
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private missileSystem: BossMissileSystem;
  private flakCannonSystem: FlakCannonSystem;

  private flakCooldown: number = 0;
  private currentFlakCannon: FlakCannonPosition = FlakCannonPosition.FRONT_LEFT;
  private missileCooldown: number = 0;
  private currentMissileLauncher: number = 0;

  private flakCannonOffsets: Record<FlakCannonPosition, THREE.Vector3> = {
    [FlakCannonPosition.FRONT_LEFT]: new THREE.Vector3(-5, 3, -3),
    [FlakCannonPosition.FRONT_RIGHT]: new THREE.Vector3(5, 3, -3),
    [FlakCannonPosition.BACK_LEFT]: new THREE.Vector3(-5, 3, 3),
    [FlakCannonPosition.BACK_RIGHT]: new THREE.Vector3(5, 3, 3),
  };

  private missileLauncherOffsets: THREE.Vector3[] = [
    new THREE.Vector3(-3, 4.5, 0),
    new THREE.Vector3(3, 4.5, 0),
  ];

  private playerMesh: THREE.Object3D | null = null;
  private friendlyMeshes: THREE.Object3D[] = [];

  public onFlakFire?: (position: THREE.Vector3) => void;
  public onFlakExplode?: (position: THREE.Vector3, radius: number, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;

  constructor(
    mesh: THREE.Group,
    config: BossConfig,
    scene: THREE.Scene,
    particleSystem: ParticleSystem
  ) {
    this.mesh = mesh;
    this.config = config;
    this.health = new HealthSystem(config.health);

    this.missileSystem = new BossMissileSystem(scene, particleSystem);

    this.flakCannonSystem = new FlakCannonSystem(
      scene,
      FLAK_CANNON_CONFIG.AOE_RADIUS,
      (position, radius, damage) => {
        this.onFlakExplode?.(position, radius, damage);
      }
    );

    this.missileCooldown = config.missileFireInterval;

    this.health.onDeath = () => {
      this.onDestroy?.(this.mesh.position.clone(), this.config);
    };
  }

  public update(
    deltaTime: number,
    playerMesh: THREE.Object3D | null,
    friendlyMeshes: THREE.Object3D[]
  ): void {
    if (!this.isAlive()) return;

    this.playerMesh = playerMesh;
    this.friendlyMeshes = friendlyMeshes;

    this.flakCooldown -= deltaTime;
    this.missileCooldown -= deltaTime;

    if (this.flakCooldown <= 0) {
      this.fireFlakCannon();
      this.flakCooldown = this.config.cannonFireInterval;
      this.advanceToNextFlakCannon();
    }

    if (this.missileCooldown <= 0) {
      this.fireMissile();
      this.missileCooldown = this.config.missileFireInterval;
    }

    this.flakCannonSystem.update(deltaTime);
    this.missileSystem.update(deltaTime);
  }

  private fireFlakCannon(): void {
    if (!this.playerMesh) return;

    const cannonOffset = this.flakCannonOffsets[this.currentFlakCannon].clone();
    cannonOffset.multiplyScalar(this.config.scale);
    const firePosition = this.mesh.position.clone().add(cannonOffset);

    const target = this.selectFlakTarget();
    if (!target) return;

    const targetPosition = target.position.clone();
    targetPosition.x += (Math.random() - 0.5) * 30;
    targetPosition.z += (Math.random() - 0.5) * 30;

    this.flakCannonSystem.fire(firePosition, targetPosition);
    this.onFlakFire?.(firePosition);
  }

  private selectFlakTarget(): THREE.Object3D | null {
    const usePlayer = Math.random() < 0.5;

    if (usePlayer && this.playerMesh) {
      return this.playerMesh;
    }

    const validFriendlies = this.friendlyMeshes.filter((f) => f.parent);
    if (validFriendlies.length > 0) {
      return validFriendlies[Math.floor(Math.random() * validFriendlies.length)];
    }

    return this.playerMesh;
  }

  private advanceToNextFlakCannon(): void {
    const cannonOrder = [
      FlakCannonPosition.FRONT_LEFT,
      FlakCannonPosition.FRONT_RIGHT,
      FlakCannonPosition.BACK_LEFT,
      FlakCannonPosition.BACK_RIGHT,
    ];

    const currentIndex = cannonOrder.indexOf(this.currentFlakCannon);
    const nextIndex = (currentIndex + 1) % cannonOrder.length;
    this.currentFlakCannon = cannonOrder[nextIndex];
  }

  private fireMissile(): void {
    if (!this.playerMesh) return;

    let target: THREE.Object3D | null = null;
    let targetingPlayer = false;

    if (Math.random() < 0.5) {
      targetingPlayer = true;
      target = null;
    } else {
      let minDistance = Infinity;
      for (const friendly of this.friendlyMeshes) {
        if (!friendly.parent) continue;
        const dist = this.mesh.position.distanceTo(friendly.position);
        if (dist < minDistance) {
          minDistance = dist;
          target = friendly;
        }
      }
      if (!target) {
        targetingPlayer = true;
      }
    }

    const launcherOffset = this.missileLauncherOffsets[this.currentMissileLauncher].clone();
    launcherOffset.multiplyScalar(this.config.scale);
    const missilePosition = this.mesh.position.clone().add(launcherOffset);

    this.currentMissileLauncher =
      (this.currentMissileLauncher + 1) % this.missileLauncherOffsets.length;

    this.missileSystem.fire(
      missilePosition,
      target,
      this.friendlyMeshes,
      this.playerMesh,
      targetingPlayer
    );
    this.onMissileFired?.();
  }

  public getMissileSystem(): BossMissileSystem {
    return this.missileSystem;
  }

  public getFlakCannonSystem(): FlakCannonSystem {
    return this.flakCannonSystem;
  }

  public takeDamage(damage: number): void {
    this.health.takeDamage(damage);
  }

  public getHealth(): { current: number; max: number } {
    return {
      current: this.health.getCurrentHealth(),
      max: this.health.getMaxHealth(),
    };
  }

  public getMesh(): THREE.Group {
    return this.mesh;
  }

  public getConfig(): BossConfig {
    return this.config;
  }

  public isAlive(): boolean {
    return this.health.getCurrentHealth() > 0;
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  public getCollisionParts(): THREE.Object3D[] {
    const parts = (this.mesh as any).bossParts as THREE.Mesh[] | undefined;
    if (!parts) return [this.mesh];
    return parts;
  }

  public getCollisionPartMeshes(): THREE.Mesh[] {
    const parts = (this.mesh as any).bossParts as THREE.Mesh[] | undefined;
    if (!parts) return [];
    return parts;
  }

  public dispose(): void {
    this.mesh.visible = false;
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.missileSystem.dispose();
    this.flakCannonSystem.dispose();

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

export function createDesertFortressMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    metalness: 0.6,
    roughness: 0.4,
  });

  const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.8,
    roughness: 0.3,
  });

  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x440000,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0x220000,
    emissiveIntensity: 0.3,
  });

  const missileMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b0000,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0x440000,
    emissiveIntensity: 0.3,
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(16 * scale, 2 * scale, 8 * scale),
    bodyMaterial
  );
  body.position.set(0, 1 * scale, 0);
  body.name = 'fortress_body';
  body.castShadow = true;
  group.add(body);
  parts.push(body);

  const leftTrack = new THREE.Mesh(
    new THREE.BoxGeometry(18 * scale, 1 * scale, 2 * scale),
    trackMaterial
  );
  leftTrack.position.set(-7 * scale, 0.5 * scale, 0);
  leftTrack.name = 'fortress_left_track';
  leftTrack.castShadow = true;
  group.add(leftTrack);
  parts.push(leftTrack);

  const rightTrack = new THREE.Mesh(
    new THREE.BoxGeometry(18 * scale, 1 * scale, 2 * scale),
    trackMaterial
  );
  rightTrack.position.set(7 * scale, 0.5 * scale, 0);
  rightTrack.name = 'fortress_right_track';
  rightTrack.castShadow = true;
  group.add(rightTrack);
  parts.push(rightTrack);

  const commandTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2 * scale, 2.5 * scale, 3 * scale, 12),
    bodyMaterial
  );
  commandTower.position.set(0, 3.5 * scale, 0);
  commandTower.name = 'fortress_tower';
  commandTower.castShadow = true;
  group.add(commandTower);
  parts.push(commandTower);

  const flakPositions = [
    { name: 'front_left', pos: new THREE.Vector3(-5 * scale, 1.5 * scale, -3 * scale) },
    { name: 'front_right', pos: new THREE.Vector3(5 * scale, 1.5 * scale, -3 * scale) },
    { name: 'back_left', pos: new THREE.Vector3(-5 * scale, 1.5 * scale, 3 * scale) },
    { name: 'back_right', pos: new THREE.Vector3(5 * scale, 1.5 * scale, 3 * scale) },
  ];

  for (const flakPos of flakPositions) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 0.5 * scale, 8),
      turretMaterial
    );
    base.position.copy(flakPos.pos);
    base.name = `fortress_flak_base_${flakPos.name}`;
    base.castShadow = true;
    group.add(base);
    parts.push(base);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 2 * scale, 8),
      turretMaterial
    );
    barrel.position.copy(flakPos.pos);
    barrel.position.y += 1 * scale;
    barrel.rotation.x = -Math.PI / 4;
    barrel.name = `fortress_flak_barrel_${flakPos.name}`;
    barrel.castShadow = true;
    group.add(barrel);
    parts.push(barrel);
  }

  const leftMissileLauncher = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 2 * scale, 12),
    missileMaterial
  );
  leftMissileLauncher.position.set(-3 * scale, 4.5 * scale, 0);
  leftMissileLauncher.name = 'fortress_missile_left';
  leftMissileLauncher.castShadow = true;
  group.add(leftMissileLauncher);
  parts.push(leftMissileLauncher);

  const rightMissileLauncher = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 2 * scale, 12),
    missileMaterial
  );
  rightMissileLauncher.position.set(3 * scale, 4.5 * scale, 0);
  rightMissileLauncher.name = 'fortress_missile_right';
  rightMissileLauncher.castShadow = true;
  group.add(rightMissileLauncher);
  parts.push(rightMissileLauncher);

  group.name = `BOSS_${config.type}`;
  (group as any).bossParts = parts;
  return group;
}
