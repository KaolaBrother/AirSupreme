import * as THREE from 'three';
import { ParticleType } from '../ParticleTypes';
import type { ParticleEmitter, SurfaceImpactType } from '../ParticleTypes';
import { SMOKE_CELLS, VfxCell } from '../VfxAtlas';

/**
 * 环境命中配方：按地表类型的地面命中、水面命中、大型水花。
 */

const scratchColor = new THREE.Color();
const scratchColorEnd = new THREE.Color();
const scratchVelocity = new THREE.Vector3();
const scratchPosition = new THREE.Vector3();

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

interface SurfaceLook {
  /** 尘土/粉末颜色 */
  dust: number;
  dustEnd: number;
  /** 碎块颜色 */
  chunk: number;
  /** 火花颜色（0 表示无火花） */
  spark: number;
  /** 地面环颜色与混合 */
  ring: number;
  ringAdditive: number;
  /** 焦痕（0 表示无） */
  scorch: number;
  dustAlpha: number;
  chunkCount: number;
  dustGravity: number;
}

const SURFACES: Record<SurfaceImpactType, SurfaceLook> = {
  ground: {
    dust: 0x6b5a45,
    dustEnd: 0x8c7d68,
    chunk: 0x4a3c2c,
    spark: 0xffb050,
    ring: 0x8c7a62,
    ringAdditive: 0,
    scorch: 0x1a1612,
    dustAlpha: 0.75,
    chunkCount: 5,
    dustGravity: 0.1,
  },
  desert: {
    dust: 0xc9a46a,
    dustEnd: 0xe0c896,
    chunk: 0xa8844e,
    spark: 0xffc068,
    ring: 0xd8bc88,
    ringAdditive: 0,
    scorch: 0x2a2016,
    dustAlpha: 0.7,
    chunkCount: 3,
    dustGravity: 0.06,
  },
  snow: {
    dust: 0xe6eef6,
    dustEnd: 0xf4f8fc,
    chunk: 0xcfdbe6,
    spark: 0,
    ring: 0xf0f6ff,
    ringAdditive: 0,
    scorch: 0x3a3e44,
    dustAlpha: 0.82,
    chunkCount: 4,
    dustGravity: 0.12,
  },
  city: {
    dust: 0x8a8a8e,
    dustEnd: 0xb0b0b4,
    chunk: 0x6a6a70,
    spark: 0xffd27a,
    ring: 0xa0a0a6,
    ringAdditive: 0,
    scorch: 0x141414,
    dustAlpha: 0.72,
    chunkCount: 6,
    dustGravity: 0.1,
  },
  lava: {
    dust: 0x3a2a24,
    dustEnd: 0x6a5a54,
    chunk: 0x1c1410,
    spark: 0xff7a24,
    ring: 0xff6a1e,
    ringAdditive: 1,
    scorch: 0,
    dustAlpha: 0.7,
    chunkCount: 3,
    dustGravity: -0.05,
  },
  ice: {
    dust: 0xd8f0ff,
    dustEnd: 0xf2fbff,
    chunk: 0xa8d8f0,
    spark: 0xbfeeff,
    ring: 0xc8ecff,
    ringAdditive: 1,
    scorch: 0x6a8496,
    dustAlpha: 0.66,
    chunkCount: 6,
    dustGravity: 0.14,
  },
  rock: {
    dust: 0x7a756e,
    dustEnd: 0x9c968e,
    chunk: 0x55504a,
    spark: 0xffc070,
    ring: 0x8a847c,
    ringAdditive: 0,
    scorch: 0x181614,
    dustAlpha: 0.74,
    chunkCount: 7,
    dustGravity: 0.12,
  },
  cloud: {
    dust: 0xf2f5f8,
    dustEnd: 0xffffff,
    chunk: 0,
    spark: 0,
    ring: 0xf8fbff,
    ringAdditive: 0,
    scorch: 0,
    dustAlpha: 0.6,
    chunkCount: 0,
    dustGravity: -0.02,
  },
};

/**
 * 地面命中：闪光 + 尘土羽流 + 碎块/火花 + 地面扩散环 + 焦痕（按地表）
 */
