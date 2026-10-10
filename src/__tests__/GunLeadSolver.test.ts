import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GunLeadSolver } from '@/features/combat/GunLeadSolver';

/**
 * 机炮提前量（W8）。期望值来自规格：
 * - 子弹 100 m/s；提前量点 = 现在开火的子弹与匀速直线目标相遇的位置；
 * - 提前量标记只给 500 米内、机头前方 40° 锥内的敌方飞机，并且速度估计可靠之后才给
 *   （至少三个连续样本；瞬移或刚出现的目标没有）；
 * - 无解（目标比子弹快且在远离）：没有标记，而不是 NaN。
 *
 * 相遇条件用定义直接验证（子弹飞到该点的时间里，目标也恰好到达该点），
 * 不照抄被测代码的二次方程。只走公开行为（update / getPipTarget / getPipPoint /
 * isPipOnTarget / reset），解算器再加别的输出不影响这里。
 *
 * 触屏机炮辅助（原 W9：2.5° / 480 米内把子弹送到提前量点）正在改成连续、有界的辅助，
 * 旧规则不在这里固定；update 的 assistEnabled 参数一律传 false。
 */

const BULLET_SPEED = 100;
const DT = 1 / 60;
/** 足够让速度估计“可靠”的更新次数（规格：至少三个连续样本） */
const WARM_UPDATES = 6;

interface Mover {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
}

interface Rig {
  solver: GunLeadSolver;
  muzzle: THREE.Vector3;
  forward: THREE.Vector3;
  movers: Mover[];
  /** 列表前多少个是空中目标 */
  airCount: number | null;
}

function createRig(): Rig {
  return {
    solver: new GunLeadSolver(),
    muzzle: new THREE.Vector3(0, 0, 0),
    forward: new THREE.Vector3(0, 0, -1),
    movers: [],
    airCount: null,
  };
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

function update(rig: Rig, dt = DT): void {
  const targets = rig.movers.map((mover) => mover.object);
  rig.solver.update(dt, rig.muzzle, rig.forward, targets, rig.airCount ?? targets.length, false);
}

/** 每步先让目标按速度前进，再让解算器观测一次；结束时目标停在最后一次观测的位置 */
function fly(rig: Rig, updates: number, dt = DT): void {
  for (let i = 0; i < updates; i += 1) {
    for (const mover of rig.movers) {
      mover.object.position.addScaledVector(mover.velocity, dt);
    }
    update(rig, dt);
  }
}

/** 让目标在最后一次观测时恰好位于 position：从 position 沿速度反推起点 */
function addMoverArrivingAt(
  rig: Rig,
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  updates = WARM_UPDATES
): Mover {
  const start = position.clone().addScaledVector(velocity, -updates * DT);
  return addMover(rig, start, velocity);
}

function pipPoint(rig: Rig): THREE.Vector3 | null {
  const out = new THREE.Vector3();
  return rig.solver.getPipPoint(out) ? out : null;
}

/** 机头前方水平面内、偏离机头 angleDeg 度、距离 range 米的位置 */
function offNose(angleDeg: number, range: number): THREE.Vector3 {
  const angle = THREE.MathUtils.degToRad(angleDeg);
  return new THREE.Vector3(Math.sin(angle) * range, 0, -Math.cos(angle) * range);
}

/** 把机头指向 point，再在水平面内偏开 offsetDeg 度 */
function pointNoseAt(rig: Rig, point: THREE.Vector3, offsetDeg = 0): void {
  rig.forward.copy(point).sub(rig.muzzle).normalize();
  if (offsetDeg !== 0) {
    rig.forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(offsetDeg));
  }
}

/**
 * 相遇的定义：子弹从炮口以 100 m/s 飞到 lead 需要 t 秒，目标按匀速直线运动 t 秒后也在 lead。
 * 返回两者的距离（米）。
 */
function interceptError(
  lead: THREE.Vector3,
  muzzle: THREE.Vector3,
  targetPosition: THREE.Vector3,
  targetVelocity: THREE.Vector3
): number {
  const flightTime = lead.distanceTo(muzzle) / BULLET_SPEED;
  return targetPosition.clone().addScaledVector(targetVelocity, flightTime).distanceTo(lead);
}

