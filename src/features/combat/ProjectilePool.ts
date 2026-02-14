import * as THREE from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';

/**
 * 子弹数据
 */
interface Projectile {
  mesh: THREE.Mesh;
  direction: THREE.Vector3;
  speed: number;
  active: boolean;
  startPosition: THREE.Vector3;
  damage: number; // 伤害值
  owner?: THREE.Object3D; // 发射者，用于防止子弹立即碰撞到发射者
}

/**
 * 子弹对象池
 * 使用对象池模式避免频繁创建/销毁对象
 */
export class ProjectilePool {
  private pool: Projectile[] = [];
  private maxDistance: number;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.maxDistance = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;

    const poolSize = GameConfig.getProjectilePoolSize();

    // 创建子弹几何体和材质
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
    });

    // 预创建子弹
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.visible = false;
      this.scene.add(mesh);

      this.pool.push({
        mesh,
        direction: new THREE.Vector3(),
        speed: GAME_CONSTANTS.PROJECTILE.SPEED,
        active: false,
        startPosition: new THREE.Vector3(),
        damage: 10, // 默认伤害
      });
    }
  }

  /**
   * 发射子弹
   * @param origin 发射位置
   * @param direction 发射方向
   * @param damage 伤害值
   * @param owner 发射者（用于防止立即碰撞）
   */
  public fire(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, owner?: THREE.Object3D): void {
    // 找到未激活的子弹
    const projectile = this.pool.find(p => !p.active);
    if (!projectile) return;

    projectile.mesh.position.copy(origin);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(origin);
    projectile.damage = damage; // 设置伤害
    projectile.owner = owner; // 记录发射者
    projectile.mesh.visible = true;
    projectile.active = true;
  }

  /**
   * 更新所有子弹
   */
  public update(deltaTime: number): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      // 移动子弹
      projectile.mesh.position.addScaledVector(
        projectile.direction,
        projectile.speed * deltaTime
      );

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
    targets: THREE.Object3D[],
    onHit: (target: THREE.Object3D, projectile: THREE.Mesh, damage: number) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      for (const target of targets) {
        if (!target.visible) continue;

        // 跳过发射者自己，防止子弹立即碰撞到发射者
        if (projectile.owner && target === projectile.owner) continue;

        const distance = projectile.mesh.position.distanceTo(target.position);
        const collisionThreshold = 5; // 碰撞距离

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
  }

  /**
   * 获取所有活跃的子弹
   */
  public getActiveProjectiles(): THREE.Mesh[] {
    return this.pool
      .filter(p => p.active)
      .map(p => p.mesh);
  }
}
