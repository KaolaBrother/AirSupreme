import type { Vector3 } from 'three';
import {
  DOCTRINE_RULES,
  releaseAttackOrders,
  type AttackOrders,
  type AttackRequest,
} from './doctrine/DoctrineTypes';
import { angularDistance, bearingBetween, wrapAngle } from './doctrine/DoctrineMath';

const DEG = Math.PI / 180;

/** 攻击令牌导演的规则常量 */
export const ATTACK_DIRECTOR_RULES = {
  /** 同时持令牌的敌机，指派方位（从玩家看）两两至少相隔这么多（弧度） */
  MIN_BEARING_SEPARATION: 60 * DEG,
  /** 绕开别人时实际留出的间隔（略大于下限，避免浮点误差落到 60° 以内） */
  PLACEMENT_SEPARATION: 61 * DEG,
  /** 交还令牌后的冷却（秒）：让别的敌机轮上 */
  RELEASE_COOLDOWN: DOCTRINE_RULES.TOKEN_RELEASE_COOLDOWN,
  /** Boss 战固定的令牌数 */
  BOSS_FIGHT_TOKENS: 2,
  /** 令牌数上限：6 架均匀分布时正好两两相隔 60° */
  MAX_TOKENS: 6,
} as const;

/** 导演眼里的一架敌机（EnemyAI 实现；测试里可以用假对象） */
export interface IDirectedJet {
  /** 导演读写的指令与记账 */
  readonly orders: AttackOrders;
  isAlive(): boolean;
  isStunned(): boolean;
  getMesh(): { readonly position: Vector3 };
  /** 条令的令牌请求；没有条令（不受导演管）时为 null */
  getAttackRequest(): Readonly<AttackRequest> | null;
}

/**
 * 同时可以对玩家发动攻击的敌机数（令牌数）。
 * - 关卡：1–2 关 2 个，3–5 关 3 个，6–8 关 4 个，9–10 关 5 个；
 * - 难度档（1..5，3 = 普通）：非常简单 / 简单 −1（最少 1 个），困难 / 专家 +1；
 * - Boss 战固定 2 个，不随关卡和难度变。
 */
export function getAttackTokenCount(
  level: number,
  difficultyLevel: number,
  bossFight: boolean
): number {
  if (bossFight) return ATTACK_DIRECTOR_RULES.BOSS_FIGHT_TOKENS;
  const safeLevel = Number.isFinite(level) ? Math.round(level) : 1;
  let tokens = safeLevel <= 2 ? 2 : safeLevel <= 5 ? 3 : safeLevel <= 8 ? 4 : 5;
  const difficulty = Number.isFinite(difficultyLevel) ? Math.round(difficultyLevel) : 3;
  if (difficulty <= 2) tokens -= 1;
  else if (difficulty >= 4) tokens += 1;
  return Math.max(1, tokens);
}

/**
 * 攻击令牌导演：限制同时对玩家发动攻击的敌机数，并给持令牌的敌机指派两两相隔 ≥ 60° 的
 * 进入方位（从玩家看的世界方位角，atan2(x, z)）。
 *
 * 每个模拟步在敌机更新之前调用一次 update；结果写在每架敌机的 orders 上，敌机的条令在
 * 自己的更新里读取。导演不分配内存（复用内部数组），不接触渲染器，也不读时钟。
 */
export class AttackDirector {
  private sequence = 0;
  /** 逐步复用：本步持令牌的敌机（按方位分配顺序排好）与它们的指派方位 */
  private readonly holders: IDirectedJet[] = [];
  private readonly bearings: number[] = [];

  /** 清空记账（换关 / 清场）；各敌机的 orders 由它们自己在重新生成时复位 */
  public reset(): void {
    this.sequence = 0;
    this.holders.length = 0;
    this.bearings.length = 0;
  }

