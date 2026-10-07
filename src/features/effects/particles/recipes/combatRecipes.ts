import * as THREE from 'three';
import { ParticleType } from '../ParticleTypes';
import type { HeavyWeaponImpactProfile, HitEffectProfile, ParticleEmitter } from '../ParticleTypes';
import { VfxCell } from '../VfxAtlas';

/**
 * 战斗类效果配方：爆炸 / 命中 / 导弹 / 高射炮 / 重武器 / Boss 死亡。
 * 事件驱动（非逐帧），允许少量闭包与位置拷贝；逐粒子颜色使用模块级暂存对象。
 */

const scratchColor = new THREE.Color();
const scratchColorEnd = new THREE.Color();
const scratchVelocity = new THREE.Vector3();
const scratchPosition = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 单位球内均匀随机方向（写入 out） */
function randomDirection(out: THREE.Vector3): THREE.Vector3 {
  out.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
  return out.normalize();
}

export interface ExplosionPalette {
  flash: number;
  fireHue: number;
  fireHueJitter: number;
  fireLightness: number;
  sparkColor: number;
  emberColor: number;
  smokeLightness: number;
  ringColor: number;
}

const PALETTES: Record<
  'enemy' | 'player' | 'friendly' | 'boss' | 'laser' | 'flak',
  ExplosionPalette
> = {
  enemy: {
    flash: 0xffd9a8,
    fireHue: 0.055,
    fireHueJitter: 0.04,
    fireLightness: 0.5,
    sparkColor: 0xffc45a,
    emberColor: 0xff8a2e,
    smokeLightness: 0.13,
    ringColor: 0xff9a52,
  },
  player: {
    flash: 0xffe2c0,
    fireHue: 0.035,
    fireHueJitter: 0.035,
    fireLightness: 0.48,
    sparkColor: 0xffb070,
    emberColor: 0xff6a2a,
    smokeLightness: 0.1,
    ringColor: 0xffb866,
  },
  friendly: {
    flash: 0xd8fbff,
    fireHue: 0.075,
    fireHueJitter: 0.03,
    fireLightness: 0.55,
    sparkColor: 0xa8fff3,
    emberColor: 0xffb24a,
    smokeLightness: 0.2,
    ringColor: 0x7ee9ff,
  },
  boss: {
    flash: 0xfff1d8,
    fireHue: 0.035,
    fireHueJitter: 0.04,
    fireLightness: 0.47,
    sparkColor: 0xffb24d,
    emberColor: 0xff6a24,
    smokeLightness: 0.09,
    ringColor: 0xff7b4f,
  },
  laser: {
    flash: 0xd9fbff,
    fireHue: 0.55,
    fireHueJitter: 0.03,
    fireLightness: 0.6,
    sparkColor: 0x8ff0ff,
    emberColor: 0x66dfff,
    smokeLightness: 0.2,
    ringColor: 0x66dfff,
  },
  flak: {
    flash: 0xffcfa0,
    fireHue: 0.025,
    fireHueJitter: 0.02,
    fireLightness: 0.46,
    sparkColor: 0xff9a5a,
    emberColor: 0xff5f42,
    smokeLightness: 0.08,
    ringColor: 0xff5f42,
  },
};

/**
 * 分层爆炸核心：白热闪光 → 膨胀火球 → 浓烟柱 → 火花/余烬/碎片 → 冲击环
 */
