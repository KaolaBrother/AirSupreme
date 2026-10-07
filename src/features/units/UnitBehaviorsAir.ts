import * as THREE from 'three';
import type { UnitEntity } from './UnitEntity';
import {
  aimAngles,
  applyAttitude,
  driveToward,
  flyToward,
  followRoute,
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
import { UNIT_BATTLEFIELD_LIMIT } from './UnitPlacement';
import { UnitType } from './UnitTypes';

/**
 * 单位行为（空中 + 友军 + 平民）：
 * - 武装直升机：贴地接近、绕玩家侧滑扫射、火箭巢齐射 + 机炮；
 * - 战略轰炸机：高空直线航路、对友军地面 / 海上单位投弹、尾炮自卫；
 * - 自杀无人机：编队巡航 → 末段俯冲撞击；
 * - 友军护卫舰：近防拦截导弹、对空射击、主炮反舰；友军预警机：盘旋；
 * - 护送目标 / 平民：沿航线行进，抵达或驶出后离场。
 */

const muzzlePos = new THREE.Vector3();
const aimPoint = new THREE.Vector3();
const repulse = new THREE.Vector3();
const tmp = new THREE.Vector3();

function spinParts(
  unit: UnitEntity,
  key: string,
  axis: 'x' | 'y' | 'z',
  speed: number,
  deltaTime: number
): void {
  const parts = getPartList(unit, key);
  for (let i = 0; i < parts.length; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    parts[i].rotation[axis] += speed * direction * deltaTime;
  }
}

function nearestAllyOf(
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

// ───────────────────────────── 武装直升机 ─────────────────────────────

export function updateAttackHelicopter(
  unit: UnitEntity,
  world: UnitWorld,
  deltaTime: number
): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'approach';
    unit.altitude = 45 + unit.seed * 25;
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
    unit.orbitRadius = 280 + unit.seed * 70;
    unit.phaseTimer = 6 + unit.seed * 3;
    unit.fireTimer = 1.5 + unit.seed * 2;
  }
  refreshSurface(unit, world);
  unit.retargetTimer -= deltaTime;
  if (unit.retargetTimer <= 0) {
    unit.retargetTimer = 1.5;
    unit.targetUnit = nearestAllyOf(unit, world, 700, ['ground', 'air', 'sea']);
  }
  const ally = unit.targetUnit && unit.targetUnit.isAlive() ? unit.targetUnit : null;
  const distance = p.distanceTo(world.playerPosition);
  const huntAlly = ally !== null && (!world.playerActive || distance > 650);
  const center = huntAlly ? (ally as UnitEntity).mesh.position : world.playerPosition;
  const playerHigh = world.playerPosition.y > unit.surfaceY + 140 ? 25 : 0;
  const targetAlt = unit.surfaceY + unit.altitude + playerHigh;
  const dx = center.x - p.x;
  const dz = center.z - p.z;
  const horizontal = Math.hypot(dx, dz);

  unit.phaseTimer -= deltaTime;
  if (unit.phaseTimer <= 0) {
    unit.phaseTimer = 6 + Math.random() * 4;
    unit.orbitDirection *= -1;
  }

  if (horizontal > 420) {
    unit.phase = 'approach';
    flyToward(unit, deltaTime, center.x, targetAlt, center.z, unit.config.speed, 1.1, 12, 0.45);
    unit.pitch = -0.14;
  } else {
    // 绕目标侧滑：机头始终指向目标
    unit.phase = 'strafe';
    const angle = Math.atan2(p.z - center.z, p.x - center.x) + unit.orbitDirection * 0.4;
    const radius = huntAlly ? 200 : unit.orbitRadius;
    const tx = center.x + Math.cos(angle) * radius;
    const tz = center.z + Math.sin(angle) * radius;
    const mx = tx - p.x;
    const mz = tz - p.z;
    const len = Math.hypot(mx, mz) || 1;
    const strafeSpeed = unit.config.speed * 0.55;
    const stepX = (mx / len) * strafeSpeed * deltaTime;
    const stepZ = (mz / len) * strafeSpeed * deltaTime;
    const dy = THREE.MathUtils.clamp(targetAlt - p.y, -10 * deltaTime, 10 * deltaTime);
    p.x += stepX;
    p.y += dy;
    p.z += stepZ;
    if (deltaTime > 0) unit.velocity.set(stepX / deltaTime, dy / deltaTime, stepZ / deltaTime);
    unit.heading = turnToward(unit.heading, Math.atan2(dx, dz), 1.6 * deltaTime);
    // 侧向速度 → 横滚，前向速度 → 低头
    const right =
      Math.sin(unit.heading - Math.PI / 2) * unit.velocity.x +
      Math.cos(unit.heading - Math.PI / 2) * unit.velocity.z;
    const forward =
      Math.sin(unit.heading) * unit.velocity.x + Math.cos(unit.heading) * unit.velocity.z;
    unit.roll +=
      (THREE.MathUtils.clamp(right * 0.012, -0.3, 0.3) - unit.roll) * Math.min(1, deltaTime * 3);
    unit.pitch +=
      (THREE.MathUtils.clamp(-forward * 0.008, -0.2, 0.2) - unit.pitch) *
      Math.min(1, deltaTime * 3);
  }
  if (p.y < unit.surfaceY + 18) p.y = unit.surfaceY + 18;
  applyAttitude(unit);
  const mainRotor = getPart(unit, 'mainRotor');
  if (mainRotor) mainRotor.rotation.y += deltaTime * 28;
  const tailRotor = getPart(unit, 'tailRotor');
  if (tailRotor) tailRotor.rotation.x += deltaTime * 42;

  // 火箭齐射（机头大致指向目标时）
  const engagePlayer = world.playerActive && !huntAlly && distance < 500;
  const engageAlly = huntAlly && ally !== null && p.distanceTo(ally.mesh.position) < 480;
  const facing = Math.abs(wrapAngle(Math.atan2(dx, dz) - unit.heading)) < 0.45;
  const pods = getPartList(unit, 'muzzles');
  unit.fireTimer -= deltaTime;
  if (unit.fireTimer <= 0 && unit.burstLeft <= 0 && (engagePlayer || engageAlly) && facing) {
    unit.burstLeft = 4;
    unit.burstTimer = 0;
    unit.fireTimer = 3.8 * world.cooldownMultiplier;
  }
  if (unit.burstLeft > 0) {
    unit.burstTimer -= deltaTime;
    if (unit.burstTimer <= 0) {
      unit.burstTimer = 0.13;
      unit.burstLeft--;
      const pod = pods.length > 0 ? pods[unit.muzzleIndex++ % pods.length] : null;
      partWorldPosition(unit, pod, muzzlePos, -0.6);
      if (engagePlayer) {
        world.fireAtPlayer(unit, muzzlePos, 7 * world.damageMultiplier, 0.035);
      } else if (ally) {
        world.fireAtUnit(
          unit,
          'rocket',
          muzzlePos,
          ally,
          14 * world.damageMultiplier,
          0.55 + world.accuracyBonus,
          140
        );
      }
      world.muzzleFlash(muzzlePos, 0.8);
    }
  }
  // 机炮：近距离点射
  unit.secondaryTimer -= deltaTime;
  if (engagePlayer && distance < 270 && unit.secondaryTimer <= 0) {
    unit.secondaryTimer = 0.32 * world.cooldownMultiplier;
    partWorldPosition(unit, getPart(unit, 'chinGun'), muzzlePos, -1);
    world.fireAtPlayer(unit, muzzlePos, 2.5 * world.damageMultiplier, 0.05);
  }
}

