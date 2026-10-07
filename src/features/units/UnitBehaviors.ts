import * as THREE from 'three';
import type { UnitEntity } from './UnitEntity';
import {
  UNIT_GUN_PROJECTILE_SPEED,
  aimAngles,
  applyAttitude,
  driveToward,
  getPart,
  getPartList,
  partWorldPosition,
  predictIntercept,
  refreshSurface,
  settleOnSurface,
  turnToward,
  wrapAngle,
  type UnitWorld,
} from './UnitMotion';
import {
  updateAllyAwacs,
  updateAllyFrigate,
  updateAttackHelicopter,
  updateBomber,
  updateDrone,
  updateRouteFollower,
} from './UnitBehaviorsAir';
import { UnitType } from './UnitTypes';

/**
 * 单位行为（地面 + 海上）与总调度。
 * 每种单位一套独立行为：坦克追踪开炮、导弹车锁定发射、高炮提前量弹幕、雷达旋转、
 * 炮艇蛇形高速机动、护卫舰垂发 + 近防、潜艇潜航 / 上浮循环。空中 / 友军 / 平民见 UnitBehaviorsAir。
 */

const muzzlePos = new THREE.Vector3();
const pivotPos = new THREE.Vector3();
const aimPoint = new THREE.Vector3();
const direction = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** 锁定时间（秒，按关卡冷却倍率缩放的平方根，后期略快） */
const SAM_LOCK_TIME = 2.4;
const FRIGATE_LOCK_TIME = 2.8;
const SUB_LOCK_TIME = 1.7;
const SUB_DEPTH = -8.5;
const SUB_TARGETABLE_DEPTH = -3.5;

export function updateUnitBehavior(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  if (unit.stunTimer > 0) {
    unit.stunTimer = Math.max(0, unit.stunTimer - deltaTime);
    updateStunned(unit, world, deltaTime);
    return;
  }
  switch (unit.type) {
    case UnitType.TANK:
      updateTank(unit, world, deltaTime);
      break;
    case UnitType.SAM_LAUNCHER:
      updateSamLauncher(unit, world, deltaTime);
      break;
    case UnitType.AA_GUN:
      updateAaGun(unit, world, deltaTime);
      break;
    case UnitType.RADAR_STATION:
      updateRadarStation(unit, world, deltaTime);
      break;
    case UnitType.GUNBOAT:
      updateGunboat(unit, world, deltaTime);
      break;
    case UnitType.FRIGATE:
      updateFrigate(unit, world, deltaTime);
      break;
    case UnitType.SUBMARINE:
      updateSubmarine(unit, world, deltaTime);
      break;
    case UnitType.ATTACK_HELICOPTER:
      updateAttackHelicopter(unit, world, deltaTime);
      break;
    case UnitType.BOMBER:
      updateBomber(unit, world, deltaTime);
      break;
    case UnitType.DRONE:
      updateDrone(unit, world, deltaTime);
      break;
    case UnitType.ALLY_FRIGATE:
      updateAllyFrigate(unit, world, deltaTime);
      break;
    case UnitType.ALLY_AWACS:
      updateAllyAwacs(unit, world, deltaTime);
      break;
    case UnitType.ALLY_CONVOY:
    case UnitType.ALLY_TRANSPORT:
    case UnitType.CIVILIAN_AIRLINER:
    case UnitType.CIVILIAN_SHIP:
    case UnitType.CIVILIAN_TRUCK:
      updateRouteFollower(unit, world, deltaTime);
      break;
    default:
      break;
  }
}

