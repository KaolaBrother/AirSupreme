import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MissileSeeker, projectToScreen, type ScreenPoint } from '@/features/combat/MissileSeeker';

/**
 * 导引头（W2，纯逻辑）。期望值全部来自规格：
 * - 候选：1200 米内的敌方目标；捕获环以准星为圆心；环内取屏幕上离准星最近的一个；
 * - 目标在捕获环内，进度在“锁定时间”内填满；出环不清零，按约 1.0 / 秒衰减；
 * - 已完成的锁定在保持环（1.6 × 捕获环）内一直保持，出保持环后还有 0.5 秒宽限；
 * - 目标不在候选表里：立即丢弃；
 * - 换目标：挑战者要比当前目标近 max(12 px, 捕获环半径的 25%)，并连续保持 0.25 秒
 *   （抢已完成的锁定要 0.6 秒）；当前目标已在捕获环外时不要求这段优势；换目标后进度重来。
 *
 * 测试台：相机在原点朝 -Z 看，视口 1000 × 600，准星默认在视口中心。targetAt(px, py, depth)
 * 用视场角与纵横比直接算出“投影到 (px, py) 的世界坐标”，不经过被测代码的投影函数。
 */

const VIEW_W = 1000;
const VIEW_H = 600;
const FOV_DEG = 60;
const DT = 1 / 60;
const RADIUS = 100;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;

const LOCK_TIME = 1.0;
const MAX_RANGE = 1200;
const KEEP_RATIO = 1.6;
const GRACE_TIME = 0.5;
const DECAY_PER_SECOND = 1.0;
const SWITCH_DWELL_TRACKING = 0.25;
const SWITCH_DWELL_LOCKED = 0.6;

interface Rig {
  seeker: MissileSeeker;
  camera: THREE.PerspectiveCamera;
  origin: THREE.Vector3;
  aim: ScreenPoint;
  candidates: THREE.Object3D[];
}

function createCamera(width = VIEW_W, height = VIEW_H): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(FOV_DEG, width / height, 0.1, 5000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/** 投影到屏幕 (px, py)、距相机平面 depth 米的世界坐标（相机在原点朝 -Z） */
function worldAt(
  px: number,
  py: number,
  depth: number,
  width = VIEW_W,
  height = VIEW_H
): THREE.Vector3 {
  const halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(FOV_DEG / 2));
  const halfWidth = halfHeight * (width / height);
  return new THREE.Vector3(
    ((px / width) * 2 - 1) * halfWidth,
    (1 - (py / height) * 2) * halfHeight,
    -depth
  );
}

function targetAt(px: number, py: number, depth = 300): THREE.Object3D {
  const target = new THREE.Object3D();
  target.position.copy(worldAt(px, py, depth));
  return target;
}

/** 准星右侧 offset 像素处（同一水平线） */
function targetRightOfAim(offset: number, depth = 300): THREE.Object3D {
  return targetAt(CENTER_X + offset, CENTER_Y, depth);
}

function moveTo(target: THREE.Object3D, px: number, py: number, depth = 300): void {
  target.position.copy(worldAt(px, py, depth));
}

function moveRightOfAim(target: THREE.Object3D, offset: number, depth = 300): void {
  moveTo(target, CENTER_X + offset, CENTER_Y, depth);
}

function createRig(): Rig {
  const seeker = new MissileSeeker();
  seeker.setViewport(VIEW_W, VIEW_H);
  seeker.setAcquireRadius(RADIUS);
  seeker.setLockTime(LOCK_TIME);
  return {
    seeker,
    camera: createCamera(),
    origin: new THREE.Vector3(0, 0, 0),
    aim: { x: CENTER_X, y: CENTER_Y, visible: true },
    candidates: [],
  };
}

function tick(rig: Rig, dt = DT): void {
  rig.seeker.update(dt, rig.origin, rig.aim, rig.candidates, rig.camera);
}

function frames(seconds: number): number {
  return Math.round(seconds / DT);
}

function run(rig: Rig, seconds: number): void {
  for (let i = 0; i < frames(seconds); i += 1) {
    tick(rig);
  }
}

/** 逐帧推进直到 predicate 为真；返回用掉的帧数，超过上限返回 -1 */
function framesUntil(rig: Rig, predicate: () => boolean, maxSeconds = 5): number {
  const limit = frames(maxSeconds);
  for (let i = 1; i <= limit; i += 1) {
    tick(rig);
    if (predicate()) {
      return i;
    }
  }
  return -1;
}

/** 让 target 成为跟踪目标（进度从 0 开始） */
function acquire(rig: Rig, target: THREE.Object3D): void {
  if (!rig.candidates.includes(target)) {
    rig.candidates.push(target);
  }
  tick(rig);
  expect(rig.seeker.getTarget(), 'expected the target to be acquired').toBe(target);
}

/** 让 target 完成锁定 */
function lock(rig: Rig, target: THREE.Object3D): void {
  acquire(rig, target);
  const used = framesUntil(rig, () => rig.seeker.isLocked(), 3);
  expect(used, 'expected the lock to complete').toBeGreaterThan(0);
  expect(rig.seeker.getLockedTarget()).toBe(target);
}

function expectHealthy(seeker: MissileSeeker): void {
  const progress = seeker.getProgress();
  expect(Number.isFinite(progress), `progress ${progress}`).toBe(true);
  expect(progress).toBeGreaterThanOrEqual(0);
  expect(progress).toBeLessThanOrEqual(1);
  expect(Number.isFinite(seeker.getTargetRange()), 'target range').toBe(true);
}

