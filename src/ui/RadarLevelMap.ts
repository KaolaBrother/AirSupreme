import type { Vector3 } from 'three';
import { GAME_CONSTANTS } from '@/config';
import { getLogger } from '@/core/utils/Logger';
import { tr, type LocalizedText } from '@/i18n';
import {
  RADAR_DRAW_PASSES,
  drawRadarBlip,
  drawRadarRimMarker,
  normalizeRadarKind,
  type RadarBlip,
  type RadarBlipKind,
} from '@/ui/radarGlyphs';
import { HUD_COLORS } from '@/ui/theme/hudTokens';

const log = getLogger('RadarLevelMap');

/** 地表采样器：世界 (x, z) → 表面高度与是否为可航行水域（与 UnitSurfaceSampler 同形） */
export type RadarTerrainSampler = (x: number, z: number) => { y: number; water: boolean };

/** 面板边长：视口短边的 72%，不超过 560px */
const PANEL_VIEWPORT_RATIO = 0.72;
const PANEL_MAX_SIZE_PX = 560;
const PANEL_MIN_SIZE_PX = 200;
/** 图例条高度（面板在正方形地图下方多出这一条） */
const LEGEND_HEIGHT_PX = 38;
const LEGEND_COMPACT_HEIGHT_PX = 34;
const COMPACT_PANEL_PX = 360;
const MAP_PADDING_PX = 8;
const MAX_PIXEL_RATIO = 2;

/** 地图显示整个战场（正方形，边长为 2 × 半跨度），北（世界 -Z）朝上 */
const MAP_HALF_EXTENT = GAME_CONSTANTS.WORLD.BATTLEFIELD_HALF_EXTENT;
const BOUNDARY_RADIUS = GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS;
const GRID_STEP = 500;
/** 以玩家为圆心的距离环（米）与标注 */
const RANGE_RINGS: ReadonlyArray<readonly [radius: number, label: string]> = [
  [500, '500 m'],
  [1000, '1000 m'],
];
const RING_DASH: number[] = [4, 5];
const NO_DASH: number[] = [];

/** 地形底图：整个战场采样 64×64 个点，每次重绘最多采 16 行（约 0.2 秒采完，不卡帧） */
const TERRAIN_GRID = 64;
const TERRAIN_ROWS_PER_STEP = 16;
/** 高差小于这个值（米）且没有水域：底图没有信息量，只画网格 */
const TERRAIN_FLAT_RANGE = 1;
const WATER_RGB: readonly [number, number, number] = [26, 72, 112];
const LAND_LOW_RGB: readonly [number, number, number] = [38, 70, 58];
const LAND_HIGH_RGB: readonly [number, number, number] = [156, 164, 142];
const WATER_ALPHA = 150;
const LAND_ALPHA = 118;

const FONT_STACK = "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const FULL_CIRCLE = Math.PI * 2;

const TXT_TITLE: LocalizedText = { en: 'LEVEL MAP', zh: '关卡地图' };
const TXT_CLOSE_TOUCH: LocalizedText = { en: 'TAP TO CLOSE', zh: '点击关闭' };
const TXT_CLOSE_DESKTOP: LocalizedText = { en: 'N / ESC · CLICK', zh: 'N / ESC · 点击关闭' };
const TXT_PANEL_LABEL: LocalizedText = {
  en: 'Level map · click or tap to close',
  zh: '关卡地图 · 点击关闭',
};

/** 图例（三列两行）：符号与雷达点完全相同；友军同时画战机圆点与单位三角 */
const LEGEND: ReadonlyArray<{
  kinds: readonly RadarBlipKind[];
  label: LocalizedText;
}> = [
  { kinds: ['enemy'], label: { en: 'Enemy aircraft', zh: '敌机' } },
  { kinds: ['enemy-ground'], label: { en: 'Ground target', zh: '地面目标' } },
  { kinds: ['enemy-sea'], label: { en: 'Ship', zh: '敌舰' } },
  { kinds: ['ally', 'ally-unit'], label: { en: 'Ally', zh: '友军' } },
  { kinds: ['neutral'], label: { en: 'Civilian', zh: '平民' } },
  { kinds: ['boss'], label: { en: 'Boss', zh: 'Boss' } },
];
const LEGEND_COLUMNS = 3;

