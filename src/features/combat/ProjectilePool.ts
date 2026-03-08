import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  Scene,
  Vector3,
  type Material,
} from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';

/**
 * 子弹数据
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
 * 子弹对象池
 * 使用对象池模式避免频繁创建/销毁对象
 */
export class ProjectilePool {
  private pool: Projectile[] = [];
  private maxDistance: number;
  private scene: Scene;
  private playerGeometry: BoxGeometry;
  private enemyGeometry: OctahedronGeometry;
  private friendlyGeometry: BoxGeometry;

  constructor(scene: Scene) {
    this.scene = scene;
    this.maxDistance = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;

    const poolSize = GameConfig.getProjectilePoolSize();

    this.playerGeometry = new BoxGeometry(0.12, 0.12, 1.4);
    this.enemyGeometry = new OctahedronGeometry(0.22, 0);
    this.friendlyGeometry = new BoxGeometry(0.14, 0.14, 1.05);
    const material = new MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    for (let i = 0; i < poolSize; i++) {
      const mesh = new Mesh(this.playerGeometry, material.clone());
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
        baseOpacity: 0.9,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 发射子弹
   * @param origin 发射位置
   * @param direction 发射方向
   * @param damage 伤害值
   * @param owner 发射者（用于防止立即碰撞）
   * @param faction 子弹阵营（用于伤害检测）
   */
  public fire(
    origin: Vector3,
    direction: Vector3,
    damage: number,
    owner?: Object3D,
    faction?: string
  ): void {
    // 找到未激活的子弹
    const projectile = this.pool.find((p) => !p.active);
    if (!projectile) return;

    projectile.mesh.position.copy(origin);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(origin);
    projectile.damage = damage; // 设置伤害
    projectile.owner = owner; // 记录发射者
    projectile.mesh.userData.faction = faction; // 设置阵营
    this.applyProjectileVisual(projectile, faction);
    projectile.mesh.visible = true;
    projectile.active = true;
  }

  /**
   * 更新所有子弹
   */
  public update(
    deltaTime: number,
    impactHeight?: number,
    onEnvironmentHit?: (position: Vector3) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      // 移动子弹
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

        if (projectile.owner && target === projectile.owner) continue;

        const targetWorldPos = new Vector3();
        target.getWorldPosition(targetWorldPos);

        const distance = projectile.mesh.position.distanceTo(targetWorldPos);
        const collisionThreshold = 5;

        if (distance < collisionThreshold) {
          onHit(target, projectile.mesh, projectile.damage);
          this.deactivate(projectile);
          break;
        }
      }
    }
  }

  /**
   * 停用子弹
   */
  private deactivate(projectile: Projectile): void {
    projectile.mesh.visible = false;
    projectile.active = false;
    projectile.mesh.scale.setScalar(1);
  }

  private applyProjectileVisual(projectile: Projectile, faction?: string): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    if (faction === 'ENEMY') {
      projectile.mesh.geometry = this.enemyGeometry;
      material.color.set(0xff7a3a);
      projectile.baseOpacity = 0.84;
      projectile.baseScale.set(0.9, 0.9, 1.3);
    } else if (faction === 'FRIENDLY') {
      projectile.mesh.geometry = this.friendlyGeometry;
      material.color.set(0x7af8ff);
      projectile.baseOpacity = 0.82;
      projectile.baseScale.set(0.78, 0.78, 1.55);
    } else {
      projectile.mesh.geometry = this.playerGeometry;
      material.color.set(0xfff2a0);
      projectile.baseOpacity = 0.96;
      projectile.baseScale.set(0.62, 0.62, 1.95);
    }

    material.opacity = projectile.baseOpacity;
    projectile.mesh.quaternion.setFromUnitVectors(FORWARD, projectile.direction);
    projectile.mesh.scale.copy(projectile.baseScale);
  }

  private updateProjectileVisual(projectile: Projectile): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    const travel = projectile.mesh.position.distanceTo(projectile.startPosition);
    const pulse = Math.sin(travel * 0.18 + projectile.pulseOffset) * 0.08 + 1;
    const stretchPulse = Math.sin(travel * 0.12 + projectile.pulseOffset * 0.7) * 0.06;

    material.opacity = Math.min(1, projectile.baseOpacity * (0.94 + (pulse - 1) * 1.2));
    projectile.mesh.scale.set(
      projectile.baseScale.x * (1 - stretchPulse * 0.45),
      projectile.baseScale.y * (1 - stretchPulse * 0.45),
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
    this.playerGeometry.dispose();
    this.enemyGeometry.dispose();
    this.friendlyGeometry.dispose();
    this.pool = [];
  }
}
