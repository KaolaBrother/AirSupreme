import type * as THREE from 'three';
import type { BossBattleController } from '@/core/BossBattleController';
import type { GameSessionState } from '@/core/GameSessionState';
import type {
  HealthBarSnapshot,
  PresentationController,
  RadarBlip,
} from '@/core/PresentationController';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { UnitController } from '@/core/units/UnitController';
import type { UnitRadarKind } from '@/features/units/UnitTypes';

export interface CombatHudFeedDeps {
  session: GameSessionState;
  units: UnitController;
  camera: THREE.Camera;
  getEnemySystem(): EnemySystem | null;
  getBossController(): BossBattleController | null;
  getPresentationController(): PresentationController | null;
  getPlayerPosition(): THREE.Vector3;
  getPlayerQuaternion(): THREE.Quaternion;
}

/** 第三关章鱼战舰的眼睛（各自带血量） */
interface EyeBossLike {
  isAlive(): boolean;
  getEyeSystem(): {
    getCollisionParts(): Array<{ index: number; mesh: THREE.Object3D }>;
    getEyeHealth(index: number): { current: number; max: number } | null | undefined;
  };
}

/** 雷达刷新间隔（秒）：整盘重绘，20 Hz 足够跟上目标运动 */
const RADAR_INTERVAL = 1 / 20;
/** 判定“正在从传送门进场”的距离（米） */
const PORTAL_SPAWN_RADIUS_SQ = 1;

/** 单位雷达类型 → 雷达点种类（敌方空中单位与敌机同色，友军单位用三角） */
const UNIT_RADAR_KIND: Readonly<Record<UnitRadarKind, RadarBlip['kind']>> = {
  'enemy-air': 'enemy',
  'enemy-ground': 'enemy-ground',
  'enemy-sea': 'enemy-sea',
  ally: 'ally-unit',
  neutral: 'neutral',
};

function isEyeBoss(boss: unknown): boss is EyeBossLike {
  if (!boss || typeof boss !== 'object') return false;
  const candidate = boss as Partial<EyeBossLike>;
  return typeof candidate.getEyeSystem === 'function' && typeof candidate.isAlive === 'function';
}

/**
 * 战斗 HUD 数据馈送：雷达点（敌机 / 进场传送门 / 僚机 / 地面海上空中单位 / Boss）与
 * 血条快照（敌机、敌方地面海上空中单位、Boss、第三关眼睛、第 6-10 关子目标、僚机）。
 *
 * 雷达点与血条快照都来自复用池，逐帧不分配新对象；雷达限频 20 Hz。
 */
export class CombatHudFeed {
  private readonly blips: RadarBlip[] = [];
  private readonly blipPool: RadarBlip[] = [];
  private radarTimer = 0;
  private readonly enemyBars: HealthBarSnapshot[] = [];
  private readonly friendlyBars: HealthBarSnapshot[] = [];
  private readonly barPool: HealthBarSnapshot[] = [];
  private barPoolUsed = 0;
  /** 本次血条快照里敌方单位是否按“目标”样式标记（敌机清空后它们拖住波次） */
  private unitObjective = false;

  constructor(private readonly deps: CombatHudFeedDeps) {}

  /** 下一次 updateRadar 立即重绘（换关 / 继续游戏） */
  public resetRadarThrottle(): void {
    this.radarTimer = 0;
  }

  // ───────────────────────────── 雷达 ─────────────────────────────

  private pushBlip(position: THREE.Vector3, kind: RadarBlip['kind']): void {
    const index = this.blips.length;
    let blip = this.blipPool[index];
    if (!blip) {
      blip = { position, kind };
      this.blipPool.push(blip);
    }
    blip.position = position;
    blip.kind = kind;
    this.blips.push(blip);
  }

