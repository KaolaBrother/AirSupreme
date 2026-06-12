/**
 * worldscape/biomes — 生物群系顶点着色。
 * 从 worldshowcase (src/world/terrain.js) 的 biomeColor 移植：
 * 海拔决定沙滩/草地基色，湿度与森林场调制枯荣与林下暗色，
 * 坡度转岩石，雪线以上覆雪。调色板收敛为命名设计令牌，按关卡切换。
 */
import * as THREE from 'three';
import { clamp, smoothstep } from './noise';
import { Heightfield } from './heightfield';
import { injectSnowCover, type ShaderUniform } from './shadermods';

/** 生物群系调色板（命名设计令牌，十六进制） */
export interface BiomePalette {
  sandLo: number;
  sandHi: number;
  grassDry: number;
  grassLush: number;
  forestFloor: number;
  rockA: number;
  rockB: number;
  rockCold: number;
  snow: number;
  shallowBed: number;
  deepBed: number;
}

/** worldshowcase 原版调色板（精确移植） */
export const WORLDSHOWCASE_BIOME_PALETTE: BiomePalette = {
  sandLo: 0xcdb482,
  sandHi: 0xdcc99a,
  grassDry: 0x9aa860,
  grassLush: 0x5a9150,
  forestFloor: 0x53824a,
  rockA: 0x9c9486,
  rockB: 0x837d72,
  rockCold: 0x8d909a,
  snow: 0xedf2f6,
  shallowBed: 0x8e9a6a,
  deepBed: 0x3c5a52,
};

/** 沙漠：赭石、陶土与暖沙，"草"读作干涸的橄榄沙色 */
export const DESERT_BIOME_PALETTE: BiomePalette = {
  sandLo: 0xcfa86b,
  sandHi: 0xe3c089,
  grassDry: 0xc4a468,
  grassLush: 0x9d9354,
  forestFloor: 0xa08a52,
  rockA: 0xa9805a,
  rockB: 0x8a6746,
  rockCold: 0x9b7e60,
  snow: 0xf2e3c2,
  shallowBed: 0xb09a66,
  deepBed: 0x6f5b3a,
};

/** 高山雪境：冷绿、钢灰岩与高反射雪 */
export const ALPINE_BIOME_PALETTE: BiomePalette = {
  sandLo: 0xb9bdc4,
  sandHi: 0xcdd3da,
  grassDry: 0x6d7e62,
  grassLush: 0x466952,
  forestFloor: 0x3a5a4a,
  rockA: 0x8d909a,
  rockB: 0x707684,
  rockCold: 0x9aa2b0,
  snow: 0xf0f4f9,
  shallowBed: 0x6e8290,
  deepBed: 0x3a4f5e,
};

export interface BiomeSettings {
  palette: BiomePalette;
  /** 局部坐标水位（高度场基准，通常 0） */
  waterLevel: number;
  /** 雪线（局部高度），按需置高以禁用雪 */
  snowLine: number;
  /** 沙滩上界（worldshowcase: 2.6）与沙滩向草地的过渡上界（5.5） */
  beachHeight?: number;
  beachBlendTop?: number;
  /** 草色随海拔变干的除数（worldshowcase: 260） */
  lushHeightDivisor?: number;
  /** 林下地色混入比例（worldshowcase: 0.42） */
  forestDarkening?: number;
  /** 生物群系抖动噪声频率（1/米） */
  jitterFreq?: number;
  snowJitterFreq?: number;
}

const _tmpA = new THREE.Color();
const _tmpB = new THREE.Color();

/** 按 worldshowcase 规则将 (x,z,h,slope) 映射为生物群系顶点色 */
export class BiomePainter {
  private readonly field: Heightfield;
  private readonly s: Required<BiomeSettings>;
  private readonly c: Record<keyof BiomePalette, THREE.Color>;

