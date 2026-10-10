import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';
import { BossMissileSystem } from '@/features/boss/BossMissileSystem';
import type { BossMissileFlightProfile } from '@/features/boss/BossMissileSystem';
import { MissileSystem } from '@/features/combat/MissileSystem';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { UnitMissilePool } from '@/features/units/UnitMissiles';
import type { UnitMissileEnv } from '@/features/units/UnitMissiles';

/**
 * 玩家导弹的飞行（C1，取代原来的 80 米/秒）。
 *
 * 只看结果：离架速度与载机速度的关系、巡航有多快、多久打到目标、打不打得中、
 * 没有目标时会不会自毁。不读也不固定内部的加速度 / 转向 / 寿命常数。
 * 速度一律用“相邻两步的位移 / 步长”量出来。
 */

const DT = 1 / 60;
/** 载机速度：巡航、加力、升级满、再叠加速度道具 */
const CRUISE_LAUNCHER = 22.5;
const AIRCRAFT_SPEEDS = [22.5, 45, 85, 127.5];
/** 离架后直飞这么久才开始制导 */
const STRAIGHT_TIME = 0.2;
/** 模拟的最长时间（秒）：远大于任何一枚导弹该活的时间 */
const SIM_LIMIT = 30;

const NOSE = new THREE.Vector3(0, 0, -1);

interface Flight {
  system: MissileSystem;
  missile: THREE.Object3D;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  launcherSpeed: number;
}

interface LaunchOptions {
  launcherSpeed?: number;
  origin?: THREE.Vector3;
  direction?: THREE.Vector3;
  target?: THREE.Object3D;
}

interface HitResult {
  /** 命中时刻（秒）；没打中为 null */
  time: number | null;
  /** 导弹从发射点飞出的最远直线距离 */
  reach: number;
  /** 导弹消失的时刻（命中或自毁） */
  endedAt: number | null;
}

