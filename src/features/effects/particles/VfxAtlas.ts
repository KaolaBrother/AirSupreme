import * as THREE from 'three';

/**
 * 程序化粒子图集（4×4 格，每格 128px）。
 * 纯 JS 生成 DataTexture：不依赖 DOM/Canvas，单元测试环境同样可用。
 * RGB = 亮度细节（烟团明暗、火舌纹理），A = 形状遮罩（直通 alpha）。
 */
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;
export const ATLAS_CELL_SIZE = 128;

export const VfxCell = {
  /** 柔光球（闪光、辉光、余烬） */
  GLOW: 0,
  /** 白热星芒（枪口/爆心高光） */
  FLARE: 1,
  /** 火花（沿速度拉伸成曳光） */
  SPARK: 2,
  /** 柔环（冲击波、水沫环） */
  RING: 3,
  SMOKE_A: 4,
  SMOKE_B: 5,
  SMOKE_C: 6,
  SMOKE_D: 7,
  FIRE_A: 8,
  FIRE_B: 9,
  /** 电弧（EMP） */
  ARC_A: 10,
  ARC_B: 11,
  /** 枪口焰花瓣（沿射向拉伸） */
  PETAL: 12,
  /** 水花飞沫簇 */
  SPRAY: 13,
  /** 细锐环（EMP 前沿、拾取） */
  THIN_RING: 14,
  /** 四芒星闪（拾取） */
  STAR: 15,
} as const;

export type VfxCellId = (typeof VfxCell)[keyof typeof VfxCell];

export const SMOKE_CELLS: readonly number[] = [
  VfxCell.SMOKE_A,
  VfxCell.SMOKE_B,
  VfxCell.SMOKE_C,
  VfxCell.SMOKE_D,
];
export const FIRE_CELLS: readonly number[] = [VfxCell.FIRE_A, VfxCell.FIRE_B];
export const ARC_CELLS: readonly number[] = [VfxCell.ARC_A, VfxCell.ARC_B];

type CellPainter = (u: number, v: number, out: Float32Array) => void;

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** 确定性伪随机序列（图集生成专用） */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const paintGlow: CellPainter = (u, v, out) => {
  const r2 = u * u + v * v;
  out[0] = out[1] = out[2] = 1;
  out[3] = Math.exp(-r2 * 4.2) * (1 - smoothstep(0.82, 1, Math.sqrt(r2)));
};

const paintFlare: CellPainter = (u, v, out) => {
  const r2 = u * u + v * v;
  const r = Math.sqrt(r2);
  const angle = Math.atan2(v, u);
  const core = Math.exp(-r2 * 22);
  const halo = Math.exp(-r2 * 3.6) * 0.32;
  const raysA = Math.pow(Math.abs(Math.cos(angle * 3)), 26) * Math.exp(-r * 2.4) * 0.6;
  const raysB = Math.pow(Math.abs(Math.cos(angle * 2 + 0.4)), 40) * Math.exp(-r * 3.2) * 0.32;
  out[0] = out[1] = out[2] = 1;
  out[3] = clamp01(core + halo + raysA + raysB) * (1 - smoothstep(0.86, 1, r));
};

const paintSpark: CellPainter = (u, v, out) => {
  const shape = Math.exp(-(u * u * 2.4 + v * v * 9));
  const core = Math.exp(-(u * u * 9 + v * v * 30));
  out[0] = out[1] = out[2] = 1;
  out[3] = clamp01(shape * 0.75 + core);
};

function ringPainter(radius: number, width: number, glow: number): CellPainter {
  return (u, v, out) => {
    const r = Math.sqrt(u * u + v * v);
    const d = (r - radius) / width;
    const band = Math.exp(-d * d);
    const soft = Math.exp(-Math.pow((r - radius) / (width * 3.2), 2)) * glow;
    out[0] = out[1] = out[2] = 1;
    out[3] = clamp01(band + soft) * (1 - smoothstep(0.92, 1, r));
  };
}

