/**
 * worldscape/heightfield — 解析式高度场。
 * 从 worldshowcase (src/world/terrain.js) 的 heightAt 移植并参数化：
 * 域扭曲、谷底 fbm、带掩码的山脊带、湖盆、边缘环形峰墙，
 * 所有常量收敛为可复用的预设对象。同一个高度函数同时驱动网格、
 * 水深烘焙与所有植被放置查询，保证世界各处自洽。
 */
import * as THREE from 'three';
import { Noise2D, smoothstep } from './noise';

/** 湖盆参数（同时压制湖区周边的山脊带） */
export interface HeightfieldLake {
  x: number;
  z: number;
  /** 盆地深度（米） */
  depth: number;
  /** 高斯盆地标准差（米） */
  sigma: number;
  /** 山脊带在湖心 inner 半径内完全压制，到 outer 恢复 */
  mountainClearInner: number;
  mountainClearOuter: number;
}

/** 边缘环形峰墙：世界永远不露出"尽头" */
export interface HeightfieldRim {
  start: number;
  end: number;
  base: number;
  ridgeAmp: number;
}

export interface HeightfieldPreset {
  seed: number;
  /** 基础噪声频率（1/米）。worldshowcase 原值 0.00115（1800m 世界），按比例缩放 */
  frequency: number;
  /** 域扭曲强度（worldshowcase: 0.34） */
  domainWarp: number;
  /** 谷底起伏振幅（worldshowcase: 26） */
  valleyAmp: number;
  valleyOctaves: number;
  /** 谷底整体抬升（米）：让谷地浮在水面之上，只留盆地与最深洼地成湖 */
  baseOffset?: number;
  /** 山脊带振幅（worldshowcase: 215）；0 = 无山 */
  mountainAmp: number;
  /** 山脊带掩码 smoothstep 阈值（worldshowcase: 0.04 / 0.62） */
  mountainMaskLo: number;
  mountainMaskHi: number;
  /** 可选：以世界原点为圆心的径向门控，让山只在战场外缘隆起（保证中心空域可飞） */
  mountainGateInner?: number;
  mountainGateOuter?: number;
  /** 山脊噪声频率倍数（worldshowcase: 1.7） */
  ridgedFrequency: number;
  /** 细粒度起伏振幅与频率倍数（worldshowcase: 5 / 6） */
  detailAmp: number;
  detailFrequency: number;
  lake?: HeightfieldLake;
  rim?: HeightfieldRim;
  /** 软性下限：低于该值的地形被柔和压缩（防止湖床穿透世界底板） */
  minHeight?: number;
  /** 最终高度乘数 */
  heightScale: number;
}

/** worldshowcase 原始 1800m 世界 → AirSupreme 4000m 地面（XZ ×2.2），高度保持原振幅 */
const XZ_SCALE = 2.2;

/** 第 1 关「湖畔晨曦」：worldshowcase 冰川湖谷的直接移植（中央湖盆 + 边缘峰墙） */
export const LAKESIDE_VALLEY_PRESET: HeightfieldPreset = {
  seed: 20260612,
  frequency: 0.00115 / XZ_SCALE,
  domainWarp: 0.34,
  valleyAmp: 26,
  valleyOctaves: 4,
  mountainAmp: 200,
  mountainMaskLo: 0.04,
  mountainMaskHi: 0.62,
  mountainGateInner: 850,
  mountainGateOuter: 1450,
  ridgedFrequency: 1.7,
  detailAmp: 5,
  detailFrequency: 6,
  lake: {
    x: 0,
    z: 0,
    depth: 46,
    sigma: 506,
    mountainClearInner: 400,
    mountainClearOuter: 930,
  },
  rim: { start: 1450, end: 2000, base: 70, ridgeAmp: 150 },
  minHeight: -40,
  heightScale: 1,
};

/** 第 2 关「沙漠风暴」：低频 fbm 沙海，无山脊带，仅远缘略微隆起 */
export const DESERT_DUNE_PRESET: HeightfieldPreset = {
  seed: 20260214,
  frequency: 0.00038,
  domainWarp: 0.42,
  valleyAmp: 24,
  valleyOctaves: 3,
  mountainAmp: 0,
  mountainMaskLo: 0,
  mountainMaskHi: 1,
  ridgedFrequency: 1.7,
  detailAmp: 3.5,
  detailFrequency: 5,
  rim: { start: 1500, end: 2050, base: 18, ridgeAmp: 30 },
  minHeight: -26,
  heightScale: 1,
};

/** 第 3 关「雪山之巅」：山脊多重分形主导，谷地保留飞行空间，高耸边缘峰墙 */
export const ALPINE_RIDGE_PRESET: HeightfieldPreset = {
  seed: 20260613,
  frequency: 0.00062,
  domainWarp: 0.34,
  valleyAmp: 24,
  valleyOctaves: 4,
  baseOffset: 20,
  mountainAmp: 235,
  mountainMaskLo: -0.08,
  mountainMaskHi: 0.42,
  mountainGateInner: 520,
  mountainGateOuter: 1180,
  ridgedFrequency: 1.7,
  detailAmp: 5,
  detailFrequency: 6,
  lake: {
    x: 380,
    z: -290,
    depth: 24,
    sigma: 190,
    mountainClearInner: 160,
    mountainClearOuter: 430,
  },
  rim: { start: 1350, end: 1950, base: 90, ridgeAmp: 190 },
  minHeight: -34,
  heightScale: 1.05,
};

