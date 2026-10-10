import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS, GameConfig } from '@/config';
import { InputHandler, type InputState } from '@/core/Input/InputHandler';
import { PlayerController } from '@/features/player/PlayerController';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { elementById, seedShippedMobileControls, TouchScreen } from './touchTestUtils';

/**
 * 飞行姿态（PlayerController.update，批次 T）：
 * F. 辅助飞行（input.flightAssist）：偏航绕世界竖直轴、航向角速度只取决于 yawAxis（满偏 1.5 rad/s）；
 *    俯仰到约 ±75° 为止，减小 |俯仰| 的输入始终有效；坡度逼近 -yawAxis × 45°，摇杆回中改平；
 *    模拟量成比例；姿态四元数始终归一、有限（含 NaN / Infinity 输入）。
 * G. 键盘飞行不变：绕机体自身三轴（俯仰 2.0、偏航 1.5、滚转 3.0 rad/s），没有输入时才自动改平。
 *
 * 期望值取自规格里的数字。姿态用与实现无关的方式测量：
 *   heading = atan2(forward.x, -forward.z)（右转为正）、pitch = asin(forward.y)（抬头为正）、
 *   roll = atan2(right.y, up.y)（右翼抬起为正，与 three.js 的 rotateZ 同号）。
 */

const DEG = Math.PI / 180;
/** 规格：满偏航的航向角速度 / 键盘各轴角速度（rad/s） */
const YAW_RATE = 1.5;
const PITCH_RATE = 2.0;
const ROLL_RATE = 3.0;
/** 规格：辅助飞行的俯仰上限与满偏航时的目标坡度 */
const PITCH_LIMIT = 75 * DEG;
const MAX_BANK = 45 * DEG;
const STEP = 1 / 60;

interface Attitude {
  heading: number;
  pitch: number;
  roll: number;
}

interface Flight {
  aircraft: THREE.Group;
  controller: PlayerController;
}

interface Trace {
  /** 累计航向变化（弧度，右转为正，已展开不回绕） */
  turned: number;
  /** 单步航向变化的最小 / 最大值 */
  minTurnStep: number;
  maxTurnStep: number;
  maxPitch: number;
  minPitch: number;
  maxAbsRoll: number;
  end: Attitude;
}

const NEUTRAL: InputState = {
  pitchUp: false,
  pitchDown: false,
  yawLeft: false,
  yawRight: false,
  rollLeft: false,
  rollRight: false,
  fire: false,
  missile: false,
  throttle: false,
  special: false,
};

/** 键盘输入：只写布尔方向，不带新增的可选字段 */
function keys(held: Partial<InputState> = {}): InputState {
  return { ...NEUTRAL, ...held };
}

/** 触控摇杆输入（辅助飞行）：模拟量，加上 InputHandler 同时给出的布尔方向 */
function stick(pitchAxis: number, yawAxis: number): InputState {
  return {
    ...NEUTRAL,
    pitchUp: pitchAxis > 0.08,
    pitchDown: pitchAxis < -0.08,
    yawRight: yawAxis > 0.08,
    yawLeft: yawAxis < -0.08,
    pitchAxis,
    yawAxis,
    flightAssist: true,
  };
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function bodyAxes(aircraft: THREE.Object3D): {
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
} {
  return {
    forward: new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quaternion),
    right: new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quaternion),
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(aircraft.quaternion),
  };
}

function attitudeOf(aircraft: THREE.Object3D): Attitude {
  const { forward, right, up } = bodyAxes(aircraft);
  return {
    heading: Math.atan2(forward.x, -forward.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, forward.y))),
    roll: Math.atan2(right.y, up.y),
  };
}

/** 先航向（绕世界竖直轴）、再俯仰、最后滚转 */
function setAttitude(aircraft: THREE.Object3D, attitude: Partial<Attitude>): void {
  const { heading = 0, pitch = 0, roll = 0 } = attitude;
  aircraft.quaternion.setFromEuler(new THREE.Euler(pitch, -heading, roll, 'YXZ'));
}

function createFlight(start: Partial<Attitude> = {}): Flight {
  const aircraft = new THREE.Group();
  aircraft.position.set(0, 200, 0);
  setAttitude(aircraft, start);
  const controller = new PlayerController(aircraft, new THREE.Scene(), new PlayerStats());
  return { aircraft, controller };
}

function fly(
  flight: Flight,
  input: InputState | (() => InputState),
  seconds: number,
  deltaTime: number = STEP,
  onStep?: (attitude: Attitude, step: number) => void
): Trace {
  const steps = Math.round(seconds / deltaTime);
  let previous = attitudeOf(flight.aircraft);
  const trace: Trace = {
    turned: 0,
    minTurnStep: Number.POSITIVE_INFINITY,
    maxTurnStep: Number.NEGATIVE_INFINITY,
    maxPitch: previous.pitch,
    minPitch: previous.pitch,
    maxAbsRoll: Math.abs(previous.roll),
    end: previous,
  };

  for (let step = 0; step < steps; step++) {
    flight.controller.update(deltaTime, typeof input === 'function' ? input() : input);
    const now = attitudeOf(flight.aircraft);
    const turnStep = wrapAngle(now.heading - previous.heading);
    trace.turned += turnStep;
    trace.minTurnStep = Math.min(trace.minTurnStep, turnStep);
    trace.maxTurnStep = Math.max(trace.maxTurnStep, turnStep);
    trace.maxPitch = Math.max(trace.maxPitch, now.pitch);
    trace.minPitch = Math.min(trace.minPitch, now.pitch);
    trace.maxAbsRoll = Math.max(trace.maxAbsRoll, Math.abs(now.roll));
    onStep?.(now, step);
    previous = now;
  }

  trace.end = previous;
  return trace;
}