function smokePainter(seed: number): CellPainter {
  const random = seededRandom(seed * 7919);
  // 预置若干“棉团”凸起，打破圆形轮廓
  const lumps: Array<[number, number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = random() * Math.PI * 2;
    const dist = 0.18 + random() * 0.32;
    lumps.push([Math.cos(angle) * dist, Math.sin(angle) * dist, 0.16 + random() * 0.16]);
  }
  return (u, v, out) => {
    const r = Math.sqrt(u * u + v * v);
    const n = fbm(u * 2.1 + seed * 3.1, v * 2.1 - seed * 1.7, seed, 3);
    const detail = fbm(u * 5.3 + seed, v * 5.3 + seed * 0.5, seed + 5, 3);
    let lump = 0;
    for (const [lx, ly, lr] of lumps) {
      const dx = u - lx;
      const dy = v - ly;
      lump = Math.max(lump, Math.exp(-(dx * dx + dy * dy) / (lr * lr)));
    }
    const distorted = r + (n - 0.5) * 0.6 - lump * 0.18;
    const body = 1 - smoothstep(0.28, 0.94, distorted);
    const density = clamp01(body * (0.5 + 0.7 * detail) + lump * 0.12 * body);
    const lum = 0.66 + 0.34 * clamp01(detail * 1.2 - 0.1 + lump * 0.2);
    out[0] = out[1] = out[2] = lum;
    out[3] = density * (1 - smoothstep(0.9, 1, r));
  };
}

function firePainter(seed: number): CellPainter {
  return (u, v, out) => {
    const r = Math.sqrt(u * u + v * v);
    const n = fbm(u * 2.8 + seed, v * 2.8 - seed * 0.6, seed, 4);
    const streak = fbm(u * 6.5 - seed, v * 6.5 + seed, seed + 9, 2);
    const distorted = r + (n - 0.5) * 0.85;
    const body = 1 - smoothstep(0.12, 0.88, distorted);
    const core = 1 - smoothstep(0, 0.55, distorted);
    out[0] = out[1] = out[2] = clamp01((0.62 + 0.38 * core) * (0.78 + 0.32 * streak));
    out[3] = clamp01(body * (0.75 + 0.35 * streak)) * (1 - smoothstep(0.9, 1, r));
  };
}

function arcPainter(seed: number): CellPainter {
  const random = seededRandom(seed * 104729);
  // 中点位移生成锯齿电弧（主干 + 一条分叉）
  const points: Array<[number, number]> = [
    [-0.92, 0],
    [0.92, 0],
  ];
  let amplitude = 0.42;
  for (let level = 0; level < 5; level++) {
    for (let i = points.length - 1; i > 0; i--) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const mid: [number, number] = [(ax + bx) / 2, (ay + by) / 2 + (random() - 0.5) * amplitude];
      points.splice(i, 0, mid);
    }
    amplitude *= 0.55;
  }
  const segments: Array<[number, number, number, number, number]> = [];
  for (let i = 1; i < points.length; i++) {
    segments.push([points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], 1]);
  }
  const branchStart = points[Math.floor(points.length * 0.4)];
  let bx = branchStart[0];
  let by = branchStart[1];
  for (let i = 0; i < 8; i++) {
    const nx = bx + 0.07 + random() * 0.05;
    const ny = by + (random() - 0.25) * 0.12;
    segments.push([bx, by, nx, ny, 0.55]);
    bx = nx;
    by = ny;
  }
  // 逐段“盖章”到预计算距离图，避免逐像素遍历全部线段
  const size = ATLAS_CELL_SIZE;
  const intensity = new Float32Array(size * size);
  const reach = 0.3;
  for (const [ax, ay, cx, cy, w] of segments) {
    const minX = Math.max(0, Math.floor(((Math.min(ax, cx) - reach + 1) * size) / 2));
    const maxX = Math.min(size - 1, Math.ceil(((Math.max(ax, cx) + reach + 1) * size) / 2));
    const minY = Math.max(0, Math.floor(((Math.min(ay, cy) - reach + 1) * size) / 2));
    const maxY = Math.min(size - 1, Math.ceil(((Math.max(ay, cy) + reach + 1) * size) / 2));
    const dx = cx - ax;
    const dy = cy - ay;
    const len2 = dx * dx + dy * dy || 1e-6;
    for (let y = minY; y <= maxY; y++) {
      const v = ((y + 0.5) * 2) / size - 1;
      for (let x = minX; x <= maxX; x++) {
        const u = ((x + 0.5) * 2) / size - 1;
        const t = Math.min(1, Math.max(0, ((u - ax) * dx + (v - ay) * dy) / len2));
        const px = ax + dx * t - u;
        const py = ay + dy * t - v;
        const dist = Math.sqrt(px * px + py * py) / w;
        const coreLine = Math.exp(-Math.pow(dist / 0.022, 2));
        const glow = Math.exp(-Math.pow(dist / 0.1, 2)) * 0.42;
        const value = (coreLine + glow) * w;
        const index = y * size + x;
        if (value > intensity[index]) intensity[index] = value;
      }
    }
  }
  return (u, v, out) => {
    const x = Math.min(size - 1, Math.max(0, Math.floor(((u + 1) * size) / 2)));
    const y = Math.min(size - 1, Math.max(0, Math.floor(((v + 1) * size) / 2)));
    const taper = 1 - smoothstep(0.78, 0.98, Math.abs(u));
    out[0] = out[1] = out[2] = 1;
    out[3] = clamp01(intensity[y * size + x]) * taper;
  };
}

