import * as THREE from 'three';
import type { DecoyPoint } from '@/core/CombatContracts';
import { BossType } from '@/features/boss/BossTypes';
import type { BossMissileSystem } from '@/features/boss/BossMissileSystem';

/**
 * 第 6-10 关 Boss 的控制器辅助：出生点选择（地表采样）、特殊武器命中冷却、
 * 热焰弹对 Boss 导弹的诱骗、神谕核心的城堡联动状态。
 * 纯逻辑 + 预分配对象，不依赖 DOM。
 */

export type BossSurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

/** Boss 出生点钳制范围（米）：留在软边界以内，避免一出生就在战场边缘 */
const SPAWN_LIMIT = 1150;
const WATER_Y = -48;

export interface BossSpawnRequest {
  type: BossType;
  playerPosition: THREE.Vector3;
  /** 玩家水平前向（单位向量 XZ）；Boss 默认出现在玩家前方 */
  forwardX: number;
  forwardZ: number;
  sample: BossSurfaceSampler;
  /** CITADEL 决战区（神谕主宰锚点）；非第 10 关为 null */
  coreArena: THREE.Vector3 | null;
}

export interface BossSpawnPlacement {
  position: THREE.Vector3;
  /** 朝向玩家的航向（绕 Y，弧度） */
  yaw: number;
}

function clampToArena(value: number): number {
  return Math.max(-SPAWN_LIMIT, Math.min(SPAWN_LIMIT, Number.isFinite(value) ? value : 0));
}

/**
 * 在期望点附近按螺旋搜索满足条件的落点（陆地 / 水面）；找不到时返回期望点。
 */
function searchSurface(
  sample: BossSurfaceSampler,
  originX: number,
  originZ: number,
  accept: (surface: { y: number; water: boolean }) => boolean,
  maxRadius: number
): { x: number; z: number; y: number; found: boolean } {
  const first = sample(originX, originZ);
  if (accept(first)) return { x: originX, z: originZ, y: first.y, found: true };
  for (let radius = 60; radius <= maxRadius; radius += 60) {
    const steps = Math.max(8, Math.round((radius * Math.PI * 2) / 90));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = clampToArena(originX + Math.cos(angle) * radius);
      const z = clampToArena(originZ + Math.sin(angle) * radius);
      const surface = sample(x, z);
      if (accept(surface)) return { x, z, y: surface.y, found: true };
    }
  }
  return { x: originX, z: originZ, y: first.y, found: false };
}

/**
 * 选择 Boss 出生点（api-spec §2 的偏移，按玩家朝向旋转到“前方”并贴合地形）：
 * - 熔岩巨像：前方 260 米的陆地（不在火山锥上），y = 地表
 * - 深渊利维坦：前方 260 米的开阔水面（冰架上则就近找水），y = -48
 * - 雷霆飞艇：前方 300 米、高度 ≥ 170 且高于地表 120 米
 * - 幻影之翼：前方 320 米、右侧 120 米、玩家高度 +40，且高于地表 60 米
 * - 神谕主宰：城堡核心决战区（getCoreArena），否则前方 280 米、高度 160
 */
export function resolveAdvancedBossSpawn(request: BossSpawnRequest): BossSpawnPlacement {
  const { playerPosition: p, sample } = request;
  let fx = request.forwardX;
  let fz = request.forwardZ;
  const length = Math.hypot(fx, fz);
  if (!Number.isFinite(length) || length < 1e-3) {
    fx = 0;
    fz = -1;
  } else {
    fx /= length;
    fz /= length;
  }
  // 右侧向量（前方为 -Z 时右侧为 +X）
  const rx = -fz;
  const rz = fx;
  const ahead = (distance: number, lateral = 0): { x: number; z: number } => ({
    x: clampToArena(p.x + fx * distance + rx * lateral),
    z: clampToArena(p.z + fz * distance + rz * lateral),
  });

  const position = new THREE.Vector3();
  switch (request.type) {
    case BossType.MAGMA_COLOSSUS: {
      const target = ahead(260);
      const spot = searchSurface(
        sample,
        target.x,
        target.z,
        (surface) => !surface.water && surface.y < WATER_Y + 160,
        900
      );
      position.set(spot.x, spot.y, spot.z);
      break;
    }
    case BossType.ABYSSAL_LEVIATHAN: {
      const target = ahead(260);
      const spot = searchSurface(sample, target.x, target.z, (surface) => surface.water, 1100);
      position.set(spot.x, WATER_Y, spot.z);
      break;
    }
    case BossType.TEMPEST_ZEPPELIN: {
      const target = ahead(300);
      const ground = sample(target.x, target.z).y;
      position.set(target.x, Math.max(170, ground + 120), target.z);
      break;
    }
    case BossType.PHANTOM_WING: {
      const target = ahead(320, 120);
      const ground = sample(target.x, target.z).y;
      const desired = Number.isFinite(p.y) ? p.y + 40 : 120;
      position.set(target.x, Math.max(desired, ground + 60, 40), target.z);
      break;
    }
    case BossType.ORACLE_PRIME:
    default: {
      if (request.coreArena) {
        position.copy(request.coreArena);
      } else {
        const target = ahead(280);
        const ground = sample(target.x, target.z).y;
        position.set(target.x, Math.max(160, ground + 120), target.z);
      }
      break;
    }
  }

  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    position.set(p.x, 160, p.z - 280);
  }
  const yaw = Math.atan2(p.x - position.x, p.z - position.z);
  return { position, yaw: Number.isFinite(yaw) ? yaw : 0 };
}

