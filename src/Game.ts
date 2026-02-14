import * as THREE from 'three';
import { GameLoop } from '@/core/GameLoop';
import { GameScene } from '@/scenes/GameScene';
import { InputHandler } from '@/core/Input/InputHandler';
import { PlayerController } from '@/features/player/PlayerController';
import { ThirdPersonCamera } from '@/features/camera/ThirdPersonCamera';
import { ProjectilePool } from '@/features/combat/ProjectilePool';
import { HealthSystem } from '@/features/combat/HealthSystem';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { HUD } from '@/ui/HUD';
import { StartMenu } from '@/ui/StartMenu';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { GameState, GameStatus } from '@/core/GameState';
import { GAME_CONSTANTS } from '@/config';
import { LevelManager } from '@/features/levels/LevelManager';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { AudioManager } from '@/core/Audio/AudioManager';
import { PowerUpManager, PowerUpType, POWER_UP_CONFIGS, PowerUpConfig } from '@/features/powerups/PowerUpSystem';
import { BalloonPowerUp } from '@/features/powerups/BalloonPowerUp';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { Faction, areHostile } from '@/core/Faction';

/**
 * 主游戏类 - 完整版
 */
export class Game {
  // 核心系统
  private gameLoop: GameLoop;
  private gameScene: GameScene;
  private inputHandler: InputHandler;
  private gameState: GameState;

  // 游戏对象
  private playerAircraft: THREE.Group;
  private playerController: PlayerController;
  private playerHealth: HealthSystem;
  private playerStats: PlayerStats;
  private thirdPersonCamera: ThirdPersonCamera;
  private playerProjectilePool: ProjectilePool;
  private enemyProjectilePool: ProjectilePool;

  // 新系统
  private levelManager: LevelManager;
  private particleSystem: ParticleSystem;
  private audioManager: AudioManager;
  private powerUpManager: PowerUpManager;
  private friendlyAIs: FriendlyAI[] = []; // 友军列表

  // UI
  private hud: HUD;
  private startMenu: StartMenu;
  private lockOnIndicator: LockOnIndicator;
  private enemyHealthBars: EnemyHealthBars;

  // 射击控制
  private fireCooldown: number = 0;

  // 导弹系统
  private missileSystem: MissileSystem;
  private missileCount: number = 2;
  private missileFiringScheduled: boolean = false; // 防止重复发射
  private missileRespawnTimer: number = 0; // 导弹补给计时器

  // 关卡进度
  private currentLevelId: number = 1;
  private waveDelayTimer: number = 0;

  // 护盾效果
  private shieldMesh?: THREE.Mesh;
  private shieldActive: boolean = false;

  // 生命系统
  private lives: number = 3;
  private isRespawning: boolean = false;
  private respawnTimer: number = 0;
  private respawnDelay: number = 2;
  private deathPosition?: THREE.Vector3; // 存储死亡位置

  // 音频初始化标志
  private audioInitialized: boolean = false;

  constructor() {
    // 初始化核心系统
    this.gameLoop = new GameLoop();
    this.gameScene = new GameScene();
    this.inputHandler = new InputHandler();
    this.gameState = new GameState();
    this.playerStats = new PlayerStats();

    // 创建玩家
    this.playerAircraft = this.createPlayerAircraft();
    this.playerController = new PlayerController(this.playerAircraft, this.gameScene.scene);
    this.playerHealth = new HealthSystem(this.playerStats.getMaxHealth());

    // 设置相机
    this.thirdPersonCamera = new ThirdPersonCamera(
      this.gameScene.camera,
      this.playerAircraft
    );

    // 创建子弹池
    this.playerProjectilePool = new ProjectilePool(this.gameScene.scene);
    this.enemyProjectilePool = new ProjectilePool(this.gameScene.scene);

    // 初始化新系统
    this.levelManager = new LevelManager(this.gameScene.scene);
    this.particleSystem = new ParticleSystem(this.gameScene.scene);
    this.audioManager = new AudioManager();
    this.powerUpManager = new PowerUpManager(this.gameScene.scene, this.particleSystem);

    // 创建 UI
    this.hud = new HUD();
    this.lockOnIndicator = new LockOnIndicator();

    // 创建导弹系统
    this.missileSystem = new MissileSystem(this.gameScene.scene, this.particleSystem);

    // 创建敌人血条系统
    this.enemyHealthBars = new EnemyHealthBars();

    // 初始化开始菜单
    this.startMenu = new StartMenu();

    // 设置回调
    this.setupCallbacks();

    // 显示开始菜单
    this.startMenu.setOnStart((settings) => {
      this.lives = settings.playerLives;
      this.audioManager.setSFXVolume(settings.soundVolume);
      // 实际开始游戏
      this.gameState.start();
      this.start();
    });
  }

