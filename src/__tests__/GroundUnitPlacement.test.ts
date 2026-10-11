import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDeploymentWaveCount, getWaveDeployment } from '@/features/units/UnitDeployments';
import type { UnitEntity } from '@/features/units/UnitEntity';
import { createUnitMesh } from '@/features/units/UnitMeshFactory';
import { UnitSystem, type UnitInstance, type UnitUpdateContext } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UnitType } from '@/features/units/UnitTypes';
import {
  DRY_HEIGHT,
  LAKE_FIELD,
  WET_TARGETS,
  aimedPoses,
  disposeTerrains,
  isDryLandTruth,
  randomPoses,
  routeProviderFor,
  startPoseFor,
  terrainFor,
  volcanoTruth,
  withSeededRandom,
  type PlayerPose,
} from './groundPlacementRig';

/**
 * 地面单位落点契约（真实地形采样器 + 独立真值，见 groundPlacementRig）：
 * 1. 有采样器时每个地面单位都出生在干燥陆地上，且每个部署的地面单位都能出生；
 * 2. 海上单位仍只出生在可航行水面上；
 * 3. 同样的输入（玩家位姿 + Math.random 序列）给出同样的位置与航线；
 * 4. 坦克追击玩家越过湖岸 / 熔岩河时停下或转向，从不站在非陆地上；
 * 5. 地面航线的航点与相邻航点之间（≤ 20 米采样）都在陆地上，地面航线部署总能拿到航线。
 *
 * 采样密度：每关 = 出生姿态 + 8 个确定性随机位置（半径 1300 米圆盘内、随机航向）+ 瞄准位姿
 * （玩家在已知水域 / 熔岩外 565 米、四向机头对准，让「前方」集群落在水上）；每个位姿跑该关全部
 * 波次，每次生成前按 (关卡, 波次, 位姿序号) 派生种子固定 Math.random。
 */

/** 契约陆地表列出的、有地面单位的关卡（第 4 关只有海上单位，第 9 关只有空中单位） */
const CONTRACT_GROUND_LEVELS = [1, 2, 3, 5, 6, 7] as const;
/** 契约陆地表未列出的关卡：峡谷河道（第 8 关）与城堡熔岩裂谷（第 10 关）用弱真值 */
const OTHER_GROUND_LEVELS = [8, 10] as const;
const ALL_GROUND_LEVELS = [...CONTRACT_GROUND_LEVELS, ...OTHER_GROUND_LEVELS] as const;
/** 有海上单位的关卡 */
const SEA_LEVELS = [1, 4, 6, 7] as const;
/** 有地面航线部署（route 放置的地面单位）的关卡 */
const GROUND_ROUTE_LEVELS = [1, 2, 5, 8, 10] as const;
const RANDOM_POSES = 8;
/** 航线连续性采样步长上限（米） */
const ROUTE_STEP = 20;

/** 部署表里以 route 放置的地面单位类型（护送车队、平民卡车） */
const GROUND_ROUTE_TYPES: ReadonlySet<UnitType> = new Set(
  Array.from({ length: 10 }, (_, index) => index + 1).flatMap((level) =>
    Array.from({ length: getDeploymentWaveCount(level) }, (_, wave) =>
      getWaveDeployment(level, wave)
        .filter((spec) => spec.placement === 'route')
        .map((spec) => spec.type)
        .filter((type) => UNIT_CONFIGS[type].domain === 'ground')
    ).flat()
  )
);

interface UnitRecord {
  readonly type: UnitType;
  readonly x: number;
  readonly z: number;
  /** 地面航线单位：[出生点, ...剩余航点]；其余为 null */
  readonly path: readonly THREE.Vector3[] | null;
}

interface SpawnCase {
  readonly where: string;
  readonly wave: number;
  readonly expectedGround: Record<string, number>;
  readonly expectedGroundRoutes: number;
  readonly units: readonly UnitRecord[];
}

