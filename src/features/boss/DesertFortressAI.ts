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
  private radarArray: THREE.Object3D | null = null;
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
    this.missileGlowCaps = this.mesh.children.filter(
      (child) => child.name.endsWith('_glow') && child.name.startsWith('fortress_missile_')
    ) as THREE.Mesh[];
    this.signalBeacons = this.mesh.children.filter((child) =>
      child.name.startsWith('fortress_signal_beacon_')
    ) as THREE.Mesh[];
    this.radarArray = this.mesh.getObjectByName('fortress_radar_array') ?? null;
  }

  private updateVisualEffects(): void {
    const healthState = this.getHealth().current / this.getHealth().max;
    const damagePulse = 1 + (1 - healthState) * 0.55;
    const criticalState = THREE.MathUtils.clamp(
      (DesertFortressAI.CRITICAL_HEALTH_THRESHOLD - healthState) /
        DesertFortressAI.CRITICAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const terminalState = THREE.MathUtils.clamp(
      (DesertFortressAI.TERMINAL_HEALTH_THRESHOLD - healthState) /
        DesertFortressAI.TERMINAL_HEALTH_THRESHOLD,
      0,
      1
    );
    const hitFlash = this.getHitFlashStrength();
    const criticalPulse =
      (Math.sin(this.animationTime * DesertFortressAI.CRITICAL_PULSE_SPEED) * 0.5 + 0.5) *
      criticalState;
    const terminalPulse =
      (Math.sin(this.animationTime * DesertFortressAI.TERMINAL_PULSE_SPEED) * 0.5 + 0.5) *
      terminalState;
    const terminalBias = terminalState * terminalState;
    const terminalWarning = Math.sqrt(terminalState);
    const criticalBias = criticalState * criticalState;
    const phaseSeparation = 1 + terminalWarning * 0.8 + criticalState * 0.3;
    const damagePhase = hitFlash * 0.75 + terminalWarning * 0.35;
    const corePulse =
      0.55 +
      (Math.sin(this.animationTime * DesertFortressAI.WEAKPOINT_PULSE_SPEED) * 0.5 + 0.5) *
        0.9 *
        damagePulse;
    this.setGlowState(this.coreGlow, {
      intensity:
        0.7 + corePulse * 1.02 + criticalPulse * 1.15 + terminalPulse * 1.45 + damagePhase * 1.2,
      scale:
        1 +
        corePulse * 0.09 * phaseSeparation +
        criticalPulse * 0.08 +
        terminalPulse * 0.1 +
        hitFlash * 0.08 +
        terminalBias * 0.08,
      color: this.weakpointBaseColor
        .clone()
        .lerp(
          this.weakpointCriticalColor,
          1 - healthState + criticalPulse * 0.25 + criticalBias * 0.25
        )
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
          .lerp(
            this.terminalColor,
            terminalState * 0.62 + terminalPulse * 0.32 + terminalBias * 0.22
          )
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

    // 雷达阵列持续旋转
    if (this.radarArray) {
      this.radarArray.rotation.y = this.animationTime * 0.85;
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

export function createDesertFortressMesh(config: BossConfig): THREE.Group {
  const group = new THREE.Group();
  const scale = config.scale;
  const parts: THREE.Mesh[] = [];

  // ===== 几何构造辅助（尺寸单位：未缩放的设计单位，正面朝 -Z）=====
  const box = (w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w * scale, h * scale, d * scale);
  const cyl = (rTop: number, rBottom: number, h: number, seg = 10) =>
    new THREE.CylinderGeometry(rTop * scale, rBottom * scale, h * scale, seg);
  const ball = (r: number, seg = 10) => new THREE.SphereGeometry(r * scale, seg, seg);
  const ring = (r: number, tube: number, radSeg = 8, tubSeg = 18) =>
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

  // ===== 材质（砂岩 + 钢铁 + 暗红武备的沙漠堡垒涂装）=====
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    metalness: 0.5,
    roughness: 0.52,
  });
  const sandLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3bd86,
    metalness: 0.56,
    roughness: 0.46,
  });
  const sandDarkMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd4a574).offsetHSL(0, 0.02, -0.12),
    metalness: 0.52,
    roughness: 0.56,
  });
  const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.78,
    roughness: 0.38,
  });
  const steelMaterial = new THREE.MeshStandardMaterial({
    color: 0x55504a,
    metalness: 0.84,
    roughness: 0.3,
  });
  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x440000,
    metalness: 0.9,
    roughness: 0.24,
    emissive: 0x220000,
    emissiveIntensity: 0.3,
  });
  const missileMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b0000,
    metalness: 0.9,
    roughness: 0.22,
    emissive: 0x440000,
    emissiveIntensity: 0.3,
  });
  const commandMaterial = new THREE.MeshStandardMaterial({
    color: 0xb58a55,
    metalness: 0.7,
    roughness: 0.3,
    emissive: 0x5a3412,
    emissiveIntensity: 0.2,
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a3a,
    emissive: 0xff4a00,
    emissiveIntensity: 1.1,
    metalness: 0.4,
    roughness: 0.2,
  });
  const towerWindowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd9a0,
    emissive: 0xb87a2e,
    emissiveIntensity: 0.85,
    metalness: 0.55,
    roughness: 0.12,
  });
  const bannerMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a1f1f,
    metalness: 0.2,
    roughness: 0.7,
    emissive: 0x2e0808,
    emissiveIntensity: 0.35,
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

  // ===== 履带行走机构（左右两组：负重轮 + 主动轮 + 护板裙甲）=====
  const trackBodyGeometry = box(2.6, 1.6, 13);
  const roadWheelGeometry = cyl(0.55, 0.55, 2.7, 12);
  const sprocketGeometry = cyl(0.66, 0.66, 2.75, 10);
  const skirtPlateGeometry = box(0.16, 0.95, 2.7);
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'left' : 'right';
    add(trackBodyGeometry, trackMaterial, `fortress_${name}_track`, side * 7, 0.85, 0, {
      collide: true,
    });
    for (let i = 0; i < 5; i++) {
      add(
        roadWheelGeometry,
        steelMaterial,
        `fortress_road_wheel_${name}_${i}`,
        side * 7,
        0.55,
        -4.8 + i * 2.4,
        {
          rz: Math.PI / 2,
        }
      );
    }
    add(sprocketGeometry, steelMaterial, `fortress_drive_sprocket_${name}`, side * 7, 0.95, 6.3, {
      rz: Math.PI / 2,
    });
    add(sprocketGeometry, steelMaterial, `fortress_idler_wheel_${name}`, side * 7, 0.95, -6.3, {
      rz: Math.PI / 2,
    });
    add(box(2.9, 0.26, 13.8), sandDarkMaterial, `fortress_track_guard_${name}`, side * 7, 1.78, 0);
    add(
      box(0.28, 1.2, 12.8),
      sandLightMaterial,
      `fortress_track_skirt_${name}`,
      side * 8.35,
      1.05,
      0,
      {
        collide: true,
      }
    );
    for (let i = 0; i < 4; i++) {
      add(
        skirtPlateGeometry,
        sandDarkMaterial,
        `fortress_skirt_plate_${name}_${i}`,
        side * 8.52,
        1.05,
        -4.5 + i * 3.0
      );
    }
  }

  // ===== 主车体（基座层）=====
  add(box(11.4, 2.3, 9.6), sandMaterial, 'fortress_body', 0, 1.55, 0, { collide: true });
  add(box(10.2, 1.0, 8.0), sandDarkMaterial, 'fortress_undercarriage', 0, 0.5, 0, {
    collide: true,
  });

  // 前部倾斜装甲与推土铲
  add(box(9.0, 0.42, 3.4), sandLightMaterial, 'fortress_glacis_plate', 0, 2.35, -4.9, {
    rx: -0.5,
  });
  add(box(7.4, 1.3, 0.65), steelMaterial, 'fortress_front_ram', 0, 0.92, -5.45, { rx: -0.32 });
  const ramToothGeometry = box(0.5, 0.55, 0.34);
  for (let i = 0; i < 5; i++) {
    add(ramToothGeometry, trackMaterial, `fortress_ram_tooth_${i}`, -2.4 + i * 1.2, 0.36, -5.85);
  }

  // 顶部甲板镶板与肋条
  const deckPlateGeometry = box(3.3, 0.24, 2.4);
  [-3.6, 0, 3.6].forEach((x, i) => {
    add(
      deckPlateGeometry,
      i % 2 === 0 ? sandLightMaterial : sandDarkMaterial,
      `fortress_top_armor_${i}`,
      x,
      2.8,
      1.3
    );
  });
  const deckRibGeometry = box(0.3, 0.16, 8.8);
  [-5.2, -1.8, 1.8, 5.2].forEach((x, i) => {
    add(deckRibGeometry, sandDarkMaterial, `fortress_deck_rib_${i}`, x, 2.78, 0);
  });

  // 车体侧面装甲镶板
  const hullPanelGeometry = box(2.2, 0.85, 0.16);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 4; i++) {
      add(
        hullPanelGeometry,
        sandLightMaterial,
        `fortress_hull_panel_${side === 0 ? 'front' : 'back'}_${i}`,
        -4.2 + i * 2.8,
        1.5,
        (side === 0 ? -1 : 1) * 4.88
      );
    }
  }

  // 尾部动力舱（散热格栅 + 排气管）
  add(box(8.6, 0.55, 2.7), sandDarkMaterial, 'fortress_engine_deck', 0, 2.95, 3.55);
  const ventGeometry = box(0.95, 0.16, 1.2);
  for (let i = 0; i < 3; i++) {
    add(ventGeometry, trackMaterial, `fortress_rear_vent_${i}`, -2.1 + i * 2.1, 3.26, 3.55);
  }
  const exhaustPipeGeometry = cyl(0.3, 0.36, 1.7, 8);
  const exhaustStripGeometry = box(0.5, 0.18, 0.14);
  for (const side of [-1, 1] as const) {
    add(
      exhaustPipeGeometry,
      steelMaterial,
      `fortress_exhaust_pipe_${side < 0 ? 'left' : 'right'}`,
      side * 3.5,
      3.6,
      4.5,
      { rx: 0.55 }
    );
    add(
      exhaustStripGeometry,
      exhaustGlowMaterial,
      `fortress_exhaust_light_${side < 0 ? 0 : 1}`,
      side * 3.5,
      4.25,
      4.95,
      { shadow: false }
    );
  }

  // ===== 中层城塞（带四角棱堡）=====
  add(box(8.6, 1.7, 6.2), sandMaterial, 'fortress_citadel', 0, 3.6, 0.2, { collide: true });
  const bastionGeometry = cyl(1.0, 1.15, 1.95, 10);
  const bastionCapGeometry = ball(0.55, 10);
  const bastionSpots = [
    { x: -3.9, z: -2.5 },
    { x: 3.9, z: -2.5 },
    { x: -3.9, z: 2.9 },
    { x: 3.9, z: 2.9 },
  ];
  bastionSpots.forEach((spot, i) => {
    add(bastionGeometry, sandLightMaterial, `fortress_bastion_${i}`, spot.x, 3.75, spot.z, {
      collide: true,
    });
    const cap = add(
      bastionCapGeometry,
      commandMaterial,
      `fortress_bastion_cap_${i}`,
      spot.x,
      4.85,
      spot.z
    );
    cap.scale.y = 0.6;
  });

  // 城塞侧面叠层装甲
  for (const side of [-1, 1] as const) {
    add(
      box(0.2, 1.2, 4.6),
      sandDarkMaterial,
      `fortress_citadel_armor_${side < 0 ? 'left' : 'right'}`,
      side * 4.5,
      3.6,
      0.2
    );
  }

  // ===== 主炮塔群（正面双联重炮）=====
  add(cyl(2.0, 2.3, 0.5, 12), sandDarkMaterial, 'fortress_main_turret_ring', 0, 4.6, -1.9);
  add(cyl(1.75, 2.0, 1.15, 12), turretMaterial, 'fortress_main_turret', 0, 5.35, -1.9, {
    collide: true,
  });
  add(box(2.3, 0.95, 1.0), steelMaterial, 'fortress_main_mantlet', 0, 5.3, -3.3);
  const mainBarrelGeometry = cyl(0.2, 0.26, 4.8, 10);
  const muzzleBrakeGeometry = cyl(0.32, 0.32, 0.55, 8);
  for (const side of [-1, 1] as const) {
    add(
      mainBarrelGeometry,
      steelMaterial,
      `fortress_main_barrel_${side < 0 ? 'left' : 'right'}`,
      side * 0.55,
      5.42,
      -5.6,
      { rx: Math.PI / 2 + 0.06, collide: true }
    );
    add(
      muzzleBrakeGeometry,
      trackMaterial,
      `fortress_main_muzzle_brake_${side < 0 ? 'left' : 'right'}`,
      side * 0.55,
      5.58,
      -7.85,
      { rx: Math.PI / 2 + 0.06 }
    );
  }

  // 城塞两侧火箭巢
  const rocketPodGeometry = box(1.5, 0.9, 2.2);
  for (const side of [-1, 1] as const) {
    add(
      rocketPodGeometry,
      missileMaterial,
      `fortress_side_battery_${side < 0 ? 0 : 1}`,
      side * 4.85,
      4.65,
      1.7,
      { rz: side * 0.12, collide: true }
    );
    add(
      box(1.2, 0.16, 1.9),
      steelMaterial,
      `fortress_side_battery_cap_${side < 0 ? 0 : 1}`,
      side * 4.95,
      5.18,
      1.7,
      { rz: side * 0.12 }
    );
  }

  // ===== 指挥塔（核心反应堆 + 旋转雷达 + 通讯桅杆）=====
  add(cyl(2.05, 2.35, 0.5, 12), sandDarkMaterial, 'fortress_tower_base', 0, 4.7, 0.7);
  add(cyl(1.6, 2.0, 2.5, 12), commandMaterial, 'fortress_tower', 0, 6.15, 0.7, {
    collide: true,
  });
  add(cyl(1.95, 2.05, 0.4, 12), sandLightMaterial, 'fortress_tower_mid_ring', 0, 6.0, 0.7);
  add(cyl(1.15, 1.5, 0.6, 12), turretMaterial, 'fortress_tower_top_cap', 0, 7.65, 0.7);

  // 指挥塔舷窗（面向战场正面的发光条）
  const towerWindowGeometry = box(0.8, 0.3, 0.1);
  for (let i = 0; i < 3; i++) {
    const angle = -0.55 + i * 0.55;
    add(
      towerWindowGeometry,
      towerWindowMaterial,
      `fortress_tower_window_${i}`,
      Math.sin(angle) * 1.95,
      6.6,
      0.7 - Math.cos(angle) * 1.95,
      { ry: -angle, shadow: false }
    );
  }

  // 核心反应堆（弱点辉光，位于塔顶上方可见处）
  add(cyl(0.85, 1.05, 0.95, 12), glowMaterial, 'fortress_core_glow', 0, 8.3, 0.7, {
    shadow: false,
  });
  add(ring(1.1, 0.1, 8, 20), steelMaterial, 'fortress_core_cage_ring', 0, 8.3, 0.7, {
    rx: Math.PI / 2,
  });

  // 指挥塔环形栏杆
  const railPostGeometry = box(0.07, 0.42, 0.07);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    add(
      railPostGeometry,
      steelMaterial,
      `fortress_rail_post_${i}`,
      Math.cos(angle) * 2.25,
      7.05,
      0.7 + Math.sin(angle) * 2.25
    );
  }
  add(ring(2.25, 0.05, 6, 22), steelMaterial, 'fortress_rail_ring', 0, 7.25, 0.7, {
    rx: Math.PI / 2,
  });

  // 旋转雷达阵列（运行时绕 Y 轴旋转）
  const radarArray = new THREE.Group();
  radarArray.name = 'fortress_radar_array';
  radarArray.position.set(-0.85 * scale, 8.05 * scale, 0.7 * scale);
  group.add(radarArray);
  const radarPost = new THREE.Mesh(cyl(0.09, 0.12, 0.7, 6), steelMaterial);
  radarPost.name = 'fortress_radar_post';
  radarPost.castShadow = true;
  radarArray.add(radarPost);
  const radarDish = new THREE.Mesh(cyl(0.6, 0.75, 0.16, 12), sandDarkMaterial);
  radarDish.name = 'fortress_radar_dish';
  radarDish.position.set(0, 0.5 * scale, 0);
  radarDish.rotation.z = 0.48;
  radarDish.castShadow = true;
  radarArray.add(radarDish);
  const radarLattice = new THREE.Mesh(ring(0.62, 0.05, 6, 14), steelMaterial);
  radarLattice.name = 'fortress_radar_lattice';
  radarLattice.position.set(0, 0.5 * scale, 0);
  radarLattice.rotation.set(Math.PI / 2, 0, 0.48);
  radarLattice.castShadow = true;
  radarArray.add(radarLattice);

  // 通讯桅杆与军旗
  const antennaRodGeometry = cyl(0.05, 0.07, 1.7, 6);
  [
    { x: 1.15, z: 0.25 },
    { x: -1.3, z: 1.35 },
  ].forEach((spot, i) => {
    add(antennaRodGeometry, steelMaterial, `fortress_antenna_rod_${i}`, spot.x, 8.4, spot.z, {
      shadow: false,
    });
  });
  add(cyl(0.04, 0.05, 2.4, 6), steelMaterial, 'fortress_banner_pole', 2.0, 8.2, 1.5, {
    shadow: false,
  });
  add(box(0.06, 1.05, 0.72), bannerMaterial, 'fortress_banner', 2.0, 8.85, 1.95);

  // ===== 双联防空导弹发射架（保留 ±3 / 4.5 高度锚点）=====
  const missileTubeGeometry = cyl(0.27, 0.27, 1.8, 8);
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? 'left' : 'right';
    add(
      box(1.7, 0.85, 2.0),
      steelMaterial,
      `fortress_missile_${name}_housing`,
      side * 3.1,
      3.85,
      0.2
    );
    add(box(1.55, 1.75, 1.95), missileMaterial, `fortress_missile_${name}`, side * 3.15, 4.7, 0.2, {
      rz: side * 0.14,
      collide: true,
    });
    for (let tube = 0; tube < 4; tube++) {
      const tx = tube % 2 === 0 ? -0.4 : 0.4;
      const tz = tube < 2 ? -0.45 : 0.45;
      add(
        missileTubeGeometry,
        trackMaterial,
        `fortress_missile_tube_${name}_${tube}`,
        side * 3.15 + tx,
        5.05,
        0.2 + tz,
        { rz: side * 0.14 }
      );
    }
    add(
      box(1.85, 0.2, 2.25),
      sandLightMaterial,
      `fortress_missile_${name}_frame`,
      side * 3.2,
      5.62,
      0.2,
      { rz: side * 0.14 }
    );
    add(
      cyl(0.34, 0.34, 0.24, 10),
      glowMaterial.clone(),
      `fortress_missile_${name}_glow`,
      side * 3.28,
      5.85,
      0.2,
      { shadow: false }
    );
  }

  // ===== 四角防空炮位（保留四个炮位锚点命名）=====
  const flakPositions = [
    { name: 'front_left', x: -5, z: -3 },
    { name: 'front_right', x: 5, z: -3 },
    { name: 'back_left', x: -5, z: 3 },
    { name: 'back_right', x: 5, z: 3 },
  ];
  const flakPlatformGeometry = box(1.75, 0.32, 1.65);
  const flakBaseGeometry = cyl(0.5, 0.62, 0.55, 8);
  const flakHousingGeometry = box(1.0, 0.55, 1.1);
  const flakBarrelGeometry = cyl(0.11, 0.13, 2.1, 8);
  const flakShieldGeometry = box(1.15, 0.6, 0.14);
  const ammoDrumGeometry = cyl(0.3, 0.3, 0.55, 8);
  const flakMuzzleGeometry = ball(0.19, 8);
  for (const flak of flakPositions) {
    const isFront = flak.name.includes('front');
    const forwardSign = isFront ? -1 : 1;
    const sideSign = flak.x < 0 ? -1 : 1;
    const barrelTilt = forwardSign < 0 ? -Math.PI / 4 : Math.PI / 4;

    add(
      flakPlatformGeometry,
      sandMaterial,
      `fortress_flak_platform_${flak.name}`,
      flak.x,
      2.95,
      flak.z,
      { collide: true }
    );
    add(flakBaseGeometry, turretMaterial, `fortress_flak_base_${flak.name}`, flak.x, 3.3, flak.z, {
      collide: true,
    });
    add(
      flakHousingGeometry,
      steelMaterial,
      `fortress_flak_housing_${flak.name}`,
      flak.x,
      3.75,
      flak.z
    );
    for (const barrelSide of [-1, 1] as const) {
      add(
        flakBarrelGeometry,
        turretMaterial,
        `fortress_flak_barrel_${flak.name}_${barrelSide < 0 ? 0 : 1}`,
        flak.x + barrelSide * 0.22,
        4.4,
        flak.z + forwardSign * 0.62,
        { rx: barrelTilt, collide: barrelSide < 0 }
      );
    }
    add(
      flakShieldGeometry,
      sandLightMaterial,
      `fortress_flak_shield_${flak.name}`,
      flak.x,
      3.95,
      flak.z + forwardSign * -0.72
    );
    add(
      ammoDrumGeometry,
      steelMaterial,
      `fortress_flak_ammo_drum_${flak.name}`,
      flak.x + sideSign * 0.82,
      3.45,
      flak.z,
      { rz: Math.PI / 2 }
    );
    add(
      flakMuzzleGeometry,
      glowMaterial.clone(),
      `fortress_flak_muzzle_${flak.name}`,
      flak.x,
      5.05,
      flak.z + forwardSign * 1.3,
      { shadow: false }
    );
  }

  // ===== 航行灯与警示信标 =====
  const runningLightGeometry = ball(0.17, 8);
  const runningLightSpots = [
    { name: 'left_front', x: -8.5, z: -5.6, red: true },
    { name: 'left_back', x: -8.5, z: 5.6, red: true },
    { name: 'right_front', x: 8.5, z: -5.6, red: false },
    { name: 'right_back', x: 8.5, z: 5.6, red: false },
  ];
  for (const spot of runningLightSpots) {
    add(
      runningLightGeometry,
      spot.red ? runningLightRedMaterial : runningLightGreenMaterial,
      `fortress_running_light_${spot.name}`,
      spot.x,
      1.95,
      spot.z,
      { shadow: false }
    );
  }

  const beaconGeometry = ball(0.19, 8);
  [
    { x: -1.15, y: 8.95, z: 0.7 },
    { x: 1.15, y: 8.95, z: 0.7 },
    { x: -5.0, y: 5.5, z: 1.7 },
    { x: 5.0, y: 5.5, z: 1.7 },
  ].forEach((spot, i) => {
    add(beaconGeometry, beaconMaterial, `fortress_signal_beacon_${i}`, spot.x, spot.y, spot.z, {
      shadow: false,
    });
  });

  group.name = `BOSS_${config.type}`;
  (group as BossGroup).bossParts = parts;
  return group;
}