export function emitGroundImpact(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  intensity: number,
  surface: SurfaceImpactType
): void {
  const k = THREE.MathUtils.clamp(intensity, 0.5, 2.2);
  const look = SURFACES[surface] ?? SURFACES.ground;

  // 命中闪光（云层命中为柔和的白闪）
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.08,
    size: 1.6 * k,
    color: scratchColor.set(
      surface === 'cloud' ? 0xffffff : surface === 'ice' ? 0xd8f4ff : 0xffd9a0
    ),
    intensity: surface === 'cloud' ? 2 : 3.5,
  });

  // 尘土羽流：向上锥形喷出后扩散
  const dustCount = fx.count(5 + 3 * k, 3);
  for (let i = 0; i < dustCount; i++) {
    scratchVelocity.set(rand(-1, 1) * 3.5, rand(4, 10) * (0.7 + 0.3 * k), rand(-1, 1) * 3.5);
    fx.emit(ParticleType.DUST, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(1.1, 2) * (surface === 'cloud' ? 1.4 : 1),
      size: rand(1.2, 2) * k,
      sizeEnd: rand(2.6, 3.4),
      color: scratchColor.set(look.dust),
      colorEnd: scratchColorEnd.set(look.dustEnd),
      alpha: look.dustAlpha,
      gravityScale: look.dustGravity,
      drag: 1.7,
    });
  }

  // 碎块
  if (look.chunkCount > 0) {
    const chunks = fx.count(look.chunkCount * k, 1);
    for (let i = 0; i < chunks; i++) {
      scratchVelocity.set(rand(-1, 1) * 7, rand(6, 14), rand(-1, 1) * 7);
      fx.debris(
        position,
        scratchVelocity,
        rand(0.18, 0.42) * k,
        scratchColor.set(look.chunk),
        rand(0.9, 1.6)
      );
    }
  }

  // 火花（城市/岩石/冰面金属感迸溅）
  if (look.spark !== 0) {
    const sparks = fx.count(4 + 3 * k, 2);
    for (let i = 0; i < sparks; i++) {
      scratchVelocity.set(rand(-1, 1) * 18, rand(6, 22), rand(-1, 1) * 18);
      fx.emit(ParticleType.SPARK, position, {
        speed: 0,
        velocity: scratchVelocity,
        life: rand(0.25, 0.55),
        size: 0.22,
        color: scratchColor.set(look.spark),
        intensity: 3,
        gravityScale: 0.9,
        stretch: 0.04,
      });
    }
  }

  // 地表专属层
  if (surface === 'lava') {
    // 熔岩溅射：发光熔滴 + 蒸汽
    const blobs = fx.count(6 + 4 * k, 3);
    for (let i = 0; i < blobs; i++) {
      scratchVelocity.set(rand(-1, 1) * 8, rand(8, 18), rand(-1, 1) * 8);
      fx.emit(ParticleType.EMBER, position, {
        speed: 0,
        velocity: scratchVelocity,
        life: rand(0.8, 1.5),
        size: rand(0.5, 0.9) * k,
        color: scratchColor.set(0xff6a18),
        colorEnd: scratchColorEnd.set(0x3a0a00),
        intensity: 4.2,
        gravityScale: 1.2,
      });
    }
    fx.emit(ParticleType.GLOW, position, {
      speed: 0,
      life: 0.6,
      size: 5 * k,
      sizeEnd: 1.4,
      color: scratchColor.set(0xff5a14),
      intensity: 2.6,
    });
  } else if (surface === 'ice') {
    // 冰晶碎片闪烁
    const shards = fx.count(6 + 3 * k, 3);
    for (let i = 0; i < shards; i++) {
      scratchVelocity.set(rand(-1, 1) * 10, rand(6, 16), rand(-1, 1) * 10);
      fx.emit(ParticleType.GLOW, position, {
        speed: 0,
        velocity: scratchVelocity,
        life: rand(0.5, 0.9),
        size: rand(0.35, 0.6),
        color: scratchColor.set(0xe0f6ff),
        cell: VfxCell.STAR,
        intensity: 2.4,
        gravityScale: 0.8,
        drag: 0.6,
      });
    }
  } else if (surface === 'cloud') {
    // 云层被击穿：撕开的水汽卷须
    const wisps = fx.count(4 * k, 2);
    for (let i = 0; i < wisps; i++) {
      scratchVelocity.set(rand(-1, 1) * 6, rand(-1, 1) * 3, rand(-1, 1) * 6);
      fx.emit(ParticleType.SMOKE, position, {
        speed: 0,
        velocity: scratchVelocity,
        life: rand(1.6, 2.6),
        size: rand(2.4, 3.6) * k,
        sizeEnd: 2.2,
        color: scratchColor.setRGB(0.92, 0.94, 0.97),
        colorEnd: scratchColorEnd.setRGB(1, 1, 1),
        alpha: 0.45,
        gravityScale: 0,
        drag: 1.2,
      });
    }
  }

  // 地面扩散环（水平）
  scratchPosition.copy(position);
  scratchPosition.y += 0.3;
  fx.emit(ParticleType.RING, scratchPosition, {
    speed: 0,
    life: 0.55,
    size: 1.8 * k,
    sizeEnd: 6,
    color: scratchColor.set(look.ring),
    alpha: look.ringAdditive > 0 ? 0.65 : 0.5,
    additive: look.ringAdditive,
    intensity: look.ringAdditive > 0 ? 1.6 : 1,
    planar: true,
  });

  // 焦痕贴花（长寿命，随后淡出）
  if (look.scorch !== 0) {
    scratchPosition.y = position.y + 0.15;
    fx.emit(ParticleType.SCORCH, scratchPosition, {
      speed: 0,
      life: rand(5, 7),
      size: rand(2.6, 3.4) * k,
      color: scratchColor.set(look.scorch),
      alpha: 0.6,
      planar: true,
    });
  }
}

