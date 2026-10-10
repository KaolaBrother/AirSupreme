import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  SIM_TEST_TIMEOUT,
  SPEC,
  TurnTracker,
  angleBetween,
  breathe,
  chasePilot,
  groupBursts,
  horizontal,
  pitchOf,
  pointAround,
  type RigShot,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 王牌（ACE，决斗者）的机炮与机动打法，规格 §3：
 * 数值更好的战斗机追击（最快的机型）；玩家咬住它的机尾时做反转（“剪刀”机动）；规避时带加速。
 * 它的寻的导弹（里程碑 2）不在这里验：测试台照游戏里那样接了导弹发射通道，王牌会正常飞导弹
 * 航路，这里只看机炮与机动这一半。
 */

let rig: FleetRig | null = null;

function makeRig(options: ConstructorParameters<typeof FleetRig>[0] = {}): FleetRig {
  rig?.dispose();
  rig = new FleetRig(options);
  return rig;
}

afterEach(() => {
  rig?.dispose();
  rig = null;
});

function asternAngle(current: FleetRig, jet: EnemyAI): number {
  const offset = jet.getMesh().position.clone().sub(current.player.position);
  return angleBetween(offset, current.player.forward.clone().negate());
}

function offNose(shot: RigShot): number {
  return angleBetween(shot.jetForward, shot.playerPosition.clone().sub(shot.origin)) / DEG;
}

describe('ACE: Fighter pursuit with better numbers (spec §3)', () => {
  it('is the fastest jet and out-classes the Fighter in health, speed, turn and firepower', () => {
    const ace = ENEMY_CONFIGS[EnemyType.ACE];
    const fighter = ENEMY_CONFIGS[EnemyType.FIGHTER];
    for (const type of Object.values(EnemyType)) {
      if (type === EnemyType.ACE) continue;
      expect(ace.speed, `faster than ${type}`).toBeGreaterThan(ENEMY_CONFIGS[type].speed);
    }
    expect(ace.health).toBeGreaterThan(fighter.health);
    expect(ace.turnSpeed).toBeGreaterThan(fighter.turnSpeed);
    expect(ace.damage).toBeGreaterThan(fighter.damage);
  });

  it.each([30, -60, 150])(
    'starting %s degrees off the nose it gets behind a straight-flying player and stays in the rear hemisphere',
    (offset) => {
      const current = makeRig({ capacity: 2, seed: 191 });
      const jet = current.addJet(EnemyType.ACE, pointAround(current.player, 450, offset * DEG));
      expect(
        current.runUntil(
          () => asternAngle(current, jet) < 60 * DEG && current.distanceTo(jet) < 300,
          30
        ),
        'reached the rear hemisphere'
      ).toBe(true);
      current.run(3);
      let steps = 0;
      let behind = 0;
      current.run(45, () => {
        steps++;
        if (asternAngle(current, jet) < 90 * DEG) behind++;
      });
      expect(behind / steps, 'share of time in the rear hemisphere').toBeGreaterThan(0.9);
      expect(current.shots.length, 'it shoots from there').toBeGreaterThan(10);
    }
  );

  it('fires gun bursts that open inside a tight cone, far tighter than the old 45 degrees', async () => {
    const opening: number[] = [];
    const sizes: number[] = [];
    for (const seed of [192, 193]) {
      for (const yaw of [0, 0.4, 0.8]) {
        const current = makeRig({ capacity: 2, seed });
        current.addJet(EnemyType.ACE, pointAround(current.player, 450, -120 * DEG));
        current.pilot = (active) =>
          active.turnPlayer((Math.floor(active.time / 4) % 2 === 0 ? yaw : -yaw) * DT);
        current.run(80);
        for (const burst of groupBursts(current.shots, 0.5)) {
          opening.push(offNose(burst[0]));
          sizes.push(burst.length);
        }
        for (const shot of current.shots) expect(shot.weapon).toBe('bullet');
      }
      await breathe();
    }
    expect(opening.length, 'bursts seen').toBeGreaterThan(60);
    // 规格 §3a：锥角在点射的第一发上检查，王牌不超过 15°
    expect(
      Math.max(...opening),
      'widest angle at which a burst opened (degrees)'
    ).toBeLessThanOrEqual(15);
    // 点射：每次不止一发，长度固定（偶尔被打断）
    const full = Math.max(...sizes);
    expect(full).toBeGreaterThanOrEqual(4);
    expect(sizes.filter((size) => size === full).length / sizes.length).toBeGreaterThan(0.8);
  });

  it('a player flying straight at it gets one burst on the way in and a pass, like the Fighter', () => {
    const current = makeRig({ capacity: 2, seed: 194 });
    const jet = current.addJet(EnemyType.ACE, pointAround(current.player, 500, 0));
    let closest = Infinity;
    let merged = false;
    current.run(15, () => {
      const distance = current.distanceTo(jet);
      if (distance < closest) {
        closest = distance;
        return false;
      }
      merged = closest < 120;
      return merged;
    });
    expect(merged, 'the two passed each other').toBe(true);
    expect(groupBursts(current.shots, 0.5).length, 'bursts on the way in').toBe(1);
    const shotsAtMerge = current.shots.length;
    current.run(1.5);
    expect(current.shots.length, 'rounds fired right after the pass').toBe(shotsAtMerge);
  });
});