/** EMP 瘫痪：停火、停车、锁定中断；无人机断电坠落，其余飞机惯性滑行 */
function updateStunned(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  unit.lockPhase = 'idle';
  unit.burstLeft = 0;
  const p = unit.mesh.position;
  if (unit.domain === 'air') {
    if (unit.type === UnitType.DRONE || unit.type === UnitType.ATTACK_HELICOPTER) {
      unit.velocity.y -= 9.8 * deltaTime * (unit.type === UnitType.DRONE ? 1 : 0.35);
      unit.velocity.x *= 1 - Math.min(1, deltaTime * 0.6);
      unit.velocity.z *= 1 - Math.min(1, deltaTime * 0.6);
      p.addScaledVector(unit.velocity, deltaTime);
      unit.roll += deltaTime * 2.5;
      applyAttitude(unit);
      refreshSurface(unit, world, true);
      if (p.y <= unit.surfaceY + 1.5) {
        world.crash(unit, true);
        return;
      }
    } else {
      p.addScaledVector(unit.velocity, deltaTime);
    }
  } else {
    unit.speed = Math.max(0, unit.speed - 8 * deltaTime);
    p.x += Math.sin(unit.heading) * unit.speed * deltaTime;
    p.z += Math.cos(unit.heading) * unit.speed * deltaTime;
    settleOnSurface(unit, world, deltaTime, unit.type === UnitType.SUBMARINE ? unit.altitude : 0);
    applyAttitude(unit);
  }
  unit.secondaryTimer -= deltaTime;
  if (unit.secondaryTimer <= 0) {
    unit.secondaryTimer = 0.22 + Math.random() * 0.2;
    pivotPos.copy(p);
    pivotPos.y += unit.hitRadius * 0.4;
    pivotPos.x += (Math.random() - 0.5) * unit.hitRadius;
    pivotPos.z += (Math.random() - 0.5) * unit.hitRadius;
    world.muzzleFlash(pivotPos, 0.7);
  }
}

/** 最近的友军单位（按作战域过滤） */
export function nearestAlly(
  unit: UnitEntity,
  world: UnitWorld,
  range: number,
  domains: ReadonlyArray<'ground' | 'sea' | 'air'>
): UnitEntity | null {
  let best: UnitEntity | null = null;
  let bestSq = range * range;
  const p = unit.mesh.position;
  for (const ally of world.allies) {
    if (!ally.isTargetable() || !domains.includes(ally.domain)) continue;
    const d = ally.mesh.position.distanceToSquared(p);
    if (d < bestSq) {
      bestSq = d;
      best = ally;
    }
  }
  return best;
}

function smoothTurretYaw(
  part: THREE.Object3D,
  targetYaw: number,
  rate: number,
  deltaTime: number
): number {
  part.rotation.y = turnToward(part.rotation.y, targetYaw, rate * deltaTime);
  return Math.abs(wrapAngle(targetYaw - part.rotation.y));
}

function smoothPitch(part: THREE.Object3D, pitch: number, rate: number, deltaTime: number): void {
  const current = -part.rotation.x;
  const next =
    current + THREE.MathUtils.clamp(pitch - current, -rate * deltaTime, rate * deltaTime);
  part.rotation.x = -next;
}

function playerDistance(unit: UnitEntity, world: UnitWorld): number {
  return unit.mesh.position.distanceTo(world.playerPosition);
}

// ───────────────────────────── 主战坦克 ─────────────────────────────

function updateTank(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'advance';
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
    unit.fireTimer = 1.5 + unit.seed * 2;
  }
  unit.retargetTimer -= deltaTime;
  if (unit.retargetTimer <= 0) {
    unit.retargetTimer = 1.5;
    unit.targetUnit = nearestAlly(unit, world, 420, ['ground', 'sea']);
  }
  const target = unit.targetUnit && unit.targetUnit.isAlive() ? unit.targetUnit : null;
  const distance = playerDistance(unit, world);
  const engagePlayer = world.playerActive && distance < 440 && world.playerPosition.y - p.y < 300;

  if (target && !engagePlayer) {
    driveToward(
      unit,
      world,
      deltaTime,
      target.mesh.position.x,
      target.mesh.position.z,
      unit.config.speed,
      0.6,
      180
    );
  } else {
    driveToward(
      unit,
      world,
      deltaTime,
      world.playerPosition.x,
      world.playerPosition.z,
      unit.config.speed,
      0.6,
      250
    );
  }
  settleOnSurface(unit, world, deltaTime);
  applyAttitude(unit);

  const turret = getPart(unit, 'turret');
  const barrel = getPart(unit, 'barrel');
  const muzzle = getPart(unit, 'muzzle');
  partWorldPosition(unit, turret, pivotPos, 2.4);
  let hasAim = false;
  if (engagePlayer) {
    predictIntercept(
      pivotPos,
      world.playerPosition,
      world.playerVelocity,
      UNIT_GUN_PROJECTILE_SPEED,
      aimPoint
    );
    hasAim = true;
  } else if (target) {
    aimPoint.copy(target.mesh.position);
    hasAim = true;
  }
  let yawError = Math.PI;
  if (hasAim && turret) {
    const angles = aimAngles(unit, pivotPos, aimPoint);
    yawError = smoothTurretYaw(turret, angles.yaw, 1.3, deltaTime);
    if (barrel)
      smoothPitch(barrel, THREE.MathUtils.clamp(angles.pitch, -0.08, 0.78), 0.9, deltaTime);
  }
  // 后坐复位
  if (barrel) {
    const baseZ =
      (barrel.userData.baseZ as number | undefined) ?? (barrel.userData.baseZ = barrel.position.z);
    unit.recoil = Math.max(0, unit.recoil - deltaTime * 2.5);
    barrel.position.z = baseZ - unit.recoil * 0.7;
  }
  unit.fireTimer -= deltaTime;
  if (unit.fireTimer <= 0 && hasAim && yawError < 0.14) {
    partWorldPosition(unit, muzzle, muzzlePos, 2.6);
    if (engagePlayer) {
      world.fireAtPlayer(unit, muzzlePos, 14 * world.damageMultiplier, 0.018);
    } else if (target) {
      world.fireAtUnit(
        unit,
        'shell',
        muzzlePos,
        target,
        24 * world.damageMultiplier,
        0.55 + world.accuracyBonus,
        150
      );
    }
    world.muzzleFlash(muzzlePos, 1.3);
    unit.recoil = 1;
    unit.fireTimer = (3.2 + unit.seed * 0.8) * world.cooldownMultiplier;
  }
}

