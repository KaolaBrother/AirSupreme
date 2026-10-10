import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import { ParticleTrailRenderer } from '@/features/effects/ParticleTrailRenderer';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  HullWatch,
  SIM_TEST_TIMEOUT,
  SPEC,
  SystemRig,
  angleBetween,
  bearingGap,
  bearingOf,
  breathe,
  groupBursts,
  pointAround,
  seededGameRandom,
  type RigShot,
  type RigTell,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 隐形机（WRAITH，潜行者）的打法，规格 §3、§2.1、§2.2、§2.3、§2.7、§2.9、§3a，批次 E-X 里程碑 2：
 *
 * - 隐形周期：可见 → 0.6 秒淡出 → 隐形（最长 5 秒；已接受的出入：最短 1.5 秒）→ 0.7 秒现形预警
 *   （淡入 + 红色眼灯 + 提示音）→ 可以开火 → 至少可见 4 秒 → 重复；
 * - 隐形时：对玩家的传感器隐形（isCloaked：不能锁定、没有雷达点 / 血条 / 标记 / 机炮提前量——
 *   这些由 CoordinatorJamCloakJetMissiles / CloakedJetHud 从玩家一侧验），仍然淡淡可见
 *   （约 12–18% 不透明度），留一条淡尾迹；仍然会受伤，任何命中立刻现形并僵直 1 秒；
 * - 进攻：在玩家后方四分之一圆、约 200 米以内现形，打一轮五连发，预警结束之前绝不开火；
 * - 持令牌才进攻（§2.1）；被 EMP 瘫痪时现形（§2.7）；Boss 战里不隐形（§2.9）；
 *   玩家不可被攻击时不开火（§3a）。
 *
 * 外观从机体材质上看（HullWatch：现在的不透明度 ÷ 生成时的），不读条令的内部状态；阶段名只在
 * 失败信息里用。
 */

const FADE_SECONDS = 0.6;
const CLOAK_MAX_SECONDS = 5;
/** 已接受的出入：至少隐形 1.5 秒才现形 */
const CLOAK_MIN_SECONDS = 1.5;
const TELL_SECONDS = 0.7;
const VISIBLE_MIN_SECONDS = 4;
const STAGGER_SECONDS = 1;
const BURST_ROUNDS = 5;
/** 隐形时的不透明度（规格：约 12–18%） */
const CLOAK_OPACITY_MIN = 0.12;
const CLOAK_OPACITY_MAX = 0.18;
/** 进攻位置：玩家后方四分之一圆（离正后方 45° 以内），约 200 米以内 */
const REAR_QUARTER = 45 * DEG;
const ATTACK_DISTANCE = 200;
/** “约 200 米”与“后方四分之一圆”的宽容量 */
const ATTACK_DISTANCE_SLACK = 20;
const REAR_QUARTER_SLACK = 3 * DEG;

const PILOTS: Array<[string, (rig: FleetRig) => void]> = [
  ['straight', () => {}],
  ['gently turning', (rig) => rig.turnPlayer(0.1 * DT)],
  ['circling', (rig) => rig.turnPlayer(0.3 * DT)],
  ['jinking', (rig) => rig.turnPlayer((Math.floor(rig.time / 5) % 2 === 0 ? 0.9 : -0.6) * DT)],
];

let rig: FleetRig | null = null;

function makeRig(options: ConstructorParameters<typeof FleetRig>[0] = {}): FleetRig {
  rig?.dispose();
  rig = new FleetRig({ level: 8, capacity: 2, ...options });
  return rig;
}

afterEach(() => {
  rig?.dispose();
  rig = null;
});

// ---------------------------------------------------------------------------------------------
// 逐步记录一架隐形机，整理出隐形周期
// ---------------------------------------------------------------------------------------------

interface WraithStep {
  /** 这一步开始的时刻（与 shots / tells 里的 time 同一口径） */
  t: number;
  cloaked: boolean;
  /** 机体最淡 / 最浓部件的不透明度比值 */
  opacityMin: number;
  opacityMax: number;
  /** 机体上多出来的可见对象（现形眼灯） */
  flare: boolean;
  phase: string;
  position: THREE.Vector3;
  playerPosition: THREE.Vector3;
  playerForward: THREE.Vector3;
}

class WraithLog {
  public readonly steps: WraithStep[] = [];
  /** 生成时记下的机体材质（之后的不透明度都和它比） */
  public readonly hull: HullWatch;

  constructor(
    private readonly current: FleetRig,
    public readonly jet: EnemyAI
  ) {
    this.hull = new HullWatch(jet.getMesh());
  }

