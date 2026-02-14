import * as THREE from 'three';
import { LevelConfig, getLevelConfig } from '@/features/terrain/LevelConfig';
import { EnemyType, ENEMY_CONFIGS, getRandomEnemyType, getEnemyTypesForWave } from '@/features/enemy/EnemyTypes';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { TerrainGenerator } from '@/features/terrain/TerrainGenerator';
import { SpawnPortal } from '@/features/effects/SpawnPortal';

/**
 * 关卡状态
 */
export enum LevelState {
  IDLE = 'IDLE',
  WAVE_ACTIVE = 'WAVE_ACTIVE',
  WAVE_COMPLETE = 'WAVE_COMPLETE',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
}

/**
 * 关卡管理器
 */
export class LevelManager {
  private scene: THREE.Scene;
  private terrainGenerator: TerrainGenerator;

  // 战斗区域边界
  private combatBounds: {
    maxHeight: number;
    minHeight: number;
    horizontalDistance: number;
  } = {
    maxHeight: 150,      // 最大高度（敌人不能超过）
    minHeight: -20,       // 最小高度（敌人不能低于）
    horizontalDistance: 750 // 水平边界（离玩家中心，留出边距）
  };

  private currentLevel: LevelConfig | null = null;
  private currentWave: number = 0;
  private state: LevelState = LevelState.IDLE;

  // 敌人管理
  private enemies: EnemyAI[] = [];
  private enemyPool: EnemyAI[] = [];
  private enemiesSpawnedThisWave: number = 0;
  private totalEnemiesSpawned: number = 0; // 总共已生成的敌人数量

  // 传送门管理
  private activePortals: SpawnPortal[] = [];

  // 计时器
  private spawnTimer: number = 0;
  private spawnInterval: number = 0.5; // 敌人生成间隔（秒）
  private waveDelayTimer: number = 0; // 波次延迟计时器
  private waveGroupCenter?: THREE.Vector3; // 当前波次的敌人群中心

