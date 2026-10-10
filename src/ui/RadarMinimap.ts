import { Vector3 } from 'three';
import type { Quaternion } from 'three';
import { getLogger } from '@/core/utils/Logger';
import { onLocaleChange, tr, type LocalizedText } from '@/i18n';
import { RadarLevelMap, type RadarTerrainSampler } from '@/ui/RadarLevelMap';
import {
  RADAR_DRAW_PASSES,
  drawRadarBlip,
  drawRadarRimMarker,
  normalizeRadarKind,
  type RadarBlip,
  type RadarBlipKind,
} from '@/ui/radarGlyphs';
import {
  HUD_COLORS,
  detectHudLayoutDensity,
  injectHudTokens,
  type HudLayoutDensity,
} from '@/ui/theme/hudTokens';

export type { RadarBlip, RadarBlipKind } from '@/ui/radarGlyphs';
export type { RadarTerrainSampler } from '@/ui/RadarLevelMap';

const log = getLogger('RadarMinimap');

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

type TouchDensity = Exclude<HudLayoutDensity, 'desktop'>;

const DESKTOP_SIZE_PX = 120;
/** 触控端：手机 84px；视口短边不小于 700px（平板）时 132px */
const TOUCH_SIZE_PX = 84;
const TOUCH_LARGE_SIZE_PX = 132;
const TOUCH_LARGE_MIN_SHORT_SIDE_PX = 700;

const DESKTOP_INSET_PX = 20;
const TOUCH_GAP_PX = 8;
/** 触控端左上状态栏（#hud .hud-cabin）量不到时的回退：内边距与两枚状态片的总高度 */
const FALLBACK_CABIN_INSET_PX = 10;
const FALLBACK_CABIN_HEIGHT_PX: Record<TouchDensity, number> = {
  'touch-landscape': 96,
  'touch-portrait': 78,
};
/** 左下浮动摇杆区从视口高度的 38% 处开始；竖屏把雷达压在这条线上方 */
const STICK_ZONE_TOP_RATIO = 0.38;

/** 叠放：平时与 HUD 同层；展开关卡地图时升到移动端控件（100）之上、结算面板（120）之下 */
const Z_INDEX_COLLAPSED = '50';
const Z_INDEX_EXPANDED = '110';

/** 雷达基础量程（米）；预警机等效果通过 setRangeMultiplier 放大 */
const BASE_RANGE = 800;
const MIN_RANGE_MULTIPLIER = 0.25;
const MAX_RANGE_MULTIPLIER = 4;
/** 量程外符号离盘边再收进一点，让朝外的短线留在盘内 */
const RIM_MARKER_INSET_PX = 2;

/** 最近这么久内刷新过才算“游戏进行中”：只有这时点击 / 按键才展开地图、Esc 才被地图吃掉 */
const LIVE_WINDOW_MS = 400;
/** 刷新中断超过这么久（暂停、结算、重开）：恢复时收起地图 */
const STALE_COLLAPSE_MS = 1500;
/** 关卡地图重绘间隔（20 Hz） */
const MAP_DRAW_INTERVAL_MS = 50;
/** 按下到抬起移动超过这个距离不算点击 */
const TAP_SLOP_PX = 24;

const TXT_LABEL_DESKTOP: LocalizedText = {
  en: 'Radar · click or press N for the level map',
  zh: '雷达 · 点击或按 N 展开关卡地图',
};
const TXT_LABEL_TOUCH: LocalizedText = {
  en: 'Radar · tap for the level map',
  zh: '雷达 · 点击展开关卡地图',
};

const EXPAND_ICON_SVG =
  '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" ' +
  'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>';

const SWALLOWED_EVENTS = ['touchend', 'mousedown', 'mouseup', 'click'] as const;

