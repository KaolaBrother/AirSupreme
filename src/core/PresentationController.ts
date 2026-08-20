import type { Camera, Object3D, Quaternion, Vector3 } from 'three';
import { HUD } from '@/ui/HUD';
import { StartMenu, GameSettings } from '@/ui/StartMenu';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { LockOnIndicator } from '@/ui/LockOnIndicator';
import { RadarMinimap, type RadarBlip } from '@/ui/RadarMinimap';
import { HUD_COLORS, injectHudTokens } from '@/ui/theme/hudTokens';

export type { RadarBlip } from '@/ui/RadarMinimap';

export interface HudSnapshot {
  healthPercent: number;
  speed: number;
  score: number;
  aliveEnemies: number;
  remainingEnemies: number;
  lives: number;
  isPlaying: boolean;
}

export interface MissileHudSnapshot {
  missileCount: number;
  missileProgress: number;
}

export interface HealthBarSnapshot {
  mesh: Object3D;
  currentHealth: number;
  maxHealth: number;
}

export interface BossMissileIndicatorSnapshot {
  id: string;
  worldPos: Vector3;
  distance: number;
  inView: boolean;
}

interface PresentationControllerOptions {
  hud: HUD;
  startMenu?: StartMenu | null;
  enemyHealthBars: EnemyHealthBars;
  bossIndicator: BossMissileIndicator;
  lockOnIndicator: LockOnIndicator;
  uiUpdateInterval?: number;
}

type EventObjectiveTone = 'default' | 'complete';

/**
 * 表现层控制器
 * 只负责 UI/指示器编排，不持有游戏玩法状态。
 */
export class PresentationController {
  private readonly hud: HUD;
  private readonly startMenu: StartMenu | null;
  private readonly enemyHealthBars: EnemyHealthBars;
  private readonly bossIndicator: BossMissileIndicator;
  private readonly lockOnIndicator: LockOnIndicator;
  private readonly uiUpdateInterval: number;
  private static readonly EVENT_OBJECTIVE_STATUS_THROTTLE_MS = 300;

  private uiUpdateAccumulator: number = 0;
  private missileUiAccumulator: number = 0;
  private lastMissileCount: number | null = null;
  private lastEventObjectiveTone: EventObjectiveTone = 'default';
  private lastEventObjectiveTitle: string = '';
  private lastEventObjectiveText: string = '';
  private lastEventObjectiveStatus: string = '';
  private lastEventObjectiveStatusUpdatedAt: number = 0;
  private radar: RadarMinimap | null = null;
  private readonly hitMarkers: HTMLDivElement[] = [];
  private readonly hitMarkerTimeouts: number[] = [];
  private hitMarkerCursor: number = 0;
  private static readonly HIT_MARKER_POOL = 8;
  private static readonly HIT_MARKER_SIZE_PX = 12;
  private static readonly HIT_MARKER_DURATION_MS = 80;

  constructor(options: PresentationControllerOptions) {
    injectHudTokens();
    this.hud = options.hud;
    this.startMenu = options.startMenu ?? null;
    this.enemyHealthBars = options.enemyHealthBars;
    this.bossIndicator = options.bossIndicator;
    this.lockOnIndicator = options.lockOnIndicator;
    this.uiUpdateInterval = options.uiUpdateInterval ?? 1 / 30;
  }

  public initializeCombatUi(): void {
    injectHudTokens();
    this.hud.init();
    this.enemyHealthBars.init();
    this.lockOnIndicator.init();
    this.bossIndicator.init();
    this.ensureRadar();
    this.ensureHitMarkers();
  }

  public wireStartMenu(onStart: (settings: GameSettings) => void): void {
    this.startMenu?.setOnStart(onStart);
  }

  /**
   * 对常规 HUD 做节流更新，降低高频 DOM 压力。
   */
  public updateHud(deltaTime: number, snapshot: HudSnapshot): boolean {
    this.uiUpdateAccumulator += deltaTime;
    if (this.uiUpdateAccumulator < this.uiUpdateInterval) {
      return false;
    }

    const uiDeltaTime = this.uiUpdateAccumulator;
    this.uiUpdateAccumulator = 0;

    this.hud.updateHealth(snapshot.healthPercent);
    this.hud.updateSpeed(snapshot.speed);
    this.hud.updateScore(snapshot.score);
    this.hud.updateEnemies(snapshot.aliveEnemies);
    this.hud.updateRemainingEnemies(snapshot.remainingEnemies);
    this.hud.updateLives(snapshot.lives);
    this.hud.update(snapshot.isPlaying ? uiDeltaTime : 0);
    if (typeof this.lockOnIndicator.setPaused === 'function') {
      this.lockOnIndicator.setPaused(!snapshot.isPlaying);
    }
    return true;
  }

  public resetHudThrottle(): void {
    this.uiUpdateAccumulator = 0;
    this.missileUiAccumulator = 0;
    this.lastMissileCount = null;
  }

  public updateMissileHud(
    deltaTime: number,
    snapshot: MissileHudSnapshot,
    force: boolean = false
  ): void {
    const clampedProgress = Math.max(0, Math.min(1, snapshot.missileProgress));
    this.missileUiAccumulator += deltaTime;

    const shouldUpdate =
      force ||
      this.lastMissileCount !== snapshot.missileCount ||
      this.missileUiAccumulator >= this.uiUpdateInterval;

    if (!shouldUpdate) {
      return;
    }

    this.hud.updateMissiles(snapshot.missileCount);
    this.hud.updateMissileProgress(clampedProgress);
    this.lastMissileCount = snapshot.missileCount;
    this.missileUiAccumulator = 0;
  }