describe('MissileSeeker', () => {
  let rig: Rig;

  beforeEach(() => {
    rig = createRig();
  });

  describe('test rig', () => {
    it('places a target at the requested screen pixel', () => {
      const cases: Array<[number, number, number]> = [
        [CENTER_X, CENTER_Y, 300],
        [CENTER_X + 60, CENTER_Y, 300],
        [200, 450, 900],
        [730, 120, 40],
      ];
      for (const [px, py, depth] of cases) {
        const ndc = worldAt(px, py, depth).project(rig.camera);
        expect((ndc.x + 1) * 0.5 * VIEW_W).toBeCloseTo(px, 6);
        expect((1 - ndc.y) * 0.5 * VIEW_H).toBeCloseTo(py, 6);
      }
    });
  });

  describe('candidates', () => {
    it('tracks nothing when there are no candidates', () => {
      run(rig, 2);

      expect(rig.seeker.getTarget()).toBeNull();
      expect(rig.seeker.getLockedTarget()).toBeNull();
      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getProgress()).toBe(0);
      expect(rig.seeker.getTargetRange()).toBe(0);
      expect(rig.seeker.events.acquired).toBe(false);
      expect(rig.seeker.events.locked).toBe(false);
      expect(rig.seeker.events.lost).toBe(false);
    });

    it('starts tracking a hostile inside the ring on its own: there is no lock mode to enter', () => {
      const enemy = targetRightOfAim(0);
      rig.candidates.push(enemy);

      tick(rig);

      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.events.acquired).toBe(true);
      expect(rig.seeker.isLocked()).toBe(false);
    });

    it('accepts a target inside 1200 m and ignores one beyond it', () => {
      const near = targetRightOfAim(0, MAX_RANGE - 10);
      rig.candidates.push(near);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(near);
      expect(rig.seeker.getTargetRange()).toBeCloseTo(MAX_RANGE - 10, 3);

      const far = createRig();
      far.candidates.push(targetRightOfAim(0, MAX_RANGE + 10));
      run(far, 2);
      expect(far.seeker.getTarget()).toBeNull();
      expect(far.seeker.getProgress()).toBe(0);
    });

    it('treats a target exactly 1200 m away as within range', () => {
      const edge = new THREE.Object3D();
      edge.position.set(0, 0, -MAX_RANGE);
      rig.candidates.push(edge);

      tick(rig);

      expect(rig.seeker.getTarget()).toBe(edge);
    });

    it('measures the 1200 m from the aircraft, not from the camera', () => {
      // 载机在相机前方 100 米：目标离相机 1250 米，但离载机只有 1150 米
      rig.origin.set(0, 0, -100);
      const reachable = targetRightOfAim(0, 1250);
      rig.candidates.push(reachable);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(reachable);
      expect(rig.seeker.getTargetRange()).toBeCloseTo(1150, 3);

      // 载机在相机后方 100 米：目标离相机 1150 米，但离载机 1250 米
      const behind = createRig();
      behind.origin.set(0, 0, 100);
      behind.candidates.push(targetRightOfAim(0, 1150));
      run(behind, 2);
      expect(behind.seeker.getTarget()).toBeNull();
    });

    it('ignores a target behind the camera even though its mirror image falls in the ring', () => {
      const behind = new THREE.Object3D();
      behind.position.set(0, 0, 200);
      rig.candidates.push(behind);

      run(rig, 2);

      expect(rig.seeker.getTarget()).toBeNull();
    });

    it('does not acquire while the reticle itself is not on screen', () => {
      rig.aim.visible = false;
      rig.candidates.push(targetRightOfAim(0));

      run(rig, 2);

      expect(rig.seeker.getTarget()).toBeNull();
      expect(rig.seeker.getProgress()).toBe(0);
    });
  });

  describe('acquire ring', () => {
    it('acquires just inside the ring radius and not just outside it', () => {
      const inside = targetRightOfAim(RADIUS - 0.5);
      rig.candidates.push(inside);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(inside);

      const outsideRig = createRig();
      outsideRig.candidates.push(targetRightOfAim(RADIUS + 0.5));
      run(outsideRig, 2);
      expect(outsideRig.seeker.getTarget()).toBeNull();
    });

    it('measures the radius in every direction on screen, not only sideways', () => {
      const diagonal = Math.SQRT1_2;
      const inside = targetAt(
        CENTER_X - (RADIUS - 1) * diagonal,
        CENTER_Y + (RADIUS - 1) * diagonal
      );
      rig.candidates.push(inside);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(inside);

      const outsideRig = createRig();
      outsideRig.candidates.push(
        targetAt(CENTER_X - (RADIUS + 1) * diagonal, CENTER_Y + (RADIUS + 1) * diagonal)
      );
      run(outsideRig, 2);
      expect(outsideRig.seeker.getTarget()).toBeNull();
    });

    it('follows setAcquireRadius', () => {
      rig.seeker.setAcquireRadius(60);
      rig.candidates.push(targetRightOfAim(80));
      run(rig, 1);
      expect(rig.seeker.getTarget()).toBeNull();

      rig.seeker.setAcquireRadius(90);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(rig.candidates[0]);
      expect(rig.seeker.getAcquireRadius()).toBe(90);
      expect(rig.seeker.getKeepRadius()).toBeCloseTo(90 * KEEP_RATIO, 6);
    });

    it('is centred on the reticle, not on the middle of the viewport', () => {
      // 追尾视角：准星在屏幕上方约 29% 处
      rig.aim.y = VIEW_H * 0.29;
      const atViewportCentre = targetAt(CENTER_X, CENTER_Y);
      rig.candidates.push(atViewportCentre);
      run(rig, 2);
      expect(rig.seeker.getTarget(), 'viewport centre is outside the ring').toBeNull();

      const atReticle = targetAt(CENTER_X, VIEW_H * 0.29);
      rig.candidates.push(atReticle);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(atReticle);
    });

    it('tracks the candidate nearest the reticle on screen, not the nearest in the world', () => {
      const closeInWorld = targetRightOfAim(70, 150);
      const closeOnScreen = targetRightOfAim(-8, 1000);
      rig.candidates.push(closeInWorld, closeOnScreen);

      tick(rig);

      expect(rig.seeker.getTarget()).toBe(closeOnScreen);
    });

    it('reports where the tracked target is on screen', () => {
      const enemy = targetAt(CENTER_X + 40, CENTER_Y - 30);
      acquire(rig, enemy);

      const screen = rig.seeker.getTargetScreen();
      expect(screen.visible).toBe(true);
      expect(screen.x).toBeCloseTo(CENTER_X + 40, 3);
      expect(screen.y).toBeCloseTo(CENTER_Y - 30, 3);
    });

    it('behaves consistently for a target sitting exactly on the acquire ring boundary', () => {
      // 目标投影恰在视口中心，准星放在它左边整整一个半径处：屏幕距离恰好等于半径
      rig.aim.x = CENTER_X - RADIUS;
      const onBoundary = new THREE.Object3D();
      onBoundary.position.set(0, 0, -300);
      rig.candidates.push(onBoundary);

      tick(rig);
      const acquired = rig.seeker.getTarget() === onBoundary;
      let lostEvents = 0;
      for (let i = 0; i < frames(3); i += 1) {
        tick(rig);
        expect(rig.seeker.getTarget() === onBoundary, `frame ${i}`).toBe(acquired);
        if (rig.seeker.events.lost) lostEvents += 1;
        expectHealthy(rig.seeker);
      }

      // 不论边界算环内还是环外，结论必须稳定：算环内就锁得上，算环外就一直没有进度
      expect(lostEvents).toBe(0);
      expect(rig.seeker.isLocked()).toBe(acquired);
      if (!acquired) {
        expect(rig.seeker.getProgress()).toBe(0);
      }
    });
  });

  describe('lock progress', () => {
    it('fills in proportion to the time spent in the ring', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      expect(rig.seeker.getProgress()).toBeLessThan(0.05);

      run(rig, 0.25);
      expect(rig.seeker.getProgress()).toBeCloseTo(0.25, 1);
      run(rig, 0.25);
      expect(rig.seeker.getProgress()).toBeCloseTo(0.5, 1);
      expect(rig.seeker.isLocked()).toBe(false);
      run(rig, 0.25);
      expect(rig.seeker.getProgress()).toBeCloseTo(0.75, 1);
      expect(rig.seeker.isLocked()).toBe(false);
    });

    it.each([1.0, 0.75, 0.5])('completes the lock after the %s s lock time', (lockTime) => {
      rig.seeker.setLockTime(lockTime);
      expect(rig.seeker.getLockTime()).toBe(lockTime);
      acquire(rig, targetRightOfAim(20));

      const used = framesUntil(rig, () => rig.seeker.isLocked());

      expect(used * DT).toBeGreaterThan(lockTime - 2 * DT);
      expect(used * DT).toBeLessThan(lockTime + 3 * DT);
      expect(rig.seeker.getProgress()).toBe(1);
    });

    it('fills at the same rate anywhere inside the ring', () => {
      const edge = createRig();
      acquire(edge, targetRightOfAim(RADIUS - 2));
      const centre = createRig();
      acquire(centre, targetRightOfAim(0));

      run(edge, 0.5);
      run(centre, 0.5);

      expect(edge.seeker.getProgress()).toBeCloseTo(centre.seeker.getProgress(), 6);
    });

    it('does not depend on the simulation step', () => {
      const coarse = createRig();
      acquire(coarse, targetRightOfAim(10));
      for (let i = 0; i < 15; i += 1) tick(coarse, 1 / 30);

      const fine = createRig();
      acquire(fine, targetRightOfAim(10));
      for (let i = 0; i < 60; i += 1) tick(fine, 1 / 120);

      expect(coarse.seeker.getProgress()).toBeCloseTo(0.5, 2);
      expect(fine.seeker.getProgress()).toBeCloseTo(0.5, 2);
    });

    it('raises the locked event exactly once and exposes the locked target', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      expect(rig.seeker.getLockedTarget()).toBeNull();

      let lockedEvents = 0;
      for (let i = 0; i < frames(3); i += 1) {
        tick(rig);
        if (rig.seeker.events.locked) lockedEvents += 1;
      }

      expect(lockedEvents).toBe(1);
      expect(rig.seeker.isLocked()).toBe(true);
      expect(rig.seeker.getLockedTarget()).toBe(enemy);
      expect(rig.seeker.getTarget()).toBe(enemy);
    });

    it('keeps tracking a target that moves around inside the ring', () => {
      const enemy = targetRightOfAim(-60);
      acquire(rig, enemy);

      for (let i = 0; i < frames(1.2); i += 1) {
        moveTo(enemy, CENTER_X - 60 + i * 1.5, CENTER_Y + Math.sin(i / 6) * 30);
        tick(rig);
        expect(rig.seeker.getTarget()).toBe(enemy);
      }

      expect(rig.seeker.isLocked()).toBe(true);
    });
  });

  describe('leaving the acquire ring before the lock completes', () => {
    it('does not reset progress the instant the target leaves the ring', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.6);
      const before = rig.seeker.getProgress();
      expect(before).toBeGreaterThan(0.5);

      moveRightOfAim(enemy, RADIUS * 1.3);
      tick(rig);

      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.getProgress()).toBeGreaterThan(before - 0.05);
      expect(rig.seeker.getProgress()).toBeLessThan(before);
    });

    it('decays at about 1.0 per second between the acquire ring and the keep ring', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.8);
      const before = rig.seeker.getProgress();

      moveRightOfAim(enemy, RADIUS * 1.3);
      run(rig, 0.3);

      const decayed = before - rig.seeker.getProgress();
      expect(decayed).toBeGreaterThan(0.3 * DECAY_PER_SECOND * 0.8);
      expect(decayed).toBeLessThan(0.3 * DECAY_PER_SECOND * 1.2);
      expect(rig.seeker.getTarget()).toBe(enemy);
    });

    it('never decays below zero and keeps the target while it stays in the keep ring', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.3);

      moveRightOfAim(enemy, RADIUS * 1.3);
      run(rig, 3);

      expect(rig.seeker.getProgress()).toBe(0);
      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.isLocked()).toBe(false);
    });

    it('resumes from the decayed progress when the target comes back', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.8);
      moveRightOfAim(enemy, RADIUS * 1.3);
      run(rig, 0.3);
      const decayed = rig.seeker.getProgress();
      expect(decayed).toBeGreaterThan(0.35);

      moveRightOfAim(enemy, 20);
      const used = framesUntil(rig, () => rig.seeker.isLocked());

      // 剩余进度 (1 - decayed) 按锁定时间补满，明显短于从零开始的 1.0 秒
      expect(used * DT).toBeGreaterThan((1 - decayed) * LOCK_TIME - 2 * DT);
      expect(used * DT).toBeLessThan((1 - decayed) * LOCK_TIME + 3 * DT);
      expect(used * DT).toBeLessThan(LOCK_TIME - 0.2);
    });

    it('decays rather than resets outside the keep ring too, and ends with nothing', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.9);

      moveRightOfAim(enemy, RADIUS * KEEP_RATIO + 30);
      run(rig, GRACE_TIME - 0.1);
      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.getProgress()).toBeGreaterThan(0.3);
      expect(rig.seeker.getProgress()).toBeLessThan(0.7);

      run(rig, 1.2);
      expect(rig.seeker.getProgress()).toBe(0);
      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getLockedTarget()).toBeNull();
    });
  });

  describe('a completed lock', () => {
    it('is held for as long as the target stays inside the keep ring', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);

      moveRightOfAim(enemy, RADIUS * KEEP_RATIO - 5);
      for (let i = 0; i < frames(5); i += 1) {
        tick(rig);
        expect(rig.seeker.isLocked(), `frame ${i}`).toBe(true);
      }
      expect(rig.seeker.getLockedTarget()).toBe(enemy);
      expect(rig.seeker.getProgress()).toBe(1);
    });

    it('breaks only after the 0.5 s grace once the target is outside the keep ring', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);

      moveRightOfAim(enemy, RADIUS * KEEP_RATIO + 5);
      const used = framesUntil(rig, () => !rig.seeker.isLocked(), 3);

      expect(used * DT).toBeGreaterThan(GRACE_TIME - 2 * DT);
      expect(used * DT).toBeLessThan(GRACE_TIME + 3 * DT);
      expect(rig.seeker.getTarget()).toBeNull();
      expect(rig.seeker.getLockedTarget()).toBeNull();
      expect(rig.seeker.getProgress()).toBe(0);
    });

    it('raises lost + lostWhileLocked on the step the lock breaks, and only then', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);
      moveRightOfAim(enemy, RADIUS * KEEP_RATIO + 40);

      let lostEvents = 0;
      for (let i = 0; i < frames(2); i += 1) {
        tick(rig);
        if (rig.seeker.events.lost) {
          lostEvents += 1;
          expect(rig.seeker.events.lostWhileLocked).toBe(true);
          expect(rig.seeker.isLocked()).toBe(false);
        }
      }

      expect(lostEvents).toBe(1);
    });

    it('survives leaving the keep ring when the target is back within the grace', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);

      // 两次各 0.3 秒的出环，中间回到环内：每次离开都重新计宽限
      for (let i = 0; i < 4; i += 1) {
        moveRightOfAim(enemy, RADIUS * KEEP_RATIO + 60);
        run(rig, 0.3);
        expect(rig.seeker.isLocked(), `excursion ${i}`).toBe(true);
        moveRightOfAim(enemy, RADIUS * KEEP_RATIO - 20);
        run(rig, 0.1);
        expect(rig.seeker.isLocked(), `return ${i}`).toBe(true);
      }
      expect(rig.seeker.getLockedTarget()).toBe(enemy);
    });

    it('is not kept for a target that flies out of range', () => {
      const enemy = targetRightOfAim(0, MAX_RANGE - 50);
      lock(rig, enemy);

      moveRightOfAim(enemy, 0, MAX_RANGE + 200);
      run(rig, GRACE_TIME + 0.2);

      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getTarget()).toBeNull();
    });

    it('is not kept for a target that ends up behind the camera', () => {
      const enemy = targetRightOfAim(0);
      lock(rig, enemy);

      enemy.position.set(0, 0, 150);
      run(rig, GRACE_TIME + 0.2);

      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getTarget()).toBeNull();
    });

    it('can be rebuilt from zero after it broke', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);
      moveRightOfAim(enemy, RADIUS * KEEP_RATIO + 60);
      run(rig, GRACE_TIME + 0.2);
      expect(rig.seeker.getTarget()).toBeNull();

      moveRightOfAim(enemy, 20);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.getProgress()).toBeLessThan(0.05);
      const used = framesUntil(rig, () => rig.seeker.isLocked());
      expect(used * DT).toBeGreaterThan(LOCK_TIME - 2 * DT);
    });
  });

  describe('targets that leave the candidate list', () => {
    it('drops a tracked target the step it is no longer listed', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.5);

      rig.candidates.length = 0;
      tick(rig);

      expect(rig.seeker.getTarget()).toBeNull();
      expect(rig.seeker.getProgress()).toBe(0);
    });

    it('drops a locked target the step it is no longer listed, without any grace', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);

      rig.candidates.length = 0;
      tick(rig);

      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getLockedTarget()).toBeNull();
      expect(rig.seeker.getTarget()).toBeNull();
      expect(rig.seeker.getProgress()).toBe(0);
    });

    it('moves on to another candidate in the ring and starts its progress from zero', () => {
      const first = targetRightOfAim(10);
      const second = targetRightOfAim(-40);
      lock(rig, first);
      rig.candidates.push(second);
      tick(rig);
      expect(rig.seeker.getLockedTarget()).toBe(first);

      rig.candidates.splice(rig.candidates.indexOf(first), 1);
      const used = framesUntil(rig, () => rig.seeker.getTarget() === second, 1);

      expect(used).toBeGreaterThan(0);
      expect(used).toBeLessThanOrEqual(2);
      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getProgress()).toBeLessThan(0.05);
    });
  });

  describe('switching targets', () => {
    function trackWithChallenger(
      currentOffset: number,
      challengerOffset: number,
      radius = RADIUS
    ): { current: THREE.Object3D; challenger: THREE.Object3D } {
      rig.seeker.setAcquireRadius(radius);
      const current = targetRightOfAim(currentOffset);
      acquire(rig, current);
      const challenger = targetRightOfAim(-challengerOffset);
      rig.candidates.push(challenger);
      return { current, challenger };
    }

    it('stays on the current target when the challenger is closer by less than 25% of the radius', () => {
      // 半径 100：优势门槛 25 像素；这里只近 23 像素
      const { current } = trackWithChallenger(60, 37);

      for (let i = 0; i < frames(2); i += 1) {
        tick(rig);
        expect(rig.seeker.getTarget(), `frame ${i}`).toBe(current);
      }
      expect(rig.seeker.isLocked()).toBe(true);
    });

    it('switches when the challenger is closer by more than 25% of the radius', () => {
      // 近 27 像素
      const { challenger } = trackWithChallenger(60, 33);

      run(rig, SWITCH_DWELL_TRACKING + 0.1);

      expect(rig.seeker.getTarget()).toBe(challenger);
    });

    it('uses a 12 px floor for the margin on a small ring', () => {
      // 半径 40：25% 只有 10 像素，门槛取 12 像素。近 11 像素不换，近 13 像素换
      const stay = trackWithChallenger(30, 19, 40);
      run(rig, 1.5);
      expect(rig.seeker.getTarget()).toBe(stay.current);

      rig = createRig();
      const swap = trackWithChallenger(30, 17, 40);
      run(rig, SWITCH_DWELL_TRACKING + 0.1);
      expect(rig.seeker.getTarget()).toBe(swap.challenger);
    });

    it('needs the advantage for 0.25 s before it switches a target still being tracked', () => {
      const { current, challenger } = trackWithChallenger(60, 20);

      run(rig, SWITCH_DWELL_TRACKING - 0.05);
      expect(rig.seeker.getTarget()).toBe(current);

      run(rig, 0.1);
      expect(rig.seeker.getTarget()).toBe(challenger);
    });

    it('restarts the 0.25 s when the advantage is interrupted', () => {
      const { current, challenger } = trackWithChallenger(60, 20);

      run(rig, 0.2);
      moveRightOfAim(challenger, -(RADIUS + 50));
      tick(rig);
      moveRightOfAim(challenger, -20);
      run(rig, 0.2);
      expect(rig.seeker.getTarget(), 'the two 0.2 s spells do not add up').toBe(current);

      run(rig, 0.1);
      expect(rig.seeker.getTarget()).toBe(challenger);
    });

    it('needs 0.6 s to steal a completed lock', () => {
      const current = targetRightOfAim(60);
      lock(rig, current);
      const challenger = targetRightOfAim(-20);
      rig.candidates.push(challenger);

      run(rig, SWITCH_DWELL_LOCKED - 0.1);
      expect(rig.seeker.getLockedTarget()).toBe(current);

      run(rig, 0.2);
      expect(rig.seeker.getTarget()).toBe(challenger);
      expect(rig.seeker.getLockedTarget()).not.toBe(current);
    });

    it('restarts progress on the new target', () => {
      const { challenger } = trackWithChallenger(60, 20);

      const used = framesUntil(rig, () => rig.seeker.getTarget() === challenger, 2);

      expect(used).toBeGreaterThan(0);
      expect(rig.seeker.events.acquired).toBe(true);
      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getProgress()).toBeLessThan(0.05);
      // 新目标同样要用满锁定时间
      const toLock = framesUntil(rig, () => rig.seeker.isLocked());
      expect(toLock * DT).toBeGreaterThan(LOCK_TIME - 2 * DT);
    });

    it('lets a challenger without the margin take over once the current target is outside the acquire ring', () => {
      // 对照：当前目标在环内 99 像素处，挑战者只近 10 像素 → 不换
      const inside = trackWithChallenger(99, 89);
      run(rig, 0.6);
      expect(rig.seeker.getTarget()).toBe(inside.current);

      // 当前目标滑到环外 105 像素处（仍在保持环内），挑战者仍只近 10 像素 → 换
      rig = createRig();
      const outside = trackWithChallenger(60, 95);
      run(rig, 0.2);
      expect(rig.seeker.getTarget()).toBe(outside.current);
      moveRightOfAim(outside.current, 105);
      run(rig, SWITCH_DWELL_TRACKING + 0.1);
      expect(rig.seeker.getTarget()).toBe(outside.challenger);
    });

    it('lets a challenger without the margin take a completed lock whose target left the acquire ring', () => {
      const current = targetRightOfAim(60);
      lock(rig, current);
      const challenger = targetRightOfAim(-95);
      rig.candidates.push(challenger);
      run(rig, 1);
      expect(rig.seeker.getLockedTarget(), 'no margin while the lock is in the ring').toBe(current);

      moveRightOfAim(current, 105);
      run(rig, SWITCH_DWELL_LOCKED + 0.1);

      expect(rig.seeker.getTarget()).toBe(challenger);
    });
  });

  describe('no missiles / reset', () => {
    it('reset() forgets the target, the progress and the pending events', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);

      rig.seeker.reset();

      expect(rig.seeker.getTarget()).toBeNull();
      expect(rig.seeker.getLockedTarget()).toBeNull();
      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getProgress()).toBe(0);
      expect(rig.seeker.getTargetRange()).toBe(0);
      expect(rig.seeker.getTargetScreen().visible).toBe(false);
      expect(rig.seeker.events.locked).toBe(false);
      expect(rig.seeker.events.lost).toBe(false);
    });

    it('starts the lock over after a reset', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);
      rig.seeker.reset();

      tick(rig);
      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getProgress()).toBeLessThan(0.05);
    });
  });

  describe('robustness', () => {
    it.each([
      ['NaN', new THREE.Vector3(Number.NaN, 0, -300)],
      ['Infinity', new THREE.Vector3(0, Number.POSITIVE_INFINITY, -300)],
      ['-Infinity', new THREE.Vector3(0, 0, Number.NEGATIVE_INFINITY)],
    ])('skips a candidate at a %s position and still tracks a valid one', (_label, position) => {
      const broken = new THREE.Object3D();
      broken.position.copy(position);
      rig.candidates.push(broken);
      run(rig, 1);
      expect(rig.seeker.getTarget()).toBeNull();
      expectHealthy(rig.seeker);

      const valid = targetRightOfAim(30);
      rig.candidates.push(valid);
      tick(rig);
      expect(rig.seeker.getTarget()).toBe(valid);
      expectHealthy(rig.seeker);
    });

    it('never reports NaN when the tracked target’s position goes bad, and lets go of it', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);

      enemy.position.set(Number.NaN, Number.NaN, Number.NaN);
      for (let i = 0; i < frames(GRACE_TIME + 0.2); i += 1) {
        tick(rig);
        expectHealthy(rig.seeker);
      }

      expect(rig.seeker.isLocked()).toBe(false);
      expect(rig.seeker.getTarget()).toBeNull();
    });

    it('makes no progress on a zero time step', () => {
      const enemy = targetRightOfAim(20);
      acquire(rig, enemy);
      run(rig, 0.4);
      const before = rig.seeker.getProgress();

      for (let i = 0; i < 200; i += 1) tick(rig, 0);

      expect(rig.seeker.getProgress()).toBe(before);
      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.isLocked()).toBe(false);
    });

    it('does not run the grace timer or the decay on a zero time step', () => {
      const enemy = targetRightOfAim(20);
      lock(rig, enemy);
      moveRightOfAim(enemy, RADIUS * KEEP_RATIO + 50);

      for (let i = 0; i < 200; i += 1) tick(rig, 0);

      expect(rig.seeker.isLocked()).toBe(true);
    });

    it.each([Number.NaN, -1, Number.NEGATIVE_INFINITY])(
      'treats a %s time step as no time at all',
      (badDelta) => {
        const enemy = targetRightOfAim(20);
        acquire(rig, enemy);
        run(rig, 0.4);
        const before = rig.seeker.getProgress();

        for (let i = 0; i < 20; i += 1) tick(rig, badDelta);

        expect(rig.seeker.getProgress()).toBe(before);
        expectHealthy(rig.seeker);
      }
    );

    it('stays finite on an infinite time step', () => {
      acquire(rig, targetRightOfAim(20));

      tick(rig, Number.POSITIVE_INFINITY);

      expectHealthy(rig.seeker);
    });

    it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])(
      'keeps progress finite and gradual with a lock time of %s',
      (lockTime) => {
        rig.seeker.setLockTime(lockTime);
        acquire(rig, targetRightOfAim(20));

        tick(rig);

        expectHealthy(rig.seeker);
        expect(Number.isFinite(rig.seeker.getLockTime())).toBe(true);
        expect(rig.seeker.getLockTime()).toBeGreaterThan(0);
        // 一个 1/60 秒的步长不会直接锁定
        expect(rig.seeker.isLocked()).toBe(false);
      }
    );

    it.each([Number.NaN, 0, -20])('survives an acquire radius of %s', (radius) => {
      rig.seeker.setAcquireRadius(radius);
      rig.candidates.push(targetRightOfAim(50));

      run(rig, 0.5);

      expect(Number.isFinite(rig.seeker.getAcquireRadius())).toBe(true);
      expect(rig.seeker.getAcquireRadius()).toBeGreaterThan(0);
      expect(rig.seeker.getTarget()).toBeNull();
      expectHealthy(rig.seeker);
    });

    it('re-projects against the new viewport after a resize', () => {
      // 同一个世界位置：1000 × 600 时离准星 150 像素（环外），600 × 360 时只有 90 像素（环内）
      const enemy = targetRightOfAim(150);
      rig.candidates.push(enemy);
      run(rig, 1);
      expect(rig.seeker.getTarget()).toBeNull();

      rig.seeker.setViewport(600, 360);
      rig.aim.x = 300;
      rig.aim.y = 180;
      tick(rig);

      expect(rig.seeker.getTarget()).toBe(enemy);
      expect(rig.seeker.getTargetScreen().x).toBeCloseTo(300 + 90, 3);
      expect(rig.seeker.getTargetScreen().y).toBeCloseTo(180, 3);
    });

    it('drops a lock whose target falls outside the keep ring after the viewport grows', () => {
      const enemy = targetRightOfAim(90);
      lock(rig, enemy);

      // 视口放大一倍：同一目标离准星 180 像素，超出 160 像素的保持环
      rig.seeker.setViewport(VIEW_W * 2, VIEW_H * 2);
      rig.aim.x = VIEW_W;
      rig.aim.y = VIEW_H;
      run(rig, GRACE_TIME + 0.2);

      expect(rig.seeker.isLocked()).toBe(false);
    });

    it.each([
      [0, 0],
      [Number.NaN, Number.NaN],
      [-100, 600],
    ])('does not produce NaN for a %s x %s viewport', (width, height) => {
      rig.seeker.setViewport(width, height);
      rig.candidates.push(targetRightOfAim(10));

      run(rig, 0.5);

      expectHealthy(rig.seeker);
      const screen = rig.seeker.getTargetScreen();
      if (screen.visible) {
        expect(Number.isFinite(screen.x) && Number.isFinite(screen.y)).toBe(true);
      }
    });

    // 曾经的缺陷（b35f8e1 已修）：载机坐标为 NaN 时距离判定对 NaN 恒为 false，目标被当成
    // “1200 米以内”而捕获，距离读数是 NaN（HUD 会显示“NaN m”），还能一路锁定。
    it('does not track anything when the aircraft position is not finite', () => {
      rig.origin.set(Number.NaN, 0, 0);
      rig.candidates.push(targetRightOfAim(10));

      run(rig, 0.5);

      // 距离未知：不能当成“1200 米以内”
      expect(rig.seeker.getTarget()).toBeNull();
      expectHealthy(rig.seeker);
    });
  });

  /**
   * 干扰（敌机编队第 2 批，规格 §3 JAMMER）：“玩家的导弹锁定时间变为 2.0 倍（不叠加）……
   * 导引头的其余部分不变。”导引头只从一个窄接口读“锁定要慢多少”；800 米、是否存活、
   * 不叠加这些判定不在这里（见 CoordinatorJamCloakJetMissiles.test.ts）。
   */
  describe('jamming', () => {
    /** 干扰来源：scale 是当前的锁定时间倍数，测试里随时可以改 */
    interface JamSource {
      scale: number;
    }

    function jam(target: Rig, scale = 2): JamSource {
      const source: JamSource = { scale };
      target.seeker.setJamProvider({ getLockTimeScale: () => source.scale });
      return source;
    }

    /** 两台一样的台架：一台不受干扰，一台受干扰（倍数 2） */
    function pair(): { clean: Rig; jammed: Rig; source: JamSource } {
      const clean = createRig();
      const jammed = createRig();
      return { clean, jammed, source: jam(jammed) };
    }

    it.each([1.0, 0.75, 0.5])('takes twice the %s s lock time to lock', (lockTime) => {
      jam(rig);
      rig.seeker.setLockTime(lockTime);
      acquire(rig, targetRightOfAim(20));

      const used = framesUntil(rig, () => rig.seeker.isLocked(), 6);

      expect(used * DT).toBeGreaterThan(2 * lockTime - 2 * DT);
      expect(used * DT).toBeLessThan(2 * lockTime + 3 * DT);
      expect(rig.seeker.getProgress()).toBe(1);
    });

    it('fills at exactly half the normal rate on every step', () => {
      const { clean, jammed } = pair();
      acquire(clean, targetRightOfAim(20));
      acquire(jammed, targetRightOfAim(20));

      for (let i = 0; i < frames(0.9); i += 1) {
        tick(clean);
        tick(jammed);
        expect(jammed.seeker.getProgress() * 2, `step ${i}`).toBeCloseTo(
          clean.seeker.getProgress(),
          9
        );
      }
      expect(clean.seeker.getProgress()).toBeGreaterThan(0.85);
      expect(jammed.seeker.isLocked()).toBe(false);
    });

    it('reports being jammed only while the lock is being slowed', () => {
      expect(rig.seeker.isJammed()).toBe(false);

      const source = jam(rig);
      expect(rig.seeker.isJammed()).toBe(true);

      source.scale = 1;
      expect(rig.seeker.isJammed()).toBe(false);

      source.scale = 2;
      rig.seeker.setJamProvider(null);
      expect(rig.seeker.isJammed()).toBe(false);
    });

    it('locks in the normal time again once the jam source is disconnected', () => {
      jam(rig);
      rig.seeker.setJamProvider(null);
      acquire(rig, targetRightOfAim(20));

      const used = framesUntil(rig, () => rig.seeker.isLocked());

      expect(used * DT).toBeGreaterThan(LOCK_TIME - 2 * DT);
      expect(used * DT).toBeLessThan(LOCK_TIME + 3 * DT);
    });

    it('goes back to the normal rate on the very update the jamming ends, keeping the progress made', () => {
      const source = jam(rig);
      acquire(rig, targetRightOfAim(20));
      run(rig, 0.5);
      const before = rig.seeker.getProgress();
      expect(before).toBeCloseTo(0.25, 1);

      source.scale = 1;
      tick(rig);

      expect(rig.seeker.getProgress() - before).toBeCloseTo(DT / LOCK_TIME, 9);
      // 剩下的 0.75 按正常速度补满
      const used = framesUntil(rig, () => rig.seeker.isLocked());
      expect(used * DT).toBeGreaterThan((1 - before) * LOCK_TIME - 3 * DT);
      expect(used * DT).toBeLessThan((1 - before) * LOCK_TIME + 3 * DT);
    });

    it('slows down from the very update the jamming starts, keeping the progress made', () => {
      const source = jam(rig, 1);
      acquire(rig, targetRightOfAim(20));
      run(rig, 0.4);
      const before = rig.seeker.getProgress();
      expect(before).toBeCloseTo(0.4, 1);

      source.scale = 2;
      tick(rig);

      expect(rig.seeker.getProgress() - before).toBeCloseTo(DT / (2 * LOCK_TIME), 9);
      // 剩下的 0.6 要花两倍的时间
      const used = framesUntil(rig, () => rig.seeker.isLocked(), 4);
      expect(used * DT).toBeGreaterThan((1 - before) * 2 * LOCK_TIME - 4 * DT);
      expect(used * DT).toBeLessThan((1 - before) * 2 * LOCK_TIME + 4 * DT);
    });

    describe('nothing else about the seeker changes', () => {
      it('has the same acquire ring and keep ring', () => {
        const { clean, jammed } = pair();

        expect(jammed.seeker.getAcquireRadius()).toBe(clean.seeker.getAcquireRadius());
        expect(jammed.seeker.getKeepRadius()).toBe(clean.seeker.getKeepRadius());

        // 环内 2 像素的捕获，环外 2 像素的不捕获
        const inside = targetRightOfAim(RADIUS - 2);
        const outside = targetRightOfAim(RADIUS + 2);
        jammed.candidates.push(outside);
        run(jammed, 0.5);
        expect(jammed.seeker.getTarget()).toBeNull();
        jammed.candidates.push(inside);
        tick(jammed);
        expect(jammed.seeker.getTarget()).toBe(inside);
      });

      it.each<[string, Array<[number, number, number]>, number | null]>([
        [
          'the one nearest the reticle of three',
          [
            [60, 0, 300],
            [-25, 10, 700],
            [0, 80, 150],
          ],
          1,
        ],
        ['nothing when the only aircraft is outside the ring', [[RADIUS + 30, 0, 300]], null],
        ['nothing beyond 1200 m', [[0, 0, MAX_RANGE + 60]], null],
        ['a target just inside 1200 m', [[0, 0, MAX_RANGE - 60]], 0],
      ])('picks %s', (_name, layout, expectedIndex) => {
        const { clean, jammed } = pair();
        const place = (target: Rig): THREE.Object3D[] => {
          const placed = layout.map(([dx, dy, depth]) =>
            targetAt(CENTER_X + dx, CENTER_Y + dy, depth)
          );
          target.candidates.push(...placed);
          return placed;
        };
        const cleanTargets = place(clean);
        const jammedTargets = place(jammed);

        run(clean, 0.5);
        run(jammed, 0.5);

        const picked = jammed.seeker.getTarget();
        expect(picked === null ? null : jammedTargets.indexOf(picked)).toBe(expectedIndex);
        const cleanPick = clean.seeker.getTarget();
        expect(cleanPick === null ? null : cleanTargets.indexOf(cleanPick)).toBe(expectedIndex);
      });

      it('holds a completed lock inside the keep ring and breaks it after the same grace', () => {
        const { clean, jammed } = pair();
        const cleanEnemy = targetRightOfAim(20);
        const jammedEnemy = targetRightOfAim(20);
        lock(clean, cleanEnemy);
        acquire(jammed, jammedEnemy);
        expect(framesUntil(jammed, () => jammed.seeker.isLocked(), 6)).toBeGreaterThan(0);

        moveRightOfAim(jammedEnemy, RADIUS * KEEP_RATIO - 5);
        for (let i = 0; i < frames(3); i += 1) {
          tick(jammed);
          expect(jammed.seeker.isLocked(), `frame ${i}`).toBe(true);
        }

        moveRightOfAim(cleanEnemy, RADIUS * KEEP_RATIO + 5);
        moveRightOfAim(jammedEnemy, RADIUS * KEEP_RATIO + 5);
        const cleanFrames = framesUntil(clean, () => !clean.seeker.isLocked(), 3);
        const jammedFrames = framesUntil(jammed, () => !jammed.seeker.isLocked(), 3);

        expect(jammedFrames).toBe(cleanFrames);
        expect(jammedFrames * DT).toBeGreaterThan(GRACE_TIME - 2 * DT);
        expect(jammedFrames * DT).toBeLessThan(GRACE_TIME + 3 * DT);
      });

      it('loses unfinished progress between the rings at the normal rate', () => {
        const { clean, jammed } = pair();
        const cleanEnemy = targetRightOfAim(20);
        const jammedEnemy = targetRightOfAim(20);
        acquire(clean, cleanEnemy);
        acquire(jammed, jammedEnemy);
        // 两边攒到同样的进度：受干扰的一边要花两倍时间
        run(clean, 0.4);
        run(jammed, 0.8);
        expect(jammed.seeker.getProgress()).toBeCloseTo(clean.seeker.getProgress(), 9);

        moveRightOfAim(cleanEnemy, RADIUS * 1.3);
        moveRightOfAim(jammedEnemy, RADIUS * 1.3);
        for (let i = 0; i < frames(0.3); i += 1) {
          tick(clean);
          tick(jammed);
          expect(jammed.seeker.getProgress(), `step ${i}`).toBeCloseTo(
            clean.seeker.getProgress(),
            9
          );
        }
        expect(jammed.seeker.getProgress()).toBeLessThan(0.2);
        expect(jammed.seeker.getTarget()).toBe(jammedEnemy);
      });

      it('hands over to a clearly better target after the same dwell', () => {
        const { clean, jammed } = pair();
        const switchFrames = (target: Rig): number => {
          acquire(target, targetRightOfAim(70));
          const challenger = targetRightOfAim(5);
          target.candidates.push(challenger);
          return framesUntil(target, () => target.seeker.getTarget() === challenger, 2);
        };

        const cleanFrames = switchFrames(clean);
        const jammedFrames = switchFrames(jammed);

        expect(cleanFrames).toBeGreaterThan(0);
        expect(jammedFrames).toBe(cleanFrames);
        expect(jammedFrames * DT).toBeGreaterThan(SWITCH_DWELL_TRACKING - 2 * DT);
        expect(jammedFrames * DT).toBeLessThan(SWITCH_DWELL_TRACKING + 3 * DT);
      });

      it('leaves a lock that was already complete alone when the jamming starts', () => {
        const source = jam(rig, 1);
        const enemy = targetRightOfAim(20);
        lock(rig, enemy);

        source.scale = 2;
        for (let i = 0; i < frames(2); i += 1) {
          tick(rig);
          expect(rig.seeker.isLocked(), `frame ${i}`).toBe(true);
          expect(rig.seeker.events.lost).toBe(false);
        }
        expect(rig.seeker.getLockedTarget()).toBe(enemy);
        expect(rig.seeker.getProgress()).toBe(1);
      });

      it('still drops a target the step it leaves the candidate list', () => {
        jam(rig);
        const enemy = targetRightOfAim(20);
        acquire(rig, enemy);
        run(rig, 0.8);
        expect(rig.seeker.getProgress()).toBeGreaterThan(0.3);

        rig.candidates.length = 0;
        tick(rig);

        expect(rig.seeker.getTarget()).toBeNull();
        expect(rig.seeker.getProgress()).toBe(0);
      });
    });

    // 干扰只会让锁定变慢：读数坏了（非有限数、零、负数、小于 1）不能让锁定卡死，也不能让它变快
    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -2, 0.5, 1])(
      'treats a jam reading of %s as no jamming',
      (scale) => {
        jam(rig, scale);
        acquire(rig, targetRightOfAim(20));

        const used = framesUntil(rig, () => rig.seeker.isLocked());

        expect(used * DT).toBeGreaterThan(LOCK_TIME - 2 * DT);
        expect(used * DT).toBeLessThan(LOCK_TIME + 3 * DT);
        expect(rig.seeker.isJammed()).toBe(false);
        expectHealthy(rig.seeker);
      }
    );
  });
});

