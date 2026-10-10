import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';
import { GunLeadSolver, type GunAssistCone } from '@/features/combat/GunLeadSolver';

/**
 * 机炮辅助（C2）与“十字指向哪里，子弹就飞向哪里”（C3 的解算器部分）。
 *
 * 规则（数值取自规格，不从被测代码里读）：θ 是机头到辅助瞄准点（有可靠解的敌机的提前量点，
 * 或地面 / 海面单位的瞄准点）的夹角。辅助有两档锥角，规则相同、大小不同：
 * - 触屏档（update 不带第 7 个参数，或传 'touch'）：θ ≤ 2.5° 时辅助方向正对瞄准点；
 *   2.5° < θ < 5° 偏移平滑减到零（两端连续、不超过 2.5°、单调递减）；θ ≥ 5° 不偏移；
 * - 键盘档（第 7 个参数传 'keyboard'）：同一套规则，小一半——1.25° 以内正对瞄准点，
 *   到 2.5° 平滑、单调地减到零，偏移不超过 1.25°；
 * - 两档共用：超过 480 米、没有可靠解、调用方关掉辅助（第 6 个参数）时不偏移；
 *   目标出现 / 消失 / 更换时滑过去（约 0.1 秒到 95%），压住一个目标时不滞后；
 *   另一个目标要比当前目标离机头近出 0.75° 才接手；reset() 回到机头轴线；
 *   输入（位置、方向、距离）不是有限数：不辅助；时间步长不是正的有限数的一帧坏帧则是整步跳过。
 * 哪台设备用哪一档（GameConfig.isMobile）是协调器的事，见 CoordinatorWeaponsWiring.test.ts。
 *
 * 文件前半（“gun aim assist”“the gun cross goes where the bullets go”）不传第 7 个参数，测的是
 * 触屏档；后半把同一套规则按档位各走一遍（显式 'touch' 与 'keyboard'），并核对不传参数与显式
 * 'touch' 的输出完全一致。
 *
 * 只走公开接口：update / reset / getAssistDirection / getAssistWeight / getAssistTarget /
 * getRenderAssistDirection / getRenderAssistDistance（另有提前量标记的 getPipTarget /
 * getPipPoint / isPipOnTarget）。没有辅助时 getAssistDirection 可以是 null，
 * 这里一律按“就是机头方向”处理。
 */

const BULLET_SPEED = 100;
const DT = 1 / 60;
const FULL_DEG = 2.5;
const OUTER_DEG = 5;
const KEYBOARD_FULL_DEG = 1.25;
const KEYBOARD_OUTER_DEG = 2.5;
const MAX_RANGE = 480;
const EASE_TIME = 0.1;
const SWITCH_MARGIN_DEG = 0.75;
const REFERENCE_RANGE = 600;
const CROSS_MIN_RANGE = 100;
/** 足够让速度估计可靠、并让滑动结束的步数（1.5 秒） */
const SETTLE_STEPS = 90;

const rad = THREE.MathUtils.degToRad;
const toDeg = THREE.MathUtils.radToDeg;

interface Mover {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
}

interface Rig {
  solver: GunLeadSolver;
  muzzle: THREE.Vector3;
  quaternion: THREE.Quaternion;
  forward: THREE.Vector3;
  movers: Mover[];
  /** 列表前多少个是空中目标（null = 全部） */
  airCount: number | null;
  /** 辅助开关（update 的第 6 个参数） */
  assist: boolean;
  /** 锥角档位（update 的第 7 个参数）；undefined = 不传这个参数 */
  cone: GunAssistCone | undefined;
}

interface RigOptions {
  muzzle?: THREE.Vector3;
  quaternion?: THREE.Quaternion;
  assist?: boolean;
  cone?: GunAssistCone;
}

function createRig(options: RigOptions = {}): Rig {
  const rig: Rig = {
    solver: new GunLeadSolver(),
    muzzle: options.muzzle?.clone() ?? new THREE.Vector3(0, 0, 0),
    quaternion: new THREE.Quaternion(),
    forward: new THREE.Vector3(0, 0, -1),
    movers: [],
    airCount: null,
    assist: options.assist ?? true,
    cone: options.cone,
  };
  if (options.quaternion) setAttitude(rig, options.quaternion);
  return rig;
}

function setAttitude(rig: Rig, quaternion: THREE.Quaternion): void {
  rig.quaternion.copy(quaternion).normalize();
  rig.forward.set(0, 0, -1).applyQuaternion(rig.quaternion).normalize();
}

/** 机头向右偏航 degrees 度（相对当前姿态，绕机体的上方轴） */
function yawRight(rig: Rig, degrees: number): void {
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rad(degrees));
  setAttitude(rig, rig.quaternion.clone().multiply(turn));
}

/**
 * 离机头轴线 angleDeg 度、距炮口 range 米的点。bearingDeg 是绕机头轴线的方位：
 * 0 = 机体右侧，90 = 机体上方，180 = 左侧。
 */
function atAngle(rig: Rig, angleDeg: number, range: number, bearingDeg = 0): THREE.Vector3 {
  const angle = rad(angleDeg);
  const bearing = rad(bearingDeg);
  return new THREE.Vector3(
    Math.sin(angle) * Math.cos(bearing),
    Math.sin(angle) * Math.sin(bearing),
    -Math.cos(angle)
  )
    .multiplyScalar(range)
    .applyQuaternion(rig.quaternion)
    .add(rig.muzzle);
}

function addMover(
  rig: Rig,
  position: THREE.Vector3,
  velocity: THREE.Vector3 = new THREE.Vector3()
): Mover {
  const object = new THREE.Object3D();
  object.position.copy(position);
  const mover = { object, velocity: velocity.clone() };
  rig.movers.push(mover);
  return mover;
}

function removeMover(rig: Rig, mover: Mover): void {
  rig.movers.splice(rig.movers.indexOf(mover), 1);
}

function observe(rig: Rig, dt = DT): void {
  const targets = rig.movers.map((mover) => mover.object);
  const airCount = rig.airCount ?? targets.length;
  if (rig.cone === undefined) {
    // 不传第 7 个参数：走它的默认值
    rig.solver.update(dt, rig.muzzle, rig.forward, targets, airCount, rig.assist);
  } else {
    rig.solver.update(dt, rig.muzzle, rig.forward, targets, airCount, rig.assist, rig.cone);
  }
}

/** 一步：目标先按速度前进，解算器再观测 */
function step(rig: Rig, dt = DT): void {
  for (const mover of rig.movers) mover.object.position.addScaledVector(mover.velocity, dt);
  observe(rig, dt);
}

function run(rig: Rig, steps: number, dt = DT): void {
  for (let i = 0; i < steps; i += 1) step(rig, dt);
}

/** 两个方向的夹角（弧度）；用 atan2，小角度也准 */
function angleBetween(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(a.clone().cross(b).length(), a.dot(b));
}

function directionTo(rig: Rig, point: THREE.Vector3): THREE.Vector3 {
  return point.clone().sub(rig.muzzle).normalize();
}

/** 点离机头轴线多少度 */
function offNoseDeg(rig: Rig, point: THREE.Vector3): number {
  return toDeg(angleBetween(directionTo(rig, point), rig.forward));
}

/** 这一步子弹用的方向（没有辅助 = 机头方向） */
function assisted(rig: Rig): THREE.Vector3 {
  return rig.solver.getAssistDirection()?.clone() ?? rig.forward.clone();
}

/** 辅助方向偏离机头多少度 */
function shiftDeg(rig: Rig): number {
  return toDeg(angleBetween(assisted(rig), rig.forward));
}

/** 辅助方向离某个点的方向差多少度 */
function errorDeg(rig: Rig, point: THREE.Vector3): number {
  return toDeg(angleBetween(assisted(rig), directionTo(rig, point)));
}

/** 渲染帧的十字方向（没有偏移 = 机头方向） */
function rendered(rig: Rig, alpha: number): THREE.Vector3 {
  return rig.solver.getRenderAssistDirection(rig.quaternion, alpha)?.clone() ?? rig.forward.clone();
}

function expectFiniteDirection(direction: THREE.Vector3, label: string): void {
  expect(
    Number.isFinite(direction.x) && Number.isFinite(direction.y) && Number.isFinite(direction.z),
    `${label}: ${direction.x}, ${direction.y}, ${direction.z}`
  ).toBe(true);
}

/** 静止目标放在 θ 处，等滑动结束后的偏移角（度）；cone 不给 = 不传第 7 个参数 */
function settledShift(angleDeg: number, bearingDeg = 0, range = 300, cone?: GunAssistCone): number {
  const rig = createRig({ cone });
  addMover(rig, atAngle(rig, angleDeg, range, bearingDeg));
  run(rig, SETTLE_STEPS);
  return shiftDeg(rig);
}

/** 用二分法求最早的相遇时间（与被测代码的解法无关） */
function earliestInterceptTime(relative: THREE.Vector3, velocity: THREE.Vector3): number {
  const gap = (t: number): number =>
    relative.clone().addScaledVector(velocity, t).length() - BULLET_SPEED * t;
  let low = 0;
  let high = 0;
  while (high < 30 && gap(high) > 0) {
    low = high;
    high += 0.01;
  }
  expect(gap(high), 'the scenario should have an intercept').toBeLessThanOrEqual(0);
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (gap(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** 目标现在的提前量点（按定义：现在开火的子弹与匀速直线目标相遇的位置） */
function leadPointOf(rig: Rig, mover: Mover): THREE.Vector3 {
  const relative = mover.object.position.clone().sub(rig.muzzle);
  const time = earliestInterceptTime(relative, mover.velocity);
  return mover.object.position.clone().addScaledVector(mover.velocity, time);
}

/** 沿 direction 以 100 m/s 开火的子弹与匀速直线目标的最近距离（米） */
function missDistance(rig: Rig, direction: THREE.Vector3, mover: Mover): number {
  const relative = mover.object.position.clone().sub(rig.muzzle);
  const closing = mover.velocity.clone().addScaledVector(direction, -BULLET_SPEED);
  const time = Math.max(0, -relative.dot(closing) / closing.lengthSq());
  return relative.addScaledVector(closing, time).length();
}

/** 一个随便的姿态：带坡度、带俯仰、带航向 */
function awkwardAttitude(): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -1.1, 0.8, 'YXZ'));
}

type FlightVisitor = (rig: Rig, label: string) => void;

/**
 * 一段把各种状态都走一遍的飞行：出现、压住、换目标、机头转开渐弱、目标消失。
 * 两个目标（1.6° 与 0.4°）在两档锥角里都算数；cone 不给 = 不传第 7 个参数。
 */
function eventfulFlight(visit: FlightVisitor, cone?: GunAssistCone): void {
  const rig = createRig({
    muzzle: new THREE.Vector3(40, 300, -90),
    quaternion: awkwardAttitude(),
    cone,
  });
  const first = addMover(rig, atAngle(rig, 1.6, 320, 30), new THREE.Vector3(3, 1, -2));
  const walk = (steps: number, label: string, each?: () => void): void => {
    for (let i = 0; i < steps; i += 1) {
      each?.();
      step(rig);
      visit(rig, `${label}, step ${i}`);
    }
  };
  walk(40, 'target appears');
  const second = addMover(rig, atAngle(rig, 0.4, 280, 200));
  walk(40, 'second target takes over');
  removeMover(rig, first);
  walk(20, 'first target gone');
  walk(90, 'nose drifts away', () => yawRight(rig, 3 * DT));
  removeMover(rig, second);
  walk(40, 'nothing left');
}

