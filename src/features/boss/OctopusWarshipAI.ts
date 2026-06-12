import * as THREE from 'three';
import { BossConfig, TELEPORT_CONFIG, EYE_CONFIG } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { LaserSweepSystem } from './LaserSweepSystem';
import { EyeSystem } from './EyeSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

type BossGroup = THREE.Group & {
  bossParts?: THREE.Mesh[];
};

export class OctopusWarshipAI {
  readonly name = 'OctopusWarshipAI';
  private static readonly CRITICAL_HEALTH_THRESHOLD = 0.24;
  private static readonly TERMINAL_HEALTH_THRESHOLD = 0.16;
  private static readonly HIT_FLASH_DURATION = 0.2;
  private static readonly LIGHT_HIT_FLASH_DURATION = 0.14;
  private static readonly WEAKPOINT_PULSE_SPEED = 3.2;
  private static readonly WEAPON_PULSE_SPEED = 9.6;
  private static readonly ENERGY_PULSE_SPEED = 7.8;
  private static readonly CRITICAL_PULSE_SPEED = 13.2;
  private static readonly TERMINAL_PULSE_SPEED = 20.5;
  private static readonly BEACON_PULSE_SPEED = 2.3;

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
  private animationTime: number = 0;
  private hitFlashTimer: number = 0;
  private coreGlow: THREE.Mesh | null = null;
  private plateEdges: THREE.Mesh[] = [];
  private apertures: THREE.Mesh[] = [];
  private antennaTips: THREE.Mesh[] = [];
  private signalBeacons: THREE.Mesh[] = [];
  private readonly hitFlashColor = new THREE.Color(0xd8fbff);
  private readonly weakpointBaseColor = new THREE.Color(0xff6c3b);
  private readonly weakpointCriticalColor = new THREE.Color(0xffb67a);
  private readonly weaponBaseColor = new THREE.Color(0xff9456);
  private readonly weaponCriticalColor = new THREE.Color(0xffd7a0);
  private readonly energyBaseColor = new THREE.Color(0x56d8ff);
  private readonly energyCriticalColor = new THREE.Color(0x9bf0ff);
  private readonly terminalColor = new THREE.Color(0xff321a);

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
    this.parts = (mesh as BossGroup).bossParts || [];
    this.cacheVisualNodes();

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
      this.hitFlashTimer = Math.max(this.hitFlashTimer, OctopusWarshipAI.LIGHT_HIT_FLASH_DURATION);
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
    this.animationTime += deltaTime;
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);

    if (this.teleportCooldown > 0) {
      this.teleportCooldown -= deltaTime;
    }

    if (!this.isTeleporting) {
      this.updateMovement(deltaTime);
      this.updateLaser(deltaTime);
      this.updateEyes(deltaTime, friendlyMeshes);
    }

    this.updateVisualEffects();
  }

  private cacheVisualNodes(): void {
    this.coreGlow = this.mesh.getObjectByName('octopus_core_glow') as THREE.Mesh | null;
    this.plateEdges = this.mesh.children.filter((child) =>
      child.name.startsWith('octopus_plate_edge_')
    ) as THREE.Mesh[];
    this.apertures = this.mesh.children.filter(
      (child) => child.name === 'octopus_top_aperture' || child.name === 'octopus_bottom_aperture'
    ) as THREE.Mesh[];
    this.antennaTips = this.mesh.children.filter((child) =>
      child.name.startsWith('octopus_antenna_tip_')
    ) as THREE.Mesh[];
    this.signalBeacons = this.mesh.children.filter((child) =>
      child.name.startsWith('octopus_signal_beacon_')
    ) as THREE.Mesh[];
  }

  private updateVisualEffects(): void {
    const healthRatio = this.getHealth().current / this.getHealth().max;
    const lowHealthBoost = 1 + (1 - healthRatio) * 0.9;
    const criticalState = THREE.MathUtils.clamp(
      (OctopusWarshipAI.CRITICAL_HEALTH_THRESHOLD - healthRatio)
        / OctopusWarshipAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (OctopusWarshipAI.TERMINAL_HEALTH_THRESHOLD - healthRatio)
        / OctopusWarshipAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const hitFlash = this.getHitFlashStrength();
    const teleportCharge =
      this.teleportCooldown > 0
        ? 1 -
          THREE.MathUtils.clamp(this.teleportCooldown / Math.max(TELEPORT_CONFIG.COOLDOWN, 0.001), 0, 1)
        : 1;
    const criticalPulse =
      (Math.sin(this.animationTime * OctopusWarshipAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5)
      * criticalState;
    const terminalPulse =
      (Math.sin(this.animationTime * OctopusWarshipAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5)
      * terminalState;
    const terminalWarning = Math.sqrt(terminalState);
    const criticalBias = criticalState * criticalState;
    const phasePressure = 1 + terminalWarning * 0.75 + criticalState * 0.2;
    const terminalCrescendo = terminalWarning * (this.isTeleporting ? 0.2 : 1);
    const terminalWarningPulse = terminalPulse * terminalWarning;
    const corePulse =
      (Math.sin(
        this.animationTime
        * (this.isTeleporting ? OctopusWarshipAI.TERMINAL_PULSE_SPEED : OctopusWarshipAI.WEAKPOINT_PULSE_SPEED)
      ) * 0.5 + 0.5)
      * lowHealthBoost;
    this.setGlowState(this.coreGlow, {
      intensity:
        0.95 +
        corePulse * 1.35 +
        (this.isTeleporting ? 0.9 : 0) +
        criticalPulse * 1.1 +
        terminalPulse * 1.5 +
        terminalWarning * 0.75 +
        hitFlash * 1.45,
      scale:
        1 +
        corePulse * 0.09 +
        (this.isTeleporting ? 0.08 : 0) +
        criticalPulse * 0.07 +
        terminalPulse * 0.08 +
        hitFlash * 0.06,
      color: this.weakpointBaseColor
        .clone()
        .lerp(
          this.weakpointCriticalColor,
          (this.isTeleporting ? 0.5 : 0.1) + criticalPulse * 0.25 + criticalBias * 0.3
        )
        .lerp(this.terminalColor, terminalState * 0.75 + terminalWarning * 0.45 + terminalPulse * 0.35)
        .lerp(this.hitFlashColor, hitFlash * 0.7),
    });

    for (let i = 0; i < this.plateEdges.length; i++) {
      const pulse =
        Math.sin(this.animationTime * OctopusWarshipAI.ENERGY_PULSE_SPEED + i * 0.9) * 0.5 + 0.5;
      this.setGlowState(this.plateEdges[i], {
        intensity:
          0.6 +
          pulse * 0.85 * lowHealthBoost +
          criticalPulse * 0.6 +
          terminalPulse * 1.0 +
          hitFlash * 0.82 +
          terminalCrescendo * 0.45,
        scale:
          1 +
          pulse * 0.04 * phasePressure +
          criticalPulse * 0.04 +
          terminalPulse * 0.05 +
          hitFlash * 0.03 +
          terminalWarning * 0.04,
        color: this.energyBaseColor
          .clone()
          .lerp(this.energyCriticalColor, criticalState * 0.65 + criticalPulse * 0.25 + criticalBias * 0.22)
          .lerp(this.terminalColor, terminalState * 0.48 + terminalWarningPulse * 0.5 + terminalPulse * 0.25),
      });
    }

    for (let i = 0; i < this.apertures.length; i++) {
      const pulse =
        Math.sin(this.animationTime * OctopusWarshipAI.WEAPON_PULSE_SPEED + i * Math.PI) * 0.5 + 0.5;
      this.setGlowState(this.apertures[i], {
        intensity:
          0.7 +
          teleportCharge * 0.9 +
          pulse * 0.45 +
          criticalPulse * 0.85 +
          terminalPulse * 1.05 +
          terminalWarning * 0.45 +
          hitFlash * 0.9,
        scale:
          1 +
          teleportCharge * 0.08 +
          pulse * 0.03 +
          criticalPulse * 0.04 +
          terminalPulse * 0.04 +
          hitFlash * 0.04 +
          terminalWarning * 0.05 +
          terminalWarningPulse * 0.02,
        color: this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + criticalPulse * 0.3 + criticalBias * 0.25)
          .lerp(this.terminalColor, terminalState * 0.56 + terminalPulse * 0.35 + terminalWarning * 0.25)
          .lerp(this.hitFlashColor, hitFlash * 0.35),
      });
    }

    for (let i = 0; i < this.antennaTips.length; i++) {
      const pulse =
        Math.sin(this.animationTime * OctopusWarshipAI.ENERGY_PULSE_SPEED + i * 1.1) * 0.5 + 0.5;
      this.setGlowState(this.antennaTips[i], {
        intensity:
          0.55 + pulse * 0.9 + criticalPulse * 0.7 + terminalPulse * 0.75 + hitFlash * 0.75,
        scale:
          1 +
          pulse * 0.06 +
          criticalPulse * 0.04 +
          terminalPulse * 0.04 +
          hitFlash * 0.03 +
          terminalWarning * 0.04,
        color: this.energyBaseColor
          .clone()
          .lerp(this.energyCriticalColor, criticalState * 0.5 + criticalPulse * 0.15 + criticalBias * 0.22)
          .lerp(this.terminalColor, terminalState * 0.32 + terminalPulse * 0.2 + terminalWarning * 0.25)
          .lerp(this.hitFlashColor, hitFlash * 0.35),
      });
    }

    // 信号灯（警示信标）缓慢脉冲
    const beaconWave =
      Math.sin(this.animationTime * OctopusWarshipAI.BEACON_PULSE_SPEED) * 0.5 + 0.5;
    for (const beacon of this.signalBeacons) {
      this.setBeaconOpacity(beacon, 0.3 + beaconWave * 0.7);
    }
  }

  private setBeaconOpacity(mesh: THREE.Mesh, opacity: number): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.opacity = opacity;
    }
  }

  private getHitFlashStrength(): number {
    if (this.hitFlashTimer <= 0) {
      return 0;
    }

    return THREE.MathUtils.clamp(this.hitFlashTimer / OctopusWarshipAI.HIT_FLASH_DURATION, 0, 1);
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
    this.hitFlashTimer = OctopusWarshipAI.HIT_FLASH_DURATION;

    if (!this.isTeleporting && this.teleportCooldown <= 0 && !this.teleportDisabled) {
      if (Math.random() < TELEPORT_CONFIG.CHANCE_ON_HIT) {
        this.performTeleport();
      }
    }
  }

  public takeEyeDamage(eyeIndex: number, damage: number): void {
    this.eyeSystem.damageEye(eyeIndex, damage);
    this.hitFlashTimer = OctopusWarshipAI.LIGHT_HIT_FLASH_DURATION;
  }

  public takeEyeDamageAtPosition(hitPosition: THREE.Vector3, damage: number): void {
    this.eyeSystem.damageNearestEye(hitPosition, damage);
    this.hitFlashTimer = OctopusWarshipAI.LIGHT_HIT_FLASH_DURATION;
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

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x55ddff,
    emissive: 0x22ccff,
    emissiveIntensity: 1.25,
    metalness: 0.45,
    roughness: 0.15,
  });

  const energyMaterial = new THREE.MeshStandardMaterial({
    color: 0x71ebff,
    emissive: 0x2fe0ff,
    emissiveIntensity: 0.85,
    metalness: 0.52,
    roughness: 0.12,
  });

  const sensorMaterial = new THREE.MeshStandardMaterial({
    color: 0x7ea7cf,
    metalness: 0.78,
    roughness: 0.16,
    emissive: 0x335f88,
    emissiveIntensity: 0.3,
  });

  const innerFrameMaterial = new THREE.MeshStandardMaterial({
    color: 0x24485d,
    metalness: 0.85,
    roughness: 0.18,
  });

  const bodyGeometry = new THREE.SphereGeometry(15, 32, 32);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'octopus_body';
  body.castShadow = true;
  group.add(body);
  parts.push(body);

  const equatorRing = new THREE.Mesh(
    new THREE.TorusGeometry(12.5, 1.1, 12, 32),
    innerFrameMaterial
  );
  equatorRing.rotation.x = Math.PI / 2;
  equatorRing.name = 'octopus_equator_ring';
  equatorRing.castShadow = true;
  group.add(equatorRing);

  const upperRing = new THREE.Mesh(
    new THREE.TorusGeometry(11.6, 0.42, 10, 28),
    armorMaterial.clone()
  );
  upperRing.rotation.x = Math.PI / 2;
  upperRing.position.y = 4.8;
  upperRing.name = 'octopus_upper_ring';
  upperRing.castShadow = true;
  group.add(upperRing);

  const lowerRing = new THREE.Mesh(
    new THREE.TorusGeometry(11.6, 0.42, 10, 28),
    armorMaterial.clone()
  );
  lowerRing.rotation.x = Math.PI / 2;
  lowerRing.position.y = -4.8;
  lowerRing.name = 'octopus_lower_ring';
  lowerRing.castShadow = true;
  group.add(lowerRing);

  const coreGlow = new THREE.Mesh(
    new THREE.SphereGeometry(6, 20, 20),
    glowMaterial
  );
  coreGlow.name = 'octopus_core_glow';
  group.add(coreGlow);

  const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(7.1, 0.45, 10, 30),
    energyMaterial.clone()
  );
  coreRing.rotation.x = Math.PI / 2;
  coreRing.name = 'octopus_core_ring';
  coreRing.castShadow = true;
  group.add(coreRing);

  const innerLatticeRing = new THREE.Mesh(
    new THREE.TorusGeometry(9.2, 0.22, 8, 28),
    innerFrameMaterial.clone()
  );
  innerLatticeRing.rotation.x = Math.PI / 2;
  innerLatticeRing.name = 'octopus_inner_lattice_ring';
  innerLatticeRing.castShadow = true;
  group.add(innerLatticeRing);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 7.2),
      innerFrameMaterial.clone()
    );
    spoke.position.set(Math.cos(angle) * 5.8, 0, Math.sin(angle) * 5.8);
    spoke.rotation.y = -angle;
    spoke.name = `octopus_inner_spoke_${i}`;
    spoke.castShadow = true;
    group.add(spoke);
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 3), armorMaterial.clone());
    plate.position.set(Math.cos(angle) * 14, 0, Math.sin(angle) * 14);
    plate.rotation.y = -angle;
    plate.name = `octopus_plate_${i}`;
    plate.castShadow = true;
    group.add(plate);
    parts.push(plate);

    const plateEdge = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.7, 0.8),
      glowMaterial
    );
    plateEdge.position.copy(plate.position);
    plateEdge.position.y += 2.6;
    plateEdge.rotation.y = plate.rotation.y;
    plateEdge.name = `octopus_plate_edge_${i}`;
    group.add(plateEdge);

    const sideModule = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.6, 3.8, 10),
      innerFrameMaterial.clone()
    );
    sideModule.rotation.z = Math.PI / 2;
    sideModule.position.set(Math.cos(angle) * 11.2, 0, Math.sin(angle) * 11.2);
    sideModule.rotation.y = -angle;
    sideModule.name = `octopus_side_module_${i}`;
    sideModule.castShadow = true;
    group.add(sideModule);

    const sideCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 10, 10),
      energyMaterial
    );
    sideCap.position.set(Math.cos(angle) * 12.8, 0, Math.sin(angle) * 12.8);
    sideCap.name = `octopus_side_cap_${i}`;
    group.add(sideCap);

    const suspendedPod = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.8, 1.1),
      armorMaterial.clone()
    );
    suspendedPod.position.set(Math.cos(angle) * 16.1, -1.1, Math.sin(angle) * 16.1);
    suspendedPod.rotation.y = -angle;
    suspendedPod.name = `octopus_suspended_pod_${i}`;
    suspendedPod.castShadow = true;
    group.add(suspendedPod);
    parts.push(suspendedPod);

    const podGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 8, 8),
      energyMaterial
    );
    podGlow.position.set(Math.cos(angle) * 17.1, -1.1, Math.sin(angle) * 17.1);
    podGlow.name = `octopus_suspended_pod_glow_${i}`;
    group.add(podGlow);

    const supportStrut = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.5, 0.6),
      armorMaterial.clone()
    );
    supportStrut.position.set(Math.cos(angle) * 9.6, 0, Math.sin(angle) * 9.6);
    supportStrut.rotation.y = -angle;
    supportStrut.name = `octopus_support_strut_${i}`;
    supportStrut.castShadow = true;
    group.add(supportStrut);

    const supportBrace = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.3, 2.2),
      innerFrameMaterial.clone()
    );
    supportBrace.position.set(Math.cos(angle) * 8.2, 0, Math.sin(angle) * 8.2);
    supportBrace.rotation.y = -angle;
    supportBrace.name = `octopus_support_brace_${i}`;
    supportBrace.castShadow = true;
    group.add(supportBrace);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.3, 9.2, 0.55), armorMaterial.clone());
    rib.position.set(Math.cos(angle) * 9.4, 0, Math.sin(angle) * 9.4);
    rib.rotation.y = -angle;
    rib.name = `octopus_rib_${i}`;
    rib.castShadow = true;
    group.add(rib);

    const ribCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.3, 0.7),
      innerFrameMaterial.clone()
    );
    ribCap.position.set(Math.cos(angle) * 10.6, 0, Math.sin(angle) * 10.6);
    ribCap.rotation.y = -angle;
    ribCap.name = `octopus_rib_cap_${i}`;
    ribCap.castShadow = true;
    group.add(ribCap);
  }

  const topDomeGeometry = new THREE.SphereGeometry(8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const topDome = new THREE.Mesh(topDomeGeometry, armorMaterial);
  topDome.position.set(0, 10, 0);
  topDome.name = 'octopus_top_dome';
  topDome.castShadow = true;
  group.add(topDome);
  parts.push(topDome);

  const topDeckRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.1, 0.32, 8, 24),
    innerFrameMaterial.clone()
  );
  topDeckRing.rotation.x = Math.PI / 2;
  topDeckRing.position.set(0, 9.2, 0);
  topDeckRing.name = 'octopus_top_deck_ring';
  topDeckRing.castShadow = true;
  group.add(topDeckRing);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const topBrace = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 3.8),
      armorMaterial.clone()
    );
    topBrace.position.set(Math.cos(angle) * 4.2, 9.6, Math.sin(angle) * 4.2);
    topBrace.rotation.y = -angle;
    topBrace.name = `octopus_top_brace_${i}`;
    topBrace.castShadow = true;
    group.add(topBrace);
  }

  const crownCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 5.2, 1.5, 12),
    armorMaterial.clone()
  );
  crownCollar.position.set(0, 12.1, 0);
  crownCollar.name = 'octopus_crown_collar';
  crownCollar.castShadow = true;
  group.add(crownCollar);

  const topAperture = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.8, 1.6, 16),
    energyMaterial
  );
  topAperture.position.set(0, 10.4, 0);
  topAperture.name = 'octopus_top_aperture';
  group.add(topAperture);

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

  const bottomDeckRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.1, 0.32, 8, 24),
    innerFrameMaterial.clone()
  );
  bottomDeckRing.rotation.x = Math.PI / 2;
  bottomDeckRing.position.set(0, -9.2, 0);
  bottomDeckRing.name = 'octopus_bottom_deck_ring';
  bottomDeckRing.castShadow = true;
  group.add(bottomDeckRing);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const lowerFin = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.1, 0.55),
      armorMaterial.clone()
    );
    lowerFin.position.set(Math.cos(angle) * 6.7, -8.8, Math.sin(angle) * 6.7);
    lowerFin.rotation.y = -angle;
    lowerFin.name = `octopus_lower_fin_${i}`;
    lowerFin.castShadow = true;
    group.add(lowerFin);
  }

  const bottomAperture = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.8, 1.6, 16),
    energyMaterial
  );
  bottomAperture.position.set(0, -10.4, 0);
  bottomAperture.name = 'octopus_bottom_aperture';
  group.add(bottomAperture);

  const bellyHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 5.1, 2.1, 12),
    innerFrameMaterial.clone()
  );
  bellyHousing.position.set(0, -12.2, 0);
  bellyHousing.name = 'octopus_belly_housing';
  bellyHousing.castShadow = true;
  group.add(bellyHousing);

  const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.3, 10, 8);
  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f98bd,
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

    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 10),
      sensorMaterial
    );
    antennaTip.position.set(Math.cos(angle) * 5.9, 19.2, Math.sin(angle) * 5.9);
    antennaTip.name = `octopus_antenna_tip_${i}`;
    group.add(antennaTip);

    const antennaCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.08, 8, 16),
      innerFrameMaterial.clone()
    );
    antennaCollar.rotation.x = Math.PI / 2;
    antennaCollar.position.set(Math.cos(angle) * 5.15, 16.7, Math.sin(angle) * 5.15);
    antennaCollar.name = `octopus_antenna_collar_${i}`;
    antennaCollar.castShadow = true;
    group.add(antennaCollar);
  }

  // ===== 细节增强：装甲镶板 / 上层结构 / 武备细节 / 信号灯 =====
  const plateDetailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x336688).offsetHSL(0, 0.06, -0.06),
    metalness: 0.82,
    roughness: 0.18,
  });
  const frameDetailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x24485d).offsetHSL(0, 0.05, -0.04),
    metalness: 0.86,
    roughness: 0.16,
  });
  const crownWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fe8ff,
    emissive: 0x2fa8d8,
    emissiveIntensity: 0.85,
    metalness: 0.55,
    roughness: 0.1,
  });
  const runningLightRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const runningLightGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x2aff5a });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5040,
    transparent: true,
    opacity: 0.85,
  });
  const thrusterGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x55e0ff,
    transparent: true,
    opacity: 0.85,
  });

  // 复用几何体
  const platePanelGeometry = new THREE.BoxGeometry(3.4, 1.5, 0.5);
  const ribTrimGeometry = new THREE.BoxGeometry(0.5, 3.6, 0.3);
  const crownWindowGeometry = new THREE.BoxGeometry(1.6, 0.45, 0.18);
  const sensorRodGeometry = new THREE.CylinderGeometry(0.08, 0.1, 1.8, 6);
  const railPostGeometry = new THREE.BoxGeometry(0.12, 0.8, 0.12);
  const apertureFinGeometry = new THREE.BoxGeometry(0.5, 0.9, 1.6);
  const eyeSocketGeometry = new THREE.TorusGeometry(3.3, 0.25, 8, 18);
  const runningLightGeometry = new THREE.SphereGeometry(0.45, 8, 8);
  const beaconGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const thrusterDotGeometry = new THREE.SphereGeometry(0.4, 8, 8);

  // 装甲板镶板细节（避开赤道眼睛带）
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    for (let j = 0; j < 2; j++) {
      const platePanel = new THREE.Mesh(platePanelGeometry, plateDetailMaterial);
      platePanel.position.set(
        Math.cos(angle) * 15.6,
        j === 0 ? 3.4 : -3.4,
        Math.sin(angle) * 15.6
      );
      platePanel.rotation.y = -angle;
      platePanel.name = `octopus_plate_panel_${i}_${j}`;
      platePanel.castShadow = true;
      group.add(platePanel);
    }
  }

  // 肋骨饰条
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const ribTrim = new THREE.Mesh(ribTrimGeometry, frameDetailMaterial);
    ribTrim.position.set(Math.cos(angle) * 9.95, 2.6, Math.sin(angle) * 9.95);
    ribTrim.rotation.y = -angle;
    ribTrim.name = `octopus_rib_trim_${i}`;
    ribTrim.castShadow = true;
    group.add(ribTrim);
  }

  // 冠部舷窗（发光条）
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const crownWindow = new THREE.Mesh(crownWindowGeometry, crownWindowMaterial);
    crownWindow.position.set(Math.cos(angle) * 4.9, 12.2, Math.sin(angle) * 4.9);
    crownWindow.rotation.y = Math.PI / 2 - angle;
    crownWindow.name = `octopus_crown_window_${i}`;
    group.add(crownWindow);
  }

  // 雷达盘（圆柱 + 环形格栅）
  const radarPost = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), frameDetailMaterial);
  radarPost.position.set(1.8, 13.4, 0);
  radarPost.name = 'octopus_radar_post';
  radarPost.castShadow = true;
  group.add(radarPost);

  const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.25, 12), plateDetailMaterial);
  radarDish.position.set(1.8, 14.2, 0);
  radarDish.rotation.z = 0.5;
  radarDish.name = 'octopus_radar_dish';
  radarDish.castShadow = true;
  group.add(radarDish);

  const radarLattice = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 6, 14), frameDetailMaterial);
  radarLattice.position.set(1.8, 14.2, 0);
  radarLattice.rotation.set(Math.PI / 2, 0, 0.5);
  radarLattice.name = 'octopus_radar_lattice';
  radarLattice.castShadow = true;
  group.add(radarLattice);

  // 传感杆阵列
  const sensorAngles = [0.8, 2.6, 4.5];
  sensorAngles.forEach((angle, i) => {
    const sensorRod = new THREE.Mesh(sensorRodGeometry, frameDetailMaterial);
    sensorRod.position.set(Math.cos(angle) * 3.6, 13.3, Math.sin(angle) * 3.6);
    sensorRod.name = `octopus_sensor_rod_${i}`;
    sensorRod.castShadow = true;
    group.add(sensorRod);
  });

  // 顶部甲板栏杆
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const railPost = new THREE.Mesh(railPostGeometry, frameDetailMaterial);
    railPost.position.set(Math.cos(angle) * 6.1, 9.75, Math.sin(angle) * 6.1);
    railPost.name = `octopus_rail_post_${i}`;
    railPost.castShadow = true;
    group.add(railPost);
  }

  const railRing = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.07, 6, 24), frameDetailMaterial);
  railRing.rotation.x = Math.PI / 2;
  railRing.position.set(0, 10.1, 0);
  railRing.name = 'octopus_rail_ring';
  railRing.castShadow = true;
  group.add(railRing);

  // 能量孔武备护鳍（不移动孔位锚点）
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;

    const topFin = new THREE.Mesh(apertureFinGeometry, plateDetailMaterial);
    topFin.position.set(Math.cos(angle) * 3.3, 10.6, Math.sin(angle) * 3.3);
    topFin.rotation.y = -angle;
    topFin.name = `octopus_aperture_fin_top_${i}`;
    topFin.castShadow = true;
    group.add(topFin);

    const bottomFin = new THREE.Mesh(apertureFinGeometry, plateDetailMaterial);
    bottomFin.position.set(Math.cos(angle) * 3.3, -10.6, Math.sin(angle) * 3.3);
    bottomFin.rotation.y = -angle;
    bottomFin.name = `octopus_aperture_fin_bottom_${i}`;
    bottomFin.castShadow = true;
    group.add(bottomFin);
  }

  // 眼部装甲座圈（围绕运行时眼睛位置，不移动眼睛锚点）
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const eyeSocket = new THREE.Mesh(eyeSocketGeometry, frameDetailMaterial);
    eyeSocket.position.set(Math.cos(angle) * 14.9, 0, Math.sin(angle) * 14.9);
    eyeSocket.rotation.y = Math.PI / 2 - angle;
    eyeSocket.name = `octopus_eye_socket_${i}`;
    eyeSocket.castShadow = true;
    group.add(eyeSocket);
  }

  // 航行灯（左红右绿）
  const leftRunningLight = new THREE.Mesh(runningLightGeometry, runningLightRedMaterial);
  leftRunningLight.position.set(-11.6, 5.5, 0);
  leftRunningLight.name = 'octopus_running_light_left';
  group.add(leftRunningLight);

  const rightRunningLight = new THREE.Mesh(runningLightGeometry, runningLightGreenMaterial);
  rightRunningLight.position.set(11.6, 5.5, 0);
  rightRunningLight.name = 'octopus_running_light_right';
  group.add(rightRunningLight);

  // 警示信标（慢速脉冲）
  const beaconSpots = [
    { x: -2.5, y: 12.95, z: 0 },
    { x: 2.5, y: 12.95, z: 0 },
    { x: 0, y: 12.95, z: -2.5 },
    { x: 0, y: 12.95, z: 2.5 },
    { x: 0, y: -13.6, z: 0 },
  ];
  beaconSpots.forEach((spot, i) => {
    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.set(spot.x, spot.y, spot.z);
    beacon.name = `octopus_signal_beacon_${i}`;
    group.add(beacon);
  });

  // 腹部推进辉光点阵
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const thrusterDot = new THREE.Mesh(thrusterDotGeometry, thrusterGlowMaterial);
    thrusterDot.position.set(Math.cos(angle) * 3.4, -13.45, Math.sin(angle) * 3.4);
    thrusterDot.name = `octopus_thruster_glow_${i}`;
    group.add(thrusterDot);
  }

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;

  group.scale.setScalar(scale);
  return group;
}