type TerrainState = 'none' | 'pending' | 'sampling' | 'ready' | 'flat';

/**
 * 展开的关卡地图：屏幕中央的大面板，北朝上、固定比例显示整个战场——边界圈、以玩家为圆心的
 * 500 / 1000 米距离环、按航向旋转的玩家箭头、雷达上的全部目标（同样的形状与颜色，更大）和图例。
 *
 * 有地表采样器时在目标下方铺一张低分辨率的陆地 / 水域底图：每关采样一次（分几次重绘采完），
 * 缓存在离屏画布里；没有采样器或地形是平的就只画网格。
 * 静态层（底图、网格、边界、标题、图例）缓存在另一张离屏画布，逐帧只贴图再画目标，不分配对象。
 * 游戏不会因为地图打开而暂停。
 */
export class RadarLevelMap {
  public readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private staticLayer: HTMLCanvasElement | null = null;
  private staticCtx: CanvasRenderingContext2D | null = null;
  private staticDirty = true;

  private size = PANEL_MIN_SIZE_PX;
  private legendHeight = LEGEND_HEIGHT_PX;
  private pixelRatio = 1;
  private touchLayout = false;
  private opened = false;

  // 地形底图
  private sampler: RadarTerrainSampler | null = null;
  private terrainLevel = Number.NaN;
  private terrainState: TerrainState = 'none';
  private terrainRow = 0;
  private terrainHeights: Float32Array | null = null;
  private terrainWater: Uint8Array | null = null;
  private terrainCanvas: HTMLCanvasElement | null = null;

  // 投影结果（逐帧复用）
  private projectedX = 0;
  private projectedY = 0;
  private projectedBeyond = false;
  private projectedUx = 0;
  private projectedUy = -1;

  constructor(host: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'radar-map';
    this.element.setAttribute('role', 'button');
    // 半透明玻璃面板：保留对背后战场的感知
    this.element.style.cssText = `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: none;
      box-sizing: content-box;
      overflow: hidden;
      cursor: pointer;
      pointer-events: auto;
      touch-action: none;
      background: rgba(8, 14, 24, 0.5);
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      border-radius: var(--hud-radius, 12px);
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow}), inset 0 0 22px rgba(143, 228, 255, 0.12);
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display: block; pointer-events: none;';
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      log.error('Failed to get 2D context');
    }
    this.element.appendChild(this.canvas);
    host.appendChild(this.element);
    this.refreshLabels();
  }

  public isOpen(): boolean {
    return this.opened;
  }

  /** 面板在视口中的边长（CSS 像素，不含图例条） */
  public getSize(): number {
    return this.size;
  }

  /** 按视口重新计算面板尺寸（展开时与窗口变化时调用） */
  public layout(viewportWidth: number, viewportHeight: number, touchLayout: boolean): void {
    const shortSide = Math.min(viewportWidth, viewportHeight);
    const wanted = Number.isFinite(shortSide)
      ? shortSide * PANEL_VIEWPORT_RATIO
      : PANEL_MAX_SIZE_PX;
    const size = Math.round(Math.max(PANEL_MIN_SIZE_PX, Math.min(PANEL_MAX_SIZE_PX, wanted)));
    const legendHeight = size < COMPACT_PANEL_PX ? LEGEND_COMPACT_HEIGHT_PX : LEGEND_HEIGHT_PX;
    const ratio = Math.min(
      MAX_PIXEL_RATIO,
      Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    );
    if (touchLayout !== this.touchLayout) {
      this.touchLayout = touchLayout;
      this.staticDirty = true;
    }
    if (size === this.size && legendHeight === this.legendHeight && ratio === this.pixelRatio) {
      if (this.canvas.width > 0 && this.canvas.style.width !== '') {
        return;
      }
    }
    this.size = size;
    this.legendHeight = legendHeight;
    this.pixelRatio = ratio;
    const height = size + legendHeight;
    this.canvas.width = Math.round(size * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${height}px`;
    this.element.style.width = `${size}px`;
    this.element.style.height = `${height}px`;
    if (this.staticLayer) {
      this.staticLayer.width = this.canvas.width;
      this.staticLayer.height = this.canvas.height;
    }
    this.staticDirty = true;
  }