// ───────────────────────────── 地空导弹车 ─────────────────────────────

function updateSamLauncher(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  const rack = getPartList(unit, 'rackMissiles');
  if (unit.phase === 'init') {
    unit.phase = 'ready';
    unit.missilesLoaded = rack.length > 0 ? rack.length : 4;
    unit.reloadTimer = 10;
    unit.lockTimer = 1 + unit.seed * 2;
  }
  const distance = playerDistance(unit, world);
  if (world.playerActive && distance > 1100) {
    driveToward(
      unit,
      world,
      deltaTime,
      world.playerPosition.x,
      world.playerPosition.z,
      unit.config.speed,
      0.5,
      900
    );
  } else {
    driveToward(unit, world, deltaTime, p.x, p.z, 0, 0.5, 1);
  }
  settleOnSurface(unit, world, deltaTime);
  applyAttitude(unit);

  // 目标：玩家优先，其次友军空中单位
  let targetPlayer = false;
  let targetUnit: UnitEntity | null = null;
  if (world.playerActive && distance <= 760 && world.playerPosition.y - p.y > 10) {
    targetPlayer = true;
  } else {
    targetUnit = nearestAlly(unit, world, 760, ['air']);
  }
  const alert = (world.playerActive && distance < 950) || targetUnit !== null;
  const launcher = getPart(unit, 'launcher');
  const turret = getPart(unit, 'turret');
  if (launcher) smoothPitch(launcher, alert ? 0.95 : 0, 0.6, deltaTime);
  const elevation = launcher ? -launcher.rotation.x : 0.95;
  if (turret && (targetPlayer || targetUnit)) {
    partWorldPosition(unit, turret, pivotPos, 2);
    aimPoint.copy(targetPlayer ? world.playerPosition : (targetUnit as UnitEntity).mesh.position);
    smoothTurretYaw(turret, aimAngles(unit, pivotPos, aimPoint).yaw, 0.9, deltaTime);
  }

  runLockCycle(unit, world, deltaTime, {
    targetPlayer,
    targetUnit,
    ready: elevation > 0.8 && unit.missilesLoaded > 0,
    lockTime: SAM_LOCK_TIME * Math.sqrt(world.cooldownMultiplier),
    breakRange: 860,
    cooldown: 7.5 * world.cooldownMultiplier,
    fire: (target) => {
      const index = Math.max(0, rack.length - unit.missilesLoaded);
      const part = rack[index] ?? launcher;
      partWorldPosition(unit, part ?? null, muzzlePos, 3);
      if (launcher) {
        launcher.getWorldQuaternion(tmpQuat);
        direction.copy(FORWARD).applyQuaternion(tmpQuat);
      } else {
        direction.copy(UP);
      }
      const launched = world.launchMissile(
        unit,
        muzzlePos,
        direction,
        target,
        36 * world.damageMultiplier,
        {
          maxSpeed: 92,
          turnRate: 1.9,
          life: 9,
          launchSpeed: 42,
        }
      );
      if (launched) {
        if (rack[index]) rack[index].visible = false;
        unit.missilesLoaded--;
        world.muzzleFlash(muzzlePos, 1.4);
      }
      return launched;
    },
  });

  // 再装填：一次一枚
  if (unit.missilesLoaded < rack.length) {
    unit.reloadTimer -= deltaTime;
    if (unit.reloadTimer <= 0) {
      unit.reloadTimer = 10 * world.cooldownMultiplier;
      const index = rack.length - unit.missilesLoaded - 1;
      if (rack[index]) rack[index].visible = true;
      unit.missilesLoaded++;
    }
  }
}