describe('player missile flight', () => {
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    particleSystem = {
      createMissileTrail: vi.fn(),
      createMissileImpact: vi.fn(),
      createTrail: vi.fn(),
      createExplosion: vi.fn(),
    } as unknown as ParticleSystem;
  });

  function launch(options: LaunchOptions = {}): Flight {
    const system = new MissileSystem(scene, particleSystem);
    const origin = options.origin?.clone() ?? new THREE.Vector3(0, 300, 0);
    const direction = (options.direction ?? NOSE).clone().normalize();
    const launcherSpeed = options.launcherSpeed ?? CRUISE_LAUNCHER;
    const before = new Set(scene.children);
    system.fire(origin.clone(), direction.clone(), options.target, launcherSpeed);
    const added = scene.children.filter((child) => !before.has(child));
    expect(added.length, 'expected one missile model in the scene').toBe(1);
    return { system, missile: added[0], origin, direction, launcherSpeed };
  }

  function addTarget(position: THREE.Vector3): THREE.Object3D {
    const target = new THREE.Object3D();
    target.position.copy(position);
    scene.add(target);
    return target;
  }

  /** 目标在发射点正前方 distance 处（发射点默认 (0, 300, 0)，机头 -Z） */
  function targetAhead(distance: number): THREE.Object3D {
    return addTarget(new THREE.Vector3(0, 300, -distance));
  }

  /** 推进 seconds 秒，返回每一步量到的速度（米/秒） */
  function speedsOver(flight: Flight, seconds: number): number[] {
    const speeds: number[] = [];
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i += 1) {
      const before = flight.missile.position.clone();
      flight.system.update(DT);
      speeds.push(flight.missile.position.distanceTo(before) / DT);
    }
    return speeds;
  }

  /** 飞 seconds 秒之后的速度（最后几步的平均） */
  function cruiseSpeed(launcherSpeed: number, seconds = 3): number {
    const speeds = speedsOver(launch({ launcherSpeed }), seconds);
    const tail = speeds.slice(-10);
    return tail.reduce((sum, value) => sum + value, 0) / tail.length;
  }

  /**
   * 一直飞到命中或导弹消失。move 在每一步之前把目标挪到 t 时刻的位置。
   */
  function flyOut(
    flight: Flight,
    target: THREE.Object3D | null,
    move?: (target: THREE.Object3D, time: number) => void
  ): HitResult {
    let time = 0;
    let hitTime: number | null = null;
    let reach = 0;
    const steps = Math.round(SIM_LIMIT / DT);
    for (let i = 0; i < steps; i += 1) {
      time += DT;
      if (target && move) move(target, time);
      flight.system.update(DT);
      if (flight.missile.parent) {
        reach = Math.max(reach, flight.missile.position.distanceTo(flight.origin));
      }
      if (target) {
        flight.system.checkCollisions([target], () => {
          hitTime = time;
        });
      }
      if (hitTime !== null || flight.system.getActiveCount() === 0) {
        return { time: hitTime, reach, endedAt: time };
      }
    }
    return { time: null, reach, endedAt: null };
  }

  function timeToStationaryTarget(distance: number, launcherSpeed = CRUISE_LAUNCHER): number {
    const target = targetAhead(distance);
    const result = flyOut(launch({ launcherSpeed, target }), target);
    expect(result.time, `a target ${distance} m dead ahead should be hit`).not.toBeNull();
    return result.time as number;
  }

  describe('off the rail', () => {
    it.each(AIRCRAFT_SPEEDS)('leaves a launcher flying at %s faster than the launcher', (speed) => {
      const [first] = speedsOver(launch({ launcherSpeed: speed }), DT);

      expect(first).toBeGreaterThan(speed);
    });

    it.each(AIRCRAFT_SPEEDS)(
      'is only slightly faster than a launcher flying at %s at that moment',
      (speed) => {
        const [first] = speedsOver(launch({ launcherSpeed: speed }), DT);
        const cruise = cruiseSpeed(speed);

        // 离架只比载机快一点（远没到巡航速度），不会从机腹下“瞬移”出去
        expect(first - speed).toBeLessThan(40);
        expect(first).toBeLessThan(cruise - 30);
      }
    );

    it('inherits the launcher speed: the faster the launcher, the faster the missile off the rail', () => {
      const first = (launcherSpeed: number): number => speedsOver(launch({ launcherSpeed }), DT)[0];
      const stationary = first(0);
      const offTheRail = AIRCRAFT_SPEEDS.map(first);

      expect(offTheRail[0]).toBeGreaterThan(stationary);
      for (let i = 1; i < offTheRail.length; i += 1) {
        const gained = offTheRail[i] - offTheRail[i - 1];
        const launcherGain = AIRCRAFT_SPEEDS[i] - AIRCRAFT_SPEEDS[i - 1];
        // 载机快多少，离架的导弹就快多少
        expect(gained, `launcher ${AIRCRAFT_SPEEDS[i]}`).toBeGreaterThan(launcherGain - 5);
        expect(gained, `launcher ${AIRCRAFT_SPEEDS[i]}`).toBeLessThan(launcherGain + 5);
      }
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -50])(
      'still launches a sound missile when the launcher speed handed over is %s',
      (speed) => {
        const flight = launch({ launcherSpeed: speed });
        let previousAhead = 0;
        for (let i = 0; i < Math.round(3 / DT); i += 1) {
          flight.system.update(DT);
          const position = flight.missile.position;
          expect(Number.isFinite(position.x + position.y + position.z), `step ${i}`).toBe(true);
          const ahead = position.clone().sub(flight.origin).dot(NOSE);
          expect(ahead, `step ${i}: it should keep flying forwards`).toBeGreaterThan(previousAhead);
          previousAhead = ahead;
        }
        // 3 秒后已经在巡航：飞出去几百米
        expect(previousAhead).toBeGreaterThan(400);
        expect(previousAhead).toBeLessThan(700);
      }
    );

    it.each(AIRCRAFT_SPEEDS)(
      'flies straight for its first 0.2 s from a launcher at %s, then turns to the target',
      (speed) => {
        // 目标在右侧正横：一开始制导就得转弯
        const target = addTarget(new THREE.Vector3(400, 300, 0));
        const flight = launch({ launcherSpeed: speed, target });
        const directions: THREE.Vector3[] = [];
        for (let i = 0; i < Math.round(0.8 / DT); i += 1) {
          const before = flight.missile.position.clone();
          flight.system.update(DT);
          directions.push(flight.missile.position.clone().sub(before).normalize());
        }

        const straightSteps = Math.floor(STRAIGHT_TIME / DT) - 1;
        for (let i = 0; i < straightSteps; i += 1) {
          expect(directions[i].angleTo(NOSE), `step ${i}`).toBeLessThan(1e-6);
        }
        const last = directions[directions.length - 1];
        expect(last.angleTo(NOSE)).toBeGreaterThan(THREE.MathUtils.degToRad(20));
        expect(last.x, 'it should have turned towards the target').toBeGreaterThan(0);
      }
    );
  });

  describe('acceleration and cruise', () => {
    it.each(AIRCRAFT_SPEEDS)(
      'accelerates hard: near its cruise speed about a second after leaving a launcher at %s',
      (speed) => {
        const cruise = cruiseSpeed(speed);
        const speeds = speedsOver(launch({ launcherSpeed: speed }), 1.1);

        expect(speeds[speeds.length - 1]).toBeGreaterThan(cruise * 0.95);
      }
    );

    it.each(AIRCRAFT_SPEEDS)('never slows down on the way up from a launcher at %s', (speed) => {
      const speeds = speedsOver(launch({ launcherSpeed: speed }), 3);

      for (let i = 1; i < speeds.length; i += 1) {
        expect(speeds[i], `step ${i}`).toBeGreaterThanOrEqual(speeds[i - 1] - 1e-6);
      }
    });

    it.each([22.5, 45, 85])('cruises at about 200 units/s from a launcher at %s', (speed) => {
      const cruise = cruiseSpeed(speed);

      expect(cruise).toBeGreaterThan(185);
      expect(cruise).toBeLessThan(215);
    });

    it('cruises no slower from the fastest aircraft (127.5 with the speed power-up)', () => {
      const cruise = cruiseSpeed(127.5);

      expect(cruise).toBeGreaterThan(190);
      expect(cruise).toBeLessThan(240);
    });

    it('holds its cruise speed once it gets there', () => {
      const speeds = speedsOver(launch({ launcherSpeed: CRUISE_LAUNCHER }), 6);
      const late = speeds.slice(Math.round(2 / DT));

      expect(Math.max(...late) - Math.min(...late)).toBeLessThan(1e-6);
    });

    it.each(AIRCRAFT_SPEEDS)(
      'is clearly faster than the aircraft that launched it at %s',
      (speed) => {
        expect(cruiseSpeed(speed)).toBeGreaterThan(speed + 50);
      }
    );

    it('stays clearly faster than its launcher even beyond today’s top aircraft speed', () => {
      // “任何升级档位下都明显快过载机”是规则而不是恰好：载机再快，导弹也不会被追平
      const speed = 170;

      expect(cruiseSpeed(speed)).toBeGreaterThan(speed + 50);
    });

    it.each(AIRCRAFT_SPEEDS)('pulls steadily ahead of a launcher that flies on at %s', (speed) => {
      const flight = launch({ launcherSpeed: speed });
      let previousGap = 0;
      const steps = Math.round(4 / DT);
      for (let i = 1; i <= steps; i += 1) {
        flight.system.update(DT);
        const missileAhead = flight.missile.position.clone().sub(flight.origin).dot(NOSE);
        const launcherAhead = speed * i * DT;
        const gap = missileAhead - launcherAhead;
        expect(gap, `step ${i}`).toBeGreaterThan(previousGap);
        previousGap = gap;
      }
      // 4 秒后已经把载机甩开几百米
      expect(previousGap).toBeGreaterThan(200);
    });
  });

  describe('time to a stationary target dead ahead of a cruising launcher', () => {
    it('reaches 300 m in about 1.8 s', () => {
      const time = timeToStationaryTarget(300);

      expect(time).toBeGreaterThan(1.3);
      expect(time).toBeLessThan(2.3);
    });

    it('reaches 600 m in about 3.3 s (under 4 s)', () => {
      const time = timeToStationaryTarget(600);

      expect(time).toBeGreaterThan(2.7);
      expect(time).toBeLessThan(4);
    });

    it('reaches 1200 m in about 6.3 s', () => {
      const time = timeToStationaryTarget(1200);

      expect(time).toBeGreaterThan(5.4);
      expect(time).toBeLessThan(7.4);
    });

    it('reaches a target at the lock range before it expires', () => {
      const lockRange = GAME_CONSTANTS.MISSILE.MAX_LOCK_DISTANCE;
      const target = targetAhead(lockRange);

      const result = flyOut(launch({ target }), target);

      expect(result.time, `a target at ${lockRange} m should be hit`).not.toBeNull();
    });

    it.each(AIRCRAFT_SPEEDS)('reaches the lock range from a launcher at %s too', (speed) => {
      const target = targetAhead(GAME_CONSTANTS.MISSILE.MAX_LOCK_DISTANCE);

      const result = flyOut(launch({ launcherSpeed: speed, target }), target);

      expect(result.time).not.toBeNull();
    });

    it('gets there no later from a faster launcher', () => {
      const times = AIRCRAFT_SPEEDS.map((speed) => timeToStationaryTarget(600, speed));

      for (let i = 1; i < times.length; i += 1) {
        expect(times[i], `launcher ${AIRCRAFT_SPEEDS[i]}`).toBeLessThanOrEqual(times[i - 1]);
      }
    });
  });

  describe('hits', () => {
    const JET_SPEEDS = [40, 55, 70];
    const RADII = [150, 300];
    const PHASES = [0, 90, 180, 270];
    const TILTS = [0, 35];

    interface Orbit {
      speed: number;
      radius: number;
      phase: number;
      clockwise: boolean;
      tilt: number;
    }

    const ORBITS: Orbit[] = [];
    for (const speed of JET_SPEEDS) {
      for (const radius of RADII) {
        for (const phase of PHASES) {
          for (const clockwise of [true, false]) {
            for (const tilt of TILTS) ORBITS.push({ speed, radius, phase, clockwise, tilt });
          }
        }
      }
    }

    /** 以发射点正前方 500 m 为圆心盘旋（tilt 把盘旋平面绕机头轴倾斜） */
    function orbitPosition(orbit: Orbit, time: number, out: THREE.Vector3): THREE.Vector3 {
      const turn = ((orbit.clockwise ? 1 : -1) * orbit.speed * time) / orbit.radius;
      const angle = THREE.MathUtils.degToRad(orbit.phase) + turn;
      const tilt = THREE.MathUtils.degToRad(orbit.tilt);
      const across = Math.cos(angle) * orbit.radius;
      const along = Math.sin(angle) * orbit.radius;
      return out.set(across * Math.cos(tilt), 300 + across * Math.sin(tilt), -500 + along);
    }

    it.each(ORBITS)(
      'hits a jet circling at $speed units/s (radius $radius, phase $phase, clockwise $clockwise, tilt $tilt)',
      (orbit) => {
        const target = addTarget(orbitPosition(orbit, 0, new THREE.Vector3()));

        const result = flyOut(launch({ target }), target, (object, time) => {
          orbitPosition(orbit, time, object.position);
        });

        expect(result.time).not.toBeNull();
        // 不是绕了半天才碰巧撞上
        expect(result.time as number).toBeLessThan(6);
      }
    );

    it.each(AIRCRAFT_SPEEDS)(
      'hits a circling jet when launched from an aircraft at %s',
      (launcherSpeed) => {
        const orbit: Orbit = { speed: 70, radius: 150, phase: 180, clockwise: true, tilt: 35 };
        const target = addTarget(orbitPosition(orbit, 0, new THREE.Vector3()));

        const result = flyOut(launch({ launcherSpeed, target }), target, (object, time) => {
          orbitPosition(orbit, time, object.position);
        });

        expect(result.time).not.toBeNull();
      }
    );

    const OFF_NOSE = [
      { angle: 30, range: 300, plane: 'right' },
      { angle: 30, range: 600, plane: 'left' },
      { angle: 60, range: 300, plane: 'left' },
      { angle: 60, range: 600, plane: 'up' },
      { angle: 90, range: 300, plane: 'right' },
      { angle: 90, range: 600, plane: 'down' },
      { angle: 90, range: 300, plane: 'up' },
    ] as const;

    function offNosePosition(angleDeg: number, range: number, plane: string): THREE.Vector3 {
      const angle = THREE.MathUtils.degToRad(angleDeg);
      const side = Math.sin(angle) * range;
      const ahead = Math.cos(angle) * range;
      const offset = new THREE.Vector3(0, 0, -ahead);
      if (plane === 'right') offset.x = side;
      if (plane === 'left') offset.x = -side;
      if (plane === 'up') offset.y = side;
      if (plane === 'down') offset.y = -side;
      return offset.add(new THREE.Vector3(0, 300, 0));
    }

    it.each(OFF_NOSE)(
      'hits a target $angle° off the nose ($plane) at $range m',
      ({ angle, range, plane }) => {
        const target = addTarget(offNosePosition(angle, range, plane));

        const result = flyOut(launch({ target }), target);

        expect(result.time).not.toBeNull();
        // 转过去再飞到：不会比直线多绕太久
        expect(result.time as number).toBeLessThan(range / 100 + 2);
      }
    );

    it.each(AIRCRAFT_SPEEDS)(
      'hits a target 60° off the nose when launched from an aircraft at %s',
      (launcherSpeed) => {
        const target = addTarget(offNosePosition(60, 400, 'right'));

        const result = flyOut(launch({ launcherSpeed, target }), target);

        expect(result.time).not.toBeNull();
      }
    );

    it('hits a jet crossing at 70 units/s well off the nose', () => {
      const start = offNosePosition(60, 500, 'left');
      const target = addTarget(start);

      const result = flyOut(launch({ target }), target, (object, time) => {
        object.position.set(start.x + 70 * time, start.y, start.z);
      });

      expect(result.time).not.toBeNull();
    });

    it('runs down a jet flying straight away at 70 units/s', () => {
      const target = targetAhead(500);

      const result = flyOut(launch({ target }), target, (object, time) => {
        object.position.set(0, 300, -500 - 70 * time);
      });

      expect(result.time).not.toBeNull();
    });
  });

  describe('with nothing to hit', () => {
    it.each(AIRCRAFT_SPEEDS)(
      'expires instead of flying forever (launcher at %s)',
      (launcherSpeed) => {
        const flight = launch({ launcherSpeed });

        const result = flyOut(flight, null);

        expect(result.endedAt, 'the missile should be gone').not.toBeNull();
        expect(result.endedAt as number).toBeLessThan(20);
        expect(flight.system.getActiveCount()).toBe(0);
        expect(flight.missile.parent, 'its model should leave the scene').toBeNull();
        // 飞出去的距离有上限
        expect(result.reach).toBeLessThan(4000);
      }
    );

    it('still flies far enough to cover the lock range before it gives up', () => {
      const result = flyOut(launch(), null);

      expect(result.reach).toBeGreaterThan(GAME_CONSTANTS.MISSILE.MAX_LOCK_DISTANCE);
    });

    it('expires when its target has left the scene', () => {
      const target = targetAhead(900);
      const flight = launch({ target });
      for (let i = 0; i < 30; i += 1) flight.system.update(DT);
      scene.remove(target);

      const result = flyOut(flight, null);

      expect(result.endedAt).not.toBeNull();
      expect(flight.system.getActiveCount()).toBe(0);
      expect(flight.missile.parent).toBeNull();
    });
  });
});