// ───────────────────────────── 战略轰炸机 ─────────────────────────────

export function updateBomber(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'cruise';
    unit.altitude = p.y;
    unit.speed = unit.config.speed;
    unit.secondaryTimer = 3;
    unit.fireTimer = 1;
    const first =
      nearestAllyOf(unit, world, 4000, ['ground', 'sea']) ??
      nearestAllyOf(unit, world, 4000, ['air']);
    const tx = first ? first.mesh.position.x : world.playerPosition.x;
    const tz = first ? first.mesh.position.z : world.playerPosition.z;
    unit.heading = Math.atan2(tx - p.x, tz - p.z);
  }
  unit.retargetTimer -= deltaTime;
  if (unit.retargetTimer <= 0) {
    unit.retargetTimer = 3;
    unit.targetUnit =
      nearestAllyOf(unit, world, 4000, ['ground', 'sea']) ??
      nearestAllyOf(unit, world, 4000, ['air']);
  }
  const target = unit.targetUnit && unit.targetUnit.isAlive() ? unit.targetUnit : null;
  // 航路：越界则大半径掉头，否则缓慢对准目标（轰炸机不做急转）
  let desiredHeading = unit.heading;
  let turnRate = 0.16;
  if (Math.abs(p.x) > UNIT_BATTLEFIELD_LIMIT || Math.abs(p.z) > UNIT_BATTLEFIELD_LIMIT) {
    desiredHeading = Math.atan2(-p.x, -p.z);
    turnRate = 0.3;
  } else {
    const tx = target ? target.mesh.position.x : world.playerPosition.x;
    const tz = target ? target.mesh.position.z : world.playerPosition.z;
    const bearing = Math.atan2(tx - p.x, tz - p.z);
    // 已越过目标：保持直线飞到边界再掉头，形成往复航线
    if (Math.hypot(tx - p.x, tz - p.z) > 150 && Math.abs(wrapAngle(bearing - unit.heading)) < 1.4) {
      desiredHeading = bearing;
    }
  }
  flyToward(
    unit,
    deltaTime,
    p.x + Math.sin(desiredHeading) * 300,
    unit.altitude,
    p.z + Math.cos(desiredHeading) * 300,
    unit.config.speed,
    turnRate,
    4,
    1.4
  );
  applyAttitude(unit);
  spinParts(unit, 'props', 'z', 24, deltaTime);

  // 投弹：预测落点接近友军单位时投下一串炸弹
  const bombBay = getPart(unit, 'bombBay');
  if (unit.burstLeft > 0) {
    unit.burstTimer -= deltaTime;
    if (unit.burstTimer <= 0) {
      unit.burstTimer = 0.24;
      unit.burstLeft--;
      partWorldPosition(unit, bombBay, muzzlePos, -2.5);
      world.dropBomb(unit, muzzlePos, unit.velocity, 55 * world.damageMultiplier, 24);
    }
  } else {
    unit.secondaryTimer -= deltaTime;
    if (unit.secondaryTimer <= 0 && shouldDropBombs(unit, world)) {
      unit.burstLeft = 4;
      unit.burstTimer = 0;
      unit.secondaryTimer = 6 * world.cooldownMultiplier;
    }
  }

  // 尾炮：玩家从后方接近时自卫
  const distance = p.distanceTo(world.playerPosition);
  tmp.subVectors(world.playerPosition, p);
  const behind =
    tmp.x * Math.sin(unit.heading) + tmp.z * Math.cos(unit.heading) < -0.2 * tmp.length();
  unit.fireTimer -= deltaTime;
  if (world.playerActive && distance < 340 && behind) {
    if (unit.fireTimer <= 0) {
      unit.fireTimer = 0.11;
      unit.muzzleIndex++;
      if (unit.muzzleIndex % 6 === 0) unit.fireTimer = 1.4 * world.cooldownMultiplier;
      partWorldPosition(unit, getPart(unit, 'muzzle'), muzzlePos, 0);
      world.fireAtPlayer(unit, muzzlePos, 3 * world.damageMultiplier, 0.04);
    }
  } else if (
    target &&
    target.domain === 'air' &&
    p.distanceTo(target.mesh.position) < 260 &&
    unit.fireTimer <= 0
  ) {
    unit.fireTimer = 0.5;
    partWorldPosition(unit, getPart(unit, 'muzzle'), muzzlePos, 0);
    world.fireAtUnit(
      unit,
      'tracer',
      muzzlePos,
      target,
      5 * world.damageMultiplier,
      0.4 + world.accuracyBonus,
      170
    );
  }
}

