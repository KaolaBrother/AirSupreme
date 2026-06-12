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
  private static readonly BEACON_PULSE_SPEED = 2.2;
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
  private signalBeacons: THREE.Mesh[] = [];
  private radarArray: THREE.Object3D | null = null;
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
    this.signalBeacons = this.mesh.children.filter((child) =>
      child.name.startsWith('destroyer_signal_beacon_')
    ) as THREE.Mesh[];
    this.radarArray = this.mesh.getObjectByName('destroyer_radar_array') ?? null;
  }

  private updateVisualEffects(): void {
    const healthRatio = this.getHealth().current / this.getHealth().max;
    const alertBoost = 1 + (1 - healthRatio) * 0.65;
    const criticalState = THREE.MathUtils.clamp(
      (MissileDestroyerAI.CRITICAL_HEALTH_THRESHOLD - healthRatio) /
        MissileDestroyerAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (MissileDestroyerAI.TERMINAL_HEALTH_THRESHOLD - healthRatio) /
        MissileDestroyerAI.TERMINAL_HEALTH_THRESHOLD,
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
      (Math.sin(this.animationTime * MissileDestroyerAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5) *
      criticalState;
    const terminalPulse =
      (Math.sin(this.animationTime * MissileDestroyerAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5) *
      terminalState;
    const bridgePulse =
      Math.sin(this.animationTime * MissileDestroyerAI.WEAKPOINT_PULSE_SPEED) * 0.5 + 0.5;
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
        .lerp(this.terminalColor, terminalState * 0.74 + terminalPulse * 0.36 + terminalBias * 0.2)
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
          .lerp(
            this.terminalColor,
            terminalState * 0.52 + terminalPulse * 0.37 + terminalBias * 0.2
          )
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
          .lerp(
            this.terminalColor,
            terminalState * 0.48 + terminalPulse * 0.34 + terminalBias * 0.2
          )
          .lerp(this.hitFlashColor, hitFlash * 0.3),
      });
    }

    const enginePulse =
      Math.sin(this.animationTime * MissileDestroyerAI.ENERGY_PULSE_SPEED) * 0.5 + 0.5;
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
          .lerp(
            this.terminalColor,
            terminalState * 0.38 + terminalPulse * 0.25 + terminalBias * 0.2
          ),
      });
    }

    // 信号灯（警示信标）缓慢脉冲
    const beaconWave =
      Math.sin(this.animationTime * MissileDestroyerAI.BEACON_PULSE_SPEED) * 0.5 + 0.5;
    for (const beacon of this.signalBeacons) {
      this.setBeaconOpacity(beacon, 0.3 + beaconWave * 0.7);
    }

    // 桅顶导航雷达持续旋转
    if (this.radarArray) {
      this.radarArray.rotation.y = this.animationTime * 1.5;
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

    return THREE.MathUtils.clamp(this.hitFlashTimer / MissileDestroyerAI.HIT_FLASH_DURATION, 0, 1);
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
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => m.dispose());
          } else if (node.material instanceof THREE.Material) {
            node.material.dispose();
          }
        }
      });
    }
  }
}

