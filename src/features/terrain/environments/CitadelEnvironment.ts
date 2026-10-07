/**
 * CITADEL（第 10 关「神谕核心」）：陨石坑中央的黑曜城堡——神谕的最终堡垒。
 *
 * - 复杂陨石坑：平坦的玄武岩坑底 → 三级滑塌台阶的内壁（层层同心环）→ 锯齿状坑缘 → 放射状溅射毯外坡；
 *   坑缘大致就是战场边缘，南侧坑壁在出生点身后约 760 米处；
 * - 坑底：四条对角方向的熔岩裂谷（自城堡台基之下流出，橙红熔流 + 火星 + 烟气）与
 *   四条正方向的青色能量导管（数据流奔向核心），在空中俯瞰形成指向城堡的“米”字；
 *   冲击玻璃斑、冷却熔流的发光细裂纹、黑色数据方碑、坑壁脚下的地热汲取站；
 * - 黑曜城堡（citadelFortress）：两级八边形台基与核心井、城墙 / 角堡 / 城门灯柱塔、
 *   四座导能尖碑向直冲云霄的核心光柱输能，光柱上方旋转的全息数据环；
 * - 调色：靛紫夜空与冷月主光、玄武岩灰紫、熔岩橙、神谕品红 + 数据青、白炽核心——多色调且易读。
 *
 * 采样：sampleHeight = 坑体三角网精确插值（坑壁 / 台阶 / 坑缘的真实高度；熔岩裂谷内取熔岩面）
 * 与城堡结构柱顶（台基、城墙、塔、碑……）取高者。全域无水面（water = false）。
 * boss 决战区：核心井上空 (0, 160, -700)，见 getCoreArena()。
 */
import * as THREE from 'three';
import { TerrainType } from '../LevelConfig';
import { Noise2D, smoothstep } from '../worldscape/noise';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import {
  CITADEL_CENTER,
  CONDUIT_OUTER_RADIUS,
  CRATER_FLOOR,
  CitadelField,
  CitadelRingKind,
  RIFT_LAVA_LEVEL,
  type RiftDef,
} from './CitadelField';
import {
  CITADEL_CYAN,
  CITADEL_MAGENTA,
  createCraterGroundMaterial,
  createObsidianMaterial,
} from './citadelMaterials';
import { buildCitadelFortress, type CitadelCoreState } from './citadelFortress';
import { createPuffField, mulberry32, setInstanceTransform, type PuffEmitter } from './envKit';
import { createGlowCards, createLavaMaterial, type GlowCard } from './lavaMaterials';
import { StructureField } from './structureField';

/** 熔岩带横向顶点列（-1 = 左岸 … 1 = 右岸） */
const LAVA_COLUMNS = [-1, -0.5, 0, 0.5, 1];
/** 十二面体巨石的等效水平半径（单位尺寸） */
const BOULDER_RADIUS = 0.9;
/** 熔岩带端部半圆封口的分段数 */
const LAVA_CAP_SEGMENTS = 8;

