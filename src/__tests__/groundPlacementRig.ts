import * as THREE from 'three';
import { vi } from 'vitest';
import { resolveLevelStartPose } from '@/core/campaign/LevelStartPose';
import { getLevelConfig, type LevelConfig } from '@/features/terrain/LevelConfig';
import { TerrainGenerator } from '@/features/terrain/TerrainGenerator';
import { ArcticField } from '@/features/terrain/environments/ArcticField';
import { VolcanoEnvironment } from '@/features/terrain/environments/VolcanoEnvironment';
import {
  ALPINE_RIDGE_PRESET,
  Heightfield,
  LAKESIDE_VALLEY_PRESET,
} from '@/features/terrain/worldscape/heightfield';
import { UNIT_BATTLEFIELD_LIMIT } from '@/features/units/UnitPlacement';
import type { UnitRouteProvider } from '@/features/units/UnitSystem';

/**
 * 地面单位落点测试台：用真实地形代码（TerrainGenerator.generateTerrain，jsdom 下 getContext 返回
 * null）生成关卡地表，作为 UnitSystem 的采样器；另用独立实例给出「肉眼可见的干燥陆地」真值，
 * 不依赖被测的 land 标志：
 * - 第 1 / 3 关：Heightfield（湖谷 / 雪山预设）heightAt >= 0.5（渲染器的干地阈值）；
 * - 第 2 关：沙漠绿洲水塘（520, -360）的不规则岸线之外；第 5 关：公园池塘（62, -46）岸线之外；
 * - 第 6 关：VolcanoEnvironment.surfaceKindAt 既不是 'water' 也不是 'lava'；
 * - 第 7 关：ArcticField 静态冰体（冰架 / 冰山）上，不是开阔海面（漂移浮冰不算）；
 * - 第 8 关（契约未列出，弱真值）：地表材质不是河道 'water'；
 * - 第 10 关（契约未列出，弱真值）：地表材质不是熔岩裂谷 'lava'；
 * - 第 4 / 9 关没有地面单位。
 */

/** 渲染器的干地阈值（局部高度，米）：heightAt >= 0.5 才露出水面 */
export const DRY_HEIGHT = 0.5;
/** 船只可航行水深阈值（局部高度，米）：低于 -2 */
export const NAVIGABLE_HEIGHT = -2;

