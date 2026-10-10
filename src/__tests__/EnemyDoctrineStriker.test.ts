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
  angleBetween,
  breathe,
  chasePilot,
  groupBursts,
  pointAround,
  seededGameRandom,
  shadowPilot,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 导弹机（STRIKER，导弹载机）的打法，规格 §3，批次 E-X 里程碑 2：
 * HP 140，没有机炮。待在 450–700 米外；锁定 2.4 秒，相隔 0.4 秒打出两枚导弹（受全队导弹名额
 * 限制：只剩一个名额就只打一枚），然后掉头装填约 10 秒，又慢又脆。对锁定 / 来袭导弹没有别的
 * 反应（只有装填时的掉头）。已接受的出入：锁定窗口是 400–760 米——玩家逼近到 400 米以内会打断
 * 它的锁定。
 *
 * 导弹的全队上限、令牌、Boss 战与玩家不可被攻击时的规矩在 EnemyJetMissiles.test.ts。
 */

const LOCK_SECONDS = 2.4;
const SALVO_GAP = 0.4;
const RELOAD_SECONDS = 10;
/** 已接受的锁定窗口（米） */
const LOCK_MIN_RANGE = 400;
const LOCK_MAX_RANGE = 760;
/** 规格的待命距离带（米） */
const BAND_MIN = 450;
const BAND_MAX = 700;

const PILOTS: Array<[string, (rig: FleetRig) => void]> = [
  ['straight', () => {}],
  ['gently turning', (rig) => rig.turnPlayer(0.1 * DT)],
  ['circling', (rig) => rig.turnPlayer(0.3 * DT)],
  ['jinking', (rig) => rig.turnPlayer((Math.floor(rig.time / 5) % 2 === 0 ? 0.9 : -0.6) * DT)],
];

let rig: FleetRig | null = null;

afterEach(() => {
  rig?.dispose();
  rig = null;
});

function strikerRig(
  options: ConstructorParameters<typeof FleetRig>[0] = {},
  bearing = 40
): { current: FleetRig; striker: EnemyAI } {
  rig?.dispose();
  const current = new FleetRig({ level: 8, capacity: 3, seed: 5, ...options });
  rig = current;
  const striker = current.addJet(
    EnemyType.STRIKER,
    pointAround(current.player, 600, bearing * DEG)
  );
  // 导弹很快就没了（被热焰弹引开）：不让上一枚挡住下一次发射
  current.missiles.flightSeconds = 3;
  return { current, striker };
}

/** 一段连续的“锁定中” */
interface Lock {
  start: number;
  end: number;
  startDistance: number;
}

/** 推进 seconds 秒，记下这架导弹机每一段连续的锁定 */
function runLocks(current: FleetRig, striker: EnemyAI, seconds: number): Lock[] {
  const locks: Lock[] = [];
  let open: Lock | null = null;
  current.run(seconds, () => {
    const t = current.time - DT;
    if (striker.isMissileLocking()) {
      if (!open) {
        open = { start: t, end: NaN, startDistance: current.distanceTo(striker) };
        locks.push(open);
      }
    } else if (open) {
      open.end = t;
      open = null;
    }
  });
  return locks;
}

describe('STRIKER: a missile carrier with no gun (spec §3)', () => {
  it('has 140 HP at base and never fires a gun round, whatever the player does', async () => {
    expect(ENEMY_CONFIGS[EnemyType.STRIKER].health).toBe(140);
    for (const [name, fly] of PILOTS) {
      const { current } = strikerRig();
      current.pilot = fly;
      current.run(90);
      expect(current.shots.length, `${name}: gun rounds`).toBe(0);
      expect(current.launchLog.length, `${name}: it did fight`).toBeGreaterThan(0);
      await breathe();
    }
  });

  it('never fires a gun round when the player sits right in front of it, either', () => {
    const { current, striker } = strikerRig();
    current.run(1);
    current.pilot = shadowPilot(striker, -150, 0, 0, 'with-jet');
    current.run(30);
    expect(current.shots.length).toBe(0);
  });
});

