/**
 * VOLCANO（第 6 关「熔炉之心」）：南太平洋赤炎火山岛。
 *
 * - 暗色海面环绕的火山岛：出生点正前方约 900 米矗立主火山（峰顶火山口熔岩湖 + 冲天火山灰柱），
 *   西侧次火山锥、东南渣锥，远海四座火山岛剪影；
 * - 三条熔岩河从火山口溢出，穿过平原注入大海（入海处蒸汽翻滚），两座平原熔岩湖；
 * - 冷却的黑色玄武岩地表：着色器注入的发光裂纹沿熔岩河岸、湖畔与旧熔岩流脉动；
 * - 神谕兵工厂：冷却塔、高炉、锯齿厂房、矿石栈桥、储罐、坡面炉口与火炬塔；
 * - 海岸玄武岩柱群、熔岩巨砾、上升的火星喷泉。
 *
 * 采样：sampleHeight = 地面与熔岩面取高者；isWater = 岛外水深 ≥ 2 米的海域。
 */
import * as THREE from 'three';
import { TerrainType } from '../LevelConfig';
import { smoothstep } from '../worldscape/noise';
import { buildWorldscapeWater, type WorldscapeWater } from '../worldscape/water';
import type { TerrainEnvironmentContext } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import {
  buildHeightGridGeometry,
  createPuffField,
  mulberry32,
  setInstanceTransform,
  type PuffEmitter,
} from './envKit';
import {
  createGlowCards,
  createLavaMaterial,
  injectLavaCracks,
  type GlowCard,
} from './lavaMaterials';
import {
  VOLCANO_CONES,
  VOLCANO_LAVA_LAKES,
  VOLCANO_LAVA_RIVERS,
  VOLCANO_MAIN_CONE,
  VolcanoField,
} from './VolcanoField';
import { buildVolcanoFoundry } from './volcanoFoundry';

/** 船只可航行的最小水深（米） */
const SAILABLE_DEPTH = 2;