/**
 * Boss 导弹和地面 / 海面单位的导弹有各自的飞行参数：玩家导弹改快以后它们不变。
 * 这里把玩家导弹的调校改得面目全非再飞一遍，比较两次的航迹。
 */
describe('other missiles keep their own flight', () => {
  const OUTLANDISH = {
    SPEED: 900,
    ACCELERATION: 5000,
    LAUNCH_SPEED_BOOST: 400,
    MIN_OVERTAKE_SPEED: 700,
    TURN_SPEED: 40,
    MAX_LIFETIME: 0.5,
    MAX_FLIGHT_DISTANCE: 50,
    DAMAGE: 1,
  };

  function withPlayerMissileTuning<T>(overrides: typeof OUTLANDISH, run: () => T): T {
    const tuning = GAME_CONSTANTS.MISSILE as Record<string, number>;
    const saved = { ...tuning };
    Object.assign(tuning, overrides);
    try {
      return run();
    } finally {
      Object.assign(tuning, saved);
    }
  }

  function track(object: THREE.Object3D, step: () => void, seconds: number): number[] {
    const samples: number[] = [];
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i += 1) {
      step();
      samples.push(object.position.x, object.position.y, object.position.z);
    }
    return samples;
  }

  function playerMissileTrack(): number[] {
    const scene = new THREE.Scene();
    const particleSystem = {
      createMissileTrail: vi.fn(),
      createMissileImpact: vi.fn(),
      createTrail: vi.fn(),
      createExplosion: vi.fn(),
    } as unknown as ParticleSystem;
    const system = new MissileSystem(scene, particleSystem);
    system.fire(new THREE.Vector3(0, 300, 0), NOSE.clone(), undefined, CRUISE_LAUNCHER);
    const missile = scene.children[0];
    return track(missile, () => system.update(DT), 0.4);
  }

  function bossMissileTrack(profile?: BossMissileFlightProfile): number[] {
    const scene = new THREE.Scene();
    const particleSystem = {
      createExplosion: vi.fn(),
      createTrail: vi.fn(),
      createBossMissileTrail: vi.fn(),
      createBossMissileExplosion: vi.fn(),
      createHit: vi.fn(),
    } as unknown as ParticleSystem;
    const player = new THREE.Object3D();
    player.position.set(250, 320, -600);
    scene.add(player);
    const system = new BossMissileSystem(scene, particleSystem);
    system.fire(new THREE.Vector3(0, 40, 0), null, [], player, true, profile);
    const [missile] = system.getMissiles();
    return track(
      missile.mesh,
      () => {
        player.position.x += 45 * DT;
        system.update(DT);
      },
      4
    );
  }

  function unitMissileTrack(): number[] {
    const scene = new THREE.Scene();
    const pool = new UnitMissilePool(scene, 2);
    const env: UnitMissileEnv = {
      playerPosition: new THREE.Vector3(300, 350, -700),
      playerVelocity: new THREE.Vector3(45, 0, 0),
      decoys: [],
      particleSystem: null,
      sampleSurfaceY: () => 0,
      onPlayerHit: vi.fn(),
      onUnitHit: vi.fn(),
      onDetonate: vi.fn(),
    };
    const launched = pool.launch(
      new THREE.Vector3(0, 20, 0),
      new THREE.Vector3(0, 1, 0),
      'player',
      20,
      { maxSpeed: 95, turnRate: 1.4, life: 12 }
    );
    expect(launched).toBe(true);
    const root = scene.getObjectByName('UnitMissiles');
    expect(root, 'the pool should attach its missiles to the scene').toBeDefined();
    const missile = (root as THREE.Object3D).children[0];
    return track(
      missile,
      () => {
        env.playerPosition.x += 45 * DT;
        pool.update(DT, env);
      },
      4
    );
  }

  it('the comparison is meaningful: the same change does alter the player missile', () => {
    const normal = playerMissileTrack();
    const changed = withPlayerMissileTuning(OUTLANDISH, playerMissileTrack);

    expect(changed).not.toEqual(normal);
    // 改完以后恢复原样
    expect(playerMissileTrack()).toEqual(normal);
  });

  it('a boss missile flies the same path whatever the player missile tuning', () => {
    const normal = bossMissileTrack();
    const changed = withPlayerMissileTuning(OUTLANDISH, () => bossMissileTrack());

    expect(changed).toEqual(normal);
  });

  it('a fast tracking boss missile flies the same path whatever the player missile tuning', () => {
    const profile: BossMissileFlightProfile = { speed: 120, turnRate: 1.6, lead: 0.6, lifetime: 9 };
    const normal = bossMissileTrack(profile);
    const changed = withPlayerMissileTuning(OUTLANDISH, () => bossMissileTrack(profile));

    expect(changed).toEqual(normal);
  });

  it('a boss missile is still a slow one: nowhere near the player missile’s speed', () => {
    const samples = bossMissileTrack();
    let fastest = 0;
    for (let i = 3; i < samples.length; i += 3) {
      const step = Math.hypot(
        samples[i] - samples[i - 3],
        samples[i + 1] - samples[i - 2],
        samples[i + 2] - samples[i - 1]
      );
      fastest = Math.max(fastest, step / DT);
    }

    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThan(80);
  });

  it('a unit missile flies the same path whatever the player missile tuning', () => {
    const normal = unitMissileTrack();
    const changed = withPlayerMissileTuning(OUTLANDISH, unitMissileTrack);

    expect(changed).toEqual(normal);
  });

  it('a unit missile never exceeds the top speed it was launched with', () => {
    const samples = unitMissileTrack();
    let fastest = 0;
    for (let i = 3; i < samples.length; i += 3) {
      const step = Math.hypot(
        samples[i] - samples[i - 3],
        samples[i + 1] - samples[i - 2],
        samples[i + 2] - samples[i - 1]
      );
      fastest = Math.max(fastest, step / DT);
    }

    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThanOrEqual(95 + 1e-6);
  });
});
