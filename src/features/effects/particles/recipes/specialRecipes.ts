import * as THREE from 'three';
import { ParticleType } from '../ParticleTypes';
import type { ParticleEmitter } from '../ParticleTypes';
import { VfxCell } from '../VfxAtlas';

/**
 * 特殊效果配方：传送、激光、触手爆炸、拾取、EMP。
 */

const scratchColor = new THREE.Color();
const scratchColorEnd = new THREE.Color();
const scratchVelocity = new THREE.Vector3();
const scratchPosition = new THREE.Vector3();

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomDirection(out: THREE.Vector3): THREE.Vector3 {
  out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
  return out.normalize();
}

const TELEPORT_BLUE = 0x2fb8ff;

export function emitTeleportOut(fx: ParticleEmitter, position: THREE.Vector3): void {
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.22,
    size: 7,
    color: scratchColor.set(0xbfe9ff),
    intensity: 4.5,
  });
  fx.emit(ParticleType.RING, position, {
    speed: 0,
    life: 0.5,
    size: 4,
    sizeEnd: 6,
    color: scratchColor.set(TELEPORT_BLUE),
    cell: VfxCell.THIN_RING,
    intensity: 2.4,
    alpha: 0.9,
  });
  const count = fx.count(36, 12);
  for (let i = 0; i < count; i++) {
    fx.emit(ParticleType.SPARK, position, {
      speed: rand(28, 52),
      life: rand(0.35, 0.7),
      size: rand(0.3, 0.5),
      color: scratchColor.set(TELEPORT_BLUE),
      intensity: 3.2,
      gravityScale: 0,
      drag: 2,
    });
  }
  const motes = fx.count(10, 4);
  for (let i = 0; i < motes; i++) {
    fx.emit(ParticleType.GLOW, position, {
      speed: rand(4, 12),
      life: rand(0.5, 0.9),
      size: rand(0.8, 1.4),
      sizeEnd: 0.3,
      color: scratchColor.set(0x8fd8ff),
      intensity: 2.6,
      cell: VfxCell.STAR,
    });
  }
}

export function emitTeleportIn(fx: ParticleEmitter, position: THREE.Vector3): void {
  const count = fx.count(36, 12);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = rand(9, 14);
    scratchPosition
      .set(Math.cos(angle) * radius, rand(-3, 3), Math.sin(angle) * radius)
      .add(position);
    // 向心汇聚：速度指向中心
    scratchVelocity
      .copy(position)
      .sub(scratchPosition)
      .multiplyScalar(1 / 0.45);
    fx.emit(ParticleType.SPARK, scratchPosition, {
      speed: 0,
      velocity: scratchVelocity,
      life: 0.45,
      size: rand(0.3, 0.45),
      color: scratchColor.set(TELEPORT_BLUE),
      intensity: 3,
      gravityScale: 0,
      drag: 0,
    });
  }
  const origin = position.clone();
  fx.schedule(0.4, () => {
    fx.emit(ParticleType.EXPLOSION, origin, {
      speed: 0,
      life: 0.25,
      size: 8,
      color: scratchColor.set(0xd0f0ff),
      intensity: 5,
    });
    fx.emit(ParticleType.RING, origin, {
      speed: 0,
      life: 0.55,
      size: 3,
      sizeEnd: 7,
      color: scratchColor.set(TELEPORT_BLUE),
      cell: VfxCell.THIN_RING,
      intensity: 2.6,
    });
  });
}

export function emitLaserBeam(
  fx: ParticleEmitter,
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number
): void {
  const count = fx.count(14, 6);
  for (let i = 0; i < count; i++) {
    const t = (i + Math.random()) / count;
    scratchPosition.copy(start).lerp(end, t);
    fx.emit(ParticleType.GLOW, scratchPosition, {
      speed: rand(0.5, 2.5),
      life: rand(0.2, 0.4),
      size: rand(0.6, 1.1),
      sizeEnd: 0.4,
      color: scratchColor.set(color),
      intensity: 3,
    });
  }
  const sparks = fx.count(6, 3);
  for (let i = 0; i < sparks; i++) {
    fx.emit(ParticleType.SPARK, end, {
      speed: rand(14, 30),
      life: rand(0.2, 0.4),
      size: 0.24,
      color: scratchColor.set(color),
      intensity: 3.4,
      gravityScale: 0.4,
    });
  }
  fx.emit(ParticleType.GLOW, end, {
    speed: 0,
    life: 0.12,
    size: 2.4,
    color: scratchColor.set(color),
    cell: VfxCell.FLARE,
    intensity: 3.5,
  });
}

