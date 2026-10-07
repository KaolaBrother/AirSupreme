import { Vector3 } from 'three';
import type { Quaternion } from 'three';
import { getLogger } from '@/core/utils/Logger';
import {
  HUD_COLORS,
  detectHudLayoutDensity,
  injectHudTokens,
  type HudLayoutDensity,
} from '@/ui/theme/hudTokens';

const log = getLogger('RadarMinimap');

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

interface EnemyRadarInfo {
  position: Vector3;
  isSpawning: boolean;
  isBoss?: boolean;
}

interface BalloonRadarInfo {
  position: Vector3;
}

interface AllyRadarInfo {
  position: Vector3;
}

const RADAR_SIZE: Record<HudLayoutDensity, number> = {
  desktop: 120,
  'touch-landscape': 72,
  'touch-portrait': 64,
};

const DESKTOP_INSET_PX = 20;
const TOUCH_GAP_PX = 8;
const FALLBACK_STICK_INSET_PX = 20;
const FALLBACK_STICK_SIZE: Record<Exclude<HudLayoutDensity, 'desktop'>, number> = {
  'touch-landscape': 108,
  'touch-portrait': 96,
};

const BASE_DOT_RADIUS = 3.5;
const BOSS_DOT_SCALE = 1.6;
/** 雷达基础量程（米）；预警机等效果通过 setRangeMultiplier 放大 */
const BASE_RANGE = 800;
const MIN_RANGE_MULTIPLIER = 0.25;
const MAX_RANGE_MULTIPLIER = 4;
const NEUTRAL_COLOR = '#C3CCD6';

/** 绘制顺序：平民与道具垫底，友军其次，敌方在上，Boss 最上层 */
const DRAW_PASSES: ReadonlyArray<ReadonlyArray<RadarBlipKind>> = [
  ['neutral', 'pickup'],
  ['ally-unit', 'ally'],
  ['enemy-ground', 'enemy-sea'],
  ['spawning', 'enemy'],
  ['boss'],
];
const KNOWN_KINDS: ReadonlySet<string> = new Set<string>(DRAW_PASSES.flat());

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

/**
 * 雷达小地图
 * 圆形玻璃航电盘，桌面左下 120px；触控端叠在摇杆上方 8px。
 */
export class RadarMinimap {
  private container: HTMLDivElement;
  private radarCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private size: number = RADAR_SIZE.desktop;
  private range: number = BASE_RANGE;
  private rangeMultiplier: number = 1;
  private layoutDensity: HudLayoutDensity;
  private readonly playerDirection = new Vector3();
  private readonly resizeHandler: () => void;
  /** 每帧复用：玩家航向的正余弦与投影结果，避免为每个雷达点分配对象 */
  private headingCos: number = 1;
  private headingSin: number = 0;
  private projectedX: number = 0;
  private projectedY: number = 0;

  constructor() {
    injectHudTokens();
    this.layoutDensity = detectHudLayoutDensity();
    this.size = RADAR_SIZE[this.layoutDensity];

    this.container = document.createElement('div');
    this.container.id = 'radar-minimap';

    this.radarCanvas = document.createElement('canvas');
    this.ctx = this.radarCanvas.getContext('2d');
    if (!this.ctx) {
      log.error('Failed to get 2D context');
    }

    this.container.appendChild(this.radarCanvas);
    document.body.appendChild(this.container);

    this.resizeHandler = () => {
      this.layoutDensity = detectHudLayoutDensity();
      this.applyLayout();
    };
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
    this.applyLayout();
  }

  public setLayoutDensity(density: HudLayoutDensity): void {
    this.layoutDensity = density;
    this.applyLayout();
  }

  public getLayoutDensity(): HudLayoutDensity {
    return this.layoutDensity;
  }

  /** 雷达量程倍率（友军预警机在线时 > 1）；钳制在 0.25..4，非法值回到 1 */
  public setRangeMultiplier(multiplier: number): void {
    const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    this.rangeMultiplier = Math.min(MAX_RANGE_MULTIPLIER, Math.max(MIN_RANGE_MULTIPLIER, safe));
    this.range = BASE_RANGE * this.rangeMultiplier;
  }

  public getRangeMultiplier(): number {
    return this.rangeMultiplier;
  }

