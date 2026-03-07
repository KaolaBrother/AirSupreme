export interface LevelEnvironmentConfig {
  backgroundGradient: [string, string, string, string];
  fogColor: number;
  fogNear: number;
  fogFar: number;
  fogDensity?: number;
  cloudCover?: number;
  cloudTint?: number;
  cloudSpeed?: number;
  cloudHeightMin?: number;
  cloudHeightMax?: number;
  weatherIntensity?: number;
  particleCount?: number;
  particleSize?: number;
  particleSpeed?: number;
  particleDrift?: number;
  particleColor?: number;
  waterWaveScale?: number;
  skyGlow?: number;
  surfaceProfile?: LevelSurfaceProfile;
}

export interface LevelSurfaceProfile {
  groundBaseColor?: number;
  groundAccentColor?: number;
  groundDetailColor?: number;
  groundEmissiveColor?: number;
  waterBaseColor?: number;
  waterAccentColor?: number;
  waterDetailColor?: number;
  shorelineBaseColor?: number;
  shorelineAccentColor?: number;
  shorelineDetailColor?: number;
  roadBaseColor?: number;
  roadAccentColor?: number;
  roadDetailColor?: number;
  roadLineColor?: number;
  plazaBaseColor?: number;
  plazaAccentColor?: number;
  plazaDetailColor?: number;
  buildingBaseColor?: number;
  buildingTrimColor?: number;
  windowColor?: number;
}

export interface LevelLightingConfig {
  ambientColor: number;
  ambientIntensity: number;
  hemisphereSkyColor: number;
  hemisphereGroundColor: number;
  hemisphereIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: { x: number; y: number; z: number };
  shadowEnabled: boolean;
  shadowMapSize: number;
  shadowCameraNear: number;
  shadowCameraFar: number;
  shadowBias?: number;
  shadowNormalBias?: number;
}

export interface LevelWeatherConfig {
  preset: 'clear' | 'mist' | 'windy' | 'sandstorm' | 'snow' | 'storm' | 'smog';
  windStrength: number;
  cloudCoverage: number;
  precipitation: number;
  turbulence: number;
  cloudOpacity?: number;
  cloudTint?: number;
  cloudSpeed?: number;
  cloudHeightMin?: number;
  cloudHeightMax?: number;
  intensity?: number;
  fogDensity?: number;
  particleCount?: number;
  particleSize?: number;
  particleSpeed?: number;
  particleDrift?: number;
  particleColor?: number;
  waterWaveScale?: number;
  skyGlow?: number;
}

export interface LevelPostFxConfig {
  exposure: number;
  contrast: number;
  saturation: number;
  bloomStrength: number;
  vignetteStrength: number;
}

export interface LevelSceneConfig {
  environment: LevelEnvironmentConfig;
  lighting: LevelLightingConfig;
  weather: LevelWeatherConfig;
  postFx: LevelPostFxConfig;
}

export const DEFAULT_LEVEL_SCENE_CONFIG: LevelSceneConfig = {
  environment: {
    backgroundGradient: ['#1e3c72', '#2a5298', '#87ceeb', '#ffffff'],
    fogColor: 0x87ceeb,
    fogNear: 150,
    fogFar: 1800,
  },
  lighting: {
    ambientColor: 0xffffff,
    ambientIntensity: 0.6,
    hemisphereSkyColor: 0x87ceeb,
    hemisphereGroundColor: 0x3d5c5c,
    hemisphereIntensity: 0.4,
    sunColor: 0xffffff,
    sunIntensity: 1,
    sunPosition: { x: 100, y: 100, z: 50 },
    shadowEnabled: true,
    shadowMapSize: 2048,
    shadowCameraNear: 0.5,
    shadowCameraFar: 500,
    shadowBias: -0.0001,
    shadowNormalBias: 0.02,
  },
  weather: {
    preset: 'clear',
    windStrength: 0.2,
    cloudCoverage: 0.3,
    precipitation: 0,
    turbulence: 0.1,
  },
  postFx: {
    exposure: 1,
    contrast: 1,
    saturation: 1,
    bloomStrength: 0,
    vignetteStrength: 0,
  },
};

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
  environment: LevelEnvironmentConfig;
  lighting: LevelLightingConfig;
  weather: LevelWeatherConfig;
  postFx: LevelPostFxConfig;

  // 敌人配置
  totalWaves: number;
  enemiesPerWave: number[];
  enemyTypes: EnemyTypeConfig[];
  waveInterval: number; // 波次间隔（秒）
  eventTemplates?: LevelWaveEventType[];

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