/** 触手爆裂：墨色水雾 + 水花 + 紫色闪光 */
export function emitTentacleExplosion(fx: ParticleEmitter, position: THREE.Vector3): void {
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.18,
    size: 6,
    color: scratchColor.set(0xffc9f0),
    intensity: 4.2,
  });
  const fires = fx.count(8, 3);
  for (let i = 0; i < fires; i++) {
    fx.emit(ParticleType.FIRE, position, {
      speed: rand(6, 12),
      life: rand(0.5, 0.8),
      size: rand(2, 3),
      color: scratchColor.setHSL(0.86 + Math.random() * 0.06, 0.85, 0.52),
      colorEnd: scratchColorEnd.setRGB(0.08, 0.04, 0.1),
      intensity: 2.6,
      drag: 2.2,
    });
  }
  const ink = fx.count(8, 3);
  for (let i = 0; i < ink; i++) {
    randomDirection(scratchVelocity).multiplyScalar(rand(4, 10));
    fx.emit(ParticleType.SMOKE, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(2, 3),
      size: rand(2.6, 4),
      sizeEnd: 2.4,
      color: scratchColor.setRGB(0.1, 0.05, 0.14),
      colorEnd: scratchColorEnd.setRGB(0.3, 0.26, 0.34),
      alpha: 0.75,
      drag: 1.6,
    });
  }
  const spray = fx.count(10, 4);
  for (let i = 0; i < spray; i++) {
    scratchVelocity.set(rand(-1, 1) * 8, rand(8, 18), rand(-1, 1) * 8);
    fx.emit(ParticleType.SPRAY, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.9, 1.4),
      size: rand(1.4, 2.2),
      color: scratchColor.setRGB(0.8, 0.88, 0.94),
      gravityScale: 1,
    });
  }
  const sparks = fx.count(12, 4);
  for (let i = 0; i < sparks; i++) {
    fx.emit(ParticleType.SPARK, position, {
      speed: rand(30, 60),
      life: rand(0.3, 0.6),
      size: 0.3,
      color: scratchColor.set(0xff8ad8),
      intensity: 3,
      gravityScale: 0.6,
    });
  }
}

/** 拾取爆闪：星闪 + 细环 + 上升光点 */
export function emitPickupBurst(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  color: number = 0xffd54a
): void {
  const tint = Number.isFinite(color) ? color : 0xffd54a;
  fx.emit(ParticleType.GLOW, position, {
    speed: 0,
    life: 0.35,
    size: 5,
    sizeEnd: 1.6,
    color: scratchColor.set(tint),
    cell: VfxCell.STAR,
    intensity: 4,
    rotation: 0,
  });
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.16,
    size: 3.2,
    color: scratchColor.set(0xffffff),
    intensity: 3,
  });
  fx.emit(ParticleType.RING, position, {
    speed: 0,
    life: 0.5,
    size: 2,
    sizeEnd: 5,
    color: scratchColor.set(tint),
    cell: VfxCell.THIN_RING,
    alpha: 0.9,
    intensity: 2.6,
  });
  const motes = fx.count(14, 6);
  for (let i = 0; i < motes; i++) {
    const angle = (i / motes) * Math.PI * 2;
    scratchVelocity.set(Math.cos(angle) * rand(3, 7), rand(4, 10), Math.sin(angle) * rand(3, 7));
    fx.emit(ParticleType.GLOW, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.6, 1),
      size: rand(0.5, 0.9),
      sizeEnd: 0.3,
      color: scratchColor.set(tint),
      cell: i % 2 === 0 ? VfxCell.STAR : VfxCell.GLOW,
      intensity: 3,
      drag: 1.5,
    });
  }
}

