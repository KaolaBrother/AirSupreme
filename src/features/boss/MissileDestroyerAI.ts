import * as THREE from 'three';
import {
  BossConfig,
  FlakCannonPosition,
  FLAK_CANNON_CONFIG,
  FIGHTER_LAUNCH_CONFIG,
} from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BossMissileSystem } from './BossMissileSystem';
import { FlakCannonSystem } from './FlakCannonSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

export class MissileDestroyerAI {
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private missileSystem: BossMissileSystem;
  private flakCannonSystem: FlakCannonSystem;

  private flakCooldown: number = 0;
  private currentFlakCannon: FlakCannonPosition = FlakCannonPosition.FRONT_LEFT;
  private missileCooldown: number = 0;
  private currentMissileLauncher: number = 0;

  private fighterSpawnTimer: number = 0;

  private flakCannonOffsets: Record<FlakCannonPosition, THREE.Vector3> = {
    [FlakCannonPosition.FRONT_LEFT]: new THREE.Vector3(-8, 5.2, -2.5),
    [FlakCannonPosition.FRONT_RIGHT]: new THREE.Vector3(-8, 5.2, 2.5),
    [FlakCannonPosition.BACK_LEFT]: new THREE.Vector3(6, 5.2, -2.5),
    [FlakCannonPosition.BACK_RIGHT]: new THREE.Vector3(6, 5.2, 2.5),
  };

  private missileLauncherOffsets: THREE.Vector3[] = [
    new THREE.Vector3(-4, 6, -2),
    new THREE.Vector3(-4, 6, 2),
    new THREE.Vector3(0, 6, -2),
    new THREE.Vector3(0, 6, 2),
  ];

  private playerMesh: THREE.Object3D | null = null;
  private friendlyMeshes: THREE.Object3D[] = [];

  public onFlakFire?: (position: THREE.Vector3) => void;
  public onFlakExplode?: (position: THREE.Vector3, radius: number, damage: number) => void;
  public onDestroy?: (position: THREE.Vector3, config: BossConfig) => void;
  public onMissileFired?: () => void;
  public onFighterSpawn?: (position: THREE.Vector3) => void;

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

    this.moveTowardsPlayer(deltaTime, playerMesh);

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

    this.fighterSpawnTimer += deltaTime;
    if (this.fighterSpawnTimer >= FIGHTER_LAUNCH_CONFIG.INTERVAL) {
      this.spawnFighters();
      this.fighterSpawnTimer = 0;
    }

