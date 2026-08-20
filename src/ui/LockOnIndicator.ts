import { Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import { GAME_CONSTANTS } from '@/config';
import {
  HUD_COLORS,
  detectHudLayoutDensity,
  injectHudTokens,
  type HudLayoutDensity,
  type LockOnState,
} from '@/ui/theme/hudTokens';

const BREAK_TREATMENT_MS = 180;
const SEARCH_TICK_COUNT = 8;
const PIPPER_TICK_COUNT = 4;
const TRACK_ARC_RADIUS = 46;
const TRACK_ARC_CIRCUMFERENCE = 2 * Math.PI * TRACK_ARC_RADIUS;
const CONTROL_DECK_TOP_RATIO = 0.65;

/**
 * 导弹锁定指示器
 * SEARCH 空心虚线环 / TRACK 菱形+弧 / LOCK 薄荷绿 / BREAK 威胁红 / DRY NO MSL
 */
export class LockOnIndicator {
  private static readonly CANDIDATE_REFRESH_INTERVAL = 0.12;
  private static readonly STYLE_ID = 'lock-on-indicator-style';

  private container: HTMLDivElement;
  private lockCircle: HTMLDivElement;
  private pipper: HTMLDivElement;
  private trackDiamond: HTMLDivElement;
  private trackArc: SVGSVGElement;
  private trackArcStroke: SVGCircleElement;
  private noMissileLabel: HTMLDivElement;

  private isLockingOn: boolean = false;
  private currentTarget: Object3D | null = null;
  private lockProgressValue: number = 0;
  private lockTime: number = 3.0;
  private lockCircleScale: number = 1;
  private lockedTarget: Object3D | null = null;
  private lockState: LockOnState = 'search';
  private layoutDensity: HudLayoutDensity = 'desktop';
  private paused: boolean = false;
  private breakUntilMs: number = 0;

  private centerX: number = window.innerWidth / 2;
  private centerY: number = window.innerHeight / 2;
  private lockCircleSize: number = 0;
  private resizeHandler!: () => void;
  private initialized: boolean = false;
  private viewportWidth: number = window.innerWidth;
  private viewportHeight: number = window.innerHeight;
  private candidateRefreshTimer: number = 0;
  private readonly screenPosition = { x: 0, y: 0 };
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<Element, Map<string, string>>();
  private readonly worldPosition = new Vector3();
  private readonly projectedVector = new Vector3();

  constructor() {
    injectHudTokens();
    this.ensureLockStyle();
    this.layoutDensity = detectHudLayoutDensity();

    this.container = document.createElement('div');
    this.container.id = 'lock-on-indicator';
    this.setStyleValue(this.container, 'position', 'fixed');
    this.setStyleValue(this.container, 'top', '0');
    this.setStyleValue(this.container, 'left', '0');
    this.setStyleValue(this.container, 'width', '100%');
    this.setStyleValue(this.container, 'height', '100%');
    this.setStyleValue(this.container, 'pointerEvents', 'none');
    this.setStyleValue(this.container, 'zIndex', '40');
    this.setStyleValue(this.container, 'display', 'none');
    this.setStyleValue(this.container, 'contain', 'layout style paint');
    this.setLockState('search');

    this.lockCircle = document.createElement('div');
    this.lockCircle.dataset.lockChrome = 'search-ring';
    this.setStyleValue(this.lockCircle, 'position', 'absolute');
    this.setStyleValue(this.lockCircle, 'top', '50%');
    this.setStyleValue(this.lockCircle, 'left', '50%');
    this.setStyleValue(this.lockCircle, 'transform', 'translate(-50%, -50%)');
    this.setStyleValue(this.lockCircle, 'boxSizing', 'border-box');
    this.setStyleValue(this.lockCircle, 'borderRadius', '50%');
    this.setStyleValue(this.lockCircle, 'backgroundColor', 'transparent');
    this.setStyleValue(this.lockCircle, 'background', 'none');
    this.setStyleValue(this.lockCircle, 'opacity', '1');
    this.setStyleValue(this.lockCircle, 'visibility', 'visible');
    this.setStyleValue(this.lockCircle, 'display', 'none');
    this.setStyleValue(this.lockCircle, 'willChange', 'transform, opacity');
    this.createRingTicks(this.lockCircle, SEARCH_TICK_COUNT);

    this.trackArc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.trackArc.setAttribute('viewBox', '0 0 100 100');
    this.setStyleValue(this.trackArc, 'position', 'absolute');
    this.setStyleValue(this.trackArc, 'top', '50%');
    this.setStyleValue(this.trackArc, 'left', '50%');
    this.setStyleValue(this.trackArc, 'transform', 'translate(-50%, -50%)');
    this.setStyleValue(this.trackArc, 'opacity', '0');
    this.setStyleValue(this.trackArc, 'visibility', 'hidden');
    this.setStyleValue(this.trackArc, 'display', 'none');
    this.setStyleValue(this.trackArc, 'overflow', 'visible');
    this.setStyleValue(this.trackArc, 'pointerEvents', 'none');
    this.setStyleValue(this.trackArc, 'willChange', 'opacity, transform');

    this.trackArcStroke = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.trackArcStroke.setAttribute('cx', '50');
    this.trackArcStroke.setAttribute('cy', '50');
    this.trackArcStroke.setAttribute('r', String(TRACK_ARC_RADIUS));
    this.trackArcStroke.setAttribute('fill', 'none');
    this.trackArcStroke.setAttribute('stroke', HUD_COLORS.weapon);
    this.trackArcStroke.setAttribute('stroke-width', '3');
    this.trackArcStroke.setAttribute('stroke-linecap', 'round');
    this.trackArcStroke.setAttribute('stroke-dasharray', String(TRACK_ARC_CIRCUMFERENCE));
    this.trackArcStroke.setAttribute('stroke-dashoffset', String(TRACK_ARC_CIRCUMFERENCE));
    this.trackArcStroke.setAttribute('transform', 'rotate(-90 50 50)');
    this.setStyleValue(this.trackArcStroke, 'willChange', 'stroke-dashoffset');
    this.trackArc.appendChild(this.trackArcStroke);

    this.trackDiamond = document.createElement('div');
    this.setStyleValue(this.trackDiamond, 'position', 'absolute');
    this.setStyleValue(this.trackDiamond, 'width', '16px');
    this.setStyleValue(this.trackDiamond, 'height', '16px');
    this.setStyleValue(this.trackDiamond, 'borderWidth', '2px');
    this.setStyleValue(this.trackDiamond, 'borderStyle', 'solid');
    this.setStyleValue(this.trackDiamond, 'borderColor', HUD_COLORS.weapon);
    this.setStyleValue(this.trackDiamond, 'backgroundColor', 'transparent');
    this.setStyleValue(this.trackDiamond, 'borderRadius', '1px');
    this.setStyleValue(this.trackDiamond, 'transform', 'translate(-50%, -50%) rotate(45deg)');
    this.setStyleValue(this.trackDiamond, 'opacity', '0');
    this.setStyleValue(this.trackDiamond, 'visibility', 'hidden');
    this.setStyleValue(this.trackDiamond, 'display', 'none');
    this.setStyleValue(this.trackDiamond, 'willChange', 'transform, left, top, opacity');
    this.setStyleValue(this.trackDiamond, 'left', '50%');
    this.setStyleValue(this.trackDiamond, 'top', '50%');

    this.pipper = document.createElement('div');
    this.pipper.dataset.lockChrome = 'pipper';
    this.setStyleValue(this.pipper, 'position', 'absolute');
    this.setStyleValue(this.pipper, 'top', '50%');
    this.setStyleValue(this.pipper, 'left', '50%');
    this.setStyleValue(this.pipper, 'transform', 'translate(-50%, -50%)');
    this.setStyleValue(this.pipper, 'boxSizing', 'border-box');
    this.setStyleValue(this.pipper, 'borderRadius', '50%');
    this.setStyleValue(this.pipper, 'backgroundColor', 'transparent');
    this.setStyleValue(this.pipper, 'background', 'none');
    this.setStyleValue(this.pipper, 'borderWidth', '2px');
    this.setStyleValue(this.pipper, 'borderStyle', 'solid');
    this.setStyleValue(this.pipper, 'borderColor', HUD_COLORS.weapon);
    this.setStyleValue(this.pipper, 'opacity', '0');
    this.setStyleValue(this.pipper, 'visibility', 'hidden');
    this.setStyleValue(this.pipper, 'display', 'none');
    this.setStyleValue(this.pipper, 'willChange', 'transform, opacity');
    this.createRingTicks(this.pipper, PIPPER_TICK_COUNT, 6);
    this.applySearchRingChrome();

    this.noMissileLabel = document.createElement('div');
    this.setStyleValue(this.noMissileLabel, 'position', 'absolute');
    this.setStyleValue(this.noMissileLabel, 'top', '50%');
    this.setStyleValue(this.noMissileLabel, 'left', '50%');
    this.setStyleValue(this.noMissileLabel, 'transform', 'translate(-50%, -50%)');
    this.setStyleValue(this.noMissileLabel, 'color', HUD_COLORS.threat);
    this.setStyleValue(this.noMissileLabel, 'fontSize', '20px');
    this.setStyleValue(this.noMissileLabel, 'fontWeight', 'bold');
    this.setStyleValue(this.noMissileLabel, 'fontFamily', 'var(--hud-mono)');
    this.setStyleValue(this.noMissileLabel, 'textShadow', '2px 2px 4px rgba(0, 0, 0, 0.8)');
    this.setStyleValue(this.noMissileLabel, 'whiteSpace', 'nowrap');
    this.setStyleValue(this.noMissileLabel, 'letterSpacing', '0.18em');
    this.setStyleValue(this.noMissileLabel, 'opacity', '0');
    this.setStyleValue(this.noMissileLabel, 'visibility', 'hidden');
    this.setStyleValue(this.noMissileLabel, 'display', 'none');
    this.setTextContent(this.noMissileLabel, 'NO MSL');

    this.container.appendChild(this.noMissileLabel);
    this.container.appendChild(this.trackArc);
    this.container.appendChild(this.trackDiamond);
    this.container.appendChild(this.lockCircle);
    this.container.appendChild(this.pipper);

    this.resizeHandler = () => {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
      this.centerX = this.viewportWidth / 2;
      this.centerY = this.viewportHeight / 2;
      this.updateLockCircleSize();
      this.updatePipperSize();
    };
  }

  public init(): void {
    if (this.initialized) {
      return;
    }

    document.body.appendChild(this.container);
    this.updateLockCircleSize();
    this.updatePipperSize();
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
    this.initialized = true;
  }

  public setLayoutDensity(density: HudLayoutDensity): void {
    this.layoutDensity = density;
    this.updateLockCircleSize();
    this.updatePipperSize();
    this.positionNoMissileLabel();
  }

  public getLayoutDensity(): HudLayoutDensity {
    return this.layoutDensity;
  }

  public getLockState(): LockOnState {
    return this.lockState;
  }

  public hide(): void {
    this.hidePipper();
    this.setStyleValue(this.container, 'display', 'none');
  }

  public show(): void {
    if (this.isLockingOn || this.lockState === 'dry') {
      this.setStyleValue(this.container, 'display', 'block');
    }
    if (this.isLockingOn && !this.paused) {
      this.showPipper();
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.hidePipper();
      return;
    }
    if (this.isLockingOn) {
      this.showPipper();
    }
  }

  /**
   * 更新锁定搜索环尺寸（仅缩放搜索环，不影响准星）。
   */
  private updateLockCircleSize(): void {
    this.lockCircleSize = this.computeSearchRingSize();
    const sizePx = `${this.lockCircleSize}px`;
    this.setStyleValue(this.lockCircle, 'width', sizePx);
    this.setStyleValue(this.lockCircle, 'height', sizePx);
    this.setStyleValue(this.lockCircle, 'borderRadius', '50%');
    this.setStyleValue(this.trackArc, 'width', sizePx);
    this.setStyleValue(this.trackArc, 'height', sizePx);
  }

  private computeSearchRingSize(): number {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    let size: number;
    if (this.layoutDensity === 'desktop') {
      size = minSide * 0.22 * this.lockCircleScale;
    } else if (this.layoutDensity === 'touch-landscape') {
      size = Math.min(minSide * 0.18, 180) * this.lockCircleScale;
    } else {
      size = Math.min(minSide * 0.16, 160) * this.lockCircleScale;
    }

    if (this.layoutDensity !== 'desktop') {
      const maxSize = window.innerHeight * (CONTROL_DECK_TOP_RATIO * 2 - 1);
      size = Math.min(size, maxSize);
    }

    return size;
  }

  private pipperSizePx(): number {
    return this.layoutDensity === 'desktop' ? 22 : 18;
  }

  private updatePipperSize(): void {
    const sizePx = `${this.pipperSizePx()}px`;
    this.setStyleValue(this.pipper, 'width', sizePx);
    this.setStyleValue(this.pipper, 'height', sizePx);
    this.setStyleValue(this.pipper, 'borderRadius', '50%');
  }

  private setTextContent(element: HTMLElement, text: string): void {
    if (this.textContentCache.get(element) === text) {
      return;
    }

    element.textContent = text;
    this.textContentCache.set(element, text);
  }

  private setStyleValue(element: HTMLElement | SVGElement, property: string, value: string): void {
    if (!element) {
      return;
    }
    let cache = this.styleValueCache.get(element);
    if (!cache) {
      cache = new Map<string, string>();
      this.styleValueCache.set(element, cache);
    }

    if (cache.get(property) === value) {
      return;
    }

    const style = element.style as CSSStyleDeclaration & Record<string, string>;
    style[property] = value;
    cache.set(property, value);
  }

  /**
   * 开始锁定
   */
  public startLockOn(): void {
    this.init();
    this.isLockingOn = true;
    this.lockProgressValue = 0;
    this.currentTarget = null;
    this.lockedTarget = null;
    this.candidateRefreshTimer = 0;
    this.paused = false;
    this.breakUntilMs = 0;
    this.setStyleValue(this.container, 'display', 'block');
    this.resetNoMissileLabel();
    this.updateLockCircleSize();
    this.updatePipperSize();
    this.showSearchRing();
    this.showPipper();
    this.resetTrackVisuals();
    this.applySearchRingChrome();
    this.setLockState('search');
  }

  /**
   * 取消锁定
   */
  public cancelLockOn(): void {
    this.isLockingOn = false;
    this.currentTarget = null;
    this.lockedTarget = null;
    this.lockProgressValue = 0;
    this.candidateRefreshTimer = 0;
    this.breakUntilMs = 0;
    this.resetTrackVisuals();
    this.resetNoMissileLabel();
    this.hidePipper();
    this.setStyleValue(this.lockCircle, 'display', 'none');
    this.setStyleValue(this.container, 'display', 'none');
    this.setLockState('search');
  }

  /**
   * 导弹数量为0时显示提示
   */
  public setNoMissiles(show: boolean): void {
    this.init();
    if (show) {
      this.isLockingOn = false;
      this.lockProgressValue = 0;
      this.currentTarget = null;
      this.lockedTarget = null;
      this.setStyleValue(this.container, 'display', 'block');
      this.setStyleValue(this.lockCircle, 'display', 'none');
      this.hidePipper();
      this.resetTrackVisuals();
      this.positionNoMissileLabel();
      this.setStyleValue(this.noMissileLabel, 'display', 'block');
      this.setStyleValue(this.noMissileLabel, 'opacity', '1');
      this.setStyleValue(this.noMissileLabel, 'visibility', 'visible');
      this.setLockState('dry');
    } else {
      this.resetNoMissileLabel();
      if (this.isLockingOn) {
        this.showSearchRing();
        if (!this.paused) {
          this.showPipper();
        }
      }
    }
  }

  /**
   * 发射导弹（锁定完成后调用）
   */
  public onMissileFired(): void {
    this.cancelLockOn();
  }

  public update(
    playerPos: Vector3,
    enemies: Object3D[],
    camera: Camera,
    deltaTime: number,
    _enemyScreenPos: { x: number; y: number } | null
  ): boolean {
    this.init();

    if (!this.isLockingOn) {
      return false;
    }

    this.refreshBreakState();

    const lockCircleRadius = this.lockCircleSize / 2;
    const lockDistance = GAME_CONSTANTS.MISSILE.MAX_FLIGHT_DISTANCE / 2;
    const lockCircleRadiusSquared = lockCircleRadius * lockCircleRadius;

    if (this.lockedTarget) {
      this.lockedTarget.getWorldPosition(this.worldPosition);

      if (
        !isFinite(this.worldPosition.x) ||
        !isFinite(this.worldPosition.y) ||
        !isFinite(this.worldPosition.z)
      ) {
        this.dropLockedTarget(deltaTime);
        return false;
      }

      if (!this.worldToScreenPixels(this.worldPosition, camera)) {
        this.dropLockedTarget(deltaTime);
        return false;
      }

      const worldDistance = playerPos.distanceTo(this.worldPosition);
      if (worldDistance > lockDistance) {
        this.dropLockedTarget(deltaTime);
        return false;
      }

      const dx = this.screenPosition.x - this.centerX;
      const dy = this.screenPosition.y - this.centerY;
      const screenDistanceSquared = dx * dx + dy * dy;

      if (screenDistanceSquared > lockCircleRadiusSquared) {
        this.dropLockedTarget(deltaTime);
        return false;
      }

      this.lockProgressValue += deltaTime / this.lockTime;

      this.updateLockProgress(this.screenPosition.x, this.screenPosition.y);

      if (this.lockProgressValue >= 1) {
        this.lockProgressValue = 1;
        this.onLockComplete();
        return true;
      }

      return false;
    }

    this.candidateRefreshTimer -= deltaTime;
    if (this.candidateRefreshTimer <= 0) {
      this.candidateRefreshTimer = LockOnIndicator.CANDIDATE_REFRESH_INTERVAL;
      this.selectBestTarget(enemies, playerPos, camera, lockDistance, lockCircleRadiusSquared);
    }

    this.updateLockProgress(null, null);

    return false;
  }

  /**
   * 世界坐标转屏幕坐标（像素）
   */
  private worldToScreenPixels(
    position: Vector3,
    camera: Camera
  ): boolean {
    this.projectedVector.copy(position).project(camera);

    if (this.projectedVector.z > 1) {
      return false;
    }

    this.screenPosition.x = ((this.projectedVector.x + 1) / 2) * this.viewportWidth;
    this.screenPosition.y = (-(this.projectedVector.y - 1) / 2) * this.viewportHeight;
    return true;
  }

  /**
   * 更新 TRACK / LOCK 视觉
   */
  private updateLockProgress(targetScreenX: number | null, targetScreenY: number | null): void {
    if (this.lockState === 'break') {
      this.applyBreakChrome();
      this.resetTrackVisuals();
      return;
    }

    if (this.lockProgressValue >= 1 && targetScreenX !== null && targetScreenY !== null) {
      this.setLockState('lock');
      this.applyLockChrome();
      this.resetTrackVisuals();
      if (!this.paused) {
        this.showPipper();
      }
      return;
    }

    if (this.lockProgressValue > 0 && targetScreenX !== null && targetScreenY !== null) {
      this.setLockState('track');
      this.applySearchRingChrome();
      this.showSearchRing();
      if (!this.paused) {
        this.showPipper();
      }

      const progress = this.lockProgressValue;
      const currentX = this.centerX + (targetScreenX - this.centerX) * progress;
      const currentY = this.centerY + (targetScreenY - this.centerY) * progress;

      this.setStyleValue(this.trackDiamond, 'display', 'block');
      this.setStyleValue(this.trackDiamond, 'opacity', '1');
      this.setStyleValue(this.trackDiamond, 'visibility', 'visible');
      this.setStyleValue(this.trackDiamond, 'left', `${currentX}px`);
      this.setStyleValue(this.trackDiamond, 'top', `${currentY}px`);
      this.setStyleValue(
        this.trackDiamond,
        'transform',
        'translate(-50%, -50%) rotate(45deg)'
      );

      this.setStyleValue(this.trackArc, 'display', 'block');
      this.setStyleValue(this.trackArc, 'opacity', '1');
      this.setStyleValue(this.trackArc, 'visibility', 'visible');
      const offset = TRACK_ARC_CIRCUMFERENCE * (1 - progress);
      this.trackArcStroke.style.strokeDashoffset = `${offset}`;
      return;
    }

    this.resetTrackVisuals();
    if (this.lockState !== 'dry') {
      this.setLockState('search');
      this.applySearchRingChrome();
    }
  }

  /**
   * 锁定完成
   */
  private onLockComplete(): void {
    this.setLockState('lock');
    this.applyLockChrome();
  }

  /**
   * 获取当前锁定的目标
   */
  public getCurrentTarget(): Object3D | null {
    return this.lockProgressValue >= 1 ? this.currentTarget : null;
  }

  /**
   * 获取锁定进度 (0-1)
   */
  public getLockProgress(): number {
    return this.lockProgressValue;
  }

  /**
   * 是否正在锁定
   */
  public isLocking(): boolean {
    return this.isLockingOn;
  }

  /**
   * 设置锁定时间
   * @param time 锁定时间（秒），最小 0.5 秒
   */
  public setLockTime(time: number): void {
    this.lockTime = Math.max(0.5, time);
  }

  /**
   * 设置锁定圈尺寸倍率
   * @param scale 锁定圈尺寸倍率，最小 1.0，最大 2.0
   */
  public setLockCircleScale(scale: number): void {
    this.lockCircleScale = Math.max(1, Math.min(2, scale));
    if (this.initialized) {
      this.updateLockCircleSize();
    }
  }

  private selectBestTarget(
    enemies: Object3D[],
    playerPos: Vector3,
    camera: Camera,
    lockDistance: number,
    lockCircleRadiusSquared: number
  ): void {
    let bestTarget: Object3D | null = null;
    let bestDistance = Infinity;

    for (const enemy of enemies) {
      enemy.getWorldPosition(this.worldPosition);

      const worldDistance = playerPos.distanceTo(this.worldPosition);
      if (worldDistance > lockDistance) {
        continue;
      }

      if (!this.worldToScreenPixels(this.worldPosition, camera)) {
        continue;
      }

      const dx = this.screenPosition.x - this.centerX;
      const dy = this.screenPosition.y - this.centerY;
      const screenDistanceSquared = dx * dx + dy * dy;

      if (screenDistanceSquared > lockCircleRadiusSquared) {
        continue;
      }

      if (worldDistance < bestDistance) {
        bestDistance = worldDistance;
        bestTarget = enemy;
      }
    }

    if (!bestTarget) {
      const hadProgress = this.lockProgressValue > 0;
      this.currentTarget = null;
      this.lockedTarget = null;
      this.lockProgressValue = Math.max(
        0,
        this.lockProgressValue - LockOnIndicator.CANDIDATE_REFRESH_INTERVAL * 3
      );
      if (hadProgress) {
        this.enterBreakState();
      }
      return;
    }

    if (bestTarget !== this.currentTarget) {
      this.lockProgressValue = 0;
    }

    this.currentTarget = bestTarget;
    this.lockedTarget = bestTarget;
  }

  private dropLockedTarget(deltaTime: number): void {
    const hadProgress = this.lockProgressValue > 0;
    this.lockedTarget = null;
    this.currentTarget = null;
    this.lockProgressValue = Math.max(0, this.lockProgressValue - deltaTime * 3);
    if (hadProgress) {
      this.enterBreakState();
    }
    this.updateLockProgress(null, null);
  }

  private enterBreakState(): void {
    this.breakUntilMs = performance.now() + BREAK_TREATMENT_MS;
    this.setLockState('break');
    this.applyBreakChrome();
    this.resetTrackVisuals();
  }

  private refreshBreakState(): void {
    if (this.lockState !== 'break') {
      return;
    }
    if (performance.now() < this.breakUntilMs) {
      return;
    }
    this.breakUntilMs = 0;
    const nextState: LockOnState = this.lockProgressValue > 0 ? 'track' : 'search';
    this.setLockState(nextState);
    if (nextState === 'search') {
      this.applySearchRingChrome();
    }
  }

  private setLockState(state: LockOnState): void {
    this.lockState = state;
    this.container.setAttribute('data-lock-state', state);
  }

  private applySearchRingChrome(): void {
    this.setStyleValue(this.lockCircle, 'borderRadius', '50%');
    this.setStyleValue(this.lockCircle, 'borderWidth', '2px');
    this.setStyleValue(this.lockCircle, 'borderStyle', 'dashed');
    this.setStyleValue(this.lockCircle, 'borderColor', HUD_COLORS.weapon);
    this.setStyleValue(this.lockCircle, 'backgroundColor', 'transparent');
    this.setStyleValue(this.lockCircle, 'background', 'none');
    this.setStyleValue(this.lockCircle, 'boxShadow', 'none');
    this.setStyleValue(this.pipper, 'borderColor', HUD_COLORS.weapon);
    this.setStyleValue(this.pipper, 'backgroundColor', 'transparent');
  }

  private applyLockChrome(): void {
    this.setStyleValue(this.lockCircle, 'borderRadius', '50%');
    this.setStyleValue(this.lockCircle, 'borderWidth', '2px');
    this.setStyleValue(this.lockCircle, 'borderStyle', 'solid');
    this.setStyleValue(this.lockCircle, 'borderColor', HUD_COLORS.lock);
    this.setStyleValue(this.lockCircle, 'backgroundColor', 'transparent');
    this.setStyleValue(this.lockCircle, 'background', 'none');
    this.setStyleValue(this.lockCircle, 'boxShadow', `0 0 12px ${HUD_COLORS.lock}`);
    this.setStyleValue(this.pipper, 'borderColor', HUD_COLORS.lock);
    this.setStyleValue(this.pipper, 'backgroundColor', 'transparent');
    this.setStyleValue(this.pipper, 'boxShadow', `0 0 8px ${HUD_COLORS.lock}`);
    this.showSearchRing();
  }

  private applyBreakChrome(): void {
    this.setStyleValue(this.lockCircle, 'borderRadius', '50%');
    this.setStyleValue(this.lockCircle, 'borderWidth', '2px');
    this.setStyleValue(this.lockCircle, 'borderStyle', 'solid');
    this.setStyleValue(this.lockCircle, 'borderColor', HUD_COLORS.threat);
    this.setStyleValue(this.lockCircle, 'backgroundColor', 'transparent');
    this.setStyleValue(this.lockCircle, 'boxShadow', `0 0 12px ${HUD_COLORS.threat}`);
    this.setStyleValue(this.pipper, 'borderColor', HUD_COLORS.threat);
    this.showSearchRing();
  }

  private showSearchRing(): void {
    this.setStyleValue(this.lockCircle, 'display', 'block');
    this.setStyleValue(this.lockCircle, 'opacity', '1');
    this.setStyleValue(this.lockCircle, 'visibility', 'visible');
    this.setStyleValue(this.lockCircle, 'borderRadius', '50%');
  }

  private showPipper(): void {
    this.updatePipperSize();
    this.setStyleValue(this.pipper, 'display', 'block');
    this.setStyleValue(this.pipper, 'opacity', '1');
    this.setStyleValue(this.pipper, 'visibility', 'visible');
    this.setStyleValue(this.pipper, 'borderRadius', '50%');
  }

  private hidePipper(): void {
    this.setStyleValue(this.pipper, 'display', 'none');
    this.setStyleValue(this.pipper, 'opacity', '0');
    this.setStyleValue(this.pipper, 'visibility', 'hidden');
  }

  private resetTrackVisuals(): void {
    this.setStyleValue(this.trackDiamond, 'display', 'none');
    this.setStyleValue(this.trackDiamond, 'opacity', '0');
    this.setStyleValue(this.trackDiamond, 'visibility', 'hidden');
    this.setStyleValue(this.trackDiamond, 'left', `${this.centerX}px`);
    this.setStyleValue(this.trackDiamond, 'top', `${this.centerY}px`);
    this.setStyleValue(this.trackArc, 'display', 'none');
    this.setStyleValue(this.trackArc, 'opacity', '0');
    this.setStyleValue(this.trackArc, 'visibility', 'hidden');
    this.trackArcStroke.style.strokeDashoffset = String(TRACK_ARC_CIRCUMFERENCE);
  }

  private resetNoMissileLabel(): void {
    this.setStyleValue(this.noMissileLabel, 'display', 'none');
    this.setStyleValue(this.noMissileLabel, 'opacity', '0');
    this.setStyleValue(this.noMissileLabel, 'visibility', 'hidden');
    this.setStyleValue(this.noMissileLabel, 'transform', 'translate(-50%, -50%)');
  }

  private positionNoMissileLabel(): void {
    const top = this.layoutDensity === 'desktop' ? '50%' : '48%';
    this.setStyleValue(this.noMissileLabel, 'top', top);
    this.setStyleValue(this.noMissileLabel, 'left', '50%');
    this.setStyleValue(this.noMissileLabel, 'bottom', 'auto');
  }

  private createRingTicks(parent: HTMLElement, count: number, lengthPx = 10): void {
    for (let i = 0; i < count; i += 1) {
      const arm = document.createElement('div');
      this.setStyleValue(arm, 'position', 'absolute');
      this.setStyleValue(arm, 'inset', '0');
      this.setStyleValue(arm, 'borderRadius', '0');
      this.setStyleValue(arm, 'transform', `rotate(${(360 / count) * i}deg)`);
      this.setStyleValue(arm, 'pointerEvents', 'none');

      const tick = document.createElement('div');
      this.setStyleValue(tick, 'position', 'absolute');
      this.setStyleValue(tick, 'top', '0');
      this.setStyleValue(tick, 'left', '50%');
      this.setStyleValue(tick, 'width', '2px');
      this.setStyleValue(tick, 'height', `${lengthPx}px`);
      this.setStyleValue(tick, 'transform', 'translateX(-50%)');
      this.setStyleValue(tick, 'backgroundColor', HUD_COLORS.weapon);
      this.setStyleValue(tick, 'borderRadius', '0');
      arm.appendChild(tick);
      parent.appendChild(arm);
    }
  }

  private ensureLockStyle(): void {
    if (document.getElementById(LockOnIndicator.STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = LockOnIndicator.STYLE_ID;
    style.textContent = `
      #lock-on-indicator[data-lock-state="lock"] {
        color: var(--hud-lock, ${HUD_COLORS.lock});
      }
      #lock-on-indicator[data-lock-state="break"] {
        color: var(--hud-threat, ${HUD_COLORS.threat});
      }
      #lock-on-indicator[data-lock-state="search"],
      #lock-on-indicator[data-lock-state="track"] {
        color: var(--hud-weapon, ${HUD_COLORS.weapon});
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 清除
   */
  public dispose(): void {
    if (this.initialized) {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
    }
    if (this.container.parentElement) {
      this.container.remove();
    }
    this.initialized = false;
  }
}