export function emitLayeredExplosion(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number,
  palette: ExplosionPalette,
  options: {
    smokeScale?: number;
    debrisScale?: number;
    airRing?: boolean;
    groundRing?: boolean;
  } = {}
): void {
  const s = THREE.MathUtils.clamp(scale, 0.35, 4);
  const root = Math.sqrt(s);
  const smokeScale = options.smokeScale ?? 1;
  const debrisScale = options.debrisScale ?? 1;

  // 1) 白热闪光核心 + 星芒
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.13 + 0.04 * s,
    size: 4.4 * s,
    sizeEnd: 0.7,
    color: scratchColor.set(palette.flash),
    intensity: 6,
  });
  fx.emit(ParticleType.GLOW, position, {
    speed: 0,
    life: 0.09 + 0.02 * s,
    size: 8 * s,
    sizeEnd: 1.35,
    color: scratchColor.set(palette.flash),
    cell: VfxCell.FLARE,
    intensity: 3.2,
  });

  // 2) 空中冲击环（面向相机）+ 水平冲击波
  if (options.airRing !== false) {
    fx.emit(ParticleType.RING, position, {
      speed: 0,
      life: 0.3 + 0.06 * s,
      size: 2.6 * s,
      sizeEnd: 7,
      color: scratchColor.set(palette.ringColor),
      alpha: 0.55,
      intensity: 1.5,
      rotation: 0,
    });
  }
  if (options.groundRing !== false) {
    fx.shockwave(position, 6 + s * 6, 0.45 + s * 0.12, palette.ringColor, 0.5);
  }

  // 3) 膨胀火球：强阻尼的外喷火团，末段冷却成煤烟
  const fireCount = fx.count(11 * s, 5);
  for (let i = 0; i < fireCount; i++) {
    randomDirection(scratchVelocity).multiplyScalar(rand(4, 11) * root);
    scratchVelocity.y += rand(0, 3) * root;
    fx.emit(ParticleType.FIRE, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.6, 1.15) + 0.12 * s,
      size: rand(2, 3.4) * s,
      sizeEnd: rand(1.6, 2.1),
      color: scratchColor.setHSL(
        palette.fireHue + Math.random() * palette.fireHueJitter,
        1,
        palette.fireLightness + Math.random() * 0.08
      ),
      intensity: 2.8,
      drag: 2.6,
    });
  }
  // 填芯火团（低速，保持火球中心饱满）
  const coreCount = fx.count(3 * root, 2);
  for (let i = 0; i < coreCount; i++) {
    fx.emit(ParticleType.FIRE, position, {
      speed: rand(0.5, 2),
      life: rand(0.45, 0.7),
      size: rand(2.6, 3.6) * s,
      sizeEnd: 1.5,
      color: scratchColor.setHSL(palette.fireHue + 0.03, 1, palette.fireLightness + 0.12),
      intensity: 3.4,
      drag: 3,
    });
  }

  // 4) 火花：高速曳光，受重力下坠
  const sparkCount = fx.count(16 * s, 5);
  for (let i = 0; i < sparkCount; i++) {
    fx.emit(ParticleType.SPARK, position, {
      speed: rand(28, 68) * (0.75 + 0.25 * s),
      life: rand(0.35, 0.95),
      size: rand(0.26, 0.46) * root,
      color: scratchColor.set(palette.sparkColor),
      intensity: 3.6,
      gravityScale: 0.55,
      drag: 1.3,
      stretch: 0.05,
    });
  }

  // 5) 炽热余烬（发光碎块，部分拖烟）
  const emberCount = fx.count(7 * s, 2);
  for (let i = 0; i < emberCount; i++) {
    randomDirection(scratchVelocity).multiplyScalar(rand(12, 28) * root);
    scratchVelocity.y += rand(4, 10);
    fx.emit(ParticleType.EMBER, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(1.1, 2.3),
      size: rand(0.5, 0.85) * root,
      color: scratchColor.set(palette.emberColor),
      intensity: 4,
      gravityScale: 0.9,
      smokeTrail: i % 2 === 0,
    });
  }

  // 6) 实心碎片
  const debrisCount = fx.count(5 * s * debrisScale, debrisScale > 0 ? 1 : 0);
  for (let i = 0; i < debrisCount; i++) {
    randomDirection(scratchVelocity).multiplyScalar(rand(9, 24) * root);
    scratchVelocity.y += rand(5, 12);
    const shade = rand(0.12, 0.26);
    fx.debris(
      position,
      scratchVelocity,
      rand(0.35, 0.95) * root,
      scratchColor.setRGB(shade, shade * 0.98, shade * 1.04),
      rand(1.6, 2.8),
      i % 3 === 0
    );
  }

  // 7) 浓烟柱（延迟，自火球中心翻滚上升）
  if (smokeScale > 0) {
    const origin = position.clone();
    fx.schedule(0.1, () => {
      const smokeCount = fx.count(9 * s * smokeScale, 3);
      for (let i = 0; i < smokeCount; i++) {
        randomDirection(scratchPosition)
          .multiplyScalar(rand(0, 1.8) * s)
          .add(origin);
        scratchVelocity
          .set(rand(-1.5, 1.5), rand(2.5, 5.5), rand(-1.5, 1.5))
          .multiplyScalar(0.7 + 0.3 * root);
        const light = palette.smokeLightness + Math.random() * 0.07;
        fx.emit(ParticleType.SMOKE, scratchPosition, {
          speed: 0,
          velocity: scratchVelocity,
          life: rand(2.6, 4.6) * (0.8 + 0.2 * smokeScale),
          size: rand(2.4, 4) * s,
          sizeEnd: rand(2.6, 3.2),
          color: scratchColor.setHSL(0.06, 0.12, light),
          colorEnd: scratchColorEnd.setHSL(0.06, 0.05, light + 0.2),
          alpha: 0.78,
          drag: 0.9,
          gravityScale: -0.08,
        });
      }
    });
    fx.schedule(0.38, () => {
      const plumeCount = fx.count(5 * s * smokeScale, 2);
      for (let i = 0; i < plumeCount; i++) {
        scratchPosition.copy(origin).addScaledVector(UP, rand(1.5, 3.5) * s);
        scratchPosition.x += rand(-1.5, 1.5) * s;
        scratchPosition.z += rand(-1.5, 1.5) * s;
        scratchVelocity.set(rand(-1, 1), rand(3.5, 6), rand(-1, 1));
        const light = palette.smokeLightness + 0.05 + Math.random() * 0.08;
        fx.emit(ParticleType.SMOKE, scratchPosition, {
          speed: 0,
          velocity: scratchVelocity,
          life: rand(3, 5),
          size: rand(2.8, 4.2) * s,
          sizeEnd: 3,
          color: scratchColor.setHSL(0.06, 0.08, light),
          colorEnd: scratchColorEnd.setHSL(0.06, 0.04, light + 0.22),
          alpha: 0.62,
          drag: 0.8,
          gravityScale: -0.1,
        });
      }
    });
  }
}

