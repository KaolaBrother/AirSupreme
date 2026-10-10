import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  LiveFire,
  SIM_TEST_TIMEOUT,
  SystemRig,
  angleBetween,
  breathe,
  groupBursts,
  pointAround,
  seededGameRandom,
  shadowPilot,
  type RigShot,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 重型机（HEAVY，炮艇机）的打法，规格 §3：
 * 高炮扇面——每隔一段时间朝玩家的预测位置打出 3 发慢速高炮弹（约 60 米/秒，±8° 展开），
 * 第 6 关起 5 发，要靠机动躲开；尾炮——只对正后方 250 米以内的玩家打瞄准的单发，从侧面或下方
 * 进攻是安全的；对锁定没有任何反应（躲不了），照打不误。
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

/** 一场交战里的全部扇面：同一步、同一架敌机打出的高炮弹算一个扇面 */
function fansOf(shots: readonly RigShot[]): RigShot[][] {
  return groupBursts(
    shots.filter((shot) => shot.weapon === 'heavy-shell'),
    0.01
  );
}

/** 扇面的中线方向（各发方向的平均） */
function centreOf(fan: readonly RigShot[]): THREE.Vector3 {
  const centre = new THREE.Vector3();
  for (const shot of fan) centre.add(shot.direction);
  return centre.normalize();
}

/** 以 speed 米/秒的弹丸拦截匀速直线飞行的玩家，应当瞄准的方向（迭代解拦截时间） */
function interceptDirection(shot: RigShot, speed: number): THREE.Vector3 {
  let time = 0;
  const aim = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    aim.copy(shot.playerPosition).addScaledVector(shot.playerVelocity, time).sub(shot.origin);
    time = aim.length() / speed;
  }
  return aim.normalize();
}

