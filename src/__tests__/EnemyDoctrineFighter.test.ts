import { afterEach, describe, expect, it } from 'vitest';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  angleBetween,
  breathe,
  chasePilot,
  groupBursts,
  horizontal,
  pitchOf,
  pointAround,
  shadowPilot,
  type RigShot,
} from './enemyFleetRig';

/**
 * 战斗机（FIGHTER，格斗机）的打法，规格 §3：
 * 绕到玩家后半球（身后 150–250 米）并守在那里；只有玩家落在约 12° 的窄锥里才打四连发点射；
 * 玩家转向它时对头掠过、只打一个点射、然后拉开；被锁定 / 被导弹追时垂直于来袭方向急转并俯冲
 * 或爬升。
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

/** 敌机相对玩家正后方的偏角（弧度）：0 = 正后方，π = 正前方 */
function asternAngle(current: FleetRig, jet: EnemyAI): number {
  const offset = jet.getMesh().position.clone().sub(current.player.position);
  return angleBetween(offset, current.player.forward.clone().negate());
}

/** 开火瞬间，玩家偏离敌机机头多少度 */
function offNose(shot: RigShot): number {
  return angleBetween(shot.jetForward, shot.playerPosition.clone().sub(shot.origin)) / DEG;
}

/** 推进到敌机第一次进入玩家后半球的守位区；返回是否到达 */
function arrive(current: FleetRig, jet: EnemyAI, maxSeconds: number): boolean {
  return current.runUntil(
    () => asternAngle(current, jet) < 60 * DEG && current.distanceTo(jet) < 270,
    maxSeconds
  );
}