export function emitExplosion(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number,
  profile: 'enemy' | 'player' | 'friendly'
): void {
  const s = THREE.MathUtils.clamp(scale, 0.5, 3);
  const palette = PALETTES[profile] ?? PALETTES.enemy;
  emitLayeredExplosion(fx, position, s, palette, {
    smokeScale: profile === 'player' ? 1.3 : profile === 'friendly' ? 0.8 : 1,
  });

  // 重型爆炸：二次连爆
  if (s >= 1.4) {
    const origin = position.clone();
    for (let k = 0; k < 3; k++) {
      const delay = 0.1 + k * 0.09 + Math.random() * 0.05;
      fx.schedule(delay, () => {
        randomDirection(scratchPosition)
          .multiplyScalar(rand(1.5, 3.2) * s)
          .add(origin);
        emitMiniBlast(fx, scratchPosition, 0.6 * s, palette);
      });
    }
  }
}

/** 小型连爆（次级爆点） */
function emitMiniBlast(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number,
  palette: ExplosionPalette
): void {
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.1,
    size: 3 * scale,
    color: scratchColor.set(palette.flash),
    intensity: 5,
  });
  const fireCount = fx.count(4 * scale, 2);
  for (let i = 0; i < fireCount; i++) {
    fx.emit(ParticleType.FIRE, position, {
      speed: rand(3, 7),
      life: rand(0.45, 0.8),
      size: rand(1.6, 2.6) * scale,
      color: scratchColor.setHSL(
        palette.fireHue + Math.random() * palette.fireHueJitter,
        1,
        palette.fireLightness
      ),
      intensity: 2.6,
      drag: 2.4,
    });
  }
  const sparkCount = fx.count(6 * scale, 2);
  for (let i = 0; i < sparkCount; i++) {
    fx.emit(ParticleType.SPARK, position, {
      speed: rand(22, 48),
      life: rand(0.3, 0.6),
      size: 0.3,
      color: scratchColor.set(palette.sparkColor),
      gravityScale: 0.5,
    });
  }
}