function resolveRadarSize(density: HudLayoutDensity): number {
  if (density === 'desktop') {
    return DESKTOP_SIZE_PX;
  }
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return shortSide >= TOUCH_LARGE_MIN_SHORT_SIDE_PX ? TOUCH_LARGE_SIZE_PX : TOUCH_SIZE_PX;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * 雷达小地图
 * 圆形玻璃航电盘，航向朝上。桌面在左下 120px；触控端在左上状态栏下方（手机 84px / 平板 132px），
 * 避开左下的浮动摇杆区。
 *
 * - 量程内的目标按类别画实心符号；量程外的贴在盘边，画成更小、更暗的空心符号加一截朝外的短线。
 * - 点击 / 轻触雷达（或按 N）展开屏幕中央的关卡地图（RadarLevelMap），再点地图、按 N 或 Esc 收起；
 *   游戏不暂停。雷达上的指针 / 触摸事件不会冒泡到游戏控件。
 */
export class RadarMinimap {
  private container: HTMLDivElement;
  private radarCanvas: HTMLCanvasElement;
  private expandBadge: HTMLDivElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private size: number = DESKTOP_SIZE_PX;
  private range: number = BASE_RANGE;
  private rangeMultiplier: number = 1;
  private layoutDensity: HudLayoutDensity;
  private readonly playerDirection = new Vector3();
  private readonly resizeHandler: () => void;
  private readonly unsubscribeLocale: () => void;

  /** 每帧复用：玩家水平航向（单位向量）与投影结果，避免为每个雷达点分配对象 */
  private forwardX: number = 0;
  private forwardZ: number = -1;
  private projectedX: number = 0;
  private projectedY: number = 0;
  private projectedBeyond: boolean = false;
  private projectedUx: number = 0;
  private projectedUy: number = -1;

  // 触控端锚点：跟随左上状态栏与（竖屏）顶部消息栈
  private anchorObserver: ResizeObserver | null = null;
  private observedCabin: Element | null = null;
  private observedStack: Element | null = null;
  private placementPending: boolean = true;
  private lastLeft: string = '';
  private lastTop: string = '';

  // 关卡地图（第一次展开时才创建）
  private levelMap: RadarLevelMap | null = null;
  private expanded: boolean = false;
  private terrainSampler: RadarTerrainSampler | null = null;
  private terrainLevel: number = -1;
  private lastUpdateAt: number = Number.NEGATIVE_INFINITY;
  private lastMapDrawAt: number = Number.NEGATIVE_INFINITY;

  // 点击判定
  private pressed: boolean = false;
  private pressedPointerId: number | undefined = undefined;
  private pressX: number = 0;
  private pressY: number = 0;

  constructor() {
    injectHudTokens();
    this.layoutDensity = detectHudLayoutDensity();
    this.size = resolveRadarSize(this.layoutDensity);

    this.container = document.createElement('div');
    this.container.id = 'radar-minimap';
    this.container.setAttribute('role', 'button');
    this.container.setAttribute('aria-expanded', 'false');
    this.container.setAttribute('aria-keyshortcuts', 'N');

    this.radarCanvas = document.createElement('canvas');
    this.ctx = this.radarCanvas.getContext('2d');
    if (!this.ctx) {
      log.error('Failed to get 2D context');
    }

    // 展开提示：右下角的小徽标（盘外一点，不挡目标）
    this.expandBadge = document.createElement('div');
    this.expandBadge.className = 'radar-expand-badge';
    this.expandBadge.innerHTML = EXPAND_ICON_SVG;
    this.expandBadge.style.cssText = `
      position: absolute;
      right: -3px;
      bottom: -3px;
      width: 22px;
      height: 22px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: var(--hud-sys, ${HUD_COLORS.sys});
      background: var(--hud-glass, ${HUD_COLORS.glass});
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      pointer-events: auto;
    `;

    this.container.appendChild(this.radarCanvas);
    this.container.appendChild(this.expandBadge);
    document.body.appendChild(this.container);

    this.container.addEventListener('pointerdown', this.onPointerDown);
    this.container.addEventListener('pointerup', this.onPointerUp);
    this.container.addEventListener('pointercancel', this.onPointerAbort);
    this.container.addEventListener('pointerleave', this.onPointerAbort);
    this.container.addEventListener('touchstart', this.onTouchStart, { passive: false });
    for (const type of SWALLOWED_EVENTS) {
      this.container.addEventListener(type, this.swallowEvent);
    }
    // 捕获阶段：地图展开时的 Esc 先由雷达处理，不再触发暂停
    window.addEventListener('keydown', this.onKeyDown, true);

    this.resizeHandler = () => {
      this.layoutDensity = detectHudLayoutDensity();
      this.applyLayout();
    };
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
    this.unsubscribeLocale = onLocaleChange(() => {
      this.refreshLabel();
      this.levelMap?.refreshLabels();
    });
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
   * 关卡地图的地形底图来源：地表采样器 + 关卡号。可以每帧调用（没有变化时直接返回）；
   * 关卡号变化时收起地图并作废底图缓存，下次展开重新采样。
   */
  public setTerrainSource(sampler: RadarTerrainSampler | null, level: number): void {
    const safeLevel = Number.isFinite(level) ? level : -1;
    if (sampler === this.terrainSampler && safeLevel === this.terrainLevel) {
      return;
    }
    const levelChanged = safeLevel !== this.terrainLevel;
    this.terrainSampler = sampler;
    this.terrainLevel = safeLevel;
    if (levelChanged) {
      this.setMapExpanded(false);
    }
    this.levelMap?.setTerrainSource(sampler, safeLevel);
  }

  public isMapExpanded(): boolean {
    return this.expanded;
  }

  /** 展开 / 收起关卡地图 */
  public toggleMap(): void {
    this.setMapExpanded(!this.expanded);
  }

  public setMapExpanded(expanded: boolean): void {
    if (expanded === this.expanded) {
      return;
    }
    this.expanded = expanded;
    if (expanded) {
      if (!this.levelMap) {
        this.levelMap = new RadarLevelMap(this.container);
        this.levelMap.setTerrainSource(this.terrainSampler, this.terrainLevel);
      }
      this.levelMap.layout(window.innerWidth, window.innerHeight, this.layoutDensity !== 'desktop');
      this.levelMap.open();
      // 下一次刷新立即重绘
      this.lastMapDrawAt = Number.NEGATIVE_INFINITY;
    } else {
      this.levelMap?.close();
    }
    this.container.style.zIndex = expanded ? Z_INDEX_EXPANDED : Z_INDEX_COLLAPSED;
    this.container.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    this.expandBadge.style.borderColor = expanded
      ? `var(--hud-sys, ${HUD_COLORS.sys})`
      : `var(--hud-edge, ${HUD_COLORS.edge})`;
  }

  /**
   * 按布局密度设置尺寸与锚点：桌面左下；触控端在左上状态栏下方。
   */
  private applyLayout(): void {
    const size = resolveRadarSize(this.layoutDensity);
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

    const style = this.container.style;
    style.position = 'fixed';
    style.width = `${size}px`;
    style.height = `${size}px`;
    style.minWidth = `${size}px`;
    style.minHeight = `${size}px`;
    style.borderRadius = '50%';
    // 子元素（展开徽标、关卡地图面板）画在圆盘之外；可见性不写内联，交给剧情卡片的样式统一收起
    style.overflow = 'visible';
    style.pointerEvents = 'auto';
    style.cursor = 'pointer';
    style.touchAction = 'none';
    style.userSelect = 'none';
    style.setProperty('-webkit-tap-highlight-color', 'transparent');
    style.zIndex = this.expanded ? Z_INDEX_EXPANDED : Z_INDEX_COLLAPSED;
    style.display = 'block';
    style.background = `var(--hud-glass, ${HUD_COLORS.glass})`;
    style.border = `1px solid var(--hud-edge, ${HUD_COLORS.edge})`;
    style.boxShadow = `var(--hud-shadow, ${HUD_COLORS.shadow}), inset 0 0 14px rgba(143, 228, 255, 0.16)`;
    this.refreshLabel();

    if (this.expanded && this.levelMap) {
      this.levelMap.layout(window.innerWidth, window.innerHeight, this.layoutDensity !== 'desktop');
      this.lastMapDrawAt = Number.NEGATIVE_INFINITY;
    }

    if (this.layoutDensity === 'desktop') {
      this.disconnectAnchors();
      this.placementPending = false;
      this.setPlacement(`${DESKTOP_INSET_PX}px`, 'auto', `${DESKTOP_INSET_PX}px`);
      return;
    }

    this.observeAnchors();
    this.applyTouchPlacement();
  }

  /**
   * 触控端锚点：左上状态栏（积分 / 速度 / 升级点）正下方 8px，左缘对齐。
   * - 横屏：消息栈居中、不在这一列，只需让开状态栏。
   * - 竖屏：消息栈（目标卡等）整行排在状态栏下方，雷达排在它之后，并尽量贴近摇杆区上沿，
   *   这样目标卡出现 / 消失时雷达不跳动。
   * 状态栏量不到（HUD 尚未显示）时按默认尺寸回退，首次刷新时再量一次。
   */
  private applyTouchPlacement(): void {
    const density: TouchDensity =
      this.layoutDensity === 'touch-portrait' ? 'touch-portrait' : 'touch-landscape';
    let left = FALLBACK_CABIN_INSET_PX;
    let cabinBottom = FALLBACK_CABIN_INSET_PX + FALLBACK_CABIN_HEIGHT_PX[density];
    let measured = false;

    const cabinRect = this.observedCabin?.getBoundingClientRect();
    if (cabinRect && cabinRect.width > 0 && cabinRect.height > 0) {
      left = cabinRect.left;
      cabinBottom = cabinRect.bottom;
      measured = true;
    }

    let top = cabinBottom + TOUCH_GAP_PX;
    if (density === 'touch-portrait') {
      const stackRect = this.observedStack?.getBoundingClientRect();
      if (stackRect && stackRect.width > 0) {
        top = Math.max(top, stackRect.bottom + TOUCH_GAP_PX);
      }
      const stickZoneTop = Math.round(window.innerHeight * STICK_ZONE_TOP_RATIO);
      top = Math.max(top, stickZoneTop - TOUCH_GAP_PX - this.size);
    }

    this.placementPending = !measured;
    if (!Number.isFinite(left) || !Number.isFinite(top)) {
      return;
    }
    this.setPlacement(`${Math.round(left)}px`, `${Math.round(top)}px`, 'auto');
  }

  private setPlacement(left: string, top: string, bottom: string): void {
    if (left === this.lastLeft && top === this.lastTop && this.container.style.bottom === bottom) {
      return;
    }
    this.lastLeft = left;
    this.lastTop = top;
    this.container.style.left = left;
    this.container.style.top = top;
    this.container.style.bottom = bottom;
    this.container.style.right = 'auto';
  }

  /** 状态栏高度会变（升级点出现）、竖屏消息栈高度会变（目标卡出现 / 换行）：变化时重新定位 */
  private observeAnchors(): void {
    const cabin = document.querySelector('#hud .hud-cabin');
    const stack = document.getElementById('hud-top-stack');
    if (cabin === this.observedCabin && stack === this.observedStack && this.anchorObserver) {
      return;
    }
    this.observedCabin = cabin;
    this.observedStack = stack;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.anchorObserver?.disconnect();
    this.anchorObserver ??= new ResizeObserver(this.onAnchorResize);
    if (cabin) {
      this.anchorObserver.observe(cabin);
    }
    if (stack) {
      this.anchorObserver.observe(stack);
    }
  }

  private disconnectAnchors(): void {
    this.anchorObserver?.disconnect();
    this.anchorObserver = null;
    this.observedCabin = null;
    this.observedStack = null;
  }

  private readonly onAnchorResize = (): void => {
    if (this.layoutDensity !== 'desktop') {
      this.applyTouchPlacement();
    }
  };

  private refreshLabel(): void {
    const label = tr(this.layoutDensity === 'desktop' ? TXT_LABEL_DESKTOP : TXT_LABEL_TOUCH);
    this.container.setAttribute('aria-label', label);
    this.container.title = label;
  }

  // ───────────────────────────── 输入 ─────────────────────────────

  /** 最近刚刷新过且没有被剧情卡片收起：游戏正在进行 */
  private isLive(): boolean {
    if (performance.now() - this.lastUpdateAt > LIVE_WINDOW_MS) {
      return false;
    }
    return getComputedStyle(this.container).visibility !== 'hidden';
  }

  /** 玩家操作（点击 / N）：展开只在游戏进行中生效，收起随时生效 */
  private requestToggle(): void {
    if (this.expanded) {
      this.setMapExpanded(false);
    } else if (this.isLive()) {
      this.setMapExpanded(true);
    }
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) {
      this.pressed = false;
      return;
    }
    this.pressed = true;
    this.pressedPointerId = event.pointerId;
    this.pressX = event.clientX;
    this.pressY = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    event.stopPropagation();
    if (!this.pressed) {
      return;
    }
    this.pressed = false;
    if (event.pointerId !== this.pressedPointerId) {
      return;
    }
    // 合成事件没有坐标时按点击处理
    const moved = Math.hypot(event.clientX - this.pressX, event.clientY - this.pressY);
    if (moved > TAP_SLOP_PX) {
      return;
    }
    this.requestToggle();
  };

  private readonly onPointerAbort = (): void => {
    this.pressed = false;
  };

  /** 触摸不冒泡到摇杆 / 按键，也不再派生鼠标事件（点击由 pointerup 判定） */
  private readonly onTouchStart = (event: Event): void => {
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  private readonly swallowEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      if (!this.expanded) {
        return;
      }
      // 游戏进行中：Esc 只收起地图，不再传给暂停；已暂停 / 被卡片盖住时照常放行
      const live = this.isLive();
      this.setMapExpanded(false);
      if (live) {
        event.stopPropagation();
      }
      return;
    }
    if (event.code !== 'KeyN' || event.repeat) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
      return;
    }
    this.requestToggle();
  };

  // ───────────────────────────── 绘制 ─────────────────────────────

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
   * 未知类型按敌机处理。关卡地图展开时顺带按 20 Hz 重绘它。
   */
  public updateBlips(
    playerPos: Vector3,
    blips: readonly RadarBlip[],
    playerRotation: Quaternion
  ): void {
    const now = performance.now();
    this.markLive(now);
    this.computeHeading(playerRotation);

    const ctx = this.ctx;
    if (ctx) {
      ctx.clearRect(0, 0, this.size, this.size);
      this.drawBackground();
      this.drawPlayer();

      for (const pass of RADAR_DRAW_PASSES) {
        for (const blip of blips) {
          const kind = normalizeRadarKind(blip.kind);
          if (!pass.includes(kind) || !this.project(playerPos, blip.position)) {
            continue;
          }
          this.drawBlip(kind);
        }
      }
      this.drawRangeLabel();
    }

    if (this.expanded && this.levelMap && now - this.lastMapDrawAt >= MAP_DRAW_INTERVAL_MS) {
      this.lastMapDrawAt = now;
      this.levelMap.draw(playerPos, blips, this.forwardX, this.forwardZ);
    }
  }

  /** 记录“正在刷新”；刷新中断很久之后恢复（暂停、结算、重开）时收起地图 */
  private markLive(now: number): void {
    if (this.expanded && now - this.lastUpdateAt > STALE_COLLAPSE_MS) {
      this.setMapExpanded(false);
    }
    this.lastUpdateAt = now;
    if (this.placementPending && this.layoutDensity !== 'desktop') {
      // HUD 此时已显示：补量一次左上状态栏（只试一次，之后交给 ResizeObserver / resize）
      this.observeAnchors();
      this.applyTouchPlacement();
      this.placementPending = false;
    }
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

  /**
   * 每帧算一次玩家的水平航向（单位向量），供所有雷达点与关卡地图复用。
   * 垂直爬升 / 俯冲或朝向非法时沿用上一次的有效航向。
   */
  private computeHeading(playerRotation: Quaternion): void {
    this.playerDirection.set(0, 0, -1);
    this.playerDirection.applyQuaternion(playerRotation);
    const x = this.playerDirection.x;
    const z = this.playerDirection.z;
    const length = Math.hypot(x, z);
    if (Number.isFinite(length) && length > 1e-4) {
      this.forwardX = x / length;
      this.forwardZ = z / length;
    }
  }

  /**
   * 投影到雷达平面（航向朝上：前方在上、右侧在右；结果写入 projectedX/Y）。
   * 超出量程的点贴在盘边并标记 projectedBeyond，(projectedUx, projectedUy) 为盘心指向它的单位向量。
   * 坐标非法时返回 false。
   */
  private project(playerPos: Vector3, targetPos: Vector3): boolean {
    const relativeX = targetPos.x - playerPos.x;
    const relativeZ = targetPos.z - playerPos.z;
    if (!Number.isFinite(relativeX) || !Number.isFinite(relativeZ)) {
      return false;
    }
    const scale = this.size / this.range;
    // 水平面上：前向 (fx, fz)，右向 (-fz, fx)
    let dx = (relativeZ * this.forwardX - relativeX * this.forwardZ) * scale;
    let dy = -(relativeX * this.forwardX + relativeZ * this.forwardZ) * scale;
    const maxR = this.size / 2 - 6;
    const dist = Math.hypot(dx, dy);
    this.projectedBeyond = dist > maxR && dist > 0;
    if (this.projectedBeyond) {
      this.projectedUx = dx / dist;
      this.projectedUy = dy / dist;
      const rimR = maxR - RIM_MARKER_INSET_PX;
      dx = this.projectedUx * rimR;
      dy = this.projectedUy * rimR;
    }
    this.projectedX = dx;
    this.projectedY = dy;
    return true;
  }

  /** 画最近一次 project() 的结果：量程内画实心符号，量程外画盘边的空心符号 */
  private drawBlip(kind: RadarBlipKind): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const x = this.size / 2 + this.projectedX;
    const y = this.size / 2 + this.projectedY;
    if (this.projectedBeyond) {
      drawRadarRimMarker(ctx, kind, x, y, this.projectedUx, this.projectedUy);
    } else {
      drawRadarBlip(ctx, kind, x, y);
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

  private drawEnemies(playerPos: Vector3, enemies: EnemyRadarInfo[]): void {
    for (const enemy of enemies) {
      if (!this.project(playerPos, enemy.position)) {
        continue;
      }
      this.drawBlip(enemy.isBoss ? 'boss' : enemy.isSpawning ? 'spawning' : 'enemy');
    }
  }

  private drawAllies(playerPos: Vector3, allies: AllyRadarInfo[]): void {
    for (const ally of allies) {
      if (this.project(playerPos, ally.position)) {
        this.drawBlip('ally');
      }
    }
  }

  private drawBalloons(playerPos: Vector3, balloons: BalloonRadarInfo[]): void {
    for (const balloon of balloons) {
      if (this.project(playerPos, balloon.position)) {
        this.drawBlip('pickup');
      }
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    this.container.removeEventListener('pointercancel', this.onPointerAbort);
    this.container.removeEventListener('pointerleave', this.onPointerAbort);
    this.container.removeEventListener('touchstart', this.onTouchStart);
    for (const type of SWALLOWED_EVENTS) {
      this.container.removeEventListener(type, this.swallowEvent);
    }
    this.unsubscribeLocale();
    this.disconnectAnchors();
    this.levelMap?.dispose();
    this.levelMap = null;
    this.expanded = false;
    this.container.remove();
  }
}
