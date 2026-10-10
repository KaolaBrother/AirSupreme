import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
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
 * “自己的编队”（里程碑 3 起）：和它同一路到场（编组号相同）的其余存活敌机的平均位置；那一路
 * 没有别的敌机了、或它不属于任何一路（测试台用 spawn 直接生成的敌机）时，退回到场上其余
 * 非干扰机敌机的平均位置（已接受的出入）。
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

function systemRig(level = 6, seed = 1, playerSpeed?: number): SystemRig {
  system?.dispose();
  EventBus.clear();
  useSeed(seed);
  system = new SystemRig({ level, difficulty: 3, playerSpeed });
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

/** 这些敌机里存活的非干扰机的平均位置；没有为 null */
function centroidOf(jets: readonly EnemyAI[], out = new THREE.Vector3()): THREE.Vector3 | null {
  out.set(0, 0, 0);
  let count = 0;
  for (const jet of jets) {
    if (!jet.isAlive() || jet.getConfig().type === EnemyType.JAMMER) continue;
    out.add(jet.getMesh().position);
    count++;
  }
  return count > 0 ? out.multiplyScalar(1 / count) : null;
}

/** 其余（非干扰机）存活敌机的平均位置；没有为 null */
function centroidOfOthers(rig: SystemRig, out = new THREE.Vector3()): THREE.Vector3 | null {
  return centroidOf(rig.jets, out);
}

/**
 * 记下 EnemySystem 每一步交给干扰机的编队中心，以及同一时刻 expected() 算出的应有值
 * （仍调用原方法，不改变它的行为）
 */
function recordGroupCenters(rig: SystemRig, jammer: EnemyAI, expected: () => THREE.Vector3 | null) {
  const original = jammer.setGroupCenter.bind(jammer);
  const calls: Array<{
    time: number;
    given: THREE.Vector3 | null;
    expected: THREE.Vector3 | null;
  }> = [];
  vi.spyOn(jammer, 'setGroupCenter').mockImplementation((center) => {
    const want = expected();
    calls.push({
      time: rig.time,
      given: center ? center.clone() : null,
      expected: want ? want.clone() : null,
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
  return { calls, check };
}

describe('JAMMER: HP 120, unarmed, slow (spec §3)', () => {
  it('has 120 HP at base and is slower than the player’s base top speed (45 m/s) and than every armed type but the Heavy', () => {
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

describe('JAMMER station behind its own group (spec §3; own group = the jets it arrived with, else the other jets)', () => {
  it('outside any wave group, the enemy system gives it, every step, the mean position of the other living jets — and none when they are all dead', () => {
    const rig = systemRig(6, 3);
    const others = [EnemyType.FIGHTER, EnemyType.SCOUT, EnemyType.SNIPER].map((type, index) =>
      rig.spawn(type, pointAround(rig.player, 500, (index * 60 - 30) * DEG))
    );
    const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 800, 0));
    const { calls, check } = recordGroupCenters(rig, jammer, () => centroidOfOthers(rig));

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

  it('in a wave group (as a pincer side arrives), it gets the mean position of its own side, not of the other side; once its side is down, the other jets', () => {
    const rig = systemRig(6, 3);
    const ownSide = [EnemyType.SNIPER, EnemyType.STRIKER].map((type, index) =>
      rig.spawn(type, pointAround(rig.player, 500, (index * 40 + 10) * DEG))
    );
    const otherSide = [EnemyType.FIGHTER, EnemyType.FIGHTER].map((type, index) =>
      rig.spawn(type, pointAround(rig.player, 500, (index * 40 - 150) * DEG))
    );
    const jammer = rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 800, 30 * DEG));
    // 与 LevelManager 给一波里的两路编组号的方式一样：同一路同一个号，两路不同
    for (const jet of [...ownSide, jammer]) jet.setGroupId(3);
    for (const jet of otherSide) jet.setGroupId(4);
    const { check } = recordGroupCenters(rig, jammer, () =>
      ownSide.some((jet) => jet.isAlive()) ? centroidOf(ownSide) : centroidOfOthers(rig)
    );

    rig.run(5);
    check('own side alive');

    ownSide[0].takeDamage(1e6);
    rig.run(3);
    check('one of its side shot down');

    ownSide[1].takeDamage(1e6);
    rig.run(3);
    check('its side all shot down');
  });

  /**
   * 编队的站位：从第 15 秒起，干扰机离编队中心 300–500 米，并且编队挡在它和玩家之间
   * （从编队中心看，干扰机在“玩家 → 编队中心”方向两侧 45 度以内，而且比编队离玩家更远）
   * 的时间占比。规格没有给干扰机单独的量法，借用 §3a 狙击机距离带的量法：迎着巡航速度直飞
   * 或缓转的玩家，至少 60 %。
   */
  function stationShare(group: EnemyType[], yaw: number, seed: number, playerSpeed: number) {
    const rig = systemRig(6, seed, playerSpeed);
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

  /**
   * 玩家的“巡航速度”：不推油门时稳定在最大速度的一半——基础机 22.5 米/秒，速度升满
   * （45 + 10 × 4 = 85）时 42.5 米/秒。两头各量一次：22.5 米/秒，以及 45 米/秒（基础机的极速，
   * 略高于升满时的巡航；本文件和舰队测试台其余的距离带测试都按这个速度飞）
   */
  const PLAYER_SPEEDS = [22.5, 45] as const;
  /** §3a 量法的范围：直飞与缓转（0.1 rad/s） */
  const STRAIGHT_OR_GENTLE = [0, 0.1] as const;
  const SEEDS = [1, 2, 3, 4, 5, 6] as const;

  /** 这些速度 × 转向 × 种子下守不住（< 60 %）的那几次 */
  function stationMisses(group: EnemyType[], speeds: readonly number[]) {
    const misses: string[] = [];
    for (const speed of speeds) {
      for (const yaw of STRAIGHT_OR_GENTLE) {
        for (const seed of SEEDS) {
          const share = stationShare(group, yaw, seed, speed);
          if (share < 0.6) {
            misses.push(
              `${speed} m/s, turn ${yaw} rad/s, seed ${seed}: ${(share * 100).toFixed(0)} %`
            );
          }
        }
      }
    }
    return misses;
  }

  const THREE_FIGHTERS = [EnemyType.FIGHTER, EnemyType.FIGHTER, EnemyType.FIGHTER];
  const MIXED = [EnemyType.SNIPER, EnemyType.STRIKER, EnemyType.FIGHTER];

  /*
   * 不量绕圈（0.3 rad/s）：它不在借用的 §3a 量法范围内（只有直飞与缓转），而且做不到——
   * 玩家以 45 米/秒绕圈时，编队中心后方 400 米那个点跟着编队绕玩家转，实测每秒移动 123–182 米
   * （四分位，中位 143–152 米/秒；直飞 / 缓转时中位 54–73 米/秒），§2 规则 6 只许干扰机飞到
   * 1.3 × 38 = 49.4 米/秒，没有哪种飞法守得住。
   */

  // 第 6 关“干扰机 + 打击机”那一波的编成（两架战斗机、两架打击机、一架干扰机，一路到场）
  it('behind two Fighters and two Strikers (the level 6 Jammer + Strikers wave), it holds the station at least 60 % of the time against a straight or gently turning player at 22.5 or 45 m/s', () => {
    expect(
      stationMisses(
        [EnemyType.FIGHTER, EnemyType.FIGHTER, EnemyType.STRIKER, EnemyType.STRIKER],
        PLAYER_SPEEDS
      )
    ).toEqual([]);
  });

  // 三架战斗机、玩家 45 米/秒：里程碑 2 时记为已知失败（直飞 2–3 %、缓转 0 %，离编队 560–670 米），
  // 4d91d40 重写了站位后直飞 99–100 %、缓转 87–92 %。22.5 米/秒见下面的 FINDING
  it('behind three Fighters, it holds the station at least 60 % of the time against a straight or gently turning player at 45 m/s', () => {
    expect(stationMisses(THREE_FIGHTERS, [45])).toEqual([]);
  });

  // 狙击机 + 打击机 + 战斗机、玩家 22.5 米/秒：63–94 %。45 米/秒见下面的 FINDING
  it('behind a Sniper, a Striker and a Fighter, it holds the station at least 60 % of the time against a straight or gently turning player at 22.5 m/s', () => {
    expect(stationMisses(MIXED, [22.5])).toEqual([]);
  });

  // FINDING: spec §3 JAMMER — "Keeps 300–500 m behind its own group, with the group between
  // itself and the player". The spec gives no separate measure; measured like spec §3a's Sniper
  // standoff band (at least 60 % of the time against a player flying straight at cruise speed or
  // turning gently, from t = 15 s), a Jammer whose group is a Sniper, a Striker and a Fighter does
  // not hold it against a fast player: at 45 m/s, 5 of 12 runs are under 60 % (seeds 1-6 at
  // 2162554): straight seeds 2 / 5 / 6 at 30 / 30 / 34 %, 0.1 rad/s seeds 1 / 4 at 59 / 30 %; at
  // 42.5 m/s (the cruise speed of a jet with its speed upgrades maxed) 3 of 12: 0.1 rad/s seeds
  // 1 / 3 / 4 at 59 / 59 / 26 %; at 40 m/s 2 of 12 (59 / 59 %); at 22.5 and 35 m/s none. In the
  // 45 m/s straight misses the group's centre stands ~350-370 m from the player (the Sniper and
  // the Striker keep their standoff) and the Jammer trails its station: a median 524-540 m from
  // the centre, more than 500 m for 61-64 % of the time, and so outside its own 800 m jamming
  // range for 71-84 % of the run. In the 0.1 rad/s seed-4 miss it is at the right distance but
  // not behind the group (outside 45 degrees of the player -> group line) for 70 % of the time.
  // Minor: tens of metres past the band at the median, and only against fast players; its side
  // effect is that it rarely jams them. The group is right: these jets are spawned outside any
  // wave, so the enemy system hands the Jammer the centroid of all other living jets — the point
  // this test measures from (checked by the first test in this block). Reproduce: SystemRig({
  // level: 6, difficulty: 3, playerSpeed: 45 }) with Math.random = seededGameRandom(seed); a
  // SNIPER, a STRIKER and a FIGHTER 600 m out at 20, 45 and 70 degrees, one JAMMER 900 m out at
  // 40 degrees; player straight or turning 0.1 rad/s for 120 s; from t = 15 s take the share of
  // steps where the Jammer is 300-500 m from the others' centroid and within 45 degrees behind it
  // as seen from the player.
  it.fails(
    'behind a Sniper, a Striker and a Fighter, it holds the station at least 60 % of the time against a straight or gently turning player at 45 m/s',
    () => {
      expect(stationMisses(MIXED, [45])).toEqual([]);
    }
  );

  // FINDING: spec §3 JAMMER — "Keeps 300–500 m behind its own group, with the group between
  // itself and the player". Measured as above (spec §3a's measure, at least 60 %), a Jammer whose
  // group is three Fighters does not hold it against a player turning gently at the base cruise
  // speed: at 22.5 m/s and 0.1 rad/s, seeds 1 / 3 are at 57 / 42 % (seeds 2, 4, 5, 6: 66-73 %);
  // straight at 22.5 m/s it is 89-94 %, and at 45 m/s 87-100 % (seeds 1-6 at 2162554). The
  // distance is right (median 353 m from the centre, outside 300-500 m for 7-19 % of the time);
  // it is the "group between itself and the player" half that fails: the Fighters sit close
  // behind the slow-turning player, the player -> group line swings, and the Jammer is more than
  // 45 degrees off it for 38 / 45 % of the time. Minor. Reproduce: as above with playerSpeed
  // 22.5, three FIGHTERs 600 m out at 20, 45 and 70 degrees, the player turning 0.1 rad/s.
  it.fails(
    'behind three Fighters, it holds the station at least 60 % of the time against a straight or gently turning player at 22.5 m/s',
    () => {
      expect(stationMisses(THREE_FIGHTERS, [22.5])).toEqual([]);
    }
  );

  /*
   * 没有测的情形（规格问题，见报告）：一路只有打击机的干扰机（第 5 关第 6 波
   * pincer([STRIKER, STRIKER, JAMMER], …)）。规格 §3 打击机“stays 450–700 m out”，干扰机在它们
   * 身后 300–500 米，就是离玩家 750–1200 米；§2 规则 4 拴绳在 900 米把它直线拉回。两条规则只在
   * 很窄的一段上同时成立（打击机 ≤ 600 米、干扰机贴着 300 米），测哪一边都等于替规格做选择。
   * 2162554 上（种子 1，玩家 45 米/秒）：直飞 7 %（90 % 的时间离玩家 850 米以上、42 % 的时间被
   * 拴绳拉回，不在 800 米干扰半径内），缓转 13 %、绕圈 37 %（被拉近到离编队不足 300 米）。
   */
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