  /**
   * 设置回调
   */
  private setupCallbacks(): void {
    // 玩家生命值回调
    this.playerHealth.onDamage = () => {
      if (!this.shieldActive && !this.isRespawning) {
        this.audioManager.playHit();
        this.particleSystem.createHit(this.playerAircraft.position);
      }
    };

    this.playerHealth.onDeath = () => {
      this.onPlayerDeath();
    };

    // 关卡回调
    this.levelManager.onWaveStart = (wave) => {
      this.audioManager.playWaveStart();
      console.log(`第 ${wave} 波开始！`);
    };

    this.levelManager.onWaveComplete = (wave) => {
      console.log(`第 ${wave} 波完成！`);
      this.waveDelayTimer = GAME_CONSTANTS.LEVEL.WAVE_DELAY;
    };

    this.levelManager.onLevelComplete = (level) => {
      this.audioManager.playLevelUp();
      console.log(`关卡 ${level} 完成！`);
    };

    this.levelManager.onEnemySpawned = (enemy) => {
      enemy.onFire = (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => {
        this.fireAIProjectile(position, direction, Faction.ENEMY, damage); // 标记为敌军子弹，传入伤害
      };

      enemy.onDestroy = () => {
        const config = enemy.getConfig();
        const enemyPos = enemy.getPosition().clone();
        this.gameState.addScore(config.scoreValue);
        this.playerStats.addScore(config.scoreValue);

        this.audioManager.playExplosion();
        this.particleSystem.createExplosion(enemyPos, config.scale);

        // 随机掉落道具
        if (Math.random() < GAME_CONSTANTS.POWERUP.SPAWN_CHANCE) {
          this.powerUpManager.spawn(enemyPos);
        }

        // 恢复一枚导弹（已取消）
        // if (this.missileCount < this.maxMissiles) {
        //   this.missileCount++;
        //   this.hud.updateMissiles(this.missileCount);
        // }

        // 清理敌人资源
        enemy.dispose();
      };
    };

    // 道具回调
    this.powerUpManager.onPowerUpCollected = (type, config) => {
      this.audioManager.playPowerUp();
      console.log(`获得道具: ${config.name}`);

      // 显示道具提示
      this.hud.showPowerUp(config.name, config.icon, config.duration);

      // 即时效果
      if (type === PowerUpType.HEALTH) {
        this.playerHealth.heal(config.value);
      } else if (type === PowerUpType.SHIELD) {
        this.activateShield();
      }
    };

    this.powerUpManager.onPowerUpExpired = (type) => {
      if (type === PowerUpType.SHIELD) {
        this.deactivateShield();
      }
    };

    this.powerUpManager.onBombUsed = () => {
      // 召唤友军
      this.spawnFriendlyAI();
      console.log('召唤友军！');
    };
  }

  /**
   * 发射AI子弹（敌军或友军）
   * @param position 发射位置
   * @param direction 射击方向
   * @param fromFaction 子弹来源阵营
   * @param damage 伤害值
   */
  private fireAIProjectile(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    fromFaction: Faction,
    damage: number = 10
  ): void {
    // 找到发射者（根据position推断）
    let owner: THREE.Object3D | undefined;
    const minDist = 10; // 10米内认为是发射者

    if (fromFaction === Faction.FRIENDLY) {
      // 从友军中找
      for (const friendly of this.friendlyAIs) {
        if (friendly.isAlive() && friendly.getMesh().position.distanceTo(position) < minDist) {
          owner = friendly.getMesh();
          break;
        }
      }
    } else if (fromFaction === Faction.ENEMY) {
      // 从敌人中找
      const enemies = this.levelManager.getEnemies();
      for (const enemy of enemies) {
        if (enemy.isAlive() && enemy.getMesh().position.distanceTo(position) < minDist) {
          owner = enemy.getMesh();
          break;
        }
      }
    }

    // 发射子弹，传入发射者和伤害
    this.enemyProjectilePool.fire(position, direction, damage, owner);
  }

  /**
   * 更新友军
   */
  private updateFriendlyAIs(deltaTime: number, enemyMeshes: THREE.Object3D[]): void {
    console.log(`[Game] updateFriendlyAIs 被调用, 友军数量: ${this.friendlyAIs.length}, 敌人数: ${enemyMeshes.length}`);

    for (let i = this.friendlyAIs.length - 1; i >= 0; i--) {
      const friendly = this.friendlyAIs[i];

      if (friendly.isAlive()) {
        // 更新友军AI
        friendly.update(deltaTime, enemyMeshes);
      } else {
        // 移除已死亡的友军
        this.friendlyAIs.splice(i, 1);
      }
    }
  }

  /**
   * 创建飞机模型（复用LevelManager逻辑）
   */
  private createAircraftMesh(config: any): THREE.Group {
    const group = new THREE.Group();

    // 根据敌人类型定义配色和尺寸
    let bodyColor: number, wingColor: number, accentColor: number;
    let bodySize = 1.6, bodyLength = 6, wingSpan = 3, tailSize = 0.8;
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

    // 应用整体缩放
    group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);

    // 创建机身
    const bodyGeometry = new THREE.CylinderGeometry(bodySize * 0.4, bodySize * 0.3, bodyLength, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.7,
      roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    // 创建机头锥
    const noseGeometry = new THREE.ConeGeometry(bodySize * 0.3, bodyLength * 0.25, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.8,
      roughness: 0.2
    });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI / 2;
    nose.position.set(0, 0, bodyLength / 2 + 0.5);
    nose.castShadow = true;
    group.add(nose);

    // 创建主翼
    const wingGeometry = new THREE.BoxGeometry(wingSpan, 0.15, 1.2);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      metalness: 0.6,
      roughness: 0.4
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, -0.8);
    wings.castShadow = true;
    group.add(wings);

