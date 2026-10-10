import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  SIM_TEST_TIMEOUT,
  TurnTracker,
  angleBetween,
  bearingGap,
  bearingOf,
  breathe,
  groupBursts,
  horizontal,
  pointAround,
  type RigShot,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 侦察机（SCOUT，袭扰机）的打法，规格 §3：
 * 从约 350 米冲向玩家将要到达的位置，三连发点射（发间 0.12 秒、点射间约 1.6 秒），约 120 米处
 * 以 60–90° 转弯加高度变化脱离，拉开到 300–400 米再回来；绝不咬尾；两架同时持令牌时从两侧对向
 * 进入；玩家机头指着它（约 6° 内、500 米内）时蛇形，被锁定 / 被导弹追时蛇形更狠并俯冲或爬升。
 *
 * 全部用真实的 EnemyAI + 条令 + 导演按 60 Hz 推进，窗口按距离 / 航向这些看得见的量来划，
 * 不依赖条令内部的阶段名。
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

/** 从玩家前方象限进入的四个起点（方位偏角，度）：玩家机头不指着它，第一次冲刺不会被蛇形打乱 */
const FRONT_QUARTER = [-45, -25, 25, 45];

describe('SCOUT: one base missile kills it (spec §3, pinned HP 60)', () => {
  it('has 60 HP in the type table', () => {
    expect(ENEMY_CONFIGS[EnemyType.SCOUT].health).toBe(60);
  });

  it('dies to a single player missile at base damage and survives anything less than its HP', () => {
    expect(GAME_CONSTANTS.MISSILE.DAMAGE).toBe(80);
    const current = makeRig();
    const first = current.addJet(EnemyType.SCOUT, pointAround(current.player, 400, 30 * DEG));
    first.takeDamage(GAME_CONSTANTS.MISSILE.DAMAGE);
    expect(first.isAlive()).toBe(false);

    const second = current.addJet(EnemyType.SCOUT, pointAround(current.player, 400, 60 * DEG));
    second.takeDamage(59);
    expect(second.isAlive()).toBe(true);
    second.takeDamage(1);
    expect(second.isAlive()).toBe(false);
  });
});