  /** 每一步之后调用 */
  public record(): void {
    const range = this.hull.opacityRange();
    this.steps.push({
      t: this.current.time - DT,
      cloaked: this.jet.isCloaked(),
      opacityMin: range.min,
      opacityMax: range.max,
      flare: this.hull.addedVisible().length > 0,
      phase: this.jet.getDoctrinePhase(),
      position: this.jet.getMesh().position.clone(),
      playerPosition: this.current.player.position.clone(),
      playerForward: this.current.player.forward.clone(),
    });
  }

  public shots(): RigShot[] {
    return this.current.shots.filter((shot) => shot.jet === this.jet);
  }

  public tells(): RigTell[] {
    return this.current.tells.filter((tell) => tell.jet === this.jet && tell.kind === 'decloak');
  }

  public stepAt(time: number): WraithStep | undefined {
    return this.steps.find((step) => Math.abs(step.t - time) < 1e-6);
  }
}

function fullyVisible(step: WraithStep): boolean {
  return !step.cloaked && step.opacityMin >= 1 - 1e-9;
}

/** 一次隐形周期里的几个时刻（秒）；NaN = 记录在那之前就结束了 */
interface Cycle {
  fadeStart: number;
  cloakStart: number;
  cloakEnd: number;
  visibleAgain: number;
}

/** 从逐步记录里整理出每一次“淡出 → 隐形 → 现形 → 完全可见” */
function cyclesOf(log: WraithLog): Cycle[] {
  const cycles: Cycle[] = [];
  let open: Cycle | null = null;
  let previous: WraithStep | null = null;
  for (const step of log.steps) {
    if (previous) {
      if (fullyVisible(previous) && !fullyVisible(step) && !step.cloaked) {
        open = { fadeStart: step.t, cloakStart: NaN, cloakEnd: NaN, visibleAgain: NaN };
        cycles.push(open);
      }
      if (!previous.cloaked && step.cloaked) {
        if (!open || !Number.isNaN(open.cloakStart)) {
          // 没看到淡出就隐形了（不该发生）：照样记一个周期，让检查报出来
          open = { fadeStart: NaN, cloakStart: step.t, cloakEnd: NaN, visibleAgain: NaN };
          cycles.push(open);
        } else {
          open.cloakStart = step.t;
        }
      }
      if (previous.cloaked && !step.cloaked && open) open.cloakEnd = step.t;
      if (!fullyVisible(previous) && fullyVisible(step) && open) {
        open.visibleAgain = step.t;
        open = null;
      }
    }
    previous = step;
  }
  return cycles;
}

const near = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance;

/**
 * 隐形周期里不合规格的地方（空数组 = 全部合格）。只看完整走完的周期；
 * 没有被击中 / 瘫痪打断的记录才能用它。
 */
function cycleProblems(log: WraithLog): string[] {
  const problems: string[] = [];
  const cycles = cyclesOf(log);
  const tells = log.tells();
  cycles.forEach((cycle, index) => {
    const tag = `cycle ${index + 1} (fade at ${cycle.fadeStart.toFixed(2)} s)`;
    if (Number.isNaN(cycle.fadeStart)) {
      problems.push(`${tag}: cloaked without fading out first`);
      return;
    }
    if (Number.isNaN(cycle.cloakStart)) return;
    const fade = cycle.cloakStart - cycle.fadeStart;
    if (!near(fade, FADE_SECONDS, 2 * DT + 1e-6))
      problems.push(`${tag}: faded out in ${fade.toFixed(3)} s`);
    // 淡出期间越来越淡
    let last = Infinity;
    for (const step of log.steps) {
      if (step.t < cycle.fadeStart || step.t >= cycle.cloakStart) continue;
      if (step.opacityMax > last + 1e-9) {
        problems.push(`${tag}: got less transparent while fading out at ${step.t.toFixed(2)} s`);
        break;
      }
      last = step.opacityMax;
    }
    if (Number.isNaN(cycle.cloakEnd)) return;
    const cloak = cycle.cloakEnd - cycle.cloakStart;
    if (cloak < CLOAK_MIN_SECONDS - DT - 1e-6)
      problems.push(`${tag}: cloaked for only ${cloak.toFixed(3)} s`);
    if (cloak > CLOAK_MAX_SECONDS + 2 * DT)
      problems.push(`${tag}: cloaked for ${cloak.toFixed(3)} s`);
    for (const step of log.steps) {
      if (step.t < cycle.cloakStart || step.t >= cycle.cloakEnd) continue;
      if (step.opacityMin < CLOAK_OPACITY_MIN || step.opacityMax > CLOAK_OPACITY_MAX) {
        problems.push(
          `${tag}: ${(step.opacityMin * 100).toFixed(0)}-${(step.opacityMax * 100).toFixed(0)} % opacity while cloaked at ${step.t.toFixed(2)} s`
        );
        break;
      }
    }
    const tell = tells.find((candidate) => near(candidate.time, cycle.cloakEnd, 1.5 * DT));
    if (!tell) problems.push(`${tag}: no decloak tell when it came out of the cloak`);
    else if (tell.duration < TELL_SECONDS - 1e-9) {
      problems.push(`${tag}: the decloak tell announces only ${tell.duration} s`);
    }
    if (Number.isNaN(cycle.visibleAgain)) return;
    const fadeIn = cycle.visibleAgain - cycle.cloakEnd;
    if (!near(fadeIn, TELL_SECONDS, 2 * DT + 1e-6)) {
      problems.push(`${tag}: faded back in over ${fadeIn.toFixed(3)} s`);
    }
    const tellSteps = log.steps.filter(
      (step) => step.t >= cycle.cloakEnd && step.t < cycle.visibleAgain
    );
    const flared = tellSteps.filter((step) => step.flare).length;
    if (flared < tellSteps.length * 0.8) {
      problems.push(
        `${tag}: the red eye showed on ${flared} of ${tellSteps.length} steps of the tell`
      );
    }
    const next = cycles[index + 1];
    if (next && !Number.isNaN(next.fadeStart)) {
      const visible = next.fadeStart - cycle.visibleAgain;
      if (visible < VISIBLE_MIN_SECONDS - DT - 1e-6) {
        problems.push(`${tag}: visible for only ${visible.toFixed(2)} s before fading out again`);
      }
    }
  });
  return problems;
}

