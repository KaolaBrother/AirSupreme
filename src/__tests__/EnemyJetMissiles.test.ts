import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import {
  getJetMissileCap,
  grantJetMissiles,
  type IMissileJet,
} from '@/features/enemy/MissileDirector';
import {
  DEG,
  DT,
  FleetRig,
  SIM_TEST_TIMEOUT,
  SystemRig,
  angleBetween,
  groupBursts,
  pointAround,
  seededGameRandom,
  seededRandom,
  type RigLaunch,
  type SystemRigOptions,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 敌机的追踪导弹（规格 §3 ACE / STRIKER、§2.9、§3a），批次 E-X 里程碑 2。
 *
 * - 只有王牌（ACE）和导弹机（STRIKER）发射导弹；
 * - 一次发射需要攻击令牌和一个全队导弹名额；“在飞的敌机导弹 + 各机手里的名额”全队上限：
 *   1–5 关 1 枚，6–10 关 2 枚，Boss 战 0，玩家不可被攻击时 0；
 * - 每次发射之前都有一段锁定（王牌 2.0 秒 / 导弹机 2.4 秒），期间报告“锁定中”；
 * - 发射走单位导弹的通道（HUD 预警、热焰弹、EMP、近防炮才会照常生效）；
 * - 王牌：单发，自己的一段导弹航路（拉开、掉头、在 250–600 米内锁定、发射、回去用机炮），
 *   每架每 14 秒（起始值）最多一发。
 *
 * 导弹机自己的打法（双发、装填、距离带）在 EnemyDoctrineStriker.test.ts。
 * 导弹飞出去之后的事（追踪、预警、热焰弹）属于单位导弹系统，不在这里。
 */

/** 锁定时长（秒），按发射者 */
const LOCK_SECONDS: Record<string, number> = { 'jet:ACE': 2.0, 'jet:STRIKER': 2.4 };
/** 可以锁定 / 发射的距离范围（米）：王牌按规格，导弹机按验收过的 400–760 */
const LOCK_WINDOW: Record<string, [number, number]> = {
  'jet:ACE': [250, 600],
  'jet:STRIKER': [400, 760],
};
/** 王牌两次发射的最短间隔（秒，规格里的起始值） */
const ACE_LAUNCH_SPACING = 14;
/** 发射瞬间的距离可以超出锁定范围这么多（米）：锁定期间双方还在相对运动 */
const LAUNCH_RANGE_SLACK = 50;

const PILOTS: Array<[string, (rig: { turnPlayer(angle: number): void; time: number }) => void]> = [
  ['straight', () => {}],
  ['gently turning', (rig) => rig.turnPlayer(0.1 * DT)],
  ['circling', (rig) => rig.turnPlayer(0.3 * DT)],
  ['jinking', (rig) => rig.turnPlayer((Math.floor(rig.time / 5) % 2 === 0 ? 0.9 : -0.6) * DT)],
];

/**
 * 一串发射记录里不合规格的地方（空数组 = 全部合格）。按敌机把相隔不到 1 秒的发射归成一次齐射，
 * 锁定时长只对每次齐射的第一发要求。
 */
function launchProblems(log: readonly RigLaunch[], checkWarning: boolean): string[] {
  const problems: string[] = [];
  for (const salvo of groupBursts(log, 1)) {
    const first = salvo[0];
    const tag = `${first.source} at ${first.time.toFixed(2)} s`;
    const lock = LOCK_SECONDS[first.source];
    const window = LOCK_WINDOW[first.source];
    if (lock === undefined || window === undefined) {
      problems.push(`${tag}: this type must not launch missiles`);
      continue;
    }
    if (!first.jet) problems.push(`${tag}: no jet of that type at the launch point`);
    if (first.lockedFor < lock - 1e-6) {
      problems.push(`${tag}: launched after locking for only ${first.lockedFor.toFixed(2)} s`);
    }
    if (first.lockedFor > lock + 0.1) {
      problems.push(`${tag}: the lock took ${first.lockedFor.toFixed(2)} s`);
    }
    if (checkWarning && first.warnedFor < lock - 1e-6) {
      problems.push(`${tag}: "locking" was reported for only ${first.warnedFor.toFixed(2)} s`);
    }
    // 锁定只在距离范围之内开始（那一步里敌机还会再挪一两米）
    const began = first.lockStartDistance;
    if (!(began >= window[0] - 5 && began <= window[1] + 5)) {
      problems.push(`${tag}: the lock began at ${began.toFixed(0)} m`);
    }
    for (const launch of salvo) {
      const at = `${launch.source} at ${launch.time.toFixed(2)} s`;
      if (!launch.hadToken) problems.push(`${at}: launched without an attack token`);
      // 锁定的两秒多里双方还在动：发射时可以比范围略近 / 略远，但不能离谱
      if (launch.distance < window[0] - LAUNCH_RANGE_SLACK) {
        problems.push(`${at}: launched from only ${launch.distance.toFixed(0)} m`);
      }
      if (launch.distance > window[1] + LAUNCH_RANGE_SLACK) {
        problems.push(`${at}: launched from ${launch.distance.toFixed(0)} m`);
      }
      const finite =
        Number.isFinite(launch.origin.lengthSq()) && Number.isFinite(launch.direction.lengthSq());
      if (!finite) problems.push(`${at}: non-finite launch position or direction`);
      if (Math.abs(launch.direction.length() - 1) > 1e-3) {
        problems.push(`${at}: the launch direction is not a unit vector`);
      }
      if (launch.jetPosition && launch.origin.distanceTo(launch.jetPosition) > 15) {
        problems.push(`${at}: the missile left from somewhere other than the jet`);
      }
      const toPlayer = launch.playerPosition.clone().sub(launch.origin);
      const offNose = angleBetween(launch.direction, toPlayer) / DEG;
      if (offNose > 60) problems.push(`${at}: launched ${offNose.toFixed(0)} degrees off the player`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// 全队上限
// ---------------------------------------------------------------------------------------------

describe('fleet-wide limit on jet missiles (spec §3: missile tokens; §2.9 boss fights)', () => {
  it.each([1, 2, 3, 4, 5])('level %i allows one jet missile at a time', (level) => {
    expect(getJetMissileCap(level, false)).toBe(1);
  });

  it.each([6, 7, 8, 9, 10])('level %i allows two', (level) => {
    expect(getJetMissileCap(level, false)).toBe(2);
  });

  it.each([1, 3, 5, 6, 8, 10])('a boss fight at level %i allows none', (level) => {
    expect(getJetMissileCap(level, true)).toBe(0);
  });

  it('a broken level number never opens the limit up', () => {
    for (const level of [Number.NaN, Infinity, -Infinity, -3, 0, 5.4, 1e9]) {
      const cap = getJetMissileCap(level, false);
      expect(Number.isInteger(cap), `level ${level}`).toBe(true);
      expect(cap, `level ${level}`).toBeGreaterThanOrEqual(0);
      expect(cap, `level ${level}`).toBeLessThanOrEqual(2);
      expect(getJetMissileCap(level, true), `level ${level} in a boss fight`).toBe(0);
    }
    expect(getJetMissileCap(Number.NaN, false), 'unknown level counts as an early one').toBe(1);
  });
});

/** 导弹名额发放眼里的一架敌机 */
class FakeMissileJet implements IMissileJet {
  public alive = true;
  public stunned = false;
  public request = 0;
  public grant = 0;

  constructor(request = 0, grant = 0) {
    this.request = request;
    this.grant = grant;
  }

  public isAlive(): boolean {
    return this.alive;
  }

  public isStunned(): boolean {
    return this.stunned;
  }

  public getMissileRequest(): number {
    return this.request;
  }

  public getMissileGrant(): number {
    return this.grant;
  }

  public setMissileGrant(count: number): void {
    this.grant = count;
  }
}

function held(jets: readonly IMissileJet[]): number {
  return jets.reduce((sum, jet) => sum + jet.getMissileGrant(), 0);
}

describe('handing out missile slots', () => {
  it('a jet that asks gets a slot; a jet that does not ask gets none', () => {
    const asking = new FakeMissileJet(1);
    const quiet = new FakeMissileJet(0);
    grantJetMissiles([quiet, asking], 2, 0);
    expect(asking.grant).toBe(1);
    expect(quiet.grant).toBe(0);
  });

  it('a pair launcher gets two when two are free, and one when only one is', () => {
    const pair = new FakeMissileJet(2);
    grantJetMissiles([pair], 2, 0);
    expect(pair.grant).toBe(2);

    const second = new FakeMissileJet(2);
    grantJetMissiles([second], 2, 1);
    expect(second.grant, 'one missile already in flight').toBe(1);

    const third = new FakeMissileJet(2);
    grantJetMissiles([third], 1, 0);
    expect(third.grant, 'early levels').toBe(1);
  });

  it('missiles in flight use up slots: nothing is handed out while the limit is in the air', () => {
    const jets = [new FakeMissileJet(1), new FakeMissileJet(2)];
    grantJetMissiles(jets, 1, 1);
    expect(held(jets)).toBe(0);
    grantJetMissiles(jets, 2, 2);
    expect(held(jets)).toBe(0);
    grantJetMissiles(jets, 2, 5);
    expect(held(jets)).toBe(0);
  });

  it('a jet that holds a slot and still wants it keeps it, whoever else asks', () => {
    const locking = new FakeMissileJet(1, 1);
    const greedy = new FakeMissileJet(2);
    for (const order of [
      [greedy, locking],
      [locking, greedy],
    ]) {
      locking.grant = 1;
      greedy.grant = 0;
      grantJetMissiles(order, 1, 0);
      expect(locking.grant, 'the lock in progress is not interrupted').toBe(1);
      expect(greedy.grant).toBe(0);
    }
  });

  it('a slot is taken back from a jet that no longer asks, is stunned or is dead', () => {
    const done = new FakeMissileJet(0, 1);
    const stunned = new FakeMissileJet(1, 1);
    stunned.stunned = true;
    const dead = new FakeMissileJet(2, 2);
    dead.alive = false;
    grantJetMissiles([done, stunned, dead], 2, 0);
    expect(done.grant).toBe(0);
    expect(stunned.grant).toBe(0);
    expect(dead.grant).toBe(0);
  });

  it('a limit of zero (boss fight, player cannot be attacked) takes every slot back', () => {
    const jets = [new FakeMissileJet(1, 1), new FakeMissileJet(2, 1)];
    grantJetMissiles(jets, 0, 0);
    expect(held(jets)).toBe(0);
    grantJetMissiles(jets, Number.NaN, 0);
    expect(held(jets), 'a broken limit hands out nothing').toBe(0);
  });

  it.each([1, 2])(
    'with a limit of %i: slots held plus missiles in flight never exceed it, through any run of requests, launches and boss fights',
    (levelCap) => {
      const random = seededRandom(20261020 + levelCap);
      const jets = Array.from({ length: 6 }, () => new FakeMissileJet());
      /** 在飞的导弹：只会因为敌机发射而增加（发射的敌机同时交还一个名额），飞完就少一枚 */
      let inFlight = 0;
      let launched = 0;
      let mostInFlight = 0;
      for (let round = 0; round < 6000; round++) {
        for (const jet of jets) {
          if (random() < 0.3) jet.request = Math.floor(random() * 3);
          if (random() < 0.05) jet.stunned = !jet.stunned;
          if (random() < 0.02) jet.alive = !jet.alive;
          if (jet.grant > 0 && jet.alive && !jet.stunned && random() < 0.25) {
            jet.grant--;
            inFlight++;
            launched++;
          }
        }
        if (inFlight > 0 && random() < 0.08) inFlight--;
        mostInFlight = Math.max(mostInFlight, inFlight);
        if (inFlight > levelCap) {
          throw new Error(`round ${round}: ${inFlight} missiles in flight, limit ${levelCap}`);
        }
        // 每隔一阵来一段 Boss 战 / 玩家不可被攻击：上限变成 0
        const cap = Math.floor(round / 200) % 5 === 4 ? 0 : levelCap;
        grantJetMissiles(jets, cap, inFlight);
        const total = held(jets);
        const room = Math.max(0, cap - inFlight);
        if (total > room) {
          throw new Error(
            `round ${round}: ${total} held + ${inFlight} in flight with a limit of ${cap}`
          );
        }
        for (const jet of jets) {
          const allowed = jet.alive && !jet.stunned ? jet.request : 0;
          if (jet.grant > allowed) {
            throw new Error(`round ${round}: a jet holds ${jet.grant} but may hold ${allowed}`);
          }
          if (!Number.isInteger(jet.grant) || jet.grant < 0) {
            throw new Error(`round ${round}: a jet holds ${jet.grant}`);
          }
        }
        // 不小气：还有空名额时，没有哪架还在申请的敌机是缺的
        if (total < room) {
          const short = jets.some((jet) => jet.alive && !jet.stunned && jet.grant < jet.request);
          if (short) throw new Error(`round ${round}: a free slot was not handed out`);
        }
      }
      expect(launched, 'missiles launched along the way').toBeGreaterThan(100);
      expect(mostInFlight, 'the limit was reached').toBe(levelCap);
    }
  );
});

// ---------------------------------------------------------------------------------------------
// 接进真实的 EnemySystem
// ---------------------------------------------------------------------------------------------

describe('jet missiles through the real enemy system', () => {
  let system: SystemRig | null = null;
  let randomSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(20261021));
  });

  afterEach(() => {
    system?.dispose();
    system = null;
    EventBus.clear();
    // 只还原本文件替换的 Math.random（全局 setup 里的尾迹替身不能被 restoreAllMocks 清掉）
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  function open(options: SystemRigOptions): SystemRig {
    system?.dispose();
    const current = new SystemRig(options);
    system = current;
    current.pilot = (active) => active.turnPlayer(0.3 * DT);
    return current;
  }

  /** 两架王牌、三架导弹机，围着一个盘旋的玩家 */
  function missileFleet(options: SystemRigOptions): SystemRig {
    const current = open(options);
    current.spawn(EnemyType.ACE, pointAround(current.player, 400, 120 * DEG));
    current.spawn(EnemyType.ACE, pointAround(current.player, 420, -100 * DEG));
    current.spawn(EnemyType.STRIKER, pointAround(current.player, 600, 40 * DEG));
    current.spawn(EnemyType.STRIKER, pointAround(current.player, 620, -50 * DEG));
    current.spawn(EnemyType.STRIKER, pointAround(current.player, 580, 170 * DEG));
    return current;
  }

  interface FleetTally {
    /** “在飞 + 各机手里的名额”的最大值 */
    worst: number;
    mostInFlight: number;
    lockingSteps: number;
    warningSteps: number;
    /** 预警与“有敌机在锁定”不一致的步数 */
    warningMismatch: number;
    grantSteps: number;
  }

  function fight(current: SystemRig, seconds: number): FleetTally {
    const tally: FleetTally = {
      worst: 0,
      mostInFlight: 0,
      lockingSteps: 0,
      warningSteps: 0,
      warningMismatch: 0,
      grantSteps: 0,
    };
    current.run(seconds, () => {
      let grants = 0;
      let locking = false;
      for (const jet of current.jets) {
        grants += jet.getMissileGrant();
        if (jet.isMissileLocking()) locking = true;
      }
      const inFlight = current.missiles.countInFlight();
      tally.worst = Math.max(tally.worst, grants + inFlight);
      tally.mostInFlight = Math.max(tally.mostInFlight, inFlight);
      if (grants > 0) tally.grantSteps++;
      if (locking) tally.lockingSteps++;
      if (current.missiles.lockWarning) tally.warningSteps++;
      if (current.missiles.lockWarning !== locking) tally.warningMismatch++;
    });
    return tally;
  }

  /** 发射记录里，任一时刻同时在飞的最多几枚（每枚飞 flightSeconds 秒） */
  function mostAirborne(current: SystemRig): number {
    const { launches, flightSeconds } = current.missiles;
    let most = 0;
    launches.forEach((launch, index) => {
      let airborne = 0;
      for (let i = 0; i <= index; i++) {
        if (launches[i].time > launch.time - flightSeconds) airborne++;
      }
      most = Math.max(most, airborne);
    });
    return most;
  }

  it.each([
    [1, 1],
    [3, 1],
    [5, 1],
    [6, 2],
    [8, 2],
    [10, 2],
  ])(
    'level %i: never more than %i jet missile(s) in flight plus slots held, and the limit is used',
    (level, cap) => {
      const current = missileFleet({ level });
      const tally = fight(current, 90);
      expect(tally.worst, 'missiles in flight + slots held, worst step').toBeLessThanOrEqual(cap);
      expect(mostAirborne(current), 'most missiles in the air at once').toBeLessThanOrEqual(cap);
      expect(tally.mostInFlight, 'the fleet does use its limit').toBe(cap);
      expect(current.launchLog.length).toBeGreaterThanOrEqual(4);
    }
  );

  it.each([3, 8])(
    'level %i: every launch comes from an Ace or a Striker, after its full lock, reported as "locking", with a token',
    (level) => {
      const current = missileFleet({ level });
      current.spawn(EnemyType.FIGHTER, pointAround(current.player, 300, 10 * DEG));
      current.spawn(EnemyType.WRAITH, pointAround(current.player, 350, -160 * DEG));
      const tally = fight(current, 120);
      expect(current.launchLog.length).toBe(current.missiles.launches.length);
      expect(launchProblems(current.launchLog, true)).toEqual([]);
      const sources = new Set(current.launchLog.map((launch) => launch.source));
      expect([...sources].sort()).toEqual(['jet:ACE', 'jet:STRIKER']);
      expect(tally.warningMismatch, 'steps where the warning did not match the locks').toBe(0);
      expect(tally.warningSteps).toBeGreaterThan(0);
    }
  );

  it('a Striker pair leaves 0.4 s apart and the second needs no second lock', () => {
    const current = open({ level: 8 });
    current.spawn(EnemyType.STRIKER, pointAround(current.player, 600, 40 * DEG));
    fight(current, 90);
    const salvos = groupBursts(current.launchLog, 1);
    expect(salvos.length).toBeGreaterThanOrEqual(3);
    for (const salvo of salvos) {
      expect(salvo.length, `salvo at ${salvo[0].time.toFixed(1)} s`).toBe(2);
      expect(salvo[1].time - salvo[0].time).toBeGreaterThan(0.4 - 2 * DT);
      expect(salvo[1].time - salvo[0].time).toBeLessThan(0.4 + 2 * DT);
    }
  });

  it('in a fight with every other type nobody locks, holds a slot or launches', () => {
    const current = open({ level: 8 });
    [
      EnemyType.SCOUT,
      EnemyType.FIGHTER,
      EnemyType.HEAVY,
      EnemyType.SNIPER,
      EnemyType.JAMMER,
      EnemyType.WRAITH,
    ].forEach((type, index) =>
      current.spawn(type, pointAround(current.player, 380 + index * 30, (index * 60 + 20) * DEG))
    );
    const tally = fight(current, 60);
    expect(current.missiles.launches.length).toBe(0);
    expect(tally.lockingSteps).toBe(0);
    expect(tally.warningSteps).toBe(0);
    expect(tally.grantSteps).toBe(0);
    // 对照：这场仗确实打起来了
    expect(current.shots.length).toBeGreaterThan(20);
  });

  it.each([3, 6, 10])(
    'boss fight at level %i: Aces and Strikers never lock or launch, but the Aces still use their guns',
    (level) => {
      const current = missileFleet({ level, bossFight: true });
      const tally = fight(current, 60);
      expect(current.missiles.launches.length).toBe(0);
      expect(tally.lockingSteps).toBe(0);
      expect(tally.warningSteps).toBe(0);
      expect(tally.grantSteps).toBe(0);
      const aceRounds = current.shots.filter(
        (shot) => shot.jet?.getConfig().type === EnemyType.ACE
      ).length;
      expect(aceRounds, 'gun rounds from the Aces').toBeGreaterThan(8);
    }
  );

  it('a boss fight that starts during a lock ends it: no missile follows', () => {
    const current = missileFleet({ level: 6 });
    let lockedSteps = 0;
    current.run(40, () => {
      lockedSteps = current.jets.some((jet) => jet.isMissileLocking()) ? lockedSteps + 1 : 0;
      return lockedSteps >= 60;
    });
    expect(lockedSteps, 'a lock one second old').toBeGreaterThanOrEqual(60);
    const launches = current.missiles.launches.length;
    current.missiles.clearInFlight();

    current.session.setInBossBattle(true);
    current.step();
    expect(current.jets.reduce((sum, jet) => sum + jet.getMissileGrant(), 0)).toBe(0);
    const tally = fight(current, 30);
    expect(current.missiles.launches.length - launches).toBe(0);
    expect(tally.grantSteps).toBe(0);
    expect(tally.lockingSteps, 'steps with a jet still locking').toBeLessThan(6);
    expect(tally.warningSteps, 'steps with the warning still showing').toBeLessThan(6);
  });

  // 规格 §3a："Player not targetable ...: no enemy weapon of any kind fires ... and no lock or
  // charge starts."
  it('while the player cannot be attacked no lock starts and nothing is launched; it resumes afterwards', () => {
    const current = missileFleet({ level: 6 });
    fight(current, 20);
    expect(current.missiles.launches.length, 'control: missiles before').toBeGreaterThan(0);
    // 等到没有敌机在锁定
    current.run(20, () => !current.jets.some((jet) => jet.isMissileLocking()));

    current.playerTargetable = false;
    current.step();
    const launches = current.missiles.launches.length;
    const tally = fight(current, 30);
    expect(current.missiles.launches.length - launches, 'missiles launched').toBe(0);
    expect(tally.lockingSteps, 'steps with a jet locking').toBe(0);
    expect(tally.warningSteps, 'steps with the "locking" warning on').toBe(0);
    expect(tally.grantSteps, 'steps with a missile slot held').toBe(0);

    current.playerTargetable = true;
    fight(current, 40);
    expect(current.missiles.launches.length, 'missiles after the player is back').toBeGreaterThan(
      launches
    );
  });

  it('a lock in progress when the player stops being attackable does not end in a launch', () => {
    const current = missileFleet({ level: 6 });
    let lockedSteps = 0;
    current.run(40, () => {
      lockedSteps = current.jets.some((jet) => jet.isMissileLocking()) ? lockedSteps + 1 : 0;
      return lockedSteps >= 60;
    });
    expect(lockedSteps).toBeGreaterThanOrEqual(60);
    const launches = current.missiles.launches.length;
    current.playerTargetable = false;
    const tally = fight(current, 10);
    expect(current.missiles.launches.length - launches).toBe(0);
    expect(tally.warningSteps, 'steps with the warning still showing').toBeLessThan(60);
  });

  it('the second missile of a pair is not launched once the player cannot be attacked', () => {
    const current = open({ level: 8 });
    current.spawn(EnemyType.STRIKER, pointAround(current.player, 600, 40 * DEG));
    current.run(40, () => {
      if (current.missiles.launches.length === 0) return false;
      current.playerTargetable = false;
      return true;
    });
    expect(current.missiles.launches.length, 'the first of the pair').toBe(1);
    current.run(5);
    expect(current.missiles.launches.length, 'missiles after the player went untargetable').toBe(1);
  });

  it('while the missile channel is not ready no jet locks: a "locking" warning could never be followed by a missile', () => {
    const current = missileFleet({ level: 6 });
    current.missiles.available = false;
    const tally = fight(current, 40);
    expect(current.missiles.launches.length).toBe(0);
    expect(tally.lockingSteps).toBe(0);
    expect(tally.warningSteps).toBe(0);
    expect(tally.grantSteps).toBe(0);

    current.missiles.available = true;
    fight(current, 40);
    expect(current.missiles.launches.length, 'missiles once the channel is ready').toBeGreaterThan(
      0
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 王牌的导弹
// ---------------------------------------------------------------------------------------------

describe('ACE seeking missile (spec §3)', () => {
  let rig: FleetRig | null = null;

  afterEach(() => {
    rig?.dispose();
    rig = null;
  });

  function duel(options: ConstructorParameters<typeof FleetRig>[0] = {}): {
    current: FleetRig;
    ace: EnemyAI;
  } {
    rig?.dispose();
    const current = new FleetRig({ level: 3, capacity: 3, seed: 31, ...options });
    rig = current;
    const ace = current.addJet(EnemyType.ACE, pointAround(current.player, 400, 120 * DEG));
    // 导弹很快就没了（被热焰弹引开）：不让上一枚挡住下一次发射
    current.missiles.flightSeconds = 3;
    return { current, ace };
  }

  /** 把一个占着导弹名额的“别人的导弹”放进通道 */
  function occupySlot(current: FleetRig): void {
    current.missiles.flightSeconds = 1e6;
    current.missiles.launch(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 'jet:STRIKER');
  }

  it.each(PILOTS)(
    'against a %s player: locks for 2.0 s inside 250-600 m, facing the player, and launches one missile',
    (_name, fly) => {
      const { current, ace } = duel();
      current.pilot = fly;
      current.run(150);
      const log = current.launchLog;
      expect(log.length, 'launches in 150 s').toBeGreaterThanOrEqual(3);
      expect(launchProblems(log, false)).toEqual([]);
      for (const launch of log) {
        expect(launch.jet).toBe(ace);
        expect(launch.source).toBe('jet:ACE');
        const toPlayer = launch.playerPosition.clone().sub(launch.origin);
        expect(
          angleBetween(launch.direction, toPlayer) / DEG,
          `off the nose at ${launch.time.toFixed(1)} s`
        ).toBeLessThan(45);
      }
      // 单发：同一架王牌的两次发射之间隔着整段装填
      for (let i = 1; i < log.length; i++) {
        expect(
          log[i].time - log[i - 1].time,
          `gap before the launch at ${log[i].time.toFixed(1)} s`
        ).toBeGreaterThanOrEqual(ACE_LAUNCH_SPACING * 0.85);
      }
    }
  );

  it('launches one missile at a time on the late levels too, where two slots are free', () => {
    const { current } = duel({ level: 8 });
    current.pilot = PILOTS[2][1];
    current.run(120);
    expect(current.launchLog.length).toBeGreaterThanOrEqual(3);
    for (const salvo of groupBursts(current.launchLog, 5)) expect(salvo.length).toBe(1);
  });

  it('every lock that runs its full two seconds ends in a launch, and every launch ends a lock', () => {
    const { current, ace } = duel();
    current.pilot = PILOTS[2][1];
    const locks: Array<{ start: number; end: number }> = [];
    let since = -1;
    current.run(150, () => {
      if (ace.isMissileLocking()) {
        if (since < 0) since = current.time;
      } else if (since >= 0) {
        locks.push({ start: since, end: current.time });
        since = -1;
      }
    });
    const full = locks.filter((lock) => lock.end - lock.start >= 2.0 - 1e-6);
    expect(full.length).toBe(current.launchLog.length);
    for (const lock of locks) {
      expect(lock.end - lock.start, 'no lock outlasts its two seconds').toBeLessThan(2.0 + 0.1);
    }
    for (const launch of current.launchLog) {
      const ended = full.some((lock) => Math.abs(lock.end - launch.time) <= 2 * DT + 1e-9);
      expect(ended, `the launch at ${launch.time.toFixed(2)} s closes a lock`).toBe(true);
    }
  });

  it('goes back to its guns after a launch', () => {
    const { current } = duel();
    current.run(150);
    const log = current.launchLog;
    expect(log.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < log.length - 1; i++) {
      const rounds = current.shots.filter(
        (shot) => shot.time > log[i].time && shot.time < log[i + 1].time
      ).length;
      expect(rounds, `gun rounds after the launch at ${log[i].time.toFixed(1)} s`).toBeGreaterThan(
        3
      );
    }
  });

  it('without an attack token it never locks, holds a missile slot or launches', () => {
    const { current, ace } = duel({ capacity: 0 });
    current.pilot = PILOTS[2][1];
    let lockingSteps = 0;
    let grantSteps = 0;
    current.run(90, () => {
      if (ace.isMissileLocking()) lockingSteps++;
      if (ace.getMissileGrant() > 0) grantSteps++;
    });
    expect(current.launchLog.length).toBe(0);
    expect(lockingSteps).toBe(0);
    expect(grantSteps, 'steps holding a missile slot it cannot use').toBe(0);
  });

  it('on an early level it does not lock while another jet missile is in flight, and keeps to its guns', () => {
    const { current, ace } = duel({ level: 3 });
    occupySlot(current);
    current.pilot = PILOTS[2][1];
    let lockingSteps = 0;
    current.run(90, () => {
      if (ace.isMissileLocking()) lockingSteps++;
    });
    expect(current.launchLog.length).toBe(0);
    expect(lockingSteps).toBe(0);
    expect(current.shots.length, 'gun rounds').toBeGreaterThan(20);
  });

  it('on a late level one missile in flight leaves it a slot; two leave it none', () => {
    const one = duel({ level: 8 });
    occupySlot(one.current);
    one.current.pilot = PILOTS[2][1];
    one.current.run(60);
    expect(one.current.launchLog.length, 'with one slot taken').toBeGreaterThan(0);

    const two = duel({ level: 8 });
    occupySlot(two.current);
    occupySlot(two.current);
    two.current.pilot = PILOTS[2][1];
    two.current.run(60);
    expect(two.current.launchLog.length, 'with both slots taken').toBe(0);
  });

  it('in a boss fight it never locks or launches', () => {
    const { current, ace } = duel({ level: 8, bossFight: true });
    current.pilot = PILOTS[2][1];
    let lockingSteps = 0;
    current.run(90, () => {
      if (ace.isMissileLocking()) lockingSteps++;
    });
    expect(current.launchLog.length).toBe(0);
    expect(lockingSteps).toBe(0);
    expect(current.shots.length, 'gun rounds').toBeGreaterThan(20);
  });

  /** 推进到王牌已经锁定了 seconds 秒 */
  function intoLock(current: FleetRig, ace: EnemyAI, seconds: number): boolean {
    let lockedSteps = 0;
    const target = Math.round(seconds / DT);
    current.run(60, () => {
      lockedSteps = ace.isMissileLocking() ? lockedSteps + 1 : 0;
      return lockedSteps >= target;
    });
    return lockedSteps >= target;
  }

  it('an EMP stun during the lock cancels it: no missile, and the "locking" report stops at once', () => {
    const { current, ace } = duel();
    expect(intoLock(current, ace, 1)).toBe(true);
    ace.applyStun(3);
    expect(ace.isMissileLocking(), 'still reported as locking after the stun').toBe(false);
    let lockingSteps = 0;
    let grantSteps = 0;
    current.run(2.9, () => {
      if (ace.isMissileLocking()) lockingSteps++;
      if (ace.getMissileGrant() > 0) grantSteps++;
    });
    expect(current.launchLog.length).toBe(0);
    expect(lockingSteps).toBe(0);
    expect(grantSteps, 'steps holding a missile slot while stunned').toBe(0);
    // 瘫痪结束后要重新锁满两秒
    current.run(60, () => current.launchLog.length > 0);
    expect(current.launchLog.length).toBe(1);
    expect(current.launchLog[0].lockedFor).toBeGreaterThanOrEqual(2.0 - 1e-6);
  });

  it.each(['lock', 'missile'] as const)(
    'a player %s on the Ace during its lock makes it break off instead of launching',
    (threat) => {
      const { current, ace } = duel();
      expect(intoLock(current, ace, 1)).toBe(true);
      if (threat === 'lock') current.lockedJet = ace;
      else current.missileTargets.add(ace);
      let lockingSteps = 0;
      current.run(3, () => {
        if (ace.isMissileLocking()) lockingSteps++;
      });
      expect(current.launchLog.length, 'missiles launched while under threat').toBe(0);
      expect(lockingSteps, 'steps still locking').toBeLessThan(40);
    }
  );
});
