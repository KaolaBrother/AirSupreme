import * as THREE from 'three';
import {
  TerrainType,
  LevelConfig,
  LevelSurfaceProfile,
  LevelWeatherConfig,
  SceneDesignTokens,
} from './LevelConfig';
import { GameConfig, GAME_CONSTANTS } from '@/config';
import { getLogger } from '@/core/utils/Logger';
import {
  Heightfield,
  LAKESIDE_VALLEY_PRESET,
  DESERT_DUNE_PRESET,
  ALPINE_RIDGE_PRESET,
} from './worldscape/heightfield';
import {
  BiomePainter,
  buildWorldTerrainMesh,
  WORLDSHOWCASE_BIOME_PALETTE,
  DESERT_BIOME_PALETTE,
  ALPINE_BIOME_PALETTE,
} from './worldscape/biomes';
import {
  buildWorldscapeWater,
  sampleWaveHeight,
  type WorldscapeWater,
} from './worldscape/water';
import {
  buildVegetation,
  grassTuftGeometry,
  leafTreeGeometries,
  setScatterInstance,
  type WorldscapeVegetation,
} from './worldscape/vegetation';
import { injectWindSway } from './worldscape/shadermods';
import { CloudField } from './worldscape/clouds';

const log = getLogger('TerrainGenerator');

/** worldscape 高度场局部 0（水位）对应的世界 Y */
const WORLDSCAPE_WATER_Y = -48;
/** 旧版地面基准（-50）与 worldscape 水位基准的差值 */
const WORLDSCAPE_BASE_OFFSET = WORLDSCAPE_WATER_Y - -50;

type WeatherType = 'clear' | 'rain' | 'snow' | 'dust' | 'mist' | 'storm' | 'smog';
type SurfacePattern = 'grass' | 'sand' | 'snow' | 'rock' | 'asphalt' | 'water' | 'beach';
const WEATHER_PRESET_OVERLAYS: Record<
  WeatherType,
  {
    overlayColor: THREE.ColorRepresentation;
    overlayAlpha: number;
    horizonAlpha: number;
    streakBoost: number;
  }
> = {
  clear: { overlayColor: 0xffffff, overlayAlpha: 0.02, horizonAlpha: 0.1, streakBoost: 0 },
  mist: { overlayColor: 0xf2fbff, overlayAlpha: 0.08, horizonAlpha: 0.18, streakBoost: 8 },
  snow: { overlayColor: 0xe4f4ff, overlayAlpha: 0.07, horizonAlpha: 0.16, streakBoost: 10 },
  dust: { overlayColor: 0xffd39a, overlayAlpha: 0.12, horizonAlpha: 0.2, streakBoost: 12 },
  storm: { overlayColor: 0x8aa7c4, overlayAlpha: 0.14, horizonAlpha: 0.22, streakBoost: 16 },
  smog: { overlayColor: 0xa9afba, overlayAlpha: 0.12, horizonAlpha: 0.24, streakBoost: 14 },
  rain: { overlayColor: 0xb8cbe2, overlayAlpha: 0.1, horizonAlpha: 0.18, streakBoost: 12 },
};

interface WeatherProfile {
  type: WeatherType;
  intensity: number;
  fogDensity: number;
  cloudCount: number;
  cloudOpacity: number;
  cloudTint: THREE.ColorRepresentation;
  cloudSpeed: number;
  cloudHeightMin: number;
  cloudHeightMax: number;
  /** 云覆盖率 0..1：决定多少朵积云在天上（worldscape 云场用） */
  cloudCoverage: number;
  /** 云色调 0..1：1 = 晴日亮白，越低越阴沉（worldscape 云场用） */
  cloudTone: number;
  /** 风力 0..1：驱动云漂移速度与植被摇曳 */
  windStrength: number;
  /** 风向（弧度，0 = +X），云层沿该方向漂移 */
  windAngle: number;
  particleCount: number;
  particleSize: number;
  particleSpeed: number;
  particleDrift: number;
  particleColor: THREE.ColorRepresentation;
  waterWaveScale: number;
  skyGlow: THREE.ColorRepresentation;
}