/**
 * 小型水面命中：水柱 + 水雾 + 泡沫环
 */
export function emitWaterImpact(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  intensity: number
): void {
  const k = THREE.MathUtils.clamp(intensity, 0.6, 2);

  const columnCount = fx.count(6 + 3 * k, 3);
  for (let i = 0; i < columnCount; i++) {
    scratchVelocity.set(rand(-1, 1) * 2.2, rand(9, 17) * (0.75 + 0.25 * k), rand(-1, 1) * 2.2);
    fx.emit(ParticleType.SPRAY, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.8, 1.3),
      size: rand(0.9, 1.5) * k,
      sizeEnd: 2.2,
      color: scratchColor.setRGB(0.82, 0.9, 0.95),
      alpha: 0.75,
      gravityScale: 1.05,
      drag: 0.4,
      cell: i % 2 === 0 ? VfxCell.SPRAY : SMOKE_CELLS[i % SMOKE_CELLS.length],
    });
  }

  const dropletCount = fx.count(6 + 4 * k, 3);
  for (let i = 0; i < dropletCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    scratchVelocity.set(Math.cos(angle) * rand(4, 9), rand(5, 11), Math.sin(angle) * rand(4, 9));
    fx.emit(ParticleType.SPARK, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.5, 0.9),
      size: 0.24,
      color: scratchColor.setRGB(0.85, 0.93, 1),
      intensity: 1.4,
      gravityScale: 1.1,
      stretch: 0.03,
    });
  }

  const mistCount = fx.count(2 + 2 * k, 2);
  for (let i = 0; i < mistCount; i++) {
    scratchVelocity.set(rand(-1, 1) * 1.5, rand(1.5, 3.5), rand(-1, 1) * 1.5);
    fx.emit(ParticleType.SMOKE, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(1.2, 1.8),
      size: rand(1.4, 2.2) * k,
      sizeEnd: 2.4,
      color: scratchColor.setRGB(0.88, 0.92, 0.95),
      colorEnd: scratchColorEnd.setRGB(0.95, 0.97, 1),
      alpha: 0.42,
      gravityScale: 0,
    });
  }

  scratchPosition.copy(position);
  scratchPosition.y += 0.12;
  fx.emit(ParticleType.RING, scratchPosition, {
    speed: 0,
    life: 1.1,
    size: 1.4 * k,
    sizeEnd: 5.5,
    color: scratchColor.setRGB(0.9, 0.96, 1),
    alpha: 0.6,
    additive: 0,
    planar: true,
  });
}

