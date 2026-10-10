import type { Vector3 } from 'three';
import { HUD_COLORS } from '@/ui/theme/hudPalette';

/**
 * 雷达点符号：雷达小地图与展开的关卡地图共用同一套形状与颜色。
 * 纯绘制函数，不持有状态、不分配对象（逐帧调用）。
 */

/**
 * 雷达点类型：
 * - enemy 敌机（红点）· spawning 正在进场（琥珀点）· boss（大红点 + 外环）
 * - enemy-ground 敌方地面单位（红色方块）· enemy-sea 敌方舰艇（红色菱形）
 * - ally 友军战机（金点）· ally-unit 友军地面 / 海上 / 预警机（金色三角）
 * - neutral 平民（灰色空心圆，勿开火）· pickup 道具（绿点）
 */
export type RadarBlipKind =
  | 'enemy'
  | 'spawning'
  | 'ally'
  | 'boss'
  | 'pickup'
  | 'enemy-ground'
  | 'enemy-sea'
  | 'neutral'
  | 'ally-unit';

export interface RadarBlip {
  position: Vector3;
  kind: RadarBlipKind;
}

export const RADAR_NEUTRAL_COLOR = '#C3CCD6';

/** 绘制顺序：平民与道具垫底，友军其次，敌方在上，Boss 最上层 */
export const RADAR_DRAW_PASSES: ReadonlyArray<ReadonlyArray<RadarBlipKind>> = [
  ['neutral', 'pickup'],
  ['ally-unit', 'ally'],
  ['enemy-ground', 'enemy-sea'],
  ['spawning', 'enemy'],
  ['boss'],
];

const KNOWN_KINDS: ReadonlySet<string> = new Set<string>(RADAR_DRAW_PASSES.flat());

const BASE_DOT_RADIUS = 3.5;
const BOSS_DOT_SCALE = 1.6;
const FULL_CIRCLE = Math.PI * 2;

/** 量程外符号：更小、更暗、空心，外加一截指向盘外的短线 */
const RIM_ALPHA = 0.62;
const RIM_LINE_WIDTH = 1.3;
const RIM_RADIUS = 2.6;
const RIM_BOSS_RADIUS = 4.2;
const RIM_TICK_GAP = 1.4;
const RIM_TICK_LENGTH = 3.2;

/**
 * 量程外符号从中心到短线末端的最大长度（scale 为 1 时的像素，取最大的 Boss 符号）：
 * 调用方把符号放在离画布边至少这么远的地方，朝外的短线才不会被裁掉。
 */
export const RADAR_RIM_MARKER_REACH = RIM_BOSS_RADIUS + RIM_TICK_GAP + RIM_TICK_LENGTH;

/** 未知类型按敌机处理 */
export function normalizeRadarKind(kind: string): RadarBlipKind {
  return KNOWN_KINDS.has(kind) ? (kind as RadarBlipKind) : 'enemy';
}

export function getRadarBlipColor(kind: RadarBlipKind): string {
  switch (kind) {
    case 'spawning':
      return HUD_COLORS.weapon;
    case 'ally':
    case 'ally-unit':
      return HUD_COLORS.ally;
    case 'neutral':
      return RADAR_NEUTRAL_COLOR;
    case 'pickup':
      return HUD_COLORS.lock;
    default:
      return HUD_COLORS.threat;
  }
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number,
  scale: number
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, FULL_CIRCLE);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius + 2 * scale, 0, FULL_CIRCLE);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.25 * scale;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius: number,
  scale: number
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, FULL_CIRCLE);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();
}

function traceSquare(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
  ctx.beginPath();
  ctx.moveTo(x - half, y - half);
  ctx.lineTo(x + half, y - half);
  ctx.lineTo(x + half, y + half);
  ctx.lineTo(x - half, y + half);
}

function traceDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
}

function traceTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius * 0.9, y + radius * 0.75);
  ctx.lineTo(x - radius * 0.9, y + radius * 0.75);
}

/** 量程内的雷达点：(x, y) 为画布坐标，scale 放大符号（关卡地图用更大的点） */
export function drawRadarBlip(
  ctx: CanvasRenderingContext2D,
  kind: RadarBlipKind,
  x: number,
  y: number,
  scale: number = 1
): void {
  const base = BASE_DOT_RADIUS * scale;
  switch (kind) {
    case 'boss':
      drawDot(ctx, x, y, HUD_COLORS.threat, base * BOSS_DOT_SCALE, scale);
      drawRing(ctx, x, y, HUD_COLORS.threat, base * BOSS_DOT_SCALE + 4.5 * scale, scale);
      break;
    case 'spawning':
      drawDot(ctx, x, y, HUD_COLORS.weapon, base, scale);
      break;
    case 'enemy-ground':
      traceSquare(ctx, x, y, base);
      ctx.fillStyle = HUD_COLORS.threat;
      ctx.fill();
      break;
    case 'enemy-sea':
      traceDiamond(ctx, x, y, base + scale);
      ctx.fillStyle = HUD_COLORS.threat;
      ctx.fill();
      break;
    case 'ally':
      drawDot(ctx, x, y, HUD_COLORS.ally, base, scale);
      break;
    case 'ally-unit':
      traceTriangle(ctx, x, y, base + 0.8 * scale);
      ctx.fillStyle = HUD_COLORS.ally;
      ctx.fill();
      break;
    case 'neutral':
      drawRing(ctx, x, y, RADAR_NEUTRAL_COLOR, base, scale);
      break;
    case 'pickup':
      drawDot(ctx, x, y, HUD_COLORS.lock, base, scale);
      break;
    default:
      drawDot(ctx, x, y, HUD_COLORS.threat, base, scale);
      break;
  }
}

/**
 * 量程外的目标：贴在盘边，画成同色系、更小、更暗的空心符号（保留方块 / 菱形 / 三角的类别），
 * 外加一截指向盘外的短线——读作“在那个方向、量程之外”，而不是“就在这里”。
 * (x, y) 为盘边上的画布坐标，(ux, uy) 为盘心指向目标的单位向量。
 */
export function drawRadarRimMarker(
  ctx: CanvasRenderingContext2D,
  kind: RadarBlipKind,
  x: number,
  y: number,
  ux: number,
  uy: number,
  scale: number = 1
): void {
  const radius = (kind === 'boss' ? RIM_BOSS_RADIUS : RIM_RADIUS) * scale;
  ctx.globalAlpha = RIM_ALPHA;
  ctx.strokeStyle = getRadarBlipColor(kind);
  ctx.lineWidth = RIM_LINE_WIDTH * scale;

  switch (kind) {
    case 'enemy-ground':
      traceSquare(ctx, x, y, radius);
      ctx.lineTo(x - radius, y - radius);
      break;
    case 'enemy-sea':
      traceDiamond(ctx, x, y, radius + 0.6 * scale);
      ctx.lineTo(x, y - radius - 0.6 * scale);
      break;
    case 'ally-unit':
      traceTriangle(ctx, x, y, radius + 0.6 * scale);
      ctx.lineTo(x, y - radius - 0.6 * scale);
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, FULL_CIRCLE);
      break;
  }
  ctx.stroke();

  const tickStart = radius + RIM_TICK_GAP * scale;
  const tickEnd = tickStart + RIM_TICK_LENGTH * scale;
  ctx.beginPath();
  ctx.moveTo(x + ux * tickStart, y + uy * tickStart);
  ctx.lineTo(x + ux * tickEnd, y + uy * tickEnd);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
