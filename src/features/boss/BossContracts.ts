import type { Group, Object3D, Vector3 } from 'three';
import type { BossConfig } from './BossTypes';
import type { BossMissileSystem } from './BossMissileSystem';
import type { HeavyWeaponImpactProfile } from '@/features/effects/ParticleSystem';
import type { HudText } from '@/ui/HUD';

/**
 * 所有 Boss（含前五关）共同遵守的鸭子类型契约。
 * BossBattleController 只通过这些方法驱动 Boss；新 Boss 必须完整实现。
 */
export interface IBossCore {
  update(deltaTime: number, playerMesh: Object3D | null, friendlyMeshes: Object3D[]): void;
  takeDamage(amount: number): void;
  getHealth(): { current: number; max: number };
  isAlive(): boolean;
  getMesh(): Group;
  getConfig(): BossConfig;
  getPosition(): Vector3;
  /** 可被玩家子弹 / 导弹 / 特殊武器命中的部件（世界坐标取自 getWorldPosition） */
  getCollisionParts(): Object3D[];
  getMissileSystem(): BossMissileSystem | null;
  dispose(): void;
  /** 血量归零时由 Boss 自己触发一次 */
  onDestroy?: (position: Vector3, config: BossConfig) => void;
}

/** Boss 特殊武器（熔岩、电弧、激光、冲击波等）对某个目标的一次命中 */
export interface BossHazardHit {
  damage: number;
  /** 复用现有重武器命中特效 / 音效分流 */
  profile: HeavyWeaponImpactProfile;
  /** 命中点世界坐标 */
  position: Vector3;
}

/** Boss 召唤的小兵类型；控制器映射到 EnemyType 或单位系统 */
export type BossMinionKind = 'scout' | 'fighter' | 'heavy' | 'ace' | 'drone';

/** 带独立血量的 Boss 子目标（护盾塔、气囊、散热口等），用于血条显示 */
export interface BossSubTarget {
  mesh: Object3D;
  current: number;
  max: number;
}

/**
 * 第 6-10 关 Boss 的扩展契约：阶段、无敌窗口、弱点倍率与特殊武器判定。
 *
 * 伤害路由约定：控制器对高级 Boss 一律调用 takeDamageAt(part, 原始伤害)，
 * 由 Boss 自己决定弱点倍率 / 子目标血量 / 无敌时忽略；不要在控制器里再乘倍率。
 *
 * 特殊武器判定约定：checkHazard 不做冷却，控制器按目标维护命中冷却（约 0.6s）。
 */
export interface IAdvancedBoss extends IBossCore {
  /** 当前阶段（从 1 开始） */
  getPhase(): number;
  getPhaseCount(): number;
  /** 潜航 / 隐形 / 护盾未破等无敌窗口 */
  isInvulnerable(): boolean;
  /** 某部件的伤害倍率（弱点 > 1，装甲 < 1），用于命中反馈提示 */
  getDamageMultiplier(part: Object3D): number;
  /** 部件命中的唯一入口：part 为 getCollisionParts() 中的对象 */
  takeDamageAt(part: Object3D, amount: number): void;
  /** 对目标位置做一次特殊武器命中检测；无命中返回 null */
  checkHazard(targetPosition: Vector3, targetRadius: number): BossHazardHit | null;
  /**
   * HUD 状态提示，如“潜航中 · 无敌”“护盾塔 3/4”；无提示返回 null。
   * 文案在生成时按当前语言取值（tr），切换语言后下一次调用即返回新语言。
   */
  getStatusLabel(): string | null;
  /** 带独立血量的子目标（可选） */
  getSubTargets?(): BossSubTarget[];
  /** EMP 瘫痪（可选）；隐形 Boss 被 EMP 命中时应强制现形 */
  applyStun?(seconds: number): void;

  /** 主炮开火：控制器把它接到 BossProjectilePool */
  onFire?: (position: Vector3, direction: Vector3, damage: number) => void;
  /** 导弹发射提示：控制器播放发射音效 */
  onMissileFired?: () => void;
  /**
   * 阶段切换：控制器播放剧情台词 / 音乐强调并闪烁提示。label 传双语原文（或 { text, params }，
   * 见 HudText）：HUD 按当前语言显示，显示期间切换语言随之重绘；纯字符串原样显示。
   */
  onPhaseChange?: (phase: number, label: HudText) => void;
  /** 召唤小兵 */
  onSpawnMinion?: (position: Vector3, kind: BossMinionKind) => void;
  /**
   * 特殊武器预警（例如“电弧充能”）：控制器显示 HUD 闪烁提示并播放预警音。
   * label 与 onPhaseChange 相同，传双语原文（或 { text, params }）。
   */
  onHazardWarning?: (label: HudText) => void;
}

/** 运行时判别：只有实现了扩展契约的 Boss 才走高级伤害 / 特殊武器路径 */
export function isAdvancedBoss(boss: unknown): boss is IAdvancedBoss {
  if (!boss || typeof boss !== 'object') {
    return false;
  }

  const candidate = boss as Partial<IAdvancedBoss>;
  return (
    typeof candidate.getPhase === 'function' &&
    typeof candidate.getPhaseCount === 'function' &&
    typeof candidate.isInvulnerable === 'function' &&
    typeof candidate.takeDamageAt === 'function' &&
    typeof candidate.checkHazard === 'function' &&
    typeof candidate.getStatusLabel === 'function'
  );
}
