import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  LiveFire,
  SIM_TEST_TIMEOUT,
  SPEC,
  SystemRig,
  angleBetween,
  breathe,
  chasePilot,
  horizontal,
  pointAround,
  seededGameRandom,
} from './enemyFleetRig';

// 整场交战要算几万步：给足时间，别让机器忙的时候超时（超时的用例还会拖累后面的用例）
vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 狙击机（SNIPER，长枪手）的打法，规格 §3：
 * 在 380–520 米外盘旋；蓄力射击——细红瞄准光束亮 1.3 秒，前 0.9 秒跟着玩家，随后冻结 0.4 秒，
 * 然后一发很快的长枪弹（约 320 米/秒，基础伤害 20）沿冻结的那条线飞出，冻结之后改变方向就能
 * 躲开；两发之间约 4.5 秒；玩家逼近到 220 米以内时放弃蓄力、以 1.3 倍速逃开；被锁定 / 被导弹
 * 追时放弃蓄力并规避。
 */

const TELL_SECONDS = 1.3;
const TRACK_SECONDS = 0.9;
const FLEE_DISTANCE = 220;

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

/** 一次蓄力的逐步记录 */
interface ChargeSample {
  /** 距离预警开始的秒数 */
  elapsed: number;
  frozen: boolean;
  progress: number;
  aimPoint: THREE.Vector3;
  jetPosition: THREE.Vector3;
}

/** 推进到下一次蓄力结束（长枪弹打出）为止，逐步记录光束；返回这次蓄力的记录与那一发长枪弹 */
function recordCharge(current: FleetRig, sniper: EnemyAI, maxSeconds = 30) {
  const tellsBefore = current.tells.length;
  const shotsBefore = current.shots.length;
  const samples: ChargeSample[] = [];
  let tellTime = -1;
  current.run(maxSeconds, () => {
    if (tellTime < 0 && current.tells.length > tellsBefore) {
      tellTime = current.tells[current.tells.length - 1].time;
    }
    const tell = sniper.getDoctrine()?.getTell() ?? null;
    if (tellTime >= 0 && tell) {
      samples.push({
        elapsed: current.time - tellTime,
        frozen: tell.frozen,
        progress: tell.progress,
        aimPoint: tell.aimPoint.clone(),
        jetPosition: sniper.getMesh().position.clone(),
      });
    }
    return current.shots.length > shotsBefore;
  });
  const lance = current.shots[shotsBefore] ?? null;
  return { samples, lance, tellTime };
}

