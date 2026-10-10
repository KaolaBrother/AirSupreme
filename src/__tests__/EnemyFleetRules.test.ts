import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, GameEventType, type GameEventPayloads } from '@/core/EventBus';
import { createFriendlyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { getAttackTokenCount } from '@/features/enemy/AttackDirector';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { FriendlyAI, WINGMAN_CONFIG } from '@/features/enemy/FriendlyAI';
import {
  DEG,
  DT,
  FleetRig,
  SPEC,
  SystemRig,
  angleBetween,
  breathe,
  groupBursts,
  isFiniteVector,
  pointAround,
  seededRandom,
} from './enemyFleetRig';

/**
 * 敌机机队的通用规则（规格 §2.3 / §2.4 / §2.6 / §2.7 / §2.8），批次 E-X。
 *
 * 全部用真实的 EnemyAI + 机型条令 + 导演按 60 Hz 推进整场交战来验：拴绳、油门范围、招牌攻击的
 * 预警、EMP 瘫痪、非法输入下位置保持有限、僚机不继承这一套。攻击令牌与进入方位（§2.1 / §2.2）
 * 在 EnemyDirector.test.ts。
 *
 * JAMMER / STRIKER / WRAITH 的专属打法（里程碑 2：导弹、干扰、隐形）不在这里；这里只对它们验
 * “每架敌机都适用”的规则（拴绳、油门、非法输入）。
 */

const ALL_TYPES = Object.values(EnemyType);
/** 带机炮 / 高炮 / 长枪的五种机型 */
const ARMED_TYPES = [
  EnemyType.SCOUT,
  EnemyType.FIGHTER,
  EnemyType.HEAVY,
  EnemyType.SNIPER,
  EnemyType.ACE,
];

/** 三种玩家飞法：直飞、缓慢盘旋、每 5 秒换一次方向的急转 */
const PILOTS: Array<{ name: string; fly: (rig: FleetRig) => void }> = [
  { name: 'straight', fly: () => {} },
  { name: 'circling', fly: (rig) => rig.turnPlayer(0.3 * DT) },
  {
    name: 'jinking',
    fly: (rig) => rig.turnPlayer((Math.floor(rig.time / 5) % 2 === 0 ? 0.9 : -0.6) * DT),
  },
];

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

/** 七架混编：两架侦察机、两架战斗机、重型机、狙击机、王牌，围着玩家散开 */
function mixedFleet(current: FleetRig): EnemyAI[] {
  const types = [
    EnemyType.SCOUT,
    EnemyType.FIGHTER,
    EnemyType.HEAVY,
    EnemyType.SNIPER,
    EnemyType.ACE,
    EnemyType.SCOUT,
    EnemyType.FIGHTER,
  ];
  return types.map((type, index) =>
    current.addJet(
      type,
      pointAround(current.player, 380 + index * 25, (index * 51 + 15) * DEG, (index % 3) * 20 - 20)
    )
  );
}

// ---------------------------------------------------------------------------------------------
// §2.4 拴绳
// ---------------------------------------------------------------------------------------------

describe('leash: beyond 900 m a jet flies straight back toward the fight (spec §2.4)', () => {
  it.each(ALL_TYPES)(
    '%s heading away 1300 m out turns round and flies straight at the player',
    (type) => {
      // 玩家悬停：“回到战场”的方向没有歧义，就是指向玩家
      const current = makeRig({ capacity: 2, seed: 3, playerSpeed: 0 });
      const start = pointAround(current.player, 1300, 90 * DEG);
      const away = start.clone().sub(current.player.position).setY(0).normalize();
      const jet = current.addJet(type, start, { heading: away });
      const config = ENEMY_CONFIGS[type];
      // 掉头最多需要的时间：半圈 / 转向角速度，再留 1.5 秒
      const turnTime = Math.PI / config.turnSpeed + 1.5;

      let checked = 0;
      let worstAngle = 0;
      let insideAt = -1;
      // 1300 → 900 米，按最低油门算也飞得完
      const budget = turnTime + 400 / (config.speed * SPEC.MIN_THROTTLE) + 5;
      current.run(budget, () => {
        const distance = current.distanceTo(jet);
        if (distance <= SPEC.LEASH) {
          insideAt = current.time;
          return true;
        }
        if (current.time > turnTime && distance > SPEC.LEASH + 10) {
          const toPlayer = current.player.position.clone().sub(jet.getMesh().position);
          worstAngle = Math.max(worstAngle, angleBetween(jet.velocity, toPlayer));
          checked++;
        }
        return false;
      });

      expect(insideAt, 'came back inside 900 m').toBeGreaterThan(0);
      expect(checked, 'steps checked beyond the leash').toBeGreaterThan(60);
      expect(worstAngle / DEG, 'off the straight line to the player (degrees)').toBeLessThan(3);
    }
  );

  it.each(ALL_TYPES)(
    '%s left behind by a player flying away keeps closing while it is beyond 900 m',
    (type) => {
      // 玩家以 30 米/秒飞离（任何机型的最低油门都追得上）
      const current = makeRig({ capacity: 2, seed: 4, playerSpeed: 30 });
      const start = pointAround(current.player, 1250, 180 * DEG);
      const sideways = new THREE.Vector3(1, 0, 0);
      const jet = current.addJet(type, start, { heading: sideways });
      const turnTime = Math.PI / ENEMY_CONFIGS[type].turnSpeed + 1.5;

      let checked = 0;
      let previous = current.distanceTo(jet);
      let opened = 0;
      current.run(turnTime + 40, () => {
        const distance = current.distanceTo(jet);
        if (distance <= SPEC.LEASH) return true;
        if (current.time > turnTime) {
          checked++;
          if (distance > previous + 1e-6) opened++;
        }
        previous = distance;
        return false;
      });
      expect(checked, 'steps checked beyond the leash').toBeGreaterThan(30);
      expect(opened, 'steps on which the distance grew while beyond the leash').toBe(0);
    }
  );

  it('in whole fights nobody strays far beyond the leash and everybody who does comes back', async () => {
    for (const seed of [11, 12, 13]) {
      for (const pilot of PILOTS) {
        const current = makeRig({ capacity: 3, seed, level: 4 });
        const jets = mixedFleet(current);
        current.pilot = pilot.fly;
        /** 每架敌机连续待在 900 米以外的秒数 */
        const outside = new Map<EnemyAI, number>();
        let farthest = 0;
        let longestOutside = 0;
        current.run(60, () => {
          for (const jet of jets) {
            const distance = current.distanceTo(jet);
            farthest = Math.max(farthest, distance);
            const streak = distance > SPEC.LEASH ? (outside.get(jet) ?? 0) + DT : 0;
            outside.set(jet, streak);
            longestOutside = Math.max(longestOutside, streak);
          }
        });
        const label = `seed ${seed}, ${pilot.name} player`;
        // 越线之后要先掉头：留出一个转弯半径加上玩家这几秒飞开的距离
        expect(farthest, `farthest any jet got (${label})`).toBeLessThan(SPEC.LEASH + 120);
        expect(longestOutside, `longest stay beyond 900 m (${label})`).toBeLessThan(8);
        await breathe();
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// §2.6 油门
// ---------------------------------------------------------------------------------------------

describe('throttle: 0.6x to 1.3x of the base speed (spec §2.6)', () => {
  /** 一场带威胁的交战里某架敌机的速度范围（基础速度的倍数）：按速度向量与按实际位移各算一次 */
  function speedRange(
    current: FleetRig,
    jets: EnemyAI[],
    seconds: number
  ): { min: number; max: number } {
    const previous = jets.map((jet) => jet.getMesh().position.clone());
    let min = Infinity;
    let max = 0;
    current.run(seconds, () => {
      // 周期性地锁定 / 朝它们发射导弹：把规避时的加速也包括进来
      const phase = current.time % 12;
      current.lockedJet = phase > 8 ? jets[0] : null;
      if (phase > 5 && phase < 7) current.missileTargets.add(jets[jets.length - 1]);
      else current.missileTargets.clear();
      jets.forEach((jet, index) => {
        const position = jet.getMesh().position;
        if (!jet.isStunned()) {
          const base = jet.getConfig().speed;
          const byVelocity = jet.velocity.length() / base;
          const byDisplacement = position.distanceTo(previous[index]) / DT / base;
          min = Math.min(min, byVelocity, byDisplacement);
          max = Math.max(max, byVelocity, byDisplacement);
        }
        previous[index].copy(position);
      });
    });
    return { min, max };
  }

  it.each(ALL_TYPES)('%s stays inside the range at every step of a fight', async (type) => {
    for (const seed of [1, 2, 3]) {
      for (const pilot of PILOTS) {
        const current = makeRig({ capacity: 2, seed });
        const jets = [0, 1, 2].map((index) =>
          current.addJet(type, pointAround(current.player, 450, (index * 120 + 20) * DEG))
        );
        current.pilot = pilot.fly;
        const { min, max } = speedRange(current, jets, 45);
        const label = `${type}, seed ${seed}, ${pilot.name} player`;
        expect(min, `slowest (${label})`).toBeGreaterThanOrEqual(SPEC.MIN_THROTTLE - 0.005);
        expect(max, `fastest (${label})`).toBeLessThanOrEqual(SPEC.MAX_THROTTLE + 0.005);
      }
      await breathe();
    }
  });

  it('a mixed fleet under threat stays inside the range too, at level 1 and level 10', async () => {
    for (const level of [1, 10]) {
      for (const seed of [21, 22]) {
        const current = makeRig({ capacity: 4, seed, level });
        const jets = mixedFleet(current);
        current.pilot = PILOTS[2].fly;
        const { min, max } = speedRange(current, jets, 60);
        expect(min, `slowest (level ${level}, seed ${seed})`).toBeGreaterThanOrEqual(
          SPEC.MIN_THROTTLE - 0.005
        );
        expect(max, `fastest (level ${level}, seed ${seed})`).toBeLessThanOrEqual(
          SPEC.MAX_THROTTLE + 0.005
        );
        await breathe();
      }
    }
  });

  it('jets spawned by the real system (level and difficulty scaling applied) obey it against their own base speed', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(4242));
    EventBus.clear();
    const system = new SystemRig({ level: 10, difficulty: 5 });
    try {
      const jets = ARMED_TYPES.map((type, index) =>
        system.spawn(type, pointAround(system.player, 420, (index * 72 + 10) * DEG))
      );
      system.pilot = (current) => current.turnPlayer(0.4 * DT);
      const previous = new Map(jets.map((jet) => [jet, jet.getMesh().position.clone()]));
      let min = Infinity;
      let max = 0;
      system.run(40, () => {
        for (const jet of jets) {
          if (!jet.isAlive()) continue;
          const last = previous.get(jet);
          if (!last) continue;
          const base = jet.getConfig().speed;
          const ratio = jet.getMesh().position.distanceTo(last) / DT / base;
          min = Math.min(min, ratio, jet.velocity.length() / base);
          max = Math.max(max, ratio, jet.velocity.length() / base);
          last.copy(jet.getMesh().position);
        }
      });
      expect(min).toBeGreaterThanOrEqual(SPEC.MIN_THROTTLE - 0.005);
      expect(max).toBeLessThanOrEqual(SPEC.MAX_THROTTLE + 0.005);
    } finally {
      system.dispose();
      randomSpy.mockRestore();
      EventBus.clear();
    }
    await breathe();
  });
});

// ---------------------------------------------------------------------------------------------
// §2.3 预警
// ---------------------------------------------------------------------------------------------

describe('telegraph: no instant, unannounced damage (spec §2.3)', () => {
  /**
   * 跑一场有狙击机的交战，返回每一发长枪弹距离它那次蓄力预警开始的秒数；
   * 同时核对预警开始到开火之间光束一直亮着。
   */
  function lanceWarnings(
    current: FleetRig,
    snipers: EnemyAI[],
    seconds: number
  ): { warnings: number[]; beamGaps: number } {
    /** 每架狙击机：上一次预警之后光束熄灭过没有 */
    const beamBroken = new Map<EnemyAI, boolean>();
    const seenTells = new Map<EnemyAI, number>();
    let beamGaps = 0;
    const warnings: number[] = [];
    let seenShots = 0;
    current.run(seconds, () => {
      // 先看这一步的开火：开火这一步光束刚好结束，所以只看开火之前有没有断过
      for (; seenShots < current.shots.length; seenShots++) {
        const shot = current.shots[seenShots];
        if (shot.weapon !== 'lance') continue;
        const tell = [...current.tells]
          .reverse()
          .find((entry) => entry.jet === shot.jet && entry.time <= shot.time);
        warnings.push(tell ? shot.time - tell.time : 0);
        if (beamBroken.get(shot.jet) !== false) beamGaps++;
        beamBroken.set(shot.jet, true);
      }
      for (const sniper of snipers) {
        const tells = current.tells.filter((tell) => tell.jet === sniper).length;
        if (tells !== (seenTells.get(sniper) ?? 0)) {
          seenTells.set(sniper, tells);
          beamBroken.set(sniper, false);
        } else if (!sniper.isTelegraphing()) {
          beamBroken.set(sniper, true);
        }
      }
    });
    return { warnings, beamGaps };
  }

  it('every lance in every fight comes at least 0.7 s after a charge tell from the same jet', async () => {
    let lances = 0;
    for (const level of [1, 10]) {
      for (const cadenceScale of [0.5, 1, 2.5]) {
        for (const pilot of PILOTS) {
          const current = makeRig({ capacity: 3, seed: 30 + level, level });
          const snipers = [0, 1, 2].map((index) =>
            current.addJet(
              EnemyType.SNIPER,
              pointAround(current.player, 440, (index * 120 + 40) * DEG),
              { config: { cadenceScale } }
            )
          );
          current.addJet(EnemyType.FIGHTER, pointAround(current.player, 400, 200 * DEG));
          current.pilot = pilot.fly;
          const { warnings, beamGaps } = lanceWarnings(current, snipers, 50);
          const label = `level ${level}, cadence x${cadenceScale}, ${pilot.name} player`;
          for (const warning of warnings) {
            expect(warning, `warning before a lance (${label})`).toBeGreaterThanOrEqual(
              SPEC.MIN_TELL - 1e-6
            );
          }
          expect(beamGaps, `lances whose beam went out before the shot (${label})`).toBe(0);
          lances += warnings.length;
        }
        await breathe();
      }
    }
    expect(lances, 'lances seen across all fights').toBeGreaterThan(100);
  });

  it('a faster or slower firing cadence does not change how long the warning lasts', () => {
    const delays = [0.5, 1, 2.5].map((cadenceScale) => {
      const current = makeRig({ capacity: 2, seed: 33 });
      const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 440, 70 * DEG), {
        config: { cadenceScale },
      });
      const { warnings } = lanceWarnings(current, [sniper], 40);
      expect(warnings.length, `lances at cadence x${cadenceScale}`).toBeGreaterThanOrEqual(3);
      return warnings;
    });
    const reference = delays[1][0];
    for (const warnings of delays) {
      for (const warning of warnings) {
        expect(Math.abs(warning - reference)).toBeLessThanOrEqual(DT + 1e-9);
      }
    }
  });

  it('the tell announces its own length, and that length is at least 0.7 s', () => {
    const current = makeRig({ capacity: 2, seed: 34 });
    current.addJet(EnemyType.SNIPER, pointAround(current.player, 440, 70 * DEG));
    current.run(30);
    expect(current.tells.length).toBeGreaterThanOrEqual(3);
    for (const tell of current.tells) {
      expect(tell.duration).toBeGreaterThanOrEqual(SPEC.MIN_TELL);
    }
  });

  it('an interrupted charge never fires: lock the Sniper mid-charge again and again', () => {
    const current = makeRig({ capacity: 2, seed: 35 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 440, 70 * DEG));
    let interrupted = 0;
    let lockUntil = -1;
    let lastTellSeen = 0;
    current.run(90, () => {
      // 每次新的蓄力开始 0.5 秒后锁定它 1 秒
      if (current.tells.length > lastTellSeen && current.tells.length % 2 === 1) {
        const tell = current.tells[current.tells.length - 1];
        if (current.time - tell.time >= 0.5) {
          lastTellSeen = current.tells.length;
          lockUntil = current.time + 1;
          interrupted++;
        }
      } else if (current.tells.length > lastTellSeen) {
        lastTellSeen = current.tells.length;
      }
      current.lockedJet = current.time < lockUntil ? sniper : null;
    });
    expect(interrupted, 'charges interrupted').toBeGreaterThanOrEqual(3);
    const lances = current.shots.filter((shot) => shot.weapon === 'lance');
    expect(lances.length, 'the uninterrupted charges still fired').toBeGreaterThanOrEqual(2);
    for (const lance of lances) {
      const tell = [...current.tells].reverse().find((entry) => entry.time <= lance.time);
      expect(tell, 'a tell precedes the lance').toBeDefined();
      expect(lance.time - (tell?.time ?? lance.time)).toBeGreaterThanOrEqual(SPEC.MIN_TELL - 1e-6);
    }
  });

  it('through the real system the tell event comes first, at every level and difficulty', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(777));
    try {
      let lances = 0;
      for (const [level, difficulty] of [
        [1, 1],
        [2, 3],
        [6, 3],
        [10, 5],
      ]) {
        EventBus.clear();
        const system = new SystemRig({ level, difficulty });
        const snipers = [0, 1].map((index) =>
          system.spawn(EnemyType.SNIPER, pointAround(system.player, 430, (index * 150 + 50) * DEG))
        );
        system.pilot = (current) => current.turnPlayer(0.25 * DT);
        system.run(45);
        for (const shot of system.shots) {
          if (shot.payload.weapon !== 'lance') continue;
          lances++;
          const tell = [...system.tells]
            .reverse()
            .find((entry) => entry.payload.owner === shot.payload.owner && entry.time <= shot.time);
          const label = `level ${level}, difficulty ${difficulty}`;
          expect(tell, `tell before the lance (${label})`).toBeDefined();
          if (!tell) continue;
          expect(shot.time - tell.time, `warning time (${label})`).toBeGreaterThanOrEqual(
            SPEC.MIN_TELL - 1e-6
          );
          expect(tell.payload.duration, `announced length (${label})`).toBeGreaterThanOrEqual(
            SPEC.MIN_TELL
          );
        }
        expect(snipers.length).toBe(2);
        system.dispose();
        await breathe();
      }
      expect(lances, 'lances seen').toBeGreaterThan(10);
    } finally {
      randomSpy.mockRestore();
      EventBus.clear();
    }
  });

  it('the only unannounced signature round is the slow flak shell, slower than a gun round', () => {
    const current = makeRig({ capacity: 4, seed: 36, level: 6 });
    mixedFleet(current);
    current.pilot = PILOTS[1].fly;
    current.run(60);
    const speedOf = (weapon: string): number[] =>
      current.shots.filter((shot) => shot.weapon === weapon).map((shot) => shot.speed ?? 0);
    const bullets = speedOf('bullet');
    const shells = speedOf('heavy-shell');
    const lances = speedOf('lance');
    expect(bullets.length).toBeGreaterThan(0);
    expect(shells.length).toBeGreaterThan(0);
    expect(lances.length).toBeGreaterThan(0);
    // 没有预警的弹种里，高炮弹最慢；最快的长枪弹一定有预警（上面几条）
    expect(Math.max(...shells)).toBeLessThan(Math.min(...bullets));
    expect(Math.min(...lances)).toBeGreaterThan(Math.max(...bullets));
    // 没有第四种弹
    const kinds = new Set(current.shots.map((shot) => shot.weapon));
    expect([...kinds].sort()).toEqual(['bullet', 'heavy-shell', 'lance']);
  });
});

// ---------------------------------------------------------------------------------------------
// §2.7 EMP 瘫痪
// ---------------------------------------------------------------------------------------------

describe('EMP stun: no steering, no firing, no token, no charge (spec §2.7)', () => {
  it.each(ARMED_TYPES)(
    '%s flies on in a straight line and stays silent for the whole stun, then fights again',
    (type) => {
      const current = makeRig({ capacity: 2, seed: 41 });
      const jet = current.addJet(type, pointAround(current.player, 420, 50 * DEG));
      current.pilot = PILOTS[1].fly;
      // 先让它打起来
      expect(
        current.runUntil(() => current.shots.length > 0, 60),
        'fired at least once before the stun'
      ).toBe(true);

      const shotsBefore = current.shots.length;
      const tellsBefore = current.tells.length;
      const heading = jet.velocity.clone().normalize();
      jet.applyStun(3);
      expect(jet.isStunned()).toBe(true);

      let worstTurn = 0;
      let tokenSteps = 0;
      let beamSteps = 0;
      let stunnedSteps = 0;
      current.run(2.9, () => {
        if (!jet.isStunned()) return;
        stunnedSteps++;
        worstTurn = Math.max(worstTurn, angleBetween(heading, jet.velocity));
        if (jet.hasAttackToken()) tokenSteps++;
        if (jet.isTelegraphing() || jet.getDoctrine()?.getTell()) beamSteps++;
      });
      expect(stunnedSteps, 'steps spent stunned').toBeGreaterThan(160);
      expect(worstTurn / DEG, 'heading change while stunned (degrees)').toBeLessThan(0.5);
      expect(tokenSteps, 'steps holding a token while stunned').toBe(0);
      expect(beamSteps, 'steps showing a tell while stunned').toBe(0);
      expect(current.shots.length, 'shots while stunned').toBe(shotsBefore);
      expect(current.tells.length, 'tells while stunned').toBe(tellsBefore);
      expect(isFiniteVector(jet.getMesh().position)).toBe(true);

      // 瘫痪结束：重新领到令牌并开火
      expect(
        current.runUntil(() => !jet.isStunned() && current.shots.length > shotsBefore, 60),
        'fires again after the stun wears off'
      ).toBe(true);
      expect(jet.isAlive()).toBe(true);
    }
  );

  it.each([
    ['while the beam is still tracking', 0.3],
    ['while the beam is frozen', 1.05],
  ])('cancels a Sniper charge %s: the beam goes out and no lance comes of it', (_label, into) => {
    const current = makeRig({ capacity: 2, seed: 42 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 440, 70 * DEG));
    expect(
      current.runUntil(() => current.tells.length === 1, 30),
      'a charge started'
    ).toBe(true);
    current.run(into);
    expect(sniper.isTelegraphing(), 'still charging').toBe(true);
    expect(current.shots.length).toBe(0);

    sniper.applyStun(2);
    const stunnedAt = current.time;
    current.step();
    expect(sniper.isTelegraphing(), 'beam right after the stun').toBe(false);
    expect(sniper.getDoctrine()?.getTell() ?? null).toBeNull();
    expect(sniper.hasAttackToken()).toBe(false);

    // 被打断的那次蓄力本该在 1.3 秒处开火：整个瘫痪期间都没有长枪弹
    current.run(2.2);
    expect(current.shots.length, 'lances from the interrupted charge').toBe(0);

    // 恢复之后要重新完整蓄力一次才能开火
    expect(
      current.runUntil(() => current.shots.length > 0, 30),
      'fires again later'
    ).toBe(true);
    const lance = current.shots[0];
    const tell = current.tells[current.tells.length - 1];
    expect(current.tells.length, 'a fresh tell after the stun').toBeGreaterThanOrEqual(2);
    expect(tell.time).toBeGreaterThan(stunnedAt + 2 - DT);
    expect(lance.time - tell.time).toBeGreaterThanOrEqual(SPEC.MIN_TELL - 1e-6);
  });

  it('a stunned jet is passed over for tokens even when it is the only one asking', () => {
    const current = makeRig({ capacity: 3, seed: 43 });
    const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 300, 120 * DEG));
    current.run(2);
    expect(jet.hasAttackToken()).toBe(true);
    jet.applyStun(4);
    let held = 0;
    current.run(3.9, () => {
      if (jet.hasAttackToken()) held++;
    });
    expect(held).toBe(0);
    expect(current.director.getHolderCount()).toBe(0);
  });

  it('stunning the same jet again while stunned never makes it fire or steer', () => {
    const current = makeRig({ capacity: 2, seed: 44 });
    const jet = current.addJet(EnemyType.ACE, pointAround(current.player, 300, 160 * DEG));
    current.run(6);
    const shotsBefore = current.shots.length;
    jet.applyStun(1);
    current.run(0.5);
    jet.applyStun(1);
    const heading = jet.velocity.clone().normalize();
    current.run(0.9);
    expect(jet.isStunned()).toBe(true);
    expect(angleBetween(heading, jet.velocity) / DEG).toBeLessThan(0.5);
    expect(current.shots.length).toBe(shotsBefore);
  });
});

