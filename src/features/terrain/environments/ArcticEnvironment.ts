/**
 * ARCTIC（第 7 关「极光冰海」）：极夜笼罩的北冰洋。
 *
 * - 墨色开阔海面（冰缘浅水青绿 + 浪沫），北岸与东岸是高耸的冰架冰崖；
 * - 平顶冰山与尖顶冰山：崖壁半透明冰蓝（水线次表面光 + 菲涅尔边缘光 + 压缩冰层条纹），
 *   顶面覆雪带风蚀雪垄；远海冰山剪影；
 * - 漂移浮冰：随洋流缓慢漂移、自转、随浪起伏，撞上冰山时在上游重生；
 * - 海面低雾（sea smoke）贴水漂移；冰封前哨站：雷达罩、旋转雷达、营房、探照灯、障碍灯；
 * - 极光帘幕与轻雪由 'aurora' 天气预设提供（weatherLayers.createAuroraBand）。
 *
 * 采样：sampleHeight = 冰架 / 冰山顶面或海床；isWater = 冰架与冰山之外的海面
 * （漂移浮冰可破冰穿行，不阻挡航行，也不参与采样，保证结果与时间无关）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TerrainType } from '../LevelConfig';
import { smoothstep } from '../worldscape/noise';
import { buildWorldscapeWater, sampleWaveHeight, type WorldscapeWater } from '../worldscape/water';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import {
  createPuffField,
  mulberry32,
  PolarShape,
  setInstanceTransform,
  type PuffEmitter,
} from './envKit';
import { createGlowCards } from './lavaMaterials';
import { ArcticField, FLOE_FREEBOARD, type IceFeature } from './ArcticField';
import { createIceMaterial } from './iceMaterials';
import { buildArcticOutposts } from './arcticOutposts';

const FLOE_VARIANTS = 3;
/** 浮冰漂移区域半边长（米） */
const FLOE_HALF_EXTENT = 1750;

