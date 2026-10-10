import { GAME_CONSTANTS, GameConfig } from '@/config';
import { SPECIAL_WEAPON_IDS } from '@/core/CombatContracts';
import { SPECIAL_WEAPON_CONFIGS } from '@/features/weapons/WeaponTypes';
import { onLocaleChange, tr, type LocalizedText, type TextParams } from '@/i18n';
import { injectHudExtrasStyles } from '@/ui/theme/hudExtrasStyles';
import {
  GLYPH_CAMERA,
  GLYPH_LOCK,
  GLYPH_MISSILE,
  GLYPH_SAVE,
  GLYPH_WARNING,
} from '@/ui/theme/hudGlyphs';
import {
  HUD_COLORS,
  detectHudLayoutDensity,
  injectHudTokens,
  type HudLayoutDensity,
} from '@/ui/theme/hudTokens';

type BigMessageVariant = 'announcement' | 'powerup';
type EventObjectiveTone = 'default' | 'complete';

/*
 * HUD 文案。逐帧更新路径（得分 / 速度 / 武器面板 / 波次行）用到的双语对象提升为模块常量，
 * 取值只是挑字段，不分配对象；带数字的行按“标签 + 数字”拼接（两种语言语序相同）。
 */
const TXT_SCORE: LocalizedText = { en: 'SCORE', zh: '得分' };
const TXT_SPEED: LocalizedText = { en: 'SPEED', zh: '速度' };
const TXT_ENEMIES: LocalizedText = { en: 'ENEMIES', zh: '敌人' };
const TXT_REMAINING: LocalizedText = { en: 'LEFT', zh: '剩余' };
const TXT_UPGRADE_POINTS: LocalizedText = { en: 'Upgrades', zh: '升级点' };
const TXT_UPGRADE_KEY_HINT: LocalizedText = { en: 'press U', zh: '按 U 打开' };
const TXT_LAMP_HOT: LocalizedText = { en: 'HOT', zh: '过热' };
const TXT_LAMP_READY: LocalizedText = { en: 'READY', zh: '就绪' };
const TXT_OVERHEAT_COOLING: LocalizedText = { en: 'Overheated · cooling', zh: '过热冷却中' };
const TXT_HEAT: LocalizedText = { en: 'Heat', zh: '热量' };
const TXT_CHARGED: LocalizedText = { en: 'Charged · release', zh: '蓄满，松开发射' };
const TXT_CHARGE: LocalizedText = { en: 'Charge', zh: '蓄能' };
const TXT_RELOAD: LocalizedText = { en: 'Reload', zh: '装填' };
const TXT_RECHARGING: LocalizedText = { en: 'Recharging', zh: '充能中' };
const TXT_MISSION_FAILED: LocalizedText = { en: 'MISSION FAILED', zh: '任务失败' };
const TXT_MISSION_COMPLETE: LocalizedText = { en: 'MISSION COMPLETE', zh: '任务完成' };
const TXT_PLAY_AGAIN: LocalizedText = { en: 'Play Again', zh: '再来一局' };
const TXT_RETRY_CHECKPOINT: LocalizedText = { en: 'Retry from checkpoint', zh: '从检查点重试' };
const TXT_MAIN_MENU: LocalizedText = { en: 'Main Menu', zh: '返回菜单' };
const TXT_COOLDOWN: LocalizedText = { en: 'Cooling down', zh: '冷却中' };
const TXT_HOLD_F_BEAM: LocalizedText = { en: 'Hold F to fire', zh: '按住 F 照射' };
const TXT_HOLD_BEAM: LocalizedText = { en: 'Hold to fire', zh: '按住照射' };
const TXT_HOLD_F_CHARGE: LocalizedText = { en: 'Hold F to charge', zh: '按住 F 蓄能' };
const TXT_HOLD_CHARGE: LocalizedText = { en: 'Hold to charge', zh: '按住蓄能' };
const TXT_F_PULSE: LocalizedText = { en: 'Press F to pulse', zh: 'F 键释放' };
const TXT_TAP_PULSE: LocalizedText = { en: 'Tap to pulse', zh: '轻触释放' };
const TXT_F_SALVO: LocalizedText = { en: 'Press F to fire', zh: 'F 键齐射' };
const TXT_TAP_SALVO: LocalizedText = { en: 'Tap to fire', zh: '轻触齐射' };
const TXT_DECK_SPECIAL: LocalizedText = { en: 'SPEC', zh: '特武' };
const TXT_STAT_LIVES: LocalizedText = { en: 'LIVES', zh: '生命' };
const TXT_STAT_MISSILES: LocalizedText = { en: 'MSL', zh: '导弹' };
const TXT_FIRST_PERSON: LocalizedText = { en: 'First-person', zh: '第一人称' };
const TXT_THIRD_PERSON: LocalizedText = { en: 'Third-person', zh: '第三人称' };
const TXT_DECK_FIRST_PERSON: LocalizedText = { en: '1ST', zh: '座舱' };
const TXT_DECK_THIRD_PERSON: LocalizedText = { en: '3RD', zh: '机外' };
const TXT_BOSS_PHASE: LocalizedText = { en: 'PHASE', zh: '阶段' };
const TXT_POWER_UP: LocalizedText = { en: 'POWER-UP!', zh: '获得道具！' };

/** 带占位参数的双语文案：{ text: { en: 'Wave {wave}', zh: '第{wave}波' }, params: { wave: 3 } } */
export interface HudTextWithParams {
  readonly text: LocalizedText | string;
  readonly params?: TextParams;
}

/**
 * HUD 可本地化文案：纯字符串原样显示（旧调用方不变）；双语对象或 { text, params } 按当前语言取值，
 * 切换语言时仍在显示的简报卡 / 自动存档提示 / 闪烁告警 / Boss 状态条 / 道具倒计时 / 中央大字提示
 * 按新语言重绘。
 */
export type HudText = string | LocalizedText | HudTextWithParams;

function isLocalizedText(value: unknown): value is LocalizedText {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LocalizedText).en === 'string' &&
    typeof (value as LocalizedText).zh === 'string'
  );
}

/** 按当前语言展开 HudText；无法识别的输入（运行时传错类型）返回空串 */
function resolveHudText(value: HudText | null | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  if ('text' in value) {
    const { text, params } = value;
    return typeof text === 'string' || isLocalizedText(text) ? tr(text, params) : '';
  }
  return isLocalizedText(value) ? tr(value) : '';
}

export type BriefingTone = 'sys' | 'threat';

export interface BriefingRequest {
  kicker: HudText;
  title: HudText;
  line: HudText;
  tone: BriefingTone;
  durationMs: number;
}

export type HudCameraMode = 'third-person' | 'first-person';
/** 敌人计数：'wave' 为“敌人 N · 剩余 M”（本关波次）；'boss' 为 Boss 战，只显示在场的敌方数 */
export type HudEnemyCounterMode = 'wave' | 'boss';
export type HudMissileWarningLevel = 'none' | 'locking' | 'incoming';
export type HudWarningTone = 'threat' | 'sys' | 'ally';
export type HudWeaponMode = 'salvo' | 'beam' | 'charge' | 'pulse';

export interface HudWeaponSlotState {
  icon: string;
  shortCode: string;
  selected: boolean;
  ready: boolean;
}

/** 特殊武器面板状态（与 WeaponSystem.getHudState() 对齐；visible=false 时隐藏面板） */
export interface HudWeaponPanelState {
  visible: boolean;
  icon: string;
  name: string;
  shortCode: string;
  mode: HudWeaponMode | null;
  ammo: number;
  maxAmmo: number;
  /** 0..1，装填下一发的进度；满弹时为 1 */
  reloadProgress: number;
  /** 0..1 */
  heat: number;
  overheated: boolean;
  /** 0..1 */
  charge: number;
  /** 0..1，冷却剩余比例（1 = 刚开火） */
  cooldown: number;
  ready: boolean;
  slots: HudWeaponSlotState[];
}

interface WeaponSlotUi {
  root: HTMLDivElement;
  key: HTMLSpanElement;
  code: HTMLSpanElement;
}

interface WeaponPanelUi {
  panel: HTMLDivElement;
  code: HTMLSpanElement;
  icon: HTMLSpanElement;
  name: HTMLSpanElement;
  lamp: HTMLSpanElement;
  meterFill: HTMLDivElement;
  ammoPipsHost: HTMLSpanElement;
  ammoPips: HTMLSpanElement[];
  ammoText: HTMLSpanElement;
  label: HTMLSpanElement;
  slotsHost: HTMLDivElement;
  slots: WeaponSlotUi[];
}

interface FlareUi {
  section: HTMLDivElement;
  pipsHost: HTMLDivElement;
  pips: HTMLSpanElement[];
  fill: HTMLDivElement;
  count: HTMLSpanElement;
}

interface BossStatusUi {
  root: HTMLDivElement;
  pipsHost: HTMLSpanElement;
  pips: HTMLSpanElement[];
  phase: HTMLSpanElement;
  label: HTMLSpanElement;
}

interface WarningLaneUi {
  lane: HTMLDivElement;
  missile: HTMLDivElement;
  missileGlyph: HTMLSpanElement;
  missileMain: HTMLSpanElement;
  missileHint: HTMLSpanElement;
  flash: HTMLDivElement;
  flashText: HTMLSpanElement;
  edge: HTMLDivElement;
}

/** 触控按键簇（index.html）：HUD 只读写它们的 data-* / 角标，不绑定输入 */
interface TouchDeckRefs {
  special: HTMLElement | null;
  specialMain: HTMLElement | null;
  specialSub: HTMLElement | null;
  flare: HTMLElement | null;
  flareSub: HTMLElement | null;
  cycle: HTMLElement | null;
  cycleSub: HTMLElement | null;
  camera: HTMLElement | null;
  cameraSub: HTMLElement | null;
  /** 导弹键：余量写在 data-count，补给进度写在 --tc-meter（外圈进度环） */
  missile: HTMLElement | null;
}

interface WeaponSlotEntry {
  code: string;
  key: number;
  rank: number;
  selected: boolean;
  ready: boolean;
  locked: boolean;
}

type SettlementActions = {
  onRetry: () => void;
  onExitToMenu: () => void;
};

/**
 * 任务失败且有可用检查点时结算面板的主动作：“从检查点重试”。
 * detail 说明回到哪里（章节 / 波次；可本地化，面板开着时切换语言随之重绘）。
 */
export interface SettlementCheckpointRetry {
  detail: HudText;
  onRetry: () => void;
}

type PendingBigMessage = {
  icon: string;
  name: HudText;
  minDisplayTime: number;
  hideSubtext: boolean;
  variant: BigMessageVariant;
};

/**
 * 游戏界面 (HUD)
 */
export class HUD {
  private static readonly MAX_DISPLAY_LIVES = 5;
  private static readonly UPGRADE_HINT_STYLE_ID = 'hud-upgrade-hint-style';
  private static readonly SETTLEMENT_STYLE_ID = 'hud-settlement-style';
  /** 结算面板淡入（0.5 秒）期间键盘不触发自动获得焦点的主动作 */
  private static readonly SETTLEMENT_KEY_GRACE_MS = 500;
  private static readonly LAYOUT_STYLE_ID = 'hud-layout-style';
  private static readonly TOAST_DEFAULT_MS = 800;
  private initialized: boolean = false;
  private container: HTMLDivElement;
  private leftStatusPanel: HTMLDivElement;
  private leftPrimaryRow: HTMLDivElement;
  private healthBarContainer: HTMLDivElement;
  private healthBarFill!: HTMLDivElement;
  private scoreDisplay: HTMLDivElement;
  private speedDisplay: HTMLDivElement;
  private enemiesDisplay: HTMLDivElement;
  private eventObjectiveDisplay: HTMLDivElement;
  private eventObjectiveTitle: HTMLDivElement;
  private eventObjectiveText: HTMLDivElement;
  private eventObjectiveStatus: HTMLDivElement;
  private eventObjectiveTone: EventObjectiveTone = 'default';
  private eventObjectiveVisible: boolean = false;
  private livesDisplay: HTMLDivElement;
  private missilesDisplay: HTMLDivElement;
  private missileProgressDisplay: HTMLDivElement; // 导弹补给进度条背景
  private missileProgressFill: HTMLDivElement; // 导弹补给进度条填充
  private livesLabel: HTMLSpanElement; // “生命”标签
  private missilesLabel: HTMLSpanElement; // “导弹”标签
  private missileCountDisplay: HTMLSpanElement; // 导弹余量 n/max
  private statusColumn: HTMLDivElement; // 右上状态列
  private topStack: HTMLDivElement; // 顶部中央消息栈
  private topStackObserver: ResizeObserver | null = null;
  private lastTopStackBottom: string = '';
  private powerUpDisplay: HTMLDivElement;
  private powerUpBigDisplay: HTMLDivElement;
  private powerUpBigIcon: HTMLElement;
  private powerUpBigText: HTMLElement;
  private powerUpBigSubtext: HTMLDivElement;
  private gameOverDisplay: HTMLDivElement;
  private gameOverTitle: HTMLDivElement;
  private finalScoreDisplay: HTMLDivElement;
  private settlementPanel: HTMLDivElement;
  private settlementActionsRow: HTMLDivElement;
  private settlementActions: SettlementActions | null = null;
  private upgradePointsDisplay: HTMLDivElement;
  private damageFlashOverlay: HTMLDivElement;
  private briefingDisplay: HTMLDivElement;
  private briefingKicker: HTMLDivElement;
  private briefingTitle: HTMLDivElement;
  private briefingLine: HTMLDivElement;
  private respawnOverlay: HTMLDivElement;
  private respawnLifeReadout: HTMLDivElement;
  private respawnCountdown: HTMLDivElement;

  private powerUpTimer: number = 0;
  private activePowerUpDuration: number = 0; // 道具持续时间
  private powerUpBigTimer: number = 0; // 大字提示显示计时器
  /** 正在显示的大字提示原文（可本地化，语言切换时重绘）与样式；隐藏后清空 */
  private powerUpBigSource: HudText | null = null;
  private powerUpBigVariant: BigMessageVariant = 'announcement';
  private briefingTimer: number = 0;
  private respawnTimer: number = 0;
  private pendingBigMessage: PendingBigMessage | null = null;
  private damageFlashTimer: number = 0;
  private damageFlashDuration: number = 0;
  private damageFlashPeakOpacity: number = 0;
  private lowHealthAlertActive: boolean = false;
  /** 道具名：原文（可本地化，语言切换时重取）与按当前语言取好的文字（逐帧倒计时只读后者） */
  private activePowerUpNameSource: HudText | null = null;
  private activePowerUpName: string = '';
  private activePowerUpIcon: string = '';
  private lastPowerUpRemainingSeconds: number = -1;
  private layoutDensity: HudLayoutDensity = 'desktop';
  private densityExplicit: boolean = false;
  private aliveEnemyCount: number = 0;
  private remainingEnemyCount: number = 0;
  private enemyCounterMode: HudEnemyCounterMode = 'wave';
  private lastLivesFilled: number | null = null;
  private lastMissilesFilled: number | null = null;
  /** 最近一次的导弹余量 / 补给进度：触控按键簇出现或重建后据此重写导弹键 */
  private lastMissileCount: number = 0;
  private lastMissileProgress: number = 0;
  private resizeHandler!: () => void;
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();