// ---------------------------------------------------------------------------------------------
// §2.7 非法输入
// ---------------------------------------------------------------------------------------------

describe('NaN / Infinity inputs never give a non-finite position (spec §2.7)', () => {
  const GARBAGE: Array<{ name: string; corrupt: (rig: FleetRig) => void }> = [
    { name: 'player position NaN', corrupt: (current) => current.player.position.setX(Number.NaN) },
    {
      name: 'player position Infinity',
      corrupt: (current) => current.player.position.setY(Infinity),
    },
    {
      name: 'player position -Infinity',
      corrupt: (current) => current.player.position.setZ(-Infinity),
    },
    {
      name: 'player nose NaN',
      corrupt: (current) => current.player.forward.set(Number.NaN, Number.NaN, Number.NaN),
    },
    { name: 'player nose zero', corrupt: (current) => current.player.forward.set(0, 0, 0) },
    { name: 'player speed Infinity', corrupt: (current) => (current.player.speed = Infinity) },
    { name: 'player speed NaN', corrupt: (current) => (current.player.speed = Number.NaN) },
    { name: 'level NaN', corrupt: (current) => (current.level = Number.NaN) },
    { name: 'level Infinity', corrupt: (current) => (current.level = Infinity) },
    { name: 'token count NaN', corrupt: (current) => (current.capacity = Number.NaN) },
  ];

  function allFinite(jets: EnemyAI[]): string | null {
    for (const jet of jets) {
      const mesh = jet.getMesh();
      const quaternion = mesh.quaternion;
      if (
        !isFiniteVector(mesh.position) ||
        !isFiniteVector(jet.velocity) ||
        ![quaternion.x, quaternion.y, quaternion.z, quaternion.w].every(Number.isFinite)
      ) {
        return jet.getConfig().type;
      }
    }
    return null;
  }

  it.each(GARBAGE)(
    '$name: every type keeps a finite position, velocity and attitude',
    (garbage) => {
      const current = makeRig({ capacity: 3, seed: 51 });
      const jets = ALL_TYPES.map((type, index) =>
        current.addJet(type, pointAround(current.player, 320, index * 45 * DEG))
      );
      current.run(3);
      expect(allFinite(jets)).toBeNull();

      const saved = {
        position: current.player.position.clone(),
        forward: current.player.forward.clone(),
        speed: current.player.speed,
        level: current.level,
        capacity: current.capacity,
      };
      garbage.corrupt(current);
      let broken: string | null = null;
      // 坏数据持续 2 秒；测试台自己不替敌机清洗输入
      current.pilot = () => garbage.corrupt(current);
      current.run(2, () => {
        broken = broken ?? allFinite(jets);
      });
      expect(broken, 'type with a non-finite state during the bad input').toBeNull();

      // 输入恢复正常：照常继续飞
      current.pilot = null;
      current.player.position.copy(saved.position);
      current.player.forward.copy(saved.forward);
      current.player.speed = saved.speed;
      current.level = saved.level;
      current.capacity = saved.capacity;
      const before = jets.map((jet) => jet.getMesh().position.clone());
      current.run(2, () => {
        broken = broken ?? allFinite(jets);
      });
      expect(broken, 'type with a non-finite state after the input recovered').toBeNull();
      jets.forEach((jet, index) => {
        expect(
          jet.getMesh().position.distanceTo(before[index]),
          `${jet.getConfig().type} is flying again`
        ).toBeGreaterThan(10);
      });
    }
  );

  it.each(ARMED_TYPES)('%s with no player at all keeps flying with a finite position', (type) => {
    const current = makeRig({ capacity: 2, seed: 52 });
    const jet = current.addJet(type, pointAround(current.player, 300, 30 * DEG));
    current.run(2);
    for (let i = 0; i < 120; i++) {
      jet.update(DT, null, undefined, null);
      expect(isFiniteVector(jet.getMesh().position)).toBe(true);
      expect(isFiniteVector(jet.velocity)).toBe(true);
    }
  });

  it.each(ARMED_TYPES)(
    '%s whose own position was corrupted is back on finite numbers after one step',
    (type) => {
      const current = makeRig({ capacity: 2, seed: 53 });
      const jet = current.addJet(type, pointAround(current.player, 300, 30 * DEG));
      current.run(2);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        jet.getMesh().position.set(Number.NaN, Infinity, 0);
        current.step();
        expect(isFiniteVector(jet.getMesh().position)).toBe(true);
        current.run(1);
        expect(isFiniteVector(jet.getMesh().position)).toBe(true);
        expect(isFiniteVector(jet.velocity)).toBe(true);
      } finally {
        errorSpy.mockRestore();
      }
    }
  );

  it.each([0, -1])('a time step of %s moves nothing to a non-finite place', (step) => {
    const current = makeRig({ capacity: 2, seed: 54 });
    const jets = ARMED_TYPES.map((type, index) =>
      current.addJet(type, pointAround(current.player, 300, index * 70 * DEG))
    );
    current.run(2);
    for (const jet of jets) {
      jet.update(step, current.player.position, undefined, current.player.position);
      expect(isFiniteVector(jet.getMesh().position)).toBe(true);
      expect(isFiniteVector(jet.velocity)).toBe(true);
    }
  });

  // FINDING: spec §2.7 keeps "NaN / Infinity guards on positions" as a contract, and the batch brief
  // reads it as "NaN / Infinity inputs never produce non-finite positions". A non-finite time step
  // breaks that: EnemyAI.update(NaN | Infinity, ...) integrates the step first and only checks the
  // position at the start of the NEXT update, so the jet's mesh sits at NaN / ±Infinity for a whole
  // frame (anything that reads the position in between — collision, radar, the renderer — sees it),
  // and the next update then teleports the jet to the world origin. Reproduce: fly any doctrine jet
  // for 2 s, call jet.update(Number.NaN, playerPosition, undefined, playerPosition) and read
  // jet.getMesh().position. The same hole exists on the old three-state path (wingmen) and was there
  // before this batch (601def1), so it is inherited rather than introduced.
  it.fails.each([Number.NaN, Infinity])(
    'a time step of %s leaves the position finite when update returns',
    (step) => {
      const current = makeRig({ capacity: 2, seed: 55 });
      const jet = current.addJet(EnemyType.FIGHTER, pointAround(current.player, 300, 40 * DEG));
      current.run(2);
      jet.update(step, current.player.position, undefined, current.player.position);
      expect(isFiniteVector(jet.getMesh().position)).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------------------------
// §2.8 僚机不继承这一套
// ---------------------------------------------------------------------------------------------

describe('wingmen keep the old behaviour and a fixed stat block (spec §2.8)', () => {
  type FriendlyFired = GameEventPayloads[GameEventType.FRIENDLY_FIRED];

  let randomSpy: ReturnType<typeof vi.spyOn> | null = null;
  let system: SystemRig | null = null;

  beforeEach(() => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(20261011));
  });

  afterEach(() => {
    system?.dispose();
    system = null;
    randomSpy?.mockRestore();
    EventBus.clear();
  });

  function addWingman(current: SystemRig, offset: THREE.Vector3): FriendlyAI {
    const mesh = createFriendlyMesh({ ...WINGMAN_CONFIG });
    mesh.position.copy(current.player.position).add(offset);
    current.scene.add(mesh);
    const wingman = new FriendlyAI(mesh, { ...WINGMAN_CONFIG }, current.scene);
    wingman.getEnemy().velocity.set(0, 0, WINGMAN_CONFIG.speed);
    current.system.spawnFriendly(wingman);
    return wingman;
  }

  it('the wingman stat block is Fighter-like and is its own object, not the enemy Fighter entry', () => {
    expect(WINGMAN_CONFIG.type).toBe(EnemyType.FIGHTER);
    expect(WINGMAN_CONFIG.health).toBe(100);
    expect(WINGMAN_CONFIG.speed).toBeGreaterThan(0);
    expect(WINGMAN_CONFIG.damage).toBeGreaterThan(0);
    expect(WINGMAN_CONFIG).not.toBe(ENEMY_CONFIGS[EnemyType.FIGHTER]);
    // 敌机表里没有任何一项就是僚机这份对象：改敌机数值动不到僚机
    for (const type of ALL_TYPES) {
      expect(ENEMY_CONFIGS[type]).not.toBe(WINGMAN_CONFIG);
    }
  });

  it('a wingman has no doctrine, asks for no token and shows no tell', () => {
    const scene = new THREE.Scene();
    const wingman = new FriendlyAI(
      createFriendlyMesh({ ...WINGMAN_CONFIG }),
      WINGMAN_CONFIG,
      scene
    );
    const core = wingman.getEnemy();
    expect(core.getDoctrine()).toBeNull();
    expect(core.getAttackRequest()).toBeNull();
    expect(core.hasAttackToken()).toBe(false);
    expect(core.isTelegraphing()).toBe(false);
    wingman.dispose();
  });

  it('in a live fight wingmen never hold a token, never show a tell and fire only single plain rounds', async () => {
    system = new SystemRig({ level: 6, difficulty: 3 });
    const current = system;
    const wingmen = [
      addWingman(current, new THREE.Vector3(-40, 6, 38)),
      addWingman(current, new THREE.Vector3(40, 6, 38)),
    ];
    for (const [index, type] of ARMED_TYPES.entries()) {
      current.spawn(type, pointAround(current.player, 380, (index * 72 + 20) * DEG));
    }
    const friendlyShots: Array<{ time: number; jet: THREE.Object3D; payload: FriendlyFired }> = [];
    const off = EventBus.on(GameEventType.FRIENDLY_FIRED, ({ payload }) => {
      friendlyShots.push({ time: current.time, jet: payload.owner as THREE.Object3D, payload });
    });

    const stats = wingmen.map((wingman) => ({ ...wingman.getEnemy().getConfig() }));
    let tokenSteps = 0;
    let tellSteps = 0;
    let enemyTellsFromWingmen = 0;
    current.pilot = (active) => active.turnPlayer(0.2 * DT);
    current.run(40, () => {
      for (const wingman of wingmen) {
        if (!wingman.isAlive()) continue;
        const core = wingman.getEnemy();
        if (core.hasAttackToken() || core.orders.hasToken) tokenSteps++;
        if (core.isTelegraphing()) tellSteps++;
      }
    });
    off();
    const wingmanMeshes = new Set<THREE.Object3D>(wingmen.map((wingman) => wingman.getMesh()));
    for (const tell of current.tells) {
      if (wingmanMeshes.has(tell.payload.owner as THREE.Object3D)) enemyTellsFromWingmen++;
    }

    expect(tokenSteps, 'steps on which a wingman held an attack token').toBe(0);
    expect(tellSteps, 'steps on which a wingman showed a tell').toBe(0);
    expect(enemyTellsFromWingmen).toBe(0);
    expect(friendlyShots.length, 'the wingmen did fight').toBeGreaterThan(3);
    for (const shot of friendlyShots) {
      // 旧的单发机炮：不带弹种，不是高炮弹 / 长枪弹
      const payload = shot.payload as FriendlyFired & { weapon?: unknown };
      expect(payload.weapon === undefined || payload.weapon === 'bullet').toBe(true);
      expect(wingmanMeshes.has(shot.jet), 'fired by a wingman').toBe(true);
    }
    // 单发：同一架僚机相邻两发不会像条令点射那样只隔 0.12 秒
    for (const burst of groupBursts(friendlyShots, 0.3)) {
      expect(burst.length, 'rounds fired within 0.3 s by one wingman').toBe(1);
    }
    // 敌机的开火事件里没有僚机
    for (const shot of current.shots) {
      expect(wingmanMeshes.has(shot.payload.owner as THREE.Object3D)).toBe(false);
    }
    // 数值没有被关卡 / 难度缩放改动
    wingmen.forEach((wingman, index) => {
      expect(wingman.getEnemy().getConfig()).toEqual(stats[index]);
      expect(wingman.getEnemy().getConfig()).toEqual({ ...WINGMAN_CONFIG });
    });
    await breathe();
  });

  it('the enemy token limit counts enemy jets only: wingmen do not use up a slot', () => {
    system = new SystemRig({ level: 1, difficulty: 3 });
    const current = system;
    addWingman(current, new THREE.Vector3(-40, 6, 38));
    addWingman(current, new THREE.Vector3(40, 6, 38));
    for (let i = 0; i < 5; i++) {
      current.spawn(EnemyType.FIGHTER, pointAround(current.player, 300, (i * 72 + 10) * DEG));
    }
    let most = 0;
    current.run(15, () => {
      most = Math.max(most, current.holders().length);
    });
    // 五架敌机都想进攻：两架僚机在场，敌机照样把这一关的令牌数用满
    expect(most).toBe(getAttackTokenCount(1, 3, false));
  });
});
