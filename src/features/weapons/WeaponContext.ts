import * as THREE from 'three';
import type { DamageSource, SpecialWeaponId } from '@/core/CombatContracts';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { WeaponFx } from './WeaponFx';
import type { TargetSnapshotBuffer } from './WeaponTargeting';

/**
 * 武器控制器的共享契约：WeaponSystem 提供上下文（特效、目标快照、事件出口），
 * 各控制器只关心“开火之后发生什么”。另含地表射线等通用工具。
 */

/** 地表采样（与 TerrainGenerator.sampleSurface 同签名） */
export type SurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

/** 控制器与 WeaponSystem 之间的共享上下文 */
export interface WeaponContext {
  readonly fx: WeaponFx | null;
  readonly particleSystem: ParticleSystem | null;
  readonly surfaceSampler: SurfaceSampler | null;
  getSnapshot(): TargetSnapshotBuffer;
  emitFired(id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3): void;
  emitImpact(id: SpecialWeaponId, position: THREE.Vector3, scale: number): void;
  emitEmpPulse(center: THREE.Vector3, radius: number, stunSeconds: number): void;
  emitOverheat(): void;
  emitBeamEnd(id: SpecialWeaponId): void;
  emitChargeStart(): void;
  emitDryFire(id: SpecialWeaponId): void;
  attachFx(): void;
}

/** 本帧的发射基准 */
export interface FireFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** 机头方向（单位向量，本地 -Z） */
  forward: THREE.Vector3;
  /** 载机速度估计（米/秒） */
  carry: THREE.Vector3;
  /** 枪口坐标与朝向是否有效（NaN / Infinity 时不开火） */
  valid: boolean;
}

export function createFireFrame(): FireFrame {
  return {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    forward: new THREE.Vector3(0, 0, -1),
    carry: new THREE.Vector3(),
    valid: false,
  };
}

// -----------------------------------------------------------------------------
// 地表射线
// -----------------------------------------------------------------------------

export interface SurfaceHit {
  t: number;
  water: boolean;
}

/**
 * 沿射线步进 + 二分，找到第一次低于地表的位置。起点已在地下时不裁剪。
 * 返回是否命中，命中距离写入 out.t。
 */
export function raycastSurface(
  sampler: SurfaceSampler | null,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDistance: number,
  out: SurfaceHit
): boolean {
  out.t = maxDistance;
  out.water = false;
  if (!sampler || !(maxDistance > 0)) return false;
  const start = safeSample(sampler, origin.x, origin.z);
  if (!start || origin.y <= start.y) return false;

  const steps = Math.max(8, Math.min(36, Math.ceil(maxDistance / 16)));
  let previousT = 0;
  for (let i = 1; i <= steps; i++) {
    const t = (maxDistance * i) / steps;
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    const sample = safeSample(sampler, x, z);
    if (sample && y <= sample.y) {
      let lo = previousT;
      let hi = t;
      let water = sample.water;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) * 0.5;
        const s = safeSample(sampler, origin.x + dir.x * mid, origin.z + dir.z * mid);
        if (s && origin.y + dir.y * mid <= s.y) {
          hi = mid;
          water = s.water;
        } else {
          lo = mid;
        }
      }
      out.t = hi;
      out.water = water;
      return true;
    }
    previousT = t;
  }
  return false;
}

export function safeSample(
  sampler: SurfaceSampler,
  x: number,
  z: number
): { y: number; water: boolean } | null {
  try {
    const sample = sampler(x, z);
    return sample && Number.isFinite(sample.y) ? sample : null;
  } catch {
    return null;
  }
}

/** 特殊武器 → 伤害来源（命中反馈、音效分流与击杀归属） */
export const WEAPON_DAMAGE_SOURCE: Record<SpecialWeaponId, DamageSource> = {
  rockets: 'rocket',
  laser: 'laser',
  swarm: 'swarm',
  railgun: 'railgun',
  emp: 'emp',
};