  constructor(field: Heightfield, settings: BiomeSettings) {
    this.field = field;
    this.s = {
      beachHeight: 2.6,
      beachBlendTop: 5.5,
      lushHeightDivisor: 260,
      forestDarkening: 0.42,
      jitterFreq: 0.009,
      snowJitterFreq: 0.0036,
      ...settings,
    };
    const palette = this.s.palette;
    this.c = {
      sandLo: new THREE.Color(palette.sandLo),
      sandHi: new THREE.Color(palette.sandHi),
      grassDry: new THREE.Color(palette.grassDry),
      grassLush: new THREE.Color(palette.grassLush),
      forestFloor: new THREE.Color(palette.forestFloor),
      rockA: new THREE.Color(palette.rockA),
      rockB: new THREE.Color(palette.rockB),
      rockCold: new THREE.Color(palette.rockCold),
      snow: new THREE.Color(palette.snow),
      shallowBed: new THREE.Color(palette.shallowBed),
      deepBed: new THREE.Color(palette.deepBed),
    };
  }

  colorAt(x: number, z: number, h: number, slope: number, out: THREE.Color): THREE.Color {
    const { field, s, c } = this;
    const jitter = field.detailAt(x, z, s.jitterFreq);
    const moisture = field.moistureField(x, z);
    const snowLine = s.snowLine + 16 * field.detailAt(x, z, s.snowJitterFreq);

    if (h < s.waterLevel - 1.5) {
      // 湖床 / 水塘床：随深度变暗
      const t = smoothstep(-2, -26, h);
      out.copy(c.shallowBed).lerp(c.deepBed, t);
      return out;
    }

    // 海拔基色
    if (h < s.beachHeight) {
      out.copy(c.sandLo).lerp(c.sandHi, 0.5 + 0.5 * jitter);
    } else {
      const lush = clamp(moisture * 1.15 - h / s.lushHeightDivisor + 0.18 * jitter, 0, 1);
      out.copy(c.grassDry).lerp(c.grassLush, lush);
      // 密林之下更暗
      const forest = smoothstep(0.08, 0.5, field.forestField(x, z));
      out.lerp(c.forestFloor, forest * s.forestDarkening);
      // 沙滩过渡
      const beach = 1 - smoothstep(s.beachHeight, s.beachBlendTop, h);
      if (beach > 0) out.lerp(_tmpA.copy(c.sandHi), beach);
    }

    // 陡坡转岩石
    const rockT = smoothstep(0.32, 0.55, slope + 0.06 * jitter);
    if (rockT > 0) {
      _tmpB.copy(c.rockA).lerp(c.rockB, 0.5 + 0.5 * jitter);
      if (h > snowLine * 0.7) _tmpB.lerp(c.rockCold, 0.45);
      out.lerp(_tmpB, rockT);
    }

    // 雪顶，但不在陡壁上
    const snowT = smoothstep(snowLine, snowLine + 26, h) * (1 - smoothstep(0.5, 0.72, slope));
    if (snowT > 0) out.lerp(c.snow, snowT);

    return out;
  }
}

export interface WorldTerrainMeshOptions {
  /** 地面边长（米） */
  size: number;
  /** 网格细分数 */
  segments: number;
  /** 雪覆盖 uniform（注入 onBeforeCompile）；省略则不注入 */
  snowUniform?: ShaderUniform;
  /** 雪覆盖着色生效的世界 Y 范围（默认 worldshowcase 的 1..9） */
  snowWorldY?: { start: number; end: number };
}

/**
 * 用高度场 + 生物群系着色器构建地形网格（顶点色、flat shading）。
 * 调用方负责设置 mesh.position.y（高度场局部 0 对应的世界高度）。
 */
export function buildWorldTerrainMesh(
  field: Heightfield,
  painter: BiomePainter,
  options: WorldTerrainMeshOptions
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
  const geo = new THREE.PlaneGeometry(options.size, options.size, options.segments, options.segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = field.heightAt(x, z);
    pos.setY(i, h);
    painter.colorAt(x, z, h, field.slopeAt(x, z), col);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1.0,
    metalness: 0.0,
  });
  if (options.snowUniform) {
    injectSnowCover(mat, options.snowUniform, 'worldscape-terrain', options.snowWorldY);
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'worldscapeTerrain';
  return mesh;
}