  /**
   * 地形底图来源：采样器或关卡号变化时作废缓存，下次展开重新采样。
   * 返回关卡是否变了（调用方据此收起地图）。
   */
  public setTerrainSource(sampler: RadarTerrainSampler | null, level: number): boolean {
    const levelChanged =
      level !== this.terrainLevel && !(level !== level && this.terrainLevel !== this.terrainLevel);
    if (sampler === this.sampler && !levelChanged) {
      return false;
    }
    this.sampler = sampler;
    this.terrainLevel = level;
    this.terrainState = sampler ? 'pending' : 'none';
    this.terrainRow = 0;
    this.staticDirty = true;
    return levelChanged;
  }

  public open(): void {
    this.opened = true;
    // 平的结果可能是地形当时还没生成：每次展开重采一次（只在展开期间分步进行）
    if (this.terrainState === 'flat') {
      this.terrainState = 'pending';
      this.terrainRow = 0;
    }
    this.staticDirty = true;
    this.element.style.display = 'block';
  }

  public close(): void {
    this.opened = false;
    this.element.style.display = 'none';
  }

  /** 语言切换：标题、图例与无障碍标签按新语言重绘 */
  public refreshLabels(): void {
    const label = tr(TXT_PANEL_LABEL);
    this.element.setAttribute('aria-label', label);
    this.element.title = label;
    this.staticDirty = true;
  }

  /**
   * 重绘（展开时由雷达按 20 Hz 调用）：贴静态层，再画距离环、目标与玩家箭头。
   * forwardX / forwardZ 为玩家水平航向的单位向量。
   */
  public draw(
    playerPos: Vector3,
    blips: readonly RadarBlip[],
    forwardX: number,
    forwardZ: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.opened) {
      return;
    }
    this.stepTerrainSampling();
    if (this.staticDirty) {
      this.renderStaticLayer();
    }

