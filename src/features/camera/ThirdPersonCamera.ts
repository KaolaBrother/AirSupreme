import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';

/**
 * 第三人称相机
 * 平滑跟随目标
 */
export class ThirdPersonCamera {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Object3D;
  private offset: THREE.Vector3;
  private currentPosition: THREE.Vector3;
  private smoothFactor: number;

  constructor(
    camera: THREE.PerspectiveCamera,
    target: THREE.Object3D,
    offset?: THREE.Vector3
  ) {
    this.camera = camera;
    this.target = target;
    this.offset = offset || new THREE.Vector3(
      GAME_CONSTANTS.CAMERA.OFFSET.x,
      GAME_CONSTANTS.CAMERA.OFFSET.y,
      GAME_CONSTANTS.CAMERA.OFFSET.z
    );
    this.currentPosition = new THREE.Vector3();
    this.smoothFactor = GAME_CONSTANTS.CAMERA.SMOOTH_FACTOR;
  }

  /**
   * 更新相机位置
   */
  public update(): void {
    // 计算理想位置（在目标后方）
    const idealOffset = this.offset.clone();
    idealOffset.applyQuaternion(this.target.quaternion);
    idealOffset.add(this.target.position);

    // 平滑插值
    this.currentPosition.lerp(idealOffset, this.smoothFactor);
    this.camera.position.copy(this.currentPosition);

    // 看向目标
    this.camera.lookAt(this.target.position);
  }

  /**
   * 设置平滑系数
   */
  public setSmoothFactor(factor: number): void {
    this.smoothFactor = Math.max(0, Math.min(1, factor));
  }
}