describe('HEAVY flak fan (spec §3)', () => {
  it.each([1, 2, 5])('level %s: a fan is 3 slow shells fired together', (level) => {
    const current = makeRig({ capacity: 2, seed: 111, level });
    current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 60 * DEG));
    current.run(40);
    const fans = fansOf(current.shots);
    expect(fans.length, 'fans fired').toBeGreaterThanOrEqual(4);
    for (const fan of fans) expect(fan.length).toBe(3);
  });

  it.each([6, 7, 10])('level %s: a fan is 5 shells', (level) => {
    const current = makeRig({ capacity: 2, seed: 111, level });
    current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 60 * DEG));
    current.run(40);
    const fans = fansOf(current.shots);
    expect(fans.length, 'fans fired').toBeGreaterThanOrEqual(4);
    for (const fan of fans) expect(fan.length).toBe(5);
  });

  it.each([1, 6])(
    'level %s: the fan is spread 8 degrees either side of its centre line',
    (level) => {
      const current = makeRig({ capacity: 2, seed: 112, level });
      current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 60 * DEG));
      current.pilot = (active) => active.turnPlayer(0.2 * DT);
      current.run(40);
      const fans = fansOf(current.shots);
      expect(fans.length).toBeGreaterThanOrEqual(4);
      for (const fan of fans) {
        const centre = centreOf(fan);
        const offsets = fan.map((shot) => angleBetween(shot.direction, centre) / DEG);
        expect(Math.max(...offsets), 'outermost shell off the centre line').toBeGreaterThan(7.5);
        expect(Math.max(...offsets)).toBeLessThan(8.5);
        // 中间有一发沿中线，其余两两对称、各不相同
        expect(Math.min(...offsets)).toBeLessThan(0.5);
        for (let i = 0; i < fan.length; i++) {
          for (let j = i + 1; j < fan.length; j++) {
            expect(
              angleBetween(fan[i].direction, fan[j].direction) / DEG,
              'two shells of one fan never share a line'
            ).toBeGreaterThan(2);
          }
        }
        const sorted = [...offsets].sort((a, b) => a - b);
        for (let i = 1; i + 1 < sorted.length; i += 2) {
          expect(Math.abs(sorted[i] - sorted[i + 1]), 'the fan is symmetric').toBeLessThan(0.2);
        }
        for (const shot of fan) expect(Math.abs(shot.direction.length() - 1)).toBeLessThan(1e-6);
      }
    }
  );

  it('shells are slow (about 60 m/s) and every shell of a fan flies at the same speed', () => {
    const current = makeRig({ capacity: 2, seed: 113, level: 6 });
    current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 60 * DEG));
    current.run(30);
    const shells = current.shots.filter((shot) => shot.weapon === 'heavy-shell');
    expect(shells.length).toBeGreaterThan(10);
    for (const shell of shells) {
      expect(shell.speed).toBeGreaterThanOrEqual(50);
      expect(shell.speed).toBeLessThanOrEqual(70);
      expect(shell.speed).toBe(shells[0].speed);
    }
  });

  it('is aimed at where a crossing player will be, not at where the player is', async () => {
    let checked = 0;
    for (const seed of [114, 115]) {
      for (const offset of [70, 90, -80]) {
        const current = makeRig({ capacity: 2, seed });
        current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, offset * DEG));
        current.run(20);
        for (const fan of fansOf(current.shots)) {
          const shot = fan[0];
          const now = shot.playerPosition.clone().sub(shot.origin).normalize();
          const lead = interceptDirection(shot, shot.speed ?? 60);
          // 只看玩家确实在横穿、提前量明显的扇面
          if (angleBetween(now, lead) < 12 * DEG) continue;
          checked++;
          const centre = centreOf(fan);
          expect(
            angleBetween(centre, lead),
            `fan at ${shot.time.toFixed(1)} s: closer to the intercept line than to the player`
          ).toBeLessThan(angleBetween(centre, now));
          // 提前量在玩家前进的一侧
          expect(centre.clone().sub(now).dot(shot.playerVelocity)).toBeGreaterThan(0);
        }
      }
      await breathe();
    }
    expect(checked, 'crossing fans checked').toBeGreaterThan(8);
  });

  it('fans come one at a time: at least 1.5 s apart, and each makes exactly one sound', () => {
    const current = makeRig({ capacity: 2, seed: 116, level: 6 });
    current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 60 * DEG));
    current.pilot = (active) => active.turnPlayer(0.2 * DT);
    current.run(60);
    const fans = fansOf(current.shots);
    expect(fans.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < fans.length; i++) {
      expect(fans[i][0].time - fans[i - 1][0].time).toBeGreaterThan(1.5);
    }
    for (const fan of fans) {
      // 一个扇面只有一发带开火音，其余静音
      expect(fan.filter((shot) => !shot.quiet).length).toBe(1);
    }
  });

  it('a player who flies straight through the barrage is hit; one who turns after each fan is not', async () => {
    /** 重型机在玩家前方 offset 度；dodge = 每个扇面打出后转 1 秒弯，下一次换个方向 */
    function hitsTaken(offset: number, dodge: boolean): { hits: number; fans: number } {
      const current = makeRig({ capacity: 2, seed: 117 });
      current.addJet(EnemyType.HEAVY, pointAround(current.player, 350, offset * DEG), {
        config: { accuracy: 1 },
      });
      const live = new LiveFire(current);
      let lastFan = -10;
      let seen = 0;
      let side = 1;
      current.pilot = (active) => {
        for (; seen < active.shots.length; seen++) {
          if (active.shots[seen].weapon === 'heavy-shell' && active.shots[seen].time > lastFan) {
            lastFan = active.shots[seen].time;
            side = -side;
          }
        }
        if (dodge && active.time - lastFan < 1) active.turnPlayer(side * 1.2 * DT);
      };
      current.run(60, () => live.step());
      const result = { hits: live.hits.length, fans: fansOf(current.shots).length };
      live.dispose();
      return result;
    }

    for (const offset of [0, 30, 60]) {
      const straight = hitsTaken(offset, false);
      expect(straight.fans, `fans fired, ${offset} degrees`).toBeGreaterThanOrEqual(2);
      expect(
        straight.hits,
        `shells that hit a straight-flying player, ${offset} degrees`
      ).toBeGreaterThan(0);
      const dodging = hitsTaken(offset, true);
      expect(dodging.fans).toBeGreaterThanOrEqual(2);
      expect(dodging.hits, `shells that hit a dodging player, ${offset} degrees`).toBe(0);
      await breathe();
    }
  });

  it('a Heavy without a token fires no flak', () => {
    const current = makeRig({ capacity: 0, seed: 118 });
    current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 60 * DEG));
    current.run(40);
    expect(current.shots.filter((shot) => shot.weapon === 'heavy-shell').length).toBe(0);
  });
});