describe('ACE scissors: a reversal when the player is on its tail (spec §3)', () => {
  /**
   * 玩家从正后方 160 米咬住它，以 turnRate 弧度/秒追着转。返回它的转向记录，以及玩家
   * 实际待在它机尾（40° 以内、300 米以内）的时间占比。
   */
  function tailed(
    type: EnemyType,
    turnRate: number,
    seed: number
  ): { turns: TurnTracker; onTail: number } {
    const base = ENEMY_CONFIGS[type].speed;
    const current = makeRig({ capacity: 2, seed, playerSpeed: base });
    const jet = current.addJet(type, pointAround(current.player, 160, 0), {
      heading: new THREE.Vector3(0, 0, 1),
    });
    current.pilot = chasePilot(jet, turnRate);
    const turns = new TurnTracker();
    let steps = 0;
    let onTail = 0;
    current.run(20, () => {
      turns.feed(current.time, jet.velocity);
      steps++;
      const offset = current.player.position.clone().sub(jet.getMesh().position);
      if (angleBetween(offset, jet.velocity.clone().negate()) < 40 * DEG && offset.length() < 300) {
        onTail++;
      }
    });
    return { turns, onTail: onTail / steps };
  }

  it.each([
    [0.8, 201],
    [1.4, 201],
    [2.2, 201],
    [1.4, 202],
  ])(
    'player chasing at %s rad/s (seed %s): it throws hard reversals, turn then counter-turn',
    (turnRate, seed) => {
      const { turns, onTail } = tailed(EnemyType.ACE, turnRate, seed);
      expect(onTail, 'the player really was on its tail for part of the time').toBeGreaterThan(0.2);
      // 剪刀：一次至少 60° 的急转紧接着一次至少 60° 的反向急转
      expect(turns.hardReversals(60 * DEG), 'hard reversals in 20 s').toBeGreaterThanOrEqual(2);
    }
  );

  it.each([0.8, 1.4, 2.2])(
    'a Fighter in the same spot (player chasing at %s rad/s) has no such move',
    (turnRate) => {
      const { turns, onTail } = tailed(EnemyType.FIGHTER, turnRate, 201);
      expect(onTail).toBeGreaterThan(0.2);
      expect(turns.hardReversals(60 * DEG)).toBe(0);
    }
  );

  it('the reversal answers a chase: an Ace nobody is chasing reverses far less often', async () => {
    // 被追：四种追法各 20 秒
    let chased = 0;
    for (const [turnRate, seed] of [
      [0.8, 201],
      [1.4, 201],
      [2.2, 201],
      [1.4, 202],
    ]) {
      chased += tailed(EnemyType.ACE, turnRate, seed).turns.hardReversals(60 * DEG);
    }
    const chasedRate = chased / (4 * 20);
    await breathe();

    // 没人追：玩家直飞或匀速转弯，从不把机头转向它；它自己去绕玩家的后方（各 40 秒）
    let free = 0;
    let runs = 0;
    for (const yaw of [0, 0.3, -0.3]) {
      for (const start of [150, 60, -100]) {
        const current = makeRig({ capacity: 2, seed: 203 });
        const jet = current.addJet(EnemyType.ACE, pointAround(current.player, 450, start * DEG));
        current.pilot = (active) => active.turnPlayer(yaw * DT);
        const turns = new TurnTracker();
        current.run(40, () => turns.feed(current.time, jet.velocity));
        free += turns.hardReversals(60 * DEG);
        runs++;
      }
      await breathe();
    }
    const freeRate = free / (runs * 40);

    expect(chasedRate, 'hard reversals per second while chased').toBeGreaterThan(0.15);
    expect(chasedRate, 'chased vs not chased').toBeGreaterThan(freeRate * 4);
  });

  it('it comes out of the scissors still flying: finite position, speed inside the throttle range', () => {
    const base = ENEMY_CONFIGS[EnemyType.ACE].speed;
    const current = makeRig({ capacity: 2, seed: 204, playerSpeed: base });
    const jet = current.addJet(EnemyType.ACE, pointAround(current.player, 160, 0), {
      heading: new THREE.Vector3(0, 0, 1),
    });
    current.pilot = chasePilot(jet, 1.4);
    let slowest = Infinity;
    let fastest = 0;
    current.run(30, () => {
      const ratio = jet.velocity.length() / base;
      slowest = Math.min(slowest, ratio);
      fastest = Math.max(fastest, ratio);
    });
    expect(slowest).toBeGreaterThanOrEqual(SPEC.MIN_THROTTLE - 0.005);
    expect(fastest).toBeLessThanOrEqual(SPEC.MAX_THROTTLE + 0.005);
    expect(Number.isFinite(jet.getMesh().position.lengthSq())).toBe(true);
  });
});