  // 回调
  public onWaveStart?: (wave: number) => void;
  public onWaveComplete?: (wave: number) => void;
  public onLevelComplete?: (level: number) => void;
  public onEnemySpawned?: (enemy: EnemyAI) => void;
  public onEnemyKilled?: (enemy: EnemyAI) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.terrainGenerator = new TerrainGenerator(scene);
  }

  /**
   * 加载关卡
   */
  public loadLevel(levelId: number): void {
    const config = getLevelConfig(levelId);
    if (!config) {
      console.error(`Level ${levelId} not found`);
      return;
    }

    this.currentLevel = config;
    this.currentWave = 0;
    this.state = LevelState.IDLE;

    // 生成地形
    this.terrainGenerator.generateTerrain(config);

    console.log(`Loaded level ${levelId}: ${config.name}`);
  }

  /**
   * 开始当前波次
   */
  public startWave(): void {
    if (!this.currentLevel || this.state !== LevelState.IDLE) return;

    this.state = LevelState.WAVE_ACTIVE;
    this.enemiesSpawnedThisWave = 0;
    this.spawnTimer = 0; // 重置生成计时器
    this.onWaveStart?.(this.currentWave);

    // 清除已死亡的敌人
    this.enemies = this.enemies.filter(e => e.isAlive());

    // 不重置totalEnemiesSpawned，因为它要累计整个关卡的所有已生成敌人
  }

  /**
   * 生成敌人（保留传送门，但完成后立即出现）
   */
  private spawnEnemy(playerPosition: THREE.Vector3): void {
    if (!this.currentLevel) return;

    // 立即递增生成计数（防止重复生成）
    this.enemiesSpawnedThisWave++;
    this.totalEnemiesSpawned++; // 总已生成敌人计数

    // 获取当前波次可用的敌人类型
    const availableTypes = getEnemyTypesForWave(this.currentLevel.id, this.currentWave);
    if (availableTypes.length === 0) {
      // 如果没有特定配置，默认使用SCOUT
      availableTypes.push(EnemyType.SCOUT);
    }

    // 随机选择一个敌人类型
    const enemyType = getRandomEnemyType(availableTypes);

    // 获取生成位置
    const spawnPosition = this.getSpawnPosition(playerPosition);

    // 创建传送门（5秒生成动画）
    const portal = new SpawnPortal(spawnPosition, () => {
      // 传送门完成回调：立即显示敌人
      const enemy = this.getOrCreateEnemy(enemyType);
      enemy.reset(spawnPosition);
      enemy.getMesh().visible = true; // 立即显示，无延迟

      // 触发回调
      this.onEnemySpawned?.(enemy);
    });

    // 添加到场景和传送门列表
    this.scene.add(portal.getMesh());
    this.activePortals.push(portal);
  }

  /**
   * 更新关卡管理器
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // 更新传送门动画
    for (let i = this.activePortals.length - 1; i >= 0; i--) {
      const portal = this.activePortals[i];
      portal.update(deltaTime);

      // 移除已完成的传送门
      if (portal.isFinished()) {
        portal.dispose();
        this.activePortals.splice(i, 1);
      }
    }

    // 更新波次延迟
    if (this.waveDelayTimer > 0 && this.currentLevel) {
      this.waveDelayTimer -= deltaTime;
      if (this.waveDelayTimer <= 0) {
        // 检查是否是最后一波
        if (this.currentWave >= this.currentLevel.totalWaves) {
          // 关卡完成
          this.state = LevelState.LEVEL_COMPLETE;
          console.log(`[Level ${this.currentLevel.id}] Complete! All waves defeated.`);
          this.onLevelComplete?.(this.currentLevel.id);
        } else {
          // 开始下一波
          this.startNextWave(playerPosition);
        }
      }
    }

    // 生成敌人
    if (this.state === LevelState.WAVE_ACTIVE && this.currentLevel) {
      const maxEnemies = this.currentLevel.enemiesPerWave[this.currentWave] || 0;
      const aliveEnemies = this.enemies.filter(e => e.isAlive()).length;

      // 只要还没达到最大生成数量，就继续生成
      if (this.enemiesSpawnedThisWave < maxEnemies) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnEnemy(playerPosition);
        }
      } else if (this.activePortals.length === 0 && aliveEnemies === 0 && this.enemiesSpawnedThisWave >= maxEnemies) {
        // 当前波次完成（必须等待所有传送门完成且所有敌人都被消灭）
        console.log(`[Wave ${this.currentWave}] Complete! All enemies defeated.`);
        this.state = LevelState.WAVE_COMPLETE;
        this.enemiesSpawnedThisWave = 0;
        this.waveDelayTimer = 3; // 3秒后开始下一波
        this.onWaveComplete?.(this.currentWave);
      }
    }

    // 更新敌人
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, playerPosition);
    }

    // 清理已死亡的敌人
    this.enemies = this.enemies.filter(e => e.isAlive());
  }

  /**
   * 获取敌人列表
   */
  public getEnemies(): EnemyAI[] {
    return this.enemies;
  }

  /**
   * 检查敌人是否正在生成（传送门动画中）
   */
  public isEnemySpawning(enemy: EnemyAI): boolean {
    // 检查是否有活跃传送门在敌人位置附近
    const enemyPos = enemy.getPosition();
    const hasPortalNearby = this.activePortals.some(portal => {
      const portalPos = portal.getMesh().position;
      return portalPos.distanceTo(enemyPos) < 1; // 1单位内认为是同一个位置
    });

    // 如果没有传送门附近，检查敌人网格是否不可见（刚创建还未显示）
    const mesh = enemy.getMesh();
    const isInvisible = mesh && !mesh.visible;

    return hasPortalNearby || isInvisible;
  }

  /**
   * 获取活着的敌人数量
   */
  public getAliveEnemyCount(): number {
    return this.enemies.filter(e => e.isAlive()).length;
  }

  /**
   * 获取总共已生成的敌人数量
   */
  public getSpawnedEnemyCount(): number {
    return this.totalEnemiesSpawned;
  }

  /**
   * 获取当前关卡总敌人数量
   */
  public getTotalEnemyCount(): number {
    if (!this.currentLevel) return 0;
    return this.currentLevel.enemiesPerWave.reduce((sum, count) => sum + count, 0);
  }

  /**
   * 清除所有敌人
   */
  public clear(): void {
    // 清除敌人池
    for (const enemy of this.enemyPool) {
      enemy.getMesh().removeFromParent();
    }

    // 清除场景中的敌人
    this.enemies = [];
    this.enemyPool = [];

    // 清除传送门
    for (const portal of this.activePortals) {
      portal.dispose();
    }
    this.activePortals = [];

    // 重置波次
    this.enemiesSpawnedThisWave = 0;
  }

  /**
   * 开始下一波
   */
  private startNextWave(playerPosition: THREE.Vector3): void {
    if (!this.currentLevel) return;

    this.currentWave++;
    this.state = LevelState.WAVE_ACTIVE;
    this.enemiesSpawnedThisWave = 0; // 重置生成计数
    this.spawnTimer = 0; // 重置生成计时器

    // 计算并保存当前波次的敌人群中心（使用玩家位置作为参考）
    const angle = Math.random() * Math.PI * 2;
    const distance = 600 + Math.random() * 200; // 600-800m

    this.waveGroupCenter = new THREE.Vector3(
      playerPosition.x + Math.cos(angle) * distance,
      playerPosition.y,
      playerPosition.z + Math.sin(angle) * distance
    );

    this.onWaveStart?.(this.currentWave);
  }

  /**
   * 获取生成位置，确保敌人批量生成在群内
   * 使用当前波次的固定群中心（waveGroupCenter），所有敌人在群中心60m半径内分布
   */
  private getSpawnPosition(playerPosition: THREE.Vector3): THREE.Vector3 {
    const minGroupDistanceFromPlayer = 600; // 群中心最小距离
    const maxGroupDistanceFromPlayer = 800; // 群中心最大距离
    const distributionRadius = 60; // 敌人在群内分布半径
    const minDistanceFromOtherEnemies = 40;

    // 战斗区域边界限制
    const maxHeight = this.combatBounds.maxHeight;
    const minHeight = this.combatBounds.minHeight;
    const horizontalDistance = this.combatBounds.horizontalDistance;

    let bestPosition: THREE.Vector3 | null = null;
    let bestMinDistance = 0;

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 使用保存的群中心（在startNextWave中计算）
      if (!this.waveGroupCenter) {
        console.warn('[Wave Manager] No group center set, using fallback position');
        // 降级：如果没有群中心，使用玩家位置作为参考
        const fallbackDistance = minGroupDistanceFromPlayer + Math.random() * (maxGroupDistanceFromPlayer - minGroupDistanceFromPlayer);
        const fallbackAngle = Math.random() * Math.PI * 2;
        const groupCenterX = playerPosition.x + Math.cos(fallbackAngle) * fallbackDistance;
        const groupCenterZ = playerPosition.z + Math.sin(fallbackAngle) * fallbackDistance;

        let finalCenterX = groupCenterX;
        let finalCenterZ = groupCenterZ;

        const distFromCenterToPlayer = Math.sqrt(Math.pow(groupCenterX - playerPosition.x, 2) + Math.pow(groupCenterZ - playerPosition.z, 2));

        if (distFromCenterToPlayer > horizontalDistance - distributionRadius) {
          const ratio = (horizontalDistance - distributionRadius) / distFromCenterToPlayer;
          finalCenterX = playerPosition.x + (groupCenterX - playerPosition.x) * ratio;
          finalCenterZ = playerPosition.z + (groupCenterZ - playerPosition.z) * ratio;
        }

        const distAngle = Math.random() * Math.PI * 2;
        const distFromCenter = Math.random() * distributionRadius;
        const x = finalCenterX + Math.cos(distAngle) * distFromCenter;
        const z = finalCenterZ + Math.sin(distAngle) * distFromCenter;
        const spawnY = Math.max(minHeight, Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30));
        bestPosition = new THREE.Vector3(x, spawnY, z);
        break;
      }

      // 使用群中心
      const groupCenter = this.waveGroupCenter;
      const distAngle = Math.random() * Math.PI * 2;
      const distFromCenter = Math.random() * distributionRadius;

      const x = groupCenter.x + Math.cos(distAngle) * distFromCenter;
      const z = groupCenter.z + Math.sin(distAngle) * distFromCenter;

      // 计算位置（同时检查高度和水平边界）
      const spawnY = Math.max(minHeight, Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30));

      const position = new THREE.Vector3(x, spawnY, z);

      // 计算与其他敌人的最小距离
      let minDistToOthers = Infinity;
      for (const existingEnemy of this.enemies) {
        if (existingEnemy.isAlive()) {
          const dist = position.distanceTo(existingEnemy.getPosition());
          minDistToOthers = Math.min(minDistToOthers, dist);
        }
      }

      // 如果是第一个敌人或者找到更好的位置
      if (minDistToOthers === Infinity || minDistToOthers > bestMinDistance) {
        bestMinDistance = minDistToOthers;
        bestPosition = position;
      }

      // 如果距离足够好，直接使用
      if (minDistToOthers >= minDistanceFromOtherEnemies) {
        break;
      }
    }

    // 如果找不到完美位置，使用默认位置
    if (!bestPosition) {
      const defaultY = Math.max(minHeight, Math.min(maxHeight, playerPosition.y));
      bestPosition = new THREE.Vector3(
        playerPosition.x + (Math.random() - 0.5) * 200,
        defaultY,
        playerPosition.z + (Math.random() - 0.5) * 200
      );
    }

    return bestPosition;
  }

  /**
   * 获取或创建敌人
   */
  private getOrCreateEnemy(type: EnemyType): EnemyAI {
    // 尝试从池中获取相同类型的敌人
    const pooledIndex = this.enemyPool.findIndex(e => e.getConfig().type === type);

    if (pooledIndex !== -1) {
      const enemy = this.enemyPool.splice(pooledIndex, 1)[0];
      // 重要：从池中取出的敌人也要添加回 enemies 数组
      this.enemies.push(enemy);
      return enemy;
    }

    // 创建新敌人
    const config = ENEMY_CONFIGS[type];
    const mesh = this.createEnemyMesh(config);
    this.scene.add(mesh);

    const enemy = new EnemyAI(mesh, config, this.scene);
    this.enemies.push(enemy);

    return enemy;
  }

  /**
   * 清理敌人资源
   */
  public dispose(_scene: THREE.Scene): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
  }

  /**
   * 创建敌人网格
   */
  private createEnemyMesh(config: any): THREE.Group {
    const group = new THREE.Group();

    // 根据敌人类型定义配色和尺寸
    let bodyColor: number, wingColor: number, accentColor: number;
    let bodySize = 1.6, bodyLength = 6, wingSpan = 3, tailSize = 0.8;
    let scaleMultiplier = 1;

    switch (config.type) {
      case EnemyType.SCOUT:
        // 侦察机：蓝灰配色，小巧
        bodyColor = 0x4a5584; // 深蓝灰
        wingColor = 0x6b7b8e; // 灰蓝色
        accentColor = 0x3d5a87; // 紫色调
        bodySize = 1.2;
        bodyLength = 5;
        wingSpan = 2.2;
        scaleMultiplier = 0.85;
        break;

      case EnemyType.FIGHTER:
        // 战斗机：红橙配色，中等
        bodyColor = 0xcc3300; // 深橙红
        wingColor = 0xe63900; // 橙黄色
        accentColor = 0x8b2500; // 焦棕
        bodySize = 1.8;
        bodyLength = 7;
        wingSpan = 3.5;
        scaleMultiplier = 1.1;
        break;

      case EnemyType.HEAVY:
        // 重型机：暗灰配色，大型
        bodyColor = 0x2c2c2c; // 深灰
        wingColor = 0x3a3a3a; // 暗灰
        accentColor = 0x1a1a1a; // 黑灰
        bodySize = 2.2;
        bodyLength = 8;
        wingSpan = 4.2;
        scaleMultiplier = 1.3;
        break;

      case EnemyType.SNIPER:
        // 狙击机：紫灰配色，修长
        bodyColor = 0x4a235a; // 深紫
        wingColor = 0x6b4c7a; // 紫灰
        accentColor = 0x7c3aed; // 淡紫
        bodySize = 1.6;
        bodyLength = 7.5;
        wingSpan = 2.8;
        scaleMultiplier = 0.95;
        break;

      case EnemyType.ACE:
        // 王牌：金红配色，特殊
        bodyColor = 0x8b0000; // 深红
        wingColor = 0xffd700; // 金黄
        accentColor = 0xff4500; // 橙红
        bodySize = 1.9;
        bodyLength = 7;
        wingSpan = 3.3;
        scaleMultiplier = 1.15;
        break;

      default:
        // 默认使用配置颜色
        bodyColor = config.color;
        wingColor = config.color;
        accentColor = config.color;
    }

    // 应用整体缩放
    group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);

    // 创建主机身（流线型圆柱）
    const bodyGeometry = new THREE.CylinderGeometry(bodySize * 0.4, bodySize * 0.3, bodyLength, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.7,
      roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2; // 使圆柱水平放置
    body.rotation.z = Math.PI / 2; // 调整朝向
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

    // 创建主翼（后掠翼设计）
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

    // 创建尾翼（垂直和水平）
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

    // 创建引擎喷口（发光）
    const engineGeometry = new THREE.CylinderGeometry(bodySize * 0.2, bodySize * 0.15, 0.5, 8);
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600, // 橙色发光
      transparent: true,
      opacity: 0.8
    });
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, 0, -bodyLength / 2 - 0.8);
    group.add(engine);

    // 根据敌人类型设置名称
    switch (config.type) {
      case EnemyType.SCOUT:
        group.name = 'Scout';
        break;
      case EnemyType.FIGHTER:
        group.name = 'Fighter';
        break;
      case EnemyType.HEAVY:
        group.name = 'Heavy';
        break;
      case EnemyType.SNIPER:
        group.name = 'Sniper';
        break;
      case EnemyType.ACE:
        group.name = 'Ace';
        break;
    }

    return group;
  }
}