describe('SCOUT slash attack (spec §3)', () => {
  it.each(FRONT_QUARTER)(
    'from %s degrees off the nose: opens fire inside about 350 m and breaks before it gets close',
    (offset) => {
      const current = makeRig({ capacity: 2, seed: 61 });
      const jet = current.addJet(EnemyType.SCOUT, pointAround(current.player, 520, offset * DEG));
      // 第一次冲刺：到它飞进 125 米为止
      const reached = current.runUntil(() => current.distanceTo(jet) <= 125, 30);
      expect(reached, 'the run came in to about 120 m').toBe(true);
      expect(current.shots.length, 'fired on the way in').toBeGreaterThanOrEqual(3);
      const distances = current.shots.map((shot) => shot.distance);
      // “从约 350 米冲进来”：不会在更远处开火
      expect(Math.max(...distances)).toBeLessThanOrEqual(360);
      expect(
        Math.max(...distances),
        'the first burst is not held until point-blank'
      ).toBeGreaterThan(230);
      // 约 120 米脱离：冲刺途中没有贴脸射击
      expect(Math.min(...distances)).toBeGreaterThan(100);
    }
  );

  it('fires 3-round bursts, 0.12 s between rounds and about 1.6 s between bursts', async () => {
    const sizes: number[] = [];
    const inner: number[] = [];
    const between: number[] = [];
    for (const seed of [62, 63, 64]) {
      for (const yaw of [0.25, 0.5, -0.7]) {
        const current = makeRig({ capacity: 2, seed });
        current.addJet(EnemyType.SCOUT, pointAround(current.player, 450, 30 * DEG));
        current.pilot = (active) => active.turnPlayer(yaw * DT);
        current.run(60);
        const bursts = groupBursts(current.shots, 0.5);
        for (const [index, burst] of bursts.entries()) {
          sizes.push(burst.length);
          for (let i = 1; i < burst.length; i++) inner.push(burst[i].time - burst[i - 1].time);
          const next = bursts[index + 1];
          if (!next) continue;
          // 同一次冲刺里的下一个点射（隔得更久的是下一次冲刺）
          const gap = next[0].time - burst[burst.length - 1].time;
          if (gap < 3.5) between.push(gap);
        }
        for (const shot of current.shots) expect(shot.weapon).toBe('bullet');
      }
      await breathe();
    }
    expect(sizes.length, 'bursts seen').toBeGreaterThan(40);
    expect(Math.max(...sizes), 'longest burst').toBe(3);
    // 脱离会把点射打断，但绝大多数是完整的三发
    const full = sizes.filter((size) => size === 3).length;
    expect(full / sizes.length).toBeGreaterThan(0.85);
    for (const gap of inner) {
      expect(gap).toBeGreaterThanOrEqual(0.12 - DT - 1e-9);
      expect(gap).toBeLessThanOrEqual(0.12 + DT + 1e-9);
    }
    expect(between.length, 'second bursts within one run').toBeGreaterThan(10);
    for (const gap of between) {
      expect(gap).toBeGreaterThan(1.2);
      expect(gap).toBeLessThan(2.2);
    }
  });

  it.each(FRONT_QUARTER)(
    'from %s degrees: breaks at about 120 m with a 60-90 degree turn and a height change, extends to 300-400 m and comes back',
    (offset) => {
      const current = makeRig({ capacity: 2, seed: 65 });
      const jet = current.addJet(EnemyType.SCOUT, pointAround(current.player, 520, offset * DEG));

      // 到 140 米时还在直线冲刺
      expect(current.runUntil(() => current.distanceTo(jet) <= 140, 30)).toBe(true);
      const inbound = horizontal(jet.velocity);
      const toPlayer = current.player.position.clone().sub(jet.getMesh().position);
      expect(
        angleBetween(jet.velocity, toPlayer) / DEG,
        'still pointing at the player side of the sky at 140 m'
      ).toBeLessThan(60);

      // 约 120 米：开始脱离
      expect(current.runUntil(() => current.distanceTo(jet) <= 122, 5)).toBe(true);
      const atBreak = horizontal(jet.velocity);
      expect(
        angleBetween(inbound, atBreak) / DEG,
        'heading change between 140 m and 122 m'
      ).toBeLessThan(25);
      const height = jet.getMesh().position.y;

      current.run(1);
      const turned = angleBetween(atBreak, horizontal(jet.velocity)) / DEG;
      expect(turned, 'break turn after 1 s (degrees)').toBeGreaterThanOrEqual(55);
      expect(turned, 'break turn after 1 s (degrees)').toBeLessThanOrEqual(95);
      current.run(0.5);
      expect(
        Math.abs(jet.getMesh().position.y - height),
        'height change 1.5 s into the break (m)'
      ).toBeGreaterThan(10);

      // 拉开：距离一直涨到 300–400 米左右才回头
      let farthest = 0;
      let cameBack = false;
      current.run(25, () => {
        const distance = current.distanceTo(jet);
        if (distance > farthest) farthest = distance;
        else if (farthest > 250 && distance < farthest - 40) cameBack = true;
        return cameBack;
      });
      expect(cameBack, 'turned back toward the player').toBe(true);
      expect(farthest, 'how far it extended (m)').toBeGreaterThan(280);
      expect(farthest, 'how far it extended (m)').toBeLessThan(450);

      // 回来之后还会再打
      const shotsSoFar = current.shots.length;
      current.pilot = (active) => active.turnPlayer(0.4 * DT);
      expect(
        current.runUntil(() => current.shots.length > shotsSoFar, 40),
        'attacks again after coming back'
      ).toBe(true);
    }
  );

  /**
   * 咬尾（规格 §3a）：侦察机待在玩家身后 30° 锥内、250 米以内。返回最长的连续秒数。
   * “30° 锥”按本规格里机炮锥的用法理解：与正后方的夹角不超过 30°（更窄的 15° 读法只会更短）。
   */
  function longestTailChase(current: FleetRig, jet: EnemyAI, seconds: number): number {
    let streak = 0;
    let longest = 0;
    current.run(seconds, () => {
      const offset = jet.getMesh().position.clone().sub(current.player.position);
      const astern = angleBetween(offset, current.player.forward.clone().negate());
      const chasing = astern < 30 * DEG && offset.length() < 250;
      streak = chasing ? streak + DT : 0;
      longest = Math.max(longest, streak);
    });
    return longest;
  }

  it('against a turning player it never settles onto the tail', async () => {
    for (const seed of [66, 67, 68]) {
      for (const yaw of [0.3, 0.6, -0.9]) {
        const current = makeRig({ capacity: 2, seed });
        const jet = current.addJet(EnemyType.SCOUT, pointAround(current.player, 450, 30 * DEG));
        current.pilot = (active) => active.turnPlayer(yaw * DT);
        const longest = longestTailChase(current, jet, 90);
        expect(longest, `longest tail chase, seed ${seed}, turn ${yaw} rad/s`).toBeLessThanOrEqual(
          4
        );
        expect(current.shots.length, 'it did attack').toBeGreaterThan(10);
      }
      await breathe();
    }
  });

  // 规格 §3a 给“咬尾”定了量：身后 30° 锥内、250 米以内、连续不超过 4 秒。按这个定义，直飞的玩家
  // 也不会被咬尾——侦察机第二次进入起是在约 300 米外尾追（每次约 7 秒，追不上就放弃），在 250 米
  // 之外，不算。那段 300 米的尾追仍然存在，只是不在规则之内（已在报告里说明）。
  it.each([
    ['30 degrees off the nose', 30],
    ['abeam', 90],
    ['behind, 150 degrees off the nose', 150],
    ['dead astern', 180],
  ])(
    'against a player flying straight it never sits in a tail chase either (starting %s)',
    (_label, offset) => {
      for (const seed of [66, 67, 68]) {
        const current = makeRig({ capacity: 2, seed });
        const jet = current.addJet(EnemyType.SCOUT, pointAround(current.player, 450, offset * DEG));
        const longest = longestTailChase(current, jet, 60);
        expect(longest, `longest tail chase, seed ${seed}`).toBeLessThanOrEqual(4);
      }
    }
  );
});

