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
  private tentaclePivots: THREE.Object3D[] = [];
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

    // 触手关节缓存（用于波动动画）
    this.tentaclePivots = [];
    for (const child of this.mesh.children) {
      if (!child.name.startsWith('octopus_tentacle_')) continue;
      child.traverse((node) => {
        if (node.name.includes('_pivot_')) {
          this.tentaclePivots.push(node);
        }
      });
    }
  }

  private updateVisualEffects(): void {
    const healthRatio = this.getHealth().current / this.getHealth().max;
    const lowHealthBoost = 1 + (1 - healthRatio) * 0.9;
    const criticalState = THREE.MathUtils.clamp(
      (OctopusWarshipAI.CRITICAL_HEALTH_THRESHOLD - healthRatio) /
        OctopusWarshipAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (OctopusWarshipAI.TERMINAL_HEALTH_THRESHOLD - healthRatio) /
        OctopusWarshipAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const hitFlash = this.getHitFlashStrength();
    const teleportCharge =
      this.teleportCooldown > 0
        ? 1 -
          THREE.MathUtils.clamp(
            this.teleportCooldown / Math.max(TELEPORT_CONFIG.COOLDOWN, 0.001),
            0,
            1
          )
        : 1;
    const criticalPulse =
      (Math.sin(this.animationTime * OctopusWarshipAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5) *
      criticalState;
    const terminalPulse =
      (Math.sin(this.animationTime * OctopusWarshipAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5) *
      terminalState;
    const terminalWarning = Math.sqrt(terminalState);
    const criticalBias = criticalState * criticalState;
    const phasePressure = 1 + terminalWarning * 0.75 + criticalState * 0.2;
    const terminalCrescendo = terminalWarning * (this.isTeleporting ? 0.2 : 1);
    const terminalWarningPulse = terminalPulse * terminalWarning;
    const corePulse =
      (Math.sin(
        this.animationTime *
          (this.isTeleporting
            ? OctopusWarshipAI.TERMINAL_PULSE_SPEED
            : OctopusWarshipAI.WEAKPOINT_PULSE_SPEED)
      ) *
        0.5 +
        0.5) *
      lowHealthBoost;
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
        .lerp(
          this.terminalColor,
          terminalState * 0.75 + terminalWarning * 0.45 + terminalPulse * 0.35
        )
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
          .lerp(
            this.energyCriticalColor,
            criticalState * 0.65 + criticalPulse * 0.25 + criticalBias * 0.22
          )
          .lerp(
            this.terminalColor,
            terminalState * 0.48 + terminalWarningPulse * 0.5 + terminalPulse * 0.25
          ),
      });
    }

    for (let i = 0; i < this.apertures.length; i++) {
      const pulse =
        Math.sin(this.animationTime * OctopusWarshipAI.WEAPON_PULSE_SPEED + i * Math.PI) * 0.5 +
        0.5;
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
          .lerp(
            this.terminalColor,
            terminalState * 0.56 + terminalPulse * 0.35 + terminalWarning * 0.25
          )
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
          .lerp(
            this.energyCriticalColor,
            criticalState * 0.5 + criticalPulse * 0.15 + criticalBias * 0.22
          )
          .lerp(
            this.terminalColor,
            terminalState * 0.32 + terminalPulse * 0.2 + terminalWarning * 0.25
          )
          .lerp(this.hitFlashColor, hitFlash * 0.35),
      });
    }

    // 信号灯（警示信标）缓慢脉冲
    const beaconWave =
      Math.sin(this.animationTime * OctopusWarshipAI.BEACON_PULSE_SPEED) * 0.5 + 0.5;
    for (const beacon of this.signalBeacons) {
      this.setBeaconOpacity(beacon, 0.3 + beaconWave * 0.7);
    }

    // 触手分节波动（受击/濒死时摆动加剧）
    const swaySpeed = 1.6 + terminalState * 1.4 + hitFlash * 0.8;
    for (const pivot of this.tentaclePivots) {
      const base =
        typeof pivot.userData.swayBase === 'number' ? pivot.userData.swayBase : pivot.rotation.x;
      const phase = typeof pivot.userData.swayPhase === 'number' ? pivot.userData.swayPhase : 0;
      const amp = typeof pivot.userData.swayAmp === 'number' ? pivot.userData.swayAmp : 0.05;
      pivot.rotation.x =
        base + Math.sin(this.animationTime * swaySpeed + phase) * amp * (1 + terminalState * 0.6);
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

export function createOctopusWarshipMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  // ===== 几何构造辅助（本地单位，最终通过 group.scale 统一缩放）=====
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rTop: number, rBottom: number, h: number, seg = 10) =>
    new THREE.CylinderGeometry(rTop, rBottom, h, seg);
  const ball = (r: number, seg = 12) => new THREE.SphereGeometry(r, seg, seg);
  const ring = (r: number, tube: number, radSeg = 8, tubSeg = 20) =>
    new THREE.TorusGeometry(r, tube, radSeg, tubSeg);

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
    mesh.position.set(x, y, z);
    if (options.rx !== undefined) mesh.rotation.x = options.rx;
    if (options.ry !== undefined) mesh.rotation.y = options.ry;
    if (options.rz !== undefined) mesh.rotation.z = options.rz;
    mesh.name = name;
    mesh.castShadow = options.shadow !== false;
    group.add(mesh);
    if (options.collide) parts.push(mesh);
    return mesh;
  };

  // ===== 材质（冰蓝生物机械装甲基调）=====
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4488aa,
    metalness: 0.7,
    roughness: 0.32,
  });
  const armorMaterial = new THREE.MeshStandardMaterial({
    color: 0x336688,
    metalness: 0.8,
    roughness: 0.24,
  });
  const armorDarkMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x336688).offsetHSL(0, 0.04, -0.08),
    metalness: 0.82,
    roughness: 0.22,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x24485d,
    metalness: 0.85,
    roughness: 0.2,
  });
  const tentacleMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x4488aa).offsetHSL(0, 0.05, -0.06),
    metalness: 0.72,
    roughness: 0.3,
  });
  const rivetMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d3a4c,
    metalness: 0.88,
    roughness: 0.26,
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

  // ===== 球形外壳（运行时眼睛位于赤道半径 15 处，保持眼带净空）=====
  const body = add(ball(15, 32), bodyMaterial, 'octopus_body', 0, 0, 0, { collide: true });
  body.scale.set(1, 1.12, 1);

  // 赤道结构环与上下眉脊（框出眼带）
  add(ring(13.0, 1.0, 12, 32), frameMaterial, 'octopus_equator_ring', 0, 0, 0, {
    rx: Math.PI / 2,
  });
  add(ring(14.3, 0.62, 10, 30), armorDarkMaterial, 'octopus_upper_brow_ring', 0, 3.6, 0, {
    rx: Math.PI / 2,
  });
  add(ring(14.3, 0.62, 10, 30), armorDarkMaterial, 'octopus_lower_brow_ring', 0, -3.6, 0, {
    rx: Math.PI / 2,
  });

  // 眼部装甲座圈（围绕运行时眼睛位置，不移动眼睛锚点）
  const eyeSocketGeometry = ring(3.35, 0.28, 8, 18);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    add(
      eyeSocketGeometry,
      frameMaterial,
      `octopus_eye_socket_${i}`,
      Math.cos(angle) * 14.6,
      0,
      Math.sin(angle) * 14.6,
      { ry: Math.PI / 2 - angle }
    );
  }

  // ===== 铆接装甲板带（上半球，板间为发光能量缝）=====
  const platePanelGeometry = box(6.2, 4.6, 1.0);
  const rivetGeometry = ball(0.2, 6);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radial = { x: Math.cos(angle), z: Math.sin(angle) };
    const tangent = { x: Math.sin(angle), z: -Math.cos(angle) };
    const plate = add(
      platePanelGeometry,
      armorMaterial.clone(),
      `octopus_plate_${i}`,
      radial.x * 12.3,
      5.7,
      radial.z * 12.3,
      { ry: Math.PI / 2 - angle, collide: true }
    );
    plate.rotation.order = 'YXZ';
    plate.rotation.x = -0.42;

    for (const dx of [-2.4, 2.4]) {
      for (const dy of [-1.6, 1.6]) {
        add(
          rivetGeometry,
          rivetMaterial,
          `octopus_plate_rivet_${i}_${dx < 0 ? 'a' : 'b'}${dy < 0 ? 0 : 1}`,
          radial.x * 12.85 + tangent.x * dx,
          5.7 + dy,
          radial.z * 12.85 + tangent.z * dx,
          { shadow: false }
        );
      }
    }
  }

  // 发光能量缝（板间，独立材质便于逐缝脉冲）
  const plateEdgeGeometry = box(0.55, 4.4, 0.55);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    add(
      plateEdgeGeometry,
      glowMaterial.clone(),
      `octopus_plate_edge_${i}`,
      Math.cos(angle) * 12.9,
      5.7,
      Math.sin(angle) * 12.9,
      { ry: Math.PI / 2 - angle, shadow: false }
    );
  }

  // 下半球散热鳃缝
  const ventGeometry = box(1.7, 0.5, 0.3);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    add(
      ventGeometry,
      rivetMaterial,
      `octopus_gill_vent_${i}`,
      Math.cos(angle) * 13.3,
      -5.2,
      Math.sin(angle) * 13.3,
      { ry: Math.PI / 2 - angle, shadow: false }
    );
  }

  // ===== 头冠穹顶与中央传感核心 =====
  const topDome = add(
    new THREE.SphereGeometry(8.6, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    armorMaterial,
    'octopus_top_dome',
    0,
    10.2,
    0,
    { collide: true }
  );
  topDome.castShadow = true;
  add(ring(7.4, 0.4, 8, 26), frameMaterial, 'octopus_top_deck_ring', 0, 11.6, 0, {
    rx: Math.PI / 2,
  });
  add(cyl(4.4, 5.4, 1.6, 14), armorDarkMaterial, 'octopus_crown_collar', 0, 14.2, 0);

  // 顶部能量孔（瞬移充能口）
  add(cyl(2.4, 2.9, 1.5, 16), energyMaterial.clone(), 'octopus_top_aperture', 0, 15.3, 0, {
    shadow: false,
  });

  // 中央传感核心（外露的发光眼球 + 虹膜护圈）
  add(ball(3.0, 18), glowMaterial.clone(), 'octopus_core_glow', 0, 16.9, 0, { shadow: false });
  add(ring(3.5, 0.36, 10, 24), frameMaterial, 'octopus_core_iris_ring', 0, 16.9, 0, {
    rx: Math.PI / 2,
  });

  // 冠部舷窗（发光条）
  const crownWindowGeometry = box(1.6, 0.45, 0.18);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
    add(
      crownWindowGeometry,
      crownWindowMaterial,
      `octopus_crown_window_${i}`,
      Math.cos(angle) * 4.9,
      13.9,
      Math.sin(angle) * 4.9,
      { ry: Math.PI / 2 - angle, shadow: false }
    );
  }

  // 传感天线阵列（杆 + 发光端球）
  const antennaGeometry = cyl(0.32, 0.5, 7.5, 8);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lean = 0.22;
    add(
      antennaGeometry,
      sensorMaterial,
      `octopus_antenna_${i}`,
      Math.cos(angle) * 5.2,
      17.6,
      Math.sin(angle) * 5.2,
      { rx: Math.sin(angle) * lean, rz: -Math.cos(angle) * lean, collide: true }
    );
    add(
      ball(0.85, 10),
      sensorMaterial.clone(),
      `octopus_antenna_tip_${i}`,
      Math.cos(angle) * 6.1,
      21.3,
      Math.sin(angle) * 6.1,
      { shadow: false }
    );
    add(
      ring(0.45, 0.09, 8, 14),
      frameMaterial,
      `octopus_antenna_collar_${i}`,
      Math.cos(angle) * 5.4,
      19.2,
      Math.sin(angle) * 5.4,
      { rx: Math.PI / 2 }
    );
  }

  // 旋转雷达盘（头冠侧）
  add(cyl(0.18, 0.22, 1.2, 6), frameMaterial, 'octopus_radar_post', 1.9, 14.9, 0);
  add(cyl(0.9, 1.1, 0.25, 12), armorDarkMaterial, 'octopus_radar_dish', 1.9, 15.6, 0, {
    rz: 0.5,
  });
  add(ring(0.85, 0.07, 6, 14), frameMaterial, 'octopus_radar_lattice', 1.9, 15.6, 0, {
    rx: Math.PI / 2,
    rz: 0.5,
  });

  // ===== 下腹与武器舱 =====
  const bottomDome = add(
    new THREE.SphereGeometry(8.2, 20, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    armorMaterial,
    'octopus_bottom_dome',
    0,
    -9.8,
    0,
    { collide: true }
  );
  bottomDome.castShadow = true;
  add(ring(6.4, 0.38, 8, 26), frameMaterial, 'octopus_bottom_deck_ring', 0, -11.0, 0, {
    rx: Math.PI / 2,
  });
  add(cyl(4.0, 5.0, 2.0, 14), frameMaterial, 'octopus_belly_housing', 0, -12.4, 0);

  // 底部能量孔
  add(cyl(2.4, 2.8, 1.5, 16), energyMaterial.clone(), 'octopus_bottom_aperture', 0, -11.6, 0, {
    shadow: false,
  });

  // 腹部武器发射口（向下的炮口环阵）
  const weaponPortGeometry = cyl(0.7, 0.85, 1.2, 8);
  const portGlowGeometry = cyl(0.45, 0.45, 0.2, 8);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    add(
      weaponPortGeometry,
      armorDarkMaterial,
      `octopus_weapon_port_${i}`,
      Math.cos(angle) * 4.6,
      -13.0,
      Math.sin(angle) * 4.6
    );
    add(
      portGlowGeometry,
      energyMaterial,
      `octopus_weapon_port_glow_${i}`,
      Math.cos(angle) * 4.6,
      -13.65,
      Math.sin(angle) * 4.6,
      { shadow: false }
    );
  }

  // 腹部推进辉光点阵
  const thrusterDotGeometry = ball(0.4, 8);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    add(
      thrusterDotGeometry,
      thrusterGlowMaterial,
      `octopus_thruster_glow_${i}`,
      Math.cos(angle) * 2.6,
      -13.5,
      Math.sin(angle) * 2.6,
      { shadow: false }
    );
  }

  // ===== 8 条分节铰接触手（关节带波动动画钩子）=====
  const tentacleSegmentLengths = [3.2, 2.8, 2.4, 2.0, 1.7, 1.4];
  const tentacleSegmentRadii = [1.5, 1.22, 0.98, 0.76, 0.56, 0.38];
  const tentacleSegmentGeometries = tentacleSegmentLengths.map(
    (len, j) =>
      new THREE.CylinderGeometry(
        tentacleSegmentRadii[j],
        j < tentacleSegmentLengths.length - 1 ? tentacleSegmentRadii[j + 1] : 0.16,
        len,
        8
      )
  );
  const tentacleBandGeometries = [1, 2, 3].map(
    (j) => new THREE.TorusGeometry(tentacleSegmentRadii[j] * 1.1, 0.14, 6, 10)
  );
  const tentacleTipGeometry = ball(0.42, 8);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const root = new THREE.Group();
    root.name = `octopus_tentacle_${i}`;
    root.position.set(Math.cos(angle) * 8.0, -9.2, Math.sin(angle) * 8.0);
    root.rotation.y = Math.PI / 2 - angle;
    group.add(root);

    let parent: THREE.Object3D = root;
    let lastPivot: THREE.Object3D = root;
    for (let j = 0; j < tentacleSegmentLengths.length; j++) {
      const pivot = new THREE.Group();
      pivot.name = `octopus_tentacle_${i}_pivot_${j}`;
      pivot.position.y = j === 0 ? 0 : -tentacleSegmentLengths[j - 1];
      const baseRot = j === 0 ? -1.25 : 0.28;
      pivot.rotation.x = baseRot;
      pivot.userData.swayBase = baseRot;
      pivot.userData.swayPhase = i * 0.85 + j * 0.6;
      pivot.userData.swayAmp = 0.05 + j * 0.022;
      parent.add(pivot);

      const segment = new THREE.Mesh(tentacleSegmentGeometries[j], tentacleMaterial);
      segment.name = `octopus_tentacle_${i}_seg_${j}`;
      segment.position.y = -tentacleSegmentLengths[j] / 2;
      segment.castShadow = true;
      pivot.add(segment);
      if (j === 0) {
        parts.push(segment);
      }

      if (j >= 1 && j <= 3) {
        const band = new THREE.Mesh(tentacleBandGeometries[j - 1], frameMaterial);
        band.name = `octopus_tentacle_${i}_band_${j}`;
        band.rotation.x = Math.PI / 2;
        pivot.add(band);
      }

      parent = pivot;
      lastPivot = pivot;
    }

    const tip = new THREE.Mesh(tentacleTipGeometry, energyMaterial);
    tip.name = `octopus_tentacle_tip_${i}`;
    tip.position.y = -tentacleSegmentLengths[tentacleSegmentLengths.length - 1] - 0.15;
    lastPivot.add(tip);
  }

  // ===== 航行灯与警示信标 =====
  add(ball(0.45, 8), runningLightRedMaterial, 'octopus_running_light_left', -12.4, 5.8, 0, {
    shadow: false,
  });
  add(ball(0.45, 8), runningLightGreenMaterial, 'octopus_running_light_right', 12.4, 5.8, 0, {
    shadow: false,
  });

  const beaconGeometry = ball(0.5, 8);
  [
    { x: -2.6, y: 14.6, z: 0 },
    { x: 2.6, y: 14.6, z: 0 },
    { x: 0, y: 14.6, z: -2.6 },
    { x: 0, y: 14.6, z: 2.6 },
    { x: 0, y: -13.9, z: 0 },
  ].forEach((spot, i) => {
    add(beaconGeometry, beaconMaterial, `octopus_signal_beacon_${i}`, spot.x, spot.y, spot.z, {
      shadow: false,
    });
  });

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;

  group.scale.setScalar(scale);
  return group;
}