  // 语言切换时按最近一次的数值重绘文案
  private unsubscribeLocale: (() => void) | null = null;
  private lastScore: number = 0;
  private lastSpeedKmh: number | null = null;
  private lastUpgradePoints: number = 0;
  private lastWeaponState: HudWeaponPanelState | null = null;
  private finalScoreValue: number | null = null;
  /** 结算面板当前是失败还是通关（语言切换时重写标题） */
  private settlementKind: 'failed' | 'complete' = 'failed';
  /** 失败面板当前提供的检查点重试；null 时主动作是“再来一局” */
  private settlementCheckpoint: SettlementCheckpointRetry | null = null;
  private settlementShownAt: number = 0;
  private retryButton!: HTMLButtonElement;
  private retryTitle!: HTMLSpanElement;
  private retryDetail!: HTMLSpanElement;
  private exitButton!: HTMLButtonElement;
  private flareLabelText: Text | null = null;
  private autosaveTitle: HTMLSpanElement | null = null;
  /** 正在显示的简报原文（可本地化，语言切换时重绘）；隐藏后清空 */
  private briefingSource: Pick<BriefingRequest, 'kicker' | 'title' | 'line'> | null = null;
  /** 正在显示的自动存档标签原文（可本地化，语言切换时重绘） */
  private autosaveLabelSource: HudText | null = null;

  // 战役 HUD（首次使用时才创建）
  private static readonly AUTOSAVE_TOAST_SECONDS = 2.6;
  private static readonly AUTOSAVE_LEAVE_SECONDS = 0.35;
  private static readonly FLASH_WARNING_SECONDS = 2.2;
  private static readonly CAMERA_FLASH_SECONDS = 1.4;
  private static readonly BOSS_PHASE_FLASH_SECONDS = 1.2;
  private static readonly MAX_AMMO_PIPS = 8;
  private static readonly MAX_FLARE_PIPS = 8;
  private static readonly MAX_BOSS_PIPS = 6;
  private storesPanel: HTMLDivElement | null = null;
  private weaponUi: WeaponPanelUi | null = null;
  private flareUi: FlareUi | null = null;
  private autosaveToast: HTMLDivElement | null = null;
  private autosaveLabel: HTMLSpanElement | null = null;
  private cameraChip: HTMLDivElement | null = null;
  private cameraChipLabel: HTMLSpanElement | null = null;
  private bossUi: BossStatusUi | null = null;
  private warningUi: WarningLaneUi | null = null;
  private deckRefs: TouchDeckRefs | null = null;
  private weaponPanelVisible: boolean = false;
  private flaresVisible: boolean = false;
  private deckMode: boolean = false;
  private lastSlotSignature: string = '';
  private lastFlareCount: number = -1;
  private autosaveTimer: number = 0;
  private autosaveLeaving: boolean = false;
  private autosaveSeq: 'a' | 'b' = 'a';
  private cameraMode: HudCameraMode | null = null;
  private cameraFlashTimer: number = 0;
  private bossStatusVisible: boolean = false;
  /** Boss 状态标签原文（可本地化，语言切换时重绘）与当前显示的文字 */
  private bossLabelSource: HudText | null = null;
  private bossLabel: string = '';
  private bossPhaseCurrent: number = 0;
  private bossPhaseTotal: number = 0;
  private bossFlashTimer: number = 0;
  private missileWarningLevel: HudMissileWarningLevel = 'none';
  private flashWarningTimer: number = 0;
  /** 闪烁告警原文（可本地化，语言切换时重绘）与当前显示的文字 */
  private flashWarningSource: HudText | null = null;
  private flashWarningText: string = '';
  private flashWarningTone: HudWarningTone = 'threat';
  private flashSeq: 'a' | 'b' = 'a';

  constructor() {
    injectHudTokens();
    injectHudExtrasStyles();
    this.ensureUpgradeHintStyle();
    this.ensureLayoutStyle();
    this.layoutDensity = detectHudLayoutDensity();
    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.setAttribute('data-layout-density', this.layoutDensity);

    const isMobile = this.layoutDensity !== 'desktop';

    // 容器贴合安全区（刘海 / 圆角 / 横握时的左右挖孔）：内部绝对定位的元件都相对安全区排布；
    // 各元件按布局密度的位置与字号写在 hudExtrasStyles（#hud[data-layout-density]），横竖屏切换即时生效
    this.container.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      left: env(safe-area-inset-left, 0px);
      right: env(safe-area-inset-right, 0px);
      pointer-events: none;
      font-family: var(--hud-font, 'Arial', sans-serif);
      color: var(--hud-text, ${HUD_COLORS.text});
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      z-index: 50;
    `;

    this.healthBarContainer = this.createHealthBar(isMobile);
    this.leftStatusPanel = document.createElement('div');
    this.leftStatusPanel.className = 'hud-cabin';
    this.leftStatusPanel.style.cssText = `
      position: absolute;
      display: flex;
      flex-direction: column;
      width: fit-content;
      max-width: ${this.getCabinMaxWidth()};
      pointer-events: none;
    `;

    this.leftPrimaryRow = document.createElement('div');
    this.leftPrimaryRow.className = 'hud-cabin-primary';
    this.leftPrimaryRow.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: stretch;
    `;

    this.upgradePointsDisplay = document.createElement('div');
    this.upgradePointsDisplay.id = 'hud-upgrades';
    this.upgradePointsDisplay.style.cssText = `
      color: #FFD76A;
      background: linear-gradient(135deg, rgba(38, 31, 16, 0.9), rgba(76, 56, 12, 0.78));
      border: 1px solid rgba(255, 215, 106, 0.45);
      border-radius: 12px;
      letter-spacing: 0.08em;
      font-weight: 700;
      text-shadow: 0 0 10px rgba(255, 215, 106, 0.28);
      box-shadow: inset 0 1px 0 rgba(255, 245, 200, 0.12), 0 10px 20px rgba(0, 0, 0, 0.18);
      display: none;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      width: 100%;
      box-sizing: border-box;
      text-align: left;
    `;
    this.setTextContent(this.upgradePointsDisplay, '⭐ 0');

    this.scoreDisplay = document.createElement('div');
    this.scoreDisplay.id = 'hud-score';
    this.scoreDisplay.style.cssText = `
      display: flex;
      align-items: center;
      border-radius: 14px;
      background: linear-gradient(160deg, rgba(18, 30, 48, 0.88), rgba(10, 14, 22, 0.76));
      border: 1px solid rgba(118, 204, 255, 0.28);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 24px rgba(0, 0, 0, 0.18);
      color: #eef8ff;
      font-weight: 700;
      letter-spacing: 0.05em;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      width: 100%;
      box-sizing: border-box;
      text-align: left;
    `;
    this.renderScore();

    this.speedDisplay = document.createElement('div');
    this.speedDisplay.id = 'hud-speed';
    this.speedDisplay.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: flex-start;
      border-radius: 14px;
      background: linear-gradient(165deg, rgba(17, 22, 34, 0.88), rgba(9, 12, 18, 0.76));
      border: 1px solid rgba(255, 164, 95, 0.26);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 24px rgba(0, 0, 0, 0.18);
      color: #ffd2a6;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-align: left;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      width: 100%;
      box-sizing: border-box;
    `;
    this.renderSpeed();

    // 顶部中央消息栈：Boss 阶段条（竖屏）/ 简报卡 / 事件目标 / 自动存档（竖屏）按顺序纵向排布，互不重叠
    this.topStack = document.createElement('div');
    this.topStack.id = 'hud-top-stack';
    this.topStack.setAttribute('data-hud', 'top-stack');

    // 事件目标（教学 / 波次事件）：标题与进度同一行，正文在下，紧凑占位
    this.eventObjectiveDisplay = document.createElement('div');
    this.eventObjectiveDisplay.id = 'hud-objective';
    this.eventObjectiveDisplay.setAttribute('data-hud', 'objective');
    this.eventObjectiveDisplay.style.cssText = `
      box-sizing: border-box;
      border-radius: 14px;
      background: linear-gradient(160deg, rgba(18, 26, 42, 0.88), rgba(8, 12, 20, 0.76));
      border: 1px solid rgba(132, 210, 255, 0.24);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 24px rgba(0, 0, 0, 0.18);
      display: none;
      pointer-events: none;
      text-align: center;
      text-shadow: none;
      backdrop-filter: blur(8px);
    `;

    const objectiveHead = document.createElement('div');
    objectiveHead.className = 'hud-obj-head';

    this.eventObjectiveTitle = document.createElement('div');
    this.eventObjectiveTitle.className = 'hud-obj-title';
    this.eventObjectiveTitle.style.cssText = `
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #8fe4ff;
      text-transform: uppercase;
    `;
    this.setTextContent(this.eventObjectiveTitle, tr({ en: 'OBJECTIVE', zh: '作战目标' }));

    this.eventObjectiveText = document.createElement('div');
    this.eventObjectiveText.className = 'hud-obj-text';
    this.eventObjectiveText.style.cssText = `
      font-weight: 700;
      color: #f5fbff;
      text-shadow: 0 0 12px rgba(120, 220, 255, 0.16);
      white-space: normal;
      word-break: break-word;
    `;
    this.setTextContent(this.eventObjectiveText, '');

    this.eventObjectiveStatus = document.createElement('div');
    this.eventObjectiveStatus.className = 'hud-obj-status';
    this.eventObjectiveStatus.style.cssText = `
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(183, 231, 255, 0.86);
      text-transform: uppercase;
      white-space: normal;
      word-break: break-word;
      display: none;
    `;
    this.setTextContent(this.eventObjectiveStatus, '');

    objectiveHead.appendChild(this.eventObjectiveTitle);
    objectiveHead.appendChild(this.eventObjectiveStatus);
    this.eventObjectiveDisplay.appendChild(objectiveHead);
    this.eventObjectiveDisplay.appendChild(this.eventObjectiveText);

    this.briefingDisplay = document.createElement('div');
    this.briefingDisplay.id = 'hud-briefing';
    this.briefingDisplay.setAttribute('data-hud', 'briefing');
    this.briefingDisplay.setAttribute('data-briefing', '');
    this.briefingDisplay.setAttribute('data-tone', 'sys');
    this.briefingDisplay.style.cssText = `
      box-sizing: border-box;
      display: none;
      opacity: 0;
      pointer-events: none;
      text-align: center;
      background: var(--hud-glass, ${HUD_COLORS.glass});
      border: 1px solid var(--hud-sys, ${HUD_COLORS.sys});
      border-radius: var(--hud-radius, 12px);
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
      backdrop-filter: blur(12px);
    `;

    const briefingTitleRow = document.createElement('div');
    briefingTitleRow.style.cssText = `
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: center;
      gap: 2px 8px;
      line-height: 1.25;
    `;

    this.briefingKicker = document.createElement('div');
    this.briefingKicker.className = 'hud-brief-kicker';
    this.briefingKicker.style.cssText = `
      font-weight: 700;
      letter-spacing: 0.16em;
      color: var(--hud-sys, ${HUD_COLORS.sys});
      white-space: nowrap;
    `;

    this.briefingTitle = document.createElement('div');
    this.briefingTitle.className = 'hud-brief-title';
    // 英文标题更长：允许换行，不撑破卡片
    this.briefingTitle.style.cssText = `
      min-width: 0;
      font-weight: 700;
      color: var(--hud-text, ${HUD_COLORS.text});
      letter-spacing: 0.04em;
      white-space: normal;
      overflow-wrap: break-word;
    `;

    this.briefingLine = document.createElement('div');
    this.briefingLine.className = 'hud-brief-line';
    this.briefingLine.style.cssText = `
      margin-top: 6px;
      font-weight: 600;
      color: var(--hud-muted, ${HUD_COLORS.muted});
      line-height: 1.35;
      white-space: normal;
      word-break: break-word;
    `;

    briefingTitleRow.appendChild(this.briefingKicker);
    briefingTitleRow.appendChild(this.briefingTitle);
    this.briefingDisplay.appendChild(briefingTitleRow);
    this.briefingDisplay.appendChild(this.briefingLine);
    this.topStack.appendChild(this.briefingDisplay);
    this.topStack.appendChild(this.eventObjectiveDisplay);
    this.container.appendChild(this.topStack);
    this.leftPrimaryRow.appendChild(this.scoreDisplay);
    this.leftPrimaryRow.appendChild(this.speedDisplay);
    this.leftStatusPanel.appendChild(this.leftPrimaryRow);
    this.leftStatusPanel.appendChild(this.upgradePointsDisplay);
    this.container.appendChild(this.leftStatusPanel);

    // 右上状态列：敌机计数 / 生命 / 导弹 / 导弹补给 / 道具倒计时，纵向排布互不重叠
    this.statusColumn = document.createElement('div');
    this.statusColumn.id = 'hud-status';
    this.statusColumn.setAttribute('data-hud', 'status');

    // 敌机计数：与左侧信息栏同款的深色胶囊底，亮云层上也清晰
    this.enemiesDisplay = document.createElement('div');
    this.enemiesDisplay.id = 'hud-wave-line';
    this.enemiesDisplay.setAttribute('data-hud', 'wave-line');
    this.enemiesDisplay.className = 'hud-chip';
    this.renderWaveLine();

    // 生命值显示（几何 pip，非 emoji）
    this.livesDisplay = document.createElement('div');
    this.livesDisplay.id = 'hud-lives';
    this.livesDisplay.setAttribute('data-hud', 'lives');
    this.livesDisplay.className = 'hud-pip-row';
    this.livesDisplay.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
    `;
    this.renderLifePips(HUD.MAX_DISPLAY_LIVES);

    // 导弹数量显示（几何 pip，非 emoji）
    this.missilesDisplay = document.createElement('div');
    this.missilesDisplay.id = 'hud-missiles';
    this.missilesDisplay.setAttribute('data-hud', 'missiles');
    this.missilesDisplay.className = 'hud-pip-row';
    this.missilesDisplay.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
    `;
    this.renderMissilePips(GAME_CONSTANTS.MISSILE.MAX_MISSILES);

    // 导弹补给进度条（导弹读数内，pip 下方）
    this.missileProgressDisplay = document.createElement('div');
    this.missileProgressDisplay.id = 'hud-missile-reload';
    this.missileProgressDisplay.setAttribute('data-hud', 'missile-reload');

    this.missileProgressFill = document.createElement('div');
    this.missileProgressFill.className = 'hud-stat-meter-fill';
    this.missileProgressFill.style.cssText = `
      width: 0%;
      height: 100%;
      transition: width 0.5s ease-out;
    `;
    this.missileProgressDisplay.appendChild(this.missileProgressFill);

    // 带标签的读数：生命 = 标签 + pip；导弹 = 标签 + pip + 余量 n/max + 补给进度
    this.livesLabel = document.createElement('span');
    this.livesLabel.className = 'hud-stat-label';
    this.missilesLabel = document.createElement('span');
    this.missilesLabel.className = 'hud-stat-label';
    this.missileCountDisplay = document.createElement('span');
    this.missileCountDisplay.id = 'hud-missile-count';
    this.missileCountDisplay.className = 'hud-stat-count';
    this.renderStatLabels();

    // 道具倒计时（状态列底部）
    this.powerUpDisplay = document.createElement('div');
    this.powerUpDisplay.id = 'hud-powerup-timer';
    this.powerUpDisplay.className = 'hud-chip hud-chip-powerup';
    this.powerUpDisplay.style.cssText = `
      color: #ffe45c;
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    this.setTextContent(this.powerUpDisplay, '');

    const livesHead = document.createElement('div');
    livesHead.className = 'hud-stat-head';
    livesHead.appendChild(this.livesLabel);
    const livesStat = document.createElement('div');
    livesStat.className = 'hud-stat hud-stat-lives';
    livesStat.setAttribute('data-hud', 'lives-readout');
    livesStat.append(livesHead, this.livesDisplay);

    const missilesHead = document.createElement('div');
    missilesHead.className = 'hud-stat-head';
    missilesHead.append(this.missilesLabel, this.missileCountDisplay);
    const missilesStat = document.createElement('div');
    missilesStat.className = 'hud-stat hud-stat-missiles';
    missilesStat.setAttribute('data-hud', 'missile-readout');
    missilesStat.append(missilesHead, this.missilesDisplay, this.missileProgressDisplay);

    // 生命与导弹读数：桌面 / 横屏上下两行，竖屏并排一行（缩短状态列，给下方消息栈让高度）
    const pipGroup = document.createElement('div');
    pipGroup.className = 'hud-pip-group';
    pipGroup.appendChild(livesStat);
    pipGroup.appendChild(missilesStat);

    this.statusColumn.appendChild(this.enemiesDisplay);
    this.statusColumn.appendChild(pipGroup);
    this.statusColumn.appendChild(this.powerUpDisplay);

    // 中央播报（道具 / 友军 / 教学提示）：横幅位置按视角避让准星与捕获环（见 hudExtrasStyles）
    this.powerUpBigDisplay = document.createElement('div');
    this.powerUpBigDisplay.id = 'hud-callout';
    this.powerUpBigDisplay.setAttribute('data-hud', 'callout');
    this.powerUpBigDisplay.setAttribute('data-variant', 'announcement');
    this.powerUpBigDisplay.setAttribute('data-layout-density', this.layoutDensity);
    this.powerUpBigDisplay.style.cssText = `
      position: fixed;
      z-index: 80;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    const calloutCard = document.createElement('div');
    calloutCard.className = 'hud-callout-card';

    // 道具提示的小标题（“获得道具！”），播报类不显示
    this.powerUpBigSubtext = document.createElement('div');
    this.powerUpBigSubtext.className = 'hud-callout-sub';
    this.powerUpBigSubtext.style.display = 'none';
    this.setTextContent(this.powerUpBigSubtext, '');

    const calloutMain = document.createElement('div');
    calloutMain.className = 'hud-callout-main';
    this.powerUpBigIcon = document.createElement('span');
    this.powerUpBigIcon.className = 'hud-callout-icon';
    this.powerUpBigIcon.setAttribute('aria-hidden', 'true');
    this.powerUpBigText = document.createElement('span');
    this.powerUpBigText.className = 'hud-callout-text';
    calloutMain.appendChild(this.powerUpBigIcon);
    calloutMain.appendChild(this.powerUpBigText);
    calloutCard.appendChild(this.powerUpBigSubtext);
    calloutCard.appendChild(calloutMain);
    this.powerUpBigDisplay.appendChild(calloutCard);

    // 结算覆盖层（失败 / 通关共用）
    this.ensureSettlementStyle();
    this.gameOverDisplay = document.createElement('div');
    this.gameOverDisplay.id = 'hud-settlement-overlay';
    this.gameOverDisplay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.8);
      z-index: 120;
      opacity: 0;
      transition: opacity 0.5s;
      pointer-events: none;
      box-sizing: border-box;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    `;
    this.settlementPanel = document.createElement('div');
    this.settlementPanel.id = 'hud-settlement-panel';
    this.settlementPanel.style.cssText = `
      width: min(360px, calc(100% - 32px));
      max-width: 360px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: var(--hud-glass, ${HUD_COLORS.glass});
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      border-radius: var(--hud-radius, 12px);
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
      padding: 28px 20px;
    `;
    this.gameOverTitle = document.createElement('div');
    this.gameOverTitle.id = 'game-over-title';
    this.gameOverTitle.style.cssText = `
      text-align: center;
      color: #ff3333;
      font-size: ${isMobile ? '48px' : '72px'};
      font-weight: bold;
      text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1);
      margin-bottom: 30px;
      animation: pulse 1s ease-in-out infinite;
    `;
    this.setTextContent(this.gameOverTitle, tr(TXT_MISSION_FAILED));

    this.finalScoreDisplay = document.createElement('div');
    this.finalScoreDisplay.id = 'final-score';
    this.finalScoreDisplay.style.cssText = `
      color: #ffdd00;
      font-size: ${isMobile ? '24px' : '36px'};
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
    `;

    this.settlementActionsRow = document.createElement('div');
    this.settlementActionsRow.id = 'hud-settlement-actions';
    this.settlementActionsRow.style.cssText = `
      display: none;
      flex-direction: row;
      gap: 12px;
      width: 100%;
      margin-top: 28px;
      pointer-events: auto;
    `;
    this.retryButton = this.createSettlementButton('', () => {
      // 有检查点时这个键只做“从检查点重试”（存档原样保留）；否则是原来的“再来一局”
      if (this.settlementCheckpoint) {
        this.settlementCheckpoint.onRetry();
      } else {
        this.settlementActions?.onRetry();
      }
    });
    // 面板一出现这个键就自动获得焦点，而 Space 是开火键：按住不放带来的按键重复、
    // 以及面板刚出现那一瞬间的按键都不算数，免得替玩家点下去
    this.retryButton.addEventListener('keydown', (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') {
        return;
      }
      if (
        event.repeat ||
        performance.now() - this.settlementShownAt < HUD.SETTLEMENT_KEY_GRACE_MS
      ) {
        event.preventDefault();
      }
    });
    this.retryTitle = document.createElement('span');
    this.retryDetail = document.createElement('span');
    this.retryDetail.className = 'hud-settlement-detail';
    this.exitButton = this.createSettlementButton('', () => {
      this.settlementActions?.onExitToMenu();
    });
    this.renderSettlementLabels();
    this.settlementActionsRow.appendChild(this.retryButton);
    this.settlementActionsRow.appendChild(this.exitButton);