/**
 * 大型水花（舰船爆炸/潜艇上浮/坠海）：高水柱 + 王冠飞沫 + 雾团 + 双泡沫环 + 残留泡沫
 */
export function emitSplash(fx: ParticleEmitter, position: THREE.Vector3, scale: number = 1): void {
  const s = THREE.MathUtils.clamp(Number.isFinite(scale) ? scale : 1, 0.4, 4);
  const root = Math.sqrt(s);

  // 主水柱：柔和水体（烟团格）+ 少量飞沫簇
  const columnCount = fx.count(12 * s, 5);
  for (let i = 0; i < columnCount; i++) {
    scratchVelocity.set(rand(-1, 1) * 3 * root, rand(16, 32) * root, rand(-1, 1) * 3 * root);
    const sprayCell = i % 3 === 0;
    fx.emit(ParticleType.SPRAY, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(1.4, 2.2) * (0.8 + 0.2 * root),
      size: (sprayCell ? rand(2.4, 3.4) : rand(2.8, 4.2)) * s,
      sizeEnd: 2.3,
      color: scratchColor.setRGB(0.86, 0.92, 0.96),
      alpha: sprayCell ? 0.75 : 0.62,
      gravityScale: 1,
      drag: 0.3,
      cell: sprayCell ? VfxCell.SPRAY : SMOKE_CELLS[i % SMOKE_CELLS.length],
    });
  }

  // 王冠飞沫：环形外抛的水线
  const crown = fx.count(18 * root, 8);
  for (let i = 0; i < crown; i++) {
    const angle = (i / crown) * Math.PI * 2 + Math.random() * 0.2;
    scratchVelocity
      .set(Math.cos(angle) * rand(8, 14), rand(10, 18), Math.sin(angle) * rand(8, 14))
      .multiplyScalar(root);
    fx.emit(ParticleType.SPARK, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.9, 1.4),
      size: 0.7 * root,
      color: scratchColor.setRGB(0.88, 0.95, 1),
      intensity: 1,
      alpha: 0.7,
      gravityScale: 1,
      stretch: 0.06,
      additive: 0,
      cell: VfxCell.GLOW,
    });
  }

  // 雾团
  const mist = fx.count(6 * s, 3);
  for (let i = 0; i < mist; i++) {
    scratchPosition.copy(position);
    scratchPosition.y += rand(1, 6) * root;
    scratchVelocity.set(rand(-1, 1) * 3, rand(1, 4), rand(-1, 1) * 3);
    fx.emit(ParticleType.SMOKE, scratchPosition, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(2, 3.2),
      size: rand(3, 5) * s,
      sizeEnd: 2.4,
      color: scratchColor.setRGB(0.86, 0.9, 0.94),
      colorEnd: scratchColorEnd.setRGB(0.95, 0.97, 1),
      alpha: 0.5,
      gravityScale: 0.02,
      drag: 0.9,
    });
  }

  // 泡沫环 ×2 + 残留泡沫
  scratchPosition.copy(position);
  scratchPosition.y += 0.15;
  fx.emit(ParticleType.RING, scratchPosition, {
    speed: 0,
    life: 1.6,
    size: 3 * s,
    sizeEnd: 6,
    color: scratchColor.setRGB(0.92, 0.97, 1),
    alpha: 0.7,
    additive: 0,
    planar: true,
  });
  const origin = position.clone();
  fx.schedule(0.35, () => {
    scratchPosition.copy(origin);
    scratchPosition.y += 0.12;
    fx.emit(ParticleType.RING, scratchPosition, {
      speed: 0,
      life: 2,
      size: 4 * s,
      sizeEnd: 6.5,
      color: scratchColor.setRGB(0.9, 0.95, 1),
      alpha: 0.5,
      additive: 0,
      planar: true,
      cell: VfxCell.THIN_RING,
    });
  });
  fx.emit(ParticleType.SCORCH, scratchPosition, {
    speed: 0,
    life: 4,
    size: 6 * s,
    sizeEnd: 1.4,
    color: scratchColor.setRGB(0.92, 0.96, 1),
    alpha: 0.45,
    planar: true,
  });
}
