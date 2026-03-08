import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
  Vector3,
  type Material,
} from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';

/**
 * Boss炮弹数据
 */
interface Projectile {
  mesh: Mesh;
  direction: Vector3;
  speed: number;
  active: boolean;
  startPosition: Vector3;
  damage: number; // 伤害值
  owner?: Object3D; // 发射者，用于防止子弹立即碰撞到发射者
  baseScale: Vector3;
  baseOpacity: number;
  pulseOffset: number;
}

const FORWARD = new Vector3(0, 0, 1);

/**
 * Boss炮弹对象池
 * 使用更大的几何体和红橙色，区别于普通敌人炮弹
 */
export class BossProjectilePool {
  private pool: Projectile[] = [];
  private maxDistance: number;
  private scene: Scene;
  private shellGeometry: BoxGeometry;

  constructor(scene: Scene) {
    this.scene = scene;
    this.maxDistance = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;

    const poolSize = GameConfig.getProjectilePoolSize();

    this.shellGeometry = new BoxGeometry(0.34, 0.34, 1.85);
    const material = new MeshBasicMaterial({
      color: 0xd83a20,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });

    for (let i = 0; i < poolSize; i++) {
      const mesh = new Mesh(this.shellGeometry, material.clone());
      mesh.visible = false;
      this.scene.add(mesh);

      this.pool.push({
        mesh,
        direction: new Vector3(),
        speed: GAME_CONSTANTS.PROJECTILE.SPEED,
        active: false,
        startPosition: new Vector3(),
        damage: 10,
        baseScale: new Vector3(1, 1, 1),
        baseOpacity: 0.94,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 发射炮弹
   * @param origin 发射位置
   * @param direction 发射方向
   * @param damage 伤害值
   * @param owner 发射者（用于防止立即碰撞）
   * @param faction 炮弹阵营（用于伤害检测）
   */
  public fire(
    origin: Vector3,
    direction: Vector3,
    damage: number,
    owner?: Object3D,
    faction?: string
  ): void {
    // 找到未激活的炮弹
    const projectile = this.pool.find((p) => !p.active);
    if (!projectile) return;

    projectile.mesh.position.copy(origin);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(origin);
    projectile.damage = damage; // 设置伤害
    projectile.owner = owner; // 记录发射者
    projectile.mesh.userData.faction = faction; // 设置阵营
    this.applyProjectileVisual(projectile);
    projectile.mesh.visible = true;
    projectile.active = true;
  }

  /**
   * 更新所有炮弹
   */
  public update(
    deltaTime: number,
    impactHeight?: number,
    onEnvironmentHit?: (position: Vector3) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      // 移动炮弹
      projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * deltaTime);
      this.updateProjectileVisual(projectile);

      if (
        typeof impactHeight === 'number'
        && projectile.mesh.position.y <= impactHeight
      ) {
        onEnvironmentHit?.(projectile.mesh.position.clone());
        this.deactivate(projectile);
        continue;
      }

      // 检查是否超出最大距离
      const distance = projectile.mesh.position.distanceTo(projectile.startPosition);
      if (distance > this.maxDistance) {
        this.deactivate(projectile);
      }
    }
  }

  /**
   * 检查碰撞
   */
  public checkCollisions(
    targets: Object3D[],
    onHit: (target: Object3D, projectile: Mesh, damage: number) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      for (const target of targets) {
        if (!target.visible) continue;

        // 跳过发射者自己，防止炮弹立即碰撞到发射者
        if (projectile.owner && target === projectile.owner) continue;

        const distance = projectile.mesh.position.distanceTo(target.position);
        const collisionThreshold = 8; // Boss炮弹更大，碰撞距离也更大

        if (distance < collisionThreshold) {
          onHit(target, projectile.mesh, projectile.damage);
          this.deactivate(projectile);
          break;
        }
      }
    }
  }

  /**
   * 停用炮弹
   */
  private deactivate(projectile: Projectile): void {
    projectile.mesh.visible = false;
    projectile.active = false;
    projectile.mesh.scale.setScalar(1);
  }

  private applyProjectileVisual(projectile: Projectile): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    projectile.mesh.geometry = this.shellGeometry;
    material.color.set(0xd84528);
    projectile.baseOpacity = 0.94;
    projectile.baseScale.set(1.15, 1.15, 2.8);
    material.opacity = projectile.baseOpacity;
    projectile.mesh.quaternion.setFromUnitVectors(FORWARD, projectile.direction);
    projectile.mesh.scale.copy(projectile.baseScale);
  }

  private updateProjectileVisual(projectile: Projectile): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    const travel = projectile.mesh.position.distanceTo(projectile.startPosition);
    const pulse = Math.sin(travel * 0.09 + projectile.pulseOffset) * 0.1;
    const stretchPulse = Math.sin(travel * 0.06 + projectile.pulseOffset * 0.6) * 0.08;

    material.opacity = Math.min(1, projectile.baseOpacity + pulse * 0.08);
    projectile.mesh.scale.set(
      projectile.baseScale.x * (1 - stretchPulse * 0.35),
      projectile.baseScale.y * (1 - stretchPulse * 0.35),
      projectile.baseScale.z * (1 + stretchPulse)
    );
  }

  public getActiveProjectiles(): Mesh[] {
    return this.pool.filter((p) => p.active).map((p) => p.mesh);
  }

  public clear(): void {
    for (const projectile of this.pool) {
      projectile.mesh.visible = false;
      projectile.active = false;
    }
  }

  public dispose(): void {
    for (const projectile of this.pool) {
      this.scene.remove(projectile.mesh);
      (projectile.mesh.material as Material).dispose();
    }
    this.shellGeometry.dispose();
    this.pool = [];
  }
}
