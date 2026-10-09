import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { LevelManager } from '@/features/levels/LevelManager';
import {
  FriendlyAI,
  getFormationSlotOffset,
  type FormationSlotOffset,
} from '@/features/enemy/FriendlyAI';
import { Faction } from '@/core/Faction';
import type { DifficultyProfile } from '@/core/Difficulty';
import { GameSessionState } from '@/core/GameSessionState';

/** 玩家位置单步跳变超过此速度（m/s）视为传送（复活 / 换关 / 读档），不计入速度估计 */
const MAX_PLAYER_SPEED = 300;
/** 玩家速度估计的平滑时间常数（秒） */
const PLAYER_VELOCITY_SMOOTHING = 0.25;
/** 玩家静止（坠毁等待复活）时速度估计的衰减时间常数（秒） */
const PLAYER_VELOCITY_DECAY = 0.6;

/**
 * 友机入场点：FriendlyAI 的编队位（getFormationSlotOffset，同侧同横距、同高度）向后退这么多米，
 * 从侧前方滑进编队位。编队位横距 ≥ 40 米，入场点从不落在追尾相机的视线走廊里（座机后方 60 米
 * 到前方 35 米、横向 ±28 米）。
 */
const FRIENDLY_SPAWN_BEHIND_SLOT = 12;
/** 机头方向的水平分量低于此值（俯仰约 78° 以上）时，入场航向改用平滑速度的水平方向 */
const MIN_HEADING_HORIZONTAL = 0.2;

export class EnemySystem implements IGameSystem {
  readonly name = 'EnemySystem';

  private levelManager: LevelManager;
  private sessionState: GameSessionState;
  private friendlyAIs: FriendlyAI[] = [];
  /** 逐帧复用：友机网格（敌机盘旋判断用）与僚机索敌目标，避免每帧分配数组 */
  private readonly friendlyMeshBuffer: THREE.Object3D[] = [];
  private readonly friendlyTargetBuffer: THREE.Object3D[] = [];
  /** 由相邻两步玩家位置推算的平滑速度（僚机编队的航向与速度前馈） */
  private readonly playerVelocity = new THREE.Vector3();
  private readonly lastPlayerPosition = new THREE.Vector3();
  private readonly playerStep = new THREE.Vector3();
  private hasLastPlayerPosition = false;
  /** 入场位姿计算复用的编队位偏移 */
  private readonly spawnSlotOffset: FormationSlotOffset = { side: -1, along: 0, lateral: 0, up: 0 };

  constructor(scene: THREE.Scene, sessionState?: GameSessionState) {
    this.levelManager = new LevelManager(scene);
    this.sessionState = sessionState ?? new GameSessionState();
  }

  init(): void {
    this.levelManager.onEnemySpawned = (enemy) => {
      enemy.onFire = (position, direction, damage) => {
        EventBus.emit(GameEventType.ENEMY_FIRED, {
          position,
          direction,
          damage,
          faction: Faction.ENEMY,
          owner: enemy.getMesh(),
        });
      };

      enemy.onDestroy = () => {
        const config = enemy.getConfig();
        EventBus.emit(GameEventType.ENEMY_DEATH, {
          enemyId: enemy.getMesh().uuid,
          position: enemy.getPosition().clone(),
          config,
        });
      };
    };

    this.levelManager.onWaveStart = (wave) => {
      this.sessionState.setWave(wave);
      EventBus.emit(GameEventType.WAVE_START, {
        wave,
        level: this.sessionState.getLevel(),
      });
    };

    this.levelManager.onWaveEventStart = (eventType, wave) => {
      EventBus.emit(GameEventType.WAVE_EVENT_START, {
        wave,
        level: this.sessionState.getLevel(),
        eventType,
      });
    };

    this.levelManager.onWaveComplete = (wave) => {
      this.sessionState.setWave(wave);
      EventBus.emit(GameEventType.WAVE_COMPLETE, {
        wave,
        enemiesKilled: 0,
      });
    };

    this.levelManager.onLevelComplete = (level) => {
      EventBus.emit(GameEventType.LEVEL_COMPLETE, { level });
    };
  }

  update(_deltaTime: number): void {}