/** 用二分法求最早的相遇时间（与被测代码的解法无关）；无解返回 null */
function earliestInterceptTime(relative: THREE.Vector3, velocity: THREE.Vector3): number | null {
  const gap = (t: number): number =>
    relative.clone().addScaledVector(velocity, t).length() - BULLET_SPEED * t;
  let low = 0;
  let high = 0;
  const step = 0.01;
  while (high < 30 && gap(high) > 0) {
    low = high;
    high += step;
  }
  if (gap(high) > 0) return null;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (gap(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function expectFinite(point: THREE.Vector3 | null, label: string): void {
  if (!point) return;
  expect(
    Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z),
    `${label}: ${point.x}, ${point.y}, ${point.z}`
  ).toBe(true);
}

describe('GunLeadSolver', () => {
  let rig: Rig;

  beforeEach(() => {
    rig = createRig();
  });

  describe('lead point', () => {
    it('is the target itself for a stationary target', () => {
      const position = new THREE.Vector3(20, -10, -300);
      const mover = addMover(rig, position);
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBe(mover.object);
      const lead = pipPoint(rig);
      expect(lead).not.toBeNull();
      expect(lead?.distanceTo(position)).toBeLessThan(0.01);
    });

    it('leads a crossing target: 60 m/s across the nose at 300 m meets the bullet 225 m along its track', () => {
      // |(60t, 0, -300)| = 100t → t = 3.75 s → 相遇点 (225, 0, -300)
      const position = new THREE.Vector3(0, 0, -300);
      const velocity = new THREE.Vector3(60, 0, 0);
      const mover = addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);

      expect(mover.object.position.distanceTo(position)).toBeLessThan(1e-6);
      expect(rig.solver.getPipTarget()).toBe(mover.object);
      const lead = pipPoint(rig) as THREE.Vector3;
      expect(lead.x).toBeCloseTo(225, 1);
      expect(lead.y).toBeCloseTo(0, 1);
      expect(lead.z).toBeCloseTo(-300, 1);
      expect(interceptError(lead, rig.muzzle, position, velocity)).toBeLessThan(0.05);
    });

    it('pulls the lead point in for a target closing head-on', () => {
      // 400 米外以 50 m/s 迎头飞来：t = 400 / 150 s，相遇点在 266.7 米处
      const position = new THREE.Vector3(0, 0, -400);
      const velocity = new THREE.Vector3(0, 0, 50);
      addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);

      const lead = pipPoint(rig) as THREE.Vector3;
      expect(lead.z).toBeCloseTo(-400 + 50 * (400 / 150), 1);
      expect(interceptError(lead, rig.muzzle, position, velocity)).toBeLessThan(0.05);
    });

    it('pushes the lead point out for a slower target flying away', () => {
      // 200 米外以 40 m/s 远离：t = 200 / 60 s，相遇点在 333.3 米处
      const position = new THREE.Vector3(0, 0, -200);
      const velocity = new THREE.Vector3(0, 0, -40);
      addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);

      const lead = pipPoint(rig) as THREE.Vector3;
      expect(lead.z).toBeCloseTo(-200 - 40 * (200 / 60), 1);
      expect(interceptError(lead, rig.muzzle, position, velocity)).toBeLessThan(0.05);
    });

    it('solves an oblique, climbing target', () => {
      const position = new THREE.Vector3(100, 50, -250);
      const velocity = new THREE.Vector3(-30, 20, 10);
      addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);

      const time = earliestInterceptTime(position, velocity) as number;
      const expected = position.clone().addScaledVector(velocity, time);
      const lead = pipPoint(rig) as THREE.Vector3;
      expect(lead.distanceTo(expected)).toBeLessThan(0.05);
      expect(interceptError(lead, rig.muzzle, position, velocity)).toBeLessThan(0.05);
    });

    it('solves relative to the muzzle, wherever the aircraft is', () => {
      rig.muzzle.set(1200, 340, -800);
      const position = rig.muzzle.clone().add(new THREE.Vector3(-40, 15, -260));
      const velocity = new THREE.Vector3(45, -5, 20);
      addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);

      const relative = position.clone().sub(rig.muzzle);
      const time = earliestInterceptTime(relative, velocity) as number;
      const lead = pipPoint(rig) as THREE.Vector3;
      expect(lead.distanceTo(position.clone().addScaledVector(velocity, time))).toBeLessThan(0.05);
      expect(interceptError(lead, rig.muzzle, position, velocity)).toBeLessThan(0.05);
    });

    it('still has a solution for a target faster than the bullet that is closing', () => {
      // 150 m/s 迎头：t = 400 / 250 s
      const position = new THREE.Vector3(0, 0, -400);
      const velocity = new THREE.Vector3(0, 0, 150);
      addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);

      const lead = pipPoint(rig) as THREE.Vector3;
      expect(lead).not.toBeNull();
      expect(lead.z).toBeCloseTo(-400 + 150 * 1.6, 1);
      expect(interceptError(lead, rig.muzzle, position, velocity)).toBeLessThan(0.05);
    });

    it('uses the same solution at other simulation rates', () => {
      for (const dt of [1 / 30, 1 / 120]) {
        const other = createRig();
        const position = new THREE.Vector3(0, 0, -300);
        const velocity = new THREE.Vector3(60, 0, 0);
        addMover(other, position.clone().addScaledVector(velocity, -WARM_UPDATES * dt), velocity);
        fly(other, WARM_UPDATES, dt);

        const lead = pipPoint(other) as THREE.Vector3;
        expect(lead, `dt ${dt}`).not.toBeNull();
        expect(lead.x).toBeCloseTo(225, 1);
        expect(lead.z).toBeCloseTo(-300, 1);
      }
    });

    it('follows the target’s current position between solver updates', () => {
      // 渲染帧里目标的位置是插值后的位置：提前量点跟着目标走，保持同一段提前量
      const position = new THREE.Vector3(0, 0, -300);
      const velocity = new THREE.Vector3(60, 0, 0);
      const mover = addMoverArrivingAt(rig, position, velocity);
      fly(rig, WARM_UPDATES);
      const before = pipPoint(rig) as THREE.Vector3;

      mover.object.position.x += 0.5;
      const after = pipPoint(rig) as THREE.Vector3;

      expect(after.x - before.x).toBeCloseTo(0.5, 6);
      expect(after.z).toBeCloseTo(before.z, 6);
    });
  });

  describe('no solution', () => {
    it('offers no marker for a target faster than the bullet that is flying away', () => {
      addMoverArrivingAt(rig, new THREE.Vector3(0, 0, -200), new THREE.Vector3(0, 0, -150));
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(rig.solver.isPipOnTarget()).toBe(false);
      const out = new THREE.Vector3(7, 8, 9);
      expect(rig.solver.getPipPoint(out)).toBe(false);
      expect(Number.isNaN(out.x) || Number.isNaN(out.y) || Number.isNaN(out.z)).toBe(false);
    });

    it('offers no marker for a target flying away at exactly the bullet speed', () => {
      addMoverArrivingAt(
        rig,
        new THREE.Vector3(0, 0, -200),
        new THREE.Vector3(0, 0, -BULLET_SPEED)
      );
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();
    });

    it('offers no marker for a fast target crossing too quickly to catch', () => {
      // 横向 150 m/s：|(150t, 0, -200)| 永远大于 100t
      addMoverArrivingAt(rig, new THREE.Vector3(0, 0, -200), new THREE.Vector3(150, 0, 0));
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();
    });
  });

  describe('who gets a marker', () => {
    it('offers none when there are no targets', () => {
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(rig.solver.isPipOnTarget()).toBe(false);
      expect(pipPoint(rig)).toBeNull();
    });

    it('offers one inside 500 m and none beyond', () => {
      const near = addMover(rig, new THREE.Vector3(0, 0, -480));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(near.object);

      const farRig = createRig();
      addMover(farRig, new THREE.Vector3(0, 0, -520));
      fly(farRig, WARM_UPDATES);
      expect(farRig.solver.getPipTarget()).toBeNull();
    });

    it('measures the 500 m to the aircraft, not to where the bullet would meet it', () => {
      // 迎头接近（60 m/s）：相遇点离炮口只有 325 米 / 300 米，子弹打得到；
      // 但 520 米处的敌机本身还在 500 米之外，不给标记
      const closing = new THREE.Vector3(0, 0, 60);
      addMoverArrivingAt(rig, new THREE.Vector3(0, 0, -520), closing);
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();

      const nearRig = createRig();
      const near = addMoverArrivingAt(nearRig, new THREE.Vector3(0, 0, -480), closing);
      fly(nearRig, WARM_UPDATES);
      expect(nearRig.solver.getPipTarget()).toBe(near.object);
      const lead = pipPoint(nearRig);
      expect(lead).not.toBeNull();
      expect((lead as THREE.Vector3).distanceTo(new THREE.Vector3(0, 0, -300))).toBeLessThan(1);
    });

    it('offers one inside the 40 degree forward cone and none outside it', () => {
      const inside = addMover(rig, offNose(38, 300));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(inside.object);

      for (const angle of [42, 90, 180, -42]) {
        const outsideRig = createRig();
        addMover(outsideRig, offNose(angle, 300));
        fly(outsideRig, WARM_UPDATES);
        expect(outsideRig.solver.getPipTarget(), `${angle} degrees off the nose`).toBeNull();
      }
    });

    it('measures the cone from the nose, whichever way the aircraft points', () => {
      // 机头指向 +X 并上仰：目标在机头方向上
      rig.forward.set(1, 0.4, 0).normalize();
      const ahead = addMover(rig, rig.forward.clone().multiplyScalar(300));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(ahead.object);

      // 同一个目标，机头转回 -Z：目标在侧面
      const sideRig = createRig();
      addMover(sideRig, ahead.object.position.clone());
      fly(sideRig, WARM_UPDATES);
      expect(sideRig.solver.getPipTarget()).toBeNull();
    });

    it('offers none for a surface target, only for aircraft', () => {
      addMover(rig, new THREE.Vector3(0, 0, -300));
      rig.airCount = 0;
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();
    });

    it('marks the aircraft and not the surface target listed after it', () => {
      const aircraft = addMover(rig, new THREE.Vector3(30, 0, -350));
      addMover(rig, new THREE.Vector3(0, 0, -150));
      rig.airCount = 1;
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBe(aircraft.object);
    });

    it('drops the marker when the target leaves the list', () => {
      addMover(rig, new THREE.Vector3(0, 0, -300));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).not.toBeNull();

      rig.movers.length = 0;
      update(rig);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();
    });

    it('says the nose is on the lead point only when it is', () => {
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(mover.object);
      expect(rig.solver.isPipOnTarget()).toBe(true);

      pointNoseAt(rig, mover.object.position, 10);
      update(rig);
      expect(rig.solver.getPipTarget()).toBe(mover.object);
      expect(rig.solver.isPipOnTarget()).toBe(false);
    });
  });

  describe('reliable velocity estimate', () => {
    it('offers nothing for a freshly acquired target', () => {
      addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(40, 0, 0));

      fly(rig, 1);
      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();

      fly(rig, 1);
      expect(rig.solver.getPipTarget(), 'two observations are not three samples').toBeNull();
    });

    it('offers the marker once the target has been observed for a few consecutive steps', () => {
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(40, 0, 0));

      fly(rig, 4);

      expect(rig.solver.getPipTarget()).toBe(mover.object);
    });

    it('drops the marker when the target teleports, until the estimate is rebuilt', () => {
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(40, 0, 0));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(mover.object);

      // 一步之内横跳 120 米（7200 m/s）：仍在 500 米与前方锥内
      mover.object.position.set(120, 0, -300);
      mover.velocity.set(0, 0, 0);
      update(rig);
      expect(rig.solver.getPipTarget(), 'the step of the jump').toBeNull();
      expect(pipPoint(rig)).toBeNull();

      update(rig);
      expect(rig.solver.getPipTarget(), 'one step after the jump').toBeNull();

      fly(rig, 4);
      expect(rig.solver.getPipTarget()).toBe(mover.object);
      // 重新估出来的是静止目标：提前量点就是目标本身，没有被那一跳带偏
      expect((pipPoint(rig) as THREE.Vector3).distanceTo(mover.object.position)).toBeLessThan(0.01);
    });

    it('starts over for a target that was missing from the list for a step', () => {
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(40, 0, 0));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(mover.object);

      const parked = rig.movers.splice(0, 1);
      update(rig);
      rig.movers.push(...parked);
      fly(rig, 1);
      expect(rig.solver.getPipTarget(), 'the step it comes back').toBeNull();

      fly(rig, 4);
      expect(rig.solver.getPipTarget()).toBe(mover.object);
    });

    it('starts over after reset()', () => {
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(40, 0, 0));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(mover.object);

      rig.solver.reset();
      expect(rig.solver.getPipTarget()).toBeNull();
      expect(rig.solver.isPipOnTarget()).toBe(false);
      expect(pipPoint(rig)).toBeNull();

      fly(rig, 1);
      expect(rig.solver.getPipTarget(), 'first step after the reset').toBeNull();

      fly(rig, 4);
      expect(rig.solver.getPipTarget()).toBe(mover.object);
    });

    it('does not let a turning target’s old heading linger', () => {
      // 先横飞，再停住：若干步之后提前量点回到目标身上
      const mover = addMover(rig, new THREE.Vector3(-20, 0, -300), new THREE.Vector3(60, 0, 0));
      fly(rig, WARM_UPDATES);
      expect((pipPoint(rig) as THREE.Vector3).x - mover.object.position.x).toBeGreaterThan(100);

      mover.velocity.set(0, 0, 0);
      fly(rig, 40);

      expect((pipPoint(rig) as THREE.Vector3).distanceTo(mover.object.position)).toBeLessThan(1);
    });
  });

  describe('robustness', () => {
    it.each([
      ['NaN', new THREE.Vector3(Number.NaN, 0, -300)],
      ['Infinity', new THREE.Vector3(0, Number.POSITIVE_INFINITY, -300)],
      ['-Infinity', new THREE.Vector3(0, 0, Number.NEGATIVE_INFINITY)],
    ])('skips a target at a %s position and still marks a valid one', (_label, position) => {
      addMover(rig, position);
      const valid = addMover(rig, new THREE.Vector3(10, 0, -250));
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBe(valid.object);
      expectFinite(pipPoint(rig), 'lead point');
    });

    it('lets go of a marked target whose position goes bad', () => {
      const mover = addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(30, 0, 0));
      fly(rig, WARM_UPDATES);
      expect(rig.solver.getPipTarget()).toBe(mover.object);

      mover.object.position.set(Number.NaN, Number.NaN, Number.NaN);
      mover.velocity.set(0, 0, 0);
      update(rig);

      expect(rig.solver.getPipTarget()).toBeNull();
      expect(pipPoint(rig)).toBeNull();
    });

    it('offers nothing when the muzzle position is not finite', () => {
      rig.muzzle.set(Number.NaN, 0, 0);
      addMover(rig, new THREE.Vector3(0, 0, -300));
      fly(rig, WARM_UPDATES);

      expect(rig.solver.getPipTarget()).toBeNull();
    });

    // 曾经的缺陷（b35f8e1 已修）：机头方向为 NaN 时前方锥判定对 NaN 恒为 false，
    // 目标直接通过，照样给出提前量标记。
    it('offers nothing when the nose direction is not finite', () => {
      rig.forward.set(Number.NaN, Number.NaN, Number.NaN);
      addMover(rig, new THREE.Vector3(0, 0, -300));
      fly(rig, WARM_UPDATES);

      // 机头方向未知：无法判断目标是否在前方锥内
      expect(rig.solver.getPipTarget()).toBeNull();
    });

    it('never builds a marker out of zero-length time steps', () => {
      addMover(rig, new THREE.Vector3(0, 0, -300));

      for (let i = 0; i < 20; i += 1) {
        update(rig, 0);
        expectFinite(pipPoint(rig), 'lead point');
      }

      expect(rig.solver.getPipTarget()).toBeNull();
    });

    it.each([0, -DT, Number.NaN, Number.POSITIVE_INFINITY])(
      'keeps the lead point finite through a %s time step',
      (badDelta) => {
        const mover = addMover(rig, new THREE.Vector3(0, 0, -300), new THREE.Vector3(50, 0, 0));
        fly(rig, WARM_UPDATES);

        mover.object.position.addScaledVector(mover.velocity, DT);
        update(rig, badDelta);
        expectFinite(pipPoint(rig), 'lead point on the bad step');

        // 一秒之后解算恢复正常（不规定估计值用多少步收敛）
        fly(rig, 60);
        const lead = pipPoint(rig) as THREE.Vector3;
        expect(lead).not.toBeNull();
        expect(
          interceptError(lead, rig.muzzle, mover.object.position, mover.velocity)
        ).toBeLessThan(0.05);
      }
    );

    it('stays finite for a target sitting on the muzzle', () => {
      addMover(rig, new THREE.Vector3(0, 0, 0));
      fly(rig, WARM_UPDATES);

      expectFinite(pipPoint(rig), 'lead point');
    });
  });
});