/** 解析式高度场：heightAt / normalAt / slopeAt + 植被噪声场 */
export class Heightfield {
  readonly preset: HeightfieldPreset;
  private readonly noise: Noise2D;
  private readonly detailNoise: Noise2D;
  /** 森林密度场频率（worldshowcase 0.0042 相对 0.00115 的比例） */
  private readonly forestFreq: number;
  /** 湿度场频率（worldshowcase 0.0021 相对 0.00115 的比例） */
  private readonly moistureFreq: number;

  constructor(preset: HeightfieldPreset) {
    this.preset = preset;
    this.noise = new Noise2D(preset.seed);
    this.detailNoise = new Noise2D(preset.seed + 77);
    this.forestFreq = preset.frequency * (0.0042 / 0.00115);
    this.moistureFreq = preset.frequency * (0.0021 / 0.00115);
  }

  heightAt(x: number, z: number): number {
    const p = this.preset;
    const nx = x * p.frequency;
    const nz = z * p.frequency;

    // 域扭曲：避免山脊线读出噪声网格感
    const wx = nx + p.domainWarp * this.noise.fbm(nx * 0.9 + 7.3, nz * 0.9 - 2.6, 3);
    const wz = nz + p.domainWarp * this.noise.fbm(nx * 0.9 - 4.1, nz * 0.9 + 5.9, 3);

    // 起伏的谷底
    let h = (p.baseOffset ?? 0) + p.valleyAmp * this.noise.fbm(wx, wz, p.valleyOctaves);

    // 山脊带：掩码让山成簇而非铺满
    if (p.mountainAmp > 0) {
      let mMask = smoothstep(
        p.mountainMaskLo,
        p.mountainMaskHi,
        this.noise.fbm(wx * 0.55 + 3.7, wz * 0.55 + 9.2, 3)
      );
      if (p.lake) {
        const dl = Math.hypot(x - p.lake.x, z - p.lake.z);
        mMask *= smoothstep(p.lake.mountainClearInner, p.lake.mountainClearOuter, dl);
      }
      if (p.mountainGateInner !== undefined && p.mountainGateOuter !== undefined) {
        mMask *= smoothstep(p.mountainGateInner, p.mountainGateOuter, Math.hypot(x, z));
      }
      if (mMask > 0) {
        const ridge = this.noise.ridged(wx * p.ridgedFrequency, wz * p.ridgedFrequency, 4);
        h += p.mountainAmp * mMask * ridge * ridge;
      }
    }

    // 细粒度
    h += p.detailAmp * this.detailNoise.fbm(wx * p.detailFrequency, wz * p.detailFrequency, 2);

    // 冰川湖盆
    if (p.lake) {
      const dl = Math.hypot(x - p.lake.x, z - p.lake.z);
      h -= p.lake.depth * Math.exp(-(dl * dl) / (2 * p.lake.sigma * p.lake.sigma));
    }

    // 边缘环形峰墙封住世界
    if (p.rim) {
      const r = Math.hypot(x, z);
      const rimT = smoothstep(p.rim.start, p.rim.end, r);
      if (rimT > 0) {
        h += rimT * (p.rim.base + p.rim.ridgeAmp * this.noise.ridged(wx * 1.3 + 11, wz * 1.3 - 7, 3));
      }
    }

    h *= p.heightScale;

    // 软性下限：柔和压缩而非硬截断
    if (p.minHeight !== undefined && h < p.minHeight) {
      h = p.minHeight - Math.tanh((p.minHeight - h) / 12) * 6;
    }

    return h;
  }

  normalAt(x: number, z: number, eps = 1.5): THREE.Vector3 {
    const hl = this.heightAt(x - eps, z);
    const hr = this.heightAt(x + eps, z);
    const hd = this.heightAt(x, z - eps);
    const hu = this.heightAt(x, z + eps);
    return new THREE.Vector3(hl - hr, 2 * eps, hd - hu).normalize();
  }

  /** 0 = 平地 … ~1 = 悬崖 */
  slopeAt(x: number, z: number): number {
    return 1 - this.normalAt(x, z).y;
  }

  /** 森林密度场（约 [-1,1]），植被放置与林下地色共用 */
  forestField(x: number, z: number): number {
    return this.noise.fbm(x * this.forestFreq + 31, z * this.forestFreq - 17, 3);
  }

  /** 湿度场（[0,1]），决定草色枯荣 */
  moistureField(x: number, z: number): number {
    return 0.5 + 0.5 * this.noise.fbm(x * this.moistureFreq - 9, z * this.moistureFreq + 23, 3);
  }

  /** 细节噪声直采（生物群系抖动用），freq 为 1/米 */
  detailAt(x: number, z: number, freq: number): number {
    return this.detailNoise.noise(x * freq, z * freq);
  }
}