export enum LevelWaveEventType {
  ELITE_HUNT = 'ELITE_HUNT',
  INTERCEPT = 'INTERCEPT',
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
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#203a72', '#4f7fb8', '#d5ecff', '#fff8ef'],
      fogColor: 0xc7e2f3,
      fogNear: 220,
      fogFar: 2200,
      fogDensity: 0.00052,
      cloudCover: 0.34,
      cloudTint: 0xf7fbff,
      cloudSpeed: 2.1,
      cloudHeightMin: 120,
      cloudHeightMax: 300,
      weatherIntensity: 0.18,
      particleCount: 48,
      particleSize: 5.2,
      particleSpeed: 4.2,
      particleDrift: 1.1,
      particleColor: 0xe6f6ff,
      waterWaveScale: 0.45,
      skyGlow: 0xffe5a8,
      surfaceProfile: {
        groundBaseColor: 0x79b64d,
        groundAccentColor: 0x9ddf70,
        groundDetailColor: 0x5c9a38,
        groundEmissiveColor: 0x355d1c,
        waterBaseColor: 0x4ba7d8,
        waterAccentColor: 0x8fe5ff,
        waterDetailColor: 0x2c6e8d,
        shorelineBaseColor: 0xe7d3a4,
        shorelineAccentColor: 0xf6e6b7,
        shorelineDetailColor: 0xc8b387,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xf4f8ff,
      ambientIntensity: 0.82,
      hemisphereSkyColor: 0xb8dfff,
      hemisphereGroundColor: 0x5d7a42,
      hemisphereIntensity: 0.58,
      sunColor: 0xffefc4,
      sunIntensity: 1.12,
      sunPosition: { x: 140, y: 160, z: 60 },
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'mist',
      windStrength: 0.18,
      cloudCoverage: 0.36,
      precipitation: 0.04,
      turbulence: 0.12,
      cloudOpacity: 0.58,
      cloudTint: 0xf8fbff,
      cloudSpeed: 2.1,
      cloudHeightMin: 120,
      cloudHeightMax: 300,
      intensity: 0.18,
      fogDensity: 0.00052,
      particleCount: 48,
      particleSize: 5.2,
      particleSpeed: 4.2,
      particleDrift: 1.1,
      particleColor: 0xe6f6ff,
      waterWaveScale: 0.45,
      skyGlow: 0xffe5a8,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.02,
      saturation: 1.05,
    },
    totalWaves: 5,
    enemiesPerWave: [2, 3, 4, 5, 6],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'FIGHTER', minWave: 2, maxCount: 2 },
    ],
    waveInterval: 15,
    eventTemplates: [LevelWaveEventType.INTERCEPT],
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
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#7f2f16', '#cf6636', '#f3b060', '#efd8a5'],
      fogColor: 0xc78a44,
      fogNear: 90,
      fogFar: 1050,
      fogDensity: 0.00145,
      cloudCover: 0.12,
      cloudTint: 0xd9b37a,
      cloudSpeed: 5.8,
      cloudHeightMin: 90,
      cloudHeightMax: 170,
      weatherIntensity: 0.78,
      particleCount: 280,
      particleSize: 7.2,
      particleSpeed: 18,
      particleDrift: 12,
      particleColor: 0xd0a76f,
      waterWaveScale: 0.4,
      skyGlow: 0xffb66a,
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xfff0d6,
      ambientIntensity: 0.58,
      hemisphereSkyColor: 0xffd28a,
      hemisphereGroundColor: 0x8f6b32,
      hemisphereIntensity: 0.35,
      sunColor: 0xffe1b0,
      sunIntensity: 1.25,
      sunPosition: { x: 180, y: 120, z: 40 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'sandstorm',
      windStrength: 0.86,
      cloudCoverage: 0.12,
      precipitation: 0,
      turbulence: 0.72,
      cloudOpacity: 0.38,
      cloudTint: 0xd8b07b,
      cloudSpeed: 5.8,
      cloudHeightMin: 90,
      cloudHeightMax: 170,
      intensity: 0.78,
      fogDensity: 0.00145,
      particleCount: 280,
      particleSize: 7.2,
      particleSpeed: 18,
      particleDrift: 12,
      particleColor: 0xd0a76f,
      waterWaveScale: 0.4,
      skyGlow: 0xffb66a,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.08,
      contrast: 1.08,
      saturation: 1.1,
    },
    totalWaves: 5,
    enemiesPerWave: [3, 4, 5, 6, 7],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'FIGHTER', minWave: 1, maxCount: 3 },
      { type: 'SNIPER', minWave: 3, maxCount: 1 },
    ],
    waveInterval: 12,
    eventTemplates: [LevelWaveEventType.INTERCEPT, LevelWaveEventType.ELITE_HUNT],
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
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#15263f', '#406786', '#9fc3d9', '#f6fbff'],
      fogColor: 0xd7e6f2,
      fogNear: 120,
      fogFar: 1450,
      fogDensity: 0.00108,
      cloudCover: 0.68,
      cloudTint: 0xf2f8ff,
      cloudSpeed: 1.8,
      cloudHeightMin: 95,
      cloudHeightMax: 210,
      weatherIntensity: 0.52,
      particleCount: 260,
      particleSize: 3.1,
      particleSpeed: 9.5,
      particleDrift: 2.4,
      particleColor: 0xf5fbff,
      waterWaveScale: 0.7,
      skyGlow: 0xd7ecff,
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xeaf4ff,
      ambientIntensity: 0.72,
      hemisphereSkyColor: 0xbad8ff,
      hemisphereGroundColor: 0x8aa0b8,
      hemisphereIntensity: 0.5,
      sunColor: 0xf5fbff,
      sunIntensity: 0.92,
      sunPosition: { x: 110, y: 180, z: 70 },
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'snow',
      windStrength: 0.44,
      cloudCoverage: 0.68,
      precipitation: 0.48,
      turbulence: 0.34,
      cloudOpacity: 0.8,
      cloudTint: 0xf2f8ff,
      cloudSpeed: 1.8,
      cloudHeightMin: 95,
      cloudHeightMax: 210,
      intensity: 0.52,
      fogDensity: 0.00108,
      particleCount: 260,
      particleSize: 3.1,
      particleSpeed: 9.5,
      particleDrift: 2.4,
      particleColor: 0xf5fbff,
      waterWaveScale: 0.7,
      skyGlow: 0xd7ecff,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 0.98,
      contrast: 1.04,
      saturation: 0.94,
    },
    totalWaves: 6,
    enemiesPerWave: [4, 4, 5, 5, 6, 6],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 3 },
      { type: 'HEAVY', minWave: 2, maxCount: 2 },
      { type: 'SNIPER', minWave: 3, maxCount: 2 },
    ],
    waveInterval: 10,
    eventTemplates: [LevelWaveEventType.ELITE_HUNT, LevelWaveEventType.INTERCEPT],
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
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#07101d', '#143153', '#1d5775', '#8aa8bf'],
      fogColor: 0x86a8c5,
      fogNear: 120,
      fogFar: 1650,
      fogDensity: 0.00092,
      cloudCover: 0.8,
      cloudTint: 0xd1dceb,
      cloudSpeed: 5.9,
      cloudHeightMin: 85,
      cloudHeightMax: 180,
      weatherIntensity: 0.74,
      particleCount: 220,
      particleSize: 6.8,
      particleSpeed: 10.6,
      particleDrift: 6.4,
      particleColor: 0xd5e2eb,
      waterWaveScale: 4,
      skyGlow: 0x82b1e1,
      surfaceProfile: {
        waterBaseColor: 0x2d5e8a,
        waterAccentColor: 0x74b9ea,
        waterDetailColor: 0x133a5b,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xcce2ff,
      ambientIntensity: 0.62,
      hemisphereSkyColor: 0x77a4cc,
      hemisphereGroundColor: 0x1c4362,
      hemisphereIntensity: 0.5,
      sunColor: 0xd9ecff,
      sunIntensity: 0.96,
      sunPosition: { x: 90, y: 140, z: 80 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'storm',
      windStrength: 0.88,
      cloudCoverage: 0.88,
      precipitation: 0.62,
      turbulence: 0.68,
      cloudOpacity: 0.86,
      cloudTint: 0xc7d5e2,
      cloudSpeed: 6.4,
      cloudHeightMin: 85,
      cloudHeightMax: 180,
      intensity: 0.82,
      fogDensity: 0.00102,
      particleCount: 240,
      particleSize: 6.8,
      particleSpeed: 11.5,
      particleDrift: 7.2,
      particleColor: 0xc5d4de,
      waterWaveScale: 4.3,
      skyGlow: 0x6e9ed1,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 0.98,
      contrast: 1.08,
      saturation: 0.94,
    },
    totalWaves: 6,
    enemiesPerWave: [5, 5, 6, 6, 6, 7],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'HEAVY', minWave: 2, maxCount: 2 },
      { type: 'SNIPER', minWave: 3, maxCount: 2 },
      { type: 'ACE', minWave: 5, maxCount: 1 },
    ],
    waveInterval: 8,
    eventTemplates: [LevelWaveEventType.INTERCEPT, LevelWaveEventType.ELITE_HUNT],
    powerUpFrequency: 0.4,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT'],
    difficulty: 8,
  },

  {
    id: 5,
    name: '城市废墟',
    description: '在废弃的城市上空进行终极挑战',
    terrain: TerrainType.CITY,
    groundColor: 0x626d7d,
    fogColor: 0x8893a6,
    skyColors: ['#24314a', '#3b5377', '#6887b0', '#a8bdd3'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#1d2639', '#334a69', '#6f8eb7', '#d2deef'],
      fogColor: 0x97a2b4,
      fogNear: 165,
      fogFar: 1520,
      fogDensity: 0.00074,
      cloudCover: 0.6,
      cloudTint: 0xd1d8e3,
      cloudSpeed: 1.9,
      cloudHeightMin: 70,
      cloudHeightMax: 150,
      weatherIntensity: 0.26,
      particleCount: 84,
      particleSize: 4,
      particleSpeed: 3.9,
      particleDrift: 1.2,
      particleColor: 0xc3ccd8,
      waterWaveScale: 0.35,
      skyGlow: 0xc8d6ee,
      surfaceProfile: {
        groundBaseColor: 0x798596,
        groundAccentColor: 0xa2adbc,
        groundDetailColor: 0x555e6c,
        groundEmissiveColor: 0x2a3340,
        roadBaseColor: 0x586375,
        roadAccentColor: 0x8f9daf,
        roadDetailColor: 0x3c4453,
        roadLineColor: 0xf3f6ff,
        plazaBaseColor: 0x8d98a7,
        plazaAccentColor: 0xb3bcc9,
        plazaDetailColor: 0x69717f,
        buildingBaseColor: 0x7c90a6,
        buildingTrimColor: 0xdbe5ef,
        windowColor: 0xffe5ad,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xf1f4ff,
      ambientIntensity: 0.78,
      hemisphereSkyColor: 0x91aad1,
      hemisphereGroundColor: 0x666c75,
      hemisphereIntensity: 0.56,
      sunColor: 0xe6eeff,
      sunIntensity: 1.12,
      sunPosition: { x: 95, y: 135, z: 55 },
      shadowMapSize: 1024,
      shadowCameraFar: 420,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'smog',
      windStrength: 0.18,
      cloudCoverage: 0.6,
      precipitation: 0.06,
      turbulence: 0.24,
      cloudOpacity: 0.58,
      cloudTint: 0xd1d8e3,
      cloudSpeed: 2.05,
      cloudHeightMin: 70,
      cloudHeightMax: 150,
      intensity: 0.28,
      fogDensity: 0.0008,
      particleCount: 96,
      particleSize: 4,
      particleSpeed: 4.1,
      particleDrift: 1.2,
      particleColor: 0xc3ccd8,
      waterWaveScale: 0.35,
      skyGlow: 0xc8d6ee,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.14,
      contrast: 1.08,
      saturation: 1.03,
      vignetteStrength: 0.18,
    },
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
    eventTemplates: [LevelWaveEventType.ELITE_HUNT, LevelWaveEventType.INTERCEPT],
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