function shouldDropBombs(unit: UnitEntity, world: UnitWorld): boolean {
  const p = unit.mesh.position;
  for (const ally of world.allies) {
    if (!ally.isTargetable() || ally.domain === 'air') continue;
    const drop = Math.max(1, p.y - ally.mesh.position.y);
    const fall = Math.sqrt((2 * drop) / 9.8);
    const ix = p.x + unit.velocity.x * fall;
    const iz = p.z + unit.velocity.z * fall;
    const ax = ally.mesh.position.x + ally.velocity.x * fall;
    const az = ally.mesh.position.z + ally.velocity.z * fall;
    if (Math.hypot(ix - ax, iz - az) < 40 + ally.hitRadius) return true;
  }
  // 玩家在机腹下方
  if (world.playerActive) {
    const dy = p.y - world.playerPosition.y;
    const horizontal = Math.hypot(p.x - world.playerPosition.x, p.z - world.playerPosition.z);
    if (dy > 25 && dy < 320 && horizontal < 45) return true;
  }
  return false;
}

// ───────────────────────────── 自杀无人机 ─────────────────────────────

export function updateDrone(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'cruise';
    unit.speed = unit.config.speed;
    unit.orbitAngle = unit.seed * Math.PI * 2;
  }
  refreshSurface(unit, world);
  unit.retargetTimer -= deltaTime;
  if (unit.retargetTimer <= 0) {
    unit.retargetTimer = 1;
    const ally = nearestAllyOf(unit, world, 600, ['air']);
    const playerDistance = p.distanceTo(world.playerPosition);
    unit.targetUnit =
      ally && (!world.playerActive || p.distanceTo(ally.mesh.position) < playerDistance * 0.7)
        ? ally
        : null;
  }
  const ally = unit.targetUnit && unit.targetUnit.isAlive() ? unit.targetUnit : null;
  if (!ally && !world.playerActive) {
    // 无目标：原地盘旋待命
    unit.orbitAngle += deltaTime * 0.5;
    flyToward(
      unit,
      deltaTime,
      p.x + Math.cos(unit.orbitAngle) * 80,
      Math.max(p.y, unit.surfaceY + 60),
      p.z + Math.sin(unit.orbitAngle) * 80,
      unit.config.speed * 0.6,
      1,
      8
    );
    applyAttitude(unit);
    spinParts(unit, 'props', 'z', 60, deltaTime);
    return;
  }
  const targetPos = ally ? ally.mesh.position : world.playerPosition;
  const targetVel = ally ? ally.velocity : world.playerVelocity;
  const distance = p.distanceTo(targetPos);
  const diving = distance < 320;
  unit.phase = diving ? 'dive' : 'cruise';
  const speed = diving ? unit.config.speed * 1.25 : unit.config.speed;
  if (diving) {
    predictIntercept(p, targetPos, targetVel, speed, aimPoint);
  } else {
    // 编队槽位：围绕目标方向错开
    const slot = unit.seed * Math.PI * 2;
    aimPoint.set(
      targetPos.x + Math.cos(slot) * 60,
      targetPos.y + 20 + unit.seed * 30,
      targetPos.z + Math.sin(slot) * 60
    );
  }
  // 群体分离
  repulse.set(0, 0, 0);
  for (const other of world.hostiles) {
    if (other === unit || other.type !== UnitType.DRONE) continue;
    const d = other.mesh.position.distanceTo(p);
    if (d < 14 && d > 0.01) {
      tmp.subVectors(p, other.mesh.position).multiplyScalar((14 - d) / d);
      repulse.add(tmp);
    }
  }
  aimPoint.addScaledVector(repulse, 2.5);
  aimPoint.y = Math.max(aimPoint.y, unit.surfaceY + 18);
  flyToward(
    unit,
    deltaTime,
    aimPoint.x,
    aimPoint.y,
    aimPoint.z,
    speed,
    diving ? 2.6 : 1.4,
    diving ? 34 : 14,
    0.9
  );
  applyAttitude(unit);
  spinParts(unit, 'props', 'z', 60, deltaTime);

  if (ally) {
    if (p.distanceTo(ally.mesh.position) < ally.hitRadius + 3) {
      world.kamikazeUnit(unit, ally, 70 * world.damageMultiplier);
      return;
    }
  } else if (distance < 7) {
    world.kamikazePlayer(unit, 26 * world.damageMultiplier);
    return;
  }
  if (p.y < unit.surfaceY + 2) {
    world.crash(unit, false);
  }
}

