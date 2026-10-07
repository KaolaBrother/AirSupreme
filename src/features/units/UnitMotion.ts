import * as THREE from 'three';
import type { UnitEntity } from './UnitEntity';
import type { UnitMissileLaunchOptions } from './UnitMissiles';
import type { UnitShotKind } from './UnitProjectiles';
import type { SurfaceSample } from './UnitPlacement';
import { UNIT_BATTLEFIELD_LIMIT } from './UnitPlacement';
import type { UnitDomain } from './UnitTypes';

/**
 * 行为层与 UnitSystem 之间的窄接口 + 通用运动学工具。
 * 行为函数只通过 UnitWorld 开火 / 发射 / 投弹 / 告警，不直接触碰回调或场景。
 */

/** 单位行为事件：主炮开火、导弹发射、高炮齐射、火箭齐射、近防炮、投弹、潜艇上浮 / 下潜 */
export type UnitEventKind =
  | 'cannon'
  | 'missile-launch'
  | 'flak-burst'
  | 'rocket-salvo'
  | 'ciws'
  | 'bomb-drop'
  | 'sub-surface'
  | 'sub-dive';

/** 敌方子弹池（ProjectilePool）的固定弹速，用于计算提前量 */
export const UNIT_GUN_PROJECTILE_SPEED = 100;
/** 水面高度（与 TerrainGenerator.WORLDSCAPE_WATER_Y 一致） */
export const UNIT_WATER_Y = -48;

export interface UnitWorld {
  readonly time: number;
  readonly playerPosition: THREE.Vector3;
  readonly playerVelocity: THREE.Vector3;
  /** 玩家可被攻击（存活且可见） */
  readonly playerActive: boolean;
  readonly enemyAirMeshes: readonly THREE.Object3D[];
  readonly friendlyAirMeshes: readonly THREE.Object3D[];
  /** 存活的友军单位 */
  readonly allies: readonly UnitEntity[];
  /** 存活且可命中的敌方单位 */
  readonly hostiles: readonly UnitEntity[];
  readonly damageMultiplier: number;
  readonly cooldownMultiplier: number;
  /** 命中精度加成（关卡强度 + 雷达站校准） */
  readonly accuracyBonus: number;
  surface(x: number, z: number, domain: UnitDomain): SurfaceSample;
  /** 敌方单位向玩家开火（经 onUnitFire 进入敌方子弹池） */
  fireAtPlayer(unit: UnitEntity, muzzle: THREE.Vector3, damage: number, spread: number): void;
  /** 友军单位向敌机开火（经 onUnitFire，阵营 FRIENDLY） */
  fireAtObject(
    unit: UnitEntity,
    muzzle: THREE.Vector3,
    target: THREE.Object3D,
    damage: number,
    spread: number
  ): void;
  /** 单位之间的内部弹道 */
  fireAtUnit(
    unit: UnitEntity,
    kind: UnitShotKind,
    muzzle: THREE.Vector3,
    target: UnitEntity,
    damage: number,
    accuracy: number,
    speed: number
  ): void;
  launchMissile(
    unit: UnitEntity,
    from: THREE.Vector3,
    direction: THREE.Vector3,
    target: 'player' | UnitEntity,
    damage: number,
    options: UnitMissileLaunchOptions
  ): boolean;
  dropBomb(
    unit: UnitEntity,
    from: THREE.Vector3,
    velocity: THREE.Vector3,
    damage: number,
    radius: number
  ): void;
  lockWarning(unit: UnitEntity, phase: 'locking' | 'launched'): void;
  kamikazePlayer(unit: UnitEntity, damage: number): void;
  kamikazeUnit(unit: UnitEntity, target: UnitEntity, damage: number): void;
  flakPuff(position: THREE.Vector3, scale: number): void;
  muzzleFlash(position: THREE.Vector3, intensity: number): void;
  splash(position: THREE.Vector3, intensity: number): void;
  visualTracer(from: THREE.Vector3, to: THREE.Vector3): void;
  interceptMissiles(center: THREE.Vector3, radius: number, chance: number): number;
  findNearestMissile(center: THREE.Vector3, radius: number, out: THREE.Vector3): boolean;
  /** 坠毁（例如被 EMP 瘫痪的无人机落地） */
  crash(unit: UnitEntity, byPlayer: boolean): void;
  /** 单位行为事件（音效 / 无线电挂钩） */
  emitEvent(unit: UnitEntity, kind: UnitEventKind): void;
  /** 离场：护送抵达或平民驶出战场 */
  depart(unit: UnitEntity, reason: 'arrived' | 'exited'): void;
}

