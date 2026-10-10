import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import {
  ScriptedPilot,
  type PilotKind,
  type PilotTarget,
  type PilotWorld,
} from '@/core/dev/ScriptedPilot';
import { InputHandler, type InputState } from '@/core/Input/InputHandler';
import { PlayerController } from '@/features/player/PlayerController';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { elementById, seedShippedMobileControls, TouchScreen } from './touchTestUtils';

/**
 * 脚本飞行员的输入清理（ScriptedPilot，L3）：
 * decide() 每步先清空 input 再写自己的决定。清空除了原有的布尔字段，还包括模拟量与辅助飞行标记
 * （pitchAxis 0、yawAxis 0、flightAssist false）——脚本只写布尔方向，而 input 是 InputHandler
 * 每步复用的对象，残留的摇杆值 / 辅助标记会盖过脚本的方向。
 */

const STEP = 1 / 60;

const BOOLEAN_FIELDS = [
  'pitchUp',
  'pitchDown',
  'yawLeft',
  'yawRight',
  'rollLeft',
  'rollRight',
  'fire',
  'missile',
  'throttle',
  'special',
] as const;

const PILOT_KINDS: PilotKind[] = ['passive', 'scripted'];

/** 上一步留在 input 里的模拟量 / 辅助标记 */
const LEFTOVERS: Array<[number, number, boolean]> = [
  [1, 1, true],
  [-1, -1, true],
  [0.35, -0.8, true],
  [-0.6, 0.2, false],
  [0, 1, false],
  [1, 0, true],
  [0, 0, true],
  [Number.NaN, Number.POSITIVE_INFINITY, true],
];

function booleanInput(value: boolean): InputState {
  return {
    pitchUp: value,
    pitchDown: value,
    yawLeft: value,
    yawRight: value,
    rollLeft: value,
    rollRight: value,
    fire: value,
    missile: value,
    throttle: value,
    special: value,
  };
}

function createWorld(overrides: Partial<PilotWorld> = {}): PilotWorld {
  return {
    position: new THREE.Vector3(0, 300, 0),
    quaternion: new THREE.Quaternion(),
    speed: 60,
    targets: [],
    groundY: () => 0,
    incomingMissileDistance: Number.POSITIVE_INFINITY,
    special: { mode: null, ready: false, charge: 0, overheated: false, range: 0 },
    flareCharges: 0,
    secondsSinceHit: Number.POSITIVE_INFINITY,
    secondsSinceRespawn: Number.POSITIVE_INFINITY,
    bossSpeed: 0,
    ...overrides,
  };
}

function createPilot(kind: PilotKind): ScriptedPilot {
  return new ScriptedPilot(kind, { aimErrorDeg: 0, random: () => 0.5 });
}

/** 左前上方的一架敌机：脚本飞行员要向左转过去 */
function targetAheadLeft(): PilotTarget {
  return {
    object: new THREE.Object3D(),
    position: new THREE.Vector3(-400, 320, -300),
    velocity: new THREE.Vector3(),
    kind: 'jet',
    radius: 6,
    weight: 1,
  };
}

/** 航向（弧度，右转为正；机头朝 -Z 时为 0） */
function headingOf(aircraft: THREE.Object3D): number {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quaternion);
  return Math.atan2(forward.x, -forward.z);
}