describe('projectToScreen', () => {
  const camera = createCamera();
  const out: ScreenPoint = { x: -1, y: -1, visible: false };

  it('maps a point in front of the camera to viewport pixels with a top-left origin', () => {
    expect(projectToScreen(worldAt(250, 480, 120), camera, VIEW_W, VIEW_H, out)).toBe(true);
    expect(out.visible).toBe(true);
    expect(out.x).toBeCloseTo(250, 4);
    expect(out.y).toBeCloseTo(480, 4);
  });

  it('puts the camera axis at the centre of the viewport', () => {
    expect(projectToScreen(new THREE.Vector3(0, 0, -50), camera, VIEW_W, VIEW_H, out)).toBe(true);
    expect(out.x).toBeCloseTo(CENTER_X, 6);
    expect(out.y).toBeCloseTo(CENTER_Y, 6);
  });

  it.each([
    ['behind the camera', new THREE.Vector3(0, 0, 80)],
    ['in the camera plane', new THREE.Vector3(5, 5, 0)],
    ['NaN', new THREE.Vector3(Number.NaN, 0, -50)],
    ['Infinity', new THREE.Vector3(Number.POSITIVE_INFINITY, 0, -50)],
  ])('reports a point %s as not visible', (_label, point) => {
    const result: ScreenPoint = { x: 0, y: 0, visible: true };

    expect(projectToScreen(point, camera, VIEW_W, VIEW_H, result)).toBe(false);
    expect(result.visible).toBe(false);
  });
});