    const ratio = this.pixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.staticLayer) {
      ctx.drawImage(this.staticLayer, 0, 0);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const size = this.size;
    const playerVisible = this.project(playerPos.x, playerPos.z);
    const playerX = this.projectedX;
    const playerY = this.projectedY;
    const playerBeyond = this.projectedBeyond;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();

    if (playerVisible && !playerBeyond) {
      this.drawRangeRings(ctx, playerX, playerY);
    }

    const blipScale = size < COMPACT_PANEL_PX ? 1.35 : 1.7;
    for (const pass of RADAR_DRAW_PASSES) {
      for (const blip of blips) {
        const kind = normalizeRadarKind(blip.kind);
        if (!pass.includes(kind) || !this.project(blip.position.x, blip.position.z)) {
          continue;
        }
        if (this.projectedBeyond) {
          drawRadarRimMarker(
            ctx,
            kind,
            this.projectedX,
            this.projectedY,
            this.projectedUx,
            this.projectedUy,
            blipScale
          );
        } else {
          drawRadarBlip(ctx, kind, this.projectedX, this.projectedY, blipScale);
        }
      }
    }

    if (playerVisible) {
      this.drawPlayerArrow(ctx, playerX, playerY, forwardX, forwardZ);
    }
    ctx.restore();
  }

  /**
   * 世界 (x, z) → 画布坐标（结果写入 projectedX/Y）。超出地图的点贴在地图边上并标记 beyond，
   * (projectedUx, projectedUy) 为地图中心指向它的单位向量；坐标非法时返回 false。
   */
  private project(worldX: number, worldZ: number): boolean {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return false;
    }
    const center = this.size / 2;
    const half = center - MAP_PADDING_PX;
    const scale = half / MAP_HALF_EXTENT;
    let dx = worldX * scale;
    let dy = worldZ * scale;
    const reach = Math.max(Math.abs(dx), Math.abs(dy));
    this.projectedBeyond = reach > half;
    if (this.projectedBeyond) {
      const clamp = half / reach;
      dx *= clamp;
      dy *= clamp;
      const length = Math.hypot(dx, dy);
      this.projectedUx = length > 0 ? dx / length : 0;
      this.projectedUy = length > 0 ? dy / length : -1;
    }
    this.projectedX = center + dx;
    this.projectedY = center + dy;
    return true;
  }

  private drawRangeRings(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const scale = (this.size / 2 - MAP_PADDING_PX) / MAP_HALF_EXTENT;
    ctx.strokeStyle = HUD_COLORS.sys;
    ctx.fillStyle = HUD_COLORS.sys;
    ctx.lineWidth = 1;
    ctx.font = `bold ${this.size < COMPACT_PANEL_PX ? 9 : 10}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.setLineDash(RING_DASH);
    for (const [radius, label] of RANGE_RINGS) {
      const r = radius * scale;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, FULL_CIRCLE);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      // 标注放在环的正北；贴到地图上沿时改放正南
      const labelY = y - r - 2 > 12 ? y - r - 2 : y + r + 12;
      ctx.fillText(label, x, labelY);
    }
    ctx.setLineDash(NO_DASH);
    ctx.globalAlpha = 1;
  }

  /** 玩家：按航向旋转的箭头（北朝上：世界 -Z 为上、+X 为右） */
  private drawPlayerArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    forwardX: number,
    forwardZ: number
  ): void {
    const length = Math.hypot(forwardX, forwardZ);
    // 画布上的航向单位向量；航向非法时指向正北
    const hx = Number.isFinite(length) && length > 1e-4 ? forwardX / length : 0;
    const hy = Number.isFinite(length) && length > 1e-4 ? forwardZ / length : -1;
    // 右手方向（画布坐标）
    const rx = -hy;
    const ry = hx;
    const s = this.size < COMPACT_PANEL_PX ? 8 : 10;

    ctx.beginPath();
    ctx.moveTo(x + hx * s * 1.25, y + hy * s * 1.25);
    ctx.lineTo(x - hx * s * 0.8 + rx * s * 0.75, y - hy * s * 0.8 + ry * s * 0.75);
    ctx.lineTo(x - hx * s * 0.3, y - hy * s * 0.3);
    ctx.lineTo(x - hx * s * 0.8 - rx * s * 0.75, y - hy * s * 0.8 - ry * s * 0.75);
    ctx.lineTo(x + hx * s * 1.25, y + hy * s * 1.25);
    ctx.fillStyle = HUD_COLORS.sys;
    ctx.fill();
    ctx.strokeStyle = 'rgba(4, 8, 14, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ───────────────────────────── 静态层 ─────────────────────────────

  private renderStaticLayer(): void {
    if (!this.staticLayer) {
      this.staticLayer = document.createElement('canvas');
      this.staticLayer.width = this.canvas.width;
      this.staticLayer.height = this.canvas.height;
      this.staticCtx = this.staticLayer.getContext('2d');
    }
    const ctx = this.staticCtx;
    this.staticDirty = false;
    if (!ctx) {
      return;
    }

    const size = this.size;
    const center = size / 2;
    const half = center - MAP_PADDING_PX;
    const scale = half / MAP_HALF_EXTENT;
    const boundary = BOUNDARY_RADIUS * scale;
    const compact = size < COMPACT_PANEL_PX;
    const hasTerrain = this.terrainState === 'ready' && this.terrainCanvas !== null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.staticLayer.width, this.staticLayer.height);
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    // 边界圈内：地形底图（有的话）+ 500 米网格
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, boundary, 0, FULL_CIRCLE);
    ctx.clip();
    if (hasTerrain && this.terrainCanvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.terrainCanvas, center - half, center - half, half * 2, half * 2);
    } else {
      ctx.fillStyle = 'rgba(143, 228, 255, 0.05)';
      ctx.fillRect(center - half, center - half, half * 2, half * 2);
    }
    ctx.strokeStyle = HUD_COLORS.sys;
    ctx.globalAlpha = hasTerrain ? 0.1 : 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let offset = -MAP_HALF_EXTENT; offset <= MAP_HALF_EXTENT; offset += GRID_STEP) {
      const p = center + offset * scale;
      ctx.moveTo(p, center - half);
      ctx.lineTo(p, center + half);
      ctx.moveTo(center - half, p);
      ctx.lineTo(center + half, p);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 战场边界圈
    ctx.strokeStyle = HUD_COLORS.sys;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center, center, boundary, 0, FULL_CIRCLE);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 指北标记、标题与关闭提示（都在边界圈外的角上）
    ctx.fillStyle = HUD_COLORS.sys;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `bold ${compact ? 10 : 12}px ${FONT_STACK}`;
    ctx.fillText('N', center, center - boundary - (compact ? 6 : 9));
    ctx.textAlign = 'left';
    ctx.font = `bold ${compact ? 10 : 12}px ${FONT_STACK}`;
    ctx.fillText(tr(TXT_TITLE), 10, compact ? 12 : 15, size * 0.3);
    ctx.textAlign = 'right';
    ctx.fillStyle = HUD_COLORS.muted;
    ctx.font = `${compact ? 9 : 11}px ${FONT_STACK}`;
    ctx.fillText(
      tr(this.touchLayout ? TXT_CLOSE_TOUCH : TXT_CLOSE_DESKTOP),
      size - 10,
      compact ? 12 : 15,
      size * 0.3
    );

    this.renderLegend(ctx, compact);
  }

  private renderLegend(ctx: CanvasRenderingContext2D, compact: boolean): void {
    const size = this.size;
    const top = size;
    ctx.fillStyle = 'rgba(4, 8, 14, 0.42)';
    ctx.fillRect(0, top, size, this.legendHeight);
    ctx.strokeStyle = HUD_COLORS.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, top + 0.5);
    ctx.lineTo(size, top + 0.5);
    ctx.stroke();

    const rows = Math.ceil(LEGEND.length / LEGEND_COLUMNS);
    const cellWidth = (size - 12) / LEGEND_COLUMNS;
    const rowHeight = (this.legendHeight - 6) / rows;
    const glyphScale = compact ? 0.85 : 1;
    ctx.font = `${compact ? 10 : 12}px ${FONT_STACK}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let index = 0; index < LEGEND.length; index++) {
      const entry = LEGEND[index];
      const cellX = 6 + (index % LEGEND_COLUMNS) * cellWidth;
      const y = top + 3 + (Math.floor(index / LEGEND_COLUMNS) + 0.5) * rowHeight;
      let x = cellX + 10;
      for (const kind of entry.kinds) {
        drawRadarBlip(ctx, kind, x, y, kind === 'boss' ? glyphScale * 0.62 : glyphScale);
        x += 13;
      }
      ctx.fillStyle = HUD_COLORS.text;
      ctx.fillText(tr(entry.label), x - 2, y + 0.5, cellX + cellWidth - x - 2);
    }
  }

  // ───────────────────────────── 地形底图 ─────────────────────────────

  /** 分步采样：每次重绘采几行，采完后一次性上色并重画静态层 */
  private stepTerrainSampling(): void {
    const sampler = this.sampler;
    if (this.terrainState === 'pending') {
      this.terrainState = sampler ? 'sampling' : 'none';
      this.terrainRow = 0;
    }
    if (this.terrainState !== 'sampling' || !sampler) {
      return;
    }
    this.terrainHeights ??= new Float32Array(TERRAIN_GRID * TERRAIN_GRID);
    this.terrainWater ??= new Uint8Array(TERRAIN_GRID * TERRAIN_GRID);
    const heights = this.terrainHeights;
    const water = this.terrainWater;
    const step = (MAP_HALF_EXTENT * 2) / TERRAIN_GRID;
    const endRow = Math.min(TERRAIN_GRID, this.terrainRow + TERRAIN_ROWS_PER_STEP);
    try {
      for (let row = this.terrainRow; row < endRow; row++) {
        // 第 0 行在地图最上方（北，世界 -Z）
        const z = -MAP_HALF_EXTENT + (row + 0.5) * step;
        for (let column = 0; column < TERRAIN_GRID; column++) {
          const x = -MAP_HALF_EXTENT + (column + 0.5) * step;
          const sample = sampler(x, z);
          const index = row * TERRAIN_GRID + column;
          heights[index] = Number.isFinite(sample.y) ? sample.y : 0;
          water[index] = sample.water === true ? 1 : 0;
        }
      }
    } catch (error) {
      // 采样器异常：放弃底图，只画网格
      log.warn('Terrain sampling failed', { error });
      this.terrainState = 'none';
      this.staticDirty = true;
      return;
    }
    this.terrainRow = endRow;
    if (endRow >= TERRAIN_GRID) {
      this.paintTerrain(heights, water);
    }
  }

  private paintTerrain(heights: Float32Array, water: Uint8Array): void {
    let min = Infinity;
    let max = -Infinity;
    let waterCells = 0;
    for (let index = 0; index < heights.length; index++) {
      if (water[index] === 1) {
        waterCells++;
        continue;
      }
      const height = heights[index];
      if (height < min) min = height;
      if (height > max) max = height;
    }
    const range = max - min;
    if (waterCells === 0 && !(range >= TERRAIN_FLAT_RANGE)) {
      this.terrainState = 'flat';
      this.staticDirty = true;
      return;
    }

    if (!this.terrainCanvas) {
      this.terrainCanvas = document.createElement('canvas');
      this.terrainCanvas.width = TERRAIN_GRID;
      this.terrainCanvas.height = TERRAIN_GRID;
    }
    const ctx = this.terrainCanvas.getContext('2d');
    if (!ctx) {
      this.terrainState = 'none';
      this.staticDirty = true;
      return;
    }
    const image = ctx.createImageData(TERRAIN_GRID, TERRAIN_GRID);
    const data = image.data;
    const span = range > 0 ? range : 1;
    for (let index = 0; index < heights.length; index++) {
      const offset = index * 4;
      if (water[index] === 1) {
        data[offset] = WATER_RGB[0];
        data[offset + 1] = WATER_RGB[1];
        data[offset + 2] = WATER_RGB[2];
        data[offset + 3] = WATER_ALPHA;
        continue;
      }
      // 越高越亮
      const t = Math.max(0, Math.min(1, (heights[index] - min) / span));
      data[offset] = LAND_LOW_RGB[0] + (LAND_HIGH_RGB[0] - LAND_LOW_RGB[0]) * t;
      data[offset + 1] = LAND_LOW_RGB[1] + (LAND_HIGH_RGB[1] - LAND_LOW_RGB[1]) * t;
      data[offset + 2] = LAND_LOW_RGB[2] + (LAND_HIGH_RGB[2] - LAND_LOW_RGB[2]) * t;
      data[offset + 3] = LAND_ALPHA;
    }
    ctx.putImageData(image, 0, 0);
    this.terrainState = 'ready';
    this.staticDirty = true;
  }

  public dispose(): void {
    this.opened = false;
    this.sampler = null;
    this.staticLayer = null;
    this.staticCtx = null;
    this.terrainCanvas = null;
    this.terrainHeights = null;
    this.terrainWater = null;
    this.element.remove();
  }
}
