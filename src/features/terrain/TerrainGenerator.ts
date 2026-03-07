import * as THREE from 'three';
import { TerrainType, LevelConfig, LevelSurfaceProfile, LevelWeatherConfig } from './LevelConfig';
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('TerrainGenerator');

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
  particleCount: number;
  particleSize: number;
  particleSpeed: number;
  particleDrift: number;
  particleColor: THREE.ColorRepresentation;
  waterWaveScale: number;
  skyGlow: THREE.ColorRepresentation;
}

export class TerrainGenerator {
  private scene: THREE.Scene;
  private terrainGroup: THREE.Group;
  private waterMesh?: THREE.Mesh;
  private trees: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private grass: THREE.InstancedMesh | null = null;
  private rocks: THREE.Mesh[] = [];
  private time: number = 0;
  private weatherParticles?: THREE.Points;
  private weatherParticleBaseHeight: number = 260;
  private weatherParticleSpread: number = 1600;
  private weatherParticleFloor: number = -40;
  private weatherProfile: WeatherProfile = this.getDefaultWeatherProfile(TerrainType.LAKE);

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

    // 添加云朵
    this.createClouds(this.weatherProfile);

    // 添加轻量天气表现
    this.createWeatherEffect(this.weatherProfile);

    // 设置雾（优先使用环境雾色，保持与 GameScene 环境配置一致）
    this.scene.fog = new THREE.FogExp2(config.environment.fogColor ?? config.fogColor, this.weatherProfile.fogDensity);
  }

  /**
   * 生成湖面地形 - 美化版
   */
  private generateLakeTerrain(config: LevelConfig): void {
    const surfaceProfile = this.getSurfaceProfile(config);
    // 创建渐变草地
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 200, 200);
    const lakeRadius = 220;
    const beachRadius = 260;

    // 添加起伏地形
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // 多层噪声
      const noise1 = Math.sin(x * 0.01) * Math.cos(y * 0.01) * 8;
      const noise2 = Math.sin(x * 0.03 + 1) * Math.cos(y * 0.03) * 3;
      const noise3 = Math.sin(x * 0.005) * Math.cos(y * 0.005) * 15;
      const distanceFromCenter = Math.sqrt(x * x + y * y);

      // 为中央湖区挖出浅盆地，避免起伏地形遮挡水面
      let lakeDepression = 0;
      if (distanceFromCenter < beachRadius) {
        const basinT = THREE.MathUtils.clamp(
          (beachRadius - distanceFromCenter) / (beachRadius - lakeRadius),
          0,
          1
        );
        lakeDepression -= basinT * 5.5;
      }
      if (distanceFromCenter < lakeRadius) {
        const centerT = 1 - distanceFromCenter / lakeRadius;
        lakeDepression -= 6.5 + centerT * 3.5;
      }

      positions.setZ(i, noise1 + noise2 + noise3 + lakeDepression);
    }
    groundGeometry.computeVertexNormals();

    // 创建草地材质
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.groundBaseColor ?? this.tintColor(config.groundColor, 0.1, 0.28, 0.12),
      roughness: 0.68,
      metalness: 0,
      emissive:
        surfaceProfile.groundEmissiveColor ?? this.tintColor(config.groundColor, 0.06, 0.4, 0.02),
      emissiveIntensity: 0.42,
      flatShading: false,
      map: this.createDetailTexture(
        surfaceProfile.groundBaseColor ?? 0x79b64d,
        surfaceProfile.groundAccentColor ?? 0x9ddf70,
        surfaceProfile.groundDetailColor ?? 0x5c9a38,
        'grass'
      ),
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // 创建中央湖泊
    this.createBeautifulLake(config, surfaceProfile);

    // 添加森林
    this.createForest(80, -49, 1000, 200);
    this.createForestCluster(28, -420, -260, 180, -49);
    this.createForestCluster(32, 520, -160, 220, -49);
    this.createForestCluster(26, 360, 420, 170, -49);

    // 添加草地细节
    this.createLakeEcologicalGrass(520, 100000);

    // 添加湖岸小景
    this.createLakeShoreProps(surfaceProfile);

    // 添加野花
    this.createFlowers(300, 20000);

    // 添加岩石
    this.createRocks(30);

    // 添加农田和远处山体，提升第一关自然层次
    this.createLakeFarmland(surfaceProfile);
    this.createLakeDirtPaths(surfaceProfile);
    this.createLakeRidges(surfaceProfile);
  }

  /**
   * 创建美丽的湖泊
   */
  private createBeautifulLake(config: LevelConfig, surfaceProfile: LevelSurfaceProfile): void {
    // 湖泊形状 - 不规则圆形
    const lakeShape = new THREE.Shape();
    const points = 64;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 180 + Math.sin(angle * 3) * 20 + Math.cos(angle * 5) * 15;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        lakeShape.moveTo(x, y);
      } else {
        lakeShape.lineTo(x, y);
      }
    }

    const lakeGeometry = new THREE.ShapeGeometry(lakeShape, 32);
    const waterBaseColor =
      surfaceProfile.waterBaseColor ?? this.tintColor(config.waterColor || 0x1e90ff, 0.01, 0.08, 0.02);
    const waterAccentColor = surfaceProfile.waterAccentColor ?? 0x7fd8ff;
    const waterDetailColor = surfaceProfile.waterDetailColor ?? 0x0f5f87;
    const shorelineBaseColor = surfaceProfile.shorelineBaseColor ?? 0xf4e4bc;
    const shorelineAccentColor = surfaceProfile.shorelineAccentColor ?? 0xe2ce9b;
    const shorelineDetailColor = surfaceProfile.shorelineDetailColor ?? 0xc7b18a;

    const lakeMaterial = new THREE.MeshStandardMaterial({
      color: waterBaseColor,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      roughness: 0.1,
      metalness: 0.3,
      emissive: this.tintColor(waterBaseColor, 0.02, 0.2, -0.05),
      emissiveIntensity: 0.28,
      map: this.createDetailTexture(waterBaseColor, waterAccentColor, waterDetailColor, 'water'),
    });
    const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = -47.9;
    lake.renderOrder = 2;
    this.terrainGroup.add(lake);
    this.waterMesh = lake;

    // 添加湖泊边缘的沙滩
    const beachShape = new THREE.Shape();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 200 + Math.sin(angle * 3) * 20 + Math.cos(angle * 5) * 15;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        beachShape.moveTo(x, y);
      } else {
        beachShape.lineTo(x, y);
      }
    }
    // 减去湖泊区域
    beachShape.holes.push(lakeShape);

    const beachGeometry = new THREE.ShapeGeometry(beachShape);
    const beachMaterial = new THREE.MeshStandardMaterial({
      color: shorelineBaseColor,
      roughness: 0.95,
      metalness: 0,
      emissive: this.tintColor(shorelineAccentColor, 0, 0.08, 0.01),
      emissiveIntensity: 0.06,
      map: this.createDetailTexture(
        shorelineBaseColor,
        shorelineAccentColor,
        shorelineDetailColor,
        'beach'
      ),
    });
    const beach = new THREE.Mesh(beachGeometry, beachMaterial);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = -49.1;
    beach.receiveShadow = true;
    this.terrainGroup.add(beach);

    // 湖边湿沙层，增加水岸层次
    const wetShoreShape = new THREE.Shape();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 191 + Math.sin(angle * 3) * 18 + Math.cos(angle * 5) * 13;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        wetShoreShape.moveTo(x, y);
      } else {
        wetShoreShape.lineTo(x, y);
      }
    }
    wetShoreShape.holes.push(lakeShape);

    const wetShore = new THREE.Mesh(
      new THREE.ShapeGeometry(wetShoreShape, 24),
      new THREE.MeshStandardMaterial({
        color: this.tintColor(shorelineBaseColor, -0.03, 0.16, -0.08),
        roughness: 0.72,
        metalness: 0.04,
        emissive: this.tintColor(shorelineAccentColor, -0.02, 0.08, 0.01),
        emissiveIntensity: 0.04,
        map: this.createDetailTexture(
          this.tintColor(shorelineBaseColor, -0.03, 0.16, -0.08),
          shorelineAccentColor,
          shorelineDetailColor,
          'beach'
        ),
      })
    );
    wetShore.rotation.x = -Math.PI / 2;
    wetShore.position.y = -48.75;
    wetShore.receiveShadow = true;
    this.terrainGroup.add(wetShore);

    // 外缘草甸过渡层
    const meadowRingShape = new THREE.Shape();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 250 + Math.sin(angle * 3) * 24 + Math.cos(angle * 5) * 16;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        meadowRingShape.moveTo(x, y);
      } else {
        meadowRingShape.lineTo(x, y);
      }
    }
    meadowRingShape.holes.push(beachShape);

    const meadowColor = this.tintColor(surfaceProfile.groundBaseColor ?? 0x79b64d, 0.01, 0.12, 0.03);
    const meadow = new THREE.Mesh(
      new THREE.ShapeGeometry(meadowRingShape, 24),
      new THREE.MeshStandardMaterial({
        color: meadowColor,
        roughness: 0.88,
        metalness: 0,
        emissive: this.tintColor(meadowColor, 0.01, 0.08, 0.01),
        emissiveIntensity: 0.04,
        map: this.createDetailTexture(
          meadowColor,
          surfaceProfile.groundAccentColor ?? 0x9ddf70,
          surfaceProfile.groundDetailColor ?? 0x5c9a38,
          'grass'
        ),
      })
    );
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.y = -48.95;
    meadow.receiveShadow = true;
    this.terrainGroup.add(meadow);
  }

  /**
   * 创建森林
   */
  private createForest(count: number, groundY: number, radius: number, avoidRadius: number): void {
    // 多种树类型
    const treeTypes = [
      { color: 0x228b22, height: 12, width: 6 }, // 橡树
      { color: 0x2e8b57, height: 18, width: 5 }, // 松树
      { color: 0x32cd32, height: 8, width: 4 }, // 小树
      { color: 0x006400, height: 15, width: 7 }, // 大树
    ];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = avoidRadius + Math.random() * (radius - avoidRadius);

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // 随机选择树类型
      const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
      const tree = this.createBeautifulTree(treeType.color, treeType.height, treeType.width);
      tree.position.set(x, groundY, z);
      tree.scale.setScalar(0.8 + Math.random() * 0.6);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(tree);
      this.trees.push(tree);
    }
  }

  /**
   * 创建美丽的树
   */
  private createBeautifulTree(color: number, height: number, width: number): THREE.Group {
    const tree = new THREE.Group();

    // 树干
    const trunkGeometry = new THREE.CylinderGeometry(width * 0.08, width * 0.15, height * 0.4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = height * 0.2;
    trunk.castShadow = true;
    tree.add(trunk);

    // 多层树冠
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
    });

    // 底层 - 最宽
    const foliage1 = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.8, height * 0.4, 8),
      foliageMaterial
    );
    foliage1.position.y = height * 0.5;
    foliage1.castShadow = true;
    tree.add(foliage1);

    // 中层
    const foliage2 = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.6, height * 0.35, 8),
      foliageMaterial
    );
    foliage2.position.y = height * 0.7;
    foliage2.castShadow = true;
    tree.add(foliage2);

    // 顶层 - 最窄
    const foliage3 = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.4, height * 0.3, 8),
      foliageMaterial
    );
    foliage3.position.y = height * 0.9;
    foliage3.castShadow = true;
    tree.add(foliage3);

    return tree;
  }

  private createLakeEcologicalGrass(radius: number, count: number): void {
    const grassGeometry = new THREE.ConeGeometry(0.1, 0.5, 4);
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0xa7ff54,
      emissive: 0x4f8b24,
      emissiveIntensity: 0.52,
      roughness: 0.84,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    this.grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, count);
    this.grass.castShadow = false;
    this.grass.receiveShadow = false;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const normalized = Math.random();
      const r = Math.pow(normalized, 0.82) * radius;
      const shorelineBias = r < 240 ? 0.65 : r < 320 ? 0.9 : 1.15;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const nearForestBoost =
        (x < -260 && z < -40 ? 0.2 : 0)
        + (x > 260 && z < 30 ? 0.18 : 0)
        + (x > 180 && z > 220 ? 0.16 : 0);

      dummy.position.set(x, -49.5, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.2,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.2
      );
      dummy.scale.setScalar((0.45 + Math.random() * 0.9) * shorelineBias + nearForestBoost);
      dummy.updateMatrix();
      this.grass.setMatrixAt(i, dummy.matrix);
    }

    this.grass.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(this.grass);
  }

  /**
   * 创建野花
   */
  private createFlowers(radius: number, count: number): void {
    const flowerColors = [0xff69b4, 0xffd700, 0xff6347, 0x9370db, 0x00ced1];
    const flowerGeometry = new THREE.SphereGeometry(0.15, 8, 8);

    // 创建不同颜色的花
    flowerColors.forEach((color) => {
      const flowerMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.1,
      });

      const flowers = new THREE.InstancedMesh(
        flowerGeometry,
        flowerMaterial,
        Math.floor(count / flowerColors.length)
      );

      const dummy = new THREE.Object3D();
      for (let i = 0; i < Math.floor(count / flowerColors.length); i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;

        dummy.position.set(Math.cos(angle) * r, -49.3, Math.sin(angle) * r);
        dummy.scale.setScalar(0.8 + Math.random() * 0.4);
        dummy.updateMatrix();
        flowers.setMatrixAt(i, dummy.matrix);
      }

      flowers.instanceMatrix.needsUpdate = true;
      this.terrainGroup.add(flowers);
    });
  }

  /**
   * 创建岩石
   */
  private createRocks(count: number): void {
    for (let i = 0; i < count; i++) {
      const rockGeometry = new THREE.DodecahedronGeometry(1 + Math.random() * 2, 0);

      // 随机变形
      const positions = rockGeometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        positions.setX(j, positions.getX(j) * (0.8 + Math.random() * 0.4));
        positions.setY(j, positions.getY(j) * (0.6 + Math.random() * 0.8));
        positions.setZ(j, positions.getZ(j) * (0.8 + Math.random() * 0.4));
      }
      rockGeometry.computeVertexNormals();

      const rockMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.2),
        roughness: 0.9,
        metalness: 0.1,
      });

      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      rock.position.set((Math.random() - 0.5) * 1500, -49, (Math.random() - 0.5) * 1500);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.terrainGroup.add(rock);
      this.rocks.push(rock);
    }
  }

  private createForestCluster(
    count: number,
    centerX: number,
    centerZ: number,
    radius: number,
    groundY: number
  ): void {
    const treeTypes = [
      { color: 0x2f7d32, height: 11, width: 5 },
      { color: 0x3a8b4a, height: 16, width: 5.5 },
      { color: 0x5aa04b, height: 9, width: 4.2 },
      { color: 0x1f6130, height: 14, width: 6.5 },
    ];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const x = centerX + Math.cos(angle) * distance;
      const z = centerZ + Math.sin(angle) * distance;
      const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
      const tree = this.createBeautifulTree(treeType.color, treeType.height, treeType.width);
      tree.position.set(x, groundY, z);
      tree.scale.setScalar(0.7 + Math.random() * 0.65);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(tree);
      this.trees.push(tree);
    }
  }

  private createLakeFarmland(surfaceProfile: LevelSurfaceProfile): void {
    const fieldGroup = new THREE.Group();
    fieldGroup.name = 'lakeFarmland';
    const fieldColors = [
      surfaceProfile.groundAccentColor ?? 0x98c96b,
      0xc8b86d,
      0x8db15b,
      0xb89f58,
    ];

    const baseX = -620;
    const baseZ = 360;
    const rows = 3;
    const cols = 4;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const fieldWidth = 90 + Math.random() * 45;
        const fieldDepth = 70 + Math.random() * 50;
        const color = fieldColors[(row * cols + col) % fieldColors.length];
        const field = new THREE.Mesh(
          new THREE.PlaneGeometry(fieldWidth, fieldDepth),
          new THREE.MeshStandardMaterial({
            color,
            roughness: 0.92,
            metalness: 0,
            emissive: this.tintColor(color, -0.02, 0.12, -0.04),
            emissiveIntensity: 0.05,
            map: this.createDetailTexture(
              color,
              this.tintColor(color, 0.01, 0.08, 0.03),
              this.tintColor(color, -0.01, 0.12, -0.06),
              'grass'
            ),
          })
        );
        field.rotation.x = -Math.PI / 2;
        field.position.set(
          baseX + col * 110 + (Math.random() - 0.5) * 18,
          -48.6 + row * 0.03,
          baseZ + row * 95 + (Math.random() - 0.5) * 12
        );
        field.rotation.z = (Math.random() - 0.5) * 0.12;
        field.receiveShadow = true;
        fieldGroup.add(field);

        const border = new THREE.Mesh(
          new THREE.BoxGeometry(fieldWidth + 6, 0.4, 3.2),
          new THREE.MeshStandardMaterial({
            color: 0x705733,
            roughness: 0.95,
            metalness: 0,
          })
        );
        border.position.set(field.position.x, -48.45, field.position.z - fieldDepth * 0.5);
        border.rotation.y = field.rotation.z;
        border.castShadow = true;
        border.receiveShadow = true;
        fieldGroup.add(border);
      }
    }

    const barn = new THREE.Group();
    const barnBody = new THREE.Mesh(
      new THREE.BoxGeometry(36, 16, 26),
      new THREE.MeshStandardMaterial({
        color: 0x9c5038,
        roughness: 0.82,
        metalness: 0.05,
      })
    );
    barnBody.position.y = 8;
    barnBody.castShadow = true;
    barnBody.receiveShadow = true;
    barn.add(barnBody);

    const barnRoof = new THREE.Mesh(
      new THREE.ConeGeometry(22, 10, 4),
      new THREE.MeshStandardMaterial({
        color: 0x5c3c32,
        roughness: 0.76,
        metalness: 0.08,
      })
    );
    barnRoof.rotation.y = Math.PI / 4;
    barnRoof.position.y = 19;
    barnRoof.scale.set(1.1, 1, 0.7);
    barnRoof.castShadow = true;
    barn.add(barnRoof);

    barn.position.set(baseX + 80, -49, baseZ + 70);
    this.terrainGroup.add(fieldGroup);
    this.terrainGroup.add(barn);
  }

  private createLakeDirtPaths(surfaceProfile: LevelSurfaceProfile): void {
    const pathColor = this.tintColor(surfaceProfile.shorelineDetailColor ?? 0xc8b387, -0.02, 0.14, -0.06);
    const pathMaterial = new THREE.MeshStandardMaterial({
      color: pathColor,
      roughness: 0.96,
      metalness: 0,
      map: this.createDetailTexture(
        pathColor,
        this.tintColor(pathColor, 0.01, 0.06, 0.04),
        this.tintColor(pathColor, -0.01, 0.1, -0.08),
        'sand'
      ),
    });

    const pathSegments = [
      { width: 240, depth: 18, x: -430, z: 310, rot: 0.34 },
      { width: 160, depth: 16, x: -220, z: 180, rot: 0.6 },
      { width: 180, depth: 14, x: 340, z: -120, rot: -0.42 },
    ];

    for (const segment of pathSegments) {
      const path = new THREE.Mesh(
        new THREE.PlaneGeometry(segment.width, segment.depth),
        pathMaterial
      );
      path.rotation.x = -Math.PI / 2;
      path.rotation.z = segment.rot;
      path.position.set(segment.x, -48.72, segment.z);
      path.receiveShadow = true;
      this.terrainGroup.add(path);
    }
  }

  private createLakeShoreProps(surfaceProfile: LevelSurfaceProfile): void {
    const reedMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(surfaceProfile.groundAccentColor ?? 0x9ddf70, -0.02, 0.16, -0.06),
      roughness: 0.88,
      metalness: 0,
      emissive: this.tintColor(surfaceProfile.groundAccentColor ?? 0x9ddf70, 0.01, 0.12, 0.02),
      emissiveIntensity: 0.05,
      side: THREE.DoubleSide,
    });
    const reedGeometry = new THREE.BoxGeometry(0.08, 0.9, 0.08);
    const reeds = new THREE.InstancedMesh(reedGeometry, reedMaterial, 240);
    reeds.castShadow = false;
    reeds.receiveShadow = false;

    const reedDummy = new THREE.Object3D();
    for (let i = 0; i < 240; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 198 + Math.random() * 48;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      reedDummy.position.set(x, -48.88, z);
      reedDummy.rotation.set(
        (Math.random() - 0.5) * 0.06,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.18
      );
      reedDummy.scale.set(0.7 + Math.random() * 0.35, 0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.35);
      reedDummy.updateMatrix();
      reeds.setMatrixAt(i, reedDummy.matrix);
    }
    reeds.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(reeds);

    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(surfaceProfile.shorelineDetailColor ?? 0xc7b18a, -0.03, 0.08, -0.05),
      roughness: 0.96,
      metalness: 0,
    });
    const stoneGeometry = new THREE.DodecahedronGeometry(0.38, 0);
    const stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, 160);
    stones.castShadow = true;
    stones.receiveShadow = true;

    const stoneDummy = new THREE.Object3D();
    for (let i = 0; i < 160; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 208 + Math.random() * 54;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      stoneDummy.position.set(x, -48.82, z);
      stoneDummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      stoneDummy.scale.setScalar(0.45 + Math.random() * 0.65);
      stoneDummy.updateMatrix();
      stones.setMatrixAt(i, stoneDummy.matrix);
    }
    stones.instanceMatrix.needsUpdate = true;
    this.terrainGroup.add(stones);
  }

  private createLakeRidges(surfaceProfile: LevelSurfaceProfile): void {
    const ridgeColor = this.tintColor(
      surfaceProfile.groundDetailColor ?? 0x5c9a38,
      -0.02,
      0.22,
      -0.08
    );
    const ridgeCapColor = this.tintColor(
      surfaceProfile.groundAccentColor ?? 0x9ddf70,
      0.02,
      0.1,
      0.08
    );

    for (let i = 0; i < 7; i++) {
      const ridge = new THREE.Group();
      const width = 180 + Math.random() * 120;
      const height = 120 + Math.random() * 90;
      const depth = 120 + Math.random() * 80;

      const base = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.42, height, 6),
        new THREE.MeshStandardMaterial({
          color: ridgeColor,
          roughness: 0.92,
          metalness: 0.03,
        })
      );
      base.position.y = height * 0.5;
      base.scale.z = depth / width;
      base.castShadow = true;
      base.receiveShadow = true;
      ridge.add(base);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.2, height * 0.26, 6),
        new THREE.MeshStandardMaterial({
          color: ridgeCapColor,
          roughness: 0.88,
          metalness: 0,
        })
      );
      cap.position.y = height * 0.92;
      cap.scale.z = depth / width;
      cap.castShadow = true;
      ridge.add(cap);

      const angle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
      const radius = 820 + Math.random() * 280;
      ridge.position.set(Math.cos(angle) * radius, -50, Math.sin(angle) * radius);
      ridge.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(ridge);
      this.rocks.push(base);
    }
  }

  /**
   * 生成沙漠地形
   */
  private generateDesertTerrain(config: LevelConfig): void {
    // 沙漠地面 - 沙丘效果
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 200, 200); // 提高细节到200x200
    const positions = groundGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // 沙丘波浪
      const dune1 = Math.sin(x * 0.008 + y * 0.003) * 8;
      const dune2 = Math.sin(x * 0.015) * Math.cos(y * 0.012) * 5;
      const dune3 = Math.sin(x * 0.004 + y * 0.006) * 12;

      positions.setZ(i, Math.max(0, dune1 + dune2 + dune3));
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(config.groundColor, 0.01, 0.08, 0.01),
      roughness: 1,
      metalness: 0,
      emissive: this.tintColor(config.groundColor, -0.01, 0.2, -0.15),
      emissiveIntensity: 0.08,
      map: this.createDetailTexture(config.groundColor, 0xe0ba74, 0xa6752d, 'sand'),
      polygonOffset: true, // 修复Z-fighting闪烁
      polygonOffsetFactor: 1, // 偏移因子
      polygonOffsetUnits: 1,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // 添加仙人掌
    this.createCacti(50);

    // 添加沙漠岩石
    this.createRocks(20);

    // 添加枯木
    this.createDeadTrees(15);
  }

  /**
   * 创建仙人掌
   */
  private createCacti(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 1500;
      const z = (Math.random() - 0.5) * 1500;

      const cactus = this.createBeautifulCactus();
      cactus.position.set(x, -50, z);
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
      const x = (Math.random() - 0.5) * 1500;
      const z = (Math.random() - 0.5) * 1500;

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

      tree.position.set(x, -50, z);
      tree.scale.setScalar(0.5 + Math.random() * 0.5);
      this.terrainGroup.add(tree);
    }
  }

  /**
   * 生成山地地形
   */
  private generateMountainTerrain(config: LevelConfig): void {
    // 雪地基础
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 150, 150);
    const positions = groundGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // 山峰效果
      const mountain1 = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 40;
      const mountain2 = Math.sin(x * 0.035) * Math.cos(y * 0.03) * 20;
      const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 5;

      positions.setZ(i, Math.max(0, mountain1 + mountain2 + noise));
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: this.tintColor(config.groundColor, 0, -0.1, 0.03),
      roughness: 0.8,
      metalness: 0,
      map: this.createDetailTexture(config.groundColor, 0xeaf4ff, 0xb8c8d8, 'snow'),
      polygonOffset: true, // 修复Z-fighting闪烁
      polygonOffsetFactor: 1, // 偏移因子
      polygonOffsetUnits: 1,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // 添加山峰
    this.createBeautifulMountains(20);

    // 添加雪松
    this.createPineForest(60, -50, 800, 200);
  }

  /**
   * 创建美丽的山峰
   */
  private createBeautifulMountains(count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 400 + Math.random() * 400;

      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const mountain = new THREE.Group();

      // 主峰
      const peakHeight = 60 + Math.random() * 60;
      const peakWidth = 30 + Math.random() * 20;

      const peakMaterial = new THREE.MeshStandardMaterial({
        color: this.tintColor(0x696969, 0, -0.05, -0.05),
        roughness: 0.9,
        flatShading: true,
        map: this.createDetailTexture(0x696969, 0x848484, 0x424242, 'rock'),
      });

      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(peakWidth, peakHeight, 6 + Math.floor(Math.random() * 3)),
        peakMaterial
      );
      peak.position.y = peakHeight / 2;
      peak.castShadow = true;
      mountain.add(peak);

      // 雪顶
      const snowMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.45,
        emissive: 0xbfd7ff,
        emissiveIntensity: 0.06,
        map: this.createDetailTexture(0xffffff, 0xe6f3ff, 0xd7dde5, 'snow'),
      });
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(peakWidth * 0.5, peakHeight * 0.35, 6),
        snowMaterial
      );
      snow.position.y = peakHeight * 0.7;
      mountain.add(snow);

      mountain.position.set(x, -50, z);
      mountain.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(mountain);
    }
  }

  /**
   * 创建松树林
   */
  private createPineForest(
    count: number,
    groundY: number,
    radius: number,
    avoidRadius: number
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = avoidRadius + Math.random() * (radius - avoidRadius);

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const tree = this.createPineTree();
      tree.position.set(x, groundY, z);
      tree.scale.setScalar(0.6 + Math.random() * 0.8);
      this.terrainGroup.add(tree);
      this.trees.push(tree);
    }
  }

  /**
   * 创建松树
   */
  private createPineTree(): THREE.Group {
    const tree = new THREE.Group();

    // 树干
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.4, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a3728 })
    );
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    tree.add(trunk);

    // 多层松针
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a472a,
      roughness: 0.8,
    });

    for (let i = 0; i < 5; i++) {
      const layer = new THREE.Mesh(
        new THREE.ConeGeometry(2 - i * 0.3, 2.5 - i * 0.3, 8),
        foliageMaterial
      );
      layer.position.y = 3 + i * 1.5;
      layer.castShadow = true;
      tree.add(layer);
    }

    // 雪覆盖
    if (Math.random() > 0.5) {
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      snow.position.y = 10;
      tree.add(snow);
    }

    return tree;
  }

  /**
   * 生成海洋地形
   */
  private generateOceanTerrain(config: LevelConfig): void {
    const surfaceProfile = this.getSurfaceProfile(config);
    // 海面 - 波浪效果
    const oceanGeometry = new THREE.PlaneGeometry(2000, 2000, 200, 200);
    const positions = oceanGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const wave = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 2;
      positions.setZ(i, wave);
    }
    oceanGeometry.computeVertexNormals();

    const oceanMaterial = new THREE.MeshStandardMaterial({
      color:
        surfaceProfile.waterBaseColor ?? this.tintColor(config.waterColor || 0x006994, 0, 0.08, 0.02),
      transparent: true,
      opacity: 0.9,
      roughness: 0.14,
      metalness: 0.34,
      emissive: this.tintColor(
        surfaceProfile.waterDetailColor ?? (config.waterColor || 0x006994),
        0.01,
        0.18,
        -0.02
      ),
      emissiveIntensity: 0.24,
      map: this.createDetailTexture(
        surfaceProfile.waterBaseColor ?? (config.waterColor || 0x006994),
        surfaceProfile.waterAccentColor ?? 0x7bd6ff,
        surfaceProfile.waterDetailColor ?? 0x03415d,
        'water'
      ),
    });

    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -50;
    this.terrainGroup.add(ocean);
    this.waterMesh = ocean;

    // 添加热带岛屿
    this.createTropicalIslands(10);

    // 添加棕榈树
    this.createPalmTrees(40);
  }

  /**
   * 创建热带岛屿
   */
  private createTropicalIslands(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 1800;
      const z = (Math.random() - 0.5) * 1800;

      const island = new THREE.Group();

      // 岛屿基座
      const baseSize = 15 + Math.random() * 25;
      const base = new THREE.Mesh(
        new THREE.ConeGeometry(baseSize, baseSize * 0.5, 8),
        new THREE.MeshStandardMaterial({
          color: 0xc2b280,
          roughness: 1,
        })
      );
      base.position.y = -47;
      island.add(base);

      // 沙滩
      const beach = new THREE.Mesh(
        new THREE.CylinderGeometry(baseSize * 1.3, baseSize * 1.5, 2, 16),
        new THREE.MeshStandardMaterial({
          color: 0xf4e4bc,
          roughness: 1,
        })
      );
      beach.position.y = -48;
      island.add(beach);

      // 植被
      const vegetation = new THREE.Mesh(
        new THREE.ConeGeometry(baseSize * 0.8, baseSize * 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x228b22 })
      );
      vegetation.position.y = -46;
      island.add(vegetation);

      island.position.set(x, 0, z);
      this.terrainGroup.add(island);
    }
  }

  /**
   * 创建棕榈树
   */
  private createPalmTrees(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 1800;
      const z = (Math.random() - 0.5) * 1800;

      const palm = this.createBeautifulPalmTree();
      palm.position.set(x, -48, z);
      palm.scale.setScalar(0.5 + Math.random() * 0.5);
      palm.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(palm);
      this.trees.push(palm);
    }
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
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
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

    // 添加建筑物
    this.createBuildings(108, surfaceProfile);
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

    // 水平道路
    for (let i = -3; i <= 3; i++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(2000, 20), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, -49.9, i * 250);
      this.terrainGroup.add(road);

      // 道路标线
      const lineMaterial = new THREE.MeshStandardMaterial({
        color: surfaceProfile.roadLineColor ?? 0xf0f4ff,
        emissive: 0x9eb2d6,
        emissiveIntensity: 0.14,
      });
      for (let j = -20; j <= 20; j++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(15, 1), lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(j * 50, -49.8, i * 250);
        this.terrainGroup.add(line);
      }

      for (let j = -3; j <= 3; j++) {
        const roadLight = new THREE.Mesh(
          new THREE.PlaneGeometry(5, 1.4),
          new THREE.MeshStandardMaterial({
            color: 0xffd997,
            emissive: 0xffc56b,
            emissiveIntensity: 0.46,
            roughness: 0.24,
            metalness: 0.1,
          })
        );
        roadLight.rotation.x = -Math.PI / 2;
        roadLight.position.set(j * 250, -49.76, i * 250 + 8);
        this.terrainGroup.add(roadLight);
      }
    }

    // 垂直道路
    for (let i = -3; i <= 3; i++) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(20, 2000), roadMaterial);
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

    for (let gx = -3; gx <= 2; gx++) {
      for (let gz = -3; gz <= 2; gz++) {
        const plaza = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), plazaMaterial);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(gx * 250 + 125, -49.92, gz * 250 + 125);
        this.terrainGroup.add(plaza);

        const basePad = new THREE.Mesh(new THREE.PlaneGeometry(162, 162), basePadMaterial);
        basePad.rotation.x = -Math.PI / 2;
        basePad.position.set(gx * 250 + 125, -49.86, gz * 250 + 125);
        this.terrainGroup.add(basePad);

        if ((gx + gz) % 2 === 0) {
          const plazaLight = new THREE.Mesh(
            new THREE.PlaneGeometry(26, 4),
            new THREE.MeshStandardMaterial({
              color: 0xffd595,
              emissive: 0xffc266,
              emissiveIntensity: 0.42,
              roughness: 0.26,
              metalness: 0.08,
            })
          );
          plazaLight.rotation.x = -Math.PI / 2;
          plazaLight.position.set(gx * 250 + 125, -49.8, gz * 250 + 50);
          this.terrainGroup.add(plazaLight);
        }
      }
    }
  }

  /**
   * 创建建筑物
   */
  private createBuildings(count: number, surfaceProfile: LevelSurfaceProfile): void {
    for (let i = 0; i < count; i++) {
      const gridX = Math.floor((Math.random() - 0.5) * 6);
      const gridZ = Math.floor((Math.random() - 0.5) * 6);

      // 避开道路
      const x = gridX * 250 + (Math.random() - 0.5) * 200;
      const z = gridZ * 250 + (Math.random() - 0.5) * 200;

      const building = this.createBeautifulBuilding(surfaceProfile);
      building.position.set(x, -50, z);
      this.terrainGroup.add(building);
    }
  }

  /**
   * 创建美丽的建筑
   */
  private createBeautifulBuilding(surfaceProfile: LevelSurfaceProfile): THREE.Group {
    const building = new THREE.Group();

    const height = 15 + Math.random() * 60;
    const width = 8 + Math.random() * 15;
    const depth = 8 + Math.random() * 15;

    // 建筑主体
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(surfaceProfile.buildingBaseColor ?? 0x6e8196).offsetHSL(
        (Math.random() - 0.5) * 0.02,
        -0.02 + Math.random() * 0.04,
        -0.08 + Math.random() * 0.14
      ),
      roughness: 0.42,
      metalness: 0.18,
      emissive: 0x10131a,
      emissiveIntensity: 0.06,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterial);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);

    // 窗户
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: surfaceProfile.windowColor ?? 0xffe3a6,
      emissive: surfaceProfile.windowColor ?? 0xffcf6b,
      emissiveIntensity: 0.95,
    });

    const windowSize = 1.5;
    const windowGap = 4;

    for (let y = 3; y < height - 3; y += windowGap) {
      for (let i = 0; i < 4; i++) {
        const window = new THREE.Mesh(
          new THREE.PlaneGeometry(windowSize, windowSize * 1.5),
          windowMaterial
        );

        const angle = (i / 4) * Math.PI * 2;
        const offset = (i % 2 === 0 ? width : depth) / 2 + 0.1;

        window.position.set(Math.cos(angle) * offset * 0.7, y, Math.sin(angle) * offset * 0.7);
        window.rotation.y = -angle + Math.PI / 2;
        building.add(window);
      }
    }

    // 屋顶装饰
    if (Math.random() > 0.5) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.3, 3, depth * 0.3), bodyMaterial);
      roof.position.y = height + 1.5;
      building.add(roof);
    }

    if (Math.random() > 0.35) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.92, 0.6, depth * 0.92),
        new THREE.MeshStandardMaterial({
          color: surfaceProfile.buildingTrimColor ?? 0xd2dce6,
          roughness: 0.3,
          metalness: 0.36,
          emissive: 0x243042,
          emissiveIntensity: 0.08,
        })
      );
      trim.position.y = 0.4;
      building.add(trim);
    }

    if (Math.random() > 0.45) {
      const facadeLight = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.45, 1.2),
        new THREE.MeshStandardMaterial({
          color: 0xffd9a0,
          emissive: 0xffca78,
          emissiveIntensity: 0.65,
          roughness: 0.18,
          metalness: 0.06,
        })
      );
      facadeLight.position.set(0, height * 0.4, depth * 0.5 + 0.12);
      building.add(facadeLight);
    }

    if (Math.random() > 0.65) {
      const rooftopBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x8fd6ff,
          emissive: 0x74c8ff,
          emissiveIntensity: 0.9,
          roughness: 0.12,
          metalness: 0.18,
        })
      );
      rooftopBeacon.position.set(0, height + 3, 0);
      building.add(rooftopBeacon);
    }

    // 天线
    if (Math.random() > 0.7) {
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 5, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      );
      antenna.position.y = height + 2.5;
      building.add(antenna);
    }

    return building;
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
    for (let i = 0; i < profile.cloudCount; i++) {
      const cloud = this.createFluffyCloud(profile);
      const initialY =
        profile.cloudHeightMin + Math.random() * (profile.cloudHeightMax - profile.cloudHeightMin);
      cloud.position.set(
        (Math.random() - 0.5) * 2000,
        initialY,
        (Math.random() - 0.5) * 2000
      );
      cloud.scale.setScalar(8 + Math.random() * (10 + profile.intensity * 10));
      cloud.userData.baseY = initialY;
      cloud.userData.floatAmplitude = 1 + Math.random() * (1.5 + profile.intensity * 2);
      cloud.userData.floatSpeed = 0.12 + Math.random() * 0.18 + profile.intensity * 0.08;
      cloud.userData.floatPhase = Math.random() * Math.PI * 2;
      cloud.userData.spinSpeed = (Math.random() - 0.5) * (0.02 + profile.intensity * 0.04);
      cloud.renderOrder = 6;
      this.terrainGroup.add(cloud);
      this.clouds.push(cloud);
    }
  }

  /**
   * 创建蓬松云朵
   */
  private createFluffyCloud(profile: WeatherProfile): THREE.Group {
    const cloud = new THREE.Group();
    const backMaterial = new THREE.MeshBasicMaterial({
      color: profile.cloudTint,
      transparent: true,
      opacity: profile.cloudOpacity * 0.34,
      depthWrite: false,
      depthTest: true,
      fog: true,
      toneMapped: false,
      side: THREE.BackSide,
    });
    const frontMaterial = new THREE.MeshBasicMaterial({
      color: profile.cloudTint,
      transparent: true,
      opacity: profile.cloudOpacity * 0.22,
      depthWrite: false,
      depthTest: true,
      fog: true,
      toneMapped: false,
      side: THREE.FrontSide,
    });

    const puffs = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < puffs; i++) {
      const size = 0.5 + Math.random() * 0.5;
      const geometry = new THREE.SphereGeometry(size, 10, 10);
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 2.6,
        (Math.random() - 0.5) * 0.65,
        (Math.random() - 0.5) * 1.9
      );
      const scale = new THREE.Vector3(
        1 + Math.random() * 0.35,
        0.7 + Math.random() * 0.25,
        1 + Math.random() * 0.45
      );
      const backPuff = new THREE.Mesh(geometry, backMaterial);
      backPuff.position.copy(position);
      backPuff.scale.copy(scale);
      backPuff.castShadow = false;
      backPuff.receiveShadow = false;
      backPuff.renderOrder = 6;
      cloud.add(backPuff);

      const frontPuff = new THREE.Mesh(geometry, frontMaterial);
      frontPuff.position.copy(position);
      frontPuff.scale.copy(scale);
      frontPuff.castShadow = false;
      frontPuff.receiveShadow = false;
      frontPuff.renderOrder = 7;
      cloud.add(frontPuff);
    }

    return cloud;
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
        const wave =
          (Math.sin(x * 0.05 + this.time * (1 + this.weatherProfile.intensity * 0.25)) *
            Math.cos(y * 0.05 + this.time * 0.7) +
            Math.sin(x * 0.03 - this.time * 0.6) * 0.4) *
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
      }
    }

    // 云朵移动
    for (const cloud of this.clouds) {
      const baseY =
        typeof cloud.userData.baseY === 'number' ? cloud.userData.baseY : cloud.position.y;
      const floatAmplitude =
        typeof cloud.userData.floatAmplitude === 'number' ? cloud.userData.floatAmplitude : 1;
      const floatSpeed =
        typeof cloud.userData.floatSpeed === 'number' ? cloud.userData.floatSpeed : 0.15;
      const floatPhase =
        typeof cloud.userData.floatPhase === 'number' ? cloud.userData.floatPhase : 0;
      const spinSpeed =
        typeof cloud.userData.spinSpeed === 'number' ? cloud.userData.spinSpeed : 0;

      cloud.position.x += deltaTime * this.weatherProfile.cloudSpeed;
      cloud.position.y =
        baseY + Math.sin(this.time * floatSpeed + floatPhase) * floatAmplitude;
      cloud.rotation.y += deltaTime * spinSpeed;
      if (cloud.position.x > 1200) {
        cloud.position.x = -1200;
      }
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
          positions.array[index] = (Math.random() - 0.5) * this.weatherParticleSpread;
          positions.array[index + 1] = 60 + Math.random() * this.weatherParticleBaseHeight;
          positions.array[index + 2] = (Math.random() - 0.5) * this.weatherParticleSpread;
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
  }

  /**
   * 更新地形 LOD - 根据玩家距离隐藏远处树木和岩石
   */
  public updateLOD(playerPosition: THREE.Vector3): void {
    const LOD_FAR = 600;

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

      // 清理 Mesh
      if (child instanceof THREE.Mesh) {
        this.disposeRenderable(child.geometry, child.material);
      }
      // 清理 InstancedMesh（草地、花）
      else if (child instanceof THREE.InstancedMesh) {
        this.disposeRenderable(child.geometry, child.material);
      }
      // 清理天气粒子
      else if (child instanceof THREE.Points) {
        this.disposeRenderable(child.geometry, child.material);
      }
      // 清理 Group（树木、云朵等）
      else if (child instanceof THREE.Group) {
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            this.disposeRenderable(obj.geometry, obj.material);
          } else if (obj instanceof THREE.Sprite) {
            const spriteMaterial = obj.material;
            if (Array.isArray(spriteMaterial)) {
              for (const material of spriteMaterial) {
                material.dispose();
              }
            } else {
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
    this.clouds = [];
    this.waterMesh = undefined;
    this.grass = null;
    this.rocks = [];
    this.weatherParticles = undefined;

    log.debug('clearTerrain: Complete', { remainingChildren: this.terrainGroup.children.length });
  }

  private resolveWeatherProfile(config: LevelConfig): WeatherProfile {
    const baseProfile = this.getDefaultWeatherProfile(config.terrain);
    const weatherPresetMap: Record<LevelWeatherConfig['preset'], WeatherType> = {
      clear: 'clear',
      mist: 'mist',
      windy: 'mist',
      sandstorm: 'dust',
      snow: 'snow',
      storm: 'storm',
      smog: 'smog',
    };
    const weatherConfig = config.weather;
    const environmentConfig = config.environment;
    const cloudCover = environmentConfig.cloudCover ?? weatherConfig.cloudCoverage;

    const resolvedProfile: WeatherProfile = {
      ...baseProfile,
      type: weatherPresetMap[weatherConfig.preset] ?? baseProfile.type,
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
        };
      case TerrainType.MOUNTAINS:
        return {
          type: 'snow',
          intensity: 0.45,
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
        };
      case TerrainType.OCEAN:
        return {
          type: 'storm',
          intensity: 0.5,
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
        };
      case TerrainType.CITY:
        return {
          type: 'smog',
          intensity: 0.4,
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
        };
      case TerrainType.LAKE:
      default:
        return {
          type: 'clear',
          intensity: 0.2,
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
          roughness: 0.2,
          metalness: 0.34,
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
