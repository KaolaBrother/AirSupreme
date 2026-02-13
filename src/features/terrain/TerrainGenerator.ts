import * as THREE from 'three';
import { TerrainType, LevelConfig } from './LevelConfig';

/**
 * 地形生成器 - 美化版
 */
export class TerrainGenerator {
  private scene: THREE.Scene;
  private terrainGroup: THREE.Group;
  private waterMesh?: THREE.Mesh;
  private trees: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private grass: THREE.InstancedMesh | null = null;
  private rocks: THREE.Mesh[] = [];
  private time: number = 0;

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
    // 清除旧地形
    this.clearTerrain();

    // 设置天空
    this.createSky(config.skyColors);

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
    this.createClouds();

    // 设置雾
    this.scene.fog = new THREE.FogExp2(config.fogColor, 0.0008);
  }

  /**
   * 生成湖面地形 - 美化版
   */
  private generateLakeTerrain(config: LevelConfig): void {
    // 创建渐变草地
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 200, 200);

    // 添加起伏地形
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // 多层噪声
      const noise1 = Math.sin(x * 0.01) * Math.cos(y * 0.01) * 8;
      const noise2 = Math.sin(x * 0.03 + 1) * Math.cos(y * 0.03) * 3;
      const noise3 = Math.sin(x * 0.005) * Math.cos(y * 0.005) * 15;

      positions.setZ(i, noise1 + noise2 + noise3);
    }
    groundGeometry.computeVertexNormals();

    // 创建草地材质
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: config.groundColor,
      roughness: 0.9,
      metalness: 0,
      flatShading: false,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // 创建中央湖泊
    this.createBeautifulLake(config);

    // 添加森林
    this.createForest(80, -49, 1000, 200);

    // 添加草地细节
    this.createGrassField(500, 100000);

    // 添加野花
    this.createFlowers(300, 20000);

    // 添加岩石
    this.createRocks(30);
  }

  /**
   * 创建美丽的湖泊
   */
  private createBeautifulLake(config: LevelConfig): void {
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
    const lakeMaterial = new THREE.MeshStandardMaterial({
      color: config.waterColor || 0x1e90ff,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.3,
    });
    const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = -48.5;
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
      color: 0xf4e4bc,
      roughness: 1,
      metalness: 0,
    });
    const beach = new THREE.Mesh(beachGeometry, beachMaterial);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = -48.8;
    beach.receiveShadow = true;
    this.terrainGroup.add(beach);
  }

  /**
   * 创建森林
   */
  private createForest(count: number, groundY: number, radius: number, avoidRadius: number): void {
    // 多种树类型
    const treeTypes = [
      { color: 0x228b22, height: 12, width: 6 },  // 橡树
      { color: 0x2e8b57, height: 18, width: 5 },  // 松树
      { color: 0x32cd32, height: 8, width: 4 },   // 小树
      { color: 0x006400, height: 15, width: 7 },  // 大树
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

  /**
   * 创建草地
   */
  private createGrassField(radius: number, count: number): void {
    const grassGeometry = new THREE.ConeGeometry(0.1, 0.5, 4);
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x7cfc00,
      roughness: 0.9,
    });

    this.grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, count);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;

      dummy.position.set(
        Math.cos(angle) * r,
        -49.5,
        Math.sin(angle) * r
      );
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.2,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.2
      );
      dummy.scale.setScalar(0.5 + Math.random() * 1);
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

        dummy.position.set(
          Math.cos(angle) * r,
          -49.3,
          Math.sin(angle) * r
        );
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
      const rockGeometry = new THREE.DodecahedronGeometry(
        1 + Math.random() * 2,
        0
      );

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
      rock.position.set(
        (Math.random() - 0.5) * 1500,
        -49,
        (Math.random() - 0.5) * 1500
      );
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.terrainGroup.add(rock);
      this.rocks.push(rock);
    }
  }

  /**
   * 生成沙漠地形
   */
  private generateDesertTerrain(config: LevelConfig): void {
    // 沙漠地面 - 沙丘效果
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 150, 150);
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
      color: config.groundColor,
      roughness: 1,
      metalness: 0,
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
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, bodyHeight, 8),
      material
    );
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
      armH.rotation.z = Math.PI / 2 * side;
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
      trunk.rotation.set(
        (Math.random() - 0.5) * 0.3,
        0,
        (Math.random() - 0.5) * 0.3
      );
      trunk.castShadow = true;
      tree.add(trunk);

      // 分支
      for (let j = 0; j < 3; j++) {
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.15, 2 + Math.random(), 6),
          material
        );
        branch.position.set(
          (Math.random() - 0.5) * 0.5,
          3 + j * 1.2,
          (Math.random() - 0.5) * 0.5
        );
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
      color: config.groundColor,
      roughness: 0.8,
      metalness: 0,
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
        color: 0x696969,
        roughness: 0.9,
        flatShading: true,
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
        roughness: 0.5,
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
  private createPineForest(count: number, groundY: number, radius: number, avoidRadius: number): void {
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
    // 海面 - 波浪效果
    const oceanGeometry = new THREE.PlaneGeometry(3000, 3000, 200, 200);
    const positions = oceanGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const wave = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 2;
      positions.setZ(i, wave);
    }
    oceanGeometry.computeVertexNormals();

    const oceanMaterial = new THREE.MeshStandardMaterial({
      color: config.waterColor || 0x006994,
      transparent: true,
      opacity: 0.9,
      roughness: 0.1,
      metalness: 0.3,
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
      const x = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;

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

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.4, 8, 8),
      trunkMaterial
    );
    trunk.rotation.set(
      (Math.random() - 0.5) * 0.3,
      0,
      (Math.random() - 0.5) * 0.3
    );
    trunk.position.y = 4;
    trunk.castShadow = true;
    palm.add(trunk);

    // 棕榈叶
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 6),
        leafMaterial
      );
      leaf.position.set(0, 8, 0);
      leaf.rotation.set(
        Math.PI / 4,
        (i / 8) * Math.PI * 2,
        0
      );
      palm.add(leaf);
    }

    // 椰子
    for (let i = 0; i < 3; i++) {
      const coconut = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x654321 })
      );
      coconut.position.set(
        (Math.random() - 0.5) * 0.5,
        7.5,
        (Math.random() - 0.5) * 0.5
      );
      palm.add(coconut);
    }

    return palm;
  }

  /**
   * 生成城市地形
   */
  private generateCityTerrain(config: LevelConfig): void {
    // 地面
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: config.groundColor,
      roughness: 0.7,
      metalness: 0,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // 添加道路
    this.createRoads();

    // 添加建筑物
    this.createBuildings(120);
  }

  /**
   * 创建道路
   */
  private createRoads(): void {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
    });

    // 水平道路
    for (let i = -3; i <= 3; i++) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 20),
        roadMaterial
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, -49.9, i * 250);
      this.terrainGroup.add(road);

      // 道路标线
      const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      for (let j = -20; j <= 20; j++) {
        const line = new THREE.Mesh(
          new THREE.PlaneGeometry(15, 1),
          lineMaterial
        );
        line.rotation.x = -Math.PI / 2;
        line.position.set(j * 50, -49.8, i * 250);
        this.terrainGroup.add(line);
      }
    }

    // 垂直道路
    for (let i = -3; i <= 3; i++) {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 2000),
        roadMaterial
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(i * 250, -49.9, 0);
      this.terrainGroup.add(road);
    }
  }

  /**
   * 创建建筑物
   */
  private createBuildings(count: number): void {
    for (let i = 0; i < count; i++) {
      const gridX = Math.floor((Math.random() - 0.5) * 6);
      const gridZ = Math.floor((Math.random() - 0.5) * 6);

      // 避开道路
      const x = gridX * 250 + (Math.random() - 0.5) * 200;
      const z = gridZ * 250 + (Math.random() - 0.5) * 200;

      const building = this.createBeautifulBuilding();
      building.position.set(x, -50, z);
      this.terrainGroup.add(building);
    }
  }

  /**
   * 创建美丽的建筑
   */
  private createBeautifulBuilding(): THREE.Group {
    const building = new THREE.Group();

    const height = 15 + Math.random() * 60;
    const width = 8 + Math.random() * 15;
    const depth = 8 + Math.random() * 15;

    // 建筑主体
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(
        Math.random() * 0.1 + 0.55,  // 蓝色系
        0.1 + Math.random() * 0.1,
        0.2 + Math.random() * 0.3
      ),
      roughness: 0.5,
      metalness: 0.3,
    });

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      bodyMaterial
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);

    // 窗户
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff99,
      emissive: 0xffff00,
      emissiveIntensity: 0.3,
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

        window.position.set(
          Math.cos(angle) * offset * 0.7,
          y,
          Math.sin(angle) * offset * 0.7
        );
        window.rotation.y = -angle + Math.PI / 2;
        building.add(window);
      }
    }

    // 屋顶装饰
    if (Math.random() > 0.5) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.3, 3, depth * 0.3),
        bodyMaterial
      );
      roof.position.y = height + 1.5;
      building.add(roof);
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
  private createSky(colors: [string, string, string, string]): void {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.3, colors[1]);
    gradient.addColorStop(0.6, colors[2]);
    gradient.addColorStop(1, colors[3]);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }

  /**
   * 创建云朵
   */
  private createClouds(): void {
    for (let i = 0; i < 30; i++) {
      const cloud = this.createFluffyCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 2000,
        80 + Math.random() * 150,
        (Math.random() - 0.5) * 2000
      );
      cloud.scale.setScalar(8 + Math.random() * 15);
      this.terrainGroup.add(cloud);
      this.clouds.push(cloud);
    }
  }

  /**
   * 创建蓬松云朵
   */
  private createFluffyCloud(): THREE.Group {
    const cloud = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    // 多个球体组成云朵
    const puffs = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < puffs; i++) {
      const size = 0.5 + Math.random() * 0.5;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(size, 12, 12),
        material
      );
      puff.position.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.5
      );
      cloud.add(puff);
    }

    return cloud;
  }

  /**
   * 更新水面动画
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;

    if (this.waterMesh) {
      // 水面波动
      const positions = this.waterMesh.geometry.attributes.position;

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const wave = Math.sin(x * 0.05 + this.time) * Math.cos(y * 0.05 + this.time * 0.7) * 2;
        positions.setZ(i, wave);
      }
      positions.needsUpdate = true;
    }

    // 云朵移动
    for (const cloud of this.clouds) {
      cloud.position.x += deltaTime * 3;
      if (cloud.position.x > 1200) {
        cloud.position.x = -1200;
      }
    }
  }

  /**
   * 清除地形
   */
  public clearTerrain(): void {
    while (this.terrainGroup.children.length > 0) {
      const child = this.terrainGroup.children[0];
      this.terrainGroup.remove(child);

      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    this.trees = [];
    this.clouds = [];
    this.waterMesh = undefined;
    this.grass = null;
    this.rocks = [];
  }
}