/**
 * Boss 多段死亡：初爆 → 4 次随机连爆 → 终极火球 + 双冲击环 + 冲天烟柱 + 拖烟残骸
 */
export function emitBossDeathExplosion(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number
): void {
  const s = THREE.MathUtils.clamp(scale, 0.8, 4);
  const origin = position.clone();
  const palette = PALETTES.boss;

  emitLayeredExplosion(fx, origin, 1.6 * s, palette, { smokeScale: 0.6 });

  const stageDelays = [0.28, 0.55, 0.82, 1.1, 1.32];
  for (const delay of stageDelays) {
    fx.schedule(delay, () => {
      randomDirection(scratchPosition)
        .multiplyScalar(rand(4, 9) * s)
        .add(origin);
      emitLayeredExplosion(fx, scratchPosition, rand(0.9, 1.4) * s, palette, {
        smokeScale: 0.45,
        debrisScale: 0.6,
        groundRing: false,
      });
    });
  }

  fx.schedule(1.65, () => {
    emitLayeredExplosion(fx, origin, 3 * s, palette, { smokeScale: 1.4, debrisScale: 1.6 });
    // 双冲击环
    fx.shockwave(origin, 38 * s, 1.2, 0xffc890, 0.75);
    fx.emit(ParticleType.RING, origin, {
      speed: 0,
      life: 0.8,
      size: 12 * s,
      sizeEnd: 9,
      color: scratchColor.set(0xfff0d8),
      alpha: 0.7,
      intensity: 2.4,
      cell: VfxCell.THIN_RING,
      rotation: 0,
    });
    // 拖烟残骸雨
    const wreckCount = fx.count(10 * s, 4);
    for (let i = 0; i < wreckCount; i++) {
      randomDirection(scratchVelocity).multiplyScalar(rand(16, 34));
      scratchVelocity.y = Math.abs(scratchVelocity.y) + rand(10, 22);
      fx.emit(ParticleType.EMBER, origin, {
        speed: 0,
        velocity: scratchVelocity,
        life: rand(2, 3.4),
        size: rand(0.9, 1.4),
        color: scratchColor.set(0xff8a2e),
        intensity: 4.5,
        gravityScale: 0.85,
        smokeTrail: true,
      });
    }
  });

  // 冲天烟柱（持续翻涌）
  for (let k = 0; k < 4; k++) {
    fx.schedule(1.9 + k * 0.45, () => {
      const count = fx.count(6 * s, 2);
      for (let i = 0; i < count; i++) {
        scratchPosition.copy(origin);
        scratchPosition.x += rand(-4, 4) * s;
        scratchPosition.y += rand(0, 3) * s + k * 2.5 * s;
        scratchPosition.z += rand(-4, 4) * s;
        scratchVelocity.set(rand(-1.2, 1.2), rand(4, 8), rand(-1.2, 1.2));
        fx.emit(ParticleType.SMOKE, scratchPosition, {
          speed: 0,
          velocity: scratchVelocity,
          life: rand(4.5, 6.5),
          size: rand(5, 8) * s,
          sizeEnd: 2.8,
          color: scratchColor.setHSL(0.05, 0.1, 0.08 + Math.random() * 0.06),
          colorEnd: scratchColorEnd.setHSL(0.05, 0.05, 0.3),
          alpha: 0.75,
          drag: 0.6,
          gravityScale: -0.1,
        });
      }
    });
  }
}

