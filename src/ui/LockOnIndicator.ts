import { Vector3 } from 'three';
import type { Camera, Object3D, Quaternion } from 'three';
import { GAME_CONSTANTS } from '@/config';
import { onLocaleChange, tr, type LocalizedText } from '@/i18n';
import {
  MissileSeeker,
  projectToScreen,
  type ILockJamProvider,
  type ScreenPoint,
} from '@/features/combat/MissileSeeker';
import {
  HUD_COLORS,
  detectHudLayoutDensity,
  injectHudTokens,
  type HudLayoutDensity,
  type LockOnState,
} from '@/ui/theme/hudTokens';

/** 准星 = 机头轴线前方这么远的一点投到屏幕上的位置（米）；机炮辅助的十字从同一个距离拉近 */
const AIM_DISTANCE = GAME_CONSTANTS.GUN_ASSIST.REFERENCE_RANGE;
/** 丢锁后的红色提示时长 */
const BREAK_TREATMENT_MS = 260;
/** “未锁定 / 无导弹”提示的显示时长 */
const CUE_DURATION_MS = 900;
/** 捕获环半径的像素下限 / 相对视口短边的上限 */
const MIN_ACQUIRE_RADIUS = 44;
const MAX_ACQUIRE_RADIUS_RATIO = 0.3;
/** 准星跑出视口这么多像素后不再绘制（追尾视角急拉杆时机头轴线会甩出屏幕） */
const OFFSCREEN_MARGIN = 24;
/** 机炮十字被机炮辅助拉离机头轴线超过这么多像素才换成“辅助中”的样子；回到这么近才换回来 */
const CROSS_ASSIST_ON_PX = 3;
const CROSS_ASSIST_OFF_PX = 1.5;
/** 距离读数的取整步长（米），避免每帧改写文字 */
const RANGE_STEP = 10;
const ARC_RADIUS = 46;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

const TXT_LOCK: LocalizedText = { en: 'LOCK', zh: '锁定' };
const TXT_NO_LOCK: LocalizedText = { en: 'NO LOCK', zh: '未锁定' };
const TXT_NO_MISSILE: LocalizedText = { en: 'NO MSL', zh: '无导弹' };
const TXT_MISSILE: LocalizedText = { en: 'MSL', zh: '导弹' };
const TXT_JAMMED: LocalizedText = { en: 'JAMMED', zh: '受干扰' };

export type LockOnCue = 'no-lock' | 'no-missile';

interface PlacedPosition {
  x: number;
  y: number;
}

/**
 * 瞄准与导弹锁定显示：
 * - 机炮准星：画在机头轴线前方 600 米那一点的屏幕位置（第一 / 第三人称都对准弹道），
 *   每个渲染帧更新（renderUpdate）。机炮辅助（触屏 / 键盘）把弹道拉向目标时，十字跟着移到辅助方向上
 *   （同样取 600 米处），换成锁定色并套一个小菱形，机头轴线的位置留一个暗标记。
 * - 导引头捕获环：始终以机头轴线为圆心，不随机炮十字移动。只要有导弹，导引头一直工作
 *   （MissileSeeker，每个模拟步 update）。
 * - 跟踪：目标上的角标随进度收紧 + 进度弧；锁定：角标变锁定色 + “锁定”标签与距离；
 *   丢锁：短暂的红色提示；“未锁定 / 无导弹”提示显示在准星下方。
 * - 准星旁显示导弹余量；机炮提前量标记（由 GunLeadSolver 给出世界坐标）。
 * - 敌方干扰机拖慢锁定期间，捕获环内侧上沿显示“受干扰”标签。
 * 所有元素 pointer-events: none。
 */
export class LockOnIndicator {
  private static readonly STYLE_ID = 'lock-on-indicator-style';
  private static readonly MISSILE_BUTTON_STATE_CLASSES = [
    'is-search',
    'is-track',
    'is-lock',
    'is-ready',
    'is-dry',
  ] as const;

  private readonly seeker = new MissileSeeker();

  private container: HTMLDivElement;
  private reticle: HTMLDivElement;
  private ring: HTMLDivElement;
  private cross: HTMLDivElement;
  private cue: HTMLDivElement;
  private jam: HTMLDivElement;
  private jammed: boolean = false;
  private count: HTMLDivElement;
  private countLabel: HTMLSpanElement;
  private readonly countPips: HTMLElement[] = [];
  private targetAnchor: HTMLDivElement;
  private targetBox: HTMLDivElement;
  private targetArc: SVGSVGElement;
  private targetArcStroke: SVGCircleElement;
  private targetLabel: HTMLDivElement;
  private targetLabelTag: HTMLSpanElement;
  private targetLabelRange: HTMLSpanElement;
  private leadAnchor: HTMLDivElement;

  private lockState: LockOnState = 'search';
  private appliedState: LockOnState | null = null;
  private layoutDensity: HudLayoutDensity = 'desktop';
  private paused: boolean = false;
  private initialized: boolean = false;
  private lockCircleScale: number = 1;
  private acquireRadius: number = 0;
  private boxMax: number = 72;
  private boxMin: number = 40;
  private missileCount: number = GAME_CONSTANTS.MISSILE.STARTING_MISSILES;
  private shownMissileCount: number = -1;
  private breakUntilMs: number = 0;
  private cueUntilMs: number = 0;
  private cueKind: LockOnCue | null = null;
  private shownRange: number = -1;
  private shownBoxSize: number = -1;
  private shownArcOffset: number = -1;
  /** 机炮十字相对机头轴线的屏幕偏移（已写进样式的值）与“辅助中”的样子是否生效 */
  private crossShiftX: number = 0;
  private crossShiftY: number = 0;
  private crossAssisted: boolean = false;