const paintPetal: CellPainter = (u, v, out) => {
  // 沿 +x 方向的泪滴形焰瓣：根部最亮，尖端收束
  const t = (u + 1) * 0.5;
  const width = 0.5 * Math.sin(Math.PI * Math.pow(Math.max(t, 1e-3), 0.62)) + 0.02;
  const across = v / width;
  const shape =
    Math.exp(-across * across * 2.6) * smoothstep(0, 0.1, t) * (1 - smoothstep(0.82, 1, t));
  const hot = Math.exp(-Math.pow((t - 0.18) / 0.22, 2)) * Math.exp(-across * across * 6);
  out[0] = out[1] = out[2] = 1;
  out[3] = clamp01(shape * 0.85 + hot * 0.6);
};

function sprayPainter(seed: number): CellPainter {
  const random = seededRandom(seed * 31337);
  const drops: Array<[number, number, number]> = [];
  for (let i = 0; i < 28; i++) {
    const angle = random() * Math.PI * 2;
    const dist = Math.pow(random(), 0.7) * 0.72;
    drops.push([Math.cos(angle) * dist, Math.sin(angle) * dist, 0.025 + random() * 0.05]);
  }
  const size = ATLAS_CELL_SIZE;
  const droplets = new Float32Array(size * size);
  for (const [dx, dy, dr] of drops) {
    const reach = dr * 3;
    const minX = Math.max(0, Math.floor(((dx - reach + 1) * size) / 2));
    const maxX = Math.min(size - 1, Math.ceil(((dx + reach + 1) * size) / 2));
    const minY = Math.max(0, Math.floor(((dy - reach + 1) * size) / 2));
    const maxY = Math.min(size - 1, Math.ceil(((dy + reach + 1) * size) / 2));
    for (let y = minY; y <= maxY; y++) {
      const v = ((y + 0.5) * 2) / size - 1 - dy;
      for (let x = minX; x <= maxX; x++) {
        const u = ((x + 0.5) * 2) / size - 1 - dx;
        const value = Math.exp(-(u * u + v * v) / (dr * dr));
        const index = y * size + x;
        if (value > droplets[index]) droplets[index] = value;
      }
    }
  }
  return (u, v, out) => {
    const x = Math.min(size - 1, Math.max(0, Math.floor(((u + 1) * size) / 2)));
    const y = Math.min(size - 1, Math.max(0, Math.floor(((v + 1) * size) / 2)));
    const r2 = u * u + v * v;
    const mist = Math.exp(-r2 * 3.2) * 0.28;
    out[0] = out[1] = out[2] = 1;
    out[3] = clamp01(droplets[y * size + x] + mist) * (1 - smoothstep(0.85, 1, Math.sqrt(r2)));
  };
}