describe('STRIKER lock and pair (spec §3; accepted lock window 400-760 m)', () => {
  function salvosAgainst(fly: (rig: FleetRig) => void) {
    const { current, striker } = strikerRig();
    current.pilot = fly;
    current.run(150);
    const salvos = groupBursts(current.launchLog, 1);
    expect(salvos.length, 'salvos in 150 s').toBeGreaterThanOrEqual(3);
    return { striker, salvos };
  }

  it.each(PILOTS)(
    'against a %s player: every salvo follows an unbroken 2.4 s lock that began inside 400-760 m; a second missile leaves 0.4 s after the first',
    (_name, fly) => {
      const { striker, salvos } = salvosAgainst(fly);
      for (const salvo of salvos) {
        const first = salvo[0];
        const tag = `salvo at ${first.time.toFixed(2)} s`;
        expect(first.jet, tag).toBe(striker);
        expect(first.lockedFor, `${tag}: lock time`).toBeGreaterThanOrEqual(LOCK_SECONDS - 1e-6);
        expect(first.lockedFor, `${tag}: lock time`).toBeLessThan(LOCK_SECONDS + 0.1);
        expect(first.warnedFor, `${tag}: "locking" shown`).toBeGreaterThanOrEqual(
          LOCK_SECONDS - 1e-6
        );
        expect(first.lockStartDistance, `${tag}: lock began at`).toBeGreaterThanOrEqual(
          LOCK_MIN_RANGE - 5
        );
        expect(first.lockStartDistance, `${tag}: lock began at`).toBeLessThanOrEqual(
          LOCK_MAX_RANGE + 5
        );
        expect(salvo.length, `${tag}: missiles`).toBeLessThanOrEqual(2);
        if (salvo.length === 2) {
          const gap = salvo[1].time - first.time;
          expect(gap, tag).toBeGreaterThan(SALVO_GAP - 1.5 * DT);
          expect(gap, tag).toBeLessThan(SALVO_GAP + 1.5 * DT);
        }
        for (const launch of salvo) {
          expect(launch.hadToken, `${tag}: attack token`).toBe(true);
          const toPlayer = launch.playerPosition.clone().sub(launch.origin);
          expect(
            angleBetween(launch.direction, toPlayer) / DEG,
            `${tag}: off the nose`
          ).toBeLessThan(40);
        }
      }
    }
  );

  // 迎着直飞的玩家时，最后一次齐射只打出一发：见下面的 FINDING（距离在两发之间越过 760 米）
  it.each(PILOTS.slice(1))(
    'against a %s player on level 8 (two slots free): every salvo is a pair',
    (_name, fly) => {
      const { salvos } = salvosAgainst(fly);
      for (const salvo of salvos) {
        expect(salvo.length, `salvo at ${salvo[0].time.toFixed(2)} s`).toBe(2);
      }
    }
  );

  /** 锁定、打出第一发；第一发一出去就把玩家挪到 after 米外（机头正前方、同向飞） */
  function pairWithPlayerMovedTo(after: number, right = 0): number {
    const { current, striker } = strikerRig();
    current.run(1);
    current.pilot = shadowPilot(striker, -600, 0, 0, 'with-jet');
    let moved = false;
    current.run(40, () => {
      if (!moved && current.launchLog.length === 1) {
        moved = true;
        const ahead = Math.sqrt(Math.max(0, after * after - right * right));
        current.pilot = shadowPilot(striker, -ahead, right, 0, 'with-jet');
      }
      return moved && current.time > current.launchLog[0].time + 3;
    });
    expect(moved, 'first missile launched').toBe(true);
    return current.launchLog.length;
  }

  it('control: the player swinging 40 degrees off its nose (still 600 m away) between the two missiles does not cut the pair', () => {
    expect(pairWithPlayerMovedTo(600, 600 * Math.sin(40 * DEG))).toBe(2);
  });

  // FINDING: spec §3 STRIKER — "launches a pair of missiles 0.4 s apart (subject to the missile
  // tokens: if only one token is free it launches one)". With two missile slots free, the second
  // missile is never launched when the player's range leaves the accepted 400-760 m lock window
  // during the 0.4 s between the two missiles (expected: 2 missiles; actual: 1 — the lock was
  // already complete, so this is not the accepted "lock broken inside 400 m" rule). It shows up
  // in normal play: against a player flying straight (seed 5, the Striker trailing at about
  // 757 m) the salvo at 132.40 s is a single missile. Reproduce: FleetRig({ level: 8,
  // capacity: 3, seed: 5 }), one STRIKER 600 m out at 40 degrees, after 1 s the player shadows
  // it 600 m ahead flying the same way (shadowPilot(striker, -600, 0, 0, 'with-jet')); the moment
  // the first missile leaves, move the player to 780 m (or 380 m) ahead: no second missile.
  it.fails(
    'a player whose range leaves 400-760 m between the two missiles still gets the second one (two slots free)',
    () => {
      const counts = [780, 380].map((after) => `${after} m: ${pairWithPlayerMovedTo(after)}`);
      expect(counts).toEqual(['780 m: 2', '380 m: 2']);
    }
  );

  it('does not start a lock on a player beyond 760 m', () => {
    // 玩家每一步都在它机头正前方 800 米、同向飞：够得着就会锁，够不着就不会
    const { current, striker } = strikerRig();
    current.run(1);
    current.pilot = shadowPilot(striker, -800, 0, 0, 'with-jet');
    const locks = runLocks(current, striker, 40);
    expect(locks).toEqual([]);
    expect(current.launchLog.length).toBe(0);

    // 对照：同样的摆法放到 600 米就会锁定、发射
    current.pilot = shadowPilot(striker, -600, 0, 0, 'with-jet');
    current.run(30);
    expect(current.launchLog.length).toBeGreaterThan(0);
  });

  it.each([1, 3, 5])(
    'level %i (one missile at a time): it launches one missile, not a pair',
    (level) => {
      const { current } = strikerRig({ level });
      current.pilot = PILOTS[2][1];
      current.run(120);
      const salvos = groupBursts(current.launchLog, 1);
      expect(salvos.length).toBeGreaterThanOrEqual(3);
      for (const salvo of salvos)
        expect(salvo.length, `salvo at ${salvo[0].time.toFixed(2)} s`).toBe(1);
    }
  );

  it('level 8 with one jet missile already in flight: it launches one, not a pair', () => {
    const { current } = strikerRig({ level: 8 });
    current.pilot = PILOTS[2][1];
    // 别人的一枚导弹一直在飞：只剩一个名额
    current.missiles.flightSeconds = 1e6;
    current.missiles.launch(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 'jet:ACE');
    current.run(90);
    expect(current.launchLog.length).toBeGreaterThanOrEqual(1);
    // 名额只有一个、而且发出去就一直占着：最多一枚
    expect(current.launchLog.length).toBe(1);
  });
});