function makeUnits(level: number): UnitSystem {
  const generator = terrainFor(level);
  const units = new UnitSystem(new THREE.Scene(), null);
  units.setSurfaceSampler((x, z) => generator.sampleSurface(x, z));
  units.setRouteProvider(routeProviderFor(generator));
  return units;
}

function playerContext(position: THREE.Vector3, quaternion?: THREE.Quaternion): UnitUpdateContext {
  const playerMesh = new THREE.Object3D();
  playerMesh.position.copy(position);
  if (quaternion) playerMesh.quaternion.copy(quaternion);
  return { playerMesh, playerPosition: position, enemyAirMeshes: [], friendlyAirMeshes: [] };
}

function spawnSeed(level: number, wave: number, poseIndex: number): number {
  return 1_000_003 * level + 7_919 * wave + 104_729 * poseIndex + 17;
}

function record(unit: UnitInstance): UnitRecord {
  const position = unit.getPosition();
  const route = (unit as UnitEntity).route;
  const path =
    GROUND_ROUTE_TYPES.has(unit.type) && route
      ? [position.clone(), ...route.map((point) => point.clone())]
      : null;
  return { type: unit.type, x: position.x, z: position.z, path };
}

/** 新建 UnitSystem，先用一帧上下文记下玩家朝向，再生成一波（Math.random 固定种子） */
function spawnRecords(
  level: number,
  wave: number,
  pose: PlayerPose,
  seed: number
): readonly UnitRecord[] {
  const units = makeUnits(level);
  try {
    return withSeededRandom(seed, () => {
      units.updateWithContext(1 / 60, playerContext(pose.position.clone(), pose.quaternion));
      return units.spawnForWave(level, wave, pose.position.clone()).map(record);
    });
  } finally {
    units.dispose();
  }
}

function expectedGroundCounts(level: number, wave: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spec of getWaveDeployment(level, wave)) {
    if (UNIT_CONFIGS[spec.type].domain !== 'ground') continue;
    counts[spec.type] = (counts[spec.type] ?? 0) + spec.count;
  }
  return counts;
}

function expectedGroundRouteCount(level: number, wave: number): number {
  return getWaveDeployment(level, wave)
    .filter((spec) => spec.placement === 'route' && GROUND_ROUTE_TYPES.has(spec.type))
    .reduce((sum, spec) => sum + spec.count, 0);
}

function posesFor(level: number): PlayerPose[] {
  const generator = terrainFor(level);
  return [
    startPoseFor(level, generator),
    ...randomPoses(level, RANDOM_POSES, generator),
    ...aimedPoses(level, generator),
  ];
}

const spawnCache = new Map<number, readonly SpawnCase[]>();

/** 每关：全部位姿 × 全部波次各生成一次（结果缓存，多个断言共用） */
function spawnCases(level: number): readonly SpawnCase[] {
  const cached = spawnCache.get(level);
  if (cached) return cached;
  const cases: SpawnCase[] = [];
  const waves = getDeploymentWaveCount(level);
  posesFor(level).forEach((pose, poseIndex) => {
    for (let wave = 0; wave < waves; wave++) {
      cases.push({
        where: `L${level} W${wave + 1} ${pose.label}`,
        wave,
        expectedGround: expectedGroundCounts(level, wave),
        expectedGroundRoutes: expectedGroundRouteCount(level, wave),
        units: spawnRecords(level, wave, pose, spawnSeed(level, wave, poseIndex)),
      });
    }
  });
  spawnCache.set(level, cases);
  return cases;
}

function fmt(value: number): string {
  return value.toFixed(1);
}

/** 折线按 ≤ step 米等分采样（含两端点） */
function samplePath(path: readonly THREE.Vector3[], step: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  if (path.length > 0) points.push([path[0].x, path[0].z]);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const pieces = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let k = 1; k <= pieces; k++) {
      const t = k / pieces;
      points.push([a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t]);
    }
  }
  return points;
}

