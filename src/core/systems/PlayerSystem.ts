import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import type { PlayerHitFeedbackMetadata } from '@/core/EventBus';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerController } from '@/features/player/PlayerController';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { WORLDSCAPE_WATER_Y } from '@/features/terrain/TerrainGenerator';

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
  private shieldMesh?: THREE.Mesh;
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
    this.updateShieldPosition();
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

  private updateShieldPosition(): void {
    if (this.shieldMesh && this.shieldActive) {
      this.shieldMesh.position.copy(this.mesh.position);
    }
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

    if (!this.shieldMesh) {
      const geometry = new THREE.SphereGeometry(3, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      this.shieldMesh = new THREE.Mesh(geometry, material);
      scene.add(this.shieldMesh);
    }

    this.shieldMesh.visible = true;
    EventBus.emit(GameEventType.SHIELD_ACTIVATED, { duration: 10 });
  }

  deactivateShield(): void {
    this.shieldActive = false;
    if (this.shieldMesh) {
      this.shieldMesh.visible = false;
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