/**
 * Boss 特殊武器命中冷却（每个目标约 0.6 秒），checkHazard 本身不做冷却。
 */
export class HazardCooldownTracker {
  private readonly cooldowns = new Map<THREE.Object3D, number>();
  private readonly expired: THREE.Object3D[] = [];

  constructor(private readonly cooldownSeconds: number = 0.6) {}

  public update(deltaTime: number): void {
    if (this.cooldowns.size === 0) return;
    this.expired.length = 0;
    for (const [target, remaining] of this.cooldowns) {
      const next = remaining - deltaTime;
      if (next <= 0) this.expired.push(target);
      else this.cooldowns.set(target, next);
    }
    for (const target of this.expired) this.cooldowns.delete(target);
  }

  public isReady(target: THREE.Object3D): boolean {
    return !this.cooldowns.has(target);
  }

  public trigger(target: THREE.Object3D): void {
    this.cooldowns.set(target, this.cooldownSeconds);
  }

  public clear(): void {
    this.cooldowns.clear();
  }
}

/** 单个诱饵锚点：跟随一枚燃烧中的热焰弹（Boss 导弹以它为目标） */
interface DecoyAnchor {
  object: THREE.Object3D;
  /** 剩余存活时间（热焰弹燃尽后保留在最后位置一会儿，让被诱骗的导弹飞过去） */
  linger: number;
  active: boolean;
}

/**
 * 热焰弹诱骗 Boss 导弹：投放热焰弹后，正在追踪玩家且距离玩家较近的导弹按诱饵强度概率
 * 改为追踪诱饵锚点，飞抵后引爆。导弹类本身不需要改动（锚点是挂在场景里的空节点）。
 */
export class BossFlareDecoyRedirector {
  private static readonly POOL_SIZE = 6;
  private static readonly REDIRECT_RANGE = 420;
  private static readonly DETONATE_DISTANCE = 9;
  private readonly anchors: DecoyAnchor[] = [];
  private readonly redirected = new Set<object>();
  private previousDecoyCount = 0;

  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < BossFlareDecoyRedirector.POOL_SIZE; i++) {
      const object = new THREE.Object3D();
      object.name = 'boss-missile-decoy-anchor';
      this.anchors.push({ object, linger: 0, active: false });
    }
  }

  /**
   * decoys：当前燃烧中的热焰弹；playerPosition：玩家位置（只诱骗靠近玩家的导弹）
   */
  public update(
    deltaTime: number,
    decoys: readonly DecoyPoint[],
    missileSystem: BossMissileSystem | null,
    playerPosition: THREE.Vector3
  ): void {
    // 锚点跟随诱饵；诱饵燃尽后原地停留片刻再回收
    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i];
      const decoy = decoys[i];
      if (decoy) {
        if (!anchor.active) {
          anchor.active = true;
          this.scene.add(anchor.object);
        }
        anchor.object.position.copy(decoy.position);
        anchor.linger = 2.5;
      } else if (anchor.active) {
        anchor.linger -= deltaTime;
        if (anchor.linger <= 0) {
          anchor.active = false;
          anchor.object.removeFromParent();
        }
      }
    }

    const decoyCount = decoys.length;
    const newDeployment = decoyCount > this.previousDecoyCount;
    this.previousDecoyCount = decoyCount;
    if (!missileSystem) return;

    const missiles = missileSystem.getMissiles();
    for (const missile of missiles) {
      const position = missile.getMesh().position;
      // 已被诱骗的导弹：飞抵锚点后引爆
      if (this.redirected.has(missile)) {
        const target = missile.target;
        if (
          target &&
          target.position.distanceTo(position) < BossFlareDecoyRedirector.DETONATE_DISTANCE
        ) {
          missile.takeDamage(1e6);
        }
        continue;
      }
      if (!newDeployment || decoyCount === 0 || !missile.isTargetingPlayer) continue;
      if (position.distanceTo(playerPosition) > BossFlareDecoyRedirector.REDIRECT_RANGE) continue;
      // 按最强诱饵的强度决定是否被骗（新投放的热焰弹强度接近 1）
      let best = -1;
      let bestStrength = 0;
      for (let i = 0; i < decoyCount && i < this.anchors.length; i++) {
        const strength = decoys[i].strength;
        if (strength > bestStrength) {
          bestStrength = strength;
          best = i;
        }
      }
      if (best < 0 || Math.random() > 0.35 + 0.55 * bestStrength) continue;
      missile.isTargetingPlayer = false;
      missile.target = this.anchors[best].object;
      this.redirected.add(missile);
    }

    // 清理已失效导弹的记录
    if (this.redirected.size > 0) {
      for (const missile of this.redirected) {
        if (!missiles.includes(missile as (typeof missiles)[number]))
          this.redirected.delete(missile);
      }
    }
  }

  public clear(): void {
    for (const anchor of this.anchors) {
      anchor.active = false;
      anchor.linger = 0;
      anchor.object.removeFromParent();
    }
    this.redirected.clear();
    this.previousDecoyCount = 0;
  }
}

/** 神谕主宰阶段 → 城堡核心视觉状态（CitadelEnvironment.setCoreState） */
export type CitadelCoreVisualState = 'online' | 'exposed' | 'overload' | 'offline';

export function mapOracleStageToCoreState(
  stage: string,
  alive: boolean,
  dying: boolean
): CitadelCoreVisualState {
  if (!alive && !dying) return 'offline';
  if (dying) return 'offline';
  switch (stage) {
    case 'collapse':
    case 'arrays':
      return 'exposed';
    case 'overload-rise':
    case 'overload':
      return 'overload';
    default:
      return 'online';
  }
}