  private viewportWidth: number = window.innerWidth;
  private viewportHeight: number = window.innerHeight;
  private resizeHandler: () => void;
  private unsubscribeLocale: (() => void) | null = null;

  private readonly aimWorld = new Vector3();
  private readonly worldPosition = new Vector3();
  /** 模拟步里导引头使用的准星位置 */
  private readonly simAim: ScreenPoint = { x: 0, y: 0, visible: false };
  /** 最近一个渲染帧画出的准星位置（机头轴线；捕获环的圆心） */
  private readonly renderAim: ScreenPoint = { x: 0, y: 0, visible: false };
  /** 最近一个渲染帧画出的机炮十字位置（没有辅助偏移时与 renderAim 相同） */
  private readonly renderCross: ScreenPoint = { x: 0, y: 0, visible: false };
  private readonly scratchScreen: ScreenPoint = { x: 0, y: 0, visible: false };
  private readonly textContentCache = new WeakMap<Element, string>();
  private readonly styleValueCache = new WeakMap<Element, Map<string, string>>();
  private readonly placedCache = new WeakMap<Element, PlacedPosition>();

  constructor() {
    injectHudTokens();
    this.ensureLockStyle();
    this.layoutDensity = detectHudLayoutDensity();

    this.container = document.createElement('div');
    this.container.id = 'lock-on-indicator';
    this.setStyleValue(this.container, 'position', 'fixed');
    this.setStyleValue(this.container, 'top', '0');
    this.setStyleValue(this.container, 'left', '0');
    this.setStyleValue(this.container, 'width', '100%');
    this.setStyleValue(this.container, 'height', '100%');
    this.setStyleValue(this.container, 'pointerEvents', 'none');
    this.setStyleValue(this.container, 'zIndex', '40');
    this.setStyleValue(this.container, 'display', 'none');
    this.setStyleValue(this.container, 'overflow', 'hidden');
    this.setStyleValue(this.container, 'contain', 'layout style paint');

    // 准星锚点：机炮十字 + 捕获环 + 提示 + 导弹余量，整体跟随机头轴线的屏幕位置
    // （十字在机炮辅助生效时相对锚点再偏移，见 renderGunCross）
    this.reticle = this.createAnchor('reticle');
    this.ring = document.createElement('div');
    this.ring.className = 'lk-ring';
    this.ring.dataset.lockChrome = 'acquire-ring';
    // 环的几何（空心圆、线宽）写成内联样式，与尺寸一样可以直接从元素上读到；
    // 线型与颜色随锁定状态变化，由样式表决定
    this.setStyleValue(this.ring, 'borderRadius', '50%');
    this.setStyleValue(this.ring, 'borderWidth', '2px');
    this.setStyleValue(this.ring, 'background', 'transparent');
    const cross = document.createElement('div');
    cross.className = 'lk-cross';
    cross.dataset.lockChrome = 'gun-cross';
    for (const part of ['lk-n', 'lk-s', 'lk-w', 'lk-e', 'lk-dot']) {
      const tick = document.createElement('i');
      tick.className = part;
      cross.appendChild(tick);
    }
    // “辅助中”的小菱形（只在十字被拉离机头轴线时显示）
    const assistMark = document.createElement('b');
    assistMark.className = 'lk-assist';
    cross.appendChild(assistMark);
    this.cross = cross;
    // 机头轴线标记：十字被拉走时留在原位，让玩家仍然看得到机头指向
    const noseMark = document.createElement('div');
    noseMark.className = 'lk-nose';
    noseMark.dataset.lockChrome = 'nose-mark';
    this.cue = document.createElement('div');
    this.cue.className = 'lk-cue';
    this.cue.dataset.lockChrome = 'cue';
    this.setStyleValue(this.cue, 'display', 'none');
    // “受干扰”标签：敌方干扰机拖慢锁定期间显示在捕获环内侧上沿
    this.jam = document.createElement('div');
    this.jam.className = 'lk-jam';
    this.jam.dataset.lockChrome = 'jam-tag';
    this.setStyleValue(this.jam, 'display', 'none');
    this.count = document.createElement('div');
    this.count.className = 'lk-count';
    this.count.dataset.lockChrome = 'missile-count';
    this.countLabel = document.createElement('span');
    this.count.appendChild(this.countLabel);
    for (let i = 0; i < GAME_CONSTANTS.MISSILE.MAX_MISSILES; i++) {
      const pip = document.createElement('b');
      this.count.appendChild(pip);
      this.countPips.push(pip);
    }
    this.reticle.append(this.ring, noseMark, cross, this.cue, this.jam, this.count);

    // 目标锚点：角标 + 进度弧 + “锁定 / 距离”标签
    this.targetAnchor = this.createAnchor('target');
    this.targetBox = document.createElement('div');
    this.targetBox.className = 'lk-box';
    for (const corner of ['lk-tl', 'lk-tr', 'lk-bl', 'lk-br']) {
      const mark = document.createElement('i');
      mark.className = corner;
      this.targetBox.appendChild(mark);
    }
    this.targetArc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.targetArc.setAttribute('viewBox', '0 0 100 100');
    this.targetArc.setAttribute('class', 'lk-arc');
    this.targetArcStroke = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.targetArcStroke.setAttribute('cx', '50');
    this.targetArcStroke.setAttribute('cy', '50');
    this.targetArcStroke.setAttribute('r', String(ARC_RADIUS));
    this.targetArcStroke.setAttribute('fill', 'none');
    this.targetArcStroke.setAttribute('stroke', 'currentColor');
    this.targetArcStroke.setAttribute('stroke-width', '3');
    this.targetArcStroke.setAttribute('stroke-linecap', 'round');
    this.targetArcStroke.setAttribute('stroke-dasharray', String(ARC_CIRCUMFERENCE));
    this.targetArcStroke.setAttribute('stroke-dashoffset', String(ARC_CIRCUMFERENCE));
    this.targetArc.appendChild(this.targetArcStroke);
    this.targetLabel = document.createElement('div');
    this.targetLabel.className = 'lk-label';
    this.targetLabelTag = document.createElement('span');
    this.targetLabelTag.className = 'lk-label-tag';
    this.targetLabelRange = document.createElement('span');
    this.targetLabelRange.className = 'lk-label-range';
    this.targetLabel.append(this.targetLabelTag, this.targetLabelRange);
    this.targetAnchor.append(this.targetArc, this.targetBox, this.targetLabel);

    // 机炮提前量标记
    this.leadAnchor = this.createAnchor('lead');
    const leadPip = document.createElement('div');
    leadPip.className = 'lk-lead-pip';
    this.leadAnchor.appendChild(leadPip);

    this.container.append(this.reticle, this.targetAnchor, this.leadAnchor);
    this.applyState('search');
    this.renderStaticText();

    this.resizeHandler = () => {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
      this.updateRingSize();
    };
  }