/** 开火不合规格的地方：只在完全可见时、预警走完之后开火；每次现形一轮五连发；现形位置 */
function fireProblems(log: WraithLog): string[] {
  const problems: string[] = [];
  const tells = log.tells();
  const bursts = groupBursts(log.shots(), 0.5);
  for (const burst of bursts) {
    const first = burst[0];
    const tag = `burst at ${first.time.toFixed(2)} s`;
    if (burst.length !== BURST_ROUNDS) problems.push(`${tag}: ${burst.length} rounds`);
    for (const shot of burst) {
      const step = log.stepAt(shot.time);
      if (!step) continue;
      if (step.cloaked) problems.push(`${tag}: fired while cloaked`);
      else if (!fullyVisible(step))
        problems.push(`${tag}: fired while still fading (${step.phase})`);
    }
    const before = tells.filter((tell) => tell.time <= first.time + 1e-9);
    const tell = before[before.length - 1];
    if (!tell) {
      problems.push(`${tag}: fired without ever decloaking`);
      continue;
    }
    if (first.time < tell.time + TELL_SECONDS - 1e-6) {
      problems.push(`${tag}: fired ${(first.time - tell.time).toFixed(2)} s into the tell`);
    }
    // 现形（预警开始）的位置：玩家后方四分之一圆，约 200 米以内
    const at = log.stepAt(tell.time);
    if (at) {
      const offset = at.position.clone().sub(at.playerPosition);
      const astern = angleBetween(offset, at.playerForward.clone().negate());
      const distance = offset.length();
      if (
        astern > REAR_QUARTER + REAR_QUARTER_SLACK ||
        distance > ATTACK_DISTANCE + ATTACK_DISTANCE_SLACK
      ) {
        problems.push(
          `${tag}: decloaked ${(astern / DEG).toFixed(0)} degrees off the player's tail, ${distance.toFixed(0)} m away`
        );
      }
    }
  }
  // 每次现形最多一轮
  tells.forEach((tell, index) => {
    const until = tells[index + 1]?.time ?? Infinity;
    const count = bursts.filter(
      (burst) => burst[0].time >= tell.time && burst[0].time < until
    ).length;
    if (count > 1) problems.push(`decloak at ${tell.time.toFixed(2)} s: ${count} bursts`);
  });
  return problems;
}

function wraithRig(
  seed: number,
  fly: (rig: FleetRig) => void,
  options: ConstructorParameters<typeof FleetRig>[0] = {}
): { current: FleetRig; wraith: EnemyAI; log: WraithLog } {
  const current = makeRig({ seed, ...options });
  const wraith = current.addJet(EnemyType.WRAITH, pointAround(current.player, 300, 120 * DEG));
  current.pilot = fly;
  const log = new WraithLog(current, wraith);
  return { current, wraith, log };
}

// ---------------------------------------------------------------------------------------------
// 隐形周期
// ---------------------------------------------------------------------------------------------