describe('HEAVY tail gun (spec §3)', () => {
  /** 玩家固定在重型机机体坐标系里的某个位置（机头指着它），打 seconds 秒；返回尾炮弹（普通机炮弹） */
  function sitAt(
    back: number,
    right: number,
    up: number,
    options: { capacity?: number; seconds?: number } = {}
  ): { current: FleetRig; heavy: EnemyAI; tailShots: RigShot[] } {
    const current = makeRig({ capacity: options.capacity ?? 2, seed: 121 });
    const heavy = current.addJet(EnemyType.HEAVY, pointAround(current.player, 300, 0), {
      heading: new THREE.Vector3(0, 0, 1),
    });
    current.pilot = shadowPilot(heavy, back, right, up);
    current.run(options.seconds ?? 20);
    return {
      current,
      heavy,
      tailShots: current.shots.filter((shot) => shot.weapon === 'bullet'),
    };
  }

  it.each([120, 200, 240])(
    'a player sitting %s m directly astern is shot at with single aimed rounds',
    (back) => {
      const { tailShots } = sitAt(back, 0, 0);
      expect(tailShots.length, 'tail-gun rounds in 20 s').toBeGreaterThanOrEqual(5);
      for (const shot of tailShots) {
        // 瞄准的：指向玩家
        const toPlayer = shot.playerPosition.clone().sub(shot.origin);
        expect(angleBetween(shot.direction, toPlayer) / DEG).toBeLessThan(3);
        expect(shot.distance).toBeLessThanOrEqual(250);
        // 向后打：玩家在它的机尾方向
        expect(angleBetween(shot.jetForward, toPlayer) / DEG).toBeGreaterThan(150);
      }
      // 单发：不是点射
      for (let i = 1; i < tailShots.length; i++) {
        expect(tailShots[i].time - tailShots[i - 1].time).toBeGreaterThan(0.5);
      }
    }
  );

  it('a player astern but beyond 250 m is left alone', () => {
    expect(sitAt(300, 0, 0).tailShots.length).toBe(0);
    expect(sitAt(400, 0, 0).tailShots.length).toBe(0);
  });

  it.each([
    ['abeam on the right, 150 m', 0, 150, 0],
    ['abeam on the left, 150 m', 0, -150, 0],
    ['directly below, 150 m', 0, 0, -150],
    ['below and behind, 45 degrees under the tail', 110, 0, -110],
    ['40 degrees off the tail, 200 m', 200 * Math.cos(40 * DEG), 200 * Math.sin(40 * DEG), 0],
    ['dead ahead, 200 m', -200, 0, 0],
  ])('the tail gun stays silent against a player %s', (_label, back, right, up) => {
    const { tailShots } = sitAt(back, right, up);
    expect(tailShots.length).toBe(0);
  });

  // 尾炮是防御武器：不占攻击令牌（规格 §3；§2.1 的“没有令牌不对玩家开火”说的是进攻航路）。
  // 里程碑 1 里尾炮要令牌，没令牌的重型机可以被白白咬尾；随里程碑 2（d90d661）改正。
  it.each([0, 2])(
    'fires at a player sitting astern even when the Heavy holds no attack token (token limit %s, taken by others)',
    (capacity) => {
      const current = makeRig({ capacity, seed: 121 });
      // 令牌先被两架战斗机占满（capacity 0 时谁也拿不到）
      for (const offset of [60, -60]) {
        current.addJet(EnemyType.FIGHTER, pointAround(current.player, 170, offset * DEG));
      }
      const heavy = current.addJet(EnemyType.HEAVY, pointAround(current.player, 300, 0), {
        heading: new THREE.Vector3(0, 0, 1),
      });
      current.pilot = shadowPilot(heavy, 200, 0, 0);
      let stepsWithToken = 0;
      current.run(20, () => {
        if (heavy.hasAttackToken()) stepsWithToken++;
      });
      const fromHeavy = current.shots.filter((shot) => shot.jet === heavy);
      const unarmedSteps = fromHeavy.filter((shot) => !shot.hadToken);
      expect(unarmedSteps.length, 'tail-gun rounds fired without a token').toBeGreaterThanOrEqual(
        5
      );
      for (const shot of unarmedSteps) {
        // 没有令牌时只有尾炮：普通机炮弹、瞄着玩家、朝机尾方向、250 米以内
        expect(shot.weapon).toBe('bullet');
        const toPlayer = shot.playerPosition.clone().sub(shot.origin);
        expect(angleBetween(shot.direction, toPlayer) / DEG).toBeLessThan(3);
        expect(angleBetween(shot.jetForward, toPlayer) / DEG).toBeGreaterThan(150);
        expect(shot.distance).toBeLessThanOrEqual(250);
      }
      if (capacity === 0) expect(stepsWithToken).toBe(0);
    }
  );

  it('without a token the tail gun fires as often as with one: it is not an attack run', () => {
    const withToken = sitAt(200, 0, 0, { capacity: 2 });
    const without = sitAt(200, 0, 0, { capacity: 0 });
    expect(without.heavy.hasAttackToken()).toBe(false);
    expect(without.tailShots.length).toBeGreaterThanOrEqual(5);
    expect(
      Math.abs(without.tailShots.length - withToken.tailShots.length),
      `rounds in 20 s: ${without.tailShots.length} without a token, ${withToken.tailShots.length} with`
    ).toBeLessThanOrEqual(2);
    // 没有令牌：一发高炮弹也没有
    expect(without.current.shots.filter((shot) => shot.weapon === 'heavy-shell').length).toBe(0);
  });

  // FINDING: spec §3a — "Player not targetable (respawning, story hold, dead): no enemy weapon of
  // any kind fires — token-free weapons such as the Heavy's tail gun included — and no lock or
  // charge starts." The token-free tail gun (d90d661) is documented to keep the rule
  // ("防御性射击也只在这时打出", DoctrineContext.weaponsFree), but weaponsFree is derived only from
  // "a player position was passed in", and LevelManager always passes one. So a Heavy keeps
  // shooting its tail gun at a respawning player parked astern. Reproduce: SystemRig (real
  // EnemySystem) at level 1, one HEAVY, player held 200 m directly astern, playerTargetable = false
  // for 15 s: 12 tail-gun rounds are fired (0 token holders).
  it.fails('the tail gun stays silent while the player cannot be attacked (respawning)', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(5));
    const system = new SystemRig({ level: 1, difficulty: 3 });
    try {
      const heavy = system.spawn(EnemyType.HEAVY, pointAround(system.player, 300, 0));
      system.pilot = shadowPilot(heavy, 200, 0, 0);
      system.playerTargetable = false;
      system.run(15);
      expect(system.holders(), 'token holders while the player respawns').toHaveLength(0);
      expect(system.shots.length, 'rounds fired at a respawning player').toBe(0);
    } finally {
      system.dispose();
      randomSpy.mockRestore();
    }
  });

  it('once the player can be attacked again the tail gun is live at once', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(5));
    const system = new SystemRig({ level: 1, difficulty: 3 });
    try {
      const heavy = system.spawn(EnemyType.HEAVY, pointAround(system.player, 300, 0));
      system.pilot = shadowPilot(heavy, 200, 0, 0);
      system.playerTargetable = false;
      system.run(5);
      const before = system.shots.length;
      system.playerTargetable = true;
      system.run(15);
      expect(
        system.shots.length - before,
        'rounds in 15 s once the player is back'
      ).toBeGreaterThan(3);
    } finally {
      system.dispose();
      randomSpy.mockRestore();
    }
  });

  it('a stunned Heavy does not fire its tail gun', () => {
    const current = makeRig({ capacity: 0, seed: 121 });
    const heavy = current.addJet(EnemyType.HEAVY, pointAround(current.player, 300, 0), {
      heading: new THREE.Vector3(0, 0, 1),
    });
    current.pilot = shadowPilot(heavy, 200, 0, 0);
    current.run(6);
    expect(current.shots.length, 'rounds before the stun').toBeGreaterThan(0);
    const before = current.shots.length;
    heavy.applyStun(4);
    current.run(3.9);
    expect(current.shots.length, 'rounds fired while stunned').toBe(before);
  });
});

