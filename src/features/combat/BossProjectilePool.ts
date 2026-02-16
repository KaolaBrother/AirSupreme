import * as THREE from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';

/**
 * Boss炮弹数据
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
 * Boss炮弹对象池
 * 使用更大的几何体和红橙色，区别于普通敌人炮弹
 */
export class BossProjectilePool {
  private pool: Projectile[] = [];
  private maxDistance: number;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.maxDistance = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;

    const poolSize = GameConfig.getProjectilePoolSize();

    // 创建Boss炮弹几何体和材质 - 比普通炮弹大约2.7倍
    const geometry = new THREE.SphereGeometry(0.8, 12, 12);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff3300, // 红橙色
      transparent: true,
      opacity: 0.9,
    });

    // 预创建炮弹
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
   * 发射炮弹
   * @param origin 发射位置
   * @param direction 发射方向
   * @param damage 伤害值
   * @param owner 发射者（用于防止立即碰撞）
   * @param faction 炮弹阵营（用于伤害检测）
   */
  public fire(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    owner?: THREE.Object3D,
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
    projectile.mesh.visible = true;
    projectile.active = true;
  }

  /**
   * 更新所有炮弹
   */
  public update(deltaTime: number): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      // 移动炮弹
      projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * deltaTime);

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
  }

  public getActiveProjectiles(): THREE.Mesh[] {
    return this.pool.filter((p) => p.active).map((p) => p.mesh);
  }

  public clear(): void {
    for (const projectile of this.pool) {
      projectile.mesh.visible = false;
      projectile.active = false;
    }
  }
}
