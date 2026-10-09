/**
 * STRATOSPHERE（第 9 关「天梯之巅」）：两万米高空，赤道天梯轨道电梯。
 *
 * - 脚下是被落日点燃的云海甲板（蜂窝状积云顶，柔光着色：逆光银边、蓝紫云谷、漂移云影），
 *   远方高耸的积雨云塔，地平线按行星曲率下沉；云顶上随风流淌的薄雾与翻滚的云团；
 * - 云层深处的闪电与掠过云顶的“蜘蛛闪电”——云海是危险的：飞进云海即坠毁；
 * - 天梯：光纤主干（青色数据脉冲之间夹着神谕的红色上传数据）、升降舱、六根支柱托起的
 *   高空光环平台、斜拉索与战场边缘的锚塔、云海上的中继天线；
 * - 稀薄空气的天空：近太空的深蓝天顶、高空夜光云细丝、地平线的大气边缘光带。
 *
 * “地面”定义（坠毁面）：sampleHeight = 云海甲板（可见云顶，精确三角网插值）与竖直柱体
 * （主干 / 导轨 / 支柱 / 锚塔 / 天线）取高者；所有悬空构件位于 y ≥ 640，软顶界之上，
 * 因此柱状坠毁判定不会在构件下方误判。无水面（water = false）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TerrainType } from '../LevelConfig';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import {
  createCloudDeckMaterial,
  createCloudDeckUniforms,
  createLimbMaterial,
  createMistMaterial,
  createNoctilucentMaterial,
  type CloudDeckUniforms,
} from './cloudSeaMaterials';
import { createPuffField, type PuffEmitter } from './envKit';
import { BoltRibbons, createPath, jaggedPath } from './lightning';
import { buildSkyLadder } from './skyLadder';
import {
  DECK_HALF,
  SKY_LADDER_CENTER,
  StratosphereField,
  stratosphereRng,
} from './StratosphereField';
import { StructureField } from './structureField';

export class StratosphereEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.STRATOSPHERE;
  readonly hasWater = false;
  private field: StratosphereField | null = null;
  private readonly structures = new StructureField();

  constructor() {
    super('stratosphereEnvironment');
  }

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY;
    }
    const deck = this.waterY + (this.field ? this.field.sampleDeck(worldX, worldZ) : 4);
    return Math.max(deck, this.structures.sample(worldX, worldZ));
  }

  isWater(): boolean {
    return false;
  }

  /** 天梯构件 → 'city'；其余为云海 → 'cloud' */
  surfaceKindAt(worldX: number, worldZ: number): TerrainSurfaceKind {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return 'cloud';
    }
    const deck = this.waterY + (this.field ? this.field.sampleDeck(worldX, worldZ) : 4);
    return this.structures.sample(worldX, worldZ) > deck ? 'city' : 'cloud';
  }

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    const tokens = ctx.tokens;
    const field = new StratosphereField(ctx.isMobile ? 32 : 20);
    this.field = field;
    const rng = stratosphereRng();
    const shared = createCloudDeckUniforms();
    const windSpeed = 6 + ctx.windStrength * 12;
    const wind = new THREE.Vector2(Math.cos(ctx.windAngle), Math.sin(ctx.windAngle)).multiplyScalar(
      windSpeed
    );
    const deckColors = {
      lit: new THREE.Color(tokens.terrainPrimary).lerp(new THREE.Color(0xfff4ea), 0.3),
      shade: new THREE.Color(0x8f8cba),
      deep: new THREE.Color(0x55548e),
      rim: new THREE.Color(0xffd2a0),
      sun: new THREE.Color(tokens.terrainAccent),
    };

    this.buildDeck(field, ctx, shared, wind, deckColors);
    this.buildStormTowers(ctx, shared, wind, deckColors, rng);

    const ladder = buildSkyLadder({
      tokens,
      structures: this.structures,
      deckAt: (x, z) => this.waterY + field.sampleDeck(x, z),
      rng,
      isMobile: ctx.isMobile,
      time: shared.uTime,
    });
    this.root.add(ladder.group);

    // 云顶薄雾：随风流淌的半透明薄层
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2),
      createMistMaterial(shared.uTime, wind, 0xfff0e8, 0.18)
    );
    mist.name = 'stratosphereMist';
    mist.position.y = this.waterY + 27;
    mist.renderOrder = 0;
    this.root.add(mist);

    // 高空夜光云
    const focus = new THREE.Vector3();
    const nlc = new THREE.Mesh(
      new THREE.PlaneGeometry(16000, 16000, 1, 1).rotateX(Math.PI / 2),
      createNoctilucentMaterial(shared.uTime, focus, 0x9ad8ff)
    );
    nlc.name = 'stratosphereNoctilucent';
    nlc.position.y = 2300;
    nlc.frustumCulled = false;
    nlc.renderOrder = 0;
    this.root.add(nlc);

    // 地平线大气边缘光带：跟随视点的圆筒（无限远处的效果）
    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(4900, 4900, 900, 72, 1, true),
      createLimbMaterial({
        sunDirection: ctx.sunDirection,
        cool: 0x8ab4ff,
        warm: 0xffa46a,
        bandY: this.waterY - 20,
      })
    );
    limb.name = 'stratosphereLimb';
    limb.position.y = this.waterY + 300;
    limb.frustumCulled = false;
    limb.renderOrder = 0;
    this.root.add(limb);

    // 翻滚的云团：云顶上缓慢膨胀又消散的柔软团块 + 天梯入云处的环绕云
    const puffs: PuffEmitter[] = [];
    const boiling = Math.round((ctx.isMobile ? 40 : 70) * Math.max(0.6, ctx.detailScale));
    for (let i = 0; i < boiling; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 200 + Math.sqrt(rng()) * 2800;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      puffs.push({
        x,
        y: this.waterY + field.sampleDeck(x, z) - 6,
        z,
        count: 3,
        life: 46,
        rise: 0.4,
        size: 34 + rng() * 22,
        growth: 1.7,
        spread: 34,
        color: 0xf6dcd4,
        colorJitter: 0.08,
      });
    }
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2;
      const x = SKY_LADDER_CENTER.x + Math.cos(angle) * 70;
      const z = SKY_LADDER_CENTER.z + Math.sin(angle) * 70;
      puffs.push({
        x,
        y: ladder.trunkBase.y - 4,
        z,
        count: 4,
        life: 30,
        rise: 1.6,
        size: 38,
        growth: 2.2,
        spread: 26,
        color: 0xfff2ea,
        colorJitter: 0.05,
      });
    }
    const puffField = createPuffField({
      emitters: puffs,
      wind: { x: wind.x * 0.5, z: wind.y * 0.5 },
      opacity: 0.3,
      billow: 0.75,
      name: 'stratosphereBillows',
      seed: 99,
    });
    this.root.add(puffField.mesh);

    const lightning = this.buildCloudLightning(field, shared, rng);

    this.animate((dt, elapsed, playerFocus) => {
      shared.uTime.value = elapsed;
      if (Number.isFinite(playerFocus.x) && Number.isFinite(playerFocus.z)) {
        focus.copy(playerFocus);
        limb.position.x = playerFocus.x;
        limb.position.z = playerFocus.z;
      }
      puffField.update(elapsed);
      ladder.update(dt, elapsed);
      lightning(dt, elapsed, focus);
    });
  }

  /** 云海甲板：直线非均匀网格，平滑法线 */
  private buildDeck(
    field: StratosphereField,
    ctx: TerrainEnvironmentContext,
    shared: CloudDeckUniforms,
    wind: THREE.Vector2,
    colors: {
      lit: THREE.Color;
      shade: THREE.Color;
      deep: THREE.Color;
      rim: THREE.Color;
      sun: THREE.Color;
    }
  ): void {
    const cols = field.columns;
    const rows = field.rows;
    const positions = new Float32Array(cols * rows * 3);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const index = j * cols + i;
        positions[index * 3] = field.xs[i];
        positions[index * 3 + 1] = this.waterY + field.hs[index];
        positions[index * 3 + 2] = field.zs[j];
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
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = createCloudDeckMaterial({
      waterY: this.waterY,
      sunDirection: ctx.sunDirection,
      ...colors,
      wind,
      aoBase: -6,
      aoRange: 34,
      shared,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'stratosphereCloudDeck';
    mesh.frustumCulled = false;
    this.root.add(mesh);
  }

  /** 远方积雨云塔：平滑球团堆叠 + 顺风展开的砧状云顶（战场之外，纯背景） */
  private buildStormTowers(
    ctx: TerrainEnvironmentContext,
    shared: CloudDeckUniforms,
    wind: THREE.Vector2,
    colors: {
      lit: THREE.Color;
      shade: THREE.Color;
      deep: THREE.Color;
      rim: THREE.Color;
      sun: THREE.Color;
    },
    rng: () => number
  ): void {
    const field = this.field;
    if (!field) return;
    const geometries: THREE.BufferGeometry[] = [];
    const count = ctx.isMobile ? 5 : 8;
    const windX = wind.x / Math.max(1e-3, wind.length());
    const windZ = wind.y / Math.max(1e-3, wind.length());
    const sunAzimuth = Math.atan2(ctx.sunDirection.z, ctx.sunDirection.x);
    const widthSegments = ctx.isMobile ? 9 : 12;
    const heightSegments = ctx.isMobile ? 6 : 8;
    const lobe = (rx: number, ry: number, rz: number, x: number, y: number, z: number): void => {
      const sphere = new THREE.SphereGeometry(1, widthSegments, heightSegments);
      sphere.scale(rx, ry, rz);
      sphere.translate(x, y, z);
      geometries.push(sphere);
    };
    for (let t = 0; t < count; t++) {
      // 两座立在落日方向形成剪影，其余环绕地平线
      const angle = t < 2 ? sunAzimuth + (t === 0 ? -0.35 : 0.42) : rng() * Math.PI * 2;
      const radius = 2900 + rng() * 1500;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const baseY = this.waterY + field.sampleDeck(x, z) - 40;
      const height = 460 + rng() * 320;
      const baseRadius = 340 + rng() * 180;
      // 塔身：每层 3 个错落的云包，向上收窄
      const levels = 6;
      for (let k = 0; k < levels; k++) {
        const f = k / (levels - 1);
        const r = baseRadius * (1 - 0.38 * f);
        for (let n = 0; n < 3; n++) {
          const a = (n / 3) * Math.PI * 2 + rng() * 1.2 + k;
          const offset = r * 0.36;
          lobe(
            r * (0.62 + rng() * 0.2),
            r * (0.5 + rng() * 0.15),
            r * (0.62 + rng() * 0.2),
            x + Math.cos(a) * offset,
            baseY + f * height,
            z + Math.sin(a) * offset
          );
        }
      }
      // 冲顶云包 + 砧状云顶：顺风逐渐展开、变薄的一串扁平云团
      const top = baseY + height + baseRadius * 0.15;
      lobe(baseRadius * 0.5, baseRadius * 0.42, baseRadius * 0.5, x, top + baseRadius * 0.12, z);
      const sideX = -windZ;
      const sideZ = windX;
      for (let n = 0; n < 7; n++) {
        const along = 0.1 + n * 0.36 + rng() * 0.12;
        const spread = (rng() - 0.5) * baseRadius * 0.9;
        const r = baseRadius * (0.75 - n * 0.05) * (0.85 + rng() * 0.3);
        const sphere = new THREE.SphereGeometry(1, widthSegments + 2, heightSegments);
        sphere.scale(r * 1.2, baseRadius * (0.3 - n * 0.025), r * 0.9);
        sphere.rotateY(-Math.atan2(windZ, windX));
        sphere.translate(
          x + windX * baseRadius * along + sideX * spread,
          top + baseRadius * (0.08 + 0.05 * Math.sin(n)),
          z + windZ * baseRadius * along + sideZ * spread
        );
        geometries.push(sphere);
      }
    }
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    merged.computeBoundingSphere();
    const material = createCloudDeckMaterial({
      waterY: this.waterY,
      sunDirection: ctx.sunDirection,
      ...colors,
      wind,
      aoBase: 0,
      aoRange: 420,
      shared,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'stratosphereStormTowers';
    mesh.frustumCulled = false;
    this.root.add(mesh);
  }

  /**
   * 云层闪电：云海深处随机亮起的冷白闪光（写入甲板着色器），偶尔伴随掠过云顶的“蜘蛛闪电”。
   */
  private buildCloudLightning(
    field: StratosphereField,
    shared: CloudDeckUniforms,
    rng: () => number
  ): (dt: number, elapsed: number, focus: THREE.Vector3) => void {
    const ribbons = new BoltRibbons(40, 'stratosphereSpiderLightning');
    this.root.add(ribbons.mesh);
    const path = createPath(5);
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    let cooldown = 1.5 + rng() * 2;
    let remaining = 0;
    let duration = 0.4;
    let spider = false;
    let slots = 0;
    return (dt, elapsed, focus) => {
      if (remaining > 0) {
        remaining -= dt;
        const fade = Math.max(0, remaining / duration);
        const flicker = fade * (0.5 + 0.5 * Math.abs(Math.sin(elapsed * 41)));
        shared.uFlashA.value.w = flicker * 1.6;
        shared.uFlashB.value.w = flicker * 0.9;
        if (spider) {
          ribbons.setIntensity(0, slots, flicker > 0.03 ? 0.25 + flicker * 0.8 : 0);
          ribbons.commit();
        }
        if (remaining <= 0) {
          shared.uFlashA.value.w = 0;
          shared.uFlashB.value.w = 0;
          ribbons.clear(0, ribbons.capacity);
          ribbons.commit();
          cooldown = 1.8 + rng() * 4.5;
        }
        return;
      }
      cooldown -= dt;
      if (cooldown > 0) return;
      const angle = rng() * Math.PI * 2;
      const distance = 450 + rng() * 2000;
      const x = (Number.isFinite(focus.x) ? focus.x : 0) + Math.cos(angle) * distance;
      const z = (Number.isFinite(focus.z) ? focus.z : 0) + Math.sin(angle) * distance;
      const clampedX = THREE.MathUtils.clamp(x, -DECK_HALF + 100, DECK_HALF - 100);
      const clampedZ = THREE.MathUtils.clamp(z, -DECK_HALF + 100, DECK_HALF - 100);
      const deckY = this.waterY + field.sampleDeck(clampedX, clampedZ);
      shared.uFlashA.value.set(clampedX, deckY - 8, clampedZ, 0);
      shared.uFlashB.value.set(
        clampedX + (rng() - 0.5) * 300,
        deckY - 12,
        clampedZ + (rng() - 0.5) * 300,
        0
      );
      duration = 0.35 + rng() * 0.3;
      remaining = duration;
      spider = rng() < 0.4;
      if (spider) {
        // 蜘蛛闪电：沿云顶水平爬行的长分叉电光
        const length = 260 + rng() * 420;
        const heading = rng() * Math.PI * 2;
        from.set(clampedX, deckY + 4, clampedZ);
        to.set(clampedX + Math.cos(heading) * length, 0, clampedZ + Math.sin(heading) * length);
        to.y = this.waterY + field.sampleDeck(to.x, to.z) + 4;
        jaggedPath(from, to, 0.16, rng, path);
        ribbons.clear(0, ribbons.capacity);
        slots = 0;
        for (let i = 0; i < path.length - 1; i++) {
          // 贴着云顶：每个折点抬到云顶之上
          const p = path[i + 1];
          p.y = Math.max(p.y, this.waterY + field.sampleDeck(p.x, p.z) + 3);
          ribbons.setSegment(slots++, path[i], p, 1.4, 1);
        }
        ribbons.commit();
      }
    };
  }
}
