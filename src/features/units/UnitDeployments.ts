import { UnitType } from './UnitTypes';

/**
 * 每关每波的地面 / 海上 / 空中单位部署表。
 *
 * 与喷气式敌机波次（LevelConfig.enemiesPerWave）并行：同一波次里两者都清空才算过波。
 * 编排原则：
 * - 贴合章节剧情与地形（湖区车队、沙海导弹车、雪山雷达、海峡舰队、城区防空……）；
 * - 与无线电台词对齐（例如第 1 关第 2 波“低空直升机”、第 4 关第 4 波“水下潜艇”）；
 * - 关内逐波加码、关间整体加码；首次出现的单位类型数量克制，便于玩家熟悉。
 * - 无水域地形（沙漠 / 雪山 / 城市 / 峡谷 / 平流层 / 城堡）不部署海上单位。
 */

/**
 * 放置方式：
 * - ahead：玩家前方集群
 * - flank：玩家侧翼集群
 * - around：环绕玩家分散
 * - water：水域（舰船 / 潜艇）
 * - route：沿穿越战场的航线 / 公路行进（护送目标、平民、车队纵列）
 * - high-altitude：高空（轰炸机、预警机）
 */
export type UnitPlacement = 'ahead' | 'flank' | 'around' | 'water' | 'route' | 'high-altitude';

export interface UnitSpawnSpec {
  type: UnitType;
  count: number;
  placement: UnitPlacement;
}

type WaveTable = readonly (readonly UnitSpawnSpec[])[];

function s(type: UnitType, count: number, placement: UnitPlacement): UnitSpawnSpec {
  return { type, count, placement };
}

const T = UnitType;

/**
 * 第 1 关 · 湖畔晨曦（LAKE，5 波）：湖面渔船、公路车队、低空直升机与无人机编队。
 * 教学关：每波只引入一种新的地面威胁，坦克每波至多 1 辆；高炮与地空导弹从第 2 关开始。
 */
const LEVEL_1: WaveTable = [
  [s(T.TANK, 1, 'ahead'), s(T.CIVILIAN_SHIP, 1, 'water'), s(T.CIVILIAN_TRUCK, 2, 'route')],
  [s(T.ATTACK_HELICOPTER, 1, 'flank'), s(T.CIVILIAN_TRUCK, 1, 'route')],
  [s(T.DRONE, 2, 'ahead'), s(T.TANK, 1, 'flank'), s(T.CIVILIAN_TRUCK, 2, 'route')],
  [s(T.ALLY_CONVOY, 3, 'route'), s(T.TANK, 1, 'flank'), s(T.ATTACK_HELICOPTER, 1, 'flank')],
  [s(T.DRONE, 2, 'ahead'), s(T.TANK, 1, 'ahead'), s(T.CIVILIAN_SHIP, 1, 'water')],
];

/** 第 2 关 · 沙漠风暴（DESERT，5 波）：坦克纵队、地空导弹车、友军车队穿越走廊 */
const LEVEL_2: WaveTable = [
  [s(T.TANK, 1, 'ahead'), s(T.CIVILIAN_TRUCK, 1, 'route')],
  [s(T.SAM_LAUNCHER, 1, 'ahead')],
  [s(T.AA_GUN, 1, 'ahead'), s(T.TANK, 1, 'around'), s(T.SAM_LAUNCHER, 1, 'flank')],
  [s(T.ALLY_CONVOY, 3, 'route'), s(T.TANK, 1, 'flank'), s(T.ATTACK_HELICOPTER, 1, 'flank')],
  [
    s(T.SAM_LAUNCHER, 2, 'around'),
    s(T.TANK, 1, 'ahead'),
    s(T.AA_GUN, 1, 'ahead'),
    s(T.RADAR_STATION, 1, 'flank'),
  ],
];

