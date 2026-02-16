import * as THREE from 'three';
import { GameLoop } from '@/core/GameLoop';
import { GameScene } from '@/scenes/GameScene';
import { GameState, GameStatus } from '@/core/GameState';
import { EventBus, GameEventType } from '@/core/EventBus';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { EnemySystem } from '@/core/systems/EnemySystem';
import { PowerUpSystem } from '@/core/systems/PowerUpSystem';
import { InputHandler } from '@/core/Input/InputHandler';
import { AudioManager } from '@/core/Audio/AudioManager';
import { MusicSystem, LevelMusic } from '@/core/Audio/MusicSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { PowerUpType, POWER_UP_CONFIGS } from '@/features/powerups/PowerUpSystem';
import { HUD } from '@/ui/HUD';
import { StartMenu, GameSettings } from '@/ui/StartMenu';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { ThirdPersonCamera } from '@/features/camera/ThirdPersonCamera';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { GAME_CONSTANTS } from '@/config';
import { BossAI, createBossMesh } from '@/features/boss/BossAI';
import { BOSS_CONFIGS, BOSS_MISSILE_CONFIG, getBossForLevel } from '@/features/boss/BossTypes';
import { Faction } from '@/core/Faction';

export class GameCoordinator {
  private gameLoop: GameLoop;
  private gameScene: GameScene;
  private gameState: GameState;
  private inputHandler: InputHandler;
  private audioManager: AudioManager;
  private musicSystem: MusicSystem;
  private particleSystem: ParticleSystem;
  private thirdPersonCamera: ThirdPersonCamera;

  private playerSystem: PlayerSystem;
  private combatSystem: CombatSystem;
  private enemySystem: EnemySystem;
  private powerUpSystem: PowerUpSystem;

  private hud: HUD;
  private startMenu: StartMenu;
  private lockOnIndicator: LockOnIndicator;
  private enemyHealthBars: EnemyHealthBars;

  private playerStats: PlayerStats;
  private playerAircraft: THREE.Group;

  private missileCount: number = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
  private missileRespawnTimer: number = 0;
  private missileFiringScheduled: boolean = false;
  private multiShotActive: boolean = false;

  private currentLevelId: number = 1;
  private audioInitialized: boolean = false;

  // Boss 战相关
  private bossMode: boolean = false; // Boss 模式：直接 Boss 战，跳过波次
  private inLevelBossBattle: boolean = false; // 普通模式：波次完成后的 Boss 战
  private currentBoss: BossAI | null = null;
  private bossFriendlySpawnTimer: number = 0;
  private bossIndicator: BossMissileIndicator;

  constructor() {
    this.gameLoop = new GameLoop();
    this.gameScene = new GameScene();
    this.inputHandler = new InputHandler();
    this.gameState = new GameState();
    this.audioManager = new AudioManager();
    this.musicSystem = new MusicSystem();
    this.particleSystem = new ParticleSystem(this.gameScene.scene);
    this.playerStats = new PlayerStats();

    this.playerAircraft = this.createPlayerAircraft();
    this.gameScene.scene.add(this.playerAircraft);

    this.thirdPersonCamera = new ThirdPersonCamera(this.gameScene.camera, this.playerAircraft);

    this.playerSystem = new PlayerSystem(
      this.gameScene.scene,
      this.playerAircraft,
      this.playerStats
    );

    this.combatSystem = new CombatSystem(
      this.gameScene.scene,
      this.particleSystem,
      this.playerAircraft
    );

    this.enemySystem = new EnemySystem(this.gameScene.scene);

    this.powerUpSystem = new PowerUpSystem(this.gameScene.scene, this.particleSystem);

    this.hud = new HUD();
    this.lockOnIndicator = new LockOnIndicator();
    this.enemyHealthBars = new EnemyHealthBars();
    this.startMenu = new StartMenu();
    this.bossIndicator = new BossMissileIndicator();

    this.initSystems();
    this.setupEventListeners();
    this.setupStartMenu();
  }

  private initSystems(): void {
    this.playerSystem.init();
    this.combatSystem.init();
    this.enemySystem.init();
    this.powerUpSystem.init();
  }