describe('gun aim assist', () => {
  it('publishes the constants of the rule', () => {
    const assist = GAME_CONSTANTS.GUN_ASSIST;

    expect(toDeg(assist.FULL_ANGLE)).toBeCloseTo(FULL_DEG, 9);
    expect(toDeg(assist.OUTER_ANGLE)).toBeCloseTo(OUTER_DEG, 9);
    expect(toDeg(assist.KEYBOARD_FULL_ANGLE)).toBeCloseTo(KEYBOARD_FULL_DEG, 9);
    expect(toDeg(assist.KEYBOARD_OUTER_ANGLE)).toBeCloseTo(KEYBOARD_OUTER_DEG, 9);
    expect(assist.MAX_RANGE).toBe(MAX_RANGE);
    expect(assist.EASE_TIME).toBeCloseTo(EASE_TIME, 9);
    expect(toDeg(assist.SWITCH_MARGIN)).toBeCloseTo(SWITCH_MARGIN_DEG, 9);
    expect(assist.REFERENCE_RANGE).toBe(REFERENCE_RANGE);
    expect(assist.CROSS_MIN_RANGE).toBe(CROSS_MIN_RANGE);
  });

  describe('inside 2.5 degrees', () => {
    it.each([
      [0.2, 0],
      [1, 0],
      [1, 90],
      [1.7, 200],
      [2.4, 310],
      [2.5, 45],
    ])('points exactly at an aim point %s° off the nose (bearing %s°)', (angle, bearing) => {
      const rig = createRig();
      const point = atAngle(rig, angle, 300, bearing);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
      expect(shiftDeg(rig)).toBeCloseTo(angle, 6);
    });

    it.each([40, 150, 300, 479])('does so at %s m', (range) => {
      const rig = createRig();
      const point = atAngle(rig, 2, range, 120);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it('works from the muzzle and the nose, wherever the aircraft is and however it is banked', () => {
      const rig = createRig({
        muzzle: new THREE.Vector3(1200, 260, -430),
        quaternion: awkwardAttitude(),
      });
      const point = atAngle(rig, 2.2, 350, 250);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(offNoseDeg(rig, point)).toBeCloseTo(2.2, 6);
      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it('leaves the direction on the nose for a target exactly on the nose', () => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 0, 300));

      run(rig, SETTLE_STEPS);

      expect(shiftDeg(rig)).toBeLessThan(1e-9);
    });

    it('aims at the lead point of a moving aircraft, so the bullet meets it', () => {
      const rig = createRig();
      // 提前量点在机头右侧 1.5°、250 米；敌机以 40 m/s 向右横穿，机体本身还在机头左侧 20° 外
      const lead = atAngle(rig, 1.5, 250);
      const velocity = new THREE.Vector3(40, 0, 0);
      const flightTime = lead.distanceTo(rig.muzzle) / BULLET_SPEED;
      const finalPosition = lead.clone().addScaledVector(velocity, -flightTime);
      const start = finalPosition.clone().addScaledVector(velocity, -SETTLE_STEPS * DT);
      const mover = addMover(rig, start, velocity);

      run(rig, SETTLE_STEPS);

      expect(offNoseDeg(rig, mover.object.position)).toBeGreaterThan(15);
      expect(errorDeg(rig, leadPointOf(rig, mover))).toBeLessThan(1e-4);
      expect(missDistance(rig, assisted(rig), mover)).toBeLessThan(0.01);
      // 不辅助的话这一枪会从目标旁边飞过去
      expect(missDistance(rig, rig.forward, mover)).toBeGreaterThan(5);
    });

    it('measures the angle to the lead point, not to the aircraft', () => {
      const rig = createRig();
      // 机体在机头 1° 处，但它横穿得很快，提前量点远在 5° 以外：不辅助
      const velocity = new THREE.Vector3(40, 0, 0);
      const finalPosition = atAngle(rig, 1, 300);
      const mover = addMover(
        rig,
        finalPosition.clone().addScaledVector(velocity, -SETTLE_STEPS * DT),
        velocity
      );

      run(rig, SETTLE_STEPS);

      expect(offNoseDeg(rig, mover.object.position)).toBeCloseTo(1, 6);
      expect(offNoseDeg(rig, leadPointOf(rig, mover))).toBeGreaterThan(OUTER_DEG);
      expect(shiftDeg(rig)).toBe(0);
    });

    it('aims at a ground or sea unit just as it does at an aircraft', () => {
      const rig = createRig();
      rig.airCount = 0;
      const point = atAngle(rig, 1.8, 300, 270);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
      // 地面 / 海面单位不显示提前量标记
      expect(rig.solver.getPipTarget()).toBeNull();
    });

    it('picks the aim point nearest the nose, not the nearest target', () => {
      const rig = createRig();
      const near = addMover(rig, atAngle(rig, 2.3, 150, 0));
      const far = addMover(rig, atAngle(rig, 0.8, 420, 180));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getAssistTarget()).toBe(far.object);
      expect(errorDeg(rig, far.object.position)).toBeLessThan(1e-6);
      expect(errorDeg(rig, near.object.position)).toBeGreaterThan(1);
    });
  });

  describe('between 2.5 and 5 degrees', () => {
    /** 2.5° 到 5° 之间每 0.05° 取一个点 */
    const ANGLES: number[] = [];
    for (let i = 0; i <= 50; i += 1) ANGLES.push(FULL_DEG + (i * (OUTER_DEG - FULL_DEG)) / 50);

    it('shifts less and less as the aim point moves out', () => {
      const shifts = ANGLES.map((angle) => settledShift(angle));

      for (let i = 1; i < shifts.length; i += 1) {
        expect(shifts[i], `at ${ANGLES[i].toFixed(2)}°`).toBeLessThan(shifts[i - 1]);
      }
    });

    it('never shifts by more than 2.5 degrees', () => {
      for (const angle of ANGLES) {
        expect(settledShift(angle), `at ${angle.toFixed(2)}°`).toBeLessThanOrEqual(FULL_DEG + 1e-9);
      }
    });

    it('is continuous where the fade starts: just past 2.5° the shift is still about 2.5°', () => {
      expect(settledShift(FULL_DEG + 0.01)).toBeGreaterThan(FULL_DEG - 0.02);
      expect(settledShift(FULL_DEG - 0.01)).toBeCloseTo(FULL_DEG - 0.01, 6);
    });

    it('is continuous where the fade ends: just inside 5° the shift is about zero', () => {
      expect(settledShift(OUTER_DEG - 0.01)).toBeLessThan(0.02);
      expect(settledShift(OUTER_DEG - 0.01)).toBeGreaterThanOrEqual(0);
    });

    it('fades without a jump anywhere in between', () => {
      const shifts = ANGLES.map((angle) => settledShift(angle));

      for (let i = 1; i < shifts.length; i += 1) {
        // 0.05° 的一小步里，偏移的变化不超过 0.1°
        expect(shifts[i - 1] - shifts[i], `at ${ANGLES[i].toFixed(2)}°`).toBeLessThan(0.1);
      }
    });

    it('is a real fade: about half way out the shift is neither full nor gone', () => {
      const shift = settledShift(3.75);

      expect(shift).toBeGreaterThan(0.5);
      expect(shift).toBeLessThan(2);
    });

    it.each([2.8, 3.5, 4.4])('shifts straight towards an aim point %s° off the nose', (angle) => {
      const rig = createRig({ quaternion: awkwardAttitude() });
      const point = atAngle(rig, angle, 300, 140);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      const shift = shiftDeg(rig);
      expect(shift).toBeGreaterThan(0);
      // 辅助方向落在“机头 → 瞄准点”的弧上：离瞄准点还差 θ − 偏移
      expect(errorDeg(rig, point)).toBeCloseTo(angle - shift, 6);
    });

    it('depends only on the angle: the same in every direction around the nose', () => {
      const reference = settledShift(3.5, 0);

      for (const bearing of [45, 90, 180, 233, 300]) {
        expect(settledShift(3.5, bearing), `bearing ${bearing}°`).toBeCloseTo(reference, 9);
      }
    });

    it('depends only on the angle: the same at any range inside 480 m', () => {
      const reference = settledShift(3.5, 0, 300);

      for (const range of [60, 150, 470]) {
        expect(settledShift(3.5, 0, range), `${range} m`).toBeCloseTo(reference, 9);
      }
    });
  });

  describe('no shift', () => {
    it('at 5° off the nose', () => {
      const rig = createRig();
      addMover(rig, atAngle(rig, OUTER_DEG, 300));

      run(rig, SETTLE_STEPS);

      // 正好在边界上：浮点误差以内就是零
      expect(shiftDeg(rig)).toBeLessThan(1e-12);
      expect(rig.solver.getAssistWeight()).toBeLessThan(1e-12);
    });

    it.each([5.01, 6, 10, 45, 120])('at %s° off the nose', (angle) => {
      const rig = createRig();
      addMover(rig, atAngle(rig, angle, 300));

      run(rig, SETTLE_STEPS);

      expect(shiftDeg(rig)).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
    });

    it.each([481, 500, 650])('for a target %s m away', (range) => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 1.5, range));

      run(rig, SETTLE_STEPS);

      expect(shiftDeg(rig)).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
    });

    it('but a full shift just inside 480 m', () => {
      const rig = createRig();
      const point = atAngle(rig, 1.5, 479);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    // 关的是 update 的第 6 个参数。键盘设备并不走这条路——它有自己的（小一半的）锥角，
    // 见文件后半的键盘档
    it('when the caller switches the assist off', () => {
      const rig = createRig({ assist: false });
      addMover(rig, atAngle(rig, 1.5, 300));

      for (let i = 0; i < SETTLE_STEPS; i += 1) {
        step(rig);
        expect(shiftDeg(rig), `step ${i}`).toBe(0);
        expect(rig.solver.getAssistWeight(), `step ${i}`).toBe(0);
      }
    });

    it('for a target that has only just appeared (no reliable solution yet)', () => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 1.5, 300));

      for (let i = 0; i < 3; i += 1) {
        step(rig);
        expect(shiftDeg(rig), `update ${i + 1}`).toBe(0);
      }
    });

    it('for a target the bullet cannot catch', () => {
      const rig = createRig();
      // 比子弹快、正在远离：无解
      addMover(rig, atAngle(rig, 1.5, 200), new THREE.Vector3(0, 0, -150));

      for (let i = 0; i < 60; i += 1) {
        step(rig);
        expect(shiftDeg(rig), `step ${i}`).toBe(0);
      }
    });

    it('when there is nothing to aim at', () => {
      const rig = createRig();

      run(rig, 10);

      expect(shiftDeg(rig)).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
      expect(rig.solver.getAssistTarget()).toBeNull();
    });
  });

  describe('easing', () => {
    /** 目标出现后每一步的“已完成比例”（偏移 / 最终偏移），第一个元素是出现后的第一步 */
    function easeIn(dt: number): number[] {
      const rig = createRig();
      addMover(rig, atAngle(rig, 2, 300));
      const progress: number[] = [];
      for (let i = 0; i < Math.round(1 / dt) + 10; i += 1) {
        step(rig, dt);
        const shift = shiftDeg(rig);
        if (shift > 0 || progress.length > 0) progress.push(shift / 2);
      }
      return progress;
    }

    /** 目标消失后每一步的“剩余比例”，第一个元素是消失后的第一步 */
    function easeOut(dt: number): number[] {
      const rig = createRig();
      const mover = addMover(rig, atAngle(rig, 2, 300));
      run(rig, Math.round(1.5 / dt), dt);
      expect(shiftDeg(rig)).toBeCloseTo(2, 6);
      removeMover(rig, mover);
      const remaining: number[] = [];
      for (let i = 0; i < Math.round(1 / dt); i += 1) {
        step(rig, dt);
        remaining.push(shiftDeg(rig) / 2);
      }
      return remaining;
    }

    const RATES = [1 / 30, 1 / 60, 1 / 120];

    it('slides in when a target appears instead of jumping', () => {
      const progress = easeIn(DT);

      expect(progress[0]).toBeGreaterThan(0);
      expect(progress[0]).toBeLessThan(0.6);
      for (let i = 1; i < progress.length; i += 1) {
        expect(progress[i], `step ${i}`).toBeGreaterThanOrEqual(progress[i - 1] - 1e-12);
      }
    });

    it.each(RATES)('is about 95%% of the way 0.1 s after a target appears (step %s s)', (dt) => {
      const progress = easeIn(dt);
      const atEaseTime = progress[Math.round(EASE_TIME / dt) - 1];

      expect(atEaseTime).toBeGreaterThan(0.9);
      expect(atEaseTime).toBeLessThan(0.99);
    });

    it.each(RATES)('gets all the way there soon after (step %s s)', (dt) => {
      const progress = easeIn(dt);

      expect(progress[Math.round(0.5 / dt) - 1]).toBeGreaterThan(0.9999);
      expect(progress[progress.length - 1]).toBeCloseTo(1, 6);
    });

    it('slides back to the nose when the target disappears instead of snapping', () => {
      const remaining = easeOut(DT);

      expect(remaining[0]).toBeGreaterThan(0.4);
      expect(remaining[0]).toBeLessThan(1);
      for (let i = 1; i < remaining.length; i += 1) {
        expect(remaining[i], `step ${i}`).toBeLessThanOrEqual(remaining[i - 1] + 1e-12);
      }
    });

    it.each(RATES)('has about 5%% left 0.1 s after the target disappears (step %s s)', (dt) => {
      const remaining = easeOut(dt);
      const atEaseTime = remaining[Math.round(EASE_TIME / dt) - 1];

      expect(atEaseTime).toBeGreaterThan(0.01);
      expect(atEaseTime).toBeLessThan(0.1);
    });

    it.each(RATES)('ends up exactly on the nose axis again (step %s s)', (dt) => {
      const remaining = easeOut(dt);

      expect(remaining[remaining.length - 1]).toBe(0);
    });

    it('lets go of the target and of the assist strength once it has slid back', () => {
      const rig = createRig();
      const mover = addMover(rig, atAngle(rig, 2, 300));
      run(rig, SETTLE_STEPS);
      removeMover(rig, mover);

      run(rig, 60);

      expect(rig.solver.getAssistTarget()).toBeNull();
      expect(rig.solver.getAssistWeight()).toBe(0);
    });

    it('slides out the same way when the range opens beyond 480 m', () => {
      const rig = createRig();
      const mover = addMover(rig, atAngle(rig, 2, 470));
      run(rig, SETTLE_STEPS);
      expect(shiftDeg(rig)).toBeCloseTo(2, 6);

      // 目标不动（提前量点就是目标本身），把炮口沿机头反方向每步挪 1 米：距离拉开到 480 米以外
      const shifts: number[] = [];
      let lastInRange = 0;
      for (let i = 0; i < 60; i += 1) {
        rig.muzzle.addScaledVector(rig.forward, -1);
        step(rig);
        if (mover.object.position.distanceTo(rig.muzzle) > MAX_RANGE) shifts.push(shiftDeg(rig));
        else lastInRange = shiftDeg(rig);
      }

      expect(lastInRange).toBeGreaterThan(1.9);
      // 出了射程的第一步：偏移还剩一大半，而不是直接归零
      expect(shifts[0]).toBeGreaterThan(0.8);
      expect(shifts[0]).toBeLessThan(lastInRange);
      expect(shifts[shifts.length - 1]).toBe(0);
      for (let i = 1; i < shifts.length; i += 1) {
        expect(shifts[i], `step ${i}`).toBeLessThanOrEqual(shifts[i - 1] + 1e-12);
      }
    });

    it('slides from one target to the next when the first is gone', () => {
      const rig = createRig();
      const first = addMover(rig, atAngle(rig, 1.5, 300, 0));
      const second = addMover(rig, atAngle(rig, 2.2, 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(first.object);
      const from = assisted(rig);
      const to = directionTo(rig, second.object.position);
      const span = angleBetween(from, to);

      removeMover(rig, first);
      const progress: number[] = [];
      for (let i = 0; i < 60; i += 1) {
        step(rig);
        progress.push(angleBetween(assisted(rig), from) / span);
      }

      expect(rig.solver.getAssistTarget()).toBe(second.object);
      expect(progress[0]).toBeGreaterThan(0);
      expect(progress[0]).toBeLessThan(0.6);
      const atEaseTime = progress[Math.round(EASE_TIME / DT) - 1];
      expect(atEaseTime).toBeGreaterThan(0.9);
      expect(atEaseTime).toBeLessThan(0.99);
      expect(progress[progress.length - 1]).toBeCloseTo(1, 6);
      for (let i = 1; i < progress.length; i += 1) {
        expect(progress[i], `step ${i}`).toBeGreaterThanOrEqual(progress[i - 1] - 1e-12);
      }
      expect(errorDeg(rig, second.object.position)).toBeLessThan(1e-4);
    });

    it('never moves the direction by a jump while sliding between targets', () => {
      const rig = createRig();
      const first = addMover(rig, atAngle(rig, 2.4, 300, 0));
      addMover(rig, atAngle(rig, 2.4, 300, 180));
      run(rig, SETTLE_STEPS);
      removeMover(rig, first);

      let previous = assisted(rig);
      for (let i = 0; i < 60; i += 1) {
        step(rig);
        const current = assisted(rig);
        // 两个目标相隔 4.8°：一步里最多走完其中一小半
        expect(toDeg(angleBetween(current, previous)), `step ${i}`).toBeLessThan(2.4);
        previous = current;
      }
    });
  });

  describe('holding a target', () => {
    it('does not lag a target that crosses the nose', () => {
      const rig = createRig();
      // 提前量点从机头左侧 2.3° 慢慢移到右侧：一直在 2.5° 以内
      const velocity = new THREE.Vector3(6, 0, 0);
      const mover = addMover(rig, new THREE.Vector3(-30, 0, -300), velocity);
      run(rig, SETTLE_STEPS);

      let swept = 0;
      const startAngle = offNoseDeg(rig, leadPointOf(rig, mover));
      for (let i = 0; i < 150; i += 1) {
        step(rig);
        const lead = leadPointOf(rig, mover);
        expect(offNoseDeg(rig, lead), `step ${i}`).toBeLessThan(FULL_DEG);
        expect(errorDeg(rig, lead), `step ${i}`).toBeLessThan(1e-4);
        swept = Math.abs(offNoseDeg(rig, lead) - startAngle);
      }
      // 这段时间里瞄准点确实在动
      expect(swept).toBeGreaterThan(0.5);
    });

    it('does not lag when it is the nose that moves', () => {
      const rig = createRig();
      const point = atAngle(rig, 2, 300, 0);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);

      // 机头以 3°/秒 向右扫过目标：从左侧 2° 到右侧 2°
      for (let i = 0; i < 80; i += 1) {
        yawRight(rig, 3 * DT);
        step(rig);
        expect(offNoseDeg(rig, point), `step ${i}`).toBeLessThan(FULL_DEG);
        expect(errorDeg(rig, point), `step ${i}`).toBeLessThan(1e-6);
      }
      expect(offNoseDeg(rig, point)).toBeCloseTo(2, 1);
    });

    it('follows the fade without lag as the nose drifts away from the target', () => {
      const rig = createRig();
      const point = atAngle(rig, 2.6, 300, 0);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);

      // 机头以 2°/秒 向左转开：瞄准点从 2.6° 滑到 4.9°
      for (let i = 0; i < 68; i += 1) {
        yawRight(rig, -2 * DT);
        step(rig);
        const angle = offNoseDeg(rig, point);
        expect(angle, `step ${i}`).toBeLessThan(OUTER_DEG);
        expect(shiftDeg(rig), `step ${i} at ${angle.toFixed(3)}°`).toBeCloseTo(
          settledShift(angle),
          6
        );
      }
      expect(offNoseDeg(rig, point)).toBeGreaterThan(4.8);
    });

    it('fades out without a jump when the aim point leaves the 5 degree cone', () => {
      const rig = createRig();
      const point = atAngle(rig, 4, 300, 0);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);

      let previous = shiftDeg(rig);
      for (let i = 0; i < 90; i += 1) {
        yawRight(rig, -2 * DT);
        step(rig);
        const shift = shiftDeg(rig);
        expect(Math.abs(shift - previous), `step ${i}`).toBeLessThan(0.1);
        previous = shift;
      }
      expect(offNoseDeg(rig, point)).toBeGreaterThan(OUTER_DEG);
      expect(previous).toBe(0);
    });
  });

  describe('taking over from a held target', () => {
    /** 先压住机头右侧 2° 的目标，再让第二个目标出现在左侧 secondAngle 度 */
    function heldThenSecond(secondAngle: number): { rig: Rig; first: Mover; second: Mover } {
      const rig = createRig();
      const first = addMover(rig, atAngle(rig, 2, 300, 0));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(first.object);
      const second = addMover(rig, atAngle(rig, secondAngle, 300, 180));
      run(rig, SETTLE_STEPS);
      return { rig, first, second };
    }

    it.each([1.9, 1.6, 1.3])(
      'keeps the held target when another is only a little nearer the nose (%s° against 2°)',
      (angle) => {
        const { rig, first } = heldThenSecond(angle);

        expect(rig.solver.getAssistTarget()).toBe(first.object);
        expect(errorDeg(rig, first.object.position)).toBeLessThan(1e-6);
      }
    );

    it.each([1.2, 0.9, 0.2])(
      'hands over when another is nearer the nose by more than 0.75° (%s° against 2°)',
      (angle) => {
        const { rig, second } = heldThenSecond(angle);

        expect(rig.solver.getAssistTarget()).toBe(second.object);
        expect(errorDeg(rig, second.object.position)).toBeLessThan(1e-6);
      }
    );

    it('needs no margin when nothing is held: the nearer of two new targets wins', () => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 2, 300, 0));
      const nearer = addMover(rig, atAngle(rig, 1.9, 300, 180));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getAssistTarget()).toBe(nearer.object);
    });

    it('does not hop back and forth between two targets about equally near the nose', () => {
      const rig = createRig();
      const right = addMover(rig, atAngle(rig, 2, 300, 0));
      const left = addMover(rig, atAngle(rig, 1.8, 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(left.object);
      const level = rig.quaternion.clone();

      // 机头左右摆 ±0.3°：谁离机头近在两者之间来回换，但另一个目标近出的量到不了 0.75°
      let rightWasNearer = false;
      for (let i = 0; i < 240; i += 1) {
        setAttitude(rig, level);
        yawRight(rig, 0.3 * Math.sin(i / 8));
        step(rig);
        const rightAngle = offNoseDeg(rig, right.object.position);
        const leftAngle = offNoseDeg(rig, left.object.position);
        if (rightAngle < leftAngle - 0.2) rightWasNearer = true;
        expect(leftAngle - rightAngle, `step ${i}`).toBeLessThan(SWITCH_MARGIN_DEG);
        expect(rig.solver.getAssistTarget(), `step ${i}`).toBe(left.object);
      }
      expect(rightWasNearer, 'the other target should have been the nearer one at times').toBe(
        true
      );

      // 摆得再大一点，差距超过 0.75°：这才换过去
      setAttitude(rig, level);
      yawRight(rig, 0.6);
      run(rig, 10);
      expect(
        offNoseDeg(rig, left.object.position) - offNoseDeg(rig, right.object.position)
      ).toBeGreaterThan(SWITCH_MARGIN_DEG);
      expect(rig.solver.getAssistTarget()).toBe(right.object);
    });

    it('takes whatever is left when the held target leaves the cone', () => {
      const rig = createRig();
      const held = addMover(rig, atAngle(rig, 1, 300, 0));
      const other = addMover(rig, atAngle(rig, 1.4, 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(held.object);

      // 被压住的目标飞到 5° 以外
      held.velocity.set(40, 0, 0);
      run(rig, 120);

      expect(rig.solver.getAssistTarget()).toBe(other.object);
      expect(errorDeg(rig, other.object.position)).toBeLessThan(1e-4);
    });
  });

  describe('reset', () => {
    it('returns to the nose axis at once', () => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 2, 300));
      run(rig, SETTLE_STEPS);
      expect(shiftDeg(rig)).toBeCloseTo(2, 6);

      rig.solver.reset();

      expect(shiftDeg(rig)).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
      expect(rig.solver.getAssistTarget()).toBeNull();
      expect(toDeg(angleBetween(rendered(rig, 0), rig.forward))).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 1), rig.forward))).toBe(0);
      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
      expect(rig.solver.getRenderAssistDistance(0)).toBe(REFERENCE_RANGE);
    });

    it('starts over afterwards: nothing until the target is tracked again, then it slides in', () => {
      const rig = createRig();
      const point = atAngle(rig, 2, 300);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);
      rig.solver.reset();

      const shifts: number[] = [];
      for (let i = 0; i < SETTLE_STEPS; i += 1) {
        step(rig);
        shifts.push(shiftDeg(rig));
      }

      expect(shifts[0]).toBe(0);
      expect(shifts[1]).toBe(0);
      const firstShifted = shifts.findIndex((shift) => shift > 0);
      expect(firstShifted).toBeGreaterThanOrEqual(2);
      expect(shifts[firstShifted]).toBeLessThan(2 * 0.6);
      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });
  });

  describe('bad input', () => {
    const BAD = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    function settledRig(): { rig: Rig; point: THREE.Vector3 } {
      const rig = createRig();
      const point = atAngle(rig, 2, 300);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);
      expect(shiftDeg(rig)).toBeCloseTo(2, 6);
      return { rig, point };
    }

    it.each(BAD)('gives no assist when the muzzle position is %s', (value) => {
      const { rig } = settledRig();
      const good = rig.muzzle.clone();

      rig.muzzle.set(0, value, 0);
      step(rig);
      rig.muzzle.copy(good);

      // 这一步子弹与十字都回到机头轴线上（不是从上一步滑回来），强度归零
      expect(shiftDeg(rig)).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 1), rig.forward))).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 0), rig.forward))).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
      expect(rig.solver.getAssistTarget()).toBeNull();
      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
    });

    it.each(BAD)('gives no assist when the nose direction is %s', (value) => {
      const { rig } = settledRig();
      const good = rig.forward.clone();

      rig.forward.set(value, 0, -1);
      step(rig);
      rig.forward.copy(good);

      expect(shiftDeg(rig)).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 1), rig.forward))).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 0), rig.forward))).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
      expect(rig.solver.getAssistTarget()).toBeNull();
      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
    });

    it('picks the target up again once the input is sound', () => {
      const { rig, point } = settledRig();
      const good = rig.muzzle.clone();
      rig.muzzle.set(Number.NaN, 0, 0);
      step(rig);
      rig.muzzle.copy(good);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it.each(BAD)('ignores a target whose position is %s', (value) => {
      const rig = createRig();
      const broken = addMover(rig, atAngle(rig, 1, 300));
      const sound = addMover(rig, atAngle(rig, 2, 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(broken.object);

      broken.object.position.set(value, 0, -300);
      for (let i = 0; i < SETTLE_STEPS; i += 1) {
        step(rig);
        expectFiniteDirection(assisted(rig), `step ${i}`);
        expect(rig.solver.getAssistTarget(), `step ${i}`).not.toBe(broken.object);
      }

      expect(rig.solver.getAssistTarget()).toBe(sound.object);
      expect(errorDeg(rig, sound.object.position)).toBeLessThan(1e-4);
    });

    it.each([0, -DT, Number.NaN, Number.POSITIVE_INFINITY])(
      'never offers an assist built on a time step of %s',
      (dt) => {
        const rig = createRig();
        addMover(rig, atAngle(rig, 1.5, 300));

        for (let i = 0; i < 30; i += 1) {
          step(rig, dt);
          expect(shiftDeg(rig), `step ${i}`).toBe(0);
          expect(rig.solver.getAssistWeight(), `step ${i}`).toBe(0);
        }
      }
    );

    // 时间步长不是正的有限数（裁定；7723114 已修）：“输入不是有限数：不辅助”说的是空间量
    // （位置、方向、距离）。时间步长坏掉——NaN、±Infinity、0、负数——只是一帧坏帧：解算器把这一步
    // 整个跳过去，保持的目标、偏移、强度、十字的距离都原样留着，下一个好步接着上一个好步算。
    // 游戏循环本身不会给出这样的步长。
    // 曾经的缺陷：NaN / -Infinity / 0 / 负数的一步会把目标放掉，之后两个好步按“目标消失”处理
    // （十字和子弹离开目标最多 1.26°，前后约 0.15 秒）；+Infinity 被当成一步无限长的好步。
    describe('a time step that is not a positive finite number', () => {
      interface Scene {
        rig: Rig;
        mover: Mover;
      }

      interface Outputs {
        /** 这一步子弹的方向 */
        bullet: THREE.Vector3;
        /** 渲染帧十字的方向 */
        cross: THREE.Vector3;
        weight: number;
        /** 十字画在多远 */
        range: number;
        /** 辅助是否压着这个目标 */
        holdsTarget: boolean;
        /** 提前量标记是否给了这个目标 */
        marksTarget: boolean;
      }

      const BAD_STEPS = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -DT];

      const SCENES: Record<string, () => Scene> = {
        // 静止目标，辅助已经滑到位
        'a held target': () => {
          const rig = createRig();
          const mover = addMover(rig, atAngle(rig, 2, 300));
          run(rig, SETTLE_STEPS);
          expect(shiftDeg(rig)).toBeCloseTo(2, 6);
          return { rig, mover };
        },
        // 静止目标，辅助正滑到一半
        'a target the assist is still sliding onto': () => {
          const rig = createRig();
          const mover = addMover(rig, atAngle(rig, 2, 300));
          run(rig, 5);
          const weight = rig.solver.getAssistWeight();
          expect(weight).toBeGreaterThan(0.2);
          expect(weight).toBeLessThan(0.9);
          return { rig, mover };
        },
        // 横穿的目标：压住的是提前量点，离机体本身 2° 多
        'a crossing target': () => {
          const rig = createRig();
          const mover = addMover(rig, atAngle(rig, 3.5, 300, 180), new THREE.Vector3(4, 0, 0));
          run(rig, SETTLE_STEPS);
          expect(errorDeg(rig, leadPointOf(rig, mover))).toBeLessThan(1e-4);
          expect(errorDeg(rig, mover.object.position)).toBeGreaterThan(1.5);
          return { rig, mover };
        },
      };

      const CASES = Object.keys(SCENES).flatMap((scene) =>
        BAD_STEPS.map((dt): [number, string] => [dt, scene])
      );

      function outputs({ rig, mover }: Scene): Outputs {
        return {
          bullet: assisted(rig),
          cross: rendered(rig, 1),
          weight: rig.solver.getAssistWeight(),
          range: rig.solver.getRenderAssistDistance(1),
          holdsTarget: rig.solver.getAssistTarget() === mover.object,
          marksTarget: rig.solver.getPipTarget() === mover.object,
        };
      }

      function expectSame(now: Outputs, reference: Outputs, label: string): void {
        expect(now.holdsTarget, `${label}: held target`).toBe(reference.holdsTarget);
        expect(now.marksTarget, `${label}: lead marker`).toBe(reference.marksTarget);
        expect(toDeg(angleBetween(now.bullet, reference.bullet)), `${label}: bullet`).toBeLessThan(
          1e-9
        );
        expect(toDeg(angleBetween(now.cross, reference.cross)), `${label}: cross`).toBeLessThan(
          1e-9
        );
        expect(Math.abs(now.weight - reference.weight), `${label}: strength`).toBeLessThan(1e-9);
        expect(Math.abs(now.range - reference.range), `${label}: cross range`).toBeLessThan(1e-6);
      }

      it.each(CASES)('one step of %s changes nothing with %s', (dt, name) => {
        const scene = SCENES[name]();
        const before = outputs(scene);
        expect(before.holdsTarget).toBe(true);
        expect(toDeg(angleBetween(before.bullet, scene.rig.forward))).toBeGreaterThan(0.01);

        observe(scene.rig, dt);

        // 压着的目标、子弹与十字的方向、辅助强度、十字的距离都原样留着：既不衰减，也不前进
        expectSame(outputs(scene), before, 'the bad step');
      });

      it.each(CASES)(
        'carries on after one step of %s with %s as if that step had never happened',
        (dt, name) => {
          const disturbed = SCENES[name]();
          const undisturbed = SCENES[name]();

          observe(disturbed.rig, dt);

          // 之后的每个好步都与没有坏步的那一份一模一样：没有松开目标，也没有多走或少走
          for (let i = 0; i < 30; i += 1) {
            step(disturbed.rig);
            step(undisturbed.rig);
            expectSame(outputs(disturbed), outputs(undisturbed), `good step ${i}`);
            expect(outputs(disturbed).holdsTarget, `good step ${i}`).toBe(true);
          }
        }
      );

      it('skips a run of bad steps the same way', () => {
        const disturbed = SCENES['a crossing target']();
        const undisturbed = SCENES['a crossing target']();
        const before = outputs(disturbed);

        for (const dt of [...BAD_STEPS, ...BAD_STEPS]) {
          observe(disturbed.rig, dt);
          expectSame(outputs(disturbed), before, `bad step of ${dt}`);
        }

        for (let i = 0; i < 30; i += 1) {
          step(disturbed.rig);
          step(undisturbed.rig);
          expectSame(outputs(disturbed), outputs(undisturbed), `good step ${i}`);
        }
      });

      it.each(CASES)('lets no bad number out after one step of %s with %s', (dt, name) => {
        const { rig, mover } = SCENES[name]();

        observe(rig, dt);

        for (let i = 0; i < SETTLE_STEPS; i += 1) {
          step(rig);
          const label = `good step ${i}`;
          expectFiniteDirection(assisted(rig), `${label}: bullet`);
          expectFiniteDirection(rendered(rig, 1), `${label}: cross`);
          expectFiniteDirection(rendered(rig, 0.5), `${label}: cross between steps`);
          expect(shiftDeg(rig), label).toBeLessThanOrEqual(FULL_DEG + 1e-9);
          const weight = rig.solver.getAssistWeight();
          expect(weight >= 0 && weight <= 1, `${label}: strength ${weight}`).toBe(true);
          for (const alpha of [0, 0.5, 1]) {
            const range = rig.solver.getRenderAssistDistance(alpha);
            expect(
              range >= CROSS_MIN_RANGE && range <= REFERENCE_RANGE,
              `${label}: cross range ${range} at alpha ${alpha}`
            ).toBe(true);
          }
        }
        // 最后仍然压在这个目标上
        expect(rig.solver.getAssistTarget()).toBe(mover.object);
        expect(errorDeg(rig, leadPointOf(rig, mover))).toBeLessThan(1e-4);
        expect(rig.solver.getAssistWeight()).toBeCloseTo(1, 6);
      });
    });

    it.each([0, -DT, Number.NaN, Number.POSITIVE_INFINITY])(
      'keeps every output finite through a time step of %s while a target is held',
      (dt) => {
        const { rig } = settledRig();

        for (let i = 0; i < 5; i += 1) {
          observe(rig, dt);
          expectFiniteDirection(assisted(rig), `step ${i}`);
          expectFiniteDirection(rendered(rig, 0.5), `render, step ${i}`);
          expect(shiftDeg(rig), `step ${i}`).toBeLessThanOrEqual(FULL_DEG + 1e-9);
          const weight = rig.solver.getAssistWeight();
          expect(weight >= 0 && weight <= 1, `weight ${weight}, step ${i}`).toBe(true);
          expect(Number.isFinite(rig.solver.getRenderAssistDistance(0.5)), `step ${i}`).toBe(true);
        }
      }
    );
  });

  describe('assist strength', () => {
    function settledWeight(angle: number): number {
      const rig = createRig();
      addMover(rig, atAngle(rig, angle, 300));
      run(rig, SETTLE_STEPS);
      return rig.solver.getAssistWeight();
    }

    it.each([0, 1, 2.4])('is full with the aim point %s° off the nose', (angle) => {
      expect(settledWeight(angle)).toBeCloseTo(1, 6);
    });

    it('falls from full to nothing between 2.5° and 5°', () => {
      const angles = [2.6, 3, 3.4, 3.8, 4.2, 4.6, 4.9];
      const weights = angles.map(settledWeight);

      expect(weights[0]).toBeLessThanOrEqual(1);
      expect(weights[0]).toBeGreaterThan(0.9);
      for (let i = 1; i < weights.length; i += 1) {
        expect(weights[i], `at ${angles[i]}°`).toBeLessThan(weights[i - 1]);
        expect(weights[i], `at ${angles[i]}°`).toBeGreaterThan(0);
      }
      expect(weights[weights.length - 1]).toBeLessThan(0.1);
    });

    it('stays between 0 and 1 while it eases in and out', () => {
      const rig = createRig();
      const mover = addMover(rig, atAngle(rig, 1, 300));
      const weights: number[] = [];
      for (let i = 0; i < 40; i += 1) {
        step(rig);
        weights.push(rig.solver.getAssistWeight());
      }
      removeMover(rig, mover);
      for (let i = 0; i < 40; i += 1) {
        step(rig);
        weights.push(rig.solver.getAssistWeight());
      }

      for (const weight of weights) {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...weights)).toBeCloseTo(1, 3);
      expect(weights[weights.length - 1]).toBe(0);
      // 强度也是滑上去的，不是一步到位
      const firstAssisted = weights.find((weight) => weight > 0);
      expect(firstAssisted).toBeLessThan(0.6);
    });
  });
});

