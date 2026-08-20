import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import type { PlayerHitFeedbackMetadata } from '@/core/EventBus';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerController } from '@/features/player/PlayerController';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { WORLDSCAPE_WATER_Y } from '@/features/terrain/TerrainGenerator';
import { HUD_COLORS } from '@/ui/theme/hudTokens';

export class PlayerSystem implements IGameSystem {
  readonly name = 'PlayerSystem';
  private static readonly RESPAWN_ALTITUDE_BUFFER = 10;

  private controller: PlayerController;
  private health: HealthSystem;
  private stats: PlayerStats;
  private mesh: THREE.Group;

  private lives: number = 3;
  private isRespawning: boolean = false;
  private respawnTimer: number = 0;
  private respawnDelay: number = 2;
  private lastSafeRespawnPosition: THREE.Vector3;
  private crashSurfaceSampler: ((x: number, z: number) => number) | null = null;

  private shieldActive: boolean = false;
  private shieldGroup?: THREE.Group;
  private readonly shieldMaterials: THREE.MeshBasicMaterial[] = [];
  private shieldTime: number = 0;
  private shieldFade: number = 0;
  private shieldFadingOut: boolean = false;
  private static readonly SHIELD_FADE_MS = 200;
  private static readonly SHIELD_INNER_OPACITY = 0.16;
  private static readonly SHIELD_OUTER_OPACITY = 0.08;
  private static readonly SHIELD_BREATHE_MIN = 1.0;
  private static readonly SHIELD_BREATHE_MAX = 1.03;
  private pendingDamageOptions: PlayerHitFeedbackMetadata | null = null;

  private fireCooldown: number = 0;
  private readonly previousVisualPosition = new THREE.Vector3();
  private readonly currentVisualPosition = new THREE.Vector3();
  private readonly interpolatedVisualPosition = new THREE.Vector3();
  private readonly previousVisualQuaternion = new THREE.Quaternion();
  private readonly currentVisualQuaternion = new THREE.Quaternion();
  private readonly interpolatedVisualQuaternion = new THREE.Quaternion();

  constructor(scene: THREE.Scene, mesh: THREE.Group, stats: PlayerStats) {
    this.mesh = mesh;
    this.stats = stats;
    this.controller = new PlayerController(mesh, scene, stats);
    this.health = new HealthSystem(stats.getMaxHealth());
    this.lastSafeRespawnPosition = mesh.position.clone();
    this.syncVisualState();
  }

  init(): void {
    this.health.onDamage = (amount) => {
      if (!this.shieldActive && !this.isRespawning) {
        EventBus.emit(GameEventType.PLAYER_HIT, {
          damage: amount,
          position: this.mesh.position.clone(),
          feedback: this.pendingDamageOptions ?? undefined,
        });
      }
    };

    this.health.onDeath = () => {
      this.handleDeath();
    };
  }

