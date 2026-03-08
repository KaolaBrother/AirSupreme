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

type BossGroup = THREE.Group & {
  bossParts?: THREE.Mesh[];
};

export class MissileDestroyerAI {
  private static readonly CRITICAL_HEALTH_THRESHOLD = 0.24;
  private static readonly TERMINAL_HEALTH_THRESHOLD = 0.16;
  private static readonly HIT_FLASH_DURATION = 0.2;
  private static readonly WEAKPOINT_PULSE_SPEED = 3.2;
  private static readonly WEAPON_PULSE_SPEED = 9.6;
  private static readonly ENERGY_PULSE_SPEED = 7.8;
  private static readonly CRITICAL_PULSE_SPEED = 13.2;
  private static readonly TERMINAL_PULSE_SPEED = 20.5;
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private missileSystem: BossMissileSystem;
  private flakCannonSystem: FlakCannonSystem;
  private animationTime: number = 0;
  private hitFlashTimer: number = 0;
  private bridgeWindow: THREE.Mesh | null = null;
  private flakMuzzles: THREE.Mesh[] = [];
  private launcherCaps: THREE.Mesh[] = [];
  private exhaustGlows: THREE.Mesh[] = [];
  private readonly hitFlashColor = new THREE.Color(0xd8f7ff);
  private readonly weakpointBaseColor = new THREE.Color(0xff703e);
  private readonly weakpointCriticalColor = new THREE.Color(0xffb87d);
  private readonly weaponBaseColor = new THREE.Color(0xff9453);
  private readonly weaponCriticalColor = new THREE.Color(0xffd8a0);
  private readonly energyBaseColor = new THREE.Color(0x56d4ff);
  private readonly energyCriticalColor = new THREE.Color(0x9aedff);
  private readonly terminalColor = new THREE.Color(0xff321a);

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
    this.cacheVisualNodes();

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
    this.animationTime += deltaTime;

    this.moveTowardsPlayer(deltaTime, playerMesh);

