import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  SIM_TEST_TIMEOUT,
  SPEC,
  SystemRig,
  pointAround,
  seededGameRandom,
  shadowPilot,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 干扰机（JAMMER，电子战机），规格 §3，批次 E-X 里程碑 2：
 * HP 120，没有武器，飞得慢。躲在自己编队身后 300–500 米，让编队挡在它和玩家之间。
 * 至少一架存活的干扰机在玩家 800 米内时，玩家导弹锁定时间 ×2（不叠加）；范围内最后一架
 * 干扰机被击毁 / 离开 800 米后效果结束（§3a：允许晚一个模拟步）。
 * 已接受的出入：“自己的编队” = 其余敌机的平均位置。
 *
 * 不在这里：“受干扰”标签、导引头与机炮（CoordinatorJamCloakJetMissiles.test.ts）；
 * 被 EMP 瘫痪的干扰机不干扰（§3a，里程碑 3）。
 */

const JAM_RANGE = 800;
const BEHIND_MIN = 300;
const BEHIND_MAX = 500;

/** 除干扰机以外会开火的机型 */
const ARMED_TYPES = Object.values(EnemyType).filter((type) => type !== EnemyType.JAMMER);

let system: SystemRig | null = null;
let fleet: FleetRig | null = null;
let randomSpy: { mockRestore(): void } | null = null;

function useSeed(seed: number): void {
  randomSpy?.mockRestore();
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(seed));
}

function systemRig(level = 6, seed = 1): SystemRig {
  system?.dispose();
  EventBus.clear();
  useSeed(seed);
  system = new SystemRig({ level, difficulty: 3 });
  system.missiles.flightSeconds = 3;
  return system;
}

beforeEach(() => {
  EventBus.clear();
});

afterEach(() => {
  system?.dispose();
  system = null;
  fleet?.dispose();
  fleet = null;
  EventBus.clear();
  randomSpy?.mockRestore();
  randomSpy = null;
});

/** 现在有没有存活的干扰机在玩家 800 米内（规格的判定，用这一步结束时的位置） */
function jammerInRange(rig: SystemRig): boolean {
  return rig.jets.some(
    (jet) =>
      jet.isAlive() &&
      jet.getConfig().type === EnemyType.JAMMER &&
      jet.getMesh().position.distanceTo(rig.player.position) <= JAM_RANGE
  );
}

/** 其余（非干扰机）存活敌机的平均位置；没有为 null */
function centroidOfOthers(rig: SystemRig, out = new THREE.Vector3()): THREE.Vector3 | null {
  out.set(0, 0, 0);
  let count = 0;
  for (const jet of rig.jets) {
    if (!jet.isAlive() || jet.getConfig().type === EnemyType.JAMMER) continue;
    out.add(jet.getMesh().position);
    count++;
  }
  return count > 0 ? out.multiplyScalar(1 / count) : null;
}

describe('JAMMER: HP 120, unarmed, slow (spec §3)', () => {
  it('has 120 HP at base and is slower than the player cruise speed and than every armed type but the Heavy', () => {
    const jammer = ENEMY_CONFIGS[EnemyType.JAMMER];
    expect(jammer.health).toBe(120);
    expect(jammer.speed).toBeLessThan(45);
    for (const type of ARMED_TYPES) {
      if (type === EnemyType.HEAVY) continue;
      expect(jammer.speed, type).toBeLessThan(ENEMY_CONFIGS[type].speed);
    }
  });

  it.each([5, 6, 8, 10])(
    'level %i, in a fight with Fighters, a Sniper and a Striker: it never fires, never locks, never asks for a missile and never holds an attack token',
    (level) => {
      const rig = systemRig(level, 20261050 + level);
      rig.pilot = (active) => active.turnPlayer(0.15 * DT);
      for (const [index, type] of [
        EnemyType.FIGHTER,
        EnemyType.FIGHTER,
        EnemyType.SNIPER,
        EnemyType.STRIKER,
      ].entries()) {
        rig.spawn(type, pointAround(rig.player, 500, (index * 70 - 40) * DEG));
      }
      const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 400, 170 * DEG));
      const mesh = jammer.getMesh();
      const base = jammer.getConfig().speed;
      let tokenSteps = 0;
      let lockSteps = 0;
      let requestSteps = 0;
      let slowest = Infinity;
      let fastest = 0;
      rig.run(120, () => {
        if (jammer.hasAttackToken()) tokenSteps++;
        if (jammer.isMissileLocking()) lockSteps++;
        if (jammer.getMissileRequest() > 0) requestSteps++;
        const speed = jammer.velocity.length();
        slowest = Math.min(slowest, speed);
        fastest = Math.max(fastest, speed);
      });
      expect(rig.shots.length, 'the others did fight').toBeGreaterThan(0);
      expect(rig.shots.filter((shot) => shot.payload.owner === mesh).length, 'rounds').toBe(0);
      expect(rig.launchLog.filter((launch) => launch.source === 'jet:JAMMER').length).toBe(0);
      expect(tokenSteps, 'steps holding an attack token').toBe(0);
      expect(lockSteps, 'steps locking').toBe(0);
      expect(requestSteps, 'steps asking for a missile').toBe(0);
      // 规格 §2 规则 6：0.6×–1.3× 基础速度
      expect(slowest / base).toBeGreaterThanOrEqual(SPEC.MIN_THROTTLE - 0.02);
      expect(fastest / base).toBeLessThanOrEqual(SPEC.MAX_THROTTLE + 0.02);
    }
  );

  it('fires nothing at a player sitting 150 m in front of it for 30 s, with tokens to spare', () => {
    fleet = new FleetRig({ level: 8, capacity: 4, seed: 7 });
    const jammer = fleet.addJet(EnemyType.JAMMER, pointAround(fleet.player, 300, 0));
    fleet.run(1);
    fleet.pilot = shadowPilot(jammer, -150, 0, 0, 'with-jet');
    let tokenSteps = 0;
    fleet.run(30, () => {
      if (jammer.hasAttackToken()) tokenSteps++;
    });
    expect(fleet.shots.length).toBe(0);
    expect(fleet.launchLog.length).toBe(0);
    expect(tokenSteps).toBe(0);
  });
});

