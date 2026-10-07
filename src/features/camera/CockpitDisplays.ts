import * as THREE from 'three';

/**
 * 座舱多功能显示器（MFD）贴图集：一张 512×256 画布绘制三块 MFD + 正前方控制面板（UFC）。
 * 静态符号画在贴图上，动态元素（雷达扫描线、地平线、油门条）由 CockpitModel 用网格驱动。
 * 无 document / 2D 上下文（测试环境）时返回 null，调用方使用纯色屏幕兜底。
 */

export interface DisplayRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RegionUv {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export const DISPLAY_ATLAS_WIDTH = 512;
export const DISPLAY_ATLAS_HEIGHT = 256;

/** 各显示区在画布中的像素区域（画布 y 向下） */
export const DISPLAY_REGIONS = {
  radar: { x: 0, y: 0, w: 168, h: 168 },
  attitude: { x: 172, y: 0, w: 168, h: 168 },
  stores: { x: 344, y: 0, w: 168, h: 168 },
  ufc: { x: 0, y: 180, w: 252, h: 60 },
} as const satisfies Record<string, DisplayRegion>;

const PHOSPHOR = '#5dff9e';
const PHOSPHOR_DIM = 'rgba(93, 255, 158, 0.38)';
const AMBER = '#ffb347';
const CYAN = '#8fe4ff';
const ALLY = '#f4d35e';
const BACKGROUND = '#03170d';
const FONT = 'bold 12px monospace';
const FONT_SMALL = 'bold 10px monospace';

/** 区域 → 纹理 UV（CanvasTexture 默认 flipY：画布顶部对应 v = 1） */
export function getRegionUv(region: DisplayRegion): RegionUv {
  return {
    u0: region.x / DISPLAY_ATLAS_WIDTH,
    u1: (region.x + region.w) / DISPLAY_ATLAS_WIDTH,
    v0: 1 - (region.y + region.h) / DISPLAY_ATLAS_HEIGHT,
    v1: 1 - region.y / DISPLAY_ATLAS_HEIGHT,
  };
}

/** 把 PlaneGeometry 的 0..1 UV 重映射到指定区域 */
export function remapPlaneUv(geometry: THREE.BufferGeometry, uv: RegionUv): void {
  const attribute = geometry.getAttribute('uv');
  if (!attribute) {
    return;
  }
  for (let i = 0; i < attribute.count; i += 1) {
    const u = attribute.getX(i);
    const v = attribute.getY(i);
    attribute.setXY(i, uv.u0 + u * (uv.u1 - uv.u0), uv.v0 + v * (uv.v1 - uv.v0));
  }
  attribute.needsUpdate = true;
}

function drawScreenFrame(ctx: CanvasRenderingContext2D, region: DisplayRegion): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(region.x, region.y, region.w, region.h);
  // 轻微的中心辉光，模拟荧光屏
  const glow = ctx.createRadialGradient(
    region.x + region.w / 2,
    region.y + region.h / 2,
    4,
    region.x + region.w / 2,
    region.y + region.h / 2,
    region.w * 0.7
  );
  glow.addColorStop(0, 'rgba(40, 120, 80, 0.22)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(region.x, region.y, region.w, region.h);
  ctx.strokeStyle = 'rgba(93, 255, 158, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(region.x + 1, region.y + 1, region.w - 2, region.h - 2);
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = PHOSPHOR,
  font: string = FONT
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** 左屏：B 型雷达显示（扇形距离环、方位线、目标点） */
function drawRadarPage(ctx: CanvasRenderingContext2D, region: DisplayRegion): void {
  drawScreenFrame(ctx, region);
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h - 14;
  const start = -Math.PI / 2 - 0.87;
  const end = -Math.PI / 2 + 0.87;

  ctx.strokeStyle = PHOSPHOR_DIM;
  ctx.lineWidth = 1.5;
  for (const radius of [34, 68, 102, 136]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();
  }
  for (const angle of [-0.87, -0.43, 0, 0.43, 0.87]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * 140, cy - Math.cos(angle) * 140);
    ctx.stroke();
  }

  // 目标：敌机（琥珀方块）与友军（金色圆点）
  ctx.fillStyle = AMBER;
  for (const [angle, range] of [
    [-0.32, 96],
    [0.18, 118],
    [0.5, 74],
  ] as const) {
    ctx.fillRect(cx + Math.sin(angle) * range - 4, cy - Math.cos(angle) * range - 4, 8, 8);
  }
  ctx.fillStyle = ALLY;
  ctx.beginPath();
  ctx.arc(cx - 26, cy - 46, 4, 0, Math.PI * 2);
  ctx.fill();

  // 本机标记
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 6);
  ctx.lineTo(cx, cy - 4);
  ctx.lineTo(cx + 7, cy + 6);
  ctx.stroke();

  label(ctx, 'RDR', region.x + 8, region.y + 16);
  label(ctx, 'TWS', region.x + region.w - 36, region.y + 16, CYAN);
  label(ctx, '40', region.x + 8, region.y + 34, PHOSPHOR_DIM, FONT_SMALL);
}

