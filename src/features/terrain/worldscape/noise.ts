/**
 * worldscape/noise — 种子化 2D simplex 噪声 + 分形辅助函数。
 * 算法从参考项目 worldshowcase (src/core/noise.js) 原样移植：
 * 同一种子永远生成同一片山谷，保证地形、植被放置与生物群系着色全部一致。
 */

/** 确定性 32 位 PRNG（mulberry32），返回 [0,1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** 种子化 2D simplex 噪声，带 fbm 与 ridged multifractal 分形 */
export class Noise2D {
  private readonly perm: Uint8Array;

  constructor(seed = 1) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** 单倍频程，范围约 [-1, 1] */
  noise(xin: number, yin: number): number {
    const perm = this.perm;
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const g = GRAD[perm[ii + perm[jj]] & 7];
      t0 *= t0;
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7];
      t1 *= t1;
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7];
      t2 *= t2;
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  /** 分形布朗运动，归一化到约 [-1, 1]；每倍频程旋转采样域以打破轴向纹理 */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2.02, gain = 0.5): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x, y);
      norm += amp;
      amp *= gain;
      const nx = (x * 0.9838 - y * 0.1794) * lacunarity;
      const ny = (y * 0.9838 + x * 0.1794) * lacunarity;
      x = nx;
      y = ny;
    }
    return sum / norm;
  }

  /** 山脊多重分形，范围约 [0, 1] —— 锐利的山脊线 */
  ridged(x: number, y: number, octaves = 4, lacunarity = 2.1, gain = 0.5): number {
    let sum = 0;
    let amp = 0.55;
    let prev = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      let n = 1 - Math.abs(this.noise(x, y));
      n *= n;
      sum += n * amp * prev;
      norm += amp;
      prev = n;
      amp *= gain;
      x *= lacunarity;
      y *= lacunarity;
    }
    return Math.min(1, sum / (norm * 0.72));
  }
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