// ───────────────────────────── 友军护卫舰 ─────────────────────────────

export function updateAllyFrigate(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'patrol';
    unit.anchor.copy(p);
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
    unit.orbitRadius = 200;
    unit.fireTimer = 1;
  }
  const angle = Math.atan2(p.z - unit.anchor.z, p.x - unit.anchor.x) + unit.orbitDirection * 0.35;
  driveToward(
    unit,
    world,
    deltaTime,
    unit.anchor.x + Math.cos(angle) * unit.orbitRadius,
    unit.anchor.z + Math.sin(angle) * unit.orbitRadius,
    unit.config.speed * 0.6,
    0.22,
    0
  );
  settleOnSurface(unit, world, deltaTime);
  applyAttitude(unit);
  const wake = getPart(unit, 'wake');
  if (wake)
    wake.scale.set(1, 1, 0.3 + 0.6 * THREE.MathUtils.clamp(unit.speed / unit.config.speed, 0, 1));
  const radar = getPart(unit, 'radar');
  if (radar) radar.rotation.y += deltaTime * 1.4;
  const ciws = getPart(unit, 'ciws');
  const turret = getPart(unit, 'turret');

  // 近防：拦截来袭导弹
  unit.secondaryTimer -= deltaTime;
  if (unit.secondaryTimer <= 0) {
    unit.secondaryTimer = 0.3;
    if (world.findNearestMissile(p, 340, aimPoint)) {
      partWorldPosition(unit, ciws, muzzlePos, 8);
      if (ciws) ciws.rotation.y = aimAngles(unit, muzzlePos, aimPoint).yaw;
      world.visualTracer(muzzlePos, aimPoint);
      world.interceptMissiles(p, 340, 0.22);
    } else {
      // 对空：最近的敌方空中单位
      let best: UnitEntity | null = null;
      let bestSq = 650 * 650;
      for (const hostile of world.hostiles) {
        if (hostile.domain !== 'air') continue;
        const d = hostile.mesh.position.distanceToSquared(p);
        if (d < bestSq) {
          bestSq = d;
          best = hostile;
        }
      }
      if (best) {
        partWorldPosition(unit, ciws, muzzlePos, 8);
        if (ciws) ciws.rotation.y = aimAngles(unit, muzzlePos, best.mesh.position).yaw;
        world.fireAtUnit(
          unit,
          'tracer',
          muzzlePos,
          best,
          12,
          best.type === UnitType.DRONE ? 0.45 : 0.55,
          190
        );
        unit.secondaryTimer = 0.55;
      }
    }
  }

  // 主炮：敌机（经 onUnitFire）与敌方舰船（内部弹道）
  unit.fireTimer -= deltaTime;
  if (unit.fireTimer <= 0) {
    unit.fireTimer = 1.2;
    let jet: THREE.Object3D | null = null;
    let jetSq = 650 * 650;
    for (const mesh of world.enemyAirMeshes) {
      if (!mesh.visible) continue;
      mesh.getWorldPosition(tmp);
      const d = tmp.distanceToSquared(p);
      if (d < jetSq) {
        jetSq = d;
        jet = mesh;
      }
    }
    partWorldPosition(unit, getPart(unit, 'muzzle'), muzzlePos, 5);
    if (jet) {
      jet.getWorldPosition(aimPoint);
      if (turret) turret.rotation.y = aimAngles(unit, muzzlePos, aimPoint).yaw;
      for (let i = 0; i < 3; i++) world.fireAtObject(unit, muzzlePos, jet, 6, 0.02 + i * 0.01);
      world.muzzleFlash(muzzlePos, 1);
    } else {
      let ship: UnitEntity | null = null;
      let shipSq = 850 * 850;
      for (const hostile of world.hostiles) {
        if (hostile.domain !== 'sea') continue;
        const d = hostile.mesh.position.distanceToSquared(p);
        if (d < shipSq) {
          shipSq = d;
          ship = hostile;
        }
      }
      if (ship) {
        if (turret) turret.rotation.y = aimAngles(unit, muzzlePos, ship.mesh.position).yaw;
        world.fireAtUnit(unit, 'shell', muzzlePos, ship, 30, 0.5, 150);
        world.muzzleFlash(muzzlePos, 1.3);
        unit.fireTimer = 3.2;
      }
    }
  }
}