const EMP_CYAN = 0x6ae4ff;

/**
 * EMP：青白闪光 → 扩散电环（面向相机 + 水平）→ 前沿电弧分三波闪烁 → 静电火花
 */
export function emitEmpBurst(fx: ParticleEmitter, center: THREE.Vector3, radius: number): void {
  const r = THREE.MathUtils.clamp(Number.isFinite(radius) ? radius : 60, 4, 600);
  const origin = center.clone();

  fx.emit(ParticleType.EXPLOSION, origin, {
    speed: 0,
    life: 0.22,
    size: 9,
    sizeEnd: 0.8,
    color: scratchColor.set(0xd8f8ff),
    intensity: 3.2,
  });
  fx.emit(ParticleType.GLOW, origin, {
    speed: 0,
    life: 0.18,
    size: 16,
    sizeEnd: 1.4,
    color: scratchColor.set(EMP_CYAN),
    cell: VfxCell.FLARE,
    intensity: 1.8,
  });

  // 扩散电环：环在格内 0.8 半径处 → 末尺寸使可见半径 ≈ r
  const ringEnd = (r * 2) / 0.8;
  fx.emit(ParticleType.RING, origin, {
    speed: 0,
    life: 0.55,
    size: ringEnd * 0.06,
    sizeEnd: 1 / 0.06,
    color: scratchColor.set(EMP_CYAN),
    cell: VfxCell.THIN_RING,
    alpha: 0.95,
    intensity: 1.7,
    rotation: 0,
  });
  fx.emit(ParticleType.RING, origin, {
    speed: 0,
    life: 0.7,
    size: ringEnd * 0.05,
    sizeEnd: 1 / 0.05,
    color: scratchColor.set(0x3fa8ff),
    cell: VfxCell.THIN_RING,
    alpha: 0.7,
    intensity: 1.3,
    planar: true,
    rotation: 0,
  });
  fx.emit(ParticleType.RING, origin, {
    speed: 0,
    life: 0.4,
    size: ringEnd * 0.04,
    sizeEnd: 0.6 / 0.04,
    color: scratchColor.set(0xbff4ff),
    alpha: 0.4,
    intensity: 1.1,
    rotation: 0,
  });

  // 电弧：随电环前沿分三波出现
  const waves = [
    { delay: 0.04, fraction: 0.3 },
    { delay: 0.16, fraction: 0.62 },
    { delay: 0.3, fraction: 0.92 },
  ];
  for (const wave of waves) {
    fx.schedule(wave.delay, () => {
      const arcs = fx.count(7, 3);
      const front = r * wave.fraction;
      for (let i = 0; i < arcs; i++) {
        randomDirection(scratchPosition)
          .multiplyScalar(front * rand(0.85, 1.05))
          .add(origin);
        fx.emit(ParticleType.ELECTRIC, scratchPosition, {
          speed: 0,
          life: rand(0.12, 0.26),
          size: rand(0.14, 0.24) * r,
          sizeEnd: 1.15,
          color: scratchColor.set(EMP_CYAN),
          intensity: 2,
        });
      }
      const sparks = fx.count(8, 3);
      for (let i = 0; i < sparks; i++) {
        randomDirection(scratchPosition).multiplyScalar(front).add(origin);
        fx.emit(ParticleType.SPARK, scratchPosition, {
          speed: rand(10, 24),
          life: rand(0.2, 0.4),
          size: 0.35,
          color: scratchColor.set(0xbff4ff),
          intensity: 3.2,
          gravityScale: 0.1,
        });
      }
    });
  }

  // 中心残留电浆
  const plasma = fx.count(4, 2);
  for (let i = 0; i < plasma; i++) {
    fx.emit(ParticleType.ELECTRIC, origin, {
      speed: 0,
      life: rand(0.3, 0.5),
      size: rand(4, 7),
      sizeEnd: 1.3,
      color: scratchColor.set(0x9feeff),
      intensity: 1.5,
    });
  }
}
