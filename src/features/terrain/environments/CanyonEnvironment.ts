/**
 * CANYON（第 8 关「雷霆峡谷」）：终年雷暴的西部荒原峡谷群。
 *
 * - 三条沿 Z 向蜿蜒的层理砂岩峡谷（主峡谷 + 西侧悬谷 + 东侧狭缝峡谷），阶梯状崖壁与平顶台地，
 *   战场东西两侧更高一级的断崖；玩家出生即位于主峡谷中，前方（-Z）峡谷展宽为孤丘盆地；
 * - 谷底暴涨的红泥河（急流浪花、雨点涟漪、闪电映照）与车队「长弓」的土路；
 * - 沿崖壁台阶层层倾泻的暴雨瀑布（直接贴在崖壁三角网上）与谷底水雾；
 * - 孤丘 / 尖塔 / 台地 / 石林 / 崖脚碎石 / 杜松与鼠尾草；
 * - 神谕的特斯拉收集塔（成对架在两岸崖缘，雷击充能后跨谷放电）与「雷霆」飞艇系泊塔；
 * - 低垂的雷暴云底（被闪电局部照亮）与远处悬垂的雨幕；'storm' 天气预设提供雨丝与全局雷暴。
 *
 * 采样：sampleHeight = 峡谷三角网精确插值（崖壁 / 台阶 / 台地的真实高度）与岩体 / 塔架柱顶取高者；
 * isWater = 主峡谷河道内（水深 ≥ 0.5 米，河面即水位 -48），其余全部为陆地。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TerrainType } from '../LevelConfig';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import {
  CANYON_PLATEAU,
  CanyonField,
  CanyonVertexKind,
  type CanyonVertexKindValue,
} from './CanyonField';
import {
  createFlashUniforms,
  createRainShaftMaterial,
  createRiverMaterial,
  createRoadMaterial,
  createStormCeilingMaterial,
  createStrataMaterial,
  createWaterfallMaterial,
  type CanyonFlashUniforms,
} from './canyonMaterials';
import { buildCanyonFormations, type CanyonFormation } from './canyonFormations';
import { buildCanyonStorm, type TowerSite } from './canyonStorm';
import { createPuffField, mulberry32, type PuffEmitter } from './envKit';
import { createGlowCards } from './lavaMaterials';
import { StructureField } from './structureField';

/** 雷暴云底世界高度（高于软顶界 540，飞机触碰不到） */
const STORM_CEILING_Y = 640;

const KIND_TINT: Record<CanyonVertexKindValue, number> = {
  [CanyonVertexKind.FLOOR]: 0.93,
  [CanyonVertexKind.BANK]: 0.74,
  [CanyonVertexKind.RIVERBED]: 0.55,
  [CanyonVertexKind.ROAD]: 0.9,
  [CanyonVertexKind.TALUS]: 0.97,
  [CanyonVertexKind.CLIFF]: 1,
  [CanyonVertexKind.BENCH]: 1.02,
  [CanyonVertexKind.RIM]: 1,
  [CanyonVertexKind.PLATEAU]: 1,
  [CanyonVertexKind.ESCARPMENT]: 0.98,
  [CanyonVertexKind.HIGH_PLATEAU]: 1,
};

