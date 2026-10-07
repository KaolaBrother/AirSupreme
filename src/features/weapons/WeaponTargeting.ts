import * as THREE from 'three';
import { getDeclaredHitRadius, type CombatTarget, type DamageSource } from '@/core/CombatContracts';
import { Faction } from '@/core/Faction';

/**
 * 特殊武器的纯逻辑命中工具（无 DOM / WebGL 依赖，可在单元测试中直接使用）
 *
 * 规则：
 * - 只有 ENEMY 与 CIVILIAN 会受到伤害（平民可能被误伤，惩罚由外层处理）；
 * - FRIENDLY 与 NEUTRAL（玩家）永远不会被命中，射线 / 弹体直接穿过；
 * - 自动索敌（蜂群导弹、EMP 瘫痪）只认 ENEMY。
 */

/** 目标既未声明 hitRadius、网格也未声明 userData.hitRadius 时的兜底半径（米） */
export const DEFAULT_TARGET_HIT_RADIUS = 4;

/** 该阵营能否被玩家特殊武器伤害 */
export function canWeaponDamage(faction: Faction): boolean {
  return faction === Faction.ENEMY || faction === Faction.CIVILIAN;
}

/** 该阵营能否被自动索敌 / EMP 瘫痪 */
export function isHostileFaction(faction: Faction): boolean {
  return faction === Faction.ENEMY;
}

/**
 * 有效命中半径：取目标契约半径与网格声明半径（getDeclaredHitRadius）中的较大者，
 * 避免包装层传了偏小的默认值导致大型舰船 / Boss 部件“打不中”。
 */
export function resolveTargetHitRadius(target: CombatTarget): number {
  const base =
    Number.isFinite(target.hitRadius) && target.hitRadius > 0
      ? target.hitRadius
      : DEFAULT_TARGET_HIT_RADIUS;
  return Math.max(base, getDeclaredHitRadius(target.mesh, base));
}

/** 是否为无人机（单位系统 userData.unitType = 'DRONE'，或显式标记） */
export function isDroneTarget(target: CombatTarget): boolean {
  const data = target.mesh.userData as Record<string, unknown>;
  return data.unitType === 'DRONE' || data.isDrone === true || data.minionKind === 'drone';
}