/** 第 3 关 · 雪山之巅（MOUNTAINS，6 波）：雷达站报点、高炮阵地、护送撤离机 */
const LEVEL_3: WaveTable = [
  [s(T.RADAR_STATION, 1, 'ahead'), s(T.AA_GUN, 1, 'ahead')],
  [s(T.ATTACK_HELICOPTER, 2, 'flank'), s(T.AA_GUN, 1, 'around')],
  [s(T.ALLY_TRANSPORT, 1, 'route'), s(T.ATTACK_HELICOPTER, 1, 'flank'), s(T.DRONE, 3, 'ahead')],
  [s(T.SAM_LAUNCHER, 1, 'ahead'), s(T.AA_GUN, 1, 'flank')],
  [s(T.ATTACK_HELICOPTER, 2, 'around'), s(T.TANK, 1, 'ahead'), s(T.AA_GUN, 1, 'flank')],
  [
    s(T.SAM_LAUNCHER, 2, 'around'),
    s(T.AA_GUN, 1, 'ahead'),
    s(T.ATTACK_HELICOPTER, 1, 'flank'),
    s(T.RADAR_STATION, 1, 'flank'),
  ],
];

/** 第 4 关 · 深海决战（OCEAN，6 波）：炮艇、护卫舰、潜艇；保护商船与友军护卫舰 */
const LEVEL_4: WaveTable = [
  [s(T.ALLY_FRIGATE, 1, 'water'), s(T.CIVILIAN_SHIP, 1, 'route'), s(T.GUNBOAT, 2, 'water')],
  [s(T.GUNBOAT, 2, 'water'), s(T.CIVILIAN_SHIP, 1, 'route')],
  [s(T.FRIGATE, 1, 'water'), s(T.GUNBOAT, 1, 'water')],
  [s(T.SUBMARINE, 1, 'water'), s(T.GUNBOAT, 1, 'water'), s(T.CIVILIAN_SHIP, 1, 'route')],
  [s(T.FRIGATE, 1, 'water'), s(T.SUBMARINE, 1, 'water'), s(T.ATTACK_HELICOPTER, 1, 'flank')],
  [s(T.FRIGATE, 1, 'water'), s(T.GUNBOAT, 2, 'water'), s(T.CIVILIAN_SHIP, 1, 'route')],
];

/** 第 5 关 · 城市废墟（CITY，7 波）：预警机「天眼」、楼顶高炮、平民车流与客机 */
const LEVEL_5: WaveTable = [
  [
    s(T.ALLY_AWACS, 1, 'high-altitude'),
    s(T.ATTACK_HELICOPTER, 2, 'flank'),
    s(T.CIVILIAN_TRUCK, 2, 'route'),
  ],
  [s(T.AA_GUN, 1, 'ahead'), s(T.ATTACK_HELICOPTER, 1, 'flank'), s(T.CIVILIAN_AIRLINER, 1, 'route')],
  [s(T.AA_GUN, 2, 'around'), s(T.SAM_LAUNCHER, 1, 'flank'), s(T.CIVILIAN_TRUCK, 1, 'route')],
  [s(T.ATTACK_HELICOPTER, 2, 'around'), s(T.DRONE, 3, 'ahead')],
  [s(T.BOMBER, 2, 'high-altitude'), s(T.DRONE, 2, 'flank'), s(T.CIVILIAN_AIRLINER, 1, 'route')],
  [
    s(T.SAM_LAUNCHER, 2, 'around'),
    s(T.ATTACK_HELICOPTER, 1, 'flank'),
    s(T.RADAR_STATION, 1, 'ahead'),
    s(T.CIVILIAN_TRUCK, 1, 'route'),
  ],
  [
    s(T.AA_GUN, 2, 'around'),
    s(T.SAM_LAUNCHER, 1, 'ahead'),
    s(T.ATTACK_HELICOPTER, 1, 'flank'),
    s(T.DRONE, 3, 'ahead'),
  ],
];