describe('WRAITH cloak cycle (spec §3)', () => {
  it.each(PILOTS)(
    'against a %s player: fade 0.6 s, cloaked 1.5-5 s at 12-18 percent, 0.7 s tell with the red eye, visible 4 s, again and again',
    async (_name, fly) => {
      for (const seed of [3, 4, 5]) {
        const { current, log } = wraithRig(seed, fly);
        current.run(60, () => log.record());
        const cycles = cyclesOf(log).filter((cycle) => !Number.isNaN(cycle.visibleAgain));
        expect(cycles.length, `seed ${seed}: complete cycles in 60 s`).toBeGreaterThanOrEqual(5);
        expect(cycleProblems(log), `seed ${seed}`).toEqual([]);
        await breathe();
      }
    }
  );

  it.each(PILOTS)(
    'against a %s player: one 5-round burst per decloak, from the rear quarter, never before the tell is over',
    async (_name, fly) => {
      for (const seed of [3, 4, 5]) {
        const { current, log } = wraithRig(seed, fly);
        current.run(60, () => log.record());
        expect(log.shots().length, `seed ${seed}: rounds fired`).toBeGreaterThanOrEqual(
          5 * BURST_ROUNDS
        );
        expect(fireProblems(log), `seed ${seed}`).toEqual([]);
        await breathe();
      }
    }
  );

  it('is hidden from the player’s sensors exactly while it is cloaked, and never while fully visible', () => {
    const { current, log } = wraithRig(4, PILOTS[1][1]);
    current.run(45, () => log.record());
    let hiddenSteps = 0;
    for (const step of log.steps) {
      if (fullyVisible(step)) continue;
      if (step.opacityMax <= CLOAK_OPACITY_MAX + 1e-9 && step.phase === 'cloaked') {
        expect(step.cloaked, `t=${step.t.toFixed(2)}`).toBe(true);
      }
      if (step.cloaked) hiddenSteps++;
    }
    for (const step of log.steps.filter(fullyVisible)) expect(step.cloaked).toBe(false);
    expect(hiddenSteps).toBeGreaterThan(5 * 60);
  });

  it('a lock held on it is lost when it cloaks: it reports itself hidden from the first cloaked step', () => {
    // 玩家一侧怎么丢锁（导引头候选里没有隐形的敌机）在 CoordinatorJamCloakJetMissiles；这里看
    // 敌机这一侧：淡出最后一步还看得见，下一步就报告隐形，中间没有“半隐形”的一步
    const { current, log } = wraithRig(3, PILOTS[0][1]);
    current.lockedJet = log.jet;
    current.run(30, () => log.record());
    const cycles = cyclesOf(log);
    expect(cycles.length).toBeGreaterThanOrEqual(2);
    for (const cycle of cycles) {
      if (Number.isNaN(cycle.cloakStart)) continue;
      const step = log.stepAt(cycle.cloakStart);
      expect(step?.cloaked).toBe(true);
      expect(step?.opacityMax ?? 1).toBeLessThanOrEqual(CLOAK_OPACITY_MAX + 1e-9);
    }
  });

  it('waits out the full five seconds when it cannot attack, then decloaks with a tell anyway, and never fires without a token', () => {
    const { current, log } = wraithRig(3, PILOTS[0][1], { capacity: 0 });
    current.run(45, () => log.record());
    const cycles = cyclesOf(log).filter((cycle) => !Number.isNaN(cycle.cloakEnd));
    expect(cycles.length).toBeGreaterThanOrEqual(3);
    for (const cycle of cycles) {
      expect(cycle.cloakEnd - cycle.cloakStart).toBeGreaterThan(CLOAK_MAX_SECONDS - 3 * DT);
    }
    expect(cycleProblems(log)).toEqual([]);
    expect(log.shots().length, 'rounds fired without a token').toBe(0);
  });

  it('only fires while it holds an attack token (spec §2.1)', () => {
    for (const seed of [3, 4]) {
      const current = makeRig({ seed, capacity: 1 });
      const wraiths = [
        current.addJet(EnemyType.WRAITH, pointAround(current.player, 300, 120 * DEG)),
        current.addJet(EnemyType.WRAITH, pointAround(current.player, 320, -130 * DEG)),
        current.addJet(EnemyType.FIGHTER, pointAround(current.player, 350, 30 * DEG)),
      ];
      current.pilot = PILOTS[1][1];
      current.run(60);
      const wraithShots = current.shots.filter((shot) => wraiths.slice(0, 2).includes(shot.jet));
      expect(wraithShots.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const shot of wraithShots) {
        expect(shot.hadToken, `seed ${seed}, round at ${shot.time.toFixed(2)} s`).toBe(true);
      }
    }
  });

  it('keeps a faint trail while cloaked: fewer trail points than when visible, but never none', () => {
    const made = vi.mocked(ParticleTrailRenderer);
    const before = made.mock.calls.length;
    const { current, log } = wraithRig(3, PILOTS[0][1]);
    const index = made.mock.calls.findIndex(
      (args, at) => at >= before && args[1] === log.jet.getMesh()
    );
    expect(index, 'a particle trail was made for the Wraith').toBeGreaterThanOrEqual(0);
    const trail = made.mock.results[index].value as { addPoint: ReturnType<typeof vi.fn> };
    let cloakedSteps = 0;
    let cloakedPoints = 0;
    let visibleSteps = 0;
    let visiblePoints = 0;
    let longestGap = 0;
    let gap = 0;
    /** 每一步新加的尾迹点数 */
    const addedPerStep: number[] = [];
    let previous = trail.addPoint.mock.calls.length;
    current.run(45, () => {
      log.record();
      const points = trail.addPoint.mock.calls.length;
      addedPerStep.push(points - previous);
      previous = points;
    });
    log.steps.forEach((step, index) => {
      const added = addedPerStep[index];
      if (step.cloaked) {
        cloakedSteps++;
        cloakedPoints += added;
        gap = added > 0 ? 0 : gap + 1;
        longestGap = Math.max(longestGap, gap);
      } else if (fullyVisible(step)) {
        visibleSteps++;
        visiblePoints += added;
        gap = 0;
      }
    });
    expect(cloakedSteps).toBeGreaterThan(300);
    expect(cloakedPoints / cloakedSteps, 'trail points per cloaked step').toBeGreaterThan(0);
    expect(cloakedPoints / cloakedSteps).toBeLessThan((visiblePoints / visibleSteps) * 0.75);
    expect(longestGap * DT, 'longest stretch with no trail while cloaked (s)').toBeLessThan(0.25);
  });
});