/**
 * C3（解算器部分）：十字显示的方向和子弹用的方向是同一个量。
 * 模拟步的方向 = getAssistDirection；渲染帧的方向 = getRenderAssistDirection(姿态, alpha)。
 */
describe('the gun cross goes where the bullets go', () => {
  it('shows at alpha 1 exactly the direction the bullets leave along, at every step', () => {
    let assistedSteps = 0;
    eventfulFlight((rig, label) => {
      const bullets = assisted(rig);
      const cross = rendered(rig, 1);
      expect(angleBetween(bullets, cross), label).toBeLessThan(1e-9);
      if (toDeg(angleBetween(bullets, rig.forward)) > 0.1) assistedSteps += 1;
    });
    // 这段飞行里确实有很多步是带偏移的
    expect(assistedSteps).toBeGreaterThan(60);
  });

  it('shows at alpha 0 the direction of the previous step, so the cross moves smoothly between steps', () => {
    const rig = createRig();
    addMover(rig, atAngle(rig, 2, 300));
    let previous = assisted(rig);
    let moved = 0;
    for (let i = 0; i < 30; i += 1) {
      step(rig);
      const current = assisted(rig);
      const atStart = rendered(rig, 0);
      const halfWay = rendered(rig, 0.5);
      expect(angleBetween(atStart, previous), `step ${i}`).toBeLessThan(1e-9);
      // 中间时刻落在两步之间
      const span = angleBetween(previous, current);
      expect(angleBetween(halfWay, previous), `step ${i}`).toBeLessThanOrEqual(span + 1e-9);
      expect(angleBetween(halfWay, current), `step ${i}`).toBeLessThanOrEqual(span + 1e-9);
      moved = Math.max(moved, span);
      previous = current;
    }
    expect(toDeg(moved)).toBeGreaterThan(0.3);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 7])(
    'treats an alpha of %s as the current step',
    (alpha) => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 2, 300));
      run(rig, 6);

      const cross = rendered(rig, alpha);

      expectFiniteDirection(cross, 'render direction');
      expect(angleBetween(cross, assisted(rig))).toBeLessThan(1e-9);
    }
  );

  it('carries the shift on the render-frame attitude it is given', () => {
    const rig = createRig();
    const point = atAngle(rig, 2, 300);
    addMover(rig, point);
    run(rig, SETTLE_STEPS);

    // 渲染帧的姿态比模拟步多转了 0.2°：十字跟着机头一起转，偏移量不变
    const renderAttitude = rig.quaternion
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rad(0.2)));
    const renderNose = new THREE.Vector3(0, 0, -1).applyQuaternion(renderAttitude);
    const cross = rig.solver.getRenderAssistDirection(renderAttitude, 1);

    expect(cross).not.toBeNull();
    expect(toDeg(angleBetween(cross as THREE.Vector3, renderNose))).toBeCloseTo(2, 2);
  });

  describe('range of the gun cross', () => {
    function settledCrossRange(angle: number, range: number): number {
      const rig = createRig();
      addMover(rig, atAngle(rig, angle, range));
      run(rig, SETTLE_STEPS);
      return rig.solver.getRenderAssistDistance(1);
    }

    it('is 600 m with no assist', () => {
      const rig = createRig();
      run(rig, 5);

      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
      expect(rig.solver.getRenderAssistDistance(0)).toBe(REFERENCE_RANGE);
    });

    it.each([150, 300, 450])('is the range of the aim point (%s m) under full assist', (range) => {
      expect(settledCrossRange(1.5, range)).toBeCloseTo(range, 6);
    });

    it.each([20, 60, 99])('is never nearer than 100 m (aim point at %s m)', (range) => {
      expect(settledCrossRange(1.5, range)).toBeCloseTo(CROSS_MIN_RANGE, 6);
    });

    it('is the range of the lead point, not of the aircraft', () => {
      const rig = createRig();
      // 敌机在正前方 300 米，以 30 m/s 直线远离：子弹要飞到约 428 米才追上
      const velocity = new THREE.Vector3(0, 0, -30);
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300 + 30 * SETTLE_STEPS * DT), velocity);
      run(rig, SETTLE_STEPS);

      const leadRange = leadPointOf(rig, mover).distanceTo(rig.muzzle);
      expect(mover.object.position.distanceTo(rig.muzzle)).toBeCloseTo(300, 6);
      expect(leadRange).toBeGreaterThan(400);
      // 提前量点每秒远离 40 多米；十字的距离跟着它走，相差不过一两米
      expect(Math.abs(rig.solver.getRenderAssistDistance(1) - leadRange)).toBeLessThan(3);
    });

    it('still pulls the cross to the range of a target exactly on the nose', () => {
      const rig = createRig();
      addMover(rig, atAngle(rig, 0, 250));
      run(rig, SETTLE_STEPS);

      expect(rig.solver.getRenderAssistDistance(1)).toBeCloseTo(250, 6);
      const cross = rig.solver.getRenderAssistDirection(rig.quaternion, 1);
      expect(cross, 'the cross needs a direction to be drawn at that range').not.toBeNull();
      expect(angleBetween(cross as THREE.Vector3, rig.forward)).toBeLessThan(1e-9);
    });

    it('lies between the aim point and 600 m while the assist fades', () => {
      const inFade = settledCrossRange(3.75, 300);

      expect(inFade).toBeGreaterThan(300);
      expect(inFade).toBeLessThan(REFERENCE_RANGE);
      expect(settledCrossRange(4.6, 300)).toBeGreaterThan(inFade);
    });

    it('is 600 m again beyond 5° and beyond 480 m', () => {
      expect(settledCrossRange(6, 300)).toBe(REFERENCE_RANGE);
      expect(settledCrossRange(1.5, 500)).toBe(REFERENCE_RANGE);
    });

    it('slides in and out with the assist instead of jumping', () => {
      const rig = createRig();
      const mover = addMover(rig, atAngle(rig, 1.5, 300));
      const ranges: number[] = [];
      for (let i = 0; i < 40; i += 1) {
        step(rig);
        ranges.push(rig.solver.getRenderAssistDistance(1));
      }
      const firstPulled = ranges.findIndex((range) => range < REFERENCE_RANGE);
      expect(firstPulled).toBeGreaterThanOrEqual(0);
      expect(ranges[firstPulled]).toBeGreaterThan(300 + 0.4 * 300);
      const atEaseTime = ranges[firstPulled + Math.round(EASE_TIME / DT) - 1];
      expect(atEaseTime).toBeLessThan(300 + 0.1 * 300);
      expect(atEaseTime).toBeGreaterThan(300 + 0.01 * 300);
      for (let i = 1; i < ranges.length; i += 1) {
        expect(ranges[i]).toBeLessThanOrEqual(ranges[i - 1] + 1e-9);
      }

      removeMover(rig, mover);
      step(rig);
      const afterOne = rig.solver.getRenderAssistDistance(1);
      expect(afterOne).toBeGreaterThan(300);
      expect(afterOne).toBeLessThan(REFERENCE_RANGE);
      // 这一步开始时十字还在原来的距离上
      expect(rig.solver.getRenderAssistDistance(0)).toBeCloseTo(300, 3);
      run(rig, 60);
      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY])(
      'treats an alpha of %s as the current step',
      (alpha) => {
        const rig = createRig();
        addMover(rig, atAngle(rig, 1.5, 300));
        run(rig, 6);

        expect(rig.solver.getRenderAssistDistance(alpha)).toBe(
          rig.solver.getRenderAssistDistance(1)
        );
      }
    );
  });
});