/** 第 6 关 · 熔炉之心（VOLCANO，7 波）：火山岛装甲与防空、环岛炮艇、无人机蜂群与轰炸机 */
const LEVEL_6: WaveTable = [
  [s(T.TANK, 1, 'ahead'), s(T.AA_GUN, 2, 'ahead')],
  [s(T.SAM_LAUNCHER, 1, 'around'), s(T.GUNBOAT, 2, 'water'), s(T.ALLY_FRIGATE, 1, 'water')],
  [s(T.DRONE, 5, 'ahead'), s(T.AA_GUN, 1, 'flank')],
  [s(T.TANK, 1, 'flank'), s(T.RADAR_STATION, 1, 'ahead'), s(T.GUNBOAT, 2, 'water')],
  [
    s(T.BOMBER, 2, 'high-altitude'),
    s(T.SAM_LAUNCHER, 1, 'ahead'),
    s(T.ATTACK_HELICOPTER, 1, 'flank'),
  ],
  [
    s(T.TANK, 1, 'around'),
    s(T.SAM_LAUNCHER, 2, 'flank'),
    s(T.GUNBOAT, 1, 'water'),
    s(T.DRONE, 3, 'ahead'),
  ],
  [
    s(T.AA_GUN, 2, 'around'),
    s(T.SAM_LAUNCHER, 1, 'ahead'),
    s(T.TANK, 1, 'ahead'),
    s(T.FRIGATE, 1, 'water'),
    s(T.DRONE, 4, 'flank'),
  ],
];

/** 第 7 关 · 极光冰海（ARCTIC，7 波）：潜艇与护卫舰、冰架雷达；保护友军护卫舰「北辰」 */
const LEVEL_7: WaveTable = [
  [s(T.ALLY_FRIGATE, 1, 'water'), s(T.SUBMARINE, 1, 'water'), s(T.CIVILIAN_SHIP, 1, 'route')],
  [s(T.RADAR_STATION, 1, 'ahead'), s(T.GUNBOAT, 2, 'water'), s(T.AA_GUN, 1, 'ahead')],
  [s(T.FRIGATE, 2, 'water')],
  [s(T.SUBMARINE, 1, 'water'), s(T.AA_GUN, 1, 'ahead'), s(T.GUNBOAT, 2, 'water')],
  [s(T.BOMBER, 2, 'high-altitude'), s(T.GUNBOAT, 1, 'water'), s(T.DRONE, 3, 'ahead')],
  [s(T.FRIGATE, 1, 'water'), s(T.SUBMARINE, 1, 'water'), s(T.CIVILIAN_SHIP, 1, 'route')],
  [
    s(T.FRIGATE, 1, 'water'),
    s(T.SUBMARINE, 1, 'water'),
    s(T.GUNBOAT, 2, 'water'),
    s(T.SAM_LAUNCHER, 1, 'ahead'),
  ],
];

/** 第 8 关 · 雷霆峡谷（CANYON，7 波）：护送车队「长弓」穿越峡谷，崖壁直升机与高处导弹车 */
const LEVEL_8: WaveTable = [
  [s(T.ALLY_CONVOY, 3, 'route'), s(T.TANK, 1, 'ahead'), s(T.AA_GUN, 1, 'flank')],
  [s(T.ATTACK_HELICOPTER, 3, 'flank'), s(T.AA_GUN, 1, 'ahead')],
  [s(T.SAM_LAUNCHER, 1, 'ahead'), s(T.AA_GUN, 1, 'around'), s(T.ATTACK_HELICOPTER, 2, 'flank')],
  [s(T.ALLY_TRANSPORT, 1, 'route'), s(T.DRONE, 4, 'ahead'), s(T.ATTACK_HELICOPTER, 1, 'flank')],
  [s(T.SAM_LAUNCHER, 2, 'around'), s(T.TANK, 1, 'ahead'), s(T.RADAR_STATION, 1, 'flank')],
  [
    s(T.ALLY_CONVOY, 3, 'route'),
    s(T.BOMBER, 2, 'high-altitude'),
    s(T.ATTACK_HELICOPTER, 2, 'flank'),
  ],
  [
    s(T.SAM_LAUNCHER, 2, 'around'),
    s(T.AA_GUN, 1, 'ahead'),
    s(T.ATTACK_HELICOPTER, 2, 'flank'),
    s(T.RADAR_STATION, 1, 'ahead'),
  ],
];

