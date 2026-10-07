/**
 * CITADEL（第 10 关「神谕核心」）—— 占位环境（working placeholder）。
 *
 * 由 terrain-core 批次提供，满足完整的 TerrainEnvironment 契约：
 * - 陨石坑：外缘环形坑壁（≈ 战场边缘），坑底为带熔火裂隙的黑曜石平原；
 * - 坑心偏北矗立阶梯状黑曜城堡（参与坠毁判定），棱线嵌霓虹绯红灯带，缓慢呼吸发光。
 * 无水面（water = false）。
 *
 * 后续 terrain-B 批次会用完整的黑曜城堡环境（城墙、护盾塔基座、熔火河、霓虹）替换本模块。
 */
import * as THREE from 'three';
import { TerrainType } from '../LevelConfig';
import { Noise2D, smoothstep } from '../worldscape/noise';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import { buildHeightGridGeometry } from './envKit';

const CRATER_FLOOR = 8;
const CRATER_RIM_RADIUS = 1420;
const CRATER_RIM_HEIGHT = 175;
const CITADEL_X = 0;
const CITADEL_Z = -640;

/** 城堡阶梯：半边长（米）与顶面相对水位高度 */
const CITADEL_TIERS: ReadonlyArray<{ half: number; top: number }> = [
  { half: 130, top: 48 },
  { half: 90, top: 92 },
  { half: 55, top: 140 },
];

export class CitadelEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.CITADEL;
  readonly hasWater = false;
  private readonly noise = new Noise2D(20261010);

  constructor() {
    super('citadelEnvironment');
  }

  /** 陨石坑地形（相对水位，不含城堡） */
  private craterHeight(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const rimRadius = CRATER_RIM_RADIUS + 60 * Math.sin(angle * 3 + 0.7) + 30 * Math.sin(angle * 7);
    const inner = smoothstep(rimRadius - 520, rimRadius, r);
    const outer = 1 - smoothstep(rimRadius, rimRadius + 700, r);
    const rim = Math.min(inner, 1) * (r <= rimRadius ? 1 : outer);
    const rimNoise = this.noise.ridged(x * 0.003, z * 0.003, 3) * 40 * rim;
    const floorNoise = this.noise.fbm(x * 0.004, z * 0.004, 3) * 4;
    const outside = r > rimRadius ? 60 * smoothstep(rimRadius, rimRadius + 700, r) : 0;
    return CRATER_FLOOR + floorNoise + rim * CRATER_RIM_HEIGHT + rimNoise + outside;
  }

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    const tokens = ctx.tokens;
    const obsidian = new THREE.Color(tokens.terrainPrimary);
    const deep = new THREE.Color(tokens.terrainSecondary);
    const scorched = new THREE.Color(tokens.terrainAccent);
    const geometry = buildHeightGridGeometry({
      sizeX: 4400,
      sizeZ: 4400,
      segmentsX: ctx.isMobile ? 150 : 200,
      segmentsZ: ctx.isMobile ? 150 : 200,
      heightAt: (x, z) => this.waterY + this.craterHeight(x, z),
      colorAt: (x, z, _y, slope, out) => {
        out.copy(obsidian).lerp(deep, smoothstep(0.3, 0.7, slope));
        const scorch = smoothstep(0.2, 0.8, this.noise.fbm(x * 0.002 + 5, z * 0.002, 2));
        out.lerp(scorched, scorch * 0.35);
      },
    });
    const ground = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.42,
        metalness: 0.25,
      })
    );
    ground.name = 'citadelCraterGround';
    ground.receiveShadow = true;
    this.root.add(ground);

    // 阶梯城堡 + 霓虹棱线
    const keep = new THREE.Group();
    keep.name = 'oracleCitadelKeep';
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: tokens.structure,
      roughness: 0.3,
      metalness: 0.55,
    });
    const neonMaterial = new THREE.MeshBasicMaterial({ color: tokens.glow, toneMapped: false });
    let previousTop = CRATER_FLOOR - 6;
    for (const tier of CITADEL_TIERS) {
      const height = tier.top - previousTop;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(tier.half * 2, height, tier.half * 2),
        stoneMaterial
      );
      block.position.set(CITADEL_X, ctx.waterY + previousTop + height / 2, CITADEL_Z);
      block.castShadow = true;
      keep.add(block);
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(tier.half * 2 + 2, 1.6, tier.half * 2 + 2),
        neonMaterial
      );
      trim.position.set(CITADEL_X, ctx.waterY + tier.top + 0.4, CITADEL_Z);
      keep.add(trim);
      previousTop = tier.top;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(22, 120, 6), stoneMaterial);
    spire.position.set(CITADEL_X, ctx.waterY + previousTop + 60, CITADEL_Z);
    keep.add(spire);
    this.root.add(keep);

    // 坑底熔火裂隙：发光细带
    const fissureMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a2a, toneMapped: false });
    const fissures = new THREE.Group();
    fissures.name = 'citadelFissures';
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + 0.3;
      const length = 260 + (i % 3) * 120;
      const midR = 380 + (i % 4) * 140;
      const x = Math.cos(angle) * midR;
      const z = Math.sin(angle) * midR;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(length, 0.6, 3.5), fissureMaterial);
      strip.position.set(x, this.sampleHeight(x, z) + 0.6, z);
      strip.rotation.y = -angle + Math.PI / 2;
      fissures.add(strip);
    }
    this.root.add(fissures);

    const neonBase = new THREE.Color(tokens.glow);
    this.animate((_dt, elapsed) => {
      neonMaterial.color.copy(neonBase).multiplyScalar(0.7 + 0.3 * Math.sin(elapsed * 1.6));
    });
  }

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY;
    }
    const dx = Math.abs(worldX - CITADEL_X);
    const dz = Math.abs(worldZ - CITADEL_Z);
    let structureTop = -Infinity;
    for (const tier of CITADEL_TIERS) {
      if (dx <= tier.half && dz <= tier.half) {
        structureTop = tier.top;
      }
    }
    if (Math.hypot(dx, dz) <= 22) {
      structureTop = CITADEL_TIERS[CITADEL_TIERS.length - 1].top + 120;
    }
    const ground = this.craterHeight(worldX, worldZ);
    return this.waterY + Math.max(ground, structureTop);
  }

  isWater(): boolean {
    return false;
  }

  surfaceKindAt(): TerrainSurfaceKind {
    return 'rock';
  }
}