describe('JAMMER station behind its own group (spec §3; accepted: group = centroid of the other jets)', () => {
  it('the enemy system gives it, every step, the mean position of the other living jets — and none when they are all dead', () => {
    const rig = systemRig(6, 3);
    const others = [EnemyType.FIGHTER, EnemyType.SCOUT, EnemyType.SNIPER].map((type, index) =>
      rig.spawn(type, pointAround(rig.player, 500, (index * 60 - 30) * DEG))
    );
    const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 800, 0));
    const original = jammer.setGroupCenter.bind(jammer);
    const calls: Array<{
      time: number;
      given: THREE.Vector3 | null;
      expected: THREE.Vector3 | null;
    }> = [];
    vi.spyOn(jammer, 'setGroupCenter').mockImplementation((center) => {
      const expected = centroidOfOthers(rig);
      calls.push({
        time: rig.time,
        given: center ? center.clone() : null,
        expected: expected ? expected.clone() : null,
      });
      original(center);
    });

    const check = (label: string) => {
      expect(calls.length, `${label}: calls`).toBeGreaterThan(0);
      for (const call of calls) {
        const tag = `${label} at ${call.time.toFixed(2)} s`;
        if (call.expected === null) {
          expect(call.given, tag).toBeNull();
        } else {
          expect(call.given, tag).not.toBeNull();
          const gap = call.given ? call.given.distanceTo(call.expected) : Infinity;
          expect(gap, tag).toBeLessThan(1e-6);
        }
      }
      calls.length = 0;
    };

    let steps = 0;
    rig.run(5, () => {
      steps++;
    });
    expect(calls.length, 'once per step').toBeGreaterThanOrEqual(steps);
    check('all three alive');

    others[1].takeDamage(1e6);
    rig.run(3);
    check('one shot down');

    others[0].takeDamage(1e6);
    others[2].takeDamage(1e6);
    rig.run(3);
    expect(calls.every((call) => call.expected === null)).toBe(true);
    check('all shot down');
    expect(Number.isFinite(jammer.getMesh().position.length())).toBe(true);
  });

  /**
   * 编队的站位：从第 15 秒起，干扰机离编队中心 300–500 米，并且编队挡在它和玩家之间
   * （从编队中心看，干扰机在“玩家 → 编队中心”方向两侧 45 度以内，而且比编队离玩家更远）
   * 的时间占比。规格没有给干扰机单独的量法，借用 §3a 狙击机距离带的量法（≥ 60 %）。
   */
  function stationShare(group: EnemyType[], yaw: number, seed: number) {
    const rig = systemRig(6, seed);
    rig.pilot = (active) => active.turnPlayer(yaw * DT);
    group.forEach((type, index) =>
      rig.spawn(type, pointAround(rig.player, 600, (20 + index * 25) * DEG))
    );
    const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 900, 40 * DEG));
    const center = new THREE.Vector3();
    const groupToJammer = new THREE.Vector3();
    const playerToGroup = new THREE.Vector3();
    let counted = 0;
    let held = 0;
    rig.run(120, () => {
      if (rig.time < 15) return;
      if (!centroidOfOthers(rig, center)) return;
      const jammerPosition = jammer.getMesh().position;
      const player = rig.player.position;
      groupToJammer.set(jammerPosition.x - center.x, 0, jammerPosition.z - center.z);
      playerToGroup.set(center.x - player.x, 0, center.z - player.z);
      const gap = groupToJammer.length();
      const behind =
        groupToJammer.angleTo(playerToGroup) <= 45 * DEG &&
        jammerPosition.distanceTo(player) > center.distanceTo(player);
      counted++;
      if (gap >= BEHIND_MIN && gap <= BEHIND_MAX && behind) held++;
    });
    expect(counted).toBeGreaterThan(5000);
    return held / counted;
  }

  it('control: behind a Sniper, a Striker and a Fighter, it holds the station at least 60 % of the time against a straight or gently turning player', () => {
    for (const seed of [1, 2, 3]) {
      for (const yaw of [0, 0.1]) {
        const share = stationShare(
          [EnemyType.SNIPER, EnemyType.STRIKER, EnemyType.FIGHTER],
          yaw,
          seed
        );
        expect(share, `seed ${seed}, turn ${yaw} rad/s`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  // FINDING: spec §3 JAMMER — "Keeps 300–500 m behind its own group, with the group between
  // itself and the player" (accepted: the group is the centroid of the other enemy jets). The
  // spec gives no separate measure; measured like spec §3a's Sniper standoff band (at least 60 %
  // of the time, from t = 15 s), a Jammer whose group is three Fighters does not hold it: the
  // share is 2-3 % against a player flying straight at cruise speed, 0 % against a 0.1 rad/s
  // turn and 9-12 % against a 0.3 rad/s circle (seeds 1-3); it sits 560-670 m from the group's
  // centre (median 585-659 m) instead of 300-500 m. The Fighters keep pace with the player
  // (45 m/s); the Jammer (base 38 m/s) flies at 1.0x of its base speed once it is within 260 m
  // of its station, so it falls back until it is 260 m short and hurries again — although spec
  // §2 rule 6 lets it fly at up to 1.3x (49.4 m/s). Against a straight player it is then also
  // outside its own 800 m jamming range about half the time. Reproduce: SystemRig({ level: 6,
  // difficulty: 3 }) with Math.random = seededGameRandom(seed); three FIGHTERs 600 m out at 20,
  // 45 and 70 degrees, one JAMMER 900 m out at 40 degrees; player at 45 m/s straight or turning
  // 0.1 / 0.3 rad/s for 120 s; from t = 15 s take the share of steps where the Jammer is
  // 300-500 m from the Fighters' centroid and within 45 degrees behind it as seen from the player.
  it.fails(
    'behind three Fighters, it holds the station at least 60 % of the time against a straight, gently turning or circling player',
    () => {
      const misses: string[] = [];
      for (const seed of [1, 2, 3]) {
        for (const yaw of [0, 0.1, 0.3]) {
          const share = stationShare(
            [EnemyType.FIGHTER, EnemyType.FIGHTER, EnemyType.FIGHTER],
            yaw,
            seed
          );
          if (share < 0.6)
            misses.push(`seed ${seed}, turn ${yaw} rad/s: ${(share * 100).toFixed(0)} %`);
        }
      }
      expect(misses).toEqual([]);
    }
  );
});

describe('JAMMER jamming through the real enemy system (spec §3; §3a: one step late is accepted)', () => {
  it('with no Jammer about, the lock time is normal, whatever else is close', () => {
    const rig = systemRig(10, 4);
    rig.pilot = (active) => active.turnPlayer(0.2 * DT);
    ARMED_TYPES.forEach((type, index) =>
      rig.spawn(type, pointAround(rig.player, 150 + index * 80, index * 50 * DEG))
    );
    expect(rig.system.getLockTimeScale()).toBe(1);
    rig.run(30, () => {
      expect(rig.system.getLockTimeScale()).toBe(1);
    });
  });

  it.each([150, 400, 700, 780])('a lone Jammer %i m away doubles the lock time', (distance) => {
    const rig = systemRig(6, 5);
    const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, distance, 100 * DEG));
    rig.run(2 * DT);
    expect(jammer.getMesh().position.distanceTo(rig.player.position)).toBeLessThan(JAM_RANGE);
    expect(rig.system.getLockTimeScale()).toBe(2);
  });

  it.each([820, 1000, 1500])('a lone Jammer %i m away does nothing', (distance) => {
    const rig = systemRig(6, 5);
    const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, distance, 100 * DEG));
    rig.run(2 * DT);
    expect(jammer.getMesh().position.distanceTo(rig.player.position)).toBeGreaterThan(JAM_RANGE);
    expect(rig.system.getLockTimeScale()).toBe(1);
  });

  it.each([2, 3])('%i Jammers in range still make it exactly 2x (not stacking)', (count) => {
    const rig = systemRig(8, 6);
    for (let i = 0; i < count; i++) {
      rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 300 + i * 150, (i * 90 + 30) * DEG));
    }
    rig.run(10, () => {
      expect(jammerInRange(rig)).toBe(true);
      expect(rig.system.getLockTimeScale()).toBe(2);
    });
  });

  it.each([
    ['straight', 0],
    ['gently turning', 0.1],
    ['circling', 0.3],
  ] as const)(
    'in a 120 s fight against a %s player, the lock time is 2x exactly when a living Jammer is within 800 m (on that step or the one before)',
    (_name, yaw) => {
      const rig = systemRig(6, 7);
      rig.pilot = (active) => active.turnPlayer(yaw * DT);
      [EnemyType.FIGHTER, EnemyType.FIGHTER, EnemyType.FIGHTER].forEach((type, index) =>
        rig.spawn(type, pointAround(rig.player, 600, (20 + index * 25) * DEG))
      );
      rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 900, 40 * DEG));
      let before = jammerInRange(rig);
      const states = { jammed: 0, clear: 0 };
      const wrong: string[] = [];
      rig.run(120, () => {
        const now = jammerInRange(rig);
        const scale = rig.system.getLockTimeScale();
        const allowed = new Set([now ? 2 : 1, before ? 2 : 1]);
        if (!allowed.has(scale)) wrong.push(`${rig.time.toFixed(2)} s: ${scale}`);
        if (now) states.jammed++;
        else states.clear++;
        before = now;
      });
      expect(wrong).toEqual([]);
      expect(states.jammed, 'steps with a Jammer in range').toBeGreaterThan(0);
      if (yaw === 0) expect(states.clear, 'steps without one').toBeGreaterThan(0);
    }
  );

  describe('the effect ends when the last Jammer in range dies', () => {
    it('one Jammer shot down: normal lock time by the next step', () => {
      const rig = systemRig(6, 8);
      const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 500, 60 * DEG));
      rig.run(3);
      expect(rig.system.getLockTimeScale()).toBe(2);
      jammer.takeDamage(jammer.getConfig().health * 10);
      expect(jammer.isAlive()).toBe(false);
      rig.step();
      expect(rig.system.getLockTimeScale()).toBe(1);
      rig.run(5, () => {
        expect(rig.system.getLockTimeScale()).toBe(1);
      });
    });

    it('two in range, one shot down: still 2x; the second shot down: normal by the next step', () => {
      const rig = systemRig(6, 9);
      const first = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 400, 60 * DEG));
      const second = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 500, -80 * DEG));
      rig.run(3);
      first.takeDamage(1e6);
      rig.run(3, () => {
        expect(jammerInRange(rig)).toBe(true);
        expect(rig.system.getLockTimeScale()).toBe(2);
      });
      second.takeDamage(1e6);
      rig.step();
      expect(rig.system.getLockTimeScale()).toBe(1);
    });

    it('the one in range shot down while another is beyond 800 m: normal by the next step', () => {
      const rig = systemRig(6, 10);
      const near = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 400, 60 * DEG));
      const far = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 1400, -80 * DEG));
      rig.run(1);
      expect(far.getMesh().position.distanceTo(rig.player.position)).toBeGreaterThan(JAM_RANGE);
      near.takeDamage(1e6);
      rig.step();
      expect(rig.system.getLockTimeScale()).toBe(1);
    });
  });

  it('the effect ends when the last Jammer leaves 800 m: normal on that step or the next', () => {
    // 玩家以 120 米/秒直线飞离身后 600 米的干扰机：几秒后就出了 800 米
    EventBus.clear();
    useSeed(11);
    system?.dispose();
    const rig = new SystemRig({ level: 6, difficulty: 3, playerSpeed: 120 });
    system = rig;
    rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 600, 180 * DEG));
    rig.run(0.5);
    expect(rig.system.getLockTimeScale()).toBe(2);
    let leftAt = -1;
    let normalAt = -1;
    let step = 0;
    rig.run(10, () => {
      step++;
      if (leftAt < 0 && !jammerInRange(rig)) leftAt = step;
      if (leftAt >= 0 && normalAt < 0 && rig.system.getLockTimeScale() === 1) normalAt = step;
      return normalAt >= 0 && step > normalAt + 30;
    });
    expect(leftAt, 'left 800 m').toBeGreaterThan(0);
    expect(normalAt - leftAt).toBeGreaterThanOrEqual(0);
    expect(normalAt - leftAt).toBeLessThanOrEqual(1);
    expect(rig.system.getLockTimeScale()).toBe(1);
  });
});
