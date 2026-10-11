import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_CONSTANTS } from '@/config';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import {
  DEG,
  DT,
  FleetRig,
  SIM_TEST_TIMEOUT,
  bearingOf,
  pointAround,
  type FleetRigOptions,
} from './enemyFleetRig';

vi.setConfig({ testTimeout: SIM_TEST_TIMEOUT });

/**
 * 敌机舰队 M3 里两处顺带的修正，按它们要保证的行为来测：
 *
 * 1. 竖直构件（第 9 关的天梯主干，顶在 7000 米；支柱 / 锚塔）：敌机不会被“托”到构件顶上——
 *    以前飞进构件的占地范围会被贴地兜底一步抬到 7000 米，再花几分钟飞回战场。现在绕开它，
 *    仍然不会钻进实体地形；普通的山梁照旧爬过去。
 * 2. 狙击机（规格 §3 SNIPER / §3a standoff）：照着它的机炮提前量标记追它的玩家（机头压在提前量
 *    点上，离它本身二三十度）也算在追它——它不再一直保持 380–520 米，玩家能逼近到 300 米以内。
 */

let rig: FleetRig | null = null;

function makeRig(options: FleetRigOptions = {}): FleetRig {
  rig?.dispose();
  rig = new FleetRig(options);
  return rig;
}

afterEach(() => {
  rig?.dispose();
  rig = null;
});

// ─────────────────────────────── 竖直构件 ───────────────────────────────

/** 海面上一根圆柱构件：中心 (cx, cz)、半径 radius、顶高 height；其余是海面（0 米） */
function pillarSampler(
  cx: number,
  cz: number,
  radius: number,
  height: number
): (x: number, z: number) => number {
  return (x, z) => (Math.hypot(x - cx, z - cz) <= radius ? height : 0);
}

describe('a tall vertical structure (the level 9 sky-ladder trunk)', () => {
  const TRUNK = { x: 0, z: 600, radius: 60, height: 7000 };

  /** 玩家在原点上空、构件在玩家与敌机之间：敌机正对着构件飞来 */
  function behindTheTrunk(type: EnemyType, seed: number): { current: FleetRig; jet: EnemyAI } {
    const current = makeRig({ capacity: 2, seed, playerForward: new THREE.Vector3(0, 0, 1) });
    // 玩家绕着原点慢慢转：不会自己撞上构件
    current.pilot = (fleet) => fleet.turnPlayer(0.15 * DT);
    const jet = current.addJet(type, new THREE.Vector3(0, 300, 1300), {
      heading: new THREE.Vector3(0, 0, -1),
    });
    jet.setTerrainSampler(pillarSampler(TRUNK.x, TRUNK.z, TRUNK.radius, TRUNK.height));
    return { current, jet };
  }

  function insideTrunk(position: THREE.Vector3): boolean {
    return (
      Math.hypot(position.x - TRUNK.x, position.z - TRUNK.z) <= TRUNK.radius &&
      position.y < TRUNK.height
    );
  }

  it.each([
    [EnemyType.FIGHTER, 901],
    [EnemyType.SCOUT, 902],
    [EnemyType.HEAVY, 903],
    [EnemyType.ACE, 904],
  ] as const)(
    '%s flying at it: never lifted onto the top, never inside it, and it still gets to the player',
    (type, seed) => {
      const { current, jet } = behindTheTrunk(type, seed);
      let highest = -Infinity;
      let inside = 0;
      let closest = Infinity;
      let passedTrunk = false;
      current.run(60, () => {
        const position = jet.getMesh().position;
        highest = Math.max(highest, position.y);
        if (insideTrunk(position)) inside++;
        closest = Math.min(closest, current.distanceTo(jet));
        if (position.z < TRUNK.z - TRUNK.radius) passedTrunk = true;
      });
      expect(passedTrunk, 'it got past the trunk').toBe(true);
      expect(highest, 'highest altitude (m)').toBeLessThan(1500);
      expect(inside, 'steps inside the trunk').toBe(0);
      expect(closest, 'closest it came to the player (m)').toBeLessThan(400);
    }
  );

  it('a jet that is already inside the structure is put on top of it (it never stays inside)', () => {
    const current = makeRig({ capacity: 2, seed: 905 });
    const jet = current.addJet(EnemyType.FIGHTER, new THREE.Vector3(TRUNK.x, 300, TRUNK.z));
    jet.setTerrainSampler(pillarSampler(TRUNK.x, TRUNK.z, TRUNK.radius, TRUNK.height));
    current.step();
    expect(insideTrunk(jet.getMesh().position)).toBe(false);
  });

  it('an ordinary ridge (less than 200 m above the jet) is still climbed over, not flown around', () => {
    const current = makeRig({ capacity: 2, seed: 906, playerForward: new THREE.Vector3(0, 0, 1) });
    current.pilot = (fleet) => fleet.turnPlayer(0.15 * DT);
    const jet = current.addJet(EnemyType.FIGHTER, new THREE.Vector3(0, 150, 1300), {
      heading: new THREE.Vector3(0, 0, -1),
    });
    // 一道东西走向的山梁：z 在 560–640 之间高 280 米（比本机高 130 米）
    const ridge = (_x: number, z: number): number => (z >= 560 && z <= 640 ? 280 : 0);
    jet.setTerrainSampler(ridge);
    let crossed = false;
    let underground = 0;
    let lowestOverRidge = Infinity;
    current.run(40, () => {
      const position = jet.getMesh().position;
      if (position.y < ridge(position.x, position.z)) underground++;
      if (position.z >= 560 && position.z <= 640) {
        lowestOverRidge = Math.min(lowestOverRidge, position.y);
        crossed = true;
      }
    });
    expect(crossed, 'it flew over the ridge').toBe(true);
    expect(underground, 'steps below the surface').toBe(0);
    expect(lowestOverRidge, 'lowest altitude over the ridge (m)').toBeGreaterThan(280);
  });
});