  /**
   * @param jets 当前在场的敌机
   * @param playerPosition 玩家位置；null = 没有可攻击的玩家（全部收回）
   * @param capacity 令牌数（见 getAttackTokenCount）；≤ 0 时全部收回
   */
  public update(
    dt: number,
    jets: readonly IDirectedJet[],
    playerPosition: Vector3 | null,
    capacity: number
  ): void {
    const step = dt > 0 ? dt : 0;
    const limit =
      playerPosition && Number.isFinite(capacity)
        ? Math.max(0, Math.min(ATTACK_DIRECTOR_RULES.MAX_TOKENS, Math.floor(capacity)))
        : 0;
    const holders = this.holders;
    holders.length = 0;

    // 1. 记账：冷却、等待时间；收回不该再持有的令牌
    for (let i = 0; i < jets.length; i++) {
      const jet = jets[i];
      const orders = jet.orders;
      orders.cooldown = Math.max(0, orders.cooldown - step);
      const request = jet.getAttackRequest();
      const able = request !== null && jet.isAlive() && !jet.isStunned();
      if (orders.hasToken) {
        if (!able || !request.wants) {
          // 阵亡 / 瘫痪 / 航路结束：令牌交还
          releaseAttackOrders(orders, ATTACK_DIRECTOR_RULES.RELEASE_COOLDOWN);
        } else {
          holders.push(jet);
        }
      } else {
        orders.bearing = Number.NaN;
        orders.waiting = able && request.wants ? orders.waiting + step : 0;
      }
    }

    // 2. 令牌数变少（玩家阵亡、进入 Boss 战）：从最晚领到的开始收回
    while (holders.length > limit) {
      let latest = 0;
      for (let i = 1; i < holders.length; i++) {
        if (holders[i].orders.sequence > holders[latest].orders.sequence) latest = i;
      }
      releaseAttackOrders(holders[latest].orders, 0);
      holders.splice(latest, 1);
    }

    // 3. 发放：等得最久的先领；原地开火的机型只在它的方位空着时才领
    if (playerPosition) {
      this.assignBearings(playerPosition);
      while (holders.length < limit) {
        const next = this.pickCandidate(jets, playerPosition);
        if (!next) break;
        next.orders.hasToken = true;
        next.orders.waiting = 0;
        next.orders.bearing = Number.NaN;
        next.orders.sequence = ++this.sequence;
        holders.push(next);
        this.assignBearings(playerPosition);
      }
    }
  }

  /** 本步持令牌的敌机数（update 之后有效） */
  public getHolderCount(): number {
    return this.holders.length;
  }

  private pickCandidate(
    jets: readonly IDirectedJet[],
    playerPosition: Vector3
  ): IDirectedJet | null {
    let best: IDirectedJet | null = null;
    let bestWaiting = -1;
    let bestDistanceSq = Infinity;
    const leashSq = DOCTRINE_RULES.LEASH_DISTANCE * DOCTRINE_RULES.LEASH_DISTANCE;
    for (let i = 0; i < jets.length; i++) {
      const jet = jets[i];
      const orders = jet.orders;
      if (orders.hasToken || orders.cooldown > 0) continue;
      const request = jet.getAttackRequest();
      if (!request || !request.wants || !jet.isAlive() || jet.isStunned()) continue;
      const position = jet.getMesh().position;
      const distanceSq = position.distanceToSquared(playerPosition);
      if (!(distanceSq <= leashSq)) continue;
      if (request.bearingPriority === 0 && !this.isBearingFree(position, playerPosition)) continue;
      if (
        orders.waiting > bestWaiting ||
        (orders.waiting === bestWaiting && distanceSq < bestDistanceSq)
      ) {
        best = jet;
        bestWaiting = orders.waiting;
        bestDistanceSq = distanceSq;
      }
    }
    return best;
  }

  /**
   * 这个位置的方位与其他“原地开火”的持令牌敌机相隔足够远。会机动的持令牌敌机不算：
   * 它们的指派方位会在下一次分配时给原地开火的让开。
   */
  private isBearingFree(position: Vector3, playerPosition: Vector3): boolean {
    const bearing = bearingBetween(playerPosition.x, playerPosition.z, position.x, position.z);
    for (let i = 0; i < this.holders.length; i++) {
      if (this.holders[i].getAttackRequest()?.bearingPriority !== 0) continue;
      if (angularDistance(bearing, this.bearings[i]) < ATTACK_DIRECTOR_RULES.PLACEMENT_SEPARATION) {
        return false;
      }
    }
    return true;
  }