export function isFiniteVector(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

/** 安全读取目标是否存活（包装层抛错时视为死亡，避免一帧内连锁崩溃） */
export function isTargetAlive(target: CombatTarget): boolean {
  try {
    return target.isAlive();
  } catch {
    return false;
  }
}

/**
 * 一帧的目标快照：每个目标每帧只读取一次世界坐标，供射线 / 溅射 / 近炸复用。
 */
export interface TargetSnapshot {
  target: CombatTarget;
  position: THREE.Vector3;
  radius: number;
  /** ENEMY 或 CIVILIAN：可被伤害 */
  damageable: boolean;
  /** ENEMY：可被自动索敌与瘫痪 */
  hostile: boolean;
}

export class TargetSnapshotBuffer {
  private readonly entries: TargetSnapshot[] = [];
  private count = 0;
  private readonly seen = new Set<CombatTarget>();

  /** 用当前目标列表刷新快照：跳过死亡、重复、非法坐标与不可伤害阵营 */
  public capture(targets: readonly CombatTarget[]): void {
    this.count = 0;
    this.seen.clear();
    for (const target of targets) {
      if (!target || this.seen.has(target)) continue;
      this.seen.add(target);
      if (!canWeaponDamage(target.faction) || !isTargetAlive(target)) continue;

      let entry = this.entries[this.count];
      if (!entry) {
        entry = {
          target,
          position: new THREE.Vector3(),
          radius: DEFAULT_TARGET_HIT_RADIUS,
          damageable: true,
          hostile: false,
        };
        this.entries.push(entry);
      }
      target.mesh.getWorldPosition(entry.position);
      if (!isFiniteVector(entry.position)) continue;

      entry.target = target;
      entry.radius = resolveTargetHitRadius(target);
      entry.damageable = true;
      entry.hostile = isHostileFaction(target.faction);
      this.count++;
    }
    this.seen.clear();
  }

  public size(): number {
    return this.count;
  }

  public get(index: number): TargetSnapshot {
    return this.entries[index];
  }

  /** 释放对目标的引用（clear / dispose 时调用，避免持有已销毁的单位） */
  public reset(): void {
    this.count = 0;
    this.seen.clear();
    this.entries.length = 0;
  }
}

/**
 * 射线与球求交，dir 必须已归一化。
 * 返回进入距离（起点在球内时为 0）；未相交或超出 maxDistance 返回 -1。
 */
export function intersectRaySphere(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  maxDistance: number
): number {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const along = ox * dir.x + oy * dir.y + oz * dir.z;
  const distSq = ox * ox + oy * oy + oz * oz;
  const radiusSq = radius * radius;
  if (distSq <= radiusSq) {
    return 0;
  }
  if (along < 0) {
    return -1;
  }
  const perpSq = distSq - along * along;
  if (perpSq > radiusSq) {
    return -1;
  }
  const t = along - Math.sqrt(radiusSq - perpSq);
  return t <= maxDistance ? Math.max(0, t) : -1;
}

/**
 * 点到线段 a→b 的最近距离平方；outT 写入最近点参数（0..1）。
 * 用于高速弹体的扫掠命中，避免穿模。
 */
export function segmentPointDistanceSq(
  a: THREE.Vector3,
  b: THREE.Vector3,
  point: THREE.Vector3,
  outT?: { t: number }
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const apz = point.z - a.z;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  let t = lengthSq > 1e-9 ? (apx * abx + apy * aby + apz * abz) / lengthSq : 0;
  t = Math.max(0, Math.min(1, t));
  if (outT) outT.t = t;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * 前向锥形索敌：从快照里挑出 ENEMY 目标，按“距离 × 偏角”评分排序后写入 out。
 * 返回写入数量（不超过 maxCount）。
 */
export function acquireConeTargets(
  snapshot: TargetSnapshotBuffer,
  origin: THREE.Vector3,
  forward: THREE.Vector3,
  range: number,
  cosHalfAngle: number,
  maxCount: number,
  out: TargetSnapshot[]
): number {
  out.length = 0;
  const scores = coneScores;
  scores.length = 0;
  for (let i = 0; i < snapshot.size(); i++) {
    const entry = snapshot.get(i);
    if (!entry.hostile) continue;
    const dx = entry.position.x - origin.x;
    const dy = entry.position.y - origin.y;
    const dz = entry.position.z - origin.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > range + entry.radius || distance < 1e-3) continue;
    const cos = (dx * forward.x + dy * forward.y + dz * forward.z) / distance;
    if (cos < cosHalfAngle) continue;
    // 偏角越小、距离越近越优先；大目标（半径大）略微优先
    const score = distance * (1.6 - cos) - entry.radius * 2;
    insertSorted(out, scores, entry, score);
  }
  if (out.length > maxCount) {
    out.length = maxCount;
  }
  return out.length;
}

const coneScores: number[] = [];

function insertSorted(
  list: TargetSnapshot[],
  scores: number[],
  entry: TargetSnapshot,
  score: number
): void {
  let index = list.length;
  while (index > 0 && scores[index - 1] > score) {
    index--;
  }
  list.splice(index, 0, entry);
  scores.splice(index, 0, score);
}

/**
 * 球形溅射伤害：直接命中目标吃满伤害，其余可伤害目标按表面距离线性衰减（边缘 40%）。
 * 返回受伤目标数量。
 */
export function applySplashDamage(
  snapshot: TargetSnapshotBuffer,
  center: THREE.Vector3,
  splashRadius: number,
  damage: number,
  source: DamageSource,
  direct: CombatTarget | null,
  onDamaged?: (entry: TargetSnapshot, amount: number) => void
): number {
  if (!(damage > 0)) {
    return 0;
  }
  let hits = 0;
  for (let i = 0; i < snapshot.size(); i++) {
    const entry = snapshot.get(i);
    if (!entry.damageable) continue;
    let amount = 0;
    if (entry.target === direct) {
      amount = damage;
    } else if (splashRadius > 0) {
      const surface = Math.max(0, entry.position.distanceTo(center) - entry.radius);
      if (surface > splashRadius) continue;
      amount = damage * (1 - 0.6 * (surface / splashRadius));
    } else {
      continue;
    }
    if (!isTargetAlive(entry.target)) continue;
    entry.target.applyDamage(amount, source, center);
    onDamaged?.(entry, amount);
    hits++;
  }
  return hits;
}