describe('STRIKER reload: turns away for about 10 s, slow and vulnerable (spec §3)', () => {
  /** 每次齐射的最后一发之后的装填段：机头离玩家的夹角、速度 */
  interface ReloadSample {
    since: number;
    awayAngle: number;
    speed: number;
    distance: number;
    /** 拴绳正把它拉回来（规格规则 4：900 米外直飞回战场），这时的速度不归装填管 */
    leash: boolean;
  }

  function reloads(fly: (rig: FleetRig) => void, seconds = 150) {
    const { current, striker } = strikerRig();
    current.pilot = fly;
    const samples: ReloadSample[][] = [];
    let lastLaunchCount = 0;
    let open: ReloadSample[] | null = null;
    let openedAt = 0;
    const locks: Lock[] = [];
    let lockOpen: Lock | null = null;
    current.run(seconds, () => {
      const t = current.time - DT;
      if (current.launchLog.length !== lastLaunchCount) {
        lastLaunchCount = current.launchLog.length;
        open = [];
        samples.push(open);
        openedAt = current.launchLog[lastLaunchCount - 1].time;
      }
      if (open) {
        const toPlayer = current.player.position.clone().sub(striker.getMesh().position);
        open.push({
          since: t - openedAt,
          awayAngle: angleBetween(striker.velocity, toPlayer),
          speed: striker.velocity.length(),
          distance: toPlayer.length(),
          leash: striker.getDoctrinePhase() === 'return',
        });
        if (t - openedAt > RELOAD_SECONDS + 3) open = null;
      }
      if (striker.isMissileLocking()) {
        if (!lockOpen) {
          lockOpen = { start: t, end: NaN, startDistance: current.distanceTo(striker) };
          locks.push(lockOpen);
        }
      } else lockOpen = null;
    });
    // 只要齐射的最后一发之后的那一段（跑到结尾不满 9 秒的不算）
    const salvos = groupBursts(current.launchLog, 1);
    const lastOfSalvo = new Set(salvos.map((salvo) => salvo[salvo.length - 1].time));
    const trimmed = samples.filter(
      (run, index) =>
        lastOfSalvo.has(current.launchLog[index].time) && run[run.length - 1].since >= 9
    );
    return { current, striker, reloads: trimmed, salvos, locks };
  }

  /** 最后一发之后 3 秒内，飞行方向离“指向玩家”超过 90 度（背着玩家飞）的最早时刻；没有为 NaN */
  function turnedAwayAt(run: ReloadSample[]): number {
    const away = run.find((sample) => sample.since <= 3 && sample.awayAngle > 90 * DEG);
    return away ? away.since : NaN;
  }

  it.each(PILOTS)(
    'against a %s player: slow (at most 0.7x base speed from +2 s to +9 s, leash aside) and no new lock for 9 s',
    (_name, fly) => {
      const { striker, reloads: runs, salvos, locks } = reloads(fly);
      const base = striker.getConfig().speed;
      expect(runs.length).toBeGreaterThanOrEqual(3);
      for (const [index, run] of runs.entries()) {
        const window = run.filter(
          (sample) => sample.since >= 2 && sample.since <= 9 && !sample.leash
        );
        expect(window.length).toBeGreaterThan(200);
        const meanSpeed = window.reduce((sum, sample) => sum + sample.speed, 0) / window.length;
        expect(meanSpeed / base, `reload ${index + 1}: mean speed / base`).toBeLessThanOrEqual(0.7);
      }
      // 下一次锁定至少隔 9 秒（“约 10 秒”）
      for (const salvo of salvos) {
        const done = salvo[salvo.length - 1].time;
        const next = locks.find((lock) => lock.start > done + DT);
        if (next) {
          expect(next.start - done, `lock after the salvo at ${done.toFixed(2)} s`).toBeGreaterThan(
            RELOAD_SECONDS * 0.9
          );
        }
      }
    }
  );

  it.each(PILOTS.slice(1))(
    'against a %s player: it turns away (flying more than 90 degrees off the player) within 3 s of its last missile',
    (_name, fly) => {
      const { reloads: runs } = reloads(fly);
      expect(runs.length).toBeGreaterThanOrEqual(3);
      const late = runs
        .map((run, index) => ({ index: index + 1, at: turnedAwayAt(run) }))
        .filter((reload) => !(reload.at <= 3));
      expect(late).toEqual([]);
    }
  );

  // FINDING: spec §3 STRIKER — "then turns away to reload for about 10 s". Read as: within 3 s of
  // its last missile it flies away from the player (more than 90 degrees off the line to the
  // player) — the same measure the three other player paths above pass. Against a player flying
  // straight, the Striker trails at the edge of its lock window (745-757 m) when it fires, and
  // after reloads 2-4 it never turns more than 60-66 degrees off the player; from about +3 s its
  // heading swings back toward the player (45 down to 22 degrees off, at 835-890 m) while still
  // reloading, before the 900 m leash takes over. (It is slow, and does not lock again early.)
  // Minor, and it depends on reading "turns away" as "flies away from the player". Reproduce:
  // FleetRig({ level: 8, capacity: 3, seed: 5 }), one STRIKER 600 m out at 40 degrees, player
  // straight at 45 m/s for 150 s, missiles in flight for 3 s; salvos end at 37.87, 62.90, 97.88
  // and 132.40 s.
  it.fails(
    'against a straight player: it turns away (flying more than 90 degrees off the player) within 3 s of its last missile',
    () => {
      const { reloads: runs } = reloads(PILOTS[0][1]);
      expect(runs.length).toBeGreaterThanOrEqual(3);
      const late = runs
        .map((run, index) => ({ index: index + 1, at: turnedAwayAt(run) }))
        .filter((reload) => !(reload.at <= 3));
      expect(late).toEqual([]);
    }
  );

  it('is ready again after about 10 s: given a player straight ahead, salvos come 12-15 s apart', () => {
    const { current, striker } = strikerRig();
    current.run(1);
    current.pilot = shadowPilot(striker, -550, 0, 0, 'with-jet');
    current.run(80);
    const salvos = groupBursts(current.launchLog, 1);
    expect(salvos.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < salvos.length; i++) {
      const gap = salvos[i][0].time - salvos[i - 1][salvos[i - 1].length - 1].time;
      // 装填约 10 秒 + 锁定 2.4 秒
      expect(gap, `gap before the salvo at ${salvos[i][0].time.toFixed(1)} s`).toBeGreaterThan(
        RELOAD_SECONDS * 0.9 + LOCK_SECONDS
      );
      expect(gap).toBeLessThan(RELOAD_SECONDS * 1.2 + LOCK_SECONDS + 1);
    }
  });

  it('a player who gives chase while it reloads catches it: it stays slow and does not break', () => {
    const { current, striker } = strikerRig();
    current.pilot = PILOTS[2][1];
    expect(
      current.runUntil(() => current.launchLog.length >= 2, 60),
      'a pair launched'
    ).toBe(true);
    const start = current.distanceTo(striker);
    // 玩家以基础速度 45 米/秒追上去（导弹机装填时 0.6 × 46 ≈ 28 米/秒），还锁定着它
    current.lockedJet = striker;
    current.pilot = chasePilot(striker, 1.5);
    let closest = start;
    current.run(RELOAD_SECONDS - 1, () => {
      closest = Math.min(closest, current.distanceTo(striker));
    });
    expect(closest, 'closed in on it during the reload').toBeLessThan(start - 80);
  });
});

