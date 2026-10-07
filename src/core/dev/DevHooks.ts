import * as THREE from 'three';
import type { BossBattleController } from '@/core/BossBattleController';
import type { GameLoop } from '@/core/GameLoop';
import type { GameSessionState } from '@/core/GameSessionState';
import type { PlayerViewController } from '@/core/camera/PlayerViewController';
import type { SpecialWeaponsController } from '@/core/combat/SpecialWeaponsController';
import { isAdvancedBoss } from '@/features/boss/BossContracts';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { UnitController } from '@/core/units/UnitController';
import type { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { CAMPAIGN_SAVE_KEY } from '@/core/save/SaveSystem';
import { Faction } from '@/core/Faction';
import { EventBus, GameEventType } from '@/core/EventBus';

/**
 * 开发构建专用调试钩子（window.__AIR_SUPREME_DEV__）。
 *
 * 只在 import.meta.env.DEV 为 true 时由 GameCoordinator 动态导入；生产构建中该导入分支被
 * 常量折叠裁剪，本模块不会进入产物。用于软件渲染（1-4 fps）下的端到端验证：读取状态、
 * 加速模拟、清空当前波次、对 Boss 造成伤害、把玩家摆到目标前方。
 */

export interface DevHookAccess {
  gameLoop: GameLoop;
  getSession(): GameSessionState;
  getEnemySystem(): EnemySystem | null;
  getBossController(): BossBattleController | null;
  getUnits(): UnitController;
  getWeapons(): SpecialWeaponsController;
  getView(): PlayerViewController;
  getPlayerSystem(): PlayerSystem;
  getPlayerAircraft(): THREE.Object3D;
  getScore(): number;
  getStats(): PlayerStats;
  isStoryHold(): boolean;
  getUpgradeMenuVisible(): boolean;
  clickHangarContinue(): void;
}

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function toPlain(vector: THREE.Vector3): Vec3Like {
  return { x: round(vector.x), y: round(vector.y), z: round(vector.z) };
}

export function installDevHooks(access: DevHookAccess): void {
  const tmp = new THREE.Vector3();
  const lookHelper = new THREE.Object3D();
  const playerHits = { count: 0, damage: 0 };
  EventBus.on(GameEventType.PLAYER_HIT, ({ payload }) => {
    playerHits.count++;
    playerHits.damage += payload.damage;
  });

  const getState = (): Record<string, unknown> => {
    const session = access.getSession();
    const enemySystem = access.getEnemySystem();
    const levelManager = enemySystem?.getLevelManager();
    const boss = access.getBossController()?.getCurrentBoss() ?? null;
    const advanced = isAdvancedBoss(boss) ? boss : null;
    const unitSystem = access.getUnits().getSystem();
    const units = unitSystem?.getUnits() ?? [];
    const unitTypes: Record<string, number> = {};
    for (const unit of units) {
      unitTypes[unit.type] = (unitTypes[unit.type] ?? 0) + 1;
    }
    const player = access.getPlayerAircraft();
    const playerSystem = access.getPlayerSystem();
    const surface = levelManager?.getSurfaceSample(player.position.x, player.position.z);
    let checkpoint: unknown = null;
    try {
      const raw = window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
      checkpoint = raw ? JSON.parse(raw) : null;
    } catch {
      checkpoint = null;
    }
    const weapons = access.getWeapons();
    return {
      level: session.getLevel(),
      wave: session.getWave(),
      mode: session.getMode(),
      playing: session.isPlaying(),
      paused: session.isPaused(),
      inBossBattle: session.isInBossBattle(),
      storyHold: access.isStoryHold(),
      hangarVisible: access.getUpgradeMenuVisible(),
      levelState: levelManager?.getState() ?? null,
      terrainId: levelManager?.getCurrentLevelConfig()?.terrain ?? null,
      waveIndex: levelManager?.getCurrentWaveIndex() ?? null,
      jetsAlive: enemySystem?.getAliveEnemyCount() ?? 0,
      friendlies: enemySystem?.getFriendlyAIs().length ?? 0,
      unitsAlive: units.length,
      hostileUnitsAlive: access.getUnits().getAliveHostileCount(),
      unitTypes,
      boss: boss
        ? {
            type: boss.getConfig().type,
            alive: boss.isAlive(),
            health: boss.getHealth(),
            position: toPlain(boss.getMesh().position),
            phase: advanced?.getPhase() ?? null,
            status: advanced?.getStatusLabel() ?? null,
            invulnerable: advanced?.isInvulnerable() ?? null,
            dying: access.getBossController()?.isBossDying() ?? false,
            hidden: access.getBossController()?.isBossHiddenFromSensors() ?? false,
            parts: boss.getCollisionParts().length,
            distance: round(boss.getMesh().position.distanceTo(player.position)),
          }
        : null,
      player: {
        position: toPlain(player.position),
        visible: player.visible,
        health: playerSystem.getHealth().getCurrentHealth(),
        maxHealth: playerSystem.getHealth().getMaxHealth(),
        lives: playerSystem.getLives(),
        respawning: playerSystem.isPlayerRespawning(),
        surfaceY: surface ? round(surface.y) : null,
        surfaceWater: surface?.water ?? null,
      },
      score: access.getScore(),
      upgradePoints: access.getStats().getUpgrades().getAvailablePoints(),
      campaignLevel: access.getStats().getUpgrades().getCampaignLevel(),
      cameraMode: access.getView().getMode(),
      cameraBlend: round(access.getView().getBlend()),
      weapons: {
        unlocked: weapons.getUnlocked(),
        selected: weapons.getSelected(),
        state: weapons.exportState(),
        projectiles: weapons.getActiveProjectileCount(),
        beam: weapons.isBeamActive(),
        flares: weapons.getFlareCharges(),
        maxFlares: weapons.getMaxFlareCharges(),
        decoys: weapons.getActiveDecoys().length,
      },
      timeScale: access.gameLoop.getTimeScale(),
      playerHits: { ...playerHits },
      blockedHits: { ...blockedHits },
      hazardHits: access.getBossController()?.getHazardHitCount() ?? 0,
      checkpoint,
    };
  };

  /** 清空当前波次：敌机与敌方单位全部击毁（计为玩家击杀） */
  const killWave = (): number => {
    let killed = 0;
    for (const enemy of access.getEnemySystem()?.getEnemies() ?? []) {
      if (enemy.isAlive()) {
        enemy.takeDamage(1e9);
        killed++;
      }
    }
    for (const unit of access.getUnits().getSystem()?.getUnits() ?? []) {
      if (unit.faction === Faction.ENEMY && unit.isAlive()) {
        unit.applyDamage(1e9, 'cannon');
        killed++;
      }
    }
    return killed;
  };

  /** 对当前 Boss 的每个可命中部件造成伤害（高级 Boss 走 takeDamageAt，包括护盾塔） */
  const hitBoss = (amount: number = 400): number => {
    const boss = access.getBossController()?.getCurrentBoss() ?? null;
    if (!boss || !boss.isAlive()) return 0;
    let hits = 0;
    if (isAdvancedBoss(boss)) {
      for (const part of [...boss.getCollisionParts()]) {
        boss.takeDamageAt(part, amount);
        hits++;
      }
    } else {
      boss.takeDamage(amount);
      hits = 1;
    }
    return hits;
  };

  /** 把玩家摆到目标前方 distance 米处并朝向目标（测试特殊武器命中） */
  const placePlayerFacing = (
    target: Vec3Like,
    distance: number = 140,
    height: number = 25
  ): void => {
    const player = access.getPlayerAircraft();
    tmp.set(target.x, target.y, target.z);
    const dirX = player.position.x - tmp.x;
    const dirZ = player.position.z - tmp.z;
    const length = Math.hypot(dirX, dirZ) || 1;
    const position = new THREE.Vector3(
      tmp.x + (dirX / length) * distance,
      tmp.y + height,
      tmp.z + (dirZ / length) * distance
    );
    lookHelper.position.copy(position);
    lookHelper.lookAt(tmp);
    // Object3D.lookAt 让本地 +Z 朝向目标；飞机机头为 -Z，再绕 Y 旋转 180°
    lookHelper.rotateY(Math.PI);
    access.getPlayerSystem().placeAt(position, lookHelper.quaternion);
  };

  const nearestUnit = (hostileOnly: boolean = true): Vec3Like | null => {
    const player = access.getPlayerAircraft();
    let best: THREE.Vector3 | null = null;
    let bestDistance = Infinity;
    for (const unit of access.getUnits().getSystem()?.getUnits() ?? []) {
      if (hostileOnly && unit.faction !== Faction.ENEMY) continue;
      if (!unit.isTargetable()) continue;
      const position = unit.getPosition(new THREE.Vector3());
      const distance = position.distanceTo(player.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = position;
      }
    }
    return best ? toPlain(best) : null;
  };

  /** 存活单位明细（类型 / 阵营 / 血量 / 位置 / 可否命中） */
  const listUnits = (): Array<Record<string, unknown>> =>
    (access.getUnits().getSystem()?.getUnits() ?? []).map((unit) => ({
      type: unit.type,
      faction: unit.faction,
      health: unit.getHealth(),
      targetable: unit.isTargetable(),
      position: toPlain(unit.getPosition(new THREE.Vector3())),
    }));

  /**
   * 无敌模式（只在开发构建里通过补丁实现，生产代码不含任何作弊开关）：
   * 屏蔽玩家受到的伤害，并在每个渲染帧把玩家抬到地表上方 60 米以上，便于长时间自动化流程测试。
   */
  let godMode = false;
  const blockedHits = { count: 0, damage: 0 };
  const health = access.getPlayerSystem().getHealth();
  const originalTakeDamage = health.takeDamage.bind(health);
  health.takeDamage = (amount: number): void => {
    if (godMode) {
      // 记录被屏蔽的伤害（验证 Boss 武器 / 特殊武器确实命中了玩家）
      if (amount < 1000) {
        blockedHits.count++;
        blockedHits.damage += amount;
      }
      return;
    }
    originalTakeDamage(amount);
  };
  const liftPlayer = (): void => {
    if (godMode) {
      const player = access.getPlayerAircraft();
      const levelManager = access.getEnemySystem()?.getLevelManager();
      if (levelManager && player.visible) {
        const ground = levelManager.getCrashSurfaceY(player.position.x, player.position.z);
        if (Number.isFinite(ground) && player.position.y < ground + 60) {
          player.position.y = ground + 60;
        }
      }
    }
    requestAnimationFrame(liftPlayer);
  };
  requestAnimationFrame(liftPlayer);

  const hooks = {
    getState,
    listUnits,
    setGodMode: (on: boolean) => {
      godMode = on === true;
      return godMode;
    },
    killWave,
    hitBoss,
    placePlayerFacing,
    nearestUnit,
    setTimeScale: (scale: number) => access.gameLoop.setTimeScale(scale),
    continueHangar: () => access.clickHangarContinue(),
    healPlayer: () => {
      const playerSystem = access.getPlayerSystem();
      playerSystem.syncMaxHealth();
      playerSystem.getHealth().healToMax();
    },
  };
  (window as unknown as { __AIR_SUPREME_DEV__?: typeof hooks }).__AIR_SUPREME_DEV__ = hooks;
}