function pathLength(path: readonly THREE.Vector3[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
  }
  return total;
}

/** 每个地面单位出生点都必须满足真值 */
function groundUnitsOffLand(level: number): string[] {
  const generator = terrainFor(level);
  const offLand: string[] = [];
  for (const spawn of spawnCases(level)) {
    for (const unit of spawn.units) {
      if (UNIT_CONFIGS[unit.type].domain !== 'ground') continue;
      if (!isDryLandTruth(level, generator, unit.x, unit.z)) {
        offLand.push(`${spawn.where}: ${unit.type} at (${fmt(unit.x)}, ${fmt(unit.z)})`);
      }
    }
  }
  return offLand;
}

/** 每个部署的地面单位都必须出生 */
function missingGroundUnits(level: number): string[] {
  const missing: string[] = [];
  for (const spawn of spawnCases(level)) {
    const counts: Record<string, number> = {};
    for (const unit of spawn.units) {
      if (UNIT_CONFIGS[unit.type].domain !== 'ground') continue;
      counts[unit.type] = (counts[unit.type] ?? 0) + 1;
    }
    for (const [type, expected] of Object.entries(spawn.expectedGround)) {
      if ((counts[type] ?? 0) !== expected) {
        missing.push(`${spawn.where}: ${type} ${counts[type] ?? 0}/${expected}`);
      }
    }
  }
  return missing;
}

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  // 预热模型模板：首次建模板创建的 Object3D / 材质比克隆多，THREE 的 uuid 也取自 Math.random，
  // 不预热时第一次生成会多消耗随机数，结果随测试过滤顺序变化
  for (const type of Object.values(UnitType)) createUnitMesh(type);
});

afterAll(() => {
  disposeTerrains();
  vi.restoreAllMocks();
});

describe('rig sanity', () => {
  it('every aimed target is off dry land by the ground truth', () => {
    for (const [level, targets] of Object.entries(WET_TARGETS)) {
      const generator = terrainFor(Number(level));
      for (const [x, z] of targets) {
        expect(isDryLandTruth(Number(level), generator, x, z), `L${level} (${x}, ${z})`).toBe(
          false
        );
      }
    }
  });
});

describe('ground unit spawns with a real terrain sampler', () => {
  it.each(CONTRACT_GROUND_LEVELS)(
    'level %i: every ground unit stands on dry land from the start pose, random and aimed poses',
    (level) => {
      expect(groundUnitsOffLand(level)).toEqual([]);
    }
  );

  it.each(ALL_GROUND_LEVELS)(
    'level %i: every deployed ground unit still spawns from every player pose',
    (level) => {
      expect(missingGroundUnits(level)).toEqual([]);
    }
  );

  it.each(SEA_LEVELS)('level %i: sea units still spawn only on navigable water', (level) => {
    const generator = terrainFor(level);
    const offWater: string[] = [];
    for (const spawn of spawnCases(level)) {
      for (const unit of spawn.units) {
        if (UNIT_CONFIGS[unit.type].domain !== 'sea') continue;
        if (!generator.sampleSurface(unit.x, unit.z).water) {
          offWater.push(`${spawn.where}: ${unit.type} at (${fmt(unit.x)}, ${fmt(unit.z)})`);
        }
      }
    }
    expect(offWater).toEqual([]);
  });

  it.each([1, 3, 6, 7, 8] as const)(
    'level %i: the same pose and random sequence give the same positions and routes',
    (level) => {
      const poses = posesFor(level);
      const waves = getDeploymentWaveCount(level);
      for (const [index, pose] of [poses[0], poses[3], poses[poses.length - 1]].entries()) {
        for (let wave = 0; wave < waves; wave++) {
          const seed = spawnSeed(level, wave, index + 40);
          const first = spawnRecords(level, wave, pose, seed);
          const second = spawnRecords(level, wave, pose, seed);
          expect(second, `L${level} W${wave + 1} ${pose.label}`).toEqual(first);
        }
      }
    }
  );
});