const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpVec = new THREE.Vector3();

export function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** 以限定角速度把 current 转向 target，返回新角度 */
export function turnToward(current: number, target: number, maxStep: number): number {
  const delta = wrapAngle(target - current);
  if (Math.abs(delta) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(delta) * maxStep);
}

export function headingTo(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

/** 以航向 / 俯仰 / 滚转写入四元数（俯仰正值 = 抬头，滚转为绕前向轴角度） */
export function applyAttitude(unit: UnitEntity): void {
  euler.set(-unit.pitch, unit.heading, unit.roll, 'YXZ');
  unit.mesh.quaternion.setFromEuler(euler);
}

/** 读取模型可动部件 */
export function getPart(unit: UnitEntity, key: string): THREE.Object3D | null {
  const value: unknown = unit.mesh.userData[key];
  return value instanceof THREE.Object3D ? value : null;
}

const EMPTY_PARTS: readonly THREE.Object3D[] = [];

/** 读取同名多实例部件（模板实例化时已收集为数组；不分配新数组） */
export function getPartList(unit: UnitEntity, key: string): readonly THREE.Object3D[] {
  const value: unknown = unit.mesh.userData[key];
  return Array.isArray(value) ? (value as THREE.Object3D[]) : EMPTY_PARTS;
}

/** 部件世界坐标；缺失时回退到单位位置 + 竖直偏移 */
export function partWorldPosition(
  unit: UnitEntity,
  part: THREE.Object3D | null,
  out: THREE.Vector3,
  fallbackUp = 2
): THREE.Vector3 {
  if (part) {
    part.getWorldPosition(out);
    if (Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z)) return out;
  }
  return out.copy(unit.mesh.position).setY(unit.mesh.position.y + fallbackUp);
}

/** 采样单位脚下地表（移动超过 1.5 米才重新采样） */
export function refreshSurface(unit: UnitEntity, world: UnitWorld, force = false): void {
  const p = unit.mesh.position;
  if (
    !force &&
    Number.isFinite(unit.surfaceSampleX) &&
    Math.abs(p.x - unit.surfaceSampleX) < 1.5 &&
    Math.abs(p.z - unit.surfaceSampleZ) < 1.5
  ) {
    return;
  }
  const sample = world.surface(p.x, p.z, unit.domain);
  unit.surfaceY = Number.isFinite(sample.y) ? sample.y : unit.domain === 'sea' ? UNIT_WATER_Y : 0;
  unit.surfaceWater = sample.water;
  unit.surfaceSampleX = p.x;
  unit.surfaceSampleZ = p.z;
}

/** 前方 probe 米处是否可通行（地面需陆地、海上需水面） */
export function canTraverse(
  unit: UnitEntity,
  world: UnitWorld,
  heading: number,
  probe: number
): boolean {
  const p = unit.mesh.position;
  const x = p.x + Math.sin(heading) * probe;
  const z = p.z + Math.cos(heading) * probe;
  if (Math.abs(x) > UNIT_BATTLEFIELD_LIMIT + 80 || Math.abs(z) > UNIT_BATTLEFIELD_LIMIT + 80)
    return false;
  const sample = world.surface(x, z, unit.domain);
  if (unit.domain === 'sea') return sample.water;
  if (unit.domain === 'ground') return !sample.water;
  return true;
}

/**
 * 地面 / 水面移动：朝 (tx, tz) 转向并前进；遇到不可通行区域就原地转向。
 * 返回到目标的水平距离。
 */
