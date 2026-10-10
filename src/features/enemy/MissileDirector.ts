import type { Vector3 } from 'three';
import { JET_MISSILE_RULES } from './EnemyWeapons';

/**
 * 敌机导弹的发射通道（窄接口）：敌机不是“单位”，但它的导弹要走单位导弹池，HUD 的
 * “锁定中 → 来袭”预警、热焰弹、EMP、近防炮才会照常生效。由 GameCoordinator 用单位系统
 * 实现并交给 EnemySystem（setMissileLauncher）；没有通道时敌机不锁定、不发射导弹。
 */
export interface IJetMissileLauncher {
  /** 通道可用（单位系统已加载）：不可用时敌机领不到导弹令牌 */
  isAvailable(): boolean;
  /**
   * 发射一枚追踪玩家的导弹（数值见 EnemyWeapons.JET_MISSILE_SPEC）。position / direction 只在
   * 调用期间有效；source 为发射者标签 'jet:<机型>'。返回是否发射成功。
   */
  launch(position: Vector3, direction: Vector3, source: string): boolean;
  /** 正在追踪玩家的敌机导弹数 */
  countInFlight(): number;
  /** 有敌机正在用导弹锁定玩家（每步写入）：驱动 HUD 的“锁定中”预警与告警音 */
  setLockWarning(active: boolean): void;
}

/** 全队导弹令牌导演眼里的一架敌机（EnemyAI 实现；测试里可以用假对象） */
export interface IMissileJet {
  isAlive(): boolean;
  isStunned(): boolean;
  /** 条令想要的导弹令牌数（0 = 现在不需要；没有条令的敌机恒为 0） */
  getMissileRequest(): number;
  /** 手里已有的导弹令牌数 */
  getMissileGrant(): number;
  setMissileGrant(count: number): void;
}

/**
 * 同时飞向玩家的敌机导弹数上限：1–5 关 1 枚，6–10 关 2 枚；Boss 战 0（小兵不发射导弹）。
 */
export function getJetMissileCap(level: number, bossFight: boolean): number {
  if (bossFight) return 0;
  const safeLevel = Number.isFinite(level) ? Math.round(level) : 1;
  return safeLevel >= JET_MISSILE_RULES.LATE_LEVEL
    ? JET_MISSILE_RULES.LATE_CAP
    : JET_MISSILE_RULES.EARLY_CAP;
}

function wantedTokens(jet: IMissileJet): number {
  if (!jet.isAlive() || jet.isStunned()) return 0;
  const request = jet.getMissileRequest();
  return Number.isFinite(request) && request > 0 ? Math.floor(request) : 0;
}

/**
 * 发放全队导弹令牌，保证“在飞的敌机导弹 + 各机手里的令牌 ≤ cap”。
 *
 * 每个模拟步在敌机更新之前调用一次：先收回不再需要的令牌（条令不再申请、阵亡、瘫痪、
 * cap 变成 0），再把空出来的名额按列表顺序发给还缺的敌机——一架想要 2 个而只剩 1 个时
 * 先拿 1 个。敌机每发射一枚自己交还一个令牌（EnemyAI），导弹起飞后名额由 inFlight 占着。
 * 不分配内存。
 *
 * @param inFlight 正在追踪玩家的敌机导弹数
 */
export function grantJetMissiles(
  jets: readonly IMissileJet[],
  cap: number,
  inFlight: number
): void {
  const limit = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0;
  let held = 0;
  for (let i = 0; i < jets.length; i++) {
    const jet = jets[i];
    const grant = jet.getMissileGrant();
    const keep = limit > 0 ? Math.min(grant, wantedTokens(jet)) : 0;
    if (keep !== grant) jet.setMissileGrant(keep);
    held += keep;
  }
  let free = limit - held - (Number.isFinite(inFlight) && inFlight > 0 ? Math.floor(inFlight) : 0);
  for (let i = 0; i < jets.length && free > 0; i++) {
    const jet = jets[i];
    const grant = jet.getMissileGrant();
    const missing = wantedTokens(jet) - grant;
    if (missing <= 0) continue;
    const added = Math.min(missing, free);
    jet.setMissileGrant(grant + added);
    free -= added;
  }
}