  /**
   * 按布局密度设置尺寸与锚点：桌面左下；触控端在 #joystick 上方留 8px。
   */
  private applyLayout(): void {
    const size = RADAR_SIZE[this.layoutDensity];
    this.size = size;

    this.radarCanvas.width = size;
    this.radarCanvas.height = size;
    this.radarCanvas.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      pointer-events: none;
      display: block;
    `;

    this.container.style.position = 'fixed';
    this.container.style.width = `${size}px`;
    this.container.style.height = `${size}px`;
    this.container.style.minWidth = `${size}px`;
    this.container.style.minHeight = `${size}px`;
    this.container.style.borderRadius = '50%';
    this.container.style.overflow = 'hidden';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '50';
    this.container.style.display = 'block';
    this.container.style.visibility = 'visible';
    this.container.style.opacity = '1';
    this.container.style.background = `var(--hud-glass, ${HUD_COLORS.glass})`;
    this.container.style.border = `1px solid var(--hud-edge, ${HUD_COLORS.edge})`;
    this.container.style.boxShadow = `var(--hud-shadow, ${HUD_COLORS.shadow}), inset 0 0 14px rgba(143, 228, 255, 0.16)`;

    if (this.layoutDensity === 'desktop') {
      this.container.style.left = `${DESKTOP_INSET_PX}px`;
      this.container.style.bottom = `${DESKTOP_INSET_PX}px`;
      this.container.style.right = 'auto';
      this.container.style.top = 'auto';
      return;
    }

    this.placeAboveJoystick();
  }

  private placeAboveJoystick(): void {
    const stick = document.getElementById('joystick');
    const fallbackSize =
      this.layoutDensity === 'touch-landscape'
        ? FALLBACK_STICK_SIZE['touch-landscape']
        : FALLBACK_STICK_SIZE['touch-portrait'];

    let stickLeft = FALLBACK_STICK_INSET_PX;
    let stickBottom = FALLBACK_STICK_INSET_PX;
    let stickSize = fallbackSize;

    if (stick) {
      // 页面里的摇杆由 CSS 定位（含安全区内边距），没有内联尺寸时按实际包围盒放置
      const rect = stick.getBoundingClientRect();
      const measured = rect.width > 0 && rect.height > 0;
      stickLeft = parsePx(stick.style.left) ?? (measured ? rect.left : stickLeft);
      stickBottom =
        parsePx(stick.style.bottom) ?? (measured ? window.innerHeight - rect.bottom : stickBottom);
      stickSize =
        parsePx(stick.style.height) ??
        parsePx(stick.style.width) ??
        (measured ? rect.height : stickSize);
    }

    this.container.style.left = `${stickLeft}px`;
    this.container.style.bottom = `${stickBottom + stickSize + TOUCH_GAP_PX}px`;
    this.container.style.right = 'auto';
    this.container.style.top = 'auto';
  }

  /**
   * 更新雷达
   * @param playerPos 玩家位置
   * @param enemies 敌人信息列表（包含生成状态 / Boss）
   * @param balloons 气球信息列表
   * @param playerRotation 玩家朝向
   * @param allies 友军
   */
  public update(
    playerPos: Vector3,
    enemies: EnemyRadarInfo[],
    balloons: BalloonRadarInfo[],
    playerRotation: Quaternion,
    allies: AllyRadarInfo[] = []
  ): void {
    if (!this.ctx) {
      return;
    }

    this.ctx.clearRect(0, 0, this.size, this.size);
    this.drawBackground();
    this.drawPlayer();
    this.computeHeading(playerRotation);
    this.drawBalloons(playerPos, balloons);
    this.drawAllies(playerPos, allies);
    this.drawEnemies(playerPos, enemies);
  }

  /**
   * 按类型绘制雷达点：分几轮遍历同一个数组，不分配临时对象。
   * 未知类型按敌机处理。
   */
  public updateBlips(
    playerPos: Vector3,
    blips: readonly RadarBlip[],
    playerRotation: Quaternion
  ): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, this.size, this.size);
    this.drawBackground();
    this.drawPlayer();
    this.computeHeading(playerRotation);

    for (const pass of DRAW_PASSES) {
      for (const blip of blips) {
        const kind = KNOWN_KINDS.has(blip.kind) ? blip.kind : 'enemy';
        if (!pass.includes(kind) || !this.project(playerPos, blip.position)) {
          continue;
        }
        this.drawBlip(kind, this.projectedX, this.projectedY);
      }
    }
    this.drawRangeLabel();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerX - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = HUD_COLORS.edge;
    ctx.lineWidth = 1;

    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (this.size / 2 - 6) * (i / 3), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(centerX, 4);
    ctx.lineTo(centerX, this.size - 4);
    ctx.moveTo(4, centerY);
    ctx.lineTo(this.size - 4, centerY);
    ctx.stroke();

    ctx.font = 'bold 11px var(--hud-mono, Arial)';
    ctx.fillStyle = HUD_COLORS.sys;
    ctx.textAlign = 'center';
    ctx.fillText('↑', centerX, 13);
    ctx.restore();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = HUD_COLORS.sys;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = HUD_COLORS.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** 每帧算一次玩家航向（绕 Y 轴），供所有雷达点复用 */
  private computeHeading(playerRotation: Quaternion): void {
    this.playerDirection.set(0, 0, -1);
    this.playerDirection.applyQuaternion(playerRotation);
    const playerAngle = Math.atan2(this.playerDirection.x, this.playerDirection.z);
    const cos = Math.cos(-playerAngle);
    const sin = Math.sin(-playerAngle);
    this.headingCos = Number.isFinite(cos) ? cos : 1;
    this.headingSin = Number.isFinite(sin) ? sin : 0;
  }

  /** 投影到雷达平面（结果写入 projectedX/Y，超出量程贴边）；坐标非法时返回 false */
  private project(playerPos: Vector3, targetPos: Vector3): boolean {
    const relativeX = targetPos.x - playerPos.x;
    const relativeZ = targetPos.z - playerPos.z;
    if (!Number.isFinite(relativeX) || !Number.isFinite(relativeZ)) {
      return false;
    }
    const scale = this.size / this.range;
    const rotatedX = relativeX * this.headingCos - relativeZ * this.headingSin;
    const rotatedZ = relativeX * this.headingSin + relativeZ * this.headingCos;

    let dx = rotatedX * scale;
    let dy = -rotatedZ * scale;
    const maxR = this.size / 2 - 6;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      const clampScale = maxR / dist;
      dx *= clampScale;
      dy *= clampScale;
    }
    this.projectedX = dx;
    this.projectedY = dy;
    return true;
  }

  private drawBlip(kind: RadarBlipKind, dx: number, dy: number): void {
    switch (kind) {
      case 'boss':
        this.drawDot(dx, dy, HUD_COLORS.threat, BASE_DOT_RADIUS * BOSS_DOT_SCALE);
        this.drawRing(dx, dy, HUD_COLORS.threat, BASE_DOT_RADIUS * BOSS_DOT_SCALE + 4.5);
        break;
      case 'spawning':
        this.drawDot(dx, dy, HUD_COLORS.weapon, BASE_DOT_RADIUS);
        break;
      case 'enemy-ground':
        this.drawSquare(dx, dy, HUD_COLORS.threat, BASE_DOT_RADIUS);
        break;
      case 'enemy-sea':
        this.drawDiamond(dx, dy, HUD_COLORS.threat, BASE_DOT_RADIUS + 1);
        break;
      case 'ally':
        this.drawDot(dx, dy, HUD_COLORS.ally, BASE_DOT_RADIUS);
        break;
      case 'ally-unit':
        this.drawTriangle(dx, dy, HUD_COLORS.ally, BASE_DOT_RADIUS + 0.8);
        break;
      case 'neutral':
        this.drawRing(dx, dy, NEUTRAL_COLOR, BASE_DOT_RADIUS);
        break;
      case 'pickup':
        this.drawDot(dx, dy, HUD_COLORS.lock, BASE_DOT_RADIUS);
        break;
      default:
        this.drawDot(dx, dy, HUD_COLORS.threat, BASE_DOT_RADIUS);
        break;
    }
  }

  /** 量程放大时在底部标注倍率 */
  private drawRangeLabel(): void {
    const ctx = this.ctx;
    if (!ctx || Math.abs(this.rangeMultiplier - 1) < 0.01) {
      return;
    }
    ctx.font = 'bold 9px Arial';
    ctx.fillStyle = this.rangeMultiplier > 1 ? HUD_COLORS.ally : HUD_COLORS.weapon;
    ctx.textAlign = 'center';
    ctx.fillText(`×${this.rangeMultiplier.toFixed(1)}`, this.size / 2, this.size - 6);
  }

  private drawSquare(dx: number, dy: number, color: string, half: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const x = this.size / 2 + dx;
    const y = this.size / 2 + dy;
    ctx.beginPath();
    ctx.moveTo(x - half, y - half);
    ctx.lineTo(x + half, y - half);
    ctx.lineTo(x + half, y + half);
    ctx.lineTo(x - half, y + half);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawDiamond(dx: number, dy: number, color: string, radius: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const x = this.size / 2 + dx;
    const y = this.size / 2 + dy;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawTriangle(dx: number, dy: number, color: string, radius: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const x = this.size / 2 + dx;
    const y = this.size / 2 + dy;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius * 0.9, y + radius * 0.75);
    ctx.lineTo(x - radius * 0.9, y + radius * 0.75);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawRing(dx: number, dy: number, color: string, radius: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.beginPath();
    ctx.arc(this.size / 2 + dx, this.size / 2 + dy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  private drawDot(dx: number, dy: number, color: string, radius: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    const centerX = this.size / 2;
    const centerY = this.size / 2;

    ctx.beginPath();
    ctx.arc(centerX + dx, centerY + dy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX + dx, centerY + dy, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawEnemies(playerPos: Vector3, enemies: EnemyRadarInfo[]): void {
    for (const enemy of enemies) {
      if (!this.project(playerPos, enemy.position)) {
        continue;
      }
      const kind: RadarBlipKind = enemy.isBoss ? 'boss' : enemy.isSpawning ? 'spawning' : 'enemy';
      this.drawBlip(kind, this.projectedX, this.projectedY);
    }
  }

  private drawAllies(playerPos: Vector3, allies: AllyRadarInfo[]): void {
    for (const ally of allies) {
      if (this.project(playerPos, ally.position)) {
        this.drawBlip('ally', this.projectedX, this.projectedY);
      }
    }
  }

  private drawBalloons(playerPos: Vector3, balloons: BalloonRadarInfo[]): void {
    for (const balloon of balloons) {
      if (this.project(playerPos, balloon.position)) {
        this.drawBlip('pickup', this.projectedX, this.projectedY);
      }
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    this.container.remove();
  }
}