/**
 * 同一套规则，按锥角档位各走一遍：显式传 'touch'，以及 'keyboard'。full / outer 是这一档的两个角
 * （度，取自规格）；用例里的角度按它们的比例给，所以两档跑的是同一批用例。
 * 换目标的 0.75°、480 米、0.1 秒是两档共用的，用例里直接写数。
 */
interface ConeSpec {
  /** update 的第 7 个参数 */
  cone: GunAssistCone;
  /** θ 不超过它：辅助方向正对瞄准点；也是偏移的上限 */
  full: number;
  /** 从 full 到它：偏移平滑减到零；再往外不辅助 */
  outer: number;
}

const CONES: ConeSpec[] = [
  { cone: 'touch', full: FULL_DEG, outer: OUTER_DEG },
  { cone: 'keyboard', full: KEYBOARD_FULL_DEG, outer: KEYBOARD_OUTER_DEG },
];

describe.each(CONES)('gun aim assist with the cone argument $cone ($full° / $outer°)', (spec) => {
  const coneRig = (options: RigOptions = {}): Rig => createRig({ ...options, cone: spec.cone });
  const settled = (angle: number, bearing = 0, range = 300): number =>
    settledShift(angle, bearing, range, spec.cone);
  /** 全量区里的一个角：从机头（0）到 full（1） */
  const inFull = (fraction: number): number => spec.full * fraction;
  /** 渐弱区里的一个角：从 full（0）到 outer（1） */
  const inFade = (fraction: number): number => spec.full + (spec.outer - spec.full) * fraction;

  describe('inside the full angle', () => {
    it.each([
      [0.08, 0],
      [0.4, 0],
      [0.4, 90],
      [0.68, 200],
      [0.96, 310],
      [1, 45],
    ])(
      'points exactly at an aim point %s of the way out to it (bearing %s°)',
      (fraction, bearing) => {
        const rig = coneRig();
        const angle = inFull(fraction);
        const point = atAngle(rig, angle, 300, bearing);
        addMover(rig, point);

        run(rig, SETTLE_STEPS);

        expect(errorDeg(rig, point)).toBeLessThan(1e-6);
        expect(shiftDeg(rig)).toBeCloseTo(angle, 6);
        expect(rig.solver.getAssistWeight()).toBeCloseTo(1, 6);
      }
    );

    it.each([40, 150, 300, 479])('does so at %s m', (range) => {
      const rig = coneRig();
      const point = atAngle(rig, inFull(0.8), range, 120);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it('works from the muzzle and the nose, wherever the aircraft is and however it is banked', () => {
      const rig = coneRig({
        muzzle: new THREE.Vector3(1200, 260, -430),
        quaternion: awkwardAttitude(),
      });
      const angle = inFull(0.88);
      const point = atAngle(rig, angle, 350, 250);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(offNoseDeg(rig, point)).toBeCloseTo(angle, 6);
      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it('leaves the direction on the nose for a target exactly on the nose', () => {
      const rig = coneRig();
      addMover(rig, atAngle(rig, 0, 300));

      run(rig, SETTLE_STEPS);

      expect(shiftDeg(rig)).toBeLessThan(1e-9);
    });

    it('aims at the lead point of a moving aircraft, so the bullet meets it', () => {
      const rig = coneRig();
      const angle = inFull(0.6);
      // 提前量点在机头右侧、250 米；敌机以 40 m/s 向右横穿，机体本身还在机头左侧 15° 外
      const lead = atAngle(rig, angle, 250);
      const velocity = new THREE.Vector3(40, 0, 0);
      const flightTime = lead.distanceTo(rig.muzzle) / BULLET_SPEED;
      const finalPosition = lead.clone().addScaledVector(velocity, -flightTime);
      const mover = addMover(
        rig,
        finalPosition.clone().addScaledVector(velocity, -SETTLE_STEPS * DT),
        velocity
      );

      run(rig, SETTLE_STEPS);

      expect(offNoseDeg(rig, mover.object.position)).toBeGreaterThan(15);
      expect(errorDeg(rig, leadPointOf(rig, mover))).toBeLessThan(1e-4);
      expect(missDistance(rig, assisted(rig), mover)).toBeLessThan(0.01);
      // 不辅助的话这一枪会从目标旁边飞过去
      expect(missDistance(rig, rig.forward, mover)).toBeGreaterThan(
        0.8 * 250 * Math.sin(rad(angle))
      );
    });

    it('measures the angle to the lead point, not to the aircraft', () => {
      const rig = coneRig();
      // 机体就在全量区里，但它横穿得很快，提前量点远在锥外：不辅助
      const velocity = new THREE.Vector3(40, 0, 0);
      const finalPosition = atAngle(rig, inFull(0.4), 300);
      const mover = addMover(
        rig,
        finalPosition.clone().addScaledVector(velocity, -SETTLE_STEPS * DT),
        velocity
      );

      run(rig, SETTLE_STEPS);

      expect(offNoseDeg(rig, mover.object.position)).toBeCloseTo(inFull(0.4), 6);
      expect(offNoseDeg(rig, leadPointOf(rig, mover))).toBeGreaterThan(spec.outer);
      expect(shiftDeg(rig)).toBe(0);
    });

    it('aims at a ground or sea unit just as it does at an aircraft', () => {
      const rig = coneRig();
      rig.airCount = 0;
      const point = atAngle(rig, inFull(0.72), 300, 270);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
      // 地面 / 海面单位不显示提前量标记
      expect(rig.solver.getPipTarget()).toBeNull();
    });

    it('picks the aim point nearest the nose, not the nearest target', () => {
      const rig = coneRig();
      const near = addMover(rig, atAngle(rig, inFull(0.92), 150, 0));
      const far = addMover(rig, atAngle(rig, inFull(0.32), 420, 180));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getAssistTarget()).toBe(far.object);
      expect(errorDeg(rig, far.object.position)).toBeLessThan(1e-6);
      expect(errorDeg(rig, near.object.position)).toBeGreaterThan(spec.full);
    });
  });

  describe('between the full angle and the outer angle', () => {
    /** 渐弱区里均匀取 51 个角 */
    const ANGLES: number[] = [];
    for (let i = 0; i <= 50; i += 1) ANGLES.push(inFade(i / 50));
    const STEP = (spec.outer - spec.full) / 50;

    it('shifts less and less as the aim point moves out', () => {
      const shifts = ANGLES.map((angle) => settled(angle));

      for (let i = 1; i < shifts.length; i += 1) {
        expect(shifts[i], `at ${ANGLES[i].toFixed(3)}°`).toBeLessThan(shifts[i - 1]);
      }
    });

    it('never shifts by more than the full angle', () => {
      for (const angle of ANGLES) {
        expect(settled(angle), `at ${angle.toFixed(3)}°`).toBeLessThanOrEqual(spec.full + 1e-9);
      }
    });

    it('is continuous where the fade starts: just past the full angle the shift is still about full', () => {
      expect(settled(spec.full + 0.01)).toBeGreaterThan(spec.full - 0.02);
      expect(settled(spec.full - 0.01)).toBeCloseTo(spec.full - 0.01, 6);
    });

    it('is continuous where the fade ends: just inside the outer angle the shift is about zero', () => {
      expect(settled(spec.outer - 0.01)).toBeLessThan(0.02);
      expect(settled(spec.outer - 0.01)).toBeGreaterThanOrEqual(0);
    });

    it('fades without a jump anywhere in between', () => {
      const shifts = ANGLES.map((angle) => settled(angle));

      for (let i = 1; i < shifts.length; i += 1) {
        // 瞄准点每挪一小步，偏移的变化不超过这一步的两倍
        expect(shifts[i - 1] - shifts[i], `at ${ANGLES[i].toFixed(3)}°`).toBeLessThan(2 * STEP);
      }
    });

    it('is a real fade: half way out the shift is neither full nor gone', () => {
      const shift = settled(inFade(0.5));

      expect(shift).toBeGreaterThan(0.2 * spec.full);
      expect(shift).toBeLessThan(0.8 * spec.full);
    });

    it.each([0.12, 0.4, 0.76])(
      'shifts straight towards an aim point %s of the way through the fade',
      (fraction) => {
        const rig = coneRig({ quaternion: awkwardAttitude() });
        const angle = inFade(fraction);
        const point = atAngle(rig, angle, 300, 140);
        addMover(rig, point);

        run(rig, SETTLE_STEPS);

        const shift = shiftDeg(rig);
        expect(shift).toBeGreaterThan(0);
        // 辅助方向落在“机头 → 瞄准点”的弧上：离瞄准点还差 θ − 偏移
        expect(errorDeg(rig, point)).toBeCloseTo(angle - shift, 6);
      }
    );

    it('depends only on the angle: the same in every direction around the nose', () => {
      const reference = settled(inFade(0.4), 0);

      for (const bearing of [45, 90, 180, 233, 300]) {
        expect(settled(inFade(0.4), bearing), `bearing ${bearing}°`).toBeCloseTo(reference, 9);
      }
    });

    it('depends only on the angle: the same at any range inside 480 m', () => {
      const reference = settled(inFade(0.4), 0, 300);

      for (const range of [60, 150, 470]) {
        expect(settled(inFade(0.4), 0, range), `${range} m`).toBeCloseTo(reference, 9);
      }
    });
  });

  describe('nothing beyond the outer angle or beyond 480 m', () => {
    it('at exactly the outer angle', () => {
      const rig = coneRig();
      addMover(rig, atAngle(rig, spec.outer, 300));

      run(rig, SETTLE_STEPS);

      // 正好在边界上：浮点误差以内就是零
      expect(shiftDeg(rig)).toBeLessThan(1e-12);
      expect(rig.solver.getAssistWeight()).toBeLessThan(1e-12);
    });

    it.each([spec.outer + 0.01, spec.outer * 1.2, spec.outer + 2, 10, 45, 120])(
      'at %s° off the nose',
      (angle) => {
        const rig = coneRig();
        addMover(rig, atAngle(rig, angle, 300));

        run(rig, SETTLE_STEPS);

        expect(shiftDeg(rig)).toBe(0);
        expect(rig.solver.getAssistWeight()).toBe(0);
        expect(rig.solver.getAssistTarget()).toBeNull();
        expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
      }
    );

    it('does not let a target outside the cone keep the assist off one inside it', () => {
      const rig = coneRig();
      // 先到的目标在锥外 0.5°，后到的在锥内 0.1°：两者相差不到 0.75°，但锥外的目标本来就不算数
      addMover(rig, atAngle(rig, spec.outer + 0.5, 300, 0));
      run(rig, SETTLE_STEPS);
      const inside = addMover(rig, atAngle(rig, spec.outer - 0.1, 300, 180));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getAssistTarget()).toBe(inside.object);
      expect(shiftDeg(rig)).toBeGreaterThan(0);
      expect(shiftDeg(rig)).toBeCloseTo(settled(spec.outer - 0.1), 9);
    });

    it.each([481, 500, 650])('for a target %s m away', (range) => {
      const rig = coneRig();
      addMover(rig, atAngle(rig, inFull(0.6), range));

      run(rig, SETTLE_STEPS);

      expect(shiftDeg(rig)).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
    });

    it('but a full shift just inside 480 m', () => {
      const rig = coneRig();
      const point = atAngle(rig, inFull(0.6), 479);
      addMover(rig, point);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it('for a target that has only just appeared (no reliable solution yet)', () => {
      const rig = coneRig();
      addMover(rig, atAngle(rig, inFull(0.6), 300));

      for (let i = 0; i < 3; i += 1) {
        step(rig);
        expect(shiftDeg(rig), `update ${i + 1}`).toBe(0);
      }
    });

    it('when the caller switches the assist off', () => {
      const rig = coneRig({ assist: false });
      addMover(rig, atAngle(rig, inFull(0.6), 300));

      for (let i = 0; i < SETTLE_STEPS; i += 1) {
        step(rig);
        expect(shiftDeg(rig), `step ${i}`).toBe(0);
        expect(rig.solver.getAssistWeight(), `step ${i}`).toBe(0);
      }
    });
  });

  describe('never more than the full angle', () => {
    it('for an aim point anywhere from the nose out past the cone', () => {
      let largest = 0;
      for (let angle = 0; angle <= spec.outer + 1; angle += 0.05) {
        const shift = settled(angle);
        expect(shift, `at ${angle.toFixed(2)}°`).toBeLessThanOrEqual(spec.full + 1e-9);
        largest = Math.max(largest, shift);
      }
      // 这个上限是够得着的
      expect(largest).toBeGreaterThan(spec.full - 0.05);
    });

    it('at any moment of an eventful flight, for the bullets and for the cross', () => {
      let largest = 0;
      eventfulFlight((rig, label) => {
        const bullets = toDeg(angleBetween(assisted(rig), rig.forward));
        expect(bullets, `${label}: bullets`).toBeLessThanOrEqual(spec.full + 1e-9);
        expect(
          toDeg(angleBetween(rendered(rig, 1), rig.forward)),
          `${label}: cross`
        ).toBeLessThanOrEqual(spec.full + 1e-9);
        // 两步之间的十字：上一步的偏移画在这一步的机头上，机头一步转 0.05°，留一点余量
        for (const alpha of [0, 0.5]) {
          expect(
            toDeg(angleBetween(rendered(rig, alpha), rig.forward)),
            `${label}: cross at alpha ${alpha}`
          ).toBeLessThanOrEqual(spec.full + 1e-3);
        }
        largest = Math.max(largest, bullets);
      }, spec.cone);
      expect(largest).toBeGreaterThan(0.9 * spec.full);
    });
  });

  describe('easing', () => {
    const ANGLE = inFull(0.8);

    /** 目标出现后每一步的“已完成比例”（偏移 / 最终偏移），第一个元素是出现后的第一步 */
    function easeIn(dt: number): number[] {
      const rig = coneRig();
      addMover(rig, atAngle(rig, ANGLE, 300));
      const progress: number[] = [];
      for (let i = 0; i < Math.round(1 / dt) + 10; i += 1) {
        step(rig, dt);
        const shift = shiftDeg(rig);
        if (shift > 0 || progress.length > 0) progress.push(shift / ANGLE);
      }
      return progress;
    }

    /** 目标消失后每一步的“剩余比例”，第一个元素是消失后的第一步 */
    function easeOut(dt: number): number[] {
      const rig = coneRig();
      const mover = addMover(rig, atAngle(rig, ANGLE, 300));
      run(rig, Math.round(1.5 / dt), dt);
      expect(shiftDeg(rig)).toBeCloseTo(ANGLE, 6);
      removeMover(rig, mover);
      const remaining: number[] = [];
      for (let i = 0; i < Math.round(1 / dt); i += 1) {
        step(rig, dt);
        remaining.push(shiftDeg(rig) / ANGLE);
      }
      return remaining;
    }

    const RATES = [1 / 30, 1 / 60, 1 / 120];

    it('slides in when a target appears instead of jumping', () => {
      const progress = easeIn(DT);

      expect(progress[0]).toBeGreaterThan(0);
      expect(progress[0]).toBeLessThan(0.6);
      for (let i = 1; i < progress.length; i += 1) {
        expect(progress[i], `step ${i}`).toBeGreaterThanOrEqual(progress[i - 1] - 1e-12);
      }
      expect(progress[progress.length - 1]).toBeCloseTo(1, 6);
    });

    it.each(RATES)('is about 95%% of the way 0.1 s after a target appears (step %s s)', (dt) => {
      const progress = easeIn(dt);
      const atEaseTime = progress[Math.round(EASE_TIME / dt) - 1];

      expect(atEaseTime).toBeGreaterThan(0.9);
      expect(atEaseTime).toBeLessThan(0.99);
    });

    it('slides back to the nose when the target disappears instead of snapping', () => {
      const remaining = easeOut(DT);

      expect(remaining[0]).toBeGreaterThan(0.4);
      expect(remaining[0]).toBeLessThan(1);
      for (let i = 1; i < remaining.length; i += 1) {
        expect(remaining[i], `step ${i}`).toBeLessThanOrEqual(remaining[i - 1] + 1e-12);
      }
    });

    it.each(RATES)('has about 5%% left 0.1 s after the target disappears (step %s s)', (dt) => {
      const remaining = easeOut(dt);
      const atEaseTime = remaining[Math.round(EASE_TIME / dt) - 1];

      expect(atEaseTime).toBeGreaterThan(0.01);
      expect(atEaseTime).toBeLessThan(0.1);
    });

    it.each(RATES)('ends up exactly on the nose axis again (step %s s)', (dt) => {
      const remaining = easeOut(dt);

      expect(remaining[remaining.length - 1]).toBe(0);
    });

    it('slides out the same way when the range opens beyond 480 m', () => {
      const rig = coneRig();
      const mover = addMover(rig, atAngle(rig, ANGLE, 470));
      run(rig, SETTLE_STEPS);
      expect(shiftDeg(rig)).toBeCloseTo(ANGLE, 6);

      // 目标不动，把炮口沿机头反方向每步挪 1 米：距离拉开到 480 米以外
      const shifts: number[] = [];
      let lastInRange = 0;
      for (let i = 0; i < 60; i += 1) {
        rig.muzzle.addScaledVector(rig.forward, -1);
        step(rig);
        if (mover.object.position.distanceTo(rig.muzzle) > MAX_RANGE) shifts.push(shiftDeg(rig));
        else lastInRange = shiftDeg(rig);
      }

      expect(lastInRange).toBeGreaterThan(0.95 * ANGLE);
      // 出了射程的第一步：偏移还剩一大半，而不是直接归零
      expect(shifts[0]).toBeGreaterThan(0.4 * ANGLE);
      expect(shifts[0]).toBeLessThan(lastInRange);
      expect(shifts[shifts.length - 1]).toBe(0);
      for (let i = 1; i < shifts.length; i += 1) {
        expect(shifts[i], `step ${i}`).toBeLessThanOrEqual(shifts[i - 1] + 1e-12);
      }
    });

    it('slides from one target to the next when the first is gone', () => {
      const rig = coneRig();
      const first = addMover(rig, atAngle(rig, inFull(0.6), 300, 0));
      const second = addMover(rig, atAngle(rig, inFull(0.88), 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(first.object);
      const from = assisted(rig);
      const to = directionTo(rig, second.object.position);
      const span = angleBetween(from, to);

      removeMover(rig, first);
      const progress: number[] = [];
      for (let i = 0; i < 60; i += 1) {
        step(rig);
        progress.push(angleBetween(assisted(rig), from) / span);
      }

      expect(rig.solver.getAssistTarget()).toBe(second.object);
      expect(progress[0]).toBeGreaterThan(0);
      expect(progress[0]).toBeLessThan(0.6);
      const atEaseTime = progress[Math.round(EASE_TIME / DT) - 1];
      expect(atEaseTime).toBeGreaterThan(0.9);
      expect(atEaseTime).toBeLessThan(0.99);
      expect(progress[progress.length - 1]).toBeCloseTo(1, 6);
      for (let i = 1; i < progress.length; i += 1) {
        expect(progress[i], `step ${i}`).toBeGreaterThanOrEqual(progress[i - 1] - 1e-12);
      }
      expect(errorDeg(rig, second.object.position)).toBeLessThan(1e-4);
    });
  });

  describe('holding a target', () => {
    it('does not lag when the nose sweeps across a target inside the full angle', () => {
      const rig = coneRig();
      const point = atAngle(rig, inFull(0.8), 300, 0);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);

      // 机头向右扫过目标：从目标在右侧 0.8 × full 到在左侧 0.8 × full
      const perStep = (2 * inFull(0.8)) / 80;
      for (let i = 0; i < 80; i += 1) {
        yawRight(rig, perStep);
        step(rig);
        expect(offNoseDeg(rig, point), `step ${i}`).toBeLessThan(spec.full);
        expect(errorDeg(rig, point), `step ${i}`).toBeLessThan(1e-6);
      }
      expect(offNoseDeg(rig, point)).toBeCloseTo(inFull(0.8), 1);
    });

    it('follows the fade without lag as the nose drifts away from the target', () => {
      const rig = coneRig();
      const point = atAngle(rig, inFade(0.04), 300, 0);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);

      // 机头向左转开：瞄准点从渐弱区的开头滑到快要出锥
      const perStep = (inFade(0.96) - inFade(0.04)) / 68;
      for (let i = 0; i < 68; i += 1) {
        yawRight(rig, -perStep);
        step(rig);
        const angle = offNoseDeg(rig, point);
        expect(angle, `step ${i}`).toBeLessThan(spec.outer);
        expect(shiftDeg(rig), `step ${i} at ${angle.toFixed(3)}°`).toBeCloseTo(settled(angle), 6);
      }
      expect(offNoseDeg(rig, point)).toBeGreaterThan(inFade(0.9));
    });

    it('fades out without a jump when the aim point leaves the cone', () => {
      const rig = coneRig();
      const point = atAngle(rig, inFade(0.6), 300, 0);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);

      // 机头每步转开渐弱区宽度的 1/75
      const perStep = (spec.outer - spec.full) / 75;
      let previous = shiftDeg(rig);
      for (let i = 0; i < 90; i += 1) {
        yawRight(rig, -perStep);
        step(rig);
        const shift = shiftDeg(rig);
        expect(Math.abs(shift - previous), `step ${i}`).toBeLessThan(3 * perStep);
        previous = shift;
      }
      expect(offNoseDeg(rig, point)).toBeGreaterThan(spec.outer);
      expect(previous).toBe(0);
    });
  });

  describe('taking over from a held target', () => {
    // 被压住的目标在机头右侧 2°：触屏档里它在全量区，键盘档里在渐弱区，两档里都算数
    const HELD = 2;

    /** 先压住 HELD 处的目标，再让第二个目标出现在左侧 secondAngle 度 */
    function heldThenSecond(secondAngle: number): { rig: Rig; first: Mover; second: Mover } {
      const rig = coneRig();
      const first = addMover(rig, atAngle(rig, HELD, 300, 0));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(first.object);
      const second = addMover(rig, atAngle(rig, secondAngle, 300, 180));
      run(rig, SETTLE_STEPS);
      return { rig, first, second };
    }

    it.each([1.9, 1.6, 1.3])(
      'keeps the held target when another is only a little nearer the nose (%s° against 2°)',
      (angle) => {
        const { rig, first } = heldThenSecond(angle);

        expect(rig.solver.getAssistTarget()).toBe(first.object);
        // 偏移仍然是按被压住的那个目标算的，方向也朝着它
        expect(shiftDeg(rig)).toBeCloseTo(settled(HELD), 9);
        expect(errorDeg(rig, first.object.position)).toBeCloseTo(HELD - settled(HELD), 6);
      }
    );

    it.each([1.2, 0.9, 0.2])(
      'hands over when another is nearer the nose by more than 0.75° (%s° against 2°)',
      (angle) => {
        const { rig, second } = heldThenSecond(angle);

        expect(rig.solver.getAssistTarget()).toBe(second.object);
        expect(errorDeg(rig, second.object.position)).toBeLessThan(1e-6);
      }
    );

    it('needs no margin when nothing is held: the nearer of two new targets wins', () => {
      const rig = coneRig();
      addMover(rig, atAngle(rig, HELD, 300, 0));
      const nearer = addMover(rig, atAngle(rig, HELD - 0.1, 300, 180));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getAssistTarget()).toBe(nearer.object);
    });

    it('does not hop back and forth between two targets about equally near the nose', () => {
      const rig = coneRig();
      const right = addMover(rig, atAngle(rig, 2, 300, 0));
      const left = addMover(rig, atAngle(rig, 1.8, 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(left.object);
      const level = rig.quaternion.clone();

      // 机头左右摆 ±0.3°：谁离机头近在两者之间来回换，但另一个目标近出的量到不了 0.75°
      let rightWasNearer = false;
      for (let i = 0; i < 240; i += 1) {
        setAttitude(rig, level);
        yawRight(rig, 0.3 * Math.sin(i / 8));
        step(rig);
        const rightAngle = offNoseDeg(rig, right.object.position);
        const leftAngle = offNoseDeg(rig, left.object.position);
        if (rightAngle < leftAngle - 0.2) rightWasNearer = true;
        expect(leftAngle - rightAngle, `step ${i}`).toBeLessThan(SWITCH_MARGIN_DEG);
        expect(rig.solver.getAssistTarget(), `step ${i}`).toBe(left.object);
      }
      expect(rightWasNearer, 'the other target should have been the nearer one at times').toBe(
        true
      );

      // 摆得再大一点，差距超过 0.75°：这才换过去
      setAttitude(rig, level);
      yawRight(rig, 0.6);
      run(rig, 10);
      expect(
        offNoseDeg(rig, left.object.position) - offNoseDeg(rig, right.object.position)
      ).toBeGreaterThan(SWITCH_MARGIN_DEG);
      expect(rig.solver.getAssistTarget()).toBe(right.object);
    });

    it('takes whatever is left when the held target leaves the cone', () => {
      const rig = coneRig();
      const held = addMover(rig, atAngle(rig, inFull(0.4), 300, 0));
      const other = addMover(rig, atAngle(rig, inFull(0.56), 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(held.object);

      // 被压住的目标飞到锥外
      held.velocity.set(40, 0, 0);
      run(rig, 120);

      expect(offNoseDeg(rig, held.object.position)).toBeGreaterThan(spec.outer);
      expect(rig.solver.getAssistTarget()).toBe(other.object);
      expect(errorDeg(rig, other.object.position)).toBeLessThan(1e-4);
    });
  });

  describe('reset', () => {
    it('returns to the nose axis at once, then slides in again', () => {
      const rig = coneRig();
      const point = atAngle(rig, inFull(0.8), 300);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);
      expect(shiftDeg(rig)).toBeCloseTo(inFull(0.8), 6);

      rig.solver.reset();

      expect(shiftDeg(rig)).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
      expect(rig.solver.getAssistTarget()).toBeNull();
      expect(toDeg(angleBetween(rendered(rig, 0), rig.forward))).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 1), rig.forward))).toBe(0);
      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);

      const shifts: number[] = [];
      for (let i = 0; i < SETTLE_STEPS; i += 1) {
        step(rig);
        shifts.push(shiftDeg(rig));
      }
      const firstShifted = shifts.findIndex((shift) => shift > 0);
      expect(firstShifted).toBeGreaterThanOrEqual(2);
      expect(shifts[firstShifted]).toBeLessThan(0.6 * inFull(0.8));
      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });
  });

  describe('bad input', () => {
    const BAD = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const ANGLE = inFull(0.8);

    function settledRig(): { rig: Rig; point: THREE.Vector3 } {
      const rig = coneRig();
      const point = atAngle(rig, ANGLE, 300);
      addMover(rig, point);
      run(rig, SETTLE_STEPS);
      expect(shiftDeg(rig)).toBeCloseTo(ANGLE, 6);
      return { rig, point };
    }

    function expectNoAssist(rig: Rig): void {
      // 这一步子弹与十字都回到机头轴线上（不是从上一步滑回来），强度归零
      expect(shiftDeg(rig)).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 1), rig.forward))).toBe(0);
      expect(toDeg(angleBetween(rendered(rig, 0), rig.forward))).toBe(0);
      expect(rig.solver.getAssistWeight()).toBe(0);
      expect(rig.solver.getAssistTarget()).toBeNull();
      expect(rig.solver.getRenderAssistDistance(1)).toBe(REFERENCE_RANGE);
    }

    it.each(BAD)('gives no assist when the muzzle position is %s', (value) => {
      const { rig } = settledRig();
      const good = rig.muzzle.clone();

      rig.muzzle.set(0, value, 0);
      step(rig);
      rig.muzzle.copy(good);

      expectNoAssist(rig);
    });

    it.each(BAD)('gives no assist when the nose direction is %s', (value) => {
      const { rig } = settledRig();
      const good = rig.forward.clone();

      rig.forward.set(value, 0, -1);
      step(rig);
      rig.forward.copy(good);

      expectNoAssist(rig);
    });

    it('picks the target up again once the input is sound', () => {
      const { rig, point } = settledRig();
      const good = rig.muzzle.clone();
      rig.muzzle.set(Number.NaN, 0, 0);
      step(rig);
      rig.muzzle.copy(good);

      run(rig, SETTLE_STEPS);

      expect(errorDeg(rig, point)).toBeLessThan(1e-6);
    });

    it.each(BAD)('ignores a target whose position is %s', (value) => {
      const rig = coneRig();
      const broken = addMover(rig, atAngle(rig, inFull(0.4), 300));
      const sound = addMover(rig, atAngle(rig, inFull(0.8), 300, 180));
      run(rig, SETTLE_STEPS);
      expect(rig.solver.getAssistTarget()).toBe(broken.object);

      broken.object.position.set(value, 0, -300);
      for (let i = 0; i < SETTLE_STEPS; i += 1) {
        step(rig);
        expectFiniteDirection(assisted(rig), `step ${i}`);
        expect(shiftDeg(rig), `step ${i}`).toBeLessThanOrEqual(spec.full + 1e-9);
        expect(rig.solver.getAssistTarget(), `step ${i}`).not.toBe(broken.object);
      }

      expect(rig.solver.getAssistTarget()).toBe(sound.object);
      expect(errorDeg(rig, sound.object.position)).toBeLessThan(1e-4);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -DT])(
      'skips a time step of %s: nothing changes, and the next steps carry on as if it had not happened',
      (dt) => {
        const disturbed = settledRig().rig;
        const undisturbed = settledRig().rig;
        const before = snapshot(disturbed);
        expect(before.held).toBe(0);

        observe(disturbed, dt);

        expect(snapshot(disturbed)).toEqual(before);
        for (let i = 0; i < 30; i += 1) {
          step(disturbed);
          step(undisturbed);
          expect(snapshot(disturbed), `good step ${i}`).toEqual(snapshot(undisturbed));
        }
        expect(disturbed.solver.getAssistTarget()).toBe(disturbed.movers[0].object);
      }
    );
  });

  describe('assist strength', () => {
    function settledWeight(angle: number): number {
      const rig = coneRig();
      addMover(rig, atAngle(rig, angle, 300));
      run(rig, SETTLE_STEPS);
      return rig.solver.getAssistWeight();
    }

    it.each([0, 0.4, 0.96])('is full %s of the way out to the full angle', (fraction) => {
      expect(settledWeight(inFull(fraction))).toBeCloseTo(1, 6);
    });

    it('falls from full to nothing through the fade', () => {
      const fractions = [0.04, 0.2, 0.36, 0.52, 0.68, 0.84, 0.96];
      const weights = fractions.map((fraction) => settledWeight(inFade(fraction)));

      expect(weights[0]).toBeLessThanOrEqual(1);
      expect(weights[0]).toBeGreaterThan(0.9);
      for (let i = 1; i < weights.length; i += 1) {
        expect(weights[i], `${fractions[i]} of the way`).toBeLessThan(weights[i - 1]);
        expect(weights[i], `${fractions[i]} of the way`).toBeGreaterThan(0);
      }
      expect(weights[weights.length - 1]).toBeLessThan(0.1);
    });

    it('stays between 0 and 1 while it eases in and out', () => {
      const rig = coneRig();
      const mover = addMover(rig, atAngle(rig, inFull(0.4), 300));
      const weights: number[] = [];
      for (let i = 0; i < 40; i += 1) {
        step(rig);
        weights.push(rig.solver.getAssistWeight());
      }
      removeMover(rig, mover);
      for (let i = 0; i < 40; i += 1) {
        step(rig);
        weights.push(rig.solver.getAssistWeight());
      }

      for (const weight of weights) {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...weights)).toBeCloseTo(1, 3);
      expect(weights[weights.length - 1]).toBe(0);
      // 强度也是滑上去的，不是一步到位
      const firstAssisted = weights.find((weight) => weight > 0);
      expect(firstAssisted).toBeLessThan(0.6);
    });
  });

  describe('the gun cross', () => {
    function settledCrossRange(angle: number, range: number): number {
      const rig = coneRig();
      addMover(rig, atAngle(rig, angle, range));
      run(rig, SETTLE_STEPS);
      return rig.solver.getRenderAssistDistance(1);
    }

    it('is on the direction the bullets leave along at every step of an eventful flight', () => {
      let assistedSteps = 0;
      eventfulFlight((rig, label) => {
        const bullets = assisted(rig);
        expect(angleBetween(bullets, rendered(rig, 1)), label).toBeLessThan(1e-9);
        if (toDeg(angleBetween(bullets, rig.forward)) > 0.1) assistedSteps += 1;
      }, spec.cone);
      // 这段飞行里确实有很多步是带偏移的
      expect(assistedSteps).toBeGreaterThan(60);
    });

    it.each([150, 300, 450])(
      'is drawn at the range of the aim point (%s m) under full assist',
      (range) => {
        expect(settledCrossRange(inFull(0.6), range)).toBeCloseTo(range, 6);
      }
    );

    it.each([20, 60, 99])('is never nearer than 100 m (aim point at %s m)', (range) => {
      expect(settledCrossRange(inFull(0.6), range)).toBeCloseTo(CROSS_MIN_RANGE, 6);
    });

    it('is drawn between the aim point and 600 m while the assist fades', () => {
      const halfWay = settledCrossRange(inFade(0.5), 300);

      expect(halfWay).toBeGreaterThan(300);
      expect(halfWay).toBeLessThan(REFERENCE_RANGE);
      expect(settledCrossRange(inFade(0.84), 300)).toBeGreaterThan(halfWay);
    });

    it('is back at 600 m beyond the outer angle and beyond 480 m', () => {
      expect(settledCrossRange(spec.outer + 1, 300)).toBe(REFERENCE_RANGE);
      expect(settledCrossRange(inFull(0.6), 500)).toBe(REFERENCE_RANGE);
    });
  });

  // 提前量标记的“压住了”= 现在开火，子弹朝提前量点去。全量区里辅助把子弹送到点上，所以算压住；
  // 渐弱区靠外的地方子弹只转过去一点，离点还差十几米，不算。（规格没有单列这一条，是按这个标志的
  // 含义推出来的。）
  describe('the lead marker’s “on target”', () => {
    it('is set while the assist puts the bullets on the lead point', () => {
      const rig = coneRig();
      const mover = addMover(rig, atAngle(rig, inFull(0.96), 300));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getPipTarget()).toBe(mover.object);
      // 不辅助的话这一枪偏出 5 米以上；辅助之后正中
      expect(missDistance(rig, rig.forward, mover)).toBeGreaterThan(5);
      expect(missDistance(rig, assisted(rig), mover)).toBeLessThan(0.01);
      expect(rig.solver.isPipOnTarget()).toBe(true);
    });

    it('is not set far out in the fade, where the bullets still pass well wide', () => {
      const rig = coneRig();
      const mover = addMover(rig, atAngle(rig, inFade(0.8), 300));

      run(rig, SETTLE_STEPS);

      expect(rig.solver.getPipTarget()).toBe(mover.object);
      expect(shiftDeg(rig)).toBeGreaterThan(0);
      expect(missDistance(rig, assisted(rig), mover)).toBeGreaterThan(8);
      expect(rig.solver.isPipOnTarget()).toBe(false);
    });
  });
});

