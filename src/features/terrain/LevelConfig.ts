import { CHAPTER_TITLES } from '@/features/campaign/ChapterTitles';
import type { LocalizedText } from '@/i18n';

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

/**
 * 天气预设：
 * - ash：火山灰缓落 + 上升的余烬（熔岩/熔火关卡）
 * - aurora：晴冷空气 + 轻雪，天空悬挂动态极光带（极夜冰海）
 * - storm：雨幕 + 雷暴闪电（峡谷 / 风暴海）
 */
export type LevelWeatherPreset =
  | 'clear'
  | 'cloudy'
  | 'mist'
  | 'windy'
  | 'sandstorm'
  | 'snow'
  | 'storm'
  | 'smog'
  | 'ash'
  | 'aurora';

export interface LevelWeatherConfig {
  preset: LevelWeatherPreset;
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
  /** 云色调覆盖 0..1（1 = 晴日亮白低多边形切面，越低越柔和 / 阴沉）；缺省按天气预设推导 */
  cloudTone?: number;
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
  /** 关卡名：与战役章节标题是同一个对象（CHAPTER_TITLES） */
  name: LocalizedText;
  description: LocalizedText;

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
  /** 第 6 关：火山岛兵工厂（熔岩河、火山口、周围海域） */
  VOLCANO = 'VOLCANO',
  /** 第 7 关：极夜冰海（浮冰、冰山、冰架、开阔海面） */
  ARCTIC = 'ARCTIC',
  /** 第 8 关：雷暴峡谷 */
  CANYON = 'CANYON',
  /** 第 9 关：平流层云海与天梯 */
  STRATOSPHERE = 'STRATOSPHERE',
  /** 第 10 关：陨石坑中的黑曜城堡 */
  CITADEL = 'CITADEL',
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
    name: CHAPTER_TITLES[0],
    description: {
      en: 'First battle over a peaceful lake',
      zh: '在宁静的湖面上空进行首次战斗',
    },
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
    // 晨曦湖谷：通透明亮，轻柔泛光点亮湖面碎光，暗角极弱
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.1,
      contrast: 1.02,
      saturation: 1.06,
      bloomStrength: 0.12,
      vignetteStrength: 0.1,
    },
    totalWaves: 5,
    // 教学关：敌机数逐波缓升（16 架），第 2 关起再按关卡曲线加密
    enemiesPerWave: [2, 3, 3, 4, 4],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'FIGHTER', minWave: 3, maxCount: 2 },
    ],
    waveInterval: 15,
    eventTemplates: [LevelWaveEventType.INTERCEPT],
    powerUpFrequency: 0.3,
    powerUpTypes: ['HEALTH', 'SPEED', 'SHIELD'],
    difficulty: 2,
  },

  {
    id: 2,
    name: CHAPTER_TITLES[1],
    description: {
      en: 'Meet the enemy over the scorching desert',
      zh: '在炎热的沙漠上空迎战敌人',
    },
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
    // 沙暴热浪：暖调高对比，泛光表现烈日热辉，暗角压住沙尘边缘
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.08,
      contrast: 1.08,
      saturation: 1.1,
      bloomStrength: 0.16,
      vignetteStrength: 0.16,
    },
    totalWaves: 5,
    enemiesPerWave: [3, 4, 5, 5, 5],
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
    name: CHAPTER_TITLES[2],
    description: {
      en: 'A hard fight above towering snow peaks',
      zh: '在高耸的雪山上空进行艰苦战斗',
    },
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
    // 雪境：雪面本身很亮，泛光克制避免发白；略降饱和保持冷冽
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.04,
      contrast: 1.04,
      saturation: 0.94,
      bloomStrength: 0.1,
      vignetteStrength: 0.14,
    },
    totalWaves: 6,
    enemiesPerWave: [3, 4, 4, 4, 5, 5],
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
    name: CHAPTER_TITLES[3],
    description: {
      en: 'A decisive battle over the open ocean',
      zh: '在广阔的海洋上空进行最终决战',
    },
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
    // 远洋晴昼：海面高光与浪沫适度泛光，暗角轻
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.08,
      contrast: 1.06,
      saturation: 1.06,
      bloomStrength: 0.15,
      vignetteStrength: 0.12,
    },
    totalWaves: 6,
    enemiesPerWave: [4, 4, 5, 5, 5, 5],
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
    name: CHAPTER_TITLES[4],
    description: {
      en: 'The ultimate challenge over a ruined city',
      zh: '在废弃的城市上空进行终极挑战',
    },
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
      // 暮色钢城：石板灰、钢蓝与琥珀霓虹（水体取第 1 关湖水的亮蓝绿，公园池塘/界河共用）
      designTokens: {
        terrainPrimary: 0x616f84,
        terrainSecondary: 0x3f4d5d,
        terrainAccent: 0x9ca9bc,
        vegetation: 0x44704c,
        vegetationAccent: 0x6a9a64,
        water: 0x39a08c,
        waterDeep: 0x16555e,
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
      // 夜城提亮：环境光与半球光小幅上调，地面不再死黑，但保持夜景氛围
      ambientColor: 0xebf2ff,
      ambientIntensity: 0.56,
      hemisphereSkyColor: 0xa2bbdf,
      hemisphereGroundColor: 0x55626e,
      hemisphereIntensity: 0.74,
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
    // 暮色钢城：霓虹、车流与航空障碍灯需要更明显的泛光，暗角加深夜城纵深
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.16,
      contrast: 1.18,
      saturation: 1.08,
      bloomStrength: 0.26,
      vignetteStrength: 0.18,
    },
    totalWaves: 7,
    enemiesPerWave: [4, 4, 4, 5, 5, 5, 5],
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

  // ===========================================================================
  // 第 6-10 关：战役后半程。difficulty 为遗留字段（统一 10），真实强度由 getLevelScaling 决定。
  // ===========================================================================

  {
    id: 6,
    name: CHAPTER_TITLES[5],
    description: {
      en: 'Storm Ember Island’s lava arsenal and put out ORACLE’s forge through ash and heat',
      zh: '突入赤炎火山岛的熔岩兵工厂，在火山灰与热浪中熄灭神谕的锻炉',
    },
    terrain: TerrainType.VOLCANO,
    groundColor: 0x2a2426,
    waterColor: 0x14262c,
    fogColor: 0x5b3a30,
    skyColors: ['#140709', '#43150f', '#a2401f', '#f2945a'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      // 火山灰遮天：近黑的绛紫天顶 → 熔岩映红的地平线
      backgroundGradient: ['#140709', '#43150f', '#a2401f', '#f2945a'],
      fogColor: 0x5b3a30,
      fogNear: 220,
      fogFar: 2600,
      fogDensity: 0.00052,
      cloudCover: 0.22,
      cloudTint: 0x8a6e64,
      cloudSpeed: 2.4,
      cloudHeightMin: 380,
      cloudHeightMax: 560,
      weatherIntensity: 0.58,
      particleCount: 460,
      particleSize: 3.4,
      particleSpeed: 7,
      particleDrift: 4.5,
      particleColor: 0x8e8580,
      waterWaveScale: 1.4,
      skyGlow: 0xff8a4a,
      surfaceProfile: {
        groundBaseColor: 0x1e1b1d,
        groundAccentColor: 0x4a3c38,
        groundDetailColor: 0x121012,
        groundEmissiveColor: 0x3a120a,
        waterBaseColor: 0x14262c,
        waterAccentColor: 0x6a4a3a,
        waterDetailColor: 0x081418,
      },
      // 熔炉调色板：冷却玄武岩、新鲜黑熔岩、铁锈火山灰、炮铜色工厂与熔金辉光
      designTokens: {
        terrainPrimary: 0x3b3436,
        terrainSecondary: 0x1e1a1c,
        terrainAccent: 0x7a4e3a,
        vegetation: 0x3d4a2a,
        vegetationAccent: 0x667a3a,
        water: 0x1d3a40,
        waterDeep: 0x07141a,
        waterSparkle: 0xff9a5a,
        structure: 0x2c2d33,
        structureAccent: 0x7a3b22,
        glow: 0xff6a1a,
        horizonHaze: 0x7a4434,
        distantSilhouette: 0x2a1614,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // 灰幕后的赤日 + 熔岩反照的暖色半球光
      ambientColor: 0x8a5a4a,
      ambientIntensity: 0.46,
      hemisphereSkyColor: 0xff9a6a,
      hemisphereGroundColor: 0x3a1610,
      hemisphereIntensity: 0.62,
      sunColor: 0xffb07a,
      sunIntensity: 1.6,
      sunPosition: { x: -220, y: 150, z: -120 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'ash',
      windStrength: 0.36,
      cloudCoverage: 0.22,
      precipitation: 0.3,
      turbulence: 0.42,
      windAngle: 1.1,
      cloudOpacity: 0.7,
      cloudTint: 0x8a6e64,
      cloudSpeed: 2.4,
      cloudHeightMin: 380,
      cloudHeightMax: 560,
      intensity: 0.58,
      fogDensity: 0.00052,
      particleCount: 460,
      particleSize: 3.4,
      particleSpeed: 7,
      particleDrift: 4.5,
      particleColor: 0x8e8580,
      waterWaveScale: 1.4,
      skyGlow: 0xff8a4a,
    },
    // 熔岩是本关的光源：较强泛光让熔岩河与炉口发光，高对比 + 深暗角压出灰幕压迫感
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.06,
      contrast: 1.12,
      saturation: 1.12,
      bloomStrength: 0.38,
      vignetteStrength: 0.24,
    },
    totalWaves: 7,
    enemiesPerWave: [5, 5, 5, 5, 6, 6, 6],
    enemyTypes: [
      { type: 'SCOUT', minWave: 1, maxCount: 3 },
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'HEAVY', minWave: 2, maxCount: 3 },
      { type: 'SNIPER', minWave: 3, maxCount: 2 },
      { type: 'ACE', minWave: 5, maxCount: 2 },
    ],
    waveInterval: 6,
    // 第六章目标：拦截向外输送机甲的运输编队
    eventTemplates: [
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ESCORT_DEFENSE,
    ],
    powerUpFrequency: 0.45,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT', 'BOMB'],
    difficulty: 10,
  },

  {
    id: 7,
    name: CHAPTER_TITLES[6],
    description: {
      en: 'Under the polar night, catch the Leviathan as it breaks through the drifting ice',
      zh: '极夜笼罩的北冰洋，在漂移的浮冰与冰山之间截击破冰上浮的利维坦',
    },
    terrain: TerrainType.ARCTIC,
    groundColor: 0xdfe9f2,
    waterColor: 0x0b2232,
    fogColor: 0x16283c,
    skyColors: ['#02050f', '#081a36', '#143a5a', '#2c6a74'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      // 极夜：近黑的天顶 → 极光映照的青绿地平线
      backgroundGradient: ['#02050f', '#081a36', '#143a5a', '#2c6a74'],
      fogColor: 0x16283c,
      fogNear: 260,
      fogFar: 3000,
      fogDensity: 0.00038,
      cloudCover: 0.06,
      cloudTint: 0x5a6f88,
      cloudSpeed: 1.6,
      cloudHeightMin: 300,
      cloudHeightMax: 480,
      weatherIntensity: 0.34,
      particleCount: 240,
      particleSize: 2.6,
      particleSpeed: 5.5,
      particleDrift: 1.6,
      particleColor: 0xe6f2ff,
      waterWaveScale: 0.9,
      skyGlow: 0x5ff0c0,
      surfaceProfile: {
        groundBaseColor: 0x0a1a26,
        groundAccentColor: 0x24445a,
        groundDetailColor: 0x061018,
        groundEmissiveColor: 0x0a2a30,
        waterBaseColor: 0x0b2232,
        waterAccentColor: 0x3a8a8a,
        waterDetailColor: 0x04121c,
      },
      // 极夜冰海调色板：积雪、冰川蓝、深冰青、墨色海水与极光青绿
      designTokens: {
        terrainPrimary: 0xe8f1f8,
        terrainSecondary: 0x9cc4dc,
        terrainAccent: 0x4aa6d6,
        vegetation: 0x2e4a4a,
        vegetationAccent: 0x4a6a6a,
        water: 0x0f3346,
        waterDeep: 0x04121c,
        waterSparkle: 0x8fffe0,
        structure: 0x4a5560,
        structureAccent: 0xc8d4de,
        glow: 0xffc27a,
        horizonHaze: 0x1e3c50,
        distantSilhouette: 0x0c1c2c,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // 冷月主光 + 极光青绿的半球天光：冰面在极夜里仍然可读
      ambientColor: 0x3a5478,
      ambientIntensity: 0.55,
      hemisphereSkyColor: 0x58c8b0,
      hemisphereGroundColor: 0x10202e,
      hemisphereIntensity: 0.82,
      sunColor: 0xb4ccff,
      sunIntensity: 1.25,
      sunPosition: { x: -180, y: 150, z: 120 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'aurora',
      windStrength: 0.28,
      cloudCoverage: 0.06,
      precipitation: 0.2,
      turbulence: 0.18,
      windAngle: 2.8,
      cloudOpacity: 0.5,
      cloudTint: 0x5a6f88,
      cloudSpeed: 1.6,
      cloudHeightMin: 300,
      cloudHeightMax: 480,
      intensity: 0.34,
      fogDensity: 0.00038,
      particleCount: 240,
      particleSize: 2.6,
      particleSpeed: 5.5,
      particleDrift: 1.6,
      particleColor: 0xe6f2ff,
      waterWaveScale: 0.9,
      skyGlow: 0x5ff0c0,
    },
    // 极光与冰面荧光需要泛光，夜色靠曝光略提与较深暗角维持
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.14,
      contrast: 1.1,
      saturation: 1.1,
      bloomStrength: 0.32,
      vignetteStrength: 0.22,
    },
    totalWaves: 7,
    enemiesPerWave: [4, 4, 5, 5, 5, 5, 6],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'HEAVY', minWave: 1, maxCount: 2 },
      { type: 'SNIPER', minWave: 2, maxCount: 3 },
      { type: 'SCOUT', minWave: 3, maxCount: 2 },
      { type: 'ACE', minWave: 4, maxCount: 2 },
    ],
    waveInterval: 5.5,
    // 第七章目标：保护友军破冰护卫舰「北辰」
    eventTemplates: [
      LevelWaveEventType.ESCORT_DEFENSE,
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ELITE_HUNT,
    ],
    powerUpFrequency: 0.45,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT', 'BOMB'],
    difficulty: 10,
  },

  {
    id: 8,
    name: CHAPTER_TITLES[7],
    description: {
      en: 'In the endless storms of Thunder Canyon, hug the cliffs, cover the convoy and meet the armored zeppelin',
      zh: '终年雷暴的雷鸣峡谷，贴着崖壁掩护车队并迎击装甲飞艇',
    },
    terrain: TerrainType.CANYON,
    groundColor: 0xa4553a,
    fogColor: 0x47484e,
    skyColors: ['#07080c', '#121419', '#26282e', '#47484e'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      // 雷暴云底：铅黑天顶 → 与雨雾融为一体的铅灰地平线（环境自带低垂云底与远处雨幕）
      backgroundGradient: ['#07080c', '#121419', '#26282e', '#47484e'],
      fogColor: 0x47484e,
      fogNear: 200,
      fogFar: 2400,
      fogDensity: 0.00058,
      cloudCover: 0.5,
      cloudTint: 0x5a606c,
      cloudSpeed: 4.2,
      cloudHeightMin: 330,
      cloudHeightMax: 480,
      weatherIntensity: 0.82,
      particleCount: 260,
      particleSize: 2.2,
      particleSpeed: 38,
      particleDrift: 9,
      particleColor: 0x9fb0c2,
      waterWaveScale: 0.6,
      skyGlow: 0x5a6a8a,
      surfaceProfile: {
        groundBaseColor: 0x5a3426,
        groundAccentColor: 0x8a5a40,
        groundDetailColor: 0x3a2018,
        groundEmissiveColor: 0x2a1610,
      },
      // 红岩峡谷调色板：赭红砂岩层理、深褐阴影与雷电冷蓝辉光
      designTokens: {
        terrainPrimary: 0xa4553a,
        terrainSecondary: 0x6e3524,
        terrainAccent: 0xd08a5a,
        vegetation: 0x56603a,
        vegetationAccent: 0x7a8a4a,
        water: 0x4a6a6a,
        waterDeep: 0x23383a,
        waterSparkle: 0xb8d8e8,
        structure: 0x5a5048,
        structureAccent: 0xa89a8a,
        glow: 0x9ad0ff,
        horizonHaze: 0x5a5052,
        distantSilhouette: 0x3a2a26,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // 阴云漫射：弱化的冷灰顶光 + 较强的天光与红岩反照，背阴崖壁仍然可读
      ambientColor: 0x8a90a0,
      ambientIntensity: 0.72,
      hemisphereSkyColor: 0x8a96b0,
      hemisphereGroundColor: 0x6a4030,
      hemisphereIntensity: 0.85,
      sunColor: 0xd8dcea,
      sunIntensity: 0.85,
      sunPosition: { x: 120, y: 200, z: 60 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'storm',
      windStrength: 0.78,
      cloudCoverage: 0.5,
      precipitation: 0.75,
      turbulence: 0.72,
      windAngle: 0.4,
      cloudOpacity: 0.8,
      cloudTint: 0x5a606c,
      cloudSpeed: 4.2,
      cloudHeightMin: 330,
      cloudHeightMax: 480,
      intensity: 0.82,
      fogDensity: 0.00058,
      particleCount: 260,
      particleSize: 2.2,
      particleSpeed: 38,
      particleDrift: 9,
      particleColor: 0x9fb0c2,
      waterWaveScale: 0.6,
      skyGlow: 0x5a6a8a,
    },
    // 雷暴：略去饱和 + 高对比，泛光留给闪电、电弧与特斯拉线圈，深暗角压出峡谷幽闭感
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.1,
      contrast: 1.15,
      saturation: 0.96,
      bloomStrength: 0.3,
      vignetteStrength: 0.26,
    },
    totalWaves: 7,
    enemiesPerWave: [4, 5, 5, 5, 5, 6, 6],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'SCOUT', minWave: 1, maxCount: 3 },
      { type: 'HEAVY', minWave: 2, maxCount: 2 },
      { type: 'SNIPER', minWave: 3, maxCount: 3 },
      { type: 'ACE', minWave: 4, maxCount: 3 },
    ],
    waveInterval: 5.5,
    // 第八章目标：护送友军车队「长弓」穿越峡谷
    eventTemplates: [
      LevelWaveEventType.ESCORT_DEFENSE,
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.ESCORT_DEFENSE,
      LevelWaveEventType.INTERCEPT,
    ],
    powerUpFrequency: 0.5,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT', 'BOMB'],
    difficulty: 10,
  },

  {
    id: 9,
    name: CHAPTER_TITLES[8],
    description: {
      en: 'Above a burning sea of cloud, cut ORACLE’s upload along the Sky Ladder',
      zh: '两万米高空的燃烧云海之上，沿天梯轨道电梯截断神谕的上传',
    },
    terrain: TerrainType.STRATOSPHERE,
    groundColor: 0xf6e2d2,
    fogColor: 0xd8a088,
    skyColors: ['#050a26', '#1a2a66', '#5e64b0', '#ffae6e'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      // 平流层：深靛天顶（白昼可见星光）→ 云海燃烧的橙金地平线
      backgroundGradient: ['#050a26', '#1a2a66', '#5e64b0', '#ffae6e'],
      fogColor: 0xd8a088,
      fogNear: 320,
      fogFar: 3600,
      fogDensity: 0.00024,
      cloudCover: 0.1,
      cloudTint: 0xffe2cc,
      cloudSpeed: 3.2,
      cloudHeightMin: 150,
      cloudHeightMax: 300,
      weatherIntensity: 0.18,
      particleCount: 90,
      particleSize: 2,
      particleSpeed: 1.6,
      particleDrift: 2.4,
      particleColor: 0xfff0e0,
      waterWaveScale: 0.4,
      skyGlow: 0xffc890,
      surfaceProfile: {
        groundBaseColor: 0xe8c2b0,
        groundAccentColor: 0xffe2cc,
        groundDetailColor: 0xb08890,
        groundEmissiveColor: 0x6a3a2a,
      },
      // 平流层调色板：受光云海、阴影云谷、燃烧橙金与天梯冷白金属
      designTokens: {
        terrainPrimary: 0xf6e2d2,
        terrainSecondary: 0xc89a9a,
        terrainAccent: 0xffb27a,
        vegetation: 0x8a9ab8,
        vegetationAccent: 0xaab8d8,
        water: 0x6a7ab8,
        waterDeep: 0x2a3270,
        waterSparkle: 0xffe0c0,
        structure: 0xc8ccd8,
        structureAccent: 0x5a6278,
        glow: 0x8ad8ff,
        horizonHaze: 0xe8a888,
        distantSilhouette: 0x7a6aa0,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // 低角度烈日 + 云海反照的暖色地面半球光
      ambientColor: 0x9a9ad8,
      ambientIntensity: 0.5,
      hemisphereSkyColor: 0x7a8ae0,
      hemisphereGroundColor: 0xffa77a,
      hemisphereIntensity: 0.75,
      sunColor: 0xffc89a,
      sunIntensity: 2.4,
      sunPosition: { x: -300, y: 110, z: -200 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'clear',
      windStrength: 0.55,
      cloudCoverage: 0.1,
      precipitation: 0,
      turbulence: 0.3,
      windAngle: -0.4,
      cloudOpacity: 0.86,
      cloudTint: 0xffe2cc,
      cloudSpeed: 3.2,
      cloudHeightMin: 150,
      cloudHeightMax: 300,
      // 高空零星的云岛与云海同样柔和（不走晴日低多边形切面）
      cloudTone: 0.72,
      intensity: 0.18,
      fogDensity: 0.00024,
      particleCount: 90,
      particleSize: 2,
      particleSpeed: 1.6,
      particleDrift: 2.4,
      particleColor: 0xfff0e0,
      waterWaveScale: 0.4,
      skyGlow: 0xffc890,
    },
    // 稀薄空气：通透高饱和，云海受光面的燃烧感交给泛光，暗角轻
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.05,
      contrast: 1.1,
      saturation: 1.14,
      bloomStrength: 0.34,
      vignetteStrength: 0.16,
    },
    totalWaves: 7,
    enemiesPerWave: [4, 5, 5, 5, 6, 6, 6],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'SNIPER', minWave: 1, maxCount: 4 },
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'ACE', minWave: 2, maxCount: 3 },
      { type: 'HEAVY', minWave: 3, maxCount: 2 },
    ],
    waveInterval: 5,
    // 第九章目标：保护友军预警机，民航客机正在撤离
    eventTemplates: [
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ESCORT_DEFENSE,
      LevelWaveEventType.ELITE_HUNT,
    ],
    powerUpFrequency: 0.5,
    powerUpTypes: ['HEALTH', 'SHIELD', 'DAMAGE', 'SPEED', 'MULTISHOT', 'BOMB'],
    difficulty: 10,
  },

  {
    id: 10,
    name: CHAPTER_TITLES[9],
    description: {
      en: 'Break every defense line of the Obsidian Citadel for the final battle with ORACLE',
      zh: '陨石坑中央的黑曜城堡，突破全部防线，与神谕进行最后的决战',
    },
    terrain: TerrainType.CITADEL,
    groundColor: 0x4c4648,
    fogColor: 0x2a1c44,
    skyColors: ['#03020a', '#100a28', '#2c1a4c', '#5a2a5a'],
    environment: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      // 神谕之夜：靛黑天顶 → 紫罗兰 → 被熔火与霓虹映亮的梅紫地平线
      backgroundGradient: ['#03020a', '#100a28', '#2c1a4c', '#5a2a5a'],
      fogColor: 0x2a1c44,
      fogNear: 260,
      fogFar: 2900,
      fogDensity: 0.00042,
      cloudCover: 0.32,
      cloudTint: 0x4a3c6c,
      cloudSpeed: 2.6,
      cloudHeightMin: 420,
      cloudHeightMax: 600,
      weatherIntensity: 0.4,
      particleCount: 260,
      particleSize: 2.6,
      particleSpeed: 5,
      particleDrift: 3,
      particleColor: 0x8a7a96,
      waterWaveScale: 0.5,
      skyGlow: 0x8a7aff,
      surfaceProfile: {
        groundBaseColor: 0x2e2a38,
        groundAccentColor: 0x5e566a,
        groundDetailColor: 0x1c1926,
        groundEmissiveColor: 0x3a1430,
      },
      // 神谕核心调色板：灰紫玄武岩、浅色火山灰台阶、墨紫黑曜石、冷蓝金属；
      // 发光色交给材质：神谕品红、数据青、熔岩橙、白炽核心
      designTokens: {
        terrainPrimary: 0x4c4648,
        terrainSecondary: 0x2e2a30,
        terrainAccent: 0x7a7274,
        vegetation: 0x2a2a30,
        vegetationAccent: 0x3a3a44,
        water: 0x1a1030,
        waterDeep: 0x0a0618,
        waterSparkle: 0xff5aa0,
        structure: 0x1a1828,
        structureAccent: 0x4a4e66,
        glow: 0xff2a7a,
        horizonHaze: 0x3a2450,
        distantSilhouette: 0x161024,
      },
    },
    lighting: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      // 冷月主光（西南方高悬）+ 紫罗兰天光；地面半球光是熔岩的橙色反照
      ambientColor: 0x5a5070,
      ambientIntensity: 0.5,
      hemisphereSkyColor: 0x6a64a8,
      hemisphereGroundColor: 0xff6a2a,
      hemisphereIntensity: 0.7,
      sunColor: 0xc8ccff,
      sunIntensity: 1.7,
      sunPosition: { x: -180, y: 230, z: 170 },
      shadowMapSize: 1024,
    },
    weather: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.weather,
      preset: 'ash',
      windStrength: 0.3,
      cloudCoverage: 0.32,
      precipitation: 0.15,
      turbulence: 0.36,
      windAngle: -1.9,
      cloudOpacity: 0.7,
      cloudTint: 0x4a3c6c,
      cloudSpeed: 2.6,
      cloudHeightMin: 420,
      cloudHeightMax: 600,
      intensity: 0.4,
      fogDensity: 0.00042,
      particleCount: 260,
      particleSize: 2.6,
      particleSpeed: 5,
      particleDrift: 3,
      particleColor: 0x8a7a96,
      waterWaveScale: 0.5,
      skyGlow: 0x8a7aff,
    },
    // 最终决战：最强泛光（霓虹、熔岩、核心光柱）、高对比与最深暗角
    postFx: {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      exposure: 1.08,
      contrast: 1.16,
      saturation: 1.12,
      bloomStrength: 0.46,
      vignetteStrength: 0.3,
    },
    totalWaves: 8,
    enemiesPerWave: [3, 3, 4, 4, 4, 4, 5, 5],
    enemyTypes: [
      { type: 'FIGHTER', minWave: 1, maxCount: 4 },
      { type: 'HEAVY', minWave: 1, maxCount: 2 },
      { type: 'SCOUT', minWave: 1, maxCount: 2 },
      { type: 'SNIPER', minWave: 2, maxCount: 3 },
      { type: 'ACE', minWave: 2, maxCount: 4 },
    ],
    waveInterval: 4.5,
    eventTemplates: [
      LevelWaveEventType.ELITE_HUNT,
      LevelWaveEventType.INTERCEPT,
      LevelWaveEventType.ESCORT_DEFENSE,
      LevelWaveEventType.ELITE_HUNT,
    ],
    powerUpFrequency: 0.55,
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
