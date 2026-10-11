import type { Object3D, Vector3 } from 'three';

/**
 * 玩家对敌机构成的威胁（窄接口）：敌机条令只通过它知道“导引头有没有锁住我”“有没有导弹
 * 朝我飞来”，不接触 HUD、锁定指示器或导弹系统本身。由 GameCoordinator 实现并交给
 * EnemySystem（setThreatProvider）；没有提供者时敌机视为不受威胁。
 */
export interface IJetThreatProvider {
  /** 玩家导引头已完成锁定（LOCK）的目标网格；没有为 null */
  getLockedTarget(): Object3D | null;
  /** 有玩家导弹正飞向这个目标网格 */
  isMissileInbound(target: Object3D): boolean;
  /** 玩家机头方向（世界坐标单位向量）写入 out；不可用时返回 false（out 不变） */
  getPlayerForward(out: Vector3): boolean;
  /** 玩家当前可以被攻击（存活、不在复活过程中）：为 false 时敌机全部停火、交还令牌 */
  isPlayerTargetable(): boolean;
}
