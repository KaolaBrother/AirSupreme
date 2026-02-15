/**
 * 关卡配置
 */
export interface LevelConfig {
  id: number;
  name: string;
  description: string;

  // 地形配置
  terrain: TerrainType;
  groundColor: number;
  waterColor?: number;
  fogColor: number;
  skyColors: [string, string, string, string]; // 渐变色

  // 敌人配置
  totalWaves: number;
  enemiesPerWave: number[];
  enemyTypes: EnemyTypeConfig[];
  waveInterval: number; // 波次间隔（秒）

  // 道具配置
  powerUpFrequency: number; // 道具出现频率（0-1）
  powerUpTypes: string[];

  // 难度
  difficulty: number; // 1-10
}

export enum TerrainType {
  LAKE = 'LAKE',
  DESERT = 'DESERT',
  MOUNTAINS = 'MOUNTAINS',
  OCEAN = 'OCEAN',
  CITY = 'CITY',
}

export interface EnemyTypeConfig {
  type: string;
  minWave: number;
  maxCount: number;
}

/**
 * 所有关卡配置
 */
export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '湖畔晨曦',
    description: '在宁静的湖面上空进行首次战斗',
    terrain: TerrainType.LAKE,
    groundColor: 0x2d5016,
    waterColor: 0x1e90ff,
    fogColor: 0xadd8e6,
    skyColors: ['#1e3c72', '#2a5298', '#87ceeb', '#ffffff'],
    totalWaves: 5,
    enemiesPerWave: [2, 3, 4, 5, 6],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'FIGHTER', minWave: 2, maxCount: 2 },
    ],
    waveInterval: 15,
    powerUpFrequency: 0.3,
    powerUpTypes: ['HEALTH', 'SPEED', 'SHIELD'],
    difficulty: 2,
  },

  {
    id: 2,
    name: '沙漠风暴',
    description: '在炎热的沙漠上空迎战敌人',
    terrain: TerrainType.DESERT,
    groundColor: 0xc2b280,
    fogColor: 0xf4a460,
    skyColors: ['#ff6b35', '#ff8c42', '#ffd166', '#fff8dc'],
    totalWaves: 5,
    enemiesPerWave: [3, 4, 5, 6, 7],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'FIGHTER', minWave: 1, maxCount: 3 },
      { type: 'SNIPER', minWave: 3, maxCount: 1 },
    ],
    waveInterval: 12,
    powerUpFrequency: 0.25,
    powerUpTypes: ['HEALTH', 'DAMAGE', 'SPEED'],
    difficulty: 4,
  },

  {
    id: 3,
    name: '雪山之巅',
    description: '在高耸的雪山上空进行艰苦战斗',
    terrain: TerrainType.MOUNTAINS,
    groundColor: 0xffffff,
    fogColor: 0xdcdcdc,
    skyColors: ['#2c3e50', '#4ca1af', '#c4e0e5', '#ffffff'],
    totalWaves: 6,
    enemiesPerWave: [4, 4, 5, 5, 6, 6],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 3 },
      { type: 'HEAVY', minWave: 2, maxCount: 2 },
      { type: 'SNIPER', minWave: 3, maxCount: 2 },
    ],
    waveInterval: 10,
    powerUpFrequency: 0.35,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED'],
    difficulty: 6,
  },

  {
    id: 4,
    name: '深海决战',
    description: '在广阔的海洋上空进行最终决战',
    terrain: TerrainType.OCEAN,
    groundColor: 0x00008b,
    waterColor: 0x006994,
    fogColor: 0x87ceeb,
    skyColors: ['#0f0c29', '#302b63', '#24243e', '#0f0c29'],
    totalWaves: 6,
    enemiesPerWave: [5, 5, 6, 6, 6, 7],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'HEAVY', minWave: 2, maxCount: 2 },
      { type: 'SNIPER', minWave: 3, maxCount: 2 },
      { type: 'ACE', minWave: 5, maxCount: 1 },
    ],
    waveInterval: 8,
    powerUpFrequency: 0.4,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT'],
    difficulty: 8,
  },

  {
    id: 5,
    name: '城市废墟',
    description: '在废弃的城市上空进行终极挑战',
    terrain: TerrainType.CITY,
    groundColor: 0x3d3d3d,
    fogColor: 0x696969,
    skyColors: ['#1a1a2e', '#16213e', '#0f3460', '#533483'],
    totalWaves: 7,
    enemiesPerWave: [5, 5, 5, 6, 6, 6, 7],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 3 },
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'HEAVY', minWave: 2, maxCount: 3 },
      { type: 'SNIPER', minWave: 3, maxCount: 2 },
      { type: 'ACE', minWave: 6, maxCount: 2 },
    ],
    waveInterval: 6,
    powerUpFrequency: 0.5,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT', 'BOMB'],
    difficulty: 10,
  },
];

/**
 * 获取关卡配置
 */
export function getLevelConfig(levelId: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === levelId);
}