describe('FIGHTER pursuit (spec §3)', () => {
  it.each([30, -60, 90, 150, -120])(
    'starting %s degrees off the nose it works round to 150-250 m behind a straight-flying player and holds there',
    (offset) => {
      const current = makeRig({ capacity: 2, seed: 91 });
      const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, offset * DEG));
      expect(arrive(current, jet, 30), 'reached the rear hemisphere').toBe(true);
      // 到位后留 3 秒收敛，再看 45 秒
      current.run(3);
      let steps = 0;
      let behind = 0;
      let inBand = 0;
      current.run(45, () => {
        steps++;
        if (asternAngle(current, jet) < 90 * DEG) behind++;
        const distance = current.distanceTo(jet);
        // 150–250 米，两头各留 20 米
        if (distance >= 130 && distance <= 270) inBand++;
      });
      expect(behind / steps, 'share of time in the rear hemisphere').toBeGreaterThan(0.97);
      expect(inBand / steps, 'share of time 150-250 m away').toBeGreaterThan(0.9);
      expect(current.shots.length, 'it shoots from there').toBeGreaterThan(8);
    }
  );

  it('against a gently turning player it still lives in the rear hemisphere', async () => {
    for (const yaw of [0.15, 0.25, -0.2]) {
      const current = makeRig({ capacity: 2, seed: 92 });
      const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 30 * DEG));
      current.pilot = (active) => active.turnPlayer(yaw * DT);
      expect(arrive(current, jet, 30)).toBe(true);
      current.run(3);
      let steps = 0;
      let behind = 0;
      current.run(45, () => {
        steps++;
        if (asternAngle(current, jet) < 90 * DEG) behind++;
      });
      expect(behind / steps, `rear-hemisphere share, turn ${yaw} rad/s`).toBeGreaterThan(0.9);
      await breathe();
    }
  });

  it('fires 4-round bursts', async () => {
    const sizes: number[] = [];
    for (const seed of [93, 94]) {
      for (const yaw of [0, 0.3, 0.6]) {
        const current = makeRig({ capacity: 2, seed });
        current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 150 * DEG));
        current.pilot = (active) =>
          active.turnPlayer((Math.floor(active.time / 4) % 2 === 0 ? yaw : -yaw) * DT);
        current.run(80);
        for (const burst of groupBursts(current.shots, 0.5)) sizes.push(burst.length);
        for (const shot of current.shots) expect(shot.weapon).toBe('bullet');
      }
      await breathe();
    }
    expect(sizes.length, 'bursts seen').toBeGreaterThan(60);
    expect(Math.max(...sizes), 'longest burst').toBe(4);
    // 玩家甩出窄锥时点射会被打断，但绝大多数是完整的四发
    expect(sizes.filter((size) => size === 4).length / sizes.length).toBeGreaterThan(0.85);
  });

  it('against a player flying straight every burst is a full four', () => {
    const current = makeRig({ capacity: 2, seed: 95 });
    current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 150 * DEG));
    current.run(80);
    const bursts = groupBursts(current.shots, 0.5);
    expect(bursts.length).toBeGreaterThan(15);
    for (const burst of bursts) expect(burst.length).toBe(4);
  });

  it('opens fire only with the player inside a tight cone of about 12 degrees', async () => {
    const opening: number[] = [];
    const every: number[] = [];
    for (const seed of [96, 97, 98]) {
      for (const yaw of [0, 0.4, 0.8, 1.2]) {
        const current = makeRig({ capacity: 2, seed });
        current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 150 * DEG));
        current.pilot = (active) =>
          active.turnPlayer((Math.floor(active.time / 4) % 2 === 0 ? yaw : -yaw) * DT);
        current.run(80);
        for (const burst of groupBursts(current.shots, 0.5)) opening.push(offNose(burst[0]));
        for (const shot of current.shots) every.push(offNose(shot));
      }
      await breathe();
    }
    expect(opening.length, 'bursts seen').toBeGreaterThan(100);
    // “约 12°”：留 1° 的余量
    expect(Math.max(...opening), 'widest angle at which a burst opened (degrees)').toBeLessThan(13);
    // 点射途中玩家还在转，后面几发会略微偏出；但离旧的 45° 锥还差得远
    expect(Math.max(...every), 'widest angle of any round (degrees)').toBeLessThan(30);
  });

  it('a player parked 20 degrees off its nose draws no fire at all; dead ahead it shoots', () => {
    // 玩家固定在敌机机体坐标系里：正前方 200 米、与敌机同向飞行
    const ahead = makeRig({ capacity: 2, seed: 99 });
    const hunter = ahead.addJet(EnemyType.FIGHTER, pointAround(ahead.player, 300, 0));
    ahead.pilot = shadowPilot(hunter, -200, 0, 0, 'with-jet');
    ahead.run(15);
    expect(ahead.shots.length, 'rounds at a player dead ahead').toBeGreaterThanOrEqual(8);

    // 偏出 20°（在窄锥之外、旧的 45° 锥之内）：一发不打
    for (const side of [1, -1]) {
      const offBoresight = makeRig({ capacity: 2, seed: 99 });
      const jet = offBoresight.addJet(EnemyType.FIGHTER, pointAround(offBoresight.player, 300, 0));
      offBoresight.pilot = shadowPilot(
        jet,
        -200 * Math.cos(20 * DEG),
        side * 200 * Math.sin(20 * DEG),
        0,
        'with-jet'
      );
      offBoresight.run(15);
      expect(offBoresight.shots.length, 'rounds at a player 20 degrees off the nose').toBe(0);
    }
  });

  it('a Fighter without a token stays with the fight but never fires, even with the player on its nose', () => {
    const current = makeRig({ capacity: 0, seed: 100 });
    const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 30 * DEG));
    let farthest = 0;
    current.run(40, () => {
      farthest = Math.max(farthest, current.distanceTo(jet));
    });
    expect(current.shots.length).toBe(0);
    expect(farthest, 'it repositions near the player instead of leaving').toBeLessThan(900);

    // 把玩家摆在它正前方 200 米：没有令牌照样不打
    current.pilot = shadowPilot(jet, -200, 0, 0, 'with-jet');
    current.run(10);
    expect(current.shots.length).toBe(0);
  });
});

describe('FIGHTER head-on pass (spec §3)', () => {
  /** 推进到与玩家交错（距离不再缩小）的那一步；返回交错时刻 */
  function runToMerge(current: FleetRig, jet: EnemyAI, maxSeconds: number): number {
    let closest = Infinity;
    let mergedAt = -1;
    current.run(maxSeconds, () => {
      const distance = current.distanceTo(jet);
      if (distance < closest) {
        closest = distance;
        return false;
      }
      if (closest < 120) {
        mergedAt = current.time;
        return true;
      }
      return false;
    });
    return mergedAt;
  }

  it('a player flying straight at it gets exactly one burst before the merge, then it extends', () => {
    const current = makeRig({ capacity: 2, seed: 101 });
    const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 500, 0));
    const mergedAt = runToMerge(current, jet, 15);
    expect(mergedAt, 'the two passed each other').toBeGreaterThan(0);

    const bursts = groupBursts(current.shots, 0.5);
    expect(bursts.length, 'bursts on the way in').toBe(1);
    expect(bursts[0].length).toBe(4);
    for (const shot of bursts[0]) expect(offNose(shot)).toBeLessThan(13);

    // 掠过之后不立刻回头：1.5 秒里一直在拉开，也不开火
    const shotsAtMerge = current.shots.length;
    let previous = current.distanceTo(jet);
    let closing = 0;
    current.run(1.5, () => {
      const distance = current.distanceTo(jet);
      if (distance < previous) closing++;
      previous = distance;
    });
    expect(closing, 'steps on which it closed again right after the pass').toBe(0);
    expect(current.distanceTo(jet), 'separation 1.5 s after the pass (m)').toBeGreaterThan(100);
    expect(current.shots.length, 'rounds fired while extending').toBe(shotsAtMerge);
  });

  it.each([60, 90, 120])(
    'a player who turns into it from %s degrees off gets one burst and a pass, not a turning fight',
    (offset) => {
      const current = makeRig({ capacity: 2, seed: 102 });
      const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, offset * DEG));
      current.pilot = chasePilot(jet, 1.5);
      const mergedAt = runToMerge(current, jet, 15);
      expect(mergedAt, 'the two passed each other').toBeGreaterThan(0);
      const bursts = groupBursts(current.shots, 0.5);
      expect(bursts.length, 'bursts before the merge').toBe(1);
      expect(bursts[0].length).toBeLessThanOrEqual(4);

      const shotsAtMerge = current.shots.length;
      current.run(2);
      expect(current.shots.length, 'rounds in the 2 s after the pass').toBe(shotsAtMerge);
    }
  );
});