    this.settlementPanel.appendChild(this.gameOverTitle);
    this.settlementPanel.appendChild(this.finalScoreDisplay);
    this.settlementPanel.appendChild(this.settlementActionsRow);
    this.gameOverDisplay.appendChild(this.settlementPanel);

    this.respawnOverlay = document.createElement('div');
    this.respawnOverlay.id = 'hud-respawn-overlay';
    this.respawnOverlay.setAttribute('data-hud', 'respawn');
    this.respawnOverlay.setAttribute('data-respawn', '');
    this.respawnOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      display: none;
      opacity: 0;
      pointer-events: none;
      z-index: 90;
      align-items: flex-start;
      justify-content: center;
      padding-top: 18vh;
      box-sizing: border-box;
      background: rgba(4, 8, 14, 0.48);
    `;

    const respawnCard = document.createElement('div');
    respawnCard.style.cssText = `
      width: min(72vw, 280px);
      max-width: min(72vw, 280px);
      box-sizing: border-box;
      text-align: center;
      padding: 20px 18px 18px;
      background: var(--hud-glass, ${HUD_COLORS.glass});
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      border-radius: var(--hud-radius, 12px);
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
      backdrop-filter: blur(10px);
      pointer-events: none;
    `;

    this.respawnLifeReadout = document.createElement('div');
    this.respawnLifeReadout.style.cssText = `
      font-size: ${isMobile ? '28px' : '34px'};
      font-weight: 800;
      letter-spacing: 0.12em;
      color: var(--hud-text, ${HUD_COLORS.text});
      text-shadow: 0 0 16px rgba(143, 228, 255, 0.28), 2px 2px 6px rgba(0, 0, 0, 0.85);
      font-variant-numeric: tabular-nums;
    `;

    this.respawnCountdown = document.createElement('div');
    this.respawnCountdown.style.cssText = `
      margin-top: 10px;
      font-size: ${isMobile ? '18px' : '22px'};
      font-weight: 700;
      letter-spacing: 0.18em;
      color: var(--hud-sys, ${HUD_COLORS.sys});
      font-variant-numeric: tabular-nums;
    `;

    respawnCard.appendChild(this.respawnLifeReadout);
    respawnCard.appendChild(this.respawnCountdown);
    this.respawnOverlay.appendChild(respawnCard);

    this.damageFlashOverlay = document.createElement('div');
    this.damageFlashOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 70;
      opacity: 0;
      background:
        radial-gradient(circle at center, rgba(255, 120, 72, 0) 42%, rgba(255, 96, 54, 0.08) 72%, rgba(255, 54, 36, 0.22) 100%),
        linear-gradient(180deg, rgba(255, 80, 52, 0.18), rgba(255, 80, 52, 0));
      mix-blend-mode: screen;
      transition: opacity 0.06s linear;
    `;

    this.container.appendChild(this.healthBarContainer);
    this.container.appendChild(this.statusColumn);

