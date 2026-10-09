import type { Object3D, Vector3 } from 'three';
import type { Faction } from '@/core/Faction';

/**
 * 跨系统战斗契约
 *
 * 特殊武器（weapons）、地面/海上/空中单位（units）、Boss 与协调器之间只通过这里的
 * 类型交换数据，避免特性模块之间形成隐式依赖图。
 */

/** 特殊武器标识（主炮与锁定导弹不在此列） */
export type SpecialWeaponId = 'rockets' | 'laser' | 'swarm' | 'railgun' | 'emp';

/** 解锁顺序即 HUD / 切换顺序 */
export const SPECIAL_WEAPON_IDS: readonly SpecialWeaponId[] = [
  'rockets',
  'laser',
  'swarm',
  'railgun',
  'emp',
];

/** 伤害来源：用于命中反馈、音效分流与平衡统计 */
export type DamageSource =
  | 'cannon'
  | 'missile'
  | 'rocket'
  | 'laser'
  | 'swarm'
  | 'railgun'
  | 'emp'
  | 'enemy-fire'
  | 'unit-fire'
  | 'boss'
  | 'collision';

/** 目标所在的作战域 */
export type CombatTargetKind = 'air' | 'ground' | 'sea' | 'boss-part' | 'projectile';

/**
 * 统一可命中目标：喷气机、地面/海上单位、Boss 部件、可拦截的导弹都可以包装成它。
 * 特殊武器只依赖这个接口做射线 / 范围命中判定。
 */
export interface CombatTarget {
  readonly id: string;
  /** 用于读取世界坐标（getWorldPosition） */
  readonly mesh: Object3D;
  readonly faction: Faction;
  readonly kind: CombatTargetKind;
  /** 命中判定半径（米，世界坐标系） */
  readonly hitRadius: number;
  isAlive(): boolean;
  /** hitPoint 为命中点世界坐标（可选，用于命中特效贴近表面） */
  applyDamage(amount: number, source: DamageSource, hitPoint?: Vector3): void;
  /** EMP 等控制效果；不支持控制效果的目标可省略 */
  applyStun?(seconds: number): void;
}

/** 热焰弹等诱饵点：导弹会以 strength 为权重偏转到诱饵 */
export interface DecoyPoint {
  readonly position: Vector3;
  /** 0-1，诱骗强度随时间衰减 */
  readonly strength: number;
}

/** 由反制系统（热焰弹）提供，导弹系统按需查询 */
export interface IDecoyProvider {
  getActiveDecoys(): readonly DecoyPoint[];
}

/** 可被 EMP 等效果瘫痪的对象 */
export interface IStunnable {
  applyStun(seconds: number): void;
  isStunned(): boolean;
}

/** 约定：网格 userData.hitRadius 声明命中半径（米）；缺省时由调用方回退默认值 */
export const HIT_RADIUS_USERDATA_KEY = 'hitRadius';

/** 读取网格声明的命中半径；未声明或非法时返回 fallback */
export function getDeclaredHitRadius(mesh: Object3D, fallback: number): number {
  const value: unknown = mesh.userData[HIT_RADIUS_USERDATA_KEY];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