export class ArcticEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.ARCTIC;
  readonly hasWater = true;
  private field: ArcticField = new ArcticField(0);
  private water: WorldscapeWater | null = null;

  constructor() {
    super('arcticEnvironment');
  }

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY;
    }
    return this.waterY + this.field.surfaceHeight(worldX, worldZ);
  }

  isWater(worldX: number, worldZ: number): boolean {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return false;
    }
    return this.field.isOpenWater(worldX, worldZ);
  }

  surfaceKindAt(worldX: number, worldZ: number): TerrainSurfaceKind {
    return this.isWater(worldX, worldZ) ? 'water' : 'ice';
  }

  override dispose(): void {
    if (this.water) {
      this.water.dispose();
      this.water = null;
    }
    super.dispose();
  }

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    this.field = new ArcticField(
      Math.round((ctx.isMobile ? 60 : 96) * Math.max(0.6, ctx.detailScale))
    );
    const tokens = ctx.tokens;

    this.buildSea(ctx);
    this.buildStaticIce(ctx);
    this.buildIceRubble(ctx);
    const floes = this.buildFloes(ctx);

    const outposts = buildArcticOutposts(this.field, tokens, this.waterY);
    this.root.add(outposts.group);

    // 海面低雾（sea smoke）：贴着冰缘的开阔水面缓慢翻涌
    const rng = mulberry32(7171);
    const mistEmitters: PuffEmitter[] = [];
    for (const feature of this.field.features) {
      if (
        feature.kind === 'pinnacle' &&
        Math.hypot(feature.shape.centerX, feature.shape.centerZ) > 1600
      ) {
        continue;
      }
      const samples = feature.kind === 'shelf' ? 7 : 2;
      for (let s = 0; s < samples; s++) {
        const toCenter = Math.atan2(-feature.shape.centerZ, -feature.shape.centerX);
        const theta =
          feature.kind === 'shelf'
            ? toCenter + (s / (samples - 1) - 0.5) * 0.9
            : rng() * Math.PI * 2;
        const r = feature.shape.radiusAt(theta) + 30 + rng() * 40;
        mistEmitters.push({
          x: feature.shape.centerX + Math.cos(theta) * r,
          y: this.waterY + 2,
          z: feature.shape.centerZ + Math.sin(theta) * r,
          count: Math.round((feature.kind === 'shelf' ? 6 : 3) * ctx.detailScale) + 2,
          life: 30,
          rise: 0.6,
          size: 70,
          growth: 2.2,
          spread: 140,
          color: 0x7c97ad,
          colorJitter: 0.1,
        });
      }
    }
    const windSpeed = 2 + ctx.windStrength * 5;
    const mist = createPuffField({
      emitters: mistEmitters,
      wind: { x: Math.cos(ctx.windAngle) * windSpeed, z: Math.sin(ctx.windAngle) * windSpeed },
      opacity: 0.13,
      name: 'arcticSeaSmoke',
      seed: 72,
    });
    this.root.add(mist.mesh);

    const glows = createGlowCards(outposts.glows, 'arcticOutpostGlow', 0.9);
    this.root.add(glows.mesh);

    this.animate((dt, elapsed) => {
      this.water?.update(elapsed);
      floes(dt, elapsed);
      outposts.animate(elapsed);
      mist.update(elapsed);
      glows.update(elapsed);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 海面                                                                */
  /* ------------------------------------------------------------------ */

  private buildSea(ctx: TerrainEnvironmentContext): void {
    const field = this.field;
    this.water = buildWorldscapeWater({
      size: 4400,
      grid: ctx.isMobile ? 150 : 200,
      // 冰缘浅水：越靠近冰崖越“浅”，着色器在 0.25..2.4 之间画浪沫带
      depthAt: (x, z) => {
        const edge = field.iceEdgeDistance(x, z);
        if (edge < -4) return -1;
        return THREE.MathUtils.clamp(0.4 + Math.max(0, edge) * 0.32, 0.4, 40);
      },
      deepColor: 0x0a2433,
      shallowColor: 0x1f8a96,
      skyTint: 0x35a89c,
      sunDir: ctx.sunDirection,
      sunColor: 0xbfd8ff,
      sunIntensity: 0.9,
    });
    this.water.mesh.position.y = this.waterY;
    this.water.mesh.name = 'arcticSea';
    this.root.add(this.water.mesh);
  }

  /* ------------------------------------------------------------------ */
  /* 冰架 / 冰山（合并为一次绘制）                                        */
  /* ------------------------------------------------------------------ */

  private buildStaticIce(ctx: TerrainEnvironmentContext): void {
    const geometries: THREE.BufferGeometry[] = [];
    for (const feature of this.field.features) {
      const geometry =
        feature.kind === 'pinnacle'
          ? this.buildPinnacleGeometry(feature, ctx)
          : this.buildTabularGeometry(feature, ctx);
      geometries.push(geometry);
    }
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) {
      return;
    }
    merged.computeBoundingSphere();
    const material = createIceMaterial({ waterY: this.waterY, cacheKey: 'static' });
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'arcticIce';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  /** 冰架 / 平顶冰山：星形轮廓挤出（倒角圆润冰缘），顶面雪、崖壁冰蓝渐变 */
  private buildTabularGeometry(
    feature: IceFeature,
    ctx: TerrainEnvironmentContext
  ): THREE.BufferGeometry {
    const shape = feature.shape;
    const segments = feature.kind === 'shelf' ? (ctx.isMobile ? 120 : 200) : ctx.isMobile ? 40 : 64;
    const height = feature.top + feature.draft;
    const extruded = new THREE.ExtrudeGeometry(shape.toShape(segments), {
      depth: height,
      steps: 5,
      bevelEnabled: true,
      bevelThickness: 2.5,
      bevelSize: 2.5,
      bevelSegments: 2,
      curveSegments: 1,
    });
    extruded.rotateX(-Math.PI / 2);
    extruded.translate(shape.centerX, this.waterY - feature.draft, shape.centerZ);
    const geometry = extruded.index ? extruded.toNonIndexed() : extruded;
    if (geometry !== extruded) extruded.dispose();
    this.paintIce(geometry, this.waterY + feature.top);
    return geometry;
  }

  /** 尖顶冰山：极坐标网格 + 解析剖面（与采样一致）+ 水下裙边 */
  private buildPinnacleGeometry(
    feature: IceFeature,
    ctx: TerrainEnvironmentContext
  ): THREE.BufferGeometry {
    const shape = feature.shape;
    const rings = ctx.isMobile ? 7 : 10;
    const sectors = ctx.isMobile ? 18 : 26;
    const positions: number[] = [];
    const ringPoints: Array<Array<[number, number, number]>> = [];
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const row: Array<[number, number, number]> = [];
      for (let s = 0; s < sectors; s++) {
        const theta = (s / sectors) * Math.PI * 2;
        const radius = shape.radiusAt(theta) * t * 0.995;
        const x = shape.centerX + Math.cos(theta) * radius;
        const z = shape.centerZ + Math.sin(theta) * radius;
        const h = this.field.pinnacleHeight(feature, x, z, t);
        row.push([x, this.waterY + Math.max(h, 0.5), z]);
      }
      ringPoints.push(row);
    }
    // 裙边：水下
    const skirt: Array<[number, number, number]> = ringPoints[rings].map(([x, , z]) => {
      const dx = x - shape.centerX;
      const dz = z - shape.centerZ;
      return [shape.centerX + dx * 1.08, this.waterY - feature.draft, shape.centerZ + dz * 1.08];
    });
    ringPoints.push(skirt);
    const pushTri = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number]
    ): void => {
      positions.push(...a, ...b, ...c);
    };
    for (let r = 0; r < ringPoints.length - 1; r++) {
      for (let s = 0; s < sectors; s++) {
        const s1 = (s + 1) % sectors;
        const a = ringPoints[r][s];
        const b = ringPoints[r][s1];
        const c = ringPoints[r + 1][s];
        const d = ringPoints[r + 1][s1];
        if (r === 0) {
          pushTri(a, d, c);
        } else {
          pushTri(a, b, c);
          pushTri(b, d, c);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const uv = new Float32Array((positions.length / 3) * 2);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.paintIce(geometry, this.waterY + feature.top);
    return geometry;
  }

  /** 顶点色：积雪顶面 / 冰蓝崖壁（越近水线越深）/ 水下深蓝 */
  private paintIce(geometry: THREE.BufferGeometry, topY: number): void {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const colors = new Float32Array(position.count * 3);
    const snow = new THREE.Color(0xeaf3f8);
    const iceHigh = new THREE.Color(0x9fd6ee);
    const iceLow = new THREE.Color(0x3d93c4);
    const deep = new THREE.Color(0x0b3550);
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const ny = normal ? normal.getY(i) : 1;
      const heightT = smoothstep(this.waterY, topY, y);
      color.copy(iceLow).lerp(iceHigh, heightT);
      if (y < this.waterY) {
        color.lerp(deep, smoothstep(this.waterY, this.waterY - 10, y));
      }
      const snowCover =
        smoothstep(0.55, 0.85, ny) * smoothstep(this.waterY + 1.5, this.waterY + 6, y);
      const capBand = smoothstep(topY - 3.2, topY - 0.8, y);
      color.lerp(snow, Math.max(snowCover, capBand * 0.85));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  /* ------------------------------------------------------------------ */
  /* 冰崖碎冰与冰架压力脊：打破平整轮廓的近景细节                          */
  /* ------------------------------------------------------------------ */

  private buildIceRubble(ctx: TerrainEnvironmentContext): void {
    const rng = mulberry32(7373);
    const base = new THREE.DodecahedronGeometry(1, 0);
    const geometry = base.index ? base.toNonIndexed() : base;
    if (geometry !== base) base.dispose();
    // 顶点色：朝上面雪白，其余冰蓝
    const normal = geometry.getAttribute('normal');
    const colors = new Float32Array(normal.count * 3);
    const snow = new THREE.Color(0xe8f2f8);
    const ice = new THREE.Color(0x7cc2e2);
    const c = new THREE.Color();
    for (let i = 0; i < normal.count; i++) {
      c.copy(ice).lerp(snow, smoothstep(0.2, 0.7, normal.getY(i)));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const placements: Array<[number, number, number, number, number, number]> = [];
    for (const feature of this.field.features) {
      if (feature.kind === 'pinnacle') continue;
      const shape = feature.shape;
      const isShelf = feature.kind === 'shelf';
      const toCenter = Math.atan2(-shape.centerZ, -shape.centerX);
      const count = Math.round((isShelf ? 150 : 22) * ctx.detailScale);
      for (let i = 0; i < count; i++) {
        const theta = isShelf ? toCenter + (rng() - 0.5) * 1.3 : rng() * Math.PI * 2;
        const edgeR = shape.radiusAt(theta);
        const floating = rng() < 0.55;
        // 漂浮碎冰：冰崖外 3~30 米、贴水面；压力脊：冰架内 4~40 米、顶面之上
        const r = floating ? edgeR + 3 + rng() * 27 : edgeR - 4 - rng() * 36;
        const x = shape.centerX + Math.cos(theta) * r;
        const z = shape.centerZ + Math.sin(theta) * r;
        const size = floating ? 1.5 + rng() * 4.5 : 2 + rng() * 5;
        const y = floating ? this.waterY + size * 0.15 : this.waterY + feature.top + size * 0.25;
        placements.push([x, y, z, size, rng() * Math.PI * 2, rng()]);
      }
    }
    const material = createIceMaterial({ waterY: this.waterY, cacheKey: 'rubble' });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, placements.length));
    mesh.name = 'arcticIceRubble';
    placements.forEach(([x, y, z, size, yaw, squash], i) => {
      setInstanceTransform(
        mesh,
        i,
        x,
        y,
        z,
        yaw,
        size * 1.3,
        size * (0.45 + squash * 0.4),
        size,
        squash * 0.5,
        (squash - 0.5) * 0.6
      );
    });
    mesh.count = placements.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  /* ------------------------------------------------------------------ */
  /* 漂移浮冰                                                            */
  /* ------------------------------------------------------------------ */

  private buildFloes(ctx: TerrainEnvironmentContext): (dt: number, elapsed: number) => void {
    const field = this.field;
    const rng = mulberry32(7272);
    const material = createIceMaterial({ waterY: this.waterY, cacheKey: 'floe' });
    const meshes: THREE.InstancedMesh[] = [];
    const variantFloes: number[][] = Array.from({ length: FLOE_VARIANTS }, () => []);
    field.floes.forEach((floe, index) => variantFloes[floe.variant % FLOE_VARIANTS].push(index));

    for (let v = 0; v < FLOE_VARIANTS; v++) {
      // 单位半径的浮冰轮廓：顶面高出水面 FLOE_FREEBOARD，吃水 2.2 米
      const outline = PolarShape.random(rng, 0, 0, 1, 0.22);
      const extruded = new THREE.ExtrudeGeometry(outline.toShape(ctx.isMobile ? 12 : 18), {
        depth: 1,
        steps: 1,
        bevelEnabled: true,
        bevelThickness: 0.25,
        bevelSize: 0.06,
        bevelSegments: 1,
        curveSegments: 1,
      });
      extruded.rotateX(-Math.PI / 2);
      const geometry = extruded.index ? extruded.toNonIndexed() : extruded;
      if (geometry !== extruded) extruded.dispose();
      // 先按单位尺寸着色（顶面雪白 / 侧面冰蓝），实例缩放后保持
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const colors = new Float32Array(position.count * 3);
      const snow = new THREE.Color(0xe4eef4);
      const side = new THREE.Color(0x6fb6d8);
      const c = new THREE.Color();
      for (let i = 0; i < position.count; i++) {
        c.copy(side).lerp(snow, smoothstep(0.4, 0.8, normal.getY(i)));
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, variantFloes[v].length));
      mesh.name = `arcticFloes${v}`;
      mesh.count = variantFloes[v].length;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      meshes.push(mesh);
      this.root.add(mesh);
    }

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const currentAngle = ctx.windAngle + 0.3;
    const currentX = Math.cos(currentAngle);
    const currentZ = Math.sin(currentAngle);
    const thickness = FLOE_FREEBOARD + 2.2;

    const writeInstances = (elapsed: number): void => {
      for (let v = 0; v < FLOE_VARIANTS; v++) {
        const indices = variantFloes[v];
        const mesh = meshes[v];
        for (let i = 0; i < indices.length; i++) {
          const floe = field.floes[indices[i]];
          const bob =
            sampleWaveHeight(floe.x, floe.z, elapsed) * 0.35 +
            Math.sin(elapsed * 0.7 + floe.bobPhase) * 0.08;
          position.set(floe.x, this.waterY + FLOE_FREEBOARD - thickness + bob, floe.z);
          quaternion.setFromAxisAngle(yAxis, floe.rotation);
          scale.set(floe.radius, thickness, floe.radius);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    };
    writeInstances(0);

    return (dt: number, elapsed: number) => {
      for (const floe of field.floes) {
        floe.x += currentX * floe.speed * dt;
        floe.z += currentZ * floe.speed * dt;
        floe.rotation += floe.spin * dt;
        const outOfBounds =
          Math.abs(floe.x) > FLOE_HALF_EXTENT || Math.abs(floe.z) > FLOE_HALF_EXTENT;
        if (outOfBounds || field.staticIceTop(floe.x, floe.z, floe.radius * 0.5) !== null) {
          // 在上游边界重生（避开静态冰体）
          for (let attempt = 0; attempt < 6; attempt++) {
            const lateral = (rng() - 0.5) * FLOE_HALF_EXTENT * 2;
            floe.x = -currentX * FLOE_HALF_EXTENT * 0.98 + -currentZ * lateral;
            floe.z = -currentZ * FLOE_HALF_EXTENT * 0.98 + currentX * lateral;
            if (field.staticIceTop(floe.x, floe.z, floe.radius) === null) break;
          }
        }
      }
      writeInstances(elapsed);
    };
  }
}
