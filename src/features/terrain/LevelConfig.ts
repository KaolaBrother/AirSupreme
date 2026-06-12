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
  designTokens?: SceneDesignTokens;
}

/**
 * 场景设计令牌：每关一套结构化调色板，TerrainGenerator 中的新增场景元素统一从这里取色，
 * 保证同一关卡内地形、植被、水体、建筑与辉光色彩协调。所有值为 THREE 颜色十六进制数。
 */
export interface SceneDesignTokens {
  /** 地表主色 */
  terrainPrimary: number;
  /** 地表暗部/细节色 */
  terrainSecondary: number;
  /** 地表高光/点缀色 */
  terrainAccent: number;
  /** 植被主色 */
  vegetation: number;
  /** 植被亮部点缀色 */
  vegetationAccent: number;
  /** 水面基色 */
  water: number;
  /** 深水色 */
  waterDeep: number;
  /** 水面闪光/泛光色 */
  waterSparkle: number;
  /** 建筑/构筑物主色 */
  structure: number;
  /** 建筑点缀色（屋顶、饰带等） */
  structureAccent: number;
  /** 暖光/灯光辉光色 */
  glow: number;
  /** 地平线雾霭色（远景大气透视目标色） */
  horizonHaze: number;
  /** 远景剪影色（最远山体/建筑轮廓） */
  distantSilhouette: number;
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
  preset: 'clear' | 'cloudy' | 'mist' | 'windy' | 'sandstorm' | 'snow' | 'storm' | 'smog';
  windStrength: number;
  cloudCoverage: number;
  precipitation: number;
  turbulence: number;
  /** 风向（弧度，0 = +X，π/2 = +Z），云层沿该方向漂移；未配置时按天气预设推导 */
  windAngle?: number;
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
  ESCORT_DEFENSE = 'ESCORT_DEFENSE',
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
    groundColor: 0x5a9150,
    waterColor: 0x39a08c,
    fogColor: 0xd9e0cb,
    skyColors: ['#27598f', '#3173b6', '#9cc3d5', '#e3e3c8'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      // worldshowcase 晴日预设：zenith 0x3173b6 → horizon 0xe3e3c8，雾 0xd9e0cb
      backgroundGradient: ['#27598f', '#3173b6', '#9cc3d5', '#e3e3c8'],
      fogColor: 0xd9e0cb,
      fogNear: 360,
      fogFar: 4320,
      fogDensity: 0.0002,
      cloudCover: 0.3,
      cloudTint: 0xffffff,
      cloudSpeed: 2.1,
      cloudHeightMin: 200,
      cloudHeightMax: 420,
      weatherIntensity: 0.12,
      particleCount: 36,
      particleSize: 4,
      particleSpeed: 3,
      particleDrift: 1,
      particleColor: 0xfff7e0,
      waterWaveScale: 1,
      skyGlow: 0xffecb8,
      surfaceProfile: {
        groundBaseColor: 0x5a9150,
        groundAccentColor: 0x9aa860,
        groundDetailColor: 0x53824a,
        groundEmissiveColor: 0x3c5a36,
        waterBaseColor: 0x39a08c,
        waterAccentColor: 0xbcd6da,
        waterDetailColor: 0x16555e,
        shorelineBaseColor: 0xdcc99a,
        shorelineAccentColor: 0xe8d9ad,
        shorelineDetailColor: 0xcdb482,
      },
      // worldshowcase 山谷调色板：草甸绿、湖水蓝绿与暖沙
      designTokens: {
        terrainPrimary: 0x5a9150,
        terrainSecondary: 0x53824a,
        terrainAccent: 0x9aa860,
        vegetation: 0x3e7a3c,
        vegetationAccent: 0x77b95e,
        water: 0x39a08c,
        waterDeep: 0x16555e,
        waterSparkle: 0xbcd6da,
        structure: 0x9c6b4a,
        structureAccent: 0xf3e6c8,
        glow: 0xffe9b0,
        horizonHaze: 0xd9e0cb,
        distantSilhouette: 0x7da3c0,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // worldshowcase 晴日光照：暖阳 0xffeed2 ×2.7 + 半球 0xbdd6e4/0x5d6b4a + 环境补光 0xa8b8b4
      ambientColor: 0xa8b8b4,
      ambientIntensity: 0.42,
      hemisphereSkyColor: 0xbdd6e4,
      hemisphereGroundColor: 0x5d6b4a,
      hemisphereIntensity: 0.62,
      sunColor: 0xffeed2,
      sunIntensity: 2.7,
      sunPosition: { x: -210, y: 260, z: -118 },
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'clear',
      windStrength: 0.3,
      cloudCoverage: 0.3,
      precipitation: 0,
      turbulence: 0.08,
      windAngle: 0.35,
      cloudOpacity: 0.92,
      cloudTint: 0xffffff,
      cloudSpeed: 2.1,
      cloudHeightMin: 200,
      cloudHeightMax: 420,
      intensity: 0.12,
      fogDensity: 0.0002,
      particleCount: 36,
      particleSize: 4,
      particleSpeed: 3,
      particleDrift: 1,
      particleColor: 0xfff7e0,
      waterWaveScale: 1,
      skyGlow: 0xffecb8,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.1,
      contrast: 1.02,
      saturation: 1.06,
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
    groundColor: 0xc8b487,
    fogColor: 0xf4a460,
    skyColors: ['#6d2a03', '#af5e20', '#f6b05b', '#fcf2d3'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#6c2508', '#bf5a2a', '#f0a95a', '#f6ebc7'],
      fogColor: 0xd09c67,
      fogNear: 180,
      fogFar: 2214,
      fogDensity: 0.00095,
      cloudCover: 0.12,
      cloudTint: 0xd9b37a,
      cloudSpeed: 6.4,
      cloudHeightMin: 90,
      cloudHeightMax: 170,
      weatherIntensity: 0.84,
      particleCount: 430,
      particleSize: 8,
      particleSpeed: 20,
      particleDrift: 15,
      particleColor: 0xd0a76f,
      waterWaveScale: 0.4,
      skyGlow: 0xffb66a,
      surfaceProfile: {
        groundBaseColor: 0xc8b487,
        groundAccentColor: 0xffe4b2,
        groundDetailColor: 0x9d7e4e,
        groundEmissiveColor: 0x63492e,
      },
      // 炽热沙漠：赭石、陶土与暖沙色
      designTokens: {
        terrainPrimary: 0xd9b178,
        terrainSecondary: 0xa6752d,
        terrainAccent: 0xf2cf94,
        vegetation: 0x6f8f3f,
        vegetationAccent: 0x9ab85a,
        water: 0x3f9e9b,
        waterDeep: 0x216b6b,
        waterSparkle: 0xaef0e4,
        structure: 0xa05f38,
        structureAccent: 0xe0b27c,
        glow: 0xffc06a,
        horizonHaze: 0xe8c193,
        distantSilhouette: 0x8a5a36,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xfff0d6,
      ambientIntensity: 0.48,
      hemisphereSkyColor: 0xffd28a,
      hemisphereGroundColor: 0x7a5a2a,
      hemisphereIntensity: 0.3,
      sunColor: 0xffcf89,
      sunIntensity: 1.38,
      sunPosition: { x: 180, y: 120, z: 40 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'sandstorm',
      windStrength: 0.92,
      cloudCoverage: 0.12,
      precipitation: 0,
      turbulence: 0.76,
      windAngle: 0.72,
      cloudOpacity: 0.38,
      cloudTint: 0xd8b07b,
      cloudSpeed: 6.5,
      cloudHeightMin: 90,
      cloudHeightMax: 170,
      particleColor: 0xd0a76f,
      intensity: 0.84,
      fogDensity: 0.00095,
      particleCount: 430,
      particleSize: 8,
      particleSpeed: 20,
      particleDrift: 15,
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
    eventTemplates: [
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.ESCORT_DEFENSE,
    ],
    powerUpFrequency: 0.25,
    powerUpTypes: ['HEALTH', 'DAMAGE', 'SPEED'],
    difficulty: 4,
  },


  {
    id: 3,
    name: '雪山之巅',
    description: '在高耸的雪山上空进行艰苦战斗',
    terrain: TerrainType.MOUNTAINS,
    groundColor: 0xf4f8ff,
    fogColor: 0xd9ecf5,
    skyColors: ['#1d3250', '#4a7095', '#a8ccdf', '#f3fbff'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#a3b5c6', '#b6c5d4', '#d3dfe9', '#e6ebf0'],
      fogColor: 0xdde5ec,
      fogNear: 243,
      fogFar: 2916,
      fogDensity: 0.00068,
      cloudCover: 0.74,
      cloudTint: 0xf2f8ff,
      cloudSpeed: 1.95,
      cloudHeightMin: 95,
      cloudHeightMax: 210,
      weatherIntensity: 0.62,
      particleCount: 377,
      particleSize: 2.9,
      particleSpeed: 10,
      particleDrift: 2.8,
      particleColor: 0xf5fbff,
      waterWaveScale: 0.76,
      skyGlow: 0xd7ecff,
      surfaceProfile: {
        groundBaseColor: 0xf9fbff,
        groundAccentColor: 0xeff4ff,
        groundDetailColor: 0xc9d5e2,
        groundEmissiveColor: 0x5f7a9a,
        roadBaseColor: 0x9caac0,
        roadAccentColor: 0xc3d0e4,
        roadDetailColor: 0x708099,
        roadLineColor: 0xdff2ff,
      },
      // 寒峰雪境：冷白与钢蓝
      designTokens: {
        terrainPrimary: 0xf4f8ff,
        terrainSecondary: 0xc9d5e2,
        terrainAccent: 0xe2ecf8,
        vegetation: 0x2e5448,
        vegetationAccent: 0x49705f,
        water: 0x9cc8e8,
        waterDeep: 0x4a7aa6,
        waterSparkle: 0xe4f4ff,
        structure: 0x6e7e92,
        structureAccent: 0xb8c6d8,
        glow: 0xdcedff,
        horizonHaze: 0xc7daea,
        distantSilhouette: 0x8da6bf,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // worldshowcase 雪天预设：冷白阳光 0xeef2f8 ×1.15 + 高半球补光
      ambientColor: 0xdde5ec,
      ambientIntensity: 0.46,
      hemisphereSkyColor: 0xa3b5c6,
      hemisphereGroundColor: 0xb9c2cc,
      hemisphereIntensity: 0.78,
      sunColor: 0xeef2f8,
      sunIntensity: 1.15,
      sunPosition: { x: 110, y: 180, z: 70 },
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'snow',
      windStrength: 0.44,
      cloudCoverage: 0.74,
      precipitation: 0.48,
      turbulence: 0.34,
      windAngle: 2.4,
      cloudOpacity: 0.8,
      cloudTint: 0xf2f8ff,
      cloudSpeed: 1.95,
      cloudHeightMin: 95,
      cloudHeightMax: 210,
      intensity: 0.62,
      fogDensity: 0.00068,
      particleCount: 377,
      particleSize: 2.9,
      particleSpeed: 10,
      particleDrift: 2.8,
      particleColor: 0xf5fbff,
      waterWaveScale: 0.76,
      skyGlow: 0xd7ecff,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.04,
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
    eventTemplates: [
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ESCORT_DEFENSE,
    ],
    powerUpFrequency: 0.35,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED'],
    difficulty: 6,
  },


  {
    id: 4,
    name: '深海决战',
    description: '在广阔的海洋上空进行最终决战',
    terrain: TerrainType.OCEAN,
    groundColor: 0x16406e,
    waterColor: 0x1379a8,
    fogColor: 0x9ec7dd,
    skyColors: ['#3a76b4', '#4e8ec4', '#7ab2d8', '#c8e2f0'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#2a5d94', '#3e7cb4', '#6fa8cf', '#c4dcea'],
      fogColor: 0xa9cbdd,
      fogNear: 216,
      fogFar: 3168,
      fogDensity: 0.00046,
      cloudCover: 0.62,
      cloudTint: 0xf2f6fa,
      cloudSpeed: 6.2,
      cloudHeightMin: 85,
      cloudHeightMax: 180,
      weatherIntensity: 0.55,
      particleCount: 200,
      particleSize: 6.4,
      particleSpeed: 10.5,
      particleDrift: 7,
      particleColor: 0xe8f1f7,
      waterWaveScale: 5.2,
      skyGlow: 0x9fc8e8,
      surfaceProfile: {
        waterBaseColor: 0x2576a8,
        waterAccentColor: 0x7fc3ec,
        waterDetailColor: 0x16557f,
      },
      // 远洋晴昼：钴蓝海面、银白积云与暖阳
      designTokens: {
        terrainPrimary: 0x2a527a,
        terrainSecondary: 0x1c3f63,
        terrainAccent: 0x4a7aa2,
        vegetation: 0x3f8a68,
        vegetationAccent: 0x63b08c,
        water: 0x2e86ba,
        waterDeep: 0x1f6da0,
        waterSparkle: 0xc8ecf8,
        structure: 0x68798a,
        structureAccent: 0xc2d2de,
        glow: 0xe2f1fa,
        horizonHaze: 0x6f9cbd,
        distantSilhouette: 0x3a6285,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xd8ecff,
      ambientIntensity: 0.62,
      hemisphereSkyColor: 0x9fc6e4,
      hemisphereGroundColor: 0x2e5876,
      hemisphereIntensity: 0.66,
      sunColor: 0xfff3dc,
      sunIntensity: 2.1,
      sunPosition: { x: 90, y: 160, z: 80 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'cloudy',
      windStrength: 0.72,
      cloudCoverage: 0.62,
      precipitation: 0,
      turbulence: 0.45,
      windAngle: -0.65,
      cloudOpacity: 0.72,
      cloudTint: 0xf2f6fa,
      cloudSpeed: 6.2,
      cloudHeightMin: 85,
      cloudHeightMax: 180,
      intensity: 0.55,
      fogDensity: 0.0005,
      particleCount: 200,
      particleSize: 6.4,
      particleSpeed: 10.5,
      particleDrift: 7.2,
      particleColor: 0xe8f1f7,
      waterWaveScale: 5.2,
      skyGlow: 0x9fc8e8,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.08,
      contrast: 1.06,
      saturation: 1.06,
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
    eventTemplates: [
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.ESCORT_DEFENSE,
    ],
    powerUpFrequency: 0.4,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT'],
    difficulty: 8,
  },


  {
    id: 5,
    name: '城市废墟',
    description: '在废弃的城市上空进行终极挑战',
    terrain: TerrainType.CITY,
    groundColor: 0x4f5d6f,
    fogColor: 0x90a3ba,
    skyColors: ['#121a2c', '#2d4463', '#4f72a0', '#98acc7'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      backgroundGradient: ['#11192d', '#28406a', '#537ba9', '#c6d9ef'],
      fogColor: 0x94aeca,
      fogNear: 279,
      fogFar: 3276,
      fogDensity: 0.0003,
      cloudCover: 0.56,
      cloudTint: 0xdde6ef,
      cloudSpeed: 2.0,
      cloudHeightMin: 72,
      cloudHeightMax: 170,
      weatherIntensity: 0.24,
      particleCount: 120,
      particleSize: 3.8,
      particleSpeed: 4.2,
      particleDrift: 1.0,
      particleColor: 0xd6deea,
      waterWaveScale: 0.3,
      skyGlow: 0xe4f0ff,
      surfaceProfile: {
        groundBaseColor: 0x616f84,
        groundAccentColor: 0x9ca9bc,
        groundDetailColor: 0x3f4d5d,
        groundEmissiveColor: 0x293744,
        roadBaseColor: 0x4a5d73,
        roadAccentColor: 0x7c8fa5,
        roadDetailColor: 0x364352,
        roadLineColor: 0xffd88a,
        plazaBaseColor: 0x70829a,
        plazaAccentColor: 0xa8b6cb,
        plazaDetailColor: 0x5a6778,
        buildingBaseColor: 0x5a718e,
        buildingTrimColor: 0xf2f8ff,
        windowColor: 0x7ed6ff,
      },
      // 暮色钢城：石板灰、钢蓝与琥珀霓虹
      designTokens: {
        terrainPrimary: 0x616f84,
        terrainSecondary: 0x3f4d5d,
        terrainAccent: 0x9ca9bc,
        vegetation: 0x44704c,
        vegetationAccent: 0x6a9a64,
        water: 0x4a7d96,
        waterDeep: 0x27485c,
        waterSparkle: 0xa8dcef,
        structure: 0x5a718e,
        structureAccent: 0x8fa3ba,
        glow: 0xffc46a,
        horizonHaze: 0xa9bdd4,
        distantSilhouette: 0x55657a,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ambientColor: 0xebf2ff,
      ambientIntensity: 0.48,
      hemisphereSkyColor: 0xa2bbdf,
      hemisphereGroundColor: 0x495866,
      hemisphereIntensity: 0.62,
      sunColor: 0xe7f1ff,
      sunIntensity: 1.04,
      sunPosition: { x: 110, y: 150, z: 58 },
      shadowMapSize: 1024,
      shadowCameraFar: 520,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'smog',
      windStrength: 0.16,
      cloudCoverage: 0.54,
      precipitation: 0.02,
      turbulence: 0.24,
      windAngle: 0.18,
      cloudOpacity: 0.42,
      cloudTint: 0xdde6ef,
      cloudSpeed: 2.0,
      cloudHeightMin: 78,
      cloudHeightMax: 170,
      intensity: 0.24,
      fogDensity: 0.0003,
      particleCount: 118,
      particleSize: 3.8,
      particleSpeed: 4.2,
      particleDrift: 1.05,
      particleColor: 0xd6deea,
      waterWaveScale: 0.3,
      skyGlow: 0xe4f0ff,
    },
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.16,
      contrast: 1.18,
      saturation: 1.08,
      bloomStrength: 0.06,
      vignetteStrength: 0.09,
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
    eventTemplates: [
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ESCORT_DEFENSE,
    ],
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