/** 解算器这一步对外给出的全部输出（原样的数，用来核对两份解算器是否完全一致） */
interface Snapshot {
  /** 子弹方向；没有辅助时为 null */
  bullet: number[] | null;
  /** 渲染帧十字方向，alpha = 0 / 0.5 / 1；十字就在机头轴线上时为 null */
  cross: Array<number[] | null>;
  /** 十字画在多远，alpha = 0 / 0.5 / 1 */
  crossRange: number[];
  weight: number;
  /** 辅助目标在 rig.movers 里的序号；没有为 -1 */
  held: number;
  /** 提前量标记的目标在 rig.movers 里的序号；没有为 -1 */
  marked: number;
  onTarget: boolean;
  leadPoint: number[] | null;
}

function snapshot(rig: Rig): Snapshot {
  const alphas = [0, 0.5, 1];
  const indexOf = (target: THREE.Object3D | null): number =>
    rig.movers.findIndex((mover) => mover.object === target);
  const lead = new THREE.Vector3();
  return {
    bullet: rig.solver.getAssistDirection()?.toArray() ?? null,
    cross: alphas.map(
      (alpha) => rig.solver.getRenderAssistDirection(rig.quaternion, alpha)?.toArray() ?? null
    ),
    crossRange: alphas.map((alpha) => rig.solver.getRenderAssistDistance(alpha)),
    weight: rig.solver.getAssistWeight(),
    held: indexOf(rig.solver.getAssistTarget()),
    marked: indexOf(rig.solver.getPipTarget()),
    onTarget: rig.solver.isPipOnTarget(),
    leadPoint: rig.solver.getPipPoint(lead) ? lead.toArray() : null,
  };
}

