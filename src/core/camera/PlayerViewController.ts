import type * as THREE from 'three';
import type { CameraModeSetting } from '@/core/SessionSettings';
import { updatePlayerAfterburner } from '@/features/aircraft/AircraftMeshFactory';
import type { CameraRig, CameraRigFlightState } from '@/features/camera/CameraRig';

type CameraRigModule = typeof import('@/features/camera/CameraRig');

/**
 * 玩家视角控制：CameraRig（第一 / 第三人称、座舱、震动、FOV）+ 玩家加力尾焰。
 *
 * CameraRig 与座舱模型较大，按需加载（随战斗运行时一起，游戏循环开始前就绪）；
 * 加载完成前的 update / addShake 均为空操作。
 */
export class PlayerViewController {
  private rig: CameraRig | null = null;
  private rigModule: CameraRigModule | null = null;
  private loadPromise: Promise<void> | null = null;
  private mode: CameraModeSetting;
  private disposed = false;
  /** 每帧复用的飞行状态（相机 FOV / 震动 / 加力尾焰共用） */
  private readonly flight: CameraRigFlightState = { speedRatio: 0, boosting: false };

  /** 视角切换（V 键 / 按钮 / 读档）；首次加载时不触发 */
  public onModeChanged?: (mode: CameraModeSetting) => void;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Group,
    initialMode: CameraModeSetting
  ) {
    this.mode = initialMode;
  }

  public ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = import('@/features/camera/CameraRig').then((rigModule) => {
        if (this.disposed) return;
        this.rigModule = rigModule;
        const rig = new rigModule.CameraRig(this.camera, this.target, { mode: this.mode });
        rig.onModeChanged = (mode) => {
          this.mode = mode;
          this.onModeChanged?.(mode);
        };
        this.rig = rig;
      });
    }
    return this.loadPromise;
  }

  public isReady(): boolean {
    return this.rig !== null;
  }

  public getMode(): CameraModeSetting {
    return this.rig?.getMode() ?? this.mode;
  }

  public isFirstPerson(): boolean {
    return this.getMode() === 'first-person';
  }

  /** 0 = 第三人称，1 = 第一人称（含切换混合） */
  public getBlend(): number {
    return this.rig?.getBlend() ?? (this.mode === 'first-person' ? 1 : 0);
  }

  public toggleMode(): CameraModeSetting {
    if (!this.rig) {
      this.mode = this.mode === 'first-person' ? 'third-person' : 'first-person';
      return this.mode;
    }
    return this.rig.toggleMode();
  }

  /** immediate = true：读档 / 开局直接就位（无混合） */
  public setMode(mode: CameraModeSetting, immediate: boolean = false): void {
    this.mode = mode;
    if (!this.rig) return;
    this.rig.setMode(mode, immediate);
    if (immediate) {
      this.rig.snapToTarget();
    }
  }

  /** 传送 / 复活 / 换关后下一帧直接就位 */
  public snapToTarget(): void {
    this.rig?.snapToTarget();
  }

  /** speedRatio 0..1（最低 → 最高速度），boosting = 加力键按下 */
  public setFlightState(speedRatio: number, boosting: boolean): void {
    this.flight.speedRatio = Number.isFinite(speedRatio) ? Math.max(0, Math.min(1, speedRatio)) : 0;
    this.flight.boosting = boosting;
  }

  public getFlightState(): Readonly<CameraRigFlightState> {
    return this.flight;
  }

  /** 渲染帧：加力尾焰 + 相机位姿（目标为插值后的玩家位姿） */
  public update(
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    renderDeltaTime: number
  ): void {
    updatePlayerAfterburner(this.target, this.flight, renderDeltaTime);
    this.rig?.update(position, quaternion, renderDeltaTime, this.flight);
  }

  /** 累加震动创伤（0..1） */
  public addShake(intensity: number): void {
    if (!Number.isFinite(intensity) || intensity <= 0) return;
    this.rig?.addShake(Math.min(1, intensity));
  }

  /** 爆炸震动：按与相机的距离衰减（computeExplosionShake） */
  public addExplosionShake(position: THREE.Vector3, scale: number = 1): void {
    if (!this.rig || !this.rigModule) return;
    const distance = this.camera.position.distanceTo(position);
    const shake = this.rigModule.computeExplosionShake(distance, scale);
    if (shake > 0.01) {
      this.rig.addShake(shake);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.rig?.dispose();
    this.rig = null;
    this.onModeChanged = undefined;
  }
}
