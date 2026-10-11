import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import {
  AttackDirector,
  getAttackTokenCount,
  type IDirectedJet,
} from '@/features/enemy/AttackDirector';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import { createAttackOrders, type AttackRequest } from '@/features/enemy/doctrine/DoctrineTypes';
import {
  DEG,
  DT,
  FleetRig,
  SIM_TEST_TIMEOUT,
  SPEC,
  SystemRig,
  bearingGap,
  breathe,
  pointAround,
  seededGameRandom,
  seededRandom,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 攻击令牌导演（敌机机队重做，规格 §2.1 / §2.2 / §2.9）：
 * - 同时对玩家发动攻击的敌机数有上限（令牌数），随关卡升、随难度档增减，Boss 战固定 2 个；
 * - 没有令牌的敌机不对玩家开火；航路结束 / 阵亡 / 被瘫痪时令牌交还；
 * - 两架以上同时持令牌时，导演指派的进入方位（从玩家看）两两至少相隔 60°。
 *
 * 令牌数的具体表（1–2 关 2 个……）是可调的起始值，这里只钉规则：至少 1 个、逐关不减、
 * 简单档不多于普通档、困难档多于普通档、Boss 战恒为 2。
 */

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DIFFICULTIES = [1, 2, 3, 4, 5];
const NORMAL = 3;
/** 浮点误差余量（弧度） */
const ANGLE_EPSILON = 1e-6;

describe('attack token count (spec §2.1, §2.9)', () => {
  it('is a whole number of at least one for every level and difficulty', () => {
    for (const level of LEVELS) {
      for (const difficulty of DIFFICULTIES) {
        const tokens = getAttackTokenCount(level, difficulty, false);
        expect(Number.isInteger(tokens), `level ${level}, difficulty ${difficulty}`).toBe(true);
        expect(tokens, `level ${level}, difficulty ${difficulty}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it.each(DIFFICULTIES)('never drops from one level to the next (difficulty %i)', (difficulty) => {
    for (let level = 2; level <= 10; level++) {
      expect(
        getAttackTokenCount(level, difficulty, false),
        `level ${level} against level ${level - 1}`
      ).toBeGreaterThanOrEqual(getAttackTokenCount(level - 1, difficulty, false));
    }
  });

  it('allows more simultaneous attackers at the end of the campaign than at the start', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(
        getAttackTokenCount(10, difficulty, false),
        `difficulty ${difficulty}`
      ).toBeGreaterThan(getAttackTokenCount(1, difficulty, false));
    }
  });

  it.each(LEVELS)('gives Very Easy and Easy fewer attackers than Normal at level %i', (level) => {
    const normal = getAttackTokenCount(level, NORMAL, false);
    for (const easy of [1, 2]) {
      const tokens = getAttackTokenCount(level, easy, false);
      // 普通档已经是 1 个时不能再少：最少 1 个
      if (normal > 1) expect(tokens, `difficulty ${easy}`).toBeLessThan(normal);
      else expect(tokens, `difficulty ${easy}`).toBe(1);
    }
  });

  it.each(LEVELS)('gives Hard and Expert more attackers than Normal at level %i', (level) => {
    const normal = getAttackTokenCount(level, NORMAL, false);
    for (const hard of [4, 5]) {
      expect(getAttackTokenCount(level, hard, false), `difficulty ${hard}`).toBeGreaterThan(normal);
    }
  });

  it('is a fixed two in a boss fight, whatever the level or difficulty', () => {
    for (const level of LEVELS) {
      for (const difficulty of DIFFICULTIES) {
        expect(
          getAttackTokenCount(level, difficulty, true),
          `level ${level}, difficulty ${difficulty}`
        ).toBe(2);
      }
    }
  });

  it('stays a usable number for broken inputs', () => {
    for (const level of [Number.NaN, Infinity, -Infinity, -3, 0, 99]) {
      for (const difficulty of [Number.NaN, Infinity, -1, 0, 42]) {
        for (const boss of [false, true]) {
          const tokens = getAttackTokenCount(level, difficulty, boss);
          expect(Number.isInteger(tokens), `${level} / ${difficulty} / ${boss}`).toBe(true);
          expect(tokens).toBeGreaterThanOrEqual(1);
          expect(tokens).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 导演本身：用假敌机（只实现导演要看的那几样）推进
// ---------------------------------------------------------------------------------------------

interface FakeJet extends IDirectedJet {
  alive: boolean;
  stunned: boolean;
  position: THREE.Vector3;
  request: AttackRequest | null;
}

function fakeJet(position: THREE.Vector3, request: Partial<AttackRequest> | null = {}): FakeJet {
  const jet: FakeJet = {
    orders: createAttackOrders(),
    alive: true,
    stunned: false,
    position: position.clone(),
    request:
      request === null
        ? null
        : {
            wants: true,
            desiredBearing: Number.NaN,
            bearingPriority: 1,
            pairsOpposite: false,
            ...request,
          },
    isAlive: () => jet.alive,
    isStunned: () => jet.stunned,
    getMesh: () => ({ position: jet.position }),
    getAttackRequest: () => jet.request,
  };
  return jet;
}

function holdersOf(jets: readonly FakeJet[]): FakeJet[] {
  return jets.filter((jet) => jet.orders.hasToken);
}

/** 所有持令牌者的指派方位两两之间的最小夹角（弧度）；不足两架时为 Infinity */
function smallestBearingGap(holders: ReadonlyArray<{ orders: { bearing: number } }>): number {
  let smallest = Infinity;
  for (let i = 0; i < holders.length; i++) {
    for (let j = i + 1; j < holders.length; j++) {
      smallest = Math.min(
        smallest,
        bearingGap(holders[i].orders.bearing, holders[j].orders.bearing)
      );
    }
  }
  return smallest;
}

function ring(count: number, radius: number, origin: THREE.Vector3): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        origin.x + Math.sin(angle) * radius,
        origin.y,
        origin.z + Math.cos(angle) * radius
      )
    );
  }
  return points;
}

describe('AttackDirector', () => {
  const player = new THREE.Vector3(40, 250, -90);
  let director: AttackDirector;

  beforeEach(() => {
    director = new AttackDirector();
  });

  describe('how many may attack at once', () => {
    it.each([1, 2, 3, 4, 5, 6])('hands out %i tokens when more jets than that ask', (capacity) => {
      const jets = ring(9, 300, player).map((position) => fakeJet(position));
      for (let step = 0; step < 30; step++) {
        director.update(DT, jets, player, capacity);
        expect(holdersOf(jets).length).toBeLessThanOrEqual(capacity);
      }
      expect(holdersOf(jets)).toHaveLength(capacity);
    });

    it('hands out one token per asking jet when fewer ask than the limit', () => {
      const jets = ring(2, 300, player).map((position) => fakeJet(position));
      director.update(DT, jets, player, 5);
      expect(holdersOf(jets)).toHaveLength(2);
    });

    it('gives nothing to a jet that is not asking', () => {
      const quiet = fakeJet(new THREE.Vector3(140, 250, -90), { wants: false });
      const asking = fakeJet(new THREE.Vector3(-60, 250, -90));
      for (let step = 0; step < 120; step++) director.update(DT, [quiet, asking], player, 3);
      expect(quiet.orders.hasToken).toBe(false);
      expect(asking.orders.hasToken).toBe(true);
    });

    it('gives nothing to a jet without a doctrine (a wingman-style jet)', () => {
      const legacy = fakeJet(new THREE.Vector3(140, 250, -90), null);
      for (let step = 0; step < 120; step++) director.update(DT, [legacy], player, 3);
      expect(legacy.orders.hasToken).toBe(false);
    });

    it('gives nothing to a dead or stunned jet, however long it asks', () => {
      const dead = fakeJet(new THREE.Vector3(140, 250, -90));
      dead.alive = false;
      const stunned = fakeJet(new THREE.Vector3(-60, 250, -90));
      stunned.stunned = true;
      for (let step = 0; step < 120; step++) director.update(DT, [dead, stunned], player, 3);
      expect(dead.orders.hasToken).toBe(false);
      expect(stunned.orders.hasToken).toBe(false);
    });

    it('takes every token back when there is no player to attack', () => {
      const jets = ring(4, 300, player).map((position) => fakeJet(position));
      director.update(DT, jets, player, 3);
      expect(holdersOf(jets)).toHaveLength(3);

      director.update(DT, jets, null, 3);
      expect(holdersOf(jets)).toHaveLength(0);
    });

    it('takes tokens back at once when the limit drops (entering a boss fight)', () => {
      const jets = ring(8, 300, player).map((position) => fakeJet(position));
      director.update(DT, jets, player, 5);
      expect(holdersOf(jets)).toHaveLength(5);

      director.update(DT, jets, player, 2);
      expect(holdersOf(jets)).toHaveLength(2);
    });

    it.each([0, -1, Number.NaN, -Infinity])('hands out nothing for a limit of %s', (capacity) => {
      const jets = ring(4, 300, player).map((position) => fakeJet(position));
      director.update(DT, jets, player, capacity);
      expect(holdersOf(jets)).toHaveLength(0);
    });
  });

  describe('when a token comes back', () => {
    function holderAndWaiter(): { holder: FakeJet; waiter: FakeJet; jets: FakeJet[] } {
      const first = fakeJet(new THREE.Vector3(340, 250, -90));
      const second = fakeJet(new THREE.Vector3(-260, 250, -90));
      const jets = [first, second];
      director.update(DT, jets, player, 1);
      const holder = first.orders.hasToken ? first : second;
      const waiter = holder === first ? second : first;
      expect(holder.orders.hasToken).toBe(true);
      expect(waiter.orders.hasToken).toBe(false);
      return { holder, waiter, jets };
    }

    it('releases it when the run ends and passes it to the jet that was waiting', () => {
      const { holder, waiter, jets } = holderAndWaiter();
      if (holder.request) holder.request.wants = false;
      director.update(DT, jets, player, 1);
      expect(holder.orders.hasToken).toBe(false);
      expect(waiter.orders.hasToken).toBe(true);
    });

    it('releases it when the jet dies', () => {
      const { holder, waiter, jets } = holderAndWaiter();
      holder.alive = false;
      director.update(DT, jets, player, 1);
      expect(holder.orders.hasToken).toBe(false);
      expect(waiter.orders.hasToken).toBe(true);
    });

    it('releases it when the jet is stunned', () => {
      const { holder, waiter, jets } = holderAndWaiter();
      holder.stunned = true;
      director.update(DT, jets, player, 1);
      expect(holder.orders.hasToken).toBe(false);
      expect(waiter.orders.hasToken).toBe(true);
    });

    it('lets every asking jet have a turn when there is one token for many', () => {
      const jets = ring(5, 300, player).map((position) => fakeJet(position));
      const served = new Set<FakeJet>();
      // 每架拿到令牌后飞 2 秒的航路就交还
      const heldFor = new Map<FakeJet, number>();
      for (let step = 0; step < 60 * 60; step++) {
        director.update(DT, jets, player, 1);
        for (const jet of jets) {
          if (!jet.request) continue;
          if (jet.orders.hasToken) {
            served.add(jet);
            const held = (heldFor.get(jet) ?? 0) + DT;
            heldFor.set(jet, held);
            if (held >= 2) {
              jet.request.wants = false;
              heldFor.set(jet, 0);
            }
          } else {
            jet.request.wants = true;
          }
        }
      }
      expect(served.size).toBe(jets.length);
    });
  });

  describe('approach bearings (spec §2.2)', () => {
    it('gives each holder a bearing it can read', () => {
      const jets = ring(3, 300, player).map((position) => fakeJet(position));
      director.update(DT, jets, player, 3);
      for (const jet of holdersOf(jets)) {
        expect(Number.isFinite(jet.orders.bearing)).toBe(true);
      }
    });

    it.each([2, 3, 4, 5, 6])(
      'keeps %i holders at least 60° apart even when they all sit on one bearing',
      (capacity) => {
        // 一个波次的敌机成群从同一方向来：全部挤在玩家的同一个方位上
        const jets: FakeJet[] = [];
        for (let i = 0; i < 8; i++) {
          jets.push(
            fakeJet(new THREE.Vector3(player.x + 300 + i * 12, player.y, player.z + i * 3))
          );
        }
        for (let step = 0; step < 60; step++) {
          director.update(DT, jets, player, capacity);
          const holders = holdersOf(jets);
          if (holders.length >= 2) {
            expect(smallestBearingGap(holders)).toBeGreaterThanOrEqual(
              SPEC.MIN_BEARING_GAP - ANGLE_EPSILON
            );
          }
        }
        expect(holdersOf(jets)).toHaveLength(capacity);
      }
    );

    it('keeps holders that all want the same bearing (the player’s six) at least 60° apart', () => {
      const six = Math.PI;
      const jets = ring(6, 280, player).map((position) =>
        fakeJet(position, { desiredBearing: six, bearingPriority: 2 })
      );
      for (let step = 0; step < 60; step++) {
        director.update(DT, jets, player, 4);
        const holders = holdersOf(jets);
        if (holders.length >= 2) {
          expect(smallestBearingGap(holders)).toBeGreaterThanOrEqual(
            SPEC.MIN_BEARING_GAP - ANGLE_EPSILON
          );
        }
      }
      expect(holdersOf(jets)).toHaveLength(4);
    });

    it('holds the 60° rule through a long, messy fight (seeded fuzz)', async () => {
      // 每一步都用普通的 if 检查，出问题才抛错：一步一个 expect 在几万步里太贵
      for (let seed = 1; seed <= 16; seed++) {
        const random = seededRandom(seed * 7717);
        const fuzzDirector = new AttackDirector();
        const centre = new THREE.Vector3(random() * 400 - 200, 200, random() * 400 - 200);
        const capacity = 2 + Math.floor(random() * 5);
        const count = 3 + Math.floor(random() * 8);
        const clustered = random() < 0.5;
        const jets: FakeJet[] = [];
        const orbit: number[] = [];
        for (let i = 0; i < count; i++) {
          const bearing = clustered ? random() * 0.4 : random() * Math.PI * 2;
          const distance = 120 + random() * 600;
          jets.push(
            fakeJet(
              new THREE.Vector3(
                centre.x + Math.sin(bearing) * distance,
                centre.y + random() * 80 - 40,
                centre.z + Math.cos(bearing) * distance
              ),
              {
                bearingPriority: Math.floor(random() * 3),
                desiredBearing: random() < 0.4 ? random() * Math.PI * 2 - Math.PI : Number.NaN,
                pairsOpposite: random() < 0.4,
              }
            )
          );
          orbit.push((random() - 0.5) * 0.6);
        }

        for (let step = 0; step < 600; step++) {
          // 敌机绕着玩家飞；随机有人结束航路、被瘫痪、阵亡、重新申请
          for (let i = 0; i < jets.length; i++) {
            const jet = jets[i];
            const offset = jet.position.clone().sub(centre);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit[i] * DT);
            jet.position.copy(centre).add(offset);
            const roll = random();
            if (jet.request) {
              if (roll < 0.004) jet.request.wants = !jet.request.wants;
              else if (roll < 0.006) jet.stunned = !jet.stunned;
              else if (roll < 0.0065) jet.alive = false;
              if (random() < 0.002) jet.request.desiredBearing = random() * Math.PI * 2 - Math.PI;
            }
          }
          fuzzDirector.update(DT, jets, centre, capacity);

          const holders = holdersOf(jets);
          if (holders.length > capacity) {
            throw new Error(
              `seed ${seed}, step ${step}: ${holders.length} holders, limit ${capacity}`
            );
          }
          for (const holder of holders) {
            const able = holder.alive && !holder.stunned;
            const asked = holder.request?.wants === true;
            if (!able || !asked || !Number.isFinite(holder.orders.bearing)) {
              throw new Error(
                `seed ${seed}, step ${step}: a holder is able=${able}, asked=${asked}, ` +
                  `bearing=${holder.orders.bearing}`
              );
            }
          }
          if (holders.length >= 2) {
            const gap = smallestBearingGap(holders);
            if (gap < SPEC.MIN_BEARING_GAP - ANGLE_EPSILON) {
              throw new Error(
                `seed ${seed}, step ${step}: ${holders.length} holders, closest bearings ` +
                  `${(gap / DEG).toFixed(2)}° apart`
              );
            }
          }
        }
        await breathe();
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 真实敌机 + 条令 + 导演
// ---------------------------------------------------------------------------------------------

describe('tokens with real jets', () => {
  let rig: FleetRig;

  afterEach(() => {
    rig.dispose();
  });

  /** 一支混编机队围着玩家：五种机型各一到两架 */
  function mixedFleet(seed: number, capacity: number, level = 3): FleetRig {
    const fleet = new FleetRig({ capacity, level, seed });
    const random = seededRandom(seed * 31 + 5);
    const types = [
      EnemyType.SCOUT,
      EnemyType.SCOUT,
      EnemyType.FIGHTER,
      EnemyType.FIGHTER,
      EnemyType.HEAVY,
      EnemyType.SNIPER,
      EnemyType.ACE,
    ];
    for (const type of types) {
      fleet.addJet(
        type,
        pointAround(fleet.player, 320 + random() * 260, random() * Math.PI * 2, random() * 80 - 40)
      );
    }
    return fleet;
  }

  /** 玩家的飞法：直飞 / 持续盘旋 / 来回急转 */
  const PILOTS: Record<string, (rig: FleetRig) => void> = {
    straight: () => undefined,
    circling: (fleet) => fleet.turnPlayer(0.5 * DT),
    jinking: (fleet) => fleet.turnPlayer((Math.floor(fleet.time / 3) % 2 === 0 ? 1.2 : -1.2) * DT),
  };

  it.each([1, 2, 3, 4])(
    'never has more than %i jets holding a token through 40 s of fighting',
    async (capacity) => {
      for (const [name, pilot] of Object.entries(PILOTS)) {
        for (const seed of [11, 12]) {
          rig?.dispose();
          rig = mixedFleet(seed, capacity);
          rig.pilot = pilot;
          let most = 0;
          rig.run(40, () => {
            const holding = rig.holders().length;
            most = Math.max(most, holding);
            if (holding > capacity) {
              throw new Error(
                `${name}, seed ${seed}: ${holding} holders at t=${rig.time.toFixed(2)}`
              );
            }
          });
          // 七架敌机抢令牌：上限确实被用到了
          expect(most, `${name}, seed ${seed}`).toBe(capacity);
          await breathe();
        }
      }
    }
  );

  it('only ever lets a token holder fire at the player', async () => {
    let fired = 0;
    for (const [name, pilot] of Object.entries(PILOTS)) {
      for (const seed of [21, 22, 23]) {
        rig?.dispose();
        rig = mixedFleet(seed, 2, seed === 23 ? 7 : 3);
        rig.pilot = pilot;
        rig.run(60);
        for (const shot of rig.shots) {
          // 重型机的尾炮是自卫武器，不占令牌（规格 §3 HEAVY；见 EnemyDoctrineHeavy.test.ts）
          const tailGun = shot.type === EnemyType.HEAVY && shot.weapon === 'bullet';
          if (!shot.hadToken && !tailGun) {
            throw new Error(
              `${name}, seed ${seed}: ${shot.type} fired a ${shot.weapon} at ` +
                `t=${shot.time.toFixed(2)} without a token`
            );
          }
        }
        fired += rig.shots.length;
        await breathe();
      }
    }
    expect(fired, 'the fleets did attack').toBeGreaterThan(200);
  });

  it('keeps the bearings of simultaneous holders at least 60° apart through a fight', async () => {
    let checked = 0;
    for (const [name, pilot] of Object.entries(PILOTS)) {
      for (const [seed, capacity] of [
        [31, 2],
        [32, 3],
        [33, 5],
      ]) {
        rig?.dispose();
        rig = mixedFleet(seed, capacity, 9);
        rig.pilot = pilot;
        rig.run(60, () => {
          const holders = rig.holders();
          if (holders.length < 2) return;
          checked++;
          const gap = smallestBearingGap(holders);
          if (!(gap >= SPEC.MIN_BEARING_GAP - ANGLE_EPSILON)) {
            throw new Error(
              `${name}, seed ${seed}: ${holders.length} holders, closest bearings ` +
                `${(gap / DEG).toFixed(2)}° apart at t=${rig.time.toFixed(2)}`
            );
          }
        });
        await breathe();
      }
    }
    expect(checked, 'two or more held tokens at the same time').toBeGreaterThan(1000);
  });

  it('passes a single token round the fleet: every armed jet gets to attack', () => {
    rig = new FleetRig({ capacity: 1, seed: 41 });
    const jets = [
      rig.addJet(EnemyType.FIGHTER, pointAround(rig.player, 350, 30 * DEG)),
      rig.addJet(EnemyType.FIGHTER, pointAround(rig.player, 350, 150 * DEG)),
      rig.addJet(EnemyType.SCOUT, pointAround(rig.player, 350, -90 * DEG)),
    ];
    rig.pilot = PILOTS.circling;
    rig.run(90, () => {
      expect(rig.holders().length).toBeLessThanOrEqual(1);
    });
    for (const jet of jets) {
      expect(
        rig.shots.some((shot) => shot.jet === jet),
        `${jet.getConfig().type} #${jets.indexOf(jet)} fired`
      ).toBe(true);
    }
  });

  it('frees the token of a jet that is shot down, in the same instant', () => {
    rig = new FleetRig({ capacity: 1, seed: 42 });
    const first = rig.addJet(EnemyType.FIGHTER, pointAround(rig.player, 300, 170 * DEG));
    const second = rig.addJet(EnemyType.FIGHTER, pointAround(rig.player, 340, -150 * DEG));
    expect(rig.runUntil(() => rig.holders().length === 1, 5)).toBe(true);
    const holder = rig.holders()[0];
    const other = holder === first ? second : first;

    holder.takeDamage(1e6);
    expect(holder.isAlive()).toBe(false);
    expect(holder.hasAttackToken()).toBe(false);

    // 空出来的令牌轮到另一架
    expect(rig.runUntil(() => other.hasAttackToken(), 5)).toBe(true);
  });

  it('frees the token of a jet that is stunned, and it gets none while stunned', () => {
    rig = new FleetRig({ capacity: 1, seed: 43 });
    const first = rig.addJet(EnemyType.FIGHTER, pointAround(rig.player, 300, 170 * DEG));
    const second = rig.addJet(EnemyType.FIGHTER, pointAround(rig.player, 340, -150 * DEG));
    expect(rig.runUntil(() => rig.holders().length === 1, 5)).toBe(true);
    const holder = rig.holders()[0];
    const other = holder === first ? second : first;

    holder.applyStun(3);
    expect(holder.hasAttackToken()).toBe(false);
    let otherGotIt = false;
    rig.run(2.9, () => {
      expect(holder.hasAttackToken(), 'no token while stunned').toBe(false);
      otherGotIt ||= other.hasAttackToken();
    });
    expect(otherGotIt, 'the freed token went to the other jet').toBe(true);
  });

  it('takes every token back while the player cannot be attacked, and nobody fires', () => {
    rig = mixedFleet(44, 3);
    rig.run(8);
    expect(rig.holders().length).toBeGreaterThan(0);

    rig.playerTargetable = false;
    rig.step();
    expect(rig.holders()).toHaveLength(0);
    const before = rig.shots.length;
    rig.run(6, () => {
      expect(rig.holders()).toHaveLength(0);
    });
    expect(rig.shots.length).toBe(before);
  });
});

// ---------------------------------------------------------------------------------------------
// 接进 EnemySystem：波次敌机与 Boss 小兵走的都是这条路
// ---------------------------------------------------------------------------------------------

describe('director wired into EnemySystem', () => {
  let rig: SystemRig | null = null;
  let randomSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(20261010));
  });

  afterEach(() => {
    rig?.dispose();
    rig = null;
    EventBus.clear();
    // 只还原本文件替换的 Math.random（全局 setup 里的尾迹替身不能被 restoreAllMocks 清掉）
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  function crowd(system: SystemRig, count: number): void {
    for (let i = 0; i < count; i++) {
      system.spawn(
        i % 3 === 0 ? EnemyType.SCOUT : EnemyType.FIGHTER,
        pointAround(system.player, 300 + (i % 4) * 30, (i / count) * Math.PI * 2, (i % 3) * 20 - 20)
      );
    }
  }

  /** 一段交战里同时持令牌的最大架数 */
  function mostHolders(system: SystemRig, seconds: number): number {
    let most = 0;
    system.run(seconds, () => {
      most = Math.max(most, system.holders().length);
    });
    return most;
  }

  it.each([
    [1, 3],
    [4, 3],
    [7, 3],
    [10, 3],
    [1, 1],
    [10, 1],
    [5, 2],
    [5, 4],
    [10, 5],
  ])('uses exactly the token count of level %i at difficulty %i', (level, difficulty) => {
    rig = new SystemRig({ level, difficulty });
    crowd(rig, 10);
    const expected = getAttackTokenCount(level, difficulty, false);
    expect(mostHolders(rig, 12)).toBe(expected);
  });

  it.each([
    [1, 1],
    [6, 3],
    [10, 5],
  ])('uses two tokens in a boss fight at level %i, difficulty %i', (level, difficulty) => {
    rig = new SystemRig({ level, difficulty, bossFight: true });
    crowd(rig, 10);
    expect(mostHolders(rig, 12)).toBe(2);
  });

  it('drops to two tokens the moment a boss fight starts', () => {
    rig = new SystemRig({ level: 10, difficulty: 5 });
    crowd(rig, 10);
    expect(mostHolders(rig, 10)).toBeGreaterThan(2);

    rig.session.setInBossBattle(true);
    rig.step();
    expect(rig.holders().length).toBeLessThanOrEqual(2);
    expect(mostHolders(rig, 10)).toBe(2);
  });

  it('counts boss mode (the boss-rush mode) as a boss fight too', () => {
    rig = new SystemRig({ level: 10, difficulty: 5 });
    rig.session.setMode('boss');
    crowd(rig, 10);
    expect(mostHolders(rig, 12)).toBe(2);
  });

  it('only lets token holders fire, and keeps holder bearings 60° apart, in the live system', () => {
    rig = new SystemRig({ level: 6, difficulty: 3 });
    const system = rig;
    crowd(system, 6);
    system.spawn(EnemyType.SNIPER, pointAround(system.player, 450, 100 * DEG));
    system.spawn(EnemyType.HEAVY, pointAround(system.player, 400, -60 * DEG));
    system.pilot = (current) => current.turnPlayer(0.4 * DT);
    const capacity = getAttackTokenCount(6, 3, false);
    let paired = 0;
    system.run(45, () => {
      const holders = system.holders();
      expect(holders.length).toBeLessThanOrEqual(capacity);
      if (holders.length >= 2) {
        paired++;
        expect(smallestBearingGap(holders)).toBeGreaterThanOrEqual(
          SPEC.MIN_BEARING_GAP - ANGLE_EPSILON
        );
      }
    });
    expect(paired).toBeGreaterThan(500);
    expect(system.shots.length, 'the fleet attacked').toBeGreaterThan(50);
    for (const shot of system.shots) {
      const tailGun =
        shot.jet?.getConfig().type === EnemyType.HEAVY && shot.payload.weapon === 'bullet';
      expect(
        shot.hadToken || tailGun,
        `${shot.jet?.getConfig().type} fired at t=${shot.time.toFixed(2)} without a token`
      ).toBe(true);
    }
  });
});