export class CitadelEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.CITADEL;
  readonly hasWater = false;
  private field: CitadelField | null = null;
  /** 城堡与神谕设施（'city'）与崩落巨石（'rock'）分别登记 */
  private readonly structures = new StructureField();
  private readonly rocks = new StructureField();
  private readonly arena = new THREE.Vector3(CITADEL_CENTER.x, 160, CITADEL_CENTER.z);
  private assaultRoute: THREE.Vector3[] = [];
  private coreStateSetter: ((state: CitadelCoreState) => void) | null = null;

  constructor() {
    super('citadelEnvironment');
  }

  /* ------------------------------------------------------------------ */
  /* 采样                                                                */
  /* ------------------------------------------------------------------ */

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY + CRATER_FLOOR;
    }
    return Math.max(
      this.waterY + this.groundLocal(worldX, worldZ),
      this.structures.sample(worldX, worldZ),
      this.rocks.sample(worldX, worldZ)
    );
  }

  isWater(): boolean {
    return false;
  }

  /** 城堡结构 → 'city'；熔岩裂谷 → 'lava'；其余玄武岩 / 坑壁 → 'rock' */
  surfaceKindAt(worldX: number, worldZ: number): TerrainSurfaceKind {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return 'rock';
    }
    const ground = this.waterY + this.groundLocal(worldX, worldZ);
    const structure = this.structures.sample(worldX, worldZ);
    const rock = this.rocks.sample(worldX, worldZ);
    if (structure > ground + 0.05 && structure >= rock) {
      return 'city';
    }
    if (rock > ground) {
      return 'rock';
    }
    return this.field?.isRiftLava(worldX, worldZ) ? 'lava' : 'rock';
  }

  /**
   * 最终决战区中心（核心井上空，世界坐标）：四座导能尖碑环绕、能量馈线汇聚于其上方。
   * 建议神谕主宰锚定于此（或把 (px, 160, pz+280) 的出生点向此处收拢）。
   */
  getCoreArena(target = new THREE.Vector3()): THREE.Vector3 {
    return target.copy(this.arena);
  }

  /**
   * 神谕核心的视觉状态（可选，与终局 boss 阶段联动）：
   * 'online' 常态 / 'exposed' 护盾瓦解（馈线熄灭、光柱闪烁）/ 'overload' 过载（品红光柱、全息环狂转）/
   * 'offline' 神谕陨落（光柱熄灭）。约 1.5 秒平滑过渡。
   */
  setCoreState(state: CitadelCoreState): void {
    this.coreStateSetter?.(state);
  }

  /**
   * 友军突击路线（世界坐标，约每 50 米一点）：沿南侧能量导管旁的走廊北上，
   * 登上南坡道穿过南城门进入内庭。供单位系统的 'route' 放置使用（可选）。
   */
  getAssaultRoute(): readonly THREE.Vector3[] {
    return this.assaultRoute;
  }

  override dispose(): void {
    this.coreStateSetter = null;
    super.dispose();
  }

  private groundLocal(worldX: number, worldZ: number): number {
    return this.field ? this.field.sampleGround(worldX, worldZ) : CRATER_FLOOR;
  }

  /* ------------------------------------------------------------------ */
  /* 构建                                                                */
  /* ------------------------------------------------------------------ */

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    const rng = mulberry32(20261010);
    const field = new CitadelField({
      sectors: ctx.isMobile ? 240 : 360,
      floorStep: ctx.isMobile ? 0.018 : 0.012,
    });
    this.field = field;
    const time = { value: 0 };

    this.buildGround(field, ctx, time);
    const lava = this.buildRiftLava(field);

    const fortress = buildCitadelFortress({
      tokens: ctx.tokens,
      field,
      structures: this.structures,
      waterY: this.waterY,
      rng,
      isMobile: ctx.isMobile,
      detailScale: ctx.detailScale,
      time,
    });
    this.root.add(fortress.group);
    this.arena.copy(fortress.arena);
    this.coreStateSetter = (state) => fortress.setCoreState(state);
    this.assaultRoute = this.planAssaultRoute();
    this.buildBoulders(field, ctx, rng);
    const pylonGlows = this.buildTerracePylons(field, ctx, time);

    // 烟气：熔岩裂谷的暗紫烟 + 汲取站蒸汽（同一批次，逐发射源着色）
    const windSpeed = 3 + ctx.windStrength * 7;
    const wind = {
      x: Math.cos(ctx.windAngle) * windSpeed,
      z: Math.sin(ctx.windAngle) * windSpeed,
    };
    const haze = createPuffField({
      emitters: [...fortress.smoke, ...fortress.steam],
      wind,
      opacity: 0.34,
      baseGlow: 0x4a1606,
      billow: 0.65,
      name: 'citadelSmoke',
      seed: 1001,
    });
    this.root.add(haze.mesh);

    // 熔岩裂谷上方的火星（加色）
    const embers = createPuffField({
      emitters: this.riftEmbers(field, ctx.detailScale),
      wind: { x: wind.x * 0.4, z: wind.z * 0.4 },
      opacity: 0.9,
      additive: true,
      baseGlow: 0xffb060,
      billow: 0,
      name: 'citadelEmbers',
      seed: 1002,
    });
    this.root.add(embers.mesh);

    const glows = createGlowCards(
      [...fortress.glows, ...this.riftGlows(field), ...pylonGlows],
      'citadelGlow',
      0.8
    );
    this.root.add(glows.mesh);

    this.animate((dt, elapsed) => {
      time.value = elapsed;
      lava.uniforms.uTime.value = elapsed;
      haze.update(elapsed);
      embers.update(elapsed);
      glows.update(elapsed);
      fortress.update(dt, elapsed);
    });
  }

  /**
   * 陨石坑三角网：坑缘归一化极坐标网格，圈 k / 扇区 s 的四边形沿 (k, s+1)-(k+1, s) 对角线剖分为
   * (a, b, c) 与 (b, d, c)（法线朝上，与 CitadelField.sampleGround 一致），扇区首尾相接。
   */
  private buildGround(
    field: CitadelField,
    ctx: TerrainEnvironmentContext,
    time: { value: number }
  ): void {
    const tokens = ctx.tokens;
    const basalt = new THREE.Color(tokens.terrainPrimary);
    const deep = new THREE.Color(tokens.terrainSecondary);
    const ash = new THREE.Color(tokens.terrainAccent);
    const scorched = new THREE.Color(0x2e1c1e);
    const paving = new THREE.Color(0x1c1926);
    const noise = new Noise2D(20261012);
    const sectors = field.sectors;
    const rings = field.rhos.length;
    const count = rings * sectors;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let k = 0; k < rings; k++) {
      const kind = field.ringKinds[k];
      const rho = field.rhos[k];
      for (let s = 0; s < sectors; s++) {
        const index = k * sectors + s;
        const x = field.xs[index];
        const z = field.zs[index];
        positions[index * 3] = x;
        positions[index * 3 + 1] = this.waterY + field.hs[index];
        positions[index * 3 + 2] = z;
        const drift = noise.fbm(x * 0.0021 + 3.1, z * 0.0021 - 1.7, 3);
        if (kind === CitadelRingKind.FLOOR) {
          // 玄武岩坑底：成片的浅色火山灰沉积；靠近坑壁的冲积扇带上台阶岩屑色
          color.copy(basalt).lerp(ash, smoothstep(0.05, 0.45, drift) * 0.45);
          color.lerp(deep, smoothstep(0.62, 0.74, rho) * 0.25);
          color.lerp(paving, smoothstep(30, 12, field.conduitDistance(x, z)) * 0.85);
          color.lerp(scorched, smoothstep(0.25, 0.9, field.heat[index]) * 0.75);
        } else if (kind === CitadelRingKind.OUTER) {
          // 溅射毯：放射状明暗条纹，远处渐暗
          const streak = 0.5 + 0.5 * Math.sin((s / sectors) * Math.PI * 2 * 23 + drift * 3);
          color.copy(ash).lerp(basalt, 0.35 + 0.35 * streak);
          color.lerp(deep, smoothstep(1.2, 2.4, rho) * 0.5);
        } else if (kind === CitadelRingKind.CREST) {
          color.copy(ash).multiplyScalar(1.04 + 0.08 * drift);
        } else if (kind === CitadelRingKind.TALUS) {
          color.copy(basalt).lerp(ash, 0.4);
        } else {
          // 台阶 / 崖顶：同一圈层统一色调，崖面明暗交给着色器（按真实坡度）
          color.copy(ash).lerp(basalt, 0.25 + 0.15 * drift);
        }
        const variation = 0.92 + 0.16 * (0.5 + 0.5 * Math.sin(x * 0.011 + Math.sin(z * 0.009) * 2));
        color.multiplyScalar(variation);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      }
    }
    const indices = new Uint32Array((rings - 1) * sectors * 6);
    let cursor = 0;
    for (let k = 0; k < rings - 1; k++) {
      for (let s = 0; s < sectors; s++) {
        const s1 = (s + 1) % sectors;
        const a = k * sectors + s;
        const b = k * sectors + s1;
        const c = (k + 1) * sectors + s;
        const d = (k + 1) * sectors + s1;
        indices[cursor++] = a;
        indices[cursor++] = b;
        indices[cursor++] = c;
        indices[cursor++] = b;
        indices[cursor++] = d;
        indices[cursor++] = c;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aHeat', new THREE.BufferAttribute(Float32Array.from(field.heat), 1));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, createCraterGroundMaterial(time));
    mesh.name = 'citadelCrater';
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  /**
   * 熔岩裂谷：沿裂谷折线的熔岩带（半宽线性渐变、转角斜接、两端半圆封口），
   * 与 CitadelField.isRiftLava 的胶囊并集轮廓一致；全部裂谷合并为一次绘制。
   */
  private buildRiftLava(field: CitadelField): THREE.ShaderMaterial {
    const positions: number[] = [];
    const uvs: number[] = [];
    const edges: number[] = [];
    const indices: number[] = [];
    const y = this.waterY + RIFT_LAVA_LEVEL;
    for (const rift of field.rifts) {
      this.appendRiftRibbon(rift, y, positions, uvs, edges, indices);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = createLavaMaterial({
      flowSpeed: 3.2,
      glow: 1.1,
      hot: 0xffd890,
      warm: 0xff5a14,
      crust: 0x1c0c10,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'citadelRiftLava';
    this.root.add(mesh);
    return material;
  }

  private appendRiftRibbon(
    rift: RiftDef,
    y: number,
    positions: number[],
    uvs: number[],
    edges: number[],
    indices: number[]
  ): void {
    const points = rift.points;
    const n = points.length - 1;
    const columns = LAVA_COLUMNS.length;
    const base = positions.length / 3;
    let along = 0;
    // 每个折线点：两侧线段法线的平均方向，斜接缩放保证边线与各线段平行
    const tangentAt = (i: number): [number, number] => {
      const [ax, az] = points[Math.max(0, i - 1)];
      const [bx, bz] = points[Math.min(n, i + 1)];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      return [(bx - ax) / length, (bz - az) / length];
    };
    for (let i = 0; i <= n; i++) {
      const [px, pz] = points[i];
      if (i > 0) {
        along += Math.hypot(px - points[i - 1][0], pz - points[i - 1][1]);
      }
      const [tx, tz] = tangentAt(i);
      const nx = -tz;
      const nz = tx;
      let miter = 1;
      if (i > 0 && i < n) {
        const [ax, az] = points[i - 1];
        const length = Math.hypot(px - ax, pz - az) || 1;
        const segNx = -(pz - az) / length;
        const segNz = (px - ax) / length;
        miter = 1 / Math.max(0.5, nx * segNx + nz * segNz);
      }
      const half = rift.startHalf + ((rift.endHalf - rift.startHalf) * i) / n;
      for (const column of LAVA_COLUMNS) {
        const offset = column * half * miter;
        positions.push(px + nx * offset, y, pz + nz * offset);
        uvs.push(column * half, along);
        edges.push(1 - Math.abs(column));
      }
    }
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < columns - 1; c++) {
        const a = base + i * columns + c;
        const b = base + (i + 1) * columns + c;
        // 法线朝上：列方向 (n) × 流向 (t) = +Y
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    // 两端半圆封口（中心 aEdge = 1，圆周 aEdge = 0）
    const totalAlong = along;
    for (const end of [0, n]) {
      const [px, pz] = points[end];
      const [tx, tz] = tangentAt(end);
      const outward = end === 0 ? -1 : 1;
      const half = end === 0 ? rift.startHalf : rift.endHalf;
      const alongBase = end === 0 ? 0 : totalAlong;
      const center = positions.length / 3;
      positions.push(px, y, pz);
      uvs.push(0, alongBase);
      edges.push(1);
      for (let k = 0; k <= LAVA_CAP_SEGMENTS; k++) {
        // φ：0 → π 自一侧岸线绕过端点到另一侧
        const phi = (k / LAVA_CAP_SEGMENTS) * Math.PI;
        const lateral = Math.cos(phi) * half;
        const forward = Math.sin(phi) * half * outward;
        positions.push(px - tz * lateral + tx * forward, y, pz + tx * lateral + tz * forward);
        uvs.push(lateral, alongBase + forward);
        edges.push(0);
      }
      for (let k = 0; k < LAVA_CAP_SEGMENTS; k++) {
        const a = center + 1 + k;
        const b = center + 2 + k;
        // 保持法线朝上：起点封口与终点封口的绕向相反
        if (outward > 0) {
          indices.push(center, a, b);
        } else {
          indices.push(center, b, a);
        }
      }
    }
  }

  /**
   * 坑壁脚下的崩落巨石（冲积扇 / 滑塌带）与坑底零星的溅射岩块：实例化一次绘制，
   * 每块登记为椭球冠岩体足迹（避开城堡、导管走廊、熔岩裂谷与出生点）。
   */
  private buildBoulders(
    field: CitadelField,
    ctx: TerrainEnvironmentContext,
    rng: () => number
  ): void {
    const target = Math.max(40, Math.round(240 * ctx.detailScale));
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.04,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material, target);
    mesh.name = 'citadelRockfall';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const basalt = new THREE.Color(ctx.tokens.terrainPrimary);
    const ash = new THREE.Color(ctx.tokens.terrainAccent);
    const deep = new THREE.Color(ctx.tokens.terrainSecondary);
    const tint = new THREE.Color();
    const clear = (x: number, z: number, radius: number): boolean => {
      for (const [ox, oz] of [
        [0, 0],
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
      ]) {
        if (this.structures.sample(x + ox, z + oz) > -Infinity) return false;
        if (this.rocks.sample(x + ox, z + oz) > -Infinity) return false;
      }
      return true;
    };
    let placed = 0;
    for (let attempt = 0; attempt < target * 8 && placed < target; attempt++) {
      const talus = rng() < 0.62;
      const theta = rng() * Math.PI * 2;
      const rho = talus ? 0.69 + rng() * 0.07 : 0.3 + rng() * 0.38;
      const r = rho * field.rimRadius(theta);
      if (r < 560) continue;
      const x = CITADEL_CENTER.x + Math.cos(theta) * r;
      const z = CITADEL_CENTER.z + Math.sin(theta) * r;
      if (Math.hypot(x, z) < 140) continue;
      if (field.conduitDistance(x, z) < 30) continue;
      if (field.riftEdgeDistance(x, z) < 24) continue;
      const size = talus ? 3 + rng() * rng() * 11 : 2 + rng() * rng() * 6;
      if (!clear(x, z, size * 1.2)) continue;
      const sx = size * (0.85 + rng() * 0.4);
      const sz = size * (0.85 + rng() * 0.4);
      const sy = size * (0.55 + rng() * 0.35);
      const ground = this.waterY + field.sampleGround(x, z);
      const centerY = ground - sy * 0.3;
      const yaw = rng() * Math.PI * 2;
      setInstanceTransform(mesh, placed, x, centerY, z, yaw, sx, sy, sz);
      tint
        .copy(basalt)
        .lerp(rng() < 0.5 ? ash : deep, rng() * 0.6)
        .multiplyScalar(0.85 + rng() * 0.3);
      mesh.setColorAt(placed, tint);
      // 十二面体近似为椭球冠（局部 X / Z 半径随非等比缩放，朝向与实例一致）
      this.rocks.addDome({
        x,
        z,
        radius: BOULDER_RADIUS * sx,
        radiusZ: BOULDER_RADIUS * sz,
        yaw,
        base: centerY,
        height: 0.934 * sy,
      });
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.root.add(mesh);
  }

  /**
   * 坑壁两级台阶上的神谕警戒塔：青 / 品红两圈灯点勾勒出决战场的同心环，给坑壁以尺度。
   * 塔身与灯头各一次实例化绘制，塔身登记柱体足迹；返回灯头辉光。
   */
  private buildTerracePylons(
    field: CitadelField,
    ctx: TerrainEnvironmentContext,
    time: { value: number }
  ): GlowCard[] {
    const rings = [
      { rho: 0.8125, count: ctx.isMobile ? 24 : 36, phase: 0, color: CITADEL_CYAN },
      { rho: 0.875, count: ctx.isMobile ? 24 : 36, phase: 0.5, color: CITADEL_MAGENTA },
    ];
    const total = rings.reduce((sum, ring) => sum + ring.count, 0);
    const height = 22;
    const body = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1.3, 2.6, height, 6),
      createObsidianMaterial(time, { color: ctx.tokens.structure, circuits: 0, gloss: 0.8 }),
      total
    );
    body.name = 'citadelTerracePylons';
    const lampColor = new THREE.Color();
    const lamps = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1.9, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      total
    );
    lamps.name = 'citadelTerraceLamps';
    const glows: GlowCard[] = [];
    let index = 0;
    for (const ring of rings) {
      for (let k = 0; k < ring.count; k++) {
        const theta = ((k + ring.phase) / ring.count) * Math.PI * 2;
        const r = ring.rho * field.rimRadius(theta);
        const x = CITADEL_CENTER.x + Math.cos(theta) * r;
        const z = CITADEL_CENTER.z + Math.sin(theta) * r;
        const ground = this.waterY + field.sampleGround(x, z);
        setInstanceTransform(body, index, x, ground + height / 2 - 0.5, z, theta, 1);
        setInstanceTransform(lamps, index, x, ground + height + 0.8, z, theta, 1, 1.4, 1);
        lamps.setColorAt(index, lampColor.set(ring.color).multiplyScalar(2.2));
        // 六棱锥台塔身 + 八面体灯头（上半为与实例同向的四棱锥）
        this.structures.addFrustum({
          x,
          z,
          sides: 6,
          yaw: theta,
          r0: 2.6,
          r1: 1.3,
          y0: ground - 0.5,
          y1: ground + height - 0.5,
        });
        this.structures.addFrustum({
          x,
          z,
          sides: 4,
          yaw: theta,
          r0: 1.9,
          r1: 1.9,
          y0: ground + height + 0.8,
          y1: ground + height + 0.8,
          apex: 1.9 * 1.4,
        });
        glows.push({ x, y: ground + height + 1, z, size: 22, color: ring.color, flicker: 0 });
        index++;
      }
    }
    for (const mesh of [body, lamps]) {
      mesh.count = index;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.root.add(mesh);
    }
    if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
    return glows;
  }

  /** 熔岩裂谷火星：沿裂谷每两个折线点一处 */
  private riftEmbers(field: CitadelField, detailScale: number): PuffEmitter[] {
    const emitters: PuffEmitter[] = [];
    for (const rift of field.rifts) {
      const n = rift.points.length - 1;
      for (let i = 1; i < n; i += 2) {
        const [x, z] = rift.points[i];
        const half = rift.startHalf + ((rift.endHalf - rift.startHalf) * i) / n;
        emitters.push({
          x,
          y: this.waterY + RIFT_LAVA_LEVEL + 1,
          z,
          count: Math.max(3, Math.round(9 * detailScale)),
          life: 3.6,
          rise: 13,
          size: 2.2,
          growth: 0.5,
          spread: half * 2.2,
          color: 0xff7a2a,
          colorJitter: 0.35,
        });
      }
    }
    return emitters;
  }

  /** 熔岩裂谷上方的热辉 */
  private riftGlows(field: CitadelField): GlowCard[] {
    const glows: GlowCard[] = [];
    for (const rift of field.rifts) {
      const n = rift.points.length - 1;
      for (let i = 0; i <= n; i += 2) {
        const [x, z] = rift.points[i];
        const half = rift.startHalf + ((rift.endHalf - rift.startHalf) * i) / n;
        glows.push({
          x,
          y: this.waterY + RIFT_LAVA_LEVEL + 9,
          z,
          size: 70 + half * 5,
          color: 0xff4a12,
          flicker: 0.9,
        });
      }
    }
    return glows;
  }

  /** 南侧突击路线：导管西侧走廊 → 坡道脚下并入中线 → 坡道 → 南城门 → 内庭 */
  private planAssaultRoute(): THREE.Vector3[] {
    const route: THREE.Vector3[] = [];
    const cx = CITADEL_CENTER.x;
    const cz = CITADEL_CENTER.z;
    const push = (x: number, z: number): void => {
      route.push(new THREE.Vector3(x, this.sampleHeight(x, z), z));
    };
    // 南向（+Z）：自导管外端以南向城堡推进
    for (let r = CONDUIT_OUTER_RADIUS + 60; r > 560; r -= 50) {
      push(cx - 24, cz + r);
    }
    for (let r = 540; r >= 180; r -= 45) {
      push(cx, cz + r);
    }
    return route;
  }
}