/** 机头慢慢转开再转回来：静止目标从机头正前方一路扫到 6°（两档锥角之外），再扫回来 */
function sweepFlight(visit: FlightVisitor, cone?: GunAssistCone): void {
  const rig = createRig({ cone });
  addMover(rig, atAngle(rig, 0, 300));
  for (let i = 0; i < 480; i += 1) {
    yawRight(rig, i < 240 ? 0.025 : -0.025);
    step(rig);
    visit(rig, `step ${i}`);
  }
}

/** 一段不太平的飞行：坏的时间步、坏的炮口位置、目标出了射程、reset */
function roughFlight(visit: FlightVisitor, cone?: GunAssistCone): void {
  const rig = createRig({ cone });
  // 2°：触屏档的全量区、键盘档的渐弱区
  addMover(rig, atAngle(rig, 2, 440, 60));
  const walk = (steps: number, label: string, each?: () => void): void => {
    for (let i = 0; i < steps; i += 1) {
      each?.();
      step(rig);
      visit(rig, `${label}, step ${i}`);
    }
  };
  walk(30, 'target appears');
  for (const dt of [Number.NaN, 0, -DT, Number.POSITIVE_INFINITY]) {
    observe(rig, dt);
    visit(rig, `a time step of ${dt}`);
  }
  walk(10, 'after the bad time steps');
  const muzzle = rig.muzzle.clone();
  rig.muzzle.set(Number.NaN, 0, 0);
  step(rig);
  visit(rig, 'a bad muzzle position');
  rig.muzzle.copy(muzzle);
  walk(30, 'after the bad muzzle position');
  walk(60, 'range opens past 480 m', () => rig.muzzle.addScaledVector(rig.forward, -1));
  rig.muzzle.copy(muzzle);
  walk(30, 'back in range');
  rig.solver.reset();
  visit(rig, 'reset');
  walk(30, 'after reset');
}