export class CanyonEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.CANYON;
  /** 主峡谷河道为可航行水面（河面 = 水位）；其余全部为陆地 */
  readonly hasWater = true;
  private field: CanyonField | null = null;
  /** 岩体（孤丘 / 台地 / 石林）与人造结构（塔架）分别登记，便于区分命中材质 */
  private readonly rocks = new StructureField();
  private readonly structures = new StructureField();
  private readonly flash: CanyonFlashUniforms = createFlashUniforms();
  private convoyRoute: THREE.Vector3[] = [];

  constructor() {
    super('canyonEnvironment');
  }

  /* ------------------------------------------------------------------ */
  /* 采样                                                                */
  /* ------------------------------------------------------------------ */

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY;
    }
    const ground = this.waterY + this.groundLocal(worldX, worldZ);
    return Math.max(
      ground,
      this.rocks.sample(worldX, worldZ),
      this.structures.sample(worldX, worldZ)
    );
  }

  isWater(worldX: number, worldZ: number): boolean {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ) || !this.field) {
      return false;
    }
    return this.field.isRiver(worldX, worldZ);
  }

  /** 河道 → 'water'；塔架 → 'city'；崖壁 / 台地 / 岩体 → 'rock'；谷底泥地与土路 → 'ground' */
  surfaceKindAt(worldX: number, worldZ: number): TerrainSurfaceKind {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return 'rock';
    }
    const local = this.groundLocal(worldX, worldZ);
    const ground = this.waterY + local;
    const rock = this.rocks.sample(worldX, worldZ);
    const structure = this.structures.sample(worldX, worldZ);
    if (structure > ground && structure >= rock) return 'city';
    if (rock > ground) return 'rock';
    if (this.field?.isRiver(worldX, worldZ)) return 'water';
    return local < 14 ? 'ground' : 'rock';
  }

  /**
   * 车队「长弓」的峡谷土路（世界坐标，约每 60 米一个点，限战场范围内，自南向北）。
   * 供单位系统的 'route' 放置沿谷底行进使用（可选）。
   */
  getConvoyRoute(): readonly THREE.Vector3[] {
    return this.convoyRoute;
  }

  private groundLocal(worldX: number, worldZ: number): number {
    return this.field ? this.field.sampleGround(worldX, worldZ) : CANYON_PLATEAU;
  }

  /* ------------------------------------------------------------------ */
  /* 构建                                                                */
  /* ------------------------------------------------------------------ */

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    const rng = mulberry32(20260808);
    const field = new CanyonField(ctx.isMobile ? 14 : 9);
    this.field = field;
    const tokens = ctx.tokens;
    const strata = createStrataMaterial({ tokens, waterY: this.waterY, cacheKey: 'canyon' });

    const terrain = this.buildTerrain(field, strata);
    const river = this.buildRiver(field);
    this.buildRoad(field, tokens.terrainSecondary);
    const falls = this.buildWaterfalls(field, terrain.geometry);

    const formations = buildCanyonFormations({
      field,
      structures: this.rocks,
      waterY: this.waterY,
      rng,
      detailScale: ctx.detailScale,
      isMobile: ctx.isMobile,
      strata,
      vegetation: tokens.vegetation,
      vegetationAccent: tokens.vegetationAccent,
    });
    this.root.add(formations.group);

    const storm = buildCanyonStorm({
      tokens,
      structures: this.structures,
      flash: this.flash,
      sites: this.planTowerSites(field, formations.formations),
      mooring: this.planMooring(field, formations.formations),
      ceilingY: STORM_CEILING_Y,
      rng,
      isMobile: ctx.isMobile,
    });
    this.root.add(storm.group);

    const ceilingTime = { value: 0 };
    const windSpeed = 6 + ctx.windStrength * 14;
    const wind = new THREE.Vector2(Math.cos(ctx.windAngle), Math.sin(ctx.windAngle)).multiplyScalar(
      windSpeed
    );
    this.buildStormCeiling(ceilingTime, wind);
    const rain = this.buildRainShafts(rng);

    // 水雾：河面低雾 + 瀑布底部水花
    const mistEmitters: PuffEmitter[] = [...falls.spray, ...storm.steam];
    for (let j = 0; j < field.rowsZ.length; j += 14) {
      const z = field.rowsZ[j];
      if (Math.abs(z) > 1900) continue;
      const index = field.index(j, field.riverColumns[0]);
      const x = (field.xs[index] + field.xs[field.index(j, field.riverColumns[1])]) * 0.5;
      mistEmitters.push({
        x,
        y: this.waterY + 1.5,
        z,
        count: Math.max(2, Math.round(4 * ctx.detailScale)),
        life: 26,
        rise: 0.7,
        size: 26,
        growth: 2.2,
        spread: 50,
        color: 0x8a8e96,
        colorJitter: 0.08,
      });
    }
    const mist = createPuffField({
      emitters: mistEmitters,
      wind: { x: wind.x * 0.35, z: wind.y * 0.35 },
      opacity: 0.13,
      billow: 0.45,
      name: 'canyonMist',
      seed: 88,
    });
    this.root.add(mist.mesh);

    const glows = createGlowCards(storm.glows, 'canyonGlow', 0.85);
    this.root.add(glows.mesh);

    this.animate((dt, elapsed) => {
      river.uniforms.uTime.value = elapsed;
      falls.material.uniforms.uTime.value = elapsed;
      rain.uniforms.uTime.value = elapsed;
      ceilingTime.value = elapsed;
      mist.update(elapsed);
      glows.update(elapsed);
      storm.update(dt, elapsed);
    });
  }

  /** 峡谷三角网：行主序网格，四边形沿 (j,i+1)-(j+1,i) 对角线剖分（与 sampleGround 一致） */
  private buildTerrain(field: CanyonField, material: THREE.Material): THREE.Mesh {
    const rows = field.rowsZ.length;
    const cols = field.columns;
    const count = rows * cols;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let j = 0; j < rows; j++) {
      const z = field.rowsZ[j];
      for (let i = 0; i < cols; i++) {
        const index = j * cols + i;
        const x = field.xs[index];
        positions[index * 3] = x;
        positions[index * 3 + 1] = this.waterY + field.hs[index];
        positions[index * 3 + 2] = z;
        const kind = field.kinds[index] as CanyonVertexKindValue;
        const variation =
          0.94 + 0.12 * (0.5 + 0.5 * Math.sin(x * 0.0071 + Math.sin(z * 0.0053) * 2.1));
        const tint = KIND_TINT[kind] * variation;
        colors[index * 3] = tint * (kind === CanyonVertexKind.TALUS ? 1.03 : 1);
        colors[index * 3 + 1] = tint;
        colors[index * 3 + 2] = tint * (kind === CanyonVertexKind.BANK ? 1.04 : 0.98);
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'canyonTerrain';
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /** 河面：每行在两条水线列之间铺 5 列（略伸入河岸之下），位于水位 */
  private buildRiver(field: CanyonField): ReturnType<typeof createRiverMaterial> {
    const rows = field.rowsZ.length;
    const lanes = 5;
    const positions = new Float32Array(rows * lanes * 3);
    const uvs = new Float32Array(rows * lanes * 2);
    const edges = new Float32Array(rows * lanes);
    let along = 0;
    let prevX = 0;
    let prevZ = 0;
    for (let j = 0; j < rows; j++) {
      const z = field.rowsZ[j];
      const west = field.xs[field.index(j, field.riverColumns[0])];
      const east = field.xs[field.index(j, field.riverColumns[1])];
      const center = (west + east) * 0.5;
      const half = (east - west) * 0.5 + 1.8;
      if (j > 0) along += Math.hypot(center - prevX, z - prevZ);
      prevX = center;
      prevZ = z;
      for (let k = 0; k < lanes; k++) {
        const lateral = -1 + (2 * k) / (lanes - 1);
        const index = j * lanes + k;
        positions[index * 3] = center + lateral * half;
        positions[index * 3 + 1] = this.waterY + 0.02;
        positions[index * 3 + 2] = z;
        uvs[index * 2] = lateral * half;
        uvs[index * 2 + 1] = along;
        edges[index] = 1 - Math.abs(lateral);
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let k = 0; k < lanes - 1; k++) {
        const a = j * lanes + k;
        const b = a + 1;
        const c = a + lanes;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = createRiverMaterial(this.flash);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'canyonRiver';
    this.root.add(mesh);
    return material;
  }

  /** 土路：复制地形网格中两条路缘列之间的条带并抬高 0.2 米；同时记录车队航线 */
  private buildRoad(field: CanyonField, color: number): void {
    const rows = field.rowsZ.length;
    const positions = new Float32Array(rows * 2 * 3);
    const uvs = new Float32Array(rows * 2 * 2);
    let along = 0;
    let prevX = 0;
    let prevZ = 0;
    let lastRouteZ = Infinity;
    const route: THREE.Vector3[] = [];
    for (let j = 0; j < rows; j++) {
      const z = field.rowsZ[j];
      const w = field.index(j, field.roadColumns[0]);
      const e = field.index(j, field.roadColumns[1]);
      const center = (field.xs[w] + field.xs[e]) * 0.5;
      if (j > 0) along += Math.hypot(center - prevX, z - prevZ);
      prevX = center;
      prevZ = z;
      for (let k = 0; k < 2; k++) {
        const index = k === 0 ? w : e;
        const v = j * 2 + k;
        positions[v * 3] = field.xs[index];
        positions[v * 3 + 1] = this.waterY + field.hs[index] + 0.2;
        positions[v * 3 + 2] = z;
        uvs[v * 2] = k;
        uvs[v * 2 + 1] = along;
      }
      const roadY = this.waterY + (field.hs[w] + field.hs[e]) * 0.5;
      if (Math.abs(z) <= 1300 && Math.hypot(center, z) < 1420 && Math.abs(z - lastRouteZ) >= 60) {
        route.push(new THREE.Vector3(center, roadY, z));
        lastRouteZ = z;
      }
    }
    // 自南（+Z）向北行进
    this.convoyRoute = route.reverse();
    const indices: number[] = [];
    for (let j = 0; j < rows - 1; j++) {
      const a = j * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(
      geometry,
      createRoadMaterial(new THREE.Color(color).lerp(new THREE.Color(0x7a5a44), 0.5))
    );
    mesh.name = 'canyonRoad';
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  /**
   * 暴雨瀑布：取主峡谷崖壁上一小片网格（崖缘外沿 → 谷底边缘，3~5 行），
   * 沿顶点法线外推 1.1 米作为水幕，水流顺剖面向下。
   */
  private buildWaterfalls(
    field: CanyonField,
    terrain: THREE.BufferGeometry
  ): { material: ReturnType<typeof createWaterfallMaterial>; spray: PuffEmitter[] } {
    const material = createWaterfallMaterial();
    const spray: PuffEmitter[] = [];
    const normals = terrain.getAttribute('normal') as THREE.BufferAttribute;
    const sites: Array<{ z: number; east: boolean; rows: number }> = [
      { z: -430, east: true, rows: 2 },
      { z: -1560, east: false, rows: 2 },
      { z: 520, east: false, rows: 1 },
      { z: 1540, east: true, rows: 2 },
      { z: -170, east: false, rows: 1 },
    ];
    const positions: number[] = [];
    const uvs: number[] = [];
    const edges: number[] = [];
    const drops: number[] = [];
    const indices: number[] = [];
    for (const site of sites) {
      let center = 0;
      let best = Infinity;
      for (let j = 0; j < field.rowsZ.length; j++) {
        const d = Math.abs(field.rowsZ[j] - site.z);
        if (d < best) {
          best = d;
          center = j;
        }
      }
      const j0 = Math.max(0, center - site.rows);
      const j1 = Math.min(field.rowsZ.length - 1, center + site.rows);
      // 列：自崖缘外沿（顶）到谷底边缘（底）
      const [c0, c1] = site.east ? field.mainWallEast : field.mainWallWest;
      const columns: number[] = [];
      if (site.east) {
        for (let i = c1; i >= c0; i--) columns.push(i);
      } else {
        for (let i = c0; i <= c1; i++) columns.push(i);
      }
      const base = positions.length / 3;
      const rowCount = j1 - j0 + 1;
      for (let j = j0; j <= j1; j++) {
        const lateral = (j - center) / Math.max(1, site.rows);
        let drop = 0;
        for (let k = 0; k < columns.length; k++) {
          const index = field.index(j, columns[k]);
          const x = field.xs[index];
          const y = this.waterY + field.hs[index];
          const z = field.rowsZ[j];
          if (k > 0) {
            const prev = field.index(j, columns[k - 1]);
            drop += Math.hypot(x - field.xs[prev], field.hs[index] - field.hs[prev]);
          }
          const nx = normals.getX(index);
          const ny = normals.getY(index);
          const nz = normals.getZ(index);
          positions.push(x + nx * 1.1, y + ny * 1.1, z + nz * 1.1);
          uvs.push(z - field.rowsZ[center], drop);
          edges.push(1 - Math.abs(lateral));
          const kind = field.kinds[index];
          drops.push(
            kind === CanyonVertexKind.CLIFF || kind === CanyonVertexKind.RIM
              ? 1
              : kind === CanyonVertexKind.BENCH
                ? 0.25
                : 0.55
          );
        }
      }
      const width = columns.length;
      for (let r = 0; r < rowCount - 1; r++) {
        for (let k = 0; k < width - 1; k++) {
          const a = base + r * width + k;
          const b = a + 1;
          const c = a + width;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      // 谷底水花
      const footIndex = field.index(center, columns[columns.length - 1]);
      spray.push({
        x: field.xs[footIndex],
        y: this.waterY + field.hs[footIndex] + 2,
        z: field.rowsZ[center],
        count: 7,
        life: 7,
        rise: 3.5,
        size: 14,
        growth: 2.6,
        spread: 16,
        color: 0xb4b6ba,
        colorJitter: 0.06,
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1));
    geometry.setAttribute('aDrop', new THREE.Float32BufferAttribute(drops, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'canyonWaterfalls';
    mesh.renderOrder = 0;
    this.root.add(mesh);
    return { material, spray };
  }

  /** 特斯拉收集塔：成对立在主峡谷两岸崖缘之后的台地上 */
  private planTowerSites(field: CanyonField, formations: readonly CanyonFormation[]): TowerSite[] {
    const sites: TowerSite[] = [];
    for (const z of [-330, -1480, 760]) {
      const state = field.rowState(z);
      const pair: TowerSite[] = [];
      for (const east of [false, true]) {
        let placed: TowerSite | null = null;
        for (let attempt = 0; attempt < 8 && !placed; attempt++) {
          const offset = 34 + attempt * 9;
          const x = east ? state.main.lipEast + offset : state.main.lipWest - offset;
          const zz = z + attempt * 7;
          const ground = field.sampleGround(x, zz);
          if (ground < CANYON_PLATEAU - 6) continue;
          if (formations.some((f) => Math.hypot(f.x - x, f.z - zz) < f.topRadius * 1.6 + 30))
            continue;
          placed = {
            x,
            z: zz,
            groundY: this.waterY + ground,
            partner: -1,
            height: 74 + attempt * 2,
          };
        }
        if (placed) pair.push(placed);
      }
      if (pair.length === 2) {
        const first = sites.length;
        pair[0].partner = first + 1;
        pair[1].partner = first;
      }
      sites.push(...pair);
    }
    return sites;
  }

  /** 飞艇系泊塔：立在战场内最大的台地平顶山上 */
  private planMooring(
    field: CanyonField,
    formations: readonly CanyonFormation[]
  ): { x: number; z: number; groundY: number } | null {
    const mesas = formations
      .filter(
        (f) =>
          f.kind === 'mesa' && Math.hypot(f.x, f.z) < 1350 && f.topY > this.waterY + CANYON_PLATEAU
      )
      .sort((a, b) => b.topRadius - a.topRadius);
    const mesa = mesas[0];
    if (mesa) {
      return { x: mesa.x, z: mesa.z, groundY: mesa.topY };
    }
    const state = field.rowState(-700);
    const x = state.main.lipEast + 120;
    return { x, z: -700, groundY: this.waterY + field.sampleGround(x, -700) };
  }

  private buildStormCeiling(time: { value: number }, wind: THREE.Vector2): void {
    const geometry = new THREE.PlaneGeometry(14000, 14000, 1, 1);
    geometry.rotateX(Math.PI / 2);
    const material = createStormCeilingMaterial(this.flash, time, wind, 0x23252c, 0x5c606c);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'canyonStormCeiling';
    mesh.position.y = STORM_CEILING_Y;
    mesh.frustumCulled = false;
    this.root.add(mesh);
  }

  /** 远处雨幕：一组朝向战场中心的竖直面片（合并为一次绘制） */
  private buildRainShafts(rng: () => number): ReturnType<typeof createRainShaftMaterial> {
    const geometries: THREE.BufferGeometry[] = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.4;
      const radius = 1750 + rng() * 1500;
      const width = 280 + rng() * 380;
      const bottom = this.waterY + CANYON_PLATEAU - 40;
      const height = STORM_CEILING_Y - bottom;
      const plane = new THREE.PlaneGeometry(width, height, 1, 1);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      plane.rotateY(Math.atan2(-x, -z));
      plane.translate(x, bottom + height / 2, z);
      const seed = new Float32Array(4).fill(rng() * 10);
      plane.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      geometries.push(plane.index ? plane.toNonIndexed() : plane);
      if (plane.index) plane.dispose();
    }
    const material = createRainShaftMaterial(0x8a94a4);
    const merged = mergeGeometries(geometries, false) ?? new THREE.BufferGeometry();
    geometries.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'canyonRainShafts';
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    this.root.add(mesh);
    return material;
  }
}
