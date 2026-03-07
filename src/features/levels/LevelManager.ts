import { Vector3 } from 'three';
import type { Object3D, Scene } from 'three';
import { LevelConfig, getLevelConfig } from '@/features/terrain/LevelConfig';
import {
  EnemyConfig,
  EnemyType,
  ENEMY_CONFIGS,
  getRandomEnemyType,
  getEnemyTypesForWave,
} from '@/features/enemy/EnemyTypes';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { TerrainGenerator } from '@/features/terrain/TerrainGenerator';
import { SpawnPortal } from '@/features/effects/SpawnPortal';
import { createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { getLogger } from '@/core/utils/Logger';
import type { DifficultyProfile } from '@/core/Difficulty';
import { GameConfig } from '@/config';

const log = getLogger('LevelManager');

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
  private scene: Scene;
  private terrainGenerator: TerrainGenerator | null = null;

  // 战斗区域边界
  private combatBounds: {
    maxHeight: number;
    minHeight: number;
    horizontalDistance: number;
  } = {
    maxHeight: 150, // 最大高度（敌人不能超过）
    minHeight: -20, // 最小高度（敌人不能低于）
    horizontalDistance: 750, // 水平边界（离战场中心的距离，±750米）
  };

  // 战场边界常量
  private readonly BATTLEFIELD_MIN = -750;
  private readonly BATTLEFIELD_MAX = 750;

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
  private waveGroupCenter?: Vector3; // 当前波次的敌人群中心
  private difficultyProfile: DifficultyProfile | null = null;

  // 回调
  public onWaveStart?: (wave: number) => void;
  public onWaveComplete?: (wave: number) => void;
  public onLevelComplete?: (level: number) => void;
  public onEnemySpawned?: (enemy: EnemyAI) => void;
  public onEnemyKilled?: (enemy: EnemyAI) => void;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private getTerrainGenerator(): TerrainGenerator {
    if (!this.terrainGenerator) {
      this.terrainGenerator = new TerrainGenerator(this.scene);
    }

    return this.terrainGenerator;
  }

  /**
   * 加载关卡
   */
  public loadLevel(levelId: number): void {
    const config = getLevelConfig(levelId);
    if (!config) {
      log.error('Level not found', { levelId });
      return;
    }

    this.currentLevel = config;
    this.currentWave = 0;
    this.state = LevelState.IDLE;
    this.totalEnemiesSpawned = 0;
    this.enemiesSpawnedThisWave = 0;
    this.spawnInterval = 0.5;

    log.info('Loading level', { levelId, name: config.name, terrain: config.terrain });

    this.getTerrainGenerator().generateTerrain(config);

    log.info('Level loaded', { levelId, name: config.name });
  }

  public setDifficultyProfile(profile: DifficultyProfile): void {
    this.difficultyProfile = profile;
  }

  public getCurrentLevelConfig(): LevelConfig | null {
    return this.currentLevel;
  }

  /**
   * 限制坐标在战场范围内
   */
  private clampToBattlefield(value: number): number {
    return Math.max(this.BATTLEFIELD_MIN, Math.min(this.BATTLEFIELD_MAX, value));
  }

  /**
   * 计算敌人群中心，确保在战场范围内
   */
  private calculateWaveGroupCenter(playerPosition: Vector3): Vector3 {
    // 计算相对于玩家的方向和距离（600-800m）
    const angle = Math.random() * Math.PI * 2;
    const distance = 600 + Math.random() * 200;

    // 计算原始群中心位置
    const rawCenter = new Vector3(
      playerPosition.x + Math.cos(angle) * distance,
      playerPosition.y,
      playerPosition.z + Math.sin(angle) * distance
    );

    // 限制在战场范围内（±750米）
    const clampedCenter = new Vector3(
      this.clampToBattlefield(rawCenter.x),
      rawCenter.y,
      this.clampToBattlefield(rawCenter.z)
    );

    if (clampedCenter.x !== rawCenter.x || clampedCenter.z !== rawCenter.z) {
      log.warn('群中心超出战场，已调整到边界内', {
        original: { x: rawCenter.x, z: rawCenter.z },
        clamped: { x: clampedCenter.x, z: clampedCenter.z },
      });
    }

    return clampedCenter;
  }

  /**
   * 开始当前波次
   * @param playerPosition 玩家位置（第一次调用时必需，用于计算群中心）
   * @param isNextWave 是否是下一波（波次完成后的开始）
   */
  public startWave(playerPosition?: Vector3, isNextWave: boolean = false): void {
    if (!this.currentLevel) return;

    // 第一次调用：设置第一波
    if (this.currentWave === 0 && playerPosition && !isNextWave) {
      // 计算并保存第一波的敌人群中心（确保在战场内）
      this.waveGroupCenter = this.calculateWaveGroupCenter(playerPosition);

      this.state = LevelState.WAVE_ACTIVE;
      this.enemiesSpawnedThisWave = 0;
      this.spawnTimer = 0;
      this.onWaveStart?.(this.currentWave);

      // 清理已死亡的敌人（调用 dispose 清理尾迹和资源）
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (!enemy.isAlive()) {
          enemy.dispose();
          this.enemies.splice(i, 1);
        }
      }
      return;
    }

    // 后续调用：由波次完成后的 startNextWave 触发
    // 允许从 IDLE 或 WAVE_COMPLETE 状态转换到 WAVE_ACTIVE
    if (this.state !== LevelState.IDLE && this.state !== LevelState.WAVE_COMPLETE) return;

    this.state = LevelState.WAVE_ACTIVE;
    this.enemiesSpawnedThisWave = 0;
    this.spawnTimer = 0;
    this.onWaveStart?.(this.currentWave);

    // 清理已死亡的敌人（调用 dispose 清理尾迹和资源）
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isAlive()) {
        enemy.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * 生成敌人（保留传送门，但完成后立即出现）
   */
  private spawnEnemy(playerPosition: Vector3): void {
    if (!this.currentLevel) return;

    // 立即递增生成计数（防止重复生成）
    this.enemiesSpawnedThisWave++;
    this.totalEnemiesSpawned++; // 总已生成敌人计数

    // 获取当前波次可用的敌人类型
    const availableTypes = this.getAvailableEnemyTypes();
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
  public update(
    deltaTime: number,
    playerPosition: Vector3,
    friendlyMeshes?: Object3D[]
  ): void {
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
        // 检查是否还有下一波（当前波次索引 + 1 >= 总波次数）
        if (this.currentWave + 1 >= this.currentLevel.totalWaves) {
          this.state = LevelState.LEVEL_COMPLETE;
          log.info('Level complete', { levelId: this.currentLevel.id });
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
      const aliveEnemies = this.enemies.filter((e) => e.isAlive()).length;
      const maxConcurrentEnemies = GameConfig.getMaxEnemies();

      // 只要还没达到最大生成数量，就继续生成
      if (
        this.enemiesSpawnedThisWave < maxEnemies &&
        aliveEnemies < maxConcurrentEnemies
      ) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnEnemy(playerPosition);
        }
      } else if (
        this.activePortals.length === 0 &&
        aliveEnemies === 0 &&
        this.enemiesSpawnedThisWave >= maxEnemies
      ) {
        log.debug('Wave complete', { wave: this.currentWave });
        this.state = LevelState.WAVE_COMPLETE;
        this.enemiesSpawnedThisWave = 0;
        this.waveDelayTimer = this.currentLevel.waveInterval;
        this.onWaveComplete?.(this.currentWave);
      }
    }

    // 更新敌人
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, playerPosition, friendlyMeshes, playerPosition);
    }

    // 清理已死亡的敌人（从场景中移除，清理尾迹）
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isAlive()) {
        enemy.dispose();
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * 更新纯视觉环境动画，跟随渲染帧而不是固定玩法步长。
   */
  public updateVisuals(deltaTime: number, playerPosition: Vector3): void {
    const terrainGenerator = this.terrainGenerator;
    if (!terrainGenerator) {
      return;
    }

    terrainGenerator.update(deltaTime);
    terrainGenerator.updateLOD(playerPosition);
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
    const hasPortalNearby = this.activePortals.some((portal) => {
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
    return this.enemies.filter((e) => e.isAlive()).length;
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
   * 开始下一波（波次完成后的调用）
   */
  private startNextWave(playerPosition: Vector3): void {
    if (!this.currentLevel) return;

    // 增加波次
    this.currentWave++;

    // 计算并保存新波次的敌人群中心（确保在战场内）
    this.waveGroupCenter = this.calculateWaveGroupCenter(playerPosition);

    // 调用 startWave 完成状态设置和事件触发
    this.startWave(undefined, true); // isNextWave = true
  }

  /**
   * 获取生成位置，确保敌人批量生成在群内
   * 使用当前波次的固定群中心（waveGroupCenter），所有敌人在群中心60m半径内分布
   */
  private getSpawnPosition(playerPosition: Vector3): Vector3 {
    const minGroupDistanceFromPlayer = 600; // 群中心最小距离
    const maxGroupDistanceFromPlayer = 800; // 群中心最大距离
    const distributionRadius = 60; // 敌人在群内分布半径
    const minDistanceFromOtherEnemies = 40;

    // 战斗区域边界限制
    const maxHeight = this.combatBounds.maxHeight;
    const minHeight = this.combatBounds.minHeight;
    const horizontalDistance = this.combatBounds.horizontalDistance;

    let bestPosition: Vector3 | null = null;
    let bestMinDistance = 0;

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 使用保存的群中心（在startNextWave中计算）
      if (!this.waveGroupCenter) {
        log.warn('No group center set, using fallback position');
        // 降级：如果没有群中心，使用玩家位置作为参考
        const fallbackDistance =
          minGroupDistanceFromPlayer +
          Math.random() * (maxGroupDistanceFromPlayer - minGroupDistanceFromPlayer);
        const fallbackAngle = Math.random() * Math.PI * 2;
        let groupCenterX = playerPosition.x + Math.cos(fallbackAngle) * fallbackDistance;
        let groupCenterZ = playerPosition.z + Math.sin(fallbackAngle) * fallbackDistance;

        // 限制在战场范围内
        groupCenterX = this.clampToBattlefield(groupCenterX);
        groupCenterZ = this.clampToBattlefield(groupCenterZ);

        let finalCenterX = groupCenterX;
        let finalCenterZ = groupCenterZ;

        const distFromCenterToPlayer = Math.sqrt(
          Math.pow(groupCenterX - playerPosition.x, 2) +
            Math.pow(groupCenterZ - playerPosition.z, 2)
        );

        if (distFromCenterToPlayer > horizontalDistance - distributionRadius) {
          const ratio = (horizontalDistance - distributionRadius) / distFromCenterToPlayer;
          finalCenterX = playerPosition.x + (groupCenterX - playerPosition.x) * ratio;
          finalCenterZ = playerPosition.z + (groupCenterZ - playerPosition.z) * ratio;
        }

        const distAngle = Math.random() * Math.PI * 2;
        const distFromCenter = Math.random() * distributionRadius;
        let x = finalCenterX + Math.cos(distAngle) * distFromCenter;
        let z = finalCenterZ + Math.sin(distAngle) * distFromCenter;

        // 限制在战场范围内
        x = this.clampToBattlefield(x);
        z = this.clampToBattlefield(z);

        const spawnY = Math.max(
          minHeight,
          Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30)
        );
        bestPosition = new Vector3(x, spawnY, z);
        break;
      }

      // 使用群中心
      const groupCenter = this.waveGroupCenter;
      const distAngle = Math.random() * Math.PI * 2;
      const distFromCenter = Math.random() * distributionRadius;

      // 计算原始位置
      let x = groupCenter.x + Math.cos(distAngle) * distFromCenter;
      let z = groupCenter.z + Math.sin(distAngle) * distFromCenter;

      // 限制在战场范围内
      x = this.clampToBattlefield(x);
      z = this.clampToBattlefield(z);

      // 计算位置（检查高度）
      const spawnY = Math.max(
        minHeight,
        Math.min(maxHeight, playerPosition.y + (Math.random() - 0.5) * 30)
      );

      const position = new Vector3(x, spawnY, z);

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
      let x = playerPosition.x + (Math.random() - 0.5) * 200;
      let z = playerPosition.z + (Math.random() - 0.5) * 200;

      // 限制在战场范围内
      x = this.clampToBattlefield(x);
      z = this.clampToBattlefield(z);

      bestPosition = new Vector3(x, defaultY, z);
    }

    return bestPosition;
  }

  /**
   * 获取或创建敌人
   */
  private getOrCreateEnemy(type: EnemyType): EnemyAI {
    // 尝试从池中获取相同类型的敌人
    const pooledIndex = this.enemyPool.findIndex((e) => e.getConfig().type === type);

    if (pooledIndex !== -1) {
      const enemy = this.enemyPool.splice(pooledIndex, 1)[0];
      enemy.setConfig(this.getAdjustedEnemyConfig(type));
      // 重要：从池中取出的敌人也要添加回 enemies 数组
      this.enemies.push(enemy);
      return enemy;
    }

    // 创建新敌人 - 使用统一的工厂函数
    const config = this.getAdjustedEnemyConfig(type);
    const mesh = createEnemyMesh(config);
    this.scene.add(mesh);

    const enemy = new EnemyAI(mesh, config, this.scene);
    this.enemies.push(enemy);

    return enemy;
  }

  /**
   * 在指定位置生成敌人（用于 Boss 召唤）
   */
  public spawnEnemyAtPosition(type: EnemyType, position: Vector3): EnemyAI | null {
    const enemy = this.getOrCreateEnemy(type);
    enemy.reset(position);
    enemy.getMesh().visible = true;
    this.totalEnemiesSpawned++;

    this.onEnemySpawned?.(enemy);
    return enemy;
  }

  /**
   * 清理敌人资源
   */
  public dispose(_scene: Scene): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
  }

  private getAvailableEnemyTypes(): EnemyType[] {
    if (!this.currentLevel) {
      return getEnemyTypesForWave(1, this.currentWave);
    }

    const weightedTypes: EnemyType[] = [];
    const waveNumber = this.currentWave + 1;

    for (const entry of this.currentLevel.enemyTypes) {
      if (waveNumber < entry.minWave) {
        continue;
      }

      const type = entry.type as EnemyType;
      for (let i = 0; i < entry.maxCount; i++) {
        weightedTypes.push(type);
      }
    }

    if (weightedTypes.length === 0) {
      return getEnemyTypesForWave(this.currentLevel.id, this.currentWave);
    }

    return weightedTypes;
  }

  private getAdjustedEnemyConfig(type: EnemyType): EnemyConfig {
    const baseConfig = ENEMY_CONFIGS[type];
    const levelDifficultyScale = this.currentLevel ? 1 + (this.currentLevel.difficulty - 5) * 0.04 : 1;
    const profile = this.difficultyProfile;
    const healthMultiplier = (profile?.enemyHealthMultiplier ?? 1) * levelDifficultyScale;
    const damageMultiplier = (profile?.enemyDamageMultiplier ?? 1) * levelDifficultyScale;
    const cooldownMultiplier = profile?.enemyAttackCooldownMultiplier ?? 1;

    return {
      ...baseConfig,
      health: Math.max(1, Math.round(baseConfig.health * healthMultiplier)),
      damage: Math.max(1, Math.round(baseConfig.damage * damageMultiplier * 10) / 10),
      attackCooldown: Math.max(0.1, baseConfig.attackCooldown * cooldownMultiplier),
    };
  }
}