/** 中屏：姿态/航向页（坡度刻度、飞机基准符号、航向带） */
function drawAttitudePage(ctx: CanvasRenderingContext2D, region: DisplayRegion): void {
  drawScreenFrame(ctx, region);
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;

  // 坡度刻度弧
  ctx.strokeStyle = PHOSPHOR_DIM;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 64, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05);
  ctx.stroke();
  for (const degrees of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const angle = (degrees * Math.PI) / 180 - Math.PI / 2;
    const inner = degrees % 30 === 0 ? 56 : 60;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * 64, cy + Math.sin(angle) * 64);
    ctx.stroke();
  }

  // 飞机基准符号（固定 W 形）
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.lineTo(cx - 6, cy + 7);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 6, cy + 7);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx + 30, cy);
  ctx.stroke();

  // 航向带
  ctx.strokeStyle = PHOSPHOR_DIM;
  ctx.lineWidth = 1.5;
  const tapeY = region.y + region.h - 26;
  ctx.beginPath();
  ctx.moveTo(region.x + 18, tapeY);
  ctx.lineTo(region.x + region.w - 18, tapeY);
  ctx.stroke();
  const headings = ['33', '34', 'N', '01', '02'];
  headings.forEach((text, index) => {
    const x = region.x + 22 + index * 31;
    ctx.beginPath();
    ctx.moveTo(x + 6, tapeY);
    ctx.lineTo(x + 6, tapeY - 6);
    ctx.stroke();
    label(ctx, text, x, tapeY + 15, text === 'N' ? CYAN : PHOSPHOR, FONT_SMALL);
  });

  label(ctx, 'ADI', region.x + 8, region.y + 16);
  label(ctx, 'NAV', region.x + region.w - 36, region.y + 16, CYAN);
}

/** 右屏：外挂/发动机页（俯视机身轮廓、挂点、油门条外框） */
function drawStoresPage(ctx: CanvasRenderingContext2D, region: DisplayRegion): void {
  drawScreenFrame(ctx, region);
  const cx = region.x + 64;
  const cy = region.y + 92;

  // 俯视机身轮廓
  ctx.strokeStyle = PHOSPHOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 52);
  ctx.lineTo(cx + 8, cy - 24);
  ctx.lineTo(cx + 46, cy + 10);
  ctx.lineTo(cx + 46, cy + 18);
  ctx.lineTo(cx + 10, cy + 16);
  ctx.lineTo(cx + 20, cy + 40);
  ctx.lineTo(cx + 6, cy + 42);
  ctx.lineTo(cx, cy + 36);
  ctx.lineTo(cx - 6, cy + 42);
  ctx.lineTo(cx - 20, cy + 40);
  ctx.lineTo(cx - 10, cy + 16);
  ctx.lineTo(cx - 46, cy + 18);
  ctx.lineTo(cx - 46, cy + 10);
  ctx.lineTo(cx - 8, cy - 24);
  ctx.closePath();
  ctx.stroke();

  // 挂点
  ctx.fillStyle = CYAN;
  for (const offset of [-38, -24, 24, 38]) {
    ctx.fillRect(cx + offset - 3, cy + 6, 6, 10);
  }
  ctx.fillStyle = AMBER;
  ctx.fillRect(cx - 3, cy - 6, 6, 14);

  // 油门条外框（条本身由网格驱动）
  const barX = region.x + region.w - 34;
  ctx.strokeStyle = PHOSPHOR_DIM;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX, region.y + 34, 18, 112);
  for (let i = 0; i <= 4; i += 1) {
    const y = region.y + 34 + (112 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(barX - 6, y);
    ctx.lineTo(barX, y);
    ctx.stroke();
  }
  label(ctx, 'AB', barX - 2, region.y + 28, AMBER, FONT_SMALL);

  label(ctx, 'SMS', region.x + 8, region.y + 16);
  label(ctx, 'FUEL 74', region.x + 8, region.y + region.h - 10, PHOSPHOR_DIM, FONT_SMALL);
}

/** 正前方控制面板：单行数字 */
function drawUfcPage(ctx: CanvasRenderingContext2D, region: DisplayRegion): void {
  ctx.fillStyle = '#020c07';
  ctx.fillRect(region.x, region.y, region.w, region.h);
  label(ctx, 'COM1 245.0', region.x + 10, region.y + 26, PHOSPHOR, 'bold 18px monospace');
  label(ctx, 'IFF 4   TCN 32X', region.x + 10, region.y + 50, PHOSPHOR_DIM, 'bold 14px monospace');
}

/** 绘制 MFD 贴图集；无 DOM / 2D 上下文时返回 null */
export function createCockpitDisplayTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = DISPLAY_ATLAS_WIDTH;
  canvas.height = DISPLAY_ATLAS_HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, DISPLAY_ATLAS_WIDTH, DISPLAY_ATLAS_HEIGHT);
  ctx.textBaseline = 'alphabetic';
  drawRadarPage(ctx, DISPLAY_REGIONS.radar);
  drawAttitudePage(ctx, DISPLAY_REGIONS.attitude);
  drawStoresPage(ctx, DISPLAY_REGIONS.stores);
  drawUfcPage(ctx, DISPLAY_REGIONS.ufc);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