describe('FIGHTER reaction to LOCK and to a missile (spec §3)', () => {
  /** 等它机头对着玩家飞（正在进攻）再施加威胁 */
  function attackThenThreaten(
    threat: 'lock' | 'missile',
    seed: number
  ): { current: FleetRig; jet: EnemyAI } {
    const current = makeRig({ capacity: 2, seed });
    const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 30 * DEG));
    const noseOn = current.runUntil(() => {
      const toPlayer = current.player.position.clone().sub(jet.getMesh().position);
      return current.time > 3 && angleBetween(jet.velocity, toPlayer) < 8 * DEG;
    }, 30);
    expect(noseOn, 'it was pointing at the player').toBe(true);
    if (threat === 'lock') current.lockedJet = jet;
    else current.missileTargets.add(jet);
    return { current, jet };
  }

  it.each([
    ['lock', 103],
    ['lock', 104],
    ['missile', 103],
    ['missile', 104],
  ] as const)(
    'on a %s (seed %s) it breaks hard across the line of sight with a dive or climb',
    (threat, seed) => {
      const { current, jet } = attackThenThreaten(threat, seed);
      const height = jet.getMesh().position.y;
      const shotsBefore = current.shots.length;

      // 急转：0.75 秒内就横过来了
      current.run(0.75);
      const across = (): number => {
        const toPlayer = horizontal(current.player.position.clone().sub(jet.getMesh().position));
        return angleBetween(horizontal(jet.velocity), toPlayer) / DEG;
      };
      expect(across(), 'angle off the line of sight after 0.75 s (degrees)').toBeGreaterThan(60);
      expect(across()).toBeLessThan(125);
      expect(Math.abs(pitchOf(jet.velocity)) / DEG, 'dive / climb angle (degrees)').toBeGreaterThan(
        15
      );

      // 之后一直保持横向规避，不再对着玩家
      let worst = Infinity;
      current.run(2.25, () => {
        worst = Math.min(worst, across());
      });
      expect(worst, 'smallest angle off the line of sight while threatened').toBeGreaterThan(55);
      expect(
        Math.abs(jet.getMesh().position.y - height),
        'height change over the 3 s (m)'
      ).toBeGreaterThan(5);
      expect(current.shots.length, 'rounds fired while breaking').toBe(shotsBefore);
    }
  );

  it('goes back to the fight once the lock is gone', () => {
    const { current, jet } = attackThenThreaten('lock', 105);
    current.run(3);
    const shotsBefore = current.shots.length;
    current.lockedJet = null;
    expect(
      current.runUntil(() => current.shots.length > shotsBefore, 30),
      'fires again after the lock is dropped'
    ).toBe(true);
    expect(jet.isAlive()).toBe(true);
  });

  it('the same seed without a threat keeps attacking instead (the break is a reaction, not a habit)', () => {
    const current = makeRig({ capacity: 2, seed: 103 });
    const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 450, 30 * DEG));
    current.runUntil(() => {
      const toPlayer = current.player.position.clone().sub(jet.getMesh().position);
      return current.time > 3 && angleBetween(jet.velocity, toPlayer) < 8 * DEG;
    }, 30);
    let steepest = 0;
    current.run(3, () => {
      steepest = Math.max(steepest, Math.abs(pitchOf(jet.velocity)) / DEG);
    });
    expect(steepest, 'steepest dive / climb without a threat (degrees)').toBeLessThan(15);
  });
});
