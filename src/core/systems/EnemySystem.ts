import * as THREE from 'three';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { LevelManager } from '@/features/levels/LevelManager';
import {
  FriendlyAI,
  getFormationSlotOffset,
  type FormationSlotOffset,
} from '@/features/enemy/FriendlyAI';
import { AttackDirector, getAttackTokenCount } from '@/features/enemy/AttackDirector';
import {
  getJetMissileCap,
  grantJetMissiles,
  type IJetMissileLauncher,
} from '@/features/enemy/MissileDirector';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { JAMMER_TUNING } from '@/features/enemy/doctrine/JammerDoctrine';
import type { IJetThreatProvider } from '@/features/enemy/JetThreat';
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
/** 没有威胁提供者时，玩家速度高于此值（米/秒）才用速度方向当机头方向 */
const MIN_FORWARD_SPEED = 2;

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

  /** 攻击令牌导演：波次敌机与 Boss 小兵都从这里领令牌与进入方位 */
  private readonly attackDirector = new AttackDirector();
  /** 玩家对敌机的威胁（锁定 / 来袭导弹 / 机头方向 / 是否可被攻击）；未接入时视为无威胁 */
  private threatProvider: IJetThreatProvider | null = null;
  /** 难度档 1..5（3 = 普通）：决定令牌数的加减 */
  private difficultyLevel = 3;
  private readonly playerForward = new THREE.Vector3(0, 0, -1);
  /** 敌机导弹的发射通道（单位导弹池）；未接入时敌机不锁定、不发射导弹 */
  private missileLauncher: IJetMissileLauncher | null = null;
  /** 上一步写给发射通道的“锁定中”状态（只在变化或为真时写） */
  private missileLockWarning = false;
  /** 干扰：玩家导弹锁定时间的倍数（1 = 没有干扰；有存活的干扰机在范围内时为 2，不叠加） */
  private lockTimeScale = 1;
  /** 逐步复用：干扰机自己那一路 / 场上全部非干扰机敌机的平均位置（干扰机躲在它们身后） */
  private readonly groupCenter = new THREE.Vector3();
  private readonly fleetCenter = new THREE.Vector3();

  constructor(scene: THREE.Scene, sessionState?: GameSessionState) {
    this.levelManager = new LevelManager(scene);
    this.sessionState = sessionState ?? new GameSessionState();
  }

  init(): void {
    this.levelManager.onEnemySpawned = (enemy) => {
      enemy.onFire = (position, direction, damage, shot) => {
        if (shot) {
          // 条令开火：带上弹种 / 弹速 / 是否静音（shot 对象只在回调期间有效，逐项取值）
          EventBus.emit(GameEventType.ENEMY_FIRED, {
            position,
            direction,
            damage,
            faction: Faction.ENEMY,
            owner: enemy.getMesh(),
            weapon: shot.weapon,
            speed: shot.speed,
            quiet: shot.quiet,
          });
          return;
        }
        EventBus.emit(GameEventType.ENEMY_FIRED, {
          position,
          direction,
          damage,
          faction: Faction.ENEMY,
          owner: enemy.getMesh(),
        });
      };

      enemy.onMissileLaunch = (position, direction) => {
        this.missileLauncher?.launch(position, direction, `jet:${enemy.getConfig().type}`);
      };

      enemy.onTell = (cue, position, duration) => {
        EventBus.emit(GameEventType.ENEMY_TELL, {
          kind: cue,
          position: position.clone(),
          duration,
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
    this.directEnemies(deltaTime, playerPosition);
    this.levelManager.update(deltaTime, playerPosition, friendlyMeshes);
    this.reviewEnemies(playerPosition);

    // 僚机索敌目标：存活敌机（隐形中的除外）+ 额外目标（Boss 本体 / 部件等），每步收集一次
    const targets = this.friendlyTargetBuffer;
    targets.length = 0;
    if (this.friendlyAIs.length > 0) {
      const enemies = this.levelManager.getEnemies();
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.isAlive() && !enemy.isCloaked()) targets.push(enemy.getMesh());
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
   * 敌机更新之前的一步：把战场态势（玩家机头方向、玩家对每架敌机的威胁、关卡、是否 Boss 战）
   * 写给每架敌机，再由导演发放 / 收回攻击令牌并指派进入方位。玩家不可被攻击（复活中）时
   * 令牌数为 0，并且每架敌机都被告知“不许开火”：不需要令牌的武器（重型机尾炮）也停火。
   */
  private directEnemies(deltaTime: number, playerPosition: THREE.Vector3): void {
    const enemies = this.levelManager.getEnemies();
    const provider = this.threatProvider;
    const level = this.sessionState.getLevel();
    const bossFight = this.sessionState.isBossMode() || this.sessionState.isInBossBattle();
    const targetable = provider ? provider.isPlayerTargetable() : true;
    const lockedTarget = provider && targetable ? provider.getLockedTarget() : null;

    let forward: THREE.Vector3 | null = null;
    if (provider && provider.getPlayerForward(this.playerForward)) {
      forward = this.playerForward;
    } else if (this.playerVelocity.lengthSq() > MIN_FORWARD_SPEED * MIN_FORWARD_SPEED) {
      // 没有提供者：用平滑速度的方向近似机头方向
      forward = this.playerForward.copy(this.playerVelocity).normalize();
    }

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const mesh = enemy.getMesh();
      enemy.setCombatSituation(
        forward,
        lockedTarget === mesh,
        provider !== null && targetable && provider.isMissileInbound(mesh),
        level,
        bossFight,
        targetable
      );
    }

    this.attackDirector.update(
      deltaTime,
      enemies,
      targetable ? playerPosition : null,
      targetable ? getAttackTokenCount(level, this.difficultyLevel, bossFight) : 0
    );

    // 全队导弹令牌：在飞的敌机导弹 + 各机手里的令牌 ≤ 上限（Boss 战 / 玩家复活中 / 没有通道时为 0）
    const launcher = this.missileLauncher;
    const launcherReady = launcher !== null && launcher.isAvailable();
    grantJetMissiles(
      enemies,
      targetable && launcherReady ? getJetMissileCap(level, bossFight) : 0,
      launcher && launcherReady ? launcher.countInFlight() : 0
    );

    this.assignJammerGroup(enemies);
  }

  /**
   * 干扰机的站位参照：和它同一路到场（编组号相同）的非干扰机存活敌机的平均位置；
   * 自己那一路已经没有别的敌机（或它不属于任何编组）时，退回到场上其余非干扰机敌机的平均位置；
   * 场上只剩干扰机时没有参照（它们改为在远处盘旋）。场上没有干扰机时不做任何事。
   */
  private assignJammerGroup(enemies: ReturnType<LevelManager['getEnemies']>): void {
    for (let i = 0; i < enemies.length; i++) {
      const jammer = enemies[i];
      if (jammer.getConfig().type !== EnemyType.JAMMER || !jammer.isAlive()) continue;
      const groupId = jammer.getGroupId();
      const ownCenter = this.groupCenter.set(0, 0, 0);
      const fleetCenter = this.fleetCenter.set(0, 0, 0);
      let own = 0;
      let others = 0;
      for (let j = 0; j < enemies.length; j++) {
        const mate = enemies[j];
        if (!mate.isAlive() || mate.getConfig().type === EnemyType.JAMMER) continue;
        const position = mate.getMesh().position;
        fleetCenter.add(position);
        others++;
        if (groupId !== 0 && mate.getGroupId() === groupId) {
          ownCenter.add(position);
          own++;
        }
      }
      if (own > 0) {
        jammer.setGroupCenter(ownCenter.multiplyScalar(1 / own));
      } else if (others > 0) {
        jammer.setGroupCenter(fleetCenter.multiplyScalar(1 / others));
      } else {
        jammer.setGroupCenter(null);
      }
    }
  }

  /**
   * 敌机更新之后的一步：汇总“有没有敌机正在用导弹锁定玩家”（HUD 的“锁定中”预警），
   * 以及干扰状态——至少一架存活且没有被 EMP 瘫痪的干扰机在玩家 800 米内时，玩家导弹锁定时间
   * ×2（不叠加）；范围内最后一架干扰机被击毁（或被瘫痪）的那一步立即恢复，瘫痪结束后继续干扰。
   */
  private reviewEnemies(playerPosition: THREE.Vector3): void {
    const enemies = this.levelManager.getEnemies();
    const jamRangeSq = JAMMER_TUNING.JAM_RANGE * JAMMER_TUNING.JAM_RANGE;
    let locking = false;
    let jammed = false;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.isAlive()) continue;
      if (enemy.isMissileLocking()) locking = true;
      if (
        !jammed &&
        enemy.getConfig().type === EnemyType.JAMMER &&
        !enemy.isStunned() &&
        enemy.getMesh().position.distanceToSquared(playerPosition) <= jamRangeSq
      ) {
        jammed = true;
      }
    }
    this.lockTimeScale = jammed ? JAMMER_TUNING.LOCK_TIME_MULTIPLIER : 1;
    if (locking || this.missileLockWarning) {
      this.missileLockWarning = locking;
      this.missileLauncher?.setLockWarning(locking);
    }
  }

  /**
   * 接入敌机导弹的发射通道（GameCoordinator 用单位系统实现）。传 null 断开：敌机不再锁定、
   * 不发射导弹。
   */
  setMissileLauncher(launcher: IJetMissileLauncher | null): void {
    this.missileLauncher = launcher;
    this.missileLockWarning = false;
  }

  /**
   * 玩家导弹锁定时间的倍数（干扰）：1 = 正常；有存活的干扰机在玩家 800 米内时为 2。
   * 只影响导引头的锁定计时，机炮与导引头的其余部分不变。
   */
  getLockTimeScale(): number {
    return this.lockTimeScale;
  }

  /**
   * 接入玩家威胁提供者（GameCoordinator 实现：导引头锁定目标、在飞导弹、机头方向、是否复活中）。
   * 传 null 断开：敌机视为不受威胁、玩家始终可被攻击。
   */
  setThreatProvider(provider: IJetThreatProvider | null): void {
    this.threatProvider = provider;
  }

  /** 攻击令牌导演（调试 / 测试用） */
  getAttackDirector(): AttackDirector {
    return this.attackDirector;
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
    this.attackDirector.reset();
    this.clearJetEffects();
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
    this.attackDirector.reset();
    this.clearJetEffects();
    this.resetPlayerMotion();
  }

  /** 换关 / 清场：没有敌机了，干扰与导弹锁定预警随之结束 */
  private clearJetEffects(): void {
    this.lockTimeScale = 1;
    if (this.missileLockWarning) {
      this.missileLockWarning = false;
      this.missileLauncher?.setLockWarning(false);
    }
  }

  setDifficultyProfile(profile: DifficultyProfile): void {
    this.levelManager.setDifficultyProfile(profile);
    this.difficultyLevel = profile.level;
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

  /**
   * 在指定位置生成一架敌机（Boss 召唤小兵；开发钩子传 counted = false，不计入关卡的已生成数）。
   */
  spawnEnemyAt(
    type: import('@/features/enemy/EnemyTypes').EnemyType,
    position: THREE.Vector3,
    counted: boolean = true
  ): void {
    if (counted) {
      this.levelManager.spawnEnemyAtPosition(type, position);
    } else {
      this.levelManager.spawnEnemyAtPosition(type, position, false);
    }
  }

  /** 开发钩子：移除所有在场敌机（不计分、不触发击杀事件），返回移除的架数 */
  removeAllEnemies(): number {
    this.attackDirector.reset();
    this.clearJetEffects();
    return this.levelManager.removeAllEnemies();
  }
}
