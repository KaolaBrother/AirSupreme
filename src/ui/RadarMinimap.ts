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

export type RadarBlipKind = 'enemy' | 'spawning' | 'ally' | 'boss' | 'pickup';

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
  private range: number = 800;
  private layoutDensity: HudLayoutDensity;
  private readonly playerDirection = new Vector3();
  private readonly resizeHandler: () => void;

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
    this.applyLayout();
  }

  public setLayoutDensity(density: HudLayoutDensity): void {
    this.layoutDensity = density;
    this.applyLayout();
  }

  public getLayoutDensity(): HudLayoutDensity {
    return this.layoutDensity;
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
      stickLeft = parsePx(stick.style.left) ?? stickLeft;
      stickBottom = parsePx(stick.style.bottom) ?? stickBottom;
      stickSize = parsePx(stick.style.height) ?? parsePx(stick.style.width) ?? stickSize;
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
    this.drawEnemies(playerPos, enemies, playerRotation);
    this.drawAllies(playerPos, allies, playerRotation);
    this.drawBalloons(playerPos, balloons, playerRotation);
  }

  public updateBlips(
    playerPos: Vector3,
    blips: RadarBlip[],
    playerRotation: Quaternion
  ): void {
    const enemies: EnemyRadarInfo[] = [];
    const balloons: BalloonRadarInfo[] = [];
    const allies: AllyRadarInfo[] = [];

    for (const blip of blips) {
      switch (blip.kind) {
        case 'spawning':
          enemies.push({ position: blip.position, isSpawning: true });
          break;
        case 'boss':
          enemies.push({ position: blip.position, isSpawning: false, isBoss: true });
          break;
        case 'ally':
          allies.push({ position: blip.position });
          break;
        case 'pickup':
          balloons.push({ position: blip.position });
          break;
        default:
          enemies.push({ position: blip.position, isSpawning: false });
          break;
      }
    }

    this.update(playerPos, enemies, balloons, playerRotation, allies);
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

  private projectToRadar(
    playerPos: Vector3,
    targetPos: Vector3,
    playerRotation: Quaternion
  ): { dx: number; dy: number } {
    const scale = this.size / this.range;

    this.playerDirection.set(0, 0, -1);
    this.playerDirection.applyQuaternion(playerRotation);
    const playerAngle = Math.atan2(this.playerDirection.x, this.playerDirection.z);

    const relativeX = targetPos.x - playerPos.x;
    const relativeZ = targetPos.z - playerPos.z;

    const rotatedX = relativeX * Math.cos(-playerAngle) - relativeZ * Math.sin(-playerAngle);
    const rotatedZ = relativeX * Math.sin(-playerAngle) + relativeZ * Math.cos(-playerAngle);

    let dx = rotatedX * scale;
    let dy = -rotatedZ * scale;

    const maxR = this.size / 2 - 6;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      const clampScale = maxR / dist;
      dx *= clampScale;
      dy *= clampScale;
    }

    return { dx, dy };
  }

  private drawDot(
    dx: number,
    dy: number,
    color: string,
    radius: number
  ): void {
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

  private drawEnemies(
    playerPos: Vector3,
    enemies: EnemyRadarInfo[],
    playerRotation: Quaternion
  ): void {
    for (const enemy of enemies) {
      const { dx, dy } = this.projectToRadar(playerPos, enemy.position, playerRotation);
      const color = enemy.isSpawning ? HUD_COLORS.weapon : HUD_COLORS.threat;
      const radius = enemy.isBoss ? BASE_DOT_RADIUS * BOSS_DOT_SCALE : BASE_DOT_RADIUS;
      this.drawDot(dx, dy, color, radius);
    }
  }

  private drawAllies(
    playerPos: Vector3,
    allies: AllyRadarInfo[],
    playerRotation: Quaternion
  ): void {
    for (const ally of allies) {
      const { dx, dy } = this.projectToRadar(playerPos, ally.position, playerRotation);
      this.drawDot(dx, dy, HUD_COLORS.ally, BASE_DOT_RADIUS);
    }
  }

  private drawBalloons(
    playerPos: Vector3,
    balloons: BalloonRadarInfo[],
    playerRotation: Quaternion
  ): void {
    for (const balloon of balloons) {
      const { dx, dy } = this.projectToRadar(playerPos, balloon.position, playerRotation);
      this.drawDot(dx, dy, HUD_COLORS.lock, BASE_DOT_RADIUS);
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.container.remove();
  }
}