  private setupEventListeners(): void {
    EventBus.on(GameEventType.PLAYER_HIT, ({ payload }) => {
      if (!this.playerSystem.isShieldActive()) {
        this.audioManager.playHit();
        this.particleSystem.createHit(payload.position);
      }
    });

    EventBus.on(GameEventType.PLAYER_DEATH, ({ payload }) => {
      this.audioManager.stopEngine();
      this.audioManager.playExplosion();
      this.particleSystem.createExplosion(payload.position, 2);
      this.lockOnIndicator.cancelLockOn();
      this.playerAircraft.visible = false;

      if (this.playerSystem.getLives() <= 0) {
        this.gameState.setStatus(GameStatus.GAME_OVER);
        this.audioManager.playGameOver();
        this.musicSystem.stopMusic();
        this.hud.showGameOver(this.gameState.getScore());
      }
    });

    EventBus.on(GameEventType.PLAYER_RESPAWN, ({ payload }) => {
      this.particleSystem.createExplosion(payload.position, 1.5);
      this.playerAircraft.visible = true;
      this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
      this.hud.updateMissiles(this.missileCount);
      this.audioManager.startEngine();

      this.playerSystem.activateShield(this.gameScene.scene);
      this.powerUpSystem.addActivePowerUp(PowerUpType.SHIELD, POWER_UP_CONFIGS[PowerUpType.SHIELD]);
    });

    EventBus.on(GameEventType.ENEMY_FIRED, () => {
      this.audioManager.playShoot();
    });

    EventBus.on(GameEventType.FRIENDLY_FIRED, () => {
      this.audioManager.playShoot();
    });

    EventBus.on(GameEventType.PLAYER_FIRED, () => {
      this.audioManager.playShoot();
    });

    EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
      this.gameState.addScore(payload.config.scoreValue);
      this.playerStats.addScore(payload.config.scoreValue);
      this.audioManager.playExplosion();
      this.particleSystem.createExplosion(payload.position, payload.config.scale);

      if (Math.random() < GAME_CONSTANTS.POWERUP.SPAWN_CHANCE) {
        this.powerUpSystem.spawn(payload.position);
      }
    });

    EventBus.on(GameEventType.WAVE_START, () => {
      this.audioManager.playWaveStart();
    });

    EventBus.on(GameEventType.LEVEL_COMPLETE, () => {
      this.audioManager.playLevelUp();

      this.combatSystem.getPlayerProjectilePool().clear();
      this.combatSystem.getEnemyProjectilePool().clear();
      this.particleSystem.clear();
      this.powerUpSystem.clear();

      this.musicSystem.stopMusic();

      this.startLevelBossBattle();
    });

    EventBus.on(GameEventType.POWERUP_COLLECTED, ({ payload }) => {
      this.audioManager.playPowerUp();
      this.hud.showPowerUp(payload.config.name, payload.config.icon, payload.config.duration);

      this.handlePowerUpEffect(payload.type, payload.config);
    });

    EventBus.on(GameEventType.POWERUP_EXPIRED, ({ payload }) => {
      this.handlePowerUpExpired(payload.type);
    });
  }

  private handlePowerUpEffect(
    type: PowerUpType,
    config: (typeof POWER_UP_CONFIGS)[PowerUpType]
  ): void {
    switch (type) {
      case PowerUpType.HEALTH:
        this.playerSystem.setLives(this.playerSystem.getLives() + 1);
        this.playerSystem.syncMaxHealth();
        this.playerSystem.getHealth().healToMax();
        this.hud.updateLives(this.playerSystem.getLives());
        break;
      case PowerUpType.SHIELD:
        this.playerSystem.activateShield(this.gameScene.scene);
        break;
      case PowerUpType.SPEED:
        this.playerStats.setSpeedMultiplier(config.value);
        break;
      case PowerUpType.DAMAGE:
        this.playerStats.setDamageMultiplier(config.value);
        this.combatSystem.setDamageMultiplier(config.value);
        break;
      case PowerUpType.MULTISHOT:
        this.playerStats.setRapidFire(3, 30);
        this.multiShotActive = true;
        break;
      case PowerUpType.BOMB:
        this.spawnFriendlyAI();
        break;
    }
  }

  private handlePowerUpExpired(type: PowerUpType): void {
    switch (type) {
      case PowerUpType.SHIELD:
        this.playerSystem.deactivateShield();
        break;
      case PowerUpType.SPEED:
        this.playerStats.resetSpeedMultiplier();
        break;
      case PowerUpType.DAMAGE:
        this.playerStats.resetDamageMultiplier();
        this.combatSystem.setDamageMultiplier(1);
        break;
      case PowerUpType.MULTISHOT:
        this.playerStats.resetRapidFire();
        this.multiShotActive = false;
        break;
    }
  }

  private setupStartMenu(): void {
    this.startMenu.setOnStart((settings: GameSettings) => {
      this.playerSystem.setLives(settings.playerLives);
      this.audioManager.setSFXVolume(settings.soundVolume);
      this.currentLevelId = settings.startLevel;
      this.bossMode = settings.gameMode === 'boss';
      this.gameState.start();
      this.start();
    });
  }

  private createPlayerAircraft(): THREE.Group {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.7,
      roughness: 0.2,
    });

    const bodyGeometry = new THREE.ConeGeometry(0.5, 3.5, 12);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x111133,
      metalness: 0.9,
      roughness: 0.1,
    });
    const cockpitGeometry = new THREE.SphereGeometry(0.3, 12, 12);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.3, -0.5);
    cockpit.scale.set(1, 0.6, 1.5);
    group.add(cockpit);

    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x3366dd,
      metalness: 0.6,
      roughness: 0.3,
    });

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2, 0.8);
    wingShape.lineTo(0.3, 1);
    wingShape.lineTo(0, 0);

    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.rotation.z = Math.PI;
    leftWing.position.set(-0.3, 0, 0.3);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.position.set(0.3, 0, 0.3);
    group.add(rightWing);

    const tailGeometry = new THREE.BoxGeometry(0.05, 0.8, 0.6);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0.5, 1.5);
    group.add(tail);

    const engineGlowGeometry = new THREE.ConeGeometry(0.2, 0.8, 8);
    const engineGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.8,
    });
    const engineGlow = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
    engineGlow.rotation.x = -Math.PI / 2;
    engineGlow.position.set(0, 0, 2);
    engineGlow.name = 'engineGlow';
    group.add(engineGlow);

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name !== 'engineGlow') {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  private createAircraftMesh(config: (typeof ENEMY_CONFIGS)[EnemyType]): THREE.Group {
    const group = new THREE.Group();

    let bodyColor: number, wingColor: number, accentColor: number;
    let bodySize = 1.6,
      bodyLength = 6,
      wingSpan = 3;
    const tailSize = 0.8;
    let scaleMultiplier = 1;

    switch (config.type) {
      case EnemyType.SCOUT:
        bodyColor = 0x4a5584;
        wingColor = 0x6b7b8e;
        accentColor = 0x3d5a87;
        bodySize = 1.2;
        bodyLength = 5;
        wingSpan = 2.2;
        scaleMultiplier = 0.85;
        break;
      case EnemyType.FIGHTER:
        bodyColor = 0xcc3300;
        wingColor = 0xe63900;
        accentColor = 0x8b2500;
        bodySize = 1.8;
        bodyLength = 7;
        wingSpan = 3.5;
        scaleMultiplier = 1.1;
        break;
      case EnemyType.HEAVY:
        bodyColor = 0x2c2c2c;
        wingColor = 0x3a3a3a;
        accentColor = 0x1a1a1a;
        bodySize = 2.2;
        bodyLength = 8;
        wingSpan = 4.2;
        scaleMultiplier = 1.3;
        break;
      case EnemyType.SNIPER:
        bodyColor = 0x4a235a;
        wingColor = 0x6b4c7a;
        accentColor = 0x7c3aed;
        bodySize = 1.6;
        bodyLength = 7.5;
        wingSpan = 2.8;
        scaleMultiplier = 0.95;
        break;
      case EnemyType.ACE:
        bodyColor = 0x8b0000;
        wingColor = 0xffd700;
        accentColor = 0xff4500;
        bodySize = 1.9;
        bodyLength = 7;
        wingSpan = 3.3;
        scaleMultiplier = 1.15;
        break;
      default:
        bodyColor = config.color;
        wingColor = config.color;
        accentColor = config.color;
    }

    group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);

    // 机身 - 锥形，机头细机尾粗，沿 Z 轴
    const bodyGeometry = new THREE.ConeGeometry(bodySize * 0.4, bodyLength, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.7,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    // 主翼 - 在机身中后部
    const wingGeometry = new THREE.BoxGeometry(wingSpan, 0.15, 1.2);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      metalness: 0.6,
      roughness: 0.4,
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, bodyLength * 0.2);
    wings.castShadow = true;
    group.add(wings);

    // 驾驶舱 - 在机身前部
    const cockpitGeometry = new THREE.SphereGeometry(bodySize * 0.35, 8, 8);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.9,
      roughness: 0.1,
      emissive: accentColor,
      emissiveIntensity: 0.3,
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, bodySize * 0.25, -bodyLength * 0.2);
    cockpit.castShadow = true;
    group.add(cockpit);

    // 水平尾翼 - 在机尾
    const tailGeometry = new THREE.BoxGeometry(tailSize, 0.12, 1);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0, bodyLength * 0.45);
    tail.castShadow = true;
    group.add(tail);

    // 垂直尾翼 - 在机尾上方
    const vStabGeometry = new THREE.BoxGeometry(0.15, 1.2, 0.8);
    const vStab = new THREE.Mesh(vStabGeometry, wingMaterial);
    vStab.position.set(0, 0.6, bodyLength * 0.4);
    vStab.castShadow = true;
    group.add(vStab);

    // 引擎 - 在机尾末端
    const engineGeometry = new THREE.CylinderGeometry(bodySize * 0.2, bodySize * 0.15, 0.5, 8);
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    });
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, 0, bodyLength * 0.5 + 0.3);
    group.add(engine);

    group.name = config.type;
    return group;
  }

  private spawnFriendlyAI(): void {
    const enemyTypes = Object.values(EnemyType);
    const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const config = ENEMY_CONFIGS[randomType];

    const mesh = this.createAircraftMesh(config);
    const friendly = new FriendlyAI(mesh, config, this.gameScene.scene);

    const playerPos = this.playerSystem.getPosition();
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 100
    );
    mesh.position.copy(playerPos).add(offset);

    this.gameScene.scene.add(mesh);
    this.enemySystem.spawnFriendly(friendly);
  }

  private update(deltaTime: number): void {
    if (this.gameState.getStatus() !== GameStatus.PLAYING) {
      return;
    }

    const input = this.inputHandler.getState();

    if (!this.playerSystem.isPlayerRespawning()) {
      this.playerSystem.getController().update(deltaTime, input);

      if (input.fire && this.playerSystem.canFire()) {
        this.playerSystem.fire();
      }

      this.handleMissileInput(input);
    }

    this.playerSystem.update(deltaTime);
    this.combatSystem.update(deltaTime);

    if ((this.bossMode || this.inLevelBossBattle) && this.currentBoss) {
      this.updateBossBattle(deltaTime);
    } else {
      this.enemySystem.updateWithPlayer(deltaTime, this.playerSystem.getPosition());
    }

    this.powerUpSystem.update(deltaTime);

    const enemyMeshes = this.enemySystem.getEnemyMeshes();
    const friendlyMeshes = this.enemySystem.getFriendlyAIs().map((f) => f.getMesh());

    this.combatSystem.updateEnemyMeshes(enemyMeshes);

    this.combatSystem.checkProjectileCollisions(
      enemyMeshes,
      friendlyMeshes,
      (target, damage) => {
        const enemy = this.enemySystem.getEnemies().find((e) => e.getMesh() === target);
        enemy?.takeDamage(damage);
      },
      (damage) => {
        if (!this.playerSystem.isShieldActive()) {
          this.playerSystem.getHealth().takeDamage(damage);
        }
      },
      (target, damage) => {
        const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
        friendly?.takeDamage(damage);
      }
    );

    this.handleBalloonCollisions();

    this.particleSystem.update(deltaTime);
    this.audioManager.updateEngine(this.playerSystem.getSpeed());

    const engineGlow = this.playerAircraft.getObjectByName('engineGlow');
    if (engineGlow) {
      const scale = 0.5 + (this.playerSystem.getSpeed() / 100) * 1;
      engineGlow.scale.setScalar(scale);
    }

    this.updateUI();
    this.updateMissileRespawn(deltaTime);
  }

  private updateBossBattle(deltaTime: number): void {
    if (!this.currentBoss) return;

    const friendlyMeshes = this.enemySystem.getFriendlyAIs().map((f) => f.getMesh());

    const bossMissileSystem = this.currentBoss.getMissileSystem();
    const bossPartMeshes = this.currentBoss.getCollisionPartMeshes();
    const bossAndMissiles = [...bossPartMeshes, ...bossMissileSystem.getMissileMeshes()];
    this.enemySystem.updateWithPlayer(deltaTime, this.playerSystem.getPosition(), bossAndMissiles);

    this.currentBoss.update(deltaTime, this.playerSystem.getMesh(), friendlyMeshes);

    bossMissileSystem.checkCollisions(
      [this.playerAircraft, ...friendlyMeshes],
      (target, _damage) => {
        this.particleSystem.createExplosion(target.position.clone(), 1);
        if (target === this.playerAircraft) {
          if (!this.playerSystem.isShieldActive()) {
            this.playerSystem.getHealth().takeDamage(BOSS_MISSILE_CONFIG.DAMAGE);
          }
        } else {
          const friendly = this.enemySystem.getFriendlyAIs().find((f) => f.getMesh() === target);
          friendly?.takeDamage(BOSS_MISSILE_CONFIG.DAMAGE);
        }
      }
    );

    const missileTargets = [
      this.currentBoss.getMesh(),
      ...bossPartMeshes,
      ...bossMissileSystem.getMissileMeshes(),
    ];
    this.combatSystem.getMissileSystem().checkCollisions(missileTargets, (target) => {
      const hitWorldPos = new THREE.Vector3();
      target.getWorldPosition(hitWorldPos);

      const isBossPart = bossPartMeshes.some((p) => p === target);
      if (target === this.currentBoss?.getMesh() || isBossPart) {
        this.currentBoss?.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
        this.particleSystem.createExplosion(hitWorldPos, 1.5);
        this.audioManager.playExplosion();
      } else {
        const missile = bossMissileSystem.getMissiles().find((m) => m.getMesh() === target);
        if (missile) {
          missile.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
          this.particleSystem.createExplosion(hitWorldPos, 0.8);
        }
      }
    });

    const bossTargets = [...bossPartMeshes, ...bossMissileSystem.getMissileMeshes()];

    this.combatSystem.getPlayerProjectilePool().checkCollisions(bossTargets, (target) => {
      const partMesh = bossPartMeshes.find((p) => p === target);
      if (partMesh || target === this.currentBoss?.getMesh()) {
        this.currentBoss?.takeDamage(this.combatSystem['damageMultiplier'] * 12.5);
        const hitPos = target.position.clone();
        this.particleSystem.createHit(hitPos);
      } else {
        const missile = bossMissileSystem.getMissiles().find((m) => m.getMesh() === target);
        if (missile) {
          missile.takeDamage(this.combatSystem['damageMultiplier'] * 12.5);
        }
      }
    });

    this.combatSystem
      .getEnemyProjectilePool()
      .checkCollisions(bossTargets, (target, _projectile, damage) => {
        const partMesh = bossPartMeshes.find((p) => p === target);
        if (partMesh || target === this.currentBoss?.getMesh()) {
          this.currentBoss?.takeDamage(damage);
          this.particleSystem.createHit(target.position);
        } else {
          const missile = bossMissileSystem.getMissiles().find((m) => m.getMesh() === target);
          if (missile) {
            missile.takeDamage(damage);
            this.particleSystem.createExplosion(target.position.clone(), 0.5);
          }
        }
      });

    this.bossFriendlySpawnTimer += deltaTime;
    if (this.bossFriendlySpawnTimer >= 30) {
      this.bossFriendlySpawnTimer = 0;
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '友军支援');
    }

    this.updateBossMissileIndicators();
  }

  private updateBossMissileIndicators(): void {
    if (!this.currentBoss) {
      this.bossIndicator.clear();
      return;
    }

    const bossMissileSystem = this.currentBoss.getMissileSystem();
    const missiles = bossMissileSystem.getMissiles();
    const playerPosition = this.playerSystem.getPosition();
    const camera = this.gameScene.camera;
    const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    // 只显示锁定玩家的导弹指示器
    const indicatorData = missiles
      .filter((missile) => missile.isTargetingPlayer)
      .filter((missile) => {
        // 验证导弹位置有效性，过滤掉位置无效的导弹
        const pos = missile.getMesh().position;
        return isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z);
      })
      .map((missile, index) => {
        const screenPos = this.getScreenPosition(missile.getMesh().position);
        const distance = playerPosition.distanceTo(missile.getMesh().position);
        const inView = this.isPositionInView(missile.getMesh().position);
        const toMissile = missile.getMesh().position.clone().sub(playerPosition);
        const isOnRight = playerRight.dot(toMissile) > 0;

        return {
          id: `boss-missile-${index}`,
          screenPos,
          distance,
          inView,
          isOnRight,
        };
      });

    this.bossIndicator.update(indicatorData);
  }

  private getScreenPosition(worldPos: THREE.Vector3): { x: number; y: number } {
    const camera = this.gameScene.camera;
    const vector = worldPos.clone();
    vector.project(camera);

    return {
      x: ((vector.x + 1) / 2) * window.innerWidth,
      y: ((-vector.y + 1) / 2) * window.innerHeight,
    };
  }

  private isPositionInView(worldPos: THREE.Vector3): boolean {
    const camera = this.gameScene.camera;
    const vector = worldPos.clone();
    vector.project(camera);

    return vector.x >= -1 && vector.x <= 1 && vector.y >= -1 && vector.y <= 1 && vector.z <= 1;
  }

  private handleMissileInput(input: ReturnType<InputHandler['getState']>): void {
    let targetMeshes: THREE.Object3D[] = this.enemySystem.getEnemyMeshes();

    if (this.bossMode && this.currentBoss) {
      const bossPartMeshes = this.currentBoss.getCollisionParts();
      targetMeshes = [...bossPartMeshes, ...targetMeshes];
      const bossMissiles = this.currentBoss.getMissileSystem().getMissileMeshes();
      targetMeshes = [...targetMeshes, ...bossMissiles];
    }

    const enemyScreenPos = this.enemyHealthBars.getFirstEnemyScreenPos();

    if (this.missileCount <= 0) {
      if (input.missile) {
        this.lockOnIndicator.setNoMissiles(true);
      } else {
        this.lockOnIndicator.setNoMissiles(false);
      }
      return;
    }

    this.lockOnIndicator.setNoMissiles(false);

    if (this.lockOnIndicator.isLocking()) {
      const lockComplete = this.lockOnIndicator.update(
        this.playerSystem.getPosition(),
        targetMeshes,
        this.gameScene.camera,
        0.016,
        enemyScreenPos
      );

      if (lockComplete) {
        const lockedTarget = this.lockOnIndicator.getCurrentTarget();
        if (lockedTarget && this.missileCount > 0 && !this.missileFiringScheduled) {
          this.missileFiringScheduled = true;

          setTimeout(() => {
            this.fireMissile(lockedTarget);
            this.lockOnIndicator.onMissileFired();
            this.missileFiringScheduled = false;
          }, 200);
        }
      }
    } else if (input.missile) {
      this.audioManager.playMissileLock();
      this.lockOnIndicator.startLockOn();
    } else {
      this.lockOnIndicator.cancelLockOn();
    }
  }

  private fireMissile(target?: THREE.Object3D): void {
    if (this.missileCount <= 0) return;

    const missileCount = this.multiShotActive ? Math.min(3, this.missileCount) : 1;

    for (let i = 0; i < missileCount; i++) {
      setTimeout(() => {
        if (this.missileCount <= 0) return;

        const position = this.playerSystem.getPosition().clone();
        const quaternion = this.playerSystem.getQuaternion();

        const cockpitOffset = new THREE.Vector3(0, 0.3, -0.5);
        cockpitOffset.applyQuaternion(quaternion);
        position.add(cockpitOffset);

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(quaternion);

        this.combatSystem.getMissileSystem().fire(position, forward, target);
        this.audioManager.playMissileLaunch();

        this.missileCount--;
        this.hud.updateMissiles(this.missileCount);
        this.lockOnIndicator.onMissileFired();
      }, i * 100);
    }
  }

  private handleBalloonCollisions(): void {
    if (this.playerSystem.isPlayerRespawning()) return;

    const projectiles = this.combatSystem.getPlayerProjectilePool().getActiveProjectiles();
    const projectilePositions = projectiles.map((p) => p.position);

    this.powerUpSystem.checkProjectileCollisions(projectilePositions, (_balloon, type) => {
      const config = POWER_UP_CONFIGS[type];
      this.audioManager.playBalloonPop();
      this.hud.showPowerUpBig(config.icon, config.name, 1);

      if (config.duration > 0) {
        this.hud.showPowerUp(config.name, config.icon, config.duration);
      }

      this.powerUpSystem.addActivePowerUp(type, config);
    });

    this.powerUpSystem.checkPlayerCollisions(this.playerSystem.getPosition(), (_type, config) => {
      this.audioManager.playPowerUp();
      this.hud.showPowerUp(config.name, config.icon, 0);
    });
  }

  private updateUI(): void {
    this.hud.updateHealth(this.playerSystem.getHealth().getHealthPercent());
    this.hud.updateSpeed(this.playerSystem.getSpeed());
    this.hud.updateScore(this.gameState.getScore());
    this.hud.updateEnemies(this.enemySystem.getAliveEnemyCount());

    const totalEnemies = this.enemySystem.getTotalEnemyCount();
    const spawnedEnemies = this.enemySystem.getSpawnedEnemyCount();
    const aliveEnemies = this.enemySystem.getAliveEnemyCount();
    const killedEnemies = spawnedEnemies - aliveEnemies;
    const remaining = totalEnemies - killedEnemies;
    this.hud.updateRemainingEnemies(remaining);
    this.hud.updateLives(this.playerSystem.getLives());
    this.hud.update(this.gameState.getStatus() === GameStatus.PLAYING ? 0.016 : 0);

    this.updateEnemyHealthBars();
  }

  private updateEnemyHealthBars(): void {
    const enemies = this.enemySystem.getEnemies();
    const friendlies = this.enemySystem.getFriendlyAIs();

    const enemyData = enemies
      .filter((e) => e.isAlive())
      .map((e) => ({
        mesh: e.getMesh(),
        currentHealth: e.getHealth().current,
        maxHealth: e.getConfig().health,
      }));

    const friendlyData = friendlies
      .filter((f) => f.isAlive())
      .map((f) => ({
        mesh: f.getMesh(),
        currentHealth: f.getHealth().current,
        maxHealth: f.getHealth().max,
      }));

    // Boss 血条数据
    const bossData: Array<{ mesh: THREE.Object3D; currentHealth: number; maxHealth: number }> = [];
    if (this.bossMode && this.currentBoss && this.currentBoss.isAlive()) {
      bossData.push({
        mesh: this.currentBoss.getMesh(),
        currentHealth: this.currentBoss.getHealth().current,
        maxHealth: this.currentBoss.getHealth().max,
      });
    }

    this.enemyHealthBars.update(
      [...enemyData, ...bossData],
      friendlyData,
      this.gameScene.camera,
      this.playerSystem.getPosition()
    );
  }

  private updateMissileRespawn(deltaTime: number): void {
    if (this.missileCount < GAME_CONSTANTS.MISSILE.MAX_RESPAWN_MISSILES) {
      this.missileRespawnTimer += deltaTime;
      if (this.missileRespawnTimer >= GAME_CONSTANTS.MISSILE.MISSILE_RESPAWN_TIME) {
        this.missileCount++;
        this.hud.updateMissiles(this.missileCount);
        this.missileRespawnTimer = 0;
      }
    }

    this.hud.updateMissileProgress(
      this.missileRespawnTimer / GAME_CONSTANTS.MISSILE.MISSILE_RESPAWN_TIME
    );
  }

  private render(): void {
    this.thirdPersonCamera.update();
    this.gameScene.render();
  }

  public start(): void {
    this.gameState.setStatus(GameStatus.PLAYING);
    this.playerSystem.getHealth().reset();

    if (!this.audioInitialized) {
      this.audioManager.resume();
      this.musicSystem.resume();
      this.audioInitialized = true;
    }

    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.hud.updateMissiles(this.missileCount);

    this.gameLoop.start(
      (dt) => this.update(dt),
      () => this.render()
    );
    this.audioManager.startEngine();

    if (this.bossMode) {
      this.startBossBattle();
    } else {
      this.enemySystem.loadLevel(this.currentLevelId);

      setTimeout(() => {
        this.enemySystem.startWave(this.playerSystem.getPosition());
      }, GAME_CONSTANTS.LEVEL.START_DELAY * 1000);

      this.musicSystem.playLevelMusic(this.getLevelMusic(this.currentLevelId));

      setTimeout(() => {
        this.spawnFriendlyAI();
        this.hud.showPowerUpBig('✈️', '召唤友军');
      }, 1000);
    }
  }

  private startBossBattle(): void {
    this.musicSystem.playBossMusic();

    // 加载当前关卡的地形
    this.enemySystem.loadLevel(this.currentLevelId);

    const bossType = getBossForLevel(this.currentLevelId);
    if (!bossType) return;

    const config = BOSS_CONFIGS[bossType];
    const mesh = createBossMesh(config);

    const playerPos = this.playerSystem.getPosition();
    const spawnOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    mesh.position.copy(playerPos).add(spawnOffset);

    this.gameScene.scene.add(mesh);

    this.currentBoss = new BossAI(mesh, config, this.gameScene.scene, this.particleSystem);

    this.currentBoss.onFire = (position, direction, damage) => {
      this.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, this.currentBoss?.getMesh(), Faction.ENEMY);
      this.audioManager.playShoot();
    };

    this.currentBoss.onDestroy = (position, bossConfig) => {
      this.audioManager.playExplosion();
      this.particleSystem.createExplosion(position, config.scale);
      this.gameState.addScore(bossConfig.scoreValue);
      this.playerStats.addScore(bossConfig.scoreValue);

      this.bossIndicator.clear();

      if (this.currentBoss) {
        this.currentBoss.getMissileSystem().dispose();
      }

      for (const friendly of this.enemySystem.getFriendlyAIs()) {
        friendly.dispose();
      }
      this.enemySystem['friendlyAIs'] = [];

      this.combatSystem.getPlayerProjectilePool().clear();
      this.combatSystem.getEnemyProjectilePool().clear();
      this.particleSystem.clear();

      this.hud.showPowerUpBig('🏆', 'Boss 已击败！');
      this.currentBoss = null;

      setTimeout(() => {
        this.currentLevelId++;
        if (this.currentLevelId <= 5) {
          this.hud.showPowerUpBig('⏭️', `进入第 ${this.currentLevelId} 关`);
          setTimeout(() => {
            this.startBossBattle();
          }, 2000);
        } else {
          this.gameState.setStatus(GameStatus.GAME_OVER);
          this.musicSystem.stopMusic();
          this.hud.showGameOver(this.gameState.getScore());
        }
      }, 1000);
    };

    this.currentBoss.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };

    this.bossFriendlySpawnTimer = 0;

    setTimeout(() => {
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '召唤友军');
    }, 1000);
  }

  private startLevelBossBattle(): void {
    this.inLevelBossBattle = true;
    this.musicSystem.playBossMusic();

    const bossType = getBossForLevel(this.currentLevelId);
    if (!bossType) return;

    const config = BOSS_CONFIGS[bossType];
    const mesh = createBossMesh(config);

    const playerPos = this.playerSystem.getPosition();
    const spawnOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    mesh.position.copy(playerPos).add(spawnOffset);

    this.gameScene.scene.add(mesh);

    this.currentBoss = new BossAI(mesh, config, this.gameScene.scene, this.particleSystem);

    this.currentBoss.onFire = (position, direction, damage) => {
      this.combatSystem
        .getBossProjectilePool()
        .fire(position, direction, damage, this.currentBoss?.getMesh(), Faction.ENEMY);
      this.audioManager.playShoot();
    };

    this.currentBoss.onDestroy = (position, bossConfig) => {
      this.audioManager.playExplosion();
      this.particleSystem.createExplosion(position, config.scale);
      this.gameState.addScore(bossConfig.scoreValue);
      this.playerStats.addScore(bossConfig.scoreValue);

      this.bossIndicator.clear();

      if (this.currentBoss) {
        this.currentBoss.getMissileSystem().dispose();
      }

      for (const friendly of this.enemySystem.getFriendlyAIs()) {
        friendly.dispose();
      }
      this.enemySystem['friendlyAIs'] = [];

      this.combatSystem.getPlayerProjectilePool().clear();
      this.combatSystem.getEnemyProjectilePool().clear();
      this.particleSystem.clear();

      this.hud.showPowerUpBig('🏆', 'Boss 已击败！');
      this.currentBoss = null;
      this.inLevelBossBattle = false;

      setTimeout(() => {
        this.currentLevelId++;
        if (this.currentLevelId <= 5) {
          this.hud.showPowerUpBig('⏭️', `进入第 ${this.currentLevelId} 关`);
          this.enemySystem.loadLevel(this.currentLevelId);
          this.hud.updateRemainingEnemies(this.enemySystem.getTotalEnemyCount());

          setTimeout(() => {
            this.musicSystem.playLevelMusic(this.getLevelMusic(this.currentLevelId));
            this.enemySystem.startWave(this.playerSystem.getPosition());
          }, 2000);
        } else {
          this.gameState.setStatus(GameStatus.GAME_OVER);
          this.musicSystem.stopMusic();
          this.hud.showGameOver(this.gameState.getScore());
        }
      }, 1000);
    };

    this.currentBoss.onMissileFired = () => {
      this.audioManager.playMissileLaunch();
    };

    this.bossFriendlySpawnTimer = 0;

    setTimeout(() => {
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '召唤友军');
    }, 1000);
  }

  public stop(): void {
    this.gameLoop.stop();
    this.audioManager.stopEngine();
    this.musicSystem.stopMusic();
  }

  private getLevelMusic(levelId: number): LevelMusic {
    const levelMusicMap: Record<number, LevelMusic> = {
      1: LevelMusic.LAKE,
      2: LevelMusic.DESERT,
      3: LevelMusic.SNOW,
      4: LevelMusic.OCEAN,
      5: LevelMusic.CITY,
    };
    return levelMusicMap[levelId] || LevelMusic.LAKE;
  }

  public dispose(): void {
    this.stop();
    this.enemySystem.dispose();
    this.particleSystem.clear();
    this.powerUpSystem.dispose();
    this.gameScene.dispose();
    this.musicSystem.dispose();
    EventBus.clear();
  }
}