export function createMissileDestroyerMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  // ===== 几何构造辅助（尺寸单位：未缩放的设计单位，舰艏朝 +Z 即航向）=====
  const box = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w * scale, h * scale, d * scale);
  const cyl = (rTop: number, rBottom: number, h: number, seg = 10) =>
    new THREE.CylinderGeometry(rTop * scale, rBottom * scale, h * scale, seg);
  const cone = (r: number, h: number, seg = 10) =>
    new THREE.ConeGeometry(r * scale, h * scale, seg);
  const ball = (r: number, seg = 10) => new THREE.SphereGeometry(r * scale, seg, seg);
  const ring = (r: number, tube: number, radSeg = 8, tubSeg = 20) =>
    new THREE.TorusGeometry(r * scale, tube * scale, radSeg, tubSeg);

  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    x: number,
    y: number,
    z: number,
    options: { rx?: number; ry?: number; rz?: number; collide?: boolean; shadow?: boolean } = {}
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * scale, y * scale, z * scale);
    if (options.rx !== undefined) mesh.rotation.x = options.rx;
    if (options.ry !== undefined) mesh.rotation.y = options.ry;
    if (options.rz !== undefined) mesh.rotation.z = options.rz;
    mesh.name = name;
    mesh.castShadow = options.shadow !== false;
    group.add(mesh);
    if (options.collide) parts.push(mesh);
    return mesh;
  };

  // ===== 材质（白昼海面可读的雾灰海军涂装）=====
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f7892,
    metalness: 0.55,
    roughness: 0.34,
    emissive: 0x254867,
    emissiveIntensity: 0.12,
  });
  const lowerHullMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x5f7892).offsetHSL(0, 0.02, -0.16),
    metalness: 0.6,
    roughness: 0.4,
  });
  const bootTopMaterial = new THREE.MeshStandardMaterial({
    color: 0x6e2b22,
    metalness: 0.4,
    roughness: 0.5,
  });
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x8ea2b7,
    metalness: 0.42,
    roughness: 0.34,
    emissive: 0x274863,
    emissiveIntensity: 0.1,
  });
  const superstructureMaterial = new THREE.MeshStandardMaterial({
    color: 0xa5b7c8,
    metalness: 0.5,
    roughness: 0.28,
    emissive: 0x2e5373,
    emissiveIntensity: 0.12,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6eef4,
    metalness: 0.66,
    roughness: 0.18,
    emissive: 0x41637e,
    emissiveIntensity: 0.12,
  });
  const weaponMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f8399,
    metalness: 0.86,
    roughness: 0.18,
    emissive: 0x324e69,
    emissiveIntensity: 0.16,
  });
  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x434f5b,
    metalness: 0.88,
    roughness: 0.24,
  });
  const spyPanelMaterial = new THREE.MeshStandardMaterial({
    color: 0x7e93a8,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x2a4a66,
    emissiveIntensity: 0.3,
  });
  const ciwsDomeMaterial = new THREE.MeshStandardMaterial({
    color: 0xeef2f5,
    metalness: 0.4,
    roughness: 0.3,
  });
  const bridgeWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.1,
  });
  const sideWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0x7fc4ef,
    emissive: 0x1f7fb8,
    emissiveIntensity: 0.85,
    metalness: 0.6,
    roughness: 0.1,
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x55cfff,
    emissive: 0x11b8ff,
    emissiveIntensity: 1.15,
    metalness: 0.5,
    roughness: 0.15,
  });
  const muzzleGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8f4a,
    emissive: 0xff5a00,
    emissiveIntensity: 1,
    metalness: 0.35,
    roughness: 0.2,
  });
  const exhaustMaterial = new THREE.MeshStandardMaterial({
    color: 0x66d8ff,
    emissive: 0x26c4ff,
    emissiveIntensity: 0.95,
    metalness: 0.48,
    roughness: 0.14,
  });
  const heloMarkMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2f6f9,
    metalness: 0.3,
    roughness: 0.4,
    emissive: 0x4a606e,
    emissiveIntensity: 0.18,
  });
  const numberPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f7fa,
    metalness: 0.35,
    roughness: 0.35,
  });
  const rhibMaterial = new THREE.MeshStandardMaterial({
    color: 0x39424c,
    metalness: 0.5,
    roughness: 0.5,
  });
  const runningLightRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const runningLightGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x2aff5a });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4034,
    transparent: true,
    opacity: 0.85,
  });
  const thrusterGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x66d8ff,
    transparent: true,
    opacity: 0.85,
  });

  // ===== 舰体（阿利·伯克风格：飞剪艏 + 折角舷墙 + 直壁船舯）=====
  add(box(4.8, 1.2, 22), lowerHullMaterial, 'destroyer_lower_hull', 0, 0.55, 0, {
    collide: true,
  });
  add(box(6, 2.0, 26), hullMaterial, 'destroyer_hull', 0, 2.0, 0, { collide: true });
  add(cone(2.6, 5, 4), hullMaterial, 'destroyer_bow', 0, 1.75, 15.4, {
    rx: Math.PI / 2,
    collide: true,
  });
  add(box(5.7, 2.1, 0.55), hullMaterial, 'destroyer_stern_transom', 0, 1.95, -13.2);

  // 水线红色防污带
  for (const side of [-1, 1] as const) {
    add(
      box(0.14, 0.5, 21.5),
      bootTopMaterial,
      `destroyer_boot_top_${side < 0 ? 'port' : 'starboard'}`,
      side * 3.04,
      1.05,
      0,
      { shadow: false }
    );
  }

  // 舰艏球鼻声呐罩与舭龙骨
  const sonarDome = add(ball(0.85, 10), darkMetalMaterial, 'destroyer_sonar_dome', 0, 0.55, 13.2);
  sonarDome.scale.set(0.8, 0.6, 1.4);
  for (const side of [-1, 1] as const) {
    add(
      box(0.5, 0.14, 12),
      darkMetalMaterial,
      `destroyer_bilge_keel_${side < 0 ? 'port' : 'starboard'}`,
      side * 2.6,
      0.35,
      0
    );
  }

  // 主甲板
  add(box(5.6, 0.4, 23.5), deckMaterial, 'destroyer_deck', 0, 3.15, 0.5, { collide: true });
  add(box(3.2, 0.32, 3.4), deckMaterial, 'destroyer_bow_deck', 0, 3.05, 14.0);

  // 船舷镶板与舷窗
  const hullPlateGeometry = box(0.12, 0.6, 2.2);
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 5; i++) {
      add(
        hullPlateGeometry,
        lowerHullMaterial,
        `destroyer_hull_plate_${side < 0 ? 'port' : 'starboard'}_${i}`,
        side * 3.07,
        2.3,
        -9 + i * 4.4,
        { shadow: false }
      );
    }
  }

  // 舷侧舰号牌（白色铭牌 + 暗色编号条）
  const digitGeometry = box(0.03, 0.42, 0.16);
  for (const side of [-1, 1] as const) {
    add(
      box(0.08, 0.75, 1.4),
      numberPlateMaterial,
      `destroyer_hull_number_plate_${side < 0 ? 'port' : 'starboard'}`,
      side * 3.06,
      2.35,
      11.0
    );
    for (let d = 0; d < 3; d++) {
      add(
        digitGeometry,
        darkMetalMaterial,
        `destroyer_hull_number_digit_${side < 0 ? 'port' : 'starboard'}_${d}`,
        side * 3.12,
        2.35,
        10.6 + d * 0.4,
        { shadow: false }
      );
    }
  }

  // ===== 舰艏主炮（单装舰炮 + 防盾）=====
  add(cyl(0.95, 1.1, 0.5, 12), weaponMaterial, 'destroyer_gun_barbette', 0, 3.6, 9.6);
  add(box(1.7, 0.95, 2.3), superstructureMaterial, 'destroyer_main_gun_turret', 0, 4.25, 9.6, {
    collide: true,
  });
  add(box(1.5, 0.7, 0.8), superstructureMaterial, 'destroyer_main_gun_glacis', 0, 4.1, 10.9, {
    rx: 0.4,
  });
  add(cyl(0.12, 0.16, 3.4, 8), darkMetalMaterial, 'destroyer_main_gun_barrel', 0, 4.45, 12.6, {
    rx: Math.PI / 2 - 0.08,
    collide: true,
  });
  add(cyl(0.2, 0.2, 0.4, 8), darkMetalMaterial, 'destroyer_main_gun_brake', 0, 4.58, 14.2, {
    rx: Math.PI / 2 - 0.08,
  });

  // ===== 垂直发射系统（艏 32 单元 / 艉 18 单元格栅）=====
  const vlsCellGeometry = box(0.34, 0.14, 0.34);
  add(box(3.6, 0.18, 2.2), trimMaterial, 'destroyer_vls_field_fore', 0, 3.42, 6.4, {
    collide: true,
  });
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 4; row++) {
      add(
        vlsCellGeometry,
        weaponMaterial,
        `destroyer_vls_cell_fore_${col}_${row}`,
        -1.47 + col * 0.42,
        3.54,
        5.77 + row * 0.42,
        { shadow: false }
      );
    }
  }
  add(box(2.9, 0.18, 1.8), trimMaterial, 'destroyer_vls_field_aft', 0, 3.42, -7.2, {
    collide: true,
  });
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 3; row++) {
      add(
        vlsCellGeometry,
        weaponMaterial,
        `destroyer_vls_cell_aft_${col}_${row}`,
        -1.05 + col * 0.42,
        3.54,
        -7.62 + row * 0.42,
        { shadow: false }
      );
    }
  }

  // 导弹发射单元辉光舱盖（运行时按充能脉冲，独立材质）
  const launcherCapGeometry = cyl(0.46, 0.54, 0.16, 8);
  const launcherCapSpots = [
    { name: 'front_left', x: -1.15, z: 6.4 },
    { name: 'front_right', x: 1.15, z: 6.4 },
    { name: 'back_left', x: -0.85, z: -7.2 },
    { name: 'back_right', x: 0.85, z: -7.2 },
  ];
  for (const spot of launcherCapSpots) {
    add(
      launcherCapGeometry,
      glowMaterial.clone(),
      `destroyer_launcher_cap_${spot.name}`,
      spot.x,
      3.56,
      spot.z,
      { shadow: false }
    );
  }

  // ===== 上层建筑（层叠舰桥 + 相控阵雷达面板）=====
  add(box(4.6, 2.4, 5.6), superstructureMaterial, 'destroyer_deckhouse', 0, 4.55, 1.8, {
    collide: true,
  });
  add(box(3.6, 1.6, 2.6), superstructureMaterial, 'destroyer_bridge', 0, 6.55, 2.6, {
    collide: true,
  });
  add(box(2.6, 0.5, 0.14), bridgeWindowMaterial, 'destroyer_bridge_window', 0, 6.9, 3.95, {
    collide: true,
    shadow: false,
  });
  for (const side of [-1, 1] as const) {
    add(
      box(0.75, 0.7, 1.3),
      superstructureMaterial,
      `destroyer_bridge_wing_${side < 0 ? 'port' : 'starboard'}`,
      side * 2.15,
      6.6,
      2.6
    );
    add(
      box(1.7, 0.32, 0.1),
      sideWindowMaterial,
      `destroyer_bridge_side_window_${side < 0 ? 0 : 1}`,
      side * 1.86,
      6.9,
      2.2,
      { shadow: false }
    );
  }
  add(box(3.0, 0.35, 2.2), trimMaterial, 'destroyer_bridge_crown', 0, 7.5, 2.6);

  // SPY 相控阵面板（前向两面 / 后向两面）
  const spyPanelGeometry = box(1.5, 1.5, 0.16);
  const spyFrameGeometry = box(1.7, 1.7, 0.08);
  for (const side of [-1, 1] as const) {
    add(
      spyFrameGeometry,
      trimMaterial,
      `destroyer_spy_frame_fore_${side < 0 ? 'port' : 'starboard'}`,
      side * 1.45,
      5.1,
      4.5,
      { ry: side * -0.45 }
    );
    add(
      spyPanelGeometry,
      spyPanelMaterial,
      `destroyer_spy_panel_fore_${side < 0 ? 'port' : 'starboard'}`,
      side * 1.47,
      5.1,
      4.55,
      { ry: side * -0.45 }
    );
    add(
      spyFrameGeometry,
      trimMaterial,
      `destroyer_spy_frame_aft_${side < 0 ? 'port' : 'starboard'}`,
      side * 1.45,
      5.1,
      -0.85,
      { ry: Math.PI + side * 0.45 }
    );
    add(
      spyPanelGeometry,
      spyPanelMaterial,
      `destroyer_spy_panel_aft_${side < 0 ? 'port' : 'starboard'}`,
      side * 1.47,
      5.1,
      -0.9,
      { ry: Math.PI + side * 0.45 }
    );
  }

  // ===== 后倾主桅（旋转导航雷达 + 横桁 + 鞭状天线）=====
  add(cyl(0.14, 0.28, 4.6, 8), superstructureMaterial, 'destroyer_mast', 0, 8.1, 1.1, {
    rx: -0.1,
    collide: true,
  });
  add(box(2.6, 0.07, 0.07), darkMetalMaterial, 'destroyer_yardarm', 0, 9.3, 0.95);
  add(box(0.07, 0.07, 1.7), darkMetalMaterial, 'destroyer_yardarm_cross', 0, 8.7, 1.05);
  add(ball(0.34, 8), ciwsDomeMaterial, 'destroyer_ew_dome', 0, 9.8, 0.9);

  const radarArray = new THREE.Group();
  radarArray.name = 'destroyer_radar_array';
  radarArray.position.set(0, 10.45 * scale, 0.85 * scale);
  group.add(radarArray);
  const navRadar = new THREE.Mesh(box(0.18, 0.2, 2.2), darkMetalMaterial);
  navRadar.name = 'destroyer_radar';
  navRadar.castShadow = true;
  radarArray.add(navRadar);
  parts.push(navRadar);
  const navRadarHub = new THREE.Mesh(cyl(0.1, 0.14, 0.35, 8), darkMetalMaterial);
  navRadarHub.name = 'destroyer_radar_hub';
  navRadarHub.position.y = -0.25 * scale;
  radarArray.add(navRadarHub);

  const whipAntennaGeometry = cyl(0.025, 0.045, 2.4, 6);
  [
    { x: -2.0, z: 0.0 },
    { x: 2.0, z: 0.0 },
    { x: -1.7, z: 3.6 },
    { x: 1.7, z: 3.6 },
  ].forEach((spot, i) => {
    add(
      whipAntennaGeometry,
      darkMetalMaterial,
      `destroyer_whip_antenna_${i}`,
      spot.x,
      6.9,
      spot.z,
      { shadow: false }
    );
  });

  // ===== 烟囱（双角型烟囱 + 排气辉光）=====
  add(box(1.5, 1.5, 1.9), superstructureMaterial, 'destroyer_funnel_0', 0, 6.45, -0.1, {
    collide: true,
  });
  add(box(1.3, 1.3, 1.6), superstructureMaterial, 'destroyer_funnel_1', 0, 5.0, -2.4, {
    collide: true,
  });
  add(cyl(0.5, 0.6, 0.3, 10), exhaustMaterial.clone(), 'destroyer_exhaust_glow_0', 0, 7.3, -0.1, {
    shadow: false,
  });
  add(
    cyl(0.42, 0.52, 0.28, 10),
    exhaustMaterial.clone(),
    'destroyer_exhaust_glow_1',
    0,
    5.75,
    -2.4,
    { shadow: false }
  );

  // ===== 机库与直升机甲板 =====
  add(box(4.4, 2.0, 4.6), superstructureMaterial, 'destroyer_hangar', 0, 4.15, -4.5, {
    collide: true,
  });
  add(box(1.9, 1.5, 0.14), deckMaterial, 'destroyer_hangar_door', 0, 4.0, -6.85, { shadow: false });
  for (let i = 0; i < 3; i++) {
    add(
      box(0.12, 1.3, 0.1),
      trimMaterial,
      `destroyer_hangar_door_rib_${i}`,
      -0.55 + i * 0.55,
      4.0,
      -6.92,
      { shadow: false }
    );
  }

  add(box(5.2, 0.16, 4.4), heloMarkMaterial.clone(), 'destroyer_helo_deck', 0, 3.4, -10.6);
  add(ring(1.6, 0.07, 6, 24), heloMarkMaterial, 'destroyer_helo_circle', 0, 3.52, -10.6, {
    rx: Math.PI / 2,
    shadow: false,
  });
  add(cyl(0.26, 0.26, 0.05, 10), heloMarkMaterial, 'destroyer_helo_center_mark', 0, 3.52, -10.6, {
    shadow: false,
  });

  // ===== 近防武器（CIWS ×2 + 四角速射炮位锚点）=====
  const ciwsBaseGeometry = cyl(0.4, 0.5, 0.7, 10);
  const ciwsGunGeometry = box(0.26, 0.3, 0.95);
  add(ciwsBaseGeometry, ciwsDomeMaterial, 'destroyer_ciws_base_fore', 0, 6.1, 5.0);
  add(ball(0.45, 10), ciwsDomeMaterial, 'destroyer_ciws_dome_fore', 0, 6.7, 5.0);
  add(ciwsGunGeometry, darkMetalMaterial, 'destroyer_ciws_gun_fore', 0, 6.25, 5.55, { rx: 0.3 });
  add(ciwsBaseGeometry, ciwsDomeMaterial, 'destroyer_ciws_base_aft', 0, 5.55, -4.5);
  add(ball(0.45, 10), ciwsDomeMaterial, 'destroyer_ciws_dome_aft', 0, 6.15, -4.5);
  add(ciwsGunGeometry, darkMetalMaterial, 'destroyer_ciws_gun_aft', 0, 5.7, -5.05, { rx: -0.3 });

  const flakPositions = [
    { name: 'front_left', x: -2.0, y: 3.5, z: 8.4, forward: 1 },
    { name: 'front_right', x: 2.0, y: 3.5, z: 8.4, forward: 1 },
    { name: 'back_left', x: -1.55, y: 5.35, z: -3.2, forward: -1 },
    { name: 'back_right', x: 1.55, y: 5.35, z: -3.2, forward: -1 },
  ];
  const flakBaseGeometry = cyl(0.42, 0.52, 0.5, 8);
  const flakHousingGeometry = box(0.75, 0.45, 0.95);
  const flakBarrelGeometry = cyl(0.07, 0.09, 1.8, 8);
  const flakMuzzleGeometry = ball(0.18, 8);
  for (const flak of flakPositions) {
    add(
      flakBaseGeometry,
      weaponMaterial,
      `destroyer_flak_base_${flak.name}`,
      flak.x,
      flak.y,
      flak.z,
      { collide: true }
    );
    add(
      flakHousingGeometry,
      weaponMaterial,
      `destroyer_flak_housing_${flak.name}`,
      flak.x,
      flak.y + 0.42,
      flak.z
    );
    for (const barrelSide of [-1, 1] as const) {
      add(
        flakBarrelGeometry,
        darkMetalMaterial,
        `destroyer_flak_barrel_${flak.name}_${barrelSide < 0 ? 0 : 1}`,
        flak.x + barrelSide * 0.16,
        flak.y + 1.05,
        flak.z + flak.forward * 0.5,
        { rx: flak.forward * 0.55, collide: barrelSide < 0 }
      );
    }
    add(
      flakMuzzleGeometry,
      muzzleGlowMaterial.clone(),
      `destroyer_flak_muzzle_${flak.name}`,
      flak.x,
      flak.y + 1.7,
      flak.z + flak.forward * 1.0,
      { shadow: false }
    );
  }

  // ===== 舰载小艇与栏杆 =====
  const rhibGeometry = new THREE.CapsuleGeometry(0.32 * scale, 1.3 * scale, 4, 8);
  for (const side of [-1, 1] as const) {
    add(
      box(0.55, 0.12, 2.0),
      darkMetalMaterial,
      `destroyer_davit_shelf_${side < 0 ? 'port' : 'starboard'}`,
      side * 3.0,
      3.55,
      -1.4
    );
    add(
      rhibGeometry,
      rhibMaterial,
      `destroyer_rhib_${side < 0 ? 'port' : 'starboard'}`,
      side * 3.0,
      3.85,
      -1.4,
      { rx: Math.PI / 2 }
    );
  }

  const railPostGeometry = box(0.05, 0.36, 0.05);
  const foreRailBarGeometry = box(0.04, 0.04, 8.6);
  const aftRailBarGeometry = box(0.04, 0.04, 4.4);
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 6; i++) {
      add(
        railPostGeometry,
        trimMaterial,
        `destroyer_rail_post_fore_${side < 0 ? 'port' : 'starboard'}_${i}`,
        side * 2.62,
        3.55,
        4.4 + i * 1.7,
        { shadow: false }
      );
    }
    add(
      foreRailBarGeometry,
      trimMaterial,
      `destroyer_rail_bar_fore_${side < 0 ? 'port' : 'starboard'}`,
      side * 2.62,
      3.75,
      8.6,
      { shadow: false }
    );
    for (let i = 0; i < 3; i++) {
      add(
        railPostGeometry,
        trimMaterial,
        `destroyer_rail_post_aft_${side < 0 ? 'port' : 'starboard'}_${i}`,
        side * 2.5,
        3.55,
        -8.8 - i * 1.8,
        { shadow: false }
      );
    }
    add(
      aftRailBarGeometry,
      trimMaterial,
      `destroyer_rail_bar_aft_${side < 0 ? 'port' : 'starboard'}`,
      side * 2.5,
      3.75,
      -10.6,
      { shadow: false }
    );
  }

  // ===== 艉部推进辉光与舵 =====
  for (let i = 0; i < 3; i++) {
    add(
      cyl(0.4, 0.4, 0.15, 10),
      thrusterGlowMaterial,
      `destroyer_thruster_glow_${i}`,
      -1.1 + i * 1.1,
      0.9,
      -13.5,
      { rx: Math.PI / 2, shadow: false }
    );
  }
  for (const side of [-1, 1] as const) {
    add(
      box(0.12, 0.9, 0.7),
      darkMetalMaterial,
      `destroyer_rudder_${side < 0 ? 'port' : 'starboard'}`,
      side * 1.0,
      0.1,
      -12.4
    );
  }

  // ===== 航行灯（左红右绿）与警示信标 =====
  const runningLightGeometry = ball(0.16, 8);
  const runningLightSpots = [
    { name: 'bow_port', x: -2.9, z: 12.6, red: true },
    { name: 'bow_starboard', x: 2.9, z: 12.6, red: false },
    { name: 'stern_port', x: -2.7, z: -12.9, red: true },
    { name: 'stern_starboard', x: 2.7, z: -12.9, red: false },
  ];
  for (const spot of runningLightSpots) {
    add(
      runningLightGeometry,
      spot.red ? runningLightRedMaterial : runningLightGreenMaterial,
      `destroyer_running_light_${spot.name}`,
      spot.x,
      3.6,
      spot.z,
      { shadow: false }
    );
  }

  const beaconGeometry = ball(0.18, 8);
  [
    { x: 0, y: 10.95, z: 0.85 },
    { x: 0, y: 4.35, z: 14.1 },
    { x: 0, y: 4.05, z: -12.95 },
  ].forEach((spot, i) => {
    add(beaconGeometry, beaconMaterial, `destroyer_signal_beacon_${i}`, spot.x, spot.y, spot.z, {
      shadow: false,
    });
  });

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;
  return group;
}
