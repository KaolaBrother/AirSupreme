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
    horizontalDistance: 300 // 水平边界（离玩家中心）
  };

  private currentLevel: LevelConfig | null = null;
  private currentWave: number = 0;
  private state: LevelState = LevelState.IDLE;

  // 敌人管理
  private enemies: EnemyAI[] = [];
  private enemyPool: EnemyAI[] = [];
  private enemiesSpawnedThisWave: number = 0;
  private enemiesKilledThisWave: number = 0; // 本波已击杀的敌人数量
  private totalEnemiesInLevel: number = 0; // 关卡总敌人数（包括已击杀的）
  private totalEnemiesSpawned: number = 0; // 总共已生成的敌人数量

  // 传送门管理
  private activePortals: SpawnPortal[] = [];

  // 计时器
  private spawnTimer: number = 0;
  private spawnInterval: number = 3; // 敌人生成间隔
  private waveDelayTimer: number = 0; // 波次延迟计时器

  // 回调
  public onWaveStart?: (wave: number) => void;
  public onWaveComplete?: (wave: number) => void;
  public onLevelComplete?: (level: number) => void;
  public onEnemySpawned?: (enemy: EnemyAI) => void;
  public onEnemyKilled?: (enemy: EnemyAI) => void;
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

    // 加载关卡后立即开始第一波
    this.startWave();

    console.log(`Loaded level ${levelId}: ${config.name}`);
  }

  /**
   * 开始当前波次
   */
  public startWave(): void {
    if (!this.currentLevel || this.state !== LevelState.IDLE) return;

    this.state = LevelState.WAVE_ACTIVE;
    this.enemiesSpawnedThisWave = 0;
    this.onWaveStart?.(this.currentWave);

    // 清除已死亡的敌人
    this.enemies = this.enemies.filter(e => e.isAlive());

    // 不重置totalEnemiesSpawned，因为它要累计整个关卡的所有已生成敌人
  }

  /**
   * 生成敌人
   */
  private spawnEnemy(playerPosition: THREE.Vector3): void {
    if (!this.currentLevel) return;

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
      // 传送门完成回调：显示敌人
      const enemy = this.getOrCreateEnemy(enemyType);
      enemy.reset(spawnPosition);

      // 初始隐藏，传送门完成后再显示
      enemy.getMesh().visible = false;

      // 延迟一帧后显示，确保玩家能看见
      setTimeout(() => {
        enemy.getMesh().visible = true;
      }, 100);

      this.enemiesSpawnedThisWave++;
      this.totalEnemiesSpawned++; // 总已生成敌人计数

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
    if (this.waveDelayTimer > 0) {
      this.waveDelayTimer -= deltaTime;
      if (this.waveDelayTimer <= 0) {
        this.startNextWave();
      }
    }

    // 生成敌人
    if (this.state === LevelState.WAVE_ACTIVE && this.currentLevel) {
      const maxEnemies = this.currentLevel.enemiesPerWave[this.currentWave] || 0;
      const aliveEnemies = this.enemies.filter(e => e.isAlive()).length;

      // 如果当前活着的敌人数量少于最大值，且有生成间隔，则生成新敌人
      if (this.enemiesSpawnedThisWave < maxEnemies && aliveEnemies < maxEnemies) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnEnemy(playerPosition);
        }
      } else if (aliveEnemies === 0 && this.enemiesSpawnedThisWave >= maxEnemies) {
        // 当前波次完成
        this.completeWave();
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
    return this.activePortals.some(portal => {
      const portalPos = portal.getMesh().position;
      return portalPos.distanceTo(enemyPos) < 1; // 1单位内认为是同一个位置
    });
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
    this.enemiesKilledThisWave = 0;
  }

  /**
   * 开始下一波
   */
  private startNextWave(): void {
    if (!this.currentLevel) return;

    this.currentWave++;
    this.state = LevelState.WAVE_ACTIVE;
    this.onWaveStart?.(this.currentWave);
  }

  /**
   * 完成关卡
   */
  private completeLevel(): void {
    if (!this.currentLevel || this.state !== LevelState.WAVE_ACTIVE) return;

    // 清除所有敌人
    this.enemies = this.enemies.filter(e => e.isAlive());
    this.enemyPool = [];

    // 重置波次
    this.currentWave = 0;

    // 标记关卡完成
    this.state = LevelState.LEVEL_COMPLETE;
    this.onLevelComplete?.(this.currentLevel.id);
  }

  /**
   * 获取生成位置，确保敌人分散
   */
  private getSpawnPosition(playerPosition: THREE.Vector3): THREE.Vector3 {
    const minDistanceFromPlayer = 120;
    const maxDistanceFromPlayer = 250;
    const minDistanceFromOtherEnemies = 40;

    // 战斗区域边界限制
    const maxHeight = this.combatBounds.maxHeight;
    const minHeight = this.combatBounds.minHeight;
    const horizontalDistance = this.combatBounds.horizontalDistance;

    let bestPosition: THREE.Vector3 | null = null;
    let bestMinDistance = 0;

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 在不同扇区生成敌人，确保分散
      const sectorAngle = (this.enemiesSpawnedThisWave * 137.5) % 360;
      const angleVariation = (Math.random() - 0.5) * 60; // ±30度随机偏移
      const angle = THREE.MathUtils.degToRad(sectorAngle + angleVariation);

      const distance = minDistanceFromPlayer + Math.random() * (maxDistanceFromPlayer - minDistanceFromPlayer);

      // 计算位置（同时检查高度和水平边界）
      const spawnY = Math.max(minHeight, Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30));
      const x = playerPosition.x + Math.cos(angle) * distance;
      const z = playerPosition.z + Math.sin(angle) * distance;

      const position = new THREE.Vector3(x, spawnY, z);

      // 计算到玩家中心的距离（水平面）
      const distFromCenter = Math.sqrt(Math.pow(x - playerPosition.x, 2) + Math.pow(z - playerPosition.z, 2));

      // 检查是否超出水平边界
      if (distFromCenter > horizontalDistance) {
        // 限制在水平边界内
        const ratio = horizontalDistance / distFromCenter;
        const clampedX = playerPosition.x + (x - playerPosition.x) * ratio;
        const clampedZ = playerPosition.z + (z - playerPosition.z) * ratio;

        return new THREE.Vector3(clampedX, spawnY, clampedZ);
      }

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

    // 如果找不到完美位置，使用最佳位置或默认位置
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

    const enemy = new EnemyAI(mesh, config);
    this.enemies.push(enemy);

    return enemy;
  }

  /**
   * 创建敌人网格
   */
  private createEnemyMesh(config: any): THREE.Group {
    const group = new THREE.Group();

    // 创建机身（使用简单的几何体）- 增大到 2 倍
    const bodyGeometry = new THREE.ConeGeometry(1.6, 6, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.6,
      roughness: 0.4
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2; // 使圆锥水平放置
    body.castShadow = true;
    group.add(body);

    // 创建机翼
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 1);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.6,
      roughness: 0.4
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, 0.5);
    wings.castShadow = true;
    group.add(wings);

    // 创建尾翼
    const tailGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.6);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0, -1.4);
    tail.castShadow = true;
    group.add(tail);

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
        // 重型机更大
        group.scale.set(config.scale, config.scale, config.scale);
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