interface LockCycleOptions {
  targetPlayer: boolean;
  targetUnit: UnitEntity | null;
  ready: boolean;
  lockTime: number;
  breakRange: number;
  cooldown: number;
  fire: (target: 'player' | UnitEntity) => boolean;
}

/**
 * 锁定循环：idle → locking（玩家收到 'locking'）→ 发射（'launched'）→ cooldown → idle。
 * 锁定期间目标脱离 breakRange 或失去目标即中断（短暂延迟后重试）。
 */
function runLockCycle(
  unit: UnitEntity,
  world: UnitWorld,
  deltaTime: number,
  options: LockCycleOptions
): void {
  const p = unit.mesh.position;
  switch (unit.lockPhase) {
    case 'idle': {
      if (unit.lockTimer > 0) {
        unit.lockTimer -= deltaTime;
        return;
      }
      if (!options.ready) return;
      if (options.targetPlayer) {
        unit.lockPhase = 'locking';
        unit.lockOnPlayer = true;
        unit.lockTarget = null;
        unit.lockTimer = options.lockTime;
        world.lockWarning(unit, 'locking');
      } else if (options.targetUnit) {
        unit.lockPhase = 'locking';
        unit.lockOnPlayer = false;
        unit.lockTarget = options.targetUnit;
        unit.lockTimer = options.lockTime;
      }
      return;
    }
    case 'locking': {
      const lost = unit.lockOnPlayer
        ? !world.playerActive || p.distanceTo(world.playerPosition) > options.breakRange
        : !unit.lockTarget ||
          !unit.lockTarget.isAlive() ||
          p.distanceTo(unit.lockTarget.mesh.position) > options.breakRange;
      if (lost) {
        unit.lockPhase = 'idle';
        unit.lockTarget = null;
        unit.lockTimer = 1.2;
        return;
      }
      unit.lockTimer -= deltaTime;
      if (unit.lockTimer > 0) return;
      const target: 'player' | UnitEntity = unit.lockOnPlayer
        ? 'player'
        : (unit.lockTarget as UnitEntity);
      const launched = options.fire(target);
      if (launched && unit.lockOnPlayer) world.lockWarning(unit, 'launched');
      unit.lockPhase = 'cooldown';
      unit.lockTimer = launched ? options.cooldown : 2;
      unit.lockTarget = null;
      return;
    }
    default: {
      unit.lockTimer -= deltaTime;
      if (unit.lockTimer <= 0) {
        unit.lockPhase = 'idle';
        unit.lockTimer = 0;
      }
    }
  }
}

// ───────────────────────────── 双联高炮 ─────────────────────────────