describe('HEAVY does not react to a lock or a missile (spec §3)', () => {
  /** 同一个种子跑两场：一场从第 3 秒起被锁定、第 6 秒起有导弹飞来，一场没有威胁 */
  function flight(threat: boolean, level: number): { path: THREE.Vector3[]; shots: RigShot[] } {
    const current = makeRig({ capacity: 2, seed: 131, level });
    const heavy = current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 40 * DEG));
    current.pilot = (active) => active.turnPlayer(0.15 * DT);
    const path: THREE.Vector3[] = [];
    current.run(40, () => {
      if (threat) {
        current.lockedJet = current.time >= 3 ? heavy : null;
        if (current.time >= 6) current.missileTargets.add(heavy);
      }
      path.push(heavy.getMesh().position.clone());
    });
    return { path, shots: [...current.shots] };
  }

  it.each([1, 6])(
    'level %s: it flies the same path and fires the same shells with or without the threat',
    (level) => {
      const calm = flight(false, level);
      const threatened = flight(true, level);
      expect(threatened.path.length).toBe(calm.path.length);
      let worst = 0;
      for (let i = 0; i < calm.path.length; i++) {
        worst = Math.max(worst, calm.path[i].distanceTo(threatened.path[i]));
      }
      expect(worst, 'largest difference between the two paths (m)').toBeLessThan(1e-6);

      expect(calm.shots.length, 'it keeps firing').toBeGreaterThan(9);
      expect(threatened.shots.length).toBe(calm.shots.length);
      for (let i = 0; i < calm.shots.length; i++) {
        expect(threatened.shots[i].time).toBeCloseTo(calm.shots[i].time, 9);
        expect(threatened.shots[i].weapon).toBe(calm.shots[i].weapon);
        expect(threatened.shots[i].direction.distanceTo(calm.shots[i].direction)).toBeLessThan(
          1e-9
        );
      }
    }
  );

  it('it keeps firing its fans all through a lock held for 30 s', () => {
    const current = makeRig({ capacity: 2, seed: 132 });
    const heavy = current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, 40 * DEG));
    current.pilot = (active) => active.turnPlayer(0.15 * DT);
    current.lockedJet = heavy;
    current.missileTargets.add(heavy);
    current.run(30);
    expect(fansOf(current.shots).length).toBeGreaterThanOrEqual(5);
  });
});