describe('STRIKER reactions: none beyond turning away (spec §3)', () => {
  it.each(PILOTS)(
    'against a %s player, a lock and a missile on it change nothing: it flies the very same path',
    (_name, fly) => {
      const paths: THREE.Vector3[][] = [];
      for (const threatened of [false, true]) {
        const { current, striker } = strikerRig({ seed: 11 });
        current.pilot = fly;
        if (threatened) {
          current.lockedJet = striker;
          current.missileTargets.add(striker);
        }
        const path: THREE.Vector3[] = [];
        current.run(60, () => {
          path.push(striker.getMesh().position.clone());
        });
        paths.push(path);
        expect(current.launchLog.length, 'it fought').toBeGreaterThan(0);
      }
      const [calm, threatened] = paths;
      let worst = 0;
      calm.forEach((point, index) => {
        worst = Math.max(worst, point.distanceTo(threatened[index]));
      });
      expect(worst, 'largest difference between the two paths (m)').toBeLessThan(1e-6);
    }
  );

  it('a player lock during its own lock does not stop the launch', () => {
    const { current, striker } = strikerRig();
    current.pilot = PILOTS[2][1];
    let lockedSteps = 0;
    current.run(60, () => {
      lockedSteps = striker.isMissileLocking() ? lockedSteps + 1 : 0;
      return lockedSteps >= 60;
    });
    expect(lockedSteps, 'a lock one second old').toBeGreaterThanOrEqual(60);
    current.lockedJet = striker;
    current.missileTargets.add(striker);
    current.run(3);
    expect(current.launchLog.length).toBe(2);
  });
});