export class VolcanoEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.VOLCANO;
  readonly hasWater = true;
  readonly field = new VolcanoField();
  private water: WorldscapeWater | null = null;

  constructor() {
    super('volcanoEnvironment');
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
    if (this.field.lavaSurface(worldX, worldZ) !== null) {
      return false;
    }
    return this.field.groundHeight(worldX, worldZ) < -SAILABLE_DEPTH;
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
    const rng = mulberry32(20260606);
    const lavaTime = { value: 0 };

    this.buildTerrain(ctx, lavaTime);
    this.buildSea(ctx);
    const lavaMaterials = this.buildLava(ctx);
    this.buildRocks(ctx, rng);

    const foundry = buildVolcanoFoundry({
      tokens: ctx.tokens,
      groundAt: (x, z) => this.sampleHeight(x, z),
      rng,
      detailScale: ctx.detailScale,
    });
    this.root.add(foundry.group);

    const atmosphere = this.buildAtmosphere(ctx, foundry);

    this.animate((_dt, elapsed) => {
      lavaTime.value = elapsed;
      for (const material of lavaMaterials) {
        material.uniforms.uTime.value = elapsed;
      }
      this.water?.update(elapsed);
      foundry.animate(elapsed);
      for (const layer of atmosphere) {
        layer(elapsed);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 地形                                                                */
  /* ------------------------------------------------------------------ */

  private buildTerrain(ctx: TerrainEnvironmentContext, lavaTime: { value: number }): void {
    const field = this.field;
    const tokens = ctx.tokens;
    const basalt = new THREE.Color(tokens.terrainPrimary);
    const freshLava = new THREE.Color(tokens.terrainSecondary);
    const rustAsh = new THREE.Color(tokens.terrainAccent);
    const ashGrey = new THREE.Color(0x5e5652);
    const sulfur = new THREE.Color(0xb39a3e);
    const blackSand = new THREE.Color(0x141213);
    const seabed = new THREE.Color(0x0c1214);
    const scorched = new THREE.Color(0x3a1c12);
    const segments = ctx.isMobile ? 170 : 250;

    const geometry = buildHeightGridGeometry({
      sizeX: 4400,
      sizeZ: 4400,
      segmentsX: segments,
      segmentsZ: segments,
      heightAt: (x, z) => this.waterY + field.groundHeight(x, z),
      colorAt: (x, z, y, slope, out) => {
        const h = y - this.waterY;
        const land = field.landFactor(x, z);
        const variation = 0.5 + 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.011) * 2.2);
        out.copy(basalt).lerp(freshLava, variation * 0.5);
        // 平地上的火山灰沉积与铁锈色风化斑块
        const flat = 1 - smoothstep(0.12, 0.35, slope);
        const ashPatch = smoothstep(
          0.15,
          0.55,
          Math.sin(x * 0.0047 + 1.3) * Math.cos(z * 0.0061 - 0.7)
        );
        out.lerp(ashGrey, ashPatch * flat * 0.45 * land);
        out.lerp(rustAsh, smoothstep(0.7, 1, variation) * flat * 0.3 * land);
        // 高处覆盖火山灰，带铁锈色条纹
        const highAsh = smoothstep(60, 220, h);
        out.lerp(ashGrey, highAsh * 0.55);
        out.lerp(rustAsh, highAsh * smoothstep(0.55, 0.95, variation) * 0.45);
        // 陡坡 = 新鲜断面
        out.lerp(freshLava, smoothstep(0.45, 0.8, slope) * 0.5);
        // 火山口硫磺沉积
        for (const cone of VOLCANO_CONES) {
          if (!cone.lavaCrater) continue;
          const d = Math.hypot(x - cone.x, z - cone.z);
          const ring = smoothstep(cone.craterRadius * 1.6, cone.craterRadius * 1.05, d);
          out.lerp(sulfur, ring * 0.35 * smoothstep(0.4, 0.9, variation));
        }
        // 熔岩河岸焦痕
        const edge = field.riverEdgeDistance(x, z);
        out.lerp(scorched, smoothstep(40, 0, edge) * 0.6);
        // 黑沙滩与海床
        const beach = 1 - smoothstep(1, 7, h);
        out.lerp(blackSand, beach * land);
        out.lerp(seabed, 1 - smoothstep(-6, 0.5, h));
      },
      scalarAttributes: {
        aHeat: (x, z) => field.heatAt(x, z),
      },
    });
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.93,
      metalness: 0.04,
    });
    injectLavaCracks(material, lavaTime, 0xff5a12);
    const terrain = new THREE.Mesh(geometry, material);
    terrain.name = 'volcanoTerrain';
    terrain.receiveShadow = true;
    this.root.add(terrain);
  }

  private buildSea(ctx: TerrainEnvironmentContext): void {
    const field = this.field;
    this.water = buildWorldscapeWater({
      size: 4400,
      grid: ctx.isMobile ? 140 : 190,
      depthAt: (x, z) => -field.groundHeight(x, z),
      deepColor: 0x06141a,
      shallowColor: 0x1d3c40,
      skyTint: 0x7a3a26,
      sunDir: ctx.sunDirection,
      sunColor: 0xff9a5a,
      sunIntensity: 1.1,
    });
    this.water.mesh.position.y = this.waterY;
    this.water.mesh.name = 'volcanoSea';
    this.root.add(this.water.mesh);
  }

  /* ------------------------------------------------------------------ */
  /* 熔岩河 / 熔岩湖 / 火山口熔岩湖                                       */
  /* ------------------------------------------------------------------ */

  private buildLava(ctx: TerrainEnvironmentContext): THREE.ShaderMaterial[] {
    const field = this.field;
    const riverMaterial = createLavaMaterial({ flowSpeed: 2.6, glow: 1 });
    const lakeMaterial = createLavaMaterial({ flowSpeed: 0.7, glow: 1.3 });
    const lavaGroup = new THREE.Group();
    lavaGroup.name = 'volcanoLava';

    // 熔岩河：沿 Catmull-Rom 曲线每 ~9 米取样，横向 5 列顶点
    const columns = [-1, -0.5, 0, 0.5, 1];
    VOLCANO_LAVA_RIVERS.forEach((river, riverIndex) => {
      const curve = new THREE.CatmullRomCurve3(
        river.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
        false,
        'centripetal'
      );
      const length = curve.getLength();
      const samples = Math.max(8, Math.round(length / (ctx.isMobile ? 14 : 9)));
      const points = curve.getSpacedPoints(samples);
      const positions = new Float32Array(points.length * columns.length * 3);
      const uvs = new Float32Array(points.length * columns.length * 2);
      const edges = new Float32Array(points.length * columns.length);
      const tangent = new THREE.Vector3();
      let along = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i > 0) along += p.distanceTo(points[i - 1]);
        const next = points[Math.min(points.length - 1, i + 1)];
        const prev = points[Math.max(0, i - 1)];
        tangent.subVectors(next, prev).setY(0).normalize();
        const nx = -tangent.z;
        const nz = tangent.x;
        const t = i / (points.length - 1);
        const halfWidth =
          (river.startHalfWidth + (river.endHalfWidth - river.startHalfWidth) * t) * 1.08;
        for (let c = 0; c < columns.length; c++) {
          const offset = columns[c] * halfWidth;
          const x = p.x + nx * offset;
          const z = p.z + nz * offset;
          const surface = field.baseHeight(x, z) - river.depth * 0.3 + 0.2;
          const index = i * columns.length + c;
          positions[index * 3] = x;
          positions[index * 3 + 1] = this.waterY + Math.max(surface, -0.6);
          positions[index * 3 + 2] = z;
          uvs[index * 2] = offset;
          uvs[index * 2 + 1] = along;
          edges[index] = 1 - Math.abs(columns[c]);
        }
      }
      const indices: number[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        for (let c = 0; c < columns.length - 1; c++) {
          const a = i * columns.length + c;
          const b = (i + 1) * columns.length + c;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, riverMaterial);
      mesh.name = `lavaRiver${riverIndex}`;
      lavaGroup.add(mesh);
    });

    // 熔岩湖（平原 + 火山口）：径向圆盘，aEdge = 1 - r
    const addLakeDisc = (
      x: number,
      z: number,
      radius: number,
      level: number,
      name: string
    ): void => {
      const rings = 6;
      const sectors = 40;
      const positions: number[] = [x, this.waterY + level, z];
      const uvs: number[] = [x, z];
      const edges: number[] = [1];
      for (let r = 1; r <= rings; r++) {
        const rr = (r / rings) * radius;
        for (let s = 0; s < sectors; s++) {
          const angle = (s / sectors) * Math.PI * 2;
          const wobble = 1 + 0.06 * Math.sin(angle * 5 + x) + 0.04 * Math.sin(angle * 9 + z);
          const px = x + Math.cos(angle) * rr * (r === rings ? wobble : 1);
          const pz = z + Math.sin(angle) * rr * (r === rings ? wobble : 1);
          positions.push(px, this.waterY + level, pz);
          uvs.push(px, pz);
          edges.push(1 - r / rings);
        }
      }
      const indices: number[] = [];
      for (let s = 0; s < sectors; s++) {
        indices.push(0, 1 + ((s + 1) % sectors), 1 + s);
      }
      for (let r = 1; r < rings; r++) {
        const inner = 1 + (r - 1) * sectors;
        const outer = 1 + r * sectors;
        for (let s = 0; s < sectors; s++) {
          const s1 = (s + 1) % sectors;
          indices.push(inner + s, inner + s1, outer + s, outer + s, inner + s1, outer + s1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, lakeMaterial);
      mesh.name = name;
      lavaGroup.add(mesh);
    };

    VOLCANO_LAVA_LAKES.forEach((lake, index) => {
      addLakeDisc(lake.x, lake.z, lake.radius * 1.02, field.lakeLevel(index), `lavaLake${index}`);
    });
    VOLCANO_CONES.forEach((cone, index) => {
      const level = field.craterLavaLevel(index);
      if (level !== null) {
        addLakeDisc(cone.x, cone.z, cone.craterRadius * 0.62, level, `craterLava${index}`);
      }
    });

    this.root.add(lavaGroup);
    return [riverMaterial, lakeMaterial];
  }

  /* ------------------------------------------------------------------ */
  /* 海岸玄武岩柱群与熔岩巨砾                                              */
  /* ------------------------------------------------------------------ */

  private buildRocks(ctx: TerrainEnvironmentContext, rng: () => number): void {
    const field = this.field;
    const tokens = ctx.tokens;
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tokens.terrainPrimary).multiplyScalar(0.9),
      roughness: 0.86,
      metalness: 0.08,
      flatShading: true,
    });
    const columnCount = Math.round(340 * ctx.detailScale);
    const columns = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(4.2, 4.2, 1, 6),
      columnMaterial,
      columnCount
    );
    columns.name = 'basaltColumns';
    columns.castShadow = true;
    // 沿海岸线挑选若干簇
    let placed = 0;
    const clusterCount = 11;
    for (let c = 0; c < clusterCount && placed < columnCount; c++) {
      const theta = (c / clusterCount) * Math.PI * 2 + rng() * 0.3;
      const coastR = field.coast.radiusAt(theta);
      const cx = field.coast.centerX + Math.cos(theta) * (coastR - 10);
      const cz = field.coast.centerZ + Math.sin(theta) * (coastR - 10);
      const perCluster = Math.floor(columnCount / clusterCount);
      for (let i = 0; i < perCluster && placed < columnCount; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = Math.sqrt(rng()) * 60;
        const x = cx + Math.cos(angle) * radius;
        const z = cz + Math.sin(angle) * radius;
        const ground = this.waterY + field.groundHeight(x, z);
        const height = 6 + rng() * 26 * (1 - radius / 70);
        const base = Math.min(ground, this.waterY) - 4;
        const top = Math.max(ground, this.waterY) + height;
        setInstanceTransform(
          columns,
          placed++,
          x,
          (base + top) / 2,
          z,
          rng() * Math.PI,
          1,
          top - base,
          1
        );
      }
    }
    columns.count = placed;
    columns.instanceMatrix.needsUpdate = true;
    this.root.add(columns);

    // 熔岩巨砾：平原上的火山弹
    const boulderCount = Math.round(260 * ctx.detailScale);
    const boulders = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(tokens.terrainSecondary).multiplyScalar(1.4),
        roughness: 0.95,
        flatShading: true,
      }),
      boulderCount
    );
    boulders.name = 'lavaBoulders';
    let boulderIndex = 0;
    for (let attempt = 0; attempt < boulderCount * 4 && boulderIndex < boulderCount; attempt++) {
      const x = (rng() - 0.5) * 2600;
      const z = (rng() - 0.5) * 2600 - 250;
      if (field.landFactor(x, z) < 0.9 || field.lavaSurface(x, z) !== null) continue;
      if (field.riverEdgeDistance(x, z) < 12) continue;
      const scale = 2 + rng() * rng() * 9;
      const y = this.waterY + field.groundHeight(x, z) + scale * 0.3;
      setInstanceTransform(
        boulders,
        boulderIndex++,
        x,
        y,
        z,
        rng() * Math.PI * 2,
        scale,
        scale * (0.6 + rng() * 0.4),
        scale * (0.8 + rng() * 0.4),
        rng() * 0.6,
        rng() * 0.6
      );
    }
    boulders.count = boulderIndex;
    boulders.instanceMatrix.needsUpdate = true;
    this.root.add(boulders);
  }

  /* ------------------------------------------------------------------ */
  /* 大气：火山灰柱、蒸汽、黑烟、火星喷泉、熔岩辉光                         */
  /* ------------------------------------------------------------------ */

  private buildAtmosphere(
    ctx: TerrainEnvironmentContext,
    foundry: { smoke: PuffEmitter[]; steam: PuffEmitter[]; fire: PuffEmitter[]; glows: GlowCard[] }
  ): Array<(elapsed: number) => void> {
    const field = this.field;
    const layers: Array<(elapsed: number) => void> = [];
    const windSpeed = 3 + ctx.windStrength * 7;
    const wind = { x: Math.cos(ctx.windAngle) * windSpeed, z: Math.sin(ctx.windAngle) * windSpeed };
    const scale = ctx.detailScale;

    // 火山灰柱：主火山口冲天灰柱 + 次火山锥 / 渣锥 / 远景火山的细烟
    const ashEmitters: PuffEmitter[] = [];
    VOLCANO_CONES.forEach((cone, index) => {
      const rimY = this.waterY + field.groundHeight(cone.x + cone.craterRadius, cone.z);
      const isMain = cone === VOLCANO_MAIN_CONE;
      const isDistant = Math.hypot(cone.x, cone.z) > 1600;
      ashEmitters.push({
        x: cone.x,
        y: rimY - (isMain ? 30 : 10),
        z: cone.z,
        count: Math.round((isMain ? 120 : isDistant ? 10 : 22) * scale),
        life: isMain ? 32 : 22,
        rise: isMain ? 17 : 9,
        size: isMain ? 60 : cone.craterRadius * 0.9,
        growth: isMain ? 5 : 3.4,
        spread: isMain ? 70 : cone.craterRadius,
        color: index === 0 ? 0x4a403c : 0x5a5250,
        colorJitter: 0.25,
      });
    });
    const ash = createPuffField({
      emitters: ashEmitters,
      wind,
      opacity: 0.66,
      baseGlow: 0xa8400e,
      name: 'volcanoAshPlumes',
      seed: 61,
    });
    this.root.add(ash.mesh);
    layers.push((elapsed) => ash.update(elapsed));

    // 白色蒸汽：熔岩入海口 + 冷却塔
    const steamEmitters: PuffEmitter[] = [...foundry.steam];
    for (const river of VOLCANO_LAVA_RIVERS) {
      // 找到河道首次低于海面的位置作为入海口
      for (let i = river.points.length - 1; i > 0; i--) {
        const [x, z] = river.points[i];
        if (field.baseHeight(x, z) > -1) {
          steamEmitters.push({
            x,
            y: this.waterY + 1,
            z,
            count: Math.round(26 * scale),
            life: 11,
            rise: 9,
            size: 22,
            growth: 3.2,
            spread: 34,
            color: 0x7a736e,
            colorJitter: 0.08,
          });
          break;
        }
      }
    }
    const steam = createPuffField({
      emitters: steamEmitters,
      wind,
      opacity: 0.36,
      name: 'volcanoSteam',
      seed: 62,
    });
    this.root.add(steam.mesh);
    layers.push((elapsed) => steam.update(elapsed));

    // 黑烟：高炉烟囱、坡面炉口
    const smoke = createPuffField({
      emitters: foundry.smoke,
      wind,
      opacity: 0.55,
      baseGlow: 0x3a1206,
      name: 'foundrySmoke',
      seed: 63,
    });
    this.root.add(smoke.mesh);
    layers.push((elapsed) => smoke.update(elapsed));

    // 火：火炬塔火焰 + 熔岩湖/火山口上方的火星喷泉（加色）
    const fireEmitters: PuffEmitter[] = [...foundry.fire];
    VOLCANO_LAVA_LAKES.forEach((lake, index) => {
      fireEmitters.push({
        x: lake.x,
        y: this.waterY + field.lakeLevel(index) + 1,
        z: lake.z,
        count: Math.round(26 * scale),
        life: 3.2,
        rise: 16,
        size: 2.4,
        growth: 0.5,
        spread: lake.radius,
        color: 0xff7a26,
        colorJitter: 0.35,
      });
    });
    VOLCANO_CONES.forEach((cone, index) => {
      const level = field.craterLavaLevel(index);
      if (level === null) return;
      fireEmitters.push({
        x: cone.x,
        y: this.waterY + level + 2,
        z: cone.z,
        count: Math.round((cone === VOLCANO_MAIN_CONE ? 60 : 24) * scale),
        life: 4.5,
        rise: cone === VOLCANO_MAIN_CONE ? 34 : 20,
        size: cone === VOLCANO_MAIN_CONE ? 5 : 3,
        growth: 0.6,
        spread: cone.craterRadius * 0.6,
        color: 0xff8a2a,
        colorJitter: 0.35,
      });
    });
    const fire = createPuffField({
      emitters: fireEmitters,
      wind: { x: wind.x * 0.4, z: wind.z * 0.4 },
      opacity: 0.95,
      additive: true,
      baseGlow: 0xffc070,
      name: 'volcanoFire',
      seed: 64,
    });
    this.root.add(fire.mesh);
    layers.push((elapsed) => fire.update(elapsed));

    // 熔岩辉光：火山口、熔岩湖、熔岩河沿线 + 兵工厂炉口
    const glows: GlowCard[] = [...foundry.glows];
    VOLCANO_CONES.forEach((cone, index) => {
      const level = field.craterLavaLevel(index);
      if (level === null) return;
      const big = cone === VOLCANO_MAIN_CONE;
      glows.push({
        x: cone.x,
        y: this.waterY + level + (big ? 40 : 18),
        z: cone.z,
        size: big ? 420 : 170,
        color: 0xff4a12,
        flicker: 0.8,
      });
    });
    VOLCANO_LAVA_LAKES.forEach((lake, index) => {
      glows.push({
        x: lake.x,
        y: this.waterY + field.lakeLevel(index) + 14,
        z: lake.z,
        size: lake.radius * 3.4,
        color: 0xff5a14,
        flicker: 1.1,
      });
    });
    for (const river of VOLCANO_LAVA_RIVERS) {
      for (let i = 1; i < river.points.length - 1; i += 2) {
        const [x, z] = river.points[i];
        glows.push({
          x,
          y: this.waterY + field.baseHeight(x, z) + 10,
          z,
          size: 90 + river.endHalfWidth * 2,
          color: 0xff4a10,
          flicker: 0.9,
        });
      }
    }
    const glowCards = createGlowCards(glows, 'volcanoLavaGlow', 0.55);
    this.root.add(glowCards.mesh);
    layers.push((elapsed) => glowCards.update(elapsed));

    return layers;
  }
}