/** 确定性伪随机（mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 在 Math.random 换成固定种子序列的情况下运行 run（结束后只恢复 Math.random） */
export function withSeededRandom<T>(seed: number, run: () => T): T {
  const spy = vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

/** 不规则岸线半径（与 TerrainGenerator.createIrregularShape 同公式） */
function irregularRadius(
  angle: number,
  baseRadius: number,
  jitter: number,
  freqA: number,
  freqB: number,
  phaseA: number,
  phaseB: number
): number {
  return (
    baseRadius +
    Math.sin(angle * freqA + phaseA) * jitter * 0.9 +
    Math.cos(angle * freqB + phaseB) * jitter * 0.65 +
    Math.sin(angle * 1.5 + phaseA * 0.8) * (jitter * 0.2)
  );
}

/** 沙漠绿洲水塘：形状平面绕 X 轴转 -90°，形状 y 对应世界 -z */
export const DESERT_OASIS = { x: 520, z: -360 } as const;
function insideDesertOasis(x: number, z: number): boolean {
  const lx = x - DESERT_OASIS.x;
  const ly = -(z - DESERT_OASIS.z);
  const radius = irregularRadius(Math.atan2(ly, lx), 27, 5, 2.4, 4.6, 1.2, 0.4);
  return Math.hypot(lx, ly) < radius;
}

/** 城市公园池塘：水深 = (岸线半径 - 距离) * 0.3，水深 > 0 处可见水面 */
export const CITY_POND = { x: 62, z: -46 } as const;
function insideCityPond(x: number, z: number): boolean {
  const dx = x - CITY_POND.x;
  const dz = z - CITY_POND.z;
  const angle = Math.atan2(dz, dx);
  const rim = 52 + Math.sin(angle * 2.8 + 0.5) * 7.5 + Math.cos(angle * 4.4 + 1.1) * 5;
  return Math.hypot(dx, dz) < rim;
}

export const LAKE_FIELD = new Heightfield(LAKESIDE_VALLEY_PRESET);
export const ALPINE_FIELD = new Heightfield(ALPINE_RIDGE_PRESET);
const ARCTIC_FIELD = new ArcticField(0);
let volcano: VolcanoEnvironment | null = null;

/** 第 6 关真值用的独立火山环境（解析场随构造创建，无需 build） */
export function volcanoTruth(): VolcanoEnvironment {
  volcano ??= new VolcanoEnvironment();
  return volcano;
}

/** 第 7 关：静态冰体（冰架 / 冰山）上 */
export function isStaticIce(x: number, z: number): boolean {
  return ARCTIC_FIELD.staticIceTop(x, z) !== null;
}

/**
 * 地面单位可以站立的真值（与 land 标志无关）。generator 用于契约未列出的第 8 / 10 关。
 */
export function isDryLandTruth(
  level: number,
  generator: TerrainGenerator,
  x: number,
  z: number
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  switch (level) {
    case 1:
      return LAKE_FIELD.heightAt(x, z) >= DRY_HEIGHT;
    case 2:
      return !insideDesertOasis(x, z);
    case 3:
      return ALPINE_FIELD.heightAt(x, z) >= DRY_HEIGHT;
    case 4:
      return !generator.sampleSurface(x, z).water;
    case 5:
      return !insideCityPond(x, z);
    case 6: {
      const kind = volcanoTruth().surfaceKindAt(x, z);
      return kind !== 'water' && kind !== 'lava';
    }
    case 7:
      return isStaticIce(x, z);
    case 8:
      return generator.getSurfaceKind(x, z) !== 'water';
    case 10:
      return generator.getSurfaceKind(x, z) !== 'lava';
    default:
      return true;
  }
}

const generators = new Map<number, TerrainGenerator>();

/** 每关一个真实地形（首次调用时生成并缓存）；调用前需 mock getContext */
export function terrainFor(level: number): TerrainGenerator {
  const cached = generators.get(level);
  if (cached) return cached;
  const config = getLevelConfig(level) as LevelConfig | undefined;
  if (!config) throw new Error(`no level ${level}`);
  const generator = new TerrainGenerator(new THREE.Scene());
  generator.generateTerrain(config);
  generators.set(level, generator);
  return generator;
}

export function disposeTerrains(): void {
  for (const generator of generators.values()) {
    generator.clearTerrain();
  }
  generators.clear();
}

/** 与 GameCoordinator 相同的外部航线（峡谷车队土路 / 城堡突击走廊，只给地面单位） */
export function routeProviderFor(generator: TerrainGenerator): UnitRouteProvider {
  return (_type, domain) => {
    if (domain !== 'ground') return null;
    const environment = generator.getEnvironment() as
      | (object & {
          getConvoyRoute?: () => readonly THREE.Vector3[];
          getAssaultRoute?: () => readonly THREE.Vector3[];
        })
      | null;
    return environment?.getConvoyRoute?.() ?? environment?.getAssaultRoute?.() ?? null;
  };
}

export interface PlayerPose {
  readonly label: string;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

/** 关卡出生姿态（与游戏相同：坠毁面采样） */
export function startPoseFor(level: number, generator: TerrainGenerator): PlayerPose {
  const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  resolveLevelStartPose(level, (x, z) => generator.getCrashSurfaceY(x, z), out);
  return { label: 'start pose', position: out.position, quaternion: out.quaternion };
}

/** 战场内（半径 UNIT_BATTLEFIELD_LIMIT 的圆盘）确定性随机玩家位置与航向 */
export function randomPoses(
  level: number,
  count: number,
  generator: TerrainGenerator
): PlayerPose[] {
  const random = mulberry32(9100 + level * 131);
  const poses: PlayerPose[] = [];
  for (let i = 0; i < count; i++) {
    const radius = UNIT_BATTLEFIELD_LIMIT * Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    const heading = random() * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * radius);
    const z = Math.round(Math.sin(angle) * radius);
    const y = Math.max(0, generator.getCrashSurfaceY(x, z) + 150);
    poses.push({
      label: `random #${i} (${x}, ${z})`,
      position: new THREE.Vector3(x, y, z),
      quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
    });
  }
  return poses;
}

/**
 * 各关已知的非陆地目标（湖心 / 绿洲 / 高山湖 / 公园池塘 / 熔岩湖与熔岩河 / 开阔海面 / 河道 /
 * 熔岩裂谷），用来构造「前方集群正好落在水上」的玩家位姿。
 */
export const WET_TARGETS: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  1: [
    [0, 0],
    [300, 600],
  ],
  2: [[DESERT_OASIS.x, DESERT_OASIS.z]],
  3: [[330, -300]],
  5: [[CITY_POND.x, CITY_POND.z]],
  6: [
    [470, -330],
    [484, -172],
  ],
  7: [
    [0, 0],
    [300, 300],
  ],
  8: [
    [0, 0],
    [-50, 700],
  ],
  10: [[405, -305]],
};

/** 「前方」集群中心的典型距离（UnitPlacement 'ahead'：480-650 米） */
const AHEAD_DISTANCE = 565;

/**
 * 瞄准位姿：玩家在目标外 565 米、机头正对目标（四个方向接近，战场外的跳过）。
 * 机头方向 (fx, fz)：绕 Y 轴转 atan2(-fx, -fz) 把局部 -Z 转到该方向。
 */
export function aimedPoses(level: number, generator: TerrainGenerator): PlayerPose[] {
  const poses: PlayerPose[] = [];
  for (const [tx, tz] of WET_TARGETS[level] ?? []) {
    for (const [fx, fz, name] of [
      [0, -1, 'N'],
      [1, 0, 'E'],
      [0, 1, 'S'],
      [-1, 0, 'W'],
    ] as const) {
      const x = tx - fx * AHEAD_DISTANCE;
      const z = tz - fz * AHEAD_DISTANCE;
      if (Math.hypot(x, z) > UNIT_BATTLEFIELD_LIMIT) continue;
      const y = Math.max(0, generator.getCrashSurfaceY(x, z) + 150);
      poses.push({
        label: `aimed ${name} at (${tx}, ${tz})`,
        position: new THREE.Vector3(x, y, z),
        quaternion: new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.atan2(-fx, -fz)
        ),
      });
    }
  }
  return poses;
}
