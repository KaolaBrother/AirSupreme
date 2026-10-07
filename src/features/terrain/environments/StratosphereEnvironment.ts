/**
 * STRATOSPHERE（第 9 关「天梯之巅」）—— 占位环境（working placeholder）。
 *
 * 由 terrain-core 批次提供，满足完整的 TerrainEnvironment 契约：
 * - 脚下是一片缓慢起伏、被低角度阳光“点燃”的云海甲板（作为坠毁地面：飞进云海即坠毁）；
 * - 战场北侧矗立天梯轨道电梯的光纤主干（实心柱体，参与坠毁判定），配发光导环与顶端信标。
 * 无水面（water = false）。
 *
 * 后续 terrain-B 批次会用完整的平流层环境（体积云海、天梯平台、高空气流）替换本模块。
 */
import * as THREE from 'three';
import { TerrainType } from '../LevelConfig';
import { Noise2D, smoothstep } from '../worldscape/noise';
import type { TerrainEnvironmentContext, TerrainSurfaceKind } from './TerrainEnvironment';
import { EnvironmentBase } from './EnvironmentBase';
import { buildHeightGridGeometry, setInstanceTransform } from './envKit';

/** 天梯主干位置与尺寸 */
const TETHER_X = 0;
const TETHER_Z = -760;
const TETHER_RADIUS = 16;
const TETHER_TOP_Y = 2600;

export class StratosphereEnvironment extends EnvironmentBase {
  readonly terrain = TerrainType.STRATOSPHERE;
  readonly hasWater = false;
  private readonly noise = new Noise2D(20260909);

  constructor() {
    super('stratosphereEnvironment');
  }

  /** 云海甲板顶面（相对水位）：大尺度涌浪 + 云团隆起 */
  private deckHeight(x: number, z: number): number {
    const swell = this.noise.fbm(x * 0.0009, z * 0.0009, 3) * 9;
    const billows = Math.max(0, this.noise.fbm(x * 0.0035 + 4, z * 0.0035 - 7, 3)) * 16;
    return 4 + swell + billows;
  }

  build(ctx: TerrainEnvironmentContext): void {
    this.waterY = ctx.waterY;
    const tokens = ctx.tokens;
    const lit = new THREE.Color(tokens.terrainPrimary);
    const shade = new THREE.Color(tokens.terrainSecondary);
    const burn = new THREE.Color(tokens.terrainAccent);
    const geometry = buildHeightGridGeometry({
      sizeX: 4400,
      sizeZ: 4400,
      segmentsX: ctx.isMobile ? 110 : 150,
      segmentsZ: ctx.isMobile ? 110 : 150,
      heightAt: (x, z) => this.waterY + this.deckHeight(x, z),
      colorAt: (x, z, y, _slope, out) => {
        const h = y - this.waterY;
        out.copy(shade).lerp(lit, smoothstep(4, 22, h));
        const glow = smoothstep(0.1, 0.7, this.noise.fbm(x * 0.0012 - 3, z * 0.0012 + 5, 2));
        out.lerp(burn, glow * 0.45);
      },
    });
    const deckMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color(tokens.terrainAccent),
      emissiveIntensity: 0.16,
    });
    const deck = new THREE.Mesh(geometry, deckMaterial);
    deck.name = 'stratosphereCloudDeck';
    deck.receiveShadow = true;
    this.root.add(deck);

    // 天梯主干：白色金属柱 + 发光导环 + 顶端信标
    const tether = new THREE.Group();
    tether.name = 'skyspireTether';
    const shaftHeight = TETHER_TOP_Y - ctx.waterY;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(TETHER_RADIUS * 0.8, TETHER_RADIUS, shaftHeight, 16, 1),
      new THREE.MeshStandardMaterial({
        color: tokens.structure,
        roughness: 0.35,
        metalness: 0.7,
        emissive: new THREE.Color(tokens.glow),
        emissiveIntensity: 0.12,
      })
    );
    shaft.position.set(TETHER_X, ctx.waterY + shaftHeight / 2, TETHER_Z);
    tether.add(shaft);

    const ringCount = 22;
    const rings = new THREE.InstancedMesh(
      new THREE.TorusGeometry(TETHER_RADIUS * 1.5, 2.2, 6, 24),
      new THREE.MeshBasicMaterial({ color: tokens.glow, toneMapped: false }),
      ringCount
    );
    rings.name = 'skyspireRings';
    for (let i = 0; i < ringCount; i++) {
      const y = ctx.waterY + 40 + i * 110;
      setInstanceTransform(rings, i, TETHER_X, y, TETHER_Z, 0, 1, 1, 1, Math.PI / 2, 0);
    }
    rings.instanceMatrix.needsUpdate = true;
    tether.add(rings);
    this.root.add(tether);

    const ringMaterial = rings.material as THREE.MeshBasicMaterial;
    const baseColor = new THREE.Color(tokens.glow);
    this.animate((_dt, elapsed) => {
      ringMaterial.color.copy(baseColor).multiplyScalar(0.75 + 0.25 * Math.sin(elapsed * 2.2));
    });
  }

  sampleHeight(worldX: number, worldZ: number): number {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return this.waterY;
    }
    if (Math.hypot(worldX - TETHER_X, worldZ - TETHER_Z) <= TETHER_RADIUS + 2) {
      return TETHER_TOP_Y;
    }
    return this.waterY + this.deckHeight(worldX, worldZ);
  }

  isWater(): boolean {
    return false;
  }

  surfaceKindAt(worldX: number, worldZ: number): TerrainSurfaceKind {
    return Math.hypot(worldX - TETHER_X, worldZ - TETHER_Z) <= TETHER_RADIUS + 2 ? 'rock' : 'cloud';
  }
}