// ─────────────────────────────── 狙击机与提前量 ───────────────────────────────

/**
 * 机炮提前量点：玩家子弹（GAME_CONSTANTS.PROJECTILE.SPEED）与以当前速度直飞的目标的一阶拦截点。
 * 没有拦截解时返回目标本身的位置。
 */
function gunLeadPoint(from: THREE.Vector3, jet: EnemyAI): THREE.Vector3 {
  const position = jet.getMesh().position;
  const velocity = jet.velocity;
  const speed = GAME_CONSTANTS.PROJECTILE.SPEED;
  const d = position.clone().sub(from);
  const a = velocity.lengthSq() - speed * speed;
  const b = 2 * d.dot(velocity);
  const c = d.lengthSq();
  let time = -1;
  if (Math.abs(a) < 1e-9) {
    time = b < 0 ? -c / b : -1;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);
      const candidates = [t1, t2].filter((t) => t > 0);
      if (candidates.length > 0) time = Math.min(...candidates);
    }
  }
  return time > 0 ? position.clone().addScaledVector(velocity, time) : position.clone();
}

/** 脚本飞行员：以有限角速度把机头水平转向敌机的机炮提前量点——“照着提前量标记追它” */
function leadChasePilot(jet: EnemyAI, turnRate: number): (fleet: FleetRig) => void {
  return (fleet) => {
    const { player } = fleet;
    const want = bearingOf(player.position, gunLeadPoint(player.position, jet));
    const have = Math.atan2(player.forward.x, player.forward.z);
    let delta = want - have;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const limit = turnRate * DT;
    fleet.turnPlayer(Math.max(-limit, Math.min(limit, delta)));
  };
}

describe('SNIPER chased with the gun-lead marker', () => {
  it.each([
    [1101, 60],
    [1102, -75],
    [1103, 120],
    [1104, -140],
    [1105, 30],
    [1106, 90],
  ])(
    'seed %s, starting %s° off the nose: a player aiming at its lead point closes inside 300 m',
    (seed, bearing) => {
      const current = makeRig({ capacity: 2, seed, playerSpeed: 45 });
      const sniper = current.addJet(
        EnemyType.SNIPER,
        pointAround(current.player, 450, bearing * DEG)
      );
      current.pilot = leadChasePilot(sniper, 2);
      // 前提：照着提前量追的时候，机头离它本身确实有一个明显的角度（不是直接对着它）
      let leadOffsetSum = 0;
      let leadSamples = 0;
      const closed = current.runUntil(() => {
        const toJet = sniper.getMesh().position.clone().sub(current.player.position);
        const toLead = gunLeadPoint(current.player.position, sniper).sub(current.player.position);
        leadOffsetSum += toJet.angleTo(toLead);
        leadSamples++;
        return current.distanceTo(sniper) < 300;
      }, 90);
      expect(closed, 'got inside 300 m within 90 s').toBe(true);
      expect(leadOffsetSum / leadSamples / DEG, 'mean lead offset (deg)').toBeGreaterThan(3);
    }
  );
});