const paintStar: CellPainter = (u, v, out) => {
  const r2 = u * u + v * v;
  const core = Math.exp(-r2 * 32);
  const crossA = Math.exp(-Math.abs(u) * 4.2) * Math.exp(-v * v * 320);
  const crossB = Math.exp(-Math.abs(v) * 4.2) * Math.exp(-u * u * 320);
  const glow = Math.exp(-r2 * 5) * 0.26;
  out[0] = out[1] = out[2] = 1;
  out[3] =
    clamp01(core + (crossA + crossB) * 0.95 + glow) * (1 - smoothstep(0.9, 1, Math.sqrt(r2)));
};

function buildPainters(): CellPainter[] {
  const painters: CellPainter[] = [];
  painters[VfxCell.GLOW] = paintGlow;
  painters[VfxCell.FLARE] = paintFlare;
  painters[VfxCell.SPARK] = paintSpark;
  painters[VfxCell.RING] = ringPainter(0.7, 0.1, 0.18);
  painters[VfxCell.SMOKE_A] = smokePainter(11);
  painters[VfxCell.SMOKE_B] = smokePainter(23);
  painters[VfxCell.SMOKE_C] = smokePainter(37);
  painters[VfxCell.SMOKE_D] = smokePainter(53);
  painters[VfxCell.FIRE_A] = firePainter(61);
  painters[VfxCell.FIRE_B] = firePainter(79);
  painters[VfxCell.ARC_A] = arcPainter(3);
  painters[VfxCell.ARC_B] = arcPainter(8);
  painters[VfxCell.PETAL] = paintPetal;
  painters[VfxCell.SPRAY] = sprayPainter(5);
  painters[VfxCell.THIN_RING] = ringPainter(0.8, 0.045, 0.32);
  painters[VfxCell.STAR] = paintStar;
  return painters;
}

/**
 * 生成图集像素（RGBA8）。导出以便测试/离线检查。
 */
export function generateVfxAtlasPixels(): Uint8Array<ArrayBuffer> {
  const cellSize = ATLAS_CELL_SIZE;
  const width = cellSize * ATLAS_COLS;
  const height = cellSize * ATLAS_ROWS;
  const data = new Uint8Array(width * height * 4);
  const painters = buildPainters();
  const sample = new Float32Array(4);
  const inv = 2 / cellSize;

  for (let cell = 0; cell < ATLAS_COLS * ATLAS_ROWS; cell++) {
    const painter = painters[cell];
    if (!painter) continue;
    const originX = (cell % ATLAS_COLS) * cellSize;
    const originY = Math.floor(cell / ATLAS_COLS) * cellSize;
    for (let y = 0; y < cellSize; y++) {
      const v = (y + 0.5) * inv - 1;
      for (let x = 0; x < cellSize; x++) {
        const u = (x + 0.5) * inv - 1;
        painter(u, v, sample);
        // 每格边缘强制透明，避免 mipmap 串格
        const edge = 1 - smoothstep(0.93, 1, Math.max(Math.abs(u), Math.abs(v)));
        const index = ((originY + y) * width + originX + x) * 4;
        data[index] = Math.round(clamp01(sample[0]) * 255);
        data[index + 1] = Math.round(clamp01(sample[1]) * 255);
        data[index + 2] = Math.round(clamp01(sample[2]) * 255);
        data[index + 3] = Math.round(clamp01(sample[3] * edge) * 255);
      }
    }
  }
  return data;
}

let sharedAtlas: THREE.DataTexture | null = null;

/**
 * 共享粒子图集（懒构建一次，全局复用；标记 sharedResource，消费者不得 dispose）
 */
export function getVfxAtlas(): THREE.DataTexture {
  if (!sharedAtlas) {
    const width = ATLAS_CELL_SIZE * ATLAS_COLS;
    const height = ATLAS_CELL_SIZE * ATLAS_ROWS;
    const texture = new THREE.DataTexture(
      generateVfxAtlasPixels(),
      width,
      height,
      THREE.RGBAFormat
    );
    texture.colorSpace = THREE.NoColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    texture.name = 'vfx-particle-atlas';
    texture.userData.sharedResource = true;
    sharedAtlas = texture;
  }
  return sharedAtlas;
}