describe('ground unit spawns on levels outside the contract land table', () => {
  it('level 8: no ground unit spawns in the canyon river', () => {
    expect(groundUnitsOffLand(8)).toEqual([]);
  });

  it('level 10: no ground unit spawns in a citadel lava rift (land excludes lava)', () => {
    expect(groundUnitsOffLand(10)).toEqual([]);
  });
});

describe('ground routes with a real terrain sampler', () => {
  it.each(GROUND_ROUTE_LEVELS)(
    'level %i: every ground route point and the path between points (<= 20 m) is dry land',
    (level) => {
      const generator = terrainFor(level);
      const wet: string[] = [];
      for (const spawn of spawnCases(level)) {
        for (const unit of spawn.units) {
          if (!unit.path) continue;
          const bad = samplePath(unit.path, ROUTE_STEP).filter(
            ([x, z]) => !isDryLandTruth(level, generator, x, z)
          );
          if (bad.length > 0) {
            const [x, z] = bad[0];
            wet.push(
              `${spawn.where}: ${unit.type} ${bad.length} wet samples, first (${fmt(x)}, ${fmt(z)})`
            );
          }
        }
      }
      expect(wet).toEqual([]);
    }
  );

  it.each(GROUND_ROUTE_LEVELS)(
    'level %i: every ground route deployment still spawns with a route to drive',
    (level) => {
      const problems: string[] = [];
      for (const spawn of spawnCases(level)) {
        const routed = spawn.units.filter((unit) => unit.path !== null);
        const deployed = spawn.units.filter((unit) => GROUND_ROUTE_TYPES.has(unit.type));
        if (routed.length !== spawn.expectedGroundRoutes || deployed.length !== routed.length) {
          problems.push(
            `${spawn.where}: ${routed.length} routed of ${deployed.length} spawned, ` +
              `${spawn.expectedGroundRoutes} deployed`
          );
        }
        for (const unit of routed) {
          const path = unit.path ?? [];
          if (path.length < 2 || !(pathLength(path) > 1)) {
            problems.push(`${spawn.where}: ${unit.type} route ${fmt(pathLength(path))} m`);
          }
        }
      }
      expect(problems).toEqual([]);
    }
  );

  it('level 1 wave 4: the ALLY_CONVOY escort column gets a route from every sampled pose', () => {
    const convoyWave = 3;
    const expected = getWaveDeployment(1, convoyWave)
      .filter((spec) => spec.type === UnitType.ALLY_CONVOY)
      .reduce((sum, spec) => sum + spec.count, 0);
    expect(expected).toBe(3);
    const cases = spawnCases(1).filter((spawn) => spawn.wave === convoyWave);
    expect(cases).toHaveLength(posesFor(1).length);
    for (const spawn of cases) {
      const convoy = spawn.units.filter((unit) => unit.type === UnitType.ALLY_CONVOY);
      expect(convoy, spawn.where).toHaveLength(expected);
      for (const unit of convoy) {
        expect(unit.path, spawn.where).not.toBeNull();
        expect(unit.path?.length ?? 0, spawn.where).toBeGreaterThanOrEqual(2);
        expect(pathLength(unit.path ?? []), spawn.where).toBeGreaterThan(1);
      }
    }
  });
});

