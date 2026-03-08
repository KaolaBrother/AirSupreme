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
  }

  private updateVisualEffects(): void {
    const healthState = this.getHealth().current / this.getHealth().max;
    const damagePulse = 1 + (1 - healthState) * 0.55;
    const criticalState = THREE.MathUtils.clamp((0.22 - healthState) / 0.22, 0, 1);
    const terminalState = THREE.MathUtils.clamp((0.16 - healthState) / 0.16, 0, 1);
    const hitFlash = this.getHitFlashStrength();
    const criticalPulse = (Math.sin(this.animationTime * 12.5) * 0.5 + 0.5) * criticalState;
    const terminalPulse = (Math.sin(this.animationTime * 20) * 0.5 + 0.5) * terminalState;
    const corePulse = 0.55 + (Math.sin(this.animationTime * 2.6) * 0.5 + 0.5) * 0.9 * damagePulse;
    this.setGlowState(this.coreGlow, {
      intensity: 0.7 + corePulse + criticalPulse * 1.05 + terminalPulse * 1.2 + hitFlash * 1.35,
      scale: 1 + corePulse * 0.08 + criticalPulse * 0.08 + terminalPulse * 0.08 + hitFlash * 0.08,
      color: this.weakpointBaseColor
        .clone()
        .lerp(this.weakpointCriticalColor, 1 - healthState + criticalPulse * 0.25)
        .lerp(this.terminalColor, terminalState * 0.7 + terminalPulse * 0.3)
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
      const offsetPulse = Math.sin(this.animationTime * 6 + i * 1.4) * 0.5 + 0.5;
      const intensity =
        0.45 +
        flakCharge * 1.35 +
        offsetPulse * 0.35 +
        criticalPulse * 0.7 +
        terminalPulse * 0.9 +
        hitFlash * 0.8;
      this.setGlowState(this.flakMuzzles[i], {
        intensity: intensity,
        scale:
          1 +
          flakCharge * 0.22 +
          offsetPulse * 0.05 +
          criticalPulse * 0.05 +
          terminalPulse * 0.05 +
          hitFlash * 0.05,
        color: this.weaponBaseColor
          .clone()
          .lerp(this.weaponCriticalColor, criticalState + criticalPulse * 0.25)
          .lerp(this.terminalColor, terminalState * 0.55 + terminalPulse * 0.3)
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
      const pulse = Math.sin(this.animationTime * 4.4 + i * 1.8) * 0.5 + 0.5;
      const activeBoost = isActiveLauncher ? 0.35 : 0;
      this.setGlowState(this.missileGlowCaps[i], {
        intensity:
          0.4 +
          missileCharge * 1.1 +
          pulse * 0.25 +
          activeBoost +
          criticalPulse * 0.65 +
          terminalPulse * 0.85 +
          hitFlash * 0.7,
        scale:
          1 +
          missileCharge * 0.16 +
          activeBoost * 0.05 +
          criticalPulse * 0.04 +
          terminalPulse * 0.04 +
          hitFlash * 0.04,
        color: this.energyBaseColor
          .clone()
          .lerp(this.energyCriticalColor, criticalState + activeBoost * 0.2)
          .lerp(this.terminalColor, terminalState * 0.45 + terminalPulse * 0.3)
          .lerp(this.hitFlashColor, hitFlash * 0.35),
      });
    }
  }

  private getHitFlashStrength(): number {
    if (this.hitFlashTimer <= 0) {
      return 0;
    }

    return THREE.MathUtils.clamp(this.hitFlashTimer / 0.18, 0, 1);
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
    this.hitFlashTimer = 0.18;
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

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;
  return group;
}