  update(deltaTime: number): void {
    if (this.isRespawning) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);
    this.updateShield(deltaTime);
    this.checkGroundCollision();
    this.updateLastSafeRespawnPosition();
  }

  dispose(): void {}

  private handleDeath(): void {
    this.lives--;

    EventBus.emit(GameEventType.PLAYER_DEATH, {
      position: this.mesh.position.clone(),
      lives: this.lives,
    });

    this.mesh.visible = false;
    this.syncVisualState();

    if (this.lives <= 0) {
      // Game over handled by Game.ts
    } else {
      this.isRespawning = true;
      this.respawnTimer = this.respawnDelay;
    }
  }

  private respawn(): void {
    this.health.reset();
    const safeRespawnPosition = this.getSafeRespawnPosition();

    this.mesh.position.copy(safeRespawnPosition);

    this.mesh.visible = true;
    this.syncVisualState();

    this.isRespawning = false;
    EventBus.emit(GameEventType.PLAYER_RESPAWN, {
      position: this.mesh.position.clone(),
    });
  }

  private updateShield(deltaTime: number): void {
    if (!this.shieldGroup) {
      return;
    }

    if (!this.shieldActive && !this.shieldFadingOut) {
      return;
    }

    this.shieldGroup.position.copy(this.mesh.position);
    this.shieldTime += deltaTime;
    const wave = 0.5 + 0.5 * Math.sin(this.shieldTime * Math.PI * 2);
    const breathe =
      PlayerSystem.SHIELD_BREATHE_MIN +
      (PlayerSystem.SHIELD_BREATHE_MAX - PlayerSystem.SHIELD_BREATHE_MIN) * wave;
    this.shieldGroup.scale.setScalar(breathe);

    if (this.shieldFadingOut) {
      const fadeSeconds = PlayerSystem.SHIELD_FADE_MS / 1000;
      this.shieldFade = Math.max(0, this.shieldFade - deltaTime / fadeSeconds);
      this.applyShieldOpacity(this.shieldFade);
      if (this.shieldFade <= 0) {
        this.shieldFadingOut = false;
        this.shieldGroup.visible = false;
      }
    }
  }

  private applyShieldOpacity(fade: number): void {
    if (this.shieldMaterials[0]) {
      this.shieldMaterials[0].opacity = PlayerSystem.SHIELD_INNER_OPACITY * fade;
    }
    if (this.shieldMaterials[1]) {
      this.shieldMaterials[1].opacity = PlayerSystem.SHIELD_OUTER_OPACITY * fade;
    }
  }

  private createShieldVisual(scene: THREE.Scene): void {
    const group = new THREE.Group();
    group.name = 'player-shield';
    const sysColor = new THREE.Color(HUD_COLORS.sys);

    const makeSphere = (radius: number, opacity: number): THREE.Mesh => {
      const geometry = new THREE.SphereGeometry(radius, 24, 24);
      const material = new THREE.MeshBasicMaterial({
        color: sysColor,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      this.shieldMaterials.push(material);
      return new THREE.Mesh(geometry, material);
    };

    const inner = makeSphere(2.85, PlayerSystem.SHIELD_INNER_OPACITY);
    const outer = makeSphere(3.1, PlayerSystem.SHIELD_OUTER_OPACITY);
    group.add(inner);
    group.add(outer);
    scene.add(group);

    this.shieldGroup = group;
  }

  private sampleCrashSurfaceY(worldX: number, worldZ: number): number {
    if (this.crashSurfaceSampler) {
      const sampled = this.crashSurfaceSampler(worldX, worldZ);
      if (Number.isFinite(sampled)) {
        return sampled;
      }
    }
    return WORLDSCAPE_WATER_Y;
  }

  private checkGroundCollision(): void {
    const { x, y, z } = this.mesh.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }

    const surfaceY = this.sampleCrashSurfaceY(x, z);
    if (y <= surfaceY) {
      this.health.takeDamage(1000);
    }
  }

  private updateLastSafeRespawnPosition(): void {
    const { x, y, z } = this.mesh.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }

    const minSafeY = this.sampleCrashSurfaceY(x, z) + PlayerSystem.RESPAWN_ALTITUDE_BUFFER;
    if (y > minSafeY) {
      this.lastSafeRespawnPosition.copy(this.mesh.position);
    }
  }

  private getSafeRespawnPosition(): THREE.Vector3 {
    const safeRespawnPosition = this.lastSafeRespawnPosition.clone();
    const surfaceY = this.sampleCrashSurfaceY(safeRespawnPosition.x, safeRespawnPosition.z);
    const minSafeY = surfaceY + PlayerSystem.RESPAWN_ALTITUDE_BUFFER;
    const currentY = Number.isFinite(safeRespawnPosition.y) ? safeRespawnPosition.y : minSafeY;
    safeRespawnPosition.y = Math.max(currentY, minSafeY);

    return safeRespawnPosition;
  }

  /** 注入活地形/水面高度采样；未设置时坠毁判定回落到 WORLDSCAPE_WATER_Y */
  setCrashSurfaceSampler(sampler: (x: number, z: number) => number): void {
    this.crashSurfaceSampler = sampler;
  }

  getController(): PlayerController {
    return this.controller;
  }

  getHealth(): HealthSystem {
    return this.health;
  }

  takeCombatDamage(amount: number, feedback?: PlayerHitFeedbackMetadata): void {
    this.pendingDamageOptions = feedback ?? null;
    try {
      this.health.takeDamage(amount);
    } finally {
      this.pendingDamageOptions = null;
    }
  }

  getStats(): PlayerStats {
    return this.stats;
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  getPosition(): THREE.Vector3 {
    return this.controller.getPosition();
  }

  getQuaternion(): THREE.Quaternion {
    return this.controller.getQuaternion();
  }

  getSpeed(): number {
    return this.controller.getSpeed();
  }

  canFire(): boolean {
    return this.fireCooldown <= 0 && !this.isRespawning;
  }

  fire(): void {
    if (!this.canFire()) return;

    const position = this.getPosition().clone();
    const quaternion = this.getQuaternion();
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);
    position.add(forward.clone().multiplyScalar(2));

    const baseFireRate = this.stats.getFireRate();
    this.fireCooldown = baseFireRate / this.stats.getRapidFireMultiplier();

    const baseSpread = 3;
    const spreadAngle = this.stats.getSpreadAngle() + baseSpread;
    const spreadRad = ((spreadAngle / 2) * Math.PI) / 180;
    const randomAngle = (Math.random() - 0.5) * 2 * spreadRad;
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);

    EventBus.emit(GameEventType.PLAYER_FIRED, {
      position,
      direction: forward,
      damage: this.stats.getDamage(),
    });
  }

  activateShield(scene: THREE.Scene): void {
    this.shieldActive = true;
    this.shieldFadingOut = false;
    this.shieldFade = 1;

    if (!this.shieldGroup) {
      this.createShieldVisual(scene);
    }

    if (this.shieldGroup) {
      this.shieldGroup.visible = true;
      this.shieldGroup.scale.setScalar(PlayerSystem.SHIELD_BREATHE_MIN);
      this.applyShieldOpacity(1);
    }
    EventBus.emit(GameEventType.SHIELD_ACTIVATED, { duration: 10 });
  }

  deactivateShield(): void {
    this.shieldActive = false;
    if (this.shieldGroup && this.shieldGroup.visible) {
      this.shieldFadingOut = true;
      this.shieldFade = Math.max(this.shieldFade, 0.0001);
    }
    EventBus.emit(GameEventType.SHIELD_DEACTIVATED, undefined as never);
  }

  isShieldActive(): boolean {
    return this.shieldActive;
  }

  isPlayerRespawning(): boolean {
    return this.isRespawning;
  }

  getLives(): number {
    return this.lives;
  }

  setLives(lives: number): void {
    this.lives = lives;
  }

  syncMaxHealth(): void {
    const oldPercent = this.health.getHealthPercent();
    const newMax = this.stats.getMaxHealth();
    this.health.setMaxHealth(newMax);
    if (oldPercent > 0.9) {
      this.health.healToMax();
    } else {
      const newCurrent = Math.ceil(newMax * oldPercent);
      this.health.heal(newCurrent - this.health.getCurrentHealth());
    }
  }

  getFireCooldown(): number {
    return this.fireCooldown;
  }

  public capturePreviousVisualState(): void {
    this.previousVisualPosition.copy(this.currentVisualPosition);
    this.previousVisualQuaternion.copy(this.currentVisualQuaternion);
  }

  public captureCurrentVisualState(): void {
    this.currentVisualPosition.copy(this.mesh.position);
    this.currentVisualQuaternion.copy(this.mesh.quaternion);
  }

  public syncVisualState(): void {
    this.previousVisualPosition.copy(this.mesh.position);
    this.currentVisualPosition.copy(this.mesh.position);
    this.previousVisualQuaternion.copy(this.mesh.quaternion);
    this.currentVisualQuaternion.copy(this.mesh.quaternion);
  }

  public applyInterpolatedVisual(alpha: number): void {
    this.interpolatedVisualPosition.lerpVectors(
      this.previousVisualPosition,
      this.currentVisualPosition,
      alpha
    );
    this.interpolatedVisualQuaternion.slerpQuaternions(
      this.previousVisualQuaternion,
      this.currentVisualQuaternion,
      alpha
    );
    this.mesh.position.copy(this.interpolatedVisualPosition);
    this.mesh.quaternion.copy(this.interpolatedVisualQuaternion);
  }

  public restoreCurrentVisual(): void {
    this.mesh.position.copy(this.currentVisualPosition);
    this.mesh.quaternion.copy(this.currentVisualQuaternion);
  }
}