describe('ACE break: the Fighter break with a speed boost (spec §3)', () => {
  /** 等它机头对着玩家再锁定；返回锁定后 0.75–3 秒内的最低速度（基础速度的倍数）与规避姿态 */
  function breakAway(
    type: EnemyType,
    threat: 'lock' | 'missile',
    seed: number
  ): { slowest: number; across: number; pitch: number; shots: number } {
    const current = makeRig({ capacity: 2, seed });
    const jet = current.addJet(type, pointAround(current.player, 450, 30 * DEG));
    const noseOn = current.runUntil(() => {
      const toPlayer = current.player.position.clone().sub(jet.getMesh().position);
      return current.time > 3 && angleBetween(jet.velocity, toPlayer) < 8 * DEG;
    }, 30);
    expect(noseOn, `${type} was pointing at the player`).toBe(true);
    if (threat === 'lock') current.lockedJet = jet;
    else current.missileTargets.add(jet);
    const shotsBefore = current.shots.length;
    current.run(0.75);
    const toPlayer = horizontal(current.player.position.clone().sub(jet.getMesh().position));
    const across = angleBetween(horizontal(jet.velocity), toPlayer) / DEG;
    const pitch = Math.abs(pitchOf(jet.velocity)) / DEG;
    let slowest = Infinity;
    const base = jet.getConfig().speed;
    current.run(2.25, () => {
      slowest = Math.min(slowest, jet.velocity.length() / base);
    });
    return { slowest, across, pitch, shots: current.shots.length - shotsBefore };
  }

  it.each([
    ['lock', 211],
    ['lock', 212],
    ['missile', 211],
    ['missile', 212],
  ] as const)(
    'on a %s (seed %s) it breaks across the line of sight with a dive or climb, at boosted speed',
    (threat, seed) => {
      const ace = breakAway(EnemyType.ACE, threat, seed);
      expect(ace.across, 'angle off the line of sight after 0.75 s (degrees)').toBeGreaterThan(60);
      expect(ace.across).toBeLessThan(125);
      expect(ace.pitch, 'dive / climb angle (degrees)').toBeGreaterThan(15);
      expect(ace.shots, 'rounds fired while breaking').toBe(0);
      // 加速：整个规避都在 1.2 倍基础速度以上
      expect(ace.slowest, 'slowest speed during the break (x base)').toBeGreaterThan(1.2);
      expect(ace.slowest).toBeLessThanOrEqual(SPEC.MAX_THROTTLE + 0.005);

      // 战斗机的规避没有这个加速
      const fighter = breakAway(EnemyType.FIGHTER, threat, seed);
      expect(ace.slowest).toBeGreaterThan(fighter.slowest + 0.1);
    }
  );
});
