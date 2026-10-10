/**
 * 标题画面的云层：用 2D 画布在代码里画出来（不引入图片）。
 * 每条云带画成可以左右无缝拼接的一张贴图，由 CSS 动画平移；画布不可用时返回 false，
 * 调用方保留纯 CSS 渐变的兜底样式。
 */

export interface CloudBandStyle {
  seed: number;
  /** 云团数量 */
  puffs: number;
  /** 云顶所在高度（0 = 画布上沿，1 = 下沿） */
  top: number;
  /** 云团半径范围（相对画布高度） */
  radius: readonly [number, number];
  /** true：云体一直铺到画布底部（云海）；false：一条漂浮的云带 */
  filled: boolean;
  /** 受光面 / 云体 / 背光面颜色（#rrggbb；太阳在画面右侧） */
  lit: string;
  body: string;
  shade: string;
}

interface Puff {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

/** 可复现的伪随机数（mulberry32）：同一个 seed 每次画出同样的云 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 没有 2D 画布的环境（jsdom 等）直接跳过，不去触发“未实现”的报错 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof CanvasRenderingContext2D === 'undefined') {
    return null;
  }
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** '#rrggbb' → 'rgba(r, g, b, a)'：渐变两端用同一个颜色，只变透明度，边缘不会发灰 */
function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 横向压扁的柔边圆斑；x 靠近左右边缘时在另一侧补画一份，保证贴图可以无缝平铺 */
function softBlob(
  ctx: CanvasRenderingContext2D,
  width: number,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  stretch: number = 1.7,
  squash: number = 0.62
): void {
  const reach = radius * stretch;
  const offsets = [0];
  if (x - reach < 0) {
    offsets.push(width);
  }
  if (x + reach > width) {
    offsets.push(-width);
  }
  for (const offset of offsets) {
    ctx.save();
    ctx.translate(x + offset, y);
    ctx.scale(stretch, squash);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, rgba(color, 1));
    gradient.addColorStop(0.42, rgba(color, 1));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * 画一条云带：先叠出云团的形状（只关心透明度），再用 source-in 染成受光渐变，
 * 最后在每个云团朝太阳的一侧补高光、背光一侧补暗部，得到有体积感的云。
 */
export function paintCloudBand(canvas: HTMLCanvasElement, style: CloudBandStyle): boolean {
  const ctx = get2dContext(canvas);
  if (!ctx) {
    return false;
  }
  const { width, height } = canvas;
  const random = createRandom(style.seed);
  const puffs: Puff[] = [];
  for (let i = 0; i < style.puffs; i++) {
    const depth = random();
    const size = style.radius[0] + (style.radius[1] - style.radius[0]) * (0.3 + 0.7 * depth);
    puffs.push({
      x: random() * width,
      y: height * (style.top + depth * depth * (1 - style.top) * 0.82),
      r: height * size * (0.7 + 0.6 * random()),
      alpha: 0.5 + 0.45 * random(),
    });
  }
  // 远的（靠上、小的）先画
  puffs.sort((a, b) => a.y - b.y);

  ctx.clearRect(0, 0, width, height);
  for (const puff of puffs) {
    softBlob(ctx, width, puff.x, puff.y, puff.r, '#ffffff', puff.alpha);
  }
  if (style.filled) {
    const fill = ctx.createLinearGradient(0, height * style.top, 0, height);
    fill.addColorStop(0, 'rgba(255, 255, 255, 0)');
    fill.addColorStop(0.45, 'rgba(255, 255, 255, 0.9)');
    fill.addColorStop(1, 'rgba(255, 255, 255, 1)');
    ctx.fillStyle = fill;
    ctx.fillRect(0, height * style.top, width, height * (1 - style.top));
  }

  // 整体染色：上亮下暗
  ctx.globalCompositeOperation = 'source-in';
  const tint = ctx.createLinearGradient(0, height * Math.max(0, style.top - 0.12), 0, height);
  tint.addColorStop(0, style.lit);
  tint.addColorStop(0.38, style.body);
  tint.addColorStop(1, style.shade);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);

  // 体积感：右上高光、左下暗部，只画在已有云体上
  ctx.globalCompositeOperation = 'source-atop';
  for (const puff of puffs) {
    softBlob(
      ctx,
      width,
      puff.x - puff.r * 0.45,
      puff.y + puff.r * 0.3,
      puff.r * 0.95,
      style.shade,
      0.3
    );
    softBlob(
      ctx,
      width,
      puff.x + puff.r * 0.5,
      puff.y - puff.r * 0.24,
      puff.r * 0.7,
      style.lit,
      0.42
    );
  }
  ctx.globalCompositeOperation = 'source-over';
  return true;
}

/** 高空卷云：细长、很淡的条纹（color 为 #rrggbb） */
export function paintCirrus(canvas: HTMLCanvasElement, seed: number, color: string): boolean {
  const ctx = get2dContext(canvas);
  if (!ctx) {
    return false;
  }
  const { width, height } = canvas;
  const random = createRandom(seed);
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < 26; i++) {
    const x = random() * width;
    const y = height * (0.12 + random() * 0.76);
    const radius = height * (0.05 + random() * 0.09);
    softBlob(ctx, width, x, y, radius, color, 0.05 + random() * 0.13, 7 + random() * 9, 0.34);
  }
  return true;
}

/** 把一张已经画好的贴图复制到第二块画布（云带由两份相同的贴图首尾相接） */
export function copyCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
  const ctx = get2dContext(target);
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
}
