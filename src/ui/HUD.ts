import { GAME_CONSTANTS, GameConfig } from '@/config';
import { SPECIAL_WEAPON_IDS } from '@/core/CombatContracts';
import { SPECIAL_WEAPON_CONFIGS } from '@/features/weapons/WeaponTypes';
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

export type BriefingTone = 'sys' | 'threat';

export interface BriefingRequest {
  kicker: string;
  title: string;
  line: string;
  tone: BriefingTone;
  durationMs: number;
}

export type HudCameraMode = 'third-person' | 'first-person';
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

type PendingBigMessage = {
  icon: string;
  name: string;
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
  private livesDisplay: HTMLDivElement;
  private missilesDisplay: HTMLDivElement;
  private missileProgressDisplay: HTMLDivElement; // 导弹补给进度条背景
  private missileProgressFill: HTMLDivElement; // 导弹补给进度条填充
  private powerUpDisplay: HTMLDivElement;
  private powerUpBigDisplay: HTMLDivElement;
  private powerUpBigIcon: HTMLDivElement;
  private powerUpBigText: HTMLDivElement;
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
  private briefingTimer: number = 0;
  private respawnTimer: number = 0;
  private pendingBigMessage: PendingBigMessage | null = null;
  private damageFlashTimer: number = 0;
  private damageFlashDuration: number = 0;
  private damageFlashPeakOpacity: number = 0;
  private lowHealthAlertActive: boolean = false;
  private activePowerUpName: string = '';
  private activePowerUpIcon: string = '';
  private lastPowerUpRemainingSeconds: number = -1;
  private layoutDensity: HudLayoutDensity = 'desktop';
  private densityExplicit: boolean = false;
  private aliveEnemyCount: number = 0;
  private remainingEnemyCount: number = 0;
  private lastLivesFilled: number | null = null;
  private lastMissilesFilled: number | null = null;
  private resizeHandler!: () => void;
  private readonly textContentCache = new WeakMap<HTMLElement, string>();
  private readonly styleValueCache = new WeakMap<HTMLElement, Map<string, string>>();

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
  private bossLabel: string = '';
  private bossPhaseCurrent: number = 0;
  private bossPhaseTotal: number = 0;
  private bossFlashTimer: number = 0;
  private missileWarningLevel: HudMissileWarningLevel = 'none';
  private flashWarningTimer: number = 0;
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
    const padding = isMobile ? '10px' : '20px';

    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: ${padding};
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
      top: ${isMobile ? '14px' : '18px'};
      left: ${padding};
      display: flex;
      flex-direction: column;
      gap: ${isMobile ? '8px' : '10px'};
      width: fit-content;
      max-width: ${this.getCabinMaxWidth()};
      pointer-events: none;
    `;

    this.leftPrimaryRow = document.createElement('div');
    this.leftPrimaryRow.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${isMobile ? '8px' : '10px'};
      align-items: stretch;
    `;

    this.upgradePointsDisplay = document.createElement('div');
    this.upgradePointsDisplay.style.cssText = `
      font-size: ${isMobile ? '12px' : '14px'};
      color: #FFD76A;
      background: linear-gradient(135deg, rgba(38, 31, 16, 0.9), rgba(76, 56, 12, 0.78));
      border: 1px solid rgba(255, 215, 106, 0.45);
      border-radius: 12px;
      padding: ${isMobile ? '6px 10px' : '8px 12px'};
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
    this.scoreDisplay.style.cssText = `
      font-size: ${isMobile ? '16px' : '19px'};
      min-height: ${isMobile ? '44px' : '60px'};
      display: flex;
      align-items: center;
      padding: ${isMobile ? '10px 12px' : '12px 14px'};
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
    this.setTextContent(this.scoreDisplay, '得分 000000');

    this.speedDisplay = document.createElement('div');
    this.speedDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '16px'};
      min-height: ${isMobile ? '44px' : '60px'};
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: ${isMobile ? '10px 10px' : '12px 12px'};
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
    this.setTextContent(this.speedDisplay, '速度 000');

    this.eventObjectiveDisplay = document.createElement('div');
    this.eventObjectiveDisplay.style.cssText = `
      position: absolute;
      top: ${isMobile ? '56px' : '74px'};
      left: 50%;
      transform: translateX(-50%);
      min-width: ${isMobile ? '220px' : '280px'};
      max-width: ${isMobile ? '72vw' : '34vw'};
      padding: ${isMobile ? '8px 12px' : '10px 16px'};
      border-radius: 14px;
      background: linear-gradient(160deg, rgba(18, 26, 42, 0.88), rgba(8, 12, 20, 0.76));
      border: 1px solid rgba(132, 210, 255, 0.24);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 24px rgba(0, 0, 0, 0.18);
      display: none;
      pointer-events: none;
      text-align: center;
      backdrop-filter: blur(8px);
    `;

    this.eventObjectiveTitle = document.createElement('div');
    this.eventObjectiveTitle.style.cssText = `
      font-size: ${isMobile ? '11px' : '12px'};
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #8fe4ff;
      text-transform: uppercase;
      margin-bottom: 4px;
    `;
    this.setTextContent(this.eventObjectiveTitle, '作战目标');

    this.eventObjectiveText = document.createElement('div');
    this.eventObjectiveText.style.cssText = `
      font-size: ${isMobile ? '13px' : '15px'};
      font-weight: 700;
      color: #f5fbff;
      text-shadow: 0 0 12px rgba(120, 220, 255, 0.16);
      line-height: 1.35;
      white-space: normal;
      word-break: break-word;
    `;
    this.setTextContent(this.eventObjectiveText, '');

    this.eventObjectiveStatus = document.createElement('div');
    this.eventObjectiveStatus.style.cssText = `
      margin-top: 6px;
      font-size: ${isMobile ? '10px' : '11px'};
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(183, 231, 255, 0.86);
      text-transform: uppercase;
      white-space: normal;
      word-break: break-word;
      display: none;
    `;
    this.setTextContent(this.eventObjectiveStatus, '');

    this.eventObjectiveDisplay.appendChild(this.eventObjectiveTitle);
    this.eventObjectiveDisplay.appendChild(this.eventObjectiveText);
    this.eventObjectiveDisplay.appendChild(this.eventObjectiveStatus);
    this.container.appendChild(this.eventObjectiveDisplay);

    this.briefingDisplay = document.createElement('div');
    this.briefingDisplay.id = 'hud-briefing';
    this.briefingDisplay.setAttribute('data-hud', 'briefing');
    this.briefingDisplay.setAttribute('data-briefing', '');
    this.briefingDisplay.setAttribute('data-tone', 'sys');
    this.briefingDisplay.style.cssText = `
      position: absolute;
      top: ${isMobile ? '52px' : '70px'};
      left: 50%;
      transform: translateX(-50%);
      width: min(80vw, 420px);
      max-width: min(80vw, 420px);
      box-sizing: border-box;
      padding: ${isMobile ? '10px 14px' : '12px 16px'};
      display: none;
      opacity: 0;
      pointer-events: none;
      z-index: 4;
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
      align-items: baseline;
      justify-content: center;
      gap: 8px;
      line-height: 1.25;
    `;

    this.briefingKicker = document.createElement('div');
    this.briefingKicker.style.cssText = `
      font-size: ${isMobile ? '10px' : '11px'};
      font-weight: 700;
      letter-spacing: 0.16em;
      color: var(--hud-sys, ${HUD_COLORS.sys});
      white-space: nowrap;
    `;

    this.briefingTitle = document.createElement('div');
    this.briefingTitle.style.cssText = `
      font-size: ${isMobile ? '16px' : '18px'};
      font-weight: 700;
      color: var(--hud-text, ${HUD_COLORS.text});
      letter-spacing: 0.04em;
      white-space: nowrap;
    `;

    this.briefingLine = document.createElement('div');
    this.briefingLine.style.cssText = `
      margin-top: 6px;
      font-size: ${isMobile ? '12px' : '13px'};
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
    this.container.appendChild(this.briefingDisplay);
    this.leftPrimaryRow.appendChild(this.scoreDisplay);
    this.leftPrimaryRow.appendChild(this.speedDisplay);
    this.leftStatusPanel.appendChild(this.leftPrimaryRow);
    this.leftStatusPanel.appendChild(this.upgradePointsDisplay);
    this.container.appendChild(this.leftStatusPanel);

    this.enemiesDisplay = document.createElement('div');
    this.enemiesDisplay.style.cssText = `
      font-size: ${isMobile ? '12px' : '14px'};
      position: absolute;
      top: ${isMobile ? '54px' : '70px'};
      right: ${padding};
      color: var(--hud-muted, ${HUD_COLORS.muted});
      letter-spacing: 0.08em;
      font-variant-numeric: tabular-nums;
    `;
    this.setTextContent(this.enemiesDisplay, '敌人 0 · 剩余 0');

    // 生命值显示（几何 pip，非 emoji）
    this.livesDisplay = document.createElement('div');
    this.livesDisplay.id = 'hud-lives';
    this.livesDisplay.setAttribute('data-hud', 'lives');
    this.livesDisplay.className = 'hud-pip-row';
    this.livesDisplay.style.cssText = `
      position: absolute;
      top: ${isMobile ? '76px' : '95px'};
      right: ${padding};
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
      position: absolute;
      top: ${isMobile ? '98px' : '120px'};
      right: ${padding};
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
    `;
    this.renderMissilePips(GAME_CONSTANTS.MISSILE.MAX_MISSILES);

    // 导弹补给进度条（导弹UI下方）
    const progressTop = isMobile ? 120 : 144;
    this.missileProgressDisplay = document.createElement('div');
    this.missileProgressDisplay.style.cssText = `
      position: absolute;
      top: ${progressTop}px;
      right: ${padding};
      width: ${isMobile ? '100px' : '120px'};
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.5);
    `;

    this.missileProgressFill = document.createElement('div');
    this.missileProgressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #ffffff, #e0e0e0);
      transition: width 0.5s ease-out;
    `;
    this.missileProgressDisplay.appendChild(this.missileProgressFill);

    // 道具提示显示（右上角）
    this.powerUpDisplay = document.createElement('div');
    this.powerUpDisplay.style.cssText = `
      font-size: ${isMobile ? '14px' : '18px'};
      position: absolute;
      top: ${isMobile ? '120px' : '145px'};
      right: ${padding};
      color: #ffff00;
      text-shadow: 0 0 4px rgba(255, 255, 0, 0.5);
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    this.setTextContent(this.powerUpDisplay, '');

    // 道具大字提示显示（屏幕中央）
    this.powerUpBigDisplay = document.createElement('div');
    this.powerUpBigDisplay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 80;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    this.powerUpBigIcon = document.createElement('div');
    this.powerUpBigIcon.className = 'powerup-big-icon';
    this.powerUpBigIcon.style.cssText = `
      font-size: 48px;
      max-width: 48px;
      max-height: 48px;
      line-height: 1;
      overflow: hidden;
      text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.4);
      margin-bottom: 20px;
      animation: bounce 0.5s ease-out;
    `;

    this.powerUpBigText = document.createElement('div');
    this.powerUpBigText.className = 'powerup-big-text';
    this.powerUpBigText.style.cssText = `
      font-size: ${isMobile ? '48px' : '64px'};
      font-weight: bold;
      color: #ffff00;
      text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1);
      white-space: nowrap;
    `;

    this.powerUpBigSubtext = document.createElement('div');
    this.powerUpBigSubtext.className = 'powerup-big-subtext';
    this.powerUpBigSubtext.style.cssText = `
      font-size: ${isMobile ? '24px' : '32px'};
      font-weight: bold;
      color: #ffffff;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
      margin-top: 10px;
      white-space: nowrap;
      display: none;
    `;
    this.setTextContent(this.powerUpBigSubtext, '');

    this.powerUpBigDisplay.appendChild(this.powerUpBigIcon);
    this.powerUpBigDisplay.appendChild(this.powerUpBigText);
    this.powerUpBigDisplay.appendChild(this.powerUpBigSubtext);

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
    this.setTextContent(this.gameOverTitle, 'MISSION FAILED');

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
    this.settlementActionsRow.appendChild(
      this.createSettlementButton('再来一局', () => {
        this.settlementActions?.onRetry();
      })
    );
    this.settlementActionsRow.appendChild(
      this.createSettlementButton('返回菜单', () => {
        this.settlementActions?.onExitToMenu();
      })
    );

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
    this.container.appendChild(this.enemiesDisplay);
    this.container.appendChild(this.livesDisplay);
    this.container.appendChild(this.missilesDisplay);
    this.container.appendChild(this.missileProgressDisplay);
    this.container.appendChild(this.powerUpDisplay);

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
    this.applyLayoutDensity();
    this.initialized = true;
  }

  private ensureInitialized(): void {
    this.init();
  }

  /**
   * 创建生命值条（紧凑设计）
   */
  private createHealthBar(isMobile: boolean): HTMLDivElement {
    const container = document.createElement('div');
    const barWidth = isMobile ? '180px' : '250px';
    const barHeight = isMobile ? '20px' : '25px';

    container.style.cssText = `
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
  public setSettlementActions(actions: {
    onRetry: () => void;
    onExitToMenu: () => void;
  }): void {
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

      .powerup-big-icon {
        max-width: 48px;
        max-height: 48px;
        font-size: 48px;
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
    this.setTextContent(this.scoreDisplay, `得分 ${score.toString().padStart(6, '0')}`);
  }

  /**
   * 更新速度显示
   */
  public updateSpeed(speed: number): void {
    this.ensureInitialized();
    const displaySpeed = Math.round(speed * 10); // 放大显示
    this.setTextContent(this.speedDisplay, `速度 ${displaySpeed.toString().padStart(3, '0')} km/h`);
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
  }

  public updateEventObjectiveStatus(status: string): void {
    this.ensureInitialized();
    this.setTextContent(this.eventObjectiveStatus, status);
    this.setStyleValue(
      this.eventObjectiveStatus,
      'display',
      status.length > 0 ? 'block' : 'none'
    );
  }

  public hideEventObjective(): void {
    this.ensureInitialized();
    this.applyEventObjectiveTone('default');
    this.setTextContent(this.eventObjectiveText, '');
    this.setTextContent(this.eventObjectiveStatus, '');
    this.setStyleValue(this.eventObjectiveStatus, 'display', 'none');
    this.setStyleValue(this.eventObjectiveDisplay, 'display', 'none');
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
      this.setStyleValue(
        this.eventObjectiveTitle,
        'color',
        '#9dffb8'
      );
      this.setStyleValue(
        this.eventObjectiveText,
        'textShadow',
        '0 0 12px rgba(120, 255, 176, 0.14)'
      );
      this.setStyleValue(
        this.eventObjectiveStatus,
        'color',
        'rgba(206, 255, 220, 0.9)'
      );
      return;
    }

    this.setStyleValue(
      this.eventObjectiveDisplay,
      'background',
      'linear-gradient(160deg, rgba(18, 26, 42, 0.88), rgba(8, 12, 20, 0.76))'
    );
    this.setStyleValue(
      this.eventObjectiveDisplay,
      'border',
      '1px solid rgba(132, 210, 255, 0.24)'
    );
    this.setStyleValue(this.eventObjectiveTitle, 'color', '#8fe4ff');
    this.setStyleValue(
      this.eventObjectiveText,
      'textShadow',
      '0 0 12px rgba(120, 220, 255, 0.16)'
    );
    this.setStyleValue(
      this.eventObjectiveStatus,
      'color',
      'rgba(183, 231, 255, 0.86)'
    );
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
    this.setStyleValue(this.leftStatusPanel, 'maxWidth', this.getCabinMaxWidth());
    this.applyHealthBarLayout();
    this.refreshDeckMode();
    this.applyCameraChipVisibility();
    this.applyTopStackOffset();
    if (this.warningUi && this.missileWarningLevel !== 'none') {
      this.renderMissileWarning(this.warningUi);
    }
  }

  /** 竖屏时血条靠右并收窄，避免压住左上角的得分舱 */
  private applyHealthBarLayout(): void {
    const density = this.layoutDensity;
    const portrait = density === 'touch-portrait';
    const width =
      density === 'desktop' ? '250px' : portrait ? 'min(150px, calc(100% - 190px))' : '180px';
    this.setStyleValue(this.healthBarContainer, 'width', width);
    this.setStyleValue(this.healthBarContainer, 'left', portrait ? 'auto' : '50%');
    this.setStyleValue(
      this.healthBarContainer,
      'right',
      portrait ? 'max(10px, env(safe-area-inset-right))' : 'auto'
    );
    this.setStyleValue(
      this.healthBarContainer,
      'transform',
      portrait ? 'none' : 'translateX(-50%)'
    );
  }

  /** Boss 阶段条出现时把简报卡 / 事件目标往下让一行（竖屏阶段条在别处，不需要让） */
  private applyTopStackOffset(): void {
    const touch = this.layoutDensity !== 'desktop';
    let shift = 0;
    if (this.bossStatusVisible) {
      shift =
        this.layoutDensity === 'touch-landscape' ? 22 : this.layoutDensity === 'desktop' ? 8 : 0;
    }
    this.setStyleValue(this.briefingDisplay, 'top', `${(touch ? 52 : 70) + shift}px`);
    this.setStyleValue(this.eventObjectiveDisplay, 'top', `${(touch ? 56 : 74) + shift}px`);
  }

  private renderWaveLine(): void {
    this.setTextContent(
      this.enemiesDisplay,
      `敌人 ${this.aliveEnemyCount} · 剩余 ${this.remainingEnemyCount}`
    );
  }

  private renderLifePips(filled: number): void {
    if (this.lastLivesFilled === filled) {
      return;
    }
    this.lastLivesFilled = filled;
    this.renderPips(this.livesDisplay, filled, HUD.MAX_DISPLAY_LIVES, 'hud-life-pip', HUD_COLORS.lock);
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
    if (points > 0) {
      const isMobile = GameConfig.isMobile;
      const hintText = isMobile
        ? `⭐ 升级点 ${points}`
        : `⭐ 升级点 ${points} · 按 U 打开`;
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
  }

  /**
   * 显示道具提示
   * @param name 道具名称
   * @param icon 道具图标
   * @param duration 持续时间（秒），0表示即时效果（如生命恢复、炸弹）
   */
  public showPowerUp(name: string, icon: string, duration: number = 0): void {
    this.ensureInitialized();
    // 即时效果道具（duration <= 0）不显示在右上角
    if (duration <= 0) {
      this.hidePowerUp();
      return;
    }

    // 只有持续效果的道具才显示在右上角
    this.activePowerUpName = name;
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
   * @param name 道具名称
   * @param minDisplayTime 最小显示时间（秒），默认 800ms
   * @param hideSubtext 是否隐藏副标题，默认false
   */
  public showPowerUpBig(
    icon: string,
    name: string,
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
    this.setTextContent(this.briefingKicker, briefing.kicker);
    this.setTextContent(this.briefingTitle, briefing.title);
    this.setTextContent(this.briefingLine, briefing.line);
    this.setStyleValue(this.briefingDisplay, 'display', 'block');
    this.setStyleValue(this.briefingDisplay, 'opacity', '1');
    this.briefingTimer = Math.max(0, briefing.durationMs) / 1000;
    if (this.briefingTimer <= 0) {
      this.hideBriefing();
    }
  }

  public hideBriefing(): void {
    this.ensureInitialized();
    this.briefingTimer = 0;
    this.setTextContent(this.briefingKicker, '');
    this.setTextContent(this.briefingTitle, '');
    this.setTextContent(this.briefingLine, '');
    this.setStyleValue(this.briefingDisplay, 'opacity', '0');
    this.setStyleValue(this.briefingDisplay, 'display', 'none');
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
  }

  private presentPowerUpBig(
    icon: string,
    name: string,
    minDisplayTime: number,
    hideSubtext: boolean,
    variant: BigMessageVariant
  ): void {
    this.applyBigMessageVariant(variant);
    this.setTextContent(this.powerUpBigIcon, icon);
    this.setStyleValue(this.powerUpBigIcon, 'display', icon ? 'block' : 'none');
    this.setTextContent(this.powerUpBigText, name);
    const shouldHideSubtext = variant === 'announcement' ? true : hideSubtext;
    this.setTextContent(
      this.powerUpBigSubtext,
      variant === 'powerup' ? '获得道具！' : ''
    );
    this.setStyleValue(this.powerUpBigSubtext, 'display', shouldHideSubtext ? 'none' : 'block');
    this.setStyleValue(this.powerUpBigDisplay, 'opacity', '1');
    this.powerUpBigTimer = minDisplayTime;
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
    this.setTextContent(this.briefingKicker, '');
    this.setTextContent(this.briefingTitle, '');
    this.setTextContent(this.briefingLine, '');
    this.setStyleValue(this.briefingDisplay, 'opacity', '0');
    this.setStyleValue(this.briefingDisplay, 'display', 'none');
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

  private applyBigMessageVariant(variant: BigMessageVariant): void {
    if (variant === 'powerup') {
      this.setStyleValue(
        this.powerUpBigIcon,
        'textShadow',
        '0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.4)'
      );
      this.setStyleValue(this.powerUpBigText, 'color', '#ffff00');
      this.setStyleValue(
        this.powerUpBigText,
        'textShadow',
        '0 0 20px rgba(255, 215, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)'
      );
      this.setStyleValue(this.powerUpBigSubtext, 'color', '#ffffff');
      this.setStyleValue(
        this.powerUpBigSubtext,
        'textShadow',
        '2px 2px 4px rgba(0, 0, 0, 1)'
      );
      return;
    }

    this.setStyleValue(
      this.powerUpBigIcon,
      'textShadow',
      '0 0 24px rgba(120, 220, 255, 0.55), 0 0 48px rgba(80, 140, 255, 0.2)'
    );
    this.setStyleValue(this.powerUpBigText, 'color', '#f3fbff');
    this.setStyleValue(
      this.powerUpBigText,
      'textShadow',
      '0 0 18px rgba(120, 220, 255, 0.45), 4px 4px 8px rgba(0, 0, 0, 0.95)'
    );
    this.setStyleValue(this.powerUpBigSubtext, 'color', '#d9f4ff');
    this.setStyleValue(
      this.powerUpBigSubtext,
      'textShadow',
      '0 0 12px rgba(120, 220, 255, 0.25), 2px 2px 4px rgba(0, 0, 0, 0.95)'
    );
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
    this.setTextContent(ui.lamp, overheated ? '过热' : ready ? '就绪' : '');

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

  /** 自动存档提示：驾驶舱信息栏下方的短暂绿色提示，约 2.6 秒后淡出（由 update 驱动） */
  public showAutosave(label?: string): void {
    this.ensureInitialized();
    const toast = this.ensureAutosaveToast();
    const text = typeof label === 'string' ? label.trim() : '';
    if (this.autosaveLabel) {
      this.setTextContent(this.autosaveLabel, text);
      this.setStyleValue(this.autosaveLabel, 'display', text ? 'inline' : 'none');
    }
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
    if (this.cameraChipLabel) {
      this.setTextContent(this.cameraChipLabel, next === 'first-person' ? '第一人称' : '第三人称');
    }
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
    if (deck.cameraSub) {
      this.setTextContent(deck.cameraSub, next === 'first-person' ? '座舱' : '机外');
    }
  }

  /**
   * Boss 状态条（血条下方）：标签 + 阶段菱形；label 为 null 时隐藏。
   * 阶段推进时整条闪一下。
   */
  public setBossStatus(label: string | null, phase?: { current: number; total: number }): void {
    this.ensureInitialized();
    if (label === null || label === undefined) {
      if (!this.bossStatusVisible) {
        return;
      }
      this.bossStatusVisible = false;
      this.bossLabel = '';
      this.bossPhaseCurrent = 0;
      this.bossPhaseTotal = 0;
      this.bossFlashTimer = 0;
      if (this.bossUi) {
        this.bossUi.root.classList.remove('is-phase-up');
        this.setStyleValue(this.bossUi.root, 'display', 'none');
      }
      HUD.setRootMarker('data-hud-boss', null);
      this.applyTopStackOffset();
      return;
    }

    const ui = this.ensureBossUi();
    const total = phase
      ? Math.max(0, Math.min(HUD.MAX_BOSS_PIPS, Math.round(HUD.finiteOr(phase.total, 0))))
      : 0;
    const current = phase
      ? Math.max(0, Math.min(total, Math.round(HUD.finiteOr(phase.current, 0))))
      : 0;
    const text = String(label);
    if (
      this.bossStatusVisible &&
      text === this.bossLabel &&
      total === this.bossPhaseTotal &&
      current === this.bossPhaseCurrent
    ) {
      return;
    }

    const phaseAdvanced = this.bossStatusVisible && current > this.bossPhaseCurrent;
    this.setTextContent(ui.label, text);
    this.setStyleValue(ui.label, 'display', text ? 'inline' : 'none');

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
    this.setTextContent(ui.phase, total > 0 ? `阶段 ${current}/${total}` : '');
    this.setStyleValue(ui.phase, 'display', total > 0 ? 'inline' : 'none');
    ui.root.setAttribute('data-phase', String(current));
    ui.root.setAttribute('data-phase-total', String(total));

    this.bossLabel = text;
    this.bossPhaseCurrent = current;
    this.bossPhaseTotal = total;
    if (!this.bossStatusVisible) {
      this.bossStatusVisible = true;
      this.setStyleValue(ui.root, 'display', 'flex');
      // 竖屏时阶段条占一整行，无线电面板据此下移
      HUD.setRootMarker('data-hud-boss', 'on');
      this.applyTopStackOffset();
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
  }

  /** 屏幕中下方的闪烁告警（Boss 招式预警、武器过热等），约 2.2 秒后消失；同一句话重复调用只续时 */
  public flashWarning(text: string, tone: HudWarningTone = 'threat'): void {
    this.ensureInitialized();
    const message = typeof text === 'string' ? text.trim() : '';
    if (!message) {
      return;
    }
    const ui = this.ensureWarningUi();
    const nextTone: HudWarningTone = tone === 'sys' || tone === 'ally' ? tone : 'threat';
    const repeat =
      this.flashWarningTimer > 0 &&
      this.flashWarningText === message &&
      this.flashWarningTone === nextTone;
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
  }

  private updateCampaignTimers(deltaTime: number): void {
    if (this.autosaveTimer > 0) {
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
    if (this.autosaveToast) {
      this.autosaveToast.classList.remove('is-leaving');
      this.setStyleValue(this.autosaveToast, 'display', 'none');
    }
  }

  private hideFlashWarning(): void {
    this.flashWarningTimer = 0;
    this.flashWarningText = '';
    if (this.warningUi) {
      this.setStyleValue(this.warningUi.flash, 'display', 'none');
    }
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
    this.setTextContent(ui.missileMain, incoming ? '导弹来袭' : '被锁定');
    const hint = document.createDocumentFragment();
    if (incoming) {
      const key = document.createElement('span');
      key.className = 'hx-key';
      key.textContent = 'G';
      hint.appendChild(key);
    }
    hint.appendChild(document.createTextNode(incoming ? '投放热焰弹' : '准备热焰弹'));
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
        return { value: heat, label: '过热冷却中' };
      }
      if (heat >= 0.01) {
        return { value: heat, label: `热量 ${percent(heat)}` };
      }
    }
    if (mode === 'charge' && charge > 0) {
      return { value: charge, label: charge >= 1 ? '蓄满，松开发射' : `蓄能 ${percent(charge)}` };
    }
    if (Number.isFinite(maxAmmo) && maxAmmo > 0 && ammo <= 0) {
      return { value: reload, label: `装填 ${percent(reload)}` };
    }
    if (cooldown > 0) {
      return { value: 1 - cooldown, label: mode === 'pulse' ? '充能中' : '冷却中' };
    }
    if (mode === 'beam') {
      return { value: 0, label: keyboard ? '按住 F 照射' : '按住照射' };
    }
    if (mode === 'charge') {
      return { value: 1, label: keyboard ? '按住 F 蓄能' : '按住蓄能' };
    }
    if (mode === 'pulse') {
      return { value: 1, label: keyboard ? 'F 键释放' : '轻触释放' };
    }
    return { value: 1, label: keyboard ? 'F 键齐射' : '轻触齐射' };
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
      this.setTextContent(deck.specialMain, info?.code || '特武');
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
    label.append(document.createTextNode('热焰弹'), key);

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
    title.textContent = '已自动保存';
    const label = document.createElement('span');
    label.className = 'hx-autosave-label';
    label.style.display = 'none';
    toast.append(glyph, title, label);
    this.leftStatusPanel.appendChild(toast);
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
    this.container.appendChild(root);
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
   * 显示游戏结束
   */
  public showGameOver(finalScore: number): void {
    this.ensureInitialized();
    this.hideEventObjective();
    this.clearCombatAlerts();
    this.pendingBigMessage = null;
    this.hidePowerUpBig();
    this.hideRespawnOverlay();
    this.hideBriefingWithoutFlush();
    this.setTextContent(this.gameOverTitle, 'MISSION FAILED');
    this.setStyleValue(this.gameOverTitle, 'color', '#ff3333');
    this.setStyleValue(
      this.gameOverTitle,
      'textShadow',
      '0 0 20px rgba(255, 0, 0, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)'
    );
    this.setTextContent(this.finalScoreDisplay, `最终得分: ${finalScore}`);
    this.setStyleValue(this.settlementActionsRow, 'display', 'flex');
    this.setStyleValue(this.gameOverDisplay, 'opacity', '1');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'auto');
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
    this.setTextContent(this.gameOverTitle, 'MISSION COMPLETE');
    this.setStyleValue(this.gameOverTitle, 'color', '#66ffcc');
    this.setStyleValue(
      this.gameOverTitle,
      'textShadow',
      '0 0 20px rgba(102, 255, 204, 0.8), 4px 4px 8px rgba(0, 0, 0, 1)'
    );
    this.setTextContent(this.finalScoreDisplay, `最终得分: ${finalScore}`);
    this.setStyleValue(this.settlementActionsRow, 'display', 'flex');
    this.setStyleValue(this.gameOverDisplay, 'opacity', '1');
    this.setStyleValue(this.gameOverDisplay, 'pointerEvents', 'auto');
  }

  /**
   * 隐藏游戏结束
   */
  public hideGameOver(): void {
    this.ensureInitialized();
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
    this.flashWarningTimer = 0;
    this.flashWarningText = '';
    this.cameraFlashTimer = 0;
    this.bossFlashTimer = 0;
    this.bossStatusVisible = false;
    this.bossLabel = '';
    this.bossPhaseCurrent = 0;
    this.bossPhaseTotal = 0;
    this.missileWarningLevel = 'none';
    this.cameraMode = null;
    this.deckRefs = null;
    this.applyTopStackOffset();
  }
}