    this.resizeHandler = () => {
      if (!this.densityExplicit) {
        this.layoutDensity = detectHudLayoutDensity();
      }
      this.applyLayoutDensity();
    };
  }

  public init(): void {
    if (this.initialized) {
      return;
    }

    document.body.appendChild(this.container);
    document.body.appendChild(this.powerUpBigDisplay);
    document.body.appendChild(this.damageFlashOverlay);
    document.body.appendChild(this.respawnOverlay);
    document.body.appendChild(this.gameOverDisplay);
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
    this.unsubscribeLocale ??= onLocaleChange(() => this.refreshLocaleText());
    // HUD 在开始菜单阶段就已创建：之后（init 之前）切换过语言时，得分 / 速度 / 波次行、
    // 状态列标签与结算文案按当前语言补写
    this.renderScore();
    this.renderSpeed();
    this.renderWaveLine();
    this.renderStatLabels();
    this.renderSettlementTitle();
    this.renderSettlementLabels();
    this.applyLayoutDensity();
    this.observeTopStack();
    this.initialized = true;
  }

  private ensureInitialized(): void {
    this.init();
  }

  /**
   * 竖屏时无线电面板排在顶部消息栈下方：栈高变化（简报 / 目标 / Boss 阶段条出现或换行）时
   * 把栈底的视口坐标写到 <html> 的 --hud-stack-bottom（radioStyles 读取）。
   */
  private observeTopStack(): void {
    if (!this.topStackObserver && typeof ResizeObserver !== 'undefined') {
      this.topStackObserver = new ResizeObserver(() => this.syncTopStackBottom());
      this.topStackObserver.observe(this.topStack);
    }
    this.syncTopStackBottom();
  }

  private syncTopStackBottom(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const rect = this.topStack.getBoundingClientRect();
    // HUD 隐藏（display: none）时矩形全为 0：保留上一次的有效位置
    if (rect.width <= 0 && rect.height <= 0 && rect.top <= 0) {
      return;
    }
    const value = `${Math.round(rect.bottom)}px`;
    if (value === this.lastTopStackBottom) {
      return;
    }
    this.lastTopStackBottom = value;
    document.documentElement.style.setProperty('--hud-stack-bottom', value);
  }

  /** 语言切换：按最近一次的状态重绘 HUD 自己的文案（运行时传入的纯字符串标题 / 告警原样保留） */
  private refreshLocaleText(): void {
    this.renderScore();
    this.renderSpeed();
    this.renderWaveLine();
    this.renderStatLabels();
    this.renderUpgradePoints();
    this.renderSettlementTitle();
    this.renderSettlementLabels();
    this.renderFinalScore();
    if (this.lastWeaponState && this.weaponPanelVisible) {
      this.updateWeaponPanel(this.lastWeaponState);
    } else {
      this.syncDeckWeapon(null, '');
    }
    if (this.flareLabelText) {
      this.flareLabelText.data = tr({ en: 'FLARES', zh: '热焰弹' });
    }
    if (this.autosaveTitle) {
      this.autosaveTitle.textContent = tr({ en: 'Autosaved', zh: '已自动保存' });
    }
    // 运行时传入的简报 / 存档标签 / 告警 / Boss 状态 / 道具名 / 大字提示：可本地化的原文按新语言
    // 重绘（纯字符串原样保留）
    if (this.briefingTimer > 0) {
      this.renderBriefingText();
    }
    if (this.powerUpBigSource !== null) {
      this.renderPowerUpBigText();
    }
    if (this.autosaveTimer > 0) {
      this.renderAutosaveLabel();
    }
    if (this.flashWarningTimer > 0) {
      this.renderFlashWarningText();
    }
    if (this.activePowerUpNameSource !== null && this.activePowerUpDuration > 0) {
      this.activePowerUpName = resolveHudText(this.activePowerUpNameSource);
      this.lastPowerUpRemainingSeconds = -1;
      this.updatePowerUpTimerText();
    }
    if (this.cameraMode) {
      this.renderCameraLabels(this.cameraMode);
    }
    if (this.bossStatusVisible && this.bossUi) {
      this.renderBossLabel(this.bossUi, resolveHudText(this.bossLabelSource));
      this.renderBossPhase(this.bossUi, this.bossPhaseCurrent, this.bossPhaseTotal);
    }
    if (this.warningUi && this.missileWarningLevel !== 'none') {
      this.renderMissileWarning(this.warningUi);
    }
  }

  private renderScore(): void {
    this.setTextContent(
      this.scoreDisplay,
      `${tr(TXT_SCORE)} ${this.lastScore.toString().padStart(6, '0')}`
    );
  }

  private renderSpeed(): void {
    const label = tr(TXT_SPEED);
    this.setTextContent(
      this.speedDisplay,
      this.lastSpeedKmh === null
        ? `${label} 000`
        : `${label} ${this.lastSpeedKmh.toString().padStart(3, '0')} km/h`
    );
  }

  private renderSettlementLabels(): void {
    const checkpoint = this.settlementCheckpoint;
    const exit = tr(TXT_MAIN_MENU);
    this.settlementPanel.toggleAttribute('data-checkpoint', checkpoint !== null);
    if (checkpoint) {
      // 两行：动作 + 回到哪里（章节 / 波次）
      this.retryTitle.textContent = tr(TXT_RETRY_CHECKPOINT);
      this.retryDetail.textContent = resolveHudText(checkpoint.detail);
      if (this.retryTitle.parentNode !== this.retryButton) {
        this.retryButton.textContent = '';
        this.retryButton.append(this.retryTitle, this.retryDetail);
      }
    } else {
      const retry = tr(TXT_PLAY_AGAIN);
      if (this.retryButton.textContent !== retry) {
        this.retryButton.textContent = retry;
      }
    }
    if (this.exitButton.textContent !== exit) {
      this.exitButton.textContent = exit;
    }
  }

  private renderSettlementTitle(): void {
    this.setTextContent(
      this.gameOverTitle,
      tr(this.settlementKind === 'complete' ? TXT_MISSION_COMPLETE : TXT_MISSION_FAILED)
    );
  }

  private renderFinalScore(): void {
    if (this.finalScoreValue === null) {
      return;
    }
    this.setTextContent(
      this.finalScoreDisplay,
      tr({ en: 'Final score: {score}', zh: '最终得分: {score}' }, { score: this.finalScoreValue })
    );
  }

  /**
   * 创建生命值条（紧凑设计）
   */
  private createHealthBar(isMobile: boolean): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'hud-health';
    container.setAttribute('data-hud', 'health');
    const barWidth = isMobile ? '180px' : '250px';
    const barHeight = isMobile ? '20px' : '25px';

    container.style.cssText = `
      box-sizing: border-box;
      position: absolute;
      top: ${isMobile ? '10px' : '15px'};
      left: 50%;
      transform: translateX(-50%);
      width: ${barWidth};
      height: ${barHeight};
      background: rgba(0, 0, 0, 0.6);
      border-radius: ${isMobile ? '10px' : '12px'};
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    `;

    this.healthBarFill = document.createElement('div');
    this.healthBarFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, ${HUD_COLORS.lock}, ${HUD_COLORS.sys});
      transition: width 0.3s, background 0.3s;
    `;

    container.appendChild(this.healthBarFill);
    return container;
  }

  private setTextContent(element: HTMLElement, text: string): void {
    if (this.textContentCache.get(element) === text) {
      return;
    }

    element.textContent = text;
    this.textContentCache.set(element, text);
  }

  private setStyleValue(element: HTMLElement, property: string, value: string): void {
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

  /**
   * 绑定结算按钮回调（再来一局 / 返回菜单）
   */
  public setSettlementActions(actions: { onRetry: () => void; onExitToMenu: () => void }): void {
    this.settlementActions = {
      onRetry: actions.onRetry,
      onExitToMenu: actions.onExitToMenu,
    };
  }

  private createSettlementButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = `
      flex: 1;
      min-height: 48px;
      pointer-events: auto;
      cursor: pointer;
      border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      border-radius: var(--hud-radius, 12px);
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--hud-text, ${HUD_COLORS.text});
      background: var(--hud-glass, ${HUD_COLORS.glass});
      box-shadow: var(--hud-shadow, ${HUD_COLORS.shadow});
      backdrop-filter: blur(10px);
    `;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private ensureSettlementStyle(): void {
    if (document.getElementById(HUD.SETTLEMENT_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = HUD.SETTLEMENT_STYLE_ID;
    style.textContent = `
      #hud-settlement-overlay {
        z-index: 120;
        box-sizing: border-box;
        padding: env(safe-area-inset-top) env(safe-area-inset-right)
          env(safe-area-inset-bottom) env(safe-area-inset-left);
      }

      #hud-settlement-panel {
        width: min(360px, calc(100% - 32px));
        max-width: 360px;
        box-sizing: border-box;
      }

      #hud-settlement-actions {
        pointer-events: auto;
      }

      #hud-settlement-actions button {
        min-height: 48px;
        pointer-events: auto;
      }

      #hud-settlement-actions button:focus-visible {
        outline: 2px solid var(--hud-sys, ${HUD_COLORS.sys});
        outline-offset: 3px;
      }

      /*
       * 有检查点：“从检查点重试”是主动作，独占一行并加亮；“返回菜单”在它下面。
       * 行和按钮的基础样式写在行内，这里要盖过它们的几项带 !important
       */
      #hud-settlement-panel[data-checkpoint] #hud-settlement-actions {
        flex-direction: column !important;
      }

      #hud-settlement-panel[data-checkpoint] #hud-settlement-actions button:first-child {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border-color: var(--hud-sys, ${HUD_COLORS.sys}) !important;
        box-shadow: 0 0 16px rgba(143, 228, 255, 0.28), var(--hud-shadow, ${HUD_COLORS.shadow}) !important;
      }

      .hud-settlement-detail {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--hud-muted, ${HUD_COLORS.muted});
      }

      /* 手机横屏：两个按钮上下排比原来高一截，收紧留白，面板才不会顶到屏幕上下边 */
      @media (max-height: 420px) {
        #hud-settlement-panel[data-checkpoint] {
          padding-top: 16px !important;
          padding-bottom: 16px !important;
        }

        #hud-settlement-panel[data-checkpoint] #game-over-title {
          margin-bottom: 14px !important;
        }

        #hud-settlement-panel[data-checkpoint] #hud-settlement-actions {
          margin-top: 16px !important;
        }
      }

      @media (max-width: 480px) {
        #hud-settlement-actions {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private ensureLayoutStyle(): void {
    if (document.getElementById(HUD.LAYOUT_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = HUD.LAYOUT_STYLE_ID;
    style.textContent = `
      #hud[data-layout-density="desktop"] .hud-cabin {
        max-width: min(28vw, 260px);
      }

      #hud[data-layout-density="touch-landscape"] .hud-cabin {
        max-width: min(38vw, 180px);
      }

      #hud[data-layout-density="touch-portrait"] .hud-cabin {
        max-width: min(58vw, 220px);
      }

      .hud-pip {
        display: inline-block;
        width: 8px;
        height: 10px;
        box-sizing: border-box;
        border-radius: 2px;
        border: 1px solid var(--hud-edge, ${HUD_COLORS.edge});
      }

      .hud-life-pip.is-on {
        background: var(--hud-lock, ${HUD_COLORS.lock});
      }

      .hud-life-pip.is-off {
        background: transparent;
      }

      .hud-missile-pip.is-on {
        background: var(--hud-weapon, ${HUD_COLORS.weapon});
      }

      .hud-missile-pip.is-off {
        background: transparent;
      }

      #hud-briefing {
        max-width: min(80vw, 420px);
        width: min(80vw, 420px);
        pointer-events: none;
      }

      #hud-respawn-overlay {
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  private ensureUpgradeHintStyle(): void {
    if (document.getElementById(HUD.UPGRADE_HINT_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = HUD.UPGRADE_HINT_STYLE_ID;
    style.textContent = `
      .hud-upgrade-ready {
        animation: hud-upgrade-pulse 1.9s ease-in-out infinite;
      }

      @keyframes hud-upgrade-pulse {
        0%, 100% {
          box-shadow: 0 0 0 rgba(255, 215, 0, 0);
          border-color: rgba(255, 215, 0, 0.45);
        }
        50% {
          box-shadow: 0 0 14px rgba(255, 215, 0, 0.45);
          border-color: rgba(255, 236, 140, 0.75);
        }
      }
    `;
    document.head.appendChild(style);
  }

  private updatePowerUpTimerText(): void {
    if (!this.activePowerUpName || !this.activePowerUpIcon) {
      return;
    }

    const remainingSeconds = Math.max(0, Math.ceil(this.powerUpTimer));
    if (remainingSeconds === this.lastPowerUpRemainingSeconds) {
      return;
    }

    this.lastPowerUpRemainingSeconds = remainingSeconds;
    this.setTextContent(
      this.powerUpDisplay,
      `${this.activePowerUpIcon} ${this.activePowerUpName} ${remainingSeconds}`
    );
  }

  public updateHealth(percent: number): void {
    this.ensureInitialized();
    const clampedPercent = Math.max(0, Math.min(1, percent));
    this.setStyleValue(this.healthBarFill, 'width', `${clampedPercent * 100}%`);

    let gradient: string;

    if (clampedPercent > 0.6) {
      gradient = `linear-gradient(90deg, ${HUD_COLORS.lock}, ${HUD_COLORS.sys})`;
    } else if (clampedPercent > 0.3) {
      gradient = `linear-gradient(90deg, ${HUD_COLORS.ally}, ${HUD_COLORS.weapon})`;
    } else if (clampedPercent > 0.15) {
      gradient = `linear-gradient(90deg, ${HUD_COLORS.weapon}, ${HUD_COLORS.ally})`;
    } else {
      gradient = `linear-gradient(90deg, ${HUD_COLORS.threat}, #be123c)`;
    }

    this.setStyleValue(this.healthBarFill, 'background', gradient);
    this.lowHealthAlertActive = clampedPercent <= 0.25;
    this.setStyleValue(
      this.healthBarContainer,
      'borderColor',
      this.lowHealthAlertActive ? 'rgba(255, 90, 90, 0.95)' : 'rgba(255,255,255,0.8)'
    );
    this.setStyleValue(
      this.healthBarContainer,
      'boxShadow',
      this.lowHealthAlertActive
        ? '0 0 18px rgba(255, 80, 60, 0.35), inset 0 0 12px rgba(255, 64, 32, 0.18)'
        : 'none'
    );
  }

  /**
   * 更新分数显示
   */
  public updateScore(score: number): void {
    this.ensureInitialized();
    this.lastScore = score;
    this.renderScore();
  }

  /**
   * 更新速度显示
   */
  public updateSpeed(speed: number): void {
    this.ensureInitialized();
    this.lastSpeedKmh = Math.round(speed * 10); // 放大显示
    this.renderSpeed();
  }

  /**
   * 更新敌人数量显示
   */
  public updateEnemies(count: number): void {
    this.ensureInitialized();
    this.aliveEnemyCount = count;
    this.renderWaveLine();
  }

  /**
   * 更新剩余敌人数量显示
   */
  public updateRemainingEnemies(count: number): void {
    this.ensureInitialized();
    this.remainingEnemyCount = count;
    this.renderWaveLine();
  }

  /**
   * 敌人计数的显示方式。'boss'（Boss 战 / Boss 模式）只显示在场的敌方（Boss 召唤的敌机、
   * 无人机与敌方单位），不显示本关波次的“剩余”；'wave' 恢复“敌人 N · 剩余 M”。
   */
  public setEnemyCounterMode(mode: HudEnemyCounterMode): void {
    this.ensureInitialized();
    const next: HudEnemyCounterMode = mode === 'boss' ? 'boss' : 'wave';
    if (next === this.enemyCounterMode) {
      return;
    }
    this.enemyCounterMode = next;
    this.renderWaveLine();
  }

  public showEventObjective(title: string, objective: string, status?: string): void {
    this.ensureInitialized();
    this.applyEventObjectiveTone('default');
    this.setTextContent(this.eventObjectiveTitle, title);
    this.setTextContent(this.eventObjectiveText, objective);
    this.setTextContent(this.eventObjectiveStatus, status ?? '');
    this.setStyleValue(
      this.eventObjectiveStatus,
      'display',
      status && status.length > 0 ? 'block' : 'none'
    );
    this.setStyleValue(this.eventObjectiveDisplay, 'display', 'block');
    this.eventObjectiveVisible = true;
    this.syncAutosaveDeferral();
  }

  public showCompletedEventObjective(title: string, objective: string, status?: string): void {
    this.ensureInitialized();
    this.applyEventObjectiveTone('complete');
    this.setTextContent(this.eventObjectiveTitle, title);
    this.setTextContent(this.eventObjectiveText, objective);
    this.setTextContent(this.eventObjectiveStatus, status ?? '');
    this.setStyleValue(
      this.eventObjectiveStatus,
      'display',
      status && status.length > 0 ? 'block' : 'none'
    );
    this.setStyleValue(this.eventObjectiveDisplay, 'display', 'block');
    this.eventObjectiveVisible = true;
    this.syncAutosaveDeferral();
  }

  public updateEventObjectiveStatus(status: string): void {
    this.ensureInitialized();
    this.setTextContent(this.eventObjectiveStatus, status);
    this.setStyleValue(this.eventObjectiveStatus, 'display', status.length > 0 ? 'block' : 'none');
  }

  public hideEventObjective(): void {
    this.ensureInitialized();
    this.applyEventObjectiveTone('default');
    this.setTextContent(this.eventObjectiveText, '');
    this.setTextContent(this.eventObjectiveStatus, '');
    this.setStyleValue(this.eventObjectiveStatus, 'display', 'none');
    this.setStyleValue(this.eventObjectiveDisplay, 'display', 'none');
    this.eventObjectiveVisible = false;
    this.syncAutosaveDeferral();
  }

  private applyEventObjectiveTone(tone: EventObjectiveTone): void {
    if (this.eventObjectiveTone === tone) {
      return;
    }

    this.eventObjectiveTone = tone;

    if (tone === 'complete') {
      this.setStyleValue(
        this.eventObjectiveDisplay,
        'background',
        'linear-gradient(160deg, rgba(20, 40, 28, 0.9), rgba(8, 18, 12, 0.8))'
      );
      this.setStyleValue(
        this.eventObjectiveDisplay,
        'border',
        '1px solid rgba(140, 255, 176, 0.34)'
      );
      this.setStyleValue(this.eventObjectiveTitle, 'color', '#9dffb8');
      this.setStyleValue(
        this.eventObjectiveText,
        'textShadow',
        '0 0 12px rgba(120, 255, 176, 0.14)'
      );
      this.setStyleValue(this.eventObjectiveStatus, 'color', 'rgba(206, 255, 220, 0.9)');
      return;
    }

    this.setStyleValue(
      this.eventObjectiveDisplay,
      'background',
      'linear-gradient(160deg, rgba(18, 26, 42, 0.88), rgba(8, 12, 20, 0.76))'
    );
    this.setStyleValue(this.eventObjectiveDisplay, 'border', '1px solid rgba(132, 210, 255, 0.24)');
    this.setStyleValue(this.eventObjectiveTitle, 'color', '#8fe4ff');
    this.setStyleValue(this.eventObjectiveText, 'textShadow', '0 0 12px rgba(120, 220, 255, 0.16)');
    this.setStyleValue(this.eventObjectiveStatus, 'color', 'rgba(183, 231, 255, 0.86)');
  }

  /**
   * 更新生命值显示
   */
  public updateLives(lives: number): void {
    this.ensureInitialized();
    const filled = Math.max(0, Math.min(lives, HUD.MAX_DISPLAY_LIVES));
    this.renderLifePips(filled);
  }

  public setLayoutDensity(density: HudLayoutDensity): void {
    this.layoutDensity = density;
    this.densityExplicit = true;
    this.applyLayoutDensity();
  }

  public getLayoutDensity(): HudLayoutDensity {
    return this.layoutDensity;
  }

  private getCabinMaxWidth(): string {
    if (this.layoutDensity === 'touch-landscape') {
      return 'min(38vw, 180px)';
    }
    if (this.layoutDensity === 'touch-portrait') {
      return 'min(58vw, 220px)';
    }
    return 'min(28vw, 260px)';
  }

  private applyLayoutDensity(): void {
    this.container.setAttribute('data-layout-density', this.layoutDensity);
    // 中央播报挂在 <body> 上（层级高于 HUD），单独标记布局密度供样式定位
    HUD.setAttr(this.powerUpBigDisplay, 'data-layout-density', this.layoutDensity);
    this.setStyleValue(this.leftStatusPanel, 'maxWidth', this.getCabinMaxWidth());
    this.applyHealthBarLayout();
    this.refreshDeckMode();
    this.applyCameraChipVisibility();
    if (this.autosaveToast) {
      this.placeAutosaveToast(this.autosaveToast);
    }
    if (this.warningUi && this.missileWarningLevel !== 'none') {
      this.renderMissileWarning(this.warningUi);
    }
    if (this.initialized) {
      this.syncTopStackBottom();
    }
  }

  /** 竖屏时血条靠右并收窄，避免压住左上角的得分舱（#hud 已让出安全区，这里只留 10px 边距） */
  private applyHealthBarLayout(): void {
    const density = this.layoutDensity;
    const portrait = density === 'touch-portrait';
    const width =
      density === 'desktop' ? '250px' : portrait ? 'min(150px, calc(100% - 190px))' : '180px';
    this.setStyleValue(this.healthBarContainer, 'width', width);
    this.setStyleValue(this.healthBarContainer, 'left', portrait ? 'auto' : '50%');
    this.setStyleValue(this.healthBarContainer, 'right', portrait ? '10px' : 'auto');
    this.setStyleValue(
      this.healthBarContainer,
      'transform',
      portrait ? 'none' : 'translateX(-50%)'
    );
  }

  /** 自动存档提示：竖屏放进顶部消息栈（与简报 / 目标同列），其余布局挂在驾驶舱信息栏上 */
  private placeAutosaveToast(toast: HTMLDivElement): void {
    const host = this.layoutDensity === 'touch-portrait' ? this.topStack : this.leftStatusPanel;
    if (toast.parentElement !== host) {
      host.appendChild(toast);
    }
    this.syncAutosaveDeferral();
  }

  /**
   * 竖屏顶部消息栈最紧：简报显示时，或 Boss 阶段条与事件目标同时显示时，自动存档提示让位
   * （样式隐藏、计时暂停），栈空出来后再完整显示，避免把无线电面板挤到准星附近。
   */
  private isAutosaveDeferred(): boolean {
    if (this.layoutDensity !== 'touch-portrait' || !this.autosaveToast) {
      return false;
    }
    if (this.autosaveToast.parentElement !== this.topStack) {
      return false;
    }
    return this.briefingTimer > 0 || (this.bossStatusVisible && this.eventObjectiveVisible);
  }

  private syncAutosaveDeferral(): void {
    HUD.setAttr(this.topStack, 'data-defer-autosave', this.isAutosaveDeferred() ? 'on' : 'off');
  }

  private renderWaveLine(): void {
    const enemies = `${tr(TXT_ENEMIES)} ${this.aliveEnemyCount}`;
    this.setTextContent(
      this.enemiesDisplay,
      this.enemyCounterMode === 'boss'
        ? enemies
        : `${enemies} · ${tr(TXT_REMAINING)} ${this.remainingEnemyCount}`
    );
  }

  private renderLifePips(filled: number): void {
    if (this.lastLivesFilled === filled) {
      return;
    }
    this.lastLivesFilled = filled;
    this.renderPips(
      this.livesDisplay,
      filled,
      HUD.MAX_DISPLAY_LIVES,
      'hud-life-pip',
      HUD_COLORS.lock
    );
  }

  private renderMissilePips(filled: number): void {
    if (this.lastMissilesFilled === filled) {
      return;
    }
    this.lastMissilesFilled = filled;
    this.renderPips(
      this.missilesDisplay,
      filled,
      GAME_CONSTANTS.MISSILE.MAX_MISSILES,
      'hud-missile-pip',
      HUD_COLORS.weapon
    );
  }

  private renderPips(
    host: HTMLElement,
    filled: number,
    total: number,
    kindClass: string,
    onColor: string
  ): void {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < total; i += 1) {
      const on = i < filled;
      const pip = document.createElement('span');
      pip.className = `hud-pip ${kindClass} ${on ? 'is-on' : 'is-off'}`;
      pip.setAttribute('data-hud-pip', on ? 'on' : 'off');
      pip.style.width = '8px';
      pip.style.height = '10px';
      pip.style.display = 'inline-block';
      pip.style.boxSizing = 'border-box';
      pip.style.borderRadius = '2px';
      pip.style.border = `1px solid ${HUD_COLORS.edge}`;
      pip.style.backgroundColor = on ? onColor : 'transparent';
      fragment.appendChild(pip);
    }
    host.replaceChildren(fragment);
    host.setAttribute('data-filled', String(filled));
  }

  public updateUpgradePoints(points: number): void {
    this.ensureInitialized();
    this.lastUpgradePoints = points;
    this.renderUpgradePoints();
  }

  private renderUpgradePoints(): void {
    const points = this.lastUpgradePoints;
    if (points > 0) {
      const isMobile = GameConfig.isMobile;
      const label = `⭐ ${tr(TXT_UPGRADE_POINTS)} ${points}`;
      const hintText = isMobile ? label : `${label} · ${tr(TXT_UPGRADE_KEY_HINT)}`;
      this.setTextContent(this.upgradePointsDisplay, hintText);
      this.setStyleValue(this.upgradePointsDisplay, 'display', 'block');
      this.upgradePointsDisplay.classList.add('hud-upgrade-ready');
      return;
    }

    this.setTextContent(this.upgradePointsDisplay, '⭐ 0');
    this.setStyleValue(this.upgradePointsDisplay, 'display', 'none');
    this.upgradePointsDisplay.classList.remove('hud-upgrade-ready');
  }

  public updateMissiles(count: number): void {
    this.ensureInitialized();
    const maxMissiles = GAME_CONSTANTS.MISSILE.MAX_MISSILES;
    const filled = Math.max(0, Math.min(count, maxMissiles));
    this.renderMissilePips(filled);
    this.lastMissileCount = filled;
    this.setTextContent(this.missileCountDisplay, `${filled}/${maxMissiles}`);
    HUD.setAttr(this.missileCountDisplay, 'data-empty', filled === 0 ? 'true' : 'false');
    this.syncDeckMissiles();
  }

  /**
   * 更新导弹补给进度条
   * @param progress 进度（0-1）
   */
  public updateMissileProgress(progress: number): void {
    this.ensureInitialized();
    // 限制在0-1范围
    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.setStyleValue(this.missileProgressFill, 'width', `${clampedProgress * 100}%`);
    this.lastMissileProgress = clampedProgress;
    this.syncDeckMissiles();
  }

  /** 触控导弹键：余量角标（data-count）与补给进度环（--tc-meter），与特武键同一套机制 */
  private syncDeckMissiles(): void {
    if (!this.deckMode) {
      return;
    }
    const button = this.getTouchDeck().missile;
    if (!button) {
      return;
    }
    const full = this.lastMissileCount >= GAME_CONSTANTS.MISSILE.MAX_MISSILES;
    HUD.setAttr(button, 'data-count', String(this.lastMissileCount));
    this.setStyleVar(
      button,
      '--tc-meter',
      full ? '0' : String(HUD.quantize(this.lastMissileProgress))
    );
  }

  /** 状态列读数的标签（语言切换时重绘） */
  private renderStatLabels(): void {
    this.setTextContent(this.livesLabel, tr(TXT_STAT_LIVES));
    this.setTextContent(this.missilesLabel, tr(TXT_STAT_MISSILES));
  }

  /**
   * 显示道具提示
   * @param name 道具名称：纯字符串，或可本地化文案（见 HudText，倒计时期间切换语言随之重绘）
   * @param icon 道具图标
   * @param duration 持续时间（秒），0表示即时效果（如生命恢复、炸弹）
   */
  public showPowerUp(name: HudText, icon: string, duration: number = 0): void {
    this.ensureInitialized();
    // 即时效果道具（duration <= 0）不显示在右上角
    if (duration <= 0) {
      this.hidePowerUp();
      return;
    }

    // 只有持续效果的道具才显示在右上角
    this.activePowerUpNameSource = name;
    this.activePowerUpName = resolveHudText(name);
    this.activePowerUpIcon = icon;
    this.activePowerUpDuration = duration;
    this.powerUpTimer = duration;
    this.lastPowerUpRemainingSeconds = -1;
    this.setStyleValue(this.powerUpDisplay, 'opacity', '1');
    this.updatePowerUpTimerText();
  }

  /**
   * 更新道具倒计时
   */
  public update(deltaTime: number): void {
    this.ensureInitialized();
    const safeDeltaTime = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;

    // 更新道具倒计时
    if (this.activePowerUpDuration > 0 && this.powerUpTimer > 0) {
      this.powerUpTimer = Math.max(0, this.powerUpTimer - safeDeltaTime);
      this.updatePowerUpTimerText();

      if (this.powerUpTimer <= 0) {
        // 时间到，隐藏道具提示
        this.hidePowerUp();
      }
    }

    // 更新大字提示计时器
    if (this.powerUpBigTimer > 0) {
      this.powerUpBigTimer = Math.max(0, this.powerUpBigTimer - safeDeltaTime);
      if (this.powerUpBigTimer <= 0) {
        // 时间到，隐藏大字提示
        this.hidePowerUpBig();
      }
    }

    if (this.briefingTimer > 0) {
      this.briefingTimer = Math.max(0, this.briefingTimer - safeDeltaTime);
      if (this.briefingTimer <= 0) {
        this.hideBriefing();
      }
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer = Math.max(0, this.respawnTimer - safeDeltaTime);
      this.renderRespawnCountdown();
      if (this.respawnTimer <= 0) {
        this.hideRespawnOverlay();
      }
    }

    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - safeDeltaTime);
      const duration = Math.max(this.damageFlashDuration, 0.001);
      const fade = this.damageFlashTimer / duration;
      this.setStyleValue(
        this.damageFlashOverlay,
        'opacity',
        (this.damageFlashPeakOpacity * fade).toFixed(3)
      );
      if (this.damageFlashTimer <= 0) {
        this.setStyleValue(this.damageFlashOverlay, 'opacity', '0');
      }
    }

    this.updateCampaignTimers(safeDeltaTime);
  }

  /**
   * 隐藏道具提示
   */
  public hidePowerUp(): void {
    this.ensureInitialized();
    this.activePowerUpNameSource = null;
    this.activePowerUpName = '';
    this.activePowerUpIcon = '';
    this.lastPowerUpRemainingSeconds = -1;
    this.setStyleValue(this.powerUpDisplay, 'opacity', '0');
    this.activePowerUpDuration = 0;
    this.powerUpTimer = 0;
  }

  /**
   * 显示道具大字提示（屏幕中央）
   * @param icon 道具图标
   * @param name 提示文字：纯字符串，或可本地化文案（见 HudText，显示期间切换语言随之重绘）
   * @param minDisplayTime 最小显示时间（秒），默认 800ms
   * @param hideSubtext 是否隐藏副标题，默认false
   */
  public showPowerUpBig(
    icon: string,
    name: HudText,
    minDisplayTime: number = HUD.TOAST_DEFAULT_MS / 1000,
    hideSubtext: boolean = false,
    variant: BigMessageVariant = 'announcement'
  ): void {
    this.ensureInitialized();
    if (this.briefingTimer > 0) {
      this.pendingBigMessage = { icon, name, minDisplayTime, hideSubtext, variant };
      return;
    }
    this.presentPowerUpBig(icon, name, minDisplayTime, hideSubtext, variant);
  }

  /**
   * 入关 / Boss 简报：顶栏玻璃卡片，不遮挡锁定中心。新简报替换旧简报。
   */
  public showBriefing(briefing: BriefingRequest): void {
    this.ensureInitialized();
    if (this.powerUpBigTimer > 0) {
      this.hidePowerUpBig();
    }

    this.applyBriefingTone(briefing.tone);
    this.briefingSource = { kicker: briefing.kicker, title: briefing.title, line: briefing.line };
    this.renderBriefingText();
    this.setStyleValue(this.briefingDisplay, 'display', 'block');
    this.setStyleValue(this.briefingDisplay, 'opacity', '1');
    HUD.setAttr(this.topStack, 'data-briefing', 'on');
    this.briefingTimer = Math.max(0, briefing.durationMs) / 1000;
    this.syncAutosaveDeferral();
    if (this.briefingTimer <= 0) {
      this.hideBriefing();
    }
  }

  public hideBriefing(): void {
    this.ensureInitialized();
    this.hideBriefingWithoutFlush();
    this.flushPendingBigMessage();
  }

  /**
   * 非结算死亡：压暗画面并显示 LIFE × N 与倒计时，避开摇杆/开火键。
   */
  public showRespawnOverlay(overlay: { lives: number; durationMs: number }): void {
    this.ensureInitialized();
    this.pendingBigMessage = null;
    this.hidePowerUpBig();
    this.hideBriefingWithoutFlush();
    this.setTextContent(this.respawnLifeReadout, `LIFE × ${Math.max(0, overlay.lives)}`);
    this.respawnTimer = Math.max(0, overlay.durationMs) / 1000;
    this.renderRespawnCountdown();
    this.setStyleValue(this.respawnOverlay, 'display', 'flex');
    this.setStyleValue(this.respawnOverlay, 'opacity', '1');
    if (this.respawnTimer <= 0) {
      this.hideRespawnOverlay();
    }
  }

  public hideRespawnOverlay(): void {
    this.ensureInitialized();
    this.respawnTimer = 0;
    this.setTextContent(this.respawnLifeReadout, '');
    this.setTextContent(this.respawnCountdown, '');
    this.setStyleValue(this.respawnOverlay, 'opacity', '0');
    this.setStyleValue(this.respawnOverlay, 'display', 'none');
  }

  public triggerDamageFlash(intensity: number = 1): void {
    this.ensureInitialized();
    const normalizedIntensity = Math.max(0.18, Math.min(0.55, 0.18 + intensity * 0.08));
    this.damageFlashDuration = 0.18 + Math.min(intensity, 2.2) * 0.06;
    this.damageFlashPeakOpacity = normalizedIntensity;
    this.damageFlashTimer = this.damageFlashDuration;
    this.setStyleValue(this.damageFlashOverlay, 'opacity', normalizedIntensity.toFixed(3));
  }

  /**
   * 隐藏道具大字提示
   */
  private hidePowerUpBig(): void {
    this.setStyleValue(this.powerUpBigDisplay, 'opacity', '0');
    this.powerUpBigTimer = 0;
    this.powerUpBigSource = null;
  }

  private presentPowerUpBig(
    icon: string,
    name: HudText,
    minDisplayTime: number,
    hideSubtext: boolean,
    variant: BigMessageVariant
  ): void {
    this.applyBigMessageVariant(variant);
    this.setTextContent(this.powerUpBigIcon, icon);
    this.setStyleValue(this.powerUpBigIcon, 'display', icon ? 'inline-block' : 'none');
    this.powerUpBigSource = name;
    this.powerUpBigVariant = variant;
    this.renderPowerUpBigText();
    const shouldHideSubtext = variant === 'announcement' ? true : hideSubtext;
    this.setStyleValue(this.powerUpBigSubtext, 'display', shouldHideSubtext ? 'none' : 'block');
    this.setStyleValue(this.powerUpBigDisplay, 'opacity', '1');
    this.powerUpBigTimer = minDisplayTime;
  }

  /** 按当前语言写大字提示的正文与道具副标题（不重播动画、不续时） */
  private renderPowerUpBigText(): void {
    this.setTextContent(this.powerUpBigText, resolveHudText(this.powerUpBigSource));
    this.setTextContent(
      this.powerUpBigSubtext,
      this.powerUpBigVariant === 'powerup' ? tr(TXT_POWER_UP) : ''
    );
  }

  private flushPendingBigMessage(): void {
    const pending = this.pendingBigMessage;
    this.pendingBigMessage = null;
    if (!pending) {
      return;
    }
    this.presentPowerUpBig(
      pending.icon,
      pending.name,
      pending.minDisplayTime,
      pending.hideSubtext,
      pending.variant
    );
  }

  private hideBriefingWithoutFlush(): void {
    this.briefingTimer = 0;
    this.briefingSource = null;
    this.setTextContent(this.briefingKicker, '');
    this.setTextContent(this.briefingTitle, '');
    this.setTextContent(this.briefingLine, '');
    this.setStyleValue(this.briefingDisplay, 'opacity', '0');
    this.setStyleValue(this.briefingDisplay, 'display', 'none');
    HUD.setAttr(this.topStack, 'data-briefing', 'off');
    this.syncAutosaveDeferral();
  }

  /** 按当前语言写简报卡三行文字 */
  private renderBriefingText(): void {
    const source = this.briefingSource;
    if (!source) {
      return;
    }
    this.setTextContent(this.briefingKicker, resolveHudText(source.kicker));
    this.setTextContent(this.briefingTitle, resolveHudText(source.title));
    this.setTextContent(this.briefingLine, resolveHudText(source.line));
  }

  /** 按当前语言写自动存档标签；空标签时隐藏 */
  private renderAutosaveLabel(): void {
    if (!this.autosaveLabel) {
      return;
    }
    const text = resolveHudText(this.autosaveLabelSource).trim();
    this.setTextContent(this.autosaveLabel, text);
    this.setStyleValue(this.autosaveLabel, 'display', text ? 'inline' : 'none');
  }

  private applyBriefingTone(tone: BriefingTone): void {
    this.briefingDisplay.setAttribute('data-tone', tone);
    this.briefingDisplay.setAttribute('data-hud-tone', tone);
    const accent = tone === 'threat' ? HUD_COLORS.threat : HUD_COLORS.sys;
    this.setStyleValue(this.briefingDisplay, 'border', `1px solid ${accent}`);
    this.setStyleValue(this.briefingKicker, 'color', accent);
    this.setStyleValue(
      this.briefingTitle,
      'color',
      tone === 'threat' ? HUD_COLORS.threat : HUD_COLORS.text
    );
  }

  private renderRespawnCountdown(): void {
    const seconds = Math.max(0, Math.ceil(this.respawnTimer));
    this.setTextContent(this.respawnCountdown, String(seconds));
  }

  /** 播报 / 道具两种配色由样式按 data-variant 切换（hudExtrasStyles） */
  private applyBigMessageVariant(variant: BigMessageVariant): void {
    HUD.setAttr(this.powerUpBigDisplay, 'data-variant', variant);
  }

  // ---------------------------------------------------------------------------
  // 战役 HUD：挂载物 / 热焰弹 / 自动存档 / 视角 / Boss 阶段 / 告警
  // 每帧调用安全：数值不变时不写 DOM。
  // ---------------------------------------------------------------------------

  /**
   * 特殊武器面板：salvo 显示弹药与装填，beam 显示热量 / 过热，charge 显示蓄能，pulse 显示冷却；
   * 下方一排 1-5 挂架（选中 / 就绪 / 未解锁）。触控端改为把同样的状态写到特武 / 切换按键上。
   */
  public updateWeaponPanel(state: HudWeaponPanelState): void {
    this.ensureInitialized();
    const ui = this.ensureWeaponUi();
    const visible = Boolean(state && state.visible);
    this.lastWeaponState = state ?? null;
    if (visible !== this.weaponPanelVisible) {
      this.weaponPanelVisible = visible;
      this.setStyleValue(ui.panel, 'display', visible ? 'block' : 'none');
      this.syncStoresVisibility();
    }
    if (!visible) {
      this.syncDeckWeapon(null, '');
      return;
    }

    const mode = state.mode ?? null;
    const maxAmmo = HUD.normalizeMaxAmmo(state.maxAmmo);
    const ammo = Math.max(0, HUD.finiteOr(state.ammo, 0));
    const reload = HUD.clamp01(state.reloadProgress);
    const heat = HUD.clamp01(state.heat);
    const charge = HUD.clamp01(state.charge);
    const cooldown = HUD.clamp01(state.cooldown);
    const ready = Boolean(state.ready);
    const overheated = Boolean(state.overheated);

    HUD.setAttr(ui.panel, 'data-mode', mode ?? 'none');
    HUD.setAttr(ui.panel, 'data-ready', ready ? 'true' : 'false');
    HUD.setAttr(ui.panel, 'data-overheated', overheated ? 'true' : 'false');
    this.setTextContent(ui.code, state.shortCode || '—');
    this.setTextContent(ui.icon, state.icon || '');
    this.setTextContent(ui.name, state.name || '');
    this.setTextContent(ui.lamp, overheated ? tr(TXT_LAMP_HOT) : ready ? tr(TXT_LAMP_READY) : '');

    const meter = HUD.describeWeaponMeter(
      mode,
      ammo,
      maxAmmo,
      reload,
      heat,
      overheated,
      charge,
      cooldown,
      this.layoutDensity === 'desktop'
    );
    this.setStyleValue(ui.meterFill, 'transform', `scaleX(${HUD.quantize(meter.value)})`);
    this.setTextContent(ui.label, meter.label);
    this.renderWeaponAmmo(ui, ammo, maxAmmo, reload);
    const dots = this.renderWeaponSlots(ui, Array.isArray(state.slots) ? state.slots : []);

    this.syncDeckWeapon(
      {
        code: state.shortCode || '',
        mode: mode ?? 'none',
        ready,
        overheated,
        meter: meter.value,
        ammoText: Number.isFinite(maxAmmo) && maxAmmo > 0 ? String(Math.floor(ammo)) : '',
      },
      dots
    );
  }

  /** 热焰弹：菱形 pip 表示剩余次数，细条表示下一枚的回复进度 */
  public updateFlares(charges: number, max: number, rechargeProgress: number): void {
    this.ensureInitialized();
    const ui = this.ensureFlareUi();
    const maxCount = Math.max(0, Math.min(HUD.MAX_FLARE_PIPS, Math.round(HUD.finiteOr(max, 0))));
    const count = Math.max(0, Math.min(maxCount, Math.floor(HUD.finiteOr(charges, 0))));
    const progress = HUD.clamp01(rechargeProgress);
    const visible = maxCount > 0;
    if (visible !== this.flaresVisible) {
      this.flaresVisible = visible;
      this.setStyleValue(ui.section, 'display', visible ? 'flex' : 'none');
      this.syncStoresVisibility();
    }

    if (ui.pips.length !== maxCount) {
      const fragment = document.createDocumentFragment();
      ui.pips = [];
      for (let i = 0; i < maxCount; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'hx-fl-pip';
        ui.pips.push(pip);
        fragment.appendChild(pip);
      }
      ui.pipsHost.replaceChildren(fragment);
      this.lastFlareCount = -1;
    }
    if (count !== this.lastFlareCount) {
      this.lastFlareCount = count;
      ui.pips.forEach((pip, index) => pip.classList.toggle('is-on', index < count));
      ui.section.setAttribute('data-charges', String(count));
    }
    this.setTextContent(ui.count, visible ? `${count}/${maxCount}` : '');
    const fill = count >= maxCount ? 1 : progress;
    this.setStyleValue(ui.fill, 'transform', `scaleX(${HUD.quantize(fill)})`);
    HUD.setAttr(ui.section, 'data-empty', visible && count === 0 ? 'true' : 'false');

    if (this.deckMode) {
      const deck = this.getTouchDeck();
      if (deck.flare) {
        HUD.setAttr(deck.flare, 'data-empty', visible && count === 0 ? 'true' : 'false');
        this.setStyleVar(deck.flare, '--tc-meter', String(HUD.quantize(fill)));
      }
      if (deck.flareSub) {
        this.setTextContent(deck.flareSub, visible ? String(count) : '');
      }
    }
  }

  /**
   * 自动存档提示：驾驶舱信息栏下方（竖屏在顶部消息栈里）的短暂绿色提示，约 2.6 秒后淡出
   * （由 update 驱动）。label 可以是纯字符串或可本地化文案（见 HudText）。
   */
  public showAutosave(label?: HudText): void {
    this.ensureInitialized();
    const toast = this.ensureAutosaveToast();
    this.autosaveLabelSource = label ?? null;
    this.renderAutosaveLabel();
    toast.classList.remove('is-leaving');
    this.autosaveSeq = this.autosaveSeq === 'a' ? 'b' : 'a';
    toast.setAttribute('data-seq', this.autosaveSeq);
    this.setStyleValue(toast, 'display', 'flex');
    this.autosaveTimer = HUD.AUTOSAVE_TOAST_SECONDS;
    this.autosaveLeaving = false;
  }

  /**
   * 视角：#hud 与 <html> 上标记 data-camera-mode / data-hud-camera 供样式切换；
   * 第一人称下驾驶舱信息栏改用更通透的玻璃，下方面板换成仪表板显示器风格；切换时标签闪亮一下。
   */
  public setCameraMode(mode: HudCameraMode): void {
    this.ensureInitialized();
    const next: HudCameraMode = mode === 'first-person' ? 'first-person' : 'third-person';
    const previous = this.cameraMode;
    this.cameraMode = next;
    HUD.setAttr(this.container, 'data-camera-mode', next);
    HUD.setRootMarker('data-hud-camera', next);

    const chip = this.ensureCameraChip();
    this.renderCameraLabels(next);
    this.applyCameraChipVisibility();
    this.applyCabinCameraStyle(next);
    if (previous !== null && previous !== next) {
      chip.classList.add('is-flash');
      this.cameraFlashTimer = HUD.CAMERA_FLASH_SECONDS;
    }

    const deck = this.getTouchDeck();
    if (deck.camera) {
      HUD.setAttr(deck.camera, 'data-camera-mode', next);
      HUD.setAttr(deck.camera, 'aria-pressed', next === 'first-person' ? 'true' : 'false');
    }
  }

  /** 视角标签（桌面）与触控视角键角标 */
  private renderCameraLabels(mode: HudCameraMode): void {
    const firstPerson = mode === 'first-person';
    if (this.cameraChipLabel) {
      this.setTextContent(
        this.cameraChipLabel,
        tr(firstPerson ? TXT_FIRST_PERSON : TXT_THIRD_PERSON)
      );
    }
    const deck = this.getTouchDeck();
    if (deck.cameraSub) {
      this.setTextContent(
        deck.cameraSub,
        tr(firstPerson ? TXT_DECK_FIRST_PERSON : TXT_DECK_THIRD_PERSON)
      );
    }
  }

  private renderBossPhase(ui: BossStatusUi, current: number, total: number): void {
    this.setTextContent(ui.phase, total > 0 ? `${tr(TXT_BOSS_PHASE)} ${current}/${total}` : '');
  }

  /** Boss 状态标签文字（空串时收起标签） */
  private renderBossLabel(ui: BossStatusUi, text: string): void {
    this.bossLabel = text;
    this.setTextContent(ui.label, text);
    this.setStyleValue(ui.label, 'display', text ? 'inline' : 'none');
  }

  /**
   * Boss 状态条（血条下方）：标签 + 阶段菱形；label 为 null 时隐藏。
   * label 可以是纯字符串或可本地化文案（见 HudText，显示期间切换语言随之重绘）。
   * 阶段推进时整条闪一下。
   */
  public setBossStatus(label: HudText | null, phase?: { current: number; total: number }): void {
    this.ensureInitialized();
    if (label === null || label === undefined) {
      if (!this.bossStatusVisible) {
        return;
      }
      this.bossStatusVisible = false;
      this.bossLabelSource = null;
      this.bossLabel = '';
      this.bossPhaseCurrent = 0;
      this.bossPhaseTotal = 0;
      this.bossFlashTimer = 0;
      if (this.bossUi) {
        this.bossUi.root.classList.remove('is-phase-up');
        this.setStyleValue(this.bossUi.root, 'display', 'none');
      }
      HUD.setRootMarker('data-hud-boss', null);
      // 桌面 / 横屏阶段条收起后消息栈上移：尺寸不变，ResizeObserver 不会触发，手动同步栈底
      this.syncTopStackBottom();
      this.syncAutosaveDeferral();
      return;
    }

    const ui = this.ensureBossUi();
    const total = phase
      ? Math.max(0, Math.min(HUD.MAX_BOSS_PIPS, Math.round(HUD.finiteOr(phase.total, 0))))
      : 0;
    const current = phase
      ? Math.max(0, Math.min(total, Math.round(HUD.finiteOr(phase.current, 0))))
      : 0;
    const text = resolveHudText(label);
    this.bossLabelSource = label;
    if (
      this.bossStatusVisible &&
      text === this.bossLabel &&
      total === this.bossPhaseTotal &&
      current === this.bossPhaseCurrent
    ) {
      return;
    }

    const phaseAdvanced = this.bossStatusVisible && current > this.bossPhaseCurrent;
    this.renderBossLabel(ui, text);

    if (ui.pips.length !== total) {
      const fragment = document.createDocumentFragment();
      ui.pips = [];
      for (let i = 0; i < total; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'hx-boss-pip';
        ui.pips.push(pip);
        fragment.appendChild(pip);
      }
      ui.pipsHost.replaceChildren(fragment);
    }
    ui.pips.forEach((pip, index) => {
      pip.classList.toggle('is-past', index + 1 < current);
      pip.classList.toggle('is-current', index + 1 === current);
    });
    this.setStyleValue(ui.pipsHost, 'display', total > 0 ? 'flex' : 'none');
    this.renderBossPhase(ui, current, total);
    this.setStyleValue(ui.phase, 'display', total > 0 ? 'inline' : 'none');
    ui.root.setAttribute('data-phase', String(current));
    ui.root.setAttribute('data-phase-total', String(total));

    this.bossPhaseCurrent = current;
    this.bossPhaseTotal = total;
    if (!this.bossStatusVisible) {
      this.bossStatusVisible = true;
      this.setStyleValue(ui.root, 'display', 'flex');
      // 桌面 / 横屏：顶部消息栈让出阶段条一行；竖屏阶段条在消息栈里占一整行
      HUD.setRootMarker('data-hud-boss', 'on');
      this.syncTopStackBottom();
      this.syncAutosaveDeferral();
    }
    if (phaseAdvanced) {
      ui.root.classList.remove('is-phase-up');
      // 强制重排以重播动画：只在阶段推进时发生
      void ui.root.offsetWidth;
      ui.root.classList.add('is-phase-up');
      this.bossFlashTimer = HUD.BOSS_PHASE_FLASH_SECONDS;
    }
  }

  /**
   * 导弹告警逐级升级：locking 琥珀色“被锁定”慢闪 + 边缘微光；incoming 红色“导弹来袭”快闪
   * + 屏幕边缘红色脉冲，并提示投放热焰弹（触控端热焰按键同步进入告警态）。
   */
  public setMissileWarning(level: HudMissileWarningLevel): void {
    this.ensureInitialized();
    const next: HudMissileWarningLevel =
      level === 'locking' || level === 'incoming' ? level : 'none';
    if (next === this.missileWarningLevel) {
      return;
    }
    this.missileWarningLevel = next;
    HUD.setAttr(this.container, 'data-missile-warning', next);
    const ui = this.ensureWarningUi();
    this.renderMissileWarning(ui);

    const deck = this.getTouchDeck();
    if (deck.flare) {
      HUD.setAttr(deck.flare, 'data-alert', next);
    }
    this.syncWarningRows();
  }

  /**
   * 屏幕中下方的闪烁告警（Boss 招式预警、武器过热等），约 2.2 秒后消失；同一句话重复调用只续时。
   * text 可以是纯字符串或可本地化文案（见 HudText，显示期间切换语言随之重绘）。
   */
  public flashWarning(text: HudText, tone: HudWarningTone = 'threat'): void {
    this.ensureInitialized();
    const message = resolveHudText(text).trim();
    if (!message) {
      return;
    }
    const ui = this.ensureWarningUi();
    const nextTone: HudWarningTone = tone === 'sys' || tone === 'ally' ? tone : 'threat';
    const repeat =
      this.flashWarningTimer > 0 &&
      this.flashWarningText === message &&
      this.flashWarningTone === nextTone;
    this.flashWarningSource = text;
    this.flashWarningText = message;
    this.flashWarningTone = nextTone;
    this.setTextContent(ui.flashText, message);
    ui.flash.setAttribute('data-tone', nextTone);
    if (!repeat) {
      this.flashSeq = this.flashSeq === 'a' ? 'b' : 'a';
      ui.flash.setAttribute('data-seq', this.flashSeq);
    }
    this.setStyleValue(ui.flash, 'display', 'flex');
    this.flashWarningTimer = HUD.FLASH_WARNING_SECONDS;
    this.syncWarningRows();
  }

  private updateCampaignTimers(deltaTime: number): void {
    // 竖屏消息栈拥挤时存档提示让位：样式隐藏，计时也暂停（见 isAutosaveDeferred）
    if (this.autosaveTimer > 0 && !this.isAutosaveDeferred()) {
      this.autosaveTimer = Math.max(0, this.autosaveTimer - deltaTime);
      if (!this.autosaveLeaving && this.autosaveTimer <= HUD.AUTOSAVE_LEAVE_SECONDS) {
        this.autosaveLeaving = true;
        this.autosaveToast?.classList.add('is-leaving');
      }
      if (this.autosaveTimer <= 0) {
        this.hideAutosave();
      }
    }

    if (this.flashWarningTimer > 0) {
      this.flashWarningTimer = Math.max(0, this.flashWarningTimer - deltaTime);
      if (this.flashWarningTimer <= 0) {
        this.hideFlashWarning();
      }
    }

    if (this.cameraFlashTimer > 0) {
      this.cameraFlashTimer = Math.max(0, this.cameraFlashTimer - deltaTime);
      if (this.cameraFlashTimer <= 0) {
        this.cameraChip?.classList.remove('is-flash');
      }
    }

    if (this.bossFlashTimer > 0) {
      this.bossFlashTimer = Math.max(0, this.bossFlashTimer - deltaTime);
      if (this.bossFlashTimer <= 0) {
        this.bossUi?.root.classList.remove('is-phase-up');
      }
    }
  }

  private hideAutosave(): void {
    this.autosaveTimer = 0;
    this.autosaveLeaving = false;
    this.autosaveLabelSource = null;
    if (this.autosaveToast) {
      this.autosaveToast.classList.remove('is-leaving');
      this.setStyleValue(this.autosaveToast, 'display', 'none');
    }
  }

  private hideFlashWarning(): void {
    this.flashWarningTimer = 0;
    this.flashWarningSource = null;
    this.flashWarningText = '';
    if (this.warningUi) {
      this.setStyleValue(this.warningUi.flash, 'display', 'none');
    }
    this.syncWarningRows();
  }

  /**
   * 告警通道同时显示两行（导弹告警 + 闪烁告警）时在 <html> 上记 data-hud-warning-rows='2'。
   * 手机竖屏追尾视角下无线电面板和通道共用机体到按键簇之间的那一带：两行时面板收成一行，
   * 不压住第二行（见 radioStyles）。
   */
  private syncWarningRows(): void {
    const both = this.missileWarningLevel !== 'none' && this.flashWarningTimer > 0;
    HUD.setRootMarker('data-hud-warning-rows', both ? '2' : null);
  }

  /** 语言切换：按新语言重写仍在显示的闪烁告警（不重播动画、不续时；纯字符串原样保留） */
  private renderFlashWarningText(): void {
    if (!this.warningUi || this.flashWarningSource === null) {
      return;
    }
    const message = resolveHudText(this.flashWarningSource).trim();
    if (!message) {
      return;
    }
    this.flashWarningText = message;
    this.setTextContent(this.warningUi.flashText, message);
  }

  /** 结算 / 失败时收起所有战斗告警与临时提示 */
  private clearCombatAlerts(): void {
    this.setMissileWarning('none');
    this.hideFlashWarning();
    this.setBossStatus(null);
    this.hideAutosave();
  }

  private renderMissileWarning(ui: WarningLaneUi): void {
    const level = this.missileWarningLevel;
    ui.missile.setAttribute('data-level', level);
    ui.edge.setAttribute('data-level', level);
    if (level === 'none') {
      this.setStyleValue(ui.missile, 'display', 'none');
      return;
    }
    const incoming = level === 'incoming';
    ui.missileGlyph.innerHTML = incoming ? GLYPH_MISSILE : GLYPH_WARNING;
    this.setTextContent(
      ui.missileMain,
      incoming
        ? tr({ en: 'MISSILE INBOUND', zh: '导弹来袭' })
        : tr({ en: 'LOCKED ON', zh: '被锁定' })
    );
    const hint = document.createDocumentFragment();
    if (incoming) {
      const key = document.createElement('span');
      key.className = 'hx-key';
      key.textContent = 'G';
      hint.appendChild(key);
    }
    hint.appendChild(
      document.createTextNode(
        incoming
          ? tr({ en: 'Drop flares', zh: '投放热焰弹' })
          : tr({ en: 'Ready flares', zh: '准备热焰弹' })
      )
    );
    ui.missileHint.replaceChildren(hint);
    this.textContentCache.delete(ui.missileHint);
    this.setStyleValue(ui.missile, 'display', 'flex');
  }

  /** 主进度条的数值与说明；就绪时说明换成操作提示（灯已经显示“就绪”） */
  private static describeWeaponMeter(
    mode: HudWeaponMode | null,
    ammo: number,
    maxAmmo: number,
    reload: number,
    heat: number,
    overheated: boolean,
    charge: number,
    cooldown: number,
    keyboard: boolean
  ): { value: number; label: string } {
    const percent = (value: number): string => `${Math.round(value * 100)}%`;
    if (mode === 'beam') {
      if (overheated) {
        return { value: heat, label: tr(TXT_OVERHEAT_COOLING) };
      }
      if (heat >= 0.01) {
        return { value: heat, label: `${tr(TXT_HEAT)} ${percent(heat)}` };
      }
    }
    if (mode === 'charge' && charge > 0) {
      return {
        value: charge,
        label: charge >= 1 ? tr(TXT_CHARGED) : `${tr(TXT_CHARGE)} ${percent(charge)}`,
      };
    }
    if (Number.isFinite(maxAmmo) && maxAmmo > 0 && ammo <= 0) {
      return { value: reload, label: `${tr(TXT_RELOAD)} ${percent(reload)}` };
    }
    if (cooldown > 0) {
      return {
        value: 1 - cooldown,
        label: mode === 'pulse' ? tr(TXT_RECHARGING) : tr(TXT_COOLDOWN),
      };
    }
    if (mode === 'beam') {
      return { value: 0, label: tr(keyboard ? TXT_HOLD_F_BEAM : TXT_HOLD_BEAM) };
    }
    if (mode === 'charge') {
      return { value: 1, label: tr(keyboard ? TXT_HOLD_F_CHARGE : TXT_HOLD_CHARGE) };
    }
    if (mode === 'pulse') {
      return { value: 1, label: tr(keyboard ? TXT_F_PULSE : TXT_TAP_PULSE) };
    }
    return { value: 1, label: tr(keyboard ? TXT_F_SALVO : TXT_TAP_SALVO) };
  }

  private renderWeaponAmmo(ui: WeaponPanelUi, ammo: number, maxAmmo: number, reload: number): void {
    const limited = Number.isFinite(maxAmmo) && maxAmmo > 0;
    const pipCount = limited && maxAmmo <= HUD.MAX_AMMO_PIPS ? Math.round(maxAmmo) : 0;
    if (pipCount !== ui.ammoPips.length) {
      const fragment = document.createDocumentFragment();
      ui.ammoPips = [];
      for (let i = 0; i < pipCount; i += 1) {
        const pip = document.createElement('span');
        pip.className = 'hx-ammo-pip';
        ui.ammoPips.push(pip);
        fragment.appendChild(pip);
      }
      ui.ammoPipsHost.replaceChildren(fragment);
    }

    if (pipCount > 0) {
      const filled = Math.min(pipCount, Math.floor(ammo));
      // 正在装填的那一发按进度从下往上填充（5% 一档）
      const reloadFill = `${Math.round(reload * 20) * 5}%`;
      ui.ammoPips.forEach((pip, index) => {
        const on = index < filled;
        pip.classList.toggle('is-on', on);
        this.setStyleVar(pip, '--fill', !on && index === filled ? reloadFill : '0%');
      });
    }
    // pip 之外再给出精确数字；热量武器（无限弹药）不显示
    this.setStyleValue(ui.ammoText, 'display', limited ? 'inline' : 'none');
    this.setTextContent(ui.ammoText, limited ? `${Math.floor(ammo)}/${Math.round(maxAmmo)}` : '');
  }

  /** 渲染挂架行；返回触控“切换”键上的挂架点阵（● 选中 / ○ 已解锁 / · 未解锁） */
  private renderWeaponSlots(ui: WeaponPanelUi, slots: readonly HudWeaponSlotState[]): string {
    let signature = '';
    for (const slot of slots) {
      signature += `${slot.shortCode}:${slot.selected ? 1 : 0}${slot.ready ? 1 : 0}|`;
    }
    if (signature === this.lastSlotSignature) {
      return ui.slotsHost.getAttribute('data-dots') ?? '';
    }
    this.lastSlotSignature = signature;

    const entries = HUD.buildSlotEntries(slots);
    while (ui.slots.length < entries.length) {
      ui.slots.push(HUD.createSlotElement(ui.slotsHost));
    }
    while (ui.slots.length > entries.length) {
      ui.slots.pop()?.root.remove();
    }

    let dots = '';
    entries.forEach((entry, index) => {
      const slot = ui.slots[index];
      slot.root.classList.toggle('is-selected', entry.selected);
      slot.root.classList.toggle('is-ready', entry.ready && !entry.locked);
      slot.root.classList.toggle('is-locked', entry.locked);
      HUD.setAttr(slot.root, 'data-weapon-slot', entry.code);
      HUD.setAttr(slot.root, 'data-selected', entry.selected ? 'true' : 'false');
      HUD.setAttr(slot.root, 'data-ready', entry.ready ? 'true' : 'false');
      HUD.setAttr(slot.root, 'data-locked', entry.locked ? 'true' : 'false');
      this.setTextContent(slot.key, String(entry.key));
      this.setTextContent(slot.code, entry.code);
      dots += entry.locked ? '·' : entry.selected ? '●' : '○';
    });
    ui.slotsHost.setAttribute('data-dots', dots);
    return dots;
  }

  /** 已解锁挂架 + 尚未解锁的武器占位，按 1-5 键位顺序排列 */
  private static buildSlotEntries(slots: readonly HudWeaponSlotState[]): WeaponSlotEntry[] {
    const order = SPECIAL_WEAPON_IDS.map((id) => SPECIAL_WEAPON_CONFIGS[id].shortCode);
    const entries: WeaponSlotEntry[] = slots.map((slot, index) => {
      const known = order.indexOf(slot.shortCode);
      return {
        code: slot.shortCode,
        key: known >= 0 ? known + 1 : index + 1,
        rank: known >= 0 ? known : order.length + index,
        selected: Boolean(slot.selected),
        ready: Boolean(slot.ready),
        locked: false,
      };
    });
    const present = new Set(slots.map((slot) => slot.shortCode));
    order.forEach((code, index) => {
      if (!present.has(code)) {
        entries.push({
          code,
          key: index + 1,
          rank: index,
          selected: false,
          ready: false,
          locked: true,
        });
      }
    });
    entries.sort((a, b) => a.rank - b.rank);
    return entries;
  }

  private static createSlotElement(host: HTMLDivElement): WeaponSlotUi {
    const root = document.createElement('div');
    root.className = 'hx-slot';
    const key = document.createElement('span');
    key.className = 'hx-slot-key';
    const code = document.createElement('span');
    code.className = 'hx-slot-code';
    const lock = document.createElement('span');
    lock.className = 'hx-slot-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.innerHTML = GLYPH_LOCK;
    root.append(key, code, lock);
    host.appendChild(root);
    return { root, key, code };
  }

  private syncStoresVisibility(): void {
    if (!this.storesPanel) {
      return;
    }
    const show = (this.weaponPanelVisible || this.flaresVisible) && !this.deckMode;
    this.setStyleValue(this.storesPanel, 'display', show ? 'flex' : 'none');
    HUD.setAttr(
      this.storesPanel,
      'data-sections',
      this.weaponPanelVisible && this.flaresVisible ? 'both' : 'single'
    );
  }

  /** 触控端且页面里有按键簇时，挂载物状态改为写到按键上，面板隐藏 */
  private refreshDeckMode(): void {
    this.deckRefs = null;
    const deck =
      this.layoutDensity !== 'desktop' &&
      typeof document !== 'undefined' &&
      document.getElementById('special-button') !== null;
    if (deck !== this.deckMode) {
      this.deckMode = deck;
      this.syncStoresVisibility();
    }
    this.syncDeckMissiles();
  }

  private getTouchDeck(): TouchDeckRefs {
    const cached = this.deckRefs;
    if (cached && (!cached.special || cached.special.isConnected)) {
      return cached;
    }
    const find = (id: string): HTMLElement | null =>
      typeof document === 'undefined' ? null : document.getElementById(id);
    const child = (host: HTMLElement | null, selector: string): HTMLElement | null =>
      host ? host.querySelector<HTMLElement>(selector) : null;
    const special = find('special-button');
    const flare = find('flare-button');
    const cycle = find('cycle-button');
    const camera = find('camera-button');
    this.deckRefs = {
      special,
      specialMain: child(special, '.tc-main'),
      specialSub: child(special, '.tc-sub'),
      flare,
      flareSub: child(flare, '.tc-sub'),
      cycle,
      cycleSub: child(cycle, '.tc-sub'),
      camera,
      cameraSub: child(camera, '.tc-sub'),
      missile: find('missile-button'),
    };
    return this.deckRefs;
  }

  private syncDeckWeapon(
    info: {
      code: string;
      mode: string;
      ready: boolean;
      overheated: boolean;
      meter: number;
      ammoText: string;
    } | null,
    dots: string
  ): void {
    if (!this.deckMode) {
      return;
    }
    const deck = this.getTouchDeck();
    if (deck.special) {
      HUD.setAttr(deck.special, 'data-weapon', info?.code ?? '');
      HUD.setAttr(deck.special, 'data-mode', info?.mode ?? 'none');
      HUD.setAttr(deck.special, 'data-ready', info?.ready ? 'true' : 'false');
      HUD.setAttr(deck.special, 'data-overheated', info?.overheated ? 'true' : 'false');
      this.setStyleVar(deck.special, '--tc-meter', info ? String(HUD.quantize(info.meter)) : '0');
    }
    if (deck.specialMain) {
      this.setTextContent(deck.specialMain, info?.code || tr(TXT_DECK_SPECIAL));
    }
    if (deck.specialSub) {
      this.setTextContent(deck.specialSub, info?.ammoText ?? '');
    }
    if (deck.cycle) {
      let unlocked = 0;
      for (const dot of dots) {
        if (dot !== '·') {
          unlocked += 1;
        }
      }
      HUD.setAttr(deck.cycle, 'data-count', String(unlocked));
    }
    if (deck.cycleSub) {
      this.setTextContent(deck.cycleSub, dots);
    }
  }

  private applyCameraChipVisibility(): void {
    if (!this.cameraChip) {
      return;
    }
    const show = this.layoutDensity === 'desktop' && this.cameraMode !== null;
    this.setStyleValue(this.cameraChip, 'display', show ? 'flex' : 'none');
  }

  /** 第一人称：驾驶舱信息栏换成更通透的玻璃，让出风挡视野 */
  private applyCabinCameraStyle(mode: HudCameraMode): void {
    const firstPerson = mode === 'first-person';
    this.setStyleValue(
      this.scoreDisplay,
      'background',
      firstPerson
        ? 'linear-gradient(160deg, rgba(18, 30, 48, 0.5), rgba(10, 14, 22, 0.34))'
        : 'linear-gradient(160deg, rgba(18, 30, 48, 0.88), rgba(10, 14, 22, 0.76))'
    );
    this.setStyleValue(
      this.speedDisplay,
      'background',
      firstPerson
        ? 'linear-gradient(165deg, rgba(17, 22, 34, 0.5), rgba(9, 12, 18, 0.34))'
        : 'linear-gradient(165deg, rgba(17, 22, 34, 0.88), rgba(9, 12, 18, 0.76))'
    );
  }

  private ensureStoresPanel(): HTMLDivElement {
    if (this.storesPanel) {
      return this.storesPanel;
    }
    const panel = document.createElement('div');
    panel.id = 'hud-stores';
    panel.setAttribute('data-hud', 'stores');
    panel.style.display = 'none';
    this.container.appendChild(panel);
    this.storesPanel = panel;
    return panel;
  }

  private ensureWeaponUi(): WeaponPanelUi {
    if (this.weaponUi) {
      return this.weaponUi;
    }
    const stores = this.ensureStoresPanel();
    const panel = document.createElement('div');
    panel.id = 'hud-weapon-panel';
    panel.setAttribute('data-hud', 'weapon');
    panel.style.display = 'none';

    const head = document.createElement('div');
    head.className = 'hx-wp-head';
    const code = document.createElement('span');
    code.className = 'hx-wp-code';
    const icon = document.createElement('span');
    icon.className = 'hx-wp-icon';
    icon.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'hx-wp-name';
    const lamp = document.createElement('span');
    lamp.className = 'hx-wp-lamp';
    head.append(code, icon, name, lamp);

    const meter = document.createElement('div');
    meter.className = 'hx-meter';
    const meterFill = document.createElement('div');
    meterFill.className = 'hx-meter-fill';
    meter.appendChild(meterFill);

    const sub = document.createElement('div');
    sub.className = 'hx-wp-sub';
    const ammo = document.createElement('div');
    ammo.className = 'hx-wp-ammo';
    const ammoPipsHost = document.createElement('span');
    ammoPipsHost.className = 'hx-ammo-pips';
    const ammoText = document.createElement('span');
    ammoText.className = 'hx-wp-ammo-text';
    ammoText.style.display = 'none';
    ammo.append(ammoPipsHost, ammoText);
    const label = document.createElement('span');
    label.className = 'hx-wp-label';
    sub.append(ammo, label);

    const slotsHost = document.createElement('div');
    slotsHost.className = 'hx-slots';

    panel.append(head, meter, sub, slotsHost);
    stores.insertBefore(panel, stores.firstChild);

    this.weaponUi = {
      panel,
      code,
      icon,
      name,
      lamp,
      meterFill,
      ammoPipsHost,
      ammoPips: [],
      ammoText,
      label,
      slotsHost,
      slots: [],
    };
    return this.weaponUi;
  }

  private ensureFlareUi(): FlareUi {
    if (this.flareUi) {
      return this.flareUi;
    }
    const stores = this.ensureStoresPanel();
    const section = document.createElement('div');
    section.id = 'hud-flares';
    section.setAttribute('data-hud', 'flares');
    section.style.display = 'none';

    const label = document.createElement('span');
    label.className = 'hx-fl-label';
    const key = document.createElement('span');
    key.className = 'hx-key';
    key.textContent = 'G';
    this.flareLabelText = document.createTextNode(tr({ en: 'FLARES', zh: '热焰弹' }));
    label.append(this.flareLabelText, key);

    const pipsHost = document.createElement('div');
    pipsHost.className = 'hx-fl-pips';
    const meter = document.createElement('div');
    meter.className = 'hx-fl-meter';
    const fill = document.createElement('div');
    fill.className = 'hx-fl-fill';
    meter.appendChild(fill);

    const count = document.createElement('span');
    count.className = 'hx-fl-count';

    section.append(label, pipsHost, meter, count);
    stores.appendChild(section);
    this.flareUi = { section, pipsHost, pips: [], fill, count };
    return this.flareUi;
  }

  private ensureAutosaveToast(): HTMLDivElement {
    if (this.autosaveToast) {
      return this.autosaveToast;
    }
    const toast = document.createElement('div');
    toast.id = 'hud-autosave';
    toast.className = 'hx-autosave';
    toast.setAttribute('data-hud', 'autosave');
    toast.setAttribute('role', 'status');
    toast.style.display = 'none';
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.style.display = 'inline-flex';
    glyph.innerHTML = GLYPH_SAVE;
    const title = document.createElement('span');
    title.textContent = tr({ en: 'Autosaved', zh: '已自动保存' });
    this.autosaveTitle = title;
    const label = document.createElement('span');
    label.className = 'hx-autosave-label';
    label.style.display = 'none';
    toast.append(glyph, title, label);
    this.placeAutosaveToast(toast);
    this.autosaveToast = toast;
    this.autosaveLabel = label;
    return toast;
  }

  private ensureCameraChip(): HTMLDivElement {
    if (this.cameraChip) {
      return this.cameraChip;
    }
    const chip = document.createElement('div');
    chip.id = 'hud-camera-mode';
    chip.setAttribute('data-hud', 'camera-mode');
    chip.style.display = 'none';
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.style.display = 'inline-flex';
    glyph.innerHTML = GLYPH_CAMERA;
    const label = document.createElement('span');
    const key = document.createElement('span');
    key.className = 'hx-key';
    key.textContent = 'V';
    chip.append(glyph, label, key);
    this.container.appendChild(chip);
    this.cameraChip = chip;
    this.cameraChipLabel = label;
    return chip;
  }

  private ensureBossUi(): BossStatusUi {
    if (this.bossUi) {
      return this.bossUi;
    }
    const root = document.createElement('div');
    root.id = 'hud-boss-status';
    root.setAttribute('data-hud', 'boss-status');
    root.style.display = 'none';
    const tag = document.createElement('span');
    tag.className = 'hx-boss-tag';
    tag.textContent = 'BOSS';
    const pipsHost = document.createElement('span');
    pipsHost.className = 'hx-boss-pips';
    const phase = document.createElement('span');
    phase.className = 'hx-boss-phase';
    const label = document.createElement('span');
    label.className = 'hx-boss-label';
    root.append(tag, pipsHost, phase, label);
    // 放在顶部消息栈最前：竖屏时随栈排成一行；桌面 / 横屏由样式固定在血条下方
    this.topStack.insertBefore(root, this.topStack.firstChild);
    this.bossUi = { root, pipsHost, pips: [], phase, label };
    return this.bossUi;
  }

  private ensureWarningUi(): WarningLaneUi {
    if (this.warningUi) {
      return this.warningUi;
    }
    const lane = document.createElement('div');
    lane.id = 'hud-warning-lane';

    const missile = document.createElement('div');
    missile.id = 'hud-missile-warning';
    missile.setAttribute('data-hud', 'missile-warning');
    missile.setAttribute('data-level', 'none');
    missile.setAttribute('role', 'alert');
    missile.style.display = 'none';
    const missileGlyph = document.createElement('span');
    missileGlyph.setAttribute('aria-hidden', 'true');
    missileGlyph.style.display = 'inline-flex';
    const missileMain = document.createElement('span');
    missileMain.className = 'hx-mw-main';
    const missileHint = document.createElement('span');
    missileHint.className = 'hx-mw-hint';
    missile.append(missileGlyph, missileMain, missileHint);

    const flash = document.createElement('div');
    flash.id = 'hud-flash-warning';
    flash.setAttribute('data-hud', 'flash-warning');
    flash.setAttribute('data-tone', 'threat');
    flash.style.display = 'none';
    const flashGlyph = document.createElement('span');
    flashGlyph.setAttribute('aria-hidden', 'true');
    flashGlyph.style.display = 'inline-flex';
    flashGlyph.innerHTML = GLYPH_WARNING;
    const flashText = document.createElement('span');
    flashText.className = 'hx-flash-text';
    flash.append(flashGlyph, flashText);

    lane.append(missile, flash);

    const edge = document.createElement('div');
    edge.id = 'hud-edge-alert';
    edge.setAttribute('aria-hidden', 'true');
    edge.setAttribute('data-level', 'none');

    this.container.append(edge, lane);
    this.warningUi = {
      lane,
      missile,
      missileGlyph,
      missileMain,
      missileHint,
      flash,
      flashText,
      edge,
    };
    return this.warningUi;
  }

  private setStyleVar(element: HTMLElement, name: string, value: string): void {
    let cache = this.styleValueCache.get(element);
    if (!cache) {
      cache = new Map<string, string>();
      this.styleValueCache.set(element, cache);
    }
    if (cache.get(name) === value) {
      return;
    }
    element.style.setProperty(name, value);
    cache.set(name, value);
  }

  /** <html> 上的页面级标记（供无线电等独立面板的样式协同）；value 为 null 时移除 */
  private static setRootMarker(name: string, value: string | null): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (value === null) {
      root.removeAttribute(name);
    } else if (root.getAttribute(name) !== value) {
      root.setAttribute(name, value);
    }
  }

  private static setAttr(element: Element, name: string, value: string): void {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  private static clamp01(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  }

  private static finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
  }

  /** Infinity 表示无限弹药（热量武器）；NaN / 负数按 0 处理 */
  private static normalizeMaxAmmo(value: number): number {
    if (value === Infinity) {
      return Infinity;
    }
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  /** 百分之一精度，避免每帧微小变化都写样式 */
  private static quantize(value: number): number {
    return Math.round(HUD.clamp01(value) * 100) / 100;
  }

  /**
   * 隐藏 HUD
   */
  public hide(): void {
    this.ensureInitialized();
    this.setStyleValue(this.container, 'display', 'none');
  }

  /**
   * 显示 HUD
   */
  public show(): void {
    this.ensureInitialized();
    this.setStyleValue(this.container, 'display', 'block');
  }

  /**
   * 显示游戏结束。
   * checkpointRetry：有可用检查点时传入，面板的主动作变成“从检查点重试”并写明回到哪里，
   * 不再提供“再来一局”（它会从头开始、清掉这份存档）；不传 / null 时面板与原来一样。
   */
  public showGameOver(
    finalScore: number,
    checkpointRetry: SettlementCheckpointRetry | null = null
  ): void {
    this.ensureInitialized();
    this.hideEventObjective();
    this.clearCombatAlerts();
    this.pendingBigMessage = null;
    this.hidePowerUpBig();
    this.hideRespawnOverlay();
    this.hideBriefingWithoutFlush();
    this.settlementKind = 'failed';
    this.settlementCheckpoint = checkpointRetry;
    this.renderSettlementTitle();
    this.renderSettlementLabels();
    this.setStyleValue(this.gameOverTitle, 'color', '#ff3333');
    this.setStyleValue(
      this.gameOverTitle,
      'textShadow',
      '0 0 20px rgba(255, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)'
    );
    this.finalScoreValue = finalScore;
    this.renderFinalScore();
    this.setStyleValue(this.settlementActionsRow, 'display', 'flex');
    this.setStyleValue(this.gameOverDisplay, 'opacity', '1');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'auto');
    this.focusSettlement();
  }

  /**
   * 显示最终胜利
   */
  public showMissionComplete(finalScore: number): void {
    this.ensureInitialized();
    this.hideEventObjective();
    this.clearCombatAlerts();
    this.pendingBigMessage = null;
    this.hidePowerUpBig();
    this.hideRespawnOverlay();
    this.hideBriefingWithoutFlush();
    this.settlementKind = 'complete';
    this.settlementCheckpoint = null;
    this.renderSettlementTitle();
    this.renderSettlementLabels();
    this.setStyleValue(this.gameOverTitle, 'color', '#66ffcc');
    this.setStyleValue(
      this.gameOverTitle,
      'textShadow',
      '0 0 20px rgba(102, 255, 204, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)'
    );
    this.finalScoreValue = finalScore;
    this.renderFinalScore();
    this.setStyleValue(this.settlementActionsRow, 'display', 'flex');
    this.setStyleValue(this.gameOverDisplay, 'opacity', '1');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'auto');
    this.focusSettlement();
  }

  /**
   * 结算面板出现（失败 / 通关，有没有检查点都一样）：第一个动作拿到焦点，Enter / Space 由按钮
   * 自己响应；面板显示期间 Tab / Shift+Tab 只在面板的动作之间循环，焦点走不到盖在下面的控件上
   */
  private focusSettlement(): void {
    this.settlementShownAt = performance.now();
    document.addEventListener('keydown', this.handleSettlementKeydown, true);
    this.retryButton.focus({ preventScroll: true });
  }

  /**
   * 挂在 document 的捕获阶段，自己移动焦点：InputHandler 在焦点不在表单控件上时会吞掉 Tab
   * （切换特殊武器），而浏览器默认的 Tab 顺序走完面板的动作之后会走到面板外面去
   */
  private readonly handleSettlementKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey) {
      return;
    }
    const actions = [this.retryButton, this.exitButton];
    const current = actions.findIndex((action) => action === document.activeElement);
    const last = actions.length - 1;
    let next: number;
    if (event.shiftKey) {
      next = current <= 0 ? last : current - 1;
    } else {
      next = current < 0 || current === last ? 0 : current + 1;
    }
    event.preventDefault();
    actions[next].focus({ preventScroll: true });
  };

  /**
   * 隐藏游戏结束
   */
  public hideGameOver(): void {
    this.ensureInitialized();
    document.removeEventListener('keydown', this.handleSettlementKeydown, true);
    this.settlementCheckpoint = null;
    this.setStyleValue(this.settlementActionsRow, 'display', 'none');
    this.setStyleValue(this.gameOverDisplay, 'opacity', '0');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'none');
  }

  public dispose(): void {
    this.hideEventObjective();
    if (this.initialized) {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
    }
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = null;
    document.removeEventListener('keydown', this.handleSettlementKeydown, true);
    if (this.container.parentElement) {
      this.container.remove();
    }
    if (this.powerUpBigDisplay.parentElement) {
      this.powerUpBigDisplay.remove();
    }
    if (this.damageFlashOverlay.parentElement) {
      this.damageFlashOverlay.remove();
    }
    if (this.gameOverDisplay.parentElement) {
      this.gameOverDisplay.remove();
    }
    if (this.respawnOverlay.parentElement) {
      this.respawnOverlay.remove();
    }
    this.briefingTimer = 0;
    this.respawnTimer = 0;
    this.pendingBigMessage = null;
    this.disposeCampaignHud();
    this.initialized = false;
  }

  /** 释放战役 HUD 状态；新元件都在 #hud 容器内，随容器一起移除 */
  private disposeCampaignHud(): void {
    const deck = this.deckMode || this.missileWarningLevel !== 'none' ? this.getTouchDeck() : null;
    if (deck?.flare) {
      deck.flare.removeAttribute('data-alert');
    }
    HUD.setRootMarker('data-hud-camera', null);
    HUD.setRootMarker('data-hud-boss', null);
    HUD.setRootMarker('data-hud-warning-rows', null);
    // 直接收起临时元件（不能调用会触发 init() 的公共方法）
    if (this.warningUi) {
      this.warningUi.missile.setAttribute('data-level', 'none');
      this.warningUi.edge.setAttribute('data-level', 'none');
      this.setStyleValue(this.warningUi.missile, 'display', 'none');
      this.setStyleValue(this.warningUi.flash, 'display', 'none');
    }
    this.container.removeAttribute('data-missile-warning');
    if (this.bossUi) {
      this.bossUi.root.classList.remove('is-phase-up');
      this.setStyleValue(this.bossUi.root, 'display', 'none');
    }
    if (this.autosaveToast) {
      this.autosaveToast.classList.remove('is-leaving');
      this.setStyleValue(this.autosaveToast, 'display', 'none');
    }
    if (this.cameraChip) {
      this.cameraChip.classList.remove('is-flash');
      this.setStyleValue(this.cameraChip, 'display', 'none');
    }
    this.autosaveTimer = 0;
    this.autosaveLeaving = false;
    this.autosaveLabelSource = null;
    this.flashWarningTimer = 0;
    this.flashWarningSource = null;
    this.flashWarningText = '';
    this.cameraFlashTimer = 0;
    this.bossFlashTimer = 0;
    this.bossStatusVisible = false;
    this.bossLabelSource = null;
    this.bossLabel = '';
    this.bossPhaseCurrent = 0;
    this.bossPhaseTotal = 0;
    this.missileWarningLevel = 'none';
    this.cameraMode = null;
    this.deckRefs = null;
    this.topStackObserver?.disconnect();
    this.topStackObserver = null;
    this.lastTopStackBottom = '';
    if (typeof document !== 'undefined') {
      document.documentElement.style.removeProperty('--hud-stack-bottom');
    }
  }
}