// ---------------------------------------------------------------------------------------------
// 命中、EMP、Boss 战、玩家不可被攻击
// ---------------------------------------------------------------------------------------------

describe('WRAITH hit while cloaked: decloaks at once and staggers for 1 s (spec §3)', () => {
  /** 推进到隐形了 seconds 秒 */
  function intoCloak(
    seed: number,
    seconds: number
  ): { current: FleetRig; wraith: EnemyAI; log: WraithLog } {
    const made = wraithRig(seed, PILOTS[0][1]);
    expect(
      made.current.runUntil(() => made.wraith.isCloaked(), 20),
      'it cloaked'
    ).toBe(true);
    made.current.run(seconds, () => made.log.record());
    expect(made.wraith.isCloaked()).toBe(true);
    return made;
  }

  it.each([0.1, 0.8, 1.4])(
    'hit %s s into the cloak: no longer hidden at once, fully visible on the next step',
    (seconds) => {
      const { current, wraith, log } = intoCloak(3, seconds);
      const watch = log.hull;
      expect(watch.opacityRange().max, 'faded before the hit').toBeLessThanOrEqual(
        CLOAK_OPACITY_MAX
      );
      const health = wraith.getHealth().current;
      wraith.takeDamage(4);
      expect(wraith.getHealth().current, 'it still takes the damage').toBeLessThan(health);
      expect(wraith.isCloaked(), 'hidden right after the hit').toBe(false);
      current.step();
      expect(wraith.isCloaked()).toBe(false);
      expect(watch.opacityRange()).toEqual({ min: 1, max: 1 });
    }
  );

  it.each([3, 4, 5])(
    'seed %i: for 1 s after the hit it neither fires, nor flashes a tell, nor cloaks again; then it carries on with its cycle',
    (seed) => {
      const { current, wraith, log } = intoCloak(seed, 0.5);
      const hitAt = current.time;
      wraith.takeDamage(4);
      const tellsBefore = log.tells().length;
      const shotsBefore = log.shots().length;
      current.run(STAGGER_SECONDS - DT, () => {
        log.record();
        const step = log.steps[log.steps.length - 1];
        expect(fullyVisible(step), `t=${step.t.toFixed(2)}`).toBe(true);
      });
      expect(log.shots().length - shotsBefore, 'rounds fired while staggered').toBe(0);
      expect(log.tells().length - tellsBefore, 'tells while staggered').toBe(0);
      // 之后照常：还会再隐形，下一轮开火之前一定有一次完整的现形预警
      current.run(25, () => log.record());
      expect(log.steps.some((step) => step.cloaked && step.t > hitAt + STAGGER_SECONDS)).toBe(true);
      const later = log.shots().filter((shot) => shot.time > hitAt);
      expect(later.length, 'it attacks again later').toBeGreaterThan(0);
      const tellsAfter = log.tells().filter((tell) => tell.time > hitAt);
      expect(tellsAfter.length).toBeGreaterThan(0);
      expect(later[0].time).toBeGreaterThanOrEqual(tellsAfter[0].time + TELL_SECONDS - 1e-6);
    }
  );

  it('a hit during the stagger does not make it cloak or fire either', () => {
    const { current, wraith, log } = intoCloak(4, 0.5);
    wraith.takeDamage(4);
    current.run(0.5, () => log.record());
    wraith.takeDamage(4);
    const shots = log.shots().length;
    current.run(0.45, () => log.record());
    expect(log.shots().length).toBe(shots);
    expect(log.steps.slice(-27).every(fullyVisible)).toBe(true);
  });

  // “僵直 1 秒”读作：这 1 秒里它失去控制、不机动（不转向、不加速），1 秒之后才重新机动
  it.each(PILOTS)(
    'against a %s player: staggered, it holds its heading without speeding up for 1 s, and manoeuvres again after that',
    (_name, fly) => {
      for (const seed of [3, 4, 5]) {
        for (const into of [0.1, 0.5, 1.2]) {
          const made = wraithRig(seed, fly);
          const { current, wraith } = made;
          expect(
            current.runUntil(() => wraith.isCloaked(), 20),
            'it cloaked'
          ).toBe(true);
          current.run(into);
          const heading = wraith.velocity.clone();
          const speed = heading.length();
          wraith.takeDamage(4);
          const tag = `seed ${seed}, hit ${into} s into the cloak`;
          let steps = 0;
          let turnWhileStaggered = 0;
          let fastestWhileStaggered = 0;
          let turnAfter = 0;
          current.run(STAGGER_SECONDS + 2, () => {
            steps++;
            const turn = angleBetween(heading, wraith.velocity);
            if (steps * DT < STAGGER_SECONDS - 1e-9) {
              turnWhileStaggered = Math.max(turnWhileStaggered, turn);
              fastestWhileStaggered = Math.max(fastestWhileStaggered, wraith.velocity.length());
            } else {
              turnAfter = Math.max(turnAfter, turn);
            }
          });
          expect(turnWhileStaggered / DEG, `${tag}: turned while staggered`).toBeLessThan(2);
          expect(fastestWhileStaggered, `${tag}: speed while staggered`).toBeLessThanOrEqual(
            speed + 1e-6
          );
          expect(turnAfter / DEG, `${tag}: turned in the 2 s after`).toBeGreaterThan(15);
        }
      }
    }
  );
});