  public updateRadar(deltaTime: number): void {
    this.radarTimer -= deltaTime;
    if (this.radarTimer > 0) return;
    this.radarTimer = RADAR_INTERVAL;
    const presentation = this.deps.getPresentationController();
    if (!presentation) return;

    this.blips.length = 0;
    const enemySystem = this.deps.getEnemySystem();
    const levelManager = enemySystem?.getLevelManager() ?? null;
    const portals = levelManager ? levelManager.getActivePortalPositions() : null;

    if (enemySystem) {
      for (const enemy of enemySystem.getEnemies()) {
        if (!enemy.isAlive()) continue;
        const position = enemy.getMesh().position;
        let spawning = false;
        if (portals) {
          for (const portal of portals) {
            if (portal.distanceToSquared(position) < PORTAL_SPAWN_RADIUS_SQ) {
              spawning = true;
              break;
            }
          }
        }
        this.pushBlip(position, spawning ? 'spawning' : 'enemy');
      }
      if (portals) {
        for (const portal of portals) this.pushBlip(portal, 'spawning');
      }
      for (const friendly of enemySystem.getFriendlyAIs()) {
        if (friendly.isAlive()) this.pushBlip(friendly.getMesh().position, 'ally');
      }
    }

    // 地面 / 海上 / 空中单位：敌方地面方块、敌舰菱形、友军三角、平民灰圈
    for (const unitBlip of this.deps.units.getRadarBlips()) {
      this.pushBlip(unitBlip.position, UNIT_RADAR_KIND[unitBlip.kind] ?? 'enemy');
    }

    const bossController = this.deps.getBossController();
    const boss = bossController?.getCurrentBoss() ?? null;
    // 隐形中的幻影之翼不出现在雷达上
    if (boss?.isAlive() && !bossController?.isBossHiddenFromSensors()) {
      this.pushBlip(boss.getMesh().position, 'boss');
    }

    // 展开的关卡地图的地形底图：采样器与关卡号（换关后重新采样；没变时是空操作）
    presentation.setRadarTerrainSource(
      this.deps.units.getSurfaceSampler(),
      this.deps.units.getCurrentLevel()
    );
    presentation.updateRadar(
      this.deps.getPlayerPosition(),
      this.blips,
      this.deps.getPlayerQuaternion()
    );
  }

  // ───────────────────────────── 血条 ─────────────────────────────

  private takeBar(mesh: THREE.Object3D, current: number, max: number): HealthBarSnapshot {
    let bar = this.barPool[this.barPoolUsed];
    if (!bar) {
      bar = { mesh, currentHealth: current, maxHealth: max };
      this.barPool.push(bar);
    }
    this.barPoolUsed++;
    bar.mesh = mesh;
    bar.currentHealth = current;
    bar.maxHealth = max;
    bar.objective = false;
    return bar;
  }

  /** 敌方单位的标记（预先绑定，逐帧不创建闭包） */
  private readonly pushUnitBar = (
    mesh: THREE.Object3D,
    currentHealth: number,
    maxHealth: number
  ): void => {
    const bar = this.takeBar(mesh, currentHealth, maxHealth);
    bar.objective = this.unitObjective;
    this.enemyBars.push(bar);
  };

  private readonly pushSubTargetBar = (
    mesh: THREE.Object3D,
    currentHealth: number,
    maxHealth: number
  ): void => {
    this.enemyBars.push(this.takeBar(mesh, currentHealth, maxHealth));
  };

  /** 血条快照（HUD 节流后调用，约 30 Hz） */
  public updateHealthBars(): void {
    const presentation = this.deps.getPresentationController();
    if (!presentation) return;
    this.barPoolUsed = 0;
    const enemyBars = this.enemyBars;
    const friendlyBars = this.friendlyBars;
    enemyBars.length = 0;
    friendlyBars.length = 0;

    const enemySystem = this.deps.getEnemySystem();
    if (enemySystem) {
      for (const enemy of enemySystem.getEnemies()) {
        if (!enemy.isAlive()) continue;
        enemyBars.push(
          this.takeBar(enemy.getMesh(), enemy.getHealth().current, enemy.getConfig().health)
        );
      }
      for (const friendly of enemySystem.getFriendlyAIs()) {
        if (!friendly.isAlive()) continue;
        const health = friendly.getHealth();
        friendlyBars.push(this.takeBar(friendly.getMesh(), health.current, health.max));
      }
    }

    // 敌方地面 / 海上 / 空中单位：与敌机一样有血条、名称与屏幕外箭头；只标可被命中的
    // （潜航中的潜艇不标）。敌机清空后它们拖住波次时换成“目标”样式。友军 / 平民单位不在此列。
    this.unitObjective = this.deps.units.isObjectiveActive();
    this.deps.units.forEachHostileMarker(this.pushUnitBar);

    const session = this.deps.session;
    const bossController = this.deps.getBossController();
    const boss = bossController?.getCurrentBoss() ?? null;
    if ((session.isBossMode() || session.isInBossBattle()) && boss && boss.isAlive()) {
      const health = boss.getHealth();
      enemyBars.push(this.takeBar(boss.getMesh(), health.current, health.max));

      // 第三关 Boss 的眼睛
      if (isEyeBoss(boss)) {
        const eyeSystem = boss.getEyeSystem();
        for (const part of eyeSystem.getCollisionParts()) {
          const eyeHealth = eyeSystem.getEyeHealth(part.index);
          if (eyeHealth) {
            enemyBars.push(this.takeBar(part.mesh, eyeHealth.current, eyeHealth.max));
          }
        }
      }
    }

    // 第 6-10 关 Boss 的子目标（护盾塔 / 气囊 / 散热口 / 发射器……）
    bossController?.forEachSubTargetBar(this.pushSubTargetBar);

    presentation.updateEnemyHealthBars(
      enemyBars,
      friendlyBars,
      this.deps.camera,
      this.deps.getPlayerPosition()
    );
  }
}
