import * as THREE from 'three';
import { ParticleType } from '../ParticleTypes';
import type { ParticleEmitter, SpawnOptions } from '../ParticleTypes';
import { VfxCell } from '../VfxAtlas';

/**
 * 高频配方（逐帧/高频调用）：导弹尾迹、受损冒烟、枪口焰。
 * 全部复用模块级暂存对象，零分配。
 */

const scratchColor = new THREE.Color();
const scratchColorEnd = new THREE.Color();
const scratchVelocity = new THREE.Vector3();
const scratchPosition = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();
const scratchAxis = new THREE.Vector3();

const options: SpawnOptions = { speed: 0, life: 1, size: 1, color: scratchColor };

function resetOptions(): SpawnOptions {
  options.speed = 0;
  options.life = 1;
  options.size = 1;
  options.color = scratchColor;
  options.gravity = undefined;
  options.spin = undefined;
  options.smokeTrail = undefined;
  options.velocity = undefined;
  options.sizeEnd = undefined;
  options.colorEnd = undefined;
  options.intensity = undefined;
  options.alpha = undefined;
  options.gravityScale = undefined;
  options.drag = undefined;
  options.cell = undefined;
  options.stretch = undefined;
  options.axis = undefined;
  options.planar = undefined;
  options.rotation = undefined;
  options.additive = undefined;
  return options;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function isFiniteVector(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/** 旧接口：小烟点（导弹消失时） */
export function emitTrail(fx: ParticleEmitter, position: THREE.Vector3, color: THREE.Color): void {
  const o = resetOptions();
  o.speed = 1.5;
  o.life = 0.45;
  o.size = 0.9;
  o.sizeEnd = 2.2;
  o.color = scratchColor.copy(color);
  o.alpha = 0.5;
  fx.emit(ParticleType.SMOKE, position, o);
  const g = resetOptions();
  g.life = 0.16;
  g.size = 1.4;
  g.color = scratchColor.copy(color);
  g.intensity = 2.4;
  fx.emit(ParticleType.GLOW, position, g);
}

/** 通用导弹尾迹（敌方单位 / 坠毁烟柱等）的烟：不透明度与末尺寸倍率 */
const MISSILE_SMOKE_ALPHA = 0.42;
const MISSILE_SMOKE_SIZE_END = 4.2;
/**
 * 玩家导弹的烟更轻更细：导弹从座舱视点侧下方约 1.6 米的挂架离架，烟团末半径
 * （1.25 × 2.4 / 2 = 1.5 米）不超过这个偏移，第一人称时烟带不会压到准星指向的目标上。
 */
const PLAYER_MISSILE_SMOKE_ALPHA = 0.25;
const PLAYER_MISSILE_SMOKE_SIZE_END = 2.4;

/** 玩家导弹尾迹的渐入系数；null 表示通用配方（下一次 emitMissileTrail 不受影响） */
let playerMissileTrailRamp: number | null = null;

/**
 * 让紧随其后的一次 emitMissileTrail 使用玩家导弹配方：ramp 0..1 是离架后的渐入系数
 * （尾焰亮度、烟的不透明度随它从零升到玩家导弹的正常值）。调用方必须在发射尾迹后立刻
 * 调用 endPlayerMissileTrail。这样做是因为 ParticleSystem.createMissileTrail 的签名里
 * 没有配方参数；其它调用方（敌方单位导弹等）不调用这对函数，外观保持不变。
 */
export function beginPlayerMissileTrail(ramp: number): void {
  playerMissileTrailRamp = Number.isFinite(ramp) ? THREE.MathUtils.clamp(ramp, 0, 1) : 1;
}

export function endPlayerMissileTrail(): void {
  playerMissileTrailRamp = null;
}

/**
 * 导弹尾迹：亮尾焰（加色 HDR）+ 滞留烟带（沿速度回填，间距 ~1.4m 保证连续）
 * direction 可以是速度（含大小）或单位方向。
 */
export function emitMissileTrail(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  color: THREE.Color,
  intensity: number = 1
): void {
  if (!isFiniteVector(position) || !isFiniteVector(direction)) return;
  const playerRamp = playerMissileTrailRamp;
  // 通用配方：glowScale = 1、烟按通用常量，与改动前逐项相同
  const glowScale = playerRamp ?? 1;
  const smokeAlpha =
    playerRamp === null ? MISSILE_SMOKE_ALPHA : PLAYER_MISSILE_SMOKE_ALPHA * playerRamp;
  const smokeSizeEnd = playerRamp === null ? MISSILE_SMOKE_SIZE_END : PLAYER_MISSILE_SMOKE_SIZE_END;
  if (glowScale <= 0) return;
  const k = THREE.MathUtils.clamp(intensity, 0.6, 2);
  const speed = direction.length();
  scratchDirection.copy(direction);
  if (speed > 1e-4) scratchDirection.multiplyScalar(1 / speed);
  else scratchDirection.set(0, 0, -1);

  // 尾焰：短命高亮火舌 + 柔光
  const flame = resetOptions();
  flame.life = 0.07 + Math.random() * 0.03;
  flame.size = 1.1 * k;
  flame.sizeEnd = 0.6;
  flame.color = scratchColor.copy(color);
  flame.intensity = 4.2 * glowScale;
  flame.axis = scratchAxis.copy(scratchDirection).multiplyScalar(-1);
  flame.stretch = 1.6;
  flame.cell = VfxCell.PETAL;
  flame.rotation = 0;
  fx.emit(ParticleType.GLOW, position, flame);

  const glow = resetOptions();
  glow.life = 0.06;
  glow.size = 1.8 * k;
  glow.color = scratchColor.copy(color);
  glow.intensity = 2.2 * glowScale;
  fx.emit(ParticleType.GLOW, position, glow);

  // 烟带：按速度回填（发射间隔 ~0.03s）
  const gap = speed > 1 ? speed * 0.03 : 0;
  const puffs = gap > 0 ? Math.min(4, Math.max(1, Math.ceil(gap / 1.1))) : 1;
  for (let i = 0; i < puffs; i++) {
    if (i > 0 && Math.random() > fx.detail) continue;
    scratchPosition.copy(position).addScaledVector(scratchDirection, -(gap * i) / puffs);
    scratchVelocity.copy(scratchDirection).multiplyScalar(-2.5);
    scratchVelocity.x += rand(-0.6, 0.6);
    scratchVelocity.y += rand(-0.2, 0.8);
    scratchVelocity.z += rand(-0.6, 0.6);
    const smoke = resetOptions();
    smoke.velocity = scratchVelocity;
    smoke.life = rand(1.4, 2.2);
    smoke.size = 1 * k;
    smoke.sizeEnd = smokeSizeEnd;
    const light = rand(0.72, 0.84);
    smoke.color = scratchColor.setRGB(light, light, light * 1.02);
    smoke.colorEnd = scratchColorEnd.setRGB(light + 0.08, light + 0.08, light + 0.1);
    smoke.alpha = smokeAlpha;
    smoke.drag = 1.2;
    smoke.gravityScale = -0.03;
    fx.emit(ParticleType.SMOKE, scratchPosition, smoke);
  }

  // 偶发火星
  if (Math.random() < 0.18 * fx.detail) {
    const spark = resetOptions();
    spark.velocity = scratchVelocity.copy(scratchDirection).multiplyScalar(-8);
    spark.speed = 6;
    spark.life = 0.25;
    spark.size = 0.18;
    spark.color = scratchColor.copy(color);
    spark.intensity = 3;
    fx.emit(ParticleType.SPARK, position, spark);
  }
}

/** Boss 导弹尾迹：更粗更暗的烟 + 红橙尾焰 */
export function emitBossMissileTrail(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  direction: THREE.Vector3
): void {
  if (!isFiniteVector(position) || !isFiniteVector(direction)) return;
  const speed = direction.length();
  scratchDirection.copy(direction);
  if (speed > 1e-4) scratchDirection.multiplyScalar(1 / speed);
  else scratchDirection.set(0, 0, -1);

  const flame = resetOptions();
  flame.life = 0.09;
  flame.size = 1.6;
  flame.sizeEnd = 0.6;
  flame.color = scratchColor.setRGB(1, 0.38, 0.12);
  flame.intensity = 4.4;
  flame.axis = scratchAxis.copy(scratchDirection).multiplyScalar(-1);
  flame.stretch = 1.8;
  flame.cell = VfxCell.PETAL;
  flame.rotation = 0;
  fx.emit(ParticleType.GLOW, position, flame);

  const gap = speed > 1 ? speed * 0.04 : 0;
  const puffs = gap > 0 ? Math.min(3, Math.max(1, Math.ceil(gap / 1.6))) : 1;
  for (let i = 0; i < puffs; i++) {
    if (i > 0 && Math.random() > fx.detail) continue;
    scratchPosition.copy(position).addScaledVector(scratchDirection, -(gap * i) / puffs);
    scratchVelocity.copy(scratchDirection).multiplyScalar(-2);
    scratchVelocity.y += rand(0, 0.8);
    const smoke = resetOptions();
    smoke.velocity = scratchVelocity;
    smoke.speed = 0.6;
    smoke.life = rand(1.5, 2.3);
    smoke.size = 1.1;
    smoke.sizeEnd = 3.6;
    const light = rand(0.3, 0.4);
    smoke.color = scratchColor.setRGB(light, light * 0.96, light * 0.94);
    smoke.colorEnd = scratchColorEnd.setRGB(light + 0.16, light + 0.15, light + 0.15);
    smoke.alpha = 0.6;
    smoke.drag = 1;
    smoke.gravityScale = -0.04;
    fx.emit(ParticleType.SMOKE, scratchPosition, smoke);
  }
}

/**
 * 受损冒烟（6-10 Hz 调用）：intensity 0..1；>0.5 变黑，>0.75 带火舌。
 */
export function emitDamageSmoke(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  intensity: number
): void {
  if (!isFiniteVector(position)) return;
  const k = THREE.MathUtils.clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
  if (k <= 0.01) return;
  // 低画质/高负载下按概率抽稀
  if (Math.random() > fx.detail + 0.15) return;

  const light = 0.5 - k * 0.38;
  scratchVelocity.set(rand(-0.6, 0.6), rand(1.5, 3) + k * 1.5, rand(-0.6, 0.6));
  const smoke = resetOptions();
  smoke.velocity = scratchVelocity;
  smoke.life = rand(1.1, 1.8) + k * 0.6;
  smoke.size = 0.9 + k * 0.9;
  smoke.sizeEnd = 3.2;
  smoke.color = scratchColor.setRGB(light, light * 0.97, light * 0.95);
  smoke.colorEnd = scratchColorEnd.setRGB(light + 0.18, light + 0.18, light + 0.19);
  smoke.alpha = 0.4 + k * 0.35;
  smoke.drag = 0.8;
  smoke.gravityScale = -0.08;
  fx.emit(ParticleType.SMOKE, position, smoke);

  if (k > 0.75 && Math.random() < 0.7) {
    const fire = resetOptions();
    fire.speed = 1;
    fire.life = rand(0.25, 0.4);
    fire.size = 0.9 + (k - 0.75) * 2.4;
    fire.sizeEnd = 1.4;
    fire.color = scratchColor.setHSL(0.06 + Math.random() * 0.03, 1, 0.52);
    fire.intensity = 2.8;
    fire.gravityScale = -0.3;
    fx.emit(ParticleType.FIRE, position, fire);
  }
}

/**
 * 枪口焰：星芒核心 + 沿射向的焰瓣 + 两片侧瓣 + 偶发火星/烟丝（每发约 4-6 粒子）
 */
export function emitMuzzleFlash(
  fx: ParticleEmitter,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  scale: number = 1
): void {
  if (!isFiniteVector(position) || !isFiniteVector(direction)) return;
  const s = THREE.MathUtils.clamp(Number.isFinite(scale) ? scale : 1, 0.2, 4);
  scratchDirection.copy(direction);
  const len = scratchDirection.length();
  if (len < 1e-5) return;
  scratchDirection.multiplyScalar(1 / len);

  const core = resetOptions();
  core.life = 0.05;
  core.size = 1.2 * s;
  core.sizeEnd = 0.7;
  core.color = scratchColor.setRGB(1, 0.86, 0.55);
  core.intensity = 5;
  core.cell = VfxCell.FLARE;
  fx.emit(ParticleType.GLOW, position, core);

  // 前向焰瓣（沿射向拉伸）
  scratchPosition.copy(position).addScaledVector(scratchDirection, 0.6 * s);
  const petal = resetOptions();
  petal.life = 0.045;
  petal.size = 0.9 * s;
  petal.sizeEnd = 0.8;
  petal.color = scratchColor.setRGB(1, 0.72, 0.32);
  petal.intensity = 4;
  petal.cell = VfxCell.PETAL;
  petal.axis = scratchAxis.copy(scratchDirection);
  petal.stretch = 2.2 * s;
  petal.rotation = 0;
  fx.emit(ParticleType.GLOW, scratchPosition, petal);

  // 侧瓣（随机朝向的短焰瓣，打破对称）
  for (let i = 0; i < 2; i++) {
    const side = resetOptions();
    side.life = 0.04;
    side.size = 0.75 * s;
    side.sizeEnd = 0.9;
    side.color = scratchColor.setRGB(1, 0.66, 0.28);
    side.intensity = 3;
    side.cell = VfxCell.PETAL;
    fx.emit(ParticleType.GLOW, position, side);
  }

  if (Math.random() < 0.45 * fx.detail) {
    const spark = resetOptions();
    spark.velocity = scratchVelocity.copy(scratchDirection).multiplyScalar(rand(30, 55));
    spark.speed = 6;
    spark.life = rand(0.1, 0.2);
    spark.size = 0.16 * s;
    spark.color = scratchColor.setRGB(1, 0.75, 0.35);
    spark.intensity = 3;
    spark.gravityScale = 0.2;
    fx.emit(ParticleType.SPARK, position, spark);
  }
  if (Math.random() < 0.3 * fx.detail) {
    const wisp = resetOptions();
    wisp.velocity = scratchVelocity.copy(scratchDirection).multiplyScalar(3);
    wisp.speed = 0.6;
    wisp.life = rand(0.35, 0.55);
    wisp.size = 0.5 * s;
    wisp.sizeEnd = 2.4;
    wisp.color = scratchColor.setRGB(0.55, 0.55, 0.56);
    wisp.alpha = 0.3;
    fx.emit(ParticleType.SMOKE, position, wisp);
  }
}