function expectUnitAndFinite(quaternion: THREE.Quaternion, tolerance: number, label = ''): void {
  for (const component of [quaternion.x, quaternion.y, quaternion.z, quaternion.w]) {
    expect(Number.isFinite(component), `finite quaternion ${label}`).toBe(true);
  }
  expect(Math.abs(quaternion.length() - 1), `unit quaternion ${label}`).toBeLessThan(tolerance);
}

/**
 * 两个姿态的差距：机头方向与右翼方向各自相差多少（单位向量间的距离，取较大者）。
 * 比 Quaternion.angleTo 稳：后者在夹角接近 0 时要对 1 - ε 取 acos，1e-16 的舍入就会读成 1e-8。
 */
function attitudeGap(a: THREE.Quaternion, b: THREE.Quaternion): number {
  const gapAlong = (x: number, y: number, z: number): number =>
    new THREE.Vector3(x, y, z)
      .applyQuaternion(a)
      .distanceTo(new THREE.Vector3(x, y, z).applyQuaternion(b));
  return Math.max(gapAlong(0, 0, -1), gapAlong(1, 0, 0));
}

/** 可复现的伪随机数（LCG），0..1 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * 改动前（提交 6384e8f 之前）键盘飞行的姿态规则，抄自旧版 PlayerController.update，
 * 只作为“键盘飞行不变”的对照模型：绕机体三轴转动，六个方向键都没按时才按机翼倾斜量改平。
 */
function legacyKeyboardStep(aircraft: THREE.Object3D, deltaTime: number, input: InputState): void {
  const hasInput =
    input.pitchUp ||
    input.pitchDown ||
    input.yawLeft ||
    input.yawRight ||
    input.rollLeft ||
    input.rollRight;
  if (input.pitchUp) aircraft.rotateX(PITCH_RATE * deltaTime);
  if (input.pitchDown) aircraft.rotateX(-PITCH_RATE * deltaTime);
  if (input.yawLeft) aircraft.rotateY(YAW_RATE * deltaTime);
  if (input.yawRight) aircraft.rotateY(-YAW_RATE * deltaTime);
  if (input.rollLeft) aircraft.rotateZ(ROLL_RATE * deltaTime);
  if (input.rollRight) aircraft.rotateZ(-ROLL_RATE * deltaTime);
  if (!hasInput) {
    const tilt = new THREE.Vector3(1, 0, 0).applyQuaternion(aircraft.quaternion).y;
    if (Math.abs(tilt) > 0.01) {
      aircraft.rotateZ(Math.sign(tilt) * -Math.min(2.0 * deltaTime, Math.abs(tilt)));
    }
  }
}