describe('SCOUT pairs (spec §3)', () => {
  /** 两架侦察机、两枚令牌 */
  function pair(seed: number, yaw: number): { current: FleetRig; scouts: EnemyAI[] } {
    const current = makeRig({ capacity: 2, seed });
    const scouts = [
      current.addJet(EnemyType.SCOUT, pointAround(current.player, 400, 20 * DEG)),
      current.addJet(EnemyType.SCOUT, pointAround(current.player, 420, 40 * DEG)),
    ];
    current.pilot = (active) => active.turnPlayer(yaw * DT);
    return { current, scouts };
  }

  it('two Scouts holding tokens together are sent in on opposite bearings', async () => {
    let checked = 0;
    for (const seed of [71, 72, 73]) {
      for (const yaw of [0, 0.3, 0.6]) {
        const { current, scouts } = pair(seed, yaw);
        let worst = Math.PI;
        current.run(60, () => {
          if (!scouts.every((scout) => scout.hasAttackToken())) return;
          checked++;
          worst = Math.min(worst, bearingGap(scouts[0].orders.bearing, scouts[1].orders.bearing));
        });
        expect(worst / DEG, `closest assigned bearings, seed ${seed}, turn ${yaw}`).toBeGreaterThan(
          150
        );
      }
      await breathe();
    }
    expect(checked, 'steps with both Scouts holding tokens').toBeGreaterThan(1000);
  });

  // FINDING: spec §3a — "Scout pairs: when two Scouts hold tokens together, the second one's attack
  // run starts from a bearing more than 90° away from the first one's, as seen from the player; it
  // repositions to its assigned bearing before it turns in." The director does assign the pair
  // bearings 180 degrees apart (test above), but the second Scout does not fly to its side: after
  // about 5 s of positioning it runs in from wherever it happens to be. Reproduce:
  // FleetRig({ capacity: 2 }), two SCOUTs at 400 m / 20 degrees and 420 m / 40 degrees off the
  // nose, 90 s. Take each Scout's attack runs (bursts more than 2.5 s after its previous burst
  // open a new run) and pair runs of the two Scouts that open within 3 s of each other; the angle
  // between the two opening positions as seen from the player is 25 degrees (seed 6, straight),
  // 42 degrees (seed 5, turning 0.3 rad/s) and 89 degrees (seed 72, turning 0.3 rad/s).
  it.fails('their attack runs start from bearings more than 90 degrees apart', () => {
    let pairs = 0;
    const tooClose: string[] = [];
    for (const seed of [5, 6, 71, 72]) {
      for (const yaw of [0, 0.3, 0.6]) {
        const { current, scouts } = pair(seed, yaw);
        current.run(90);
        // 每架侦察机每次进入的第一发
        const openings: RigShot[] = [];
        for (const scout of scouts) {
          let last = -Infinity;
          for (const burst of groupBursts(
            current.shots.filter((shot) => shot.jet === scout),
            0.5
          )) {
            if (burst[0].time - last > 2.5) openings.push(burst[0]);
            last = burst[burst.length - 1].time;
          }
        }
        for (let i = 0; i < openings.length; i++) {
          for (let j = i + 1; j < openings.length; j++) {
            const first = openings[i];
            const second = openings[j];
            if (first.jet === second.jet || Math.abs(first.time - second.time) >= 3) continue;
            pairs++;
            const gap = bearingGap(
              bearingOf(first.playerPosition, first.origin),
              bearingOf(second.playerPosition, second.origin)
            );
            if (gap <= 90 * DEG) {
              tooClose.push(
                `seed ${seed}, turn ${yaw}, at ${first.time.toFixed(1)} s: ${(gap / DEG).toFixed(0)}°`
              );
            }
          }
        }
      }
    }
    expect(pairs, 'pairs of runs that opened together').toBeGreaterThan(5);
    expect(tooClose, 'pairs of runs that opened 90 degrees apart or less').toEqual([]);
  });
});

