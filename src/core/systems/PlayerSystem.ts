import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerController } from '@/features/player/PlayerController';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';

export class PlayerSystem implements IGameSystem {
  readonly name = 'PlayerSystem';

  private controller: PlayerController;
  private health: HealthSystem;
  private stats: PlayerStats;
  private mesh: THREE.Group;

  private lives: number = 3;
  private isRespawning: boolean = false;
  private respawnTimer: number = 0;
  private respawnDelay: number = 2;
  private deathPosition?: THREE.Vector3;

  private shieldActive: boolean = false;
  private shieldMesh?: THREE.Mesh;

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
    this.syncVisualState();
  }

  init(): void {
    this.health.onDamage = () => {
      if (!this.shieldActive && !this.isRespawning) {
        EventBus.emit(GameEventType.PLAYER_HIT, {
          damage: 0,
          position: this.mesh.position.clone(),
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
  }

  dispose(): void {}

  private handleDeath(): void {
    this.lives--;
    this.deathPosition = this.mesh.position.clone();

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

    if (this.deathPosition) {
      this.mesh.position.copy(this.deathPosition);
    }

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

  private checkGroundCollision(): void {
    const groundLevel = -45;
    if (this.mesh.position.y < groundLevel) {
      this.health.takeDamage(1000);
    }
  }

  getController(): PlayerController {
    return this.controller;
  }

  getHealth(): HealthSystem {
    return this.health;
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
