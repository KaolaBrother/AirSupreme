import type { Camera, Object3D, Vector3 } from 'three';
import { HUD } from '@/ui/HUD';
import { StartMenu, GameSettings } from '@/ui/StartMenu';
import { EnemyHealthBars } from '@/ui/EnemyHealthBars';
import { BossMissileIndicator } from '@/ui/BossMissileIndicator';
import { LockOnIndicator } from '@/ui/LockOnIndicator';

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

  private uiUpdateAccumulator: number = 0;
  private missileUiAccumulator: number = 0;
  private lastMissileCount: number | null = null;

  constructor(options: PresentationControllerOptions) {
    this.hud = options.hud;
    this.startMenu = options.startMenu ?? null;
    this.enemyHealthBars = options.enemyHealthBars;
    this.bossIndicator = options.bossIndicator;
    this.lockOnIndicator = options.lockOnIndicator;
    this.uiUpdateInterval = options.uiUpdateInterval ?? 1 / 30;
  }

  public initializeCombatUi(): void {
    this.enemyHealthBars.init();
    this.lockOnIndicator.init();
    this.bossIndicator.init();
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

  public dispose(): void {
    this.hud.dispose();
    this.enemyHealthBars.dispose();
    this.lockOnIndicator.dispose();
    this.bossIndicator.dispose();
    this.startMenu?.dispose();
  }
}