  public init(): void {
    if (this.initialized) {
      return;
    }

    document.body.appendChild(this.container);
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.updateRingSize();
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
    this.unsubscribeLocale = onLocaleChange(() => this.renderStaticText());
    // 指示器在开始菜单阶段就已创建：之后（init 之前）切换过语言时，固定文案按当前语言补写
    this.renderStaticText();
    this.initialized = true;
  }

  public setLayoutDensity(density: HudLayoutDensity): void {
    this.layoutDensity = density;
    this.updateRingSize();
  }

  public getLayoutDensity(): HudLayoutDensity {
    return this.layoutDensity;
  }

  public getLockState(): LockOnState {
    return this.lockState;
  }

  /** 暂停时收起全部瞄准显示（导引头状态保留） */
  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.setStyleValue(this.container, 'display', 'none');
    }
  }

  /** 导引头本体：事件（acquired / locked / lost）与目标状态 */
  public getSeeker(): MissileSeeker {
    return this.seeker;
  }

  /** 已完成锁定的目标；未锁定时为 null */
  public getCurrentTarget(): Object3D | null {
    return this.seeker.getLockedTarget();
  }

  /** 正在跟踪（锁定中或已锁定）的目标 */
  public getTrackedTarget(): Object3D | null {
    return this.seeker.getTarget();
  }

  public isLocked(): boolean {
    return this.seeker.isLocked();
  }

  /** 锁定进度 (0-1) */
  public getLockProgress(): number {
    return this.seeker.getProgress();
  }

  /** 最近一个渲染帧的准星屏幕位置（像素）：机头轴线，也是捕获环的圆心 */
  public getAimScreen(): Readonly<ScreenPoint> {
    return this.renderAim;
  }

  /** 最近一个渲染帧的机炮十字屏幕位置（像素）：没有辅助偏移时与 getAimScreen 相同 */
  public getGunCrossScreen(): Readonly<ScreenPoint> {
    return this.renderCross;
  }

  /** 机炮十字是否正显示成“辅助中”（被机炮辅助拉离了机头轴线） */
  public isGunCrossAssisted(): boolean {
    return this.crossAssisted && this.renderCross.visible;
  }

  /** 捕获环半径（像素） */
  public getAcquireRadius(): number {
    return this.acquireRadius;
  }

  /** 保持环半径（像素） */
  public getKeepRadius(): number {
    return this.acquireRadius * GAME_CONSTANTS.MISSILE.LOCK_KEEP_RATIO;
  }

  /**
   * 设置锁定时间
   * @param time 锁定时间（秒）
   */
  public setLockTime(time: number): void {
    this.seeker.setLockTime(time);
  }

  /** 接入导引头的干扰来源（敌方干扰机）；传 null 断开 */
  public setLockJamProvider(provider: ILockJamProvider | null): void {
    this.seeker.setJamProvider(provider);
    this.applyJammed(this.seeker.isJammed());
  }

  /** 是否正显示“受干扰”标签 */
  public isJammed(): boolean {
    return this.jammed;
  }

  private applyJammed(jammed: boolean): void {
    if (this.jammed === jammed) return;
    this.jammed = jammed;
    this.setStyleValue(this.jam, 'display', jammed ? 'block' : 'none');
    this.setAttr(this.container, 'data-jammed', jammed ? 'true' : 'false');
  }

  /**
   * 设置捕获环尺寸倍率（锁定范围升级）
   * @param scale 倍率，最小 1.0，最大 2.0
   */
  public setLockCircleScale(scale: number): void {
    this.lockCircleScale = Math.max(1, Math.min(2, Number.isFinite(scale) ? scale : 1));
    this.updateRingSize();
  }

  /** 放弃当前跟踪 / 锁定（阵亡、复活、剧情冻结）：不触发丢锁提示 */
  public cancelLockOn(): void {
    this.seeker.reset();
    this.breakUntilMs = 0;
    this.cueUntilMs = 0;
    this.cueKind = null;
    this.setStyleValue(this.cue, 'display', 'none');
    this.refreshState();
  }

  /** 在准星下方短暂显示“未锁定 / 无导弹” */
  public showCue(kind: LockOnCue): void {
    this.cueKind = kind;
    this.cueUntilMs = performance.now() + CUE_DURATION_MS;
    this.setTextContent(this.cue, tr(kind === 'no-missile' ? TXT_NO_MISSILE : TXT_NO_LOCK));
    this.cue.setAttribute('data-cue', kind);
    // 立即显示；到时后由 renderUpdate 收起
    this.setStyleValue(this.cue, 'display', 'block');
  }

  /** 导弹余量（准星旁的读数与“无导弹”状态） */
  public setMissileCount(count: number): void {
    this.missileCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
    this.renderMissileCount();
    if (this.missileCount <= 0 && this.seeker.getTarget()) {
      this.seeker.reset();
    }
    this.refreshState();
  }

  /**
   * 模拟步：推进导引头（没有导弹时导引头关闭，见 setMissileCount）。
   * @param candidates 本步全部可锁定对象（完整列表：不在表里的目标立即丢弃）
   * @param playerQuaternion 载机姿态，准星取机头轴线；传 null 时以相机视线（视口中心）为准星
   * @returns 是否已完成锁定
   */
  public update(
    playerPosition: Vector3,
    candidates: readonly Object3D[],
    camera: Camera,
    deltaTime: number,
    playerQuaternion: Quaternion | null
  ): boolean {
    this.init();
    // 干扰标签跟着效果走：没有导弹（导引头关闭）时也照常显示 / 收起
    this.applyJammed(this.seeker.isJammed());
    if (this.missileCount <= 0) {
      return false;
    }

    if (playerQuaternion) {
      this.computeAim(playerPosition, playerQuaternion, camera, this.simAim);
    } else {
      this.simAim.x = this.viewportWidth / 2;
      this.simAim.y = this.viewportHeight / 2;
      this.simAim.visible = true;
    }
    this.seeker.setViewport(this.viewportWidth, this.viewportHeight);
    this.seeker.update(deltaTime, playerPosition, this.simAim, candidates, camera);
    if (this.seeker.events.lost) {
      this.breakUntilMs = performance.now() + BREAK_TREATMENT_MS;
    } else if (this.seeker.events.acquired) {
      this.breakUntilMs = 0;
    }
    this.refreshState();
    return this.seeker.isLocked();
  }

  /**
   * 渲染帧：把准星、目标角标、提前量标记放到当前相机下的屏幕位置。
   * 在相机更新之后、插值后的可视状态仍然生效时调用。
   * @param visible 玩家存活且在飞行（菜单 / 剧情冻结 / 暂停 / 等待复活时为 false）
   * @param leadPoint 机炮提前量点的世界坐标；没有可靠解时传 null
   * @param leadOnTarget 机头是否已压在提前量点上
   * @param gunAimDirection 机炮辅助下子弹的发射方向（世界坐标单位向量）；机炮十字画在这个方向上。
   *   没有辅助偏移时传 null，十字就在机头轴线上
   * @param gunAimDistance 十字画在该方向上多远处（米）：辅助压住目标时是瞄准点的距离，十字因此
   *   在两种视角下都落在瞄准点上；非正 / 非有限数按准星参考距离处理
   */
  public renderUpdate(
    visible: boolean,
    playerPosition: Vector3,
    playerQuaternion: Quaternion,
    camera: Camera,
    leadPoint: Vector3 | null,
    leadOnTarget: boolean,
    gunAimDirection: Vector3 | null = null,
    gunAimDistance: number = AIM_DISTANCE
  ): void {
    if (!visible || this.paused) {
      this.setStyleValue(this.container, 'display', 'none');
      this.renderAim.visible = false;
      this.renderCross.visible = false;
      return;
    }
    this.init();
    this.setStyleValue(this.container, 'display', 'block');

    const now = performance.now();
    this.refreshState(now);

    // 准星 + 捕获环
    const aim = this.renderAim;
    this.computeAim(playerPosition, playerQuaternion, camera, aim);
    const aimOnScreen = aim.visible && this.isNearViewport(aim.x, aim.y);
    if (aimOnScreen) {
      this.place(this.reticle, aim.x, aim.y);
    }
    this.setStyleValue(this.reticle, 'visibility', aimOnScreen ? 'visible' : 'hidden');
    this.renderGunCross(aimOnScreen, playerPosition, camera, gunAimDirection, gunAimDistance);

    if (this.cueKind !== null) {
      if (now < this.cueUntilMs) {
        this.setStyleValue(this.cue, 'display', 'block');
      } else {
        this.cueKind = null;
        this.setStyleValue(this.cue, 'display', 'none');
      }
    }

    this.renderTarget(camera);

    // 机炮提前量标记
    let leadShown = false;
    if (leadPoint) {
      const screen = this.scratchScreen;
      if (
        projectToScreen(leadPoint, camera, this.viewportWidth, this.viewportHeight, screen) &&
        this.isNearViewport(screen.x, screen.y)
      ) {
        this.place(this.leadAnchor, screen.x, screen.y);
        leadShown = true;
      }
    }
    this.setStyleValue(this.leadAnchor, 'visibility', leadShown ? 'visible' : 'hidden');
    if (leadShown) {
      this.setAttr(this.leadAnchor, 'data-on', leadOnTarget ? 'true' : 'false');
    }
  }

  /**
   * 机炮十字：没有辅助方向时就在机头轴线上（与捕获环同心，样子不变）；有辅助方向时画在该方向
   * 前方 distance 米处，并在偏移看得出来时换成“辅助中”的样子（机头位置留暗标记）。
   * 只移动十字：准星锚点、捕获环、提示和导引头用的准星位置都留在机头轴线上。
   */
  private renderGunCross(
    aimOnScreen: boolean,
    playerPosition: Vector3,
    camera: Camera,
    direction: Vector3 | null,
    distance: number
  ): void {
    const aim = this.renderAim;
    let shiftX = 0;
    let shiftY = 0;
    let shown = aimOnScreen;
    if (aimOnScreen && direction) {
      const reach = Number.isFinite(distance) && distance > 0 ? distance : AIM_DISTANCE;
      const point = this.aimWorld.copy(direction).multiplyScalar(reach).add(playerPosition);
      // 方向含 NaN / Infinity：按没有辅助处理（PlayerSystem 同样回落到机头方向）
      if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) {
        const screen = this.scratchScreen;
        if (
          projectToScreen(point, camera, this.viewportWidth, this.viewportHeight, screen) &&
          this.isNearViewport(screen.x, screen.y)
        ) {
          shiftX = screen.x - aim.x;
          shiftY = screen.y - aim.y;
        } else {
          // 辅助方向落在相机后方 / 视口之外：不画十字（画在机头上会指错弹道）
          shown = false;
        }
      }
    }

    const shift = Math.sqrt(shiftX * shiftX + shiftY * shiftY);
    const assisted =
      shown && shift >= (this.crossAssisted ? CROSS_ASSIST_OFF_PX : CROSS_ASSIST_ON_PX);
    this.crossAssisted = assisted;
    this.setAttr(this.reticle, 'data-gun-assist', assisted ? 'true' : 'false');
    // '' = 跟随准星锚点的可见性（锚点隐藏时不能单独显示出来）
    this.setStyleValue(this.cross, 'visibility', shown ? '' : 'hidden');
    if (shown) {
      this.shiftCross(shiftX, shiftY);
    }

    const cross = this.renderCross;
    cross.x = aim.x + shiftX;
    cross.y = aim.y + shiftY;
    cross.visible = shown;
  }

  /** 十字相对准星锚点的偏移；变化不足 0.25 像素时不改写样式，回到原位时去掉 transform */
  private shiftCross(x: number, y: number): void {
    const settled = Math.abs(this.crossShiftX - x) < 0.25 && Math.abs(this.crossShiftY - y) < 0.25;
    // 回到原位的最后一小段必须写到 0，否则十字会停在离机头轴线不到 0.25 像素的地方
    const returning = x === 0 && y === 0 && (this.crossShiftX !== 0 || this.crossShiftY !== 0);
    if (settled && !returning) {
      return;
    }
    this.crossShiftX = x;
    this.crossShiftY = y;
    this.cross.style.transform =
      x === 0 && y === 0 ? '' : `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  /** 目标角标：跟踪时随进度收紧并画进度弧；锁定后固定在最小尺寸并显示标签；丢锁时原地变红 */
  private renderTarget(camera: Camera): void {
    const target = this.lockState === 'dry' ? null : this.seeker.getTarget();
    if (!target) {
      // 丢锁提示期间角标留在最后的位置（颜色由 data-lock-state="break" 决定）
      const showBreak = this.lockState === 'break' && this.placedCache.has(this.targetAnchor);
      this.setStyleValue(this.targetAnchor, 'visibility', showBreak ? 'visible' : 'hidden');
      return;
    }

    target.getWorldPosition(this.worldPosition);
    const screen = this.scratchScreen;
    if (
      !projectToScreen(
        this.worldPosition,
        camera,
        this.viewportWidth,
        this.viewportHeight,
        screen
      ) ||
      !this.isNearViewport(screen.x, screen.y)
    ) {
      this.setStyleValue(this.targetAnchor, 'visibility', 'hidden');
      return;
    }

    this.place(this.targetAnchor, screen.x, screen.y);
    this.setStyleValue(this.targetAnchor, 'visibility', 'visible');

    const locked = this.seeker.isLocked();
    const progress = locked ? 1 : this.seeker.getProgress();
    const boxSize = Math.round(this.boxMax - (this.boxMax - this.boxMin) * progress);
    if (boxSize !== this.shownBoxSize) {
      this.shownBoxSize = boxSize;
      const sizePx = `${boxSize}px`;
      this.setStyleValue(this.targetBox, 'width', sizePx);
      this.setStyleValue(this.targetBox, 'height', sizePx);
    }

    const arcOffset = Math.round(ARC_CIRCUMFERENCE * (1 - progress));
    if (arcOffset !== this.shownArcOffset) {
      this.shownArcOffset = arcOffset;
      this.targetArcStroke.style.strokeDashoffset = String(arcOffset);
    }

    const range = Math.round(this.seeker.getTargetRange() / RANGE_STEP) * RANGE_STEP;
    if (range !== this.shownRange) {
      this.shownRange = range;
      this.setTextContent(this.targetLabelRange, `${range} m`);
    }
  }

  /** 机头轴线前方 AIM_DISTANCE 米处的点 → 屏幕像素 */
  private computeAim(
    playerPosition: Vector3,
    playerQuaternion: Quaternion,
    camera: Camera,
    out: ScreenPoint
  ): void {
    this.aimWorld
      .set(0, 0, -1)
      .applyQuaternion(playerQuaternion)
      .multiplyScalar(AIM_DISTANCE)
      .add(playerPosition);
    if (
      !Number.isFinite(this.aimWorld.x) ||
      !Number.isFinite(this.aimWorld.y) ||
      !Number.isFinite(this.aimWorld.z)
    ) {
      out.visible = false;
      return;
    }
    projectToScreen(this.aimWorld, camera, this.viewportWidth, this.viewportHeight, out);
  }

  private isNearViewport(x: number, y: number): boolean {
    return (
      x >= -OFFSCREEN_MARGIN &&
      y >= -OFFSCREEN_MARGIN &&
      x <= this.viewportWidth + OFFSCREEN_MARGIN &&
      y <= this.viewportHeight + OFFSCREEN_MARGIN
    );
  }

  /**
   * 捕获环半径 = 视口短边 × LOCK_RING_RATIO × 升级倍率（所有布局同一规则，触屏不比桌面小），
   * 再夹到 [MIN_ACQUIRE_RADIUS, 短边 × MAX_ACQUIRE_RADIUS_RATIO]。
   */
  private updateRingSize(): void {
    const minSide = Math.max(1, Math.min(this.viewportWidth, this.viewportHeight));
    const raw = minSide * GAME_CONSTANTS.MISSILE.LOCK_RING_RATIO * this.lockCircleScale;
    const radius = Math.max(MIN_ACQUIRE_RADIUS, Math.min(raw, minSide * MAX_ACQUIRE_RADIUS_RATIO));
    this.acquireRadius = radius;
    this.seeker.setAcquireRadius(radius);
    this.seeker.setViewport(this.viewportWidth, this.viewportHeight);

    const diameter = `${Math.round(radius * 2)}px`;
    this.setStyleValue(this.ring, 'width', diameter);
    this.setStyleValue(this.ring, 'height', diameter);

    // “受干扰”标签贴在捕获环内侧上沿
    this.setStyleValue(this.jam, 'top', `${Math.round(6 - radius)}px`);

    // 导弹余量贴在捕获环右下方
    const offset = Math.round(radius * 0.72);
    this.setStyleValue(this.count, 'left', `${offset + 6}px`);
    this.setStyleValue(this.count, 'top', `${offset + 2}px`);

    // 目标角标：按环的大小取尺寸，小屏不至于盖住目标
    this.boxMax = Math.round(Math.max(48, Math.min(84, radius * 0.72)));
    this.boxMin = Math.round(Math.max(30, Math.min(46, radius * 0.4)));
    this.shownBoxSize = -1;
    const arcSize = this.boxMax + 20;
    this.setStyleValue(this.targetArc, 'width', `${arcSize}px`);
    this.setStyleValue(this.targetArc, 'height', `${arcSize}px`);
    this.setStyleValue(this.targetLabel, 'left', `${Math.round(arcSize / 2) + 6}px`);

    // 供 HUD 样式避让（中央播报 / 告警通道）
    if (this.initialized || this.container.parentElement) {
      document.documentElement.style.setProperty('--hud-aim-r', `${Math.round(radius)}px`);
    }
  }

  private refreshState(now: number = performance.now()): void {
    let state: LockOnState;
    if (this.missileCount <= 0) {
      state = 'dry';
    } else if (now < this.breakUntilMs) {
      state = 'break';
    } else if (this.seeker.isLocked()) {
      state = 'lock';
    } else if (this.seeker.getTarget()) {
      state = 'track';
    } else {
      state = 'search';
    }
    this.applyState(state);
  }

  private applyState(state: LockOnState): void {
    this.lockState = state;
    if (this.appliedState === state) {
      return;
    }
    this.appliedState = state;
    this.container.setAttribute('data-lock-state', state);
    this.syncMissileButtonClasses(state);
  }

  /** 只读锁状态映射到 #missile-button：锁定时是醒目的“可以发射”状态。 */
  private syncMissileButtonClasses(state: LockOnState): void {
    const button = document.getElementById('missile-button');
    if (!button) {
      return;
    }

    button.classList.remove(...LockOnIndicator.MISSILE_BUTTON_STATE_CLASSES);
    if (state === 'lock') {
      button.classList.add('is-lock', 'is-ready');
    } else if (state === 'dry') {
      button.classList.add('is-dry');
    } else if (state === 'track') {
      button.classList.add('is-search', 'is-track');
    } else {
      button.classList.add('is-search');
    }
  }

  private renderMissileCount(): void {
    if (this.shownMissileCount === this.missileCount) {
      return;
    }
    this.shownMissileCount = this.missileCount;
    for (let i = 0; i < this.countPips.length; i++) {
      this.countPips[i].className = i < this.missileCount ? 'is-on' : '';
    }
    this.count.setAttribute('data-count', String(this.missileCount));
  }

  /** 语言切换时重绘固定文案 */
  private renderStaticText(): void {
    this.setTextContent(this.countLabel, tr(TXT_MISSILE));
    this.setTextContent(this.targetLabelTag, tr(TXT_LOCK));
    this.setTextContent(this.jam, tr(TXT_JAMMED));
    if (this.cueKind !== null) {
      this.setTextContent(
        this.cue,
        tr(this.cueKind === 'no-missile' ? TXT_NO_MISSILE : TXT_NO_LOCK)
      );
    }
  }

  private createAnchor(kind: string): HTMLDivElement {
    const anchor = document.createElement('div');
    anchor.className = 'lk-anchor';
    anchor.dataset.lockAnchor = kind;
    this.setStyleValue(anchor, 'visibility', 'hidden');
    return anchor;
  }

  /** 用 transform 定位锚点；位置变化不足 0.25 像素时不改写样式 */
  private place(element: HTMLElement, x: number, y: number): void {
    let placed = this.placedCache.get(element);
    if (!placed) {
      placed = { x: Number.NaN, y: Number.NaN };
      this.placedCache.set(element, placed);
    }
    if (Math.abs(placed.x - x) < 0.25 && Math.abs(placed.y - y) < 0.25) {
      return;
    }
    placed.x = x;
    placed.y = y;
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  private setAttr(element: Element, name: string, value: string): void {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  private setTextContent(element: HTMLElement, text: string): void {
    if (this.textContentCache.get(element) === text) {
      return;
    }

    element.textContent = text;
    this.textContentCache.set(element, text);
  }

  private setStyleValue(element: HTMLElement | SVGElement, property: string, value: string): void {
    let cache = this.styleValueCache.get(element);
    if (!cache) {
      cache = new Map<string, string>();
      this.styleValueCache.set(element, cache);
    }

    if (cache.get(property) === value) {
      return;
    }

    const style = element.style as CSSStyleDeclaration & Record<string, string>;
    style[property] = value;
    cache.set(property, value);
  }

  private ensureLockStyle(): void {
    if (document.getElementById(LockOnIndicator.STYLE_ID)) {
      return;
    }

    // HUD_COLORS.lock 的 RGB 分量（HUD_COLORS.lockRgb 是完整的 rgb() 字符串，不能嵌进 rgba()）
    const lockRgb = '92, 255, 176';
    const style = document.createElement('style');
    style.id = LockOnIndicator.STYLE_ID;
    style.textContent = `
      #lock-on-indicator {
        color: var(--hud-weapon, ${HUD_COLORS.weapon});
        font-family: var(--hud-mono, monospace);
      }
      #lock-on-indicator[data-lock-state="lock"] {
        color: var(--hud-lock, ${HUD_COLORS.lock});
      }
      #lock-on-indicator[data-lock-state="break"] {
        color: var(--hud-threat, ${HUD_COLORS.threat});
      }
      #lock-on-indicator .lk-anchor {
        position: absolute;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        will-change: transform;
      }

      /* 机炮十字：颜色不随锁定状态变化 */
      #lock-on-indicator .lk-cross {
        position: absolute;
        left: -15px;
        top: -15px;
        width: 30px;
        height: 30px;
      }
      #lock-on-indicator .lk-cross i {
        position: absolute;
        background: var(--hud-weapon, ${HUD_COLORS.weapon});
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.95);
      }
      #lock-on-indicator .lk-n { left: 14px; top: 0; width: 2px; height: 9px; }
      #lock-on-indicator .lk-s { left: 14px; bottom: 0; width: 2px; height: 9px; }
      #lock-on-indicator .lk-w { left: 0; top: 14px; width: 9px; height: 2px; }
      #lock-on-indicator .lk-e { right: 0; top: 14px; width: 9px; height: 2px; }
      #lock-on-indicator .lk-dot { left: 13px; top: 13px; width: 4px; height: 4px; border-radius: 50%; }

      /* 机炮辅助把十字拉离机头轴线时：十字换成锁定色并套一个小菱形，机头位置留一个暗标记 */
      #lock-on-indicator .lk-cross {
        will-change: transform;
      }
      #lock-on-indicator [data-gun-assist="true"] .lk-cross i {
        background: var(--hud-lock, ${HUD_COLORS.lock});
        box-shadow: 0 0 5px rgba(${lockRgb}, 0.85), 0 0 2px rgba(0, 0, 0, 0.95);
      }
      #lock-on-indicator .lk-assist {
        display: none;
        position: absolute;
        left: 10.5px;
        top: 10.5px;
        width: 9px;
        height: 9px;
        box-sizing: border-box;
        border: 1px solid var(--hud-lock, ${HUD_COLORS.lock});
        transform: rotate(45deg);
      }
      #lock-on-indicator .lk-nose {
        display: none;
        position: absolute;
        left: -4px;
        top: -4px;
        width: 8px;
        height: 8px;
        box-sizing: border-box;
        border: 1px solid var(--hud-weapon, ${HUD_COLORS.weapon});
        border-radius: 50%;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.9);
        opacity: 0.6;
      }
      #lock-on-indicator [data-gun-assist="true"] .lk-assist,
      #lock-on-indicator [data-gun-assist="true"] .lk-nose {
        display: block;
      }

      /* 导引头捕获环 */
      #lock-on-indicator .lk-ring {
        position: absolute;
        left: 0;
        top: 0;
        box-sizing: border-box;
        border-style: dashed;
        border-color: rgba(255, 179, 71, 0.5);
        transform: translate(-50%, -50%);
      }
      #lock-on-indicator[data-lock-state="track"] .lk-ring {
        border-color: var(--hud-weapon, ${HUD_COLORS.weapon});
      }
      #lock-on-indicator[data-lock-state="lock"] .lk-ring {
        border-style: solid;
        border-color: var(--hud-lock, ${HUD_COLORS.lock});
        box-shadow: 0 0 12px rgba(${lockRgb}, 0.45), inset 0 0 12px rgba(${lockRgb}, 0.18);
      }
      #lock-on-indicator[data-lock-state="break"] .lk-ring {
        border-style: solid;
        border-color: var(--hud-threat, ${HUD_COLORS.threat});
        box-shadow: 0 0 12px rgba(255, 77, 77, 0.5);
      }
      #lock-on-indicator[data-lock-state="dry"] .lk-ring {
        border-color: rgba(255, 77, 77, 0.3);
      }

      /* 准星下方的提示 */
      #lock-on-indicator .lk-cue {
        position: absolute;
        left: 0;
        top: 24px;
        transform: translateX(-50%);
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(8, 14, 24, 0.6);
        color: var(--hud-threat, ${HUD_COLORS.threat});
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.16em;
        white-space: nowrap;
      }

      /* “受干扰”标签（捕获环内侧上沿）：紫色只用于电子干扰 */
      #lock-on-indicator .lk-jam {
        position: absolute;
        left: 0;
        transform: translateX(-50%);
        padding: 1px 7px;
        border-radius: 4px;
        background: rgba(8, 14, 24, 0.6);
        color: #cfa6ff;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
      }

      /* 准星旁的导弹余量 */
      #lock-on-indicator .lk-count {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 3px;
        color: var(--hud-weapon, ${HUD_COLORS.weapon});
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
      }
      #lock-on-indicator .lk-count span {
        margin-right: 2px;
      }
      #lock-on-indicator .lk-count b {
        width: 4px;
        height: 9px;
        box-sizing: border-box;
        border: 1px solid currentColor;
        border-radius: 1px;
        opacity: 0.45;
      }
      #lock-on-indicator .lk-count b.is-on {
        background: currentColor;
        opacity: 1;
      }
      #lock-on-indicator[data-lock-state="dry"] .lk-count {
        color: var(--hud-threat, ${HUD_COLORS.threat});
      }

      /* 目标角标 + 进度弧 + 标签 */
      #lock-on-indicator .lk-box {
        position: absolute;
        left: 0;
        top: 0;
        width: 64px;
        height: 64px;
        transform: translate(-50%, -50%);
      }
      #lock-on-indicator .lk-box i {
        position: absolute;
        width: 12px;
        height: 12px;
        box-sizing: border-box;
        border: 2px solid currentColor;
        filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
      }
      #lock-on-indicator .lk-tl { left: 0; top: 0; border-right: none; border-bottom: none; }
      #lock-on-indicator .lk-tr { right: 0; top: 0; border-left: none; border-bottom: none; }
      #lock-on-indicator .lk-bl { left: 0; bottom: 0; border-right: none; border-top: none; }
      #lock-on-indicator .lk-br { right: 0; bottom: 0; border-left: none; border-top: none; }
      #lock-on-indicator[data-lock-state="lock"] .lk-box i {
        border-width: 3px;
        filter: drop-shadow(0 0 5px rgba(${lockRgb}, 0.9));
      }
      #lock-on-indicator .lk-arc {
        position: absolute;
        left: 0;
        top: 0;
        overflow: visible;
        transform: translate(-50%, -50%) rotate(-90deg);
        filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
      }
      #lock-on-indicator[data-lock-state="lock"] .lk-arc,
      #lock-on-indicator[data-lock-state="break"] .lk-arc {
        display: none;
      }
      #lock-on-indicator .lk-label {
        position: absolute;
        top: -8px;
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: 0.1em;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
      }
      #lock-on-indicator .lk-label-tag {
        display: none;
        font-size: 13px;
        letter-spacing: 0.16em;
      }
      #lock-on-indicator[data-lock-state="lock"] .lk-label-tag {
        display: block;
      }
      #lock-on-indicator[data-lock-state="break"] .lk-label {
        display: none;
      }

      /* 机炮提前量标记 */
      #lock-on-indicator .lk-lead-pip {
        position: absolute;
        left: -7px;
        top: -7px;
        width: 14px;
        height: 14px;
        box-sizing: border-box;
        border: 2px solid var(--hud-sys, ${HUD_COLORS.sys});
        border-radius: 50%;
        box-shadow: 0 0 3px rgba(0, 0, 0, 0.95);
      }
      #lock-on-indicator .lk-lead-pip::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 2px;
        margin: -1px 0 0 -1px;
        border-radius: 50%;
        background: var(--hud-sys, ${HUD_COLORS.sys});
      }
      #lock-on-indicator [data-on="true"] .lk-lead-pip {
        border-color: var(--hud-lock, ${HUD_COLORS.lock});
        background: rgba(${lockRgb}, 0.35);
        box-shadow: 0 0 8px var(--hud-lock, ${HUD_COLORS.lock});
        transform: scale(1.25);
      }
      #lock-on-indicator [data-on="true"] .lk-lead-pip::after {
        background: var(--hud-lock, ${HUD_COLORS.lock});
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 清除
   */
  public dispose(): void {
    if (this.initialized) {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
      document.documentElement.style.removeProperty('--hud-aim-r');
    }
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = null;
    if (this.container.parentElement) {
      this.container.remove();
    }
    document
      .getElementById('missile-button')
      ?.classList.remove(...LockOnIndicator.MISSILE_BUTTON_STATE_CLASSES);
    this.appliedState = null;
    this.initialized = false;
  }
}