const FLIGHTS: Record<string, (visit: FlightVisitor, cone?: GunAssistCone) => void> = {
  'an eventful flight': eventfulFlight,
  'a slow sweep out of the cone and back': sweepFlight,
  'a rough flight': roughFlight,
};

/** 把一段飞行每一步的输出记下来 */
function record(name: string, cone?: GunAssistCone): Snapshot[] {
  const samples: Snapshot[] = [];
  FLIGHTS[name]((rig) => samples.push(snapshot(rig)), cone);
  return samples;
}

describe('touch: leaving the cone argument out and passing it explicitly', () => {
  it.each(Object.keys(FLIGHTS))('give exactly the same outputs at every step of %s', (name) => {
    const byDefault = record(name);
    const explicit = record(name, 'touch');

    expect(explicit).toEqual(byDefault);
    // 这段飞行里辅助确实在工作
    expect(byDefault.filter((sample) => sample.bullet !== null).length).toBeGreaterThan(60);
  });

  it.each(Object.keys(FLIGHTS))('give something else than the keyboard cone over %s', (name) => {
    expect(record(name, 'keyboard')).not.toEqual(record(name));
  });
});

describe('the keyboard cone against the touch cone', () => {
  const BOTH: GunAssistCone[] = ['touch', 'keyboard'];

  it.each([0.3, 0.8, 1.2, 1.25])(
    'inside 1.25° both point exactly at an aim point %s° off the nose',
    (angle) => {
      for (const cone of BOTH) {
        const rig = createRig({ cone });
        const point = atAngle(rig, angle, 300, 70);
        addMover(rig, point);

        run(rig, SETTLE_STEPS);

        expect(errorDeg(rig, point), cone).toBeLessThan(1e-6);
      }
    }
  );

  it.each([1.3, 1.6, 2, 2.4])(
    'at %s° touch still points at the aim point; the keyboard cone goes only part of the way',
    (angle) => {
      expect(settledShift(angle, 0, 300, 'touch')).toBeCloseTo(angle, 6);

      const keyboard = settledShift(angle, 0, 300, 'keyboard');
      expect(keyboard).toBeGreaterThan(0);
      expect(keyboard).toBeLessThan(KEYBOARD_FULL_DEG);
    }
  );

  it.each([2.5, 2.6, 3, 4, 4.9])(
    'at %s° touch still shifts; the keyboard cone does not',
    (angle) => {
      expect(settledShift(angle, 0, 300, 'touch')).toBeGreaterThan(0.001);
      // 2.5° 正好在键盘档的边界上：浮点误差以内就是零
      expect(settledShift(angle, 0, 300, 'keyboard')).toBeLessThan(1e-12);
    }
  );

  it('never shifts more than 1.25°, where touch reaches 2.5°', () => {
    const largest = { touch: 0, keyboard: 0 };
    for (let angle = 0; angle <= 6; angle += 0.05) {
      for (const cone of BOTH) {
        largest[cone] = Math.max(largest[cone], settledShift(angle, 0, 300, cone));
      }
    }

    expect(largest.keyboard).toBeLessThanOrEqual(KEYBOARD_FULL_DEG + 1e-9);
    expect(largest.keyboard).toBeGreaterThan(KEYBOARD_FULL_DEG - 0.05);
    expect(largest.touch).toBeLessThanOrEqual(FULL_DEG + 1e-9);
    expect(largest.touch).toBeGreaterThan(FULL_DEG - 0.05);
  });

  it('gives only part of the assist strength at 2°, where touch gives all of it', () => {
    const weight = (cone: GunAssistCone): number => {
      const rig = createRig({ cone });
      addMover(rig, atAngle(rig, 2, 300));
      run(rig, SETTLE_STEPS);
      return rig.solver.getAssistWeight();
    };

    // 强度决定散布收窄多少：触屏档在 2° 是全量，键盘档只有一部分
    expect(weight('touch')).toBeCloseTo(1, 6);
    expect(weight('keyboard')).toBeGreaterThan(0.05);
    expect(weight('keyboard')).toBeLessThan(0.95);
  });

  // 哪一档由设备决定，一局里不会变；这里只是确认“键盘档的一步不超过 1.25°”没有例外：
  // 上一步（触屏档）留下 2° 多的偏移，换成键盘档后目标落在锥外，偏移是滑回去的，但从第一步起就不超过 1.25°
  it('leaves at most 1.25° on a keyboard-cone step even straight after touch-cone steps', () => {
    const rig = createRig({ cone: 'touch' });
    addMover(rig, atAngle(rig, 3, 300));
    run(rig, SETTLE_STEPS);
    expect(shiftDeg(rig)).toBeGreaterThan(1.5);

    rig.cone = 'keyboard';
    for (let i = 0; i < 30; i += 1) {
      step(rig);
      expect(shiftDeg(rig), `step ${i}`).toBeLessThanOrEqual(KEYBOARD_FULL_DEG + 1e-9);
      expect(
        toDeg(angleBetween(rendered(rig, 1), rig.forward)),
        `cross, step ${i}`
      ).toBeLessThanOrEqual(KEYBOARD_FULL_DEG + 1e-9);
    }
    expect(shiftDeg(rig)).toBe(0);
  });
});