const HIT_PROFILES: Record<
  HitEffectProfile,
  { flash: number; spark: number; sparkScale: number; flashScale: number }
> = {
  // player：玩家被击中（红橙）；enemy：击中敌机（金黄）；boss：击中 Boss 装甲（金属白橙）
  player: { flash: 0xff9a6a, spark: 0xff6a3a, sparkScale: 1, flashScale: 1.1 },
  enemy: { flash: 0xffe3a8, spark: 0xffd060, sparkScale: 1, flashScale: 1 },
  boss: { flash: 0xfff0d0, spark: 0xffb050, sparkScale: 1.4, flashScale: 1.45 },
};

/**
 * 命中：火花 + 小闪光 + 烟丝（Boss 额外碎屑）
 */
export function emitHit(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  intensity: number,
  profile: HitEffectProfile
): void {
  const i = THREE.MathUtils.clamp(intensity, 0.6, 2.2);
  const config = HIT_PROFILES[profile] ?? HIT_PROFILES.player;

  // 闪光寿命保持在短促反馈区间（<0.3s）
  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.06 + Math.random() * 0.05,
    size: 1.5 * i * config.flashScale,
    sizeEnd: 0.6,
    color: scratchColor.set(config.flash),
    intensity: 4,
  });
  fx.emit(ParticleType.GLOW, position, {
    speed: 0,
    life: 0.07,
    size: 2.6 * i * config.flashScale,
    sizeEnd: 1.2,
    color: scratchColor.set(config.flash),
    cell: VfxCell.FLARE,
    intensity: 2.2,
  });

  const sparkCount = fx.count(7 * i * config.sparkScale, 3);
  for (let k = 0; k < sparkCount; k++) {
    fx.emit(ParticleType.SPARK, position, {
      speed: rand(16, 40),
      life: rand(0.16, 0.42),
      size: rand(0.16, 0.28),
      color: scratchColor.set(config.spark),
      intensity: 3.2,
      gravityScale: 0.6,
      drag: 1.6,
      stretch: 0.04,
    });
  }

  const wispCount = fx.count(1 + i * 0.6, 1);
  for (let k = 0; k < wispCount; k++) {
    fx.emit(ParticleType.SMOKE, position, {
      speed: rand(0.8, 2),
      life: rand(0.6, 1),
      size: 0.8 * i,
      sizeEnd: 2.4,
      color: scratchColor.setRGB(0.3, 0.3, 0.32),
      alpha: 0.42,
    });
  }

  if (profile === 'boss') {
    const chips = fx.count(2 * i, 1);
    for (let k = 0; k < chips; k++) {
      randomDirection(scratchVelocity).multiplyScalar(rand(8, 16));
      scratchVelocity.y += 5;
      fx.debris(
        position,
        scratchVelocity,
        rand(0.18, 0.32),
        scratchColor.setRGB(0.34, 0.34, 0.36),
        rand(0.8, 1.4)
      );
    }
    fx.emit(ParticleType.EMBER, position, {
      speed: rand(8, 14),
      life: rand(0.5, 0.9),
      size: 0.32,
      color: scratchColor.set(0xffa040),
      gravityScale: 0.8,
    });
  }
}

export function emitMissileImpact(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number
): void {
  const s = THREE.MathUtils.clamp(scale, 1, 2.6);
  emitLayeredExplosion(fx, position, 0.8 * s, PALETTES.enemy, { smokeScale: 0.75 });
  // 弹头破片环
  const count = fx.count(10 + s * 4, 6);
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + Math.random() * 0.3;
    scratchVelocity
      .set(Math.cos(angle), rand(-0.25, 0.35), Math.sin(angle))
      .multiplyScalar(rand(40, 70));
    fx.emit(ParticleType.SPARK, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(0.25, 0.5),
      size: 0.32,
      color: scratchColor.set(0xffd27a),
      intensity: 3.5,
      gravityScale: 0.35,
      stretch: 0.04,
    });
  }
}