  /**
   * 给所有持令牌的敌机指派方位：按（bearingPriority，领到的先后）依次定，每架取离自己期望方位
   * 最近、且与已定方位相隔 ≥ 61° 的角度；实在排不开（5 架以上）时改为全体均匀分布。
   */
  private assignBearings(playerPosition: Vector3): void {
    const holders = this.holders;
    const bearings = this.bearings;
    const count = holders.length;
    bearings.length = count;
    if (count === 0) return;

    // 插入排序（最多 6 个）：优先级小的在前，其次是先领到的
    for (let i = 1; i < count; i++) {
      const jet = holders[i];
      let j = i - 1;
      while (j >= 0 && this.comesBefore(jet, holders[j])) {
        holders[j + 1] = holders[j];
        j--;
      }
      holders[j + 1] = jet;
    }

    let crowded = false;
    for (let i = 0; i < count; i++) {
      const desired = this.desiredBearing(holders[i], i, playerPosition);
      const placed = this.placeBearing(desired, i);
      if (Number.isNaN(placed)) {
        crowded = true;
        break;
      }
      bearings[i] = placed;
    }
    if (crowded) {
      // 均匀分布：以第一架的方位为起点
      const first = this.desiredBearing(holders[0], 0, playerPosition);
      const base = Number.isFinite(first) ? first : 0;
      const stepAngle = (Math.PI * 2) / count;
      for (let i = 0; i < count; i++) bearings[i] = wrapAngle(base + stepAngle * i);
    }
    for (let i = 0; i < count; i++) holders[i].orders.bearing = bearings[i];
  }

  private comesBefore(a: IDirectedJet, b: IDirectedJet): boolean {
    const priorityA = a.getAttackRequest()?.bearingPriority ?? 0;
    const priorityB = b.getAttackRequest()?.bearingPriority ?? 0;
    if (priorityA !== priorityB) return priorityA < priorityB;
    return a.orders.sequence < b.orders.sequence;
  }

  /**
   * 一架持令牌敌机期望的方位：
   * - 原地开火的机型（优先级 0）：它当前所在的方位；
   * - 条令给了期望方位（战斗机：玩家的六点钟）：用它；
   * - 其余（侦察机）：沿用上一步的指派；刚领到时，若已有一架成对机型在场就取它的对面，
   *   否则取自己当前所在的方位。
   */
  private desiredBearing(jet: IDirectedJet, index: number, playerPosition: Vector3): number {
    const request = jet.getAttackRequest();
    const position = jet.getMesh().position;
    const actual = bearingBetween(playerPosition.x, playerPosition.z, position.x, position.z);
    if (!request || request.bearingPriority === 0) return actual;
    if (Number.isFinite(request.desiredBearing)) return request.desiredBearing;
    if (Number.isFinite(jet.orders.bearing)) return jet.orders.bearing;
    if (request.pairsOpposite) {
      for (let i = 0; i < index; i++) {
        if (this.holders[i].getAttackRequest()?.pairsOpposite) {
          return wrapAngle(this.bearings[i] + Math.PI);
        }
      }
    }
    return actual;
  }

  /**
   * 离 desired 最近、且与前 count 个已定方位都相隔 ≥ PLACEMENT_SEPARATION 的角度；
   * 没有这样的角度时返回 NaN。
   */
  private placeBearing(desired: number, count: number): number {
    const separation = ATTACK_DIRECTOR_RULES.PLACEMENT_SEPARATION;
    if (this.isClear(desired, count, separation)) return wrapAngle(desired);
    let best = Number.NaN;
    let bestOffset = Infinity;
    for (let i = 0; i < count; i++) {
      for (let side = -1; side <= 1; side += 2) {
        // 紧贴某个已定方位的边界；多留一点余量，免得舍入后又落回间隔以内
        const candidate = wrapAngle(this.bearings[i] + side * (separation + 1e-6));
        if (!this.isClear(candidate, count, separation)) continue;
        const offset = angularDistance(candidate, desired);
        if (offset < bestOffset) {
          best = candidate;
          bestOffset = offset;
        }
      }
    }
    return best;
  }

  private isClear(bearing: number, count: number, separation: number): boolean {
    for (let i = 0; i < count; i++) {
      if (angularDistance(bearing, this.bearings[i]) < separation) return false;
    }
    return true;
  }
}