describe('scripted pilot input clearing (ScriptedPilot)', () => {
  let originalIsMobile: boolean;
  let handler: InputHandler | null = null;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    // PlayerController 的构造函数要画一张喷口辉光贴图；jsdom 没有 2D canvas
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
    handler?.dispose();
    handler = null;
    GameConfig.isMobile = originalIsMobile;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe.each(PILOT_KINDS)('%s pilot', (kind) => {
    it.each(LEFTOVERS)(
      'decide() resets pitchAxis %f, yawAxis %f and flightAssist %s',
      (pitchAxis, yawAxis, flightAssist) => {
        const pilot = createPilot(kind);
        const input: InputState = { ...booleanInput(true), pitchAxis, yawAxis, flightAssist };

        pilot.decide(STEP, createWorld(), input);

        expect(input.pitchAxis).toBe(0);
        expect(input.yawAxis).toBe(0);
        expect(input.flightAssist).toBe(false);
      }
    );

    it('resets them on every step, not only the first', () => {
      const pilot = createPilot(kind);
      const world = createWorld({ targets: [targetAheadLeft()] });
      const input: InputState = booleanInput(false);

      for (let step = 0; step < 5; step++) {
        input.pitchAxis = -0.4 - step * 0.1;
        input.yawAxis = 0.9;
        input.flightAssist = true;

        pilot.decide(STEP, world, input);

        expect(input.pitchAxis, `step ${step}`).toBe(0);
        expect(input.yawAxis, `step ${step}`).toBe(0);
        expect(input.flightAssist, `step ${step}`).toBe(false);
      }
    });

    it('writes the analog fields into an input that did not have them', () => {
      const pilot = createPilot(kind);
      const input: InputState = booleanInput(false);

      pilot.decide(STEP, createWorld(), input);

      expect(input.pitchAxis).toBe(0);
      expect(input.yawAxis).toBe(0);
      expect(input.flightAssist).toBe(false);
    });

    it('clears the state object that InputHandler reuses, with a finger still on the stick', () => {
      GameConfig.isMobile = true;
      seedShippedMobileControls();
      const created = new InputHandler();
      handler = created;
      const screen = new TouchScreen();
      screen.down(1, elementById('touch-stick-zone'), 180, 600);
      screen.move(1, 180 + 200, 600 + 200);

      const state = created.getState();
      expect(state.flightAssist).toBe(true);
      expect(state.yawAxis).toBeGreaterThan(0.5);
      expect(state.pitchAxis).toBeLessThan(-0.5);

      createPilot(kind).decide(STEP, createWorld(), state);

      expect(state.pitchAxis).toBe(0);
      expect(state.yawAxis).toBe(0);
      expect(state.flightAssist).toBe(false);
    });
  });

  it('a passive pilot still clears every boolean as before', () => {
    const input: InputState = {
      ...booleanInput(true),
      pitchAxis: 1,
      yawAxis: -1,
      flightAssist: true,
    };

    createPilot('passive').decide(STEP, createWorld({ targets: [targetAheadLeft()] }), input);

    for (const field of BOOLEAN_FIELDS) {
      expect(input[field], field).toBe(false);
    }
  });

  describe('flown through PlayerController', () => {
    interface Flight {
      aircraft: THREE.Group;
      controller: PlayerController;
    }

    function createFlight(): Flight {
      const aircraft = new THREE.Group();
      aircraft.position.set(0, 300, 0);
      const controller = new PlayerController(aircraft, new THREE.Scene(), new PlayerStats());
      return { aircraft, controller };
    }

    /** 每步在 decide() 之前把 input 弄脏（上一步的摇杆满右、压低机头、辅助飞行开着） */
    function leaveStickBehind(input: InputState): void {
      input.pitchAxis = -1;
      input.yawAxis = 1;
      input.flightAssist = true;
    }

    function flyWithPilot(
      kind: PilotKind,
      targets: PilotTarget[],
      steps: number,
      dirty: boolean
    ): { flight: Flight; attitudes: THREE.Quaternion[] } {
      const flight = createFlight();
      const pilot = createPilot(kind);
      const input: InputState = booleanInput(false);
      const attitudes: THREE.Quaternion[] = [];
      for (let step = 0; step < steps; step++) {
        if (dirty) {
          leaveStickBehind(input);
        }
        const world = createWorld({
          position: flight.aircraft.position,
          quaternion: flight.aircraft.quaternion,
          speed: flight.controller.getSpeed(),
          targets,
        });
        pilot.decide(STEP, world, input);
        flight.controller.update(STEP, input);
        attitudes.push(flight.aircraft.quaternion.clone());
      }
      return { flight, attitudes };
    }

    it('the leftover stick alone would turn the aircraft right (control case)', () => {
      const flight = createFlight();
      const input: InputState = booleanInput(false);
      for (let step = 0; step < 60; step++) {
        leaveStickBehind(input);
        flight.controller.update(STEP, input);
      }
      expect(headingOf(flight.aircraft)).toBeGreaterThan(0.5);
    });

    it('a passive pilot flies straight although the stick was left hard over', () => {
      const { flight, attitudes } = flyWithPilot('passive', [], 60, true);

      expect(headingOf(flight.aircraft)).toBeCloseTo(0, 9);
      for (const attitude of attitudes) {
        expect(attitude.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
      }
    });

    it('a scripted pilot turns left toward its target although the stick was left hard right', () => {
      const { flight } = flyWithPilot('scripted', [targetAheadLeft()], 60, true);
      expect(headingOf(flight.aircraft)).toBeLessThan(-0.4);
    });

    it('a scripted pilot flies exactly the same with and without the leftover stick', () => {
      const clean = flyWithPilot('scripted', [targetAheadLeft()], 120, false);
      const dirty = flyWithPilot('scripted', [targetAheadLeft()], 120, true);

      // 干净的那次确实在转向（否则两次相同说明不了什么）
      expect(headingOf(clean.flight.aircraft)).toBeLessThan(-0.4);
      for (let step = 0; step < clean.attitudes.length; step++) {
        expect(dirty.attitudes[step].toArray(), `step ${step}`).toEqual(
          clean.attitudes[step].toArray()
        );
      }
      expect(dirty.flight.aircraft.position.toArray()).toEqual(
        clean.flight.aircraft.position.toArray()
      );
    });
  });
});