// ───────────────────────────── 友军预警机 ─────────────────────────────

export function updateAllyAwacs(unit: UnitEntity, _world: UnitWorld, deltaTime: number): void {
  const p = unit.mesh.position;
  if (unit.phase === 'init') {
    unit.phase = 'orbit';
    unit.orbitRadius = 520;
    unit.orbitDirection = unit.seed < 0.5 ? -1 : 1;
    unit.altitude = p.y;
    // 盘旋中心：出生点向内侧偏移一个半径，使其从圆上起飞
    unit.orbitAngle = unit.seed * Math.PI * 2;
    unit.anchor.set(
      p.x - Math.cos(unit.orbitAngle) * unit.orbitRadius,
      p.y,
      p.z - Math.sin(unit.orbitAngle) * unit.orbitRadius
    );
    unit.anchor.x = THREE.MathUtils.clamp(unit.anchor.x, -900, 900);
    unit.anchor.z = THREE.MathUtils.clamp(unit.anchor.z, -900, 900);
    unit.speed = unit.config.speed;
  }
  unit.orbitAngle += (unit.orbitDirection * unit.config.speed * deltaTime) / unit.orbitRadius;
  const lead = unit.orbitAngle + unit.orbitDirection * 0.25;
  flyToward(
    unit,
    deltaTime,
    unit.anchor.x + Math.cos(lead) * unit.orbitRadius,
    unit.altitude,
    unit.anchor.z + Math.sin(lead) * unit.orbitRadius,
    unit.config.speed,
    0.4,
    6,
    1.2
  );
  applyAttitude(unit);
  const dome = getPart(unit, 'rotodome');
  if (dome) dome.rotation.y += deltaTime * 0.9;
}