function updateAaGun(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'ready';
    unit.fireTimer = 0.8 + unit.seed * 1.5;
    settleOnSurface(unit, world, deltaTime);
  }
  unit.velocity.set(0, 0, 0);
  settleOnSurface(unit, world, deltaTime);
  applyAttitude(unit);
  const turret = getPart(unit, 'turret');
  const barrel = getPart(unit, 'barrel');
  const muzzles = getPartList(unit, 'muzzles');
  partWorldPosition(unit, barrel ?? turret, pivotPos, 2.2);

  const distance = playerDistance(unit, world);
  const elevation = Math.atan2(
    world.playerPosition.y - pivotPos.y,
    Math.max(1, Math.hypot(world.playerPosition.x - p.x, world.playerPosition.z - p.z))
  );
  const engagePlayer = world.playerActive && distance < 560 && elevation > 0.04;
  let target: UnitEntity | null = null;
  if (engagePlayer) {
    predictIntercept(
      pivotPos,
      world.playerPosition,
      world.playerVelocity,
      UNIT_GUN_PROJECTILE_SPEED,
      aimPoint
    );
  } else {
    target = nearestAlly(unit, world, 520, ['air']);
    if (target) aimPoint.copy(target.mesh.position);
  }
  let yawError = Math.PI;
  if ((engagePlayer || target) && turret) {
    const angles = aimAngles(unit, pivotPos, aimPoint);
    yawError = smoothTurretYaw(turret, angles.yaw, 2.2, deltaTime);
    if (barrel) smoothPitch(barrel, THREE.MathUtils.clamp(angles.pitch, 0, 1.35), 1.6, deltaTime);
  }
  unit.fireTimer -= deltaTime;
  if (unit.fireTimer <= 0 && unit.burstLeft <= 0 && (engagePlayer || target) && yawError < 0.16) {
    unit.burstLeft = 6;
    unit.burstTimer = 0;
    unit.fireTimer = 2.1 * world.cooldownMultiplier;
    if (engagePlayer) {
      // 高炮爆烟：落在预测点周围，制造压迫感（纯视觉）
      for (let i = 0; i < 2; i++) {
        muzzlePos.set(
          aimPoint.x + (Math.random() - 0.5) * 50,
          aimPoint.y + (Math.random() - 0.3) * 30,
          aimPoint.z + (Math.random() - 0.5) * 50
        );
        if (muzzlePos.distanceTo(world.playerPosition) > 14) world.flakPuff(muzzlePos, 1);
      }
    }
  }
  if (unit.burstLeft > 0) {
    unit.burstTimer -= deltaTime;
    if (unit.burstTimer <= 0) {
      unit.burstTimer = 0.085;
      unit.burstLeft--;
      const part = muzzles.length > 0 ? muzzles[unit.muzzleIndex++ % muzzles.length] : barrel;
      partWorldPosition(unit, part ?? null, muzzlePos, 3);
      if (engagePlayer) {
        world.fireAtPlayer(unit, muzzlePos, 3.5 * world.damageMultiplier, 0.03);
      } else if (target) {
        world.fireAtUnit(
          unit,
          'tracer',
          muzzlePos,
          target,
          5 * world.damageMultiplier,
          0.35 + world.accuracyBonus,
          170
        );
      }
      world.muzzleFlash(muzzlePos, 0.7);
    }
  }
}

// ───────────────────────────── 雷达站 ─────────────────────────────

function updateRadarStation(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  unit.velocity.set(0, 0, 0);
  settleOnSurface(unit, world, deltaTime);
  applyAttitude(unit);
  const dish = getPart(unit, 'dish');
  if (dish) dish.rotation.y += deltaTime * 1.1;
}

// ───────────────────────────── 高速炮艇 ─────────────────────────────

function updateWake(unit: UnitEntity, speedRatio: number, depthOffset = 0): void {
  const wake = getPart(unit, 'wake');
  if (wake) {
    wake.visible = speedRatio > 0.05;
    wake.scale.set(0.8 + speedRatio * 0.4, 1, 0.3 + speedRatio * 0.9);
    wake.position.y = 0.08 - depthOffset;
  }
  const bow = getPart(unit, 'bowWake');
  if (bow) {
    bow.visible = speedRatio > 0.25 && depthOffset > -2;
    bow.scale.setScalar(0.6 + speedRatio * 0.6);
  }
}