  public updateEnemyHealthBars(
    enemyData: HealthBarSnapshot[],
    friendlyData: HealthBarSnapshot[],
    camera: Camera,
    playerPosition: Vector3
  ): void {
    this.enemyHealthBars.update(enemyData, friendlyData, camera, playerPosition);
  }

  public updateBossMissileIndicators(
    indicatorData: BossMissileIndicatorSnapshot[],
    camera: Camera
  ): void {
    this.bossIndicator.update(indicatorData, camera);
  }

  public clearBossMissileIndicators(): void {
    this.bossIndicator.clear();
  }

  public updateRadar(
    playerPos: Vector3,
    blips: RadarBlip[],
    playerRotation: Quaternion
  ): void {
    this.ensureRadar();
    this.radar?.updateBlips(playerPos, blips, playerRotation);
  }

  /**
   * 玩家命中反馈：8 个 12px 标记，80ms 后回收。
   */
  public requestHitMarker(screenX: number, screenY: number): void {
    this.ensureHitMarkers();
    if (this.hitMarkers.length === 0) {
      return;
    }

    const index = this.hitMarkerCursor % this.hitMarkers.length;
    this.hitMarkerCursor += 1;
    const marker = this.hitMarkers[index];
    marker.style.left = `${screenX}px`;
    marker.style.top = `${screenY}px`;
    marker.style.display = 'block';
    marker.style.opacity = '1';

    if (this.hitMarkerTimeouts[index]) {
      window.clearTimeout(this.hitMarkerTimeouts[index]);
    }
    this.hitMarkerTimeouts[index] = window.setTimeout(() => {
      marker.style.display = 'none';
      marker.style.opacity = '0';
      this.hitMarkerTimeouts[index] = 0;
    }, PresentationController.HIT_MARKER_DURATION_MS);
  }

  private ensureRadar(): void {
    if (!this.radar) {
      this.radar = new RadarMinimap();
    }
  }

  private ensureHitMarkers(): void {
    if (this.hitMarkers.length > 0) {
      return;
    }

    for (let i = 0; i < PresentationController.HIT_MARKER_POOL; i++) {
      const marker = document.createElement('div');
      marker.className = 'hit-marker';
      marker.style.cssText = `
        position: fixed;
        width: ${PresentationController.HIT_MARKER_SIZE_PX}px;
        height: ${PresentationController.HIT_MARKER_SIZE_PX}px;
        margin-left: -${PresentationController.HIT_MARKER_SIZE_PX / 2}px;
        margin-top: -${PresentationController.HIT_MARKER_SIZE_PX / 2}px;
        pointer-events: none;
        display: none;
        opacity: 0;
        z-index: 48;
        box-sizing: border-box;
        border: 1px solid var(--hud-weapon, ${HUD_COLORS.weapon});
        box-shadow: 0 0 6px var(--hud-weapon, ${HUD_COLORS.weapon});
        transform: rotate(45deg);
      `;
      document.body.appendChild(marker);
      this.hitMarkers.push(marker);
      this.hitMarkerTimeouts.push(0);
    }
  }

  private disposeHitMarkers(): void {
    for (const timeoutId of this.hitMarkerTimeouts) {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
    this.hitMarkerTimeouts.length = 0;
    for (const marker of this.hitMarkers) {
      marker.remove();
    }
    this.hitMarkers.length = 0;
    this.hitMarkerCursor = 0;
  }

  public showEventObjective(title: string, objective: string, status?: string): void {
    this.updateEventObjective('default', title, objective, status);
  }

  public showCompletedEventObjective(title: string, objective: string, status?: string): void {
    this.updateEventObjective('complete', title, objective, status);
  }

  private updateEventObjective(
    tone: EventObjectiveTone,
    title: string,
    objective: string,
    status?: string
  ): void {
    const normalizedStatus = status ?? '';
    const now = Date.now();

    const titleChanged =
      this.lastEventObjectiveTone !== tone ||
      this.lastEventObjectiveTitle !== title ||
      this.lastEventObjectiveText !== objective;
    const statusChanged = this.lastEventObjectiveStatus !== normalizedStatus;

    if (!titleChanged && !statusChanged) {
      return;
    }

    if (!titleChanged && now - this.lastEventObjectiveStatusUpdatedAt < PresentationController.EVENT_OBJECTIVE_STATUS_THROTTLE_MS) {
      return;
    }

    if (titleChanged) {
      if (tone === 'complete') {
        this.hud.showCompletedEventObjective(title, objective, normalizedStatus);
      } else {
        this.hud.showEventObjective(title, objective, normalizedStatus);
      }
    } else {
      this.hud.updateEventObjectiveStatus(normalizedStatus);
    }

    this.lastEventObjectiveTone = tone;
    this.lastEventObjectiveTitle = title;
    this.lastEventObjectiveText = objective;
    this.lastEventObjectiveStatus = normalizedStatus;
    this.lastEventObjectiveStatusUpdatedAt = now;
  }

  public updateEventObjectiveStatus(status: string): void {
    this.hud.updateEventObjectiveStatus(status);
  }

  public clearEventObjective(): void {
    this.hud.hideEventObjective();
    this.lastEventObjectiveTone = 'default';
    this.lastEventObjectiveTitle = '';
    this.lastEventObjectiveText = '';
    this.lastEventObjectiveStatus = '';
    this.lastEventObjectiveStatusUpdatedAt = 0;
  }

  public dispose(): void {
    this.hud.dispose();
    this.enemyHealthBars.dispose();
    this.lockOnIndicator.dispose();
    this.bossIndicator.dispose();
    this.radar?.dispose();
    this.radar = null;
    this.disposeHitMarkers();
    this.startMenu?.dispose();
  }
}