describe('player flight attitude (PlayerController)', () => {
  beforeEach(() => {
    // 构造函数要画一张喷口辉光贴图；jsdom 没有 2D canvas
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          fillStyle: '',
          createRadialGradient: () => ({ addColorStop: vi.fn() }),
          fillRect: vi.fn(),
        }) as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('measuring tools', () => {
    it.each([
      { heading: 0, pitch: 0, roll: 0 },
      { heading: 0.7, pitch: 0.3, roll: -0.4 },
      { heading: -2.4, pitch: -1.1, roll: 2.2 },
      { heading: 3.0, pitch: 1.3, roll: 0.9 },
    ])('read back heading $heading, pitch $pitch, roll $roll', (attitude) => {
      const aircraft = new THREE.Group();
      setAttitude(aircraft, attitude);
      const read = attitudeOf(aircraft);
      expect(read.heading).toBeCloseTo(attitude.heading, 9);
      expect(read.pitch).toBeCloseTo(attitude.pitch, 9);
      expect(read.roll).toBeCloseTo(attitude.roll, 9);
    });

    it('positive heading is a right turn, positive pitch is nose up, negative roll is right wing down', () => {
      const aircraft = new THREE.Group();
      setAttitude(aircraft, { heading: 0.5 });
      expect(bodyAxes(aircraft).forward.x, 'nose swings toward +X (right)').toBeGreaterThan(0);

      setAttitude(aircraft, { pitch: 0.5 });
      expect(bodyAxes(aircraft).forward.y).toBeGreaterThan(0);

      setAttitude(aircraft, { roll: -0.5 });
      expect(bodyAxes(aircraft).right.y).toBeLessThan(0);
    });
  });

  // ───────────────────────────── F. 辅助飞行 ─────────────────────────────

  describe('F. assisted flight (flightAssist on)', () => {
    describe('constants', () => {
      it('GAME_CONSTANTS.PLAYER carries the assist tuning: 45° bank, 75° pitch limit', () => {
        expect(GAME_CONSTANTS.PLAYER.ASSIST_MAX_BANK).toBeCloseTo(MAX_BANK, 9);
        expect(GAME_CONSTANTS.PLAYER.ASSIST_PITCH_LIMIT).toBeCloseTo(PITCH_LIMIT, 9);

        const assistEntries = Object.entries(GAME_CONSTANTS.PLAYER).filter(([name]) =>
          name.startsWith('ASSIST_')
        );
        expect(assistEntries.length).toBeGreaterThanOrEqual(2);
        for (const [name, value] of assistEntries) {
          expect(Number.isFinite(value), name).toBe(true);
          expect(value, name).toBeGreaterThan(0);
        }
      });

      it('the configured rates are pitch 2.0, yaw 1.5, roll 3.0 rad/s', () => {
        expect(GAME_CONSTANTS.PLAYER.PITCH_SPEED).toBe(PITCH_RATE);
        expect(GAME_CONSTANTS.PLAYER.YAW_SPEED).toBe(YAW_RATE);
        expect(GAME_CONSTANTS.PLAYER.ROLL_SPEED).toBe(ROLL_RATE);
      });
    });

    describe('yaw', () => {
      it('full right deflection turns the heading right at 1.5 rad/s', () => {
        const flight = createFlight();
        const trace = fly(flight, stick(0, 1), 1);

        expect(trace.turned).toBeCloseTo(YAW_RATE, 2);
        expect(trace.minTurnStep).toBeGreaterThan(0);
      });

      it('full left deflection turns the heading left at 1.5 rad/s', () => {
        const flight = createFlight();
        const trace = fly(flight, stick(0, -1), 1);

        expect(trace.turned).toBeCloseTo(-YAW_RATE, 2);
        expect(trace.maxTurnStep).toBeLessThan(0);
      });

      it.each([1 / 20, 1 / 30, 1 / 45, 1 / 60, 1 / 120])(
        'the heading rate is 1.5 rad/s at a %f s step',
        (deltaTime) => {
          const flight = createFlight();
          const trace = fly(flight, stick(0, 1), 2, deltaTime);
          expect(trace.turned).toBeCloseTo(2 * YAW_RATE, 2);
        }
      );

      it.each([0.25, 0.5, 0.75])('the heading rate is proportional to yawAxis (%f)', (yawAxis) => {
        const right = fly(createFlight(), stick(0, yawAxis), 1);
        expect(right.turned).toBeCloseTo(YAW_RATE * yawAxis, 2);

        const left = fly(createFlight(), stick(0, -yawAxis), 1);
        expect(left.turned).toBeCloseTo(-YAW_RATE * yawAxis, 2);
      });

      it.each([-1, -0.5, 0, 0.5, 1])(
        'the heading rate does not depend on the pitch input (pitchAxis %f)',
        (pitchAxis) => {
          const full = fly(createFlight(), stick(pitchAxis, 1), 1);
          expect(full.turned).toBeCloseTo(YAW_RATE, 2);

          const half = fly(createFlight(), stick(pitchAxis, -0.5), 1);
          expect(half.turned).toBeCloseTo(-YAW_RATE * 0.5, 2);
        }
      );

      it.each([
        ['level', {}, 0],
        ['level, pulling up', {}, 1],
        ['level, pushing down', {}, -1],
        ['climbing 60°', { pitch: 60 * DEG }, 0],
        ['climbing 60°, pulling up', { pitch: 60 * DEG }, 1],
        ['diving 60°', { pitch: -60 * DEG }, 0],
        ['diving 60°, pushing down', { pitch: -60 * DEG }, -1],
        ['banked 120° left (left over from keyboard roll)', { roll: 120 * DEG }, 0],
        ['banked 100° right', { roll: -100 * DEG }, 0.5],
        ['nearly inverted', { roll: 170 * DEG }, -0.5],
        ['inverted in a dive', { pitch: -40 * DEG, roll: -160 * DEG }, 1],
        ['on another heading', { heading: 2.6, pitch: 20 * DEG, roll: 30 * DEG }, 0],
        ['beyond the pitch limit, 85° nose up', { pitch: 85 * DEG }, 0],
        ['beyond the pitch limit, 85° nose down, pulling up', { pitch: -85 * DEG }, 1],
      ] as Array<[string, Partial<Attitude>, number]>)(
        'pushing right turns the heading right on every step: %s',
        (_name, start, pitchAxis) => {
          const flight = createFlight(start);
          const trace = fly(flight, stick(pitchAxis, 1), 1);

          expect(trace.minTurnStep, 'never turns left, never stalls').toBeGreaterThan(0);
          expect(trace.turned).toBeCloseTo(YAW_RATE, 2);
        }
      );

      it.each([
        ['banked 120° right', { roll: -120 * DEG }, 0],
        ['climbing, pulling up', { pitch: 50 * DEG }, 1],
        ['diving, pushing down', { pitch: -50 * DEG, roll: 80 * DEG }, -1],
      ] as Array<[string, Partial<Attitude>, number]>)(
        'pushing left turns the heading left on every step: %s',
        (_name, start, pitchAxis) => {
          const flight = createFlight(start);
          const trace = fly(flight, stick(pitchAxis, -1), 1);

          expect(trace.maxTurnStep).toBeLessThan(0);
          expect(trace.turned).toBeCloseTo(-YAW_RATE, 2);
        }
      );

      it('yaw is about the world up axis: a level turn stays level while the aircraft banks', () => {
        const flight = createFlight();
        const startAltitude = flight.aircraft.position.y;
        const trace = fly(flight, stick(0, 1), 2);

        expect(Math.abs(trace.end.roll), 'it did bank').toBeGreaterThan(30 * DEG);
        expect(trace.maxPitch).toBeLessThan(1e-6);
        expect(trace.minPitch).toBeGreaterThan(-1e-6);
        expect(Math.abs(flight.aircraft.position.y - startAltitude)).toBeLessThan(0.01);
      });

      it('a turn with no pitch input keeps the climb angle', () => {
        const flight = createFlight({ pitch: 30 * DEG });
        const trace = fly(flight, stick(0, -1), 2);

        expect(trace.maxPitch).toBeCloseTo(30 * DEG, 6);
        expect(trace.minPitch).toBeCloseTo(30 * DEG, 6);
      });

      it('banked 90° right, pushing right still turns the heading and does not drop the nose', () => {
        // 键盘模型下同样的输入绕机体轴转动，机头会下沉（见 G 组）；辅助模型相对地平线右转
        const flight = createFlight({ roll: -90 * DEG });
        const trace = fly(flight, stick(0, 1), 0.5);

        expect(trace.turned).toBeCloseTo(YAW_RATE * 0.5, 2);
        expect(Math.abs(trace.end.pitch)).toBeLessThan(1e-6);
      });
    });

    describe('pitch', () => {
      it('pitchAxis up raises the nose, down lowers it, without changing the heading', () => {
        const up = fly(createFlight(), stick(1, 0), 0.25);
        expect(up.end.pitch).toBeGreaterThan(0.4);
        expect(up.end.pitch).toBeLessThan(0.6);
        expect(Math.abs(up.turned)).toBeLessThan(1e-6);

        const down = fly(createFlight(), stick(-1, 0), 0.25);
        expect(down.end.pitch).toBeLessThan(-0.4);
        expect(down.end.pitch).toBeGreaterThan(-0.6);
        expect(Math.abs(down.turned)).toBeLessThan(1e-6);
      });

      it.each([1 / 30, 1 / 60])('stops at about 75° nose up (%f s step)', (deltaTime) => {
        const flight = createFlight();
        const trace = fly(flight, stick(1, 0), 3, deltaTime);

        expect(trace.end.pitch / DEG).toBeGreaterThan(73);
        expect(trace.maxPitch / DEG).toBeLessThan(77);
      });

      it.each([1 / 30, 1 / 60])('stops at about 75° nose down (%f s step)', (deltaTime) => {
        const flight = createFlight();
        const trace = fly(flight, stick(-1, 0), 3, deltaTime);

        expect(trace.end.pitch / DEG).toBeLessThan(-73);
        expect(trace.minPitch / DEG).toBeGreaterThan(-77);
      });

      it('does not creep past the limit while the stick is held there', () => {
        const flight = createFlight();
        const reached = fly(flight, stick(1, 0), 2).end.pitch;
        const held = fly(flight, stick(1, 0), 3);

        expect(Math.abs(held.end.pitch - reached) / DEG).toBeLessThan(0.5);
        expect(held.maxPitch / DEG).toBeLessThan(77);
      });

      it('the limit also holds in a turn', () => {
        const climbing = fly(createFlight(), stick(1, 1), 3);
        expect(climbing.end.pitch / DEG).toBeGreaterThan(73);
        expect(climbing.maxPitch / DEG).toBeLessThan(77);

        const diving = fly(createFlight(), stick(-1, -1), 3);
        expect(diving.end.pitch / DEG).toBeLessThan(-73);
        expect(diving.minPitch / DEG).toBeGreaterThan(-77);
      });

      it('input that reduces |pitch| is accepted at the limit', () => {
        const flight = createFlight();
        const atLimit = fly(flight, stick(1, 0), 2).end.pitch;

        const recovered = fly(flight, stick(-1, 0), 0.1);
        expect(atLimit - recovered.end.pitch).toBeGreaterThan(0.15);
        expect(atLimit - recovered.end.pitch).toBeLessThan(0.25);

        const diveFlight = createFlight();
        const atDiveLimit = fly(diveFlight, stick(-1, 0), 2).end.pitch;
        const pulledUp = fly(diveFlight, stick(1, 0), 0.1);
        expect(pulledUp.end.pitch - atDiveLimit).toBeGreaterThan(0.15);
        expect(pulledUp.end.pitch - atDiveLimit).toBeLessThan(0.25);
      });

      it('an aircraft that starts beyond the limit nose-up can recover', () => {
        const flight = createFlight({ pitch: 85 * DEG });
        let previous = attitudeOf(flight.aircraft).pitch;
        const trace = fly(flight, stick(-1, 0), 0.25, STEP, (attitude) => {
          expect(attitude.pitch, 'pitch comes down on every step').toBeLessThan(previous);
          previous = attitude.pitch;
        });

        // 0.25 秒、约 2 rad/s：回落约 0.5 rad（28.6°）
        expect(85 - trace.end.pitch / DEG).toBeGreaterThan(22);
        expect(85 - trace.end.pitch / DEG).toBeLessThan(35);
      });

      it('an aircraft that starts beyond the limit nose-down can recover', () => {
        const flight = createFlight({ pitch: -85 * DEG });
        let previous = attitudeOf(flight.aircraft).pitch;
        const trace = fly(flight, stick(1, 0), 0.25, STEP, (attitude) => {
          expect(attitude.pitch, 'pitch comes up on every step').toBeGreaterThan(previous);
          previous = attitude.pitch;
        });

        expect(trace.end.pitch / DEG + 85).toBeGreaterThan(22);
        expect(trace.end.pitch / DEG + 85).toBeLessThan(35);
      });

      it('beyond the limit, input that would increase |pitch| is not applied', () => {
        const up = fly(createFlight({ pitch: 85 * DEG }), stick(1, 0), 0.5);
        expect(up.maxPitch / DEG).toBeLessThan(85.1);

        const down = fly(createFlight({ pitch: -85 * DEG }), stick(-1, 0), 0.5);
        expect(down.minPitch / DEG).toBeGreaterThan(-85.1);
      });

      it('recovers from pointing straight up or straight down (no horizon to pitch against)', () => {
        const up = createFlight({ pitch: 90 * DEG });
        const fromUp = fly(up, stick(-1, 0), 0.25);
        expectUnitAndFinite(up.aircraft.quaternion, 1e-9);
        expect(fromUp.end.pitch / DEG).toBeLessThan(70);
        expect(fromUp.end.pitch / DEG).toBeGreaterThan(50);

        const down = createFlight({ pitch: -90 * DEG });
        const fromDown = fly(down, stick(1, 0), 0.25);
        expectUnitAndFinite(down.aircraft.quaternion, 1e-9);
        expect(fromDown.end.pitch / DEG).toBeGreaterThan(-70);
        expect(fromDown.end.pitch / DEG).toBeLessThan(-50);
      });

      it('pointing straight up, yaw input alone keeps the attitude finite and does not move the nose', () => {
        const flight = createFlight({ pitch: 90 * DEG });
        const trace = fly(flight, stick(0, 1), 1, STEP, () => {
          expectUnitAndFinite(flight.aircraft.quaternion, 1e-9);
        });
        expect(trace.minPitch / DEG).toBeGreaterThan(89.5);
      });

      it.each([60, 120, 170, -150])(
        'pitchAxis is relative to the horizon: banked %i°, up still raises the nose and down lowers it',
        (rollDegrees) => {
          const up = fly(createFlight({ roll: rollDegrees * DEG }), stick(1, 0), 0.2);
          expect(up.end.pitch).toBeGreaterThan(0.3);
          expect(up.minPitch).toBeGreaterThan(-1e-6);
          expect(Math.abs(up.turned), 'pitch does not turn the heading').toBeLessThan(1e-6);

          const down = fly(createFlight({ roll: rollDegrees * DEG }), stick(-1, 0), 0.2);
          expect(down.end.pitch).toBeLessThan(-0.3);
          expect(down.maxPitch).toBeLessThan(1e-6);
          expect(Math.abs(down.turned)).toBeLessThan(1e-6);
        }
      );
    });

    describe('bank', () => {
      it('banks into a right turn: about 45° right wing down at full deflection', () => {
        const flight = createFlight();
        const trace = fly(flight, stick(0, 1), 2);

        expect(trace.end.roll / DEG).toBeGreaterThan(-48);
        expect(trace.end.roll / DEG).toBeLessThan(-42);
        expect(trace.maxAbsRoll / DEG, 'no overshoot').toBeLessThan(48);
        const { right } = bodyAxes(flight.aircraft);
        expect(right.y, 'the right wing tip is the low one').toBeLessThan(0);
      });

      it('banks into a left turn: about 45° left wing down at full deflection', () => {
        const flight = createFlight();
        const trace = fly(flight, stick(0, -1), 2);

        expect(trace.end.roll / DEG).toBeGreaterThan(42);
        expect(trace.end.roll / DEG).toBeLessThan(48);
        expect(trace.maxAbsRoll / DEG).toBeLessThan(48);
        const { right } = bodyAxes(flight.aircraft);
        expect(right.y, 'the right wing tip is the high one').toBeGreaterThan(0);
      });

      it.each([1 / 30, 1 / 45, 1 / 60])('reaches the 45° bank at a %f s step', (deltaTime) => {
        const trace = fly(createFlight(), stick(0, 1), 2.5, deltaTime);
        expect(trace.end.roll / DEG).toBeGreaterThan(-48);
        expect(trace.end.roll / DEG).toBeLessThan(-42);
      });

      it.each([0.25, 0.5, 0.75])(
        'the bank target scales with the deflection (yawAxis %f)',
        (yawAxis) => {
          const right = fly(createFlight(), stick(0, yawAxis), 2.5);
          expect(right.end.roll / DEG).toBeGreaterThan(-45 * yawAxis - 3);
          expect(right.end.roll / DEG).toBeLessThan(-45 * yawAxis + 3);

          const left = fly(createFlight(), stick(0, -yawAxis), 2.5);
          expect(left.end.roll / DEG).toBeGreaterThan(45 * yawAxis - 3);
          expect(left.end.roll / DEG).toBeLessThan(45 * yawAxis + 3);
        }
      );

      it('the bank is measured against the horizon in a climbing turn', () => {
        const flight = createFlight();
        const trace = fly(flight, stick(0.25, 1), 2);

        expect(trace.end.pitch / DEG, 'it did climb').toBeGreaterThan(40);
        expect(trace.end.roll / DEG).toBeGreaterThan(-48);
        expect(trace.end.roll / DEG).toBeLessThan(-42);
      });

      it('returns to wings level when the stick is centred with assist still on', () => {
        const flight = createFlight();
        fly(flight, stick(0, 1), 2);
        expect(Math.abs(attitudeOf(flight.aircraft).roll) / DEG).toBeGreaterThan(40);

        let previous = Math.abs(attitudeOf(flight.aircraft).roll);
        const trace = fly(flight, stick(0, 0), 2, STEP, (attitude) => {
          expect(Math.abs(attitude.roll), 'the bank only ever decreases').toBeLessThanOrEqual(
            previous + 1e-9
          );
          previous = Math.abs(attitude.roll);
        });

        expect(Math.abs(trace.end.roll) / DEG).toBeLessThan(2);
        expect(Math.abs(trace.turned), 'levelling does not turn the aircraft').toBeLessThan(1e-6);
      });

      it.each([120, -100, 170, 180, -35])(
        'levels a bank of %i° left over from keyboard flight once assist takes over',
        (rollDegrees) => {
          const flight = createFlight({ heading: 0.8, pitch: 20 * DEG, roll: rollDegrees * DEG });
          const trace = fly(flight, stick(0, 0), 3);

          expect(Math.abs(trace.end.roll) / DEG).toBeLessThan(2);
          expect(Math.abs(trace.turned)).toBeLessThan(1e-6);
          expect(trace.end.pitch).toBeCloseTo(20 * DEG, 6);
        }
      );

      it('reversing the turn rolls through level to the other side', () => {
        const flight = createFlight();
        fly(flight, stick(0, 1), 2);
        const trace = fly(flight, stick(0, -1), 2.5);

        expect(trace.end.roll / DEG).toBeGreaterThan(42);
        expect(trace.end.roll / DEG).toBeLessThan(48);
      });

      it('takes its bank and pitch limits from GAME_CONSTANTS.PLAYER.ASSIST_*', () => {
        const tuning = GAME_CONSTANTS.PLAYER;
        const original = {
          bank: tuning.ASSIST_MAX_BANK,
          pitch: tuning.ASSIST_PITCH_LIMIT,
        };
        try {
          tuning.ASSIST_MAX_BANK = 30 * DEG;
          tuning.ASSIST_PITCH_LIMIT = 60 * DEG;

          const turn = fly(createFlight(), stick(0, 1), 2.5);
          expect(turn.end.roll / DEG).toBeGreaterThan(-33);
          expect(turn.end.roll / DEG).toBeLessThan(-27);

          const climb = fly(createFlight(), stick(1, 0), 3);
          expect(climb.end.pitch / DEG).toBeGreaterThan(58);
          expect(climb.maxPitch / DEG).toBeLessThan(62);
        } finally {
          tuning.ASSIST_MAX_BANK = original.bank;
          tuning.ASSIST_PITCH_LIMIT = original.pitch;
        }
      });
    });

    describe('analog response', () => {
      it('half yaw deflection gives about half the heading rate of full deflection', () => {
        const full = fly(createFlight(), stick(0, 1), 1).turned;
        const half = fly(createFlight(), stick(0, 0.5), 1).turned;

        expect(half).toBeGreaterThan(0);
        expect(half / full).toBeGreaterThan(0.4);
        expect(half / full).toBeLessThan(0.6);
      });

      it('half pitch deflection gives about half the pitch rate of full deflection', () => {
        const full = fly(createFlight(), stick(1, 0), 0.25).end.pitch;
        const half = fly(createFlight(), stick(0.5, 0), 0.25).end.pitch;

        expect(half).toBeGreaterThan(0);
        expect(half / full).toBeGreaterThan(0.4);
        expect(half / full).toBeLessThan(0.6);
      });

      it('a small deflection gives a small, non-zero rate', () => {
        const trace = fly(createFlight(), stick(0.1, 0.1), 1);
        expect(trace.turned).toBeCloseTo(YAW_RATE * 0.1, 2);
        expect(trace.end.pitch).toBeGreaterThan(0.1);
        expect(trace.end.pitch).toBeLessThan(0.3);
      });

      it.each([
        ['level', {}],
        ['heading 1.2 rad, climbing', { heading: 1.2, pitch: 0.4 }],
        ['heading -2.5 rad, diving', { heading: -2.5, pitch: -0.9 }],
      ] as Array<[string, Partial<Attitude>]>)(
        'zero axes produce no rotation with the wings level: %s',
        (_name, start) => {
          const flight = createFlight(start);
          const before = flight.aircraft.quaternion.clone();
          const startPosition = flight.aircraft.position.clone();

          fly(flight, stick(0, 0), 2);

          expect(attitudeGap(flight.aircraft.quaternion, before)).toBeLessThan(1e-9);
          expect(
            flight.aircraft.position.distanceTo(startPosition),
            'it still flies forward'
          ).toBeGreaterThan(10);
        }
      );
    });

    describe('robustness', () => {
      it.each([
        [Number.NaN, 0],
        [0, Number.NaN],
        [Number.NaN, Number.NaN],
        [Number.POSITIVE_INFINITY, 0],
        [0, Number.NEGATIVE_INFINITY],
        [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
        [Number.NEGATIVE_INFINITY, Number.NaN],
      ])(
        'pitchAxis %f / yawAxis %f keep the attitude normalised and finite',
        (pitchAxis, yawAxis) => {
          const flight = createFlight({ heading: 0.4, pitch: 0.3, roll: -0.5 });
          const input = stick(pitchAxis, yawAxis);

          for (let step = 0; step < 60; step++) {
            flight.controller.update(STEP, input);
            expectUnitAndFinite(flight.aircraft.quaternion, 1e-9, `step ${step}`);
          }
        }
      );

      it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -STEP])(
        'deltaTime %f keeps the attitude normalised and finite',
        (deltaTime) => {
          const flight = createFlight({ heading: -1.1, pitch: -0.2, roll: 0.6 });
          const { aircraft, controller } = flight;

          for (let step = 0; step < 5; step++) {
            controller.update(deltaTime, stick(0.6, 0.8));
            expectUnitAndFinite(aircraft.quaternion, 1e-9, `step ${step}`);
          }

          // 之后的正常模拟步仍然受控
          const trace = fly(flight, stick(0, 1), 0.5);
          expectUnitAndFinite(aircraft.quaternion, 1e-9, 'after recovery');
          expect(trace.turned).toBeCloseTo(YAW_RATE * 0.5, 2);
        }
      );

      it('NaN axes together with a NaN deltaTime keep the attitude normalised and finite', () => {
        const flight = createFlight({ pitch: 0.5, roll: 1.0 });
        flight.controller.update(Number.NaN, stick(Number.NaN, Number.POSITIVE_INFINITY));
        expectUnitAndFinite(flight.aircraft.quaternion, 1e-9);
      });

      it('stays normalised and finite over a long varied assisted flight', () => {
        const flight = createFlight();
        const random = createRandom(20261010);
        let input = stick(0, 0);

        for (let step = 0; step < 6000; step++) {
          if (step % 20 === 0) {
            const centred = random() < 0.2;
            input = centred ? stick(0, 0) : stick(random() * 2 - 1, random() * 2 - 1);
          }
          flight.controller.update(STEP, input);
          // 每步归一化的姿态与 1 只差一两个 ulp（约 2e-16）；从不归一化时 6000 步后会漂到 1e-14 量级
          expectUnitAndFinite(flight.aircraft.quaternion, 5e-15, `step ${step}`);
        }

        const { pitch } = attitudeOf(flight.aircraft);
        expect(Math.abs(pitch) / DEG).toBeLessThan(77);
      });

      it('stays normalised and finite when touch and keyboard steering alternate', () => {
        const flight = createFlight();
        const random = createRandom(7);
        let input: InputState = stick(0, 0);

        for (let step = 0; step < 6000; step++) {
          if (step % 25 === 0) {
            const useStick = random() < 0.5;
            input = useStick
              ? stick(random() * 2 - 1, random() * 2 - 1)
              : keys({
                  pitchUp: random() < 0.3,
                  pitchDown: random() < 0.3,
                  yawLeft: random() < 0.3,
                  yawRight: random() < 0.3,
                  rollLeft: random() < 0.3,
                  rollRight: random() < 0.3,
                });
          }
          flight.controller.update(STEP, input);
          expectUnitAndFinite(flight.aircraft.quaternion, 1e-6, `step ${step}`);
        }
      });
    });

    describe('from the touch stick to the aircraft', () => {
      let originalIsMobile: boolean;
      let handler: InputHandler | null = null;

      beforeEach(() => {
        originalIsMobile = GameConfig.isMobile;
        GameConfig.isMobile = true;
        seedShippedMobileControls();
        handler = new InputHandler();
      });

      afterEach(() => {
        handler?.dispose();
        handler = null;
        GameConfig.isMobile = originalIsMobile;
        document.body.innerHTML = '';
      });

      it('a stick held hard right flies a banked right turn at 1.5 rad/s, and levels on release', () => {
        const input = handler as InputHandler;
        const screen = new TouchScreen();
        const flight = createFlight();

        screen.down(1, elementById('touch-stick-zone'), 180, 600);
        screen.move(1, 180 + 200, 600);
        const turn = fly(flight, () => input.getState(), 2);
        expect(turn.turned).toBeCloseTo(2 * YAW_RATE, 2);
        expect(turn.minTurnStep).toBeGreaterThan(0);
        expect(turn.end.roll / DEG).toBeLessThan(-42);
        expect(turn.end.roll / DEG).toBeGreaterThan(-48);
        expect(Math.abs(turn.end.pitch)).toBeLessThan(1e-6);

        // 手指回到原点（仍按着摇杆）：机翼改平，航向不再变化
        screen.move(1, 180, 600);
        const centred = fly(flight, () => input.getState(), 2);
        expect(Math.abs(centred.end.roll) / DEG).toBeLessThan(2);
        expect(Math.abs(centred.turned)).toBeLessThan(1e-6);
      });

      it('half stick deflection turns clearly slower than full deflection', () => {
        const input = handler as InputHandler;
        const screen = new TouchScreen();

        screen.down(1, elementById('touch-stick-zone'), 180, 600);
        screen.move(1, 180 + 27, 600);
        const half = fly(createFlight(), () => input.getState(), 1).turned;
        screen.move(1, 180 + 54, 600);
        const full = fly(createFlight(), () => input.getState(), 1).turned;

        expect(full).toBeCloseTo(YAW_RATE, 2);
        expect(half).toBeGreaterThan(0.05);
        expect(half / full).toBeLessThan(0.5);
      });
    });
  });

  // ───────────────────────────── G. 键盘飞行 ─────────────────────────────

  describe('G. keyboard flight (flightAssist off)', () => {
    describe('rates about the local axes', () => {
      it('pitch keys rotate the nose at 2.0 rad/s', () => {
        const up = fly(createFlight(), keys({ pitchUp: true }), 0.5);
        expect(up.end.pitch).toBeCloseTo(PITCH_RATE * 0.5, 6);
        expect(up.end.heading).toBeCloseTo(0, 6);
        expect(up.end.roll).toBeCloseTo(0, 6);

        const down = fly(createFlight(), keys({ pitchDown: true }), 0.5);
        expect(down.end.pitch).toBeCloseTo(-PITCH_RATE * 0.5, 6);
      });

      it('yaw keys turn at 1.5 rad/s', () => {
        const right = fly(createFlight(), keys({ yawRight: true }), 0.5);
        expect(right.turned).toBeCloseTo(YAW_RATE * 0.5, 6);
        expect(right.end.pitch).toBeCloseTo(0, 6);
        expect(right.end.roll, 'keyboard yaw does not bank').toBeCloseTo(0, 6);

        const left = fly(createFlight(), keys({ yawLeft: true }), 0.5);
        expect(left.turned).toBeCloseTo(-YAW_RATE * 0.5, 6);
      });

      it('Q / E roll at 3.0 rad/s', () => {
        const rollLeft = fly(createFlight(), keys({ rollLeft: true }), 0.25);
        expect(rollLeft.end.roll, 'Q: left wing down, right wing up').toBeCloseTo(
          ROLL_RATE * 0.25,
          6
        );
        expect(rollLeft.end.heading).toBeCloseTo(0, 6);
        expect(rollLeft.end.pitch).toBeCloseTo(0, 6);

        const rollRight = fly(createFlight(), keys({ rollRight: true }), 0.25);
        expect(rollRight.end.roll).toBeCloseTo(-ROLL_RATE * 0.25, 6);
      });

      it('pitch is about the aircraft’s own axis: banked 90° right, pulling up turns the heading right', () => {
        const flight = createFlight({ roll: -90 * DEG });
        const trace = fly(flight, keys({ pitchUp: true }), 0.5);

        expect(trace.turned).toBeCloseTo(PITCH_RATE * 0.5, 6);
        expect(trace.end.pitch).toBeCloseTo(0, 6);
      });

      it('yaw is about the aircraft’s own axis: banked 90° right, yawing right drops the nose', () => {
        const flight = createFlight({ roll: -90 * DEG });
        const trace = fly(flight, keys({ yawRight: true }), 0.5);

        expect(trace.end.pitch).toBeCloseTo(-YAW_RATE * 0.5, 6);
        expect(Math.abs(trace.turned)).toBeLessThan(1e-6);
      });

      it('keyboard flight has no pitch limit: holding W loops through the vertical', () => {
        const flight = createFlight();
        const trace = fly(flight, keys({ pitchUp: true }), 1);

        // 2 rad/s × 1 s = 2 rad：机头已经越过垂直（π/2），辅助飞行会停在 75°
        expect(trace.maxPitch / DEG).toBeGreaterThan(85);
        expect(
          bodyAxes(flight.aircraft).up.y,
          'past the vertical the aircraft is on its back'
        ).toBeLessThan(0);
      });
    });

    describe('auto-level', () => {
      it('levels the wings when there is no pitch, yaw or roll input', () => {
        const flight = createFlight({ heading: 0.5, pitch: 0.2, roll: 0.6 });
        const forwardBefore = bodyAxes(flight.aircraft).forward;

        const trace = fly(flight, keys(), 2);

        expect(Math.abs(trace.end.roll) / DEG).toBeLessThan(1.5);
        expect(
          bodyAxes(flight.aircraft).forward.distanceTo(forwardBefore),
          'only the roll is corrected'
        ).toBeLessThan(1e-9);
      });

      it('levels from either side', () => {
        const fromRight = fly(createFlight({ roll: -0.9 }), keys(), 2);
        expect(Math.abs(fromRight.end.roll) / DEG).toBeLessThan(1.5);

        const fromLeft = fly(createFlight({ roll: 0.9 }), keys(), 2);
        expect(Math.abs(fromLeft.end.roll) / DEG).toBeLessThan(1.5);
      });

      it('fire, missile, boost and special do not count as steering input', () => {
        const flight = createFlight({ roll: 0.6 });
        const trace = fly(
          flight,
          keys({ fire: true, missile: true, throttle: true, special: true }),
          2
        );
        expect(Math.abs(trace.end.roll) / DEG).toBeLessThan(1.5);
      });

      it('does not level while a pitch key is held', () => {
        const flight = createFlight({ roll: 0.6 });
        const rightBefore = bodyAxes(flight.aircraft).right;

        fly(flight, keys({ pitchUp: true }), 0.5);

        // 只绕机体右轴转动：右轴方向不变；一旦自动改平介入它就会变
        expect(bodyAxes(flight.aircraft).right.distanceTo(rightBefore)).toBeLessThan(1e-9);
      });

      it('does not level while a yaw key is held', () => {
        const flight = createFlight({ roll: 0.6 });
        const upBefore = bodyAxes(flight.aircraft).up;

        fly(flight, keys({ yawLeft: true }), 0.5);

        expect(bodyAxes(flight.aircraft).up.distanceTo(upBefore)).toBeLessThan(1e-9);
      });

      it('does not fight a roll key', () => {
        const flight = createFlight({ roll: 0.6 });
        const trace = fly(flight, keys({ rollLeft: true }), 0.1);

        expect(trace.end.roll).toBeCloseTo(0.6 + ROLL_RATE * 0.1, 6);
      });

      it('does not level while opposite keys cancel each other', () => {
        const flight = createFlight({ roll: 0.6 });
        const before = flight.aircraft.quaternion.clone();

        fly(flight, keys({ pitchUp: true, pitchDown: true }), 1);

        expect(attitudeGap(flight.aircraft.quaternion, before)).toBeLessThan(1e-9);
      });

      it('resumes once the keys are released', () => {
        const flight = createFlight();
        fly(flight, keys({ rollRight: true }), 0.25);
        expect(attitudeOf(flight.aircraft).roll).toBeCloseTo(-ROLL_RATE * 0.25, 6);

        const trace = fly(flight, keys(), 2);
        expect(Math.abs(trace.end.roll) / DEG).toBeLessThan(1.5);
      });
    });

    describe('InputState without the new fields', () => {
      it('booleans alone behave like booleans with axes at ±1 and flightAssist false', () => {
        const plain = createFlight();
        const explicit = createFlight();
        const random = createRandom(99);
        let held = keys();

        for (let step = 0; step < 3000; step++) {
          if (step % 15 === 0) {
            const pitch = Math.floor(random() * 3) - 1;
            const yaw = Math.floor(random() * 3) - 1;
            const roll = Math.floor(random() * 3) - 1;
            held = keys({
              pitchUp: pitch > 0,
              pitchDown: pitch < 0,
              yawRight: yaw > 0,
              yawLeft: yaw < 0,
              rollLeft: roll > 0,
              rollRight: roll < 0,
            });
          }
          plain.controller.update(STEP, held);
          explicit.controller.update(STEP, {
            ...held,
            pitchAxis: (held.pitchUp ? 1 : 0) - (held.pitchDown ? 1 : 0),
            yawAxis: (held.yawRight ? 1 : 0) - (held.yawLeft ? 1 : 0),
            flightAssist: false,
          });
          expect(
            attitudeGap(plain.aircraft.quaternion, explicit.aircraft.quaternion),
            `step ${step}`
          ).toBeLessThan(1e-9);
        }
      });

      it('booleans with the axes left at 0 still steer at full rate (a script writing into the reused state)', () => {
        const flight = createFlight();
        const trace = fly(
          flight,
          {
            ...keys({ yawRight: true, pitchUp: true }),
            pitchAxis: 0,
            yawAxis: 0,
            flightAssist: false,
          },
          0.25
        );
        const reference = fly(createFlight(), keys({ yawRight: true, pitchUp: true }), 0.25);

        expect(trace.end.heading).toBeCloseTo(reference.end.heading, 9);
        expect(trace.end.pitch).toBeCloseTo(reference.end.pitch, 9);
        expect(trace.end.pitch).toBeGreaterThan(0.4);
      });
    });

    it('matches the pre-change keyboard model over a long mixed key sequence', () => {
      const flight = createFlight();
      const reference = new THREE.Group();
      const random = createRandom(6384);
      let held = keys();

      for (let step = 0; step < 6000; step++) {
        if (step % 12 === 0) {
          const idle = random() < 0.35;
          held = idle
            ? keys({ fire: random() < 0.5, throttle: random() < 0.5 })
            : keys({
                pitchUp: random() < 0.3,
                pitchDown: random() < 0.3,
                yawLeft: random() < 0.3,
                yawRight: random() < 0.3,
                rollLeft: random() < 0.3,
                rollRight: random() < 0.3,
              });
        }
        flight.controller.update(STEP, held);
        legacyKeyboardStep(reference, STEP, held);
        expect(
          attitudeGap(flight.aircraft.quaternion, reference.quaternion),
          `step ${step}`
        ).toBeLessThan(1e-9);
      }
    });
  });
});