    // 创建座舱盖
    const cockpitGeometry = new THREE.SphereGeometry(bodySize * 0.35, 8, 8);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.9,
      roughness: 0.1,
      emissive: accentColor,
      emissiveIntensity: 0.3
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, bodySize * 0.25, 0.5);
    cockpit.castShadow = true;
    group.add(cockpit);

    // 创建尾翼
    const tailGeometry = new THREE.BoxGeometry(tailSize, 0.12, 1);
    const tailMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      metalness: 0.6,
      roughness: 0.4
    });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0, -bodyLength / 2 - 0.3);
    tail.castShadow = true;
    group.add(tail);

    // 创建垂直尾翼
    const vStabGeometry = new THREE.BoxGeometry(0.15, 1.2, 0.8);
    const vStab = new THREE.Mesh(vStabGeometry, tailMaterial);
    vStab.position.set(0, 0.6, -bodyLength / 2 + 0.1);
    vStab.castShadow = true;
    group.add(vStab);

    // 创建引擎喷口
    const engineGeometry = new THREE.CylinderGeometry(bodySize * 0.2, bodySize * 0.15, 0.5, 8);
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8
    });
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, 0, -bodyLength / 2 - 0.8);
    group.add(engine);

    // 设置名称（友军标记）
    switch (config.type) {
      case EnemyType.SCOUT:
        group.name = 'Scout-Friendly';
        break;
      case EnemyType.FIGHTER:
        group.name = 'Fighter-Friendly';
        break;
      case EnemyType.HEAVY:
        group.name = 'Heavy-Friendly';
        break;
      case EnemyType.SNIPER:
        group.name = 'Sniper-Friendly';
        break;
      case EnemyType.ACE:
        group.name = 'Ace-Friendly';
        break;
    }

    return group;
  }

  /**
   * 召唤友军飞机
   */
  private spawnFriendlyAI(): void {
    console.log('[DEBUG] spawnFriendlyAI() 被调用！当前友军数量:', this.friendlyAIs.length);
    console.trace('[DEBUG] 调用栈追踪：');

    // 随机选择一种敌人类型
    const enemyTypes = Object.values(EnemyType);
    const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const config = ENEMY_CONFIGS[randomType];

    // 创建友军飞机模型
    const mesh = this.createAircraftMesh(config);
    console.log('[友军] 创建飞机模型，config:', config.name);
    const friendly = new FriendlyAI(mesh, config, this.gameScene.scene);
    console.log('[友军] 友军AI实例创建完成');

    // 设置友军位置（在玩家附近）
    const playerPos = this.playerController.getPosition();
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 100
    );
    mesh.position.copy(playerPos).add(offset);

    // 添加到场景
    this.gameScene.scene.add(mesh);
    this.friendlyAIs.push(friendly);

    // 设置射击回调（使用 fireAIProjectile 以标记友军子弹和伤害）
    friendly['enemy'].onFire = (position: THREE.Vector3, direction: THREE.Vector3, damage: number) => {
      this.fireAIProjectile(position, direction, Faction.FRIENDLY, damage); // 标记为友军子弹，传入伤害
    };

    // 设置敌人AI内部的死亡回调，用于清理友军
    const enemyAI = friendly['enemy'] as any;
    const originalOnDeath = enemyAI.health.onDeath;
    enemyAI.health.onDeath = () => {
      // 调用原始死亡回调
      if (originalOnDeath) originalOnDeath();

      // 移除友军
      const index = this.friendlyAIs.indexOf(friendly);
      if (index !== -1) {
        this.friendlyAIs.splice(index, 1);
      }
      friendly.dispose(this.gameScene.scene);

      // 播放爆炸效果
      this.particleSystem.createExplosion(mesh.position.clone(), 1);
      this.audioManager.playExplosion();

      console.log('友军被击落');
    };
  }

  /**
   * 气球销毁处理方法
   */
  private onBalloonDestroyed(_balloon: BalloonPowerUp, type: PowerUpType, config: PowerUpConfig): void {
    console.log(`气球被打破: ${config.name}`);

    // 播放气球打破音效
    this.audioManager.playBalloonPop();

    // 先显示UI（确保总是显示）
    // 屏幕中央大字提示（至少显示1秒）
    this.hud.showPowerUpBig(config.icon, config.name, 1);

    // 右上角也显示提示（仅持续效果道具）
    if (config.duration > 0) {
      this.hud.showPowerUp(config.name, config.icon, config.duration);
    }

    // 再激活道具效果
    this.powerUpManager.addActivePowerUp(type, config);

    // 爆炸效果已在 PowerUpSystem.checkProjectileCollisions 中创建，避免重复
    // 气球已在 PowerUpSystem.checkProjectileCollisions 中移除，无需重复移除
  }

  /**
   * 玩家死亡处理
   */
  private onPlayerDeath(): void {
    this.lives--;

    // 存储死亡位置（用于原地复活）
    this.deathPosition = this.playerAircraft.position.clone();

    // 停止引擎声
    this.audioManager.stopEngine();

    // 播放爆炸效果
    this.audioManager.playExplosion();
    this.particleSystem.createExplosion(this.playerAircraft.position.clone(), 2);

    // 取消导弹锁定
    this.lockOnIndicator.cancelLockOn();

    // 隐藏飞机
    this.playerAircraft.visible = false;

    if (this.lives <= 0) {
      // 游戏结束 - 显示游戏结束画面
      this.gameState.setStatus(GameStatus.GAME_OVER);
      this.audioManager.playGameOver();
      this.hud.showGameOver(this.gameState.getScore());
      console.log('游戏结束！最终得分:', this.gameState.getScore());
    } else {
      // 开始复活
      this.isRespawning = true;
      this.respawnTimer = this.respawnDelay;
      console.log(`剩余生命: ${this.lives}`);
    }
  }

  /**
   * 复活玩家
   */
  private respawnPlayer(): void {
    // 重置生命值
    this.playerHealth.reset();

    // 在死亡位置重生（不重置位置到原点）
    if (this.deathPosition) {
      this.playerAircraft.position.copy(this.deathPosition);
    }

    // 重置旋转（让飞机保持水平）
    this.playerAircraft.rotation.set(0, 0, 0);
    this.playerAircraft.quaternion.set(0, 0, 0, 1);

    // 播放重生动画效果（光柱效果）
    this.particleSystem.createExplosion(this.playerAircraft.position.clone(), 1.5);

    // 显示飞机
    this.playerAircraft.visible = true;

    // 重置导弹数量
    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.hud.updateMissiles(this.missileCount);

    // 自动激活10秒护盾
    this.powerUpManager.addActivePowerUp(PowerUpType.SHIELD, POWER_UP_CONFIGS[PowerUpType.SHIELD]);

    // 重新开始引擎声
    this.audioManager.startEngine();

    this.isRespawning = false;

    console.log('原地复活成功！');
  }

  /**
   * 激活护盾
   */
  private activateShield(): void {
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
      this.gameScene.scene.add(this.shieldMesh);
    }

    this.shieldMesh.visible = true;
  }

  /**
   * 停用护盾
   */
  private deactivateShield(): void {
    this.shieldActive = false;
    if (this.shieldMesh) {
      this.shieldMesh.visible = false;
    }
  }

  /**
   * 创建玩家飞机
   */
  private createPlayerAircraft(): THREE.Group {
    const group = new THREE.Group();

    // 机身 - 更精美的设计
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.7,
      roughness: 0.2,
    });

    // 主机身
    const bodyGeometry = new THREE.ConeGeometry(0.5, 3.5, 12);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // 驾驶舱
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

    // 机翼
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x3366dd,
      metalness: 0.6,
      roughness: 0.3,
    });

    // 三角翼设计
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2, 0.8);
    wingShape.lineTo(0.3, 1);
    wingShape.lineTo(0, 0);

    const wingExtrudeSettings = { depth: 0.05, bevelEnabled: false };
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.rotation.z = Math.PI;
    leftWing.position.set(-0.3, 0, 0.3);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.position.set(0.3, 0, 0.3);
    group.add(rightWing);

    // 垂直尾翼
    const tailGeometry = new THREE.BoxGeometry(0.05, 0.8, 0.6);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0.5, 1.5);
    group.add(tail);

    // 引擎喷射效果
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

    // 启用阴影
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name !== 'engineGlow') {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.gameScene.scene.add(group);
    return group;
  }

  /**
   * 更新游戏逻辑
   */
  private update(deltaTime: number): void {
    if (this.gameState.getStatus() !== GameStatus.PLAYING) {
      return;
    }

    // 更新复活计时器
    if (this.isRespawning) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.respawnPlayer();
      }
      // 不要 return - 继续更新镜头和粒子系统，让爆炸动画播放完
    }

    // 更新敌人指示器
    const enemies = this.levelManager.getEnemies()
      .filter(e => e.isAlive())
      .map(e => e.getMesh());

    // 更新敌人血条
    this.updateEnemyHealthBars(enemies);

    const input = this.inputHandler.getState();

    // 只在非复活期间更新玩家控制
    if (!this.isRespawning) {
      // 更新玩家
      this.playerController.update(deltaTime, input);

      // 检测坠机（撞击地面）
      const playerPos = this.playerController.getPosition();
      const GROUND_LEVEL = -45; // 地面高度阈值
      if (playerPos.y < GROUND_LEVEL && this.gameState.isPlaying()) {
        // 玩家撞击地面 - 立即死亡
        this.playerHealth.takeDamage(1000); // 造成致命伤害
        this.audioManager.playExplosion();
        this.particleSystem.createExplosion(playerPos.clone(), 3);
      }

      // 更新射击冷却
      const fireRate = this.playerStats.getFireRate();
      this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);

      // 玩家射击
      if (input.fire && this.fireCooldown <= 0) {
        this.playerFire();
        this.fireCooldown = fireRate;
      }

      // 导弹锁定和发射逻辑
      this.handleMissileInput(input, enemies);
    }

    // 更新子弹
    this.playerProjectilePool.update(deltaTime);
    this.enemyProjectilePool.update(deltaTime);

    // 更新导弹
    this.missileSystem.update(deltaTime);

    // 更新关卡（传入友军meshes让敌机可以选择目标）
    const friendlyMeshes = this.friendlyAIs.map(f => f.getMesh());
    this.levelManager.update(deltaTime, this.playerController.getPosition(), friendlyMeshes);

    // 更新友军
    this.updateFriendlyAIs(deltaTime, enemies);

    // 波次延迟
    if (this.waveDelayTimer > 0) {
      this.waveDelayTimer -= deltaTime;
      if (this.waveDelayTimer <= 0) {
        this.levelManager.startWave();
      }
    }

    // 检查玩家子弹碰撞
    const enemyMeshes = this.levelManager.getEnemies()
      .filter(e => e.isAlive())
      .map(e => e.getMesh());

    // 更新导弹系统的敌人列表（用于导弹重新锁定目标）
    this.missileSystem.updateEnemies(enemyMeshes);

    const damageMultiplier = this.powerUpManager.hasEffect(PowerUpType.DAMAGE)
      ? POWER_UP_CONFIGS[PowerUpType.DAMAGE].value
      : 1;

    this.playerProjectilePool.checkCollisions(
      enemyMeshes,
      (target) => {
        const enemy = this.levelManager.getEnemies().find(e => e.getMesh() === target);
        if (enemy) {
          const damage = this.playerStats.getDamage(damageMultiplier);
          enemy.takeDamage(damage);
        }
      }
    );

    // 检查导弹碰撞
    this.missileSystem.checkCollisions(
      enemyMeshes,
      (target) => {
        const enemy = this.levelManager.getEnemies().find(e => e.getMesh() === target);
        if (enemy) {
          // 导弹伤害也受到伤害加强道具的影响
          const missileDamageMultiplier = this.powerUpManager.hasEffect(PowerUpType.DAMAGE)
            ? POWER_UP_CONFIGS[PowerUpType.DAMAGE].value
            : 1;
          const missileDamage = GAME_CONSTANTS.MISSILE.DAMAGE * missileDamageMultiplier;
          enemy.takeDamage(missileDamage);
          this.audioManager.playMissileExplosion();
          this.particleSystem.createExplosion(target.position.clone(), 2);
        }
      }
    );

    // ========================================
    // AI子弹碰撞检测（统一阵营系统）
    // ========================================

    // 获取所有AI目标
    const playerTarget = { mesh: this.playerAircraft, faction: Faction.NEUTRAL };
    const enemyTargets = this.levelManager.getEnemies().map(e => ({
      mesh: e.getMesh(),
      faction: Faction.ENEMY,
      ai: e
    } as any));
    const friendlyTargets = this.friendlyAIs.map(f => ({
      mesh: f.getMesh(),
      faction: Faction.FRIENDLY,
      ai: f
    } as any));

    // 合并所有目标
    const allTargets: any[] = [
      playerTarget,
      ...enemyTargets,
      ...friendlyTargets
    ];

    // 检查AI子弹碰撞
    this.enemyProjectilePool.checkCollisions(
      allTargets.map(t => t.mesh),
      (hitObject, _projectileMesh, damage) => {
        // 找到命中的子弹（不检查 active，因为 checkCollisions 已将其设为 inactive）
        const projectile = this.enemyProjectilePool['pool'].find((p: any) => p.mesh === hitObject);
        if (!projectile) return;

        const fromFaction = projectile.mesh.userData.faction;
        if (!fromFaction) {
          console.warn('AI子弹没有阵营标识，忽略碰撞');
          return;
        }

        // 找到命中的目标
        const target = allTargets.find(t => t.mesh === hitObject);
        if (!target) return;

        // 检查敌对关系
        if (areHostile(fromFaction, target.faction)) {
          // 敌对关系，造成伤害
          if (target.faction === Faction.NEUTRAL && !this.shieldActive) {
            // 命中玩家
            this.playerHealth.takeDamage(damage);
          } else if (target.faction === Faction.ENEMY) {
            // 命中敌军
            target.ai.takeDamage(damage);
          } else if (target.faction === Faction.FRIENDLY) {
            // 命中友军
            const friendlyAI = this.friendlyAIs.find(f => f.getMesh() === hitObject);
            if (friendlyAI && friendlyAI.isAlive()) {
              friendlyAI.takeDamage(damage);
            }
          }
        }
      }
    );

    // 更新道具
    this.powerUpManager.update(deltaTime);

    // 检测子弹与气球的碰撞
    const activeProjectiles = this.playerProjectilePool.getActiveProjectiles();
    const projectilePositions = activeProjectiles.map(p => p.position);
    this.powerUpManager.checkProjectileCollisions(
      projectilePositions,
      (balloon, type) => {
        const config = POWER_UP_CONFIGS[type];
        this.onBalloonDestroyed(balloon, type, config);
      }
    );

    // 检测玩家与气球的碰撞
    this.powerUpManager.checkPlayerCollisions(
      this.playerController.getPosition(),
      (_type, config) => {
        console.log(`收集到道具: ${config.name}`);
        // 触发道具效果（气球已在 checkPlayerCollisions 中移除）
        // 气球已在 PowerUpSystem.checkPlayerCollisions 中移除，无需重复移除
      }
    );

    // 更新粒子
    this.particleSystem.update(deltaTime);

    // 更新护盾位置
    if (this.shieldMesh && this.shieldActive) {
      this.shieldMesh.position.copy(this.playerAircraft.position);
    }

    // 更新引擎声
    this.audioManager.updateEngine(this.playerController.getSpeed());

    // 更新引擎喷射效果
    const engineGlow = this.playerAircraft.getObjectByName('engineGlow');
    if (engineGlow) {
      const scale = 0.5 + (this.playerController.getSpeed() / 100) * 1;
      engineGlow.scale.setScalar(scale);
    }

    // 更新相机
    this.thirdPersonCamera.update();

    // 更新敌人血条
    this.updateEnemyHealthBars(enemies);

    // 更新 HUD
    this.hud.updateHealth(this.playerHealth.getHealthPercent() / (this.playerStats.getMaxHealth() / 100));
    this.hud.updateSpeed(this.playerController.getSpeed());
    this.hud.updateScore(this.gameState.getScore());
    this.hud.updateEnemies(this.levelManager.getAliveEnemyCount());
    // 剩余敌人 = 总敌人数 - 已生成数
    const remainingEnemies = this.levelManager.getTotalEnemyCount() - this.levelManager.getSpawnedEnemyCount();
    this.hud.updateRemainingEnemies(remainingEnemies);
    this.hud.updateLives(this.lives);

    // 更新道具倒计时和大字提示（添加缺失的 update 调用）
    this.hud.update(deltaTime);

    // 更新导弹补给计时器
    if (this.missileCount < GAME_CONSTANTS.MISSILE.MAX_RESPAWN_MISSILES) {
      this.missileRespawnTimer += deltaTime;
      if (this.missileRespawnTimer >= GAME_CONSTANTS.MISSILE.MISSILE_RESPAWN_TIME) {
        // 时间到，增加一个导弹
        this.missileCount++;
        this.hud.updateMissiles(this.missileCount);
        this.missileRespawnTimer = 0;
        console.log(`导弹补给！当前: ${this.missileCount}/${GAME_CONSTANTS.MISSILE.MAX_RESPAWN_MISSILES}`);
      }
    }

    // 更新导弹补给进度条
    this.hud.updateMissileProgress(this.missileRespawnTimer / GAME_CONSTANTS.MISSILE.MISSILE_RESPAWN_TIME);
  }

  /**
   * 更新敌人血条（包括友军）
   */
  private updateEnemyHealthBars(_enemyMeshes: THREE.Object3D[]): void {
    // 获取敌人 AI 实例
    const enemies = this.levelManager.getEnemies();
    const aliveEnemies = enemies.filter(e => e.isAlive());

    // 获取友军 AI 实例
    const aliveFriendlies = this.friendlyAIs.filter(f => f.isAlive());

    // 构建敌人血条更新数据
    const enemyHealthData = aliveEnemies.map(enemy => {
      const health = enemy.getHealth();
      const config = enemy.getConfig();
      const mesh = enemy.getMesh();

      return {
        mesh,
        currentHealth: health.current,
        maxHealth: config.health
      };
    });

    // 构建友军血条更新数据
    const friendlyHealthData = aliveFriendlies.map(friendly => {
      const health = friendly.getHealth();
      const mesh = friendly.getMesh();

      return {
        mesh,
        currentHealth: health.current,
        maxHealth: health.max
      };
    });

    // 更新血条系统（敌人和友军）
    this.enemyHealthBars.update(
      enemyHealthData,
      friendlyHealthData,
      this.gameScene.camera,
      this.playerController.getPosition()
    );
  }

  /**
   * 世界坐标转屏幕坐标
   */

  /**
   * 处理导弹输入和锁定逻辑
   */
  private handleMissileInput(input: any, enemyMeshes: THREE.Object3D[]): void {
    // 获取第一个敌人的UI屏幕位置
    const enemyScreenPos = this.enemyHealthBars.getFirstEnemyScreenPos();

    // 检查导弹数量和玩家输入
    if (this.missileCount <= 0) {
      // 导弹为0且玩家按下M键时，显示"NO MISSILE"
      if (input.missile) {
        this.lockOnIndicator.setNoMissiles(true);
        return;
      } else {
        this.lockOnIndicator.setNoMissiles(false);
      }
    } else {
      this.lockOnIndicator.setNoMissiles(false);
    }

    // 更新锁定状态
    if (this.lockOnIndicator.isLocking()) {
      const lockComplete = this.lockOnIndicator.update(
        this.playerController.getPosition(),
        enemyMeshes,
        this.gameScene.camera,
        0.016,  // 假设 60fps
        enemyScreenPos  // 传递敌人UI屏幕位置
      );

      if (lockComplete) {
        // 锁定完成，等待 0.2 秒后自动发射导弹
        const lockedTarget = this.lockOnIndicator.getCurrentTarget();
        if (lockedTarget && this.missileCount > 0 && !this.missileFiringScheduled) {
          // 标记已调度，防止重复
          this.missileFiringScheduled = true;

          // 延迟 0.2 秒发射
          setTimeout(() => {
            this.fireMissile(lockedTarget);
            // 导弹发射后，重置锁定系统和调度标志
            this.lockOnIndicator.onMissileFired();
            this.missileFiringScheduled = false;
          }, 200);
        }
      }
    } else if (input.missile) {
      // 开始锁定
      this.audioManager.playMissileLock();
      this.lockOnIndicator.setNoMissiles(false); // 隐藏"NO MISSILE"
      this.lockOnIndicator.startLockOn();
    } else {
      // 取消锁定
      this.lockOnIndicator.cancelLockOn();
    }
  }

  /**
   * 发射导弹
   */
  private fireMissile(target?: THREE.Object3D): void {
    if (this.missileCount <= 0) return;

    const position = this.playerController.getPosition().clone();
    const quaternion = this.playerController.getQuaternion();

    // 座舱在本地坐标系中的位置 (机头位置)
    const cockpitOffset = new THREE.Vector3(0, 0.3, -0.5);
    cockpitOffset.applyQuaternion(quaternion);
    position.add(cockpitOffset);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);

    // 检查多重射击
    const missileCount = this.powerUpManager.hasEffect(PowerUpType.MULTISHOT) ? 3 : 1;

    // 检查导弹数量是否足够
    if (this.missileCount < missileCount) return;

    // 发射导弹（1发或3发）
    if (missileCount === 3) {
      // 多重射击：3发导弹，有轻微角度偏移
      const spreadAngle = 0.15;

      for (let i = -1; i <= 1; i++) {
        const offsetForward = forward.clone();
        offsetForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spreadAngle);
        this.missileSystem.fire(position.clone(), offsetForward.normalize(), target);
      }
    } else {
      // 单发导弹
      this.missileSystem.fire(position, forward, target);
    }

    // 播放导弹发射音效
    this.audioManager.playMissileLaunch();

    // 减少导弹数量
    this.missileCount -= missileCount;
    this.hud.updateMissiles(this.missileCount);

    // 隐藏锁定指示器
    this.lockOnIndicator.onMissileFired();
  }

  /**
   * 玩家开火
   */
  private playerFire(): void {
    const position = this.playerController.getPosition().clone();
    const quaternion = this.playerController.getQuaternion();

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);

    // 从飞机前方发射
    position.add(forward.clone().multiplyScalar(2));

    this.audioManager.playShoot();

    // 添加射击扰动（模拟不完美瞄准）
    const accuracy = this.playerStats.getAccuracy();
    const perturbationStrength = (1 - accuracy) * 0.12; // 根据玩家精度计算扰动强度
    const perturbationAngle = (Math.random() - 0.5) * perturbationStrength;
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), perturbationAngle);

    // 检查多重射击
    const damageMultiplier = this.powerUpManager.hasEffect(PowerUpType.DAMAGE)
      ? POWER_UP_CONFIGS[PowerUpType.DAMAGE].value
      : 1;

    if (this.powerUpManager.hasEffect(PowerUpType.MULTISHOT)) {
      // 发射三发
      const spreadAngle = 0.15;

      for (let i = -1; i <= 1; i++) {
        const offsetForward = forward.clone();
        offsetForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spreadAngle);
        this.playerProjectilePool.fire(position.clone(), offsetForward.normalize(), this.playerStats.getDamage(damageMultiplier));
      }
    } else {
      this.playerProjectilePool.fire(position, forward, this.playerStats.getDamage(damageMultiplier));
    }
  }

  /**
   * 渲染
   */
  private render(): void {
    this.gameScene.render();
  }

  /**
   * 开始游戏
   */
  public start(): void {
    this.gameState.setStatus(GameStatus.PLAYING);

    // 初始化音频（需要用户交互后）
    if (!this.audioInitialized) {
      this.audioManager.resume();
      this.audioInitialized = true;
    }

    // 加载第一关
    this.levelManager.loadLevel(this.currentLevelId);

    // 延迟开始第一波
    setTimeout(() => {
      this.levelManager.startWave();
    }, GAME_CONSTANTS.LEVEL.START_DELAY * 1000);

    // 初始化导弹显示
    this.missileCount = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
    this.hud.updateMissiles(this.missileCount);

    // 开始游戏循环
    this.gameLoop.start(
      (dt) => this.update(dt),
      () => this.render()
    );

    // 开始引擎声
    this.audioManager.startEngine();

    console.log('游戏开始！');

    // 测试模式：1秒后自动召唤友军（仅在点击"开始游戏"后执行）
    setTimeout(() => {
      this.spawnFriendlyAI();
      this.hud.showPowerUpBig('✈️', '召唤友军');
      console.log('测试模式：自动召唤友军');
    }, 1000);
  }

  /**
   * 停止游戏
   */
  public stop(): void {
    this.gameLoop.stop();
    this.audioManager.stopEngine();
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stop();
    this.levelManager.clear();
    this.particleSystem.clear();
    this.powerUpManager.clear();
    this.gameScene.dispose();
  }
}
