import * as THREE from 'three';
import { EnemyAI } from './EnemyAI';
import { EnemyConfig } from './EnemyTypes';

/**
 * 友军AI - 协助玩家战斗的飞机
 *
 * 核心特性：
 * - 使用敌人AI和模型
 * - 攻击敌方敌人而不是玩家
 * - 伤害和AI行为与敌人一致
 * - 被击败后消失，不掉落道具
 */
export class FriendlyAI {
  private enemy: EnemyAI;
  public isFriendly: boolean = true; // 标识为友军

  constructor(mesh: THREE.Group, config: EnemyConfig, scene: THREE.Scene) {
    // 创建敌人AI实例
    this.enemy = new EnemyAI(mesh, config, scene);

    // 标识 mesh 为友军（用于碰撞检测）
    mesh.userData.isFriendly = true;

    // 设置射击回调，用于追踪友军子弹
    this.enemy.onFire = (_position: THREE.Vector3, _direction: THREE.Vector3, _damage: number) => {
      // 这个回调会在 Game.ts 中被覆盖
    };
  }

  /**
   * 更新友军
   * @param deltaTime 时间增量
   * @param enemyMeshes 敌方敌人列表（用于寻找攻击目标）
   */
  public update(deltaTime: number, enemyMeshes: THREE.Object3D[]): void {
    // 寻找最近的敌方敌人
    const nearestEnemy = this.findNearestEnemy(enemyMeshes);

    // 调试日志：友军更新状态
    const dist = nearestEnemy ? this.enemy.getMesh().position.distanceTo(nearestEnemy.position) : Infinity;
    console.log(`[友军AI] 更新, 最近敌人距离: ${dist.toFixed(1)}m`);

    // 如果找到目标，传入目标位置；否则传入null（EnemyAI会处理）
    const targetPosition = nearestEnemy ? nearestEnemy.position : new THREE.Vector3();

    // 调用敌人AI的update，传入敌人位置而不是玩家位置
    this.enemy.update(deltaTime, targetPosition);

    // 如果友军攻击冷却完毕且有目标，触发攻击
    if (nearestEnemy && this.enemy['attackCooldown'] <= 0) {
      console.log(`[友军AI] 攻击冷却完毕，应该开火`);
      // 友军自动射击在 EnemyAI 内部处理
      // 我们只需要提供目标位置
    }
  }

  /**
   * 寻找最近的敌方敌人
   */
  private findNearestEnemy(enemyMeshes: THREE.Object3D[]): THREE.Object3D | null {
    let nearest: THREE.Object3D | null = null;
    let minDistance = Infinity;

    for (const enemyMesh of enemyMeshes) {
      // 跳过友军自己
      if (enemyMesh === this.enemy.getMesh()) continue;

      const distance = this.enemy.getMesh().position.distanceTo(enemyMesh.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemyMesh;
      }
    }

    return nearest;
  }

  /**
   * 获取网格
   */
  public getMesh(): THREE.Group {
    return this.enemy.getMesh();
  }

  /**
   * 检查是否存活
   */
  public isAlive(): boolean {
    return this.enemy.isAlive();
  }

  /**
   * 获取生命系统
   */
  public getHealth(): { current: number; max: number } {
    return this.enemy.getHealth();
  }

  /**
   * 造成伤害
   */
  public takeDamage(damage: number): void {
    this.enemy.takeDamage(damage);
  }

  /**
   * 销毁友军
   */
  public dispose(scene: THREE.Scene): void {
    const mesh = this.enemy.getMesh();
    scene.remove(mesh);

    // 清理尾迹
    this.enemy['trail'].dispose();

    // 生命系统会在 onDeath 回调中处理
  }
}