describe('SCOUT reaction to the player (spec §3)', () => {
  /**
   * 一架没有令牌的侦察机在悬停的玩家附近待命；玩家机头相对它偏 noseOff 度。
   * 返回它在 500 米以内 / 以外各自的转向记录。
   */
  function watch(
    noseOff: number,
    startDistance: number,
    seconds: number,
    threat: 'none' | 'lock' | 'missile' = 'none'
  ): { near: TurnTracker; far: TurnTracker; climbed: number; nearSeconds: number } {
    const current = makeRig({ capacity: 0, seed: 81, playerSpeed: 0.001 });
    const jet = current.addJet(EnemyType.SCOUT, pointAround(current.player, startDistance, 0), {
      heading: new THREE.Vector3(1, 0, 0),
    });
    current.pilot = (active) => {
      const toJet = horizontal(jet.getMesh().position.clone().sub(active.player.position));
      active.player.forward.copy(toJet.normalize());
      active.turnPlayer(noseOff * DEG);
    };
    if (threat === 'lock') current.lockedJet = jet;
    if (threat === 'missile') current.missileTargets.add(jet);
    const near = new TurnTracker();
    const far = new TurnTracker();
    const startHeight = jet.getMesh().position.y;
    let climbed = 0;
    let nearSeconds = 0;
    current.run(seconds, () => {
      // 头 1.5 秒是它从初始航向转过来
      if (current.time < 1.5) return;
      const distance = current.distanceTo(jet);
      if (distance < 480) {
        near.feed(current.time, jet.velocity);
        nearSeconds += DT;
      } else if (distance > 520) {
        far.feed(current.time, jet.velocity);
      }
      climbed = Math.max(climbed, Math.abs(jet.getMesh().position.y - startHeight));
    });
    return { near, far, climbed, nearSeconds };
  }

  it.each([0, 3])('weaves while the player nose is %s degrees off it inside 500 m', (noseOff) => {
    const { near, nearSeconds } = watch(noseOff, 420, 12);
    expect(nearSeconds).toBeGreaterThan(8);
    // 蛇形：左右来回换向，每一段至少转过 5°
    expect(near.reversals(5 * DEG), 'left-right reversals').toBeGreaterThanOrEqual(8);
  });

  it.each([12, 25, 90])('does not weave when the nose is %s degrees off it', (noseOff) => {
    const { near, nearSeconds } = watch(noseOff, 420, 12);
    expect(nearSeconds).toBeGreaterThan(8);
    expect(near.reversals(5 * DEG), 'left-right reversals').toBeLessThanOrEqual(3);
  });

  it('does not weave beyond 500 m even with the nose dead on it', () => {
    const { far, near } = watch(0, 880, 20);
    far.close();
    expect(far.legs.length, 'it was tracked beyond 500 m').toBeGreaterThan(0);
    expect(far.reversals(5 * DEG), 'reversals beyond 520 m').toBeLessThanOrEqual(1);
    // 同一趟飞进 500 米之后就开始蛇形
    expect(near.reversals(5 * DEG), 'reversals inside 480 m').toBeGreaterThanOrEqual(5);
  });

  it.each(['lock', 'missile'] as const)(
    'under a %s it jinks harder than the plain weave and dives or climbs',
    (threat) => {
      const calm = watch(0, 420, 8);
      const threatened = watch(0, 420, 8, threat);
      expect(threatened.near.total + threatened.far.total).toBeGreaterThan(calm.near.total * 1.5);
      expect(
        threatened.near.reversals(5 * DEG) + threatened.far.reversals(5 * DEG)
      ).toBeGreaterThanOrEqual(5);
      // 俯冲或爬升：8 秒里高度至少变了 60 米；平时的蛇形基本是水平的
      expect(threatened.climbed, 'height change under threat (m)').toBeGreaterThan(60);
      expect(threatened.climbed).toBeGreaterThan(calm.climbed * 2);
    }
  );

  it('reacts to a lock even when the player nose is pointing elsewhere', () => {
    const calm = watch(90, 420, 8);
    const locked = watch(90, 420, 8, 'lock');
    expect(locked.near.total + locked.far.total).toBeGreaterThan(
      (calm.near.total + calm.far.total) * 2
    );
    expect(locked.climbed).toBeGreaterThan(60);
  });
});