  updateWithPlayer(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    additionalTargets?: THREE.Object3D[]
  ): void {
    this.trackPlayerMotion(deltaTime, playerPosition);

    const friendlyMeshes = this.friendlyMeshBuffer;
    friendlyMeshes.length = 0;
    for (let i = 0; i < this.friendlyAIs.length; i++) {
      friendlyMeshes.push(this.friendlyAIs[i].getMesh());
    }
    this.levelManager.update(deltaTime, playerPosition, friendlyMeshes);

    // 僚机索敌目标：存活敌机 + 额外目标（Boss 本体 / 部件等），每步收集一次
    const targets = this.friendlyTargetBuffer;
    targets.length = 0;
    if (this.friendlyAIs.length > 0) {
      const enemies = this.levelManager.getEnemies();
      for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].isAlive()) targets.push(enemies[i].getMesh());
      }
      if (additionalTargets) {
        for (let i = 0; i < additionalTargets.length; i++) targets.push(additionalTargets[i]);
      }
    }

    for (let i = this.friendlyAIs.length - 1; i >= 0; i--) {
      const friendly = this.friendlyAIs[i];

      if (friendly.isAlive()) {
        friendly.update(deltaTime, targets, playerPosition, this.playerVelocity);
      } else {
        EventBus.emit(GameEventType.FRIENDLY_DEATH, {
          friendlyId: friendly.getMesh().uuid,
          position: friendly.getMesh().position.clone(),
        });
        friendly.dispose();
        this.friendlyAIs.splice(i, 1);
      }
    }
  }

  /**
   * 玩家速度估计：相邻两步的位移 / 步长，指数平滑；位移过大视为传送（跳过），
   * 静止（坠毁等待复活）时逐渐衰减，僚机随之在原地附近盘旋等待。
   */
  private trackPlayerMotion(deltaTime: number, playerPosition: THREE.Vector3): void {
    const { x, y, z } = playerPosition;
    if (!(deltaTime > 0) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }
    if (!this.hasLastPlayerPosition) {
      this.lastPlayerPosition.copy(playerPosition);
      this.hasLastPlayerPosition = true;
      return;
    }
    const step = this.playerStep.subVectors(playerPosition, this.lastPlayerPosition);
    this.lastPlayerPosition.copy(playerPosition);
    const distanceSq = step.lengthSq();
    const maxStep = MAX_PLAYER_SPEED * deltaTime;
    if (distanceSq > maxStep * maxStep) {
      return;
    }
    if (distanceSq < 1e-8) {
      this.playerVelocity.multiplyScalar(Math.exp(-deltaTime / PLAYER_VELOCITY_DECAY));
      return;
    }
    step.multiplyScalar(1 / deltaTime);
    this.playerVelocity.lerp(step, 1 - Math.exp(-deltaTime / PLAYER_VELOCITY_SMOOTHING));
  }

  private resetPlayerMotion(): void {
    this.hasLastPlayerPosition = false;
    this.playerVelocity.set(0, 0, 0);
  }

  updateVisuals(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.levelManager.updateVisuals(deltaTime, playerPosition);
  }

  applyInterpolatedVisuals(alpha: number): void {
    for (const enemy of this.levelManager.getEnemies()) {
      if (enemy.isAlive()) {
        enemy.applyInterpolatedVisual(alpha);
      }
    }

    for (const friendly of this.friendlyAIs) {
      if (friendly.isAlive()) {
        friendly.getEnemy().applyInterpolatedVisual(alpha);
      }
    }
  }

  restoreCurrentVisuals(): void {
    for (const enemy of this.levelManager.getEnemies()) {
      if (enemy.isAlive()) {
        enemy.restoreCurrentVisual();
      }
    }

    for (const friendly of this.friendlyAIs) {
      if (friendly.isAlive()) {
        friendly.getEnemy().restoreCurrentVisual();
      }
    }
  }

  dispose(): void {
    this.levelManager.clear();
    this.friendlyAIs = [];
    this.friendlyMeshBuffer.length = 0;
    this.friendlyTargetBuffer.length = 0;
    this.resetPlayerMotion();
  }

  getLevelManager(): LevelManager {
    return this.levelManager;
  }

  getEnemies(): ReturnType<LevelManager['getEnemies']> {
    return this.levelManager.getEnemies();
  }

  getEnemyMeshes(): THREE.Object3D[] {
    return this.levelManager
      .getEnemies()
      .filter((e) => e.isAlive())
      .map((e) => e.getMesh());
  }

  getAliveEnemyCount(): number {
    return this.levelManager.getAliveEnemyCount();
  }

  getTotalEnemyCount(): number {
    return this.levelManager.getTotalEnemyCount();
  }

  getSpawnedEnemyCount(): number {
    return this.levelManager.getSpawnedEnemyCount();
  }

  /** 加载关卡；startWave > 0 时从第 N 波继续（读档） */
  loadLevel(levelId: number, startWave: number = 0): void {
    this.levelManager.loadLevel(levelId, startWave);
    this.resetPlayerMotion();
  }

  setDifficultyProfile(profile: DifficultyProfile): void {
    this.levelManager.setDifficultyProfile(profile);
  }

  getCurrentLevelConfig(): import('@/features/terrain/LevelConfig').LevelConfig | null {
    return this.levelManager.getCurrentLevelConfig();
  }

  startWave(playerPosition: THREE.Vector3): void {
    this.levelManager.startWave(playerPosition);
  }

  getFriendlyAIs(): FriendlyAI[] {
    return this.friendlyAIs;
  }

  spawnFriendly(friendly: FriendlyAI): void {
    friendly.setFormationSlot(this.nextFormationSlot());
    this.friendlyAIs.push(friendly);

    const enemy = friendly.getEnemy();
    enemy.onFire = (position, direction, damage) => {
      EventBus.emit(GameEventType.FRIENDLY_FIRED, {
        position,
        direction,
        damage,
        faction: Faction.FRIENDLY,
        owner: friendly.getMesh(),
      });
    };

    EventBus.emit(GameEventType.FRIENDLY_SPAWNED, {
      friendlyId: friendly.getMesh().uuid,
      position: friendly.getMesh().position.clone(),
    });
  }

  /**
   * 下一架友机的入场位姿（随后 spawnFriendly 分配的是同一个编队位）：玩家身侧、编队位所在一侧，
   * 机头朝玩家的水平航向。playerForward 为玩家机头方向（世界坐标）；机头接近竖直时改用平滑速度的
   * 水平方向，仍不可用时朝 -Z。outPosition 写入世界坐标，outHeading 写入水平单位向量。
   */
  getFriendlySpawnPose(
    playerPosition: THREE.Vector3,
    playerForward: THREE.Vector3,
    outPosition: THREE.Vector3,
    outHeading: THREE.Vector3
  ): void {
    let headingX = playerForward.x;
    let headingZ = playerForward.z;
    let length = Math.hypot(headingX, headingZ);
    if (!(length >= MIN_HEADING_HORIZONTAL)) {
      headingX = this.playerVelocity.x;
      headingZ = this.playerVelocity.z;
      length = Math.hypot(headingX, headingZ);
    }
    if (!(length > 1e-3) || !Number.isFinite(length)) {
      headingX = 0;
      headingZ = -1;
      length = 1;
    }
    headingX /= length;
    headingZ /= length;
    outHeading.set(headingX, 0, headingZ);

    const slot = getFormationSlotOffset(this.nextFormationSlot(), this.spawnSlotOffset);
    const along = slot.along - FRIENDLY_SPAWN_BEHIND_SLOT;
    const lateral = slot.lateral;
    // 右侧向量：前向 (x, z) → (-z, x)，与 FriendlyAI 的编队坐标系一致
    outPosition.set(
      playerPosition.x + headingX * along - headingZ * lateral,
      playerPosition.y + slot.up,
      playerPosition.z + headingZ * along + headingX * lateral
    );
  }

  /**
   * 最小的空闲编队位：先入场的两架（具名僚机）分别占左翼 0 号、右翼 1 号，互不重叠；
   * 阵亡僚机空出的位置留给下一架。
   */
  private nextFormationSlot(): number {
    let slot = 0;
    while (this.friendlyAIs.some((f) => f.isAlive() && f.getFormationSlot() === slot)) {
      slot++;
    }
    return slot;
  }

  removeFriendly(friendly: FriendlyAI): void {
    const index = this.friendlyAIs.indexOf(friendly);
    if (index !== -1) {
      this.friendlyAIs.splice(index, 1);
    }
  }

  clearFriendlies(): void {
    for (const friendly of this.friendlyAIs) {
      friendly.dispose();
    }
    this.friendlyAIs = [];
  }

  spawnEnemyAt(
    type: import('@/features/enemy/EnemyTypes').EnemyType,
    position: THREE.Vector3
  ): void {
    this.levelManager.spawnEnemyAtPosition(type, position);
  }
}