export function driveToward(
  unit: UnitEntity,
  world: UnitWorld,
  deltaTime: number,
  tx: number,
  tz: number,
  speed: number,
  turnRate: number,
  stopDistance: number
): number {
  const p = unit.mesh.position;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const distance = Math.hypot(dx, dz);
  const previousHeading = unit.heading;
  if (distance > 0.5) {
    unit.heading = turnToward(unit.heading, Math.atan2(dx, dz), turnRate * deltaTime);
  }
  const yawRate = deltaTime > 0 ? wrapAngle(unit.heading - previousHeading) / deltaTime : 0;
  let targetSpeed = distance > stopDistance ? speed : 0;
  // 急转弯减速
  const headingError = Math.abs(wrapAngle(Math.atan2(dx, dz) - unit.heading));
  if (headingError > 1.2) targetSpeed *= 0.35;
  // 前方探测每 0.2 秒一次（地形采样较贵），结果在两次探测之间沿用
  unit.traverseTimer -= deltaTime;
  if (targetSpeed > 0 && unit.traverseTimer <= 0) {
    unit.traverseTimer = 0.2;
    unit.traverseBlocked = !canTraverse(
      unit,
      world,
      unit.heading,
      Math.max(12, unit.hitRadius * 1.6)
    );
  }
  if (targetSpeed > 0 && unit.traverseBlocked) {
    // 前方是水 / 陆地边缘：转向绕行
    unit.heading = wrapAngle(unit.heading + unit.orbitDirection * 1.6 * deltaTime);
    targetSpeed = 0;
  }
  unit.speed += THREE.MathUtils.clamp(targetSpeed - unit.speed, -6 * deltaTime, 4 * deltaTime);
  const stepX = Math.sin(unit.heading) * unit.speed * deltaTime;
  const stepZ = Math.cos(unit.heading) * unit.speed * deltaTime;
  p.x = THREE.MathUtils.clamp(
    p.x + stepX,
    -UNIT_BATTLEFIELD_LIMIT - 100,
    UNIT_BATTLEFIELD_LIMIT + 100
  );
  p.z = THREE.MathUtils.clamp(
    p.z + stepZ,
    -UNIT_BATTLEFIELD_LIMIT - 100,
    UNIT_BATTLEFIELD_LIMIT + 100
  );
  if (deltaTime > 0) {
    unit.velocity.set(stepX / deltaTime, 0, stepZ / deltaTime);
  }
  unit.roll = unit.domain === 'sea' ? THREE.MathUtils.clamp(-yawRate * 0.25, -0.12, 0.12) : 0;
  return distance;
}

/**
 * 空中转向：水平航向限速转向 + 高度限速爬升；按偏航角速度倾斜机身。
 */
export function flyToward(
  unit: UnitEntity,
  deltaTime: number,
  tx: number,
  ty: number,
  tz: number,
  speed: number,
  turnRate: number,
  climbRate: number,
  bankFactor = 0.7
): number {
  const p = unit.mesh.position;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const horizontal = Math.hypot(dx, dz);
  const previousHeading = unit.heading;
  if (horizontal > 0.5) {
    unit.heading = turnToward(unit.heading, Math.atan2(dx, dz), turnRate * deltaTime);
  }
  const yawRate = deltaTime > 0 ? wrapAngle(unit.heading - previousHeading) / deltaTime : 0;
  unit.speed += THREE.MathUtils.clamp(speed - unit.speed, -10 * deltaTime, 10 * deltaTime);
  const dy = THREE.MathUtils.clamp(ty - p.y, -climbRate * deltaTime, climbRate * deltaTime);
  const stepX = Math.sin(unit.heading) * unit.speed * deltaTime;
  const stepZ = Math.cos(unit.heading) * unit.speed * deltaTime;
  p.x += stepX;
  p.y += dy;
  p.z += stepZ;
  if (deltaTime > 0) unit.velocity.set(stepX / deltaTime, dy / deltaTime, stepZ / deltaTime);
  const targetRoll = THREE.MathUtils.clamp(-yawRate * bankFactor, -0.75, 0.75);
  unit.roll += (targetRoll - unit.roll) * Math.min(1, deltaTime * 3);
  const climbPitch = deltaTime > 0 && unit.speed > 1 ? Math.atan2(dy / deltaTime, unit.speed) : 0;
  unit.pitch +=
    (THREE.MathUtils.clamp(climbPitch, -0.5, 0.5) - unit.pitch) * Math.min(1, deltaTime * 2.5);
  return Math.hypot(horizontal, ty - p.y);
}