// ───────────────────────── 护送目标 / 平民（航线行进） ─────────────────────────

export function updateRouteFollower(unit: UnitEntity, world: UnitWorld, deltaTime: number): void {
  if (unit.phase === 'init') {
    unit.phase = 'travel';
    unit.speed = unit.domain === 'air' ? unit.config.speed : 0;
    if (unit.route && unit.route.length > 0) {
      const first = unit.route[0];
      unit.heading = Math.atan2(first.x - unit.mesh.position.x, first.z - unit.mesh.position.z);
    }
  }
  let arrived: boolean;
  if (unit.route && unit.route.length > 0) {
    arrived = followRoute(unit, world, deltaTime, unit.config.speed);
  } else {
    // 无航线：沿当前航向行驶，驶出战场即离场
    const p = unit.mesh.position;
    const tx = p.x + Math.sin(unit.heading) * 100;
    const tz = p.z + Math.cos(unit.heading) * 100;
    if (unit.domain === 'air') {
      flyToward(unit, deltaTime, tx, p.y, tz, unit.config.speed, 0.3, 4);
    } else {
      driveToward(unit, world, deltaTime, tx, tz, unit.config.speed, 0.5, 0);
    }
    arrived = Math.abs(p.x) > 1450 || Math.abs(p.z) > 1450;
  }
  if (unit.domain !== 'air') {
    settleOnSurface(unit, world, deltaTime);
  } else if (unit.type === UnitType.CIVILIAN_AIRLINER && unit.civilianHitCooldown > 0) {
    // 遭误击的客机紧急爬升
    unit.mesh.position.y += 6 * deltaTime;
    if (unit.route) {
      for (let i = unit.routeIndex; i < unit.route.length; i++) unit.route[i].y += 6 * deltaTime;
    }
  }
  applyAttitude(unit);
  spinParts(unit, 'props', 'z', 26, deltaTime);
  if (unit.domain === 'sea') {
    const wake = getPart(unit, 'wake');
    if (wake)
      wake.scale.set(1, 1, 0.3 + 0.7 * THREE.MathUtils.clamp(unit.speed / unit.config.speed, 0, 1));
  }
  if (arrived) {
    world.depart(unit, unit.config.isEscort ? 'arrived' : 'exited');
  }
}
