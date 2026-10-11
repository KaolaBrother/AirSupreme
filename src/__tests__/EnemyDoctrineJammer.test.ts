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
  bearingGap,
  bearingOf,
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
 * 站位不出干扰半径（§3a，收尾后的负责人决定）：它飞向的站位点离玩家（三维距离）永远不超过
 * 650 米；编队远到“身后 300–500 米”会超出时，650 米优先，它坐得离编队更近、或与编队齐平。
 * 迎着巡航速度直飞或缓转的玩家，有编队的干扰机到位以后至少 85 % 的时间在玩家 800 米内。
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
/** 站位点离玩家的上限（米，三维距离；规格 §3a） */
const STATION_CAP = 650;
/**
 * 干扰机跟着站位点飞时允许落后的余量（米）：量的是机身离玩家的距离，不是站位点。
 * 650 + 100 = 750 米，仍在 800 米干扰半径以内 50 米
 */
const STATION_LAG = 100;

/**
 * 玩家的“巡航速度”：不推油门时稳定在最大速度的一半——基础机 22.5 米/秒，速度升满
 * （45 + 10 × 4 = 85）时 42.5 米/秒。两头各量一次：22.5 米/秒，以及 45 米/秒（基础机的极速，
 * 略高于升满时的巡航；本文件和舰队测试台其余的距离带测试都按这个速度飞）
 */
const PLAYER_SPEEDS = [22.5, 45] as const;
/**
 * §3a 干扰半径量法写的是“巡航速度”：两头各量一次，22.5 米/秒与 42.5 米/秒（速度升满时的巡航），
 * 不用 45 米/秒（那已经是基础机的极速，超出了巡航）
 */
const CRUISE_SPEEDS = [22.5, 42.5] as const;
/** §3a 量法的范围：直飞与缓转（0.1 rad/s） */
const STRAIGHT_OR_GENTLE = [0, 0.1] as const;
const SEEDS = [1, 2, 3, 4, 5, 6] as const;
/** “到位”：从第 15 秒起计（干扰机从 900 米外出发；站位量法与干扰半径量法都从这里起计） */
const SETTLE_SECONDS = 15;

const THREE_FIGHTERS = [EnemyType.FIGHTER, EnemyType.FIGHTER, EnemyType.FIGHTER];

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
 * 站位量法的起点：编队离玩家 600 米、方位 20° 起每架隔 25°；干扰机 900 米、40°（在任何一波之外
 * 生成，所以它的编队就是其余存活敌机）
 */
function spawnGroupAndJammer(rig: SystemRig, group: readonly EnemyType[]): EnemyAI {
  group.forEach((type, index) =>
    rig.spawn(type, pointAround(rig.player, 600, (20 + index * 25) * DEG))
  );
  return rig.spawn(EnemyType.JAMMER, pointAround(rig.player, 900, 40 * DEG));
}