    this.flakCannonSystem.update(deltaTime);
    this.missileSystem.update(deltaTime);
  }

  private moveTowardsPlayer(deltaTime: number, playerMesh: THREE.Object3D | null): void {
    if (!playerMesh || this.config.speed <= 0) return;

    const targetX = playerMesh.position.x;
    const targetZ = playerMesh.position.z;

    const direction = new THREE.Vector3(
      targetX - this.mesh.position.x,
      0,
      targetZ - this.mesh.position.z
    );

    if (direction.length() > 1) {
      direction.normalize();

      const moveDistance = this.config.speed * deltaTime;
      this.mesh.position.x += direction.x * moveDistance;
      this.mesh.position.z += direction.z * moveDistance;

      const targetRotation = Math.atan2(direction.x, direction.z);
      const currentRotation = this.mesh.rotation.y;
      const rotationDiff = targetRotation - currentRotation;

      let normalizedDiff = rotationDiff;
      while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
      while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

      this.mesh.rotation.y += normalizedDiff * this.config.turnSpeed * deltaTime;
    }
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

  private spawnFighters(): void {
    const deckY = 3 * this.config.scale + 0.25 * this.config.scale;
    const deckPosition = this.mesh.position.clone();
    deckPosition.y += deckY;

    for (let i = 0; i < FIGHTER_LAUNCH_CONFIG.COUNT; i++) {
      const spawnOffset = new THREE.Vector3((i === 0 ? -1 : 1) * 10, 2, 0);
      const fighterSpawnPos = deckPosition.clone().add(spawnOffset);
      this.onFighterSpawn?.(fighterSpawnPos);
    }
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

export function createMissileDestroyerMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c3e50,
    metalness: 0.7,
    roughness: 0.3,
  });

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x34495e,
    metalness: 0.5,
    roughness: 0.4,
  });

  const superstructureMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a252f,
    metalness: 0.6,
    roughness: 0.3,
  });

  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a0000,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x220000,
    emissiveIntensity: 0.2,
  });

  const missileLauncherMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.9,
    roughness: 0.2,
  });

  const hullLength = 24;
  const hullWidth = 6;
  const hullHeight = 3;

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale, hullHeight * scale, hullWidth * scale),
    hullMaterial
  );
  hull.position.set(0, hullHeight * scale * 0.5, 0);
  hull.name = 'destroyer_hull';
  hull.castShadow = true;
  group.add(hull);
  parts.push(hull);

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(hullWidth * scale * 0.5, 4 * scale, 4),
    hullMaterial
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(-(hullLength * 0.5 + 1.5) * scale, hullHeight * scale * 0.5, 0);
  bow.name = 'destroyer_bow';
  bow.castShadow = true;
  group.add(bow);
  parts.push(bow);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.9, 0.5 * scale, hullWidth * scale * 0.9),
    deckMaterial
  );
  deck.position.set(0, hullHeight * scale + 0.25 * scale, 0);
  deck.name = 'destroyer_deck';
  deck.castShadow = true;
  group.add(deck);
  parts.push(deck);

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(4 * scale, 4 * scale, 3 * scale),
    superstructureMaterial
  );
  bridge.position.set(2 * scale, hullHeight * scale + 2.5 * scale, 0);
  bridge.name = 'destroyer_bridge';
  bridge.castShadow = true;
  group.add(bridge);
  parts.push(bridge);

  const bridgeWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 1.5 * scale, 2 * scale),
    new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      emissive: 0x00aaff,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.1,
    })
  );
  bridgeWindow.position.set(2 * scale - 2.1 * scale, hullHeight * scale + 3 * scale, 0);
  bridgeWindow.name = 'destroyer_bridge_window';
  group.add(bridgeWindow);
  parts.push(bridgeWindow);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 5 * scale, 8),
    superstructureMaterial
  );
  mast.position.set(2 * scale, hullHeight * scale + 6.5 * scale, 0);
  mast.name = 'destroyer_mast';
  mast.castShadow = true;
  group.add(mast);
  parts.push(mast);

  const radar = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 1.5 * scale, 2 * scale),
    new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2,
    })
  );
  radar.position.set(2 * scale, hullHeight * scale + 8 * scale, 0);
  radar.name = 'destroyer_radar';
  group.add(radar);
  parts.push(radar);

  const flakPositions = [
    {
      name: 'front_left',
      pos: new THREE.Vector3(-8 * scale, hullHeight * scale + 1 * scale, -2.5 * scale),
    },
    {
      name: 'front_right',
      pos: new THREE.Vector3(-8 * scale, hullHeight * scale + 1 * scale, 2.5 * scale),
    },
    {
      name: 'back_left',
      pos: new THREE.Vector3(6 * scale, hullHeight * scale + 1 * scale, -2.5 * scale),
    },
    {
      name: 'back_right',
      pos: new THREE.Vector3(6 * scale, hullHeight * scale + 1 * scale, 2.5 * scale),
    },
  ];

  for (const flakPos of flakPositions) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 0.5 * scale, 8),
      turretMaterial
    );
    base.position.copy(flakPos.pos);
    base.name = `destroyer_flak_base_${flakPos.name}`;
    base.castShadow = true;
    group.add(base);
    parts.push(base);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 2.5 * scale, 8),
      turretMaterial
    );
    barrel.position.copy(flakPos.pos);
    barrel.position.y += 1.2 * scale;
    barrel.rotation.x = -Math.PI / 3;
    barrel.name = `destroyer_flak_barrel_${flakPos.name}`;
    barrel.castShadow = true;
    group.add(barrel);
    parts.push(barrel);
  }

  const missileLauncherPositions = [
    {
      name: 'front_left',
      pos: new THREE.Vector3(-4 * scale, hullHeight * scale + 1.5 * scale, -2 * scale),
    },
    {
      name: 'front_right',
      pos: new THREE.Vector3(-4 * scale, hullHeight * scale + 1.5 * scale, 2 * scale),
    },
    {
      name: 'back_left',
      pos: new THREE.Vector3(0 * scale, hullHeight * scale + 1.5 * scale, -2 * scale),
    },
    {
      name: 'back_right',
      pos: new THREE.Vector3(0 * scale, hullHeight * scale + 1.5 * scale, 2 * scale),
    },
  ];

  for (const launcherPos of missileLauncherPositions) {
    const launcher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8 * scale, 0.8 * scale, 3 * scale, 8),
      missileLauncherMaterial
    );
    launcher.position.copy(launcherPos.pos);
    launcher.name = `destroyer_missile_launcher_${launcherPos.name}`;
    launcher.castShadow = true;
    group.add(launcher);
    parts.push(launcher);

    const cellCount = 4;
    for (let i = 0; i < cellCount; i++) {
      const cell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.5 * scale, 6),
        new THREE.MeshStandardMaterial({
          color: 0x333333,
          metalness: 0.9,
          roughness: 0.1,
        })
      );
      const angle = (i / cellCount) * Math.PI * 2;
      cell.position.copy(launcherPos.pos);
      cell.position.x += Math.cos(angle) * 0.4 * scale;
      cell.position.z += Math.sin(angle) * 0.4 * scale;
      cell.position.y += 1.5 * scale;
      cell.name = `destroyer_missile_cell_${launcherPos.name}_${i}`;
      group.add(cell);
      parts.push(cell);
    }
  }

  const funnels = [{ x: 3.5 * scale, z: 0 }];

  for (let i = 0; i < funnels.length; i++) {
    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4 * scale, 0.5 * scale, 2 * scale, 8),
      superstructureMaterial
    );
    funnel.position.set(funnels[i].x, hullHeight * scale + 3 * scale, funnels[i].z);
    funnel.name = `destroyer_funnel_${i}`;
    funnel.castShadow = true;
    group.add(funnel);
    parts.push(funnel);
  }

  group.name = `BOSS_${config.type}`;
  (group as any).bossParts = parts;
  return group;
}