    this.flakCooldown -= deltaTime;
    this.missileCooldown -= deltaTime;
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);

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
    this.updateVisualEffects();
  }

  private cacheVisualNodes(): void {
    this.bridgeWindow = this.mesh.getObjectByName('destroyer_bridge_window') as THREE.Mesh | null;
    this.flakMuzzles = this.mesh.children.filter((child) =>
      child.name.startsWith('destroyer_flak_muzzle_')
    ) as THREE.Mesh[];
    this.launcherCaps = this.mesh.children.filter((child) =>
      child.name.startsWith('destroyer_launcher_cap_')
    ) as THREE.Mesh[];
    this.exhaustGlows = this.mesh.children.filter((child) =>
      child.name.startsWith('destroyer_exhaust_glow_')
    ) as THREE.Mesh[];
  }

  private updateVisualEffects(): void {
    const healthRatio = this.getHealth().current / this.getHealth().max;
    const alertBoost = 1 + (1 - healthRatio) * 0.65;
    const criticalState = THREE.MathUtils.clamp(
      (MissileDestroyerAI.CRITICAL_HEALTH_THRESHOLD - healthRatio)
        / MissileDestroyerAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (MissileDestroyerAI.TERMINAL_HEALTH_THRESHOLD - healthRatio)
        / MissileDestroyerAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const hitFlash = this.getHitFlashStrength();
    const terminalBias = terminalState * terminalState;
    const terminalWarning = Math.sqrt(terminalState);
    const criticalBias = criticalState * criticalState;
    const phaseSeparation = 1 + terminalWarning * 0.9 + criticalState * 0.25;
    const damagePhase = hitFlash * 0.68 + terminalWarning * 0.38;
    const criticalPulse =
      (Math.sin(this.animationTime * MissileDestroyerAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5)
      * criticalState;
    const terminalPulse =
      (Math.sin(this.animationTime * MissileDestroyerAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5)
      * terminalState;
    const bridgePulse = Math.sin(this.animationTime * MissileDestroyerAI.WEAKPOINT_PULSE_SPEED) * 0.5 + 0.5;
    this.setGlowState(this.bridgeWindow, {
      intensity:
        0.35 +
        bridgePulse * 0.55 * alertBoost +
        criticalPulse * 0.85 +
        terminalPulse * 1.2 +
        damagePhase * 1.1,
      scale: 1,
      color: this.weakpointBaseColor
        .clone()
        .lerp(
          this.weakpointCriticalColor,
          bridgePulse * 0.35 + criticalPulse * 0.15 + criticalBias * 0.25
        )
        .lerp(
          this.terminalColor,
          terminalState * 0.74 + terminalPulse * 0.36 + terminalBias * 0.2
        )
        .lerp(this.hitFlashColor, hitFlash * 0.65),
    });

    const flakCharge =
      1 -
      THREE.MathUtils.clamp(
        this.flakCooldown / Math.max(this.config.cannonFireInterval, 0.001),
        0,
        1
      );
    for (let i = 0; i < this.flakMuzzles.length; i++) {
      const pulse =
        Math.sin(this.animationTime * MissileDestroyerAI.WEAPON_PULSE_SPEED + i * 1.3) * 0.5 + 0.5;
      this.setGlowState(this.flakMuzzles[i], {
        intensity:
          0.45 +
          flakCharge * 1.2 +
          pulse * 0.25 +
          criticalPulse * 0.65 +
          terminalPulse * 1.05 +
          hitFlash * 0.68 +
          terminalWarning * 0.3,
        scale:
          1 +
          flakCharge * 0.18 * phaseSeparation +
          pulse * 0.04 +
          criticalPulse * 0.04 +
          terminalPulse * 0.06 +
          hitFlash * 0.04 +
          terminalBias * 0.06,
        color: this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + criticalPulse * 0.25 + criticalBias * 0.2)
          .lerp(this.terminalColor, terminalState * 0.52 + terminalPulse * 0.37 + terminalBias * 0.2)
          .lerp(this.hitFlashColor, hitFlash * 0.25),
      });
    }

    const missileCharge =
      1 -
      THREE.MathUtils.clamp(
        this.missileCooldown / Math.max(this.config.missileFireInterval, 0.001),
        0,
        1
      );
    for (let i = 0; i < this.launcherCaps.length; i++) {
      const isNextLauncher = i === this.currentMissileLauncher;
      const pulse =
        Math.sin(this.animationTime * MissileDestroyerAI.WEAPON_PULSE_SPEED + i * 0.8) * 0.5 + 0.5;
      this.setGlowState(this.launcherCaps[i], {
        intensity:
          0.55 +
          missileCharge * 0.95 +
          pulse * 0.2 +
          (isNextLauncher ? 0.25 : 0) +
          criticalPulse * 0.85 +
          terminalPulse * 1.05 +
          hitFlash * 0.8 +
          terminalWarning * 0.33,
        scale:
          1 +
          missileCharge * 0.12 +
          (isNextLauncher ? 0.04 : 0) +
          criticalPulse * 0.04 +
          terminalPulse * 0.06 +
          hitFlash * 0.04 +
          terminalBias * 0.05,
        color: this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + (isNextLauncher ? 0.1 : 0))
          .lerp(this.terminalColor, terminalState * 0.48 + terminalPulse * 0.34 + terminalBias * 0.2)
          .lerp(this.hitFlashColor, hitFlash * 0.3),
      });
    }

    const enginePulse = Math.sin(this.animationTime * MissileDestroyerAI.ENERGY_PULSE_SPEED) * 0.5 + 0.5;
    for (const exhaustGlow of this.exhaustGlows) {
      this.setGlowState(exhaustGlow, {
        intensity:
          0.7 +
          enginePulse * 0.9 +
          criticalPulse * 0.6 +
          terminalPulse * 0.85 +
          hitFlash * 0.45 +
          terminalWarning * 0.35,
        scale:
          1 +
          enginePulse * 0.08 * phaseSeparation +
          criticalPulse * 0.05 +
          terminalPulse * 0.06 +
          hitFlash * 0.04 +
          terminalBias * 0.05,
        color: this.energyBaseColor
          .clone()
          .lerp(this.hitFlashColor, hitFlash * 0.22)
          .lerp(this.energyCriticalColor, criticalState * 0.25 + criticalBias * 0.22)
          .lerp(this.terminalColor, terminalState * 0.38 + terminalPulse * 0.25 + terminalBias * 0.2),
      });
    }
  }

  private getHitFlashStrength(): number {
    if (this.hitFlashTimer <= 0) {
      return 0;
    }

    return THREE.MathUtils.clamp(
      this.hitFlashTimer / MissileDestroyerAI.HIT_FLASH_DURATION,
      0,
      1
    );
  }

  private setGlowState(
    mesh: THREE.Mesh | null,
    options: {
      intensity: number;
      scale: number;
      color?: THREE.Color;
    }
  ): void {
    if (!mesh) {
      return;
    }

    mesh.scale.setScalar(options.scale);
    const material = mesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) {
      return;
    }

    material.emissiveIntensity = options.intensity;
    if (options.color) {
      material.emissive.copy(options.color);
      material.color.copy(options.color);
    }
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
    targetPosition.x += (Math.random() - 0.5) * 56;
    targetPosition.y += (Math.random() - 0.35) * 20;
    targetPosition.z += (Math.random() - 0.5) * 56;

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
    this.hitFlashTimer = MissileDestroyerAI.HIT_FLASH_DURATION;
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
    const parts = (this.mesh as BossGroup).bossParts;
    if (!parts) return [this.mesh];
    return parts;
  }

  public getCollisionPartMeshes(): THREE.Mesh[] {
    const parts = (this.mesh as BossGroup).bossParts;
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
    color: 0x5f7892,
    metalness: 0.64,
    roughness: 0.18,
    emissive: 0x254867,
    emissiveIntensity: 0.24,
  });

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x8ea2b7,
    metalness: 0.42,
    roughness: 0.24,
    emissive: 0x274863,
    emissiveIntensity: 0.18,
  });

  const superstructureMaterial = new THREE.MeshStandardMaterial({
    color: 0xa5b7c8,
    metalness: 0.52,
    roughness: 0.18,
    emissive: 0x2e5373,
    emissiveIntensity: 0.22,
  });

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x55cfff,
    emissive: 0x11b8ff,
    emissiveIntensity: 1.15,
    metalness: 0.5,
    roughness: 0.15,
  });

  const commandMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7d8e6,
    metalness: 0.66,
    roughness: 0.14,
    emissive: 0x2f5678,
    emissiveIntensity: 0.26,
  });

  const weaponDeckMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f8399,
    metalness: 0.86,
    roughness: 0.14,
    emissive: 0x324e69,
    emissiveIntensity: 0.24,
  });

  const exhaustMaterial = new THREE.MeshStandardMaterial({
    color: 0x66d8ff,
    emissive: 0x26c4ff,
    emissiveIntensity: 0.95,
    metalness: 0.48,
    roughness: 0.14,
  });

  const hullTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6eef4,
    metalness: 0.72,
    roughness: 0.12,
    emissive: 0x41637e,
    emissiveIntensity: 0.2,
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

  const hullStripe = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.82, 0.25 * scale, 0.45 * scale),
    hullTrimMaterial
  );
  hullStripe.position.set(0, hullHeight * scale + 0.2 * scale, 0);
  hullStripe.name = 'destroyer_hull_stripe';
  hullStripe.castShadow = true;
  group.add(hullStripe);

  const armorBeltPort = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.78, 1 * scale, 0.24 * scale),
    hullTrimMaterial.clone()
  );
  armorBeltPort.position.set(0, hullHeight * scale * 0.55, -(hullWidth * 0.5 + 0.18) * scale);
  armorBeltPort.name = 'destroyer_armor_belt_port';
  armorBeltPort.castShadow = true;
  group.add(armorBeltPort);

  const armorBeltStarboard = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.78, 1 * scale, 0.24 * scale),
    hullTrimMaterial.clone()
  );
  armorBeltStarboard.position.set(0, hullHeight * scale * 0.55, (hullWidth * 0.5 + 0.18) * scale);
  armorBeltStarboard.name = 'destroyer_armor_belt_starboard';
  armorBeltStarboard.castShadow = true;
  group.add(armorBeltStarboard);

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

  const foreDeckArmor = new THREE.Mesh(
    new THREE.BoxGeometry(7 * scale, 0.22 * scale, 4.8 * scale),
    deckMaterial.clone()
  );
  foreDeckArmor.position.set(-6.8 * scale, hullHeight * scale + 0.57 * scale, 0);
  foreDeckArmor.name = 'destroyer_fore_deck_armor';
  foreDeckArmor.castShadow = true;
  group.add(foreDeckArmor);

  const foreSpine = new THREE.Mesh(
    new THREE.BoxGeometry(7.8 * scale, 0.24 * scale, 0.7 * scale),
    hullTrimMaterial.clone()
  );
  foreSpine.position.set(-6.2 * scale, hullHeight * scale + 0.72 * scale, 0);
  foreSpine.name = 'destroyer_fore_spine';
  foreSpine.castShadow = true;
  group.add(foreSpine);

  const aftDeckArmor = new THREE.Mesh(
    new THREE.BoxGeometry(6 * scale, 0.22 * scale, 4.6 * scale),
    deckMaterial.clone()
  );
  aftDeckArmor.position.set(4.8 * scale, hullHeight * scale + 0.57 * scale, 0);
  aftDeckArmor.name = 'destroyer_aft_deck_armor';
  aftDeckArmor.castShadow = true;
  group.add(aftDeckArmor);

  const aftSpine = new THREE.Mesh(
    new THREE.BoxGeometry(6.8 * scale, 0.24 * scale, 0.7 * scale),
    hullTrimMaterial.clone()
  );
  aftSpine.position.set(4.8 * scale, hullHeight * scale + 0.72 * scale, 0);
  aftSpine.name = 'destroyer_aft_spine';
  aftSpine.castShadow = true;
  group.add(aftSpine);

  for (let i = 0; i < 2; i++) {
    const deckEdgeTrim = new THREE.Mesh(
      new THREE.BoxGeometry(15.8 * scale, 0.18 * scale, 0.22 * scale),
      hullTrimMaterial.clone()
    );
    deckEdgeTrim.position.set(0, hullHeight * scale + 0.6 * scale, (i === 0 ? -2.85 : 2.85) * scale);
    deckEdgeTrim.name = `destroyer_deck_edge_trim_${i}`;
    deckEdgeTrim.castShadow = true;
    group.add(deckEdgeTrim);
  }

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(4 * scale, 4 * scale, 3 * scale),
    commandMaterial
  );
  bridge.position.set(2 * scale, hullHeight * scale + 2.5 * scale, 0);
  bridge.name = 'destroyer_bridge';
  bridge.castShadow = true;
  group.add(bridge);
  parts.push(bridge);

  const bridgeSidePodLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.9 * scale, 2.1 * scale, 1.4 * scale),
    commandMaterial.clone()
  );
  bridgeSidePodLeft.position.set(2.5 * scale, hullHeight * scale + 2.1 * scale, -2.25 * scale);
  bridgeSidePodLeft.name = 'destroyer_bridge_side_pod_left';
  bridgeSidePodLeft.castShadow = true;
  group.add(bridgeSidePodLeft);

  const bridgeSidePodRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.9 * scale, 2.1 * scale, 1.4 * scale),
    commandMaterial.clone()
  );
  bridgeSidePodRight.position.set(2.5 * scale, hullHeight * scale + 2.1 * scale, 2.25 * scale);
  bridgeSidePodRight.name = 'destroyer_bridge_side_pod_right';
  bridgeSidePodRight.castShadow = true;
  group.add(bridgeSidePodRight);

  const bridgeCrown = new THREE.Mesh(
    new THREE.BoxGeometry(2.8 * scale, 0.35 * scale, 2.2 * scale),
    hullTrimMaterial
  );
  bridgeCrown.position.set(2 * scale, hullHeight * scale + 4.6 * scale, 0);
  bridgeCrown.name = 'destroyer_bridge_crown';
  bridgeCrown.castShadow = true;
  group.add(bridgeCrown);

  const bridgeMidDeck = new THREE.Mesh(
    new THREE.BoxGeometry(3.2 * scale, 0.32 * scale, 2.5 * scale),
    deckMaterial.clone()
  );
  bridgeMidDeck.position.set(1.9 * scale, hullHeight * scale + 3.55 * scale, 0);
  bridgeMidDeck.name = 'destroyer_bridge_mid_deck';
  bridgeMidDeck.castShadow = true;
  group.add(bridgeMidDeck);

  const bridgeRearBlock = new THREE.Mesh(
    new THREE.BoxGeometry(1.8 * scale, 1.6 * scale, 2.2 * scale),
    commandMaterial.clone()
  );
  bridgeRearBlock.position.set(3.55 * scale, hullHeight * scale + 2.4 * scale, 0);
  bridgeRearBlock.name = 'destroyer_bridge_rear_block';
  bridgeRearBlock.castShadow = true;
  group.add(bridgeRearBlock);

  for (let i = 0; i < 2; i++) {
    const bridgeShoulder = new THREE.Mesh(
      new THREE.BoxGeometry(1.35 * scale, 1.3 * scale, 1.7 * scale),
      commandMaterial.clone()
    );
    bridgeShoulder.position.set(0.9 * scale, hullHeight * scale + 2.3 * scale, (i === 0 ? -2.2 : 2.2) * scale);
    bridgeShoulder.name = `destroyer_bridge_shoulder_${i}`;
    bridgeShoulder.castShadow = true;
    group.add(bridgeShoulder);
  }

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

  const radarFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.95 * scale, 0.08 * scale, 8, 16),
    hullTrimMaterial.clone()
  );
  radarFrame.rotation.y = Math.PI / 2;
  radarFrame.position.set(2 * scale, hullHeight * scale + 8 * scale, 0);
  radarFrame.name = 'destroyer_radar_frame';
  radarFrame.castShadow = true;
  group.add(radarFrame);

  const radarSupportLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale, 1.4 * scale, 0.18 * scale),
    hullTrimMaterial.clone()
  );
  radarSupportLeft.position.set(1.45 * scale, hullHeight * scale + 7.1 * scale, -0.8 * scale);
  radarSupportLeft.name = 'destroyer_radar_support_left';
  radarSupportLeft.castShadow = true;
  group.add(radarSupportLeft);

  const radarSupportRight = radarSupportLeft.clone();
  radarSupportRight.position.z = 0.8 * scale;
  radarSupportRight.name = 'destroyer_radar_support_right';
  group.add(radarSupportRight);

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
      weaponDeckMaterial
    );
    base.position.copy(flakPos.pos);
    base.name = `destroyer_flak_base_${flakPos.name}`;
    base.castShadow = true;
    group.add(base);
    parts.push(base);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 2.5 * scale, 8),
      weaponDeckMaterial
    );
    barrel.position.copy(flakPos.pos);
    barrel.position.y += 1.2 * scale;
    barrel.rotation.x = -Math.PI / 3;
    barrel.name = `destroyer_flak_barrel_${flakPos.name}`;
    barrel.castShadow = true;
    group.add(barrel);
    parts.push(barrel);

    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff8f4a,
        emissive: 0xff5a00,
        emissiveIntensity: 1,
        metalness: 0.35,
        roughness: 0.2,
      })
    );
    muzzle.position.copy(barrel.position);
    muzzle.position.y += 0.8 * scale;
    muzzle.position.z += flakPos.name.includes('left') ? -0.48 * scale : 0.48 * scale;
    muzzle.name = `destroyer_flak_muzzle_${flakPos.name}`;
    group.add(muzzle);
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
      weaponDeckMaterial
    );
    launcher.position.copy(launcherPos.pos);
    launcher.name = `destroyer_missile_launcher_${launcherPos.name}`;
    launcher.castShadow = true;
    group.add(launcher);
    parts.push(launcher);

    const launcherCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95 * scale, 0.95 * scale, 0.24 * scale, 10),
      hullTrimMaterial.clone()
    );
    launcherCollar.position.copy(launcherPos.pos);
    launcherCollar.position.y += 1.64 * scale;
    launcherCollar.name = `destroyer_launcher_collar_${launcherPos.name}`;
    launcherCollar.castShadow = true;
    group.add(launcherCollar);

    const launcherSupport = new THREE.Mesh(
      new THREE.BoxGeometry(1.4 * scale, 0.4 * scale, 1.4 * scale),
      weaponDeckMaterial.clone()
    );
    launcherSupport.position.copy(launcherPos.pos);
    launcherSupport.position.y -= 1.1 * scale;
    launcherSupport.name = `destroyer_launcher_support_${launcherPos.name}`;
    launcherSupport.castShadow = true;
    group.add(launcherSupport);

    const launcherFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.75 * scale, 0.2 * scale, 1.75 * scale),
      hullTrimMaterial.clone()
    );
    launcherFrame.position.copy(launcherPos.pos);
    launcherFrame.position.y += 1.78 * scale;
    launcherFrame.name = `destroyer_launcher_frame_${launcherPos.name}`;
    launcherFrame.castShadow = true;
    group.add(launcherFrame);

    const launcherCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58 * scale, 0.68 * scale, 0.3 * scale, 8),
      glowMaterial
    );
    launcherCap.position.copy(launcherPos.pos);
    launcherCap.position.y += 1.65 * scale;
    launcherCap.name = `destroyer_launcher_cap_${launcherPos.name}`;
    group.add(launcherCap);

    const cellCount = 4;
    for (let i = 0; i < cellCount; i++) {
      const cell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.5 * scale, 6),
        new THREE.MeshStandardMaterial({
          color: 0x4c5a6b,
          metalness: 0.9,
          roughness: 0.14,
          emissive: 0x1f2b3a,
          emissiveIntensity: 0.08,
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

  for (let i = 0; i < 2; i++) {
    const midshipModule = new THREE.Mesh(
      new THREE.BoxGeometry(3.4 * scale, 1.4 * scale, 1.8 * scale),
      superstructureMaterial.clone()
    );
    midshipModule.position.set((-1.4 + i * 4.8) * scale, hullHeight * scale + 1.55 * scale, 0);
    midshipModule.name = `destroyer_midship_module_${i}`;
    midshipModule.castShadow = true;
    group.add(midshipModule);
    parts.push(midshipModule);
  }

  for (let i = 0; i < 2; i++) {
    const hangarBlock = new THREE.Mesh(
      new THREE.BoxGeometry(3.2 * scale, 1.9 * scale, 2.4 * scale),
      deckMaterial.clone()
    );
    hangarBlock.position.set(8.1 * scale, hullHeight * scale + 1.75 * scale, (i === 0 ? -1.7 : 1.7) * scale);
    hangarBlock.name = `destroyer_aft_hangar_block_${i}`;
    hangarBlock.castShadow = true;
    group.add(hangarBlock);
    parts.push(hangarBlock);
  }

  for (let i = 0; i < 2; i++) {
    const vlsCluster = new THREE.Mesh(
      new THREE.BoxGeometry(2.4 * scale, 0.22 * scale, 1.8 * scale),
      hullTrimMaterial.clone()
    );
    vlsCluster.position.set((-6.3 + i * 10.6) * scale, hullHeight * scale + 0.92 * scale, 0);
    vlsCluster.name = `destroyer_vls_cluster_${i}`;
    vlsCluster.castShadow = true;
    group.add(vlsCluster);

    for (let cell = 0; cell < 6; cell++) {
      const vlsCell = new THREE.Mesh(
        new THREE.BoxGeometry(0.42 * scale, 0.18 * scale, 0.42 * scale),
        weaponDeckMaterial.clone()
      );
      vlsCell.position.set(
        (-7.1 + i * 10.6 + (cell % 3) * 0.75) * scale,
        hullHeight * scale + 1.05 * scale,
        (-0.55 + Math.floor(cell / 3) * 1.1) * scale
      );
      vlsCell.name = `destroyer_vls_cell_${i}_${cell}`;
      vlsCell.castShadow = true;
      group.add(vlsCell);
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

    const exhaustGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * scale, 0.3 * scale, 0.35 * scale, 8),
      exhaustMaterial
    );
    exhaustGlow.position.set(funnels[i].x, hullHeight * scale + 4.15 * scale, funnels[i].z);
    exhaustGlow.name = `destroyer_exhaust_glow_${i}`;
    group.add(exhaustGlow);
  }

  const keel = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength * scale * 0.62, 0.55 * scale, 0.9 * scale),
    hullMaterial.clone()
  );
  keel.position.set(0, -0.05 * scale, 0);
  keel.name = 'destroyer_keel';
  keel.castShadow = true;
  group.add(keel);

  for (let i = 0; i < 3; i++) {
    const sidePanelPort = new THREE.Mesh(
      new THREE.BoxGeometry(3.6 * scale, 0.7 * scale, 0.16 * scale),
      hullTrimMaterial.clone()
    );
    sidePanelPort.position.set((-7 + i * 7) * scale, hullHeight * scale * 0.7, -(hullWidth * 0.5 + 0.28) * scale);
    sidePanelPort.name = `destroyer_side_panel_port_${i}`;
    sidePanelPort.castShadow = true;
    group.add(sidePanelPort);

    const sidePanelStarboard = sidePanelPort.clone();
    sidePanelStarboard.position.z = (hullWidth * 0.5 + 0.28) * scale;
    sidePanelStarboard.name = `destroyer_side_panel_starboard_${i}`;
    group.add(sidePanelStarboard);
  }

  const sideStabilizerLeft = new THREE.Mesh(
    new THREE.BoxGeometry(5 * scale, 0.26 * scale, 0.9 * scale),
    superstructureMaterial.clone()
  );
  sideStabilizerLeft.position.set(-1 * scale, hullHeight * scale * 0.38, -(hullWidth * 0.5 + 0.65) * scale);
  sideStabilizerLeft.name = 'destroyer_side_stabilizer_left';
  sideStabilizerLeft.castShadow = true;
  group.add(sideStabilizerLeft);

  const sideStabilizerRight = new THREE.Mesh(
    new THREE.BoxGeometry(5 * scale, 0.26 * scale, 0.9 * scale),
    superstructureMaterial.clone()
  );
  sideStabilizerRight.position.set(-1 * scale, hullHeight * scale * 0.38, (hullWidth * 0.5 + 0.65) * scale);
  sideStabilizerRight.name = 'destroyer_side_stabilizer_right';
  sideStabilizerRight.castShadow = true;
  group.add(sideStabilizerRight);

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;
  return group;
}
