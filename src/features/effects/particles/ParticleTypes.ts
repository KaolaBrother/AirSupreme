import * as THREE from 'three';

/**
 * 粒子类型（决定贴图、混合方式、尺寸/透明度/颜色曲线与默认重力）
 */
export enum ParticleType {
  /** 白热闪光核心 */
  EXPLOSION = 'EXPLOSION',
  /** 浮升烟团（普通混合） */
  SMOKE = 'SMOKE',
  /** 曳光火花（沿速度拉伸） */
  SPARK = 'SPARK',
  /** 火球（加色 → 末段转为煤烟） */
  FIRE = 'FIRE',
  /** 实心碎片（InstancedMesh） */
  DEBRIS = 'DEBRIS',
  /** 炽热余烬（受重力，可拖烟） */
  EMBER = 'EMBER',
  /** 地表尘土/沙/雪粉（普通混合） */
  DUST = 'DUST',
  /** 水花飞沫（普通混合，受重力） */
  SPRAY = 'SPRAY',
  /** 扩散环（冲击波/水沫环/EMP 前沿） */
  RING = 'RING',
  /** 电弧（闪烁） */
  ELECTRIC = 'ELECTRIC',
  /** 柔光/星闪（加色，无白热过渡） */
  GLOW = 'GLOW',
  /** 地面焦痕（水平贴花，普通混合，长寿命） */
  SCORCH = 'SCORCH',
}

export type SurfaceImpactType =
  | 'ground'
  | 'desert'
  | 'snow'
  | 'city'
  | 'lava'
  | 'ice'
  | 'rock'
  | 'cloud';
export type HitEffectProfile = 'player' | 'enemy' | 'boss';
export type HeavyWeaponImpactProfile = 'boss-cannon' | 'laser' | 'flak-hit' | 'boss-armor';

/**
 * 粒子生成参数。前 7 个字段保持旧接口语义；其余为可选扩展。
 */
export interface SpawnOptions {
  /** 随机方向初速（m/s） */
  speed: number;
  life: number;
  /** 世界尺寸（米） */
  size: number;
  color: THREE.Color;
  /** 旧语义：强重力（碎片/余烬下坠） */
  gravity?: boolean;
  spin?: number;
  smokeTrail?: boolean;
  /** 额外的定向速度（与随机速度叠加） */
  velocity?: THREE.Vector3;
  /** 末尺寸倍率（相对 size） */
  sizeEnd?: number;
  /** 末颜色（覆盖类型默认渐变） */
  colorEnd?: THREE.Color;
  /** HDR 亮度倍率（加色粒子 >1 触发泛光） */
  intensity?: number;
  /** 基础不透明度 */
  alpha?: number;
  /** 覆盖默认重力系数（负值上浮） */
  gravityScale?: number;
  /** 速度阻尼（每秒） */
  drag?: number;
  /** 覆盖图集格 */
  cell?: number;
  /** 拉伸系数（秒）：>0 时沿速度/axis 拉伸 */
  stretch?: number;
  /** 固定拉伸轴（世界向量）；未给出时沿速度 */
  axis?: THREE.Vector3;
  /** 水平贴地四边形 */
  planar?: boolean;
  /** 初始旋转（弧度），默认随机 */
  rotation?: number;
  /** 覆盖混合：0 普通，1 加色 */
  additive?: number;
}

/**
 * 配方模块使用的发射器接口（由 ParticleSystem 实现）
 */
export interface ParticleEmitter {
  /** LOD 细节系数（质量预设 × 负载） */
  readonly detail: number;
  emit(type: ParticleType, position: THREE.Vector3, options: SpawnOptions): boolean;
  /** 按细节缩放后的数量（至少 min） */
  count(base: number, min?: number): number;
  schedule(delaySeconds: number, emit: () => void): void;
  /** 实心碎片 */
  debris(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    size: number,
    color: THREE.Color,
    life: number,
    smokeTrail?: boolean
  ): void;
  /** 水平扩散冲击环 */
  shockwave(
    position: THREE.Vector3,
    radius: number,
    life: number,
    color: number,
    opacity?: number
  ): void;
}

/** 质量预设 → 粒子预算基数与细节系数 */
export function computeParticleBudget(particleCount: number): number {
  const base = Number.isFinite(particleCount) ? particleCount : 50;
  return Math.round(THREE.MathUtils.clamp(base * 40, 384, 4096));
}

export function computeDetailForPreset(preset: string, isMobile: boolean): number {
  const base = preset === 'quality' ? 1 : preset === 'balanced' ? 0.85 : 0.6;
  return isMobile ? base * 0.8 : base;
}

/** 粒子池容量上限（GPU 缓冲按此分配） */
export const PARTICLE_HARD_CAP = 4096;