describe('tanks chasing the player across a shoreline', () => {
  const CHASE_SECONDS = 90;
  const DT = 1 / 20;

  interface ChaseResult {
    readonly offLand: string[];
    readonly travelled: number;
    readonly alive: boolean;
  }

  /** 坦克从 start 出发追击悬停在 player 上空的玩家 90 秒；记录每帧是否站在真值陆地上 */
  function chase(
    level: number,
    start: THREE.Vector3,
    player: THREE.Vector3,
    seed: number
  ): ChaseResult {
    const generator = terrainFor(level);
    expect(isDryLandTruth(level, generator, start.x, start.z), 'tank starts on dry land').toBe(
      true
    );
    const ctx = playerContext(player);
    const units = makeUnits(level);
    try {
      return withSeededRandom(seed, () => {
        const tank = units.spawnUnit(UnitType.TANK, start.clone());
        expect(tank).not.toBeNull();
        const unit = tank as UnitInstance;
        const position = unit.getPosition();
        const origin = position.clone();
        let travelled = 0;
        const offLand: string[] = [];
        for (let frame = 0; frame < CHASE_SECONDS / DT; frame++) {
          units.updateWithContext(DT, ctx);
          unit.getPosition(position);
          travelled = Math.max(travelled, Math.hypot(position.x - origin.x, position.z - origin.z));
          if (offLand.length < 5 && !isDryLandTruth(level, generator, position.x, position.z)) {
            offLand.push(`t=${fmt(frame * DT)}s at (${fmt(position.x)}, ${fmt(position.z)})`);
          }
        }
        return { offLand, travelled, alive: unit.isAlive() };
      });
    } finally {
      units.dispose();
    }
  }

  /** 第 1 关：从湖心沿 angle 向外，找到其后连续 80 米都是干地的第一个岸点（距湖心米数） */
  function lakeShoreDistance(angle: number): number {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    for (let r = 0; r < 1300; r += 5) {
      let dry = true;
      for (let k = 0; k <= 80 && dry; k += 5) {
        dry = LAKE_FIELD.heightAt(dx * (r + k), dz * (r + k)) >= DRY_HEIGHT;
      }
      if (dry) return r;
    }
    return Number.NaN;
  }

  /** 湖岸有连续干地、且起点仍在战场内的方向（x = cos, z = sin；湖向南延伸出战场） */
  const LAKE_APPROACH_DEGREES = [135, 180, 210, 255, 285, 330] as const;

  it.each(LAKE_APPROACH_DEGREES)(
    'level 1: a tank 60 m inland at %i° chases a player across the lake and never leaves dry land',
    (degrees) => {
      const angle = THREE.MathUtils.degToRad(degrees);
      const shore = lakeShoreDistance(angle);
      expect(Number.isFinite(shore) && shore + 60 < 1250, `shore at ${degrees}°: ${shore}`).toBe(
        true
      );
      const start = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(
        shore + 60
      );
      // 玩家悬停在湖对面 900 米处（坦克停车距离 250 米，必须越湖才能接近）
      const player = new THREE.Vector3(-Math.cos(angle) * 900, 150, -Math.sin(angle) * 900);
      const result = chase(1, start, player, 5000 + degrees);
      expect(result.alive).toBe(true);
      expect(result.offLand).toEqual([]);
      // 非空测试：坦克确实朝湖岸开动过
      expect(result.travelled).toBeGreaterThan(20);
    }
  );

  /** 第 6 关熔岩河 2 的一段（[440,-232] → [528,-112]）两侧各 60 米出发，玩家在对岸 700 米 */
  it.each([1, -1] as const)(
    'level 6: a tank 60 m beside a lava river (side %i) chases a player across it and never stands on lava or water',
    (side) => {
      const ax = 440;
      const az = -232;
      const bx = 528;
      const bz = -112;
      const length = Math.hypot(bx - ax, bz - az);
      const nx = ((bz - az) / length) * side;
      const nz = (-(bx - ax) / length) * side;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      expect(volcanoTruth().surfaceKindAt(mx, mz)).toBe('lava');
      const start = new THREE.Vector3(mx + nx * 60, 0, mz + nz * 60);
      const player = new THREE.Vector3(mx - nx * 700, 200, mz - nz * 700);
      const result = chase(6, start, player, 6100 + side);
      expect(result.alive).toBe(true);
      expect(result.offLand).toEqual([]);
      expect(result.travelled).toBeGreaterThan(20);
    }
  );
});
