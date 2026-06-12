import * as THREE from 'three';
import { BossConfig, FlakCannonPosition, FLAK_CANNON_CONFIG } from './BossTypes';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { BossMissileSystem } from './BossMissileSystem';
import { FlakCannonSystem } from './FlakCannonSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

type BossGroup = THREE.Group & {
  bossParts?: THREE.Mesh[];
};

export class DesertFortressAI {
  private static readonly CRITICAL_HEALTH_THRESHOLD = 0.24;
  private static readonly TERMINAL_HEALTH_THRESHOLD = 0.16;
  private static readonly HIT_FLASH_DURATION = 0.2;
  private static readonly WEAKPOINT_PULSE_SPEED = 3.2;
  private static readonly WEAPON_PULSE_SPEED = 9.6;
  private static readonly ENERGY_PULSE_SPEED = 7.8;
  private static readonly CRITICAL_PULSE_SPEED = 13.2;
  private static readonly TERMINAL_PULSE_SPEED = 20.5;
  private static readonly BEACON_PULSE_SPEED = 2.2;
  private mesh: THREE.Group;
  private config: BossConfig;
  private health: HealthSystem;
  private missileSystem: BossMissileSystem;
  private flakCannonSystem: FlakCannonSystem;
  private animationTime: number = 0;
  private hitFlashTimer: number = 0;
  private coreGlow: THREE.Mesh | null = null;
  private flakMuzzles: THREE.Mesh[] = [];
  private missileGlowCaps: THREE.Mesh[] = [];
  private signalBeacons: THREE.Mesh[] = [];
  private readonly hitFlashColor = new THREE.Color(0xfff1c1);
  private readonly weakpointBaseColor = new THREE.Color(0xff6e3a);
  private readonly weakpointCriticalColor = new THREE.Color(0xffb47a);
  private readonly weaponBaseColor = new THREE.Color(0xff9350);
  private readonly weaponCriticalColor = new THREE.Color(0xffd89d);
  private readonly energyBaseColor = new THREE.Color(0x4fcfff);
  private readonly energyCriticalColor = new THREE.Color(0x95eeff);
  private readonly terminalColor = new THREE.Color(0xff321a);

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
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - deltaTime);

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
    this.updateVisualEffects();
  }

  private cacheVisualNodes(): void {
    this.coreGlow = this.mesh.getObjectByName('fortress_core_glow') as THREE.Mesh | null;
    this.flakMuzzles = this.mesh.children.filter((child) =>
      child.name.startsWith('fortress_flak_muzzle_')
    ) as THREE.Mesh[];
    this.missileGlowCaps = this.mesh.children.filter((child) =>
      child.name.endsWith('_glow') && child.name.startsWith('fortress_missile_')
    ) as THREE.Mesh[];
    this.signalBeacons = this.mesh.children.filter((child) =>
      child.name.startsWith('fortress_signal_beacon_')
    ) as THREE.Mesh[];
  }

  private updateVisualEffects(): void {
    const healthState = this.getHealth().current / this.getHealth().max;
    const damagePulse = 1 + (1 - healthState) * 0.55;
    const criticalState = THREE.MathUtils.clamp(
      (DesertFortressAI.CRITICAL_HEALTH_THRESHOLD - healthState)
        / DesertFortressAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (DesertFortressAI.TERMINAL_HEALTH_THRESHOLD - healthState)
        / DesertFortressAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const hitFlash = this.getHitFlashStrength();
    const criticalPulse =
      (Math.sin(this.animationTime * DesertFortressAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5)
      * criticalState;
    const terminalPulse =
      (Math.sin(this.animationTime * DesertFortressAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5)
      * terminalState;
    const terminalBias = terminalState * terminalState;
    const terminalWarning = Math.sqrt(terminalState);
    const criticalBias = criticalState * criticalState;
    const phaseSeparation = 1 + terminalWarning * 0.8 + criticalState * 0.3;
    const damagePhase = hitFlash * 0.75 + terminalWarning * 0.35;
    const corePulse =
      0.55
      + (Math.sin(this.animationTime * DesertFortressAI.WEAKPOINT_PULSE_SPEED) * 0.5 + 0.5)
        * 0.9
        * damagePulse;
    this.setGlowState(this.coreGlow, {
      intensity:
        0.7 +
        corePulse * 1.02 +
        criticalPulse * 1.15 +
        terminalPulse * 1.45 +
        damagePhase * 1.2,
      scale:
        1 +
        corePulse * 0.09 * phaseSeparation +
        criticalPulse * 0.08 +
        terminalPulse * 0.1 +
        hitFlash * 0.08 +
        terminalBias * 0.08,
      color: this.weakpointBaseColor
        .clone()
        .lerp(this.weakpointCriticalColor, 1 - healthState + criticalPulse * 0.25 + criticalBias * 0.25)
        .lerp(this.terminalColor, terminalState * 0.75 + terminalPulse * 0.35 + terminalBias * 0.2)
        .lerp(this.hitFlashColor, hitFlash * 0.75),
    });

    const flakCharge =
      1 -
      THREE.MathUtils.clamp(
        this.flakCooldown / Math.max(this.config.cannonFireInterval, 0.001),
        0,
        1
      );
    for (let i = 0; i < this.flakMuzzles.length; i++) {
      const offsetPulse =
        Math.sin(this.animationTime * DesertFortressAI.WEAPON_PULSE_SPEED + i * 1.4) * 0.5 + 0.5;
      const intensity =
        0.45 +
        flakCharge * 1.35 +
        offsetPulse * 0.35 +
        criticalPulse * 0.7 +
        terminalPulse * 1.1 +
        hitFlash * 0.78 +
        terminalWarning * 0.22;
      this.setGlowState(this.flakMuzzles[i], {
        intensity: intensity,
        scale:
          1 +
          flakCharge * 0.22 * phaseSeparation +
          offsetPulse * 0.05 +
          criticalPulse * 0.06 +
          terminalPulse * 0.08 +
          hitFlash * 0.04 +
          terminalBias * 0.05,
        color: this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + criticalPulse * 0.25 + criticalBias * 0.2)
          .lerp(this.terminalColor, terminalState * 0.62 + terminalPulse * 0.32 + terminalBias * 0.22)
          .lerp(this.hitFlashColor, hitFlash * 0.45),
      });
    }

    const missileCharge =
      1 -
      THREE.MathUtils.clamp(
        this.missileCooldown / Math.max(this.config.missileFireInterval, 0.001),
        0,
        1
      );
    for (let i = 0; i < this.missileGlowCaps.length; i++) {
      const isActiveLauncher = i === this.currentMissileLauncher;
      const pulse =
        Math.sin(this.animationTime * DesertFortressAI.ENERGY_PULSE_SPEED + i * 1.8) * 0.5 + 0.5;
      const activeBoost = isActiveLauncher ? 0.35 : 0;
      this.setGlowState(this.missileGlowCaps[i], {
        intensity:
          0.4 +
          missileCharge * 1.1 +
          pulse * 0.25 +
          activeBoost +
          criticalPulse * 0.65 +
          terminalPulse * 1.05 +
          hitFlash * 0.75 +
          terminalWarning * 0.3,
        scale:
          1 +
          missileCharge * 0.16 +
          activeBoost * 0.05 +
          criticalPulse * 0.04 +
          terminalPulse * 0.06 +
          hitFlash * 0.04 +
          terminalBias * 0.06,
        color: this.energyBaseColor
          .clone()
          .lerp(this.energyCriticalColor, criticalState + activeBoost * 0.2 + criticalBias * 0.25)
          .lerp(this.terminalColor, terminalState * 0.5 + terminalPulse * 0.35 + terminalBias * 0.2)
          .lerp(this.hitFlashColor, hitFlash * 0.35),
      });
    }

    // 信号灯（警示信标）缓慢脉冲
    const beaconWave =
      Math.sin(this.animationTime * DesertFortressAI.BEACON_PULSE_SPEED) * 0.5 + 0.5;
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

    return THREE.MathUtils.clamp(this.hitFlashTimer / DesertFortressAI.HIT_FLASH_DURATION, 0, 1);
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

  private fireFlakCannon(): void {
    if (!this.playerMesh) return;

    const cannonOffset = this.flakCannonOffsets[this.currentFlakCannon].clone();
    cannonOffset.multiplyScalar(this.config.scale);
    const firePosition = this.mesh.position.clone().add(cannonOffset);

    const target = this.selectFlakTarget();
    if (!target) return;

    const targetPosition = target.position.clone();
    targetPosition.x += (Math.random() - 0.5) * 54;
    targetPosition.y += (Math.random() - 0.35) * 18;
    targetPosition.z += (Math.random() - 0.5) * 54;

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
    this.hitFlashTimer = DesertFortressAI.HIT_FLASH_DURATION;
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

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a3a,
    emissive: 0xff4a00,
    emissiveIntensity: 1.1,
    metalness: 0.4,
    roughness: 0.2,
  });

  const commandMaterial = new THREE.MeshStandardMaterial({
    color: 0xb58a55,
    metalness: 0.74,
    roughness: 0.22,
    emissive: 0x5a3412,
    emissiveIntensity: 0.24,
  });

  const weaponHousingMaterial = new THREE.MeshStandardMaterial({
    color: 0x6d3c22,
    metalness: 0.9,
    roughness: 0.18,
    emissive: 0x3d1609,
    emissiveIntensity: 0.26,
  });

  const armorPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3bd86,
    metalness: 0.7,
    roughness: 0.3,
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

  // 下层履带舱与底盘，增强堡垒厚重感
  const undercarriage = new THREE.Mesh(
    new THREE.BoxGeometry(14.5 * scale, 1.3 * scale, 7 * scale),
    bodyMaterial
  );
  undercarriage.position.set(0, 0.1 * scale, 0);
  undercarriage.name = 'fortress_undercarriage';
  undercarriage.castShadow = true;
  group.add(undercarriage);
  parts.push(undercarriage);

  const bellyKeel = new THREE.Mesh(
    new THREE.BoxGeometry(8.5 * scale, 0.45 * scale, 2.8 * scale),
    armorPlateMaterial
  );
  bellyKeel.position.set(0, -0.55 * scale, 0);
  bellyKeel.name = 'fortress_belly_keel';
  bellyKeel.castShadow = true;
  group.add(bellyKeel);

  const glacisPlate = new THREE.Mesh(
    new THREE.BoxGeometry(10 * scale, 0.35 * scale, 5.5 * scale),
    armorPlateMaterial
  );
  glacisPlate.position.set(0, 2.15 * scale, -1.3 * scale);
  glacisPlate.rotation.z = -0.08;
  glacisPlate.name = 'fortress_glacis_plate';
  glacisPlate.castShadow = true;
  group.add(glacisPlate);

  const frontRam = new THREE.Mesh(
    new THREE.BoxGeometry(6.6 * scale, 0.8 * scale, 1.4 * scale),
    turretMaterial
  );
  frontRam.position.set(0, 1.05 * scale, -4.55 * scale);
  frontRam.name = 'fortress_front_ram';
  frontRam.castShadow = true;
  group.add(frontRam);

  for (let i = 0; i < 3; i++) {
    const topArmor = new THREE.Mesh(
      new THREE.BoxGeometry(3.6 * scale, 0.24 * scale, 2.2 * scale),
      armorPlateMaterial
    );
    topArmor.position.set((-4 + i * 4) * scale, 2.35 * scale, -0.2 * scale);
    topArmor.name = `fortress_top_armor_${i}`;
    topArmor.castShadow = true;
    group.add(topArmor);
  }

  for (let i = 0; i < 4; i++) {
    const sideArmor = new THREE.Mesh(
      new THREE.BoxGeometry(2.9 * scale, 0.5 * scale, 0.22 * scale),
      armorPlateMaterial.clone()
    );
    sideArmor.position.set((-5.8 + i * 3.9) * scale, 1.7 * scale, -3.55 * scale);
    sideArmor.name = `fortress_side_armor_left_${i}`;
    sideArmor.castShadow = true;
    group.add(sideArmor);

    const mirroredArmor = sideArmor.clone();
    mirroredArmor.position.z = 3.55 * scale;
    mirroredArmor.name = `fortress_side_armor_right_${i}`;
    group.add(mirroredArmor);
  }

  const leftTrack = new THREE.Mesh(
    new THREE.BoxGeometry(18 * scale, 1 * scale, 2 * scale),
    trackMaterial
  );
  leftTrack.position.set(-7 * scale, 0.5 * scale, 0);
  leftTrack.name = 'fortress_left_track';
  leftTrack.castShadow = true;
  group.add(leftTrack);
  parts.push(leftTrack);

  const leftSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(16.5 * scale, 0.55 * scale, 0.35 * scale),
    armorPlateMaterial
  );
  leftSkirt.position.set(-7 * scale, 1.12 * scale, -1.15 * scale);
  leftSkirt.name = 'fortress_left_track_skirt';
  leftSkirt.castShadow = true;
  group.add(leftSkirt);

  const leftSidePod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7 * scale, 0.7 * scale, 3.2 * scale, 10),
    bodyMaterial
  );
  leftSidePod.rotation.z = Math.PI / 2;
  leftSidePod.position.set(-7.15 * scale, 1.65 * scale, 2.25 * scale);
  leftSidePod.name = 'fortress_left_side_pod';
  leftSidePod.castShadow = true;
  group.add(leftSidePod);
  parts.push(leftSidePod);

  const rightTrack = new THREE.Mesh(
    new THREE.BoxGeometry(18 * scale, 1 * scale, 2 * scale),
    trackMaterial
  );
  rightTrack.position.set(7 * scale, 0.5 * scale, 0);
  rightTrack.name = 'fortress_right_track';
  rightTrack.castShadow = true;
  group.add(rightTrack);
  parts.push(rightTrack);

  const rightSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(16.5 * scale, 0.55 * scale, 0.35 * scale),
    armorPlateMaterial
  );
  rightSkirt.position.set(7 * scale, 1.12 * scale, -1.15 * scale);
  rightSkirt.name = 'fortress_right_track_skirt';
  rightSkirt.castShadow = true;
  group.add(rightSkirt);

  const rightSidePod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7 * scale, 0.7 * scale, 3.2 * scale, 10),
    bodyMaterial
  );
  rightSidePod.rotation.z = Math.PI / 2;
  rightSidePod.position.set(7.15 * scale, 1.65 * scale, 2.25 * scale);
  rightSidePod.name = 'fortress_right_side_pod';
  rightSidePod.castShadow = true;
  group.add(rightSidePod);
  parts.push(rightSidePod);

  const commandTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2 * scale, 2.5 * scale, 3 * scale, 12),
    commandMaterial
  );
  commandTower.position.set(0, 3.5 * scale, 0);
  commandTower.name = 'fortress_tower';
  commandTower.castShadow = true;
  group.add(commandTower);
  parts.push(commandTower);

  const towerMidRing = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35 * scale, 2.55 * scale, 0.45 * scale, 12),
    armorPlateMaterial
  );
  towerMidRing.position.set(0, 4.1 * scale, 0);
  towerMidRing.name = 'fortress_tower_mid_ring';
  towerMidRing.castShadow = true;
  group.add(towerMidRing);

  const towerTopCap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6 * scale, 1.9 * scale, 0.65 * scale, 12),
    turretMaterial
  );
  towerTopCap.position.set(0, 5.25 * scale, 0);
  towerTopCap.name = 'fortress_tower_top_cap';
  towerTopCap.castShadow = true;
  group.add(towerTopCap);

  for (let i = 0; i < 4; i++) {
    const buttress = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * scale, 1.2 * scale, 1.4 * scale),
      armorPlateMaterial.clone()
    );
    buttress.position.set(i < 2 ? -1.45 * scale : 1.45 * scale, 3.35 * scale, (i % 2 === 0 ? -1.4 : 1.4) * scale);
    buttress.rotation.z = i < 2 ? 0.08 : -0.08;
    buttress.name = `fortress_tower_buttress_${i}`;
    buttress.castShadow = true;
    group.add(buttress);
  }

  const weakpointCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95 * scale, 1.2 * scale, 1.2 * scale, 12),
    glowMaterial
  );
  weakpointCore.position.set(0, 4.6 * scale, 0);
  weakpointCore.name = 'fortress_core_glow';
  group.add(weakpointCore);

  for (let i = 0; i < 2; i++) {
    const towerSponson = new THREE.Mesh(
      new THREE.BoxGeometry(1.6 * scale, 0.9 * scale, 1.7 * scale),
      armorPlateMaterial.clone()
    );
    towerSponson.position.set((i === 0 ? -2.6 : 2.6) * scale, 3.9 * scale, 0);
    towerSponson.name = `fortress_tower_sponson_${i}`;
    towerSponson.castShadow = true;
    group.add(towerSponson);

    const towerSponsonCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.42 * scale, 0.48 * scale, 1.2 * scale),
      commandMaterial.clone()
    );
    towerSponsonCap.position.set((i === 0 ? -3.35 : 3.35) * scale, 4.15 * scale, 0);
    towerSponsonCap.name = `fortress_tower_sponson_cap_${i}`;
    towerSponsonCap.castShadow = true;
    group.add(towerSponsonCap);
  }

  const flakPositions = [
    { name: 'front_left', pos: new THREE.Vector3(-5 * scale, 1.5 * scale, -3 * scale) },
    { name: 'front_right', pos: new THREE.Vector3(5 * scale, 1.5 * scale, -3 * scale) },
    { name: 'back_left', pos: new THREE.Vector3(-5 * scale, 1.5 * scale, 3 * scale) },
    { name: 'back_right', pos: new THREE.Vector3(5 * scale, 1.5 * scale, 3 * scale) },
  ];

  for (const flakPos of flakPositions) {
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(1.6 * scale, 0.35 * scale, 1.45 * scale),
      bodyMaterial
    );
    platform.position.copy(flakPos.pos);
    platform.position.y += 0.15 * scale;
    platform.name = `fortress_flak_platform_${flakPos.name}`;
    platform.castShadow = true;
    group.add(platform);
    parts.push(platform);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 0.5 * scale, 8),
      turretMaterial
    );
    base.position.copy(flakPos.pos);
    base.name = `fortress_flak_base_${flakPos.name}`;
    base.castShadow = true;
    group.add(base);
    parts.push(base);

    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(1.1 * scale, 0.45 * scale, 0.9 * scale),
      armorPlateMaterial
    );
    shield.position.copy(flakPos.pos);
    shield.position.y += 0.35 * scale;
    shield.position.z += flakPos.name.includes('front') ? -0.45 * scale : 0.45 * scale;
    shield.name = `fortress_flak_shield_${flakPos.name}`;
    shield.castShadow = true;
    group.add(shield);

    const sideShieldLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * scale, 0.48 * scale, 0.82 * scale),
      armorPlateMaterial.clone()
    );
    sideShieldLeft.position.copy(flakPos.pos);
    sideShieldLeft.position.set(
      flakPos.pos.x - 0.52 * scale,
      flakPos.pos.y + 0.36 * scale,
      flakPos.pos.z + (flakPos.name.includes('front') ? -0.12 : 0.12) * scale
    );
    sideShieldLeft.name = `fortress_flak_side_shield_left_${flakPos.name}`;
    sideShieldLeft.castShadow = true;
    group.add(sideShieldLeft);

    const sideShieldRight = sideShieldLeft.clone();
    sideShieldRight.position.x = flakPos.pos.x + 0.52 * scale;
    sideShieldRight.name = `fortress_flak_side_shield_right_${flakPos.name}`;
    group.add(sideShieldRight);

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

    const barrelHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.45 * scale, 0.35 * scale, 1.15 * scale),
      weaponHousingMaterial
    );
    barrelHousing.position.copy(flakPos.pos);
    barrelHousing.position.y += 0.86 * scale;
    barrelHousing.position.z += flakPos.name.includes('front') ? -0.55 * scale : 0.55 * scale;
    barrelHousing.name = `fortress_flak_housing_${flakPos.name}`;
    barrelHousing.castShadow = true;
    group.add(barrelHousing);

    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 8, 8),
      glowMaterial
    );
    muzzle.position.copy(barrel.position);
    muzzle.position.y += 0.65 * scale;
    muzzle.position.z += flakPos.name.includes('front') ? -0.55 * scale : 0.55 * scale;
    muzzle.name = `fortress_flak_muzzle_${flakPos.name}`;
    group.add(muzzle);
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

  const leftMissileHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.8 * scale, 0.9 * scale, 1.8 * scale),
    weaponHousingMaterial
  );
  leftMissileHousing.position.set(-3 * scale, 4.15 * scale, 0);
  leftMissileHousing.name = 'fortress_missile_left_housing';
  leftMissileHousing.castShadow = true;
  group.add(leftMissileHousing);

  const leftLauncherFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.3 * scale, 0.24 * scale, 2.3 * scale),
    armorPlateMaterial.clone()
  );
  leftLauncherFrame.position.set(-3 * scale, 5.05 * scale, 0);
  leftLauncherFrame.name = 'fortress_missile_left_frame';
  leftLauncherFrame.castShadow = true;
  group.add(leftLauncherFrame);

  const leftLauncherGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.25 * scale, 10),
    glowMaterial
  );
  leftLauncherGlow.position.set(-3 * scale, 5.6 * scale, 0);
  leftLauncherGlow.name = 'fortress_missile_left_glow';
  group.add(leftLauncherGlow);

  const rightMissileLauncher = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 2 * scale, 12),
    missileMaterial
  );
  rightMissileLauncher.position.set(3 * scale, 4.5 * scale, 0);
  rightMissileLauncher.name = 'fortress_missile_right';
  rightMissileLauncher.castShadow = true;
  group.add(rightMissileLauncher);
  parts.push(rightMissileLauncher);

  const rightMissileHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.8 * scale, 0.9 * scale, 1.8 * scale),
    weaponHousingMaterial
  );
  rightMissileHousing.position.set(3 * scale, 4.15 * scale, 0);
  rightMissileHousing.name = 'fortress_missile_right_housing';
  rightMissileHousing.castShadow = true;
  group.add(rightMissileHousing);

  const rightLauncherFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.3 * scale, 0.24 * scale, 2.3 * scale),
    armorPlateMaterial.clone()
  );
  rightLauncherFrame.position.set(3 * scale, 5.05 * scale, 0);
  rightLauncherFrame.name = 'fortress_missile_right_frame';
  rightLauncherFrame.castShadow = true;
  group.add(rightLauncherFrame);

  // 车体前后模块化结构
  const frontBunker = new THREE.Mesh(
    new THREE.BoxGeometry(7.2 * scale, 1.15 * scale, 1.8 * scale),
    armorPlateMaterial
  );
  frontBunker.position.set(0, 1.65 * scale, -3.3 * scale);
  frontBunker.name = 'fortress_front_bunker';
  frontBunker.castShadow = true;
  group.add(frontBunker);

  const rearBunker = new THREE.Mesh(
    new THREE.BoxGeometry(7.2 * scale, 1.15 * scale, 1.8 * scale),
    armorPlateMaterial
  );
  rearBunker.position.set(0, 1.65 * scale, 3.3 * scale);
  rearBunker.name = 'fortress_rear_bunker';
  rearBunker.castShadow = true;
  group.add(rearBunker);

  for (let i = 0; i < 2; i++) {
    const rearServiceBlock = new THREE.Mesh(
      new THREE.BoxGeometry(2.4 * scale, 1.55 * scale, 1.9 * scale),
      bodyMaterial
    );
    rearServiceBlock.position.set((i === 0 ? -4.9 : 4.9) * scale, 1.85 * scale, 3.1 * scale);
    rearServiceBlock.name = `fortress_rear_service_block_${i}`;
    rearServiceBlock.castShadow = true;
    group.add(rearServiceBlock);
    parts.push(rearServiceBlock);
  }

  for (let i = 0; i < 2; i++) {
    const missileBattery = new THREE.Mesh(
      new THREE.BoxGeometry(2.8 * scale, 0.85 * scale, 1.45 * scale),
      missileMaterial
    );
    missileBattery.position.set((i === 0 ? -5.9 : 5.9) * scale, 2.45 * scale, 0);
    missileBattery.name = `fortress_side_battery_${i}`;
    missileBattery.castShadow = true;
    group.add(missileBattery);
    parts.push(missileBattery);

    const batteryCap = new THREE.Mesh(
      new THREE.BoxGeometry(2.1 * scale, 0.16 * scale, 1.1 * scale),
      weaponHousingMaterial.clone()
    );
    batteryCap.position.set((i === 0 ? -5.9 : 5.9) * scale, 2.97 * scale, 0);
    batteryCap.name = `fortress_side_battery_cap_${i}`;
    batteryCap.castShadow = true;
    group.add(batteryCap);
  }

  for (let i = 0; i < 3; i++) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * scale, 0.18 * scale, 1.1 * scale),
      turretMaterial.clone()
    );
    vent.position.set((-2 + i * 2) * scale, 2.65 * scale, 2.1 * scale);
    vent.name = `fortress_rear_vent_${i}`;
    vent.castShadow = true;
    group.add(vent);
  }

  const rightLauncherGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.25 * scale, 10),
    glowMaterial
  );
  rightLauncherGlow.position.set(3 * scale, 5.6 * scale, 0);
  rightLauncherGlow.name = 'fortress_missile_right_glow';
  group.add(rightLauncherGlow);

  // ===== 细节增强：装甲镶板 / 上层结构 / 武备细节 / 信号灯 =====
  const hullDetailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd4a574).offsetHSL(0, 0.05, -0.08),
    metalness: 0.62,
    roughness: 0.38,
  });
  const armorDetailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xe3bd86).offsetHSL(0, 0.04, -0.12),
    metalness: 0.72,
    roughness: 0.3,
  });
  const weaponDetailMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x6d3c22).offsetHSL(0, 0.05, -0.05),
    metalness: 0.88,
    roughness: 0.2,
  });
  const towerWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd9a0,
    emissive: 0xb87a2e,
    emissiveIntensity: 0.85,
    metalness: 0.55,
    roughness: 0.12,
  });
  const runningLightRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const runningLightGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x2aff5a });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4030,
    transparent: true,
    opacity: 0.85,
  });
  const exhaustGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8a3c,
    transparent: true,
    opacity: 0.8,
  });

  // 复用几何体
  const sidePanelGeometry = new THREE.BoxGeometry(2.1 * scale, 0.7 * scale, 0.14 * scale);
  const deckRibGeometry = new THREE.BoxGeometry(0.3 * scale, 0.14 * scale, 7.4 * scale);
  const trackPlateGeometry = new THREE.BoxGeometry(0.6 * scale, 0.18 * scale, 2.1 * scale);
  const towerWindowGeometry = new THREE.BoxGeometry(0.85 * scale, 0.28 * scale, 0.1 * scale);
  const antennaRodGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.07 * scale, 1.6 * scale, 6);
  const railPostGeometry = new THREE.BoxGeometry(0.06 * scale, 0.4 * scale, 0.06 * scale);
  const barrelCollarGeometry = new THREE.CylinderGeometry(0.2 * scale, 0.22 * scale, 0.5 * scale, 8);
  const ammoDrumGeometry = new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.5 * scale, 8);
  const ammoFeedGeometry = new THREE.BoxGeometry(0.55 * scale, 0.4 * scale, 0.5 * scale);
  const runningLightGeometry = new THREE.SphereGeometry(0.16 * scale, 8, 8);
  const beaconGeometry = new THREE.SphereGeometry(0.18 * scale, 8, 8);
  const exhaustStripGeometry = new THREE.BoxGeometry(0.55 * scale, 0.18 * scale, 0.12 * scale);

  // 车体前后装甲镶板
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 4; i++) {
      const hullPanel = new THREE.Mesh(sidePanelGeometry, hullDetailMaterial);
      hullPanel.position.set(
        (-6 + i * 4) * scale,
        1.1 * scale,
        (side === 0 ? -4.08 : 4.08) * scale
      );
      hullPanel.name = `fortress_hull_panel_${side === 0 ? 'front' : 'back'}_${i}`;
      hullPanel.castShadow = true;
      group.add(hullPanel);
    }
  }

  // 顶甲板肋条
  const deckRibXs = [-6.5, -2.2, 2.2, 6.5];
  deckRibXs.forEach((x, i) => {
    const deckRib = new THREE.Mesh(deckRibGeometry, armorDetailMaterial);
    deckRib.position.set(x * scale, 2.06 * scale, 0);
    deckRib.name = `fortress_deck_rib_${i}`;
    deckRib.castShadow = true;
    group.add(deckRib);
  });

  // 履带踏板细节
  for (let side = 0; side < 2; side++) {
    const trackX = side === 0 ? -7 : 7;
    for (let i = 0; i < 4; i++) {
      const trackPlate = new THREE.Mesh(trackPlateGeometry, weaponDetailMaterial);
      trackPlate.position.set((trackX + (-4.5 + i * 3)) * scale, 1.06 * scale, 0);
      trackPlate.name = `fortress_track_plate_${side === 0 ? 'left' : 'right'}_${i}`;
      trackPlate.castShadow = true;
      group.add(trackPlate);
    }
  }

  // 指挥塔舷窗（发光条）
  for (let i = 0; i < 3; i++) {
    const angle = -0.5 + i * 0.5;
    const towerWindow = new THREE.Mesh(towerWindowGeometry, towerWindowMaterial);
    towerWindow.position.set(
      Math.sin(angle) * 2.25 * scale,
      3.9 * scale,
      -Math.cos(angle) * 2.25 * scale
    );
    towerWindow.rotation.y = -angle;
    towerWindow.name = `fortress_tower_window_${i}`;
    group.add(towerWindow);
  }

  // 天线阵列
  const antennaSpots = [
    { x: -1.0, y: 6.3, z: 0.6 },
    { x: 1.1, y: 6.4, z: -0.4 },
    { x: 0.3, y: 6.2, z: 1.0 },
  ];
  antennaSpots.forEach((spot, i) => {
    const antenna = new THREE.Mesh(antennaRodGeometry, armorDetailMaterial);
    antenna.position.set(spot.x * scale, spot.y * scale, spot.z * scale);
    antenna.name = `fortress_antenna_rod_${i}`;
    antenna.castShadow = true;
    group.add(antenna);
  });

  // 雷达盘（圆柱 + 环形格栅）
  const radarPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 0.5 * scale, 6),
    armorDetailMaterial
  );
  radarPost.position.set(-0.9 * scale, 5.8 * scale, 0);
  radarPost.name = 'fortress_radar_post';
  radarPost.castShadow = true;
  group.add(radarPost);

  const radarDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55 * scale, 0.7 * scale, 0.15 * scale, 12),
    hullDetailMaterial
  );
  radarDish.position.set(-0.9 * scale, 6.2 * scale, 0);
  radarDish.rotation.z = 0.45;
  radarDish.name = 'fortress_radar_dish';
  radarDish.castShadow = true;
  group.add(radarDish);

  const radarLattice = new THREE.Mesh(
    new THREE.TorusGeometry(0.6 * scale, 0.05 * scale, 6, 14),
    armorDetailMaterial
  );
  radarLattice.position.set(-0.9 * scale, 6.2 * scale, 0);
  radarLattice.rotation.set(Math.PI / 2, 0, 0.45);
  radarLattice.name = 'fortress_radar_lattice';
  radarLattice.castShadow = true;
  group.add(radarLattice);

  // 指挥塔环形栏杆
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const railPost = new THREE.Mesh(railPostGeometry, armorDetailMaterial);
    railPost.position.set(Math.cos(angle) * 2.5 * scale, 4.45 * scale, Math.sin(angle) * 2.5 * scale);
    railPost.name = `fortress_rail_post_${i}`;
    railPost.castShadow = true;
    group.add(railPost);
  }

  const railRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.5 * scale, 0.05 * scale, 6, 20),
    armorDetailMaterial
  );
  railRing.rotation.x = Math.PI / 2;
  railRing.position.set(0, 4.65 * scale, 0);
  railRing.name = 'fortress_rail_ring';
  railRing.castShadow = true;
  group.add(railRing);

  // 防空炮武备细节（炮管护套 / 弹药鼓 / 供弹箱）—— 不移动炮位锚点
  for (const flakPos of flakPositions) {
    const isFront = flakPos.name.includes('front');
    const sideSign = flakPos.pos.x < 0 ? -1 : 1;

    const barrelCollar = new THREE.Mesh(barrelCollarGeometry, weaponDetailMaterial);
    barrelCollar.position.copy(flakPos.pos);
    barrelCollar.position.y += 0.55 * scale;
    barrelCollar.rotation.x = -Math.PI / 4;
    barrelCollar.name = `fortress_flak_collar_${flakPos.name}`;
    barrelCollar.castShadow = true;
    group.add(barrelCollar);

    const ammoDrum = new THREE.Mesh(ammoDrumGeometry, weaponDetailMaterial);
    ammoDrum.rotation.z = Math.PI / 2;
    ammoDrum.position.set(
      flakPos.pos.x + sideSign * 0.85 * scale,
      flakPos.pos.y + 0.1 * scale,
      flakPos.pos.z
    );
    ammoDrum.name = `fortress_flak_ammo_drum_${flakPos.name}`;
    ammoDrum.castShadow = true;
    group.add(ammoDrum);

    const ammoFeed = new THREE.Mesh(ammoFeedGeometry, hullDetailMaterial);
    ammoFeed.position.set(
      flakPos.pos.x,
      flakPos.pos.y + 0.3 * scale,
      flakPos.pos.z + (isFront ? 0.85 : -0.85) * scale
    );
    ammoFeed.name = `fortress_flak_ammo_feed_${flakPos.name}`;
    ammoFeed.castShadow = true;
    group.add(ammoFeed);
  }

  // 航行灯（左红右绿）
  const runningLightSpots = [
    { name: 'left_front', x: -7.85, z: -3.85, red: true },
    { name: 'left_back', x: -7.85, z: 3.85, red: true },
    { name: 'right_front', x: 7.85, z: -3.85, red: false },
    { name: 'right_back', x: 7.85, z: 3.85, red: false },
  ];
  for (const spot of runningLightSpots) {
    const runningLight = new THREE.Mesh(
      runningLightGeometry,
      spot.red ? runningLightRedMaterial : runningLightGreenMaterial
    );
    runningLight.position.set(spot.x * scale, 2.1 * scale, spot.z * scale);
    runningLight.name = `fortress_running_light_${spot.name}`;
    group.add(runningLight);
  }

  // 警示信标（慢速脉冲）
  const beaconSpots = [
    { x: -1.3, y: 5.75, z: 0 },
    { x: 1.3, y: 5.75, z: 0 },
    { x: -5.9, y: 3.15, z: 0 },
    { x: 5.9, y: 3.15, z: 0 },
  ];
  beaconSpots.forEach((spot, i) => {
    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.set(spot.x * scale, spot.y * scale, spot.z * scale);
    beacon.name = `fortress_signal_beacon_${i}`;
    group.add(beacon);
  });

  // 尾部排气辉光
  for (let i = 0; i < 3; i++) {
    const exhaustStrip = new THREE.Mesh(exhaustStripGeometry, exhaustGlowMaterial);
    exhaustStrip.position.set((-2 + i * 2) * scale, 2.65 * scale, 2.72 * scale);
    exhaustStrip.name = `fortress_exhaust_light_${i}`;
    group.add(exhaustStrip);
  }

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;
  return group;
}
