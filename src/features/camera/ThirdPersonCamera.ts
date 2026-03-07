import { Vector3 } from 'three';
import type { Object3D, PerspectiveCamera, Quaternion } from 'three';
import { GAME_CONSTANTS } from '@/config';

/**
 * 第三人称相机
 * 平滑跟随目标
 */
export class ThirdPersonCamera {
  private camera: PerspectiveCamera;
  private target: Object3D;
  private offset: Vector3;
  private currentPosition: Vector3;
  private currentLookTarget: Vector3;
  private idealPosition: Vector3;
  private idealLookTarget: Vector3;
  private smoothFactor: number;
  private initialized: boolean;

  constructor(
    camera: PerspectiveCamera,
    target: Object3D,
    offset?: Vector3
  ) {
    this.camera = camera;
    this.target = target;
    this.offset = offset || new Vector3(
      GAME_CONSTANTS.CAMERA.OFFSET.x,
      GAME_CONSTANTS.CAMERA.OFFSET.y,
      GAME_CONSTANTS.CAMERA.OFFSET.z
    );
    this.currentPosition = new Vector3();
    this.currentLookTarget = new Vector3();
    this.idealPosition = new Vector3();
    this.idealLookTarget = new Vector3();
    this.smoothFactor = GAME_CONSTANTS.CAMERA.SMOOTH_FACTOR;
    this.initialized = false;
  }

  /**
   * 更新相机位置
   */
  public update(
    targetPosition: Vector3 = this.target.position,
    targetQuaternion: Quaternion = this.target.quaternion
  ): void {
    // 计算理想位置（在目标后方），复用临时向量避免每帧分配
    this.idealPosition.copy(this.offset);
    this.idealPosition.applyQuaternion(targetQuaternion);
    this.idealPosition.add(targetPosition);
    this.idealLookTarget.copy(targetPosition);

    if (!this.initialized) {
      this.currentPosition.copy(this.idealPosition);
      this.currentLookTarget.copy(this.idealLookTarget);
      this.camera.position.copy(this.currentPosition);
      this.camera.lookAt(this.currentLookTarget);
      this.initialized = true;
      return;
    }

    // 平滑插值
    this.currentPosition.lerp(this.idealPosition, this.smoothFactor);
    this.currentLookTarget.lerp(this.idealLookTarget, this.smoothFactor);
    this.camera.position.copy(this.currentPosition);

    // 看向目标
    this.camera.lookAt(this.currentLookTarget);
  }

  /**
   * 设置平滑系数
   */
  public setSmoothFactor(factor: number): void {
    this.smoothFactor = Math.max(0, Math.min(1, factor));
  }
}