function percent(share: number): string {
  return `${(share * 100).toFixed(0)} %`;
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
   * 编队的站位：从第 15 秒起“守住站位”的时间占比。规格没有给干扰机单独的量法，借用 §3a 狙击机
   * 距离带的量法：迎着巡航速度直飞或缓转的玩家，至少 60 %。每一步按编队中心离玩家多远分两种
   * （§3a “Jammer station stays inside jam range”）：
   * - 放得下（编队中心正后方 300 米那一点离玩家不超过 650 米）：仍要身后 300–500 米、编队挡在它
   *   和玩家之间——从编队中心看，干扰机在“玩家 → 编队中心”方向两侧 45 度以内，而且比编队离
   *   玩家更远；
   * - 放不下：650 米优先，它坐得离编队更近、或与编队齐平。除了上面那一片，也接受：从玩家看它在
   *   编队方位两侧 30 度以内（身后 300–500 米、45 度那一片从玩家看也就这么宽），离玩家不比编队
   *   近 50 米以上（编队在 650 米以外时，不比 650 米近 50 米以上）。
   * 两种都要它离玩家不超过 650 + 100 米（站位点的上限加跟随的滞后）。
   */
  function stationShare(
    group: readonly EnemyType[],
    yaw: number,
    seed: number,
    playerSpeed: number
  ): { held: number; bandDidNotFit: number } {
    const rig = systemRig(6, seed, playerSpeed);
    rig.pilot = (active) => active.turnPlayer(yaw * DT);
    const jammer = spawnGroupAndJammer(rig, group);
    const center = new THREE.Vector3();
    const groupToJammer = new THREE.Vector3();
    const playerToGroup = new THREE.Vector3();
    const nearEdge = new THREE.Vector3();
    let counted = 0;
    let held = 0;
    let bandDidNotFit = 0;
    rig.run(120, () => {
      if (rig.time < SETTLE_SECONDS) return;
      if (!centroidOfOthers(rig, center)) return;
      const jammerPosition = jammer.getMesh().position;
      const player = rig.player.position;
      groupToJammer.set(jammerPosition.x - center.x, 0, jammerPosition.z - center.z);
      playerToGroup.set(center.x - player.x, 0, center.z - player.z);
      const jammerRange = jammerPosition.distanceTo(player);
      const groupRange = center.distanceTo(player);
      const gap = groupToJammer.length();
      const inBand =
        gap >= BEHIND_MIN &&
        gap <= BEHIND_MAX &&
        groupToJammer.angleTo(playerToGroup) <= 45 * DEG &&
        jammerRange > groupRange;
      // 编队中心正后方 300 米那一点（沿水平的“玩家 → 编队中心”方向，与编队中心同高）
      const axisLength = playerToGroup.length();
      nearEdge.copy(center);
      if (axisLength > 1e-6) nearEdge.addScaledVector(playerToGroup, BEHIND_MIN / axisLength);
      const bandFits = nearEdge.distanceTo(player) <= STATION_CAP;
      const closerOrLevel =
        !bandFits &&
        bearingGap(bearingOf(player, jammerPosition), bearingOf(player, center)) <= 30 * DEG &&
        jammerRange >= Math.min(groupRange, STATION_CAP) - 50;
      counted++;
      if (!bandFits) bandDidNotFit++;
      if (jammerRange <= STATION_CAP + STATION_LAG && (inBand || closerOrLevel)) held++;
    });
    expect(counted).toBeGreaterThan(5000);
    return { held: held / counted, bandDidNotFit: bandDidNotFit / counted };
  }

  /** 这些速度 × 转向 × 种子下守不住（< 60 %）的那几次 */
  function stationMisses(group: readonly EnemyType[], speeds: readonly number[]) {
    const misses: string[] = [];
    for (const speed of speeds) {
      for (const yaw of STRAIGHT_OR_GENTLE) {
        for (const seed of SEEDS) {
          const { held, bandDidNotFit } = stationShare(group, yaw, seed, speed);
          if (held < 0.6) {
            misses.push(
              `${speed} m/s, turn ${yaw} rad/s, seed ${seed}: ${percent(held)} ` +
                `(band did not fit inside 650 m for ${percent(bandDidNotFit)} of the time)`
            );
          }
        }
      }
    }
    return misses;
  }

  const MIXED = [EnemyType.SNIPER, EnemyType.STRIKER, EnemyType.FIGHTER];

  /*
   * 不量绕圈（0.3 rad/s）：它不在借用的 §3a 量法范围内（只有直飞与缓转），而且做不到——
   * 玩家以 45 米/秒绕圈时，编队中心后方 400 米那个点跟着编队绕玩家转，实测每秒移动 123–182 米
   * （四分位，中位 143–152 米/秒；直飞 / 缓转时中位 54–73 米/秒），§2 规则 6 只许干扰机飞到
   * 1.3 × 38 = 49.4 米/秒，没有哪种飞法守得住。
   */

  /*
   * 下面两条在 10ce5a1（650 米上限之前的站位）上是红的：编队远到身后 300–500 米放不下时，干扰机
   * 仍坐在编队身后 350 米，离玩家超过 650 + 100 米。两架战斗机 + 两架打击机：6 / 24 次不到 60 %
   * （47–59 %）；狙击机 + 打击机 + 战斗机、22.5 米/秒：缓转 4 / 6 次（42–59 %）。站位点只多一步
   * “钳到离玩家 650 米以内”的临时探针（已撤回）两条都过。
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

  // 狙击机 + 打击机 + 战斗机、玩家 22.5 米/秒。45 米/秒见下面的 FINDING
  it('behind a Sniper, a Striker and a Fighter, it holds the station at least 60 % of the time against a straight or gently turning player at 22.5 m/s', () => {
    expect(stationMisses(MIXED, [22.5])).toEqual([]);
  });

  // FINDING (re-judged against the owner's 650 m decision, spec §3a "Jammer station stays inside
  // jam range"; still a known failure, it may turn green with that change): spec §3 JAMMER —
  // "Keeps 300–500 m behind its own group, with the group between itself and the player". The
  // spec gives no separate measure; measured like spec §3a's Sniper standoff band (at least 60 %
  // of the time against a player flying straight or turning gently, from t = 15 s), with the band
  // demanded where it fits inside 650 m and the cap accepted where it does not (see stationShare),
  // a Jammer whose group is a Sniper, a Striker and a Fighter does not hold it against a player at
  // 45 m/s (the base top speed, just above the 42.5 m/s cruise of a jet with its speed upgrades
  // maxed): on 10ce5a1, 9 of 12 runs are under 60 % — straight seeds 1-6 at 47 / 6 / 49 / 47 / 7 /
  // 6 %, 0.1 rad/s seeds 1 / 3 / 4 at 37 / 36 / 17 %. What the old text described is now also a
  // breach of the cap: in the straight seed 2 / 5 / 6 misses the group's centre stands ~350-370 m
  // out (the Sniper and the Striker keep their standoff), its station 350 m behind that is beyond
  // 650 m, and the Jammer flies at full throttle a median 837-864 m from the player, outside its
  // own 800 m jamming range for 71-84 % of the run. The cap should remove most of it: a temporary
  // probe that only clamped the station to 650 m from the player (reverted) lifted straight seeds
  // 1 / 3 / 4 to 84-87 %, but 5 of 12 runs still missed — straight seeds 2 / 5 at 24 / 23 % (at
  // full throttle it trails a station at the cap behind a 45 m/s player by about 100 m, a median
  // 753-759 m out) and 0.1 rad/s seeds 1 / 3 / 4 at 41 / 47 / 19 % (where the band fits, it is
  // mostly not behind its group: like the next FINDING). Minor. The group is right: these jets are spawned
  // outside any wave, so the enemy system hands the Jammer the centroid of all other living jets —
  // the point this test measures from (checked by the first test in this block). Reproduce:
  // SystemRig({ level: 6, difficulty: 3, playerSpeed: 45 }) with Math.random =
  // seededGameRandom(seed); a SNIPER, a STRIKER and a FIGHTER 600 m out at 20, 45 and 70 degrees,
  // one JAMMER 900 m out at 40 degrees; player straight or turning 0.1 rad/s for 120 s; from
  // t = 15 s take the share of steps that stationShare counts as held.
  it.fails(
    'behind a Sniper, a Striker and a Fighter, it holds the station at least 60 % of the time against a straight or gently turning player at 45 m/s',
    () => {
      expect(stationMisses(MIXED, [45])).toEqual([]);
    }
  );

  // FINDING (re-judged against the owner's 650 m decision: untouched by it, still a known failure):
  // spec §3 JAMMER — "Keeps 300–500 m behind its own group, with the group between itself and the
  // player". Measured as above (at least 60 %), a Jammer whose group is three Fighters does not
  // hold it against a player turning gently at the base cruise speed: at 22.5 m/s and 0.1 rad/s,
  // seeds 1 / 3 are at 57 / 42 % (seeds 2, 4, 5, 6: 66-73 %); straight at 22.5 m/s it is
  // 89-94 % (seeds 1-6 on 10ce5a1, the same as at 2162554). The Fighters sit 130-160 m from the
  // player (median), so the band always fits inside 650 m and the cap never applies; the Jammer
  // is 420-550 m from the player. The distance is right (median 353 m from the centre, outside
  // 300-500 m for 7-19 % of the time at 2162554); it is the "group between itself and the player"
  // half that fails: the Fighters sit close behind the slow-turning player, the player -> group
  // line swings, and the Jammer is more than 45 degrees off it for 38 / 45 % of the time. Minor.
  // Reproduce: as above with playerSpeed 22.5, three FIGHTERs 600 m out at 20, 45 and 70 degrees,
  // the player turning 0.1 rad/s.
  it.fails(
    'behind three Fighters, it holds the station at least 60 % of the time against a straight or gently turning player at 22.5 m/s',
    () => {
      expect(stationMisses(THREE_FIGHTERS, [22.5])).toEqual([]);
    }
  );

  /*
   * 一路只有打击机的干扰机：以前没有测（打击机“stays 450–700 m out”，身后 300–500 米就是离玩家
   * 750–1200 米，规格没说听哪一条）。§3a 的 650 米上限回答了它：见下一组的干扰半径量法与
   * “编队停在远处”。
   */
});