/** 第 9 关 · 天梯之巅（STRATOSPHERE，7 波）：纯空战——轰炸机、无人机蜂群；保护预警机，避开客机 */
const LEVEL_9: WaveTable = [
  [s(T.ALLY_AWACS, 1, 'high-altitude'), s(T.DRONE, 3, 'ahead'), s(T.CIVILIAN_AIRLINER, 1, 'route')],
  [s(T.BOMBER, 1, 'high-altitude'), s(T.DRONE, 3, 'around')],
  [s(T.DRONE, 5, 'ahead'), s(T.CIVILIAN_AIRLINER, 1, 'route')],
  [s(T.BOMBER, 1, 'high-altitude'), s(T.DRONE, 4, 'flank')],
  [s(T.BOMBER, 2, 'high-altitude'), s(T.DRONE, 3, 'around'), s(T.CIVILIAN_AIRLINER, 1, 'route')],
  [s(T.BOMBER, 1, 'high-altitude'), s(T.DRONE, 4, 'ahead')],
  [s(T.BOMBER, 2, 'high-altitude'), s(T.DRONE, 5, 'around'), s(T.CIVILIAN_AIRLINER, 1, 'route')],
];

/** 第 10 关 · 神谕核心（CITADEL，8 波）：全兵种重防线；全体友军集结 */
const LEVEL_10: WaveTable = [
  [
    s(T.ALLY_AWACS, 1, 'high-altitude'),
    s(T.ALLY_CONVOY, 3, 'route'),
    s(T.TANK, 1, 'ahead'),
    s(T.AA_GUN, 2, 'ahead'),
  ],
  [s(T.SAM_LAUNCHER, 2, 'around'), s(T.ATTACK_HELICOPTER, 2, 'flank')],
  [s(T.DRONE, 5, 'ahead'), s(T.TANK, 1, 'flank'), s(T.AA_GUN, 1, 'around')],
  [s(T.SAM_LAUNCHER, 2, 'around'), s(T.AA_GUN, 1, 'ahead'), s(T.RADAR_STATION, 1, 'flank')],
  [
    s(T.ALLY_TRANSPORT, 1, 'route'),
    s(T.BOMBER, 2, 'high-altitude'),
    s(T.ATTACK_HELICOPTER, 2, 'flank'),
    s(T.DRONE, 3, 'ahead'),
  ],
  [s(T.TANK, 1, 'around'), s(T.SAM_LAUNCHER, 2, 'flank'), s(T.DRONE, 3, 'ahead')],
  [s(T.BOMBER, 2, 'high-altitude'), s(T.ATTACK_HELICOPTER, 3, 'around'), s(T.DRONE, 5, 'ahead')],
  [
    s(T.SAM_LAUNCHER, 2, 'around'),
    s(T.AA_GUN, 1, 'flank'),
    s(T.RADAR_STATION, 1, 'ahead'),
    s(T.ATTACK_HELICOPTER, 2, 'flank'),
    s(T.DRONE, 3, 'around'),
  ],
];

const DEPLOYMENTS: readonly WaveTable[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
  LEVEL_8,
  LEVEL_9,
  LEVEL_10,
];

/** 部署表覆盖的关卡数（1..10） */
export const UNIT_DEPLOYMENT_LEVELS = DEPLOYMENTS.length;

/** 某关部署表的波次数（非法关卡返回 0）；与 LevelConfig.totalWaves 一致 */
export function getDeploymentWaveCount(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > DEPLOYMENTS.length) {
    return 0;
  }
  return DEPLOYMENTS[level - 1].length;
}

/**
 * 取某关某波（waveIndex 从 0 开始）的单位部署。
 * 非法输入（非整数、越界）返回 []；返回值为新数组 / 新对象，调用方可随意修改。
 */
export function getWaveDeployment(level: number, waveIndex: number): UnitSpawnSpec[] {
  if (!Number.isInteger(level) || !Number.isInteger(waveIndex)) {
    return [];
  }
  if (level < 1 || level > DEPLOYMENTS.length) {
    return [];
  }
  const waves = DEPLOYMENTS[level - 1];
  if (waveIndex < 0 || waveIndex >= waves.length) {
    return [];
  }
  return waves[waveIndex].map((spec) => ({ ...spec }));
}