function updateGunboat(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'patrol';
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
    unit.orbitRadius = 300 + unit.seed * 140;
    unit.fireTimer = 1 + unit.seed;
  }
  unit.retargetTimer -= deltaTime;
  if (unit.retargetTimer <= 0) {
    unit.retargetTimer = 2;
    unit.targetUnit = nearestAlly(unit, world, 700, ['sea', 'ground']);
  }
  const distance = playerDistance(unit, world);
  const allyTarget = unit.targetUnit && unit.targetUnit.isAlive() ? unit.targetUnit : null;
  const huntAlly = allyTarget !== null && (!world.playerActive || distance > 800);
  const cx = huntAlly ? (allyTarget as UnitEntity).mesh.position.x : world.playerPosition.x;
  const cz = huntAlly ? (allyTarget as UnitEntity).mesh.position.z : world.playerPosition.z;
  const angle = Math.atan2(p.z - cz, p.x - cx) + unit.orbitDirection * 0.5;
  const radius = huntAlly ? 220 : unit.orbitRadius;
  driveToward(
    unit,
    world,
    deltaTime,
    cx + Math.cos(angle) * radius,
    cz + Math.sin(angle) * radius,
    unit.config.speed,
    1.2,
    0
  );
  // 蛇形机动
  unit.heading = wrapAngle(
    unit.heading + Math.sin(world.time * 1.7 + unit.seed * 7) * 0.9 * deltaTime
  );
  settleOnSurface(unit, world, deltaTime);
  const speedRatio = THREE.MathUtils.clamp(unit.speed / Math.max(1, unit.config.speed), 0, 1);
  unit.pitch += 0.05 * speedRatio;
  applyAttitude(unit);
  updateWake(unit, speedRatio);
  const radar = getPart(unit, 'radar');
  if (radar) radar.rotation.y += deltaTime * 3;

  const turret = getPart(unit, 'turret');
  const muzzle = getPart(unit, 'muzzle');
  partWorldPosition(unit, turret, pivotPos, 2);
  const engagePlayer = world.playerActive && distance < 460;
  const shootAlly =
    !engagePlayer && allyTarget !== null && p.distanceTo(allyTarget.mesh.position) < 460;
  if (engagePlayer) {
    predictIntercept(
      pivotPos,
      world.playerPosition,
      world.playerVelocity,
      UNIT_GUN_PROJECTILE_SPEED,
      aimPoint
    );
  } else if (shootAlly && allyTarget) {
    aimPoint.copy(allyTarget.mesh.position);
  }
  let yawError = Math.PI;
  if (turret && (engagePlayer || shootAlly)) {
    yawError = smoothTurretYaw(turret, aimAngles(unit, pivotPos, aimPoint).yaw, 2.5, deltaTime);
  }
  unit.fireTimer -= deltaTime;
  if (
    unit.fireTimer <= 0 &&
    unit.burstLeft <= 0 &&
    (engagePlayer || shootAlly) &&
    yawError < 0.25
  ) {
    unit.burstLeft = 3;
    unit.burstTimer = 0;
    unit.fireTimer = 1.6 * world.cooldownMultiplier;
  }
  if (unit.burstLeft > 0) {
    unit.burstTimer -= deltaTime;
    if (unit.burstTimer <= 0) {
      unit.burstTimer = 0.13;
      unit.burstLeft--;
      partWorldPosition(unit, muzzle, muzzlePos, 2.5);
      if (engagePlayer) {
        world.fireAtPlayer(unit, muzzlePos, 4.5 * world.damageMultiplier, 0.03);
      } else if (allyTarget) {
        world.fireAtUnit(
          unit,
          'tracer',
          muzzlePos,
          allyTarget,
          7 * world.damageMultiplier,
          0.5 + world.accuracyBonus,
          180
        );
      }
      world.muzzleFlash(muzzlePos, 0.8);
    }
  }
}

// ───────────────────────────── 导弹护卫舰 ─────────────────────────────