describe('SNIPER charged shot (spec §3)', () => {
  it.each([0, 0.4, -0.6])(
    'player turning at %s rad/s: a lance comes exactly 1.3 s after the tell starts, about 4.5 s apart',
    (yaw) => {
      const current = makeRig({ capacity: 2, seed: 141 });
      current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
      current.pilot = (active) => active.turnPlayer(yaw * DT);
      current.run(40);
      const lances = current.shots;
      expect(lances.length).toBeGreaterThanOrEqual(5);
      for (const lance of lances) {
        expect(lance.weapon).toBe('lance');
        const tell = [...current.tells].reverse().find((entry) => entry.time <= lance.time);
        expect(tell).toBeDefined();
        if (!tell) continue;
        expect(tell.kind).toBe('lance-charge');
        expect(Math.abs(lance.time - tell.time - TELL_SECONDS)).toBeLessThanOrEqual(DT + 1e-9);
        // 预警自己报出的时长也是 1.3 秒
        expect(tell.duration).toBeCloseTo(TELL_SECONDS, 2);
      }
      // 一次蓄力只打一发
      expect(current.tells.length - lances.length).toBeGreaterThanOrEqual(0);
      expect(current.tells.length - lances.length).toBeLessThanOrEqual(1);
      for (let i = 1; i < lances.length; i++) {
        const gap = lances[i].time - lances[i - 1].time;
        expect(gap, 'seconds between two lances').toBeGreaterThan(3.8);
        expect(gap).toBeLessThan(5.2);
      }
    }
  );

  it('the lance is fast (about 320 m/s) and hits hard (base 20, more than any gun round or shell)', () => {
    const current = makeRig({ capacity: 5, seed: 142, level: 6 });
    current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    current.addJet(EnemyType.SCOUT, pointAround(current.player, 400, -40 * DEG));
    current.addJet(EnemyType.FIGHTER, pointAround(current.player, 400, 150 * DEG));
    current.addJet(EnemyType.HEAVY, pointAround(current.player, 330, -100 * DEG));
    current.addJet(EnemyType.ACE, pointAround(current.player, 420, 200 * DEG));
    current.pilot = (active) => active.turnPlayer(0.3 * DT);
    current.run(50);
    const lances = current.shots.filter((shot) => shot.weapon === 'lance');
    const others = current.shots.filter((shot) => shot.weapon !== 'lance');
    expect(lances.length).toBeGreaterThanOrEqual(4);
    expect(others.length).toBeGreaterThan(20);
    for (const lance of lances) {
      expect(lance.speed).toBeGreaterThanOrEqual(280);
      expect(lance.speed).toBeLessThanOrEqual(360);
      expect(lance.damage).toBeCloseTo(20, 6);
      expect(lance.type).toBe(EnemyType.SNIPER);
    }
    expect(ENEMY_CONFIGS[EnemyType.SNIPER].damage).toBe(20);
    expect(Math.max(...others.map((shot) => shot.damage))).toBeLessThan(20);
    // 只有狙击机打长枪弹
    for (const shot of others) expect(shot.type === EnemyType.SNIPER).toBe(false);
  });

  it.each([141, 143, 144])(
    'seed %s: the beam tracks for the first 0.9 s, then freezes for 0.4 s',
    (seed) => {
      const current = makeRig({ capacity: 2, seed });
      const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
      // 玩家一直在转：瞄准点必须跟着动
      current.pilot = (active) => active.turnPlayer(0.5 * DT);
      for (let charge = 0; charge < 3; charge++) {
        const { samples, lance } = recordCharge(current, sniper);
        expect(lance, 'the charge ended in a lance').not.toBeNull();
        // 从预警开始到开火，光束每一步都在
        expect(samples.length).toBeGreaterThanOrEqual(Math.round(TELL_SECONDS / DT) - 2);

        const tracking = samples.filter((sample) => sample.elapsed < TRACK_SECONDS - DT);
        const frozen = samples.filter((sample) => sample.elapsed > TRACK_SECONDS + DT);
        expect(tracking.length).toBeGreaterThan(40);
        expect(frozen.length).toBeGreaterThan(15);
        for (const sample of tracking)
          expect(sample.frozen, `t+${sample.elapsed.toFixed(2)}`).toBe(false);
        for (const sample of frozen)
          expect(sample.frozen, `t+${sample.elapsed.toFixed(2)}`).toBe(true);

        // 跟踪：瞄准点每一步都在动；冻结：一动不动
        for (let i = 1; i < tracking.length; i++) {
          expect(tracking[i].aimPoint.distanceTo(tracking[i - 1].aimPoint)).toBeGreaterThan(0.05);
        }
        for (let i = 1; i < frozen.length; i++) {
          expect(frozen[i].aimPoint.distanceTo(frozen[0].aimPoint)).toBeLessThan(1e-6);
        }
        // 蓄力进度单调上升到接近 1
        for (let i = 1; i < samples.length; i++) {
          expect(samples[i].progress).toBeGreaterThanOrEqual(samples[i - 1].progress);
        }
        expect(samples[samples.length - 1].progress).toBeGreaterThan(0.9);
        expect(samples[samples.length - 1].progress).toBeLessThanOrEqual(1);
      }
    }
  );

  it('the lance goes down the frozen line, not at where the player has got to', () => {
    const current = makeRig({ capacity: 2, seed: 145 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    let lastFrozen = false;
    current.pilot = (active) => {
      // 光束一冻结就急转 90°：冻结线与玩家后来的位置明显分开
      const tell = sniper.getDoctrine()?.getTell() ?? null;
      if (tell?.frozen && !lastFrozen) active.turnPlayer(90 * DEG);
      lastFrozen = tell?.frozen === true;
    };
    for (let charge = 0; charge < 4; charge++) {
      const { samples, lance } = recordCharge(current, sniper);
      expect(lance).not.toBeNull();
      if (!lance) continue;
      const frozenAim = samples[samples.length - 1].aimPoint;
      expect(samples[samples.length - 1].frozen).toBe(true);
      const alongBeam = frozenAim.clone().sub(lance.origin);
      expect(
        angleBetween(lance.direction, alongBeam) / DEG,
        'angle between the lance and the frozen beam (degrees)'
      ).toBeLessThan(0.5);
      expect(Math.abs(lance.direction.length() - 1)).toBeLessThan(1e-6);
    }
  });

  it('while tracking, the beam points at where the player is heading: ahead of the player, on the flight path', () => {
    const current = makeRig({ capacity: 2, seed: 146 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 90 * DEG));
    const { samples } = recordCharge(current, sniper);
    expect(samples.length).toBeGreaterThan(60);
    // 玩家直飞：瞄准点落在玩家前方的航线上（提前量），离航线不超过 15 米
    const forward = current.player.forward.clone();
    for (const sample of samples) {
      const offset = sample.aimPoint.clone().sub(current.player.position);
      const along = offset.dot(forward);
      const lateral = offset.clone().addScaledVector(forward, -along).length();
      expect(
        lateral,
        `t+${sample.elapsed.toFixed(2)}: aim point off the flight path (m)`
      ).toBeLessThan(15);
    }
  });

  it('shows a long thin red beam from the jet through the aim point while it charges, and nothing otherwise', () => {
    const current = makeRig({ capacity: 2, seed: 147 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    const jetMeshes = new Set<THREE.Object3D>(current.jets.map((jet) => jet.getMesh()));
    /** 场景里除敌机之外、当前可见的东西 */
    const effects = (): THREE.Object3D[] =>
      current.scene.children.filter((child) => child.visible && !jetMeshes.has(child));

    current.run(1);
    expect(effects().length, 'nothing extra on screen before the first charge').toBe(0);

    expect(current.runUntil(() => current.tells.length > 0, 30)).toBe(true);
    current.run(0.5);
    const tell = sniper.getDoctrine()?.getTell();
    expect(tell).toBeTruthy();
    expect(sniper.isTelegraphing()).toBe(true);
    const visible = effects();
    expect(visible.length).toBe(1);
    const beam = visible[0];
    beam.updateMatrixWorld(true);

    // 从机体出发
    expect(beam.position.distanceTo(sniper.getMesh().position)).toBeLessThan(2);
    // 又细又长：至少有一个部件长过到瞄准点的距离、粗不到 1 米
    const aimDistance = tell ? tell.aimPoint.distanceTo(sniper.getMesh().position) : 0;
    const parts: THREE.Object3D[] = [];
    beam.traverse((part) => {
      if (part !== beam && part.visible) parts.push(part);
    });
    const thin = parts.filter((part) => {
      const size = [part.scale.x, part.scale.y, part.scale.z];
      return Math.max(...size) >= aimDistance && Math.min(...size) < 0.5;
    });
    expect(thin.length, 'long thin parts').toBeGreaterThan(0);
    // 穿过瞄准点：细长部件的包围盒对角线与“机体 → 瞄准点”同向
    if (tell) {
      const box = new THREE.Box3().setFromObject(thin[0]);
      const diagonal = box.getSize(new THREE.Vector3());
      const toAim = tell.aimPoint.clone().sub(sniper.getMesh().position);
      const absolute = new THREE.Vector3(Math.abs(toAim.x), Math.abs(toAim.y), Math.abs(toAim.z));
      expect(angleBetween(diagonal, absolute) / DEG).toBeLessThan(2);
    }
    // 红色
    for (const part of parts) {
      const material = (part as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const hsl = { h: 0, s: 0, l: 0 };
      material.color.getHSL(hsl, THREE.SRGBColorSpace);
      const hue = hsl.h * 360;
      expect(hue < 20 || hue > 340, `beam part hue ${hue.toFixed(0)}`).toBe(true);
      expect(hsl.s).toBeGreaterThan(0.6);
    }

    // 长枪弹打出之后光束消失
    expect(current.runUntil(() => current.shots.length > 0, 3)).toBe(true);
    current.step();
    expect(sniper.isTelegraphing()).toBe(false);
    expect(effects().length).toBe(0);
  });

  it('through the real system each charge raises one lance-charge tell event (the charge sound hook)', () => {
    EventBus.clear();
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(1414));
    const system = new SystemRig({ level: 2, difficulty: 3 });
    try {
      const sniper = system.spawn(EnemyType.SNIPER, pointAround(system.player, 440, 70 * DEG));
      system.pilot = (active) => active.turnPlayer(0.3 * DT);
      system.run(40);
      const lances = system.shots.filter((shot) => shot.payload.weapon === 'lance');
      expect(lances.length).toBeGreaterThanOrEqual(3);
      expect(system.tells.length).toBeGreaterThanOrEqual(lances.length);
      expect(system.tells.length - lances.length).toBeLessThanOrEqual(1);
      for (const tell of system.tells) {
        expect(tell.payload.kind).toBe('lance-charge');
        expect(tell.payload.owner).toBe(sniper.getMesh());
        expect(tell.payload.duration).toBeCloseTo(TELL_SECONDS, 2);
        expect(Number.isFinite(tell.payload.position.x)).toBe(true);
      }
      for (const lance of lances) {
        const tell = [...system.tells].reverse().find((entry) => entry.time <= lance.time);
        expect(tell).toBeDefined();
        if (tell) {
          expect(Math.abs(lance.time - tell.time - TELL_SECONDS)).toBeLessThanOrEqual(DT + 1e-9);
        }
      }
    } finally {
      system.dispose();
      randomSpy.mockRestore();
      EventBus.clear();
    }
  });
});

describe('SNIPER lance against a real target (spec §3: changing direction after the freeze dodges it)', () => {
  type Dodge = 'none' | 'at-freeze' | 'at-tell';

  function duel(seed: number, dodge: Dodge): { lances: number; hits: number } {
    const current = makeRig({ capacity: 2, seed });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    const live = new LiveFire(current);
    let wasFrozen = false;
    let tellsSeen = 0;
    current.pilot = (active) => {
      const tell = sniper.getDoctrine()?.getTell() ?? null;
      // 光束刚冻结的那一刻转 90°，之后直飞
      if (dodge === 'at-freeze' && tell?.frozen && !wasFrozen) active.turnPlayer(90 * DEG);
      // 预警刚开始（还在跟踪）时转 90°，之后直飞
      if (dodge === 'at-tell' && active.tells.length > tellsSeen) active.turnPlayer(90 * DEG);
      tellsSeen = active.tells.length;
      wasFrozen = tell?.frozen === true;
    };
    current.run(45, () => live.step());
    // 最后一发可能还在路上：再飞 3 秒，期间不再有新的开火
    const lances = current.shots.filter((shot) => shot.weapon === 'lance').length;
    const result = { lances, hits: live.hits.length };
    live.dispose();
    return result;
  }

  it('a player who flies straight on is hit by nearly every lance', async () => {
    for (const seed of [151, 152, 153]) {
      const { lances, hits } = duel(seed, 'none');
      expect(lances, `lances fired, seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(hits, `lances that hit, seed ${seed}`).toBeGreaterThanOrEqual(lances - 2);
      await breathe();
    }
  });

  it('a player who turns as soon as the beam freezes is never hit', async () => {
    for (const seed of [151, 152, 153]) {
      const { lances, hits } = duel(seed, 'at-freeze');
      expect(lances, `lances fired, seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(hits, `lances that hit, seed ${seed}`).toBe(0);
      await breathe();
    }
  });

  it('turning while the beam is still tracking does not help: it follows the turn', async () => {
    for (const seed of [151, 152, 153]) {
      const { lances, hits } = duel(seed, 'at-tell');
      expect(lances, `lances fired, seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(hits, `lances that hit, seed ${seed}`).toBeGreaterThanOrEqual(lances - 2);
      await breathe();
    }
  });
});

describe('SNIPER standoff (spec §3: orbits 380-520 m out)', () => {
  /** 玩家不追它，只是直飞或缓转；返回稳定之后它与玩家的距离记录 */
  function standoff(seed: number, yaw: number): { distances: number[]; lanceDistances: number[] } {
    const current = makeRig({ capacity: 2, seed });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    current.pilot = (active) => active.turnPlayer(yaw * DT);
    const distances: number[] = [];
    current.run(80, () => {
      if (current.time >= 10) distances.push(current.distanceTo(sniper));
    });
    return {
      distances,
      lanceDistances: current.shots
        .filter((shot) => shot.weapon === 'lance' && shot.time >= 10)
        .map((shot) => shot.distance),
    };
  }

  it('never closes in on a player who is not chasing it: it shoots from range only', async () => {
    for (const seed of [4, 5, 6, 7]) {
      for (const yaw of [0, 0.1, 0.3, 0.5]) {
        const { distances, lanceDistances } = standoff(seed, yaw);
        const label = `seed ${seed}, turn ${yaw} rad/s`;
        expect(Math.min(...distances), `closest it came (${label})`).toBeGreaterThan(FLEE_DISTANCE);
        expect(lanceDistances.length, `lances fired (${label})`).toBeGreaterThanOrEqual(1);
        expect(Math.min(...lanceDistances), `closest lance (${label})`).toBeGreaterThan(
          FLEE_DISTANCE
        );
      }
      await breathe();
    }
  });

  it('against a circling player it stays in the fight and fires at its steady rhythm', async () => {
    for (const seed of [4, 5, 6, 7]) {
      for (const yaw of [0.3, 0.5]) {
        const { lanceDistances } = standoff(seed, yaw);
        // 70 秒、约 4.5 秒一发：至少十来发
        expect(
          lanceDistances.length,
          `lances fired, seed ${seed}, turn ${yaw}`
        ).toBeGreaterThanOrEqual(12);
      }
      await breathe();
    }
  });

  // FINDING: spec §3a — "Sniper standoff: while it is neither fleeing nor charging nor outside the
  // leash, a Sniper is inside 380–520 m for at least 60 % of the time against a player flying
  // straight at cruise speed or turning gently. It may use the full throttle range to keep
  // station." The band is not held. The Sniper orbits at 1.0x of its base speed (45 m/s, the same
  // as the player's cruise speed) and does not use its throttle to keep station, so against a
  // player who simply flies straight it either happens to orbit the right way round (seeds 5-7:
  // in the band all the time) or falls behind and trails at 507-673 m (seed 4: in the band 3 % of
  // the counted time, 5 lances in 70 s instead of about 15). Against a gentle turn of 0.1 rad/s it
  // is in the band 53 %, 11 %, 56 % and 57 % of the time (seeds 4-7). Reproduce:
  // FleetRig({ capacity: 2, seed }), one SNIPER 450 m out at 70 degrees off the nose, player at
  // 45 m/s for 80 s; from t = 10 s count the steps on which it is not charging (no beam shown),
  // not fleeing (from the player coming inside 220 m until the range is back to 380 m) and not
  // beyond 900 m, and take the share of those with the range inside 380-520 m.
  it.fails(
    'is inside 380-520 m at least 60 % of the time against a straight or gently turning player',
    () => {
      for (const seed of [4, 5, 6, 7]) {
        for (const yaw of [0, 0.1]) {
          const current = makeRig({ capacity: 2, seed });
          const sniper = current.addJet(
            EnemyType.SNIPER,
            pointAround(current.player, 450, 70 * DEG)
          );
          current.pilot = (active) => active.turnPlayer(yaw * DT);
          let counted = 0;
          let inBand = 0;
          let fleeing = false;
          current.run(80, () => {
            if (current.time < 10) return;
            const distance = current.distanceTo(sniper);
            if (distance < FLEE_DISTANCE) fleeing = true;
            else if (distance >= 380) fleeing = false;
            if (fleeing || sniper.isTelegraphing() || distance > SPEC.LEASH) return;
            counted++;
            if (distance >= 380 && distance <= 520) inBand++;
          });
          expect(counted, `steps that count, seed ${seed}, turn ${yaw} rad/s`).toBeGreaterThan(600);
          expect(inBand / counted, `seed ${seed}, turn ${yaw} rad/s`).toBeGreaterThanOrEqual(0.6);
        }
      }
    }
  );
});

describe('SNIPER flees a player who closes inside 220 m (spec §3)', () => {
  /** 玩家以 80 米/秒追到 220 米以内，然后降回基础速度 45 米/秒继续追 */
  function closeIn(seed: number): { current: FleetRig; sniper: EnemyAI } {
    const current = makeRig({ capacity: 2, seed, playerSpeed: 80 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 430, 10 * DEG));
    current.pilot = chasePilot(sniper, 2);
    expect(
      current.runUntil(() => current.distanceTo(sniper) < FLEE_DISTANCE, 20),
      'the player got inside 220 m'
    ).toBe(true);
    current.player.speed = 45;
    return { current, sniper };
  }

  it.each([161, 162, 163])(
    'seed %s: it turns away and runs at 1.3x speed until the distance has reopened',
    (seed) => {
      const { current, sniper } = closeIn(seed);
      const base = sniper.getConfig().speed;
      const shotsBefore = current.shots.length;

      current.run(1.5);
      const away = sniper.getMesh().position.clone().sub(current.player.position).normalize();
      expect(
        sniper.velocity.clone().normalize().dot(away),
        'flying away from the player 1.5 s later'
      ).toBeGreaterThan(0.7);
      expect(sniper.velocity.length() / base, 'speed 1.5 s later (x base)').toBeGreaterThan(1.25);
      expect(sniper.velocity.length() / base).toBeLessThanOrEqual(SPEC.MAX_THROTTLE + 0.005);

      // 玩家比它慢：距离重新拉开；在 220 米以内期间不蓄力、不开火
      let insideTellSteps = 0;
      let reopenedAt = -1;
      const start = current.time;
      current.run(12, () => {
        const distance = current.distanceTo(sniper);
        if (distance < FLEE_DISTANCE && sniper.isTelegraphing()) insideTellSteps++;
        if (reopenedAt < 0 && distance > 300) reopenedAt = current.time - start;
      });
      expect(insideTellSteps, 'steps charging while the player was inside 220 m').toBe(0);
      expect(reopenedAt, 'seconds until it was 300 m away again').toBeGreaterThan(0);
      for (const shot of current.shots.slice(shotsBefore)) {
        expect(shot.distance, 'no lance from inside 220 m').toBeGreaterThanOrEqual(FLEE_DISTANCE);
      }
    }
  );

  it('a charge in progress is dropped the moment the player is inside 220 m', () => {
    const current = makeRig({ capacity: 2, seed: 164 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    expect(current.runUntil(() => current.tells.length > 0, 30)).toBe(true);
    current.run(0.5);
    expect(sniper.isTelegraphing()).toBe(true);

    // 玩家突然出现在它 150 米外（加力冲到跟前）
    const offset = horizontal(current.player.position.clone().sub(sniper.getMesh().position));
    current.player.position
      .copy(sniper.getMesh().position)
      .addScaledVector(offset.normalize(), 150);
    current.pilot = chasePilot(sniper, 2);
    current.run(2 * DT);
    expect(sniper.isTelegraphing(), 'beam after the player closed in').toBe(false);

    // 被放弃的那次蓄力不会开火
    let fired = 0;
    current.run(1.2, () => {
      fired = current.shots.length;
    });
    expect(fired, 'lances from the dropped charge').toBe(0);
    expect(sniper.velocity.length() / sniper.getConfig().speed).toBeGreaterThan(1.25);
  });
});

describe('SNIPER reaction to LOCK and to a missile (spec §3)', () => {
  it.each(['lock', 'missile'] as const)(
    'on a %s it drops the charge, breaks across the line of sight and holds fire',
    (threat) => {
      const current = makeRig({ capacity: 2, seed: 171 });
      const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
      expect(current.runUntil(() => current.tells.length > 0, 30)).toBe(true);
      current.run(0.6);
      expect(sniper.isTelegraphing()).toBe(true);
      const tellsBefore = current.tells.length;

      if (threat === 'lock') current.lockedJet = sniper;
      else current.missileTargets.add(sniper);
      current.run(2 * DT);
      expect(sniper.isTelegraphing(), 'beam right after the threat appeared').toBe(false);

      current.run(1);
      const toPlayer = horizontal(current.player.position.clone().sub(sniper.getMesh().position));
      const across = angleBetween(horizontal(sniper.velocity), toPlayer) / DEG;
      expect(across, 'angle off the line of sight 1 s later (degrees)').toBeGreaterThan(55);
      expect(across).toBeLessThan(125);

      // 威胁持续 5 秒：不蓄力、不开火
      let beamSteps = 0;
      current.run(4, () => {
        if (sniper.isTelegraphing()) beamSteps++;
      });
      expect(beamSteps, 'steps charging while threatened').toBe(0);
      expect(current.shots.length, 'lances fired while threatened').toBe(0);
      expect(current.tells.length, 'charges started while threatened').toBe(tellsBefore);

      // 威胁解除：重新蓄力，完整预警之后才开火
      current.lockedJet = null;
      current.missileTargets.clear();
      expect(
        current.runUntil(() => current.shots.length > 0, 30),
        'fires again once the threat is gone'
      ).toBe(true);
      const lance = current.shots[0];
      const tell = current.tells[current.tells.length - 1];
      expect(current.tells.length).toBeGreaterThan(tellsBefore);
      expect(Math.abs(lance.time - tell.time - TELL_SECONDS)).toBeLessThanOrEqual(DT + 1e-9);
    }
  );

  it('a lock that arrives during the frozen 0.4 s still cancels the shot', () => {
    const current = makeRig({ capacity: 2, seed: 172 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    expect(current.runUntil(() => current.tells.length > 0, 30)).toBe(true);
    expect(
      current.runUntil(() => sniper.getDoctrine()?.getTell()?.frozen === true, 2),
      'the beam froze'
    ).toBe(true);
    current.run(0.1);
    current.lockedJet = sniper;
    current.run(1.5);
    expect(current.shots.length).toBe(0);
    expect(sniper.isTelegraphing()).toBe(false);
  });
});

describe('SNIPER without a token (spec §2.1)', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('keeps its distance but never charges or fires', () => {
    const current = makeRig({ capacity: 0, seed: 181 });
    const sniper = current.addJet(EnemyType.SNIPER, pointAround(current.player, 450, 70 * DEG));
    current.pilot = (active) => active.turnPlayer(0.3 * DT);
    let beamSteps = 0;
    current.run(40, () => {
      if (sniper.isTelegraphing()) beamSteps++;
    });
    expect(current.shots.length).toBe(0);
    expect(current.tells.length).toBe(0);
    expect(beamSteps).toBe(0);
  });
});

// 规格 §3a："Player not targetable (respawning, story hold, dead): no enemy weapon of any kind
// fires ... and no lock or charge starts." 走真实的 EnemySystem（玩家是否可被攻击由威胁提供者给出）。
describe('SNIPER and a player who cannot be attacked (spec §3a)', () => {
  let system: SystemRig | null = null;
  let randomSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    EventBus.clear();
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededGameRandom(1515));
  });

  afterEach(() => {
    system?.dispose();
    system = null;
    EventBus.clear();
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  function duel(): { current: SystemRig; sniper: EnemyAI } {
    const current = new SystemRig({ level: 2, difficulty: 3 });
    system = current;
    const sniper = current.spawn(EnemyType.SNIPER, pointAround(current.player, 440, 70 * DEG));
    current.pilot = (active) => active.turnPlayer(0.3 * DT);
    return { current, sniper };
  }

  it('starts no charge and fires nothing while the player cannot be attacked, and charges again afterwards', () => {
    const { current, sniper } = duel();
    // 对照：玩家可以被攻击时它会蓄力
    current.run(20, () => current.tells.length > 0);
    expect(current.tells.length, 'control: it charges at a player it may attack').toBeGreaterThan(
      0
    );
    // 等这一发打完、光束收起
    current.run(10, () => !sniper.isTelegraphing());
    expect(sniper.isTelegraphing()).toBe(false);

    current.playerTargetable = false;
    const tells = current.tells.length;
    const shots = current.shots.length;
    let beamSteps = 0;
    current.run(15, () => {
      if (sniper.isTelegraphing()) beamSteps++;
    });
    expect(current.tells.length - tells, 'charges started').toBe(0);
    expect(beamSteps, 'steps with the aiming beam showing').toBe(0);
    expect(current.shots.length - shots, 'rounds fired').toBe(0);

    current.playerTargetable = true;
    current.run(15, () => current.tells.length > tells);
    expect(current.tells.length, 'it charges again once the player is back').toBeGreaterThan(tells);
  });

  it('a charge already under way does not end in a lance once the player cannot be attacked', () => {
    const { current } = duel();
    current.run(20, () => current.tells.length > 0);
    expect(current.tells.length).toBeGreaterThan(0);
    // 蓄力到一半（光束还在跟踪）玩家变成不可被攻击
    current.run(0.5);
    const shots = current.shots.length;
    current.playerTargetable = false;
    current.run(6);
    expect(current.shots.length - shots, 'rounds fired at a player who cannot be attacked').toBe(0);
  });
});
