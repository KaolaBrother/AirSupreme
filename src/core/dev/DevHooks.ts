import * as THREE from 'three';
import type { BossBattleController } from '@/core/BossBattleController';
import type { MusicSystem } from '@/core/Audio/MusicSystem';
import type { VoiceKind, VoiceSystem } from '@/core/Audio/VoiceSystem';
import type { WingmanEvent, WingmanId } from '@/core/campaign/Wingmen';
import type { GenericRadioKey } from '@/features/campaign/CampaignData';
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
import { POWER_UP_CONFIGS, PowerUpType } from '@/features/powerups/PowerUpSystem';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { installBalanceHarness } from './BalanceHarness';

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
  /** 瞄准 / 导弹状态：准星屏幕位置、捕获环与保持环半径、锁定状态与进度、导弹余量 */
  getAimState?(): Record<string, unknown>;
  clickHangarContinue(): void;
  /** 瞬移之后：同步插值状态、相机就位、清掉拖尾 */
  onPlayerTeleported(): void;
  /** 音乐状态（当前曲目 / 强度 / 是否在播） */
  getMusicState(): { track: string | null; intensity: number; playing: boolean };
  /** 战役表现层：剧情卡片 / 无线电是否在显示 */
  isStoryActive(): boolean;
  isRadioBusy(): boolean;
  /** 配音：状态、电平测量、触发台词 */
  getVoice(): VoiceSystem;
  getMusic(): MusicSystem;
  playGenericRadio(key: GenericRadioKey): void;
  onWingmanEvent(id: WingmanId, event: WingmanEvent): void;
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

/** spawnEnemy 的缺省值与范围 */
const SPAWN_DEFAULT_DISTANCE = 450;
const SPAWN_MAX_COUNT = 12;
/** 一次生成多架时相邻两架错开的方位角（度） */
const SPAWN_FAN_STEP_DEG = 12;
/** 生成点至少高出地表这么多（米），与波次生成一致 */
const SPAWN_TERRAIN_CLEARANCE = 45;

export interface DevSpawnEnemyOptions {
  /** 离玩家的水平距离（米），缺省 450 */
  distance?: number;
  /** 相对玩家机头的方位（度）：0 = 正前方，90 = 右侧，180 = 正后方；缺省 0 */
  bearingDeg?: number;
  /** 架数（1..12），缺省 1；多架时以该方位为中心每架错开 12° */
  count?: number;
}

export interface DevJetEntry {
  type: string;
  health: number;
  position: Vec3Like;
  distance: number;
  /** 条令当前阶段的简短名字（瘫痪时为 'stunned'） */
  phase: string;
  hasAttackToken: boolean;
  cloaked: boolean;
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
        forward: toPlain(tmp.set(0, 0, -1).applyQuaternion(player.quaternion)),
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
      aim: access.getAimState?.() ?? null,
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
      music: access.getMusicState(),
      story: { active: access.isStoryActive(), radioBusy: access.isRadioBusy() },
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