export function emitBossMissileExplosion(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number
): void {
  const s = THREE.MathUtils.clamp(scale, 1.15, 2.6);
  emitLayeredExplosion(fx, position, 0.95 * s, PALETTES.flak, { smokeScale: 0.9 });
  fx.shockwave(position, 9 + s * 6, 0.5 + s * 0.1, 0xff6a3a, 0.65);
}

/**
 * 高射炮弹：锐利闪光 + 黑色弹幕烟团 + 破片 + 杀伤半径环
 */
export function emitFlakExplosion(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  radius: number
): void {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 50;
  const s = THREE.MathUtils.clamp(r / 50, 0.8, 1.5);

  fx.emit(ParticleType.EXPLOSION, position, {
    speed: 0,
    life: 0.12,
    size: 5.5 * s,
    color: scratchColor.set(0xffcf9a),
    intensity: 5.5,
  });
  fx.emit(ParticleType.GLOW, position, {
    speed: 0,
    life: 0.08,
    size: 9 * s,
    cell: VfxCell.FLARE,
    color: scratchColor.set(0xffe0b0),
    intensity: 2.6,
  });

  const fireCount = fx.count(5 * s, 2);
  for (let i = 0; i < fireCount; i++) {
    fx.emit(ParticleType.FIRE, position, {
      speed: rand(4, 9),
      life: rand(0.3, 0.55),
      size: rand(2.2, 3.2) * s,
      color: scratchColor.setHSL(0.04, 1, 0.5),
      intensity: 2.6,
      drag: 3,
    });
  }

  const puffCount = fx.count(10 * s, 4);
  for (let i = 0; i < puffCount; i++) {
    randomDirection(scratchVelocity).multiplyScalar(rand(5, 12));
    fx.emit(ParticleType.SMOKE, position, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(2.2, 3.4),
      size: rand(3.6, 5.4) * s,
      sizeEnd: 2.2,
      color: scratchColor.setRGB(0.06, 0.06, 0.065),
      colorEnd: scratchColorEnd.setRGB(0.2, 0.2, 0.21),
      alpha: 0.85,
      drag: 2.4,
      gravityScale: -0.04,
    });
  }

  const shrapnel = fx.count(20 * s, 8);
  for (let i = 0; i < shrapnel; i++) {
    fx.emit(ParticleType.SPARK, position, {
      speed: rand(60, 110),
      life: rand(0.22, 0.48),
      size: 0.3,
      color: scratchColor.set(0xffbe7a),
      intensity: 3,
      gravityScale: 0.3,
      stretch: 0.03,
    });
  }

  // 杀伤半径外缘：淡橙环 + 一圈翻滚烟团
  fx.emit(ParticleType.RING, position, {
    speed: 0,
    life: 0.45,
    size: r * 0.5,
    sizeEnd: (r * 2) / 0.7 / (r * 0.5),
    color: scratchColor.set(0xffa070),
    alpha: 0.32,
    intensity: 1.2,
    rotation: 0,
  });
  const shell = fx.count(12, 6);
  for (let i = 0; i < shell; i++) {
    const angle = (i / shell) * Math.PI * 2;
    scratchPosition
      .set(Math.cos(angle) * r * 0.5, rand(-0.2, 0.2) * r, Math.sin(angle) * r * 0.5)
      .add(position);
    scratchVelocity.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(rand(8, 14));
    fx.emit(ParticleType.SMOKE, scratchPosition, {
      speed: 0,
      velocity: scratchVelocity,
      life: rand(1.2, 1.8),
      size: rand(3, 4.5),
      sizeEnd: 2,
      color: scratchColor.setRGB(0.22, 0.21, 0.21),
      alpha: 0.45,
      drag: 1.8,
    });
  }
}