function updateFrigate(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'patrol';
    unit.anchor.copy(p);
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
    unit.orbitRadius = 240;
    unit.fireTimer = 2 + unit.seed * 2;
    unit.lockTimer = 2 + unit.seed * 3;
  }
  const distance = playerDistance(unit, world);
  if (world.playerActive && distance > 950) {
    driveToward(
      unit,
      world,
      deltaTime,
      world.playerPosition.x,
      world.playerPosition.z,
      unit.config.speed,
      0.25,
      500
    );
  } else {
    const angle = Math.atan2(p.z - unit.anchor.z, p.x - unit.anchor.x) + unit.orbitDirection * 0.35;
    driveToward(
      unit,
      world,
      deltaTime,
      unit.anchor.x + Math.cos(angle) * unit.orbitRadius,
      unit.anchor.z + Math.sin(angle) * unit.orbitRadius,
      unit.config.speed * 0.7,
      0.25,
      0
    );
  }
  settleOnSurface(unit, world, deltaTime);
  applyAttitude(unit);
  updateWake(unit, THREE.MathUtils.clamp(unit.speed / Math.max(1, unit.config.speed), 0, 1));
  const radar = getPart(unit, 'radar');
  if (radar) radar.rotation.y += deltaTime * 1.6;

  unit.retargetTimer -= deltaTime;
  if (unit.retargetTimer <= 0) {
    unit.retargetTimer = 2;
    unit.targetUnit = nearestAlly(unit, world, 800, ['sea', 'air']);
  }
  const allyTarget = unit.targetUnit && unit.targetUnit.isAlive() ? unit.targetUnit : null;
  const engagePlayer = world.playerActive && distance < 560;

  // 主炮
  const turret = getPart(unit, 'turret');
  partWorldPosition(unit, turret, pivotPos, 4);
  if (engagePlayer) {
    predictIntercept(
      pivotPos,
      world.playerPosition,
      world.playerVelocity,
      UNIT_GUN_PROJECTILE_SPEED,
      aimPoint
    );
  } else if (allyTarget && allyTarget.domain === 'sea') {
    aimPoint.copy(allyTarget.mesh.position);
  }
  const hasGunTarget = engagePlayer || (allyTarget !== null && allyTarget.domain === 'sea');
  let yawError = Math.PI;
  if (turret && hasGunTarget) {
    yawError = smoothTurretYaw(turret, aimAngles(unit, pivotPos, aimPoint).yaw, 1.0, deltaTime);
  }
  unit.fireTimer -= deltaTime;
  if (unit.fireTimer <= 0 && hasGunTarget && yawError < 0.2) {
    unit.fireTimer = 2.8 * world.cooldownMultiplier;
    partWorldPosition(unit, getPart(unit, 'muzzle'), muzzlePos, 4);
    if (engagePlayer) {
      world.fireAtPlayer(unit, muzzlePos, 9 * world.damageMultiplier, 0.022);
    } else if (allyTarget) {
      world.fireAtUnit(
        unit,
        'shell',
        muzzlePos,
        allyTarget,
        28 * world.damageMultiplier,
        0.5 + world.accuracyBonus,
        150
      );
    }
    world.muzzleFlash(muzzlePos, 1.4);
  }

  // 近防炮：近距离高射速弹幕
  const ciws = getPart(unit, 'ciws');
  if (ciws && world.playerActive && distance < 320) {
    partWorldPosition(unit, ciws, pivotPos, 6);
    predictIntercept(
      pivotPos,
      world.playerPosition,
      world.playerVelocity,
      UNIT_GUN_PROJECTILE_SPEED,
      aimPoint
    );
    smoothTurretYaw(ciws, aimAngles(unit, pivotPos, aimPoint).yaw, 4, deltaTime);
    unit.secondaryTimer -= deltaTime;
    if (unit.secondaryTimer <= 0 && unit.burstLeft <= 0) {
      unit.burstLeft = 10;
      unit.burstTimer = 0;
      unit.secondaryTimer = 1.5 * world.cooldownMultiplier;
    }
  }
  if (unit.burstLeft > 0) {
    unit.burstTimer -= deltaTime;
    if (unit.burstTimer <= 0) {
      unit.burstTimer = 0.05;
      unit.burstLeft--;
      partWorldPosition(unit, getPart(unit, 'ciws'), muzzlePos, 6);
      if (world.playerActive)
        world.fireAtPlayer(unit, muzzlePos, 2.2 * world.damageMultiplier, 0.05);
    }
  }

  // 垂直发射防空导弹
  const vls = getPart(unit, 'vls');
  const lockAlly = !engagePlayer && allyTarget !== null && allyTarget.domain !== 'ground';
  runLockCycle(unit, world, deltaTime, {
    targetPlayer: world.playerActive && distance < 780,
    targetUnit: lockAlly ? allyTarget : null,
    ready: true,
    lockTime: FRIGATE_LOCK_TIME * Math.sqrt(world.cooldownMultiplier),
    breakRange: 900,
    cooldown: 9.5 * world.cooldownMultiplier,
    fire: (target) => {
      partWorldPosition(unit, vls, muzzlePos, 5);
      direction.copy(UP);
      const launched = world.launchMissile(
        unit,
        muzzlePos,
        direction,
        target,
        32 * world.damageMultiplier,
        {
          maxSpeed: 88,
          turnRate: 1.75,
          life: 10,
          launchSpeed: 30,
          boostUpTime: 0.45,
        }
      );
      if (launched) world.muzzleFlash(muzzlePos, 1.6);
      return launched;
    },
  });
}

// ───────────────────────────── 攻击潜艇 ─────────────────────────────