/** 沿航线前进（地面 / 水面 / 空中通用）；返回 true 表示抵达终点 */
export function followRoute(
  unit: UnitEntity,
  world: UnitWorld,
  deltaTime: number,
  speed: number
): boolean {
  const route = unit.route;
  if (!route || route.length === 0) return true;
  if (unit.routeIndex >= route.length) return true;
  const waypoint = route[unit.routeIndex];
  const p = unit.mesh.position;
  const reach = unit.domain === 'air' ? 40 : unit.domain === 'sea' ? 24 : 10;
  let distance: number;
  if (unit.domain === 'air') {
    distance = flyToward(unit, deltaTime, waypoint.x, waypoint.y, waypoint.z, speed, 0.45, 8, 0.5);
  } else {
    // 航线点之间已验证可通行，这里不再做前方探测，避免在狭窄水道里原地打转
    const dx = waypoint.x - p.x;
    const dz = waypoint.z - p.z;
    distance = Math.hypot(dx, dz);
    const previousHeading = unit.heading;
    unit.heading = turnToward(unit.heading, Math.atan2(dx, dz), 0.7 * deltaTime);
    const headingError = Math.abs(wrapAngle(Math.atan2(dx, dz) - unit.heading));
    const targetSpeed = headingError > 0.9 ? speed * 0.4 : speed;
    unit.speed += THREE.MathUtils.clamp(targetSpeed - unit.speed, -5 * deltaTime, 3 * deltaTime);
    const stepX = Math.sin(unit.heading) * unit.speed * deltaTime;
    const stepZ = Math.cos(unit.heading) * unit.speed * deltaTime;
    p.x += stepX;
    p.z += stepZ;
    if (deltaTime > 0) unit.velocity.set(stepX / deltaTime, 0, stepZ / deltaTime);
    const yawRate = deltaTime > 0 ? wrapAngle(unit.heading - previousHeading) / deltaTime : 0;
    unit.roll = unit.domain === 'sea' ? THREE.MathUtils.clamp(-yawRate * 0.25, -0.1, 0.1) : 0;
    refreshSurface(unit, world);
  }
  if (distance <= reach) {
    unit.routeIndex++;
    if (unit.routeIndex >= route.length) return true;
  }
  return false;
}

/** 地面 / 海面单位贴合地表，海面单位附带浮动起伏 */
export function settleOnSurface(
  unit: UnitEntity,
  world: UnitWorld,
  deltaTime: number,
  depthOffset = 0
): void {
  refreshSurface(unit, world);
  const p = unit.mesh.position;
  const target = unit.surfaceY + depthOffset;
  if (!Number.isFinite(unit.baseY) || Math.abs(target - unit.baseY) > 25) {
    unit.baseY = target;
  } else {
    unit.baseY += (target - unit.baseY) * Math.min(1, deltaTime * 6);
  }
  p.y = unit.baseY;
  if (unit.domain === 'sea') {
    // 浮动起伏叠加在平滑基准高度上（不累积）
    const t = world.time + unit.seed * 10;
    const scale = Math.min(1, 12 / Math.max(6, unit.hitRadius));
    p.y += Math.sin(t * 1.3) * 0.18 * scale;
    unit.pitch = Math.sin(t * 0.9) * 0.025 * scale + Math.min(0.06, unit.speed * 0.002);
  }
}

/** 目标点相对炮塔的偏航（局部 rotation.y）与俯仰角 */
export function aimAngles(
  unit: UnitEntity,
  origin: THREE.Vector3,
  target: THREE.Vector3
): { yaw: number; pitch: number; distance: number } {
  tmpVec.subVectors(target, origin);
  const horizontal = Math.hypot(tmpVec.x, tmpVec.z);
  const worldYaw = Math.atan2(tmpVec.x, tmpVec.z);
  return {
    yaw: wrapAngle(worldYaw - unit.heading),
    pitch: Math.atan2(tmpVec.y, Math.max(0.001, horizontal)),
    distance: tmpVec.length(),
  };
}

/** 预测拦截点：target + velocity * t，t = 距离 / 弹速（两次迭代） */
export function predictIntercept(
  origin: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  projectileSpeed: number,
  out: THREE.Vector3
): THREE.Vector3 {
  let time = origin.distanceTo(target) / Math.max(1, projectileSpeed);
  out.copy(target).addScaledVector(velocity, time);
  time = origin.distanceTo(out) / Math.max(1, projectileSpeed);
  time = Math.min(time, 4);
  return out.copy(target).addScaledVector(velocity, time);
}

/** 保持在战场范围内：越界时把航向拉回中心 */
export function keepInsideBattlefield(
  unit: UnitEntity,
  deltaTime: number,
  turnRate: number
): boolean {
  const p = unit.mesh.position;
  if (Math.abs(p.x) < UNIT_BATTLEFIELD_LIMIT && Math.abs(p.z) < UNIT_BATTLEFIELD_LIMIT)
    return false;
  unit.heading = turnToward(unit.heading, Math.atan2(-p.x, -p.z), turnRate * deltaTime);
  return true;
}
