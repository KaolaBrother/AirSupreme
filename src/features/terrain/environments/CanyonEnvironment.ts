/**
 * CANYON（第 8 关「雷霆峡谷」）—— 占位环境（working placeholder）。
 *
 * 由 terrain-core 批次提供，满足完整的 TerrainEnvironment 契约：蜿蜒主峡谷 + 西侧支谷、
 * 层理砂岩崖壁与台地、雷暴天气（'storm' 预设由 TerrainGenerator 的天气流程提供雨幕与闪电）。
 * 峡谷中线经过战场原点并沿 Z 轴延伸，玩家出生即位于峡谷之中。
 * 无水面（water = false）。
 *
 * 后续 terrain-B 批次会用完整的雷鸣峡谷环境替换本模块（保持同一导出名与契约）。
 */
import * as THREE from 'three';
import { TerrainType } from '../LevelConfig';
import { Noise2D, smoothstep } from '../worldscape/noise';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import { buildHeightGridGeometry } from './envKit';

/** 峡谷底（相对水位） */
const CANYON_FLOOR = 6;
/** 台地顶（相对水位） */
const CANYON_PLATEAU = 150;

export class CanyonEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.CANYON;
  readonly hasWater = false;
  private readonly noise = new Noise2D(20260808);

  constructor() {
    super('canyonEnvironment');
  }

  /** 主峡谷中线 x(z)：经过原点 */
  private centerlineX(z: number): number {
    return (
      240 * (Math.sin(z * 0.0015 + 0.4) - Math.sin(0.4)) +
      110 * (Math.sin(z * 0.0042 + 1.3) - Math.sin(1.3))
    );
  }

  /** 局部高度（相对水位） */
  private localHeight(x: number, z: number): number {
    const halfWidth = 150 + 50 * Math.sin(z * 0.0023 + 2.1);
    const mainDistance = Math.abs(x - this.centerlineX(z));
    // 西侧支谷：z ≈ -520 附近向西延伸
    const branchZ = -520 + 160 * Math.sin(x * 0.002);
    const branchDistance = x < 80 ? Math.abs(z - branchZ) + Math.max(0, x) * 0.6 : Infinity;
    const branchHalfWidth = 95;

    const wall = (distance: number, width: number): number => {
      const t = smoothstep(width * 0.72, width + 150, distance);
      // 砂岩层理：台阶化剖面
      const stepped = Math.floor(t * 5) / 5 + smoothstep(0, 1, (t * 5) % 1) * 0.2;
      return THREE.MathUtils.lerp(t, stepped, 0.6);
    };
    const profile = Math.min(wall(mainDistance, halfWidth), wall(branchDistance, branchHalfWidth));
    const plateauNoise = this.noise.fbm(x * 0.0021, z * 0.0021, 4) * 18;
    const floorNoise = this.noise.fbm(x * 0.006 + 9, z * 0.006 - 3, 3) * 3;
    return (
      CANYON_FLOOR +
      floorNoise * (1 - profile) +
      (CANYON_PLATEAU - CANYON_FLOOR) * profile +
      plateauNoise * profile
    );
  }

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    const tokens = ctx.tokens;
    const strataA = new THREE.Color(tokens.terrainPrimary);
    const strataB = new THREE.Color(tokens.terrainAccent);
    const strataC = new THREE.Color(tokens.terrainSecondary);
    const floorColor = new THREE.Color(tokens.terrainSecondary).lerp(
      new THREE.Color(tokens.vegetation),
      0.25
    );
    const geometry = buildHeightGridGeometry({
      sizeX: 4400,
      sizeZ: 4400,
      segmentsX: ctx.isMobile ? 150 : 210,
      segmentsZ: ctx.isMobile ? 150 : 210,
      heightAt: (x, z) => this.sampleHeight(x, z),
      colorAt: (x, z, y, slope, out) => {
        const h = y - this.waterY;
        // 按高度分层的砂岩色带
        const band = 0.5 + 0.5 * Math.sin(h * 0.21 + this.noise.noise(x * 0.004, z * 0.004));
        out.copy(strataA).lerp(strataB, band * 0.55);
        out.lerp(strataC, smoothstep(0.55, 0.9, slope) * 0.5);
        const floorT = 1 - smoothstep(CANYON_FLOOR + 4, CANYON_FLOOR + 22, h);
        out.lerp(floorColor, floorT * 0.7);
      },
    });
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.96,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'canyonTerrain';
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY;
    }
    return this.waterY + this.localHeight(worldX, worldZ);
  }

  isWater(): boolean {
    return false;
  }

  surfaceKindAt(): TerrainSurfaceKind {
    return 'rock';
  }
}