function updateSubmarine(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'submerged';
    unit.phaseTimer = 3 + unit.seed * 5;
    unit.altitude = SUB_DEPTH;
    unit.targetable = false;
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
  }
  const distance = playerDistance(unit, world);
  // 在玩家周围 ~380 米游弋
  const dx = p.x - world.playerPosition.x;
  const dz = p.z - world.playerPosition.z;
  const angle = Math.atan2(dz, dx) + unit.orbitDirection * 0.3;
  const surfaced = unit.phase === 'surfaced';
  driveToward(
    unit,
    world,
    deltaTime,
    world.playerPosition.x + Math.cos(angle) * 380,
    world.playerPosition.z + Math.sin(angle) * 380,
    surfaced ? unit.config.speed * 0.4 : unit.config.speed,
    0.35,
    0
  );

  unit.phaseTimer -= deltaTime;
  switch (unit.phase) {
    case 'submerged': {
      unit.altitude = SUB_DEPTH;
      const allyNear = nearestAlly(unit, world, 900, ['sea']) !== null;
      if (unit.phaseTimer <= 0 && ((world.playerActive && distance < 1000) || allyNear)) {
        unit.phase = 'surfacing';
        unit.phaseTimer = 2.2;
        unit.secondaryTimer = 0;
      }
      break;
    }
    case 'surfacing': {
      unit.altitude = SUB_DEPTH * Math.max(0, unit.phaseTimer / 2.2);
      unit.secondaryTimer -= deltaTime;
      if (unit.secondaryTimer <= 0) {
        unit.secondaryTimer = 0.3;
        muzzlePos.copy(p).setY(unit.surfaceY + 0.5);
        muzzlePos.x += (Math.random() - 0.5) * 18;
        muzzlePos.z += (Math.random() - 0.5) * 18;
        world.splash(muzzlePos, 1.6);
      }
      if (unit.phaseTimer <= 0) {
        unit.phase = 'surfaced';
        unit.phaseTimer = 8.5 + unit.seed * 2;
        unit.missilesLoaded = 2;
        unit.lockPhase = 'idle';
        unit.lockTimer = 0.6;
      }
      break;
    }
    case 'surfaced': {
      unit.altitude = 0;
      if (unit.phaseTimer <= 0 && unit.lockPhase !== 'locking') {
        unit.phase = 'diving';
        unit.phaseTimer = 2.2;
        unit.secondaryTimer = 0;
      }
      break;
    }
    case 'diving': {
      unit.altitude = SUB_DEPTH * (1 - Math.max(0, unit.phaseTimer / 2.2));
      unit.secondaryTimer -= deltaTime;
      if (unit.secondaryTimer <= 0) {
        unit.secondaryTimer = 0.4;
        muzzlePos.copy(p).setY(unit.surfaceY + 0.5);
        muzzlePos.z += (Math.random() - 0.5) * 20;
        world.splash(muzzlePos, 1.1);
      }
      if (unit.phaseTimer <= 0) {
        unit.phase = 'submerged';
        unit.phaseTimer = 9 + unit.seed * 4;
      }
      break;
    }
    default:
      break;
  }
  unit.targetable = unit.altitude > SUB_TARGETABLE_DEPTH;
  settleOnSurface(unit, world, deltaTime, unit.altitude);
  applyAttitude(unit);
  updateWake(
    unit,
    THREE.MathUtils.clamp(unit.speed / Math.max(1, unit.config.speed), 0, 1),
    p.y - unit.surfaceY
  );
  const prop = getPart(unit, 'prop');
  if (prop) prop.rotation.z += deltaTime * (2 + unit.speed);

  if (unit.phase === 'surfaced') {
    const allyShip = nearestAlly(unit, world, 900, ['sea']);
    runLockCycle(unit, world, deltaTime, {
      targetPlayer: world.playerActive && distance < 820,
      targetUnit: allyShip,
      ready: unit.missilesLoaded > 0,
      lockTime: SUB_LOCK_TIME * Math.sqrt(world.cooldownMultiplier),
      breakRange: 950,
      cooldown: 3,
      fire: (target) => {
        muzzlePos.copy(p);
        muzzlePos.y += 2.5;
        direction.set(Math.sin(unit.heading) * 0.15, 1, Math.cos(unit.heading) * 0.15).normalize();
        const launched = world.launchMissile(
          unit,
          muzzlePos,
          direction,
          target,
          30 * world.damageMultiplier,
          {
            maxSpeed: 84,
            turnRate: 1.6,
            life: 9,
            launchSpeed: 26,
            boostUpTime: 0.55,
          }
        );
        if (launched) {
          unit.missilesLoaded--;
          world.splash(muzzlePos, 1.2);
        }
        return launched;
      },
    });
  } else if (unit.lockPhase === 'locking') {
    unit.lockPhase = 'idle';
  }
}