describe('WRAITH and the common rules', () => {
  it('an EMP stun while cloaked decloaks it at once, and it does not fire while stunned (spec §2.7)', () => {
    const { current, wraith, log } = wraithRig(3, PILOTS[0][1]);
    expect(current.runUntil(() => wraith.isCloaked(), 20)).toBe(true);
    current.run(0.5);
    wraith.applyStun(2);
    expect(wraith.isCloaked(), 'hidden right after the stun').toBe(false);
    const shots = log.shots().length;
    current.run(2 - DT, () => {
      log.record();
      expect(wraith.isCloaked()).toBe(false);
    });
    expect(log.steps.every(fullyVisible), 'fully visible while stunned').toBe(true);
    expect(log.shots().length - shots).toBe(0);
  });

  it.each([1, 5, 8, 10])(
    'level %i boss fight: it never cloaks, never fades, still fights with its gun (spec §2.9)',
    (level) => {
      const { current, log } = wraithRig(3, PILOTS[1][1], { level, bossFight: true });
      current.run(60, () => log.record());
      expect(log.steps.some((step) => step.cloaked)).toBe(false);
      expect(log.steps.every(fullyVisible)).toBe(true);
      expect(log.tells().length).toBe(0);
      expect(log.shots().length, 'gun rounds').toBeGreaterThan(0);
    }
  );

  it('a boss fight that starts while it is cloaked brings it out, and it stays out', () => {
    const { current, wraith, log } = wraithRig(3, PILOTS[0][1]);
    expect(current.runUntil(() => wraith.isCloaked(), 20)).toBe(true);
    current.bossFight = true;
    current.run(30, () => log.record());
    // 隐形中进入 Boss 战：最多把这一次隐形走完（最长 5 秒 + 现形预警），之后再也不隐形
    const lastHidden = [...log.steps].reverse().find((step) => step.cloaked || !fullyVisible(step));
    expect((lastHidden?.t ?? 0) - log.steps[0].t).toBeLessThan(
      CLOAK_MAX_SECONDS + TELL_SECONDS + 0.1
    );
    expect(log.steps.slice(-60 * 20).every(fullyVisible)).toBe(true);
  });

  it('fires nothing while the player cannot be attacked (spec §3a), and fires again afterwards', () => {
    const { current, log } = wraithRig(3, PILOTS[1][1]);
    current.playerTargetable = false;
    current.run(40, () => log.record());
    expect(log.shots().length).toBe(0);
    current.playerTargetable = true;
    current.run(30, () => log.record());
    expect(log.shots().length).toBeGreaterThan(0);
  });

  it('keeps within the throttle range and a finite position through cycles, hits and stuns (spec §2.6, §2.7)', () => {
    const { current, wraith } = wraithRig(5, PILOTS[3][1]);
    const base = wraith.getConfig().speed;
    let hits = 0;
    current.run(60, () => {
      if (wraith.isCloaked() && hits < 3 && Math.round(current.time / DT) % 97 === 0) {
        wraith.takeDamage(1);
        hits++;
      }
      const speed = wraith.velocity.length();
      expect(speed).toBeGreaterThanOrEqual(base * SPEC.MIN_THROTTLE - 1e-6);
      expect(speed).toBeLessThanOrEqual(base * SPEC.MAX_THROTTLE + 1e-6);
      const position = wraith.getMesh().position;
      expect(Number.isFinite(position.x + position.y + position.z)).toBe(true);
    });
    expect(hits).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// 两架隐形机
// ---------------------------------------------------------------------------------------------

describe('two Wraiths at once', () => {
  function pairRig(seed: number, capacity: number, fly: (rig: FleetRig) => void) {
    const current = makeRig({ seed, capacity });
    const first = current.addJet(EnemyType.WRAITH, pointAround(current.player, 300, 120 * DEG));
    const second = current.addJet(EnemyType.WRAITH, pointAround(current.player, 320, -130 * DEG));
    current.pilot = fly;
    const logs = [new WraithLog(current, first), new WraithLog(current, second)];
    return { current, logs };
  }

  it.each([1, 2, 4])(
    'with %i attack token(s) each one still flies a correct cycle and fires one burst per decloak',
    async (capacity) => {
      for (const seed of [3, 9]) {
        for (const [, fly] of [PILOTS[0], PILOTS[1]]) {
          const { current, logs } = pairRig(seed, capacity, fly);
          current.run(60, () => logs.forEach((log) => log.record()));
          for (const log of logs) {
            expect(log.shots().length, `seed ${seed}`).toBeGreaterThan(0);
            expect(cycleProblems(log), `seed ${seed}`).toEqual([]);
            expect(fireProblems(log), `seed ${seed}`).toEqual([]);
          }
          await breathe();
        }
      }
    }
  );

  it('with one attack token between them their bursts never overlap', () => {
    for (const seed of [3, 9]) {
      const { current, logs } = pairRig(seed, 1, PILOTS[0][1]);
      current.run(60, () => logs.forEach((log) => log.record()));
      const [first, second] = logs.map((log) => groupBursts(log.shots(), 0.5));
      expect(first.length).toBeGreaterThan(2);
      expect(second.length).toBeGreaterThan(2);
      for (const a of first) {
        for (const b of second) {
          const apart =
            a[a.length - 1].time < b[0].time - 1e-9 || b[b.length - 1].time < a[0].time - 1e-9;
          expect(apart, `bursts at ${a[0].time.toFixed(2)} s and ${b[0].time.toFixed(2)} s`).toBe(
            true
          );
        }
      }
    }
  });

  // FINDING: spec §2.2 — "Spread out. The director gives simultaneous attackers approach bearings
  // at least 60° apart as seen from the player whenever two or more hold tokens." Two Wraiths that
  // hold tokens at the same time strike together from the same place: both fly to the slot
  // straight behind the player, decloak there and fire back to back. The director does hand them
  // bearings 60°+ apart (checked below), but the Wraith never flies to its assigned bearing (the
  // Fighter flies to it, the Heavy and the Sniper fire only from it, the Scout repositions to it).
  // Measured (level 8, 4 tokens, as on level 8 Normal where Wraith pairs arrive, spec §4a):
  // every one of the 31 pairs of bursts opened within 1 s of each other (seeds 3 and 9, player
  // straight or turning 0.1 rad/s) came from bearings less than 60 degrees apart — 46-51 degrees
  // on the first attack, then 0-10 degrees on every later one (seed 3, straight: bursts at
  // 13.65 s / 14.10 s 10 degrees apart, 20.48 s / 20.93 s 8 degrees, …), both from about 5
  // degrees off the player's tail.
  // Reproduce: FleetRig({ level: 8, capacity: 4, seed: 3 }), WRAITHs at 300 m / 120 degrees and
  // 320 m / -130 degrees off the nose, player straight at 45 m/s, 60 s; pair each burst of one
  // Wraith with any burst of the other that opens within 1 s and compare the bearings of the two
  // first rounds' origins as seen from the player.
  it.fails(
    'two Wraiths attacking at the same time do so from bearings at least 60 degrees apart',
    () => {
      let pairs = 0;
      const tooClose: string[] = [];
      for (const seed of [3, 9]) {
        for (const [name, fly] of [PILOTS[0], PILOTS[1]]) {
          const { current, logs } = pairRig(seed, 4, fly);
          current.run(60);
          const [first, second] = logs.map((log) => groupBursts(log.shots(), 0.5));
          for (const a of first) {
            for (const b of second) {
              if (Math.abs(a[0].time - b[0].time) > 1) continue;
              pairs++;
              const gap = bearingGap(
                bearingOf(a[0].playerPosition, a[0].origin),
                bearingOf(b[0].playerPosition, b[0].origin)
              );
              if (gap < SPEC.MIN_BEARING_GAP) {
                tooClose.push(
                  `${name}, seed ${seed}: ${a[0].time.toFixed(2)} s / ${b[0].time.toFixed(2)} s, ${(gap / DEG).toFixed(0)} degrees`
                );
              }
            }
          }
        }
      }
      expect(pairs, 'pairs of simultaneous attacks').toBeGreaterThan(4);
      expect(tooClose).toEqual([]);
    }
  );

  it('the director does give two Wraiths holding tokens bearings at least 60 degrees apart (premise of the finding above)', () => {
    let both = 0;
    const { current, logs } = pairRig(3, 4, PILOTS[0][1]);
    const [first, second] = logs.map((log) => log.jet);
    current.run(60, () => {
      if (!first.hasAttackToken() || !second.hasAttackToken()) return;
      both++;
      expect(bearingGap(first.orders.bearing, second.orders.bearing)).toBeGreaterThanOrEqual(
        SPEC.MIN_BEARING_GAP - 1e-6
      );
    });
    expect(both).toBeGreaterThan(60);
  });
});

// ---------------------------------------------------------------------------------------------
// 接进真实的 EnemySystem
// ---------------------------------------------------------------------------------------------

describe('WRAITH through the real enemy system', () => {
  let system: SystemRig | null = null;
  let randomSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(20261031));
  });

  afterEach(() => {
    system?.dispose();
    system = null;
    EventBus.clear();
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  it.each([7, 8, 10])(
    'level %i: the decloak tell goes out as an event announcing 0.7 s, and every round comes after it',
    (level) => {
      const current = new SystemRig({ level, difficulty: 3 });
      system = current;
      current.pilot = (active) => active.turnPlayer(0.1 * DT);
      const wraith = current.spawn(EnemyType.WRAITH, pointAround(current.player, 300, 120 * DEG));
      current.run(45);
      const mesh = wraith.getMesh();
      const tells = current.tells.filter((tell) => tell.payload.owner === mesh);
      const shots = current.shots.filter((shot) => shot.payload.owner === mesh);
      expect(tells.length).toBeGreaterThanOrEqual(4);
      for (const tell of tells) {
        expect(tell.payload.kind).toBe('decloak');
        expect(tell.payload.duration).toBeGreaterThanOrEqual(TELL_SECONDS - 1e-9);
      }
      expect(shots.length).toBeGreaterThanOrEqual(BURST_ROUNDS * 3);
      const bursts = groupBursts(
        shots.map((shot) => ({ ...shot, jet: mesh })),
        0.5
      );
      for (const burst of bursts) {
        expect(burst.length).toBe(BURST_ROUNDS);
        const before = tells.filter((tell) => tell.time <= burst[0].time + 1e-9);
        expect(before.length, `burst at ${burst[0].time.toFixed(2)} s`).toBeGreaterThan(0);
        expect(burst[0].time - before[before.length - 1].time).toBeGreaterThanOrEqual(
          TELL_SECONDS - 1e-6
        );
        expect(burst.every((shot) => shot.hadToken)).toBe(true);
      }
    }
  );

  it('in a boss fight it never cloaks in the live system either', () => {
    const current = new SystemRig({ level: 8, difficulty: 3, bossFight: true });
    system = current;
    const wraith = current.spawn(EnemyType.WRAITH, pointAround(current.player, 300, 120 * DEG));
    let cloaked = 0;
    current.run(40, () => {
      if (wraith.isCloaked()) cloaked++;
    });
    expect(cloaked).toBe(0);
    expect(current.tells.filter((tell) => tell.payload.kind === 'decloak').length).toBe(0);
  });
});