describe('JAMMER station stays inside jam range (spec §3a, owner decision after the close-out)', () => {
  /**
   * 有编队的干扰机在玩家 800 米内的时间占比，从第 15 秒（视为已到位）起计。编队和干扰机的起点
   * 与上面的站位量法相同；没有人向编队开火，它一直都在
   */
  function inRangeShare(
    group: readonly EnemyType[],
    yaw: number,
    seed: number,
    playerSpeed: number
  ): number {
    const rig = systemRig(6, seed, playerSpeed);
    rig.pilot = (active) => active.turnPlayer(yaw * DT);
    const jammer = spawnGroupAndJammer(rig, group);
    const center = new THREE.Vector3();
    let counted = 0;
    let inRange = 0;
    rig.run(120, () => {
      if (rig.time < SETTLE_SECONDS) return;
      if (!centroidOfOthers(rig, center)) return;
      counted++;
      if (jammer.getMesh().position.distanceTo(rig.player.position) <= JAM_RANGE) inRange++;
    });
    expect(counted, 'steps with its group alive').toBeGreaterThan(5000);
    return inRange / counted;
  }

  /** 这些速度 × 转向 × 种子下不到 85 % 的那几次 */
  function inRangeMisses(group: readonly EnemyType[]): string[] {
    const misses: string[] = [];
    for (const speed of CRUISE_SPEEDS) {
      for (const yaw of STRAIGHT_OR_GENTLE) {
        for (const seed of SEEDS) {
          const share = inRangeShare(group, yaw, seed, speed);
          if (share < 0.85) {
            misses.push(`${speed} m/s, turn ${yaw} rad/s, seed ${seed}: ${percent(share)}`);
          }
        }
      }
    }
    return misses;
  }

  // 10ce5a1 上（650 米上限之前）：两架狙击机 42.5 米/秒有 4 / 24 次不到 85 %（46–77 %），两架打击机
  // 24 / 24 次（0–39 %）；三架战斗机贴着玩家，本来就过。站位点钳到离玩家 650 米以内的临时探针
  // （已撤回）三组都过；同一探针在 45 米/秒（超出巡航）下两架狙击机直飞有 2 次只到 69–70 %
  it.each([
    ['two Snipers', [EnemyType.SNIPER, EnemyType.SNIPER]],
    ['two Strikers (a side of only Strikers)', [EnemyType.STRIKER, EnemyType.STRIKER]],
    ['three Fighters', THREE_FIGHTERS],
  ] as const)(
    'behind %s, once at its station it is within 800 m of the player at least 85 % of the time against a straight or gently turning player at cruise speed (22.5 or 42.5 m/s)',
    (_name, group) => {
      expect(inRangeMisses(group)).toEqual([]);
    }
  );

  /**
   * 编队停在远处：编队中心与玩家保持固定的（世界坐标）偏移，跟着玩家一起飞，离玩家 700、800 或
   * 900 米，方位取正前、右前、正右、右后、正后、正左，与玩家同高或高 150 米。FleetRig 里只飞这一架
   * 干扰机，每步在它更新之前把这个点作为编队中心交给它（EnemySystem 用的是同一个入口
   * setGroupCenter）。干扰机在编队中心处现身（和它那一路一起到场）。
   * 要求：90 秒内飞进 650 + 100 米（离玩家，三维距离）；进来以后直到第 150 秒，一步也不再出去；
   * 进来以后至少 60 % 的时间在编队方位（从玩家看）两侧 30 度以内——650 米优先，但它仍守在自己
   * 编队那一边（“坐得离编队更近、或与编队齐平”），不是随便在哪儿绕着玩家转。
   */
  const PARKED_DISTANCES = [700, 800, 900] as const;
  const PARKED_BEARINGS_DEG = [0, 45, 90, 135, 180, -90] as const;
  const PARKED_HEIGHTS = [0, 150] as const;

  /** 停在远处的一次；守住了返回 null，否则返回这一次的说明 */
  function parkedMiss(
    distance: number,
    bearingDeg: number,
    height: number,
    playerSpeed: number,
    yaw: number
  ): string | null {
    fleet?.dispose();
    fleet = new FleetRig({ level: 6, capacity: 4, seed: 11, playerSpeed });
    const rig = fleet;
    const offset = pointAround(rig.player, distance, bearingDeg * DEG, height).sub(
      rig.player.position
    );
    const center = rig.player.position.clone().add(offset);
    const jammer = rig.addJet(EnemyType.JAMMER, center.clone());
    rig.pilot = (active) => {
      active.turnPlayer(yaw * DT);
      center.copy(active.player.position).add(offset);
      jammer.setGroupCenter(center);
    };
    const limit = STATION_CAP + STATION_LAG;
    let enteredAt = -1;
    let worst = 0;
    let after = 0;
    let onBearing = 0;
    rig.run(150, () => {
      const position = jammer.getMesh().position;
      const player = rig.player.position;
      const range = position.distanceTo(player);
      if (enteredAt < 0) {
        if (range <= limit) enteredAt = rig.time;
        return;
      }
      after++;
      worst = Math.max(worst, range);
      if (bearingGap(bearingOf(player, position), bearingOf(player, center)) <= 30 * DEG) {
        onBearing++;
      }
    });
    const label =
      `group ${distance} m out at ${bearingDeg}°, ${height} m above, ` +
      `player ${playerSpeed} m/s turning ${yaw} rad/s`;
    if (enteredAt < 0 || enteredAt > 90) {
      const range = jammer.getMesh().position.distanceTo(rig.player.position);
      return `${label}: not inside ${limit} m by 90 s (at 150 s: ${range.toFixed(0)} m)`;
    }
    if (worst > limit || onBearing / after < 0.6) {
      return (
        `${label}: inside ${limit} m at ${enteredAt.toFixed(1)} s, then out to ` +
        `${worst.toFixed(0)} m; on its group's bearing ${percent(onBearing / after)}`
      );
    }
    return null;
  }

  // 10ce5a1 上一种也守不住：它坐在编队身后 350 米，离玩家 800–970 米（900 米的拴绳把它拉回一些）。
  // 站位点钳到离玩家 650 米以内的临时探针（已撤回）全部守住
  it.each([
    [22.5, 0],
    [22.5, 0.1],
    [45, 0],
    [45, 0.1],
  ] as const)(
    'a group parked 700–900 m out does not drag it beyond 650 m plus 100 m of lag, and it keeps to its group’s side (player at %s m/s, turning %s rad/s)',
    (speed, yaw) => {
      const misses: string[] = [];
      for (const distance of PARKED_DISTANCES) {
        for (const bearing of PARKED_BEARINGS_DEG) {
          for (const height of PARKED_HEIGHTS) {
            const miss = parkedMiss(distance, bearing, height, speed, yaw);
            if (miss) misses.push(miss);
          }
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
