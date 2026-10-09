import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, GameEventType } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';

vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: vi.fn().mockImplementation((aircraft: THREE.Group) => ({
    getPosition: () => aircraft.position.clone(),
    getQuaternion: () => aircraft.quaternion.clone(),
    getSpeed: () => 0,
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

/**
 * 坠毁后的复活规则（PlayerSystem，终验修复 F1）：
 * - 复活点取自最近的航迹：坠毁前至少约 3 秒、且离坠毁点水平至少 150 米的安全点；
 *   航迹太短（刚 placeAt）时有兜底，仍在来路一侧、离坠毁点足够远；
 * - 复活净空探测从 0 米开始（前方 10-40 米的细柱也能发现），在 8 个航向里挑一个通畅的，
 *   或爬升到障碍之上；
 * - 复活后 3 秒坠毁宽限：触地被抬起而不是坠毁；宽限过后触地照常坠毁；一次坠毁只扣一条命；
 * - 护盾道具不防撞地；placeAt 重置航迹与宽限。
 * 地形用桩采样器（setCrashSurfaceSampler）：平地 + 细柱 / 环形高地。飞行由测试逐步移动机体。
 */

type Sampler = (x: number, z: number) => number;

const DT = 0.05;
/** 复活延迟（2 秒）之后的一步 */
const RESPAWN_WAIT = 2.1;
const GROUND = 0;
const CRUISE_Y = 100;
const UP = new THREE.Vector3(0, 1, 0);
const flat: Sampler = () => GROUND;

interface Rig {
  system: PlayerSystem;
  mesh: THREE.Group;
  sampler: { current: Sampler };
}

/** 航向角（绕 Y，机头 -Z 为 0）：前向 = (-sin h, 0, -cos h) */
function headingOf(quaternion: THREE.Quaternion): number {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
  return Math.atan2(-forward.x, -forward.z);
}

function forwardOf(heading: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
}

/** 两个航向之差，归一到 (-π, π] */
function angleBetween(a: number, b: number): number {
  let diff = (a - b) % (Math.PI * 2);
  if (diff <= -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function horizontalDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe('PlayerSystem respawn safety', () => {
  let scene: THREE.Scene;
  let deaths: number[];
  let respawns: THREE.Vector3[];

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    deaths = [];
    respawns = [];
    EventBus.on(GameEventType.PLAYER_DEATH, (event) => {
      deaths.push(event.payload.lives);
    });
    EventBus.on(GameEventType.PLAYER_RESPAWN, (event) => {
      respawns.push(event.payload.position.clone());
    });
  });

  function createRig(
    start = new THREE.Vector3(0, CRUISE_Y, 0),
    heading = 0,
    sampler: Sampler = flat
  ): Rig {
    const mesh = new THREE.Group();
    const system = new PlayerSystem(scene, mesh, new PlayerStats());
    system.init();
    const holder = { current: sampler };
    system.setCrashSurfaceSampler((x, z) => holder.current(x, z));
    system.placeAt(start, new THREE.Quaternion().setFromAxisAngle(UP, heading));
    return { system, mesh, sampler: holder };
  }

  /** 沿机头水平方向匀速直飞 seconds 秒（每步先移动再 update） */
  function fly(rig: Rig, seconds: number, speed: number): void {
    const heading = headingOf(rig.mesh.quaternion);
    const forward = forwardOf(heading);
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += DT) {
      rig.mesh.position.addScaledVector(forward, speed * DT);
      rig.system.update(DT);
    }
  }

  /** 原地保持（只推进时钟）seconds 秒 */
  function hold(rig: Rig, seconds: number): void {
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += DT) {
      rig.system.update(DT);
    }
  }

  /** 俯冲触地：沉到当前 XZ 的表面以下，走一步 */
  function diveIntoSurface(rig: Rig): THREE.Vector3 {
    const { x, z } = rig.mesh.position;
    rig.mesh.position.y = rig.sampler.current(x, z) - 1;
    const crash = rig.mesh.position.clone();
    rig.system.update(DT);
    return crash;
  }

  function waitForRespawn(rig: Rig): void {
    expect(rig.system.isPlayerRespawning(), 'waiting to respawn').toBe(true);
    rig.system.update(RESPAWN_WAIT);
    expect(rig.system.isPlayerRespawning(), 'respawned').toBe(false);
  }

  /** 直飞一段：机体中线 ±5 米的地表都低于飞行高度 */
  function straightPathIsClear(
    sampler: Sampler,
    from: THREE.Vector3,
    heading: number,
    length: number
  ): boolean {
    const forward = forwardOf(heading);
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    for (let distance = 0; distance <= length; distance += 1) {
      for (const lane of [-5, 0, 5]) {
        const x = from.x + forward.x * distance + right.x * lane;
        const z = from.z + forward.z * distance + right.z * lane;
        if (sampler(x, z) >= from.y) return false;
      }
    }
    return true;
  }

  describe('respawn point on the recent track', () => {
    it('fast flight: respawns on the track at least ~3 s and 150 m before the crash', () => {
      const speed = 80;
      const rig = createRig();
      fly(rig, 10, speed);
      const crash = diveIntoSurface(rig);
      waitForRespawn(rig);

      const point = rig.mesh.position;
      expect(Math.abs(point.x), 'on the flown line').toBeLessThan(1);
      expect(point.z, 'behind the crash, the way the jet came').toBeGreaterThan(crash.z);
      expect(point.z, 'within the flown track').toBeLessThanOrEqual(0);
      expect(horizontalDistance(point, crash)).toBeGreaterThanOrEqual(150);
      const secondsBack = (point.z - crash.z) / speed;
      expect(secondsBack, 'at least ~3 s before the crash').toBeGreaterThanOrEqual(2.9);
      expect(secondsBack, 'a recent point, not the start of the track').toBeLessThanOrEqual(6);
      expect(point.y).toBeGreaterThan(GROUND + 10);
      expect(respawns).toHaveLength(1);
    });

    it('slow flight: the 150 m distance decides, still at least 3 s back', () => {
      const speed = 30;
      const rig = createRig();
      fly(rig, 20, speed);
      const crash = diveIntoSurface(rig);
      waitForRespawn(rig);

      const point = rig.mesh.position;
      expect(Math.abs(point.x)).toBeLessThan(1);
      expect(point.z).toBeGreaterThan(crash.z);
      expect(horizontalDistance(point, crash)).toBeGreaterThanOrEqual(150);
      const secondsBack = (point.z - crash.z) / speed;
      expect(secondsBack).toBeGreaterThanOrEqual(3);
      expect(secondsBack, 'a recent point, not the start of the track').toBeLessThanOrEqual(8);
    });

    it('levels the wings and keeps the track heading when the way ahead is clear', () => {
      const rig = createRig();
      fly(rig, 10, 80);
      // 俯冲坠毁：机头朝下
      rig.mesh.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.2)
      );
      diveIntoSurface(rig);
      waitForRespawn(rig);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.mesh.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.mesh.quaternion);
      expect(Math.abs(forward.y), 'nose level').toBeLessThan(1e-6);
      expect(up.y, 'wings level').toBeGreaterThan(1 - 1e-6);
      expect(Math.abs(angleBetween(headingOf(rig.mesh.quaternion), 0))).toBeLessThan(0.02);
    });

    it('short track right after placeAt: falls back to a point back the way the jet came', () => {
      const speed = 80;
      const rig = createRig();
      fly(rig, 1, speed);
      const crash = diveIntoSurface(rig);
      waitForRespawn(rig);

      const point = rig.mesh.position;
      for (const value of [point.x, point.y, point.z]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(Math.abs(point.x)).toBeLessThan(1);
      expect(point.z, 'back the way the jet came').toBeGreaterThan(crash.z);
      expect(horizontalDistance(point, crash)).toBeGreaterThanOrEqual(149);
      expect(point.y).toBeGreaterThan(GROUND + 10);
    });
  });

  describe('respawn clearance probe', () => {
    /** 平地航线：飞 10 秒后坠毁，记下（平地时的）复活点与航向 */
    function referenceRespawn(): { point: THREE.Vector3; heading: number } {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      waitForRespawn(rig);
      return { point: rig.mesh.position.clone(), heading: headingOf(rig.mesh.quaternion) };
    }

    /** 同一航线，坠毁后（复活之前）地形换成 sampler */
    function respawnWith(sampler: Sampler): Rig {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      rig.sampler.current = sampler;
      waitForRespawn(rig);
      return rig;
    }

    it.each([10, 25, 40])(
      'detects a narrow column %i m ahead and turns onto one of the 8 headings that is clear',
      (distanceAhead) => {
        const reference = referenceRespawn();
        const center = reference.point
          .clone()
          .addScaledVector(forwardOf(reference.heading), distanceAhead);
        // 6 米见方、600 米高（高于软顶界，爬不过去）的细柱
        const column: Sampler = (x, z) =>
          Math.abs(x - center.x) <= 3 && Math.abs(z - center.z) <= 3 ? 600 : GROUND;
        expect(straightPathIsClear(column, reference.point, reference.heading, 300)).toBe(false);

        const rig = respawnWith(column);
        const point = rig.mesh.position;
        const heading = headingOf(rig.mesh.quaternion);
        expect(horizontalDistance(point, reference.point)).toBeLessThan(1);

        const turn = angleBetween(heading, reference.heading);
        expect(Math.abs(turn), 'turned away from the column').toBeGreaterThan(0.1);
        const steps = turn / (Math.PI / 4);
        expect(Math.abs(steps - Math.round(steps)), 'one of the 8 compass headings').toBeLessThan(
          0.01
        );
        expect(straightPathIsClear(column, point, heading, 300), 'clear way ahead').toBe(true);
      }
    );

    it('climbs above the obstacle when every heading is blocked', () => {
      const reference = referenceRespawn();
      const ringTop = 150;
      // 复活点周围 20-600 米一圈 150 米高的台地：8 个航向全部受阻，但可以爬升越过
      const ring: Sampler = (x, z) => {
        const r = Math.hypot(x - reference.point.x, z - reference.point.z);
        return r >= 20 && r <= 600 ? ringTop : GROUND;
      };
      expect(reference.point.y).toBeLessThan(ringTop);

      const rig = respawnWith(ring);
      const point = rig.mesh.position;
      expect(point.y, 'above the obstacle').toBeGreaterThan(ringTop);
      expect(straightPathIsClear(ring, point, headingOf(rig.mesh.quaternion), 300)).toBe(true);
    });

    it('a crash into a column costs one life: flying on from the respawn does not crash again', () => {
      const reference = referenceRespawn();
      deaths.length = 0;
      const center = reference.point.clone().addScaledVector(forwardOf(reference.heading), 25);
      const column: Sampler = (x, z) =>
        Math.abs(x - center.x) <= 3 && Math.abs(z - center.z) <= 3 ? 600 : GROUND;

      const rig = respawnWith(column);
      expect(deaths).toEqual([2]);
      fly(rig, 6, 80);
      expect(deaths, 'no second crash').toEqual([2]);
      expect(rig.system.getLives()).toBe(2);
    });
  });

  describe('crash grace after respawn', () => {
    function crashedAndRespawned(): Rig {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      waitForRespawn(rig);
      expect(rig.system.getLives()).toBe(2);
      return rig;
    }

    it.each([0.5, 1.5, 2.5])(
      'surface contact %s s after the respawn lifts the jet instead of killing it',
      (seconds) => {
        const rig = crashedAndRespawned();
        hold(rig, seconds);
        rig.mesh.position.y = GROUND - 5;
        rig.system.update(DT);

        expect(rig.system.isPlayerRespawning()).toBe(false);
        expect(rig.mesh.position.y, 'lifted above the surface').toBeGreaterThan(GROUND);
        expect(rig.system.getLives()).toBe(2);
        expect(deaths).toEqual([2]);
      }
    );

    it('surface contact after the grace kills as usual', () => {
      const rig = crashedAndRespawned();
      hold(rig, 3.5);
      rig.mesh.position.y = GROUND - 5;
      rig.system.update(DT);

      expect(rig.system.isPlayerRespawning()).toBe(true);
      expect(rig.system.getLives()).toBe(1);
      expect(deaths).toEqual([2, 1]);
    });

    it('one crash costs exactly one life, even when the jet keeps touching the surface', () => {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      // 等待复活期间反复触地……
      for (let elapsed = 0; rig.system.isPlayerRespawning() && elapsed < 5; elapsed += DT) {
        rig.mesh.position.y = GROUND - 1;
        rig.system.update(DT);
      }
      expect(rig.system.isPlayerRespawning()).toBe(false);
      // ……复活后的宽限期内（3 秒以内）也一直触地
      for (let elapsed = 0; elapsed < 2.5; elapsed += DT) {
        rig.mesh.position.y = GROUND - 1;
        rig.system.update(DT);
      }

      expect(deaths).toEqual([2]);
      expect(rig.system.getLives()).toBe(2);
      expect(respawns).toHaveLength(1);
    });
  });

  it('the SHIELD power-up does not protect against the terrain', () => {
    const rig = createRig();
    fly(rig, 2, 80);
    rig.system.activateShield(scene);
    expect(rig.system.isShieldActive()).toBe(true);

    diveIntoSurface(rig);
    expect(rig.system.isPlayerRespawning()).toBe(true);
    expect(rig.system.getLives()).toBe(2);
    expect(deaths).toEqual([2]);
  });

  describe('placeAt', () => {
    it('resets the track: a crash soon after respawns near the new place, not the old track', () => {
      const rig = createRig();
      fly(rig, 10, 80);
      const placed = new THREE.Vector3(600, 120, 600);
      rig.system.placeAt(placed, new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2));
      fly(rig, 1, 80);
      const crash = diveIntoSurface(rig);
      waitForRespawn(rig);

      const point = rig.mesh.position;
      expect(horizontalDistance(point, placed), 'near the placed point').toBeLessThan(200);
      expect(Math.abs(point.x), 'not back on the old track (x = 0)').toBeGreaterThan(300);
      expect(horizontalDistance(point, crash)).toBeGreaterThanOrEqual(149);
    });

    it('resets the crash grace: contact right after a placeAt kills', () => {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      waitForRespawn(rig);
      expect(rig.system.getLives()).toBe(2);

      // 宽限期内换关 / 读档
      rig.system.placeAt(
        new THREE.Vector3(-300, CRUISE_Y, 200),
        new THREE.Quaternion().setFromAxisAngle(UP, 0)
      );
      hold(rig, 0.2);
      rig.mesh.position.y = GROUND - 5;
      rig.system.update(DT);

      expect(rig.system.isPlayerRespawning()).toBe(true);
      expect(rig.system.getLives()).toBe(1);
    });
  });

  describe('polish batch P', () => {
    /** 平地航线：飞 10 秒后坠毁，记下（平地时的）复活点与航向 */
    function referenceRespawn(): { point: THREE.Vector3; heading: number } {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      waitForRespawn(rig);
      return { point: rig.mesh.position.clone(), heading: headingOf(rig.mesh.quaternion) };
    }

    function respawnWith(sampler: Sampler): Rig {
      const rig = createRig();
      fly(rig, 10, 80);
      diveIntoSurface(rig);
      rig.sampler.current = sampler;
      waitForRespawn(rig);
      return rig;
    }

    /** 航线两侧 halfWidth 米内（每米一条线）直飞 length 米都低于飞行高度 */
    function swathIsClear(
      sampler: Sampler,
      from: THREE.Vector3,
      heading: number,
      length: number,
      halfWidth: number
    ): boolean {
      const forward = forwardOf(heading);
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      for (let distance = 0; distance <= length; distance += 1) {
        for (let lane = -halfWidth; lane <= halfWidth; lane += 1) {
          const x = from.x + forward.x * distance + right.x * lane;
          const z = from.z + forward.z * distance + right.z * lane;
          if (sampler(x, z) >= from.y) return false;
        }
      }
      return true;
    }

    describe('the clearance probe covers ±24 m of the heading', () => {
      it.each([
        [15, 60],
        [15, 200],
        [-15, 200],
        [-15, 390],
      ])(
        'an 8 m-wide column %s m off the centre line, %s m ahead, rejects that heading',
        (offset, ahead) => {
          const reference = referenceRespawn();
          const forward = forwardOf(reference.heading);
          const right = new THREE.Vector3(-forward.z, 0, forward.x);
          const center = reference.point
            .clone()
            .addScaledVector(forward, ahead)
            .addScaledVector(right, offset);
          // 8 米见方、600 米高（爬不过去）的立柱，中心离航线 15 米
          const column: Sampler = (x, z) =>
            Math.abs(x - center.x) <= 4 && Math.abs(z - center.z) <= 4 ? 600 : GROUND;
          // 航线本身擦着立柱过（机体中线不撞），但留不出转弯余量
          expect(straightPathIsClear(column, reference.point, reference.heading, 400)).toBe(true);
          expect(swathIsClear(column, reference.point, reference.heading, 400, 20)).toBe(false);

          const rig = respawnWith(column);
          const heading = headingOf(rig.mesh.quaternion);
          expect(
            Math.abs(angleBetween(heading, reference.heading)),
            'the original heading is rejected'
          ).toBeGreaterThan(0.1);
          expect(swathIsClear(column, rig.mesh.position, heading, 400, 20)).toBe(true);
        }
      );
    });

    describe('a crash soon after a respawn', () => {
      function crashAgainAfter(seconds: number): {
        respawn: THREE.Vector3;
        heading: number;
        crash: THREE.Vector3;
      } {
        const rig = createRig();
        fly(rig, 10, 80);
        diveIntoSurface(rig);
        waitForRespawn(rig);
        fly(rig, seconds, 80);
        const crash = diveIntoSurface(rig);
        waitForRespawn(rig);
        return {
          respawn: rig.mesh.position.clone(),
          heading: headingOf(rig.mesh.quaternion),
          crash,
        };
      }

      it('within 8 s: the next respawn faces away from the crash', () => {
        const { respawn, heading, crash } = crashAgainAfter(4);
        const away = respawn.clone().sub(crash).setY(0).normalize();
        expect(forwardOf(heading).dot(away)).toBeGreaterThan(0.9);
      });

      it('later than 8 s: the respawn keeps flying the track toward the crash site', () => {
        const { respawn, heading, crash } = crashAgainAfter(12);
        const toward = crash.clone().sub(respawn).setY(0).normalize();
        expect(forwardOf(heading).dot(toward)).toBeGreaterThan(0.9);
      });
    });

    describe('grace-period contact with a vertical wall', () => {
      /** 复活后宽限期内，正前方 20 米处立起一面 500 米高的崖壁 */
      function respawnFacingWall(): { rig: Rig; wallZ: number; start: THREE.Vector3 } {
        const rig = createRig();
        fly(rig, 10, 80);
        diveIntoSurface(rig);
        waitForRespawn(rig);
        const start = rig.mesh.position.clone();
        // 航向 0：机头朝 -Z，崖壁在 z < wallZ 一侧
        expect(Math.abs(angleBetween(headingOf(rig.mesh.quaternion), 0))).toBeLessThan(0.05);
        const wallZ = start.z - 20;
        rig.sampler.current = (_x, z) => (z < wallZ ? 500 : GROUND);
        return { rig, wallZ, start };
      }

      it('pushes the jet out horizontally and turns it away instead of lifting it up the wall', () => {
        const { rig, wallZ, start } = respawnFacingWall();
        hold(rig, 0.5);
        rig.mesh.position.set(start.x, start.y, wallZ - 1);
        rig.system.update(DT);

        expect(rig.system.isPlayerRespawning(), 'no crash in the grace').toBe(false);
        expect(deaths).toEqual([2]);
        const position = rig.mesh.position;
        expect(position.y, 'not lifted up the wall').toBeLessThan(start.y + 1);
        expect(position.y).toBeGreaterThan(start.y - 1);
        expect(position.z, 'pushed out of the wall').toBeGreaterThan(wallZ);
        expect(rig.sampler.current(position.x, position.z)).toBeLessThan(position.y);
        const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.mesh.quaternion);
        expect(nose.z, 'turned away from the wall (+Z is out)').toBeGreaterThan(0);
        expect(Math.abs(nose.y), 'level').toBeLessThan(1e-6);
      });

      it('a glancing contact keeps the jet flying along or away from the wall', () => {
        const { rig, wallZ, start } = respawnFacingWall();
        // 机头斜着撞向崖壁（右前方 45°）
        rig.mesh.quaternion.setFromAxisAngle(UP, -Math.PI / 4);
        rig.mesh.position.set(start.x, start.y, wallZ - 0.5);
        rig.system.update(DT);

        expect(rig.system.isPlayerRespawning()).toBe(false);
        expect(rig.mesh.position.z).toBeGreaterThan(wallZ);
        const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.mesh.quaternion);
        expect(nose.z, 'no longer heading into the wall').toBeGreaterThanOrEqual(0);
        expect(nose.x, 'keeps its sideways motion').toBeGreaterThan(0);
      });

      it('outside the grace the wall still kills', () => {
        const { rig, wallZ, start } = respawnFacingWall();
        hold(rig, 3.5);
        rig.mesh.position.set(start.x, start.y, wallZ - 1);
        rig.system.update(DT);

        expect(rig.system.isPlayerRespawning()).toBe(true);
        expect(rig.system.getLives()).toBe(1);
      });
    });
  });
});