describe('STRIKER lock is broken when the player closes inside 400 m (accepted lock window)', () => {
  /** 推进到它已经锁定了 seconds 秒 */
  function intoLock(seconds: number): { current: FleetRig; striker: EnemyAI } {
    const made = strikerRig();
    made.current.pilot = PILOTS[2][1];
    let lockedSteps = 0;
    made.current.run(60, () => {
      lockedSteps = made.striker.isMissileLocking() ? lockedSteps + 1 : 0;
      return lockedSteps >= Math.round(seconds / DT);
    });
    expect(made.striker.isMissileLocking(), 'locking').toBe(true);
    expect(made.current.launchLog.length).toBe(0);
    return made;
  }

  it.each([0.3, 1.2, 2.0])(
    'the player comes inside 400 m %s s into the lock and stays: no missile, and the lock is given up within 1 s',
    (seconds) => {
      const { current, striker } = intoLock(seconds);
      // 玩家贴到它机头前 300 米、与它同向飞（每一步都留在 400 米以内）
      current.pilot = shadowPilot(striker, -300, 0, 0, 'at-jet');
      let lockingSteps = 0;
      current.run(8, () => {
        expect(current.distanceTo(striker)).toBeLessThan(LOCK_MIN_RANGE);
        if (striker.isMissileLocking()) lockingSteps++;
      });
      expect(current.launchLog.length, 'missiles launched').toBe(0);
      expect(lockingSteps * DT, 'still locking after the player closed in (s)').toBeLessThan(1);
    }
  );

  it('a player who stays 400-760 m away does not break the lock', () => {
    const { current, striker } = intoLock(0.5);
    current.pilot = shadowPilot(striker, -520, 0, 0, 'at-jet');
    current.run(3);
    expect(current.launchLog.length).toBe(2);
  });

  it('an EMP stun during the lock cancels it at once; afterwards it needs a whole new lock', () => {
    const { current, striker } = intoLock(1.5);
    striker.applyStun(3);
    expect(striker.isMissileLocking(), 'locking right after the stun').toBe(false);
    let lockingSteps = 0;
    current.run(2.9, () => {
      if (striker.isMissileLocking()) lockingSteps++;
    });
    expect(lockingSteps).toBe(0);
    expect(current.launchLog.length).toBe(0);
    current.run(60, () => current.launchLog.length > 0);
    expect(current.launchLog.length).toBeGreaterThan(0);
    expect(current.launchLog[0].lockedFor).toBeGreaterThanOrEqual(LOCK_SECONDS - 1e-6);
  });
});