  /** 高级 Boss 的子目标（护盾塔 / 气囊 / 散热口……）：位置、血量与当前伤害倍率 */
  const bossSubTargets = (): Array<Record<string, unknown>> => {
    const boss = access.getBossController()?.getCurrentBoss() ?? null;
    if (!isAdvancedBoss(boss) || !boss.getSubTargets) return [];
    return boss.getSubTargets().map((target) => ({
      name: target.mesh.name,
      current: Math.round(target.current),
      max: Math.round(target.max),
      multiplier: round(boss.getDamageMultiplier(target.mesh)),
      position: toPlain(target.mesh.getWorldPosition(new THREE.Vector3())),
    }));
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
    access.onPlayerTeleported();
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
      stunned: unit.isStunned(),
      position: toPlain(unit.getPosition(new THREE.Vector3())),
    }));

  /**
   * 在玩家周围生成敌机：走 Boss 召唤小兵的同一条生成路径（按当前关卡 / 难度缩放、带机型条令、
   * 接好开火与击杀事件），但不计入关卡的“已生成”数。type 为 EnemyType 的名字（不分大小写）。
   * 返回实际生成的架数（类型无效或敌机系统未就绪时为 0）。
   */
  const spawnEnemy = (type: string, opts: DevSpawnEnemyOptions = {}): number => {
    const enemySystem = access.getEnemySystem();
    const key = String(type).toUpperCase();
    if (!enemySystem || !(Object.values(EnemyType) as string[]).includes(key)) return 0;
    const distance =
      typeof opts.distance === 'number' && Number.isFinite(opts.distance)
        ? Math.max(30, Math.min(2000, opts.distance))
        : SPAWN_DEFAULT_DISTANCE;
    const bearing =
      typeof opts.bearingDeg === 'number' && Number.isFinite(opts.bearingDeg) ? opts.bearingDeg : 0;
    const count =
      typeof opts.count === 'number' && Number.isFinite(opts.count)
        ? Math.max(1, Math.min(SPAWN_MAX_COUNT, Math.floor(opts.count)))
        : 1;

    // 玩家的水平航向（机头接近竖直时朝 -Z）
    const player = access.getPlayerAircraft();
    tmp.set(0, 0, -1).applyQuaternion(player.quaternion);
    let headingX = tmp.x;
    let headingZ = tmp.z;
    const length = Math.hypot(headingX, headingZ);
    if (length > 1e-3 && Number.isFinite(length)) {
      headingX /= length;
      headingZ /= length;
    } else {
      headingX = 0;
      headingZ = -1;
    }

    const levelManager = enemySystem.getLevelManager();
    for (let i = 0; i < count; i++) {
      const angle = ((bearing + (i - (count - 1) / 2) * SPAWN_FAN_STEP_DEG) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // 前向 × cos + 右向 × sin；右向 = (-z, x)
      const x = player.position.x + (headingX * cos - headingZ * sin) * distance;
      const z = player.position.z + (headingZ * cos + headingX * sin) * distance;
      let y = player.position.y;
      const ground = levelManager.getCrashSurfaceY(x, z);
      if (Number.isFinite(ground)) y = Math.max(y, ground + SPAWN_TERRAIN_CLEARANCE);
      enemySystem.spawnEnemyAt(key as EnemyType, new THREE.Vector3(x, y, z), false);
    }
    return count;
  };

  /** 存活敌机明细：机型 / 血量 / 位置 / 离玩家的距离 / 条令阶段 / 是否持有攻击令牌 / 是否隐形 */
  const listJets = (): DevJetEntry[] => {
    const player = access.getPlayerAircraft();
    const jets: DevJetEntry[] = [];
    for (const enemy of access.getEnemySystem()?.getEnemies() ?? []) {
      if (!enemy.isAlive()) continue;
      const mesh = enemy.getMesh();
      jets.push({
        type: enemy.getConfig().type,
        health: round(enemy.getHealth().current),
        position: toPlain(mesh.position),
        distance: round(mesh.position.distanceTo(player.position)),
        phase: enemy.getDoctrinePhase(),
        hasAttackToken: enemy.hasAttackToken(),
        // 隐形机（WRAITH）的隐形周期在后续里程碑加入；在那之前没有敌机会隐形
        cloaked: false,
      });
    }
    return jets;
  };

  /** 移除所有在场敌机（不计分、不触发击杀事件），返回移除的架数 */
  const clearJets = (): number => access.getEnemySystem()?.removeAllEnemies() ?? 0;

  /** 暂停 / 恢复常规波次（不生成、不结算、不进入下一波），便于单独研究某个机型；返回当前状态 */
  const holdWaves = (on: boolean): boolean => {
    const levelManager = access.getEnemySystem()?.getLevelManager();
    if (!levelManager) return false;
    levelManager.setWaveSpawningHeld(on === true);
    return levelManager.isWaveSpawningHeld();
  };

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

  /** 配音探针：人声 / 音乐总线电平（AnalyserNode，dBFS RMS）+ 闪避增益 + 配音状态 */
  let voiceAnalyser: AnalyserNode | null = null;
  let musicAnalyser: AnalyserNode | null = null;
  let meterBuffer: Float32Array<ArrayBuffer> | null = null;
  const rmsDb = (analyser: AnalyserNode | null): number | null => {
    if (!analyser) return null;
    if (!meterBuffer || meterBuffer.length !== analyser.fftSize) {
      meterBuffer = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    }
    analyser.getFloatTimeDomainData(meterBuffer);
    let sum = 0;
    for (const sample of meterBuffer) sum += sample * sample;
    const rms = Math.sqrt(sum / meterBuffer.length);
    return rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -120;
  };
  const voiceHooks = {
    state: () => access.getVoice().getDebugState(),
    /** 一次采样：两条总线的 RMS、音乐上的配音闪避增益、当前台词 */
    sample: () => {
      voiceAnalyser ??= access.getVoice().createOutputAnalyser();
      musicAnalyser ??= access.getMusic().createOutputAnalyser();
      const state = access.getVoice().getDebugState();
      return {
        t: Math.round(performance.now()),
        voiceDb: rmsDb(voiceAnalyser),
        musicDb: rmsDb(musicAnalyser),
        duck: access.getMusic().getVoiceDuckLevel(),
        line: state.current?.lineId ?? null,
        phase: state.current?.phase ?? null,
        language: state.language,
      };
    },
    say: (lineId: string, kind: VoiceKind = 'radio') =>
      access.getVoice().play(lineId, { kind, speaker: kind === 'radio' ? 'hq' : null }),
    radio: (key: GenericRadioKey) => access.playGenericRadio(key),
    wingman: (id: WingmanId, event: WingmanEvent) => access.onWingmanEvent(id, event),
  };

  const hooks = {
    getState,
    voice: voiceHooks,
    listUnits,
    spawnEnemy,
    listJets,
    clearJets,
    holdWaves,
    bossSubTargets,
    setGodMode: (on: boolean) => {
      godMode = on === true;
      return godMode;
    },
    killWave,
    hitBoss,
    placePlayerFacing,
    nearestUnit,
    /** 地表采样（验证出生点 / 地形） */
    sampleSurface: (x: number, z: number) => {
      const sample = access.getEnemySystem()?.getLevelManager().getSurfaceSample(x, z);
      return sample ? { y: round(sample.y), water: sample.water } : null;
    },
    setTimeScale: (scale: number) => access.gameLoop.setTimeScale(scale),
    continueHangar: () => access.clickHangarContinue(),
    /** 直接扣血（无视无敌模式，测试阵亡 / 结算 / 检查点继续） */
    damagePlayer: (amount: number) => {
      originalTakeDamage(Number.isFinite(amount) ? amount : 0);
    },
    healPlayer: () => {
      const playerSystem = access.getPlayerSystem();
      playerSystem.syncMaxHealth();
      playerSystem.getHealth().healToMax();
    },
    /** 发放道具：走拾取时的 POWERUP_COLLECTED 处理（HUD 倒计时、效果、音效）；缺省伤害提升 */
    grantPowerUp: (type: string = PowerUpType.DAMAGE): PowerUpType => {
      const key = (Object.values(PowerUpType) as string[]).includes(type)
        ? (type as PowerUpType)
        : PowerUpType.DAMAGE;
      EventBus.emit(GameEventType.POWERUP_COLLECTED, { type: key, config: POWER_UP_CONFIGS[key] });
      return key;
    },
    /** 难度 / 成长曲线测量：脚本飞行员 + 自动机库 + 逐关统计（见 BalanceHarness） */
    balance: installBalanceHarness(access),
  };
  (window as unknown as { __AIR_SUPREME_DEV__?: typeof hooks }).__AIR_SUPREME_DEV__ = hooks;
}