/** 各地形的设计令牌兜底值（关卡未配置 designTokens 时使用） */
const FALLBACK_DESIGN_TOKENS: Record<TerrainType, SceneDesignTokens> = {
  [TerrainType.LAKE]: {
    terrainPrimary: 0x8ecf60,
    terrainSecondary: 0x67a34f,
    terrainAccent: 0xa8dc7c,
    vegetation: 0x3e8a3c,
    vegetationAccent: 0x77c95e,
    water: 0x5eb7de,
    waterDeep: 0x2a6e96,
    waterSparkle: 0xbdf0ff,
    structure: 0x9c6b4a,
    structureAccent: 0xf3e6c8,
    glow: 0xffe9b0,
    horizonHaze: 0xdceff8,
    distantSilhouette: 0x7da3c0,
  },
  [TerrainType.DESERT]: {
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
  [TerrainType.MOUNTAINS]: {
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
  [TerrainType.OCEAN]: {
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
  [TerrainType.CITY]: {
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
};

export class TerrainGenerator {
  private scene: THREE.Scene;
  private terrainGroup: THREE.Group;
  private waterMesh?: THREE.Mesh;
  private trees: THREE.Group[] = [];
  private rocks: THREE.Mesh[] = [];
  private time: number = 0;
  /** worldscape 实例化积云场（漂移/浮沉/天气色调，所有关卡共用） */
  private cloudField: CloudField | null = null;
  /** worldscape 波浪着色器水面（湖/雪山/海洋） */
  private worldWater: WorldscapeWater | null = null;
  /** worldscape 实例化植被（松树/阔叶/岩石/草簇） */
  private worldVegetation: WorldscapeVegetation | null = null;
  /** 当前关卡的解析高度场（湖/沙漠/雪山），所有放置查询共用 */
  private stageField: Heightfield | null = null;
  /** 注入植被摇曳/雪覆盖着色器的共享 uniform */
  private readonly worldscapeTime = { value: 0 };
  private readonly worldscapeWind = { value: 0.3 };
  private readonly worldscapeSnow = { value: 0 };
  private weatherParticles?: THREE.Points;
  private weatherParticleBaseHeight: number = 260;
  private weatherParticleSpread: number = 1600;
  private weatherParticleFloor: number = -40;
  private weatherProfile: WeatherProfile = this.getDefaultWeatherProfile(TerrainType.LAKE);
  /** 关卡级动态元素动画注册表（飞鸟、探照灯、雷暴等），clearTerrain 时清空 */
  private animatedProps: Array<(deltaTime: number, time: number) => void> = [];
  private cityBeaconMaterial?: THREE.MeshBasicMaterial;
  /** 移动端按比例缩减新增装饰元素数量，保持帧率 */
  private readonly detailScale: number = GameConfig.isMobile ? 0.55 : 1;
  /** 战场水平半径（米），用于道路网、边界雾墙等需要贴合战场范围的元素 */
  private readonly halfExtent: number = GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT;
  /** 玩家最近位置（updateLOD 时更新），天气粒子/雨幕重生时以此为中心，保证天气始终跟随玩家 */
  private lastPlayerPosition = new THREE.Vector3(0, 80, 0);
  /** 当前关卡的设计令牌调色板 */
  private designTokens: SceneDesignTokens = FALLBACK_DESIGN_TOKENS[TerrainType.LAKE];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.terrainGroup = new THREE.Group();
    this.terrainGroup.name = 'terrain';
    this.scene.add(this.terrainGroup);
  }

  /**
   * 生成关卡地形
   */
  public generateTerrain(config: LevelConfig): void {
    log.debug('Generating terrain:', { terrain: config.terrain });

    this.clearTerrain();
    this.weatherProfile = this.resolveWeatherProfile(config);
    this.designTokens = config.environment.designTokens ?? FALLBACK_DESIGN_TOKENS[config.terrain];
    // worldscape 着色器 uniform：风力驱动草木摇曳，雪覆盖只在雪山关激活
    this.worldscapeWind.value = 0.25 + this.weatherProfile.windStrength * 1.1;
    this.worldscapeSnow.value = config.terrain === TerrainType.MOUNTAINS ? 1 : 0;
    this.weatherParticleBaseHeight = Math.max(140, this.weatherProfile.cloudHeightMax + 30);
    this.weatherParticleSpread = 1200 + this.weatherProfile.intensity * 700;
    this.weatherParticleFloor = this.weatherProfile.type === 'storm' ? -80 : -40;

    log.debug('After clear, terrainGroup children:', { count: this.terrainGroup.children.length });

    // 设置天空
    this.createSky(config.skyColors, this.weatherProfile);

    // 根据地形类型生成
    switch (config.terrain) {
      case TerrainType.LAKE:
        this.generateLakeTerrain(config);
        break;
      case TerrainType.DESERT:
        this.generateDesertTerrain(config);
        break;
      case TerrainType.MOUNTAINS:
        this.generateMountainTerrain(config);
        break;
      case TerrainType.OCEAN:
        this.generateOceanTerrain(config);
        break;
      case TerrainType.CITY:
        this.generateCityTerrain(config);
        break;
    }

    // 添加云朵（含高空卷云层）
    this.createClouds(this.weatherProfile);
    this.createCirrusLayer(this.weatherProfile);

    // 添加轻量天气表现
    this.createWeatherEffect(this.weatherProfile);

    // 天体层（太阳/月亮/星空）与强天气层（雨幕/雷暴）
    this.createCelestialLayer(config, this.weatherProfile);
    this.createPrecipitationStreaks(this.weatherProfile);
    this.setupLightningStorm(this.weatherProfile);

    // 战场软边界雾墙：远观如地平线雾霭，弱化战场边缘的"尽头感"
    this.createPerimeterHaze();

    // 设置雾（优先使用环境雾色，保持与 GameScene 环境配置一致）
    this.scene.fog = new THREE.FogExp2(config.environment.fogColor ?? config.fogColor, this.weatherProfile.fogDensity);
  }

  /**
   * 生成湖面地形 —— worldshowcase 山谷的直接移植（XZ ×2.2 放大到 4000m 地面）：
   * 解析高度场（域扭曲 fbm 谷底 + 边缘山脊带/峰墙 + 中央冰川湖盆）、
   * 生物群系顶点色、波浪着色器湖面、实例化松林/阔叶/岩石/风吹草簇。
   */
  private generateLakeTerrain(config: LevelConfig): void {
    const field = new Heightfield(LAKESIDE_VALLEY_PRESET);
    this.stageField = field;
    const painter = new BiomePainter(field, {
      palette: WORLDSHOWCASE_BIOME_PALETTE,
      waterLevel: 0,
      snowLine: 118,
    });

    const terrain = buildWorldTerrainMesh(field, painter, {
      size: 4000,
      segments: GameConfig.isMobile ? 180 : 256,
      snowUniform: this.worldscapeSnow,
    });
    terrain.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(terrain);

    // 中央冰川湖 + 谷地零星小水潭：全幅水面，地形深度按顶点烘焙进着色器
    this.worldWater = buildWorldscapeWater({
      size: 4000,
      grid: GameConfig.isMobile ? 128 : 176,
      depthAt: (x, z) => -field.heightAt(x, z),
      deepColor: 0x16555e,
      shallowColor: 0x39a08c,
      skyTint: 0xbcd6da,
      sunDir: this.getSunDirection(config),
      sunColor: config.lighting.sunColor,
      sunIntensity: Math.min(1.6, config.lighting.sunIntensity * 0.45),
    });
    this.worldWater.mesh.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(this.worldWater.mesh);

    // 实例化植被：噪声场驱动的密集松林、阔叶团簇、碎石与风吹草地
    this.worldVegetation = buildVegetation(
      field,
      {
        seed: 909090,
        half: 1970,
        snowLine: 118,
        pines: { count: this.scaleCount(3200), minHeight: 4, maxHeight: 142, maxSlope: 0.42 },
        broadleaf: { count: this.scaleCount(1500), minHeight: 2.5, maxHeight: 62, maxSlope: 0.3 },
        rocks: { count: this.scaleCount(900), minHeight: 1 },
        grass: { count: this.scaleCount(24000), minHeight: 2.2, maxHeight: 95, maxSlope: 0.34 },
      },
      this.getWorldscapeUniforms()
    );
    this.worldVegetation.group.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(this.worldVegetation.group);

    // 保留的湖畔地标与生态动态元素：木码头与小船、村落、莲叶、花粉、飞鸟
    this.createLakeDock();
    this.createLakeHamlet();
    this.createLakeLilyPads();
    this.createLakePollenDrift();
    this.createBirdFlock({
      centerX: -240,
      centerZ: -130,
      radius: 210,
      altitude: 58,
      count: 9,
      color: 0x2e3338,
      speed: 0.22,
      size: 2.6,
    });
    this.createBirdFlock({
      centerX: 320,
      centerZ: 260,
      radius: 160,
      altitude: 86,
      count: 6,
      color: 0x3a4046,
      speed: -0.18,
      size: 2.2,
    });
  }

  /** 关卡配置中的太阳位置 → 归一化方向（水面高光用） */
  private getSunDirection(config: LevelConfig): THREE.Vector3 {
    const p = config.lighting.sunPosition;
    const v = new THREE.Vector3(p.x, p.y, p.z);
    return v.lengthSq() > 0 ? v.normalize() : new THREE.Vector3(0.5, 0.7, 0.3);
  }

  private getWorldscapeUniforms() {
    return { time: this.worldscapeTime, wind: this.worldscapeWind, snow: this.worldscapeSnow };
  }

  /** 沿给定方向从湖心向外步进，找到水岸线半径（高度首次越过水位） */
  private findShorelineRadius(dirX: number, dirZ: number, fallback = 620): number {
    if (!this.stageField) return fallback;
    for (let r = 220; r <= 1700; r += 12) {
      if (this.stageField.heightAt(dirX * r, dirZ * r) > 0.4) {
        return r;
      }
    }
    return fallback;
  }

  private createIrregularShape(options: {
    baseRadius: number;
    radiusJitter: number;
    pointCount: number;
    wobbleFreqA?: number;
    wobbleFreqB?: number;
    phaseA?: number;
    phaseB?: number;
  }): THREE.Shape {
    const shape = new THREE.Shape();
    const freqA = options.wobbleFreqA ?? 3;
    const freqB = options.wobbleFreqB ?? 5;
    const phaseA = options.phaseA ?? 0;
    const phaseB = options.phaseB ?? 0;
    const jitter = options.radiusJitter;

    for (let i = 0; i <= options.pointCount; i++) {
      const angle = (i / options.pointCount) * Math.PI * 2;
      const radius =
        options.baseRadius +
        Math.sin(angle * freqA + phaseA) * jitter * 0.9 +
        Math.cos(angle * freqB + phaseB) * jitter * 0.65 +
        Math.sin(angle * 1.5 + phaseA * 0.8) * (jitter * 0.2);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }

    return shape;
  }

  private createDesertDunePerspective(surfaceProfile: LevelSurfaceProfile): void {
    const duneColor = this.tintColor(surfaceProfile.groundBaseColor ?? 0xdab88b, 0.01, 0.04, 0.01);
    const duneMaterial = new THREE.MeshStandardMaterial({
      color: duneColor,
      roughness: 0.94,
      metalness: 0,
      emissive: this.tintColor(duneColor, 0.02, 0.2, 0.04),
      emissiveIntensity: 0.04,
      map: this.createDetailTexture(
        duneColor,
        surfaceProfile.groundAccentColor ?? 0xffd58e,
        surfaceProfile.groundDetailColor ?? 0xa67d46,
        'sand'
      ),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    for (let i = 0; i < 9; i++) {
      const ridgeLength = 240 + Math.random() * 520;
      const ridge = new THREE.Mesh(new THREE.PlaneGeometry(ridgeLength, 12), duneMaterial);
      ridge.rotation.x = -Math.PI / 2 + Math.random() * 0.08;
      ridge.rotation.z = (Math.random() - 0.5) * 0.46;
      ridge.rotation.y = (Math.random() - 0.5) * 1.2;
      const ridgeX = (Math.random() - 0.5) * 2800;
      const ridgeZ = (Math.random() - 0.5) * 2800;
      ridge.position.set(
        ridgeX,
        -50 + this.sampleDesertGroundHeight(ridgeX, ridgeZ) + 0.6,
        ridgeZ
      );
      ridge.scale.setScalar(0.5 + Math.random() * 0.8);
      this.terrainGroup.add(ridge);
    }
  }

  private createDesertHeatHaze(surfaceProfile: LevelSurfaceProfile): void {
    const hazeBase = this.tintColor(surfaceProfile.groundAccentColor ?? 0xffd58e, 0.04, -0.08, 0.08);

    for (let i = 0; i < 4; i++) {
      const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(4800, 360 + i * 140),
        new THREE.MeshStandardMaterial({
          color: hazeBase,
          transparent: true,
          opacity: 0.085 - i * 0.012,
          roughness: 1,
          metalness: 0,
          emissive: this.tintColor(hazeBase, 0.02, 0.15, -0.02),
          emissiveIntensity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      haze.rotation.x = -Math.PI / 2 + 0.06;
      haze.rotation.z = (Math.random() - 0.5) * 0.16;
      haze.position.set(
        (Math.random() - 0.5) * 360,
        // worldscape 沙海起伏 ±24m：热浪层抬到沙丘脊线之上
        -22 + i * 1.4,
        -840 + i * 300
      );
      haze.renderOrder = 5;
      this.terrainGroup.add(haze);
    }
  }

  private createCityNightLights(surfaceProfile: LevelSurfaceProfile): void {
    const windowLightColor = surfaceProfile.windowColor ?? 0x7ee6ff;
    const accentColor = this.tintColor(windowLightColor, 0.03, 0.15, 0.28);
    const lightMatrix = new THREE.Object3D();
    const windowGeometry = new THREE.PlaneGeometry(2.2, 1.2);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: windowLightColor,
      transparent: true,
      opacity: 0.94,
      roughness: 0.1,
      metalness: 0.1,
      emissive: accentColor,
      emissiveIntensity: 0.98,
      side: THREE.DoubleSide,
    });
    const windowLights = new THREE.InstancedMesh(windowGeometry, windowMaterial, 224);

    for (let i = 0; i < 224; i++) {
      lightMatrix.position.set(
        (Math.random() - 0.5) * 3000,
        -49.0 - Math.random() * 4,
        (Math.random() - 0.5) * 3000
      );
      lightMatrix.rotation.set(Math.PI / 2, (Math.random() - 0.5) * Math.PI * 0.12, 0);
      lightMatrix.scale.setScalar(0.55 + Math.random() * 1.25);
      lightMatrix.updateMatrix();
      windowLights.setMatrixAt(i, lightMatrix.matrix);
    }
    windowLights.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(windowLights);

    const roadGlowMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(surfaceProfile.roadLineColor ?? 0xf0f4ff, 0.02, 0.15, 0.2),
      emissive: this.tintColor(surfaceProfile.roadLineColor ?? 0xf0f4ff, 0.03, 0.22, 0.18),
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.12,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const lowBandColor = this.tintColor(surfaceProfile.roadLineColor ?? 0xffd88a, 0.04, 0.18, 0.1);
    const lowBandMaterial = new THREE.MeshStandardMaterial({
      color: lowBandColor,
      transparent: true,
      opacity: 0.16,
      roughness: 0.28,
      metalness: 0.08,
      emissive: this.tintColor(lowBandColor, 0.03, 0.24, 0.12),
      emissiveIntensity: 0.66,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sideLineColor = this.tintColor(surfaceProfile.windowColor ?? 0x7ee6ff, 0.01, 0.18, 0.2);
    const sideBandMaterial = new THREE.MeshStandardMaterial({
      color: sideLineColor,
      emissive: this.tintColor(sideLineColor, 0.02, 0.2, 0.14),
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.14,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });

    const lineExtent = this.halfExtent * 2;
    for (let i = -6; i <= 6; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(lineExtent, 3.2), roadGlowMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, -49.2, i * 250 + 7);
      this.terrainGroup.add(line);

      const corridorBand = new THREE.Mesh(new THREE.PlaneGeometry(lineExtent, 16), lowBandMaterial);
      corridorBand.rotation.x = -Math.PI / 2;
      corridorBand.position.set(0, -49.34, i * 250);
      this.terrainGroup.add(corridorBand);

      for (let side = -1; side <= 1; side += 2) {
        const sideBand = new THREE.Mesh(new THREE.PlaneGeometry(lineExtent, 2.2), sideBandMaterial);
        sideBand.rotation.x = -Math.PI / 2;
        sideBand.position.set(0, -49.22, i * 250 + side * 9);
        this.terrainGroup.add(sideBand);
      }
    }

    for (let i = -6; i <= 6; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(3.2, lineExtent), roadGlowMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i * 250 - 7, -49.2, 0);
      this.terrainGroup.add(line);

      const corridorBand = new THREE.Mesh(new THREE.PlaneGeometry(16, lineExtent), lowBandMaterial);
      corridorBand.rotation.x = -Math.PI / 2;
      corridorBand.position.set(i * 250, -49.34, 0);
      this.terrainGroup.add(corridorBand);

      for (let side = -1; side <= 1; side += 2) {
        const sideBand = new THREE.Mesh(new THREE.PlaneGeometry(2.2, lineExtent), sideBandMaterial);
        sideBand.rotation.x = -Math.PI / 2;
        sideBand.position.set(i * 250 + side * 9, -49.22, 0);
        this.terrainGroup.add(sideBand);
      }
    }
  }

  private createCitySurfaceBoundary(surfaceProfile: LevelSurfaceProfile): void {
    const borderColor = this.tintColor(surfaceProfile.plazaBaseColor ?? 0x808a98, 0.02, -0.15, -0.05);
    const boundaryMaterial = new THREE.MeshStandardMaterial({
      color: borderColor,
      transparent: true,
      opacity: 0.5,
      roughness: 0.24,
      metalness: 0.35,
      emissive: this.tintColor(borderColor, 0.04, 0.1, 0.08),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    });
    const laneGlowMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(surfaceProfile.plazaBaseColor ?? 0x808a98, 0.02, 0.1, -0.02),
      transparent: true,
      opacity: 0.22,
      roughness: 0.28,
      metalness: 0.3,
      emissive: this.tintColor(surfaceProfile.plazaBaseColor ?? 0x808a98, 0.02, 0.22, 0.06),
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide,
    });

    const gridMin = -6;
    const gridMax = 5;
    const gridSpan = gridMax - gridMin + 1;
    const blockCount = gridSpan * gridSpan;

    const edgeSegments = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(198, 1.6),
      boundaryMaterial,
      blockCount * 4
    );
    const boundaryGlows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(198, 1.3),
      laneGlowMaterial,
      blockCount
    );

    const dummy = new THREE.Object3D();
    let edgeIndex = 0;
    let glowIndex = 0;
    for (let gx = gridMin; gx <= gridMax; gx++) {
      for (let gz = gridMin; gz <= gridMax; gz++) {
        const cx = gx * 250 + 125;
        const cz = gz * 250 + 125;

        const edges = [
          { x: 0, z: 95, spin: 0 },
          { x: 0, z: -95, spin: 0 },
          { x: 95, z: 0, spin: Math.PI / 2 },
          { x: -95, z: 0, spin: Math.PI / 2 },
        ];

        for (const edge of edges) {
          dummy.position.set(cx + edge.x, -49.72, cz + edge.z);
          dummy.rotation.set(-Math.PI / 2, 0, edge.spin);
          dummy.updateMatrix();
          edgeSegments.setMatrixAt(edgeIndex++, dummy.matrix);
        }

        dummy.position.set(cx, -49.66, cz);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        boundaryGlows.setMatrixAt(glowIndex++, dummy.matrix);
      }
    }
    edgeSegments.instanceMatrix.needsUpdate = true;
    boundaryGlows.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(edgeSegments);
    this.terrainGroup.add(boundaryGlows);
  }

  /**
   * 创建森林
   */
  /** 湖区地形高度采样：基于 worldscape 高度场（返回值相对旧版 -50 地面基准） */
  private sampleLakeGroundHeight(worldX: number, worldZ: number): number {
    if (!this.stageField) return 0;
    return this.stageField.heightAt(worldX, worldZ) + WORLDSCAPE_BASE_OFFSET;
  }

  /**
   * 双坡屋顶三棱柱几何体：底面贴 y=0，屋脊沿局部 Z 轴。
   * width 为底面宽度，depth 为屋脊长度，height 为屋脊高度。
   */
  private createPitchedRoofGeometry(
    width: number,
    depth: number,
    height: number
  ): THREE.BufferGeometry {
    const radius = width / Math.sqrt(3);
    const geometry = new THREE.CylinderGeometry(radius, radius, depth, 3, 1, false, Math.PI);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, radius * 0.5, 0);
    geometry.scale(1, height / (radius * 1.5), 1);
    return geometry;
  }

  /** 湖畔小村落：石木小屋（暖窗）、坡顶屋脊与袅袅炊烟（自动寻找湖畔平缓草甸落位） */
  private createLakeHamlet(): void {
    const tokens = this.designTokens;
    const hamlet = new THREE.Group();
    hamlet.name = 'lakesideHamlet';
    let hamletX = -430;
    let hamletZ = 330;
    if (this.stageField) {
      let found = false;
      for (const radius of [760, 880, 1010, 1140]) {
        if (found) break;
        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * Math.PI * 2 + 0.21;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const h = this.stageField.heightAt(x, z);
          if (h > 4 && h < 36 && this.stageField.slopeAt(x, z) < 0.12) {
            hamletX = x;
            hamletZ = z;
            found = true;
            break;
          }
        }
      }
    }

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structureAccent, 0, -0.1, 0),
      roughness: 0.85,
      metalness: 0,
    });
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structure, 0, 0.04, -0.08),
      roughness: 0.8,
      metalness: 0.02,
    });
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: tokens.glow,
      emissive: tokens.glow,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0,
    });
    const chimneyMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structure, 0, -0.2, -0.12),
      roughness: 0.92,
      metalness: 0,
    });

    const cottageCount = 7;
    const smokeAnchors: Array<{ x: number; y: number; z: number }> = [];

    for (let i = 0; i < cottageCount; i++) {
      const angle = (i / cottageCount) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 28 + Math.random() * 60;
      const x = hamletX + Math.cos(angle) * radius;
      const z = hamletZ + Math.sin(angle) * radius;
      const groundY = -50 + this.sampleLakeGroundHeight(x, z);
      const width = 9 + Math.random() * 4;
      const depth = 11 + Math.random() * 5;
      const height = 5 + Math.random() * 2.5;
      const yaw = Math.random() * Math.PI * 2;

      const cottage = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
      body.position.y = height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      cottage.add(body);

      const roof = new THREE.Mesh(
        this.createPitchedRoofGeometry(width + 1.4, depth + 1.2, height * 0.62),
        roofMaterial
      );
      roof.position.y = height;
      roof.castShadow = true;
      cottage.add(roof);

      for (let side = -1; side <= 1; side += 2) {
        const window = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), windowMaterial);
        window.position.set(side * width * 0.26, height * 0.5, depth / 2 + 0.06);
        cottage.add(window);
      }

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 1.1), chimneyMaterial);
      const chimneyOffsetZ = -depth * 0.24;
      chimney.position.set(width * 0.22, height + height * 0.45, chimneyOffsetZ);
      cottage.add(chimney);

      cottage.position.set(x, groundY, z);
      cottage.rotation.y = yaw;
      hamlet.add(cottage);

      // 前三座小屋的烟囱冒烟
      if (i < 3) {
        const chimneyWorldX =
          x + Math.cos(-yaw) * width * 0.22 - Math.sin(-yaw) * chimneyOffsetZ;
        const chimneyWorldZ =
          z + Math.sin(-yaw) * width * 0.22 + Math.cos(-yaw) * chimneyOffsetZ;
        smokeAnchors.push({
          x: chimneyWorldX,
          y: groundY + height + height * 0.45 + 1.4,
          z: chimneyWorldZ,
        });
      }
    }
    this.terrainGroup.add(hamlet);

    // 炊烟：细小的点粒子柱，缓慢上升并随风摆动
    for (const anchor of smokeAnchors) {
      const count = this.scaleCount(12);
      const progress = new Float32Array(count);
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        progress[i] = Math.random();
        phases[i] = Math.random() * Math.PI * 2;
      }
      const positions = new Float32Array(count * 3);
      const geometry = new THREE.BufferGeometry();
      const attribute = new THREE.BufferAttribute(positions, 3);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', attribute);
      const material = new THREE.PointsMaterial({
        color: this.tintColor(tokens.horizonHaze, 0, -0.3, 0.1),
        size: 2.2,
        map: this.createSoftCircleTexture(),
        alphaTest: 0.02,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      const smoke = new THREE.Points(geometry, material);
      smoke.frustumCulled = false;
      this.terrainGroup.add(smoke);

      this.animatedProps.push((deltaTime, time) => {
        for (let i = 0; i < count; i++) {
          progress[i] += deltaTime * 0.16;
          if (progress[i] >= 1) {
            progress[i] -= 1;
          }
          const rise = progress[i] * 22;
          const sway = Math.sin(time * 0.8 + phases[i] + progress[i] * 3) * (1 + progress[i] * 3.2);
          const offset = i * 3;
          positions[offset] = anchor.x + sway;
          positions[offset + 1] = anchor.y + rise;
          positions[offset + 2] = anchor.z + Math.cos(time * 0.6 + phases[i]) * (0.6 + progress[i] * 2);
        }
        attribute.needsUpdate = true;
        material.opacity = 0.26 + Math.sin(time * 0.5) * 0.05;
      });
    }
  }

  /**
   * 生成沙漠地形
   */
  private generateDesertTerrain(config: LevelConfig): void {
    const surfaceProfile = this.getSurfaceProfile(config);
    // worldscape 沙海：低频 fbm 起伏 + 沙色生物群系顶点色（无山脊带）
    const field = new Heightfield(DESERT_DUNE_PRESET);
    this.stageField = field;
    const painter = new BiomePainter(field, {
      palette: DESERT_BIOME_PALETTE,
      waterLevel: -999, // 无水面
      snowLine: 9999,
      beachHeight: 10, // 低洼读作纯沙
      beachBlendTop: 16,
      forestDarkening: 0.18,
    });
    const terrain = buildWorldTerrainMesh(field, painter, {
      size: 4000,
      segments: GameConfig.isMobile ? 160 : 220,
    });
    terrain.position.y = -50;
    this.terrainGroup.add(terrain);

    // 实例化散布：暖调风蚀碎石 + 稀疏干草簇（橄榄/沙褐）
    this.worldVegetation = buildVegetation(
      field,
      {
        seed: 20260214,
        half: 1970,
        snowLine: 9999,
        rocks: { count: this.scaleCount(300), minHeight: -30 },
        grass: {
          count: this.scaleCount(5200),
          minHeight: -24,
          maxHeight: 80,
          maxSlope: 0.4,
          rootColor: 0x6b6234,
          tipColor: 0xcbb56a,
          hueBase: 0.13,
          hueDryShift: 0.03,
          saturation: 0.34,
          lightnessBase: 0.5,
          lightnessRand: 0.18,
        },
        rockTint: { r: 1.12, g: 1, b: 0.78 },
      },
      this.getWorldscapeUniforms()
    );
    this.worldVegetation.group.position.y = -50;
    this.terrainGroup.add(this.worldVegetation.group);

    // 添加仙人掌
    this.createCacti(80);

    // 添加枯木
    this.createDeadTrees(24);

    // 增强沙尘透视与热浪层次
    this.createDesertDunePerspective(surfaceProfile);
    this.createDesertHeatHaze(surfaceProfile);

    // 沙漠地貌剪影与动态沙暴元素：远景台地、风蚀岩拱、游走尘卷风
    this.createDesertMesas(surfaceProfile);
    this.createDesertArches(surfaceProfile);
    this.createDustDevils(surfaceProfile);

    // 真实沙海：新月形沙丘群、干涸河床与绿洲焦点
    this.createBarchanDunes();
    this.createDesertWadi();
    this.createDesertOasis();
  }

  /** 沙漠地形高度采样：基于 worldscape 高度场（相对 -50 地面基准） */
  private sampleDesertGroundHeight(worldX: number, worldZ: number): number {
    return this.stageField ? this.stageField.heightAt(worldX, worldZ) : 0;
  }

  /** 新月形沙丘群：弯月状雕塑沙体，向阳面亮、滑落面暗的双色调 */
  private createBarchanDunes(): void {
    const tokens = this.designTokens;
    const sunlitMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.terrainAccent, 0, -0.02, 0),
      roughness: 0.97,
      metalness: 0,
      flatShading: true,
    });
    const slipfaceMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.terrainSecondary, 0, 0.02, -0.04),
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });

    const count = 14;
    for (let i = 0; i < count; i++) {
      const dune = new THREE.Group();
      dune.name = 'barchanDune';
      const radius = 36 + Math.random() * 40;
      const tube = radius * (0.36 + Math.random() * 0.14);

      // 向阳的弯月主体（半环）
      const body = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 7, 13, Math.PI),
        sunlitMaterial
      );
      body.rotation.x = -Math.PI / 2;
      body.scale.set(1, 0.85, 0.5); // 压扁成沙体
      dune.add(body);

      // 内侧滑落面：略小的暗色半环，贴在凹侧
      const slipface = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.82, tube * 0.78, 7, 13, Math.PI),
        slipfaceMaterial
      );
      slipface.rotation.x = -Math.PI / 2;
      slipface.scale.set(1, 0.85, 0.42);
      slipface.position.y = -tube * 0.12;
      dune.add(slipface);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 480 + Math.random() * 920;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      dune.position.set(x, -50 + this.sampleDesertGroundHeight(x, z) - tube * 0.35, z);
      dune.rotation.y = Math.random() * Math.PI * 2;
      // 拉伸/剪切，使沙丘体型各异
      dune.scale.set(1 + Math.random() * 0.7, 0.8 + Math.random() * 0.5, 1 + Math.random() * 0.4);
      this.terrainGroup.add(dune);
    }
  }

  /** 干涸河床（旱谷）：深色龟裂土质条带蜿蜒穿越地图 */
  private createDesertWadi(): void {
    const tokens = this.designTokens;
    const wadiColor = this.tintColor(tokens.terrainSecondary, 0.01, -0.12, -0.12);
    const wadiMaterial = new THREE.MeshStandardMaterial({
      color: wadiColor,
      roughness: 1,
      metalness: 0,
      map: this.createDetailTexture(
        wadiColor,
        this.tintColor(wadiColor, 0, 0.04, 0.06),
        this.tintColor(wadiColor, 0, 0.02, -0.1),
        'rock'
      ),
      depthWrite: false,
      transparent: true,
      opacity: 0.94,
    });

    const segments = 30;
    const startX = -1480;
    const endX = 1480;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const x0 = startX + (endX - startX) * t0;
      const x1 = startX + (endX - startX) * t1;
      const z0 = Math.sin(t0 * Math.PI * 2.4 + 0.8) * 420 - 180;
      const z1 = Math.sin(t1 * Math.PI * 2.4 + 0.8) * 420 - 180;

      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2;
      const length = Math.hypot(x1 - x0, z1 - z0) + 5;
      const width = 26 + Math.sin(t0 * Math.PI * 5) * 8;
      const groundHeight = Math.max(
        this.sampleDesertGroundHeight(x0, z0),
        this.sampleDesertGroundHeight(x1, z1)
      );

      const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, width), wadiMaterial);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = Math.atan2(-(z1 - z0), x1 - x0);
      strip.position.set(midX, -50 + groundHeight + 1.1, midZ);
      strip.renderOrder = 2;
      this.terrainGroup.add(strip);
    }
  }

  /** 绿洲焦点：小水塘、环绿带与一圈棕榈 */
  private createDesertOasis(): void {
    const tokens = this.designTokens;
    const oasisX = 520;
    const oasisZ = -360;
    const groundY = -50 + this.sampleDesertGroundHeight(oasisX, oasisZ);

    // 绿带（外圈植被环）
    const fringe = new THREE.Mesh(
      new THREE.CircleGeometry(54, 28),
      new THREE.MeshStandardMaterial({
        color: tokens.vegetation,
        roughness: 0.9,
        metalness: 0,
        emissive: this.tintColor(tokens.vegetation, 0, 0.1, -0.1),
        emissiveIntensity: 0.08,
        map: this.createDetailTexture(
          tokens.vegetation,
          tokens.vegetationAccent,
          this.tintColor(tokens.vegetation, 0, 0.05, -0.12),
          'grass'
        ),
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      })
    );
    fringe.rotation.x = -Math.PI / 2;
    fringe.position.set(oasisX, groundY + 0.3, oasisZ);
    fringe.renderOrder = 2;
    this.terrainGroup.add(fringe);

    // 水塘
    const pondShape = this.createIrregularShape({
      baseRadius: 27,
      radiusJitter: 5,
      pointCount: 36,
      wobbleFreqA: 2.4,
      wobbleFreqB: 4.6,
      phaseA: 1.2,
      phaseB: 0.4,
    });
    const pondMaterial = new THREE.MeshStandardMaterial({
      color: tokens.water,
      transparent: true,
      opacity: 0.9,
      roughness: 0.1,
      metalness: 0.32,
      depthWrite: false,
      emissive: this.tintColor(tokens.waterDeep, 0, 0.12, 0.04),
      emissiveIntensity: 0.24,
      map: this.createDetailTexture(tokens.water, tokens.waterSparkle, tokens.waterDeep, 'water'),
    });
    const pond = new THREE.Mesh(new THREE.ShapeGeometry(pondShape, 16), pondMaterial);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(oasisX, groundY + 0.55, oasisZ);
    pond.renderOrder = 3;
    this.terrainGroup.add(pond);
    this.animatedProps.push((_deltaTime, time) => {
      pondMaterial.map?.offset.set(time * 0.004, time * 0.0026);
    });

    // 五棵棕榈围绕水塘
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 32 + Math.random() * 14;
      const palm = this.createBeautifulPalmTree();
      palm.position.set(
        oasisX + Math.cos(angle) * radius,
        groundY,
        oasisZ + Math.sin(angle) * radius
      );
      palm.scale.setScalar(0.8 + Math.random() * 0.5);
      palm.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(palm);
      this.trees.push(palm);
    }
  }

  /**
   * 创建仙人掌
   */
  private createCacti(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;

      const cactus = this.createBeautifulCactus();
      cactus.position.set(x, -50 + this.sampleDesertGroundHeight(x, z) - 0.4, z);
      cactus.scale.setScalar(0.5 + Math.random() * 1);
      cactus.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(cactus);
    }
  }

  /**
   * 创建美丽的仙人掌
   */
  private createBeautifulCactus(): THREE.Group {
    const cactus = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.8,
    });

    // 主体
    const bodyHeight = 6 + Math.random() * 4;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, bodyHeight, 8), material);
    body.position.y = bodyHeight / 2;
    body.castShadow = true;
    cactus.add(body);

    // 添加手臂
    const armCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < armCount; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const armHeight = bodyHeight * (0.3 + Math.random() * 0.4);

      // 水平部分
      const armH = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 2 + Math.random() * 2, 8),
        material
      );
      armH.rotation.z = (Math.PI / 2) * side;
      armH.position.set(side * 1.5, armHeight, 0);
      armH.castShadow = true;
      cactus.add(armH);

      // 垂直部分
      const armV = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 2 + Math.random() * 2, 8),
        material
      );
      armV.position.set(side * 2.5, armHeight + 1, 0);
      armV.castShadow = true;
      cactus.add(armV);
    }

    // 添加花朵（可选）
    if (Math.random() > 0.6) {
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff69b4,
          emissive: 0xff69b4,
          emissiveIntensity: 0.2,
        })
      );
      flower.position.y = bodyHeight + 0.3;
      cactus.add(flower);
    }

    return cactus;
  }

  /**
   * 创建枯木
   */
  private createDeadTrees(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;

      const tree = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: 0x4a3c2a,
        roughness: 1,
      });

      // 主干
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.5, 5 + Math.random() * 3, 6),
        material
      );
      trunk.position.y = 2.5;
      trunk.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
      trunk.castShadow = true;
      tree.add(trunk);

      // 分支
      for (let j = 0; j < 3; j++) {
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.15, 2 + Math.random(), 6),
          material
        );
        branch.position.set((Math.random() - 0.5) * 0.5, 3 + j * 1.2, (Math.random() - 0.5) * 0.5);
        branch.rotation.set(
          (Math.random() - 0.5) * 1,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 1
        );
        branch.castShadow = true;
        tree.add(branch);
      }

      tree.position.set(x, -50 + this.sampleDesertGroundHeight(x, z) - 0.3, z);
      tree.scale.setScalar(0.5 + Math.random() * 0.5);
      this.terrainGroup.add(tree);
    }
  }

  /**
   * 生成山地地形
   */
  private generateMountainTerrain(config: LevelConfig): void {
    // worldscape 山脊多重分形高度场：谷地保留中央飞行空间，
    // 峰群向战场边缘聚拢，雪线以上由雪覆盖着色器染白（uSnowCover = 1）
    const field = new Heightfield(ALPINE_RIDGE_PRESET);
    this.stageField = field;
    const painter = new BiomePainter(field, {
      palette: ALPINE_BIOME_PALETTE,
      waterLevel: 0,
      snowLine: 34,
      lushHeightDivisor: 120,
    });
    const terrain = buildWorldTerrainMesh(field, painter, {
      size: 4000,
      segments: GameConfig.isMobile ? 180 : 256,
      snowUniform: this.worldscapeSnow,
      snowWorldY: { start: WORLDSCAPE_WATER_Y + 2, end: WORLDSCAPE_WATER_Y + 12 },
    });
    terrain.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(terrain);

    // 冰川蓝水面：高山冰湖与谷地溪潭
    this.worldWater = buildWorldscapeWater({
      size: 4000,
      grid: GameConfig.isMobile ? 112 : 160,
      depthAt: (x, z) => -field.heightAt(x, z),
      deepColor: 0x2f7c95,
      shallowColor: 0x8ed2e3,
      skyTint: 0xdde8f2,
      sunDir: this.getSunDirection(config),
      sunColor: config.lighting.sunColor,
      sunIntensity: Math.min(1.2, config.lighting.sunIntensity * 0.5),
    });
    this.worldWater.mesh.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(this.worldWater.mesh);

    // 雪线之下的松林、坡地碎石与覆雪草甸
    this.worldVegetation = buildVegetation(
      field,
      {
        seed: 20260613,
        half: 1970,
        snowLine: 34,
        pines: { count: this.scaleCount(2400), minHeight: 2, maxHeight: 58, maxSlope: 0.42 },
        rocks: { count: this.scaleCount(1100), minHeight: 1 },
        grass: { count: this.scaleCount(7000), minHeight: 1.5, maxHeight: 30, maxSlope: 0.3 },
        snowWorldY: { start: WORLDSCAPE_WATER_Y + 2, end: WORLDSCAPE_WATER_Y + 12 },
        rockTint: { r: 0.98, g: 1, b: 1.08 },
      },
      this.getWorldscapeUniforms()
    );
    this.worldVegetation.group.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(this.worldVegetation.group);

    // 高山动态元素：峰顶风吹雪旗（峰顶从高度场采样）、盘旋雄鹰
    this.createSnowBanners(this.findRidgePeaks(field, 8));
    this.createBirdFlock({
      centerX: 0,
      centerZ: -80,
      radius: 330,
      altitude: 132,
      count: 4,
      color: 0x2a2620,
      speed: 0.12,
      size: 3.6,
    });
  }

  /** 在高度场上网格采样，挑出彼此相距足够远的前 N 座峰顶（雪旗锚点） */
  private findRidgePeaks(
    field: Heightfield,
    count: number
  ): Array<{ x: number; z: number; topY: number }> {
    const candidates: Array<{ x: number; z: number; h: number }> = [];
    const step = 110;
    for (let x = -1850; x <= 1850; x += step) {
      for (let z = -1850; z <= 1850; z += step) {
        const h = field.heightAt(x, z);
        if (h > 60) candidates.push({ x, z, h });
      }
    }
    candidates.sort((a, b) => b.h - a.h);
    const peaks: Array<{ x: number; z: number; topY: number }> = [];
    for (const candidate of candidates) {
      if (peaks.length >= count) break;
      if (peaks.some((p) => Math.hypot(p.x - candidate.x, p.z - candidate.z) < 320)) continue;
      peaks.push({ x: candidate.x, z: candidate.z, topY: WORLDSCAPE_WATER_Y + candidate.h });
    }
    return peaks;
  }

  /**
   * 生成海洋地形
   */
  private generateOceanTerrain(config: LevelConfig): void {
    this.stageField = null;
    const tokens = this.designTokens;

    // 阳光海床：透过波浪着色器的半透明水体读出深海蓝（替代旧版深渊夜雾层）
    const seabed = new THREE.Mesh(
      new THREE.PlaneGeometry(4400, 4400),
      new THREE.MeshStandardMaterial({
        color: this.tintColor(tokens.waterDeep, 0, -0.05, -0.06),
        roughness: 1,
        metalness: 0,
      })
    );
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -66;
    this.terrainGroup.add(seabed);

    // 添加岛屿群（先放置，以便把岛屿浅滩烘焙进水深 → 岛缘绿松石浅水 + 浪沫环）
    const islandMounds = this.createOceanIslands();

    // worldshowcase 波浪着色器海面：明亮远洋晴昼调色板（深钴蓝 → 绿松石浅滩）
    this.worldWater = buildWorldscapeWater({
      size: 4400,
      grid: GameConfig.isMobile ? 144 : 200,
      depthAt: (x, z) => {
        let depth = 26;
        for (const mound of islandMounds) {
          const dx = x - mound.x;
          const dz = z - mound.z;
          const spread = mound.radius * 0.62;
          depth -= mound.height * Math.exp(-(dx * dx + dz * dz) / (2 * spread * spread));
        }
        return depth;
      },
      deepColor: tokens.waterDeep,
      shallowColor: 0x3f9ec6,
      skyTint: 0xd2e9f5,
      sunDir: this.getSunDirection(config),
      sunColor: config.lighting.sunColor,
      sunIntensity: Math.min(1.8, config.lighting.sunIntensity * 0.6),
    });
    this.worldWater.mesh.position.y = WORLDSCAPE_WATER_Y;
    this.terrainGroup.add(this.worldWater.mesh);

    // 远海动态元素：灯塔旋转光束、浪尖白沫、远航货轮、闪烁浮标
    this.createLighthouse();
    this.createOceanWhitecaps();
    this.createOceanShips();
    this.createOceanBuoys();
  }

  /**
   * 海上岛屿群：8-10 座小岛分布在 400-1900 半径（中心 300 内不放置），
   * 混合裸岩石柱、带棕榈的沙洲，以及一座残破石塔的遗迹岛。
   * 返回各岛的浅滩隆起参数，供波浪着色器烘焙岛缘浅水与浪沫环。
   */
  private createOceanIslands(): Array<{ x: number; z: number; radius: number; height: number }> {
    const islandMounds: Array<{ x: number; z: number; radius: number; height: number }> = [];
    // 灯塔礁（createLighthouse 固定放在 860,-780）也需要浅滩
    islandMounds.push({ x: 860, z: -780, radius: 46, height: 30 });
    const tokens = this.designTokens;
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structure, 0, -0.1, -0.06),
      roughness: 0.96,
      metalness: 0.04,
      flatShading: true,
      map: this.createDetailTexture(
        this.tintColor(tokens.structure, 0, -0.1, -0.06),
        tokens.structureAccent,
        this.tintColor(tokens.structure, 0, -0.05, -0.16),
        'rock'
      ),
    });
    const sandMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structureAccent, 0.02, 0.05, 0.08),
      roughness: 1,
      metalness: 0,
    });
    const vegetationMaterial = new THREE.MeshStandardMaterial({
      color: tokens.vegetation,
      roughness: 0.9,
      metalness: 0,
    });

    const islandCount = 9;
    for (let i = 0; i < islandCount; i++) {
      const angle = (i / islandCount) * Math.PI * 2 + Math.random() * 0.55;
      const radius = 400 + Math.random() * 1500;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const island = new THREE.Group();
      island.name = 'oceanIsland';

      if (i % 3 === 0) {
        // 裸岩石柱岛：错落的岩塔
        const stackCount = 2 + Math.floor(Math.random() * 3);
        for (let s = 0; s < stackCount; s++) {
          const stackHeight = 14 + Math.random() * 26;
          const stackRadius = 5 + Math.random() * 7;
          const stack = new THREE.Mesh(
            new THREE.CylinderGeometry(stackRadius * 0.55, stackRadius, stackHeight, 6),
            rockMaterial
          );
          stack.position.set(
            (Math.random() - 0.5) * 22,
            -50 + stackHeight / 2 - 3,
            (Math.random() - 0.5) * 22
          );
          stack.rotation.y = Math.random() * Math.PI;
          stack.rotation.z = (Math.random() - 0.5) * 0.12;
          stack.castShadow = true;
          island.add(stack);
        }
        const skirt = new THREE.Mesh(new THREE.ConeGeometry(26, 9, 7), rockMaterial);
        skirt.position.y = -48;
        island.add(skirt);
        islandMounds.push({ x, z, radius: 36, height: 30 });
      } else {
        // 沙洲岛：隆起的沙丘（高出风暴浪峰）+ 1-3 棵棕榈
        const caySize = 22 + Math.random() * 20;
        const cay = new THREE.Mesh(
          new THREE.SphereGeometry(caySize, 12, 8),
          sandMaterial
        );
        cay.scale.set(1, 0.3, 0.8 + Math.random() * 0.4);
        cay.position.y = -48;
        cay.rotation.y = Math.random() * Math.PI * 2;
        island.add(cay);

        const green = new THREE.Mesh(
          new THREE.SphereGeometry(caySize * 0.55, 10, 6),
          vegetationMaterial
        );
        green.scale.set(1, 0.3, 0.85);
        green.position.y = -47 + caySize * 0.12;
        island.add(green);
        islandMounds.push({ x, z, radius: caySize * 1.35, height: 30 });

        const palmBaseY = -48 + caySize * 0.3 * 0.72;
        const palmCount = 1 + Math.floor(Math.random() * 3);
        for (let p = 0; p < palmCount; p++) {
          const palm = this.createBeautifulPalmTree();
          palm.position.set(
            x + (Math.random() - 0.5) * caySize * 0.5,
            palmBaseY,
            z + (Math.random() - 0.5) * caySize * 0.45
          );
          palm.scale.setScalar(0.6 + Math.random() * 0.5);
          palm.rotation.y = Math.random() * Math.PI * 2;
          this.terrainGroup.add(palm);
          this.trees.push(palm);
        }
      }

      island.position.set(x, 0, z);
      this.terrainGroup.add(island);
    }

    // 遗迹岛：残破石塔
    const ruinAngle = Math.random() * Math.PI * 2;
    const ruinRadius = 700 + Math.random() * 600;
    const ruinX = Math.cos(ruinAngle) * ruinRadius;
    const ruinZ = Math.sin(ruinAngle) * ruinRadius;
    const ruinIsland = new THREE.Group();
    ruinIsland.name = 'ruinTowerIsland';

    const ruinBase = new THREE.Mesh(new THREE.ConeGeometry(34, 14, 8), rockMaterial);
    ruinBase.position.y = -47;
    ruinIsland.add(ruinBase);

    const towerHeight = 30;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 8, towerHeight, 9, 1, true),
      rockMaterial
    );
    tower.position.y = -42 + towerHeight / 2;
    tower.rotation.z = 0.05;
    ruinIsland.add(tower);

    // 断裂的塔顶：散落的石块
    for (let r = 0; r < 5; r++) {
      const debris = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4 + Math.random() * 2, 0), rockMaterial);
      debris.position.set(
        (Math.random() - 0.5) * 26,
        -44 + Math.random() * 3,
        (Math.random() - 0.5) * 26
      );
      debris.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      ruinIsland.add(debris);
    }

    ruinIsland.position.set(ruinX, 0, ruinZ);
    this.terrainGroup.add(ruinIsland);
    islandMounds.push({ x: ruinX, z: ruinZ, radius: 44, height: 30 });

    return islandMounds;
  }

  /**
   * 创建美丽的棕榈树
   */
  private createBeautifulPalmTree(): THREE.Group {
    const palm = new THREE.Group();

    // 弯曲树干
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 8, 8), trunkMaterial);
    trunk.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
    trunk.position.y = 4;
    trunk.castShadow = true;
    palm.add(trunk);

    // 棕榈叶
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 6), leafMaterial);
      leaf.position.set(0, 8, 0);
      leaf.rotation.set(Math.PI / 4, (i / 8) * Math.PI * 2, 0);
      palm.add(leaf);
    }

    // 椰子
    for (let i = 0; i < 3; i++) {
      const coconut = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x654321 })
      );
      coconut.position.set((Math.random() - 0.5) * 0.5, 7.5, (Math.random() - 0.5) * 0.5);
      palm.add(coconut);
    }

    return palm;
  }

  /**
   * 生成城市地形
   */
  private generateCityTerrain(config: LevelConfig): void {
    const surfaceProfile = this.getSurfaceProfile(config);
    // 地面
    const groundGeometry = new THREE.PlaneGeometry(4000, 4000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.groundBaseColor ?? this.tintColor(config.groundColor, 0.04, 0.12, 0.04),
      roughness: 0.72,
      metalness: 0,
      emissive: surfaceProfile.groundEmissiveColor ?? 0x242833,
      emissiveIntensity: 0.18,
      map: this.createDetailTexture(
        surfaceProfile.groundBaseColor ?? config.groundColor,
        surfaceProfile.groundAccentColor ?? 0x7d8798,
        surfaceProfile.groundDetailColor ?? 0x4e5664,
        'asphalt'
      ),
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    this.createCityBlocks(surfaceProfile);
    this.createRoads(surfaceProfile);

    // 高层建筑红色航空障碍灯共享材质，统一闪烁
    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4136,
      transparent: true,
      opacity: 0.9,
    });
    this.cityBeaconMaterial = beaconMaterial;
    this.animatedProps.push((_deltaTime, time) => {
      beaconMaterial.opacity = Math.sin(time * 2.4) > 0.2 ? 0.95 : 0.08;
    });

    // 添加建筑物：市中心摩天楼 → 中环办公楼 → 外环住宅的密度衰减布局
    this.createCityBuildings(surfaceProfile);

    // 夜景灯光与地表边界读图层
    this.createCityNightLights(surfaceProfile);
    this.createCitySurfaceBoundary(surfaceProfile);
    this.createCityGroundFill(surfaceProfile);

    // 中央公园、环城高架与废墟景观
    this.createCentralPark();
    this.createCityParkPlantings();
    this.createRingHighway();
    this.createCityRuins();
    this.createCityLandmarks();

    // 城市动态元素：扫天探照灯、道路车流光带、霓虹招牌
    this.createCitySearchlights();
    this.createCityTraffic();
    this.createCityNeonSigns();
  }

  /**
   * 城市公园植被：worldscape 草簇 + 阔叶树实例化散布在中央公园与街角绿地，
   * 草随风摇曳（windSway 注入），为钢城补一点生机。
   */
  private createCityParkPlantings(): void {
    const uniforms = this.getWorldscapeUniforms();
    const patches = [
      { x: 0, z: 0, radius: 235 }, // 中央公园（避开 62,-46 处的池塘）
      { x: -780, z: 540, radius: 90 },
      { x: 660, z: -700, radius: 80 },
      { x: 920, z: 480, radius: 70 },
    ];
    const pondX = 62;
    const pondZ = -46;
    const color = new THREE.Color();

    // 风吹草簇
    const grassMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    injectWindSway(grassMaterial, uniforms.time, uniforms.wind, 0.5, 1.0, 'city-grass');
    const grassCount = this.scaleCount(4200);
    const grassMesh = new THREE.InstancedMesh(
      grassTuftGeometry(0x3c5c34, 0x7da45a),
      grassMaterial,
      grassCount
    );
    grassMesh.frustumCulled = false;
    let placedGrass = 0;
    let guard = 0;
    while (placedGrass < grassCount && guard++ < grassCount * 6) {
      const patch = patches[placedGrass % patches.length];
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * patch.radius;
      const x = patch.x + Math.cos(angle) * r;
      const z = patch.z + Math.sin(angle) * r;
      if (Math.hypot(x - pondX, z - pondZ) < 78) continue;
      setScatterInstance(
        grassMesh,
        placedGrass,
        x,
        -49.0,
        z,
        Math.random() * Math.PI * 2,
        (0.7 + Math.random() * 0.9) * 1.9
      );
      color.setHSL(0.27 + Math.random() * 0.05, 0.4, 0.42 + Math.random() * 0.16);
      grassMesh.setColorAt(placedGrass, color);
      placedGrass++;
    }
    grassMesh.count = placedGrass;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    grassMesh.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(grassMesh);

    // 阔叶树团簇
    const leaf = leafTreeGeometries(() => Math.random());
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e5240,
      flatShading: true,
      roughness: 1,
    });
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    });
    injectWindSway(crownMaterial, uniforms.time, uniforms.wind, 0.22, 4.4, 'city-leaf');
    const treeCount = this.scaleCount(140);
    const trunks = new THREE.InstancedMesh(leaf.trunk, trunkMaterial, treeCount);
    const crowns = new THREE.InstancedMesh(leaf.foliage, crownMaterial, treeCount);
    trunks.frustumCulled = false;
    crowns.frustumCulled = false;
    let placedTrees = 0;
    guard = 0;
    while (placedTrees < treeCount && guard++ < treeCount * 8) {
      const patch = patches[placedTrees % patches.length];
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * Math.max(10, patch.radius - 8);
      const x = patch.x + Math.cos(angle) * r;
      const z = patch.z + Math.sin(angle) * r;
      if (Math.hypot(x - pondX, z - pondZ) < 84) continue;
      const rot = Math.random() * Math.PI * 2;
      const s = (0.9 + Math.random() * 0.8) * 1.7;
      setScatterInstance(trunks, placedTrees, x, -49.05, z, rot, s);
      setScatterInstance(crowns, placedTrees, x, -49.05, z, rot, s);
      color.setHSL(0.3 + Math.random() * 0.06, 0.4, 0.3 + Math.random() * 0.1);
      crowns.setColorAt(placedTrees, color);
      placedTrees++;
    }
    trunks.count = placedTrees;
    crowns.count = placedTrees;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(trunks);
    this.terrainGroup.add(crowns);
  }

  /**
   * 创建城市地表补光层
   */
  private createCityGroundFill(surfaceProfile: LevelSurfaceProfile): void {
    const ambientCore = this.tintColor(
      surfaceProfile.groundEmissiveColor ?? 0x293744,
      0.01,
      0.08,
      0.13
    );
    const ambientEdge = this.tintColor(surfaceProfile.plazaBaseColor ?? 0x808a98, -0.01, 0.12, 0.04);

    const ambientFill = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({
        color: ambientCore,
        transparent: true,
        opacity: 0.24,
        roughness: 0.9,
        metalness: 0.02,
        emissive: ambientCore,
        emissiveIntensity: 0.42,
        side: THREE.DoubleSide,
      })
    );
    ambientFill.rotation.x = -Math.PI / 2;
    ambientFill.position.set(0, -49.58, 0);
    ambientFill.renderOrder = 3;
    ambientFill.receiveShadow = true;
    this.terrainGroup.add(ambientFill);

    const contourMaterial = new THREE.MeshStandardMaterial({
      color: ambientEdge,
      transparent: true,
      opacity: 0.16,
      roughness: 0.88,
      metalness: 0.05,
      emissive: this.tintColor(ambientEdge, 0.03, 0.2, -0.04),
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });

    const contourHeights = [-49.56, -49.535, -49.51];
    const contourWidths = [4000, 3280, 2560];
    const contourHeightsLength = [260, 336, 410];
    for (let i = 0; i < contourHeights.length; i++) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(contourWidths[i], contourHeightsLength[i]),
        contourMaterial
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, contourHeights[i], -220 + i * 190);
      strip.renderOrder = 4;
      strip.receiveShadow = true;
      this.terrainGroup.add(strip);
    }
  }

  /**
   * 创建道路
   */
  private createRoads(surfaceProfile: LevelSurfaceProfile): void {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.roadBaseColor ?? 0x566072,
      roughness: 0.78,
      emissive: 0x1f2530,
      emissiveIntensity: 0.12,
      map: this.createDetailTexture(
        surfaceProfile.roadBaseColor ?? 0x566072,
        surfaceProfile.roadAccentColor ?? 0x8590a2,
        surfaceProfile.roadDetailColor ?? 0x39414f,
        'asphalt'
      ),
    });
    const corridorCoreColor = this.tintColor(
      surfaceProfile.roadLineColor ?? 0xffd88a,
      0.01,
      0.22,
      0.08
    );
    const corridorCoreMaterial = new THREE.MeshStandardMaterial({
      color: corridorCoreColor,
      transparent: true,
      opacity: 0.22,
      roughness: 0.24,
      metalness: 0.08,
      emissive: this.tintColor(corridorCoreColor, 0.02, 0.28, 0.08),
      emissiveIntensity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const corridorSideMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(corridorCoreColor, -0.02, 0.18, 0.2),
      transparent: true,
      opacity: 0.16,
      roughness: 0.22,
      metalness: 0.12,
      emissive: this.tintColor(corridorCoreColor, 0.02, 0.26, 0.12),
      emissiveIntensity: 0.74,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const roadExtent = this.halfExtent * 2; // 道路总长：覆盖整个 ±halfExtent 战场

    // 水平道路
    for (let i = -6; i <= 6; i++) {
      const corridor = new THREE.Mesh(new THREE.PlaneGeometry(roadExtent, 26), corridorCoreMaterial);
      corridor.rotation.x = -Math.PI / 2;
      corridor.position.set(0, -49.64, i * 250);
      this.terrainGroup.add(corridor);

      for (let j = -1; j <= 1; j += 2) {
        const sideRibbon = new THREE.Mesh(
          new THREE.PlaneGeometry(roadExtent, 3.4),
          corridorSideMaterial
        );
        sideRibbon.rotation.x = -Math.PI / 2;
        sideRibbon.position.set(0, -49.6, i * 250 + j * 13);
        this.terrainGroup.add(sideRibbon);
      }

      const road = new THREE.Mesh(new THREE.PlaneGeometry(roadExtent, 20), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, -49.9, i * 250);
      this.terrainGroup.add(road);
    }

    // 道路标线（实例化：13 条横向道路 × 59 段虚线）
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.roadLineColor ?? 0xf0f4ff,
      emissive: 0x9eb2d6,
      emissiveIntensity: 0.14,
    });
    const dashPerRoad = 59;
    const dashes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(15, 1),
      lineMaterial,
      13 * dashPerRoad
    );
    const dashDummy = new THREE.Object3D();
    let dashIndex = 0;
    for (let i = -6; i <= 6; i++) {
      for (let j = -29; j <= 29; j++) {
        dashDummy.position.set(j * 50, -49.8, i * 250);
        dashDummy.rotation.set(-Math.PI / 2, 0, 0);
        dashDummy.updateMatrix();
        dashes.setMatrixAt(dashIndex++, dashDummy.matrix);
      }
    }
    dashes.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(dashes);

    // 路口暖光（实例化）
    const roadLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd997,
      emissive: 0xffc56b,
      emissiveIntensity: 0.46,
      roughness: 0.24,
      metalness: 0.1,
    });
    const roadLights = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(5, 1.4),
      roadLightMaterial,
      13 * 13
    );
    let lightIndex = 0;
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        dashDummy.position.set(j * 250, -49.76, i * 250 + 8);
        dashDummy.rotation.set(-Math.PI / 2, 0, 0);
        dashDummy.updateMatrix();
        roadLights.setMatrixAt(lightIndex++, dashDummy.matrix);
      }
    }
    roadLights.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(roadLights);

    // 垂直道路
    for (let i = -6; i <= 6; i++) {
      const corridor = new THREE.Mesh(new THREE.PlaneGeometry(26, roadExtent), corridorCoreMaterial);
      corridor.rotation.x = -Math.PI / 2;
      corridor.position.set(i * 250, -49.64, 0);
      this.terrainGroup.add(corridor);

      for (let j = -1; j <= 1; j += 2) {
        const sideRibbon = new THREE.Mesh(
          new THREE.PlaneGeometry(3.4, roadExtent),
          corridorSideMaterial
        );
        sideRibbon.rotation.x = -Math.PI / 2;
        sideRibbon.position.set(i * 250 + j * 13, -49.6, 0);
        this.terrainGroup.add(sideRibbon);
      }

      const road = new THREE.Mesh(new THREE.PlaneGeometry(20, roadExtent), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(i * 250, -49.9, 0);
      this.terrainGroup.add(road);
    }
  }

  private createCityBlocks(surfaceProfile: LevelSurfaceProfile): void {
    const plazaMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.plazaBaseColor ?? 0x808a98,
      roughness: 0.82,
      metalness: 0.04,
      emissive: 0x2b313a,
      emissiveIntensity: 0.1,
      map: this.createDetailTexture(
        surfaceProfile.plazaBaseColor ?? 0x808a98,
        surfaceProfile.plazaAccentColor ?? 0xaab3bf,
        surfaceProfile.plazaDetailColor ?? 0x616976,
        'asphalt'
      ),
    });

    const basePadMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.buildingBaseColor ?? 0x6e8196,
      roughness: 0.74,
      metalness: 0.08,
      emissive: 0x232a34,
      emissiveIntensity: 0.1,
    });
    const plazaGlowMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(surfaceProfile.plazaBaseColor ?? 0x808a98, 0.04, 0.18, 0.08),
      emissive: this.tintColor(surfaceProfile.plazaBaseColor ?? 0x808a98, 0.04, 0.2, 0.14),
      emissiveIntensity: 0.28,
      roughness: 0.36,
      metalness: 0.06,
      transparent: true,
      opacity: 0.12,
    });

    const gridMin = -6;
    const gridMax = 5;
    const gridSpan = gridMax - gridMin + 1;
    const blockCount = gridSpan * gridSpan;

    const plazas = new THREE.InstancedMesh(new THREE.PlaneGeometry(190, 190), plazaMaterial, blockCount);
    const basePads = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(162, 162),
      basePadMaterial,
      blockCount
    );
    const plazaLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd595,
      emissive: 0xffc266,
      emissiveIntensity: 0.42,
      roughness: 0.26,
      metalness: 0.08,
    });
    const litBlockCount = Math.ceil(blockCount / 2);
    const plazaLights = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(26, 4),
      plazaLightMaterial,
      litBlockCount
    );
    const plazaRibbons = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(30, 2.4),
      plazaGlowMaterial,
      litBlockCount
    );

    const dummy = new THREE.Object3D();
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    let blockIndex = 0;
    let litIndex = 0;
    for (let gx = gridMin; gx <= gridMax; gx++) {
      for (let gz = gridMin; gz <= gridMax; gz++) {
        const cx = gx * 250 + 125;
        const cz = gz * 250 + 125;

        dummy.position.set(cx, -49.92, cz);
        dummy.updateMatrix();
        plazas.setMatrixAt(blockIndex, dummy.matrix);

        dummy.position.set(cx, -49.86, cz);
        dummy.updateMatrix();
        basePads.setMatrixAt(blockIndex, dummy.matrix);
        blockIndex++;

        if ((gx + gz) % 2 === 0 && litIndex < litBlockCount) {
          dummy.position.set(cx, -49.8, gz * 250 + 50);
          dummy.updateMatrix();
          plazaLights.setMatrixAt(litIndex, dummy.matrix);

          dummy.position.set(cx, -49.72, gz * 250 - 30);
          dummy.updateMatrix();
          plazaRibbons.setMatrixAt(litIndex, dummy.matrix);
          litIndex++;
        }
      }
    }
    plazaLights.count = litIndex;
    plazaRibbons.count = litIndex;
    plazas.instanceMatrix.needsUpdate = true;
    basePads.instanceMatrix.needsUpdate = true;
    plazaLights.instanceMatrix.needsUpdate = true;
    plazaRibbons.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(plazas);
    this.terrainGroup.add(basePads);
    this.terrainGroup.add(plazaLights);
    this.terrainGroup.add(plazaRibbons);
  }

  /**
   * 城市建筑布局：距中心 < 400 为摩天楼区，400-900 为中层办公/宿舍区，
   * > 900 为沿街排布的坡顶住宅，中央 ~500×500 留作中央公园。
   */
  private createCityBuildings(surfaceProfile: LevelSurfaceProfile): void {
    const tokens = this.designTokens;
    const parkHalf = 250;

    // 共享的密集窗格贴图（3 张随机点亮率不同的贴图，循环使用）
    const windowColor = surfaceProfile.windowColor ?? tokens.waterSparkle;
    const facadeMaterials: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const texture = this.createWindowGridTexture(
        this.tintColor(surfaceProfile.buildingBaseColor ?? tokens.structure, 0, -0.06, -0.16),
        windowColor,
        6,
        18,
        0.42 + i * 0.16
      );
      facadeMaterials.push(
        new THREE.MeshStandardMaterial({
          color: 0x222831,
          map: texture,
          emissive: 0xffffff,
          emissiveMap: texture,
          emissiveIntensity: 0.62,
          roughness: 0.4,
          metalness: 0.2,
        })
      );
    }

    // 市中心摩天楼（60-150 高，阶梯收分塔楼）
    const skyscraperCount = this.scaleCount(56);
    let placed = 0;
    let attempts = 0;
    while (placed < skyscraperCount && attempts < skyscraperCount * 30) {
      attempts++;
      const gx = Math.floor(Math.random() * 4) - 2; // 内圈街区
      const gz = Math.floor(Math.random() * 4) - 2;
      const x = gx * 250 + 125 + (Math.random() - 0.5) * 120;
      const z = gz * 250 + 125 + (Math.random() - 0.5) * 120;
      if (Math.abs(x) < parkHalf && Math.abs(z) < parkHalf) continue;
      if (Math.hypot(x, z) >= 400) continue;

      const skyscraper = this.createSkyscraper(surfaceProfile, facadeMaterials, 60 + Math.random() * 90);
      skyscraper.position.set(x, -50, z);
      skyscraper.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      this.terrainGroup.add(skyscraper);
      placed++;
    }

    // 中环中层建筑（25-60 高，重复窗带）
    const midriseCount = this.scaleCount(84);
    placed = 0;
    attempts = 0;
    while (placed < midriseCount && attempts < midriseCount * 30) {
      attempts++;
      const gx = Math.floor(Math.random() * 8) - 4;
      const gz = Math.floor(Math.random() * 8) - 4;
      const x = gx * 250 + 125 + (Math.random() - 0.5) * 130;
      const z = gz * 250 + 125 + (Math.random() - 0.5) * 130;
      const distance = Math.hypot(x, z);
      if (distance < 400 || distance > 900) continue;

      const midrise = this.createMidriseBuilding(surfaceProfile, 25 + Math.random() * 35);
      midrise.position.set(x, -50, z);
      midrise.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      this.terrainGroup.add(midrise);
      placed++;
    }

    // 外环住宅排屋（5-9 高坡顶小屋，沿街实例化）
    this.createResidentialDistricts();
  }

  /** 密集窗格贴图：摩天楼立面共享纹理 */
  private createWindowGridTexture(
    baseColor: THREE.ColorRepresentation,
    windowColor: THREE.ColorRepresentation,
    columns: number,
    rows: number,
    litRatio: number
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = this.toCanvasColor(baseColor);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cellWidth = canvas.width / columns;
      const cellHeight = canvas.height / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const lit = Math.random() < litRatio;
          ctx.fillStyle = lit
            ? this.toCanvasColor(windowColor, 0.75 + Math.random() * 0.25)
            : this.toCanvasColor(windowColor, 0.06 + Math.random() * 0.08);
          ctx.fillRect(
            col * cellWidth + cellWidth * 0.22,
            row * cellHeight + cellHeight * 0.2,
            cellWidth * 0.56,
            cellHeight * 0.5
          );
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /** 摩天楼：阶梯收分塔身 + 密集窗格立面 + 塔尖/天线群/屋顶水箱 */
  private createSkyscraper(
    surfaceProfile: LevelSurfaceProfile,
    facadeMaterials: THREE.MeshStandardMaterial[],
    height: number
  ): THREE.Group {
    const building = new THREE.Group();
    const tokens = this.designTokens;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(surfaceProfile.buildingBaseColor ?? tokens.structure).offsetHSL(
        (Math.random() - 0.5) * 0.02,
        -0.02 + Math.random() * 0.04,
        -0.1 + Math.random() * 0.14
      ),
      roughness: 0.42,
      metalness: 0.22,
      emissive: 0x10131a,
      emissiveIntensity: 0.06,
    });

    const baseWidth = 17 + Math.random() * 13;
    const baseDepth = 17 + Math.random() * 13;
    const tierRatios = [0.58, 0.3, 0.12];
    const tierShrink = [1, 0.76, 0.55];
    let tierBaseY = 0;

    for (let tier = 0; tier < 3; tier++) {
      const tierHeight = height * tierRatios[tier];
      const tierWidth = baseWidth * tierShrink[tier];
      const tierDepth = baseDepth * tierShrink[tier];

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(tierWidth, tierHeight, tierDepth),
        bodyMaterial
      );
      body.position.y = tierBaseY + tierHeight / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      building.add(body);

      // 前两级塔身四面贴密集窗格
      if (tier < 2) {
        const facadeMaterial = facadeMaterials[Math.floor(Math.random() * facadeMaterials.length)];
        const faces = [
          { x: 0, z: tierDepth / 2 + 0.06, rotY: 0, w: tierWidth },
          { x: 0, z: -tierDepth / 2 - 0.06, rotY: Math.PI, w: tierWidth },
          { x: tierWidth / 2 + 0.06, z: 0, rotY: Math.PI / 2, w: tierDepth },
          { x: -tierWidth / 2 - 0.06, z: 0, rotY: -Math.PI / 2, w: tierDepth },
        ];
        for (const face of faces) {
          const facade = new THREE.Mesh(
            new THREE.PlaneGeometry(face.w * 0.92, tierHeight * 0.94),
            facadeMaterial
          );
          facade.position.set(face.x, tierBaseY + tierHeight / 2, face.z);
          facade.rotation.y = face.rotY;
          building.add(facade);
        }
      }

      tierBaseY += tierHeight;
    }

    // 塔尖
    if (Math.random() > 0.4) {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 1.1, 9 + Math.random() * 9, 6),
        bodyMaterial
      );
      spire.position.y = height + 5;
      building.add(spire);
    }

    // 天线群
    if (Math.random() > 0.45) {
      const antennaMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.6,
        metalness: 0.4,
      });
      const antennaCount = 2 + Math.floor(Math.random() * 2);
      for (let a = 0; a < antennaCount; a++) {
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 4 + Math.random() * 5, 6),
          antennaMaterial
        );
        antenna.position.set(
          (Math.random() - 0.5) * baseWidth * 0.4,
          height + 2.6,
          (Math.random() - 0.5) * baseDepth * 0.4
        );
        building.add(antenna);
      }
    }

    // 屋顶水箱（中间层顶部）
    if (Math.random() > 0.5) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.7, 1.7, 3.2, 9),
        new THREE.MeshStandardMaterial({
          color: this.tintColor(tokens.structureAccent, 0, -0.12, -0.1),
          roughness: 0.7,
          metalness: 0.3,
        })
      );
      tank.position.set(
        baseWidth * 0.18,
        height * (tierRatios[0] + tierRatios[1]) + 1.6,
        -baseDepth * 0.16
      );
      building.add(tank);
    }

    // 底层光带
    const glowColor = this.tintColor(tokens.glow, 0.01, 0.1, 0.06);
    const baseGlow = new THREE.Mesh(
      new THREE.BoxGeometry(baseWidth + 0.2, 0.6, baseDepth + 0.2),
      new THREE.MeshStandardMaterial({
        color: this.tintColor(glowColor, -0.02, -0.05, 0.06),
        emissive: glowColor,
        emissiveIntensity: 0.78,
        roughness: 0.22,
        metalness: 0.28,
        transparent: true,
        opacity: 0.75,
      })
    );
    baseGlow.position.y = 0.3;
    building.add(baseGlow);

    // 高层建筑顶部红色航空障碍灯（共享材质统一闪烁）
    if (this.cityBeaconMaterial && height > 52) {
      const beaconMast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x6a7280, roughness: 0.6, metalness: 0.4 })
      );
      beaconMast.position.y = height + 1.7;
      building.add(beaconMast);

      const aviationBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 8, 8),
        this.cityBeaconMaterial
      );
      aviationBeacon.position.y = height + 3.6;
      building.add(aviationBeacon);
    }

    return building;
  }

  /** 中层建筑：宿舍/办公体块 + 重复横向窗带 */
  private createMidriseBuilding(
    surfaceProfile: LevelSurfaceProfile,
    height: number
  ): THREE.Group {
    const building = new THREE.Group();
    const tokens = this.designTokens;
    const width = 13 + Math.random() * 12;
    const depth = 11 + Math.random() * 10;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(surfaceProfile.buildingBaseColor ?? tokens.structure).offsetHSL(
        (Math.random() - 0.5) * 0.015,
        -0.03 + Math.random() * 0.04,
        -0.05 + Math.random() * 0.1
      ),
      roughness: 0.55,
      metalness: 0.12,
      emissive: 0x10131a,
      emissiveIntensity: 0.05,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterial);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);

    // 重复窗带：每隔一层一条横贯的发光带
    const stripColor = surfaceProfile.windowColor ?? tokens.glow;
    const stripMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(stripColor, 0, -0.15, -0.08),
      emissive: stripColor,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.1,
    });
    const stripCount = Math.max(2, Math.floor(height / 8));
    for (let s = 0; s < stripCount; s++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.12, 1.1, depth + 0.12),
        stripMaterial
      );
      strip.position.y = 4 + s * (height - 6) / stripCount;
      building.add(strip);
    }

    // 屋顶设备体块
    if (Math.random() > 0.4) {
      const rooftop = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.32, 2.2, depth * 0.32),
        bodyMaterial
      );
      rooftop.position.y = height + 1.1;
      building.add(rooftop);
    }

    // 高于 52 的中层建筑同样挂航空障碍灯
    if (this.cityBeaconMaterial && height > 52) {
      const aviationBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 8, 8),
        this.cityBeaconMaterial
      );
      aviationBeacon.position.y = height + 2.2;
      building.add(aviationBeacon);
    }

    return building;
  }

  /** 外环住宅区：沿街排布的坡顶小屋，4 种实例化变体 */
  private createResidentialDistricts(): void {
    const tokens = this.designTokens;
    const variants = [
      { width: 9, depth: 11, height: 5, roofHeight: 2.6 },
      { width: 10, depth: 12, height: 6.5, roofHeight: 3 },
      { width: 8.5, depth: 10, height: 7.5, roofHeight: 2.8 },
      { width: 11, depth: 13, height: 9, roofHeight: 3.4 },
    ];
    const matricesByVariant: THREE.Matrix4[][] = [[], [], [], []];
    const dummy = new THREE.Object3D();
    const target = this.scaleCount(140);
    let placed = 0;

    // 沿横向道路两侧排布
    for (let i = -6; i <= 6 && placed < target; i++) {
      const roadZ = i * 250;
      for (let side = -1; side <= 1 && placed < target; side += 2) {
        const z = roadZ + side * 26;
        for (let x = -1450; x <= 1450 && placed < target; x += 52) {
          if (Math.hypot(x, z) <= 920) continue;
          if (Math.random() > 0.4) continue;
          dummy.position.set(x + (Math.random() - 0.5) * 8, -50, z + (Math.random() - 0.5) * 5);
          dummy.rotation.set(0, side > 0 ? Math.PI : 0, 0);
          dummy.scale.setScalar(0.9 + Math.random() * 0.3);
          dummy.updateMatrix();
          matricesByVariant[Math.floor(Math.random() * variants.length)].push(dummy.matrix.clone());
          placed++;
        }
      }
    }
    // 沿纵向道路两侧补足
    for (let i = -6; i <= 6 && placed < target; i++) {
      const roadX = i * 250;
      for (let side = -1; side <= 1 && placed < target; side += 2) {
        const x = roadX + side * 26;
        for (let z = -1450; z <= 1450 && placed < target; z += 52) {
          if (Math.hypot(x, z) <= 920) continue;
          if (Math.random() > 0.3) continue;
          dummy.position.set(x + (Math.random() - 0.5) * 5, -50, z + (Math.random() - 0.5) * 8);
          dummy.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
          dummy.scale.setScalar(0.9 + Math.random() * 0.3);
          dummy.updateMatrix();
          matricesByVariant[Math.floor(Math.random() * variants.length)].push(dummy.matrix.clone());
          placed++;
        }
      }
    }

    for (let v = 0; v < variants.length; v++) {
      const matrices = matricesByVariant[v];
      if (matrices.length === 0) continue;
      const variant = variants[v];

      const bodyGeometry = new THREE.BoxGeometry(variant.width, variant.height, variant.depth);
      bodyGeometry.translate(0, variant.height / 2, 0);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(tokens.structure).offsetHSL(0, 0, -0.04 + v * 0.03),
        roughness: 0.7,
        metalness: 0.06,
        emissive: this.tintColor(tokens.glow, 0, -0.2, -0.32),
        emissiveIntensity: 0.12,
      });
      const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, matrices.length);

      const roofGeometry = this.createPitchedRoofGeometry(
        variant.width + 1.2,
        variant.depth + 1,
        variant.roofHeight
      );
      roofGeometry.translate(0, variant.height, 0);
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: this.tintColor(tokens.structureAccent, 0, -0.05, -0.14 + v * 0.02),
        roughness: 0.85,
        metalness: 0.04,
      });
      const roofs = new THREE.InstancedMesh(roofGeometry, roofMaterial, matrices.length);

      for (let m = 0; m < matrices.length; m++) {
        bodies.setMatrixAt(m, matrices[m]);
        roofs.setMatrixAt(m, matrices[m]);
      }
      bodies.instanceMatrix.needsUpdate = true;
      roofs.instanceMatrix.needsUpdate = true;
      bodies.castShadow = true;
      this.terrainGroup.add(bodies);
      this.terrainGroup.add(roofs);
    }
  }

  /** 中央公园：草坪、池塘、蜿蜒光路、实例化树木与发光路灯 */
  private createCentralPark(): void {
    const tokens = this.designTokens;

    // 草坪（覆盖中央 500×500，盖住穿过的道路光带）
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({
        color: tokens.vegetation,
        roughness: 0.92,
        metalness: 0,
        emissive: this.tintColor(tokens.vegetation, 0, 0.06, -0.12),
        emissiveIntensity: 0.1,
        map: this.createDetailTexture(
          tokens.vegetation,
          tokens.vegetationAccent,
          this.tintColor(tokens.vegetation, 0, 0.04, -0.14),
          'grass'
        ),
      })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, -49.05, 0);
    lawn.renderOrder = 6;
    lawn.receiveShadow = true;
    this.terrainGroup.add(lawn);

    // 公园池塘
    const pondShape = this.createIrregularShape({
      baseRadius: 52,
      radiusJitter: 9,
      pointCount: 44,
      wobbleFreqA: 2.8,
      wobbleFreqB: 4.4,
      phaseA: 0.5,
      phaseB: 1.1,
    });
    const pondMaterial = new THREE.MeshStandardMaterial({
      color: tokens.water,
      transparent: true,
      opacity: 0.9,
      roughness: 0.12,
      metalness: 0.3,
      depthWrite: false,
      emissive: this.tintColor(tokens.waterDeep, 0, 0.12, 0.05),
      emissiveIntensity: 0.22,
      map: this.createDetailTexture(tokens.water, tokens.waterSparkle, tokens.waterDeep, 'water'),
    });
    const pond = new THREE.Mesh(new THREE.ShapeGeometry(pondShape, 16), pondMaterial);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(62, -48.95, -46);
    pond.renderOrder = 7;
    this.terrainGroup.add(pond);
    this.animatedProps.push((_deltaTime, time) => {
      pondMaterial.map?.offset.set(time * 0.0042, time * 0.0028);
    });

    // 蜿蜒光路：S 形发光小径
    const pathMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.glow, 0, -0.2, -0.05),
      emissive: tokens.glow,
      emissiveIntensity: 0.34,
      roughness: 0.5,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const pathSegments = 16;
    const lampSpots: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < pathSegments; i++) {
      const t0 = i / pathSegments;
      const t1 = (i + 1) / pathSegments;
      const x0 = -225 + 450 * t0;
      const x1 = -225 + 450 * t1;
      const z0 = Math.sin(t0 * Math.PI * 2.2) * 130;
      const z1 = Math.sin(t1 * Math.PI * 2.2) * 130;
      const length = Math.hypot(x1 - x0, z1 - z0) + 2;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, 4.2), pathMaterial);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = Math.atan2(-(z1 - z0), x1 - x0);
      strip.position.set((x0 + x1) / 2, -48.98, (z0 + z1) / 2);
      strip.renderOrder = 7;
      this.terrainGroup.add(strip);
      if (i % 2 === 0) {
        lampSpots.push({ x: x0, z: z0 + 8 });
      }
    }

    // 实例化公园树木（约 60 棵：树干 + 树冠两个实例网格）
    const treeCount = this.scaleCount(60);
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4.6, 6);
    trunkGeometry.translate(0, 2.3, 0);
    const trunks = new THREE.InstancedMesh(
      trunkGeometry,
      new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }),
      treeCount
    );
    const crownGeometry = new THREE.ConeGeometry(3.4, 8.5, 7);
    crownGeometry.translate(0, 8, 0);
    const crowns = new THREE.InstancedMesh(
      crownGeometry,
      new THREE.MeshStandardMaterial({
        color: tokens.vegetationAccent,
        roughness: 0.85,
        metalness: 0,
      }),
      treeCount
    );
    const treeDummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      let x = (Math.random() - 0.5) * 460;
      let z = (Math.random() - 0.5) * 460;
      // 避开池塘
      if (Math.hypot(x - 62, z + 46) < 75) {
        x = -120 - Math.random() * 90;
        z = 80 + Math.random() * 90;
      }
      treeDummy.position.set(x, -49.05, z);
      treeDummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      treeDummy.scale.setScalar(0.75 + Math.random() * 0.7);
      treeDummy.updateMatrix();
      trunks.setMatrixAt(i, treeDummy.matrix);
      crowns.setMatrixAt(i, treeDummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(trunks);
    this.terrainGroup.add(crowns);

    // 实例化发光路灯
    const lampCount = lampSpots.length;
    const poleGeometry = new THREE.CylinderGeometry(0.14, 0.18, 5, 5);
    poleGeometry.translate(0, 2.5, 0);
    const poles = new THREE.InstancedMesh(
      poleGeometry,
      new THREE.MeshStandardMaterial({ color: 0x3a414c, roughness: 0.6, metalness: 0.4 }),
      lampCount
    );
    const headGeometry = new THREE.SphereGeometry(0.55, 8, 8);
    headGeometry.translate(0, 5.2, 0);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: tokens.glow,
      emissive: tokens.glow,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0,
    });
    const heads = new THREE.InstancedMesh(headGeometry, headMaterial, lampCount);
    for (let i = 0; i < lampCount; i++) {
      treeDummy.position.set(lampSpots[i].x, -49.05, lampSpots[i].z);
      treeDummy.rotation.set(0, 0, 0);
      treeDummy.scale.setScalar(1);
      treeDummy.updateMatrix();
      poles.setMatrixAt(i, treeDummy.matrix);
      heads.setMatrixAt(i, treeDummy.matrix);
    }
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(poles);
    this.terrainGroup.add(heads);
  }

  /** 环城高架：半径 ~900 的环形高架桥，含护栏、支撑柱与环行车流光带 */
  private createRingHighway(): void {
    const tokens = this.designTokens;
    const ringRadius = 900;
    const deckTopY = -50 + 22;
    const segments = 20;

    const deckMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structure, 0, -0.15, -0.1),
      roughness: 0.66,
      metalness: 0.18,
      emissive: 0x171c24,
      emissiveIntensity: 0.1,
    });
    const railMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structureAccent, 0, -0.1, -0.04),
      roughness: 0.5,
      metalness: 0.3,
    });

    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = Math.cos(a0) * ringRadius;
      const z0 = Math.sin(a0) * ringRadius;
      const x1 = Math.cos(a1) * ringRadius;
      const z1 = Math.sin(a1) * ringRadius;
      const length = Math.hypot(x1 - x0, z1 - z0) + 3;

      const segment = new THREE.Group();
      segment.position.set((x0 + x1) / 2, deckTopY - 0.7, (z0 + z1) / 2);
      segment.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 1.4, 26), deckMaterial);
      segment.add(deck);

      for (let side = -1; side <= 1; side += 2) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 1.2, 0.4), railMaterial);
        rail.position.set(0, 1.3, side * 12.6);
        segment.add(rail);
      }
      this.terrainGroup.add(segment);
    }

    // 支撑柱（每 ~80 米一根，实例化）
    const pillarCount = Math.floor((Math.PI * 2 * ringRadius) / 80);
    const pillarHeight = deckTopY - 1.4 - -50;
    const pillarGeometry = new THREE.CylinderGeometry(1.7, 2.1, pillarHeight, 8);
    pillarGeometry.translate(0, pillarHeight / 2, 0);
    const pillars = new THREE.InstancedMesh(pillarGeometry, deckMaterial, pillarCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * ringRadius, -50, Math.sin(angle) * ringRadius);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
    }
    pillars.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(pillars);

    // 护栏立柱（实例化，每 ~24 米）
    const postCount = Math.floor((Math.PI * 2 * ringRadius) / 24);
    const postGeometry = new THREE.BoxGeometry(0.24, 1.4, 0.24);
    postGeometry.translate(0, 0.7, 0);
    const posts = new THREE.InstancedMesh(postGeometry, railMaterial, postCount * 2);
    let postIndex = 0;
    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      for (let side = -1; side <= 1; side += 2) {
        const radius = ringRadius + side * 12.6;
        dummy.position.set(Math.cos(angle) * radius, deckTopY, Math.sin(angle) * radius);
        dummy.rotation.set(0, -angle, 0);
        dummy.updateMatrix();
        posts.setMatrixAt(postIndex++, dummy.matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(posts);

    // 高架车流：白色车头灯顺时针、红色车尾灯逆时针，沿环线循环
    const carGeometry = new THREE.PlaneGeometry(3.6, 1.7);
    carGeometry.rotateX(-Math.PI / 2);
    const streams = [
      { color: 0xfff1c4, laneRadius: ringRadius + 5.6, speed: 0.075 },
      { color: 0xff4632, laneRadius: ringRadius - 5.6, speed: -0.062 },
    ];
    for (const stream of streams) {
      const count = this.scaleCount(26);
      const material = new THREE.MeshBasicMaterial({
        color: stream.color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      });
      const cars = new THREE.InstancedMesh(carGeometry, material, count);
      cars.frustumCulled = false;
      const angles = new Float32Array(count);
      const speeds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        angles[i] = Math.random() * Math.PI * 2;
        speeds[i] = stream.speed * (0.8 + Math.random() * 0.5);
      }
      const carDummy = new THREE.Object3D();
      this.terrainGroup.add(cars);

      this.animatedProps.push((deltaTime) => {
        for (let i = 0; i < count; i++) {
          angles[i] += speeds[i] * deltaTime;
          const x = Math.cos(angles[i]) * stream.laneRadius;
          const z = Math.sin(angles[i]) * stream.laneRadius;
          carDummy.position.set(x, deckTopY + 0.75, z);
          carDummy.rotation.set(0, -angles[i] - Math.PI / 2, 0);
          carDummy.scale.setScalar(1);
          carDummy.updateMatrix();
          cars.setMatrixAt(i, carDummy.matrix);
        }
        cars.instanceMatrix.needsUpdate = true;
      });
    }
  }

  /** 废墟风貌：倒塌/倾斜建筑、瓦砾堆、弹坑环与城市外缘起伏丘陵 */
  private createCityRuins(): void {
    const tokens = this.designTokens;
    const ruinMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.terrainSecondary, 0, -0.08, -0.04),
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });

    // 倒塌/倾斜建筑：错位堆叠体块 + 倾斜旋转
    const collapsedCount = 9;
    for (let i = 0; i < collapsedCount; i++) {
      const angle = (i / collapsedCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 430 + Math.random() * 440;
      const ruin = new THREE.Group();
      ruin.name = 'collapsedBuilding';

      const floors = 2 + Math.floor(Math.random() * 3);
      const width = 11 + Math.random() * 9;
      const depth = 10 + Math.random() * 8;
      let stackY = 0;
      for (let f = 0; f < floors; f++) {
        const floorHeight = 6 + Math.random() * 5;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(
            width * (1 - f * 0.08),
            floorHeight,
            depth * (1 - f * 0.06)
          ),
          ruinMaterial
        );
        block.position.set(
          (Math.random() - 0.5) * 3 * f,
          stackY + floorHeight / 2,
          (Math.random() - 0.5) * 3 * f
        );
        block.rotation.y = (Math.random() - 0.5) * 0.3 * f;
        block.castShadow = true;
        ruin.add(block);
        stackY += floorHeight * (0.86 + Math.random() * 0.1);
      }

      ruin.position.set(Math.cos(angle) * radius, -50, Math.sin(angle) * radius);
      ruin.rotation.z = (Math.random() - 0.5) * 0.22;
      ruin.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(ruin);
    }

    // 瓦砾堆：实例化十二面体碎块，聚簇分布
    const rubbleCount = this.scaleCount(90);
    const rubble = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.6, 0),
      ruinMaterial,
      rubbleCount
    );
    const dummy = new THREE.Object3D();
    const clusterCount = 12;
    for (let i = 0; i < rubbleCount; i++) {
      const cluster = i % clusterCount;
      const clusterAngle = (cluster / clusterCount) * Math.PI * 2 + 0.4;
      const clusterRadius = 380 + (cluster % 4) * 160;
      const cx = Math.cos(clusterAngle) * clusterRadius;
      const cz = Math.sin(clusterAngle) * clusterRadius;
      dummy.position.set(
        cx + (Math.random() - 0.5) * 26,
        -50 + Math.random() * 1.2,
        cz + (Math.random() - 0.5) * 26
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.setScalar(0.5 + Math.random() * 1.6);
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(rubble);

    // 弹坑环丘
    const craterSpots = [
      { x: -640, z: 520, radius: 34 },
      { x: 560, z: -640, radius: 26 },
    ];
    for (const spot of craterSpots) {
      const crater = new THREE.Mesh(
        new THREE.TorusGeometry(spot.radius, spot.radius * 0.22, 7, 18),
        ruinMaterial
      );
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(spot.x, -50 + spot.radius * 0.05, spot.z);
      this.terrainGroup.add(crater);
    }

    // 城市外缘起伏丘陵（1550-2100）
    const hillCount = 10;
    const hillMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tokens.terrainSecondary).lerp(
        new THREE.Color(tokens.distantSilhouette),
        0.45
      ),
      roughness: 0.96,
      metalness: 0,
    });
    const hills = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), hillMaterial, hillCount);
    for (let i = 0; i < hillCount; i++) {
      const angle = (i / hillCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 1550 + Math.random() * 550;
      const hillRadius = 130 + Math.random() * 150;
      dummy.position.set(Math.cos(angle) * radius, -54, Math.sin(angle) * radius);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(
        hillRadius,
        hillRadius * (0.14 + Math.random() * 0.1),
        hillRadius * (0.7 + Math.random() * 0.5)
      );
      dummy.updateMatrix();
      hills.setMatrixAt(i, dummy.matrix);
    }
    hills.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(hills);
  }

  /** 城市地标：塔吊、水塔与低矮体育场 */
  private createCityLandmarks(): void {
    const tokens = this.designTokens;
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(tokens.structureAccent, 0.02, 0.1, -0.06),
      roughness: 0.55,
      metalness: 0.4,
    });

    // 塔吊（T 形剪影 + 闪烁警示灯）
    const craneSpots = [
      { x: 620, z: 180, height: 64, jib: 42, yaw: 0.6 },
      { x: -540, z: 660, height: 78, jib: 50, yaw: 2.2 },
      { x: 300, z: -700, height: 58, jib: 38, yaw: 4.1 },
    ];
    for (const spot of craneSpots) {
      const crane = new THREE.Group();
      crane.name = 'constructionCrane';

      const mast = new THREE.Mesh(new THREE.BoxGeometry(2.2, spot.height, 2.2), steelMaterial);
      mast.position.y = spot.height / 2;
      crane.add(mast);

      const jib = new THREE.Mesh(new THREE.BoxGeometry(spot.jib, 1.6, 2), steelMaterial);
      jib.position.set(spot.jib * 0.32, spot.height + 0.8, 0);
      crane.add(jib);

      const counterJib = new THREE.Mesh(new THREE.BoxGeometry(spot.jib * 0.36, 1.6, 2), steelMaterial);
      counterJib.position.set(-spot.jib * 0.26, spot.height + 0.8, 0);
      crane.add(counterJib);

      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 16, 4), steelMaterial);
      cable.position.set(spot.jib * 0.62, spot.height - 8, 0);
      crane.add(cable);

      const blinkMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5540,
        transparent: true,
        opacity: 0.9,
      });
      const warningLight = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), blinkMaterial);
      warningLight.position.y = spot.height + 2.4;
      crane.add(warningLight);

      const phase = Math.random() * Math.PI * 2;
      this.animatedProps.push((_deltaTime, time) => {
        blinkMaterial.opacity = Math.sin(time * 1.9 + phase) > 0.3 ? 0.92 : 0.06;
      });

      crane.position.set(spot.x, -50, spot.z);
      crane.rotation.y = spot.yaw;
      this.terrainGroup.add(crane);
    }

    // 水塔
    const waterTower = new THREE.Group();
    waterTower.name = 'waterTower';
    for (let leg = 0; leg < 4; leg++) {
      const legAngle = (leg / 4) * Math.PI * 2 + Math.PI / 4;
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 26, 6), steelMaterial);
      legMesh.position.set(Math.cos(legAngle) * 4.4, 13, Math.sin(legAngle) * 4.4);
      legMesh.rotation.z = Math.cos(legAngle) * 0.1;
      legMesh.rotation.x = -Math.sin(legAngle) * 0.1;
      waterTower.add(legMesh);
    }
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 5.4, 9, 10),
      new THREE.MeshStandardMaterial({
        color: this.tintColor(tokens.structure, 0.01, 0, 0.05),
        roughness: 0.6,
        metalness: 0.25,
      })
    );
    tank.position.y = 30;
    waterTower.add(tank);
    const tankCap = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.4, 10), steelMaterial);
    tankCap.position.y = 36;
    waterTower.add(tankCap);
    waterTower.position.set(-820, -50, -380);
    this.terrainGroup.add(waterTower);

    // 低矮体育场：环形碗体 + 顶缘灯带
    const stadium = new THREE.Group();
    stadium.name = 'stadium';
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(68, 54, 18, 22, 1, true),
      new THREE.MeshStandardMaterial({
        color: this.tintColor(tokens.structure, 0, -0.06, -0.02),
        roughness: 0.62,
        metalness: 0.2,
        side: THREE.DoubleSide,
      })
    );
    bowl.position.y = 9;
    stadium.add(bowl);

    const field = new THREE.Mesh(
      new THREE.CircleGeometry(46, 22),
      new THREE.MeshStandardMaterial({
        color: tokens.vegetation,
        roughness: 0.9,
        metalness: 0,
        emissive: this.tintColor(tokens.vegetation, 0, 0.1, -0.08),
        emissiveIntensity: 0.18,
      })
    );
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0.6;
    stadium.add(field);

    const rimLightMaterial = new THREE.MeshBasicMaterial({
      color: tokens.glow,
      transparent: true,
      opacity: 0.8,
      toneMapped: false,
    });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(67, 0.8, 5, 26), rimLightMaterial);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 18.4;
    stadium.add(rim);
    this.animatedProps.push((_deltaTime, time) => {
      rimLightMaterial.opacity = 0.66 + Math.sin(time * 1.1) * 0.18;
    });

    stadium.position.set(1080, -50, 640);
    this.terrainGroup.add(stadium);
  }

  /**
   * 创建天空渐变
   */
  private createSky(colors: [string, string, string, string], profile: WeatherProfile): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.3, colors[1]);
    gradient.addColorStop(0.6, colors[2]);
    gradient.addColorStop(1, colors[3]);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const presetOverlay = WEATHER_PRESET_OVERLAYS[profile.type];

    ctx.fillStyle = this.toCanvasColor(
      presetOverlay.overlayColor,
      presetOverlay.overlayAlpha + profile.intensity * 0.06
    );
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.18,
      40,
      canvas.width * 0.5,
      canvas.height * 0.18,
      canvas.width * 0.34
    );
    glow.addColorStop(0, this.toCanvasColor(profile.skyGlow, 0.28));
    glow.addColorStop(0.3, this.toCanvasColor(profile.skyGlow, 0.1));
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const haze = ctx.createLinearGradient(0, canvas.height * 0.45, 0, canvas.height);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(
      1,
      this.toCanvasColor(
        presetOverlay.overlayColor,
        presetOverlay.horizonAlpha + profile.intensity * 0.08
      )
    );
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const veilCount = 5 + Math.floor(profile.intensity * 5) + Math.floor(presetOverlay.streakBoost * 0.08);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < veilCount; i++) {
      const clusterCenterX = canvas.width * (0.08 + Math.random() * 0.84);
      const clusterCenterY = canvas.height * (0.12 + Math.random() * 0.42);
      const clusterWidth = canvas.width * (0.16 + Math.random() * 0.22);
      const clusterHeight = 24 + Math.random() * 42;
      const clusterAlpha = 0.012 + Math.random() * 0.016;
      const puffCount = 3 + Math.floor(Math.random() * 3);

      for (let puffIndex = 0; puffIndex < puffCount; puffIndex++) {
        const offsetX = (Math.random() - 0.5) * clusterWidth * 0.7;
        const offsetY = (Math.random() - 0.5) * clusterHeight * 1.3;
        const radiusX = clusterWidth * (0.45 + Math.random() * 0.35);
        const radiusY = clusterHeight * (0.45 + Math.random() * 0.55);
        const alpha = clusterAlpha * (0.85 + Math.random() * 0.45);
        const centerX = clusterCenterX + offsetX;
        const centerY = clusterCenterY + offsetY;

        const veil = ctx.createRadialGradient(
          centerX,
          centerY,
          radiusY * 0.12,
          centerX,
          centerY,
          radiusX
        );
        veil.addColorStop(0, this.toCanvasColor(profile.cloudTint, alpha));
        veil.addColorStop(0.35, this.toCanvasColor(profile.cloudTint, alpha * 0.78));
        veil.addColorStop(0.72, this.toCanvasColor(profile.cloudTint, alpha * 0.24));
        veil.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = veil;
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          radiusX,
          radiusY,
          (Math.random() - 0.5) * 0.22,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    const hazeClusterCount = 4 + Math.floor(profile.intensity * 4);
    for (let i = 0; i < hazeClusterCount; i++) {
      const centerX = canvas.width * (0.12 + Math.random() * 0.76);
      const centerY = canvas.height * (0.18 + Math.random() * 0.34);
      const radiusX = canvas.width * (0.22 + Math.random() * 0.18);
      const radiusY = 28 + Math.random() * 34;
      const alpha = 0.01 + Math.random() * 0.014;
      const mist = ctx.createRadialGradient(centerX, centerY, radiusY * 0.15, centerX, centerY, radiusX);
      mist.addColorStop(0, this.toCanvasColor(profile.skyGlow, alpha));
      mist.addColorStop(0.4, this.toCanvasColor(profile.cloudTint, alpha * 0.75));
      mist.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = mist;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, (Math.random() - 0.5) * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = texture;
  }

  /**
   * 创建云朵
   */
  private createClouds(profile: WeatherProfile): void {
    // worldscape 实例化积云场：合并球体云团 × 变体实例化，
    // 随风持续漂移 + 环绕回卷 + 垂直浮沉 + 天气色调调制 —— 云永远在动
    this.cloudField = new CloudField({
      seed: 4242,
      variants: 5,
      perVariant: Math.max(6, this.scaleCount(28)),
      fieldSize: 4800,
      altitudeMin: profile.cloudHeightMin,
      altitudeMax: profile.cloudHeightMax,
      tint: profile.cloudTint,
      scaleMultiplier: 2.3,
      opacity: THREE.MathUtils.clamp(profile.cloudOpacity + 0.2, 0.55, 0.95),
    });
    this.terrainGroup.add(this.cloudField.group);
    // 初始铺排：先推进一帧，让云在第一帧就出现在天上而非从零浮现
    this.cloudField.update(
      4,
      0,
      this.weatherProfile.cloudCoverage,
      this.weatherProfile.cloudTone,
      this.weatherProfile.windAngle,
      0
    );
  }

  /** 云漂移速度（米/秒）：关卡 cloudSpeed 基线 + 风力加成 */
  private getCloudWindSpeed(): number {
    return 5 + this.weatherProfile.cloudSpeed * 2.2 + this.weatherProfile.windStrength * 12;
  }

  /** 高空卷云层：大尺寸半透明水平面片，极缓慢漂移 */
  private createCirrusLayer(profile: WeatherProfile): void {
    const count = Math.max(4, this.scaleCount(8 + Math.round(profile.intensity * 6)));
    const cirrusMaterial = new THREE.MeshBasicMaterial({
      color: profile.cloudTint,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      map: this.createSoftCircleTexture(),
    });

    const sheets: THREE.Mesh[] = [];
    const driftSpeeds = new Float32Array(count);
    const windX = Math.cos(profile.windAngle);
    const windZ = Math.sin(profile.windAngle);

    for (let i = 0; i < count; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cirrusMaterial);
      sheet.rotation.x = -Math.PI / 2;
      sheet.rotation.z = Math.random() * Math.PI * 2;
      sheet.position.set(
        (Math.random() - 0.5) * 4000,
        480 + Math.random() * 80,
        (Math.random() - 0.5) * 4000
      );
      const scale = 300 + Math.random() * 200;
      sheet.scale.set(scale, scale * (0.5 + Math.random() * 0.4), 1);
      sheet.renderOrder = 8;
      this.terrainGroup.add(sheet);
      sheets.push(sheet);
      driftSpeeds[i] = 1.2 + Math.random() * 1.6;
    }

    this.animatedProps.push((deltaTime, time) => {
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        sheet.position.x += windX * driftSpeeds[i] * deltaTime;
        sheet.position.z += windZ * driftSpeeds[i] * deltaTime;
        if (sheet.position.x > 2400) sheet.position.x = -2400;
        if (sheet.position.x < -2400) sheet.position.x = 2400;
        if (sheet.position.z > 2400) sheet.position.z = -2400;
        if (sheet.position.z < -2400) sheet.position.z = 2400;
      }
      cirrusMaterial.opacity = 0.08 + Math.sin(time * 0.13) * 0.025;
    });
  }

  /**
   * 创建轻量天气粒子
   */
  private createWeatherEffect(profile: WeatherProfile): void {
    if (profile.particleCount <= 0) {
      return;
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(profile.particleCount * 3);

    for (let i = 0; i < profile.particleCount; i++) {
      const offset = i * 3;
      positions[offset] = (Math.random() - 0.5) * this.weatherParticleSpread;
      positions[offset + 1] = 40 + Math.random() * this.weatherParticleBaseHeight;
      positions[offset + 2] = (Math.random() - 0.5) * this.weatherParticleSpread;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: profile.particleColor,
      size: profile.particleSize,
      map: this.createSoftCircleTexture(),
      alphaTest: 0.02,
      transparent: true,
      opacity: this.getParticleBaseOpacity(profile),
      depthWrite: false,
    });

    this.weatherParticles = new THREE.Points(geometry, material);
    this.weatherParticles.position.y = -20;
    this.terrainGroup.add(this.weatherParticles);
  }

  /**
   * 更新水面动画
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;

    if (this.waterMesh && this.waterMesh.geometry) {
      // 水面波动
      const positions = this.waterMesh.geometry.attributes.position;
      const waveScale = this.weatherProfile.waterWaveScale;

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        // 四个叠加波段：主波 + 斜向次波 + 横向涌浪 + 短碎浪
        // 注意：sampleWaterWave() 必须与此公式完全一致（几何局部 y = -世界 z）
        const wave =
          (Math.sin(x * 0.05 + this.time * (1 + this.weatherProfile.intensity * 0.25)) *
            Math.cos(y * 0.05 + this.time * 0.7) +
            Math.sin(x * 0.03 - this.time * 0.6) * 0.4 +
            Math.sin(y * 0.02 + this.time * 0.5) * 0.8 +
            Math.sin((x + y) * 0.085 - this.time * 1.7) * 0.25) *
          waveScale;
        positions.setZ(i, wave);
      }
      positions.needsUpdate = true;

      const waterMaterial = this.waterMesh.material;
      if (waterMaterial instanceof THREE.MeshStandardMaterial) {
        const shimmer =
          Math.sin(this.time * (0.9 + this.weatherProfile.intensity * 0.4)) * 0.5 + 0.5;
        const waterResponse = this.getWaterVisualResponse(this.weatherProfile);
        waterMaterial.emissiveIntensity =
          waterResponse.baseEmissive
          + shimmer * waterResponse.emissiveAmplitude
          + this.weatherProfile.intensity * 0.04;
        waterMaterial.opacity = THREE.MathUtils.clamp(
          waterResponse.baseOpacity + shimmer * waterResponse.opacityAmplitude,
          0.78,
          0.97
        );
        waterMaterial.roughness = waterResponse.roughness;
        waterMaterial.metalness = waterResponse.metalness;

        // 水面细节纹理缓慢漂移，增加真实流动感
        if (waterMaterial.map) {
          waterMaterial.map.offset.set(this.time * 0.0045, this.time * 0.0028);
        }
      }
    }

    // worldscape 世界系统：着色器时间（草木摇曳）、波浪水面、漂移积云场
    this.worldscapeTime.value = this.time;
    this.worldWater?.update(this.time);
    if (this.cloudField) {
      const stormSag = this.weatherProfile.type === 'storm' ? 0.55 : 0;
      this.cloudField.update(
        deltaTime,
        this.time,
        this.weatherProfile.cloudCoverage,
        this.weatherProfile.cloudTone,
        this.weatherProfile.windAngle,
        this.getCloudWindSpeed(),
        stormSag
      );
    }

    if (this.weatherParticles) {
      const positions = this.weatherParticles.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const index = i * 3;
        const y = positions.array[index + 1] as number;
        const x = positions.array[index] as number;
        const z = positions.array[index + 2] as number;

        positions.array[index] = x + deltaTime * this.weatherProfile.particleDrift;
        positions.array[index + 1] = y - deltaTime * this.weatherProfile.particleSpeed;
        positions.array[index + 2] =
          z + deltaTime * Math.sin(this.time * 0.7 + i * 0.31) * this.weatherProfile.intensity * 1.5;

        if ((positions.array[index + 1] as number) < this.weatherParticleFloor) {
          // 以玩家最近位置为中心重生，保证飞到战场边缘时天气粒子不会"耗尽"
          positions.array[index] =
            this.lastPlayerPosition.x + (Math.random() - 0.5) * this.weatherParticleSpread;
          positions.array[index + 1] = 60 + Math.random() * this.weatherParticleBaseHeight;
          positions.array[index + 2] =
            this.lastPlayerPosition.z + (Math.random() - 0.5) * this.weatherParticleSpread;
        }
      }
      positions.needsUpdate = true;

      if (this.weatherParticles.material instanceof THREE.PointsMaterial) {
        this.weatherParticles.material.opacity = THREE.MathUtils.clamp(
          this.getParticleBaseOpacity(this.weatherProfile) + Math.sin(this.time * 0.6) * 0.03,
          0.12,
          0.72
        );
      }
    }

    // 驱动关卡级动态元素（飞鸟、尘卷风、探照灯、雷暴、车流等）
    for (const animate of this.animatedProps) {
      animate(deltaTime, this.time);
    }
  }

  /**
   * 更新地形 LOD - 根据玩家距离隐藏远处树木和岩石
   */
  public updateLOD(playerPosition: THREE.Vector3): void {
    const LOD_FAR = 600;

    // 记录玩家位置：天气粒子/雨幕重生时以此为中心（任务："天气跟随玩家"）
    this.lastPlayerPosition.copy(playerPosition);

    for (const tree of this.trees) {
      const distance = playerPosition.distanceTo(tree.position);
      tree.visible = distance <= LOD_FAR;
    }

    for (const rock of this.rocks) {
      const distance = playerPosition.distanceTo(rock.position);
      rock.visible = distance <= LOD_FAR;
    }
  }

  /**
   * 清除地形
   */
  public clearTerrain(): void {
    const childrenCount = this.terrainGroup.children.length;
    log.debug('clearTerrain: Starting', { childrenCount });

    // 立即清空 waterMesh 引用（避免 update() 访问旧对象）
    this.waterMesh = undefined;

    // worldscape 世界系统：显式释放实例化云场/波浪水面/植被的几何与材质
    if (this.cloudField) {
      this.terrainGroup.remove(this.cloudField.group);
      this.cloudField.dispose();
      this.cloudField = null;
    }
    if (this.worldWater) {
      this.terrainGroup.remove(this.worldWater.mesh);
      this.worldWater.dispose();
      this.worldWater = null;
    }
    if (this.worldVegetation) {
      this.terrainGroup.remove(this.worldVegetation.group);
      this.worldVegetation.dispose();
      this.worldVegetation = null;
    }
    this.stageField = null;

    // 清理天空纹理
    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
      this.scene.background = null;
    }

    // 清理雾
    this.scene.fog = null;

    // 清理 terrainGroup 的所有子对象
    while (this.terrainGroup.children.length > 0) {
      const child = this.terrainGroup.children[0];
      this.terrainGroup.remove(child);

      // 清理 Mesh（InstancedMesh 额外释放实例矩阵缓冲）
      if (child instanceof THREE.Mesh) {
        if (child instanceof THREE.InstancedMesh) {
          child.dispose();
        }
        this.disposeRenderable(child.geometry, child.material);
      }
      // 清理天气粒子
      else if (child instanceof THREE.Points) {
        this.disposeRenderable(child.geometry, child.material);
      }
      // 清理线状对象（雨幕、闪电）
      else if (child instanceof THREE.Line) {
        this.disposeRenderable(child.geometry, child.material);
      }
      // 清理精灵（太阳/月亮光晕）
      else if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
      // 清理 Group（树木、云朵等）
      else if (child instanceof THREE.Group) {
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (obj instanceof THREE.InstancedMesh) {
              obj.dispose();
            }
            this.disposeRenderable(obj.geometry, obj.material);
          } else if (obj instanceof THREE.Line) {
            this.disposeRenderable(obj.geometry, obj.material);
          } else if (obj instanceof THREE.Sprite) {
            const spriteMaterial = obj.material;
            if (Array.isArray(spriteMaterial)) {
              for (const material of spriteMaterial) {
                material.dispose();
              }
            } else {
              spriteMaterial.map?.dispose();
              spriteMaterial.dispose();
            }
          } else if (obj instanceof THREE.InstancedMesh) {
            this.disposeRenderable(obj.geometry, obj.material);
          } else if (obj instanceof THREE.Points) {
            this.disposeRenderable(obj.geometry, obj.material);
          }
        });
      }
    }

    this.trees = [];
    this.waterMesh = undefined;
    this.rocks = [];
    this.weatherParticles = undefined;
    this.animatedProps = [];
    this.cityBeaconMaterial = undefined;

    log.debug('clearTerrain: Complete', { remainingChildren: this.terrainGroup.children.length });
  }

  // =========================================================================
  // 真实感增强层：天体、强天气、各关卡专属动态环境元素
  // =========================================================================

  /** 按设备性能缩放装饰元素数量 */
  private scaleCount(count: number): number {
    return Math.max(1, Math.round(count * this.detailScale));
  }

  /** 柔和圆形粒子贴图，让点粒子呈现真实的雪花/尘埃/雾滴形态 */
  private createSoftCircleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * 战场软边界雾墙：开口圆筒贴垂直渐变透明纹理，背面渲染、不写深度，
   * 读作远方的地平线雾霭而非一堵墙；附带极缓慢的旋转。
   */
  private createPerimeterHaze(): void {
    const tokens = this.designTokens;

    // 垂直渐变 alpha 画布（alphaMap 读取绿色通道，用灰度表达透明度）：上下边缘透明、中带最浓
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgb(0,0,0)');
      gradient.addColorStop(0.3, 'rgb(140,140,140)');
      gradient.addColorStop(0.62, 'rgb(255,255,255)');
      gradient.addColorStop(0.88, 'rgb(178,178,178)');
      gradient.addColorStop(1, 'rgb(0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const alphaTexture = new THREE.CanvasTexture(canvas);

    const hazeMaterial = new THREE.MeshBasicMaterial({
      color: tokens.horizonHaze,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      alphaMap: alphaTexture,
    });
    const hazeWall = new THREE.Mesh(
      new THREE.CylinderGeometry(this.halfExtent, this.halfExtent, 360, 48, 1, true),
      hazeMaterial
    );
    hazeWall.name = 'perimeterHaze';
    hazeWall.position.set(0, -50 + 150, 0);
    hazeWall.renderOrder = 9;
    hazeWall.frustumCulled = false;
    this.terrainGroup.add(hazeWall);

    this.animatedProps.push((deltaTime) => {
      hazeWall.rotation.y += deltaTime * 0.004;
    });
  }

  /** 太阳/月亮光晕贴图 */
  private createGlowSpriteTexture(
    core: THREE.ColorRepresentation,
    glow: THREE.ColorRepresentation,
    coreRadius: number
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, this.toCanvasColor(core, 1));
      gradient.addColorStop(coreRadius, this.toCanvasColor(glow, 0.85));
      gradient.addColorStop(Math.min(1, coreRadius * 2.4), this.toCanvasColor(glow, 0.28));
      gradient.addColorStop(1, this.toCanvasColor(glow, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /** 取天空中段渐变色的线性亮度，判断昼夜 */
  private getSkyLuminance(config: LevelConfig): number {
    const color = new THREE.Color(config.skyColors[2]);
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  }

  /**
   * 天体层：白天悬挂可见太阳盘与光晕，夜晚悬挂月亮，并在昏暗天空铺设星空。
   */
  private createCelestialLayer(config: LevelConfig, profile: WeatherProfile): void {
    const celestial = new THREE.Group();
    celestial.name = 'celestialLayer';

    const sunPosition = config.lighting.sunPosition;
    const direction = new THREE.Vector3(sunPosition.x, sunPosition.y, sunPosition.z);
    if (direction.lengthSq() < 1e-6) {
      direction.set(0.4, 1, 0.2);
    }
    direction.normalize();

    const skyLuminance = this.getSkyLuminance(config);
    const isNight = skyLuminance < 0.1;

    if (isNight) {
      const moonMaterial = new THREE.SpriteMaterial({
        map: this.createGlowSpriteTexture(0xfdfdff, 0xc9d8ee, 0.3),
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      });
      const moon = new THREE.Sprite(moonMaterial);
      moon.position.copy(direction).multiplyScalar(2600);
      moon.position.y = Math.max(moon.position.y, 640);
      moon.scale.setScalar(260);
      celestial.add(moon);
    } else {
      const sunMaterial = new THREE.SpriteMaterial({
        map: this.createGlowSpriteTexture(0xffffff, profile.skyGlow, 0.14),
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      });
      const sun = new THREE.Sprite(sunMaterial);
      sun.position.copy(direction).multiplyScalar(2600);
      sun.position.y = Math.max(sun.position.y, 500);
      sun.scale.setScalar(profile.type === 'dust' ? 520 : 440);
      celestial.add(sun);
    }

    if (skyLuminance < 0.25) {
      const starCount = this.scaleCount(isNight ? 420 : 170);
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(0.15 + Math.random() * 0.8);
        const radius = 2700;
        starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = Math.max(120, radius * Math.cos(phi));
        starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const baseOpacity = isNight ? 0.85 : 0.42;
      const starMaterial = new THREE.PointsMaterial({
        color: 0xf4f8ff,
        size: isNight ? 4.7 : 3.6,
        map: this.createSoftCircleTexture(),
        alphaTest: 0.02,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      });
      const stars = new THREE.Points(starGeometry, starMaterial);
      stars.frustumCulled = false;
      celestial.add(stars);

      // 星光闪烁
      this.animatedProps.push((_deltaTime, time) => {
        starMaterial.opacity = baseOpacity + Math.sin(time * 1.3) * 0.12;
      });
    }

    this.terrainGroup.add(celestial);
  }

  /**
   * 暴雨雨幕：带风向倾斜的高速雨丝（线段），仅在风暴/降雨天气启用。
   */
  private createPrecipitationStreaks(profile: WeatherProfile): void {
    if (profile.type !== 'storm' && profile.type !== 'rain') {
      return;
    }

    const count = this.scaleCount(Math.max(150, Math.round(profile.particleCount * 1.1)));
    const positions = new Float32Array(count * 6);
    const headX = new Float32Array(count);
    const headY = new Float32Array(count);
    const headZ = new Float32Array(count);
    const lengths = new Float32Array(count);
    const speeds = new Float32Array(count);
    const windX = profile.particleDrift * 5;

    for (let i = 0; i < count; i++) {
      headX[i] = (Math.random() - 0.5) * 1500;
      headY[i] = -30 + Math.random() * 340;
      headZ[i] = (Math.random() - 0.5) * 1500;
      lengths[i] = 6 + Math.random() * 7;
      speeds[i] = 95 + Math.random() * 60;
    }

    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);

    const material = new THREE.LineBasicMaterial({
      color: 0xa9c7e8,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const streaks = new THREE.LineSegments(geometry, material);
    streaks.frustumCulled = false;
    this.terrainGroup.add(streaks);

    this.animatedProps.push((deltaTime) => {
      const centerX = this.lastPlayerPosition.x;
      const centerZ = this.lastPlayerPosition.z;
      for (let i = 0; i < count; i++) {
        headY[i] -= speeds[i] * deltaTime;
        headX[i] += windX * deltaTime;
        if (headX[i] > centerX + 900) headX[i] -= 1800;
        if (headX[i] < centerX - 900) headX[i] += 1800;
        if (headY[i] < -48) {
          // 以玩家最近位置为中心重生雨丝，雨幕跟随玩家覆盖
          headY[i] = 240 + Math.random() * 120;
          headX[i] = centerX + (Math.random() - 0.5) * 1500;
          headZ[i] = centerZ + (Math.random() - 0.5) * 1500;
        }

        // 雨丝沿下落方向（含风偏）伸展
        const fallMagnitude = Math.hypot(windX, speeds[i]);
        const tailX = headX[i] + (windX / fallMagnitude) * lengths[i];
        const tailY = headY[i] - (speeds[i] / fallMagnitude) * lengths[i];
        const offset = i * 6;
        positions[offset] = headX[i];
        positions[offset + 1] = headY[i];
        positions[offset + 2] = headZ[i];
        positions[offset + 3] = tailX;
        positions[offset + 4] = tailY;
        positions[offset + 5] = headZ[i];
      }
      attribute.needsUpdate = true;
    });
  }

  /**
   * 雷暴系统：随机间隔生成锯齿状闪电主干，配合点光源照亮海面与云层。
   */
  private setupLightningStorm(profile: WeatherProfile): void {
    if (profile.type !== 'storm') {
      return;
    }

    const flashLight = new THREE.PointLight(0xd9e8ff, 0, 4800, 2);
    flashLight.position.set(0, 300, 0);
    this.terrainGroup.add(flashLight);

    const maxPoints = 26;
    const boltGeometry = new THREE.BufferGeometry();
    const boltAttribute = new THREE.BufferAttribute(new Float32Array(maxPoints * 3), 3);
    boltAttribute.setUsage(THREE.DynamicDrawUsage);
    boltGeometry.setAttribute('position', boltAttribute);
    boltGeometry.setDrawRange(0, 0);
    const boltMaterial = new THREE.LineBasicMaterial({
      color: 0xeaf4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const bolt = new THREE.Line(boltGeometry, boltMaterial);
    bolt.visible = false;
    bolt.frustumCulled = false;
    this.terrainGroup.add(bolt);

    const flashDuration = 0.34;
    let cooldown = 3.5 + Math.random() * 6;
    let flashRemaining = 0;

    this.animatedProps.push((deltaTime, time) => {
      if (flashRemaining > 0) {
        flashRemaining -= deltaTime;
        const fade = Math.max(flashRemaining, 0) / flashDuration;
        const flicker = fade * (0.55 + Math.abs(Math.sin(time * 47)) * 0.45);
        boltMaterial.opacity = flicker;
        flashLight.intensity = 52000 * flicker;
        if (flashRemaining <= 0) {
          bolt.visible = false;
          flashLight.intensity = 0;
          cooldown = 4 + Math.random() * 8;
        }
        return;
      }

      cooldown -= deltaTime;
      if (cooldown > 0) {
        return;
      }

      const strikeX = (Math.random() - 0.5) * 2600;
      const strikeZ = (Math.random() - 0.5) * 2600;
      const cloudTop = 230 + Math.random() * 90;
      const segments = 12 + Math.floor(Math.random() * 10);
      let x = strikeX;
      let z = strikeZ;
      for (let s = 0; s <= segments; s++) {
        const y = cloudTop + (-48 - cloudTop) * (s / segments);
        boltAttribute.setXYZ(s, x, y, z);
        x += (Math.random() - 0.5) * 30;
        z += (Math.random() - 0.5) * 30;
      }
      boltGeometry.setDrawRange(0, segments + 1);
      boltAttribute.needsUpdate = true;
      bolt.visible = true;
      flashLight.position.set(strikeX, cloudTop * 0.5, strikeZ);
      flashRemaining = flashDuration;
    });
  }

  /**
   * 飞鸟/雄鹰编队：围绕锚点盘旋、扇动双翼的轻量动态生物。
   */
  private createBirdFlock(options: {
    centerX: number;
    centerZ: number;
    radius: number;
    altitude: number;
    count: number;
    color: number;
    speed: number;
    size: number;
  }): void {
    const flock = new THREE.Group();
    flock.name = 'birdFlock';

    const wingGeometry = new THREE.PlaneGeometry(options.size, options.size * 0.34);
    wingGeometry.rotateX(-Math.PI / 2);
    wingGeometry.translate(options.size / 2, 0, 0);
    const bodyGeometry = new THREE.BoxGeometry(
      options.size * 0.14,
      options.size * 0.1,
      options.size * 0.52
    );
    const birdMaterial = new THREE.MeshBasicMaterial({
      color: options.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });

    const count = Math.max(2, this.scaleCount(options.count));
    const birds: Array<{
      pivot: THREE.Group;
      leftWing: THREE.Mesh;
      rightWing: THREE.Mesh;
      baseAngle: number;
      phase: number;
      radius: number;
      altitude: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      const body = new THREE.Mesh(bodyGeometry, birdMaterial);
      pivot.add(body);

      const rightWing = new THREE.Mesh(wingGeometry, birdMaterial);
      pivot.add(rightWing);
      const leftWing = new THREE.Mesh(wingGeometry, birdMaterial);
      leftWing.rotation.y = Math.PI;
      pivot.add(leftWing);

      flock.add(pivot);
      birds.push({
        pivot,
        leftWing,
        rightWing,
        baseAngle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        radius: options.radius * (0.82 + Math.random() * 0.36),
        altitude: options.altitude + (Math.random() - 0.5) * 14,
      });
    }

    this.terrainGroup.add(flock);

    const flapSpeed = 5.5 + Math.abs(options.speed) * 6;
    this.animatedProps.push((_deltaTime, time) => {
      for (const bird of birds) {
        const angle = bird.baseAngle + time * options.speed;
        const px = options.centerX + Math.cos(angle) * bird.radius;
        const pz = options.centerZ + Math.sin(angle) * bird.radius;
        const py = bird.altitude + Math.sin(time * 0.7 + bird.phase) * 4;
        bird.pivot.position.set(px, py, pz);

        // 朝向飞行切线方向
        const directionSign = Math.sign(options.speed) || 1;
        bird.pivot.rotation.y = Math.atan2(
          -Math.sin(angle) * directionSign,
          Math.cos(angle) * directionSign
        );

        const flap = Math.sin(time * flapSpeed + bird.phase) * 0.55 + 0.08;
        bird.leftWing.rotation.z = flap;
        bird.rightWing.rotation.z = flap;
      }
    });
  }

  /** 湖面莲叶（带缺口的圆叶，实例化渲染） */
  /** 莲叶：拒绝采样落在湖缘齐踝浅水带 */
  private createLakeLilyPads(): void {
    const count = this.scaleCount(44);
    const padGeometry = new THREE.CircleGeometry(2.6, 9, 0.35, Math.PI * 1.82);
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f7d2f,
      roughness: 0.78,
      metalness: 0,
      emissive: 0x1d3c14,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
    const pads = new THREE.InstancedMesh(padGeometry, padMaterial, count);

    const dummy = new THREE.Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 80) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 240 + Math.random() * 980;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = this.stageField ? this.stageField.heightAt(x, z) : -1;
      if (h > -0.6 || h < -3.4) continue; // 只生在浅水
      dummy.position.set(x, WORLDSCAPE_WATER_Y + 0.5, z);
      dummy.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
      dummy.scale.setScalar(0.6 + Math.random() * 0.9);
      dummy.updateMatrix();
      pads.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    pads.count = placed;
    pads.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(pads);
  }

  /** 湖畔木码头与一艘随波摇晃的小船（沿高度场水岸线自动落位） */
  private createLakeDock(): void {
    const dockAngle = 0.42;
    const dockDirection = new THREE.Vector2(Math.cos(dockAngle), Math.sin(dockAngle));
    const shoreRadius = this.findShorelineRadius(dockDirection.x, dockDirection.y);

    const dock = new THREE.Group();
    dock.name = 'lakeDock';
    const plankMaterial = new THREE.MeshStandardMaterial({
      color: 0x7a5a3a,
      roughness: 0.9,
      metalness: 0,
    });
    const pileMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d442c,
      roughness: 0.95,
      metalness: 0,
    });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 64), plankMaterial);
    deck.position.y = -47.0;
    deck.castShadow = true;
    deck.receiveShadow = true;
    dock.add(deck);

    for (let i = 0; i < 5; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 3.4, 7), pileMaterial);
        pile.position.set(side * 2.5, -48.6, -28 + i * 14);
        pile.castShadow = true;
        dock.add(pile);
      }
    }

    dock.position.set(dockDirection.x * (shoreRadius - 16), 0, dockDirection.y * (shoreRadius - 16));
    dock.rotation.y = Math.atan2(dockDirection.x, dockDirection.y);
    this.terrainGroup.add(dock);

    // 小木船：泊在码头尽头附近，随湖面波浪起伏
    const boat = new THREE.Group();
    boat.name = 'rowboat';
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a3a26,
      roughness: 0.74,
      metalness: 0.04,
    });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 7), hullMaterial);
    hull.scale.set(1, 0.85, 1);
    boat.add(hull);
    const cavity = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.5, 5.6),
      new THREE.MeshStandardMaterial({ color: 0x55301d, roughness: 0.92 })
    );
    cavity.position.y = 0.32;
    boat.add(cavity);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.8), hullMaterial);
    bench.position.y = 0.45;
    boat.add(bench);

    const boatX = dockDirection.x * (shoreRadius - 58) + 9;
    const boatZ = dockDirection.y * (shoreRadius - 58) + 7;
    boat.position.set(boatX, -47.6, boatZ);
    boat.rotation.y = dockAngle + 0.7;
    this.terrainGroup.add(boat);

    this.animatedProps.push((_deltaTime, time) => {
      boat.position.y = -47.65 + this.sampleWaterWave(boatX, boatZ) * 0.7;
      boat.rotation.z = Math.sin(time * 0.9) * 0.045;
      boat.rotation.x = Math.sin(time * 0.7 + 1.2) * 0.03;
    });
  }

  /** 晨光中的花粉/飞虫微粒，低空缓慢漂浮 */
  private createLakePollenDrift(): void {
    const count = this.scaleCount(90);
    const basePositions = new Float32Array(count * 3);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 240 + Math.random() * 440;
      basePositions[i * 3] = Math.cos(angle) * radius;
      basePositions[i * 3 + 1] = -46 + Math.random() * 20;
      basePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    positions.set(basePositions);

    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    const material = new THREE.PointsMaterial({
      color: 0xffe9a8,
      size: 1.8,
      map: this.createSoftCircleTexture(),
      alphaTest: 0.02,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pollen = new THREE.Points(geometry, material);
    pollen.frustumCulled = false;
    this.terrainGroup.add(pollen);

    this.animatedProps.push((_deltaTime, time) => {
      for (let i = 0; i < count; i++) {
        const offset = i * 3;
        positions[offset] = basePositions[offset] + Math.sin(time * 0.23 + i * 1.7) * 3.2;
        positions[offset + 1] = basePositions[offset + 1] + Math.sin(time * 0.5 + i) * 2.1;
        positions[offset + 2] = basePositions[offset + 2] + Math.cos(time * 0.19 + i * 0.9) * 3.2;
      }
      attribute.needsUpdate = true;
      material.opacity = 0.42 + Math.sin(time * 0.8) * 0.1;
    });
  }

  /** 沙漠远景台地（平顶山），强化地平线剪影 */
  private createDesertMesas(surfaceProfile: LevelSurfaceProfile): void {
    const mesaColor = this.tintColor(surfaceProfile.groundDetailColor ?? 0x9d7e4e, 0.01, 0.04, -0.06);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 1760 + Math.random() * 480;
      const width = 140 + Math.random() * 140;
      const height = 180 + Math.random() * 140;

      const mesa = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.74, width, height, 9, 1),
        new THREE.MeshStandardMaterial({
          color: mesaColor,
          roughness: 0.96,
          metalness: 0,
          flatShading: true,
          map: this.createDetailTexture(
            mesaColor,
            surfaceProfile.groundAccentColor ?? 0xffd58e,
            this.tintColor(mesaColor, 0, 0.05, -0.12),
            'rock'
          ),
        })
      );
      mesa.position.set(
        Math.cos(angle) * distance,
        -50 + height / 2 - 6,
        Math.sin(angle) * distance
      );
      mesa.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(mesa);
    }
  }

  /** 风蚀岩拱 */
  private createDesertArches(surfaceProfile: LevelSurfaceProfile): void {
    const archColor = this.tintColor(surfaceProfile.groundDetailColor ?? 0x9d7e4e, 0.005, 0.08, -0.02);
    const archMaterial = new THREE.MeshStandardMaterial({
      color: archColor,
      roughness: 0.94,
      metalness: 0,
      flatShading: true,
    });
    const archSpots = [
      { x: -720, z: 280, scale: 1.0 },
      { x: 840, z: -620, scale: 1.35 },
    ];
    for (const spot of archSpots) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(24, 5, 7, 11, Math.PI), archMaterial);
      arch.position.set(spot.x, -50 + this.sampleDesertGroundHeight(spot.x, spot.z), spot.z);
      arch.rotation.y = Math.random() * Math.PI;
      arch.scale.setScalar(spot.scale);
      arch.castShadow = true;
      this.terrainGroup.add(arch);
    }
  }

  /** 游走的尘卷风：双层旋转半透明锥体 */
  private createDustDevils(surfaceProfile: LevelSurfaceProfile): void {
    const devilColor = this.tintColor(surfaceProfile.groundAccentColor ?? 0xe0ba74, 0.01, -0.1, 0.04);
    const devilCount = this.scaleCount(3);

    for (let i = 0; i < devilCount; i++) {
      const devil = new THREE.Group();
      devil.name = 'dustDevil';

      const outerGeometry = new THREE.ConeGeometry(8, 70, 8, 1, true);
      outerGeometry.rotateX(Math.PI); // 翻转为下窄上宽的尘柱
      const outer = new THREE.Mesh(
        outerGeometry,
        new THREE.MeshBasicMaterial({
          color: devilColor,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      devil.add(outer);

      const innerGeometry = new THREE.ConeGeometry(4.4, 58, 8, 1, true);
      innerGeometry.rotateX(Math.PI);
      const inner = new THREE.Mesh(
        innerGeometry,
        new THREE.MeshBasicMaterial({
          color: this.tintColor(devilColor, 0, -0.04, 0.08),
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      inner.position.y = -4;
      devil.add(inner);

      const baseX = (Math.random() - 0.5) * 1800;
      const baseZ = (Math.random() - 0.5) * 1800;
      const phase = Math.random() * Math.PI * 2;
      devil.position.set(baseX, -50 + 35, baseZ);
      this.terrainGroup.add(devil);

      this.animatedProps.push((deltaTime, time) => {
        outer.rotation.y += deltaTime * 6.5;
        inner.rotation.y -= deltaTime * 4.8;
        devil.position.x = baseX + Math.sin(time * 0.13 + phase) * 170;
        devil.position.z = baseZ + Math.cos(time * 0.11 + phase) * 170;
        devil.scale.y = 0.92 + Math.sin(time * 0.9 + phase) * 0.14;
      });
    }
  }

  /** 峰顶风吹雪旗：从最高的几座山峰顶部横向吹出的雪粒流 */
  private createSnowBanners(peaks: Array<{ x: number; z: number; topY: number }>): void {
    const anchors = [...peaks].sort((a, b) => b.topY - a.topY).slice(0, 5);

    for (const anchor of anchors) {
      const count = this.scaleCount(36);
      const progress = new Float32Array(count);
      const jitterPhase = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        progress[i] = Math.random();
        jitterPhase[i] = Math.random() * Math.PI * 2;
      }
      const windAngle = Math.random() * Math.PI * 2;
      const windX = Math.cos(windAngle);
      const windZ = Math.sin(windAngle);
      const bannerLength = 46 + Math.random() * 26;

      const positions = new Float32Array(count * 3);
      const geometry = new THREE.BufferGeometry();
      const attribute = new THREE.BufferAttribute(positions, 3);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', attribute);
      const material = new THREE.PointsMaterial({
        color: 0xf6fbff,
        size: 2.4,
        map: this.createSoftCircleTexture(),
        alphaTest: 0.02,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const banner = new THREE.Points(geometry, material);
      banner.frustumCulled = false;
      this.terrainGroup.add(banner);

      this.animatedProps.push((deltaTime, time) => {
        for (let i = 0; i < count; i++) {
          progress[i] += deltaTime * 0.55;
          if (progress[i] >= 1) {
            progress[i] -= 1;
          }
          const travel = progress[i] * bannerLength;
          const droop = progress[i] * progress[i] * 11;
          const sway = Math.sin(time * 2 + jitterPhase[i]) * 1.6;
          const offset = i * 3;
          positions[offset] = anchor.x + windX * travel - windZ * sway;
          positions[offset + 1] = anchor.topY + 1.5 - droop;
          positions[offset + 2] = anchor.z + windZ * travel + windX * sway;
        }
        attribute.needsUpdate = true;
      });
    }
  }

  /** 水面波高采样：与 worldscape 波浪着色器的 GPU 波形完全一致（深水处 waveScale = 1） */
  private sampleWaterWave(worldX: number, worldZ: number): number {
    return sampleWaveHeight(worldX, worldZ, this.time);
  }

  /** 海上灯塔：岩礁、红白条纹塔身与旋转的扫海光束 */
  private createLighthouse(): void {
    const lighthouse = new THREE.Group();
    lighthouse.name = 'lighthouse';

    const islet = new THREE.Mesh(
      new THREE.ConeGeometry(40, 30, 7),
      new THREE.MeshStandardMaterial({ color: 0x394048, roughness: 0.96, flatShading: true })
    );
    islet.position.y = 4;
    lighthouse.add(islet);

    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 });
    const redMaterial = new THREE.MeshStandardMaterial({ color: 0xb3322a, roughness: 0.55 });
    const towerSegments = [
      { material: whiteMaterial, height: 8, centerY: 21, radiusTop: 3.2, radiusBottom: 3.6 },
      { material: redMaterial, height: 6, centerY: 28, radiusTop: 3.0, radiusBottom: 3.2 },
      { material: whiteMaterial, height: 8, centerY: 35, radiusTop: 2.8, radiusBottom: 3.0 },
    ];
    for (const segment of towerSegments) {
      const part = new THREE.Mesh(
        new THREE.CylinderGeometry(segment.radiusTop, segment.radiusBottom, segment.height, 12),
        segment.material
      );
      part.position.y = segment.centerY;
      part.castShadow = true;
      lighthouse.add(part);
    }

    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(3.9, 3.9, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.3 })
    );
    gallery.position.y = 39.6;
    lighthouse.add(gallery);

    const lanternMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe9b0,
      emissive: 0xffd98a,
      emissiveIntensity: 1.3,
      roughness: 0.2,
    });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.4, 12), lanternMaterial);
    lantern.position.y = 41.8;
    lighthouse.add(lantern);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 3, 12),
      new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.3 })
    );
    roof.position.y = 45;
    lighthouse.add(roof);

    // 双向扫海光束
    const beamGroup = new THREE.Group();
    beamGroup.position.y = 41.8;
    const beamGeometry = new THREE.ConeGeometry(20, 270, 12, 1, true);
    beamGeometry.translate(0, -135, 0);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff3cf,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const beamFront = new THREE.Mesh(beamGeometry, beamMaterial);
    beamFront.rotation.x = Math.PI / 2;
    beamGroup.add(beamFront);
    const beamBack = new THREE.Mesh(beamGeometry, beamMaterial);
    beamBack.rotation.x = -Math.PI / 2;
    beamGroup.add(beamBack);
    lighthouse.add(beamGroup);

    lighthouse.position.set(860, -50, -780);
    this.terrainGroup.add(lighthouse);

    this.animatedProps.push((_deltaTime, time) => {
      beamGroup.rotation.y = time * 0.85;
      lanternMaterial.emissiveIntensity = 1.15 + Math.sin(time * 0.85 * 2) * 0.35;
    });
  }

  /** 浪尖白沫：跟随海浪起伏的实例化白色浪花 */
  private createOceanWhitecaps(): void {
    const count = this.scaleCount(176);
    const capGeometry = new THREE.PlaneGeometry(13, 2.4);
    const capMaterial = new THREE.MeshBasicMaterial({
      color: 0xdce9f2,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const caps = new THREE.InstancedMesh(capGeometry, capMaterial, count);
    caps.frustumCulled = false;

    const capX = new Float32Array(count);
    const capZ = new Float32Array(count);
    const capYaw = new Float32Array(count);
    const capScale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      capX[i] = (Math.random() - 0.5) * 3400;
      capZ[i] = (Math.random() - 0.5) * 3400;
      capYaw[i] = Math.random() * Math.PI * 2;
      capScale[i] = 0.6 + Math.random() * 1.1;
    }

    const dummy = new THREE.Object3D();
    this.terrainGroup.add(caps);

    this.animatedProps.push((_deltaTime, time) => {
      for (let i = 0; i < count; i++) {
        const wave = this.sampleWaterWave(capX[i], capZ[i]);
        dummy.position.set(capX[i], WORLDSCAPE_WATER_Y + wave + 0.35, capZ[i]);
        dummy.rotation.set(-Math.PI / 2, 0, capYaw[i]);
        // 浪峰处放大、浪谷处缩小，模拟白沫聚散（GPU 波形振幅约 ±1）
        const crest = THREE.MathUtils.clamp(0.55 + wave * 0.45, 0.12, 1.5);
        dummy.scale.setScalar(capScale[i] * crest);
        dummy.updateMatrix();
        caps.setMatrixAt(i, dummy.matrix);
      }
      caps.instanceMatrix.needsUpdate = true;
      capMaterial.opacity = 0.3 + Math.sin(time * 0.7) * 0.06;
    });
  }

  /** 远航货轮剪影：缓慢横越战场边缘，舷窗透光 */
  private createOceanShips(): void {
    const shipRoutes = [
      { startX: -1300, z: -1440, speed: 3.1 },
      { startX: 1160, z: 1320, speed: -2.5 },
    ];

    for (const route of shipRoutes) {
      const ship = new THREE.Group();
      ship.name = 'cargoShip';

      const hullMaterial = new THREE.MeshStandardMaterial({
        color: 0x161e29,
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x0a0e14,
        emissiveIntensity: 0.3,
      });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(58, 7, 12), hullMaterial);
      hull.position.y = 2;
      ship.add(hull);

      const superstructure = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 9), hullMaterial);
      superstructure.position.set(-18, 9, 0);
      ship.add(superstructure);

      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 5, 8), hullMaterial);
      funnel.position.set(-20, 15, 0);
      ship.add(funnel);

      const windowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd98a,
        transparent: true,
        opacity: 0.9,
      });
      for (let side = -1; side <= 1; side += 2) {
        const windows = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), windowMaterial);
        windows.position.set(-18, 10.5, side * 4.6);
        windows.rotation.y = side > 0 ? 0 : Math.PI;
        ship.add(windows);
      }

      const mastLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
      );
      mastLight.position.set(-18, 19, 0);
      ship.add(mastLight);

      let shipX = route.startX;
      const phase = Math.random() * Math.PI * 2;
      ship.position.set(shipX, -46.5, route.z);
      this.terrainGroup.add(ship);

      this.animatedProps.push((deltaTime, time) => {
        shipX += route.speed * deltaTime;
        if (shipX > 2100) shipX = -2100;
        if (shipX < -2100) shipX = 2100;
        ship.position.x = shipX;
        ship.position.y = -46.5 + this.sampleWaterWave(shipX, route.z) * 0.7;
        ship.rotation.z = Math.sin(time * 0.5 + phase) * 0.022;
        ship.rotation.x = Math.sin(time * 0.38 + phase * 1.7) * 0.015;
      });
    }
  }

  /** 航道浮标：随浪摇曳、红光闪烁 */
  private createOceanBuoys(): void {
    const buoyCount = this.scaleCount(5);
    const buoys: Array<{
      group: THREE.Group;
      lightMaterial: THREE.MeshBasicMaterial;
      x: number;
      z: number;
      phase: number;
    }> = [];

    for (let i = 0; i < buoyCount; i++) {
      const buoy = new THREE.Group();
      buoy.name = 'buoy';

      const body = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xd2402a, roughness: 0.6, metalness: 0.2 })
      );
      body.position.y = 1.2;
      buoy.add(body);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 2.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x44494f, roughness: 0.5, metalness: 0.5 })
      );
      mast.position.y = 4.2;
      buoy.add(mast);

      const lightMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5540,
        transparent: true,
        opacity: 0.95,
      });
      const beaconLamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lightMaterial);
      beaconLamp.position.y = 5.7;
      buoy.add(beaconLamp);

      const angle = Math.random() * Math.PI * 2;
      const radius = 320 + Math.random() * 1000;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      buoy.position.set(x, -49, z);
      this.terrainGroup.add(buoy);
      buoys.push({ group: buoy, lightMaterial, x, z, phase: Math.random() * Math.PI * 2 });
    }

    this.animatedProps.push((_deltaTime, time) => {
      for (const buoy of buoys) {
        const wave = this.sampleWaterWave(buoy.x, buoy.z);
        buoy.group.position.y = WORLDSCAPE_WATER_Y + wave + 0.4;
        buoy.group.rotation.x = Math.sin(time * 0.9 + buoy.phase) * 0.1;
        buoy.group.rotation.z = Math.cos(time * 0.8 + buoy.phase) * 0.1;
        buoy.lightMaterial.opacity = Math.sin(time * 2.6 + buoy.phase) > 0.45 ? 0.95 : 0.08;
      }
    });
  }

  /** 城市扫天探照灯：从楼顶射向夜空的旋转光柱 */
  private createCitySearchlights(): void {
    const rigs = [
      { x: -620, z: 360, height: 74, speed: 0.34, tilt: 0.52 },
      { x: 540, z: -480, height: 92, speed: -0.27, tilt: 0.62 },
      { x: 120, z: 860, height: 66, speed: 0.41, tilt: 0.45 },
    ];

    const beamGeometry = new THREE.ConeGeometry(24, 430, 12, 1, true);
    beamGeometry.translate(0, -215, 0);
    beamGeometry.rotateX(Math.PI); // 顶点留在原点，光束朝 +Y 展开

    for (const rig of rigs) {
      const spin = new THREE.Group();
      spin.name = 'searchlight';
      spin.position.set(rig.x, -50 + rig.height, rig.z);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 4.4, 3.4),
        new THREE.MeshStandardMaterial({ color: 0x2a313c, roughness: 0.5, metalness: 0.5 })
      );
      housing.position.y = -2;
      spin.add(housing);

      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z = rig.tilt;
      const beam = new THREE.Mesh(
        beamGeometry,
        new THREE.MeshBasicMaterial({
          color: 0xeaf2ff,
          transparent: true,
          opacity: 0.07,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
          fog: false,
          toneMapped: false,
        })
      );
      tiltGroup.add(beam);
      spin.add(tiltGroup);
      this.terrainGroup.add(spin);

      const phase = Math.random() * Math.PI * 2;
      this.animatedProps.push((_deltaTime, time) => {
        spin.rotation.y = time * rig.speed + phase;
        tiltGroup.rotation.z = rig.tilt + Math.sin(time * 0.37 + phase) * 0.12;
      });
    }
  }

  /** 城市路网车流：白色车头灯流与红色车尾灯流沿道路移动 */
  private createCityTraffic(): void {
    const carGeometry = new THREE.PlaneGeometry(3.4, 1.6);
    carGeometry.rotateX(-Math.PI / 2);

    const streams: Array<{ color: number; directionSign: number; laneOffset: number }> = [
      { color: 0xfff1c4, directionSign: 1, laneOffset: 5.2 },
      { color: 0xff4632, directionSign: -1, laneOffset: -5.2 },
    ];

    for (const stream of streams) {
      const count = this.scaleCount(48);
      const material = new THREE.MeshBasicMaterial({
        color: stream.color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      });
      const cars = new THREE.InstancedMesh(carGeometry, material, count);
      cars.frustumCulled = false;
      cars.renderOrder = 5;

      const isVertical = new Uint8Array(count);
      const roadCenter = new Float32Array(count);
      const travel = new Float32Array(count);
      const velocity = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        isVertical[i] = Math.random() < 0.5 ? 1 : 0;
        roadCenter[i] = (Math.floor(Math.random() * 13) - 6) * 250;
        travel[i] = (Math.random() - 0.5) * 2960;
        velocity[i] = (55 + Math.random() * 50) * stream.directionSign;
      }

      const dummy = new THREE.Object3D();
      this.terrainGroup.add(cars);

      this.animatedProps.push((deltaTime) => {
        for (let i = 0; i < count; i++) {
          travel[i] += velocity[i] * deltaTime;
          if (travel[i] > 1480) travel[i] = -1480;
          if (travel[i] < -1480) travel[i] = 1480;

          if (isVertical[i] === 1) {
            dummy.position.set(roadCenter[i] + stream.laneOffset, -49.14, travel[i]);
            dummy.rotation.set(0, Math.PI / 2, 0);
          } else {
            dummy.position.set(travel[i], -49.14, roadCenter[i] + stream.laneOffset);
            dummy.rotation.set(0, 0, 0);
          }
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          cars.setMatrixAt(i, dummy.matrix);
        }
        cars.instanceMatrix.needsUpdate = true;
      });
    }
  }

  /** 霓虹招牌：立柱广告牌，带真实的闪烁与偶发断电效果 */
  private createCityNeonSigns(): void {
    const palette = [0xff4fd8, 0x40e0ff, 0xffa24f, 0x8cff5e];
    const spots = [
      { x: -290, z: 44, rotationY: 0 },
      { x: 264, z: -456, rotationY: Math.PI / 2 },
      { x: -740, z: -250, rotationY: Math.PI / 2 },
      { x: 760, z: 260, rotationY: 0 },
      { x: 250, z: 784, rotationY: 0 },
      { x: -480, z: 720, rotationY: Math.PI / 2 },
    ];

    const pylonMaterial = new THREE.MeshStandardMaterial({
      color: 0x33394a,
      roughness: 0.6,
      metalness: 0.4,
    });

    spots.forEach((spot, index) => {
      const sign = new THREE.Group();
      sign.name = 'neonSign';

      const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 24, 1.2), pylonMaterial);
      pylon.position.y = 12;
      sign.add(pylon);

      const backing = new THREE.Mesh(new THREE.BoxGeometry(16.5, 8.2, 0.8), pylonMaterial);
      backing.position.y = 27;
      sign.add(backing);

      const neonMaterial = new THREE.MeshBasicMaterial({
        color: palette[index % palette.length],
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(15, 7), neonMaterial);
      panel.position.set(0, 27, 0.55);
      sign.add(panel);
      const panelBack = new THREE.Mesh(new THREE.PlaneGeometry(15, 7), neonMaterial);
      panelBack.position.set(0, 27, -0.55);
      panelBack.rotation.y = Math.PI;
      sign.add(panelBack);

      sign.position.set(spot.x, -50, spot.z);
      sign.rotation.y = spot.rotationY;
      this.terrainGroup.add(sign);

      const flickerSpeed = 1.6 + Math.random() * 1.8;
      const phase = Math.random() * Math.PI * 2;
      this.animatedProps.push((_deltaTime, time) => {
        const base = 0.6 + Math.sin(time * flickerSpeed + phase) * 0.25;
        const dropout = Math.sin(time * 7.3 + phase * 3) > 0.965 ? 0.12 : 1;
        neonMaterial.opacity = base * dropout;
      });
    });
  }

  private resolveWeatherProfile(config: LevelConfig): WeatherProfile {
    const baseProfile = this.getDefaultWeatherProfile(config.terrain);
    const weatherPresetMap: Record<LevelWeatherConfig['preset'], WeatherType> = {
      clear: 'clear',
      cloudy: 'clear',
      mist: 'mist',
      windy: 'mist',
      sandstorm: 'dust',
      snow: 'snow',
      storm: 'storm',
      smog: 'smog',
    };
    /** 云色调（1 = 晴日亮白 → 0 = 风暴铅灰），按天气类型推导 */
    const cloudToneByType: Record<WeatherType, number> = {
      clear: 1.0,
      mist: 0.92,
      snow: 0.86,
      dust: 0.95,
      storm: 0.34,
      smog: 0.72,
      rain: 0.55,
    };
    const weatherConfig = config.weather;
    const environmentConfig = config.environment;
    const cloudCover = environmentConfig.cloudCover ?? weatherConfig.cloudCoverage;
    const resolvedType = weatherPresetMap[weatherConfig.preset] ?? baseProfile.type;

    const resolvedProfile: WeatherProfile = {
      ...baseProfile,
      type: resolvedType,
      cloudCoverage: THREE.MathUtils.clamp(
        typeof cloudCover === 'number' && cloudCover <= 1
          ? cloudCover
          : weatherConfig.cloudCoverage,
        0.05,
        1
      ),
      cloudTone: cloudToneByType[resolvedType],
      windStrength: THREE.MathUtils.clamp(
        weatherConfig.windStrength ?? baseProfile.windStrength,
        0,
        1
      ),
      intensity: THREE.MathUtils.clamp(
        environmentConfig.weatherIntensity ?? weatherConfig.intensity ?? baseProfile.intensity,
        0,
        1
      ),
      fogDensity: environmentConfig.fogDensity ?? weatherConfig.fogDensity ?? baseProfile.fogDensity,
      cloudCount: Math.max(
        4,
        Math.round(
          typeof cloudCover === 'number'
            ? cloudCover <= 1
              ? 12 + cloudCover * 40
              : cloudCover
            : baseProfile.cloudCount
        )
      ),
      cloudOpacity:
        weatherConfig.cloudOpacity ?? baseProfile.cloudOpacity + (environmentConfig.cloudCover ?? 0) * 0.08,
      cloudTint: environmentConfig.cloudTint ?? weatherConfig.cloudTint ?? baseProfile.cloudTint,
      cloudSpeed: environmentConfig.cloudSpeed ?? weatherConfig.cloudSpeed ?? baseProfile.cloudSpeed,
      cloudHeightMin:
        environmentConfig.cloudHeightMin ?? weatherConfig.cloudHeightMin ?? baseProfile.cloudHeightMin,
      cloudHeightMax:
        environmentConfig.cloudHeightMax ?? weatherConfig.cloudHeightMax ?? baseProfile.cloudHeightMax,
      particleCount:
        environmentConfig.particleCount ?? weatherConfig.particleCount ?? baseProfile.particleCount,
      particleSize:
        environmentConfig.particleSize ?? weatherConfig.particleSize ?? baseProfile.particleSize,
      particleSpeed:
        environmentConfig.particleSpeed ?? weatherConfig.particleSpeed ?? baseProfile.particleSpeed,
      particleDrift:
        environmentConfig.particleDrift ?? weatherConfig.particleDrift ?? baseProfile.particleDrift,
      particleColor:
        environmentConfig.particleColor ?? weatherConfig.particleColor ?? baseProfile.particleColor,
      waterWaveScale:
        environmentConfig.waterWaveScale ?? weatherConfig.waterWaveScale ?? baseProfile.waterWaveScale,
      skyGlow: environmentConfig.skyGlow ?? weatherConfig.skyGlow ?? baseProfile.skyGlow,
      windAngle: weatherConfig.windAngle ?? baseProfile.windAngle,
    };

    switch (resolvedProfile.type) {
      case 'storm':
        resolvedProfile.cloudOpacity = THREE.MathUtils.clamp(
          resolvedProfile.cloudOpacity + 0.06,
          0.3,
          0.92
        );
        resolvedProfile.cloudSpeed += 0.8;
        resolvedProfile.particleCount = Math.round(resolvedProfile.particleCount * 1.1);
        break;
      case 'mist':
        resolvedProfile.cloudOpacity = THREE.MathUtils.clamp(
          resolvedProfile.cloudOpacity + 0.04,
          0.3,
          0.9
        );
        resolvedProfile.particleSize += 0.6;
        break;
      case 'dust':
        resolvedProfile.particleCount = Math.round(resolvedProfile.particleCount * 1.08);
        resolvedProfile.fogDensity *= 1.06;
        break;
      case 'smog':
        resolvedProfile.cloudOpacity = THREE.MathUtils.clamp(
          resolvedProfile.cloudOpacity + 0.03,
          0.3,
          0.88
        );
        resolvedProfile.fogDensity *= 1.08;
        break;
      case 'snow':
        resolvedProfile.particleSize = Math.max(2.8, resolvedProfile.particleSize * 0.95);
        resolvedProfile.cloudSpeed *= 0.92;
        break;
    }

    resolvedProfile.cloudOpacity = THREE.MathUtils.clamp(resolvedProfile.cloudOpacity, 0.18, 0.92);
    resolvedProfile.particleCount = Math.max(0, Math.round(resolvedProfile.particleCount));
    resolvedProfile.particleSize = Math.max(0, resolvedProfile.particleSize);
    resolvedProfile.fogDensity = Math.max(0, resolvedProfile.fogDensity);

    return resolvedProfile;
  }

  private getDefaultWeatherProfile(terrain: TerrainType): WeatherProfile {
    switch (terrain) {
      case TerrainType.DESERT:
        return {
          type: 'dust',
          intensity: 0.55,
          cloudCoverage: 0.14,
          cloudTone: 0.95,
          windStrength: 0.9,
          fogDensity: 0.0012,
          cloudCount: 12,
          cloudOpacity: 0.48,
          cloudTint: 0xe8c58d,
          cloudSpeed: 4.5,
          cloudHeightMin: 110,
          cloudHeightMax: 220,
          particleCount: 180,
          particleSize: 6,
          particleSpeed: 14,
          particleDrift: 8,
          particleColor: 0xd6b77d,
          waterWaveScale: 0.6,
          skyGlow: 0xffc978,
          windAngle: 0.72, // 沙暴：强烈的斜向风
        };
      case TerrainType.MOUNTAINS:
        return {
          type: 'snow',
          intensity: 0.45,
          cloudCoverage: 0.74,
          cloudTone: 0.86,
          windStrength: 0.44,
          fogDensity: 0.00105,
          cloudCount: 24,
          cloudOpacity: 0.78,
          cloudTint: 0xf6fbff,
          cloudSpeed: 2.2,
          cloudHeightMin: 90,
          cloudHeightMax: 230,
          particleCount: 220,
          particleSize: 3.5,
          particleSpeed: 10,
          particleDrift: 2,
          particleColor: 0xf5fbff,
          waterWaveScale: 0.8,
          skyGlow: 0xddeeff,
          windAngle: 2.4, // 高山雪风：自西北吹向东南
        };
      case TerrainType.OCEAN:
        return {
          type: 'storm',
          intensity: 0.5,
          cloudCoverage: 0.62,
          cloudTone: 0.95,
          windStrength: 0.7,
          fogDensity: 0.0011,
          cloudCount: 28,
          cloudOpacity: 0.72,
          cloudTint: 0xd8e4ee,
          cloudSpeed: 5.2,
          cloudHeightMin: 100,
          cloudHeightMax: 240,
          particleCount: 160,
          particleSize: 7,
          particleSpeed: 6,
          particleDrift: 5,
          particleColor: 0xc9d7e2,
          waterWaveScale: 3.4,
          skyGlow: 0x8fb9ff,
          windAngle: -0.65, // 风暴：强劲斜向海风
        };
      case TerrainType.CITY:
        return {
          type: 'smog',
          intensity: 0.4,
          cloudCoverage: 0.55,
          cloudTone: 0.72,
          windStrength: 0.2,
          fogDensity: 0.00115,
          cloudCount: 22,
          cloudOpacity: 0.68,
          cloudTint: 0xc8d0dc,
          cloudSpeed: 3.5,
          cloudHeightMin: 120,
          cloudHeightMax: 260,
          particleCount: 120,
          particleSize: 5,
          particleSpeed: 7,
          particleDrift: 3,
          particleColor: 0xb0b9c8,
          waterWaveScale: 0.5,
          skyGlow: 0xb5c4ff,
          windAngle: 0.18, // 城市烟霾：近乎水平的微风
        };
      case TerrainType.LAKE:
      default:
        return {
          type: 'clear',
          intensity: 0.2,
          cloudCoverage: 0.3,
          cloudTone: 1.0,
          windStrength: 0.3,
          fogDensity: 0.00072,
          cloudCount: 18,
          cloudOpacity: 0.74,
          cloudTint: 0xffffff,
          cloudSpeed: 2.8,
          cloudHeightMin: 90,
          cloudHeightMax: 220,
          particleCount: 0,
          particleSize: 0,
          particleSpeed: 0,
          particleDrift: 0,
          particleColor: 0xffffff,
          waterWaveScale: 1.6,
          skyGlow: 0xfff0b2,
          windAngle: 0.35, // 湖畔：和缓的晨风
        };
    }
  }

  private getSurfaceProfile(config: LevelConfig): LevelSurfaceProfile {
    return config.environment.surfaceProfile ?? {};
  }

  private tintColor(
    color: THREE.ColorRepresentation,
    hueOffset: number,
    saturationOffset: number,
    lightnessOffset: number
  ): THREE.Color {
    const tinted = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    tinted.getHSL(hsl);
    tinted.setHSL(
      (hsl.h + hueOffset + 1) % 1,
      THREE.MathUtils.clamp(hsl.s + saturationOffset, 0, 1),
      THREE.MathUtils.clamp(hsl.l + lightnessOffset, 0, 1)
    );
    return tinted;
  }

  private getParticleBaseOpacity(profile: WeatherProfile): number {
    switch (profile.type) {
      case 'mist':
        return 0.14 + profile.intensity * 0.1;
      case 'snow':
        return 0.4 + profile.intensity * 0.12;
      case 'dust':
        return 0.34 + profile.intensity * 0.16;
      case 'storm':
        return 0.42 + profile.intensity * 0.18;
      case 'smog':
        return 0.24 + profile.intensity * 0.12;
      case 'rain':
        return 0.36 + profile.intensity * 0.18;
      case 'clear':
      default:
        return 0.18 + profile.intensity * 0.08;
    }
  }

  private getWaterVisualResponse(profile: WeatherProfile): {
    baseEmissive: number;
    emissiveAmplitude: number;
    baseOpacity: number;
    opacityAmplitude: number;
    roughness: number;
    metalness: number;
  } {
    switch (profile.type) {
      case 'storm':
        return {
          baseEmissive: 0.1,
          emissiveAmplitude: 0.025,
          baseOpacity: 0.84,
          opacityAmplitude: 0.035,
          roughness: 0.1,
          metalness: 0.45,
        };
      case 'mist':
        return {
          baseEmissive: 0.14,
          emissiveAmplitude: 0.035,
          baseOpacity: 0.88,
          opacityAmplitude: 0.045,
          roughness: 0.14,
          metalness: 0.28,
        };
      case 'snow':
        return {
          baseEmissive: 0.12,
          emissiveAmplitude: 0.02,
          baseOpacity: 0.9,
          opacityAmplitude: 0.03,
          roughness: 0.16,
          metalness: 0.24,
        };
      case 'dust':
      case 'smog':
        return {
          baseEmissive: 0.09,
          emissiveAmplitude: 0.018,
          baseOpacity: 0.83,
          opacityAmplitude: 0.028,
          roughness: 0.22,
          metalness: 0.26,
        };
      case 'rain':
        return {
          baseEmissive: 0.11,
          emissiveAmplitude: 0.024,
          baseOpacity: 0.87,
          opacityAmplitude: 0.04,
          roughness: 0.15,
          metalness: 0.32,
        };
      case 'clear':
      default:
        return {
          baseEmissive: 0.13,
          emissiveAmplitude: 0.03,
          baseOpacity: 0.89,
          opacityAmplitude: 0.035,
          roughness: 0.12,
          metalness: 0.3,
        };
    }
  }

  private createDetailTexture(
    base: THREE.ColorRepresentation,
    accent: THREE.ColorRepresentation,
    detail: THREE.ColorRepresentation,
    pattern: SurfacePattern
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    }

    ctx.fillStyle = this.toCanvasColor(base);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const accentAlpha = pattern === 'grass' ? 0.34 : pattern === 'asphalt' ? 0.24 : 0.16;
    const detailAlpha = pattern === 'grass' ? 0.28 : pattern === 'asphalt' ? 0.28 : 0.18;
    const accentColor = this.toCanvasColor(accent, accentAlpha);
    const detailColor = this.toCanvasColor(detail, detailAlpha);

    for (let i = 0; i < 140; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = 2 + Math.random() * 20;
      ctx.fillStyle = i % 2 === 0 ? accentColor : detailColor;
      switch (pattern) {
        case 'grass':
          ctx.fillRect(x, y, 1 + Math.random() * 4, size * (1.3 + Math.random() * 0.9));
          break;
        case 'sand':
        case 'snow':
        case 'rock':
          ctx.beginPath();
          ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
          break;
      case 'asphalt': {
        const grain = 0.8 + Math.random() * 2.2;
        ctx.fillRect(x, y, grain, grain);
        if (Math.random() < 0.08) {
          const crackLen = 3 + Math.random() * 8;
            ctx.strokeStyle = this.toCanvasColor(detail, 0.14);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + crackLen, y + (Math.random() - 0.5) * 2);
            ctx.stroke();
          }
        break;
      }
        case 'water':
          ctx.fillRect(x, y, size * 1.8, 1 + Math.random() * 2);
          break;
        case 'beach':
          ctx.fillRect(x, y, size * 0.6, size * 0.2);
          break;
      }
    }

    if (pattern === 'asphalt') {
      ctx.strokeStyle = this.toCanvasColor(0xffffff, 0.05);
      for (let i = 0; i < 8; i++) {
        const y = (i / 8) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y + Math.random() * 4 - 2);
        ctx.stroke();
      }

      ctx.strokeStyle = this.toCanvasColor(0xbfc7d6, 0.08);
      for (let i = 0; i < 6; i++) {
        const x = (i / 6) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + Math.random() * 8 - 4, canvas.height);
        ctx.stroke();
      }

      for (let i = 0; i < 20; i++) {
        const blockX = Math.random() * canvas.width;
        const blockY = Math.random() * canvas.height;
        const blockW = 14 + Math.random() * 40;
        const blockH = 14 + Math.random() * 40;
        ctx.fillStyle = this.toCanvasColor(0xa8b2c2, 0.05 + Math.random() * 0.05);
        ctx.fillRect(blockX, blockY, blockW, blockH);
      }

      for (let i = 0; i < 10; i++) {
        const lineX = Math.random() * canvas.width;
        const lineY = Math.random() * canvas.height;
        const lineW = 24 + Math.random() * 48;
        const lineH = 2 + Math.random() * 3;
        ctx.fillStyle = this.toCanvasColor(0xf2f5fa, 0.05 + Math.random() * 0.03);
        ctx.fillRect(lineX, lineY, lineW, lineH);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(pattern === 'water' ? 12 : 18, pattern === 'water' ? 12 : 18);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private toCanvasColor(color: THREE.ColorRepresentation, alpha: number = 1): string {
    const resolved = new THREE.Color(color).convertLinearToSRGB();
    const r = Math.round(resolved.r * 255);
    const g = Math.round(resolved.g * 255);
    const b = Math.round(resolved.b * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private disposeRenderable(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[]
  ): void {
    geometry.dispose();
    const materials = Array.isArray(material) ? material : [material];
    for (const entry of materials) {
      const typedMaterial = entry as THREE.Material & {
        map?: THREE.Texture | null;
        alphaMap?: THREE.Texture | null;
        emissiveMap?: THREE.Texture | null;
      };
      typedMaterial.map?.dispose();
      typedMaterial.alphaMap?.dispose();
      typedMaterial.emissiveMap?.dispose();
      typedMaterial.dispose();
    }
  }
}