describe('STRIKER standoff band (spec §3: stays 450-700 m out)', () => {
  /**
   * 在 450–700 米带里的时间占比：从第 10 秒起（进场之后），不算每次发射后的 10 秒装填（规格让它
   * 掉头装填）和拴绳以外的时间。
   */
  function bandShare(seed: number, yaw: number, bearing: number): number {
    const { current, striker } = strikerRig({ seed }, bearing);
    current.pilot = (active) => active.turnPlayer(yaw * DT);
    let counted = 0;
    let inBand = 0;
    current.run(120, () => {
      if (current.time < 10) return;
      const last = current.launchLog[current.launchLog.length - 1];
      if (last && current.time - last.time < RELOAD_SECONDS) return;
      const distance = current.distanceTo(striker);
      if (distance > SPEC.LEASH) return;
      counted++;
      if (distance >= BAND_MIN && distance <= BAND_MAX) inBand++;
    });
    expect(counted, `seed ${seed}, turn ${yaw}, bearing ${bearing}`).toBeGreaterThan(900);
    return inBand / counted;
  }

  it('control: against a circling player it sits inside the band about half the time or more', () => {
    for (const seed of [4, 5]) {
      for (const bearing of [40, 120]) {
        expect(bandShare(seed, 0.3, bearing), `seed ${seed}, bearing ${bearing}`).toBeGreaterThan(
          0.4
        );
      }
    }
  });

  // FINDING: spec §3 STRIKER — "Stays 450–700 m out." The spec gives no separate measure for the
  // Striker; measured the way spec §3a measures the Sniper's standoff band (inside the band for at
  // least 60 % of the time against a player flying straight at cruise speed or turning gently,
  // not counting the 10 s reload after each launch, when the spec has it turn away, nor time
  // beyond the 900 m leash), the band is not held. The Striker flies its standoff orbit at 1.0x
  // of its base speed (46 m/s, about the player's 45 m/s cruise) and only speeds up beyond 700 m,
  // so against a player flying straight it either falls behind and trails at 726-860 m (starting
  // at 120 or -70 degrees: 0 % in the band) or is run over and sits at 340-450 m (starting at 40
  // degrees: 2-3 %); against a 0.1 rad/s turn it is in the band 17-23 % of the time from 40 or
  // 120 degrees (59 % and over 60 % from -70 degrees). 11 of the 12 cases (seeds 4 and 5) are
  // under 60 %. Its accepted 400-760 m lock window still lets it lock from most of those places.
  // Reproduce: FleetRig({ level: 8, capacity: 3, seed }), seeds 4 and 5, one STRIKER
  // 600 m out at 40 / 120 / -70 degrees off the nose, player at 45 m/s straight or turning
  // 0.1 rad/s for 120 s, missiles in flight for 3 s; from t = 10 s count the steps that are not
  // within 10 s after a launch and not beyond 900 m, and take the share inside 450-700 m.
  it.fails(
    'is inside 450-700 m at least 60 % of the time against a straight or gently turning player',
    () => {
      const shares: string[] = [];
      for (const seed of [4, 5]) {
        for (const yaw of [0, 0.1]) {
          for (const bearing of [40, 120, -70]) {
            const share = bandShare(seed, yaw, bearing);
            if (share < 0.6) {
              shares.push(
                `seed ${seed}, turn ${yaw} rad/s, from ${bearing} degrees: ${(share * 100).toFixed(0)} %`
              );
            }
          }
        }
      }
      expect(shares).toEqual([]);
    }
  );
});

describe('STRIKER through the real enemy system', () => {
  let system: SystemRig | null = null;
  let randomSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(20261041));
  });

  afterEach(() => {
    system?.dispose();
    system = null;
    EventBus.clear();
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  it.each([4, 6, 9])(
    'level %i: it fires no gun round, and its missiles go out as a pair (or one on levels 1-5)',
    (level) => {
      const current = new SystemRig({ level, difficulty: 3 });
      system = current;
      current.pilot = (active) => active.turnPlayer(0.3 * DT);
      const striker = current.spawn(EnemyType.STRIKER, pointAround(current.player, 600, 40 * DEG));
      current.missiles.flightSeconds = 3;
      current.run(90);
      const mesh = striker.getMesh();
      expect(current.shots.filter((shot) => shot.payload.owner === mesh).length).toBe(0);
      const salvos = groupBursts(current.launchLog, 1);
      expect(salvos.length).toBeGreaterThanOrEqual(2);
      for (const salvo of salvos) {
        expect(salvo.every((launch) => launch.source === 'jet:STRIKER')).toBe(true);
        expect(salvo.length).toBe(level >= 6 ? 2 : 1);
      }
    }
  );
});