/**
 * 重武器命中（Boss 主炮 / 激光 / 高炮破片 / 装甲弹跳）
 */
export function emitHeavyWeaponImpact(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  scale: number,
  profile: HeavyWeaponImpactProfile
): void {
  const s = THREE.MathUtils.clamp(scale, 0.95, 2.8);
  switch (profile) {
    case 'laser': {
      fx.emit(ParticleType.EXPLOSION, position, {
        speed: 0,
        life: 0.16,
        size: 3.4 * s,
        color: scratchColor.set(0xd9fbff),
        intensity: 5,
      });
      fx.emit(ParticleType.RING, position, {
        speed: 0,
        life: 0.35,
        size: 2 * s,
        sizeEnd: 5,
        color: scratchColor.set(0x66dfff),
        cell: VfxCell.THIN_RING,
        alpha: 0.8,
        intensity: 2.4,
      });
      const sparks = fx.count(14 * s, 5);
      for (let i = 0; i < sparks; i++) {
        fx.emit(ParticleType.SPARK, position, {
          speed: rand(20, 50),
          life: rand(0.25, 0.55),
          size: 0.3,
          color: scratchColor.set(0x8ff0ff),
          intensity: 3.6,
          gravityScale: 0.2,
        });
      }
      const glows = fx.count(4 * s, 2);
      for (let i = 0; i < glows; i++) {
        fx.emit(ParticleType.GLOW, position, {
          speed: rand(2, 6),
          life: rand(0.3, 0.6),
          size: rand(1.4, 2.4) * s,
          sizeEnd: 1.6,
          color: scratchColor.set(0x66dfff),
          intensity: 2.4,
        });
      }
      fx.emit(ParticleType.SMOKE, position, {
        speed: 1.5,
        life: 1.2,
        size: 1.8 * s,
        color: scratchColor.setHSL(0.57, 0.15, 0.24),
        alpha: 0.4,
      });
      break;
    }
    case 'boss-armor': {
      fx.emit(ParticleType.EXPLOSION, position, {
        speed: 0,
        life: 0.1,
        size: 2.4 * s,
        color: scratchColor.set(0xfff0d0),
        intensity: 4,
      });
      const sparks = fx.count(18 * s, 6);
      for (let i = 0; i < sparks; i++) {
        fx.emit(ParticleType.SPARK, position, {
          speed: rand(25, 60),
          life: rand(0.25, 0.6),
          size: rand(0.22, 0.34),
          color: scratchColor.set(0xffb050),
          intensity: 3.4,
          gravityScale: 0.8,
          stretch: 0.05,
        });
      }
      const chips = fx.count(4 * s, 2);
      for (let i = 0; i < chips; i++) {
        randomDirection(scratchVelocity).multiplyScalar(rand(8, 18));
        scratchVelocity.y += 6;
        fx.debris(
          position,
          scratchVelocity,
          rand(0.2, 0.4),
          scratchColor.setRGB(0.42, 0.43, 0.46),
          rand(0.8, 1.5)
        );
      }
      fx.emit(ParticleType.SMOKE, position, {
        speed: 1.2,
        life: 1,
        size: 1.6 * s,
        color: scratchColor.setRGB(0.36, 0.36, 0.38),
        alpha: 0.45,
      });
      fx.shockwave(position, 4 + s * 2, 0.3, 0x8b8f95, 0.4);
      break;
    }
    case 'flak-hit': {
      emitLayeredExplosion(fx, position, 0.6 * s, PALETTES.flak, {
        smokeScale: 0.6,
        debrisScale: 0.5,
      });
      break;
    }
    case 'boss-cannon':
    default: {
      emitLayeredExplosion(fx, position, 0.95 * s, PALETTES.boss, { smokeScale: 0.85 });
      break;
    }
  }
}

export { PALETTES as EXPLOSION_PALETTES };
